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
    if (depth < 0.85) return null;
    var k = L.focal / depth;
    return {
      sx: L.cx + x * k * L.spread,
      sy: L.horizon + k * L.pitch,
      k: k,
      depth: depth
    };
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

  function drawGatePanel(ctx, proj, side, gate, hot) {
    var style = gateStyle(gate, side);
    var sw = Math.max(22, proj.k * 0.34);
    var sh = sw * 0.92;
    var x = proj.sx - sw / 2;
    var y = proj.sy - sh;
    ctx.save();
    ctx.fillStyle = '#d9dee7';
    ctx.fillRect(x - 4, y, 6, sh + 10);
    ctx.fillRect(x + sw - 2, y, 6, sh + 10);
    ctx.fillStyle = '#9aa3b2';
    ctx.fillRect(x - 2, y - 8, 8, 14);
    ctx.fillRect(x + sw - 4, y - 8, 8, 14);
    roundRect(ctx, x, y, sw, sh, 8);
    ctx.fillStyle = style.bg;
    ctx.fill();
    ctx.strokeStyle = hot ? '#fff' : style.edge;
    ctx.lineWidth = hot ? 4 : 3;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.28)';
    ctx.fillRect(x + 4, y + 4, sw - 8, sh * 0.18);
    var font = Math.max(12, Math.min(78, sh * 0.5));
    ctx.font = '900 ' + font + 'px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(3, font * 0.08);
    ctx.strokeStyle = 'rgba(0,0,0,.35)';
    ctx.fillStyle = style.fg;
    var text = DGCore.label(gate);
    ctx.strokeText(text, proj.sx, y + sh * 0.58);
    ctx.fillText(text, proj.sx, y + sh * 0.58);
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
    state.zombies.forEach(function (zombie) {
      if (!zombie.alive) return;
      var p = project(L, state, zombie.x, zombie.z);
      if (!p || p.depth > 62) return;
      marks.push({ z: zombie.z, draw: function () {
        var size = Math.max(28, p.k * (zombie.kind === 'brute' ? 0.62 : 0.5));
        if (!zombie.collide) size *= 0.82;
        drawZombieSprite(ctx, p.sx, p.sy, size, zombie.kind === 'crowd' ? 'walker' : zombie.kind, zombie.flash || 0);
        if (zombie.hp < zombie.maxHp && zombie.collide) {
          var bw = size * 0.7;
          ctx.fillStyle = 'rgba(0,0,0,.45)';
          ctx.fillRect(p.sx - bw / 2, p.sy - size * 1.35, bw, 4);
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(p.sx - bw / 2, p.sy - size * 1.35, bw * Math.max(0, zombie.hp / zombie.maxHp), 4);
        }
      } });
    });

    state.gates.forEach(function (gate) {
      if (gate.used) return;
      ['left', 'right'].forEach(function (side) {
        var gz = project(L, state, side === 'left' ? -0.5 : 0.5, gate.z);
        if (!gz || gz.depth > 60) return;
        var hot = fx.hot && fx.hot[gate.z + side];
        marks.push({ z: gate.z, draw: function () { drawGatePanel(ctx, gz, side, gate[side], hot); } });
      });
    });

    if (!state.finish.used) {
      var fp = project(L, state, 0, state.finish.z);
      if (fp && fp.depth < 70) {
        marks.push({ z: state.finish.z, draw: function () {
          var sw = Math.max(70, fp.k * 0.85);
          var sh = sw * 0.7;
          var x = fp.sx - sw / 2;
          var y = fp.sy - sh;
          ctx.fillStyle = '#f5c542';
          roundRect(ctx, x, y, sw * 0.42, sh, 8);
          ctx.fill();
          roundRect(ctx, x + sw * 0.58, y, sw * 0.42, sh, 8);
          ctx.fill();
          ctx.fillStyle = '#fff';
          var font = Math.max(26, Math.min(84, sh * 0.48));
          ctx.font = '900 ' + font + 'px ' + FONT;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.lineWidth = 6;
          ctx.strokeStyle = '#7c5a00';
          ctx.strokeText(String(state.finish.need), fp.sx, y + sh * 0.48);
          ctx.fillText(String(state.finish.need), fp.sx, y + sh * 0.48);
          ctx.font = '800 ' + Math.max(12, font * 0.28) + 'px ' + FONT;
          ctx.fillStyle = '#3a2a00';
          ctx.fillText(state.finish.name, fp.sx, y - 8);
          ctx.fillText('需要', fp.sx, y + sh + Math.max(12, font * 0.2));
        } });
      }
    }

    state.bullets.forEach(function (bullet) {
      var p = project(L, state, bullet.x, bullet.z);
      if (!p) return;
      marks.push({ z: bullet.z, draw: function () {
        ctx.strokeStyle = state.weapon >= 4 ? '#ffb703' : '#fff4c2';
        ctx.lineWidth = Math.max(2, p.k * 0.02);
        ctx.beginPath();
        ctx.moveTo(p.sx, p.sy);
        ctx.lineTo(p.sx - bullet.vx * 0.4, p.sy + 10);
        ctx.stroke();
      } });
    });

    marks.sort(function (a, b) { return b.z - a.z; });
    marks.forEach(function (m) { m.draw(); });

    var squad = Math.max(0, state.squad);
    var vis = Math.min(squad, 16);
    var cols = Math.min(8, Math.max(1, Math.ceil(Math.sqrt(vis || 1))));
    var size = vis <= 1 ? 92 : vis < 6 ? 70 : 54;
    for (var i = 0; i < vis; i++) {
      var col = i % cols;
      var row = Math.floor(i / cols);
      var sx = L.cx + (col - (Math.min(cols, vis) - 1) / 2) * (size * 0.62);
      var sy = h - 70 - row * (size * 0.42) + Math.sin(fx.time * 12 + i) * 2;
      drawSoldier(ctx, sx, sy, size, Math.floor(fx.time * 8) + i);
    }
    if (squad > vis) {
      ctx.font = '900 18px ' + FONT;
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText('+' + (squad - vis), L.cx, h - 18);
    }

    var marker = project(L, state, state.targetX, state.z + 2.2);
    if (marker) {
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.beginPath();
      ctx.moveTo(marker.sx, marker.sy);
      ctx.lineTo(marker.sx - 8, marker.sy + 12);
      ctx.lineTo(marker.sx + 8, marker.sy + 12);
      ctx.fill();
    }
  }

  global.DGRender = { load: load, layout: layout, project: project, draw: draw };
})(typeof window !== 'undefined' ? window : global);
