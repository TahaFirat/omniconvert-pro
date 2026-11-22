---
description: Faz 3 — 1000+ format için izole, sıfır-bilgi (zero-knowledge) Tier 3 Cloud Worker mikroservisini ve TUS kesintisiz yükleme istemcisini inşa eder.
---
# Faz 3: Tier 3 Sıfır-Bilgi Bulut Motoru (1000+ Format)

`docs/02_SYSTEM_ARCHITECTURE.md`, `docs/03_FORMAT_MATRIX_1000_PLUS.md` ve `.agent/rules/04-cloud-worker-security.md` dosyalarını oku ve uygula:

1. **TUS v1.0.0 Kesintisiz Yükleme & İş API'si (`services/cloud_worker/api/`):**
   - `@tus/server` (veya eşdeğeri) ile parçalı (chunked), bağlantısı kopunca kaldığı yerden devam eden yükleme uç noktası (`/v1/uploads`).
   - Yükleme bittiğinde SHA-256 + magic-byte doğrulaması yap, işi Redis/BullMQ kuyruğuna ekle.
   - `GET /v1/jobs/:id` (SSE veya WebSocket ile gerçek zamanlı yüzde/aşama akışı).
   - `GET /v1/jobs/:id/download` (tek kullanımlık imzalı indirme) ve indirme tamamlandığında **anında kalıcı silme** (`wipe`).
   - `DELETE /v1/jobs/:id` (kullanıcı iptali veya manuel anında silme).
   - Arka planda her 60 saniyede bir çalışan süpürücü (janitor): 15 dakikayı aşan tüm geçici dosyaları kriptografik olarak temizler.

2. **İzole Dönüştürücü Sandbox Worker (`services/cloud_worker/worker/`):**
   - ConvertX benzeri çoklu-araç orkestrasyon katmanı kur (her motor kendi adaptör modülünde):
     - **Ofis & Belgeler:** LibreOffice Headless (`-env:UserInstallation=file:///work/lo_profile`, makrolar kapalı) + Pandoc.
     - **E-Kitaplar:** Calibre (`ebook-convert`) — EPUB, MOBI, AZW3, FB2, LIT, LRF, DjVu, PDF.
     - **3D & CAD:** Assimp + Trimesh + LibreCAD/OpenSCAD/Blender headless — OBJ, FBX, GLB, GLTF, STL, PLY, 3DS, DAE, DXF, STEP, IGES.
     - **Vektör & Tasarım:** Inkscape CLI + ImageMagick (sertleştirilmiş `policy.xml` ile) + `libvips` + Ghostscript (`-dSAFER`) + Poppler — AI, EPS, PSD, CDR, SVG, EMF, WMF, RAW.
     - **Fontlar:** FontForge — TTF, OTF, WOFF, WOFF2, EOT.
     - **Ağır Medya:** FFmpeg (sunucu tarafında donanım/CPU hızlandırmalı tüm egzotik kodekler).
     - **Arşivler:** `7zz`, `unrar-free`, `zstd`, `cabextract`.
   - Worker Dockerfile'ında non-root kullanıcı, sertleştirilmiş `policy.xml`, `--network=none`, `--read-only` ve `tmpfs` yapılandırmalarını `docker-compose.yml` ve `k8s/` manifestlerinde tanımla.

3. **Güvenlik & Kredi Muhasebesi:**
   - iOS App Attest / Android Play Integrity + RevenueCat entitlement doğrulama ara yazılımı (middleware).
   - Kredi/kota düşümü atomik (Redis/PostgreSQL transaction): iş başarısız olursa kredi otomatik iade edilir.
   - Loglarda asla dosya adı, dosya içeriği, EXIF veya IP adresi tutulmaz (yalnızca anonim `job_uuid`, kaynak/hedef uzantı, süre ve hata kodu).

4. **Mobil TUS İstemcisi (`apps/mobile/lib/infrastructure/cloud/`):**
   - `offlineOnlyMode == true` ise tüm ağ çağrılarını fiziksel olarak engelleyen `NetworkGuardInterceptor`.
   - Parçalı yükleme, duraklat/devam et, indirme sonrası otomatik `DELETE /v1/jobs/:id` doğrulama çağrısı.

5. **Doğrulama:**
   - `services/cloud_worker` için birim ve entegrasyon testlerini çalıştır (mock + küçük gerçek örnek dosyalarla).
   - Güvenlik testlerini doğrula: `policy.xml` kısıtı, 15 dk TTL temizleyici, başarısız işte kredi iadesi.
