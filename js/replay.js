'use strict';
// replay.js -- every attempt at a part, replayed at once. While you play, each
// "life" (from a start, a stock or a restart until a fall, a retry or the end of
// the part) is recorded as a short track. When a map is done and some part took
// more than one attempt, all tracks of that part race across a zoomed-out map.

function newAttempt() {
  L.attempt = { stage: L.stage, samples: [], end: null };
}
// Called from recordRun() every 6 frames.
function recordAttempt() {
  if (!L.attempt) newAttempt();
  if (L.attempt.samples.length < 3000) L.attempt.samples.push([Math.round(P.x + P.w / 2), Math.round(P.y + P.h / 2)]);
}
// End the current life. `how`: 'lost' (fell or n = 0), 'retry' or 'clear'.
function endAttempt(how) {
  const a = L.attempt;
  if (a && a.samples.length > 1) {
    a.end = how;
    (L.attempts[a.stage] || (L.attempts[a.stage] = [])).push(a);
    if (L.attempts[a.stage].length > 60) L.attempts[a.stage].shift();
  }
  L.attempt = null;
}
// Parts worth replaying: more than one attempt.
function replayParts() {
  return Object.keys(L.attempts).map(Number).filter(s => L.attempts[s].length > 1 && L.partArt[s]).sort();
}
function startReplay(next) {
  G.replay = { parts: replayParts(), i: 0, t: 0, next };
  if (!G.replay.parts.length) { next(); return; }
  setState('replay');
}
function replayLength(part) { return Math.max(...L.attempts[part].map(a => a.samples.length)); }
function replayRate(part) { return Math.max(1 / 3, replayLength(part) / 300); }   // at most ~5 s per part
function updateReplay() {
  const R = G.replay, part = R.parts[R.i];
  R.t += replayRate(part);
  const finished = R.t >= replayLength(part) + 40 * replayRate(part);
  if (took('ok') || took('jump') || finished) {
    if (++R.i >= R.parts.length) { G.replay = null; R.next(); }
    else R.t = 0;
  }
}
function drawReplay() {
  const R = G.replay, part = R.parts[R.i], art = L.partArt[part], tracks = L.attempts[part];
  ctx.fillStyle = '#0d151b'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const W = art.logicalWidth, H = art.logicalHeight, s = Math.min(900 / W, 420 / H), ox = (VIEW_W - W * s) / 2, oy = 92 + (420 - H * s) / 2;
  const sky = ctx.createLinearGradient(0, oy, 0, oy + H * s);
  sky.addColorStop(0, L.def.theme.sky[0]); sky.addColorStop(1, L.def.theme.sky[1]);
  ctx.fillStyle = sky; ctx.fillRect(ox, oy, W * s, H * s);
  ctx.drawImage(art, ox, oy, W * s, H * s);
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2; ctx.strokeRect(ox, oy, W * s, H * s);
  const lost = tracks.filter(a => a.end === 'lost').length;
  text(`${L.def.name} · PART ${part + 1}`, VIEW_W / 2, 40, { size: 24, color: '#ffe27a', align: 'center', weight: '900' });
  text(`${tracks.length} attempts at once · ${lost} replicate${lost === 1 ? '' : 's'} lost on the way`, VIEW_W / 2, 66, { size: 14, color: '#c3ffdf', align: 'center', weight: '700' });
  const i = Math.floor(R.t), r = Math.max(3, 9 * s);
  tracks.forEach((a, k) => {
    const n = a.samples.length, at = Math.min(i, n - 1), [x, y] = a.samples[at], X = ox + x * s, Y = oy + y * s;
    const clear = a.end === 'clear', over = i >= n;
    ctx.save();
    ctx.globalAlpha = clear ? 0.95 : over ? Math.max(0, 1 - (i - n) / 30) : 0.55;
    ctx.strokeStyle = clear ? '#ffe27a' : `hsla(${(k * 47) % 360},70%,75%,0.6)`; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let j = Math.max(0, at - 12); j <= at; j++) { const [tx, ty] = a.samples[j]; if (j === Math.max(0, at - 12)) ctx.moveTo(ox + tx * s, oy + ty * s); else ctx.lineTo(ox + tx * s, oy + ty * s); }
    ctx.stroke();
    if (over && a.end !== 'clear') {
      ctx.strokeStyle = '#ff6b6b'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(X - r, Y - r); ctx.lineTo(X + r, Y + r); ctx.moveTo(X + r, Y - r); ctx.lineTo(X - r, Y + r); ctx.stroke();
    } else {
      if (clear) glow(X, Y, r * 3, '#ffe27a', 0.6);
      circle(X, Y, r, clear ? '#f3c22f' : '#e8d9a8');
      ctx.strokeStyle = clear ? STRAINS[G.strain].colour : 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(X, Y, r, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  });
  ctx.globalAlpha = 0.6 + 0.4 * Math.sin(performance.now() / 260);
  text(R.i + 1 < R.parts.length ? 'Enter: next part' : 'Enter: results', VIEW_W / 2, 528, { size: 14, color: '#fff', align: 'center', weight: '800' });
  ctx.globalAlpha = 1;
}
