/**
 * Number Gate Runner — main loop, input, state machine + juice wiring.
 */
(function () {
  'use strict';

  var levelsData = null;
  var ui, renderer, audio, particles;
  var state = null;
  var screen = 'menu';
  var currentLevelId = 1;
  var mode = 'campaign';
  var inputQueue = { left: false, right: false };
  var lastTs = 0;
  var raf = 0;
  var maxCombo = 0;
  var seenLane = false;
  var lastLane = 1;

  function consumeInput() {
    var i = { left: inputQueue.left, right: inputQueue.right };
    inputQueue.left = false;
    inputQueue.right = false;
    return i;
  }

  function queueLane(dir) {
    if (dir < 0) inputQueue.left = true;
    else inputQueue.right = true;
  }

  function getLevelCfg(id) {
    if (id === 'endless') return levelsData.endless;
    for (var i = 0; i < levelsData.levels.length; i++) {
      if (levelsData.levels[i].id === id) return levelsData.levels[i];
    }
    return levelsData.levels[0];
  }

  function startLevel(id) {
    mode = id === 'endless' ? 'endless' : 'campaign';
    currentLevelId = id;
    var cfg = getLevelCfg(id);
    var defaults = levelsData.defaults;
    state = NGCore.createState(cfg, defaults, (Date.now() ^ (Math.random() * 1e9)) | 0);
    maxCombo = 0;
    seenLane = false;
    lastLane = 1;
    particles.clear();
    audio.ensure();
    screen = 'playing';
    ui.showPlaying();
    ui.updateHUD(state);
    lastTs = 0;
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function handleEvents(evs, playerPos) {
    for (var i = 0; i < evs.length; i++) {
      var ev = evs[i];
      var lx = playerPos ? playerPos.x : renderer.w / 2;
      var ly = playerPos ? playerPos.y - 40 : renderer.h * 0.72;
      if (ev.type === 'gate') {
        var col = NGRender.GATE_COLORS[ev.result.kind] || NGRender.GATE_COLORS[ev.gate.type] || '#fff';
        var gateX = lx;
        var gateY = ly - 80;
        // denser burst
        particles.emit(gateX, gateY, 26, col, { speed: 420, up: 120, size: 5, life: 0.55 });
        particles.emit(gateX, gateY, 10, '#ffffff', { speed: 220, up: 80, size: 3, life: 0.35, streak: true });
        if (particles.ring) particles.ring(gateX, gateY, col, ev.gate.type === 'mul' ? 180 : 120);
        particles.flyTo(gateX, gateY, lx, ly - 30, ev.result.text, col);
        particles.floatText(gateX, gateY - 28, ev.result.text, col, { size: 40, life: 0.75 });
        if (renderer.pulsePower) renderer.pulsePower(state.power);
        var flash = 0.16;
        if (ev.result.kind === 'mul' || ev.gate.type === 'mul') {
          state.shake = Math.max(state.shake || 0, 1.05);
          flash = 0.32;
        } else if (ev.result.kind === 'bomb' || ev.gate.type === 'bomb') {
          state.shake = Math.max(state.shake || 0, 1.15);
          flash = 0.4;
        } else if (ev.result.kind === 'sub' || ev.result.kind === 'div' || ev.gate.type === 'sub' || ev.gate.type === 'div') {
          state.shake = Math.max(state.shake || 0, 0.7);
          flash = 0.22;
        } else {
          state.shake = Math.max(state.shake || 0, 0.55);
        }
        if (renderer.addFlash) renderer.addFlash(col, flash);
        audio.gate(ev.result.kind || ev.gate.type);
      } else if (ev.type === 'kill') {
        var ec = NGRender.ENEMY_COLORS[ev.enemy.enemyKind] || '#ff6b6b';
        particles.burst(lx, ly - 30, ec);
        particles.addCorpse(lx, ly - 24, ec, ev.enemy.hp, ev.enemy.enemyKind);
        particles.floatText(lx, ly - 70, '+' + ev.result.scoreGain, '#fde68a', { size: 36 });
        if (ev.result.combo >= 2) {
          particles.floatText(lx, ly - 108, 'COMBO ×' + ev.result.combo, '#fb923c', { size: 30, life: 0.95 });
          if (renderer.comboFlash != null) renderer.comboFlash = 1;
        }
        state.shake = Math.max(state.shake || 0, 0.7 + Math.min(0.55, ev.result.combo * 0.08));
        if (renderer.addFlash) renderer.addFlash('#fff7ed', ev.enemy.enemyKind === 'boss' ? 0.4 : 0.2);
        audio.kill(ev.result.combo);
        if (ev.result.combo > maxCombo) maxCombo = ev.result.combo;
      } else if (ev.type === 'combat') {
        if (ev.result.outcome === 'blocked') {
          particles.emit(lx, ly, 20, '#2dd4bf', { speed: 260, streak: true });
          if (particles.ring) particles.ring(lx, ly, '#2dd4bf', 110);
          particles.floatText(lx, ly - 36, 'BLOCK', '#5eead4', { size: 32 });
          state.shake = Math.max(state.shake || 0, 0.5);
          if (renderer.addFlash) renderer.addFlash('#5eead4', 0.2);
          audio.gate('shield');
        } else {
          particles.emit(lx, ly, 30, '#ef4444', { speed: 340, up: 40, size: 5 });
          if (particles.ring) particles.ring(lx, ly, '#ef4444', 150);
          particles.floatText(lx, ly - 36, '-' + ev.result.damage, '#fecaca', { size: 36 });
          state.shake = Math.max(state.shake || 0, 1.05);
          if (renderer.addFlash) renderer.addFlash('#ef4444', 0.42);
          audio.hurt();
        }
      } else if (ev.type === 'win') {
        audio.win();
        state.shake = Math.max(state.shake || 0, 0.6);
      } else if (ev.type === 'lose') {
        audio.lose();
        state.shake = Math.max(state.shake || 0, 1.1);
      } else if (ev.type === 'boss') {
        particles.floatText(renderer.w / 2, renderer.h * 0.34, 'BOSS', '#e9d5ff', { size: 54, life: 1.15 });
        if (particles.ring) particles.ring(renderer.w / 2, renderer.h * 0.4, '#c084fc', 220);
        state.shake = Math.max(state.shake || 0, 0.85);
        if (renderer.addFlash) renderer.addFlash('#c084fc', 0.28);
      }
    }
  }

  function frame(ts) {
    raf = requestAnimationFrame(frame);
    if (!lastTs) lastTs = ts;
    var dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;

    if (screen === 'playing' && state) {
      var input = consumeInput();
      NGCore.step(state, dt, input);
      if (state.combo > maxCombo) maxCombo = state.combo;
      state._maxCombo = maxCombo;
      if (seenLane && state.targetLane !== lastLane && audio.swish) audio.swish();
      seenLane = true;
      lastLane = state.targetLane;

      var playerPos = renderer.render(state, particles, dt);
      particles.update(dt);
      handleEvents(state.events, playerPos);
      ui.updateHUD(state);

      if (state.status === 'won') {
        screen = 'end';
        var hasNext = mode === 'campaign' && typeof currentLevelId === 'number' && currentLevelId < levelsData.levels.length;
        ui.showEnd(true, state, hasNext);
      } else if (state.status === 'lost') {
        screen = 'end';
        ui.showEnd(false, state, false);
      }
    } else if (screen === 'paused' && state) {
      renderer.render(state, particles, 0);
    } else if (screen === 'menu') {
      if (!state) {
        var cfg = getLevelCfg(1);
        state = NGCore.createState(cfg, levelsData.defaults, 42);
        state.status = 'idle';
      }
      state.distance += 50 * dt;
      state.speed = 140;
      state.time += dt;
      while (state.nextGateAt < state.distance + 650) {
        var row = NGCore.spawnGateRow(state.levelCfg, state.nextGateAt, state.idGen, state.rnd);
        for (var g = 0; g < row.length; g++) state.entities.push(row[g]);
        state.nextGateAt += 180;
      }
      state.entities = state.entities.filter(function (e) { return e.z - state.distance > -50; });
      renderer.render(state, particles, dt);
      particles.update(dt);
    }
  }

  function pause() {
    if (screen !== 'playing') return;
    screen = 'paused';
    ui.showPause();
    audio.ui();
  }

  function resume() {
    if (screen !== 'paused') return;
    screen = 'playing';
    ui.hidePause();
    lastTs = 0;
    audio.ui();
  }

  function toMenu() {
    screen = 'menu';
    state = null;
    particles.clear();
    ui.showMenu();
    audio.ui();
  }

  function bindInput() {
    window.addEventListener('keydown', function (e) {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        e.preventDefault();
        queueLane(-1);
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        e.preventDefault();
        queueLane(1);
      } else if (e.code === 'KeyP' || e.code === 'Escape') {
        e.preventDefault();
        if (screen === 'playing') pause();
        else if (screen === 'paused') resume();
      } else if (e.code === 'Space') {
        if (screen === 'menu') {
          e.preventDefault();
          startLevel(ui.selectedLevel || 1);
        } else if (screen === 'paused') {
          e.preventDefault();
          resume();
        }
      }
    });

    var canvas = ui.getCanvas();
    var sx = 0, sy = 0, active = false;
    canvas.addEventListener('touchstart', function (e) {
      var t = e.changedTouches[0];
      sx = t.clientX; sy = t.clientY; active = true;
    }, { passive: true });
    canvas.addEventListener('touchend', function (e) {
      if (!active) return;
      active = false;
      var t = e.changedTouches[0];
      var dx = t.clientX - sx;
      var dy = t.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return;
      if (Math.abs(dx) > Math.abs(dy)) queueLane(dx < 0 ? -1 : 1);
    }, { passive: true });
  }

  function boot(data) {
    levelsData = data;
    var app = document.getElementById('app');
    ui = new NGUI(app, {
      onPlay: function (id) { startLevel(id); },
      onEndless: function () { startLevel('endless'); },
      onPause: pause,
      onResume: resume,
      onRestart: function () { startLevel(currentLevelId); },
      onMenu: toMenu,
      onNext: function () {
        if (typeof currentLevelId === 'number') startLevel(currentLevelId + 1);
      },
      onMute: function () { ui.setMuted(audio.toggleMute()); },
      onLane: queueLane
    });
    ui.fillLevels(levelsData.levels);
    renderer = new NGRender(ui.getCanvas());
    renderer.resize();
    window.addEventListener('resize', function () { renderer.resize(); });
    audio = new NGAudio();
    particles = new NGParticles();
    bindInput();
    ui.showMenu();
    raf = requestAnimationFrame(frame);

    window.addEventListener('pointerdown', function once() {
      audio.ensure();
      window.removeEventListener('pointerdown', once);
    });
  }

  function loadLevels() {
    if (window.__NG_LEVELS__) {
      boot(window.__NG_LEVELS__);
      return;
    }
    fetch('data/levels.json')
      .then(function (r) { return r.json(); })
      .then(boot)
      .catch(function () {
        document.getElementById('app').innerHTML = '<p style="color:#fff;padding:2rem">无法加载 levels.json</p>';
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadLevels);
  } else {
    loadLevels();
  }
})();
