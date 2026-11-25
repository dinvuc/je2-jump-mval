'use strict';
// modes.js -- the two extra ways to play besides the story run:
//  * Daily challenge: the date picks one part of one map, a strain and one rule
//    change (a "modifier"). Everyone gets the same challenge on the same day.
//  * Log phase: the generated climb from endless.js, chased by a rising front.
// Modifiers and the rising front are game rules, not biological claims.

// ---- daily challenge ------------------------------------------------------------------
const DAILY_MODS = [
  { id: 'lowgrav', label: 'Low gravity', desc: 'gravity at 80 %', mods: { grav: 0.8 } },
  { id: 'swift', label: 'Swift cell', desc: 'run 25 % faster', mods: { run: 1.25 } },
  { id: 'single', label: 'Single replicate', desc: 'start with n = 1', mods: { maxReps: 1 } },
  { id: 'grounded', label: 'Grounded', desc: 'no double jump or glide', mods: { grounded: true } },
  { id: 'magnet', label: 'Cystine magnet', desc: 'TcyA pulls cystine all run', mods: { magnet: true } },
];
const DAILY_EPOCH = Date.UTC(2026, 0, 1);
function dayNumber(date = new Date()) {
  return Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - DAILY_EPOCH) / 86400000) + 1;
}
function dailyChallenge(n) {
  const rnd = mulberry32((Math.imul(n, 2654435761) ^ 0x5eed) >>> 0);
  return {
    n, level: Math.floor(rnd() * LEVELS.length), stage: rnd() < 0.5 ? 0 : 1,
    strain: STRAIN_KEYS[Math.floor(rnd() * 3)], mod: DAILY_MODS[Math.floor(rnd() * DAILY_MODS.length)],
  };
}
const DAILY_KEY = 'je2jump_daily_v1';
function loadDailyLog() {
  try {
    const v = JSON.parse(localStorage.getItem(DAILY_KEY));
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch { return {}; }
}
function dailyRecord(n) {
  const r = loadDailyLog()[n];
  return { attempts: Number(r && r.attempts) || 0, best: Number.isFinite(r && r.best) ? r.best : null };
}
function saveDailyRecord(n, rec) {
  try {
    const log = loadDailyLog();
    log[n] = rec;
    for (const k of Object.keys(log)) if (Number(k) < n - 30) delete log[k];   // keep a month
    localStorage.setItem(DAILY_KEY, JSON.stringify(log));
  } catch { /* storage full / private mode */ }
}
function startDaily(showIntro = true) {
  const c = dailyChallenge(dayNumber());
  G.mode = 'daily'; G.daily = c; G.strain = c.strain;
  G.levelIdx = c.level; G.score = 0; G.results = []; G.seen = {}; G.studySeen = {};
  const rec = dailyRecord(c.n); rec.attempts++; saveDailyRecord(c.n, rec);
  loadLevel(c.level, { stage: c.stage, mods: c.mod.mods, keepDeaths: !showIntro });
  setState(showIntro ? 'intro' : 'play');
}
function finishDaily() {
  const c = G.daily, secs = runSecs(), rec = dailyRecord(c.n);
  const newBest = rec.best === null || secs < rec.best;
  if (newBest) rec.best = secs;
  saveDailyRecord(c.n, rec);
  G.dailyResult = { ...c, secs, best: rec.best, newBest, attempts: rec.attempts, reps: P.reps, maxReps: L.maxReps, deaths: G.deaths, peptides: L.peptides };
  G.resultT = 0;
  setState('dailyDone');
  AUDIO.play('done', c.level + 1);
}
function dailyLabel(c) { return `${LEVELS[c.level].name} part ${c.stage + 1} · ${c.strain} · ${c.mod.label}`; }
function shareDailyText(r) {
  return [
    `☀ JE2 Jump Daily #${r.n}`,
    dailyLabel(r),
    `⏱ ${fmtTime(r.secs)} · ${flasks(r.reps, r.maxReps)} · ☠ ${r.deaths} · try ${r.attempts}`,
    shareUrl(),
  ].join('\n');
}

// ---- log phase ------------------------------------------------------------------------
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sup = n => String(n).split('').map(d => SUP[d]).join('');
const LOG_KEY = 'je2jump_log_v1';
function logBestKey() { return `${G.strain}:${difficultyLabel(G.difficulty)}`; }
function loadLogBest() {
  try { const v = JSON.parse(localStorage.getItem(LOG_KEY)); return (v && Number(v[logBestKey()])) || 0; } catch { return 0; }
}
function saveLogBest(gen) {
  try {
    let v = JSON.parse(localStorage.getItem(LOG_KEY));
    if (!v || typeof v !== 'object' || Array.isArray(v)) v = {};
    v[logBestKey()] = gen;
    localStorage.setItem(LOG_KEY, JSON.stringify(v));
  } catch { /* storage full / private mode */ }
}
function startLogPhase(showIntro = true) {
  G.mode = 'log'; G.logSeed = (Math.random() * 2 ** 31) >>> 0;
  G.levelIdx = -1; G.score = 0; G.results = []; G.seen = {}; G.studySeen = {};
  loadLevel(-1, { def: LOG_PHASE, keepDeaths: false });
  setState(showIntro ? 'intro' : 'play');
}
// The front starts below the floor and rises faster with every generation; it is
// never more than ~1.7 screens below you, so there is always some pressure.
function updateLogPhase() {
  const feet = P.y + P.h;
  const gen = clamp(Math.floor((L.logBase * TILE - feet + 4) / (LOG_BAND * TILE)), 0, LOG_GENS);
  if (P.onGround && gen > L.gen) {
    L.gen = gen; L.points += 100 * gen;
    bigText(`GENERATION ${gen}`, P.x + P.w / 2, P.y - 40, '#ffe27a');
    ring(P.x + P.w / 2, P.y + P.h / 2, 10, 60, '#ffe27a', 22);
    AUDIO.play('gen', gen);
  }
  const speed = L.difficulty === 0 ? 0.12 : 0.2 + Math.min(0.45, L.gen * 0.022) * (L.difficulty > 100 ? 1.2 : 1);
  if (L.time > 150) L.front -= speed;
  L.front = Math.min(L.front, feet + 560);
  if (feet > L.front + 6 && P.inv === 0) {
    hurt('front', 'The depleted medium caught up with you. Keep climbing!');
    P.vy = SPRING_V * 0.85; P.onGround = false; P.sprung = true;
  }
}
function finishLogPhase(top) {
  const best = loadLogBest(), gen = L.gen;
  const newBest = gen > best;
  if (newBest) saveLogBest(gen);
  G.logResult = { gen, top, best: Math.max(best, gen), newBest, secs: runSecs(), deaths: G.deaths, points: L.points };
  G.resultT = 0;
  setState('logDone');
  AUDIO.play(top ? 'done' : 'fail', 4);
}
function shareEndlessText(r) {
  return [
    `📈 JE2 Jump · Log phase · ${G.strain} · ${difficultyLabel(G.difficulty)}`,
    `generation ${r.gen}/${LOG_GENS} (2${sup(r.gen)} cells)${r.top ? ' · reached the MS!' : ''} · ☠ ${r.deaths}`,
    shareUrl(),
  ].join('\n');
}
function drawLogFront(cx, cy) {
  if (!L.def.endless) return;
  const y = L.front - cy;
  if (y > VIEW_H + 40) return;
  ctx.save();
  const g = ctx.createLinearGradient(0, y - 30, 0, y + 200);
  g.addColorStop(0, 'rgba(120,70,30,0)'); g.addColorStop(0.15, 'rgba(110,62,26,0.42)'); g.addColorStop(1, 'rgba(70,40,18,0.7)');
  ctx.fillStyle = g; ctx.fillRect(0, y - 30, VIEW_W, VIEW_H + 240);
  ctx.strokeStyle = 'rgba(255,200,120,0.9)'; ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let x = 0; x <= VIEW_W; x += 8) { const yy = y + Math.sin(x * 0.03 + L.time * 0.05) * 5; if (!x) ctx.moveTo(x, yy); else ctx.lineTo(x, yy); }
  ctx.stroke();
  ctx.restore();
}
function drawLogHUD() {
  const ahead = Math.max(0, Math.floor((L.front - P.y - P.h) / TILE));
  roundRect(VIEW_W - 196, 14, 176, 28, 14, 'rgba(255,255,255,0.12)');
  text(`gen ${L.gen}/${LOG_GENS} · 2${sup(L.gen)} cells`, VIEW_W - 30, 34, { size: 14, color: '#ffe27a', align: 'right', weight: '800' });
  roundRect(786, 58, 160, 46, 11, 'rgba(10,31,43,0.92)', '#ffc078', 1);
  text(ahead > 3 ? 'AHEAD OF THE FRONT' : 'FRONT CLOSE!', 866, 77, { size: 12, color: ahead > 3 ? '#ffe9b0' : '#ff9a7a', align: 'center', weight: '800' });
  text(`${ahead} tiles clear`, 866, 94, { size: 12, color: '#e6f3fa', align: 'center' });
}
