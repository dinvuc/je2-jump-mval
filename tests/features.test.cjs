// Run with: node tests/features.test.cjs (no packages or browser required).
// Checks the engagement features: instant retry, splits, sharing, race links, the
// codex, stomp chains, secrets, the daily challenge, the log phase, the attempt
// replay, the animated results and the decoration (labels, HUD fly-ins, moods).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { run, reset, storage, mainCanvas } = require('./harness.cjs');
let checks = 0;
function check(label, fn) { fn(); console.log('ok ' + (++checks) + ' - ' + label); }
// Values from the sandbox belong to another realm: copy them out before deepEqual.
const json = expr => JSON.parse(run('JSON.stringify(' + expr + ')'));
// Define the route search helpers without running the level route checks again.
require('./routes.cjs')({ run, reset, check: () => {} });

check('new scripts load in order and keep the classic, build-free page', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const order = ['facts', 'levels', 'endless', 'audio', 'runtime', 'effects', 'codex', 'share', 'modes', 'replay', 'game'];
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
  assert(run("L.tags.some(t => t.text.includes('NEW IN CODEX'))"));
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
  mainCanvas.handlers.pointerdown({ clientX: 650, clientY: 424 }); assert.equal(run('G.titleMode'), 'log');
  mainCanvas.handlers.pointerdown({ clientX: 850, clientY: 424 }); assert.equal(run('G.state'), 'codex');
  run("setState('title'); G.titleMode='story';");
});

console.log('Passed ' + checks + ' feature checks.');
