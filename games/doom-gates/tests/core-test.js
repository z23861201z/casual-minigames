/**
 * node games/doom-gates/tests/core-test.js
 */
var DGCore = require('../js/core.js');
var LEVELS = require('../js/levels.js');

var passed = 0;
var failed = 0;
function assert(cond, msg) {
  if (cond) passed++;
  else { failed++; console.error('FAIL:', msg); }
}
function assertEq(a, b, msg) {
  assert(a === b, msg + ' (got ' + a + ', expected ' + b + ')');
}

(function gates() {
  assertEq(DGCore.applySquad(3, { type: 'add', n: 8 }).squad, 11, 'add');
  assertEq(DGCore.applySquad(4, { type: 'mul', n: 2 }).squad, 8, 'mul');
  assertEq(DGCore.applySquad(9, { type: 'sub', n: 4 }).squad, 5, 'sub');
  assertEq(DGCore.applySquad(9, { type: 'div', n: 2 }).squad, 4, 'div');
  assertEq(DGCore.applySquad(2, { type: 'sub', n: 5 }).squad, 0, 'sub can zero the squad');
  assertEq(DGCore.label({ type: 'mul', n: 3 }), '×3', 'label');

  var sub = { type: 'sub', n: 1, hits: 0 };
  var improved = DGCore.noteGateHit(sub, DGCore.GATE_HITS);
  assertEq(improved, 1, 'three hits improve once');
  assertEq(sub.type, 'add', 'subtract flips after it reaches 0');
  assertEq(sub.n, 1, 'flipped gate is +1');

  var fin = { need: 100, baseNeed: 100, hits: 0 };
  var drops = DGCore.noteFinishHit(fin, DGCore.FINISH_HITS * 3);
  assertEq(drops, 3, 'weapon gate need drops');
  assertEq(fin.need, 97, 'need is 97');
  fin.need = Math.ceil(100 * 0.55);
  DGCore.noteFinishHit(fin, 50);
  assertEq(fin.need, Math.ceil(100 * 0.55), 'need cannot drop below 55%');
})();

(function contact() {
  var state = DGCore.create(LEVELS[0]);
  state.squad = 1;
  state.z = 10;
  state.x = 0;
  state.zombies.push({
    x: 0, z: 10.2, kind: 'walker', hp: 500, maxHp: 500, r: 0.3,
    speed: 0, collide: true, score: 1, alive: true
  });
  DGCore.step(state, 0.05);
  assertEq(state.phase, 'lose', 'a touching zombie wipes a squad of 1');
  assertEq(state.reason, 'zombie', 'death reason is the zombie');
  assertEq(state.squad, 0, 'squad is zero');
})();

(function weaponGate() {
  var state = DGCore.create(LEVELS[0]);
  state.squad = 500;
  state.z = state.finish.z - 0.01;
  DGCore.step(state, 0.05);
  assertEq(state.phase, 'win', 'enough people claim the weapon');

  var short = DGCore.create(LEVELS[0]);
  short.squad = 1;
  short.z = short.finish.z - 0.01;
  short.zombies = [];
  for (var gi = 0; gi < short.gates.length; gi++) short.gates[gi].used = true;
  DGCore.step(short, 0.05);
  assertEq(short.phase, 'lose', 'short squad is rejected');
  assertEq(short.reason, 'weapon', 'death reason is the weapon gate');
})();

(function campaign() {
  for (var i = 0; i < LEVELS.length; i++) {
    var state = DGCore.runBot(LEVELS[i], 0.05, 9000);
    if (state.phase !== 'win') {
      console.error('  level', LEVELS[i].name, 'phase', state.phase, state.reason, 'squad', state.squad, 'need', state.finish.need, 'z', state.z.toFixed(1));
    }
    assertEq(state.phase, 'win', LEVELS[i].name + ' bot reaches the weapon');
    assert(state.squad >= state.finish.need, LEVELS[i].name + ' squad meets the gate');
    assert(state.kills > 0, LEVELS[i].name + ' shot zombies');
  }
})();

(function linearSquadLane() {
  assertEq(DGCore.squadLane(0), 0, 'lane is 0 at center (no snap gap)');
  assertEq(DGCore.squadLane(0.86), 1, 'lane is 1 at right edge');
  assertEq(DGCore.squadLane(-0.86), -1, 'lane is -1 at left edge');
  var a = DGCore.squadLane(0.215);
  var b = DGCore.squadLane(0.43);
  assert(Math.abs(a - 0.25) < 1e-9, 'lane scales linearly at +0.215');
  assert(Math.abs(b - 0.5) < 1e-9, 'lane scales linearly at +0.43');
  assert(Math.abs(DGCore.squadLane(-0.215) + 0.25) < 1e-9, 'lane scales linearly at -0.215');
  assert(a * 2 === b || Math.abs(a * 2 - b) < 1e-9, 'doubling x doubles lane through 0');
  assert(DGCore.squadLane(0.01) > 0 && DGCore.squadLane(0.01) < 0.18, 'near-center positive is not snapped to 0.18');
  assert(DGCore.squadLane(-0.01) < 0 && DGCore.squadLane(-0.01) > -0.18, 'near-center negative is not snapped to -0.18');
})();

(function centerLane() {
  function cross(x) {
    var state = DGCore.create({
      id: 8,
      name: 'center',
      startSquad: 20,
      weapon: 0,
      speed: 1,
      gates: [{ z: 2, left: { type: 'mul', n: 2 }, right: { type: 'sub', n: 4 } }],
      zombies: [],
      finish: { z: 30, need: 1, weapon: 1, name: '手枪' }
    });
    state.x = x;
    state.targetX = x;
    state.z = 1.96;
    state.fireCd = 9;
    DGCore.step(state, 0.05);
    return state;
  }
  var mid = cross(0);
  assert(mid.gates[0].used, 'center run crosses the gate');
  assertEq(mid.squad, 40, 'center dead-zone takes the better left gate');
  var right = cross(0.4);
  assertEq(right.squad, 16, 'a clear right lane still takes the right gate');
  var left = cross(-0.4);
  assertEq(left.squad, 40, 'a clear left lane takes the left gate');
})();

(function shootChangesGate() {
  var level = {
    id: 7,
    name: 'range',
    startSquad: 8,
    weapon: 1,
    speed: 0.4,
    gates: [{ z: 18, left: { type: 'add', n: 1 }, right: { type: 'add', n: 1 } }],
    zombies: [],
    finish: { z: 40, need: 1, weapon: 1, name: '手枪' }
  };
  var state = DGCore.create(level);
  state.targetX = 0.7;
  var guard = 0;
  var charged = false;
  while (state.phase === 'run' && state.z < 16 && guard++ < 2000) {
    DGCore.step(state, 0.05);
    if (state.gates[0].right.n > 1) charged = true;
  }
  assert(charged, 'bullets aimed right increase the right gate');
  assertEq(state.gates[0].left.n, 1, 'the other gate stays put');
})();

(function hordePack() {
  var level = {
    id: 80,
    name: 'horde',
    startSquad: 5,
    weapon: 1,
    speed: 6,
    gates: [{ z: 20, left: { type: 'add', n: 2 }, right: { type: 'add', n: 1 } }],
    zombies: [],
    zombieWaves: [{ z: 24, x: 0, count: 18, cols: 6, kind: 'crowd' }],
    finish: { z: 40, need: 1, weapon: 1, name: '手枪' }
  };
  var state = DGCore.create(level);
  assertEq(state.zombies.length, 18, 'wave expands into a horde');
  var zs = [];
  for (var i = 0; i < state.zombies.length; i++) {
    var z = state.zombies[i];
    assert(z.x >= -0.85 && z.x <= 0.85, 'horde x stays on the road');
    assert(z.kind === 'crowd', 'packed tide is crowd');
    zs.push(z.z);
  }
  zs.sort(function (a, b) { return a - b; });
  assert(zs[0] >= 23.5 && zs[zs.length - 1] < 32, 'horde stays near its anchor');
  assert(LEVELS.length >= 10, 'campaign has at least 10 levels');
})();

(function endlessShape() {
  var level = DGCore.buildEndless(2, 5);
  assert(level.gates.length >= 5, 'endless has gates');
  assert(level.zombies.length > 8, 'endless has a visible horde');
  for (var i = 0; i < level.gates.length; i++) {
    var g = level.gates[i];
    var good = (g.left.type === 'add' || g.left.type === 'mul' || g.right.type === 'add' || g.right.type === 'mul');
    assert(good, 'endless row has a positive gate');
  }
  var state = DGCore.runBot(level, 0.05, 9000);
  assertEq(state.phase, 'win', 'endless sample is clearable');
})();

if (failed) {
  console.error(failed + ' failed, ' + passed + ' passed');
  process.exit(1);
}
console.log('doom-gates core: ' + passed + ' passed');
