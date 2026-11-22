# 04 — Premium UI/UX Tasarım Sistemi ve İşletim Sistemi Entegrasyonu

## 1. Tasarım İlkeleri
- **3 Dokunuşta Sonuç:** Dosya Seç → Hedef Format → Dönüştür. Gereksiz kayıt ekranı, zorunlu giriş (login wall) veya reklam pop-up'ı KESİNLİKLE YOK.
- **Anında Güven Veren Gizlilik Rozetleri:**
  - **Yeşil Kalkan (`Cihaz İçi • %100 Gizli`):** Dosya cihazdan dışarı çıkmaz.
  - **Mor Bulut (`Sıfır-Bilgi Bulut • 15 dk Sonra Silinir`):** Şifreli aktarılır, RAM-diskte işlenir, indirilince silinir.
- **Tek Dokunuşlu Gizlilik Kilidi:** Üst uygulama çubuğunda her zaman erişilebilir **"Çevrimdışı Mod"** anahtarı. Aktifken tüm bulut rozetleri kilitli görünür ve ağ katmanı fiziksel olarak bloke edilir.
- **Görsel Dil:** Modern, sade, yüksek kontrastlı (WCAG AA+) tasarım; Sistem Açık, Sistem Koyu ve Saf Siyah (AMOLED) tema desteği; iOS'ta Cupertino dokunuşları (haptic feedback, sheet'ler), Android'de Material 3 Dynamic Color.

## 2. Temel Ekran Mimarisi

1. **Ana Ekran (Dönüştür):**
   - Büyük, ferah dosya ekleme alanı: *Dosyalardan Seç*, *Fotoğraf/Video*, *Belge Tara (Kamera)*, *Panodan Yapıştır*.
   - Altında hızlı kategori çipleri (Görsel, Video, Ses, PDF & OCR, Belge, Arşiv, 3D/CAD, Veri) ve son kullanılan 4 hızlı reçete (Preset).
2. **Hedef Format & Ayarlar Ekranı:**
   - Seçilen dosyaların Magic-Byte doğrulama özeti (gerçek format, boyut, çözünürlük/sayfa sayısı).
   - Akıllı önerilen formatlar (en üstte) + 1.000+ format için anlık bulanık (fuzzy) arama çubuğu.
   - Her hedef format kartında `[Lokal]` veya `[Bulut]` rozeti + varsa çoklu-adım bilgisi (ör. `HEIC → PNG → PDF`).
   - Genişletilebilir **Gelişmiş Ayarlar** çekmecesi: Kalite kaydırıcısı, boyut/çözünürlük, sayfa aralığı, **EXIF/Konum Bilgilerini Sil** anahtarı, OCR dili.
3. **Toplu İş Kuyruğu (Batch Queue):**
   - 1'den 100+'a kadar dosyayı aynı anda sıraya alır; paralel işlem ilerleme çubuğu, kalan süre (ETA), duraklat/iptal.
   - Tamamlananlar için: Hızlı önizleme (QuickLook / yerleşik görüntüleyici), **Paylaş**, **Dosyalara Kaydet**, **Tümünü Tek ZIP Yap**.
4. **Geçmiş & Reçeteler (History & Presets):**
   - Drift SQLite üzerinde aranabilir yerel geçmiş (dosyalar silinse bile işlem özeti saklanır; tek tıkla "Tüm Geçmişi Temizle").
   - Kullanıcının kendi sık kullandığı ayarları tek tıkla reçete olarak kaydetmesi (ör. "Fatura PDF'lerini 150 DPI Sıkıştır").
5. **Ayarlar & Şeffaflık Merkezi:**
   - Çevrimdışı Gizlilik Modu, varsayılan EXIF temizleme, geçici önbellek boyutu ve temizle butonu.
   - Kredi bakiyesi / Pro durumu / **Satın Alımları Geri Yükle**.
   - **Açık Kaynak Lisansları** ve **Gizlilik Özeti**.

## 3. İşletim Sistemi Derin Entegrasyonları

### iOS (iOS 26 SDK / min iOS 16)
- **Share Extension (`ios/ShareExtension/`):** Kullanıcı Fotoğraflar, Dosyalar, WhatsApp, Mail veya Safari'de *Paylaş → OmniConvert* seçtiğinde dosya App Group (`group.com.omniconvert.app`) paylaşılan dizinine kopyalanır ve ana uygulama doğrudan hedef format seçiciyle açılır.
- **Live Activities & Dynamic Island (`ActivityKit`):** 5 saniyeden uzun veya çoklu dönüşümlerde kilit ekranında ve Dynamic Island'da canlı yüzde + tamamlanan dosya sayısı (ör. `12/20 dönüştürüldü`).
- **BGProcessingTask:** Uygulama arka plana atıldığında lokal kuyruğu güvenli biçimde tamamlar ve yerel bildirim gönderir.
- **Files App & Open-In (`LSSupportsOpeningDocumentsInPlace`):** iOS Dosyalar uygulamasında "Birlikte Aç" hedefi olarak görünür.

### Android (Android 16 / API 36, min API 26)
- **Intent Filters (`ACTION_SEND`, `ACTION_SEND_MULTIPLE`, `ACTION_VIEW`):** Herhangi bir uygulamadan tekli veya çoklu dosya paylaşımıyla doğrudan dönüşüm akışı açılır.
- **Storage Access Framework (SAF) & Android Photo Picker:** Geniş depolama izni (`MANAGE_EXTERNAL_STORAGE`) istemeden güvenli dosya okuma ve kullanıcı seçimi klasöre kaydetme.
- **WorkManager + Foreground Service (`dataSync`):** Android 16 arka plan kısıtlamalarına tam uyumlu kalıcı bildirim çubuğu ilerleme göstergesi ve iptal aksiyonu.
