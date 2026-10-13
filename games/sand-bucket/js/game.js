/**
 * Sand Bucket loop, input, and overlay UI.
 */
(function () {
  'use strict';

  var cv = document.getElementById('cv');
  var ctx = cv.getContext('2d');
  var overlay = document.getElementById('overlay');
  var comboEl = document.getElementById('combo');
  var bannerEl = document.getElementById('banner');
  var mergeBtn = document.getElementById('merge');
  var floats = document.getElementById('floats');
  var pauseBtn = document.getElementById('pause');
  var audio = SBAudio.create();

  var screen = 'menu';
  var choice = { index: 0, endless: 0 };
  var state = null;
  var grains = [];
  var sparks = [];
  var handScroll = 0;
  var selected = null;
  var shake = 0;
  var flash = 0;
  var acc = 0;
  var taught = false;
  var ended = false;
  var bannerUntil = 0;
  var lastCombo = 0;
  var viewW = 360;
  var viewH = 640;
  var lastLayout = null;
  var pointer = null;
  var adRetry = null;
  var preview = null;
  var time = 0;
  var lastTs = 0;

  function currentDef() {
    if (choice.endless) return endlessLevel(choice.endless);
    return SBLevels[choice.index];
  }

  function endlessLevel(n) {
    var base = SBLevels[(n - 1) % SBLevels.length];
    return {
      id: 100 + n,
      name: '无尽 ' + n,
      rows: base.rows,
      releaseMs: Math.max(90, base.releaseMs - n * 16),
      spillRate: Math.max(0.05, base.spillRate * Math.max(0.5, 1 - n * 0.05)),
      slots: n > 5 ? 4 : base.slots,
      tools: { shovel: 2, rainbow: 1, magnet: 1 }
    };
  }

  function resize() {
    var rect = cv.getBoundingClientRect();
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    viewW = Math.max(1, rect.width);
    viewH = Math.max(1, rect.height);
    cv.width = Math.round(viewW * dpr);
    cv.height = Math.round(viewH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function pos(e) {
    var r = cv.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function banner(text, sticky) {
    bannerEl.textContent = text;
    bannerEl.classList.add('on');
    bannerUntil = sticky ? Infinity : performance.now() + 1700;
  }

  function floatAt(text, x, y, cls) {
    var d = document.createElement('div');
    d.className = 'floater ' + (cls || 'good');
    d.textContent = text;
    d.style.left = x + 'px';
    d.style.top = y + 'px';
    floats.appendChild(d);
    setTimeout(function () { d.remove(); }, 800);
  }

  function burst(x, y, color, n) {
    var pal = color < 0 ? { hex: '#ffe566' } : SBCore.colorOf(color);
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var s = 40 + Math.random() * 140;
      sparks.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, r: 2 + Math.random() * 3, life: 0.6, color: pal.hex });
    }
  }

  function slotCenter(id) {
    if (!lastLayout) return { x: viewW / 2, y: viewH / 2 };
    for (var i = 0; i < lastLayout.slots.length; i++) {
      if (state.slots[i] === id) {
        var s = lastLayout.slots[i];
        return { x: s.x + s.w / 2, y: s.y + s.h / 2 };
      }
    }
    return { x: viewW / 2, y: lastLayout.belt.y };
  }

  function showCombo(n) {
    if (n < 2) {
      comboEl.classList.remove('show');
      comboEl.textContent = '';
      return;
    }
    comboEl.textContent = '连击 x ' + n;
    comboEl.classList.remove('show');
    void comboEl.offsetWidth;
    comboEl.classList.add('show');
  }

  function drain() {
    if (!state) return;
    var evs = state.events.splice(0, state.events.length);
    for (var i = 0; i < evs.length; i++) {
      var ev = evs[i];
      if (ev.type === 'merge') {
        audio.merge();
        shake = Math.min(14, shake + 8);
        var c = slotCenter(ev.a || null);
        floatAt(ev.text, viewW / 2, lastLayout ? lastLayout.belt.y : viewH * 0.5, 'mega');
        burst(viewW / 2, lastLayout ? lastLayout.mouthY : viewH * 0.5, ev.color, 18);
      } else if (ev.type === 'deliver') {
        audio.deliver();
        floatAt(ev.text, viewW / 2, lastLayout ? lastLayout.pic.y + 30 : 120, 'good');
        burst(viewW / 2, lastLayout ? lastLayout.pic.y + lastLayout.pic.h * 0.6 : 160, ev.color, 12);
      } else if (ev.type === 'full') {
        audio.full();
      } else if (ev.type === 'spill') {
        audio.spill();
        flash = 1;
        shake = Math.min(10, shake + 4);
        floatAt('洒了', viewW * 0.5, lastLayout ? lastLayout.belt.y + lastLayout.belt.h : viewH * 0.6, 'bad');
      } else if (ev.type === 'win') {
        end('win');
      } else if (ev.type === 'lose') {
        end('lose');
      }
    }
  }

  function end(kind) {
    if (ended) return;
    ended = true;
    screen = kind;
    pauseBtn.hidden = true;
    mergeBtn.hidden = true;
    if (kind === 'win') audio.win();
    else audio.lose();
    renderOverlay();
  }

  function startRun() {
    state = SBCore.create(currentDef());
    grains = [];
    sparks = [];
    handScroll = 0;
    selected = null;
    acc = 0;
    taught = false;
    ended = false;
    lastCombo = 0;
    shake = 0;
    screen = 'play';
    pauseBtn.hidden = false;
    overlay.hidden = true;
    banner('点桶，再点传送带。同色沙才会进去', true);
  }

  function hitTest(p) {
    var L = lastLayout;
    if (!L) return null;
    for (var t = 0; t < L.tools.length; t++) {
      var tool = L.tools[t];
      if (p.x >= tool.x && p.x <= tool.x + tool.w && p.y >= tool.y && p.y <= tool.y + tool.h) return { tool: tool.id };
    }
    var plus = L.plus;
    if (p.x >= plus.x && p.x <= plus.x + plus.w && p.y >= plus.y && p.y <= plus.y + plus.h + 14) return { plus: true };
    for (var s = 0; s < L.slots.length; s++) {
      var slot = L.slots[s];
      if (p.x >= slot.x && p.x <= slot.x + slot.w && p.y >= slot.y && p.y <= slot.y + slot.h) return { slot: s };
    }
    if (p.y >= L.hand.y && p.y <= L.hand.y + L.hand.h) {
      for (var h = 0; h < L.handHits.length; h++) {
        var item = L.handHits[h];
        if (!item.vis) continue;
        if (p.x >= item.x && p.x <= item.x + item.w && p.y >= item.y && p.y <= item.y + item.h) return { hand: item.id };
      }
      return { handScroll: true };
    }
    return null;
  }

  function openAd(tool, retry) {
    adRetry = { tool: tool, retry: retry };
    screen = 'ad';
    renderOverlay();
  }

  function tap(p) {
    audio.unlock();
    var hit = hitTest(p);
    if (!hit || !state) return;
    if (hit.tool === 'shovel') {
      var slot = -1;
      for (var i = 0; i < state.slots.length; i++) if (state.slots[i] === selected) slot = i;
      if (slot < 0) { banner('先点传送带上的桶'); return; }
      var sh = SBCore.shovel(state, slot);
      if (sh.needAd) openAd('shovel', function () { SBCore.shovel(state, slot); });
      else selected = null;
      audio.tap();
      return;
    }
    if (hit.tool === 'rainbow') {
      if (selected == null) { banner('先点一个桶，再开彩虹'); return; }
      var rb = SBCore.makeRainbow(state, selected);
      if (rb.needAd) openAd('rainbow', function () { SBCore.makeRainbow(state, selected); });
      audio.tap();
      return;
    }
    if (hit.tool === 'magnet') {
      var mg = SBCore.startMagnet(state);
      if (mg.needAd) openAd('magnet', function () { SBCore.startMagnet(state); });
      else banner('磁铁吸沙 8 秒');
      audio.tap();
      return;
    }
    if (hit.plus) {
      var add = SBCore.addSlot(state);
      if (add.needAd) openAd('slot', function () { SBCore.grant(state, 'slot'); });
      else if (!add.ok && add.reason === 'max') banner('传送带已经最宽');
      audio.tap();
      return;
    }
    if (hit.hand) {
      selected = selected === hit.hand ? null : hit.hand;
      audio.tap();
      return;
    }
    if (hit.slot != null) {
      var occupying = state.slots[hit.slot];
      if (selected != null && state.hand.indexOf(selected) >= 0 && occupying == null) {
        SBCore.place(state, selected, hit.slot);
        taught = true;
        bannerUntil = 0;
        selected = null;
        audio.tap();
        return;
      }
      if (occupying != null) {
        var bucket = SBCore.bucketById(state, occupying);
        if (selected != null && selected !== occupying && SBCore.canMerge(SBCore.bucketById(state, selected), bucket)) {
          SBCore.merge(state, selected, occupying);
          selected = null;
          return;
        }
        if (selected === occupying && SBCore.canSolo(state, bucket)) {
          SBCore.deliverSolo(state, occupying);
          selected = null;
          return;
        }
        selected = occupying;
        audio.tap();
      }
    }
  }

  function doMerge() {
    if (!state || state.status !== 'play') return;
    var pair = SBCore.findMergePair(state);
    if (!pair) return;
    SBCore.merge(state, pair.a, pair.b);
    selected = null;
  }

  function pickBucket(grain) {
    var best = null;
    var bestScore = 1e9;
    for (var i = 0; i < state.slots.length; i++) {
      var id = state.slots[i];
      if (id == null) continue;
      var bucket = SBCore.bucketById(state, id);
      if (!bucket || !bucket.alive || bucket.fill >= bucket.cap) continue;
      if (!(bucket.rainbow || bucket.color === grain.color)) continue;
      var slot = lastLayout.slots[i];
      var cx = slot.x + slot.w / 2;
      var score = Math.abs(cx - grain.x) + (bucket.rainbow ? 36 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = { id: id, x: cx, slot: slot };
      }
    }
    return best;
  }

  function spawnGrain(cell) {
    var g = lastLayout && lastLayout.grid;
    var x = viewW / 2;
    var y = 120;
    if (g) {
      x = g.x + (cell.c + 0.5) * g.cell;
      y = g.y + (cell.r + 0.5) * g.cell;
    }
    grains.push({ cellId: cell.id, color: cell.color, x: x, y: y, vy: 30, r: Math.max(3.2, (g ? g.cell : 8) * 0.34), seed: Math.random() * 6 });
  }

  function update(dt) {
    if (screen !== 'play' || !state) return;
    time += dt;
    SBCore.tick(state, dt);
    shake *= Math.pow(0.05, dt);
    flash = Math.max(0, flash - dt * 2.2);
    acc += dt * 1000;
    var guard = 0;
    while (state.status === 'play' && acc >= state.releaseMs && state.queue.length && guard++ < 6) {
      acc -= state.releaseMs;
      var cell = SBCore.releaseOne(state);
      if (cell) spawnGrain(cell);
    }
    for (var i = grains.length - 1; i >= 0; i--) {
      var p = grains[i];
      if (state.status !== 'play') {
        grains.splice(i, 1);
        continue;
      }
      var target = lastLayout ? pickBucket(p) : null;
      var ease = state.magnetT > 0 ? 12 : 6.5;
      if (target) p.x += (target.x - p.x) * Math.min(1, dt * ease);
      else p.x += Math.sin(p.seed + time * 5) * 10 * dt;
      p.vy = Math.min(760, p.vy + 980 * dt);
      p.y += p.vy * dt;
      if (target && p.y >= lastLayout.mouthY && Math.abs(p.x - target.x) < target.slot.w * 0.48) {
        var caught = SBCore.catchCell(state, target.id, p.cellId);
        if (caught.ok) {
          audio.catch(state.combo);
          burst(p.x, p.y, p.color, 6);
          if (state.combo >= 2 && state.combo !== lastCombo) showCombo(state.combo);
          if (state.combo > 0 && state.combo % 10 === 0) {
            floatAt('连击 x ' + state.combo, viewW / 2, lastLayout.pic.y + 24, 'mega');
            shake = Math.min(12, shake + 5);
          }
          lastCombo = state.combo;
          grains.splice(i, 1);
          continue;
        }
      }
      if (lastLayout && p.y > lastLayout.belt.y + lastLayout.belt.h) {
        SBCore.spillCell(state, p.cellId);
        lastCombo = 0;
        showCombo(0);
        grains.splice(i, 1);
      }
    }
    for (var s = sparks.length - 1; s >= 0; s--) {
      var spark = sparks[s];
      spark.life -= dt;
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      spark.vy += 400 * dt;
      if (spark.life <= 0) sparks.splice(s, 1);
    }
    if (state.status === 'play' && !grains.length && !state.queue.length && !state.inflight.length) {
      SBCore.settle(state);
    }
    drain();
    if (state && state.combo < 2) showCombo(0);
  }

  function hud() {
    var score = document.getElementById('score');
    var fill = document.getElementById('fill');
    var lv = document.getElementById('lv');
    var spill = document.getElementById('spill');
    if (!state) {
      score.textContent = '0';
      fill.style.width = '0%';
      lv.textContent = '拼图解压馆';
      spill.textContent = '';
      return;
    }
    score.textContent = state.score;
    fill.style.width = Math.min(100, Math.round((state.delivered / state.total) * 100)) + '%';
    lv.textContent = state.name + '  ·  ' + state.delivered + '/' + state.total;
    spill.textContent = '可洒 ' + state.lost + '/' + state.spillBudget;
  }

  function frame(ts) {
    if (!lastTs) lastTs = ts;
    var dt = Math.min(0.033, (ts - lastTs) / 1000);
    lastTs = ts;
    if (bannerUntil !== Infinity && performance.now() > bannerUntil) bannerEl.classList.remove('on');
    if (screen === 'play' && !taught) banner('点桶，再点传送带。同色沙才会进去', true);
    update(dt);
    var shown = state || preview;
    if (shown) {
      lastLayout = SBRender.layout(viewW, viewH, shown, handScroll);
      handScroll = lastLayout.handScroll;
      var pair = screen === 'play' ? SBCore.findMergePair(shown) : null;
      SBRender.draw(ctx, lastLayout, shown, {
        time: time,
        grains: screen === 'play' ? grains : [],
        sparks: sparks,
        shake: shake,
        flash: flash,
        selected: selected,
        pair: pair
      });
      if (pair && screen === 'play') {
        mergeBtn.hidden = false;
        mergeBtn.textContent = '合成 +' + pair.n;
        mergeBtn.style.top = (lastLayout.belt.y - 8) + 'px';
      } else mergeBtn.hidden = true;
    }
    hud();
    requestAnimationFrame(frame);
  }

  function levelButtons() {
    var html = '';
    for (var i = 0; i < SBLevels.length; i++) {
      html += '<button type="button" data-act="pick" data-arg="' + i + '" class="' + (!choice.endless && choice.index === i ? 'on' : '') + '">' + SBLevels[i].name + '</button>';
    }
    return html;
  }

  function renderOverlay() {
    overlay.hidden = false;
    if (screen === 'menu') {
      preview = SBCore.create(currentDef());
      overlay.innerHTML =
        '<div class="sheet"><div class="kicker">SAND</div><h1>拼图解压馆</h1>' +
        '<p>沙子从图案里掉下来。把同色桶放到传送带上接住，两个同样装满的桶合成之后，图案才会补上。</p>' +
        '<div class="levels">' + levelButtons() + '</div>' +
        '<button class="go" type="button" data-act="start">开始接沙</button>' +
        '<button class="ghost" type="button" data-act="endless">无尽模式</button></div>';
    } else if (screen === 'pause') {
      overlay.innerHTML =
        '<div class="sheet"><h1>暂停</h1><p>' + state.name + ' · 分数 ' + state.score + '</p>' +
        '<button class="go" type="button" data-act="resume">继续</button>' +
        '<button class="ghost" type="button" data-act="retry">重开本关</button>' +
        '<button class="ghost" type="button" data-act="menu">回选关</button></div>';
    } else if (screen === 'win') {
      overlay.innerHTML =
        '<div class="sheet"><div class="kicker">CLEAR</div><h1>拼图完成</h1>' +
        '<p>分数 ' + state.score + ' · 最高连击 ' + state.bestCombo + ' · 合成 ' + state.mergeCount + ' 次</p>' +
        '<div class="row"><button class="go" type="button" data-act="next">下一关</button>' +
        '<button class="ghost" type="button" data-act="retry">再来</button></div>' +
        '<button class="ghost" type="button" data-act="menu">回选关</button></div>';
    } else if (screen === 'lose') {
      var why = state.reason === 'spill' ? '洒出的沙子超过了 ' + state.spillBudget + ' 粒' : '图案没补满';
      overlay.innerHTML =
        '<div class="sheet"><div class="kicker">SPILL</div><h1>沙子洒了</h1><p>' + why + '。漏掉 ' + state.lost + ' 粒。</p>' +
        '<button class="go" type="button" data-act="retry">再接一次</button>' +
        '<button class="ghost" type="button" data-act="menu">回选关</button></div>';
    } else if (screen === 'ad') {
      var label = { shovel: '铲子', rainbow: '彩虹球', magnet: '磁铁', slot: '传送带空位' }[adRetry.tool] || '道具';
      overlay.innerHTML =
        '<div class="sheet"><div class="kicker">AD</div><h1>' + label + '</h1>' +
        '<p>广告位预留。正式版这里播激励视频，现在可以直接领取 1 次。</p>' +
        '<button class="go" type="button" data-act="claim">免费领取</button>' +
        '<button class="ghost" type="button" data-act="cancel-ad">取消</button></div>';
    }
  }

  overlay.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    audio.unlock();
    audio.tap();
    var act = btn.getAttribute('data-act');
    if (act === 'pick') {
      choice = { index: +btn.getAttribute('data-arg'), endless: 0 };
      preview = SBCore.create(currentDef());
      renderOverlay();
    } else if (act === 'start') startRun();
    else if (act === 'endless') {
      choice = { index: 0, endless: 1 };
      startRun();
    } else if (act === 'resume') {
      screen = 'play';
      overlay.hidden = true;
      pauseBtn.hidden = false;
    } else if (act === 'retry') startRun();
    else if (act === 'menu') {
      screen = 'menu';
      pauseBtn.hidden = true;
      state = null;
      renderOverlay();
    } else if (act === 'next') {
      if (choice.endless) choice.endless += 1;
      else if (choice.index < SBLevels.length - 1) choice.index += 1;
      else choice = { index: 0, endless: 1 };
      startRun();
    } else if (act === 'claim') {
      if (adRetry) {
        SBCore.grant(state, adRetry.tool);
        if (adRetry.retry) adRetry.retry();
      }
      screen = 'play';
      overlay.hidden = true;
      pauseBtn.hidden = false;
    } else if (act === 'cancel-ad') {
      screen = 'play';
      overlay.hidden = true;
    }
  });

  mergeBtn.addEventListener('click', function () {
    audio.unlock();
    doMerge();
  });
  pauseBtn.addEventListener('click', function () {
    if (screen !== 'play') return;
    screen = 'pause';
    pauseBtn.hidden = true;
    renderOverlay();
  });

  cv.addEventListener('pointerdown', function (e) {
    if (screen !== 'play') return;
    audio.unlock();
    var p = pos(e);
    var hand = lastLayout && p.y >= lastLayout.hand.y && p.y <= lastLayout.hand.y + lastLayout.hand.h;
    pointer = { x: p.x, y: p.y, sx: p.x, sy: p.y, moved: false, hand: hand };
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', function (e) {
    if (!pointer) return;
    var p = pos(e);
    if (Math.hypot(p.x - pointer.sx, p.y - pointer.sy) > 8) pointer.moved = true;
    if (pointer.hand && pointer.moved && lastLayout) {
      handScroll = Math.max(0, Math.min(lastLayout.handMax, handScroll - (p.y - pointer.y)));
      pointer.y = p.y;
    }
  });
  cv.addEventListener('pointerup', function (e) {
    if (!pointer) return;
    var p = pos(e);
    var moved = pointer.moved;
    pointer = null;
    if (!moved) tap(p);
  });

  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      if (screen === 'play') { screen = 'pause'; pauseBtn.hidden = true; renderOverlay(); }
      else if (screen === 'pause') { screen = 'play'; overlay.hidden = true; pauseBtn.hidden = false; }
    } else if ((e.key === 'm' || e.key === 'M') && screen === 'play') doMerge();
    else if (e.key === ' ' && screen === 'menu') { e.preventDefault(); startRun(); }
  });

  window.addEventListener('error', function (ev) {
    var el = document.getElementById('err');
    el.textContent = ev.message || '脚本错误';
    el.classList.add('on');
  });

  SBRender.load();
  resize();
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(document.getElementById('app'));
  renderOverlay();
  requestAnimationFrame(frame);
})();
