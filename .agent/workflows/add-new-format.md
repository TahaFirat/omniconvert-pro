---
description: Uygulamaya yeni bir dosya formatı veya dönüştürücü motoru standart ve güvenli biçimde ekler.
---
# Yeni Format / Dönüştürücü Ekleme İş Akışı

Kullanıcı yeni bir format (ör. `.jxl`, `.heif`, `.step`, `.pages`) istediğinde şu sırayı izle:

1. **Magic-Byte & MIME Tanımı:**
   - `packages/rust_core/src/inspector/` içine formatın magic-byte imzasını, kanonik uzantısını ve MIME tipini ekle.
2. **Katman (Tier) Seçimi:**
   - Önce Tier 1 (iOS/Android Native) destekliyor mu kontrol et.
   - Değilse saf Rust crate (Tier 2) ile mobil cihazda güvenli ve hızlı çözülebilir mi değerlendir (GPL lisanslı kütüphane YASAK).
   - Değilse Tier 3 Cloud Worker adaptörüne (`services/cloud_worker/worker/adapters/`) ekle.
3. **Conversion Graph Güncellemesi:**
   - `packages/rust_core/src/graph/registry.rs` içine düğüm ve kenar maliyetlerini + varsa kayıp/düzleştirme uyarı metnini ekle.
4. **Yerelleştirme & Test:**
   - `app_tr.arb` ve `app_en.arb` dosyalarına format açıklamasını ekle.
   - Hem magic-byte hem dönüşüm rotası için birim test yaz ve çalıştır:
   // turbo
   `cd packages/rust_core && cargo test`
   // turbo
   `cd apps/mobile && flutter test`
