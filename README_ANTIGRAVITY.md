# OmniConvert Pro — Google Antigravity Prompt & Mimari Paketi

Bu paket, **iOS App Store** ve **Google Play Store**'da yayınlanabilecek, piyasadaki tüm rakiplerin (File Converter, MConverter, CloudConvert, Universal File Converter vb.) kronik sorunlarını çözen **3 Katmanlı Hibrit (Önce Çevrimdışı + Sıfır-Bilgi Bulut) Evrensel Dosya Dönüştürücü** uygulamasını **Google Antigravity** ile uçtan uca geliştirmeniz için tasarlanmıştır.

## Paket İçeriği

| Yol | Görevi |
| :--- | :--- |
| `00_MASTER_PROMPT.md` | Antigravity **Agent Manager**'a yapıştıracağınız ana orkestrasyon promptu. |
| `.agent/rules/` | Antigravity'nin otomatik okuyacağı proje kuralları (`always_on` çekirdek kurallar + `model_decision` alan kuralları). |
| `.agent/workflows/` | Antigravity sohbetinde `/` yazarak tetikleyeceğiniz 5 fazlı geliştirme iş akışları ve yeni format ekleme akışı. |
| `.agent/skills/store-preflight-audit/` | Yayın öncesi App Store & Google Play Store reddi önleme denetim becerisi. |
| `docs/01_PRD_AND_COMPETITIVE_EDGE.md` | Ürün vizyonu, rakip açıkları ve piyasa üstünlüğü stratejisi. |
| `docs/02_SYSTEM_ARCHITECTURE.md` | 3 Katmanlı Hibrit Motor, Dijkstra çoklu-adım dönüşüm grafı ve veri akışı. |
| `docs/03_FORMAT_MATRIX_1000_PLUS.md` | 1.000+ formatın Tier 1 / Tier 2 / Tier 3 dağılımı ve magic-byte doğrulama matrisi. |
| `docs/04_UI_UX_AND_OS_INTEGRATION.md` | Premium tasarım sistemi, Çevrimdışı Gizlilik Modu, Share Extension, SAF ve Live Activities. |
| `docs/05_MONETIZATION_AND_GROWTH.md` | Reklamsız, tuzaksız "Ömür Boyu Lokal Ücretsiz" + devreden kredi paketi modeli ve ASO. |
| `docs/06_STORE_COMPLIANCE_AND_LEGAL.md` | 2026 App Store (iOS 26 / Xcode 26) & Play Store (Android 16 / API 36), LGPL/GPL lisans ve gizlilik uyumluluğu. |

## Antigravity'de Kullanım Adımları

1. **ZIP Dosyasını Proje Kök Dizinine Çıkarın:**
   Boş bir klasör oluşturun (ör. `omniconvert-pro`) ve bu ZIP içindeki tüm dosya ve klasörleri (`.agent/` gizli klasörü dahil) doğrudan o klasörün köküne çıkarın.
2. **Klasörü Google Antigravity ile Açın:**
   Antigravity, `.agent/rules/`, `.agent/workflows/` ve `.agent/skills/` klasörlerini otomatik olarak tanıyacaktır.
3. **Agent Ayarlarını Yapın:**
   - **Review Policy:** İlk fazlarda *Agent-assisted* veya *Review-driven* modunu seçerek mimari kararları onaylayabilirsiniz.
   - **Terminal Execution:** *Auto* modunda bırakın (workflow içindeki güvenli komutlar `// turbo` ile işaretlenmiştir).
4. **Başlatın (İki Yöntem):**
   - **Yöntem A (Önerilen — Faz Faz Kontrollü):** Antigravity sohbetinde sırayla şu slash komutlarını çalıştırın:
     1. `/phase-1-scaffold`
     2. `/phase-2-offline-engine`
     3. `/phase-3-cloud-worker`
     4. `/phase-4-mobile-ux`
     5. `/phase-5-monetization-qa`
   - **Yöntem B (Tek Seferde Orkestrasyon):** `00_MASTER_PROMPT.md` içeriğini kopyalayıp Agent Manager'a yapıştırın; ajan tüm `docs/` belgelerini okuyup kendi görev planını çıkararak fazları sırayla yürütecektir.
5. **Marka Adını Özelleştirin:**
   Uygulama adı olarak geçici `OmniConvert Pro` kullanılmıştır. Kendi marka adınızı, Bundle ID (`com.sirketiniz.uygulama`) ve sunucu alan adınızı `00_MASTER_PROMPT.md` başındaki değişkenlerden 1 dakikada değiştirebilirsiniz.

## Neden Piyasadakilerden Daha İyi?

- **Gizlilik vs. Format İkilemini Çözer:** Günlük ve hassas dosyalar (fotoğraf, video, ses, PDF, arşiv, OCR, veri) **%100 cihaz içinde**, internetsiz, limitsiz ve ücretsiz dönüştürülür. Sadece mobil donanımın fiziksel olarak işleyemediği ağır/egzotik formatlar (CAD, 3D, karmaşık Office, e-kitap, font vb. 1.000+ format) kullanıcı onayıyla **geçici (ephemeral), RAM-disk tabanlı, sıfır-bilgi (zero-knowledge)** bulut motoruna yönlendirilir ve işlem sonrası anında silinir.
- **Reklam ve Abonelik Tuzağı Yoktur:** Cihaz içi tüm dönüşümler ömür boyu ücretsiz ve reklamsızdır. Ücretlendirme yalnızca gerçek sunucu maliyeti olan Bulut Motoru ve gelişmiş toplu iş akışları içindir; ayrıca devretmeyen abonelik zorunluluğu yerine **süresiz (never-expiring) kredi paketleri** de sunulur.
- **Sessiz Hata Yoktur:** Dosyalar uzantısına göre değil **magic-byte imzasına** göre tanınır; şifreli/DRM'li veya kayıplı dönüşüm riski taşıyan dosyalar işlem başlamadan önce kullanıcıya şeffaf biçimde bildirilir.
- **Mağaza Reddine Karşı Zırhlıdır:** WebView/wrapper değil tam yerel (native) deneyimli Flutter + Rust mimarisi, LGPL uyumlu medya hattı, Android 16 (API 36) / iOS 26 (Xcode 26) gereksinimleri ve eksiksiz `PrivacyInfo.xcprivacy` yapılandırması baştan kodlanır.
