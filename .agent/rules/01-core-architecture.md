---
trigger: always_on
---
# Core Architecture & Engineering Rules (OmniConvert Pro)

1. **Monorepo Layout:** Keep strict separation across:
   - `apps/mobile/` — Flutter (Dart 3.x, null-safety strict) targeting iOS 26+ (min iOS 16) & Android 16 / API 36 (min API 26).
   - `packages/rust_core/` — Pure Rust conversion, magic-byte inspection, and conversion graph library bridged via `flutter_rust_bridge` v2.
   - `services/cloud_worker/` — Containerized ephemeral Tier-3 conversion API (TypeScript/Bun or Go + isolated sandbox worker containers).
2. **Local-First Routing Invariant:** NEVER route a file to `cloud_worker` (Tier 3) if Tier 1 (Native OS API) or Tier 2 (Rust Core / LGPL local media) can convert it at equal or higher fidelity, OR if `offlineOnlyMode == true`.
3. **No Silent Failures:** Always detect file type via magic bytes (fallback to extension only for plain-text formats like CSV/JSON/MD). Surface DRM, password encryption, or lossy flattening warnings before starting a job.
4. **Clean Architecture:** Enforce `presentation` -> `application` (Riverpod) -> `domain` (pure entities/graph/router) -> `infrastructure` (native channels, Rust FFI, Drift SQLite, TUS HTTP client). No business logic inside widgets.
5. **Zero-Tracking Privacy:** Never add third-party ad SDKs, behavioral trackers, or IDFA/ATT collection. All local processing must leave zero residual temp files after job completion or cancellation.
6. **License Compliance:** Never statically link GPL codecs (`libx264`, `libx265`, `libfdk_aac`) into mobile binaries. Use native hardware encoders (VideoToolbox / MediaCodec) for H.264/HEVC.
7. **Verification Gate:** Before marking any phase complete, run `flutter analyze`, `flutter test`, and `cargo test` (when Rust changes) with zero errors.
