/**
 * Number Gate Runner — pure game logic (no DOM/Canvas).
 * Exposes global NGCore for browser and Node tests.
 */
(function (global) {
  'use strict';

  var POSITIVE = { add: 1, mul: 1, shield: 1, scoreMul: 1 };
  var NEGATIVE = { sub: 1, div: 1, bomb: 1 };

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
      case 'div': return '÷' + n;
      case 'bomb': return 'BOMB';
      case 'shield': return 'SHIELD';
      case 'scoreMul': return 'SCORE+';
      default: return String(type);
    }
  }

  /**
   * Apply a gate operation to player state.
   * @returns {{ power, shield, scoreMult, delta, text, kind }}
   */
  function applyGate(state, gate, defaults) {
    var power = state.power;
    var shield = !!state.shield;
    var scoreMult = state.scoreMult || 1;
    var maxMult = (defaults && defaults.maxScoreMult) || 4;
    var minP = (defaults && defaults.minPower) || 1;
    var delta = 0;
    var text = gateLabel(gate.type, gate.n);
    var kind = gate.type;
    var before = power;

    switch (gate.type) {
      case 'add':
        power = power + gate.n;
        delta = power - before;
        break;
      case 'mul':
        power = power * gate.n;
        delta = power - before;
        break;
      case 'sub':
        power = Math.max(minP, power - gate.n);
        delta = power - before;
        break;
      case 'div':
        power = Math.max(minP, Math.floor(power / Math.max(1, gate.n)));
        delta = power - before;
        break;
      case 'bomb':
        if (shield) {
          shield = false;
          text = 'SHIELD!';
          kind = 'shieldBreak';
          delta = 0;
        } else {
          power = Math.max(minP, Math.floor(power * 0.5));
          delta = power - before;
        }
        break;
      case 'shield':
        shield = true;
        delta = 0;
        break;
      case 'scoreMul':
        scoreMult = Math.min(maxMult, scoreMult + 0.5);
        delta = 0;
        text = '×' + scoreMult.toFixed(1);
        break;
      default:
        break;
    }

    return {
      power: power,
      shield: shield,
      scoreMult: scoreMult,
      delta: delta,
      text: text,
      kind: kind,
      before: before
    };
  }

  /**
   * Combat resolution.
   * @returns {{ killed, power, shield, scoreGain, combo, outcome }}
   */
  function resolveCombat(state, enemy, defaults) {
    var power = state.power;
    var shield = !!state.shield;
    var scoreMult = state.scoreMult || 1;
    var combo = state.combo || 0;
    var hp = enemy.hp;

    if (power >= hp) {
      var factor = 1 + combo * 0.1;
      var scoreGain = Math.floor(hp * scoreMult * factor);
      return {
        killed: true,
        power: power,
        shield: shield,
        scoreGain: scoreGain,
        combo: combo + 1,
        outcome: 'kill',
        damage: 0
      };
    }

    if (shield) {
      return {
        killed: false,
        power: power,
        shield: false,
        scoreGain: 0,
        combo: 0,
        outcome: 'blocked',
        damage: 0
      };
    }

    var damage = hp;
    var newPower = Math.max(0, power - damage);
    return {
      killed: false,
      power: newPower,
      shield: false,
      scoreGain: 0,
      combo: 0,
      outcome: newPower <= 0 ? 'dead' : 'hurt',
      damage: damage
    };
  }

  function makeGate(type, n, lane, z, id) {
    return {
      id: id,
      kind: 'gate',
      type: type,
      n: n || 1,
      lane: lane,
      z: z,
      consumed: false,
      label: gateLabel(type, n)
    };
  }

  function makeEnemy(kind, hp, lane, z, id, label) {
    return {
      id: id,
      kind: 'enemy',
      enemyKind: kind,
      hp: hp,
      lane: lane,
      z: z,
      consumed: false,
      dead: false,
      label: label || null
    };
  }

  function ensurePositiveGate(gates, table, rnd, lanePrefer) {
    var hasPos = gates.some(function (g) { return POSITIVE[g.type]; });
    if (hasPos) return gates;
    var posEntries = table.filter(function (t) { return POSITIVE[t.type]; });
    if (!posEntries.length) {
      posEntries = [{ type: 'add', n: [10], w: 1 }];
    }
    var entry = pickWeighted(posEntries, rnd);
    var n = pickN(entry.n, rnd);
    var lane = lanePrefer != null ? lanePrefer : gates[0].lane;
    // replace first negative
    for (var i = 0; i < gates.length; i++) {
      if (NEGATIVE[gates[i].type]) {
        gates[i] = makeGate(entry.type, n, gates[i].lane, gates[i].z, gates[i].id);
        return gates;
      }
    }
    gates[0] = makeGate(entry.type, n, lane, gates[0].z, gates[0].id);
    return gates;
  }

  /**
   * Spawn a row of gates across lanes.
   */
  function spawnGateRow(cfg, z, idGen, rnd) {
    var lanes = cfg.lanes || 3;
    var count = cfg.gatesPerRow || 2;
    if (count > lanes) count = lanes;
    var table = cfg.gateTable;
    var laneOrder = [];
    for (var i = 0; i < lanes; i++) laneOrder.push(i);
    // shuffle
    for (var s = laneOrder.length - 1; s > 0; s--) {
      var j = Math.floor(rnd() * (s + 1));
      var tmp = laneOrder[s];
      laneOrder[s] = laneOrder[j];
      laneOrder[j] = tmp;
    }
    var chosenLanes = laneOrder.slice(0, count).sort();
    var gates = [];
    for (var k = 0; k < chosenLanes.length; k++) {
      var entry = pickWeighted(table, rnd);
      var n = pickN(entry.n, rnd);
      gates.push(makeGate(entry.type, n, chosenLanes[k], z, idGen()));
    }
    return ensurePositiveGate(gates, table, rnd, chosenLanes[0]);
  }

  function spawnEnemy(cfg, z, idGen, rnd, hpScale) {
    var entry = pickWeighted(cfg.enemyTable, rnd);
    var hp = pickN(entry.hp, rnd);
    if (hpScale) hp = Math.max(1, Math.floor(hp * hpScale));
    var lane = Math.floor(rnd() * (cfg.lanes || 3));
    return makeEnemy(entry.kind, hp, lane, z, idGen());
  }

  function spawnBoss(cfg, z, idGen) {
    var b = cfg.boss;
    return makeEnemy('boss', b.hp, 1, z, idGen(), b.label || 'BOSS');
  }

  /**
   * Create initial run state.
   */
  function createState(levelCfg, defaults, seed) {
    var rnd = mulberry32(seed == null ? (Date.now() & 0xffffffff) : seed);
    var id = 1;
    function idGen() { return id++; }

    var isEndless = !!(levelCfg && levelCfg.id === 'endless');
    var state = {
      status: 'playing',
      levelId: levelCfg.id,
      levelName: levelCfg.name,
      isEndless: isEndless,
      power: levelCfg.startPower,
      shield: false,
      score: 0,
      scoreMult: 1,
      combo: 0,
      comboTimer: 0,
      distance: 0,
      speed: levelCfg.baseSpeed,
      baseSpeed: levelCfg.baseSpeed,
      maxSpeed: levelCfg.maxSpeed,
      accel: levelCfg.accel || 0.03,
      lane: 1,
      targetLane: 1,
      laneT: 1,
      lanes: defaults.lanes || 3,
      laneChangeMs: defaults.laneChangeMs || 120,
      playerZ: defaults.playerZ || 0.78,
      hitBand: defaults.hitBand || 0.06,
      minPower: defaults.minPower || 1,
      maxScoreMult: defaults.maxScoreMult || 4,
      comboWindowMs: defaults.comboWindowMs || 2500,
      entities: [],
      nextGateAt: 120,
      nextEnemyAt: 200,
      bossSpawned: false,
      targetDistance: levelCfg.targetDistance || 0,
      gateGap: levelCfg.gateGap || levelCfg.gateGapStart || 160,
      enemyGap: levelCfg.enemyGap || levelCfg.enemyGapStart || 190,
      levelCfg: levelCfg,
      defaults: defaults,
      rnd: rnd,
      idGen: idGen,
      seed: seed,
      shake: 0,
      events: [],
      time: 0,
      won: false,
      hpScale: 1,
      segment: 0
    };
    return state;
  }

  function effectiveLane(state) {
    if (state.laneT < 1) {
      return state.laneT < 0.5 ? state.lane : state.targetLane;
    }
    return state.lane;
  }

  function setLaneTarget(state, dir) {
    // dir: -1 left, +1 right
    var next = clamp(state.targetLane + dir, 0, state.lanes - 1);
    if (next === state.targetLane && state.laneT >= 1) return false;
    if (next === state.targetLane) return false;
    state.lane = state.targetLane;
    state.targetLane = next;
    state.laneT = 0;
    return true;
  }

  function pushEvent(state, ev) {
    state.events.push(ev);
  }

  /**
   * Advance simulation by dt seconds.
   */
  function step(state, dt, input) {
    state.events = [];
    if (state.status !== 'playing') return state;

    state.time += dt;

    // Lane transition
    if (state.laneT < 1) {
      state.laneT = Math.min(1, state.laneT + (dt * 1000) / state.laneChangeMs);
      if (state.laneT >= 1) state.lane = state.targetLane;
    }

    if (input) {
      if (input.left) setLaneTarget(state, -1);
      if (input.right) setLaneTarget(state, 1);
    }

    // Speed & distance
    var cfg = state.levelCfg;
    if (state.isEndless) {
      var seg = Math.floor(state.distance / 500);
      if (seg !== state.segment) {
        state.segment = seg;
        state.hpScale = Math.pow(cfg.hpScalePer500 || 1.35, seg);
        state.speed = Math.min(state.maxSpeed, state.baseSpeed + seg * (cfg.speedBumpPer500 || 18));
        state.gateGap = Math.max(cfg.gateGapMin || 90, (cfg.gateGapStart || 160) - seg * 8);
        state.enemyGap = Math.max(cfg.enemyGapMin || 100, (cfg.enemyGapStart || 190) - seg * 10);
      }
      state.speed = Math.min(state.maxSpeed, state.speed + state.accel * dt * 60);
    } else {
      state.speed = Math.min(state.maxSpeed, state.speed + state.accel * dt * 60);
    }

    state.distance += state.speed * dt;

    // Combo timer
    if (state.combo > 0) {
      state.comboTimer -= dt * 1000;
      if (state.comboTimer <= 0) {
        state.combo = 0;
        state.comboTimer = 0;
      }
    }

    // Shake decay
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 4);

    // Spawn gates / enemies (distance-based, entities store absolute z = distance offset ahead)
    // We use "worldZ" as absolute distance marker; player is at state.distance.
    // Entity.z is absolute world position ahead.
    while (state.nextGateAt < state.distance + 900) {
      var gz = state.nextGateAt;
      var row = spawnGateRow(cfg, gz, state.idGen, state.rnd);
      for (var gi = 0; gi < row.length; gi++) state.entities.push(row[gi]);
      state.nextGateAt += state.gateGap + Math.floor(state.rnd() * 40);
    }

    while (state.nextEnemyAt < state.distance + 900) {
      // Avoid overlapping gate rows closely
      if (Math.abs(state.nextEnemyAt - state.nextGateAt) < 40) {
        state.nextEnemyAt += 50;
        continue;
      }
      var ez = state.nextEnemyAt;
      if (!state.isEndless && cfg.boss && !state.bossSpawned && ez >= state.targetDistance) {
        break;
      }
      if (state.isEndless && cfg.bossEvery && Math.floor(ez / cfg.bossEvery) > Math.floor((ez - state.enemyGap) / cfg.bossEvery)) {
        var boss = makeEnemy('boss', Math.floor(200 * state.hpScale), 1, ez, state.idGen(), 'ELITE BOSS');
        state.entities.push(boss);
      } else {
        state.entities.push(spawnEnemy(cfg, ez, state.idGen, state.rnd, state.hpScale));
      }
      state.nextEnemyAt += state.enemyGap + Math.floor(state.rnd() * 50);
    }

    // Campaign boss
    if (!state.isEndless && cfg.boss && !state.bossSpawned && state.distance >= state.targetDistance - 80) {
      state.entities.push(spawnBoss(cfg, state.targetDistance + 40, state.idGen));
      state.bossSpawned = true;
      pushEvent(state, { type: 'boss' });
    }

    // Move relative depth: entity depth = entity.z - distance (0 = at player feet zone conceptually inverted)
    // Hit when entity.z enters [distance, distance + hitBand*view] — use absolute:
    // When entity.z - distance <= nearHit (player catches up)
    var hitNear = 5;
    var hitFar = 25;
    var elane = effectiveLane(state);

    for (var i = 0; i < state.entities.length; i++) {
      var e = state.entities[i];
      if (e.consumed || e.dead) continue;
      var rel = e.z - state.distance;
      if (rel > hitFar) continue;
      if (rel < -30) {
        e.consumed = true;
        continue;
      }
      if (rel <= hitFar && rel >= -5 && e.lane === elane) {
        if (e.kind === 'gate') {
          var gres = applyGate(state, e, state.defaults);
          state.power = gres.power;
          state.shield = gres.shield;
          state.scoreMult = gres.scoreMult;
          e.consumed = true;
          state.shake = Math.max(state.shake, 0.25);
          pushEvent(state, {
            type: 'gate',
            gate: e,
            result: gres,
            xLane: e.lane
          });
          // small score for hitting positive gates
          if (POSITIVE[e.type] && e.type !== 'shield') {
            state.score += Math.max(1, Math.floor(Math.abs(gres.delta) * 0.1 * state.scoreMult));
          }
        } else if (e.kind === 'enemy') {
          var cres = resolveCombat(state, e, state.defaults);
          state.power = cres.power;
          state.shield = cres.shield;
          state.combo = cres.combo;
          if (cres.combo > 0) state.comboTimer = state.comboWindowMs;
          state.score += cres.scoreGain;
          if (cres.killed) {
            e.dead = true;
            e.consumed = true;
            state.shake = Math.max(state.shake, e.enemyKind === 'boss' ? 0.9 : e.enemyKind === 'elite' ? 0.55 : 0.35);
            pushEvent(state, { type: 'kill', enemy: e, result: cres, xLane: e.lane });
            if (e.enemyKind === 'boss' && !state.isEndless) {
              state.status = 'won';
              state.won = true;
              state.score += 500;
              pushEvent(state, { type: 'win' });
            }
          } else {
            e.consumed = true; // contact resolved
            state.shake = Math.max(state.shake, 0.7);
            pushEvent(state, { type: 'combat', enemy: e, result: cres, xLane: e.lane });
            if (cres.outcome === 'dead') {
              state.status = 'lost';
              pushEvent(state, { type: 'lose' });
            }
          }
        }
      }
    }

    // Passive score from distance
    state.score += state.speed * dt * 0.05 * state.scoreMult;

    // Prune far-behind entities
    state.entities = state.entities.filter(function (ent) {
      return (ent.z - state.distance) > -80 && !((ent.consumed || ent.dead) && (ent.z - state.distance) < -20);
    });

    // Endless: never auto-win; campaign without boss kill past distance+grace still running until boss handled
    if (!state.isEndless && state.bossSpawned && state.status === 'playing') {
      var bossAlive = state.entities.some(function (ent) {
        return ent.enemyKind === 'boss' && !ent.dead && !ent.consumed;
      });
      // if boss went off-screen without kill — lose
      if (!bossAlive) {
        var anyBoss = state.entities.some(function (ent) { return ent.enemyKind === 'boss'; });
        // boss was consumed without dead? check events — if we passed target+200 and no win
        if (state.distance > state.targetDistance + 200 && state.status === 'playing') {
          // Look if boss was killed earlier — won flag
          if (!state.won) {
            // Boss missed (wrong lane) — lose
            state.status = 'lost';
            pushEvent(state, { type: 'lose', reason: 'boss_missed' });
          }
        }
      }
    }

    return state;
  }

  // Predict power after a gate (for UI hints / tests)
  function previewGate(power, shield, scoreMult, gate, defaults) {
    return applyGate({ power: power, shield: shield, scoreMult: scoreMult }, gate, defaults);
  }

  var API = {
    applyGate: applyGate,
    resolveCombat: resolveCombat,
    spawnGateRow: spawnGateRow,
    spawnEnemy: spawnEnemy,
    spawnBoss: spawnBoss,
    createState: createState,
    step: step,
    setLaneTarget: setLaneTarget,
    effectiveLane: effectiveLane,
    gateLabel: gateLabel,
    previewGate: previewGate,
    clamp: clamp,
    lerp: lerp,
    mulberry32: mulberry32,
    POSITIVE: POSITIVE,
    NEGATIVE: NEGATIVE
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  }
  global.NGCore = API;
})(typeof window !== 'undefined' ? window : global);
