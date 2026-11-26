'use strict';
// playtest.js -- a playtesting aid for tuning levels and medal times.
// Every hit and fall is logged in this browser: map, part, position, cause,
// difficulty and strain. Open the game with ?debug=deaths in the address to see
// the log as a heat map over the current part; J copies the whole log as JSON so
// a playtester can send it to the team. Nothing is uploaded.
const DEATH_KEY = 'je2jump_deaths_v1', DEATH_MAX = 3000;
const DEBUG_DEATHS = (() => {
  try { return new URLSearchParams(location.search).get('debug') === 'deaths'; } catch { return false; }
})();
let deathCache = null;   // parsed log, refreshed when something is added

// [map name, part (0/1), x, y, cause, difficulty, strain]
function loadDeaths() {
  if (deathCache) return deathCache;
  try {
    const v = JSON.parse(localStorage.getItem(DEATH_KEY));
    deathCache = Array.isArray(v) ? v.filter(d => Array.isArray(d) && d.length === 7 && Number.isFinite(d[2]) && Number.isFinite(d[3])) : [];
  } catch { deathCache = []; }
  return deathCache;
}
// The hand-built maps only: generated log-phase climbs differ every run.
function logDeath(cause) {
  if (!L || !P || L.def.endless) return;
  const list = loadDeaths().slice();
  list.push([L.def.name, L.stage, Math.round(P.x + P.w / 2), Math.round(P.y + P.h / 2), cause, L.difficulty, G.strain]);
  if (list.length > DEATH_MAX) list.splice(0, list.length - DEATH_MAX);
  deathCache = list;
  try { localStorage.setItem(DEATH_KEY, JSON.stringify(list)); } catch { /* storage full / private mode */ }
}
const deathsHere = () => loadDeaths().filter(d => d[0] === L.def.name && d[1] === L.stage);

// World coordinates: a soft red spot per logged hit; overlapping spots add up to heat.
function drawDeathMap() {
  if (!DEBUG_DEATHS || !L || L.def.endless) return;
  ctx.save(); ctx.globalCompositeOperation = 'multiply';
  for (const [, , x, y, cause] of deathsHere()) {
    if (x < L.cam - 60 || x > L.cam + VIEW_W + 60 || y < L.camY - 60 || y > L.camY + VIEW_H + 60) continue;
    glow(x, y, 30, cause === 'fall' ? '#3060ff' : '#ff2030', 0.32);
  }
  ctx.restore();
}
// Screen coordinates: a small panel with the counts per cause.
function drawDeathPanel() {
  if (!DEBUG_DEATHS || !L || L.def.endless) return;
  const here = deathsHere(), byCause = {};
  for (const d of here) byCause[d[4]] = (byCause[d[4]] || 0) + 1;
  const causes = Object.entries(byCause).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(' · ') || 'none yet';
  roundRect(VIEW_W / 2 - 230, 54, 460, 40, 10, 'rgba(60,8,16,0.88)', '#ff8a96', 1);
  text(`PLAYTEST · ${L.def.name} part ${L.stage + 1}: ${here.length} hits & falls (red = hit, blue = fall)`, VIEW_W / 2, 70, { size: 12, color: '#fff', align: 'center', weight: '800' });
  text(`${causes}  ·  all maps ${loadDeaths().length}  ·  J copies the log`, VIEW_W / 2, 86, { size: 11, color: '#ffd0d6', align: 'center', weight: '700' });
}
function exportDeaths() {
  if (!DEBUG_DEATHS) return;
  copyText(JSON.stringify({ format: 'je2jump deaths v1', fields: ['map', 'part', 'x', 'y', 'cause', 'difficulty', 'strain'], deaths: loadDeaths() }),
    'Playtest log copied as JSON.');
}
