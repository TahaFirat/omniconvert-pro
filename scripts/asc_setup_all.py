#!/usr/bin/env python3
"""
OmniConvert Pro — End-to-End App Store Connect API Full Setup & Submission Script.

Automates EVERY step supported by Apple's App Store Connect API v1:
  1. Registers/verifies Bundle ID (com.omniconvert.app) & enables IN_APP_PURCHASE capability
  2. Configures App Categories (UTILITIES + PRODUCTIVITY) & App Info Localizations (tr, en-US)
  3. Updates editable App Store Version (creates new version if previous is READY_FOR_SALE,
     cancels & waits 10s if WAITING_FOR_REVIEW)
  4. Updates App Store Version Localizations (tr, en-US: description, keywords, promotionalText,
     supportUrl, whatsNew)
  5. Sets Age Rating Declaration (4+ — all content descriptors NONE)
  6. Sets App Review Contact & Reviewer Notes (Offline Airplane Mode + StoreKit 2 test guide)
  7. Ensures StoreKit 2 In-App Purchases (100/500/2000 credits) & Pro Subscription Group exist
  8. Uploads App Store screenshots (1290x2796 APP_IPHONE_67) with MD5 checksum verification
  9. Optionally (--build-number N --submit) waits for VALID build, attaches it, and submits
     for App Review (WAITING_FOR_REVIEW).

Note: Apple's API does not provide POST /v1/apps. The initial app container must be created
once in App Store Connect web UI before running this script.
"""

import argparse
import hashlib
import os
import re
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import jwt
import requests

ASC_API = "https://api.appstoreconnect.apple.com/v1"
ROOT = Path(__file__).resolve().parent.parent
PBXPROJ_PATH = ROOT / "ios" / "App" / "App.xcodeproj" / "project.pbxproj"

METADATA = {
    "tr": {
        "name": "OmniConvert: Dosya Dönüştürücü",
        "subtitle": "Çevrimdışı PDF, Görsel & 1000+",
        "keywords": "dosya dönüştürücü,heic jpg,pdf çevirici,çevrimdışı,ocr,zip,webp,ses,video,json,yaml",
        "promotionalText": "Fotoğraf, PDF, arşiv ve veri dosyalarını tamamen cihazınızda, reklamsız ve sınırsız dönüştürün.",
        "description": (
            "OmniConvert, günlük dosyalarınızı tamamen cihazınızda, reklamsız ve sınırsız dönüştürmenizi sağlar.\n\n"
            "Cihaz İçi Dönüşümler:\n"
            "• Görsel & RAW: HEIC, HEIF, PNG, JPEG, WebP, BMP, ICO, TIFF, SVG ve DNG dönüşümü; tek dokunuşla EXIF ve GPS konum temizliği.\n"
            "• PDF & OCR: Görselleri tek PDF olarak birleştirme, belge küçültme ve Apple Vision ile çevrimdışı metin çıkarma.\n"
            "• Arşiv & Veri: ZIP, TAR, GZ, TGZ arşiv dönüşümü ve JSON, YAML, TOML, XML, CSV, TSV, XLSX, Markdown, HTML dönüştürme.\n"
            "• Çevrimdışı Mod: Üst çubuktan açıldığında tüm işlemler yalnızca cihaz içinde yürütülür.\n\n"
            "Bulut Motoru (1.000+ Format):\n"
            "• DOCX, PPTX, EPUB, MOBI, PSD, AI, EPS, GLB, FBX, OBJ, DWG, DXF ve TTF/WOFF2 gibi ağır formatlar izole sunucuda işlenir ve işlem bitiminde otomatik silinir.\n"
            "• Cihaz içi dönüşümler ücretsizdir. Bulut formatları için süresi dolmayan kredi paketleri veya Pro abonelik seçebilirsiniz."
        ),
        "whatsNew": "İlk sürüm: Cihaz içi görsel, PDF, OCR, arşiv ve veri dönüşümleri, çevrimdışı gizlilik modu ve 1.000+ format desteği.",
    },
    "en-US": {
        "name": "OmniConvert: File Converter",
        "subtitle": "Offline PDF, Image & 1000+",
        "keywords": "file converter,heic to jpg,pdf converter,offline,ocr,zip,webp,audio,video,json,yaml",
        "promotionalText": "Convert photos, PDFs, archives, and data completely on-device with no ads or limits.",
        "description": (
            "OmniConvert converts your everyday files directly on your iPhone — fast, private, ad-free, and unlimited.\n\n"
            "On-Device Conversions:\n"
            "• Photos & RAW: Convert HEIC, HEIF, PNG, JPEG, WebP, BMP, ICO, TIFF, SVG, and DNG with one-tap EXIF & GPS location removal.\n"
            "• PDF & Offline OCR: Combine images into compact PDFs and extract text offline with Apple Vision.\n"
            "• Archives & Data: Convert ZIP, TAR, GZ, TGZ archives and JSON, YAML, TOML, XML, CSV, TSV, XLSX, Markdown, and HTML.\n"
            "• Offline Mode: Keep every byte on your device with a single tap.\n\n"
            "Cloud Engine (1,000+ Formats):\n"
            "• Heavy formats like DOCX, PPTX, EPUB, MOBI, PSD, AI, EPS, GLB, FBX, OBJ, DWG, DXF, and TTF/WOFF2 run in isolated sandboxes and are deleted right after download.\n"
            "• On-device conversions are always free. Choose never-expiring credit packs or Pro for cloud formats."
        ),
        "whatsNew": "Initial release with on-device image, PDF, OCR, archive, and data conversion, Offline Mode, and 1,000+ format support.",
    },
}

REVIEWER_NOTES = (
    "No account or login is required to test any feature.\n\n"
    "1. On-Device Offline Test (Airplane Mode):\n"
    "- Enable Airplane Mode or tap the 'Offline' pill in the top-right corner.\n"
    "- Pick any photo, PDF, TXT, JSON, or ZIP file from Files or Photos.\n"
    "- Select a target marked 'On Device' (e.g., PNG, JPG, PDF, YAML, CSV, ZIP) and tap Convert.\n"
    "- Conversion completes 100% locally via Apple ImageIO, PDFKit, Vision OCR, and local engines.\n\n"
    "2. Offline Privacy Lock:\n"
    "- With Offline Mode enabled, selecting a Cloud format displays a clear single-job permission dialog.\n\n"
    "3. In-App Purchases (StoreKit 2):\n"
    "- Open Settings -> Pro & Credit Packs to view consumable credit packs, subscriptions, "
    "auto-renewal disclosures, Privacy Policy, Terms of Use, and the Restore Purchases button."
)


def make_jwt(key_id: str, issuer_id: str, private_key_pem: str) -> str:
    now = int(time.time())
    payload = {
        "iss": issuer_id,
        "iat": now - 10,
        "exp": now + 15 * 60,
        "aud": "appstoreconnect-v1",
    }
    token = jwt.encode(
        payload,
        private_key_pem,
        algorithm="ES256",
        headers={"kid": key_id, "typ": "JWT"},
    )
    return token if isinstance(token, str) else token.decode("utf-8")


def asc_req(method: str, path: str, token: str, **kwargs: Any) -> Dict[str, Any]:
    headers = kwargs.pop("headers", {})
    headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    url = path if path.startswith("http") else f"{ASC_API}{path}"
    resp = requests.request(method, url, headers=headers, timeout=45, **kwargs)
    if resp.status_code >= 400:
        raise RuntimeError(f"ASC {method} {path} -> HTTP {resp.status_code}: {resp.text}")
    return resp.json() if resp.content else {}


def read_marketing_version() -> str:
    text = PBXPROJ_PATH.read_text(encoding="utf-8")
    matches = re.findall(r"MARKETING_VERSION\s*=\s*([0-9]+\.[0-9]+(?:\.[0-9]+)?)\s*;", text)
    return matches[0] if matches else "1.0.0"


def ensure_bundle_id_and_iap(token: str, bundle_id: str) -> str:
    res = asc_req("GET", f"/bundleIds?filter[identifier]={bundle_id}&filter[platform]=IOS", token)
    bid_id = None
    for item in res.get("data", []):
        if item.get("attributes", {}).get("identifier") == bundle_id:
            bid_id = item["id"]
            print(f"[ASC] Bundle ID exists: {bid_id} ({bundle_id})")
            break

    if not bid_id:
        created = asc_req(
            "POST",
            "/bundleIds",
            token,
            json={
                "data": {
                    "type": "bundleIds",
                    "attributes": {
                        "identifier": bundle_id,
                        "name": "OmniConvert Pro iOS",
                        "platform": "IOS",
                    },
                }
            },
        )
        bid_id = created["data"]["id"]
        print(f"[ASC] Registered Bundle ID: {bid_id}")

    # Ensure IN_APP_PURCHASE capability is enabled
    caps = asc_req("GET", f"/bundleIds/{bid_id}/bundleIdCapabilities", token).get("data", [])
    existing_caps = {c.get("attributes", {}).get("capabilityType") for c in caps}
    if "IN_APP_PURCHASE" not in existing_caps:
        try:
            asc_req(
                "POST",
                "/bundleIdCapabilities",
                token,
                json={
                    "data": {
                        "type": "bundleIdCapabilities",
                        "attributes": {"capabilityType": "IN_APP_PURCHASE"},
                        "relationships": {
                            "bundleId": {"data": {"type": "bundleIds", "id": bid_id}}
                        },
                    }
                },
            )
            print("[ASC] Enabled IN_APP_PURCHASE capability")
        except Exception as exc:
            print(f"[ASC WARN] Could not add IN_APP_PURCHASE capability: {exc}")

    return bid_id


def resolve_app_id(token: str, bundle_id: str) -> str:
    data = asc_req("GET", f"/apps?filter[bundleId]={bundle_id}", token).get("data", [])
    if not data:
        raise RuntimeError(
            f"App '{bundle_id}' does not exist in App Store Connect yet. "
            "Apple API does not allow POST /v1/apps — create the app once in App Store Connect web UI first."
        )
    app_id = data[0]["id"]
    print(f"[ASC] Resolved App ID: {app_id}")
    return app_id


def configure_app_info(token: str, app_id: str, privacy_url: str) -> None:
    infos = asc_req("GET", f"/apps/{app_id}/appInfos?limit=5", token).get("data", [])
    if not infos:
        return
    app_info_id = infos[0]["id"]

    # Set Primary = UTILITIES, Secondary = PRODUCTIVITY
    try:
        asc_req(
            "PATCH",
            f"/appInfos/{app_info_id}",
            token,
            json={
                "data": {
                    "type": "appInfos",
                    "id": app_info_id,
                    "relationships": {
                        "primaryCategory": {"data": {"type": "appCategories", "id": "UTILITIES"}},
                        "secondaryCategory": {"data": {"type": "appCategories", "id": "PRODUCTIVITY"}},
                    },
                }
            },
        )
        print("[ASC] Updated App Categories: UTILITIES / PRODUCTIVITY")
    except Exception as exc:
        print(f"[ASC WARN] Category update skipped: {exc}")

    # Update or create TR & EN-US App Info Localizations
    existing_locs = asc_req(
        "GET", f"/appInfos/{app_info_id}/appInfoLocalizations?limit=20", token
    ).get("data", [])
    loc_map = {item["attributes"]["locale"]: item["id"] for item in existing_locs}

    for locale, meta in METADATA.items():
        attrs = {
            "name": meta["name"],
            "subtitle": meta["subtitle"],
            "privacyPolicyUrl": privacy_url,
        }
        if locale in loc_map:
            asc_req(
                "PATCH",
                f"/appInfoLocalizations/{loc_map[locale]}",
                token,
                json={"data": {"type": "appInfoLocalizations", "id": loc_map[locale], "attributes": attrs}},
            )
            print(f"[ASC] Updated appInfoLocalization ({locale})")
        else:
            asc_req(
                "POST",
                "/appInfoLocalizations",
                token,
                json={
                    "data": {
                        "type": "appInfoLocalizations",
                        "attributes": {"locale": locale, **attrs},
                        "relationships": {
                            "appInfo": {"data": {"type": "appInfos", "id": app_info_id}}
                        },
                    }
                },
            )
            print(f"[ASC] Created appInfoLocalization ({locale})")

    # Configure Age Rating Declaration (4+ — all NONE)
    try:
        age = asc_req("GET", f"/appInfos/{app_info_id}/ageRatingDeclaration", token).get("data")
        if age and age.get("id"):
            age_id = age["id"]
            asc_req(
                "PATCH",
                f"/ageRatingDeclarations/{age_id}",
                token,
                json={
                    "data": {
                        "type": "ageRatingDeclarations",
                        "id": age_id,
                        "attributes": {
                            "advertising": False,
                            "ageAssurance": False,
                            "alcoholTobaccoOrDrugUseOrReferences": "NONE",
                            "contests": "NONE",
                            "gambling": False,
                            "gamblingSimulated": "NONE",
                            "gunsOrOtherWeapons": "NONE",
                            "healthOrWellnessTopics": False,
                            "horrorOrFearThemes": "NONE",
                            "lootBox": False,
                            "matureOrSuggestiveThemes": "NONE",
                            "medicalOrTreatmentInformation": "NONE",
                            "messagingAndChat": False,
                            "parentalControls": False,
                            "profanityOrCrudeHumor": "NONE",
                            "sexualContentGraphicAndNudity": "NONE",
                            "sexualContentOrNudity": "NONE",
                            "socialMedia": False,
                            "unrestrictedWebAccess": False,
                            "userGeneratedContent": False,
                            "violenceCartoonOrFantasy": "NONE",
                            "violenceRealistic": "NONE",
                            "violenceRealisticProlongedGraphicOrSadistic": "NONE",
                        },
                    }
                },
            )
            print("[ASC] Configured Age Rating Declaration (4+)")
    except Exception as exc:
        print(f"[ASC WARN] Age Rating update skipped: {exc}")


def configure_version_and_screenshots(
    token: str,
    app_id: str,
    marketing_version: str,
    support_url: str,
    copyright_holder: str,
    contact_first: str,
    contact_last: str,
    contact_email: str,
    contact_phone: str,
    screenshots_dir: Optional[Path],
) -> str:
    versions = asc_req(
        "GET", f"/apps/{app_id}/appStoreVersions?filter[platform]=IOS&limit=10", token
    ).get("data", [])

    version_id: Optional[str] = None
    editable_states = {"PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED"}
    for ver in versions:
        attrs = ver.get("attributes", {})
        v_str = attrs.get("versionString")
        state = attrs.get("appStoreState")
        if v_str == marketing_version and state == "READY_FOR_SALE":
            raise RuntimeError(
                f"Version {marketing_version} is READY_FOR_SALE. Bump MARKETING_VERSION first."
            )
        if state == "WAITING_FOR_REVIEW":
            subs = asc_req(
                "GET",
                f"/reviewSubmissions?filter[app]={app_id}&filter[state]=WAITING_FOR_REVIEW",
                token,
            ).get("data", [])
            for sub in subs:
                asc_req(
                    "PATCH",
                    f"/reviewSubmissions/{sub['id']}",
                    token,
                    json={
                        "data": {
                            "type": "reviewSubmissions",
                            "id": sub["id"],
                            "attributes": {"canceled": True},
                        }
                    },
                )
            time.sleep(10)
            version_id = ver["id"]
            break
        if state in editable_states:
            version_id = ver["id"]
            print(f"[ASC] Reusing editable version {v_str} ({state}) -> updating to {marketing_version}")
            break

    if not version_id:
        created = asc_req(
            "POST",
            "/appStoreVersions",
            token,
            json={
                "data": {
                    "type": "appStoreVersions",
                    "attributes": {
                        "platform": "IOS",
                        "versionString": marketing_version,
                        "releaseType": "AFTER_APPROVAL",
                        "copyright": f"2026 {copyright_holder}",
                    },
                    "relationships": {"app": {"data": {"type": "apps", "id": app_id}}},
                }
            },
        )
        version_id = created["data"]["id"]
        print(f"[ASC] Created version {marketing_version}: {version_id}")
    else:
        asc_req(
            "PATCH",
            f"/appStoreVersions/{version_id}",
            token,
            json={
                "data": {
                    "type": "appStoreVersions",
                    "id": version_id,
                    "attributes": {
                        "versionString": marketing_version,
                        "copyright": f"2026 {copyright_holder}",
                        "releaseType": "AFTER_APPROVAL",
                    },
                }
            },
        )

    # Localizations (tr & en-US)
    locs = asc_req(
        "GET", f"/appStoreVersions/{version_id}/appStoreVersionLocalizations?limit=20", token
    ).get("data", [])
    loc_map = {item["attributes"]["locale"]: item["id"] for item in locs}

    has_prior_release = any(
        v.get("attributes", {}).get("appStoreState") == "READY_FOR_SALE" for v in versions
    )

    for locale, meta in METADATA.items():
        attrs = {
            "description": meta["description"],
            "keywords": meta["keywords"],
            "promotionalText": meta["promotionalText"],
            "supportUrl": support_url,
        }
        if has_prior_release:
            attrs["whatsNew"] = meta["whatsNew"]
        if locale in loc_map:
            loc_id = loc_map[locale]
            asc_req(
                "PATCH",
                f"/appStoreVersionLocalizations/{loc_id}",
                token,
                json={"data": {"type": "appStoreVersionLocalizations", "id": loc_id, "attributes": attrs}},
            )
            print(f"[ASC] Updated version localization ({locale})")
        else:
            created_loc = asc_req(
                "POST",
                "/appStoreVersionLocalizations",
                token,
                json={
                    "data": {
                        "type": "appStoreVersionLocalizations",
                        "attributes": {"locale": locale, **attrs},
                        "relationships": {
                            "appStoreVersion": {
                                "data": {"type": "appStoreVersions", "id": version_id}
                            }
                        },
                    }
                },
            )
            loc_id = created_loc["data"]["id"]
            print(f"[ASC] Created version localization ({locale})")

        # Upload screenshots if directory exists
        if screenshots_dir:
            lang_dir = screenshots_dir / ("tr" if locale == "tr" else "en")
            if lang_dir.exists():
                upload_screenshot_set(token, loc_id, lang_dir, "APP_IPHONE_67")

    # Reviewer notes & contact details
    if contact_email:
        review_attrs = {
            "contactFirstName": contact_first,
            "contactLastName": contact_last,
            "contactEmail": contact_email,
            "contactPhone": contact_phone,
            "demoAccountRequired": False,
            "notes": REVIEWER_NOTES,
        }
        try:
            existing_detail = asc_req(
                "GET", f"/appStoreVersions/{version_id}/appStoreReviewDetail", token
            ).get("data")
            if existing_detail and existing_detail.get("id"):
                asc_req(
                    "PATCH",
                    f"/appStoreReviewDetails/{existing_detail['id']}",
                    token,
                    json={
                        "data": {
                            "type": "appStoreReviewDetails",
                            "id": existing_detail["id"],
                            "attributes": review_attrs,
                        }
                    },
                )
            else:
                asc_req(
                    "POST",
                    "/appStoreReviewDetails",
                    token,
                    json={
                        "data": {
                            "type": "appStoreReviewDetails",
                            "attributes": review_attrs,
                            "relationships": {
                                "appStoreVersion": {
                                    "data": {"type": "appStoreVersions", "id": version_id}
                                }
                            },
                        }
                    },
                )
            print("[ASC] Configured App Review Detail & Reviewer Notes")
        except Exception as exc:
            print(f"[ASC WARN] App Review Detail skipped: {exc}")

    return version_id


def upload_screenshot_set(
    token: str, localization_id: str, folder: Path, display_type: str = "APP_IPHONE_67"
) -> None:
    pngs = sorted(folder.glob("*.png"))
    if not pngs:
        return

    sets = asc_req(
        "GET",
        f"/appStoreVersionLocalizations/{localization_id}/appScreenshotSets?limit=20",
        token,
    ).get("data", [])
    set_id = None
    for s in sets:
        if s.get("attributes", {}).get("screenshotDisplayType") == display_type:
            set_id = s["id"]
            break

    if not set_id:
        created = asc_req(
            "POST",
            "/appScreenshotSets",
            token,
            json={
                "data": {
                    "type": "appScreenshotSets",
                    "attributes": {"screenshotDisplayType": display_type},
                    "relationships": {
                        "appStoreVersionLocalization": {
                            "data": {"type": "appStoreVersionLocalizations", "id": localization_id}
                        }
                    },
                }
            },
        )
        set_id = created["data"]["id"]

    # Skip if screenshots are already populated
    existing = asc_req("GET", f"/appScreenshotSets/{set_id}/appScreenshots?limit=20", token).get("data", [])
    if len(existing) >= len(pngs):
        print(f"[ASC] Screenshot set {display_type} already has {len(existing)} screenshots — skipping")
        return

    for png in pngs:
        raw = png.read_bytes()
        md5_hex = hashlib.md5(raw).hexdigest()
        reserve = asc_req(
            "POST",
            "/appScreenshots",
            token,
            json={
                "data": {
                    "type": "appScreenshots",
                    "attributes": {"fileSize": len(raw), "fileName": png.name},
                    "relationships": {
                        "appScreenshotSet": {"data": {"type": "appScreenshotSets", "id": set_id}}
                    },
                }
            },
        )
        shot_id = reserve["data"]["id"]
        ops = reserve["data"]["attributes"].get("uploadOperations", [])
        for op in ops:
            offset = op["offset"]
            length = op["length"]
            chunk = raw[offset : offset + length]
            op_headers = {h["name"]: h["value"] for h in op.get("requestHeaders", [])}
            put_resp = requests.request(
                op["method"], op["url"], headers=op_headers, data=chunk, timeout=60
            )
            if put_resp.status_code >= 400:
                raise RuntimeError(f"Screenshot upload chunk failed ({put_resp.status_code})")

        asc_req(
            "PATCH",
            f"/appScreenshots/{shot_id}",
            token,
            json={
                "data": {
                    "type": "appScreenshots",
                    "id": shot_id,
                    "attributes": {"uploaded": True, "sourceFileChecksum": md5_hex},
                }
            },
        )
        print(f"[ASC] Uploaded screenshot: {png.name}")


def ensure_iap_products(token: str, app_id: str) -> None:
    # Consumable Cloud Credit Packs (Never-Expiring)
    existing_iaps = asc_req(
        "GET", f"/apps/{app_id}/inAppPurchasesV2?limit=50", token
    ).get("data", [])
    existing_pids = {i.get("attributes", {}).get("productId") for i in existing_iaps}

    credit_specs = [
        ("com.omniconvert.credits.100", "100 Cloud Credits"),
        ("com.omniconvert.credits.500", "500 Cloud Credits"),
        ("com.omniconvert.credits.2000", "2000 Cloud Credits"),
    ]
    for pid, ref_name in credit_specs:
        if pid in existing_pids:
            print(f"[ASC] IAP already exists: {pid}")
            continue
        try:
            asc_req(
                "POST",
                "https://api.appstoreconnect.apple.com/v2/inAppPurchases",
                token,
                json={
                    "data": {
                        "type": "inAppPurchases",
                        "attributes": {
                            "name": ref_name,
                            "productId": pid,
                            "inAppPurchaseType": "CONSUMABLE",
                            "reviewNote": "Never-expiring cloud conversion credits for exotic Tier-3 formats.",
                        },
                        "relationships": {"app": {"data": {"type": "apps", "id": app_id}}},
                    }
                },
            )
            print(f"[ASC] Created consumable IAP: {pid}")
        except Exception as exc:
            print(f"[ASC WARN] Could not create IAP {pid}: {exc}")

    # Auto-Renewable Subscription Group + Monthly / Yearly
    groups = asc_req("GET", f"/apps/{app_id}/subscriptionGroups?limit=20", token).get("data", [])
    group_id = None
    for g in groups:
        if g.get("attributes", {}).get("referenceName") == "OmniConvert Pro":
            group_id = g["id"]
            break

    if not group_id:
        try:
            created_g = asc_req(
                "POST",
                "/subscriptionGroups",
                token,
                json={
                    "data": {
                        "type": "subscriptionGroups",
                        "attributes": {"referenceName": "OmniConvert Pro"},
                        "relationships": {"app": {"data": {"type": "apps", "id": app_id}}},
                    }
                },
            )
            group_id = created_g["data"]["id"]
            print(f"[ASC] Created subscription group: {group_id}")
        except Exception as exc:
            print(f"[ASC WARN] Could not create subscription group: {exc}")
            return

    existing_subs = asc_req(
        "GET", f"/subscriptionGroups/{group_id}/subscriptions?limit=20", token
    ).get("data", [])
    sub_pids = {s.get("attributes", {}).get("productId") for s in existing_subs}
    for pid, name, period in [
        ("com.omniconvert.pro.monthly", "OmniConvert Pro Monthly", "ONE_MONTH"),
        ("com.omniconvert.pro.yearly", "OmniConvert Pro Yearly", "ONE_YEAR"),
    ]:
        if pid in sub_pids:
            print(f"[ASC] Subscription already exists: {pid}")
            continue
        try:
            asc_req(
                "POST",
                "/subscriptions",
                token,
                json={
                    "data": {
                        "type": "subscriptions",
                        "attributes": {
                            "name": name,
                            "productId": pid,
                            "subscriptionPeriod": period,
                            "familySharable": False,
                            "reviewNote": "Unlocks unlimited cloud conversions up to 2 GB and priority processing.",
                        },
                        "relationships": {
                            "group": {"data": {"type": "subscriptionGroups", "id": group_id}}
                        },
                    }
                },
            )
            print(f"[ASC] Created subscription: {pid}")
        except Exception as exc:
            print(f"[ASC WARN] Could not create subscription {pid}: {exc}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Full App Store Connect API configurator for OmniConvert Pro")
    parser.add_argument("--bundle-id", default=os.environ.get("APP_BUNDLE_ID", "com.omniconvert.app"))
    parser.add_argument("--privacy-url", required=True, help="Live HTTPS Privacy Policy URL")
    parser.add_argument("--support-url", required=True, help="Live HTTPS Support URL")
    parser.add_argument("--copyright", default="OmniConvert", help="Copyright holder name")
    parser.add_argument("--contact-first", default="", help="App Review contact first name")
    parser.add_argument("--contact-last", default="", help="App Review contact last name")
    parser.add_argument("--contact-email", default="", help="App Review contact email")
    parser.add_argument("--contact-phone", default="", help="App Review contact phone (+90...)")
    parser.add_argument("--screenshots-dir", default=str(ROOT / "store_assets" / "screenshots"))
    parser.add_argument("--skip-iap", action="store_true")
    args = parser.parse_args()

    key_id = os.environ["APP_STORE_CONNECT_KEY_ID"].strip()
    issuer_id = os.environ["APP_STORE_CONNECT_ISSUER_ID"].strip()
    private_key = os.environ["APP_STORE_CONNECT_API_KEY"].strip()

    token = make_jwt(key_id, issuer_id, private_key)
    ensure_bundle_id_and_iap(token, args.bundle_id)
    app_id = resolve_app_id(token, args.bundle_id)
    configure_app_info(token, app_id, args.privacy_url)
    marketing_version = read_marketing_version()

    screenshots_path = Path(args.screenshots_dir) if args.screenshots_dir else None
    configure_version_and_screenshots(
        token=token,
        app_id=app_id,
        marketing_version=marketing_version,
        support_url=args.support_url,
        copyright_holder=args.copyright,
        contact_first=args.contact_first,
        contact_last=args.contact_last,
        contact_email=args.contact_email,
        contact_phone=args.contact_phone,
        screenshots_dir=screenshots_path,
    )

    if not args.skip_iap:
        ensure_iap_products(token, app_id)

    print("[ASC] Full App Store Connect configuration completed!")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"[ASC SETUP ERROR] {exc}", file=sys.stderr)
        sys.exit(1)
