# 02 — Sistem Mimarisi (3 Katmanlı Hibrit Motor & Dönüşüm Grafı)

## 1. Yüksek Seviye Mimari Şema

```text
+-----------------------------------------------------------------------+
|                FLUTTER MOBİL UYGULAMA (iOS 26 & Android 16)           |
|  [Share Ext / Intent] -> [UI (Riverpod)] -> [Drift SQLite Kuyruğu]    |
+-----------------------------------+-----------------------------------+
                                    |
                    +---------------v---------------+
                    |   RUST CORE (FFI Bridge v2)   |
                    |  1. Magic-Byte File Inspector |
                    |  2. Dijkstra Conversion Graph |
                    |  3. Offline-Only Network Lock |
                    +-------+---------------+-------+
                            |               |
         +------------------+               +------------------+
         | (Lokal Rota: Maliyet 10-20)                         | (Bulut Rota: Maliyet 1000)
         v                                                     v
+--------+-------------------------+        +------------------+--------------------+
| TIER 1: NATIVE HARDWARE          |        | TIER 3: ZERO-KNOWLEDGE CLOUD WORKER   |
| iOS: ImageIO, AVFoundation,      |        | - TUS v1.0.0 Resumable Chunked Upload |
|      PDFKit, Vision OCR          |        | - App Attest / Play Integrity Auth    |
| Android: ImageDecoder, Media3,   |        | - Redis + BullMQ İş Kuyruğu           |
|      PdfRenderer, ML Kit OCR     |        | - İzole Sandbox Konteynerler          |
+--------+-------------------------+        |   (--network=none, tmpfs, non-root)   |
         |                                  |   [LibreOffice, Calibre, Pandoc,      |
+--------v-------------------------+        |    ImageMagick, libvips, Inkscape,    |
| TIER 2: RUST CORE + LGPL MEDYA   |        |    Assimp, Blender, FontForge, FFmpeg]|
| - Görsel/SVG, Arşiv (ZIP/7z/ZST) |        | - İndirme Sonrası Anında Wipe / 15dk  |
| - Veri (JSON/YAML/CSV/XLSX/MD)   |        +---------------------------------------+
| - Ses (Symphonia) + LGPL         |
|   FFmpegKitNext (opsiyonel)      |
+----------------------------------+
```

## 2. Teknoloji Yığını Seçimi ve Gerekçesi

| Katman | Teknoloji | Neden Bu Seçim? |
| :--- | :--- | :--- |
| **Mobil Arayüz** | Flutter (Dart 3.x) + Riverpod + Drift | iOS ve Android için tek kod tabanında 120 FPS yerel performans, güçlü platform kanalları ve çevrimdışı SQLite kuyruk yönetimi. |
| **Yerel Çekirdek** | Rust + `flutter_rust_bridge` v2 | Bellek güvenliği, C/C++ hızında arşiv/veri/görsel işleme, tek kodla hem iOS (arm64) hem Android (arm64-v8a/x86_64) derlemesi. |
| **Donanım Medya (Tier 1)** | Swift (`AVFoundation`/`ImageIO`/`PDFKit`/`Vision`) & Kotlin (`Media3 Transformer`/`ImageDecoder`/`ML Kit`) | Sıfır GPL lisans riski, sıfır uygulama boyutu şişmesi, donanım H.264/HEVC hızlandırması ve pil verimliliği. |
| **Gelişmiş Lokal Medya (Tier 2 Opsiyonel)** | [FFmpegKitNext](https://github.com/arthenica/ffmpeg-kit-next) (LGPL kaynak derlemesi) | Eski FFmpegKit Ocak 2025'te sonlandırıldı; Temmuz 2026'da resmi devamı [FFmpegKitNext](https://www.itpathsolutions.com/ffmpegkit-shutdown-what-to-do-next) olarak çıktı. Yalnızca `--disable-gpl --disable-nonfree` dinamik kütüphane ile App Store/Play Store uyumlu kullanılır. |
| **Bulut Motoru (Tier 3)** | TypeScript (Bun/Elysia veya Node/Fastify) + Redis/BullMQ + Docker/gVisor Sandbox | [ConvertX](https://github.com/c4illin/ConvertX) yaklaşımından ilham alan 20+ CLI dönüştürücü orkestrasyonu, ancak mobil ölçek ve çok-kullanıcılı güvenlik için izole konteynerlerle sertleştirilmiş. |

## 3. Magic-Byte File Inspector (Gerçek Dosya Tanıma)
Rakiplerin en büyük hata kaynağı yalnızca dosya uzantısına bakmaktır.
- `packages/rust_core/src/inspector/` dosyanın yalnızca ilk 64 KB'ını okur (RAM taşması olmaz).
- ZIP tabanlı kapsayıcılar (`PK\x03\x04`) için merkezi dizini okuyarak `.docx`, `.xlsx`, `.pptx`, `.epub`, `.odt`, `.ods`, `.odp`, `.3mf`, `.apk` ayrımını %100 kesinlikle yapar.
- **Ön-Uç Güvenlik & Uyarı Kontrolleri:**
  - `is_extension_mismatched`: Dosya `.jpg` adlandırılmış ama gerçekte `WebP` ise kullanıcıya otomatik bilgi verir ve gerçek format üzerinden dönüştürür.
  - `is_encrypted`: PDF `/Encrypt` sözlüğü veya şifreli ZIP/7z tespit edilirse kullanıcıdan şifre ister.
  - `has_drm`: DRM korumalı e-kitap (`.azw`/`.kfx`/ADEPT) tespit edilirse dönüşümü başlamadan durdurur ve yasal/teknik nedeni açıklar.

## 4. Dijkstra Çoklu-Adım Dönüşüm Grafı (Multi-Hop Conversion Graph)
- **Düğümler:** Kanonik format ID'leri (`heic`, `png`, `pdf`, `docx`, `json`, `glb`, vb.).
- **Kenarlar:** `(source, target, engine_id, tier, latency_ms_est, quality_loss_0_to_100, warning_key)`.
- **Kenar Ağırlık Fonksiyonu:**
  ```text
  weight = tier_base_cost + (quality_loss * 5) + hop_penalty
  tier_base_cost:
    Tier 1 (Native Hardware) = 10
    Tier 2 (Rust / LGPL)     = 20
    Tier 3 (Cloud Worker)    = 1000
  ```
- **Çalışma Kuralı:**
  1. `offline_only == true` ise tüm `Tier 3` kenarları graf dışına çıkarılır.
  2. En fazla `max_hops = 3` derinliğinde en düşük maliyetli yol bulunur.
  3. Örnek: `HEIC -> PDF` doğrudan yoksa graf otomatik olarak `HEIC --(Tier1 ImageIO)--> PNG --(Tier1 PDFKit)--> PDF` zincirini kurar ve ara `PNG` dosyasını işlem biter bitmez siler.

## 5. Bellek, İptal ve Sıfır Artık Dosya Garantisi
- Büyük dosyalar asla Dart belleğine (`Uint8List`) alınmaz; yalnızca dosya yolları (`String`) aktarılır.
- Her iş için `temp_dir/job_<uuid>/` oluşturulur; işlem tamamlansa da, hata verse de, iptal edilse de `finally` bloğunda dizin silinir.
- Uygulama açılışında 1 saatten eski sahipsiz geçici klasörler (çökme artıkları) otomatik süpürülür.

## 6. Tier 3 Bulut Worker Güvenlik ve Sıfır-Bilgi Akışı
1. İstemci, dosyayı **TUS v1.0.0** protokolü ile 5 MB'lık parçalar halinde TLS 1.3 üzerinden yükler (mobil internet kopsa bile kaldığı yerden devam eder).
2. API sunucusu yüklenen dosyanın SHA-256 ve magic-byte doğrulamasını yapar, `tmpfs` (RAM-disk) iş klasörüne koyar.
3. BullMQ işi izole bir sandbox worker'a atar:
   - `--network=none` (SSRF, harici XXE/DTD ve uzak görsel sızıntısını imkansız kılar)
   - `--read-only` kök dosya sistemi, non-root kullanıcı, `--cap-drop=ALL`, CPU/RAM/PID cgroup sınırı ve 120 sn zaman aşımı.
4. Dönüşüm bitince istemciye SSE/WebSocket (veya uygulama kapalıysa sessiz push) bildirimi gider.
5. İstemci çıktıyı indirir ve `DELETE /v1/jobs/:id` çağrısı yapar; sunucu hem girdi hem çıktı dosyalarını anında siler. İstemci dönmezse **15 dakika TTL** süpürücüsü her şeyi kalıcı olarak yok eder.
