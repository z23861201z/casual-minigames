#!/usr/bin/env python3
"""Offline neon-candy UI kit for Casual Minigames.

Procedural Pillow/NumPy only — no downloaded art. Re-run from the repo root:

    python3 tools/gen_assets.py
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets"
SS = 3  # supersample for UI plates

# Slice pixels must stay in sync with CSS border-image-slice.
SLICES = {
    "ui/hud-frame.png": 64,
    "ui/hud-chip.png": 40,
    "ui/btn-primary.png": 64,
    "ui/btn-primary-hover.png": 64,
    "ui/btn-primary-pressed.png": 64,
    "ui/btn-ghost.png": 64,
    "ui/btn-ghost-hover.png": 64,
    "ui/btn-ghost-pressed.png": 64,
    "ui/badge-cyan.png": 36,
    "ui/badge-pink.png": 36,
    "ui/progress-track.png": 28,
    "ui/progress-fill.png": 28,
}


def clamp_rgb(c):
    return tuple(int(max(0, min(255, v))) for v in c)


def mix(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def lighten(c, t):
    return mix(c, (255, 255, 255), t)


def darken(c, t):
    return mix(c, (8, 6, 20), t)


def sd_round_box(px, py, hw, hh, radius):
    qx = np.abs(px) - (hw - radius)
    qy = np.abs(py) - (hh - radius)
    return (
        np.sqrt(np.maximum(qx, 0) ** 2 + np.maximum(qy, 0) ** 2)
        + np.minimum(np.maximum(qx, qy), 0)
        - radius
    )


def make_plate(
    w,
    h,
    radius,
    inset,
    top,
    bot,
    glow,
    sheen=0.34,
    opacity=1.0,
    glow_strength=0.55,
    ss=SS,
):
    """9-slice-safe glossy rounded plate. Sheen varies by Y only."""
    W, H = w * ss, h * ss
    ins = inset * ss
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    cx = (W - 1) / 2.0
    cy = (H - 1) / 2.0
    hw = max(2.0, (W - 2 * ins) / 2.0)
    hh = max(2.0, (H - 2 * ins) / 2.0)
    radius_px = min(float(radius * ss), hw, hh)
    px = x - cx
    py = y - cy
    dist = sd_round_box(px, py, hw, hh, radius_px)

    t = np.clip((py + hh) / max(1.0, hh * 2), 0, 1)
    col = np.array(top, np.float32) + (np.array(bot, np.float32) - np.array(top, np.float32)) * (
        t ** 0.92
    )[..., None]
    sheen_m = np.clip(1 - t / 0.40, 0, 1) ** 1.3
    col = col + sheen_m[..., None] * (255.0 * sheen)
    shade = np.clip((t - 0.7) / 0.3, 0, 1)
    col = col * (1 - shade[..., None] * 0.30)
    rim = np.clip(1 + dist / (2.4 * ss), 0, 1) * (dist < 0)
    col = col + rim[..., None] * np.array([255, 255, 255], np.float32) * 0.42
    col = np.clip(col, 0, 255)

    ba = np.clip(-dist, 0, 1) * opacity
    glow_w = 16 * ss
    ga = np.clip(1 - np.clip(dist, 0, None) / glow_w, 0, 1) ** 1.65
    ga = ga * (dist >= 0) * glow_strength
    gcol = np.array(glow, np.float32)
    oa = np.clip(ba + ga * (1 - ba), 0, 1)
    oc = (col * ba[..., None] + gcol * (ga * (1 - ba))[..., None]) / np.maximum(oa[..., None], 1e-4)
    arr = np.dstack([np.clip(oc, 0, 255), np.clip(oa * 255, 0, 255)]).astype(np.uint8)
    return Image.fromarray(arr, "RGBA").resize((w, h), Image.Resampling.LANCZOS)


def blit(dst, src, xy, anchor="lt"):
    x, y = xy
    if anchor == "center":
        x -= src.width / 2
        y -= src.height / 2
    x, y = int(round(x)), int(round(y))
    layer = Image.new("RGBA", dst.size, (0, 0, 0, 0))
    layer.paste(src, (x, y), src)
    return Image.alpha_composite(dst, layer)


def save(im, rel):
    path = OUT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "PNG", optimize=True)
    return path


def sphere(diameter, mid, hi, lo, spec=0.9, rim_boost=0.28):
    d = int(diameter)
    if d < 2:
        d = 2
    y, x = np.mgrid[0:d, 0:d].astype(np.float32)
    cx = (d - 1) / 2.0
    nx = (x - cx) / max(1.0, cx)
    ny = (y - cx) / max(1.0, cx)
    r2 = nx * nx + ny * ny
    nz = np.zeros_like(nx)
    inside = r2 <= 1.0
    nz[inside] = np.sqrt(np.clip(1.0 - r2[inside], 0, 1))
    lx, ly, lz = -0.42, -0.58, 0.70
    ln = math.sqrt(lx * lx + ly * ly + lz * lz)
    lx, ly, lz = lx / ln, ly / ln, lz / ln
    ndotl = np.clip(nx * lx + ny * ly + nz * lz, 0, 1)
    t = ndotl ** 0.8
    lo_a = np.array(lo, np.float32)
    mid_a = np.array(mid, np.float32)
    hi_a = np.array(hi, np.float32)
    u = np.clip(t / 0.5, 0, 1)
    col = lo_a + (mid_a - lo_a) * u[..., None]
    u2 = np.clip((t - 0.5) / 0.5, 0, 1)
    col = np.where((t >= 0.5)[..., None], mid_a + (hi_a - mid_a) * u2[..., None], col)
    hx, hy, hz = lx, ly, lz + 1.0
    hn = math.sqrt(hx * hx + hy * hy + hz * hz)
    hx, hy, hz = hx / hn, hy / hn, hz / hn
    spec_m = np.clip(nx * hx + ny * hy + nz * hz, 0, 1) ** 36
    col = col + spec_m[..., None] * (255 * spec)
    broad = np.clip(nx * hx + ny * hy + nz * hz, 0, 1) ** 8
    col = col + broad[..., None] * np.array(hi, np.float32) * 0.22
    rim = (np.clip(1 - nz, 0, 1) ** 1.6) * inside
    col = col + rim[..., None] * np.array(hi, np.float32) * rim_boost
    col = np.clip(col, 0, 255)
    edge = np.clip((1.0 - np.sqrt(np.clip(r2, 0, 4))) * cx, 0, 1)
    alpha = edge * 255
    arr = np.dstack([col, alpha]).astype(np.uint8)
    return Image.fromarray(arr, "RGBA")


def glow_disc(size, color, power=2.15, alpha=1.0):
    s = int(size)
    y, x = np.mgrid[0:s, 0:s].astype(np.float32)
    cx = (s - 1) / 2.0
    r = np.sqrt((x - cx) ** 2 + (y - cx) ** 2) / max(1.0, cx)
    a = np.clip(1 - r, 0, 1) ** power
    arr = np.zeros((s, s, 4), np.uint8)
    arr[..., 0] = color[0]
    arr[..., 1] = color[1]
    arr[..., 2] = color[2]
    arr[..., 3] = np.clip(a * 255 * alpha, 0, 255).astype(np.uint8)
    return Image.fromarray(arr, "RGBA")


def spike(length, width, hi, lo):
    length, width = int(length), int(width)
    mask = Image.new("L", (width, length), 0)
    ImageDraw.Draw(mask).polygon(
        [(width / 2, 1), (width * 0.88, length - 2), (width * 0.12, length - 2)],
        fill=255,
    )
    mask = mask.filter(ImageFilter.GaussianBlur(radius=0.7))
    m = np.array(mask).astype(np.float32) / 255.0
    xs = np.linspace(0, 1, width, dtype=np.float32)
    shade = 1 - np.abs(xs - 0.32) * 1.35
    shade = np.clip(shade, 0, 1)
    col = np.array(lo, np.float32) + (np.array(hi, np.float32) - np.array(lo, np.float32)) * shade[:, None]
    arr = np.zeros((length, width, 4), np.float32)
    arr[..., 0:3] = col[None, :, :]
    arr[..., 3] = m * 255
    return Image.fromarray(arr.astype(np.uint8), "RGBA")


def capsule(length, thick, top, bot, glow, sheen=0.28):
    thick = max(8, int(thick))
    length = max(thick + 2, int(length))
    return make_plate(
        thick,
        length,
        radius=thick // 2,
        inset=max(2, thick // 10),
        top=top,
        bot=bot,
        glow=glow,
        sheen=sheen,
        glow_strength=0.35,
        ss=2,
    )


def rotate(im, angle):
    return im.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)


def add_spec_blob(im, cx, cy, rx, ry, alpha=90):
    overlay = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(overlay).ellipse(
        (cx - rx, cy - ry, cx + rx, cy + ry),
        fill=(255, 255, 255, int(alpha)),
    )
    overlay = overlay.filter(ImageFilter.GaussianBlur(radius=max(1, int(min(rx, ry) * 0.18))))
    return Image.alpha_composite(im, overlay)


def star_image(size=160, points=4, inner=0.16, outer=0.46, softness=1.4):
    s = int(size)
    im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    cx = cy = (s - 1) / 2
    pts = []
    for i in range(points * 2):
        r = outer if i % 2 == 0 else inner
        a = -math.pi / 2 + i * math.pi / points
        pts.append((cx + math.cos(a) * r * s, cy + math.sin(a) * r * s))
    mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(mask).polygon(pts, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(radius=softness))
    glow = glow_disc(s, (255, 255, 255), power=2.4, alpha=0.45)
    arr = np.array(glow)
    m = np.array(mask).astype(np.float32)
    base = np.zeros_like(arr)
    base[..., 0:3] = 255
    base[..., 3] = np.clip(m * 0.95 + arr[..., 3] * 0.35, 0, 255)
    return Image.fromarray(base.astype(np.uint8), "RGBA")


def ring_image(size=160):
    s = int(size)
    y, x = np.mgrid[0:s, 0:s].astype(np.float32)
    cx = (s - 1) / 2.0
    r = np.sqrt((x - cx) ** 2 + (y - cx) ** 2) / cx
    band = np.exp(-((r - 0.72) ** 2) / (2 * 0.045 ** 2))
    core = np.clip(1 - r / 0.25, 0, 1) ** 2 * 0.35
    a = np.clip(band + core, 0, 1)
    arr = np.zeros((s, s, 4), np.uint8)
    arr[..., 0:3] = 255
    arr[..., 3] = (a * 255).astype(np.uint8)
    return Image.fromarray(arr, "RGBA")


def shard_image(size=160):
    s = int(size)
    im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(mask).polygon(
        [(s * 0.50, s * 0.08), (s * 0.86, s * 0.78), (s * 0.18, s * 0.70)],
        fill=255,
    )
    mask = mask.filter(ImageFilter.GaussianBlur(radius=1.2))
    m = np.array(mask).astype(np.float32) / 255.0
    arr = np.zeros((s, s, 4), np.uint8)
    arr[..., 0:3] = 255
    arr[..., 3] = (m * 255).astype(np.uint8)
    return Image.fromarray(arr, "RGBA")


def rounded_mask(size, radius, inset=0):
    w, h = size
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).rounded_rectangle(
        (inset, inset, w - 1 - inset, h - 1 - inset),
        radius=radius,
        fill=255,
    )
    return m


def icon_plus(size, color):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    t = max(6, size // 7)
    m = size // 2
    d.rounded_rectangle((m - t // 2, size * 0.18, m + t // 2, size * 0.82), radius=t // 2, fill=color)
    d.rounded_rectangle((size * 0.18, m - t // 2, size * 0.82, m + t // 2), radius=t // 2, fill=color)
    return im


def icon_minus(size, color):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    t = max(6, size // 7)
    m = size // 2
    d.rounded_rectangle((size * 0.18, m - t // 2, size * 0.82, m + t // 2), radius=t // 2, fill=color)
    return im


def icon_times(size, color):
    bar = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    t = max(6, size // 7)
    ImageDraw.Draw(bar).rounded_rectangle(
        (size * 0.22, size / 2 - t / 2, size * 0.78, size / 2 + t / 2),
        radius=t // 2,
        fill=color,
    )
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    a = rotate(bar, 45)
    b = rotate(bar, -45)
    im = blit(im, a, ((size - a.width) / 2, (size - a.height) / 2))
    im = blit(im, b, ((size - b.width) / 2, (size - b.height) / 2))
    return im


def icon_slash(size, color):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((size * 0.16, size * 0.16, size * 0.84, size * 0.84), outline=color + (255,), width=max(6, size // 10))
    bar = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    t = max(6, size // 8)
    ImageDraw.Draw(bar).rounded_rectangle(
        (size * 0.22, size / 2 - t / 2, size * 0.78, size / 2 + t / 2),
        radius=t // 2,
        fill=color,
    )
    sl = rotate(bar, 55)
    return blit(im, sl, ((size - sl.width) / 2, (size - sl.height) / 2))


def icon_bomb(size, color):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    body = sphere(int(size * 0.62), color, lighten(color, 0.45), darken(color, 0.45))
    im = blit(im, body, (size * 0.50, size * 0.58), "center")
    d = ImageDraw.Draw(im)
    d.rounded_rectangle(
        (size * 0.46, size * 0.16, size * 0.58, size * 0.36),
        radius=4,
        fill=(30, 24, 28, 255),
    )
    spark = star_image(int(size * 0.28), points=4, inner=0.22, outer=0.48, softness=0.6)
    im = blit(im, spark, (size * 0.70, size * 0.18), "center")
    return im


def icon_shield(size, color):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.polygon(
        [
            (size * 0.50, size * 0.10),
            (size * 0.84, size * 0.28),
            (size * 0.78, size * 0.62),
            (size * 0.50, size * 0.90),
            (size * 0.22, size * 0.62),
            (size * 0.16, size * 0.28),
        ],
        fill=255,
    )
    mask = mask.filter(ImageFilter.GaussianBlur(0.6))
    grad = np.zeros((size, size, 4), np.float32)
    for y in range(size):
        t = y / max(1, size - 1)
        col = mix(lighten(color, 0.4), darken(color, 0.35), t)
        grad[y, :, 0:3] = col
    grad[..., 3] = np.array(mask)
    im = Image.fromarray(grad.astype(np.uint8), "RGBA")
    return add_spec_blob(im, int(size * 0.40), int(size * 0.32), int(size * 0.16), int(size * 0.10), 80)


def icon_star(size, color):
    im = star_image(size, points=5, inner=0.20, outer=0.46, softness=0.8)
    arr = np.array(im).astype(np.float32)
    rgb = np.array(color, np.float32)
    # keep white core, tint the fringe via alpha already white — recolor all, then add white core
    a = arr[..., 3:4] / 255.0
    arr[..., 0:3] = rgb
    out = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA")
    core = glow_disc(int(size * 0.36), (255, 255, 255), power=1.4, alpha=0.85)
    return blit(out, core, (size / 2, size / 2), "center")


def make_door(w, h, top, bot, glow, icon):
    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    back = make_plate(
        w, h, radius=46, inset=26, top=darken(bot, 0.15), bot=darken(bot, 0.45),
        glow=glow, sheen=0.05, glow_strength=0.0, ss=2,
    )
    canvas = blit(canvas, back, (10, 14))
    front = make_plate(
        w, h, radius=46, inset=18, top=top, bot=bot, glow=glow, sheen=0.42, glow_strength=0.72, ss=2,
    )
    canvas = blit(canvas, front, (0, 0))

    # Inner portal window
    ix0, iy0 = int(w * 0.16), int(h * 0.12)
    ix1, iy1 = int(w * 0.84), int(h * 0.90)
    win_w, win_h = ix1 - ix0, iy1 - iy0
    leak = glow_disc(int(max(win_w, win_h) * 1.05), lighten(top, 0.25), power=1.6, alpha=0.55)
    canvas = blit(canvas, leak, ((ix0 + ix1) / 2, (iy0 + iy1) / 2), "center")

    window = Image.new("RGBA", (win_w, win_h), (0, 0, 0, 0))
    wd = ImageDraw.Draw(window)
    wd.rounded_rectangle((0, 0, win_w - 1, win_h - 1), radius=28, fill=(6, 8, 22, 232))
    beam = glow_disc(int(win_w * 0.72), lighten(top, 0.45), power=1.35, alpha=0.42)
    window = blit(window, beam, (win_w / 2, win_h / 2), "center")
    wd = ImageDraw.Draw(window)
    wd.rounded_rectangle(
        (int(win_w * 0.16), int(win_h * 0.22), int(win_w * 0.84), int(win_h * 0.22) + 3),
        radius=2, fill=(*lighten(top, 0.55), 46),
    )
    wd.rounded_rectangle(
        (int(win_w * 0.16), int(win_h * 0.70), int(win_w * 0.84), int(win_h * 0.70) + 3),
        radius=2, fill=(*lighten(top, 0.55), 34),
    )
    canvas = blit(canvas, window, (ix0, iy0))

    # neon inner lip
    lip = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(lip).rounded_rectangle(
        (ix0, iy0, ix1, iy1),
        radius=28,
        outline=(*lighten(top, 0.55), 220),
        width=4,
    )
    canvas = Image.alpha_composite(canvas, lip)

    ic = icon(int(w * 0.15), lighten(top, 0.7))
    canvas = blit(canvas, ic, (w * 0.50, h * 0.84), "center")

    # rivets on the frame
    for px, py in ((w * 0.10, h * 0.10), (w * 0.90, h * 0.10), (w * 0.10, h * 0.90), (w * 0.90, h * 0.90)):
        riv = sphere(int(w * 0.055), lighten(top, 0.2), (255, 255, 255), darken(bot, 0.2), spec=1.0)
        canvas = blit(canvas, riv, (px, py), "center")
    return canvas


def corner_brackets(im, margin, length, color_a, color_b):
    """Ornaments strictly inside the 64px corner slices of a 256 frame."""
    d = ImageDraw.Draw(im)
    w, h = im.size
    specs = [
        (margin, margin, 1, 1, color_a),
        (w - margin, margin, -1, 1, color_b),
        (margin, h - margin, 1, -1, color_b),
        (w - margin, h - margin, -1, -1, color_a),
    ]
    thick = 5

    def box(x0, y0, x1, y1):
        return (min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1))

    for x, y, sx, sy, col in specs:
        d.rounded_rectangle(box(x, y, x + sx * length, y + sy * thick), radius=2, fill=col + (235,))
        d.rounded_rectangle(box(x, y, x + sx * thick, y + sy * length), radius=2, fill=col + (235,))
    return im


def make_frame():
    im = make_plate(
        256, 256, radius=36, inset=16,
        top=(32, 40, 82), bot=(12, 10, 32),
        glow=(168, 85, 247), sheen=0.20, opacity=0.96, glow_strength=0.62, ss=2,
    )
    # recolor rim toward cyan/magenta by a thin stroke, still uniform on straight edges
    stroke = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(stroke).rounded_rectangle(
        (16, 16, 239, 239), radius=36, outline=(120, 230, 255, 180), width=3,
    )
    im = Image.alpha_composite(im, stroke)
    im = corner_brackets(im, margin=30, length=22, color_a=(103, 232, 249), color_b=(244, 114, 182))
    # gems sit inside the corner slice (slice = 64)
    for cx, cy, col in (
        (46, 46, (103, 232, 249)),
        (210, 46, (244, 114, 182)),
        (46, 210, (244, 114, 182)),
        (210, 210, (250, 204, 21)),
    ):
        g = sphere(16, col, lighten(col, 0.45), darken(col, 0.4))
        im = blit(im, g, (cx, cy), "center")
    return im


def make_tile(size, top, bot, glow, radius=42, margin=8):
    im = make_plate(
        size, size, radius=radius, inset=margin,
        top=top, bot=bot, glow=glow, sheen=0.22, glow_strength=0.38, ss=2,
    )
    im = add_spec_blob(im, int(size * 0.36), int(size * 0.30), int(size * 0.22), int(size * 0.12), 110)
    # bottom inner candy lip
    lip = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(lip).rounded_rectangle(
        (margin + 8, int(size * 0.62), size - margin - 8, size - margin - 10),
        radius=18,
        fill=(0, 0, 0, 35),
    )
    return Image.alpha_composite(im, lip)


def make_stone(size=192):
    im = make_tile(size, (168, 178, 196), (58, 66, 82), (120, 140, 170), radius=36, margin=8)
    d = ImageDraw.Draw(im)
    crack = (230, 236, 245, 90)
    d.line((size * 0.28, size * 0.30, size * 0.48, size * 0.52, size * 0.40, size * 0.74), fill=crack, width=3)
    d.line((size * 0.62, size * 0.26, size * 0.70, size * 0.48, size * 0.58, size * 0.70), fill=(20, 24, 32, 80), width=3)
    return im


def eye_pair(canvas, cx, cy, sep, scale, iris, angry=0.0):
    er = int(22 * scale)
    for side in (-1, 1):
        ex = cx + side * sep
        sclera = sphere(er * 2, (244, 247, 255), (255, 255, 255), (180, 190, 210), spec=0.4, rim_boost=0.05)
        canvas = blit(canvas, sclera, (ex, cy), "center")
        ir = sphere(int(er * 1.15), iris, lighten(iris, 0.35), darken(iris, 0.45), spec=0.5)
        canvas = blit(canvas, ir, (ex + side * er * 0.08, cy + er * 0.05), "center")
        pupil = sphere(int(er * 0.62), (12, 10, 18), (40, 36, 48), (0, 0, 0), spec=0.2, rim_boost=0)
        canvas = blit(canvas, pupil, (ex + side * er * 0.12, cy + er * 0.08), "center")
        catch = sphere(max(4, int(er * 0.28)), (255, 255, 255), (255, 255, 255), (255, 255, 255), spec=0.1, rim_boost=0)
        canvas = blit(canvas, catch, (ex - er * 0.22, cy - er * 0.22), "center")
        brow = capsule(int(28 * scale), int(8 * scale), (40, 16, 32), (20, 8, 16), (0, 0, 0), sheen=0.05)
        brow = rotate(brow, -18 * side - angry * 10 * side)
        canvas = blit(canvas, brow, (ex, cy - er * 0.95), "center")
    return canvas


def make_runner(phase):
    """Back-view chibi runner. Feet near y=470 on a 512 canvas. No ground shadow."""
    S = 512
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    bob = -16 if phase else 0
    suit_hi = (165, 243, 252)
    suit = (34, 211, 238)
    suit_lo = (88, 28, 135)
    magenta = (244, 114, 182)
    gold = (250, 204, 21)

    # thruster sits on the lower back, above the feet
    im = blit(im, glow_disc(110, magenta, 2.0, 0.7), (256, 318 + bob), "center")
    im = blit(im, glow_disc(46, (255, 255, 255), 1.5, 0.9), (256, 326 + bob), "center")

    # Upright run cycle: feet swap height, legs stay under the body.
    if phase == 0:
        legs = [(232, 424, 8), (284, 386, -10)]
        arms = [(40, 208, 292), (-34, 304, 278)]
    else:
        legs = [(232, 382, -8), (284, 428, 12)]
        arms = [(-36, 206, 276), (38, 308, 294)]

    for x, y, ang in legs:
        limb = rotate(capsule(132, 46, suit_hi, suit_lo, suit, 0.32), ang)
        im = blit(im, limb, (x, y + bob), "center")
        shoe = sphere(52, (255, 255, 255), (255, 255, 255), gold, spec=0.8)
        im = blit(im, shoe, (x + ang * 0.45, y + 58 + bob), "center")

    for ang, x, y in arms:
        arm = rotate(capsule(100, 36, suit_hi, (59, 130, 246), suit, 0.3), ang)
        im = blit(im, arm, (x, y + bob), "center")
        glove = sphere(32, (255, 255, 255), (255, 255, 255), suit_hi, spec=0.7)
        im = blit(im, glove, (x + math.sin(math.radians(ang)) * 36, y + 44 + bob), "center")

    torso = make_plate(176, 168, radius=52, inset=6, top=suit_hi, bot=suit_lo, glow=suit, sheen=0.36, glow_strength=0.25, ss=2)
    im = blit(im, torso, (256, 292 + bob), "center")
    stripe = make_plate(28, 120, radius=12, inset=2, top=(255, 255, 255), bot=suit_hi, glow=suit, sheen=0.5, glow_strength=0.2, ss=2)
    im = blit(im, stripe, (256, 286 + bob), "center")
    belt = make_plate(120, 18, radius=8, inset=2, top=gold, bot=(180, 83, 9), glow=gold, sheen=0.4, glow_strength=0.15, ss=2)
    im = blit(im, belt, (256, 348 + bob), "center")

    # shoulders
    for sx in (188, 324):
        im = blit(im, sphere(54, magenta, lighten(magenta, 0.4), darken(magenta, 0.35)), (sx, 246 + bob), "center")

    head = sphere(176, suit, (224, 254, 255), (49, 46, 129), spec=1.0, rim_boost=0.35)
    im = blit(im, head, (256, 168 + bob), "center")
    # rear visor slit
    slit = make_plate(108, 22, radius=10, inset=2, top=(15, 18, 40), bot=(8, 10, 24), glow=suit, sheen=0.05, glow_strength=0.15, ss=2)
    im = blit(im, slit, (256, 176 + bob), "center")
    # ear pods
    for sx in (176, 336):
        im = blit(im, sphere(40, (255, 255, 255), (255, 255, 255), suit), (sx, 176 + bob), "center")
    hawk = rotate(spike(92, 36, (255, 228, 250), magenta), -8 if phase else 8)
    im = blit(im, hawk, (256, 78 + bob), "center")
    return im


def make_grunt():
    S = 512
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    im = blit(im, glow_disc(340, (251, 113, 133), 2.2, 0.35), (256, 270), "center")
    body = sphere(300, (251, 113, 133), (255, 214, 224), (159, 18, 57), spec=1.0)
    im = blit(im, body, (256, 286), "center")
    belly = sphere(150, (255, 228, 230), (255, 255, 255), (251, 113, 133), spec=0.5, rim_boost=0.05)
    im = blit(im, belly, (256, 330), "center")
    for side, ang in ((-1, 28), (1, -28)):
        horn = rotate(spike(120, 48, (255, 228, 235), (190, 18, 60)), ang)
        im = blit(im, horn, (256 + side * 78, 150), "center")
    im = eye_pair(im, 256, 270, sep=52, scale=1.35, iris=(244, 63, 94), angry=1.0)
    # fangs
    for side in (-1, 1):
        fang = spike(36, 18, (255, 255, 255), (255, 228, 235))
        im = blit(im, fang, (256 + side * 22, 338), "center")
    return im


def make_elite():
    S = 512
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    im = blit(im, glow_disc(360, (250, 204, 21), 2.3, 0.28), (256, 270), "center")
    tile = make_tile(280, (253, 224, 71), (161, 98, 7), (250, 204, 21), radius=26, margin=6)
    dia = rotate(tile, 45)
    im = blit(im, dia, (256, 270), "center")
    inner = make_tile(150, (254, 249, 195), (217, 119, 6), (250, 204, 21), radius=16, margin=4)
    im = blit(im, rotate(inner, 45), (256, 268), "center")
    for side, ang in ((-1, 18), (1, -18)):
        horn = rotate(spike(100, 36, (255, 251, 235), (146, 64, 14)), ang)
        im = blit(im, horn, (256 + side * 108, 168), "center")
    im = eye_pair(im, 256, 268, sep=40, scale=1.05, iris=(234, 88, 12), angry=0.6)
    return im


def make_boss():
    S = 512
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    im = blit(im, glow_disc(420, (192, 132, 252), 2.0, 0.40), (256, 280), "center")
    # back triangle (darker, offset)
    def tri(scale, top, bot, ox, oy):
        w = int(360 * scale)
        h = int(400 * scale)
        mask = Image.new("L", (w, h), 0)
        ImageDraw.Draw(mask).polygon(
            [(w * 0.5, h * 0.04), (w * 0.96, h * 0.92), (w * 0.04, h * 0.92)],
            fill=255,
        )
        mask = mask.filter(ImageFilter.GaussianBlur(1.0))
        arr = np.zeros((h, w, 4), np.float32)
        m = np.array(mask).astype(np.float32) / 255.0
        ys = np.linspace(0, 1, h, dtype=np.float32)[:, None]
        col = np.array(top, np.float32) * (1 - ys) + np.array(bot, np.float32) * ys
        # left light
        xs = np.linspace(0, 1, w, dtype=np.float32)[None, :]
        light = np.clip(1 - np.abs(xs - 0.35) * 1.1, 0.35, 1)
        arr[..., 0:3] = col[:, None, :] * light[..., None]
        arr[..., 3] = m * 255
        return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA"), ox, oy

    back, ox, oy = tri(1.05, (88, 28, 135), (49, 10, 80), 256 + 12, 300 + 10)
    im = blit(im, back, (ox, oy), "center")
    front, ox, oy = tri(1.0, (216, 180, 254), (91, 33, 182), 256, 292)
    im = blit(im, front, (ox, oy), "center")
    im = add_spec_blob(im, 210, 210, 70, 36, 70)
    # crown sits on the triangle, taller in the middle
    var_crown = ((212, 220, 58), (236, 186, 74), (256, 156, 96), (276, 186, 74), (300, 220, 58))
    for x, y, length in var_crown:
        sp = spike(length, 28, (233, 213, 255), (109, 40, 217))
        im = blit(im, sp, (x, y), "center")
    im = eye_pair(im, 256, 250, sep=58, scale=1.45, iris=(250, 204, 21), angry=1.2)
    # maw
    maw = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(maw).rounded_rectangle((196, 300, 316, 338), radius=12, fill=(30, 8, 48, 230))
    im = Image.alpha_composite(im, maw)
    for side in (-1, 1):
        fang = spike(40, 20, (255, 255, 255), (233, 213, 255))
        im = blit(im, fang, (256 + side * 28, 312), "center")
    return im


def paint_sky(w, h, top, mid, bot, glow_a, glow_b):
    t = np.linspace(0, 1, h, dtype=np.float32)[:, None]
    col = np.array(top, np.float32) * (1 - t) + np.array(bot, np.float32) * t
    bell = np.clip(1 - np.abs(t - 0.35) / 0.45, 0, 1)
    col = col * (1 - bell) + np.array(mid, np.float32) * bell
    arr = np.zeros((h, w, 4), np.uint8)
    arr[..., 0:3] = np.clip(col, 0, 255).astype(np.uint8)[:, None, :]
    arr[..., 3] = 255
    im = Image.fromarray(arr, "RGBA")
    im = blit(im, glow_disc(int(w * 0.7), glow_a, 2.4, 0.55), (w * 0.5, h * 0.16), "center")
    im = blit(im, glow_disc(int(w * 0.45), glow_b, 2.2, 0.35), (w * 0.82, h * 0.7), "center")
    rng = np.random.default_rng(11)
    stars = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(stars)
    for i in range(70):
        sx = int(rng.integers(0, w))
        sy = int(rng.integers(0, int(h * 0.55)))
        r = 1 if i % 4 else 2
        a = int(rng.integers(90, 210))
        d.ellipse((sx, sy, sx + r, sy + r), fill=(255, 255, 255, a))
    return Image.alpha_composite(im, stars)


def paint_road(im, far_y, near_y, far_half, near_half):
    w, h = im.size
    cx = w / 2
    overlay = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    d.polygon(
        [
            (cx - far_half, far_y),
            (cx + far_half, far_y),
            (cx + near_half, near_y),
            (cx - near_half, near_y),
        ],
        fill=(42, 28, 110, 210),
    )
    im = Image.alpha_composite(im, overlay)
    # tile bands
    bands = Image.new("RGBA", im.size, (0, 0, 0, 0))
    bd = ImageDraw.Draw(bands)
    for i in range(10):
        t0 = i / 10
        t1 = (i + 0.5) / 10
        y0 = far_y + (near_y - far_y) * (t0 ** 1.15)
        y1 = far_y + (near_y - far_y) * (t1 ** 1.15)
        h0 = far_half + (near_half - far_half) * (t0 ** 1.15)
        h1 = far_half + (near_half - far_half) * (t1 ** 1.15)
        col = (255, 255, 255, 18) if i % 2 == 0 else (0, 0, 0, 28)
        bd.polygon([(cx - h0, y0), (cx + h0, y0), (cx + h1, y1), (cx - h1, y1)], fill=col)
    im = Image.alpha_composite(im, bands)
    # neon edges
    edge = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ed = ImageDraw.Draw(edge)
    for width, alpha in ((10, 40), (4, 180), (2, 255)):
        ed.line([(cx - far_half, far_y), (cx - near_half, near_y)], fill=(34, 211, 238, alpha), width=width)
        ed.line([(cx + far_half, far_y), (cx + near_half, near_y)], fill=(244, 114, 182, alpha), width=width)
    # lane dashes
    for lt in (1 / 3, 2 / 3):
        pts = []
        for s in np.linspace(0, 1, 16):
            y = far_y + (near_y - far_y) * s
            half = far_half + (near_half - far_half) * s
            x = cx - half + half * 2 * lt
            pts.append((x, y))
        ed.line(pts, fill=(210, 180, 255, 140), width=3)
    im = Image.alpha_composite(im, edge)
    return im


def flatten(im, bg=(7, 8, 22)):
    base = Image.new("RGBA", im.size, bg + (255,))
    out = Image.alpha_composite(base, im)
    return out


def vignette(im, strength=0.55):
    w, h = im.size
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    nx = (x - w / 2) / (w / 2)
    ny = (y - h / 2) / (h / 2)
    r = np.sqrt(nx * nx * 0.8 + ny * ny)
    a = np.clip((r - 0.45) / 0.7, 0, 1) ** 1.4 * strength
    shade = Image.new("RGBA", im.size, (0, 0, 0, 0))
    arr = np.array(shade)
    arr[..., 3] = (a * 255).astype(np.uint8)
    return Image.alpha_composite(im, Image.fromarray(arr, "RGBA"))


def build_gate_scene(w, h, doors, runner, grunt, hero=False):
    im = paint_sky(
        w, h,
        top=(10, 12, 36),
        mid=(48, 18, 92),
        bot=(8, 14, 40),
        glow_a=(124, 58, 237),
        glow_b=(6, 182, 212),
    )
    far_y = int(h * (0.30 if hero else 0.34))
    near_y = int(h * 0.98)
    im = paint_road(im, far_y, near_y, far_half=int(w * 0.07), near_half=int(w * 0.46))
    # doors stand on the road; monster peeks above the center gate
    specs = [
        (doors["add"], 0.27, 0.50, 0.20),
        (doors["mul"], 0.50, 0.46, 0.24),
        (doors["bomb"], 0.73, 0.50, 0.20),
    ]
    for img, x, y, sc in specs:
        dw, dh = int(w * sc * 0.52), int(w * sc * 0.70)
        spr = img.resize((dw, dh), Image.Resampling.LANCZOS)
        im = blit(im, spr, (w * x, h * y), "center")
    g = grunt.resize((int(w * 0.11), int(w * 0.11)), Image.Resampling.LANCZOS)
    im = blit(im, g, (w * 0.50, h * 0.30), "center")
    rw = int(w * (0.22 if hero else 0.20))
    run = runner.resize((rw, rw), Image.Resampling.LANCZOS)
    ground_y = h * (0.90 if hero else 0.88)
    shadow = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).ellipse(
        (w * 0.5 - rw * 0.22, ground_y - rw * 0.02, w * 0.5 + rw * 0.22, ground_y + rw * 0.08),
        fill=(0, 0, 0, 100),
    )
    im = Image.alpha_composite(im, shadow)
    im = blit(im, run, (w * 0.50, ground_y - rw * 0.34), "center")
    # side speed streaks
    streaks = Image.new("RGBA", im.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(streaks)
    rng = np.random.default_rng(3)
    for i in range(18):
        x = int(rng.integers(0, int(w * 0.16))) if i % 2 == 0 else int(rng.integers(int(w * 0.84), w))
        y = int(rng.integers(int(h * 0.2), int(h * 0.9)))
        length = int(rng.integers(40, 120))
        sd.line((x, y, x + (8 if x < w / 2 else -8), y + length), fill=(186, 230, 253, 90), width=2)
    im = Image.alpha_composite(im, streaks)
    return flatten(vignette(im, 0.5))


def build_same_cover(blocks):
    w, h = 1280, 720
    im = paint_sky(
        w, h,
        top=(24, 10, 36),
        mid=(80, 20, 70),
        bot=(10, 16, 48),
        glow_a=(255, 77, 109),
        glow_b=(77, 150, 255),
    )
    im = blit(im, glow_disc(420, (255, 217, 61), 2.2, 0.25), (w * 0.55, h * 0.48), "center")
    rng = np.random.default_rng(5)
    order = [0, 1, 2, 3, 4, 5, 0, 1, 2, 4, 5, 3, 1, 2, 0, 5, 3, 4]
    cols, rows = 6, 3
    for i, idx in enumerate(order):
        c, r = i % cols, i // cols
        if (c, r) in {(1, 1), (4, 0), (2, 2)}:
            continue
        tile = blocks[idx]
        pop = 1.18 if (c, r) == (3, 1) else 1.0
        tw = int(150 * pop)
        spr = tile.resize((tw, tw), Image.Resampling.LANCZOS)
        ang = int(rng.integers(-8, 9))
        spr = rotate(spr, ang)
        x = 180 + c * 170 + (8 if r % 2 else 0)
        y = 120 + r * 170 - (28 if pop > 1 else 0)
        im = blit(im, spr, (x, y), "center")
        if pop > 1:
            st = star_image(120, points=4, inner=0.18, outer=0.48, softness=0.8)
            im = blit(im, st, (x + 70, y - 60), "center")
            im = blit(im, glow_disc(80, (255, 255, 255), 1.8, 0.7), (x, y), "center")
    return flatten(vignette(im, 0.45))


def build_soon():
    w, h = 1280, 720
    im = paint_sky(
        w, h,
        top=(12, 16, 36),
        mid=(24, 28, 58),
        bot=(8, 10, 22),
        glow_a=(56, 70, 120),
        glow_b=(30, 40, 80),
    )
    frame = make_frame().resize((360, 360), Image.Resampling.LANCZOS)
    im = blit(im, frame, (w / 2, h / 2), "center")
    plus = icon_plus(140, (186, 210, 255))
    im = blit(im, plus, (w / 2, h / 2), "center")
    return flatten(vignette(im, 0.55))


def build_logo():
    """Squircle app mark: a mini portal with a runner dot in front. No lettering."""
    im = make_plate(
        256, 256, radius=68, inset=18,
        top=(103, 232, 249), bot=(109, 40, 217),
        glow=(168, 85, 247), sheen=0.4, glow_strength=0.7, ss=2,
    )
    portal = make_plate(
        112, 148, radius=26, inset=6,
        top=(255, 255, 255), bot=(196, 181, 253),
        glow=(255, 255, 255), sheen=0.35, glow_strength=0.15, ss=2,
    )
    im = blit(im, portal, (128, 118), "center")
    glass = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    ImageDraw.Draw(glass).rounded_rectangle((92, 62, 164, 168), radius=18, fill=(18, 10, 48, 210))
    im = Image.alpha_composite(im, glass)
    im = blit(im, glow_disc(70, (103, 232, 249), 1.6, 0.85), (128, 112), "center")
    dot = sphere(54, (255, 255, 255), (255, 255, 255), (34, 211, 238), spec=1.0)
    im = blit(im, dot, (128, 176), "center")
    return im


def check_assets(files):
    problems = []
    for rel in files:
        p = OUT / rel
        if not p.exists():
            problems.append(f"missing {rel}")
            continue
        im = Image.open(p)
        if im.mode != "RGBA":
            problems.append(f"{rel} mode {im.mode}")
        arr = np.array(im)
        # sprites / plates should have at least one transparent corner
        corners = [arr[0, 0, 3], arr[0, -1, 3], arr[-1, 0, 3], arr[-1, -1, 3]]
        if rel.startswith("hub/cover") or rel.startswith("hub/hero"):
            if arr[..., 3].min() < 255:
                problems.append(f"{rel} cover has holes")
        else:
            if max(corners) > 20:
                problems.append(f"{rel} corners not transparent {corners}")
        if arr[..., 3].max() < 200:
            problems.append(f"{rel} fully faint")
    return problems


def preview(paths):
    thumbs = []
    labels = []
    for rel in paths:
        im = Image.open(OUT / rel).convert("RGBA")
        im.thumbnail((180, 180), Image.Resampling.LANCZOS)
        tile = Image.new("RGBA", (200, 210), (12, 14, 28, 255))
        tile.paste(im, ((200 - im.width) // 2, (180 - im.height) // 2), im)
        thumbs.append(tile)
        labels.append(rel)
    cols = 6
    rows = math.ceil(len(thumbs) / cols)
    sheet = Image.new("RGBA", (cols * 200, rows * 210), (8, 10, 20, 255))
    for i, th in enumerate(thumbs):
        sheet.paste(th, ((i % cols) * 200, (i // cols) * 210))
    sheet.convert("RGB").save("/tmp/asset-preview.jpg", quality=86)
    return "/tmp/asset-preview.jpg"


def main():
    doors = {}
    door_specs = [
        ("add", (134, 239, 172), (21, 128, 61), (34, 197, 94), icon_plus),
        ("mul", (216, 180, 254), (91, 33, 182), (168, 85, 247), icon_times),
        ("sub", (252, 165, 165), (153, 27, 27), (239, 68, 68), icon_minus),
        ("div", (251, 113, 133), (136, 19, 55), (225, 29, 72), icon_slash),
        ("bomb", (253, 186, 116), (154, 52, 18), (249, 115, 22), icon_bomb),
        ("shield", (153, 246, 228), (15, 118, 110), (20, 184, 166), icon_shield),
        ("score", (249, 168, 212), (157, 23, 77), (236, 72, 153), icon_star),
    ]
    for name, top, bot, glow, icon in door_specs:
        doors[name] = make_door(384, 512, top, bot, glow, icon)
        save(doors[name], f"number-gate/doors/{name}.png")

    runner0 = make_runner(0)
    runner1 = make_runner(1)
    save(runner0, "number-gate/characters/runner-0.png")
    save(runner1, "number-gate/characters/runner-1.png")

    grunt = make_grunt()
    elite = make_elite()
    boss = make_boss()
    save(grunt, "number-gate/monsters/grunt.png")
    save(elite, "number-gate/monsters/elite.png")
    save(boss, "number-gate/monsters/boss.png")

    # particles — white RGB, shaped alpha, so the games can tint them
    save(glow_disc(128, (255, 255, 255), 2.2, 1.0), "fx/glow.png")
    save(star_image(128, 4, 0.14, 0.46, 0.8), "fx/star.png")
    save(star_image(128, 4, 0.08, 0.42, 0.4), "fx/spark.png")
    save(ring_image(128), "fx/ring.png")
    save(shard_image(128), "fx/shard.png")

    # buttons share geometry; only shading changes
    btn_base = dict(w=288, h=160, radius=36, inset=18)
    primary = dict(top=(103, 232, 249), bot=(109, 40, 217), glow=(139, 92, 246))
    ghost = dict(top=(36, 44, 82), bot=(14, 16, 36), glow=(34, 211, 238))
    variants = {
        "btn-primary": dict(primary, sheen=0.40, glow_strength=0.60, opacity=1),
        "btn-primary-hover": dict(
            top=lighten(primary["top"], 0.18), bot=lighten(primary["bot"], 0.12),
            glow=(216, 180, 254), sheen=0.55, glow_strength=0.85, opacity=1,
        ),
        "btn-primary-pressed": dict(
            top=darken(primary["top"], 0.22), bot=darken(primary["bot"], 0.28),
            glow=(76, 29, 149), sheen=0.10, glow_strength=0.22, opacity=1,
        ),
        "btn-ghost": dict(ghost, sheen=0.16, glow_strength=0.45, opacity=0.92),
        "btn-ghost-hover": dict(
            top=lighten(ghost["top"], 0.22), bot=lighten(ghost["bot"], 0.1),
            glow=(103, 232, 249), sheen=0.28, glow_strength=0.7, opacity=0.96,
        ),
        "btn-ghost-pressed": dict(
            top=darken(ghost["top"], 0.2), bot=darken(ghost["bot"], 0.15),
            glow=(14, 116, 144), sheen=0.05, glow_strength=0.18, opacity=0.94,
        ),
    }
    for name, spec in variants.items():
        im = make_plate(
            btn_base["w"], btn_base["h"], btn_base["radius"], btn_base["inset"],
            spec["top"], spec["bot"], spec["glow"],
            sheen=spec["sheen"], opacity=spec["opacity"], glow_strength=spec["glow_strength"], ss=2,
        )
        save(im, f"ui/{name}.png")

    # circular lane + squircle icon, geometry-locked states
    for name, spec in (
        ("btn-lane", dict(top=(34, 211, 238), bot=(14, 116, 144), glow=(34, 211, 238), sheen=0.38, glow_strength=0.7)),
        ("btn-lane-pressed", dict(top=(14, 116, 144), bot=(8, 47, 73), glow=(8, 80, 100), sheen=0.08, glow_strength=0.25)),
    ):
        save(
            make_plate(256, 256, radius=108, inset=22, top=spec["top"], bot=spec["bot"], glow=spec["glow"],
                       sheen=spec["sheen"], glow_strength=spec["glow_strength"], ss=2),
            f"ui/{name}.png",
        )
    for name, spec in (
        ("btn-icon", dict(top=(32, 40, 78), bot=(12, 14, 32), glow=(168, 85, 247), sheen=0.22, glow_strength=0.5)),
        ("btn-icon-pressed", dict(top=(18, 20, 40), bot=(8, 8, 18), glow=(76, 29, 149), sheen=0.06, glow_strength=0.2)),
    ):
        save(
            make_plate(192, 192, radius=48, inset=16, top=spec["top"], bot=spec["bot"], glow=spec["glow"],
                       sheen=spec["sheen"], glow_strength=spec["glow_strength"], ss=2),
            f"ui/{name}.png",
        )

    save(make_frame(), "ui/hud-frame.png")
    save(
        make_plate(240, 120, radius=28, inset=12, top=(28, 36, 72), bot=(10, 12, 30),
                   glow=(34, 211, 238), sheen=0.16, opacity=0.94, glow_strength=0.4, ss=2),
        "ui/hud-chip.png",
    )
    save(
        make_plate(180, 90, radius=24, inset=10, top=(45, 212, 191), bot=(15, 90, 82),
                   glow=(45, 212, 191), sheen=0.3, glow_strength=0.45, ss=2),
        "ui/badge-cyan.png",
    )
    save(
        make_plate(180, 90, radius=24, inset=10, top=(244, 114, 182), bot=(157, 23, 77),
                   glow=(244, 114, 182), sheen=0.3, glow_strength=0.45, ss=2),
        "ui/badge-pink.png",
    )
    save(
        make_plate(192, 64, radius=18, inset=8, top=(24, 28, 52), bot=(10, 12, 28),
                   glow=(120, 130, 170), sheen=0.08, opacity=0.95, glow_strength=0.15, ss=2),
        "ui/progress-track.png",
    )
    save(
        make_plate(192, 64, radius=18, inset=6, top=(253, 224, 71), bot=(255, 77, 109),
                   glow=(250, 204, 21), sheen=0.45, glow_strength=0.35, ss=2),
        "ui/progress-fill.png",
    )

    block_specs = [
        ("c0", (255, 154, 174), (190, 18, 60), (255, 77, 109)),
        ("c1", (147, 197, 253), (29, 78, 216), (77, 150, 255)),
        ("c2", (134, 239, 172), (21, 128, 61), (107, 203, 119)),
        ("c3", (254, 240, 138), (161, 98, 7), (255, 217, 61)),
        ("c4", (216, 180, 254), (107, 33, 168), (199, 125, 255)),
        ("c5", (253, 186, 116), (154, 52, 18), (255, 140, 66)),
    ]
    blocks = []
    for name, top, bot, glow in block_specs:
        tile = make_tile(192, top, bot, glow)
        blocks.append(tile)
        save(tile, f"samegame/blocks/{name}.png")
    save(make_stone(192), "samegame/blocks/stone.png")

    save(build_logo(), "hub/logo.png")
    save(build_gate_scene(1200, 800, doors, runner0, grunt, hero=True), "hub/hero.png")
    save(build_gate_scene(1280, 720, doors, runner0, grunt, hero=False), "hub/cover-number-gate.png")
    save(build_same_cover(blocks), "hub/cover-samegame.png")
    save(build_soon(), "hub/cover-soon.png")

    files = sorted(str(p.relative_to(OUT)) for p in OUT.rglob("*.png"))
    problems = check_assets(files)
    manifest = {
        "style": "neon-candy",
        "generator": "tools/gen_assets.py",
        "notes": [
            "Procedural Pillow/NumPy. No third-party bitmaps.",
            "UI plates are 9-slice safe: corner radius ends before the slice line, sheen varies on Y only.",
            "Sprites have transparent corners and no baked ground shadow.",
            "Particle PNGs are white RGB with shaped alpha so canvases can tint them.",
            "Runner anchor: feet near 92% height, back view, two run frames.",
            "Monster anchor: body centered, feet/base near 88% height.",
            "Door aspect 3:4. Gameplay numbers are drawn by the canvas, not baked.",
        ],
        "slices": SLICES,
        "files": files,
        "check_problems": problems,
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    sheet = preview([
        "number-gate/doors/add.png",
        "number-gate/doors/mul.png",
        "number-gate/doors/sub.png",
        "number-gate/doors/div.png",
        "number-gate/doors/bomb.png",
        "number-gate/doors/shield.png",
        "number-gate/doors/score.png",
        "number-gate/characters/runner-0.png",
        "number-gate/characters/runner-1.png",
        "number-gate/monsters/grunt.png",
        "number-gate/monsters/elite.png",
        "number-gate/monsters/boss.png",
        "ui/btn-primary.png",
        "ui/btn-primary-hover.png",
        "ui/btn-primary-pressed.png",
        "ui/btn-ghost.png",
        "ui/hud-frame.png",
        "ui/hud-chip.png",
        "samegame/blocks/c0.png",
        "samegame/blocks/c1.png",
        "samegame/blocks/c2.png",
        "samegame/blocks/c3.png",
        "samegame/blocks/c4.png",
        "samegame/blocks/stone.png",
        "fx/glow.png",
        "fx/star.png",
        "fx/spark.png",
        "fx/ring.png",
        "fx/shard.png",
        "hub/logo.png",
        "ui/btn-lane.png",
    ])
    print(f"wrote {len(files)} pngs")
    if problems:
        print("PROBLEMS:")
        for p in problems:
            print(" -", p)
    else:
        print("self-check ok")
    print("preview", sheet)


if __name__ == "__main__":
    main()
