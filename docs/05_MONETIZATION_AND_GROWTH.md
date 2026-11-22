# 05 — Adil Gelir Modeli (Sıfır Tuzak) ve Mağaza Büyüme (ASO) Stratejisi

## 1. Neden Mevcut Modeller Kullanıcıyı Kaybediyor?
- Rakiplerin çoğu basit bir `HEIC -> JPG` dönüşümünde bile tam ekran reklam gösterir, 10 MB dosya sınırı koyar veya haftalık 9.99$ gibi agresif abonelik duvarı çıkarır.
- [CloudConvert](https://www.capterra.com/p/157495/CloudConvert/) gibi bulut servislerinde ücretsiz kullanım günlük 25 dosya ile kısıtlıdır ve aylık abonelik kredileri kullanılmazsa bir sonraki aya devretmez.
- Sonuç: 1 yıldızlı yorumlar, yüksek silinme oranı ve düşük güven.

## 2. OmniConvert Pro "Ömür Boyu Lokal Ücretsiz" Modeli

| Özellik | Ücretsiz (Ömür Boyu) | Süresiz Kredi Paketleri (Tek Seferlik) | Pro Abonelik (Aylık / Yıllık) |
| :--- | :--- | :--- | :--- |
| **Tier 1 & Tier 2 (Cihaz İçi 120+ Format)** | **Sınırsız, Reklamsız, Filigransız** | Sınırsız | Sınırsız |
| **Cihaz İçi Dosya Boyutu Sınırı** | **Yok** (Cihaz kapasitesi kadar) | Yok | Yok |
| **Çevrimdışı Gizlilik Modu & EXIF Silme** | Dahil | Dahil | Dahil |
| **Tier 3 Sıfır-Bilgi Bulut (1.000+ Format)** | Günlük 3 ücretsiz deneme (<= 25 MB) | **100 / 500 / 2.000 Kredi (ASLA SÜRESİ DOLMAZ)** | Adil kullanım sınırsız (2 GB / dosya) |
| **Toplu Dönüşüm Kuyruğu** | Lokal 10 dosya / sefer | 50 dosya / sefer | 100+ dosya / sefer + ZIP çıktı |
| **Özel Çoklu-Adım Reçeteler (Presets)** | 2 özel reçete | 5 özel reçete | Sınırsız |
| **Bulut Öncelik Sırası** | Standart | Hızlı | En Yüksek Öncelik |

### Önerilen Fiyatlandırma (StoreKit 2 & Google Play Billing — RevenueCat)
- **Başlangıç Kredi Paketi (100 Bulut Kredisi — Süresiz):** $2.99 (tek seferlik, ara sıra CAD/Office çeviren kullanıcılar için mükemmel dönüşüm!).
- **Büyük Kredi Paketi (500 Bulut Kredisi — Süresiz):** $9.99.
- **Pro Aylık:** $4.99 / ay (3 gün ücretsiz deneme opsiyonel, açık iptal bilgisi).
- **Pro Yıllık:** $29.99 / yıl (%50 indirimli).
- **Kredi Adaleti Kuralı:** Bir bulut dönüşümü herhangi bir nedenle başarısız olursa harcanan kredi **otomatik ve anında iade edilir**.

## 3. Birim Ekonomi & Sunucu Maliyeti Koruması
- Trafiğin %80–85'i cihaz içinde (Tier 1 & Tier 2) çözüldüğü için **sunucu maliyetiniz 0$'a yakın** başlar.
- Yalnızca Tier 3 bulut çağrıları sunucu CPU/RAM tüketir; bu da doğrudan Kredi Paketi veya Pro abonelik geliriyle fazlasıyla karşılanır (hedef brüt marj > %80).
- Ücretsiz günlük 3 bulut denemesi, App Attest (iOS) ve Play Integrity (Android) cihaz doğrulamasıyla bot/istismar koruması altındadır.

## 4. Mağaza Optimizasyonu (ASO) ve Viral Büyüme
- **App Store / Play Store Konumlandırma:**
  - *Başlık (TR):* `OmniConvert: Dosya Dönüştürücü`
  - *Alt Başlık (TR):* `Çevrimdışı PDF, Video, Görsel & 1000+`
  - *Başlık (EN):* `OmniConvert: File Converter`
  - *Alt Başlık (EN):* `Offline PDF, Video, Image & 1000+`
- **Doğal 5 Yıldız İnceleme Akışı (`in_app_review`):** Yalnızca kullanıcı 3. başarılı cihaz içi dönüşümünü hatasız tamamladıktan sonra (ve asla hata/paywall sonrasında değil) yerel mağaza puanlama penceresi tetiklenir.
- **Dışa Aktarma Temizliği:** Çıktı dosyalarına asla zorunlu filigran veya uygulama reklamı basılmaz; bu durum kullanıcı güvenini ve organik tavsiyeyi maksimize eder.
