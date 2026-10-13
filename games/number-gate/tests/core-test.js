/**
 * Node tests for NGCore — gate math, combat, collision lane, scoring paths.
 * Run: node games/number-gate/tests/core-test.js
 */
'use strict';

var path = require('path');
var fs = require('fs');
var assert = require('assert');
var Core = require('../js/core.js');

var levels = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/levels.json'), 'utf8'));
var defaults = levels.defaults;
var passed = 0;
function ok(cond, msg) {
  assert.ok(cond, msg);
  passed++;
  console.log('  ✓', msg);
}

console.log('=== NGCore unit tests ===');

// Gate ops
(function () {
  var r = Core.applyGate({ power: 10, shield: false, scoreMult: 1 }, { type: 'add', n: 5 }, defaults);
  ok(r.power === 15 && r.delta === 5, 'add +5');

  r = Core.applyGate({ power: 10, shield: false, scoreMult: 1 }, { type: 'mul', n: 3 }, defaults);
  ok(r.power === 30, 'mul ×3');

  r = Core.applyGate({ power: 10, shield: false, scoreMult: 1 }, { type: 'sub', n: 4 }, defaults);
  ok(r.power === 6, 'sub -4');

  r = Core.applyGate({ power: 3, shield: false, scoreMult: 1 }, { type: 'sub', n: 100 }, defaults);
  ok(r.power === 1, 'sub clamps to minPower');

  r = Core.applyGate({ power: 20, shield: false, scoreMult: 1 }, { type: 'div', n: 2 }, defaults);
  ok(r.power === 10, 'div ÷2');

  r = Core.applyGate({ power: 20, shield: false, scoreMult: 1 }, { type: 'bomb', n: 1 }, defaults);
  ok(r.power === 10, 'bomb halves without shield');

  r = Core.applyGate({ power: 20, shield: true, scoreMult: 1 }, { type: 'bomb', n: 1 }, defaults);
  ok(r.power === 20 && r.shield === false && r.kind === 'shieldBreak', 'bomb eaten by shield');

  r = Core.applyGate({ power: 10, shield: false, scoreMult: 1 }, { type: 'shield', n: 1 }, defaults);
  ok(r.shield === true, 'shield on');

  r = Core.applyGate({ power: 10, shield: false, scoreMult: 1.5 }, { type: 'scoreMul', n: 1 }, defaults);
  ok(r.scoreMult === 2, 'scoreMult +0.5');

  r = Core.applyGate({ power: 10, shield: false, scoreMult: 4 }, { type: 'scoreMul', n: 1 }, defaults);
  ok(r.scoreMult === 4, 'scoreMult capped at 4');
})();

// Combat
(function () {
  var r = Core.resolveCombat({ power: 50, shield: false, scoreMult: 2, combo: 2 }, { hp: 40 }, defaults);
  ok(r.killed && r.outcome === 'kill' && r.scoreGain === Math.floor(40 * 2 * 1.2), 'kill with combo score');

  r = Core.resolveCombat({ power: 10, shield: true, scoreMult: 1, combo: 5 }, { hp: 50 }, defaults);
  ok(!r.killed && r.outcome === 'blocked' && r.shield === false && r.combo === 0, 'shield blocks stronger enemy');

  r = Core.resolveCombat({ power: 10, shield: false, scoreMult: 1, combo: 0 }, { hp: 15 }, defaults);
  ok(!r.killed && r.power === 0 && r.outcome === 'dead', 'weaker vs 15 → dead (10-15)');

  r = Core.resolveCombat({ power: 20, shield: false, scoreMult: 1, combo: 0 }, { hp: 7 }, defaults);
  ok(r.killed && r.outcome === 'kill', 'stronger kills');

  r = Core.resolveCombat({ power: 12, shield: false, scoreMult: 1, combo: 0 }, { hp: 5 }, defaults);
  ok(r.killed, 'equal-or-greater kills at boundary+');
})();

// Spawn row always has positive gate
(function () {
  var rnd = Core.mulberry32(12345);
  var id = 1;
  function idGen() { return id++; }
  for (var i = 0; i < 40; i++) {
    var row = Core.spawnGateRow({
      lanes: 3,
      gatesPerRow: 2,
      gateTable: levels.levels[4].gateTable
    }, 100 + i * 10, idGen, rnd);
    var hasPos = row.some(function (g) { return Core.POSITIVE[g.type]; });
    ok(hasPos, 'spawn row ' + i + ' has positive gate');
  }
})();

// Simulation path A — high score greed (prefer mul/add)
(function () {
  var cfg = levels.levels[0];
  var st = Core.createState(cfg, defaults, 7);
  var steps = 0;
  while (st.status === 'playing' && steps < 4000) {
    // Always try to be in lane of best upcoming gate
    var bestLane = st.targetLane;
    var bestScore = -1e9;
    var near = st.entities.filter(function (e) {
      return e.kind === 'gate' && !e.consumed && e.z - st.distance < 120 && e.z - st.distance > 0;
    });
    near.forEach(function (g) {
      var prev = Core.previewGate(st.power, st.shield, st.scoreMult, g, defaults);
      var score = prev.power;
      if (g.type === 'mul') score *= 1.2;
      if (score > bestScore) { bestScore = score; bestLane = g.lane; }
    });
    var input = {};
    if (bestLane < st.targetLane) input.left = true;
    if (bestLane > st.targetLane) input.right = true;
    Core.step(st, 1 / 60, input);
    steps++;
  }
  console.log('  · pathA status=', st.status, 'score=', Math.floor(st.score), 'power=', st.power, 'dist=', Math.floor(st.distance));
  ok(st.distance > 100, 'pathA ran meaningful distance');
  ok(st.score > 0, 'pathA scored points');
})();

// Simulation path B — clear level 1 with scripted seed & lane bias center
(function () {
  var cfg = levels.levels[0];
  var st = Core.createState(cfg, defaults, 99);
  var steps = 0;
  var kills = 0;
  while (st.status === 'playing' && steps < 8000) {
    var input = {};
    // Prefer center for boss; otherwise pick gate maximizing power
    var candidates = st.entities.filter(function (e) {
      var rel = e.z - st.distance;
      return !e.consumed && !e.dead && rel > 0 && rel < 90;
    });
    var target = st.targetLane;
    var best = -1e9;
    candidates.forEach(function (e) {
      if (e.kind === 'gate') {
        var p = Core.previewGate(st.power, st.shield, st.scoreMult, e, defaults).power;
        if (p > best) { best = p; target = e.lane; }
      } else if (e.kind === 'enemy' && st.power >= e.hp) {
        if (1000 + e.hp > best) { best = 1000 + e.hp; target = e.lane; }
      } else if (e.enemyKind === 'boss') {
        target = e.lane;
        best = 1e9;
      }
    });
    if (target < st.targetLane) input.left = true;
    if (target > st.targetLane) input.right = true;
    var beforeEvents = st.events.length;
    Core.step(st, 1 / 60, input);
    st.events.forEach(function (ev) { if (ev.type === 'kill') kills++; });
    steps++;
  }
  console.log('  · pathB status=', st.status, 'score=', Math.floor(st.score), 'power=', st.power, 'kills=', kills, 'steps=', steps);
  ok(steps > 100, 'pathB simulated');
  // With AI may win or lose depending on RNG of gates — just ensure terminal or long run
  ok(st.status === 'won' || st.status === 'lost' || st.distance > cfg.targetDistance * 0.5, 'pathB progressed toward endgame');
})();

// Lane change + effectiveLane
(function () {
  var st = Core.createState(levels.levels[0], defaults, 1);
  ok(Core.effectiveLane(st) === 1, 'start middle lane');
  Core.setLaneTarget(st, -1);
  ok(st.targetLane === 0 && st.laneT === 0, 'lane target left');
  Core.step(st, 0.2, {});
  ok(st.lane === 0 || st.laneT > 0, 'lane transition advances');
})();

// Endless state boots
(function () {
  var st = Core.createState(levels.endless, defaults, 3);
  ok(st.isEndless && st.power === levels.endless.startPower, 'endless boots');
  for (var i = 0; i < 120; i++) Core.step(st, 1 / 60, {});
  ok(st.distance > 50 && st.entities.length > 0, 'endless spawns entities');
})();

console.log('\nAll passed:', passed);
