(function (global) {
  'use strict';

  function ParticleSystem() {
    this.pool = [];
    this.active = [];
    this.waves = [];
    this.maxActive = 420;
  }

  ParticleSystem.prototype._alloc = function () {
    return this.pool.pop() || {
      x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0,
      size: 0, color: '#fff', alpha: 1, g: 980
    };
  };

  ParticleSystem.prototype._free = function (p) {
    this.pool.push(p);
  };

  ParticleSystem.prototype.burst = function (cells, cellSize, originX, originY, colors) {
    var per = Math.max(10, Math.min(22, 10 + (cells.length / 2) | 0));
    var budget = this.maxActive - this.active.length;
    var total = Math.min(cells.length * per, budget, 360);
    var perCell = Math.max(6, (total / cells.length) | 0);

    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      var cx = originX + (cell.col + 0.5) * cellSize;
      var cy = originY + (cell.row + 0.5) * cellSize;
      var color = colors[cell.color] || '#fff';
      for (var k = 0; k < perCell && this.active.length < this.maxActive; k++) {
        var p = this._alloc();
        var ang = Math.random() * Math.PI * 2;
        var spd = 90 + Math.random() * 220;
        p.x = cx; p.y = cy;
        p.vx = Math.cos(ang) * spd * (0.45 + Math.random());
        p.vy = -120 - Math.random() * 280;
        p.life = 0.55 + Math.random() * 0.35;
        p.maxLife = p.life;
        p.size = 2.5 + Math.random() * (cellSize * 0.28);
        p.color = color;
        p.g = 900 + Math.random() * 200;
        this.active.push(p);
      }
    }

    if (cells.length >= 5) {
      var sr = 0, sc = 0;
      for (var j = 0; j < cells.length; j++) {
        sr += cells[j].row; sc += cells[j].col;
      }
      this.waves.push({
        x: originX + (sc / cells.length + 0.5) * cellSize,
        y: originY + (sr / cells.length + 0.5) * cellSize,
        r: 12,
        maxR: 90 + cells.length * 5,
        alpha: 0.85,
        color: colors[cells[0].color] || '#fff',
        life: 0.45
      });
      if (cells.length >= 10) {
        this.waves.push({
          x: originX + (sc / cells.length + 0.5) * cellSize,
          y: originY + (sr / cells.length + 0.5) * cellSize,
          r: 8,
          maxR: 130 + cells.length * 4,
          alpha: 0.5,
          color: '#fff',
          life: 0.35
        });
      }
    }
  };

  ParticleSystem.prototype.update = function (dt) {
    var i = this.active.length;
    while (i--) {
      var p = this.active[i];
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this._free(p);
        this.active.splice(i, 1);
      }
    }
    i = this.waves.length;
    while (i--) {
      var w = this.waves[i];
      w.life -= dt;
      w.r += (w.maxR - w.r) * Math.min(1, dt * 8);
      w.alpha = Math.max(0, w.life / 0.45) * 0.85;
      if (w.life <= 0) this.waves.splice(i, 1);
    }
  };

  ParticleSystem.prototype.draw = function (ctx) {
    for (var i = 0; i < this.active.length; i++) {
      var p = this.active[i];
      var a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    for (var j = 0; j < this.waves.length; j++) {
      var w = this.waves[j];
      ctx.globalAlpha = w.alpha;
      ctx.strokeStyle = w.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };

  ParticleSystem.prototype.clear = function () {
    while (this.active.length) this._free(this.active.pop());
    this.waves.length = 0;
  };

  global.ParticleSystem = ParticleSystem;
})(typeof window !== 'undefined' ? window : global);
