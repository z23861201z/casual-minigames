#!/usr/bin/env python3
"""Key magenta plates into foot-anchored game sprites.

Plates live in tools/plates/. Outputs:
  assets/doom-gates/sprites/*.png
  assets/duck-pop/duck-0.png … duck-9.png

    python3 tools/pack_ad_sprites.py
"""

from __future__ import annotations

import colorsys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PLATES = Path(__file__).resolve().parent / "plates"
DOOM = ROOT / "assets" / "doom-gates"
DUCK = ROOT / "assets" / "duck-pop"

DUCK_COLORS = [
    (0x4D, 0x96, 0xFF),
    (0xB3, 0x88, 0xFF),
    (0xFF, 0x9F, 0x1C),
    (0xFF, 0x4D, 0x6D),
    (0xFF, 0xE6, 0x6D),
    (0x2E, 0xC4, 0xB6),
    (0xFF, 0x70, 0xA6),
    (0xF4, 0xF7, 0xFB),
    (0x70, 0xE0, 0x00),
    (0x2B, 0x2D, 0x42),
]


def bg_like(r: int, g: int, b: int) -> bool:
    # Greens, yellows and orange beaks are characters, not the plate.
    if g > 145 and b < 170:
        return False
    mag = (r + b) * 0.5
    return mag > 105 and (g + 30) < mag and abs(r - b) < 150


def key_magenta(src: Image.Image) -> Image.Image:
    im = src.convert("RGBA")
    px = im.load()
    w, h = im.size
    seen = bytearray(w * h)
    stack = []
    for x in range(w):
        stack.append((x, 0))
        stack.append((x, h - 1))
    for y in range(h):
        stack.append((0, y))
        stack.append((w - 1, y))
    while stack:
        x, y = stack.pop()
        if x < 0 or y < 0 or x >= w or y >= h:
            continue
        i = y * w + x
        if seen[i]:
            continue
        r, g, b, a = px[x, y]
        if not bg_like(r, g, b):
            continue
        seen[i] = 1
        px[x, y] = (0, 0, 0, 0)
        stack.append((x + 1, y))
        stack.append((x - 1, y))
        stack.append((x, y + 1))
        stack.append((x, y - 1))
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if bg_like(r, g, b):
                px[x, y] = (0, 0, 0, 0)
            elif r > 130 and b > 90 and g < 100 and r > g + 35 and b > g + 15:
                px[x, y] = (0, 0, 0, 0)
    return im


def trim(im: Image.Image) -> Image.Image:
    bbox = im.getbbox()
    if not bbox:
        return im
    return im.crop(bbox)


def foot_x(im: Image.Image) -> float:
    px = im.load()
    w, h = im.size
    y0 = int(h * 0.82)
    total = 0
    weight = 0
    for y in range(y0, h):
        for x in range(w):
            if px[x, y][3] > 40:
                total += x
                weight += 1
    if weight == 0:
        return w / 2
    return total / weight


def despill(im: Image.Image) -> Image.Image:
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 12:
                px[x, y] = (0, 0, 0, 0)
                continue
            if r > 90 and b > 70 and g < 150 and (r + b) > (g * 2 + 70) and b > g + 8 and r > g:
                px[x, y] = (0, 0, 0, 0)
    return im


def normalize(im: Image.Image, target_h: int) -> Image.Image:
    im = despill(trim(key_magenta(im)))
    scale = target_h / max(1, im.height)
    nw = max(1, int(round(im.width * scale)))
    return despill(im.resize((nw, target_h), Image.Resampling.LANCZOS))


def place_feet(frames: list[Image.Image], cell_h: int) -> Image.Image:
    prepared = [normalize(f, cell_h - 6) for f in frames]
    cell_w = max(p.width for p in prepared) + 8
    sheet = Image.new("RGBA", (cell_w * len(prepared), cell_h), (0, 0, 0, 0))
    for i, im in enumerate(prepared):
        cell = Image.new("RGBA", (cell_w, cell_h), (0, 0, 0, 0))
        fx = foot_x(im)
        x = int(round(cell_w / 2 - fx))
        x = max(0, min(cell_w - im.width, x))
        cell.alpha_composite(im, (x, cell_h - im.height - 1))
        sheet.alpha_composite(cell, (i * cell_w, 0))
    return sheet


def save(im: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "PNG")
    print(path.relative_to(ROOT), im.size)


def hstack_same(im: Image.Image, n: int) -> Image.Image:
    sheet = Image.new("RGBA", (im.width * n, im.height), (0, 0, 0, 0))
    for i in range(n):
        sheet.alpha_composite(im, (i * im.width, 0))
    return sheet


def first_cell(sheet: Image.Image, n: int) -> Image.Image:
    w = sheet.width // n
    return sheet.crop((0, 0, w, sheet.height))


def recolor_duck(im: Image.Image, rgb: tuple[int, int, int]) -> Image.Image:
    th, ts, tv = colorsys.rgb_to_hsv(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255)
    out = im.copy()
    px = out.load()
    w, h = out.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 10:
                continue
            hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            # Yellow body only. Orange beak and feet stay.
            if ss > 0.35 and 0.10 <= hh <= 0.20:
                ns = ss if ts > 0.2 else ss * 0.12
                nv = vv * (0.35 + 0.65 * min(1.0, tv + 0.15))
                if ts < 0.12:
                    ns = 0.04
                    nv = min(1.0, vv * 0.95 + 0.05)
                rr, gg, bb = colorsys.hsv_to_rgb(th, max(0.0, min(1.0, ns)), max(0.0, min(1.0, nv)))
                px[x, y] = (int(rr * 255), int(gg * 255), int(bb * 255), a)
    return out


def pack_doom() -> None:
    idle = Image.open(PLATES / "soldier-back.jpg")
    run = Image.open(PLATES / "soldier-run.jpg")
    shoot = Image.open(PLATES / "soldier-shoot.jpg")
    zombie_a = Image.open(PLATES / "zombie-stand.jpg")
    zombie_b = Image.open(PLATES / "zombie-step.jpg")
    brute = Image.open(PLATES / "brute.jpg")

    back = place_feet([idle], 320)
    idle_sheet = hstack_same(first_cell(back, 1), 4)
    run_sheet = place_feet([run, run, run, run, run, run], 320)
    shoot_sheet = place_feet([shoot, shoot, shoot, shoot, shoot, shoot], 320)
    hit_sheet = place_feet([idle, idle, idle], 320)
    zombie_sheet = place_feet([zombie_a, zombie_b, zombie_a, zombie_b, zombie_a, zombie_b], 340)
    brute_sheet = place_feet([brute, brute, brute, brute, brute, brute], 370)

    sprites = DOOM / "sprites"
    save(first_cell(back, 1), sprites / "soldier-front.png")
    save(first_cell(back, 1), sprites / "soldier-side.png")
    save(first_cell(back, 1), sprites / "soldier-back.png")
    save(idle_sheet, sprites / "soldier-idle.png")
    save(run_sheet, sprites / "soldier-run.png")
    save(shoot_sheet, sprites / "soldier-shoot.png")
    save(hit_sheet, sprites / "soldier-hit.png")
    save(zombie_sheet, sprites / "zombie-walk.png")
    save(brute_sheet, sprites / "brute-walk.png")
    save(first_cell(back, 1), DOOM / "soldier-0.png")
    save(first_cell(back, 1), DOOM / "soldier-1.png")
    save(first_cell(zombie_sheet, 6), DOOM / "zombie.png")
    save(first_cell(brute_sheet, 6), DOOM / "brute.png")


def pack_ducks() -> None:
    base = trim(key_magenta(Image.open(PLATES / "duck-yellow.jpg")))
    # Fit into a square with a little padding.
    side = 160
    fitted = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    scale = (side - 8) / max(base.width, base.height)
    nw, nh = int(base.width * scale), int(base.height * scale)
    resized = base.resize((nw, nh), Image.Resampling.LANCZOS)
    fitted.alpha_composite(resized, ((side - nw) // 2, side - nh - 2))
    for i, rgb in enumerate(DUCK_COLORS):
        save(recolor_duck(fitted, rgb), DUCK / f"duck-{i}.png")


def main() -> None:
    pack_doom()
    pack_ducks()


if __name__ == "__main__":
    main()
