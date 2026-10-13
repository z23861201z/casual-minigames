/**
 * Sand Bucket core — pixel sand, colored buckets, merge delivery.
 * No DOM or Canvas. Global: SBCore
 *
 * A grain caught by a same-color bucket fills it. Two full buckets of the
 * same color and capacity merge into the painting. A full bucket with no
 * partner auto-delivers. Spills beyond the budget lose the level.
 */
(function (global) {
  'use strict';

  var COLORS = [
    { id: 0, name: '奶油', hex: '#F6E3C5', dark: '#E2C89A', ink: '#6B4E2E' },
    { id: 1, name: '草莓', hex: '#FF6B6B', dark: '#E04545', ink: '#fff' },
    { id: 2, name: '橘子', hex: '#FFA94D', dark: '#F08C2E', ink: '#5A3208' },
    { id: 3, name: '樱粉', hex: '#FF8FBF', dark: '#F06A9A', ink: '#fff' },
    { id: 4, name: '可可', hex: '#8D5A3C', dark: '#6B3E28', ink: '#fff' },
    { id: 5, name: '海蓝', hex: '#74C0FC', dark: '#3D9BE0', ink: '#08324A' },
    { id: 6, name: '柠檬', hex: '#FFE066', dark: '#F5C518', ink: '#5A4500' },
    { id: 7, name: '薄荷', hex: '#8CE99A', dark: '#51CF66', ink: '#145228' },
    { id: 8, name: '牛奶', hex: '#FFFFFF', dark: '#E6EDF5', ink: '#3E4A5A' },
    { id: 9, name: '芝麻', hex: '#3A4150', dark: '#222733', ink: '#fff' }
  ];

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function planCaps(count) {
    if (count <= 0) return [];
    if (count < 8) return [count];
    var caps = [];
    var c = count;
    var sizes = [24, 16, 12, 8];
    for (var i = 0; i < sizes.length; i++) {
      var s = sizes[i];
      while (c >= s * 2) {
        caps.push(s, s);
        c -= s * 2;
      }
    }
    if (c >= 8 && c % 2 === 0) {
      caps.push(c / 2, c / 2);
      c = 0;
    }
    if (c > 0) caps.push(c);
    return caps;
  }

  function parseCells(rowStrings) {
    var cells = [];
    var rows = rowStrings.length;
    var cols = rowStrings[0].length;
    for (var r = 0; r < rows; r++) {
      if (rowStrings[r].length !== cols) {
        throw new Error('Ragged sand row ' + r);
      }
      for (var c = 0; c < cols; c++) {
        var ch = rowStrings[r].charAt(c);
        if (ch === '.') continue;
        var color = ch.charCodeAt(0) - 48;
        if (color < 0 || color > 9) throw new Error('Bad sand color ' + ch);
        cells.push({
          id: cells.length,
          r: r,
          c: c,
          color: color,
          state: 'solid'
        });
      }
    }
    return { cells: cells, rows: rows, cols: cols };
  }

  function bucketById(state, id) {
    for (var i = 0; i < state.buckets.length; i++) {
      if (state.buckets[i].id === id) return state.buckets[i];
    }
    return null;
  }

  function cellById(state, id) {
    return state.cells[id] || null;
  }

  function freeSlot(state, bucketId) {
    for (var i = 0; i < state.slots.length; i++) {
      if (state.slots[i] === bucketId) state.slots[i] = null;
    }
    var h = state.hand.indexOf(bucketId);
    if (h >= 0) state.hand.splice(h, 1);
  }

  function partnerCount(state, bucket) {
    var n = 0;
    for (var i = 0; i < state.buckets.length; i++) {
      var o = state.buckets[i];
      if (!o.alive || o.id === bucket.id) continue;
      if (o.cap !== bucket.cap) continue;
      if (!!o.rainbow !== !!bucket.rainbow) continue;
      if (!bucket.rainbow && o.color !== bucket.color) continue;
      n++;
    }
    return n;
  }

  function canSolo(state, bucket) {
    return !!(bucket && bucket.alive && bucket.fill >= bucket.cap && partnerCount(state, bucket) === 0);
  }

  function canMerge(a, b) {
    if (!a || !b || a.id === b.id) return false;
    if (!a.alive || !b.alive) return false;
    if (a.fill < a.cap || b.fill < b.cap) return false;
    if (a.cap !== b.cap) return false;
    if (!!a.rainbow !== !!b.rainbow) return false;
    if (!a.rainbow && a.color !== b.color) return false;
    return true;
  }

  function onBelt(state, bucketId) {
    for (var i = 0; i < state.slots.length; i++) {
      if (state.slots[i] === bucketId) return true;
    }
    return false;
  }

  function deliverBucket(state, bucket) {
    var n = bucket.cells.length;
    for (var i = 0; i < bucket.cells.length; i++) {
      var cell = cellById(state, bucket.cells[i]);
      if (cell) cell.state = 'delivered';
    }
    state.delivered += n;
    bucket.cells = [];
    bucket.fill = 0;
    bucket.alive = false;
    freeSlot(state, bucket.id);
    return n;
  }

  function pushEvent(state, ev) {
    state.events.push(ev);
  }

  function create(level) {
    var parsed = parseCells(level.rows);
    var counts = {};
    for (var i = 0; i < parsed.cells.length; i++) {
      var col = parsed.cells[i].color;
      counts[col] = (counts[col] || 0) + 1;
    }
    var buckets = [];
    var nextId = 1;
    var colors = Object.keys(counts).map(function (k) { return +k; }).sort(function (a, b) { return a - b; });
    for (var ci = 0; ci < colors.length; ci++) {
      var color = colors[ci];
      var caps = planCaps(counts[color]);
      for (var k = 0; k < caps.length; k++) {
        buckets.push({
          id: nextId++,
          color: color,
          cap: caps[k],
          fill: 0,
          cells: [],
          rainbow: false,
          alive: true
        });
      }
    }
    var queue = [];
    for (var r = parsed.rows - 1; r >= 0; r--) {
      for (var c = 0; c < parsed.cols; c++) {
        for (var n = 0; n < parsed.cells.length; n++) {
          var cell = parsed.cells[n];
          if (cell.r === r && cell.c === c) queue.push(cell.id);
        }
      }
    }
    var slotsN = level.slots || 4;
    var slots = [];
    for (var s = 0; s < slotsN; s++) slots.push(null);
    var total = parsed.cells.length;
    var budget = level.spillBudget != null
      ? level.spillBudget
      : Math.max(3, Math.floor(total * (level.spillRate == null ? 0.1 : level.spillRate)));
    return {
      levelId: level.id,
      name: level.name || ('关卡 ' + level.id),
      releaseMs: level.releaseMs || 220,
      rows: parsed.rows,
      cols: parsed.cols,
      cells: parsed.cells,
      total: total,
      queue: queue,
      inflight: [],
      buckets: buckets,
      hand: buckets.map(function (b) { return b.id; }),
      slots: slots,
      slotsCap: 6,
      bonusSlotsLeft: 1,
      delivered: 0,
      lost: 0,
      spillBudget: budget,
      combo: 0,
      bestCombo: 0,
      score: 0,
      mergeCount: 0,
      magnetT: 0,
      tools: {
        shovel: level.tools && level.tools.shovel != null ? level.tools.shovel : 3,
        rainbow: level.tools && level.tools.rainbow != null ? level.tools.rainbow : 2,
        magnet: level.tools && level.tools.magnet != null ? level.tools.magnet : 2
      },
      status: 'play',
      reason: '',
      events: [],
      placed: 0
    };
  }

  function upcomingCounts(state, n) {
    var map = {};
    var limit = Math.min(n, state.queue.length);
    for (var i = 0; i < limit; i++) {
      var cell = cellById(state, state.queue[i]);
      if (!cell) continue;
      map[cell.color] = (map[cell.color] || 0) + 1;
    }
    return map;
  }

  function place(state, bucketId, slotIndex) {
    if (state.status !== 'play') return { ok: false, reason: 'over' };
    if (slotIndex < 0 || slotIndex >= state.slots.length) return { ok: false, reason: 'slot' };
    if (state.slots[slotIndex] != null) return { ok: false, reason: 'occupied' };
    var handIndex = state.hand.indexOf(bucketId);
    if (handIndex < 0) return { ok: false, reason: 'hand' };
    var bucket = bucketById(state, bucketId);
    if (!bucket || !bucket.alive) return { ok: false, reason: 'dead' };
    state.hand.splice(handIndex, 1);
    state.slots[slotIndex] = bucketId;
    state.placed++;
    return { ok: true };
  }

  function shovel(state, slotIndex) {
    if (state.tools.shovel <= 0) return { ok: false, needAd: true, tool: 'shovel' };
    var id = state.slots[slotIndex];
    if (id == null) return { ok: false, reason: 'empty' };
    state.tools.shovel--;
    state.slots[slotIndex] = null;
    state.hand.push(id);
    return { ok: true };
  }

  function makeRainbow(state, bucketId) {
    if (state.tools.rainbow <= 0) return { ok: false, needAd: true, tool: 'rainbow' };
    var bucket = bucketById(state, bucketId);
    if (!bucket || !bucket.alive || bucket.rainbow) return { ok: false, reason: 'bucket' };
    state.tools.rainbow--;
    bucket.rainbow = true;
    pushEvent(state, { type: 'rainbow', id: bucketId });
    return { ok: true };
  }

  function startMagnet(state) {
    if (state.tools.magnet <= 0) return { ok: false, needAd: true, tool: 'magnet' };
    state.tools.magnet--;
    state.magnetT = 8;
    pushEvent(state, { type: 'magnet' });
    return { ok: true };
  }

  function addSlot(state) {
    if (state.slots.length >= state.slotsCap) return { ok: false, reason: 'max' };
    if (state.bonusSlotsLeft <= 0) return { ok: false, needAd: true, tool: 'slot' };
    state.bonusSlotsLeft--;
    state.slots.push(null);
    return { ok: true };
  }

  function grant(state, tool) {
    if (tool === 'slot') {
      if (state.slots.length >= state.slotsCap) return false;
      state.slots.push(null);
      return true;
    }
    if (!state.tools.hasOwnProperty(tool)) return false;
    state.tools[tool] += 1;
    return true;
  }

  function tick(state, dt) {
    if (state.magnetT > 0) state.magnetT = Math.max(0, state.magnetT - dt);
  }

  function releaseOne(state) {
    if (state.status !== 'play' || !state.queue.length) return null;
    var id = state.queue.shift();
    var cell = cellById(state, id);
    cell.state = 'flight';
    state.inflight.push(id);
    return cell;
  }

  function removeInflight(state, cellId) {
    var idx = state.inflight.indexOf(cellId);
    if (idx >= 0) state.inflight.splice(idx, 1);
  }

  function noteCombo(state) {
    state.combo++;
    if (state.combo > state.bestCombo) state.bestCombo = state.combo;
  }

  function catchCell(state, bucketId, cellId) {
    if (state.status !== 'play') return { ok: false, reason: 'over' };
    var bucket = bucketById(state, bucketId);
    var cell = cellById(state, cellId);
    if (!bucket || !cell) return { ok: false, reason: 'missing' };
    if (!bucket.alive || bucket.fill >= bucket.cap) return { ok: false, reason: 'full' };
    if (state.inflight.indexOf(cellId) < 0) return { ok: false, reason: 'flight' };
    if (!bucket.rainbow && bucket.color !== cell.color) return { ok: false, reason: 'color' };
    removeInflight(state, cellId);
    bucket.fill++;
    bucket.cells.push(cellId);
    cell.state = 'bucket';
    noteCombo(state);
    state.score += 10 * state.combo;
    var result = { ok: true, full: bucket.fill >= bucket.cap, combo: state.combo, solo: false, n: 1 };
    if (bucket.fill >= bucket.cap && canSolo(state, bucket)) {
      var delivered = deliverBucket(state, bucket);
      state.score += delivered * 20;
      result.solo = true;
      result.n = delivered;
      pushEvent(state, { type: 'deliver', n: delivered, text: '+' + delivered, color: cell.color });
    } else if (bucket.fill >= bucket.cap) {
      pushEvent(state, { type: 'full', id: bucket.id, cap: bucket.cap });
    }
    return result;
  }

  function spillCell(state, cellId) {
    if (state.inflight.indexOf(cellId) < 0) return { ok: false };
    var cell = cellById(state, cellId);
    removeInflight(state, cellId);
    if (cell) cell.state = 'lost';
    state.lost++;
    state.combo = 0;
    pushEvent(state, { type: 'spill', color: cell ? cell.color : 0 });
    if (state.lost > state.spillBudget) {
      state.status = 'lose';
      state.reason = 'spill';
      pushEvent(state, { type: 'lose', reason: 'spill' });
    }
    return { ok: true, lost: state.lost, status: state.status };
  }

  function findMergePair(state) {
    var list = [];
    for (var i = 0; i < state.slots.length; i++) {
      var id = state.slots[i];
      if (id == null) continue;
      var bucket = bucketById(state, id);
      if (bucket && bucket.alive && bucket.fill >= bucket.cap) list.push(bucket);
    }
    var best = null;
    for (var a = 0; a < list.length; a++) {
      for (var b = a + 1; b < list.length; b++) {
        if (!canMerge(list[a], list[b])) continue;
        if (!best || list[a].cap > best.cap) {
          best = { a: list[a].id, b: list[b].id, cap: list[a].cap, n: list[a].fill + list[b].fill };
        }
      }
    }
    return best;
  }

  function merge(state, idA, idB) {
    var a = bucketById(state, idA);
    var b = bucketById(state, idB);
    if (!canMerge(a, b)) return { ok: false, reason: 'rule' };
    if (!onBelt(state, a.id) || !onBelt(state, b.id)) return { ok: false, reason: 'belt' };
    var color = a.rainbow ? -1 : a.color;
    var n = deliverBucket(state, a) + deliverBucket(state, b);
    state.mergeCount++;
    var mult = Math.max(1, Math.ceil(state.combo / 3));
    state.score += n * 30 * mult;
    pushEvent(state, { type: 'merge', n: n, text: '+' + n, color: color, mult: mult });
    return { ok: true, n: n, text: '+' + n };
  }

  function deliverSolo(state, bucketId) {
    var bucket = bucketById(state, bucketId);
    if (!canSolo(state, bucket)) return { ok: false, reason: 'rule' };
    var color = bucket.rainbow ? -1 : bucket.color;
    var n = deliverBucket(state, bucket);
    state.score += n * 20;
    pushEvent(state, { type: 'deliver', n: n, text: '+' + n, color: color });
    return { ok: true, n: n };
  }

  function settle(state) {
    if (state.status !== 'play') return state.status;
    if (state.queue.length || state.inflight.length) return 'play';
    for (var i = 0; i < state.buckets.length; i++) {
      var bucket = state.buckets[i];
      if (!bucket.alive || bucket.cells.length === 0) continue;
      state.score += bucket.cells.length * 15;
      deliverBucket(state, bucket);
    }
    if (state.lost > state.spillBudget) {
      state.status = 'lose';
      state.reason = 'spill';
    } else if (state.delivered + state.lost >= state.total) {
      state.status = 'win';
      state.reason = 'clear';
      pushEvent(state, { type: 'win', score: state.score });
    } else {
      state.status = 'lose';
      state.reason = 'short';
    }
    return state.status;
  }

  function beltSpace(state, color) {
    var space = 0;
    for (var i = 0; i < state.slots.length; i++) {
      var id = state.slots[i];
      if (id == null) continue;
      var bucket = bucketById(state, id);
      if (!bucket || !bucket.alive || bucket.fill >= bucket.cap) continue;
      if (bucket.rainbow || bucket.color === color) space += bucket.cap - bucket.fill;
    }
    return space;
  }

  function colorOf(id) {
    return COLORS[id] || COLORS[0];
  }

  var SBCore = {
    COLORS: COLORS,
    colorOf: colorOf,
    clamp: clamp,
    planCaps: planCaps,
    create: create,
    bucketById: bucketById,
    upcomingCounts: upcomingCounts,
    place: place,
    shovel: shovel,
    makeRainbow: makeRainbow,
    startMagnet: startMagnet,
    addSlot: addSlot,
    grant: grant,
    tick: tick,
    releaseOne: releaseOne,
    catchCell: catchCell,
    spillCell: spillCell,
    findMergePair: findMergePair,
    canMerge: canMerge,
    canSolo: canSolo,
    merge: merge,
    deliverSolo: deliverSolo,
    settle: settle,
    beltSpace: beltSpace,
    partnerCount: partnerCount
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = SBCore;
  global.SBCore = SBCore;
})(typeof window !== 'undefined' ? window : global);
