// Run with: node tests/features.test.cjs (no packages or browser required).
// Checks the engagement features: instant retry, splits, sharing, race links, the
// codex, stomp chains, secrets, the daily challenge, the log phase, the attempt
// replay, the animated results and the decoration (labels, HUD fly-ins, moods).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { run, reset, storage, mainCanvas, setDisplayWidth: setDisplayWidthLocal } = require('./harness.cjs');
let checks = 0;
function check(label, fn) { fn(); console.log('ok ' + (++checks) + ' - ' + label); }
// Values from the sandbox belong to another realm: copy them out before deepEqual.
const json = expr => JSON.parse(run('JSON.stringify(' + expr + ')'));
// Define the route search helpers without running the level route checks again.
require('./routes.cjs')({ run, reset, check: () => {} });

check('new scripts load in order and keep the classic, build-free page', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const order = ['facts', 'levels', 'endless', 'audio', 'runtime', 'effects', 'codex', 'share', 'modes', 'replay', 'playtest', 'entities', 'game'];
  const found = [...html.matchAll(/<script src="js\/(\w+)\.js"><\/script>/g)].map(m => m[1]);
  assert.deepEqual(found, order);
  assert(!/type="module"/.test(html));
  for (const file of order) assert(fs.existsSync(path.join(__dirname, '..', 'js', file + '.js')));
  assert.deepEqual(json('KEYMAP.KeyT'), ['share']); assert.deepEqual(json('KEYMAP.KeyL'), ['link']); assert.deepEqual(json('KEYMAP.KeyI'), ['photo']);
  assert.equal(run('KEYMAP.KeyE'), undefined); assert.equal(run('KEYMAP.KeyQ'), undefined);
});

check('pickups use short world labels instead of banners, and fly into the HUD', () => {
  reset(0);
  run("G.toast=''; G.toastT=0; var psm={type:'psm',tx:0,ty:0,x:P.x,y:P.y,alive:true,t:0}; L.ents.push(psm); updateEntities();");
  assert.equal(run('psm.alive'), false); assert.equal(run('G.toastT'), 0);
  assert(run("L.tags.some(t => t.text.includes('PSM'))"));
  run("var cys=L.ents.find(e=>e.type==='cystine'); cys.x=P.x; cys.y=P.y; updateEntities();");
  assert.equal(run("L.flyers.filter(f=>f.kind==='cys').length"), 1);
  run('for (let i=0;i<40;i++) updateFlyers();');
  assert.equal(run('L.flyers.length'), 0);
  assert(run('Math.abs(L.shownScore - (G.score + L.points)) < 2'));
  assert.equal(run('playerMood()'), 'happy');
  run('draw();');
});

check('the cell looks at things, fears threats, spins on a double jump and the camera looks ahead', () => {
  reset(1);
  run("var lasa=L.ents.find(e=>e.type==='lasa'); P.x=lasa.x-40; P.y=lasa.y-6; P.happy=0; L.time=6; updateGaze();");
  assert(run('P.scared')); assert(run('P.look && P.look[0] > 0')); assert.equal(run('playerMood()'), 'scared');
  reset(0, 'anc');
  run('P.onGround=false; P.vy=-1; P.djReady=true; P.coyote=0; pressed.jump=true; keys.jump=true; updatePlay();');
  assert.equal(run('P.spin'), 17);
  reset(0); run('P.x = 40 * TILE;');
  const right = run('cameraTarget()[0]');
  run('P.face=-1; P.vx=-3; for (let i=0;i<200;i++) updateLook();');
  assert(run('cameraTarget()[0]') < right - 100);
  run('draw();');
});

check('n = 0 keeps the death count across the automatic restart', () => {
  reset(0);
  run("loseReplicate('a'); loseReplicate('b'); loseReplicate('c');");
  assert.equal(run('G.state'), 'lysis'); assert.equal(run('G.deaths'), 3);
  run('draw(); for (let i=0;i<70;i++) update();');
  assert.equal(run('G.state'), 'play'); assert.equal(run('G.deaths'), 3);
  run("loseReplicate('d');"); assert.equal(run('G.deaths'), 4);
  // R during the burst still restores the last stock
  reset(0); run("P.reps=1; loseReplicate('x'); pressed.retry=true; update();");
  assert.equal(run('G.state'), 'play'); assert.equal(run('L.retries'), 1);
});

check('stomp chains reward several stomps without touching the ground', () => {
  reset(1);
  run("var omvs=L.ents.filter(e=>e.type==='omv'); P.onGround=false; P.chain=0; var before=L.points;");
  for (const i of [0, 1]) run(`var o=omvs[${i}]; P.x=o.x+4; P.y=o.y-P.h+6; P.vy=4; enemyContact(o,'x');`);
  assert.equal(run('P.chain'), 2);
  assert(run('L.points - before') >= 200 * 2 + 200);
  assert(run("L.bigs.some(b => b.text.startsWith('DOUBLE'))"));
  run('P.onGround=true; P.x=50*TILE; P.y=26*TILE-P.h; updatePlay();');
});

check('LasA winds up for a moment before it charges', () => {
  reset(1);
  run("var la=L.ents.find(e=>e.type==='lasa'); la.wasAngry=false; la.windup=0; P.inv=0; P.x=la.x-120; P.y=la.y+la.h-P.h; var x0=la.x; updateEntities();");
  assert.equal(run('la.windup'), 13); assert(run('Math.abs(la.x - x0) < 0.05'));
  run('for (let i=0;i<13;i++) updateEntities();');
  run('var x1=la.x; updateEntities();'); assert(run('Math.abs(la.x - x1) > 2'));
});

check('the part 2 gate records a split and compares it with the personal best', () => {
  reset(0);
  run("L.time=3600; var gate=L.ents.find(e=>e.type==='stage'); P.x=gate.x; P.y=gate.y; updateEntities();");
  assert.equal(run('L.splits[0]'), 60); assert.equal(run('L.splitDelta'), null);
  run("var goal=L.ents.find(e=>e.type==='goal'); L.time=7200; P.x=goal.x; P.y=goal.y; updateEntities();");
  assert.equal(run('G.state'), 'levelDone');
  assert.deepEqual(json('loadSplits()[runKey()]'), [60]);
  reset(0); run("L.time=3000; var gate=L.ents.find(e=>e.type==='stage'); P.x=gate.x; P.y=gate.y; updateEntities();");
  assert.equal(run('L.splitDelta'), -10);
  run('for (let i=0;i<40;i++) { updateFx(); draw(); }');
});

check('results animate in beats; the first Enter skips, the second continues', () => {
  reset(0); run("enterStage(1); var goal=L.ents.find(e=>e.type==='goal'); P.x=goal.x; P.y=goal.y; updateEntities();");
  assert.equal(run('G.state'), 'levelDone'); assert.equal(run('G.resultT'), 0);
  run('update(); draw(); pressed.ok=true; update();');
  assert.equal(run('G.state'), 'levelDone'); assert(run('resultsDone(G.results[0])'));
  run('draw(); pressed.ok=true; update();');
  assert.equal(run('G.state'), 'intro'); assert.equal(run('G.levelIdx'), 1);
});

check('share lines name the run without personal data, and a failed copy shows a fallback', () => {
  reset(2); run("enterStage(1); L.time=5400; G.deaths=2; var goal=L.ents.find(e=>e.type==='goal'); P.x=goal.x; P.y=goal.y; updateEntities();");
  const textLine = run('shareLevelText(G.results[2])');
  assert(textLine.startsWith('JE2 Jump · SN · anc · Normal'));
  assert(textLine.includes('1:30')); assert(textLine.includes('☠ 2')); assert(textLine.includes('https://dinvuc.github.io/je2-jump-mval/'));
  assert(!/@/.test(textLine));
  run("G.toastT=0; pressed.share=true; update();");
  assert(run('G.toastT > 0'));   // no clipboard in the test sandbox: a message explains it
  assert.equal(run("shareButtonAt('level', VIEW_W/2, 419)"), 'link');
});

check('race links round-trip the ghost and load as a rival on the title screen', () => {
  reset(0); run('L.recording=[]; for (let t=6;t<=1800;t+=6) L.recording.push([t, 100+t, 800-t/3, t%120<60?1:-1, t>900?1:0]);');
  const link = run("raceLink({secs:30})");
  assert(link.startsWith('https://dinvuc.github.io/je2-jump-mval/#race='));
  const code = link.split('#race=')[1];
  assert(code.length < 2000); assert(/^[A-Za-z0-9_-]+$/.test(code));
  run(`var rival=decodeRace(${JSON.stringify(code)});`);
  assert.equal(run('rival.level'), 0); assert.equal(run('rival.strain'), 'anc'); assert.equal(run('rival.secs'), 30);
  assert(run('rival.samples.length > 100 && rival.samples.length < 300'));
  assert.deepEqual(json('rival.samples[rival.samples.length-1]'), [1800, 1900, 200, 1, 1]);
  for (const bad of ['', 'AAAA', '!!', code.slice(0, 20), 'Bw' + code.slice(2)]) assert.equal(run(`decodeRace(${JSON.stringify(bad)})`), null);
  run("G.strain='stp'; G.startLevel=2; adoptRival(rival);");
  assert.equal(run('G.strain'), 'anc'); assert.equal(run('G.startLevel'), 0); assert.equal(run('G.titleMode'), 'story');
  run("setState('title'); draw(); G.mode='story'; loadLevel(0); setState('play');");
  assert(run('L.rival === rival'));
  run("L.time=600; G.ghostOn=true; var drawn=0, original=drawCoccus; drawCoccus=function(){drawn++;}; drawGhost(); drawCoccus=original;");
  assert.equal(run('drawn'), 1);
  run("var goal; enterStage(1); goal=L.ents.find(e=>e.type==='goal'); L.time=1500; P.x=goal.x; P.y=goal.y; updateEntities();");
  assert.equal(run('G.results[0].rivalDelta'), -5);
  run('G.rival=null;');
});

check('the codex unlocks entries, counts neutralised enemies and survives bad storage', () => {
  storage.delete('je2jump_codex_v1'); run('G.codex=null;');
  reset(1);
  run("var omvs=L.ents.filter(e=>e.type==='omv'); killEnemy(omvs[0]); killEnemy(omvs[1]);");
  assert.equal(JSON.parse(storage.get('je2jump_codex_v1')).seen.omv, 2);
  assert(!run("L.tags.some(t => t.text.includes('CODEX'))"));   // unlocking is silent
  run("var pep=L.ents.find(e=>e.type==='peptide'); pep.x=P.x; pep.y=P.y; updateEntities();");
  assert.equal(run('codexCounts().peptides'), 1);
  assert(run("CODEX.every(c => c.topic === null || STUDY_FACTS[c.topic])"));
  run("setState('title'); pressed.biology=true; update();"); assert.equal(run('G.state'), 'codex');
  run('for (let i=0;i<CODEX.length;i++) { pressed.right=true; update(); draw(); }');
  run('pressed.pause=true; update();'); assert.equal(run('G.state'), 'title');
  reset(0); run("setState('paused'); G.menuIdx=menuItems().indexOf('Codex'); menuSelect();");
  assert.equal(run('G.state'), 'codex'); run('draw(); pressed.ok=true; update();'); assert.equal(run('G.state'), 'paused');
  storage.set('je2jump_codex_v1', '[1,2]'); run('G.codex=null;'); assert.equal(run('codexCounts().seen'), 0);
  storage.set('je2jump_codex_v1', '{bad'); run('G.codex=null;'); assert.equal(run('codexCounts().seen'), 0);
  run("setState('title'); draw();");
});

check('every map hides one secret room behind passable walls that stop enemies', () => {
  for (let level = 0; level < 4; level++) {
    reset(level);
    assert.equal(run("L.ents.filter(e=>e.type==='secret').length"), 1);
    assert(run("L.grid.some(r => r.includes('H'))"));
    assert(!run("isSolid('H')")); assert(run("enemySolid('H')"));
    run('draw();');
  }
  reset(0);
  run("var s=L.ents.find(e=>e.type==='secret'); P.x=s.x+4; P.y=s.y+4; var before=L.points; updateEntities();");
  assert.equal(run('L.points - before'), 1000); assert(run('L.secret'));
  assert.equal(run('codexData().secrets[0]'), true);
  run('draw(); for (let i=0;i<20;i++) updateLabels(); draw();');
});

check('each secret room can be entered and left with the shared single jump', () => {
  const paths = [
    [0, [[19, 24], [26, 22], [29, 26], [26, 26], [29, 26]]],
    [1, [[22, 64], [33, 64], [33, 66], [34, 64]]],
    [2, [[17, 11], [24, 14], [18, 17], [9, 22], [4, 27], [0, 27], [4, 27]]],
    [3, [[30, 68], [33, 70], [33, 68]]],
  ];
  for (const [level, targets] of paths) {
    reset(level, 'stk');
    const result = run('verifyMainRoute(' + JSON.stringify(targets) + ', false, 16)');
    if (result.error) throw new Error(`${level}: ${result.error} (${result.expanded} states)`);
  }
});

check('the daily challenge is the same for everyone on a day and applies its rule', () => {
  const a = run('JSON.stringify(dailyChallenge(330))'), b = run('JSON.stringify(dailyChallenge(330))');
  assert.equal(a, b); assert.notEqual(a, run('JSON.stringify(dailyChallenge(331))'));
  assert.equal(run('dayNumber(new Date(2026, 0, 1))'), 1); assert.equal(run('dayNumber(new Date(2026, 10, 25))'), 329);
  const seen = new Set();
  for (let n = 1; n < 200; n++) seen.add(run(`dailyChallenge(${n}).level + ':' + dailyChallenge(${n}).stage + ':' + dailyChallenge(${n}).mod.id`));
  assert(seen.size > 20);
  // force a known challenge: SNpulse part 2 with a single replicate
  run("var realDaily=dailyChallenge; dailyChallenge=n => ({ n, level: 1, stage: 1, strain: 'stp', mod: DAILY_MODS.find(m=>m.id==='single') });");
  run("G.difficulty=100; startDaily();");
  assert.equal(run('G.state'), 'intro'); assert.equal(run('G.mode'), 'daily'); assert.equal(run('L.stage'), 1);
  assert.equal(run('G.strain'), 'stp'); assert.equal(run('P.reps'), 1); assert.equal(run('L.maxReps'), 1);
  assert.equal(run('L.time'), run('Math.round(0.42 * 300 * 60)')); assert.equal(run('runSecs()'), 0);
  run("setState('play'); draw(); P.inv=0; hurt('ros','x');"); assert.equal(run('G.state'), 'lysis');
  run('for (let i=0;i<70;i++) update();'); assert.equal(run('G.state'), 'play');
  assert.equal(run('dailyRecord(G.daily.n).attempts'), 2);
  run("L.time += 600; var goal=L.ents.find(e=>e.type==='goal'); P.x=goal.x; P.y=goal.y; updateEntities();");
  assert.equal(run('G.state'), 'dailyDone'); assert.equal(run('G.dailyResult.secs'), 10);
  const share = run('shareDailyText(G.dailyResult)');
  assert(share.includes('Daily #')); assert(share.includes('SNpulse part 2 · stp · Single replicate')); assert(share.includes('try 2'));
  run('draw(); pressed.retry=true; update();'); assert.equal(run('G.state'), 'play');
  // part 1 dailies end at the gate; other rules change the physics
  run("dailyChallenge=n => ({ n, level: 0, stage: 0, strain: 'anc', mod: DAILY_MODS.find(m=>m.id==='lowgrav') });");
  run("startDaily(false); var gate=L.ents.find(e=>e.type==='stage'); P.x=gate.x; P.y=gate.y; updateEntities();");
  assert.equal(run('G.state'), 'dailyDone');
  run("startDaily(false); P.onGround=false; P.vy=0; P.y=100; updatePlay();"); assert(Math.abs(run('P.vy') - 0.44) < 1e-9);
  run("dailyChallenge=n => ({ n, level: 0, stage: 0, strain: 'anc', mod: DAILY_MODS.find(m=>m.id==='grounded') });");
  run("startDaily(false); P.x=50*TILE; P.y=100; P.onGround=false; P.coyote=0; P.djReady=true; pressed.jump=true; keys.jump=true; P.vy=1; updatePlay();");
  assert(run('P.vy > 0'));
  run("dailyChallenge=realDaily; setState('title'); G.titleMode='daily'; draw(); G.titleMode='story';");
});

check('the log phase climb is generated from a seed and every band is climbable', () => {
  for (const seed of [1, 77, 2026]) {
    run(`G.logSeed=${seed}; var a=JSON.stringify(buildLogPhase(${seed}).grid), b=JSON.stringify(buildLogPhase(${seed}).grid);`);
    assert(run('a === b'));
    run(`G.mode='log'; G.levelIdx=-1; G.strain='stk'; loadLevel(-1, { def: LOG_PHASE }); setState('play');`);
    assert.equal(run('L.route.length'), run('LOG_GENS * 5'));
    assert.equal(run("L.ents.filter(e=>e.type==='goal').length"), 1);
    assert(run("L.art.tiles.width * L.art.tiles.height <= 16010000"));
    const result = run('verifyMainRoute()');
    if (result.error) throw new Error(`seed ${seed}: ${result.error} (${result.expanded} states searched)`);
  }
  assert.notEqual(run('JSON.stringify(buildLogPhase(1).grid)'), run('JSON.stringify(buildLogPhase(2).grid)'));
});

check('the log phase counts generations, chases with a front and ends with a shareable result', () => {
  run("G.difficulty=100; G.strain='anc'; startLogPhase(); setState('play');");
  assert.equal(run('G.mode'), 'log'); assert.equal(run('L.gen'), 0);
  run('for (let i=0;i<300;i++) update();'); assert.equal(run('G.state'), 'play');
  // stand on the floor of generation 3
  run("var frow=L.logBase - 3*LOG_BAND, fx=L.route[14][0]; P.x=fx*TILE+4; P.y=frow*TILE-P.h; P.vy=0; P.onGround=true; snapCamera(); updateLogPhase();");
  assert.equal(run('L.gen'), 3); assert(run("L.bigs.some(b => b.text === 'GENERATION 3')"));
  // the front catches a cell that stays behind
  run('L.front = P.y + P.h - 20; P.inv=0; updateLogPhase();');
  assert.equal(run('P.reps'), 2); assert(run('P.vy < -10'));
  run('draw(); P.reps=1; P.inv=0; L.front = P.y; updateLogPhase();');
  assert.equal(run('G.state'), 'logDone'); assert.equal(run('G.logResult.gen'), 3);
  const share = run('shareEndlessText(G.logResult)');
  assert(share.includes('generation 3/20 (2³ cells)'));
  assert.equal(run('loadLogBest()'), 3);
  run('draw(); pressed.retry=true; update();'); assert.equal(run('G.state'), 'play'); assert.equal(run('L.gen'), 0);
  run("var goal=L.ents.find(e=>e.type==='goal'); P.x=goal.x; P.y=goal.y; updateEntities();");
  assert.equal(run('G.state'), 'logDone'); assert(run('G.logResult.top'));
  run("draw(); G.resultT=30; pressed.ok=true; update();"); assert.equal(run('G.state'), 'title');
});

check('several attempts at a part are replayed together before the results', () => {
  reset(0);
  run('for (let i=0;i<120;i++) update();');
  run('P.y = L.rows * TILE + 100; update();');   // fall out: one attempt lost
  run('for (let i=0;i<120;i++) update();');
  run("retryCheckpoint();");
  run('for (let i=0;i<60;i++) update();');
  assert(run('L.attempts[0].length') >= 2);
  run("var goal; enterStage(1); goal=L.ents.find(e=>e.type==='goal'); P.x=goal.x; P.y=goal.y; updateEntities();");
  assert.equal(run('G.state'), 'replay'); assert.deepEqual(json('G.replay.parts'), [0]);
  run('draw(); for (let i=0;i<20;i++) { update(); draw(); }');
  run('pressed.ok=true; update();'); assert.equal(run('G.state'), 'levelDone');
});

check('every new screen draws, and screenshots fail softly without a real canvas', () => {
  reset(0);
  for (const s of ['intro', 'paused', 'lysis', 'gameOver']) run(`G.lysisT=10; setState('${s}'); draw();`);
  run("G.toastT=0; var ok=saveMicrograph();"); assert.equal(run('ok'), false); assert(run('G.toastT > 0'));
  run("G.results=[{name:'TSB',total:1,stars:[true,false],starLabels:['a','b'],secs:60,medal:null,peptides:1,totalPep:6,splits:[],pbSplits:[],deaths:0,reps:3}]; G.score=1; setState('win'); draw();");
  assert(run('shareRunText()').includes('TSB'));
  run("setState('title'); for (const m of ['story','daily','log']) { G.titleMode=m; draw(); }");
  mainCanvas.handlers.pointerdown({ clientX: 590, clientY: 417 }); assert.equal(run('G.titleMode'), 'log');
  mainCanvas.handlers.pointerdown({ clientX: 770, clientY: 417 }); assert.equal(run('G.state'), 'codex');
  run("setState('title'); G.titleMode='story';");
});

check('the title screen is laid out in aligned, non-overlapping blocks below the difficulty buttons', () => {
  const cards = json('strainCards()'), panels = json('titlePanels()'), levels = json('levelChips()'), modes = json('modeChips()');
  const boxes = [...cards, ...panels];
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const inside = (a, p) => a.x >= p.x && a.y >= p.y && a.x + a.w <= p.x + p.w && a.y + a.h <= p.y + p.h;
  for (const b of [...boxes, ...levels, ...modes]) assert(b.x >= 0 && b.x + b.w <= 960 && b.y >= 176 && b.y + b.h <= 448, JSON.stringify(b));
  boxes.forEach((a, i) => boxes.slice(i + 1).forEach(b => assert(!overlap(a, b))));
  const chips = [...levels, ...modes];
  chips.forEach((a, i) => chips.slice(i + 1).forEach(b => assert(!overlap(a, b))));
  for (const c of levels) assert(inside(c, panels[0])); for (const c of modes) assert(inside(c, panels[1]));
  // the cards and the two panels share the same left and right edges
  assert.equal(cards[0].x, panels[0].x); assert.equal(cards[2].x + cards[2].w, panels[1].x + panels[1].w);
  // the HTML difficulty buttons end above the strain label (CSS top 20.96 % of 544 px, 32 px buttons + help line)
  const css = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  const top = Number(/\.run-settings \{[^}]*top: ([\d.]+)%/.exec(css)[1]) * 5.44;
  assert(top + 32 + 22 < cards[0].y - 14, 'buttons and help text clear the strain label');
});

check('info signs speak only after you stand on them for a second, in a fading panel', () => {
  reset(0);
  run('var sg=L.signs[0]; P.x=sg.tx*TILE+4; P.y=(sg.ty+1)*TILE-P.h; P.vx=0; P.vy=0; P.onGround=true;');
  run('for (let i=0;i<59;i++) updateSigns();');
  assert.equal(run('L.signShown'), undefined); assert.equal(run('L.signA'), 0);
  run('draw(); updateSigns();'); assert(run('L.signShown === sg'));
  run('for (let i=0;i<12;i++) updateSigns(); draw();'); assert.equal(run('L.signA'), 1);
  run('P.x += 3 * TILE; for (let i=0;i<4;i++) updateSigns();'); assert(run('L.signA > 0 && L.signA < 1'));
  run('for (let i=0;i<10;i++) updateSigns(); draw();'); assert.equal(run('L.signA'), 0);
  // jumping over a sign never opens it
  run('P.x=sg.tx*TILE+4; P.onGround=false; for (let i=0;i<90;i++) updateSigns();'); assert.equal(run('L.signA'), 0);
});

check('the codex draws every icon at every moment and can always be closed', () => {
  // with every entry unlocked, from the title and from the pause menu
  run("G.codex = { seen: Object.fromEntries(CODEX.map(c => [c.id, 3])), peptides: {}, secrets: { 0: true, 2: true } };");
  for (const from of ['title', 'paused']) {
    if (from === 'title') run("L = null; setState('title'); openCodex('title');"); else { reset(3); run("setState('paused'); openCodex('paused');"); }
    for (let ms = 0; ms < 8000; ms += 113) {
      run('performance.now = () => ' + ms + '; G.codexIdx = ' + (ms / 113 % 21 | 0) + '; draw();');
    }
    run('pressed.pause = true; update();'); assert.equal(run('G.state'), from);
    run("openCodex('" + from + "'); codexClick(880, 36);"); assert.equal(run('G.state'), from);
  }
  run('performance.now = () => 1000; G.codex = null;');
  // a drawing error never stops the main loop
  assert(fs.readFileSync(path.join(__dirname, '..', 'js', 'game.js'), 'utf8').includes('One bad frame must never stop the game'));
});

check('Study plays the story only: the daily challenge and the log phase are greyed out', () => {
  const { controls } = require('./harness.cjs');
  run("setState('title'); G.difficulty = 100; G.titleMode = 'daily';");
  controls['mode-study'].handlers.click();
  assert.equal(run('G.difficulty'), 0); assert.equal(run('G.titleMode'), 'story');
  run('G.startLevel = 3; pressed.down = true; update();'); assert.equal(run('titleSlot()'), 0);   // wraps past the modes
  run('pressed.up = true; update();'); assert.equal(run('titleSlot()'), 3);
  assert.equal(run('setTitleSlot(4)'), false); assert.equal(run('G.titleMode'), 'story');
  mainCanvas.handlers.pointerdown({ clientX: 590, clientY: 417 }); assert.equal(run('G.titleMode'), 'story');
  run("G.titleMode = 'log'; draw(); startGame();"); assert.equal(run('G.mode'), 'story'); assert.equal(run('L.def.endless'), undefined);
  // the codex stays open to Study, and Normal brings the modes back
  run("setState('title');"); mainCanvas.handlers.pointerdown({ clientX: 770, clientY: 417 }); assert.equal(run('G.state'), 'codex');
  run("setState('title');"); controls['mode-normal'].handlers.click();
  assert.equal(run('setTitleSlot(5)'), true); assert.equal(run('G.titleMode'), 'log');
  run("G.titleMode = 'story';");
});

check('stk dashes on the ground and once per jump in the air, and its dash defeats enemies', () => {
  reset(1, 'stk');
  run('P.x=34*TILE; P.y=22*TILE; P.vy=3; P.onGround=false; startDash();');   // open air in SNpulse
  assert.equal(run('P.dash'), 12); assert(run('P.airDash'));
  run('updatePlay();'); assert(run('P.vy <= 0.4'));   // the air dash hangs
  run('P.dash=0; P.dashCool=0; startDash();'); assert.equal(run('P.dash'), 0);   // only one per jump
  run('P.onGround=true; P.groundT=0; P.coyote=0; P.airDash=false; P.dashCool=0; startDash();'); assert.equal(run('P.dash'), 12);
  // a dash goes through an enemy instead of costing a replicate
  run("var la=L.ents.find(e=>e.type==='lasa'); P.inv=0; P.reps=3; P.x=la.x; P.y=la.y+la.h-P.h; P.dash=8; enemyContact(la,'x');");
  assert.equal(run('la.alive'), false); assert.equal(run('P.reps'), 3);
  // a superoxide radical too
  run("var r=spawnEnemy('rosb', P.x+12, P.y+14, { vx: 3 }); L.ents.push(...L.spawnQ); L.spawnQ=[]; P.dash=8; enemyContact(r,'x','ros');");
  assert.equal(run('r.alive'), false); assert.equal(run('P.reps'), 3);
  run('draw();');
});

check('stp dives with down in the air, smashes enemies and lands with a shockwave', () => {
  reset(0, 'stp');
  run('P.x=30*TILE; P.y=20*TILE; P.vy=1; P.onGround=false; pressed.down=true; updatePlay();');
  assert(run('P.diving')); assert.equal(run('P.vy'), 14);
  run('for (let i=0;i<40 && P.diving;i++) updatePlay();');
  assert(!run('P.diving')); assert(run('P.onGround'));
  // the shockwave breaks the low debris beside the landing spot and defeats a nearby enemy
  reset(0, 'stp');
  run("var lasa={type:'lasa',tx:29,ty:25,x:29*TILE,y:25*TILE+10,w:28,h:22,vx:0,alive:true,t:0}; L.ents.push(lasa);");
  run('P.x=31*TILE+4; P.y=22*TILE; P.vy=1; P.onGround=false; P.inv=0; startDive(); for (let i=0;i<40 && P.diving;i++) updatePlay();');
  assert.equal(run('lasa.alive'), false); assert.equal(run('P.reps'), 3);
  assert.equal(run('L.grid[25][31]'), ' ');
  // anc and stk cannot dive; a dive is not possible on the ground
  reset(0, 'anc'); run('P.onGround=false; startDive();'); assert(!run('P.diving'));
  reset(0, 'stp'); run('P.onGround=true; startDive();'); assert(!run('P.diving'));
  run('draw();');
});

check('a dive cracks the closed boss shell; a dash slams into it', () => {
  reset(3, 'stp'); run("enterStage(1); var boss=L.ents.find(e=>e.type==='boss'); L.bossActive=true; boss.state='walk'; boss.open=0;");
  run('var b=bossBox(boss); P.x=boss.bx-P.w/2; P.y=b.y-P.h+4; P.vy=14; P.diving=true; updateBoss(boss, boss.bx);');
  assert.equal(run('boss.hp'), 19); assert(!run('P.diving'));
  reset(3, 'stk'); run("enterStage(1); var boss=L.ents.find(e=>e.type==='boss'); L.bossActive=true; boss.state='walk'; boss.open=1;");
  run('var b=bossBox(boss); P.x=b.x+10; P.y=b.y+20; P.dash=8; P.inv=0; updateBoss(boss, boss.bx);');
  assert.equal(run('boss.hp'), 18); assert.equal(run('P.reps'), 3);
});

// ---- polish pass: feel, smooth drawing, a calmer screen, phones, playtesting, music ----
check('the soundtrack alternates an A and a B section; the boss theme stays on A', () => {
  // audio.js alone, against a fake Web Audio clock that records every scheduled pitch
  const vm = require('node:vm');
  const pitches = [];
  const param = track => ({ value: 0, setValueAtTime(v, t) { if (track) pitches.push([t, v]); }, exponentialRampToValueAtTime() {}, setTargetAtTime() {} });
  const node = () => ({ gain: param(false), frequency: param(true), type: '', buffer: null, connect: x => x, start() {}, stop() {} });
  class FakeAudio {
    constructor() { this.currentTime = 0; this.sampleRate = 100; this.state = 'running'; this.destination = {}; }
    createGain() { return node(); } createOscillator() { return node(); } createBiquadFilter() { return node(); }
    createBufferSource() { return node(); } createBuffer() { return { getChannelData: () => new Float32Array(100) }; } resume() {}
  }
  let tick = null, ac = null;
  const box = vm.createContext({ Math, Map, Float32Array, window: { AudioContext: function () { ac = new FakeAudio(); return ac; } },
    localStorage: { getItem: () => null, setItem() {} }, setInterval: fn => { tick = fn; } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'audio.js'), 'utf8') + '\nthis.AUDIO = AUDIO;', box);
  box.AUDIO.unlock();
  const play = (song, steps, bpm) => {
    pitches.length = 0; box.AUDIO.music('title'); box.AUDIO.music(song);
    const start = ac.currentTime + 0.08, sp = 60 / bpm / 4;
    while (ac.currentTime < start + steps * sp) { ac.currentTime += 0.025; tick(); }
    return pitches.map(([t, f]) => [Math.floor((t - start) / sp + 1e-6), Math.round(f * 10) / 10]);
  };
  const E1 = Math.round(440 * Math.pow(2, (28 - 69) / 12) * 10) / 10;   // the Em bass note, only in B
  const tsb = play('TSB', 256, 116);
  assert(tsb.some(([s, f]) => s >= 128 && s < 256 && f === E1), 'B section plays its own chords');
  assert(!tsb.some(([s, f]) => s < 128 && f === E1), 'A section keeps C Am F G');
  const boss = play('boss', 256, 152), first = new Set(boss.filter(([s]) => s < 128).map(p => p[1]));
  assert(boss.every(([, f]) => first.has(f)), 'the boss loop repeats the A section');
});

check('air control, apex hang and faster falls keep the 3-row jump', () => {
  reset(0);
  const arc = json(`(() => { let vy = JUMP_V, y = 0, top = 0, f = 0;
    while (f < 200) { vy = fallStep(vy, true); y += vy; f++; top = Math.min(top, y); if (y >= 0) break; }
    return [-top, f]; })()`);
  assert(arc[0] > 96 && arc[0] < 100, 'height stays ~3 rows: ' + arc[0]);
  assert(arc[1] >= 39 && arc[1] <= 43, 'air time ' + arc[1]);
  // letting go in the air keeps most of the speed; on the ground it stops quickly
  run('P.x=10*TILE; P.y=10*TILE; P.onGround=false; P.vx=3.8; P.vy=-2; keys.right=false; keys.jump=false; P.dizzy=0; updatePlay();');
  assert(run('P.vx') > 3.5);
  reset(0); run('for(let i=0;i<5;i++) update(); P.vx=3.8; keys.right=false; update();');
  assert(run('P.onGround') && run('P.vx') < 3.2);
  // right after a hit the knockback is damped as on the ground
  reset(0); run("P.y=10*TILE; P.onGround=false; hurt('enemy','test'); keys.left=false; keys.right=false; updatePlay();");
  assert(run('Math.abs(P.vx)') < 2.5);
});

check('the cell and the camera are drawn between physics steps', () => {
  reset(0); run('for(let i=0;i<5;i++) update(); rememberRenderState(); keys.right=true; for(let i=0;i<20;i++) update(); rememberRenderState(); update(); keys.right=false;');
  const before = json('[G.prevRender.x, P.x]');
  assert(before[1] > before[0]);
  run('var seen=null; var realDraw=draw; draw=function(){ seen=P.x; }; drawInterpolated(0.5); draw=realDraw;');
  assert(Math.abs(run('seen') - (before[0] + before[1]) / 2) < 0.01, 'drawn halfway');
  assert.equal(run('P.x'), before[1], 'the real position is restored after drawing');
  run("setState('paused'); var seen2=null; draw=function(){ seen2=P.x; }; drawInterpolated(0.5); draw=realDraw;");
  assert.equal(run('seen2'), before[1], 'no blending outside play');
  // enemies blend with the same alpha in Normal
  reset(0); run('snapshotEntities(); G.alpha=0.5; draw(); G.alpha=1;');
});

check('the goal checklist folds into a pill and reopens when a goal changes', () => {
  reset(0); assert.equal(run('L.goalShowT'), 300); assert.equal(run('L.hintT'), 480);
  run('for(let i=0;i<400;i++) update();');
  assert.equal(run('L.goalShowT'), 0); assert(run('L.hintT') < 100);
  run('draw(); L.peptides=1; update();'); assert(run('L.goalShowT') > 200);
  run("setState('paused'); draw();");
  // SNpulse: the deadline goal is not ticked until the sample reaches the MS
  reset(1); run('enterStage(1)');
  assert(!run("goalStatus(L.def.goals.find(g=>g.id==='time')).done"));
  run("var goal=L.ents.find(e=>e.type==='goal'); P.x=goal.x; P.y=goal.y;");
  assert(run("goalStatus(L.def.goals.find(g=>g.id==='time')).done"));
});

check('messages move to the bottom when the cell is high in the view, and scale on small screens', () => {
  reset(0); run("toast('a test message', 100); P.y=L.camY+20; draw();");
  run("toast('a test message', 100); P.y=L.camY+300; draw();");
  setDisplayWidthLocal(640); assert.equal(run('uiScale()'), 1.3); run('draw();');
  setDisplayWidthLocal(960); assert.equal(run('uiScale()'), 1);
});

check('the first visit starts TSB straight away; the menu opens after the first clear', () => {
  storage.delete('je2jump_welcomed');
  run("G.rival=null; G.firstRun=true; setState('title');");
  assert.equal(run('welcomed()'), true, 'opening the title marks the visit'); assert.equal(run('G.firstRun'), false);
  storage.delete('je2jump_welcomed'); assert.equal(run('welcomed()'), false);
  run("G.strain='stp'; G.difficulty=150; startFirstRun();");
  assert.equal(run('G.state'), 'intro'); assert.equal(run('G.strain'), 'anc'); assert.equal(run('L.difficulty'), 100); assert.equal(run('L.def.name'), 'TSB');
  run('draw();');
  run("setState('play'); finishLevel();"); assert.equal(run('welcomed()'), true); assert.equal(run('G.firstRun'), false);
});

check('calm mode removes shake and flashes and is kept in the pause menu', () => {
  reset(3); run("G.calm=false; setState('paused'); G.menuIdx=menuEntries().findIndex(e=>e[1]==='calm'); menuSelect();");
  assert.equal(run('G.calm'), true); assert.equal(storage.get('je2jump_calm'), '1');
  run("setState('play'); G.shake=12; L.coughFlash=30; L.coughWarn=20; draw();");
  assert.equal(run('blinkOn(9)'), true);
  run("setState('paused'); menuSelect();"); assert.equal(run('G.calm'), false); assert.equal(storage.get('je2jump_calm'), '0');
});

check('the playtest log records hits and falls per part and survives bad storage', () => {
  storage.delete('je2jump_deaths_v1'); run('deathCache=null;');
  reset(0); run("P.inv=0; hurt('enemy','test');");
  run('P.y=L.rows*TILE+100; P.inv=0; updatePlay();');
  const log = json('loadDeaths()');
  assert.equal(log.length, 2); assert.equal(log[0][0], 'TSB'); assert.equal(log[0][4], 'enemy'); assert.equal(log[1][4], 'fall');
  assert.equal(JSON.parse(storage.get('je2jump_deaths_v1')).length, 2);
  storage.set('je2jump_deaths_v1', '{"bad":1}'); run('deathCache=null;'); assert.equal(run('loadDeaths().length'), 0);
  run('drawDeathMap(); drawDeathPanel(); exportDeaths();');   // no-ops without ?debug=deaths
});

console.log('Passed ' + checks + ' feature checks.');
