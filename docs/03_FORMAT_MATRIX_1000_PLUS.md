# 03 — 1.000+ Format Yönlendirme Matrisi ve Sınır Yönetimi

Bu belge, hangi format kategorisinin hangi katmanda (**Tier 1 Native**, **Tier 2 Rust/LGPL**, **Tier 3 Sıfır-Bilgi Bulut**) işleneceğini ve kapalı/kayıplı formatlarda kullanıcıya hangi şeffaf uyarıların gösterileceğini tanımlar.

## 1. Kategori Bazlı Yönlendirme Tablosu

| Kategori | Tier 1 (Cihaz İçi Donanım — Ücretsiz & Anında) | Tier 2 (Cihaz İçi Rust / LGPL — Ücretsiz & Çevrimdışı) | Tier 3 (Sıfır-Bilgi Bulut — 1.000+ Format) |
| :--- | :--- | :--- | :--- |
| **Görseller** | HEIC, HEIF, JPEG, PNG, WebP, GIF, TIFF, BMP, iOS RAW (DNG/CR2/NEF/ARW) → JPG/PNG/HEIC/PDF; EXIF/GPS temizleme | ICO, TGA, QOI, PNM/PPM/PGM, HDR, EXR, SVG→Raster (`resvg`), toplu yeniden boyutlandırma & DPI | AVIF (gelişmiş), JXL, PSD, XCF, AI, EPS, CDR, EMF, WMF, kamera RAW (LibRaw/ImageMagick/`libvips`), ICO çoklu boyut |
| **PDF & OCR** | PDF birleştirme, bölme, sayfa sıralama, sıkıştırma, Görsel↔PDF, **Çevrimdışı OCR** (iOS `Vision` / Android `ML Kit`) | PDF metadata okuma/temizleme, metin ayıklama, Markdown/HTML→basit çıktı | PDF→DOCX/XLSX/PPTX/EPUB/RTF/HTML, PDF/A arşivleme, karmaşık sayfa düzeni koruma (Poppler/Ghostscript/LibreOffice) |
| **Video** | MP4, MOV, M4V (H.264/HEVC donanım hızlandırmalı), çözünürlük/bit hızı düşürme, video→ses (M4A/WAV), kırpma | MKV, WebM, AVI, FLV, GIF (palettegen), VP8/VP9/AV1 çözme (LGPL `FFmpegKitNext` ile opsiyonel) | Egzotik yayın/kamera kodekleri (ProRes, DNxHD, MXF, WMV, RMVB, VOB, TS, 4K ağır transcode) |
| **Ses** | M4A, AAC, WAV, CAF, AIFF | FLAC, MP3, OGG, Opus, ALAC, WAV yeniden örnekleme (`symphonia`/`rubato` + LGPL katman) | WMA, AMR, AC3, DTS, MIDI→MP3/WAV (Timidity/FluidSynth), ses kitabı M4B |
| **Belgeler & Ofis** | Temel metin/PDF önizleme | TXT, Markdown (`md`), HTML, RTF (basit), XLSX/ODS→CSV/JSON (`calamine`) | DOCX, DOC, ODT, RTF, PAGES*, XLSX, XLS, ODS, NUMBERS*, PPTX, PPT, ODP, KEY*, LaTeX/TEX, WPS (LibreOffice + Pandoc) |
| **E-Kitaplar** | — | EPUB iç metin/görsel çıkarma (ZIP tabanlı) | EPUB, MOBI, AZW3, FB2, LIT, LRF, PDB, DjVu, CBZ/CBR↔PDF (Calibre `ebook-convert`) |
| **Arşivler** | — | ZIP, TAR, GZ, TGZ, BZ2, XZ, ZSTD, 7z (açma, oluşturma, formatlar arası dönüştürme, zip-bomb korumalı) | RAR, CAB, ISO, DMG, RPM, DEB, ARJ, LZH (`7zz`, `unrar-free`, `cabextract`) |
| **Veri & Kod** | — | JSON ↔ YAML ↔ TOML ↔ XML ↔ CSV ↔ TSV ↔ SQLite/SQL dökümü | Parquet, Avro, BSON, Protobuf/MessagePack, SPSS/SAS/Stata (Python/Pandas worker) |
| **3D Modeller** | — | OBJ/STL/PLY temel doğrulama & ASCII↔Binary STL | OBJ, FBX, GLB, GLTF, STL, PLY, 3DS, DAE, 3MF, BLEND, USDZ (Assimp + Trimesh + Blender headless) |
| **CAD & Teknik** | — | — | DXF, DWG (LibreDWG/ODA uyumlu açık motor), STEP/STP, IGES/IGS, SVG→DXF, STL→DXF |
| **Fontlar** | — | TTF/OTF metadata okuma (`ttf-parser`) | TTF ↔ OTF ↔ WOFF ↔ WOFF2 ↔ EOT ↔ SVG Font (FontForge) |

*\*Not: Apple iWork (`.pages`, `.numbers`, `.key`) dosyalarında LibreOffice/açık filtreler temel metin ve tabloları dönüştürür; karmaşık yerleşimlerin kayabileceği kullanıcıya işlem öncesi açıkça bildirilir.*

## 2. Şeffaf Sınır ve Kayıp Uyarı Sistemi (Zero-Surprise UX)
Dönüşüm planı (`ConversionPlan`) aşağıdaki durumlardan birini tespit ettiğinde arayüzde **işlem başlamadan önce** net bir uyarı kartı gösterir:

| Durum Kodu | Tetikleyici Örnek | Kullanıcıya Gösterilecek Mesaj (TR) |
| :--- | :--- | :--- |
| `WARN_RASTERIZE` | `SVG -> PNG` veya `AI/EPS -> JPG` | "Bu işlem vektörel dosyayı piksel tabanlı görsele dönüştürecek; yakınlaştırmada keskinlik değişebilir." |
| `WARN_FLATTEN_LAYERS` | `PSD -> PNG/JPG` veya `DWG -> PDF` | "Katmanlar ve düzenlenebilir akıllı nesneler tek katmanda birleştirilecektir." |
| `WARN_LAYOUT_SHIFT` | `PDF -> DOCX` veya `PAGES -> DOCX` | "Karmaşık sütun ve özel font yerleşimleri hedef belge formatında küçük kaymalar gösterebilir." |
| `WARN_LOSSY_REENCODE` | `MP3 -> AAC` veya `JPG -> WebP (kayıplı)` | "Kayıplı bir formattan başka bir kayıplı formata dönüşüm küçük kalite düşüşüne yol açabilir." |
| `BLOCK_ENCRYPTED` | Şifreli PDF / ZIP / 7z | "Bu dosya şifre korumalı. Devam etmek için lütfen dosya şifresini girin (şifre yalnızca cihazda kullanılır)." |
| `BLOCK_DRM` | DRM'li AZW / KFX / Korumalı M4P | "Bu dosya DRM (dijital hak yönetimi) ile kilitlenmiş olduğu için yasal ve teknik olarak dönüştürülemez." |
| `BLOCK_OFFLINE_LOCK` | Offline-Only Mod açık + Tier 3 format | "Çevrimdışı Gizlilik Modu açık. Bu format bulut motoru gerektiriyor; yalnızca bu işlem için geçici izin vermek ister misiniz?" |

## 3. Hazır Akıllı Ön Ayarlar (One-Tap Presets)
Kullanıcının teknik bit hızı/DPI ayarlarıyla boğuşmasını önlemek için yerleşik tek dokunuşluk reçeteler:
- **WhatsApp / Telegram için Küçült:** Video → MP4 (720p, <15 MB hedef), Görsel → WebP/JPG (EXIF temizlenmiş).
- **Resmi Kurum / E-Devlet PDF:** Fotoğraflar/Belgeler → Sıkıştırılmış, 150 DPI, <2 MB tek PDF + EXIF temiz.
- **Sosyal Medya / Web Optimizasyonu:** HEIC/PNG → AVIF/WebP (%82 kalite, metadata temiz).
- **Kayıpsız Arşivleme:** WAV/ALAC → FLAC; Klasör → ZSTD/7z yüksek sıkıştırma.
- **Taranmış Belgeden Metin (OCR):** Fotoğraf/PDF → Çevrimdışı OCR ile düzenlenebilir TXT / Aranabilir PDF.
