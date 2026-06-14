"""Generate app icons for Money Tracker (Apple-style mark).

A rounded-square Action-Blue tile with three ascending white bars (a compact
"dashboard / growth" glyph). Outputs favicon, Apple touch icon, and PWA icons.
Run from the web/ folder: python scripts/gen_icons.py
"""

import os
from PIL import Image, ImageDraw

BLUE = (0, 102, 204, 255)
BLUE_DARK = (0, 80, 170, 255)
WHITE = (255, 255, 255, 255)


def rounded_tile(size: int, radius_ratio: float, pad_ratio: float) -> Image.Image:
    """A rounded-square blue tile with three ascending white bars."""
    scale = 4  # supersample for smooth edges
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    radius = int(s * radius_ratio)
    # subtle vertical gradient background within the rounded mask
    bg = Image.new("RGBA", (s, s), BLUE)
    grad = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grad)
    for y in range(s):
        t = y / s
        r = int(BLUE[0] * (1 - t) + BLUE_DARK[0] * t)
        g = int(BLUE[1] * (1 - t) + BLUE_DARK[1] * t)
        b = int(BLUE[2] * (1 - t) + BLUE_DARK[2] * t)
        gd.line([(0, y), (s, y)], fill=(r, g, b, 255))
    mask = Image.new("L", (s, s), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, s - 1, s - 1], radius=radius, fill=255)
    img.paste(grad, (0, 0), mask)

    # three ascending bars centered in a safe area
    pad = int(s * pad_ratio)
    area = s - 2 * pad
    bar_w = int(area * 0.20)
    gap = int((area - 3 * bar_w) / 2)
    heights = [0.45, 0.70, 1.0]
    base_y = pad + area
    bar_r = int(bar_w * 0.35)
    for i, h in enumerate(heights):
        x0 = pad + i * (bar_w + gap)
        x1 = x0 + bar_w
        bh = int(area * h)
        y0 = base_y - bh
        d.rounded_rectangle([x0, y0, x1, base_y], radius=bar_r, fill=WHITE)

    return img.resize((size, size), Image.LANCZOS)


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    web = os.path.dirname(here)
    public = os.path.join(web, "public")
    app = os.path.join(web, "src", "app")
    os.makedirs(public, exist_ok=True)

    # Standard tiles (rounded, normal padding)
    tile_256 = rounded_tile(256, 0.22, 0.22)
    tile_180 = rounded_tile(180, 0.22, 0.22)
    tile_192 = rounded_tile(192, 0.22, 0.22)
    tile_512 = rounded_tile(512, 0.22, 0.22)
    # Maskable: full-bleed square bg, glyph in inner safe zone (more padding)
    maskable_512 = rounded_tile(512, 0.001, 0.30)
    fav_32 = rounded_tile(32, 0.25, 0.20)

    tile_256.save(os.path.join(app, "icon.png"))
    tile_180.save(os.path.join(app, "apple-icon.png"))
    tile_192.save(os.path.join(public, "icon-192.png"))
    tile_512.save(os.path.join(public, "icon-512.png"))
    maskable_512.save(os.path.join(public, "icon-maskable-512.png"))
    fav_32.save(os.path.join(public, "favicon-32.png"))
    print("Wrote icons to public/ and src/app/")


if __name__ == "__main__":
    main()
