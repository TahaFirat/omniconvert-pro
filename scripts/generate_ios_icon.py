#!/usr/bin/env python3
"""
Generates App Store compliant iOS assets for OmniConvert Pro:
- ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png
  (STRICTLY 1024x1024 RGB, NO alpha channel — mandatory for altool / App Store Connect!)
- ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732*.png
  (Branded dark obsidian launch screens)
"""

from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
APPICON_PATH = ROOT / "ios" / "App" / "App" / "Assets.xcassets" / "AppIcon.appiconset" / "AppIcon-512@2x.png"
SPLASH_DIR = ROOT / "ios" / "App" / "App" / "Assets.xcassets" / "Splash.imageset"


def draw_brand_emblem(size: int, is_splash: bool = False) -> Image.Image:
    # Draw in supersampled RGBA for crisp anti-aliased geometry, then flatten onto opaque RGB
    scale = 2 if size <= 1024 else 1
    w = size * scale
    h = size * scale

    bg = Image.new("RGB", (w, h), (11, 14, 20))
    px = bg.load()
    if not is_splash:
        # Smooth deep cobalt -> emerald-tinted obsidian vertical gradient (zero alpha!)
        for y in range(h):
            t = y / max(1, h - 1)
            r = int(13 + 12 * (1 - t))
            g = int(20 + 28 * t)
            b = int(42 + 44 * (1 - t))
            for x in range(w):
                px[x, y] = (r, g, b)

    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    cx, cy = w // 2, h // 2
    emblem_r = int(w * (0.14 if is_splash else 0.34))

    # Subtle glowing outer ring
    ring_pad = int(emblem_r * 1.18)
    draw.ellipse(
        [cx - ring_pad, cy - ring_pad, cx + ring_pad, cy + ring_pad],
        fill=(37, 99, 235, 38),
        outline=(59, 130, 246, 150),
        width=max(4, w // 128),
    )

    # Shield silhouette symbolizing 100% On-Device Privacy
    shield_top = cy - emblem_r
    shield_mid = cy + int(emblem_r * 0.12)
    shield_bot = cy + int(emblem_r * 1.05)
    shield_w = int(emblem_r * 0.86)
    shield_pts = [
        (cx, shield_top),
        (cx + shield_w, shield_top + int(emblem_r * 0.32)),
        (cx + shield_w, shield_mid),
        (cx + int(shield_w * 0.52), shield_bot - int(emblem_r * 0.25)),
        (cx, shield_bot),
        (cx - int(shield_w * 0.52), shield_bot - int(emblem_r * 0.25)),
        (cx - shield_w, shield_mid),
        (cx - shield_w, shield_top + int(emblem_r * 0.32)),
    ]
    draw.polygon(shield_pts, fill=(24, 92, 224, 245), outline=(110, 231, 183, 255))

    # Inner shield highlight
    inner_scale = 0.78
    inner_pts = [
        (int(cx + (x - cx) * inner_scale), int(cy + (y - cy) * inner_scale))
        for (x, y) in shield_pts
    ]
    draw.polygon(inner_pts, fill=(16, 185, 129, 235))

    # Crisp bidirectional conversion arrows inside the shield
    stroke = max(10, int(emblem_r * 0.13))
    arrow_w = int(emblem_r * 0.42)
    arrow_off_y = int(emblem_r * 0.18)
    head = int(emblem_r * 0.18)

    # Top arrow (->)
    y1 = cy - arrow_off_y
    draw.line([(cx - arrow_w, y1), (cx + arrow_w, y1)], fill=(255, 255, 255, 255), width=stroke)
    draw.polygon(
        [
            (cx + arrow_w + head // 2, y1),
            (cx + arrow_w - head, y1 - head),
            (cx + arrow_w - head, y1 + head),
        ],
        fill=(255, 255, 255, 255),
    )

    # Bottom arrow (<-)
    y2 = cy + arrow_off_y
    draw.line([(cx - arrow_w, y2), (cx + arrow_w, y2)], fill=(255, 255, 255, 255), width=stroke)
    draw.polygon(
        [
            (cx - arrow_w - head // 2, y2),
            (cx - arrow_w + head, y2 - head),
            (cx - arrow_w + head, y2 + head),
        ],
        fill=(255, 255, 255, 255),
    )

    composited = Image.alpha_composite(bg.convert("RGBA"), overlay).convert("RGB")
    if scale > 1:
        composited = composited.resize((size, size), Image.Resampling.LANCZOS)
    return composited


def main() -> None:
    APPICON_PATH.parent.mkdir(parents=True, exist_ok=True)
    icon = draw_brand_emblem(1024, is_splash=False)
    assert icon.mode == "RGB", f"AppIcon must be RGB without alpha, got {icon.mode}"
    assert icon.size == (1024, 1024), f"AppIcon must be 1024x1024, got {icon.size}"
    icon.save(APPICON_PATH, format="PNG", optimize=True)

    # Verify saved PNG has NO alpha channel
    with Image.open(APPICON_PATH) as check:
        assert check.mode == "RGB", f"Saved AppIcon mode is {check.mode}, expected RGB!"
        assert check.size == (1024, 1024), f"Saved AppIcon size is {check.size}!"
        print(f"OK AppIcon verified: {APPICON_PATH} ({check.size[0]}x{check.size[1]}, mode={check.mode}, alpha=False)")

    # Generate matching dark splash assets
    if SPLASH_DIR.exists():
        splash = draw_brand_emblem(1366, is_splash=True)
        for name in ("splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"):
            target = SPLASH_DIR / name
            splash.save(target, format="PNG", optimize=True)
        print(f"OK Splash assets generated in {SPLASH_DIR}")


if __name__ == "__main__":
    main()
