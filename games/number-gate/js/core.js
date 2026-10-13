/**
 * Number Gate — Weapon Upgrade × Zombie Shooter core (no DOM/Canvas).
 * Gates upgrade weaponLevel; player auto-shoots; contact with zombies = death.
 * Global: NGCore
 */
(function (global) {
  'use strict';

  var POSITIVE = { add: 1, mul: 1, pickup: 1 };
  var MAX_WEAPON = 999;
  var MAX_PELLETS = 5;

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pickWeighted(table, rnd) {
    var total = 0;
    for (var i = 0; i < table.length; i++) total += table[i].w || 1;
    var r = rnd() * total;
    for (var j = 0; j < table.length; j++) {
      r -= table[j].w || 1;
      if (r <= 0) return table[j];
    }
    return table[table.length - 1];
  }

  function pickN(arr, rnd) {
    return arr[Math.floor(rnd() * arr.length)];
  }

  function gateLabel(type, n) {
    switch (type) {
      case 'add': return '+' + n;
      case 'mul': return '×' + n;
      case 'sub': return '-' + n;
      case 'pickup': return 'GUN +' + n;
      default: return String(type);
    }
  }

  /** Derive combat stats from weapon level. */
  function weaponStats(level) {
    var lv = clamp(level | 0, 1, MAX_WEAPON);
    return {
      level: lv,
      damage: lv,
      pellets: clamp(1 + Math.floor((lv - 1) / 4), 1, MAX_PELLETS),
      fireInterval: Math.max(70, 300 - lv * 10),
      firepower: lv * clamp(1 + Math.floor((lv - 1) / 4), 1, MAX_PELLETS)
    };
  }

  /**
   * Apply gate → weaponLevel change.
   * @returns {{ weaponLevel, delta, text, kind }}
   */
  function applyGate(state, gate) {
    var before = state.weaponLevel;
    var lv = before;
    var text = gateLabel(gate.type, gate.n);
    var kind = gate.type;

    switch (gate.type) {
      case 'add':
      case 'pickup':
        lv = clamp(lv + gate.n, 1, MAX_WEAPON);
        break;
      case 'mul':
        lv = clamp(lv * Math.max(1, gate.n), 1, MAX_WEAPON);
        break;
      case 'sub':
        lv = clamp(lv - gate.n, 1, MAX_WEAPON);
        break;
      default:
        break;
    }

    return {
      weaponLevel: lv,
      delta: lv - before,
      text: text,
      kind: kind
    };
  }

  function ensurePositiveGate(row, table, rnd) {
    var hasPos = false;
    for (var i = 0; i < row.length; i++) {
      if (POSITIVE[row[i].type]) {
        hasPos = true;
        break;
      }
    }
    if (hasPos) return row;
    var posTable = [];
    for (var j = 0; j < table.length; j++) {
      if (POSITIVE[table[j].type]) posTable.push(table[j]);
    }
    if (!posTable.length) {
      row[0] = { type: 'add', n: 1, lane: row[0].lane };
      return row;
    }
    var pick = pickWeighted(posTable, rnd);
    var n = Array.isArray(pick.n) ? pickN(pick.n, rnd) : pick.n;
    row[0] = { type: pick.type, n: n, lane: row[0].lane };
    return row;
  }

  function makeGateRow(cfg, distance, rnd, lanes) {
    var table = cfg.gateTable || [
      { type: 'add', n: [1, 3, 5, 8], w: 4 },
      { type: 'mul', n: [2], w: 1 },
      { type: 'sub', n: [2, 3], w: 1 }
    ];
    var count = cfg.gatesPerRow || 2;
    count = clamp(count, 2, lanes);
    var used = {};
    var row = [];
    for (var i = 0; i < count; i++) {
      var lane;
      do {
        lane = Math.floor(rnd() * lanes);
      } while (used[lane] && Object.keys(used).length < lanes);
      used[lane] = 1;
      var ent = pickWeighted(table, rnd);
      var n = Array.isArray(ent.n) ? pickN(ent.n, rnd) : ent.n;
      row.push({
        id: 'g' + distance + '_' + i + '_' + lane,
        type: ent.type,
        n: n,
        lane: lane,
        z: distance,
        hit: false
      });
    }
    return ensurePositiveGate(row, table, rnd);
  }

  function makePickup(cfg, distance, lane, rnd) {
    var bonus = cfg.pickupBonus || [5, 8, 10];
    var n = Array.isArray(bonus) ? pickN(bonus, rnd) : bonus;
    return {
      id: 'p' + distance + '_' + lane,
      type: 'pickup',
      n: n,
      lane: lane,
      z: distance,
      hit: false,
      kind: rnd() < 0.5 ? 'chainsaw' : 'cannon'
    };
  }

  function makeZombiePack(cfg, distance, rnd, lanes) {
    var table = cfg.enemyTable || [
      { kind: 'grunt', hp: [8, 12, 16], w: 5 }
    ];
    var packSize = cfg.packSize || [4, 7];
    var minN = Array.isArray(packSize) ? packSize[0] : 4;
    var maxN = Array.isArray(packSize) ? packSize[1] : 7;
    var count = minN + Math.floor(rnd() * (maxN - minN + 1));
    var zombies = [];
    for (var i = 0; i < count; i++) {
      var ent = pickWeighted(table, rnd);
      var hp = Array.isArray(ent.hp) ? pickN(ent.hp, rnd) : ent.hp;
      // Mix: on-lane blockers + side-front horde (offset lane for visibility)
      var onLane = rnd() < 0.55;
      var lane = Math.floor(rnd() * lanes);
      var side = onLane ? 0 : (rnd() < 0.5 ? -1 : 1) * (0.6 + rnd() * 1.2);
      var zJitter = rnd() * 40;
      zombies.push({
        id: 'z' + distance + '_' + i,
        kind: ent.kind || 'grunt',
        hp: hp,
        maxHp: hp,
        lane: lane,
        laneOffset: side,
        z: distance + zJitter,
        alive: true,
        approach: 12 + rnd() * 16,
        radius: ent.kind === 'boss' ? 0.55 : ent.kind === 'elite' ? 0.42 : 0.36,
        scale: ent.kind === 'boss' ? 1.6 : ent.kind === 'elite' ? 1.25 : 1
      });
    }
    return zombies;
  }

  function createState(cfg, defaults, seed) {
    defaults = defaults || {};
    var lanes = defaults.lanes || 3;
    var rnd = mulberry32(seed == null ? 1 : seed);
    var startLv = cfg.startWeapon != null ? cfg.startWeapon : (cfg.startPower != null ? Math.max(1, Math.floor(cfg.startPower / 3)) : 3);

    var state = {
      status: 'running',
      failReason: null,
      lanes: lanes,
      lane: 1,
      laneVisual: 1,
      laneChangeMs: defaults.laneChangeMs || 120,
      laneT: 1,
      weaponLevel: startLv,
      score: 0,
      kills: 0,
      distance: 0,
      targetDistance: cfg.targetDistance || 0,
      speed: cfg.baseSpeed || 160,
      baseSpeed: cfg.baseSpeed || 160,
      maxSpeed: cfg.maxSpeed || 280,
      accel: cfg.accel || 0.03,
      shake: 0,
      flash: 0,
      time: 0,
      fireCd: 0,
      seed: seed,
      rnd: rnd,
      cfg: cfg,
      defaults: defaults,
      gates: [],
      pickups: [],
      zombies: [],
      bullets: [],
      nextGateAt: 120,
      nextPackAt: 200,
      nextPickupAt: 280,
      gateGap: cfg.gateGap || 160,
      enemyGap: cfg.enemyGap || 180,
      playerHitZ: 8,
      bulletSpeed: 520,
      combo: 0,
      maxCombo: 0,
      endless: cfg.id === 'endless',
      levelId: cfg.id,
      levelName: cfg.name || '',
      _events: []
    };

    // Seed first content so player sees gates + zombies immediately
    spawnGateRow(state, 140);
    spawnPack(state, 220);
    spawnPack(state, 260);
    spawnGateRow(state, 320);
    spawnPickupRow(state, 380);
    spawnPack(state, 420);
    state.nextGateAt = 480;
    state.nextPackAt = 500;
    state.nextPickupAt = 620;

    return state;
  }

  function spawnGateRow(state, z) {
    var row = makeGateRow(state.cfg, z, state.rnd, state.lanes);
    for (var i = 0; i < row.length; i++) state.gates.push(row[i]);
  }

  function spawnPack(state, z) {
    var pack = makeZombiePack(state.cfg, z, state.rnd, state.lanes);
    for (var i = 0; i < pack.length; i++) state.zombies.push(pack[i]);
  }

  function spawnPickupRow(state, z) {
    var lanes = state.lanes;
    var count = 1 + (state.rnd() < 0.45 ? 1 : 0);
    var used = {};
    for (var i = 0; i < count; i++) {
      var lane;
      do {
        lane = Math.floor(state.rnd() * lanes);
      } while (used[lane]);
      used[lane] = 1;
      state.pickups.push(makePickup(state.cfg, z, lane, state.rnd));
    }
  }

  function requestLane(state, dir) {
    if (state.status !== 'running') return;
    var next = clamp(state.lane + dir, 0, state.lanes - 1);
    if (next === state.lane) return;
    state.lane = next;
    state.laneT = 0;
  }

  function updateLaneVisual(state, dt) {
    var ms = state.laneChangeMs || 120;
    state.laneT = clamp(state.laneT + dt / ms, 0, 1);
    var t = state.laneT;
    t = t * t * (3 - 2 * t);
    state.laneVisual = lerp(state.laneVisual, state.lane, t < 1 ? 0.35 + t * 0.65 : 1);
    if (Math.abs(state.laneVisual - state.lane) < 0.01) state.laneVisual = state.lane;
  }

  function tryFire(state) {
    if (state.fireCd > 0) return;
    var stats = weaponStats(state.weaponLevel);
    state.fireCd = stats.fireInterval;

    var pellets = stats.pellets;
    var baseLane = state.laneVisual;
    for (var i = 0; i < pellets; i++) {
      var spread = pellets === 1 ? 0 : (i / (pellets - 1) - 0.5) * 0.55;
      state.bullets.push({
        id: 'b' + state.time + '_' + i,
        lane: baseLane + spread,
        z: state.playerHitZ + 2,
        damage: stats.damage,
        alive: true,
        life: 1.2
      });
    }
    state._events.push({ type: 'shoot', pellets: pellets, level: stats.level });
  }

  function updateBullets(state, dt) {
    var speed = state.bulletSpeed;
    var dz = speed * (dt / 1000);
    for (var i = state.bullets.length - 1; i >= 0; i--) {
      var b = state.bullets[i];
      if (!b.alive) {
        state.bullets.splice(i, 1);
        continue;
      }
      b.z += dz;
      b.life -= dt / 1000;
      if (b.life <= 0 || b.z > state.distance + 900) {
        b.alive = false;
        state.bullets.splice(i, 1);
        continue;
      }
      // Hit test vs zombies
      for (var j = 0; j < state.zombies.length; j++) {
        var z = state.zombies[j];
        if (!z.alive) continue;
        var zLane = z.lane + (z.laneOffset || 0);
        if (Math.abs(b.lane - zLane) > 0.7) continue;
        if (Math.abs(b.z - (z.z - state.distance)) > 18) continue;
        // hit
        z.hp -= b.damage;
        b.alive = false;
        state.bullets.splice(i, 1);
        state._events.push({
          type: 'hit',
          zombie: z,
          damage: b.damage,
          lane: zLane,
          worldZ: z.z
        });
        if (z.hp <= 0) {
          z.alive = false;
          z.hp = 0;
          state.kills++;
          state.combo++;
          if (state.combo > state.maxCombo) state.maxCombo = state.combo;
          var pts = Math.floor(z.maxHp * (1 + state.combo * 0.08));
          state.score += pts;
          state._events.push({
            type: 'kill',
            zombie: z,
            points: pts,
            lane: zLane,
            worldZ: z.z
          });
          state.shake = Math.max(state.shake, z.kind === 'boss' ? 1.2 : z.kind === 'elite' ? 0.7 : 0.35);
        }
        break;
      }
    }
  }

  function updateZombies(state, dt) {
    var playerWorldZ = state.distance;
    for (var i = state.zombies.length - 1; i >= 0; i--) {
      var z = state.zombies[i];
      if (!z.alive) {
        // keep corpses briefly via render; prune far dead
        if (z.z < playerWorldZ - 40) state.zombies.splice(i, 1);
        continue;
      }
      // Approach player: reduce world z toward player
      z.z -= z.approach * (dt / 1000);
      var rel = z.z - playerWorldZ;
      if (rel < -30) {
        state.zombies.splice(i, 1);
        continue;
      }
      // Contact death — only when zombie is in front/at player and visible band
      if (rel <= state.playerHitZ + 4 && rel >= -2) {
        var zLane = z.lane + (z.laneOffset || 0);
        var laneDist = Math.abs(zLane - state.laneVisual);
        var touchR = (z.radius || 0.36) + 0.25;
        if (laneDist < touchR) {
          state.status = 'lost';
          state.failReason = 'zombie_contact';
          state._events.push({
            type: 'death',
            reason: 'zombie_contact',
            zombie: z,
            lane: zLane,
            worldZ: z.z
          });
          return;
        }
      }
    }
  }

  function updateGatesAndPickups(state) {
    var playerZ = state.distance;
    var hitBand = 12;

    function checkList(list, isPickup) {
      for (var i = 0; i < list.length; i++) {
        var g = list[i];
        if (g.hit) continue;
        var rel = g.z - playerZ;
        if (rel < -20) {
          g.hit = true;
          continue;
        }
        if (rel <= hitBand && rel >= -2) {
          if (Math.abs(g.lane - state.lane) < 0.5) {
            g.hit = true;
            var result = applyGate(state, g);
            state.weaponLevel = result.weaponLevel;
            state._events.push({
              type: isPickup ? 'pickup' : 'gate',
              gate: g,
              result: result
            });
            if (result.delta > 0) {
              state.shake = Math.max(state.shake, g.type === 'mul' ? 0.9 : 0.45);
              state.flash = Math.max(state.flash, 0.2);
            } else if (result.delta < 0) {
              state.shake = Math.max(state.shake, 0.55);
            }
          }
        }
      }
    }

    checkList(state.gates, false);
    checkList(state.pickups, true);
  }

  function spawnAhead(state) {
    var cfg = state.cfg;
    while (state.nextGateAt < state.distance + 700) {
      spawnGateRow(state, state.nextGateAt);
      var gap = state.gateGap;
      if (state.endless) {
        gap = Math.max(cfg.gateGapMin || 90, (cfg.gateGapStart || 160) - state.distance * 0.02);
      }
      state.nextGateAt += gap;
    }
    while (state.nextPackAt < state.distance + 750) {
      spawnPack(state, state.nextPackAt);
      // denser visible packs
      if (state.rnd() < 0.5) spawnPack(state, state.nextPackAt + 35);
      var egap = state.enemyGap;
      if (state.endless) {
        egap = Math.max(cfg.enemyGapMin || 100, (cfg.enemyGapStart || 190) - state.distance * 0.025);
      }
      state.nextPackAt += egap;
    }
    while (state.nextPickupAt < state.distance + 700) {
      spawnPickupRow(state, state.nextPickupAt);
      state.nextPickupAt += 220 + state.rnd() * 160;
    }
  }

  function pruneFar(state) {
    var minZ = state.distance - 50;
    state.gates = state.gates.filter(function (g) {
      return g.z > minZ && !g.hit;
    });
    state.pickups = state.pickups.filter(function (g) {
      return g.z > minZ && !g.hit;
    });
  }

  /**
   * Advance simulation by dt ms.
   * @returns {Array} events this tick
   */
  function step(state, dt, input) {
    state._events = [];
    if (state.status !== 'running') return state._events;

    dt = clamp(dt, 0, 50);
    state.time += dt;

    if (input) {
      if (input.left) requestLane(state, -1);
      if (input.right) requestLane(state, 1);
    }
    updateLaneVisual(state, dt);

    // Speed ramp
    state.speed = clamp(state.speed + state.accel * dt, state.baseSpeed, state.maxSpeed);
    if (state.endless) {
      var bumps = Math.floor(state.distance / 500);
      var bump = (state.cfg.speedBumpPer500 || 15) * bumps;
      state.speed = clamp(state.baseSpeed + bump + state.accel * state.time * 0.02, state.baseSpeed, state.maxSpeed);
    }

    state.distance += state.speed * (dt / 1000);

    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt / 180);
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt / 400);

    spawnAhead(state);
    updateGatesAndPickups(state);

    state.fireCd = Math.max(0, state.fireCd - dt);
    // Auto-fire when any zombie is ahead in engagement range
    var hasTarget = false;
    for (var i = 0; i < state.zombies.length; i++) {
      var z = state.zombies[i];
      if (!z.alive) continue;
      var rel = z.z - state.distance;
      if (rel > 10 && rel < 520) {
        hasTarget = true;
        break;
      }
    }
    if (hasTarget) tryFire(state);

    updateBullets(state, dt);
    if (state.status !== 'running') return state._events;

    updateZombies(state, dt);
    if (state.status !== 'running') return state._events;

    pruneFar(state);

    // Win condition
    if (!state.endless && state.targetDistance > 0 && state.distance >= state.targetDistance) {
      state.status = 'won';
      state._events.push({ type: 'win', distance: state.distance, score: state.score, kills: state.kills });
    }

    // Decay combo if no recent kill — soft
    if (state.combo > 0 && state._events.every(function (e) { return e.type !== 'kill'; })) {
      // no decay per frame; decay handled by idle timer via comboWindow
    }

    return state._events;
  }

  function getHUD(state) {
    var ws = weaponStats(state.weaponLevel);
    return {
      weaponLevel: ws.level,
      damage: ws.damage,
      pellets: ws.pellets,
      firepower: ws.firepower,
      fireInterval: ws.fireInterval,
      score: state.score,
      kills: state.kills,
      distance: Math.floor(state.distance),
      targetDistance: state.targetDistance,
      progress: state.targetDistance ? clamp(state.distance / state.targetDistance, 0, 1) : 0,
      status: state.status,
      failReason: state.failReason,
      combo: state.combo,
      levelName: state.levelName,
      levelId: state.levelId
    };
  }

  // --- Simulation helpers for tests ---
  function simulate(cfg, defaults, seed, steps, policy) {
    var state = createState(cfg, defaults, seed);
    policy = policy || 'prefer_add';
    for (var s = 0; s < steps && state.status === 'running'; s++) {
      var input = { left: false, right: false };
      // Look for nearest unhit gate ahead
      var best = null;
      var bestRel = 1e9;
      for (var i = 0; i < state.gates.length; i++) {
        var g = state.gates[i];
        if (g.hit) continue;
        var rel = g.z - state.distance;
        if (rel < 5 || rel > 200) continue;
        if (rel < bestRel) {
          bestRel = rel;
          best = g;
        }
      }
      // Also prefer pickups
      for (var p = 0; p < state.pickups.length; p++) {
        var pk = state.pickups[p];
        if (pk.hit) continue;
        var pr = pk.z - state.distance;
        if (pr > 5 && pr < bestRel && pr < 200) {
          bestRel = pr;
          best = pk;
        }
      }
      if (best) {
        var targetLane = best.lane;
        if (policy === 'prefer_add') {
          // among gates in same row (similar z), pick highest add/mul
          var rowBest = best;
          var rowScore = -1e9;
          function scoreGate(g) {
            if (g.type === 'mul') return 1000 + g.n * 50;
            if (g.type === 'add' || g.type === 'pickup') return 100 + g.n;
            if (g.type === 'sub') return -g.n;
            return 0;
          }
          var all = state.gates.concat(state.pickups);
          for (var k = 0; k < all.length; k++) {
            var cand = all[k];
            if (cand.hit) continue;
            if (Math.abs(cand.z - best.z) > 15) continue;
            var sc = scoreGate(cand);
            if (sc > rowScore) {
              rowScore = sc;
              rowBest = cand;
            }
          }
          targetLane = rowBest.lane;
        }
        if (state.lane < targetLane) input.right = true;
        else if (state.lane > targetLane) input.left = true;
      }
      step(state, 16, input);
    }
    return state;
  }

  var NGCore = {
    clamp: clamp,
    lerp: lerp,
    mulberry32: mulberry32,
    weaponStats: weaponStats,
    applyGate: applyGate,
    gateLabel: gateLabel,
    makeGateRow: makeGateRow,
    makeZombiePack: makeZombiePack,
    createState: createState,
    requestLane: requestLane,
    step: step,
    getHUD: getHUD,
    simulate: simulate,
    POSITIVE: POSITIVE,
    MAX_WEAPON: MAX_WEAPON,
    MAX_PELLETS: MAX_PELLETS
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = NGCore;
  }
  global.NGCore = NGCore;
})(typeof window !== 'undefined' ? window : global);
