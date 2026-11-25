'use strict';
// share.js -- things you can take out of the game: a one-line result to paste in a
// chat, a link that lets a friend race your ghost, and a "micrograph" screenshot.
// Nothing is uploaded anywhere: links carry the run in the part after '#', which
// browsers never send to a server, and the screenshot is saved by your browser.

const PLAY_URL = 'https://dinvuc.github.io/je2-jump-mval/';
const STRAIN_KEYS = ['anc', 'stk', 'stp'];

// ---- result lines -----------------------------------------------------------------
function flasks(reps, max = 3) { return '🧪'.repeat(Math.max(0, reps)) + '⬜'.repeat(Math.max(0, max - reps)); }
function starString(stars) { return stars.map(s => (s ? '★' : '☆')).join(''); }
function shareLevelText(r) {
  const medal = r.medal ? { gold: '🥇', silver: '🥈', bronze: '🥉' }[r.medal[0]] + ' ' : '';
  return [
    `JE2 Jump · ${r.name} · ${G.strain} · ${difficultyLabel(L.difficulty)}`,
    `${medal}⏱ ${fmtTime(r.secs)} ${starString(r.stars)} ${flasks(r.reps)} ☠ ${r.deaths}`,
    r.rivalDelta !== undefined ? (r.rivalDelta < 0 ? `🏁 beat the rival by ${(-r.rivalDelta).toFixed(1)} s` : `🏁 rival ahead by ${r.rivalDelta.toFixed(1)} s`) : '',
    shareUrl(),
  ].filter(Boolean).join('\n');
}
function shareRunText() {
  const done = G.results.filter(Boolean);
  const total = done.reduce((s, r) => s + r.secs, 0);
  return [
    `JE2 Jump · all samples measured · ${G.strain} · ${difficultyLabel(G.difficulty)}`,
    ...done.map(r => `${r.name.padEnd(9)} ${fmtTime(r.secs)} ${starString(r.stars)}${r.medal ? ' ' + { gold: '🥇', silver: '🥈', bronze: '🥉' }[r.medal[0]] : ''}`),
    `⏱ ${fmtTime(total)} · score ${G.score}`,
    shareUrl(),
  ].join('\n');
}
function shareUrl() {
  try { if (typeof location !== 'undefined' && /^https?:$/.test(location.protocol)) return location.origin + location.pathname; } catch { /* no location */ }
  return PLAY_URL;
}

// ---- copying: the clipboard API, an older fallback, then a panel to copy by hand ----
function copyText(str, okMessage) {
  const done = () => toast(okMessage || 'Copied. Paste it anywhere.', 150);
  const fallback = () => {
    try {
      const area = document.createElement('textarea');
      area.value = str; area.setAttribute('readonly', ''); area.style.position = 'fixed'; area.style.opacity = '0';
      document.body.appendChild(area); area.select();
      const ok = document.execCommand && document.execCommand('copy');
      area.remove();
      if (ok) { done(); return; }
    } catch { /* fall through to the panel */ }
    showSharePanel(str);
  };
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(str).then(done, fallback);
      return;
    }
  } catch { /* use the fallback */ }
  fallback();
}
function showSharePanel(str) {
  const panel = document.getElementById('share-panel'), area = document.getElementById('share-text');
  if (!panel || !area) { toast('Copying is not available in this browser.', 150); return; }
  area.value = str; panel.hidden = false;
  try { area.focus(); area.select(); } catch { /* not focusable */ }
}

// ---- race links: the ghost packed into a short text code ------------------------------
// Format v1: header (version, level, strain, difficulty, run frames) followed by the
// samples as variable-length integers: time step, x and y change, then face + part.
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function toBase64Url(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    if (i + 1 < bytes.length) out += B64[(n >> 6) & 63];
    if (i + 2 < bytes.length) out += B64[n & 63];
  }
  return out;
}
function fromBase64Url(str) {
  const bytes = [];
  let buf = 0, bits = 0;
  for (const ch of str) {
    const v = B64.indexOf(ch);
    if (v < 0) throw new Error('bad character');
    buf = (buf << 6) | v; bits += 6;
    if (bits >= 8) { bits -= 8; bytes.push((buf >> bits) & 255); }
  }
  return bytes;
}
function pushVarint(out, n) { n = Math.max(0, Math.round(n)); while (n >= 128) { out.push((n & 127) | 128); n = Math.floor(n / 128); } out.push(n); }
function pushSigned(out, n) { n = Math.round(n); pushVarint(out, n >= 0 ? n * 2 : -n * 2 - 1); }
function reader(bytes) {
  let i = 0;
  const varint = () => {
    let n = 0, mul = 1;
    for (;;) {
      if (i >= bytes.length) throw new Error('truncated');
      const b = bytes[i++]; n += (b & 127) * mul;
      if (b < 128) return n;
      mul *= 128;
      if (mul > 2 ** 35) throw new Error('too long');
    }
  };
  return { varint, signed: () => { const n = varint(); return n % 2 ? -(n + 1) / 2 : n / 2; }, get done() { return i >= bytes.length; } };
}
// Keep at most one sample per 12 frames: the ghost interpolates in between.
function thinSamples(samples) {
  const out = [];
  for (const s of samples) if (!out.length || s[0] - out[out.length - 1][0] >= 12 || s[4] !== out[out.length - 1][4]) out.push(s);
  const last = samples[samples.length - 1];
  if (last && out[out.length - 1] !== last) out.push(last);
  return out;
}
function encodeRace({ level, strain, difficulty, frames, samples }) {
  const out = [1, level, STRAIN_KEYS.indexOf(strain), difficulty];
  pushVarint(out, frames);
  const thin = thinSamples(samples);
  pushVarint(out, thin.length);
  let pt = 0, px = 0, py = 0;
  for (const [t, x, y, face, stage] of thin) {
    pushVarint(out, t - pt); pushSigned(out, x - px); pushSigned(out, y - py);
    pushVarint(out, (face > 0 ? 1 : 0) | ((stage || 0) << 1));
    pt = t; px = x; py = y;
  }
  return toBase64Url(out);
}
function decodeRace(code) {
  try {
    const bytes = fromBase64Url(code);
    if (bytes.length < 6 || bytes[0] !== 1) return null;
    const [, level, strainIdx, difficulty] = bytes;
    if (!LEVELS[level] || !STRAIN_KEYS[strainIdx] || ![0, 25, 50, 75, 100, 150].includes(difficulty)) return null;
    const r = reader(bytes.slice(4)), frames = r.varint(), n = r.varint();
    if (n < 2 || n > 12000 || frames <= 0 || frames > 60 * 60 * 120) return null;
    const samples = [];
    let t = 0, x = 0, y = 0;
    for (let i = 0; i < n; i++) {
      const dt = r.varint();
      if (i && dt <= 0) return null;
      t += dt; x += r.signed(); y += r.signed();
      const fs = r.varint();
      samples.push([t, x, y, fs & 1 ? 1 : -1, fs >> 1]);
    }
    if (!r.done || samples.some(s => !s.every(Number.isFinite))) return null;
    return { v: RUN_VERSION, level, strain: STRAIN_KEYS[strainIdx], difficulty, secs: frames / 60, samples };
  } catch { return null; }
}
function raceLink(result) {
  return `${shareUrl()}#race=${encodeRace({ level: L.idx, strain: G.strain, difficulty: L.difficulty, frames: Math.round(result.secs * 60), samples: L.recording })}`;
}
// Read a race code from the page address once, at start-up.
function readRaceFromUrl() {
  try {
    if (typeof location === 'undefined') return null;
    const m = /[#&]race=([A-Za-z0-9_-]+)/.exec(location.hash || '');
    return m ? decodeRace(m[1]) : null;
  } catch { return null; }
}
// A rival ghost loaded from a link: pick its level, strain and difficulty on the title.
function adoptRival(rival) {
  if (!rival) return;
  G.rival = rival;
  G.startLevel = rival.level; G.strain = rival.strain; G.titleMode = 'story';
  G.difficulty = rival.difficulty; G.best = loadBest(bestScoreKey());
  syncDifficultyControl();
}
const rivalMatches = () => G.rival && G.mode === 'story' && G.rival.level === L.idx && G.rival.strain === G.strain && G.rival.difficulty === L.difficulty;

// ---- micrograph: a framed screenshot of the current view ------------------------------
function saveMicrograph() {
  try {
    const W = canvas.width, H = canvas.height, s = W / VIEW_W, pad = Math.round(26 * s), bar = Math.round(46 * s);
    const out = document.createElement('canvas');
    out.width = W + pad * 2; out.height = H + pad * 2 + bar;
    const g = out.getContext('2d');
    g.fillStyle = '#0d151b'; g.fillRect(0, 0, out.width, out.height);
    g.drawImage(canvas, pad, pad);
    // a soft round field of view, like an eyepiece
    const v = g.createRadialGradient(pad + W / 2, pad + H / 2, H * 0.42, pad + W / 2, pad + H / 2, W * 0.62);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.45)');
    g.fillStyle = v; g.fillRect(pad, pad, W, H);
    g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 2 * s; g.strokeRect(pad, pad, W, H);
    const y = pad * 2 + H + bar * 0.45, font = n => `800 ${Math.round(n * s)}px ${FONT}`;
    g.fillStyle = '#ffe27a'; g.font = font(18); g.textAlign = 'left';
    g.fillText('JE2 JUMP · MICROGRAPH', pad, y);
    g.fillStyle = '#d8e6ee'; g.font = font(13);
    g.fillText(micrographCaption(), pad, y + 18 * s);
    // a scale-bar-like mark, honestly labelled
    g.fillStyle = '#ffffff'; g.fillRect(out.width - pad - 120 * s, y - 10 * s, 100 * s, 5 * s);
    g.font = font(11); g.textAlign = 'right'; g.fillText('not to scale · game art', out.width - pad, y + 14 * s);
    const url = out.toDataURL('image/png'), a = document.createElement('a');
    if (typeof a.click !== 'function') return false;
    a.href = url; a.download = `je2-jump-${(L ? L.def.name : 'title').replace(/\s+/g, '-').toLowerCase()}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    AUDIO.play('camera');
    if (L) toast('Micrograph saved to your downloads.', 120);
    return true;
  } catch { toast('Screenshots are not available in this browser.', 120); return false; }
}
function micrographCaption() {
  if (!L) return 'S. aureus JE2 · Bio253 group mval';
  const part = L.def.endless ? `generation ${L.gen || 0}` : `part ${L.stage + 1}`;
  return `${L.def.name} · ${part} · strain ${G.strain} · ${fmtTime(runSecs())} · ${difficultyLabel(L.difficulty)}`;
}

// ---- the buttons on result screens (keys T, L and I, or click / tap) -------------------
function shareButtons(kind) {
  const list = [{ key: 'share', label: 'T  copy result' }];
  if (kind === 'level' && G.mode === 'story') list.push({ key: 'link', label: 'L  race link' });
  list.push({ key: 'photo', label: 'I  micrograph' });
  const w = 150, gap = 10, x0 = VIEW_W / 2 - (list.length * w + (list.length - 1) * gap) / 2;
  return list.map((b, i) => ({ ...b, x: x0 + i * (w + gap), y: 404, w, h: 30 }));
}
function drawShareButtons(kind) {
  for (const b of shareButtons(kind)) {
    roundRect(b.x, b.y, b.w, b.h, 15, 'rgba(43,93,138,0.1)', 'rgba(43,93,138,0.45)', 1.5);
    text(b.label, b.x + b.w / 2, b.y + 20, { size: 13, color: '#1d3f5e', align: 'center', weight: '800' });
  }
}
function shareButtonAt(kind, x, y) {
  const b = shareButtons(kind).find(r => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h);
  return b ? b.key : null;
}
// Handle T / L / I (or a clicked button) on a result screen.
function handleShareKeys(kind, result) {
  if (took('share')) copyText(kind === 'win' ? shareRunText() : kind === 'daily' ? shareDailyText(result) : kind === 'endless' ? shareEndlessText(result) : shareLevelText(result), 'Result copied. Paste it in a chat!');
  if (took('link') && kind === 'level' && G.mode === 'story') copyText(raceLink(result), 'Race link copied: whoever opens it races your ghost.');
}
