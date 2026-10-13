/**
 * Node tests for NGCore — weapon upgrade × zombie shooter.
 */
var NGCore = require('../js/core.js');
var fs = require('fs');
var path = require('path');

var passed = 0;
var failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error('FAIL:', msg);
  }
}

function assertEq(a, b, msg) {
  assert(a === b, msg + ' (got ' + a + ', expected ' + b + ')');
}

// --- weaponStats ---
(function () {
  var s1 = NGCore.weaponStats(1);
  assertEq(s1.damage, 1, 'Lv1 damage');
  assertEq(s1.pellets, 1, 'Lv1 pellets');
  var s5 = NGCore.weaponStats(5);
  assertEq(s5.pellets, 2, 'Lv5 pellets');
  assert(s5.fireInterval < s1.fireInterval, 'higher lv fires faster');
  var s20 = NGCore.weaponStats(20);
  assert(s20.pellets <= NGCore.MAX_PELLETS, 'pellets capped');
  assert(s20.firepower === s20.damage * s20.pellets, 'firepower product');
})();

// --- applyGate ---
(function () {
  var st = { weaponLevel: 3 };
  var r = NGCore.applyGate(st, { type: 'add', n: 8 });
  assertEq(r.weaponLevel, 11, 'add +8');
  assertEq(r.delta, 8, 'add delta');
  r = NGCore.applyGate({ weaponLevel: 5 }, { type: 'mul', n: 2 });
  assertEq(r.weaponLevel, 10, 'mul ×2');
  r = NGCore.applyGate({ weaponLevel: 5 }, { type: 'sub', n: 3 });
  assertEq(r.weaponLevel, 2, 'sub -3');
  r = NGCore.applyGate({ weaponLevel: 2 }, { type: 'sub', n: 10 });
  assertEq(r.weaponLevel, 1, 'sub floor at 1');
  r = NGCore.applyGate({ weaponLevel: 4 }, { type: 'pickup', n: 5 });
  assertEq(r.weaponLevel, 9, 'pickup +5');
})();

// --- gate rows always have positive ---
(function () {
  var rnd = NGCore.mulberry32(123);
  var cfg = {
    gatesPerRow: 2,
    gateTable: [
      { type: 'sub', n: [5], w: 10 },
      { type: 'add', n: [1, 8], w: 1 }
    ]
  };
  for (var i = 0; i < 40; i++) {
    var row = NGCore.makeGateRow(cfg, 100 + i * 10, rnd, 3);
    var hasPos = row.some(function (g) {
      return NGCore.POSITIVE[g.type];
    });
    assert(hasPos, 'row ' + i + ' has positive gate');
  }
})();

// --- zombie pack visible count ---
(function () {
  var rnd = NGCore.mulberry32(7);
  var pack = NGCore.makeZombiePack(
    { packSize: [5, 8], enemyTable: [{ kind: 'grunt', hp: [10], w: 1 }] },
    200,
    rnd,
    3
  );
  assert(pack.length >= 5 && pack.length <= 8, 'pack size 5-8 got ' + pack.length);
  assert(pack.every(function (z) { return z.hp > 0 && z.alive; }), 'zombies alive with hp');
})();

// --- createState + shooting kills (not power compare) ---
(function () {
  var cfg = {
    id: 1,
    name: 't',
    startWeapon: 20,
    targetDistance: 2000,
    baseSpeed: 100,
    maxSpeed: 100,
    accel: 0,
    gateGap: 300,
    enemyGap: 200,
    packSize: [3, 3],
    gateTable: [{ type: 'add', n: [1], w: 1 }],
    enemyTable: [{ kind: 'grunt', hp: [5], w: 1 }]
  };
  var defaults = { lanes: 3, laneChangeMs: 80 };
  var state = NGCore.createState(cfg, defaults, 99);
  assert(state.weaponLevel === 20, 'start weapon');
  assert(state.zombies.length > 0, 'zombies present at start');
  // Run until some kills or timeout
  for (var i = 0; i < 400 && state.status === 'running'; i++) {
    NGCore.step(state, 16, { left: false, right: false });
  }
  assert(state.kills >= 1, 'auto-shoot produced kills, got ' + state.kills);
  // Death must be contact, never power-compare
  if (state.status === 'lost') {
    assertEq(state.failReason, 'zombie_contact', 'only contact death');
  }
})();

// --- contact death clear ---
(function () {
  var cfg = {
    id: 1,
    startWeapon: 1,
    targetDistance: 5000,
    baseSpeed: 80,
    maxSpeed: 80,
    accel: 0,
    gateGap: 9999,
    enemyGap: 9999,
    packSize: [1, 1],
    gateTable: [{ type: 'add', n: [1], w: 1 }],
    enemyTable: [{ kind: 'grunt', hp: [9999], w: 1 }]
  };
  var state = NGCore.createState(cfg, { lanes: 3 }, 1);
  // Clear spawned content and place a tank zombie on player lane close
  state.zombies = [
    {
      id: 'zx',
      kind: 'grunt',
      hp: 9999,
      maxHp: 9999,
      lane: state.lane,
      laneOffset: 0,
      z: state.distance + 20,
      alive: true,
      approach: 80,
      radius: 0.4,
      scale: 1
    }
  ];
  state.gates = [];
  state.pickups = [];
  state.bullets = [];
  for (var i = 0; i < 120 && state.status === 'running'; i++) {
    NGCore.step(state, 16, {});
  }
  assertEq(state.status, 'lost', 'should die on contact');
  assertEq(state.failReason, 'zombie_contact', 'fail reason contact');
})();

// --- gate upgrades weapon during run ---
(function () {
  var cfg = {
    id: 1,
    startWeapon: 3,
    targetDistance: 800,
    baseSpeed: 200,
    maxSpeed: 200,
    accel: 0,
    gateGap: 9999,
    enemyGap: 9999,
    packSize: [1, 1],
    gateTable: [{ type: 'add', n: [8], w: 1 }],
    enemyTable: [{ kind: 'grunt', hp: [1], w: 1 }]
  };
  var state = NGCore.createState(cfg, { lanes: 3 }, 5);
  state.zombies = [];
  state.pickups = [];
  state.gates = [
    { id: 'g', type: 'add', n: 8, lane: state.lane, z: state.distance + 30, hit: false }
  ];
  var before = state.weaponLevel;
  for (var i = 0; i < 80 && state.status === 'running'; i++) {
    NGCore.step(state, 16, {});
  }
  assert(state.weaponLevel === before + 8, 'gate added weapon level ' + state.weaponLevel);
})();

// --- simulate prefer_add survives meaningful distance ---
(function () {
  var levels = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../data/levels.json'), 'utf8')
  );
  var cfg = levels.levels[0];
  var state = NGCore.simulate(cfg, levels.defaults, 7, 500, 'prefer_add');
  assert(state.distance > 100, 'sim distance > 100 got ' + Math.floor(state.distance));
  assert(state.weaponLevel >= 1, 'weapon still valid');
  // Either still running, won, or lost to contact (not mysterious)
  assert(
    state.status === 'running' || state.status === 'won' || state.failReason === 'zombie_contact',
    'status ok: ' + state.status + ' ' + state.failReason
  );
})();

// --- win path with strong weapon ---
(function () {
  var cfg = {
    id: 99,
    name: 'easy win',
    startWeapon: 50,
    targetDistance: 400,
    baseSpeed: 220,
    maxSpeed: 220,
    accel: 0,
    gateGap: 180,
    enemyGap: 160,
    packSize: [3, 4],
    gateTable: [
      { type: 'add', n: [10], w: 5 },
      { type: 'sub', n: [1], w: 1 }
    ],
    enemyTable: [{ kind: 'grunt', hp: [3, 5], w: 1 }],
    pickupBonus: [5]
  };
  var state = NGCore.simulate(cfg, { lanes: 3, laneChangeMs: 80 }, 99, 800, 'prefer_add');
  assert(
    state.status === 'won' || state.kills >= 3,
    'strong weapon wins or racks kills: status=' + state.status + ' kills=' + state.kills + ' dist=' + Math.floor(state.distance)
  );
})();

// --- lane change ---
(function () {
  var state = NGCore.createState(
    {
      startWeapon: 3,
      targetDistance: 1000,
      baseSpeed: 100,
      maxSpeed: 100,
      accel: 0,
      gateGap: 999,
      enemyGap: 999,
      packSize: [1, 1],
      gateTable: [{ type: 'add', n: [1], w: 1 }],
      enemyTable: [{ kind: 'grunt', hp: [1], w: 1 }]
    },
    { lanes: 3, laneChangeMs: 50 },
    1
  );
  state.zombies = [];
  assertEq(state.lane, 1, 'start mid lane');
  NGCore.requestLane(state, -1);
  assertEq(state.lane, 0, 'moved left');
  NGCore.requestLane(state, -1);
  assertEq(state.lane, 0, 'clamped');
  NGCore.requestLane(state, 1);
  NGCore.requestLane(state, 1);
  assertEq(state.lane, 2, 'moved right to 2');
})();

// --- HUD fields ---
(function () {
  var state = NGCore.createState(
    {
      startWeapon: 7,
      targetDistance: 500,
      baseSpeed: 100,
      maxSpeed: 100,
      accel: 0,
      gateGap: 999,
      enemyGap: 999,
      packSize: [1, 1],
      gateTable: [{ type: 'add', n: [1], w: 1 }],
      enemyTable: [{ kind: 'grunt', hp: [1], w: 1 }]
    },
    { lanes: 3 },
    1
  );
  var hud = NGCore.getHUD(state);
  assertEq(hud.weaponLevel, 7, 'hud weapon');
  assert(hud.firepower >= 7, 'hud firepower');
  assert(hud.pellets >= 1, 'hud pellets');
})();

console.log('\nResult: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
