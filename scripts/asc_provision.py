#!/usr/bin/env python3
"""
App Store Connect API Provisioning Automation (CI macOS Runner).
Implements Section 3.3:
  1. Generates ES256 JWT (aud: appstoreconnect-v1)
  2. Finds or registers Bundle ID via GET/POST /v1/bundleIds
  3. Locates active Apple Distribution certificate via GET /v1/certificates
  4. Fetches or creates IOS_APP_STORE profile via GET/POST /v1/profiles
  5. Installs profile into ~/Library/MobileDevice/Provisioning Profiles/<UUID>.mobileprovision
  6. Extracts UUID, Name, TeamIdentifier via security cms + PlistBuddy/plistlib
  7. Writes dynamic exportOptions.plist (method: app-store, signingStyle: manual)
  8. Exports PROFILE_NAME, PROFILE_UUID, TEAM_ID, BUNDLE_ID to $GITHUB_ENV
"""

import base64
import os
import plistlib
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Dict, Optional

import jwt
import requests

ASC_API = "https://api.appstoreconnect.apple.com/v1"


def make_jwt(key_id: str, issuer_id: str, private_key_pem: str) -> str:
    now = int(time.time())
    payload = {
        "iss": issuer_id,
        "iat": now - 10,
        "exp": now + 15 * 60,
        "aud": "appstoreconnect-v1",
    }
    token = jwt.encode(
        payload,
        private_key_pem,
        algorithm="ES256",
        headers={"kid": key_id, "typ": "JWT"},
    )
    return token if isinstance(token, str) else token.decode("utf-8")


def asc_request(method: str, path: str, token: str, **kwargs: Any) -> Dict[str, Any]:
    headers = kwargs.pop("headers", {})
    headers.update(
        {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
    )
    url = f"{ASC_API}{path}"
    resp = requests.request(method, url, headers=headers, timeout=30, **kwargs)
    if resp.status_code >= 400:
        raise RuntimeError(f"ASC API {method} {path} failed ({resp.status_code}): {resp.text}")
    return resp.json() if resp.content else {}


def ensure_bundle_id(token: str, bundle_identifier: str, app_name: str) -> str:
    data = asc_request(
        "GET",
        f"/bundleIds?filter[identifier]={bundle_identifier}&filter[platform]=IOS",
        token,
    )
    for item in data.get("data", []):
        if item.get("attributes", {}).get("identifier") == bundle_identifier:
            print(f"[ASC] Found existing Bundle ID: {item['id']} ({bundle_identifier})")
            return item["id"]

    created = asc_request(
        "POST",
        "/bundleIds",
        token,
        json={
            "data": {
                "type": "bundleIds",
                "attributes": {
                    "identifier": bundle_identifier,
                    "name": f"{app_name} iOS",
                    "platform": "IOS",
                },
            }
        },
    )
    bid = created["data"]["id"]
    print(f"[ASC] Registered new Bundle ID: {bid} ({bundle_identifier})")
    return bid


def find_distribution_cert_id(token: str) -> str:
    data = asc_request("GET", "/certificates?limit=100", token)
    candidates = []
    for cert in data.get("data", []):
        ctype = cert.get("attributes", {}).get("certificateType", "")
        if ctype in ("DISTRIBUTION", "IOS_DISTRIBUTION"):
            candidates.append(cert)

    if not candidates:
        raise RuntimeError(
            "No active Apple Distribution certificate found in App Store Connect. "
            "Upload your Apple Distribution cert before running this workflow."
        )

    # Prefer latest expirationDate
    candidates.sort(
        key=lambda c: c.get("attributes", {}).get("expirationDate", ""),
        reverse=True,
    )
    chosen = candidates[0]
    print(
        f"[ASC] Selected Distribution Certificate: {chosen['id']} "
        f"(type={chosen['attributes'].get('certificateType')}, "
        f"expires={chosen['attributes'].get('expirationDate')})"
    )
    return chosen["id"]


def ensure_app_store_profile(
    token: str, bundle_id_resource: str, cert_id: str, profile_name: str
) -> bytes:
    data = asc_request(
        "GET",
        f"/profiles?filter[profileType]=IOS_APP_STORE&include=bundleId,certificates&limit=100",
        token,
    )

    for prof in data.get("data", []):
        attrs = prof.get("attributes", {})
        rels = prof.get("relationships", {})
        bid_data = rels.get("bundleId", {}).get("data", {})
        cert_list = rels.get("certificates", {}).get("data", [])
        cert_ids = {c.get("id") for c in cert_list}

        if (
            attrs.get("profileState") == "ACTIVE"
            and bid_data.get("id") == bundle_id_resource
            and cert_id in cert_ids
            and attrs.get("profileContent")
        ):
            print(f"[ASC] Reusing active IOS_APP_STORE profile: {attrs.get('name')} ({prof['id']})")
            return base64.b64decode(attrs["profileContent"])

        # Remove stale/invalid profile with same name to avoid 409 conflict
        if attrs.get("name") == profile_name:
            print(f"[ASC] Deleting outdated profile {prof['id']} ({attrs.get('profileState')})")
            asc_request("DELETE", f"/profiles/{prof['id']}", token)

    created = asc_request(
        "POST",
        "/profiles",
        token,
        json={
            "data": {
                "type": "profiles",
                "attributes": {
                    "name": profile_name,
                    "profileType": "IOS_APP_STORE",
                },
                "relationships": {
                    "bundleId": {
                        "data": {"type": "bundleIds", "id": bundle_id_resource}
                    },
                    "certificates": {
                        "data": [{"type": "certificates", "id": cert_id}]
                    },
                },
            }
        },
    )
    content_b64 = created["data"]["attributes"]["profileContent"]
    print(f"[ASC] Created new IOS_APP_STORE profile: {profile_name} ({created['data']['id']})")
    return base64.b64decode(content_b64)


def decode_mobileprovision(profile_bytes: bytes) -> Dict[str, Any]:
    # Extract XML plist embedded inside PKCS#7 CMS envelope
    start = profile_bytes.find(b"<?xml")
    end = profile_bytes.find(b"</plist>")
    if start != -1 and end != -1:
        xml_bytes = profile_bytes[start : end + len(b"</plist>")]
        return plistlib.loads(xml_bytes)

    # Fallback to macOS security cms -D
    proc = subprocess.run(
        ["security", "cms", "-D"],
        input=profile_bytes,
        capture_output=True,
        check=True,
    )
    return plistlib.loads(proc.stdout)


def main() -> None:
    key_id = os.environ["APP_STORE_CONNECT_KEY_ID"].strip()
    issuer_id = os.environ["APP_STORE_CONNECT_ISSUER_ID"].strip()
    private_key = os.environ["APP_STORE_CONNECT_API_KEY"].strip()
    bundle_id = os.environ.get("APP_BUNDLE_ID", "com.omniconvert.app").strip()
    app_name = os.environ.get("APP_NAME", "OmniConvert Pro").strip()
    export_plist_path = Path(
        os.environ.get("EXPORT_OPTIONS_PLIST", "ios/App/exportOptions.plist")
    )

    token = make_jwt(key_id, issuer_id, private_key)
    bundle_res_id = ensure_bundle_id(token, bundle_id, app_name)
    cert_id = find_distribution_cert_id(token)
    profile_bytes = ensure_app_store_profile(
        token, bundle_res_id, cert_id, f"{bundle_id} AppStore CI"
    )

    profile_plist = decode_mobileprovision(profile_bytes)
    uuid: str = profile_plist["UUID"]
    name: str = profile_plist["Name"]
    team_id: str = profile_plist["TeamIdentifier"][0]

    # Install into macOS Provisioning Profiles directory
    profiles_dir = Path.home() / "Library" / "MobileDevice" / "Provisioning Profiles"
    profiles_dir.mkdir(parents=True, exist_ok=True)
    installed_path = profiles_dir / f"{uuid}.mobileprovision"
    installed_path.write_bytes(profile_bytes)
    print(f"[ASC] Installed provisioning profile: {installed_path}")

    # Generate dynamic exportOptions.plist (method: app-store, signingStyle: manual)
    export_options = {
        "method": "app-store",
        "signingStyle": "manual",
        "teamID": team_id,
        "signingCertificate": "Apple Distribution",
        "stripSwiftSymbols": True,
        "uploadSymbols": True,
        "compileBitcode": False,
        "provisioningProfiles": {
            bundle_id: name,
        },
    }
    export_plist_path.parent.mkdir(parents=True, exist_ok=True)
    with export_plist_path.open("wb") as f:
        plistlib.dump(export_options, f)
    print(f"[ASC] Generated {export_plist_path} (teamID={team_id}, profile={name})")

    # Export variables to GitHub Actions environment
    gh_env: Optional[str] = os.environ.get("GITHUB_ENV")
    if gh_env:
        with open(gh_env, "a", encoding="utf-8") as env_file:
            env_file.write(f"PROFILE_UUID={uuid}\n")
            env_file.write(f"PROFILE_NAME={name}\n")
            env_file.write(f"TEAM_ID={team_id}\n")
            env_file.write(f"BUNDLE_ID={bundle_id}\n")

    # Patch ONLY the App target Release XCBuildConfiguration in project.pbxproj so SPM
    # package targets are never poisoned by global PROVISIONING_PROFILE_SPECIFIER CLI overrides.
    pbxproj_env = os.environ.get("PATCH_PBXPROJ", "").strip()
    if pbxproj_env:
        pbx_path = Path(pbxproj_env)
        pbx_text = pbx_path.read_text(encoding="utf-8")
        marker = "504EC3181FED79650016851F /* Release */ = {"
        idx = pbx_text.find(marker)
        if idx == -1:
            raise RuntimeError(f"Could not find App target Release config in {pbx_path}")
        block_end = pbx_text.find("\n\t\t};", idx)
        block = pbx_text[idx:block_end]
        block = block.replace("CODE_SIGN_STYLE = Automatic;", "CODE_SIGN_STYLE = Manual;")
        injection = (
            f'\n\t\t\t\tCODE_SIGN_IDENTITY = "Apple Distribution";'
            f'\n\t\t\t\tDEVELOPMENT_TEAM = {team_id};'
            f'\n\t\t\t\tPROVISIONING_PROFILE_SPECIFIER = "{name}";'
        )
        block = block.replace("CODE_SIGN_STYLE = Manual;", "CODE_SIGN_STYLE = Manual;" + injection, 1)
        pbx_path.write_text(pbx_text[:idx] + block + pbx_text[block_end:], encoding="utf-8")
        print(f"[ASC] Patched App target Release signing in {pbx_path} (SPM-safe manual signing)")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"[ASC ERROR] {exc}", file=sys.stderr)
        sys.exit(1)
