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
        particles.emit(gateX, gateY, 28, col, { speed: 300, up: 140, size: 5 });
        particles.emit(gateX, gateY, 12, '#ffffff', { speed: 160, up: 100, size: 3, life: 0.4 });
        // number flies to player
        particles.flyTo(gateX, gateY, lx, ly + 10, ev.result.text, col);
        particles.floatText(gateX, gateY - 20, ev.result.text, col, { size: 32, life: 0.7 });
        if (renderer.pulsePower) renderer.pulsePower(state.power);
        // stronger shake on big ops
        if (ev.result.kind === 'mul' || ev.gate.type === 'mul') {
          state.shake = Math.max(state.shake || 0, 0.85);
        } else if (ev.result.kind === 'bomb' || ev.gate.type === 'bomb') {
          state.shake = Math.max(state.shake || 0, 1.0);
        } else {
          state.shake = Math.max(state.shake || 0, 0.45);
        }
        audio.gate(ev.result.kind || ev.gate.type);
      } else if (ev.type === 'kill') {
        var ec = NGRender.ENEMY_COLORS[ev.enemy.enemyKind] || '#ff6b6b';
        particles.burst(lx, ly - 20, ec);
        particles.addCorpse(lx, ly - 20, ec, ev.enemy.hp, ev.enemy.enemyKind);
        particles.floatText(lx, ly - 55, '+' + ev.result.scoreGain, '#fbbf24', { size: 30 });
        if (ev.result.combo >= 2) {
          particles.floatText(lx, ly - 90, 'COMBO ×' + ev.result.combo, '#f97316', { size: 26, life: 0.9 });
          if (renderer.comboFlash != null) renderer.comboFlash = 1;
        }
        state.shake = Math.max(state.shake || 0, 0.55 + Math.min(0.5, ev.result.combo * 0.08));
        audio.kill(ev.result.combo);
        if (ev.result.combo > maxCombo) maxCombo = ev.result.combo;
      } else if (ev.type === 'combat') {
        if (ev.result.outcome === 'blocked') {
          particles.emit(lx, ly, 18, '#14b8a6', { speed: 220 });
          particles.floatText(lx, ly - 30, 'BLOCK!', '#14b8a6', { size: 28 });
          state.shake = Math.max(state.shake || 0, 0.4);
          audio.gate('shield');
        } else {
          particles.emit(lx, ly, 26, '#ef4444', { speed: 280, up: 60 });
          particles.floatText(lx, ly - 30, '-' + ev.result.damage, '#ef4444', { size: 30 });
          state.shake = Math.max(state.shake || 0, 0.9);
          audio.hurt();
        }
      } else if (ev.type === 'win') {
        audio.win();
        state.shake = Math.max(state.shake || 0, 0.6);
      } else if (ev.type === 'lose') {
        audio.lose();
        state.shake = Math.max(state.shake || 0, 1.1);
      } else if (ev.type === 'boss') {
        particles.floatText(renderer.w / 2, renderer.h * 0.28, 'BOSS!', '#c084fc', { size: 42, life: 1.2 });
        state.shake = Math.max(state.shake || 0, 0.7);
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
