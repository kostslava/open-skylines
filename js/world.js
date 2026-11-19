'use strict';
// Open Skylines — world grid, terrain generation and spatial queries
(function () {
  const { C, U } = CB;
  const W = C.W, T = C.TILE;

  const Wd = CB.World = {
    seed: 1,
    hc: null,       // corner heights (W+1)^2
    road: null,     // road type per tile
    link: null,     // bitmask of connected neighbours (N E S W)
    rdir: null,     // forward direction of the strip (0-3)
    rpart: null,    // side of the partner strip + 1 (dual carriageways), 0 = none
    jcl: null,      // junction cluster id per tile, -1 = not a junction
    clusters: [],
    jcfg: new Map(), // tile -> shared junction config object
    rail: null,     // 1 elevated, 2 subway
    zone: null,
    bld: null,      // building id per tile
    tree: null,     // tree count per tile
    zonable: null,
    conn: null,     // road tile connected to outside
    outside: [],    // outside connection road tiles
    hwRow: 0,
    roadVer: 0, railVer: 0,
  };

  Wd.init = function (seed, map) {
    Wd.seed = seed;
    Wd.map = C.MAPS.some(m => m.key === map) ? map : 'valley';
    Wd.hc = new Float32Array((W + 1) * (W + 1));
    Wd.road = new Uint8Array(W * W);
    Wd.link = new Uint8Array(W * W);
    Wd.pcell = new Uint8Array(C.FW * C.FW);
    Wd.pmask = new Uint8Array(W * W);
    Wd.rdir = new Uint8Array(W * W);
    Wd.rpart = new Uint8Array(W * W);
    Wd.curv = new Uint8Array(W * W); // 1 = part of a road drawn with the curve tool (smoothed)
    Wd.jcl = new Int32Array(W * W).fill(-1);
    Wd.clusters = []; Wd.jcfg = new Map();
    Wd.rail = new Uint8Array(W * W);
    Wd.zone = new Uint8Array(W * W);
    Wd.bld = new Int32Array(W * W);
    Wd.tree = new Uint8Array(W * W);
    Wd.zonable = new Uint8Array(W * W);
    Wd.conn = new Uint8Array(W * W);
    Wd.hcEdits = new Map(); // corner index -> height set by levelling building lots (saved with the city)
    generate(seed, Wd.map);
  };

  // Map presets. Every map keeps the highway from the west edge on flat ground so the start is the same.
  C.MAPS = [
    { key: 'valley', name: 'Alder Valley', desc: 'A river valley under northern mountains, opening onto the sea in the south.' },
    { key: 'coast', name: 'Gull Bay', desc: 'A wide bay with sandy beaches to the east and a rocky headland. Lots of waterfront.' },
    { key: 'lakes', name: 'Pine Lakes', desc: 'Rolling forest dotted with lakes. Build around the shores.' },
    { key: 'highlands', name: 'Granite Highlands', desc: 'Hilly ground cut by a winding river gorge. Plan roads with the slopes.' },
    { key: 'islands', name: 'Twin Isles', desc: 'The mainland and a big island across a strait. You will need bridges.' },
  ];
  function generate(seed, map) {
    const n1 = U.makeNoise(seed), n2 = U.makeNoise(seed + 17), n3 = U.makeNoise(seed + 91);
    const rnd = U.rng(seed * 7 + 3);
    const riverX0 = W * (0.6 + rnd() * 0.08), rp1 = rnd() * 6, rp2 = rnd() * 6;
    const hwRow = Wd.hwRow = Math.round(W * 0.5 + (rnd() - 0.5) * 20);
    const riverAt = y => riverX0 + Math.sin(y * 0.034 + rp1) * 13 + Math.sin(y * 0.012 + rp2) * 9;
    Wd.riverAt = riverAt;
    const P0 = C.P0, P1 = C.P1, mid = (P0 + P1) / 2;
    // lakes for Pine Lakes: a handful of blobs away from the highway
    const lakes = [];
    if (map === 'lakes') for (let k = 0; k < 80 && lakes.length < 9; k++) {
      const lx = P0 + 30 + rnd() * (P1 - P0 - 40), ly = P0 + 12 + rnd() * (P1 - P0 - 24), lr = 7 + rnd() * 9;
      if (Math.abs(ly - hwRow) < lr + 8 && lx < P0 + 40) continue;
      if (lakes.some(l => Math.hypot(l[0] - lx, l[1] - ly) < l[2] + lr + 10)) continue;
      lakes.push([lx, ly, lr, rnd() * 6]);
    }
    const gorgeAt = y => mid + 18 + Math.sin(y * 0.05 + rp1) * 16 + Math.sin(y * 0.021 + rp2) * 10;
    const straitAt = y => W * 0.6 + Math.sin(y * 0.03 + rp1) * 8 + Math.sin(y * 0.011 + rp2) * 5;
    for (let y = 0; y <= W; y++) {
      for (let x = 0; x <= W; x++) {
        let h = 2.6 + U.fbm(n1, x * 0.018, y * 0.018, 4) * 4.2;
        h += Math.max(0, U.fbm(n2, x * 0.03 + 50, y * 0.03, 3)) * 6;
        const ridge = () => { const r = 1 - Math.abs(U.fbm(n3, x * 0.035, y * 0.035, 4)); return r * r; };
        if (map === 'coast') {
          // headland hills to the north, the bay to the east and south-east, beaches along it
          const north = U.smooth(P0 + 14, P0 - 24, y);
          if (north > 0) h += north * (ridge() * 70 + 8);
          const shore = P1 - 52 + Math.sin(y * 0.045 + rp1) * 10 + U.fbm(n2, 7, y * 0.06, 2) * 8;
          const bayD = Math.hypot(x - (P1 - 10), (y - (mid + 26)) * 0.8) - 46;
          const sea = Math.max(U.smooth(shore - 4, shore + 10, x), U.smooth(6, -10, bayD), U.smooth(P1 - 2, P1 + 14, y));
          h = U.lerp(h, Math.min(h, 1.2), U.smooth(16, 4, Math.min(x - shore + 4, bayD + 6)) * 0.7); // flat beach strip
          h = U.lerp(h, -9, sea);
        } else if (map === 'lakes') {
          h += Math.max(0, U.fbm(n3, x * 0.04, y * 0.04, 3)) * 5;
          const east = U.smooth(P1 - 10, P1 + 24, x);
          if (east > 0) h += east * (ridge() * 50 + 8);
          for (const [lx, ly, lr, ph] of lakes) {
            const ang = Math.atan2(y - ly, x - lx), rr = lr * (1 + 0.22 * Math.sin(ang * 3 + ph) + 0.12 * Math.sin(ang * 5 + ph * 2));
            const d = Math.hypot(x - lx, y - ly) - rr;
            h = U.lerp(h, Math.min(h, 1.3), U.smooth(5, 1, d) * 0.7);
            h = U.lerp(h, -3.5, U.smooth(1, -2.5, d));
          }
        } else if (map === 'highlands') {
          h += Math.max(0, U.fbm(n3, x * 0.02 + 9, y * 0.02, 4)) * 26 + Math.abs(U.fbm(n2, x * 0.05, y * 0.05, 2)) * 4;
          const m = Math.max(U.smooth(P0 + 10, P0 - 22, y), U.smooth(P1 - 10, P1 + 22, x), U.smooth(P1 - 4, P1 + 20, y));
          if (m > 0) h += m * (ridge() * 110 + 14);
          if (y > P0 - 20) {
            const d = Math.abs(x - gorgeAt(y));
            h = U.lerp(h, Math.min(h, 3 + d * 1.1), U.smooth(14, 4, d));
            h = U.lerp(h, -4.5, U.smooth(4.5, 1.8, d));
          }
        } else if (map === 'islands') {
          const north = U.smooth(P0 + 14, P0 - 22, y);
          if (north > 0 && x > W * 0.62) h += north * (ridge() * 80 + 8);
          const ds = Math.abs(x - straitAt(y));
          h = U.lerp(h, Math.min(h, 1.4), U.smooth(9, 5, ds) * 0.6);
          h = U.lerp(h, -6.5, U.smooth(6, 3, ds));
          const sea = U.smooth(P1 - 6, P1 + 14, y + U.fbm(n2, x * 0.05, 9, 2) * 10);
          h = U.lerp(h, -9, sea);
          const islet = U.fbm(n3, x * 0.06 + 3, y * 0.06, 2); // small islets in the southern sea
          if (sea > 0.5 && islet > 0.32) h = U.lerp(h, 2.2 + (islet - 0.32) * 18, U.smooth(0.32, 0.42, islet));
        } else {
          // Alder Valley: mountains along the north and east borders, sea to the south, a river
          const north = U.smooth(P0 + 18, P0 - 22, y);
          const east = U.smooth(P1 - 16, P1 + 24, x);
          const m = Math.max(north, east * 0.9);
          if (m > 0) h += m * (ridge() * 95 + 10);
          const sea = U.smooth(P1 - 6, P1 + 14, y + U.fbm(n2, x * 0.05, 9, 2) * 10);
          h = U.lerp(h, -9, sea);
          const d = Math.abs(x - riverAt(y));
          if (y > P0 - 30) {
            const rv = U.smooth(6.5, 2.2, d) * U.smooth(P0 - 30, P0 - 10, y);
            h = U.lerp(h, -4.5, rv);
            h = U.lerp(h, Math.min(h, 1.6), U.smooth(9, 6, d) * 0.6);
          }
        }
        // highway corridor flatten
        if (x <= P0 + 26 && Math.abs(y - hwRow - 0.5) < 5) {
          const f = U.smooth(5, 2, Math.abs(y - hwRow - 0.5));
          h = U.lerp(h, Math.max(2.4, Math.min(h, 4)), f);
        }
        // the world is an island: fade every border into the sea
        const e = Math.min(x, y, W - x, W - y);
        h = U.lerp(h, -7, U.smooth(12, 1, e));
        Wd.hc[y * (W + 1) + x] = Math.max(-10, h);
      }
    }
    // trees
    for (let y = 0; y < W; y++) {
      for (let x = 0; x < W; x++) {
        const i = U.idx(x, y);
        if (Wd.isWater(i) || Wd.slope(i) > 9) continue;
        const f = U.fbm(n2, x * 0.045 + 200, y * 0.045 + 200, 3);
        const play = U.inPlay(x, y);
        const thr = (play ? 0.18 : 0.02) - (map === 'lakes' ? 0.1 : map === 'highlands' ? 0.04 : 0);
        if (f > thr) {
          const r = U.hash(x, y, seed);
          Wd.tree[i] = f > thr + 0.15 ? 3 : (r < 0.6 ? 2 : 1);
        } else if (U.hash(x, y, seed + 5) < 0.03) Wd.tree[i] = 1;
        const avg = Wd.tileAvg(i);
        if (avg > 45) Wd.tree[i] = 0; // tree line
      }
    }
    // dual carriageway highway from the west edge: north strip westbound (out), south strip eastbound (in)
    Wd.outside = [];
    const HW = C.START_HW, xe = C.P0 + 15;
    for (let x = 0; x <= xe; x++) {
      for (const [yy, dir] of [[hwRow, 3], [hwRow + 1, 1]]) {
        const i = U.idx(x, yy);
        Wd.road[i] = HW; Wd.rdir[i] = dir; Wd.rpart[i] = (yy === hwRow ? 2 : 0) + 1;
        if (x > 0) Wd.linkTiles(i, U.idx(x - 1, yy));
      }
      for (let k = -1; k <= 2; k++) Wd.tree[U.idx(x, hwRow + k)] = 0;
    }
    // a short two-way connector at the end so the player has somewhere to start
    const a = U.idx(xe + 1, hwRow), b = U.idx(xe + 1, hwRow + 1);
    for (const t of [a, b]) { Wd.road[t] = C.ROAD_BASIC; Wd.rdir[t] = 2; Wd.tree[t] = 0; }
    Wd.linkTiles(a, b); Wd.linkTiles(a, U.idx(xe, hwRow)); Wd.linkTiles(b, U.idx(xe, hwRow + 1));
    Wd.outIn = U.idx(0, hwRow + 1); Wd.outOut = U.idx(0, hwRow);
    Wd.outside.push(Wd.outIn, Wd.outOut);
    Wd.hwEnd = b;
    Wd.updateZonable();
    Wd.updateConn();
    Wd.updateJunctions();
  }

  // ---------- lot levelling ----------
  // A new building levels its lot instead of perching on the highest corner: the lot is graded to the height
  // of the road it faces (the average of the corners it shares with road tiles), and the strip of land around
  // it is eased halfway so there is no cliff. Corners under roads, paths and rail never move, so the network
  // is untouched; corners shared with a neighbouring building only ever move down to below its floor.
  Wd.setCorner = function (x, y, h) { const k = y * (W + 1) + x; Wd.hc[k] = h; Wd.hcEdits.set(k, h); };
  Wd.levelLot = function (b) {
    const S = CB.Sim;
    const tilesAt = (x, y) => { const out = []; for (const [tx, ty] of [[x - 1, y - 1], [x, y - 1], [x - 1, y], [x, y]]) if (U.inWorld(tx, ty)) out.push(U.idx(tx, ty)); return out; };
    const fixed = (x, y) => tilesAt(x, y).some(i => Wd.road[i] || Wd.pmask[i] || Wd.rail[i]);
    const x0 = b.x, y0 = b.y, x1 = b.x + b.fw, y1 = b.y + b.fh;
    let sum = 0, n = 0, all = 0, na = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const h = hcAt(x, y); all += h; na++;
      if (tilesAt(x, y).some(i => Wd.road[i] && C.ROADS[Wd.road[i]].car)) { sum += h; n++; }
    }
    const target = Math.max(n ? sum / n : all / na, C.WATER + 0.35);
    const touched = new Set();
    let changed = false;
    const setTo = (x, y, h) => {
      if (Math.abs(hcAt(x, y) - h) < 0.01) return;
      for (const i of tilesAt(x, y)) { const o = Wd.bld[i] && Wd.bld[i] !== b.id && S.buildings.get(Wd.bld[i]); if (o) { h = Math.min(h, o.baseY - 0.05); touched.add(o); } }
      if (Math.abs(hcAt(x, y) - h) < 0.01) return;
      Wd.setCorner(x, y, h); changed = true;
    };
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!fixed(x, y)) setTo(x, y, target);
    for (let y = y0 - 1; y <= y1 + 1; y++) for (let x = x0 - 1; x <= x1 + 1; x++) {
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1) continue;
      if (x < 0 || y < 0 || x > W || y > W || fixed(x, y)) continue;
      if (tilesAt(x, y).some(i => Wd.bld[i] && Wd.bld[i] !== b.id)) continue;
      setTo(x, y, (hcAt(x, y) + target) / 2);
    }
    for (const o of touched) {
      let mn = o.minY; for (let y = o.y; y <= o.y + o.fh; y++) for (let x = o.x; x <= o.x + o.fw; x++) mn = Math.min(mn, hcAt(x, y));
      if (mn < o.minY - 0.01) { o.minY = mn; CB.Meshes.refreshBuilding(o); }
    }
    if (changed) { CB.Gfx.terrainDirty = true; CB.Meshes.treesDirty = true; }
    return changed;
  };
  // How far a lot facing a curved road should turn to line up with it (radians, in the lot's own frame:
  // + turns the frontage from local +x towards +z). 0 for straight roads and square corners.
  Wd.frontAngle = function (b) {
    if (b.kind !== 'zone') return 0;
    const f = b.dir, FRm = [[1, 0, 0, 1], [0, -1, 1, 0], [-1, 0, 0, -1], [0, 1, -1, 0]][f];
    let sx = 0, sz = 0, n = 0;
    for (let y = b.y; y < b.y + b.fh; y++) for (let x = b.x; x < b.x + b.fw; x++) {
      const i = U.idx(x, y), j = Wd.neighbor(i, f);
      if (j < 0 || !Wd.road[j] || (b.x <= U.tx(j) && U.tx(j) < b.x + b.fw && b.y <= U.ty(j) && U.ty(j) < b.y + b.fh)) continue;
      if (!Wd.isBent(j)) { n++; sx += C.DX[(f + 1) % 4]; sz += C.DY[(f + 1) % 4]; continue; }
      const l2 = Wd.links2(j); if (!l2) continue;
      const dout = l2.includes(Wd.rdir[j]) ? Wd.rdir[j] : l2[1], din = ((l2[0] === dout ? l2[1] : l2[0]) + 2) % 4;
      const q = Wd.bendSeg(j, din, dout, 0, 0);
      let tx = q[4] - q[0], tz = q[5] - q[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      if (n && tx * sx + tz * sz < 0) { tx = -tx; tz = -tz; }
      sx += tx; sz += tz; n++;
    }
    if (!n) return 0;
    const lx = FRm[0] * sx + FRm[2] * sz, lz = FRm[1] * sx + FRm[3] * sz;
    let a = Math.atan2(lz, lx);
    if (a > Math.PI / 2) a -= Math.PI; if (a < -Math.PI / 2) a += Math.PI;
    if (Math.abs(a) < 0.07) return 0;
    return U.clamp(a, -0.7, 0.7);
  };
  Wd.applyEdits = function (list) {
    Wd.hcEdits = new Map();
    for (let k = 0; k + 1 < list.length; k += 2) { Wd.hc[list[k]] = list[k + 1]; Wd.hcEdits.set(list[k], list[k + 1]); }
  };

  // ---------- height queries ----------
  const hcAt = (x, y) => Wd.hc[y * (W + 1) + x];
  Wd.cornerH = hcAt;
  Wd.tileCorners = function (i) {
    const x = U.tx(i), y = U.ty(i);
    return [hcAt(x, y), hcAt(x + 1, y), hcAt(x + 1, y + 1), hcAt(x, y + 1)];
  };
  Wd.tileAvg = function (i) { const c = Wd.tileCorners(i); return (c[0] + c[1] + c[2] + c[3]) / 4; };
  Wd.tileMin = function (i) { const c = Wd.tileCorners(i); return Math.min(c[0], c[1], c[2], c[3]); };
  Wd.tileMax = function (i) { const c = Wd.tileCorners(i); return Math.max(c[0], c[1], c[2], c[3]); };
  Wd.slope = function (i) { const c = Wd.tileCorners(i); return Math.max(c[0], c[1], c[2], c[3]) - Math.min(c[0], c[1], c[2], c[3]); };
  Wd.isWater = function (i) { return Wd.tileAvg(i) < C.WATER + 0.25; };
  Wd.groundH = function (wx, wz) {
    let fx = wx / T, fy = wz / T;
    fx = U.clamp(fx, 0, W - 0.0001); fy = U.clamp(fy, 0, W - 0.0001);
    const x = Math.floor(fx), y = Math.floor(fy), u = fx - x, v = fy - y;
    // same triangulation as the terrain mesh (diagonal NE-SW)
    const a = hcAt(x, y), b = hcAt(x + 1, y), c = hcAt(x, y + 1), d = hcAt(x + 1, y + 1);
    if (u + v <= 1) return a + (b - a) * u + (c - a) * v;
    return d + (c - d) * (1 - u) + (b - d) * (1 - v);
  };
  Wd.BRIDGE_H = C.WATER + 1.7;
  Wd.roadH = function (wx, wz) {
    const x = Math.floor(wx / T), y = Math.floor(wz / T);
    if (!U.inWorld(x, y)) return Wd.groundH(wx, wz);
    const i = U.idx(x, y);
    const g = Wd.groundH(wx, wz);
    if (Wd.road[i] && Wd.isWater(i)) return Math.max(g, Wd.BRIDGE_H) + 0.12;
    return Math.max(g, Wd.road[i] ? C.WATER + 0.3 : -99) + 0.12;
  };
  Wd.deckH = function (wx, wz) {
    return Math.max(Wd.groundH(wx, wz), C.WATER + 0.5) + 7.5;
  };
  Wd.buildable = function (i) {
    const x = U.tx(i), y = U.ty(i);
    return U.inPlay(x, y) && !Wd.isWater(i) && Wd.slope(i) <= 3.6;
  };
  Wd.roadOK = function (i) {
    const x = U.tx(i), y = U.ty(i);
    if (!U.inPlay(x, y)) return false;
    if (Wd.isWater(i)) return Wd.tileMin(i) > -7;
    return Wd.slope(i) <= 6;
  };

  // ---------- network helpers ----------
  Wd.roadMask = function (i) {
    let m = Wd.link[i];
    if (i === Wd.outIn || i === Wd.outOut) m |= 8; // continues off-map to the west
    return m;
  };
  Wd.linkTiles = function (a, b) {
    const dx = U.tx(b) - U.tx(a), dy = U.ty(b) - U.ty(a);
    const d = dy < 0 ? 0 : dx > 0 ? 1 : dy > 0 ? 2 : 3;
    if (Math.abs(dx) + Math.abs(dy) !== 1) return;
    Wd.link[a] |= 1 << d; Wd.link[b] |= 1 << ((d + 2) % 4);
  };
  Wd.unlinkAll = function (i) {
    for (let d = 0; d < 4; d++) {
      if (!(Wd.link[i] & (1 << d))) continue;
      const j = Wd.neighbor(i, d); if (j >= 0) Wd.link[j] &= ~(1 << ((d + 2) % 4));
    }
    Wd.link[i] = 0;
  };
  Wd.unlinkTiles = function (a, b) {
    const dx = U.tx(b) - U.tx(a), dy = U.ty(b) - U.ty(a);
    if (Math.abs(dx) + Math.abs(dy) !== 1) return;
    const d = dy < 0 ? 0 : dx > 0 ? 1 : dy > 0 ? 2 : 3;
    Wd.link[a] &= ~(1 << d); Wd.link[b] &= ~(1 << ((d + 2) % 4));
  };
  // the two link directions of a plain corner tile (exactly two perpendicular links, not a junction), or null
  Wd.cornerLinks = function (i) {
    if (!Wd.road[i] || Wd.jcl[i] >= 0) return null;
    const m = Wd.roadMask(i); let a = -1, b = -1, n = 0;
    for (let d = 0; d < 4; d++) if (m & (1 << d)) { n++; if (a < 0) a = d; else b = d; }
    if (n !== 2 || (a + b) % 2 === 0) return null;
    return [a, b];
  };
  // the two links of a plain road tile in the middle of a chain (not a junction, not a dead end), or null
  Wd.links2 = function (i) {
    if (!Wd.road[i] || Wd.jcl[i] >= 0) return null;
    const m = Wd.roadMask(i); let a = -1, b = -1, n = 0;
    for (let d = 0; d < 4; d++) if (m & (1 << d)) { n++; if (a < 0) a = d; else b = d; }
    return n === 2 ? [a, b] : null;
  };
  const edgeMid = (i, d) => [(U.tx(i) + 0.5 + C.DX[d] * 0.5) * T, (U.ty(i) + 0.5 + C.DY[d] * 0.5) * T];
  // Smooth road centre lines. A chain of plain tiles is drawn (and driven) along a curve through smoothed
  // edge crossing points: each crossing is the average of the raw edge midpoints around it, with the window
  // shrinking near junctions and dead ends so the road still meets them square.
  const eiCache = new Map(); let eiVer = -1;
  // walk along a chain from tile t leaving through side d; returns the raw edge midpoints crossed (up to n)
  function walkEdges(t, d, n) {
    const out = [];
    let cur = t, side = d;
    for (let k = 0; k < n; k++) {
      const l = Wd.links2(cur); if (!l || !l.includes(side) || !Wd.curv[cur]) break;
      const nx = Wd.neighbor(cur, side); if (nx < 0 || !Wd.curv[nx]) break;
      out.push(edgeMid(cur, side));
      const ln = Wd.links2(nx); if (!ln) break;
      side = ln[0] === (side + 2) % 4 ? ln[1] : ln[0]; cur = nx;
    }
    return out;
  }
  Wd.clearEdgeCache = () => { eiCache.clear(); eiVer = Wd.roadVer; };
  Wd.edgeInfo = function (i, d) {
    if (eiVer !== Wd.roadVer) { eiCache.clear(); eiVer = Wd.roadVer; }
    const key = i * 4 + d, hit = eiCache.get(key); if (hit) return hit;
    const m = edgeMid(i, d);
    let res = [m[0], m[1], C.DX[d], C.DY[d]];
    const j = Wd.neighbor(i, d), li = Wd.links2(i), lj = j >= 0 && Wd.links2(j);
    if (li && lj && li.includes(d) && Wd.curv[i] && Wd.curv[j]) {
      const other = li[0] === d ? li[1] : li[0], jo = lj[0] === (d + 2) % 4 ? lj[1] : lj[0];
      const back = walkEdges(i, other, 3), fwd = walkEdges(j, jo, 3); // points behind (through i) and ahead (through j)
      const r = Math.min(back.length, fwd.length, 2);
      if (r > 0) {
        let sx = m[0] * 3, sz = m[1] * 3, sw = 3;
        for (let k = 0; k < r; k++) { const w = 2 - k; sx += (back[k][0] + fwd[k][0]) * w; sz += (back[k][1] + fwd[k][1]) * w; sw += 2 * w; }
        const rb = Math.min(back.length, 2), rf = Math.min(fwd.length, 2);
        const a = back[rb - 1], b = fwd[rf - 1];
        let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1;
        res = [sx / sw, sz / sw, tx / l, tz / l];
      }
    }
    eiCache.set(key, res);
    return res;
  };
  // is the road through this tile bent (a corner, or part of a curve)?
  Wd.isBent = function (i) {
    if (!Wd.curv[i]) return false; // plain corners stay square; only roads drawn as curves are smoothed
    const l = Wd.links2(i); if (!l) return false;
    if ((l[0] + l[1]) % 2 === 1) return true;
    for (const d of l) {
      const e = Wd.edgeInfo(i, d), m = edgeMid(i, d);
      if (Math.abs(e[2] - C.DX[d]) + Math.abs(e[3] - C.DY[d]) > 0.02 || Math.abs(e[0] - m[0]) + Math.abs(e[1] - m[1]) > 0.05) return true;
    }
    return false;
  };
  // path through bent tile i travelling in on din and out through dout, offset sideways (+ = right) by
  // offIn / offOut. Returns [ex, ez, qx, qz, xx, xz]: a quadratic curve fitted to the smooth centre line.
  Wd.bendSeg = function (i, din, dout, offIn, offOut) {
    const a = Wd.edgeInfo(i, (din + 2) % 4), b = Wd.edgeInfo(i, dout);
    const ax = -a[2], az = -a[3], bx = b[2], bz = b[3];          // travel tangents at entry and exit
    const ex = a[0] - az * offIn, ez = a[1] + ax * offIn, xx = b[0] - bz * offOut, xz = b[1] + bx * offOut;
    const L = Math.hypot(xx - ex, xz - ez) / 3;
    const p1x = ex + ax * L, p1z = ez + az * L, p2x = xx - bx * L, p2z = xz - bz * L;
    return [ex, ez, (3 * (p1x + p2x) - (ex + xx)) / 4, (3 * (p1z + p2z) - (ez + xz)) / 4, xx, xz];
  };
  // a link straight across the median between the two strips of a dual carriageway (a U-turn at a dead end)
  Wd.isUturnLink = function (a, d) {
    const b = Wd.neighbor(a, d); if (b < 0) return false;
    const Ra = C.ROADS[Wd.road[a]], Rb = C.ROADS[Wd.road[b]];
    if (!Ra || !Rb || Ra.w !== 2 || Rb.w !== 2) return false;
    if (Wd.linked(a, (d + 2) % 4) || Wd.linked(b, d)) return false; // a street crossing the avenue, not a U-turn
    return (Wd.rdir[a] % 2) !== (d % 2) && Wd.rdir[b] === (Wd.rdir[a] + 2) % 4;
  };
  // older saves: roads that end right against another road get joined to it
  Wd.joinDeadEnds = function () {
    for (let i = 0; i < W * W; i++) {
      if (!Wd.road[i] || !C.ROADS[Wd.road[i]].car) continue;
      const m = Wd.link[i];
      let n = 0, d0 = -1; for (let d = 0; d < 4; d++) if (m & (1 << d)) { n++; d0 = d; }
      if (n > 1) continue;
      const dirs = n === 1 ? [(d0 + 2) % 4] : [0, 1, 2, 3];
      for (const d of dirs) { const o = Wd.neighbor(i, d); if (o >= 0 && Wd.road[o] && C.ROADS[Wd.road[o]].car && !(Wd.rpart[i] && Wd.rpart[i] - 1 === d)) { Wd.linkTiles(i, o); break; } }
    }
  };
  // ---------- half-tile paths ----------
  const FW = C.FW;
  Wd.fidx = (fx, fy) => fy * FW + fx;
  Wd.cellOf = (i, q) => Wd.fidx(U.tx(i) * 2 + (q & 1), U.ty(i) * 2 + (q >> 1));
  Wd.setPath = function (f, k) {
    Wd.pcell[f] = k;
    const fx = f % FW, fy = (f / FW) | 0, i = U.idx(fx >> 1, fy >> 1), q = (fy & 1) * 2 + (fx & 1);
    if (k) Wd.pmask[i] |= 1 << q; else Wd.pmask[i] &= ~(1 << q);
  };
  Wd.rebuildPmask = function () {
    Wd.pmask.fill(0);
    for (let f = 0; f < FW * FW; f++) if (Wd.pcell[f]) { const fx = f % FW, fy = (f / FW) | 0; Wd.pmask[U.idx(fx >> 1, fy >> 1)] |= 1 << ((fy & 1) * 2 + (fx & 1)); }
  };
  Wd.walkRoad = i => { const R = C.ROADS[Wd.road[i]]; return !!R && R.grp !== 'highway' && R.grp !== 'legacy'; };
  // the two cell pairs straddling the edge between tile i and its neighbour in direction d: [[cellInI, cellInJ], ...]
  Wd.edgeCells = function (i, d) {
    const x = U.tx(i) * 2, y = U.ty(i) * 2;
    if (d === 1) return [[Wd.fidx(x + 1, y), Wd.fidx(x + 2, y)], [Wd.fidx(x + 1, y + 1), Wd.fidx(x + 2, y + 1)]];
    if (d === 3) return [[Wd.fidx(x, y), Wd.fidx(x - 1, y)], [Wd.fidx(x, y + 1), Wd.fidx(x - 1, y + 1)]];
    if (d === 2) return [[Wd.fidx(x, y + 1), Wd.fidx(x, y + 2)], [Wd.fidx(x + 1, y + 1), Wd.fidx(x + 1, y + 2)]];
    return [[Wd.fidx(x, y), Wd.fidx(x, y - 1)], [Wd.fidx(x + 1, y), Wd.fidx(x + 1, y - 1)]];
  };
  // can a pedestrian / cyclist cross from tile i into its neighbour in direction d?
  Wd.softPass = function (i, d) {
    const j = Wd.neighbor(i, d); if (j < 0) return -1;
    const ri = Wd.walkRoad(i), rj = Wd.walkRoad(j);
    if (ri && rj) return 0;
    if (!Wd.pmask[i] && !Wd.pmask[j]) return -1;
    for (const [a, b] of Wd.edgeCells(i, d)) {
      const ok = (Wd.pcell[a] || ri) && (Wd.pcell[b] || rj) && (Wd.pcell[a] || Wd.pcell[b]);
      if (ok) return 1;
    }
    return -1;
  };
  Wd.linked = (i, d) => (Wd.link[i] & (1 << d)) !== 0;
  // forward lanes only (one-way strip)?
  Wd.isOneway = function (i) { const R = C.ROADS[Wd.road[i]]; return !!R && (R.oneway || R.w === 2); };
  // Can a vehicle (car) step from i to its neighbour in direction d?
  Wd.canDrive = function (i, d) {
    if (!(Wd.roadMask(i) & (1 << d))) return false;
    const j = Wd.neighbor(i, d); if (j < 0) return false;
    const Rj = C.ROADS[Wd.road[j]]; if (!Rj || !Rj.car) return false;
    const op = (d + 2) % 4;
    if (Wd.isOneway(i) && Wd.jcl[i] < 0 && Wd.rdir[i] === op) return false;
    if (Wd.isOneway(j) && Wd.jcl[j] < 0 && Wd.rdir[j] === op) return false;
    return true;
  };
  Wd.railMask = function (i) {
    const x = U.tx(i), y = U.ty(i); let m = 0;
    for (let d = 0; d < 4; d++) {
      const nx = x + C.DX[d], ny = y + C.DY[d];
      if (U.inWorld(nx, ny) && Wd.rail[U.idx(nx, ny)]) m |= 1 << d;
    }
    return m;
  };
  Wd.degree = function (i) {
    const m = Wd.roadMask(i); let c = 0;
    for (let d = 0; d < 4; d++) if (m & (1 << d)) c++;
    return c;
  };

  Wd.updateZonable = function () {
    const z = Wd.zonable; z.fill(0);
    for (let i = 0; i < W * W; i++) {
      const r = Wd.road[i];
      if (!r || !C.ROADS[r].zonable) continue;
      const x = U.tx(i), y = U.ty(i);
      for (let d = 0; d < 4; d++) {
        for (let k = 1; k <= 3; k++) {
          const nx = x + C.DX[d] * k, ny = y + C.DY[d] * k;
          if (!U.inPlay(nx, ny)) break;
          const j = U.idx(nx, ny);
          if (Wd.road[j] || Wd.pmask[j]) break;
          if (!Wd.buildable(j) || Wd.rail[j] === 1) break;
          z[j] = 1;
        }
      }
    }
  };

  Wd.updateConn = function () {
    const c = Wd.conn; c.fill(0);
    const q = [];
    for (const o of Wd.outside) if (Wd.road[o]) { c[o] = 1; q.push(o); }
    while (q.length) {
      const i = q.pop();
      for (let d = 0; d < 4; d++) {
        if (!Wd.linked(i, d)) continue;
        const j = Wd.neighbor(i, d);
        if (j >= 0 && Wd.road[j] && !c[j]) { c[j] = 1; q.push(j); }
      }
    }
  };

  // ---------- junction clusters ----------
  // A junction is a road tile with 3+ connections. Touching junction tiles form one intersection.
  Wd.TURN = { S: 1, R: 2, L: 4, U: 8 };
  Wd.relTurn = (din, dout) => [1, 2, 8, 4][(dout - din + 4) % 4];
  Wd.updateJunctions = function () {
    const N = W * W, jcl = Wd.jcl; jcl.fill(-1);
    const old = Wd.jcfg; Wd.jcfg = new Map();
    Wd.clusters = [];
    for (let i = 0; i < N; i++) {
      if (!Wd.road[i] || jcl[i] >= 0 || Wd.degree(i) < 3) continue;
      const id = Wd.clusters.length, tiles = [i], q = [i]; jcl[i] = id;
      while (q.length) {
        const t = q.pop();
        for (let d = 0; d < 4; d++) {
          if (!Wd.linked(t, d)) continue;
          const j = Wd.neighbor(t, d);
          if (j >= 0 && jcl[j] < 0 && Wd.road[j] && Wd.degree(j) >= 3) { jcl[j] = id; tiles.push(j); q.push(j); }
        }
      }
      Wd.clusters.push({ id, tiles });
    }
    for (const cl of Wd.clusters) {
      // approaches (traffic entering) and exits
      cl.aps = []; cl.exits = []; let rank = 0, cars = false, cx = 0, cy = 0;
      for (const t of cl.tiles) {
        cx += U.tx(t); cy += U.ty(t);
        for (let d = 0; d < 4; d++) {
          if (!Wd.linked(t, d)) continue;
          const o = Wd.neighbor(t, d); if (o < 0 || jcl[o] === cl.id) continue;
          const Ro = C.ROADS[Wd.road[o]]; rank = Math.max(rank, C.GRP_RANK[Ro.grp]); if (Ro.car) cars = true;
          const din = (d + 2) % 4;
          if (Ro.car && Wd.canDrive(o, din)) cl.aps.push({ tile: o, into: t, d: din, key: o * 4 + din, lanes: Wd.lanesToward(o, din).length });
          if (Ro.car && Wd.canDrive(t, d)) cl.exits.push({ tile: o, from: t, d });
        }
      }
      cl.cx = cx / cl.tiles.length + 0.5; cl.cy = cy / cl.tiles.length + 0.5;
      cl.rank = rank; cl.cars = cars;
      let cfg = null;
      for (const t of cl.tiles) if (old.has(t)) { cfg = old.get(t); break; }
      if (!cfg) cfg = { ctrl: 'auto', stops: {}, lanes: {} };
      cl.cfg = cfg;
      for (const t of cl.tiles) Wd.jcfg.set(t, cfg);
      // available turns per entry direction
      cl.avail = [0, 0, 0, 0];
      for (const ap of cl.aps) for (const ex of cl.exits) cl.avail[ap.d] |= Wd.relTurn(ap.d, ex.d);
      for (const ap of cl.aps) {
        const cur = cfg.lanes[ap.key];
        if (!cur || cur.length !== ap.lanes || cur.some(m => !(m & cl.avail[ap.d]))) cfg.lanes[ap.key] = Wd.defaultLanes(ap.lanes, cl.avail[ap.d]);
      }
      cl.mask = [0, 0, 0, 0];
      for (const ap of cl.aps) for (const m of cfg.lanes[ap.key]) cl.mask[ap.d] |= m;
      cl.ctrl = Wd.ctrlOf(cl);
      cl.phase = 0; cl.pt = Math.random() * 8;
    }
  };
  Wd.ctrlOf = function (cl) {
    const c = cl.cfg.ctrl;
    if (c !== 'auto') return c;
    if (!cl.cars || cl.aps.length < 3) return 'none';
    return cl.rank >= 2 ? 'lights' : 'none';
  };
  Wd.defaultLanes = function (n, avail) {
    const { S, R, L, U: UT } = Wd.TURN;
    const out = [];
    if (n <= 1) out.push(S | R | L);
    else if (n === 2) out.push(S | R, L | S);
    else { out.push(R | S); for (let k = 1; k < n - 1; k++) out.push(S); out.push(L); }
    for (let k = 0; k < out.length; k++) { out[k] &= avail; if (!out[k]) out[k] = avail & (S | R | L) || avail; }
    // every available turn must be served by some lane
    for (const t of [S, R, L]) if ((avail & t) && !out.some(m => m & t)) { if (t === R) out[0] |= t; else out[out.length - 1] |= t; }
    if (!(avail & (S | R | L)) && (avail & UT)) out[out.length - 1] |= UT;
    return out;
  };
  // lane offsets (traveller frame, + = right) for a vehicle on tile i moving in direction d
  Wd.lanesToward = function (i, d) {
    const R = C.ROADS[Wd.road[i]]; if (!R) return [1.6];
    const L = R.L;
    if (!R.car) return [0];
    if (R.oneway || R.w === 2 || !L.back.length) return L.fwd;
    const f = Wd.rdir[i];
    if (d === (f + 2) % 4) return L.back;
    if (d === f) return L.fwd;
    return R.back > R.fwd ? L.back : L.fwd;
  };

  Wd.neighbor = function (i, d) {
    const x = U.tx(i) + C.DX[d], y = U.ty(i) + C.DY[d];
    return U.inWorld(x, y) ? U.idx(x, y) : -1;
  };
  Wd.center = function (i) { return [(U.tx(i) + 0.5) * T, (U.ty(i) + 0.5) * T]; };
})();
