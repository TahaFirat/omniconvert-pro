#!/usr/bin/env python3
"""
App Store Connect API Automatic Version Management & Review Submission.
Implements Section 4 end-to-end:
  1. Checks GET /v1/apps/<APP_ID>/appStoreVersions state:
     - If READY_FOR_SALE -> ensures MARKETING_VERSION bumped & creates new appStoreVersion
     - If WAITING_FOR_REVIEW -> cancels active reviewSubmission & waits ~10s until CANCELING clears
  2. Polls GET /v1/builds?filter[app]=<APP_ID>&filter[version]=<BUILD_NO> until processingState == VALID
  3. Attaches build via PATCH /v1/appStoreVersions/<VERSION_ID>/relationships/build
  4. Updates release notes (whatsNew) via PATCH /v1/appStoreVersionLocalizations/<LOC_ID>
  5. Submits for App Review via POST /v1/reviewSubmissions -> POST /v1/reviewSubmissionItems -> PATCH submitted=true
"""

import argparse
import os
import re
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import jwt
import requests

ASC_API = "https://api.appstoreconnect.apple.com/v1"
PBXPROJ_PATH = Path(__file__).resolve().parent.parent / "ios" / "App" / "App.xcodeproj" / "project.pbxproj"


def read_marketing_version() -> str:
    text = PBXPROJ_PATH.read_text(encoding="utf-8")
    matches = re.findall(r"MARKETING_VERSION\s*=\s*([0-9]+\.[0-9]+(?:\.[0-9]+)?)\s*;", text)
    if not matches:
        raise RuntimeError(f"MARKETING_VERSION not found in {PBXPROJ_PATH}")
    return matches[0]


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


def asc_req(method: str, path: str, token: str, **kwargs: Any) -> Dict[str, Any]:
    headers = kwargs.pop("headers", {})
    headers.update(
        {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
    )
    resp = requests.request(method, f"{ASC_API}{path}", headers=headers, timeout=30, **kwargs)
    if resp.status_code >= 400:
        raise RuntimeError(f"ASC {method} {path} -> HTTP {resp.status_code}: {resp.text}")
    return resp.json() if resp.content else {}


def resolve_app_id(token: str, bundle_id: str) -> str:
    data = asc_req("GET", f"/apps?filter[bundleId]={bundle_id}", token)
    apps = data.get("data", [])
    if not apps:
        raise RuntimeError(
            f"App with bundleId '{bundle_id}' was not found in App Store Connect. "
            "Apple API does not allow POST /v1/apps — create the app record once in App Store Connect web UI first."
        )
    return apps[0]["id"]


def cancel_active_review_if_needed(token: str, app_id: str) -> None:
    subs = asc_req(
        "GET",
        f"/reviewSubmissions?filter[app]={app_id}&filter[state]=WAITING_FOR_REVIEW",
        token,
    ).get("data", [])

    for sub in subs:
        sub_id = sub["id"]
        print(f"[ASC] Canceling active WAITING_FOR_REVIEW submission {sub_id}...")
        asc_req(
            "PATCH",
            f"/reviewSubmissions/{sub_id}",
            token,
            json={
                "data": {
                    "type": "reviewSubmissions",
                    "id": sub_id,
                    "attributes": {"canceled": True},
                }
            },
        )
        # Wait ~10s and poll until CANCELING transitions out
        time.sleep(10)
        for _ in range(12):
            state = (
                asc_req("GET", f"/reviewSubmissions/{sub_id}", token)
                .get("data", {})
                .get("attributes", {})
                .get("state")
            )
            print(f"[ASC] Submission {sub_id} state: {state}")
            if state != "CANCELING":
                break
            time.sleep(5)


def ensure_editable_version(token: str, app_id: str, marketing_version: str) -> str:
    versions: List[Dict[str, Any]] = asc_req(
        "GET", f"/apps/{app_id}/appStoreVersions?filter[platform]=IOS&limit=10", token
    ).get("data", [])

    editable_states = {"PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED", "WAITING_FOR_REVIEW"}

    for ver in versions:
        attrs = ver.get("attributes", {})
        v_str = attrs.get("versionString")
        state = attrs.get("appStoreState")
        print(f"[ASC] Found App Store version {v_str} (id={ver['id']}, state={state})")

        if v_str == marketing_version and state == "READY_FOR_SALE":
            raise RuntimeError(
                f"Version {marketing_version} is already READY_FOR_SALE! "
                "Bump MARKETING_VERSION in ios/App/App.xcodeproj/project.pbxproj "
                "before uploading a new build (prevents Apple 90062 / 90186 errors)."
            )

        if v_str == marketing_version and state == "WAITING_FOR_REVIEW":
            cancel_active_review_if_needed(token, app_id)
            return ver["id"]

        if v_str == marketing_version and state in editable_states:
            return ver["id"]

    # Create new App Store version for bumped MARKETING_VERSION
    print(f"[ASC] Creating new iOS App Store version {marketing_version} (AFTER_APPROVAL)...")
    created = asc_req(
        "POST",
        "/appStoreVersions",
        token,
        json={
            "data": {
                "type": "appStoreVersions",
                "attributes": {
                    "platform": "IOS",
                    "versionString": marketing_version,
                    "releaseType": "AFTER_APPROVAL",
                },
                "relationships": {
                    "app": {"data": {"type": "apps", "id": app_id}}
                },
            }
        },
    )
    return created["data"]["id"]


def wait_for_valid_build(token: str, app_id: str, build_number: str, timeout_sec: int = 600) -> str:
    deadline = time.time() + timeout_sec
    while time.time() < deadline:
        builds = asc_req(
            "GET",
            f"/builds?filter[app]={app_id}&filter[version]={build_number}&limit=5",
            token,
        ).get("data", [])

        for b in builds:
            state = b.get("attributes", {}).get("processingState")
            print(f"[ASC] Build {build_number} (id={b['id']}): processingState={state}")
            if state == "VALID":
                return b["id"]
            if state in ("FAILED", "INVALID"):
                raise RuntimeError(f"Build {build_number} rejected by Apple processing ({state}).")

        time.sleep(15)

    raise TimeoutError(f"Timed out waiting for build {build_number} to become VALID.")


def attach_build_to_version(token: str, version_id: str, build_id: str) -> None:
    asc_req(
        "PATCH",
        f"/appStoreVersions/{version_id}/relationships/build",
        token,
        json={"data": {"type": "builds", "id": build_id}},
    )
    print(f"[ASC] Attached build {build_id} to version {version_id} (204 OK)")


def update_whats_new(
    token: str,
    version_id: str,
    whats_new_tr: str,
    whats_new_en: str,
) -> None:
    locs = asc_req(
        "GET", f"/appStoreVersions/{version_id}/appStoreVersionLocalizations", token
    ).get("data", [])

    for loc in locs:
        loc_id = loc["id"]
        locale = loc.get("attributes", {}).get("locale", "en-US")
        note = whats_new_tr if locale.lower().startswith("tr") else whats_new_en
        try:
            asc_req(
                "PATCH",
                f"/appStoreVersionLocalizations/{loc_id}",
                token,
                json={
                    "data": {
                        "type": "appStoreVersionLocalizations",
                        "id": loc_id,
                        "attributes": {"whatsNew": note},
                    }
                },
            )
            print(f"[ASC] Updated whatsNew for locale {locale} (200 OK)")
        except RuntimeError as exc:
            if "whatsNew" in str(exc):
                print(f"[ASC] Skipping whatsNew for initial release ({locale})")
            else:
                raise


def submit_for_review(token: str, app_id: str, version_id: str) -> str:
    # Reuse an existing READY_FOR_REVIEW draft submission if present
    existing = asc_req(
        "GET",
        f"/reviewSubmissions?filter[app]={app_id}&filter[state]=READY_FOR_REVIEW",
        token,
    ).get("data", [])
    if existing:
        sub_id = existing[0]["id"]
        print(f"[ASC] Reusing existing READY_FOR_REVIEW reviewSubmission {sub_id}")
    else:
        sub = asc_req(
            "POST",
            "/reviewSubmissions",
            token,
            json={
                "data": {
                    "type": "reviewSubmissions",
                    "attributes": {"platform": "IOS"},
                    "relationships": {
                        "app": {"data": {"type": "apps", "id": app_id}}
                    },
                }
            },
        )
        sub_id = sub["data"]["id"]
        print(f"[ASC] Created reviewSubmission {sub_id} (201)")

    items = asc_req("GET", f"/reviewSubmissions/{sub_id}/items", token).get("data", [])
    if not items:
        asc_req(
            "POST",
            "/reviewSubmissionItems",
            token,
            json={
                "data": {
                    "type": "reviewSubmissionItems",
                    "relationships": {
                        "reviewSubmission": {
                            "data": {"type": "reviewSubmissions", "id": sub_id}
                        },
                        "appStoreVersion": {
                            "data": {"type": "appStoreVersions", "id": version_id}
                        },
                    },
                }
            },
        )
        print(f"[ASC] Linked version {version_id} to reviewSubmission {sub_id} (201)")

    final = asc_req(
        "PATCH",
        f"/reviewSubmissions/{sub_id}",
        token,
        json={
            "data": {
                "type": "reviewSubmissions",
                "id": sub_id,
                "attributes": {"submitted": True},
            }
        },
    )
    state = final.get("data", {}).get("attributes", {}).get("state", "UNKNOWN")
    print(f"[ASC] Review submission finalized -> state={state}")
    return state


def main() -> None:
    parser = argparse.ArgumentParser(description="Automate App Store Connect version & review submission.")
    parser.add_argument("--bundle-id", default=os.environ.get("APP_BUNDLE_ID", "com.omniconvert.app"))
    parser.add_argument("--app-id", default=os.environ.get("APP_STORE_APP_ID", ""))
    parser.add_argument("--build-number", required=True, help="CFBundleVersion uploaded to App Store Connect")
    parser.add_argument("--marketing-version", default="", help="Defaults to MARKETING_VERSION in project.pbxproj")
    parser.add_argument(
        "--whats-new-tr",
        default="Performans iyileştirmeleri, cihaz içi çevrimdışı dönüştürme motoru güncellemeleri ve kararlılık düzeltmeleri.",
    )
    parser.add_argument(
        "--whats-new-en",
        default="Performance improvements, on-device offline conversion engine upgrades, and stability fixes.",
    )
    parser.add_argument("--skip-submit", action="store_true", help="Attach build & update notes without submitting")
    args = parser.parse_args()

    key_id = os.environ["APP_STORE_CONNECT_KEY_ID"].strip()
    issuer_id = os.environ["APP_STORE_CONNECT_ISSUER_ID"].strip()
    private_key = os.environ["APP_STORE_CONNECT_API_KEY"].strip()

    token = make_jwt(key_id, issuer_id, private_key)
    app_id = args.app_id.strip() or resolve_app_id(token, args.bundle_id)
    marketing_version = args.marketing_version.strip() or read_marketing_version()

    version_id = ensure_editable_version(token, app_id, marketing_version)
    build_id = wait_for_valid_build(token, app_id, str(args.build_number))
    attach_build_to_version(token, version_id, build_id)
    update_whats_new(token, version_id, args.whats_new_tr, args.whats_new_en)

    if not args.skip_submit:
        state = submit_for_review(token, app_id, version_id)
        if state != "WAITING_FOR_REVIEW":
            print(f"[ASC WARN] Expected WAITING_FOR_REVIEW, got {state}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"[ASC RELEASE ERROR] {exc}", file=sys.stderr)
        sys.exit(1)
