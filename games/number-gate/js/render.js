/**
 * Canvas renderer — pseudo-perspective 3-lane Number Gate Runner.
 */
(function (global) {
  'use strict';

  var GATE_COLORS = {
    add: '#2ecc71',
    mul: '#f1c40f',
    sub: '#e74c3c',
    div: '#c0392b',
    bomb: '#e67e22',
    shield: '#1abc9c',
    scoreMul: '#e056fd',
    shieldBreak: '#1abc9c'
  };

  var ENEMY_COLORS = {
    grunt: '#ff6b6b',
    elite: '#ffa502',
    boss: '#a55eea'
  };

  function Renderer(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = 390;
    this.h = 700;
    this.dpr = 1;
    this.bgPhase = 0;
    this.speedLines = [];
    for (var i = 0; i < 24; i++) {
      this.speedLines.push({
        x: Math.random(),
        y: Math.random(),
        len: 0.02 + Math.random() * 0.06,
        sp: 0.5 + Math.random()
      });
    }
  }

  Renderer.prototype.resize = function () {
    var parent = this.canvas.parentElement;
    var pw = parent ? parent.clientWidth : window.innerWidth;
    var ph = parent ? parent.clientHeight : window.innerHeight;
    var aspect = 390 / 700;
    var tw = pw;
    var th = pw / aspect;
    if (th > ph) {
      th = ph;
      tw = ph * aspect;
    }
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.style.width = tw + 'px';
    this.canvas.style.height = th + 'px';
    this.canvas.width = Math.floor(390 * this.dpr);
    this.canvas.height = Math.floor(700 * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.w = 390;
    this.h = 700;
  };

  /** Map world depth (rel ahead) + lane → screen */
  Renderer.prototype.project = function (relZ, lane, lanes) {
    // relZ: distance ahead in world units; larger = farther (top of screen)
    var view = 700;
    var t = Math.max(0, Math.min(1, relZ / view));
    // perspective: far near top
    var nearY = this.h * 0.82;
    var farY = this.h * 0.12;
    var y = farY + (nearY - farY) * (1 - Math.pow(1 - (1 - t), 1.15));
    // actually: small relZ = close = bottom
    var depth = 1 - t; // 1 near, 0 far
    y = farY + (nearY - farY) * Math.pow(depth, 0.85);

    var scale = 0.35 + 0.65 * depth;
    var roadHalfNear = this.w * 0.42;
    var roadHalfFar = this.w * 0.12;
    var roadHalf = roadHalfFar + (roadHalfNear - roadHalfFar) * depth;
    var laneCount = lanes || 3;
    var laneW = (roadHalf * 2) / laneCount;
    var cx = this.w / 2;
    var x = cx - roadHalf + laneW * (lane + 0.5);
    return { x: x, y: y, scale: scale, roadHalf: roadHalf, depth: depth };
  };

  Renderer.prototype.laneXAt = function (lane, lanes, depth) {
    var roadHalfNear = this.w * 0.42;
    var roadHalfFar = this.w * 0.12;
    var roadHalf = roadHalfFar + (roadHalfNear - roadHalfFar) * depth;
    var laneW = (roadHalf * 2) / (lanes || 3);
    return this.w / 2 - roadHalf + laneW * (lane + 0.5);
  };

  Renderer.prototype.drawBackground = function (state, dt) {
    var ctx = this.ctx;
    var w = this.w, h = this.h;
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0a0e27');
    g.addColorStop(0.45, '#141b3d');
    g.addColorStop(1, '#1a1040');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // stars / sparkles
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (var i = 0; i < 40; i++) {
      var sx = (i * 97 + state.distance * 0.02) % w;
      var sy = (i * 53) % (h * 0.45);
      ctx.fillRect(sx, sy, 2, 2);
    }

    this.bgPhase += (state.speed || 100) * dt * 0.01;
    // speed lines
    var spd = (state.speed || 100) / 200;
    for (var j = 0; j < this.speedLines.length; j++) {
      var sl = this.speedLines[j];
      sl.y += spd * sl.sp * dt * 1.8;
      if (sl.y > 1.1) {
        sl.y = -0.1;
        sl.x = Math.random();
      }
      var x = sl.x * w;
      var y = sl.y * h;
      ctx.strokeStyle = 'rgba(120,200,255,' + (0.08 + 0.15 * spd) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + sl.len * h * (0.5 + spd));
      ctx.stroke();
    }
  };

  Renderer.prototype.drawRoad = function (state) {
    var ctx = this.ctx;
    var w = this.w, h = this.h;
    var nearY = h * 0.88;
    var farY = h * 0.12;
    var cx = w / 2;
    var nearHalf = w * 0.42;
    var farHalf = w * 0.12;

    // road polygon
    ctx.beginPath();
    ctx.moveTo(cx - farHalf, farY);
    ctx.lineTo(cx + farHalf, farY);
    ctx.lineTo(cx + nearHalf, nearY);
    ctx.lineTo(cx - nearHalf, nearY);
    ctx.closePath();
    var rg = ctx.createLinearGradient(0, farY, 0, nearY);
    rg.addColorStop(0, '#2a1f5e');
    rg.addColorStop(1, '#3d2a7a');
    ctx.fillStyle = rg;
    ctx.fill();

    // edge glow
    ctx.strokeStyle = 'rgba(0,229,255,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - farHalf, farY);
    ctx.lineTo(cx - nearHalf, nearY);
    ctx.moveTo(cx + farHalf, farY);
    ctx.lineTo(cx + nearHalf, nearY);
    ctx.stroke();

    // lane dividers + dash scroll
    var lanes = state.lanes || 3;
    var scroll = (state.distance * 0.4) % 40;
    for (var L = 1; L < lanes; L++) {
      var t = L / lanes;
      ctx.strokeStyle = 'rgba(170,100,255,0.45)';
      ctx.lineWidth = 2;
      ctx.setLineDash([16, 14]);
      ctx.lineDashOffset = -scroll;
      ctx.beginPath();
      var fx = cx - farHalf + (farHalf * 2) * t;
      var nx = cx - nearHalf + (nearHalf * 2) * t;
      ctx.moveTo(fx, farY);
      ctx.lineTo(nx, nearY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // horizon glow
    ctx.fillStyle = 'rgba(80,40,200,0.35)';
    ctx.beginPath();
    ctx.ellipse(cx, farY, farHalf * 1.2, 18, 0, 0, Math.PI * 2);
    ctx.fill();
  };

  Renderer.prototype.drawGate = function (state, e) {
    var rel = e.z - state.distance;
    if (rel < -20 || rel > 720) return;
    var p = this.project(rel, e.lane, state.lanes);
    var ctx = this.ctx;
    var bw = 56 * p.scale;
    var bh = 72 * p.scale;
    var color = GATE_COLORS[e.type] || '#fff';

    ctx.save();
    ctx.translate(p.x, p.y);
    // glow
    ctx.shadowColor = color;
    ctx.shadowBlur = 16 * p.scale;
    // door frame
    var grd = ctx.createLinearGradient(-bw / 2, -bh, bw / 2, 0);
    grd.addColorStop(0, color);
    grd.addColorStop(1, shade(color, -0.35));
    ctx.fillStyle = grd;
    roundRect(ctx, -bw / 2, -bh, bw, bh, 8 * p.scale);
    ctx.fill();
    ctx.shadowBlur = 0;

    // inner panel
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(ctx, -bw / 2 + 4 * p.scale, -bh + 4 * p.scale, bw - 8 * p.scale, bh - 8 * p.scale, 6 * p.scale);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold ' + Math.floor(18 * p.scale) + 'px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(e.label, 0, -bh / 2);
    ctx.restore();
  };

  Renderer.prototype.drawEnemy = function (state, e) {
    if (e.dead) return;
    var rel = e.z - state.distance;
    if (rel < -20 || rel > 720) return;
    var p = this.project(rel, e.lane, state.lanes);
    var ctx = this.ctx;
    var color = ENEMY_COLORS[e.enemyKind] || '#ff6b6b';
    var r = (e.enemyKind === 'boss' ? 34 : e.enemyKind === 'elite' ? 26 : 20) * p.scale;

    ctx.save();
    ctx.translate(p.x, p.y - r);
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    // body
    ctx.fillStyle = color;
    ctx.beginPath();
    if (e.enemyKind === 'boss') {
      ctx.moveTo(0, -r);
      ctx.lineTo(r, r * 0.6);
      ctx.lineTo(-r, r * 0.6);
      ctx.closePath();
    } else {
      ctx.arc(0, 0, r, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.shadowBlur = 0;

    // eyes
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(-r * 0.35, -r * 0.15, r * 0.18, 0, Math.PI * 2);
    ctx.arc(r * 0.35, -r * 0.15, r * 0.18, 0, Math.PI * 2);
    ctx.fill();

    // HP badge
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    var bw = Math.max(28, String(e.hp).length * 10) * p.scale;
    roundRect(ctx, -bw / 2, r * 0.55, bw, 18 * p.scale, 4);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold ' + Math.floor(13 * p.scale) + 'px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(e.hp), 0, r * 0.55 + 9 * p.scale);

    if (e.label && e.enemyKind === 'boss') {
      ctx.fillStyle = '#ffeaa7';
      ctx.font = 'bold ' + Math.floor(11 * p.scale) + 'px system-ui,sans-serif';
      ctx.fillText(e.label, 0, -r - 12 * p.scale);
    }
    ctx.restore();
  };

  Renderer.prototype.drawPlayer = function (state) {
    var ctx = this.ctx;
    var depth = 0.92;
    var lanePos = NGCore.lerp(state.lane, state.targetLane, easeOut(state.laneT));
    var x = this.laneXAt(lanePos, state.lanes, depth);
    var y = this.h * 0.78;
    var bob = Math.sin(state.time * 12) * 3;
    var scale = 1;

    ctx.save();
    ctx.translate(x, y + bob);

    // shield aura
    if (state.shield) {
      ctx.strokeStyle = 'rgba(26,188,156,0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, -20, 36 + Math.sin(state.time * 8) * 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // combo glow
    if (state.combo >= 3) {
      ctx.shadowColor = '#f1c40f';
      ctx.shadowBlur = 20;
    }

    // body — stacked crowd metaphor (power → stack height hint)
    var stacks = Math.min(8, 1 + Math.floor(Math.log2(Math.max(1, state.power))));
    for (var i = 0; i < stacks; i++) {
      var yy = -i * 7;
      var rr = 16 - i * 0.6;
      ctx.fillStyle = i === 0 ? '#00e5ff' : 'rgba(0,200,255,' + (0.9 - i * 0.08) + ')';
      ctx.beginPath();
      ctx.arc(0, yy - 8, rr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // face on top
    ctx.fillStyle = '#0a0e27';
    ctx.beginPath();
    ctx.arc(-5, -8 - (stacks - 1) * 7, 2.5, 0, Math.PI * 2);
    ctx.arc(5, -8 - (stacks - 1) * 7, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // power badge
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundRect(ctx, -28, 14, 56, 22, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(formatNum(state.power), 0, 25);

    ctx.restore();
    return { x: x, y: y };
  };

  Renderer.prototype.drawHUDOverlay = function (state) {
    // canvas-side minimal; main HUD is DOM
    var ctx = this.ctx;
    if (state.combo >= 2) {
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#f1c40f';
      ctx.font = 'bold 20px system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('COMBO ×' + state.combo, this.w / 2, 100);
      ctx.restore();
    }
    if (state.scoreMult > 1) {
      ctx.fillStyle = '#e056fd';
      ctx.font = 'bold 14px system-ui,sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('SCORE ×' + state.scoreMult.toFixed(1), this.w - 16, 90);
    }
  };

  Renderer.prototype.render = function (state, particles, dt) {
    var ctx = this.ctx;
    var shakeX = 0, shakeY = 0;
    if (state.shake > 0) {
      shakeX = (Math.random() - 0.5) * 16 * state.shake;
      shakeY = (Math.random() - 0.5) * 16 * state.shake;
    }
    ctx.save();
    ctx.translate(shakeX, shakeY);

    this.drawBackground(state, dt);
    this.drawRoad(state);

    // sort entities far→near
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
