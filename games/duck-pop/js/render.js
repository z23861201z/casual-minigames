/**
 * Duck Pop canvas: glossy pixel blocks, launcher duck, fluid droplets.
 */
(function (global) {
  'use strict';

  var FONT = '"Segoe UI", system-ui, "PingFang SC", "Noto Sans SC", sans-serif';
  var images = [];

  function load() {
    for (var i = 0; i < DPCore.COLORS.length; i++) {
      var img = new Image();
      img.src = '../../assets/duck-pop/duck-' + i + '.png';
      images[i] = img;
    }
  }

  function ready(img) {
    return img && img.complete && img.naturalWidth > 0;
  }

  function roundRect(ctx, x, y, w, h, r) {
    var rr = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function layout(w, h, state, duckScroll) {
    var hud = 62;
    var tools = 74;
    var duckH = 92;
    var launchH = 64;
    var gridTop = hud + 8;
    var gridBottom = h - tools - duckH - launchH;
    var gridH = Math.max(120, gridBottom - gridTop);
    var cell = Math.min((w - 28) / state.cols, (gridH - 8) / state.rows);
    var gw = cell * state.cols;
    var gh = cell * state.rows;
    var grid = { x: (w - gw) / 2, y: gridTop + (gridH - gh) / 2, cell: cell, w: gw, h: gh };
    var launch = { x: w / 2, y: grid.y + gh + 34, r: 28 };
    var duckY = launch.y + 36;
    var duckW = 64;
    var gap = 8;
    var content = state.ducks.length * (duckW + gap);
    var maxScroll = Math.max(0, content - (w - 16));
    var scroll = Math.max(0, Math.min(maxScroll, duckScroll || 0));
    var start = 12 - scroll;
    var ducks = state.ducks.map(function (duck, i) {
      return { id: duck.id, x: start + i * (duckW + gap), y: duckY, w: duckW, h: 70 };
    });
    return {
      w: w, h: h, grid: grid, launch: launch, ducks: ducks,
      duckMax: maxScroll, duckScroll: scroll, duckBand: { y: duckY - 4, h: 78 }
    };
  }

  function drawCube(ctx, x, y, s, color) {
    var stone = color === DPCore.STONE;
    var pal = stone ? { hex: '#b7c0cc', dark: '#7d8794', ink: '#fff' } : DPCore.COLORS[color];
    var lift = Math.max(3, s * 0.16);
    roundRect(ctx, x + 1, y + lift, s - 2, s - lift - 1, 4);
    ctx.fillStyle = pal.dark;
    ctx.fill();
    roundRect(ctx, x + 1, y + 1, s - 2, s - lift, 4);
    var g = ctx.createLinearGradient(x, y, x, y + s);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.25, pal.hex);
    g.addColorStop(1, pal.dark);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.fillRect(x + 4, y + 3, Math.max(2, s * 0.28), Math.max(2, s * 0.12));
    if (stone) {
      ctx.strokeStyle = '#66717f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 6, y + 8);
      ctx.lineTo(x + s - 8, y + s - 10);
      ctx.moveTo(x + s - 8, y + 8);
      ctx.lineTo(x + 6, y + s - 10);
      ctx.stroke();
    }
  }

  function drawDuck(ctx, x, y, s, color, ammo, selected) {
    var pal = DPCore.COLORS[color] || DPCore.COLORS[0];
    ctx.save();
    if (selected) {
      ctx.shadowColor = pal.hex;
      ctx.shadowBlur = 16;
    }
    var img = images[color];
    if (ready(img)) ctx.drawImage(img, x, y, s, s);
    else {
      ctx.fillStyle = pal.hex;
      ctx.beginPath();
      ctx.ellipse(x + s / 2, y + s * 0.58, s * 0.36, s * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x + s * 0.62, y + s * 0.38, s * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3a2a12';
      ctx.beginPath();
      ctx.arc(x + s * 0.68, y + s * 0.36, s * 0.045, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff9f1c';
      ctx.beginPath();
      ctx.moveTo(x + s * 0.78, y + s * 0.4);
      ctx.lineTo(x + s * 0.96, y + s * 0.46);
      ctx.lineTo(x + s * 0.78, y + s * 0.52);
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = '#1b2430';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.font = '900 ' + Math.max(16, Math.floor(s * 0.34)) + 'px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText(String(ammo), x + s / 2, y + s * 0.78);
    ctx.fillText(String(ammo), x + s / 2, y + s * 0.78);
  }

  function draw(ctx, L, state, fx) {
    var w = L.w;
    var h = L.h;
    ctx.clearRect(0, 0, w, h);
    var sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#d9f3ff');
    sky.addColorStop(0.42, '#f4fbff');
    sky.addColorStop(1, '#f8e3bf');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.beginPath();
    ctx.ellipse(w * 0.2, 36, 46, 16, 0, 0, Math.PI * 2);
    ctx.ellipse(w * 0.78, 48, 36, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    if (fx.shake > 0.4) ctx.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake);

    roundRect(ctx, L.grid.x - 8, L.grid.y - 8, L.grid.w + 16, L.grid.h + 16, 16);
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.stroke();

    var hidden = {};
    if (fx.anim) {
      for (var a = 0; a < fx.anim.cursor; a++) {
        var hit = fx.anim.hits[a];
        hidden[hit.r + ',' + hit.c] = true;
      }
    }
    for (var r = 0; r < state.rows; r++) {
      for (var c = 0; c < state.cols; c++) {
        var v = state.grid[r][c];
        if (v == null || hidden[r + ',' + c]) continue;
        var x = L.grid.x + c * L.grid.cell;
        var y = L.grid.y + r * L.grid.cell;
        if (fx.aim && fx.aim.color != null) {
          var face = DPCore.firstSolid(state.grid, c);
          if (face && face.r === r && face.color === fx.aim.color) {
            ctx.fillStyle = 'rgba(80, 220, 120, .35)';
            ctx.fillRect(x, y, L.grid.cell, L.grid.cell);
          } else if (face && face.r === r && face.color !== fx.aim.color && c === fx.aim.hover) {
            ctx.fillStyle = 'rgba(255, 80, 80, .28)';
            ctx.fillRect(x, y, L.grid.cell, L.grid.cell);
          }
        }
        drawCube(ctx, x + 1, y + 1, L.grid.cell - 2, v);
      }
    }

    ctx.fillStyle = 'rgba(255,255,255,.8)';
    ctx.beginPath();
    ctx.ellipse(L.launch.x, L.launch.y + 8, 34, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    if (fx.launcher) {
      var bob = Math.sin(fx.time * 6) * 3;
      drawDuck(ctx, L.launch.x - 30, L.launch.y - 58 + bob, 60, fx.launcher.color, fx.launcher.ammo, true);
    }

    if (fx.anim) {
      var u = Math.min(1, fx.anim.t / fx.anim.dur);
      var fromY = L.launch.y - 20;
      var toY = L.grid.y - 8;
      var dy = fromY + (toY - fromY) * u;
      var dx = L.grid.x + (fx.anim.col + 0.5) * L.grid.cell - 16;
      drawDuck(ctx, dx, dy, 32, fx.anim.color, '', false);
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, L.duckBand.y, w, L.duckBand.h + 8);
    ctx.clip();
    for (var i = 0; i < L.ducks.length; i++) {
      var d = L.ducks[i];
      var duck = null;
      for (var k = 0; k < state.ducks.length; k++) if (state.ducks[k].id === d.id) duck = state.ducks[k];
      if (!duck) continue;
      roundRect(ctx, d.x, d.y, d.w, d.h, 14);
      ctx.fillStyle = fx.launcher && fx.launcher.id === duck.id ? '#fff' : 'rgba(255,255,255,.72)';
      ctx.fill();
      drawDuck(ctx, d.x + 6, d.y - 6, d.w - 12, duck.color, duck.ammo, fx.launcher && fx.launcher.id === duck.id);
    }
    ctx.restore();

    for (var p = 0; p < fx.drops.length; p++) {
      var drop = fx.drops[p];
      ctx.globalAlpha = Math.max(0, Math.min(1, drop.life));
      ctx.fillStyle = drop.color;
      ctx.beginPath();
      ctx.arc(drop.x, drop.y, drop.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  global.DPRender = { load: load, layout: layout, draw: draw };
})(typeof window !== 'undefined' ? window : global);
