#!/usr/bin/env python3
"""Procedural PNG kit for the three Douyin-style games. No downloaded art.

    python3 tools/gen_three_assets.py
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets"

DUCKS = [
    (77, 150, 255),
    (179, 136, 255),
    (255, 159, 28),
    (255, 77, 109),
    (255, 230, 109),
    (46, 196, 182),
    (255, 112, 166),
    (244, 247, 251),
    (112, 224, 0),
    (43, 45, 66),
]


def save(im: Image.Image, rel: str) -> None:
    path = OUT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "PNG", optimize=True)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def ellipse(draw, box, fill, outline=None, width=1):
    draw.ellipse(box, fill=fill, outline=outline, width=width)


def down(im, w, h):
    return im.resize((w, h), Image.Resampling.LANCZOS)


def duck_sprite(rgb, size=160):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    body = rgb + (255,)
    dark = lerp(rgb, (40, 20, 10), 0.28) + (255,)
    ellipse(d, (18, 58, 118, 142), dark)
    ellipse(d, (22, 48, 122, 132), body)
    ellipse(d, (40, 62, 78, 92), lerp(rgb, (255, 255, 255), 0.35) + (230,))
    ellipse(d, (78, 28, 138, 92), (255, 255, 255, 255))
    ellipse(d, (108, 46, 122, 60), (40, 32, 28, 255))
    ellipse(d, (112, 48, 118, 54), (255, 255, 255, 255))
    d.polygon([(128, 58), (156, 70), (128, 80)], fill=(255, 159, 28, 255))
    d.pieslice((8, 78, 58, 128), 200, 20, fill=lerp(rgb, (255, 255, 255), 0.15) + (255,))
    return im


def icon_shovel():
    im = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.polygon([(78, 10), (96, 28), (40, 92), (24, 76)], fill=(196, 140, 72, 255))
    d.rounded_rectangle((18, 70, 62, 118), 16, fill=(176, 190, 204, 255), outline=(90, 104, 120, 255), width=3)
    d.polygon([(28, 78), (52, 78), (40, 108)], fill=(120, 138, 156, 255))
    return im


def icon_rainbow():
    im = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    colors = [(255, 107, 107), (255, 209, 102), (110, 203, 119), (77, 171, 247), (177, 151, 252)]
    for i, c in enumerate(colors):
        box = (16 + i * 6, 16 + i * 6, 112 - i * 6, 112 - i * 6)
        d.arc(box, 200, 340, fill=c + (255,), width=8)
    ellipse(d, (50, 62, 78, 90), (255, 255, 255, 255))
    return im


def icon_magnet():
    im = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.arc((24, 16, 104, 100), 180, 360, fill=(220, 50, 60, 255), width=22)
    d.rounded_rectangle((20, 58, 42, 112), 6, fill=(230, 236, 242, 255), outline=(90, 100, 120, 255), width=3)
    d.rounded_rectangle((86, 58, 108, 112), 6, fill=(230, 236, 242, 255), outline=(90, 100, 120, 255), width=3)
    return im


def soldier(frame, size=(96, 128)):
    w, h = 192, 256
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    spread = 18 if frame == 0 else 4
    d.rounded_rectangle((70, 168, 92, 230), 8, fill=(32, 36, 48, 255))
    d.rounded_rectangle((100, 168 + spread, 122, 230), 8, fill=(32, 36, 48, 255))
    d.ellipse((78, 214, 100, 232), fill=(20, 20, 24, 255))
    d.ellipse((104, 214 + spread, 126, 232), fill=(20, 20, 24, 255))
    d.rounded_rectangle((62, 78, 130, 176), 18, fill=(37, 99, 196, 255))
    d.rounded_rectangle((74, 92, 118, 150), 12, fill=(23, 70, 140, 255))
    d.ellipse((78, 28, 122, 78), fill=(242, 205, 170, 255))
    d.rounded_rectangle((70, 22, 130, 48), 10, fill=(30, 58, 110, 255))
    d.polygon([(130, 110), (168, 124), (130, 136)], fill=(210, 214, 220, 255))
    d.rectangle((150, 118, 176, 128), fill=(70, 74, 82, 255))
    return down(im, size[0], size[1])


def zombie(brute=False):
    w, h = (220, 260) if brute else (180, 230)
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    skin = (120, 150, 70, 255) if not brute else (92, 122, 58, 255)
    cloth = (90, 36, 36, 255) if brute else (70, 78, 92, 255)
    cx = w // 2
    d.rounded_rectangle((cx - 28, h - 70, cx - 10, h - 8), 6, fill=(40, 42, 36, 255))
    d.rounded_rectangle((cx + 8, h - 70, cx + 26, h - 8), 6, fill=(40, 42, 36, 255))
    body = (cx - (48 if brute else 36), 78, cx + (48 if brute else 36), h - 48)
    d.rounded_rectangle(body, 16, fill=cloth)
    d.line([(cx - 40, 110), (cx - 78, 70)], fill=skin, width=14)
    d.line([(cx + 40, 110), (cx + 78, 70)], fill=skin, width=14)
    d.ellipse((cx - 78, 52, cx - 58, 74), fill=skin)
    d.ellipse((cx + 58, 52, cx + 78, 74), fill=skin)
    d.ellipse((cx - 40, 18, cx + 40, 100), fill=skin)
    d.ellipse((cx - 18, 42, cx - 4, 56), fill=(248, 250, 252, 255))
    d.ellipse((cx + 6, 42, cx + 20, 56), fill=(248, 250, 252, 255))
    d.ellipse((cx - 14, 46, cx - 8, 52), fill=(20, 20, 20, 255))
    d.ellipse((cx + 10, 46, cx + 16, 52), fill=(20, 20, 20, 255))
    d.rounded_rectangle((cx - 12, 64, cx + 12, 74), 3, fill=(120, 24, 24, 255))
    if brute:
        d.rounded_rectangle((cx - 58, 88, cx + 58, 112), 8, fill=(60, 20, 20, 255))
    return down(im, 128 if not brute else 150, 160 if not brute else 190)


def load_font(size, kind="num"):
    from PIL import ImageFont

    if kind == "cn":
        return ImageFont.truetype("/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc", size, index=2)
    return ImageFont.truetype(
        "/usr/share/fonts/truetype/sand-box/google/Passion One/PassionOne-Black.ttf",
        size,
    )


def stroke(draw, xy, text, font, fill, stroke_fill=(20, 16, 16, 255), sw=6):
    draw.text(xy, text, font=font, fill=fill, stroke_width=sw, stroke_fill=stroke_fill)


def cover_sand():
    im = Image.new("RGBA", (960, 540), (255, 228, 196, 255))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((36, 28, 924, 512), 40, fill=(244, 176, 122, 255))
    d.rounded_rectangle((64, 56, 560, 470), 32, fill=(255, 248, 240, 255))
    heart = ["01111110", "11133111", "13333331", "13333331", "01333310", "00133100", "00011000"]
    pal = {"1": (255, 92, 92), "3": (255, 140, 186)}
    cell = 36
    ox, oy = 130, 110
    for r, row in enumerate(heart):
        for c, ch in enumerate(row):
            if ch not in pal:
                continue
            d.rounded_rectangle(
                (ox + c * cell, oy + r * cell, ox + c * cell + cell - 4, oy + r * cell + cell - 4),
                6,
                fill=pal[ch],
            )
    font = load_font(64)
    buckets = [(590, 70, (255, 107, 107), "2400"), (590, 220, (255, 176, 74), "1200"), (590, 370, (255, 143, 191), "951")]
    for x, y, col, num in buckets:
        d.rounded_rectangle((x, y, x + 320, y + 130), 28, fill=col)
        stroke(d, (x + 36, y + 28), num, font, (255, 255, 255, 255), (80, 30, 20, 255), 4)
    return im


def cover_duck():
    im = Image.new("RGBA", (960, 540), (214, 238, 255, 255))
    d = ImageDraw.Draw(im)
    d.ellipse((40, 20, 220, 90), fill=(255, 255, 255, 180))
    d.ellipse((700, 30, 900, 100), fill=(255, 255, 255, 160))
    colors = [(77, 150, 255), (255, 159, 28), (255, 77, 109), (255, 230, 109), (46, 196, 182)]
    for r in range(8):
        for c in range(12):
            col = colors[(r + c) % len(colors)]
            x, y = 180 + c * 48, 70 + r * 40
            d.rounded_rectangle((x, y, x + 42, y + 34), 6, fill=col)
    duck = duck_sprite((255, 209, 74))
    im.alpha_composite(duck.resize((150, 150)), (40, 340))
    im.alpha_composite(duck_sprite((179, 136, 255)).resize((130, 130)), (220, 360))
    im.alpha_composite(duck_sprite((255, 77, 109)).resize((130, 130)), (400, 360))
    d = ImageDraw.Draw(im)
    font = load_font(72)
    for i, n in enumerate(("18", "26", "40")):
        stroke(d, (230 + i * 175, 400), n, font, (255, 255, 255, 255), (30, 40, 70, 255), 5)
    stroke(d, (36, 24), "x57", load_font(64), (255, 207, 61, 255), (154, 52, 18, 255), 5)
    return im


def cover_doom():
    im = Image.new("RGBA", (960, 540), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, 960, 540), fill=(120, 184, 230, 255))
    d.polygon([(480, 70), (960, 540), (0, 540)], fill=(232, 226, 214, 255))
    d.polygon([(430, 70), (250, 540), (0, 540), (360, 70)], fill=(90, 104, 128, 255))
    d.polygon([(530, 70), (710, 540), (960, 540), (600, 70)], fill=(96, 110, 132, 255))
    d.rounded_rectangle((140, 220, 460, 420), 16, fill=(255, 225, 74, 255))
    d.rounded_rectangle((500, 220, 830, 420), 16, fill=(73, 198, 255, 255))
    font = load_font(130)
    stroke(d, (190, 245), "+1", font, (58, 42, 0, 255), (255, 255, 255, 200), 2)
    stroke(d, (545, 245), "+8", font, (4, 40, 58, 255), (255, 255, 255, 200), 2)
    d.rounded_rectangle((280, 36, 680, 150), 14, fill=(245, 197, 66, 255))
    stroke(d, (360, 42), "100", load_font(86), (255, 255, 255, 255), (90, 60, 0, 255), 4)
    z = zombie(False).resize((90, 120))
    b = zombie(True).resize((110, 140))
    im.alpha_composite(z, (760, 300))
    im.alpha_composite(b, (820, 280))
    im.alpha_composite(z, (80, 320))
    im.alpha_composite(soldier(0).resize((70, 96)), (450, 400))
    return im


def hero():
    im = Image.new("RGBA", (1200, 760), (16, 18, 36, 255))
    sand = cover_sand().resize((370, 250))
    duck = cover_duck().resize((370, 250))
    doom = cover_doom().resize((370, 250))
    im.alpha_composite(sand, (30, 280))
    im.alpha_composite(duck, (415, 280))
    im.alpha_composite(doom, (800, 280))
    d = ImageDraw.Draw(im)
    stroke(d, (48, 40), "短视频同款", load_font(34, "cn"), (125, 211, 252, 255), (0, 0, 0, 255), 3)
    stroke(d, (48, 96), "休闲爆款合集", load_font(78, "cn"), (255, 255, 255, 255), (70, 20, 110, 255), 5)
    return im.convert("RGB")


def pixel_text(draw, xy, text, fill):
    draw.text(xy, text, fill=fill)


def main():
    for i, rgb in enumerate(DUCKS):
        save(duck_sprite(rgb), f"duck-pop/duck-{i}.png")
    save(icon_shovel(), "sand-bucket/shovel.png")
    save(icon_rainbow(), "sand-bucket/rainbow.png")
    save(icon_magnet(), "sand-bucket/magnet.png")
    save(soldier(0), "doom-gates/soldier-0.png")
    save(soldier(1), "doom-gates/soldier-1.png")
    save(zombie(False), "doom-gates/zombie.png")
    save(zombie(True), "doom-gates/brute.png")
    save(cover_sand(), "hub/cover-sand.png")
    save(cover_duck(), "hub/cover-duck.png")
    save(cover_doom(), "hub/cover-doom.png")
    hero_im = hero()
    path = OUT / "hub" / "hero.png"
    hero_im.save(path, "PNG", optimize=True)

    manifest_path = OUT / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    new_files = [
        "hub/cover-sand.png",
        "hub/cover-duck.png",
        "hub/cover-doom.png",
        "hub/hero.png",
        "sand-bucket/shovel.png",
        "sand-bucket/rainbow.png",
        "sand-bucket/magnet.png",
        "doom-gates/soldier-0.png",
        "doom-gates/soldier-1.png",
        "doom-gates/zombie.png",
        "doom-gates/brute.png",
    ] + [f"duck-pop/duck-{i}.png" for i in range(len(DUCKS))]
    have = set(manifest.get("files", []))
    for rel in new_files:
        if rel not in have:
            manifest.setdefault("files", []).append(rel)
    notes = manifest.setdefault("notes", [])
    line = "Three-game kit from tools/gen_three_assets.py is procedural Pillow only."
    if line not in notes:
        notes.append(line)
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    print("wrote", len(new_files), "assets")


if __name__ == "__main__":
    main()
