---
name: store-preflight-audit
description: Audits the Flutter iOS & Android project before App Store and Google Play Store submission to catch 2026 policy rejections, SDK mismatches, privacy manifest gaps, forbidden permissions, and GPL license violations.
---
# Store Pre-Flight Audit Skill (iOS 26 & Android 16)

## When to Use
- At the end of Phase 5 (`/phase-5-monetization-qa`)
- Whenever preparing a release build for TestFlight, App Store Connect, or Google Play Console
- Whenever modifying `Info.plist`, `PrivacyInfo.xcprivacy`, `AndroidManifest.xml`, `build.gradle.kts`, IAP/Paywall screens, or native libraries

## Audit Checklist & Commands

1. **iOS SDK & Privacy Manifest Check:**
   - Verify `ios/Runner/PrivacyInfo.xcprivacy` exists and declares `NSPrivacyAccessedAPICategoryFileTimestamp`, `NSPrivacyAccessedAPICategoryDiskSpace`, `NSPrivacyAccessedAPICategoryUserDefaults`, and `NSPrivacyTracking = false`.
   - Verify `ios/Runner/Info.plist` has clear localized usage descriptions (`NSPhotoLibraryUsageDescription`, `NSPhotoLibraryAddUsageDescription`, `NSCameraUsageDescription`) and NO unused permission keys (no location, microphone, contacts, or ATT tracking keys).
   - Verify Share Extension (`ios/ShareExtension/Info.plist`) and Runner share the exact same App Group ID.

2. **Android 16 (API 36) & Play Store Policy Check:**
   - Inspect `apps/mobile/android/app/build.gradle.kts`: confirm `compileSdk >= 36`, `targetSdk >= 36`, `minSdk >= 26`.
   - Inspect `apps/mobile/android/app/src/main/AndroidManifest.xml`:
     - FAIL if `MANAGE_EXTERNAL_STORAGE` or broad `READ_MEDIA_IMAGES`/`READ_MEDIA_VIDEO` is present without justification (must use Photo Picker / SAF).
     - PASS if `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_DATA_SYNC` are properly declared with `android:foregroundServiceType="dataSync"`.
   - Verify 16 KB ELF page alignment flags are configured for Rust/NDK `.so` builds.

3. **Monetization & Apple Guideline Compliance Check:**
   - Verify NO external web checkout links inside iOS paywall (Guideline 3.1.1).
   - Verify **"Restore Purchases"** button is present and wired to `Purchases.restorePurchases()`.
   - Verify NO third-party login without equal-prominence **Sign in with Apple** (Guideline 4.8).
   - Verify offline local conversion works 100% with Airplane Mode enabled (Guideline 4.2 Minimum Functionality).

4. **License & Security Check:**
   - Scan `Cargo.toml`, `pubspec.yaml`, and Podfile/Gradle for GPL-only static dependencies (`libx264`, `libx265`, `gpl` FFmpeg variants). FAIL if found in mobile target.
   - Verify Open Source Licenses screen exists in Settings.
   - Verify zero hardcoded API keys, secrets, or placeholder `Lorem ipsum` strings in `lib/`.

5. **Output Report:**
   - Produce a concise Markdown pass/fail table listing every check, file inspected, and any concrete remediation patch required before submission.
