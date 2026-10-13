/**
 * node games/sand-bucket/tests/core-test.js
 */
var SBCore = require('../js/core.js');
var LEVELS = require('../js/levels.js');

var passed = 0;
var failed = 0;

function assert(cond, msg) {
  if (cond) passed++;
  else {
    failed++;
    console.error('FAIL:', msg);
  }
}

function assertEq(a, b, msg) {
  assert(a === b, msg + ' (got ' + a + ', expected ' + b + ')');
}

(function plan() {
  assertEq(SBCore.planCaps(6).join(','), '6', 'small color is one solo bucket');
  var p = SBCore.planCaps(8);
  assertEq(p.length, 2, '8 splits into a pair');
  assertEq(p[0], p[1], 'pair caps match');
  var sum = 0;
  SBCore.planCaps(40).forEach(function (n) { sum += n; });
  assertEq(sum, 40, 'caps sum to the color count');
})();

function simPerfect(level) {
  var state = SBCore.create(level);
  var guard = 0;
  while (state.status === 'play' && guard++ < 8000) {
    var pair = SBCore.findMergePair(state);
    while (pair) {
      var merged = SBCore.merge(state, pair.a, pair.b);
      assert(merged.ok, 'merge pair on ' + level.name);
      pair = SBCore.findMergePair(state);
    }
    var up = SBCore.upcomingCounts(state, 24);
    var placed = true;
    while (placed) {
      placed = false;
      var free = -1;
      for (var s = 0; s < state.slots.length; s++) if (state.slots[s] == null) { free = s; break; }
      if (free < 0) break;
      var best = null;
      var bestScore = 0;
      for (var h = 0; h < state.hand.length; h++) {
        var bucket = SBCore.bucketById(state, state.hand[h]);
        if (!bucket || !bucket.alive || bucket.fill >= bucket.cap) continue;
        var need = (up[bucket.color] || 0) - SBCore.beltSpace(state, bucket.color);
        if (need <= 0) continue;
        var score = need * 10 - bucket.cap;
        if (!best || score > bestScore) {
          best = bucket;
          bestScore = score;
        }
      }
      if (!best) break;
      var did = SBCore.place(state, best.id, free);
      assert(did.ok, 'place on ' + level.name);
      placed = did.ok;
    }
    if (!state.queue.length) {
      SBCore.settle(state);
      break;
    }
    var cell = SBCore.releaseOne(state);
    var catcher = null;
    var catchScore = -1;
    for (var i = 0; i < state.slots.length; i++) {
      var id = state.slots[i];
      if (id == null) continue;
      var b = SBCore.bucketById(state, id);
      if (!b || !b.alive || b.fill >= b.cap) continue;
      if (!(b.rainbow || b.color === cell.color)) continue;
      var sc = (b.rainbow ? 0 : 50) + (b.cap - b.fill);
      if (sc > catchScore) {
        catchScore = sc;
        catcher = b;
      }
    }
    if (catcher) SBCore.catchCell(state, catcher.id, cell.id);
    else SBCore.spillCell(state, cell.id);
  }
  return state;
}

(function levels() {
  assert(LEVELS.length >= 6, 'at least 6 sand levels');
  for (var i = 0; i < LEVELS.length; i++) {
    var state = simPerfect(LEVELS[i]);
    assertEq(state.status, 'win', LEVELS[i].name + ' perfect bot wins');
    assertEq(state.lost, 0, LEVELS[i].name + ' perfect bot spills nothing');
    assertEq(state.delivered, state.total, LEVELS[i].name + ' picture filled');
  }
})();

(function rules() {
  var state = SBCore.create(LEVELS[0]);
  var a = state.hand[0];
  var b = state.hand[1];
  assert(SBCore.place(state, a, 0).ok, 'place first');
  assert(!SBCore.place(state, a, 1).ok, 'cannot place twice');
  assert(SBCore.place(state, b, 0).ok === false, 'occupied slot');
  assert(SBCore.shovel(state, 0).ok, 'shovel returns bucket');
  assertEq(state.slots[0], null, 'slot cleared');
  assert(state.hand.indexOf(a) >= 0, 'bucket back in hand');

  var grain = SBCore.releaseOne(state);
  var wrong = null;
  for (var i = 0; i < state.buckets.length; i++) {
    if (state.buckets[i].color !== grain.color) wrong = state.buckets[i];
  }
  SBCore.place(state, wrong.id, 0);
  var bad = SBCore.catchCell(state, wrong.id, grain.id);
  assert(!bad.ok, 'wrong color rejected');
  var right = null;
  for (var j = 0; j < state.hand.length; j++) {
    var bucket = SBCore.bucketById(state, state.hand[j]);
    if (bucket.color === grain.color) right = bucket;
  }
  SBCore.place(state, right.id, 1);
  var good = SBCore.catchCell(state, right.id, grain.id);
  assert(good.ok, 'matching catch');
  assertEq(state.combo, 1, 'combo starts');

  var spilled = SBCore.create(LEVELS[0]);
  spilled.spillBudget = 1;
  var g1 = SBCore.releaseOne(spilled);
  var g2 = SBCore.releaseOne(spilled);
  SBCore.spillCell(spilled, g1.id);
  assertEq(spilled.status, 'play', 'within budget');
  SBCore.spillCell(spilled, g2.id);
  assertEq(spilled.status, 'lose', 'over budget loses');

  assert(SBCore.addSlot(SBCore.create(LEVELS[0])).ok, 'first extra slot is free');
  var capped = SBCore.create(LEVELS[0]);
  SBCore.addSlot(capped);
  var ad = SBCore.addSlot(capped);
  assert(ad.needAd, 'further slots ask for the ad hook');
  assert(SBCore.grant(capped, 'slot'), 'ad grant adds a slot');
  assertEq(capped.slots.length, 6, 'two expands from 4');
})();

(function mergeRule() {
  var state = SBCore.create({
    id: 99,
    name: 'merge',
    rows: ['11111111', '11111111'],
    slots: 4,
    spillBudget: 5,
    releaseMs: 100
  });
  var pair = state.buckets.filter(function (b) { return b.cap === state.buckets[0].cap; });
  assert(pair.length >= 2, 'fixture has a pair');
  SBCore.place(state, pair[0].id, 0);
  SBCore.place(state, pair[1].id, 1);
  while (pair[0].alive && pair[0].fill < pair[0].cap && state.queue.length) {
    var cell = SBCore.releaseOne(state);
    if (cell.color === pair[0].color && pair[0].fill < pair[0].cap) SBCore.catchCell(state, pair[0].id, cell.id);
    else if (pair[1].alive && pair[1].fill < pair[1].cap) SBCore.catchCell(state, pair[1].id, cell.id);
    else SBCore.spillCell(state, cell.id);
  }
  while (pair[1].alive && pair[1].fill < pair[1].cap && state.queue.length) {
    var cell2 = SBCore.releaseOne(state);
    if (pair[1].fill < pair[1].cap) SBCore.catchCell(state, pair[1].id, cell2.id);
    else SBCore.spillCell(state, cell2.id);
  }
  var found = SBCore.findMergePair(state);
  assert(found, 'full pair is mergeable');
  var before = state.delivered;
  var res = SBCore.merge(state, found.a, found.b);
  assert(res.ok, 'merge ok');
  assert(state.delivered > before, 'merge fills the picture');
  assertEq(state.slots[0], null, 'slots freed');
})();

if (failed) {
  console.error(failed + ' failed, ' + passed + ' passed');
  process.exit(1);
}
console.log('sand-bucket core: ' + passed + ' passed');
