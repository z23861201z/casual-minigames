/**
 * Doom Gates core — auto-run, slide, auto-fire.
 * Number gates change squad size. Shooting a gate changes its number.
 * Zombie contact or squad 0 is the only fail. Finish weapon needs a headcount.
 * No DOM. Global: DGCore
 */
(function (global) {
  'use strict';

  var MAX_SQUAD = 999;
  var GATE_HITS = 1;
  var FINISH_HITS = 5;

  var WEAPONS = [
    { id: 'fist', name: '拳头', mul: 1, splash: 0 },
    { id: 'pistol', name: '手枪', mul: 2, splash: 0 },
    { id: 'rifle', name: '步枪', mul: 3, splash: 0 },
    { id: 'shotgun', name: '霰弹枪', mul: 4, splash: 0.25 },
    { id: 'gatling', name: '加特林', mul: 6, splash: 0 },
    { id: 'rocket', name: '火箭筒', mul: 8, splash: 0.45 }
  ];

  var KINDS = {
    walker: { hp: 8, r: 0.22, speed: 0.65, collide: true, score: 10 },
    brute: { hp: 34, r: 0.34, speed: 0.42, collide: true, score: 40 },
    crowd: { hp: 6, r: 0.18, speed: 0.2, collide: false, score: 5 }
  };

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
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

  function label(gate) {
    if (!gate) return '';
    if (gate.type === 'add') return '+' + gate.n;
    if (gate.type === 'sub') return '-' + gate.n;
    if (gate.type === 'mul') return '×' + gate.n;
    if (gate.type === 'div') return '÷' + gate.n;
    return String(gate.n);
  }

  function applySquad(squad, gate) {
    var next = squad;
    if (gate.type === 'add') next = squad + gate.n;
    else if (gate.type === 'mul') next = squad * Math.max(1, gate.n);
    else if (gate.type === 'sub') next = squad - gate.n;
    else if (gate.type === 'div') next = Math.floor(squad / Math.max(1, gate.n));
    next = clamp(next, 0, MAX_SQUAD);
    return { squad: next, delta: next - squad, text: label(gate) };
  }

  function improveGate(gate) {
    var beforeType = gate.type;
    var beforeN = gate.n;
    if (gate.type === 'add') gate.n = Math.min(40, gate.n + 1);
    else if (gate.type === 'mul') gate.n = Math.min(4, gate.n + 1);
    else if (gate.type === 'sub') {
      gate.n -= 1;
      if (gate.n <= 0) {
        gate.type = 'add';
        gate.n = 1;
      }
    } else if (gate.type === 'div') {
      gate.n = Math.max(1, gate.n - 1);
      if (gate.n <= 1) {
        gate.type = 'add';
        gate.n = 1;
      }
    }
    return beforeType !== gate.type || beforeN !== gate.n;
  }

  function noteGateHit(gate, hits) {
    gate.hits = (gate.hits || 0) + (hits || 1);
    var improved = 0;
    var guard = 0;
    while (gate.hits >= GATE_HITS && guard++ < 80) {
      gate.hits -= GATE_HITS;
      if (improveGate(gate)) improved++;
      else gate.hits = 0;
    }
    return improved;
  }

  function noteFinishHit(fin, hits) {
    var minNeed = Math.max(1, Math.ceil(fin.baseNeed * 0.55));
    fin.hits = (fin.hits || 0) + (hits || 1);
    var dropped = 0;
    while (fin.hits >= FINISH_HITS && fin.need > minNeed) {
      fin.hits -= FINISH_HITS;
      fin.need -= 1;
      dropped++;
    }
    return dropped;
  }

  function cloneSide(side) {
    return { type: side.type, n: side.n, hits: 0 };
  }

  function makeZombie(t) {
    var kind = KINDS[t.kind] || KINDS.walker;
    return {
      x: t.x,
      z: t.z,
      kind: t.kind || 'walker',
      hp: kind.hp,
      maxHp: kind.hp,
      r: kind.r,
      speed: kind.speed,
      collide: kind.collide !== false,
      score: kind.score,
      alive: true
    };
  }

  function weaponByIndex(i) {
    return WEAPONS[clamp(i | 0, 0, WEAPONS.length - 1)];
  }

  function create(level) {
    return {
      levelId: level.id,
      name: level.name,
      phase: 'run',
      reason: '',
      z: 0,
      x: 0,
      targetX: 0,
      squad: level.startSquad || 1,
      bestSquad: level.startSquad || 1,
      weapon: level.weapon || 0,
      speed: level.speed || 6.2,
      fireCd: 0.05,
      bullets: [],
      zombies: (level.zombies || []).map(makeZombie),
      gates: (level.gates || []).map(function (g) {
        return { z: g.z, used: false, left: cloneSide(g.left), right: cloneSide(g.right) };
      }),
      finish: {
        z: level.finish.z,
        need: level.finish.need,
        baseNeed: level.finish.need,
        weapon: level.finish.weapon,
        name: level.finish.name,
        hits: 0,
        used: false
      },
      score: 0,
      kills: 0,
      time: 0,
      events: [],
      bulletSeq: 1
    };
  }

  function pickSide(x) {
    return x < 0 ? 'left' : 'right';
  }

  function fireInterval(squad) {
    return Math.max(0.05, 0.26 - Math.min(Math.max(1, squad), 40) * 0.0045);
  }

  function volleyCount(squad) {
    return clamp(Math.max(1, squad | 0), 1, 18);
  }

  function bulletDamage(state) {
    var weapon = weaponByIndex(state.weapon);
    return weapon.mul * Math.max(1, Math.ceil(Math.max(1, state.squad) / 5));
  }

  function spawnVolley(state) {
    if (state.squad <= 0 || state.phase !== 'run') return;
    var count = volleyCount(state.squad);
    var spread = Math.min(0.34, 0.08 + count * 0.01);
    var damage = bulletDamage(state);
    var splash = weaponByIndex(state.weapon).splash;
    var side = pickSide(state.x);
    for (var i = 0; i < count; i++) {
      var t = count === 1 ? 0 : (i / (count - 1) - 0.5);
      state.bullets.push({
        id: state.bulletSeq++,
        x: state.x + t * spread,
        z: state.z + 0.55,
        vx: t * spread * 4,
        vz: 32,
        damage: damage,
        splash: splash,
        side: side,
        alive: true
      });
    }
  }

  function killZombie(state, zombie) {
    if (!zombie.alive) return;
    zombie.alive = false;
    zombie.hp = 0;
    state.kills++;
    state.score += zombie.score * Math.max(1, Math.ceil(state.squad / 10));
    state.events.push({ type: 'kill', kind: zombie.kind, x: zombie.x, z: zombie.z, text: '+' + zombie.score });
  }

  function damageZombie(state, zombie, dmg) {
    if (!zombie.alive) return;
    zombie.hp -= dmg;
    state.events.push({ type: 'hit', x: zombie.x, z: zombie.z, text: '-' + dmg, kind: zombie.kind });
    if (zombie.hp <= 0) killZombie(state, zombie);
  }

  function splashAround(state, x, z, dmg, splash) {
    if (!splash || dmg <= 0) return;
    for (var i = 0; i < state.zombies.length; i++) {
      var zombie = state.zombies[i];
      if (!zombie.alive) continue;
      var dx = zombie.x - x;
      var dz = zombie.z - z;
      if (dx * dx + dz * dz <= 0.45 * 0.45) damageZombie(state, zombie, Math.max(1, Math.round(dmg * splash)));
    }
  }

  function lose(state, reason) {
    state.phase = 'lose';
    state.reason = reason;
    state.squad = Math.max(0, state.squad);
    state.events.push({ type: 'lose', reason: reason, squad: state.squad });
  }

  function win(state) {
    state.phase = 'win';
    state.reason = 'weapon';
    state.events.push({
      type: 'win',
      squad: state.squad,
      need: state.finish.need,
      weapon: state.finish.name
    });
  }

  function contact(state, zombie) {
    state.squad -= 1;
    if (state.squad > state.bestSquad) state.bestSquad = state.squad;
    killZombie(state, zombie);
    state.events.push({ type: 'contact', text: '-1', squad: Math.max(0, state.squad), x: zombie.x, z: zombie.z });
    if (state.squad <= 0) lose(state, 'zombie');
  }

  /**
   * Move one bullet until it hits a zombie, a gate, or the weapon gate.
   */
  function moveBullet(state, bullet, dt) {
    var nz = bullet.z + bullet.vz * dt;
    var nx = bullet.x + bullet.vx * dt;
    var marks = [];
    for (var i = 0; i < state.zombies.length; i++) {
      var zombie = state.zombies[i];
      if (!zombie.alive) continue;
      if (zombie.z <= bullet.z || zombie.z > nz + 0.05) continue;
      var travel = Math.max(0.0001, nz - bullet.z);
      var t = (zombie.z - bullet.z) / travel;
      var bx = bullet.x + (nx - bullet.x) * t;
      if (Math.abs(bx - zombie.x) <= zombie.r + 0.06) {
        marks.push({ z: zombie.z, kind: 'zombie', zombie: zombie, x: bx });
      }
    }
    for (var g = 0; g < state.gates.length; g++) {
      var gate = state.gates[g];
      if (gate.used) continue;
      if (gate.z <= bullet.z || gate.z > nz + 0.05) continue;
      var travelG = Math.max(0.0001, nz - bullet.z);
      var tg = (gate.z - bullet.z) / travelG;
      var gx = bullet.x + (nx - bullet.x) * tg;
      if (gx < -1.35 || gx > 1.35) continue;
      marks.push({ z: gate.z, kind: 'gate', gate: gate, side: bullet.side || pickSide(state.x), x: gx });
    }
    var fin = state.finish;
    if (!fin.used && fin.z > bullet.z && fin.z <= nz + 0.05) {
      marks.push({ z: fin.z, kind: 'finish', x: nx });
    }
    marks.sort(function (a, b) { return a.z - b.z; });
    if (!marks.length) {
      bullet.z = nz;
      bullet.x = nx;
      if (bullet.z > state.z + 78) bullet.alive = false;
      return;
    }
    var hit = marks[0];
    bullet.alive = false;
    bullet.z = hit.z;
    bullet.x = hit.x;
    if (hit.kind === 'zombie') {
      damageZombie(state, hit.zombie, bullet.damage);
      splashAround(state, hit.zombie.x, hit.zombie.z, bullet.damage, bullet.splash);
    } else if (hit.kind === 'gate') {
      var side = hit.gate[hit.side];
      var improved = noteGateHit(side, 1);
      if (improved) {
        state.events.push({ type: 'gate-charge', text: label(side), side: hit.side, z: hit.gate.z });
      }
    } else if (hit.kind === 'finish') {
      var dropped = noteFinishHit(state.finish, 1);
      if (dropped) state.events.push({ type: 'need', text: String(state.finish.need), z: state.finish.z });
    }
  }

  function crossGates(state) {
    for (var i = 0; i < state.gates.length; i++) {
      var gate = state.gates[i];
      if (gate.used || state.z < gate.z) continue;
      gate.used = true;
      var sideName = pickSide(state.x);
      var applied = applySquad(state.squad, gate[sideName]);
      state.squad = applied.squad;
      if (state.squad > state.bestSquad) state.bestSquad = state.squad;
      state.score += Math.max(0, applied.delta) * 5;
      state.events.push({
        type: 'gate',
        text: applied.text,
        delta: applied.delta,
        squad: state.squad,
        side: sideName
      });
      if (state.squad <= 0) {
        lose(state, 'gate');
        return;
      }
    }
  }

  function crossFinish(state) {
    if (state.finish.used || state.phase !== 'run') return;
    if (state.z < state.finish.z) return;
    state.finish.used = true;
    if (state.squad >= state.finish.need) win(state);
    else lose(state, 'weapon');
  }

  function step(state, dt) {
    if (state.phase !== 'run') return state;
    dt = clamp(dt, 0, 0.05);
    state.time += dt;
    var dx = state.targetX - state.x;
    var maxStep = 16 * dt;
    if (Math.abs(dx) <= maxStep) state.x = state.targetX;
    else state.x += Math.sign(dx) * maxStep;
    state.x = clamp(state.x, -0.86, 0.86);
    state.targetX = clamp(state.targetX, -0.86, 0.86);
    state.z += state.speed * dt;

    for (var i = 0; i < state.zombies.length; i++) {
      var zombie = state.zombies[i];
      if (!zombie.alive) continue;
      zombie.z -= zombie.speed * dt;
    }

    state.fireCd -= dt;
    if (state.fireCd <= 0) {
      spawnVolley(state);
      state.fireCd = fireInterval(state.squad);
    }

    for (var b = 0; b < state.bullets.length; b++) {
      if (state.bullets[b].alive) moveBullet(state, state.bullets[b], dt);
    }
    state.bullets = state.bullets.filter(function (bullet) { return bullet.alive; });

    if (state.phase !== 'run') return state;

    for (var z = 0; z < state.zombies.length; z++) {
      var mob = state.zombies[z];
      if (!mob.alive || !mob.collide) continue;
      if (mob.z <= state.z + 0.8 && mob.z >= state.z - 0.35 && Math.abs(mob.x - state.x) <= mob.r + 0.26) {
        contact(state, mob);
        if (state.phase !== 'run') return state;
      }
    }

    crossGates(state);
    if (state.phase !== 'run') return state;
    crossFinish(state);
    for (var c = 0; c < state.zombies.length; c++) {
      var behind = state.zombies[c];
      if (behind.alive && behind.z < state.z - 2.4) behind.alive = false;
    }
    return state;
  }

  function previewSquad(squad, gate) {
    return applySquad(squad, gate).squad;
  }

  function betterSide(squad, gate) {
    var left = previewSquad(squad, gate.left);
    var right = previewSquad(squad, gate.right);
    return left > right ? 'left' : 'right';
  }

  /**
   * Greedy campaign bot: take the higher squad gate, otherwise aim at the
   * nearest on-road zombie. Used by tests and the balance pass.
   */
  function botTarget(state) {
    var nextGate = null;
    for (var i = 0; i < state.gates.length; i++) {
      if (!state.gates[i].used && state.gates[i].z >= state.z - 0.2) {
        nextGate = state.gates[i];
        break;
      }
    }
    var nearest = null;
    for (var z = 0; z < state.zombies.length; z++) {
      var zombie = state.zombies[z];
      if (!zombie.alive || !zombie.collide) continue;
      var dz = zombie.z - state.z;
      if (dz < -0.2 || dz > 24) continue;
      if (!nearest || dz < nearest.dz) nearest = { dz: dz, x: zombie.x, z: zombie.z };
    }
    if (nextGate && (!nearest || nextGate.z <= nearest.z + 0.4)) {
      return betterSide(state.squad, nextGate) === 'left' ? -0.62 : 0.62;
    }
    if (nearest) return clamp(nearest.x, -0.8, 0.8);
    if (!state.finish.used) return 0;
    return state.x;
  }

  function runBot(level, dt, limit) {
    var state = create(level);
    var guard = 0;
    var cap = limit || 8000;
    while (state.phase === 'run' && guard++ < cap) {
      state.targetX = botTarget(state);
      step(state, dt || 0.05);
    }
    return state;
  }

  function buildEndless(index, seed) {
    var rng = mulberry32(seed == null ? index * 131 + 7 : seed);
    var n = Math.max(1, index | 0);
    var weapon = Math.min(WEAPONS.length - 1, Math.floor((n + 1) / 2));
    var rows = 5 + Math.min(4, n);
    var gates = [];
    var zombies = [];
    var z = 14;
    var positive = [
      { type: 'add', n: 6 + n * 2 },
      { type: 'add', n: 10 + n * 3 },
      { type: 'mul', n: 2 }
    ];
    var negative = [
      { type: 'sub', n: 3 + n },
      { type: 'div', n: 2 }
    ];
    for (var i = 0; i < rows; i++) {
      var good = positive[Math.floor(rng() * positive.length)];
      var bad = negative[Math.floor(rng() * negative.length)];
      var leftGood = rng() < 0.5;
      gates.push({
        z: z,
        left: leftGood ? { type: good.type, n: good.n } : { type: bad.type, n: bad.n },
        right: leftGood ? { type: bad.type, n: bad.n } : { type: good.type, n: good.n }
      });
      z += 12;
      var pack = 3 + Math.floor(i * 0.7) + Math.floor(n / 2);
      for (var k = 0; k < pack; k++) {
        var kind = rng() < 0.22 + n * 0.02 ? 'brute' : 'walker';
        zombies.push({
          z: z + k * 0.8,
          x: -0.7 + rng() * 1.4,
          kind: kind
        });
      }
      if (i % 2 === 0) {
        var side = rng() < 0.5 ? -1 : 1;
        for (var c = 0; c < 4; c++) {
          zombies.push({ z: z + c * 2.2, x: side * (0.58 + rng() * 0.28), kind: 'crowd' });
        }
      }
      z += 14 + pack;
    }
    var need = 18 + n * 22;
    return {
      id: 100 + n,
      name: '无尽 ' + n,
      startSquad: 1,
      weapon: weapon,
      speed: Math.min(8, 6.4 + n * 0.08),
      gates: gates,
      zombies: zombies,
      finish: {
        z: z + 8,
        need: need,
        weapon: Math.min(WEAPONS.length - 1, weapon + 1),
        name: WEAPONS[Math.min(WEAPONS.length - 1, weapon + 1)].name
      }
    };
  }

  var DGCore = {
    MAX_SQUAD: MAX_SQUAD,
    GATE_HITS: GATE_HITS,
    FINISH_HITS: FINISH_HITS,
    WEAPONS: WEAPONS,
    KINDS: KINDS,
    clamp: clamp,
    mulberry32: mulberry32,
    label: label,
    applySquad: applySquad,
    improveGate: improveGate,
    noteGateHit: noteGateHit,
    noteFinishHit: noteFinishHit,
    create: create,
    step: step,
    previewSquad: previewSquad,
    betterSide: betterSide,
    botTarget: botTarget,
    runBot: runBot,
    buildEndless: buildEndless,
    weaponByIndex: weaponByIndex,
    fireInterval: fireInterval,
    volleyCount: volleyCount
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = DGCore;
  global.DGCore = DGCore;
})(typeof window !== 'undefined' ? window : global);
