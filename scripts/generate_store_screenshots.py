#!/usr/bin/env python3
"""
Generates high-craft vibrant pastel-banner App Store screenshots (Apple 2026 top-chart style):
  - iPhone 6.7"/6.9": 1290x2796 RGB, zero alpha (store_assets/screenshots/{tr,en}/)
  - iPad Pro 13":     2048x2732 RGB, zero alpha (store_assets/screenshots/{ipad_tr,ipad_en}/)
Accurately showcases the real 100% on-device OmniConvert UI (Guided Tool Grid, PDF Merge & Reorder,
Multi-Page PDF Preview with Before/After size savings, and iOS 27 Liquid Glass Tab Bar).
"""

from pathlib import Path
from typing import Tuple
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT_ROOT = ROOT / "store_assets" / "screenshots"
W, H = 1290, 2796

FONT_BOLD = [
    r"C:\Windows\Fonts\segoeuib.ttf",
    r"C:\Windows\Fonts\seguisb.ttf",
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

# Modern vibrant pastel backdrops matching high-converting App Store charts
BACKDROPS = [
    (137, 212, 255),  # Slide 1: Sky Blue
    (255, 200, 221),  # Slide 2: Blush Rose
    (255, 190, 118),  # Slide 3: Soft Apricot
    (160, 240, 210),  # Slide 4: Fresh Mint
]


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    for path in (FONT_BOLD if bold else FONT_REG):
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
    pad_x = 92
    # Subtle soft drop shadow below phone
    draw_rounded(draw, (pad_x + 12, top_y + 18, W - pad_x + 12, H - 72), 132, fill=(32, 36, 44))
    phone_box = (pad_x, top_y, W - pad_x, H - 90)
    draw_rounded(draw, phone_box, 128, fill=(26, 26, 30), outline=(72, 72, 78), width=5)
    inner = (pad_x + 22, top_y + 22, W - pad_x - 22, H - 112)
    draw_rounded(draw, inner, 108, fill=(9, 9, 11))
    # Dynamic Island + Status bar time
    cx = W // 2
    draw_rounded(draw, (cx - 140, top_y + 52, cx + 140, top_y + 118), 33, fill=(0, 0, 0))
    draw.text((inner[0] + 62, top_y + 62), "9:41", font=load_font(34, bold=True), fill=(250, 250, 250))
    return inner


def draw_tab_glyph(draw: ImageDraw.ImageDraw, idx: int, cx: int, cy: int, color: Tuple[int, int, int]) -> None:
    if idx == 0:  # Bidirectional arrows
        draw.line((cx - 16, cy - 7, cx + 14, cy - 7), fill=color, width=4)
        draw.line((cx + 7, cy - 14, cx + 16, cy - 7), fill=color, width=4)
        draw.line((cx + 7, cy, cx + 16, cy - 7), fill=color, width=4)
        draw.line((cx - 14, cy + 7, cx + 16, cy + 7), fill=color, width=4)
        draw.line((cx - 7, cy, cx - 16, cy + 7), fill=color, width=4)
        draw.line((cx - 7, cy + 14, cx - 16, cy + 7), fill=color, width=4)
    elif idx == 1:  # Layers
        draw.polygon([(cx, cy - 14), (cx + 18, cy - 5), (cx, cy + 4), (cx - 18, cy - 5)], outline=color, width=3)
        draw.line([(cx - 16, cy + 5), (cx, cy + 12), (cx + 16, cy + 5)], fill=color, width=3)
        draw.line([(cx - 16, cy + 12), (cx, cy + 19), (cx + 16, cy + 12)], fill=color, width=3)
    elif idx == 2:  # Clock
        draw.ellipse((cx - 15, cy - 15, cx + 15, cy + 15), outline=color, width=4)
        draw.line((cx, cy - 8, cx, cy), fill=color, width=4)
        draw.line((cx, cy, cx + 7, cy + 4), fill=color, width=4)
    else:  # Gear
        draw.ellipse((cx - 14, cy - 14, cx + 14, cy + 14), outline=color, width=4)
        draw.ellipse((cx - 5, cy - 5, cx + 5, cy + 5), outline=color, width=3)


def draw_tool_glyph(draw: ImageDraw.ImageDraw, idx: int, cx: int, cy: int, color: Tuple[int, int, int]) -> None:
    if idx == 0:  # Stacked PDF layers
        draw.polygon([(cx, cy - 14), (cx + 18, cy - 5), (cx, cy + 4), (cx - 18, cy - 5)], outline=color, width=4)
        draw.line([(cx - 17, cy + 5), (cx, cy + 13), (cx + 17, cy + 5)], fill=color, width=4)
    elif idx == 1:  # Document
        draw.rounded_rectangle((cx - 13, cy - 16, cx + 13, cy + 16), radius=4, outline=color, width=4)
        draw.line((cx - 7, cy - 4, cx + 7, cy - 4), fill=color, width=3)
        draw.line((cx - 7, cy + 4, cx + 4, cy + 4), fill=color, width=3)
    elif idx == 2:  # Split / scissors lines
        draw.ellipse((cx - 15, cy + 3, cx - 3, cy + 15), outline=color, width=3)
        draw.ellipse((cx + 3, cy + 3, cx + 15, cy + 15), outline=color, width=3)
        draw.line((cx - 5, cy + 5, cx + 11, cy - 14), fill=color, width=4)
        draw.line((cx + 5, cy + 5, cx - 11, cy - 14), fill=color, width=4)
    elif idx == 3:  # Image mountain
        draw.rounded_rectangle((cx - 16, cy - 13, cx + 16, cy + 13), radius=5, outline=color, width=4)
        draw.polygon([(cx - 12, cy + 10), (cx - 2, cy - 2), (cx + 6, cy + 6), (cx + 10, cy + 2), (cx + 14, cy + 10)], fill=color)
    elif idx == 4:  # Music note
        draw.line((cx - 4, cy + 10, cx - 4, cy - 12), fill=color, width=4)
        draw.line((cx - 4, cy - 12, cx + 12, cy - 15), fill=color, width=4)
        draw.line((cx + 12, cy - 15, cx + 12, cy + 7), fill=color, width=4)
        draw.ellipse((cx - 12, cy + 5, cx - 2, cy + 14), fill=color)
        draw.ellipse((cx + 4, cy + 2, cx + 14, cy + 11), fill=color)
    else:  # OCR scan frame
        for dx, dy in [(-14, -14), (14, -14), (-14, 14), (14, 14)]:
            sx = 8 if dx < 0 else -8
            sy = 8 if dy < 0 else -8
            draw.line((cx + dx, cy + dy, cx + dx + sx, cy + dy), fill=color, width=4)
            draw.line((cx + dx, cy + dy, cx + dx, cy + dy + sy), fill=color, width=4)
        draw.line((cx - 8, cy, cx + 8, cy), fill=color, width=4)


def draw_liquid_tab_bar(
    draw: ImageDraw.ImageDraw,
    inner: Tuple[int, int, int, int],
    active_idx: int,
    labels: Tuple[str, str, str, str],
) -> None:
    ix0, _, ix1, iy1 = inner
    bar_margin = 44
    bar_h = 140
    by1 = iy1 - 46
    by0 = by1 - bar_h
    bx0 = ix0 + bar_margin
    bx1 = ix1 - bar_margin
    draw_rounded(draw, (bx0, by0, bx1, by1), 70, fill=(34, 34, 40), outline=(82, 82, 92), width=2)

    tab_w = (bx1 - bx0 - 20) // 4
    f_tab = load_font(27, bold=True)
    for i, label in enumerate(labels):
        tx0 = bx0 + 10 + i * tab_w
        tx1 = tx0 + tab_w
        if i == active_idx:
            draw_rounded(draw, (tx0 + 4, by0 + 10, tx1 - 4, by1 - 10), 58, fill=(58, 58, 68), outline=(96, 96, 108), width=2)
            color = (10, 132, 255)
        else:
            color = (161, 161, 170)
        cx_t = (tx0 + tx1) // 2
        draw_tab_glyph(draw, i, cx_t, by0 + 44, color)
        bbox = draw.textbbox((0, 0), label, font=f_tab)
        tw = bbox[2] - bbox[0]
        draw.text((tx0 + (tab_w - tw) // 2, by0 + 78), label, font=f_tab, fill=color)


def draw_screen_content(draw: ImageDraw.ImageDraw, inner: Tuple[int, int, int, int], slide_idx: int, lang: str) -> None:
    ix0, iy0, ix1, iy1 = inner
    x0 = ix0 + 48
    x1 = ix1 - 48
    y = iy0 + 148
    is_tr = lang == "tr"

    f_h1 = load_font(62, bold=True)
    f_h2 = load_font(36, bold=True)
    f_body = load_font(30, bold=False)
    f_small = load_font(26, bold=False)
    f_pill = load_font(28, bold=True)
    tabs = ("Araçlar", "İşlemler", "Geçmiş", "Ayarlar") if is_tr else ("Tools", "Tasks", "History", "Settings")

    if slide_idx == 0:
        # Slide 1: Zero-Confusion Guided Tools Home Screen
        draw.text((x0, y), "Araçlar" if is_tr else "Tools", font=f_h1, fill=(250, 250, 250))
        draw_rounded(draw, (x1 - 240, y + 10, x1, y + 74), 32, fill=(22, 62, 38), outline=(48, 209, 88), width=2)
        p_txt = "Çevrimdışı" if is_tr else "Offline"
        pb = draw.textbbox((0, 0), p_txt, font=f_pill)
        draw.text((x1 - 120 - (pb[2] - pb[0]) // 2, y + 25), p_txt, font=f_pill, fill=(92, 224, 126))
        y += 112

        # Universal Picker Card
        draw_rounded(draw, (x0, y, x1, y + 185), 36, fill=(24, 24, 27), outline=(64, 64, 72), width=2)
        draw_rounded(draw, (x0 + 34, y + 42, x0 + 134, y + 142), 28, fill=(18, 46, 78))
        draw.text((x0 + 66, y + 60), "+", font=load_font(56, bold=True), fill=(10, 132, 255))
        draw.text((x0 + 162, y + 48), "Herhangi Bir Dosya Seç" if is_tr else "Pick Any File", font=f_h2, fill=(250, 250, 250))
        draw.text((x0 + 162, y + 102), "PDF, fotoğraf, Word, video, ZIP" if is_tr else "PDF, photo, Word, video, ZIP", font=f_small, fill=(161, 161, 170))
        y += 216

        # Category pills
        cats = ("Tümü", "PDF", "Görsel", "Video") if is_tr else ("All", "PDF", "Images", "Video")
        px = x0
        for ci, c_txt in enumerate(cats):
            cw = 175
            bg = (10, 132, 255) if ci == 0 else (24, 24, 27)
            fg = (255, 255, 255) if ci == 0 else (212, 212, 216)
            draw_rounded(draw, (px, y, px + cw, y + 70), 35, fill=bg, outline=(52, 52, 60) if ci > 0 else None, width=2)
            cb = draw.textbbox((0, 0), c_txt, font=f_pill)
            draw.text((px + (cw - (cb[2] - cb[0])) // 2, y + 18), c_txt, font=f_pill, fill=fg)
            px += cw + 18
        y += 102

        # 2-Column Color-Coded Tool Grid
        tools = (
            [
                ("PDF Birleştir", "Çoklu PDF tek belge", (255, 69, 58), (64, 24, 24)),
                ("Fotoğraf → PDF", "Sırayla temiz PDF", (255, 159, 10), (64, 44, 16)),
                ("PDF Böl & Döndür", "Sayfa seç, küçült", (191, 90, 242), (52, 26, 68)),
                ("Görsel Dönüştür", "HEIC, JPG, PNG, RAW", (10, 132, 255), (16, 44, 78)),
                ("Video → Ses / Zil", "M4A, WAV, 30s M4R", (255, 55, 95), (68, 22, 36)),
                ("Metin Çıkar (OCR)", "Çevrimdışı Apple Vision", (48, 209, 88), (20, 58, 34)),
            ]
            if is_tr
            else [
                ("Merge PDF", "Combine PDFs in order", (255, 69, 58), (64, 24, 24)),
                ("Photos → PDF", "Clean single PDF", (255, 159, 10), (64, 44, 16)),
                ("Split & Rotate", "Extract & compress", (191, 90, 242), (52, 26, 68)),
                ("Image Converter", "HEIC, JPG, PNG, RAW", (10, 132, 255), (16, 44, 78)),
                ("Video to Audio", "M4A, WAV, 30s M4R", (255, 55, 95), (68, 22, 36)),
                ("Offline OCR", "Apple Vision text scan", (48, 209, 88), (20, 58, 34)),
            ]
        )
        col_w = (x1 - x0 - 24) // 2
        card_h = 248
        for idx_t, (t_title, t_sub, fg, bg) in enumerate(tools):
            col = idx_t % 2
            row = idx_t // 2
            cx0 = x0 + col * (col_w + 24)
            cy0 = y + row * (card_h + 22)
            draw_rounded(draw, (cx0, cy0, cx0 + col_w, cy0 + card_h), 34, fill=(24, 24, 27), outline=(50, 50, 58), width=2)
            draw_rounded(draw, (cx0 + 28, cy0 + 28, cx0 + 104, cy0 + 104), 22, fill=bg)
            draw_tool_glyph(draw, idx_t, cx0 + 66, cy0 + 66, fg)
            draw.text((cx0 + 28, cy0 + 126), t_title, font=load_font(33, bold=True), fill=(250, 250, 250))
            draw.text((cx0 + 28, cy0 + 174), t_sub, font=f_small, fill=(161, 161, 170))

        draw_liquid_tab_bar(draw, inner, 0, tabs)

    elif slide_idx == 1:
        # Slide 2: Guided PDF Merge & Reorder Workspace
        draw.text((x0, y), "PDF Birleştir" if is_tr else "Merge PDF", font=f_h1, fill=(250, 250, 250))
        y += 90
        draw.text((x0, y), "Sırayı ayarla, önizle ve tek dokunuşla birleştir" if is_tr else "Reorder pages, preview, and merge in one tap", font=f_small, fill=(161, 161, 170))
        y += 76

        files = [
            ("1", "Sozlesme_2026.pdf", "4 sayfa • 1.8 MB" if is_tr else "4 pages • 1.8 MB"),
            ("2", "Kimlik_Tarama.jpg", "1 sayfa • 840 KB" if is_tr else "1 page • 840 KB"),
            ("3", "Ek_Belge.pdf", "3 sayfa • 1.2 MB" if is_tr else "3 pages • 1.2 MB"),
        ]
        draw_rounded(draw, (x0, y, x1, y + 610), 38, fill=(24, 24, 27), outline=(52, 52, 60), width=2)
        for i, (num, fname, meta) in enumerate(files):
            ry = y + i * 202
            draw.ellipse((x0 + 32, ry + 66, x0 + 96, ry + 130), fill=(18, 46, 78))
            draw.text((x0 + 54, ry + 78), num, font=f_h2, fill=(10, 132, 255))
            draw.text((x0 + 124, ry + 54), fname, font=f_h2, fill=(250, 250, 250))
            draw.text((x0 + 124, ry + 106), meta, font=f_small, fill=(161, 161, 170))
            # Reorder up/down pill visual
            draw_rounded(draw, (x1 - 154, ry + 66, x1 - 94, ry + 126), 30, fill=(42, 42, 48))
            draw.text((x1 - 135, ry + 74), "^", font=f_h2, fill=(220, 220, 226))
            draw_rounded(draw, (x1 - 82, ry + 66, x1 - 22, ry + 126), 30, fill=(42, 42, 48))
            draw.text((x1 - 63, ry + 74), "v", font=f_h2, fill=(220, 220, 226))
            if i < 2:
                draw.line((x0 + 32, ry + 200, x1 - 32, ry + 200), fill=(48, 48, 54), width=2)

        y += 660
        draw_rounded(draw, (x0, y, x1, y + 126), 34, fill=(24, 24, 27), outline=(52, 52, 60), width=2)
        draw.text((x0 + 34, y + 40), "Toplam: 3 Dosya • 8 Sayfa" if is_tr else "Total: 3 Files • 8 Pages", font=f_h2, fill=(250, 250, 250))
        draw_rounded(draw, (x1 - 210, y + 32, x1 - 28, y + 94), 31, fill=(22, 62, 38))
        draw.text((x1 - 178, y + 45), "Cihazda" if is_tr else "On Device", font=f_pill, fill=(92, 224, 126))

        y += 176
        draw_rounded(draw, (x0, y, x1, y + 132), 36, fill=(10, 132, 255))
        cta = "3 Dosyayı Tek PDF Yap" if is_tr else "Merge 3 Files into PDF"
        cb = draw.textbbox((0, 0), cta, font=load_font(40, bold=True))
        draw.text(((x0 + x1 - (cb[2] - cb[0])) // 2, y + 42), cta, font=load_font(40, bold=True), fill=(255, 255, 255))

        draw_liquid_tab_bar(draw, inner, 0, tabs)

    elif slide_idx == 2:
        # Slide 3: Multi-Page Live PDF Preview + Size Savings
        draw.text((x0, y), "Önizleme" if is_tr else "Preview", font=f_h1, fill=(250, 250, 250))
        y += 88
        draw.text((x0, y), "birlesik_belge.pdf • 1.2 MB", font=f_small, fill=(161, 161, 170))
        y += 56
        draw_rounded(draw, (x0, y, x0 + 470, y + 66), 33, fill=(22, 62, 38), outline=(48, 209, 88), width=2)
        draw.text((x0 + 28, y + 16), "3.8 MB → 1.2 MB (-%68)" if is_tr else "3.8 MB → 1.2 MB (-68%)", font=f_pill, fill=(92, 224, 126))
        y += 98

        # Page & Zoom Bar
        draw_rounded(draw, (x0, y, x1, y + 96), 28, fill=(28, 28, 32), outline=(54, 54, 62), width=2)
        draw.text((x0 + 36, y + 28), "<   " + ("Sayfa 2 / 8" if is_tr else "Page 2 / 8") + "   >", font=f_h2, fill=(250, 250, 250))
        draw.text((x1 - 220, y + 28), "-  100%  +", font=f_h2, fill=(161, 161, 170))
        y += 126

        # Crisp White PDF Document Page Mockup
        draw_rounded(draw, (x0 + 26, y, x1 - 26, y + 760), 22, fill=(252, 252, 254))
        draw_rounded(draw, (x0 + 76, y + 54, x1 - 76, y + 158), 16, fill=(10, 132, 255))
        draw.text((x0 + 110, y + 84), "OMNICONVERT PRO PDF", font=f_h2, fill=(255, 255, 255))
        for line_i in range(9):
            ly = y + 216 + line_i * 52
            lw = (x1 - x0 - 200) if line_i % 3 != 2 else (x1 - x0 - 380)
            draw_rounded(draw, (x0 + 76, ly, x0 + 76 + lw, ly + 22), 10, fill=(214, 218, 226))

        y += 806
        btn_w = (x1 - x0 - 22) // 2
        draw_rounded(draw, (x0, y, x0 + btn_w, y + 116), 32, fill=(10, 132, 255))
        s1 = "Paylaş" if is_tr else "Share"
        sb1 = draw.textbbox((0, 0), s1, font=f_h2)
        draw.text((x0 + (btn_w - (sb1[2] - sb1[0])) // 2, y + 36), s1, font=f_h2, fill=(255, 255, 255))

        draw_rounded(draw, (x0 + btn_w + 22, y, x1, y + 116), 32, fill=(38, 38, 44))
        s2 = "Kaydet" if is_tr else "Save"
        sb2 = draw.textbbox((0, 0), s2, font=f_h2)
        draw.text((x0 + btn_w + 22 + (btn_w - (sb2[2] - sb2[0])) // 2, y + 36), s2, font=f_h2, fill=(250, 250, 250))

        draw_liquid_tab_bar(draw, inner, 1, tabs)

    else:
        # Slide 4: Privacy, Offline Mode & Fair Pro Plan
        draw.text((x0, y), "Ayarlar" if is_tr else "Settings", font=f_h1, fill=(250, 250, 250))
        y += 116
        draw.text((x0 + 14, y), "GİZLİLİK" if is_tr else "PRIVACY", font=load_font(26, bold=True), fill=(161, 161, 170))
        y += 46
        draw_rounded(draw, (x0, y, x1, y + 304), 36, fill=(24, 24, 27), outline=(52, 52, 60), width=2)
        draw.text((x0 + 34, y + 42), "Çevrimdışı Mod" if is_tr else "Offline Mode", font=f_h2, fill=(250, 250, 250))
        draw_rounded(draw, (x1 - 144, y + 36, x1 - 32, y + 102), 33, fill=(48, 209, 88))
        draw.ellipse((x1 - 92, y + 42, x1 - 38, y + 96), fill=(255, 255, 255))
        draw.line((x0 + 34, y + 152, x1 - 34, y + 152), fill=(50, 50, 56), width=2)
        draw.text((x0 + 34, y + 194), "EXIF & Konum Sil" if is_tr else "Strip EXIF & GPS", font=f_h2, fill=(250, 250, 250))
        draw_rounded(draw, (x1 - 144, y + 188, x1 - 32, y + 254), 33, fill=(48, 209, 88))
        draw.ellipse((x1 - 92, y + 194, x1 - 38, y + 248), fill=(255, 255, 255))

        y += 362
        draw.text((x0 + 14, y), "OMNICONVERT PRO", font=load_font(26, bold=True), fill=(161, 161, 170))
        y += 46
        draw_rounded(draw, (x0, y, x1, y + 440), 36, fill=(24, 24, 27), outline=(52, 52, 60), width=2)
        rows = (
            [
                ("Temel Dönüşümler", "Her Zaman Ücretsiz", (92, 224, 126)),
                ("Yıllık / Ömür Boyu Pro", "Reklamsız Tam Erişim", (10, 132, 255)),
                ("Satın Alımları Geri Yükle", "StoreKit 2", (212, 212, 216)),
            ]
            if is_tr
            else [
                ("Everyday Conversions", "Always Free", (92, 224, 126)),
                ("Yearly / Lifetime Pro", "Ad-Free Full Access", (10, 132, 255)),
                ("Restore Purchases", "StoreKit 2", (212, 212, 216)),
            ]
        )
        for ri, (r_l, r_r, r_col) in enumerate(rows):
            ry = y + ri * 146
            draw.text((x0 + 34, ry + 50), r_l, font=f_h2, fill=(250, 250, 250))
            rb = draw.textbbox((0, 0), r_r, font=f_small)
            draw.text((x1 - 34 - (rb[2] - rb[0]), ry + 56), r_r, font=f_small, fill=r_col)
            if ri < 2:
                draw.line((x0 + 34, ry + 145, x1 - 34, ry + 145), fill=(50, 50, 56), width=2)

        draw_liquid_tab_bar(draw, inner, 3, tabs)


def build_slide(line1: str, line2: str, slide_idx: int, lang: str, out_path: Path) -> None:
    bg = BACKDROPS[slide_idx % len(BACKDROPS)]
    img = Image.new("RGB", (W, H), bg)
    draw = ImageDraw.Draw(img)

    f_title = load_font(94, bold=True)
    b1 = draw.textbbox((0, 0), line1, font=f_title)
    draw.text(((W - (b1[2] - b1[0])) // 2, 120), line1, font=f_title, fill=(14, 14, 18))
    b2 = draw.textbbox((0, 0), line2, font=f_title)
    draw.text(((W - (b2[2] - b2[0])) // 2, 232), line2, font=f_title, fill=(14, 14, 18))

    inner = draw_phone_shell(draw, top_y=404)
    draw_screen_content(draw, inner, slide_idx, lang)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    assert img.mode == "RGB" and img.size == (W, H)
    img.save(out_path, format="PNG", optimize=True)


def build_ipad_slide(line1: str, line2: str, slide_idx: int, lang: str, out_path: Path) -> None:
    iw, ih = 2048, 2732
    bg = BACKDROPS[slide_idx % len(BACKDROPS)]
    img = Image.new("RGB", (iw, ih), bg)
    draw = ImageDraw.Draw(img)

    f_title = load_font(104, bold=True)
    title_full = f"{line1} {line2}"
    tb = draw.textbbox((0, 0), title_full, font=f_title)
    if tb[2] - tb[0] <= iw - 180:
        draw.text(((iw - (tb[2] - tb[0])) // 2, 138), title_full, font=f_title, fill=(14, 14, 18))
    else:
        b1 = draw.textbbox((0, 0), line1, font=f_title)
        draw.text(((iw - (b1[2] - b1[0])) // 2, 86), line1, font=f_title, fill=(14, 14, 18))
        b2 = draw.textbbox((0, 0), line2, font=f_title)
        draw.text(((iw - (b2[2] - b2[0])) // 2, 204), line2, font=f_title, fill=(14, 14, 18))

    pad_x = 180
    top_y = 370
    draw_rounded(draw, (pad_x + 12, top_y + 18, iw - pad_x + 12, ih - 86), 88, fill=(32, 36, 44))
    draw_rounded(draw, (pad_x, top_y, iw - pad_x, ih - 104), 86, fill=(26, 26, 30), outline=(72, 72, 78), width=5)
    inner = (pad_x + 28, top_y + 28, iw - pad_x - 28, ih - 132)
    draw_rounded(draw, inner, 64, fill=(9, 9, 11))
    draw_screen_content(draw, inner, slide_idx, lang)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    assert img.mode == "RGB" and img.size == (iw, ih)
    img.save(out_path, format="PNG", optimize=True)


def main() -> None:
    slides_tr = [
        ("Her Dosya İçin", "Tek Sade Uygulama", 0),
        ("PDF Birleştir,", "Sırala ve Küçült", 1),
        ("Canlı Önizle ve", "Anında Paylaş", 2),
        ("%100 Cihaz İçi", "Reklamsız Gizlilik", 3),
    ]
    slides_en = [
        ("Every File Tool", "In One Clean App", 0),
        ("Merge, Split &", "Reorder PDFs Fast", 1),
        ("Live Preview &", "Size Savings", 2),
        ("100% On-Device", "Ad-Free Privacy", 3),
    ]

    for idx, (l1, l2, sid) in enumerate(slides_tr, start=1):
        build_slide(l1, l2, sid, "tr", OUT_ROOT / "tr" / f"0{idx}_omniconvert_tr.png")
        build_ipad_slide(l1, l2, sid, "tr", OUT_ROOT / "ipad_tr" / f"0{idx}_omniconvert_ipad_tr.png")
    for idx, (l1, l2, sid) in enumerate(slides_en, start=1):
        build_slide(l1, l2, sid, "en", OUT_ROOT / "en" / f"0{idx}_omniconvert_en.png")
        build_ipad_slide(l1, l2, sid, "en", OUT_ROOT / "ipad_en" / f"0{idx}_omniconvert_ipad_en.png")

    print(f"OK Generated refreshed vibrant iPhone + iPad RGB screenshots in {OUT_ROOT}")


if __name__ == "__main__":
    main()
