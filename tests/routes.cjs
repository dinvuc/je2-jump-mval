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
            moveX(); moveY();
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
    [[18,24],[16,20],[32,26],[54,18],[57,16],[56,26],[62,26],[69,26],[84,18]],
    [[36,64],[18,54],[25,48],[24,42],[18,30],[31,14],[31,10],[4,14]],
    [[9,6],[20,11],[20,17],[9,22],[4,27],[30,27],[39,30],[33,42],[28,48],[12,48],[45,48],[49,48]],
    [[21,58],[23,62],[21,58],[26,46],[22,34],[10,30],[17,22],[37,12],[32,6],[18,4]],
  ];
  for (let level=0;level<4;level++) {
    check(['TSB','SNpulse','SN','CF airway'][level]+' peptide detours can be entered and left with a single jump', () => {
      reset(level,'stk');
      const result = run('verifyMainRoute('+JSON.stringify(exploration[level])+',true,16)');
      if(result.error) throw new Error(result.error+' ('+result.expanded+' states searched)');
    });
  }
};
