#!/usr/bin/env python3
"""Ad-style sprites for 向末日开炮. Pillow only.

Blue-helmet tactical soldiers (camera sits behind the squad) and
front-facing green zombies / brutes. Feet sit on the bottom edge of each
cell so the renderer can anchor at the projected ground point.

    python3 tools/gen_doom_sprites.py
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "doom-gates"
SPRITE = OUT / "sprites"
SS = 2

INK = (18, 28, 48, 255)
HELM = (37, 99, 235, 255)
HELM_D = (29, 78, 216, 255)
HELM_L = (147, 197, 253, 255)
SUIT = (37, 99, 235, 255)
SUIT_D = (30, 64, 175, 255)
VEST = (15, 23, 42, 255)
BOOT = (15, 23, 42, 255)
SKIN = (253, 186, 146, 255)
GUN = (30, 41, 59, 255)
MUZ = (253, 224, 71, 255)

ZSKIN = (132, 204, 22, 255)
ZSKIN_D = (77, 124, 15, 255)
ZSKIN_L = (190, 242, 100, 255)
VEST_Z = (120, 72, 48, 255)
PANTS = (68, 64, 60, 255)
BRUTE = (101, 163, 13, 255)
BRUTE_D = (63, 98, 18, 255)


def canvas(w: int, h: int) -> Image.Image:
    return Image.new("RGBA", (w * SS, h * SS), (0, 0, 0, 0))


def down(im: Image.Image, w: int, h: int) -> Image.Image:
    return im.resize((w, h), Image.Resampling.LANCZOS)


def rr(d: ImageDraw.ImageDraw, box, r, fill, outline=INK, width=4 * SS):
    d.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)


def ell(d: ImageDraw.ImageDraw, box, fill, outline=INK, width=4 * SS):
    d.ellipse(box, fill=fill, outline=outline, width=width)


def soldier_back(w=240, h=320, phase=0, frames=6, shoot=False, hit=False) -> Image.Image:
    im = canvas(w, h)
    d = ImageDraw.Draw(im)
    s = SS
    swing = math.sin(phase / frames * math.pi * 2)
    cx, foot = 120 * s, (h - 6) * s
    if hit:
        cx += int(10 * s * math.sin(phase))

    def boot(x, lift):
        ell(d, (x - 16 * s, foot - 18 * s - lift, x + 16 * s, foot - lift), BOOT, width=3 * s)

    boot(cx - int((18 + swing * 16) * s), int(max(0, -swing) * 10 * s))
    boot(cx + int((18 - swing * 16) * s), int(max(0, swing) * 10 * s))

    # legs
    rr(d, (cx - 34 * s, foot - 92 * s, cx - 8 * s, foot - 8 * s), 8 * s, SUIT_D, width=3 * s)
    rr(d, (cx + 8 * s, foot - 92 * s, cx + 34 * s, foot - 8 * s), 8 * s, SUIT, width=3 * s)
    # torso
    rr(d, (cx - 46 * s, foot - 176 * s, cx + 46 * s, foot - 78 * s), 16 * s, SUIT)
    rr(d, (cx - 28 * s, foot - 168 * s, cx + 28 * s, foot - 96 * s), 10 * s, VEST, width=3 * s)
    # arms
    arm_y = foot - 150 * s + int(swing * 6 * s)
    rr(d, (cx - 70 * s, arm_y, cx - 40 * s, arm_y + 52 * s), 12 * s, SUIT_D, width=3 * s)
    rr(d, (cx + 40 * s, arm_y - 6 * s, cx + 72 * s, arm_y + 46 * s), 12 * s, SUIT, width=3 * s)
    # rifle
    gun_y = arm_y + 8 * s
    rr(d, (cx + 8 * s, gun_y, cx + 108 * s, gun_y + 14 * s), 4 * s, GUN, width=2 * s)
    rr(d, (cx + 78 * s, gun_y - 16 * s, cx + 96 * s, gun_y + 8 * s), 3 * s, GUN, width=2 * s)
    if shoot and phase % 2 == 0:
        ell(d, (cx + 100 * s, gun_y - 8 * s, cx + 132 * s, gun_y + 18 * s), MUZ, outline=None, width=0)
    # helmet
    ell(d, (cx - 40 * s, foot - 250 * s, cx + 40 * s, foot - 168 * s), HELM)
    ell(d, (cx - 18 * s, foot - 238 * s, cx + 8 * s, foot - 210 * s), HELM_L, outline=None, width=0)
    # neck
    rr(d, (cx - 10 * s, foot - 176 * s, cx + 10 * s, foot - 158 * s), 4 * s, SKIN, width=2 * s)
    return down(im, w, h)


def soldier_front(w=240, h=320) -> Image.Image:
    im = canvas(w, h)
    d = ImageDraw.Draw(im)
    s = SS
    cx, foot = 120 * s, (h - 6) * s
    ell(d, (cx - 22 * s, foot - 20 * s, cx - 2 * s, foot), BOOT, width=3 * s)
    ell(d, (cx + 2 * s, foot - 20 * s, cx + 22 * s, foot), BOOT, width=3 * s)
    rr(d, (cx - 36 * s, foot - 100 * s, cx - 8 * s, foot - 6 * s), 10 * s, SUIT_D, width=3 * s)
    rr(d, (cx + 8 * s, foot - 100 * s, cx + 36 * s, foot - 6 * s), 10 * s, SUIT, width=3 * s)
    rr(d, (cx - 48 * s, foot - 186 * s, cx + 48 * s, foot - 86 * s), 18 * s, SUIT)
    rr(d, (cx - 30 * s, foot - 176 * s, cx + 30 * s, foot - 104 * s), 10 * s, VEST, width=3 * s)
    # face
    ell(d, (cx - 36 * s, foot - 248 * s, cx + 36 * s, foot - 176 * s), SKIN)
    ell(d, (cx - 42 * s, foot - 246 * s, cx + 42 * s, foot - 200 * s), HELM)
    ell(d, (cx - 16 * s, foot - 228 * s, cx - 4 * s, foot - 216 * s), INK, outline=None, width=0)
    ell(d, (cx + 4 * s, foot - 228 * s, cx + 16 * s, foot - 216 * s), INK, outline=None, width=0)
    # smile
    d.arc((cx - 12 * s, foot - 214 * s, cx + 12 * s, foot - 196 * s), 20, 160, fill=INK, width=3 * s)
    # rifle across chest
    rr(d, (cx - 70 * s, foot - 150 * s, cx + 78 * s, foot - 132 * s), 4 * s, GUN, width=2 * s)
    return down(im, w, h)


def soldier_side(w=240, h=320) -> Image.Image:
    im = canvas(w, h)
    d = ImageDraw.Draw(im)
    s = SS
    cx, foot = 128 * s, (h - 6) * s
    ell(d, (cx - 8 * s, foot - 18 * s, cx + 28 * s, foot), BOOT, width=3 * s)
    rr(d, (cx - 16 * s, foot - 96 * s, cx + 16 * s, foot - 8 * s), 8 * s, SUIT_D, width=3 * s)
    rr(d, (cx - 36 * s, foot - 180 * s, cx + 28 * s, foot - 82 * s), 16 * s, SUIT)
    ell(d, (cx - 34 * s, foot - 250 * s, cx + 34 * s, foot - 170 * s), HELM)
    ell(d, (cx + 8 * s, foot - 230 * s, cx + 36 * s, foot - 196 * s), SKIN, width=3 * s)
    rr(d, (cx + 10 * s, foot - 150 * s, cx + 96 * s, foot - 134 * s), 4 * s, GUN, width=2 * s)
    return down(im, w, h)


def zombie_frame(w=250, h=340, phase=0, frames=6, brute=False) -> Image.Image:
    im = canvas(w, h)
    d = ImageDraw.Draw(im)
    s = SS
    swing = math.sin(phase / frames * math.pi * 2)
    cx, foot = (w / 2) * s, (h - 4) * s
    skin = BRUTE if brute else ZSKIN
    skin_d = BRUTE_D if brute else ZSKIN_D
    skin_l = (163, 230, 53, 255) if brute else ZSKIN_L
    scale = 1.12 if brute else 1.0
    reach = int((22 if brute else 16) * s)

    def foot_boot(x, lift):
        ell(d, (x - 18 * s, foot - 16 * s - lift, x + 18 * s, foot - lift), BOOT, width=3 * s)

    foot_boot(cx - int((20 + swing * 18) * s), int(max(0, -swing) * 8 * s))
    foot_boot(cx + int((20 - swing * 18) * s), int(max(0, swing) * 8 * s))
    rr(d, (cx - 34 * s, foot - 108 * s, cx - 6 * s, foot - 8 * s), 8 * s, PANTS, width=3 * s)
    rr(d, (cx + 6 * s, foot - 108 * s, cx + 34 * s, foot - 8 * s), 8 * s, PANTS, width=3 * s)
    body_w = int(52 * scale)
    rr(d, (cx - body_w * s, foot - 196 * s, cx + body_w * s, foot - 90 * s), 18 * s, skin)
    # torn vest
    rr(d, (cx - 30 * s, foot - 184 * s, cx + 34 * s, foot - 112 * s), 8 * s, VEST_Z, width=3 * s)
    # tear
    d.polygon(
        [
            (cx - 8 * s, foot - 150 * s),
            (cx + 10 * s, foot - 168 * s),
            (cx + 6 * s, foot - 128 * s),
        ],
        fill=skin,
    )
    # arms reaching forward
    ay = foot - 160 * s + int(swing * 8 * s)
    rr(d, (cx - body_w * s - reach, ay, cx - body_w * s + 8 * s, ay + 22 * s), 10 * s, skin_d, width=3 * s)
    rr(d, (cx + body_w * s - 8 * s, ay - int(swing * 10 * s), cx + body_w * s + reach, ay + 18 * s), 10 * s, skin, width=3 * s)
    # head
    hr = int((42 if brute else 36) * s)
    ell(d, (cx - hr, foot - 250 * s - (8 * s if brute else 0), cx + hr, foot - 168 * s), skin)
    ell(d, (cx - hr * 0.45, foot - 236 * s, cx - hr * 0.05, foot - 214 * s), skin_l, outline=None, width=0)
    # eyes
    ew = 14 * s
    ell(d, (cx - 24 * s, foot - 230 * s, cx - 24 * s + ew, foot - 214 * s), (255, 255, 255, 255), width=2 * s)
    ell(d, (cx + 8 * s, foot - 230 * s, cx + 8 * s + ew, foot - 214 * s), (255, 255, 255, 255), width=2 * s)
    ell(d, (cx - 16 * s, foot - 226 * s, cx - 8 * s, foot - 218 * s), INK, outline=None, width=0)
    ell(d, (cx + 16 * s, foot - 226 * s, cx + 24 * s, foot - 218 * s), INK, outline=None, width=0)
    # mouth
    rr(d, (cx - 16 * s, foot - 206 * s, cx + 16 * s, foot - 188 * s), 4 * s, (30, 20, 20, 255), width=2 * s)
    d.rectangle((cx - 12 * s, foot - 202 * s, cx + 12 * s, foot - 196 * s), fill=(240, 240, 240, 255))
    if brute:
        # brow
        d.line((cx - 28 * s, foot - 236 * s, cx - 8 * s, foot - 228 * s), fill=INK, width=4 * s)
        d.line((cx + 8 * s, foot - 228 * s, cx + 28 * s, foot - 236 * s), fill=INK, width=4 * s)
    return down(im, w, h)


def hstack(frames: list[Image.Image]) -> Image.Image:
    w = sum(f.width for f in frames)
    h = frames[0].height
    sheet = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    x = 0
    for f in frames:
        sheet.alpha_composite(f, (x, 0))
        x += f.width
    return sheet


def save(im: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "PNG")
    print(path.relative_to(ROOT), im.size)


def main() -> None:
    plates = Path(__file__).resolve().parent / "plates"
    if (plates / "soldier-back.jpg").exists():
        import runpy
        runpy.run_path(str(Path(__file__).resolve().parent / "pack_ad_sprites.py"), run_name="__main__")
        return
    front = soldier_front()
    side = soldier_side()
    back = soldier_back(phase=0, frames=1)
    idle = [soldier_back(phase=i, frames=4) for i in range(4)]
    run = [soldier_back(phase=i, frames=6) for i in range(6)]
    shoot = [soldier_back(phase=i, frames=6, shoot=True) for i in range(6)]
    hit = [soldier_back(phase=i, frames=3, hit=True) for i in range(3)]
    zombies = [zombie_frame(phase=i) for i in range(6)]
    brutes = [zombie_frame(w=320, h=370, phase=i, brute=True) for i in range(6)]
    save(front, SPRITE / "soldier-front.png")
    save(side, SPRITE / "soldier-side.png")
    save(back, SPRITE / "soldier-back.png")
    save(hstack(idle), SPRITE / "soldier-idle.png")
    save(hstack(run), SPRITE / "soldier-run.png")
    save(hstack(shoot), SPRITE / "soldier-shoot.png")
    save(hstack(hit), SPRITE / "soldier-hit.png")
    save(hstack(zombies), SPRITE / "zombie-walk.png")
    save(hstack(brutes), SPRITE / "brute-walk.png")
    save(back, OUT / "soldier-0.png")
    save(front, OUT / "soldier-1.png")
    save(zombies[0], OUT / "zombie.png")
    save(brutes[0], OUT / "brute.png")


if __name__ == "__main__":
    main()
