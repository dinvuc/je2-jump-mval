// Search the actual collision functions using only the shared single jump.
// Hazards and crumbling cells are excluded: this verifies a permanent route,
// independent of strain powers, timed objects, combat and player reaction time.
module.exports = function verifyRoutes({run, reset, check}) {
  run(`
    function findTerrainRoute(from, target, precision = 40) {
      const tx = target[0] * TILE + 16, ty = target[1] * TILE - P.h;
      const reached = p => Math.abs(p.y - ty) < 1 && Math.abs(p.x + p.w / 2 - tx) <= precision;
      const heuristic = p => Math.abs(p.x + p.w/2 - tx) / 3.8 + Math.abs(p.y - ty) / 3;
      const heap = [], visited = new Map();
      function push(n) {
        let i = heap.length; heap.push(n);
        while (i > 0) { const parent = (i - 1) >> 1; if (heap[parent].rank <= n.rank) break; heap[i] = heap[parent]; i = parent; }
        heap[i] = n;
      }
      function pop() {
        const first = heap[0], last = heap.pop();
        if (heap.length) {
          let i = 0;
          while (i * 2 + 1 < heap.length) {
            let child = i * 2 + 1;
            if (child + 1 < heap.length && heap[child+1].rank < heap[child].rank) child++;
            if (last.rank <= heap[child].rank) break;
            heap[i] = heap[child]; i = child;
          }
          heap[i] = last;
        }
        return first;
      }
      const actions = [];
      for (const dir of [-1,1]) for (const frames of [8,24]) actions.push({dir,frames,hold:0});
      for (const dir of [-1,0,1]) for (const hold of [8,12,20]) actions.push({dir,frames:80,hold});
      push({p:from, cost:0, rank:heuristic(from)});
      let expanded = 0;
      while (heap.length && expanded++ < 5000) {
        const node = pop();
        if (reached(node.p)) return {p:node.p,frames:node.cost,expanded};
        for (const action of actions) {
          P = {...node.p, vy:action.hold ? JUMP_V : 0, ride:null, sprung:false, dash:0};
          let airborne = !!action.hold;
          for (let f=0; f<action.frames; f++) {
            // The same run, friction and gravity steps as updatePlay().
            if (action.dir) P.vx = clamp(P.vx + action.dir*RUN_ACC,-RUN_MAX,RUN_MAX);
            else P.vx *= P.onGround ? FRICTION : AIR_FRICTION;
            const holding = action.hold > 0 && f < action.hold;
            if (action.hold && !holding && P.vy < -3.5) P.vy = -3.5;
            P.vy = fallStep(P.vy, holding);
            // Cilia and flow channels carry a grounded cell, as in the game loop.
            if (P.onGround) {
              const under = tileAt(Math.floor((P.x+P.w/2)/TILE), Math.floor((P.y+P.h+1)/TILE));
              const belt = under === '<' ? -1.5 : under === '>' ? 1.5 : 0;
              if (belt) { const v = P.vx; P.vx = belt; moveX(); P.vx = v; }
            }
            moveX(); moveY();
            // Static foam is a hazard: a route may jump over it but never touch it.
            if (inFoam()) break;
            if (!P.onGround) airborne = true;
            if (P.y > L.rows*TILE || P.x < 0 || P.x+P.w > L.cols*TILE) break;
            if (P.onGround && (airborne || f === action.frames-1)) {
              const p = {...P}, cost = node.cost + f + 1;
              const key = Math.round(p.x/8)+':'+Math.round(p.y/4)+':'+Math.sign(p.vx);
              if (!visited.has(key) || cost < visited.get(key)) {
                visited.set(key,cost); push({p,cost,rank:cost+heuristic(p)});
              }
              break;
            }
          }
        }
      }
      return {error:'No permanent route to '+target.join(','),expanded};
    }
    function verifyMainRoute(targets = L.route, allowCrumbling = false, precision = 40) {
      // Remove moving surfaces, and make cracked platforms unavailable.
      L.plats = []; L.solids = [];
      for(let y=0;y<L.rows;y++) for(let x=0;x<L.cols;x++)
        if(!allowCrumbling && L.grid[y][x]==='%') L.lysis.set(y*L.cols+x,{down:999999});
      const saved = {...P}; let state = {...P,onGround:true,vy:0}, frames=0, expanded=0;
      for (const target of targets) {
        const found = findTerrainRoute(state,target,precision);
        if(found.error) return found;
        state=found.p; frames+=found.frames; expanded+=found.expanded;
      }
      P = saved;
      return {frames,expanded};
    }
  `);
  const NAMES = ['TSB','SNpulse','SN','CF airway'];
  const label = (level, stage) => NAMES[level] + ' part ' + (stage + 1);
  // Each part of a map is checked on its own; part 2 is entered through the gate.
  const enter = (level, stage) => { reset(level,'stk'); if (stage) run('enterStage(' + stage + ')'); };
  let pulseFrames = 0;
  for (let level=0;level<4;level++) for (let stage=0;stage<2;stage++) {
    check(label(level, stage)+' main route works with the shared single jump', () => {
      enter(level, stage);
      const result = run('verifyMainRoute()');
      if(result.error) throw new Error(result.error+' ('+result.expanded+' states searched)');
      if(level===1) pulseFrames += result.frames;
      if(level===1 && stage===1 && pulseFrames/60 >= run('LEVELS[1].timeLimit')/2) throw new Error('Climbing route uses over half the exposure deadline');
    });
  }
  const exploration = [
    [[[19,24],[38,24],[35,22],[38,20],[45,16],[49,14],[54,18],[51,26],[55,26],[60,26],[64,24],[67,22],
      [72,22],[78,20],[75,18],[78,20],[82,18],[84,18]],
     [[10,34],[12,32],[16,34],[21,36],[26,34],[31,32],[28,30],[33,28],[38,26],[49,24],[53,22],[49,20],[53,18],
      [49,16],[45,14],[49,16],[53,14],[58,12],[75,12],[78,10],[81,8],[78,6],[81,8]]],
    [[[39,64],[33,64],[34,62],[30,60],[34,58],[30,56],[25,54],[3,54],[1,52],[5,50],[1,48],[5,46],[9,47],
      [5,46],[1,44],[7,42],[30,42],[32,40],[36,38],[35,36],[31,34],[25,32],[20,30],[5,28],[1,26],[5,24],
      [1,22],[5,20],[9,18],[14,16],[17,14],[21,12],[30,16],[34,14],[37,12]],
     [[43,76],[33,76],[38,74],[42,72],[37,70],[33,68],[28,66],[4,66],[6,64],[2,62],[6,60],[2,58],[6,56],[12,54],
      [15,52],[12,50],[15,52],[21,52],[27,54],[40,52],[37,50],[41,48],[37,46],[41,44],[37,42],[32,40],[20,40],
      [16,38],[12,40],[5,40],[2,38],[7,36],[2,34],[7,32],[2,30],[8,28],[38,28],[41,26],[37,24],[41,22],[37,20],
      [41,18],[37,16],[33,14],[31,12],[21,14]]],
    [[[9,6],[17,11],[24,14],[18,17],[9,22],[4,27],[30,27],[39,30],[45,33],[40,37],[32,41],[27,44],[28,48],
      [4,48],[28,48],[35,46],[39,44],[44,45],[48,48],[51,48]],
     [[46,6],[41,8],[35,11],[28,14],[20,17],[14,21],[20,25],[28,25],[33,27],[29,31],[21,31],[14,33],[19,37],
      [31,37],[37,39],[45,37],[39,39],[30,43],[23,46],[24,44],[23,46],[16,49],[11,53],[2,53]]],
    [[[31,66],[36,64],[31,62],[36,60],[31,62],[27,60],[21,58],[3,58],[6,56],[2,54],[6,52],[10,50],[13,48],
      [26,46],[35,44],[30,42],[35,40],[31,38],[27,36],[22,34],[7,34],[2,32],[6,30],[2,28],[6,30],[11,28],
      [6,26],[2,24],[17,22],[32,20],[36,18],[31,16],[34,14],[37,12],[32,6],[18,4]],
     [[30,86],[33,84],[37,82],[32,80],[37,78],[37,82],[32,80],[27,78],[22,76],[3,76],[2,74],[6,72],[2,70],
      [6,68],[2,66],[7,64],[17,64],[20,62],[23,62],[26,64],[31,64],[33,62],[37,60],[33,58],[37,56],[33,54],
      [28,52],[5,52],[2,50],[7,48],[2,46],[7,44],[2,42],[8,40],[29,40],[32,38],[36,36],[31,34],[26,32],[4,32],
      [2,30],[6,28],[11,26],[4,32],[2,30],[6,28],[2,26],[6,24],[2,22],[7,20],[30,20],[32,18],[36,16],[34,14],
      [37,12],[32,6],[18,4]]],
  ];
  for (let level=0;level<4;level++) for (let stage=0;stage<2;stage++) {
    check(label(level, stage)+' peptide detours can be entered and left with a single jump', () => {
      enter(level, stage);
      const result = run('verifyMainRoute('+JSON.stringify(exploration[level][stage])+',true,16)');
      if(result.error) throw new Error(result.error+' ('+result.expanded+' states searched)');
    });
  }
};
