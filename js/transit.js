'use strict';
// Open Skylines — public transport: stops, bus & rail lines, passenger routing, trains
(function () {
  const { C, U } = CB;
  const T = C.TILE;
  const X = CB.Transit = {
    stops: [], lines: [], trains: [], nextStop: 1, nextLine: 1, dirty: true,
    COLORS: ['#e8443a', '#2f86e0', '#2fb35a', '#f2a31b', '#9b4fd8', '#16b5b0', '#e0569b', '#8a6a3a', '#5b6bd8', '#c8c43a'],
    WALK_V: 6, stats: { riders: 0, waiting: 0 },
  };
  const byId = new Map();
  X.stopById = id => byId.get(id);
  X.lineById = id => X.lines.find(l => l.id === id);

  // ---------------- stops ----------------
  X.stopAtTile = function (tile, type) { return X.stops.find(s => s.tile === tile && (!type || s.type === type)); };
  X.canPlaceStop = function (type, tile) {
    const Wd = CB.World;
    if (X.stopAtTile(tile, type)) return 'A stop already exists here';
    if (type === 'bus') { const R = C.ROADS[Wd.road[tile]]; if (!R || !R.car) return 'Bus stops go on roads'; if (R.grp === 'highway') return 'Buses cannot stop on highways'; }
    else if (type === 'tram') { const R = C.ROADS[Wd.road[tile]]; if (!R || !R.tram) return 'Streetcar stops go on roads with tram tracks'; }
    else if (!Wd.rail[tile]) return 'Stations go on rail track';
    return null;
  };
  X.addStop = function (type, tile, name) {
    const s = { id: X.nextStop++, type, tile, name: name || nameFor(type), waiting: [], color: null };
    X.stops.push(s); byId.set(s.id, s);
    CB.Meshes.markInfra(tile);
    X.dirty = true;
    return s;
  };
  const STREETS = ['Maple', 'Harbour', 'Station', 'Elm', 'Union', 'King', 'Queen', 'Mill', 'Bridge', 'Park', 'Market', 'Victoria', 'Cedar', 'Lake', 'Spring', 'Ridge', 'Granite', 'Willow', 'Beacon', 'Orchard', 'Pine', 'Front', 'Church', 'College', 'Dundas', 'Bay', 'Albion', 'Linden'];
  function nameFor(type) {
    const n = STREETS[(X.nextStop * 7) % STREETS.length];
    return type === 'bus' ? n + ' St' : type === 'tram' ? n + ' Stop' : n + ' Station';
  }
  X.removeStop = function (s) {
    X.stops = X.stops.filter(q => q !== s); byId.delete(s.id);
    for (const l of X.lines.slice()) {
      if (l.stops.includes(s.id)) {
        l.stops = l.stops.filter(id => id !== s.id);
        if (l.stops.length < 2) X.deleteLine(l); else X.buildLine(l);
      }
    }
    CB.Meshes.markInfra(s.tile);
    X.dirty = true;
  };

  // ---------------- lines ----------------
  X.createLine = function (type, stopIds) {
    const n = X.lines.filter(l => l.type === type).length + 1;
    const color = X.COLORS[(X.nextLine - 1) % X.COLORS.length];
    const l = { id: X.nextLine++, type, name: ({ bus: 'Bus ', tram: 'Streetcar ', rail: 'Metro ' })[type] + n, color, stops: stopIds.slice(), vehicles: type === 'rail' ? 1 : 2, ridersMonth: 0, ridersLast: 0, broken: false };
    X.lines.push(l);
    X.buildLine(l);
    for (const id of l.stops) { const s = byId.get(id); if (s && !s.color) { s.color = color; CB.Meshes.markInfra(s.tile); } }
    X.dirty = true;
    return l;
  };
  X.deleteLine = function (l) {
    removeVehicles(l);
    if (l.ribbon) { CB.Meshes.lineGroup.remove(l.ribbon); l.ribbon.geometry.dispose(); }
    X.lines = X.lines.filter(q => q !== l);
    for (const s of X.stops) s.waiting = s.waiting.filter(p => !p.legs.some(g => g.line === l.id));
    X.dirty = true;
  };
  X.setVehicles = function (l, n) { l.vehicles = U.clamp(n, 1, l.type === 'rail' ? 8 : 12); spawnVehicles(l); X.dirty = true; };

  function segPath(type, a, b) {
    return type === 'bus' ? CB.Traffic.findPath(a, b, true) : type === 'tram' ? CB.Traffic.findTramPath(a, b) : CB.Traffic.findRailPath(a, b);
  }
  X.segPath = segPath;
  X.isRoadLine = type => type === 'bus' || type === 'tram';
  X.buildLine = function (l) {
    const tiles = l.stops.map(id => byId.get(id).tile);
    const path = [], sidx = [];
    l.broken = false;
    for (let k = 0; k < tiles.length; k++) {
      const a = tiles[k], b = tiles[(k + 1) % tiles.length];
      const p = segPath(l.type, a, b);
      if (!p) { l.broken = true; break; }
      sidx.push(path.length);
      const s = p.slice(0, p.length - 1); // drop b (it starts the next segment)
      if (!s.length) s.push(a);
      path.push(...s);
    }
    if (l.broken) { removeVehicles(l); l.path = null; drawRibbon(l); return false; }
    l.path = path; l.sidx = sidx;
    l.length = path.length * T;
    const sp = C.TRANSIT[l.type].speed * C.VEH_SPEED;
    l.loopTime = l.length / (sp * (l.type !== 'rail' ? 0.7 : 0.85)) + l.stops.length * (l.type !== 'rail' ? 2 : 3);
    if (l.type === 'rail') buildPoly(l);
    drawRibbon(l);
    spawnVehicles(l);
    return true;
  };

  function railY(i, wx, wz) {
    const Wd = CB.World;
    return Wd.rail[i] === 1 ? Wd.deckH(wx, wz) + 0.32 : Wd.groundH(wx, wz) - 10;
  }
  function buildPoly(l) {
    const p = l.path, n = p.length, pts = [];
    const off = 1.75;
    for (let k = 0; k < n; k++) {
      const cur = p[k], prev = p[(k - 1 + n) % n], next = p[(k + 1) % n];
      const cx = (U.tx(cur) + 0.5) * T, cz = (U.ty(cur) + 0.5) * T;
      let ix = Math.sign(U.tx(cur) - U.tx(prev)), iz = Math.sign(U.ty(cur) - U.ty(prev));
      let ox = Math.sign(U.tx(next) - U.tx(cur)), oz = Math.sign(U.ty(next) - U.ty(cur));
      if (n === 1) { ix = ox = 1; iz = oz = 0; }
      if (ix === 0 && iz === 0) { ix = ox; iz = oz; }
      if (ox === 0 && oz === 0) { ox = ix; oz = iz; }
      const rix = -iz, riz = ix, rox = -oz, roz = ox;
      const ex = cx - ix * T / 2 + rix * off, ez = cz - iz * T / 2 + riz * off;
      const xx = cx + ox * T / 2 + rox * off, xz = cz + oz * T / 2 + roz * off;
      let qx, qz;
      if (ix === ox && iz === oz) { qx = (ex + xx) / 2; qz = (ez + xz) / 2; }
      else if (ix === -ox && iz === -oz) { qx = cx + ix * T * 0.5; qz = cz + iz * T * 0.5; }
      else { qx = cx + rix * off + rox * off; qz = cz + riz * off + roz * off; }
      for (let s = 0; s < 4; s++) {
        const t = s / 4, u = 1 - t;
        const x = u * u * ex + 2 * u * t * qx + t * t * xx, z = u * u * ez + 2 * u * t * qz + t * t * xz;
        pts.push(x, railY(cur, x, z), z);
      }
    }
    const m = pts.length / 3, cum = new Float32Array(m + 1);
    for (let k = 0; k < m; k++) {
      const a = k * 3, b = ((k + 1) % m) * 3;
      cum[k + 1] = cum[k] + Math.hypot(pts[b] - pts[a], pts[b + 2] - pts[a + 2]);
    }
    l.poly = pts; l.cum = cum; l.plen = cum[m];
    l.stopS = l.sidx.map(i => cum[i * 4 + 2]);
  }
  function polyAt(l, s, out) {
    const L = l.plen; s = ((s % L) + L) % L;
    const cum = l.cum, m = l.poly.length / 3;
    let lo = 0, hi = m;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= s) lo = mid; else hi = mid; }
    const a = lo * 3, b = ((lo + 1) % m) * 3;
    const seg = cum[lo + 1] - cum[lo] || 1, t = (s - cum[lo]) / seg;
    const P = l.poly;
    out[0] = P[a] + (P[b] - P[a]) * t; out[1] = P[a + 1] + (P[b + 1] - P[a + 1]) * t; out[2] = P[a + 2] + (P[b + 2] - P[a + 2]) * t;
    const dx = P[b] - P[a], dz = P[b + 2] - P[a + 2], dl = Math.hypot(dx, dz) || 1;
    out[3] = dx / dl; out[4] = dz / dl;
  }

  function drawRibbon(l) {
    const Mx = CB.Meshes, Wd = CB.World;
    if (l.ribbon) { Mx.lineGroup.remove(l.ribbon); l.ribbon.geometry.dispose(); l.ribbon = null; }
    if (!l.path) return;
    const pts = [];
    const off = (X.lines.indexOf(l) % 4) * 0.7;
    for (const i of l.path) {
      const x = (U.tx(i) + 0.5) * T + off, z = (U.ty(i) + 0.5) * T + off;
      let y;
      if (l.type !== 'rail') y = Wd.roadH(x, z) + 1.6;
      else y = Wd.rail[i] === 1 ? Wd.deckH(x, z) + 1.6 : Math.max(Wd.groundH(x, z), C.WATER) + 2.2;
      pts.push(x, y, z);
    }
    l.ribbon = Mx.ribbon(pts, l.type !== 'rail' ? 1.6 : 2.4, l.color, true);
    if (l.ribbon) { l.ribbon.visible = X.ribbonsOn; Mx.lineGroup.add(l.ribbon); }
  }
  X.ribbonsOn = false;
  X.showRibbons = function (on, only) {
    X.ribbonsOn = on;
    for (const l of X.lines) if (l.ribbon) l.ribbon.visible = on || l === only;
  };

  // ---------------- vehicles ----------------
  function removeVehicles(l) {
    const Tr = CB.Traffic;
    Tr.vehicles = Tr.vehicles.filter(v => v.line !== l);
    X.trains = X.trains.filter(t => t.line !== l);
  }
  function spawnVehicles(l) {
    removeVehicles(l);
    if (!l.path || l.broken) return;
    const n = l.vehicles;
    if (l.type !== 'rail') {
      for (let k = 0; k < n; k++) {
        const startK = Math.floor(k * l.stops.length / n) % l.stops.length;
        const v = CB.Traffic.spawn({ kind: l.type, path: l.path, loop: true, col: CB.Meshes.CAR_COLORS && lcCol(l.color) });
        if (!v) continue;
        v.line = l; v.pass = []; v.load = 0;
        v.seg = l.sidx[startK]; v.t = 0;
        v.stopK = (startK + 1) % l.stops.length; v.stopAt = l.sidx[v.stopK];
        v.onStop = busAtStop;
        v.onBroken = () => { };
        resetSeg(v);
      }
    } else {
      for (let k = 0; k < n; k++) {
        const s = l.plen * k / n;
        let nk = 0;
        while (nk < l.stopS.length && l.stopS[nk] <= s + 0.1) nk++;
        X.trains.push({ line: l, s, v: 0, dwell: 0, pass: [], load: 0, nextK: nk % l.stopS.length });
      }
    }
  }
  function resetSeg(v) { v.t = 0; v.seg = v.seg % v.path.length; CB.Traffic._setup(v); }
  const colCache = {};
  function lcCol(hex) { if (!colCache[hex]) { const a = U.hex(hex); colCache[hex] = [U.lin(a[0]), U.lin(a[1]), U.lin(a[2])]; } return colCache[hex]; }

  function serveStop(veh, l, stop, cap) {
    let boarded = 0;
    // alight
    const stay = [];
    for (const p of veh.pass) {
      const leg = p.legs[p.li];
      if (leg.to === stop.id) {
        veh.load -= p.n; p.li++;
        if (p.li >= p.legs.length) { X.stats.riders += p.n; if (p.onDone) p.onDone(p); }
        else { p.t0 = CB.Traffic.time; stop.waiting.push(p); }
      } else stay.push(p);
    }
    veh.pass = stay;
    // board
    const left = [];
    const fare = C.TRANSIT[l.type].fare;
    for (const p of stop.waiting) {
      const leg = p.legs[p.li];
      if (leg.line === l.id && veh.load + p.n <= cap) {
        veh.pass.push(p); veh.load += p.n; boarded += p.n;
        l.ridersMonth += p.n;
        CB.Sim.earn('fares', fare * p.n);
      } else left.push(p);
    }
    stop.waiting = left;
    return boarded;
  }
  function busAtStop(v) {
    const l = v.line; if (!l || !l.path) return;
    const stop = byId.get(l.stops[v.stopK]);
    let b = 0;
    if (stop) b = serveStop(v, l, stop, C.TRANSIT[l.type].cap);
    v.dwell = 1.4 + b * 0.04;
    v.stopK = (v.stopK + 1) % l.stops.length;
    v.stopAt = l.sidx[v.stopK];
    if (l.stops.length === 1) v.stopAt = -99;
  }

  // ---------------- routing graph ----------------
  let graph = null;
  X.rebuildGraph = function () {
    X.dirty = false;
    const S = X.stops.length;
    const idx = new Map(); X.stops.forEach((s, k) => idx.set(s.id, k));
    const adj = [];
    for (let k = 0; k < S; k++) adj.push([]);
    const lineNodes = [];
    for (const l of X.lines) {
      if (!l.path || l.broken) continue;
      const base = adj.length;
      const sp = C.TRANSIT[l.type].speed * C.VEH_SPEED * (l.type !== 'rail' ? 0.65 : 0.85);
      const wait = Math.min(25, l.loopTime / (2 * Math.max(1, l.vehicles)));
      const n = l.stops.length;
      for (let k = 0; k < n; k++) adj.push([]);
      for (let k = 0; k < n; k++) {
        const si = idx.get(l.stops[k]);
        const node = base + k;
        adj[si].push([node, wait, 'b', l.id]);
        adj[node].push([si, 2, 'a', l.id]);
        const a = l.sidx[k], b = k + 1 < n ? l.sidx[k + 1] : l.path.length;
        const dist = (b - a) * T;
        adj[node].push([base + (k + 1) % n, dist / sp + (l.type !== 'rail' ? 2 : 3), 'r', l.id]);
      }
      lineNodes.push({ l, base });
    }
    // walking transfers
    for (let a = 0; a < S; a++) for (let b = 0; b < S; b++) {
      if (a === b) continue;
      const d = U.dist(X.stops[a].tile, X.stops[b].tile);
      if (d <= 4) adj[a].push([b, d * T / X.WALK_V + 4, 'w', 0]);
    }
    const V = adj.length;
    const dist = new Float32Array(S * S).fill(Infinity);
    const preds = [];
    const h = new U.Heap();
    for (let s = 0; s < S; s++) {
      const D = new Float32Array(V).fill(Infinity), P = new Int32Array(V).fill(-1), PE = new Int32Array(V).fill(-1);
      D[s] = 0; h.clear(); h.push(s, 0);
      while (h.size) {
        const u = h.pop();
        for (let e = 0; e < adj[u].length; e++) {
          const [v, w] = adj[u][e];
          const nd = D[u] + w;
          if (nd < D[v]) { D[v] = nd; P[v] = u; PE[v] = e; h.push(v, nd); }
        }
      }
      for (let t = 0; t < S; t++) dist[s * S + t] = D[t];
      preds.push([P, PE]);
    }
    graph = { S, idx, adj, dist, preds, legCache: new Map() };
  };
  function legs(o, d) {
    const key = o * 100000 + d;
    if (graph.legCache.has(key)) return graph.legCache.get(key);
    const [P, PE] = graph.preds[o];
    const nodes = [], edges = [];
    for (let v = d; v !== o && v !== -1; v = P[v]) { nodes.push(v); edges.push(graph.adj[P[v]][PE[v]]); }
    nodes.reverse(); edges.reverse();
    const out = [];
    let cur = null;
    let prevStop = o;
    for (let k = 0; k < edges.length; k++) {
      const e = edges[k];
      if (e[2] === 'b') { cur = { line: e[3], from: X.stops[prevStop].id, to: -1 }; }
      else if (e[2] === 'a') { if (cur) { cur.to = X.stops[nodes[k]].id; out.push(cur); cur = null; } prevStop = nodes[k]; }
      else if (e[2] === 'w') prevStop = nodes[k];
    }
    graph.legCache.set(key, out);
    return out;
  }
  X.route = function (fromTile, toTile) {
    if (!X.lines.length || !X.stops.length) return null;
    if (X.dirty || !graph) X.rebuildGraph();
    const R = C.WALK_R, S = graph.S;
    const O = [], D = [];
    for (let k = 0; k < S; k++) {
      const s = X.stops[k];
      const a = U.dist(s.tile, fromTile), b = U.dist(s.tile, toTile);
      if (a <= R) O.push([k, a]);
      if (b <= R) D.push([k, b]);
    }
    if (!O.length || !D.length) return null;
    let best = Infinity, bo = -1, bd = -1;
    for (const [o, wa] of O) for (const [d, wb] of D) {
      if (o === d) continue;
      const t = graph.dist[o * S + d];
      if (t === Infinity) continue;
      const tot = t + (wa + wb) * T / X.WALK_V;
      if (tot < best) { best = tot; bo = o; bd = d; }
    }
    if (bo < 0) return null;
    const lg = legs(bo, bd);
    if (!lg.length) return null;
    return { time: best, o: X.stops[bo], d: X.stops[bd], legs: lg };
  };
  X.hasStopNear = function (tile) {
    for (const s of X.stops) if (U.dist(s.tile, tile) <= C.WALK_R) return true;
    return false;
  };
  X.addPassenger = function (route, n, onDone) {
    const p = { legs: route.legs, li: 0, n, t0: CB.Traffic.time, onDone };
    route.o.waiting.push(p);
  };

  // ---------------- update ----------------
  const tmp = [0, 0, 0, 0, 0];
  X.update = function (dt) {
    // trains
    const cap = C.TRANSIT.rail.cap, vmax = C.TRANSIT.rail.speed * C.VEH_SPEED;
    for (const tr of X.trains) {
      const l = tr.line;
      if (!l.poly) continue;
      if (tr.dwell > 0) { tr.dwell -= dt; continue; }
      const L = l.plen;
      const target = l.stopS[tr.nextK];
      const dist = ((target - tr.s) % L + L) % L;
      const want = Math.min(vmax, Math.sqrt(2 * 5 * dist) + 1);
      tr.v = want > tr.v ? Math.min(want, tr.v + 6 * dt) : want;
      const step = tr.v * dt;
      if (step >= dist || dist < 0.3) {
        tr.s = target; tr.v = 0;
        const stop = byId.get(l.stops[tr.nextK]);
        const b = stop ? serveStop(tr, l, stop, cap) : 0;
        tr.dwell = 2.5 + b * 0.01;
        tr.nextK = (tr.nextK + 1) % l.stopS.length;
      } else tr.s = (tr.s + step) % L;
    }
    // waiting passengers give up after a while
    if ((X._t = (X._t || 0) + dt) > 2) {
      X._t = 0;
      const now = CB.Traffic.time;
      let w = 0;
      for (const s of X.stops) {
        if (s.waiting.length) s.waiting = s.waiting.filter(p => now - p.t0 < 90);
        if (s.waiting.length > 120) s.waiting.splice(0, s.waiting.length - 120);
        for (const p of s.waiting) w += p.n;
      }
      X.stats.waiting = w;
    }
  };
  X.render = function () {
    const Mx = CB.Meshes, Wd = CB.World;
    for (const tr of X.trains) {
      const l = tr.line; if (!l.poly) continue;
      const col = lcCol(l.color);
      for (let c = 0; c < 3; c++) {
        polyAt(l, tr.s - c * 14.6, tmp);
        if (tmp[1] < Wd.groundH(tmp[0], tmp[2]) - 1) continue;
        Mx.pushVehicle('train', tmp[0], tmp[1], tmp[2], tmp[3], tmp[4], col, 0);
      }
    }
  };

  X.validate = function () {
    for (const l of X.lines) X.buildLine(l);
    for (const s of X.stops.slice()) {
      const Wd = CB.World;
      if (X.canPlaceStopIgnoringSelf(s)) X.removeStop(s);
    }
    X.dirty = true;
  };
  X.canPlaceStopIgnoringSelf = function (s) {
    const Wd = CB.World, R = C.ROADS[Wd.road[s.tile]];
    if (s.type === 'bus') return !R || !R.car;
    if (s.type === 'tram') return !R || !R.tram;
    return !Wd.rail[s.tile];
  };
  X.vehiclesOf = function (l) {
    if (l.type !== 'rail') return CB.Traffic.vehicles.filter(v => v.line === l);
    return X.trains.filter(t => t.line === l);
  };
  X.clearAll = function () {
    for (const l of X.lines) if (l.ribbon) CB.Meshes.lineGroup.remove(l.ribbon);
    X.stops = []; X.lines = []; X.trains = []; byId.clear(); X.nextStop = 1; X.nextLine = 1; X.dirty = true;
  };
  X.monthly = function () { for (const l of X.lines) { l.ridersLast = l.ridersMonth; l.ridersMonth = 0; } };
  X.serialize = function () {
    return {
      stops: X.stops.map(s => ({ id: s.id, type: s.type, tile: s.tile, name: s.name, color: s.color })),
      lines: X.lines.map(l => ({ id: l.id, type: l.type, name: l.name, color: l.color, stops: l.stops, vehicles: l.vehicles, ridersLast: l.ridersLast })),
      nextStop: X.nextStop, nextLine: X.nextLine,
    };
  };
  X.load = function (d) {
    X.clearAll();
    for (const s of d.stops) { const st = { ...s, waiting: [] }; X.stops.push(st); byId.set(st.id, st); }
    X.nextStop = d.nextStop; X.nextLine = d.nextLine;
    for (const l of d.lines) {
      const ln = { ...l, ridersMonth: 0, broken: false };
      X.lines.push(ln);
    }
    X.dirty = true;
  };
  X.buildAll = function () { for (const l of X.lines) X.buildLine(l); };
})();
