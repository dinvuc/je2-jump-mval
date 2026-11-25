// Run with: node tests/game.test.cjs (no packages or browser required).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { run, reset, storage, events, mainCanvas, setDisplayWidth } = require('./harness.cjs');
let checks = 0;
function check(label, fn) { fn(); console.log('ok ' + (++checks) + ' - ' + label); }
check('high-density canvas preserves logical coordinates', () => {
  assert.equal(mainCanvas.width, 1920); assert.equal(mainCanvas.height, 1088);
  assert.equal(mainCanvas.getContext('2d').transform[0], 2);
});
check('every level starts, updates and draws with every strain', () => {
  for (const strain of ['anc','stk','stp']) for (let level = 0; level < 4; level++) {
    reset(level,strain); run('for (let i=0;i<180;i++) { update(); if(i%30===0) draw(); }');
    assert.equal(run('G.state'),'play'); assert(run('Number.isFinite(P.x) && Number.isFinite(P.y)'));
    assert(run('L.art.tiles.width * L.art.tiles.height <= 16010000'));
    run('P.x = (L.cols - 2) * TILE; P.y = 0; snapCamera(); draw();');
  }
});
check('activation routes and controls have been removed from every level', () => {
  for (let level=0;level<4;level++) {
    reset(level);
    assert(!run("L.ents.some(e => ['relay','membrane','gate','phos','shuttle','agrb','agrc','channel'].includes(e.type))"));
    assert.equal(run('L.totalPep'),3);
    assert(!run("L.def.goals.some(g => g.req && ['cys','kills','network','gate'].includes(g.id))"));
  }
  assert.equal(run('KEYMAP.KeyE'),undefined); assert.equal(run('KEYMAP.KeyQ'),undefined);
  const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  assert(!html.includes('data-key="pulse"')); assert(html.includes('js/runtime.js'));
});
check('TSB and SN exits accept the sample without collecting or unlocking anything', () => {
  for (const level of [0,2]) {
    reset(level); assert(!run('goalStatus(L.def.goals[0]).done'));
    run("var goal = L.ents.find(e => e.type === 'goal'); P.x=goal.x; P.y=goal.y; updateEntities();");
    assert.equal(run('G.state'),'levelDone'); assert.equal(run('L.cystine'),0);
  }
});
check('the CF sample still requires defeating the boss, not a cell-kill quota', () => {
  reset(3); run("var goal=L.ents.find(e => e.type==='goal'); P.x=goal.x; P.y=goal.y; updateEntities();");
  assert.equal(run('G.state'),'play'); run('L.bossDown=true; L.kills=0; updateEntities();');
  assert.equal(run('G.state'),'levelDone');
});
check('stk dash breaks low debris and cannot pass a solid wall', () => {
  reset(0,'stk');
  run("P.onGround=true; P.x=29*TILE; P.y=25*TILE+4; P.face=1; startDash(); for(let i=0;i<12;i++) update();");
  assert.equal(run('L.grid[25][30]'),' ');
  reset(0,'stk'); run('P.onGround=true; P.x=16*TILE; P.y=25*TILE+4; P.face=1; startDash(); for(let i=0;i<12;i++) update();');
  assert(run('P.x + P.w <= 17*TILE'));
  reset(0,'anc'); run('P.onGround=true; startDash();'); assert.equal(run('P.dash'),0);
});
check('stp glide is controlled by jump and expires without granting height', () => {
  reset(0,'stp'); run('P.x=50*TILE; P.y=100; P.vy=8; P.onGround=false; keys.jump=true; P.glide=2; update();');
  assert.equal(run('P.vy'),2.4); assert.equal(run('P.glide'),1);
  run('update(); update();'); assert(run('P.vy > 2.4'));
  reset(0,'anc'); run('P.y=100; P.vy=8; P.onGround=false; keys.jump=true; update();');
  assert(run('P.vy > 8'));
});
check('checkpoint restores terrain, inventory and ride references with a time penalty', () => {
  reset(); run("L.cystine=2; P.ammo=6; L.movers.push({x:200,y:400,dy:-1,alive:true}); P.ride=L.movers[0]; captureCheckpoint(); L.cystine=8; P.ammo=0; L.grid[25][30]=' '; L.time=600; P.reps=0; setState('gameOver'); retryCheckpoint();");
  assert.equal(run('G.state'),'play'); assert.equal(run('L.cystine'),2); assert.equal(run('P.ammo'),6);
  assert.equal(run('P.reps'),3); assert.equal(run('L.time'),780); assert.equal(run('L.grid[25][30]'),'B');
  assert.equal(run('L.retries'),1); assert(!run("goalStatus({id:'reps'}).done"));
  assert(run('P.ride === L.movers[0]'));
});
check('expired exposure-clock retries restart the level', () => {
  reset(1); run('L.time=L.def.timeLimit*60; retryCheckpoint();');
  assert.equal(run('L.time'),0); assert.equal(run('G.state'),'play');
});
check('exposure advances to the sample and accelerates launchers', () => {
  reset(1); run('L.time=L.def.timeLimit*60;');
  assert.equal(run('exposureFrontY()'),run("L.ents.find(e=>e.type==='goal').y"));
  run("const gun=L.ents.find(e=>e.type==='rosgun'); gun.cool=0; P.x=gun.x-100; P.y=gun.y; updateEntities();");
  assert.equal(run("L.ents.find(e=>e.type==='rosgun').cool"),115);
});
check('cough controls give predictable air lift and bracing', () => {
  reset(3); run('P.onGround=false; P.vy=0; P.vx=2; L.coughing=70; keys.jump=false; updateCough();');
  const normal=run('P.vy'); assert.equal(run('P.vx'),2);
  run('P.vy=0; L.coughing=70; keys.jump=true; updateCough();'); assert(run('P.vy')<normal);
  run('P.onGround=true; P.vx=4; keys.down=true; L.coughing=70; updateCough();'); assert.equal(run('P.vx'),3.2);
});
check('records and ghosts use the new layout version and stay strain-specific', () => {
  reset(); run('L.time=600; L.recording=[[6,68,804,1],[600,2700,548,1]]; finishLevel();');
  assert.equal(run('loadTimes()[runKey()]'),10); assert.equal(run('loadGhost().samples.length'),2);
  assert.equal(run('RUN_VERSION'),3);
  reset(0,'stk'); assert.equal(run('loadTimes()[runKey()]'),undefined); assert.equal(run('L.ghost'),null);
  assert.equal(run('medalTargets(L.def)[0]'),62);
  reset(1,'stk'); assert(run('medalTargets(L.def).every(t => t <= L.def.timeLimit)'));
});
check('resizing and scaled pointer input preserve game and menu coordinates', () => {
  reset(); const x=run('P.x'); setDisplayWidth(1200);
  assert.equal(mainCanvas.width,2400); assert.equal(run('P.x'),x); run('draw();');
  setDisplayWidth(480); assert.equal(mainCanvas.width,960); run('draw(); G.state="title";');
  mainCanvas.handlers.pointerdown({clientX:460/2,clientY:414/2}); assert.equal(run('G.startLevel'),1);
  mainCanvas.handlers.pointerdown({clientX:750/2,clientY:280/2});
  assert.equal(run('G.strain'),'stp'); assert.equal(run('G.state'),'intro');
});
require('./routes.cjs')({run,reset,check});
check('malformed storage and a full quota never prevent playing', () => {
  storage.set('je2jump_v3_times','"bad"'); assert.equal(run('Object.keys(loadTimes()).length'),0);
  reset(); storage.set('je2jump_ghost_3:TSB:anc','{"v":3,"samples":[[null,0,0,1]]}');
  assert.equal(run('loadGhost()'),null);
  run('localStorage.setItem=()=>{throw new Error("quota");}; L.time=600; finishLevel();');
  assert.equal(run('G.state'),'levelDone');
});
console.log('Passed '+checks+' game checks.');
