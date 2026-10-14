/**
 * 向末日开炮 — one world→screen projection for the road, gates, horde,
 * bullets and squad. sy is the ground point. Feet and gate bottoms sit on it.
 * x ∈ [-1, 1] is the road; actors are clamped inside so they cannot leave it.
 */
(function (global) {
  'use strict';

  var FONT = '"Segoe UI", system-ui, "PingFang SC", "Noto Sans SC", sans-serif';
  var images = {};
  var SHEETS = {
    'soldier-front': { file: 'sprites/soldier-front.png', frames: 1 },
    'soldier-side': { file: 'sprites/soldier-side.png', frames: 1 },
    'soldier-back': { file: 'sprites/soldier-back.png', frames: 1 },
    'soldier-idle': { file: 'sprites/soldier-idle.png', frames: 4 },
    'soldier-run': { file: 'sprites/soldier-run.png', frames: 6 },
    'soldier-shoot': { file: 'sprites/soldier-shoot.png', frames: 6 },
    'soldier-hit': { file: 'sprites/soldier-hit.png', frames: 3 },
    'zombie-walk': { file: 'sprites/zombie-walk.png', frames: 6 },
    'brute-walk': { file: 'sprites/brute-walk.png', frames: 6 }
  };

  // Tuned so a phone portrait keeps the squad large, the near road wide,
  // and a gate a few units ahead still readable. Every entity uses project().
  var POW = 0.571;

  function load() {
    Object.keys(SHEETS).forEach(function (name) {
      var img = new Image();
      img.src = '../../assets/doom-gates/' + SHEETS[name].file;
      images[name] = img;
    });
  }

  function ready(img) {
    return img && img.complete && img.naturalWidth > 0;
  }

  function layout(w, h) {
    return {
      w: w,
      h: h,
      cx: w / 2,
      horizon: h * 0.24,
      A: h * 0.641,
      B: w * 0.546
    };
  }

  /**
   * World (x, z) → screen. x is lateral (-1..1 road), z is forward.
   * sy is the contact point on the road. k is the ground scale at that depth.
   */
  function project(L, state, x, z) {
    var depth = z - state.z;
    if (depth < 0.48) return null;
    var denom = Math.pow(depth, POW);
    var gy = L.A / denom;
    return {
      sx: L.cx + x * L.B / denom,
      sy: L.horizon + gy,
      k: gy,
      depth: depth
    };
  }

  function clamp(v, a, b) {
    return DGCore.clamp(v, a, b);
  }

  function onRoad(x) {
    return clamp(x, -0.82, 0.82);
  }

  function roundRect(ctx, x, y, w, h, r) {
    var rr = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function drawSheet(ctx, key, frame, footX, footY, dh) {
    var img = images[key];
    var spec = SHEETS[key];
    if (!ready(img) || !spec || dh < 8) return false;
    var n = spec.frames;
    var i = ((frame % n) + n) % n;
    var fw = img.naturalWidth / n;
    var fh = img.naturalHeight;
    var dw = dh * (fw / fh);
    ctx.drawImage(img, i * fw, 0, fw, fh, footX - dw / 2, footY - dh, dw, dh);
    return true;
  }

  function squadThreatened(state) {
    if (!state || !state.zombies) return false;
    for (var i = 0; i < state.zombies.length; i++) {
      var z = state.zombies[i];
      if (!z.alive || z.collide === false) continue;
      if (z.z >= state.z - 0.05 && z.z <= state.z + 1.6 && Math.abs(z.x - state.x) < 0.55) return true;
    }
    return false;
  }

  function soldierSheet(state, fx) {
    if (squadThreatened(state)) return 'soldier-hit';
    if (fx && fx.muzzle > 0.012) return 'soldier-shoot';
    if (state && state.phase && state.phase !== 'run') return 'soldier-idle';
    return 'soldier-run';
  }

  function soldierFrame(key, fx, i) {
    var t = (fx && fx.time) || 0;
    if (key === 'soldier-hit') return Math.floor(t * 14 + i) % 3;
    if (key === 'soldier-idle') return Math.floor(t * 5 + i) % 4;
    return Math.floor(t * 10 + i) % 6;
  }

  function gateStyle(gate) {
    if (gate.type === 'sub') return { bg: 'rgba(255, 70, 90, .88)', fg: '#fff', glow: '#ff4d5e', edge: '#ffd0d4' };
    if (gate.type === 'mul') return { bg: 'rgba(40, 150, 255, .88)', fg: '#fff', glow: '#38bdf8', edge: '#e0f2fe' };
    if (gate.type === 'div') return { bg: 'rgba(168, 85, 247, .9)', fg: '#fff', glow: '#c084fc', edge: '#f3e8ff' };
    return { bg: 'rgba(255, 206, 46, .92)', fg: '#3a2a00', glow: '#facc15', edge: '#fff6c2' };
  }

  function shadow(ctx, sx, sy, rx, ry) {
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath();
    ctx.ellipse(sx, sy, Math.max(4, rx), Math.max(2, ry), 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSky(ctx, L, state) {
    var h = L.h;
    var sky = ctx.createLinearGradient(0, 0, 0, L.horizon + h * 0.18);
    var dusk = (state.levelId || 1) >= 4;
    sky.addColorStop(0, dusk ? '#243044' : '#7ea6c8');
    sky.addColorStop(0.55, dusk ? '#4d6278' : '#b7c9d6');
    sky.addColorStop(1, dusk ? '#8d97a3' : '#d5dde3');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, L.w, h);
    ctx.fillStyle = 'rgba(255,255,255,.14)';
    for (var i = 0; i < 5; i++) {
      var fx = ((i * 97) % 100) / 100;
      ctx.beginPath();
      ctx.ellipse(L.w * fx, L.horizon * (0.35 + (i % 3) * 0.12), 36 + i * 8, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBuildings(ctx, L, state, fx) {
    var list = (fx && fx.buildings) || [];
    list.forEach(function (b) {
      var base = project(L, state, b.side * (1.15 + b.w * 0.15), b.z);
      if (!base || base.depth > 42) return;
      var bw = Math.max(10, b.w * base.k * 0.22);
      var bh = b.h * base.k * 0.55;
      var x = base.sx - bw / 2;
      var y = base.sy - bh;
      ctx.fillStyle = b.side < 0 ? 'rgba(48,62,84,.72)' : 'rgba(62,74,96,.68)';
      ctx.fillRect(x, y, bw, bh);
      ctx.fillStyle = 'rgba(255, 214, 140, .28)';
      var win = Math.max(2, bw * 0.16);
      for (var wy = y + 6; wy < base.sy - 8; wy += win * 2.3) {
        for (var wx = x + 3; wx < x + bw - 3; wx += win * 1.8) {
          if (((wx + wy + b.z) | 0) % 3 === 0) ctx.fillRect(wx, wy, win, win * 0.7);
        }
      }
    });
  }

  function drawRoad(ctx, L, state) {
    var far = 46;
    var near = 0.55;
    var farL = project(L, state, -1, state.z + far);
    var farR = project(L, state, 1, state.z + far);
    var nearL = project(L, state, -1, state.z + near);
    var nearR = project(L, state, 1, state.z + near);
    if (!farL || !farR || !nearL || !nearR) return;
    ctx.beginPath();
    ctx.moveTo(farL.sx, farL.sy);
    ctx.lineTo(farR.sx, farR.sy);
    ctx.lineTo(nearR.sx, nearR.sy);
    ctx.lineTo(nearL.sx, nearL.sy);
    ctx.closePath();
    var road = ctx.createLinearGradient(0, farL.sy, 0, nearL.sy);
    road.addColorStop(0, '#6d7380');
    road.addColorStop(0.4, '#3e4450');
    road.addColorStop(1, '#2a303a');
    ctx.fillStyle = road;
    ctx.fill();

    for (var z = state.z + near; z < state.z + far; z += 1.35) {
      var stripe = Math.floor(z / 1.35) % 2 === 0;
      var a = project(L, state, -1, z);
      var b = project(L, state, -1, z + 0.62);
      var c = project(L, state, 1, z);
      var d = project(L, state, 1, z + 0.62);
      if (a && b) {
        ctx.strokeStyle = stripe ? '#111' : '#f5c518';
        ctx.lineWidth = Math.max(2, a.k * 0.035);
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.stroke();
      }
      if (c && d) {
        ctx.strokeStyle = stripe ? '#111' : '#f5c518';
        ctx.lineWidth = Math.max(2, c.k * 0.035);
        ctx.beginPath();
        ctx.moveTo(c.sx, c.sy);
        ctx.lineTo(d.sx, d.sy);
        ctx.stroke();
      }
      if (Math.floor(z) % 3 === 0) {
        var m1 = project(L, state, 0, z);
        var m2 = project(L, state, 0, z + 1.05);
        if (m1 && m2) {
          ctx.strokeStyle = 'rgba(255,255,255,.55)';
          ctx.lineWidth = Math.max(1.5, m1.k * 0.02);
          ctx.setLineDash([Math.max(4, m1.k * 0.06), Math.max(6, m1.k * 0.08)]);
          ctx.beginPath();
          ctx.moveTo(m1.sx, m1.sy);
          ctx.lineTo(m2.sx, m2.sy);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }
  }

  function drawActorFallback(ctx, sx, sy, dh, kind) {
    var brute = kind === 'brute';
    var body = kind === 'soldier' ? '#2563eb' : (brute ? '#3f6212' : '#65a30d');
    ctx.fillStyle = body;
    roundRect(ctx, sx - dh * 0.16, sy - dh * 0.78, dh * 0.32, dh * 0.48, 6);
    ctx.fill();
    ctx.fillStyle = kind === 'soldier' ? '#1d4ed8' : '#14532d';
    ctx.beginPath();
    ctx.arc(sx, sy - dh * 0.86, dh * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawZombie(ctx, L, state, zombie, fx) {
    var alive = zombie.alive || (zombie.dying > 0);
    if (!alive) return;
    var p = project(L, state, onRoad(zombie.x), zombie.z);
    if (!p || p.depth > 36) return;
    var brute = zombie.kind === 'brute';
    var dh = clamp(p.k * (brute ? 0.46 : 0.34), 16, L.h * 0.22);
    if (!zombie.alive) dh *= 0.7 + 0.3 * (zombie.dying / 0.18);
    var frame = Math.floor(((fx.time || 0) * 8 + zombie.z * 3) % 6);
    shadow(ctx, p.sx, p.sy, dh * 0.22, dh * 0.06);
    ctx.save();
    if (zombie.flash > 0) ctx.globalAlpha = 0.55 + zombie.flash * 2;
    var key = brute ? 'brute-walk' : 'zombie-walk';
    if (!drawSheet(ctx, key, frame, p.sx, p.sy, dh)) drawActorFallback(ctx, p.sx, p.sy, dh, brute ? 'brute' : 'zombie');
    ctx.restore();
    if (zombie.alive && zombie.hp < zombie.maxHp && zombie.kind !== 'crowd') {
      var bw = Math.max(16, dh * 0.55);
      var by = p.sy - dh - 4;
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.fillRect(p.sx - bw / 2, by, bw, 4);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(p.sx - bw / 2, by, bw * Math.max(0, zombie.hp / zombie.maxHp), 4);
    }
  }

  function hexPattern(ctx, x, y, w, h) {
    ctx.save();
    roundRect(ctx, x, y, w, h, Math.min(16, w * 0.12));
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,.28)';
    ctx.lineWidth = 1;
    var s = Math.max(8, Math.min(16, w * 0.12));
    for (var row = 0; row < h / s + 2; row++) {
      for (var col = 0; col < w / s + 2; col++) {
        var cx = x + col * s * 1.15 + (row % 2) * s * 0.55;
        var cy = y + row * s * 0.85;
        ctx.beginPath();
        for (var k = 0; k < 6; k++) {
          var a = Math.PI / 6 + k * Math.PI / 3;
          var px = cx + Math.cos(a) * s * 0.38;
          var py = cy + Math.sin(a) * s * 0.38;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawGatePanel(ctx, L, state, gateZ, x0, x1, gate, opts) {
    var bl = project(L, state, x0, gateZ);
    var br = project(L, state, x1, gateZ);
    if (!bl || !br || bl.depth > 28) return;
    var topH = clamp(bl.k * 0.52, 40, L.h * 0.30);
    var x = Math.min(bl.sx, br.sx);
    var w = Math.max(28, Math.abs(br.sx - bl.sx));
    var y = bl.sy - topH;
    var style = gateStyle(gate);
    ctx.save();
    ctx.shadowColor = style.glow;
    ctx.shadowBlur = opts.aimed ? 26 : 12;
    roundRect(ctx, x, y, w, topH, Math.min(18, w * 0.14));
    ctx.fillStyle = style.bg;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = opts.aimed ? 5 : 3;
    ctx.strokeStyle = opts.hot ? '#fff' : style.edge;
    ctx.stroke();
    ctx.restore();
    hexPattern(ctx, x + 3, y + 3, w - 6, topH - 6);
    var label = DGCore.label(gate);
    var font = clamp(Math.min(w * 0.42, topH * 0.62), 18, 92);
    ctx.font = '900 ' + font + 'px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(3, font * 0.08);
    ctx.strokeStyle = 'rgba(0,0,0,.35)';
    ctx.strokeText(label, x + w / 2, y + topH * 0.54);
    ctx.fillStyle = style.fg;
    ctx.fillText(label, x + w / 2, y + topH * 0.54);
  }

  function drawFinish(ctx, L, state) {
    if (state.finish.used) return;
    var bl = project(L, state, -0.9, state.finish.z);
    var br = project(L, state, 0.9, state.finish.z);
    if (!bl || !br || bl.depth > 30) return;
    var topH = clamp(bl.k * 0.46, 36, L.h * 0.24);
    var x = Math.min(bl.sx, br.sx);
    var w = Math.abs(br.sx - bl.sx);
    var y = bl.sy - topH;
    ctx.save();
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 18;
    roundRect(ctx, x, y, w, topH, 12);
    var g = ctx.createLinearGradient(x, y, x, y + topH);
    g.addColorStop(0, 'rgba(255, 214, 80, .95)');
    g.addColorStop(1, 'rgba(180, 90, 10, .92)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#fff4cc';
    ctx.stroke();
    ctx.restore();
    var font = clamp(topH * 0.42, 16, 64);
    ctx.font = '900 ' + font + 'px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#3a2500';
    ctx.fillText(state.finish.name + '  需要 ' + state.finish.need, x + w / 2, y + topH * 0.56);
  }

  function drawBullet(ctx, L, state, bullet) {
    var p = project(L, state, onRoad(bullet.x), bullet.z);
    if (!p || p.depth > 24) return;
    var back = project(L, state, onRoad(bullet.x - bullet.vx * 0.03), bullet.z - 0.7);
    ctx.strokeStyle = state.squad >= 12 ? '#ffd60a' : '#fff4c2';
    ctx.lineWidth = clamp(p.k * 0.012, 1.5, 4);
    ctx.beginPath();
    if (back) ctx.moveTo(back.sx, back.sy - p.k * 0.18);
    else ctx.moveTo(p.sx, p.sy - p.k * 0.12);
    ctx.lineTo(p.sx, p.sy - p.k * 0.22);
    ctx.stroke();
  }

  function squadSpots(state) {
    var n = Math.max(0, state.squad | 0);
    var vis = Math.min(n, 7);
    var cols = vis <= 4 ? Math.max(1, vis) : 4;
    var spots = [];
    var edgeRoom = 0.76 - Math.abs(state.x);
    for (var i = 0; i < vis; i++) {
      var col = i % cols;
      var row = Math.floor(i / cols);
      var rowCount = Math.min(cols, vis - row * cols);
      var spacing = Math.min(0.16, (edgeRoom * 2) / Math.max(1, rowCount - 1 || 1));
      if (rowCount === 1) spacing = 0;
      var x = state.x + (col - (rowCount - 1) / 2) * spacing;
      var z = state.z + 1.28 + row * 0.42;
      spots.push({ x: onRoad(x), z: z, i: i });
    }
    spots.sort(function (a, b) { return b.z - a.z; });
    return { spots: spots, extra: Math.max(0, n - vis) };
  }

  function drawSquad(ctx, L, state, fx) {
    var pack = squadSpots(state);
    var action = soldierSheet(state, fx);
    var aim = DGCore.pickSide(state) === 'right' ? 0.35 : -0.35;
    pack.spots.forEach(function (spot) {
      var p = project(L, state, spot.x, spot.z);
      if (!p) return;
      var dh = clamp(p.k * 0.34, 64, L.h * 0.24);
      shadow(ctx, p.sx, p.sy, dh * 0.2, dh * 0.055);
      var frame = soldierFrame(action, fx, spot.i);
      if (!drawSheet(ctx, action, frame, p.sx, p.sy, dh)) {
        if (!drawSheet(ctx, 'soldier-back', 0, p.sx, p.sy, dh)) drawActorFallback(ctx, p.sx, p.sy, dh, 'soldier');
      }
      if (fx.muzzle > 0.01 || (state.phase === 'run' && Math.floor((fx.time || 0) * 12 + spot.i) % 2 === 0)) {
        var tip = project(L, state, onRoad(spot.x + aim * 0.25), spot.z + 5.5);
        if (tip) {
          ctx.strokeStyle = 'rgba(255, 220, 120, .85)';
          ctx.lineWidth = clamp(dh * 0.035, 1.5, 3.5);
          ctx.beginPath();
          ctx.moveTo(p.sx + dh * 0.08, p.sy - dh * 0.62);
          ctx.lineTo(tip.sx, tip.sy - tip.k * 0.2);
          ctx.stroke();
        }
      }
    });
    if (pack.extra > 0 && pack.spots.length) {
      var front = pack.spots[pack.spots.length - 1];
      var fp = project(L, state, front.x, front.z);
      if (fp) {
        ctx.font = '900 18px ' + FONT;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 4;
        ctx.strokeText('+' + pack.extra, fp.sx, fp.sy - fp.k * 0.38);
        ctx.fillText('+' + pack.extra, fp.sx, fp.sy - fp.k * 0.38);
      }
    }
  }

  function draw(ctx, L, state, fx) {
    fx = fx || {};
    drawSky(ctx, L, state);
    drawBuildings(ctx, L, state, fx);
    drawRoad(ctx, L, state);

    var marks = [];
    state.zombies.forEach(function (zombie) {
      if (!zombie.alive && !(zombie.dying > 0)) return;
      marks.push({ z: zombie.z, draw: function () { drawZombie(ctx, L, state, zombie, fx); } });
    });
    var aimedRight = DGCore.pickSide(state) === 'right';
    state.gates.forEach(function (gate) {
      if (gate.used) return;
      ['left', 'right'].forEach(function (side) {
        var x0 = side === 'left' ? -0.92 : 0.06;
        var x1 = side === 'left' ? -0.06 : 0.92;
        var aimed = side === 'right' ? aimedRight : !aimedRight;
        var hot = fx.hot && fx.hot[gate.z + side];
        marks.push({
          z: gate.z,
          draw: function () {
            drawGatePanel(ctx, L, state, gate.z, x0, x1, gate[side], { aimed: aimed, hot: !!hot });
          }
        });
      });
    });
    if (!state.finish.used) {
      marks.push({ z: state.finish.z, draw: function () { drawFinish(ctx, L, state); } });
    }
    state.bullets.forEach(function (bullet) {
      if (!bullet.alive) return;
      marks.push({ z: bullet.z, draw: function () { drawBullet(ctx, L, state, bullet); } });
    });
    marks.sort(function (a, b) { return b.z - a.z; });
    marks.forEach(function (m) { m.draw(); });
    drawSquad(ctx, L, state, fx);

    var prog = state.finish.z > 0 ? clamp(state.z / state.finish.z, 0, 1) : 0;
    var barW = Math.min(180, L.w * 0.42);
    var bx = (L.w - barW) / 2;
    var by = L.h - 18;
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    roundRect(ctx, bx, by, barW, 6, 3);
    ctx.fill();
    ctx.fillStyle = '#facc15';
    roundRect(ctx, bx, by, Math.max(4, barW * prog), 6, 3);
    ctx.fill();
  }

  global.DGRender = { load: load, layout: layout, project: project, draw: draw };
})(typeof window !== 'undefined' ? window : global);
