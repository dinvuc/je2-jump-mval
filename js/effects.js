'use strict';
// effects.js -- "juice": rings, debris chips, short world labels, pickups that
// fly into the HUD, a rolling score, the cell's gaze and mood, and the timing of
// the animated results screen. Everything here is decoration: none of it changes
// collisions, routes or scoring rules.

// ---- particles ------------------------------------------------------------------
// An expanding ring (stomps, hard landings, checkpoints, secrets).
function ring(x, y, r0, r1, color, life = 18, width = 3) {
  L.fx.push({ kind: 'ring', x, y, vx: 0, vy: 0, grav: 0, r0, r1, color, width, life, max: life, r: r0 });
}
// Tumbling rectangular chips (broken debris).
function shards(x, y, color, n = 8, speed = 3.5) {
  for (let i = 0; i < n; i++) {
    const a = -Math.PI * (0.15 + Math.random() * 0.7), s = speed * (0.5 + Math.random() * 0.7);
    L.fx.push({
      kind: 'shard', x: x + (Math.random() - 0.5) * 16, y: y + (Math.random() - 0.5) * 16,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s, grav: 0.32, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 0.5,
      w: 4 + Math.random() * 6, h: 3 + Math.random() * 4, color, life: 42, max: 42, r: 3,
    });
  }
}
function drawFxParticle(p) {
  const k = Math.max(0, p.life / p.max);
  if (p.kind === 'ring') {
    const t = 1 - k, r = p.r0 + (p.r1 - p.r0) * (1 - Math.pow(1 - t, 3));
    ctx.globalAlpha = k; ctx.strokeStyle = p.color; ctx.lineWidth = p.width * (0.35 + k);
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.stroke();
  } else if (p.kind === 'shard') {
    ctx.globalAlpha = Math.min(1, k * 2.5);
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.restore();
  } else {
    ctx.globalAlpha = k;
    circle(p.x, p.y, p.r, p.color);
  }
}

// ---- short labels in the world: they replace most tutorial banners -----------------
function tag(str, x, y, color = '#fff3c4', life = 110) {
  if (!L || !L.tags) return;
  L.tags = L.tags.filter(t => t.text !== str);
  L.tags.push({ text: str, x, y, color, life, max: life });
  if (L.tags.length > 4) L.tags.shift();
}
// A label above the player, shown only the first time in a run.
function tagOnce(key, str, color) {
  if (G.seen[key]) return;
  G.seen[key] = true;
  tag(str, P.x + P.w / 2, P.y - 26, color, 170);
}
// Big punchy words: stomp chains, secrets, generations.
function bigText(str, x, y, color = '#ffe27a', life = 70) {
  if (!L || !L.bigs) return;
  L.bigs.push({ text: str, x, y, color, life, max: life, tilt: (Math.random() - 0.5) * 0.2 });
}
function updateLabels() {
  for (const t of L.tags) { t.life--; t.y -= t.life > t.max - 14 ? 1.3 : 0.22; }
  if (L.tags.length) L.tags = L.tags.filter(t => t.life > 0);
  for (const b of L.bigs) { b.life--; b.y -= b.life > b.max - 10 ? 2 : 0.3; }
  if (L.bigs.length) L.bigs = L.bigs.filter(b => b.life > 0);
}
function drawLabels() {
  for (const t of L.tags) {
    const age = t.max - t.life, s = age < 8 ? 0.6 + 0.4 * Math.sin(age / 8 * Math.PI / 2) * 1.1 : 1;
    ctx.save();
    ctx.globalAlpha = Math.min(1, t.life / 18);
    ctx.translate(t.x, t.y); ctx.scale(s, s);
    ctx.font = `800 12px ${FONT}`;
    const w = ctx.measureText(t.text).width + 18;
    roundRect(-w / 2, -15, w, 21, 10, 'rgba(12,24,34,0.88)', rgba(t.color, 0.9), 1.5);
    text(t.text, 0, 0, { size: 12, color: t.color, align: 'center', weight: '800' });
    ctx.restore();
  }
  for (const b of L.bigs) {
    const age = b.max - b.life, s = age < 9 ? 1 + Math.pow(1 - age / 9, 2) * 1.3 : 1;
    ctx.save();
    ctx.globalAlpha = Math.min(1, b.life / 16);
    ctx.translate(b.x, b.y); ctx.rotate(b.tilt); ctx.scale(s, s);
    ctx.font = `900 26px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(20,14,28,0.85)'; ctx.strokeText(b.text, 0, 0);
    ctx.fillStyle = b.color; ctx.fillText(b.text, 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// ---- pickups fly into their HUD counter, which bounces when they arrive ------------
const HUD_TARGET = { cys: [300, 28], iron: [402, 28], score: [548, 28] };
function flyToHud(kind, x, y) {
  if (!L.flyers) return;
  L.flyers.push({ kind, sx: x - L.cam, sy: y - L.camY, t: 0, dur: 26 + Math.floor(Math.random() * 8) });
}
function updateFlyers() {
  for (const f of L.flyers) if (++f.t === f.dur) { L.hudBump[f.kind] = 10; AUDIO.play('tick', f.dur); }
  if (L.flyers.length) L.flyers = L.flyers.filter(f => f.t < f.dur);
  for (const k in L.hudBump) if (L.hudBump[k] > 0) L.hudBump[k]--;
  // the score rolls up towards its real value
  const target = G.score + L.points;
  if (!Number.isFinite(L.shownScore)) L.shownScore = target;
  const d = target - L.shownScore;
  L.shownScore = Math.abs(d) < 2 ? target : L.shownScore + d * 0.16 + Math.sign(d);
}
function hudScale(kind) { const b = (L.hudBump && L.hudBump[kind]) || 0; return 1 + Math.sin(b / 10 * Math.PI) * 0.4; }
function drawFlyers() {
  for (const f of L.flyers) {
    const k = f.t / f.dur, e = k * k, [tx, ty] = HUD_TARGET[f.kind];
    const x = f.sx + (tx - f.sx) * e, y = f.sy + (ty - f.sy) * e - Math.sin(k * Math.PI) * 50;
    ctx.globalAlpha = 0.5 + 0.5 * k;
    if (f.kind === 'cys') drawCystineIcon(x, y, 0.55);
    else if (f.kind === 'iron') drawIronIcon(x, y, 0.6);
    else { glow(x, y, 16, '#fff3a0', 0.7); circle(x, y, 4, '#fffbe0'); }
  }
  ctx.globalAlpha = 1;
}

// ---- the cell's gaze and mood ---------------------------------------------------------
const PICKUPS = new Set(['cystine', 'iron', 'peptide', 'psm', 'xan', 'ahpc', 'tcya', 'secret']);
const isThreatType = t => ENEMIES.has(t) || t === 'drop' || t === 'glob' || t === 'drift' || t === 'boss';
function entityCentre(e) {
  if (e.type === 'boss') return [e.bx, e.by + e.jy - 35];
  if (e.cx !== undefined) return [e.cx, e.cy];
  return [e.x + (e.w || 32) / 2, e.y + (e.h || 32) / 2];
}
function nearFoamTile() {
  const tx = Math.floor((P.x + P.w / 2) / TILE), ty = Math.floor((P.y + P.h / 2) / TILE);
  for (let y = ty - 1; y <= ty + 1; y++) for (let x = tx - 1; x <= tx + 1; x++) if (tileAt(x, y) === '^') return true;
  return false;
}
// Every few frames: look at the nearest thing of interest, and notice danger.
function updateGaze() {
  if (P.happy > 0) P.happy--;
  if (P.spin > 0) P.spin--;
  if (L.time % 6) return;
  const pcx = P.x + P.w / 2, pcy = P.y + P.h / 2;
  let best = null, bd = 230, threat = Infinity;
  for (const e of L.ents) {
    if (!e.alive) continue;
    const isThreat = isThreatType(e.type) || ((e.type === 'geyser' || e.type === 'hcn') && (e.active || e.warn));
    if (!isThreat && !PICKUPS.has(e.type)) continue;
    const [ex, ey] = entityCentre(e), d = dist(ex, ey, pcx, pcy);
    if (isThreat) threat = Math.min(threat, d);
    if (d < bd) { bd = d; best = [ex - pcx, ey - pcy]; }
  }
  P.look = best ? [best[0] / (bd || 1), best[1] / (bd || 1)] : null;
  P.scared = threat < 84 || nearFoamTile();
}
function playerMood() {
  if (P.dizzy > 30) return 'hurt';
  if (P.happy > 0) return 'happy';
  if (P.scared) return 'scared';
  if (P.dash > 0 || (G.strain === 'stp' && keys.jump && P.vy > 0 && P.glide > 0 && P.glide < 60)) return 'effort';
  return '';
}
// Sweat when time is short (pulse) or the depleted medium is close (log phase).
function playerSweats() {
  if (L.timeLimit && (L.timeLimit - L.time / 60) * PULSE_S / L.timeLimit < 120) return true;
  return !!(L.def.endless && L.front !== undefined && L.front - (P.y + P.h) < 140);
}

// ---- the camera looks ahead in the direction you face, and down when you fall -------
function updateLook() {
  if (Math.abs(P.vx) > 0.5) L.lookX += (P.face * VIEW_W * 0.1 - L.lookX) * 0.04;
  const down = P.vy > 6 && !P.onGround ? 80 : 0;
  L.lookY += (down - L.lookY) * (down ? 0.05 : 0.08);
}

// ---- the results screen plays in beats: score rolls, stars stamp, the medal drops ----
function resultTimeline(r) {
  const n = r.stars ? r.stars.length : 0, starsEnd = 34 + n * 16;
  return { starAt: i => 34 + i * 16, medalAt: starsEnd + 8, bestAt: starsEnd + 26, end: starsEnd + 40 };
}
function updateResultBeats(r) {
  const T = resultTimeline(r), t = ++G.resultT;
  if (t <= 30 && t % 3 === 0) AUDIO.play('tick', t);
  if (r.stars) r.stars.forEach((on, i) => { if (on && t === T.starAt(i)) AUDIO.play('star', i); });
  if (r.medal && t === T.medalAt) AUDIO.play('medal');
}
function resultsDone(r) { return G.resultT >= resultTimeline(r).end; }
// A stamp that punches in at `start` frames: returns its scale (0 before it lands).
function stampScale(start) {
  const a = G.resultT - start;
  if (a < 0) return 0;
  return a < 10 ? 1 + Math.pow(1 - a / 10, 2) * 1.2 : 1;
}
