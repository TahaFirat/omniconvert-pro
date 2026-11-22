---
trigger: model_decision
description: Apply when configuring iOS Info.plist, PrivacyInfo.xcprivacy, Entitlements, AndroidManifest.xml, Gradle SDK targets, StoreKit 2, Google Play Billing, RevenueCat, or store submission assets.
---
# App Store & Google Play Store 2026 Compliance Rules

1. **SDK & Build Targets (2026 Mandatory):**
   - **iOS:** Build with Xcode 26 / iOS 26 SDK (`IPHONEOS_DEPLOYMENT_TARGET >= 16.0`). Include `PrivacyInfo.xcprivacy` declaring Required Reason APIs (`NSPrivacyAccessedAPICategoryFileTimestamp`, `NSPrivacyAccessedAPICategoryDiskSpace`, `NSPrivacyAccessedAPICategoryUserDefaults`).
   - **Android:** Set `compileSdk = 36` and `targetSdk = 36` (Android 16), `minSdk = 26`, 16 KB memory page size alignment for all native `.so` libraries (Rust + LGPL libs).
2. **Apple App Review Guidelines Guardrails:**
   - **Guideline 4.2 (Minimum Functionality):** App must work fully offline out-of-the-box with rich native features (Share Extension, Files integration, local hardware engine). Never render a WebView converter wrapper.
   - **Guideline 3.1.1 (IAP):** All Pro subscriptions and Cloud Credit packs MUST use StoreKit 2 (iOS) / Google Play Billing (Android) via RevenueCat. Include a clearly visible **"Restore Purchases"** button and clear auto-renewal disclosure text.
   - **Guideline 4.8 (Sign in with Apple):** Default to **No Account Required** (anonymous local & device-attested cloud credits). If optional sync login is added later, Sign in with Apple MUST be offered with equal prominence.
   - **Guideline 5.1.1 (Privacy & Deletion):** Provide working Privacy Policy and Terms URLs inside Settings and store listings, plus in-app data/account reset.
3. **Google Play Store Guardrails:**
   - NEVER request `MANAGE_EXTERNAL_STORAGE` or `READ_MEDIA_*` broadly; use Android Photo Picker and Storage Access Framework (SAF) (`ACTION_OPEN_DOCUMENT` / `ACTION_CREATE_DOCUMENT`).
   - Declare exact `FOREGROUND_SERVICE_DATA_SYNC` permission and notification channel for background batch conversions.
   - Ensure Play Console Data Safety form matches actual zero-tracking SDK behavior.
4. **Open-Source License Attribution:**
   - Ship an in-app **Open Source Licenses** screen listing Flutter, Rust crates, and LGPL/MIT/Apache notices with source/relinking compliance statement.
