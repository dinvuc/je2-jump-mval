'use strict';
// Rendering, movement abilities, checkpoints and personal ghosts.
const RUN_VERSION = 5;
let renderScale = 1;

// Keep physics in logical pixels; draw vectors at the display's actual density.
function configureCanvas() {
  const width = canvas.getBoundingClientRect().width || VIEW_W;
  const next = Math.ceil(Math.max(1, Math.min(3, width / VIEW_W * (window.devicePixelRatio || 1))) * 4) / 4;
  if (canvas.width === Math.round(VIEW_W * next) && canvas.height === Math.round(VIEW_H * next)) return false;
  renderScale = next;
  canvas.width = Math.round(VIEW_W * next); canvas.height = Math.round(VIEW_H * next);
  ctx.setTransform(canvas.width / VIEW_W, 0, 0, canvas.height / VIEW_H, 0, 0);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  return true;
}

function terrainSurface(width, height) {
  const surface = document.createElement('canvas');
  // A bounded cache avoids allocating enormous textures on tall levels.
  const scale = Math.min(renderScale, 2, Math.sqrt(16000000 / (width * height)));
  surface.width = Math.round(width * scale); surface.height = Math.round(height * scale);
  surface.logicalWidth = width; surface.logicalHeight = height;
  surface.getContext('2d').setTransform(surface.width / width, 0, 0, surface.height / height, 0, 0);
  return surface;
}

function drawTerrain(surface, x, y) {
  const sx = surface.width / surface.logicalWidth, sy = surface.height / surface.logicalHeight;
  ctx.drawImage(surface, x * sx, y * sy, VIEW_W * sx, VIEW_H * sy, 0, 0, VIEW_W, VIEW_H);
}

function medalTargets(def, strain = G.strain) {
  return def.medals.map(t => Math.min(def.timeLimit || Infinity, Math.round(t * STRAINS[strain].medalFactor)));
}
function runKey(def = L.def, strain = G.strain) {
  const key = `${RUN_VERSION}:${def.name}:${strain}`;
  return G.difficulty < 100 ? `${key}:study:${G.difficulty}` : G.difficulty > 100 ? `${key}:hard` : key;
}
function loadGhost() {
  try {
    const g = JSON.parse(localStorage.getItem(`je2jump_ghost_${runKey()}`));
    if (!g || g.v !== RUN_VERSION || !Array.isArray(g.samples) || g.samples.length > 12000) return null;
    if (!g.samples.every((p, i) => Array.isArray(p) && (p.length === 4 || p.length === 5) && p.every(Number.isFinite) && p[0] >= 0 && (!i || p[0] > g.samples[i - 1][0]))) return null;
    return g;
  } catch { return null; }
}
function saveGhost() {
  try { localStorage.setItem(`je2jump_ghost_${runKey()}`, JSON.stringify({ v: RUN_VERSION, samples: L.recording })); } catch { /* storage full / private mode */ }
}
// Part splits of the personal-best run (seconds at each gate), per run key.
function loadSplits() {
  try {
    const v = JSON.parse(localStorage.getItem('je2jump_v5_splits'));
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch { return {}; }
}
function saveSplits(key, splits) {
  try { const v = loadSplits(); v[key] = splits; localStorage.setItem('je2jump_v5_splits', JSON.stringify(v)); } catch { /* storage full / private mode */ }
}
// Seconds played in this run (a daily part-2 start does not count the part-1 clock).
function runSecs() { return (L.time - (L.timeBase || 0)) / 60; }
const fmtDelta = d => (d < 0 ? '−' : '+') + Math.abs(d).toFixed(1) + ' s';

// stk: a dash on the ground, or once per jump in the air (the cell hangs while it
// dashes). A dashing cell defeats the enemies it hits (see enemyContact).
const DASH_FRAMES = 12, DASH_COOL = 45;
function startDash() {
  if (G.strain !== 'stk' || P.dashCool > 0 || P.dash > 0) return;
  if (!P.onGround) {
    if (P.airDash) return;
    P.airDash = true; P.vy = Math.min(P.vy, 0); P.diving = false;
  }
  P.dash = DASH_FRAMES; P.dashCool = DASH_COOL; P.squash = 0.18;
  AUDIO.play('dash');
  burst(P.x + P.w / 2, P.y + P.h / 2, '#ffcf70', 8, 2);
  ring(P.x + P.w / 2, P.y + P.h / 2, 6, 30, '#ffcf70', 12, 2);
}
// stp: down in the air starts a dive. It smashes through enemies on the way and
// ends with a shockwave that defeats enemies nearby and breaks debris.
const DIVE_V = 14, GLIDE_FRAMES = 90;
function startDive() {
  if (G.strain !== 'stp' || L.mods.grounded || P.onGround || P.diving || P.dash > 0) return;
  P.diving = true; P.vy = DIVE_V; P.vx *= 0.3; P.squash = -0.2;
  AUDIO.play('dash');
  ring(P.x + P.w / 2, P.y + P.h / 2, 6, 28, '#9fffe0', 12, 2);
}
function diveImpact() {
  P.diving = false;
  const fx = P.x + P.w / 2, fy = P.y + P.h;
  // debris under the feet and right beside the cell breaks
  const row = Math.floor((fy + 1) / TILE), body = Math.floor((fy - 4) / TILE);
  for (let tx = Math.floor((P.x - 8) / TILE); tx <= Math.floor((P.x + P.w + 8) / TILE); tx++) {
    for (const ty of [row, body]) if (tileAt(tx, ty) === 'B') breakTile(tx, ty);
  }
  for (const e of L.ents) {
    if (!e.alive || !ENEMIES.has(e.type)) continue;
    const b = enemyBox(e);
    if (Math.abs(b.x + b.w / 2 - fx) < 76 && Math.abs(b.y + b.h / 2 - (fy - 14)) < 44) killEnemy(e);
  }
  ring(fx, fy, 8, 84, '#9fffe0', 22, 4); ring(fx, fy, 4, 50, '#ffffff', 16, 2);
  burst(fx, fy, rgba(L.def.theme.eps, 0.9), 16, 3.2, 0.1, 30);
  P.squash = 0.34; G.shake = Math.max(G.shake, 8);
  AUDIO.play('land'); AUDIO.play('stomp');
}

// Clone related entities and moving surfaces together to retain ride references.
const CHECKPOINT_FIELDS = ['grid', 'ents', 'movers', 'lysis', 'solids', 'plats',
  'cystine', 'ironBank', 'ironTotal', 'points', 'kills', 'peptides', 'bossActive',
  'bossDown', 'stocks', 'respawn', 'goalSeen', 'spawnQ',
  'abNext', 'coughNext'];
function captureCheckpoint() {
  const world = {};
  for (const field of CHECKPOINT_FIELDS) world[field] = L[field];
  L.checkpoint = structuredClone({ world, player: P });
}
// Put the world and the player back to a saved stock and clear transient effects.
function restoreSnapshot(snapshot) {
  const saved = structuredClone(snapshot);
  Object.assign(L, saved.world); P = saved.player;
  Object.assign(L, { fx: [], pops: [], callouts: [], shots: [], combo: 0, comboT: 0, tags: [], bigs: [], flyers: [],
    abWarn: 0, abOn: 0, abExpose: 0, coughing: 0, coughWarn: 0, coughFlash: 0, goalMsgT: 0 });
  L.bumps.clear();
  L.jiggle.clear(); P.inv = 90; P.dash = 0; P.diving = false; P.damageT = 0;
  for (const k in keys) keys[k] = false;
  G.hitStop = 0; G.shake = 0; G.failReason = '';
}
function retryCheckpoint() {
  if (!L || !L.checkpoint) return;
  // the daily challenge and the log phase restart instantly instead
  if (G.mode === 'daily') { endAttempt('retry'); startDaily(false); return; }
  if (G.mode === 'log') { startLogPhase(false); return; }
  endAttempt('retry');
  const penalty = L.difficulty === 0 ? 0 : 180;
  if (L.timeLimit && L.time / 60 + penalty / 60 >= L.timeLimit) {
    if (L.stage > 0) { restartPart(); return; }   // the part 2 gate still counts
    loadLevel(G.levelIdx, { keepDeaths: true }); setState('play'); return;
  }
  const oldPosition = [P.x, P.y, P.face];
  restoreSnapshot(L.checkpoint);
  newAttempt();
  L.time += penalty; L.retries++;
  if (penalty && L.recording.length < 11998) {
    L.recording.push([L.time - 1, Math.round(oldPosition[0]), Math.round(oldPosition[1]), oldPosition[2], L.stage],
      [L.time, Math.round(P.x), Math.round(P.y), P.face, L.stage]);
  }
  G.iris = 0;
  snapCamera(); setState('play');
  toast(penalty ? 'Stock restored · +3 seconds. R retries instantly; medals use your full run time.' : 'Study stock restored · no time penalty.', 180);
}
// Restart part 2 from its gate: the run (time, score, pickups) goes back to how
// it was when you walked through the gate, with all three replicates restored.
function restartPart() {
  const start = L.stageStart;
  endAttempt('lost');
  restoreSnapshot(start.checkpoint);
  newAttempt();
  P.reps = L.maxReps;
  L.checkpoint = structuredClone({ world: start.checkpoint.world, player: P });
  L.time = start.time; L.retries++;
  L.recording.length = Math.min(L.recording.length, start.samples); L.ghostIndex = 0;
  L.bannerT = 200; G.iris = 45;
  snapCamera(); setState('play');
  toast(`Part ${L.stage + 1} restarted from the gate.`, 180);
}

function recordRun() {
  if (L.time % 6 !== 0) return;
  recordAttempt();
  if (L.recording.length < 12000 && (!L.recording.length || L.recording[L.recording.length - 1][0] < L.time)) L.recording.push([L.time, Math.round(P.x), Math.round(P.y), P.face, L.stage]);
}
// Your personal-best ghost, plus a rival ghost from a race link (story mode only).
function drawGhost() {
  if (!G.ghostOn) return;
  if (L.ghost && L.ghost.samples.length) {
    L.ghostIndex = drawGhostTrack(L.ghost.samples, L.ghostIndex, '#e9fcff', 'PB', '#f4ffff');
  }
  if (L.rival) L.rivalIndex = drawGhostTrack(L.rival.samples, L.rivalIndex, '#ff8a96', 'RIVAL', '#ffd0d6');
}
function drawGhostTrack(a, index, ring, label, labelColour) {
  while (index + 1 < a.length && a[index + 1][0] <= L.time) index++;
  const p = a[index], n = a[index + 1] || p;
  // Samples carry the map part they were recorded in (older samples: part 1).
  if ((p[4] || 0) !== L.stage || (n[4] || 0) !== L.stage) return index;
  if (L.time < p[0] || L.time > a[a.length - 1][0]) return index;
  const t = n[0] === p[0] ? 0 : clamp((L.time - p[0]) / (n[0] - p[0]), 0, 1);
  const x = p[1] + (n[1] - p[1]) * t + 12, y = p[2] + (n[2] - p[2]) * t + 14;
  ctx.save(); ctx.globalAlpha = 0.35;
  drawCoccus(x, y, 14, ring, { face: p[3] });
  ctx.setLineDash([3, 4]); ctx.strokeStyle = ring; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x, y, 21, 0, TAU); ctx.stroke(); ctx.restore();
  text(label, x, y - 28, { size: 12, align: 'center', color: labelColour, weight: '800' });
  return index;
}

function drawDamageFeedback() {
  if (!(P.damageT > 0)) return;
  ctx.save(); ctx.globalAlpha = Math.min(1, P.damageT / 18);
  const x = P.x + P.w / 2, y = P.y - 28 - (75 - P.damageT) * 0.25;
  roundRect(x - 74, y - 16, 148, 24, 8, '#642738', '#ffc0b0', 1);
  text(P.damageLabel, x, y, { size: 12, color: '#fff3e9', align: 'center', weight: '800' });
  ctx.restore();
}

function drawAbilityHUD() {
  const label = G.strain === 'stk'
    ? (P.dashCool > 0 ? 'C  DASH · ' + (P.dashCool / 60).toFixed(1) + ' s' : P.airDash ? 'C  DASH · land to recharge' : 'C  DASH · ground + air')
    : G.strain === 'stp' ? 'HOLD JUMP GLIDE · ↓ DIVE' : 'SPACE · DOUBLE JUMP';
  roundRect(14, 58, 184, 30, 10, 'rgba(10,31,43,0.9)');
  text(label, 26, 78, { size: 12, color: '#f3e4b9', weight: '800' });
  if (L.def.name === 'SNpulse') {
    const ahead = Math.ceil((exposureFrontY() - P.y) / TILE);
    roundRect(786, 58, 160, 46, 11, 'rgba(10,31,43,0.92)', '#78d9ef', 1);
    text(ahead > 0 ? 'AHEAD OF EXPOSURE' : 'IN EXPOSURE', 866, 77, { size: 12, color: ahead > 0 ? '#9fffe0' : '#ffc99b', align: 'center', weight: '800' });
    text(ahead > 0 ? ahead + ' tiles clear' : 'Sources fire faster', 866, 94, { size: 12, color: '#e6f3fa', align: 'center' });
  }
  text((G.mode === 'story' ? 'R retry stock' : 'R restart') + ' · G ghost ' + (G.ghostOn ? 'on' : 'off') + ' · I micrograph', VIEW_W - 18, VIEW_H - 14, { size: 12, color: '#f5fcff', align: 'right', weight: '700' });
  if (L.difficulty !== 100 && G.toastT <= 0) {
    roundRect(210, 58, 250, 30, 10, 'rgba(10,31,43,0.92)', '#a7e0d4', 1);
    text(L.difficulty < 100 ? 'STUDY · B read nearby station' : 'HARD · faster pace', 222, 78, { size: 12, color: '#c3ffdf', weight: '800' });
  }
}

// The exposure front is paced to the actual sample deadline, rather than a
// second lethal timer. It energises products behind it and is visible in HUD.
// Each part of the map gets its share of the deadline (def.stageShare).
function exposureFrontY() {
  const start = L.ents.find(e => e.type === 'start'), goal = L.ents.find(e => e.type === 'goal' || e.type === 'stage');
  const shares = L.def.stageShare || L.def.stages.map(() => 1 / L.def.stages.length);
  const before = shares.slice(0, L.stage).reduce((a, b) => a + b, 0);
  const t = clamp((L.time / ((L.timeLimit || L.def.timeLimit) * 60) - before) / shares[L.stage], 0, 1);
  return start.y + 160 - t * (start.y - goal.y + 160);
}
function drawExposureFront(cx, cy) {
  if (L.def.name !== 'SNpulse') return;
  const y = exposureFrontY() - cy;
  if (y < -VIEW_H || y > VIEW_H + 100) return;
  ctx.save();
  const g = ctx.createLinearGradient(0, y - 20, 0, y + 180);
  g.addColorStop(0, 'rgba(31,158,199,0)'); g.addColorStop(0.15, 'rgba(32,149,190,0.26)'); g.addColorStop(1, 'rgba(27,88,141,0.12)');
  ctx.fillStyle = g; ctx.fillRect(0, y - 20, VIEW_W, VIEW_H + 200);
  ctx.strokeStyle = 'rgba(148,245,255,0.85)'; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= VIEW_W; x += 8) { const yy = y + Math.sin(x * 0.025 + L.time * 0.035) * 6; if (!x) ctx.moveTo(x, yy); else ctx.lineTo(x, yy); }
  ctx.stroke(); ctx.restore();
}

// Changing the fixed-step cadence retains jump arcs, terrain and strain abilities.
// Normal mode never uses this path.
function studyPace(difficulty) { return difficulty > 100 ? 1.15 : 0.55 + 0.45 * difficulty / 100; }
function difficultyLabel(difficulty) {
  return difficulty < 100 ? 'Study' : difficulty > 100 ? 'Hard' : 'Normal';
}
function syncDifficultyControl() {
  for (const button of difficultyButtons) button.setAttribute('aria-pressed', String(Number(button.dataset.difficulty) === G.difficulty));
  const help = document.getElementById('difficulty-help');
  if (help) help.textContent = G.difficulty < 100 ? 'Explore, learn biology, keep your replicates.'
    : G.difficulty > 100 ? 'Faster pace. Shorter protection after hits.' : 'The original challenge.';
}
// Stations are fixed places to read, never automatic encounter popups.
function syncStudyStation() {
  let nearest = null, distance = 72;
  if (G.state === 'play' && L.difficulty < 100) {
    for (const station of L.studyStations) {
      const d = dist(P.x + P.w / 2, P.y + P.h / 2, station.tx * TILE + 16, station.ty * TILE + 16);
      if (d < distance) { nearest = station; distance = d; }
    }
  }
  if (nearest !== G.studyStation) {
    G.studyStation = nearest; G.studyOpen = false; G.studyIndex = 0;
    renderStudyStation();
  }
}
function toggleStudyStation() {
  syncStudyStation();
  if (!G.studyStation) return;
  G.studyOpen = !G.studyOpen;
  renderStudyStation();
}
function turnStudyPage(direction) {
  if (!G.studyOpen || !G.studyStation) return;
  G.studyIndex = (G.studyIndex + direction + G.studyStation.topics.length) % G.studyStation.topics.length;
  renderStudyStation();
}
function renderStudyStation() {
  if (!studyControls || !studyPanel) return;
  const nearby = G.state === 'play' && !!G.studyStation;
  studyControls.hidden = !nearby;
  studyPanel.hidden = !nearby || !G.studyOpen;
  document.getElementById('study-open').textContent = G.studyOpen ? 'Close biology note · B' : 'Open biology note · B';
  if (studyPanel.hidden) return;
  const topics = G.studyStation.topics, key = topics[G.studyIndex], note = STUDY_FACTS[key];
  G.studySeen[key] = true;
  document.getElementById('study-title').textContent = note.title;
  document.getElementById('study-biology').textContent = note.biology;
  document.getElementById('study-game').textContent = note.game;
  document.getElementById('study-source').textContent = note.source;
  document.getElementById('study-count').textContent = (G.studyIndex + 1) + ' / ' + topics.length;
  document.getElementById('study-prev').hidden = topics.length < 2;
  document.getElementById('study-next').hidden = topics.length < 2;
  studyPanel.scrollTop = 0;
}
function drawStudyStations() {
  for (const station of L.studyStations) {
    const x = station.tx * TILE + 16, y = station.ty * TILE + 16;
    if (x < L.cam - 60 || x > L.cam + VIEW_W + 60 || y < L.camY - 60 || y > L.camY + VIEW_H + 60) continue;
    const near = station === G.studyStation;
    roundRect(x - 15, y - 12, 30, 28, 7, '#276a67', near ? '#f5ca65' : '#b5e9d7', near ? 3 : 1.5);
    roundRect(x - 10, y - 7, 9, 16, 2, '#fbf8f1');
    roundRect(x + 1, y - 7, 9, 16, 2, '#fbf8f1');
    roundRect(x - 35, y - 33, 70, 16, 6, 'rgba(10,31,43,0.9)');
    text('BIOLOGY', x, y - 21, { size: 10, color: near ? '#f5ca65' : '#c3ffdf', align: 'center', weight: '800' });
  }
}
