'use strict';
// game.js -- "JE2 Jump": a small platformer about the Bio253 JE2 proteomics course.
// Plain JavaScript + <canvas>, no libraries, no build step: open index.html and play.
// Needs facts.js (STRAINS, LEVEL_FACTS, strainFact) and levels.js (LEVELS, ROWS, GROUND).

const TILE = 32, VIEW_W = 960, VIEW_H = 544;
const STEP_MS = 1000 / 60;            // fixed physics step: 60 updates per second

// Physics. A jump of JUMP_V climbs JUMP_V^2 / (2 * GRAV) ≈ 100 px ≈ 3 tiles.
const GRAV = 0.55, MAX_FALL = 12;
const RUN_ACC = 0.6, RUN_MAX = 3.8, FRICTION = 0.78;
const JUMP_V = -10.6;
const COYOTE = 6;   // frames you may still jump after walking off a ledge
const BUFFER = 6;   // frames a jump press is remembered before landing

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// ---- input -----------------------------------------------------------------------
const keys = {};      // held right now
const pressed = {};   // pressed since last read (read with took())
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', Enter: 'ok',
  KeyP: 'pause', Escape: 'pause', Digit1: 's1', Digit2: 's2', Digit3: 's3',
};
function press(k) { if (!keys[k]) pressed[k] = true; keys[k] = true; }
function release(k) { keys[k] = false; }
addEventListener('keydown', e => {
  const k = KEYMAP[e.code];
  if (!k) return;
  e.preventDefault();
  press(k);
});
addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) release(k); });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
function took(k) { const p = !!pressed[k]; pressed[k] = false; return p; }
function clearPressed() { for (const k in pressed) pressed[k] = false; }

// Touch buttons (only shown on touch screens).
const touchBox = document.getElementById('touch');
if (matchMedia('(pointer: coarse)').matches) touchBox.hidden = false;
for (const b of touchBox.querySelectorAll('button')) {
  const k = b.dataset.key;
  b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); press(k); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => release(k));
}

// Clicks / taps on the canvas: choose a strain on the title screen, otherwise "continue".
canvas.addEventListener('pointerdown', e => {
  const r = canvas.getBoundingClientRect();
  const x = (e.clientX - r.left) * VIEW_W / r.width;
  const y = (e.clientY - r.top) * VIEW_H / r.height;
  if (G.state === 'title') {
    const hit = strainCards().find(c => x > c.x && x < c.x + c.w && y > c.y && y < c.y + c.h);
    if (hit) { G.strain = hit.key; startGame(); }
  } else if (G.state !== 'play') {
    pressed.ok = true;
  }
});

// ---- small helpers ---------------------------------------------------------------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
function loadBest() { try { return Number(localStorage.getItem('je2jump_best')) || 0; } catch { return 0; } }
function saveBest(v) { try { localStorage.setItem('je2jump_best', String(v)); } catch { /* private mode */ } }

// ---- game state ------------------------------------------------------------------
const G = { state: 'title', strain: 'anc', levelIdx: 0, score: 0, results: [], toast: '', toastT: 0, best: loadBest(), seen: {} };
let L = null;  // the running level
let P = null;  // the player

function setState(s) { G.state = s; clearPressed(); }

function startGame() {
  G.levelIdx = 0; G.score = 0; G.results = []; G.seen = {};
  loadLevel(0);
  setState('intro');
}

function loadLevel(i) {
  const def = LEVELS[i];
  const b = def.build();
  L = {
    def, cols: b.cols, grid: b.grid, signs: b.signs,
    ents: b.ents.map(e => ({ ...e, x: e.tx * TILE, y: e.ty * TILE, alive: true, t: 0 })),
    time: 0, cam: 0, cystine: 0, ironBank: 0, ironTotal: 0, points: 0, goalMsgT: 0,
    dots: Array.from({ length: 40 }, () => ({ x: Math.random() * VIEW_W, y: Math.random() * VIEW_H, r: 2 + Math.random() * 5, v: 0.1 + Math.random() * 0.3 })),
  };
  for (const e of L.ents) {
    if (e.type === 'lasa') { e.w = 28; e.h = 20; e.y = e.ty * TILE + TILE - e.h; e.vx = -1.1; }
    if (e.type === 'sidero') { e.hx = e.x + 16; e.hy = e.y + 16; e.cx = e.hx; e.cy = e.hy; e.cool = 0; }
  }
  const start = L.ents.find(e => e.type === 'start');
  L.respawn = { x: start.x + 4, y: start.y + 4 };
  P = {
    x: L.respawn.x, y: L.respawn.y, w: 24, h: 28, vx: 0, vy: 0,
    onGround: false, coyote: 0, buffer: 0, djReady: true, groundT: 0,
    face: 1, inv: 0, slow: 0, shield: 0, magnet: 0, phos: 0, reps: 3,
  };
  G.toast = ''; G.toastT = 0; G.failReason = '';
}

function toast(text, frames = 200) { G.toast = text; G.toastT = frames; }
function once(key, text) { if (!G.seen[key]) { G.seen[key] = true; toast(text, 260); } }

// ---- tiles -----------------------------------------------------------------------
function tileAt(tx, ty) {
  if (tx < 0 || tx >= L.cols) return '#';   // invisible walls at both ends
  if (ty < 0 || ty >= ROWS) return ' ';     // open sky above, a pit below
  return L.grid[ty][tx];
}

function moveX() {
  P.x += P.vx;
  const top = Math.floor(P.y / TILE), bot = Math.floor((P.y + P.h - 1) / TILE);
  if (P.vx > 0) {
    const tx = Math.floor((P.x + P.w - 1) / TILE);
    for (let ty = top; ty <= bot; ty++) if (tileAt(tx, ty) === '#') { P.x = tx * TILE - P.w; P.vx = 0; break; }
  } else if (P.vx < 0) {
    const tx = Math.floor(P.x / TILE);
    for (let ty = top; ty <= bot; ty++) if (tileAt(tx, ty) === '#') { P.x = (tx + 1) * TILE; P.vx = 0; break; }
  }
}

function moveY() {
  const prevBottom = P.y + P.h;
  P.y += P.vy;
  P.onGround = false;
  const left = Math.floor(P.x / TILE), right = Math.floor((P.x + P.w - 1) / TILE);
  if (P.vy > 0) {
    const ty = Math.floor((P.y + P.h - 1) / TILE);
    for (let tx = left; tx <= right; tx++) {
      const c = tileAt(tx, ty);
      // '=' platforms only hold you when you come from above.
      if (c === '#' || (c === '=' && prevBottom <= ty * TILE + 0.5)) {
        P.y = ty * TILE - P.h; P.vy = 0; P.onGround = true; break;
      }
    }
  } else if (P.vy < 0) {
    const ty = Math.floor(P.y / TILE);
    for (let tx = left; tx <= right; tx++) if (tileAt(tx, ty) === '#') { P.y = (ty + 1) * TILE; P.vy = 0; break; }
  }
}

function onSpikes() {
  const x0 = Math.floor(P.x / TILE), x1 = Math.floor((P.x + P.w - 1) / TILE);
  const y0 = Math.floor(P.y / TILE), y1 = Math.floor((P.y + P.h - 1) / TILE);
  for (let ty = y0; ty <= y1; ty++)
    for (let tx = x0; tx <= x1; tx++)
      if (tileAt(tx, ty) === '^' && overlap(P, { x: tx * TILE + 4, y: ty * TILE + 14, w: TILE - 8, h: TILE - 14 })) return true;
  return false;
}

// ---- damage ----------------------------------------------------------------------
function loseReplicate(msg) {
  P.reps--;
  toast(P.reps > 0 ? `${msg}  Replicates left: ${P.reps}/3` : msg);
  if (P.reps <= 0) setState('gameOver');
}
function hurt(kind, msg) {
  if (P.inv > 0) return;
  if (kind === 'ros' && P.shield > 0) {
    P.shield = 0; P.inv = 40;
    toast('AhpC absorbed the ROS. Shield used up.');
    return;
  }
  P.inv = 90; P.vy = -6; P.vx = -P.face * 3;
  loseReplicate(msg);
}
function respawn() {
  P.x = L.respawn.x; P.y = L.respawn.y; P.vx = 0; P.vy = 0; P.inv = 60; P.slow = 0;
}

// ---- the main play update --------------------------------------------------------
function updatePlay() {
  const S = STRAINS[G.strain];
  L.time++;

  if (L.def.timeLimit && L.time / 60 > L.def.timeLimit) {
    toast('The 15-min pulse ended before your sample reached the MS.');
    setState('gameOver');
    G.failReason = 'pulse';
    return;
  }

  // Run. HQNO ("slow") lowers top speed and jump power.
  const slowF = P.slow > 0 ? 0.55 : 1;
  const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  if (dir) { P.vx += dir * RUN_ACC; P.face = dir; } else P.vx *= FRICTION;
  P.vx = clamp(P.vx, -RUN_MAX * slowF, RUN_MAX * slowF);
  if (Math.abs(P.vx) < 0.05) P.vx = 0;

  // Jump, with coyote time and a small input buffer so it feels fair.
  if (took('jump')) P.buffer = BUFFER; else if (P.buffer > 0) P.buffer--;
  if (P.onGround) {
    P.coyote = COYOTE; P.groundT++;
    if (S.doubleJump > 0 && P.groundT >= S.recharge) P.djReady = true;
  } else { P.coyote--; P.groundT = 0; }

  if (P.buffer > 0) {
    if (P.coyote > 0) {
      P.vy = JUMP_V * (P.slow > 0 ? 0.85 : 1);
      P.coyote = 0; P.buffer = 0;
    } else if (S.doubleJump > 0 && P.djReady) {
      P.vy = JUMP_V * S.doubleJump * (P.slow > 0 ? 0.85 : 1);
      P.djReady = false; P.buffer = 0; P.phos = 30;   // little "P" badge = phosphorylated
    } else if (S.doubleJump === 0 && !P.onGround) {
      once('nodj', 'stk: no Stk1 kinase, so no double jump. Time your jumps!');
    }
  }
  if (!keys.jump && P.vy < -3.5) P.vy = -3.5;      // let go early = lower jump
  P.vy = Math.min(P.vy + GRAV, MAX_FALL);

  moveX();
  moveY();

  for (const t of ['inv', 'slow', 'shield', 'magnet', 'phos']) if (P[t] > 0) P[t]--;

  if (onSpikes()) hurt('spike', 'Ouch, spikes!');
  if (G.state !== 'play') return;
  if (P.y > ROWS * TILE + 64) {
    P.inv = 0;
    loseReplicate('You fell out of the culture.');
    if (G.state !== 'play') return;
    respawn();
  }

  updateEntities();

  // Camera follows the player, a bit ahead in the running direction.
  const target = clamp(P.x + P.w / 2 - VIEW_W * 0.4, 0, L.cols * TILE - VIEW_W);
  L.cam += (target - L.cam) * 0.12;
  if (G.toastT > 0) G.toastT--;
  if (L.goalMsgT > 0) L.goalMsgT--;
}

function updateEntities() {
  const pcx = P.x + P.w / 2, pcy = P.y + P.h / 2;
  const spawned = [];
  for (const e of L.ents) {
    if (G.state !== 'play') break;   // level ended (finished or n = 0) during this loop
    if (!e.alive) continue;
    e.t++;
    const cx = e.x + 16, cy = e.y + 16;
    switch (e.type) {
      case 'cystine':
        if (P.magnet > 0 && dist(cx, cy, pcx, pcy) < 170) {
          const d = dist(cx, cy, pcx, pcy) || 1;
          e.x += (pcx - cx) / d * 5; e.y += (pcy - cy) / d * 5;
        }
        if (dist(cx, cy, pcx, pcy) < 24) {
          e.alive = false; L.cystine++; L.points += 100;
          once('cys', 'L-cystine! A source of sulfur for the cell.');
        }
        break;
      case 'iron':
        if (dist(cx, cy, pcx, pcy) < 24) {
          e.alive = false; L.ironTotal++; L.ironBank++; L.points += 50;
          if (L.ironBank >= 3) {
            L.ironBank = 0;
            if (P.reps < 3) { P.reps++; toast('3 Fe: one replicate restored!'); }
            else { L.points += 300; toast('3 Fe with all replicates: +300 points'); }
          }
        }
        break;
      case 'ahpc':
        if (dist(cx, cy, pcx, pcy) < 26) { e.alive = false; P.shield = 60 * 20; toast('AhpC shield: blocks one ROS hit (20 s).'); }
        break;
      case 'tcya':
        if (dist(cx, cy, pcx, pcy) < 26) { e.alive = false; P.magnet = 60 * 12; toast('TcyA: cystine is pulled towards you (12 s).'); }
        break;
      case 'check':
        if (!e.on && Math.abs(cx - pcx) < 20 && Math.abs(cy - pcy) < 40) {
          for (const o of L.ents) if (o.type === 'check') o.on = false;
          e.on = true; L.respawn = { x: e.x + 4, y: e.y + 4 };
          toast('Checkpoint: you will restart here.', 120);
        }
        break;
      case 'goal': {
        const box = { x: e.x, y: e.y - TILE, w: TILE * 2, h: TILE * 2 };
        if (overlap(P, box)) {
          if (L.cystine >= L.def.need) finishLevel();
          else if (L.goalMsgT === 0) {
            toast(`The MS needs ${L.def.need - L.cystine} more cystine. PASN is nutrient-poor: search harder!`);
            L.goalMsgT = 180;
          }
        }
        break;
      }
      case 'dripper':
        // Wait until the player is near, then drop pyocyanin every ~1.6 s.
        if (Math.abs(cx - pcx) < VIEW_W * 0.7 && e.t % 100 === 0) spawned.push({ type: 'drop', x: e.x + 12, y: e.y + 26, vy: 0, alive: true, t: 0 });
        break;
      case 'drop': {
        e.vy = Math.min(e.vy + 0.25, 8); e.y += e.vy;
        if (tileAt(Math.floor((e.x + 4) / TILE), Math.floor((e.y + 8) / TILE)) !== ' ' || e.y > ROWS * TILE) { e.alive = false; break; }
        if (overlap(P, { x: e.x, y: e.y, w: 8, h: 10 })) {
          e.alive = false;
          hurt('ros', 'Pyocyanin made ROS in your cell.');
        }
        break;
      }
      case 'hqno': {
        e.cx = cx + Math.sin(e.t * 0.02) * 70; e.cy = cy + Math.sin(e.t * 0.031) * 22;
        if (dist(e.cx, e.cy, pcx, pcy) < 46) {
          if (P.slow === 0) once('hqno', 'HQNO blocks respiration: slower and weaker jumps for a few seconds.');
          P.slow = 150;
        }
        break;
      }
      case 'lasa': {
        // Walk, turn at walls and ledges.
        const nx = e.x + e.vx;
        const front = e.vx < 0 ? nx : nx + e.w;
        const ftx = Math.floor(front / TILE), fty = Math.floor((e.y + e.h - 1) / TILE);
        if (tileAt(ftx, fty) === '#' || tileAt(ftx, fty + 1) === ' ' || tileAt(ftx, fty + 1) === '^') e.vx = -e.vx; else e.x = nx;
        if (overlap(P, e)) {
          const prevBottom = P.y + P.h - P.vy;
          if (P.vy > 0 && prevBottom <= e.y + 8) {
            e.alive = false; P.vy = JUMP_V * 0.7; L.points += 200;
            toast('LasA neutralised! +200', 90);
          } else hurt('lasa', 'LasA protease cut into your cell wall.');
        }
        break;
      }
      case 'sidero': {
        if (e.cool > 0) e.cool--;
        // Wake up when the player is near, then hunt the nearest free iron.
        let target = null;
        if (Math.abs(e.hx - pcx) < 420) {
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
          once('sidero', 'A siderophore grabbed that iron. Competition for Fe!');
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
  // Remove dead drops so the list does not grow forever.
  if (L.time % 120 === 0) L.ents = L.ents.filter(e => e.alive || e.type !== 'drop');
}

function finishLevel() {
  const timeBonus = L.def.timeLimit ? Math.max(0, Math.round((L.def.timeLimit - L.time / 60) * 20)) : 0;
  const repBonus = P.reps * 500;
  const total = L.points + timeBonus + repBonus;
  G.score += total;
  G.results[G.levelIdx] = { name: L.def.name, points: L.points, timeBonus, repBonus, total, cystine: L.cystine, iron: L.ironTotal, reps: P.reps, secs: L.time / 60 };
  setState('levelDone');
}

// ---- the state machine -----------------------------------------------------------
function update() {
  switch (G.state) {
    case 'title': {
      const order = ['anc', 'stk', 'stp'];
      if (took('s1')) G.strain = 'anc';
      if (took('s2')) G.strain = 'stk';
      if (took('s3')) G.strain = 'stp';
      if (took('left')) G.strain = order[(order.indexOf(G.strain) + 2) % 3];
      if (took('right')) G.strain = order[(order.indexOf(G.strain) + 1) % 3];
      if (took('ok') || took('jump')) startGame();
      break;
    }
    case 'intro':
      if (took('ok') || took('jump')) setState('play');
      break;
    case 'play':
      if (took('pause')) { setState('paused'); break; }
      updatePlay();
      break;
    case 'paused':
      if (took('pause') || took('ok')) setState('play');
      break;
    case 'levelDone':
      if (took('ok') || took('jump')) {
        if (G.levelIdx + 1 < LEVELS.length) { G.levelIdx++; loadLevel(G.levelIdx); setState('intro'); }
        else {
          if (G.score > G.best) { G.best = G.score; saveBest(G.best); G.newBest = true; } else G.newBest = false;
          setState('win');
        }
      }
      break;
    case 'gameOver':
      if (took('ok') || took('jump')) { G.failReason = ''; loadLevel(G.levelIdx); setState('intro'); }
      break;
    case 'win':
      if (took('ok') || took('jump')) setState('title');
      break;
  }
}

// ---- drawing ---------------------------------------------------------------------
function text(str, x, y, { size = 18, color = '#222', align = 'left', weight = '600', font = 'system-ui, sans-serif' } = {}) {
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.fillText(str, x, y);
}
function wrap(str, maxW, size = 14) {
  ctx.font = `600 ${size}px system-ui, sans-serif`;
  const words = str.split(' '), lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}
function roundRect(x, y, w, h, r, fill, stroke) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
}

function drawBackground(theme) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, theme.sky[0]); g.addColorStop(1, theme.sky[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // Floating "molecules" with slow parallax.
  ctx.fillStyle = theme.dots;
  for (const d of L.dots) {
    d.y -= d.v; if (d.y < -10) { d.y = VIEW_H + 10; d.x = Math.random() * VIEW_W; }
    const x = ((d.x - L.cam * 0.3) % VIEW_W + VIEW_W) % VIEW_W;
    ctx.beginPath(); ctx.arc(x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
  }
}

function drawTiles(theme) {
  const c0 = Math.max(0, Math.floor(L.cam / TILE)), c1 = Math.min(L.cols - 1, c0 + Math.ceil(VIEW_W / TILE) + 1);
  for (let ty = 0; ty < ROWS; ty++) for (let tx = c0; tx <= c1; tx++) {
    const c = L.grid[ty][tx], x = tx * TILE - L.cam, y = ty * TILE;
    if (c === '#') {
      ctx.fillStyle = theme.soil; ctx.fillRect(x, y, TILE, TILE);
      if (tileAt(tx, ty - 1) !== '#') { ctx.fillStyle = theme.top; ctx.fillRect(x, y, TILE, 8); }
      ctx.fillStyle = '#0000000f'; ctx.fillRect(x + ((tx * 7) % 20), y + 14 + ((ty * 5) % 10), 4, 4);
    } else if (c === '=') {
      roundRect(x + 1, y, TILE - 2, 10, 4, theme.plat);
    } else if (c === '^') {
      ctx.fillStyle = '#7a1f2b';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.moveTo(x + 2 + i * 10, y + TILE); ctx.lineTo(x + 7 + i * 10, y + 12); ctx.lineTo(x + 12 + i * 10, y + TILE); ctx.fill();
      }
    }
  }
}

function drawSigns() {
  const pcx = P.x + P.w / 2;
  for (const s of L.signs) {
    const x = s.tx * TILE + 16 - L.cam;
    if (x < -40 || x > VIEW_W + 40) continue;
    ctx.fillStyle = '#6b4a2b'; ctx.fillRect(x - 2, GROUND * TILE - 30, 4, 30);
    roundRect(x - 12, GROUND * TILE - 40, 24, 16, 3, '#a87b4f');
    text('i', x, GROUND * TILE - 27, { size: 12, color: '#fff', align: 'center', weight: '800' });
    if (Math.abs(s.tx * TILE + 16 - pcx) < TILE * 5) {
      const lines = wrap(s.text, 300);
      const h = lines.length * 18 + 14, w = 320;
      const bx = clamp(x - w / 2, 8, VIEW_W - w - 8), by = GROUND * TILE - 60 - h;
      roundRect(bx, by, w, h, 8, '#ffffffee', '#6b4a2b');
      lines.forEach((ln, i) => text(ln, bx + 10, by + 22 + i * 18, { size: 14, color: '#2b2b2b' }));
    }
  }
}

function drawEntities() {
  for (const e of L.ents) {
    if (!e.alive || e.type === 'start') continue;
    const x = e.x - L.cam, y = e.y;
    if (x < -120 || x > VIEW_W + 120) continue;
    const bob = Math.sin((e.t + e.tx * 13) * 0.08) * 3;
    switch (e.type) {
      case 'cystine': // two S atoms bonded: S–S
        ctx.strokeStyle = '#8a6d00'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x + 9, y + 16 + bob); ctx.lineTo(x + 23, y + 16 + bob); ctx.stroke();
        for (const dx of [8, 24]) { ctx.fillStyle = '#f2cc1d'; ctx.beginPath(); ctx.arc(x + dx, y + 16 + bob, 7, 0, Math.PI * 2); ctx.fill(); }
        text('S', x + 8, y + 20 + bob, { size: 10, color: '#5a4500', align: 'center', weight: '800' });
        text('S', x + 24, y + 20 + bob, { size: 10, color: '#5a4500', align: 'center', weight: '800' });
        break;
      case 'iron':
        ctx.fillStyle = '#b5532c'; ctx.beginPath(); ctx.arc(x + 16, y + 16 + bob, 10, 0, Math.PI * 2); ctx.fill();
        text('Fe', x + 16, y + 20 + bob, { size: 11, color: '#fff', align: 'center', weight: '800' });
        break;
      case 'ahpc':
      case 'tcya': {
        const col = e.type === 'ahpc' ? '#3a7bd5' : '#c79a00';
        roundRect(x + 2, y + 6 + bob, 28, 22, 6, col, '#ffffffaa');
        text(e.type === 'ahpc' ? 'AhpC' : 'TcyA', x + 16, y + 21 + bob, { size: 10, color: '#fff', align: 'center', weight: '800' });
        break;
      }
      case 'check':
        ctx.fillStyle = '#555'; ctx.fillRect(x + 14, y - 16, 3, 48);
        ctx.fillStyle = e.on ? '#2eaa5c' : '#bbb';
        ctx.beginPath(); ctx.moveTo(x + 17, y - 16); ctx.lineTo(x + 34, y - 9); ctx.lineTo(x + 17, y - 2); ctx.fill();
        break;
      case 'goal': {
        // A simple LC-MS/MS: grey box, screen with a little spectrum.
        roundRect(x, y - TILE, TILE * 2, TILE * 2, 6, '#c9ccd1', '#6d7178');
        roundRect(x + 8, y - TILE + 8, 48, 26, 3, '#18222e');
        ctx.strokeStyle = '#4fe3a1'; ctx.lineWidth = 2; ctx.beginPath();
        for (let i = 0; i < 9; i++) { const px = x + 12 + i * 5; ctx.moveTo(px, y - TILE + 30); ctx.lineTo(px, y - TILE + 30 - ((i * 7 + e.t / 6) % 17)); }
        ctx.stroke();
        text('LC-MS/MS', x + TILE, y + 26, { size: 10, color: '#333', align: 'center', weight: '800' });
        if (L.def.need) text(`${Math.min(L.cystine, L.def.need)}/${L.def.need} S–S`, x + TILE, y - TILE - 6, { size: 12, color: L.cystine >= L.def.need ? '#1b7f3b' : '#8a1f2b', align: 'center', weight: '800' });
        break;
      }
      case 'dripper':
        roundRect(x + 4, y + 2, 24, 18, 6, '#2b5d8a');
        text('Pyo', x + 16, y + 15, { size: 9, color: '#cfe8ff', align: 'center', weight: '800' });
        break;
      case 'drop':
        ctx.fillStyle = '#1f78c8';
        ctx.beginPath(); ctx.moveTo(x + 4, y); ctx.quadraticCurveTo(x + 10, y + 9, x + 4, y + 11); ctx.quadraticCurveTo(x - 2, y + 9, x + 4, y); ctx.fill();
        break;
      case 'hqno': {
        const cx = e.cx - L.cam, cy = e.cy;
        ctx.fillStyle = '#6fa83f55';
        for (const [dx, dy, r] of [[0, 0, 30], [-22, 6, 20], [22, 4, 22], [6, -14, 18]]) { ctx.beginPath(); ctx.arc(cx + dx, cy + dy, r, 0, Math.PI * 2); ctx.fill(); }
        text('HQNO', cx, cy + 5, { size: 12, color: '#3d6420', align: 'center', weight: '800' });
        break;
      }
      case 'lasa': {
        roundRect(x, y, e.w, e.h, 8, '#8c2f39');
        // "scissor" jaws in walking direction
        const fx = e.vx < 0 ? x - 2 : x + e.w + 2, open = Math.abs(Math.sin(e.t * 0.2)) * 6;
        ctx.strokeStyle = '#ddd'; ctx.lineWidth = 3; ctx.beginPath();
        ctx.moveTo(x + e.w / 2, y + 10); ctx.lineTo(fx, y + 6 - open); ctx.moveTo(x + e.w / 2, y + 10); ctx.lineTo(fx, y + 14 + open); ctx.stroke();
        text('LasA', x + e.w / 2, y + 14, { size: 9, color: '#fff', align: 'center', weight: '800' });
        break;
      }
      case 'sidero': {
        const cx = e.cx - L.cam, cy = e.cy;
        ctx.strokeStyle = '#e2741d'; ctx.lineWidth = 3;
        for (let k = 0; k < 3; k++) { const a = e.t * 0.05 + k * 2.1; ctx.beginPath(); ctx.arc(cx, cy, 12, a, a + 1.4); ctx.stroke(); }
        ctx.fillStyle = '#e2741d'; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
        break;
      }
    }
  }
}

function drawPlayer() {
  if (P.inv > 0 && Math.floor(P.inv / 5) % 2 === 0) return;  // blink after a hit
  const S = STRAINS[G.strain];
  const cx = P.x + P.w / 2 - L.cam, cy = P.y + P.h / 2;
  if (P.shield > 0) { ctx.fillStyle = '#3a7bd533'; ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2); ctx.fill(); }
  // A golden coccus ("aureus" = golden), ringed in the strain colour.
  const g = ctx.createRadialGradient(cx - 5, cy - 6, 2, cx, cy, 15);
  g.addColorStop(0, '#ffe680'); g.addColorStop(1, P.slow > 0 ? '#9fb34a' : '#d9a514');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = S.colour; ctx.lineWidth = 3; ctx.stroke();
  // eyes look where you run
  ctx.fillStyle = '#fff';
  for (const dx of [-4, 4]) { ctx.beginPath(); ctx.arc(cx + dx + P.face * 3, cy - 3, 3.2, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#222';
  for (const dx of [-4, 4]) { ctx.beginPath(); ctx.arc(cx + dx + P.face * 4, cy - 3, 1.5, 0, Math.PI * 2); ctx.fill(); }
  if (P.phos > 0) {
    ctx.fillStyle = '#7b3fb5'; ctx.beginPath(); ctx.arc(cx + 12, cy - 14, 7, 0, Math.PI * 2); ctx.fill();
    text('P', cx + 12, cy - 10, { size: 10, color: '#fff', align: 'center', weight: '800' });
  }
  if (P.slow > 0) text('z', cx + 14, cy - 12 - (L.time % 30) / 3, { size: 12, color: '#3d6420', weight: '800' });
}

function drawHUD() {
  const S = STRAINS[G.strain];
  roundRect(8, 8, VIEW_W - 16, 38, 8, '#ffffffd9');
  text(`${S.label} · ${L.def.name}`, 20, 33, { size: 16, color: S.colour, weight: '800' });
  // Replicates as three little sample tubes.
  for (let i = 0; i < 3; i++) {
    const x = 150 + i * 20;
    roundRect(x, 16, 12, 22, 4, i < P.reps ? '#d9a514' : '#ffffff', '#555');
  }
  text('replicates', 214, 32, { size: 12, color: '#555' });
  text(`S–S ${L.cystine}${L.def.need ? '/' + L.def.need : ''}`, 300, 33, { size: 15, color: '#8a6d00' });
  text(`Fe ${'●'.repeat(L.ironBank)}${'○'.repeat(3 - L.ironBank)}`, 390, 33, { size: 15, color: '#b5532c' });
  text(`score ${G.score + L.points}`, 490, 33, { size: 15, color: '#333' });
  let x = 620;
  if (P.shield > 0) { text('AhpC', x, 33, { size: 13, color: '#3a7bd5', weight: '800' }); x += 50; }
  if (P.magnet > 0) { text(`TcyA ${Math.ceil(P.magnet / 60)}`, x, 33, { size: 13, color: '#c79a00', weight: '800' }); x += 64; }
  if (P.slow > 0) { text('HQNO', x, 33, { size: 13, color: '#3d6420', weight: '800' }); }
  if (L.def.timeLimit) {
    // Game seconds left × 12 = pulse seconds left (75 game s = 15 min).
    const left = Math.max(0, L.def.timeLimit - L.time / 60) * 12;
    const mm = Math.floor(left / 60), ss = Math.floor(left % 60);
    text(`pulse ${mm}:${String(ss).padStart(2, '0')}`, VIEW_W - 20, 33, { size: 16, color: left < 120 ? '#b3261e' : '#2b5d8a', align: 'right', weight: '800' });
  }
  if (G.toastT > 0 && G.toast) {
    const lines = wrap(G.toast, 560, 16);
    const h = lines.length * 22 + 14;
    ctx.globalAlpha = Math.min(1, G.toastT / 30);
    roundRect(VIEW_W / 2 - 300, 56, 600, h, 10, '#1d2733e8');
    lines.forEach((ln, i) => text(ln, VIEW_W / 2, 78 + i * 22, { size: 16, color: '#fff', align: 'center' }));
    ctx.globalAlpha = 1;
  }
}

function panel(title, sub, lines, footer, accent = '#2b5d8a') {
  ctx.fillStyle = '#0b1a24cc'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  roundRect(130, 70, 700, 400, 16, '#fbf8f1', accent);
  text(title, VIEW_W / 2, 130, { size: 34, color: accent, align: 'center', weight: '800' });
  if (sub) text(sub, VIEW_W / 2, 162, { size: 17, color: '#555', align: 'center' });
  lines.forEach((ln, i) => text(ln, VIEW_W / 2, 215 + i * 28, { size: 17, color: '#2b2b2b', align: 'center', weight: '500' }));
  if (footer && Math.floor(performance.now() / 500) % 2 === 0) text(footer, VIEW_W / 2, 445, { size: 16, color: accent, align: 'center', weight: '700' });
}

function strainCards() {
  return ['anc', 'stk', 'stp'].map((key, i) => ({ key, x: 90 + i * 270, y: 230, w: 240, h: 200 }));
}

function drawTitle() {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, '#fff2c9'); g.addColorStop(1, '#8fc3c4');
  ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  text('JE2 JUMP', VIEW_W / 2, 95, { size: 60, color: '#7a5a00', align: 'center', weight: '900' });
  text('A Staphylococcus aureus platformer from the Bio253 proteomics course', VIEW_W / 2, 132, { size: 18, color: '#4d4d4d', align: 'center' });
  text('TSB → SNpulse → SN.  Collect cystine, keep your 3 replicates, reach the LC-MS/MS.', VIEW_W / 2, 175, { size: 16, color: '#2b2b2b', align: 'center', weight: '500' });
  text('Choose your strain (1 / 2 / 3, ← →, or click):', VIEW_W / 2, 210, { size: 16, color: '#2b2b2b', align: 'center' });
  for (const c of strainCards()) {
    const S = STRAINS[c.key], sel = G.strain === c.key;
    roundRect(c.x, c.y, c.w, c.h, 14, sel ? '#ffffff' : '#ffffffaa', sel ? S.colour : '#9993');
    if (sel) { ctx.lineWidth = 4; ctx.strokeStyle = S.colour; ctx.beginPath(); ctx.roundRect(c.x, c.y, c.w, c.h, 14); ctx.stroke(); }
    ctx.fillStyle = '#d9a514'; ctx.beginPath(); ctx.arc(c.x + 40, c.y + 42, 18, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = S.colour; ctx.lineWidth = 4; ctx.stroke();
    text(S.label, c.x + 70, c.y + 40, { size: 26, color: S.colour, weight: '900' });
    text(S.title, c.x + 70, c.y + 60, { size: 13, color: '#555' });
    S.lines.forEach((ln, i) => text(ln, c.x + 16, c.y + 100 + i * 22, { size: 13, color: '#2b2b2b', weight: '500' }));
  }
  text(`Press Enter / Space to start${G.best ? '   ·   best score ' + G.best : ''}`, VIEW_W / 2, 480, { size: 17, color: '#1d2733', align: 'center', weight: '700' });
  text('PASN = cell-free spent medium of P. aeruginosa PAO1 (no living Pseudomonas).', VIEW_W / 2, 515, { size: 13, color: '#1d2733aa', align: 'center', weight: '500' });
}

function drawWorld() {
  drawBackground(L.def.theme);
  drawTiles(L.def.theme);
  drawSigns();
  drawEntities();
  drawPlayer();
  drawHUD();
}

function draw() {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  if (G.state === 'title') { drawTitle(); return; }
  drawWorld();
  const S = STRAINS[G.strain];
  switch (G.state) {
    case 'intro':
      panel(`Level ${G.levelIdx + 1}: ${L.def.name}`, L.def.subtitle, L.def.intro.concat(['', `Playing as ${S.label} (${S.title})`]), 'Press Enter / Space / tap to start');
      break;
    case 'paused':
      panel('Paused', '', ['Press P or Enter to continue.'], '');
      break;
    case 'levelDone': {
      const r = G.results[G.levelIdx];
      const stats = `S–S ${r.cystine} · Fe ${r.iron} · replicates ${r.reps}/3 · ${r.secs.toFixed(0)} s   →   +${r.total} points`;
      panel(`${L.def.name}: sample measured!`, stats, LEVEL_FACTS[G.levelIdx], 'Press Enter to continue', '#1b7f3b');
      break;
    }
    case 'gameOver':
      panel(G.failReason === 'pulse' ? 'Pulse over' : 'n = 0', G.failReason === 'pulse' ? 'Your sample missed the 15-min time point.' : 'No replicates left.',
        G.failReason === 'pulse'
          ? ['In the real experiment the pulse samples were', 'harvested after exactly 15 min in PASN.', 'Try again, a bit faster.']
          : ['With zero replicates there is nothing to compare:', 'no mean, no variance, no test.', 'Even n = 3 is small, so protect your replicates!'],
        'Press Enter to retry this level', '#b3261e');
      break;
    case 'win':
      panel('All samples measured!', `Strain ${S.label} · total score ${G.score}${G.newBest ? '  (new best!)' : ''}`,
        G.results.map(r => `${r.name}: ${r.total} points (S–S ${r.cystine}, Fe ${r.iron}, ${r.reps}/3 replicates)`).concat([''], strainFact(G.strain)),
        'Press Enter to play another strain', '#7a5a00');
      break;
  }
}

// ---- main loop: fixed-step update, draw every animation frame -----------------------
let last = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min(100, now - last); last = now;
  while (acc >= STEP_MS) { update(); acc -= STEP_MS; }
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
