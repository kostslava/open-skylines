'use strict';
// Open Skylines — city simulation: zoning growth, demand, jobs, happiness, services, economy, milestones
(function () {
  const { C, U } = CB;
  const T = C.TILE, W = C.W, N = W * W;
  const S = CB.Sim = {};

  const COV_KEYS = ['police', 'fire', 'health', 'edu', 'garbage', 'park', 'landmark', 'pollution', 'noise', 'lv', 'transit'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  S.init = function (opts) {
    S.buildings = new Map();
    S.nextId = 1;
    S.money = C.START_MONEY;
    S.month = 0;
    S.hour = 7.0;
    S.speed = 1;
    S.name = opts.name || 'New City';
    S.milestone = 0;
    S.tax = { res: 10, com: 10, ind: 10, off: 10 };
    S.loans = [];
    S.demand = { rlow: 80, rmed: 0, rhigh: 0, com: 30, ind: 40, off: 0 };
    S.stats = { pop: 0, workers: 0, employed: 0, jobs: 0, filled: 0, happy: 60, unemp: 0, edu: 0, outsideIn: 0, transitShare: 0, commute: 0, buildingCount: 0 };
    S.budget = blankBudget(); S.last = blankBudget();
    S.history = [];
    S.cov = {}; for (const k of COV_KEYS) S.cov[k] = new Float32Array(N);
    S.covDirty = true; S.lotsDirty = true; S.zoneTexDirty = true;
    S.lots = [];
    S.acc = { work: 0, home: 0, shop: 0, freight: 0, visit: 0, cin: 0, cout: 0 };
    S.tickAcc = 0; S.hourAcc = 0; S.resRot = 0;
    S.icons = [];
    S.notices = [];
    S.unseen = [];
    S.rng = U.rng((opts.seed || 1) * 31 + 7);
    computeWaterNear();
  };
  function blankBudget() { return { inc: { res: 0, com: 0, ind: 0, off: 0, fares: 0 }, exp: { services: 0, roads: 0, transit: 0, utilities: 0, loans: 0 } }; }
  S.dateStr = function () { return MONTHS[S.month % 12] + ' ' + (2026 + Math.floor(S.month / 12)); };
  S.notify = function (text, kind) { S.notices.push({ text, kind: kind || 'info' }); };
  S.earn = function (k, v) { S.money += v; S.budget.inc[k] = (S.budget.inc[k] || 0) + v; };
  S.unlocked = lvl => S.milestone >= lvl;

  let waterNear = null;
  function computeWaterNear() {
    const Wd = CB.World;
    waterNear = new Uint8Array(N);
    for (let y = C.P0; y < C.P1; y++) for (let x = C.P0; x < C.P1; x++) {
      let near = 0;
      for (let dy = -3; dy <= 3 && !near; dy++) for (let dx = -3; dx <= 3; dx++) {
        const nx = x + dx, ny = y + dy;
        if (U.inWorld(nx, ny) && Wd.isWater(U.idx(nx, ny))) { near = 1; break; }
      }
      waterNear[U.idx(x, y)] = near;
    }
  }

  // ------------------------------------------------------------------
  // Buildings
  // ------------------------------------------------------------------
  const zoneOf = b => b.kind === 'zone' ? C.ZONES[b.zone] : null;
  S.isRes = b => b.kind === 'zone' && C.ZONES[b.zone].cat === 'res';
  S.isWork = b => b.kind === 'zone' && C.ZONES[b.zone].cat !== 'res';
  S.capOf = function (b) {
    const z = zoneOf(b); if (!z) return 0;
    const c = z.cap[b.level - 1];
    if (z.rows) { const units = Math.max(2, Math.round(b.w * T / 4.6)); return Math.round(units * c); } // one household per row house
    if (z.perBuilding) { const a = b.w * b.d; return Math.max(2, Math.round(c * (a <= 1 ? 0.7 : a <= 2 ? 1 : a <= 3 ? 1.25 : a <= 4 ? 1.5 : 2))); }
    return c * b.w * b.d;
  };
  S.centerTile = b => U.idx(b.x + (b.fw >> 1), b.y + (b.fh >> 1));

  function lotTiles(b) {
    const out = [];
    for (let y = b.y; y < b.y + b.fh; y++) for (let x = b.x; x < b.x + b.fw; x++) out.push(U.idx(x, y));
    return out;
  }
  S.lotTiles = lotTiles;

  function makeBuilding(spec) {
    const Wd = CB.World;
    const b = Object.assign({
      id: S.nextId++, level: 1, state: 'live', st: 0, buildT: 2.5, seed: Math.floor(S.rng() * 1e9),
      res: 0, jobs: 0, filled: 0, outside: 0, work: [], happy: 60, garbage: 0, prog: 0, low: 0, abandT: 0,
      cust: 0, custRatio: 0.7, commute: 0, gTarget: false, vehOut: 0, fire: 0, prob: null, age: 0,
    }, spec);
    let mx = -1e9, mn = 1e9;
    for (let y = b.y; y <= b.y + b.fh; y++) for (let x = b.x; x <= b.x + b.fw; x++) { const h = Wd.cornerH(x, y); mx = Math.max(mx, h); mn = Math.min(mn, h); }
    b.baseY = Math.max(mx, C.WATER + 0.3) + 0.05; b.minY = mn;
    for (const t of lotTiles(b)) { Wd.bld[t] = b.id; Wd.tree[t] = 0; }
    S.buildings.set(b.id, b);
    b.name = nameFor(b);
    CB.Meshes.addBuilding(b);
    CB.Meshes.treesDirty = true;
    S.zoneTexDirty = true; S.lotsDirty = true;
    return b;
  }
  const NM = {
    res: ['Residence', 'Homes', 'Place', 'Court', 'Terrace', 'Gardens', 'Cottage', 'House'],
    resHigh: ['Towers', 'Heights', 'Lofts', 'Residences', 'Tower', 'Point'],
    com: ['Market', 'Goods', 'Deli', 'Outfitters', 'Bistro', 'Pharmacy', 'Books', 'Hardware', 'Grocers', 'Café'],
    ind: ['Logistics', 'Fabrication', 'Foods', 'Works', 'Plastics', 'Freight', 'Textiles', 'Steel'],
    off: ['Partners', 'Analytics', 'Labs', 'Group', 'Capital', 'Systems', 'Media', 'Software'],
    pre: ['Maple', 'Northwind', 'Harbour', 'Juniper', 'Granite', 'Blue Heron', 'Cedar', 'Lakeside', 'Summit', 'Willow', 'Ironwood', 'Beacon', 'Sterling', 'Riverside', 'Oak', 'Aurora'],
  };
  function nameFor(b) {
    if (b.kind === 'svc') return C.SERVICES[b.svc].name;
    const r = U.rng(b.seed);
    const cat = C.ZONES[b.zone].cat;
    return U.pick(NM.pre, r) + ' ' + U.pick(b.zone === 3 ? NM.resHigh : NM[cat], r);
  }

  S.removeBuilding = function (b, quiet) {
    const Wd = CB.World;
    if (!S.buildings.has(b.id)) return;
    for (const t of lotTiles(b)) if (Wd.bld[t] === b.id) Wd.bld[t] = 0;
    if (S.isRes(b)) releaseWork(b);
    if (S.isWork(b)) {
      S.buildings.forEach(o => { if (o.work.length) o.work = o.work.filter(w => w.id !== b.id); });
    }
    S.buildings.delete(b.id);
    CB.Meshes.removeBuilding(b);
    CB.Meshes.treesDirty = true;
    S.zoneTexDirty = true; S.lotsDirty = true;
    if (b.kind === 'svc') S.covDirty = true;
    if (CB.UI && CB.UI.selected === b) CB.UI.select(null);
  };
  function releaseWork(b) {
    for (const w of b.work) { const o = S.buildings.get(w.id); if (o) o.filled = Math.max(0, o.filled - w.n); }
    b.work = [];
  }
  function employedOf(b) { let n = 0; for (const w of b.work) n += w.n; return n; }
  S.employedOf = employedOf;

  // ------------------------------------------------------------------
  // Lots & growth
  // ------------------------------------------------------------------
  function frontOK(i, d) {
    const Wd = CB.World;
    const j = Wd.neighbor(i, d);
    return j >= 0 && Wd.road[j] && C.ROADS[Wd.road[j]].zonable ? j : -1;
  }
  function tileFree(t, z) {
    const Wd = CB.World;
    return Wd.zone[t] === z && !Wd.bld[t] && !Wd.road[t] && !Wd.pmask[t] && Wd.rail[t] !== 1 && Wd.buildable(t);
  }
  function rebuildLots() {
    const Wd = CB.World;
    S.lots = C.ZONES.map(() => []);
    for (let i = 0; i < N; i++) {
      const z = Wd.zone[i];
      if (!z || !tileFree(i, z)) continue;
      for (let d = 0; d < 4; d++) { const j = frontOK(i, d); if (j >= 0 && Wd.conn[j]) { S.lots[z].push(i); break; } }
    }
    S.lotsDirty = false;
  }
  function fitLot(i, f, w, d, z) {
    const g = (f + 2) % 4, a = (f + 1) % 4;
    const x = U.tx(i), y = U.ty(i);
    const offs = []; for (let o = 0; o < w; o++) offs.push(o);
    if (S.rng() < 0.5) offs.reverse();
    for (const off of offs) {
      let ok = true, minx = 1e9, miny = 1e9, maxx = -1, maxy = -1, road = -1;
      for (let k = 0; k < w && ok; k++) for (let j = 0; j < d; j++) {
        const tx = x + C.DX[a] * (k - off) + C.DX[g] * j, ty = y + C.DY[a] * (k - off) + C.DY[g] * j;
        if (!U.inPlay(tx, ty)) { ok = false; break; }
        const t = U.idx(tx, ty);
        if (!tileFree(t, z)) { ok = false; break; }
        if (j === 0) { const r = frontOK(t, f); if (r < 0) { ok = false; break; } if (road < 0) road = r; }
        minx = Math.min(minx, tx); maxx = Math.max(maxx, tx); miny = Math.min(miny, ty); maxy = Math.max(maxy, ty);
      }
      if (ok) return { x: minx, y: miny, fw: maxx - minx + 1, fh: maxy - miny + 1, w, d, dir: f, road };
    }
    return null;
  }
  function tryGrow(z) {
    const Wd = CB.World;
    const L = S.lots[z]; if (!L.length) return false;
    for (let attempt = 0; attempt < 6; attempt++) {
      const k = Math.floor(S.rng() * L.length), i = L[k];
      if (!tileFree(i, z)) { L[k] = L[L.length - 1]; L.pop(); if (!L.length) return false; continue; }
      const dirs = [];
      for (let d = 0; d < 4; d++) { const j = frontOK(i, d); if (j >= 0 && Wd.conn[j]) dirs.push(d); }
      if (!dirs.length) continue;
      const f = U.pick(dirs, S.rng);
      // fill the zone as deep as it goes from this frontage, then pick a width
      const Z = C.ZONES[z], g = (f + 2) % 4;
      let maxD = 0;
      for (let j = 0; j < 3; j++) { const tx = U.tx(i) + C.DX[g] * j, ty = U.ty(i) + C.DY[g] * j; if (!U.inPlay(tx, ty) || !tileFree(U.idx(tx, ty), z)) break; maxD++; }
      let depths = [...new Set(Z.lots.map(l => l[1]))].filter(dd => dd <= maxD).sort((p, q) => q - p);
      if (!depths.length) continue;
      const sizes = [];
      for (const dd of depths) {
        const opts = Z.lots.filter(l => l[1] === dd).map(l => [l[0], l[1], (z === 1 && l[0] === 1 ? 2.2 : 1) * (l[2] || 1) * (z === 1 ? 1 : l[0])]);
        // weighted shuffle within one depth
        opts.forEach(o => { o[2] = Math.pow(S.rng(), 1 / o[2]); });
        opts.sort((p, q) => q[2] - p[2]);
        sizes.push(...opts);
      }
      for (const [w, d] of sizes) {
        const spec = fitLot(i, f, w, d, z);
        if (spec) {
          const b = makeBuilding(Object.assign(spec, { kind: 'zone', zone: z, state: 'build', buildT: 1 + w * d * 0.25 }));
          b.cap = S.capOf(b);
          if (!S.isRes(b)) b.jobs = b.cap;
          return true;
        }
      }
    }
    return false;
  }

  S.setZone = function (i, z) {
    const Wd = CB.World;
    if (Wd.zone[i] === z) return false;
    if (z && !Wd.zonable[i]) return false;
    const bid = Wd.bld[i];
    if (bid) {
      const b = S.buildings.get(bid);
      if (b && b.kind === 'svc') return false;
      if (b && b.zone !== z) S.removeBuilding(b);
    }
    Wd.zone[i] = z;
    S.lotsDirty = true; S.zoneTexDirty = true;
    return true;
  };

  // ------------------------------------------------------------------
  // Services
  // ------------------------------------------------------------------
  S.serviceLot = function (key, cx, cy, dir) {
    const sv = C.SERVICES[key], Wd = CB.World;
    const [w, d] = sv.size;
    const tryDir = f => {
      const fw = f % 2 === 0 ? w : d, fh = f % 2 === 0 ? d : w;
      const x = cx - Math.floor((fw - 1) / 2), y = cy - Math.floor((fh - 1) / 2);
      let ok = true, road = -1, reason = '';
      for (let yy = y; yy < y + fh; yy++) for (let xx = x; xx < x + fw; xx++) {
        if (!U.inPlay(xx, yy)) { ok = false; reason = 'Outside the city limits'; continue; }
        const t = U.idx(xx, yy);
        if (!Wd.buildable(t)) { ok = false; reason = 'Ground is too steep or wet'; }
        else if (Wd.road[t]) { ok = false; reason = 'Blocked by a road'; }
        else if (Wd.pmask[t]) { ok = false; reason = 'Blocked by a path'; }
        else if (Wd.rail[t] === 1) { ok = false; reason = 'Blocked by elevated track'; }
        else if (Wd.bld[t]) { const b = S.buildings.get(Wd.bld[t]); if (!b || b.kind === 'svc') { ok = false; reason = 'Blocked by a building'; } }
      }
      // front edge must touch a road
      const g = (f + 2) % 4;
      for (let yy = y; yy < y + fh; yy++) for (let xx = x; xx < x + fw; xx++) {
        const t = U.idx(xx, yy);
        const n = Wd.neighbor(t, f);
        if (n < 0) continue;
        const nx = U.tx(n), ny = U.ty(n);
        const inside = nx >= x && nx < x + fw && ny >= y && ny < y + fh;
        if (!inside && Wd.road[n] && road < 0) road = n;
      }
      if (road < 0 && ok) { ok = false; reason = 'Needs a road along the front'; }
      return { x, y, fw, fh, w, d, dir: f, road, ok, reason, g };
    };
    let first = tryDir(dir);
    if (first.ok || dir === undefined) return first;
    for (let k = 1; k < 4; k++) { const r = tryDir((dir + k) % 4); if (r.ok) return r; }
    // snap: look for a valid spot facing a road within 2 tiles of the cursor
    const offs = [];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dx || dy) offs.push([dx, dy]);
    offs.sort((a, b) => Math.abs(a[0]) + Math.abs(a[1]) - Math.abs(b[0]) - Math.abs(b[1]));
    const ocx = cx, ocy = cy;
    for (const [dx, dy] of offs) {
      cx = ocx + dx; cy = ocy + dy;
      for (let k = 0; k < 4; k++) { const r = tryDir((dir + k) % 4); if (r.ok) return r; }
    }
    return first;
  };
  S.placeService = function (key, lot) {
    const Wd = CB.World;
    // clear zoned buildings in the way
    for (let yy = lot.y; yy < lot.y + lot.fh; yy++) for (let xx = lot.x; xx < lot.x + lot.fw; xx++) {
      const t = U.idx(xx, yy);
      if (Wd.bld[t]) { const b = S.buildings.get(Wd.bld[t]); if (b) S.removeBuilding(b); }
      Wd.zone[t] = 0;
    }
    const b = makeBuilding({ kind: 'svc', svc: key, x: lot.x, y: lot.y, fw: lot.fw, fh: lot.fh, w: lot.w, d: lot.d, dir: lot.dir, road: lot.road, state: 'live' });
    S.covDirty = true;
    return b;
  };

  // ------------------------------------------------------------------
  // Network edits
  // ------------------------------------------------------------------
  S.setRoad = function (i, type) {
    const Wd = CB.World;
    Wd.road[i] = type; Wd.tree[i] = 0;
    if (type) Wd.zone[i] = 0;
    CB.Meshes.markInfra(i);
    CB.Meshes.treesDirty = true;
  };
  S.setRail = function (i, type) {
    const Wd = CB.World;
    Wd.rail[i] = type;
    if (type === 1) { Wd.tree[i] = 0; if (!Wd.road[i]) Wd.zone[i] = 0; }
    CB.Meshes.markInfra(i);
    CB.Meshes.treesDirty = true;
  };
  S.networkChanged = function () {
    const Wd = CB.World;
    Wd.updateZonable();
    Wd.updateConn();
    Wd.updateJunctions();
    Wd.roadVer++;
    CB.Meshes.junctionsChanged();
    for (let i = 0; i < N; i++) if (Wd.zone[i] && !Wd.zonable[i] && !Wd.bld[i]) Wd.zone[i] = 0;
    S.lotsDirty = true; S.zoneTexDirty = true;
    CB.Traffic.validate();
    CB.Transit.validate();
    // re-home buildings whose road vanished
    S.buildings.forEach(b => { if (!Wd.road[b.road]) rehome(b); });
  };
  function rehome(b) {
    const Wd = CB.World;
    for (const t of lotTiles(b)) for (let d = 0; d < 4; d++) {
      const n = Wd.neighbor(t, d);
      if (n >= 0 && Wd.road[n] && Wd.bld[n] !== b.id) { b.road = n; return true; }
    }
    return false;
  }

  // ------------------------------------------------------------------
  // Coverage & land value
  // ------------------------------------------------------------------
  function stamp(arr, cx, cy, r, s, add) {
    const r2 = r * r;
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(W - 1, Math.ceil(cy + r)); y++) {
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(W - 1, Math.ceil(cx + r)); x++) {
        const d2 = (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2;
        if (d2 > r2) continue;
        const f = s * (1 - d2 / r2 * 0.75);
        const i = y * W + x;
        arr[i] = add ? Math.min(1.5, arr[i] + f) : Math.max(arr[i], f);
      }
    }
  }
  function falloff(arr, cx, cy, r0, s) {
    const R = r0 * 4, r02 = r0 * r0;
    for (let y = Math.max(0, Math.floor(cy - R)); y <= Math.min(W - 1, Math.ceil(cy + R)); y++) {
      for (let x = Math.max(0, Math.floor(cx - R)); x <= Math.min(W - 1, Math.ceil(cx + R)); x++) {
        const d2 = (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2;
        const f = s / (1 + d2 / r02) - 0.06;
        if (f <= 0) continue;
        const i = y * W + x;
        arr[i] = Math.min(1.5, arr[i] + f);
      }
    }
  }
  function computeCoverage() {
    const Wd = CB.World, cv = S.cov;
    for (const k of COV_KEYS) cv[k].fill(0);
    S.buildings.forEach(b => {
      const cx = b.x + b.fw / 2, cy = b.y + b.fh / 2;
      if (b.kind === 'svc') {
        const sv = C.SERVICES[b.svc];
        if (!Wd.road[b.road]) return;
        // no hard edge: strength fades with distance, and several buildings add up
        falloff(cv[sv.cov], cx, cy, sv.radius * 0.55, sv.cov === 'park' || sv.cov === 'landmark' ? 1 : 1.1);
        if (sv.pollute) stamp(cv.pollution, cx, cy, 6, sv.pollute, true);
      } else if (b.zone === 6 && b.state === 'live') {
        stamp(cv.pollution, cx, cy, 6 + b.level, 0.32 + b.level * 0.05, true);
      }
    });
    for (const s of CB.Transit.stops) {
      if (!CB.Transit.lines.some(l => l.stops.includes(s.id))) continue;
      stamp(cv.transit, U.tx(s.tile) + 0.5, U.ty(s.tile) + 0.5, C.WALK_R + (s.type === 'rail' ? 3 : 0), s.type === 'rail' ? 1 : 0.7, false);
    }
    // noise from traffic
    const L = CB.Traffic.load;
    for (let i = 0; i < N; i++) {
      const rt = Wd.road[i]; if (!rt) continue;
      const R = C.ROADS[rt]; if (!R.car) continue;
      const hw = R.grp === 'highway';
      const v = Math.min(1, L[i] / R.cap) * (hw ? 1 : 0.7) + (hw ? 0.35 : R.grp === 'large' ? 0.12 : 0);
      if (v < 0.08) continue;
      const x = U.tx(i), y = U.ty(i);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx, ny = y + dy; if (!U.inWorld(nx, ny)) continue;
        const j = ny * W + nx, f = v * (1 - (Math.abs(dx) + Math.abs(dy)) * 0.2);
        if (f > cv.noise[j]) cv.noise[j] = f;
      }
    }
    // tree-lined streets
    for (let i = 0; i < N; i++) {
      const rt = Wd.road[i]; if (!rt || !C.ROADS[rt].trees) continue;
      stamp(cv.park, U.tx(i) + 0.5, U.ty(i) + 0.5, 3, 0.25, true);
    }
    // land value
    for (let y = C.P0; y < C.P1; y++) for (let x = C.P0; x < C.P1; x++) {
      const i = y * W + x;
      let v = 8 + 16 * cv.health[i] + 12 * cv.police[i] + 14 * cv.edu[i] + 20 * Math.min(1, cv.park[i]) + 24 * Math.min(1, cv.landmark[i])
        + 6 * cv.fire[i] + 12 * waterNear[i] + 10 * cv.transit[i] - 40 * Math.min(1, cv.pollution[i]) - 10 * cv.noise[i];
      cv.lv[i] = U.clamp(v, 0, 100);
    }
    S.covDirty = false;
  }
  S.computeCoverage = computeCoverage;

  // ------------------------------------------------------------------
  // Hourly building update
  // ------------------------------------------------------------------
  // households arrive in a moving van (and leave in one); they can commute however they like afterwards
  const MOVE_COLS = ['#e8eaec', '#e07a22', '#d8d4c8', '#2f6fb0', '#c8392e'].map(h => { const a = U.hex(h); return [U.lin(a[0]), U.lin(a[1]), U.lin(a[2])]; });
  let moveBudget = 0;
  function moveIn(b, n) {
    const Wd = CB.World;
    b.inbound = (b.inbound || 0) + n;
    const land = () => { b.inbound = Math.max(0, (b.inbound || 0) - n); if (S.buildings.has(b.id) && b.state !== 'aband') b.res = Math.min(b.cap, b.res + n); };
    CB.Traffic.request({
      from: Wd.outIn, to: b.road, fromB: null, toB: b, kind: 'van', col: U.pick(MOVE_COLS, S.rng), purpose: 'Moving in',
      onArrive: () => land(), onFail: () => land(),
    });
  }
  function moveOut(b) {
    const Wd = CB.World;
    if (moveBudget-- <= 0) return;
    CB.Traffic.request({ from: b.road, to: Wd.outOut, fromB: b, toB: null, kind: 'van', col: U.pick(MOVE_COLS, S.rng), purpose: 'Moving out', onArrive: () => { }, onFail: () => { } });
  }
  function hourlyBuildings() {
    moveBudget = 24;
    const Wd = CB.World, cv = S.cov;
    let pop = 0, happySum = 0, happyW = 0, workers = 0, employed = 0, jobs = 0, filled = 0, eduSum = 0, outsideIn = 0, comm = 0, commN = 0;
    const icons = [];
    const toRemove = [];
    const resDemand = Math.max(S.demand.rlow, S.demand.rmed, S.demand.rhigh);
    S.buildings.forEach(b => {
      b.age++;
      const i = S.centerTile(b);
      const noRoad = !Wd.road[b.road] && !rehome(b);
      const noConn = noRoad || !Wd.conn[b.road];
      b.prob = null;
      if (b.kind === 'svc') {
        if (noRoad) b.prob = 'noroad';
        if (b.prob) icons.push(iconFor(b));
        return;
      }
      if (b.state === 'build') return;
      const z = C.ZONES[b.zone];
      const res = z.cat === 'res';
      // fires
      if (b.state === 'fire') {
        b.fire += 1;
        if (b.fire > 7) { toRemove.push(b); S.notify(b.name + ' burned down. Build a Fire Station nearby.', 'bad'); return; }
        icons.push(iconFor(b, 'fire'));
        return;
      }
      if (b.state === 'live' && S.rng() < (0.00002 + 0.00014 * Math.max(0, 1 - cv.fire[i] * 1.5)) * Math.min(1, b.age / 96)) startFire(b);
      // garbage
      const occ = res ? b.res : b.filled + b.outside;
      if (b.state === 'live') b.garbage += (occ * (res ? 0.07 : 0.09) + 0.5) / (0.85 + b.level * 0.15);
      // happiness
      let h;
      const tax = S.tax[z.cat];
      if (res) {
        const wk = Math.round(b.res * 0.55), emp = employedOf(b);
        h = 42 + 14 * cv.health[i] + 12 * cv.police[i] + 9 * cv.edu[i] + 15 * Math.min(1, cv.park[i]) + 6 * cv.fire[i] + 10 * Math.min(1, cv.landmark[i])
          - 38 * Math.min(1, cv.pollution[i]) - 12 * cv.noise[i] - (tax - 10) * 2.2
          + (wk ? (emp / wk - 0.75) * 24 : 0) + 4 * cv.transit[i];
        if (b.commute > 0) h += U.clamp((70 - b.commute) / 6, -14, 6);
        workers += wk; employed += emp;
        pop += b.res;
        eduSum += cv.edu[i] * b.res;
      } else {
        const fr = b.jobs ? (b.filled + b.outside) / b.jobs : 0;
        h = 42 + 10 * cv.police[i] + 6 * cv.fire[i] + 6 * cv.health[i] + fr * 22 - (tax - 10) * 2.2;
        if (z.cat === 'com') h += (b.custRatio - 0.6) * 30;
        if (z.cat === 'off') h += 10 * cv.edu[i] - 12 * Math.min(1, cv.pollution[i]);
        jobs += b.jobs; filled += b.filled; outsideIn += b.outside;
      }
      if (b.garbage > 100) h -= b.garbage > 200 ? 26 : 14;
      if (noConn) h -= 35;
      b.happy = U.clamp(b.happy + (U.clamp(h, 0, 100) - b.happy) * 0.25, 0, 100);
      if (res && b.res > 0) { happySum += b.happy * b.res; happyW += b.res; if (b.commute) { comm += b.commute; commN++; } }
      if (b.state === 'aband') {
        b.abandT++;
        if (b.abandT > 120) { toRemove.push(b); return; }
        if (b.happy > 45 && !noConn) { b.state = 'live'; b.abandT = 0; b.low = 0; CB.Meshes.refreshBuilding(b); }
        icons.push(iconFor(b, 'aband'));
        return;
      }
      // occupancy
      if (res) {
        const room = b.cap - b.res - (b.inbound || 0);
        if (!noConn && room > 0 && resDemand > 3 && b.happy > 25 && moveBudget > 0) {
          // one van per household (about 2-3 people), a few households at a time
          let want = Math.max(1, Math.ceil(room * 0.4));
          for (let k = 0; k < 3 && want > 0 && moveBudget > 0; k++) { const n = Math.min(want, 2 + (S.rng() < 0.5 ? 1 : 0)); moveIn(b, n); want -= n; moveBudget--; }
        }
        if (b.happy < 28 && b.res > 0 && S.rng() < 0.35) { b.res = Math.max(0, b.res - Math.max(1, Math.ceil(b.res * 0.12))); moveOut(b); }
        const wk = Math.round(b.res * 0.55);
        let e = employedOf(b);
        while (e > wk && b.work.length) {
          const w = b.work[b.work.length - 1]; const o = S.buildings.get(w.id);
          const k = Math.min(w.n, e - wk); w.n -= k; e -= k; if (o) o.filled = Math.max(0, o.filled - k);
          if (w.n <= 0) b.work.pop();
        }
      } else {
        // outside commuters fill jobs when locals are lacking
        if (b.outside > 0 && b.filled + b.outside > b.jobs) b.outside = Math.max(0, b.jobs - b.filled);
      }
      // level up
      const lvReq = C.LV_REQ[b.level] || 999;
      const full = res ? b.res >= b.cap * 0.85 : (b.filled + b.outside) >= b.jobs * 0.7;
      if (b.level < 5 && b.happy > 55 && cv.lv[i] >= lvReq && full && !noConn) {
        b.prog += (b.happy - 45) / 100 * 0.12;
        if (b.prog >= 1) {
          b.prog = 0; b.level++;
          const old = b.cap; b.cap = S.capOf(b);
          if (!res) b.jobs = b.cap;
          CB.Meshes.refreshBuilding(b);
          CB.Meshes.upgradeSite(b);
          if (CB.UI && CB.UI.selected === b) CB.Meshes.setSelection(b);
        }
      }
      // decline
      const failing = b.happy < 22 || (!res && b.age > 60 && (b.filled + b.outside) < b.jobs * 0.12);
      if (failing) b.low++; else b.low = Math.max(0, b.low - 2);
      if (b.low > 60) {
        b.state = 'aband'; b.abandT = 0;
        if (res) { releaseWork(b); b.res = 0; } else { S.buildings.forEach(o => { if (o.work.length) o.work = o.work.filter(w => w.id !== b.id); }); b.filled = 0; b.outside = 0; }
        CB.Meshes.refreshBuilding(b);
        return;
      }
      // problems
      if (noRoad) b.prob = 'noroad';
      else if (noConn) b.prob = 'noconn';
      else if (b.garbage > 100) b.prob = 'garbage';
      else if (!res && b.age > 36 && (b.filled + b.outside) < b.jobs * 0.3) b.prob = 'workers';
      else if (z.cat === 'com' && b.age > 48 && b.custRatio < 0.25) b.prob = 'customers';
      if (b.prob) icons.push(iconFor(b));
    });
    for (const b of toRemove) S.removeBuilding(b);
    const st = S.stats;
    st.pop = pop; st.workers = workers; st.employed = employed; st.jobs = jobs; st.filled = filled; st.outsideIn = outsideIn;
    st.happy = happyW ? happySum / happyW : 60;
    st.unemp = workers ? Math.max(0, 1 - employed / workers) : 0;
    st.edu = pop ? eduSum / pop : 0;
    st.commute = commN ? comm / commN : 0;
    st.buildingCount = S.buildings.size;
    S.icons = icons;
  }
  function iconFor(b, type) {
    const cx = (b.x + b.fw / 2) * T, cz = (b.y + b.fh / 2) * T;
    const h = b._h || (b._h = CB.Meshes.buildingHeight(b));
    return { x: cx, y: b.baseY + h + 4, z: cz, type: type || b.prob };
  }
  S.invalidateHeight = b => { b._h = 0; };

  // ------------------------------------------------------------------
  // Employment matching
  // ------------------------------------------------------------------
  function matchJobs() {
    const Wd = CB.World;
    const open = [];
    // locals can also take jobs currently held by out-of-town commuters
    S.buildings.forEach(b => { if (S.isWork(b) && b.state === 'live' && b.filled < b.jobs) open.push(b); });
    const res = [];
    S.buildings.forEach(b => { if (S.isRes(b) && b.state === 'live' && b.res > 0) res.push(b); });
    if (!res.length) return;
    let n = Math.min(res.length, 60);
    for (let k = 0; k < n && open.length; k++) {
      const b = res[(S.resRot++) % res.length];
      const wk = Math.round(b.res * 0.55);
      let emp = employedOf(b);
      if (emp >= wk || !Wd.conn[b.road]) continue;
      let best = null, bd = 1e9;
      for (let t = 0; t < 6; t++) {
        const o = open[Math.floor(S.rng() * open.length)];
        if (!Wd.conn[o.road]) continue;
        if (o.zone === 7 && S.rng() > S.cov.edu[S.centerTile(b)] * 0.85 + 0.15) continue;
        const d = U.dist(o.road, b.road) + S.rng() * 6;
        if (d < bd) { bd = d; best = o; }
      }
      if (!best) continue;
      // locals displace outside commuters
      const free = best.jobs - best.filled - best.outside + best.outside;
      const take = Math.min(wk - emp, free, 4);
      if (take <= 0) continue;
      const fromOutside = Math.max(0, best.filled + best.outside + take - best.jobs);
      best.outside = Math.max(0, best.outside - fromOutside);
      best.filled += take;
      const e = b.work.find(w => w.id === best.id);
      if (e) e.n += take; else b.work.push({ id: best.id, n: take });
      if (best.filled >= best.jobs) open.splice(open.indexOf(best), 1);
    }
    // commuters from outside when unemployment is low
    if (S.stats.unemp < 0.06) {
      for (const o of open.slice(0, 10)) {
        if (o.filled + o.outside >= o.jobs) continue;
        if (!Wd.conn[o.road]) continue;
        const maxOut = Math.ceil(o.jobs * 0.45);
        const add = Math.min(2, maxOut - o.outside, o.jobs - o.filled - o.outside);
        if (add > 0) o.outside += add;
      }
    }
  }

  // ------------------------------------------------------------------
  // Demand
  // ------------------------------------------------------------------
  function computeDemand() {
    const st = S.stats;
    let comJobs = 0, indJobs = 0, offJobs = 0, landmarks = 0;
    S.buildings.forEach(b => {
      if (b.kind === 'svc') { if (C.SERVICES[b.svc].cat === 'landmarks') landmarks++; return; }
      const cat = C.ZONES[b.zone].cat;
      const cap = b.state === 'build' ? S.capOf(b) : b.jobs;
      if (cat === 'com') comJobs += cap; else if (cat === 'ind') indJobs += cap; else if (cat === 'off') offJobs += cap;
    });
    let pending = 0;
    S.buildings.forEach(b => { if (S.isRes(b)) pending += b.state === 'build' ? S.capOf(b) : Math.max(0, b.cap - b.res); });
    const pop = st.pop;
    const workers = st.workers;
    const openJobs = Math.max(0, st.jobs - st.filled - st.outsideIn);
    // residential: base attractiveness + open jobs + happiness - taxes - unemployment
    let rd = 46 + 34 * U.clamp((openJobs - pending * 0.3) / Math.max(15, workers * 0.2), -1, 1)
      + (st.happy - 55) * 0.8 - (S.tax.res - 10) * 4.5 - Math.max(0, st.unemp - 0.08) * 160
      - Math.max(0, pending - 30 - pop * 0.05) * 0.4;
    if (pop < 80) rd = Math.max(rd, 80 - pending * 0.5);
    rd = U.clamp(rd, 0, 100);
    S.resDemandBase = rd;
    const w = U.clamp(pop / 6000, 0, 1);
    S.demand.rlow = U.clamp(rd * (1.05 - 0.55 * w), 0, 100);
    S.demand.rmed = S.unlocked(1) ? U.clamp(rd * (0.6 + 0.5 * w) + (pop > 400 ? 8 : 0), 0, 100) : 0;
    S.demand.rhigh = S.unlocked(4) ? U.clamp(rd * (0.4 + 0.8 * w) + 10, 0, 100) : 0;
    // workplaces: what residents need + workers looking for jobs
    const avail = U.clamp((st.unemp - 0.03) * 400, 0, 60);
    const comNeed = pop * 0.16 + landmarks * 25 + 6;
    S.demand.com = U.clamp(22 + 60 * U.clamp((comNeed - comJobs) / Math.max(8, comNeed * 0.3), -1, 1) - (S.tax.com - 10) * 4.5 + avail, 0, 100);
    const indNeed = pop * 0.19 + comJobs * 0.2 + 10;
    S.demand.ind = U.clamp(22 + 60 * U.clamp((indNeed - indJobs) / Math.max(8, indNeed * 0.3), -1, 1) - (S.tax.ind - 10) * 4.5 + avail, 0, 100);
    const offNeed = pop * 0.11 * (0.3 + st.edu);
    S.demand.off = S.unlocked(3) ? U.clamp(15 + 65 * U.clamp((offNeed - offJobs) / Math.max(8, offNeed * 0.3), -1, 1) - (S.tax.off - 10) * 4.5 + avail * 0.6, 0, 100) : 0;
  }
  S.zoneDemand = function (z) {
    const k = C.ZONES[z].key;
    if (k === 'rlow') return S.demand.rlow;
    if (k === 'rmed' || k === 'rapt') return S.demand.rmed;
    if (k === 'rhigh') return S.demand.rhigh;
    if (k === 'clow' || k === 'chigh') return S.demand.com;
    if (k === 'ind') return S.demand.ind;
    return S.demand.off;
  };

  function growth() {
    if (S.lotsDirty) rebuildLots();
    let constructing = 0;
    S.buildings.forEach(b => { if (b.state === 'build') constructing++; });
    const maxCons = 10 + Math.floor(S.stats.pop / 25);
    for (let z = 1; z < C.ZONES.length; z++) {
      if (!S.unlocked(C.ZONES[z].unlock)) continue;
      const d = S.zoneDemand(z);
      if (d < 6 || !S.lots[z] || !S.lots[z].length) continue;
      const tries = (1 + Math.floor(d / 20)) * (C.ZONES[z].cat === 'res' ? 2 : 1);
      for (let t = 0; t < tries && constructing < maxCons; t++) {
        if (S.rng() < d / 100 * 0.95) { if (tryGrow(z)) constructing++; }
      }
    }
  }

  // ------------------------------------------------------------------
  // Fires & service vehicles
  // ------------------------------------------------------------------
  function svcInRange(b, cov, needVeh) {
    let best = null, bd = 1e9;
    S.buildings.forEach(s => {
      if (s.kind !== 'svc') return;
      const sv = C.SERVICES[s.svc];
      if (sv.cov !== cov) return;
      if (needVeh && s.vehOut >= (sv.vehCount || 0)) return;
      const d = Math.hypot(s.x + s.fw / 2 - b.x - b.fw / 2, s.y + s.fh / 2 - b.y - b.fh / 2);
      if (d < bd && CB.World.road[s.road] && CB.World.conn[s.road]) { bd = d; best = s; }
    });
    return best;
  }
  function startFire(b) {
    b.state = 'fire'; b.fire = 0;
    const st = svcInRange(b, 'fire', true);
    if (!st) return;
    st.vehOut++;
    const back = () => {
      CB.Traffic.request({ from: b.road, to: st.road, kind: 'fire', onArrive: () => { st.vehOut = Math.max(0, st.vehOut - 1); }, onFail: () => { st.vehOut = Math.max(0, st.vehOut - 1); } });
    };
    CB.Traffic.request({
      from: st.road, to: b.road, kind: 'fire', purpose: 'Responding to a fire',
      onArrive: (v, ok) => {
        if (S.buildings.has(b.id) && b.state === 'fire') { b.state = 'live'; b.fire = 0; CB.Meshes.refreshBuilding(b); }
        back();
      },
      onFail: () => { st.vehOut = Math.max(0, st.vehOut - 1); if (b.state === 'fire') { b.state = 'live'; } },
    });
  }
  function dispatchServices() {
    const Wd = CB.World;
    const all = [];
    S.buildings.forEach(b => all.push(b));
    for (const s of all) {
      if (s.kind !== 'svc' || !Wd.road[s.road] || !Wd.conn[s.road]) continue;
      const sv = C.SERVICES[s.svc];
      if (!sv.veh || s.vehOut >= sv.vehCount) continue;
      const cx = s.x + s.fw / 2, cy = s.y + s.fh / 2;
      if (sv.cov === 'garbage') {
        // pick the pile worth the trip: lots of garbage, not too far away
        let target = null, best = 0;
        for (let k = 0; k < 50; k++) {
          const b = all[Math.floor(S.rng() * all.length)];
          if (b.kind !== 'zone' || b.gTarget || b.garbage < 30 || !Wd.conn[b.road]) continue;
          const sc = b.garbage / (1 + Math.hypot(b.x - cx, b.y - cy) / 14);
          if (sc > best) { best = sc; target = b; }
        }
        if (!target) continue;
        target.gTarget = true; s.vehOut++;
        const collect = () => {
          const tx = target.x, ty = target.y;
          for (const o of all) if (o.kind === 'zone' && Math.abs(o.x - tx) <= 6 && Math.abs(o.y - ty) <= 6) o.garbage = 0;
          target.gTarget = false;
        };
        const done = () => { s.vehOut = Math.max(0, s.vehOut - 1); };
        CB.Traffic.request({
          from: s.road, to: target.road, kind: 'garbage', purpose: 'Collecting garbage',
          onArrive: (v, ok) => { if (ok) collect(); else target.gTarget = false; CB.Traffic.request({ from: target.road, to: s.road, kind: 'garbage', purpose: 'Returning to depot', onArrive: done, onFail: done }); },
          onFail: (why) => { if (why === 'cap') collect(); target.gTarget = false; done(); },
        });
      } else if ((sv.cov === 'police' || sv.cov === 'health') && S.rng() < (sv.cov === 'police' ? 0.55 : 0.3)) {
        // nearby calls are more likely than far ones
        let target = null, bd = 1e9;
        for (let k = 0; k < 6; k++) { const b = all[Math.floor(S.rng() * all.length)]; if (b.kind !== 'zone' || b.state !== 'live') continue; const d = Math.hypot(b.x - cx, b.y - cy) * (0.6 + S.rng()); if (d < bd) { bd = d; target = b; } }
        if (!target) continue;
        s.vehOut++;
        const done = () => { s.vehOut = Math.max(0, s.vehOut - 1); };
        CB.Traffic.request({
          from: s.road, to: target.road, kind: sv.veh, purpose: sv.cov === 'police' ? 'On patrol' : 'Medical call',
          onArrive: () => CB.Traffic.request({ from: target.road, to: s.road, kind: sv.veh, purpose: 'Returning to station', onArrive: done, onFail: done }),
          onFail: done,
        });
      }
    }
  }

  // ------------------------------------------------------------------
  // Trips (agents)
  // ------------------------------------------------------------------
  const gauss = (h, mu, s) => Math.exp(-0.5 * ((h - mu) / s) ** 2) / (s * 2.5066);
  function dayCurve(h) { return h < 6 || h > 22 ? 0.01 : (h < 9 || h > 19 ? 0.05 : 0.075); }
  function carColor() { return U.pick(CB.Meshes.CAR_COLORS, S.rng); }
  function randomOf(list) { return list.length ? list[Math.floor(S.rng() * list.length)] : null; }

  let resList = [], comList = [], indList = [], workList = [], visitList = [], parkList = [];
  function refreshLists() {
    resList = []; comList = []; indList = []; workList = []; visitList = []; parkList = [];
    S.buildings.forEach(b => {
      if (b.state !== 'live' || !CB.World.conn[b.road]) return;
      if (b.kind === 'svc') { const c = C.SERVICES[b.svc].cat; if (c === 'landmarks' || (c === 'parks' && b.w > 1)) visitList.push(b); if (c === 'parks' || c === 'landmarks') parkList.push(b); return; }
      const cat = C.ZONES[b.zone].cat;
      if (cat === 'res') { if (b.res > 0) resList.push(b); }
      else { workList.push(b); if (cat === 'com') { comList.push(b); visitList.push(b); } if (cat === 'ind') indList.push(b); }
    });
    resCum = []; let acc = 0; for (const b of resList) { acc += Math.max(1, b.res); resCum.push(acc); }
  }
  // a home picked in proportion to how many people live there (towers make far more trips than cottages)
  let resCum = [];
  function randomRes() {
    if (!resList.length) return null;
    const t = S.rng() * resCum[resCum.length - 1];
    let lo = 0, hi = resCum.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (resCum[m] < t) lo = m + 1; else hi = m; }
    return resList[lo];
  }

  // ---------------- mode choice ----------------
  // Households own cars at different rates by density; short trips are walked, medium trips
  // are cycled when the route feels safe, and the rest pick between transit and the car.
  const CAR_OWN = [0.9, 0.95, 0.85, 0.7, 0.9, 0.9, 0.9, 0.9, 0.8];
  const BIKE_OWN = 0.45;
  function recordMode(m) { const M = CB.Traffic.mode; for (const k in M) M[k] += ((k === m ? 1 : 0) - M[k]) * 0.01; }
  S.chooseMode = function (dist, hasCar, safety, transit, carT) {
    // dist: route length in tiles. safety: 0..1 bike comfort of the best bike route (or -1 if none).
    // transit: transit route time or null. carT: estimated car time.
    const r = S.rng;
    const pWalk = dist <= 4 ? 0.7 : dist <= 14 ? 0.7 * (14 - dist) / 10 : 0; // mostly a driving city, like the real thing
    if (r() < pWalk) return 'walk';
    if (safety >= 0 && dist <= 70) {
      const fd = dist <= 30 ? 1 : (70 - dist) / 40;
      const pBike = BIKE_OWN * fd * (0.08 + 0.92 * Math.pow(safety, 1.5));
      if (r() < pBike) return 'bike';
    }
    if (transit) {
      const p = hasCar ? 1 / (1 + Math.exp((transit - carT * 1.3) / 10)) : 1;
      if (r() < p * 0.92 + 0.04) return 'transit';
    }
    if (hasCar) return 'car';
    if (safety >= 0 && dist <= 90) return 'bike';
    if (dist <= 40) return 'walk';
    return 'car'; // taxi / ride from a friend
  };
  function softTrip(kind, path, done, fb, tb) {
    const est = path.length * T / (kind === 'bike' ? 11 : 4.5);
    const a = CB.Traffic.spawnSoft(kind, path, (t) => done && done(t, true), fb, tb);
    if (!a && done) done(est, true);
  }
  function personTrip(fromTile, toTile, purpose, n, done, zone, fb, tb) {
    const dist = U.dist(fromTile, toTile);
    const hasCar = S.rng() < (CAR_OWN[zone] || 0.85);
    let bikePath = null, safety = -1;
    if (dist > 4 && dist <= 90) { bikePath = CB.Traffic.findSoftPath(fromTile, toTile, true); if (bikePath) safety = CB.Traffic.bikeSafety(bikePath); }
    const carT = dist * T / (13 * C.VEH_SPEED) * (1 + 1.8 * (1 - CB.Traffic.stats.flow)) + 14;
    const r = dist > 6 ? CB.Transit.route(fromTile, toTile) : null;
    const mode = S.chooseMode(dist, hasCar, safety, r ? r.time : null, carT);
    recordMode(mode);
    if (mode === 'walk') {
      const p = dist <= 40 ? CB.Traffic.findSoftPath(fromTile, toTile, false) : null;
      if (p) { softTrip('ped', p, done, fb, tb); return; }
    } else if (mode === 'bike' && bikePath) { softTrip('bike', bikePath, done, fb, tb); return; }
    else if (mode === 'transit' && r) {
      S.stats.transitShare += (1 - S.stats.transitShare) * 0.01;
      r._t0 = CB.Traffic.time;
      CB.Transit.addPassenger(r, n, () => done && done(CB.Traffic.time - r._t0, true));
      return;
    }
    S.stats.transitShare *= 0.99;
    carTrip(fromTile, toTile, purpose, n, done, null, fb, tb);
  }
  function carTrip(from, to, purpose, n, onArrive, kind, fb, tb) {
    const pub = CB.Traffic.isPublic(tb);
    CB.Traffic.request({
      from, to, fromB: fb || null, toB: tb || null, kind: kind || (S.rng() < 0.3 ? 'suv' : 'car'), col: kind === 'truck' || kind === 'van' ? null : carColor(), purpose,
      onArrive: (v, ok) => { if (ok && pub) CB.Traffic.spawnVisitors(tb, 1 + (S.rng() < 0.5 ? 1 : 0), 40); if (onArrive) onArrive(ok ? CB.Traffic.time - v.born : 120, ok); },
      onFail: (why) => { if (why === 'cap' && onArrive) onArrive(U.dist(from, to) * T / 16 + 10, true); },
    });
  }
  function recordCommute(b) {
    return (t, ok) => {
      if (!S.buildings.has(b.id)) return;
      const v = ok ? t : 150;
      b.commute = b.commute ? b.commute * 0.8 + v * 0.2 : v;
    };
  }
  // shift starts: most people start between 7 and 9, some late morning, some afternoon/evening
  const toWorkCurve = h => 0.5 * gauss(h, 7.2, 0.7) + 0.28 * gauss(h, 8.5, 0.8) + 0.12 * gauss(h, 11.5, 1.4) + 0.1 * gauss(h, 15.5, 1.6);
  const toHomeCurve = h => 0.5 * gauss(h, 16.2, 0.9) + 0.28 * gauss(h, 17.6, 1.0) + 0.12 * gauss(h, 20.5, 1.4) + 0.1 * (gauss(h, 23.6, 1.4) + gauss(h, -0.4, 1.4));

  function generateTrips(dtH) {
    if (!resList.length && !workList.length) return;
    const h = S.hour, st = S.stats, A = S.acc, Wd = CB.World;
    const cars = CB.Gfx.settings.cars;
    const ppc = Math.max(1, st.employed / (cars * 0.6));
    const toWork = toWorkCurve(h), toHome = toHomeCurve(h);
    A.work += st.employed * toWork * dtH / ppc;
    A.home += st.employed * toHome * dtH / ppc;
    A.shop += st.pop * 0.34 * dayCurve(h) * dtH / ppc;
    let indF = 0; for (const b of indList) indF += b.filled + b.outside;
    A.freight += indF * 0.14 * dayCurve(h) * dtH / Math.max(1, ppc * 1.2) + comList.length * 0.05 * dayCurve(h) * dtH / Math.max(1, ppc * 0.5);
    A.visit += (st.pop * 0.015 + visitList.length * 2) * dayCurve(h) * dtH / ppc;
    A.cin += st.outsideIn * toWork * dtH / ppc;
    A.cout += st.outsideIn * toHome * dtH / ppc;
    const inT = Wd.outIn, outT = Wd.outOut;
    let guard = 0;
    while (A.work >= 1 && guard++ < 30) {
      A.work--;
      const b = randomRes(); if (!b || !b.work.length) continue;
      const w = S.buildings.get(U.pick(b.work, S.rng).id); if (!w) continue;
      personTrip(b.road, w.road, 'Commuting to work', ppc, recordCommute(b), b.zone, b, w);
    }
    while (A.home >= 1 && guard++ < 60) {
      A.home--;
      const b = randomRes(); if (!b || !b.work.length) continue;
      const w = S.buildings.get(U.pick(b.work, S.rng).id); if (!w) continue;
      personTrip(w.road, b.road, 'Heading home', ppc, recordCommute(b), b.zone, w, b);
    }
    while (A.shop >= 1 && guard++ < 90) {
      A.shop--;
      const b = randomRes(); if (!b || !comList.length) continue;
      let best = null, bd = 1e9;
      for (let k = 0; k < 5; k++) { const c = randomOf(comList); const d = U.dist(c.road, b.road) + S.rng() * 8; if (d < bd) { bd = d; best = c; } }
      if (!best) continue;
      const shop = best;
      personTrip(b.road, shop.road, 'Going shopping', ppc, () => { if (S.buildings.has(shop.id)) shop.cust += ppc * C.TRIP_K; }, b.zone, b, shop);
    }
    while (A.freight >= 1 && guard++ < 110) {
      A.freight--;
      const src = indList.length && S.rng() < 0.7 ? randomOf(indList) : null;
      if (src) {
        const dst = comList.length && S.rng() < 0.65 ? randomOf(comList) : null;
        if (dst) carTrip(src.road, dst.road, 'Delivering goods', 1, null, 'truck', src, dst);
        else carTrip(src.road, outT, 'Exporting goods', 1, null, 'truck', src, null);
      } else if (comList.length) { const dst = randomOf(comList); carTrip(inT, dst.road, 'Importing goods', 1, null, 'truck', null, dst); }
    }
    while (A.visit >= 1 && guard++ < 130) {
      A.visit--;
      const tgt = randomOf(visitList); if (!tgt) continue;
      carTrip(inT, tgt.road, 'Visiting the city', ppc, () => { if (S.buildings.has(tgt.id) && tgt.kind === 'zone') tgt.cust += ppc * C.TRIP_K; }, null, null, tgt);
    }
    while (A.cin >= 1 && guard++ < 150) {
      A.cin--;
      const w = randomOf(workList); if (!w || !w.outside) continue;
      carTrip(inT, w.road, 'Commuting from out of town', ppc, null, null, null, w);
    }
    while (A.cout >= 1 && guard++ < 170) {
      A.cout--;
      const w = randomOf(workList); if (!w || !w.outside) continue;
      carTrip(w.road, outT, 'Leaving town', ppc, null, null, w, null);
    }
    // residents heading to a park or plaza nearby
    A.park = (A.park || 0) + st.pop * 0.03 * dayCurve(h) * dtH / ppc;
    while (A.park >= 1 && guard++ < 190) {
      A.park--;
      const b = randomRes(); if (!b || !parkList.length) continue;
      let best = null, bd = 1e9;
      for (let k = 0; k < 4; k++) { const p = randomOf(parkList); const d = U.dist(p.road, b.road); if (d < bd) { bd = d; best = p; } }
      if (best && bd < 60) personTrip(b.road, best.road, 'Going to the park', ppc, null, b.zone, b, best);
    }
    for (const k in A) if (A[k] > 40) A[k] = 40;
  }

  function moveIn(b) {
    const inT = CB.World.outIn;
    if (inT === undefined || !CB.World.conn[b.road]) return;
    const n = Math.ceil(b.cap * 0.5);
    CB.Traffic.request({
      from: inT, to: b.road, toB: b, kind: 'van', purpose: 'Moving in',
      onArrive: () => { if (S.buildings.has(b.id)) b.res = Math.min(b.cap, b.res + n); },
      onFail: () => { if (S.buildings.has(b.id)) b.res = Math.min(b.cap, b.res + n); },
    });
  }

  // ------------------------------------------------------------------
  // Economy
  // ------------------------------------------------------------------
  function hourlyEconomy() {
    const Wd = CB.World, B = S.budget;
    let res = 0, com = 0, ind = 0, off = 0, svc = 0;
    S.buildings.forEach(b => {
      if (b.kind === 'svc') { svc += C.SERVICES[b.svc].upkeep; return; }
      if (b.state !== 'live') return;
      const z = C.ZONES[b.zone], L = b.level - 1;
      if (z.cat === 'res') res += b.res * (3.0 + 0.5 * L);
      else {
        const wk = b.filled + b.outside;
        if (z.cat === 'com') com += wk * (3.4 + 0.5 * L) * (0.55 + 0.45 * Math.min(1.2, b.custRatio));
        else if (z.cat === 'ind') ind += wk * (3.2 + 0.4 * L);
        else off += wk * (4.4 + 0.6 * L);
      }
    });
    const inc = { res: res * S.tax.res / 10 / 24, com: com * S.tax.com / 10 / 24, ind: ind * S.tax.ind / 10 / 24, off: off * S.tax.off / 10 / 24 };
    let roads = 0;
    for (let i = 0; i < N; i++) {
      if (Wd.road[i] && U.inPlay(U.tx(i), U.ty(i))) { const R = C.ROADS[Wd.road[i]]; roads += R.upkeep / R.w; }
      if (Wd.pmask[i]) for (let q = 0; q < 4; q++) { const k = Wd.pcell[Wd.cellOf(i, q)]; if (k) roads += C.PATHS[k].upkeep; }
      if (Wd.rail[i]) roads += C.RAIL[Wd.rail[i]].upkeep;
    }
    let transit = 0;
    for (const l of CB.Transit.lines) transit += l.vehicles * C.TRANSIT[l.type].upkeep;
    let loans = 0; for (const l of S.loans) loans += l.payment;
    const exp = { services: svc / 24, roads: roads / 24, transit: transit / 24, utilities: S.stats.pop * 0.35 / 24, loans: loans / 24 };
    for (const k in inc) { B.inc[k] += inc[k]; S.money += inc[k]; }
    for (const k in exp) { B.exp[k] += exp[k]; S.money -= exp[k]; }
  }
  S.projected = function () {
    // monthly projection from last month, or this month's pace
    const src = S.month > 0 ? S.last : S.budget;
    let inc = 0, exp = 0;
    for (const k in src.inc) inc += src.inc[k];
    for (const k in src.exp) exp += src.exp[k];
    if (S.month === 0) { const f = 24 / Math.max(1, S.dayAcc || 0); inc *= f; exp *= f; }
    return { inc, exp, net: inc - exp };
  };
  S.takeLoan = function (amt) {
    if (S.loans.length >= 3) return false;
    const months = 24;
    S.loans.push({ amount: amt, payment: Math.round(amt * 1.12 / months), left: months });
    S.money += amt;
    S.notify('Loan of ' + U.money(amt) + ' approved.', 'good');
    return true;
  };
  S.repayLoan = function (k) {
    const l = S.loans[k]; if (!l) return false;
    const owed = l.payment * l.left;
    if (S.money < owed) return false;
    S.money -= owed; S.loans.splice(k, 1); return true;
  };
  function monthly() {
    S.last = S.budget; S.budget = blankBudget();
    for (const l of S.loans) l.left--;
    S.loans = S.loans.filter(l => l.left > 0);
    S.buildings.forEach(b => {
      if (S.isWork(b) && C.ZONES[b.zone].cat === 'com') {
        const need = Math.max(1, b.jobs * 5);
        b.custRatio = U.clamp(b.custRatio * 0.4 + (b.cust / need) * 0.6, 0, 1.5);
        b.cust = 0;
      }
    });
    CB.Transit.monthly();
    S.history.push({ pop: S.stats.pop, money: Math.round(S.money) });
    if (S.history.length > 120) S.history.shift();
    if (CB.Game && CB.Game.autosave) CB.Game.autosave();
  }

  // citizen chatter (like CS2's Chirper), driven by real city conditions
  const FIRST = ['Maya', 'Theo', 'Priya', 'Jonas', 'Aiko', 'Luis', 'Noor', 'Sam', 'Ines', 'Kofi', 'Elena', 'Ravi', 'Hana', 'Oscar', 'Lena', 'Marco'];
  function chirp() {
    const st = S.stats, Tr = CB.Traffic;
    if (st.pop < 40) return;
    const opts = [];
    if (Tr.stats.flow < 0.55) opts.push('Stuck in traffic again. Somebody please build another road or a bus line.', 'Traffic is crawling. My commute takes forever.');
    if (st.unemp > 0.12) opts.push('Still looking for work. We need more shops and factories around here.');
    if (st.happy > 70) opts.push('Honestly, ' + S.name + ' is a lovely place to live.', 'Great services in this town. Feeling lucky.');
    if (S.stats.transitShare > 0.15) opts.push('Took the ' + (CB.Transit.lines.some(l => l.type === 'rail') ? 'metro' : 'bus') + ' today. Fast and cheap!');
    if (S.icons.some(i => i.type === 'garbage')) opts.push('The garbage on my street is starting to smell.');
    if (S.cov.health && st.pop > 150 && ![...S.buildings.values()].some(b => b.svc === 'clinic' || b.svc === 'hospital')) opts.push('Is there a doctor anywhere in this city?');
    if (S.tax.res > 13) opts.push('Taxes went up again? Thinking about moving.');
    if (S.demand.rlow > 60 && st.pop < 600) opts.push('Everyone wants to move here. Zone more homes!');
    if (!opts.length) return;
    S.notify(U.pick(FIRST, S.rng) + ': "' + U.pick(opts, S.rng) + '"', 'chirp');
  }
  function checkMilestones() {
    while (S.milestone < C.MILESTONES.length - 1 && S.stats.pop >= C.MILESTONES[S.milestone + 1].pop) {
      S.milestone++;
      const m = C.MILESTONES[S.milestone];
      S.money += m.reward;
      if (CB.UI) CB.UI.milestone(m);
    }
  }

  // ------------------------------------------------------------------
  // Main step (dt in sim seconds)
  // ------------------------------------------------------------------
  S.step = function (dt) {
    const dtH = dt / C.HOUR_SEC;   // clock hours: time of day, commuting schedule
    const dtS = dt / C.SIM_SEC;    // simulation hours: growth, construction, economy
    S.hour += dtH;
    if (S.hour >= 24) S.hour -= 24;
    // construction
    S.buildings.forEach(b => {
      if (b.state === 'build') {
        b.st += dtS;
        if (b.st >= b.buildT) {
          b.state = 'live'; b.st = 0;
          CB.Meshes.refreshBuilding(b);
          b._h = 0;
          if (S.isRes(b)) moveIn(b);
          S.zoneTexDirty = true;
        }
      }
    });
    generateTrips(dtH);
    S.tickAcc += dtS;
    if (S.tickAcc >= 0.25) {
      S.tickAcc = 0;
      if (S.covDirty) computeCoverage();
      refreshLists();
      matchJobs();
      computeDemand();
      growth();
      checkMilestones();
    }
    S.hourAcc += dtS;
    if (S.hourAcc >= 1) {
      S.hourAcc -= 1;
      S.simHours = (S.simHours || 0) + 1;
      hourlyBuildings();
      hourlyEconomy();
      dispatchServices();
      if (S.simHours % 3 === 0) computeCoverage();
      if (S.rng() < 0.06 && S.hour > 7 && S.hour < 22) chirp();
    }
    S.dayAcc = (S.dayAcc || 0) + dtS;
    if (S.dayAcc >= 24) { S.dayAcc -= 24; S.month++; monthly(); }
  };

  // ------------------------------------------------------------------
  // Overlays
  // ------------------------------------------------------------------
  const ramp = v => { v = U.clamp(v, 0, 1); return v < 0.5 ? [0.9, 0.2 + v * 1.3, 0.15, 0.85] : [0.9 - (v - 0.5) * 1.5, 0.85, 0.2, 0.85]; };
  S.overlayFn = function (key) {
    const Wd = CB.World, cv = S.cov;
    const play = i => U.inPlay(U.tx(i), U.ty(i));
    switch (key) {
      case 'traffic': return i => {
        const rt = Wd.road[i]; if (!rt) return null;
        const r = U.clamp(CB.Traffic.load[i] / C.ROADS[rt].cap, 0, 1);
        return ramp(1 - r);
      };
      case 'lv': return i => play(i) ? ramp(cv.lv[i] / 70) : null;
      case 'pollution': return i => { const v = Math.min(1, cv.pollution[i]); return v > 0.03 ? [0.55 + v * 0.3, 0.42 - v * 0.2, 0.15, U.clamp(v * 1.4, 0, 0.9)] : (play(i) ? [0.3, 0.75, 0.35, 0.35] : null); };
      case 'noise': return i => { const v = cv.noise[i]; return v > 0.05 ? [0.9, 0.5 - v * 0.3, 0.9 - v * 0.6, U.clamp(v, 0, 0.9)] : null; };
      case 'happy': return i => { const b = Wd.bld[i] && S.buildings.get(Wd.bld[i]); return b && b.kind === 'zone' ? ramp(b.happy / 100) : null; };
      case 'transit': return i => play(i) ? [0.2, 0.6, 1, cv.transit[i] * 0.75] : null;
      case 'garbage': return i => {
        const b = Wd.bld[i] && S.buildings.get(Wd.bld[i]);
        if (b && b.kind === 'zone') return ramp(1 - b.garbage / 150);
        return play(i) && cv.garbage[i] > 0 ? [0.3, 0.7, 0.4, cv.garbage[i] * 0.35] : null;
      };
      default: return i => play(i) ? ramp(Math.min(1, cv[key][i])) : null;
    }
  };

  // ------------------------------------------------------------------
  // Save / load
  // ------------------------------------------------------------------
  S.serialize = function () {
    const Wd = CB.World;
    const bl = [];
    S.buildings.forEach(b => bl.push({
      id: b.id, kind: b.kind, zone: b.zone, svc: b.svc, x: b.x, y: b.y, fw: b.fw, fh: b.fh, w: b.w, d: b.d, dir: b.dir, road: b.road,
      level: b.level, state: b.state === 'fire' ? 'live' : b.state, st: b.st, buildT: b.buildT, seed: b.seed, res: b.res, cap: b.cap, jobs: b.jobs, filled: b.filled, outside: b.outside,
      work: b.work, happy: Math.round(b.happy), garbage: Math.round(b.garbage), prog: b.prog, low: b.low, abandT: b.abandT, custRatio: b.custRatio, commute: Math.round(b.commute), age: b.age,
    }));
    return {
      v: 2, seed: Wd.seed, name: S.name, money: S.money, month: S.month, hour: S.hour, dayAcc: S.dayAcc || 0, milestone: S.milestone, tax: S.tax, loans: S.loans, nextId: S.nextId,
      history: S.history, last: S.last, budget: S.budget,
      road: U.encodeRLE(Wd.road), pcell: U.encodeRLE(Wd.pcell), unseen: S.unseen || [], link: U.encodeRLE(Wd.link), rdir: U.encodeRLE(Wd.rdir), rpart: U.encodeRLE(Wd.rpart), curv: U.encodeRLE(Wd.curv),
      jcfg: Wd.clusters.map(cl => ({ t: cl.tiles[0], c: cl.cfg })), rail: U.encodeRLE(Wd.rail), zone: U.encodeRLE(Wd.zone), tree: U.encodeRLE(Wd.tree),
      buildings: bl, transit: CB.Transit.serialize(),
    };
  };
  S.load = function (d) {
    const Wd = CB.World;
    S.init({ name: d.name, seed: d.seed });
    Object.assign(S, { dayAcc: d.dayAcc || 0, money: d.money, month: d.month, hour: d.hour, milestone: d.milestone, tax: d.tax, loans: d.loans || [], nextId: d.nextId, history: d.history || [], last: d.last || blankBudget(), budget: d.budget || blankBudget() });
    Wd.road.set(U.decodeRLE(d.road, Uint8Array, N));
    Wd.link.set(U.decodeRLE(d.link, Uint8Array, N));
    Wd.rdir.set(U.decodeRLE(d.rdir, Uint8Array, N));
    Wd.rpart.set(U.decodeRLE(d.rpart, Uint8Array, N));
    if (d.curv) Wd.curv.set(U.decodeRLE(d.curv, Uint8Array, N)); else Wd.curv.fill(0);
    Wd.jcfg = new Map(); for (const j of d.jcfg || []) Wd.jcfg.set(j.t, j.c);
    if (d.pcell) Wd.pcell.set(U.decodeRLE(d.pcell, Uint8Array, C.FW * C.FW)); else Wd.pcell.fill(0);
    S.unseen = d.unseen || [];
    // old full-tile paths become four half-tile paths
    for (let i = 0; i < N; i++) {
      const R = C.ROADS[Wd.road[i]];
      if (!R || R.grp !== 'legacy') continue;
      const k = R.key === 'bikepath' ? 2 : 1;
      for (let q = 0; q < 4; q++) Wd.pcell[Wd.cellOf(i, q)] = k;
      Wd.unlinkAll(i); Wd.road[i] = 0;
    }
    Wd.rebuildPmask();
    Wd.rail.set(U.decodeRLE(d.rail, Uint8Array, N));
    Wd.zone.set(U.decodeRLE(d.zone, Uint8Array, N));
    Wd.tree.set(U.decodeRLE(d.tree, Uint8Array, N));
    Wd.joinDeadEnds();
    Wd.updateZonable(); Wd.updateConn(); Wd.updateJunctions(); Wd.roadVer++;
    for (const o of d.buildings) {
      const b = Object.assign({ cust: 0, gTarget: false, vehOut: 0, fire: 0, prob: null }, o);
      let mx = -1e9, mn = 1e9;
      for (let y = b.y; y <= b.y + b.fh; y++) for (let x = b.x; x <= b.x + b.fw; x++) { const h = Wd.cornerH(x, y); mx = Math.max(mx, h); mn = Math.min(mn, h); }
      b.baseY = Math.max(mx, C.WATER + 0.3) + 0.05; b.minY = mn;
      for (const t of lotTiles(b)) Wd.bld[t] = b.id;
      b.name = nameFor(b);
      S.buildings.set(b.id, b);
      CB.Meshes.addBuilding(b);
    }
    CB.Transit.load(d.transit);
    S.covDirty = true; S.lotsDirty = true; S.zoneTexDirty = true;
    computeCoverage();
    hourlyBuildings();
    computeDemand();
  };
})();
