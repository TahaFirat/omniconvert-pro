# 01 — Ürün Gereksinimleri (PRD) ve Piyasa Üstünlüğü Stratejisi

## 1. Ürün Vizyonu
**OmniConvert Pro**, iOS App Store ve Google Play Store'da yayınlanacak, kullanıcıların günlük dosyalarını **%100 cihaz içinde, sınırsız, reklamsız ve ücretsiz** dönüştürürken; mobil donanımın tek başına çözemediği ağır/egzotik formatları (CAD, 3D, karmaşık Office, e-kitap, font, vektör, RAW — toplam 1.000+ format) yalnızca kullanıcının açık onayıyla **geçici (ephemeral), RAM-disk tabanlı ve sıfır-bilgi (zero-knowledge)** bulut motorunda işleyen yeni nesil hibrit dosya dönüştürücüdür.

## 2. Piyasadaki Rakiplerin Kronik Sorunları ve Çözümlerimiz

| Rakip / Kategori | Tespit Edilen Sorunlar | OmniConvert Pro'nun Kesin Çözümü |
| :--- | :--- | :--- |
| **File Converter ([Ice Cold Apps](https://apps.apple.com/us/app/file-converter-light/id525534736))** | Tamamen bulut odaklıdır; App Store gizlilik etiketinde konum, kimlik, kullanım verisi ve tanılama takibi (tracking) bulunur; kullanıcı yorumlarında sık başarısız dönüşüm ve reklam/ücret şikayetleri öne çıkar. | **Sıfır takip, sıfır reklam SDK'sı.** Günlük formatlar %100 cihaz içi (anında & ücretsiz); bulut yalnızca ağır/egzotik formatlarda, açık rozet ve 15 dk otomatik silme garantisiyle devreye girer. |
| **MConverter (iOS/Android)** | Hızlı ve toplu dönüşüm sunar ancak tamamen bulut bağımlıdır; internet olmadan çalışmaz ve ücretsiz katmanda dosya/günlük sınırlar bulunur. | **3 Katmanlı Hibrit Mimari:** İnternet yokken bile görsel, video, ses, PDF, OCR, arşiv ve veri formatları kesintisiz, dosya boyutu sınırsız ve toplu olarak cihazda dönüştürülür. |
| **Universal File Converter / OmniConvert (Çevrimdışı)** | Gizlidir ancak yalnızca ~20–30 temel formatla sınırlıdır; CAD, 3D, e-kitap, font, karmaşık DOCX/PPTX/ODT veya egzotik arşivlerde çaresiz kalır. | **Tier 1 (Native) + Tier 2 (Rust Core)** ile 120+ çevrimdışı format + **Tier 3 (İzole Cloud Worker)** ile 1.000+ toplam format tek arayüzde birleşir. |
| **[CloudConvert](https://www.capterra.com/p/157495/CloudConvert/) / Convertio (Web)** | Ücretsiz katman günlük 25 dönüşümle sınırlıdır; abonelik kredileri bir sonraki aya devretmez; tarayıcı tabanlı olduğu için iOS Share Sheet / Android Intent / Live Activities ve çevrimdışı çalışma yoktur. | **Ömür Boyu Lokal Ücretsiz** + **Süresiz (Never-Expiring) Bulut Kredi Paketleri** + tam yerel Share Extension, SAF, Dynamic Island ve uçak modu desteği. |

## 3. Çözdüğümüz 5 Temel Teknik ve Ürün Problemi

1. **Gizlilik vs. Format İkilemi:**
   - Kullanıcı kimlik fotokopisini veya sözleşmesini PDF'e çevirirken yabancı sunucuya yüklemek zorunda kalmaz.
   - Üst çubuktaki **"Çevrimdışı Gizlilik Modu" (Offline-Only Lock)** açıldığında uygulama ağ katmanını fiziksel olarak kilitler; tek bayt dışarı çıkamaz.
2. **Abonelik ve Reklam Tuzağı:**
   - Hiçbir tam ekran reklam (interstitial) veya ödüllü video duvarı yoktur.
   - Cihaz içi dönüşümlerde günlük limit, filigran veya yapay dosya boyutu sınırı yoktur.
3. **Sessiz Hatalar ve Format Sınırları:**
   - Dosya uzantısına güvenilmez; **Magic-Byte Inspector** dosyanın gerçek imzasını okur.
   - Şifreli PDF, şifreli ZIP/7z, DRM korumalı e-kitap (`.azw`, `.kfx`) veya katmanları düzleştirilecek kapalı proje dosyaları (`.psd`, `.dwg`, `.ai`) işlem **başlamadan önce** kullanıcıya şeffaf uyarı kartıyla bildirilir.
4. **Çoklu-Adım Format Zincirleri:**
   - Doğrudan dönüştürücüsü olmayan çiftler (ör. `HEIC -> PDF`, `XLSX -> JSON`, `DOCX -> PNG`) arka planda **Dijkstra Dönüşüm Grafı** ile otomatik çoklu adımda (multi-hop) çözülür.
5. **Mobil Arka Plan Kesintileri ve Paylaşım Sürtünmesi:**
   - Kullanıcı WhatsApp, Fotoğraflar, Dosyalar veya Safari içinden doğrudan **Paylaş -> OmniConvert** diyerek uygulamayı açmadan bile dönüşüm başlatabilir.
   - iOS **Live Activities / Dynamic Island** ve Android **WorkManager Foreground Service** ile ekran kilitlense bile kuyruk ölmez.

## 4. Başarı Kriterleri (KPI Hedefleri)
- **İlk Dönüşüm Süresi (TTFC):** Uygulama açılışından ilk lokal dönüşüm çıktısına < 5 saniye.
- **Lokal Başarı Oranı:** Desteklenen Tier 1 & Tier 2 formatlarda >= %99.5.
- **Mağaza Onayı:** Apple App Store ve Google Play Store ilk gönderimde sıfır politika reddi.
- **Uygulama Boyutu (İndirme):** iOS & Android temel paket < 45 MB (ağır GPL/FFmpeg ikili şişkinliği yok).
