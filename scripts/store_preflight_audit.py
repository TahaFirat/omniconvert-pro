#!/usr/bin/env python3
"""
OmniConvert Pro — Store Pre-Flight Audit (App Store 2026 + Capacitor iOS + License & Security Guard).
Exits non-zero if any mandatory check fails.
"""

import json
import plistlib
import re
import sys
from pathlib import Path
from typing import List, Tuple
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent


def run_audit() -> List[Tuple[str, bool, str]]:
    results: List[Tuple[str, bool, str]] = []

    def check(name: str, ok: bool, detail: str) -> None:
        results.append((name, ok, detail))

    # 1. capacitor.config.ts
    cap_cfg = ROOT / "capacitor.config.ts"
    cap_text = cap_cfg.read_text(encoding="utf-8") if cap_cfg.exists() else ""
    check(
        "Capacitor Config (appId, appName, webDir: dist)",
        all(k in cap_text for k in ("appId:", "appName:", "webDir: 'dist'")),
        "capacitor.config.ts",
    )

    # 2. Info.plist mandatory Apple fields & zero unused permissions
    info_path = ROOT / "ios" / "App" / "App" / "Info.plist"
    try:
        info = plistlib.loads(info_path.read_bytes())
        has_versions = (
            info.get("CFBundleShortVersionString") == "$(MARKETING_VERSION)"
            and info.get("CFBundleVersion") == "$(CURRENT_PROJECT_VERSION)"
        )
        check("Info.plist version placeholders", has_versions, "ios/App/App/Info.plist")
        check(
            "Info.plist ITSAppUsesNonExemptEncryption = false",
            info.get("ITSAppUsesNonExemptEncryption") is False,
            "ios/App/App/Info.plist",
        )
        locs = info.get("CFBundleLocalizations", [])
        check(
            "Info.plist localization (tr + en)",
            info.get("CFBundleDevelopmentRegion") == "tr" and "tr" in locs and "en" in locs,
            f"region={info.get('CFBundleDevelopmentRegion')}, locs={locs}",
        )
        check(
            "Info.plist UIApplicationSceneManifest (SceneDelegate)",
            "UIApplicationSceneManifest" in info
            and "SceneDelegate" in json.dumps(info["UIApplicationSceneManifest"]),
            "ios/App/App/Info.plist",
        )
        req_perms = (
            "NSCameraUsageDescription",
            "NSPhotoLibraryUsageDescription",
            "NSPhotoLibraryAddUsageDescription",
        )
        check(
            "Info.plist Turkish usage descriptions",
            all(isinstance(info.get(k), str) and len(info[k]) > 15 for k in req_perms),
            "Camera + PhotoLibrary descriptions verified",
        )
        forbidden_perms = (
            "NSUserTrackingUsageDescription",
            "NSLocationWhenInUseUsageDescription",
            "NSLocationAlwaysUsageDescription",
            "NSContactsUsageDescription",
            "NSMicrophoneUsageDescription",
        )
        leaked = [k for k in forbidden_perms if k in info]
        check(
            "Info.plist Zero unused/tracking permissions (No IDFA/ATT/Location)",
            len(leaked) == 0,
            "Clean" if not leaked else f"Forbidden keys: {leaked}",
        )
    except Exception as exc:
        check("Info.plist valid XML plist", False, str(exc))

    # 3. PrivacyInfo.xcprivacy
    priv_path = ROOT / "ios" / "App" / "App" / "PrivacyInfo.xcprivacy"
    try:
        priv = plistlib.loads(priv_path.read_bytes())
        api_types = {
            item["NSPrivacyAccessedAPIType"]: item.get("NSPrivacyAccessedAPITypeReasons", [])
            for item in priv.get("NSPrivacyAccessedAPITypes", [])
        }
        has_reasons = (
            "CA92.1" in api_types.get("NSPrivacyAccessedAPICategoryUserDefaults", [])
            and "C617.1" in api_types.get("NSPrivacyAccessedAPICategoryFileTimestamp", [])
            and "E174.1" in api_types.get("NSPrivacyAccessedAPICategoryDiskSpace", [])
        )
        check(
            "PrivacyInfo.xcprivacy (NSPrivacyTracking=false + CA92.1/C617.1/E174.1)",
            priv.get("NSPrivacyTracking") is False and has_reasons,
            "ios/App/App/PrivacyInfo.xcprivacy",
        )
    except Exception as exc:
        check("PrivacyInfo.xcprivacy valid XML plist", False, str(exc))

    # 4. project.pbxproj linkage & iOS 16+ target
    pbx_path = ROOT / "ios" / "App" / "App.xcodeproj" / "project.pbxproj"
    pbx_text = pbx_path.read_text(encoding="utf-8") if pbx_path.exists() else ""
    check(
        "project.pbxproj links PrivacyInfo.xcprivacy in Resources",
        "PrivacyInfo.xcprivacy in Resources" in pbx_text,
        "ios/App/App.xcodeproj/project.pbxproj",
    )
    check(
        "project.pbxproj links native Swift plugins & MainViewController",
        all(
            s in pbx_text
            for s in (
                "MainViewController.swift in Sources",
                "OmniNativeEnginePlugin.swift in Sources",
                "OmniBillingPlugin.swift in Sources",
                "SceneDelegate.swift in Sources",
            )
        ),
        "ios/App/App.xcodeproj/project.pbxproj",
    )
    targets = re.findall(r"IPHONEOS_DEPLOYMENT_TARGET\s*=\s*([0-9.]+)\s*;", pbx_text)
    check(
        "project.pbxproj IPHONEOS_DEPLOYMENT_TARGET >= 16.0",
        bool(targets) and all(float(t) >= 16.0 for t in targets),
        f"targets={targets}",
    )

    # 5. AppIcon 1024x1024 RGB NO ALPHA
    icon_path = (
        ROOT
        / "ios"
        / "App"
        / "App"
        / "Assets.xcassets"
        / "AppIcon.appiconset"
        / "AppIcon-512@2x.png"
    )
    try:
        with Image.open(icon_path) as img:
            ok_icon = img.size == (1024, 1024) and img.mode == "RGB"
            check(
                "AppIcon-512@2x.png is 1024x1024 RGB without alpha channel",
                ok_icon,
                f"size={img.size}, mode={img.mode}",
            )
    except Exception as exc:
        check("AppIcon-512@2x.png check", False, str(exc))

    # 6. Safe-Area / Dynamic Island configuration
    main_vc = (ROOT / "ios" / "App" / "App" / "MainViewController.swift").read_text(encoding="utf-8")
    css_tokens = (ROOT / "src" / "core" / "theme" / "tokens.css").read_text(encoding="utf-8")
    check(
        "Safe-Area: contentInsetAdjustmentBehavior = .never + CSS env(safe-area-inset-*)",
        "contentInsetAdjustmentBehavior = .never" in main_vc
        and "env(safe-area-inset-top" in css_tokens
        and "env(safe-area-inset-bottom" in css_tokens,
        "MainViewController.swift + tokens.css",
    )

    # 7. Zero secrets committed in repo
    secret_globs = ("*.p8", "*.p12", "*.mobileprovision")
    found_secrets = [
        str(p.relative_to(ROOT))
        for g in secret_globs
        for p in ROOT.rglob(g)
        if "node_modules" not in p.parts
    ]
    check(
        "Zero committed signing secrets (.p8 / .p12 / .mobileprovision)",
        len(found_secrets) == 0,
        "Clean" if not found_secrets else f"Found: {found_secrets}",
    )

    # 8. License compliance (Zero GPL codecs in mobile package.json & Cargo.toml)
    pkg_text = (ROOT / "package.json").read_text(encoding="utf-8").lower()
    cargo_text = (ROOT / "packages" / "rust_core" / "Cargo.toml").read_text(encoding="utf-8").lower()
    gpl_terms = ("libx264", "libx265", "libfdk_aac", "ffmpeg-kit-full-gpl")
    gpl_found = [t for t in gpl_terms if t in pkg_text or t in cargo_text]
    check(
        "License compliance: Zero GPL static codecs in mobile dependencies",
        len(gpl_found) == 0,
        "Zero GPL dependencies",
    )

    # 9. Apple Guideline 3.1.1 (Restore Purchases, StoreKit 2, No external checkout, No Lorem ipsum)
    src_files = list((ROOT / "src").rglob("*.ts")) + list((ROOT / "src").rglob("*.tsx"))
    all_src = "\n".join(p.read_text(encoding="utf-8") for p in src_files)
    check(
        "Guideline 3.1.1: Restore Purchases & Open Source Licenses present, zero Lorem ipsum",
        "restorePurchases" in all_src
        and "OPEN_SOURCE_NOTICES" in all_src
        and "lorem ipsum" not in all_src.lower()
        and "stripe.com/pay" not in all_src.lower(),
        "Verified across src/",
    )

    # 10. Cloud Worker hardened ImageMagick policy.xml
    policy = (ROOT / "services" / "cloud_worker" / "policy.xml").read_text(encoding="utf-8")
    check(
        "Cloud Worker hardened policy.xml (blocks PDF/PS/EPS/MVG/HTTPS/URL)",
        all(f'rights="none" pattern="{p}"' in policy for p in ("PDF", "PS", "EPS", "MVG", "HTTPS", "URL")),
        "services/cloud_worker/policy.xml",
    )

    # 11. GitHub Actions workflow & 5 required Secrets
    wf = (ROOT / ".github" / "workflows" / "ios-build.yml").read_text(encoding="utf-8")
    req_secrets = (
        "APP_STORE_CONNECT_API_KEY",
        "APP_STORE_CONNECT_KEY_ID",
        "APP_STORE_CONNECT_ISSUER_ID",
        "BUILD_CERTIFICATE_BASE64",
        "P12_PASSWORD",
    )
    check(
        "GitHub Actions ios-build.yml uses all 5 required Secrets + xcrun altool",
        all(s in wf for s in req_secrets) and "xcrun altool" in wf and "--upload-app" in wf,
        ".github/workflows/ios-build.yml",
    )

    return results


def main() -> None:
    results = run_audit()
    failed = 0
    print("\n=== OmniConvert Pro — Store Pre-Flight Audit ===")
    for name, ok, detail in results:
        tag = "PASS" if ok else "FAIL"
        if not ok:
            failed += 1
        print(f"[{tag}] {name} — {detail}")
    print(f"\nSummary: {len(results) - failed}/{len(results)} checks passed.\n")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
