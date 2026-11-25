'use strict';
// Rendering, movement abilities, checkpoints and personal ghosts.
const RUN_VERSION = 3;
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
function runKey(def = L.def, strain = G.strain) { return `${RUN_VERSION}:${def.name}:${strain}`; }
function loadGhost() {
  try {
    const g = JSON.parse(localStorage.getItem(`je2jump_ghost_${runKey()}`));
    if (!g || g.v !== RUN_VERSION || !Array.isArray(g.samples) || g.samples.length > 12000) return null;
    if (!g.samples.every((p, i) => Array.isArray(p) && p.length === 4 && p.every(Number.isFinite) && p[0] >= 0 && (!i || p[0] > g.samples[i - 1][0]))) return null;
    return g;
  } catch { return null; }
}
function saveGhost() {
  try { localStorage.setItem(`je2jump_ghost_${runKey()}`, JSON.stringify({ v: RUN_VERSION, samples: L.recording })); } catch { /* storage full / private mode */ }
}

function startDash() {
  if (G.strain !== 'stk' || P.dashCool > 0 || !P.onGround) return;
  P.dash = 12; P.dashCool = 90; P.squash = 0.18;
  AUDIO.play('dash');
  burst(P.x + P.w / 2, P.y + P.h / 2, '#ffcf70', 8, 2);
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
function retryCheckpoint() {
  if (!L || !L.checkpoint) return;
  if (L.def.timeLimit && L.time / 60 + 3 >= L.def.timeLimit) {
    loadLevel(G.levelIdx); setState('play'); return;
  }
  const saved = structuredClone(L.checkpoint);
  const oldPosition = [P.x, P.y, P.face];
  Object.assign(L, saved.world); P = saved.player;
  L.time += 180; L.retries++;
  if (L.recording.length < 11998) {
    L.recording.push([L.time - 1, Math.round(oldPosition[0]), Math.round(oldPosition[1]), oldPosition[2]],
      [L.time, Math.round(P.x), Math.round(P.y), P.face]);
  }
  Object.assign(L, { fx: [], pops: [], shots: [], combo: 0, comboT: 0,
    abWarn: 0, abOn: 0, abExpose: 0, coughing: 0, coughWarn: 0, coughFlash: 0, goalMsgT: 0 });
  L.jiggle.clear(); P.inv = 90; P.dash = 0; P.damageT = 0;
  for (const k in keys) keys[k] = false;
  G.hitStop = 0; G.shake = 0; G.failReason = ''; G.iris = 0;
  snapCamera(); setState('play');
  toast('Stock restored · +3 seconds. R retries instantly; medals use your full run time.', 180);
}

function recordRun() {
  if (L.time % 6 === 0 && L.recording.length < 12000 && (!L.recording.length || L.recording[L.recording.length - 1][0] < L.time)) L.recording.push([L.time, Math.round(P.x), Math.round(P.y), P.face]);
}
function drawGhost() {
  if (!G.ghostOn || !L.ghost || !L.ghost.samples.length) return;
  const a = L.ghost.samples;
  while (L.ghostIndex + 1 < a.length && a[L.ghostIndex + 1][0] <= L.time) L.ghostIndex++;
  const p = a[L.ghostIndex], n = a[L.ghostIndex + 1] || p;
  if (L.time < p[0] || L.time > a[a.length - 1][0]) return;
  const t = n[0] === p[0] ? 0 : clamp((L.time - p[0]) / (n[0] - p[0]), 0, 1);
  const x = p[1] + (n[1] - p[1]) * t + 12, y = p[2] + (n[2] - p[2]) * t + 14;
  ctx.save(); ctx.globalAlpha = 0.35;
  drawCoccus(x, y, 14, '#e9fcff', { face: p[3] });
  ctx.setLineDash([3, 4]); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x, y, 21, 0, TAU); ctx.stroke(); ctx.restore();
  text('PB', x, y - 28, { size: 12, align: 'center', color: '#f4ffff', weight: '800' });
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
    ? (P.dashCool > 0 ? 'C  DASH · ' + (P.dashCool / 60).toFixed(1) + ' s' : 'C  GROUND DASH READY')
    : G.strain === 'stp' ? 'HOLD JUMP · GLIDE' : 'SPACE · DOUBLE JUMP';
  roundRect(14, 58, 184, 30, 10, 'rgba(10,31,43,0.9)');
  text(label, 26, 78, { size: 12, color: '#f3e4b9', weight: '800' });
  if (L.def.name === 'SNpulse') {
    const ahead = Math.ceil((exposureFrontY() - P.y) / TILE);
    roundRect(786, 58, 160, 46, 11, 'rgba(10,31,43,0.92)', '#78d9ef', 1);
    text(ahead > 0 ? 'AHEAD OF EXPOSURE' : 'IN EXPOSURE', 866, 77, { size: 12, color: ahead > 0 ? '#9fffe0' : '#ffc99b', align: 'center', weight: '800' });
    text(ahead > 0 ? ahead + ' tiles clear' : 'Sources fire faster', 866, 94, { size: 12, color: '#e6f3fa', align: 'center' });
  }
  text('R retry stock · G ghost ' + (G.ghostOn ? 'on' : 'off'), VIEW_W - 18, VIEW_H - 14, { size: 12, color: '#f5fcff', align: 'right', weight: '700' });
}

// The exposure front is paced to the actual sample deadline, rather than a
// second lethal timer. It energises products behind it and is visible in HUD.
function exposureFrontY() {
  const start = L.ents.find(e => e.type === 'start'), goal = L.ents.find(e => e.type === 'goal');
  const t = clamp(L.time / (L.def.timeLimit * 60), 0, 1);
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
