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
      o.frequency.setValueAtTime(Math.max(30, freq), c.currentTime);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), c.currentTime + dur);
      g.gain.setValueAtTime(gain || 0.04, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
      o.connect(g); g.connect(c.destination);
      o.start(); o.stop(c.currentTime + dur + 0.02);
    }
    return {
      unlock: function () { ac(); },
      tap: function () { tone(440, 0.04, 'square', 0.03); },
      shot: function () { tone(680, 0.03, 'square', 0.02, -200); },
      hit: function () { tone(220, 0.04, 'sawtooth', 0.025); },
      gate: function (good) { tone(good ? 660 : 180, 0.12, 'square', 0.05, good ? 180 : -60); },
      charge: function () { tone(920, 0.05, 'square', 0.03, 80); },
      win: function () {
        tone(523, 0.1, 'square', 0.05);
        setTimeout(function () { tone(784, 0.12, 'square', 0.05); }, 120);
        setTimeout(function () { tone(1046, 0.22, 'square', 0.05); }, 240);
      },
      lose: function () { tone(120, 0.35, 'sawtooth', 0.06, -70); }
    };
  }
  global.DGAudio = { create: createAudio };
})(typeof window !== 'undefined' ? window : global);
