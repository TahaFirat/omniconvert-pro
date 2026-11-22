---
description: Faz 1 — Monorepo, Flutter (iOS 26 / Android 16), Rust Core (flutter_rust_bridge v2) ve Cloud Worker Docker iskeletini kurar.
---
# Faz 1: Monorepo & Temel Altyapı Kurulumu

`docs/02_SYSTEM_ARCHITECTURE.md` ve `.agent/rules/01-core-architecture.md` dosyalarını oku ve aşağıdaki adımları sırayla uygula:

1. **Monorepo Dizin Yapısını Oluştur:**
   - `apps/mobile/` (Flutter uygulaması)
   - `packages/rust_core/` (Rust çekirdek kütüphanesi)
   - `services/cloud_worker/` (Tier 3 izole bulut dönüştürücü API & Worker)
   - Kök dizine `Makefile` veya `justfile` ile tek komutluk `dev`, `test`, `lint`, `codegen` görevlerini ekle.

2. **Flutter Uygulamasını Kur (`apps/mobile/`):**
   - `flutter create --org com.omniconvert --project-name omniconvert_app apps/mobile`
   - Clean Architecture klasörlerini kur: `lib/core/`, `lib/domain/`, `lib/application/`, `lib/infrastructure/`, `lib/presentation/`.
   - Paketleri ekle: `flutter_riverpod`, `riverpod_annotation`, `drift`, `sqlite3_flutter_libs`, `go_router`, `flutter_rust_bridge`, `dio`, `path_provider`, `share_plus`, `file_picker`, `flutter_localizations`, `intl`, `purchases_flutter` (RevenueCat).
   - `android/app/build.gradle.kts` içinde `compileSdk = 36`, `targetSdk = 36`, `minSdk = 26` ve 16 KB page-size hizalama bayraklarını ayarla.
   - `ios/Runner/Info.plist` ve `ios/Runner/PrivacyInfo.xcprivacy` taslaklarını oluştur (`IPHONEOS_DEPLOYMENT_TARGET = 16.0`).
   - 4 dilde ARB yerelleştirme dosyalarını (`app_tr.arb`, `app_en.arb`, `app_de.arb`, `app_es.arb`) başlat.

3. **Rust Çekirdek Köprüsünü Kur (`packages/rust_core/`):**
   - `Cargo.toml` içinde `flutter_rust_bridge`, `infer`, `thiserror`, `tokio`, `serde`, `serde_json`, `petgraph` (veya hafif Dijkstra) bağımlılıklarını ekle.
   - Örnek `health_check()` ve `inspect_file(path: String) -> FileInspectionResult` FFI fonksiyonlarını yaz ve Dart binding'lerini üret.

4. **Cloud Worker İskeletini Kur (`services/cloud_worker/`):**
   - TypeScript (Bun/Elysia veya Node/Fastify) + Redis/BullMQ kuyruk yapısı + `docker-compose.yml` iskeletini oluştur.
   - `GET /health` ve `GET /v1/formats` (desteklenen Tier 3 format kataloğu) uç noktalarını yaz.

5. **Doğrulama:**
   // turbo
   `cd packages/rust_core && cargo test`
   // turbo
   `cd apps/mobile && flutter analyze && flutter test`
   - Tüm testlerin ve analizlerin hatasız geçtiğini doğrula, ardından Faz 1 özetini sun.
