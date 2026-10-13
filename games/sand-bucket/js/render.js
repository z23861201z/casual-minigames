/**
 * Sand Bucket canvas. Macaron tray, crumbling pixel picture, conveyor, buckets.
 */
(function (global) {
  'use strict';

  var FONT = '"Segoe UI", system-ui, "PingFang SC", "Noto Sans SC", sans-serif';
  var images = {};

  function load() {
    ['shovel', 'rainbow', 'magnet'].forEach(function (name) {
      var img = new Image();
      img.src = '../../assets/sand-bucket/' + name + '.png';
      images[name] = img;
    });
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

  function ready(img) {
    return img && img.complete && img.naturalWidth > 0;
  }

  function orderedHand(state) {
    var up = SBCore.upcomingCounts(state, 18);
    var ids = state.hand.slice();
    ids.sort(function (a, b) {
      var A = SBCore.bucketById(state, a);
      var B = SBCore.bucketById(state, b);
      var ua = up[A.color] ? 0 : 1;
      var ub = up[B.color] ? 0 : 1;
      if (ua !== ub) return ua - ub;
      if (A.color !== B.color) return A.color - B.color;
      return A.cap - B.cap || A.id - B.id;
    });
    return ids;
  }

  function layout(w, h, state, handScroll) {
    var hud = 58;
    var toolsH = 92;
    var handH = Math.max(148, Math.min(230, h * 0.30));
    var beltH = Math.max(96, Math.min(120, h * 0.15));
    var beltY = h - toolsH - handH - beltH;
    var picH = beltY - hud - 12;
    if (picH < 108) {
      handH = Math.max(116, handH - (108 - picH));
      beltY = h - toolsH - handH - beltH;
      picH = Math.max(84, beltY - hud - 12);
    }
    var pic = { x: 16, y: hud + 6, w: w - 32, h: picH };
    var belt = { x: 12, y: beltY, w: w - 24, h: beltH - 8 };
    var hand = { x: 8, y: belt.y + belt.h + 6, w: w - 16, h: handH - 10 };
    var toolsY = h - toolsH + 8;
    var slotN = state.slots.length;
    var gap = 8;
    var slotW = Math.min(86, (belt.w - 52 - gap * (slotN - 1)) / slotN);
    var slotH = Math.min(belt.h - 28, slotW * 0.92);
    var slots = [];
    var total = slotN * slotW + (slotN - 1) * gap;
    var sx = belt.x + (belt.w - total) / 2 + 8;
    for (var i = 0; i < slotN; i++) {
      slots.push({
        index: i,
        x: sx + i * (slotW + gap),
        y: belt.y + (belt.h - slotH) / 2 + 6,
        w: slotW,
        h: slotH
      });
    }
    var cols = 4;
    var bw = Math.min(78, (hand.w - 16 - gap * 3) / cols);
    var bh = bw * 1.02;
    var ids = orderedHand(state);
    var rows = Math.ceil(ids.length / cols) || 1;
    var contentH = rows * (bh + gap);
    var maxScroll = Math.max(0, contentH - (hand.h - 12));
    var scroll = Math.max(0, Math.min(maxScroll, handScroll || 0));
    var handHits = [];
    for (var n = 0; n < ids.length; n++) {
      var col = n % cols;
      var row = Math.floor(n / cols);
      var hx = hand.x + 8 + col * (bw + gap);
      var hy = hand.y + 6 + row * (bh + gap) - scroll;
      handHits.push({
        id: ids[n],
        x: hx, y: hy, w: bw, h: bh,
        vis: hy + bh > hand.y && hy < hand.y + hand.h
      });
    }
    var toolW = 76;
    var toolGap = 16;
    var toolTotal = toolW * 3 + toolGap * 2;
    var toolX = (w - toolTotal) / 2;
    var tools = ['shovel', 'rainbow', 'magnet'].map(function (id, idx) {
      return { id: id, x: toolX + idx * (toolW + toolGap), y: toolsY, w: toolW, h: 72 };
    });
    var cell = 0;
    var grid = null;
    if (state.cols) {
      var maxW = pic.w - 36;
      var maxH = pic.h - 28;
      cell = Math.min(maxW / state.cols, maxH / state.rows);
      var gw = cell * state.cols;
      var gh = cell * state.rows;
      grid = { x: pic.x + (pic.w - gw) / 2, y: pic.y + (pic.h - gh) / 2 + 2, cell: cell, w: gw, h: gh };
    }
    return {
      w: w, h: h, pic: pic, belt: belt, hand: hand, slots: slots, handHits: handHits,
      tools: tools, grid: grid, handMax: maxScroll, handScroll: scroll,
      mouthY: slots.length ? slots[0].y + 8 : belt.y + 16,
      plus: { x: 16, y: belt.y + 8, w: 36, h: 36 },
      upcoming: SBCore.upcomingCounts(state, 18)
    };
  }

  function paintBucket(ctx, rect, bucket, opts) {
    var pal = bucket.rainbow
      ? { hex: '#fff', dark: '#d7def0', ink: '#243044' }
      : SBCore.colorOf(bucket.color);
    ctx.save();
    if (opts.hot) {
      ctx.shadowColor = 'rgba(255, 170, 40, .85)';
      ctx.shadowBlur = 16;
    } else if (opts.selected) {
      ctx.shadowColor = 'rgba(80, 160, 255, .8)';
      ctx.shadowBlur = 12;
    }
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, Math.min(16, rect.w * 0.22));
    var g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.18, pal.hex);
    g.addColorStop(1, pal.dark);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = opts.selected ? 3 : 2;
    ctx.strokeStyle = opts.selected ? '#3b82f6' : 'rgba(255,255,255,.8)';
    ctx.stroke();
    var hole = Math.max(6, rect.h * 0.16);
    roundRect(ctx, rect.x + 6, rect.y + 5, rect.w - 12, hole, 6);
    ctx.fillStyle = 'rgba(40, 24, 16, .18)';
    ctx.fill();
    if (bucket.rainbow) {
      var stripe = ['#ff6b6b', '#ffd93d', '#6bcB77', '#4dabf7', '#b197fc'];
      for (var s = 0; s < stripe.length; s++) {
        ctx.fillStyle = stripe[s];
        ctx.fillRect(rect.x + 8 + s * ((rect.w - 16) / stripe.length), rect.y + rect.h * 0.42, (rect.w - 16) / stripe.length - 1, 4);
      }
    }
    var big = bucket.fill > 0 ? String(bucket.fill) : String(bucket.cap);
    ctx.fillStyle = pal.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 ' + Math.max(12, Math.floor(rect.h * 0.34)) + 'px ' + FONT;
    ctx.fillText(big, rect.x + rect.w / 2, rect.y + rect.h * 0.58);
    ctx.font = '700 ' + Math.max(9, Math.floor(rect.h * 0.14)) + 'px ' + FONT;
    var sub = bucket.fill >= bucket.cap ? '满' : (bucket.fill > 0 ? '/' + bucket.cap : '容量');
    ctx.fillText(sub, rect.x + rect.w / 2, rect.y + rect.h * 0.84);
    ctx.restore();
  }

  function draw(ctx, L, state, fx) {
    var w = L.w;
    var h = L.h;
    ctx.clearRect(0, 0, w, h);
    var bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#fff8ee');
    bg.addColorStop(0.45, '#ffe7cf');
    bg.addColorStop(1, '#ffd7c2');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    if (fx.shake > 0.4) {
      ctx.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake);
    }

    roundRect(ctx, L.pic.x, L.pic.y, L.pic.w, L.pic.h, 26);
    ctx.fillStyle = '#f0b27a';
    ctx.fill();
    roundRect(ctx, L.pic.x + 8, L.pic.y + 8, L.pic.w - 16, L.pic.h - 16, 20);
    ctx.fillStyle = '#fff7ee';
    ctx.fill();

    if (L.grid) {
      for (var i = 0; i < state.cells.length; i++) {
        var cell = state.cells[i];
        var pal = SBCore.colorOf(cell.color);
        var x = L.grid.x + cell.c * L.grid.cell;
        var y = L.grid.y + cell.r * L.grid.cell;
        var s = L.grid.cell - 1.2;
        roundRect(ctx, x, y, s, s, Math.min(3, s * 0.2));
        if (cell.state === 'flight') ctx.fillStyle = 'rgba(232, 196, 164, .35)';
        else if (cell.state === 'lost') ctx.fillStyle = '#e7cfcf';
        else if (cell.state === 'bucket') ctx.fillStyle = pal.hex;
        else ctx.fillStyle = pal.hex;
        ctx.globalAlpha = cell.state === 'bucket' ? 0.45 : (cell.state === 'flight' ? 0.7 : 1);
        ctx.fill();
        ctx.globalAlpha = 1;
        if (cell.state === 'solid' || cell.state === 'delivered') {
          ctx.fillStyle = 'rgba(255,255,255,.35)';
          ctx.fillRect(x + 1, y + 1, s * 0.45, Math.max(1, s * 0.18));
        }
        if (cell.state === 'delivered' && ((cell.c + cell.r + Math.floor(fx.time * 3)) % 9 === 0)) {
          ctx.fillStyle = 'rgba(255,255,255,.9)';
          ctx.fillRect(x + s * 0.6, y + s * 0.25, 2, 2);
        }
      }
    }

    roundRect(ctx, L.belt.x, L.belt.y, L.belt.w, L.belt.h, 18);
    var beltG = ctx.createLinearGradient(0, L.belt.y, 0, L.belt.y + L.belt.h);
    beltG.addColorStop(0, '#d5e4ef');
    beltG.addColorStop(1, '#b9cddd');
    ctx.fillStyle = beltG;
    ctx.fill();
    ctx.save();
    roundRect(ctx, L.belt.x + 4, L.belt.y + 22, L.belt.w - 8, L.belt.h - 30, 12);
    ctx.clip();
    ctx.fillStyle = '#c5d5e2';
    ctx.fillRect(L.belt.x, L.belt.y, L.belt.w, L.belt.h);
    var shift = (fx.time * 36) % 26;
    ctx.strokeStyle = 'rgba(255,255,255,.7)';
    ctx.lineWidth = 3;
    for (var cx = L.belt.x - 26 + shift; cx < L.belt.x + L.belt.w; cx += 26) {
      ctx.beginPath();
      ctx.moveTo(cx, L.belt.y + L.belt.h * 0.72);
      ctx.lineTo(cx + 8, L.belt.y + L.belt.h * 0.48);
      ctx.lineTo(cx + 16, L.belt.y + L.belt.h * 0.72);
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = '#6d8294';
    ctx.font = '800 12px ' + FONT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    var used = 0;
    for (var us = 0; us < state.slots.length; us++) if (state.slots[us] != null) used++;
    ctx.fillText(used + '/' + state.slots.length, L.plus.x + 40, L.plus.y + 18);

    roundRect(ctx, L.plus.x, L.plus.y, L.plus.w, L.plus.h, 18);
    ctx.fillStyle = state.slots.length >= state.slotsCap ? '#d7d3cf' : '#7dce8a';
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '900 22px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('+', L.plus.x + L.plus.w / 2, L.plus.y + L.plus.h / 2 + 1);
    ctx.font = '800 9px ' + FONT;
    ctx.fillStyle = '#5d6b78';
    ctx.fillText(state.bonusSlotsLeft > 0 ? '免费' : '广告', L.plus.x + 18, L.plus.y + L.plus.h + 10);

    for (var s = 0; s < L.slots.length; s++) {
      var slot = L.slots[s];
      roundRect(ctx, slot.x, slot.y, slot.w, slot.h, 14);
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.8)';
      ctx.stroke();
      var id = state.slots[s];
      if (id != null) {
        var bucket = SBCore.bucketById(state, id);
        var pair = fx.pair && (fx.pair.a === id || fx.pair.b === id);
        paintBucket(ctx, slot, bucket, { selected: fx.selected === id, hot: pair && bucket.fill >= bucket.cap });
      }
    }

    roundRect(ctx, L.hand.x, L.hand.y, L.hand.w, L.hand.h, 18);
    ctx.fillStyle = 'rgba(255,255,255,.45)';
    ctx.fill();
    ctx.save();
    roundRect(ctx, L.hand.x, L.hand.y, L.hand.w, L.hand.h, 18);
    ctx.clip();
    for (var hi = 0; hi < L.handHits.length; hi++) {
      var hit = L.handHits[hi];
      if (!hit.vis) continue;
      var hb = SBCore.bucketById(state, hit.id);
      var want = L.upcoming[hb.color] && !hb.rainbow;
      paintBucket(ctx, hit, hb, { selected: fx.selected === hit.id, hot: !!want && hb.fill < hb.cap });
    }
    ctx.restore();

    var names = { shovel: '铲子', rainbow: '彩虹', magnet: '磁铁' };
    for (var t = 0; t < L.tools.length; t++) {
      var tool = L.tools[t];
      var count = state.tools[tool.id];
      var active = tool.id === 'magnet' && state.magnetT > 0;
      ctx.fillStyle = active ? '#ffe08a' : '#ffffff';
      ctx.beginPath();
      ctx.arc(tool.x + tool.w / 2, tool.y + 24, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = active ? '#f59e0b' : '#f3d2b4';
      ctx.stroke();
      if (ready(images[tool.id])) {
        ctx.drawImage(images[tool.id], tool.x + tool.w / 2 - 16, tool.y + 8, 32, 32);
      } else {
        ctx.fillStyle = '#e07a3d';
        ctx.font = '700 12px ' + FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(names[tool.id].slice(0, 1), tool.x + tool.w / 2, tool.y + 24);
      }
      ctx.fillStyle = '#5a3828';
      ctx.font = '800 12px ' + FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(names[tool.id], tool.x + tool.w / 2, tool.y + 60);
      ctx.font = '800 10px ' + FONT;
      ctx.fillStyle = count > 0 ? '#0f9f6e' : '#d4533a';
      ctx.fillText(count > 0 ? '免费×' + count : '广告', tool.x + tool.w / 2, tool.y + 74);
    }

    for (var g = 0; g < fx.grains.length; g++) {
      var p = fx.grains[g];
      var gp = SBCore.colorOf(p.color);
      ctx.fillStyle = gp.dark;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = gp.hex;
      ctx.beginPath();
      ctx.arc(p.x - p.r * 0.25, p.y - p.r * 0.3, p.r * 0.62, 0, Math.PI * 2);
      ctx.fill();
    }
    for (var sp = 0; sp < fx.sparks.length; sp++) {
      var spark = fx.sparks[sp];
      ctx.globalAlpha = Math.max(0, spark.life);
      ctx.fillStyle = spark.color;
      ctx.beginPath();
      ctx.arc(spark.x, spark.y, spark.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (fx.flash > 0) {
      ctx.fillStyle = 'rgba(255, 60, 60, ' + (fx.flash * 0.25) + ')';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }

  global.SBRender = { load: load, layout: layout, draw: draw, orderedHand: orderedHand };
})(typeof window !== 'undefined' ? window : global);
