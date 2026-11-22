---
trigger: model_decision
description: Apply when writing or editing Flutter, Dart, Swift (iOS), or Kotlin (Android) mobile app code, UI widgets, state management, background tasks, or OS share extensions.
---
# Flutter & Native Mobile Standards

1. **State Management & Persistence:**
   - Use `flutter_riverpod` (with `riverpod_annotation` / `AsyncNotifier`) for job queues, conversion routing, settings, and entitlements.
   - Use `drift` (SQLite) for persistent conversion history, custom presets, and resumable job queue state.
2. **Memory-Safe File Handling:**
   - NEVER load full video, audio, or large (>20 MB) files into Dart `Uint8List` memory. Always pass file paths/URIs across MethodChannel / Rust FFI and stream I/O in chunks.
   - Clean up temporary working directories (`getTemporaryDirectory()/job_<uuid>`) inside `try/finally` blocks.
3. **Platform Channels (Tier 1 Native Engines):**
   - **iOS (`Swift`):** Use `ImageIO` / `CoreImage` for HEIC/RAW/WebP/PNG/JPEG, `AVFoundation` / `AVAssetExportSession` / `VideoToolbox` for hardware video/audio, `PDFKit` for PDF operations, and `Vision` (`VNRecognizeTextRequest`) for offline OCR.
   - **Android (`Kotlin`):** Use `ImageDecoder` / `Bitmap`, `AndroidX Media3 Transformer` (`MediaCodec`) for hardware video/audio, `PdfRenderer`/`PdfDocument` for PDF, and `Google ML Kit` on-device text recognition for offline OCR.
4. **OS Integration & Background Resilience:**
   - **iOS:** Implement a Share Extension using shared App Group container (`group.com.omniconvert.app`), `BGProcessingTask` for long local conversions, and `ActivityKit` Live Activities for real-time progress.
   - **Android:** Handle `ACTION_SEND` and `ACTION_SEND_MULTIPLE` intents, use Storage Access Framework (SAF) — NEVER request `MANAGE_EXTERNAL_STORAGE` — and run queues via `WorkManager` with `foregroundServiceType="dataSync"`.
5. **Localization & Accessibility:**
   - Zero hardcoded user-facing strings; use `flutter_localizations` + ARB files (`app_tr.arb`, `app_en.arb`, `app_de.arb`, `app_es.arb`).
   - Support Dynamic Type / font scaling, dark/light Material 3 + Cupertino adaptive themes, and `Semantics` labels on all interactive controls.
