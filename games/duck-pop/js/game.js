/**
 * Duck Pop loop. Tap a duck, tap a column, same-color blocks burst into fluid.
 */
(function () {
  'use strict';

  var cv = document.getElementById('cv');
  var ctx = cv.getContext('2d');
  var overlay = document.getElementById('overlay');
  var tools = document.getElementById('tools');
  var comboEl = document.getElementById('combo');
  var bannerEl = document.getElementById('banner');
  var pauseBtn = document.getElementById('pause');
  var audio = DPAudio.create();

  var screen = 'menu';
  var choice = { index: 0, endless: 0 };
  var state = null;
  var launcher = null;
  var anim = null;
  var drops = [];
  var clearMode = false;
  var speed = 1;
  var shake = 0;
  var time = 0;
  var lastTs = 0;
  var lastShot = 0;
  var duckScroll = 0;
  var pointer = null;
  var lastLayout = null;
  var viewW = 360;
  var viewH = 640;
  var ended = false;
  var preview = null;
  var adRetry = null;
  var bannerUntil = 0;
  var taught = false;
  var aimCol = -1;

  function currentDef() {
    if (choice.endless) {
      var base = DPLevels[(choice.endless - 1) % DPLevels.length];
      var shift = choice.endless % 7;
      return {
        id: 100 + choice.endless,
        name: '无尽 ' + choice.endless,
        bonus: Math.max(0, 0.15 - choice.endless * 0.02),
        shuffles: 1,
        clears: 1,
        stars: 1,
        rows: base.rows.map(function (row) {
          return row.replace(/[0-9]/g, function (ch) { return String((+ch + shift) % 8); });
        })
      };
    }
    return DPLevels[choice.index];
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

  function banner(text) {
    bannerEl.textContent = text;
    bannerEl.classList.add('on');
    bannerUntil = performance.now() + 1600;
  }

  function floatAt(text, x, y, mega) {
    var d = document.createElement('div');
    d.className = 'floater' + (mega ? ' mega' : '');
    d.textContent = text;
    d.style.left = x + 'px';
    d.style.top = y + 'px';
    document.getElementById('floats').appendChild(d);
    setTimeout(function () { d.remove(); }, 760);
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

  function palColor(color) {
    if (color === DPCore.STONE) return '#d5dbe3';
    return (DPCore.COLORS[color] || DPCore.COLORS[0]).hex;
  }

  function spawnDrops(r, c, color, n) {
    if (!lastLayout) return;
    var cell = lastLayout.grid.cell;
    var x = lastLayout.grid.x + (c + 0.5) * cell;
    var y = lastLayout.grid.y + (r + 0.5) * cell;
    for (var i = 0; i < n; i++) {
      drops.push({
        x: x + (Math.random() - 0.5) * cell,
        y: y,
        vx: (Math.random() - 0.5) * 220,
        vy: 30 + Math.random() * 160,
        r: 2.6 + Math.random() * 4.2,
        life: 1.35,
        color: palColor(color)
      });
    }
  }

  function duckById(id) {
    if (!state) return null;
    for (var i = 0; i < state.ducks.length; i++) if (state.ducks[i].id === id) return state.ducks[i];
    return null;
  }

  function startRun() {
    state = DPCore.create(currentDef(), (choice.endless || choice.index + 1) * 13);
    launcher = state.ducks[0] || null;
    anim = null;
    drops = [];
    clearMode = false;
    ended = false;
    taught = false;
    shake = 0;
    duckScroll = 0;
    screen = 'play';
    pauseBtn.hidden = false;
    overlay.hidden = true;
    tools.hidden = false;
    banner('点下方鸭子，再点同色的一列');
    refreshTools();
  }

  function end(kind) {
    if (ended) return;
    ended = true;
    screen = kind;
    pauseBtn.hidden = true;
    tools.hidden = true;
    document.getElementById('sub').textContent = state.name + ' · 剩余 ' + DPCore.remainingBlocks(state.grid) + ' · 分数 ' + state.score;
    if (kind === 'win') audio.win();
    else audio.lose();
    renderOverlay();
  }

  function refreshTools() {
    var buttons = tools.querySelectorAll('button');
    if (!state) return;
    buttons[0].textContent = speed === 2 ? '2倍速中' : '2倍速';
    buttons[0].classList.toggle('on', speed === 2);
    buttons[1].textContent = '升级 ★' + state.stars;
    buttons[2].textContent = '清除 ' + state.clears;
    buttons[2].classList.toggle('on', clearMode);
    buttons[3].textContent = '打乱 ' + state.shuffles;
    var sub = document.getElementById('sub');
    var left = DPCore.remainingBlocks(state.grid);
    sub.textContent = state.name + ' · 剩余 ' + left + ' · 分数 ' + state.score;
    document.getElementById('lv').textContent = '第' + (choice.endless ? choice.endless : state.levelId) + '关';
    document.getElementById('stars').textContent = '★' + state.stars;
  }

  function beginShot(col) {
    if (!launcher || anim || !state) return;
    var duck = duckById(launcher.id);
    if (!duck || duck.ammo <= 0) {
      launcher = state.ducks[0] || null;
      audio.bad();
      banner('这只鸭子没有弹药了');
      return;
    }
    if (!DPCore.canShoot(state.grid, col, duck.color)) {
      audio.bad();
      banner('只打同色。这一列最底下不是这只鸭子的颜色');
      return;
    }
    var old = [];
    for (var r = 0; r < state.rows; r++) old.push(state.grid[r][col]);
    var res = DPCore.fire(state, duck.id, col);
    if (!res.ok || !res.hits.length) {
      audio.bad();
      banner('这一列打不了');
      return;
    }
    for (var h = 0; h < res.hits.length; h++) {
      if (res.hits[h].color !== duck.color) {
        audio.bad();
        return;
      }
    }
    taught = true;
    audio.shot();
    var hitSet = {};
    for (var i = 0; i < res.hits.length; i++) {
      if (res.hits[i].color !== duck.color) continue;
      hitSet[res.hits[i].r] = true;
      spawnDrops(res.hits[i].r, res.hits[i].c, res.hits[i].color, 14);
    }
    var fromBottom = [];
    for (var r2 = old.length - 1; r2 >= 0; r2--) {
      if (old[r2] == null || hitSet[r2]) continue;
      fromBottom.push(r2);
    }
    var toBottom = [];
    for (var r3 = state.rows - 1; r3 >= 0; r3--) {
      if (state.grid[r3][col] != null) toBottom.push(r3);
    }
    var falls = [];
    for (var f = 0; f < fromBottom.length && f < toBottom.length; f++) {
      if (fromBottom[f] !== toBottom[f]) {
        falls.push({ c: col, fromR: fromBottom[f], toR: toBottom[f], color: state.grid[toBottom[f]][col] });
      }
    }
    if (lastLayout) {
      floatAt('+' + res.n + '  弹药 ' + res.ammoLeft, lastLayout.grid.x + (col + 0.5) * lastLayout.grid.cell, lastLayout.grid.y + 16, res.n >= 8);
    }
    showCombo(state.chain);
    if (res.n >= 8) shake = Math.min(12, shake + 6);
    launcher = duckById(duck.id) || state.ducks[0] || null;
    lastShot = performance.now();
    anim = {
      t: 0,
      dur: Math.max(0.24, (0.2 + res.n * 0.04) / speed),
      falls: falls,
      col: col,
      color: duck.color,
      pending: state.status === 'win' ? 'win' : (state.status === 'lose' ? 'lose' : null)
    };
  }

  function openAd(tool, retry) {
    adRetry = { tool: tool, retry: retry };
    screen = 'ad';
    tools.hidden = true;
    renderOverlay();
  }

  function tap(p) {
    if (!lastLayout || !state || anim) return;
    var g = lastLayout.grid;
    if (p.x >= g.x && p.x <= g.x + g.w && p.y >= g.y && p.y <= g.y + g.h) {
      var col = Math.floor((p.x - g.x) / g.cell);
      var row = Math.floor((p.y - g.y) / g.cell);
      col = Math.max(0, Math.min(state.cols - 1, col));
      row = Math.max(0, Math.min(state.rows - 1, row));
      if (clearMode) {
        var cleared = DPCore.clearAt(state, row, col);
        if (cleared.needAd) openAd('clear', function () { DPCore.clearAt(state, row, col); });
        else if (cleared.ok) {
          spawnDrops(row, col, cleared.color, 10);
          audio.pop(3);
          clearMode = false;
          if (state.status === 'win') end('win');
          else if (state.status === 'lose') end('lose');
        } else banner('这里没有方块');
        return;
      }
      beginShot(col);
      return;
    }
    for (var i = 0; i < lastLayout.ducks.length; i++) {
      var d = lastLayout.ducks[i];
      if (p.x >= d.x && p.x <= d.x + d.w && p.y >= d.y && p.y <= d.y + d.h) {
        launcher = duckById(d.id);
        clearMode = false;
        audio.tap();
        return;
      }
    }
  }

  function update(dt) {
    if (screen !== 'play' || !state) return;
    time += dt;
    shake *= Math.pow(0.04, dt);
    if (launcher) {
      var live = duckById(launcher.id);
      launcher = live || state.ducks[0] || null;
    }
    var step = dt * speed;
    if (anim) {
      anim.t += step;
      if (anim.t >= anim.dur) {
        var pending = anim.pending;
        anim = null;
        if (pending) end(pending);
        else if (!DPCore.hasMove(state)) banner(state.clears || state.shuffles ? '没有可打的列了，用清除或打乱' : '无路可走');
      }
    } else if (lastShot && performance.now() - lastShot > 2200 && state.chain) {
      DPCore.breakChain(state);
      showCombo(0);
    }
    var floorY = viewH - 70;
    for (var i = drops.length - 1; i >= 0; i--) {
      var drop = drops[i];
      drop.vy += 1400 * step;
      drop.x += drop.vx * step;
      drop.y += drop.vy * step;
      if (drop.y > floorY) {
        drop.y = floorY;
        drop.vy *= -0.22;
        drop.vx *= 0.72;
        drop.life -= step * 0.7;
      } else drop.life -= step * 0.18;
      if (drop.life <= 0) drops.splice(i, 1);
    }
    if (!taught && screen === 'play') {
      bannerEl.textContent = '点下方鸭子，再点同色的一列';
      bannerEl.classList.add('on');
    }
  }

  function frame(ts) {
    if (!lastTs) lastTs = ts;
    var dt = Math.min(0.034, (ts - lastTs) / 1000);
    lastTs = ts;
    if (taught && performance.now() > bannerUntil) bannerEl.classList.remove('on');
    update(dt);
    var shown = state || preview;
    if (shown) {
      lastLayout = DPRender.layout(viewW, viewH, shown, duckScroll, screen === 'play' && launcher ? launcher.id : null);
      duckScroll = lastLayout.duckScroll;
      var aim = null;
      if (screen === 'play' && launcher && !clearMode) aim = { color: launcher.color, hover: aimCol };
      DPRender.draw(ctx, lastLayout, shown, {
        time: time,
        drops: screen === 'play' ? drops : [],
        shake: shake,
        falls: screen === 'play' && anim ? anim.falls : null,
        fallU: screen === 'play' && anim ? Math.min(1, anim.t / anim.dur) : 1,
        speed: speed,
        launcher: screen === 'play' ? launcher : null,
        aim: aim
      });
    }
    if (screen === 'play') refreshTools();
    requestAnimationFrame(frame);
  }

  function renderOverlay() {
    overlay.hidden = false;
    if (screen === 'menu') {
      preview = DPCore.create(currentDef(), 1);
      var buttons = '';
      for (var i = 0; i < DPLevels.length; i++) {
        buttons += '<button type="button" data-act="pick" data-arg="' + i + '" class="' + (!choice.endless && choice.index === i ? 'on' : '') + '">' + (i + 1) + ' ' + DPLevels[i].name + '</button>';
      }
      overlay.innerHTML =
        '<div class="sheet"><div class="kicker">DUCK</div><h1>消除我可以</h1>' +
        '<p>鸭子只打同色像素。点一只鸭子放到发射台，再点一列，方块会碎成流体掉下去。</p>' +
        '<div class="levels">' + buttons + '</div>' +
        '<button class="go" type="button" data-act="start">发射</button>' +
        '<button class="ghost" type="button" data-act="endless">无尽模式</button></div>';
    } else if (screen === 'pause') {
      overlay.innerHTML =
        '<div class="sheet"><h1>暂停</h1><p>分数 ' + state.score + ' · 连击 ' + state.bestCombo + '</p>' +
        '<button class="go" type="button" data-act="resume">继续</button>' +
        '<button class="ghost" type="button" data-act="retry">重开</button>' +
        '<button class="ghost" type="button" data-act="menu">回选关</button></div>';
    } else if (screen === 'win') {
      overlay.innerHTML =
        '<div class="sheet"><div class="kicker">CLEAR</div><h1>清光了</h1>' +
        '<p>分数 ' + state.score + ' · 最高连击 ' + state.bestCombo + ' · 发射 ' + state.shots + ' 次</p>' +
        '<div class="row"><button class="go" type="button" data-act="next">下一关</button>' +
        '<button class="ghost" type="button" data-act="retry">再来</button></div>' +
        '<button class="ghost" type="button" data-act="menu">回选关</button></div>';
    } else if (screen === 'lose') {
      overlay.innerHTML =
        '<div class="sheet"><div class="kicker">STUCK</div><h1>打不通了</h1>' +
        '<p>同色列被挡住，清除和打乱也用完了。还剩 ' + DPCore.remainingBlocks(state.grid) + ' 块。</p>' +
        '<button class="go" type="button" data-act="retry">再试一次</button>' +
        '<button class="ghost" type="button" data-act="menu">回选关</button></div>';
    } else if (screen === 'ad') {
      var name = { clear: '清除', shuffle: '打乱', star: '升级星' }[adRetry.tool] || '道具';
      overlay.innerHTML =
        '<div class="sheet"><div class="kicker">AD</div><h1>' + name + '</h1>' +
        '<p>广告位预留。正式版这里播激励视频，现在可以直接领取 1 次。</p>' +
        '<button class="go" type="button" data-act="claim">免费领取</button>' +
        '<button class="ghost" type="button" data-act="cancel-ad">取消</button></div>';
    }
  }

  overlay.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    audio.unlock();
    var act = btn.getAttribute('data-act');
    if (act === 'pick') {
      choice = { index: +btn.getAttribute('data-arg'), endless: 0 };
      preview = DPCore.create(currentDef(), 1);
      renderOverlay();
    } else if (act === 'start') startRun();
    else if (act === 'endless') { choice = { index: 0, endless: 1 }; startRun(); }
    else if (act === 'resume') { screen = 'play'; overlay.hidden = true; pauseBtn.hidden = false; tools.hidden = false; }
    else if (act === 'retry') startRun();
    else if (act === 'menu') {
      screen = 'menu';
      state = null;
      pauseBtn.hidden = true;
      tools.hidden = true;
      renderOverlay();
    } else if (act === 'next') {
      if (choice.endless) choice.endless += 1;
      else if (choice.index < DPLevels.length - 1) choice.index += 1;
      else choice = { index: 0, endless: 1 };
      startRun();
    } else if (act === 'claim') {
      if (adRetry) {
        DPCore.grant(state, adRetry.tool);
        if (adRetry.retry) adRetry.retry();
      }
      screen = 'play';
      overlay.hidden = true;
      tools.hidden = false;
      pauseBtn.hidden = false;
    } else if (act === 'cancel-ad') {
      screen = 'play';
      overlay.hidden = true;
      tools.hidden = false;
    }
  });

  tools.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (!btn || screen !== 'play' || !state) return;
    audio.unlock();
    var act = btn.getAttribute('data-act');
    if (act !== 'speed' && anim) return;
    if (act === 'speed') {
      speed = speed === 2 ? 1 : 2;
      banner(speed === 2 ? '两倍速开了' : '回到原速');
    } else if (act === 'upgrade') {
      if (!launcher) { banner('先点一只鸭子'); return; }
      var up = DPCore.upgrade(state, launcher.id);
      if (!up.ok) openAd('star', function () { DPCore.upgrade(state, launcher.id); });
      else { audio.pop(8); banner('弹药 +5'); }
    } else if (act === 'clear') {
      if (state.clears <= 0) openAd('clear', function () { clearMode = true; banner('点一个方块把它清掉'); });
      else {
        clearMode = !clearMode;
        banner(clearMode ? '点一个方块把它清掉' : '取消清除');
      }
    } else if (act === 'shuffle') {
      var sh = DPCore.shuffle(state);
      if (sh.needAd) openAd('shuffle', function () { DPCore.shuffle(state); });
      else { audio.tap(); banner('方块打乱了'); }
    }
    refreshTools();
  });

  pauseBtn.addEventListener('click', function () {
    if (screen !== 'play') return;
    screen = 'pause';
    pauseBtn.hidden = true;
    renderOverlay();
  });

  function columnAt(p) {
    if (!lastLayout || !state) return -1;
    var g = lastLayout.grid;
    if (p.x < g.x || p.x > g.x + g.w || p.y < g.y || p.y > g.y + g.h) return -1;
    return Math.max(0, Math.min(state.cols - 1, Math.floor((p.x - g.x) / g.cell)));
  }

  cv.addEventListener('pointerdown', function (e) {
    if (screen !== 'play') return;
    audio.unlock();
    var p = pos(e);
    aimCol = columnAt(p);
    var onDuck = false;
    if (lastLayout) {
      for (var i = 0; i < lastLayout.ducks.length; i++) {
        var d = lastLayout.ducks[i];
        if (p.x >= d.x && p.x <= d.x + d.w && p.y >= d.y - 8 && p.y <= d.y + d.h) onDuck = true;
      }
    }
    var band = !onDuck && lastLayout && p.y >= lastLayout.duckBand.y && p.y <= lastLayout.duckBand.y + lastLayout.duckBand.h;
    pointer = { x: p.x, y: p.y, sx: p.x, sy: p.y, moved: false, band: band };
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  });
  cv.addEventListener('pointermove', function (e) {
    if (!pointer || !lastLayout) return;
    var p = pos(e);
    aimCol = columnAt(p);
    if (Math.hypot(p.x - pointer.sx, p.y - pointer.sy) > 12) pointer.moved = true;
    if (pointer.band && pointer.moved) {
      duckScroll = Math.max(0, Math.min(lastLayout.duckMax, duckScroll - (p.x - pointer.x)));
      pointer.x = p.x;
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
    if ((e.key === 'Escape' || e.key === 'p' || e.key === 'P') && state) {
      if (screen === 'play') { screen = 'pause'; pauseBtn.hidden = true; renderOverlay(); }
      else if (screen === 'pause') { screen = 'play'; overlay.hidden = true; pauseBtn.hidden = false; tools.hidden = false; }
    }
  });
  window.addEventListener('error', function (ev) {
    var el = document.getElementById('err');
    el.textContent = ev.message || '脚本错误';
    el.classList.add('on');
  });

  tools.hidden = true;
  DPRender.load();
  resize();
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(document.getElementById('app'));
  renderOverlay();
  requestAnimationFrame(frame);
})();
