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
    this.pool = [];
    this.active = [];
    this.waves = [];
    this.maxActive = 420;
    this._tint = {};
    var root = '../../assets/fx/';
    this.sprites = {
      glow: loadImage(root + 'glow.png'),
      star: loadImage(root + 'star.png'),
      spark: loadImage(root + 'spark.png'),
      ring: loadImage(root + 'ring.png'),
      shard: loadImage(root + 'shard.png')
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

  ParticleSystem.prototype._alloc = function () {
    return this.pool.pop() || {
      x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0,
      size: 0, color: '#fff', alpha: 1, g: 980, shape: 'dot', rot: 0, vr: 0
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
        p.size = 3 + Math.random() * (cellSize * 0.32);
        p.color = color;
        p.g = 820 + Math.random() * 280;
        p.shape = (k % 5 === 0) ? 'sq' : (k % 4 === 0) ? 'streak' : 'dot';
        p.rot = Math.random() * 6.2;
        p.vr = (Math.random() - 0.5) * 14;
        this.active.push(p);
      }
    }

    if (cells.length >= 2) {
      var sr = 0, sc = 0;
      for (var j = 0; j < cells.length; j++) {
        sr += cells[j].row; sc += cells[j].col;
      }
      this.waves.push({
        x: originX + (sc / cells.length + 0.5) * cellSize,
        y: originY + (sr / cells.length + 0.5) * cellSize,
        r: 10,
        maxR: 110 + cells.length * 8,
        alpha: 0.9,
        color: colors[cells[0].color] || '#fff',
        life: 0.42,
        maxLife: 0.42
      });
      this.waves.push({
        x: originX + (sc / cells.length + 0.5) * cellSize,
        y: originY + (sr / cells.length + 0.5) * cellSize,
        r: 6,
        maxR: 70 + cells.length * 4,
        alpha: 0.55,
        color: '#fff',
        life: 0.3,
        maxLife: 0.3
      });
    }
  };

  ParticleSystem.prototype.update = function (dt) {
    var i = this.active.length;
    while (i--) {
      var p = this.active[i];
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += (p.vr || 0) * dt;
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
      w.r += (w.maxR - w.r) * Math.min(1, dt * 9);
      w.alpha = Math.max(0, w.life / (w.maxLife || 0.45));
      if (w.life <= 0) this.waves.splice(i, 1);
    }
  };

  ParticleSystem.prototype.draw = function (ctx) {
    for (var i = 0; i < this.active.length; i++) {
      var p = this.active[i];
      var a = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;
      if (p.shape === 'streak') {
        ctx.globalAlpha = a;
        ctx.lineWidth = Math.max(1.5, p.size * 0.35);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
        ctx.stroke();
      } else if (p.shape === 'sq') {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot || 0);
        var hs = p.size * 0.45;
        ctx.fillRect(-hs, -hs, hs * 2, hs * 2);
        ctx.restore();
      } else {
        var puff = this._tinted(p.shape === 'star' ? this.sprites.star : this.sprites.glow, p.color);
        if (puff) {
          var d = p.size * (p.shape === 'star' ? 2.2 : 2.8);
          ctx.globalAlpha = a;
          ctx.drawImage(puff, p.x - d / 2, p.y - d / 2, d, d);
        } else {
          ctx.globalAlpha = a * 0.28;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = a;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 0.42, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    for (var j = 0; j < this.waves.length; j++) {
      var w = this.waves[j];
      var ring = this._tinted(this.sprites.ring, w.color);
      ctx.globalAlpha = w.alpha;
      if (ring) {
        ctx.drawImage(ring, w.x - w.r, w.y - w.r, w.r * 2, w.r * 2);
      } else {
        ctx.strokeStyle = w.color;
        ctx.lineWidth = 5 * w.alpha + 1;
        ctx.beginPath();
        ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  };

  ParticleSystem.prototype.clear = function () {
    while (this.active.length) this._free(this.active.pop());
    this.waves.length = 0;
  };

  global.ParticleSystem = ParticleSystem;
})(typeof window !== 'undefined' ? window : global);
