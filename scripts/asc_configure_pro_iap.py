#!/usr/bin/env python3
"""
OmniConvert Pro — App Store Connect StoreKit 2 IAP & Subscription Configurator + Metadata Sync.

Configures all 3 balanced Pro products to READY_TO_SUBMIT:
  - com.omniconvert.pro.monthly  (Auto-Renewable Subscription, $1.99/mo, 175 territories)
  - com.omniconvert.pro.yearly   (Auto-Renewable Subscription, $9.99/yr, 175 territories)
  - com.omniconvert.pro.lifetime (Non-Consumable IAP, $14.99 one-time, 175 territories)

Also:
  - Cancels any active WAITING_FOR_REVIEW submission cleanly before modifying version/IAPs
  - Deletes legacy unused consumable credit IAP drafts (com.omniconvert.credits.*)
  - Generates a crisp 1290x2796 RGB (no-alpha) Paywall Review Screenshot for Apple IAP Review
  - Updates TR & EN-US App Store descriptions, subtitles, keywords, and App Review Notes
"""

import argparse
import hashlib
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import jwt
import requests
from PIL import Image, ImageDraw, ImageFont

ASC_V1 = "https://api.appstoreconnect.apple.com/v1"
ASC_V2 = "https://api.appstoreconnect.apple.com/v2"
ROOT = Path(__file__).resolve().parent.parent
REVIEW_SHOT_PATH = ROOT / "store_assets" / "screenshots" / "iap_paywall_review.png"

APP_ID_DEFAULT = "6838002449"
BUNDLE_ID_DEFAULT = "com.omniconvert.app"
SUPPORT_URL = "https://tahafirat.github.io/omniconvert-pro/"
PRIVACY_URL = "https://tahafirat.github.io/omniconvert-pro/privacy.html"

UPDATED_METADATA = {
    "tr": {
        "name": "OmniConvert: Dosya Dönüştürücü",
        "subtitle": "Çevrimdışı PDF, Görsel & Video",
        "keywords": "dosya dönüştürücü,heic jpg,pdf birleştir,çevrimdışı,ocr,docx,video gif,zil sesi,zip,webp",
        "promotionalText": "Fotoğraf, PDF, belge, video ve arşivleri %100 cihazınızda, reklamsız ve güvenle dönüştürün.",
        "description": (
            "OmniConvert, tüm dosyalarınızı tamamen cihazınızda, internet bağlantısına gerek duymadan, reklamsız ve gizlilik odaklı dönüştürür.\n\n"
            "Ücretsiz ve Sınırsız Temel Özellikler:\n"
            "• Görsel Dönüştürme: PNG, JPEG, WebP, BMP, ICO, SVG ve tek dokunuşla EXIF/GPS konum temizliği.\n"
            "• Belgeler & E-Kitap: DOCX, XLSX, ODS, EPUB, Markdown, HTML, RTF ve TXT dönüşümleri.\n"
            "• Veri & Arşiv: JSON, YAML, TOML, XML, CSV, TSV dönüşümü ve ZIP, TAR, GZ, TGZ arşivleme.\n"
            "• Fotoğraflardan PDF oluşturma, 3 dosyaya kadar toplu dönüştürme ve günde 3 ücretsiz Pro araç denemesi.\n\n"
            "OmniConvert Pro (Tamamı Cihaz İçi):\n"
            "• Sınırsız Toplu Dönüştürme ve sınırsız kayıtlı ön ayar.\n"
            "• PDF Stüdyosu: PDF birleştirme, sayfa aralığı bölme, döndürme, sıkıştırma ve gizli meta veri temizliği.\n"
            "• Video & Ses Araçları: MP4/MOV sıkıştırma (480p/720p/1080p), videodan M4A/WAV ses çıkarma, 30 sn iPhone M4R zil sesi ve animasyonlu GIF oluşturma.\n"
            "• Apple Vision Çevrimdışı OCR: Görsel ve PDF'lerden tamamen cihaz içinde metin çıkarma.\n"
            "• Apple Kamera RAW (DNG, CR2, NEF, ARW) ve HEIC/TIFF dönüşümü.\n\n"
            "Sıfır reklam, sıfır izleme. Tüm dosyalar cihazınızdan çıkmadan işlenir."
        ),
    },
    "en-US": {
        "name": "OmniConvert: File Converter",
        "subtitle": "Offline PDF, Image & Video",
        "keywords": "file converter,heic to jpg,pdf merge,offline,ocr,docx,video to gif,ringtone,zip,webp",
        "promotionalText": "Convert photos, PDFs, documents, videos, and archives 100% on-device — ad-free and private.",
        "description": (
            "OmniConvert converts your files directly on your iPhone and iPad — fast, completely offline, ad-free, and private.\n\n"
            "Generous Free Tier (No Ads, No Tracking):\n"
            "• Images: Convert PNG, JPEG, WebP, BMP, ICO, and SVG with one-tap EXIF & GPS metadata removal.\n"
            "• Documents & eBooks: Convert DOCX, XLSX, ODS, EPUB, Markdown, HTML, RTF, and TXT on-device.\n"
            "• Data & Archives: Convert JSON, YAML, TOML, XML, CSV, TSV, and ZIP, TAR, GZ, TGZ archives.\n"
            "• Combine images into PDF, batch up to 3 files, plus 3 free daily Pro tool trials.\n\n"
            "OmniConvert Pro (100% On-Device):\n"
            "• Unlimited Batch Conversion and unlimited custom presets.\n"
            "• PDF Studio: Merge multiple PDFs, split page ranges, rotate, compress, and strip metadata.\n"
            "• Video & Audio Toolkit: Compress MP4/MOV (480p/720p/1080p), extract M4A/WAV audio, create 30s M4R iPhone ringtones, and convert video to animated GIF.\n"
            "• Offline OCR powered by Apple Vision to extract text from images and PDFs.\n"
            "• Camera RAW (DNG, CR2, NEF, ARW), HEIC, and TIFF conversion.\n\n"
            "Zero ads, zero tracking, zero cloud uploads. Every byte stays on your device."
        ),
    },
}

UPDATED_REVIEWER_NOTES = (
    "No account or sign-in is required to test any feature. All conversions run 100% on-device.\n\n"
    "1. On-Device Offline Test (Airplane Mode):\n"
    "- Enable Airplane Mode or toggle Offline Mode in Settings.\n"
    "- Import any photo, PDF, DOCX, XLSX, TXT, JSON, ZIP, or MP4 file from Files or Photos.\n"
    "- Choose a target format (e.g., PNG, JPG, PDF, M4A, M4R, GIF, YAML, CSV, ZIP) and tap Convert.\n"
    "- Processing completes locally using Apple ImageIO, PDFKit, AVFoundation, Vision OCR, and local engines.\n\n"
    "2. Free Tier & Daily Pro Trials:\n"
    "- Standard conversions (images, documents, data, archives, images-to-PDF) are unlimited and ad-free.\n"
    "- Pro tools (PDF Merge/Split/Rotate, Video/Audio/GIF/Ringtone, Vision OCR, RAW/HEIC, >3 batch) include 3 free daily trials so reviewers and users can verify them immediately.\n\n"
    "3. In-App Purchases & Subscriptions (StoreKit 2):\n"
    "- Open Settings -> OmniConvert Pro (or tap 'Pro' on the home header) to view:\n"
    "  * com.omniconvert.pro.yearly ($9.99/year auto-renewable)\n"
    "  * com.omniconvert.pro.lifetime ($14.99 one-time non-consumable)\n"
    "  * com.omniconvert.pro.monthly ($1.99/month auto-renewable)\n"
    "- StoreKit 2 fetches live localized pricing, handles purchase/restore, includes auto-renewal disclosures, "
    "and links to Privacy Policy and Terms of Use."
)

FONT_BOLD = [
    r"C:\Windows\Fonts\seguisb.ttf",
    r"C:\Windows\Fonts\segoeuib.ttf",
    r"C:\Windows\Fonts\arialbd.ttf",
    "/System/Library/Fonts/SFNS.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]
FONT_REG = [
    r"C:\Windows\Fonts\segoeui.ttf",
    r"C:\Windows\Fonts\arial.ttf",
    "/System/Library/Fonts/SFNS.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    for p in (FONT_BOLD if bold else FONT_REG):
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def generate_paywall_review_screenshot(out_path: Path) -> Path:
    """Generates a 1290x2796 RGB (no alpha) iOS paywall review screenshot for Apple IAP Review."""
    w, h = 1290, 2796
    img = Image.new("RGB", (w, h), (0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Top iOS status bar + Dynamic Island
    cx = w // 2
    draw.rounded_rectangle((cx - 170, 44, cx + 170, 128), radius=42, fill=(20, 20, 24))
    f_status = load_font(42, bold=True)
    draw.text((96, 62), "9:41", font=f_status, fill=(255, 255, 255))

    # Sheet header
    f_title = load_font(68, bold=True)
    f_sub = load_font(38, bold=False)
    f_sec = load_font(34, bold=True)
    f_card_title = load_font(42, bold=True)
    f_card_sub = load_font(32, bold=False)
    f_price = load_font(48, bold=True)
    f_small = load_font(28, bold=False)
    f_badge = load_font(26, bold=True)

    # Sheet container
    draw.rounded_rectangle((48, 190, w - 48, h - 120), radius=68, fill=(28, 28, 30), outline=(58, 58, 62), width=2)
    draw.rounded_rectangle((cx - 72, 218, cx + 72, 232), radius=7, fill=(98, 98, 106))

    # Close button (X)
    draw.ellipse((w - 168, 260, w - 92, 336), fill=(48, 48, 54))
    draw.text((w - 144, 270), "X", font=load_font(40, bold=True), fill=(210, 210, 218))

    # App badge + Heading
    y = 320
    draw.text((104, y), "OmniConvert Pro", font=f_title, fill=(255, 255, 255))
    y += 96
    draw.text((104, y), "100% On-Device. Ad-Free. Fair & Simple Pricing.", font=f_sub, fill=(162, 162, 170))

    # Free tier guarantee banner
    y += 88
    draw.rounded_rectangle((104, y, w - 104, y + 124), radius=28, fill=(20, 52, 34), outline=(48, 209, 88), width=2)
    draw.text((140, y + 24), "Free Forever: Unlimited Standard Conversions", font=load_font(34, bold=True), fill=(48, 209, 88))
    draw.text((140, y + 70), "PNG/JPG/WebP, DOCX/XLSX/EPUB, Data, ZIP + 3 daily Pro trials", font=f_small, fill=(210, 240, 220))

    # Pro features list
    y += 168
    draw.text((104, y), "INCLUDED IN PRO (100% ON-DEVICE)", font=f_sec, fill=(142, 142, 147))
    y += 56
    features = [
        "Unlimited Batch Conversion & Unlimited Saved Presets",
        "PDF Studio: Merge, Split Pages, Rotate & Compress",
        "Video & Audio: MP4/MOV, M4A/WAV, 30s M4R Ringtone & GIF",
        "Apple Vision Offline OCR (Extract Text Without Internet)",
        "Camera RAW (DNG, CR2, NEF, ARW) & HEIC/TIFF Support",
    ]
    draw.rounded_rectangle((104, y, w - 104, y + 430), radius=32, fill=(40, 40, 44))
    fy = y + 34
    for feat in features:
        draw.ellipse((142, fy + 10, 166, fy + 34), fill=(10, 132, 255))
        draw.text((194, fy), feat, font=f_card_sub, fill=(242, 242, 247))
        fy += 78

    # Pricing cards
    y += 474
    draw.text((104, y), "CHOOSE YOUR PLAN", font=f_sec, fill=(142, 142, 147))
    y += 56

    plans = [
        ("Pro Yearly", "$9.99 / year", "Auto-renews yearly • Best Value (Save 58%)", "BEST VALUE", True),
        ("Pro Lifetime", "$14.99", "One-time purchase • Pay once, own forever", "NO SUBSCRIPTION", False),
        ("Pro Monthly", "$1.99 / month", "Auto-renews monthly • Cancel anytime in Apple ID", None, False),
    ]

    for title, price, sub, badge, highlighted in plans:
        card_fill = (20, 42, 72) if highlighted else (40, 40, 44)
        border = (10, 132, 255) if highlighted else (70, 70, 76)
        bw = 4 if highlighted else 2
        draw.rounded_rectangle((104, y, w - 104, y + 190), radius=34, fill=card_fill, outline=border, width=bw)

        draw.text((144, y + 34), title, font=f_card_title, fill=(255, 255, 255))
        if badge:
            bx = 440 if title == "Pro Yearly" else 486
            draw.rounded_rectangle((bx, y + 36, bx + 250, y + 80), radius=20, fill=(10, 132, 255) if highlighted else (56, 56, 64))
            draw.text((bx + 22, y + 42), badge, font=f_badge, fill=(255, 255, 255))

        draw.text((144, y + 110), sub, font=f_small, fill=(182, 182, 192))
        pb = draw.textbbox((0, 0), price, font=f_price)
        pw = pb[2] - pb[0]
        draw.text((w - 144 - pw, y + 42), price, font=f_price, fill=(255, 255, 255))
        y += 220

    # Primary CTA button
    y += 20
    draw.rounded_rectangle((104, y, w - 104, y + 122), radius=32, fill=(10, 132, 255))
    cta = "Continue with Pro Yearly — $9.99/yr"
    cb = draw.textbbox((0, 0), cta, font=f_card_title)
    draw.text((cx - (cb[2] - cb[0]) // 2, y + 34), cta, font=f_card_title, fill=(255, 255, 255))

    # Restore + Legal disclosures
    y += 164
    restore_txt = "Restore Purchases   •   Privacy Policy   •   Terms of Use"
    rb = draw.textbbox((0, 0), restore_txt, font=load_font(32, bold=True))
    draw.text((cx - (rb[2] - rb[0]) // 2, y), restore_txt, font=load_font(32, bold=True), fill=(10, 132, 255))

    y += 66
    disc1 = "Payment is charged to your Apple Account at confirmation of purchase."
    disc2 = "Subscriptions automatically renew unless canceled at least 24 hours before period end."
    disc3 = "Manage or cancel anytime in iOS Settings > Apple Account > Subscriptions."
    for line in (disc1, disc2, disc3):
        lb = draw.textbbox((0, 0), line, font=load_font(25, bold=False))
        draw.text((cx - (lb[2] - lb[0]) // 2, y), line, font=load_font(25, bold=False), fill=(142, 142, 147))
        y += 38

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path, format="PNG")
    assert img.mode == "RGB" and img.size == (1290, 2796)
    print(f"[SHOT] Generated IAP Paywall Review Screenshot: {out_path} ({img.size}, {img.mode})")
    return out_path


def make_jwt(key_id: str, issuer_id: str, private_key_pem: str) -> str:
    now = int(time.time())
    payload = {
        "iss": issuer_id,
        "iat": now - 10,
        "exp": now + 18 * 60,
        "aud": "appstoreconnect-v1",
    }
    token = jwt.encode(payload, private_key_pem, algorithm="ES256", headers={"kid": key_id, "typ": "JWT"})
    return token if isinstance(token, str) else token.decode("utf-8")


def asc_req(method: str, url_or_path: str, token: str, **kwargs: Any) -> Dict[str, Any]:
    headers = kwargs.pop("headers", {})
    headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    url = url_or_path if url_or_path.startswith("http") else f"{ASC_V1}{url_or_path}"
    resp = requests.request(method, url, headers=headers, timeout=60, **kwargs)
    if resp.status_code >= 400:
        raise RuntimeError(f"ASC {method} {url} -> HTTP {resp.status_code}: {resp.text}")
    return resp.json() if resp.content else {}


def asc_get_all(url_or_path: str, token: str) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    next_url: Optional[str] = url_or_path
    while next_url:
        res = asc_req("GET", next_url, token)
        items.extend(res.get("data", []))
        next_url = res.get("links", {}).get("next")
    return items


def upload_review_screenshot(
    token: str,
    create_path: str,
    patch_prefix: str,
    resource_type: str,
    rel_name: str,
    parent_type: str,
    parent_id: str,
    png_path: Path,
) -> None:
    raw = png_path.read_bytes()
    md5_hex = hashlib.md5(raw).hexdigest()
    reserve = asc_req(
        "POST",
        create_path,
        token,
        json={
            "data": {
                "type": resource_type,
                "attributes": {"fileSize": len(raw), "fileName": png_path.name},
                "relationships": {rel_name: {"data": {"type": parent_type, "id": parent_id}}},
            }
        },
    )
    shot_id = reserve["data"]["id"]
    for op in reserve["data"]["attributes"].get("uploadOperations", []):
        chunk = raw[op["offset"] : op["offset"] + op["length"]]
        op_headers = {h["name"]: h["value"] for h in op.get("requestHeaders", [])}
        put_resp = requests.request(op["method"], op["url"], headers=op_headers, data=chunk, timeout=60)
        if put_resp.status_code >= 400:
            raise RuntimeError(f"Upload chunk failed ({put_resp.status_code}): {put_resp.text}")

    asc_req(
        "PATCH",
        f"{patch_prefix}/{shot_id}",
        token,
        json={
            "data": {
                "type": resource_type,
                "id": shot_id,
                "attributes": {"uploaded": True, "sourceFileChecksum": md5_hex},
            }
        },
    )
    print(f"[ASC] Uploaded {resource_type} ({shot_id}) for {parent_id}")


def cancel_active_review(token: str, app_id: str) -> None:
    subs = asc_req(
        "GET",
        f"/reviewSubmissions?filter[app]={app_id}&filter[state]=WAITING_FOR_REVIEW",
        token,
    ).get("data", [])
    for sub in subs:
        sub_id = sub["id"]
        print(f"[ASC] Canceling active WAITING_FOR_REVIEW submission {sub_id}...")
        asc_req(
            "PATCH",
            f"/reviewSubmissions/{sub_id}",
            token,
            json={
                "data": {
                    "type": "reviewSubmissions",
                    "id": sub_id,
                    "attributes": {"canceled": True},
                }
            },
        )
        time.sleep(10)
        for _ in range(15):
            st = asc_req("GET", f"/reviewSubmissions/{sub_id}", token)["data"]["attributes"]["state"]
            print(f"[ASC] Submission {sub_id} state -> {st}")
            if st != "CANCELING":
                break
            time.sleep(4)


def cleanup_legacy_credit_iaps(token: str, app_id: str) -> List[Dict[str, Any]]:
    existing = asc_get_all(f"/apps/{app_id}/inAppPurchasesV2?limit=50", token)
    kept: List[Dict[str, Any]] = []
    for iap in existing:
        pid = iap.get("attributes", {}).get("productId", "")
        if pid.startswith("com.omniconvert.credits."):
            print(f"[ASC] Deleting legacy unused consumable IAP {pid} (id={iap['id']})...")
            asc_req("DELETE", f"{ASC_V2}/inAppPurchases/{iap['id']}", token)
        else:
            kept.append(iap)
    return kept


def configure_subscription_group(token: str, app_id: str) -> str:
    groups = asc_get_all(f"/apps/{app_id}/subscriptionGroups?limit=20", token)
    group_id = None
    for g in groups:
        if g.get("attributes", {}).get("referenceName") == "OmniConvert Pro":
            group_id = g["id"]
            break
    if not group_id:
        res = asc_req(
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
        group_id = res["data"]["id"]
        print(f"[ASC] Created subscription group {group_id}")
    else:
        print(f"[ASC] Found subscription group {group_id}")

    locs = asc_get_all(f"/subscriptionGroups/{group_id}/subscriptionGroupLocalizations?limit=20", token)
    loc_map = {x["attributes"]["locale"]: x["id"] for x in locs}
    for locale, display_name in [("tr", "OmniConvert Pro"), ("en-US", "OmniConvert Pro")]:
        if locale in loc_map:
            asc_req(
                "PATCH",
                f"/subscriptionGroupLocalizations/{loc_map[locale]}",
                token,
                json={
                    "data": {
                        "type": "subscriptionGroupLocalizations",
                        "id": loc_map[locale],
                        "attributes": {"name": display_name, "customAppName": "OmniConvert"},
                    }
                },
            )
            print(f"[ASC] Updated subscriptionGroupLocalization ({locale})")
        else:
            asc_req(
                "POST",
                "/subscriptionGroupLocalizations",
                token,
                json={
                    "data": {
                        "type": "subscriptionGroupLocalizations",
                        "attributes": {
                            "locale": locale,
                            "name": display_name,
                            "customAppName": "OmniConvert",
                        },
                        "relationships": {
                            "subscriptionGroup": {"data": {"type": "subscriptionGroups", "id": group_id}}
                        },
                    }
                },
            )
            print(f"[ASC] Created subscriptionGroupLocalization ({locale})")
    return group_id


def find_usa_price_point(points: List[Dict[str, Any]], target_usd: str) -> str:
    target_val = float(target_usd)
    for pp in points:
        cp = pp.get("attributes", {}).get("customerPrice")
        if cp is not None and abs(float(cp) - target_val) < 0.005:
            return pp["id"]
    sample = sorted({pp.get("attributes", {}).get("customerPrice") for pp in points if pp.get("attributes", {}).get("customerPrice")})[:25]
    raise RuntimeError(f"USA price point ${target_usd} not found. Sample prices: {sample}")


def configure_subscription(
    token: str,
    group_id: str,
    product_id: str,
    ref_name: str,
    period: str,
    group_level: int,
    target_usd: str,
    locs_spec: Dict[str, Tuple[str, str]],
    territory_ids: List[str],
    shot_path: Path,
) -> str:
    subs = asc_get_all(f"/subscriptionGroups/{group_id}/subscriptions?limit=20", token)
    sub_obj = next((s for s in subs if s.get("attributes", {}).get("productId") == product_id), None)

    review_note = (
        "Unlocks all 100% on-device Pro tools: unlimited batch conversion, PDF merge/split/rotate/compress, "
        "Video to MP4/M4A/M4R/GIF, Apple Vision offline OCR, RAW/HEIC, and unlimited presets."
    )

    if not sub_obj:
        sub_obj = asc_req(
            "POST",
            "/subscriptions",
            token,
            json={
                "data": {
                    "type": "subscriptions",
                    "attributes": {
                        "name": ref_name,
                        "productId": product_id,
                        "subscriptionPeriod": period,
                        "groupLevel": group_level,
                        "familySharable": False,
                        "reviewNote": review_note,
                    },
                    "relationships": {"group": {"data": {"type": "subscriptionGroups", "id": group_id}}},
                }
            },
        )["data"]
        print(f"[ASC] Created subscription {product_id} (id={sub_obj['id']})")
    else:
        sub_id = sub_obj["id"]
        asc_req(
            "PATCH",
            f"/subscriptions/{sub_id}",
            token,
            json={
                "data": {
                    "type": "subscriptions",
                    "id": sub_id,
                    "attributes": {
                        "name": ref_name,
                        "groupLevel": group_level,
                        "reviewNote": review_note,
                    },
                }
            },
        )
        print(f"[ASC] Updated subscription metadata {product_id} (id={sub_id})")

    sub_id = sub_obj["id"]

    # 1. Localizations (tr & en-US)
    existing_locs = asc_get_all(f"/subscriptions/{sub_id}/subscriptionLocalizations?limit=20", token)
    loc_map = {x["attributes"]["locale"]: x["id"] for x in existing_locs}
    for locale, (disp_name, desc) in locs_spec.items():
        assert len(disp_name) <= 30, f"{disp_name} exceeds 30 chars"
        assert len(desc) <= 55, f"{desc} exceeds 55 chars"
        if locale in loc_map:
            asc_req(
                "PATCH",
                f"/subscriptionLocalizations/{loc_map[locale]}",
                token,
                json={
                    "data": {
                        "type": "subscriptionLocalizations",
                        "id": loc_map[locale],
                        "attributes": {"name": disp_name, "description": desc},
                    }
                },
            )
        else:
            asc_req(
                "POST",
                "/subscriptionLocalizations",
                token,
                json={
                    "data": {
                        "type": "subscriptionLocalizations",
                        "attributes": {"locale": locale, "name": disp_name, "description": desc},
                        "relationships": {"subscription": {"data": {"type": "subscriptions", "id": sub_id}}},
                    }
                },
            )
    print(f"[ASC] Configured localizations for {product_id}")

    # 2. Availability (all 175 territories)
    asc_req(
        "POST",
        "/subscriptionAvailabilities",
        token,
        json={
            "data": {
                "type": "subscriptionAvailabilities",
                "attributes": {"availableInNewTerritories": True},
                "relationships": {
                    "subscription": {"data": {"type": "subscriptions", "id": sub_id}},
                    "availableTerritories": {
                        "data": [{"type": "territories", "id": tid} for tid in territory_ids]
                    },
                },
            }
        },
    )
    print(f"[ASC] Set availability ({len(territory_ids)} territories) for {product_id}")

    # 3. Pricing across all territories (USA base + equalizations in single PATCH)
    existing_prices = asc_get_all(f"/subscriptions/{sub_id}/prices?limit=5", token)
    if existing_prices:
        print(f"[ASC] Prices already configured for {product_id} ({len(existing_prices)}+ rows)")
    else:
        usa_points = asc_get_all(f"/subscriptions/{sub_id}/pricePoints?filter[territory]=USA&limit=200", token)
        usa_pp_id = find_usa_price_point(usa_points, target_usd)
        print(f"[ASC] Found USA ${target_usd} pricePoint for {product_id}: {usa_pp_id}")

        eq_points = asc_get_all(f"/subscriptionPricePoints/{usa_pp_id}/equalizations?include=territory&limit=200", token)
        # Build territory -> pricePointId map (USA + equalizations)
        all_pp_entries: List[Tuple[str, str]] = [("USA", usa_pp_id)]
        seen_t = {"USA"}
        for eq in eq_points:
            t_id = eq.get("relationships", {}).get("territory", {}).get("data", {}).get("id")
            if t_id and t_id not in seen_t and t_id in set(territory_ids):
                all_pp_entries.append((t_id, eq["id"]))
                seen_t.add(t_id)

        print(f"[ASC] Applying {len(all_pp_entries)} territory prices for {product_id} via PATCH /subscriptions/{sub_id}...")
        price_refs = []
        included_prices = []
        for idx, (t_id, pp_id) in enumerate(all_pp_entries):
            temp_id = f"${{price{idx}}}"
            price_refs.append({"type": "subscriptionPrices", "id": temp_id})
            included_prices.append(
                {
                    "type": "subscriptionPrices",
                    "id": temp_id,
                    "attributes": {"startDate": None, "preserveCurrentPrice": False},
                    "relationships": {
                        "territory": {"data": {"type": "territories", "id": t_id}},
                        "subscriptionPricePoint": {"data": {"type": "subscriptionPricePoints", "id": pp_id}},
                    },
                }
            )

        asc_req(
            "PATCH",
            f"/subscriptions/{sub_id}",
            token,
            json={
                "data": {
                    "type": "subscriptions",
                    "id": sub_id,
                    "relationships": {"prices": {"data": price_refs}},
                },
                "included": included_prices,
            },
        )
        print(f"[ASC] Successfully set all {len(all_pp_entries)} territory prices for {product_id}!")

    # 4. Review Screenshot
    try:
        existing_shot = asc_req("GET", f"/subscriptions/{sub_id}/appStoreReviewScreenshot", token).get("data")
    except RuntimeError:
        existing_shot = None

    if existing_shot and existing_shot.get("attributes", {}).get("assetDeliveryState", {}).get("state") == "COMPLETE":
        print(f"[ASC] Review screenshot already COMPLETE for {product_id}")
    else:
        if existing_shot and existing_shot.get("id"):
            try:
                asc_req("DELETE", f"/subscriptionAppStoreReviewScreenshots/{existing_shot['id']}", token)
            except Exception:
                pass
        upload_review_screenshot(
            token=token,
            create_path="/subscriptionAppStoreReviewScreenshots",
            patch_prefix="/subscriptionAppStoreReviewScreenshots",
            resource_type="subscriptionAppStoreReviewScreenshots",
            rel_name="subscription",
            parent_type="subscriptions",
            parent_id=sub_id,
            png_path=shot_path,
        )

    final_state = asc_req("GET", f"/subscriptions/{sub_id}", token)["data"]["attributes"]["state"]
    print(f"[ASC] >>> Subscription {product_id} (id={sub_id}) final state = {final_state}")
    return sub_id


def configure_lifetime_iap(
    token: str,
    app_id: str,
    existing_iaps: List[Dict[str, Any]],
    territory_ids: List[str],
    shot_path: Path,
) -> str:
    pid = "com.omniconvert.pro.lifetime"
    review_note = (
        "One-time Non-Consumable purchase unlocking all 100% on-device Pro tools permanently: "
        "unlimited batch, PDF merge/split/rotate/compress, Video MP4/M4A/M4R/GIF, Apple Vision offline OCR, RAW/HEIC, and unlimited presets."
    )
    iap_obj = next((i for i in existing_iaps if i.get("attributes", {}).get("productId") == pid), None)
    if not iap_obj:
        iap_obj = asc_req(
            "POST",
            f"{ASC_V2}/inAppPurchases",
            token,
            json={
                "data": {
                    "type": "inAppPurchases",
                    "attributes": {
                        "name": "OmniConvert Pro Lifetime",
                        "productId": pid,
                        "inAppPurchaseType": "NON_CONSUMABLE",
                        "reviewNote": review_note,
                    },
                    "relationships": {"app": {"data": {"type": "apps", "id": app_id}}},
                }
            },
        )["data"]
        print(f"[ASC] Created Non-Consumable IAP {pid} (id={iap_obj['id']})")
    else:
        asc_req(
            "PATCH",
            f"{ASC_V2}/inAppPurchases/{iap_obj['id']}",
            token,
            json={
                "data": {
                    "type": "inAppPurchases",
                    "id": iap_obj["id"],
                    "attributes": {
                        "name": "OmniConvert Pro Lifetime",
                        "reviewNote": review_note,
                    },
                }
            },
        )
        print(f"[ASC] Updated Non-Consumable IAP metadata {pid} (id={iap_obj['id']})")

    iap_id = iap_obj["id"]

    # 1. Localizations (tr & en-US)
    existing_locs = asc_get_all(f"{ASC_V2}/inAppPurchases/{iap_id}/inAppPurchaseLocalizations?limit=20", token)
    loc_map = {x["attributes"]["locale"]: x["id"] for x in existing_locs}
    locs_spec = {
        "tr": ("OmniConvert Pro Ömür Boyu", "Tek seferlik ödeme ile tüm Pro araçlar sizin."),
        "en-US": ("OmniConvert Pro Lifetime", "One-time purchase unlocking all Pro tools forever."),
    }
    for locale, (disp_name, desc) in locs_spec.items():
        assert len(disp_name) <= 30
        assert len(desc) <= 55
        if locale in loc_map:
            asc_req(
                "PATCH",
                f"/inAppPurchaseLocalizations/{loc_map[locale]}",
                token,
                json={
                    "data": {
                        "type": "inAppPurchaseLocalizations",
                        "id": loc_map[locale],
                        "attributes": {"name": disp_name, "description": desc},
                    }
                },
            )
        else:
            asc_req(
                "POST",
                "/inAppPurchaseLocalizations",
                token,
                json={
                    "data": {
                        "type": "inAppPurchaseLocalizations",
                        "attributes": {"locale": locale, "name": disp_name, "description": desc},
                        "relationships": {
                            "inAppPurchaseV2": {"data": {"type": "inAppPurchases", "id": iap_id}}
                        },
                    }
                },
            )
    print(f"[ASC] Configured localizations for {pid}")

    # 2. Availability (all 175 territories)
    asc_req(
        "POST",
        "/inAppPurchaseAvailabilities",
        token,
        json={
            "data": {
                "type": "inAppPurchaseAvailabilities",
                "attributes": {"availableInNewTerritories": True},
                "relationships": {
                    "inAppPurchase": {"data": {"type": "inAppPurchases", "id": iap_id}},
                    "availableTerritories": {
                        "data": [{"type": "territories", "id": tid} for tid in territory_ids]
                    },
                },
            }
        },
    )
    print(f"[ASC] Set availability ({len(territory_ids)} territories) for {pid}")

    # 3. Price Schedule ($14.99 USA base — Apple auto-equalizes all 174 other territories)
    usa_points = asc_get_all(f"{ASC_V2}/inAppPurchases/{iap_id}/pricePoints?filter[territory]=USA&limit=200", token)
    usa_pp_id = find_usa_price_point(usa_points, "14.99")
    print(f"[ASC] Found USA $14.99 pricePoint for {pid}: {usa_pp_id}")

    asc_req(
        "POST",
        "/inAppPurchasePriceSchedules",
        token,
        json={
            "data": {
                "type": "inAppPurchasePriceSchedules",
                "relationships": {
                    "inAppPurchase": {"data": {"type": "inAppPurchases", "id": iap_id}},
                    "baseTerritory": {"data": {"type": "territories", "id": "USA"}},
                    "manualPrices": {"data": [{"type": "inAppPurchasePrices", "id": "${price1}"}]},
                },
            },
            "included": [
                {
                    "type": "inAppPurchasePrices",
                    "id": "${price1}",
                    "attributes": {"startDate": None},
                    "relationships": {
                        "inAppPurchaseV2": {"data": {"type": "inAppPurchases", "id": iap_id}},
                        "inAppPurchasePricePoint": {
                            "data": {"type": "inAppPurchasePricePoints", "id": usa_pp_id}
                        },
                    },
                }
            ],
        },
    )
    print(f"[ASC] Set $14.99 Price Schedule (auto-equalized) for {pid}")

    # 4. Review Screenshot
    try:
        existing_shot = asc_req("GET", f"{ASC_V2}/inAppPurchases/{iap_id}/appStoreReviewScreenshot", token).get("data")
    except RuntimeError:
        existing_shot = None

    if existing_shot and existing_shot.get("attributes", {}).get("assetDeliveryState", {}).get("state") == "COMPLETE":
        print(f"[ASC] Review screenshot already COMPLETE for {pid}")
    else:
        if existing_shot and existing_shot.get("id"):
            try:
                asc_req("DELETE", f"/inAppPurchaseAppStoreReviewScreenshots/{existing_shot['id']}", token)
            except Exception:
                pass
        upload_review_screenshot(
            token=token,
            create_path="/inAppPurchaseAppStoreReviewScreenshots",
            patch_prefix="/inAppPurchaseAppStoreReviewScreenshots",
            resource_type="inAppPurchaseAppStoreReviewScreenshots",
            rel_name="inAppPurchaseV2",
            parent_type="inAppPurchases",
            parent_id=iap_id,
            png_path=shot_path,
        )

    final_state = asc_req("GET", f"{ASC_V2}/inAppPurchases/{iap_id}", token)["data"]["attributes"]["state"]
    print(f"[ASC] >>> Non-Consumable IAP {pid} (id={iap_id}) final state = {final_state}")
    return iap_id


def update_app_and_version_metadata(token: str, app_id: str) -> str:
    # 1. Update App Info Localizations (subtitles)
    infos = asc_get_all(f"/apps/{app_id}/appInfos?limit=5", token)
    if infos:
        app_info_id = infos[0]["id"]
        info_locs = asc_get_all(f"/appInfos/{app_info_id}/appInfoLocalizations?limit=20", token)
        for loc in info_locs:
            locale = loc["attributes"]["locale"]
            if locale in UPDATED_METADATA:
                meta = UPDATED_METADATA[locale]
                asc_req(
                    "PATCH",
                    f"/appInfoLocalizations/{loc['id']}",
                    token,
                    json={
                        "data": {
                            "type": "appInfoLocalizations",
                            "id": loc["id"],
                            "attributes": {
                                "name": meta["name"],
                                "subtitle": meta["subtitle"],
                                "privacyPolicyUrl": PRIVACY_URL,
                            },
                        }
                    },
                )
                print(f"[ASC] Updated appInfoLocalization subtitle ({locale})")

    # 2. Update v1.0.0 App Store Version Localizations + Review Notes
    versions = asc_get_all(f"/apps/{app_id}/appStoreVersions?filter[platform]=IOS&limit=10", token)
    editable = next(
        (v for v in versions if v["attributes"]["appStoreState"] in {"PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED"}),
        None,
    )
    if not editable:
        raise RuntimeError(f"No editable iOS App Store version found. States: {[v['attributes']['appStoreState'] for v in versions]}")

    version_id = editable["id"]
    ver_locs = asc_get_all(f"/appStoreVersions/{version_id}/appStoreVersionLocalizations?limit=20", token)
    for loc in ver_locs:
        locale = loc["attributes"]["locale"]
        if locale in UPDATED_METADATA:
            meta = UPDATED_METADATA[locale]
            asc_req(
                "PATCH",
                f"/appStoreVersionLocalizations/{loc['id']}",
                token,
                json={
                    "data": {
                        "type": "appStoreVersionLocalizations",
                        "id": loc["id"],
                        "attributes": {
                            "description": meta["description"],
                            "keywords": meta["keywords"],
                            "promotionalText": meta["promotionalText"],
                            "supportUrl": SUPPORT_URL,
                        },
                    }
                },
            )
            print(f"[ASC] Updated v1.0.0 description & keywords ({locale})")

    # 3. Update App Review Detail Reviewer Notes
    detail = asc_req("GET", f"/appStoreVersions/{version_id}/appStoreReviewDetail", token).get("data")
    if detail and detail.get("id"):
        asc_req(
            "PATCH",
            f"/appStoreReviewDetails/{detail['id']}",
            token,
            json={
                "data": {
                    "type": "appStoreReviewDetails",
                    "id": detail["id"],
                    "attributes": {
                        "demoAccountRequired": False,
                        "notes": UPDATED_REVIEWER_NOTES,
                    },
                }
            },
        )
        print("[ASC] Updated App Review Reviewer Notes")

    return version_id


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--app-id", default=APP_ID_DEFAULT)
    args = parser.parse_args()

    key_id = os.environ["APP_STORE_CONNECT_KEY_ID"].strip()
    issuer_id = os.environ["APP_STORE_CONNECT_ISSUER_ID"].strip()
    private_key = os.environ["APP_STORE_CONNECT_API_KEY"].strip()
    token = make_jwt(key_id, issuer_id, private_key)

    shot_path = generate_paywall_review_screenshot(REVIEW_SHOT_PATH)

    cancel_active_review(token, args.app_id)

    territories = asc_get_all("/territories?limit=200", token)
    territory_ids = [t["id"] for t in territories]
    print(f"[ASC] Loaded {len(territory_ids)} App Store territories")

    kept_iaps = cleanup_legacy_credit_iaps(token, args.app_id)
    group_id = configure_subscription_group(token, args.app_id)

    yearly_id = configure_subscription(
        token=token,
        group_id=group_id,
        product_id="com.omniconvert.pro.yearly",
        ref_name="OmniConvert Pro Yearly",
        period="ONE_YEAR",
        group_level=1,
        target_usd="9.99",
        locs_spec={
            "tr": ("OmniConvert Pro Yıllık", "Tüm cihaz içi Pro araçlara yıllık tam erişim."),
            "en-US": ("OmniConvert Pro Yearly", "Full annual access to all on-device Pro tools."),
        },
        territory_ids=territory_ids,
        shot_path=shot_path,
    )

    monthly_id = configure_subscription(
        token=token,
        group_id=group_id,
        product_id="com.omniconvert.pro.monthly",
        ref_name="OmniConvert Pro Monthly",
        period="ONE_MONTH",
        group_level=2,
        target_usd="1.99",
        locs_spec={
            "tr": ("OmniConvert Pro Aylık", "Sınırsız toplu, PDF, video, GIF ve OCR erişimi."),
            "en-US": ("OmniConvert Pro Monthly", "Unlimited batch, PDF tools, video, GIF & offline OCR."),
        },
        territory_ids=territory_ids,
        shot_path=shot_path,
    )

    lifetime_id = configure_lifetime_iap(
        token=token,
        app_id=args.app_id,
        existing_iaps=kept_iaps,
        territory_ids=territory_ids,
        shot_path=shot_path,
    )

    version_id = update_app_and_version_metadata(token, args.app_id)

    print("\n=== SUMMARY ===")
    print(f"Version ID  : {version_id}")
    print(f"Yearly Sub  : {yearly_id}")
    print(f"Monthly Sub : {monthly_id}")
    print(f"Lifetime IAP: {lifetime_id}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"[ASC PRO IAP ERROR] {exc}", file=sys.stderr)
        sys.exit(1)
