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
            if (action.dir) P.vx = clamp(P.vx + action.dir*RUN_ACC,-RUN_MAX,RUN_MAX);
            else P.vx *= FRICTION;
            if (action.hold && f >= action.hold && P.vy < -3.5) P.vy = -3.5;
            P.vy = Math.min(P.vy+GRAV,MAX_FALL);
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
  for (let level=0;level<4;level++) {
    check(['TSB','SNpulse','SN','CF airway'][level]+' main route works with the shared single jump', () => {
      reset(level,'stk');
      const result = run('verifyMainRoute()');
      if(result.error) throw new Error(result.error+' ('+result.expanded+' states searched)');
      if(level===1 && result.frames/60 >= 145) throw new Error('Climbing route exceeds the exposure deadline');
    });
  }
  const exploration = [
    [[19,24],[38,24],[35,22],[38,20],[45,16],[49,14],[54,18],[51,26],[55,26],[60,26],[64,24],[67,22],
      [72,22],[78,20],[75,18],[78,20],[82,18],[84,18]],
    [[39,64],[33,64],[34,62],[30,60],[34,58],[30,56],[25,54],[3,54],[1,52],[5,50],[1,48],[5,46],[9,47],
      [5,46],[1,44],[7,42],[30,42],[32,40],[36,38],[35,36],[31,34],[25,32],[20,30],[5,28],[1,26],[5,24],
      [1,22],[5,20],[9,18],[14,16],[17,14],[21,12],[30,16],[34,14],[37,12]],
    [[9,6],[17,11],[24,14],[18,17],[9,22],[4,27],[30,27],[39,30],[45,33],[40,37],[32,41],[27,44],[28,48],
      [4,48],[28,48],[35,46],[39,44],[44,45],[48,48],[51,48]],
    [[31,66],[36,64],[31,62],[36,60],[31,62],[27,60],[21,58],[3,58],[6,56],[2,54],[6,52],[10,50],[13,48],
      [26,46],[35,44],[30,42],[35,40],[31,38],[27,36],[22,34],[7,34],[2,32],[6,30],[2,28],[6,30],[11,28],
      [6,26],[2,24],[17,22],[32,20],[36,18],[31,16],[34,14],[37,12],[32,6],[18,4]],
  ];
  for (let level=0;level<4;level++) {
    check(['TSB','SNpulse','SN','CF airway'][level]+' peptide detours can be entered and left with a single jump', () => {
      reset(level,'stk');
      const result = run('verifyMainRoute('+JSON.stringify(exploration[level])+',true,16)');
      if(result.error) throw new Error(result.error+' ('+result.expanded+' states searched)');
    });
  }
};
