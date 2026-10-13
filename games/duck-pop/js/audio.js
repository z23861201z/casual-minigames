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
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, c.currentTime);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), c.currentTime + dur);
      g.gain.setValueAtTime(gain || 0.04, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
      o.connect(g); g.connect(c.destination);
      o.start(); o.stop(c.currentTime + dur + 0.02);
    }
    return {
      unlock: function () { ac(); },
      tap: function () { tone(660, 0.04, 'square', 0.03); },
      shot: function () { tone(520, 0.08, 'square', 0.04, 280); },
      pop: function (n) { tone(780 + Math.min(n, 20) * 20, 0.04, 'triangle', 0.035, 90); },
      bad: function () { tone(180, 0.1, 'sawtooth', 0.04, -40); },
      win: function () {
        tone(523, 0.1, 'square', 0.05);
        setTimeout(function () { tone(659, 0.1, 'square', 0.05); }, 100);
        setTimeout(function () { tone(880, 0.2, 'square', 0.05); }, 200);
      },
      lose: function () { tone(160, 0.24, 'sawtooth', 0.05, -80); }
    };
  }
  global.DPAudio = { create: createAudio };
})(typeof window !== 'undefined' ? window : global);
