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

  AudioEngine.prototype.gate = function (kind) {
    var self = this;
    if (kind === 'mul') {
      this._tone(380, 0.08, 'square', 0.07, 520);
      setTimeout(function () { self._tone(640, 0.14, 'square', 0.09, 980); }, 40);
      this._noise(0.06, 0.06, 1200);
    } else if (kind === 'add') {
      this._tone(440, 0.1, 'square', 0.07, 720);
      this._tone(660, 0.12, 'triangle', 0.05, 880);
    } else if (kind === 'shield' || kind === 'scoreMul' || kind === 'shieldBreak') {
      this._tone(520, 0.1, 'sine', 0.08, 900);
      setTimeout(function () { self._tone(780, 0.12, 'sine', 0.06); }, 50);
    } else if (kind === 'bomb') {
      this._noise(0.2, 0.14, 200);
      this._tone(120, 0.28, 'sawtooth', 0.1, 50);
    } else if (kind === 'sub' || kind === 'div') {
      this._tone(200, 0.16, 'sawtooth', 0.07, 90);
      this._noise(0.08, 0.05, 400);
    } else {
      this._tone(360, 0.1, 'square', 0.05);
    }
  };

  AudioEngine.prototype.kill = function (combo) {
    var f = 280 + Math.min(480, (combo || 0) * 45);
    this._noise(0.1, 0.1, 600);
    this._tone(f, 0.12, 'square', 0.1, f * 1.8);
    var self = this;
    setTimeout(function () { self._tone(f * 1.4, 0.1, 'triangle', 0.06); }, 35);
    if (combo >= 3) {
      setTimeout(function () { self._tone(f * 2, 0.14, 'sine', 0.05); }, 70);
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

  AudioEngine.prototype.ui = function () {
    this._tone(720, 0.05, 'sine', 0.04);
  };

  global.NGAudio = AudioEngine;
})(typeof window !== 'undefined' ? window : global);
