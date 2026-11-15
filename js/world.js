'use strict';
// Arterial — world grid, terrain generation and spatial queries
(function () {
  const { C, U } = CB;
  const W = C.W, T = C.TILE;

  const Wd = CB.World = {
    seed: 1,
    hc: null,       // corner heights (W+1)^2
    road: null,     // road type per tile
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

  Wd.init = function (seed) {
    Wd.seed = seed;
    Wd.hc = new Float32Array((W + 1) * (W + 1));
    Wd.road = new Uint8Array(W * W);
    Wd.rail = new Uint8Array(W * W);
    Wd.zone = new Uint8Array(W * W);
    Wd.bld = new Int32Array(W * W);
    Wd.tree = new Uint8Array(W * W);
    Wd.zonable = new Uint8Array(W * W);
    Wd.conn = new Uint8Array(W * W);
    generate(seed);
  };

  function generate(seed) {
    const n1 = U.makeNoise(seed), n2 = U.makeNoise(seed + 17), n3 = U.makeNoise(seed + 91);
    const rnd = U.rng(seed * 7 + 3);
    const riverX0 = W * (0.6 + rnd() * 0.08), rp1 = rnd() * 6, rp2 = rnd() * 6;
    const hwRow = Wd.hwRow = Math.round(W * 0.5 + (rnd() - 0.5) * 20);
    const riverAt = y => riverX0 + Math.sin(y * 0.034 + rp1) * 13 + Math.sin(y * 0.012 + rp2) * 9;
    Wd.riverAt = riverAt;
    for (let y = 0; y <= W; y++) {
      for (let x = 0; x <= W; x++) {
        let h = 2.6 + U.fbm(n1, x * 0.018, y * 0.018, 4) * 4.2;
        // gentle hills
        h += Math.max(0, U.fbm(n2, x * 0.03 + 50, y * 0.03, 3)) * 6;
        // mountains along the north and east borders
        const north = U.smooth(C.P0 + 18, C.P0 - 22, y);
        const east = U.smooth(C.P1 - 16, C.P1 + 24, x);
        const m = Math.max(north, east * 0.9);
        if (m > 0) {
          const ridge = 1 - Math.abs(U.fbm(n3, x * 0.035, y * 0.035, 4));
          h += m * (ridge * ridge * 95 + 10);
        }
        // southern sea
        const sea = U.smooth(C.P1 - 6, C.P1 + 14, y + U.fbm(n2, x * 0.05, 9, 2) * 10);
        h = U.lerp(h, -9, sea);
        // river
        const d = Math.abs(x - riverAt(y));
        if (y > C.P0 - 30) {
          const rv = U.smooth(6.5, 2.2, d) * U.smooth(C.P0 - 30, C.P0 - 10, y);
          h = U.lerp(h, -4.5, rv);
          // flatten banks a bit
          h = U.lerp(h, Math.min(h, 1.6), U.smooth(9, 6, d) * 0.6);
        }
        // highway corridor flatten
        if (x <= C.P0 + 26 && Math.abs(y - hwRow - 0.5) < 5) {
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
        const thr = play ? 0.18 : 0.02;
        if (f > thr) {
          const r = U.hash(x, y, seed);
          Wd.tree[i] = f > thr + 0.15 ? 3 : (r < 0.6 ? 2 : 1);
        } else if (U.hash(x, y, seed + 5) < 0.03) Wd.tree[i] = 1;
        const avg = Wd.tileAvg(i);
        if (avg > 45) Wd.tree[i] = 0; // tree line
      }
    }
    // highway from the west edge
    Wd.outside = [];
    for (let x = 0; x <= C.P0 + 16; x++) {
      const i = U.idx(x, hwRow);
      Wd.road[i] = 3; Wd.tree[i] = 0;
      Wd.tree[U.idx(x, hwRow - 1)] = 0; Wd.tree[U.idx(x, hwRow + 1)] = 0;
    }
    Wd.outside.push(U.idx(0, hwRow));
    Wd.updateZonable();
    Wd.updateConn();
  }

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
    const x = U.tx(i), y = U.ty(i); let m = 0;
    for (let d = 0; d < 4; d++) {
      const nx = x + C.DX[d], ny = y + C.DY[d];
      if (U.inWorld(nx, ny) && Wd.road[U.idx(nx, ny)]) m |= 1 << d;
    }
    // outside connection: edge tile connects off-map
    if (Wd.outside.indexOf(i) >= 0) m |= 8;
    return m;
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
          if (Wd.road[j]) break;
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
      const i = q.pop(); const x = U.tx(i), y = U.ty(i);
      for (let d = 0; d < 4; d++) {
        const nx = x + C.DX[d], ny = y + C.DY[d];
        if (!U.inWorld(nx, ny)) continue;
        const j = U.idx(nx, ny);
        if (Wd.road[j] && !c[j]) { c[j] = 1; q.push(j); }
      }
    }
  };

  Wd.neighbor = function (i, d) {
    const x = U.tx(i) + C.DX[d], y = U.ty(i) + C.DY[d];
    return U.inWorld(x, y) ? U.idx(x, y) : -1;
  };
  Wd.center = function (i) { return [(U.tx(i) + 0.5) * T, (U.ty(i) + 0.5) * T]; };
})();
