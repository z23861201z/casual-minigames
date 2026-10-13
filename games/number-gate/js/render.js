/**
 * Canvas renderer — Count-Masters style pseudo-3D corridor.
 * Presentation only. Core math stays in core.js.
 */
(function (global) {
  'use strict';

  var GATE_COLORS = {
    add: '#22c55e',
    mul: '#c084fc',
    sub: '#ef4444',
    div: '#fb7185',
    bomb: '#fb923c',
    shield: '#2dd4bf',
    scoreMul: '#f472b6',
    shieldBreak: '#2dd4bf'
  };

  var ENEMY_COLORS = {
    grunt: '#ff4d6d',
    elite: '#fbbf24',
    boss: '#d8b4fe'
  };

  var CROWD_COLORS = ['#22d3ee', '#38bdf8', '#818cf8', '#e879f9', '#67e8f9', '#a5b4fc'];
  var ASSET_ROOT = '../../assets/';

  function loadImage(src) {
    var img = new Image();
    img.decoding = 'async';
    img.src = src;
    return img;
  }

  function imageReady(img) {
    return !!(img && img.complete && img.naturalWidth > 0);
  }

  function Renderer(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = 960;
    this.h = 640;
    this.dpr = 1;
    this._spd = 0;
    this._m = null;
    this.powerPulse = 1;
    this.powerPulseVel = 0;
    this.comboFlash = 0;
    this.flashA = 0;
    this.flashColor = '#ffffff';
    this.dust = [];
    this.speedLines = [];
    for (var i = 0; i < 42; i++) {
      this.speedLines.push({
        ang: (Math.random() - 0.5) * 1.15,
        u: Math.random(),
        w: 1 + Math.random() * 2.2,
        side: Math.random() < 0.5 ? -1 : 1
      });
    }
    this._crowdN = -1;
    this._crowd = [];
    this.assets = {
      doors: {
        add: loadImage(ASSET_ROOT + 'number-gate/doors/add.png'),
        mul: loadImage(ASSET_ROOT + 'number-gate/doors/mul.png'),
        sub: loadImage(ASSET_ROOT + 'number-gate/doors/sub.png'),
        div: loadImage(ASSET_ROOT + 'number-gate/doors/div.png'),
        bomb: loadImage(ASSET_ROOT + 'number-gate/doors/bomb.png'),
        shield: loadImage(ASSET_ROOT + 'number-gate/doors/shield.png'),
        scoreMul: loadImage(ASSET_ROOT + 'number-gate/doors/score.png')
      },
      runner: [
        loadImage(ASSET_ROOT + 'number-gate/characters/runner-0.png'),
        loadImage(ASSET_ROOT + 'number-gate/characters/runner-1.png')
      ],
      monsters: {
        grunt: loadImage(ASSET_ROOT + 'number-gate/monsters/grunt.png'),
        elite: loadImage(ASSET_ROOT + 'number-gate/monsters/elite.png'),
        boss: loadImage(ASSET_ROOT + 'number-gate/monsters/boss.png')
      }
    };
  }

  Renderer.prototype.resize = function () {
    var parent = this.canvas.parentElement;
    var pw = parent ? parent.clientWidth : window.innerWidth;
    var ph = parent ? parent.clientHeight : window.innerHeight;
    var tw;
    var th;
    if (pw >= ph) {
      /* Desktop / landscape: a wide stage, not a tall phone column. */
      th = Math.max(480, Math.min(ph - 12, 820));
      tw = Math.min(pw - 20, 1180, Math.max(860, th * 1.18));
    } else {
      tw = pw;
      th = ph;
      if (tw / th < 0.5) tw = Math.min(pw, th * 0.58);
    }
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.max(320, Math.floor(tw));
    this.h = Math.max(420, Math.floor(th));
    this.canvas.style.width = this.w + 'px';
    this.canvas.style.height = this.h + 'px';
    this.canvas.width = Math.floor(this.w * this.dpr);
    this.canvas.height = Math.floor(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this._m = null;
  };

  Renderer.prototype.metrics = function () {
    if (this._m) return this._m;
    var widen = 1 + this._spd * 0.1;
    this._m = {
      nearY: this.h * 0.9,
      farY: this.h * 0.3,
      nearHalf: this.w * 0.46 * widen,
      farHalf: Math.max(16, this.w * 0.05)
    };
    return this._m;
  };

  Renderer.prototype.project = function (relZ, lane, lanes) {
    var m = this.metrics();
    var t = Math.max(0, Math.min(1, relZ / 660));
    var depth = Math.pow(1 - t, 1.18);
    var y = m.farY + (m.nearY - m.farY) * depth;
    var scale = 0.14 + 1.02 * Math.pow(depth, 1.08);
    var roadHalf = m.farHalf + (m.nearHalf - m.farHalf) * depth;
    var laneCount = lanes || 3;
    var laneW = (roadHalf * 2) / laneCount;
    var x = this.w / 2 - roadHalf + laneW * (lane + 0.5);
    return { x: x, y: y, scale: scale, roadHalf: roadHalf, depth: depth, laneW: laneW };
  };

  Renderer.prototype.laneXAt = function (lane, lanes, depth) {
    var m = this.metrics();
    var roadHalf = m.farHalf + (m.nearHalf - m.farHalf) * depth;
    var laneW = (roadHalf * 2) / (lanes || 3);
    return this.w / 2 - roadHalf + laneW * (lane + 0.5);
  };

  Renderer.prototype.pulsePower = function () {
    this.powerPulseVel = 0.62;
  };

  Renderer.prototype.addFlash = function (color, amt) {
    this.flashA = Math.min(0.5, Math.max(this.flashA || 0, amt || 0.2));
    this.flashColor = color || '#ffffff';
  };

  Renderer.prototype.drawBackground = function (state, dt) {
    var ctx = this.ctx;
    var w = this.w;
    var h = this.h;
    var m = this.metrics();
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#07061a');
    g.addColorStop(0.28, '#14123a');
    g.addColorStop(0.48, '#2a1460');
    g.addColorStop(0.62, '#3a1d55');
    g.addColorStop(1, '#12081f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    var sun = ctx.createRadialGradient(w * 0.5, m.farY, 8, w * 0.5, m.farY, w * 0.42);
    sun.addColorStop(0, 'rgba(255,186,92,0.55)');
    sun.addColorStop(0.25, 'rgba(192,90,255,0.28)');
    sun.addColorStop(0.6, 'rgba(34,211,238,0.06)');
    sun.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, w, h * 0.7);

    /* Stars drift with speed. */
    var drift = state.distance * 0.02;
    for (var i = 0; i < 48; i++) {
      var sx = ((i * 97 + drift * (0.3 + (i % 5) * 0.1)) % w + w) % w;
      var sy = (i * 37) % (m.farY * 0.92);
      ctx.globalAlpha = 0.2 + (i % 4) * 0.15;
      ctx.fillStyle = i % 6 === 0 ? '#fde68a' : '#e0f2fe';
      ctx.fillRect(sx, sy, i % 5 === 0 ? 2.2 : 1.3, i % 5 === 0 ? 2.2 : 1.3);
    }
    ctx.globalAlpha = 1;

    /* Skyline along the horizon. */
    for (var b = 0; b < 22; b++) {
      var bx = ((b * 83 - drift * 8) % (w + 80) + w + 80) % (w + 80) - 40;
      var bh = 16 + ((b * 29) % 58);
      ctx.fillStyle = 'rgba(8,6,24,0.92)';
      ctx.fillRect(bx, m.farY - bh, 22 + (b % 3) * 8, bh);
      if (b % 2 === 0) {
        ctx.fillStyle = (b % 4 === 0) ? 'rgba(253,224,71,0.85)' : 'rgba(125,211,252,0.75)';
        ctx.fillRect(bx + 5, m.farY - bh + 7, 3, 3);
        ctx.fillRect(bx + 12, m.farY - bh + 16, 3, 3);
      }
    }

    /* Speed rays bursting from the vanishing point. */
    var spd = 0.35 + this._spd * 1.4;
    var vpX = w * 0.5;
    var vpY = m.farY;
    for (var j = 0; j < this.speedLines.length; j++) {
      var sl = this.speedLines[j];
      sl.u += dt * (0.55 + this._spd * 1.8) * (0.6 + (j % 5) * 0.12);
      if (sl.u > 1) sl.u -= 1;
      var reach = 80 + sl.u * Math.max(w, h) * 0.72;
      var ang = sl.ang + sl.side * 0.15;
      var x0 = vpX + Math.sin(ang) * (30 + sl.u * 40);
      var y0 = vpY + sl.u * 24;
      var x1 = vpX + Math.sin(ang) * reach;
      var y1 = vpY + Math.cos(ang * 0.35) * sl.u * h * 0.55 + sl.u * 40;
      /* Keep rays mostly outside the road so the gates stay readable. */
      if (Math.abs(x1 - vpX) < w * 0.18 && y1 < h * 0.75) continue;
      ctx.strokeStyle = 'rgba(186,230,253,' + (0.04 + 0.22 * sl.u * spd) + ')';
      ctx.lineWidth = sl.w * (0.6 + sl.u * spd);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
  };

  Renderer.prototype.drawWalls = function (state) {
    var ctx = this.ctx;
    var w = this.w;
    var h = this.h;
    var m = this.metrics();
    var cx = w / 2;

    function wall(side) {
      ctx.beginPath();
      if (side < 0) {
        ctx.moveTo(0, m.farY - 30);
        ctx.lineTo(cx - m.farHalf, m.farY);
        ctx.lineTo(cx - m.nearHalf, m.nearY);
        ctx.lineTo(0, h);
      } else {
        ctx.moveTo(w, m.farY - 30);
        ctx.lineTo(cx + m.farHalf, m.farY);
        ctx.lineTo(cx + m.nearHalf, m.nearY);
        ctx.lineTo(w, h);
      }
      ctx.closePath();
      var lg = ctx.createLinearGradient(side < 0 ? 0 : w, 0, cx, 0);
      lg.addColorStop(0, 'rgba(18,10,48,0.95)');
      lg.addColorStop(1, 'rgba(40,20,80,0.2)');
      ctx.fillStyle = lg;
      ctx.fill();
    }
    wall(-1);
    wall(1);

    var scroll = (state.distance * 0.35) % 1;
    for (var i = 0; i < 10; i++) {
      var t = (i / 10 + scroll) % 1;
      var depth = Math.pow(t, 1.05);
      var y = m.farY + (m.nearY - m.farY) * depth;
      var half = m.farHalf + (m.nearHalf - m.farHalf) * depth;
      var rib = 10 + 46 * depth;
      ctx.globalAlpha = 0.15 + 0.55 * depth;
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(34,211,238,0.85)' : 'rgba(192,132,252,0.8)';
      ctx.lineWidth = 1.5 + 3 * depth;
      ctx.beginPath();
      ctx.moveTo(cx - half - rib, y);
      ctx.lineTo(cx - half - 2, y);
      ctx.moveTo(cx + half + 2, y);
      ctx.lineTo(cx + half + rib, y);
      ctx.stroke();
      /* Window slits. */
      ctx.fillStyle = 'rgba(253,224,71,0.55)';
      ctx.fillRect(cx - half - rib * 0.65, y - 8 * depth, 4 * depth + 2, 5 * depth + 2);
      ctx.fillRect(cx + half + rib * 0.35, y - 8 * depth, 4 * depth + 2, 5 * depth + 2);
    }
    ctx.globalAlpha = 1;
  };

  Renderer.prototype.drawRoad = function (state) {
    var ctx = this.ctx;
    var m = this.metrics();
    var cx = this.w / 2;
    var nearY = m.nearY;
    var farY = m.farY;
    var nearHalf = m.nearHalf;
    var farHalf = m.farHalf;

    ctx.beginPath();
    ctx.moveTo(cx - farHalf, farY);
    ctx.lineTo(cx + farHalf, farY);
    ctx.lineTo(cx + nearHalf, nearY);
    ctx.lineTo(cx - nearHalf, nearY);
    ctx.closePath();
    var rg = ctx.createLinearGradient(0, farY, 0, nearY);
    rg.addColorStop(0, '#1a1038');
    rg.addColorStop(0.45, '#241450');
    rg.addColorStop(1, '#12081c');
    ctx.fillStyle = rg;
    ctx.fill();

    /* Asphalt bands. */
    var scroll = (state.distance * 0.012) % 1;
    for (var i = 0; i < 14; i++) {
      var t0 = Math.pow((i + scroll) / 14, 1.15);
      var t1 = Math.pow((i + 0.42 + scroll) / 14, 1.15);
      if (t0 > 1) continue;
      var y0 = farY + (nearY - farY) * Math.min(1, t0);
      var y1 = farY + (nearY - farY) * Math.min(1, t1);
      var h0 = farHalf + (nearHalf - farHalf) * Math.min(1, t0);
      var h1 = farHalf + (nearHalf - farHalf) * Math.min(1, t1);
      ctx.fillStyle = (i % 2 === 0) ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.moveTo(cx - h0, y0);
      ctx.lineTo(cx + h0, y0);
      ctx.lineTo(cx + h1, y1);
      ctx.lineTo(cx - h1, y1);
      ctx.closePath();
      ctx.fill();
    }

    /* Forward chevrons — the ad-runner speed cue. */
    var chev = (state.distance * 0.01) % 1;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (var c = 0; c < 7; c++) {
      var ct = Math.pow((c + chev) / 7, 1.25);
      if (ct > 1) continue;
      var cy = farY + (nearY - farY) * ct;
      var ch = farHalf + (nearHalf - farHalf) * ct;
      var spread = ch * 0.62;
      var thick = 2 + 9 * ct;
      var base = cy + 10 + 36 * ct;
      ctx.strokeStyle = 'rgba(103,232,249,' + (0.12 + 0.72 * ct) + ')';
      ctx.lineWidth = thick;
      ctx.beginPath();
      ctx.moveTo(cx - spread, base);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + spread, base);
      ctx.stroke();
    }

    /* Lane dividers. */
    var lanes = state.lanes || 3;
    var dashScroll = (state.distance * 0.55) % 40;
    for (var L = 1; L < lanes; L++) {
      var lt = L / lanes;
      ctx.strokeStyle = 'rgba(216,180,254,0.55)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([16, 18]);
      ctx.lineDashOffset = -dashScroll;
      ctx.beginPath();
      ctx.moveTo(cx - farHalf + farHalf * 2 * lt, farY);
      ctx.lineTo(cx - nearHalf + nearHalf * 2 * lt, nearY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    /* Neon curbs. */
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#22d3ee';
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(cx - farHalf, farY);
    ctx.lineTo(cx - nearHalf, nearY);
    ctx.moveTo(cx + farHalf, farY);
    ctx.lineTo(cx + nearHalf, nearY);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    /* Horizon fog so distant gates melt in. */
    var fog = ctx.createLinearGradient(0, farY - 8, 0, farY + (nearY - farY) * 0.28);
    fog.addColorStop(0, 'rgba(48,24,90,0.55)');
    fog.addColorStop(1, 'rgba(48,24,90,0)');
    ctx.fillStyle = fog;
    ctx.beginPath();
    ctx.moveTo(cx - farHalf * 2.2, farY - 8);
    ctx.lineTo(cx + farHalf * 2.2, farY - 8);
    ctx.lineTo(cx + nearHalf * 0.55, farY + (nearY - farY) * 0.28);
    ctx.lineTo(cx - nearHalf * 0.55, farY + (nearY - farY) * 0.28);
    ctx.closePath();
    ctx.fill();
  };

  Renderer.prototype.drawGate = function (state, e) {
    var rel = e.z - state.distance;
    /* Drop gates once they reach the runner so they don't ghost over the crowd. */
    if (rel < 26 || rel > 700) return;
    var p = this.project(rel, e.lane, state.lanes);
    var ctx = this.ctx;
    var sc = p.scale;
    var bw = Math.min(p.laneW * 0.92, 150 * sc);
    var bh = bw * 1.28;
    var depth3d = Math.max(4, bw * 0.12);
    var color = GATE_COLORS[e.type] || '#fff';
    var fade = rel < 52 ? Math.max(0, (rel - 26) / 26) : 1;
    if (fade < 0.05) return;

    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(p.x, p.y);

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(depth3d * 0.4, 8 * sc, bw * 0.46, Math.max(3, 9 * sc), 0, 0, Math.PI * 2);
    ctx.fill();

    var doorImg = this.assets && this.assets.doors[e.type];
    if (imageReady(doorImg)) {
      ctx.drawImage(doorImg, -bw / 2, -bh, bw, bh);
    } else {
      /* Extruded side + top. */
      ctx.fillStyle = shade(color, -0.5);
      ctx.beginPath();
      ctx.moveTo(bw / 2, -bh);
      ctx.lineTo(bw / 2 + depth3d, -bh - depth3d * 0.45);
      ctx.lineTo(bw / 2 + depth3d, depth3d * 0.2);
      ctx.lineTo(bw / 2, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = shade(color, -0.15);
      ctx.beginPath();
      ctx.moveTo(-bw / 2, -bh);
      ctx.lineTo(-bw / 2 + depth3d * 0.25, -bh - depth3d * 0.55);
      ctx.lineTo(bw / 2 + depth3d, -bh - depth3d * 0.45);
      ctx.lineTo(bw / 2, -bh);
      ctx.closePath();
      ctx.fill();

      ctx.shadowColor = color;
      ctx.shadowBlur = 18 * Math.min(1.4, sc + 0.3);
      var face = ctx.createLinearGradient(-bw / 2, -bh, bw / 2, 0);
      face.addColorStop(0, shade(color, 0.28));
      face.addColorStop(0.5, color);
      face.addColorStop(1, shade(color, -0.38));
      ctx.fillStyle = face;
      roundRect(ctx, -bw / 2, -bh, bw, bh, Math.max(4, 12 * sc));
      ctx.fill();
      ctx.shadowBlur = 0;

      var inset = Math.max(3, bw * 0.09);
      ctx.fillStyle = 'rgba(5,6,16,0.78)';
      roundRect(ctx, -bw / 2 + inset, -bh + inset, bw - inset * 2, bh - inset * 2, Math.max(3, 8 * sc));
      ctx.fill();

      var beam = ctx.createLinearGradient(0, -bh, 0, 0);
      beam.addColorStop(0, 'rgba(255,255,255,0)');
      beam.addColorStop(0.45, hexAlpha(color, 0.45));
      beam.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = beam;
      ctx.fillRect(-bw * 0.08, -bh + inset, bw * 0.16, bh - inset * 2);

      var scan = ((state.time * 0.85 + (e.id || 0) * 0.17) % 1);
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      var scanY = -bh + inset + scan * (bh - inset * 2 - 4);
      ctx.fillRect(-bw / 2 + inset, scanY, bw - inset * 2, Math.max(2, 3 * sc));

      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = Math.max(1.5, 3 * sc);
      roundRect(ctx, -bw / 2, -bh, bw, bh, Math.max(4, 12 * sc));
      ctx.stroke();
    }

    var label = e.label || '';
    var len = label.length;
    var fs = bh * (len <= 2 ? 0.46 : len <= 3 ? 0.36 : len <= 5 ? 0.24 : 0.17);
    fs = Math.max(11, Math.min(fs, bw * 0.62));
    ctx.font = '900 ' + Math.floor(fs) + 'px system-ui,Segoe UI,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(3, fs * 0.14);
    ctx.strokeStyle = 'rgba(0,0,0,0.72)';
    ctx.strokeText(label, depth3d * 0.15, -bh * 0.48);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = color;
    ctx.shadowBlur = 12 * sc;
    ctx.fillText(label, depth3d * 0.15, -bh * 0.48);
    ctx.shadowBlur = 0;

    /* Floor glint. */
    ctx.globalAlpha = fade * 0.28;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 4 * sc, bw * 0.28, Math.max(2, 5 * sc), 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  Renderer.prototype.drawEnemy = function (state, e) {
    if (e.dead) return;
    var rel = e.z - state.distance;
    if (rel < 26 || rel > 700) return;
    var fade = rel < 52 ? Math.max(0, (rel - 26) / 26) : 1;
    if (fade < 0.05) return;
    var p = this.project(rel, e.lane, state.lanes);
    var ctx = this.ctx;
    var color = ENEMY_COLORS[e.enemyKind] || '#ff6b6b';
    var near = rel < 140 ? 1 + (140 - rel) / 140 * 0.12 : 1;
    var r = (e.enemyKind === 'boss' ? 46 : e.enemyKind === 'elite' ? 32 : 24) * p.scale * near;
    var bob = Math.sin(state.time * 6 + (e.id || 0)) * 3 * p.scale;
    var canKill = state.power >= e.hp;

    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(p.x, p.y - r * 0.15 + bob);

    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.95, r * 0.85, r * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();

    var monsterImg = this.assets && this.assets.monsters[e.enemyKind];
    if (imageReady(monsterImg)) {
      var msize = r * 2.75;
      ctx.drawImage(monsterImg, -msize / 2, r * 0.92 - msize * 0.9, msize, msize);
    } else {
    ctx.shadowColor = color;
    ctx.shadowBlur = 16 * p.scale;

    if (e.enemyKind === 'boss') {
      ctx.fillStyle = shade(color, -0.25);
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.25);
      ctx.lineTo(r * 1.15, r * 0.85);
      ctx.lineTo(-r * 1.15, r * 0.85);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.82, r * 0.62);
      ctx.lineTo(-r * 0.82, r * 0.62);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff';
      horn(ctx, -1, r);
      horn(ctx, 1, r);
    } else if (e.enemyKind === 'elite') {
      ctx.fillStyle = shade(color, -0.3);
      diamond(ctx, r * 1.05);
      ctx.fill();
      ctx.fillStyle = color;
      diamond(ctx, r * 0.72);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = Math.max(1, 2 * p.scale);
      diamond(ctx, r * 0.72);
      ctx.stroke();
    } else {
      ctx.fillStyle = shade(color, -0.2);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(-r * 0.1, -r * 0.12, r * 0.82, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = shade(color, 0.2);
      spike(ctx, -0.55, r);
      spike(ctx, 0.55, r);
    }
    ctx.shadowBlur = 0;

    /* Eyes. */
    ctx.fillStyle = '#14080f';
    ctx.beginPath();
    ctx.ellipse(-r * 0.28, -r * 0.05, r * 0.16, r * 0.18, 0, 0, Math.PI * 2);
    ctx.ellipse(r * 0.28, -r * 0.05, r * 0.16, r * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-r * 0.24, -r * 0.1, r * 0.06, 0, Math.PI * 2);
    ctx.arc(r * 0.32, -r * 0.1, r * 0.06, 0, Math.PI * 2);
    ctx.fill();

    /* Mouth on grunts. */
    if (e.enemyKind === 'grunt') {
      ctx.strokeStyle = 'rgba(40,0,10,0.8)';
      ctx.lineWidth = Math.max(1.4, r * 0.09);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, r * 0.48, r * 0.22, 1.2 * Math.PI, 1.8 * Math.PI);
      ctx.stroke();
    }
    }

    /* Killable ring: green means the crowd wins, red means dodge. */
    ctx.strokeStyle = canKill ? 'rgba(34,197,94,0.95)' : 'rgba(239,68,68,0.95)';
    ctx.lineWidth = Math.max(2, 3.5 * p.scale);
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.18, 0, Math.PI * 2);
    ctx.stroke();

    var label = String(e.hp);
    var bw = Math.max(r * 1.3, label.length * r * 0.55);
    var bh = Math.max(14, r * 0.62);
    var by = r * 0.95;
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    roundRect(ctx, -bw / 2, by, bw, bh, 6 * p.scale);
    ctx.fill();
    ctx.fillStyle = canKill ? '#bbf7d0' : '#fecaca';
    ctx.font = '900 ' + Math.floor(Math.max(12, r * 0.55)) + 'px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, by + bh / 2);

    if (e.label && e.enemyKind === 'boss') {
      ctx.font = '900 ' + Math.floor(Math.max(11, 13 * p.scale)) + 'px system-ui,sans-serif';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 3;
      ctx.strokeText(e.label, 0, -r * 1.45);
      ctx.fillStyle = '#fde68a';
      ctx.fillText(e.label, 0, -r * 1.45);
    }
    ctx.restore();
  };

  Renderer.prototype._slots = function (n) {
    if (this._crowdN === n) return this._crowd;
    var slots = [];
    var remain = n;
    var row = 0;
    var pattern = [1, 2, 3, 4, 4, 5, 5];
    while (remain > 0 && row < 7) {
      var cols = Math.min(remain, pattern[Math.min(row, pattern.length - 1)]);
      for (var c = 0; c < cols; c++) {
        slots.push({
          x: (c - (cols - 1) / 2) * (16 - row * 0.35),
          y: -row * 13,
          s: 1 - row * 0.055,
          i: slots.length
        });
      }
      remain -= cols;
      row++;
    }
    this._crowdN = n;
    this._crowd = slots;
    return slots;
  };

  Renderer.prototype.drawPlayer = function (state) {
    var ctx = this.ctx;
    var depth = 0.97;
    var lanePos = NGCore.lerp(state.lane, state.targetLane, easeOut(state.laneT));
    var x = this.laneXAt(lanePos, state.lanes, depth);
    var y = this.h * 0.8;
    var bob = Math.sin(state.time * 14) * 3;

    this.powerPulseVel += (1 - this.powerPulse) * 22 * 0.016;
    this.powerPulseVel *= 0.8;
    this.powerPulse += this.powerPulseVel;
    var pulse = this.powerPulse;

    var count = visualCount(state.power);
    var slots = this._slots(count);
    var body = (1.2 + Math.min(0.7, Math.log10(Math.max(1, state.power)) * 0.28)) * pulse;
    var lean = 0;
    if (state.laneT < 1) lean = (state.targetLane - state.lane) * (1 - state.laneT);

    /* Dust at the feet. */
    if (this.dust.length < 22 && Math.random() < 0.55) {
      this.dust.push({
        x: x + (Math.random() - 0.5) * 28 * body,
        y: y + 6,
        vx: (Math.random() - 0.5) * 30,
        vy: -20 - Math.random() * 30,
        life: 0.28 + Math.random() * 0.15,
        max: 0.4,
        r: 2 + Math.random() * 2.5
      });
    }

    ctx.save();
    ctx.translate(x + lean * 10, y + bob);
    ctx.rotate(lean * -0.08);

    if (state.shield) {
      var auraR = 34 * body + slots.length * 3 + Math.sin(state.time * 8) * 3;
      ctx.strokeStyle = 'rgba(45,212,191,0.95)';
      ctx.lineWidth = 3.5;
      ctx.shadowColor = '#2dd4bf';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.ellipse(0, -18 * body, auraR, auraR * 0.72, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(45,212,191,0.08)';
      ctx.beginPath();
      ctx.ellipse(0, -18 * body, auraR, auraR * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (state.combo >= 3) {
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 22;
    }

    /* Back rows first. */
    for (var i = slots.length - 1; i >= 0; i--) {
      var sl = slots[i];
      var frames = this.assets && this.assets.runner;
      var frame = null;
      if (frames && imageReady(frames[0])) {
        frame = frames[(Math.floor(state.time * 8) + i) % 2];
        if (!imageReady(frame)) frame = frames[0];
      }
      drawRunner(
        ctx,
        sl.x * body,
        sl.y * body,
        body * sl.s * (i === 0 ? 1.12 : 1),
        state.time * 16 + i,
        i === 0 ? '#e0fbff' : CROWD_COLORS[i % CROWD_COLORS.length],
        frame
      );
    }
    ctx.shadowBlur = 0;

    /* Hero power number above the crowd. */
    var top = 0;
    for (var k = 0; k < slots.length; k++) top = Math.min(top, slots[k].y);
    var numY = top * body - 36 * body;
    var num = formatNum(state.power);
    var nfs = Math.floor((34 + Math.min(18, String(Math.floor(state.power)).length)) * pulse);
    ctx.font = '900 ' + nfs + 'px system-ui,Segoe UI,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.strokeText(num, 0, numY);
    ctx.fillStyle = '#67e8f9';
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 16;
    ctx.fillText(num, 0, numY);
    ctx.shadowBlur = 0;

    ctx.restore();
    return { x: x, y: y + bob };
  };

  Renderer.prototype.drawDust = function (dt) {
    var ctx = this.ctx;
    for (var i = this.dust.length - 1; i >= 0; i--) {
      var d = this.dust[i];
      d.life -= dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (d.life <= 0) {
        this.dust.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = Math.max(0, d.life / d.max);
      ctx.fillStyle = 'rgba(186,230,253,0.8)';
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  Renderer.prototype.drawHUDOverlay = function (state) {
    var ctx = this.ctx;
    if (state.combo >= 2) {
      var age = this.comboFlash > 0 ? this.comboFlash : 0;
      var scale = 1 + Math.min(0.35, state.combo * 0.03) + age * 0.25;
      ctx.save();
      ctx.translate(this.w / 2, this.h * 0.2);
      ctx.scale(scale, scale);
      ctx.font = '900 34px system-ui,Segoe UI,sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 7;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      var text = state.combo >= 6 ? 'RAMPAGE ×' + state.combo : 'COMBO ×' + state.combo;
      ctx.strokeText(text, 0, 0);
      var cg = ctx.createLinearGradient(-120, 0, 120, 0);
      cg.addColorStop(0, '#fde68a');
      cg.addColorStop(0.5, '#fb923c');
      cg.addColorStop(1, '#f43f5e');
      ctx.fillStyle = cg;
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }
    if (state.scoreMult > 1) {
      ctx.save();
      ctx.font = '900 20px system-ui,sans-serif';
      ctx.textAlign = 'right';
      ctx.fillStyle = '#f9a8d4';
      ctx.shadowColor = '#ec4899';
      ctx.shadowBlur = 10;
      ctx.fillText('SCORE ×' + state.scoreMult.toFixed(1), this.w - 22, this.h * 0.2);
      ctx.restore();
    }
    if (this.comboFlash > 0) this.comboFlash = Math.max(0, this.comboFlash - 0.035);
  };

  Renderer.prototype.drawFlash = function () {
    if (this.flashA > 0.015) {
      var ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha = this.flashA;
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(-40, -40, this.w + 80, this.h + 80);
      ctx.restore();
      this.flashA *= 0.84;
    }
    var ctx2 = this.ctx;
    var vg = ctx2.createRadialGradient(this.w / 2, this.h * 0.55, this.w * 0.28, this.w / 2, this.h * 0.5, this.w * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx2.fillStyle = vg;
    ctx2.fillRect(0, 0, this.w, this.h);
  };

  Renderer.prototype.render = function (state, particles, dt) {
    var ctx = this.ctx;
    this._spd = Math.min(1, ((state && state.speed) || 140) / 420);
    this._m = null;

    var shakeAmt = state.shake || 0;
    var shakeX = 0;
    var shakeY = 0;
    if (shakeAmt > 0.02) {
      shakeX = (Math.random() - 0.5) * 22 * shakeAmt;
      shakeY = (Math.random() - 0.5) * 16 * shakeAmt;
    }
    var lean = 0;
    if (state.laneT < 1) lean = (state.targetLane - state.lane) * (1 - state.laneT);

    ctx.save();
    ctx.translate(this.w / 2, this.h * 0.62);
    ctx.rotate(lean * 0.03 + shakeAmt * (Math.random() - 0.5) * 0.02);
    ctx.translate(-this.w / 2, -this.h * 0.62);
    ctx.translate(shakeX, shakeY);

    this.drawBackground(state, dt || 0);
    this.drawWalls(state);
    this.drawRoad(state);

    var list = state.entities.slice().sort(function (a, b) { return b.z - a.z; });
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e.consumed && e.kind === 'gate') continue;
      if (e.kind === 'gate') this.drawGate(state, e);
      else if (e.kind === 'enemy') this.drawEnemy(state, e);
    }

    this.drawDust(dt || 0);
    var playerPos = this.drawPlayer(state);
    if (particles) particles.draw(ctx);
    this.drawFlash();
    this.drawHUDOverlay(state);
    ctx.restore();
    return playerPos;
  };

  function visualCount(power) {
    power = Math.max(1, power);
    if (power < 3) return 1;
    if (power < 8) return 3;
    if (power < 16) return 6;
    if (power < 32) return 10;
    if (power < 64) return 14;
    if (power < 120) return 18;
    return Math.min(24, 18 + Math.floor(Math.log2(power / 40)));
  }

  function drawRunner(ctx, x, y, s, phase, color, sprite) {
    if (imageReady(sprite)) {
      var spr = 30 * s;
      ctx.drawImage(sprite, x - spr * 0.5, y + 2 - spr * 0.94, spr, spr);
      return;
    }
    var swing = Math.sin(phase) * 4.5 * s;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 7 * s, 2.6 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = shade(color, -0.45);
    ctx.lineWidth = Math.max(1.4, 2.3 * s);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 1.6 * s, y - 7 * s);
    ctx.lineTo(x - 2.4 * s + swing, y + 1);
    ctx.moveTo(x + 1.6 * s, y - 7 * s);
    ctx.lineTo(x + 2.4 * s - swing, y + 1);
    ctx.stroke();

    ctx.fillStyle = color;
    roundRect(ctx, x - 4.4 * s, y - 16.5 * s, 8.8 * s, 10.5 * s, 3 * s);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    roundRect(ctx, x - 3 * s, y - 15.5 * s, 3.2 * s, 3 * s, 1.5 * s);
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.2, 1.8 * s);
    ctx.beginPath();
    ctx.moveTo(x - 4 * s, y - 13 * s);
    ctx.lineTo(x - 7 * s, y - 8 * s - swing * 0.35);
    ctx.moveTo(x + 4 * s, y - 13 * s);
    ctx.lineTo(x + 7 * s, y - 9 * s + swing * 0.35);
    ctx.stroke();

    ctx.fillStyle = '#ffd7b5';
    ctx.beginPath();
    ctx.arc(x, y - 19.2 * s, 4.3 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade(color, -0.15);
    ctx.beginPath();
    ctx.arc(x, y - 20.6 * s, 4.3 * s, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#1a1020';
    ctx.beginPath();
    ctx.arc(x + 1.5 * s, y - 19 * s, 0.7 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  function horn(ctx, dir, r) {
    ctx.beginPath();
    ctx.moveTo(dir * r * 0.35, -r * 0.55);
    ctx.lineTo(dir * r * 0.95, -r * 1.25);
    ctx.lineTo(dir * r * 0.05, -r * 0.35);
    ctx.closePath();
    ctx.fill();
  }

  function spike(ctx, dir, r) {
    ctx.beginPath();
    ctx.moveTo(dir * r * 0.7, -r * 0.45);
    ctx.lineTo(dir * r * 0.95, -r * 1.15);
    ctx.lineTo(dir * r * 0.25, -r * 0.55);
    ctx.closePath();
    ctx.fill();
  }

  function diamond(ctx, r) {
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r, 0);
    ctx.closePath();
  }

  function easeOut(t) {
    return 1 - (1 - t) * (1 - t);
  }

  function roundRect(ctx, x, y, w, h, r) {
    if (w < 0) { x += w; w = -w; }
    if (h < 0) { y += h; h = -h; }
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function shade(hex, lum) {
    hex = String(hex).replace(/[^0-9a-f]/gi, '');
    if (hex.length < 6) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    var rgb = '#';
    for (var i = 0; i < 3; i++) {
      var c = parseInt(hex.substr(i * 2, 2), 16);
      c = Math.round(Math.min(255, Math.max(0, c + c * lum)));
      var s = c.toString(16);
      rgb += s.length === 1 ? '0' + s : s;
    }
    return rgb;
  }

  function hexAlpha(hex, a) {
    hex = String(hex).replace('#', '');
    if (hex.length < 6) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    var r = parseInt(hex.substr(0, 2), 16);
    var g = parseInt(hex.substr(2, 2), 16);
    var b = parseInt(hex.substr(4, 2), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  function formatNum(n) {
    n = Math.floor(n);
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e4) return (n / 1e3).toFixed(1) + 'K';
    return String(n);
  }

  Renderer.GATE_COLORS = GATE_COLORS;
  Renderer.ENEMY_COLORS = ENEMY_COLORS;
  Renderer.formatNum = formatNum;

  global.NGRender = Renderer;
})(typeof window !== 'undefined' ? window : global);
