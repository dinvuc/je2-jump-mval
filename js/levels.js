'use strict';
// levels.js -- the three media of the experiment as three levels.
// Coordinates are in tiles: x = column (0 = left), y = row (0 = top, 16 = bottom).
// The ground surface is row 14, so things standing on the ground sit in row 13.
// Jump reach (see game.js): a single jump climbs ~3 tiles and crosses ~4,
// so the main path never needs more. Higher platforms are double-jump bonuses.

const ROWS = 17;
const GROUND = 14;

// ---- small builder helpers ---------------------------------------------------
function newLevel(cols) {
  const grid = Array.from({ length: ROWS }, () => Array(cols).fill(' '));
  return { cols, grid, ents: [], signs: [] };
}
function fill(L, x0, x1, y0, y1, ch) {
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++)
      if (y >= 0 && y < ROWS && x >= 0 && x < L.cols) L.grid[y][x] = ch;
}
const ground = (L, x0, x1) => fill(L, x0, x1, GROUND, ROWS - 1, '#');        // solid floor
const block = (L, x, w, h) => fill(L, x, x + w - 1, GROUND - h, GROUND - 1, '#'); // step on the floor
const plat = (L, x, y, len) => fill(L, x, x + len - 1, y, y, '=');           // jump-through platform
const spikes = (L, x0, x1) => fill(L, x0, x1, GROUND - 1, GROUND - 1, '^');
const put = (L, type, x, y = GROUND - 1) => L.ents.push({ type, tx: x, ty: y });
const row = (L, type, x0, x1, y = GROUND - 1) => { for (let x = x0; x <= x1; x++) put(L, type, x, y); };
const sign = (L, x, text) => L.signs.push({ tx: x, text });

// Entity types:
//   start, goal (mass spectrometer), check (checkpoint)
//   cystine, iron, ahpc (ROS shield), tcya (cystine magnet)
//   dripper (drops pyocyanin), hqno (drifting cloud), lasa (protease, walks), sidero (siderophore, steals Fe)

// ---- Level 1: TSB (control medium, tutorial) -----------------------------------
function buildTSB() {
  const L = newLevel(120);
  ground(L, 0, 25); ground(L, 28, 46); ground(L, 49, 72); ground(L, 75, 119);
  put(L, 'start', 2);
  sign(L, 3, 'Move with ← → (A/D), jump with Space/↑/W. Hold for higher jumps.');
  row(L, 'cystine', 8, 11);
  sign(L, 13, 'S–S = L-cystine. S. aureus imports it via the TcyABC transporter (TcyA = B7H15_13375).');
  plat(L, 17, 11, 4); put(L, 'cystine', 18, 10); put(L, 'cystine', 19, 10);
  put(L, 'check', 28);
  put(L, 'iron', 30);
  sign(L, 31, 'Fe = iron. Every 3 Fe restore one replicate (you have 3 replicates = 3 lives).');
  block(L, 36, 2, 2); put(L, 'iron', 36, 11);
  plat(L, 40, 11, 3); put(L, 'iron', 41, 10);
  put(L, 'check', 51);
  sign(L, 52, 'Press jump again in the air = double jump (Stk1 boost). stk has none, stp only a weak one.');
  plat(L, 55, 10, 3); put(L, 'cystine', 56, 9);
  plat(L, 59, 7, 3); put(L, 'cystine', 60, 6); put(L, 'cystine', 61, 6);
  spikes(L, 64, 65);
  sign(L, 66, 'Spikes cost a replicate. Falling out of the culture too.');
  put(L, 'ahpc', 80);
  sign(L, 78, 'AhpC (B7H15_02095), alkyl hydroperoxide reductase: a shield against one ROS hit.');
  row(L, 'cystine', 84, 87, 12);
  block(L, 90, 1, 1); block(L, 92, 1, 2); block(L, 94, 1, 3);
  put(L, 'check', 98);
  plat(L, 100, 11, 3); put(L, 'iron', 101, 10);
  sign(L, 107, 'Deliver your sample to the LC-MS/MS to finish the level!');
  put(L, 'goal', 113);
  return L;
}

// ---- Level 2: SNpulse (TSB, then 15 min PASN) -----------------------------------
function buildSNpulse() {
  const L = newLevel(130);
  ground(L, 0, 20); ground(L, 23, 40); ground(L, 43, 60); ground(L, 64, 80);
  ground(L, 83, 100); ground(L, 103, 129);
  put(L, 'start', 2);
  sign(L, 3, '15-min PASN pulse: reach the MS before the pulse clock runs out!');
  put(L, 'ahpc', 8);
  put(L, 'dripper', 13, 1);
  sign(L, 10, 'Blue drops = pyocyanin, a redox-active pigment that generates ROS. AhpC blocks one hit.');
  row(L, 'cystine', 15, 18);
  put(L, 'hqno', 31, 10);
  sign(L, 26, 'Green cloud = HQNO, it inhibits respiration: you get slow and heavy.');
  put(L, 'lasa', 37);
  sign(L, 34, 'LasA: a staphylolytic protease. Jump ON it, never touch its sides.');
  put(L, 'check', 44);
  plat(L, 46, 11, 4); put(L, 'cystine', 47, 10); put(L, 'cystine', 48, 10);
  put(L, 'dripper', 51, 1);
  put(L, 'tcya', 56);
  sign(L, 54, 'TcyA power-up: the cystine-binding protein pulls S–S towards you.');
  row(L, 'cystine', 66, 72, 12);
  put(L, 'hqno', 70, 9); put(L, 'dripper', 75, 1); put(L, 'lasa', 78);
  put(L, 'check', 85);
  block(L, 88, 2, 2);
  plat(L, 92, 10, 3); put(L, 'iron', 93, 9);
  put(L, 'lasa', 97); put(L, 'dripper', 99, 1);
  row(L, 'cystine', 105, 107);
  put(L, 'hqno', 110, 11);
  sign(L, 118, 'Almost there: the MS takes the pulse sample.');
  put(L, 'goal', 124);
  return L;
}

// ---- Level 3: SN (~15 h in 30 % PASN) -------------------------------------------
function buildSN() {
  const L = newLevel(150);
  ground(L, 0, 18); ground(L, 21, 35); ground(L, 38, 52); ground(L, 56, 70);
  ground(L, 73, 88); ground(L, 91, 105); ground(L, 108, 122); ground(L, 125, 149);
  put(L, 'start', 2);
  sign(L, 3, 'SN: ~15 h in 70 % TSB + 30 % PASN. Nutrients are scarce: collect 6 cystine for the MS.');
  put(L, 'cystine', 10);
  sign(L, 12, 'Orange = siderophores (pyoverdine, pyochelin). They grab iron, even from you.');
  put(L, 'sidero', 15, 9); put(L, 'iron', 17);
  put(L, 'ahpc', 22); put(L, 'dripper', 25, 1); put(L, 'cystine', 27); put(L, 'dripper', 30, 1);
  put(L, 'hqno', 33, 10);
  put(L, 'check', 39);
  put(L, 'lasa', 43); put(L, 'cystine', 46, 12);
  plat(L, 47, 11, 3); put(L, 'cystine', 48, 10); put(L, 'iron', 49, 10); put(L, 'sidero', 51, 7);
  spikes(L, 58, 59); put(L, 'cystine', 62, 12); put(L, 'dripper', 64, 1);
  put(L, 'hqno', 66, 11); put(L, 'lasa', 68);
  put(L, 'check', 74); put(L, 'tcya', 76);
  put(L, 'cystine', 80); put(L, 'cystine', 81);
  put(L, 'sidero', 84, 8); put(L, 'iron', 85); put(L, 'lasa', 86);
  put(L, 'hqno', 94, 10); put(L, 'dripper', 97, 1); put(L, 'cystine', 99); put(L, 'dripper', 101, 1);
  block(L, 103, 1, 2);
  put(L, 'check', 109); put(L, 'ahpc', 111);
  put(L, 'lasa', 114); put(L, 'cystine', 116, 12);
  plat(L, 118, 11, 3); put(L, 'iron', 119, 10); put(L, 'sidero', 121, 7);
  put(L, 'hqno', 126, 10); put(L, 'dripper', 128, 1); put(L, 'cystine', 131); put(L, 'lasa', 134);
  sign(L, 139, 'The MS only takes a well-fed sample: 6 cystine needed.');
  put(L, 'goal', 144);
  return L;
}

// Level settings. `timeLimit` is in game seconds; `need` = cystine needed at the MS.
const LEVELS = [
  {
    name: 'TSB', subtitle: 'Control medium', build: buildTSB, need: 0, timeLimit: 0,
    theme: { sky: ['#fff6dc', '#f3dca4'], soil: '#c9a46a', top: '#f1d79a', plat: '#a5774a', dots: '#e0b85a55' },
    intro: [
      'Tryptic soy broth: rich, calm, no PASN.',
      'Learn the moves, collect cystine (S–S) and iron (Fe),',
      'and bring your sample to the mass spectrometer.',
    ],
  },
  {
    name: 'SNpulse', subtitle: 'TSB, then 15 min PASN', build: buildSNpulse, need: 0, timeLimit: 75,
    theme: { sky: ['#eef7e6', '#cfe5c2'], soil: '#a7a066', top: '#d6dc9b', plat: '#87814b', dots: '#7bb36255' },
    intro: [
      'Grown in TSB, then 15 min in PASN: the cell-free, sterile-filtered',
      'spent medium of P. aeruginosa PAO1. No living Pseudomonas, only its',
      'secreted molecules. Beat the pulse clock (1 game s = 12 pulse s).',
    ],
  },
  {
    name: 'SN', subtitle: '~15 h in 30 % PASN', build: buildSN, need: 6, timeLimit: 0,
    theme: { sky: ['#d9eef0', '#8fc3c4'], soil: '#5f7f78', top: '#8fb3a6', plat: '#4e6a63', dots: '#2a8fa355' },
    intro: [
      'Long-term exposure: 70 % TSB + 30 % PASN for ~15 h.',
      'More secreted molecules, fewer nutrients (partly depleted medium).',
      'Collect 6 cystine, or the MS will not take your sample.',
    ],
  },
];
