'use strict';
// endless.js -- "Log phase": a climb generated from a seed. Each band of 10 rows is
// one "generation"; 20 generations lead up to an MS at the top. The name and the
// 2^n cell counter are game metaphors for exponential growth, not a model of it.
//
// Every band follows the level rules in levels.js: four strand steps, each two rows
// above the last with a horizontal gap of at most three tiles, then a strand floor
// with a few gaps. Solid conveyor steps never sit above a step two places below
// (no head bumps), and foam, geysers and enemies keep clear of the take-off and
// landing spots. L.route lists every step so tests/routes.cjs can check the climb.

const LOG_GENS = 20, LOG_BAND = 10, LOG_COLS = 40, LOG_TOP = 8, LOG_FLOOR = 6;

function buildLogPhase(seed) {
  const rnd = mulberry32((seed >>> 0) || 1);
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const rows = LOG_TOP + LOG_GENS * LOG_BAND + LOG_FLOOR;
  const L = newLevel(LOG_COLS, rows);
  const base = rows - LOG_FLOOR;
  const floorRow = g => base - g * LOG_BAND;
  ground(L, 0, LOG_COLS - 1, base);
  put(L, 'start', 3, base - 1);
  landmark(L, 15, base - 6, 'LOG PHASE');
  sign(L, 6, base - 1, 'Climb! The depleted medium rises behind you. Every band you clear is one generation. Fe restores replicates.');
  L.route = []; L.logBase = base;

  // 1) the four steps of every band
  const bands = [];
  for (let g = 1; g <= LOG_GENS; g++) {
    const lower = floorRow(g - 1), d = Math.min(1, (g - 1) / 14), steps = [];
    let dir = rnd() < 0.5 ? -1 : 1;
    for (let i = 1; i <= 4; i++) {
      const len = rnd() < 0.2 + d * 0.5 ? 3 : 4;
      let x0;
      if (i === 1) x0 = ri(3, LOG_COLS - 4 - len);
      else {
        const prev = steps[i - 2], gap = ri(1, d > 0.35 ? 3 : 2);
        const place = s => (s > 0 ? prev.x1 + 1 + gap : prev.x0 - gap - len);
        x0 = place(dir);
        if (x0 < 1 || x0 + len > LOG_COLS - 1) { dir = -dir; x0 = place(dir); }
      }
      steps.push({ x0, x1: x0 + len - 1, row: lower - i * 2, kind: '=' });
      if (rnd() < 0.3) dir = -dir;
    }
    // conveyor steps: only 3 and 4, and only when nothing two steps below is under them
    for (const i of [2, 3]) {
      const s = steps[i], below = steps[i - 2];
      if (rnd() < 0.15 + d * 0.3 && (s.x1 + 1 < below.x0 || s.x0 - 1 > below.x1)) s.kind = rnd() < 0.5 ? '<' : '>';
    }
    bands.push({ g, lower, upper: floorRow(g), d, steps });
  }

  // 2) floors: strands with gaps that stay clear of every take-off and landing
  const zones = row => {
    const z = [];
    for (const b of bands) {
      if (b.upper === row) z.push([b.steps[3].x0 - 4, b.steps[3].x1 + 4]);
      if (b.lower === row) z.push([b.steps[0].x0 - 4, b.steps[0].x1 + 4]);
    }
    return z;
  };
  const clearOf = (z, a, b, margin = 0) => z.every(([p, q]) => b < p - margin || a > q + margin);
  for (const b of bands) {
    const row = b.upper;
    plat(L, 0, row, LOG_COLS);
    if (b.g === LOG_GENS) continue;   // the summit floor has no gaps
    // gaps never cut the walk from the landing (below step 4) to the next take-off
    const z = zones(row), gaps = b.d < 0.3 ? 1 : 2;
    const lo = Math.min(...z.map(r => r[0])), hi = Math.max(...z.map(r => r[1]));
    for (let k = 0, made = 0; k < 30 && made < gaps; k++) {
      const w = ri(3, 5), a = ri(1, LOG_COLS - 1 - w);
      if (!clearOf(z, a, a + w - 1) || !(a + w - 1 < lo || a > hi)) continue;
      fill(L, a, a + w - 1, row, row, ' ');
      z.push([a - 3, a + w + 2]); made++;
    }
  }
  // the steps go in after the floors so no gap can cut one
  for (const b of bands) {
    for (const s of b.steps) {
      fill(L, s.x0, s.x1, s.row, s.row, s.kind);
      L.route.push([Math.round((s.x0 + s.x1) / 2), s.row]);
    }
    L.route.push([Math.round((b.steps[3].x0 + b.steps[3].x1) / 2), b.upper]);
  }

  // 3) pickups, hazards and enemies, more of them higher up
  const onFloor = (row, x, w = 1) => { for (let k = 0; k < w; k++) if (L.grid[row][x + k] !== '=' && L.grid[row][x + k] !== '#') return false; return true; };
  const freeSpot = (row, w, margin) => {
    const z = zones(row);
    for (let k = 0; k < 30; k++) {
      const x = ri(2, LOG_COLS - 3 - w);
      if (onFloor(row, x, w) && clearOf(z, x, x + w - 1, margin) && !L.grid[row - 1].slice(x, x + w).some(c => c !== ' ')) return x;
    }
    return -1;
  };
  for (const b of bands) {
    const { g, d, steps, upper, lower } = b;
    for (const s of steps) put(L, 'cystine', Math.round((s.x0 + s.x1) / 2), s.row - 1);
    if (g % 3 === 0) { const x = freeSpot(upper, 1, 1); if (x >= 0) put(L, 'iron', x, upper - 1); }
    if (g % 4 === 2) put(L, 'psm', steps[1].x0, steps[1].row - 1);
    if (g % 7 === 5) put(L, 'xan', steps[2].x1, steps[2].row - 1);
    if (g % 6 === 3) put(L, 'ahpc', steps[3].x0, steps[3].row - 1);
    if (g === LOG_GENS) { put(L, 'goal', Math.round(LOG_COLS / 2) - 1, upper - 1); continue; }
    // a drifting foam clump swings through the gap between steps 2 and 3
    if (rnd() < 0.2 + 0.4 * d) {
      const a = steps[1], c = steps[2], gx = a.x1 < c.x0 ? (a.x1 + c.x0) / 2 : (c.x1 + a.x0) / 2;
      drift(L, Math.round(gx), c.row, 1, 0, ri(200, 260), ri(0, 120));
    }
    if (rnd() < 0.15 + 0.35 * d) { const x = freeSpot(upper, 1, 3); if (x >= 0) geyser(L, x, upper - 1, 3, ri(0, 150)); }
    if (rnd() < 0.15 + 0.3 * d) { const x = freeSpot(upper, 2, 3); if (x >= 0) foam(L, x, x + 1, upper - 1); }
    if (rnd() < 0.25 + 0.35 * d) { const x = freeSpot(upper, 1, 2); if (x >= 0) put(L, 'omv', x, upper - 1); }
    if (d > 0.15 && rnd() < 0.2 + 0.3 * d) { const x = freeSpot(upper, 1, 2); if (x >= 0) put(L, 'lasa', x, upper - 1); }
    if (d > 0.3 && rnd() < 0.15 + 0.35 * d) put(L, 'lasb', Math.round((steps[2].x0 + steps[2].x1) / 2), steps[2].row - 3);
    if (d > 0.35 && rnd() < 0.3) { const x = rnd() < 0.5 ? 1 : LOG_COLS - 2; if (onFloor(upper, x) && clearOf(zones(upper), x, x, 2)) rosgun(L, x, upper - 1); }
    if (d > 0.5 && rnd() < 0.15) put(L, 'hqno', ri(4, LOG_COLS - 5), lower - 5);
    if (rnd() < 0.12) { const x = freeSpot(lower, 1, 2); if (x >= 0) vent(L, x, lower - 1, LOG_BAND); }
    else if (rnd() < 0.1) { const x = freeSpot(lower, 1, 2); if (x >= 0) spring(L, x, lower - 1); }
  }
  return L;
}

// The level definition used by the mode (see modes.js). It has no goals: the MS
// at the top simply ends the climb.
const LOG_PHASE = {
  name: 'Log phase', subtitle: 'An endless-style climb (game mode)', endless: true,
  stages: [() => buildLogPhase(G.logSeed)], timeLimit: 0, medals: [9999, 9999, 9999],
  part2Title: '', part2: '', goals: [],
  theme: {
    sky: ['#fff1d6', '#e8b36a'], far: '#b5793a', matrix: ['#c08a3e', '#5e3e17'],
    cells: ['#f0c04a', '#dea42c', '#e9b53e'], eps: '#ffeab0', plat: ['#8a5a26', '#d39a52'],
    mol: '#a8701f', pyo: 4, accent: '#b45309', bg: 'tsb', weather: 'snow',
  },
  intro: [
    'A game mode, not part of the course experiment.',
    'Climb band after band. Each band you clear is one generation:',
    'the counter doubles your cells. The depleted medium rises behind you.',
  ],
};
