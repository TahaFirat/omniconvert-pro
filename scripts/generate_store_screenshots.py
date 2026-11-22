#!/usr/bin/env python3
"""
Generates App Store Connect compliant 6.7"/6.9" iPhone screenshots (1290x2796 RGB, NO alpha)
for both Turkish (store_assets/screenshots/tr/) and English (store_assets/screenshots/en/).
"""

from pathlib import Path
from typing import Tuple
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT_ROOT = ROOT / "store_assets" / "screenshots"
W, H = 1290, 2796

FONT_CANDIDATES_BOLD = [
    r"C:\Windows\Fonts\seguisb.ttf",
    r"C:\Windows\Fonts\segoeuib.ttf",
    r"C:\Windows\Fonts\arialbd.ttf",
    "/System/Library/Fonts/SFNS.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]
FONT_CANDIDATES_REG = [
    r"C:\Windows\Fonts\segoeui.ttf",
    r"C:\Windows\Fonts\arial.ttf",
    "/System/Library/Fonts/SFNS.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    for path in (FONT_CANDIDATES_BOLD if bold else FONT_CANDIDATES_REG):
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def draw_rounded(
    draw: ImageDraw.ImageDraw,
    box: Tuple[int, int, int, int],
    radius: int,
    fill: Tuple[int, int, int],
    outline: Tuple[int, int, int] | None = None,
    width: int = 2,
) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def draw_phone_shell(draw: ImageDraw.ImageDraw, top_y: int) -> Tuple[int, int, int, int]:
    pad_x = 96
    phone_box = (pad_x, top_y, W - pad_x, H - 110)
    # Titanium bezel
    draw_rounded(draw, phone_box, 128, fill=(28, 28, 32), outline=(68, 68, 74), width=5)
    # Inner OLED screen
    inner = (pad_x + 22, top_y + 22, W - pad_x - 22, H - 132)
    draw_rounded(draw, inner, 108, fill=(0, 0, 0))
    # Dynamic Island
    cx = W // 2
    draw_rounded(draw, (cx - 140, top_y + 52, cx + 140, top_y + 120), 34, fill=(14, 14, 16))
    return inner


def draw_tab_icon(draw: ImageDraw.ImageDraw, kind: int, cx: int, cy: int, color: Tuple[int, int, int]) -> None:
    if kind == 0:  # Bidirectional arrows (Convert)
        draw.line((cx - 18, cy - 8, cx + 16, cy - 8), fill=color, width=4)
        draw.line((cx + 8, cy - 16, cx + 18, cy - 8), fill=color, width=4)
        draw.line((cx + 8, cy, cx + 18, cy - 8), fill=color, width=4)
        draw.line((cx - 16, cy + 8, cx + 18, cy + 8), fill=color, width=4)
        draw.line((cx - 8, cy, cx - 18, cy + 8), fill=color, width=4)
        draw.line((cx - 8, cy + 16, cx - 18, cy + 8), fill=color, width=4)
    elif kind == 1:  # Stacked layers (Queue)
        draw.polygon([(cx, cy - 16), (cx + 20, cy - 6), (cx, cy + 4), (cx - 20, cy - 6)], outline=color, width=3)
        draw.line([(cx - 18, cy + 4), (cx, cy + 13), (cx + 18, cy + 4)], fill=color, width=3)
        draw.line([(cx - 18, cy + 12), (cx, cy + 20), (cx + 18, cy + 12)], fill=color, width=3)
    elif kind == 2:  # Clock (History)
        draw.ellipse((cx - 17, cy - 17, cx + 17, cy + 17), outline=color, width=4)
        draw.line((cx, cy - 9, cx, cy), fill=color, width=4)
        draw.line((cx, cy, cx + 8, cy + 5), fill=color, width=4)
    else:  # Sliders / Gear (Settings)
        draw.ellipse((cx - 15, cy - 15, cx + 15, cy + 15), outline=color, width=4)
        draw.ellipse((cx - 6, cy - 6, cx + 6, cy + 6), outline=color, width=3)


def draw_liquid_tab_bar(draw: ImageDraw.ImageDraw, inner: Tuple[int, int, int, int], active_idx: int, labels: Tuple[str, str, str, str]) -> None:
    ix0, _, ix1, iy1 = inner
    bar_margin = 44
    bar_h = 148
    by1 = iy1 - 54
    by0 = by1 - bar_h
    bx0 = ix0 + bar_margin
    bx1 = ix1 - bar_margin
    draw_rounded(draw, (bx0, by0, bx1, by1), 74, fill=(32, 32, 38), outline=(72, 72, 82), width=2)

    tab_w = (bx1 - bx0 - 20) // 4
    f_tab = load_font(28, bold=True)
    for i, label in enumerate(labels):
        tx0 = bx0 + 10 + i * tab_w
        tx1 = tx0 + tab_w
        if i == active_idx:
            draw_rounded(draw, (tx0 + 4, by0 + 10, tx1 - 4, by1 - 10), 62, fill=(56, 56, 64), outline=(92, 92, 104), width=2)
            color = (10, 132, 255)
        else:
            color = (142, 142, 147)
        bbox = draw.textbbox((0, 0), label, font=f_tab)
        tw = bbox[2] - bbox[0]
        draw.text((tx0 + (tab_w - tw) // 2, by0 + 86), label, font=f_tab, fill=color)
        draw_tab_icon(draw, i, (tx0 + tx1) // 2, by0 + 48, color)


def draw_screen_content(draw: ImageDraw.ImageDraw, inner: Tuple[int, int, int, int], slide_idx: int, lang: str) -> None:
    ix0, iy0, ix1, _ = inner
    x0 = ix0 + 48
    x1 = ix1 - 48
    y = iy0 + 150

    f_h1 = load_font(74, bold=True)
    f_h2 = load_font(38, bold=True)
    f_body = load_font(34, bold=False)
    f_small = load_font(29, bold=False)
    f_pill = load_font(30, bold=True)

    is_tr = lang == "tr"
    tabs = ("Dönüştür", "Kuyruk", "Geçmiş", "Ayarlar") if is_tr else ("Convert", "Queue", "History", "Settings")

    if slide_idx == 0:
        draw.text((x0, y), "Dönüştür" if is_tr else "Convert", font=f_h1, fill=(255, 255, 255))
        draw_rounded(draw, (x1 - 240, y + 12, x1, y + 84), 36, fill=(18, 52, 30), outline=(48, 209, 88), width=2)
        draw.text((x1 - 208, y + 30), "Çevrimdışı" if is_tr else "Offline", font=f_pill, fill=(92, 224, 126))
        y += 130
        draw_rounded(draw, (x0, y, x1, y + 410), 42, fill=(28, 28, 30), outline=(66, 66, 72), width=3)
        cx = (x0 + x1) // 2
        draw.ellipse((cx - 64, y + 70, cx + 64, y + 198), fill=(12, 48, 86))
        draw.text((cx - 18, y + 104), "+", font=load_font(64, bold=True), fill=(10, 132, 255))
        t_pick = "Dosya Seç" if is_tr else "Select Files"
        tb = draw.textbbox((0, 0), t_pick, font=f_h2)
        draw.text((cx - (tb[2] - tb[0]) // 2, y + 230), t_pick, font=f_h2, fill=(255, 255, 255))
        t_sub = "Fotoğraf, PDF, ses, video veya belge" if is_tr else "Photos, PDF, audio, video, or docs"
        sb = draw.textbbox((0, 0), t_sub, font=f_small)
        draw.text((cx - (sb[2] - sb[0]) // 2, y + 292), t_sub, font=f_small, fill=(142, 142, 147))

        y += 446
        col_w = (x1 - x0 - 40) // 3
        for idx, lbl in enumerate(("Galeri", "Kamera", "Pano") if is_tr else ("Photos", "Camera", "Paste")):
            cx0 = x0 + idx * (col_w + 20)
            draw_rounded(draw, (cx0, y, cx0 + col_w, y + 146), 34, fill=(28, 28, 30))
            lb = draw.textbbox((0, 0), lbl, font=f_small)
            draw.text((cx0 + (col_w - (lb[2] - lb[0])) // 2, y + 58), lbl, font=f_small, fill=(255, 255, 255))

        y += 196
        draw.text((x0 + 14, y), "HAZIR AYARLAR" if is_tr else "PRESETS", font=load_font(26, bold=True), fill=(142, 142, 147))
        y += 46
        draw_rounded(draw, (x0, y, x1, y + 480), 38, fill=(28, 28, 30))
        rows = (
            [("WhatsApp için Küçült", "Optimize JPEG • EXIF temiz"),
             ("Resmi Belge PDF", "150 DPI tek PDF • <2 MB"),
             ("Web için Optimize Et", "WebP %82 • Konum silinir")]
            if is_tr else
            [("Shrink for Messaging", "Compact JPEG • EXIF removed"),
             ("Compact Document PDF", "150 DPI single PDF • <2 MB"),
             ("Optimize for Web", "WebP 82% • GPS stripped")]
        )
        for i, (title, sub) in enumerate(rows):
            ry = y + 28 + i * 150
            draw_rounded(draw, (x0 + 30, ry + 12, x0 + 114, ry + 96), 24, fill=(12, 48, 86))
            icx, icy = x0 + 72, ry + 54
            if i == 0:
                draw_rounded(draw, (icx - 18, icy - 14, icx + 18, icy + 14), 5, fill=(12, 48, 86), outline=(10, 132, 255), width=3)
                draw.ellipse((icx - 10, icy - 8, icx - 2, icy), fill=(10, 132, 255))
            elif i == 1:
                draw_rounded(draw, (icx - 14, icy - 18, icx + 14, icy + 18), 4, fill=(12, 48, 86), outline=(10, 132, 255), width=3)
                draw.line((icx - 8, icy - 4, icx + 8, icy - 4), fill=(10, 132, 255), width=3)
                draw.line((icx - 8, icy + 6, icx + 5, icy + 6), fill=(10, 132, 255), width=3)
            else:
                draw.polygon([(icx, icy - 18), (icx + 5, icy - 5), (icx + 18, icy), (icx + 5, icy + 5), (icx, icy + 18), (icx - 5, icy + 5), (icx - 18, icy), (icx - 5, icy - 5)], fill=(10, 132, 255))
            draw.text((x0 + 144, ry + 10), title, font=f_h2, fill=(255, 255, 255))
            draw.text((x0 + 144, ry + 64), sub, font=f_small, fill=(142, 142, 147))
            if i < 2:
                draw.line((x0 + 30, ry + 136, x1 - 30, ry + 136), fill=(50, 50, 54), width=2)

        draw_liquid_tab_bar(draw, inner, 0, tabs)

    elif slide_idx == 1:
        draw.text((x0, y), "Hedef Format" if is_tr else "Target Format", font=f_h1, fill=(255, 255, 255))
        y += 116
        draw_rounded(draw, (x0, y, x1, y + 92), 28, fill=(38, 38, 42))
        draw.text((x0 + 32, y + 26), "Format ara (pdf, jpg, webp, docx...)" if is_tr else "Search format (pdf, jpg, webp...)", font=f_body, fill=(142, 142, 147))
        y += 136
        formats = [("PDF", True), ("JPG", True), ("PNG", True), ("WEBP", True), ("DOCX", False), ("GLB", False)]
        cell_w = (x1 - x0 - 40) // 3
        for i, (fmt, is_local) in enumerate(formats):
            r, c = divmod(i, 3)
            fx0 = x0 + c * (cell_w + 20)
            fy0 = y + r * 190
            selected = i == 0
            draw_rounded(
                draw,
                (fx0, fy0, fx0 + cell_w, fy0 + 164),
                32,
                fill=(14, 42, 74) if selected else (28, 28, 30),
                outline=(10, 132, 255) if selected else None,
                width=4,
            )
            draw.text((fx0 + 28, fy0 + 30), fmt, font=f_h2, fill=(255, 255, 255))
            lbl = ("Cihazda" if is_local else "Bulutta") if is_tr else ("On Device" if is_local else "Cloud")
            draw.text((fx0 + 28, fy0 + 96), lbl, font=f_small, fill=(92, 224, 126) if is_local else (158, 156, 255))

        y += 420
        draw_rounded(draw, (x0, y, x1, y + 110), 30, fill=(28, 28, 30))
        draw.text((x0 + 32, y + 34), "HEIC  →  PNG  →  PDF", font=f_h2, fill=(255, 255, 255))
        draw_rounded(draw, (x1 - 210, y + 26, x1 - 26, y + 84), 28, fill=(18, 52, 30))
        draw.text((x1 - 182, y + 38), "Cihazda" if is_tr else "On Device", font=f_small, fill=(92, 224, 126))

        y += 150
        draw_rounded(draw, (x0, y, x1, y + 220), 34, fill=(28, 28, 30))
        draw.text((x0 + 32, y + 36), "Konum ve EXIF verilerini sil" if is_tr else "Remove EXIF & Location", font=f_h2, fill=(255, 255, 255))
        draw.text((x0 + 32, y + 96), "Kamera ve GPS verilerini temizler" if is_tr else "Strips GPS and camera data", font=f_small, fill=(142, 142, 147))
        draw_rounded(draw, (x1 - 146, y + 48, x1 - 32, y + 114), 33, fill=(48, 209, 88))
        draw.ellipse((x1 - 94, y + 54, x1 - 38, y + 108), fill=(255, 255, 255))

        y += 270
        draw_rounded(draw, (x0, y, x1, y + 116), 34, fill=(10, 132, 255))
        cta = "Dönüştür" if is_tr else "Convert"
        cb = draw.textbbox((0, 0), cta, font=f_h2)
        draw.text(((x0 + x1 - (cb[2] - cb[0])) // 2, y + 34), cta, font=f_h2, fill=(255, 255, 255))

        draw_liquid_tab_bar(draw, inner, 0, tabs)

    elif slide_idx == 2:
        draw.text((x0, y), "Kuyruk" if is_tr else "Queue", font=f_h1, fill=(255, 255, 255))
        y += 126
        draw_rounded(draw, (x0, y, x1, y + 760), 38, fill=(28, 28, 30))
        items = (
            [("sozlesme_2026.pdf", "Tamamlandı • 1.2 MB", "Cihazda", True),
             ("tatil_fotografi.webp", "Tamamlandı • 410 KB", "Cihazda", True),
             ("veri_seti.yaml", "Tamamlandı • 28 KB", "Cihazda", True)]
            if is_tr else
            [("contract_2026.pdf", "Done • 1.2 MB", "On Device", True),
             ("vacation_photo.webp", "Done • 410 KB", "On Device", True),
             ("dataset.yaml", "Done • 28 KB", "On Device", True)]
        )
        for i, (fn, st, badge, _) in enumerate(items):
            ry = y + 34 + i * 240
            draw.text((x0 + 34, ry), fn, font=f_h2, fill=(255, 255, 255))
            draw.text((x0 + 34, ry + 54), st, font=f_small, fill=(142, 142, 147))
            draw_rounded(draw, (x1 - 210, ry + 6, x1 - 30, ry + 62), 28, fill=(18, 52, 30))
            draw.text((x1 - 184, ry + 17), badge, font=f_small, fill=(92, 224, 126))
            draw_rounded(draw, (x0 + 34, ry + 114, x0 + 240, ry + 184), 24, fill=(44, 44, 48))
            draw.text((x0 + 78, ry + 132), "Önizle" if is_tr else "Preview", font=f_small, fill=(255, 255, 255))
            draw_rounded(draw, (x0 + 260, ry + 114, x0 + 470, ry + 184), 24, fill=(10, 132, 255))
            draw.text((x0 + 312, ry + 132), "Paylaş" if is_tr else "Share", font=f_small, fill=(255, 255, 255))
            if i < 2:
                draw.line((x0 + 34, ry + 216, x1 - 34, ry + 216), fill=(50, 50, 54), width=2)

        draw_liquid_tab_bar(draw, inner, 1, tabs)

    else:
        draw.text((x0, y), "Ayarlar" if is_tr else "Settings", font=f_h1, fill=(255, 255, 255))
        y += 124
        draw.text((x0 + 14, y), "GİZLİLİK" if is_tr else "PRIVACY", font=load_font(26, bold=True), fill=(142, 142, 147))
        y += 44
        draw_rounded(draw, (x0, y, x1, y + 300), 38, fill=(28, 28, 30))
        draw.text((x0 + 34, y + 40), "Çevrimdışı Mod" if is_tr else "Offline Mode", font=f_h2, fill=(255, 255, 255))
        draw_rounded(draw, (x1 - 146, y + 36, x1 - 34, y + 102), 33, fill=(48, 209, 88))
        draw.ellipse((x1 - 94, y + 42, x1 - 40, y + 96), fill=(255, 255, 255))
        draw.line((x0 + 34, y + 150, x1 - 34, y + 150), fill=(50, 50, 54), width=2)
        draw.text((x0 + 34, y + 190), "EXIF ve Konum Temizle" if is_tr else "Remove EXIF & Location", font=f_h2, fill=(255, 255, 255))
        draw_rounded(draw, (x1 - 146, y + 186, x1 - 34, y + 252), 33, fill=(48, 209, 88))
        draw.ellipse((x1 - 94, y + 192, x1 - 40, y + 246), fill=(255, 255, 255))

        y += 356
        draw.text((x0 + 14, y), "ABONELİK VE KREDİLER" if is_tr else "PLAN & CREDITS", font=load_font(26, bold=True), fill=(142, 142, 147))
        y += 44
        draw_rounded(draw, (x0, y, x1, y + 300), 38, fill=(28, 28, 30))
        draw.text((x0 + 34, y + 44), "Pro ve Kredi Paketleri" if is_tr else "Pro & Credit Packs", font=f_h2, fill=(10, 132, 255))
        draw.line((x0 + 34, y + 150, x1 - 34, y + 150), fill=(50, 50, 54), width=2)
        draw.text((x0 + 34, y + 194), "Satın Alımları Geri Yükle" if is_tr else "Restore Purchases", font=f_h2, fill=(255, 255, 255))

        draw_liquid_tab_bar(draw, inner, 3, tabs)


def build_slide(headline: str, subline: str, slide_idx: int, lang: str, out_path: Path) -> None:
    img = Image.new("RGB", (W, H), (8, 10, 15))
    draw = ImageDraw.Draw(img)

    # Subtle Apple studio backdrop gradient
    for y in range(620):
        t = y / 620.0
        r = int(16 * (1 - t) + 8 * t)
        g = int(26 * (1 - t) + 10 * t)
        b = int(46 * (1 - t) + 15 * t)
        draw.line((0, y, W, y), fill=(r, g, b))

    f_title = load_font(86, bold=True)
    f_sub = load_font(44, bold=False)

    tb = draw.textbbox((0, 0), headline, font=f_title)
    draw.text(((W - (tb[2] - tb[0])) // 2, 165), headline, font=f_title, fill=(255, 255, 255))

    sb = draw.textbbox((0, 0), subline, font=f_sub)
    draw.text(((W - (sb[2] - sb[0])) // 2, 295), subline, font=f_sub, fill=(162, 168, 180))

    inner = draw_phone_shell(draw, top_y=450)
    draw_screen_content(draw, inner, slide_idx, lang)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    assert img.mode == "RGB" and img.size == (W, H)
    img.save(out_path, format="PNG", optimize=True)


def build_ipad_slide(headline: str, subline: str, slide_idx: int, lang: str, out_path: Path) -> None:
    iw, ih = 2048, 2732
    img = Image.new("RGB", (iw, ih), (8, 10, 15))
    draw = ImageDraw.Draw(img)

    for y in range(560):
        t = y / 560.0
        r = int(16 * (1 - t) + 8 * t)
        g = int(26 * (1 - t) + 10 * t)
        b = int(46 * (1 - t) + 15 * t)
        draw.line((0, y, iw, y), fill=(r, g, b))

    f_title = load_font(96, bold=True)
    f_sub = load_font(48, bold=False)
    tb = draw.textbbox((0, 0), headline, font=f_title)
    draw.text(((iw - (tb[2] - tb[0])) // 2, 130), headline, font=f_title, fill=(255, 255, 255))
    sb = draw.textbbox((0, 0), subline, font=f_sub)
    draw.text(((iw - (sb[2] - sb[0])) // 2, 265), subline, font=f_sub, fill=(162, 168, 180))

    # iPad Pro 13" bezel & centered screen
    pad_x = 180
    top_y = 390
    draw_rounded(draw, (pad_x, top_y, iw - pad_x, ih - 100), 86, fill=(28, 28, 32), outline=(68, 68, 74), width=5)
    inner = (pad_x + 28, top_y + 28, iw - pad_x - 28, ih - 128)
    draw_rounded(draw, inner, 64, fill=(0, 0, 0))
    draw_screen_content(draw, inner, slide_idx, lang)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    assert img.mode == "RGB" and img.size == (iw, ih)
    img.save(out_path, format="PNG", optimize=True)


def main() -> None:
    slides_tr = [
        ("Anında ve Gizli", "Günlük dosyalar tamamen cihazınızda dönüşür", 0),
        ("1.000+ Format", "Cihaz içi hız ve isteğe bağlı bulut desteği", 1),
        ("Toplu İş Kuyruğu", "Önizleyin, paylaşın veya tek ZIP yapın", 2),
        ("Tek Dokunuşla Çevrimdışı", "EXIF temizliği ve tam gizlilik kontrolü", 3),
    ]
    slides_en = [
        ("Fast & Private", "Everyday files convert right on your iPhone", 0),
        ("1,000+ Formats", "Instant on-device speed plus cloud formats", 1),
        ("Batch Queue", "Preview, share, or export all as a single ZIP", 2),
        ("One-Tap Offline Mode", "Automatic EXIF removal and full privacy", 3),
    ]

    for idx, (h, s, sid) in enumerate(slides_tr, start=1):
        build_slide(h, s, sid, "tr", OUT_ROOT / "tr" / f"0{idx}_omniconvert_tr.png")
        build_ipad_slide(h, s, sid, "tr", OUT_ROOT / "ipad_tr" / f"0{idx}_omniconvert_ipad_tr.png")
    for idx, (h, s, sid) in enumerate(slides_en, start=1):
        build_slide(h, s, sid, "en", OUT_ROOT / "en" / f"0{idx}_omniconvert_en.png")
        build_ipad_slide(h, s, sid, "en", OUT_ROOT / "ipad_en" / f"0{idx}_omniconvert_ipad_en.png")

    print(f"OK Generated iPhone (1290x2796) + iPad 13\" (2048x2732) RGB screenshots in {OUT_ROOT}")


if __name__ == "__main__":
    main()
