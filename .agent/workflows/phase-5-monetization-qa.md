---
description: Faz 5 — Reklamsız/tuzaksız RevenueCat gelir modeli, süresiz kredi paketleri, uçtan uca testler ve 2026 App Store / Play Store yayın öncesi denetimi.
---
# Faz 5: Adil Gelir Modeli, Kalite Güvence ve Mağaza Yayını

`docs/05_MONETIZATION_AND_GROWTH.md`, `docs/06_STORE_COMPLIANCE_AND_LEGAL.md` ve `.agent/rules/05-store-compliance.md` dosyalarını oku ve uygula:

1. **Adil Gelir Modeli (`apps/mobile/lib/application/billing/`):**
   - `purchases_flutter` (RevenueCat) ile StoreKit 2 (iOS) ve Google Play Billing (Android) entegrasyonu.
   - **Ücretsiz Katman (Ömür Boyu):** Tüm Tier 1 & Tier 2 çevrimdışı dönüşümler sınırsız, reklamsız, filigransız + deneme için günlük 3 ücretsiz Tier 3 bulut dönüşümü (<=25 MB).
   - **Süresiz Kredi Paketleri (Consumable IAP):** 100 / 500 / 2000 Bulut Kredisi — **asla süresi dolmaz** (CloudConvert'in devretmeyen abonelik sorununu çözer).
   - **Pro Abonelik (Aylık / Yıllık):** Sınırsız adil-kullanım Tier 3 Bulut Motoru (2 GB/dosya), 100+ toplu kuyruk, özel çoklu-adım reçeteler (Presets), öncelikli bulut sırası.
   - Paywall ekranı kuralları: Karanlık desen (dark pattern) YASAK; açık iptal bilgisi, şeffaf fiyat, görünür **"Satın Alımları Geri Yükle (Restore Purchases)"** butonu, Gizlilik Politikası ve Kullanım Koşulları bağlantıları.

2. **Açık Kaynak Lisansları & Gizlilik Ekranları:**
   - Ayarlar ekranına: **Açık Kaynak Lisansları** (Flutter, Rust crates, LGPLv2.1 bildirimi), **Gizlilik Özeti** (ne lokal ne bulut, sıfır takip), **Tüm Yerel Önbelleği ve Geçmişi Sil** butonu ekle.

3. **Kapsamlı Test Paketi:**
   - Birim testler: Dönüşüm grafı, magic-byte dedektörü, offline kilidi, kredi muhasebesi, paywall entitlement mantığı.
   - Entegrasyon testleri: Uçtan uca lokal dönüşüm (görsel, PDF, arşiv, JSON↔YAML), iptal ve geçici dosya temizliği (0 artık dosya doğrulaması).

4. **Store Pre-Flight Audit (Zorunlu):**
   - `.agent/skills/store-preflight-audit/SKILL.md` becerisini çalıştır.
   - iOS (`PrivacyInfo.xcprivacy`, Xcode 26 / iOS 26 SDK, Guideline 4.2/3.1.1/4.8/5.1.1, Share Extension entitlements) ve Android (`targetSdk 36`, 16 KB page alignment, `FOREGROUND_SERVICE_DATA_SYNC`, `MANAGE_EXTERNAL_STORAGE` yokluğu) kontrol listesinin %100 geçtiğini kanıtla.

5. **Yayın Çıktıları:**
   - `docs/STORE_LISTING_TR_EN.md` içine App Store ve Google Play Store için ASO uyumlu başlık, alt başlık, açıklama, anahtar kelimeler, ekran görüntüsü senaryosu ve App Review test notlarını (Reviewer Notes) üret.
   // turbo
   `cd packages/rust_core && cargo test`
   // turbo
   `cd apps/mobile && flutter analyze && flutter test`
