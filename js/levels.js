'use strict';
// levels.js -- the three media of the experiment as three levels.
// Coordinates are in tiles: x = column (0 = left), y = row (0 = top).
// Every level has its own size; the camera scrolls left/right AND up/down.
// "Surface row r" means the top of the solid ground is row r, so anything
// standing on it sits in row r - 1.
// Jump reach (see game.js): a single jump climbs 3 rows (2 under HQNO) and
// crosses about 4 columns, so the main path never needs more. Platforms more
// than 3 rows up are double-jump bonuses.
// Tiles: '#' solid biofilm, '=' matrix strand (jump through from below),
// '^' rhamnolipid foam (hurts).

// ---- small builder helpers ---------------------------------------------------
function newLevel(cols, rows) {
  const grid = Array.from({ length: rows }, () => Array(cols).fill(' '));
  return { cols, rows, grid, ents: [], signs: [] };
}
function fill(L, x0, x1, y0, y1, ch) {
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++)
      if (y >= 0 && y < L.rows && x >= 0 && x < L.cols) L.grid[y][x] = ch;
}
const solid = (L, x0, x1, y0, y1) => fill(L, x0, x1, y0, y1, '#');           // a block of biofilm
const ground = (L, x0, x1, y) => fill(L, x0, x1, y, L.rows - 1, '#');        // floor from row y to the bottom
const plat = (L, x, y, len) => fill(L, x, x + len - 1, y, y, '=');           // matrix strand
const foam = (L, x0, x1, y) => fill(L, x0, x1, y, y, '^');                   // rhamnolipid foam, in the row above a floor
const put = (L, type, x, y) => L.ents.push({ type, tx: x, ty: y });
const row = (L, type, x0, x1, y) => { for (let x = x0; x <= x1; x++) put(L, type, x, y); };
const sign = (L, x, y, text) => L.signs.push({ tx: x, ty: y, text });

// Entity types:
//   start, goal (mass spectrometer), check (glycerol stock = checkpoint)
//   cystine, iron, ahpc (ROS shield), tcya (cystine magnet)
//   dripper (drops pyocyanin), hqno (drifting cloud), lasa (protease, walks), sidero (siderophore, steals Fe)

// ---- Level 1: TSB (control medium, tutorial) -----------------------------------
// Flat start, a climb up matrix strands, a high ledge, a drop into a valley,
// a staircase onto a mound, and down to the MS. No PASN, so no PASN hazards.
function buildTSB() {
  const L = newLevel(124, 34);
  // start area (surface row 30)
  ground(L, 0, 33, 30);
  put(L, 'start', 2, 29);
  sign(L, 4, 29, 'Move with ← → (A/D), jump with Space/↑/W. Hold jump for higher jumps.');
  row(L, 'cystine', 8, 11, 29);
  sign(L, 13, 29, 'S–S = L-cystine. S. aureus imports it via the TcyABC transporter (TcyA = B7H15_13375).');
  solid(L, 16, 18, 28, 29); row(L, 'cystine', 16, 18, 27);
  // the climb: strands you can jump through from below
  sign(L, 22, 29, 'Strands can be jumped through from below. Climb up!');
  plat(L, 25, 28, 3); put(L, 'cystine', 26, 27);
  plat(L, 29, 26, 3); put(L, 'cystine', 30, 25);
  plat(L, 25, 24, 3); put(L, 'cystine', 26, 23);
  plat(L, 29, 22, 3); put(L, 'cystine', 30, 21);
  plat(L, 25, 20, 3); put(L, 'cystine', 26, 19);
  plat(L, 29, 18, 3);
  // high ledge (surface row 16); its wall reaches the floor
  solid(L, 34, 35, 16, 33); solid(L, 36, 46, 16, 18);
  put(L, 'check', 37, 15);
  sign(L, 39, 15, 'Fe = iron. Every 3 Fe restore one replicate (you have 3 replicates = 3 lives).');
  put(L, 'iron', 41, 15); put(L, 'iron', 44, 15);
  sign(L, 46, 15, 'Press jump again in the air = double jump (Stk1 boost). stk has none, stp only a weak one.');
  plat(L, 41, 12, 3); put(L, 'iron', 42, 11);                 // double-jump bonus
  // floating islands, then down into the valley
  solid(L, 50, 53, 15, 16); put(L, 'cystine', 51, 14); put(L, 'cystine', 52, 14);
  solid(L, 57, 60, 17, 18); put(L, 'iron', 58, 16);
  ground(L, 36, 80, 30);                                       // valley + cave under the ledge
  put(L, 'iron', 38, 29); put(L, 'cystine', 41, 29); put(L, 'iron', 44, 29);
  solid(L, 69, 71, 28, 29); put(L, 'cystine', 70, 27);
  sign(L, 75, 29, 'A pit has no bottom: falling out of the culture costs a replicate.');
  // pit (81-83), then a staircase up onto a mound (surface row 22)
  ground(L, 84, 93, 30);
  solid(L, 88, 89, 28, 29); solid(L, 90, 91, 26, 29); solid(L, 92, 93, 24, 29);
  ground(L, 94, 106, 22);
  sign(L, 95, 21, 'AhpC (B7H15_02095), alkyl hydroperoxide reductase: a shield against one ROS hit.');
  put(L, 'ahpc', 97, 21);
  plat(L, 99, 19, 3); put(L, 'cystine', 100, 18); put(L, 'cystine', 101, 18);
  plat(L, 102, 15, 3); put(L, 'iron', 103, 14);              // double-jump bonus
  // down to the MS (surface row 26)
  ground(L, 107, 123, 26);
  put(L, 'check', 108, 25);
  sign(L, 112, 25, 'Deliver your sample to the LC-MS/MS to finish the level!');
  put(L, 'goal', 118, 25);
  return L;
}

// ---- Level 2: SNpulse (TSB, then 15 min PASN) -----------------------------------
// Up steps to a long ledge, up a strand shaft to a high bridge under a ceiling,
// then down into a valley with the MS. Most gaps have no bottom.
function buildSNpulse() {
  const L = newLevel(130, 36);
  ground(L, 0, 20, 32);
  put(L, 'start', 2, 31);
  sign(L, 4, 31, '15-min PASN pulse: reach the MS before the pulse clock runs out!');
  put(L, 'ahpc', 7, 31);
  sign(L, 9, 31, 'Blue drops = pyocyanin, a redox-active pigment that generates ROS. AhpC blocks one hit.');
  solid(L, 10, 20, 22, 23); put(L, 'dripper', 15, 24);       // overhang with pyocyanin under it
  put(L, 'cystine', 12, 31); put(L, 'cystine', 13, 31); put(L, 'cystine', 17, 31); put(L, 'cystine', 18, 31);
  // steps up to the long ledge (surface row 22)
  solid(L, 21, 24, 30, 35); solid(L, 27, 30, 28, 35);
  plat(L, 32, 26, 3); plat(L, 35, 24, 2);
  solid(L, 38, 60, 22, 24);
  put(L, 'check', 39, 21);
  sign(L, 41, 21, 'Green cloud = HQNO, it inhibits respiration: you get slow and heavy.');
  put(L, 'hqno', 45, 18);
  sign(L, 49, 21, 'LasA: a staphylolytic protease. Jump ON it, never touch its sides.');
  put(L, 'lasa', 54, 21);
  put(L, 'cystine', 57, 21); put(L, 'cystine', 58, 21);
  // strand shaft up to a pillar (surface row 8)
  plat(L, 62, 20, 3); plat(L, 66, 18, 3); plat(L, 62, 16, 3);
  plat(L, 66, 14, 3); plat(L, 62, 12, 3); plat(L, 66, 10, 3);
  put(L, 'cystine', 67, 17); put(L, 'iron', 63, 15); put(L, 'cystine', 67, 9);
  solid(L, 70, 73, 8, 35);
  // high bridge under a ceiling with pyocyanin
  solid(L, 74, 100, 0, 1); put(L, 'dripper', 80, 2); put(L, 'dripper', 93, 2);
  solid(L, 76, 86, 10, 11); put(L, 'cystine', 79, 9); put(L, 'lasa', 84, 9);
  solid(L, 90, 100, 12, 13);
  put(L, 'check', 91, 11);
  sign(L, 92, 11, 'TcyA power-up: the cystine-binding protein pulls S–S towards you.');
  put(L, 'tcya', 94, 11);
  row(L, 'cystine', 96, 99, 11);
  // down into the valley (surface row 26)
  plat(L, 103, 16, 3); plat(L, 106, 20, 3);
  ground(L, 104, 129, 26);
  put(L, 'iron', 108, 25); put(L, 'lasa', 112, 25);
  sign(L, 114, 25, 'Pink foam = rhamnolipids: P. aeruginosa biosurfactants that can damage membranes. Jump over!');
  foam(L, 117, 118, 25);
  put(L, 'hqno', 120, 22);
  sign(L, 122, 25, 'Almost there: the MS takes the pulse sample.');
  put(L, 'goal', 125, 25);
  return L;
}

// ---- Level 3: SN (~15 h in 30 % PASN) -------------------------------------------
// Start high, drop into a cavern and a pyocyanin tunnel, climb a long strand
// shaft, cross bottomless islands at the top, then descend to a valley with
// foam and walk up to the MS.
function buildSN() {
  const L = newLevel(150, 40);
  // starting ledge (surface row 12) above a cavern (surface row 30)
  solid(L, 0, 14, 12, 14);
  put(L, 'start', 2, 11);
  sign(L, 4, 11, 'SN: ~15 h in 70 % TSB + 30 % PASN. Nutrients are scarce: collect 6 cystine for the MS.');
  put(L, 'cystine', 8, 11);
  sign(L, 10, 11, 'Glowing claws = siderophores (e.g. pyoverdine). They grab iron, even from you.');
  put(L, 'sidero', 12, 8); put(L, 'iron', 13, 11);
  ground(L, 0, 57, 30);
  plat(L, 16, 16, 3); put(L, 'cystine', 17, 15);
  plat(L, 20, 19, 3); put(L, 'cystine', 21, 18);
  plat(L, 16, 22, 3);
  plat(L, 20, 25, 3);
  foam(L, 19, 21, 29);
  put(L, 'ahpc', 25, 29);
  // pyocyanin tunnel
  solid(L, 28, 44, 20, 21);
  put(L, 'dripper', 32, 22); put(L, 'dripper', 40, 22);
  put(L, 'cystine', 30, 29); put(L, 'hqno', 36, 26); put(L, 'cystine', 38, 29);
  put(L, 'lasa', 42, 29);
  // long strand shaft up to a pillar (surface row 6)
  put(L, 'check', 46, 29);
  for (let i = 0; i < 11; i++) plat(L, i % 2 ? 48 : 52, 28 - 2 * i, 3);
  put(L, 'cystine', 53, 27); put(L, 'iron', 49, 21); put(L, 'sidero', 51, 17);
  put(L, 'iron', 53, 13); put(L, 'cystine', 49, 15); put(L, 'cystine', 53, 7);
  solid(L, 58, 61, 6, 39);
  // bottomless islands across the top
  solid(L, 64, 70, 8, 9); put(L, 'cystine', 66, 7); put(L, 'lasa', 68, 7);
  solid(L, 74, 80, 10, 11); put(L, 'cystine', 77, 9); put(L, 'sidero', 79, 6); put(L, 'iron', 80, 9);
  plat(L, 75, 5, 3); put(L, 'iron', 76, 4);                   // double-jump bonus
  solid(L, 84, 96, 12, 13);
  put(L, 'check', 85, 11); put(L, 'tcya', 88, 11); put(L, 'hqno', 92, 9); put(L, 'cystine', 94, 11);
  // descend to the valley (surface row 26) under a pyocyanin ceiling
  solid(L, 98, 101, 16, 17);
  solid(L, 104, 108, 20, 21);
  ground(L, 110, 149, 26);
  solid(L, 112, 128, 15, 16); put(L, 'dripper', 116, 17); put(L, 'dripper', 124, 17);
  put(L, 'ahpc', 111, 25);
  foam(L, 114, 115, 25);
  put(L, 'lasa', 119, 25); put(L, 'cystine', 121, 25); put(L, 'cystine', 126, 25);
  put(L, 'hqno', 127, 22);
  // walk up to the MS (surface row 20)
  put(L, 'check', 130, 25);
  solid(L, 132, 134, 24, 25); put(L, 'cystine', 133, 23);
  solid(L, 136, 138, 22, 25);
  solid(L, 140, 149, 20, 25);
  sign(L, 141, 19, 'The MS only takes a well-fed sample: 6 cystine needed.');
  put(L, 'goal', 145, 19);
  return L;
}

// Level settings. `timeLimit` is in game seconds; `need` = cystine needed at the MS.
// Theme colours: sky = medium, far = background clusters, matrix/cells = biofilm,
// eps = gel surface, plat = strands, mol = drifting molecules, pyo = number of
// blue pyocyanin specks in the background.
const LEVELS = [
  {
    name: 'TSB', subtitle: 'Control medium', build: buildTSB, need: 0, timeLimit: 0,
    theme: {
      sky: ['#fff6df', '#f0cd8c'], far: '#c08a3a', matrix: ['#b88238', '#5e3e17'],
      cells: ['#f0c04a', '#dea42c', '#e9b53e'], eps: '#ffeab0', plat: ['#8a5a26', '#d39a52'],
      mol: '#a8701f', pyo: 0, accent: '#9a6a00',
    },
    intro: [
      'Tryptic soy broth: rich, calm, no PASN.',
      'Learn the moves, climb the strands, collect cystine (S–S)',
      'and iron (Fe), and bring your sample to the mass spectrometer.',
    ],
  },
  {
    name: 'SNpulse', subtitle: 'TSB, then 15 min PASN', build: buildSNpulse, need: 0, timeLimit: 75,
    theme: {
      sky: ['#eef6e4', '#9fc89c'], far: '#557f4c', matrix: ['#7b934f', '#34472a'],
      cells: ['#dcc55c', '#c8ad40', '#d2bb4e'], eps: '#e9f2c6', plat: ['#4b6a33', '#93b866'],
      mol: '#4c7a43', pyo: 10, accent: '#3f6b2a',
    },
    intro: [
      'Grown in TSB, then 15 min in PASN: the cell-free, sterile-filtered',
      'spent medium of P. aeruginosa PAO1. No living Pseudomonas, only its',
      'secreted molecules. Beat the pulse clock (1 game s = 12 pulse s).',
    ],
  },
  {
    name: 'SN', subtitle: '~15 h in 30 % PASN', build: buildSN, need: 6, timeLimit: 0,
    theme: {
      sky: ['#d5eeee', '#3f8790'], far: '#2b6268', matrix: ['#4a746d', '#16302f'],
      cells: ['#bdb06c', '#a89955', '#c6bb7a'], eps: '#c6e4dc', plat: ['#2c514c', '#6fa197'],
      mol: '#246a73', pyo: 22, accent: '#1f5f66',
    },
    intro: [
      'Long-term exposure: 70 % TSB + 30 % PASN for ~15 h.',
      'More secreted molecules, fewer nutrients (partly depleted medium).',
      'Collect 6 cystine, or the MS will not take your sample.',
    ],
  },
];
