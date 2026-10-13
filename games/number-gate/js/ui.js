/**
 * DOM UI — weapon/zombie Number Gate menus, HUD, overlays.
 */
(function (global) {
  'use strict';

  function UI(root, handlers) {
    this.root = root;
    this.handlers = handlers || {};
    this.els = {};
    this._weaponPopTimer = null;
    this._build();
  }

  UI.prototype._build = function () {
    var root = this.root;
    root.innerHTML =
      '<div class="ng-shell">' +
        '<canvas id="ng-canvas"></canvas>' +
        '<div class="ng-hud" id="ng-hud" hidden>' +
          '<div class="ng-hud-top">' +
            '<button type="button" class="ng-icon-btn" id="ng-pause" aria-label="暂停">❚❚</button>' +
            '<div class="ng-hud-stats">' +
              '<div class="ng-stat ng-stat-power"><span class="ng-stat-l">武器</span><span id="hud-weapon">Lv.1</span></div>' +
              '<div class="ng-stat"><span class="ng-stat-l">火力</span><span id="hud-fire">1</span></div>' +
              '<div class="ng-stat"><span class="ng-stat-l">分数</span><span id="hud-score">0</span></div>' +
              '<div class="ng-stat"><span class="ng-stat-l">击杀</span><span id="hud-kills">0</span></div>' +
            '</div>' +
            '<button type="button" class="ng-icon-btn" id="ng-mute" aria-label="静音">🔊</button>' +
          '</div>' +
          '<div class="ng-goal" id="ng-goal" hidden><div class="ng-goal-fill" id="ng-goal-fill"></div></div>' +
          '<div class="ng-float-badges">' +
            '<span id="hud-combo" class="ng-badge ng-badge-mult" hidden>连击</span>' +
            '<span id="hud-dist" class="ng-badge">0m</span>' +
          '</div>' +
        '</div>' +
        '<div class="ng-touch" id="ng-touch" hidden>' +
          '<button type="button" class="ng-lane-btn" id="btn-left" aria-label="向左">◀</button>' +
          '<button type="button" class="ng-lane-btn" id="btn-right" aria-label="向右">▶</button>' +
        '</div>' +
        '<div class="ng-overlay" id="ng-menu">' +
          '<div class="ng-card">' +
            '<a class="ng-back" href="../../index.html">← 合集首页</a>' +
            '<div class="ng-kicker">伪 3D · 武器升级 · 清僵尸</div>' +
            '<div class="ng-logo">NUMBER GATE</div>' +
            '<p class="ng-tagline">自动冲刺撞数字门升级武器，向眼前成群僵尸扫射。被僵尸碰到才会失败。</p>' +
            '<div class="ng-pills"><span>+ 武器</span><span>× 火力</span><span>射击</span><span>清怪</span></div>' +
            '<div class="ng-menu-actions">' +
              '<button type="button" class="ng-btn ng-btn-primary" id="btn-play">▶ 开始战役</button>' +
              '<button type="button" class="ng-btn" id="btn-endless">∞ 无尽模式</button>' +
            '</div>' +
            '<div class="ng-level-picker" id="level-picker"></div>' +
            '<p class="ng-help">键盘 ← → 换道 · 滑动或点按钮 · P / Esc 暂停</p>' +
          '</div>' +
        '</div>' +
        '<div class="ng-overlay" id="ng-pause-menu" hidden>' +
          '<div class="ng-card">' +
            '<div class="ng-logo sm">暂停</div>' +
            '<p class="ng-tagline">喘口气，继续扫射</p>' +
            '<button type="button" class="ng-btn ng-btn-primary" id="btn-resume">继续游戏</button>' +
            '<button type="button" class="ng-btn" id="btn-restart">重开本关</button>' +
            '<button type="button" class="ng-btn" id="btn-to-menu">回主菜单</button>' +
          '</div>' +
        '</div>' +
        '<div class="ng-overlay" id="ng-end" hidden>' +
          '<div class="ng-card">' +
            '<div class="ng-logo sm" id="end-title">通关！</div>' +
            '<p class="ng-tagline" id="end-reason"></p>' +
            '<div class="ng-end-stats" id="end-stats"></div>' +
            '<button type="button" class="ng-btn ng-btn-primary" id="btn-again">再来一次</button>' +
            '<button type="button" class="ng-btn" id="btn-next" hidden>下一关 →</button>' +
            '<button type="button" class="ng-btn" id="btn-end-menu">回主菜单</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    var ids = [
      'ng-canvas', 'ng-hud', 'ng-touch', 'ng-menu', 'ng-pause-menu', 'ng-end',
      'hud-score', 'hud-dist', 'hud-weapon', 'hud-fire', 'hud-kills', 'hud-combo',
      'ng-goal', 'ng-goal-fill',
      'ng-pause', 'ng-mute', 'btn-left', 'btn-right',
      'btn-play', 'btn-endless', 'level-picker',
      'btn-resume', 'btn-restart', 'btn-to-menu',
      'end-title', 'end-reason', 'end-stats', 'btn-again', 'btn-next', 'btn-end-menu'
    ];
    for (var i = 0; i < ids.length; i++) {
      this.els[ids[i]] = document.getElementById(ids[i]);
    }

    var self = this;
    this.els['btn-play'].onclick = function () { self.handlers.onPlay && self.handlers.onPlay(self.selectedLevel || 1); };
    this.els['btn-endless'].onclick = function () { self.handlers.onEndless && self.handlers.onEndless(); };
    this.els['ng-pause'].onclick = function () { self.handlers.onPause && self.handlers.onPause(); };
    this.els['ng-mute'].onclick = function () { self.handlers.onMute && self.handlers.onMute(); };
    this.els['btn-resume'].onclick = function () { self.handlers.onResume && self.handlers.onResume(); };
    this.els['btn-restart'].onclick = function () { self.handlers.onRestart && self.handlers.onRestart(); };
    this.els['btn-to-menu'].onclick = function () { self.handlers.onMenu && self.handlers.onMenu(); };
    this.els['btn-again'].onclick = function () { self.handlers.onRestart && self.handlers.onRestart(); };
    this.els['btn-next'].onclick = function () { self.handlers.onNext && self.handlers.onNext(); };
    this.els['btn-end-menu'].onclick = function () { self.handlers.onMenu && self.handlers.onMenu(); };

    function pulse(dir) {
      return function (ev) {
        ev.preventDefault();
        self.handlers.onLane && self.handlers.onLane(dir);
      };
    }
    this.els['btn-left'].addEventListener('pointerdown', pulse(-1));
    this.els['btn-right'].addEventListener('pointerdown', pulse(1));

    this.selectedLevel = 1;
    this._lastWeapon = 0;
  };

  UI.prototype.fillLevels = function (levels) {
    var box = this.els['level-picker'];
    box.innerHTML = '';
    var self = this;
    levels.forEach(function (lv) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'ng-level-chip' + (lv.id === self.selectedLevel ? ' active' : '');
      b.textContent = lv.id + '. ' + lv.name;
      b.onclick = function () {
        self.selectedLevel = lv.id;
        var chips = box.querySelectorAll('.ng-level-chip');
        for (var i = 0; i < chips.length; i++) chips[i].classList.remove('active');
        b.classList.add('active');
      };
      box.appendChild(b);
    });
  };

  UI.prototype.showMenu = function () {
    this.els['ng-menu'].hidden = false;
    this.els['ng-pause-menu'].hidden = true;
    this.els['ng-end'].hidden = true;
    this.els['ng-hud'].hidden = true;
    this.els['ng-touch'].hidden = true;
  };

  UI.prototype.showPlaying = function () {
    this.els['ng-menu'].hidden = true;
    this.els['ng-pause-menu'].hidden = true;
    this.els['ng-end'].hidden = true;
    this.els['ng-hud'].hidden = false;
    this.els['ng-touch'].hidden = false;
  };

  UI.prototype.showPause = function () {
    this.els['ng-pause-menu'].hidden = false;
  };

  UI.prototype.hidePause = function () {
    this.els['ng-pause-menu'].hidden = true;
  };

  UI.prototype.showEnd = function (won, state, hasNext) {
    this.els['ng-end'].hidden = false;
    this.els['ng-touch'].hidden = true;
    this.els['end-title'].textContent = won ? '通关！' : '被僵尸碰到';
    this.els['end-title'].className = 'ng-logo sm' + (won ? ' win' : ' lose');
    var reason = '';
    if (!won && state.failReason === 'zombie_contact') {
      reason = '死因：僵尸冲到面前碰到了你。升级武器、清出通道再冲！';
    } else if (won) {
      reason = '走廊清空，武器等级 ' + state.weaponLevel;
    }
    this.els['end-reason'].textContent = reason;
    var ws = NGCore.weaponStats(state.weaponLevel);
    this.els['end-stats'].innerHTML =
      '<div>分数 <b>' + Math.floor(state.score) + '</b></div>' +
      '<div>武器 <b>Lv.' + ws.level + '</b></div>' +
      '<div>火力 <b>' + ws.firepower + '</b></div>' +
      '<div>击杀 <b>' + state.kills + '</b></div>' +
      '<div>距离 <b>' + Math.floor(state.distance) + 'm</b></div>' +
      '<div>最高连击 <b>' + (state.maxCombo || 0) + '</b></div>';
    this.els['btn-next'].hidden = !won || !hasNext;
  };

  UI.prototype.updateHUD = function (state) {
    var hud = NGCore.getHUD(state);
    this.els['hud-score'].textContent = hud.score;
    this.els['hud-kills'].textContent = hud.kills;
    this.els['hud-dist'].textContent = hud.distance + 'm';
    this.els['hud-fire'].textContent = hud.firepower + ' (' + hud.pellets + '发)';

    var wEl = this.els['hud-weapon'];
    var wStr = 'Lv.' + hud.weaponLevel;
    if (hud.weaponLevel !== this._lastWeapon) {
      wEl.textContent = wStr;
      wEl.classList.remove('pop');
      void wEl.offsetWidth;
      wEl.classList.add('pop');
      var self = this;
      clearTimeout(this._weaponPopTimer);
      this._weaponPopTimer = setTimeout(function () {
        wEl.classList.remove('pop');
      }, 220);
      this._lastWeapon = hud.weaponLevel;
    } else {
      wEl.textContent = wStr;
    }

    var goal = this.els['ng-goal'];
    var fill = this.els['ng-goal-fill'];
    if (goal && fill) {
      if (state.endless || !state.targetDistance) {
        goal.hidden = true;
      } else {
        goal.hidden = false;
        fill.style.width = (hud.progress * 100).toFixed(1) + '%';
      }
    }

    if (hud.combo >= 3) {
      this.els['hud-combo'].hidden = false;
      this.els['hud-combo'].textContent = '连击 ×' + hud.combo;
    } else {
      this.els['hud-combo'].hidden = true;
    }
  };

  UI.prototype.setMuted = function (m) {
    this.els['ng-mute'].textContent = m ? '🔇' : '🔊';
  };

  UI.prototype.getCanvas = function () {
    return this.els['ng-canvas'];
  };

  global.NGUI = UI;
})(typeof window !== 'undefined' ? window : global);
