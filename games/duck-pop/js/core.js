/**
 * Duck Pop core — colored ducks shoot same-color pixel columns.
 * Stones (color -1) block shots. No DOM. Global: DPCore
 */
(function (global) {
  'use strict';

  var STONE = -1;
  var COLORS = [
    { id: 0, name: '蓝莓', hex: '#4D96FF', dark: '#2F6FD0', ink: '#fff' },
    { id: 1, name: '葡萄', hex: '#B388FF', dark: '#8A5CF0', ink: '#fff' },
    { id: 2, name: '芒果', hex: '#FF9F1C', dark: '#E07B00', ink: '#3A2500' },
    { id: 3, name: '草莓', hex: '#FF4D6D', dark: '#E0224A', ink: '#fff' },
    { id: 4, name: '柠檬', hex: '#FFE66D', dark: '#F5C400', ink: '#3A3000' },
    { id: 5, name: '海水', hex: '#2EC4B6', dark: '#14998C', ink: '#fff' },
    { id: 6, name: '葡萄柚', hex: '#FF70A6', dark: '#E04580', ink: '#fff' },
    { id: 7, name: '云朵', hex: '#F4F7FB', dark: '#D5DEEA', ink: '#334' },
    { id: 8, name: '抹茶', hex: '#70E000', dark: '#4CAF00', ink: '#143000' },
    { id: 9, name: '墨', hex: '#2B2D42', dark: '#151722', ink: '#fff' }
  ];

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function cloneGrid(grid) {
    return grid.map(function (row) { return row.slice(); });
  }

  function parse(rowStrings) {
    var grid = [];
    var cols = rowStrings[0].length;
    var stones = 0;
    var counts = [];
    for (var i = 0; i < COLORS.length; i++) counts.push(0);
    for (var r = 0; r < rowStrings.length; r++) {
      if (rowStrings[r].length !== cols) throw new Error('Ragged duck row ' + r);
      var row = [];
      for (var c = 0; c < cols; c++) {
        var ch = rowStrings[r].charAt(c);
        if (ch === '.') row.push(null);
        else if (ch === 'X' || ch === 'x') {
          row.push(STONE);
          stones++;
        } else {
          var color = ch.charCodeAt(0) - 48;
          if (color < 0 || color >= COLORS.length) throw new Error('Bad duck color ' + ch);
          row.push(color);
          counts[color]++;
        }
      }
      grid.push(row);
    }
    return { grid: grid, counts: counts, stones: stones, cols: cols, rows: rowStrings.length };
  }

  function buildDucks(counts, bonusRatio, rng) {
    var ducks = [];
    var id = 1;
    for (var color = 0; color < counts.length; color++) {
      var need = counts[color];
      if (!need) continue;
      var bonus = Math.round(need * (bonusRatio || 0));
      var left = need + bonus;
      var chunks = need <= 8 ? 1 : (need <= 20 ? 2 : 3);
      var chunk = Math.max(1, Math.ceil(left / chunks));
      while (left > 0) {
        var ammo = Math.min(left, chunk);
        if (ammo < left && left - ammo < Math.max(2, Math.floor(chunk * 0.4)) && left - ammo > 0) {
          ammo = left;
        }
        ducks.push({ id: id++, color: color, ammo: ammo, max: ammo });
        left -= ammo;
      }
    }
    if (rng) {
      for (var i = ducks.length - 1; i > 0; i--) {
        var j = Math.floor(rng() * (i + 1));
        var tmp = ducks[i];
        ducks[i] = ducks[j];
        ducks[j] = tmp;
      }
    }
    return ducks;
  }

  function create(level, seed) {
    var parsed = parse(level.rows);
    var rng = mulberry32(seed == null ? (level.id * 97 + 3) : seed);
    var ducks = buildDucks(parsed.counts, level.bonus || 0, rng);
    return {
      levelId: level.id,
      name: level.name || ('第' + level.id + '关'),
      grid: parsed.grid,
      rows: parsed.rows,
      cols: parsed.cols,
      ducks: ducks,
      stones: parsed.stones,
      shuffles: level.shuffles == null ? 2 : level.shuffles,
      clears: level.clears == null ? 2 : level.clears,
      stars: level.stars == null ? 2 : level.stars,
      score: 0,
      combo: 0,
      bestCombo: 0,
      chain: 0,
      destroyed: 0,
      shots: 0,
      status: 'play',
      reason: '',
      events: [],
      upgradeCost: 1
    };
  }

  function firstSolid(grid, col) {
    for (var r = grid.length - 1; r >= 0; r--) {
      if (grid[r][col] != null) return { r: r, color: grid[r][col] };
    }
    return null;
  }

  function canShoot(grid, col, color) {
    var face = firstSolid(grid, col);
    return !!(face && face.color === color);
  }

  function planShot(grid, col, color, ammo) {
    var hits = [];
    var left = ammo;
    var blockedBy = null;
    if (col < 0 || col >= grid[0].length || ammo <= 0) {
      return { hits: hits, ammoLeft: ammo, blockedBy: null };
    }
    for (var r = grid.length - 1; r >= 0 && left > 0; r--) {
      var v = grid[r][col];
      if (v == null) continue;
      if (v !== color) {
        blockedBy = v;
        break;
      }
      hits.push({ r: r, c: col, color: color });
      left--;
    }
    return { hits: hits, ammoLeft: left, blockedBy: blockedBy };
  }

  function applyHits(grid, hits) {
    for (var i = 0; i < hits.length; i++) grid[hits[i].r][hits[i].c] = null;
  }

  function collapse(grid) {
    var rows = grid.length;
    var cols = grid[0].length;
    for (var c = 0; c < cols; c++) {
      var stack = [];
      for (var r = rows - 1; r >= 0; r--) {
        if (grid[r][c] != null) stack.push(grid[r][c]);
      }
      for (var r2 = rows - 1; r2 >= 0; r2--) {
        var idx = rows - 1 - r2;
        grid[r2][c] = idx < stack.length ? stack[idx] : null;
      }
    }
    return grid;
  }

  function isClear(grid) {
    for (var r = 0; r < grid.length; r++) {
      for (var c = 0; c < grid[0].length; c++) {
        if (grid[r][c] != null) return false;
      }
    }
    return true;
  }

  function hasMove(state) {
    for (var i = 0; i < state.ducks.length; i++) {
      var duck = state.ducks[i];
      if (duck.ammo <= 0) continue;
      for (var c = 0; c < state.cols; c++) {
        if (canShoot(state.grid, c, duck.color)) return true;
      }
    }
    return false;
  }

  function remainingBlocks(grid) {
    var n = 0;
    for (var r = 0; r < grid.length; r++) {
      for (var c = 0; c < grid[0].length; c++) if (grid[r][c] != null) n++;
    }
    return n;
  }

  function checkStatus(state) {
    if (isClear(state.grid)) {
      state.status = 'win';
      state.reason = 'clear';
      state.events.push({ type: 'win', score: state.score });
      return state.status;
    }
    if (!hasMove(state) && state.clears <= 0 && state.shuffles <= 0) {
      state.status = 'lose';
      state.reason = 'stuck';
      state.events.push({ type: 'lose', reason: 'stuck' });
    }
    return state.status;
  }

  function noteChain(state, hits) {
    state.chain += hits;
    state.combo += 1;
    if (state.chain > state.bestCombo) state.bestCombo = state.chain;
  }

  function fire(state, duckId, col) {
    if (state.status !== 'play') return { ok: false, reason: 'over' };
    var duck = null;
    for (var i = 0; i < state.ducks.length; i++) if (state.ducks[i].id === duckId) duck = state.ducks[i];
    if (!duck || duck.ammo <= 0) return { ok: false, reason: 'duck' };
    if (!canShoot(state.grid, col, duck.color)) return { ok: false, reason: 'blocked' };
    var plan = planShot(state.grid, col, duck.color, duck.ammo);
    if (!plan.hits.length) return { ok: false, reason: 'empty' };
    applyHits(state.grid, plan.hits);
    collapse(state.grid);
    duck.ammo = plan.ammoLeft;
    if (duck.ammo <= 0) {
      state.ducks = state.ducks.filter(function (d) { return d.id !== duck.id; });
    }
    var n = plan.hits.length;
    state.shots++;
    state.destroyed += n;
    noteChain(state, n);
    var gain = n * 10 * Math.max(1, state.combo);
    state.score += gain;
    if (state.destroyed > 0 && state.destroyed % 20 < n) state.stars += 1;
    state.events.push({
      type: 'shot',
      hits: plan.hits,
      n: n,
      text: '+' + n,
      combo: state.combo,
      chain: state.chain,
      color: duck.color,
      col: col,
      score: gain
    });
    checkStatus(state);
    return { ok: true, hits: plan.hits, n: n, ammoLeft: plan.ammoLeft, combo: state.combo, chain: state.chain };
  }

  function breakChain(state) {
    state.combo = 0;
    state.chain = 0;
  }

  function shuffle(state, rng) {
    if (state.status !== 'play') return { ok: false, reason: 'over' };
    if (state.shuffles <= 0) return { ok: false, needAd: true, tool: 'shuffle' };
    var random = rng || Math.random;
    var colors = [];
    for (var r = 0; r < state.rows; r++) {
      for (var c = 0; c < state.cols; c++) {
        if (state.grid[r][c] != null) colors.push(state.grid[r][c]);
      }
    }
    for (var i = colors.length - 1; i > 0; i--) {
      var j = Math.floor(random() * (i + 1));
      var tmp = colors[i];
      colors[i] = colors[j];
      colors[j] = tmp;
    }
    var k = 0;
    for (var r2 = 0; r2 < state.rows; r2++) {
      for (var c2 = 0; c2 < state.cols; c2++) {
        if (state.grid[r2][c2] != null) state.grid[r2][c2] = colors[k++];
      }
    }
    state.shuffles--;
    breakChain(state);
    state.events.push({ type: 'shuffle' });
    checkStatus(state);
    return { ok: true };
  }

  function clearAt(state, r, c) {
    if (state.status !== 'play') return { ok: false, reason: 'over' };
    if (state.clears <= 0) return { ok: false, needAd: true, tool: 'clear' };
    if (r < 0 || c < 0 || r >= state.rows || c >= state.cols) return { ok: false, reason: 'range' };
    if (state.grid[r][c] == null) return { ok: false, reason: 'empty' };
    var color = state.grid[r][c];
    state.grid[r][c] = null;
    collapse(state.grid);
    state.clears--;
    state.destroyed += 1;
    state.score += 5;
    state.events.push({ type: 'clear', r: r, c: c, color: color });
    checkStatus(state);
    return { ok: true, color: color };
  }

  function upgrade(state, duckId) {
    if (state.stars < state.upgradeCost) return { ok: false, reason: 'stars' };
    var duck = null;
    for (var i = 0; i < state.ducks.length; i++) if (state.ducks[i].id === duckId) duck = state.ducks[i];
    if (!duck) return { ok: false, reason: 'duck' };
    state.stars -= state.upgradeCost;
    duck.ammo += 5;
    duck.max += 5;
    state.events.push({ type: 'upgrade', id: duckId, ammo: duck.ammo });
    return { ok: true, ammo: duck.ammo };
  }

  function grant(state, tool) {
    if (tool === 'shuffle') { state.shuffles++; return true; }
    if (tool === 'clear') { state.clears++; return true; }
    if (tool === 'star') { state.stars++; return true; }
    return false;
  }

  function longestShot(state) {
    var best = null;
    for (var i = 0; i < state.ducks.length; i++) {
      var duck = state.ducks[i];
      if (duck.ammo <= 0) continue;
      for (var c = 0; c < state.cols; c++) {
        if (!canShoot(state.grid, c, duck.color)) continue;
        var plan = planShot(state.grid, c, duck.color, duck.ammo);
        if (!best || plan.hits.length > best.n) {
          best = { duckId: duck.id, col: c, n: plan.hits.length };
        }
      }
    }
    return best;
  }

  var DPCore = {
    STONE: STONE,
    COLORS: COLORS,
    mulberry32: mulberry32,
    cloneGrid: cloneGrid,
    create: create,
    firstSolid: firstSolid,
    canShoot: canShoot,
    planShot: planShot,
    applyHits: applyHits,
    collapse: collapse,
    isClear: isClear,
    hasMove: hasMove,
    remainingBlocks: remainingBlocks,
    fire: fire,
    shuffle: shuffle,
    clearAt: clearAt,
    upgrade: upgrade,
    grant: grant,
    breakChain: breakChain,
    longestShot: longestShot,
    buildDucks: buildDucks
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = DPCore;
  global.DPCore = DPCore;
})(typeof window !== 'undefined' ? window : global);
