'use strict';
// Tile coordinates: row zero is the top; a surface at row r supports a cell at r-1.
// Main-route steps rise at most two rows. All routes are permanently open.
// Optional reading stations on broad, permanent floors. These are added only
// in Study mode, independently of enemies and collectibles.
const STUDY_STATIONS = [
  [
    { tx: 6, ty: 25, topics: ['TSB', 'strain', 'sulfur'] },
    { tx: 12, ty: 25, topics: ['ribosome', 'psm', 'peptide'] },
    { tx: 53, ty: 17, topics: ['sulfur', 'iron'] },
    { tx: 69, ty: 25, topics: ['replicates'] },
  ],
  [
    { tx: 18, ty: 53, topics: ['SNpulse', 'omv', 'hcn'] },
    { tx: 24, ty: 41, topics: ['ahpc', 'xan', 'proteases'] },
    { tx: 18, ty: 29, topics: ['ros', 'ribosome'] },
    { tx: 30, ty: 13, topics: ['peptide', 'replicates'] },
  ],
  [
    { tx: 5, ty: 7, topics: ['SN', 'iron'] },
    { tx: 9, ty: 26, topics: ['proteases', 'hqno', 'omv'] },
    { tx: 28, ty: 47, topics: ['foam', 'xan'] },
    { tx: 44, ty: 47, topics: ['replicates', 'peptide'] },
  ],
  [
    { tx: 6, ty: 67, topics: ['CF airway', 'airway'] },
    { tx: 26, ty: 45, topics: ['psm', 'xan', 'ahpc'] },
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
const carve = (L, x0, x1, y0, y1) => {
  fill(L, x0, x1, y0, y1, ' ');
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) L.bg[y][x] = 'c';
};
const plat = (L, x, y, len) => fill(L, x, x + len - 1, y, y, '=');
const lysed = (L, x, y, len) => fill(L, x, x + len - 1, y, y, '%');
const foam = (L, x0, x1, y) => fill(L, x0, x1, y, y, '^');
const mucus = (L, x0, x1, y) => fill(L, x0, x1, y, y, '~');
const cilia = (L, x0, x1, y, dir) => fill(L, x0, x1, y, y, dir < 0 ? '<' : '>');
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

// TSB: learn on a forgiving floor, then choose the canopy or lower passage.
function buildTSB() {
  const L = newLevel(88, 30);
  ground(L, 0, 87, 26);
  put(L, 'start', 2, 25);
  landmark(L, 6, 20, 'NUTRIENT GARDEN');
  sign(L, 4, 25, 'Run right with A/D or the arrows. Hold Space to jump higher. Follow the golden cystine trail.');
  row(L, 'cystine', 6, 8, 25);
  ribo(L, 9, 22, 'psm');
  sign(L, 11, 25, 'Bump the ribosome block from below to get PSM shots. X shoots. Low debris can be jumped over, shot, or dashed through as stk.');
  solid(L, 17, 20, 24, 25); solid(L, 25, 28, 24, 25);
  put(L, 'cystine', 18, 23); put(L, 'cystine', 26, 23);
  arrow(L, 15, 25, 'right');
  // Visible upper detour; a missed jump returns to the garden floor.
  plat(L, 13, 22, 3); plat(L, 15, 20, 4); put(L, 'peptide', 16, 19);
  debris(L, 30, 31, 25, 25);
  put(L, 'iron', 22, 25); put(L, 'check', 32, 25);
  landmark(L, 39, 16, 'THE CANOPY');
  sign(L, 35, 25, 'The swollen cell bounces you to the canopy. Follow the upper trail for a peptide, or take the broad steps ahead.');
  spring(L, 36, 25); plat(L, 36, 20, 5); plat(L, 43, 20, 4);
  solid(L, 40, 43, 24, 25); plat(L, 44, 22, 4); plat(L, 48, 20, 4);
  solid(L, 52, 63, 18, 19); plat(L, 56, 16, 4);
  put(L, 'peptide', 57, 15); row(L, 'cystine', 53, 55, 17);
  put(L, 'iron', 45, 21); put(L, 'cystine', 49, 19);
  ribo(L, 49, 17, 'tcya');
  // A shaded passage under the canopy, with an open entrance and exit.
  solid(L, 58, 64, 23, 23);
  carve(L, 59, 63, 24, 25);
  put(L, 'cystine', 58, 25); put(L, 'peptide', 62, 25);
  arrow(L, 57, 25, 'right');
  plat(L, 64, 18, 4); plat(L, 68, 20, 4);
  put(L, 'check', 69, 25);
  landmark(L, 78, 14, 'SAMPLE TERRACE');
  solid(L, 72, 75, 24, 25); solid(L, 76, 79, 22, 25);
  solid(L, 80, 87, 20, 25); plat(L, 80, 18, 8);
  // Dry intermediate steps keep the finish accessible with a single jump.
  plat(L, 76, 20, 4); plat(L, 72, 22, 4);
  put(L, 'cystine', 73, 21); put(L, 'cystine', 77, 19); put(L, 'cystine', 81, 17);
  sign(L, 70, 25, 'The terrace is just ahead. Take the broad steps up to the mass spectrometer.');
  arrow(L, 71, 25, 'up'); put(L, 'goal', 84, 17);
  L.route = [[18,24],[26,24],[32,26],[41,24],[45,22],[49,20],[54,18],[66,18],[69,20],[73,22],[77,20],[82,18],[84,18]];
  return L;
}

// SNpulse: alternating safe staging floors separate four short climbing sections.
function buildSNpulse() {
  const L = newLevel(40, 68);
  ground(L, 0, 39, 64); put(L, 'start', 2, 63);
  landmark(L, 8, 58, 'THE EXPOSURE RUN');
  sign(L, 4, 63, 'Climb the steps to the MS. The blue exposure front makes launchers fire faster. Catch your breath on the broad ledges between climbs.');
  ribo(L, 3, 60, 'psm');
  for (const [x,y] of [[6,62],[10,60],[6,58],[10,56]]) { plat(L,x,y,4); put(L,'cystine',x+1,y-1); }
  solid(L, 16, 39, 54, 55); put(L, 'check', 18, 53);
  put(L, 'omv', 26, 63); put(L, 'peptide', 36, 63);
  row(L, 'cystine', 30, 32, 63);
  put(L, 'omv', 25, 53); put(L, 'hcn', 30, 53);
  sign(L, 21, 53, 'A wide landing gives you room to watch the HCN puff before passing. The next steps climb on the right.');
  arrow(L, 34, 53, 'up');
  for (const [x,y] of [[30,52],[34,50],[30,48],[34,46],[30,44]]) plat(L,x,y,4);
  lysed(L, 24, 48, 4); put(L, 'peptide', 25, 47); put(L, 'cystine', 27, 47);
  solid(L, 0, 27, 42, 43); put(L, 'check', 24, 41);
  landmark(L, 18, 38, 'RECOVERY LEDGE');
  ribo(L, 16, 38, 'ahpc'); put(L, 'hcn', 20, 41); put(L, 'xan', 8, 41);
  put(L, 'dripper', 25, 36); put(L, 'lasa', 13, 41);
  arrow(L, 5, 41, 'up');
  for (const [x,y] of [[4,40],[8,38],[4,36],[8,34],[12,32]]) { plat(L,x,y,4); put(L,'cystine',x+1,y-1); }
  solid(L, 16, 39, 30, 31); put(L, 'check', 18, 29);
  put(L, 'omv', 23, 29); rosgun(L, 28, 29);
  landmark(L, 34, 25, 'BUBBLE CHIMNEY');
  sign(L, 32, 29, 'Ride a bubble up, or climb the permanent steps beside it. The MS is on the upper shelf to your left.');
  vent(L, 36, 29, 16);
  for (const [x,y] of [[34,28],[37,26],[34,24],[37,22],[34,20],[37,18],[34,16]]) plat(L,x,y,3);
  solid(L, 0, 33, 14, 15); put(L, 'check', 30, 13);
  put(L, 'dripper', 19, 5); put(L, 'lasb', 23, 10);
  row(L, 'cystine', 22, 24, 13); put(L, 'iron', 14, 13);
  plat(L, 35, 12, 4); plat(L, 30, 10, 4); put(L, 'peptide', 31, 9);
  arrow(L, 27, 13, 'left'); put(L, 'goal', 4, 13);
  L.route = [[18,54],[24,42],[18,30],[31,14],[4,14]];
  return L;
}

// SN: a readable descent, an open upper/lower choice, then foam stepping stones.
function buildSN() {
  const L = newLevel(54, 54);
  solid(L, 0, 14, 8, 10); put(L, 'start', 2, 7);
  landmark(L, 7, 3, 'WEATHERED BIOFILM');
  sign(L, 4, 7, 'Follow the broad shelves down. Cystine and peptides are bonus goals; your sample can go straight to the MS.');
  plat(L, 8, 6, 4); put(L, 'peptide', 9, 5); put(L, 'iron', 12, 7); put(L, 'sidero', 12, 4);
  for (const [x,y] of [[18,11],[24,14],[18,17]]) { plat(L,x,y,5); put(L,'cystine',x+2,y-1); }
  solid(L, 0, 34, 22, 29);
  // Walk or drop into the lower passage; its right end opens directly onto the descent.
  carve(L, 3, 34, 24, 26); carve(L, 3, 5, 22, 26);
  put(L, 'check', 9, 21); put(L, 'check', 9, 26);
  sign(L, 7, 21, 'Stay on top for the short route. Drop into the opening on the left for more nutrients in the sheltered passage, but watch for LasA.');
  ribo(L, 12, 18, 'psm'); put(L, 'hcn', 19, 21); put(L, 'omv', 26, 21);
  row(L, 'cystine', 12, 14, 21); put(L, 'cystine', 30, 21);
  row(L, 'cystine', 12, 16, 26); row(L, 'cystine', 25, 28, 26);
  put(L, 'lasa', 20, 26); put(L, 'hqno', 24, 25); put(L, 'peptide', 30, 26);
  arrow(L, 32, 21, 'right'); arrow(L, 32, 26, 'right');
  landmark(L, 44, 25, 'THE SPILLWAY');
  for (const [x,y] of [[37,30],[43,34],[37,38],[31,42],[26,45]]) { plat(L,x,y,5); put(L,'cystine',x+2,y-1); }
  put(L, 'lasb', 46, 33); put(L, 'dripper', 49, 27); put(L, 'xan', 39, 29);
  ground(L, 0, 53, 48); put(L, 'check', 28, 47);
  // Deliberate optional exploration on a dry recovery floor.
  put(L, 'peptide', 12, 47); row(L, 'iron', 16, 18, 47);
  sign(L, 25, 47, 'Dry ground to recover. Cross the foam on the fixed stepping stones; the MS is just beyond it.');
  foam(L, 34, 40, 47);
  plat(L, 31, 46, 3); plat(L, 35, 45, 3); plat(L, 39, 46, 3);
  put(L, 'cystine', 32, 45); put(L, 'cystine', 36, 44); put(L, 'cystine', 40, 45);
  arrow(L, 31, 47, 'right'); put(L, 'check', 44, 47); put(L, 'goal', 49, 47);
  L.route = [[20,11],[26,14],[20,17],[10,22],[32,22],[39,30],[45,34],[39,38],[33,42],[28,45],[28,48],[32,46],[36,45],[40,46],[45,48],[49,48]];
  return L;
}

// CF: fewer floors, different movement rhythms, dry takeoffs and a clear boss runway.
function buildCF() {
  const L = newLevel(40, 76);
  ground(L, 0, 39, 68); put(L, 'start', 3, 67);
  landmark(L, 10, 63, 'AIRWAY ENTRY');
  sign(L, 5, 67, 'Bonus setting, not the course experiment. Climb to the mucoid colony. Hold jump to ride cough updrafts, or hold down on a floor to brace.');
  ribo(L, 8, 64, 'psm'); put(L, 'twitch', 18, 67); mucus(L, 22, 27, 68);
  row(L, 'cystine', 12, 14, 67); arrow(L, 30, 67, 'up');
  for (const [x,y] of [[31,66],[35,64],[31,62],[29,60]]) plat(L,x,y,4);
  solid(L, 0, 25, 58, 59); mucus(L, 9, 16, 58); put(L, 'check', 21, 57);
  debris(L, 18, 19, 57, 57);
  put(L, 'twitch', 8, 57); put(L, 'pa', 18, 54); put(L, 'iron', 19, 57);
  // A visible side pocket with a permanent return step.
  plat(L, 22, 62, 4); plat(L, 27, 63, 3); put(L, 'peptide', 23, 61);
  put(L, 'cystine', 25, 61);
  for (const [x,y] of [[5,56],[1,54],[5,52],[9,50],[10,48]]) plat(L,x,y,4);
  solid(L, 14, 39, 46, 47); mucus(L, 17, 23, 46); put(L, 'check', 26, 45);
  landmark(L, 29, 40, 'SWOLLEN-CELL GARDEN');
  ribo(L, 18, 43, 'psm'); put(L, 'twitch', 22, 45); put(L, 'xan', 29, 45);
  spring(L, 31, 45);
  for (const [x,y] of [[34,44],[30,42],[34,40],[30,38],[28,36]]) plat(L,x,y,4);
  solid(L, 0, 25, 34, 35); cilia(L, 7, 17, 34, -1);
  put(L, 'check', 22, 33); put(L, 'pa', 18, 29); put(L, 'twitch', 12, 33);
  sign(L, 19, 33, 'Cilia carry you toward the left-hand steps. Pale cracked cells are a faster optional route, but they crumble after landing.');
  for (const [x,y] of [[4,32],[1,30],[5,28],[9,26],[10,24]]) plat(L,x,y,4);
  lysed(L, 9, 30, 4); lysed(L, 9, 28, 4); put(L, 'peptide', 10, 29);
  solid(L, 14, 39, 22, 23); put(L, 'check', 17, 21);
  landmark(L, 29, 18, 'COLONY APPROACH');
  rosgun(L, 30, 21); put(L, 'twitch', 24, 21); put(L, 'ahpc', 19, 21);
  for (const [x,y] of [[31,20],[35,18],[31,16],[29,14]]) plat(L,x,y,4);
  // The arena has broad, dry cover on both sides and a stock before the fight.
  solid(L, 0, 27, 12, 13); solid(L, 36, 39, 12, 13); plat(L, 28, 12, 8);
  put(L, 'check', 37, 11); put(L, 'boss', 13, 11);
  ribo(L, 7, 9, 'psm'); ribo(L, 32, 9, 'psm');
  plat(L, 2, 10, 5); plat(L, 7, 8, 5); plat(L, 12, 6, 5);
  plat(L, 34, 10, 4); plat(L, 30, 8, 4); plat(L, 31, 6, 4);
  plat(L, 12, 4, 18); put(L, 'peptide', 32, 5);
  sign(L, 23, 3, 'Clear the colony, then deliver the sputum sample. The upper ledges give you room to dodge and return fire.');
  put(L, 'goal', 18, 3);
  L.route = [[21,58],[26,46],[22,34],[17,22],[37,12],[18,4]];
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
    name: 'TSB', subtitle: 'The nutrient garden', build: buildTSB, timeLimit: 0, medals: [55, 85, 125],
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
      'Run right through the garden. Follow the cystine trail up to the MS.',
      'The upper canopy and the shaded pocket hide optional peptides.',
    ],
  },
  {
    name: 'SNpulse', subtitle: 'TSB, then 15 min PASN', build: buildSNpulse, timeLimit: 145, medals: [80, 110, 135],
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
      'secreted molecules. Climb the open steps ahead of the blue front.',
    ],
  },
  {
    name: 'SN', subtitle: 'Through the weathered biofilm', build: buildSN, timeLimit: 0, medals: [70, 105, 155],
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
      'Descend along broad shelves. The lower passage is open to explore.',
    ],
  },
  {
    name: 'CF airway', subtitle: 'Bonus level: a cystic fibrosis lung', build: buildCF, timeLimit: 0, medals: [140, 210, 300],
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
