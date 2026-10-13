/**
 * Number Gate — main loop: weapon upgrade × zombie shooter.
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
  var touchStartX = 0;

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
    particles.clear();
    audio.ensure();
    screen = 'playing';
    ui.showPlaying();
    ui.updateHUD(state);
    lastTs = 0;
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function projectEventPos(ev) {
    if (!renderer || !state) return { x: renderer.w / 2, y: renderer.h * 0.5 };
    var lane = ev.lane != null ? ev.lane : state.laneVisual;
    var rel = ev.worldZ != null ? ev.worldZ - state.distance : 40;
    var p = renderer.project(lane, Math.max(0, rel), state.lanes);
    return { x: p.x, y: p.y - 40 * p.scale };
  }

  function handleEvents(evs, playerPos) {
    for (var i = 0; i < evs.length; i++) {
      var ev = evs[i];
      var lx = playerPos ? playerPos.x : renderer.w / 2;
      var ly = playerPos ? playerPos.y : renderer.h * 0.75;

      if (ev.type === 'gate' || ev.type === 'pickup') {
        var col = NGRender.GATE_COLORS[ev.result.kind] || NGRender.GATE_COLORS[ev.gate.type] || '#fff';
        var pos = projectEventPos({ lane: ev.gate.lane, worldZ: ev.gate.z });
        particles.emit(pos.x, pos.y, 22, col, { speed: 400, up: 100, size: 5, life: 0.5 });
        particles.emit(pos.x, pos.y, 8, '#ffffff', { speed: 200, up: 60, size: 3, life: 0.3, streak: true });
        if (particles.ring) particles.ring(pos.x, pos.y, col, 140);
        particles.floatText(pos.x, pos.y - 30, ev.result.text, col, { size: 36, life: 0.7 });
        if (renderer.pulsePower) renderer.pulsePower();
        audio.gate(ev.result.kind === 'pickup' ? 'add' : ev.result.kind);
      } else if (ev.type === 'shoot') {
        if (audio.shoot) audio.shoot(ev.pellets);
      } else if (ev.type === 'hit') {
        var hp = projectEventPos(ev);
        particles.emit(hp.x, hp.y, 6, '#fbbf24', { speed: 180, size: 3, life: 0.25 });
      } else if (ev.type === 'kill') {
        var kp = projectEventPos(ev);
        particles.emit(kp.x, kp.y, 28, '#22c55e', { speed: 380, up: 140, size: 6, life: 0.55 });
        particles.emit(kp.x, kp.y, 12, '#ef4444', { speed: 260, size: 4, life: 0.4 });
        if (particles.ring) particles.ring(kp.x, kp.y, '#4ade80', 100);
        particles.floatText(kp.x, kp.y - 20, '+' + ev.points, '#4ade80', { size: 22, life: 0.55 });
        if (particles.corpse) {
          particles.corpse(kp.x, kp.y, ev.zombie.kind || 'grunt');
        }
        audio.kill(state.combo);
      } else if (ev.type === 'death') {
        var dp = projectEventPos(ev);
        particles.emit(dp.x, dp.y, 40, '#ef4444', { speed: 420, up: 160, size: 7, life: 0.7 });
        audio.lose();
      } else if (ev.type === 'win') {
        audio.win();
      }
    }
  }

  function endGame() {
    screen = 'end';
    var won = state.status === 'won';
    var hasNext = false;
    if (won && mode === 'campaign') {
      var nextId = (typeof currentLevelId === 'number' ? currentLevelId : 1) + 1;
      hasNext = !!getLevelCfg(nextId) && getLevelCfg(nextId).id === nextId;
    }
    ui.showEnd(won, state, hasNext);
  }

  function frame(ts) {
    raf = requestAnimationFrame(frame);
    if (!lastTs) lastTs = ts;
    var dt = Math.min(50, ts - lastTs);
    lastTs = ts;

    if (screen === 'playing' && state) {
      var evs = NGCore.step(state, dt, consumeInput());
      if (particles.update) particles.update(dt);
      var playerPos = renderer.render(state, particles);
      handleEvents(evs, playerPos);
      ui.updateHUD(state);
      if (state.status === 'won' || state.status === 'lost') {
        endGame();
      }
    } else if (screen === 'pause' && state) {
      renderer.render(state, particles);
    } else if (screen === 'end' && state) {
      if (particles.update) particles.update(dt);
      renderer.render(state, particles);
    } else if (screen === 'menu') {
      // idle preview: empty corridor vibe
      if (!state) {
        var cfg = getLevelCfg(1);
        state = NGCore.createState(cfg, levelsData.defaults, 42);
        state.status = 'menu';
      }
      // gentle scroll for menu backdrop
      state.distance += 40 * (dt / 1000);
      state.time += dt;
      renderer.render(state, particles);
    }
  }

  function pause() {
    if (screen !== 'playing') return;
    screen = 'pause';
    ui.showPause();
  }

  function resume() {
    if (screen !== 'pause') return;
    screen = 'playing';
    ui.hidePause();
    lastTs = 0;
  }

  function toMenu() {
    screen = 'menu';
    state = null;
    ui.showMenu();
  }

  function init() {
    levelsData = window.__NG_LEVELS__;
    if (!levelsData) {
      console.error('Missing __NG_LEVELS__');
      return;
    }

    ui = new NGUI(document.getElementById('app'), {
      onPlay: function (id) { startLevel(id); },
      onEndless: function () { startLevel('endless'); },
      onPause: pause,
      onResume: resume,
      onRestart: function () { startLevel(currentLevelId); },
      onMenu: toMenu,
      onNext: function () {
        var nextId = (typeof currentLevelId === 'number' ? currentLevelId : 1) + 1;
        if (getLevelCfg(nextId) && getLevelCfg(nextId).id === nextId) startLevel(nextId);
        else toMenu();
      },
      onMute: function () {
        ui.setMuted(audio.toggleMute());
      },
      onLane: function (dir) {
        if (screen === 'playing') queueLane(dir);
      }
    });

    ui.fillLevels(levelsData.levels);
    renderer = new NGRender.Renderer(ui.getCanvas());
    particles = new NGParticles();
    audio = new NGAudio();

    window.addEventListener('resize', function () {
      renderer.resize();
    });

    window.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        queueLane(-1);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        queueLane(1);
      } else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        e.preventDefault();
        if (screen === 'playing') pause();
        else if (screen === 'pause') resume();
      } else if (e.key === ' ' || e.key === 'Enter') {
        if (screen === 'menu') {
          e.preventDefault();
          startLevel(ui.selectedLevel || 1);
        } else if (screen === 'pause') {
          e.preventDefault();
          resume();
        }
      }
    });

    var canvas = ui.getCanvas();
    canvas.addEventListener(
      'touchstart',
      function (e) {
        if (e.touches[0]) touchStartX = e.touches[0].clientX;
      },
      { passive: true }
    );
    canvas.addEventListener(
      'touchend',
      function (e) {
        var t = e.changedTouches[0];
        if (!t) return;
        var dx = t.clientX - touchStartX;
        if (Math.abs(dx) > 30) queueLane(dx < 0 ? -1 : 1);
      },
      { passive: true }
    );

    ui.showMenu();
    raf = requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
