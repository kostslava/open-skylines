'use strict';
// Open Skylines — traffic: direction-aware pathfinding, lane arrows, signals, cars, cyclists and pedestrians
(function () {
  const { C, U } = CB;
  const T = C.TILE, W = C.W, N = W * W;
  const Tr = CB.Traffic = {};

  Tr.load = new Float32Array(N);     // smoothed vehicles per tile
  Tr.vehicles = [];
  Tr.soft = [];                      // cyclists and pedestrians
  Tr.queue = [];
  Tr.stats = { active: 0, stuck: 0, flow: 1, trips: 0, bikes: 0, peds: 0 };
  Tr.mode = { car: 0, transit: 0, bike: 0, walk: 0 }; // smoothed shares
  Tr.time = 0;
  const pathCache = new Map();
  let cacheVer = -1;

  // ------------------------------------------------------------------
  // A* over (tile, entry-direction) states. Outside junctions the state is always 4;
  // inside a junction cluster it remembers which way the vehicle came in, so lane arrows
  // (allowed turns) can be enforced when it leaves.
  // ------------------------------------------------------------------
  const NS = N * 5;
  const gS = new Float32Array(NS), from_ = new Int32Array(NS), seen = new Uint32Array(NS), closed = new Uint32Array(NS);
  let gen = 1;
  const heap = new U.Heap();
  function search(src, dst, step, vmax) {
    if (src === dst) return [src];
    gen++;
    if (gen > 4e9) { gen = 1; seen.fill(0); closed.fill(0); }
    heap.clear();
    const Wd = CB.World;
    const dx0 = U.tx(dst), dy0 = U.ty(dst);
    const hf = i => (Math.abs(U.tx(i) - dx0) + Math.abs(U.ty(i) - dy0)) * T / vmax;
    const s0 = src * 5 + 4;
    gS[s0] = 0; seen[s0] = gen; from_[s0] = -1; heap.push(s0, hf(src));
    let found = -1, it = 0;
    while (heap.size) {
      const cs = heap.pop();
      if (closed[cs] === gen) continue;
      closed[cs] = gen;
      const cur = (cs / 5) | 0, cd = cs - cur * 5;
      if (cur === dst) { found = cs; break; }
      if (++it > 120000) break;
      for (let d = 0; d < 4; d++) {
        const r = step(cur, cd, d);
        if (r === null) continue;
        const nb = Wd.neighbor(cur, d);
        const ns = nb * 5 + r.s;
        if (closed[ns] === gen) continue;
        const ng = gS[cs] + r.c;
        if (seen[ns] !== gen || ng < gS[ns]) {
          seen[ns] = gen; gS[ns] = ng; from_[ns] = cs;
          heap.push(ns, ng + hf(nb));
        }
      }
    }
    if (found < 0) return null;
    const out = [];
    for (let c = found; c !== -1; c = from_[c]) out.push((c / 5) | 0);
    out.reverse();
    return out;
  }

  const res = { s: 4, c: 0 };
  function carStep(costFn, onlyTram) {
    return function (cur, cd, d) {
      const Wd = CB.World;
      if (!Wd.canDrive(cur, d)) return null;
      const nb = Wd.neighbor(cur, d);
      if (onlyTram && !C.ROADS[Wd.road[nb]].tram) return null;
      const cc = Wd.jcl[cur], nc = Wd.jcl[nb];
      let s = 4, extra = 0;
      if (cc >= 0 && nc === cc) s = cd;                       // still inside the junction
      else if (nc >= 0) {                                     // entering a junction
        s = d;
        const cl = Wd.clusters[nc];
        if (cl.ctrl === 'lights') extra = 4; else if (cl.ctrl === 'stop' || cl.ctrl === 'allstop') extra = 3; else if (cl.ctrl === 'round') extra = 1;
      }
      if (cc >= 0 && nc !== cc && cd < 4) {                   // leaving a junction: check the arrows
        const cl = Wd.clusters[cc];
        const t = Wd.relTurn(cd, d);
        if (!(cl.mask[cd] & t)) return null;
        if (t === 4) extra += 2; else if (t === 8) extra += 6;
      }
      res.s = s; res.c = costFn(nb) + extra;
      return res;
    };
  }
  function roadCost(i) {
    const Wd = CB.World, R = C.ROADS[Wd.road[i]];
    const lanes = Math.max(1, R.fwd);
    const ratio = Tr.load[i] / (R.cap * (R.w === 2 ? 1 : 1));
    const cong = 1 + 4 * Math.max(0, ratio - 0.35) * Math.max(0, ratio - 0.35);
    let c = T / R.speed * cong;
    if (lanes === 1 && R.grp === 'small') c *= 1.06;
    return c;
  }
  const staticCost = i => T / C.ROADS[CB.World.road[i]].speed;
  const stepLive = carStep(roadCost), stepStatic = carStep(staticCost), stepTram = carStep(staticCost, true);

  Tr.findPath = function (src, dst, isStatic) {
    const Wd = CB.World;
    if (!Wd.road[src] || !Wd.road[dst]) return null;
    if (cacheVer !== Wd.roadVer) { pathCache.clear(); cacheVer = Wd.roadVer; }
    const key = 'c' + (src * N + dst);
    const hit = pathCache.get(key);
    if (hit && (isStatic || Tr.time - hit.t < 25)) return hit.p;
    const p = search(src, dst, isStatic ? stepStatic : stepLive, 30);
    if (pathCache.size > 5000) pathCache.clear();
    pathCache.set(key, { p, t: Tr.time });
    return p;
  };
  Tr.findTramPath = function (src, dst) {
    const Wd = CB.World;
    if (!Wd.road[src] || !Wd.road[dst]) return null;
    return search(src, dst, stepTram, 12);
  };

  // cyclists and pedestrians ignore one-ways and lane arrows, use paths, and cyclists prefer safe streets
  function tileBikeScore(i) {
    const Wd = CB.World;
    if (Wd.walkRoad(i)) return C.bikeScore(C.ROADS[Wd.road[i]]);
    let best = 0; for (let q = 0; q < 4; q++) { const k = Wd.pcell[Wd.cellOf(i, q)]; if (k) best = Math.max(best, C.PATHS[k].bike); }
    return best;
  }
  function softStep(bike) {
    return function (cur, cd, d) {
      const Wd = CB.World;
      if (Wd.softPass(cur, d) < 0) return null;
      const nb = Wd.neighbor(cur, d);
      res.s = 4;
      res.c = bike ? T / 5 * (1 + 2.2 * (1 - tileBikeScore(nb))) : T / 1.4;
      return res;
    };
  }
  const stepBike = softStep(true), stepWalk = softStep(false);
  Tr.findSoftPath = function (src, dst, bike) {
    const Wd = CB.World;
    if (!Wd.road[src] || !Wd.road[dst]) return null;
    if (cacheVer !== Wd.roadVer) { pathCache.clear(); cacheVer = Wd.roadVer; }
    const key = (bike ? 'b' : 'w') + (src * N + dst);
    const hit = pathCache.get(key);
    if (hit) return hit.p;
    const p = search(src, dst, bike ? stepBike : stepWalk, bike ? 5 : 1.4);
    if (pathCache.size > 5000) pathCache.clear();
    pathCache.set(key, { p, t: Tr.time });
    return p;
  };
  // how comfortable a bike route is: length-weighted bike score (0..1)
  Tr.bikeSafety = function (path) {
    if (!path || !path.length) return 0;
    let s = 0;
    for (const i of path) s += tileBikeScore(i);
    return s / path.length;
  };
  Tr.findRailPath = function (src, dst) {
    const Wd = CB.World;
    return search(src, dst, (cur, cd, d) => {
      const nb = Wd.neighbor(cur, d);
      if (nb < 0 || !Wd.rail[nb]) return null;
      res.s = 4; res.c = 1; return res;
    }, 1e9);
  };

  // ------------------------------------------------------------------
  // Vehicles
  // ------------------------------------------------------------------
  const LEN = { car: 4.4, suv: 4.8, van: 5.8, truck: 7.4, bus: 10.6, tram: 14, police: 4.4, ambulance: 5.8, fire: 7.4, garbage: 7.4 };
  const dirOf = (dx, dz) => dz < 0 ? 0 : dx > 0 ? 1 : dz > 0 ? 2 : 3;
  const dirBetween = (a, b) => dirOf(U.tx(b) - U.tx(a), U.ty(b) - U.ty(a));

  function at(v, k) {
    const n = v.path.length;
    if (v.loop) return v.path[((k % n) + n) % n];
    return (k >= 0 && k < n) ? v.path[k] : -1;
  }
  // lane offsets at the boundary between tiles a -> b (use the non-junction side so offsets line up)
  function boundaryLanes(a, b, d) {
    const Wd = CB.World;
    const t = (Wd.jcl[b] >= 0 && Wd.jcl[a] < 0) ? a : b;
    return Wd.lanesToward(t, d);
  }
  Tr.boundaryLanes = boundaryLanes;
  // the turn a vehicle will make at the junction it is about to enter (path index k = first tile inside)
  function turnAt(v, k) {
    const Wd = CB.World;
    const first = at(v, k); if (first < 0) return 0;
    const cl = Wd.jcl[first];
    const din = dirBetween(at(v, k - 1), first);
    let j = k;
    while (at(v, j + 1) >= 0 && Wd.jcl[at(v, j + 1)] === cl && j - k < 6) j++;
    const last = at(v, j), out = at(v, j + 1);
    if (out < 0) return 1;
    return Wd.relTurn(din, dirBetween(last, out));
  }

  function setupSeg(v) {
    const Wd = CB.World;
    const cur = at(v, v.seg), prev = at(v, v.seg - 1), next = at(v, v.seg + 1);
    v.cur = cur; v.prev = prev; v.next = next;
    const cx = (U.tx(cur) + 0.5) * T, cz = (U.ty(cur) + 0.5) * T;
    let ix = 0, iz = 0, ox = 0, oz = 0;
    if (prev >= 0) { ix = Math.sign(U.tx(cur) - U.tx(prev)); iz = Math.sign(U.ty(cur) - U.ty(prev)); }
    if (next >= 0) { ox = Math.sign(U.tx(next) - U.tx(cur)); oz = Math.sign(U.ty(next) - U.ty(cur)); }
    if (prev < 0 && next < 0) { ix = ox = 1; }
    else if (prev < 0) { ix = ox; iz = oz; }
    else if (next < 0) { ox = ix; oz = iz; }
    v.din = dirOf(ix, iz); v.dout = dirOf(ox, oz);
    if (Wd.jcl[cur] >= 0 && (prev < 0 || Wd.jcl[prev] !== Wd.jcl[cur])) v.entryDir = prev < 0 ? 4 : v.din;
    // entry lanes
    const lin = prev >= 0 ? boundaryLanes(prev, cur, v.din) : Wd.lanesToward(cur, v.dout);
    const laneIn = Math.min(v.lane, lin.length - 1);
    // exit lanes and lane choice
    let lout, laneOut;
    if (next >= 0) {
      lout = boundaryLanes(cur, next, v.dout);
      const nOut = lout.length;
      const curJ = Wd.jcl[cur], nextJ = Wd.jcl[next], nnT = at(v, v.seg + 2);
      laneOut = Math.min(laneIn, nOut - 1);
      if (nextJ < 0 && nnT >= 0 && Wd.jcl[nnT] >= 0) {
        // next tile is the approach to a junction: pick a lane whose arrows allow our turn
        const cl = Wd.clusters[Wd.jcl[nnT]];
        const masks = cl.cfg.lanes[next * 4 + dirBetween(next, nnT)];
        const turn = turnAt(v, v.seg + 2);
        v.nextTurn = turn;
        if (masks) {
          let best = -1, bd = 99;
          for (let k = 0; k < Math.min(masks.length, nOut); k++) if (masks[k] & turn) { const dd = Math.abs(k - laneIn) + (k === v.pref ? -0.1 : 0); if (dd < bd) { bd = dd; best = k; } }
          if (best >= 0) laneOut = best;
        } else if (nOut > 1) laneOut = turn === 2 ? 0 : turn === 4 ? nOut - 1 : laneOut;
      } else if (curJ >= 0 && nextJ < 0) {
        // leaving a junction: right turns into the right lane, left turns into the left lane
        const t = Wd.relTurn(v.entryDir < 4 ? v.entryDir : v.din, v.dout);
        if (t === 2) laneOut = 0; else if (t === 4) laneOut = nOut - 1; else laneOut = Math.min(v.lane, nOut - 1);
      } else if (curJ < 0 && nextJ < 0 && nOut > 1 && Math.random() < 0.15) laneOut = Math.min(v.pref, nOut - 1);
    } else { lout = lin; laneOut = laneIn; }
    v.laneIn = laneIn; v.laneOut = laneOut;
    const offI = lin[laneIn], offO = lout[laneOut];
    v.lw = (C.ROADS[Wd.road[cur]] || C.ROADS[1]).L.lw;
    const rix = -iz, riz = ix, rox = -oz, roz = ox;
    if (prev >= 0) { v.ex = cx - ix * T / 2 + rix * offI; v.ez = cz - iz * T / 2 + riz * offI; }
    else { v.ex = cx + rix * offI; v.ez = cz + riz * offI; }
    if (next >= 0) { v.xx = cx + ox * T / 2 + rox * offO; v.xz = cz + oz * T / 2 + roz * offO; }
    else { v.xx = cx + rix * offO + ix * 2; v.xz = cz + riz * offO + iz * 2; }
    const cl = Wd.jcl[cur] >= 0 ? Wd.clusters[Wd.jcl[cur]] : null;
    const round = cl && cl.ctrl === 'round' && cl.tiles.length === 1;
    if (ix === ox && iz === oz) {
      v.cx = (v.ex + v.xx) / 2; v.cz = (v.ez + v.xz) / 2; v.turn = 0;
      if (round) { v.cx = cx + rix * 3.4; v.cz = cz + riz * 3.4; v.turn = 1; }
    } else if (ix === -ox && iz === -oz) { v.cx = cx + ix * T * 0.4; v.cz = cz + iz * T * 0.4; v.turn = 2; }
    else {
      v.cx = cx + rix * offI + rox * offO; v.cz = cz + riz * offI + roz * offO; v.turn = 1;
      if (round) { const right = (ox === -riz && oz === rix) || (rox === -ix && roz === -iz); if (!right) { v.cx = cx + (rix + ix) * 2.6; v.cz = cz + (riz + iz) * 2.6; } }
    }
    const a = Math.hypot(v.cx - v.ex, v.cz - v.ez), b = Math.hypot(v.xx - v.cx, v.xz - v.cz), c = Math.hypot(v.xx - v.ex, v.xz - v.ez);
    v.len = Math.max(0.5, (a + b + c) / 2);
    const R = C.ROADS[Wd.road[cur]] || C.ROADS[1];
    v.vmax = (v.kind === 'tram' ? Math.min(R.speed, 13) : R.speed) * C.VEH_SPEED * (v.turn ? 0.55 : 1) * v.drv * (round ? 0.75 : 1);
    v.deg = next >= 0 ? Wd.degree(next) : 0;
    v.jNext = next >= 0 && Wd.jcl[next] >= 0 && Wd.jcl[cur] !== Wd.jcl[next] ? Wd.jcl[next] : -1;
    v.apKey = v.jNext >= 0 ? cur * 4 + v.dout : -1;
    v.stopDone = v.jNext >= 0 ? (v.stopDone === v.jNext ? v.stopDone : -1) : v.stopDone;
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
      entryDir: 4, stopDone: -1, waitStop: 0, lw: 3,
    };
    setupSeg(v);
    v.t = 0;
    Tr.vehicles.push(v);
    return v;
  };
  Tr.nextId = 0;
  let carN = 0;
  Tr.carCount = function () { return carN; };

  // request a trip (pathfinding is budgeted per frame)
  Tr.request = function (spec) { if (Tr.queue.length < 400) Tr.queue.push(spec); else if (spec.onFail) spec.onFail('queue'); };

  // ---------------- cyclists & pedestrians ----------------
  Tr.spawnSoft = function (kind, path, onArrive) {
    if (!path || path.length < 2) return null;
    if (Tr.soft.length >= Math.round(CB.Gfx.settings.cars * 0.7)) return null;
    const a = { kind, path, seg: 0, t: 0, born: Tr.time, onArrive, sp: (kind === 'bike' ? 5.2 : 1.6) * (0.85 + Math.random() * 0.3) * (kind === 'bike' ? 2.2 : 2.8), side: Math.random() < 0.5 ? 1 : -1, x: 0, z: 0, hx: 1, hz: 0, col: null };
    if (kind === 'bike') a.col = U.pick(BIKE_COLS);
    else a.col = U.pick(PED_COLS);
    setupSoft(a);
    Tr.soft.push(a);
    return a;
  };
  let BIKE_COLS = [[1, 1, 1]], PED_COLS = [[1, 1, 1]];
  Tr.setColors = function (b, p) { BIKE_COLS = b; PED_COLS = p; };
  function softOff(a, i, d) {
    const R = C.ROADS[CB.World.road[i]];
    if (!R) return 2;
    if (a.kind === 'ped') return R.L.walkOff * (R.L.pair ? 1 : a.side);
    if (R.bike) return R.L.bikeOff;
    const ln = CB.World.lanesToward(i, d);
    return ln[0] + 0.9;
  }
  const HALF = T / 4; // centre of a half-tile cell from the tile edge
  // point where the agent crosses from tile A into tile B
  function edgePoint(a, A, B, out) {
    const Wd = CB.World;
    const d = dirBetween(A, B), fx = C.DX[d], fz = C.DY[d];
    const bx = (U.tx(A) + 0.5) * T + fx * T / 2, bz = (U.ty(A) + 0.5) * T + fz * T / 2;
    const rA = Wd.walkRoad(A), rB = Wd.walkRoad(B);
    if (rA && rB) { const o = softOff(a, B, d); out[0] = bx - fz * o; out[1] = bz + fx * o; return; }
    // through a path cell on the shared edge: prefer a row with path on both sides
    let best = null, bs = -1;
    const cells = Wd.edgeCells(A, d);
    for (let k = 0; k < 2; k++) {
      const [ca, cb] = cells[k];
      const pa = Wd.pcell[ca], pb = Wd.pcell[cb];
      if (!((pa || rA) && (pb || rB))) continue;
      const sc = (pa ? 1 : 0) + (pb ? 1 : 0);
      if (sc > bs) { bs = sc; best = k; }
    }
    if (best === null) best = 0;
    const lat = (best === 0 ? -1 : 1) * HALF; // row 0 = the lower x / lower z cell
    if (fx !== 0) { out[0] = bx; out[1] = (U.ty(A) + 0.5) * T + lat; }
    else { out[0] = (U.tx(A) + 0.5) * T + lat; out[1] = bz; }
  }
  function tilePoint(a, i, d, out) {
    const Wd = CB.World;
    const cx = (U.tx(i) + 0.5) * T, cz = (U.ty(i) + 0.5) * T;
    if (Wd.walkRoad(i)) { const o = softOff(a, i, d); out[0] = cx - C.DY[d] * o; out[1] = cz + C.DX[d] * o; return; }
    for (let q = 0; q < 4; q++) if (Wd.pcell[Wd.cellOf(i, q)]) { out[0] = cx + ((q & 1) ? HALF : -HALF); out[1] = cz + ((q >> 1) ? HALF : -HALF); return; }
    out[0] = cx; out[1] = cz;
  }
  const ep = [0, 0];
  function setupSoft(a) {
    const n = a.path.length, cur = a.path[a.seg], prev = a.seg > 0 ? a.path[a.seg - 1] : -1, next = a.seg + 1 < n ? a.path[a.seg + 1] : -1;
    const din = prev >= 0 ? dirBetween(prev, cur) : (next >= 0 ? dirBetween(cur, next) : 1);
    const dout = next >= 0 ? dirBetween(cur, next) : din;
    if (prev >= 0) edgePoint(a, prev, cur, ep); else tilePoint(a, cur, dout, ep);
    a.ex = ep[0]; a.ez = ep[1];
    if (next >= 0) edgePoint(a, cur, next, ep); else tilePoint(a, cur, din, ep);
    a.xx = ep[0]; a.xz = ep[1];
    if (din === dout || din === (dout + 2) % 4) { a.cx = (a.ex + a.xx) / 2; a.cz = (a.ez + a.xz) / 2; }
    else if (din % 2 === 1) { a.cx = a.xx; a.cz = a.ez; }   // came in moving east/west, leaves north/south
    else { a.cx = a.ex; a.cz = a.xz; }
    a.len = Math.max(0.5, Math.hypot(a.cx - a.ex, a.cz - a.ez) + Math.hypot(a.xx - a.cx, a.xz - a.cz));
  }

  // ------------------------------------------------------------------
  // Update
  // ------------------------------------------------------------------
  const head = new Int32Array(N).fill(-1);
  const touched = [];
  const tmp = [0, 0, 0, 0];
  const G = 12, Y = 2.6, AR = 1.2;
  function updateSignals(dt) {
    const Wd = CB.World;
    for (const cl of Wd.clusters) {
      if (cl.ctrl !== 'lights') continue;
      if (!cl.wait) cl.wait = [0, 0];
      cl.pt += dt;
      const ph = cl.phase;
      if (ph === 0 || ph === 3) {
        const ax = ph === 0 ? 0 : 1, other = 1 - ax;
        const gmax = (cl.cfg.green && cl.cfg.green[ax]) || G;
        const done = cl.pt > gmax * 1.6 || (cl.pt > gmax && cl.wait[other] > 0) || (cl.pt > 5 && cl.wait[ax] === 0 && cl.wait[other] > 0);
        if (done) { cl.phase++; cl.pt = 0; }
      } else if (ph === 1 || ph === 4) { if (cl.pt > Y) { cl.phase++; cl.pt = 0; } }
      else if (cl.pt > AR) { cl.phase = (ph + 1) % 6; cl.pt = 0; }
      cl.waitNext = cl.wait; cl.wait = [0, 0];
    }
  }
  Tr.signalState = function (cl, d) { // 0 red, 1 yellow, 2 green for traffic entering in direction d
    const ax = d % 2, ph = cl.phase;
    if (ph === (ax === 0 ? 0 : 3)) return 2;
    if (ph === (ax === 0 ? 1 : 4)) return 1;
    return 0;
  };
  function clusterCount(cl) {
    let c = 0;
    for (const t of cl.tiles) for (let k = head[t]; k !== -1; k = Tr.vehicles[k].nx) c++;
    return c;
  }
  function isStopFor(cl, key) {
    if (cl.ctrl === 'allstop') return true;
    if (cl.ctrl !== 'stop') return false;
    const s = cl.cfg.stops[key];
    if (s !== undefined) return s;
    // default: the smaller road stops
    let min = 9, max = 0;
    for (const ap of cl.aps) { const r = C.GRP_RANK[C.ROADS[CB.World.road[ap.tile]].grp]; min = Math.min(min, r); max = Math.max(max, r); }
    const mine = C.GRP_RANK[C.ROADS[CB.World.road[(key / 4) | 0]].grp];
    return min === max ? true : mine === min;
  }
  Tr.isStopFor = isStopFor;

  let occ = null;
  function spawnBusy(tile) {
    if (!occ) { occ = new Map(); for (const v of Tr.vehicles) { const o = occ.get(v.cur) || 0; occ.set(v.cur, o + (v.t < 0.45 ? 10 : 1)); } }
    return (occ.get(tile) || 0) >= 3;
  }
  Tr.update = function (dt) {
    Tr.time += dt;
    const Wd = CB.World;
    let budget = 40;
    const blocked = new Set(); occ = null;
    while (Tr.queue.length && budget-- > 0) {
      const s = Tr.queue.shift();
      // don't stack spawns: wait until the first stretch of the start tile is clear
      if (blocked.has(s.from) || spawnBusy(s.from)) {
        blocked.add(s.from);
        s.tries = (s.tries || 0) + 1;
        if (s.tries < 400) Tr.queue.push(s); else if (s.onFail) s.onFail('cap');
        continue;
      }
      const p = Tr.findPath(s.from, s.to, s.static);
      if (!p) { if (s.onFail) s.onFail('noroute'); continue; }
      const v = Tr.spawn({ kind: s.kind, path: p, col: s.col, purpose: s.purpose, data: s.data, onArrive: s.onArrive });
      if (v && occ) occ.set(v.cur, (occ.get(v.cur) || 0) + 10);
      if (!v && s.onFail) s.onFail('cap');
    }
    updateSignals(dt);
    const vs = Tr.vehicles;
    for (const t of touched) head[t] = -1;
    touched.length = 0;
    carN = 0;
    for (let k = 0; k < vs.length; k++) {
      const v = vs[k];
      if (v.kind === 'car' || v.kind === 'suv') carN++;
      if (head[v.cur] === -1) touched.push(v.cur);
      v.nx = head[v.cur]; head[v.cur] = k;
    }
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
      let gap = 1e9;
      for (let j = head[v.cur]; j !== -1; j = vs[j].nx) {
        if (j === k) continue; const u = vs[j];
        if (u.din === v.din && u.laneIn === v.laneIn && u.t > v.t) { const g = (u.t - v.t) * v.len - (u.L + v.L) * 0.5; if (g < gap) gap = g; }
      }
      const rest = (1 - v.t) * v.len;
      if (v.next >= 0) {
        let nearNext = 1e9, cnt = 0;
        for (let j = head[v.next]; j !== -1; j = vs[j].nx) {
          const u = vs[j]; cnt++;
          if (u.prev === v.cur && u.laneIn === v.laneOut) { const g = rest + u.t * u.len - (u.L + v.L) * 0.5; if (g < nearNext) nearNext = g; }
        }
        if (nearNext < gap) gap = nearNext;
        // junction control
        if (v.jNext >= 0) {
          const cl = Wd.clusters[v.jNext];
          let hold = false;
          if (cl && cl.ctrl === 'lights') {
            const st = Tr.signalState(cl, v.dout);
            if (st === 0 || (st === 1 && rest > 3.5 + v.speed * 0.4)) hold = true;
            if (hold && v.speed < 2 && cl.wait) cl.wait[v.dout % 2]++;
          } else if (cl && (cl.ctrl === 'stop' || cl.ctrl === 'allstop') && isStopFor(cl, v.apKey)) {
            if (v.stopDone !== v.jNext) {
              hold = true;
              if (rest < 2.2 && v.speed < 0.6) { v.waitStop += dt; if (v.waitStop > 0.8 && (clusterCount(cl) === 0 || v.waitStop > 6)) { v.stopDone = v.jNext; v.waitStop = 0; hold = false; } }
            }
          } else if (cl) {
            const lim = cl.ctrl === 'round' ? cl.tiles.length * 2 : (Wd.road[v.next] && C.ROADS[Wd.road[v.next]].grp === 'small' ? 2 : 4) * Math.max(1, cl.tiles.length / 2);
            if (clusterCount(cl) >= lim && v.wait < 2.5 && nearNext > 1e8) hold = true;
          }
          if (hold) { const g = rest - 0.9; if (g < gap) gap = g; }
        } else if (v.deg >= 3 && cnt >= 4 && v.wait < 2.5 && nearNext > 1e8) { const g = rest - 1.0; if (g < gap) gap = g; }
        if (gap > 1e8) {
          const nn = at(v, v.seg + 2);
          if (nn >= 0) for (let j = head[nn]; j !== -1; j = vs[j].nx) {
            const u = vs[j];
            if (u.prev === v.next) { const g = rest + T + u.t * u.len - (u.L + v.L) * 0.5; if (g < gap) gap = g; }
          }
        }
      }
      if (v.stopAt !== undefined && v.stopAt === v.seg && v.t <= 0.64) {
        const g = (0.64 - v.t) * v.len + 1.2; if (g < gap) gap = g;
      }
      const want = Math.min(v.vmax, Math.max(0, gap - 1.2) * 2.6);
      if (want > v.speed) v.speed = Math.min(want, v.speed + 9 * dt); else v.speed = want;
      if (v.speed < 0.4) { v.stuck += dt; v.wait += dt; } else { v.stuck = Math.max(0, v.stuck - dt * 2); v.wait = 0; }
      flowSum += v.speed / Math.max(1, v.vmax); flowN++;
      v.t += v.speed * dt / v.len;
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
      if (v.stuck > 60 && !v.loop) { v.gaveUp = true; done.push(v); Tr.stats.stuck++; }
      else if (v.stuck > 90 && v.loop) { v.stuck = 0; v.seg = (v.seg + 1) % v.path.length; setupSeg(v); v.t = 0; }
    }
    if (done.length) {
      const set = new Set(done);
      Tr.vehicles = vs.filter(v => !set.has(v));
      for (const v of done) { Tr.stats.trips++; if (v.onArrive) v.onArrive(v, !v.gaveUp); }
    }
    // cyclists & pedestrians: simple, no collisions
    const sdone = [];
    let nb = 0, np = 0;
    for (const a of Tr.soft) {
      if (a.kind === 'bike') nb++; else np++;
      a.t += a.sp * dt / a.len;
      while (a.t >= 1) {
        const over = (a.t - 1) * a.len;
        if (a.seg + 1 >= a.path.length) { sdone.push(a); a.t = 1; break; }
        a.seg++;
        if (!Wd.road[a.path[a.seg]] && !Wd.pmask[a.path[a.seg]]) { sdone.push(a); break; }
        setupSoft(a); a.t = over / a.len;
      }
      evalPos(a, tmp);
      a.x = tmp[0]; a.z = tmp[1]; a.hx = tmp[2]; a.hz = tmp[3];
    }
    if (sdone.length) {
      const set = new Set(sdone);
      Tr.soft = Tr.soft.filter(a => !set.has(a));
      for (const a of sdone) if (a.onArrive) a.onArrive(Tr.time - a.born, true);
    }
    Tr.stats.bikes = nb; Tr.stats.peds = np;
    Tr.stats.active = Tr.vehicles.length;
    if (flowN) Tr.stats.flow += (flowSum / flowN - Tr.stats.flow) * Math.min(1, dt * 0.2);
  };

  // remove vehicles whose path now crosses removed roads
  Tr.validate = function () {
    const Wd = CB.World;
    const keep = [];
    for (const v of Tr.vehicles) {
      let ok = true;
      const from = v.loop ? 0 : v.seg;
      for (let s = from; s < v.path.length; s++) if (!Wd.road[v.path[s]]) { ok = false; break; }
      if (ok) { keep.push(v); try { const t = v.t; setupSeg(v); v.t = t; } catch (e) { /* ignore */ } }
      else { if (v.loop && v.onBroken) v.onBroken(v); else if (v.onArrive) v.onArrive(v, false); }
    }
    Tr.vehicles = keep;
    Tr.soft = Tr.soft.filter(a => { for (let s = a.seg; s < a.path.length; s++) if (!Wd.road[a.path[s]] && !Wd.pmask[a.path[s]]) return false; return true; });
  };
  Tr.clearAll = function () { Tr.vehicles = []; Tr.soft = []; Tr.queue = []; Tr.load.fill(0); };

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  Tr.render = function () {
    const Wd = CB.World, Mx = CB.Meshes;
    for (const v of Tr.vehicles) {
      const y = Wd.roadH(v.x, v.z);
      const ya = Wd.roadH(v.x + v.hx * 2, v.z + v.hz * 2), yb = Wd.roadH(v.x - v.hx * 2, v.z - v.hz * 2);
      const pitch = Math.atan2(ya - yb, 4);
      const ws = U.clamp(v.lw / 2.7, 0.78, 1);
      Mx.pushVehicle(v.kind, v.x, y + 0.05, v.z, v.hx, v.hz, v.col, pitch, ws);
    }
    for (const a of Tr.soft) {
      const y = Wd.roadH(a.x, a.z) + 0.2;
      const step = ((a.seg * T + a.t * a.len) / (a.kind === 'ped' ? 0.55 : 0.9)) | 0;
      Mx.pushVehicle(step % 2 ? a.kind + '2' : a.kind, a.x, y, a.z, a.hx, a.hz, a.col, 0, 1);
    }
    // traffic light heads
    for (const cl of Wd.clusters) {
      if (cl.ctrl !== 'lights') continue;
      for (const ap of cl.aps) {
        const st = Tr.signalState(cl, ap.d);
        const p = CB.Meshes.signalLampPos(ap);
        Mx.pushSignal(p[0], p[1], p[2], st);
      }
    }
  };

  Tr.pick = function (x, z, r) {
    let best = null, bd = r * r;
    for (const v of Tr.vehicles) { const d = (v.x - x) ** 2 + (v.z - z) ** 2; if (d < bd) { bd = d; best = v; } }
    return best;
  };
})();
