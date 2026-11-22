# 06 — 2026 App Store & Google Play Store Uyumluluk ve Hukuki Rehber

Bu belge, uygulamanın hem Apple App Store hem de Google Play Store incelemelerinden **ilk seferde sorunsuz geçmesi** için zorunlu teknik, politika ve lisans kurallarını özetler ([Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), [2026 Store Requirements](https://www.mobiloud.com/blog/app-store-requirements-and-pitfalls/)).

## 1. 2026 Zorunlu SDK ve Derleme Hedefleri
- **Apple App Store (iOS):**
  - 28 Nisan 2026 itibarıyla tüm gönderimler **Xcode 26 ve iOS 26 SDK** ile derlenmelidir.
  - Minimum dağıtım hedefi: `iOS 16.0` (ActivityKit / Live Activities ve modern Swift concurrency desteği için).
- **Google Play Store (Android):**
  - 31 Ağustos 2026 itibarıyla yeni uygulamalar ve güncellemeler **Android 16 (API 36)** hedeflemelidir (`compileSdk = 36`, `targetSdk = 36`, `minSdk = 26`).
  - Tüm native `.so` kütüphaneleri (Rust FFI ve opsiyonel LGPL kütüphaneler) **16 KB bellek sayfa boyutu** hizalamasıyla derlenmelidir.

## 2. Apple App Store Reddi Önleme Kontrol Listesi
- **Guideline 4.2 (Minimum Functionality — Web Wrapper Reddi):**
  - Uygulama kesinlikle bir web sitesi sarmalayıcısı (WebView) olmamalıdır. Tier 1 & Tier 2 çevrimdışı motorlar, iOS Share Extension, Files App entegrasyonu ve Live Activities sayesinde uçak modunda bile tam işlevsel yerel bir araç olarak çalışır.
- **Guideline 3.1.1 (In-App Purchase):**
  - Tüm Pro abonelikler ve Süresiz Kredi Paketleri yalnızca **StoreKit 2** (RevenueCat üzerinden) satılır; dış web ödeme linki eklenmez.
  - Paywall ve Ayarlar ekranında çalışan **"Satın Alımları Geri Yükle (Restore Purchases)"** butonu zorunludur.
- **Guideline 4.8 (Sign in with Apple):**
  - Varsayılan tasarım **Hesapsız (No Account Required)** kullanımdır; böylece giriş duvarı ve hesap silme yükü doğmaz. İleride üçüncü parti sosyal giriş (Google vb.) eklenirse **Sign in with Apple** eşit görünürlükle eklenmek zorundadır.
- **Guideline 5.1.1 & `PrivacyInfo.xcprivacy`:**
  - `NSPrivacyTracking = false`.
  - Required Reason API beyanları eksiksiz tanımlanır (`FileTimestamp`, `DiskSpace`, `UserDefaults`).
  - Çalışan, yer tutucu olmayan gerçek Gizlilik Politikası ve Kullanım Koşulları bağlantıları hem App Store Connect'te hem uygulama içinde yer alır.
- **App Review Notları (Reviewer Notes):**
  - İnceleme ekibine hem **Çevrimdışı Mod** (uçak modunda HEIC/PNG/PDF testi) hem de **Sıfır-Bilgi Bulut Modu** test adımları açıkça yazılır; sunucu inceleme süresince 7/24 aktif tutulur.

## 3. Google Play Store Reddi Önleme Kontrol Listesi
- **Depolama İzinleri (Scoped Storage / SAF):**
  - `MANAGE_EXTERNAL_STORAGE` izni **KESİNLİKLE İSTENMEZ** (dosya yöneticisi olmayan uygulamalarda doğrudan ret sebebidir).
  - Tüm dosya seçimleri **SAF (`ACTION_OPEN_DOCUMENT`)** ve **Android Photo Picker** üzerinden yapılır.
- **Arka Plan ve Ön Plan Servisleri (`Android 16`):**
  - Uzun toplu dönüşümler için `FOREGROUND_SERVICE` ve `FOREGROUND_SERVICE_DATA_SYNC` izinleri manifestte tanımlanır; Play Console beyanında kullanıcı tarafından başlatılan dosya dönüştürme kuyruğu video kaydıyla belgelenir.
- **Veri Güvenliği (Data Safety Form):**
  - Reklam SDK'sı ve analitik takipçisi olmadığı için form temiz doldurulur; yalnızca Tier 3 bulut seçildiğinde dosyanın geçici (ephemeral) işlenip 15 dk içinde silindiği şeffafça beyan edilir.

## 4. Açık Kaynak Lisans Uyumluluğu (LGPL / GPL Tuzağından Kaçınma)
- **GPL Yasağı (Mobil İkili):** Apple App Store koşulları GPLv2/v3 lisansıyla uyumsuzdur. Bu nedenle mobil uygulamaya `libx264`, `libx265`, `libfdk_aac` gibi GPL/non-free kodekler **ASLA statik bağlanmaz**.
- **H.264 / HEVC Çözümü:** Cihaz içi video kodlama için donanım API'leri (iOS `VideoToolbox`, Android `MediaCodec`) kullanılır — hem lisanssız hem 5–10 kat daha hızlıdır.
- **Opsiyonel LGPL Katmanı (`FFmpegKitNext`):** Kullanılırsa yalnızca `--disable-gpl --disable-nonfree` bayraklarıyla dinamik kütüphane (`.xcframework` / `.so`) olarak derlenir; uygulama içindeki **Açık Kaynak Lisansları** ekranında LGPLv2.1 metni ve kaynak/yeniden bağlama bildirimi sunulur.
- **Sunucu Tarafı (Tier 3):** LibreOffice, FFmpeg, Calibre, Ghostscript, Assimp gibi araçlar yalnızca sunucu tarafında (SaaS API arkasında) çalıştırıldığı için mobil uygulama paketine dağıtılmaz; AGPL araçlar kullanılacaksa (ör. bazı Ghostscript sürümleri) lisans uyumluluğu ayrıca doğrulanır veya alternatif BSD/MIT/Apache/GPLv2 sunucu araçları tercih edilir.
