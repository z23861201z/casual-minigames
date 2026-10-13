/**
 * Particle, shockwave, floating text and fly-to-player FX.
 */
(function (global) {
  'use strict';

  function loadImage(src) {
    var img = new Image();
    img.decoding = 'async';
    img.src = src;
    return img;
  }

  function imageReady(img) {
    return !!(img && img.complete && img.naturalWidth > 0);
  }

  function ParticleSystem() {
    this.particles = [];
    this.floats = [];
    this.corpses = [];
    this.flies = [];
    this.rings = [];
    this._tint = {};
    var root = '../../assets/';
    this.sprites = {
      glow: loadImage(root + 'fx/glow.png'),
      star: loadImage(root + 'fx/star.png'),
      spark: loadImage(root + 'fx/spark.png'),
      ring: loadImage(root + 'fx/ring.png'),
      shard: loadImage(root + 'fx/shard.png'),
      grunt: loadImage(root + 'number-gate/monsters/grunt.png'),
      elite: loadImage(root + 'number-gate/monsters/elite.png'),
      boss: loadImage(root + 'number-gate/monsters/boss.png')
    };
  }

  ParticleSystem.prototype._tinted = function (img, color) {
    if (!imageReady(img)) return null;
    var key = img.src + '|' + color;
    if (this._tint[key]) return this._tint[key];
    var c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    var g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = color || '#fff';
    g.fillRect(0, 0, c.width, c.height);
    this._tint[key] = c;
    return c;
  };

  ParticleSystem.prototype._trim = function () {
    if (this.particles.length > 280) this.particles.splice(0, this.particles.length - 240);
  };

  ParticleSystem.prototype.emit = function (x, y, count, color, opts) {
    opts = opts || {};
    var speed = opts.speed || 280;
    var life = opts.life || 0.55;
    var size = opts.size || 5;
    var gravity = opts.gravity != null ? opts.gravity : 520;
    for (var i = 0; i < count; i++) {
      var ang = opts.angle != null
        ? opts.angle + (Math.random() - 0.5) * (opts.spread || Math.PI)
        : Math.random() * Math.PI * 2;
      var sp = speed * (0.4 + Math.random() * 0.85);
      var streak = opts.streak != null ? !!opts.streak : Math.random() < 0.42;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - (opts.up || 80),
        life: life * (0.6 + Math.random() * 0.5),
        maxLife: life,
        r: size * (0.45 + Math.random() * 1.05),
        color: color,
        shape: opts.shape || (Math.random() < 0.22 ? 'star' : (Math.random() < 0.35 ? 'shard' : 'glow')),
        gravity: gravity,
        drag: opts.drag || 0.98,
        streak: streak,
        sq: !streak && Math.random() < 0.22,
        rot: Math.random() * 6
      });
    }
    this._trim();
  };

  ParticleSystem.prototype.burst = function (x, y, color) {
    this.emit(x, y, 34, color, { speed: 460, up: 160, life: 0.7, size: 5 });
    this.emit(x, y, 14, '#fff7ed', { speed: 280, up: 200, life: 0.4, size: 3, streak: true });
    this.emit(x, y, 8, '#fde68a', { speed: 180, up: 60, life: 0.85, size: 7, gravity: 220, streak: false });
    this.ring(x, y, color, 120);
    this.ring(x, y, '#ffffff', 70);
  };

  ParticleSystem.prototype.ring = function (x, y, color, maxR) {
    this.rings.push({
      x: x,
      y: y,
      r: 8,
      maxR: maxR || 140,
      life: 0.38,
      max: 0.38,
      color: color || '#fff',
      w: 6
    });
    if (this.rings.length > 8) this.rings.shift();
  };

  ParticleSystem.prototype.floatText = function (x, y, text, color, opts) {
    opts = opts || {};
    this.floats.push({
      x: x,
      y: y,
      text: text,
      color: color || '#fff',
      life: opts.life || 0.95,
      maxLife: opts.life || 0.95,
      vy: opts.vy || -110,
      size: opts.size || 32,
      pop: 1.65
    });
    if (this.floats.length > 14) this.floats.shift();
  };

  ParticleSystem.prototype.flyTo = function (x, y, tx, ty, text, color) {
    this.flies.push({
      x: x, y: y,
      sx: x, sy: y,
      tx: tx, ty: ty,
      text: text,
      color: color || '#fff',
      t: 0,
      dur: 0.48,
      scale: 2.15
    });
    if (this.flies.length > 6) this.flies.shift();
  };

  ParticleSystem.prototype.addCorpse = function (x, y, color, hp, kind) {
    this.corpses.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 520,
      vy: -420 - Math.random() * 220,
      rot: (Math.random() - 0.5) * 0.6,
      vr: (Math.random() - 0.5) * 16,
      life: 0.95,
      color: color,
      hp: hp,
      r: 18 + Math.min(22, (hp || 10) / 16),
      kind: kind || 'grunt'
    });
    if (this.corpses.length > 8) this.corpses.shift();
    this.emit(x, y, 16, color, { speed: 380, up: 180, size: 4, life: 0.45 });
  };

  ParticleSystem.prototype.update = function (dt) {
    var i, p, u;
    for (i = this.particles.length - 1; i >= 0; i--) {
      p = this.particles[i];
      p.life -= dt;
      p.vy += p.gravity * dt;
      p.vx *= p.drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += dt * 6;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (i = this.floats.length - 1; i >= 0; i--) {
      p = this.floats[i];
      p.life -= dt;
      p.y += p.vy * dt;
      p.vy *= 0.985;
      p.pop += (1 - p.pop) * Math.min(1, dt * 14);
      if (p.life <= 0) this.floats.splice(i, 1);
    }
    for (i = this.corpses.length - 1; i >= 0; i--) {
      p = this.corpses[i];
      p.life -= dt;
      p.vy += 920 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.99;
      p.rot += p.vr * dt;
      if (p.life <= 0) this.corpses.splice(i, 1);
    }
    for (i = this.flies.length - 1; i >= 0; i--) {
      p = this.flies[i];
      p.t += dt;
      u = Math.min(1, p.t / p.dur);
      var e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      p.x = p.sx + (p.tx - p.sx) * e;
      p.y = p.sy + (p.ty - p.sy) * e - Math.sin(u * Math.PI) * 70;
      p.scale = 2.15 - u * 1.15;
      if (u >= 1) this.flies.splice(i, 1);
    }
    for (i = this.rings.length - 1; i >= 0; i--) {
      p = this.rings[i];
      p.life -= dt;
      u = 1 - Math.max(0, p.life / p.max);
      p.r = 8 + (p.maxR - 8) * (1 - Math.pow(1 - u, 2));
      if (p.life <= 0) this.rings.splice(i, 1);
    }
  };

  ParticleSystem.prototype.clear = function () {
    this.particles.length = 0;
    this.floats.length = 0;
    this.corpses.length = 0;
    this.flies.length = 0;
    this.rings.length = 0;
  };

  ParticleSystem.prototype.draw = function (ctx) {
    var i, p, a;
    for (i = 0; i < this.rings.length; i++) {
      p = this.rings[i];
      a = Math.max(0, p.life / p.max);
      var ring = this._tinted(this.sprites.ring, p.color);
      ctx.globalAlpha = a;
      if (ring) {
        ctx.drawImage(ring, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      } else {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1.5, p.w * a);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    for (i = 0; i < this.particles.length; i++) {
      p = this.particles[i];
      a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;
      if (p.streak) {
        ctx.lineWidth = Math.max(1.5, p.r * 0.7);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.045, p.y - p.vy * 0.045);
        ctx.stroke();
      } else if (p.sq) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.r, -p.r, p.r * 2, p.r * 2);
        ctx.restore();
      } else {
        var puff = this._tinted(this.sprites[p.shape] || this.sprites.glow, p.color);
        if (puff) {
          var d = p.r * (p.shape === 'glow' ? 4.4 : 3.2);
          ctx.drawImage(puff, p.x - d / 2, p.y - d / 2, d, d);
        } else {
          ctx.globalAlpha = a * 0.35;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 2.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = a;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * (0.55 + 0.45 * a), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    for (i = 0; i < this.corpses.length; i++) {
      p = this.corpses[i];
      a = Math.max(0, p.life / 0.95);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      var body = this.sprites[p.kind] || this.sprites.grunt;
      if (imageReady(body)) {
        var bd = p.r * 3.3;
        ctx.drawImage(body, -bd / 2, -bd / 2, bd, bd);
      } else {
      ctx.fillStyle = p.color;
      if (p.kind === 'boss') {
        ctx.beginPath();
        ctx.moveTo(0, -p.r);
        ctx.lineTo(p.r, p.r * 0.7);
        ctx.lineTo(-p.r, p.r * 0.7);
        ctx.closePath();
        ctx.fill();
      } else if (p.kind === 'elite') {
        ctx.beginPath();
        ctx.moveTo(0, -p.r);
        ctx.lineTo(p.r, 0);
        ctx.lineTo(0, p.r);
        ctx.lineTo(-p.r, 0);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.r * 0.85, 0, Math.PI * 2);
        ctx.fill();
      }
      }
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '900 12px system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(p.hp), 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    for (i = 0; i < this.floats.length; i++) {
      p = this.floats[i];
      a = Math.max(0, p.life / p.maxLife);
      var sz = Math.floor(p.size * (p.pop || 1));
      ctx.globalAlpha = Math.min(1, a * 1.2);
      ctx.font = '900 ' + sz + 'px system-ui,Segoe UI,sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = Math.max(4, sz * 0.12);
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    for (i = 0; i < this.flies.length; i++) {
      p = this.flies[i];
      var fs = Math.floor(36 * p.scale);
      ctx.globalAlpha = 1;
      ctx.font = '900 ' + fs + 'px system-ui,Segoe UI,sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = '#fff';
      ctx.fillText(p.text, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 0.9;
      ctx.fillText(p.text, p.x, p.y - 1);
    }
    ctx.globalAlpha = 1;
  };

  global.NGParticles = ParticleSystem;
})(typeof window !== 'undefined' ? window : global);
