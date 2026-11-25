'use strict';
// levels.js -- the three media of the experiment as three levels, plus a bonus
// level set in a cystic fibrosis airway (a game setting, not course data).
// Coordinates are in tiles: x = column (0 = left), y = row (0 = top).
// "Surface row r" means the top of the solid ground is row r, so anything
// standing on it sits in row r - 1.
// Jump reach (see game.js): a single jump climbs 3 rows (2 under HQNO or on
// mucus) and crosses about 4 columns, so the main path never needs more.
// Tiles: '#' biofilm, '=' strand (jump through from below), '%' lysed cells
// (collapse), '^' rhamnolipid foam (hurts), '~' mucus (sticky), '<' '>' cilia
// (push you), 'B' debris / mucus plug (shoot it or bump it from below),
// 'R' ribosome block (bump it from below: a protein pops out).

// ---- small builder helpers ---------------------------------------------------
function newLevel(cols, rows) {
  const grid = Array.from({ length: rows }, () => Array(cols).fill(' '));
  const bg = Array.from({ length: rows }, () => Array(cols).fill(' '));
  return { cols, rows, grid, bg, ents: [], signs: [], ribo: {} };
}
function fill(L, x0, x1, y0, y1, ch) {
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++)
      if (y >= 0 && y < L.rows && x >= 0 && x < L.cols) L.grid[y][x] = ch;
}
const solid = (L, x0, x1, y0, y1) => fill(L, x0, x1, y0, y1, '#');           // a block of biofilm
const ground = (L, x0, x1, y) => fill(L, x0, x1, y, L.rows - 1, '#');        // floor from row y to the bottom
const carve = (L, x0, x1, y0, y1) => {                                       // a tunnel inside the biofilm
  fill(L, x0, x1, y0, y1, ' ');
  for (let y = Math.max(0, y0); y <= Math.min(L.rows - 1, y1); y++)
    for (let x = Math.max(0, x0); x <= Math.min(L.cols - 1, x1); x++) L.bg[y][x] = 'c';
};
const plat = (L, x, y, len) => fill(L, x, x + len - 1, y, y, '=');           // matrix strand
const lysed = (L, x, y, len) => fill(L, x, x + len - 1, y, y, '%');          // lysed cells: collapse after landing
const foam = (L, x0, x1, y) => fill(L, x0, x1, y, y, '^');                   // rhamnolipid foam, in the row above a floor
const mucus = (L, x0, x1, y) => fill(L, x0, x1, y, y, '~');                  // sticky mucus surface
const cilia = (L, x0, x1, y, dir) => fill(L, x0, x1, y, y, dir < 0 ? '<' : '>');   // cilia surface, pushes left/right
const debris = (L, x0, x1, y0, y1) => fill(L, x0, x1, y0, y1, 'B');          // breakable block
const ribo = (L, x, y, item) => { fill(L, x, x, y, y, 'R'); L.ribo[`${x},${y}`] = item; };   // ribosome block
const put = (L, type, x, y, extra = {}) => L.ents.push({ type, tx: x, ty: y, ...extra });
const row = (L, type, x0, x1, y) => { for (let x = x0; x <= x1; x++) put(L, type, x, y); };
const sign = (L, x, y, text) => L.signs.push({ tx: x, ty: y, text });
// Moving things and puzzles. `ch` links a signal source to what it switches.
const vent = (L, x, y, rise) => put(L, 'vent', x, y, { rise });              // air bubbles rise `rise` rows
const spring = (L, x, y) => put(L, 'spring', x, y);                         // swollen cell: bounces you ~6 rows
const channel = (L, x, y, id) => put(L, 'channel', x, y, { id });           // ↓ on it = come out at the other one with the same id
const agrb = (L, x, y) => put(L, 'agrb', x, y);                             // makes the AIP block (appears at x + 1)
const agrc = (L, x, y, ch) => { fill(L, x, x, y, y, ' '); put(L, 'agrc', x, y, { ch }); };  // receptor notch in a floor (y = surface row)
const gate = (L, x, y, h, ch) => put(L, 'gate', x, y, { h, ch });           // barrier from row y down h rows
const phos = (L, x, y, ch) => put(L, 'phos', x, y, { ch });                 // phospho-switch, ON for 10 s
const shuttle = (L, x, y, len, toX, toY, ch) => put(L, 'shuttle', x, y, { len, to: [toX, toY], ch });  // moving bridge / lift

// Entity types:
//   start, goal, check (glycerol stock = checkpoint)
//   collect: cystine, iron, peptide (hidden goal), power-ups: ahpc, tcya, psm (shooting), xan (staphyloxanthin)
//   PASN products: dripper (pyocyanin), hqno, lasa, lasb (flying), omv (bouncing), hcn (vent), sidero
//   living P. aeruginosa (CF level only): pa (swims), twitch (crawls)
//   vent, spring, channel, agrb / agrc / gate, phos / shuttle

// ---- Level 1: TSB (control medium, tutorial) -----------------------------------
// Three tiers: a room at the bottom with a tunnel under it, a ledge in the middle
// with the quorum-sensing gate, and the MS on top. No PASN, so no PASN hazards.
function buildTSB() {
  const L = newLevel(60, 46);
  ground(L, 0, 59, 40);
  carve(L, 2, 57, 42, 44);                    // tunnel under everything
  carve(L, 26, 32, 41, 41);
  solid(L, 14, 44, 24, 26);                   // middle ledge (surface 24)
  solid(L, 31, 44, 27, 39);
  solid(L, 45, 59, 20, 39);                   // right block (surface 20)
  // bottom room
  put(L, 'start', 2, 39);
  sign(L, 4, 39, 'Move with ← → (A/D), jump with Space/↑/W, hold for higher jumps. P opens the menu.');
  row(L, 'cystine', 5, 6, 39);
  ribo(L, 7, 36, 'psm');
  sign(L, 10, 39, 'Ribosome block: jump into it from below and it translates a protein. PSMs let you shoot (X, K or Shift).');
  for (let i = 0; i < 7; i++) plat(L, i % 2 ? 11 : 9, 38 - 2 * i, 3);   // strand tower
  put(L, 'cystine', 12, 35); put(L, 'cystine', 10, 29); put(L, 'cystine', 12, 27);
  channel(L, 17, 39, 1);
  sign(L, 19, 39, 'Water channels run through the biofilm. Stand on one and press ↓ to dive in.');
  sign(L, 25, 39, 'Debris of dead cells: shoot it, or bump it from below. Something is hidden behind this wall...');
  solid(L, 28, 30, 34, 35); debris(L, 28, 29, 36, 39); put(L, 'peptide', 30, 39);
  // the tunnel
  channel(L, 4, 44, 1);
  row(L, 'cystine', 8, 11, 44);
  solid(L, 16, 17, 43, 44);
  put(L, 'iron', 22, 44); put(L, 'cystine', 29, 41);
  put(L, 'peptide', 34, 44);
  row(L, 'cystine', 40, 43, 44); put(L, 'iron', 48, 44);
  channel(L, 56, 44, 2);
  // middle ledge: bubble to a bonus strand, the quorum-sensing gate, a swollen cell
  put(L, 'check', 15, 23);
  vent(L, 16, 23, 11);
  plat(L, 18, 13, 4); put(L, 'peptide', 19, 12); put(L, 'cystine', 20, 12); put(L, 'cystine', 21, 12);
  agrb(L, 18, 23);
  sign(L, 21, 23, 'Quorum sensing! Push the AIP signal peptide into its receptor AgrC (the notch). The signal opens the gate. Stuck? Touch AgrB for a fresh AIP.');
  channel(L, 23, 23, 2);
  agrc(L, 27, 24, 'a');
  ribo(L, 30, 20, 'tcya');
  solid(L, 33, 39, 10, 18);                   // hanging biofilm: too high to jump over
  gate(L, 36, 19, 5, 'a');
  put(L, 'cystine', 34, 23);
  sign(L, 39, 23, 'A swollen cell: land on it and it throws you up.');
  spring(L, 42, 23);
  // top: strands up to the MS
  row(L, 'cystine', 46, 48, 19); put(L, 'iron', 55, 19);
  plat(L, 46, 18, 3); plat(L, 46, 16, 3);
  solid(L, 50, 59, 14, 15);
  put(L, 'check', 51, 13);
  sign(L, 53, 13, 'Deliver your sample to the LC-MS/MS!');
  put(L, 'goal', 56, 13);
  return L;
}

// ---- Level 2: SNpulse (TSB, then 15 min PASN) -----------------------------------
// A climb against the pulse clock: from the floor (and a tunnel under it) up
// past OMVs and HCN vents, a phospho-switch lift, a bubble, and lysed strands
// to the MS at the very top.
function buildSNpulse() {
  const L = newLevel(48, 72);
  ground(L, 0, 47, 68);
  carve(L, 2, 45, 69, 70);
  put(L, 'start', 2, 67);
  sign(L, 4, 67, '15-min PASN pulse: climb to the MS at the top before the pulse clock runs out!');
  channel(L, 6, 67, 1); channel(L, 4, 70, 1);
  row(L, 'cystine', 10, 14, 70); put(L, 'iron', 25, 70); put(L, 'peptide', 40, 70);
  channel(L, 44, 70, 2); channel(L, 26, 67, 2);
  solid(L, 8, 11, 66, 67); solid(L, 14, 17, 64, 67);
  sign(L, 9, 65, 'Bouncing bubbles = outer membrane vesicles (OMVs) released by P. aeruginosa. Jump on them or shoot them.');
  lysed(L, 20, 62, 3); lysed(L, 24, 60, 3);
  put(L, 'omv', 36, 67);
  // ledge 1 (surface 58)
  solid(L, 28, 47, 58, 59);
  put(L, 'check', 29, 57);
  sign(L, 32, 57, 'HCN vents puff hydrogen cyanide, which blocks respiration. Wait until the puff is over!');
  put(L, 'hcn', 35, 57);
  sign(L, 39, 57, 'LasB elastase: a P. aeruginosa protease that drifts through the medium.');
  put(L, 'lasa', 44, 57);
  plat(L, 44, 56, 3); plat(L, 40, 54, 3); plat(L, 44, 52, 3); plat(L, 40, 50, 3); plat(L, 36, 48, 3);
  put(L, 'lasb', 42, 52); put(L, 'cystine', 41, 49);
  // ledge 2 (surface 46): phospho-switch lift
  solid(L, 0, 1, 46, 47); solid(L, 5, 34, 46, 47);   // the lift sits in a shaft at columns 2-4
  put(L, 'dripper', 32, 48);
  put(L, 'check', 30, 45);
  ribo(L, 26, 43, 'ahpc');
  put(L, 'hcn', 22, 45);
  put(L, 'hqno', 17, 42);
  sign(L, 12, 45, 'Phospho-switch: touch it (a phosphate is added = ON) and the lift rises. After 10 s a phosphatase switches it OFF.');
  phos(L, 6, 45, 'p');
  put(L, 'xan', 9, 45);
  shuttle(L, 2, 46, 3, 2, 33, 'p');
  // ledge 3 (surface 33): bubble up
  solid(L, 5, 30, 33, 34);
  put(L, 'check', 7, 32); row(L, 'cystine', 10, 12, 32); put(L, 'omv', 18, 32);
  vent(L, 28, 32, 14);
  // ledge 4 (surface 19) with a tunnel inside, a swollen cell to a bonus strand
  solid(L, 31, 47, 19, 24);
  carve(L, 34, 46, 21, 23);
  channel(L, 44, 18, 3); channel(L, 36, 23, 3);
  row(L, 'cystine', 38, 41, 23); put(L, 'peptide', 45, 23);
  put(L, 'omv', 35, 18);
  spring(L, 40, 18);
  plat(L, 42, 13, 3); put(L, 'peptide', 43, 12);
  // lysed strands up to the MS (surface 9), under a pyocyanin ceiling
  lysed(L, 27, 17, 3); plat(L, 23, 15, 3); lysed(L, 19, 13, 3); plat(L, 16, 11, 3);
  put(L, 'cystine', 24, 14); put(L, 'cystine', 17, 10);
  solid(L, 16, 47, 0, 1); put(L, 'dripper', 22, 2); put(L, 'dripper', 30, 2);
  put(L, 'lasb', 24, 10);
  solid(L, 0, 14, 9, 10);
  put(L, 'check', 12, 8);
  sign(L, 8, 8, 'Almost there: the MS takes the pulse sample.');
  put(L, 'goal', 3, 8);
  return L;
}

// ---- Level 3: SN (~15 h in 30 % PASN) -------------------------------------------
// Down from a high start onto a thick biofilm with a tunnel inside, into a pit
// over foam, and along the bottom to the gate in front of the MS. A cave and a
// tunnel under the floor hide peptides.
function buildSN() {
  const L = newLevel(70, 64);
  // start (surface 8)
  solid(L, 0, 18, 8, 10);
  put(L, 'start', 2, 7);
  sign(L, 4, 7, 'SN: ~15 h in 70 % TSB + 30 % PASN. Nutrients are scarce: collect 6 cystine, then open the gate to the MS.');
  put(L, 'cystine', 8, 7);
  sign(L, 10, 7, 'Glowing claws = siderophores (e.g. pyoverdine). They grab iron, even from you. PSMs can stop them.');
  put(L, 'sidero', 13, 4); put(L, 'iron', 15, 7);
  plat(L, 21, 11, 3); put(L, 'cystine', 22, 10);
  lysed(L, 25, 14, 3);
  plat(L, 21, 17, 3); put(L, 'cystine', 22, 16);
  // thick biofilm (surface 22) with a tunnel through it
  solid(L, 0, 42, 22, 28);
  carve(L, 3, 42, 24, 26);
  ribo(L, 12, 18, 'psm');
  put(L, 'omv', 18, 21); put(L, 'check', 24, 21);
  sign(L, 26, 21, 'The biofilm is full of tunnels. Channels (↓) take you inside; peptides hide there.');
  put(L, 'hcn', 30, 21); put(L, 'cystine', 36, 21);
  channel(L, 6, 21, 1); channel(L, 4, 26, 1);
  put(L, 'peptide', 9, 26); put(L, 'cystine', 14, 26); put(L, 'lasa', 20, 26); put(L, 'cystine', 26, 26);
  put(L, 'hqno', 30, 25); put(L, 'cystine', 34, 26);
  channel(L, 38, 26, 2);
  // the pit, with foam at its bottom
  put(L, 'dripper', 33, 29); put(L, 'dripper', 39, 29);
  lysed(L, 45, 30, 3); put(L, 'xan', 46, 29);
  plat(L, 50, 34, 3); put(L, 'cystine', 51, 33);
  lysed(L, 45, 38, 3);
  plat(L, 51, 42, 3); put(L, 'cystine', 52, 41);
  plat(L, 47, 46, 3); plat(L, 40, 47, 3);
  put(L, 'lasb', 54, 32); put(L, 'lasb', 47, 40);
  // the floor (surface 50) and the gate to the MS
  solid(L, 30, 69, 50, 63);
  foam(L, 43, 49, 49);
  put(L, 'check', 51, 49);
  sign(L, 50, 49, 'The MS is behind a gate. Push the AIP into AgrC to send the signal. Touch AgrB for a fresh AIP.');
  agrb(L, 53, 49);
  agrc(L, 58, 50, 's');
  solid(L, 59, 69, 30, 41);
  gate(L, 61, 42, 8, 's');
  sign(L, 63, 49, 'The MS only takes a well-fed sample: 6 cystine.');
  put(L, 'goal', 66, 49);
  // tunnel under the floor
  carve(L, 32, 66, 55, 58);
  channel(L, 34, 49, 3); channel(L, 33, 58, 3);
  row(L, 'cystine', 40, 42, 58); put(L, 'omv', 48, 58); put(L, 'iron', 52, 58); put(L, 'peptide', 64, 58);
  // a cave below the thick biofilm, reached through the tunnel
  solid(L, 0, 29, 29, 63);
  carve(L, 2, 27, 52, 59);
  channel(L, 4, 59, 2);
  row(L, 'cystine', 8, 10, 59); put(L, 'lasa', 14, 59);
  plat(L, 16, 57, 3); put(L, 'iron', 17, 56);
  put(L, 'peptide', 24, 59);
  return L;
}

// ---- Bonus level: a cystic fibrosis airway --------------------------------------
// A tall climb: floors alternate left and right, with strands in the gaps.
// Sticky mucus, beating cilia, mucus plugs, and living P. aeruginosa.
// This is a game setting, not part of the course experiment.
function buildCF() {
  const L = newLevel(36, 96);
  ground(L, 0, 35, 92);
  put(L, 'start', 3, 91);
  sign(L, 5, 91, 'Bonus level: a cystic fibrosis airway. A game setting, not part of our course experiment.');
  ribo(L, 9, 88, 'psm');
  sign(L, 13, 91, 'In CF the CFTR channel does not work, so the mucus is thick and sticky and the cilia cannot clear it. Climb up to the sputum sample!');
  put(L, 'twitch', 18, 91);
  sign(L, 22, 91, 'Here P. aeruginosa cells are alive. Neutralise 6 of them: jump on them or shoot PSMs.');
  put(L, 'cystine', 25, 91);
  // floor 84 (left), mucus in the middle
  plat(L, 27, 90, 3); plat(L, 31, 88, 3); plat(L, 27, 86, 3);
  put(L, 'pa', 30, 82);
  solid(L, 0, 24, 84, 85); mucus(L, 12, 20, 84);
  put(L, 'check', 22, 83); row(L, 'cystine', 14, 16, 83);
  // floor 76 (right), cilia push left
  plat(L, 6, 82, 3); plat(L, 2, 80, 3); plat(L, 6, 78, 3);
  solid(L, 11, 35, 76, 77); cilia(L, 13, 22, 76, -1);
  sign(L, 12, 75, 'Cilia beat and push you. In CF they cannot move the thick mucus, so you have to climb.');
  put(L, 'twitch', 28, 75); put(L, 'iron', 24, 75);
  // floor 68 (left), a mucus plug
  plat(L, 27, 74, 3); plat(L, 31, 72, 3); plat(L, 27, 70, 3);
  solid(L, 0, 24, 68, 69);
  debris(L, 14, 14, 66, 67);
  sign(L, 16, 67, 'Mucus plug: shoot it with PSMs, or climb over it.');
  put(L, 'twitch', 8, 67); put(L, 'cystine', 18, 67); put(L, 'check', 21, 67);
  // floor 60 (right), mucus and a ribosome
  plat(L, 6, 66, 3); plat(L, 2, 64, 3); plat(L, 6, 62, 3);
  put(L, 'pa', 8, 63);
  solid(L, 11, 35, 60, 61); mucus(L, 14, 23, 60);
  ribo(L, 15, 57, 'psm');
  put(L, 'cystine', 25, 59); put(L, 'iron', 33, 59);
  // floor 52 (left), thick, with a tunnel inside
  plat(L, 27, 58, 3); plat(L, 31, 56, 3); plat(L, 27, 54, 3);
  solid(L, 0, 24, 52, 56);
  carve(L, 2, 21, 54, 55);
  channel(L, 4, 51, 1); channel(L, 3, 55, 1);
  row(L, 'cystine', 8, 11, 55); put(L, 'twitch', 14, 55); put(L, 'peptide', 19, 55);
  put(L, 'check', 22, 51);
  // floor 44 (right), cilia push right, pyocyanin from above
  plat(L, 6, 50, 3); plat(L, 2, 48, 3); plat(L, 6, 46, 3);
  solid(L, 11, 35, 44, 45); cilia(L, 14, 24, 44, 1);
  put(L, 'pa', 20, 41); put(L, 'dripper', 16, 38);
  put(L, 'cystine', 30, 43);
  // floor 36 (left), mucus, staphyloxanthin
  plat(L, 27, 42, 3); plat(L, 31, 40, 3); plat(L, 27, 38, 3);
  solid(L, 0, 24, 36, 37); mucus(L, 11, 19, 36);
  put(L, 'pa', 28, 33); put(L, 'xan', 22, 35); put(L, 'check', 3, 35);
  // floor 28 (right), a plugged alcove with a peptide
  plat(L, 6, 34, 3); plat(L, 2, 32, 3); plat(L, 6, 30, 3);
  solid(L, 11, 35, 28, 29);
  debris(L, 18, 18, 26, 27); solid(L, 18, 21, 25, 25); solid(L, 21, 21, 26, 27);
  put(L, 'cystine', 19, 27); put(L, 'peptide', 20, 27);
  put(L, 'twitch', 26, 27);
  // floor 20 (left), cilia push right
  plat(L, 27, 26, 3); plat(L, 31, 24, 3); plat(L, 27, 22, 3);
  solid(L, 0, 24, 20, 21); cilia(L, 6, 16, 20, 1);
  ribo(L, 9, 17, 'psm');
  put(L, 'pa', 14, 17); put(L, 'check', 20, 19); put(L, 'iron', 3, 19);
  // floor 12 (right)
  plat(L, 6, 18, 3); plat(L, 2, 16, 3); plat(L, 6, 14, 3);
  solid(L, 11, 35, 12, 13);
  put(L, 'twitch', 20, 11); put(L, 'pa', 28, 9); put(L, 'cystine', 14, 11);
  // the top (surface 4): the sputum sample
  plat(L, 27, 10, 3); plat(L, 31, 8, 3); plat(L, 27, 6, 3);
  plat(L, 31, 3, 3); put(L, 'peptide', 32, 2);
  solid(L, 0, 24, 4, 5);
  put(L, 'check', 20, 3);
  sign(L, 12, 3, 'In the clinic, sputum samples go to the lab to find out which bacteria live in the airway.');
  put(L, 'goal', 4, 3);
  return L;
}

// Level settings. `timeLimit` is in game seconds. `goals`: req = needed before
// the MS takes the sample; the others give bonus stars (short = star label).
// Theme colours: sky = medium, far = background clusters, matrix/cells = ground,
// eps = gel surface, plat = strands, mol = drifting molecules, pyo = number of
// blue pyocyanin specks in the background, dark = how murky the edges of the view get.
const LEVELS = [
  {
    name: 'TSB', subtitle: 'Control medium', build: buildTSB, timeLimit: 0,
    goals: [
      { id: 'gate', label: 'Open the quorum-sensing gate', req: true },
      { id: 'pep', label: 'Find the hidden tryptic peptides', short: 'all peptides' },
      { id: 'reps', label: 'Keep all 3 replicates', short: '3/3 replicates' },
    ],
    theme: {
      sky: ['#fff6df', '#f0cd8c'], far: '#c08a3a', matrix: ['#b88238', '#5e3e17'],
      cells: ['#f0c04a', '#dea42c', '#e9b53e'], eps: '#ffeab0', plat: ['#8a5a26', '#d39a52'],
      mol: '#a8701f', pyo: 0, accent: '#9a6a00',
    },
    intro: [
      'Tryptic soy broth: rich, calm, no PASN.',
      'Learn the moves: ribosome blocks, channels, the gate, swollen cells,',
      'and bring your sample up to the mass spectrometer.',
    ],
  },
  {
    name: 'SNpulse', subtitle: 'TSB, then 15 min PASN', build: buildSNpulse, timeLimit: 110,
    goals: [
      { id: 'time', label: 'Reach the MS before the pulse ends', req: true },
      { id: 'pep', label: 'Find the hidden tryptic peptides', short: 'all peptides' },
      { id: 'kills', n: 4, label: 'Neutralise 4 P. aeruginosa products', short: '4 neutralised' },
    ],
    theme: {
      sky: ['#eef6e4', '#9fc89c'], far: '#557f4c', matrix: ['#7b934f', '#34472a'],
      cells: ['#dcc55c', '#c8ad40', '#d2bb4e'], eps: '#e9f2c6', plat: ['#4b6a33', '#93b866'],
      mol: '#4c7a43', pyo: 10, accent: '#3f6b2a', dark: 0.2,
    },
    intro: [
      'Grown in TSB, then 15 min in PASN: the cell-free, sterile-filtered',
      'spent medium of P. aeruginosa PAO1. No living Pseudomonas, only its',
      'secreted molecules. Climb fast: the clock shows the 15 pulse minutes.',
    ],
  },
  {
    name: 'SN', subtitle: '~15 h in 30 % PASN', build: buildSN, timeLimit: 0,
    goals: [
      { id: 'cys', n: 6, label: 'Collect 6 cystine', req: true },
      { id: 'gate', label: 'Open the gate to the MS', req: true },
      { id: 'pep', label: 'Find the hidden tryptic peptides', short: 'all peptides' },
      { id: 'reps', label: 'Keep all 3 replicates', short: '3/3 replicates' },
    ],
    theme: {
      sky: ['#d5eeee', '#3f8790'], far: '#2b6268', matrix: ['#4a746d', '#16302f'],
      cells: ['#bdb06c', '#a89955', '#c6bb7a'], eps: '#c6e4dc', plat: ['#2c514c', '#6fa197'],
      mol: '#246a73', pyo: 22, accent: '#1f5f66', dark: 0.45,
    },
    intro: [
      'Long-term exposure: 70 % TSB + 30 % PASN for ~15 h.',
      'More secreted molecules, fewer nutrients (partly depleted medium).',
      'Go down through the biofilm and its tunnels to the MS.',
    ],
  },
  {
    name: 'CF airway', subtitle: 'Bonus level: a cystic fibrosis lung', build: buildCF, timeLimit: 0,
    goalKind: 'sputum',
    goals: [
      { id: 'kills', n: 6, label: 'Neutralise 6 P. aeruginosa cells', req: true },
      { id: 'pep', label: 'Find the hidden tryptic peptides', short: 'all peptides' },
      { id: 'reps', label: 'Keep all 3 replicates', short: '3/3 replicates' },
    ],
    theme: {
      sky: ['#fbe7ea', '#d98f9c'], far: '#c2717f', matrix: ['#d48a95', '#7a3443'],
      cells: ['#f0b3bc', '#e59aa6', '#f5c4cb'], eps: '#f2e7a2', plat: ['#9b4a5a', '#e7a1ad'],
      mol: '#b05a6a', pyo: 12, accent: '#a33a52', dark: 0.22, debris: 'mucus',
    },
    intro: [
      'A game setting, not part of our experiment (that used PASN in vitro).',
      'In CF airways S. aureus and living P. aeruginosa meet in thick mucus.',
      'Climb the airway to the sputum sample.',
    ],
  },
];
