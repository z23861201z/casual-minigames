/**
 * Tiny Web Audio juice for Sand Bucket. No samples.
 */
(function (global) {
  'use strict';

  function createAudio() {
    var ctx = null;
    var muted = false;

    function ac() {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!ctx) ctx = new AC();
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }

    function tone(freq, dur, type, gain, slide) {
      if (muted) return;
      var c = ac();
      if (!c) return;
      var o = c.createOscillator();
      var g = c.createGain();
      o.type = type || 'triangle';
      o.frequency.setValueAtTime(freq, c.currentTime);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(48, freq + slide), c.currentTime + dur);
      g.gain.setValueAtTime(gain || 0.045, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
      o.connect(g);
      g.connect(c.destination);
      o.start();
      o.stop(c.currentTime + dur + 0.02);
    }

    return {
      unlock: function () { ac(); },
      toggle: function () { muted = !muted; return muted; },
      get muted() { return muted; },
      tap: function () { tone(520, 0.04, 'square', 0.03); },
      catch: function (combo) { tone(640 + Math.min(combo, 24) * 18, 0.05, 'triangle', 0.04, 160); },
      full: function () { tone(880, 0.08, 'square', 0.04, 120); },
      merge: function () {
        tone(523, 0.1, 'square', 0.05, 80);
        setTimeout(function () { tone(784, 0.14, 'square', 0.05, 140); }, 80);
      },
      deliver: function () { tone(698, 0.09, 'triangle', 0.04, 200); },
      spill: function () { tone(196, 0.14, 'sawtooth', 0.04, -70); },
      win: function () {
        tone(523, 0.1, 'square', 0.05);
        setTimeout(function () { tone(659, 0.1, 'square', 0.05); }, 110);
        setTimeout(function () { tone(880, 0.22, 'square', 0.05); }, 220);
      },
      lose: function () { tone(180, 0.28, 'sawtooth', 0.05, -100); }
    };
  }

  global.SBAudio = { create: createAudio };
})(typeof window !== 'undefined' ? window : global);
