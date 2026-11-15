'use strict';
// Arterial — traffic agents: cost-based pathfinding, lane choice, car following, congestion
(function () {
  const { C, U } = CB;
  const T = C.TILE, W = C.W, N = W * W;
  const Tr = CB.Traffic = {};

  Tr.load = new Float32Array(N);     // smoothed vehicles per tile
  Tr.vehicles = [];
  Tr.queue = [];
  Tr.stats = { active: 0, stuck: 0, flow: 1, trips: 0 };
  Tr.time = 0;
  const pathCache = new Map();
  let cacheVer = -1;

  // ------------------------------------------------------------------
  // A* on the tile grid
  // ------------------------------------------------------------------
  const gS = new Float32Array(N), from_ = new Int32Array(N), seen = new Uint32Array(N), closed = new Uint32Array(N);
  let gen = 1;
  const heap = new U.Heap();
  function astar(src, dst, pass, cost, vmax) {
    if (src === dst) return [src];
    gen++;
    if (gen > 4e9) { gen = 1; seen.fill(0); closed.fill(0); }
    heap.clear();
    const dx0 = U.tx(dst), dy0 = U.ty(dst);
    const hf = i => (Math.abs(U.tx(i) - dx0) + Math.abs(U.ty(i) - dy0)) * T / vmax;
    gS[src] = 0; seen[src] = gen; from_[src] = -1; heap.push(src, hf(src));
    let found = false, it = 0;
    while (heap.size) {
      const cur = heap.pop();
      if (closed[cur] === gen) continue;
      closed[cur] = gen;
      if (cur === dst) { found = true; break; }
      if (++it > 60000) break;
      const x = U.tx(cur), y = U.ty(cur);
      for (let d = 0; d < 4; d++) {
        const nx = x + C.DX[d], ny = y + C.DY[d];
        if (nx < 0 || ny < 0 || nx >= W || ny >= W) continue;
        const nb = ny * W + nx;
        if (closed[nb] === gen || !pass(nb)) continue;
        const ng = gS[cur] + cost(nb, cur);
        if (seen[nb] !== gen || ng < gS[nb]) {
          seen[nb] = gen; gS[nb] = ng; from_[nb] = cur;
          heap.push(nb, ng + hf(nb));
        }
      }
    }
    if (!found) return null;
    const out = [];
    for (let c = dst; c !== -1; c = from_[c]) out.push(c);
    out.reverse();
    return out;
  }
  Tr.astar = astar;

  const roadPass = i => CB.World.road[i] !== 0;
  function roadCost(i, prev) {
    const Wd = CB.World, R = C.ROADS[Wd.road[i]];
    const ratio = Tr.load[i] / R.cap;
    const cong = 1 + 4 * Math.max(0, ratio - 0.35) * Math.max(0, ratio - 0.35);
    let c = T / R.speed * cong;
    // CS2-style pathfinding cost: time + comfort (avoid turns, small streets slightly)
    if (R.lanes === 1) c *= 1.06;
    return c;
  }
  const staticCost = i => T / C.ROADS[CB.World.road[i]].speed;

  Tr.findPath = function (src, dst, isStatic) {
    const Wd = CB.World;
    if (!Wd.road[src] || !Wd.road[dst]) return null;
    if (cacheVer !== Wd.roadVer) { pathCache.clear(); cacheVer = Wd.roadVer; }
    const key = src * N + dst;
    const hit = pathCache.get(key);
    if (hit && (isStatic || Tr.time - hit.t < 25)) return hit.p;
    const p = astar(src, dst, roadPass, isStatic ? staticCost : roadCost, 26);
    if (pathCache.size > 4000) pathCache.clear();
    pathCache.set(key, { p, t: Tr.time });
    return p;
  };
  Tr.findRailPath = function (src, dst) {
    const Wd = CB.World;
    return astar(src, dst, i => Wd.rail[i] !== 0, () => 1, 1);
  };

  // ------------------------------------------------------------------
  // Vehicles
  // ------------------------------------------------------------------
  const LEN = { car: 4.4, suv: 4.8, van: 5.8, truck: 7.4, bus: 10.6, police: 4.4, ambulance: 5.8, fire: 7.4, garbage: 7.4 };
  const dirOf = (dx, dz) => dz < 0 ? 0 : dx > 0 ? 1 : dz > 0 ? 2 : 3;

  function laneOff(rt, lane) { const o = C.ROADS[rt].off; return o[Math.min(lane, o.length - 1)]; }

  function at(v, k) {
    const n = v.path.length;
    if (v.loop) return v.path[((k % n) + n) % n];
    return (k >= 0 && k < n) ? v.path[k] : -1;
  }

  function setupSeg(v) {
    const Wd = CB.World;
    const cur = at(v, v.seg), prev = at(v, v.seg - 1), next = at(v, v.seg + 1), nn = at(v, v.seg + 2);
    v.cur = cur; v.prev = prev; v.next = next;
    const cx = (U.tx(cur) + 0.5) * T, cz = (U.ty(cur) + 0.5) * T;
    let ix = 0, iz = 0, ox = 0, oz = 0;
    if (prev >= 0) { ix = Math.sign(U.tx(cur) - U.tx(prev)); iz = Math.sign(U.ty(cur) - U.ty(prev)); }
    if (next >= 0) { ox = Math.sign(U.tx(next) - U.tx(cur)); oz = Math.sign(U.ty(next) - U.ty(cur)); }
    if (prev < 0 && next < 0) { ix = ox = 1; }
    else if (prev < 0) { ix = ox; iz = oz; }
    else if (next < 0) { ox = ix; oz = iz; }
    v.din = dirOf(ix, iz); v.dout = dirOf(ox, oz);
    const rtC = Wd.road[cur] || 1;
    const rtN = next >= 0 ? (Wd.road[next] || 1) : rtC;
    // lane choice: right turn -> right lane, left turn -> left lane at the next junction
    const lanesN = C.ROADS[rtN].lanes;
    let laneOut = Math.min(v.pref, lanesN - 1);
    if (lanesN > 1 && next >= 0 && nn >= 0) {
      const nx = Math.sign(U.tx(nn) - U.tx(next)), nz = Math.sign(U.ty(nn) - U.ty(next));
      const turn = ox * nz - oz * nx; // >0 right turn (y down)
      if (turn > 0) laneOut = 0; else if (turn < 0) laneOut = lanesN - 1;
    }
    const laneIn = Math.min(v.lane, C.ROADS[rtC].lanes - 1);
    v.laneIn = laneIn; v.laneOut = laneOut;
    const offI = laneOff(rtC, laneIn), offO = laneOff(rtN, laneOut);
    // right-hand vectors
    const rix = -iz, riz = ix, rox = -oz, roz = ox;
    if (prev >= 0) { v.ex = cx - ix * T / 2 + rix * offI; v.ez = cz - iz * T / 2 + riz * offI; }
    else { v.ex = cx + rix * offI; v.ez = cz + riz * offI; }
    if (next >= 0) { v.xx = cx + ox * T / 2 + rox * offO; v.xz = cz + oz * T / 2 + roz * offO; }
    else { v.xx = cx + rix * offO + ix * 2; v.xz = cz + riz * offO + iz * 2; }
    if (ix === ox && iz === oz) { v.cx = (v.ex + v.xx) / 2; v.cz = (v.ez + v.xz) / 2; v.turn = 0; }
    else if (ix === -ox && iz === -oz) { v.cx = cx + ix * T * 0.4; v.cz = cz + iz * T * 0.4; v.turn = 2; }
    else { v.cx = cx + rix * offI + rox * offO; v.cz = cz + riz * offI + roz * offO; v.turn = 1; }
    const a = Math.hypot(v.cx - v.ex, v.cz - v.ez), b = Math.hypot(v.xx - v.cx, v.xz - v.cz), c = Math.hypot(v.xx - v.ex, v.xz - v.ez);
    v.len = Math.max(0.5, (a + b + c) / 2);
    v.vmax = C.ROADS[rtC].speed * C.VEH_SPEED * (v.turn ? 0.55 : 1) * v.drv;
    v.deg = next >= 0 ? Wd.degree(next) : 0;
  }

  Tr._setup = setupSeg;
  function evalPos(v, out) {
    const t = v.t, u = 1 - t;
    out[0] = u * u * v.ex + 2 * u * t * v.cx + t * t * v.xx;
    out[1] = u * u * v.ez + 2 * u * t * v.cz + t * t * v.xz;
    let dx = 2 * u * (v.cx - v.ex) + 2 * t * (v.xx - v.cx);
    let dz = 2 * u * (v.cz - v.ez) + 2 * t * (v.xz - v.cz);
    const l = Math.hypot(dx, dz) || 1;
    out[2] = dx / l; out[3] = dz / l;
  }
  Tr.evalPos = evalPos;

  Tr.spawn = function (o) {
    if (!o.path || o.path.length < 1) return null;
    if (o.kind === 'car' || o.kind === 'suv') { if (Tr.carCount() >= CB.Gfx.settings.cars) return null; }
    const v = {
      kind: o.kind, path: o.path, seg: 0, t: 0, speed: 0, loop: !!o.loop,
      lane: 0, pref: Math.random() < 0.5 ? 0 : 1, drv: 0.88 + Math.random() * 0.24,
      col: o.col || null, purpose: o.purpose || '', data: o.data || null, onArrive: o.onArrive || null,
      L: LEN[o.kind] || 4.5, stuck: 0, wait: 0, dwell: 0, born: Tr.time, x: 0, z: 0, hx: 1, hz: 0, id: ++Tr.nextId,
    };
    setupSeg(v);
    v.t = 0;
    Tr.vehicles.push(v);
    return v;
  };
  Tr.nextId = 0;
  Tr.carCount = function () { let n = 0; for (const v of Tr.vehicles) if (v.kind === 'car' || v.kind === 'suv') n++; return n; };

  // request a trip (pathfinding is budgeted per frame)
  Tr.request = function (spec) { if (Tr.queue.length < 400) Tr.queue.push(spec); else if (spec.onFail) spec.onFail('queue'); };

  // ------------------------------------------------------------------
  // Update
  // ------------------------------------------------------------------
  const head = new Int32Array(N).fill(-1);
  const touched = [];
  const tmp = [0, 0, 0, 0];
  Tr.update = function (dt) {
    Tr.time += dt;
    const Wd = CB.World;
    // process path requests
    let budget = 40;
    while (Tr.queue.length && budget-- > 0) {
      const s = Tr.queue.shift();
      const p = Tr.findPath(s.from, s.to, s.static);
      if (!p) { if (s.onFail) s.onFail('noroute'); continue; }
      const v = Tr.spawn({ kind: s.kind, path: p, col: s.col, purpose: s.purpose, data: s.data, onArrive: s.onArrive });
      if (!v && s.onFail) s.onFail('cap');
    }
    const vs = Tr.vehicles;
    // occupancy lists
    for (const t of touched) head[t] = -1;
    touched.length = 0;
    for (let k = 0; k < vs.length; k++) {
      const v = vs[k];
      v.nx = -1;
      if (head[v.cur] === -1) touched.push(v.cur);
      v.nx = head[v.cur]; head[v.cur] = k;
    }
    // smooth load
    const decay = Math.min(1, dt * 0.6);
    for (const t of touched) { let c = 0; for (let k = head[t]; k !== -1; k = vs[k].nx) c++; Tr.load[t] += (c - Tr.load[t]) * decay; }
    if ((Tr._fade = (Tr._fade || 0) + dt) > 1) {
      Tr._fade = 0;
      for (let i = 0; i < N; i++) if (Tr.load[i] > 0.01 && head[i] === -1) Tr.load[i] *= 0.6; else if (head[i] === -1) Tr.load[i] = 0;
    }
    let flowSum = 0, flowN = 0;
    const done = [];
    for (let k = 0; k < vs.length; k++) {
      const v = vs[k];
      if (v.dwell > 0) { v.dwell -= dt; v.speed = 0; if (v.dwell <= 0 && v.onDwellEnd) v.onDwellEnd(v); evalPos(v, tmp); v.x = tmp[0]; v.z = tmp[1]; continue; }
      // leader search
      let gap = 1e9;
      for (let j = head[v.cur]; j !== -1; j = vs[j].nx) {
        if (j === k) continue; const u = vs[j];
        if (u.din === v.din && u.laneIn === v.laneIn && u.t > v.t) { const g = (u.t - v.t) * v.len - (u.L + v.L) * 0.5; if (g < gap) gap = g; }
      }
      if (v.next >= 0) {
        const rest = (1 - v.t) * v.len;
        let nearNext = 1e9;
        let cnt = 0;
        for (let j = head[v.next]; j !== -1; j = vs[j].nx) {
          const u = vs[j]; cnt++;
          if (u.prev === v.cur && u.laneIn === v.laneOut) { const g = rest + u.t * u.len - (u.L + v.L) * 0.5; if (g < nearNext) nearNext = g; }
        }
        if (nearNext < gap) gap = nearNext;
        // junction yielding: don't enter a busy intersection
        if (v.deg >= 3 && cnt >= (Wd.road[v.next] === 1 ? 2 : 4) && v.wait < 2.5 && nearNext > 1e8) {
          const g = rest - 1.0; if (g < gap) gap = g;
        }
        if (gap > 1e8) {
          const nn = at(v, v.seg + 2);
          if (nn >= 0) for (let j = head[nn]; j !== -1; j = vs[j].nx) {
            const u = vs[j];
            if (u.prev === v.next) { const g = rest + T + u.t * u.len - (u.L + v.L) * 0.5; if (g < gap) gap = g; }
          }
        }
      }
      // bus stop braking
      if (v.stopAt !== undefined && v.stopAt === v.seg && v.t <= 0.64) {
        const g = (0.64 - v.t) * v.len + 1.2; if (g < gap) gap = g;
      }
      const want = Math.min(v.vmax, Math.max(0, gap - 1.2) * 2.6);
      if (want > v.speed) v.speed = Math.min(want, v.speed + 9 * dt); else v.speed = want;
      if (v.speed < 0.4) { v.stuck += dt; v.wait += dt; } else { v.stuck = Math.max(0, v.stuck - dt * 2); v.wait = 0; }
      flowSum += v.speed / Math.max(1, v.vmax); flowN++;
      v.t += v.speed * dt / v.len;
      // bus stop event
      if (v.stopAt !== undefined && v.stopAt === v.seg && v.t >= 0.5 && v.speed < 1.5) {
        v.t = Math.max(v.t, 0.5);
        if (v.onStop) v.onStop(v);
      }
      while (v.t >= 1) {
        const over = (v.t - 1) * v.len;
        if (v.next < 0) { done.push(v); v.t = 1; break; }
        v.seg++;
        if (v.loop) v.seg %= v.path.length;
        v.lane = v.laneOut;
        setupSeg(v);
        v.t = over / v.len;
        if (v.onSeg) v.onSeg(v);
      }
      evalPos(v, tmp);
      v.x = tmp[0]; v.z = tmp[1]; v.hx = tmp[2]; v.hz = tmp[3];
      if (v.stuck > 45 && !v.loop) { v.gaveUp = true; done.push(v); Tr.stats.stuck++; }
      else if (v.stuck > 90 && v.loop) { // rescue stuck buses: hop forward
        v.stuck = 0; v.seg = (v.seg + 1) % v.path.length; setupSeg(v); v.t = 0;
      }
    }
    if (done.length) {
      const set = new Set(done);
      Tr.vehicles = vs.filter(v => !set.has(v));
      for (const v of done) { Tr.stats.trips++; if (v.onArrive) v.onArrive(v, !v.gaveUp); }
    }
    Tr.stats.active = Tr.vehicles.length;
    if (flowN) Tr.stats.flow += (flowSum / flowN - Tr.stats.flow) * Math.min(1, dt * 0.2);
  };

  // remove vehicles whose path now crosses removed roads
  Tr.validate = function () {
    const Wd = CB.World;
    const keep = [];
    for (const v of Tr.vehicles) {
      let ok = true;
      for (let s = 0; s < 3; s++) { const t = at(v, v.seg + s); if (t >= 0 && !Wd.road[t]) { ok = false; break; } }
      if (ok) {
        for (let s = v.seg; s < v.path.length; s++) if (!Wd.road[v.path[s]]) { ok = false; break; }
      }
      if (ok) keep.push(v); else { if (v.loop && v.onBroken) v.onBroken(v); else if (v.onArrive) v.onArrive(v, false); }
    }
    Tr.vehicles = keep;
  };
  Tr.clearAll = function () { Tr.vehicles = []; Tr.queue = []; Tr.load.fill(0); };

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  Tr.render = function () {
    const Wd = CB.World, Mx = CB.Meshes;
    for (const v of Tr.vehicles) {
      const y = Wd.roadH(v.x, v.z);
      const ya = Wd.roadH(v.x + v.hx * 2, v.z + v.hz * 2), yb = Wd.roadH(v.x - v.hx * 2, v.z - v.hz * 2);
      const pitch = Math.atan2(ya - yb, 4);
      Mx.pushVehicle(v.kind, v.x, y + 0.05, v.z, v.hx, v.hz, v.col, pitch);
    }
  };

  Tr.pick = function (x, z, r) {
    let best = null, bd = r * r;
    for (const v of Tr.vehicles) { const d = (v.x - x) ** 2 + (v.z - z) ** 2; if (d < bd) { bd = d; best = v; } }
    return best;
  };
})();
