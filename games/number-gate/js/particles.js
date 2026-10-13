/**
 * Particle + floating text + fly-to-player FX for Number Gate Runner.
 */
(function (global) {
  'use strict';

  function ParticleSystem() {
    this.particles = [];
    this.floats = [];
    this.corpses = [];
    this.flies = [];
  }

  ParticleSystem.prototype.emit = function (x, y, count, color, opts) {
    opts = opts || {};
    var speed = opts.speed || 280;
    var life = opts.life || 0.6;
    var size = opts.size || 5;
    var gravity = opts.gravity != null ? opts.gravity : 480;
    for (var i = 0; i < count; i++) {
      var ang = opts.angle != null ? opts.angle + (Math.random() - 0.5) * (opts.spread || Math.PI) : Math.random() * Math.PI * 2;
      var sp = speed * (0.35 + Math.random() * 0.9);
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - (opts.up || 100),
        life: life * (0.55 + Math.random() * 0.55),
        maxLife: life,
        r: size * (0.4 + Math.random() * 1.1),
        color: color,
        gravity: gravity,
        drag: opts.drag || 0.975,
        glow: opts.glow !== false
      });
    }
  };

  ParticleSystem.prototype.burst = function (x, y, color) {
    this.emit(x, y, 36, color, { speed: 380, up: 180, life: 0.75, size: 6 });
    this.emit(x, y, 16, '#fff7ed', { speed: 220, up: 220, life: 0.45, size: 3 });
    this.emit(x, y, 10, '#fde68a', { speed: 160, up: 80, life: 0.9, size: 8, gravity: 200 });
  };

  ParticleSystem.prototype.floatText = function (x, y, text, color, opts) {
    opts = opts || {};
    this.floats.push({
      x: x,
      y: y,
      text: text,
      color: color || '#fff',
      life: opts.life || 1.0,
      maxLife: opts.life || 1.0,
      vy: opts.vy || -90,
      size: opts.size || 28,
      pop: 1.4
    });
  };

  /** Number pops big then flies toward player */
  ParticleSystem.prototype.flyTo = function (x, y, tx, ty, text, color) {
    this.flies.push({
      x: x, y: y,
      sx: x, sy: y,
      tx: tx, ty: ty,
      text: text,
      color: color || '#fff',
      t: 0,
      dur: 0.55,
      scale: 1.8
    });
  };

  ParticleSystem.prototype.addCorpse = function (x, y, color, hp, kind) {
    this.corpses.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 420,
      vy: -360 - Math.random() * 180,
      rot: 0,
      vr: (Math.random() - 0.5) * 14,
      life: 1.1,
      color: color,
      hp: hp,
      r: 16 + Math.min(24, hp / 18),
      kind: kind || 'grunt'
    });
  };

  ParticleSystem.prototype.update = function (dt) {
    var i, p;
    for (i = this.particles.length - 1; i >= 0; i--) {
      p = this.particles[i];
      p.life -= dt;
      p.vy += p.gravity * dt;
      p.vx *= p.drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (i = this.floats.length - 1; i >= 0; i--) {
      p = this.floats[i];
      p.life -= dt;
      p.y += p.vy * dt;
      p.pop += (1 - p.pop) * Math.min(1, dt * 12);
      if (p.life <= 0) this.floats.splice(i, 1);
    }
    for (i = this.corpses.length - 1; i >= 0; i--) {
      p = this.corpses[i];
      p.life -= dt;
      p.vy += 780 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.life <= 0) this.corpses.splice(i, 1);
    }
    for (i = this.flies.length - 1; i >= 0; i--) {
      p = this.flies[i];
      p.t += dt;
      var u = Math.min(1, p.t / p.dur);
      // ease in-out + arc
      var e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      p.x = p.sx + (p.tx - p.sx) * e;
      p.y = p.sy + (p.ty - p.sy) * e - Math.sin(u * Math.PI) * 60;
      p.scale = 1.8 - u * 0.9;
      if (u >= 1) this.flies.splice(i, 1);
    }
  };

  ParticleSystem.prototype.clear = function () {
    this.particles.length = 0;
    this.floats.length = 0;
    this.corpses.length = 0;
    this.flies.length = 0;
  };

  ParticleSystem.prototype.draw = function (ctx) {
    var i, p, a;
    for (i = 0; i < this.particles.length; i++) {
      p = this.particles[i];
      a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      if (p.glow) {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
      }
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (0.5 + 0.5 * a), 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    for (i = 0; i < this.corpses.length; i++) {
      p = this.corpses[i];
      a = Math.max(0, p.life / 1.1);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = p.color;
      if (p.kind === 'boss') {
        ctx.beginPath();
        ctx.moveTo(0, -p.r);
        ctx.lineTo(p.r, p.r * 0.6);
        ctx.lineTo(-p.r, p.r * 0.6);
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
        ctx.arc(0, 0, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(p.hp), 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    for (i = 0; i < this.floats.length; i++) {
      p = this.floats[i];
      a = Math.max(0, p.life / p.maxLife);
      var sz = Math.floor(p.size * p.pop * (0.85 + 0.3 * a));
      ctx.globalAlpha = a;
      ctx.font = '900 ' + sz + 'px system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.fillText(p.text, p.x, p.y);
      ctx.shadowBlur = 0;
    }
    for (i = 0; i < this.flies.length; i++) {
      p = this.flies[i];
      var fs = Math.floor(32 * p.scale);
      ctx.globalAlpha = 0.95;
      ctx.font = '900 ' + fs + 'px system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 14;
      ctx.fillText(p.text, p.x, p.y);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  };

  global.NGParticles = ParticleSystem;
})(typeof window !== 'undefined' ? window : global);
