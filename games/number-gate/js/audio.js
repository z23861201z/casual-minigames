/**
 * Web Audio synth SFX for Number Gate Runner.
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

  AudioEngine.prototype.gate = function (kind) {
    if (kind === 'mul' || kind === 'add') this._tone(420, 0.12, 'square', 0.07, 680);
    else if (kind === 'shield' || kind === 'scoreMul') this._tone(520, 0.14, 'sine', 0.08, 880);
    else if (kind === 'bomb' || kind === 'sub' || kind === 'div') this._tone(180, 0.18, 'sawtooth', 0.06, 80);
    else this._tone(360, 0.1, 'square', 0.05);
  };

  AudioEngine.prototype.kill = function (combo) {
    var f = 300 + Math.min(400, (combo || 0) * 40);
    this._tone(f, 0.16, 'square', 0.09, f * 1.6);
    var self = this;
    setTimeout(function () { self._tone(f * 1.3, 0.1, 'triangle', 0.05); }, 40);
  };

  AudioEngine.prototype.hurt = function () {
    this._tone(140, 0.25, 'sawtooth', 0.09, 60);
  };

  AudioEngine.prototype.win = function () {
    var self = this;
    [523, 659, 784, 1046].forEach(function (f, i) {
      setTimeout(function () { self._tone(f, 0.18, 'sine', 0.07); }, i * 120);
    });
  };

  AudioEngine.prototype.lose = function () {
    this._tone(220, 0.35, 'sawtooth', 0.08, 70);
  };

  AudioEngine.prototype.ui = function () {
    this._tone(660, 0.06, 'sine', 0.04);
  };

  global.NGAudio = AudioEngine;
})(typeof window !== 'undefined' ? window : global);
