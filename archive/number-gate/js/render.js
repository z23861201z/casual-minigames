/**
 * Number Gate — strong-perspective corridor renderer (weapon × zombie).
 * Global: NGRender
 */
(function (global) {
  'use strict';

  var ASSET_BASE = '../../assets/';

  var GATE_COLORS = {
    add: '#f1c40f',
    mul: '#5dade2',
    sub: '#e74c3c',
    pickup: '#f39c12'
  };

  function Renderer(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = 390;
    this.h = 700;
    this.dpr = 1;
    this.images = {};
    this.ready = false;
    this.powerPulse = 0;
    this.roadScroll = 0;
    this._loadImages();
    this.resize();
  }

  Renderer.prototype._loadImages = function () {
    var self = this;
    var list = {
      runner0: ASSET_BASE + 'number-gate/characters/runner-0.png',
      runner1: ASSET_BASE + 'number-gate/characters/runner-1.png',
      grunt: ASSET_BASE + 'number-gate/monsters/grunt.png',
      elite: ASSET_BASE + 'number-gate/monsters/elite.png',
      boss: ASSET_BASE + 'number-gate/monsters/boss.png',
      doorAdd: ASSET_BASE + 'number-gate/doors/add.png',
      doorMul: ASSET_BASE + 'number-gate/doors/mul.png',
      doorSub: ASSET_BASE + 'number-gate/doors/sub.png',
      glow: ASSET_BASE + 'fx/glow.png',
      spark: ASSET_BASE + 'fx/spark.png',
      ring: ASSET_BASE + 'fx/ring.png',
      shard: ASSET_BASE + 'fx/shard.png'
    };
    var keys = Object.keys(list);
    var left = keys.length;
    keys.forEach(function (k) {
      var img = new Image();
      img.onload = img.onerror = function () {
        left--;
        if (left <= 0) self.ready = true;
      };
      img.src = list[k];
      self.images[k] = img;
    });
  };

  Renderer.prototype.resize = function () {
    var parent = this.canvas.parentElement || document.body;
    var pw = parent.clientWidth || window.innerWidth;
    var ph = parent.clientHeight || window.innerHeight;
    var aspect = 390 / 700;
    var w = pw;
    var h = w / aspect;
    if (h > ph) {
      h = ph;
      w = h * aspect;
    }
    w = Math.floor(Math.max(280, w));
    h = Math.floor(w / aspect);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = w;
    this.h = h;
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  };

  Renderer.prototype.pulsePower = function () {
    this.powerPulse = 1;
  };

  /** Project world (lane, relZ) → screen. relZ = worldZ - playerDistance */
  Renderer.prototype.project = function (lane, relZ, lanes) {
    var w = this.w;
    var h = this.h;
    var horizonY = h * 0.22;
    var nearY = h * 0.92;
    var maxZ = 600;
    var t = 1 - NGCore.clamp(relZ / maxZ, 0, 1);
    // Strong perspective curve
    var ease = t * t;
    var y = horizonY + (nearY - horizonY) * ease;
    var roadHalfNear = w * 0.42;
    var roadHalfFar = w * 0.06;
    var roadHalf = roadHalfFar + (roadHalfNear - roadHalfFar) * ease;
    var cx = w * 0.5;
    var laneN = (lanes || 3) - 1;
    var laneX = laneN === 0 ? 0 : (lane / laneN) * 2 - 1; // -1..1
    var x = cx + laneX * roadHalf * 0.85;
    var scale = 0.12 + ease * 0.95;
    return { x: x, y: y, scale: scale, roadHalf: roadHalf, t: ease };
  };

  Renderer.prototype.drawBackground = function (state) {
    var ctx = this.ctx;
    var w = this.w;
    var h = this.h;

    // Sky / haze
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#1a1040');
    g.addColorStop(0.35, '#0d1830');
    g.addColorStop(1, '#050816');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Distant city silhouettes
    ctx.save();
    ctx.globalAlpha = 0.35;
    var horizon = h * 0.22;
    for (var side = -1; side <= 1; side += 2) {
      for (var i = 0; i < 8; i++) {
        var bx = w * 0.5 + side * (40 + i * 28 + (i % 3) * 10);
        var bh = 30 + ((i * 37) % 80);
        ctx.fillStyle = i % 2 ? '#1e293b' : '#312e81';
        ctx.fillRect(bx, horizon - bh, 18 + (i % 4) * 4, bh);
        // neon windows
        ctx.fillStyle = 'rgba(34,211,238,0.35)';
        for (var wy = 4; wy < bh - 4; wy += 8) {
          ctx.fillRect(bx + 3, horizon - bh + wy, 3, 3);
          ctx.fillRect(bx + 10, horizon - bh + wy, 3, 3);
        }
      }
    }
    ctx.restore();

    // Fog band
    var fog = ctx.createLinearGradient(0, horizon - 20, 0, horizon + 60);
    fog.addColorStop(0, 'rgba(15,10,40,0)');
    fog.addColorStop(0.5, 'rgba(80,60,120,0.25)');
    fog.addColorStop(1, 'rgba(5,8,22,0)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, horizon - 20, w, 100);
  };

  Renderer.prototype.drawRoad = function (state) {
    var ctx = this.ctx;
    var w = this.w;
    var h = this.h;
    var horizon = h * 0.22;
    var near = h * 0.98;
    var cx = w * 0.5;

    this.roadScroll = (this.roadScroll + state.speed * 0.02) % 40;

    // Road trapezoid
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.06, horizon);
    ctx.lineTo(cx + w * 0.06, horizon);
    ctx.lineTo(cx + w * 0.48, near);
    ctx.lineTo(cx - w * 0.48, near);
    ctx.closePath();
    var rg = ctx.createLinearGradient(0, horizon, 0, near);
    rg.addColorStop(0, '#3d4458');
    rg.addColorStop(0.5, '#2a2f42');
    rg.addColorStop(1, '#1a1e2e');
    ctx.fillStyle = rg;
    ctx.fill();

    // Edge neon
    ctx.strokeStyle = 'rgba(34,211,238,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.06, horizon);
    ctx.lineTo(cx - w * 0.48, near);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(168,85,247,0.5)';
    ctx.beginPath();
    ctx.moveTo(cx + w * 0.06, horizon);
    ctx.lineTo(cx + w * 0.48, near);
    ctx.stroke();

    // Lane dividers
    var lanes = state.lanes || 3;
    for (var L = 1; L < lanes; L++) {
      var lanePos = L / lanes; // not quite — use project
      ctx.save();
      ctx.setLineDash([12, 16]);
      ctx.lineDashOffset = -this.roadScroll * 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 2;
      var p0 = this.project(L - 0.5, 580, lanes);
      var p1 = this.project(L - 0.5, 0, lanes);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
      ctx.restore();
    }

    // Speed lines
    ctx.save();
    ctx.globalAlpha = 0.15 + state.speed / 2000;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    for (var s = 0; s < 10; s++) {
      var sx = (s / 10) * w;
      var sy = horizon + 40 + ((s * 47 + this.roadScroll * 3) % (h - horizon));
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx, sy + 18 + state.speed * 0.04);
      ctx.stroke();
    }
    ctx.restore();
  };

  Renderer.prototype.drawGate = function (gate, state) {
    if (gate.hit) return;
    var rel = gate.z - state.distance;
    if (rel < -10 || rel > 580) return;
    var p = this.project(gate.lane, rel, state.lanes);
    var ctx = this.ctx;
    var col = GATE_COLORS[gate.type] || '#fff';
    var gw = 70 * p.scale;
    var gh = 100 * p.scale;

    ctx.save();
    ctx.translate(p.x, p.y);

    // Glow plate
    ctx.globalAlpha = 0.35;
    var imgKey = gate.type === 'mul' ? 'doorMul' : gate.type === 'sub' ? 'doorSub' : 'doorAdd';
    var door = this.images[imgKey];
    if (door && door.complete && door.naturalWidth) {
      ctx.globalAlpha = 0.9;
      ctx.drawImage(door, -gw / 2, -gh, gw, gh);
    } else {
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.45;
      ctx.fillRect(-gw / 2, -gh, gw, gh);
      ctx.strokeStyle = col;
      ctx.globalAlpha = 1;
      ctx.lineWidth = 3 * p.scale;
      ctx.strokeRect(-gw / 2, -gh, gw, gh);
    }

    // Number label
    ctx.globalAlpha = 1;
    var label = NGCore.gateLabel(gate.type, gate.n);
    ctx.font = 'bold ' + Math.max(14, 36 * p.scale) + 'px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(3, 5 * p.scale);
    ctx.strokeStyle = '#000';
    ctx.fillStyle = '#fff';
    ctx.strokeText(label, 0, -gh * 0.55);
    ctx.fillText(label, 0, -gh * 0.55);

    // Color tint bar
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.7;
    ctx.fillRect(-gw / 2, -4 * p.scale, gw, 6 * p.scale);

    ctx.restore();
  };

  Renderer.prototype.drawPickup = function (pk, state) {
    if (pk.hit) return;
    var rel = pk.z - state.distance;
    if (rel < -10 || rel > 580) return;
    var p = this.project(pk.lane, rel, state.lanes);
    var ctx = this.ctx;
    var s = 50 * p.scale;

    ctx.save();
    ctx.translate(p.x, p.y);

    // Platform
    ctx.fillStyle = 'rgba(40,40,60,0.85)';
    ctx.fillRect(-s * 0.7, -4, s * 1.4, 10 * p.scale);
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 2;
    ctx.strokeRect(-s * 0.7, -4, s * 1.4, 10 * p.scale);

    // Weapon icon (procedural)
    ctx.translate(0, -s * 0.7);
    if (pk.kind === 'chainsaw') {
      ctx.fillStyle = '#f39c12';
      ctx.fillRect(-s * 0.35, -s * 0.15, s * 0.7, s * 0.25);
      ctx.fillStyle = '#bbb';
      ctx.beginPath();
      ctx.ellipse(s * 0.4, 0, s * 0.35, s * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath();
      ctx.moveTo(-s * 0.1, -s * 0.35);
      ctx.lineTo(s * 0.45, 0);
      ctx.lineTo(-s * 0.1, s * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#e67e22';
      ctx.fillRect(-s * 0.4, -s * 0.12, s * 0.35, s * 0.24);
    }

    ctx.font = 'bold ' + Math.max(12, 22 * p.scale) + 'px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.fillStyle = '#5dade2';
    var t = '+' + pk.n;
    ctx.strokeText(t, 0, -s * 0.55);
    ctx.fillText(t, 0, -s * 0.55);

    ctx.restore();
  };

  Renderer.prototype.drawZombie = function (z, state) {
    var rel = z.z - state.distance;
    if (rel < -20 || rel > 600) return;
    var lane = z.lane + (z.laneOffset || 0);
    var p = this.project(lane, Math.max(0, rel), state.lanes);
    var ctx = this.ctx;
    var base = 90 * p.scale * (z.scale || 1);
    // Make near zombies LARGE and obvious
    if (rel < 80) base *= 1.15;

    ctx.save();
    ctx.translate(p.x, p.y);

    if (!z.alive) {
      ctx.globalAlpha = 0.35;
      ctx.translate(20 * p.scale, -10);
      ctx.rotate(0.6);
    }

    var img =
      z.kind === 'boss'
        ? this.images.boss
        : z.kind === 'elite'
          ? this.images.elite
          : this.images.grunt;

    if (img && img.complete && img.naturalWidth) {
      ctx.drawImage(img, -base / 2, -base, base, base);
    } else {
      // Procedural fallback — big visible silhouette
      ctx.fillStyle = z.alive ? '#2d5a27' : '#444';
      ctx.beginPath();
      ctx.ellipse(0, -base * 0.25, base * 0.35, base * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a3d18';
      ctx.beginPath();
      ctx.arc(0, -base * 0.75, base * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(-base * 0.08, -base * 0.78, base * 0.05, 0, Math.PI * 2);
      ctx.arc(base * 0.08, -base * 0.78, base * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }

    // HP bar when damaged / near
    if (z.alive && (z.hp < z.maxHp || rel < 200)) {
      var bw = base * 0.7;
      var ratio = NGCore.clamp(z.hp / z.maxHp, 0, 1);
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(-bw / 2, -base - 10 * p.scale, bw, 6 * p.scale);
      ctx.fillStyle = ratio > 0.4 ? '#22c55e' : '#ef4444';
      ctx.fillRect(-bw / 2, -base - 10 * p.scale, bw * ratio, 6 * p.scale);
    }

    ctx.restore();
  };

  Renderer.prototype.drawBullet = function (b, state) {
    if (!b.alive) return;
    var rel = b.z; // bullets store relative-ish z from fire; we stored world-ish from playerHitZ
    // b.z is distance-from-start style along track from fire point; convert:
    // In core, bullet.z starts at playerHitZ+2 and increases — it's relative to player frame moving with distance.
    // Actually core increases b.z absolutely while player distance also increases — bullet.z is "world offset from player origin at fire".
    // Looking at core: b.z starts at playerHitZ+2 (~10) and increases by bulletSpeed. Player distance increases separately.
    // Hit test: abs(b.z - (z.z - state.distance)) — so b.z is relative Z ahead of player.
    var p = this.project(b.lane, b.z, state.lanes);
    var ctx = this.ctx;
    var s = Math.max(3, 8 * p.scale);

    ctx.save();
    ctx.translate(p.x, p.y - 40 * p.scale);
    ctx.fillStyle = '#fde047';
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.45, s * 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.3, s * 0.2, s * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  Renderer.prototype.drawPlayer = function (state) {
    var p = this.project(state.laneVisual, 4, state.lanes);
    var ctx = this.ctx;
    var frame = Math.floor(state.time / 120) % 2;
    var img = frame ? this.images.runner1 : this.images.runner0;
    var s = 88 * p.scale * (1 + this.powerPulse * 0.08);

    ctx.save();
    ctx.translate(p.x, p.y);

    // Muzzle flash
    if (state.fireCd > weaponFireFlash(state)) {
      ctx.fillStyle = '#fde047';
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(0, -s * 0.55, 10 + Math.random() * 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (img && img.complete && img.naturalWidth) {
      ctx.drawImage(img, -s / 2, -s, s, s);
    } else {
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(-s * 0.25, -s * 0.7, s * 0.5, s * 0.7);
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.arc(0, -s * 0.85, s * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Weapon barrel hint
    var ws = NGCore.weaponStats(state.weaponLevel);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(-3, -s * 0.55, 6 + ws.pellets, -18 - ws.level * 0.15);

    ctx.restore();

    if (this.powerPulse > 0) this.powerPulse = Math.max(0, this.powerPulse - 0.05);

    return { x: p.x, y: p.y - s * 0.5 };
  };

  function weaponFireFlash(state) {
    var ws = NGCore.weaponStats(state.weaponLevel);
    return ws.fireInterval * 0.85;
  }

  Renderer.prototype.drawSideHordeHint = function (state) {
    // Extra ambient zombies on the sides for "大量可见" feel
    var ctx = this.ctx;
    var t = state.time * 0.001;
    for (var i = 0; i < 12; i++) {
      var side = i % 2 === 0 ? -1.6 : state.lanes - 1 + 1.6;
      var rel = 80 + ((i * 97 + state.distance * 0.3) % 450);
      var p = this.project(side, rel, state.lanes);
      if (p.scale < 0.15) continue;
      var s = 55 * p.scale;
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.translate(p.x, p.y);
      var img = this.images.grunt;
      if (img && img.complete && img.naturalWidth) {
        ctx.drawImage(img, -s / 2, -s, s, s);
      } else {
        ctx.fillStyle = '#1f3d1a';
        ctx.fillRect(-s * 0.3, -s, s * 0.6, s);
      }
      ctx.restore();
    }
  };

  Renderer.prototype.render = function (state, particles) {
    if (!state) return null;
    var ctx = this.ctx;
    var w = this.w;
    var h = this.h;

    var shakeX = 0;
    var shakeY = 0;
    if (state.shake > 0) {
      shakeX = (Math.random() - 0.5) * state.shake * 14;
      shakeY = (Math.random() - 0.5) * state.shake * 10;
    }

    ctx.save();
    ctx.translate(shakeX, shakeY);

    this.drawBackground(state);
    this.drawRoad(state);
    this.drawSideHordeHint(state);

    // Depth-sort drawables
    var items = [];
    var i;
    for (i = 0; i < state.gates.length; i++) {
      items.push({ z: state.gates[i].z, kind: 'gate', ref: state.gates[i] });
    }
    for (i = 0; i < state.pickups.length; i++) {
      items.push({ z: state.pickups[i].z, kind: 'pickup', ref: state.pickups[i] });
    }
    for (i = 0; i < state.zombies.length; i++) {
      items.push({ z: state.zombies[i].z, kind: 'zombie', ref: state.zombies[i] });
    }
    for (i = 0; i < state.bullets.length; i++) {
      items.push({ z: state.distance + state.bullets[i].z, kind: 'bullet', ref: state.bullets[i] });
    }
    items.sort(function (a, b) {
      return b.z - a.z;
    });

    for (i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.kind === 'gate') this.drawGate(it.ref, state);
      else if (it.kind === 'pickup') this.drawPickup(it.ref, state);
      else if (it.kind === 'zombie') this.drawZombie(it.ref, state);
      else if (it.kind === 'bullet') this.drawBullet(it.ref, state);
    }

    var playerPos = this.drawPlayer(state);

    if (particles && particles.draw) particles.draw(ctx);

    // Flash
    if (state.flash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + state.flash * 0.35 + ')';
      ctx.fillRect(0, 0, w, h);
    }

    ctx.restore();
    return playerPos;
  };

  var NGRender = {
    Renderer: Renderer,
    GATE_COLORS: GATE_COLORS
  };

  global.NGRender = NGRender;
})(typeof window !== 'undefined' ? window : global);
