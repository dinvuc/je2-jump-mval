// Run with: node tests/game.test.cjs (no packages or browser required).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { run, reset, storage, events, mainCanvas, setDisplayWidth, controls } = require('./harness.cjs');
let checks = 0;
function check(label, fn) { fn(); console.log('ok ' + (++checks) + ' - ' + label); }
check('high-density canvas preserves logical coordinates', () => {
  assert.equal(mainCanvas.width, 1920); assert.equal(mainCanvas.height, 1088);
  assert.equal(mainCanvas.getContext('2d').transform[0], 2);
});
check('every part of every level starts, updates and draws with every strain', () => {
  for (const strain of ['anc','stk','stp']) for (let level = 0; level < 4; level++) for (const stage of [0,1]) {
    reset(level,strain); if (stage) run('enterStage(1)');
    run('for (let i=0;i<180;i++) { update(); if(i%30===0) draw(); }');
    assert.equal(run('G.state'),'play'); assert(run('Number.isFinite(P.x) && Number.isFinite(P.y)'));
    assert(run('L.art.tiles.width * L.art.tiles.height <= 16010000'));
    run('P.x = (L.cols - 2) * TILE; P.y = 0; snapCamera(); draw();');
  }
});
check('activation routes and controls have been removed from every level', () => {
  for (let level=0;level<4;level++) {
    reset(level);
    assert(!run("L.ents.some(e => ['relay','membrane','gate','phos','shuttle','agrb','agrc','channel'].includes(e.type))"));
    assert.equal(run('L.totalPep'),6); assert.equal(run('L.def.stages.length'),2);
    assert(!run("L.def.goals.some(g => g.req && ['cys','kills','network','gate'].includes(g.id))"));
  }
  assert.equal(run('KEYMAP.KeyE'),undefined); assert.equal(run('KEYMAP.KeyQ'),undefined);
  const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  assert(!html.includes('data-key="pulse"')); assert(html.includes('js/runtime.js'));
});
check('part 1 ends at a gate that saves a stock and carries the run into part 2', () => {
  for (let level=0;level<4;level++) {
    reset(level);
    assert(!run("L.ents.some(e => e.type==='goal' || e.type==='boss')")); assert.equal(run("L.ents.filter(e => e.type==='stage').length"),1);
    run("L.time=900; L.points=1234; L.cystine=4; L.peptides=1; L.kills=2; P.reps=2; P.ammo=7; var gate=L.ents.find(e=>e.type==='stage'); P.x=gate.x; P.y=gate.y; updateEntities();");
    assert.equal(run('G.state'),'play'); assert.equal(run('L.stage'),1);
    assert.equal(run('L.time'),900); assert.equal(run('L.points'),1234); assert.equal(run('L.cystine'),4);
    assert.equal(run('L.peptides'),1); assert.equal(run('L.kills'),2); assert.equal(run('P.reps'),2); assert.equal(run('P.ammo'),7);
    assert(run('P.x === L.respawn.x && P.y === L.respawn.y')); assert(run("!L.ents.some(e => e.type==='stage')"));
    assert.equal(run("L.ents.filter(e => e.type==='goal').length"),1); assert.equal(run('L.bannerT'),200);
    assert.equal(run("L.ents.some(e => e.type==='boss')"), level===3);
    run('P.x += 64; L.time += 60; retryCheckpoint();');
    assert.equal(run('L.stage'),1); assert(run('P.x === L.respawn.x')); assert.equal(run('L.points'),1234);
    run('draw(); for (let i=0;i<220;i++) updateFx(); draw();'); assert.equal(run('L.bannerT'),0);
  }
});
check('TSB and SN exits accept the sample without collecting or unlocking anything', () => {
  for (const level of [0,2]) {
    reset(level); run('enterStage(1)'); assert(!run('goalStatus(L.def.goals[0]).done'));
    run("var goal = L.ents.find(e => e.type === 'goal'); P.x=goal.x; P.y=goal.y; updateEntities();");
    assert.equal(run('G.state'),'levelDone'); assert.equal(run('L.cystine'),0);
  }
});
check('the CF sample still requires defeating the boss, not a cell-kill quota', () => {
  reset(3); run("enterStage(1); var goal=L.ents.find(e => e.type==='goal'); P.x=goal.x; P.y=goal.y; updateEntities();");
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
check('foam geysers hurt only while erupting and drifting foam follows its path', () => {
  reset(2);
  run("var gy=L.ents.find(e=>e.type==='geyser'); gy.phase=0; P.x=gy.x+4; P.y=gy.y+4; P.vx=0; P.inv=0;");
  for (const [t, hurts] of [[40,false],[100,false],[150,true]]) {
    run('P.inv=0; P.reps=3; gy.t=' + t + '; P.x=gy.x+4; P.y=gy.y+4; updateEntities();');
    assert.equal(run('P.reps'), hurts ? 2 : 3, 'geyser at phase ' + t);
  }
  reset(2);
  run("var d=L.ents.find(e=>e.type==='drift'); d.t=-1-d.phase; P.x=0; P.y=0; updateEntities(); var x0=d.cx, y0=d.cy; d.t=d.per/4-1-d.phase; updateEntities();");
  assert(run('Math.abs(d.cy - y0 - d.dy*TILE) < 0.01 && Math.abs(d.cx - x0 - d.dx*TILE) < 0.01'));
  run('P.inv=0; P.reps=3; P.x=d.cx-12; P.y=d.cy-14; d.t--; updateEntities();');
  assert.equal(run('P.reps'),2);
});
check('conveyors carry a grounded cell, and only PASN or CF levels have foam', () => {
  reset(0); run('P.x=50*TILE; P.y=26*TILE-P.h; P.vx=0; P.vy=0; P.onGround=true; for(let i=0;i<20;i++) update();');
  assert(run('P.x < 50*TILE - 20'));
  assert(!run("L.grid.some(r => r.includes('^')) || L.ents.some(e => e.type==='geyser' || e.type==='drift')"));
  for (const level of [1,2,3]) {
    reset(level);
    assert(run("L.grid.some(r => r.includes('^'))")); assert(run("L.grid.some(r => r.includes('<') || r.includes('>'))"));
    assert(run("L.ents.some(e => e.type==='drift')"));
  }
  for (const level of [1,2]) { reset(level); assert(run("L.ents.filter(e => e.type==='geyser').length >= 2")); }
});
check('defeated enemies are named in a stamped callout and a stacking HUD feed', () => {
  reset(1);
  run("var omvs=L.ents.filter(e=>e.type==='omv'); killEnemy(omvs[0]); killEnemy(omvs[1]);");
  assert.equal(run('L.killFeed.length'),1); assert.equal(run('L.killFeed[0].n'),2);
  assert.equal(run('L.killFeed[0].name'),'outer membrane vesicle');
  assert.equal(run('L.callouts.length'),2); assert.equal(run('L.killCount.omv'),2); assert.equal(run('L.kills'),2);
  run("killEnemy(L.ents.find(e=>e.type==='lasa'));");
  assert.equal(run('L.killFeed[0].name'),'LasA protease'); assert.equal(run('L.killFeed.length'),2);
  run('draw(); for(let i=0;i<40;i++) updateFx(); draw(); for(let i=0;i<300;i++) updateFx();');
  assert.equal(run('L.killFeed.length'),0); assert.equal(run('L.callouts.length'),0);
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
check('exposure advances through both parts to the sample and accelerates launchers', () => {
  reset(1); const split = run('L.def.stageShare[0] * L.def.timeLimit * 60');
  run('L.time=' + split + ';');
  assert.equal(run('exposureFrontY()'),run("L.ents.find(e=>e.type==='stage').y"));
  run("var gun=L.ents.find(e=>e.type==='rosgun'); gun.cool=0; P.x=gun.x-100; P.y=gun.y; updateEntities();");
  assert.equal(run('gun.cool'),115);
  run('enterStage(1); L.time=' + split + ';');
  assert.equal(run('exposureFrontY()'),run("L.ents.find(e=>e.type==='start').y + 160"));
  run('L.time=L.def.timeLimit*60;');
  assert.equal(run('exposureFrontY()'),run("L.ents.find(e=>e.type==='goal').y"));
});
check('ghost samples record their map part and only replay in that part', () => {
  reset(1); run('enterStage(1); L.time=12; recordRun();');
  assert.equal(run('L.recording[L.recording.length-1][4]'),1);
  run("L.ghost={v:5,samples:[[0,10,10,1,0],[600,20,20,1,0]]}; L.ghostIndex=0; L.time=300; G.ghostOn=true; var drawn=0; var original=drawCoccus; drawCoccus=function(){drawn++;}; drawGhost();");
  assert.equal(run('drawn'),0);
  run('L.ghost.samples.forEach(s=>s[4]=1); L.ghostIndex=0; drawGhost(); drawCoccus=original;');
  assert.equal(run('drawn'),1);
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
  assert.equal(run('RUN_VERSION'),5);
  reset(0,'stk'); assert.equal(run('loadTimes()[runKey()]'),undefined); assert.equal(run('L.ghost'),null);
  assert.equal(run('medalTargets(L.def)[0]'),146);
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
check('three difficulty buttons select a mode without starting or changing the strain', () => {
  reset(); run("setState('title'); G.strain='anc'; syncDifficultyControl();");
  assert.equal(controls['mode-normal'].attributes['aria-pressed'], 'true');
  assert.equal(controls['run-settings'].hidden, false);
  events.keydown({ code: 'Space', target: controls['mode-study'], preventDefault() { throw new Error('native button key intercepted'); } });
  run('update();'); assert.equal(run('G.strain'), 'anc');
  for (const [id, value] of [['mode-study',0],['mode-hard',150],['mode-normal',100]]) {
    controls[id].handlers.click();
    assert.equal(run('G.difficulty'), value); assert.equal(run('G.state'),'title');
    assert.equal(controls[id].attributes['aria-pressed'], 'true');
    assert.equal(Object.values(controls).filter(c=>c.attributes['aria-pressed']==='true').length,1);
  }
  controls['mode-study'].handlers.click();
  run('startGame();'); assert.equal(run('L.difficulty'), 0);
  assert.equal(controls['run-settings'].hidden, true);
  run("setState('title');"); assert.equal(controls['run-settings'].hidden, false);
});
check('hard runs faster, shortens hit protection and keeps separate records', () => {
  reset(0,'anc',150); run('for(let i=0;i<60;i++) update();');
  assert.equal(run('G.state'),'play'); assert(run('L.time >= 68 && L.time <= 69'));
  run("hurt('ros','test');"); assert.equal(run('P.inv'),45); assert.equal(run('P.reps'),2);
  assert.equal(run('runKey()'),'5:TSB:anc:hard'); assert.equal(run('bestScoreKey()'),'je2jump_v3_best_hard');
  reset(1,'anc',150); assert.equal(run('L.timeLimit'),300);
  assert.equal(run('menuItems().length'),6); run('update(); draw();'); assert.equal(run('G.state'),'play');
});
check('lower difficulty slows the world while normal mode keeps the original cadence', () => {
  for (const difficulty of [0,25,50,75,100]) {
    reset(0,'anc',difficulty);
    run('G.studySeen=Object.fromEntries(Object.keys(STUDY_FACTS).map(k=>[k,true])); for(let i=0;i<60;i++) update();');
    const expected = Math.floor((0.55 + 0.45 * difficulty / 100) * 60 + 1e-8);
    assert(Math.abs(run('L.time') - expected) <= 1);
    assert.equal(run('G.state'),'play');
  }
});
check('station notes open only on request, keep movement live and close on departure', () => {
  reset(0,'anc',0);
  run('for(let i=0;i<120;i++) update();');
  assert.equal(run('G.state'),'play'); assert.equal(controls['study-panel'].hidden,true);
  run('var readingStation=L.studyStations[0]; P.x=readingStation.tx*TILE+4; P.y=readingStation.ty*TILE+4; syncStudyStation();');
  assert.equal(controls['study-controls'].hidden,false); assert.equal(controls['study-panel'].hidden,true);
  controls['study-open'].handlers.click();
  assert.equal(controls['study-panel'].hidden,false); assert.equal(run('G.state'),'play');
  assert.equal(controls['study-title'].textContent,run('STUDY_FACTS.TSB.title'));
  const time=run('L.time'); run('for(let i=0;i<30;i++) update();'); assert(run('L.time')>time);
  controls['study-next'].handlers.click(); assert.equal(controls['study-title'].textContent,run('STUDY_FACTS.strain.title'));
  controls['study-prev'].handlers.click(); assert.equal(controls['study-title'].textContent,run('STUDY_FACTS.TSB.title'));
  controls['study-close'].handlers.click(); assert.equal(controls['study-panel'].hidden,true);
  run('pressed.biology=true; update();'); assert.equal(controls['study-panel'].hidden,false);
  events.keydown({code:'KeyD',target:controls['study-open'],preventDefault(){}});
  run('for(let i=0;i<50;i++) update();');
  assert.equal(controls['study-panel'].hidden,true); assert.equal(controls['study-controls'].hidden,true);
  assert.equal(run('G.state'),'play');
  run('keys.right=false; P.x=readingStation.tx*TILE+4; P.y=readingStation.ty*TILE+4; P.vx=0; syncStudyStation();');
  assert.equal(controls['study-controls'].hidden,false); assert.equal(controls['study-panel'].hidden,true);
  controls['study-open'].handlers.click(); run("setState('paused');"); assert.equal(controls['study-panel'].hidden,true);
  reset(0); run('pressed.biology=true; update();'); assert.equal(controls['study-controls'].hidden,true);
});
check('study assistance protects replicates, extends the pulse and permits free retries at zero', () => {
  reset(1,'anc',50); assert.equal(run('L.timeLimit'),600);
  run("hurt('ros','test');"); assert.equal(run('P.reps'),2); assert.equal(run('P.inv'),180);
  reset(1,'anc',0); run("hurt('ros','test'); loseReplicate('fall'); L.time=20000; updatePlay();");
  assert.equal(run('P.reps'),3); assert.equal(run('L.timeLimit'),0); assert.equal(run('G.state'),'play');
  run('retryCheckpoint();'); assert.equal(run('L.time'),20001);
  assert.equal(run('G.state'),'play'); assert(run('Number.isFinite(exposureFrontY())'));
  reset(1); run("hurt('ros','test');"); assert.equal(run('P.inv'),90);
  assert.equal(run('L.timeLimit'),300);
});
check('stations cover all topics on permanent floors without changing the layouts', () => {
  const topics=new Set();
  for(let level=0;level<4;level++) for(const stage of [0,1]) {
    const enter = stage ? 'enterStage(1);' : '';
    reset(level); run(enter); const terrain=run('JSON.stringify(L.grid)'); assert.equal(run('L.studyStations.length'),0);
    reset(level,'anc',0); run(enter); assert.equal(run('JSON.stringify(L.grid)'),terrain);
    const count=run('L.studyStations.length'); assert(count>=3);
    assert(run("L.studyStations.every(s=>isSolid(tileAt(s.tx,s.ty+1)) || oneWay(tileAt(s.tx,s.ty+1)))"));
    for(let index=0;index<count;index++) {
      run('var station=L.studyStations['+index+']; P.x=station.tx*TILE+4; P.y=station.ty*TILE+4; syncStudyStation();');
      assert.equal(controls['study-panel'].hidden,true);
      controls['study-open'].handlers.click();
      for(const key of run('station.topics')) {
        topics.add(key); assert.equal(controls['study-title'].textContent,run('STUDY_FACTS['+JSON.stringify(key)+'].title'));
        controls['study-next'].handlers.click();
      }
      controls['study-close'].handlers.click(); run('draw();');
    }
  }
  assert.equal(topics.size,run('Object.keys(STUDY_FACTS).length'));
});
check('study records, ghosts and best scores never overwrite normal records', () => {
  reset(); run('L.time=1200; L.recording=[[6,68,804,1],[1200,2700,548,1]]; finishLevel();');
  const normalTime=run('loadTimes()[runKey()]'), normalGhost=storage.get('je2jump_ghost_5:TSB:anc');
  storage.set('je2jump_v3_best','9000');
  reset(0,'anc',0); run('L.time=600; L.recording=[[6,68,804,1],[600,2700,548,1]]; finishLevel(); saveBest(100);');
  assert.equal(run('loadTimes()[runKey()]'),10);
  assert.equal(storage.get('je2jump_v3_best'),'9000');
  assert.equal(storage.get('je2jump_ghost_5:TSB:anc'),normalGhost);
  reset(); assert.equal(run('loadTimes()[runKey()]'),normalTime);
  assert.equal(run('loadGhost().samples[1][0]'),JSON.parse(normalGhost).samples[1][0]);
});
check('malformed storage and a full quota never prevent playing', () => {
  storage.set('je2jump_v3_times','"bad"'); assert.equal(run('Object.keys(loadTimes()).length'),0);
  reset(); storage.set('je2jump_ghost_5:TSB:anc','{"v":5,"samples":[[null,0,0,1]]}');
  assert.equal(run('loadGhost()'),null);
  run('localStorage.setItem=()=>{throw new Error("quota");}; L.time=600; finishLevel();');
  assert.equal(run('G.state'),'levelDone');
});
console.log('Passed '+checks+' game checks.');
