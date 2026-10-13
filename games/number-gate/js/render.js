/**
 * Canvas renderer — ad-grade pseudo-3D Number Gate Runner.
 */
(function (global) {
  'use strict';

  var GATE_COLORS = {
    add: '#22c55e',
    mul: '#a855f7',
    sub: '#ef4444',
    div: '#dc2626',
    bomb: '#f97316',
    shield: '#14b8a6',
    scoreMul: '#ec4899',
    shieldBreak: '#14b8a6'
  };

  var ENEMY_COLORS = {
    grunt: '#ff5c7a',
    elite: '#fbbf24',
    boss: '#c084fc'
  };

  function Renderer(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = 420;
    this.h = 720;
    this.dpr = 1;
    this.bgPhase = 0;
    this.powerPulse = 1;
    this.powerPulseVel = 0;
    this.displayPower = 0;
    this.comboFlash = 0;
    this.speedLines = [];
    for (var i = 0; i < 36; i++) {
      this.speedLines.push({
        x: Math.random(),
        y: Math.random(),
        len: 0.03 + Math.random() * 0.08,
        sp: 0.6 + Math.random() * 1.2,
        side: Math.random() < 0.5 ? -1 : 1
      });
    }
    this.tiles = [];
  }

  Renderer.prototype.resize = function () {
    var parent = this.canvas.parentElement;
    var pw = parent ? parent.clientWidth : window.innerWidth;
    var ph = parent ? parent.clientHeight : window.innerHeight;
    // Fill available space; prefer landscape-ish on desktop, tall on mobile
    var maxW = Math.min(pw, 720);
    var maxH = Math.min(ph, 900);
    var tw = maxW;
    var th = maxH;
    // Keep playable aspect ~ between 9:16 and 3:4
    var aspect = tw / th;
    if (aspect < 0.48) {
      tw = th * 0.52;
    } else if (aspect > 0.85) {
      // Desktop wide: cap width relative to height so road still reads
      tw = Math.min(tw, th * 0.72);
    }
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.w = Math.max(320, Math.floor(tw));
    this.h = Math.max(480, Math.floor(th));
    this.canvas.style.width = this.w + 'px';
    this.canvas.style.height = this.h + 'px';
    this.canvas.width = Math.floor(this.w * this.dpr);
    this.canvas.height = Math.floor(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  };

  Renderer.prototype.project = function (relZ, lane, lanes) {
    var view = 720;
    var t = Math.max(0, Math.min(1, relZ / view));
    var nearY = this.h * 0.84;
    var farY = this.h * 0.10;
    var depth = 1 - t;
    var y = farY + (nearY - farY) * Math.pow(depth, 0.78);
    var scale = 0.22 + 0.78 * Math.pow(depth, 0.9);
    var roadHalfNear = this.w * 0.44;
    var roadHalfFar = this.w * 0.08;
    var roadHalf = roadHalfFar + (roadHalfNear - roadHalfFar) * depth;
    var laneCount = lanes || 3;
    var laneW = (roadHalf * 2) / laneCount;
    var cx = this.w / 2;
    var x = cx - roadHalf + laneW * (lane + 0.5);
    return { x: x, y: y, scale: scale, roadHalf: roadHalf, depth: depth };
  };

  Renderer.prototype.laneXAt = function (lane, lanes, depth) {
    var roadHalfNear = this.w * 0.44;
    var roadHalfFar = this.w * 0.08;
    var roadHalf = roadHalfFar + (roadHalfNear - roadHalfFar) * depth;
    var laneW = (roadHalf * 2) / (lanes || 3);
    return this.w / 2 - roadHalf + laneW * (lane + 0.5);
  };

  Renderer.prototype.pulsePower = function (target) {
    this.powerPulseVel = 0.55;
    this.displayPower = target;
  };

  Renderer.prototype.drawBackground = function (state, dt) {
    var ctx = this.ctx;
    var w = this.w, h = this.h;
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#050816');
    g.addColorStop(0.35, '#0c1238');
    g.addColorStop(0.65, '#1a0f45');
    g.addColorStop(1, '#2a1050');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // nebula glow
    var ng = ctx.createRadialGradient(w * 0.5, h * 0.12, 10, w * 0.5, h * 0.12, w * 0.55);
    ng.addColorStop(0, 'rgba(120,60,255,0.35)');
    ng.addColorStop(0.5, 'rgba(0,180,255,0.08)');
    ng.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ng;
    ctx.fillRect(0, 0, w, h * 0.5);

    // stars
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (var i = 0; i < 55; i++) {
      var sx = ((i * 97 + state.distance * 0.015) % w + w) % w;
      var sy = ((i * 53 + Math.sin(i) * 20) % (h * 0.42) + h * 0.42) % (h * 0.42);
      var sr = (i % 3 === 0) ? 2.2 : 1.2;
      ctx.globalAlpha = 0.25 + (i % 5) * 0.12;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    this.bgPhase += (state.speed || 100) * dt * 0.012;
    var spd = (state.speed || 100) / 180;
    for (var j = 0; j < this.speedLines.length; j++) {
      var sl = this.speedLines[j];
      sl.y += spd * sl.sp * dt * 2.2;
      if (sl.y > 1.2) {
        sl.y = -0.15;
        sl.x = 0.05 + Math.random() * 0.9;
      }
      var x = sl.x * w;
      var y = sl.y * h;
      var edge = Math.abs(sl.x - 0.5);
      ctx.strokeStyle = 'rgba(140,210,255,' + (0.06 + 0.22 * spd * edge) + ')';
      ctx.lineWidth = 1.5 + spd;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + sl.side * 4 * spd, y + sl.len * h * (0.6 + spd));
      ctx.stroke();
    }
  };

  Renderer.prototype.drawSideWalls = function (state) {
    var ctx = this.ctx;
    var w = this.w, h = this.h;
    var nearY = h * 0.88;
    var farY = h * 0.10;
    var cx = w / 2;
    var nearHalf = w * 0.44;
    var farHalf = w * 0.08;
    var wallOut = w * 0.02;

    // left wall
    var lg = ctx.createLinearGradient(0, 0, cx - nearHalf, 0);
    lg.addColorStop(0, 'rgba(40,20,80,0.85)');
    lg.addColorStop(1, 'rgba(20,10,40,0.15)');
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.moveTo(0, farY - 20);
    ctx.lineTo(cx - farHalf, farY);
    ctx.lineTo(cx - nearHalf, nearY);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();

    // right wall
    var rg = ctx.createLinearGradient(w, 0, cx + nearHalf, 0);
    rg.addColorStop(0, 'rgba(40,20,80,0.85)');
    rg.addColorStop(1, 'rgba(20,10,40,0.15)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.moveTo(w, farY - 20);
    ctx.lineTo(cx + farHalf, farY);
    ctx.lineTo(cx + nearHalf, nearY);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // wall ribs scrolling
    var scroll = (state.distance * 0.25) % 50;
    ctx.strokeStyle = 'rgba(100,60,200,0.25)';
    ctx.lineWidth = 2;
    for (var i = 0; i < 12; i++) {
      var t = (i / 12 + scroll / 600) % 1;
      var depth = Math.pow(1 - t, 0.85);
      var y = farY + (nearY - farY) * depth;
      var half = farHalf + (nearHalf - farHalf) * depth;
      ctx.globalAlpha = 0.15 + 0.35 * depth;
      ctx.beginPath();
      ctx.moveTo(cx - half - 30 * depth, y);
      ctx.lineTo(cx - half, y);
      ctx.moveTo(cx + half, y);
      ctx.lineTo(cx + half + 30 * depth, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };

  Renderer.prototype.drawRoad = function (state) {
    var ctx = this.ctx;
    var w = this.w, h = this.h;
    var nearY = h * 0.88;
    var farY = h * 0.10;
    var cx = w / 2;
    var nearHalf = w * 0.44;
    var farHalf = w * 0.08;

    // road fill
    ctx.beginPath();
    ctx.moveTo(cx - farHalf, farY);
    ctx.lineTo(cx + farHalf, farY);
    ctx.lineTo(cx + nearHalf, nearY);
    ctx.lineTo(cx - nearHalf, nearY);
    ctx.closePath();
    var rg = ctx.createLinearGradient(0, farY, 0, nearY);
    rg.addColorStop(0, '#1a1448');
    rg.addColorStop(0.5, '#2a1f6a');
    rg.addColorStop(1, '#3d2a8a');
    ctx.fillStyle = rg;
    ctx.fill();

    // perspective tile strips
    var scroll = (state.distance * 0.55) % 1;
    for (var i = 0; i < 18; i++) {
      var t0 = (i + scroll) / 18;
      var t1 = (i + 0.5 + scroll) / 18;
      if (t0 > 1) continue;
      var d0 = Math.pow(Math.min(1, t0), 0.78);
      var d1 = Math.pow(Math.min(1, t1), 0.78);
      var y0 = farY + (nearY - farY) * d0;
      var y1 = farY + (nearY - farY) * d1;
      var h0 = farHalf + (nearHalf - farHalf) * d0;
      var h1 = farHalf + (nearHalf - farHalf) * d1;
      ctx.fillStyle = (i % 2 === 0) ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.12)';
      ctx.beginPath();
      ctx.moveTo(cx - h0, y0);
      ctx.lineTo(cx + h0, y0);
      ctx.lineTo(cx + h1, y1);
      ctx.lineTo(cx - h1, y1);
      ctx.closePath();
      ctx.fill();
    }

    // edge neon
    ctx.strokeStyle = 'rgba(0,229,255,0.7)';
    ctx.lineWidth = 3.5;
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(cx - farHalf, farY);
    ctx.lineTo(cx - nearHalf, nearY);
    ctx.moveTo(cx + farHalf, farY);
    ctx.lineTo(cx + nearHalf, nearY);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // lane dividers
    var lanes = state.lanes || 3;
    var dashScroll = (state.distance * 0.5) % 50;
    for (var L = 1; L < lanes; L++) {
      var lt = L / lanes;
      ctx.strokeStyle = 'rgba(180,120,255,0.5)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([18, 16]);
      ctx.lineDashOffset = -dashScroll;
      ctx.beginPath();
      var fx = cx - farHalf + (farHalf * 2) * lt;
      var nx = cx - nearHalf + (nearHalf * 2) * lt;
      ctx.moveTo(fx, farY);
      ctx.lineTo(nx, nearY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // horizon glow + fog
    var fog = ctx.createRadialGradient(cx, farY, 4, cx, farY, farHalf * 3);
    fog.addColorStop(0, 'rgba(160,80,255,0.45)');
    fog.addColorStop(0.4, 'rgba(80,40,200,0.2)');
    fog.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fog;
    ctx.fillRect(cx - farHalf * 3, farY - 40, farHalf * 6, 80);

    // distance fog overlay near horizon
    var fogY = ctx.createLinearGradient(0, farY - 10, 0, farY + (nearY - farY) * 0.35);
    fogY.addColorStop(0, 'rgba(12,10,40,0.55)');
    fogY.addColorStop(1, 'rgba(12,10,40,0)');
    ctx.fillStyle = fogY;
    ctx.beginPath();
    ctx.moveTo(cx - farHalf * 1.5, farY - 10);
    ctx.lineTo(cx + farHalf * 1.5, farY - 10);
    ctx.lineTo(cx + nearHalf * 0.7, farY + (nearY - farY) * 0.35);
    ctx.lineTo(cx - nearHalf * 0.7, farY + (nearY - farY) * 0.35);
    ctx.closePath();
    ctx.fill();
  };

  Renderer.prototype.drawGate = function (state, e) {
    var rel = e.z - state.distance;
    if (rel < -20 || rel > 740) return;
    var p = this.project(rel, e.lane, state.lanes);
    var ctx = this.ctx;
    var bw = 72 * p.scale;
    var bh = 96 * p.scale;
    var depth3d = 14 * p.scale;
    var color = GATE_COLORS[e.type] || '#fff';

    ctx.save();
    ctx.translate(p.x, p.y);

    // ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 6 * p.scale, bw * 0.55, 8 * p.scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3D thickness (right + top edges)
    ctx.fillStyle = shade(color, -0.45);
    ctx.beginPath();
    ctx.moveTo(bw / 2, -bh);
    ctx.lineTo(bw / 2 + depth3d, -bh - depth3d * 0.4);
    ctx.lineTo(bw / 2 + depth3d, depth3d * 0.3);
    ctx.lineTo(bw / 2, 0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = shade(color, -0.25);
    ctx.beginPath();
    ctx.moveTo(-bw / 2, -bh);
    ctx.lineTo(-bw / 2 + depth3d * 0.3, -bh - depth3d * 0.5);
    ctx.lineTo(bw / 2 + depth3d, -bh - depth3d * 0.4);
    ctx.lineTo(bw / 2, -bh);
    ctx.closePath();
    ctx.fill();

    // glow
    ctx.shadowColor = color;
    ctx.shadowBlur = 22 * p.scale;

    // front face gradient
    var grd = ctx.createLinearGradient(-bw / 2, -bh, bw / 2, 0);
    grd.addColorStop(0, shade(color, 0.25));
    grd.addColorStop(0.45, color);
    grd.addColorStop(1, shade(color, -0.35));
    ctx.fillStyle = grd;
    roundRect(ctx, -bw / 2, -bh, bw, bh, 10 * p.scale);
    ctx.fill();
    ctx.shadowBlur = 0;

    // bright border
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = Math.max(1.5, 2.5 * p.scale);
    roundRect(ctx, -bw / 2, -bh, bw, bh, 10 * p.scale);
    ctx.stroke();

    // inner dark panel
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    roundRect(ctx, -bw / 2 + 5 * p.scale, -bh + 5 * p.scale, bw - 10 * p.scale, bh - 10 * p.scale, 7 * p.scale);
    ctx.fill();

    // top highlight strip
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    roundRect(ctx, -bw / 2 + 6 * p.scale, -bh + 6 * p.scale, bw - 12 * p.scale, bh * 0.18, 4 * p.scale);
    ctx.fill();

    // huge label
    var fontSize = Math.floor(Math.min(bw * 0.42, 36 * p.scale));
    ctx.font = '900 ' + fontSize + 'px system-ui,Segoe UI,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(3, 5 * p.scale);
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.strokeText(e.label, 0, -bh / 2 + 2 * p.scale);
    ctx.fillStyle = '#fff';
    ctx.shadowColor = color;
    ctx.shadowBlur = 10 * p.scale;
    ctx.fillText(e.label, 0, -bh / 2 + 2 * p.scale);
    ctx.shadowBlur = 0;

    ctx.restore();
  };

  Renderer.prototype.drawEnemy = function (state, e) {
    if (e.dead) return;
    var rel = e.z - state.distance;
    if (rel < -20 || rel > 740) return;
    var p = this.project(rel, e.lane, state.lanes);
    var ctx = this.ctx;
    var color = ENEMY_COLORS[e.enemyKind] || '#ff6b6b';
    var r = (e.enemyKind === 'boss' ? 40 : e.enemyKind === 'elite' ? 28 : 22) * p.scale;
    var bob = Math.sin(state.time * 6 + e.id) * 3 * p.scale;

    ctx.save();
    ctx.translate(p.x, p.y - r + bob);

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, r + 4 * p.scale, r * 0.7, r * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowColor = color;
    ctx.shadowBlur = 18 * p.scale;

    if (e.enemyKind === 'boss') {
      // spiked triangle boss
      ctx.fillStyle = shade(color, -0.2);
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.15);
      ctx.lineTo(r * 1.1, r * 0.75);
      ctx.lineTo(-r * 1.1, r * 0.75);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.85);
      ctx.lineTo(r * 0.85, r * 0.55);
      ctx.lineTo(-r * 0.85, r * 0.55);
      ctx.closePath();
      ctx.fill();
      // horns
      ctx.fillStyle = shade(color, 0.2);
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, -r * 0.4);
      ctx.lineTo(-r * 0.85, -r * 1.1);
      ctx.lineTo(-r * 0.15, -r * 0.55);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(r * 0.5, -r * 0.4);
      ctx.lineTo(r * 0.85, -r * 1.1);
      ctx.lineTo(r * 0.15, -r * 0.55);
      ctx.fill();
    } else if (e.enemyKind === 'elite') {
      // diamond armor
      ctx.fillStyle = shade(color, -0.25);
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.7);
      ctx.lineTo(r * 0.7, 0);
      ctx.lineTo(0, r * 0.7);
      ctx.lineTo(-r * 0.7, 0);
      ctx.closePath();
      ctx.fill();
    } else {
      // grunt blob with horns
      ctx.fillStyle = shade(color, -0.15);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, -r * 0.08, r * 0.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = shade(color, 0.15);
      ctx.beginPath();
      ctx.moveTo(-r * 0.45, -r * 0.55);
      ctx.lineTo(-r * 0.55, -r * 1.05);
      ctx.lineTo(-r * 0.1, -r * 0.65);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(r * 0.45, -r * 0.55);
      ctx.lineTo(r * 0.55, -r * 1.05);
      ctx.lineTo(r * 0.1, -r * 0.65);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // angry eyes
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.ellipse(-r * 0.32, -r * 0.12, r * 0.18, r * 0.14, -0.2, 0, Math.PI * 2);
    ctx.ellipse(r * 0.32, -r * 0.12, r * 0.18, r * 0.14, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-r * 0.28, -r * 0.1, r * 0.07, 0, Math.PI * 2);
    ctx.arc(r * 0.36, -r * 0.1, r * 0.07, 0, Math.PI * 2);
    ctx.fill();

    // HP badge
    var bw = Math.max(36, String(e.hp).length * 12) * p.scale;
    var bh = 20 * p.scale;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    roundRect(ctx, -bw / 2, r * 0.65, bw, bh, 6 * p.scale);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5 * p.scale;
    roundRect(ctx, -bw / 2, r * 0.65, bw, bh, 6 * p.scale);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = '900 ' + Math.floor(14 * p.scale) + 'px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(e.hp), 0, r * 0.65 + bh / 2);

    if (e.label && e.enemyKind === 'boss') {
      ctx.fillStyle = '#ffeaa7';
      ctx.font = 'bold ' + Math.floor(12 * p.scale) + 'px system-ui,sans-serif';
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 3;
      ctx.strokeText(e.label, 0, -r - 14 * p.scale);
      ctx.fillText(e.label, 0, -r - 14 * p.scale);
    }
    ctx.restore();
  };

  Renderer.prototype.drawPlayer = function (state) {
    var ctx = this.ctx;
    var depth = 0.92;
    var lanePos = NGCore.lerp(state.lane, state.targetLane, easeOut(state.laneT));
    var x = this.laneXAt(lanePos, state.lanes, depth);
    var y = this.h * 0.78;
    var bob = Math.sin(state.time * 14) * 4;
    var stacks = Math.min(10, 1 + Math.floor(Math.log2(Math.max(1, state.power))));
    var bodyScale = 0.85 + Math.min(0.45, Math.log10(Math.max(1, state.power)) * 0.25);

    // power pulse spring
    this.powerPulseVel += (1 - this.powerPulse) * 18 * 0.016;
    this.powerPulseVel *= 0.82;
    this.powerPulse += this.powerPulseVel;
    var pulse = this.powerPulse;

    ctx.save();
    ctx.translate(x, y + bob);

    // ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 18, 28 * bodyScale * pulse, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // shield aura
    if (state.shield) {
      ctx.strokeStyle = 'rgba(20,184,166,0.9)';
      ctx.lineWidth = 3.5;
      ctx.shadowColor = '#14b8a6';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(0, -18, 40 * bodyScale + Math.sin(state.time * 8) * 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(20,184,166,0.1)';
      ctx.beginPath();
      ctx.arc(0, -18, 40 * bodyScale, 0, Math.PI * 2);
      ctx.fill();
    }

    if (state.combo >= 3) {
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 28;
    }

    // stacked crowd
    for (var i = stacks - 1; i >= 0; i--) {
      var ox = (i % 3 - 1) * 10 * bodyScale * (i > 0 ? 1 : 0);
      var oy = -i * 9 * bodyScale;
      var rr = (15 - i * 0.5) * bodyScale * pulse;
      var hue = i === 0 ? '#22d3ee' : 'rgba(34,211,238,' + (0.92 - i * 0.06) + ')';

      // legs hint
      if (i < 3) {
        ctx.fillStyle = shade('#0e7490', -0.1);
        ctx.fillRect(ox - 5 * bodyScale, oy + 6, 4 * bodyScale, 10 * bodyScale);
        ctx.fillRect(ox + 2 * bodyScale, oy + 6, 4 * bodyScale, 10 * bodyScale);
      }

      // body
      var bg = ctx.createRadialGradient(ox - rr * 0.3, oy - rr * 0.4 - 8, 1, ox, oy - 8, rr);
      bg.addColorStop(0, '#a5f3fc');
      bg.addColorStop(0.5, hue);
      bg.addColorStop(1, '#0891b2');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(ox, oy - 8, rr, 0, Math.PI * 2);
      ctx.fill();

      // eyes on front units
      if (i < 2) {
        ctx.fillStyle = '#0a0e27';
        ctx.beginPath();
        ctx.arc(ox - 4 * bodyScale, oy - 10, 2.2 * bodyScale, 0, Math.PI * 2);
        ctx.arc(ox + 4 * bodyScale, oy - 10, 2.2 * bodyScale, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(ox - 3.5 * bodyScale, oy - 10.5, 0.8 * bodyScale, 0, Math.PI * 2);
        ctx.arc(ox + 4.5 * bodyScale, oy - 10.5, 0.8 * bodyScale, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.shadowBlur = 0;

    // power badge under feet
    var badgeW = 64 * pulse;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    roundRect(ctx, -badgeW / 2, 16, badgeW, 26, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(34,211,238,0.7)';
    ctx.lineWidth = 2;
    roundRect(ctx, -badgeW / 2, 16, badgeW, 26, 10);
    ctx.stroke();
    ctx.fillStyle = '#67e8f9';
    ctx.font = '900 16px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(formatNum(state.power), 0, 29);

    ctx.restore();
    return { x: x, y: y };
  };

  Renderer.prototype.drawHUDOverlay = function (state) {
    var ctx = this.ctx;
    if (state.combo >= 2) {
      var scale = 1 + Math.min(0.4, state.combo * 0.04);
      if (this.comboFlash > 0) scale += this.comboFlash * 0.3;
      ctx.save();
      ctx.translate(this.w / 2, 88);
      ctx.scale(scale, scale);
      ctx.font = '900 28px system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.strokeText('COMBO ×' + state.combo, 0, 0);
      var cg = ctx.createLinearGradient(-80, 0, 80, 0);
      cg.addColorStop(0, '#fbbf24');
      cg.addColorStop(0.5, '#f97316');
      cg.addColorStop(1, '#ef4444');
      ctx.fillStyle = cg;
      ctx.fillText('COMBO ×' + state.combo, 0, 0);
      ctx.restore();
    }
    if (state.scoreMult > 1) {
      ctx.save();
      ctx.font = '900 18px system-ui,sans-serif';
      ctx.textAlign = 'right';
      ctx.fillStyle = '#f472b6';
      ctx.shadowColor = '#ec4899';
      ctx.shadowBlur = 12;
      ctx.fillText('SCORE ×' + state.scoreMult.toFixed(1), this.w - 18, 78);
      ctx.restore();
    }
    if (this.comboFlash > 0) this.comboFlash -= 0.04;
  };

  Renderer.prototype.render = function (state, particles, dt) {
    var ctx = this.ctx;
    var shakeAmt = state.shake || 0;
    var shakeX = 0, shakeY = 0;
    if (shakeAmt > 0) {
      shakeX = (Math.random() - 0.5) * 28 * shakeAmt;
      shakeY = (Math.random() - 0.5) * 28 * shakeAmt;
    }
    ctx.save();
    ctx.translate(shakeX, shakeY);

    this.drawBackground(state, dt);
    this.drawSideWalls(state);
    this.drawRoad(state);

    var list = state.entities.slice().sort(function (a, b) {
      return b.z - a.z;
    });
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e.consumed && e.kind === 'gate') continue;
      if (e.kind === 'gate') this.drawGate(state, e);
      else if (e.kind === 'enemy') this.drawEnemy(state, e);
    }

    var playerPos = this.drawPlayer(state);
    this.drawHUDOverlay(state);

    if (particles) particles.draw(ctx);

    ctx.restore();
    return playerPos;
  };

  function easeOut(t) {
    return 1 - (1 - t) * (1 - t);
  }

  function roundRect(ctx, x, y, w, h, r) {
    if (w < 0) { x += w; w = -w; }
    if (h < 0) { y += h; h = -h; }
    r = Math.min(r, w / 2, h / 2);
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
