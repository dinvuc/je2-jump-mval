'use strict';
// game.js -- "JE2 Jump": a small platformer about the Bio253 JE2 proteomics course.
// Plain JavaScript + <canvas>, no libraries, no build step: open index.html and play.
// Needs facts.js, levels.js and runtime.js; classic scripts, no build step.

const TILE = 32, VIEW_W = 960, VIEW_H = 544;
const STEP_MS = 1000 / 60;            // fixed physics step: 60 updates per second
const TAU = Math.PI * 2;

// Physics. A jump of JUMP_V climbs JUMP_V^2 / (2 * GRAV) ≈ 97 px ≈ 3 tiles.
const GRAV = 0.55, MAX_FALL = 12;
const RUN_ACC = 0.6, RUN_MAX = 3.8, FRICTION = 0.78;
const JUMP_V = -10.6;
const COYOTE = 12;  // frames you may still jump after walking off a ledge (0.2 s)
const BUFFER = 6;   // frames a jump press is remembered before landing
const LYSIS_DELAY = 36, LYSIS_DOWN = 240;   // lysed cells: collapse after 0.6 s, back after 4 s
const PULSE_S = 900;                        // the SNpulse clock shows 15 min
const SPRING_V = -15.5;                     // swollen-cell bounce (~6 rows)
const MAX_AMMO = 20;                        // PSM shots you can carry
const SOLID = new Set(['#', '~', '<', '>', 'B', 'R', 'U']);   // biofilm, mucus, cilia, debris, ribosome (U = used)
const isSolid = c => SOLID.has(c);
// Hidden passages ('H') let the player through but stop enemies, items and drops.
const enemySolid = c => SOLID.has(c) || c === 'H';
const ENEMIES = new Set(['lasa', 'omv', 'lasb', 'pa', 'twitch', 'sidero', 'rosb']);

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const runSettings = document.getElementById('run-settings');
const difficultyButtons = ['mode-study', 'mode-normal', 'mode-hard'].map(id => document.getElementById(id)).filter(Boolean);
const studyControls = document.getElementById('study-controls');
const studyPanel = document.getElementById('study-panel');
const studyButtons = ['study-open', 'study-close', 'study-prev', 'study-next'].map(id => document.getElementById(id)).filter(Boolean);
configureCanvas();
function resizeGame() {
  if (configureCanvas() && L) L.art = buildLevelArt(L, L.def.theme, L.artSeed);
}
addEventListener('resize', resizeGame);
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resizeGame).observe(canvas);

// ---- input -----------------------------------------------------------------------
const keys = {};      // held right now
const pressed = {};   // pressed since last read (read with took())
const KEYMAP = {
  ArrowLeft: ['left'], KeyA: ['left'], ArrowRight: ['right'], KeyD: ['right'],
  ArrowUp: ['jump', 'up'], KeyW: ['jump', 'up'], ArrowDown: ['down'], KeyS: ['down'],
  Space: ['jump', 'confirm'], Enter: ['ok', 'confirm'],
  KeyP: ['pause'], Escape: ['pause'], Digit1: ['s1'], Digit2: ['s2'], Digit3: ['s3'],
  KeyM: ['mute'], KeyN: ['music'], KeyX: ['shoot'], KeyK: ['shoot'], ShiftLeft: ['shoot'], ShiftRight: ['shoot'],
  KeyC: ['dash'], KeyR: ['retry'], KeyG: ['ghost'],
  KeyB: ['biology'], KeyT: ['share'], KeyL: ['link'], KeyI: ['photo'],
};
function press(k) { if (!keys[k]) pressed[k] = true; keys[k] = true; }
function release(k) { keys[k] = false; }
addEventListener('keydown', e => {
  AUDIO.unlock();
  if (difficultyButtons.includes(e.target)) return;
  if (e.target && e.target.tagName === 'TEXTAREA') return;   // typing in the share panel
  if (e.target && e.target.tagName === 'SUMMARY' && ['Enter', 'Space'].includes(e.code)) return;   // the lab note opens natively
  if (studyButtons.includes(e.target) && ['Enter', 'Space'].includes(e.code)) return;
  const ks = KEYMAP[e.code];
  if (!ks) return;
  e.preventDefault();
  ks.forEach(press);
});
addEventListener('keyup', e => { const ks = KEYMAP[e.code]; if (ks) ks.forEach(release); });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
addEventListener('pointerdown', () => AUDIO.unlock());
function took(k) { const p = !!pressed[k]; pressed[k] = false; return p; }
function clearPressed() { for (const k in pressed) pressed[k] = false; }

// Touch buttons (only shown on touch screens).
const touchBox = document.getElementById('touch');
for (const b of touchBox.querySelectorAll('button')) {
  const k = b.dataset.key;
  b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); AUDIO.unlock(); press(k); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => release(k));
}

const fullScreenButton = document.getElementById('fullscreen');
if (fullScreenButton) {
  const stage = document.getElementById('stage');
  if (!stage.requestFullscreen) fullScreenButton.hidden = true;
  else fullScreenButton.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stage.requestFullscreen();
    } catch { /* fullscreen can be unavailable in an embedded browser */ }
  });
  document.addEventListener('fullscreenchange', () => {
    fullScreenButton.textContent = document.fullscreenElement ? 'Exit full screen' : 'Full screen';
    resizeGame();
  });
}

// Clicks / taps on the canvas: strain cards on the title, items in the pause menu,
// otherwise "continue".
canvas.addEventListener('pointerdown', e => {
  const r = canvas.getBoundingClientRect();
  const x = (e.clientX - r.left) * VIEW_W / r.width;
  const y = (e.clientY - r.top) * VIEW_H / r.height;
  const inside = c => x > c.x && x < c.x + c.w && y > c.y && y < c.y + c.h;
  const resultKind = { levelDone: 'level', win: 'win', dailyDone: 'daily', logDone: 'endless' }[G.state];
  if (G.state === 'title') {
    const lv = levelChips().find(inside);
    if (lv) { setTitleSlot(lv.i); AUDIO.play('move'); return; }
    const mode = modeChips().find(inside);
    if (mode) {
      if (mode.slot === 'codex') { AUDIO.play('click'); openCodex('title'); }
      else { setTitleSlot(mode.slot); AUDIO.play('move'); }
      return;
    }
    const hit = strainCards().find(inside);
    if (hit) { if (G.titleMode !== 'daily') G.strain = hit.key; AUDIO.play('click'); startGame(); }
  } else if (G.state === 'codex') {
    codexClick(x, y);
  } else if (resultKind && shareButtonAt(resultKind, x, y)) {
    pressed[shareButtonAt(resultKind, x, y)] = true;
  } else if (G.state === 'paused') {
    const i = menuRects().findIndex(m => x > m.x && x < m.x + m.w && y > m.y && y < m.y + m.h);
    if (i >= 0) { G.menuIdx = i; menuSelect(); }
  } else if (G.state === 'gameOver' && y > 420 && y < 480) {
    pressed.retry = true;
  } else if (G.state !== 'play') {
    pressed.ok = true;
  }
});

// ---- small helpers ---------------------------------------------------------------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
function bestScoreKey() { return 'je2jump_v3_best' + (G.difficulty < 100 ? `_study_${G.difficulty}` : G.difficulty > 100 ? '_hard' : ''); }
function loadBest(key = 'je2jump_v3_best') { try { return Number(localStorage.getItem(key)) || 0; } catch { return 0; } }
function saveBest(v) { try { localStorage.setItem(bestScoreKey(), String(v)); } catch { /* private mode */ } }
// Best times per level (seconds), kept in this browser only.
function loadTimes() {
  try {
    const value = JSON.parse(localStorage.getItem('je2jump_v3_times'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([, t]) => Number.isFinite(t) && t > 0));
  } catch { return {}; }
}
function saveTimes(t) { try { localStorage.setItem('je2jump_v3_times', JSON.stringify(t)); } catch { /* private mode */ } }
const MEDALS = [['gold', '#f3c22f'], ['silver', '#c9d3dc'], ['bronze', '#d08a4c']];
function medalFor(def, secs) {
  const i = medalTargets(def).findIndex(m => secs <= m);
  return i < 0 ? null : MEDALS[i];
}
const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// Seeded random numbers, so the level art looks the same every time.
function mulberry32(a) {
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Colour helpers: '#rrggbb' -> rgba() string, and mixing two colours.
function hexRgb(h) { const n = parseInt(h.slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgba(h, a) { const [r, g, b] = hexRgb(h); return `rgba(${r},${g},${b},${a})`; }
function mix(h1, h2, t) {
  const a = hexRgb(h1), b = hexRgb(h2);
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
}

// ---- game state ------------------------------------------------------------------
const G = { state: 'title', difficulty: 100, studySeen: {}, studyTick: 0, strain: 'anc', levelIdx: 0, startLevel: 0, score: 0, results: [], toast: '', toastT: 0, best: loadBest(), seen: {}, shake: 0, menuIdx: 0 };
G.ghostOn = true;
// mode: 'story' (the four maps in order), 'daily' or 'log' (see modes.js).
Object.assign(G, { mode: 'story', titleMode: 'story', deaths: 0, met: {}, codexIdx: 0, resultT: 0, shakeT: 0 });
let L = null;  // the running level
let P = null;  // the player

for (const button of difficultyButtons) {
  button.addEventListener('click', () => {
    if (G.state !== 'title') return;
    G.difficulty = Number(button.dataset.difficulty);
    G.best = loadBest(bestScoreKey());
    syncDifficultyControl();
    AUDIO.play('move');
  });
  button.addEventListener('focus', () => {
    for (const k in keys) keys[k] = false;
    clearPressed();
  });
}
syncDifficultyControl();
adoptRival(readRaceFromUrl());   // a "race my ghost" link selects that level and strain
const sharePanel = document.getElementById('share-panel');
if (sharePanel) {
  const close = document.getElementById('share-close'), copy = document.getElementById('share-copy'), area = document.getElementById('share-text');
  if (close) close.addEventListener('click', () => { sharePanel.hidden = true; });
  if (copy && area) copy.addEventListener('click', () => { try { area.select(); document.execCommand('copy'); copy.textContent = 'Copied'; } catch { /* select by hand */ } });
}
for (const button of studyButtons) button.addEventListener('click', () => {
  if (button.id === 'study-open') toggleStudyStation();
  else if (button.id === 'study-close') { G.studyOpen = false; renderStudyStation(); }
  else turnStudyPage(button.id === 'study-prev' ? -1 : 1);
});

function setState(s) {
  G.state = s; clearPressed();
  if (runSettings) runSettings.hidden = s !== 'title';
  if (s !== 'play') { G.studyStation = null; G.studyOpen = false; renderStudyStation(); }
  touchBox.hidden = !matchMedia('(pointer: coarse)').matches || (s !== 'play' && s !== 'paused');
  const fromTitle = s === 'title' || (s === 'codex' && G.codexFrom === 'title');
  AUDIO.music(fromTitle ? 'title' : !L ? 'title' : L.bossActive && !L.bossDown ? 'boss' : L.def.name);
  AUDIO.duck(s === 'paused' || s === 'codex');
  if (s !== 'play' && s !== 'paused') { AUDIO.muffle(false); AUDIO.intensity(0); }
  if (s === 'title') { G.iris = 45; G.mode = 'story'; }
}

// Start at the level picked on the title screen; later levels follow in order.
function startGame() {
  if (G.titleMode === 'daily') { startDaily(); return; }
  if (G.titleMode === 'log') { startLogPhase(); return; }
  G.mode = 'story';
  G.levelIdx = G.startLevel; G.score = 0; G.results = []; G.seen = {}; G.studySeen = {}; G.newBest = false;
  loadLevel(G.levelIdx);
  setState('intro');
}

// Every map has two parts. Run-wide state (time, score, inventory, replicates)
// lives on L for the whole map; setStageWorld swaps only the terrain and entities.
// opts: def (another level definition, e.g. Log phase), stage (start in part 2),
// mods (daily rule changes), keepDeaths (an instant restart keeps the death count).
function loadLevel(i, opts = {}) {
  const def = opts.def || LEVELS[i], stage = opts.stage || 0;
  const builds = def.stages.map(build => build());
  const count = type => builds.reduce((n, b) => n + b.ents.filter(e => e.type === type).length, 0);
  const mods = { grav: 1, run: 1, ...(opts.mods || {}) };
  if (!opts.keepDeaths) G.deaths = 0;
  G.met = {};
  L = {
    def, idx: i, time: 0, cam: 0, camY: 0, cystine: 0, ironBank: 0, ironTotal: 0, points: 0,
    killFeed: [], killCount: {}, combo: 0, comboT: 0, kills: 0, peptides: 0,
    retries: 0,
    difficulty: G.difficulty,
    timeLimit: def.timeLimit && G.difficulty > 0 ? Math.round(def.timeLimit * (1 + 2 * Math.max(0, 1 - G.difficulty / 100))) : 0,
    recording: [], ghostIndex: 0, bannerT: 0,
    bossDown: false, caveK: 0, goalSeen: {},
    abNext: 60 * (35 + Math.random() * 15), abWarn: 0, abOn: 0, abExpose: 0, covered: true,
    coughNext: 60 * (14 + Math.random() * 10), coughing: 0, coughWarn: 0, coughFlash: 0,
    totalCys: count('cystine'), totalPep: count('peptide'), totalStocks: count('check') + builds.length - 1, stocks: 0,
    mods, maxReps: mods.maxReps || 3, timeBase: 0, splits: [], gen: 0,
    lookX: VIEW_W * 0.1, lookY: 0, tags: [], bigs: [], flyers: [], hudBump: {}, shownScore: NaN,
    attempts: {}, attempt: null, partArt: {}, bumps: new Map(), rivalIndex: 0,
  };
  setStageWorld(builds[stage], stage);
  // A daily challenge in part 2 of SNpulse starts with the clock where part 2 begins.
  if (stage > 0 && def.timeLimit) {
    const share = (def.stageShare || def.stages.map(() => 1 / def.stages.length)).slice(0, stage).reduce((a, b) => a + b, 0);
    L.time = L.timeBase = Math.round(share * (L.timeLimit || def.timeLimit) * 60);
  }
  if (def.endless) L.front = (L.logBase + 4) * TILE;
  P = {
    x: L.respawn.x, y: L.respawn.y, w: 24, h: 28, vx: 0, vy: 0,
    onGround: false, coyote: 0, buffer: 0, djReady: true, groundT: 0,
    face: 1, inv: 0, slow: 0, shield: 0, magnet: 0, phos: 0, reps: L.maxReps, squash: 0, ride: null, roll: 0,
    ammo: 0, gold: 0, shootCool: 0, sticky: 0, belt: 0, sprung: false,
    glide: 60, dash: 0, dashCool: 0, shootFlash: 0,
    chain: 0, happy: 0, spin: 0, look: null, scared: false,
  };
  L.rival = rivalMatches() ? G.rival : null;
  G.toast = ''; G.toastT = 0; G.failReason = ''; G.shake = 0; G.iris = 45; G.hitStop = 0; G.studyTick = 0;
  G.studyStation = null; G.studyOpen = false; G.studyIndex = 0; renderStudyStation();
  for (const g of def.goals) L.goalSeen[g.id] = g.id === 'reps' || g.id === 'time';
  L.ghost = loadGhost();
  captureCheckpoint();
  const dashButton = touchBox.querySelector('[data-key="dash"]');
  if (dashButton) dashButton.hidden = G.strain !== 'stk';
  snapCamera();
}
// Terrain, entities and everything drawn in world coordinates for one part of a map.
function setStageWorld(b, stage) {
  Object.assign(L, {
    stage, cols: b.cols, rows: b.rows, grid: b.grid, signs: b.signs, ribo: b.ribo, route: b.route, bg: b.bg,
    ents: b.ents.map(e => ({ ...e, x: e.tx * TILE, y: e.ty * TILE, alive: true, t: 0 })),
    fx: [], pops: [], callouts: [], movers: [], shots: [], lysis: new Map(), solids: [], plats: [], spawnQ: [],
    jiggle: new Map(), bossActive: false, goalMsgT: 0,
    studyStations: G.difficulty < 100 ? ((STUDY_STATIONS[L.idx] || [])[stage] || []) : [],
    artSeed: L.idx + 10 * stage, logBase: b.logBase,
  });
  L.art = buildLevelArt(b, L.def.theme, L.artSeed);
  L.partArt[stage] = L.art.tiles;   // kept for the attempt replay at the end of the map
  for (const e of L.ents) initEntity(e);
  const start = L.ents.find(e => e.type === 'start');
  L.respawn = { x: start.x + 4, y: start.y + 4 };
  newAttempt();
}
// The gate at the end of part 1 acts as a checkpoint: it saves a stock and
// carries the run (time, score, replicates, inventory) into part 2.
function enterStage(stage) {
  endAttempt('clear');
  // split time for the part just finished, compared with the personal-best run
  const split = L.time / 60, pb = (loadSplits()[runKey()] || [])[stage - 1];
  L.splits[stage - 1] = split;
  L.splitDelta = Number.isFinite(pb) ? split - pb : null;
  setStageWorld(L.def.stages[stage](), stage);
  Object.assign(P, { x: L.respawn.x, y: L.respawn.y, vx: 0, vy: 0, ride: null, dash: 0, onGround: false, inv: 60, slow: 0 });
  L.stocks++;
  L.bannerT = 200; G.iris = 45; G.shake = 0;
  captureCheckpoint();
  L.stageStart = { checkpoint: L.checkpoint, time: L.time, samples: L.recording.length };
  snapCamera();
  AUDIO.play('check'); AUDIO.music(L.def.name);
}

function initEntity(e) {
  switch (e.type) {
    case 'lasa': e.w = 28; e.h = 22; e.y = e.ty * TILE + TILE - e.h; e.vx = -1.1; break;
    case 'sidero': e.hx = e.x + 16; e.hy = e.y + 16; e.cx = e.hx; e.cy = e.hy; e.cool = 0; break;
    case 'hqno': e.cx = e.x + 16; e.cy = e.y + 16; break;   // drawn before its first update
    case 'vent': e.cool = 20; e.rise = e.rise || 10; break;
    case 'omv': e.vx = 1.5; e.vy = 0; break;
    case 'lasb': case 'pa': e.hx = e.x + 16; e.hy = e.y + 16; e.cx = e.hx; e.cy = e.hy; e.ang = 0; break;
    case 'twitch': e.dir = -1; break;
    case 'geyser': e.h = e.h || 3; e.phase = e.phase || 0; break;
    case 'drift': e.dx = e.dx || 0; e.dy = e.dy || 0; e.per = e.per || 240; e.phase = e.phase || 0; e.cx = e.x + 16; e.cy = e.y + 16; break;
    case 'spring': e.cool = 0; e.sq = 0; break;
    case 'rosgun': e.cool = 60 + (e.tx * 37) % 120; break;
    case 'boss': Object.assign(e, { bx: e.x + 16, by: (e.ty + 1) * TILE, hp: 20, maxHp: 20, state: 'idle', timer: 0, dir: 1, open: 0, vy: 0, jy: 0, hitT: 0, cycle: 0 }); break;
  }
}
// New enemies appear at the end of the entity update (coughs, the boss, launchers).
function spawnEnemy(type, x, y, extra = {}) {
  const e = { type, tx: Math.floor(x / TILE), ty: Math.floor(y / TILE), x: x - 16, y: y - 16, alive: true, t: 0, ...extra };
  initEntity(e);
  L.spawnQ.push(e);
  return e;
}

function toast(text, frames = 200) { G.toast = text; G.toastT = frames; }
function once(key, text) { if (!G.seen[key]) { G.seen[key] = true; toast(text, 260); } }

// ---- camera: follows the player in x and y ---------------------------------------
function cameraTarget() {
  return [
    // look ahead in the direction you face (lookX) and down while falling (lookY)
    clamp(P.x + P.w / 2 - VIEW_W * 0.5 + L.lookX, 0, L.cols * TILE - VIEW_W),
    clamp(P.y + P.h / 2 - VIEW_H * 0.55 + L.lookY, 0, L.rows * TILE - VIEW_H),
  ];
}
function snapCamera() { [L.cam, L.camY] = cameraTarget(); }
function followCamera() {
  const [tx, ty] = cameraTarget();
  L.cam += (tx - L.cam) * 0.12;
  L.camY += (ty - L.camY) * 0.1;
  // Never let a fast fall or climb carry the player off screen.
  const maxY = L.rows * TILE - VIEW_H;
  if (P.y + P.h - L.camY > VIEW_H - 70) L.camY = Math.min(maxY, P.y + P.h - (VIEW_H - 70));
  if (P.y - L.camY < 80) L.camY = Math.max(0, P.y - 80);
}

// ---- tiles -----------------------------------------------------------------------
// '#' solid, '=' strand (one-way), '%' lysed cells (one-way, collapse), '^' foam.
function tileAt(tx, ty) {
  if (tx < 0 || tx >= L.cols) return '#';   // invisible walls at both ends
  if (ty < 0 || ty >= L.rows) return ' ';   // open above, a pit below
  const c = L.grid[ty][tx];
  if (c === '%') { const s = L.lysis.get(ty * L.cols + tx); if (s && s.down > 0) return ' '; }
  return c;
}
const oneWay = c => c === '=' || c === '%';

function moveX() {
  P.x += P.vx;
  const top = Math.floor(P.y / TILE), bot = Math.floor((P.y + P.h - 1) / TILE);
  const tx = Math.floor((P.vx > 0 ? P.x + P.w - 1 : P.x) / TILE);
  if (P.dash > 0) for (let ty = top; ty <= bot; ty++) if (tileAt(tx, ty) === 'B') breakTile(tx, ty);
  for (let ty = top; ty <= bot; ty++) if (isSolid(tileAt(tx, ty))) {
    P.x = P.vx > 0 ? tx * TILE - P.w : (tx + 1) * TILE; P.vx = 0; break;
  }
}

function moveY() {
  const prevBottom = P.y + P.h;
  P.y += P.vy;
  P.onGround = false;
  const rode = P.ride; P.ride = null;
  const left = Math.floor(P.x / TILE), right = Math.floor((P.x + P.w - 1) / TILE);
  if (P.vy > 0) {
    // a) the tile row just under the feet: land on it if we came from above
    //    (this also keeps you standing: each frame gravity pushes the feet a
    //    fraction of a pixel into that row and we put you back on top).
    const R = Math.floor((P.y + P.h) / TILE);
    if (prevBottom <= R * TILE + 0.5) {
      for (let tx = left; tx <= right; tx++) {
        const c = tileAt(tx, R);
        if (isSolid(c) || oneWay(c)) { P.y = R * TILE - P.h; P.vy = 0; P.onGround = true; break; }
      }
    }
    // b) solid tiles we have sunk into
    if (!P.onGround) {
      const ty = Math.floor((P.y + P.h - 1) / TILE);
      for (let tx = left; tx <= right; tx++) if (isSolid(tileAt(tx, ty))) { P.y = ty * TILE - P.h; P.vy = 0; P.onGround = true; break; }
    }
  } else if (P.vy < 0) {
    // head bump: the tile above your centre counts first (ribosome / debris blocks)
    const ty = Math.floor(P.y / TILE), mid = Math.floor((P.x + P.w / 2) / TILE);
    let hit = isSolid(tileAt(mid, ty)) ? mid : -1;
    if (hit < 0) for (let tx = left; tx <= right; tx++) if (isSolid(tileAt(tx, ty))) { hit = tx; break; }
    if (hit >= 0) { P.y = (ty + 1) * TILE; P.vy = 0; bumpTile(hit, ty); }
  }
  // Air bubbles are one-way moving surfaces that carry you. They can
  // also lift you off the floor when they rise through your feet.
  if (P.vy >= 0) for (const m of L.plats) {
    if (P.x + P.w > m.pl + 2 && P.x < m.pr - 2 && prevBottom <= m.top + 2 + (m === rode ? 2 : 0) && P.y + P.h >= m.top - 0.01) {
      P.y = m.top - P.h; P.vy = 0; P.onGround = true; P.ride = m; break;
    }
  }
  for (const r of L.solids) {
    if (!overlap(P, r)) continue;
    if (P.vy >= 0 && prevBottom <= r.y + 2) { P.y = r.y - P.h; P.vy = 0; P.onGround = true; P.ride = null; }
    else if (P.vy < 0 && prevBottom - P.h >= r.y + r.h - 2) { P.y = r.y + r.h; P.vy = 0; }
  }
}

// '^' = rhamnolipid foam. Only its lower part hurts.
function inFoam() {
  const x0 = Math.floor(P.x / TILE), x1 = Math.floor((P.x + P.w - 1) / TILE);
  const y0 = Math.floor(P.y / TILE), y1 = Math.floor((P.y + P.h - 1) / TILE);
  for (let ty = y0; ty <= y1; ty++)
    for (let tx = x0; tx <= x1; tx++)
      if (tileAt(tx, ty) === '^' && overlap(P, { x: tx * TILE + 4, y: ty * TILE + 14, w: TILE - 8, h: TILE - 14 })) return true;
  return false;
}

// ---- blocks you bump from below: ribosomes make a protein, debris breaks ---------
function breakTile(tx, ty) {
  L.grid[ty][tx] = ' ';
  const col = L.def.theme.debris === 'mucus' ? '#c7d36a' : '#a08f78';
  burst(tx * TILE + 16, ty * TILE + 16, col, 8, 3.2, 0.15, 34);
  shards(tx * TILE + 16, ty * TILE + 16, col, 9);
  L.points += 20; G.shake = Math.max(G.shake, 3);
  AUDIO.play('breakb');
}
function bumpTile(tx, ty) {
  const c = tileAt(tx, ty);
  if (c === 'R' || c === 'U') L.bumps.set(ty * L.cols + tx, 10);   // the block hops up
  if (c === 'B') breakTile(tx, ty);
  else if (c === 'R') {
    L.grid[ty][tx] = 'U';
    const item = L.ribo[`${tx},${ty}`] || 'psm';
    L.ents.push({ type: item, tx, ty: ty - 1, x: tx * TILE, y: ty * TILE, alive: true, t: 0, pop: TILE, fromRibo: true, vx: (P.face || 1) * 1.3, vy: 0 });
    burst(tx * TILE + 16, ty * TILE, '#ffe9a8', 10, 2.2);
    AUDIO.play('ribo');
    tagOnce('ribo', 'TRANSLATED · A NEW PROTEIN!', '#ffe9a8');
    meet('ribosome');
  } else AUDIO.play('move');
}

// ---- PSM shots ------------------------------------------------------------------
function shoot() {
  P.ammo--; P.shootCool = 12;
  L.shots.push({ x: P.x + P.w / 2 + P.face * 12, y: P.y + 12, vx: P.face * 6.5 + P.vx * 0.3, vy: -2, life: 100, bounces: 0 });
  AUDIO.play('shoot');
}
function updateShots() {
  for (const s of L.shots) {
    s.life--;
    s.vy = Math.min(s.vy + 0.35, 9);
    s.x += s.vx;
    const fx = Math.floor((s.x + Math.sign(s.vx) * 5) / TILE), fy = Math.floor(s.y / TILE), c = tileAt(fx, fy);
    if (isSolid(c)) { if (c === 'B') breakTile(fx, fy); s.life = 0; }
    if (L.solids.some(r => !r.block && s.x > r.x && s.x < r.x + r.w && s.y > r.y && s.y < r.y + r.h)) s.life = 0;
    s.y += s.vy;
    const by = Math.floor((s.y + 5) / TILE), bc = tileAt(Math.floor(s.x / TILE), by);
    if (s.vy > 0 && (isSolid(bc) || oneWay(bc)) && s.y + 5 - s.vy <= by * TILE + 1) {
      s.y = by * TILE - 5; s.vy = -4.6;
      if (++s.bounces > 3) s.life = 0;
    }
    if (s.life > 0 && L.bossActive) for (const e of L.ents) {   // PSMs hurt the boss too
      if (e.type !== 'boss' || !e.alive || e.state === 'dead') continue;
      if (overlap({ x: s.x - 4, y: s.y - 4, w: 8, h: 8 }, bossBox(e))) { damageBoss(e, e.open > 0.6 ? 2 : 1); s.life = 0; }
    }
    if (s.life > 0) for (const e of L.ents) {
      if (!e.alive || !ENEMIES.has(e.type)) continue;
      const b = enemyBox(e);
      if (s.x > b.x - 5 && s.x < b.x + b.w + 5 && s.y > b.y - 5 && s.y < b.y + b.h + 5) { killEnemy(e); s.life = 0; break; }
    }
    if (s.life <= 0) burst(s.x, s.y, '#e88ad0', 6, 1.8, 0.05, 16);
  }
  if (L.shots.length) L.shots = L.shots.filter(s => s.life > 0);
}

// ---- enemies: hit boxes, stomping, neutralising ------------------------------------
function enemyBox(e) {
  switch (e.type) {
    case 'lasa': return { x: e.x, y: e.y, w: e.w, h: e.h };
    case 'omv': return { x: e.x + 5, y: e.y + 5, w: 22, h: 22 };
    case 'twitch': return { x: e.x + 2, y: e.y + 17, w: 28, h: 15 };
    case 'sidero': return { x: e.cx - 12, y: e.cy - 12, w: 24, h: 24 };
    case 'rosb': return { x: e.x + 2, y: e.y + 9, w: 28, h: 14 };
    default: return { x: e.cx - 13, y: e.cy - 9, w: 26, h: 18 };   // lasb, pa
  }
}
const ENEMY_COL = { lasa: '#b8404c', omv: '#8fb6e8', lasb: '#2f8f86', pa: '#5fae4f', twitch: '#5fae4f', sidero: '#c8e85a', rosb: '#ff7a3c' };
// Foam geyser cycle (frames): rest, bubbling warning, then the column rises, holds and sinks.
const GEYSER_CYCLE = 200, GEYSER_WARN = 90, GEYSER_UP = 130;
function foamGeyserState(e) {
  const ph = (e.t + e.phase) % GEYSER_CYCLE, full = e.h * TILE;
  if (ph < GEYSER_WARN) return { warn: false, height: 0, ph };
  if (ph < GEYSER_UP) return { warn: true, height: 0, ph };
  const k = Math.min(1, (ph - GEYSER_UP) / 10, (GEYSER_CYCLE - ph) / 12);
  return { warn: false, height: full * k, ph };
}
// Kill feed: a big stamped name where the enemy was, plus a running log in the HUD.
const ENEMY_NAME = {
  lasa: ['LasA', 'LasA protease'], lasb: ['LasB', 'LasB elastase'], omv: ['OMV', 'outer membrane vesicle'],
  pa: ['P. aeruginosa', 'P. aeruginosa cell'], twitch: ['P. aeruginosa', 'twitching P. aeruginosa'],
  sidero: ['siderophore', 'siderophore'], rosb: ['superoxide', 'superoxide radical'],
  boss: ['mucoid colony', 'mucoid P. aeruginosa colony'],
};
function announceKill(type, x, y) {
  const [short, long] = ENEMY_NAME[type] || [type, type];
  const color = type === 'boss' ? '#9be07a' : ENEMY_COL[type] || '#ff8a96';
  L.killCount[type] = (L.killCount[type] || 0) + 1;
  L.callouts.push({ x, y: y - 40, text: short, color, life: 80, max: 80, tilt: (Math.random() - 0.5) * 0.24 });
  const top = L.killFeed[0];
  if (top && top.type === type) { top.n++; top.life = 260; top.bump = 12; }
  else L.killFeed.unshift({ type, name: long, color, n: 1, life: 260, age: 0, bump: 0 });
  if (L.killFeed.length > 4) L.killFeed.length = 4;
}
function killEnemy(e) {
  const b = enemyBox(e);
  e.alive = false;
  if (e.type !== 'rosb') L.kills++;   // a radical is not a P. aeruginosa product or cell
  announceKill(e.type, b.x + b.w / 2, b.y);
  gain(200, b.x + b.w / 2, b.y, '#ff8a96');
  flash(b.x + b.w / 2, b.y + b.h / 2, 20);
  burst(b.x + b.w / 2, b.y + b.h / 2, ENEMY_COL[e.type] || '#b8404c', 16, 3.2);
  ring(b.x + b.w / 2, b.y + b.h / 2, 6, 48, '#ffffff', 16, 3);
  G.shake = Math.max(G.shake, 5); G.hitStop = 3; AUDIO.play('stomp');
  codexSee(e.type);
}
// Stomping several enemies without touching the ground: DOUBLE! TRIPLE! ...
const CHAIN_WORDS = ['', '', 'DOUBLE!', 'TRIPLE!', 'QUADRUPLE!', 'MEGA CHAIN!'];
function stompChain() {
  P.chain = (P.chain || 0) + 1;
  if (P.chain < 2) return;
  const bonus = 100 * P.chain;
  L.points += bonus;
  bigText(`${CHAIN_WORDS[Math.min(P.chain, 5)]} +${bonus}`, P.x + P.w / 2, P.y - 30, ['#ffe27a', '#ffb36b', '#ff8ad0', '#9fe7ff'][P.chain % 4]);
  AUDIO.play('chain', P.chain);
}
// A quick white flash (impact), drawn as a fading particle.
function flash(x, y, r) { L.fx.push({ x, y, vx: 0, vy: 0, grav: 0, life: 9, max: 9, color: 'rgba(255,255,255,0.9)', r }); }
function enemyContact(e, msg, kind = 'enemy') {
  const b = enemyBox(e);
  if (!overlap(P, b)) return;
  if (P.vy > 0 && P.y + P.h - P.vy <= b.y + 8) { killEnemy(e); P.vy = JUMP_V * 0.7; P.sprung = false; P.squash = 0.32; stompChain(); }
  else hurt(kind, msg);
}

// ---- the boss: a mucoid P. aeruginosa colony wrapped in alginate (CF level) ----------
function bossBox(e) { return { x: e.bx - 46, y: e.by + e.jy - 70, w: 92, h: 70 }; }
function damageBoss(e, n) {
  if (e.hitT > 0 || e.state === 'dead') return;
  e.hp -= n; e.hitT = 18;
  G.shake = Math.max(G.shake, 6); G.hitStop = 4;
  flash(e.bx, e.by + e.jy - 38, 46);
  burst(e.bx, e.by - 40, '#9be07a', 14, 3);
  AUDIO.play('bossHit');
  if (e.hp <= 0) {
    e.state = 'dead'; e.timer = 0; L.bossDown = true; L.kills++; L.points += 3000;
    announceKill('boss', e.bx, e.by - 80);
    burst(e.bx, e.by - 40, '#c9f0a0', 40, 5); burst(e.bx, e.by - 40, '#5fae4f', 30, 4);
    G.shake = 16; AUDIO.play('bossDie'); AUDIO.music(L.def.name);
    toast('You cleared the mucoid P. aeruginosa colony! Now reach the sputum sample.', 260);
  }
}
function bossGlob(e, vx, vy) { spawnEnemy('glob', e.bx, e.by + e.jy - 50, { vx, vy }); }
function updateBoss(e, pcx) {
  if (e.hitT > 0) e.hitT--;
  if (e.state === 'dead') { if (++e.timer > 90) e.alive = false; return; }
  if (!L.bossActive) {
    if (P.y + P.h <= e.by + 2 && P.y + P.h > e.by - 12 * TILE) {
      L.bossActive = true; e.state = 'walk'; e.timer = 0;
      AUDIO.music('boss');
      toast('A mucoid P. aeruginosa colony, wrapped in alginate! Shoot it, or jump on it while its shell is open.', 280);
    }
    return;
  }
  e.timer++;
  const angry = e.hp <= e.maxHp / 2, lo = 2 * TILE + 46, hi = (L.cols - 2) * TILE - 46;
  switch (e.state) {
    case 'walk':
      e.dir = Math.sign(pcx - e.bx) || e.dir;
      e.bx = clamp(e.bx + e.dir * (angry ? 1.5 : 1.0), lo, hi);
      if (e.timer > (angry ? 130 : 170)) { e.state = e.cycle++ % 2 ? 'spawn' : 'spit'; e.timer = 0; }
      break;
    case 'spit': // pyocyanin globs in arcs
      if (e.timer % 15 === 0 && e.timer <= 45) bossGlob(e, clamp((pcx - e.bx) / 45, -5, 5) + (Math.random() - 0.5) * 1.5, -7 - Math.random() * 2);
      if (e.timer > 60) { e.state = 'open'; e.timer = 0; }
      break;
    case 'spawn': // it releases more cells
      if (e.timer === 20) {
        const n = L.ents.filter(o => o.alive && o.type === 'pa').length;
        for (let k = 0; k < (angry ? 3 : 2) && n + k < 8; k++) spawnEnemy('pa', e.bx + (k - 1) * 40, e.by - 100);
      }
      if (e.timer > 50) { e.state = 'open'; e.timer = 0; }
      break;
    case 'open': // the alginate shell thins: its weak spot is exposed
      e.open = Math.min(1, e.open + 0.08);
      if (e.timer > (angry ? 110 : 150)) { e.state = 'close'; e.timer = 0; }
      break;
    case 'close':
      e.open = Math.max(0, e.open - 0.08);
      if (e.open === 0) { e.state = angry ? 'slam' : 'walk'; e.timer = 0; e.vy = angry ? -11 : 0; }
      break;
    case 'slam': // jumps and crashes down
      e.vy += 0.5; e.jy += e.vy;
      e.bx = clamp(e.bx + Math.sign(pcx - e.bx) * 2.2, lo, hi);
      if (e.jy >= 0) {
        e.jy = 0; e.vy = 0; G.shake = 14; AUDIO.play('stomp');
        for (let k = 0; k < 6; k++) bossGlob(e, Math.cos(Math.PI + k * Math.PI / 5) * 4, -5 - Math.random() * 2);
        e.state = 'walk'; e.timer = 0;
      }
      break;
  }
  const b = bossBox(e);
  if (overlap(P, b)) {
    if (P.vy > 0 && P.y + P.h - P.vy <= b.y + 14) {
      P.vy = JUMP_V * 0.85; P.sprung = false; P.squash = 0.32;
      if (e.open > 0.6) { damageBoss(e, 2); stompChain(); }
      else { AUDIO.play('boing'); once('shell', 'The alginate shell is too tough to stomp. Wait until it opens, or shoot it!'); }
    } else hurt('enemy', 'The mucoid colony crashed into you.');
  }
}

// ---- inhaled antibiotic waves (CF level): take cover under a floor ----------------
// A game metaphor: antibiotics are a key CF treatment; here you play a bacterium,
// so the mist is a hazard. Cells in the open die; the alginate-wrapped colony does not.
const COVER_ROWS = 10;   // a floor at most this many rows above you shelters you
function coveredAt(x, y) {
  const tx = Math.floor(x / TILE), top = Math.floor(y / TILE) - 1;
  for (let ty = top; ty >= Math.max(0, top - COVER_ROWS); ty--) if (isSolid(tileAt(tx, ty))) return true;
  return false;
}
const isCovered = () => coveredAt(P.x + P.w / 2, P.y);
function updateAntibiotic() {
  if (!L.def.theme.cough) return;
  L.covered = isCovered();
  if (L.abOn > 0) {
    L.abOn--;
    if (!L.covered && P.inv === 0 && L.abExpose >= 0 && ++L.abExpose > 40) {
      L.abExpose = -1;   // one hit per wave
      hurt('ab', 'The inhaled antibiotic reached you. Take cover under a floor!');
    }
    if (L.time % 20 === 0) for (const e of L.ents) {   // cells caught in the open die
      if (!e.alive || (e.type !== 'pa' && e.type !== 'twitch') || Math.random() > 0.25) continue;
      const ex = e.type === 'pa' ? e.cx : e.x + 16, ey = e.type === 'pa' ? e.cy : e.y + 16;
      if (!coveredAt(ex, ey)) { e.alive = false; burst(ex, ey, '#bff5ee', 12, 2.4); }
    }
    if (L.bossActive && !L.bossDown && L.abOn === 200) once('abboss', 'Its alginate shell shields the colony from the antibiotic: biofilms are hard to treat.');
    return;
  }
  if (L.abWarn > 0) {
    if (--L.abWarn === 0) { L.abOn = 240; L.abExpose = 0; AUDIO.play('mist'); }
    return;
  }
  if (--L.abNext <= 0) {
    if (L.coughing > 0 || L.coughWarn > 0) { L.abNext = 180; return; }   // never together with a cough
    L.abNext = 60 * (55 + Math.random() * 25);
    L.abWarn = 180; AUDIO.play('warn');
    toast('Inhaled antibiotic coming in 3 s: take cover under a floor!', 170);
  }
}

// ---- coughing (CF level): the airway shakes and more P. aeruginosa appear ---------
function updateCough() {
  if (!L.def.theme.cough) return;
  if (L.coughFlash > 0) L.coughFlash--;
  if (L.coughing > 0) {
    L.coughing--;
    const k = Math.sin((1 - L.coughing / 100) * Math.PI);
    G.shake = Math.max(G.shake, 4 + 10 * k);
    // Crouch to brace on a floor; hold jump in the air to ride the updraft.
    if (P.onGround && keys.down) P.vx *= 0.8;
    else if (!P.onGround) P.vy -= (keys.jump ? 0.5 : 0.2) * k;
    return;
  }
  if (L.coughWarn > 0) L.coughWarn--;
  if (L.abWarn > 0 || L.abOn > 0) return;   // no cough during an antibiotic wave
  if (--L.coughNext === 75) { L.coughWarn = 75; AUDIO.play('warn'); }
  if (L.coughNext <= 0) {
    L.coughNext = 60 * (24 + Math.random() * 22);   // next cough in 24-46 s
    L.coughing = 100; L.coughFlash = 45;
    AUDIO.play('cough');
    const alive = L.ents.filter(e => e.alive && e.type === 'pa').length + L.spawnQ.length;
    for (let i = 0, made = 0; i < 12 && made < Math.min(3, 12 - alive); i++) {
      const x = clamp(P.x + (Math.random() < 0.5 ? -1 : 1) * (180 + Math.random() * 200), 2 * TILE, (L.cols - 2) * TILE);
      const y = clamp(P.y - 40 - Math.random() * 160, TILE, (L.rows - 2) * TILE);
      if (!isSolid(tileAt(Math.floor(x / TILE), Math.floor(y / TILE)))) { spawnEnemy('pa', x, y); made++; }
    }
    toast('Updraft! Hold jump to ride the air; hold ↓ on a floor to brace.', 160);
  }
}

// ---- level goals -------------------------------------------------------------------
function goalStatus(g) {
  switch (g.id) {
    case 'sample': {
      const goal = L.ents.find(e => e.type === 'goal');
      return { done: !!goal && overlap(P, { x: goal.x, y: goal.y - TILE, w: TILE * 2, h: TILE * 2 }), text: g.label };
    }
    case 'cys': return { done: L.cystine >= g.n, text: `${g.label} (${Math.min(L.cystine, g.n)}/${g.n})` };
    case 'pep': return { done: L.peptides >= L.totalPep, text: `${g.label} (${L.peptides}/${L.totalPep})` };
    case 'reps': return { done: P.reps === 3 && L.retries === 0, text: g.label };
    case 'kills': return { done: L.kills >= g.n, text: `${g.label} (${Math.min(L.kills, g.n)}/${g.n})` };
    case 'boss': return { done: L.bossDown, text: g.label };
    case 'time': return { done: true, text: L.difficulty === 0 ? 'Reach the MS (study: no deadline)' : g.label };
    default: return { done: true, text: g.label };
  }
}
const missingGoals = () => L.def.goals.filter(g => g.req && !goalStatus(g).done);

// ---- lysed cells: collapse shortly after you land on them -------------------------
function touchLysis() {
  if (!P.onGround || P.ride) return;
  const ty = Math.floor((P.y + P.h + 1) / TILE);
  for (let tx = Math.floor(P.x / TILE); tx <= Math.floor((P.x + P.w - 1) / TILE); tx++) {
    if (tileAt(tx, ty) !== '%' || L.lysis.has(ty * L.cols + tx)) continue;
    // the whole strip of lysed cells starts to give way
    let a = tx, b = tx;
    while (a > 0 && L.grid[ty][a - 1] === '%') a--;
    while (b < L.cols - 1 && L.grid[ty][b + 1] === '%') b++;
    for (let x = a; x <= b; x++) if (!L.lysis.has(ty * L.cols + x)) L.lysis.set(ty * L.cols + x, { t: 0, down: 0 });
  }
}
function updateLysis() {
  let cracked = false;
  for (const [k, s] of L.lysis) {
    if (s.down > 0) { if (--s.down === 0) L.lysis.delete(k); continue; }
    if (++s.t >= LYSIS_DELAY) {
      s.down = LYSIS_DOWN; cracked = true;
      const tx = k % L.cols, ty = (k - tx) / L.cols;
      burst(tx * TILE + 16, ty * TILE + 6, '#efe4bf', 6, 2.2);
    }
  }
  if (cracked) { AUDIO.play('crack'); G.shake = Math.max(G.shake, 3); }
}

// Air bubbles rise from vents and carry you up.
function updateMovers() {
  for (const e of L.ents) {
    if (e.type !== 'vent') continue;
    if (Math.abs(e.x - P.x) < VIEW_W && Math.abs(e.y - P.y) < VIEW_H * 1.3 && --e.cool <= 0) {
      e.cool = 170;
      // starts just below the floor surface, so it scoops up a cell standing on the vent
      L.movers.push({ x: e.x + 16, y: e.y + TILE + 19, r: 17, t: 0, dx: 0, dy: 0, topY: (e.ty - e.rise) * TILE + 16, alive: true });
    }
  }
  for (const b of L.movers) {
    b.t++;
    b.dy = b.t < 12 ? -0.4 : -1.3;
    b.y += b.dy;
    b.top = b.y - b.r + 4; b.pl = b.x - b.r; b.pr = b.x + b.r;
    const roof = isSolid(tileAt(Math.floor(b.x / TILE), Math.floor((b.y - b.r - 34) / TILE)));
    if (b.y <= b.topY || roof) {
      b.alive = false;
      burst(b.x, b.y, 'rgba(255,255,255,0.9)', 10, 2.4, 0.02, 24);
      AUDIO.play('pop');
    }
  }
  L.movers = L.movers.filter(b => b.alive);
}

// ---- particles and score pop-ups (decoration) -------------------------------------
function burst(x, y, color, n = 10, speed = 3, grav = 0.08, life = 32) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, s = speed * (0.35 + Math.random() * 0.8);
    L.fx.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (grav > 0 ? 1 : 0), grav, life, max: life, color, r: 1.5 + Math.random() * 2.5 });
  }
}
function updateFx() {
  for (const p of L.fx) { p.x += p.vx; p.y += p.vy; p.vy += p.grav; if (p.grav) p.vx *= 0.95; if (p.vr) p.rot += p.vr; p.life--; }
  for (const [k, v] of L.bumps) { if (v <= 1) L.bumps.delete(k); else L.bumps.set(k, v - 1); }
  if (L.fx.length) L.fx = L.fx.filter(p => p.life > 0);
  for (const p of L.pops) { p.y -= 0.7; p.life--; }
  if (L.pops.length) L.pops = L.pops.filter(p => p.life > 0);
  for (const c of L.callouts) { c.life--; c.y -= c.life > 64 ? 1.6 : 0.2; }
  if (L.callouts.length) L.callouts = L.callouts.filter(c => c.life > 0);
  if (L.bannerT > 0) L.bannerT--;
  for (const k of L.killFeed) { k.life--; k.age++; if (k.bump > 0) k.bump--; }
  if (L.killFeed.length) L.killFeed = L.killFeed.filter(k => k.life > 0);
}
// Points with a combo: pick things up quickly one after another for up to x5.
function gain(base, x, y, color) {
  L.combo = L.comboT > 0 ? L.combo + 1 : 1;
  L.comboT = 100;
  const m = Math.min(L.combo, 5), pts = base * m;
  L.points += pts;
  L.pops.push({ x, y: y - 8, text: m > 1 ? `+${pts} x${m}` : `+${pts}`, color, life: 50 });
  P.happy = Math.max(P.happy || 0, 30);
  return m;
}

// ---- damage ----------------------------------------------------------------------
// The explaining message appears the first time per kind of damage; after that the
// label above the cell ("ROS HIT") is enough.
function loseReplicate(msg, quiet = false) {
  if (L.difficulty === 0) { if (!quiet) toast('Study run: replicates protected. ' + msg); return; }
  P.reps--; P.repFlash = 50; G.deaths++;
  if (!quiet || P.reps <= 0) toast(P.reps > 0 ? `${msg}  Replicates left: ${P.reps}/${L.maxReps}` : msg, 170);
  if (P.reps <= 0) {
    if (G.mode === 'log') finishLogPhase(false);
    else startLysis();
  }
}
// n = 0: the cell bursts, the world slows for a moment, then the part restarts by
// itself (no panel to click through). R restores the last stock instead.
function startLysis() {
  G.lysisT = 0;
  const cx = P.x + P.w / 2, cy = P.y + P.h / 2;
  burst(cx, cy, '#f3c22f', 34, 5, 0.12, 50); burst(cx, cy, '#fff5c4', 18, 3, 0.05, 40);
  ring(cx, cy, 8, 90, '#ffe27a', 30, 4); ring(cx, cy, 4, 50, '#ffffff', 20, 2);
  G.shake = 14; AUDIO.play('lysis'); AUDIO.play('fail');
  setState('lysis');
}
function finishLysis() {
  G.failReason = '';
  if (G.mode === 'daily') { endAttempt('lost'); startDaily(false); return; }
  if (L.stage > 0) { restartPart(); return; }
  endAttempt('lost');
  const keep = L.attempts;
  loadLevel(G.levelIdx, { keepDeaths: true });
  L.attempts = keep;
  setState('play');
  toast('n = 0 · restarted. Protect your replicates!', 140);
}
function hurt(kind, msg) {
  if (P.inv > 0) return;
  if (L.difficulty === 0) {
    P.inv = 180; P.damageT = 75; P.damageLabel = 'STUDY · PROTECTED';
    return;
  }
  if (kind === 'ros' && P.gold > 0) {   // staphyloxanthin: an antioxidant pigment
    burst(P.x + P.w / 2, P.y + P.h / 2, '#ffd84a', 8, 2.4);
    L.points += 20;
    return;
  }
  if (kind === 'ros' && P.shield > 0) {
    P.shield = 0; P.inv = 40;
    burst(P.x + P.w / 2, P.y + P.h / 2, '#7fb6ff', 14, 3);
    AUDIO.play('pop');
    toast('AhpC absorbed the ROS. Shield used up.');
    return;
  }
  P.inv = L.difficulty > 100 ? 45 : 90 + Math.round(180 * (1 - L.difficulty / 100)); P.vy = -6; P.vx = -P.face * 3; P.dizzy = 80; P.damageT = 75;
  P.damageLabel = ({ ros: 'ROS HIT', hcn: 'HCN HIT', foam: 'MEMBRANE HIT', enemy: 'CELL WALL HIT', front: 'MEDIUM DEPLETED', ab: 'ANTIBIOTIC HIT' })[kind] || 'REPLICATE LOST';
  burst(P.x + P.w / 2, P.y + P.h / 2, '#e0465a', 12, 3);
  ring(P.x + P.w / 2, P.y + P.h / 2, 6, 34, '#ff6b7a', 14, 2.5);
  G.shake = 10; AUDIO.play('hurt');
  const quiet = !!G.seen['hurt:' + kind + msg];
  G.seen['hurt:' + kind + msg] = true;
  loseReplicate(msg, quiet);
}
function respawn() {
  P.x = L.respawn.x; P.y = L.respawn.y; P.vx = 0; P.vy = 0; P.inv = 60; P.slow = 0; P.ride = null;
  snapCamera();
}

// ---- the main play update --------------------------------------------------------
function updatePlay() {
  const S = STRAINS[G.strain], M = L.mods;
  const dj = M.grounded ? 0 : S.doubleJump;   // the daily "Grounded" rule
  L.time++;
  if (M.magnet) P.magnet = Math.max(P.magnet, 2);
  if (took('retry')) { retryCheckpoint(); return; }
  if (P.dashCool > 0) P.dashCool--;
  if (P.shootFlash > 0) P.shootFlash--;
  if (took('dash')) startDash();

  if (L.timeLimit && L.time / 60 > L.timeLimit) {
    toast('The 15-min pulse ended before your sample reached the MS.');
    setState('gameOver');
    AUDIO.play('fail');
    G.failReason = 'pulse';
    return;
  }

  updateMovers();
  updateLysis();
  updateCough();
  updateAntibiotic();
  L.solids = [];
  L.plats = L.movers;
  // Ride along with the platform you stand on.
  if (P.ride) {
    if (P.ride.alive === false) P.ride = null;
    else {
      P.y += P.ride.dy;
      if (P.ride.dx) { const v = P.vx; P.vx = P.ride.dx; moveX(); P.vx = v; }
    }
  }

  // Run. HQNO ("slow") and sticky mucus lower top speed and jump power.
  const slowF = (P.slow > 0 ? 0.55 : 1) * (P.sticky ? 0.45 : 1);
  const jumpF = (P.slow > 0 ? 0.85 : 1) * (P.sticky ? 0.8 : 1);
  const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  if (dir) { P.vx += dir * RUN_ACC; P.face = dir; } else P.vx *= FRICTION;
  P.vx = clamp(P.vx, -RUN_MAX * M.run * slowF, RUN_MAX * M.run * slowF);
  if (P.dash > 0) { P.vx = P.face * 9 * slowF; P.dash--; }
  if (Math.abs(P.vx) < 0.05) P.vx = 0;

  // Jump, with coyote time and a small input buffer so it feels fair.
  if (took('jump')) P.buffer = BUFFER + Math.round(6 * Math.max(0, 1 - L.difficulty / 100)); else if (P.buffer > 0) P.buffer--;
  if (P.onGround) {
    P.coyote = COYOTE + Math.round(12 * Math.max(0, 1 - L.difficulty / 100)); P.groundT++; P.glide = 60;
    if (dj > 0 && P.groundT >= S.recharge) P.djReady = true;
    P.chain = 0;   // a stomp chain ends when you land
  } else { P.coyote--; P.groundT = 0; }

  if (P.buffer > 0) {
    if (P.coyote > 0) {
      P.vy = JUMP_V * jumpF;
      P.coyote = 0; P.buffer = 0; P.squash = -0.22; P.ride = null;
      AUDIO.play('jump');
    } else if (dj > 0 && P.djReady) {
      P.vy = JUMP_V * dj * jumpF; P.sprung = false;
      P.djReady = false; P.buffer = 0; P.phos = 30; P.squash = -0.18;   // little "P" badge = phosphorylated
      P.spin = 18;   // a quick roll in the air
      burst(P.x + P.w / 2, P.y + P.h, '#b98ae6', 8, 2, 0.05, 22);
      ring(P.x + P.w / 2, P.y + P.h, 4, 26, '#d7b8f5', 14, 2);
      AUDIO.play('dj');
    } else if (dj === 0 && !P.onGround) {
      tagOnce('nodj', M.grounded ? 'GROUNDED TODAY · NO DOUBLE JUMP' : 'NO DOUBLE JUMP · C = GROUND DASH', '#ffcf70');
    }
  }
  if (!keys.jump && !P.sprung && P.vy < -3.5) P.vy = -3.5;   // let go early = lower jump (not after a bounce)
  P.vy = Math.min(P.vy + GRAV * M.grav, MAX_FALL);
  if (G.strain === 'stp' && !M.grounded && keys.jump && P.vy > 0 && P.glide > 0) { P.vy = Math.min(P.vy, 2.4); P.glide--; }
  if (P.vy >= 0) P.sprung = false;

  // Shoot PSMs.
  if (P.shootCool > 0) P.shootCool--;
  if (took('shoot')) {
    if (P.ammo > 0 && P.shootCool === 0) { shoot(); P.shootFlash = 10; }
    else if (P.ammo === 0) tagOnce('noammo', 'NO PSMs · BUMP A RIBOSOME BLOCK', '#f3b6e2');
  }

  // Cilia beat and carry you along.
  if (P.belt && P.onGround && !(L.coughing > 0 && keys.down)) { const v = P.vx; P.vx = P.belt; moveX(); P.vx = v; }

  const wasGround = P.onGround, fallV = P.vy;
  moveX();
  moveY();
  if (P.onGround && !wasGround && fallV > 4) {
    P.squash = Math.min(0.3, fallV / 32);
    burst(P.x + P.w / 2, P.y + P.h, rgba(L.def.theme.eps, 0.9), 6, 1.6, -0.02, 26);
    if (fallV > 9) {   // a hard landing: a ring of dust and a thud
      ring(P.x + P.w / 2, P.y + P.h, 6, 40, rgba(L.def.theme.eps, 0.9), 16, 3);
      G.shake = Math.max(G.shake, 2.5); AUDIO.play('land');
    }
    // mucus jiggles where you land
    const ty = Math.floor((P.y + P.h + 1) / TILE), tx = Math.floor((P.x + P.w / 2) / TILE);
    for (let x = tx - 2; x <= tx + 2; x++) if (tileAt(x, ty) === '~') L.jiggle.set(ty * L.cols + x, Math.min(6, fallV * 0.6) * (1 - Math.abs(x - tx) * 0.25));
  }
  if (wasGround && !P.onGround && fallV >= 0 && !P.sprung) {   // slid off a ledge: a puff of dust
    burst(P.x + P.w / 2 - P.face * 10, P.y + P.h, rgba(L.def.theme.eps, 0.85), 5, 1.2, 0.02, 22);
  }
  P.squash *= 0.82;
  P.roll += P.vx / 14;                                // the cell rolls as it moves
  if (P.onGround && Math.abs(P.vx) > 2.8 && L.time % 7 === 0) {
    burst(P.x + P.w / 2 - P.face * 8, P.y + P.h - 2, rgba(L.def.theme.eps, 0.8), 1, 0.6, -0.03, 20);
  }
  touchLysis();
  // What are you standing on? Mucus is sticky, cilia push.
  P.sticky = 0; P.belt = 0;
  if (P.onGround && !P.ride) {
    const c = tileAt(Math.floor((P.x + P.w / 2) / TILE), Math.floor((P.y + P.h + 1) / TILE));
    if (c === '~') { P.sticky = 1; tagOnce('mucus', 'STICKY MUCUS · SLOW, LOW JUMPS', '#eef0a0'); }
    else if (c === '<') P.belt = -1.5;
    else if (c === '>') P.belt = 1.5;
    if (P.belt) tagOnce('belt', L.def.theme.bg === 'cf' ? 'CILIA CARRY YOU · RUN OR JUMP OFF' : 'FLOW CHANNEL · RUN OR JUMP OFF', '#cfe8ff');
  }

  for (const t of ['inv', 'slow', 'shield', 'magnet', 'phos', 'gold', 'repFlash', 'dizzy', 'damageT']) if (P[t] > 0) P[t]--;

  if (inFoam()) hurt('foam', 'Rhamnolipid foam damaged your membrane.');
  if (G.state !== 'play') return;
  if (P.y > L.rows * TILE + 64) {
    P.inv = 0;
    G.shake = 8; AUDIO.play('hurt');
    loseReplicate('You fell out of the culture.', !!G.seen.fell);
    G.seen.fell = true;
    if (G.state !== 'play') return;
    endAttempt('lost');
    respawn();
    newAttempt();
  }

  recordRun();
  updateEntities();
  if (G.state !== 'play') return;
  if (L.def.endless) { updateLogPhase(); if (G.state !== 'play') return; }
  updateShots();
  updateFx();
  updateLabels();
  updateFlyers();
  updateGaze();
  updateSigns();
  if (P.scared && nearFoamTile()) meet('foam');
  updateLook();
  followCamera();
  pressed.down = false; pressed.up = false;
  // tunnels: darker around a light on your cell, muffled music
  const inCave = L.bg && (L.bg[Math.floor((P.y + P.h / 2) / TILE)] || [])[Math.floor((P.x + P.w / 2) / TILE)] === 'c';
  L.caveK += ((inCave ? 1 : 0) - L.caveK) * 0.08;
  AUDIO.muffle(inCave);
  // music gets busier when enemies are close
  if (L.time % 15 === 0) {
    const near = L.ents.some(e => e.alive && (ENEMIES.has(e.type) || e.type === 'boss') && dist(e.cx ?? e.bx ?? e.x + 16, e.cy ?? (e.by ? e.by - 30 : e.y + 16), P.x + P.w / 2, P.y + P.h / 2) < 320);
    AUDIO.intensity(near ? 1 : 0);
    // a chime when a goal is ticked off
    for (const g of L.def.goals) {
      if (L.goalSeen[g.id] || !goalStatus(g).done) continue;
      L.goalSeen[g.id] = true;
      AUDIO.play('goal'); toast(`✓ Goal done: ${g.label}`, 150);
      burst(P.x + P.w / 2, P.y - 10, '#9be89f', 16, 2.6, -0.02, 34);
    }
  }
  for (const [k, a] of L.jiggle) { if (a < 0.2) L.jiggle.delete(k); else L.jiggle.set(k, a * 0.92); }
  if (G.toastT > 0) G.toastT--;
  if (L.goalMsgT > 0) L.goalMsgT--;
  if (L.comboT > 0) L.comboT--;
  G.shake = G.shake > 0.5 ? G.shake * 0.85 : 0;
}

function updateEntities() {
  const pcx = P.x + P.w / 2, pcy = P.y + P.h / 2;
  const front = L.def.name === 'SNpulse' ? exposureFrontY() : Infinity;
  const spawned = [];
  for (const e of L.ents) {
    if (G.state !== 'play') break;   // level ended (finished or n = 0) during this loop
    if (!e.alive) continue;
    e.t++;
    e.exposed = e.y > front;
    if (e.pop > 0) { e.y -= 2; e.pop -= 2; }     // a protein coming out of a ribosome block...
    else if (e.fromRibo) {                         // ...then it slides off and drops to the floor
      const nx = e.x + e.vx, fy = Math.floor((e.y + 16) / TILE);
      if (enemySolid(tileAt(Math.floor((e.vx > 0 ? nx + 28 : nx + 4) / TILE), fy))) e.vx = -e.vx; else e.x = nx;
      e.vy = Math.min(e.vy + 0.3, 7);
      const prevB = e.y + TILE; e.y += e.vy;
      const R = Math.floor((e.y + TILE) / TILE), c = tileAt(Math.floor((e.x + 16) / TILE), R);
      if (e.vy > 0 && (enemySolid(c) || oneWay(c)) && prevB <= R * TILE + 1) { e.y = R * TILE - TILE; e.vy = 0; }
      if (e.y > L.rows * TILE) e.alive = false;
    }
    const cx = e.x + 16, cy = e.y + 16;
    switch (e.type) {
      case 'peptide':
        if (dist(cx, cy, pcx, pcy) < 24) {
          e.alive = false; L.peptides++;
          gain(300, cx, cy, '#9fe7ff');
          burst(cx, cy, '#9fe7ff', 18, 3); ring(cx, cy, 6, 44, '#9fe7ff', 20);
          flyToHud('score', cx, cy);
          AUDIO.play('peptide');
          tag(`PEPTIDE ${L.peptides}/${L.totalPep}`, cx, cy - 24, '#9fe7ff', 130);
          meet('peptide'); codexPeptide(e);
        }
        break;
      case 'psm':
        if (dist(cx, cy, pcx, pcy) < 26) {
          e.alive = false; P.ammo = Math.min(MAX_AMMO, P.ammo + 12);
          burst(cx, cy, '#e88ad0', 14, 3); AUDIO.play('power'); P.happy = 40;
          tag(G.seen.psm ? '+12 PSM' : '+12 PSM · X / K / SHIFT TO SHOOT', cx, cy - 24, '#f3b6e2', 170);
          G.seen.psm = true; meet('psm');
        }
        break;
      case 'xan':
        if (dist(cx, cy, pcx, pcy) < 26) {
          e.alive = false; P.gold = 60 * 12;
          burst(cx, cy, '#ffd84a', 18, 3.4); AUDIO.play('power'); P.happy = 40;
          tag('STAPHYLOXANTHIN · ROS-PROOF 12 s', cx, cy - 24, '#ffd84a', 160);
          meet('xan');
        }
        break;
      case 'secret':   // a golden cluster in a hidden room
        if (dist(cx, cy, pcx, pcy) < 28) {
          e.alive = false; L.points += 1000; L.secret = true; P.happy = 60;
          burst(cx, cy, '#ffe066', 30, 4); ring(cx, cy, 8, 80, '#ffe066', 28, 4); ring(cx, cy, 4, 50, '#ffffff', 20, 2);
          flyToHud('score', cx, cy);
          bigText('SECRET FOUND!', cx, cy - 30, '#ffe066', 90);
          AUDIO.play('secret'); G.shake = Math.max(G.shake, 4);
          meet('secret'); codexSecret();
        }
        break;
      case 'spring': // a swollen cell: land on it and it throws you up
        if (e.sq > 0) e.sq--;
        if (P.vy >= 0 && Math.abs(pcx - cx) < 20 && P.y + P.h >= e.y + 14 && P.y + P.h <= e.y + TILE + 0.5) {
          P.y = e.y + 14 - P.h; P.vy = SPRING_V; P.onGround = false; P.coyote = 0; P.ride = null; P.sprung = true;
          P.squash = -0.3; e.sq = 14;
          AUDIO.play('boing');
          tagOnce('spring', 'BOING!', '#ffe9c4');
        }
        break;
      case 'omv': { // outer membrane vesicle: bounces along
        e.vy = Math.min(e.vy + 0.35, 9);
        const nx = e.x + e.vx;
        if (enemySolid(tileAt(Math.floor((e.vx > 0 ? nx + 27 : nx + 5) / TILE), Math.floor((e.y + 16) / TILE)))) e.vx = -e.vx; else e.x = nx;
        const prevB = e.y + 27;
        e.y += e.vy;
        const col = Math.floor((e.x + 16) / TILE), R = Math.floor((e.y + 27) / TILE), c = tileAt(col, R);
        if (e.vy > 0 && (enemySolid(c) || oneWay(c)) && prevB <= R * TILE + 1) { e.y = R * TILE - 27; e.vy = -7.2; }
        if (e.vy < 0 && isSolid(tileAt(col, Math.floor((e.y + 5) / TILE)))) e.vy = 1;
        if (e.y > L.rows * TILE) e.alive = false;
        enemyContact(e, 'An outer membrane vesicle (OMV) of P. aeruginosa delivered its cargo into you.');
        break;
      }
      case 'boss': updateBoss(e, pcx); break;
      case 'glob': { // a pyocyanin glob spat by the boss
        e.vy = Math.min(e.vy + 0.3, 9); e.x += e.vx; e.y += e.vy;
        if (isSolid(tileAt(Math.floor((e.x + 16) / TILE), Math.floor((e.y + 20) / TILE))) || e.y > L.rows * TILE) {
          e.alive = false; burst(e.x + 16, e.y + 16, '#3d86d9', 6, 1.8, 0.1, 18); break;
        }
        if (overlap(P, { x: e.x + 9, y: e.y + 9, w: 14, h: 14 })) { e.alive = false; hurt('ros', 'Pyocyanin from the colony made ROS in your cell.'); }
        break;
      }
      case 'rosgun': { // pyocyanin redox launcher: fires superoxide radicals at you
        if (e.cool > 0) e.cool--;
        const dx = pcx - cx;
        e.face = dx >= 0 ? 1 : -1;
        if (e.cool === 0 && Math.abs(dx) > 40 && Math.abs(dx) < 620 && Math.abs(pcy - cy) < 150) {
          e.cool = e.exposed ? 115 : 170;
          spawnEnemy('rosb', cx + e.face * 20, cy - 4, { vx: e.face * 3.2 });
          burst(cx + e.face * 18, cy - 4, '#ffb36b', 8, 2, 0, 16);
          AUDIO.play('shoot');
          if (!G.seen.rosgun) { G.seen.rosgun = true; tag('SUPEROXIDE! JUMP, STOMP OR SHOOT', cx, cy - 30, '#ffb36b', 170); }
        }
        break;
      }
      case 'rosb': { // a superoxide radical flying straight ahead
        e.x += e.vx;
        if (enemySolid(tileAt(Math.floor((e.x + 16 + Math.sign(e.vx) * 14) / TILE), Math.floor((e.y + 16) / TILE))) || e.t > 420) {
          e.alive = false; burst(e.x + 16, e.y + 16, '#ff7a3c', 10, 2.2, 0.05, 20); break;
        }
        enemyContact(e, 'A superoxide radical (ROS) hit you.', 'ros');
        break;
      }
      case 'lasb': // LasB elastase: a protease that drifts in loops
        e.cx = e.hx + Math.sin(e.t * 0.022) * 90; e.cy = e.hy + Math.sin(e.t * 0.05) * 24;
        e.face = Math.cos(e.t * 0.022) >= 0 ? 1 : -1;
        enemyContact(e, 'LasB elastase, another P. aeruginosa protease, hit you.');
        break;
      case 'hcn': { // a vent that puffs hydrogen cyanide now and then
        const ph = e.t % 220;
        e.warn = ph > 110 && ph <= 140; e.active = ph > 140;
        if (e.warn && dist(cx, cy, pcx, pcy) < 260) meet('hcn');
        if (e.active && overlap(P, { x: e.x - 18, y: e.y - 60, w: 68, h: 92 })) hurt('hcn', 'HCN (hydrogen cyanide) blocked your respiration.');
        break;
      }
      case 'geyser': { // rhamnolipid foam that wells up in a column, with a bubbling warning first
        const s = foamGeyserState(e);
        e.warn = s.warn; e.active = s.height > 0;
        if (e.warn && dist(cx, cy, pcx, pcy) < 220) meet('foam');
        if (e.active && overlap(P, { x: e.x + 5, y: e.y + TILE - s.height, w: 22, h: s.height })) hurt('foam', 'A column of rhamnolipid foam damaged your membrane.');
        break;
      }
      case 'drift': { // a clump of rhamnolipid foam drifting along a fixed path
        const a = (e.t + e.phase) / e.per * TAU;
        e.cx = e.x + 16 + Math.sin(a) * e.dx * TILE; e.cy = e.y + 16 + Math.sin(a) * e.dy * TILE;
        if (overlap(P, { x: e.cx - 12, y: e.cy - 11, w: 24, h: 22 })) hurt('foam', 'Drifting rhamnolipid foam damaged your membrane.');
        break;
      }
      case 'pa': { // a living P. aeruginosa cell (CF level only): swims towards you
        const d = dist(pcx, pcy, e.cx, e.cy);
        let tx = e.hx + Math.sin(e.t * 0.02) * 50, ty = e.hy + Math.cos(e.t * 0.03) * 20;
        if (d < 260) { tx = pcx; ty = pcy; }
        const hd = dist(tx, ty, e.hx, e.hy);
        if (hd > 180) { tx = e.hx + (tx - e.hx) / hd * 180; ty = e.hy + (ty - e.hy) / hd * 180; }
        const dd = dist(tx, ty, e.cx, e.cy), sp = d < 260 ? 1.25 : 0.6;
        if (dd > 1) { e.cx += (tx - e.cx) / dd * sp; e.cy += (ty - e.cy) / dd * sp; e.ang = Math.atan2(ty - e.cy, tx - e.cx); }
        enemyContact(e, 'A P. aeruginosa cell attacked you.');
        break;
      }
      case 'twitch': { // P. aeruginosa crawling with its pili (CF level only): jerky moves
        if (e.t % 50 < 16) {
          const nx = e.x + e.dir * 2.6, front = e.dir > 0 ? nx + 30 : nx + 2;
          const ftx = Math.floor(front / TILE), fty = Math.floor((e.y + 31) / TILE);
          const ahead = tileAt(ftx, fty), below = tileAt(ftx, fty + 1);
          if (enemySolid(ahead) || ahead === '^' || !(enemySolid(below) || oneWay(below))) e.dir = -e.dir; else e.x = nx;
        }
        enemyContact(e, 'A twitching P. aeruginosa cell pulled itself into you.');
        break;
      }
      case 'cystine':
        if (P.magnet > 0 && dist(cx, cy, pcx, pcy) < 170) {
          const d = dist(cx, cy, pcx, pcy) || 1;
          e.x += (pcx - cx) / d * 5; e.y += (pcy - cy) / d * 5;
        }
        if (dist(cx, cy, pcx, pcy) < 24) {
          e.alive = false; L.cystine++;
          AUDIO.play('cys', gain(100, cx, cy, '#ffe36a'));
          burst(cx, cy, '#f5d33a', 12, 2.6);
          flyToHud('cys', cx, cy);
          meet('cystine');
        }
        break;
      case 'iron':
        if (dist(cx, cy, pcx, pcy) < 24) {
          e.alive = false; L.ironTotal++; L.ironBank++;
          AUDIO.play('iron', gain(50, cx, cy, '#ff9a62'));
          burst(cx, cy, '#e0743c', 12, 2.6);
          flyToHud('iron', cx, cy);
          meet('iron');
          if (L.ironBank >= 3) {
            L.ironBank = 0;
            if (P.reps < L.maxReps) { P.reps++; P.repFlash = 0; tag('3 Fe · +1 REPLICATE', pcx, pcy - 30, '#9be89f', 150); ring(pcx, pcy, 6, 50, '#9be89f', 22); }
            else { L.points += 300; tag('3 Fe · +300', pcx, pcy - 30, '#ffb27a', 120); }
          }
        }
        break;
      case 'ahpc':
        if (dist(cx, cy, pcx, pcy) < 26) {
          e.alive = false; P.shield = 60 * 20; burst(cx, cy, '#7fb6ff', 14, 3); AUDIO.play('power'); P.happy = 40;
          tag('AhpC SHIELD · BLOCKS ONE ROS HIT', cx, cy - 24, '#9cc6ff', 150); meet('ahpc');
        }
        break;
      case 'tcya':
        if (dist(cx, cy, pcx, pcy) < 26) {
          e.alive = false; P.magnet = 60 * 12; burst(cx, cy, '#f0c850', 14, 3); AUDIO.play('power'); P.happy = 40;
          tag('TcyA · CYSTINE MAGNET 12 s', cx, cy - 24, '#f0c850', 150); meet('tcya');
        }
        break;
      case 'check':
        if (e.on && e.fillT !== undefined && e.fillT < 30) e.fillT++;
        if (!e.on && Math.abs(cx - pcx) < 20 && Math.abs(cy - pcy) < 40) {
          for (const o of L.ents) if (o.type === 'check') o.on = false;
          e.on = true; e.fillT = 0; L.respawn = { x: e.x + 4, y: e.y + 4 };
          if (!e.saved) { e.saved = true; L.stocks++; }
          burst(cx, cy, '#bfe6ff', 14, 2.4, -0.03); ring(cx, cy, 6, 46, '#bfe6ff', 22);
          AUDIO.play('check');
          tag('STOCK SAVED', cx, cy - 34, '#bfe6ff', 110);
          captureCheckpoint();
        }
        break;
      case 'stage': // the gate to part 2: a checkpoint that moves the run on
        if (overlap(P, { x: e.x, y: e.y - TILE, w: TILE * 2, h: TILE * 2 })) {
          if (G.mode === 'daily') { finishLevel(); return; }   // a daily challenge is one part only
          enterStage(L.stage + 1); return;
        }
        break;
      case 'goal': {
        const box = { x: e.x, y: e.y - TILE, w: TILE * 2, h: TILE * 2 };
        if (overlap(P, box)) {
          const miss = missingGoals();
          if (!miss.length) finishLevel();
          else if (L.goalMsgT === 0) {
            toast(`${L.def.goalKind === 'sputum' ? 'The sample' : 'The MS'} is not ready yet. Still to do: ${miss.map(g => goalStatus(g).text).join(' · ')}`, 220);
            L.goalMsgT = 180;
          }
        }
        break;
      }
      case 'dripper':
        // Wait until the player is near, then drop pyocyanin every ~1.6 s.
        if (Math.abs(cx - pcx) < VIEW_W * 0.7 && Math.abs(cy - pcy) < VIEW_H && e.t % (e.exposed ? 60 : 80) === 0) {
          spawned.push({ type: 'drop', x: e.x + 12, y: e.y + 26, vy: 0, alive: true, t: 0 });
          meet('drop');
        }
        break;
      case 'drop': {
        e.vy = Math.min(e.vy + 0.25, 8); e.y += e.vy;
        if (tileAt(Math.floor((e.x + 4) / TILE), Math.floor((e.y + 8) / TILE)) !== ' ' || e.y > L.rows * TILE ||
            L.solids.some(r => overlap({ x: e.x, y: e.y, w: 8, h: 10 }, r))) {
          e.alive = false;
          burst(e.x + 4, e.y + 6, '#3d86d9', 5, 1.5, 0.1, 18);
          break;
        }
        if (overlap(P, { x: e.x, y: e.y, w: 8, h: 10 })) {
          e.alive = false;
          hurt('ros', 'Pyocyanin made ROS in your cell.');
        }
        break;
      }
      case 'hqno': {
        e.cx = cx + Math.sin(e.t * 0.02) * 70; e.cy = cy + Math.sin(e.t * 0.031) * 22;
        if (dist(e.cx, e.cy, pcx, pcy) < 46) {
          if (P.slow === 0) { tagOnce('hqno', 'HQNO · SLOWER, WEAKER JUMPS', '#c9e59a'); meet('hqno'); }
          P.slow = 150;
        }
        break;
      }
      case 'lasa': {
        // Patrol; charge when the player is close on the same level. Turn at walls, ledges, foam.
        const ex = e.x + e.w / 2, ey = e.y + e.h / 2;
        e.angry = Math.abs(pcy - ey) < 30 && Math.abs(pcx - ex) < 190 && P.inv === 0;
        // it winds up for a moment before it charges (a fair warning)
        if (e.angry && !e.wasAngry) e.windup = 14;
        e.wasAngry = e.angry;
        if (e.windup > 0) {
          e.windup--;
          e.vx = (Math.sign(pcx - ex) || 1) * 0.01;
          enemyContact(e, 'LasA protease cut into your cell wall.');
          break;
        }
        e.vx = e.angry ? (Math.sign(pcx - ex) || 1) * 2.7 : Math.sign(e.vx) * 1.3;
        const nx = e.x + e.vx;
        const front = e.vx < 0 ? nx : nx + e.w;
        const ftx = Math.floor(front / TILE), fty = Math.floor((e.y + e.h - 1) / TILE);
        const ahead = tileAt(ftx, fty), below = tileAt(ftx, fty + 1);
        if (enemySolid(ahead) || ahead === '^' || !(enemySolid(below) || oneWay(below))) e.vx = -e.vx; else e.x = nx;
        enemyContact(e, 'LasA protease cut into your cell wall.');
        break;
      }
      case 'sidero': {
        if (e.cool > 0) e.cool--;
        // Wake up when the player is near, then hunt the nearest free iron.
        let target = null;
        if (Math.abs(e.hx - pcx) < 420 && Math.abs(e.hy - pcy) < 320) {
          let best = 360;
          for (const o of L.ents) if (o.alive && o.type === 'iron') {
            const d = dist(o.x + 16, o.y + 16, e.cx, e.cy);
            if (d < best) { best = d; target = o; }
          }
        }
        const tx = target ? target.x + 16 : e.hx + Math.sin(e.t * 0.03) * 30;
        const ty = target ? target.y + 16 : e.hy + Math.cos(e.t * 0.05) * 12;
        const d = dist(tx, ty, e.cx, e.cy) || 1;
        const sp = target ? 1.25 : 0.8;
        if (d > 1) { e.cx += (tx - e.cx) / d * Math.min(sp, d); e.cy += (ty - e.cy) / d * Math.min(sp, d); }
        if (target && dist(target.x + 16, target.y + 16, e.cx, e.cy) < 14) {
          target.alive = false;
          burst(e.cx, e.cy, '#c8e85a', 10, 2);
          if (!G.seen.sidero) { G.seen.sidero = true; tag('IRON GRABBED · COMPETITION FOR Fe', e.cx, e.cy - 26, '#c8e85a', 160); }
        }
        if (e.cool === 0 && dist(e.cx, e.cy, pcx, pcy) < 26) {
          e.cool = 120;
          if (L.ironBank > 0) { L.ironBank--; toast('A siderophore pulled iron out of your store.', 140); }
          e.cx += (e.cx - pcx) * 1.5; e.cy -= 20;
        }
        break;
      }
    }
  }
  if (spawned.length) L.ents.push(...spawned);
  if (L.spawnQ.length) { L.ents.push(...L.spawnQ); L.spawnQ = []; }
  // Remove dead drops so the list does not grow forever.
  if (L.time % 120 === 0) L.ents = L.ents.filter(e => e.alive || !['drop', 'glob', 'rosb', 'pa'].includes(e.type));
}

function finishLevel() {
  endAttempt('clear');
  if (G.mode === 'daily') { finishDaily(); return; }
  if (G.mode === 'log') { finishLogPhase(true); return; }
  const timeBonus = L.timeLimit ? Math.max(0, Math.round((L.timeLimit - L.time / 60) * 20)) : 0;
  const repBonus = P.reps * 500;
  const total = L.points + timeBonus + repBonus;
  // Stars: one for finishing, one for each bonus goal of the level.
  const bonus = L.def.goals.filter(g => !g.req);
  const stars = [true, ...bonus.map(g => goalStatus(g).done)];
  const starLabels = [L.def.goalKind === 'sputum' ? 'sample delivered' : 'sample measured', ...bonus.map(g => g.short)];
  G.score += total;
  // medal time, and the best time for this level in this browser
  const secs = runSecs(), medal = medalFor(L.def, secs), times = loadTimes();
  const prevBest = times[runKey()], newBest = prevBest === undefined || secs < prevBest;
  const pbSplits = loadSplits()[runKey()] || [];
  if (newBest) { times[runKey()] = secs; saveTimes(times); saveGhost(); saveSplits(runKey(), L.splits); }
  G.times = times;
  G.results[G.levelIdx] = {
    name: L.def.name, points: L.points, timeBonus, repBonus, total, cystine: L.cystine, totalCys: L.totalCys, iron: L.ironTotal, reps: P.reps, secs, stars, starLabels,
    kills: L.kills, peptides: L.peptides, totalPep: L.totalPep, medal, best: Math.min(secs, prevBest ?? secs), newBest,
    deaths: G.deaths, splits: L.splits.slice(), pbSplits, secret: !!L.secret,
    rivalDelta: L.rival ? secs - L.rival.secs : undefined,
  };
  G.resultT = 0;
  AUDIO.play('done', G.levelIdx + 1);
  startReplay(() => { G.resultT = 0; setState('levelDone'); });
}

// ---- pause menu ------------------------------------------------------------------
// Each item is [label, action]. Daily and log-phase runs restart instead of retrying.
function menuEntries() {
  const entries = [['Resume', 'resume']];
  if (G.mode === 'daily') entries.push(['Restart daily challenge', 'retry']);
  else if (G.mode === 'log') entries.push(['New climb', 'retry']);
  else entries.push([L.difficulty === 0 ? 'Retry checkpoint (free)' : 'Retry checkpoint (+3 s)', 'retry'],
    [L.stage > 0 ? `Restart part ${L.stage + 1}` : 'Restart level', 'restart']);
  entries.push([`Sound effects: ${AUDIO.sfxOn ? 'on' : 'off'}`, 'sfx'], [`Music: ${AUDIO.musicOn ? 'on' : 'off'}`, 'music'],
    ['Codex', 'codex'], ['Main menu', 'menu']);
  return entries;
}
function menuItems() { return menuEntries().map(e => e[0]); }
function menuRects() { return menuItems().map((_, i) => ({ x: VIEW_W / 2 - 170, y: 156 + i * 40, w: 340, h: 35 })); }
function menuSelect() {
  AUDIO.play('click');
  switch (menuEntries()[G.menuIdx][1]) {
    case 'resume': setState('play'); break;
    case 'retry': retryCheckpoint(); break;
    case 'restart': if (L.stage > 0) restartPart(); else { loadLevel(G.levelIdx); setState('intro'); } break;
    case 'sfx': AUDIO.toggleSfx(); break;
    case 'music': AUDIO.toggleMusic(); break;
    case 'codex': openCodex('paused'); break;
    case 'menu': G.startLevel = Math.max(0, G.levelIdx); setState('title'); break;
  }
}

// ---- the title screen: strain cards, level chips and mode chips --------------------
// Slots 0-3 are the story levels, 4 the daily challenge and 5 the log phase.
function titleSlot() { return G.titleMode === 'daily' ? 4 : G.titleMode === 'log' ? 5 : G.startLevel; }
function setTitleSlot(slot) {
  slot = (slot + 6) % 6;
  if (slot < 4) { G.titleMode = 'story'; G.startLevel = slot; }
  else G.titleMode = slot === 4 ? 'daily' : 'log';
  if (G.titleMode === 'daily') G.strain = dailyChallenge(dayNumber()).strain;
}
function updateTitle() {
  const order = ['anc', 'stk', 'stp'], locked = G.titleMode === 'daily';
  if (!locked) {
    if (took('s1')) G.strain = 'anc';
    if (took('s2')) G.strain = 'stk';
    if (took('s3')) G.strain = 'stp';
    if (took('left')) { G.strain = order[(order.indexOf(G.strain) + 2) % 3]; AUDIO.play('move'); }
    if (took('right')) { G.strain = order[(order.indexOf(G.strain) + 1) % 3]; AUDIO.play('move'); }
  }
  if (took('up')) { setTitleSlot(titleSlot() - 1); AUDIO.play('move'); }
  if (took('down')) { setTitleSlot(titleSlot() + 1); AUDIO.play('move'); }
  if (took('biology')) { AUDIO.play('click'); openCodex('title'); return; }
  if (took('confirm')) { AUDIO.play('click'); startGame(); }
}

// ---- the state machine -----------------------------------------------------------
function update() {
  if (G.iris > 0) G.iris--;
  if (took('mute')) AUDIO.toggleSfx();
  if (took('music')) AUDIO.toggleMusic();
  if (took('ghost')) G.ghostOn = !G.ghostOn;
  if (took('photo')) saveMicrograph();
  switch (G.state) {
    case 'title': updateTitle(); break;
    case 'codex': updateCodex(); break;
    case 'intro':
      if (took('ok') || took('jump')) setState('play');
      break;
    case 'play':
      if (took('pause')) { G.menuIdx = 0; setState('paused'); AUDIO.play('click'); break; }
      if (L.difficulty < 100) {
        syncStudyStation();
        if (took('biology')) toggleStudyStation();
      }
      if (G.hitStop > 0) { G.hitStop--; break; }   // a tiny freeze on big hits
      if (L.difficulty !== 100) {
        G.studyTick += studyPace(L.difficulty);
        while (G.studyTick >= 1 && G.state === 'play') {
          G.studyTick -= 1;
          updatePlay();
          if (G.hitStop > 0) { G.studyTick = 0; break; }
        }
      } else updatePlay();
      if (L.difficulty < 100) syncStudyStation();
      break;
    case 'paused': {
      const n = menuItems().length;
      if (took('pause')) { setState('play'); break; }
      if (took('up')) { G.menuIdx = (G.menuIdx + n - 1) % n; AUDIO.play('move'); }
      if (took('down')) { G.menuIdx = (G.menuIdx + 1) % n; AUDIO.play('move'); }
      if (took('confirm')) menuSelect();
      break;
    }
    case 'lysis':   // n = 0: a short slow-motion burst, then the part restarts by itself
      G.lysisT++;
      if (G.lysisT % 2) updateFx();
      if (G.shake) G.shake *= 0.9;
      if (took('retry')) { retryCheckpoint(); break; }
      if (took('pause')) { G.startLevel = Math.max(0, G.levelIdx); setState('title'); break; }
      if (G.lysisT >= 70 || (G.lysisT > 16 && (took('ok') || took('jump')))) finishLysis();
      break;
    case 'replay': updateReplay(); break;
    case 'levelDone': {
      const r = G.results[G.levelIdx];
      updateResultBeats(r);
      handleShareKeys('level', r);
      if (took('ok') || took('jump')) {
        if (!resultsDone(r)) { G.resultT = resultTimeline(r).end; break; }   // first press: skip the animation
        if (G.levelIdx + 1 < LEVELS.length) { G.levelIdx++; loadLevel(G.levelIdx); setState('intro'); }
        else {
          if (G.score > G.best) { G.best = G.score; saveBest(G.best); G.newBest = true; } else G.newBest = false;
          setState('win');
        }
      }
      break;
    }
    case 'dailyDone':
    case 'logDone': {
      const r = G.state === 'dailyDone' ? G.dailyResult : G.logResult;
      G.resultT++;
      handleShareKeys(G.state === 'dailyDone' ? 'daily' : 'endless', r);
      if (took('retry')) { if (G.state === 'dailyDone') startDaily(false); else startLogPhase(false); break; }
      if ((took('ok') || took('jump')) && G.resultT > 20) setState('title');
      break;
    }
    case 'gameOver':
      if (took('retry')) { retryCheckpoint(); break; }
      if (took('pause')) { G.startLevel = Math.max(0, G.levelIdx); setState('title'); break; }
      if (took('ok') || took('jump')) {
        G.failReason = '';
        if (G.mode === 'daily') startDaily(false);
        else if (L.stage > 0) restartPart();   // failing in part 2 restarts part 2, not the map
        else { loadLevel(G.levelIdx); setState('intro'); }
      }
      break;
    case 'win':
      handleShareKeys('win');
      if (took('ok') || took('jump')) setState('title');
      break;
  }
}

// ---- level art, drawn once per level into off-screen canvases ---------------------
// Ground '#' is drawn as a biofilm of packed cocci in a matrix, '=' as a matrix
// strand. This is decoration only: it does not describe how the cultures were grown.
function buildLevelArt(b, th, seed) {
  const W = b.cols * TILE, H = b.rows * TILE;
  const rnd = mulberry32(seed * 7919 + 17);
  const at = (x, y) => b.grid[clamp(y, 0, b.rows - 1)][clamp(x, 0, b.cols - 1)];
  const S = (x, y) => y >= 0 && at(x, y) === '#';

  const tiles = terrainSurface(W, H);
  const g = tiles.getContext('2d');

  // 0) tunnels carved into the biofilm get a dark cave wall behind them
  if (b.bg) for (let y = 0; y < b.rows; y++) for (let x = 0; x < b.cols; x++) {
    if (b.bg[y][x] !== 'c') continue;
    g.fillStyle = rgba(th.matrix[1], 0.88); g.fillRect(x * TILE, y * TILE, TILE, TILE);
    for (let k = 0; k < 2; k++) {
      g.fillStyle = rgba(th.cells[k % th.cells.length], 0.13);
      g.beginPath(); g.arc(x * TILE + 4 + rnd() * 24, y * TILE + 4 + rnd() * 24, 5 + rnd() * 4, 0, TAU); g.fill();
    }
  }

  // 1) matrix body, darker with depth
  g.save();
  g.beginPath();
  for (let y = 0; y < b.rows; y++) for (let x = 0; x < b.cols; x++) if (S(x, y)) g.rect(x * TILE, y * TILE, TILE, TILE);
  const body = g.createLinearGradient(0, 0, 0, H);
  body.addColorStop(0, th.matrix[0]); body.addColorStop(1, th.matrix[1]);
  g.fillStyle = body; g.fill();
  g.clip();
  // 2) packed cocci ("staphylo" = bunch of grapes)
  for (let y = 0; y < b.rows; y++) for (let x = 0; x < b.cols; x++) {
    if (!S(x, y)) continue;
    let depth = 0;
    while (depth < 8 && S(x, y - depth - 1)) depth++;
    for (let k = 0; k < 4; k++) {
      const px = x * TILE + 3 + rnd() * 26, py = y * TILE + 3 + rnd() * 26, r = 5.5 + rnd() * 3.5;
      const col = th.cells[Math.floor(rnd() * th.cells.length)];
      const rg = g.createRadialGradient(px - r * 0.35, py - r * 0.4, r * 0.1, px, py, r);
      rg.addColorStop(0, mix(col, '#ffffff', 0.45)); rg.addColorStop(0.5, col); rg.addColorStop(1, mix(col, th.matrix[1], 0.65));
      g.fillStyle = rg; g.beginPath(); g.arc(px, py, r, 0, TAU); g.fill();
    }
    if (depth) { g.fillStyle = rgba(th.matrix[1], Math.min(0.68, depth * 0.12)); g.fillRect(x * TILE, y * TILE, TILE, TILE); }
  }
  g.restore();

  // 3) rims: a glossy gel surface on top, bumps of cells on the sides, shadow below
  for (let y = 0; y < b.rows; y++) for (let x = 0; x < b.cols; x++) {
    if (!S(x, y)) continue;
    const X = x * TILE, Y = y * TILE;
    if (!S(x, y + 1) && y < b.rows - 1) {
      g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(X, Y + 27, TILE, 5);
      const sh = g.createLinearGradient(0, Y + 32, 0, Y + 48);
      sh.addColorStop(0, 'rgba(0,0,0,0.18)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = sh; g.fillRect(X, Y + 32, TILE, 16);
      // gel dripping from overhangs
      if (rnd() < 0.4) {
        const dx = X + 6 + rnd() * 20, len = 4 + rnd() * 12;
        g.strokeStyle = rgba(th.eps, 0.65); g.lineWidth = 2.5; g.lineCap = 'round';
        g.beginPath(); g.moveTo(dx, Y + 29); g.lineTo(dx, Y + 30 + len); g.stroke();
        g.fillStyle = rgba(th.eps, 0.85); g.beginPath(); g.arc(dx, Y + 31 + len, 2.8, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(dx - 0.9, Y + 30 + len, 0.9, 0, TAU); g.fill();
      }
    }
    for (const side of [-1, 1]) {
      if (S(x + side, y)) continue;
      const ex = side < 0 ? X + 1 : X + TILE - 1;
      for (const oy of [8, 24]) {
        const col = th.cells[Math.floor(rnd() * th.cells.length)];
        g.fillStyle = mix(col, th.matrix[1], 0.35); g.beginPath(); g.arc(ex, Y + oy, 4 + rnd() * 1.5, 0, TAU); g.fill();
      }
    }
    if (!S(x, y - 1)) {
      g.fillStyle = rgba(th.eps, 0.9);
      g.beginPath(); g.roundRect(X - (S(x - 1, y) ? 0 : 2), Y - 1, TILE + (S(x - 1, y) ? 0 : 2) + (S(x + 1, y) ? 0 : 2), 7, 3); g.fill();
      for (const ox of [5, 16, 27]) {
        const r = 4 + rnd() * 2, col = th.cells[Math.floor(rnd() * th.cells.length)];
        const rg = g.createRadialGradient(X + ox - 1.5, Y + 1, 0.5, X + ox, Y + 3, r);
        rg.addColorStop(0, mix(col, '#ffffff', 0.6)); rg.addColorStop(1, col);
        g.fillStyle = rg; g.beginPath(); g.arc(X + ox + rnd() * 2 - 1, Y + 3, r, 0, TAU); g.fill();
      }
      g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(X + 2, Y + 0.5); g.lineTo(X + TILE - 2, Y + 0.5); g.stroke();
      g.strokeStyle = rgba(th.matrix[1], 0.8); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(X, Y + 7); g.lineTo(X + TILE, Y + 7); g.stroke();
      // small colonies budding on the surface
      if (rnd() < 0.2) {
        const ox = X + 6 + rnd() * 20, col = th.cells[Math.floor(rnd() * th.cells.length)];
        for (const [dx, dy, r] of [[-4, 0, 3.2], [4, 0, 3.2], [0, -3.5, 3.4]]) {
          const rg = g.createRadialGradient(ox + dx - 1, Y + dy - 2, 0.3, ox + dx, Y + dy - 1, r);
          rg.addColorStop(0, mix(col, '#ffffff', 0.65)); rg.addColorStop(1, col);
          g.fillStyle = rg; g.beginPath(); g.arc(ox + dx, Y + dy - 1, r, 0, TAU); g.fill();
        }
      }
    }
  }

  // 4) matrix strands ('=' platforms), drawn as a twisted double strand
  for (let y = 0; y < b.rows; y++) {
    for (let x = 0; x < b.cols; x++) {
      if (b.grid[y][x] !== '=' || (x > 0 && b.grid[y][x - 1] === '=')) continue;
      let x1 = x; while (x1 + 1 < b.cols && b.grid[y][x1 + 1] === '=') x1++;
      const X0 = x * TILE + 2, X1 = (x1 + 1) * TILE - 2, cy = y * TILE + 6, amp = 4;
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.beginPath(); g.roundRect(X0, cy + 3, X1 - X0, 7, 3); g.fill();
      g.strokeStyle = rgba(th.plat[1], 0.8); g.lineWidth = 2;
      for (let px = X0 + 3; px < X1 - 2; px += 6) {
        const s = Math.sin((px - X0) / 24 * TAU) * amp;
        g.beginPath(); g.moveTo(px, cy + s); g.lineTo(px, cy - s); g.stroke();
      }
      for (const [sign, col, w] of [[1, th.plat[0], 3.5], [-1, mix(th.plat[0], th.plat[1], 0.55), 3]]) {
        g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.beginPath();
        for (let px = X0; px <= X1; px += 2) {
          const yy = cy + sign * Math.sin((px - X0) / 24 * TAU) * amp;
          if (px === X0) g.moveTo(px, yy); else g.lineTo(px, yy);
        }
        g.stroke();
      }
      g.fillStyle = th.plat[0];
      for (const ex of [X0, X1]) { g.beginPath(); g.arc(ex, cy, 4, 0, TAU); g.fill(); }
      g.strokeStyle = rgba(th.eps, 0.95); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(X0, y * TILE + 0.5); g.lineTo(X1, y * TILE + 0.5); g.stroke();
    }
  }

  // Far background: soft clusters of cells, scrolled at 1/4 speed (parallax).
  const fw = Math.ceil(W * 0.25 + VIEW_W), fh = Math.ceil(H * 0.25 + VIEW_H);
  const far = document.createElement('canvas');
  far.width = fw; far.height = fh;
  const f = far.getContext('2d');
  const n = Math.round(fw * fh / 26000);
  for (let i = 0; i < n; i++) {
    const cx = rnd() * fw, cy = rnd() * fh, s = 0.6 + rnd() * 1.3, cells = 5 + Math.floor(rnd() * 7);
    f.globalAlpha = 0.07 + rnd() * 0.1;
    for (let k = 0; k < cells; k++) {
      const a = rnd() * TAU, d = rnd() * 22 * s, r = (9 + rnd() * 5) * s;
      f.fillStyle = th.far; f.beginPath(); f.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r, 0, TAU); f.fill();
    }
  }
  f.globalAlpha = 1;

  // Drifting molecules in the medium (TSB: sugars and amino acids; PASN: plus blue pyocyanin).
  const dots = Array.from({ length: 56 }, (_, i) => {
    const u = rnd();
    const kind = i < th.pyo ? 'pyo' : u < 0.45 ? 'hex' : 'dot';
    return { x: rnd() * (VIEW_W + 40), y: rnd() * (VIEW_H + 40), r: 2 + rnd() * 4, v: 0.08 + rnd() * 0.25, rot: rnd() * TAU, kind };
  });

  // Out-of-focus foreground cells.
  const fore = Array.from({ length: 12 }, () => ({
    x: rnd() * (VIEW_W + 300), y: rnd() * (VIEW_H + 300), r: 18 + rnd() * 46,
    a: 0.05 + rnd() * 0.08, v: 0.15 + rnd() * 0.3, col: rnd() < 0.6 ? th.far : '#ffffff',
  }));

  const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  sky.addColorStop(0, th.sky[0]); sky.addColorStop(1, th.sky[1]);
  // Middle layer (parallax 0.45): biofilm "mushroom" towers, or airway rings in the CF level.
  const mw = Math.ceil(W * 0.45 + VIEW_W), mh = Math.ceil(H * 0.45 + VIEW_H);
  const mid = document.createElement('canvas');
  mid.width = mw; mid.height = mh;
  const m = mid.getContext('2d');
  if (th.bg === 'cf') {
    for (let y = 60; y < mh; y += 150) {           // cartilage rings of the airway wall
      m.strokeStyle = rgba(th.far, 0.22); m.lineWidth = 26;
      m.beginPath(); m.ellipse(mw / 2, y, mw * 0.62, 40, 0, Math.PI * 0.05, Math.PI * 0.95); m.stroke();
      m.strokeStyle = 'rgba(255,255,255,0.12)'; m.lineWidth = 6;
      m.beginPath(); m.ellipse(mw / 2, y - 8, mw * 0.62, 40, 0, Math.PI * 0.1, Math.PI * 0.9); m.stroke();
    }
    for (let i = 0; i < 16; i++) {                  // small blood vessels
      m.strokeStyle = 'rgba(190,40,70,0.13)'; m.lineWidth = 1.5 + rnd() * 2;
      let x = rnd() * mw, y = rnd() * mh;
      m.beginPath(); m.moveTo(x, y);
      for (let k = 0; k < 12; k++) { x += (rnd() - 0.5) * 60; y += 30 + rnd() * 30; m.lineTo(x, y); }
      m.stroke();
    }
  } else {
    for (let gy = mh; gy > 0; gy -= 380) {          // towers at several heights
      for (let x = rnd() * 80; x < mw; x += 90 + rnd() * 140) {
        const h = 120 + rnd() * 200, sw = 16 + rnd() * 18, cr = 34 + rnd() * 34;
        m.fillStyle = rgba(th.far, 0.14 + rnd() * 0.08);
        m.beginPath(); m.moveTo(x - sw, gy); m.quadraticCurveTo(x - sw * 0.4, gy - h * 0.5, x - sw * 0.5, gy - h);
        m.lineTo(x + sw * 0.5, gy - h); m.quadraticCurveTo(x + sw * 0.4, gy - h * 0.5, x + sw, gy); m.closePath(); m.fill();
        for (let k = 0; k < 7; k++) {
          const a = Math.PI + rnd() * Math.PI, d = rnd() * cr;
          m.beginPath(); m.arc(x + Math.cos(a) * d, gy - h + Math.sin(a) * d * 0.6, cr * (0.35 + rnd() * 0.3), 0, TAU); m.fill();
        }
      }
    }
  }
  // Flowing particles (parallax 0.7) and big soft clouds (parallax 0.3).
  const stream = Array.from({ length: 34 }, () => ({ x: rnd() * (VIEW_W + 100), y: rnd() * (VIEW_H + 100), v: 0.6 + rnd() * 1.2, len: 10 + rnd() * 26, r: 1 + rnd() * 2.5 }));
  const blobs = Array.from({ length: 5 }, () => ({ x: rnd() * (VIEW_W + 400), y: rnd() * (VIEW_H + 400), r: 120 + rnd() * 160, v: 0.1 + rnd() * 0.2, ph: rnd() * TAU }));

  return { tiles, far, dots, fore, sky, mid, stream, blobs };
}

// Edge darkening, drawn once.
const VIGNETTE = (() => {
  const c = document.createElement('canvas');
  c.width = VIEW_W; c.height = VIEW_H;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.45, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.62);
  r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(1, 'rgba(0,0,0,0.3)');
  g.fillStyle = r; g.fillRect(0, 0, VIEW_W, VIEW_H);
  return c;
})();

// ---- drawing helpers ---------------------------------------------------------------
const FONT = 'system-ui, "Segoe UI", sans-serif';
function text(str, x, y, { size = 18, color = '#222', align = 'left', weight = '600', font = FONT } = {}) {
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.fillText(str, x, y);
}
function wrap(str, maxW, size = 14) {
  ctx.font = `600 ${size}px ${FONT}`;
  const words = str.split(' '), lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}
function roundRect(x, y, w, h, r, fill, stroke, lw = 2) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
function circle(x, y, r, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
function ball(x, y, r, light, mid, dark) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, light); g.addColorStop(0.5, mid); g.addColorStop(1, dark);
  circle(x, y, r, g);
}
function glow(x, y, r, col, a = 0.45) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0));
  circle(x, y, r, g);
}
function hexagon(x, y, r, rot) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) { const a = rot + i * TAU / 6; ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r); }
  ctx.closePath();
}
function star(x, y, R, filled) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? R * 0.45 : R; ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r); }
  ctx.closePath();
  ctx.fillStyle = filled ? '#f3c22f' : '#e6e0d2'; ctx.fill();
  ctx.strokeStyle = filled ? '#9a6a00' : '#bdb6a6'; ctx.lineWidth = 2.5; ctx.stroke();
}

// A golden coccus ("aureus" = golden) with a cell wall in the strain colour.
function drawCoccus(cx, cy, r, ring, o = {}) {
  const sq = o.squash || 0, f = o.face || 0;
  ctx.save();
  ctx.translate(cx, cy + r * sq);
  if (o.rot) ctx.rotate(o.rot);
  ctx.scale(1 + sq, 1 - sq);
  circle(0, 0, r + 3, 'rgba(255,255,244,0.85)');
  circle(0, 0, r + 1.5, '#243442');
  ball(0, 0, r, '#fff5c4', o.slow ? '#c9c35a' : '#f3c22f', o.slow ? '#7d8a2a' : '#c0860c');
  ctx.strokeStyle = ring; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
  const s = r / 14;
  // Fine internal structures make the cell feel translucent at high density.
  ctx.save(); ctx.rotate((o.roll || 0) * 0.15);
  ctx.strokeStyle = 'rgba(131,82,13,0.22)'; ctx.lineWidth = 1.2 * s;
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const x = (i / 15 * 16 - 8) * s, y = (Math.sin(i * 1.2) * 3 + 5) * s;
    if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke(); ctx.restore();
  // cell-wall dots that turn as the cell rolls
  for (let i = 0; i < 8; i++) {
    const a = (o.roll || 0) + i * TAU / 8;
    circle(Math.cos(a) * (r - 0.5), Math.sin(a) * (r - 0.5), 1.1 * s, 'rgba(255,255,255,0.6)');
  }
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.ellipse(-r * 0.4, -r * 0.5, r * 0.3, r * 0.16, -0.5, 0, TAU); ctx.fill();
  // Face. o.mood: '' | 'happy' | 'scared' | 'effort' | 'hurt'; o.look: [x, y] direction.
  const mood = o.mood || '', lx = o.look ? o.look[0] * 1.3 : 0, ly = o.look ? o.look[1] * 1.1 : 0;
  ctx.strokeStyle = '#1d2430'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const dx of [-4.5, 4.5]) {
    const ex = (dx + f * 2.5) * s, ey = -2 * s;
    if (mood === 'hurt') {   // x x
      ctx.lineWidth = 1.5 * s; ctx.beginPath();
      ctx.moveTo(ex - 2.2 * s, ey - 2.2 * s); ctx.lineTo(ex + 2.2 * s, ey + 2.2 * s);
      ctx.moveTo(ex + 2.2 * s, ey - 2.2 * s); ctx.lineTo(ex - 2.2 * s, ey + 2.2 * s); ctx.stroke();
    } else if (mood === 'happy') {   // ^ ^
      ctx.lineWidth = 1.7 * s; ctx.beginPath(); ctx.arc(ex, ey + 1.4 * s, 2.6 * s, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    } else if (mood === 'effort') {   // > <
      ctx.lineWidth = 1.6 * s; ctx.beginPath();
      const d = dx < 0 ? 1 : -1;
      ctx.moveTo(ex - 2.4 * s * d, ey - 2 * s); ctx.lineTo(ex + 1.6 * s * d, ey); ctx.lineTo(ex - 2.4 * s * d, ey + 2 * s); ctx.stroke();
    } else if (o.blink) {
      ctx.lineWidth = 1.6 * s;
      ctx.beginPath(); ctx.moveTo(ex - 2.6 * s, -1.6 * s); ctx.lineTo(ex + 2.6 * s, -1.6 * s); ctx.stroke();
    } else {
      const big = mood === 'scared' ? 4.4 : 3.6, pupil = mood === 'scared' ? 1.2 : 1.8;
      circle(ex, ey, big * s, '#ffffff');
      circle((dx + f * 3.6 + lx) * s, (-1.6 + ly) * s, pupil * s, '#1d2430');
      circle((dx + f * 3.6 + lx - 0.7) * s, (-2.4 + ly) * s, 0.6 * s, '#ffffff');
    }
  }
  circle((-7.5 + f * 2) * s, 4 * s, 2.4 * s, mood === 'happy' ? 'rgba(235,110,80,0.6)' : 'rgba(235,110,80,0.35)');
  circle((7.5 + f * 2) * s, 4 * s, 2.4 * s, mood === 'happy' ? 'rgba(235,110,80,0.6)' : 'rgba(235,110,80,0.35)');
  ctx.strokeStyle = '#7a4a08'; ctx.lineWidth = 1.4 * s;
  if (mood === 'happy') {   // a big open smile
    ctx.fillStyle = '#7a2e12'; ctx.beginPath(); ctx.arc(f * 2 * s, 3 * s, 3.6 * s, 0, Math.PI); ctx.closePath(); ctx.fill();
  } else if (mood === 'scared') {   // a small "o"
    ctx.beginPath(); ctx.arc(f * 2 * s, 5 * s, 1.8 * s, 0, TAU); ctx.stroke();
  } else if (mood === 'effort' || mood === 'hurt') {   // a wobbly, gritted mouth
    ctx.beginPath(); ctx.moveTo((f * 2 - 3.5) * s, 5 * s);
    for (let k = 1; k <= 4; k++) ctx.lineTo((f * 2 - 3.5 + k * 1.75) * s, (5 + (k % 2 ? -1 : 0.6)) * s);
    ctx.stroke();
  } else { ctx.beginPath(); ctx.arc(f * 2 * s, 3.5 * s, 3 * s, 0.2, Math.PI - 0.2); ctx.stroke(); }
  ctx.restore();
}
// A culture flask (one replicate): golden broth when alive, empty when lost.
function drawFlask(x, y, full, flash) {
  const path = () => {
    ctx.beginPath(); ctx.moveTo(x - 3, y - 11); ctx.lineTo(x - 3, y - 5); ctx.lineTo(x - 9, y + 8);
    ctx.quadraticCurveTo(x - 10, y + 11, x - 6, y + 11); ctx.lineTo(x + 6, y + 11);
    ctx.quadraticCurveTo(x + 10, y + 11, x + 9, y + 8); ctx.lineTo(x + 3, y - 5); ctx.lineTo(x + 3, y - 11); ctx.closePath();
  };
  if (flash) glow(x, y, 20, '#ff4040', Math.min(0.7, flash / 50));
  path(); ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill();
  if (full) {
    ctx.save(); path(); ctx.clip();
    const t = performance.now() / 400 + x;
    const g = ctx.createLinearGradient(0, y, 0, y + 11);
    g.addColorStop(0, '#ffe27a'); g.addColorStop(1, '#d99a12');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 12, y + 12);
    for (let k = -12; k <= 12; k += 3) ctx.lineTo(x + k, y + 1 + Math.sin(t + k * 0.5) * 1.2);
    ctx.lineTo(x + 12, y + 12); ctx.closePath(); ctx.fill();
    for (const [dx, dy] of [[-4, 7], [2, 5], [5, 8], [-1, 9]]) circle(x + dx, y + dy, 1.1, 'rgba(255,250,220,0.8)');
    ctx.restore();
  } else {
    ctx.strokeStyle = 'rgba(255,120,110,0.8)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x - 4, y + 3); ctx.lineTo(x, y + 6); ctx.lineTo(x - 2, y + 9); ctx.stroke();
  }
  path(); ctx.strokeStyle = full ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
  roundRect(x - 4, y - 15, 8, 5, 2, full ? '#f2efe6' : 'rgba(242,239,230,0.4)');   // cotton plug
}
function drawCystineIcon(x, y, s = 1, bob = 0) {
  ctx.strokeStyle = '#8a6d00'; ctx.lineWidth = 3 * s;
  ctx.beginPath(); ctx.moveTo(x - 7 * s, y + bob); ctx.lineTo(x + 7 * s, y + bob); ctx.stroke();
  for (const dx of [-8, 8]) ball(x + dx * s, y + bob, 7 * s, '#fff6b0', '#f2cc1d', '#b38a00');
  if (s >= 0.9) {
    text('S', x - 8 * s, y + 3.5 * s + bob, { size: 9 * s, color: '#5a4500', align: 'center', weight: '800' });
    text('S', x + 8 * s, y + 3.5 * s + bob, { size: 9 * s, color: '#5a4500', align: 'center', weight: '800' });
  }
}
function drawIronIcon(x, y, s = 1) {
  ball(x, y, 9 * s, '#ffc29a', '#c65a2c', '#7a2e12');
  if (s >= 0.9) text('Fe', x, y + 4 * s, { size: 10 * s, color: '#fff', align: 'center', weight: '800' });
}
// A hidden golden cluster: a game collectible, not a biological structure
// (the name Staphylococcus aureus refers to golden, grape-like clusters).
function drawSecret(x, y, t = 0) {
  glow(x, y, 36 + Math.sin(t * 0.1) * 4, '#ffe066', 0.55);
  for (const [dx, dy] of [[-9, -6], [0, -9], [9, -6], [-5, 2], [5, 2], [-11, 4], [11, 4], [0, 10]]) {
    ball(x + dx, y + dy + Math.sin(t * 0.08 + dx) * 0.8, 5.6, '#fffbe0', '#f3c22f', '#a87400');
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  for (let k = 0; k < 4; k++) {
    const a = t * 0.05 + k * TAU / 4, sx = x + Math.cos(a) * 20, sy = y + Math.sin(a) * 15, s = 2 + 1.5 * Math.sin(t * 0.2 + k);
    ctx.beginPath(); ctx.moveTo(sx - s, sy); ctx.lineTo(sx + s, sy); ctx.moveTo(sx, sy - s); ctx.lineTo(sx, sy + s); ctx.stroke();
  }
}
// ---- world drawing ---------------------------------------------------------------
function drawBackground(th, cx, cy) {
  ctx.fillStyle = L.art.sky; ctx.fillRect(-12, -12, VIEW_W + 24, VIEW_H + 24);
  // Light falling into the culture.
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  for (let i = 0; i < 4; i++) {
    const x = ((i * 310 - cx * 0.08) % 1240 + 1240) % 1240 - 160;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 70, 0); ctx.lineTo(x + 230, VIEW_H); ctx.lineTo(x + 120, VIEW_H); ctx.fill();
  }
  const t = L.time, bg = th.bg || 'tsb';
  // Big soft clouds: golden haze (TSB), blue pyocyanin swirls (PASN), breath (CF).
  const W2 = VIEW_W + 400, H2 = VIEW_H + 400;
  for (const b of L.art.blobs) {
    b.x += b.v;
    const x = ((b.x - cx * 0.3) % W2 + W2) % W2 - 200, y = ((b.y - cy * 0.3) % H2 + H2) % H2 - 200;
    glow(x, y + Math.sin(t * 0.01 + b.ph) * 20, b.r, bg === 'pasn' ? '#3d7fd6' : bg === 'cf' ? '#ff9fb0' : '#ffd36a', bg === 'pasn' ? 0.13 : 0.1);
  }
  ctx.drawImage(L.art.far, cx * 0.25, cy * 0.25, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);
  // Middle layer; in the CF level it moves with the breathing.
  if (bg === 'cf') {
    const s = 1 + 0.02 * Math.sin(t * 0.025);
    ctx.save(); ctx.translate(VIEW_W / 2, VIEW_H / 2); ctx.scale(s, s); ctx.translate(-VIEW_W / 2, -VIEW_H / 2);
    ctx.drawImage(L.art.mid, cx * 0.45, cy * 0.45, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);
    ctx.restore();
    ctx.fillStyle = `rgba(255,190,200,${0.04 * (1 + Math.sin(t * 0.025))})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  } else ctx.drawImage(L.art.mid, cx * 0.45, cy * 0.45, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);
  // Moving bands of light.
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = 'rgba(255,255,255,0.045)'; ctx.lineWidth = 34;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    for (let x = -24; x <= VIEW_W + 24; x += 24) {
      const y = 90 + k * 170 + Math.sin(x * 0.008 + t * 0.015 + k * 2) * 28 + Math.sin(x * 0.02 - t * 0.02) * 8 - ((cy * 0.15) % 170);
      if (x === -24) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
  // Molecules, at 1/2 speed.
  const W = VIEW_W + 40, H = VIEW_H + 40;
  for (const d of L.art.dots) {
    d.y -= d.v; d.rot += 0.004;
    const x = ((d.x - cx * 0.5) % W + W) % W - 20, y = ((d.y - cy * 0.5) % H + H) % H - 20;
    if (d.kind === 'hex') {
      ctx.strokeStyle = rgba(th.mol, 0.3); ctx.lineWidth = 1.5; hexagon(x, y, d.r + 2, d.rot); ctx.stroke();
    } else if (d.kind === 'pyo') {
      glow(x, y, d.r * 3, '#2b6fd0', 0.35); circle(x, y, d.r * 0.7, 'rgba(43,111,208,0.55)');
    } else circle(x, y, d.r * 0.6, rgba(th.mol, 0.22));
  }
  // Streams of particles: nutrient flow (TSB), secreted molecules (PASN), mucus moved up the airway (CF).
  const [sdx, sdy, scol] = bg === 'cf' ? [0.15, -1, '#fff0f3'] : bg === 'pasn' ? [0.8, -0.5, '#bfe9ff'] : [1, -0.35, '#fff1c2'];
  const W3 = VIEW_W + 100, H3 = VIEW_H + 100;
  ctx.lineCap = 'round';
  for (const s of L.art.stream) {
    s.x += sdx * s.v; s.y += sdy * s.v;
    const x = ((s.x - cx * 0.7) % W3 + W3) % W3 - 50, y = ((s.y - cy * 0.7) % H3 + H3) % H3 - 50;
    ctx.strokeStyle = rgba(scol, 0.22); ctx.lineWidth = s.r;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - sdx * s.len, y - sdy * s.len); ctx.stroke();
    circle(x, y, s.r * 0.8, rgba(scol, 0.45));
  }
}

// The y of the first surface at or below (px, py), up to 9 rows down, or null.
function surfaceBelow(px, py) {
  const tx = Math.floor(px / TILE), r0 = Math.floor(py / TILE);
  for (let ty = r0; ty < Math.min(L.rows, r0 + 9); ty++) {
    const c = tileAt(tx, ty);
    if (isSolid(c) || oneWay(c)) return ty * TILE;
  }
  return null;
}

// Out-of-focus cells drifting in front of the scene (depth of field).
function drawForeground(cx, cy) {
  const W = VIEW_W + 300, H = VIEW_H + 300;
  for (const f of L.art.fore) {
    f.y -= f.v;
    const x = ((f.x - cx * 1.35) % W + W) % W - 150, y = ((f.y - cy * 1.35) % H + H) % H - 150;
    const g = ctx.createRadialGradient(x, y, f.r * 0.2, x, y, f.r);
    g.addColorStop(0, rgba(f.col, f.a * 0.5)); g.addColorStop(0.85, rgba(f.col, f.a)); g.addColorStop(1, rgba(f.col, 0));
    circle(x, y, f.r, g);
  }
}

// PASN levels are murkier: darker towards the edges, lit around the player.
function drawDarkness(cx, cy) {
  const d = L.def.theme.dark || 0;
  if (!d) return;
  const px = P.x + P.w / 2 - cx, py = P.y + P.h / 2 - cy;
  const g = ctx.createRadialGradient(px, py, 110, px, py, 520);
  g.addColorStop(0, 'rgba(4,16,24,0)'); g.addColorStop(1, `rgba(4,16,24,${d})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

// Weather per medium: golden nutrient flakes (TSB), motes (SNpulse), pyocyanin mist
// (SN), mucus flecks and air streaks during coughs (CF); plus the antibiotic mist.
function drawWeather(cx, cy) {
  const w = L.def.theme.weather, t = L.time, W = VIEW_W + 60, H = VIEW_H + 60;
  if (!L.weather) L.weather = Array.from({ length: 46 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: 0.3 + Math.random() * 0.6, r: 1 + Math.random() * 2.2, ph: Math.random() * TAU }));
  const at = p => [((p.x - cx * 0.9) % W + W) % W - 30, ((p.y - cy * 0.9) % H + H) % H - 30];
  if (w === 'snow' || w === 'motes') {
    const col = w === 'snow' ? '#ffe7a0' : '#d9f2b0';
    for (const p of L.weather) {
      p.y += p.v * (w === 'snow' ? 1 : -0.5); p.x += Math.sin(t * 0.02 + p.ph) * 0.3;
      const [x, y] = at(p);
      glow(x, y, p.r * 3, col, 0.35); circle(x, y, p.r, rgba(col, 0.8));
    }
  } else if (w === 'mist') {
    for (let k = 0; k < 4; k++) {
      const span = VIEW_W + 800, x = ((t * (0.4 + k * 0.15) + k * 400 - cx * 0.6) % span + span) % span - 400;
      const y = 110 + k * 120 + Math.sin(t * 0.01 + k) * 30;
      ctx.save(); ctx.translate(x, y); ctx.scale(3, 1);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 110);
      g.addColorStop(0, 'rgba(70,130,230,0.14)'); g.addColorStop(1, 'rgba(70,130,230,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 110, 0, TAU); ctx.fill();
      ctx.restore();
    }
  } else if (w === 'cf') {
    for (let i = 0; i < 20; i++) { const p = L.weather[i]; p.y -= p.v * 0.4; const [x, y] = at(p); circle(x, y, p.r, 'rgba(240,235,160,0.45)'); }
    if (L.coughing > 0) {
      const k = Math.sin((1 - L.coughing / 100) * Math.PI);
      ctx.strokeStyle = `rgba(255,255,255,${0.55 * k})`; ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (const p of L.weather) {
        p.y -= 14 * k;
        const [x, y] = at(p);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(p.ph) * 4, y + 30 + p.r * 10); ctx.stroke();
      }
    }
  }
  if (L.abOn > 0 || L.abWarn > 0) {   // the antibiotic mist comes down the airway
    const k = L.abOn > 0 ? Math.min(1, (240 - L.abOn) / 30, L.abOn / 30) : 0.25 * (1 - L.abWarn / 180);
    ctx.fillStyle = `rgba(120,220,210,${0.22 * k})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = `rgba(225,255,250,${0.8 * k})`;
    for (const p of L.weather) ctx.fillRect((p.x * 1.7) % VIEW_W, ((p.y * 1.3 + t * (3 + p.v * 3)) % (VIEW_H + 20)) - 10, 2, 7);
  }
}

// Inside a tunnel the world goes dark around a soft light on your cell.
function drawCaveLight(cx, cy) {
  if (L.caveK < 0.02) return;
  const px = P.x + P.w / 2 - cx, py = P.y + P.h / 2 - cy;
  const g = ctx.createRadialGradient(px, py, 60, px, py, 360);
  g.addColorStop(0, 'rgba(5,10,14,0)'); g.addColorStop(1, `rgba(5,10,14,${0.72 * L.caveK})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(px, py, 90, '#ffe9a8', 0.16 * L.caveK); ctx.restore();
}

function visibleTiles(cx, cy, fn) {
  const c0 = Math.max(0, Math.floor(cx / TILE)), c1 = Math.min(L.cols - 1, Math.floor((cx + VIEW_W) / TILE));
  const r0 = Math.max(0, Math.floor(cy / TILE)), r1 = Math.min(L.rows - 1, Math.floor((cy + VIEW_H) / TILE));
  for (let ty = r0; ty <= r1; ty++) for (let tx = c0; tx <= c1; tx++) fn(L.grid[ty][tx], tx, ty);
}

// Tiles that change or move: ribosome blocks, debris / mucus plugs, mucus, cilia.
function drawSpecialTiles(cx, cy) {
  const t = L.time, mucusStyle = L.def.theme.debris === 'mucus';
  visibleTiles(cx, cy, (c, tx, ty) => {
    const X = tx * TILE, Y = ty * TILE;
    if (c === '#') {   // the biofilm surface shimmers: its cells "breathe"
      if (ty > 0 && !isSolid(L.grid[ty - 1][tx])) {
        const a = 0.1 + 0.12 * Math.sin(t * 0.05 + tx * 0.7 + ty * 1.3);
        if (a > 0.12) circle(X + 5 + ((tx * 7) % 3) * 11, Y + 3, 3.2, `rgba(255,255,255,${a})`);
      }
      return;
    }
    if (c === 'H') { drawHiddenTile(tx, ty); return; }
    if (c === 'R' || c === 'U') { // ribosome: large + small subunit on an mRNA
      const used = c === 'U', hop = L.bumps.get(ty * L.cols + tx) || 0;
      ctx.save();
      if (hop) ctx.translate(0, -Math.sin((10 - hop) / 10 * Math.PI) * 8);   // it hops when bumped
      drawRibosome(X, Y, used, t);
      ctx.restore();
      return;
    }
    if (c === 'B') {
      if (mucusStyle) { // a mucus plug
        const g = ctx.createRadialGradient(X + 12, Y + 10, 2, X + 16, Y + 16, 22);
        g.addColorStop(0, '#f3f5b8'); g.addColorStop(1, '#93a23a');
        roundRect(X + 1, Y + 1, 30, 30, 10, g, '#6f7d24', 1.5);
        for (const [dx, dy, r] of [[9, 10, 3], [20, 18, 4], [12, 23, 2]]) circle(X + dx, Y + dy, r, 'rgba(255,255,230,0.55)');
      } else { // debris of dead cells
        roundRect(X + 1, Y + 1, 30, 30, 5, '#9f8f78', '#6b5c48', 1.5);
        ctx.strokeStyle = 'rgba(80,65,45,0.7)'; ctx.lineWidth = 1.5;
        for (const [ax, ay, r, a0] of [[9, 10, 6, 0.4], [22, 12, 5, 2.1], [14, 23, 6, 3.6]]) { ctx.beginPath(); ctx.arc(X + ax, Y + ay, r, a0, a0 + 4.2); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(50,40,25,0.6)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(X + 4, Y + 17); ctx.lineTo(X + 13, Y + 15); ctx.lineTo(X + 18, Y + 21); ctx.lineTo(X + 28, Y + 19); ctx.stroke();
      }
    } else if (c === '~') { // thick, sticky mucus
      const g = ctx.createLinearGradient(X, Y, X, Y + TILE);
      g.addColorStop(0, '#eef0a0'); g.addColorStop(1, '#a8b44a');
      ctx.fillStyle = g; ctx.fillRect(X, Y + 3, TILE, TILE - 3);
      ctx.beginPath(); ctx.moveTo(X, Y + 4);
      const jig = L.jiggle.get(ty * L.cols + tx) || 0;   // wobbles more right after you land on it
      for (let k = 0; k <= TILE; k += 4) ctx.lineTo(X + k, Y + 2 + Math.sin(k * 0.4 + tx * 2 + t * 0.05) * 1.8 + Math.sin(t * 0.6 + k * 0.3) * jig);
      ctx.lineTo(X + TILE, Y + 8); ctx.lineTo(X, Y + 8); ctx.closePath(); ctx.fill();
      circle(X + 8 + (tx % 3) * 6, Y + 12 + Math.sin(t * 0.04 + tx) * 2, 2.2, 'rgba(255,255,225,0.7)');
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(X + 2, Y + 3); ctx.lineTo(X + 14, Y + 2); ctx.stroke();
      if (!isSolid(tileAt(tx, ty + 1))) { // drips
        const d = 4 + ((t * 0.2 + tx * 7) % 10);
        ctx.fillStyle = '#c3cc63'; ctx.beginPath(); ctx.ellipse(X + 16, Y + TILE + d / 2, 2.5, d / 2 + 2, 0, 0, TAU); ctx.fill();
      }
    } else if ((c === '<' || c === '>') && L.def.theme.bg !== 'cf') { // a flow channel through the culture
      const dir = c === '>' ? 1 : -1, th = L.def.theme;
      const g = ctx.createLinearGradient(X, Y, X, Y + TILE);
      g.addColorStop(0, mix(th.plat[1], '#ffffff', 0.25)); g.addColorStop(1, th.plat[0]);
      ctx.fillStyle = g; ctx.fillRect(X, Y + 2, TILE, TILE - 2);
      ctx.fillStyle = rgba(th.eps, 0.55); ctx.fillRect(X, Y + 2, TILE, 5);
      ctx.save(); ctx.beginPath(); ctx.rect(X, Y, TILE, TILE); ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const off = ((t * 1.5 * dir) % 16 + 16) % 16;
      for (let k = -1; k < 3; k++) {
        const bx = X + k * 16 + off;
        ctx.beginPath(); ctx.moveTo(bx - 3 * dir, Y + 11); ctx.lineTo(bx + 3 * dir, Y + 17); ctx.lineTo(bx - 3 * dir, Y + 23); ctx.stroke();
      }
      ctx.restore();
      for (let k = 0; k < 2; k++) {   // streaming specks just above the surface
        const sx = X + ((t * 1.5 * dir + k * 16 + tx * 11) % TILE + TILE) % TILE;
        circle(sx, Y - 2 - k * 3, 1.6, rgba(th.eps, 0.8));
      }
    } else if (c === '<' || c === '>') { // airway cells with beating cilia
      const dir = c === '>' ? 1 : -1;
      const g = ctx.createLinearGradient(X, Y, X, Y + TILE);
      g.addColorStop(0, '#f0b3bc'); g.addColorStop(1, '#b0606f');
      ctx.fillStyle = g; ctx.fillRect(X, Y + 4, TILE, TILE - 4);
      ctx.strokeStyle = 'rgba(122,52,67,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X + 16, Y + 6); ctx.lineTo(X + 16, Y + TILE); ctx.stroke();
      ctx.strokeStyle = '#fbe3e7'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      for (let k = 0; k < 6; k++) {
        const bx = X + 3 + k * 5.4, a = dir * 0.45 + Math.sin(t * 0.25 - (tx * 6 + k) * 0.35 * dir) * 0.8;   // a travelling wave
        ctx.beginPath(); ctx.moveTo(bx, Y + 5); ctx.quadraticCurveTo(bx + Math.sin(a) * 4, Y, bx + Math.sin(a) * 8, Y - 3 - Math.cos(a) * 3); ctx.stroke();
      }
      ctx.globalAlpha = 0.35; text(dir > 0 ? '›' : '‹', X + 16, Y + 24, { size: 14, color: '#7a3443', align: 'center', weight: '900' }); ctx.globalAlpha = 1;
    }
  });
}
// A hidden passage: drawn like the biofilm around it, with faint cracks. It fades
// when the cell comes close, so you can see into the secret room.
function drawHiddenTile(tx, ty) {
  const X = tx * TILE, Y = ty * TILE, th = L.def.theme;
  const d = dist(P.x + P.w / 2, P.y + P.h / 2, X + 16, Y + 16);
  const a = clamp((d - 40) / 70, 0.22, 1);
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = mix(th.matrix[0], th.matrix[1], clamp(ty / L.rows, 0.15, 0.85)); ctx.fillRect(X, Y, TILE, TILE);
  for (let k = 0; k < 4; k++) {
    const px = X + 6 + ((tx * 13 + k * 11) % 20), py = Y + 6 + ((ty * 7 + k * 9) % 20);
    ball(px, py, 6, mix(th.cells[k % th.cells.length], '#ffffff', 0.4), th.cells[k % th.cells.length], mix(th.cells[0], th.matrix[1], 0.6));
  }
  if (ty > 0 && !isSolid(L.grid[ty - 1][tx]) && L.grid[ty - 1][tx] !== 'H') { ctx.fillStyle = rgba(th.eps, 0.9); ctx.fillRect(X, Y - 1, TILE, 6); }
  ctx.strokeStyle = 'rgba(40,25,10,0.45)'; ctx.lineWidth = 1;   // the tell: hairline cracks
  ctx.beginPath(); ctx.moveTo(X + 8, Y + 4); ctx.lineTo(X + 14, Y + 13); ctx.lineTo(X + 11, Y + 22); ctx.moveTo(X + 14, Y + 13); ctx.lineTo(X + 23, Y + 17); ctx.stroke();
  ctx.restore();
}
// A ribosome: large + small subunit on an mRNA.
function drawRibosome(X, Y, used, t) {
  if (!used) glow(X + 16, Y + 16, 26 + Math.sin(t * 0.1) * 3, '#ffd66a', 0.35);
  const g = ctx.createLinearGradient(X, Y, X, Y + TILE);
  g.addColorStop(0, used ? '#b9bcc2' : '#fff1c4'); g.addColorStop(1, used ? '#8b8f96' : '#e9b44c');
  roundRect(X + 1, Y + 1, 30, 30, 7, g, used ? '#5f636a' : '#94650f', 2);
  ctx.strokeStyle = used ? '#777' : '#c0392b'; ctx.lineWidth = 1.6; ctx.beginPath();
  for (let k = 0; k <= 26; k += 2) { const yy = Y + 21 + Math.sin(k * 0.6 + (used ? 0 : t * 0.15)) * 1.5; if (k) ctx.lineTo(X + 3 + k, yy); else ctx.moveTo(X + 3, yy); }
  ctx.stroke();
  ball(X + 16, Y + 13, 8.5, used ? '#ddd' : '#cfd6ff', used ? '#9a9ea6' : '#6c7be0', used ? '#5d6168' : '#2f3a8f');
  ball(X + 16, Y + 23, 5.5, used ? '#ddd' : '#e3e8ff', used ? '#a6aab1' : '#9aa6f0', used ? '#5d6168' : '#4a56b0');
  if (!used) for (let k = 0; k < 3; k++) circle(X + 22 + k * 3, Y + 7 - k * 2.5 + Math.sin(t * 0.2 + k) * 0.8, 1.8, ['#f3c22f', '#e0743c', '#5aa0ff'][k]);
}

function drawFoam(cx, cy) {
  visibleTiles(cx, cy, (c, tx, ty) => {
    if (c !== '^') return;
    const X = tx * TILE, Y = ty * TILE, t = L.time;
    glow(X + 16, Y + 26, 22, '#e0458f', 0.25);
    roundRect(X + 1, Y + 24, TILE - 2, 8, 4, 'rgba(214,70,143,0.55)');
    for (let k = 0; k < 3; k++) {
      const hi = (k + tx) % 2, r = 6.5 - hi * 1.5;
      const bx = X + 6 + k * 10, by = Y + 23 - hi * 5 + Math.sin(t * 0.08 + k * 2 + tx) * 1.5;
      ball(bx, by, r, '#ffe0ef', '#e86aa9', '#9c2763');
      for (let j = 0; j < 8; j++) { const a = j * TAU / 8 + t * 0.02; circle(bx + Math.cos(a) * r, by + Math.sin(a) * r, 1.2, '#7d1b4f'); }
    }
    const rise = (t * 0.6 + tx * 13) % 24;
    ctx.strokeStyle = `rgba(232,106,169,${0.7 - rise / 34})`; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(X + 10 + (tx % 3) * 6, Y + 18 - rise, 2.2, 0, TAU); ctx.stroke();
  });
}

// Lysed cells: pale, cracked cocci that shake and collapse.
function drawLysis(cx, cy) {
  visibleTiles(cx, cy, (c, tx, ty) => {
    if (c !== '%') return;
    const X = tx * TILE, Y = ty * TILE, s = L.lysis.get(ty * L.cols + tx);
    if (s && s.down > 0) {
      ctx.globalAlpha = s.down < 50 ? (50 - s.down) / 50 * 0.5 : 0.1;
      for (let k = 0; k < 3; k++) { ctx.strokeStyle = '#efe4bf'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(X + 6 + k * 10, Y + 6, 5, 0, TAU); ctx.stroke(); }
      ctx.globalAlpha = 1;
      return;
    }
    const sh = s ? Math.sin(s.t * 1.9) * Math.min(2.5, s.t / 8) : 0;
    roundRect(X + 1 + sh, Y + 2, 30, 10, 5, 'rgba(110,90,50,0.25)');
    for (let k = 0; k < 3; k++) {
      const bx = X + 6 + k * 10 + sh;
      ball(bx, Y + 6, 5.6, '#fffdf0', '#e8dcae', '#a39463');
      ctx.strokeStyle = 'rgba(90,70,30,0.65)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(bx - 1, Y + 2); ctx.lineTo(bx + 1.5, Y + 5.5); ctx.lineTo(bx - 0.5, Y + 9); ctx.stroke();
    }
  });
}

// Info signs are membrane vesicles with an "i" inside. A sign only talks after you
// stand on it for about a second (a ring fills around the icon meanwhile); the
// message is a small translucent panel that fades in and out.
const SIGN_HOLD = 60;
function nearestSign() {
  let best = null, bd = Infinity;
  for (const s of L.signs) {
    const dx = Math.abs(s.tx * TILE + 16 - (P.x + P.w / 2)), dy = Math.abs(s.ty * TILE + 16 - (P.y + P.h / 2));
    if (dx < TILE * 0.9 && dy < TILE * 1.2 && dx + dy < bd) { bd = dx + dy; best = s; }   // standing on the icon
  }
  return best;
}
function updateSigns() {
  const s = P.onGround ? nearestSign() : null;
  if (s && s === L.signAt) L.signT = Math.min(SIGN_HOLD, (L.signT || 0) + 1);
  else { L.signAt = s; L.signT = s ? 1 : 0; }
  if (L.signT >= SIGN_HOLD) L.signShown = s;
  L.signA = clamp((L.signA || 0) + (L.signT >= SIGN_HOLD ? 0.09 : -0.12), 0, 1);
}
function drawSigns(cx, cy) {
  for (const s of L.signs) {
    const x = s.tx * TILE + 16, y = s.ty * TILE + 12 + Math.sin(L.time * 0.05 + s.tx) * 3;
    if (x < cx - 40 || x > cx + VIEW_W + 40 || y < cy - 40 || y > cy + VIEW_H + 40) continue;
    const near = s === L.signAt, k = near ? (L.signT || 0) / SIGN_HOLD : 0;
    if (near) glow(x, y, 26 + 6 * k, '#ffffff', 0.25 + 0.25 * k);
    ctx.globalAlpha = near ? 0.9 : 0.6;
    circle(x, y, 13, 'rgba(255,255,255,0.3)');
    ctx.strokeStyle = 'rgba(90,120,150,0.75)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, 13, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(90,120,150,0.4)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 9.5, 0, TAU); ctx.stroke();
    text('i', x, y + 5, { size: 15, color: '#2c4f70', align: 'center', weight: '900', font: 'Georgia, serif' });
    if (near && k < 1) {   // the reading ring fills while you stand still on the sign
      ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(x, y, 17, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
function drawSignText(cx, cy) {
  const s = L.signShown, a = L.signA || 0;
  if (!s || a <= 0.01) return;
  const x = s.tx * TILE + 16 - cx, y = s.ty * TILE + 12 - cy;
  const lines = wrap(s.text, 268, 13);
  const h = lines.length * 17 + 14, w = 290;
  const bx = clamp(x - w / 2, 8, VIEW_W - w - 8);
  let by = y - 30 - h + (1 - a) * 8;
  if (by < 100) by = y + 28 - (1 - a) * 8;   // keep clear of the HUD bar
  ctx.save();
  ctx.globalAlpha = a;
  roundRect(bx, by, w, h, 10, 'rgba(12,26,34,0.55)', 'rgba(255,255,255,0.28)', 1);
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 3;   // readable on the translucent panel
  lines.forEach((ln, i) => text(ln, bx + 12, by + 21 + i * 17, { size: 13, color: '#f2f8f6', weight: '600' }));
  ctx.restore();
}

function drawEntities(cx, cy) {
  for (const e of L.ents) {
    if (!e.alive || e.type === 'start') continue;
    if (e.type !== 'boss' && (e.x < cx - 140 || e.x > cx + VIEW_W + 140 || e.y < cy - 140 || e.y > cy + VIEW_H + 140)) continue;
    drawEntity(e);
  }
  drawShotsAndBubbles();
}
// One entity at its world position (also used for the codex icons).
function drawEntity(e) {
  const x = e.x, y = e.y;
  const bob = Math.sin((e.t + e.tx * 13) * 0.08) * 3;
  {
    switch (e.type) {
      case 'secret': drawSecret(x + 16, y + 16 + bob, e.t); break;
      case 'landmark': {
        ctx.font = `800 14px ${FONT}`;
        const w = ctx.measureText(e.label).width + 30;
        roundRect(x + 16 - w / 2, y + 2, w, 29, 14, 'rgba(14,36,45,0.72)');
        text(e.label, x + 16, y + 22, { size: 14, color: '#effff5', align: 'center', weight: '800' });
        break;
      }
      case 'cystine': { // two S atoms bonded: S–S, with an occasional twinkle
        glow(x + 16, y + 16 + bob, 20, '#ffd84a', 0.35);
        drawCystineIcon(x + 16, y + 16, 1, bob);
        const tw = (e.t + e.tx * 17) % 100;
        if (tw < 16) {
          const k = Math.sin(tw / 16 * Math.PI) * 6, sx = x + 25, sy = y + 8 + bob;
          ctx.fillStyle = 'rgba(255,255,255,0.95)';
          ctx.beginPath(); ctx.ellipse(sx, sy, k, k * 0.18, 0, 0, TAU); ctx.fill();
          ctx.beginPath(); ctx.ellipse(sx, sy, k * 0.18, k, 0, 0, TAU); ctx.fill();
        }
        break;
      }
      case 'iron':
        glow(x + 16, y + 16 + bob, 20, '#ff8a4a', 0.35);
        drawIronIcon(x + 16, y + 16 + bob);
        break;
      case 'ahpc': { // a globular protein
        const yy = y + 16 + bob, pulse = 1 + Math.sin(e.t * 0.1) * 0.08;
        glow(x + 16, yy, 26 * pulse, '#5aa0ff', 0.4);
        for (const [dx, dy, r] of [[-6, -3, 8], [6, -4, 8], [0, 5, 9], [-8, 6, 6], [8, 5, 6]]) ball(x + 16 + dx, yy + dy, r, '#cfe3ff', '#4f8fe0', '#24538f');
        text('AhpC', x + 16, yy + 4, { size: 10, color: '#fff', align: 'center', weight: '800' });
        break;
      }
      case 'tcya': { // substrate-binding protein: two lobes holding a cystine
        const yy = y + 16 + bob, open = 0.35 + Math.sin(e.t * 0.08) * 0.15;
        glow(x + 16, yy, 26, '#ffd24a', 0.4);
        ctx.save(); ctx.translate(x + 16, yy + 6);
        for (const sgn of [-1, 1]) {
          ctx.save(); ctx.rotate(sgn * open);
          ctx.beginPath(); ctx.ellipse(sgn * 7, -8, 9, 11, 0, 0, TAU);
          const g = ctx.createRadialGradient(sgn * 4, -12, 1, sgn * 7, -8, 12);
          g.addColorStop(0, '#fff0b0'); g.addColorStop(1, '#c99512'); ctx.fillStyle = g; ctx.fill();
          ctx.restore();
        }
        ctx.restore();
        drawCystineIcon(x + 16, yy - 2, 0.45);
        text('TcyA', x + 16, yy + 22, { size: 9, color: '#6b4d00', align: 'center', weight: '800' });
        break;
      }
      case 'check': { // a cryo-vial: the glycerol stock you restart from
        const X = x + 10, Y = y + 2;
        if (e.on) glow(X + 6, Y + 18, 24, '#9fd8ff', 0.55);
        roundRect(X, Y + 6, 12, 26, [2, 2, 6, 6], 'rgba(235,245,255,0.85)', '#7d93a8', 1.5);
        // the vial fills with golden culture when the stock is saved
        const fill = e.on ? Math.min(1, (e.fillT ?? 30) / 30) : 0;
        roundRect(X + 1.5, Y + 18, 9, 12.5, [0, 0, 5, 5], '#c9d2da');
        if (fill > 0) {
          const h = 12.5 * fill;
          roundRect(X + 1.5, Y + 30.5 - h, 9, h, [0, 0, 5, 5], '#f3c22f');
          if (fill < 1) for (let k = 0; k < 2; k++) circle(X + 4 + k * 4, Y + 30 - ((e.t * 1.5 + k * 7) % h), 1.2, '#fff6c8');
        }
        roundRect(X - 2, Y, 16, 8, 2, e.on ? '#2eaa5c' : '#8a96a3');
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(X + 2, Y + 9, 2, 18);
        if (e.on) for (let k = 0; k < 3; k++) {
          const a = e.t * 0.04 + k * 2.1;
          text('*', X + 6 + Math.cos(a) * 14, Y + 20 + Math.sin(a) * 10, { size: 12, color: '#bfe6ff', align: 'center', weight: '900' });
        }
        break;
      }
      case 'stage': { // gate to part 2: a large glowing cryo-vial with an arrow
        const X = x + 16, Y = y - TILE + 4, pulse = 0.5 + 0.5 * Math.sin(e.t * 0.08);
        glow(X + 8, Y + 30, 46 + pulse * 8, '#9fd8ff', 0.45 + pulse * 0.2);
        roundRect(X - 12, Y + 12, 40, 46, [4, 4, 12, 12], 'rgba(235,245,255,0.88)', '#7d93a8', 2);
        roundRect(X - 9, Y + 30, 34, 25, [0, 0, 10, 10], '#f3c22f');
        roundRect(X - 16, Y, 48, 14, 4, '#2eaa5c', '#1e7a40', 1.5);
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(X - 5, Y + 16, 3, 36);
        for (let k = 0; k < 3; k++) {
          const a = e.t * 0.05 + k * 2.1;
          text('*', X + 8 + Math.cos(a) * 30, Y + 34 + Math.sin(a) * 22, { size: 14, color: '#bfe6ff', align: 'center', weight: '900' });
        }
        const ax = X + 8 + Math.sin(e.t * 0.12) * 3;
        ctx.strokeStyle = '#1e7a40'; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(ax - 7, Y + 36); ctx.lineTo(ax + 4, Y + 43); ctx.lineTo(ax - 7, Y + 50); ctx.stroke();
        roundRect(X - 30, Y - 26, 76, 20, 10, 'rgba(14,36,45,0.85)');
        text('PART 2 ▶', X + 8, Y - 11, { size: 13, color: '#9fffe0', align: 'center', weight: '900' });
        break;
      }
      case 'goal': { // the LC-MS/MS (or, in the CF level, a sputum sample cup)
        const miss = missingGoals().length, nReq = L.def.goals.filter(g => g.req).length;
        const status = () => { if (nReq) text(miss ? `${nReq - miss}/${nReq} goals` : 'ready!', x + TILE, y - TILE - 32, { size: 12, color: miss ? '#a0202f' : '#1b7f3b', align: 'center', weight: '800' }); };
        if (L.def.goalKind === 'sputum') {
          const X = x + 4, Y = y - TILE + 4;
          glow(X + 28, Y + 34, 44, '#ffffff', 0.35);
          roundRect(X, Y + 10, 56, 50, [4, 4, 12, 12], 'rgba(235,245,255,0.8)', '#8aa0b5', 2);
          roundRect(X + 3, Y + 34, 50, 23, [0, 0, 10, 10], 'rgba(214,214,110,0.85)');
          for (let k = 0; k < 4; k++) circle(X + 12 + k * 11, Y + 42 + (k % 2) * 6, 3, 'rgba(255,255,220,0.7)');
          roundRect(X - 4, Y, 64, 13, 4, '#2f6fd0', '#1d4f99', 1.5);
          ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(X + 6, Y + 14, 3, 40);
          text('sputum sample', x + TILE, Y - 8, { size: 11, color: '#1d2733', align: 'center', weight: '800' });
          status();
          break;
        }
        const X = x - 6, Y = y - TILE - 12, w = 76, h = 76;
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
        const g = ctx.createLinearGradient(X, Y, X, Y + h);
        g.addColorStop(0, '#f2f4f7'); g.addColorStop(1, '#aeb5bf');
        roundRect(X, Y, w, h, 8, g);
        ctx.restore();
        roundRect(X, Y, w, h, 8, null, '#69717c', 2);
        roundRect(X + 6, Y + 8, 8, 58, 3, '#dfe6ee', '#7d8794', 1.2);
        roundRect(X + 7.5, Y + 12 + (e.t * 0.6) % 44, 5, 8, 2, '#5aa0ff');
        roundRect(X + 20, Y + 8, 50, 32, 4, '#15202c');
        ctx.strokeStyle = '#4fe3a1'; ctx.lineWidth = 2; ctx.beginPath();
        for (let i = 0; i < 9; i++) { const px = X + 25 + i * 5; ctx.moveTo(px, Y + 36); ctx.lineTo(px, Y + 36 - 3 - ((i * 7 + e.t / 6) % 20)); }
        ctx.stroke();
        roundRect(X + 24, Y + 48, 42, 12, 4, '#59626e');
        circle(X + 45, Y + 54, 3.5, '#1c232c');
        circle(X + 64, Y + 68, 3, Math.floor(e.t / 30) % 2 ? '#2ee07a' : '#1b7f3b');
        text('LC-MS/MS', x + TILE, Y - 6, { size: 11, color: '#1d2733', align: 'center', weight: '800' });
        status();
        break;
      }
      case 'dripper': { // pyocyanin: a blue phenazine (three fused rings) that drips
        const X = x + 16, Y = y + 8;
        glow(X, Y, 30, '#2b6fd0', 0.35);
        ctx.fillStyle = 'rgba(70,130,230,0.35)'; ctx.strokeStyle = '#1d4fa0'; ctx.lineWidth = 2;
        for (const dx of [-11, 0, 11]) { hexagon(X + dx, Y, 6.4, Math.PI / 6); ctx.fill(); ctx.stroke(); }
        const ph = (e.t % 100) / 100, r = 1 + ph * 3.5;
        ctx.fillStyle = '#2f7ad8';
        ctx.beginPath(); ctx.moveTo(X, Y + 6); ctx.quadraticCurveTo(X + r, Y + 8 + r * 1.5, X, Y + 8 + r * 2.4); ctx.quadraticCurveTo(X - r, Y + 8 + r * 1.5, X, Y + 6); ctx.fill();
        break;
      }
      case 'drop': {
        const g = ctx.createLinearGradient(x, y, x + 8, y + 12);
        g.addColorStop(0, '#9cc8ff'); g.addColorStop(1, '#1f63c0');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(x + 4, y - 2); ctx.quadraticCurveTo(x + 10, y + 8, x + 4, y + 11); ctx.quadraticCurveTo(x - 2, y + 8, x + 4, y - 2); ctx.fill();
        circle(x + 2.5, y + 6, 1.4, 'rgba(255,255,255,0.8)');
        break;
      }
      case 'hqno': {
        const X = e.cx, Y = e.cy;
        for (const [dx, dy, r] of [[0, 0, 32], [-24, 7, 22], [24, 5, 24], [6, -16, 20], [-12, -10, 16]]) {
          const g = ctx.createRadialGradient(X + dx, Y + dy, 0, X + dx, Y + dy, r);
          g.addColorStop(0, 'rgba(140,200,80,0.5)'); g.addColorStop(1, 'rgba(110,170,60,0)');
          circle(X + dx, Y + dy, r, g);
        }
        text('HQNO', X, Y + 5, { size: 12, color: '#355a1a', align: 'center', weight: '800' });
        break;
      }
      case 'lasa': { // a protease with snapping jaws; glows red when it charges
        const wind = e.windup > 0, X = x + e.w / 2 + (wind ? Math.sin(e.t * 2.5) * 2 : 0), Y = y + e.h / 2 + 1, dir = e.vx < 0 ? -1 : 1, open = Math.abs(Math.sin(e.t * (e.angry ? 0.4 : 0.2))) * 0.5;
        if (wind) {   // crouch and warn before the charge
          roundRect(X - 8, Y - 38, 16, 18, 6, '#fff3e9', '#b23a48', 1.5);
          text('!', X, Y - 24, { size: 14, color: '#b23a48', align: 'center', weight: '900' });
        }
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(X, y + e.h + 1, 13, 3.5, 0, 0, TAU); ctx.fill();
        if (e.angry) glow(X, Y, 24, '#ff3040', 0.4);
        ball(X, Y, 12, '#f08a96', '#b23a48', '#5e1520');
        ctx.fillStyle = '#e9e2e4';
        for (const sgn of [-1, 1]) {
          ctx.save(); ctx.translate(X + dir * 9, Y + 2); ctx.rotate(sgn * (0.35 + open) * dir);
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(dir * 12, sgn * 2); ctx.lineTo(dir * 3, sgn * 5); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
        circle(X + dir * 3, Y - 4, 3, '#fff'); circle(X + dir * 4, Y - 3.5, 1.5, '#1d1d1d');
        ctx.strokeStyle = '#3a0c14'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(X, Y - 9 + (e.angry ? 1 : 0)); ctx.lineTo(X + dir * 6, Y - 7 - (e.angry ? 1 : 0)); ctx.stroke();
        text('LasA', X - dir * 2, Y + 8, { size: 8, color: '#fff', align: 'center', weight: '800' });
        break;
      }
      case 'sidero': { // siderophore: a glowing iron-grabbing claw
        const X = e.cx, Y = e.cy;
        glow(X, Y, 26, '#c8e85a', 0.45);
        ctx.strokeStyle = '#9cc21e'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
        for (let k = 0; k < 3; k++) { const a = e.t * 0.05 + k * TAU / 3; ctx.beginPath(); ctx.arc(X, Y, 12, a, a + 1.3); ctx.stroke(); }
        ball(X, Y, 5, '#f6ffd0', '#c8e85a', '#6f8f10');
        break;
      }
      case 'vent': { // an air stone; bubbles come out of it
        roundRect(x + 5, y + 23, 22, 9, 4, '#8d969c', '#5f676d', 1.2);
        for (let k = 0; k < 4; k++) circle(x + 9 + k * 5, y + 27, 1.1, '#4f565b');
        for (let k = 0; k < 3; k++) { const yy = y + 20 - ((e.t * 0.8 + k * 9) % 26); circle(x + 10 + k * 6 + Math.sin(e.t * 0.1 + k) * 1.5, yy, 1.8, 'rgba(255,255,255,0.75)'); }
        break;
      }
      case 'peptide': { // a tryptic peptide (proteomics): a short chain ending in K or R
        const yy = y + 16 + bob;
        glow(x + 16, yy, 24, '#9fe7ff', 0.5);
        for (let i = 0; i < 5; i++) ball(x + 4 + i * 6, yy + Math.sin(e.t * 0.1 + i) * 2.5, 3.6, '#ffffff', '#7fd4f0', '#2a7fa0');
        ball(x + 31, yy + Math.sin(e.t * 0.1 + 5) * 2.5, 4.2, '#ffffff', '#5aa0ff', '#1d4f99');
        text('K', x + 31, yy + 3.5 + Math.sin(e.t * 0.1 + 5) * 2.5, { size: 7, color: '#fff', align: 'center', weight: '900' });
        break;
      }
      case 'psm': { // PSM power-up: little amphipathic helices
        const yy = y + 16 + bob;
        glow(x + 16, yy, 24, '#e88ad0', 0.45);
        for (const [dx, dy, a] of [[-7, -2, -0.5], [6, -5, 0.4], [1, 6, -0.1]]) {
          ctx.save(); ctx.translate(x + 16 + dx, yy + dy); ctx.rotate(a);
          roundRect(-8, -3.5, 16, 7, 3.5, '#d65fb4', '#7c1f63', 1.2);
          ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1;
          for (let k = -6; k <= 6; k += 4) { ctx.beginPath(); ctx.moveTo(k, -3); ctx.lineTo(k + 2, 3); ctx.stroke(); }
          ctx.restore();
        }
        text('PSM', x + 16, yy + 20, { size: 8, color: '#7c1f63', align: 'center', weight: '900' });
        break;
      }
      case 'xan': { // staphyloxanthin: the golden carotenoid (a long conjugated chain)
        const yy = y + 16 + bob;
        glow(x + 16, yy, 28, '#ffd84a', 0.6);
        ctx.strokeStyle = '#c98a00'; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.beginPath();
        for (let i = 0; i <= 8; i++) { const px = x + 2 + i * 3.5, py = yy + (i % 2 ? -4 : 4); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
        ctx.stroke();
        ball(x + 31, yy + 4, 4.5, '#fff6b0', '#f3c22f', '#b38a00');
        for (let k = 0; k < 3; k++) { const a = e.t * 0.06 + k * TAU / 3; circle(x + 16 + Math.cos(a) * 16, yy + Math.sin(a) * 12, 1.8, '#fff3a0'); }
        break;
      }
      case 'spring': { // a swollen cell: squishes when it throws you
        const s = e.sq > 0 ? Math.sin(e.sq / 14 * Math.PI) : 0, X = x + 16, base = y + TILE;
        const rx = 15 + s * 4, ry = 10 - s * 4;
        ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(X, base, 15, 3, 0, 0, TAU); ctx.fill();
        const g = ctx.createRadialGradient(X - 5, base - ry - 4, 2, X, base - ry, rx);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#ffe7a8'); g.addColorStop(1, '#e0a52e');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(X, base - ry, rx, ry, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#b07a10'; ctx.lineWidth = 2; ctx.stroke();
        ctx.strokeStyle = 'rgba(176,122,16,0.6)'; ctx.lineWidth = 1.2;
        for (const dx of [-6, 0, 6]) { ctx.beginPath(); ctx.moveTo(X + dx - 2, base - ry - 2); ctx.lineTo(X + dx + 2, base - ry - 2); ctx.stroke(); }
        break;
      }
      case 'omv': { // outer membrane vesicle: a double-membrane bubble with cargo
        const X = x + 16, Y = y + 16;
        ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.ellipse(X, (surfaceBelow(X, y + 27) || Y + 12) + 1, 9, 2.5, 0, 0, TAU); ctx.fill();
        const g = ctx.createRadialGradient(X - 4, Y - 5, 1, X, Y, 12);
        g.addColorStop(0, 'rgba(255,255,255,0.8)'); g.addColorStop(0.6, 'rgba(160,190,240,0.55)'); g.addColorStop(1, 'rgba(90,120,200,0.8)');
        circle(X, Y, 12, g);
        ctx.strokeStyle = '#4b63b5'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X, Y, 12, 0, TAU); ctx.stroke();
        ctx.strokeStyle = 'rgba(75,99,181,0.6)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(X, Y, 9, 0, TAU); ctx.stroke();
        for (const [dx, dy, c] of [[-3, 2, '#e0465a'], [3, -2, '#2b6fd0'], [2, 4, '#9cc21e']]) circle(X + dx, Y + dy, 2, c);
        break;
      }
      case 'lasb': { // LasB elastase: a zinc protease (teal) with jaws
        const X = e.cx, Y = e.cy, dir = e.face || 1;
        ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.ellipse(X, Y + 22, 12, 3, 0, 0, TAU); ctx.fill();
        ball(X, Y, 12, '#a8efe5', '#2f8f86', '#124a45');
        ctx.fillStyle = '#e9f5f3';
        const open = Math.abs(Math.sin(e.t * 0.25)) * 0.5;
        for (const sgn of [-1, 1]) {
          ctx.save(); ctx.translate(X + dir * 9, Y + 2); ctx.rotate(sgn * (0.35 + open) * dir);
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(dir * 11, sgn * 2); ctx.lineTo(dir * 3, sgn * 5); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
        circle(X - dir * 2, Y + 4, 3.2, '#b9c2c9'); text('Zn', X - dir * 2, Y + 6, { size: 5, color: '#333', align: 'center', weight: '900' });
        circle(X + dir * 3, Y - 4, 2.8, '#fff'); circle(X + dir * 4, Y - 3.5, 1.4, '#111');
        // little wings of motion so it reads as flying
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5;
        for (const k of [0, 1]) { ctx.beginPath(); ctx.moveTo(X - dir * (14 + k * 5), Y - 3 + k * 6); ctx.lineTo(X - dir * (20 + k * 5), Y - 3 + k * 6); ctx.stroke(); }
        text('LasB', X, Y - 15, { size: 8, color: '#124a45', align: 'center', weight: '900' });
        break;
      }
      case 'geyser': { // rhamnolipid foam well: a pink crater that bubbles, then erupts a column
        const X = x + 16, base = y + TILE, s = foamGeyserState(e);
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(X, base - 1, 14, 3.5, 0, 0, TAU); ctx.fill();
        roundRect(x + 4, base - 8, 24, 8, 4, '#c2457f', '#7d1b4f', 1.5);
        circle(X, base - 6, 4, '#5c0f38');
        if (s.warn) {
          const k = (s.ph - GEYSER_WARN) / (GEYSER_UP - GEYSER_WARN);
          glow(X, base - 8, 18 + k * 10, '#e0458f', 0.35 + k * 0.25);
          for (let i = 0; i < 4; i++) {
            const bx = X - 9 + i * 6 + Math.sin(e.t * 0.4 + i) * 1.5, by = base - 10 - ((e.t * 1.3 + i * 7) % (8 + k * 14));
            ball(bx, by, 2.5 + k * 1.5, '#ffe0ef', '#e86aa9', '#9c2763');
          }
          if (Math.floor(e.t / 6) % 2 === 0) text('!', X, base - 28 - k * 6, { size: 15, color: '#c2185b', align: 'center', weight: '900' });
        } else if (s.height > 0) {
          glow(X, base - s.height / 2, 20 + s.height * 0.3, '#e0458f', 0.3);
          for (let yy = 0; yy < s.height; yy += 9) {
            const sway = Math.sin(e.t * 0.25 + yy * 0.15) * 3, r = 7 - (yy / (e.h * TILE)) * 2.5;
            ball(X - 5 + sway, base - 6 - yy, r, '#ffe0ef', '#e86aa9', '#9c2763');
            ball(X + 5 - sway, base - 10 - yy, r - 1, '#ffe0ef', '#e86aa9', '#9c2763');
          }
          ball(X, base - s.height - 2, 8, '#fff0f7', '#f08cbf', '#a32a68');
        } else for (let k = 0; k < 2; k++) circle(X - 3 + k * 6, base - 9 - ((e.t * 0.3 + k * 9) % 10), 1.8, 'rgba(240,140,190,0.7)');
        break;
      }
      case 'drift': { // a drifting clump of rhamnolipid foam
        const X = e.cx, Y = e.cy;
        glow(X, Y, 26, '#e0458f', 0.3);
        for (const [dx, dy, r] of [[-7, 3, 7], [6, 4, 7.5], [0, -5, 8], [-2, 7, 5], [9, -3, 5]]) {
          const w = Math.sin(e.t * 0.12 + dx) * 1.2;
          ball(X + dx + w, Y + dy - w, r, '#ffe0ef', '#e86aa9', '#9c2763');
        }
        const rise = (e.t * 0.5) % 20;
        ctx.strokeStyle = `rgba(232,106,169,${0.7 - rise / 28})`; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(X + 4, Y - 12 - rise, 2.2, 0, TAU); ctx.stroke();
        break;
      }
      case 'hcn': { // a vent that puffs hydrogen cyanide
        const X = x + 16, base = y + TILE;
        roundRect(x + 6, base - 7, 20, 7, 3, '#6d6a7a', '#4a4756', 1.2);
        circle(X, base - 6, 3.5, '#2b2833');
        const ph = e.t % 220;
        if (e.active || e.warn) {
          const k = e.active ? Math.min(1, (ph - 140) / 20) : (ph - 110) / 30 * 0.3;
          for (let i = 0; i < 6; i++) {
            const a = i * 1.1 + e.t * 0.03, rr = (14 + i * 3) * k + 4;
            const px = X + Math.sin(a) * 14 * k, py = base - 14 - i * 9 * k;
            const g = ctx.createRadialGradient(px, py, 0, px, py, rr);
            g.addColorStop(0, `rgba(205,195,225,${0.55 * (e.active ? 1 : 0.6)})`); g.addColorStop(1, 'rgba(205,195,225,0)');
            circle(px, py, rr, g);
          }
          if (e.active) text('HCN', X, base - 40, { size: 12, color: '#4a3d6a', align: 'center', weight: '900' });
          else text('!', X, base - 16, { size: 14, color: '#7a5db0', align: 'center', weight: '900' });
        } else for (let k = 0; k < 2; k++) circle(X + Math.sin(e.t * 0.05 + k * 3) * 3, base - 10 - ((e.t * 0.4 + k * 10) % 18), 2, 'rgba(205,195,225,0.5)');
        break;
      }
      case 'pa': case 'twitch': { // living P. aeruginosa: a rod with a flagellum (pa) or pili (twitch)
        const swim = e.type === 'pa';
        const X = swim ? e.cx : e.x + 16, Y = swim ? e.cy : e.y + 24;
        const ang = swim ? e.ang : (e.dir > 0 ? 0 : Math.PI);
        ctx.save(); ctx.translate(X, Y); ctx.rotate(ang);
        if (swim) {
          ctx.strokeStyle = 'rgba(70,110,50,0.8)'; ctx.lineWidth = 1.6; ctx.beginPath();
          for (let k = 0; k <= 16; k++) { const px = -14 - k * 1.3, py = Math.sin(k * 0.8 - e.t * 0.4) * 3; if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
          ctx.stroke();
        } else {
          ctx.strokeStyle = 'rgba(70,110,50,0.7)'; ctx.lineWidth = 1;
          const ext = e.t % 50 < 16 ? 4 : 9;
          for (const dy of [-3, 0, 3]) { ctx.beginPath(); ctx.moveTo(14, dy); ctx.lineTo(14 + ext, dy * 1.6); ctx.stroke(); }
        }
        const g = ctx.createLinearGradient(0, -7, 0, 7);
        g.addColorStop(0, '#b8e6a2'); g.addColorStop(0.5, '#5fae4f'); g.addColorStop(1, '#2f6b28');
        roundRect(-14, -7, 28, 14, 7, g, '#24521f', 1.5);
        ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.ellipse(-3, -3.5, 7, 1.6, 0, 0, TAU); ctx.fill();
        circle(7, -1, 2.6, '#fff'); circle(8, -1, 1.3, '#111');
        ctx.restore();
        break;
      }
      case 'boss': drawBoss(e); break;
      case 'glob': {
        const g = ctx.createRadialGradient(x + 13, y + 13, 1, x + 16, y + 16, 8);
        g.addColorStop(0, '#cfe3ff'); g.addColorStop(1, '#1f63c0');
        glow(x + 16, y + 16, 14, '#2b6fd0', 0.4); circle(x + 16, y + 16, 7, g);
        break;
      }
      case 'rosgun': { // pyocyanin redox launcher: a barrel with phenazine rings
        const X = x + 16, base = y + TILE, f = e.face || 1, ready = e.cool < 30;
        roundRect(x + 3, base - 10, 26, 10, 3, '#3a4660', '#232b3d', 1.5);
        roundRect(x + 2, y + 4, 28, 20, 8, '#2d4f8a', '#1a2f57', 2);
        roundRect(X + f * 10 - 5, y + 8, 10, 12, 3, '#1a2f57');
        ctx.fillStyle = 'rgba(120,170,255,0.45)'; ctx.strokeStyle = '#9cc2ff'; ctx.lineWidth = 1.2;
        for (const dx of [-6, 0, 6]) { hexagon(X - f * 2 + dx, y + 14, 3.6, Math.PI / 6); ctx.fill(); ctx.stroke(); }
        if (ready) glow(X + f * 16, y + 14, 14, '#ff7a3c', 0.3 + 0.3 * Math.sin(e.t * 0.4));
        break;
      }
      case 'rosb': { // superoxide radical: a hot O2 with an unpaired electron and a trail
        const X = x + 16, Y = y + 16, d = Math.sign(e.vx) || 1;
        for (let k = 1; k <= 5; k++) circle(X - d * k * 5, Y + Math.sin(e.t * 0.5 + k) * 1.5, 6 - k, `rgba(255,${120 + k * 20},60,${0.5 - k * 0.08})`);
        glow(X, Y, 18, '#ff5a2a', 0.45);
        ball(X - 4, Y, 6.5, '#ffe0c8', '#ff6a3a', '#b3261e'); ball(X + 4, Y, 6.5, '#ffe0c8', '#ff6a3a', '#b3261e');
        text('O₂', X, Y + 3.5, { size: 8, color: '#fff', align: 'center', weight: '900' });
        circle(X + d * 10, Y - 6, 2.3, '#fff8a0');   // the unpaired electron (the "•" in O₂•⁻)
        break;
      }
      case 'arrow': { // a glowing trail of arrows: this way
        const ang = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[e.dir] || 0;
        ctx.save(); ctx.translate(x + 16, y + 16); ctx.rotate(ang);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (let k = 0; k < 3; k++) {
          const a = 0.25 + 0.75 * ((k / 3 - e.t * 0.02) % 1 + 1) % 1;
          ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 3.5;
          ctx.beginPath(); ctx.moveTo(-9 + k * 8, -7); ctx.lineTo(-3 + k * 8, 0); ctx.lineTo(-9 + k * 8, 7); ctx.stroke();
        }
        ctx.restore();
        break;
      }
    }
  }
}
function drawShotsAndBubbles() {
  for (const s of L.shots) { // PSM shots: small pink helices with a trail
    for (let k = 1; k <= 3; k++) circle(s.x - s.vx * k * 0.8, s.y - s.vy * k * 0.8, 4 - k, `rgba(232,138,208,${0.5 - k * 0.12})`);
    ball(s.x, s.y, 5, '#ffe0f4', '#e05fb8', '#8a1f6a');
  }
  for (const b of L.movers) { // air bubbles
    const s = Math.min(1, b.t / 12), r = b.r * s, X = b.x + Math.sin(b.t * 0.06) * 2, Y = b.y;
    const g = ctx.createRadialGradient(X - r * 0.3, Y - r * 0.35, r * 0.1, X, Y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.5)'); g.addColorStop(0.7, 'rgba(200,235,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0.45)');
    circle(X, Y, r, g);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(X, Y, r, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.ellipse(X - r * 0.4, Y - r * 0.45, r * 0.22, r * 0.12, -0.6, 0, TAU); ctx.fill();
  }
}

// The mucoid colony: a wobbling alginate gel with rod-shaped cells inside.
function drawBoss(e) {
  const t = e.t, X = e.bx, B = e.by + e.jy, dead = e.state === 'dead';
  ctx.save();
  if (dead) ctx.globalAlpha = Math.max(0, 1 - e.timer / 90);
  else if (e.hitT > 0 && e.hitT % 4 < 2) ctx.globalAlpha = 0.55;
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(X, e.by + 1, 46 - Math.min(20, -e.jy / 6), 7, 0, 0, TAU); ctx.fill();
  const w = 50 + Math.sin(t * 0.08) * 3, h = 38 + Math.cos(t * 0.08) * 3, cy = B - h;
  // the colony inside
  if (e.open > 0) glow(X, cy, 34, '#ff6a8a', 0.5 * e.open + 0.15 * Math.sin(t * 0.3) * e.open);
  for (let k = 0; k < 9; k++) {
    const a = k * TAU / 9 + t * 0.01, r = 10 + (k % 3) * 9;
    ctx.save(); ctx.translate(X + Math.cos(a) * r * 1.3, cy + Math.sin(a) * r * 0.8); ctx.rotate(a + t * 0.02);
    roundRect(-8, -3.5, 16, 7, 3.5, '#5fae4f', '#2f6b28', 1);
    ctx.restore();
  }
  // the alginate shell (thins out when "open")
  const g = ctx.createRadialGradient(X - 16, cy - 14, 4, X, cy, w);
  g.addColorStop(0, `rgba(230,255,200,${0.75 - 0.5 * e.open})`); g.addColorStop(1, `rgba(110,170,60,${0.85 - 0.55 * e.open})`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(X, cy, w, h, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(60,110,40,0.9)'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.ellipse(X - 18, cy - 20, 14, 6, -0.4, 0, TAU); ctx.fill();
  // eyes
  const look = P ? Math.sign((P.x + P.w / 2) - X) * 4 : 0;
  for (const dx of [-14, 14]) {
    circle(X + dx, cy - 6, 7, '#fff'); circle(X + dx + look, cy - 5, 3.5, '#13240d');
    ctx.strokeStyle = '#2b4a1c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(X + dx - 8, cy - 16 + (dx < 0 ? 0 : 3)); ctx.lineTo(X + dx + 8, cy - 16 + (dx < 0 ? 3 : 0)); ctx.stroke();
  }
  if (e.open > 0.6 && !dead) text('↓ stomp!', X, cy - h - 10 + Math.sin(t * 0.2) * 3, { size: 14, color: '#ff4d6d', align: 'center', weight: '900' });
  ctx.restore();
}

function drawFx() {
  for (const p of L.fx) drawFxParticle(p);
  ctx.globalAlpha = 1;
  ctx.font = `900 15px ${FONT}`; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
  for (const p of L.pops) {
    ctx.globalAlpha = Math.min(1, p.life / 20);
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,20,30,0.6)'; ctx.strokeText(p.text, p.x, p.y);
    ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;
  drawCallouts();
}

// A stamped name where an enemy was defeated: it punches in large, settles, then fades.
function drawCallouts() {
  for (const c of L.callouts) {
    const age = c.max - c.life, s = age < 10 ? 1 + Math.pow(1 - age / 10, 2) * 1.1 : 1;
    ctx.save();
    ctx.globalAlpha = Math.min(1, c.life / 22);
    ctx.translate(c.x, c.y); ctx.rotate(c.tilt); ctx.scale(s, s);
    ctx.font = `900 19px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    const w = ctx.measureText(c.text).width;
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(16,12,24,0.85)'; ctx.strokeText(c.text, 0, 0);
    ctx.fillStyle = c.color; ctx.fillText(c.text, 0, 0);
    // a slash drawn across the name in the first few frames
    const k = Math.min(1, age / 9);
    ctx.lineCap = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(16,12,24,0.85)';
    ctx.beginPath(); ctx.moveTo(-w / 2 - 6, -3); ctx.lineTo(-w / 2 - 6 + (w + 12) * k, -9); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(-w / 2 - 6, -3); ctx.lineTo(-w / 2 - 6 + (w + 12) * k, -9); ctx.stroke();
    ctx.font = `900 10px ${FONT}`; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(16,12,24,0.8)';
    ctx.strokeText('NEUTRALISED', 0, 13); ctx.fillStyle = '#fff'; ctx.fillText('NEUTRALISED', 0, 13);
    ctx.restore();
  }
}

// "PART 2" title card after the gate: slides in, holds, then fades.
function drawStageBanner() {
  if (!(L.bannerT > 0)) return;
  const age = 200 - L.bannerT, slide = Math.pow(Math.max(0, 1 - age / 18), 3) * -VIEW_W;
  ctx.save();
  ctx.globalAlpha = Math.min(1, L.bannerT / 30);
  ctx.translate(slide, 0);
  roundRect(VIEW_W / 2 - 230, 170, 460, 86, 18, 'rgba(10,31,43,0.88)', L.def.theme.accent, 3);
  ctx.font = `900 40px ${FONT}`; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
  ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.strokeText(`${L.def.name} · PART ${L.stage + 1}`, VIEW_W / 2, 220);
  ctx.fillStyle = '#fff3c4'; ctx.fillText(`${L.def.name} · PART ${L.stage + 1}`, VIEW_W / 2, 220);
  text(L.def.part2Title, VIEW_W / 2, 244, { size: 15, color: '#c3ffdf', align: 'center', weight: '800' });
  // split time for part 1, green when ahead of your personal best, red when behind
  const split = L.splits[L.stage - 1];
  if (Number.isFinite(split) && age > 14) {
    const d = L.splitDelta, s = age < 24 ? 1 + Math.pow(1 - (age - 14) / 10, 2) * 0.8 : 1;
    ctx.save(); ctx.translate(VIEW_W / 2, 278); ctx.scale(s, s);
    roundRect(-120, -18, 240, 28, 14, 'rgba(10,31,43,0.9)', d === null ? '#c3ffdf' : d <= 0 ? '#5fe38a' : '#ff7a7a', 2);
    text(`part ${L.stage} split ${fmtTime(split)}${d === null ? '' : '  ' + fmtDelta(d)}`, 0, 1, { size: 15, color: d === null ? '#fff' : d <= 0 ? '#9dffbd' : '#ffb3b3', align: 'center', weight: '900' });
    ctx.restore();
  }
  ctx.restore();
}

// HUD log of what you defeated, newest on top; repeats of the same enemy stack as ×n.
function drawKillFeed() {
  let y = 112;   // below the cough warning (CF) and the exposure panel (SNpulse)
  for (const k of L.killFeed) {
    const slide = Math.pow(Math.max(0, 1 - k.age / 14), 3) * 260;
    const label = k.name;
    ctx.font = `800 13px ${FONT}`;
    const w = ctx.measureText(label).width + (k.n > 1 ? 74 : 44);
    const x = VIEW_W - 16 - w + slide, s = 1 + (k.bump / 12) * 0.12;
    ctx.save();
    ctx.globalAlpha = Math.min(1, k.life / 30);
    ctx.translate(x + w / 2, y + 12); ctx.scale(s, s); ctx.translate(-w / 2, -12);
    roundRect(0, 0, w, 24, [12, 4, 4, 12], 'rgba(14,26,36,0.86)');
    roundRect(w - 4, 0, 4, 24, [0, 4, 4, 0], k.color);
    circle(14, 12, 8, k.color);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(10.5, 8.5); ctx.lineTo(17.5, 15.5); ctx.moveTo(17.5, 8.5); ctx.lineTo(10.5, 15.5); ctx.stroke();
    text(label, 28, 17, { size: 13, color: '#fff', weight: '800' });
    if (k.n > 1) {
      const bx = w - 38;
      roundRect(bx, 4, 28, 16, 8, k.color);
      text(`×${k.n}`, bx + 14, 16, { size: 12, color: '#10141c', align: 'center', weight: '900' });
    }
    ctx.restore();
    y += 28;
  }
}

function drawPlayer() {
  if (P.inv > 0 && Math.floor(P.inv / 5) % 2 === 0) return;  // blink after a hit
  const S = STRAINS[G.strain];
  const cx = P.x + P.w / 2, cy = P.y + P.h / 2;
  // soft shadow on the surface below, smaller and fainter the higher you are
  const sy = surfaceBelow(cx, P.y + P.h);
  if (sy !== null) {
    const k = Math.max(0, 1 - (sy - P.y - P.h) / 240);
    ctx.fillStyle = `rgba(0,0,0,${0.3 * k})`;
    ctx.beginPath(); ctx.ellipse(cx, sy + 1, 13 * (0.45 + 0.55 * k), 3.6 * (0.45 + 0.55 * k), 0, 0, TAU); ctx.fill();
  }
  if (P.magnet > 0) {
    ctx.save(); ctx.setLineDash([5, 6]); ctx.lineDashOffset = -L.time * 0.6;
    ctx.strokeStyle = 'rgba(230,180,40,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 26, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  if (P.gold > 0) {   // staphyloxanthin glow
    glow(cx, cy, 34, '#ffd84a', 0.55 + 0.15 * Math.sin(L.time * 0.2));
    for (let k = 0; k < 4; k++) { const a = L.time * 0.08 + k * TAU / 4; circle(cx + Math.cos(a) * 22, cy + Math.sin(a) * 22, 2, '#fff3a0'); }
  }
  if (P.dash > 0) {
    for (let i = 3; i > 0; i--) {
      ctx.save(); ctx.globalAlpha = (4 - i) * 0.12;
      drawCoccus(cx - P.face * i * 13, cy, 14, S.colour, { face: P.face, squash: 0.18 }); ctx.restore();
    }
  }
  const fastFall = !P.onGround && P.vy > 7;
  const stretch = !P.onGround && P.vy < -2 ? -Math.min(0.17, Math.abs(P.vy) * 0.015) : fastFall ? -Math.min(0.15, (P.vy - 7) * 0.035) : 0;
  const breathe = P.onGround && Math.abs(P.vx) < 0.2 ? Math.sin(L.time * 0.065) * 0.025 : 0;
  if (fastFall) {   // speed lines above a fast-falling cell
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    for (const dx of [-9, 0, 9]) { const len = 8 + (P.vy - 7) * 3 + ((L.time * 3 + dx * 7) % 6); ctx.beginPath(); ctx.moveTo(cx + dx, cy - 20 - len); ctx.lineTo(cx + dx, cy - 18); ctx.stroke(); }
  }
  const rot = P.spin > 0 ? (1 - P.spin / 18) * TAU * P.face : 0;
  drawCoccus(cx, cy, 14, S.colour, { face: P.face, slow: P.slow > 0, squash: P.squash + stretch + breathe, roll: P.roll, blink: L.time % 240 < 8 || P.shootFlash > 6, mood: playerMood(), look: P.look, rot });
  if (playerSweats()) {   // a sweat drop slides down when time or the front is close
    const k = (L.time % 50) / 50, sx = cx + 13 * P.face * -1, sy = cy - 12 + k * 10;
    ctx.globalAlpha = 1 - k * 0.6;
    ctx.fillStyle = '#bfe8ff'; ctx.beginPath(); ctx.moveTo(sx, sy - 5); ctx.quadraticCurveTo(sx + 3.5, sy + 1, sx, sy + 3); ctx.quadraticCurveTo(sx - 3.5, sy + 1, sx, sy - 5); ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (P.phos > 12) {
    const k = 1 - (P.phos - 12) / 18;
    ctx.strokeStyle = `rgba(222,255,247,${1 - k})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(cx, cy + 8, 20 + k * 19, 7 + k * 8, 0, 0, TAU); ctx.stroke();
  }
  if (P.shield > 0) {
    circle(cx, cy, 22, 'rgba(90,160,255,0.16)');
    ctx.strokeStyle = 'rgba(110,175,255,0.85)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 22, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(cx, cy, 18, -2.4 + L.time * 0.03, -1.6 + L.time * 0.03); ctx.stroke();
  }
  if (P.phos > 0) {
    circle(cx + 13, cy - 15, 7, '#7b3fb5');
    text('P', cx + 13, cy - 11, { size: 10, color: '#fff', align: 'center', weight: '800' });
  }
  if (P.slow > 0) text('z', cx + 15, cy - 12 - (L.time % 30) / 3, { size: 13, color: '#355a1a', weight: '800' });
  if (P.dizzy > 0) {   // dizzy after a hit: little stars circling the head
    ctx.globalAlpha = Math.min(1, P.dizzy / 20);
    for (let k = 0; k < 3; k++) {
      const a = L.time * 0.18 + k * TAU / 3, sx = cx + Math.cos(a) * 15, sy = cy - 19 + Math.sin(a) * 4;
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(L.time * 0.2);
      ctx.fillStyle = '#fff3a0'; ctx.beginPath();
      for (let i = 0; i < 8; i++) { const rr = i % 2 ? 1.6 : 4; ctx.lineTo(Math.cos(i * Math.PI / 4) * rr, Math.sin(i * Math.PI / 4) * rr); }
      ctx.closePath(); ctx.fill(); ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}

function drawHUD() {
  const S = STRAINS[G.strain], W = '#f4f1ea', dim = 'rgba(244,241,234,0.6)';
  roundRect(10, 8, VIEW_W - 20, 40, 14, 'rgba(14,26,36,0.78)');
  drawCoccus(32, 28, 10, S.colour, { face: 1 });
  text(`${S.label} · ${L.def.name}`, 50, 34, { size: 15, color: W, weight: '800' });
  // Replicates: three little culture flasks. A lost one is empty and flashes red.
  // The flasks shake for a moment when one is lost.
  const shakeX = P.repFlash > 30 ? Math.sin(P.repFlash * 1.3) * (P.repFlash - 30) * 0.18 : 0;
  for (let i = 0; i < L.maxReps; i++) drawFlask(192 + i * 24 + shakeX, 29, i < P.reps, i === P.reps && P.repFlash > 0 ? P.repFlash : 0);
  text(`n = ${P.reps}`, 236, 34, { size: 12, color: P.reps < L.maxReps ? '#ffb3a8' : dim, weight: '800' });
  const bump = (kind, x, y, fn) => { const k = hudScale(kind); ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.translate(-x, -y); fn(); ctx.restore(); };
  bump('cys', 300, 28, () => drawCystineIcon(300, 28, 0.62));
  const cg = L.def.goals.find(g => g.id === 'cys');
  text(`${L.cystine}${cg ? '/' + cg.n : ''}`, 318, 34, { size: 15, color: cg && L.cystine >= cg.n ? '#8be28f' : W, weight: '800' });
  bump('iron', 372, 28, () => drawIronIcon(372, 28, 0.75));
  for (let i = 0; i < 3; i++) circle(390 + i * 12, 28, 4, i < L.ironBank ? '#e0743c' : 'rgba(255,255,255,0.22)');
  // glycerol stocks saved (checkpoints) out of the level's total
  roundRect(434, 18, 8, 20, [1, 1, 4, 4], 'rgba(235,245,255,0.85)', 'rgba(255,255,255,0.7)', 1);
  roundRect(435, 28, 6, 9, [0, 0, 3, 3], L.stocks ? '#f3c22f' : '#9aa6b2');
  roundRect(432.5, 14, 11, 5, 1.5, L.stocks ? '#2eaa5c' : '#8a96a3');
  text(`${L.stocks}/${L.totalStocks}`, 450, 34, { size: 15, color: W, weight: '800' });
  bump('score', 540, 28, () => text(`score ${Math.round(L.shownScore || G.score + L.points)}`, 500, 34, { size: 15, color: hudScale('score') > 1.05 ? '#ffe27a' : W, weight: '700' }));
  let x = 620;
  const chip = (label, col) => {
    ctx.font = `800 12px ${FONT}`;
    const w = ctx.measureText(label).width + 16;
    roundRect(x, 17, w, 22, 11, col); text(label, x + w / 2, 32, { size: 12, color: '#fff', align: 'center', weight: '800' });
    x += w + 6;
  };
  if (L.comboT > 0 && L.combo > 1) chip(`combo x${Math.min(L.combo, 5)}`, '#c2410c');
  if (P.shield > 0) chip('AhpC', '#3a7bd5');
  if (P.magnet > 0) chip(L.mods.magnet ? 'TcyA ∞' : `TcyA ${Math.ceil(P.magnet / 60)}`, '#b38600');
  if (G.mode === 'daily') chip(`daily · ${G.daily.mod.label}`, '#7c3aed');
  if (P.slow > 0) chip('HQNO', '#4f7f2a');
  if (P.ammo > 0) chip(`PSM ${P.ammo}`, '#b0408f');
  if (P.gold > 0) chip(`xanthin ${Math.ceil(P.gold / 60)}`, '#c99512');
  if (L.def.endless) drawLogHUD();
  else if (L.timeLimit) {
    // Game seconds left, scaled so the whole limit shows as 15 pulse minutes.
    const left = Math.max(0, L.timeLimit - L.time / 60) * PULSE_S / L.timeLimit;
    const mm = Math.floor(left / 60), ss = Math.floor(left % 60), urgent = left < 120;
    roundRect(VIEW_W - 152, 14, 132, 28, 14, urgent ? '#b3261e' : 'rgba(255,255,255,0.12)');
    ctx.strokeStyle = urgent ? '#fff' : '#7fc4ff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(VIEW_W - 134, 28, 8, -Math.PI / 2, -Math.PI / 2 + TAU * left / PULSE_S); ctx.stroke();
    text(`pulse ${mm}:${String(ss).padStart(2, '0')}`, VIEW_W - 30, 34, { size: 15, color: '#fff', align: 'right', weight: '800' });
  } else {
    // elapsed time, coloured by the medal you are still on track for
    const secs = runSecs(), m = G.mode === 'story' ? medalFor(L.def, secs) : null;
    roundRect(VIEW_W - 132, 14, 112, 28, 14, 'rgba(255,255,255,0.12)');
    circle(VIEW_W - 116, 28, 7, m ? m[1] : 'rgba(255,255,255,0.25)');
    text(fmtTime(secs), VIEW_W - 30, 34, { size: 15, color: '#fff', align: 'right', weight: '800' });
  }
  // inhaled antibiotic warning / wave (CF)
  if (L.abWarn > 0 || L.abOn > 0) {
    const on = L.abOn > 0, blink = Math.floor(L.time / 8) % 2 === 0;
    if (on || blink) {
      roundRect(VIEW_W / 2 - 170, VIEW_H - 78, 340, 28, 14, on ? (L.covered ? 'rgba(27,127,59,0.85)' : 'rgba(179,38,30,0.9)') : 'rgba(30,110,120,0.85)');
      text(on ? (L.covered ? 'antibiotic mist: you are covered ✓' : 'antibiotic mist: get under a floor!') : `antibiotic in ${Math.ceil(L.abWarn / 60)} s: take cover!`,
        VIEW_W / 2, VIEW_H - 59, { size: 14, color: '#fff', align: 'center', weight: '800' });
    }
  }
  // boss health
  const boss = L.bossActive && L.ents.find(e => e.type === 'boss' && e.alive && e.state !== 'dead');
  if (boss) {
    text('mucoid P. aeruginosa colony', VIEW_W / 2, VIEW_H - 40, { size: 13, color: '#fff', align: 'center', weight: '800' });
    roundRect(VIEW_W / 2 - 150, VIEW_H - 32, 300, 14, 7, 'rgba(14,26,36,0.75)');
    roundRect(VIEW_W / 2 - 148, VIEW_H - 30, 296 * Math.max(0, boss.hp) / boss.maxHp, 10, 5, boss.open > 0.6 ? '#ff8aa0' : '#7bd34a');
  }
  // cough warning / cough
  if (L.coughWarn > 0 && Math.floor(L.coughWarn / 8) % 2 === 0) {
    roundRect(VIEW_W - 230, 54, 210, 28, 14, 'rgba(179,38,30,0.85)');
    text('⚠ the patient is about to cough', VIEW_W - 125, 73, { size: 13, color: '#fff', align: 'center', weight: '800' });
  }
  if (L.coughFlash > 0) {
    ctx.save(); ctx.globalAlpha = L.coughFlash / 45;
    ctx.fillStyle = 'rgba(255,240,240,0.25)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.font = `900 ${60 + (45 - L.coughFlash)}px ${FONT}`; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    ctx.lineWidth = 8; ctx.strokeStyle = '#7a1f2b'; ctx.strokeText('COUGH!', VIEW_W / 2, 200);
    ctx.fillStyle = '#ffe3e3'; ctx.fillText('COUGH!', VIEW_W / 2, 200);
    ctx.restore();
  }
  if (G.toastT > 0 && G.toast) {
    const lines = wrap(G.toast, 560, 16);
    const h = lines.length * 22 + 16;
    ctx.globalAlpha = Math.min(1, G.toastT / 30);
    roundRect(VIEW_W / 2 - 285, 58, 570, h, 12, 'rgba(14,26,36,0.94)');
    roundRect(VIEW_W / 2 - 300, 58, 5, h, [12, 0, 0, 12], rgba(S.colour, 0.8));
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 4;
    lines.forEach((ln, i) => text(ln, VIEW_W / 2 + 3, 81 + i * 22, { size: 16, color: '#fff', align: 'center' }));
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

function panel({ title, sub = '', lines = [], footer = '', accent = '#2b5d8a', bodyY = 196, lineH = 28 }) {
  ctx.fillStyle = 'rgba(8,20,28,0.62)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 8;
  roundRect(130, 60, 700, 420, 18, '#fbf8f1');
  ctx.restore();
  roundRect(130, 60, 700, 92, [18, 18, 0, 0], accent);
  ctx.globalAlpha = 0.18;
  for (let i = 0; i < 7; i++) circle(170 + i * 105, 60 + 46 + Math.sin(i * 1.7) * 18, 26 + (i % 3) * 8, '#ffffff');
  ctx.globalAlpha = 1;
  text(title, VIEW_W / 2, 108, { size: 32, color: '#fff', align: 'center', weight: '800' });
  if (sub) text(sub, VIEW_W / 2, 136, { size: 16, color: 'rgba(255,255,255,0.88)', align: 'center' });
  lines.forEach((ln, i) => text(ln, VIEW_W / 2, bodyY + i * lineH, { size: lineH < 28 ? 16 : 17, color: /^[•★]/.test(ln) ? '#1d3f5e' : '#2b2b2b', align: 'center', weight: /^[•★]/.test(ln) ? '700' : '500' }));
  if (footer) {
    ctx.globalAlpha = 0.55 + 0.45 * Math.sin(performance.now() / 260);
    text(footer, VIEW_W / 2, 455, { size: 16, color: accent, align: 'center', weight: '700' });
    ctx.globalAlpha = 1;
  }
}

// The level's goal checklist, bottom-left. Required goals first, ★ = bonus goal.
function drawGoalList() {
  const gs = L.def.goals.map(g => ({ g, s: goalStatus(g) }));
  ctx.font = `700 12px ${FONT}`;
  const w = Math.max(...gs.map(({ g, s }) => ctx.measureText(`☐ ${s.text}${g.req ? '' : '  ★'}`).width)) + 22;
  const h = gs.length * 20 + 12, y0 = VIEW_H - h - 34;
  roundRect(10, y0, w + 24, h, 10, 'rgba(14,26,36,0.9)');
  gs.forEach(({ g, s }, i) => text(`${s.done ? '☑' : '☐'} ${s.text}${g.req ? '' : '  ★'}`, 20, y0 + 21 + i * 20, { size: 13, color: s.done ? '#9be89f' : '#f4f1ea', weight: '700' }));
}
function goalLines(def) {
  return def.goals.map(g => `${g.req ? '•' : '★'} ${g.id === 'time' ? goalStatus(g).text : g.label}${g.req ? '' : ' (bonus star)'}`);
}

function drawStars(stars, labels, y) {
  stars.forEach((on, i) => {
    const x = VIEW_W / 2 + (i - (stars.length - 1) / 2) * 160;
    if (on) glow(x, y, 34, '#f3c22f', 0.35);
    star(x, y, 22, on);
    text(labels[i], x, y + 42, { size: 13, color: on ? '#5a4500' : '#9a9384', align: 'center', weight: '700' });
  });
}

function drawPauseMenu() {
  ctx.fillStyle = 'rgba(8,20,28,0.6)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 8;
  roundRect(VIEW_W / 2 - 210, 66, 420, 420, 18, 'rgba(251,248,241,0.96)');
  ctx.restore();
  roundRect(VIEW_W / 2 - 210, 66, 420, 84, [18, 18, 0, 0], '#2b5d8a');
  drawCoccus(VIEW_W / 2 - 150, 108, 15, STRAINS[G.strain].colour, { face: 1 });
  text('Paused', VIEW_W / 2 + 10, 116, { size: 32, color: '#fff', align: 'center', weight: '800' });
  menuRects().forEach((r, i) => {
    const sel = i === G.menuIdx, label = menuItems()[i];
    roundRect(r.x, r.y, r.w, r.h, 12, sel ? '#2b5d8a' : 'rgba(43,93,138,0.08)', sel ? null : 'rgba(43,93,138,0.25)', 1.5);
    text(label, r.x + r.w / 2, r.y + 24, { size: 17, color: sel ? '#fff' : '#22303c', align: 'center', weight: sel ? '800' : '600' });
    if (sel) text('▶', r.x + 18, r.y + 24, { size: 14, color: '#fff', weight: '900' });
  });
  text('↑ ↓ choose · Enter / Space select · P resume', VIEW_W / 2, 466, { size: 13, color: '#6b6455', align: 'center' });
}

// Title layout, top to bottom: logo, difficulty buttons (HTML, see style.css),
// strain cards, then two panels of equal width: STORY (2 x 2 levels) and
// MORE WAYS TO PLAY (daily, log phase, codex). Everything lines up with the cards.
const TITLE = { left: 90, right: 870, cardsY: 192, cardsH: 128, panelY: 334, panelH: 106, gap: 30 };
// Centred chip text that shrinks until it fits its chip.
function chipText(str, c, color) {
  let size = 13;
  for (; size > 9.5; size -= 0.5) { ctx.font = `800 ${size}px ${FONT}`; if (ctx.measureText(str).width <= c.w - 18) break; }
  text(str, c.x + c.w / 2, c.y + 20, { size, color, align: "center", weight: "800" });
}
function strainCards() {
  return ['anc', 'stk', 'stp'].map((key, i) => ({ key, x: TITLE.left + i * 270, y: TITLE.cardsY, w: 240, h: TITLE.cardsH }));
}
function titlePanels() {
  const w = (TITLE.right - TITLE.left - TITLE.gap) / 2;
  return [
    { title: 'STORY  ·  ↑ ↓ to pick', x: TITLE.left, y: TITLE.panelY, w, h: TITLE.panelH },
    { title: 'MORE WAYS TO PLAY', x: TITLE.left + w + TITLE.gap, y: TITLE.panelY, w, h: TITLE.panelH },
  ];
}
// Chips sit inside the panels: 14 px padding, a 26 px header, two rows of 30 px.
function panelGrid(p) {
  const pad = 14, gap = 8, cw = (p.w - pad * 2 - gap) / 2, rows = [p.y + 30, p.y + 30 + 30 + gap];
  return { pad, gap, cw, rows, full: p.w - pad * 2 };
}
function levelChips() {
  const p = titlePanels()[0], g = panelGrid(p);
  return LEVELS.map((d, i) => ({ i, x: p.x + g.pad + (i % 2) * (g.cw + g.gap), y: g.rows[Math.floor(i / 2)], w: g.cw, h: 30 }));
}
// slot 4 = daily challenge, 5 = log phase, codex = the collection book
function modeChips() {
  const p = titlePanels()[1], g = panelGrid(p), x = p.x + g.pad;
  return [
    { slot: 4, x, y: g.rows[0], w: g.full, h: 30 },
    { slot: 5, x, y: g.rows[1], w: g.cw, h: 30 },
    { slot: 'codex', x: x + g.cw + g.gap, y: g.rows[1], w: g.cw, h: 30 },
  ];
}

// Title background: drifting grape-like clusters of cocci.
const TITLE_BG = (() => {
  const c = document.createElement('canvas');
  c.width = VIEW_W * 2; c.height = VIEW_H;
  const g = c.getContext('2d'), rnd = mulberry32(99);
  for (let i = 0; i < 38; i++) {
    const cx = rnd() * VIEW_W, cy = rnd() * VIEW_H, s = 0.6 + rnd() * 1.4;
    g.globalAlpha = 0.08 + rnd() * 0.12;
    for (let k = 0; k < 9; k++) {
      const a = rnd() * TAU, d = rnd() * 24 * s, r = (10 + rnd() * 5) * s;
      for (const off of [0, VIEW_W]) { g.fillStyle = '#b07a20'; g.beginPath(); g.arc(cx + off + Math.cos(a) * d, cy + Math.sin(a) * d, r, 0, TAU); g.fill(); }
    }
  }
  return c;
})();

function drawTitle() {
  const t = performance.now() / 1000;
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, '#fff3cf'); g.addColorStop(0.6, '#cfe3c9'); g.addColorStop(1, '#6fa9b0');
  ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.drawImage(TITLE_BG, (t * 12) % VIEW_W, 0, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);
  // logo
  ctx.save();
  ctx.font = `900 56px ${FONT}`; ctx.textAlign = 'center';
  ctx.lineJoin = 'round'; ctx.lineWidth = 10; ctx.strokeStyle = '#5a3d00'; ctx.strokeText('JE2 JUMP', VIEW_W / 2, 70);
  const tg = ctx.createLinearGradient(0, 26, 0, 74);
  tg.addColorStop(0, '#fff1a0'); tg.addColorStop(1, '#e0a210');
  ctx.fillStyle = tg; ctx.fillText('JE2 JUMP', VIEW_W / 2, 70);
  ctx.restore();
  drawCoccus(VIEW_W / 2 - 178, 52 + Math.sin(t * 3) * 5, 14, '#0072B2', { face: 1, mood: Math.sin(t * 0.7) > 0.6 ? 'happy' : '' });
  drawCoccus(VIEW_W / 2 + 178, 52 + Math.sin(t * 3 + 1.5) * 5, 14, '#009E73', { face: -1, mood: Math.sin(t * 0.7 + 2) > 0.6 ? 'happy' : '' });
  if (G.rival) {   // a race link was opened: the banner replaces the tagline
    const r = G.rival, msg = `🏁 Rival ghost: ${LEVELS[r.level].name} · ${r.strain} · ${fmtTime(r.secs)} · press Enter to race`;
    ctx.font = `800 13px ${FONT}`;
    const w = ctx.measureText(msg).width + 28;
    roundRect(VIEW_W / 2 - w / 2, 82, w, 24, 12, '#b3261e');
    text(msg, VIEW_W / 2, 99, { size: 13, color: '#fff', align: 'center', weight: '800' });
  } else text('SMALL CELL. BIG REACTION.', VIEW_W / 2, 100, { size: 16, color: '#174953', align: 'center', weight: '900' });
  // (the Study / Normal / Hard buttons are HTML and sit at y 114-168)

  // strains
  const daily = G.titleMode === 'daily' ? dailyChallenge(dayNumber()) : null;
  const label = (str, x, y, align = 'left') => text(str, x, y, { size: 11, color: 'rgba(23,61,70,0.75)', align, weight: '900' });
  label('STRAIN', TITLE.left + 4, TITLE.cardsY - 8);
  label(daily ? `today's strain is fixed: ${daily.strain}` : '1 / 2 / 3 or ← →  ·  click a card to start', TITLE.right - 4, TITLE.cardsY - 8, 'right');
  for (const c of strainCards()) {
    const S = STRAINS[c.key], sel = G.strain === c.key, lift = sel ? -4 : 0, locked = daily && !sel;
    ctx.save();
    if (locked) ctx.globalAlpha = 0.45;
    if (sel) { ctx.shadowColor = rgba(S.colour, 0.45); ctx.shadowBlur = 22; ctx.shadowOffsetY = 5; }
    roundRect(c.x, c.y + lift, c.w, c.h, 14, sel ? '#ffffff' : 'rgba(255,255,255,0.62)');
    ctx.restore();
    ctx.save();
    if (locked) ctx.globalAlpha = 0.45;
    roundRect(c.x, c.y + lift, c.w, c.h, 14, null, sel ? S.colour : 'rgba(0,0,0,0.12)', sel ? 3.5 : 1.5);
    const y = c.y + lift;
    drawCoccus(c.x + 36, y + 36 + (sel ? Math.sin(t * 5) * 2.5 : 0), 17, S.colour, { face: 1, mood: sel ? 'happy' : '' });
    text(S.label, c.x + 66, y + 36, { size: 24, color: S.colour, weight: '900' });
    text(S.title, c.x + 66, y + 54, { size: 12, color: '#555' });
    ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(c.x + 14, y + 66, c.w - 28, 1);
    S.lines.forEach((ln, i) => text(ln, c.x + 14, y + 86 + i * 17, { size: 12.5, color: '#2b2b2b', weight: i ? '500' : '800' }));
    ctx.restore();
  }

  // the two panels
  for (const p of titlePanels()) {
    roundRect(p.x, p.y, p.w, p.h, 14, 'rgba(255,255,255,0.32)', 'rgba(23,61,70,0.18)', 1);
    label(p.title, p.x + 14, p.y + 19);
  }
  const bestTimes = G.times || (G.times = loadTimes());
  for (const c of levelChips()) {
    const d = LEVELS[c.i], sel = G.titleMode === 'story' && G.startLevel === c.i;
    roundRect(c.x, c.y, c.w, c.h, 15, sel ? d.theme.accent : 'rgba(255,255,255,0.75)', sel ? null : 'rgba(0,0,0,0.14)', 1.2);
    chipText(c.i < 3 ? `${c.i + 1}. ${d.name}` : `★ ${d.name}`, c, sel ? '#fff' : '#2b2b2b');
    const best = bestTimes[runKey(d)], m = best !== undefined && medalFor(d, best);   // this strain's best medal
    if (m) { circle(c.x + c.w - 14, c.y + 15, 6, m[1]); ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(c.x + c.w - 14, c.y + 15, 6, 0, TAU); ctx.stroke(); }
    if (codexData().secrets[c.i]) { ctx.save(); ctx.translate(c.x + 15, c.y + 15); ctx.scale(0.38, 0.38); drawSecret(0, 0, t * 60); ctx.restore(); }   // secret found
  }
  const today = dailyChallenge(dayNumber()), rec = dailyRecord(today.n), counts = codexCounts();
  for (const c of modeChips()) {
    const sel = (c.slot === 4 && G.titleMode === 'daily') || (c.slot === 5 && G.titleMode === 'log');
    const col = c.slot === 4 ? '#7c3aed' : c.slot === 5 ? '#b45309' : '#1f5f66';
    if (c.slot === 4 && !rec.best && !sel) glow(c.x + c.w / 2, c.y + c.h / 2, c.w * 0.4, '#c4a5ff', 0.12 + 0.12 * Math.sin(t * 4));
    roundRect(c.x, c.y, c.w, c.h, 15, sel ? col : 'rgba(255,255,255,0.75)', sel ? null : rgba(col, 0.55), 1.2);
    const str = c.slot === 4 ? `☀ Daily #${today.n} · ${LEVELS[today.level].name} part ${today.stage + 1} · ${today.mod.label}${rec.best ? ' · ' + fmtTime(rec.best) : ''}`
      : c.slot === 5 ? `📈 Log phase · gen ${loadLogBest()}` : `📖 Codex ${counts.seen}/${CODEX.length}`;
    chipText(str, c, sel ? '#fff' : '#2b2b2b');
  }

  // start prompt and footer
  const what = G.titleMode === 'daily' ? 'the daily challenge' : G.titleMode === 'log' ? 'the log phase climb' : LEVELS[G.startLevel].name;
  ctx.globalAlpha = 0.65 + 0.35 * Math.sin(t * 4);
  text(`Press Enter / Space to start ${what}`, VIEW_W / 2, 466, { size: 17, color: '#10202b', align: 'center', weight: '900' });
  ctx.globalAlpha = 1;
  if (G.best && G.titleMode === 'story') text(`best score ${G.best}`, VIEW_W / 2, 484, { size: 12, color: 'rgba(16,32,43,0.7)', align: 'center', weight: '700' });
  text(`B codex · I micrograph · M sound ${AUDIO.sfxOn ? 'on' : 'off'} · N music ${AUDIO.musicOn ? 'on' : 'off'}`, VIEW_W / 2, 506, { size: 12, color: 'rgba(16,32,43,0.8)', align: 'center', weight: '600' });
  text('PASN = cell-free spent medium of P. aeruginosa PAO1 (no living Pseudomonas).', VIEW_W / 2, 526, { size: 11.5, color: 'rgba(16,32,43,0.7)', align: 'center', weight: '500' });
}

function drawVignette() { ctx.drawImage(VIGNETTE, 0, 0); }

function drawWorld() {
  const th = L.def.theme;
  const cx = Math.round(L.cam), cy = Math.round(L.camY);
  // smooth shake: two mixed waves per axis instead of random jitter every frame
  const st = ++G.shakeT;
  const sx = G.shake ? G.shake * 0.55 * (Math.sin(st * 1.7) * 0.6 + Math.sin(st * 3.1 + 1) * 0.4) : 0;
  const sy = G.shake ? G.shake * 0.55 * (Math.sin(st * 2.3 + 2) * 0.6 + Math.sin(st * 3.7) * 0.4) : 0;
  ctx.save();
  ctx.translate(sx, sy);
  drawBackground(th, cx, cy);
  drawTerrain(L.art.tiles, cx, cy);
  ctx.translate(-cx, -cy);
  drawSpecialTiles(cx, cy);
  drawFoam(cx, cy);
  drawLysis(cx, cy);
  drawSigns(cx, cy);
  drawStudyStations();
  drawEntities(cx, cy);
  drawDamageFeedback();
  drawGhost();
  if (G.state !== 'lysis') drawPlayer();
  drawFx();
  drawLabels();
  ctx.restore();
  drawWeather(cx, cy);
  drawForeground(cx, cy);
  drawDarkness(cx, cy);
  drawCaveLight(cx, cy);
  drawVignette();
  drawExposureFront(cx, cy);
  drawLogFront(cx, cy);
  drawSignText(cx, cy);
  if (L.def.goals.length) drawGoalList();
  drawKillFeed();
  drawStageBanner();
  drawHUD();
  drawAbilityHUD();
  drawFlyers();
}

// Microscope-style iris: the view opens from a small focused circle.
function drawIris() {
  if (!(G.iris > 0)) return;
  const k = G.iris / 45, r = Math.pow(1 - k, 1.6) * 600;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, VIEW_W, VIEW_H); ctx.arc(VIEW_W / 2, VIEW_H / 2, Math.max(1, r), 0, TAU, true);
  ctx.fillStyle = '#0b1218'; ctx.fill('evenodd');
  ctx.strokeStyle = `rgba(255,255,255,${0.35 * k})`; ctx.lineWidth = 10;
  ctx.beginPath(); ctx.arc(VIEW_W / 2, VIEW_H / 2, r + 6, 0, TAU); ctx.stroke();
  ctx.strokeStyle = `rgba(160,200,255,${0.25 * k})`; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(VIEW_W / 2, VIEW_H / 2, r + 18, 0, TAU); ctx.stroke();
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  if (G.state === 'title') { drawTitle(); drawIris(); return; }
  if (G.state === 'codex') { drawCodex(); return; }
  if (G.state === 'replay') { drawReplay(); return; }
  drawWorld();
  const S = STRAINS[G.strain];
  switch (G.state) {
    case 'intro': drawIntro(S); break;
    case 'paused':
      drawPauseMenu();
      break;
    case 'lysis': drawLysisOverlay(); break;
    case 'levelDone': drawLevelResults(); break;
    case 'dailyDone': {
      const r = G.dailyResult;
      panel({
        title: `☀ Daily #${r.n} done!`, sub: dailyLabel(r),
        lines: [`time ${fmtTime(r.secs)}${r.newBest ? '  ·  new best today!' : `  ·  best today ${fmtTime(r.best)}`}`,
          `try ${r.attempts} · replicates ${r.reps}/${r.maxReps} · lost ${r.deaths} · peptides ${r.peptides}`,
          `Rule of the day: ${r.mod.label} (${r.mod.desc}). A new challenge starts at midnight.`],
        footer: 'Enter: menu · R: try again for a better time', accent: '#7c3aed', bodyY: 220, lineH: 30,
      });
      drawShareButtons('daily');
      break;
    }
    case 'logDone': {
      const r = G.logResult;
      panel({
        title: r.top ? 'Log phase complete: the MS!' : 'n = 0 · the climb is over',
        sub: `generation ${r.gen}/${LOG_GENS} · 2${sup(r.gen)} cells (a game counter)`,
        lines: [r.newBest ? `New best generation for ${G.strain}!` : `Best generation for ${G.strain}: ${r.best}`,
          `time ${fmtTime(r.secs)} · replicates lost ${r.deaths} · points ${r.points}`,
          'Every climb is generated anew: no two runs are the same.'],
        footer: 'Enter: menu · R: climb again', accent: '#b45309', bodyY: 220, lineH: 30,
      });
      drawShareButtons('endless');
      break;
    }
    case 'gameOver':
      panel({
        title: G.failReason === 'pulse' ? 'Pulse over' : 'n = 0',
        sub: G.failReason === 'pulse' ? 'Your sample missed the 15-min time point.' : 'No replicates left.',
        lines: G.failReason === 'pulse'
          ? ['In the real experiment the pulse samples were', 'harvested after exactly 15 min in PASN.', 'Try again, a bit faster.']
          : ['With zero replicates there is nothing to compare:', 'no mean, no variance, no test.', 'Even n = 3 is small, so protect your replicates!'],
        footer: G.mode === 'daily' ? 'Enter / R: try the daily challenge again · Esc: menu' : `R / tap here: retry stock (+3 s) · Enter: restart${L.stage > 0 ? ' part ' + (L.stage + 1) : ''} · Esc: menu`, accent: '#b3261e',
      });
      break;
    case 'win':
      panel({
        title: 'All samples measured!', sub: `Strain ${S.label} · total score ${G.score}${G.newBest ? '  (new best!)' : ''}`,
        lines: G.results.filter(Boolean).map(r => `${r.name}: ${r.total} points  ${'★'.repeat(r.stars.filter(Boolean).length)}${'☆'.repeat(r.stars.length - r.stars.filter(Boolean).length)}  ${fmtTime(r.secs)}${r.medal ? ' ' + r.medal[0] : ''}  (peptides ${r.peptides}/${r.totalPep})`).concat([''], strainFact(G.strain)),
        footer: 'Press Enter to play another strain', accent: '#7a5a00', bodyY: 184, lineH: 26,
      });
      drawShareButtons('win');
      break;
  }
  drawIris();
}

function drawIntro(S) {
  const def = L.def;
  if (G.mode === 'daily') {
    const c = G.daily, rec = dailyRecord(c.n);
    panel({
      title: `☀ Daily challenge #${c.n}`, sub: dailyLabel(c),
      lines: def.intro.concat(['', `Rule of the day: ${c.mod.label} (${c.mod.desc}).`,
        c.stage === 0 ? 'Finish at the PART 2 gate.' : 'Finish at the end of part 2.',
        `Everyone plays the same challenge today. Your tries so far: ${rec.attempts}${rec.best ? ' · best ' + fmtTime(rec.best) : ''}`,
        `Playing as ${S.label} (${S.title}) · R restarts instantly`]),
      footer: 'Press Enter / Space / tap to start', accent: '#7c3aed', bodyY: 184, lineH: 25,
    });
    return;
  }
  if (def.endless) {
    panel({
      title: '📈 Log phase', sub: def.subtitle,
      lines: def.intro.concat(['', `${LOG_GENS} generations up to an MS at the top. No stocks: R starts a new climb.`,
        `Best generation for ${S.label}: ${loadLogBest()}`, `Playing as ${S.label} (${S.title})`]),
      footer: 'Press Enter / Space / tap to start', accent: def.theme.accent, bodyY: 184, lineH: 25,
    });
    return;
  }
  const rival = L.rival ? [`🏁 Racing a rival ghost: ${fmtTime(L.rival.secs)}`] : [];
  panel({ title: `Level ${G.levelIdx + 1}: ${def.name}`, sub: def.subtitle, lines: def.intro.concat([''], goalLines(def), rival, [L.difficulty < 100 ? 'Study · optional biology stations · B or click to read' : L.difficulty > 100 ? 'Hard · 15% faster pace · shorter protection after hits' : `Medal times: gold ≤ ${fmtTime(medalTargets(def)[0])} · silver ≤ ${fmtTime(medalTargets(def)[1])} · bronze ≤ ${fmtTime(medalTargets(def)[2])}`, `Playing as ${S.label} (${S.title})`]), footer: 'Press Enter / Space / tap to start', accent: def.theme.accent, bodyY: 184, lineH: 25 });
}

// n = 0: the cell has burst. A stamp, one line of statistics humour, and a bar that
// shows the automatic restart coming.
function drawLysisOverlay() {
  const t = G.lysisT || 0, k = Math.min(1, t / 12);
  ctx.fillStyle = `rgba(40,8,14,${0.45 * k})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const s = t < 12 ? 1 + Math.pow(1 - t / 12, 2) * 1.6 : 1;
  ctx.save(); ctx.translate(VIEW_W / 2, 230); ctx.rotate(-0.06); ctx.scale(s, s);
  ctx.font = `900 72px ${FONT}`; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
  ctx.lineWidth = 12; ctx.strokeStyle = '#3a0c14'; ctx.strokeText('n = 0', 0, 0);
  ctx.fillStyle = '#ffd9d9'; ctx.fillText('n = 0', 0, 0);
  ctx.restore();
  ctx.globalAlpha = k;
  text('No replicates left: no mean, no variance, no test.', VIEW_W / 2, 276, { size: 17, color: '#fff', align: 'center', weight: '800' });
  const where = G.mode === 'daily' ? 'Restarting the daily challenge' : L.stage > 0 ? `Restarting part ${L.stage + 1} from the gate` : 'Restarting the level';
  text(`${where} … ☠ ${G.deaths} this run`, VIEW_W / 2, 302, { size: 14, color: '#ffc7c7', align: 'center', weight: '700' });
  roundRect(VIEW_W / 2 - 120, 318, 240, 8, 4, 'rgba(255,255,255,0.2)');
  roundRect(VIEW_W / 2 - 120, 318, 240 * Math.min(1, t / 70), 8, 4, '#ffd9d9');
  text(G.mode === 'story' ? 'Enter: restart now · R: retry stock · Esc: menu' : 'Enter: restart now · Esc: menu', VIEW_W / 2, 350, { size: 13, color: 'rgba(255,255,255,0.8)', align: 'center', weight: '700' });
  ctx.globalAlpha = 1;
}

// The results screen plays in beats (see effects.js): score rolls up, stars stamp in
// one after another, the medal drops, then a NEW BEST stamp.
function drawLevelResults() {
  const r = G.results[G.levelIdx], T = resultTimeline(r), t = G.resultT;
  const shown = Math.round(r.total * Math.min(1, t / 30));
  const stats = `S–S ${r.cystine}/${r.totalCys} · Fe ${r.iron} · replicates ${r.reps}/3 · lost ${r.deaths} · ${r.secs.toFixed(0)} s   →   +${shown} points`;
  panel({ title: `${L.def.name}: sample ${L.def.goalKind === 'sputum' ? 'delivered' : 'measured'}!`, sub: stats, lines: LEVEL_FACTS[G.levelIdx], footer: resultsDone(r) ? 'Press Enter to continue' : 'Enter: skip', accent: '#1b7f3b', bodyY: 322, lineH: 22 });
  r.stars.forEach((on, i) => {
    const x = VIEW_W / 2 + (i - (r.stars.length - 1) / 2) * 150, y = 190, s = stampScale(T.starAt(i));
    if (s === 0) { star(x, y, 20, false); return; }
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.translate(-x, -y);
    if (on) glow(x, y, 34, '#f3c22f', 0.35);
    star(x, y, 22, on);
    ctx.restore();
    text(r.starLabels[i], x, y + 38, { size: 12, color: on ? '#5a4500' : '#9a9384', align: 'center', weight: '700' });
  });
  // medal: drops in with a small bounce
  const mx = VIEW_W / 2 - 170, ma = t - T.medalAt, drop = ma < 0 ? null : ma < 14 ? -40 * Math.pow(1 - ma / 14, 2) * Math.abs(Math.cos(ma / 14 * Math.PI * 1.5)) : 0;
  if (drop !== null) {
    circle(mx, 262 + drop, 11, r.medal ? r.medal[1] : '#d9d4c7');
    if (r.medal) { ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(mx, 262 + drop, 11, 0, TAU); ctx.stroke(); }
  }
  text(`${r.medal ? r.medal[0] + ' medal' : 'no medal'} · time ${fmtTime(r.secs)} · best ${fmtTime(r.best)}`, mx + 20, 267, { size: 15, color: '#3d3523', weight: '700' });
  // splits per part, compared with the personal best, plus a rival result
  const parts = r.splits.map((s, i) => `part ${i + 1} ${fmtTime(s)}${Number.isFinite(r.pbSplits[i]) ? ' (' + fmtDelta(s - r.pbSplits[i]) + ')' : ''}`);
  const extra = [...parts, r.secret ? '★ secret found' : '', r.rivalDelta === undefined ? '' : r.rivalDelta < 0 ? `🏁 beat the rival by ${(-r.rivalDelta).toFixed(1)} s` : `🏁 rival ahead by ${r.rivalDelta.toFixed(1)} s`].filter(Boolean).join(' · ');
  if (extra) text(extra, VIEW_W / 2, 292, { size: 12, color: '#5b6b4a', align: 'center', weight: '700' });
  if (r.newBest) {
    const s = stampScale(T.bestAt);
    if (s) {
      ctx.save(); ctx.translate(VIEW_W / 2 + 250, 258); ctx.rotate(-0.18); ctx.scale(s, s);
      roundRect(-62, -18, 124, 34, 6, 'rgba(179,38,30,0.12)', '#b3261e', 3);
      text('NEW BEST!', 0, 7, { size: 18, color: '#b3261e', align: 'center', weight: '900' });
      ctx.restore();
    }
  }
  drawShareButtons('level');
}

// ---- main loop: fixed-step update, draw every animation frame -----------------------
let last = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min(100, now - last); last = now;
  while (acc >= STEP_MS) { update(); acc -= STEP_MS; }
  draw();
  requestAnimationFrame(frame);
}
AUDIO.music('title');
requestAnimationFrame(frame);
