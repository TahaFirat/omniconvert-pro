---
description: Faz 2 — Magic-Byte Inspector, Dijkstra Multi-Hop Conversion Graph, Tier 1 (Native iOS/Android) ve Tier 2 (Rust Core + LGPL Medya) çevrimdışı motorlarını geliştirir.
---
# Faz 2: Çevrimdışı Motorlar (Tier 1 & Tier 2) ve Akıllı Yönlendirici

`docs/02_SYSTEM_ARCHITECTURE.md`, `docs/03_FORMAT_MATRIX_1000_PLUS.md` ve `.agent/rules/03-rust-engine-standards.md` dosyalarını oku ve uygula:

1. **Magic-Byte File Inspector (`packages/rust_core/src/inspector/`):**
   - Dosyanın ilk 64 KB'ını okuyarak gerçek MIME tipini, kanonik uzantısını, şifreleme/DRM durumunu ve (ZIP tabanlı formatlarda: DOCX/XLSX/PPTX/EPUB/ODT/3MF) iç dizin yapısını tespit et.
   - Uzantısı yanlış değiştirilmiş dosyaları (ör. `.jpg` yapılmış `.png` veya `.webp`) yakala ve kullanıcıya gösterilecek uyarı bayrağı döndür.
   - Şifreli PDF, şifreli ZIP/7z ve DRM'li e-kitapları (`.azw`/`.kfx`) tespit et.

2. **Akıllı Dönüşüm Grafı & Yönlendirici (`packages/rust_core/src/graph/`):**
   - Tüm formatları düğüm, Tier 1 / Tier 2 / Tier 3 dönüştürücüleri ağırlıklı yönlü kenar olarak modelle.
   - Maliyet formülü: `Tier 1 (10) < Tier 2 (20) << Tier 3 (1000)` + kalite kaybı cezası + çoklu adım cezası.
   - `offline_only == true` iken tüm Tier 3 kenarlarını graf dışına çıkar.
   - Dijkstra ile en fazla 3 adımlı çoklu-hop rotaları çöz (ör. `HEIC -> PNG -> PDF` veya `XLSX -> CSV -> JSON`).
   - Her rota için `ConversionPlan` döndür: adımlar, kullanılacak motor (Lokal / Bulut), tahmini kalite/kayıp uyarısı, tahmini süre.

3. **Tier 2 Saf-Rust Dönüştürücüler (`packages/rust_core/src/converters/`):**
   - **Görsel:** PNG, JPEG, WebP, GIF, TIFF, BMP, ICO, TGA, QOI, PNM, SVG→Raster (`resvg`). Kalite, yeniden boyutlandırma, DPI ve **EXIF/GPS temizleme** seçenekleri.
   - **Arşiv:** ZIP, TAR, GZ, BZ2, XZ, ZSTD, 7z açma/oluşturma/dönüştürme (zip-bomb oran koruması ile).
   - **Veri & Metin:** JSON ↔ YAML ↔ TOML ↔ XML ↔ CSV ↔ TSV; XLSX/ODS → CSV/JSON (`calamine`); Markdown ↔ HTML (`pulldown-cmark`).
   - **Ses (Temel):** FLAC/OGG/MP3/WAV/ALAC → WAV/PCM (`symphonia` + `hound` + `rubato`).
   - İlerleme yayını (`StreamSink<ConversionProgress>`) ve `job_id` bazlı iptal token'ı (`AtomicBool`) ekle.

4. **Tier 1 Yerel Donanım Köprüleri (`apps/mobile/ios/` & `apps/mobile/android/`):**
   - **iOS (Swift MethodChannel):**
     - `ImageIO` / `CoreImage`: HEIC, AVIF, RAW (DNG/CR2/NEF/ARW) → JPG/PNG/HEIC/PDF (EXIF strip opsiyonlu).
     - `AVFoundation` / `VideoToolbox`: MOV/MP4/M4V/M4A/AAC/WAV donanım hızlandırmalı video/ses dönüşümü ve ses ayıklama.
     - `PDFKit`: PDF birleştirme, bölme, sıkıştırma, sayfa→görsel, görsel→PDF.
     - `Vision`: Çevrimdışı yüksek doğruluklu OCR (PDF/Görsel → TXT / Aranabilir PDF).
   - **Android (Kotlin MethodChannel):**
     - `ImageDecoder` / `Bitmap`: HEIC/WebP/PNG/JPG/BMP dönüşümü + EXIF temizleme.
     - `AndroidX Media3 Transformer` (`MediaCodec`): Donanım hızlandırmalı MP4/MOV/MKV/M4A/AAC/WAV dönüşümü.
     - `PdfRenderer` / `PdfDocument`: PDF işlemleri ve görsel↔PDF.
     - `Google ML Kit Text Recognition`: Çevrimdışı OCR.

5. **Opsiyonel LGPL Medya Katmanı (Adapter Pattern):**
   - `LocalMediaEngine` arayüzünün arkasına LGPL uyumlu `FFmpegKitNext` (kaynak koddan `--disable-gpl --disable-nonfree`) adaptörünü modüler şekilde bağla; MKV/WebM/FLAC/Opus/GIF-palettegen gibi native API'nin açamadığı medya formatlarını çevrimdışı çöz.

6. **Doğrulama:**
   - Rust tarafında sentetik test dosyalarıyla (yanlış uzantılı PNG, şifreli PDF başlığı, zip-bomb koruması, multi-hop Dijkstra, JSON↔YAML↔CSV) kapsamlı birim testleri yaz.
   // turbo
   `cd packages/rust_core && cargo test`
   // turbo
   `cd apps/mobile && flutter test`
