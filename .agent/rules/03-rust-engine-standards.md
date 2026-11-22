---
trigger: model_decision
description: Apply when writing or editing Rust code in packages/rust_core, flutter_rust_bridge bindings, magic-byte detection, format conversion graphs, or LGPL FFmpegKitNext integration.
---
# Rust Core & Local Engine Standards

1. **FFI Bridge (`flutter_rust_bridge` v2):**
   - Expose async streaming progress callbacks (`StreamSink<ConversionProgress>`) so Flutter UI displays smooth percentage, stage, and ETA updates.
   - Support cooperative cancellation via `Arc<AtomicBool>` cancellation tokens keyed by `job_id`.
2. **Magic-Byte File Inspector (`infer` + custom signatures):**
   - Read only the first 8 KB–64 KB header (plus ZIP central directory peek for `.docx`/`.xlsx`/`.pptx`/`.epub`/`.odt`/`.apk`/`.3mf`) to determine canonical MIME type and true extension.
   - Detect encrypted/password-protected PDFs (`/Encrypt` dictionary), encrypted ZIP/7z archives, and DRM-wrapped e-books (`.azw`/`.kfx`/Adobe ADEPT) before conversion begins.
3. **Conversion Graph Engine:**
   - Model formats as nodes and converter backends (Tier 1, Tier 2, Tier 3) as weighted directed edges (`cost = latency_weight + tier_penalty + quality_loss_penalty`).
   - Run Dijkstra shortest path to resolve multi-hop conversions (max 3 hops) automatically. When `offline_only == true`, prune all Tier 3 edges before search.
4. **Pure-Rust Tier 2 Converters:**
   - **Images:** `image` crate (PNG, JPEG, WebP, GIF, TIFF, BMP, ICO, TGA, QOI, PNM, HDR, EXR) + `resvg` (SVG rasterization).
   - **Archives:** `zip`, `tar`, `flate2` (gzip), `bzip2`, `xz2`, `zstd`, `sevenz-rust` (extract/create with zip-bomb decompression ratio guards!).
   - **Data & Markup:** `serde_json`, `serde_yaml`, `toml`, `quick-xml`, `csv`, `calamine` (read XLS/XLSX/ODS), `pulldown-cmark` (Markdown↔HTML).
   - **Audio:** `symphonia` (decode FLAC/MP3/OGG/Opus/WAV/ALAC) + `hound` (WAV) + `rubato` (resampling).
5. **Zip-Bomb & Memory Guards:**
   - Enforce max decompressed ratio (e.g., 100:1) and streaming buffer caps so malformed files never OOM-crash the mobile app.
6. **FFmpegKitNext (Optional Local Advanced Media):**
   - Build strictly from source with `--disable-gpl --disable-nonfree` (LGPL only) using dynamic frameworks/shared libraries to satisfy Apple App Store and LGPLv2.1 relinking obligations.
