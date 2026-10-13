(function (global) {
  'use strict';

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }
  function easeOutQuad(t) {
    return t * (2 - t);
  }

  function BoardRenderer(canvas, particles) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = particles;
    this.colors = ['#FF4D6D', '#4D96FF', '#6BCB77', '#FFD93D', '#C77DFF', '#FF8C42'];
    this.stoneColor = '#5a6270';
    this.board = null;
    this.hover = null;
    this.cellSize = 40;
    this.pad = 8;
    this.offsetX = 0;
    this.offsetY = 0;
    this.shake = 0;
    this.floats = [];
    this.comboPop = null;
    this.tweens = [];
    this.hidden = {}; // key "r,c" during pop animation
    this.visualPos = {}; // key -> {x,y} override during fall/shift
    this.bg = '#0b0e18';
  }

  BoardRenderer.prototype.setColors = function (arr) {
    if (arr && arr.length) this.colors = arr.slice();
  };

  BoardRenderer.prototype.setBoard = function (board) {
    this.board = board;
    this.hidden = {};
    this.visualPos = {};
    this._layout();
  };

  BoardRenderer.prototype._layout = function () {
    if (!this.board) return;
    var rows = this.board.length, cols = this.board[0].length;
    var w = this.canvas.clientWidth || this.canvas.width;
    var h = this.canvas.clientHeight || this.canvas.height;
    var dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.viewW = w; this.viewH = h;
    var usableW = w - this.pad * 2;
    var usableH = h - this.pad * 2;
    this.cellSize = Math.floor(Math.min(usableW / cols, usableH / rows, 56));
    var bw = this.cellSize * cols;
    var bh = this.cellSize * rows;
    this.offsetX = Math.floor((w - bw) / 2);
    this.offsetY = Math.floor((h - bh) / 2);
  };

  BoardRenderer.prototype.resize = function () {
    this._layout();
  };

  BoardRenderer.prototype.cellAt = function (clientX, clientY) {
    var rect = this.canvas.getBoundingClientRect();
    var x = clientX - rect.left - this.offsetX;
    var y = clientY - rect.top - this.offsetY;
    if (!this.board) return null;
    var col = Math.floor(x / this.cellSize);
    var row = Math.floor(y / this.cellSize);
    if (row < 0 || col < 0 || row >= this.board.length || col >= this.board[0].length) return null;
    return { row: row, col: col };
  };

  BoardRenderer.prototype.setHover = function (cells) {
    this.hover = cells;
  };

  BoardRenderer.prototype.addShake = function (amount) {
    this.shake = Math.min(22, Math.max(this.shake, amount));
  };

  BoardRenderer.prototype.addFloat = function (text, row, col, color) {
    this.floats.push({
      text: text,
      x: this.offsetX + (col + 0.5) * this.cellSize,
      y: this.offsetY + (row + 0.5) * this.cellSize,
      vy: -70,
      life: 0.9,
      maxLife: 0.9,
      color: color || '#fff',
      size: 24,
      pop: 1.5
    });
  };

  BoardRenderer.prototype.showCombo = function (n) {
    if (n < 2) return;
    this.comboPop = { n: n, life: 0.85, maxLife: 0.85 };
  };

  BoardRenderer.prototype.playRemoveAnim = function (change, cells, onDone) {
    var self = this;
    var cs = this.cellSize;
    // hide removed immediately after short pop
    cells.forEach(function (cell) {
      var key = cell.row + ',' + cell.col;
      self.tweens.push({
        type: 'pop',
        key: key,
        t: 0,
        dur: 0.14,
        cell: cell
      });
    });

    var fallStart = 0.14;
    var maxFall = 0;
    (change.moved || []).forEach(function (m, idx) {
      var dist = Math.abs(m.to.row - m.from.row);
      var dur = Math.max(0.12, 0.055 * dist);
      maxFall = Math.max(maxFall, dur);
      self.tweens.push({
        type: 'move',
        t: -fallStart - (idx % 3) * 0.012,
        dur: dur,
        from: m.from,
        to: m.to,
        value: m.value,
        ease: easeOutCubic
      });
    });

    var shiftStart = fallStart + maxFall + 0.02;
    var maxShift = 0;
    (change.shifted || []).forEach(function (m, idx) {
      var dist = Math.abs(m.to.col - m.from.col);
      var dur = Math.max(0.1, 0.045 * dist);
      maxShift = Math.max(maxShift, dur);
      self.tweens.push({
        type: 'move',
        t: -shiftStart - (idx % 4) * 0.008,
        dur: dur,
        from: m.from,
        to: m.to,
        value: m.value,
        ease: easeOutQuad
      });
    });

    var total = shiftStart + maxShift + 0.05;
    this.tweens.push({
      type: 'done',
      t: 0,
      dur: total,
      onDone: onDone
    });
  };

  BoardRenderer.prototype.update = function (dt) {
    if (this.shake > 0.3) this.shake *= 0.88;
    else this.shake = 0;

    var i = this.floats.length;
    while (i--) {
      var f = this.floats[i];
      f.y += f.vy * dt;
      f.life -= dt;
      if (f.pop != null) f.pop += (1 - f.pop) * Math.min(1, dt * 14);
      if (f.life <= 0) this.floats.splice(i, 1);
    }
    if (this.comboPop) {
      this.comboPop.life -= dt;
      if (this.comboPop.life <= 0) this.comboPop = null;
    }

    this.visualPos = {};
    this.hidden = {};
    var still = [];
    for (var t = 0; t < this.tweens.length; t++) {
      var tw = this.tweens[t];
      tw.t += dt;
      if (tw.type === 'pop') {
        if (tw.t < tw.dur) {
          this.hidden[tw.key] = {
            scale: 1 - easeOutCubic(Math.max(0, tw.t) / tw.dur),
            value: tw.cell.color,
            row: tw.cell.row,
            col: tw.cell.col
          };
          still.push(tw);
        }
      } else if (tw.type === 'move') {
        var p = Math.min(1, Math.max(0, tw.t) / tw.dur);
        var mk = tw.to.row + ',' + tw.to.col;
        var x0 = this.offsetX + tw.from.col * this.cellSize;
        var y0 = this.offsetY + tw.from.row * this.cellSize;
        var x1 = this.offsetX + tw.to.col * this.cellSize;
        var y1 = this.offsetY + tw.to.row * this.cellSize;
        if (tw.t < tw.dur) {
          var e = tw.t < 0 ? 0 : tw.ease(p);
          this.visualPos[mk] = {
            x: x0 + (x1 - x0) * e,
            y: y0 + (y1 - y0) * e,
            value: tw.value,
            ghost: true
          };
          still.push(tw);
        }
      } else if (tw.type === 'done') {
        if (tw.t >= tw.dur) {
          if (tw.onDone) tw.onDone();
        } else still.push(tw);
      }
    }
    this.tweens = still;

    if (this.particles) this.particles.update(dt);
  };

  BoardRenderer.prototype._drawCell = function (ctx, x, y, value, scale, highlight) {
    var s = this.cellSize;
    var gap = Math.max(2, s * 0.1);
    var sz = (s - gap) * (scale != null ? scale : 1);
    var ox = x + (s - sz) / 2;
    var oy = y + (s - sz) / 2;
    var r = Math.max(6, sz * 0.22);
    ctx.save();
    // drop shadow under tile
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    this._roundRect(ctx, ox + 1.5, oy + 2.5, sz, sz, r);
    ctx.fill();

    var base = value === SameGameCore.STONE ? this.stoneColor : (this.colors[value] || '#888');
    if (value === SameGameCore.STONE) {
      var sg = ctx.createLinearGradient(ox, oy, ox + sz, oy + sz);
      sg.addColorStop(0, '#7a8494');
      sg.addColorStop(0.5, this.stoneColor);
      sg.addColorStop(1, '#3a4250');
      ctx.fillStyle = sg;
      this._roundRect(ctx, ox, oy, sz, sz, r);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 2;
      this._roundRect(ctx, ox, oy, sz, sz, r);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      this._roundRect(ctx, ox + sz * 0.15, oy + sz * 0.12, sz * 0.7, sz * 0.18, r * 0.4);
      ctx.fill();
    } else {
      // body radial gradient
      var rg = ctx.createRadialGradient(ox + sz * 0.3, oy + sz * 0.25, sz * 0.05, ox + sz * 0.5, oy + sz * 0.55, sz * 0.75);
      rg.addColorStop(0, shadeHex(base, 0.35));
      rg.addColorStop(0.55, base);
      rg.addColorStop(1, shadeHex(base, -0.35));
      ctx.fillStyle = rg;
      this._roundRect(ctx, ox, oy, sz, sz, r);
      ctx.fill();
      // specular highlight bar
      var hg = ctx.createLinearGradient(ox, oy, ox, oy + sz * 0.45);
      hg.addColorStop(0, 'rgba(255,255,255,0.55)');
      hg.addColorStop(0.4, 'rgba(255,255,255,0.12)');
      hg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hg;
      this._roundRect(ctx, ox + 2, oy + 2, sz - 4, sz * 0.38, r * 0.6);
      ctx.fill();
      // rim light
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 1.5;
      this._roundRect(ctx, ox + 1, oy + 1, sz - 2, sz - 2, r - 1);
      ctx.stroke();
      // bottom shade
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      this._roundRect(ctx, ox + 2, oy + sz * 0.62, sz - 4, sz * 0.32, r * 0.4);
      ctx.fill();
    }
    if (highlight) {
      ctx.shadowColor = base;
      ctx.shadowBlur = 14;
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = Math.max(2.5, s * 0.07);
      this._roundRect(ctx, ox - 2, oy - 2, sz + 4, sz + 4, r + 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      this._roundRect(ctx, ox, oy, sz, sz, r);
      ctx.fill();
    }
    ctx.restore();
  };

  function shadeHex(hex, lum) {
    hex = String(hex).replace(/[^0-9a-f]/gi, '');
    if (hex.length < 6) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    var out = '#';
    for (var i = 0; i < 3; i++) {
      var c = parseInt(hex.substr(i * 2, 2), 16);
      c = Math.round(Math.min(255, Math.max(0, c + c * lum)));
      var s = c.toString(16);
      out += s.length === 1 ? '0' + s : s;
    }
    return out;
  }

  BoardRenderer.prototype._roundRect = function (ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  BoardRenderer.prototype.draw = function () {
    var ctx = this.ctx;
    var w = this.viewW, h = this.viewH;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = this.bg;
    ctx.fillRect(0, 0, w, h);

    // board panel
    if (!this.board) return;
    var rows = this.board.length, cols = this.board[0].length;
    var bw = cols * this.cellSize, bh = rows * this.cellSize;

    var sx = 0, sy = 0;
    if (this.shake > 0) {
      sx = (Math.random() * 2 - 1) * this.shake;
      sy = (Math.random() * 2 - 1) * this.shake;
    }
    ctx.save();
    ctx.translate(sx, sy);

    // panel bg
    ctx.fillStyle = '#151a2a';
    this._roundRect(ctx, this.offsetX - 8, this.offsetY - 8, bw + 16, bh + 16, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1.5;
    this._roundRect(ctx, this.offsetX - 8, this.offsetY - 8, bw + 16, bh + 16, 16);
    ctx.stroke();

    var hoverSet = {};
    if (this.hover) {
      for (var hi = 0; hi < this.hover.length; hi++) {
        hoverSet[this.hover[hi].row + ',' + this.hover[hi].col] = true;
      }
    }

    var animating = this.tweens.length > 0;
    // During animation: draw board but skip cells that are visually moving (ghosts drawn separately)
    // Simpler approach: if animating after remove, board already updated — draw static board
    // but overlay ghosts from visualPos for moving tiles; hide cells whose keys are in visualPos as ghost source
    // Actually after removeAt, board is NEW. During fall, we need to NOT draw final positions until arrived,
    // and draw ghosts along path. Keys in visualPos with ghost:true mean draw at visual, and suppress board cell at `to`.

    var suppress = {};
    for (var vk in this.visualPos) {
      if (this.visualPos[vk].ghost) suppress[vk] = true;
    }
    for (var hk in this.hidden) suppress[hk] = true;

    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var key = r + ',' + c;
        var val = this.board[r][c];
        if (val === null) continue;
        if (suppress[key] && this.visualPos[key]) continue;
        if (suppress[key] && !this.hidden[key]) continue;
        this._drawCell(
          ctx,
          this.offsetX + c * this.cellSize,
          this.offsetY + r * this.cellSize,
          val,
          1,
          !!hoverSet[key]
        );
      }
    }

    // popping removed cells
    for (var hk2 in this.hidden) {
      var hd = this.hidden[hk2];
      if (hd.scale > 0.05) {
        this._drawCell(
          ctx,
          this.offsetX + hd.col * this.cellSize,
          this.offsetY + hd.row * this.cellSize,
          hd.value,
          hd.scale,
          false
        );
      }
    }

    // ghosts
    for (var gk in this.visualPos) {
      var g = this.visualPos[gk];
      this._drawCell(ctx, g.x, g.y, g.value, 1, false);
    }

    if (this.particles) this.particles.draw(ctx);
    ctx.restore();

    // floats (no shake)
    for (var fi = 0; fi < this.floats.length; fi++) {
      var fl = this.floats[fi];
      var a = fl.life / fl.maxLife;
      ctx.globalAlpha = a;
      ctx.fillStyle = fl.color;
      var fsz = (fl.size + (1 - a) * 10) * (fl.pop || 1);
      ctx.font = '900 ' + fsz + 'px system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.strokeText(fl.text, fl.x, fl.y);
      ctx.fillText(fl.text, fl.x, fl.y);
      ctx.globalAlpha = 1;
    }

    if (this.comboPop) {
      var cp = this.comboPop;
      var ca = Math.min(1, cp.life / 0.2) * Math.min(1, (cp.maxLife - cp.life) / 0.15 + 0.5);
      ctx.globalAlpha = Math.min(1, ca);
      ctx.fillStyle = cp.n >= 4 ? '#FF6B35' : '#FFD93D';
      var csz = 40 + Math.min(cp.n, 8) * 4;
      var popScale = 1 + (1 - cp.life / cp.maxLife) * 0.15;
      ctx.font = '900 ' + csz + 'px system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 6;
      var tx = w / 2, ty = h * 0.2;
      ctx.save();
      ctx.translate(tx, ty);
      ctx.scale(popScale, popScale);
      ctx.strokeText('COMBO ×' + cp.n, 0, 0);
      ctx.fillText('COMBO ×' + cp.n, 0, 0);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  };

  BoardRenderer.prototype.isAnimating = function () {
    return this.tweens.length > 0;
  };

  global.BoardRenderer = BoardRenderer;
})(typeof window !== 'undefined' ? window : global);
