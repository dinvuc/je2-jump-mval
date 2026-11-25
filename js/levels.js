'use strict';
// Tile coordinates: row zero is the top; a surface at row r supports a cell at r-1.
// Main-route steps rise at most two rows and never touch static foam.
// All routes are permanently open; timed hazards (geysers, drifting foam) only
// demand timing, never block the way for good.
// Optional reading stations on broad, permanent floors. These are added only
// in Study mode, independently of enemies and collectibles.
const STUDY_STATIONS = [
  [
    { tx: 6, ty: 25, topics: ['TSB', 'strain', 'sulfur'] },
    { tx: 12, ty: 25, topics: ['ribosome', 'psm', 'peptide'] },
    { tx: 54, ty: 17, topics: ['sulfur', 'iron'] },
    { tx: 61, ty: 25, topics: ['replicates'] },
  ],
  [
    { tx: 22, ty: 53, topics: ['SNpulse', 'omv', 'hcn'] },
    { tx: 24, ty: 41, topics: ['ahpc', 'xan', 'proteases'] },
    { tx: 17, ty: 29, topics: ['ros', 'ribosome'] },
    { tx: 15, ty: 15, topics: ['peptide', 'replicates'] },
  ],
  [
    { tx: 5, ty: 7, topics: ['SN', 'iron'] },
    { tx: 8, ty: 21, topics: ['proteases', 'hqno', 'omv'] },
    { tx: 22, ty: 47, topics: ['foam', 'xan'] },
    { tx: 49, ty: 47, topics: ['replicates', 'peptide'] },
  ],
  [
    { tx: 6, ty: 67, topics: ['CF airway', 'airway'] },
    { tx: 27, ty: 45, topics: ['psm', 'xan', 'ahpc'] },
    { tx: 22, ty: 33, topics: ['airway', 'replicates'] },
    { tx: 37, ty: 11, topics: ['boss', 'ros'] },
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
  put(L, 'goal', 84, 17);
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
  put(L, 'goal', 37, 11);
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
  arrow(L, 30, 47, 'right'); put(L, 'check', 47, 47); put(L, 'goal', 51, 47);
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
  landmark(L, 29, 17, 'COLONY APPROACH');
  rosgun(L, 30, 21); put(L, 'twitch', 24, 21); put(L, 'ahpc', 19, 21);
  // 5) Two cilia tracks and two strands up to the arena.
  cilia(L, 31, 34, 20, 1); cilia(L, 35, 39, 18, -1); plat(L, 30, 16, 3); plat(L, 33, 14, 3);
  put(L, 'cystine', 32, 19); put(L, 'cystine', 37, 17);
  // The arena has broad, dry cover on both sides and a stock before the fight.
  solid(L, 0, 27, 12, 13); solid(L, 36, 39, 12, 13); plat(L, 28, 12, 8);
  put(L, 'check', 37, 11); put(L, 'boss', 13, 11);
  ribo(L, 7, 9, 'psm'); ribo(L, 32, 9, 'psm');
  plat(L, 2, 10, 5); plat(L, 7, 8, 5); plat(L, 12, 6, 5);
  plat(L, 34, 10, 4); plat(L, 30, 8, 4); plat(L, 31, 6, 4);
  plat(L, 12, 4, 18); put(L, 'peptide', 32, 5);
  sign(L, 23, 3, 'Clear the colony, then deliver the sputum sample. The upper ledges give you room to dodge and return fire.');
  put(L, 'goal', 18, 3);
  L.route = [[31,66],[36,64],[31,62],[27,60],[21,58],[3,58],[6,56],[2,54],[6,52],[10,50],[13,48],[26,46],
    [35,44],[30,42],[35,40],[31,38],[27,36],[22,34],[7,34],[2,32],[6,30],[11,28],[6,26],[2,24],[17,22],
    [32,20],[36,18],[31,16],[34,14],[37,12],[18,4]];
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
    name: 'TSB', subtitle: 'The nutrient garden', build: buildTSB, timeLimit: 0, medals: [65, 100, 145],
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
      'The canopy, the flow-channel tunnel and a high strand hide peptides.',
    ],
  },
  {
    name: 'SNpulse', subtitle: 'TSB, then 15 min PASN', build: buildSNpulse, timeLimit: 145, medals: [95, 120, 140],
    goals: [
      { id: 'time', label: 'Reach the MS before the pulse ends', req: true },
      { id: 'pep', label: 'Find the hidden tryptic peptides', short: 'all peptides' },
      { id: 'kills', n: 5, label: 'Neutralise 5 P. aeruginosa products', short: '5 neutralised' },
    ],
    theme: {
      sky: ['#eef6e4', '#9fc89c'], far: '#557f4c', matrix: ['#7b934f', '#34472a'],
      cells: ['#dcc55c', '#c8ad40', '#d2bb4e'], eps: '#e9f2c6', plat: ['#4b6a33', '#93b866'],
      mol: '#4c7a43', pyo: 10, accent: '#3f6b2a', dark: 0.2, bg: 'pasn', weather: 'motes',
    },
    intro: [
      'Grown in TSB, then 15 min in PASN: the cell-free, sterile-filtered',
      'spent medium of P. aeruginosa PAO1. No living Pseudomonas, only its',
      'secreted molecules. Climb past foam ahead of the blue front.',
    ],
  },
  {
    name: 'SN', subtitle: 'Through the weathered biofilm', build: buildSN, timeLimit: 0, medals: [85, 125, 175],
    goals: [
      { id: 'sample', label: 'Reach the MS below the biofilm', req: true },
      { id: 'cys', n: 8, label: 'Collect 8 cystine', short: '8 cystine' },
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
      'Descend past foam, geysers and flow channels to the foam lake.',
    ],
  },
  {
    name: 'CF airway', subtitle: 'Bonus level: a cystic fibrosis lung', build: buildCF, timeLimit: 0, medals: [165, 240, 330],
    goalKind: 'sputum',
    goals: [
      { id: 'boss', label: 'Clear the mucoid P. aeruginosa colony', req: true },
      { id: 'kills', n: 6, label: 'Neutralise 6 P. aeruginosa cells', short: '6 neutralised' },
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
      'At the top waits a mucoid P. aeruginosa colony, then the sputum sample.',
    ],
  },
];
