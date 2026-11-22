---
description: Faz 4 — Premium tasarım sistemi, toplu dönüştürme kuyruğu, iOS Share Extension, Android Intent/SAF ve Live Activities entegrasyonlarını yapar.
---
# Faz 4: Premium Mobil UX & İşletim Sistemi Entegrasyonları

`docs/04_UI_UX_AND_OS_INTEGRATION.md` ve `.agent/rules/02-flutter-mobile-standards.md` dosyalarını oku ve uygula:

1. **Tasarım Sistemi (`apps/mobile/lib/presentation/theme/`):**
   - Açık/Koyu (AMOLED destekli) tema, yüksek kontrast (WCAG AA+), akıcı mikro animasyonlar.
   - Rozet dili (her dosyada net görünür):
     - Yeşil Kalkan: **Cihaz İçi (Çevrimdışı — %100 Gizli & Ücretsiz)**
     - Mor Bulut: **Sıfır-Bilgi Bulut (15 dk içinde otomatik silinir)**
   - Üst çubukta tek dokunuşlu **"Çevrimdışı Gizlilik Modu" (Offline-Only Lock)** anahtarı.

2. **Ana Ekranlar ve Akışlar (`apps/mobile/lib/presentation/screens/`):**
   - **Dönüştür (Ana Ekran):** Çoklu dosya seçici (Fotoğraflar, Dosyalar, Kamera Tarama, Pano), sürükle-bırak/hızlı kategori kısayolları.
   - **Akıllı Hedef Seçici:** Magic-Byte inceleme sonucu + en sık kullanılan hedef formatlar üstte + anlık arama (1000+ format) + her formatın yanında `[Lokal]` veya `[Bulut]` etiketi.
   - **Dönüşüm Ayarları Çekmecesi (Gelişmiş):** Kalite/bit hızı, çözünürlük, DPI, sayfa aralığı, **EXIF/GPS Temizle** (varsayılan açık opsiyonu), PDF şifre çözme/ekleme, OCR dili, hazır ön ayarlar (ör. "WhatsApp için Küçült", "E-Devlet 2MB Altı PDF").
   - **Toplu İş Kuyruğu (Batch Queue):** Paralel ilerleme çubukları, iptal, yeniden dene, çıktı önizleme, tek tıkla "Tümünü ZIP olarak Paylaş" veya "Dosyalara Kaydet".
   - **Geçmiş & Hazır İş Akışları (Presets):** Drift SQLite tabanlı aranabilir geçmiş ve tek dokunuşluk özel reçeteler.

3. **iOS Derin Entegrasyonlar:**
   - **iOS Share Extension** (`ios/ShareExtension/`): Fotoğraflar, Dosyalar, WhatsApp, Safari veya Mail içinden "OmniConvert ile Dönüştür" seçeneği; App Group üzerinden ana uygulamaya aktarım.
   - **Live Activities (`ActivityKit`) & Dynamic Island:** Uzun toplu dönüşümlerde kilit ekranında canlı ilerleme çubuğu.
   - **BGProcessingTask:** Uygulama arka plana alındığında devam eden işleri güvenli biçimde yönetme.

4. **Android Derin Entegrasyonlar:**
   - `AndroidManifest.xml` içinde `ACTION_SEND` ve `ACTION_SEND_MULTIPLE` intent filtreleri (`*/*` MIME tipi).
   - **SAF (Storage Access Framework)** ile sıfır geniş depolama izni (`MANAGE_EXTERNAL_STORAGE` kesinlikle yok).
   - **WorkManager + Foreground Service (`dataSync`)** ile bildirim çubuğunda canlı ilerleme ve iptal butonu.

5. **Doğrulama:**
   // turbo
   `cd apps/mobile && flutter analyze && flutter test`
   - Widget testleri: Offline-Only kilidi açıkken Bulut formatına basıldığında net uyarı ve tek tıkla kilidi geçici açma diyaloğu testi; şifreli/bozuk dosya ön-uyarı testi.
