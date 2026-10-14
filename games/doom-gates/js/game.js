/**
 * Doom Gates: auto-run, slide, auto-fire. Squad size is the score that matters.
 */
(function () {
  'use strict';

  var cv = document.getElementById('cv');
  var ctx = cv.getContext('2d');
  var overlay = document.getElementById('overlay');
  var pauseBtn = document.getElementById('pause');
  var squadEl = document.getElementById('squad-num');
  var goalEl = document.getElementById('goal');
  var bannerEl = document.getElementById('banner');
  var hintEl = document.getElementById('hint');
  var squadLabel = document.getElementById('squad-label');
  var hurtEl = document.getElementById('hurt');
  var audio = DGAudio.create();

  var screen = 'menu';
  var choice = { index: 0, endless: 0 };
  var state = null;
  var buildings = [];
  var shownSquad = -1;
  var shake = 0;
  var time = 0;
  var lastTs = 0;
  var viewW = 360;
  var viewH = 640;
  var dragging = null;
  var keys = { left: false, right: false };
  var ended = false;
  var shotCd = 0;
  var hot = {};
  var taughtUntil = 0;

  function currentDef() {
    if (choice.endless) return DGCore.buildEndless(choice.endless, 1000 + choice.endless * 17);
    return DGLevels[choice.index];
  }

  function makeCity(level) {
    var rng = DGCore.mulberry32((level.id || 1) * 19 + 4);
    var list = [];
    var end = (level.finish && level.finish.z || 80) + 24;
    for (var z = -6; z < end; z += 6 + rng() * 4) {
      list.push({ side: -1, z: z, w: 0.35 + rng() * 0.45, h: 1.3 + rng() * 2.4, shade: rng() });
      list.push({ side: 1, z: z + 2.5, w: 0.3 + rng() * 0.5, h: 1.1 + rng() * 2.6, shade: rng() });
    }
    return list;
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

  function floatAt(text, x, y, cls) {
    var d = document.createElement('div');
    d.className = 'floater ' + cls;
    d.textContent = text;
    d.style.left = x + 'px';
    d.style.top = y + 'px';
    document.getElementById('floats').appendChild(d);
    setTimeout(function () { d.remove(); }, 860);
  }

  function screenPoint(z, x) {
    var L = DGRender.layout(viewW, viewH);
    var p = DGRender.project(L, state, x, z);
    if (!p) return { x: viewW / 2, y: viewH * 0.4 };
    return { x: p.sx, y: p.sy };
  }

  function startRun() {
    var def = currentDef();
    state = DGCore.create(def);
    buildings = makeCity(def);
    ended = false;
    shownSquad = -1;
    hot = {};
    screen = 'play';
    pauseBtn.hidden = false;
    overlay.hidden = true;
    bannerEl.hidden = false;
    hintEl.hidden = false;
    bannerEl.textContent = '左右滑动选门 · 子弹能把数字改得更赚';
    squadLabel.textContent = '滑向更大的数字';
    taughtUntil = performance.now() + 2800;
  }

  function end(kind) {
    if (ended) return;
    ended = true;
    screen = kind;
    pauseBtn.hidden = true;
    bannerEl.hidden = true;
    hintEl.hidden = true;
    squadEl.textContent = String(Math.max(0, state.squad));
    shownSquad = state.squad;
    if (kind === 'win') {
      audio.win();
      goalEl.textContent = '通关 · 获得' + state.finish.name;
      squadLabel.textContent = '小队 ' + state.squad + ' 人过门槛';
    } else {
      audio.lose();
      goalEl.textContent = loseCopy()[0];
      squadLabel.textContent = '小队 ' + state.squad + ' 人';
    }
    renderOverlay();
  }

  function drain() {
    var evs = state.events.splice(0, state.events.length);
    for (var i = 0; i < evs.length; i++) {
      var ev = evs[i];
      if (ev.type === 'gate') {
        audio.gate(ev.delta >= 0);
        var cls = ev.delta < 0 ? 'bad' : (Math.abs(ev.delta) >= 8 ? 'mega' : 'good');
        floatAt(ev.text, viewW / 2, viewH * 0.68, cls);
        floatAt('小队 ' + ev.squad + ' 人', viewW / 2, viewH * 0.76, 'good');
        shake = Math.min(10, shake + 4);
      } else if (ev.type === 'gate-charge') {
        audio.charge();
        hot[ev.z + ev.side] = 0.28;
      } else if (ev.type === 'need') {
        audio.charge();
        floatAt('需要 ' + ev.text, viewW / 2, viewH * 0.28, 'mega');
      } else if (ev.type === 'contact') {
        audio.hit();
        hurtEl.classList.add('on');
        shake = 12;
        floatAt('-1', viewW / 2, viewH * 0.62, 'bad');
      } else if (ev.type === 'hit') {
        audio.hit();
      } else if (ev.type === 'kill') {
        var kp = DGRender.project(DGRender.layout(viewW, viewH), state, ev.x, ev.z);
        floatAt(ev.text, kp ? kp.sx : viewW / 2, kp ? kp.sy - 36 : viewH * 0.5, 'good');
        shake = Math.min(8, shake + 2);
      } else if (ev.type === 'win') end('win');
      else if (ev.type === 'lose') end('lose');
    }
  }

  function update(dt) {
    if (screen !== 'play' || !state) return;
    time += dt;
    shake *= Math.pow(0.05, dt);
    if (shake < 0.4) hurtEl.classList.remove('on');
    Object.keys(hot).forEach(function (k) {
      hot[k] -= dt;
      if (hot[k] <= 0) delete hot[k];
    });
    if (keys.left) state.targetX -= dt * 3.4;
    if (keys.right) state.targetX += dt * 3.4;
    shotCd = Math.max(0, shotCd - dt);
    var before = state.bullets.length;
    DGCore.step(state, dt);
    if (state.bullets.length > before) {
      shotCd = 0.12;
      if (Math.random() < 0.45) audio.shot();
    }
    state.zombies.forEach(function (zombie) {
      if (zombie._hp == null) zombie._hp = zombie.hp;
      if (zombie.hp < zombie._hp) {
        zombie.flash = 0.12;
        zombie._hp = zombie.hp;
      }
      if (zombie.flash > 0) zombie.flash -= dt;
      if (zombie.alive) zombie._seen = true;
      else if (zombie._seen && zombie.dying == null && zombie.z > state.z - 1.2) zombie.dying = 0.18;
      if (zombie.dying > 0) zombie.dying -= dt;
    });
    drain();
    if (screen !== 'play') return;
    var volley = DGCore.volleyCount(state.squad);
    goalEl.textContent = '终点 ' + state.finish.name + ' · 需要 ' + state.finish.need + ' 人 · 火力 ' + volley;
    if (shownSquad !== state.squad) {
      squadEl.textContent = String(Math.max(0, state.squad | 0));
      squadEl.classList.remove('pop');
      void squadEl.offsetWidth;
      squadEl.classList.add('pop');
      shownSquad = state.squad;
    }
    if (performance.now() > taughtUntil) {
      squadLabel.textContent = '火力 ' + volley + ' · 击倒 ' + state.kills;
      bannerEl.hidden = true;
      hintEl.hidden = true;
    }
  }

  function frame(ts) {
    if (!lastTs) lastTs = ts;
    var dt = Math.min(0.033, (ts - lastTs) / 1000);
    lastTs = ts;
    update(dt);
    if (state && (screen === 'play' || screen === 'pause')) {
      ctx.save();
      if (shake > 0.5) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      DGRender.draw(ctx, DGRender.layout(viewW, viewH), state, { time: time, buildings: buildings, hot: hot, muzzle: shotCd });
      ctx.restore();
    } else if (screen === 'menu') {
      ctx.fillStyle = '#1b2a44';
      ctx.fillRect(0, 0, viewW, viewH);
    }
    requestAnimationFrame(frame);
  }

  function loseCopy() {
    if (state.reason === 'zombie') return ['阵亡', '丧尸扑到了小队，人数归零。'];
    if (state.reason === 'gate') return ['人数归零', '这扇门上的数字把小队减没了。'];
    return ['没过门槛', '终点武器「' + state.finish.name + '」需要 ' + state.finish.need + ' 人，小队只有 ' + state.squad + ' 人。'];
  }

  function renderOverlay() {
    overlay.hidden = false;
    if (screen === 'menu') {
      var buttons = '';
      for (var i = 0; i < DGLevels.length; i++) {
        buttons += '<button type="button" data-act="pick" data-arg="' + i + '" class="' + (!choice.endless && choice.index === i ? 'on' : '') + '">' + DGLevels[i].name + '</button>';
      }
      overlay.innerHTML =
        '<div class="sheet"><div class="kicker">DOOM</div><h1>向末日开炮</h1>' +
        '<p>自动往前跑，左右滑进数字门，小队人数会变。子弹能把门上的数字越打越赚。终点武器认人数，丧尸碰到人才会死。</p>' +
        '<div class="levels">' + buttons + '</div>' +
        '<button class="go" type="button" data-act="start">出击</button>' +
        '<button class="ghost" type="button" data-act="endless">无尽尸潮</button></div>';
    } else if (screen === 'pause') {
      overlay.innerHTML =
        '<div class="sheet"><h1>暂停</h1><p>' + state.name + ' · ' + state.squad + ' 人</p>' +
        '<button class="go" type="button" data-act="resume">继续跑</button>' +
        '<button class="ghost" type="button" data-act="retry">重开</button>' +
        '<button class="ghost" type="button" data-act="menu">回选关</button></div>';
    } else if (screen === 'win') {
      overlay.innerHTML =
        '<div class="sheet win"><div class="kicker">CLEAR</div><h1>通关</h1>' +
        '<p>获得终点武器「' + state.finish.name + '」<br>小队 ' + state.squad + ' 人，门槛 ' + state.finish.need + ' 人<br>击倒 ' + state.kills + '</p>' +
        '<div class="row"><button class="go" type="button" data-act="next">下一关</button>' +
        '<button class="ghost" type="button" data-act="retry">再跑</button></div>' +
        '<button class="ghost" type="button" data-act="menu">回选关</button></div>';
    } else if (screen === 'lose') {
      var copy = loseCopy();
      overlay.innerHTML =
        '<div class="sheet dead"><div class="kicker">DEAD</div><h1>' + copy[0] + '</h1><p>' + copy[1] + '</p>' +
        '<button class="go" type="button" data-act="retry">再来一次</button>' +
        '<button class="ghost" type="button" data-act="menu">回选关</button></div>';
    }
  }

  overlay.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    audio.unlock();
    var act = btn.getAttribute('data-act');
    if (act === 'pick') {
      choice = { index: +btn.getAttribute('data-arg'), endless: 0 };
      renderOverlay();
    } else if (act === 'start') startRun();
    else if (act === 'endless') { choice = { index: 0, endless: 1 }; startRun(); }
    else if (act === 'resume') { screen = 'play'; overlay.hidden = true; pauseBtn.hidden = false; }
    else if (act === 'retry') startRun();
    else if (act === 'menu') {
      screen = 'menu';
      state = null;
      pauseBtn.hidden = true;
      bannerEl.hidden = true;
      hintEl.hidden = true;
      squadEl.textContent = '1';
      squadLabel.textContent = '小队人数';
      goalEl.textContent = '向末日开炮';
      renderOverlay();
    } else if (act === 'next') {
      if (choice.endless) choice.endless += 1;
      else if (choice.index < DGLevels.length - 1) choice.index += 1;
      else choice = { index: 0, endless: 1 };
      startRun();
    }
  });

  pauseBtn.addEventListener('click', function () {
    if (screen !== 'play') return;
    screen = 'pause';
    pauseBtn.hidden = true;
    renderOverlay();
  });

  function setDrag(e, down) {
    if (screen !== 'play' || !state) return;
    audio.unlock();
    var rect = cv.getBoundingClientRect();
    if (down) dragging = { x: e.clientX, target: state.targetX, width: rect.width };
    else dragging = null;
  }
  cv.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    setDrag(e, true);
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  });
  cv.addEventListener('pointermove', function (e) {
    if (!dragging || !state) return;
    e.preventDefault();
    var dx = e.clientX - dragging.x;
    state.targetX = DGCore.clamp(dragging.target + dx / (dragging.width * 0.46), -0.86, 0.86);
  });
  cv.addEventListener('pointerup', function () { dragging = null; });
  cv.addEventListener('pointercancel', function () { dragging = null; });

  window.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      if (screen === 'play') { screen = 'pause'; pauseBtn.hidden = true; renderOverlay(); }
      else if (screen === 'pause') { screen = 'play'; overlay.hidden = true; pauseBtn.hidden = false; }
    }
    if (e.key === ' ' && screen === 'menu') { e.preventDefault(); startRun(); }
  });
  window.addEventListener('keyup', function (e) {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
  });
  window.addEventListener('error', function (ev) {
    var el = document.getElementById('err');
    el.textContent = ev.message || '脚本错误';
    el.classList.add('on');
  });

  DGRender.load();
  resize();
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(document.getElementById('app'));
  renderOverlay();
  requestAnimationFrame(frame);
})();
