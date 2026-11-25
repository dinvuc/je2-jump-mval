'use strict';
// codex.js -- a collection book of everything you have met, plus a peptide album
// and the secrets you found. Entries unlock in play and are kept in this browser.
// The biology text is NOT new: each entry points at a checked study note in
// STUDY_FACTS (facts.js). `note` holds the short in-game line that used to pop up
// as a banner the first time you met the thing.

const CODEX = [
  { id: 'lasa', group: 'enemy', name: 'LasA protease', topic: 'proteases', note: 'LasA protease cuts into your cell wall. Stomp it or shoot it.' },
  { id: 'lasb', group: 'enemy', name: 'LasB elastase', topic: 'proteases', note: 'LasB elastase, another P. aeruginosa protease, drifts in loops.' },
  { id: 'omv', group: 'enemy', name: 'Outer membrane vesicle', topic: 'omv', note: 'An OMV of P. aeruginosa bounces along and delivers its cargo on contact.' },
  { id: 'rosb', group: 'enemy', name: 'Superoxide radical', topic: 'ros', note: 'Superoxide (O₂•⁻)! Pyocyanin redox cycling makes these ROS. Jump over them, stomp them, or shoot them.' },
  { id: 'sidero', group: 'enemy', name: 'Siderophore', topic: 'iron', note: 'A siderophore grabs free iron. Competition for Fe!' },
  { id: 'pa', group: 'enemy', name: 'P. aeruginosa, swimming', topic: 'CF airway', note: 'Living P. aeruginosa appears only in the separate CF bonus setting.' },
  { id: 'twitch', group: 'enemy', name: 'P. aeruginosa, twitching', topic: 'CF airway', note: 'A P. aeruginosa cell that pulls itself along with its pili (CF setting only).' },
  { id: 'boss', group: 'enemy', name: 'Mucoid colony', topic: 'boss', note: 'Wrapped in alginate. Shoot it, or jump on it while its shell is open.' },
  { id: 'drop', group: 'hazard', name: 'Pyocyanin', topic: 'ros', note: 'Blue pyocyanin drops make ROS in your cell. Staphyloxanthin and AhpC protect you.' },
  { id: 'hcn', group: 'hazard', name: 'HCN vent', topic: 'hcn', note: 'HCN (hydrogen cyanide) puffs after a warning and blocks respiration.' },
  { id: 'hqno', group: 'hazard', name: 'HQNO cloud', topic: 'hqno', note: 'HQNO blocks respiration: slower and weaker jumps for a few seconds.' },
  { id: 'foam', group: 'hazard', name: 'Rhamnolipid foam', topic: 'foam', note: 'Pink foam damages your membrane: pools, geysers that bubble first, drifting clumps.' },
  { id: 'cystine', group: 'item', name: 'L-cystine', topic: 'sulfur', note: 'L-cystine, a source of sulfur for the cell. Collect them quickly for a combo.' },
  { id: 'iron', group: 'item', name: 'Iron (Fe)', topic: 'iron', note: 'Every three Fe restore a replicate (a game rule).' },
  { id: 'peptide', group: 'item', name: 'Tryptic peptide', topic: 'peptide', note: 'The MS identifies proteins from peptides like this. Six hide in every map.' },
  { id: 'ribosome', group: 'item', name: 'Ribosome block', topic: 'ribosome', note: 'Bump it from below: the ribosome translates an mRNA and a new protein pops out.' },
  { id: 'psm', group: 'item', name: 'PSMs', topic: 'psm', note: 'Phenol-soluble modulins, small peptide toxins of S. aureus. Press X, K or Shift to shoot.' },
  { id: 'xan', group: 'item', name: 'Staphyloxanthin', topic: 'xan', note: 'The golden carotenoid of S. aureus is an antioxidant. ROS cannot hurt you for 12 s.' },
  { id: 'ahpc', group: 'item', name: 'AhpC', topic: 'ahpc', note: 'AhpC shield: blocks one ROS hit (20 s).' },
  { id: 'tcya', group: 'item', name: 'TcyA', topic: 'sulfur', note: 'TcyA pulls cystine towards you for 12 s.' },
  { id: 'secret', group: 'item', name: 'Golden cluster', topic: null, note: 'A game collectible hidden in one secret room per map. Look for walls and floors that look a little different.' },
];
const CODEX_GROUPS = [['enemy', 'MET AND NEUTRALISED'], ['hazard', 'HAZARDS'], ['item', 'PICKUPS']];
const CODEX_KEY = 'je2jump_codex_v1';

function loadCodex() {
  const blank = { seen: {}, peptides: {}, secrets: {} };
  try {
    const v = JSON.parse(localStorage.getItem(CODEX_KEY));
    if (!v || typeof v !== 'object' || Array.isArray(v)) return blank;
    const obj = o => (o && typeof o === 'object' && !Array.isArray(o) ? o : {});
    return { seen: obj(v.seen), peptides: obj(v.peptides), secrets: obj(v.secrets) };
  } catch { return blank; }
}
function codexData() { return G.codex || (G.codex = loadCodex()); }
function saveCodex() { try { localStorage.setItem(CODEX_KEY, JSON.stringify(codexData())); } catch { /* storage full / private mode */ } }
const codexEntry = id => CODEX.find(c => c.id === id);
// Record a meeting. The first one adds a label "NEW IN CODEX" next to the player.
function codexSee(id) {
  const entry = codexEntry(id);
  if (!entry) return;
  const data = codexData(), first = !data.seen[id];
  data.seen[id] = (Number(data.seen[id]) || 0) + 1;
  if (first || entry.group === 'enemy') saveCodex();   // enemies keep a neutralised count
  if (first && L && P && G.state === 'play') tag('NEW IN CODEX · ' + entry.name, P.x + P.w / 2, P.y - 48, '#c3ffdf', 150);
}
// Hazards and pickups: record them once per level visit.
function meet(id) {
  if (G.met[id]) return;
  G.met[id] = true;
  codexSee(id);
}
// Peptides and secrets are remembered per map position, across runs.
function codexPeptide(e) {
  if (!L || L.idx < 0 || L.idx >= 4) return;
  codexData().peptides[`${L.idx}:${L.stage}:${e.tx},${e.ty}`] = true;
  saveCodex();
}
function codexSecret() {
  if (!L || L.idx < 0 || L.idx >= 4) return;
  codexData().secrets[L.idx] = true;
  saveCodex();
}
function codexCounts() {
  const d = codexData();
  return {
    seen: CODEX.filter(c => d.seen[c.id]).length,
    peptides: Object.keys(d.peptides).length,
    secrets: Object.keys(d.secrets).length,
  };
}

// ---- the codex screen ---------------------------------------------------------------
function openCodex(from) { G.codexFrom = from; G.codexIdx = G.codexIdx || 0; setState('codex'); }
function codexRects() {
  const rects = [];
  let y = 88;
  for (const [group] of CODEX_GROUPS) {
    const items = CODEX.filter(c => c.group === group);
    items.forEach((c, i) => rects.push({ id: c.id, x: 34 + (i % 4) * 118, y: y + 20 + Math.floor(i / 4) * 58, w: 110, h: 52 }));
    y += 20 + Math.ceil(items.length / 4) * 58 + 6;
  }
  return rects;
}
function updateCodex() {
  const n = CODEX.length;
  if (took('left')) { G.codexIdx = (G.codexIdx + n - 1) % n; AUDIO.play('move'); }
  if (took('right')) { G.codexIdx = (G.codexIdx + 1) % n; AUDIO.play('move'); }
  if (took('up')) { G.codexIdx = (G.codexIdx + n - 4) % n; AUDIO.play('move'); }
  if (took('down')) { G.codexIdx = (G.codexIdx + 4) % n; AUDIO.play('move'); }
  if (took('pause') || took('ok') || took('biology')) { AUDIO.play('click'); setState(G.codexFrom || 'title'); }
}
function codexClick(x, y) {
  const i = codexRects().findIndex(r => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h);
  if (i >= 0) { G.codexIdx = i; AUDIO.play('move'); return; }
  if (x > 820 && y < 60) setState(G.codexFrom || 'title');   // the close button
}
// Draw an entry's icon by drawing a stand-in entity (or a tile) at the given point.
function drawCodexIcon(id, x, y, locked) {
  ctx.save();
  if (locked) ctx.globalAlpha = 0.18;
  const t = performance.now() / 16;
  const stub = { type: id, tx: 0, ty: 0, t, alive: true, x: x - 16, y: y - 16, cx: x, cy: y, hx: x, hy: y, face: 1, dir: 1, ang: 0, vx: -1, w: 28, h: 22 };
  const needsLevel = !L;
  if (needsLevel) L = { time: t, def: LEVELS[0], ents: [], fx: [], shots: [], movers: [] };
  try {
    if (id === 'lasa') { stub.x = x - 14; stub.y = y - 11; drawEntity(stub); }
    else if (id === 'drop') drawEntity({ ...stub, type: 'dripper', y: y - 22 });
    else if (id === 'foam') drawFoamIcon(x, y, t);
    else if (id === 'ribosome') drawRibosomeIcon(x, y);
    else if (id === 'boss') {
      ctx.translate(x, y + 12); ctx.scale(0.36, 0.36);
      drawBoss({ t, bx: 0, by: 0, jy: 0, open: 0.3, state: 'walk', hitT: 0, timer: 0 });
    } else if (id === 'hcn') drawEntity({ ...stub, y: y - 8, active: true });
    else if (id === 'rosb') drawEntity({ ...stub, vx: 3 });
    else drawEntity(stub);
  } finally {
    if (needsLevel) L = null;
    ctx.restore();
  }
}
function drawFoamIcon(x, y, t) {
  for (let k = 0; k < 3; k++) {
    const bx = x - 10 + k * 10, by = y + 4 - (k % 2) * 5 + Math.sin(t * 0.08 + k * 2) * 1.5;
    ball(bx, by, 6.5 - (k % 2) * 1.5, '#ffe0ef', '#e86aa9', '#9c2763');
  }
}
function drawRibosomeIcon(x, y) { drawRibosome(x - 16, y - 16, false, performance.now() / 16); }
function drawCodex() {
  const d = codexData(), counts = codexCounts(), rects = codexRects();
  const bg = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  bg.addColorStop(0, '#13283a'); bg.addColorStop(1, '#0b1820');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  text('CODEX', 34, 46, { size: 28, color: '#ffe27a', weight: '900' });
  text(`${counts.seen}/${CODEX.length} entries · peptides ${counts.peptides}/24 · secrets ${counts.secrets}/4`, 150, 44, { size: 14, color: '#c3ffdf', weight: '700' });
  roundRect(830, 22, 104, 30, 15, 'rgba(255,255,255,0.1)', 'rgba(255,255,255,0.3)', 1);
  text('✕ close', 882, 42, { size: 13, color: '#fff', align: 'center', weight: '800' });
  let y = 88;
  for (const [group, title] of CODEX_GROUPS) {
    text(title, 34, y + 12, { size: 11, color: 'rgba(195,255,223,0.7)', weight: '900' });
    y += 20 + Math.ceil(CODEX.filter(c => c.group === group).length / 4) * 58 + 6;
  }
  rects.forEach((r, i) => {
    const c = codexEntry(r.id), open = !!d.seen[c.id], sel = i === G.codexIdx;
    roundRect(r.x, r.y, r.w, r.h, 10, sel ? 'rgba(255,226,122,0.18)' : 'rgba(255,255,255,0.06)', sel ? '#ffe27a' : 'rgba(255,255,255,0.14)', sel ? 2 : 1);
    drawCodexIcon(c.id, r.x + 26, r.y + 26, !open);
    text(open ? c.name : '???', r.x + 50, r.y + 24, { size: 10, color: open ? '#fff' : 'rgba(255,255,255,0.45)', weight: '800' });
    if (open && c.group === 'enemy') text(`×${d.seen[c.id]}`, r.x + 50, r.y + 40, { size: 10, color: '#ffb3a8', weight: '800' });
  });
  // detail panel
  const c = CODEX[G.codexIdx], open = !!d.seen[c.id], note = c.topic && STUDY_FACTS[c.topic];
  roundRect(520, 76, 412, 368, 14, 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0.18)', 1);
  if (!open) {
    text('Not met yet', 726, 240, { size: 20, color: 'rgba(255,255,255,0.6)', align: 'center', weight: '800' });
    text('Play the levels to unlock this entry.', 726, 266, { size: 13, color: 'rgba(255,255,255,0.45)', align: 'center' });
  } else {
    drawCodexIcon(c.id, 566, 122, false);
    text(c.name, 602, 118, { size: 18, color: '#ffe27a', weight: '900' });
    text(c.group === 'enemy' ? `neutralised ${d.seen[c.id]}×` : 'collected or met', 602, 138, { size: 12, color: '#c3ffdf', weight: '700' });
    let ly = 172;
    const para = (title, body, color) => {
      text(title, 540, ly, { size: 11, color: 'rgba(195,255,223,0.75)', weight: '900' }); ly += 18;
      for (const ln of wrap(body, 370, 13)) { text(ln, 540, ly, { size: 13, color }); ly += 18; }
      ly += 8;
    };
    para('IN THIS GAME', c.note, '#f4f1ea');
    if (note) { para('THE BIOLOGY · ' + note.title.toUpperCase(), note.biology, '#dfe9ee'); }
    else para('THE BIOLOGY', 'None: this is a game collectible only.', '#dfe9ee');
  }
  // peptide album: six slots per map
  text('PEPTIDE ALBUM', 34, 470, { size: 11, color: 'rgba(195,255,223,0.7)', weight: '900' });
  LEVELS.forEach((lv, i) => {
    const got = Object.keys(d.peptides).filter(k => k.startsWith(i + ':')).length, x = 34 + i * 224;
    text(lv.name, x, 492, { size: 12, color: '#fff', weight: '800' });
    for (let k = 0; k < 6; k++) circle(x + 92 + k * 15, 488, 5, k < got ? '#9fe7ff' : 'rgba(255,255,255,0.15)');
    if (d.secrets[i]) { ctx.save(); ctx.translate(x + 196, 487); ctx.scale(0.5, 0.5); drawSecret(0, 0, performance.now() / 16); ctx.restore(); }
  });
  text('← → ↑ ↓ browse · Esc / Enter / B close · biology notes are referenced in the README', VIEW_W / 2, 526, { size: 12, color: 'rgba(255,255,255,0.55)', align: 'center' });
}
