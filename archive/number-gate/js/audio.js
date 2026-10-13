/**
 * Layered Web Audio SFX — punchier impact for ad-grade juice.
 */
(function (global) {
  'use strict';

  function AudioEngine() {
    this.ctx = null;
    this.muted = false;
    this._unlocked = false;
  }

  AudioEngine.prototype.ensure = function () {
    if (!this.ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this._unlocked = true;
    return this.ctx;
  };

  AudioEngine.prototype.setMuted = function (m) {
    this.muted = !!m;
  };

  AudioEngine.prototype.toggleMute = function () {
    this.muted = !this.muted;
    return this.muted;
  };

  AudioEngine.prototype._tone = function (freq, dur, type, gain, slideTo) {
    if (this.muted) return;
    var ctx = this.ensure();
    if (!ctx) return;
    var t0 = ctx.currentTime;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t0 + dur);
    g.gain.setValueAtTime(gain || 0.08, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  };

  AudioEngine.prototype._noise = function (dur, gain, bpFreq) {
    if (this.muted) return;
    var ctx = this.ensure();
    if (!ctx) return;
    var n = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, n, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = bpFreq || 800;
    filter.Q.value = 0.8;
    var g = ctx.createGain();
    var t0 = ctx.currentTime;
    g.gain.setValueAtTime(gain || 0.12, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  };

  AudioEngine.prototype._thump = function () {
    this._tone(70, 0.14, 'sine', 0.16, 36);
  };

  AudioEngine.prototype.swish = function () {
    this._noise(0.07, 0.05, 1400);
    this._tone(520, 0.06, 'triangle', 0.04, 880);
  };

  AudioEngine.prototype.gate = function (kind) {
    var self = this;
    this._thump();
    if (kind === 'mul') {
      this._tone(380, 0.08, 'square', 0.08, 520);
      setTimeout(function () { self._tone(640, 0.16, 'square', 0.1, 1100); }, 40);
      setTimeout(function () { self._tone(920, 0.12, 'triangle', 0.05); }, 90);
      this._noise(0.08, 0.08, 1400);
    } else if (kind === 'add') {
      this._tone(440, 0.1, 'square', 0.08, 760);
      this._tone(660, 0.14, 'triangle', 0.06, 980);
    } else if (kind === 'shield' || kind === 'scoreMul' || kind === 'shieldBreak') {
      this._tone(520, 0.1, 'sine', 0.09, 980);
      setTimeout(function () { self._tone(780, 0.14, 'sine', 0.07); }, 50);
      this._noise(0.06, 0.04, 1800);
    } else if (kind === 'bomb') {
      this._noise(0.22, 0.16, 180);
      this._tone(110, 0.32, 'sawtooth', 0.12, 42);
    } else if (kind === 'sub' || kind === 'div') {
      this._tone(180, 0.18, 'sawtooth', 0.08, 70);
      this._noise(0.1, 0.06, 320);
    } else {
      this._tone(360, 0.1, 'square', 0.06);
    }
  };

  AudioEngine.prototype.kill = function (combo) {
    var f = 260 + Math.min(520, (combo || 0) * 50);
    this._thump();
    this._noise(0.12, 0.12, 700);
    this._tone(f, 0.12, 'square', 0.11, f * 1.9);
    var self = this;
    setTimeout(function () { self._tone(f * 1.5, 0.1, 'triangle', 0.07); }, 30);
    if ((combo || 0) >= 3) {
      setTimeout(function () { self._tone(f * 2.1, 0.16, 'sine', 0.06); }, 70);
    }
  };

  AudioEngine.prototype.hurt = function () {
    this._noise(0.15, 0.1, 180);
    this._tone(130, 0.3, 'sawtooth', 0.1, 55);
  };

  AudioEngine.prototype.win = function () {
    var self = this;
    [523, 659, 784, 1046].forEach(function (f, i) {
      setTimeout(function () { self._tone(f, 0.2, 'sine', 0.08); }, i * 110);
    });
  };

  AudioEngine.prototype.lose = function () {
    this._tone(200, 0.4, 'sawtooth', 0.09, 60);
    this._noise(0.25, 0.08, 150);
  };

  AudioEngine.prototype.shoot = function (pellets) {
    var n = Math.min(3, pellets || 1);
    this._noise(0.04, 0.05 + n * 0.015, 2200);
    this._tone(880 + n * 40, 0.04, 'square', 0.035, 420);
  };

  AudioEngine.prototype.ui = function () {
    this._tone(720, 0.05, 'sine', 0.04);
  };

  global.NGAudio = AudioEngine;
})(typeof window !== 'undefined' ? window : global);
