# MASTER ORCHESTRATION PROMPT — OmniConvert Pro

> **Kullanım:** Bu dosyanın tamamını kopyalayıp **Google Antigravity Agent Manager** penceresine yapıştırın. Başlamadan önce aşağıdaki `[PROJE DEĞİŞKENLERİ]` bölümünü kendi bilgilerinizle güncelleyebilirsiniz (boş bırakırsanız varsayılan değerler kullanılır).

---

## PROJE DEĞİŞKENLERİ
- **Uygulama Adı:** `OmniConvert Pro` (isteğe bağlı değiştirin)
- **iOS Bundle ID / Android Application ID:** `com.omniconvert.app`
- **Cloud Worker Domain:** `api.omniconvert.app` (lokal geliştirmede `http://localhost:8080`)
- **Desteklenen Başlangıç Dilleri:** Türkçe (`tr`), İngilizce (`en`), Almanca (`de`), İspanyolca (`es`)

---

## GÖREV TANIMI

Sen kıdemli bir Mobil Mimari Uzmanı (Flutter + iOS Swift + Android Kotlin), Rust Sistem Programcısı ve Bulut Güvenliği Mühendisisin.

Bu çalışma alanındaki `docs/` klasöründe bulunan tüm teknik şartnameleri ve `.agent/rules/` altındaki kuralları **eksiksiz okuyarak**, hem **Apple App Store (iOS 26 / Xcode 26)** hem de **Google Play Store (Android 16 / API 36)** mağazalarında ilk denemede onay alacak, piyasadaki tüm dosya dönüştürücülerden hız, gizlilik, format genişliği ve kullanıcı deneyimi açısından üstün bir **3 Katmanlı Hibrit Evrensel Dosya Dönüştürücü** uygulamasını sıfırdan, üretime hazır (production-ready) kod kalitesiyle inşa et.

### Zorunlu Okuma Sırası (Kod Yazmadan Önce)
1. `docs/01_PRD_AND_COMPETITIVE_EDGE.md`
2. `docs/02_SYSTEM_ARCHITECTURE.md`
3. `docs/03_FORMAT_MATRIX_1000_PLUS.md`
4. `docs/04_UI_UX_AND_OS_INTEGRATION.md`
5. `docs/05_MONETIZATION_AND_GROWTH.md`
6. `docs/06_STORE_COMPLIANCE_AND_LEGAL.md`

### Değiştirilemez Çekirdek İlkeler
1. **3 Katmanlı Hibrit Yönlendirme (Local-First):**
   - **Tier 1 (Native Hardware):** iOS (`ImageIO`, `CoreImage`, `AVFoundation`, `PDFKit`, `Vision` OCR) ve Android (`ImageDecoder`, `Media3 Transformer`, `PdfRenderer`, `ML Kit` OCR) üzerinden sıfır yükleme, donanım hızlandırmalı anında dönüşüm.
   - **Tier 2 (On-Device Rust Core + LGPL Medya):** `flutter_rust_bridge` ile derlenen Rust çekirdeği (magic-byte tespiti, arşivler, veri formatları, SVG, Markdown, ses, görsel) + opsiyonel LGPL uyumlu `FFmpegKitNext` katmanı (kesinlikle GPL `x264`/`x265` statik bağlaması YASAK).
   - **Tier 3 (Ephemeral Zero-Knowledge Cloud Worker):** Yalnızca mobil donanımın çözemediği ağır/egzotik formatlar (CAD, 3D, karmaşık Office, e-kitap, font, vektör, RAW — toplam 1.000+ format) için izole Docker/sandbox konteynerlerinde (`--network=none`, `tmpfs`, otomatik silme) çalışan mikroservis + TUS resumable chunked upload.
2. **Sıfır Tuzak & Tam Şeffaflık:**
   - Çevrimdışı (Tier 1 & Tier 2) tüm dönüşümler **%100 ücretsiz, reklamsız, filigransız ve dosya boyutu limitsiz** olacak.
   - Uygulamada tek dokunuşla açılan **"Sadece Çevrimdışı / Gizlilik Modu"** bulunacak; bu mod açıkken uygulama tek bir bayt bile dışarı gönderemeyecek.
   - Dönüşüm başlamadan önce **Magic-Byte Inspector** gerçek dosya türünü tespit edecek ve olası kayıp/DRM/şifre durumlarını kullanıcıya net Türkçe/İngilizce mesajla gösterecek.
3. **Çoklu-Adım Akıllı Dönüşüm Grafı (Multi-Hop Graph):**
   - Doğrudan dönüştürücüsü olmayan format çiftleri (ör. `HEIC -> PDF`, `DOCX -> PNG`, `MKV -> MP3 -> WAV`) için Dijkstra tabanlı en yüksek kaliteli ve en düşük maliyetli (önce lokal) ara yol otomatik hesaplanacak.
4. **Tam OS Entegrasyonu:**
   - iOS **Share Extension**, **Open-In**, **Files App** ve **Live Activities (Dynamic Island)** ilerleme takibi.
   - Android **ACTION_SEND / ACTION_SEND_MULTIPLE**, **SAF (Storage Access Framework)** ve **WorkManager Foreground Service (`dataSync`)**.

### Yürütme Planı
`.agent/workflows/` klasöründeki 5 fazlı iş akışını sırasıyla uygula. Her faz sonunda:
- İlgili birim/entegrasyon testlerini çalıştır (`flutter test`, `cargo test`, backend `pytest`/entegre test).
- Derleme hatalarını ve lint uyarılarını sıfırla.
- Bir sonraki faza geçmeden önce kısa bir ilerleme özeti sun ve onay/devam durumunu kontrol et.

**Şimdi tüm `docs/` dosyalarını oku, monorepo proje planını oluştur ve Faz 1 (`/phase-1-scaffold`) ile başla.**
