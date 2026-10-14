/**
 * node games/duck-pop/tests/core-test.js
 */
var DPCore = require('../js/core.js');
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

(function shotRules() {
  var grid = [
    [0, 1],
    [0, 0],
    [1, 0]
  ];
  assert(DPCore.canShoot(grid, 0, 1), 'bottom of col 0 is color 1');
  assert(!DPCore.canShoot(grid, 0, 0), 'color 0 is buried in col 0');
  var plan = DPCore.planShot(grid, 1, 0, 10);
  assertEq(plan.hits.length, 2, 'stops at the other color');
  assertEq(plan.ammoLeft, 8, 'unspent ammo remains');
  assertEq(plan.blockedBy, 1, 'blocked by color 1');
  DPCore.applyHits(grid, plan.hits);
  DPCore.collapse(grid);
  assertEq(grid[2][1], 1, 'upper block fell to the bottom');
  assertEq(grid[1][1], null, 'gap closed');
})();

function greedy(level) {
  var state = DPCore.create(level, 1);
  var guard = 0;
  while (state.status === 'play' && guard++ < 600) {
    var best = DPCore.longestShot(state);
    if (best) {
      var res = DPCore.fire(state, best.duckId, best.col);
      assert(res.ok, level.name + ' shot');
      continue;
    }
    if (state.shuffles > 0) {
      DPCore.shuffle(state, DPCore.mulberry32(guard + 9));
      continue;
    }
    if (state.clears > 0) {
      var target = null;
      for (var r = state.rows - 1; r >= 0 && !target; r--) {
        for (var c = 0; c < state.cols; c++) {
          if (state.grid[r][c] === DPCore.STONE) { target = { r: r, c: c }; break; }
        }
      }
      if (!target) {
        for (var r2 = state.rows - 1; r2 >= 0 && !target; r2--) {
          for (var c2 = 0; c2 < state.cols; c2++) {
            if (state.grid[r2][c2] != null) { target = { r: r2, c: c2 }; break; }
          }
        }
      }
      if (!target) break;
      DPCore.clearAt(state, target.r, target.c);
      continue;
    }
    break;
  }
  return state;
}

(function levels() {
  assert(LEVELS.length >= 10, 'at least 10 duck levels');
  for (var i = 0; i < LEVELS.length; i++) {
    var state = greedy(LEVELS[i]);
    assertEq(state.status, 'win', LEVELS[i].name + ' greedy bot clears');
    assert(DPCore.isClear(state.grid), LEVELS[i].name + ' grid empty');
  }
})();

(function tools() {
  var state = DPCore.create(LEVELS[4], 2);
  var before = state.stars;
  assert(state.ducks.length > 0, 'ducks dealt');
  var up = DPCore.upgrade(state, state.ducks[0].id);
  assert(up.ok, 'upgrade spends a star');
  assertEq(state.stars, before - 1, 'star spent');
  assertEq(state.ducks[0].ammo, up.ammo, 'ammo grew');
  var stuck = DPCore.create({
    id: 50,
    name: 'stuck',
    rows: ['0', 'X'],
    bonus: 0,
    shuffles: 0,
    clears: 0,
    stars: 0
  });
  assert(!DPCore.hasMove(stuck), 'stone blocks the only column');
  assertEq(stuck.status, 'play', 'status stays play until the board is checked');
  var wasted = DPCore.fire(stuck, stuck.ducks[0].id, 0);
  assert(!wasted.ok, 'cannot shoot stone');
  var cleared = DPCore.create({
    id: 51,
    name: 'clearstone',
    rows: ['X'],
    bonus: 0,
    shuffles: 0,
    clears: 1,
    stars: 0
  });
  assert(DPCore.clearAt(cleared, 0, 0).ok, 'clear removes stone');
  assertEq(cleared.status, 'win', 'removing the last stone wins');
  var noTool = DPCore.create(LEVELS[0], 1);
  noTool.shuffles = 0;
  var ad = DPCore.shuffle(noTool);
  assert(ad.needAd, 'shuffle ad hook');
  assert(DPCore.grant(noTool, 'shuffle'), 'grant shuffle');
  assert(DPCore.shuffle(noTool).ok, 'shuffle after grant');
  var floaty = DPCore.create({
    id: 52,
    name: 'float',
    rows: ['0.', '.1'],
    bonus: 0,
    shuffles: 1,
    clears: 0,
    stars: 0
  });
  assert(DPCore.shuffle(floaty).ok, 'shuffle packs the board');
  for (var c = 0; c < floaty.cols; c++) {
    var hole = false;
    for (var r = floaty.rows - 1; r >= 0; r--) {
      if (floaty.grid[r][c] == null) hole = true;
      else assert(!hole, 'shuffle collapse leaves no floating block');
    }
  }
})();

if (failed) {
  console.error(failed + ' failed, ' + passed + ' passed');
  process.exit(1);
}
console.log('duck-pop core: ' + passed + ' passed');
