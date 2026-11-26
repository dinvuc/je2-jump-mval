'use strict';
// entities.js -- everything that lives in a level, one entry per type:
//   init(e)    sets up its state when a level part loads or it is spawned,
//   box(e)     its hit box (enemies; others use the default in enemyBox),
//   update(e, cx, cy, pcx, pcy, spawned)  one world step; cx/cy is its centre,
//              pcx/pcy the player's centre, `spawned` collects new drops; it
//              returns true when the run moved on to another part (the gate),
//   draw(e, x, y, bob)  draws it at its world position (also the codex icons).
// A new enemy, hazard or pickup is one entry here (enemies also need their names
// in ENEMIES, ENEMY_COL and ENEMY_NAME). Shared rules -- stomping, damage, scoring,
// the boss fight -- stay in game.js. Loaded before game.js; only called at run time.

// living P. aeruginosa: a rod with a flagellum (pa) or pili (twitch)
function drawPaTwitch(e, x, y) {
  const swim = e.type === 'pa';
  const X = swim ? e.cx : e.x + 16, Y = swim ? e.cy : e.y + 24;
  const ang = swim ? e.ang : (e.dir > 0 ? 0 : Math.PI);
  ctx.save(); ctx.translate(X, Y); ctx.rotate(ang);
  if (swim) {
    ctx.strokeStyle = 'rgba(70,110,50,0.8)'; ctx.lineWidth = 1.6; ctx.beginPath();
    for (let k = 0; k <= 16; k++) { const px = -14 - k * 1.3, py = Math.sin(k * 0.8 - e.t * 0.4) * 3; if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
    ctx.stroke();
  } else {
    ctx.strokeStyle = 'rgba(70,110,50,0.7)'; ctx.lineWidth = 1;
    const ext = e.t % 50 < 16 ? 4 : 9;
    for (const dy of [-3, 0, 3]) { ctx.beginPath(); ctx.moveTo(14, dy); ctx.lineTo(14 + ext, dy * 1.6); ctx.stroke(); }
  }
  const g = ctx.createLinearGradient(0, -7, 0, 7);
  g.addColorStop(0, '#b8e6a2'); g.addColorStop(0.5, '#5fae4f'); g.addColorStop(1, '#2f6b28');
  roundRect(-14, -7, 28, 14, 7, g, '#24521f', 1.5);
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.ellipse(-3, -3.5, 7, 1.6, 0, 0, TAU); ctx.fill();
  circle(7, -1, 2.6, '#fff'); circle(8, -1, 1.3, '#111');
  ctx.restore();
}
function initLasbPa(e) {
  e.hx = e.x + 16; e.hy = e.y + 16; e.cx = e.hx; e.cy = e.hy; e.ang = 0;
}

const ENTITY = {
  peptide: {
    update(e, cx, cy, pcx, pcy) {
      if (dist(cx, cy, pcx, pcy) < 24) {
        e.alive = false; L.peptides++;
        gain(300, cx, cy, '#9fe7ff');
        burst(cx, cy, '#9fe7ff', 18, 3); ring(cx, cy, 6, 44, '#9fe7ff', 20);
        flyToHud('score', cx, cy);
        AUDIO.play('peptide');
        tag(`PEPTIDE ${L.peptides}/${L.totalPep}`, cx, cy - 24, '#9fe7ff', 130);
        meet('peptide'); codexPeptide(e);
      }
    },
    // a tryptic peptide (proteomics): a short chain ending in K or R
    draw(e, x, y, bob) {
      const yy = y + 16 + bob;
      glow(x + 16, yy, 24, '#9fe7ff', 0.5);
      for (let i = 0; i < 5; i++) ball(x + 4 + i * 6, yy + Math.sin(e.t * 0.1 + i) * 2.5, 3.6, '#ffffff', '#7fd4f0', '#2a7fa0');
      ball(x + 31, yy + Math.sin(e.t * 0.1 + 5) * 2.5, 4.2, '#ffffff', '#5aa0ff', '#1d4f99');
      text('K', x + 31, yy + 3.5 + Math.sin(e.t * 0.1 + 5) * 2.5, { size: 7, color: '#fff', align: 'center', weight: '900' });
    },
  },
  psm: {
    update(e, cx, cy, pcx, pcy) {
      if (dist(cx, cy, pcx, pcy) < 26) {
        e.alive = false; P.ammo = Math.min(MAX_AMMO, P.ammo + 12);
        burst(cx, cy, '#e88ad0', 14, 3); AUDIO.play('power'); P.happy = 40;
        tag(G.seen.psm ? '+12 PSM' : '+12 PSM · X / K / SHIFT TO SHOOT', cx, cy - 24, '#f3b6e2', 170);
        G.seen.psm = true; meet('psm');
      }
    },
    // PSM power-up: little amphipathic helices
    draw(e, x, y, bob) {
      const yy = y + 16 + bob;
      glow(x + 16, yy, 24, '#e88ad0', 0.45);
      for (const [dx, dy, a] of [[-7, -2, -0.5], [6, -5, 0.4], [1, 6, -0.1]]) {
        ctx.save(); ctx.translate(x + 16 + dx, yy + dy); ctx.rotate(a);
        roundRect(-8, -3.5, 16, 7, 3.5, '#d65fb4', '#7c1f63', 1.2);
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1;
        for (let k = -6; k <= 6; k += 4) { ctx.beginPath(); ctx.moveTo(k, -3); ctx.lineTo(k + 2, 3); ctx.stroke(); }
        ctx.restore();
      }
      text('PSM', x + 16, yy + 20, { size: 8, color: '#7c1f63', align: 'center', weight: '900' });
    },
  },
  xan: {
    update(e, cx, cy, pcx, pcy) {
      if (dist(cx, cy, pcx, pcy) < 26) {
        e.alive = false; P.gold = 60 * 12;
        burst(cx, cy, '#ffd84a', 18, 3.4); AUDIO.play('power'); P.happy = 40;
        tag('STAPHYLOXANTHIN · ROS-PROOF 12 s', cx, cy - 24, '#ffd84a', 160);
        meet('xan');
      }
    },
    // staphyloxanthin: the golden carotenoid (a long conjugated chain)
    draw(e, x, y, bob) {
      const yy = y + 16 + bob;
      glow(x + 16, yy, 28, '#ffd84a', 0.6);
      ctx.strokeStyle = '#c98a00'; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.beginPath();
      for (let i = 0; i <= 8; i++) { const px = x + 2 + i * 3.5, py = yy + (i % 2 ? -4 : 4); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
      ctx.stroke();
      ball(x + 31, yy + 4, 4.5, '#fff6b0', '#f3c22f', '#b38a00');
      for (let k = 0; k < 3; k++) { const a = e.t * 0.06 + k * TAU / 3; circle(x + 16 + Math.cos(a) * 16, yy + Math.sin(a) * 12, 1.8, '#fff3a0'); }
    },
  },
  secret: {
    // a golden cluster in a hidden room
    update(e, cx, cy, pcx, pcy) {
      if (dist(cx, cy, pcx, pcy) < 28) {
        e.alive = false; L.points += 1000; L.secret = true; P.happy = 60;
        burst(cx, cy, '#ffe066', 30, 4); ring(cx, cy, 8, 80, '#ffe066', 28, 4); ring(cx, cy, 4, 50, '#ffffff', 20, 2);
        flyToHud('score', cx, cy);
        bigText('SECRET FOUND!', cx, cy - 30, '#ffe066', 90);
        AUDIO.play('secret'); G.shake = Math.max(G.shake, 4);
        meet('secret'); codexSecret();
      }
    },
    draw(e, x, y, bob) { drawSecret(x + 16, y + 16 + bob, e.t); },
  },
  spring: {
    init(e) { e.cool = 0; e.sq = 0; },
    // a swollen cell: land on it and it throws you up
    update(e, cx, cy, pcx) {
      if (e.sq > 0) e.sq--;
      if (P.vy >= 0 && Math.abs(pcx - cx) < 20 && P.y + P.h >= e.y + 14 && P.y + P.h <= e.y + TILE + 0.5) {
        P.y = e.y + 14 - P.h; P.vy = SPRING_V; P.onGround = false; P.coyote = 0; P.ride = null; P.sprung = true; P.diving = false;
        P.squash = -0.3; e.sq = 14;
        AUDIO.play('boing');
        tagOnce('spring', 'BOING!', '#ffe9c4');
      }
    },
    // a swollen cell: squishes when it throws you
    draw(e, x, y) {
      const s = e.sq > 0 ? Math.sin(e.sq / 14 * Math.PI) : 0, X = x + 16, base = y + TILE;
      const rx = 15 + s * 4, ry = 10 - s * 4;
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(X, base, 15, 3, 0, 0, TAU); ctx.fill();
      const g = ctx.createRadialGradient(X - 5, base - ry - 4, 2, X, base - ry, rx);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#ffe7a8'); g.addColorStop(1, '#e0a52e');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(X, base - ry, rx, ry, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#b07a10'; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = 'rgba(176,122,16,0.6)'; ctx.lineWidth = 1.2;
      for (const dx of [-6, 0, 6]) { ctx.beginPath(); ctx.moveTo(X + dx - 2, base - ry - 2); ctx.lineTo(X + dx + 2, base - ry - 2); ctx.stroke(); }
    },
  },
  omv: {
    init(e) { e.vx = 1.5; e.vy = 0; },
    box(e) { return { x: e.x + 5, y: e.y + 5, w: 22, h: 22 }; },
    // outer membrane vesicle: bounces along
    update(e) {
      e.vy = Math.min(e.vy + 0.35, 9);
      const nx = e.x + e.vx;
      if (enemySolid(tileAt(Math.floor((e.vx > 0 ? nx + 27 : nx + 5) / TILE), Math.floor((e.y + 16) / TILE)))) e.vx = -e.vx; else e.x = nx;
      const prevB = e.y + 27;
      e.y += e.vy;
      const col = Math.floor((e.x + 16) / TILE), R = Math.floor((e.y + 27) / TILE), c = tileAt(col, R);
      if (e.vy > 0 && (enemySolid(c) || oneWay(c)) && prevB <= R * TILE + 1) { e.y = R * TILE - 27; e.vy = -7.2; }
      if (e.vy < 0 && isSolid(tileAt(col, Math.floor((e.y + 5) / TILE)))) e.vy = 1;
      if (e.y > L.rows * TILE) e.alive = false;
      enemyContact(e, 'An outer membrane vesicle (OMV) of P. aeruginosa delivered its cargo into you.');
    },
    // outer membrane vesicle: a double-membrane bubble with cargo
    draw(e, x, y) {
      const X = x + 16, Y = y + 16;
      ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.ellipse(X, (surfaceBelow(X, y + 27) || Y + 12) + 1, 9, 2.5, 0, 0, TAU); ctx.fill();
      const g = ctx.createRadialGradient(X - 4, Y - 5, 1, X, Y, 12);
      g.addColorStop(0, 'rgba(255,255,255,0.8)'); g.addColorStop(0.6, 'rgba(160,190,240,0.55)'); g.addColorStop(1, 'rgba(90,120,200,0.8)');
      circle(X, Y, 12, g);
      ctx.strokeStyle = '#4b63b5'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X, Y, 12, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(75,99,181,0.6)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(X, Y, 9, 0, TAU); ctx.stroke();
      for (const [dx, dy, c] of [[-3, 2, '#e0465a'], [3, -2, '#2b6fd0'], [2, 4, '#9cc21e']]) circle(X + dx, Y + dy, 2, c);
    },
  },
  boss: {
    init(e) {
      Object.assign(e, { bx: e.x + 16, by: (e.ty + 1) * TILE, hp: 20, maxHp: 20, state: 'idle', timer: 0, dir: 1, open: 0, vy: 0, jy: 0, hitT: 0, cycle: 0 });
    },
    update(e, cx, cy, pcx) { updateBoss(e, pcx); },
    draw(e) { drawBoss(e); },
  },
  glob: {
    // a pyocyanin glob spat by the boss
    update(e) {
      e.vy = Math.min(e.vy + 0.3, 9); e.x += e.vx; e.y += e.vy;
      if (isSolid(tileAt(Math.floor((e.x + 16) / TILE), Math.floor((e.y + 20) / TILE))) || e.y > L.rows * TILE) {
        e.alive = false; burst(e.x + 16, e.y + 16, '#3d86d9', 6, 1.8, 0.1, 18); return;
      }
      if (overlap(P, { x: e.x + 9, y: e.y + 9, w: 14, h: 14 })) {
        e.alive = false;
        if (P.dash > 0 || P.diving) burst(e.x + 16, e.y + 16, '#3d86d9', 8, 2.4, 0.1, 18);
        else hurt('ros', 'Pyocyanin from the colony made ROS in your cell.');
      }
    },
    draw(e, x, y) {
      const g = ctx.createRadialGradient(x + 13, y + 13, 1, x + 16, y + 16, 8);
      g.addColorStop(0, '#cfe3ff'); g.addColorStop(1, '#1f63c0');
      glow(x + 16, y + 16, 14, '#2b6fd0', 0.4); circle(x + 16, y + 16, 7, g);
    },
  },
  rosgun: {
    init(e) { e.cool = 60 + (e.tx * 37) % 120; },
    // pyocyanin redox launcher: fires superoxide radicals at you
    update(e, cx, cy, pcx, pcy) {
      if (e.cool > 0) e.cool--;
      const dx = pcx - cx;
      e.face = dx >= 0 ? 1 : -1;
      if (e.cool === 0 && Math.abs(dx) > 40 && Math.abs(dx) < 620 && Math.abs(pcy - cy) < 150) {
        e.cool = e.exposed ? 115 : 170;
        spawnEnemy('rosb', cx + e.face * 20, cy - 4, { vx: e.face * 3.2 });
        burst(cx + e.face * 18, cy - 4, '#ffb36b', 8, 2, 0, 16);
        AUDIO.play('shoot');
        if (!G.seen.rosgun) { G.seen.rosgun = true; tag('SUPEROXIDE! JUMP, STOMP OR SHOOT', cx, cy - 30, '#ffb36b', 170); }
      }
    },
    // pyocyanin redox launcher: a barrel with phenazine rings
    draw(e, x, y) {
      const X = x + 16, base = y + TILE, f = e.face || 1, ready = e.cool < 30;
      roundRect(x + 3, base - 10, 26, 10, 3, '#3a4660', '#232b3d', 1.5);
      roundRect(x + 2, y + 4, 28, 20, 8, '#2d4f8a', '#1a2f57', 2);
      roundRect(X + f * 10 - 5, y + 8, 10, 12, 3, '#1a2f57');
      ctx.fillStyle = 'rgba(120,170,255,0.45)'; ctx.strokeStyle = '#9cc2ff'; ctx.lineWidth = 1.2;
      for (const dx of [-6, 0, 6]) { hexagon(X - f * 2 + dx, y + 14, 3.6, Math.PI / 6); ctx.fill(); ctx.stroke(); }
      if (ready) glow(X + f * 16, y + 14, 14, '#ff7a3c', 0.3 + 0.3 * Math.sin(e.t * 0.4));
    },
  },
  rosb: {
    box(e) { return { x: e.x + 2, y: e.y + 9, w: 28, h: 14 }; },
    // a superoxide radical flying straight ahead
    update(e) {
      e.x += e.vx;
      if (enemySolid(tileAt(Math.floor((e.x + 16 + Math.sign(e.vx) * 14) / TILE), Math.floor((e.y + 16) / TILE))) || e.t > 420) {
        e.alive = false; burst(e.x + 16, e.y + 16, '#ff7a3c', 10, 2.2, 0.05, 20); return;
      }
      enemyContact(e, 'A superoxide radical (ROS) hit you.', 'ros');
    },
    // superoxide radical: a hot O2 with an unpaired electron and a trail
    draw(e, x, y) {
      const X = x + 16, Y = y + 16, d = Math.sign(e.vx) || 1;
      for (let k = 1; k <= 5; k++) circle(X - d * k * 5, Y + Math.sin(e.t * 0.5 + k) * 1.5, 6 - k, `rgba(255,${120 + k * 20},60,${0.5 - k * 0.08})`);
      glow(X, Y, 18, '#ff5a2a', 0.45);
      ball(X - 4, Y, 6.5, '#ffe0c8', '#ff6a3a', '#b3261e'); ball(X + 4, Y, 6.5, '#ffe0c8', '#ff6a3a', '#b3261e');
      text('O₂', X, Y + 3.5, { size: 8, color: '#fff', align: 'center', weight: '900' });
      circle(X + d * 10, Y - 6, 2.3, '#fff8a0');   // the unpaired electron (the "•" in O₂•⁻)
    },
  },
  lasb: {
    init: initLasbPa,
    // LasB elastase: a protease that drifts in loops
    update(e, cx, cy) {
      e.cx = e.hx + Math.sin(e.t * 0.022) * 90; e.cy = e.hy + Math.sin(e.t * 0.05) * 24;
      e.face = Math.cos(e.t * 0.022) >= 0 ? 1 : -1;
      enemyContact(e, 'LasB elastase, another P. aeruginosa protease, hit you.');
    },
    // LasB elastase: a zinc protease (teal) with jaws
    draw(e) {
      const X = e.cx, Y = e.cy, dir = e.face || 1;
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.ellipse(X, Y + 22, 12, 3, 0, 0, TAU); ctx.fill();
      ball(X, Y, 12, '#a8efe5', '#2f8f86', '#124a45');
      ctx.fillStyle = '#e9f5f3';
      const open = Math.abs(Math.sin(e.t * 0.25)) * 0.5;
      for (const sgn of [-1, 1]) {
        ctx.save(); ctx.translate(X + dir * 9, Y + 2); ctx.rotate(sgn * (0.35 + open) * dir);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(dir * 11, sgn * 2); ctx.lineTo(dir * 3, sgn * 5); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      circle(X - dir * 2, Y + 4, 3.2, '#b9c2c9'); text('Zn', X - dir * 2, Y + 6, { size: 5, color: '#333', align: 'center', weight: '900' });
      circle(X + dir * 3, Y - 4, 2.8, '#fff'); circle(X + dir * 4, Y - 3.5, 1.4, '#111');
      // little wings of motion so it reads as flying
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5;
      for (const k of [0, 1]) { ctx.beginPath(); ctx.moveTo(X - dir * (14 + k * 5), Y - 3 + k * 6); ctx.lineTo(X - dir * (20 + k * 5), Y - 3 + k * 6); ctx.stroke(); }
      text('LasB', X, Y - 15, { size: 8, color: '#124a45', align: 'center', weight: '900' });
    },
  },
  hcn: {
    // a vent that puffs hydrogen cyanide now and then
    update(e, cx, cy, pcx, pcy) {
      const ph = e.t % 220;
      e.warn = ph > 110 && ph <= 140; e.active = ph > 140;
      if (e.warn && dist(cx, cy, pcx, pcy) < 260) meet('hcn');
      if (e.active && overlap(P, { x: e.x - 18, y: e.y - 60, w: 68, h: 92 })) hurt('hcn', 'HCN (hydrogen cyanide) blocked your respiration.');
    },
    // a vent that puffs hydrogen cyanide
    draw(e, x, y) {
      const X = x + 16, base = y + TILE;
      roundRect(x + 6, base - 7, 20, 7, 3, '#6d6a7a', '#4a4756', 1.2);
      circle(X, base - 6, 3.5, '#2b2833');
      const ph = e.t % 220;
      if (e.active || e.warn) {
        const k = clamp(e.active ? (ph - 140) / 20 : (ph - 110) / 30 * 0.3, 0, 1);
        for (let i = 0; i < 6; i++) {
          const a = i * 1.1 + e.t * 0.03, rr = (14 + i * 3) * k + 4;
          const px = X + Math.sin(a) * 14 * k, py = base - 14 - i * 9 * k;
          const g = ctx.createRadialGradient(px, py, 0, px, py, rr);
          g.addColorStop(0, `rgba(205,195,225,${0.55 * (e.active ? 1 : 0.6)})`); g.addColorStop(1, 'rgba(205,195,225,0)');
          circle(px, py, rr, g);
        }
        if (e.active) text('HCN', X, base - 40, { size: 12, color: '#4a3d6a', align: 'center', weight: '900' });
        else text('!', X, base - 16, { size: 14, color: '#7a5db0', align: 'center', weight: '900' });
      } else for (let k = 0; k < 2; k++) circle(X + Math.sin(e.t * 0.05 + k * 3) * 3, base - 10 - ((e.t * 0.4 + k * 10) % 18), 2, 'rgba(205,195,225,0.5)');
    },
  },
  geyser: {
    init(e) { e.h = e.h || 3; e.phase = e.phase || 0; },
    // rhamnolipid foam that wells up in a column, with a bubbling warning first
    update(e, cx, cy, pcx, pcy) {
      const s = foamGeyserState(e);
      e.warn = s.warn; e.active = s.height > 0;
      if (e.warn && dist(cx, cy, pcx, pcy) < 220) meet('foam');
      if (e.active && overlap(P, { x: e.x + 5, y: e.y + TILE - s.height, w: 22, h: s.height })) hurt('foam', 'A column of rhamnolipid foam damaged your membrane.');
    },
    // rhamnolipid foam well: a pink crater that bubbles, then erupts a column
    draw(e, x, y) {
      const X = x + 16, base = y + TILE, s = foamGeyserState(e);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(X, base - 1, 14, 3.5, 0, 0, TAU); ctx.fill();
      roundRect(x + 4, base - 8, 24, 8, 4, '#c2457f', '#7d1b4f', 1.5);
      circle(X, base - 6, 4, '#5c0f38');
      if (s.warn) {
        const k = (s.ph - GEYSER_WARN) / (GEYSER_UP - GEYSER_WARN);
        glow(X, base - 8, 18 + k * 10, '#e0458f', 0.35 + k * 0.25);
        for (let i = 0; i < 4; i++) {
          const bx = X - 9 + i * 6 + Math.sin(e.t * 0.4 + i) * 1.5, by = base - 10 - ((e.t * 1.3 + i * 7) % (8 + k * 14));
          ball(bx, by, 2.5 + k * 1.5, '#ffe0ef', '#e86aa9', '#9c2763');
        }
        if (blinkOn(e.t, 6)) text('!', X, base - 28 - k * 6, { size: 15, color: '#c2185b', align: 'center', weight: '900' });
      } else if (s.height > 0) {
        glow(X, base - s.height / 2, 20 + s.height * 0.3, '#e0458f', 0.3);
        for (let yy = 0; yy < s.height; yy += 9) {
          const sway = Math.sin(e.t * 0.25 + yy * 0.15) * 3, r = 7 - (yy / (e.h * TILE)) * 2.5;
          ball(X - 5 + sway, base - 6 - yy, r, '#ffe0ef', '#e86aa9', '#9c2763');
          ball(X + 5 - sway, base - 10 - yy, r - 1, '#ffe0ef', '#e86aa9', '#9c2763');
        }
        ball(X, base - s.height - 2, 8, '#fff0f7', '#f08cbf', '#a32a68');
      } else for (let k = 0; k < 2; k++) circle(X - 3 + k * 6, base - 9 - ((e.t * 0.3 + k * 9) % 10), 1.8, 'rgba(240,140,190,0.7)');
    },
  },
  drift: {
    init(e) {
      e.dx = e.dx || 0; e.dy = e.dy || 0; e.per = e.per || 240; e.phase = e.phase || 0; e.cx = e.x + 16; e.cy = e.y + 16;
    },
    // a clump of rhamnolipid foam drifting along a fixed path
    update(e, cx, cy) {
      const a = (e.t + e.phase) / e.per * TAU;
      e.cx = e.x + 16 + Math.sin(a) * e.dx * TILE; e.cy = e.y + 16 + Math.sin(a) * e.dy * TILE;
      if (overlap(P, { x: e.cx - 12, y: e.cy - 11, w: 24, h: 22 })) hurt('foam', 'Drifting rhamnolipid foam damaged your membrane.');
    },
    // a drifting clump of rhamnolipid foam
    draw(e) {
      const X = e.cx, Y = e.cy;
      glow(X, Y, 26, '#e0458f', 0.3);
      for (const [dx, dy, r] of [[-7, 3, 7], [6, 4, 7.5], [0, -5, 8], [-2, 7, 5], [9, -3, 5]]) {
        const w = Math.sin(e.t * 0.12 + dx) * 1.2;
        ball(X + dx + w, Y + dy - w, r, '#ffe0ef', '#e86aa9', '#9c2763');
      }
      const rise = (e.t * 0.5) % 20;
      ctx.strokeStyle = `rgba(232,106,169,${0.7 - rise / 28})`; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(X + 4, Y - 12 - rise, 2.2, 0, TAU); ctx.stroke();
    },
  },
  pa: {
    init: initLasbPa,
    // a living P. aeruginosa cell (CF level only): swims towards you
    update(e, cx, cy, pcx, pcy) {
      const d = dist(pcx, pcy, e.cx, e.cy);
      let tx = e.hx + Math.sin(e.t * 0.02) * 50, ty = e.hy + Math.cos(e.t * 0.03) * 20;
      if (d < 260) { tx = pcx; ty = pcy; }
      const hd = dist(tx, ty, e.hx, e.hy);
      if (hd > 180) { tx = e.hx + (tx - e.hx) / hd * 180; ty = e.hy + (ty - e.hy) / hd * 180; }
      const dd = dist(tx, ty, e.cx, e.cy), sp = d < 260 ? 1.25 : 0.6;
      if (dd > 1) { e.cx += (tx - e.cx) / dd * sp; e.cy += (ty - e.cy) / dd * sp; e.ang = Math.atan2(ty - e.cy, tx - e.cx); }
      enemyContact(e, 'A P. aeruginosa cell attacked you.');
    },
    draw: drawPaTwitch,   // living P. aeruginosa: a rod with a flagellum (pa) or pili (twitch)
  },
  twitch: {
    init(e) { e.dir = -1; },
    box(e) { return { x: e.x + 2, y: e.y + 17, w: 28, h: 15 }; },
    // P. aeruginosa crawling with its pili (CF level only): jerky moves
    update(e) {
      if (e.t % 50 < 16) {
        const nx = e.x + e.dir * 2.6, front = e.dir > 0 ? nx + 30 : nx + 2;
        const ftx = Math.floor(front / TILE), fty = Math.floor((e.y + 31) / TILE);
        const ahead = tileAt(ftx, fty), below = tileAt(ftx, fty + 1);
        if (enemySolid(ahead) || ahead === '^' || !(enemySolid(below) || oneWay(below))) e.dir = -e.dir; else e.x = nx;
      }
      enemyContact(e, 'A twitching P. aeruginosa cell pulled itself into you.');
    },
    draw: drawPaTwitch,   // living P. aeruginosa: a rod with a flagellum (pa) or pili (twitch)
  },
  cystine: {
    update(e, cx, cy, pcx, pcy) {
      if (P.magnet > 0 && dist(cx, cy, pcx, pcy) < 170) {
        const d = dist(cx, cy, pcx, pcy) || 1;
        e.x += (pcx - cx) / d * 5; e.y += (pcy - cy) / d * 5;
      }
      if (dist(cx, cy, pcx, pcy) < 24) {
        e.alive = false; L.cystine++;
        AUDIO.play('cys', gain(100, cx, cy, '#ffe36a'));
        burst(cx, cy, '#f5d33a', 12, 2.6);
        flyToHud('cys', cx, cy);
        meet('cystine');
      }
    },
    // two S atoms bonded: S–S, with an occasional twinkle
    draw(e, x, y, bob) {
      glow(x + 16, y + 16 + bob, 20, '#ffd84a', 0.35);
      drawCystineIcon(x + 16, y + 16, 1, bob);
      const tw = (e.t + e.tx * 17) % 100;
      if (tw < 16) {
        const k = Math.sin(tw / 16 * Math.PI) * 6, sx = x + 25, sy = y + 8 + bob;
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.beginPath(); ctx.ellipse(sx, sy, k, k * 0.18, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(sx, sy, k * 0.18, k, 0, 0, TAU); ctx.fill();
      }
    },
  },
  iron: {
    update(e, cx, cy, pcx, pcy) {
      if (dist(cx, cy, pcx, pcy) < 24) {
        e.alive = false; L.ironTotal++; L.ironBank++;
        AUDIO.play('iron', gain(50, cx, cy, '#ff9a62'));
        burst(cx, cy, '#e0743c', 12, 2.6);
        flyToHud('iron', cx, cy);
        meet('iron');
        if (L.ironBank >= 3) {
          L.ironBank = 0;
          if (P.reps < L.maxReps) { P.reps++; P.repFlash = 0; tag('3 Fe · +1 REPLICATE', pcx, pcy - 30, '#9be89f', 150); ring(pcx, pcy, 6, 50, '#9be89f', 22); }
          else { L.points += 300; tag('3 Fe · +300', pcx, pcy - 30, '#ffb27a', 120); }
        }
      }
    },
    draw(e, x, y, bob) {
      glow(x + 16, y + 16 + bob, 20, '#ff8a4a', 0.35);
      drawIronIcon(x + 16, y + 16 + bob);
    },
  },
  ahpc: {
    update(e, cx, cy, pcx, pcy) {
      if (dist(cx, cy, pcx, pcy) < 26) {
        e.alive = false; P.shield = 60 * 20; burst(cx, cy, '#7fb6ff', 14, 3); AUDIO.play('power'); P.happy = 40;
        tag('AhpC SHIELD · BLOCKS ONE ROS HIT', cx, cy - 24, '#9cc6ff', 150); meet('ahpc');
      }
    },
    // a globular protein
    draw(e, x, y, bob) {
      const yy = y + 16 + bob, pulse = 1 + Math.sin(e.t * 0.1) * 0.08;
      glow(x + 16, yy, 26 * pulse, '#5aa0ff', 0.4);
      for (const [dx, dy, r] of [[-6, -3, 8], [6, -4, 8], [0, 5, 9], [-8, 6, 6], [8, 5, 6]]) ball(x + 16 + dx, yy + dy, r, '#cfe3ff', '#4f8fe0', '#24538f');
      text('AhpC', x + 16, yy + 4, { size: 10, color: '#fff', align: 'center', weight: '800' });
    },
  },
  tcya: {
    update(e, cx, cy, pcx, pcy) {
      if (dist(cx, cy, pcx, pcy) < 26) {
        e.alive = false; P.magnet = 60 * 12; burst(cx, cy, '#f0c850', 14, 3); AUDIO.play('power'); P.happy = 40;
        tag('TcyA · CYSTINE MAGNET 12 s', cx, cy - 24, '#f0c850', 150); meet('tcya');
      }
    },
    // substrate-binding protein: two lobes holding a cystine
    draw(e, x, y, bob) {
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
    },
  },
  check: {
    update(e, cx, cy, pcx, pcy) {
      if (e.on && e.fillT !== undefined && e.fillT < 30) e.fillT++;
      if (!e.on && Math.abs(cx - pcx) < 20 && Math.abs(cy - pcy) < 40) {
        for (const o of L.ents) if (o.type === 'check') o.on = false;
        e.on = true; e.fillT = 0; L.respawn = { x: e.x + 4, y: e.y + 4 };
        if (!e.saved) { e.saved = true; L.stocks++; }
        burst(cx, cy, '#bfe6ff', 14, 2.4, -0.03); ring(cx, cy, 6, 46, '#bfe6ff', 22);
        AUDIO.play('check');
        tag('STOCK SAVED', cx, cy - 34, '#bfe6ff', 110);
        captureCheckpoint();
      }
    },
    // a cryo-vial: the glycerol stock you restart from
    draw(e, x, y) {
      const X = x + 10, Y = y + 2;
      if (e.on) glow(X + 6, Y + 18, 24, '#9fd8ff', 0.55);
      roundRect(X, Y + 6, 12, 26, [2, 2, 6, 6], 'rgba(235,245,255,0.85)', '#7d93a8', 1.5);
      // the vial fills with golden culture when the stock is saved
      const fill = e.on ? Math.min(1, (e.fillT ?? 30) / 30) : 0;
      roundRect(X + 1.5, Y + 18, 9, 12.5, [0, 0, 5, 5], '#c9d2da');
      if (fill > 0) {
        const h = 12.5 * fill;
        roundRect(X + 1.5, Y + 30.5 - h, 9, h, [0, 0, 5, 5], '#f3c22f');
        if (fill < 1) for (let k = 0; k < 2; k++) circle(X + 4 + k * 4, Y + 30 - ((e.t * 1.5 + k * 7) % h), 1.2, '#fff6c8');
      }
      roundRect(X - 2, Y, 16, 8, 2, e.on ? '#2eaa5c' : '#8a96a3');
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(X + 2, Y + 9, 2, 18);
      if (e.on) for (let k = 0; k < 3; k++) {
        const a = e.t * 0.04 + k * 2.1;
        text('*', X + 6 + Math.cos(a) * 14, Y + 20 + Math.sin(a) * 10, { size: 12, color: '#bfe6ff', align: 'center', weight: '900' });
      }
    },
  },
  stage: {
    // the gate to part 2: a checkpoint that moves the run on
    update(e) {
      if (overlap(P, { x: e.x, y: e.y - TILE, w: TILE * 2, h: TILE * 2 })) {
        if (G.mode === 'daily') { finishLevel(); return true; }   // a daily challenge is one part only
        enterStage(L.stage + 1); return true;
      }
    },
    // gate to part 2: a large glowing cryo-vial with an arrow
    draw(e, x, y) {
      const X = x + 16, Y = y - TILE + 4, pulse = 0.5 + 0.5 * Math.sin(e.t * 0.08);
      glow(X + 8, Y + 30, 46 + pulse * 8, '#9fd8ff', 0.45 + pulse * 0.2);
      roundRect(X - 12, Y + 12, 40, 46, [4, 4, 12, 12], 'rgba(235,245,255,0.88)', '#7d93a8', 2);
      roundRect(X - 9, Y + 30, 34, 25, [0, 0, 10, 10], '#f3c22f');
      roundRect(X - 16, Y, 48, 14, 4, '#2eaa5c', '#1e7a40', 1.5);
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(X - 5, Y + 16, 3, 36);
      for (let k = 0; k < 3; k++) {
        const a = e.t * 0.05 + k * 2.1;
        text('*', X + 8 + Math.cos(a) * 30, Y + 34 + Math.sin(a) * 22, { size: 14, color: '#bfe6ff', align: 'center', weight: '900' });
      }
      const ax = X + 8 + Math.sin(e.t * 0.12) * 3;
      ctx.strokeStyle = '#1e7a40'; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(ax - 7, Y + 36); ctx.lineTo(ax + 4, Y + 43); ctx.lineTo(ax - 7, Y + 50); ctx.stroke();
      roundRect(X - 30, Y - 26, 76, 20, 10, 'rgba(14,36,45,0.85)');
      text('PART 2 ▶', X + 8, Y - 11, { size: 13, color: '#9fffe0', align: 'center', weight: '900' });
    },
  },
  goal: {
    update(e) {
      const box = { x: e.x, y: e.y - TILE, w: TILE * 2, h: TILE * 2 };
      if (overlap(P, box)) {
        const miss = missingGoals();
        if (!miss.length) finishLevel();
        else if (L.goalMsgT === 0) {
          toast(`${L.def.goalKind === 'sputum' ? 'The sample' : 'The MS'} is not ready yet. Still to do: ${miss.map(g => goalStatus(g).text).join(' · ')}`, 220);
          L.goalMsgT = 180;
        }
      }
    },
    // the LC-MS/MS (or, in the CF level, a sputum sample cup)
    draw(e, x, y) {
      // Only goals you must finish elsewhere (the CF colony) count on the label.
      const miss = missingGoals().filter(g => !REACH_GOALS.has(g.id)).length, nReq = L.def.goals.filter(g => g.req && !REACH_GOALS.has(g.id)).length;
      const status = () => { if (nReq) text(miss ? `${nReq - miss}/${nReq} goals` : 'ready!', x + TILE, y - TILE - 32, { size: 12, color: miss ? '#a0202f' : '#1b7f3b', align: 'center', weight: '800' }); };
      if (L.def.goalKind === 'sputum') {
        const X = x + 4, Y = y - TILE + 4;
        glow(X + 28, Y + 34, 44, '#ffffff', 0.35);
        roundRect(X, Y + 10, 56, 50, [4, 4, 12, 12], 'rgba(235,245,255,0.8)', '#8aa0b5', 2);
        roundRect(X + 3, Y + 34, 50, 23, [0, 0, 10, 10], 'rgba(214,214,110,0.85)');
        for (let k = 0; k < 4; k++) circle(X + 12 + k * 11, Y + 42 + (k % 2) * 6, 3, 'rgba(255,255,220,0.7)');
        roundRect(X - 4, Y, 64, 13, 4, '#2f6fd0', '#1d4f99', 1.5);
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(X + 6, Y + 14, 3, 40);
        text('sputum sample', x + TILE, Y - 8, { size: 11, color: '#1d2733', align: 'center', weight: '800' });
        status();
        return;
      }
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
      status();
    },
  },
  dripper: {
    update(e, cx, cy, pcx, pcy, spawned) {
      // Wait until the player is near, then drop pyocyanin every ~1.6 s.
      if (Math.abs(cx - pcx) < VIEW_W * 0.7 && Math.abs(cy - pcy) < VIEW_H && e.t % (e.exposed ? 60 : 80) === 0) {
        spawned.push({ type: 'drop', x: e.x + 12, y: e.y + 26, vy: 0, alive: true, t: 0 });
        meet('drop');
      }
    },
    // pyocyanin: a blue phenazine (three fused rings) that drips
    draw(e, x, y) {
      const X = x + 16, Y = y + 8;
      glow(X, Y, 30, '#2b6fd0', 0.35);
      ctx.fillStyle = 'rgba(70,130,230,0.35)'; ctx.strokeStyle = '#1d4fa0'; ctx.lineWidth = 2;
      for (const dx of [-11, 0, 11]) { hexagon(X + dx, Y, 6.4, Math.PI / 6); ctx.fill(); ctx.stroke(); }
      const ph = (e.t % 100) / 100, r = 1 + ph * 3.5;
      ctx.fillStyle = '#2f7ad8';
      ctx.beginPath(); ctx.moveTo(X, Y + 6); ctx.quadraticCurveTo(X + r, Y + 8 + r * 1.5, X, Y + 8 + r * 2.4); ctx.quadraticCurveTo(X - r, Y + 8 + r * 1.5, X, Y + 6); ctx.fill();
    },
  },
  drop: {
    update(e) {
      e.vy = Math.min(e.vy + 0.25, 8); e.y += e.vy;
      if (tileAt(Math.floor((e.x + 4) / TILE), Math.floor((e.y + 8) / TILE)) !== ' ' || e.y > L.rows * TILE ||
          L.solids.some(r => overlap({ x: e.x, y: e.y, w: 8, h: 10 }, r))) {
        e.alive = false;
        burst(e.x + 4, e.y + 6, '#3d86d9', 5, 1.5, 0.1, 18);
        return;
      }
      if (overlap(P, { x: e.x, y: e.y, w: 8, h: 10 })) {
        e.alive = false;
        hurt('ros', 'Pyocyanin made ROS in your cell.');
      }
    },
    draw(e, x, y) {
      const g = ctx.createLinearGradient(x, y, x + 8, y + 12);
      g.addColorStop(0, '#9cc8ff'); g.addColorStop(1, '#1f63c0');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x + 4, y - 2); ctx.quadraticCurveTo(x + 10, y + 8, x + 4, y + 11); ctx.quadraticCurveTo(x - 2, y + 8, x + 4, y - 2); ctx.fill();
      circle(x + 2.5, y + 6, 1.4, 'rgba(255,255,255,0.8)');
    },
  },
  hqno: {
    // drawn before its first update
    init(e) { e.cx = e.x + 16; e.cy = e.y + 16; },
    update(e, cx, cy, pcx, pcy) {
      e.cx = cx + Math.sin(e.t * 0.02) * 70; e.cy = cy + Math.sin(e.t * 0.031) * 22;
      if (dist(e.cx, e.cy, pcx, pcy) < 46) {
        if (P.slow === 0) { tagOnce('hqno', 'HQNO · SLOWER, WEAKER JUMPS', '#c9e59a'); meet('hqno'); }
        P.slow = 150;
      }
    },
    draw(e) {
      const X = e.cx, Y = e.cy;
      for (const [dx, dy, r] of [[0, 0, 32], [-24, 7, 22], [24, 5, 24], [6, -16, 20], [-12, -10, 16]]) {
        const g = ctx.createRadialGradient(X + dx, Y + dy, 0, X + dx, Y + dy, r);
        g.addColorStop(0, 'rgba(140,200,80,0.5)'); g.addColorStop(1, 'rgba(110,170,60,0)');
        circle(X + dx, Y + dy, r, g);
      }
      text('HQNO', X, Y + 5, { size: 12, color: '#355a1a', align: 'center', weight: '800' });
    },
  },
  lasa: {
    init(e) { e.w = 28; e.h = 22; e.y = e.ty * TILE + TILE - e.h; e.vx = -1.1; },
    box(e) { return { x: e.x, y: e.y, w: e.w, h: e.h }; },
    update(e, cx, cy, pcx, pcy) {
      // Patrol; charge when the player is close on the same level. Turn at walls, ledges, foam.
      const ex = e.x + e.w / 2, ey = e.y + e.h / 2;
      e.angry = Math.abs(pcy - ey) < 30 && Math.abs(pcx - ex) < 190 && P.inv === 0;
      // it winds up for a moment before it charges (a fair warning)
      if (e.angry && !e.wasAngry) e.windup = 14;
      e.wasAngry = e.angry;
      if (e.windup > 0) {
        e.windup--;
        e.vx = (Math.sign(pcx - ex) || 1) * 0.01;
        enemyContact(e, 'LasA protease cut into your cell wall.');
        return;
      }
      e.vx = e.angry ? (Math.sign(pcx - ex) || 1) * 2.7 : Math.sign(e.vx) * 1.3;
      const nx = e.x + e.vx;
      const front = e.vx < 0 ? nx : nx + e.w;
      const ftx = Math.floor(front / TILE), fty = Math.floor((e.y + e.h - 1) / TILE);
      const ahead = tileAt(ftx, fty), below = tileAt(ftx, fty + 1);
      if (enemySolid(ahead) || ahead === '^' || !(enemySolid(below) || oneWay(below))) e.vx = -e.vx; else e.x = nx;
      enemyContact(e, 'LasA protease cut into your cell wall.');
    },
    // a protease with snapping jaws; glows red when it charges
    draw(e, x, y) {
      const wind = e.windup > 0, X = x + e.w / 2 + (wind ? Math.sin(e.t * 2.5) * 2 : 0), Y = y + e.h / 2 + 1, dir = e.vx < 0 ? -1 : 1, open = Math.abs(Math.sin(e.t * (e.angry ? 0.4 : 0.2))) * 0.5;
      if (wind) {   // crouch and warn before the charge
        roundRect(X - 8, Y - 38, 16, 18, 6, '#fff3e9', '#b23a48', 1.5);
        text('!', X, Y - 24, { size: 14, color: '#b23a48', align: 'center', weight: '900' });
      }
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
    },
  },
  sidero: {
    init(e) { e.hx = e.x + 16; e.hy = e.y + 16; e.cx = e.hx; e.cy = e.hy; e.cool = 0; },
    box(e) { return { x: e.cx - 12, y: e.cy - 12, w: 24, h: 24 }; },
    update(e, cx, cy, pcx, pcy) {
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
        if (!G.seen.sidero) { G.seen.sidero = true; tag('IRON GRABBED · COMPETITION FOR Fe', e.cx, e.cy - 26, '#c8e85a', 160); }
      }
      if (e.cool === 0 && dist(e.cx, e.cy, pcx, pcy) < 26) {
        e.cool = 120;
        if (L.ironBank > 0) { L.ironBank--; toast('A siderophore pulled iron out of your store.', 140); }
        e.cx += (e.cx - pcx) * 1.5; e.cy -= 20;
      }
    },
    // siderophore: a glowing iron-grabbing claw
    draw(e) {
      const X = e.cx, Y = e.cy;
      glow(X, Y, 26, '#c8e85a', 0.45);
      ctx.strokeStyle = '#9cc21e'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
      for (let k = 0; k < 3; k++) { const a = e.t * 0.05 + k * TAU / 3; ctx.beginPath(); ctx.arc(X, Y, 12, a, a + 1.3); ctx.stroke(); }
      ball(X, Y, 5, '#f6ffd0', '#c8e85a', '#6f8f10');
    },
  },
  landmark: {
    draw(e, x, y) {
      ctx.font = `800 14px ${FONT}`;
      const w = ctx.measureText(e.label).width + 30;
      roundRect(x + 16 - w / 2, y + 2, w, 29, 14, 'rgba(14,36,45,0.72)');
      text(e.label, x + 16, y + 22, { size: 14, color: '#effff5', align: 'center', weight: '800' });
    },
  },
  vent: {
    init(e) { e.cool = 20; e.rise = e.rise || 10; },
    // an air stone; bubbles come out of it
    draw(e, x, y) {
      roundRect(x + 5, y + 23, 22, 9, 4, '#8d969c', '#5f676d', 1.2);
      for (let k = 0; k < 4; k++) circle(x + 9 + k * 5, y + 27, 1.1, '#4f565b');
      for (let k = 0; k < 3; k++) { const yy = y + 20 - ((e.t * 0.8 + k * 9) % 26); circle(x + 10 + k * 6 + Math.sin(e.t * 0.1 + k) * 1.5, yy, 1.8, 'rgba(255,255,255,0.75)'); }
    },
  },
  arrow: {
    // a glowing trail of arrows: this way
    draw(e, x, y) {
      const ang = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[e.dir] || 0;
      ctx.save(); ctx.translate(x + 16, y + 16); ctx.rotate(ang);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let k = 0; k < 3; k++) {
        const a = 0.25 + 0.75 * ((k / 3 - e.t * 0.02) % 1 + 1) % 1;
        ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.moveTo(-9 + k * 8, -7); ctx.lineTo(-3 + k * 8, 0); ctx.lineTo(-9 + k * 8, 7); ctx.stroke();
      }
      ctx.restore();
    },
  },
};
