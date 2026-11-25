'use strict';
// Tile coordinates: row zero is the top; a surface at row r supports a cell at r-1.
// Main-route steps rise at most two rows and never touch static foam.
// All routes are permanently open; timed hazards (geysers, drifting foam) only
// demand timing, never block the way for good.
// Optional reading stations on broad, permanent floors. These are added only
// in Study mode, independently of enemies and collectibles.
const STUDY_STATIONS = [
  [
    [
      { tx: 6, ty: 25, topics: ['TSB', 'strain', 'sulfur'] },
      { tx: 12, ty: 25, topics: ['ribosome', 'psm', 'peptide'] },
      { tx: 54, ty: 17, topics: ['sulfur', 'iron'] },
      { tx: 61, ty: 25, topics: ['replicates'] },
    ],
    [
      { tx: 3, ty: 35, topics: ['psm', 'ribosome'] },
      { tx: 41, ty: 25, topics: ['sulfur', 'peptide'] },
      { tx: 77, ty: 11, topics: ['replicates', 'TSB'] },
    ],
  ],
  [
    [
      { tx: 22, ty: 53, topics: ['SNpulse', 'omv', 'hcn'] },
      { tx: 24, ty: 41, topics: ['ahpc', 'xan', 'proteases'] },
      { tx: 17, ty: 29, topics: ['ros', 'ribosome'] },
      { tx: 15, ty: 15, topics: ['peptide', 'replicates'] },
    ],
    [
      { tx: 6, ty: 75, topics: ['hcn', 'SNpulse'] },
      { tx: 25, ty: 65, topics: ['foam', 'proteases'] },
      { tx: 24, ty: 39, topics: ['hqno', 'iron'] },
    ],
  ],
  [
    [
      { tx: 5, ty: 7, topics: ['SN', 'iron'] },
      { tx: 8, ty: 21, topics: ['proteases', 'hqno', 'omv'] },
      { tx: 22, ty: 47, topics: ['foam', 'xan'] },
      { tx: 49, ty: 47, topics: ['replicates', 'peptide'] },
    ],
    [
      { tx: 44, ty: 7, topics: ['SN', 'foam'] },
      { tx: 8, ty: 20, topics: ['hqno', 'xan'] },
      { tx: 11, ty: 52, topics: ['peptide', 'replicates'] },
    ],
  ],
  [
    [
      { tx: 6, ty: 67, topics: ['CF airway', 'airway'] },
      { tx: 26, ty: 45, topics: ['psm', 'xan', 'ahpc'] },
      { tx: 22, ty: 33, topics: ['airway', 'replicates'] },
      { tx: 37, ty: 11, topics: ['ros', 'peptide'] },
    ],
    [
      { tx: 2, ty: 85, topics: ['airway', 'CF airway'] },
      { tx: 15, ty: 63, topics: ['ahpc', 'xan'] },
      { tx: 20, ty: 31, topics: ['airway', 'psm'] },
      { tx: 37, ty: 11, topics: ['boss', 'ros'] },
    ],
  ],
];
function newLevel(cols, rows) {
  return { cols, rows, grid: Array.from({ length: rows }, () => Array(cols).fill(' ')),
    bg: Array.from({ length: rows }, () => Array(cols).fill(' ')), ents: [], signs: [], ribo: {}, route: [] };
}
function fill(L, x0, x1, y0, y1, ch) {
  for (let y = Math.max(0, y0); y <= Math.min(L.rows - 1, y1); y++)
    for (let x = Math.max(0, x0); x <= Math.min(L.cols - 1, x1); x++) L.grid[y][x] = ch;
}
const solid = (L, x0, x1, y0, y1) => fill(L, x0, x1, y0, y1, '#');
const ground = (L, x0, x1, y) => fill(L, x0, x1, y, L.rows - 1, '#');
// A gap in the floor that drops out of the level.
const pit = (L, x0, x1, y) => fill(L, x0, x1, y, L.rows - 1, ' ');
const carve = (L, x0, x1, y0, y1) => {
  fill(L, x0, x1, y0, y1, ' ');
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) L.bg[y][x] = 'c';
};
const plat = (L, x, y, len) => fill(L, x, x + len - 1, y, y, '=');
const lysed = (L, x, y, len) => fill(L, x, x + len - 1, y, y, '%');
// Static rhamnolipid foam sits in the cell above a surface; only its lower part hurts.
const foam = (L, x0, x1, y) => fill(L, x0, x1, y, y, '^');
const mucus = (L, x0, x1, y) => fill(L, x0, x1, y, y, '~');
// Conveyor tiles: beating cilia in the CF airway, flow channels in the cultures.
const cilia = (L, x0, x1, y, dir) => fill(L, x0, x1, y, y, dir < 0 ? '<' : '>');
const flow = cilia;
const debris = (L, x0, x1, y0, y1) => fill(L, x0, x1, y0, y1, 'B');
const ribo = (L, x, y, item) => { fill(L, x, x, y, y, 'R'); L.ribo[x + ',' + y] = item; };
const put = (L, type, x, y, extra = {}) => L.ents.push({ type, tx: x, ty: y, ...extra });
const row = (L, type, x0, x1, y) => { for (let x = x0; x <= x1; x++) put(L, type, x, y); };
const sign = (L, x, y, text) => L.signs.push({ tx: x, ty: y, text });
const arrow = (L, x, y, dir) => put(L, 'arrow', x, y, { dir });
const vent = (L, x, y, rise) => put(L, 'vent', x, y, { rise });
const spring = (L, x, y) => put(L, 'spring', x, y);
const rosgun = (L, x, y) => put(L, 'rosgun', x, y);
const landmark = (L, x, y, label) => put(L, 'landmark', x, y, { label });
// A foam geyser erupts a column `h` tiles high; `phase` (frames) staggers neighbours.
const geyser = (L, x, y, h, phase = 0) => put(L, 'geyser', x, y, { h, phase });
// A foam clump swinging `dx`/`dy` tiles either side of its home over `per` frames.
const drift = (L, x, y, dx, dy, per = 240, phase = 0) => put(L, 'drift', x, y, { dx, dy, per, phase });

// TSB: a tutorial in three rooms. Gaps and steps, a hill with a canopy route and a
// flow-channel tunnel, then floating pillars up to the sample terrace. No PASN, so no foam.
function buildTSB() {
  const L = newLevel(88, 30);
  ground(L, 0, 87, 26);
  put(L, 'start', 2, 25);
  landmark(L, 6, 20, 'NUTRIENT GARDEN');
  sign(L, 4, 25, 'Run right with A/D or the arrows. Hold Space to jump higher. Follow the golden cystine trail.');
  row(L, 'cystine', 6, 8, 25);
  ribo(L, 9, 22, 'psm');
  sign(L, 11, 25, 'Bump the ribosome block from below for PSM shots (X). Gaps drop you out of the flask: jump them. Low debris can be jumped, shot, or dashed through as stk.');
  // Room 1: a step, the first gap, a taller step, then debris on a low floor.
  solid(L, 17, 20, 24, 25); pit(L, 21, 23, 26); solid(L, 24, 28, 22, 25);
  put(L, 'cystine', 18, 23); put(L, 'cystine', 22, 21); put(L, 'cystine', 26, 21);
  arrow(L, 15, 25, 'right');
  debris(L, 30, 31, 25, 25); put(L, 'iron', 32, 25);
  put(L, 'check', 33, 25);
  // Room 2: the canopy hill. Climb the strands (or bounce) onto it, or walk into the
  // tunnel, where a flow channel pushes against you. A shaft links the two.
  landmark(L, 44, 12, 'THE CANOPY');
  sign(L, 35, 25, 'Bounce or climb onto the canopy. The tunnel below is open too, but its flow channel pushes you back.');
  spring(L, 36, 25);
  plat(L, 38, 24, 2); plat(L, 35, 22, 2); plat(L, 38, 20, 2);
  put(L, 'cystine', 35, 21); put(L, 'cystine', 38, 19);
  solid(L, 40, 58, 18, 25);
  carve(L, 40, 58, 24, 25);
  flow(L, 41, 57, 26, -1);
  carve(L, 50, 52, 18, 23);
  solid(L, 44, 46, 16, 17); put(L, 'cystine', 45, 15);
  plat(L, 48, 14, 3); put(L, 'peptide', 49, 13);
  ribo(L, 56, 15, 'tcya');
  row(L, 'cystine', 53, 55, 17);
  debris(L, 47, 47, 25, 25);
  row(L, 'cystine', 42, 45, 25); row(L, 'cystine', 49, 51, 25); put(L, 'peptide', 55, 25);
  // Room 3: floating pillars over open gaps, a flow track that pushes you back,
  // and the terrace. A high strand above the track hides the last peptide.
  put(L, 'check', 60, 25);
  landmark(L, 82, 14, 'SAMPLE TERRACE');
  sign(L, 62, 25, 'Pillars over the gap. The track pushes you back toward the edge: keep running, then jump.');
  pit(L, 63, 77, 26);
  solid(L, 64, 65, 24, 29); solid(L, 67, 68, 22, 29);
  flow(L, 71, 75, 22, -1);
  solid(L, 78, 79, 20, 29); solid(L, 80, 87, 18, 29);
  plat(L, 73, 18, 3); put(L, 'peptide', 74, 17);
  put(L, 'cystine', 64, 23); put(L, 'cystine', 67, 21); put(L, 'cystine', 73, 21); put(L, 'cystine', 78, 19);
  put(L, 'iron', 82, 17);
  put(L, 'stage', 84, 17);
  L.route = [[19,24],[26,22],[33,26],[38,24],[35,22],[38,20],[42,18],[45,16],[49,18],[54,18],[60,26],
    [64,24],[67,22],[72,22],[78,20],[82,18],[84,18]];
  return L;
}

// SNpulse: a timed climb in four sections, each with its own hazard: a foam well with
// drifting foam, foam geysers on a strand ladder, flow tracks, then a foam gauntlet.
function buildSNpulse() {
  const L = newLevel(40, 68);
  ground(L, 0, 39, 64); put(L, 'start', 2, 63);
  landmark(L, 8, 57, 'THE EXPOSURE RUN');
  sign(L, 4, 63, 'Climb to the MS before the pulse ends. Pink rhamnolipid foam damages your membrane: hop across on the clean stones.');
  ribo(L, 3, 60, 'psm');
  // 1) Foam well, then a zigzag past a drifting foam clump.
  foam(L, 9, 11, 63); solid(L, 12, 13, 62, 63); foam(L, 14, 16, 63); solid(L, 17, 18, 62, 63); foam(L, 19, 21, 63);
  put(L, 'cystine', 12, 61); put(L, 'cystine', 17, 61); row(L, 'cystine', 24, 26, 63);
  put(L, 'omv', 28, 63); put(L, 'peptide', 39, 63);
  for (const [x,y] of [[34,62],[30,60],[34,58],[30,56]]) { plat(L,x,y,3); put(L,'cystine',x+1,y-1); }
  drift(L, 33, 59, 0, 2, 200);
  solid(L, 0, 27, 54, 55);
  // 2) A flow channel carries you left to a strand ladder; foam geysers erupt on it.
  put(L, 'check', 24, 53);
  sign(L, 21, 53, 'HCN puffs after a warning. The flow channel carries you left. Foam geysers bubble before they erupt.');
  put(L, 'hcn', 17, 53); put(L, 'omv', 12, 53);
  flow(L, 6, 14, 54, -1);
  solid(L, 0, 2, 52, 53); geyser(L, 1, 51, 3, 0);
  plat(L, 4, 50, 3); plat(L, 0, 48, 3); plat(L, 4, 46, 3); plat(L, 0, 44, 3);
  geyser(L, 1, 43, 2, 100);
  lysed(L, 8, 47, 3); put(L, 'peptide', 9, 46);
  solid(L, 4, 39, 42, 43);
  // 3) Foam strips on the terrace, then flow tracks that zigzag upward.
  put(L, 'check', 7, 41);
  landmark(L, 22, 37, 'FOAM TERRACE');
  ribo(L, 12, 39, 'ahpc'); put(L, 'xan', 10, 41);
  foam(L, 16, 18, 41); put(L, 'lasa', 23, 41); foam(L, 27, 29, 41);
  put(L, 'dripper', 21, 35);
  flow(L, 31, 34, 40, 1); flow(L, 35, 38, 38, 1); plat(L, 34, 36, 3); flow(L, 29, 32, 34, -1);
  plat(L, 24, 32, 3); put(L, 'cystine', 25, 31);
  solid(L, 0, 23, 30, 31);
  // 4) Bubble chimney or zigzag strands past vertical drifting foam, then the gauntlet.
  put(L, 'check', 20, 29);
  put(L, 'omv', 14, 29); rosgun(L, 11, 29);
  landmark(L, 5, 33, 'BUBBLE CHIMNEY');
  sign(L, 18, 29, 'Ride the bubbles up, or climb the strands while the foam clump drifts past.');
  vent(L, 9, 29, 12);
  for (const [x,y] of [[4,28],[0,26],[4,24],[0,22],[4,20],[8,18]]) plat(L,x,y,3);
  drift(L, 3, 23, 0, 2, 220);
  solid(L, 12, 39, 16, 17);
  put(L, 'check', 14, 15);
  sign(L, 17, 15, 'Last stretch: jump the foam, time the geysers, then step up to the MS.');
  foam(L, 19, 21, 15); geyser(L, 25, 15, 3, 0); geyser(L, 28, 15, 3, 100); foam(L, 31, 33, 15);
  solid(L, 34, 34, 14, 15); solid(L, 35, 39, 12, 15);
  plat(L, 16, 14, 3); plat(L, 20, 12, 3); put(L, 'peptide', 21, 11);
  put(L, 'dripper', 27, 7); put(L, 'lasb', 23, 9);
  row(L, 'cystine', 25, 28, 13); put(L, 'iron', 30, 15);
  put(L, 'stage', 37, 11);
  L.route = [[22,64],[33,64],[34,62],[30,60],[34,58],[30,56],[25,54],[3,54],[1,52],[5,50],[1,48],[5,46],[1,44],
    [7,42],[30,42],[32,40],[36,38],[35,36],[31,34],[25,32],[20,30],[5,28],[1,26],[5,24],[1,22],[5,20],[9,18],
    [14,16],[30,16],[34,14],[37,12]];
  return L;
}

// SN: a descent through heavily foamed biofilm. Foam-capped steps, a geyser-lined roof
// above a flow channel, a spillway of tracks and drifting foam, then the foam lake.
function buildSN() {
  const L = newLevel(54, 54);
  solid(L, 0, 12, 8, 10); put(L, 'start', 2, 7);
  landmark(L, 7, 3, 'WEATHERED BIOFILM');
  sign(L, 4, 7, 'Pink foam stands for rhamnolipids, one of the secreted products in PASN. Land on clean biofilm, never on the foam. Cystine and peptides are bonus goals.');
  plat(L, 8, 6, 4); put(L, 'peptide', 9, 5); put(L, 'iron', 12, 7); put(L, 'sidero', 12, 4);
  // Foam-capped steps: each landing has a clean side and a foamed side.
  solid(L, 15, 19, 11, 12); foam(L, 19, 19, 10);
  solid(L, 22, 27, 14, 15); foam(L, 22, 22, 13);
  solid(L, 16, 20, 17, 18); foam(L, 16, 16, 16);
  put(L, 'cystine', 16, 10); put(L, 'cystine', 25, 13); put(L, 'cystine', 19, 16);
  drift(L, 21, 12, 0, 1.5, 200);
  // The roof has foam geysers; the flow channel below runs fast, past LasA.
  solid(L, 0, 34, 22, 29);
  carve(L, 3, 34, 24, 26); carve(L, 3, 5, 22, 26);
  flow(L, 6, 30, 27, 1);
  put(L, 'check', 9, 21); put(L, 'check', 4, 26);
  sign(L, 7, 21, 'Stay on the roof and time the foam geysers, or drop into the opening on the left: the flow channel below is fast, but LasA patrols it.');
  ribo(L, 12, 18, 'psm');
  geyser(L, 14, 21, 3, 0); put(L, 'omv', 19, 21); geyser(L, 22, 21, 3, 70); foam(L, 25, 26, 21); geyser(L, 29, 21, 3, 140);
  row(L, 'cystine', 10, 12, 21); put(L, 'cystine', 31, 21);
  row(L, 'cystine', 8, 11, 26); row(L, 'cystine', 22, 25, 26);
  put(L, 'lasa', 17, 26); put(L, 'hqno', 20, 25); put(L, 'peptide', 30, 26); debris(L, 14, 14, 26, 26);
  arrow(L, 33, 21, 'right'); arrow(L, 33, 26, 'right');
  // The spillway: a fast track toward a foamed ledge, a track pushing back, drifting foam.
  landmark(L, 46, 24, 'THE SPILLWAY');
  flow(L, 37, 41, 30, 1); put(L, 'xan', 39, 29);
  solid(L, 44, 48, 33, 34); foam(L, 47, 48, 32); put(L, 'cystine', 45, 32);
  flow(L, 38, 42, 37, -1); put(L, 'cystine', 40, 36);
  drift(L, 41, 34, 2, 0, 260);
  solid(L, 30, 34, 41, 42); put(L, 'cystine', 32, 40);
  plat(L, 25, 44, 4); put(L, 'cystine', 26, 43);
  put(L, 'lasb', 49, 37); put(L, 'dripper', 50, 27);
  // The foam lake: a pillar, a flow track, a ledge, and geysers between them.
  ground(L, 0, 53, 48); put(L, 'check', 28, 47);
  put(L, 'peptide', 4, 47); row(L, 'iron', 9, 11, 47); put(L, 'lasa', 14, 47);
  sign(L, 25, 47, 'The foam lake. Hop pillar, track and ledge, and watch the geysers between them. The MS is on the far shore.');
  foam(L, 32, 46, 47);
  solid(L, 35, 35, 46, 47); flow(L, 38, 41, 44, 1); solid(L, 44, 45, 45, 47);
  geyser(L, 37, 47, 3, 0); geyser(L, 43, 47, 3, 100);
  put(L, 'cystine', 35, 45); put(L, 'cystine', 39, 43); put(L, 'cystine', 44, 44);
  arrow(L, 30, 47, 'right'); put(L, 'check', 47, 47); put(L, 'stage', 51, 47);
  L.route = [[17,11],[24,14],[18,17],[10,22],[30,22],[39,30],[45,33],[40,37],[32,41],[27,44],[28,48],
    [35,46],[39,44],[44,45],[48,48],[51,48]];
  return L;
}

// CF: an airway climb built from stacked cilia tracks that push in alternating
// directions, sticky mucus, foam patches and crumbling shortcuts, up to the boss.
function buildCF() {
  const L = newLevel(40, 76);
  ground(L, 0, 39, 68); put(L, 'start', 3, 67);
  landmark(L, 10, 62, 'AIRWAY ENTRY');
  sign(L, 5, 67, 'Bonus setting, not the course experiment. Climb to the mucoid colony. Cilia tracks push you around: run against them or jump off. Brace with down during a cough.');
  ribo(L, 8, 64, 'psm'); put(L, 'twitch', 18, 67); mucus(L, 22, 27, 68);
  row(L, 'cystine', 12, 14, 67); arrow(L, 28, 67, 'up');
  // 1) Three cilia tracks; the first pushes you toward a foam patch.
  cilia(L, 30, 34, 66, 1); foam(L, 34, 34, 65);
  cilia(L, 35, 39, 64, -1); cilia(L, 29, 33, 62, -1);
  lysed(L, 35, 60, 3); put(L, 'peptide', 36, 59);
  plat(L, 26, 60, 3); put(L, 'pa', 33, 57);
  put(L, 'cystine', 31, 65); put(L, 'cystine', 37, 63); put(L, 'cystine', 30, 61);
  solid(L, 0, 25, 58, 59); mucus(L, 9, 16, 58); put(L, 'check', 21, 57);
  debris(L, 18, 19, 57, 57); put(L, 'twitch', 12, 57); put(L, 'iron', 23, 57);
  // 2) Cilia and strands up the left wall; one track pushes against you.
  cilia(L, 4, 8, 56, 1); cilia(L, 0, 3, 54, -1); plat(L, 5, 52, 3); cilia(L, 8, 11, 50, 1);
  solid(L, 13, 13, 48, 49);
  drift(L, 4, 52, 0, 1.4, 210);
  put(L, 'cystine', 6, 55); put(L, 'cystine', 1, 53); put(L, 'cystine', 9, 49);
  solid(L, 14, 39, 46, 47); mucus(L, 17, 23, 46); put(L, 'check', 26, 45);
  landmark(L, 29, 40, 'SWOLLEN-CELL GARDEN');
  ribo(L, 18, 43, 'psm'); put(L, 'twitch', 22, 45); put(L, 'xan', 29, 45);
  spring(L, 31, 45);
  // 3) Foam-tipped strands and cilia tracks zigzag up the right side.
  plat(L, 34, 44, 4); foam(L, 37, 37, 43);
  cilia(L, 29, 32, 42, -1);
  plat(L, 34, 40, 4); foam(L, 37, 37, 39);
  cilia(L, 30, 33, 38, 1);
  plat(L, 26, 36, 3);
  put(L, 'cystine', 35, 43); put(L, 'cystine', 30, 41); put(L, 'cystine', 35, 39); put(L, 'cystine', 27, 35);
  solid(L, 0, 24, 34, 35); cilia(L, 7, 17, 34, -1); foam(L, 10, 11, 33);
  put(L, 'check', 21, 33); put(L, 'pa', 18, 29); put(L, 'twitch', 12, 33);
  sign(L, 19, 33, 'The long cilia track carries you toward foam: jump it. Pale cracked cells are an optional shortcut, but they crumble after landing.');
  // 4) Strands and cilia up the left side, with a crumbling peptide ledge.
  plat(L, 1, 32, 3); cilia(L, 5, 8, 30, 1); plat(L, 10, 28, 3); cilia(L, 5, 8, 26, -1); plat(L, 1, 24, 3);
  lysed(L, 1, 28, 3); put(L, 'peptide', 2, 27);
  drift(L, 9, 25, 0, 1, 180);
  put(L, 'cystine', 2, 31); put(L, 'cystine', 6, 29); put(L, 'cystine', 11, 27); put(L, 'cystine', 2, 23);
  solid(L, 5, 39, 22, 23); foam(L, 12, 13, 21); put(L, 'check', 17, 21);
  landmark(L, 29, 17, 'UPPER AIRWAY');
  rosgun(L, 30, 21); put(L, 'twitch', 24, 21); put(L, 'ahpc', 19, 21);
  // 5) Two cilia tracks and two strands up to the arena.
  cilia(L, 31, 34, 20, 1); cilia(L, 35, 39, 18, -1); plat(L, 30, 16, 3); plat(L, 33, 14, 3);
  put(L, 'cystine', 32, 19); put(L, 'cystine', 37, 17);
  // The upper airway: broad ledges and swimming cells below the gate to part 2.
  solid(L, 0, 27, 12, 13); solid(L, 36, 39, 12, 13); plat(L, 28, 12, 8);
  put(L, 'check', 37, 11); put(L, 'pa', 14, 7); put(L, 'twitch', 20, 11);
  ribo(L, 7, 9, 'psm'); ribo(L, 32, 9, 'psm');
  plat(L, 2, 10, 5); plat(L, 7, 8, 5); plat(L, 12, 6, 5);
  plat(L, 34, 10, 4); plat(L, 30, 8, 4); plat(L, 31, 6, 4);
  plat(L, 12, 4, 18); put(L, 'peptide', 32, 5);
  sign(L, 23, 3, 'The gate saves your stock and leads deeper into the airway. The mucoid colony waits at the top of part 2.');
  put(L, 'stage', 18, 3);
  L.route = [[31,66],[36,64],[31,62],[27,60],[21,58],[3,58],[6,56],[2,54],[6,52],[10,50],[13,48],[26,46],
    [35,44],[30,42],[35,40],[31,38],[27,36],[22,34],[7,34],[2,32],[6,30],[11,28],[6,26],[2,24],[17,22],
    [32,20],[36,18],[31,16],[34,14],[37,12],[18,4]];
  return L;
}

// ---- Part 2 of each map ---------------------------------------------------------
// Reached through the gate at the end of part 1. Same medium, new obstacles.

// TSB part 2: a debris barricade, flow stairs over a gap, a bubble chimney, then a
// fast flow tunnel through the colony up to the terrace.
function buildTSB2() {
  const L = newLevel(84, 40);
  ground(L, 0, 83, 36);
  put(L, 'start', 2, 35);
  landmark(L, 7, 28, 'DEBRIS BARRICADE');
  sign(L, 4, 35, 'Part 2. Climb over the debris wall, or shoot a way through it with PSMs from the ribosome.');
  ribo(L, 5, 32, 'psm');
  solid(L, 9, 10, 34, 35); debris(L, 11, 12, 32, 35);
  row(L, 'cystine', 9, 10, 33); row(L, 'cystine', 11, 12, 31);
  pit(L, 14, 18, 36); solid(L, 16, 16, 34, 39); put(L, 'peptide', 16, 33);
  put(L, 'check', 21, 35);
  // Flow stairs: four tracks over an open gap, each pushing the other way.
  landmark(L, 30, 23, 'FLOW STAIRS');
  sign(L, 23, 35, 'Flow stairs: every track pushes the other way. Keep running, then jump.');
  pit(L, 25, 36, 36);
  flow(L, 25, 28, 34, -1); flow(L, 30, 33, 32, 1); flow(L, 26, 29, 30, -1); flow(L, 31, 35, 28, 1);
  put(L, 'cystine', 26, 33); put(L, 'cystine', 32, 31); put(L, 'cystine', 27, 29); put(L, 'cystine', 33, 27);
  put(L, 'iron', 28, 33);
  solid(L, 37, 46, 26, 35);
  put(L, 'check', 39, 25);
  // Bubble chimney over a second gap: ride the bubbles or climb the strands.
  landmark(L, 50, 8, 'BUBBLE CHIMNEY');
  sign(L, 42, 25, 'Ride a bubble up from the air stone, or climb the strands. A side strand hides a peptide.');
  vent(L, 46, 25, 10);
  pit(L, 47, 55, 36);
  for (const [x,y] of [[48,24],[52,22],[48,20],[52,18],[48,16],[52,14]]) { plat(L,x,y,3); put(L,'cystine',x+1,y-1); }
  plat(L, 44, 14, 3); put(L, 'peptide', 45, 13);
  // The colony tunnel: a fast flow channel with debris to hop, then the terrace.
  solid(L, 56, 83, 12, 35); solid(L, 56, 75, 6, 8); carve(L, 56, 75, 9, 11);
  flow(L, 58, 74, 12, 1);
  debris(L, 63, 63, 11, 11); debris(L, 69, 69, 11, 11);
  row(L, 'cystine', 59, 61, 11); row(L, 'cystine', 65, 67, 11); put(L, 'iron', 72, 11);
  arrow(L, 57, 11, 'right');
  landmark(L, 80, 2, 'SAMPLE TERRACE');
  plat(L, 77, 10, 3); solid(L, 80, 83, 8, 11);
  plat(L, 77, 6, 2); put(L, 'peptide', 77, 5);
  put(L, 'cystine', 78, 9); put(L, 'goal', 81, 7);
  L.route = [[10,34],[12,32],[16,34],[21,36],[24,36],[26,34],[31,32],[28,30],[33,28],[38,26],[46,26],
    [49,24],[53,22],[49,20],[53,18],[49,16],[53,14],[58,12],[75,12],[78,10],[81,8]];
  return L;
}

// SNpulse part 2: the clock keeps running. A geyser row, a foam-tipped strand ladder,
// a foam pool with a stepping stone, a crumbling gap, flow elevators, a last gauntlet.
function buildSNpulse2() {
  const L = newLevel(44, 80);
  ground(L, 0, 43, 76); put(L, 'start', 2, 75);
  landmark(L, 9, 70, 'GEYSER ROW');
  sign(L, 4, 75, 'Part 2: the pulse keeps running. Pass each geyser between eruptions, then climb the tracks on the right.');
  ribo(L, 5, 72, 'psm');
  geyser(L, 10, 75, 3, 0); geyser(L, 15, 75, 3, 60); put(L, 'hcn', 20, 75); geyser(L, 25, 75, 3, 120);
  row(L, 'cystine', 12, 13, 75); row(L, 'cystine', 17, 18, 75); row(L, 'cystine', 22, 23, 75);
  put(L, 'omv', 28, 75); foam(L, 30, 32, 75); put(L, 'peptide', 43, 75);
  flow(L, 37, 40, 74, -1); plat(L, 41, 72, 3); flow(L, 36, 39, 70, 1); plat(L, 32, 68, 3);
  put(L, 'cystine', 38, 73); put(L, 'cystine', 37, 69);
  solid(L, 0, 30, 66, 67);
  // Foam ladder: strands with foam on their outer ends, and a drifting clump between.
  put(L, 'check', 27, 65);
  landmark(L, 15, 60, 'FOAM LADDER');
  foam(L, 21, 23, 65); put(L, 'lasa', 17, 65); foam(L, 11, 13, 65);
  plat(L, 5, 64, 4); foam(L, 8, 8, 63); plat(L, 0, 62, 4); foam(L, 0, 0, 61);
  plat(L, 5, 60, 4); foam(L, 8, 8, 59); plat(L, 0, 58, 4); foam(L, 0, 0, 57); plat(L, 5, 56, 4);
  drift(L, 4, 59, 0, 2, 200);
  put(L, 'cystine', 6, 63); put(L, 'cystine', 2, 61); put(L, 'cystine', 6, 59); put(L, 'cystine', 2, 57);
  solid(L, 10, 43, 54, 55);
  // Foam pool with one stepping stone, a launcher, then strands beside an air stone.
  put(L, 'check', 12, 53);
  landmark(L, 26, 48, 'STEPPING STONE');
  plat(L, 14, 52, 3); plat(L, 11, 50, 3); put(L, 'peptide', 12, 49);
  foam(L, 17, 19, 53); solid(L, 20, 21, 52, 53); foam(L, 22, 24, 53); put(L, 'cystine', 20, 51);
  rosgun(L, 28, 53); put(L, 'omv', 31, 53);
  vent(L, 39, 53, 14);
  for (const [x,y] of [[40,52],[36,50],[40,48],[36,46],[40,44],[36,42]]) plat(L,x,y,3);
  put(L, 'dripper', 38, 36);
  solid(L, 0, 34, 40, 41);
  // A crumbling bridge over a gap in the ledge, permanent strands above it.
  put(L, 'check', 31, 39);
  landmark(L, 17, 34, 'CRUMBLING GAP');
  sign(L, 28, 39, 'The pale bridge crumbles. The strands above it are permanent.');
  fill(L, 14, 19, 40, 41, ' '); lysed(L, 14, 40, 6); plat(L, 16, 38, 2);
  put(L, 'hqno', 24, 37); put(L, 'sidero', 9, 35);
  // Flow elevator: stacked tracks pushing in turn, with a drifting clump between.
  flow(L, 1, 4, 38, -1); flow(L, 6, 9, 36, 1); flow(L, 1, 4, 34, -1); flow(L, 6, 9, 32, 1); flow(L, 1, 4, 30, -1);
  drift(L, 5, 33, 0, 2, 180, 90);
  put(L, 'cystine', 2, 37); put(L, 'cystine', 7, 35); put(L, 'cystine', 2, 33); put(L, 'cystine', 7, 31);
  solid(L, 6, 43, 28, 29);
  // The last gauntlet and the climb to the MS.
  put(L, 'check', 8, 27);
  landmark(L, 22, 22, 'LAST GAUNTLET');
  foam(L, 13, 15, 27); geyser(L, 19, 27, 3, 0); foam(L, 22, 23, 27); geyser(L, 27, 27, 3, 90); put(L, 'omv', 31, 27);
  for (const [x,y] of [[40,26],[36,24],[40,22],[36,20],[40,18],[36,16]]) { plat(L,x,y,3); put(L,'cystine',x+1,y-1); }
  drift(L, 39, 21, 0, 2, 200);
  put(L, 'lasb', 30, 20);
  solid(L, 18, 34, 14, 15);
  foam(L, 27, 29, 13); plat(L, 30, 12, 3); put(L, 'peptide', 31, 11); put(L, 'iron', 25, 13);
  put(L, 'goal', 21, 13);
  L.route = [[33,76],[38,74],[42,72],[37,70],[33,68],[28,66],[4,66],[6,64],[2,62],[6,60],[2,58],[6,56],[12,54],
    [21,52],[27,54],[40,52],[37,50],[41,48],[37,46],[41,44],[37,42],[32,40],[20,40],[16,38],[12,40],[5,40],
    [2,38],[7,36],[2,34],[7,32],[2,30],[8,28],[38,28],[41,26],[37,24],[41,22],[37,20],[41,18],[37,16],[33,14],[21,14]];
  return L;
}

// SN part 2: down and to the left. Foam-capped ledges, three flow-channel switchbacks
// with foam at their ends, pillars over the abyss with drifting foam, then the MS.
function buildSN2() {
  const L = newLevel(54, 62);
  solid(L, 40, 53, 8, 10); put(L, 'start', 51, 7);
  landmark(L, 45, 2, 'THE DEEP BIOFILM');
  sign(L, 49, 7, 'Part 2 goes down and to the left. Same rule: clean biofilm only, never the foam.');
  plat(L, 45, 6, 3); put(L, 'peptide', 46, 5); put(L, 'sidero', 42, 4);
  // Foam-capped ledges stepping down to the left.
  solid(L, 33, 37, 11, 12); foam(L, 33, 33, 10);
  solid(L, 26, 30, 14, 15); foam(L, 30, 30, 13);
  solid(L, 18, 22, 17, 18); foam(L, 18, 18, 16);
  put(L, 'cystine', 35, 10); put(L, 'cystine', 27, 13); put(L, 'cystine', 20, 16);
  drift(L, 31, 11, 0, 1.5, 200);
  solid(L, 0, 16, 21, 22); put(L, 'check', 14, 20);
  put(L, 'xan', 4, 20); put(L, 'hqno', 8, 17);
  // Three switchbacks: each flow track carries you toward foam at its far end.
  landmark(L, 24, 21, 'SWITCHBACKS');
  sign(L, 11, 20, 'Each flow track carries you toward foam at its end. Jump off in time.');
  flow(L, 17, 29, 25, 1); foam(L, 29, 29, 24);
  solid(L, 31, 36, 27, 28); put(L, 'cystine', 33, 26);
  flow(L, 19, 30, 31, -1); foam(L, 19, 19, 30);
  solid(L, 11, 16, 33, 34); put(L, 'omv', 13, 32);
  flow(L, 17, 33, 37, 1); foam(L, 33, 33, 36);
  solid(L, 35, 41, 39, 40); put(L, 'check', 38, 38);
  plat(L, 44, 37, 3); put(L, 'peptide', 45, 36);
  row(L, 'cystine', 22, 25, 24); row(L, 'cystine', 23, 26, 30); row(L, 'cystine', 22, 25, 36);
  put(L, 'lasb', 25, 28); put(L, 'dripper', 26, 19);
  // Pillars over the abyss; drifting foam swings through each gap.
  landmark(L, 21, 40, 'THE ABYSS');
  solid(L, 29, 31, 43, 61); solid(L, 22, 24, 46, 61); solid(L, 15, 17, 49, 61);
  plat(L, 23, 44, 3); put(L, 'iron', 6, 20);
  drift(L, 27, 43, 0, 2, 200); drift(L, 20, 46, 0, 2, 220, 100);
  put(L, 'cystine', 30, 42); put(L, 'cystine', 22, 45); put(L, 'cystine', 16, 48);
  // The MS sits behind a foam strip and a geyser.
  ground(L, 0, 13, 53); put(L, 'check', 12, 52);
  foam(L, 8, 9, 52); geyser(L, 5, 52, 3, 0); put(L, 'lasa', 11, 52);
  put(L, 'peptide', 24, 43);
  put(L, 'goal', 1, 52);
  L.route = [[35,11],[28,14],[20,17],[14,21],[20,25],[28,25],[33,27],[29,31],[21,31],[14,33],[19,37],[31,37],
    [37,39],[30,43],[23,46],[16,49],[11,53],[2,53]];
  return L;
}

// CF part 2: a mucus bog, a cilia gallery, a crumbling bridge, a cilia lift with foam,
// and the colony approach. The mucoid colony waits at the top.
function buildCF2() {
  const L = newLevel(40, 90);
  ground(L, 0, 39, 86); put(L, 'start', 2, 85);
  landmark(L, 10, 80, 'MUCUS BOG');
  sign(L, 4, 85, 'Part 2 of the airway. Mucus between the dry patches is sticky and weakens your jump. Climb the cilia tracks on the right.');
  ribo(L, 3, 82, 'psm');
  mucus(L, 6, 11, 86); mucus(L, 15, 20, 86); mucus(L, 24, 28, 86);
  put(L, 'twitch', 13, 85); put(L, 'twitch', 22, 85); put(L, 'pa', 18, 80);
  cilia(L, 31, 35, 84, 1); plat(L, 36, 82, 4); cilia(L, 30, 33, 80, -1); plat(L, 26, 78, 3);
  lysed(L, 36, 78, 3); put(L, 'peptide', 37, 77);
  put(L, 'cystine', 32, 83); put(L, 'cystine', 37, 81); put(L, 'cystine', 31, 79); put(L, 'cystine', 27, 77);
  solid(L, 0, 24, 76, 77);
  // Cilia gallery: a long track with foam on it, then strands past drifting foam.
  put(L, 'check', 22, 75);
  landmark(L, 13, 71, 'CILIA GALLERY');
  cilia(L, 8, 20, 76, -1); foam(L, 16, 16, 75); foam(L, 11, 11, 75); put(L, 'xan', 5, 75);
  for (const [x,y] of [[1,74],[5,72],[1,70],[5,68],[1,66]]) { plat(L,x,y,3); put(L,'cystine',x+1,y-1); }
  drift(L, 4, 70, 0, 2, 200);
  solid(L, 5, 17, 64, 65); solid(L, 24, 39, 64, 65);
  // A crumbling bridge with permanent strands above, then a launcher and a climb.
  put(L, 'check', 7, 63);
  landmark(L, 20, 58, 'CRUMBLING BRIDGE');
  lysed(L, 18, 64, 6); plat(L, 19, 62, 2); plat(L, 22, 62, 2);
  put(L, 'twitch', 12, 63); rosgun(L, 28, 63); put(L, 'pa', 30, 58); spring(L, 37, 63);
  for (const [x,y] of [[32,62],[36,60],[32,58],[36,56],[32,54]]) { plat(L,x,y,3); put(L,'cystine',x+1,y-1); }
  solid(L, 0, 30, 52, 53);
  // Twitch gallery and a cilia lift whose tracks carry you toward foam.
  put(L, 'check', 27, 51);
  landmark(L, 15, 46, 'CILIA LIFT');
  mucus(L, 10, 18, 52); put(L, 'twitch', 20, 51); put(L, 'twitch', 7, 51); put(L, 'pa', 12, 46);
  cilia(L, 1, 4, 50, -1); cilia(L, 6, 9, 48, 1); foam(L, 9, 9, 47); cilia(L, 1, 4, 46, -1);
  cilia(L, 6, 9, 44, 1); foam(L, 9, 9, 43); cilia(L, 1, 4, 42, -1);
  drift(L, 5, 45, 0, 2, 190);
  put(L, 'cystine', 2, 49); put(L, 'cystine', 7, 47); put(L, 'cystine', 2, 45); put(L, 'cystine', 7, 43);
  solid(L, 6, 39, 40, 41);
  // Foam pools and a launcher, then cilia up to a ledge.
  put(L, 'check', 8, 39); put(L, 'ahpc', 11, 39);
  foam(L, 14, 16, 39); rosgun(L, 20, 39); foam(L, 24, 25, 39); put(L, 'twitch', 28, 39);
  cilia(L, 31, 34, 38, 1); cilia(L, 35, 39, 36, -1); plat(L, 30, 34, 3);
  solid(L, 0, 28, 32, 33);
  put(L, 'check', 26, 31);
  foam(L, 16, 18, 31); put(L, 'pa', 10, 27); put(L, 'twitch', 22, 31);
  plat(L, 1, 30, 3); cilia(L, 5, 8, 28, 1); plat(L, 1, 26, 3); cilia(L, 5, 8, 24, -1); plat(L, 1, 22, 3);
  lysed(L, 10, 26, 3); put(L, 'peptide', 11, 25);
  solid(L, 5, 39, 20, 21);
  // Colony approach.
  put(L, 'check', 8, 19);
  landmark(L, 21, 15, 'COLONY APPROACH');
  foam(L, 18, 19, 19); put(L, 'twitch', 23, 19); rosgun(L, 27, 19);
  cilia(L, 31, 34, 18, 1); cilia(L, 35, 39, 16, -1); plat(L, 33, 14, 3);
  put(L, 'cystine', 32, 17); put(L, 'cystine', 37, 15);
  // The arena has broad, dry cover on both sides and a stock before the fight.
  solid(L, 0, 27, 12, 13); solid(L, 36, 39, 12, 13); plat(L, 28, 12, 8);
  put(L, 'check', 37, 11); put(L, 'boss', 13, 11);
  ribo(L, 7, 9, 'psm'); ribo(L, 32, 9, 'psm');
  plat(L, 2, 10, 5); plat(L, 7, 8, 5); plat(L, 12, 6, 5);
  plat(L, 34, 10, 4); plat(L, 30, 8, 4); plat(L, 31, 6, 4);
  plat(L, 12, 4, 18); put(L, 'peptide', 32, 5);
  sign(L, 23, 3, 'Clear the colony, then deliver the sputum sample. The upper ledges give you room to dodge and return fire.');
  put(L, 'goal', 18, 3);
  L.route = [[30,86],[33,84],[37,82],[32,80],[27,78],[22,76],[3,76],[2,74],[6,72],[2,70],[6,68],[2,66],[7,64],
    [17,64],[20,62],[23,62],[26,64],[31,64],[33,62],[37,60],[33,58],[37,56],[33,54],[28,52],[5,52],[2,50],[7,48],
    [2,46],[7,44],[2,42],[8,40],[29,40],[32,38],[36,36],[31,34],[26,32],[4,32],[2,30],[6,28],[2,26],[6,24],[2,22],
    [7,20],[30,20],[32,18],[36,16],[34,14],[37,12],[18,4]];
  return L;
}

// Level settings. `timeLimit` is in game seconds. `goals`: req = needed before
// the MS takes the sample; the others give bonus stars (short = star label).
// Theme colours: sky = medium, far = background clusters, matrix/cells = ground,
// eps = gel surface, plat = strands, mol = drifting molecules, pyo = number of
// blue pyocyanin specks in the background, dark = how murky the edges of the view get,
// bg = background style, cough = the patient coughs (and gets inhaled antibiotics),
// weather = particles in front of the scene. medals = gold / silver / bronze time in seconds.
const LEVELS = [
  {
    name: 'TSB', subtitle: 'The nutrient garden', stages: [buildTSB, buildTSB2], timeLimit: 0, medals: [130, 195, 280],
    part2Title: 'Debris, flow stairs and the colony tunnel', part2: 'Part 2: over the debris, up the flow stairs and the chimney, through the tunnel.',
    goals: [
      { id: 'sample', label: 'Reach the sample terrace', req: true },
      { id: 'pep', label: 'Find the hidden tryptic peptides', short: 'all peptides' },
      { id: 'reps', label: 'Keep all 3 replicates', short: '3/3 replicates' },
    ],
    theme: {
      sky: ['#fff6df', '#f0cd8c'], far: '#c08a3a', matrix: ['#b88238', '#5e3e17'],
      cells: ['#f0c04a', '#dea42c', '#e9b53e'], eps: '#ffeab0', plat: ['#8a5a26', '#d39a52'],
      mol: '#a8701f', pyo: 0, accent: '#9a6a00', bg: 'tsb', weather: 'snow',
    },
    intro: [
      'Tryptic soy broth: rich, calm, no PASN.',
      'Jump the gaps, cross the canopy, hop the pillars up to the MS.',
      'Two parts: a gate at the terrace saves your stock and leads on.',
    ],
  },
  {
    name: 'SNpulse', subtitle: 'TSB, then 15 min PASN', stages: [buildSNpulse, buildSNpulse2], stageShare: [0.42, 0.58], timeLimit: 300, medals: [200, 250, 290],
    part2Title: 'The pulse keeps running', part2: 'Part 2: the pulse clock keeps running. Geysers, foam ladders and flow elevators lead to the MS.',
    goals: [
      { id: 'time', label: 'Reach the MS before the pulse ends', req: true },
      { id: 'pep', label: 'Find the hidden tryptic peptides', short: 'all peptides' },
      { id: 'kills', n: 8, label: 'Neutralise 8 P. aeruginosa products', short: '8 neutralised' },
    ],
    theme: {
      sky: ['#eef6e4', '#9fc89c'], far: '#557f4c', matrix: ['#7b934f', '#34472a'],
      cells: ['#dcc55c', '#c8ad40', '#d2bb4e'], eps: '#e9f2c6', plat: ['#4b6a33', '#93b866'],
      mol: '#4c7a43', pyo: 10, accent: '#3f6b2a', dark: 0.2, bg: 'pasn', weather: 'motes',
    },
    intro: [
      'Grown in TSB, then 15 min in PASN: the cell-free, sterile-filtered',
      'spent medium of P. aeruginosa PAO1. No living Pseudomonas, only its',
      'secreted molecules. Two climbs past foam, ahead of the blue front.',
    ],
  },
  {
    name: 'SN', subtitle: 'Through the weathered biofilm', stages: [buildSN, buildSN2], timeLimit: 0, medals: [170, 250, 350],
    part2Title: 'Down into the deep biofilm', part2: 'Part 2: down to the left, through foam switchbacks and over the abyss to the MS.',
    goals: [
      { id: 'sample', label: 'Reach the MS below the biofilm', req: true },
      { id: 'cys', n: 16, label: 'Collect 16 cystine', short: '16 cystine' },
      { id: 'pep', label: 'Find the hidden tryptic peptides', short: 'all peptides' },
      { id: 'reps', label: 'Keep all 3 replicates', short: '3/3 replicates' },
    ],
    theme: {
      sky: ['#d5eeee', '#3f8790'], far: '#2b6268', matrix: ['#4a746d', '#16302f'],
      cells: ['#bdb06c', '#a89955', '#c6bb7a'], eps: '#c6e4dc', plat: ['#2c514c', '#6fa197'],
      mol: '#246a73', pyo: 22, accent: '#1f5f66', dark: 0.45, bg: 'pasn', weather: 'mist',
    },
    intro: [
      'Long-term exposure: 70 % TSB + 30 % PASN for ~15 h.',
      'More secreted molecules, fewer nutrients (partly depleted medium).',
      'Two descents past foam, geysers and flow channels to the MS.',
    ],
  },
  {
    name: 'CF airway', subtitle: 'Bonus level: a cystic fibrosis lung', stages: [buildCF, buildCF2], timeLimit: 0, medals: [330, 480, 660],
    part2Title: 'Up to the mucoid colony', part2: 'Part 2: through the bog and up the cilia. The mucoid colony waits at the top.',
    goalKind: 'sputum',
    goals: [
      { id: 'boss', label: 'Clear the mucoid P. aeruginosa colony', req: true },
      { id: 'kills', n: 12, label: 'Neutralise 12 P. aeruginosa cells', short: '12 neutralised' },
      { id: 'pep', label: 'Find the hidden tryptic peptides', short: 'all peptides' },
      { id: 'reps', label: 'Keep all 3 replicates', short: '3/3 replicates' },
    ],
    theme: {
      sky: ['#fbe7ea', '#d98f9c'], far: '#c2717f', matrix: ['#d48a95', '#7a3443'],
      cells: ['#f0b3bc', '#e59aa6', '#f5c4cb'], eps: '#f2e7a2', plat: ['#9b4a5a', '#e7a1ad'],
      mol: '#b05a6a', pyo: 12, accent: '#a33a52', dark: 0.22, debris: 'mucus', bg: 'cf', cough: true, weather: 'cf',
    },
    intro: [
      'A game setting, not part of our experiment (that used PASN in vitro).',
      'Living P. aeruginosa in thick mucus. When the patient coughs, hold on!',
      'Two climbs. Atop part 2: a mucoid colony, then the sputum sample.',
    ],
  },
];
