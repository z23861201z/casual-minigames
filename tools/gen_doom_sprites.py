#!/usr/bin/env python3
"""Original ad-style sprites for 向末日开炮. Pillow only — no downloaded art.

    python3 tools/gen_doom_sprites.py

Thick ink, saturated flats, simple top-left light. Transparent backgrounds.
Action sheets are equal horizontal cells with feet near the bottom edge.

Gameplay camera sits behind the squad, so idle/run/shoot/hit are BACK views.
front/side/back are the neutral turnaround. Run and shoot share a phase so
the legs do not pop when a shot flash starts (shoot = same pose + muzzle).

Sheets
  assets/doom-gates/sprites/soldier-front.png    1 × 240×320
  assets/doom-gates/sprites/soldier-side.png     1 × 240×320
  assets/doom-gates/sprites/soldier-back.png     1 × 240×320
  assets/doom-gates/sprites/soldier-idle.png     4 × 240×320
  assets/doom-gates/sprites/soldier-run.png      6 × 240×320
  assets/doom-gates/sprites/soldier-shoot.png    6 × 240×320
  assets/doom-gates/sprites/soldier-hit.png      3 × 240×320
  assets/doom-gates/sprites/zombie-walk.png      6 × 250×340
  assets/doom-gates/sprites/brute-walk.png       6 × 320×370
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "doom-gates"
SPRITE = OUT / "sprites"

SCALE = 4

# Ink and a short saturated palette. Light comes from the upper left.
INK = (22, 18, 32, 255)
SKIN = (255, 198, 158, 255)
SKIN_S = (214, 132, 96, 255)
SKIN_H = (255, 228, 206, 255)
SUIT = (42, 126, 255, 255)
SUIT_S = (16, 72, 196, 255)
SUIT_H = (150, 204, 255, 255)
VEST = (16, 44, 112, 255)
HELM = (58, 74, 108, 255)
HELM_S = (28, 38, 64, 255)
HELM_H = (168, 190, 224, 255)
VISOR = (70, 230, 255, 255)
VISOR_S = (0, 140, 180, 255)
PACK = (255, 164, 28, 255)
PACK_S = (196, 96, 8, 255)
PACK_H = (255, 214, 120, 255)
OLIVE = (96, 146, 64, 255)
OLIVE_S = (52, 96, 36, 255)
OLIVE_H = (176, 214, 120, 255)
BOOT = (36, 32, 48, 255)
BOOT_S = (16, 14, 24, 255)
BOOT_H = (96, 92, 112, 255)
PAD = (236, 240, 246, 255)
PAD_S = (160, 168, 184, 255)
PAD_H = (255, 255, 255, 255)
GLOVE = (32, 36, 52, 255)
GLOVE_S = (16, 18, 28, 255)
GLOVE_H = (88, 96, 120, 255)
GUN = (72, 80, 96, 255)
GUN_S = (32, 36, 48, 255)
GUN_H = (196, 204, 216, 255)
GOLD = (255, 204, 48, 255)
GOLD_S = (196, 124, 8, 255)
TEAL = (36, 168, 176, 255)
TEAL_S = (12, 96, 112, 255)
TEAL_H = (160, 240, 232, 255)

ZSKIN = (132, 208, 64, 255)
ZSKIN_S = (64, 132, 28, 255)
ZSKIN_H = (208, 240, 130, 255)
ZRAG = (86, 98, 122, 255)
ZRAG_S = (46, 52, 72, 255)
ZRAG_H = (156, 168, 190, 255)
MOUTH = (92, 16, 28, 255)
BLOOD = (196, 36, 44, 255)
TOOTH = (255, 248, 236, 255)
EYE = (255, 252, 246, 255)
PUPIL = (18, 16, 24, 255)

BSKIN = (78, 138, 48, 255)
BSKIN_S = (40, 84, 28, 255)
BSKIN_H = (156, 196, 96, 255)
BVEST = (214, 48, 52, 255)
BVEST_S = (132, 16, 28, 255)
BVEST_H = (255, 140, 120, 255)
BONE = (236, 224, 196, 255)
BONE_S = (176, 156, 120, 255)


class CV:
    def __init__(self, w: int, h: int, scale: int = SCALE):
        self.w = w
        self.h = h
        self.s = scale
        self.im = Image.new("RGBA", (w * scale, h * scale), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.im)

    def _pt(self, p):
        return (p[0] * self.s, p[1] * self.s)

    def _box(self, box):
        s = self.s
        return (box[0] * s, box[1] * s, box[2] * s, box[3] * s)

    def poly(self, pts, fill) -> None:
        if len(pts) < 3:
            return
        self.d.polygon([self._pt(p) for p in pts], fill=fill)

    def ellipse(self, box, fill) -> None:
        self.d.ellipse(self._box(box), fill=fill)

    def line(self, p0, p1, fill, width: float) -> None:
        self.d.line([self._pt(p0), self._pt(p1)], fill=fill, width=max(1, int(width * self.s)), joint="curve")

    def export(self) -> Image.Image:
        return _resize_rgba(self.im, (self.w, self.h))


def _resize_rgba(im: Image.Image, size: tuple[int, int]) -> Image.Image:
    """Downscale in premultiplied alpha so ink edges stay clean."""
    arr = np.asarray(im).astype(np.float32)
    alpha = arr[:, :, 3:4] / 255.0
    pre = arr.copy()
    pre[:, :, :3] *= alpha
    small = Image.fromarray(np.clip(pre, 0, 255).astype(np.uint8), "RGBA").resize(
        size, Image.Resampling.LANCZOS
    )
    out = np.asarray(small).astype(np.float32)
    a = out[:, :, 3:4]
    color = np.zeros_like(out[:, :, :3])
    mask = a[:, :, 0] > 2
    color[mask] = np.clip(out[:, :, :3][mask] * 255.0 / a[:, :, 0][mask][:, None], 0, 255)
    rgb = np.where(mask[:, :, None], color, 0)
    merged = np.dstack([rgb, out[:, :, 3]]).astype(np.uint8)
    return Image.fromarray(merged, "RGBA")


def tapered(p0, p1, r0: float, r1: float, steps: int = 12):
    x0, y0 = p0
    x1, y1 = p1
    dx, dy = x1 - x0, y1 - y0
    length = math.hypot(dx, dy)
    if length < 0.4:
        pts = []
        for i in range(steps * 2):
            a = i * math.tau / (steps * 2)
            pts.append((x0 + math.cos(a) * r0, y0 + math.sin(a) * r0))
        return pts
    ang = math.atan2(dy, dx)
    pts = []
    for i in range(steps + 1):
        a = ang - math.pi / 2 + math.pi * i / steps
        pts.append((x1 + math.cos(a) * r1, y1 + math.sin(a) * r1))
    for i in range(steps + 1):
        a = ang + math.pi / 2 + math.pi * i / steps
        pts.append((x0 + math.cos(a) * r0, y0 + math.sin(a) * r0))
    return pts


def limb(cv: CV, p0, p1, r0, r1, fill, shadow, hi, ow: float = 7) -> None:
    cv.poly(tapered(p0, p1, r0 + ow, r1 + ow), INK)
    cv.poly(tapered(p0, p1, r0, r1), shadow)
    s0 = (p0[0] - 1.8, p0[1] - 2.2)
    s1 = (p1[0] - 1.6, p1[1] - 2.0)
    cv.poly(tapered(s0, s1, max(1, r0 * 0.84), max(1, r1 * 0.84)), fill)
    h0 = (p0[0] - r0 * 0.22, p0[1] - r0 * 0.28)
    h1 = (p1[0] - r1 * 0.18, p1[1] - r1 * 0.24)
    cv.poly(tapered(h0, h1, max(1, r0 * 0.26), max(1, r1 * 0.2)), hi)


def ball(cv: CV, box, fill, shadow, hi, ow: float = 7) -> None:
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    cv.ellipse((x0 - ow, y0 - ow, x1 + ow, y1 + ow), INK)
    cv.ellipse(box, shadow)
    if w < 10 or h < 10:
        cv.ellipse((x0 + 1, y0 + 1, x1 - 1, y1 - 1), fill)
        return
    cv.ellipse((x0 + 1.4, y0 + 1.0, x1 - 3.6, y1 - 4.2), fill)
    cv.ellipse((x0 + w * 0.22, y0 + h * 0.12, x0 + w * 0.62, y0 + h * 0.46), hi)


def dot(cv: CV, box, fill, ow: float = 3) -> None:
    x0, y0, x1, y1 = box
    cv.ellipse((x0 - ow, y0 - ow, x1 + ow, y1 + ow), INK)
    cv.ellipse(box, fill)


def joint(origin, deg: float, length: float):
    r = math.radians(deg)
    return (origin[0] + math.sin(r) * length, origin[1] + math.cos(r) * length)


def star(cx, cy, r_out, r_in, n: int = 8):
    pts = []
    for i in range(n * 2):
        r = r_out if i % 2 == 0 else r_in
        a = -math.pi / 2 + i * math.pi / n
        pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    return pts


def xf(origin, angle_deg: float, scale: float, x: float, y: float):
    a = math.radians(angle_deg)
    ca, sa = math.cos(a), math.sin(a)
    return (origin[0] + (x * ca - y * sa) * scale, origin[1] + (x * sa + y * ca) * scale)


def draw_rifle(cv: CV, origin, angle_deg: float, flash: float = 0, scale: float = 1.0) -> None:
    """Rifle in local space: +x is the barrel, origin sits on the grip."""

    def L(x, y):
        return xf(origin, angle_deg, scale, x, y)

    limb(cv, L(-34, 6), L(-6, 0), 8 * scale, 7 * scale, GUN_S, GUN_S, GUN, ow=5)
    limb(cv, L(-4, 1), L(36, 0), 10 * scale, 8 * scale, GUN, GUN_S, GUN_H, ow=5)
    limb(cv, L(30, 0), L(90, -1), 5.5 * scale, 4.2 * scale, GUN, GUN_S, GUN_H, ow=4.5)
    limb(cv, L(14, 6), L(20, 32), 6 * scale, 5 * scale, GUN_S, (20, 22, 32, 255), GUN, ow=4)
    limb(cv, L(2, 8), L(8, 30), 6.5 * scale, 5 * scale, GUN_S, (20, 22, 32, 255), GUN, ow=4)
    # Front sight and a gold receiver pin.
    limb(cv, L(26, -10), L(36, -9), 3.2 * scale, 2.4 * scale, GUN_H, GUN, GUN_H, ow=3)
    dot(cv, (L(18, -2)[0] - 3, L(18, -2)[1] - 3, L(18, -2)[0] + 3, L(18, -2)[1] + 3), GOLD, ow=2)
    if flash > 0:
        mx, my = L(96, 0)
        glow = 18 * scale * (0.7 + flash)
        cv.ellipse((mx - glow, my - glow, mx + glow, my + glow), (255, 186, 40, 180))
        cv.poly(star(mx, my, 26 * scale * flash + 8, 8 * scale, 8), (255, 244, 180, 255))
        cv.poly(star(mx, my, 12 * scale, 4 * scale, 8), (255, 255, 255, 255))
        # Hot core sits in front of the muzzle, not an outlined blob.
        cv.ellipse((mx - 6, my - 6, mx + 6, my + 6), (255, 255, 255, 255))


def glove(cv: CV, center, radius: float = 9) -> None:
    x, y = center
    ball(cv, (x - radius, y - radius * 0.85, x + radius, y + radius * 0.7), GLOVE, GLOVE_S, GLOVE_H, ow=4)


def boot_stamp(cv: CV, foot, spread: float, toe: float = 1.0) -> None:
    """Chunky boot. `spread` is the outward screen direction, `toe` points away from camera (+1 down-screen)."""
    fx, fy = foot
    ball(cv, (fx - 13, fy - 8, fx + 13, fy + 9), BOOT, BOOT_S, BOOT_H, ow=5)
    # Sole toward the viewer / step direction.
    sole = (fx + spread * 2, fy + 6 * toe)
    ball(cv, (sole[0] - 11, sole[1] - 5, sole[0] + 11, sole[1] + 6), BOOT_S, (8, 8, 14, 255), BOOT, ow=3)


def knee_pad(cv: CV, knee) -> None:
    x, y = knee
    ball(cv, (x - 9, y - 8, x + 9, y + 8), PAD, PAD_S, PAD_H, ow=3.5)


# --- poses -----------------------------------------------------------------

def run_pose(i: int, n: int = 6) -> dict:
    # Six distinct strides. Positive lift raises that knee; kick trails the other foot.
    keys = (
        dict(lift_l=0.08, lift_r=0.0, kick_l=0.0, kick_r=0.9, bob=-1, sway=5, arm=1.0),
        dict(lift_l=1.0, lift_r=0.0, kick_l=0.0, kick_r=0.45, bob=-15, sway=7, arm=-0.15),
        dict(lift_l=0.28, lift_r=0.22, kick_l=0.15, kick_r=0.2, bob=-7, sway=1, arm=0.35),
        dict(lift_l=0.0, lift_r=0.08, kick_l=0.9, kick_r=0.0, bob=-1, sway=-5, arm=-1.0),
        dict(lift_l=0.0, lift_r=1.0, kick_l=0.45, kick_r=0.0, bob=-15, sway=-7, arm=0.15),
        dict(lift_l=0.22, lift_r=0.28, kick_l=0.2, kick_r=0.15, bob=-7, sway=-1, arm=-0.35),
    )
    pose = dict(keys[i % len(keys)])
    pose.update(recoil=0.0, flash=0.0, flinch=0.0, breathe=1.0)
    pose["leg"] = pose["lift_l"] - pose["lift_r"]
    return pose


def shoot_pose(i: int, n: int = 6) -> dict:
    pose = run_pose(i, n)
    # Alternate a hard flash and a smaller one so a single visible frame still reads as fire.
    pose["recoil"] = 0.65 + 0.35 * (i % 2)
    pose["flash"] = 0.85 if i % 2 == 0 else 1.0
    pose["bob"] -= 2
    return pose


def idle_pose(i: int) -> dict:
    bobs = (0, -3.5, -5, -2)
    sways = (0, 1.5, 0, -1.5)
    breaths = (1.0, 1.025, 1.04, 1.015)
    return {
        "bob": bobs[i],
        "sway": sways[i],
        "leg": 0.08 * (1 if i % 2 == 0 else -1),
        "recoil": 0.0,
        "flash": 0.0,
        "flinch": 0.0,
        "breathe": breaths[i],
    }


def hit_pose(i: int) -> dict:
    return {
        "bob": (0, -2, 0)[i],
        "sway": (10, 6, 2)[i],
        "leg": (-0.15, 0.05, 0.0)[i],
        "recoil": 0.2,
        "flash": 0.0,
        "flinch": (1.0, 0.72, 0.28)[i],
        "breathe": 1.0,
    }


def neutral_pose() -> dict:
    return {"bob": 0, "sway": 0, "leg": 0.05, "recoil": 0, "flash": 0, "flinch": 0, "breathe": 1}


def walk_pose(i: int, n: int = 6, heavy: bool = False) -> dict:
    keys = (
        dict(lift_l=0.12, lift_r=0.0, reach_l=0.15, reach_r=1.0, bob=-2, sway=-7),
        dict(lift_l=1.0, lift_r=0.0, reach_l=0.05, reach_r=0.85, bob=-14, sway=-9),
        dict(lift_l=0.2, lift_r=0.35, reach_l=0.55, reach_r=0.35, bob=-6, sway=-2),
        dict(lift_l=0.0, lift_r=0.12, reach_l=1.0, reach_r=0.15, bob=-2, sway=7),
        dict(lift_l=0.0, lift_r=1.0, reach_l=0.85, reach_r=0.05, bob=-14, sway=9),
        dict(lift_l=0.35, lift_r=0.2, reach_l=0.35, reach_r=0.55, bob=-6, sway=2),
    )
    pose = dict(keys[i % len(keys)])
    if heavy:
        pose["bob"] = int(pose["bob"] * 1.25)
        pose["sway"] = pose["sway"] * 1.15
    pose["leg"] = pose["lift_l"] - pose["lift_r"]
    pose["heavy"] = heavy
    return pose


# --- soldier ---------------------------------------------------------------

def draw_soldier_back(pose: dict, cell=(240, 320)) -> Image.Image:
    W, H = cell
    cv = CV(W, H)
    cx = W * 0.5 + pose["sway"] + pose["flinch"] * 6
    bob = pose["bob"]
    flinch = pose["flinch"]
    recoil = pose["recoil"]
    leg = pose["leg"]
    breathe = pose.get("breathe", 1)

    hip_y = 198 + bob
    shoulder_y = 128 + bob + flinch * 10
    # Breathe widens the chest slightly without moving the feet.
    half = 38 * breathe

    lift_l = pose.get("lift_l", max(0.0, leg))
    lift_r = pose.get("lift_r", max(0.0, -leg))
    kick_l = pose.get("kick_l", 0.0)
    kick_r = pose.get("kick_r", 0.0)

    def leg_chain(hip, lift, kick, outward):
        knee = (
            hip[0] + outward * (8 + lift * 16 + kick * 5),
            hip[1] + 50 * (1 - 0.52 * lift - 0.12 * kick),
        )
        foot = (
            knee[0] + outward * (5 + kick * 14 - lift * 4),
            knee[1] + 54 * (1 - 0.72 * lift - 0.58 * kick),
        )
        return knee, foot

    hl = (cx - 16, hip_y)
    hr = (cx + 18, hip_y)
    lk, lf = leg_chain(hl, lift_l, kick_l, -1)
    rk, rf = leg_chain(hr, lift_r, kick_r, 1)
    # Thighs then boots. Pads mark the knee so the stride reads small.
    limb(cv, hl, lk, 15, 11, SUIT, SUIT_S, SUIT_H, ow=6)
    limb(cv, lk, lf, 12, 9, SUIT, SUIT_S, SUIT_H, ow=6)
    limb(cv, hr, rk, 15, 11, SUIT, SUIT_S, SUIT_H, ow=6)
    limb(cv, rk, rf, 12, 9, SUIT, SUIT_S, SUIT_H, ow=6)
    if lift_l > 0.25:
        knee_pad(cv, lk)
    if lift_r > 0.25:
        knee_pad(cv, rk)
    boot_stamp(cv, lf, -1, toe=1 if lift_l < 0.4 else -0.2)
    boot_stamp(cv, rf, 1, toe=1 if lift_r < 0.4 else -0.2)

    # Torso, then the amber pack that makes the back view readable.
    ball(cv, (cx - half, shoulder_y - 4, cx + half + 4, hip_y + 18), SUIT, SUIT_S, SUIT_H, ow=8)
    # Shoulder caps.
    ball(cv, (cx - half - 6, shoulder_y - 2, cx - 6, shoulder_y + 28), SUIT, SUIT_S, SUIT_H, ow=5)
    ball(cv, (cx + 8, shoulder_y - 4, cx + half + 10, shoulder_y + 26), SUIT, SUIT_S, SUIT_H, ow=5)

    pack_top = shoulder_y + 16
    pack_bot = hip_y - 2
    ball(cv, (cx - 30, pack_top, cx + 32, pack_bot), PACK, PACK_S, PACK_H, ow=7)
    # Bedroll lashed across the top of the pack.
    limb(cv, (cx - 24, pack_top + 2), (cx + 26, pack_top + 4), 9, 9, OLIVE, OLIVE_S, OLIVE_H, ow=4)
    # Strap and gold buckle.
    cv.line((cx, pack_top + 14), (cx, pack_bot - 10), PACK_S, 5)
    dot(cv, (cx - 7, pack_top + 28, cx + 7, pack_top + 42), GOLD, ow=3)
    # Teal canteen on the pack's right edge.
    ball(cv, (cx + 22, pack_top + 28, cx + 40, pack_bot - 6), TEAL, TEAL_S, TEAL_H, ow=4)
    dot(cv, (cx + 26, pack_top + 30, cx + 36, pack_top + 38), TEAL_H, ow=2)

    # Neck and helmet. Antenna breaks the round silhouette.
    ball(cv, (cx - 10, shoulder_y - 18, cx + 12, shoulder_y + 8), SKIN, SKIN_S, SKIN_H, ow=4)
    helm_box = (cx - 40, 28 + bob * 0.6 + flinch * 8, cx + 42, 118 + bob * 0.6 + flinch * 8)
    ball(cv, helm_box, HELM, HELM_S, HELM_H, ow=8)
    # Rear strap.
    band_y = helm_box[1] + 58
    ball(cv, (cx - 42, band_y, cx + 44, band_y + 16), HELM_S, (16, 20, 36, 255), HELM, ow=4)
    # Goggle strap hint (cyan sliver at the side of the helmet).
    dot(cv, (cx + 28, band_y - 6, cx + 40, band_y + 8), VISOR, ow=3)
    ax, ay = cx + 8, helm_box[1] + 8
    limb(cv, (ax, ay + 8), (ax + 3, ay - 2), 3.2, 2.6, HELM_S, HELM_S, HELM_H, ow=3)
    dot(cv, (ax - 1, ay - 8, ax + 9, ay + 2), GOLD, ow=2.5)

    # Free arm (screen left) pumps opposite the left leg. Gun arm stays up.
    sl = (cx - 30, shoulder_y + 8)
    swing = pose.get("arm", -leg)
    elbow = (sl[0] - 14 + swing * 8, sl[1] + 32 - abs(swing) * 8 - flinch * 6)
    hand = (elbow[0] + swing * 16, elbow[1] + 28 - max(0.0, swing) * 16 + flinch * 8)
    limb(cv, sl, elbow, 12, 10, SUIT, SUIT_S, SUIT_H, ow=5.5)
    limb(cv, elbow, hand, 10, 8, SUIT, SUIT_S, SUIT_H, ow=5)
    glove(cv, hand, 8)

    sr = (cx + 32, shoulder_y + 6)
    ge = (sr[0] + 26, sr[1] + 20 + recoil * 8 + flinch * 4)
    gh = (sr[0] + 10, sr[1] - 4 + recoil * 20 + flinch * 12)
    limb(cv, sr, ge, 12, 10, SUIT, SUIT_S, SUIT_H, ow=5.5)
    limb(cv, ge, gh, 10, 8, SUIT, SUIT_S, SUIT_H, ow=5)
    # Rifle points up the road. Recoil shoves the grip down; flash sits at the muzzle.
    draw_rifle(cv, (gh[0] + 4, gh[1] + 2), -90 + recoil * 10, flash=pose["flash"], scale=0.92)
    glove(cv, gh, 8)

    im = cv.export()
    if flinch > 0:
        im = _wash(im, flinch * 0.18, (255, 236, 236))
        mark = CV(W, H)
        mx, my = cx - 4, (pack_top + pack_bot) * 0.5
        mark.poly(star(mx, my, 22 + 8 * flinch, 8, 7), (255, 72, 64, 255))
        mark.poly(star(mx, my, 10, 3, 7), (255, 244, 210, 255))
        im = Image.alpha_composite(im, mark.export())
    return im


def draw_soldier_front(cell=(240, 320)) -> Image.Image:
    W, H = cell
    cv = CV(W, H)
    cx = W * 0.5
    hip_y = 206
    shoulder_y = 132

    def planted(hip, outward):
        knee = (hip[0] + outward * 6, hip[1] + 46)
        foot = (knee[0] + outward * 10, knee[1] + 52)
        return knee, foot

    hl, hr = (cx - 16, hip_y), (cx + 16, hip_y)
    lk, lf = planted(hl, -1)
    rk, rf = planted(hr, 1)
    for hip, knee, foot in ((hl, lk, lf), (hr, rk, rf)):
        limb(cv, hip, knee, 15, 11, SUIT, SUIT_S, SUIT_H, ow=6)
        limb(cv, knee, foot, 12, 9, SUIT, SUIT_S, SUIT_H, ow=6)
        knee_pad(cv, knee)
        boot_stamp(cv, foot, 1 if foot[0] > cx else -1, toe=0.3)

    ball(cv, (cx - 40, shoulder_y, cx + 40, hip_y + 16), SUIT, SUIT_S, SUIT_H, ow=8)
    # Vest and three pouches — the front reads as gear, not a blue oval.
    ball(cv, (cx - 30, shoulder_y + 16, cx + 30, hip_y - 4), VEST, (8, 24, 64, 255), SUIT, ow=5)
    for i, px in enumerate((-18, 0, 16)):
        ball(cv, (cx + px - 10, shoulder_y + 36 + (i == 1) * 4, cx + px + 10, shoulder_y + 62), OLIVE, OLIVE_S, OLIVE_H, ow=3)
    dot(cv, (cx - 8, hip_y - 16, cx + 8, hip_y - 2), GOLD, ow=3)

    # Arms crossed into the rifle. Screen-right arm is the firing hand.
    sl = (cx - 36, shoulder_y + 12)
    le = (cx - 18, shoulder_y + 48)
    lh = (cx + 6, shoulder_y + 58)
    limb(cv, sl, le, 12, 10, SUIT, SUIT_S, SUIT_H, ow=5)
    limb(cv, le, lh, 10, 8, SUIT, SUIT_S, SUIT_H, ow=5)
    sr = (cx + 36, shoulder_y + 10)
    re = (cx + 28, shoulder_y + 42)
    rh = (cx + 8, shoulder_y + 34)
    limb(cv, sr, re, 12, 10, SUIT, SUIT_S, SUIT_H, ow=5)
    limb(cv, re, rh, 10, 8, SUIT, SUIT_S, SUIT_H, ow=5)

    draw_rifle(cv, (cx + 18, shoulder_y + 46), -58, flash=0, scale=0.95)
    glove(cv, lh, 8)
    glove(cv, rh, 8)

    # Head, jaw, goggles. Helmet covers the hair; the jaw keeps him adult.
    ball(cv, (cx - 11, shoulder_y - 16, cx + 11, shoulder_y + 6), SKIN, SKIN_S, SKIN_H, ow=4)
    face = (cx - 36, 58, cx + 36, 132)
    ball(cv, face, SKIN, SKIN_S, SKIN_H, ow=7)
    # Ears peek out under the helmet line.
    ball(cv, (cx - 42, 96, cx - 28, 116), SKIN, SKIN_S, SKIN_H, ow=3)
    ball(cv, (cx + 28, 96, cx + 42, 116), SKIN, SKIN_S, SKIN_H, ow=3)
    ball(cv, (cx - 44, 36, cx + 44, 112), HELM, HELM_S, HELM_H, ow=8)
    # Brim.
    ball(cv, (cx - 48, 78, cx + 48, 102), HELM_S, (14, 18, 32, 255), HELM, ow=4)
    # Goggles.
    dot(cv, (cx - 30, 80, cx - 6, 104), VISOR_S, ow=4)
    dot(cv, (cx + 6, 80, cx + 30, 104), VISOR_S, ow=4)
    dot(cv, (cx - 26, 84, cx - 10, 100), VISOR, ow=2)
    dot(cv, (cx + 10, 84, cx + 26, 100), VISOR, ow=2)
    cv.ellipse((cx - 22, 86, cx - 16, 92), (255, 255, 255, 230))
    cv.ellipse((cx + 14, 86, cx + 20, 92), (255, 255, 255, 230))
    # Nose shadow and a firm mouth. No smile.
    cv.poly([(cx - 3, 108), (cx + 3, 108), (cx, 116)], SKIN_S)
    cv.line((cx - 10, 122), (cx + 10, 122), (120, 64, 64, 255), 3)
    # Antenna.
    limb(cv, (cx + 10, 40), (cx + 16, 18), 3.5, 3, HELM_S, HELM_S, HELM_H, ow=3)
    dot(cv, (cx + 10, 8, cx + 22, 20), GOLD, ow=3)
    return cv.export()


def draw_soldier_side(cell=(240, 320)) -> Image.Image:
    """Strict right profile: nose, chest and toes point at the right edge."""
    W, H = cell
    cv = CV(W, H)
    bob = 0
    # Placed left of center so the rifle, pointing right, stays inside the cell.
    hip = (84, 206 + bob)
    shoulder = (92, 136 + bob)
    head_c = (100, 86)

    # Far leg trails, near leg is forward. Draw far limbs first.
    far_knee = joint(hip, -28, 50)
    far_foot = joint(far_knee, -18, 50)
    near_knee = joint((hip[0] + 4, hip[1]), 36, 48)
    near_foot = joint(near_knee, 8, 50)

    far_elbow = joint((shoulder[0] - 4, shoulder[1]), -20, 40)
    far_hand = joint(far_elbow, 16, 36)

    limb(cv, (hip[0] - 2, hip[1]), far_knee, 14, 11, SUIT, SUIT_S, SUIT_H, ow=6)
    limb(cv, far_knee, far_foot, 11, 8, SUIT, SUIT_S, SUIT_H, ow=5)
    boot_profile(cv, far_foot, 0.85)
    limb(cv, (shoulder[0] - 2, shoulder[1] + 4), far_elbow, 11, 9, SUIT, SUIT_S, SUIT_H, ow=5)
    limb(cv, far_elbow, far_hand, 9, 7, SUIT, SUIT_S, SUIT_H, ow=4)
    glove(cv, far_hand, 7)

    # Pack sits behind the chest (screen left).
    ball(cv, (hip[0] - 46, shoulder[1] + 8, hip[0] - 4, hip[1] + 4), PACK, PACK_S, PACK_H, ow=6)
    limb(cv, (hip[0] - 40, shoulder[1] + 10), (hip[0] - 8, shoulder[1] + 12), 8, 8, OLIVE, OLIVE_S, OLIVE_H, ow=4)

    # Profile torso: back edge left, chest bumps right.
    torso = [
        (shoulder[0] - 8, shoulder[1] - 4),
        (shoulder[0] + 26, shoulder[1] + 8),
        (shoulder[0] + 22, shoulder[1] + 48),
        (hip[0] + 18, hip[1] + 4),
        (hip[0] - 16, hip[1] + 6),
        (shoulder[0] - 24, shoulder[1] + 36),
    ]
    outlined(cv, torso, SUIT, SUIT_S, ow=8)
    # Chest highlight.
    ball(cv, (shoulder[0] + 2, shoulder[1] + 12, shoulder[0] + 22, shoulder[1] + 36), SUIT_H, SUIT, SUIT_H, ow=2)
    ball(cv, (hip[0] - 6, hip[1] - 22, hip[0] + 14, hip[1] - 4), GOLD, GOLD_S, (255, 236, 170, 255), ow=3)

    # Near leg overlaps the hip.
    limb(cv, (hip[0] + 2, hip[1]), near_knee, 15, 12, SUIT, SUIT_S, SUIT_H, ow=6)
    limb(cv, near_knee, near_foot, 12, 9, SUIT, SUIT_S, SUIT_H, ow=6)
    knee_pad(cv, near_knee)
    boot_profile(cv, near_foot, 1.0)

    # Neck, head, helmet with a forward brim, one goggle, a nose.
    ball(cv, (shoulder[0] - 4, shoulder[1] - 18, shoulder[0] + 14, shoulder[1] + 4), SKIN, SKIN_S, SKIN_H, ow=4)
    ball(cv, (head_c[0] - 30, head_c[1] - 32, head_c[0] + 26, head_c[1] + 30), SKIN, SKIN_S, SKIN_H, ow=6)
    cv.poly(
        [
            (head_c[0] + 18, head_c[1] - 2),
            (head_c[0] + 36, head_c[1] + 6),
            (head_c[0] + 16, head_c[1] + 12),
        ],
        SKIN,
    )
    cv.line((head_c[0] + 18, head_c[1] - 2), (head_c[0] + 36, head_c[1] + 6), INK, 4)
    cv.line((head_c[0] + 36, head_c[1] + 6), (head_c[0] + 16, head_c[1] + 12), INK, 4)
    ball(cv, (head_c[0] - 34, head_c[1] - 40, head_c[0] + 24, head_c[1] + 18), HELM, HELM_S, HELM_H, ow=7)
    # Brim juts toward the nose.
    cv.poly(
        [
            (head_c[0] - 6, head_c[1] + 2),
            (head_c[0] + 40, head_c[1] + 8),
            (head_c[0] + 38, head_c[1] + 18),
            (head_c[0] - 8, head_c[1] + 14),
        ],
        HELM_S,
    )
    cv.line((head_c[0] - 6, head_c[1] + 2), (head_c[0] + 40, head_c[1] + 8), INK, 5)
    cv.line((head_c[0] + 40, head_c[1] + 8), (head_c[0] + 38, head_c[1] + 18), INK, 5)
    dot(cv, (head_c[0] + 6, head_c[1] - 2, head_c[0] + 26, head_c[1] + 16), VISOR, ow=3)
    cv.ellipse((head_c[0] + 10, head_c[1] + 1, head_c[0] + 16, head_c[1] + 6), (255, 255, 255, 230))
    cv.line((head_c[0] + 8, head_c[1] + 22), (head_c[0] + 20, head_c[1] + 24), (120, 64, 64, 255), 3)
    limb(cv, (head_c[0] - 4, head_c[1] - 36), (head_c[0] + 2, head_c[1] - 54), 3.2, 2.8, HELM_S, HELM_S, HELM_H, ow=3)
    dot(cv, (head_c[0] - 2, head_c[1] - 64, head_c[0] + 10, head_c[1] - 52), GOLD, ow=3)

    # Near arm and the rifle pointing right.
    near_elbow = joint(shoulder, 62, 40)
    near_hand = joint(near_elbow, 78, 34)
    limb(cv, shoulder, near_elbow, 12, 10, SUIT, SUIT_S, SUIT_H, ow=5.5)
    limb(cv, near_elbow, near_hand, 10, 8, SUIT, SUIT_S, SUIT_H, ow=5)
    draw_rifle(cv, (near_hand[0] - 2, near_hand[1] + 2), -12, flash=0, scale=0.64)
    glove(cv, near_hand, 8)
    return cv.export()


def boot_profile(cv: CV, ankle, scale: float = 1.0) -> None:
    ax, ay = ankle
    # Toe points right. Heel is the round back.
    outlined(
        cv,
        [
            (ax - 8, ay - 4),
            (ax + 20 * scale, ay - 2),
            (ax + 24 * scale, ay + 8),
            (ax - 10, ay + 10),
        ],
        BOOT,
        BOOT_S,
        ow=5,
    )
    cv.line((ax - 8, ay + 8), (ax + 22 * scale, ay + 8), BOOT_H, 2)


def outlined(cv: CV, pts, fill, shadow, ow: float = 7) -> None:
    cv.poly(pts, shadow)
    # Inset toward the centroid so a shadow rim remains, then stroke the ink.
    cx = sum(p[0] for p in pts) / len(pts)
    cy = sum(p[1] for p in pts) / len(pts)
    inset = []
    for x, y in pts:
        inset.append((cx + (x - cx) * 0.9 - 1.2, cy + (y - cy) * 0.9 - 1.4))
    cv.poly(inset, fill)
    loop = pts + [pts[0]]
    for a, b in zip(loop, loop[1:]):
        cv.line(a, b, INK, ow)


def _wash(im: Image.Image, amount: float, color) -> Image.Image:
    if amount <= 0:
        return im
    arr = np.asarray(im).astype(np.float32)
    a = arr[:, :, 3:4] / 255.0
    for i in range(3):
        arr[:, :, i] = arr[:, :, i] * (1 - amount) + color[i] * amount
    arr[:, :, :3] *= np.where(a > 0, 1, 0)
    # Keep RGB premultiplied-looking only where transparent.
    arr[:, :, :3] = np.where(arr[:, :, 3:4] > 0, arr[:, :, :3], 0)
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA")


# --- undead ----------------------------------------------------------------

def draw_undead(pose: dict, brute: bool = False) -> Image.Image:
    if brute:
        W, H = 320, 370
        skin, sh, hi = BSKIN, BSKIN_S, BSKIN_H
    else:
        W, H = 250, 340
        skin, sh, hi = ZSKIN, ZSKIN_S, ZSKIN_H
    cv = CV(W, H)
    cx = W * 0.5 + pose["sway"]
    bob = pose["bob"]
    leg = pose["leg"]
    heavy = brute
    hip_y = (214 if brute else 196) + bob
    shoulder_y = (148 if brute else 132) + bob
    head_y = (78 if brute else 70) + bob * 0.85
    head_r = 58 if brute else 48

    lift_l = pose.get("lift_l", max(0.0, leg))
    lift_r = pose.get("lift_r", max(0.0, -leg))
    spread = 22 if brute else 16

    def leg_chain(hip, lift, outward):
        knee = (hip[0] + outward * (6 + lift * 8), hip[1] + (54 if brute else 48) * (1 - 0.55 * lift))
        foot = (
            knee[0] + outward * (10 * (1 - lift) + 2),
            knee[1] + (58 if brute else 52) * (1 - 0.75 * lift),
        )
        return knee, foot

    hl = (cx - spread, hip_y)
    hr = (cx + spread, hip_y)
    lk, lf = leg_chain(hl, lift_l, -1)
    rk, rf = leg_chain(hr, lift_r, 1)
    thigh_r = 22 if brute else 15
    shin_r = 16 if brute else 11
    limb(cv, hl, lk, thigh_r, thigh_r - 4, skin, sh, hi, ow=7)
    limb(cv, lk, lf, shin_r, shin_r - 3, skin, sh, hi, ow=6)
    limb(cv, hr, rk, thigh_r, thigh_r - 4, skin, sh, hi, ow=7)
    limb(cv, rk, rf, shin_r, shin_r - 3, skin, sh, hi, ow=6)
    if brute:
        foot_blob(cv, lf, skin, sh, hi, big=True)
        foot_blob(cv, rf, skin, sh, hi, big=True)
    else:
        # One sneaker, one bare foot — readable asymmetry.
        foot_blob(cv, lf, skin, sh, hi, big=False)
        boot_stamp(cv, rf, 1, toe=0.4)

    # Belly and chest. Brute is much wider and hunched.
    body_w = 78 if brute else 48
    ball(cv, (cx - body_w, shoulder_y - 6, cx + body_w, hip_y + 22), skin, sh, hi, ow=8)
    if brute:
        # Red vest split open over the gut.
        outlined(
            cv,
            [
                (cx - 70, shoulder_y + 8),
                (cx - 18, shoulder_y + 18),
                (cx - 28, hip_y - 6),
                (cx - 64, hip_y + 8),
            ],
            BVEST,
            BVEST_S,
            ow=6,
        )
        outlined(
            cv,
            [
                (cx + 70, shoulder_y + 6),
                (cx + 16, shoulder_y + 20),
                (cx + 30, hip_y - 4),
                (cx + 66, hip_y + 10),
            ],
            BVEST,
            BVEST_S,
            ow=6,
        )
        # Gut scar.
        cv.line((cx - 6, shoulder_y + 36), (cx + 4, hip_y - 10), BLOOD, 4)
        # Bone spikes on the shoulders.
        for sign in (-1, 1):
            base = cx + sign * 62
            cv.poly(
                [(base, shoulder_y + 6), (base + sign * 8, shoulder_y - 28), (base + sign * 22, shoulder_y + 10)],
                BONE,
            )
            cv.line((base, shoulder_y + 6), (base + sign * 8, shoulder_y - 28), INK, 5)
            cv.line((base + sign * 8, shoulder_y - 28), (base + sign * 22, shoulder_y + 10), INK, 5)
            cv.poly(
                [(base + sign * 10, shoulder_y + 8), (base + sign * 18, shoulder_y - 16), (base + sign * 28, shoulder_y + 12)],
                BONE_S,
            )
    else:
        torn_shirt(cv, cx, shoulder_y + 6, hip_y + 4)
        # Skin holes punched through the rag.
        ball(cv, (cx - 8, shoulder_y + 28, cx + 14, shoulder_y + 52), (176, 48, 52, 255), (110, 16, 24, 255), (230, 120, 110, 255), ow=3)
        ball(cv, (cx + 16, shoulder_y + 18, cx + 32, shoulder_y + 34), (176, 48, 52, 255), (110, 16, 24, 255), (230, 120, 110, 255), ow=3)
        dot(cv, (cx - 18, shoulder_y + 40, cx - 8, shoulder_y + 50), BLOOD, ow=2)

    # Arms reach toward the camera. The forward hand is larger.
    sl = (cx - (body_w - 8), shoulder_y + 10)
    sr = (cx + (body_w - 8), shoulder_y + 8)
    reach_l = pose["reach_l"]
    reach_r = pose["reach_r"]
    reach_arm(cv, sl, reach_l, -1, skin, sh, hi, heavy)
    reach_arm(cv, sr, reach_r, 1, skin, sh, hi, heavy)

    # Head last so the chin overlaps the chest. Ears first.
    ball(cv, (cx - head_r - 10, head_y + 6, cx - head_r + 16, head_y + 32), skin, sh, hi, ow=4)
    ball(cv, (cx + head_r - 16, head_y + 6, cx + head_r + 10, head_y + 32), skin, sh, hi, ow=4)
    ball(cv, (cx - head_r, head_y - head_r + 8, cx + head_r, head_y + head_r + 6), skin, sh, hi, ow=8)
    if not brute:
        # Three greasy tufts.
        for dx, dy, tip in ((-18, -head_r + 18, -30), (0, -head_r + 10, -8), (16, -head_r + 16, 22)):
            cv.poly(
                [(cx + dx, head_y + dy + 16), (cx + dx + tip * 0.3, head_y + dy - 8), (cx + dx + 12, head_y + dy + 14)],
                (70, 90, 40, 255),
            )
            cv.line((cx + dx, head_y + dy + 16), (cx + dx + tip * 0.3, head_y + dy - 8), INK, 3)
    face_undead(cv, cx, head_y, head_r, brute)
    return cv.export()


def torn_shirt(cv: CV, cx, top, bot) -> None:
    pts = [
        (cx - 46, top + 4),
        (cx - 20, top),
        (cx + 8, top + 6),
        (cx + 44, top + 2),
        (cx + 40, top + 28),
        (cx + 50, top + 36),
        (cx + 36, bot - 16),
        (cx + 22, bot + 6),
        (cx + 6, bot - 12),
        (cx - 8, bot + 8),
        (cx - 24, bot - 8),
        (cx - 40, bot - 18),
        (cx - 52, top + 40),
        (cx - 36, top + 22),
    ]
    outlined(cv, pts, ZRAG, ZRAG_S, ow=6)
    # Ragged highlight along the top fold.
    cv.line((cx - 30, top + 10), (cx + 24, top + 12), ZRAG_H, 3)


def foot_blob(cv: CV, ankle, skin, sh, hi, big: bool) -> None:
    ax, ay = ankle
    r = 16 if big else 11
    ball(cv, (ax - r, ay - r * 0.4, ax + r, ay + r * 0.7), skin, sh, hi, ow=5)
    # Three toes so the foot is not a stick end.
    for i, dx in enumerate((-0.55, 0.0, 0.55)):
        tx = ax + dx * r
        ball(cv, (tx - 4, ay + r * 0.35, tx + 4, ay + r * 0.95), skin, sh, hi, ow=2.5)


def reach_arm(cv: CV, shoulder, reach: float, side: float, skin, sh, hi, heavy: bool) -> None:
    # Elbow out, forearm swings toward the camera (down the screen) as reach grows.
    elbow = (shoulder[0] + side * (16 + reach * 14), shoulder[1] + 22 - reach * 14)
    hand = (
        shoulder[0] + side * (24 + reach * 20),
        shoulder[1] + 6 + (1 - reach) * 52 - reach * 16,
    )
    r0 = 18 if heavy else 13
    limb(cv, shoulder, elbow, r0, r0 - 3, skin, sh, hi, ow=6)
    limb(cv, elbow, hand, r0 - 2, r0 - 5, skin, sh, hi, ow=6)
    hand_fan(cv, hand, side, 0.85 + reach * 0.55, skin, sh, hi, heavy)


def hand_fan(cv: CV, center, side: float, scale: float, skin, sh, hi, heavy: bool) -> None:
    cx, cy = center
    palm = 12 * scale * (1.25 if heavy else 1)
    ball(cv, (cx - palm, cy - palm * 0.7, cx + palm, cy + palm * 0.75), skin, sh, hi, ow=4)
    angles = (-0.9, -0.3, 0.25, 0.8)
    for i, ang in enumerate(angles):
        length = (18 + (i == 1) * 5) * scale
        tip = (cx + math.sin(ang) * length * side, cy + 6 + abs(math.cos(ang)) * 4 + length * 0.15)
        root = (cx + math.sin(ang) * 4 * side, cy + 2)
        limb(cv, root, tip, 4.2 * scale, 3.0 * scale, skin, sh, hi, ow=3)


def face_undead(cv: CV, cx, head_y, head_r, brute: bool) -> None:
    if brute:
        # Heavy brow, small yellow eyes, underbite tusks.
        cv.poly(
            [
                (cx - 46, head_y - 8),
                (cx - 8, head_y - 22),
                (cx - 4, head_y + 2),
                (cx - 40, head_y + 6),
            ],
            BSKIN_S,
        )
        cv.poly(
            [
                (cx + 46, head_y - 10),
                (cx + 6, head_y - 20),
                (cx + 4, head_y + 2),
                (cx + 42, head_y + 4),
            ],
            BSKIN_S,
        )
        dot(cv, (cx - 32, head_y - 2, cx - 12, head_y + 16), (255, 220, 60, 255), ow=4)
        dot(cv, (cx + 12, head_y - 2, cx + 32, head_y + 16), (255, 220, 60, 255), ow=4)
        dot(cv, (cx - 26, head_y + 4, cx - 16, head_y + 14), PUPIL, ow=2)
        dot(cv, (cx + 16, head_y + 4, cx + 26, head_y + 14), PUPIL, ow=2)
        cv.ellipse((cx - 24, head_y + 1, cx - 20, head_y + 5), (255, 255, 255, 230))
        cv.ellipse((cx + 18, head_y + 1, cx + 22, head_y + 5), (255, 255, 255, 230))
        ball(cv, (cx - 28, head_y + 22, cx + 30, head_y + 48), (40, 70, 28, 255), (20, 40, 16, 255), BSKIN, ow=4)
        # Two tusks.
        limb(cv, (cx - 14, head_y + 34), (cx - 20, head_y + 52), 5, 3.5, TOOTH, BONE_S, (255, 255, 255, 255), ow=3)
        limb(cv, (cx + 14, head_y + 34), (cx + 22, head_y + 54), 5, 3.5, TOOTH, BONE_S, (255, 255, 255, 255), ow=3)
        return

    # Walker: oversized mismatched eyes and an open mouth. Reads at thumbnail size.
    dot(cv, (cx - 36, head_y - 10, cx - 6, head_y + 24), EYE, ow=4)
    dot(cv, (cx + 4, head_y - 4, cx + 30, head_y + 22), EYE, ow=4)
    dot(cv, (cx - 28, head_y + 2, cx - 14, head_y + 18), (186, 28, 36, 255), ow=2)
    dot(cv, (cx + 10, head_y + 4, cx + 22, head_y + 16), PUPIL, ow=2)
    cv.ellipse((cx - 26, head_y + 3, cx - 20, head_y + 9), (255, 255, 255, 240))
    cv.ellipse((cx + 12, head_y + 5, cx + 17, head_y + 10), (255, 255, 255, 240))
    # Dark sockets above the eyes.
    cv.line((cx - 34, head_y - 12), (cx - 8, head_y - 6), (40, 70, 24, 255), 4)
    cv.line((cx + 6, head_y - 8), (cx + 30, head_y - 2), (40, 70, 24, 255), 4)
    ball(cv, (cx - 24, head_y + 26, cx + 26, head_y + 52), MOUTH, (48, 6, 14, 255), BLOOD, ow=4)
    for i, tx in enumerate((-14, -4, 6, 14)):
        dot(cv, (cx + tx - 4, head_y + 24, cx + tx + 4, head_y + 36), TOOTH, ow=2)
    for tx in (-8, 2, 12):
        dot(cv, (cx + tx - 3, head_y + 40, cx + tx + 3, head_y + 48), TOOTH, ow=2)
    # Forehead gash.
    cv.line((cx - 8, head_y - 24), (cx + 10, head_y - 10), BLOOD, 4)


# --- sheets ----------------------------------------------------------------

def hstack(frames: list[Image.Image]) -> Image.Image:
    w, h = frames[0].size
    sheet = Image.new("RGBA", (w * len(frames), h), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        if frame.size != (w, h):
            raise SystemExit(f"frame {i} is {frame.size}, expected {(w, h)}")
        sheet.alpha_composite(frame, (i * w, 0))
    return sheet


def check(im: Image.Image, name: str, frames: int, min_bytes: int) -> None:
    if im.mode != "RGBA":
        raise SystemExit(f"{name} is {im.mode}")
    if im.size[0] % frames:
        raise SystemExit(f"{name} width {im.size[0]} not divisible by {frames}")
    alpha = np.asarray(im.getchannel("A"))
    if alpha[0, 0] != 0 or alpha[0, -1] != 0 or alpha[-1, 0] != 0:
        raise SystemExit(f"{name} corners are not transparent")
    ratio = float((alpha > 16).mean())
    if ratio < 0.04:
        raise SystemExit(f"{name} is almost empty ({ratio:.3f})")
    # Per cell, the ink should not touch the top/bottom (clipped limbs).
    fw = im.size[0] // frames
    for i in range(frames):
        cell = alpha[:, i * fw : (i + 1) * fw]
        ys, xs = np.where(cell > 16)
        if len(xs) == 0:
            raise SystemExit(f"{name} frame {i} empty")
        if ys.min() < 1 or xs.min() < 1 or ys.max() > cell.shape[0] - 2 or xs.max() > cell.shape[1] - 2:
            raise SystemExit(
                f"{name} frame {i} clipped bbox "
                f"x={xs.min()}-{xs.max()} y={ys.min()}-{ys.max()} size={cell.shape[1]}x{cell.shape[0]}"
            )


def save(im: Image.Image, path: Path, frames: int, min_bytes: int) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "PNG", optimize=True)
    check(im, path.name, frames, min_bytes)
    size = path.stat().st_size
    if size < min_bytes:
        raise SystemExit(f"{path.name} is only {size} bytes — too close to a placeholder")
    print(f"{path.relative_to(ROOT)}  {im.size[0]}x{im.size[1]}  {frames}f  {size}")
    return size


def update_manifest(paths: list[str]) -> None:
    manifest_path = ROOT / "assets" / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    files = manifest.setdefault("files", [])
    # Paths are relative to assets/. Drop an earlier bad prefix if one was written.
    files[:] = [rel for rel in files if not str(rel).startswith("assets/")]
    have = set(files)
    for rel in paths:
        if rel not in have:
            files.append(rel)
            have.add(rel)
    note = "Doom Gates squad/zombie sheets from tools/gen_doom_sprites.py (original Pillow, transparent, no web images)."
    notes = manifest.setdefault("notes", [])
    if note not in notes:
        notes.append(note)
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")


def preview(groups: list[tuple[str, list[Image.Image]]], path: Path) -> None:
    """Contact sheet on the in-game road color, plus a thumbnail row."""
    pad = 8
    label_h = 22
    width = 0
    height = pad
    rows = []
    for title, frames in groups:
        fw, fh = frames[0].size
        rows.append((title, frames, fw, fh))
        width = max(width, pad + len(frames) * (fw + pad))
        height += label_h + fh + pad
    # Thumbnail strip.
    height += label_h + 120 + pad
    sheet = Image.new("RGBA", (width, height), (235, 230, 220, 255))
    draw = ImageDraw.Draw(sheet)
    y = pad
    for title, frames, fw, fh in rows:
        draw.text((pad, y), title, fill=(20, 20, 30, 255))
        y += label_h
        x = pad
        for frame in frames:
            sheet.alpha_composite(frame, (x, y))
            x += fw + pad
        y += fh + pad
    draw.text((pad, y), "game size ~110px", fill=(20, 20, 30, 255))
    y += label_h
    x = pad
    for title, frames, fw, fh in rows:
        small = frames[0].resize((int(fw * 110 / fh), 110), Image.Resampling.LANCZOS)
        sheet.alpha_composite(small, (x, y))
        x += small.size[0] + pad
    sheet.convert("RGB").save(path, "PNG", optimize=True)


def main() -> None:
    front = draw_soldier_front()
    side = draw_soldier_side()
    back = draw_soldier_back(neutral_pose())
    idle = [draw_soldier_back(idle_pose(i)) for i in range(4)]
    run = [draw_soldier_back(run_pose(i)) for i in range(6)]
    shoot = [draw_soldier_back(shoot_pose(i)) for i in range(6)]
    hit = [draw_soldier_back(hit_pose(i)) for i in range(3)]
    zombie = [draw_undead(walk_pose(i, heavy=False), brute=False) for i in range(6)]
    brute = [draw_undead(walk_pose(i, heavy=True), brute=True) for i in range(6)]

    jobs = [
        (front, SPRITE / "soldier-front.png", 1, 20000),
        (side, SPRITE / "soldier-side.png", 1, 20000),
        (back, SPRITE / "soldier-back.png", 1, 20000),
        (hstack(idle), SPRITE / "soldier-idle.png", 4, 60000),
        (hstack(run), SPRITE / "soldier-run.png", 6, 80000),
        (hstack(shoot), SPRITE / "soldier-shoot.png", 6, 80000),
        (hstack(hit), SPRITE / "soldier-hit.png", 3, 50000),
        (hstack(zombie), SPRITE / "zombie-walk.png", 6, 80000),
        (hstack(brute), SPRITE / "brute-walk.png", 6, 80000),
        # Replace the old few-KB block placeholders so those paths are the same characters.
        (back, OUT / "soldier-0.png", 1, 20000),
        (front, OUT / "soldier-1.png", 1, 20000),
        (zombie[0], OUT / "zombie.png", 1, 20000),
        (brute[0], OUT / "brute.png", 1, 20000),
    ]
    written = []
    for im, path, frames, minimum in jobs:
        save(im, path, frames, minimum)
        written.append(str(path.relative_to(ROOT / "assets")))

    update_manifest(written)
    preview(
        [
            ("front / side / back", [front, side, back]),
            ("idle x4", idle),
            ("run x6", run),
            ("shoot x6", shoot),
            ("hit x3", hit),
            ("zombie walk x6", zombie),
            ("brute walk x6", brute),
        ],
        Path("/tmp/doom-sprite-preview.png"),
    )
    print("preview /tmp/doom-sprite-preview.png")


if __name__ == "__main__":
    main()
