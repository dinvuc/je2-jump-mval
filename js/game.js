'use strict';
// game.js -- "JE2 Jump": a small platformer about the Bio253 JE2 proteomics course.
// Plain JavaScript + <canvas>, no libraries, no build step: open index.html and play.
// Needs facts.js (STRAINS, LEVEL_FACTS, strainFact) and levels.js (LEVELS).

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
const PHOS_TIME = 600;                      // phospho-switch stays ON for 10 s
const PULSE_S = 900;                        // the SNpulse clock shows 15 min

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// ---- input -----------------------------------------------------------------------
const keys = {};      // held right now
const pressed = {};   // pressed since last read (read with took())
const KEYMAP = {
  ArrowLeft: ['left'], KeyA: ['left'], ArrowRight: ['right'], KeyD: ['right'],
  ArrowUp: ['jump', 'up'], KeyW: ['jump', 'up'], ArrowDown: ['down'], KeyS: ['down'],
  Space: ['jump', 'confirm'], Enter: ['ok', 'confirm'],
  KeyP: ['pause'], Escape: ['pause'], Digit1: ['s1'], Digit2: ['s2'], Digit3: ['s3'],
  KeyM: ['mute'], KeyN: ['music'],
};
function press(k) { if (!keys[k]) pressed[k] = true; keys[k] = true; }
function release(k) { keys[k] = false; }
addEventListener('keydown', e => {
  AUDIO.unlock();
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

// ---- audio: synthesised effects and an original chiptune soundtrack ----------------
// Everything is generated with Web Audio oscillators and noise: no sound files, no
// samples, no third-party music. The soundtrack below was composed for this game.
// The audio context only starts after a key press or click (browser rule).
const AUDIO = (() => {
  let ac = null, sfxBus = null, musBus = null, noise = null;
  let sfxOn = true, musicOn = true;
  try {
    sfxOn = localStorage.getItem('je2jump_muted') !== '1';
    musicOn = localStorage.getItem('je2jump_music') !== '0';
  } catch { /* private mode */ }
  const save = () => { try { localStorage.setItem('je2jump_muted', sfxOn ? '0' : '1'); localStorage.setItem('je2jump_music', musicOn ? '1' : '0'); } catch { /* private mode */ } };
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);

  function init() {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    sfxBus = ac.createGain(); sfxBus.gain.value = 1; sfxBus.connect(ac.destination);
    musBus = ac.createGain(); musBus.gain.value = 0.55; musBus.connect(ac.destination);
    noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    setInterval(schedule, 25);
  }
  function tone(f0, f1, dur, type, vol, t, bus) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus); o.start(t); o.stop(t + dur + 0.03);
  }
  function hiss(dur, vol, t, freq, bus) {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noise; f.type = 'highpass'; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(bus); s.start(t); s.stop(t + dur + 0.02);
  }

  // -- sound effects --
  const fx = (f0, f1, dur, type = 'square', vol = 0.05, delay = 0) => tone(f0, f1, dur, type, vol, ac.currentTime + delay, sfxBus);
  const arp = (fs, step, type = 'triangle', vol = 0.05, dur = 0.12) => fs.forEach((f, i) => fx(f, f, dur, type, vol, i * step));
  const SOUNDS = {
    jump: () => fx(300, 560, 0.12, 'square', 0.03),
    dj: () => fx(520, 1040, 0.14, 'triangle', 0.05),
    cys: k => { const m = 1 + 0.12 * (k - 1); fx(880 * m, 880 * m, 0.06, 'square', 0.025); fx(1320 * m, 1320 * m, 0.09, 'square', 0.025, 0.05); },
    iron: k => { const m = 1 + 0.12 * (k - 1); fx(520 * m, 980 * m, 0.14, 'triangle', 0.06); },
    power: () => arp([523, 659, 784, 1047], 0.06),
    hurt: () => fx(220, 70, 0.3, 'sawtooth', 0.05),
    stomp: () => fx(420, 110, 0.16, 'square', 0.045),
    check: () => arp([784, 1175], 0.08, 'sine', 0.06),
    pop: () => fx(900, 300, 0.08, 'sine', 0.04),
    crack: () => { fx(170, 55, 0.14, 'sawtooth', 0.035); hiss(0.12, 0.05, ac.currentTime, 1500, sfxBus); },
    signal: () => arp([392, 523, 659, 784, 1047], 0.05, 'sine', 0.05, 0.18),
    off: () => arp([660, 440], 0.08, 'sine', 0.04),
    done: () => arp([523, 659, 784, 1047, 1319], 0.09, 'triangle', 0.06, 0.16),
    fail: () => arp([392, 330, 262, 196], 0.14, 'triangle', 0.06, 0.2),
    click: () => fx(660, 660, 0.05, 'square', 0.03),
    move: () => fx(440, 440, 0.03, 'square', 0.02),
  };

  // -- the soundtrack: 8 bars (128 sixteenth steps), chords C Am F G | C Am F G --
  // Melody notes: [step, midi note, length in steps]. Original composition.
  const MELODY = [
    [0, 76, 2], [2, 79, 2], [4, 84, 3], [8, 83, 1], [9, 84, 1], [10, 79, 2], [12, 76, 4],
    [16, 81, 2], [18, 84, 2], [20, 88, 3], [24, 86, 1], [25, 84, 1], [26, 83, 2], [28, 81, 4],
    [32, 77, 2], [34, 81, 2], [36, 84, 2], [38, 86, 2], [40, 84, 2], [42, 81, 2], [44, 77, 2], [46, 79, 2],
    [48, 79, 3], [51, 81, 1], [52, 83, 2], [54, 86, 2], [56, 91, 4], [60, 86, 2], [62, 83, 2],
    [64, 79, 1], [65, 79, 1], [66, 84, 2], [68, 88, 2], [70, 91, 2], [72, 88, 2], [74, 84, 2], [76, 86, 4],
    [80, 88, 3], [83, 86, 1], [84, 84, 2], [86, 81, 2], [88, 84, 4], [92, 88, 4],
    [96, 89, 2], [98, 88, 2], [100, 86, 2], [102, 84, 2], [104, 81, 4], [108, 84, 2], [110, 86, 2],
    [112, 83, 4], [116, 86, 2], [118, 83, 2], [120, 79, 8],
  ];
  const CHORDS = [[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50]];   // C, Am, F, G
  const melodyAt = new Map(MELODY.map(m => [m[0], m]));
  // Per-medium arrangements: tempo, transposition, minor mode, lead sound, drum density.
  const SONGS = {
    title: { bpm: 108, tr: 0, minor: false, lead: 'square', drums: 1 },
    TSB: { bpm: 116, tr: 0, minor: false, lead: 'square', drums: 1 },
    SNpulse: { bpm: 138, tr: 2, minor: false, lead: 'square', drums: 2 },
    SN: { bpm: 100, tr: -3, minor: true, lead: 'triangle', drums: 1 },
  };
  let song = null, step = 0, nextT = 0;
  const pitch = n => {
    if (song.minor) { const pc = ((n % 12) + 12) % 12; if (pc === 4 || pc === 9 || pc === 11) n -= 1; }   // major -> natural minor
    return midi(n + song.tr);
  };
  function playStep(s, t) {
    const sp = 60 / song.bpm / 4, bar = Math.floor(s / 16), chord = CHORDS[bar % 4], inBar = s % 16;
    const m = melodyAt.get(s);
    if (m) tone(pitch(m[1]), pitch(m[1]), m[2] * sp * 0.95, song.lead, song.lead === 'square' ? 0.035 : 0.07, t, musBus);
    if (inBar % 2 === 0) {                                   // bouncy octave bass
      const n = chord[0] - 12 + (inBar % 4 === 2 ? 12 : 0);
      tone(pitch(n), pitch(n), sp * 1.6, 'triangle', 0.11, t, musBus);
    }
    const an = chord[inBar % 3] + 12;                        // soft arpeggio
    tone(pitch(an), pitch(an), sp * 0.9, 'sine', 0.025, t, musBus);
    if (inBar === 0 || inBar === 8 || (song.drums > 1 && inBar === 10)) tone(150, 45, 0.14, 'sine', 0.22, t, musBus);   // kick
    if (inBar === 4 || inBar === 12) hiss(0.11, 0.07, t, 1200, musBus);                                                  // snare
    if (song.drums > 1 ? true : inBar % 2 === 0) hiss(0.03, inBar % 4 === 2 ? 0.035 : 0.018, t, 7000, musBus);          // hi-hat
  }
  function schedule() {
    if (!ac || !song || !musicOn) return;
    if (nextT < ac.currentTime - 0.2) nextT = ac.currentTime + 0.05;   // tab was in the background
    while (nextT < ac.currentTime + 0.12) {
      playStep(step, nextT);
      nextT += 60 / song.bpm / 4;
      step = (step + 1) % 128;
    }
  }

  return {
    play(name, arg = 1) { if (ac && sfxOn && SOUNDS[name]) SOUNDS[name](arg); },
    unlock() {
      if (!ac) { try { init(); } catch { return; } }
      if (ac.state === 'suspended') ac.resume();
    },
    music(name) {
      const s = SONGS[name] || SONGS.title;
      if (s === song) return;
      song = s; step = 0; if (ac) nextT = ac.currentTime + 0.08;
    },
    duck(on) { if (musBus) musBus.gain.setTargetAtTime(on ? 0.15 : 0.55, ac.currentTime, 0.1); },
    toggleSfx() { sfxOn = !sfxOn; save(); },
    toggleMusic() { musicOn = !musicOn; save(); if (ac) nextT = ac.currentTime + 0.05; },
    get sfxOn() { return sfxOn; },
    get musicOn() { return musicOn; },
  };
})();

// Touch buttons (only shown on touch screens).
const touchBox = document.getElementById('touch');
if (matchMedia('(pointer: coarse)').matches) touchBox.hidden = false;
for (const b of touchBox.querySelectorAll('button')) {
  const k = b.dataset.key;
  b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); AUDIO.unlock(); press(k); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => release(k));
}

// Clicks / taps on the canvas: strain cards on the title, items in the pause menu,
// otherwise "continue".
canvas.addEventListener('pointerdown', e => {
  const r = canvas.getBoundingClientRect();
  const x = (e.clientX - r.left) * VIEW_W / r.width;
  const y = (e.clientY - r.top) * VIEW_H / r.height;
  if (G.state === 'title') {
    const hit = strainCards().find(c => x > c.x && x < c.x + c.w && y > c.y && y < c.y + c.h);
    if (hit) { G.strain = hit.key; AUDIO.play('click'); startGame(); }
  } else if (G.state === 'paused') {
    const i = menuRects().findIndex(m => x > m.x && x < m.x + m.w && y > m.y && y < m.y + m.h);
    if (i >= 0) { G.menuIdx = i; menuSelect(); }
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
const G = { state: 'title', strain: 'anc', levelIdx: 0, score: 0, results: [], toast: '', toastT: 0, best: loadBest(), seen: {}, shake: 0, menuIdx: 0 };
let L = null;  // the running level
let P = null;  // the player

function setState(s) {
  G.state = s; clearPressed();
  AUDIO.music(s === 'title' ? 'title' : L ? L.def.name : 'title');
  AUDIO.duck(s === 'paused');
}

function startGame() {
  G.levelIdx = 0; G.score = 0; G.results = []; G.seen = {};
  loadLevel(0);
  setState('intro');
}

function loadLevel(i) {
  const def = LEVELS[i];
  const b = def.build();
  L = {
    def, cols: b.cols, rows: b.rows, grid: b.grid, signs: b.signs,
    ents: b.ents.map(e => ({ ...e, x: e.tx * TILE, y: e.ty * TILE, alive: true, t: 0 })),
    time: 0, cam: 0, camY: 0, cystine: 0, ironBank: 0, ironTotal: 0, points: 0, goalMsgT: 0,
    fx: [], pops: [], movers: [], blocks: [], lysis: new Map(), chan: {}, solids: [], plats: [],
    combo: 0, comboT: 0,
    art: buildLevelArt(b, def.theme, i),
  };
  L.totalCys = L.ents.filter(e => e.type === 'cystine').length;
  for (const e of L.ents) initEntity(e);
  for (const e of L.ents) if (e.ch && (e.type === 'gate' || e.type === 'shuttle')) {
    const src = L.ents.find(o => (o.type === 'agrc' || o.type === 'phos') && o.ch === e.ch);
    e.src = src ? src.type : '';
  }
  const start = L.ents.find(e => e.type === 'start');
  L.respawn = { x: start.x + 4, y: start.y + 4 };
  P = {
    x: L.respawn.x, y: L.respawn.y, w: 24, h: 28, vx: 0, vy: 0,
    onGround: false, coyote: 0, buffer: 0, djReady: true, groundT: 0,
    face: 1, inv: 0, slow: 0, shield: 0, magnet: 0, phos: 0, reps: 3, squash: 0, ride: null, roll: 0,
  };
  G.toast = ''; G.toastT = 0; G.failReason = ''; G.shake = 0;
  L.solids = dynSolids();
  snapCamera();
}

function initEntity(e) {
  switch (e.type) {
    case 'lasa': e.w = 28; e.h = 22; e.y = e.ty * TILE + TILE - e.h; e.vx = -1.1; break;
    case 'sidero': e.hx = e.x + 16; e.hy = e.y + 16; e.cx = e.hx; e.cy = e.hy; e.cool = 0; break;
    case 'hqno': e.cx = e.x + 16; e.cy = e.y + 16; break;   // drawn before its first update
    case 'vent': e.cool = 20; e.rise = e.rise || 10; break;
    case 'gate': e.h = e.h || 4; e.open = 0; break;
    case 'shuttle':
      e.len = e.len || 3; e.x0 = e.x; e.y0 = e.y; e.x1 = e.to[0] * TILE; e.y1 = e.to[1] * TILE;
      e.px = e.x; e.py = e.y; e.dir = 1; e.dx = 0; e.dy = 0; e.wait = 0;
      e.top = e.py; e.pl = e.px; e.pr = e.px + e.len * TILE;
      break;
    case 'agrb': e.cool = 0; e.block = { x: e.x + TILE, y: e.y, w: TILE, h: TILE, vy: 0, home: e, docked: false, block: true }; L.blocks.push(e.block); break;
    case 'agrc': e.on = false; break;
    case 'phos': e.timer = 0; break;
  }
}

function toast(text, frames = 200) { G.toast = text; G.toastT = frames; }
function once(key, text) { if (!G.seen[key]) { G.seen[key] = true; toast(text, 260); } }

// ---- camera: follows the player in x and y ---------------------------------------
function cameraTarget() {
  return [
    clamp(P.x + P.w / 2 - VIEW_W * 0.4, 0, L.cols * TILE - VIEW_W),
    clamp(P.y + P.h / 2 - VIEW_H * 0.55, 0, L.rows * TILE - VIEW_H),
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

// Dynamic solids: closed gates and AIP blocks.
function dynSolids() {
  const out = [];
  for (const e of L.ents) if (e.type === 'gate') {
    const h = e.h * TILE * (1 - e.open);
    if (h > 2) out.push({ x: e.x + 4, y: e.y, w: TILE - 8, h, gate: e });
  }
  return out.concat(L.blocks);
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
  for (const r of L.solids) {
    if (!overlap(P, r) || P.y + P.h <= r.y + 6) continue;   // standing on top is moveY's job
    if (r.block && !r.docked && P.vx !== 0) {
      pushBlock(r, P.vx > 0 ? P.x + P.w - r.x : P.x - (r.x + r.w));
      P.vx = clamp(P.vx, -1.9, 1.9);                         // pushing is slower
    }
    if (!overlap(P, r)) continue;
    if (P.x + P.w / 2 < r.x + r.w / 2) P.x = r.x - P.w; else P.x = r.x + r.w;
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
        if (c === '#' || oneWay(c)) { P.y = R * TILE - P.h; P.vy = 0; P.onGround = true; break; }
      }
    }
    // b) solid tiles we have sunk into
    if (!P.onGround) {
      const ty = Math.floor((P.y + P.h - 1) / TILE);
      for (let tx = left; tx <= right; tx++) if (tileAt(tx, ty) === '#') { P.y = ty * TILE - P.h; P.vy = 0; P.onGround = true; break; }
    }
  } else if (P.vy < 0) {
    const ty = Math.floor(P.y / TILE);
    for (let tx = left; tx <= right; tx++) if (tileAt(tx, ty) === '#') { P.y = (ty + 1) * TILE; P.vy = 0; break; }
  }
  // Moving platforms (air bubbles, bridges): one-way, they carry you. They can
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

// ---- puzzles: AIP blocks, AgrC receptors, gates, phospho-switches, moving bridges ----
function pushBlock(b, d) {
  if (!d) return;
  b.x += d;
  const top = Math.floor(b.y / TILE), bot = Math.floor((b.y + b.h - 1) / TILE);
  const tx = Math.floor((d > 0 ? b.x + b.w - 1 : b.x) / TILE);
  for (let ty = top; ty <= bot; ty++) if (tileAt(tx, ty) === '#') { b.x = d > 0 ? tx * TILE - b.w : (tx + 1) * TILE; break; }
  for (const r of L.solids) if (r !== b && overlap(b, r)) b.x = d > 0 ? r.x - b.w : r.x + r.w;
}
function resetBlock(b) {
  for (const e of L.ents) if (e.type === 'agrc' && e.block === b) { e.on = false; e.block = null; }
  b.x = b.home.x + TILE; b.y = b.home.y; b.vy = 0; b.docked = false;
}
function updateBlocks() {
  for (const b of L.blocks) {
    if (b.docked) continue;
    const col = Math.floor((b.x + b.w / 2) / TILE);
    const below = tileAt(col, Math.round((b.y + b.h) / TILE));
    const resting = b.vy === 0 && Math.abs((b.y + b.h) % TILE) < 0.01 && (below === '#' || oneWay(below));
    if (resting) continue;
    if (b.vy === 0) b.x = col * TILE;   // tips into the column under its centre (e.g. a receptor notch)
    b.vy = Math.min(b.vy + GRAV, MAX_FALL);
    const prevB = b.y + b.h;
    b.y += b.vy;
    for (let R = Math.ceil(prevB / TILE - 1e-6); R * TILE <= b.y + b.h; R++) {
      const c = tileAt(col, R);
      if (c === '#' || oneWay(c)) {
        b.y = R * TILE - b.h; b.vy = 0;
        const rec = L.ents.find(e => e.type === 'agrc' && e.tx === col && e.ty === R - 1);
        if (rec && !rec.on) {
          b.docked = true; rec.on = true; rec.block = b;
          burst(b.x + 16, b.y + 16, '#7be08f', 18, 3);
          once('agrc', 'AIP bound to its receptor AgrC: the signal is ON!');
        }
        break;
      }
    }
    if (b.y > L.rows * TILE + 64) resetBlock(b);
  }
}
function signalOn(ch) {
  AUDIO.play('signal');
  const src = L.ents.find(o => (o.type === 'agrc' || o.type === 'phos') && o.ch === ch);
  for (const t of L.ents) if (t.ch === ch && (t.type === 'gate' || t.type === 'shuttle') && src) {
    const sx = src.x + 16, sy = src.y + 16, tx = t.x + 16, ty = t.y + 16;
    for (let i = 0; i < 16; i++) {
      const f = 40 + i * 2;
      L.fx.push({ x: sx, y: sy, vx: (tx - sx) / f, vy: (ty - sy) / f, grav: 0, life: f, max: f, color: '#b98ae6', r: 2.5 });
    }
  }
}
function updatePuzzles() {
  const chan = {};
  for (const e of L.ents) {
    if (e.type === 'agrc' && e.on) chan[e.ch] = true;
    if (e.type === 'phos' && e.timer > 0) {
      chan[e.ch] = true;
      if (--e.timer === 0) { AUDIO.play('off'); toast('A phosphatase removed the phosphate: switch OFF.', 120); }
    }
  }
  for (const ch in chan) if (!L.chan[ch]) signalOn(ch);
  L.chan = chan;
  for (const e of L.ents) {
    if (e.type === 'gate') {
      if (chan[e.ch]) e.open = Math.min(1, e.open + 0.035);
      else if (e.open > 0 && !overlap(P, { x: e.x, y: e.y, w: TILE, h: e.h * TILE })) e.open = Math.max(0, e.open - 0.05);
    } else if (e.type === 'shuttle') {
      const on = !e.ch || chan[e.ch];
      const tx = on && e.dir > 0 ? e.x1 : e.x0, ty = on && e.dir > 0 ? e.y1 : e.y0;
      e.dx = 0; e.dy = 0;
      if (e.wait > 0) e.wait--;
      else {
        const d = dist(tx, ty, e.px, e.py), sp = 1.4;
        if (d <= sp) { e.dx = tx - e.px; e.dy = ty - e.py; if (on && d > 0) { e.dir = -e.dir; e.wait = 40; } }
        else { e.dx = (tx - e.px) / d * sp; e.dy = (ty - e.py) / d * sp; }
      }
      e.px += e.dx; e.py += e.dy;
      e.top = e.py; e.pl = e.px; e.pr = e.px + e.len * TILE;
    }
  }
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
    const roof = tileAt(Math.floor(b.x / TILE), Math.floor((b.y - b.r - 34) / TILE)) === '#';
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
  for (const p of L.fx) { p.x += p.vx; p.y += p.vy; p.vy += p.grav; if (p.grav) p.vx *= 0.95; p.life--; }
  if (L.fx.length) L.fx = L.fx.filter(p => p.life > 0);
  for (const p of L.pops) { p.y -= 0.7; p.life--; }
  if (L.pops.length) L.pops = L.pops.filter(p => p.life > 0);
}
// Points with a combo: pick things up quickly one after another for up to x5.
function gain(base, x, y, color) {
  L.combo = L.comboT > 0 ? L.combo + 1 : 1;
  L.comboT = 100;
  const m = Math.min(L.combo, 5), pts = base * m;
  L.points += pts;
  L.pops.push({ x, y: y - 8, text: m > 1 ? `+${pts} x${m}` : `+${pts}`, color, life: 50 });
  return m;
}

// ---- damage ----------------------------------------------------------------------
function loseReplicate(msg) {
  P.reps--;
  toast(P.reps > 0 ? `${msg}  Replicates left: ${P.reps}/3` : msg);
  if (P.reps <= 0) { setState('gameOver'); AUDIO.play('fail'); }
}
function hurt(kind, msg) {
  if (P.inv > 0) return;
  if (kind === 'ros' && P.shield > 0) {
    P.shield = 0; P.inv = 40;
    burst(P.x + P.w / 2, P.y + P.h / 2, '#7fb6ff', 14, 3);
    AUDIO.play('pop');
    toast('AhpC absorbed the ROS. Shield used up.');
    return;
  }
  P.inv = 90; P.vy = -6; P.vx = -P.face * 3;
  burst(P.x + P.w / 2, P.y + P.h / 2, '#e0465a', 12, 3);
  G.shake = 10; AUDIO.play('hurt');
  loseReplicate(msg);
}
function respawn() {
  P.x = L.respawn.x; P.y = L.respawn.y; P.vx = 0; P.vy = 0; P.inv = 60; P.slow = 0; P.ride = null;
  snapCamera();
}

// ---- the main play update --------------------------------------------------------
function updatePlay() {
  const S = STRAINS[G.strain];
  L.time++;

  if (L.def.timeLimit && L.time / 60 > L.def.timeLimit) {
    toast('The 15-min pulse ended before your sample reached the MS.');
    setState('gameOver');
    AUDIO.play('fail');
    G.failReason = 'pulse';
    return;
  }

  updatePuzzles();
  updateMovers();
  updateBlocks();
  updateLysis();
  L.solids = dynSolids();
  L.plats = L.movers.concat(L.ents.filter(e => e.type === 'shuttle'));
  // Ride along with the platform you stand on.
  if (P.ride) {
    if (P.ride.alive === false) P.ride = null;
    else {
      P.y += P.ride.dy;
      if (P.ride.dx) { const v = P.vx; P.vx = P.ride.dx; moveX(); P.vx = v; }
    }
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
      P.coyote = 0; P.buffer = 0; P.squash = -0.22; P.ride = null;
      AUDIO.play('jump');
    } else if (S.doubleJump > 0 && P.djReady) {
      P.vy = JUMP_V * S.doubleJump * (P.slow > 0 ? 0.85 : 1);
      P.djReady = false; P.buffer = 0; P.phos = 30; P.squash = -0.18;   // little "P" badge = phosphorylated
      burst(P.x + P.w / 2, P.y + P.h, '#b98ae6', 8, 2, 0.05, 22);
      AUDIO.play('dj');
    } else if (S.doubleJump === 0 && !P.onGround) {
      once('nodj', 'stk: no Stk1 kinase, so no double jump. Time your jumps!');
    }
  }
  if (!keys.jump && P.vy < -3.5) P.vy = -3.5;      // let go early = lower jump
  P.vy = Math.min(P.vy + GRAV, MAX_FALL);

  const wasGround = P.onGround, fallV = P.vy;
  moveX();
  moveY();
  if (P.onGround && !wasGround && fallV > 4) {
    P.squash = Math.min(0.3, fallV / 32);
    burst(P.x + P.w / 2, P.y + P.h, rgba(L.def.theme.eps, 0.9), 6, 1.6, -0.02, 26);
  }
  P.squash *= 0.82;
  P.roll += P.vx / 14;                                // the cell rolls as it moves
  if (P.onGround && Math.abs(P.vx) > 2.8 && L.time % 7 === 0) {
    burst(P.x + P.w / 2 - P.face * 8, P.y + P.h - 2, rgba(L.def.theme.eps, 0.8), 1, 0.6, -0.03, 20);
  }
  touchLysis();

  for (const t of ['inv', 'slow', 'shield', 'magnet', 'phos']) if (P[t] > 0) P[t]--;

  if (inFoam()) hurt('foam', 'Rhamnolipid foam damaged your membrane.');
  if (G.state !== 'play') return;
  if (P.y > L.rows * TILE + 64) {
    P.inv = 0;
    G.shake = 8; AUDIO.play('hurt');
    loseReplicate('You fell out of the culture.');
    if (G.state !== 'play') return;
    respawn();
  }

  updateEntities();
  updateFx();
  followCamera();
  if (G.toastT > 0) G.toastT--;
  if (L.goalMsgT > 0) L.goalMsgT--;
  if (L.comboT > 0) L.comboT--;
  G.shake = G.shake > 0.5 ? G.shake * 0.85 : 0;
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
          e.alive = false; L.cystine++;
          AUDIO.play('cys', gain(100, cx, cy, '#ffe36a'));
          burst(cx, cy, '#f5d33a', 12, 2.6);
          once('cys', 'L-cystine! A source of sulfur for the cell.');
        }
        break;
      case 'iron':
        if (dist(cx, cy, pcx, pcy) < 24) {
          e.alive = false; L.ironTotal++; L.ironBank++;
          AUDIO.play('iron', gain(50, cx, cy, '#ff9a62'));
          burst(cx, cy, '#e0743c', 12, 2.6);
          if (L.ironBank >= 3) {
            L.ironBank = 0;
            if (P.reps < 3) { P.reps++; toast('3 Fe: one replicate restored!'); }
            else { L.points += 300; toast('3 Fe with all replicates: +300 points'); }
          }
        }
        break;
      case 'ahpc':
        if (dist(cx, cy, pcx, pcy) < 26) { e.alive = false; P.shield = 60 * 20; burst(cx, cy, '#7fb6ff', 14, 3); AUDIO.play('power'); toast('AhpC shield: blocks one ROS hit (20 s).'); }
        break;
      case 'tcya':
        if (dist(cx, cy, pcx, pcy) < 26) { e.alive = false; P.magnet = 60 * 12; burst(cx, cy, '#f0c850', 14, 3); AUDIO.play('power'); toast('TcyA: cystine is pulled towards you (12 s).'); }
        break;
      case 'check':
        if (!e.on && Math.abs(cx - pcx) < 20 && Math.abs(cy - pcy) < 40) {
          for (const o of L.ents) if (o.type === 'check') o.on = false;
          e.on = true; L.respawn = { x: e.x + 4, y: e.y + 4 };
          burst(cx, cy, '#bfe6ff', 14, 2.4, -0.03);
          AUDIO.play('check');
          toast('Glycerol stock saved: you will restart here.', 140);
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
      case 'agrb': // touch AgrB to make a fresh AIP if yours got stuck
        if (e.cool > 0) e.cool--;
        if (e.cool === 0 && !e.block.docked && dist(cx, cy, pcx, pcy) < 26 &&
            (Math.abs(e.block.x - (e.x + TILE)) > 4 || Math.abs(e.block.y - e.y) > 4)) {
          burst(e.block.x + 16, e.block.y + 16, '#c9a7f0', 10, 2);
          resetBlock(e.block);
          burst(e.block.x + 16, e.block.y + 16, '#c9a7f0', 12, 2);
          AUDIO.play('power'); e.cool = 60;
          toast('AgrB made a fresh AIP.', 100);
        }
        break;
      case 'phos':
        if (dist(cx, cy, pcx, pcy) < 26 && e.timer < PHOS_TIME - 30) {
          if (e.timer === 0) burst(cx, cy - 10, '#b98ae6', 14, 2.6);
          e.timer = PHOS_TIME;
          once('phos', 'Phosphorylated: switch ON for 10 s. Go!');
        }
        break;
      case 'dripper':
        // Wait until the player is near, then drop pyocyanin every ~1.6 s.
        if (Math.abs(cx - pcx) < VIEW_W * 0.7 && Math.abs(cy - pcy) < VIEW_H && e.t % 100 === 0) {
          spawned.push({ type: 'drop', x: e.x + 12, y: e.y + 26, vy: 0, alive: true, t: 0 });
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
          if (P.slow === 0) once('hqno', 'HQNO blocks respiration: slower and weaker jumps for a few seconds.');
          P.slow = 150;
        }
        break;
      }
      case 'lasa': {
        // Patrol; charge when the player is close on the same level. Turn at walls, ledges, foam.
        const ex = e.x + e.w / 2, ey = e.y + e.h / 2;
        e.angry = Math.abs(pcy - ey) < 30 && Math.abs(pcx - ex) < 190 && P.inv === 0;
        e.vx = e.angry ? (Math.sign(pcx - ex) || 1) * 2.3 : Math.sign(e.vx) * 1.1;
        const nx = e.x + e.vx;
        const front = e.vx < 0 ? nx : nx + e.w;
        const ftx = Math.floor(front / TILE), fty = Math.floor((e.y + e.h - 1) / TILE);
        const ahead = tileAt(ftx, fty), below = tileAt(ftx, fty + 1);
        if (ahead === '#' || ahead === '^' || below === ' ' || below === '^') e.vx = -e.vx; else e.x = nx;
        if (overlap(P, e)) {
          const prevBottom = P.y + P.h - P.vy;
          if (P.vy > 0 && prevBottom <= e.y + 8) {
            e.alive = false; P.vy = JUMP_V * 0.7;
            gain(200, ex, ey, '#ff8a96');
            burst(ex, ey, '#b8404c', 16, 3.2);
            G.shake = 6; AUDIO.play('stomp');
            toast('LasA neutralised!', 90);
          } else hurt('lasa', 'LasA protease cut into your cell wall.');
        }
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
  // Three stars: sample measured, all 3 replicates kept, at least 80 % of the cystine.
  const stars = [true, P.reps === 3, L.cystine >= Math.ceil(L.totalCys * 0.8)];
  G.score += total;
  G.results[G.levelIdx] = { name: L.def.name, points: L.points, timeBonus, repBonus, total, cystine: L.cystine, totalCys: L.totalCys, iron: L.ironTotal, reps: P.reps, secs: L.time / 60, stars };
  setState('levelDone');
  AUDIO.play('done');
}

// ---- pause menu ------------------------------------------------------------------
function menuItems() {
  return ['Resume', 'Restart level', `Sound effects: ${AUDIO.sfxOn ? 'on' : 'off'}`, `Music: ${AUDIO.musicOn ? 'on' : 'off'}`, 'Main menu'];
}
function menuRects() { return menuItems().map((_, i) => ({ x: VIEW_W / 2 - 170, y: 176 + i * 52, w: 340, h: 44 })); }
function menuSelect() {
  AUDIO.play('click');
  switch (G.menuIdx) {
    case 0: setState('play'); break;
    case 1: loadLevel(G.levelIdx); setState('intro'); break;
    case 2: AUDIO.toggleSfx(); break;
    case 3: AUDIO.toggleMusic(); break;
    case 4: setState('title'); break;
  }
}

// ---- the state machine -----------------------------------------------------------
function update() {
  if (took('mute')) AUDIO.toggleSfx();
  if (took('music')) AUDIO.toggleMusic();
  switch (G.state) {
    case 'title': {
      const order = ['anc', 'stk', 'stp'];
      if (took('s1')) G.strain = 'anc';
      if (took('s2')) G.strain = 'stk';
      if (took('s3')) G.strain = 'stp';
      if (took('left')) { G.strain = order[(order.indexOf(G.strain) + 2) % 3]; AUDIO.play('move'); }
      if (took('right')) { G.strain = order[(order.indexOf(G.strain) + 1) % 3]; AUDIO.play('move'); }
      if (took('ok') || took('jump')) { AUDIO.play('click'); startGame(); }
      break;
    }
    case 'intro':
      if (took('ok') || took('jump')) setState('play');
      break;
    case 'play':
      if (took('pause')) { G.menuIdx = 0; setState('paused'); AUDIO.play('click'); break; }
      updatePlay();
      break;
    case 'paused': {
      const n = menuItems().length;
      if (took('pause')) { setState('play'); break; }
      if (took('up')) { G.menuIdx = (G.menuIdx + n - 1) % n; AUDIO.play('move'); }
      if (took('down')) { G.menuIdx = (G.menuIdx + 1) % n; AUDIO.play('move'); }
      if (took('confirm')) menuSelect();
      break;
    }
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
      if (took('pause')) { setState('title'); break; }
      if (took('ok') || took('jump')) { G.failReason = ''; loadLevel(G.levelIdx); setState('intro'); }
      break;
    case 'win':
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

  const tiles = document.createElement('canvas');
  tiles.width = W; tiles.height = H;
  const g = tiles.getContext('2d');

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
  return { tiles, far, dots, fore, sky };
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
  ctx.scale(1 + sq, 1 - sq);
  circle(0, 0, r + 4, rgba(ring, 0.22));
  ball(0, 0, r, '#fff5c4', o.slow ? '#c9c35a' : '#f3c22f', o.slow ? '#7d8a2a' : '#c0860c');
  ctx.strokeStyle = ring; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
  const s = r / 14;
  // cell-wall dots that turn as the cell rolls
  for (let i = 0; i < 8; i++) {
    const a = (o.roll || 0) + i * TAU / 8;
    circle(Math.cos(a) * (r - 0.5), Math.sin(a) * (r - 0.5), 1.1 * s, 'rgba(255,255,255,0.6)');
  }
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.ellipse(-r * 0.4, -r * 0.5, r * 0.3, r * 0.16, -0.5, 0, TAU); ctx.fill();
  for (const dx of [-4.5, 4.5]) {
    if (o.blink) {
      ctx.strokeStyle = '#1d2430'; ctx.lineWidth = 1.6 * s; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo((dx + f * 2.5 - 2.6) * s, -1.6 * s); ctx.lineTo((dx + f * 2.5 + 2.6) * s, -1.6 * s); ctx.stroke();
    } else {
      circle((dx + f * 2.5) * s, -2 * s, 3.6 * s, '#ffffff');
      circle((dx + f * 3.6) * s, -1.6 * s, 1.8 * s, '#1d2430');
      circle((dx + f * 3.6 - 0.7) * s, -2.4 * s, 0.6 * s, '#ffffff');
    }
  }
  circle((-7.5 + f * 2) * s, 4 * s, 2.4 * s, 'rgba(235,110,80,0.35)');
  circle((7.5 + f * 2) * s, 4 * s, 2.4 * s, 'rgba(235,110,80,0.35)');
  ctx.strokeStyle = '#7a4a08'; ctx.lineWidth = 1.4 * s; ctx.beginPath(); ctx.arc(f * 2 * s, 3.5 * s, 3 * s, 0.2, Math.PI - 0.2); ctx.stroke();
  ctx.restore();
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
// AIP: a cyclic (thiolactone) peptide ring of 5 residues with a short tail.
function drawAipIcon(x, y, s = 1) {
  for (let i = 0; i < 3; i++) ball(x - 7 * s - i * 4.5 * s, y + 6 * s + i * 2.5 * s, 2.8 * s, '#f3e6ff', '#a274d6', '#5b2a8a');
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * TAU / 5;
    ball(x + 2 * s + Math.cos(a) * 6.5 * s, y - 1 * s + Math.sin(a) * 6.5 * s, 3.3 * s, '#f6ecff', '#9b59d0', '#5b2a8a');
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
  ctx.drawImage(L.art.far, cx * 0.25, cy * 0.25, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);
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
}

// The y of the first surface at or below (px, py), up to 9 rows down, or null.
function surfaceBelow(px, py) {
  const tx = Math.floor(px / TILE), r0 = Math.floor(py / TILE);
  for (let ty = r0; ty < Math.min(L.rows, r0 + 9); ty++) {
    const c = tileAt(tx, ty);
    if (c === '#' || oneWay(c)) return ty * TILE;
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

function visibleTiles(cx, cy, fn) {
  const c0 = Math.max(0, Math.floor(cx / TILE)), c1 = Math.min(L.cols - 1, Math.floor((cx + VIEW_W) / TILE));
  const r0 = Math.max(0, Math.floor(cy / TILE)), r1 = Math.min(L.rows - 1, Math.floor((cy + VIEW_H) / TILE));
  for (let ty = r0; ty <= r1; ty++) for (let tx = c0; tx <= c1; tx++) fn(L.grid[ty][tx], tx, ty);
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

// Info signs are membrane vesicles with an "i" inside. Only the nearest one talks.
function nearestSign() {
  let best = null, bd = Infinity;
  for (const s of L.signs) {
    const dx = Math.abs(s.tx * TILE + 16 - (P.x + P.w / 2)), dy = Math.abs(s.ty * TILE + 16 - (P.y + P.h / 2));
    if (dx < TILE * 5 && dy < TILE * 4 && dx + dy < bd) { bd = dx + dy; best = s; }
  }
  return best;
}
function drawSigns(cx, cy) {
  const near = nearestSign();
  for (const s of L.signs) {
    const x = s.tx * TILE + 16, y = s.ty * TILE + 12 + Math.sin(L.time * 0.05 + s.tx) * 3;
    if (x < cx - 40 || x > cx + VIEW_W + 40 || y < cy - 40 || y > cy + VIEW_H + 40) continue;
    if (s === near) glow(x, y, 30, '#ffffff', 0.5);
    circle(x, y, 13, 'rgba(255,255,255,0.55)');
    ctx.strokeStyle = 'rgba(90,120,150,0.9)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, 13, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(90,120,150,0.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 9.5, 0, TAU); ctx.stroke();
    text('i', x, y + 5, { size: 15, color: '#2c4f70', align: 'center', weight: '900', font: 'Georgia, serif' });
  }
}
function drawSignText(cx, cy) {
  const s = nearestSign();
  if (!s) return;
  const x = s.tx * TILE + 16 - cx, y = s.ty * TILE + 12 - cy;
  const lines = wrap(s.text, 300);
  const h = lines.length * 18 + 16, w = 324;
  const bx = clamp(x - w / 2, 8, VIEW_W - w - 8);
  let by = y - 28 - h;
  if (by < 58) by = y + 26;
  roundRect(bx, by, w, h, 10, 'rgba(255,255,255,0.72)', 'rgba(90,120,150,0.7)', 1.5);
  lines.forEach((ln, i) => text(ln, bx + 12, by + 23 + i * 18, { size: 14, color: '#1a2833' }));
}

function drawEntities(cx, cy) {
  for (const e of L.ents) {
    if (!e.alive || e.type === 'start') continue;
    const x = e.x, y = e.y;
    if (e.type !== 'shuttle' && e.type !== 'gate' && (x < cx - 140 || x > cx + VIEW_W + 140 || y < cy - 140 || y > cy + VIEW_H + 140)) continue;
    const bob = Math.sin((e.t + e.tx * 13) * 0.08) * 3;
    switch (e.type) {
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
        roundRect(X + 1.5, Y + 18, 9, 12.5, [0, 0, 5, 5], e.on ? '#f3c22f' : '#c9d2da');
        roundRect(X - 2, Y, 16, 8, 2, e.on ? '#2eaa5c' : '#8a96a3');
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(X + 2, Y + 9, 2, 18);
        if (e.on) for (let k = 0; k < 3; k++) {
          const a = e.t * 0.04 + k * 2.1;
          text('*', X + 6 + Math.cos(a) * 14, Y + 20 + Math.sin(a) * 10, { size: 12, color: '#bfe6ff', align: 'center', weight: '900' });
        }
        break;
      }
      case 'goal': { // the LC-MS/MS
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
        if (L.def.need) text(`${Math.min(L.cystine, L.def.need)}/${L.def.need} S–S`, x + TILE, Y - 20, { size: 12, color: L.cystine >= L.def.need ? '#1b7f3b' : '#a0202f', align: 'center', weight: '800' });
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
        const X = x + e.w / 2, Y = y + e.h / 2 + 1, dir = e.vx < 0 ? -1 : 1, open = Math.abs(Math.sin(e.t * (e.angry ? 0.4 : 0.2))) * 0.5;
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
      case 'agrb': { // AgrB in a patch of membrane: it makes the AIP
        for (let i = 0; i < 6; i++) { circle(x + 2 + i * 5.6, y + 29, 2.3, '#c9b8e6'); circle(x + 2 + i * 5.6, y + 23, 2.3, '#c9b8e6'); }
        ctx.strokeStyle = 'rgba(150,120,190,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y + 26); ctx.lineTo(x + 32, y + 26); ctx.stroke();
        const g = ctx.createLinearGradient(x, y + 4, x + 24, y + 30);
        g.addColorStop(0, '#b79ce0'); g.addColorStop(1, '#5b3a99');
        roundRect(x + 6, y + 3, 20, 28, 9, g, '#3d2a63', 1.5);
        text('AgrB', x + 16, y + 19, { size: 8, color: '#fff', align: 'center', weight: '800' });
        if (!e.block.docked && (Math.abs(e.block.x - (e.x + TILE)) > 4 || Math.abs(e.block.y - e.y) > 4)) {
          ctx.globalAlpha = 0.5 + 0.5 * Math.sin(e.t * 0.12);
          text('↻', x + 16, y - 4, { size: 16, color: '#7a4fc9', align: 'center', weight: '900' });
          ctx.globalAlpha = 1;
        }
        break;
      }
      case 'agrc': { // AgrC receptor: a pocket in the floor that binds the AIP
        const on = e.on;
        if (on) glow(x + 16, y + 16, 34, '#6fe08a', 0.5);
        ctx.fillStyle = on ? 'rgba(80,200,120,0.3)' : 'rgba(30,10,50,0.35)'; ctx.fillRect(x + 2, y, 28, 32);
        ctx.strokeStyle = on ? '#2e9b52' : '#8b5fd6'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(x + 3, y + 1); ctx.lineTo(x + 3, y + 26); ctx.quadraticCurveTo(x + 3, y + 30, x + 8, y + 30); ctx.lineTo(x + 24, y + 30); ctx.quadraticCurveTo(x + 29, y + 30, x + 29, y + 26); ctx.lineTo(x + 29, y + 1); ctx.stroke();
        if (!on) {
          text('AgrC', x + 16, y + 22, { size: 8, color: '#e6d8ff', align: 'center', weight: '800' });
          ctx.globalAlpha = 0.45 + 0.45 * Math.sin(e.t * 0.1);
          text('▼', x + 16, y - 6 + Math.sin(e.t * 0.1) * 3, { size: 13, color: '#8b5fd6', align: 'center', weight: '900' });
          ctx.globalAlpha = 1;
        }
        break;
      }
      case 'phos': { // phospho-switch: a protein that carries a P while ON
        const X = x + 16, Y = y + 16, on = e.timer > 0;
        roundRect(x + 9, y + 26, 14, 6, 2, '#4d5a5f');
        if (on) glow(X, Y, 28, '#b98ae6', 0.45);
        ball(X, Y, 11, '#d8f5f1', on ? '#3aa39a' : '#7f9a97', on ? '#1d5f59' : '#455654');
        if (on) {
          ctx.strokeStyle = '#b98ae6'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(X, Y, 16, -Math.PI / 2, -Math.PI / 2 + TAU * e.timer / PHOS_TIME); ctx.stroke();
          circle(X + 9, Y - 10, 7, '#7b3fb5');
          text('P', X + 9, Y - 6, { size: 10, color: '#fff', align: 'center', weight: '900' });
        } else {
          ctx.save(); ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(123,63,181,0.8)'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(X + 9, Y - 10, 6, 0, TAU); ctx.stroke(); ctx.restore();
          ctx.globalAlpha = 0.5 + 0.5 * Math.sin(e.t * 0.12);
          text('P', X + 9, Y - 6, { size: 10, color: '#7b3fb5', align: 'center', weight: '900' });
          ctx.globalAlpha = 1;
        }
        break;
      }
      case 'gate': { // a closed barrier of protein subunits; slides up when its signal is ON
        const H = e.h * TILE, vis = H * (1 - e.open), X = x + 4;
        if (vis > 1) {
          ctx.save(); ctx.beginPath(); ctx.rect(X - 2, y, 28, vis); ctx.clip();
          const g = ctx.createLinearGradient(X, 0, X + 24, 0);
          g.addColorStop(0, '#4a2d80'); g.addColorStop(0.5, '#9b74e0'); g.addColorStop(1, '#4a2d80');
          roundRect(X, y + vis - H, 24, H, 8, g);
          for (let k = 0; k < e.h * 2; k++) { ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.ellipse(X + 12, y + vis - H + 8 + k * 16, 8, 5, 0, 0, TAU); ctx.fill(); }
          ctx.restore();
          const by = y + vis - 16;
          circle(X + 12, by, 9, '#ffffff');
          if (e.src === 'phos') text('P', X + 12, by + 4, { size: 11, color: '#7b3fb5', align: 'center', weight: '900' });
          else drawAipIcon(X + 12, by, 0.5);
        }
        roundRect(X - 4, y - 4, 32, 6, 3, '#3d2a63');
        break;
      }
      case 'shuttle': { // moving bridge: a chain of protein beads that runs while its signal is ON
        const on = !e.ch || L.chan[e.ch];
        ctx.save(); ctx.setLineDash([4, 8]); ctx.strokeStyle = on ? 'rgba(58,163,154,0.45)' : 'rgba(80,90,95,0.3)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(e.x0 + 4, e.y0 + 6); ctx.lineTo(e.x1 + e.len * TILE - 4, e.y1 + 6); ctx.stroke(); ctx.restore();
        const X0 = e.px, X1 = e.px + e.len * TILE;
        if (on) glow((X0 + X1) / 2, e.py + 6, 50, '#4cc3b6', 0.25);
        roundRect(X0 + 1, e.py + 1, X1 - X0 - 2, 11, 5, on ? 'rgba(29,111,104,0.85)' : 'rgba(80,90,95,0.85)');
        for (let px = X0 + 8; px < X1 - 4; px += 10) ball(px, e.py + 6, 4.5, '#e6fffb', on ? '#4cc3b6' : '#9aa6a9', on ? '#1d6f68' : '#5a6466');
        if (on && e.wait === 0) text(e.dir > 0 ? '›' : '‹', (X0 + X1) / 2, e.py - 3, { size: 16, color: '#1d6f68', align: 'center', weight: '900' });
        break;
      }
    }
  }
  for (const b of L.blocks) { // AIP blocks
    if (b.docked) glow(b.x + 16, b.y + 16, 30, '#6fe08a', 0.45);
    roundRect(b.x + 1, b.y + 1, 30, 30, 7, b.docked ? 'rgba(205,245,215,0.95)' : 'rgba(238,228,252,0.95)', b.docked ? '#2e9b52' : '#7a4fc9', 2);
    drawAipIcon(b.x + 15, b.y + 13, 0.95);
    text('AIP', b.x + 16, b.y + 29, { size: 7, color: b.docked ? '#1e6b38' : '#5b2a8a', align: 'center', weight: '900' });
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

function drawFx() {
  for (const p of L.fx) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    circle(p.x, p.y, p.r, p.color);
  }
  ctx.globalAlpha = 1;
  ctx.font = `900 15px ${FONT}`; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
  for (const p of L.pops) {
    ctx.globalAlpha = Math.min(1, p.life / 20);
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,20,30,0.6)'; ctx.strokeText(p.text, p.x, p.y);
    ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;
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
  drawCoccus(cx, cy, 14, S.colour, { face: P.face, slow: P.slow > 0, squash: P.squash, roll: P.roll, blink: L.time % 240 < 8 });
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
}

function drawHUD() {
  const S = STRAINS[G.strain], W = '#f4f1ea', dim = 'rgba(244,241,234,0.6)';
  roundRect(10, 8, VIEW_W - 20, 40, 14, 'rgba(14,26,36,0.78)');
  drawCoccus(32, 28, 10, S.colour, { face: 1 });
  text(`${S.label} · ${L.def.name}`, 50, 34, { size: 15, color: W, weight: '800' });
  // Replicates as three little sample tubes.
  for (let i = 0; i < 3; i++) {
    const x = 184 + i * 18;
    roundRect(x, 15, 11, 26, [2, 2, 6, 6], 'rgba(255,255,255,0.12)', 'rgba(255,255,255,0.6)', 1.5);
    if (i < P.reps) roundRect(x + 2, 24, 7, 15, [0, 0, 4, 4], '#f3c22f');
  }
  text('replicates', 240, 33, { size: 12, color: dim });
  drawCystineIcon(330, 28, 0.62);
  text(`${L.cystine}${L.def.need ? '/' + L.def.need : ''}`, 348, 34, { size: 15, color: L.def.need && L.cystine >= L.def.need ? '#8be28f' : W, weight: '800' });
  drawIronIcon(406, 28, 0.75);
  for (let i = 0; i < 3; i++) circle(424 + i * 12, 28, 4, i < L.ironBank ? '#e0743c' : 'rgba(255,255,255,0.22)');
  text(`score ${G.score + L.points}`, 476, 34, { size: 15, color: W, weight: '700' });
  let x = 600;
  const chip = (label, col) => {
    ctx.font = `800 12px ${FONT}`;
    const w = ctx.measureText(label).width + 16;
    roundRect(x, 17, w, 22, 11, col); text(label, x + w / 2, 32, { size: 12, color: '#fff', align: 'center', weight: '800' });
    x += w + 6;
  };
  if (L.comboT > 0 && L.combo > 1) chip(`combo x${Math.min(L.combo, 5)}`, '#c2410c');
  if (P.shield > 0) chip('AhpC', '#3a7bd5');
  if (P.magnet > 0) chip(`TcyA ${Math.ceil(P.magnet / 60)}`, '#b38600');
  if (P.slow > 0) chip('HQNO', '#4f7f2a');
  if (L.def.timeLimit) {
    // Game seconds left, scaled so the whole limit shows as 15 pulse minutes.
    const left = Math.max(0, L.def.timeLimit - L.time / 60) * PULSE_S / L.def.timeLimit;
    const mm = Math.floor(left / 60), ss = Math.floor(left % 60), urgent = left < 120;
    roundRect(VIEW_W - 152, 14, 132, 28, 14, urgent ? '#b3261e' : 'rgba(255,255,255,0.12)');
    ctx.strokeStyle = urgent ? '#fff' : '#7fc4ff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(VIEW_W - 134, 28, 8, -Math.PI / 2, -Math.PI / 2 + TAU * left / PULSE_S); ctx.stroke();
    text(`pulse ${mm}:${String(ss).padStart(2, '0')}`, VIEW_W - 30, 34, { size: 15, color: '#fff', align: 'right', weight: '800' });
  }
  if (G.toastT > 0 && G.toast) {
    const lines = wrap(G.toast, 560, 16);
    const h = lines.length * 22 + 16;
    ctx.globalAlpha = Math.min(1, G.toastT / 30);
    roundRect(VIEW_W / 2 - 300, 58, 600, h, 12, 'rgba(14,26,36,0.5)');
    roundRect(VIEW_W / 2 - 300, 58, 5, h, [12, 0, 0, 12], rgba(S.colour, 0.8));
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 4;
    lines.forEach((ln, i) => text(ln, VIEW_W / 2 + 3, 81 + i * 22, { size: 16, color: '#fff', align: 'center' }));
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

function panel({ title, sub = '', lines = [], footer = '', accent = '#2b5d8a', bodyY = 196 }) {
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
  lines.forEach((ln, i) => text(ln, VIEW_W / 2, bodyY + i * 28, { size: 17, color: '#2b2b2b', align: 'center', weight: '500' }));
  if (footer) {
    ctx.globalAlpha = 0.55 + 0.45 * Math.sin(performance.now() / 260);
    text(footer, VIEW_W / 2, 455, { size: 16, color: accent, align: 'center', weight: '700' });
    ctx.globalAlpha = 1;
  }
}

function drawStars(stars, y) {
  const labels = ['sample measured', 'all 3 replicates', '≥ 80 % cystine'];
  stars.forEach((on, i) => {
    const x = VIEW_W / 2 + (i - 1) * 150;
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
    text(label, r.x + r.w / 2, r.y + 29, { size: 18, color: sel ? '#fff' : '#22303c', align: 'center', weight: sel ? '800' : '600' });
    if (sel) text('▶', r.x + 18, r.y + 29, { size: 14, color: '#fff', weight: '900' });
  });
  text('↑ ↓ choose · Enter / Space select · P resume', VIEW_W / 2, 466, { size: 13, color: '#6b6455', align: 'center' });
}

function strainCards() {
  return ['anc', 'stk', 'stp'].map((key, i) => ({ key, x: 90 + i * 270, y: 236, w: 240, h: 196 }));
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
  ctx.save();
  ctx.font = `900 64px ${FONT}`; ctx.textAlign = 'center';
  ctx.lineJoin = 'round'; ctx.lineWidth = 10; ctx.strokeStyle = '#5a3d00'; ctx.strokeText('JE2 JUMP', VIEW_W / 2, 92);
  const tg = ctx.createLinearGradient(0, 40, 0, 96);
  tg.addColorStop(0, '#fff1a0'); tg.addColorStop(1, '#e0a210');
  ctx.fillStyle = tg; ctx.fillText('JE2 JUMP', VIEW_W / 2, 92);
  ctx.restore();
  drawCoccus(VIEW_W / 2 - 200, 70 + Math.sin(t * 3) * 6, 16, '#0072B2', { face: 1 });
  drawCoccus(VIEW_W / 2 + 200, 70 + Math.sin(t * 3 + 1.5) * 6, 16, '#009E73', { face: -1 });
  text('A Staphylococcus aureus platformer from the Bio253 proteomics course', VIEW_W / 2, 132, { size: 18, color: '#3d3d3d', align: 'center' });
  text('TSB → SNpulse → SN.  Collect cystine, keep your 3 replicates, reach the LC-MS/MS.', VIEW_W / 2, 176, { size: 16, color: '#2b2b2b', align: 'center', weight: '500' });
  text('Choose your strain (1 / 2 / 3, ← →, or click):', VIEW_W / 2, 214, { size: 16, color: '#2b2b2b', align: 'center' });
  for (const c of strainCards()) {
    const S = STRAINS[c.key], sel = G.strain === c.key, lift = sel ? -6 : 0;
    ctx.save();
    if (sel) { ctx.shadowColor = rgba(S.colour, 0.45); ctx.shadowBlur = 24; ctx.shadowOffsetY = 6; }
    roundRect(c.x, c.y + lift, c.w, c.h, 16, sel ? '#ffffff' : 'rgba(255,255,255,0.62)');
    ctx.restore();
    roundRect(c.x, c.y + lift, c.w, c.h, 16, null, sel ? S.colour : 'rgba(0,0,0,0.12)', sel ? 4 : 1.5);
    drawCoccus(c.x + 40, c.y + 44 + lift + (sel ? Math.sin(t * 5) * 3 : 0), 18, S.colour, { face: 1 });
    text(S.label, c.x + 72, c.y + 42 + lift, { size: 26, color: S.colour, weight: '900' });
    text(S.title, c.x + 72, c.y + 62 + lift, { size: 13, color: '#555' });
    S.lines.forEach((ln, i) => text(ln, c.x + 16, c.y + 104 + lift + i * 22, { size: 13, color: '#2b2b2b', weight: '500' }));
  }
  ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 4);
  text(`Press Enter / Space to start${G.best ? '   ·   best score ' + G.best : ''}`, VIEW_W / 2, 476, { size: 17, color: '#10202b', align: 'center', weight: '800' });
  ctx.globalAlpha = 1;
  text(`M sound ${AUDIO.sfxOn ? 'on' : 'off'} · N music ${AUDIO.musicOn ? 'on' : 'off'} · P pause menu`, VIEW_W / 2, 500, { size: 13, color: 'rgba(16,32,43,0.75)', align: 'center', weight: '600' });
  text('PASN = cell-free spent medium of P. aeruginosa PAO1 (no living Pseudomonas).', VIEW_W / 2, 524, { size: 13, color: 'rgba(16,32,43,0.75)', align: 'center', weight: '500' });
}

function drawVignette() { ctx.drawImage(VIGNETTE, 0, 0); }

function drawWorld() {
  const th = L.def.theme;
  const cx = Math.round(L.cam), cy = Math.round(L.camY);
  const sx = G.shake ? (Math.random() - 0.5) * G.shake : 0, sy = G.shake ? (Math.random() - 0.5) * G.shake : 0;
  ctx.save();
  ctx.translate(sx, sy);
  drawBackground(th, cx, cy);
  ctx.drawImage(L.art.tiles, cx, cy, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);
  ctx.translate(-cx, -cy);
  drawFoam(cx, cy);
  drawLysis(cx, cy);
  drawSigns(cx, cy);
  drawEntities(cx, cy);
  drawPlayer();
  drawFx();
  ctx.restore();
  drawForeground(cx, cy);
  drawDarkness(cx, cy);
  drawVignette();
  drawSignText(cx, cy);
  drawHUD();
}

function draw() {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  if (G.state === 'title') { drawTitle(); return; }
  drawWorld();
  const S = STRAINS[G.strain];
  switch (G.state) {
    case 'intro':
      panel({ title: `Level ${G.levelIdx + 1}: ${L.def.name}`, sub: L.def.subtitle, lines: L.def.intro.concat(['', `Playing as ${S.label} (${S.title})`]), footer: 'Press Enter / Space / tap to start', accent: L.def.theme.accent });
      break;
    case 'paused':
      drawPauseMenu();
      break;
    case 'levelDone': {
      const r = G.results[G.levelIdx];
      const stats = `S–S ${r.cystine}/${r.totalCys} · Fe ${r.iron} · replicates ${r.reps}/3 · ${r.secs.toFixed(0)} s   →   +${r.total} points`;
      panel({ title: `${L.def.name}: sample measured!`, sub: stats, lines: LEVEL_FACTS[G.levelIdx], footer: 'Press Enter to continue', accent: '#1b7f3b', bodyY: 316 });
      drawStars(r.stars, 206);
      break;
    }
    case 'gameOver':
      panel({
        title: G.failReason === 'pulse' ? 'Pulse over' : 'n = 0',
        sub: G.failReason === 'pulse' ? 'Your sample missed the 15-min time point.' : 'No replicates left.',
        lines: G.failReason === 'pulse'
          ? ['In the real experiment the pulse samples were', 'harvested after exactly 15 min in PASN.', 'Try again, a bit faster.']
          : ['With zero replicates there is nothing to compare:', 'no mean, no variance, no test.', 'Even n = 3 is small, so protect your replicates!'],
        footer: 'Enter: retry this level  ·  Esc: main menu', accent: '#b3261e',
      });
      break;
    case 'win':
      panel({
        title: 'All samples measured!', sub: `Strain ${S.label} · total score ${G.score}${G.newBest ? '  (new best!)' : ''}`,
        lines: G.results.map(r => `${r.name}: ${r.total} points  ${'★'.repeat(r.stars.filter(Boolean).length)}${'☆'.repeat(3 - r.stars.filter(Boolean).length)}  (S–S ${r.cystine}/${r.totalCys}, ${r.reps}/3 replicates)`).concat([''], strainFact(G.strain)),
        footer: 'Press Enter to play another strain', accent: '#7a5a00',
      });
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
AUDIO.music('title');
requestAnimationFrame(frame);
