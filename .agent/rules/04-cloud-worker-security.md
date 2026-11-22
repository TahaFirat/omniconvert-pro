---
trigger: model_decision
description: Apply when writing or editing services/cloud_worker backend API, Dockerfiles, TUS upload endpoints, job queues, or sandboxed CLI converter wrappers (LibreOffice, ImageMagick, FFmpeg, Calibre, Pandoc, Assimp, Inkscape, Ghostscript, FontForge).
---
# Cloud Worker (Tier 3) Security & Zero-Knowledge Rules

1. **Zero-Knowledge Ephemeral Lifecycle:**
   - Store uploaded and converted files ONLY on ephemeral `tmpfs` (RAM-backed) or encrypted scratch volume with a strict **15-minute maximum TTL**.
   - Immediately unlink and overwrite/wipe both input and output files once the client confirms download (`DELETE /v1/jobs/:id` or post-download hook).
   - Never log filenames, document text, metadata, or user IP addresses alongside job IDs.
2. **Untrusted File Sandboxing (Anti-RCE Defense):**
   - Every CLI converter execution (`libreoffice`, `convert`/ImageMagick, `gs`/Ghostscript, `inkscape`, `calibre`, `ffmpeg`, `assimp`, `blender`) MUST run inside an isolated ephemeral worker container/sandbox with:
     - `--network=none` (blocks SSRF, external DTD/XXE, remote font/image fetches in HTML/SVG/PDF/Office!)
     - `--read-only` root filesystem + `--tmpfs /work:rw,noexec,nosuid,size=1g`
     - Non-root UID/GID (`65532:65532`) + `--cap-drop=ALL` + `--security-opt=no-new-privileges`
     - Hard resource limits (`--memory=2g --cpus=2 --pids-limit=128`) and wall-clock timeout (default 120s, max 300s).
   - Harden ImageMagick `policy.xml` (disable `PDF`/`PS`/`EPS`/`MVG`/`HTTPS`/`URL` coders unless explicitly routed via hardened Ghostscript with `-dSAFER`).
   - Run LibreOffice with `-env:UserInstallation=file:///work/lo_profile`, macros disabled, and zero external link updates.
3. **Resumable Chunked Upload (TUS Protocol):**
   - Use TUS v1.0.0 resumable uploads so mobile clients on flaky cellular networks never lose progress on 100 MB–2 GB files.
   - Verify SHA-256 checksum and magic bytes server-side before dispatching to the BullMQ/Redis worker queue.
4. **Rate Limiting & Abuse Prevention:**
   - Authenticate via anonymous signed device token (App Attest on iOS / Play Integrity on Android) or RevenueCat entitlement JWT.
   - Enforce per-tier concurrency, max file size, and credit/quota deduction atomically ONLY on successful conversion (refund credits automatically on failure).
