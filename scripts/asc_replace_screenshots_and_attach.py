#!/usr/bin/env python3
"""
Cancels active WAITING_FOR_REVIEW submission, replaces App Store screenshots (iPhone 6.7"/6.9" + iPad 13"
for tr & en-US), waits for target Build N to become VALID, and attaches Build N to v1.0.0.
"""

import argparse
import hashlib
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, List

import jwt
import requests

ASC_V1 = "https://api.appstoreconnect.apple.com/v1"
ROOT = Path(__file__).resolve().parent.parent
SHOTS_DIR = ROOT / "store_assets" / "screenshots"
APP_ID = "6838002449"
VERSION_ID = "04495455-fa1c-43a7-b20c-d3ec7f04f9b5"


def make_jwt() -> str:
    now = int(time.time())
    tok = jwt.encode(
        {
            "iss": os.environ["APP_STORE_CONNECT_ISSUER_ID"].strip(),
            "iat": now - 10,
            "exp": now + 18 * 60,
            "aud": "appstoreconnect-v1",
        },
        os.environ["APP_STORE_CONNECT_API_KEY"].strip(),
        algorithm="ES256",
        headers={"kid": os.environ["APP_STORE_CONNECT_KEY_ID"].strip(), "typ": "JWT"},
    )
    return tok if isinstance(tok, str) else tok.decode("utf-8")


def asc_req(method: str, path: str, token: str, **kwargs: Any) -> Dict[str, Any]:
    headers = kwargs.pop("headers", {})
    headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    url = path if path.startswith("http") else f"{ASC_V1}{path}"
    resp = requests.request(method, url, headers=headers, timeout=60, **kwargs)
    if resp.status_code >= 400:
        raise RuntimeError(f"ASC {method} {path} -> HTTP {resp.status_code}: {resp.text}")
    return resp.json() if resp.content else {}


def cancel_active_review(token: str) -> None:
    subs = asc_req(
        "GET",
        f"/reviewSubmissions?filter[app]={APP_ID}&filter[state]=WAITING_FOR_REVIEW",
        token,
    ).get("data", [])
    for sub in subs:
        sid = sub["id"]
        print(f"[ASC] Canceling active WAITING_FOR_REVIEW submission {sid}...")
        asc_req(
            "PATCH",
            f"/reviewSubmissions/{sid}",
            token,
            json={
                "data": {
                    "type": "reviewSubmissions",
                    "id": sid,
                    "attributes": {"canceled": True},
                }
            },
        )
        time.sleep(10)
        for _ in range(15):
            st = asc_req("GET", f"/reviewSubmissions/{sid}", token)["data"]["attributes"]["state"]
            print(f"[ASC] Submission {sid} state -> {st}")
            if st != "CANCELING":
                break
            time.sleep(4)


def replace_screenshot_set(token: str, loc_id: str, folder: Path, display_type: str) -> None:
    pngs = sorted(folder.glob("*.png"))
    if not pngs:
        return
    sets = asc_req("GET", f"/appStoreVersionLocalizations/{loc_id}/appScreenshotSets?limit=20", token).get("data", [])
    set_id = next((s["id"] for s in sets if s["attributes"]["screenshotDisplayType"] == display_type), None)
    if not set_id:
        set_id = asc_req(
            "POST",
            "/appScreenshotSets",
            token,
            json={
                "data": {
                    "type": "appScreenshotSets",
                    "attributes": {"screenshotDisplayType": display_type},
                    "relationships": {
                        "appStoreVersionLocalization": {
                            "data": {"type": "appStoreVersionLocalizations", "id": loc_id}
                        }
                    },
                }
            },
        )["data"]["id"]

    existing = asc_req("GET", f"/appScreenshotSets/{set_id}/appScreenshots?limit=20", token).get("data", [])
    for old in existing:
        asc_req("DELETE", f"/appScreenshots/{old['id']}", token)
    print(f"[ASC] Cleared {len(existing)} old screenshots in {display_type}")

    for png in pngs:
        raw = png.read_bytes()
        md5_hex = hashlib.md5(raw).hexdigest()
        reserve = asc_req(
            "POST",
            "/appScreenshots",
            token,
            json={
                "data": {
                    "type": "appScreenshots",
                    "attributes": {"fileSize": len(raw), "fileName": png.name},
                    "relationships": {
                        "appScreenshotSet": {"data": {"type": "appScreenshotSets", "id": set_id}}
                    },
                }
            },
        )
        shot_id = reserve["data"]["id"]
        for op in reserve["data"]["attributes"].get("uploadOperations", []):
            chunk = raw[op["offset"] : op["offset"] + op["length"]]
            op_headers = {h["name"]: h["value"] for h in op.get("requestHeaders", [])}
            r = requests.request(op["method"], op["url"], headers=op_headers, data=chunk, timeout=60)
            if r.status_code >= 400:
                raise RuntimeError(f"Chunk upload failed ({r.status_code})")
        asc_req(
            "PATCH",
            f"/appScreenshots/{shot_id}",
            token,
            json={
                "data": {
                    "type": "appScreenshots",
                    "id": shot_id,
                    "attributes": {"uploaded": True, "sourceFileChecksum": md5_hex},
                }
            },
        )
        print(f"[ASC] Uploaded {display_type}: {png.name}")


def wait_and_attach_build(token: str, build_number: str) -> str:
    deadline = time.time() + 480
    while time.time() < deadline:
        builds: List[Dict[str, Any]] = asc_req(
            "GET",
            f"/builds?filter[app]={APP_ID}&filter[version]={build_number}&limit=5",
            token,
        ).get("data", [])
        for b in builds:
            st = b["attributes"].get("processingState")
            print(f"[ASC] Build #{build_number} ({b['id']}): processingState={st}")
            if st == "VALID":
                asc_req(
                    "PATCH",
                    f"/appStoreVersions/{VERSION_ID}/relationships/build",
                    token,
                    json={"data": {"type": "builds", "id": b["id"]}},
                )
                print(f"[ASC] Attached VALID Build #{build_number} to v1.0.0!")
                return b["id"]
            if st in ("FAILED", "INVALID"):
                raise RuntimeError(f"Build #{build_number} failed processing ({st})")
        time.sleep(15)
    raise TimeoutError(f"Timed out waiting for Build #{build_number} to become VALID")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--build-number", required=True)
    args = parser.parse_args()

    token = make_jwt()
    cancel_active_review(token)

    locs = asc_req("GET", f"/appStoreVersions/{VERSION_ID}/appStoreVersionLocalizations?limit=10", token).get("data", [])
    for loc in locs:
        locale = loc["attributes"]["locale"]
        lang = "tr" if locale.lower().startswith("tr") else "en"
        replace_screenshot_set(token, loc["id"], SHOTS_DIR / lang, "APP_IPHONE_67")
        replace_screenshot_set(token, loc["id"], SHOTS_DIR / f"ipad_{lang}", "APP_IPAD_PRO_3GEN_129")

    wait_and_attach_build(token, str(args.build_number))
    print("[ASC] Ready for final submission with Build #" + str(args.build_number))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"[ASC ERROR] {exc}", file=sys.stderr)
        sys.exit(1)
