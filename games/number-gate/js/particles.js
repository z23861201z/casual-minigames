/**
 * Particle + floating text system for Number Gate Runner.
 */
(function (global) {
  'use strict';

  function ParticleSystem() {
    this.particles = [];
    this.floats = [];
    this.corpses = [];
  }

  ParticleSystem.prototype.emit = function (x, y, count, color, opts) {
    opts = opts || {};
    var speed = opts.speed || 220;
    var life = opts.life || 0.55;
    var size = opts.size || 4;
    var gravity = opts.gravity != null ? opts.gravity : 420;
    for (var i = 0; i < count; i++) {
      var ang = opts.angle != null ? opts.angle + (Math.random() - 0.5) * (opts.spread || Math.PI) : Math.random() * Math.PI * 2;
      var sp = speed * (0.4 + Math.random() * 0.8);
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - (opts.up || 80),
        life: life * (0.6 + Math.random() * 0.5),
        maxLife: life,
        r: size * (0.5 + Math.random()),
        color: color,
        gravity: gravity,
        drag: opts.drag || 0.98
      });
    }
  };

  ParticleSystem.prototype.floatText = function (x, y, text, color) {
    this.floats.push({
      x: x,
      y: y,
      text: text,
      color: color || '#fff',
      life: 0.85,
      maxLife: 0.85,
      vy: -70
    });
  };

  ParticleSystem.prototype.addCorpse = function (x, y, color, hp) {
    this.corpses.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 260,
      vy: -280 - Math.random() * 120,
      rot: 0,
      vr: (Math.random() - 0.5) * 10,
      life: 0.9,
      color: color,
      hp: hp,
      r: 14 + Math.min(20, hp / 20)
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
      if (p.life <= 0) this.floats.splice(i, 1);
    }
    for (i = this.corpses.length - 1; i >= 0; i--) {
      p = this.corpses[i];
      p.life -= dt;
      p.vy += 680 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.life <= 0) this.corpses.splice(i, 1);
    }
  };

  ParticleSystem.prototype.clear = function () {
    this.particles.length = 0;
    this.floats.length = 0;
    this.corpses.length = 0;
  };

  ParticleSystem.prototype.draw = function (ctx) {
    var i, p, a;
    for (i = 0; i < this.particles.length; i++) {
      p = this.particles[i];
      a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * a, 0, Math.PI * 2);
      ctx.fill();
    }
    for (i = 0; i < this.corpses.length; i++) {
      p = this.corpses[i];
      a = Math.max(0, p.life / 0.9);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.r, -p.r, p.r * 2, p.r * 2);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(p.hp), 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    for (i = 0; i < this.floats.length; i++) {
      p = this.floats[i];
      a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.font = 'bold ' + Math.floor(22 + 10 * a) + 'px system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  };

  global.NGParticles = ParticleSystem;
})(typeof window !== 'undefined' ? window : global);
