#!/usr/bin/env python3
"""
Pre-Push App Store Connect Status Checker (Section 5).
Run before `git push` to verify whether the current MARKETING_VERSION is already
READY_FOR_SALE (preventing Apple 90062 / 90186 errors and wasted macOS runner minutes).
"""

import os
import sys
from asc_release import asc_req, make_jwt, read_marketing_version, resolve_app_id


def main() -> None:
    bundle_id = os.environ.get("APP_BUNDLE_ID", "com.omniconvert.app")
    key_id = os.environ.get("APP_STORE_CONNECT_KEY_ID", "").strip()
    issuer_id = os.environ.get("APP_STORE_CONNECT_ISSUER_ID", "").strip()
    private_key = os.environ.get("APP_STORE_CONNECT_API_KEY", "").strip()

    local_version = read_marketing_version()
    print(f"[LOCAL] project.pbxproj MARKETING_VERSION = {local_version}")

    if not (key_id and issuer_id and private_key):
        print(
            "[INFO] Set APP_STORE_CONNECT_KEY_ID, APP_STORE_CONNECT_ISSUER_ID, and "
            "APP_STORE_CONNECT_API_KEY in your shell environment to query App Store Connect."
        )
        return

    token = make_jwt(key_id, issuer_id, private_key)
    app_id = os.environ.get("APP_STORE_APP_ID", "").strip() or resolve_app_id(token, bundle_id)
    versions = asc_req(
        "GET", f"/apps/{app_id}/appStoreVersions?filter[platform]=IOS&limit=5", token
    ).get("data", [])

    for v in versions:
        attrs = v.get("attributes", {})
        v_str = attrs.get("versionString")
        state = attrs.get("appStoreState")
        print(f"[ASC] Version {v_str} -> {state}")
        if v_str == local_version and state == "READY_FOR_SALE":
            print(
                f"[BLOCKED] Version {local_version} is already READY_FOR_SALE! "
                "Bump MARKETING_VERSION in ios/App/App.xcodeproj/project.pbxproj before pushing.",
                file=sys.stderr,
            )
            sys.exit(2)

    print("[OK] Safe to push — MARKETING_VERSION is not closed as READY_FOR_SALE.")


if __name__ == "__main__":
    main()
