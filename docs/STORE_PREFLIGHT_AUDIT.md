# OmniConvert Pro — Store Pre-Flight Audit Report (2026)

Generated and verified via `python scripts/store_preflight_audit.py`, `npm test`, `services/cloud_worker` tests, and live mobile E2E viewport testing (`360px`, `390px`, `768px`).

## 1. Automated Pre-Flight Compliance Checklist (18 / 18 PASS)

| # | Check | Status | Inspected Target |
| :- | :--- | :---: | :--- |
| 1 | Capacitor Config (`appId`, `appName`, `webDir: 'dist'`) | **PASS** | `capacitor.config.ts` |
| 2 | `Info.plist` version placeholders (`$(MARKETING_VERSION)`, `$(CURRENT_PROJECT_VERSION)`) | **PASS** | `ios/App/App/Info.plist` |
| 3 | `ITSAppUsesNonExemptEncryption = false` | **PASS** | `ios/App/App/Info.plist` |
| 4 | Localization (`CFBundleDevelopmentRegion = tr`, `CFBundleLocalizations = [tr, en, de, es]`) | **PASS** | `ios/App/App/Info.plist` |
| 5 | Modern `UIApplicationSceneManifest` (`SceneDelegate`) | **PASS** | `ios/App/App/Info.plist` |
| 6 | Clear Turkish usage descriptions (Camera, Photo Library Read/Add) | **PASS** | `ios/App/App/Info.plist` |
| 7 | Zero unused / tracking permissions (No ATT/IDFA, Location, Contacts, Mic) | **PASS** | `ios/App/App/Info.plist` |
| 8 | `PrivacyInfo.xcprivacy` (`NSPrivacyTracking = false`, `CA92.1`, `C617.1`, `E174.1`) | **PASS** | `ios/App/App/PrivacyInfo.xcprivacy` |
| 9 | `PrivacyInfo.xcprivacy` linked in Xcode `PBXResourcesBuildPhase` | **PASS** | `ios/App/App.xcodeproj/project.pbxproj` |
| 10 | Native Swift Tier 1 & StoreKit 2 plugins linked in `PBXSourcesBuildPhase` | **PASS** | `ios/App/App.xcodeproj/project.pbxproj` |
| 11 | `IPHONEOS_DEPLOYMENT_TARGET >= 16.0` (all Debug & Release configs) | **PASS** | `ios/App/App.xcodeproj/project.pbxproj` |
| 12 | `AppIcon-512@2x.png` strictly `1024x1024`, `RGB`, **alpha = False** | **PASS** | `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` |
| 13 | Safe-Area / Dynamic Island (`contentInsetAdjustmentBehavior = .never` + `env(safe-area-inset-*)`) | **PASS** | `MainViewController.swift`, `SceneDelegate.swift`, `src/core/theme/tokens.css` |
| 14 | Zero committed signing secrets (`.p8`, `.p12`, `.mobileprovision`) | **PASS** | Repository scan |
| 15 | Zero GPL static codecs (`libx264`/`libx265`/`libfdk_aac`) in mobile deps | **PASS** | `package.json`, `packages/rust_core/Cargo.toml` |
| 16 | Apple Guideline 3.1.1 (StoreKit 2, Restore Purchases, Open Source Licenses, zero Lorem ipsum) | **PASS** | `src/` |
| 17 | Tier 3 Cloud Worker hardened `policy.xml` (blocks `PDF`/`PS`/`EPS`/`MVG`/`HTTPS`/`URL`) | **PASS** | `services/cloud_worker/policy.xml` |
| 18 | GitHub Actions `ios-build.yml` uses all 5 required Secrets + `xcrun altool --upload-app` | **PASS** | `.github/workflows/ios-build.yml` |

## 2. Automated Test & Build Verification
- **TypeScript & Vite Production Build (`npm run build`):** PASS (`dist/` gzipped ~375 KB, 0 TypeScript errors)
- **Capacitor iOS Sync (`npx cap sync ios`):** PASS (6 official Capacitor 8 SPM plugins + custom native Swift plugins synced)
- **Mobile Unit, Security & UI Tests (`npm test`):** **21 / 21 PASS**
  - Magic-Byte Inspector (extension mismatch, PDF `/Encrypt`, ZIP encryption, DOCX/XLSX/EPUB container peek, Kindle KFX & ADEPT DRM blocking)
  - Dijkstra Multi-Hop Conversion Graph (`HEIC -> PNG -> PDF` locally, `SVG -> PNG -> PDF` with `WARN_RASTERIZE`, `offlineOnly` Tier 3 hard pruning, `1,000+` reachable pairs)
  - Physical `NetworkGuard` offline block, real Tier 2 local converters (`JSON`/`YAML`/`TOML`/`XML`/`CSV`/`TSV`, `MD`/`HTML`, `TXT -> PDF`, `ZIP`/`TAR`/`TGZ`, 100:1 zip-bomb & traversal guard, 16-bit WAV PCM)
  - Fair monetization credit reserve/refund + natural 3rd-conversion review prompt + UI flows
- **Tier 3 Cloud Worker Tests (`services/cloud_worker && npm test`):** **6 / 6 PASS** (0 npm vulnerabilities)
  - Hardened `policy.xml`, Anti-RCE Docker flags, 15-min TTL janitor wipe, TUS v1.0.0 resumable chunked upload + SHA-256 verification + instant `DELETE` wipe, atomic credit refund on failure
- **Live Mobile Viewport E2E Verification (`http://127.0.0.1:4173`):**
  - `360x800`: **0** horizontal overflow, **0** console errors
  - `390x844`: **0** horizontal overflow across Home, Target Picker, Queue, Offline Lock Banner, Settings, and Paywall Modal; live `sample_data.json -> sample_data.yaml` local conversion completed cleanly; **0** console errors
  - `768x1024`: **0** horizontal overflow, **0** console errors
