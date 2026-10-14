/**
 * Pseudo-3D road for Doom Gates. Camera sits just behind the squad.
 * Closer objects are lower and larger. Numbers stay big enough to read.
 */
(function (global) {
  'use strict';

  var FONT = '"Segoe UI", system-ui, "PingFang SC", "Noto Sans SC", sans-serif';
  var images = {};

  function load() {
    ['soldier-0', 'soldier-1', 'zombie', 'brute'].forEach(function (name) {
      var img = new Image();
      img.src = '../../assets/doom-gates/' + name + '.png';
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
      horizon: h * 0.20,
      focal: h * 2.05,
      pitch: h * 0.00168,
      spread: 0.72
    };
  }

  function project(L, state, x, z) {
    var depth = z - state.z + 0.15;
    if (depth < 0.22) return null;
    var k = L.focal / Math.max(0.22, depth);
    return {
      sx: L.cx + x * k * L.spread,
      sy: L.horizon + k * L.pitch,
      k: k,
      depth: depth
    };
  }

  function pairLayout(L, state, z) {
    var depth = z - state.z + 0.15;
    if (depth < 0.45 || depth > 26) return null;
    var origin = project(L, state, 0, z);
    if (!origin) return null;
    var near = DGCore.clamp((26 - depth) / 18, 0, 1);
    var span = Math.min(L.w * 0.92, 108 + near * L.w * 0.48);
    var gap = 12;
    var sw = (span - gap) / 2;
    var sh = Math.max(44, Math.min(L.h * 0.22, sw * 0.72));
    return { sy: origin.sy, sw: sw, sh: sh, gap: gap, depth: depth, span: span };
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

  function skyColors(levelId) {
    var table = [
      ['#8ec8f0', '#f4efe2'],
      ['#79b4e4', '#f3d7c2'],
      ['#41598f', '#e39a72'],
      ['#2c3b68', '#c4654a'],
      ['#1a2344', '#a33b45']
    ];
    return table[Math.min(table.length - 1, Math.max(0, (levelId || 1) - 1))];
  }

  function gateStyle(gate, side) {
    if (gate.type === 'sub') return { bg: '#ff4d5e', fg: '#fff', edge: '#8c1020' };
    if (gate.type === 'mul') return { bg: '#c084fc', fg: '#fff', edge: '#6d28d9' };
    if (gate.type === 'div') return { bg: '#ff8a3d', fg: '#3a1d00', edge: '#c2410c' };
    if (side === 'left') return { bg: '#ffe14a', fg: '#3a2a00', edge: '#d4a000' };
    return { bg: '#49c6ff', fg: '#04283a', edge: '#1578aa' };
  }

  function drawSoldier(ctx, x, y, s, frame) {
    var img = images[frame % 2 === 0 ? 'soldier-0' : 'soldier-1'];
    if (ready(img)) {
      ctx.drawImage(img, x - s * 0.5, y - s * 1.15, s, s * 1.25);
      return;
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#2f6fbe';
    roundRect(ctx, -s * 0.22, -s * 0.72, s * 0.44, s * 0.48, 6);
    ctx.fill();
    ctx.fillStyle = '#1d4e89';
    roundRect(ctx, -s * 0.16, -s * 0.62, s * 0.22, s * 0.28, 4);
    ctx.fill();
    ctx.fillStyle = '#f1c7a4';
    ctx.beginPath();
    ctx.arc(0, -s * 0.82, s * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#163a66';
    ctx.fillRect(-s * 0.18, -s * 0.96, s * 0.36, s * 0.1);
    ctx.fillStyle = '#222';
    var spread = frame % 2 === 0 ? 0.12 : 0.04;
    ctx.fillRect(-s * 0.16, -s * 0.26, s * 0.1, s * 0.26);
    ctx.fillRect(s * 0.04, -s * 0.26 + spread * s, s * 0.1, s * 0.26);
    ctx.fillStyle = '#ddd';
    ctx.fillRect(s * 0.12, -s * 0.58, s * 0.22, s * 0.06);
    ctx.restore();
  }

  function drawZombieSprite(ctx, x, y, s, kind, flash) {
    var img = images[kind === 'brute' ? 'brute' : 'zombie'];
    ctx.save();
    if (flash > 0) ctx.globalAlpha = 0.45 + flash * 2;
    if (ready(img)) {
      var h = kind === 'brute' ? s * 1.35 : s * 1.2;
      ctx.drawImage(img, x - s * 0.55, y - h, s * 1.1, h);
      ctx.restore();
      return;
    }
    var skin = kind === 'brute' ? '#6f8f3a' : '#86a84a';
    var cloth = kind === 'brute' ? '#8d2f2f' : '#4b5563';
    ctx.fillStyle = cloth;
    roundRect(ctx, x - s * 0.28, y - s * 0.85, s * 0.56, s * 0.5, 6);
    ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(x, y - s * 1.05, s * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = skin;
    ctx.lineWidth = Math.max(3, s * 0.08);
    ctx.beginPath();
    ctx.moveTo(x - s * 0.28, y - s * 0.7);
    ctx.lineTo(x - s * 0.55, y - s * 0.95);
    ctx.moveTo(x + s * 0.28, y - s * 0.7);
    ctx.lineTo(x + s * 0.55, y - s * 0.95);
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(x - s * 0.1, y - s * 1.08, s * 0.06, 0, Math.PI * 2);
    ctx.arc(x + s * 0.1, y - s * 1.08, s * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(x - s * 0.1, y - s * 1.08, s * 0.03, 0, Math.PI * 2);
    ctx.arc(x + s * 0.1, y - s * 1.08, s * 0.03, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7f1d1d';
    ctx.fillRect(x - s * 0.08, y - s * 0.96, s * 0.16, s * 0.05);
    if (flash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,.65)';
      ctx.beginPath();
      ctx.arc(x, y - s * 0.9, s * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawGatePanel(ctx, rect, side, gate, opts) {
    opts = opts || {};
    var style = gateStyle(gate, side);
    var x = rect.x;
    var y = rect.y;
    var sw = rect.w;
    var sh = rect.h;
    ctx.save();
    ctx.fillStyle = '#e8edf4';
    ctx.fillRect(x - 5, y, 8, sh + 14);
    ctx.fillRect(x + sw - 3, y, 8, sh + 14);
    ctx.fillStyle = '#9aa3b2';
    ctx.fillRect(x - 3, y - 10, 10, 16);
    ctx.fillRect(x + sw - 6, y - 10, 10, 16);
    roundRect(ctx, x, y, sw, sh, 10);
    ctx.fillStyle = style.bg;
    ctx.fill();
    ctx.strokeStyle = opts.hot ? '#fff' : (opts.aimed ? '#ffffff' : style.edge);
    ctx.lineWidth = opts.hot ? 6 : (opts.aimed ? 5 : 3);
    ctx.stroke();
    if (!opts.aimed) {
      ctx.fillStyle = 'rgba(0,0,0,.12)';
      ctx.fillRect(x, y, sw, sh);
    }
    ctx.fillStyle = 'rgba(255,255,255,.28)';
    ctx.fillRect(x + 6, y + 6, sw - 12, sh * 0.16);
    var font = Math.max(22, Math.min(84, sh * 0.52));
    ctx.font = '900 ' + font + 'px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(4, font * 0.1);
    ctx.strokeStyle = 'rgba(0,0,0,.45)';
    ctx.fillStyle = style.fg;
    var text = DGCore.label(gate);
    ctx.strokeText(text, x + sw / 2, y + sh * 0.56);
    ctx.fillText(text, x + sw / 2, y + sh * 0.56);
    ctx.restore();
  }

  function draw(ctx, L, state, fx) {
    var w = L.w;
    var h = L.h;
    var colors = skyColors(state.levelId > 50 ? 5 : state.levelId);
    var sky = ctx.createLinearGradient(0, 0, 0, L.horizon + 40);
    sky.addColorStop(0, colors[0]);
    sky.addColorStop(1, colors[1]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    (fx.buildings || []).forEach(function (b) {
      var base = project(L, state, b.side * 1.35, b.z);
      var edge = project(L, state, b.side * (1.35 + b.w), b.z);
      if (!base || !edge || base.depth > 70) return;
      var bh = b.h * base.k * 0.42;
      var x = Math.min(base.sx, edge.sx);
      var bw = Math.abs(edge.sx - base.sx);
      ctx.fillStyle = b.side < 0 ? 'rgba(70,86,112,' + (0.35 + b.shade * 0.4) + ')' : 'rgba(86,98,122,' + (0.35 + b.shade * 0.4) + ')';
      ctx.fillRect(x, base.sy - bh, bw, bh);
      ctx.fillStyle = 'rgba(255,220,140,.35)';
      for (var wy = base.sy - bh + 8; wy < base.sy - 8; wy += 14) {
        ctx.fillRect(x + 4, wy, Math.max(2, bw * 0.18), 4);
      }
    });

    var farL = project(L, state, -1, state.z + 58);
    var farR = project(L, state, 1, state.z + 58);
    var nearL = project(L, state, -1, state.z + 1.15);
    var nearR = project(L, state, 1, state.z + 1.15);
    if (farL && farR && nearL && nearR) {
      ctx.beginPath();
      ctx.moveTo(farL.sx, farL.sy);
      ctx.lineTo(farR.sx, farR.sy);
      ctx.lineTo(nearR.sx, nearR.sy);
      ctx.lineTo(nearL.sx, nearL.sy);
      ctx.closePath();
      var road = ctx.createLinearGradient(0, farL.sy, 0, nearL.sy);
      road.addColorStop(0, '#c8c2b4');
      road.addColorStop(1, '#ebe6dc');
      ctx.fillStyle = road;
      ctx.fill();

      for (var z = state.z + 1.4; z < state.z + 56; z += 1.6) {
        var a = project(L, state, -0.98, z);
        var b = project(L, state, -0.98, z + 0.7);
        var c = project(L, state, 0.98, z);
        var d = project(L, state, 0.98, z + 0.7);
        var stripe = Math.floor(z / 1.6) % 2 === 0;
        ctx.strokeStyle = stripe ? '#111' : '#f5c518';
        ctx.lineWidth = Math.max(2, (a ? a.k : 10) * 0.03);
        if (a && b) { ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke(); }
        if (c && d) { ctx.beginPath(); ctx.moveTo(c.sx, c.sy); ctx.lineTo(d.sx, d.sy); ctx.stroke(); }
        if (Math.floor(z) % 3 === 0) {
          var m1 = project(L, state, 0, z);
          var m2 = project(L, state, 0, z + 0.9);
          if (m1 && m2) {
            ctx.strokeStyle = 'rgba(255,255,255,.75)';
            ctx.lineWidth = Math.max(2, m1.k * 0.025);
            ctx.beginPath();
            ctx.moveTo(m1.sx, m1.sy);
            ctx.lineTo(m2.sx, m2.sy);
            ctx.stroke();
          }
        }
      }
    }

    var marks = [];
    var leadGate = null;
    state.gates.forEach(function (gate) {
      if (gate.used) return;
      var box = pairLayout(L, state, gate.z);
      if (!box) return;
      if (!leadGate || box.depth < leadGate.depth) leadGate = box;
    });
    state.zombies.forEach(function (zombie) {
      if (!zombie.alive) return;
      var drawX = DGCore.clamp(zombie.x, -0.92, 0.92);
      var p = project(L, state, drawX, zombie.z);
      if (!p || p.depth > 48) return;
      marks.push({ z: zombie.z, draw: function () {
        var sideSign = drawX < 0 ? -1 : 1;
        var inFront = !leadGate || p.depth <= leadGate.depth + 0.35;
        var size;
        var sx;
        var sy;
        var jitter = ((Math.round(zombie.z * 10) % 5) - 2) * L.w * 0.02;
        if (inFront) {
          var near = DGCore.clamp((9 - p.depth) / 7, 0, 1);
          size = (zombie.kind === 'brute' ? 72 : 56) + near * (zombie.kind === 'brute' ? 48 : 36);
          var spriteUp = size * 1.22;
          var gateBottom = leadGate ? Math.min(leadGate.sy, L.h * 0.58) : L.h * 0.42;
          var room = L.h * 0.76 - gateBottom - 8;
          if (spriteUp > room) {
            size = Math.max(42, (room - 4) / 1.22);
            spriteUp = size * 1.22;
          }
          var drop = leadGate ? DGCore.clamp((leadGate.depth - p.depth) / 12, 0, 1) : 1;
          sy = Math.min(L.h * 0.76, gateBottom + spriteUp + 4 + drop * Math.max(0, room - spriteUp));
          var laneMag = Math.min(L.w * 0.34, Math.max(L.w * 0.16, Math.abs(drawX) * L.w * 0.36));
          sx = L.cx + sideSign * laneMag + jitter;
        } else {
          size = zombie.kind === 'brute' ? 38 : 30;
          var gateTop = Math.min(leadGate.sy, L.h * 0.58) - leadGate.sh;
          sx = L.cx + sideSign * Math.min(L.w * 0.46, Math.max(L.w * 0.38, Math.abs(p.sx - L.cx))) + jitter;
          sy = Math.min(gateTop - 4, Math.max(L.horizon + 32, p.sy));
        }
        ctx.fillStyle = 'rgba(0,0,0,.28)';
        ctx.beginPath();
        ctx.ellipse(sx, sy + 4, size * 0.34, size * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
        drawZombieSprite(ctx, sx, sy, size, zombie.kind === 'crowd' ? 'walker' : zombie.kind, zombie.flash || 0);
        if (zombie.hp < zombie.maxHp) {
          var bw = Math.max(28, size * 0.7);
          var by = sy - size * 1.42;
          ctx.fillStyle = 'rgba(0,0,0,.55)';
          ctx.fillRect(sx - bw / 2, by, bw, 6);
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(sx - bw / 2, by, bw * Math.max(0, zombie.hp / zombie.maxHp), 6);
        }
      } });
    });

    var aimedRight = state.x >= 0;
    state.gates.forEach(function (gate) {
      if (gate.used) return;
      var box = pairLayout(L, state, gate.z);
      if (!box) return;
      ['left', 'right'].forEach(function (side) {
        var x = side === 'left' ? (L.cx - box.gap / 2 - box.sw) : (L.cx + box.gap / 2);
        var aimed = side === 'right' ? aimedRight : !aimedRight;
        var hot = fx.hot && fx.hot[gate.z + side];
        var top = Math.min(box.sy, L.h * 0.58) - box.sh;
        marks.push({
          z: gate.z,
          draw: function () {
            drawGatePanel(ctx, { x: x, y: top, w: box.sw, h: box.sh }, side, gate[side], { hot: !!hot, aimed: aimed });
          }
        });
      });
    });

    if (!state.finish.used) {
      var fin = pairLayout(L, state, state.finish.z);
      if (fin) {
        marks.push({ z: state.finish.z, draw: function () {
          var sw = fin.span;
          var sh = Math.max(fin.sh, 64);
          var x = L.cx - sw / 2;
          var y = Math.min(fin.sy, L.h * 0.5) - sh;
          ctx.fillStyle = '#f5c542';
          roundRect(ctx, x, y, sw * 0.46, sh, 10);
          ctx.fill();
          roundRect(ctx, x + sw * 0.54, y, sw * 0.46, sh, 10);
          ctx.fill();
          ctx.fillStyle = '#fff';
          var font = Math.max(28, Math.min(86, sh * 0.5));
          ctx.font = '900 ' + font + 'px ' + FONT;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.lineWidth = 6;
          ctx.strokeStyle = '#7c5a00';
          var needText = String(state.finish.need);
          ctx.strokeText(needText, L.cx, y + sh * 0.48);
          ctx.fillText(needText, L.cx, y + sh * 0.48);
          ctx.font = '800 ' + Math.max(13, font * 0.28) + 'px ' + FONT;
          ctx.fillStyle = '#3a2a00';
          ctx.fillText(state.finish.name, L.cx, y - 10);
          ctx.fillText('需要人数', L.cx, y + sh + 16);
        } });
      }
    }

    state.bullets.forEach(function (bullet) {
      var p = project(L, state, DGCore.clamp(bullet.x, -0.95, 0.95), bullet.z);
      if (!p || p.depth > 28) return;
      marks.push({ z: bullet.z, draw: function () {
        var side = bullet.side === 'left' ? -1 : 1;
        var travel = DGCore.clamp((p.depth - 0.35) / 18, 0, 0.62);
        var lane0 = state.x < 0
          ? DGCore.clamp(state.x / 0.86, -1, -0.18)
          : DGCore.clamp(state.x / 0.86, 0.18, 1);
        var originX = L.cx + lane0 * Math.min(128, L.w * 0.28);
        var originY = L.h - 150;
        var aimX = L.cx + side * Math.min(L.w * 0.16, 52);
        var aimY = L.h * 0.5;
        var spread = (bullet.x - state.x) * Math.min(90, L.w * 0.16);
        var sx = originX + (aimX - originX) * travel + spread;
        var sy = originY + (aimY - originY) * travel;
        var thick = state.squad >= 8 ? 3 : 2;
        ctx.strokeStyle = state.squad >= 8 || state.weapon >= 3 ? '#ffb703' : '#fff6c2';
        ctx.lineWidth = thick;
        ctx.beginPath();
        ctx.moveTo(sx - side * 3, sy + 12);
        ctx.lineTo(sx + side * 5, sy - 10);
        ctx.stroke();
      } });
    });

    marks.sort(function (a, b) { return b.z - a.z; });
    marks.forEach(function (m) { m.draw(); });

    var squad = Math.max(0, state.squad | 0);
    var vis = Math.min(squad, 8);
    var lane = state.x < 0
      ? DGCore.clamp(state.x / 0.86, -1, -0.18)
      : DGCore.clamp(state.x / 0.86, 0.18, 1);
    var baseX = L.cx + lane * Math.min(128, L.w * 0.28);
    var cols = vis <= 3 ? Math.max(1, vis) : 4;
    var size = vis <= 1 ? 108 : vis <= 4 ? 76 : 58;
    for (var i = 0; i < vis; i++) {
      var col = i % cols;
      var row = Math.floor(i / cols);
      var sx = baseX + (col - (cols - 1) / 2) * (size * 0.92);
      var sy = h - 108 - row * (size * 0.72) + Math.sin(fx.time * 12 + i) * 2;
      drawSoldier(ctx, sx, sy, size, Math.floor(fx.time * 8) + i);
      if (fx.muzzle > 0) {
        ctx.strokeStyle = 'rgba(255, 236, 160, ' + Math.min(1, fx.muzzle * 8) + ')';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(sx + size * 0.2, sy - size * 0.5);
        ctx.lineTo(sx + size * 0.2, sy - size * 0.95);
        ctx.stroke();
      }
    }
    if (squad > vis) {
      ctx.font = '900 18px ' + FONT;
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText('+' + (squad - vis), baseX, h - 24);
    }

    ctx.fillStyle = aimedRight ? 'rgba(73,198,255,.95)' : 'rgba(255,225,74,.95)';
    ctx.beginPath();
    ctx.moveTo(baseX, h * 0.78);
    ctx.lineTo(baseX - 11, h * 0.78 + 16);
    ctx.lineTo(baseX + 11, h * 0.78 + 16);
    ctx.fill();
  }

  global.DGRender = { load: load, layout: layout, project: project, draw: draw };
})(typeof window !== 'undefined' ? window : global);
