'use strict';
// Arterial — core config, constants and utilities
window.CB = {};
(function () {
  const C = CB.C = {
    TILE: 10,          // metres per tile
    W: 208,            // world tiles per side (incl. scenic border)
    PAD: 32,           // scenic border (not buildable)
    N: 144,            // playable tiles per side
    WATER: 0,
    HOUR_SEC: 10,      // real seconds per game hour at 1x
    CHUNK: 16,
    VEH_SPEED: 1.8,    // visual speed multiplier for agents
    START_MONEY: 80000,
    WALK_R: 16,        // tiles people will walk to a stop
    SAVE_KEY: 'arterial.save.v1',
    SET_KEY: 'arterial.settings.v1',
  };
  C.P0 = C.PAD; C.P1 = C.PAD + C.N;
  C.DX = [0, 1, 0, -1]; C.DY = [-1, 0, 1, 0]; // N E S W (y grows south / +z)
  C.WORLD = C.W * C.TILE;

  // ---------- Roads ----------
  C.ROADS = [null,
    { key: 'street', name: 'Small Road', desc: 'Two-lane local street. Buildings can grow along it.', speed: 12, lanes: 1, cost: 25, upkeep: 0.5, zonable: true, sidewalk: 1.8, unlock: 0, cap: 4, off: [1.6] },
    { key: 'avenue', name: 'Avenue', desc: 'Four lanes. Carries about twice the traffic of a small road.', speed: 16, lanes: 2, cost: 60, upkeep: 1.2, zonable: true, sidewalk: 0.9, unlock: 0, cap: 7, off: [1.1, 3.1] },
    { key: 'highway', name: 'Highway', desc: 'Fast four-lane road. No buildings can face it.', speed: 26, lanes: 2, cost: 140, upkeep: 2.5, zonable: false, sidewalk: 0, unlock: 2, cap: 9, off: [1.35, 3.65] },
  ];

  // ---------- Zones ----------
  C.ZONES = [null,
    { key: 'rlow', name: 'Low Density Residential', short: 'Res · Low', cat: 'res', color: '#5fcf5a', unlock: 0, lots: [[1, 2]], cap: [3, 4, 4, 5, 6], perBuilding: true },
    { key: 'rmed', name: 'Medium Density Residential', short: 'Res · Medium', cat: 'res', color: '#2f9e48', unlock: 1, lots: [[1, 2], [2, 2]], cap: [8, 9, 11, 13, 15] },
    { key: 'rhigh', name: 'High Density Residential', short: 'Res · High', cat: 'res', color: '#167a3a', unlock: 4, lots: [[2, 2], [2, 3]], cap: [18, 23, 28, 34, 40] },
    { key: 'clow', name: 'Low Density Commercial', short: 'Com · Low', cat: 'com', color: '#59a6f5', unlock: 0, lots: [[1, 2], [2, 2]], cap: [2, 3, 3, 4, 5] },
    { key: 'chigh', name: 'High Density Commercial', short: 'Com · High', cat: 'com', color: '#2b62d9', unlock: 2, lots: [[2, 2], [2, 3]], cap: [5, 6, 8, 9, 11] },
    { key: 'ind', name: 'Industrial', short: 'Industry', cat: 'ind', color: '#f0c43a', unlock: 0, lots: [[2, 2], [2, 3], [3, 3]], cap: [3, 3, 4, 4, 5] },
    { key: 'office', name: 'Office', short: 'Office', cat: 'off', color: '#b276f2', unlock: 3, lots: [[2, 2], [2, 3]], cap: [8, 10, 12, 14, 17] },
  ];
  C.LV_REQ = [0, 18, 32, 46, 60]; // land value needed to reach level n+1

  // ---------- Services, parks, landmarks ----------
  C.SERVICES = {
    police: { name: 'Police Station', cat: 'services', size: [2, 2], cost: 6000, upkeep: 350, radius: 14, cov: 'police', unlock: 0, veh: 'police', vehCount: 2, desc: 'Patrols reduce crime nearby.' },
    policehq: { name: 'Police Headquarters', cat: 'services', size: [3, 3], cost: 18000, upkeep: 900, radius: 26, cov: 'police', unlock: 3, veh: 'police', vehCount: 5, desc: 'Large police coverage.' },
    fire: { name: 'Fire Station', cat: 'services', size: [2, 2], cost: 6000, upkeep: 350, radius: 15, cov: 'fire', unlock: 0, veh: 'fire', vehCount: 2, desc: 'Fire trucks put out fires before buildings burn down.' },
    clinic: { name: 'Medical Clinic', cat: 'services', size: [2, 2], cost: 5000, upkeep: 300, radius: 13, cov: 'health', unlock: 0, veh: 'ambulance', vehCount: 1, desc: 'Keeps residents healthy and happy.' },
    hospital: { name: 'Hospital', cat: 'services', size: [3, 3], cost: 20000, upkeep: 1100, radius: 28, cov: 'health', unlock: 3, veh: 'ambulance', vehCount: 4, desc: 'Large health coverage.' },
    elem: { name: 'Elementary School', cat: 'services', size: [2, 2], cost: 7000, upkeep: 380, radius: 13, cov: 'edu', unlock: 0, desc: 'Education raises land value and enables offices.' },
    high: { name: 'High School', cat: 'services', size: [3, 3], cost: 14000, upkeep: 700, radius: 20, cov: 'edu', unlock: 2, desc: 'Wider education coverage.' },
    univ: { name: 'University', cat: 'services', size: [4, 4], cost: 35000, upkeep: 1600, radius: 34, cov: 'edu', unlock: 4, desc: 'Big boost to education and office demand.' },
    garbage: { name: 'Waste Transfer Station', cat: 'services', size: [3, 2], cost: 7000, upkeep: 400, radius: 30, cov: 'garbage', unlock: 0, veh: 'garbage', vehCount: 6, pollute: 0.5, desc: 'Garbage trucks collect from buildings in range.' },
    park: { name: 'Pocket Park', cat: 'parks', size: [1, 1], cost: 800, upkeep: 25, radius: 6, cov: 'park', unlock: 0, desc: 'Small green space. Raises happiness and land value.' },
    plaza: { name: 'Town Plaza', cat: 'parks', size: [2, 2], cost: 2500, upkeep: 70, radius: 9, cov: 'park', unlock: 1, desc: 'Paved square with a fountain.' },
    bigpark: { name: 'Central Park', cat: 'parks', size: [4, 4], cost: 9000, upkeep: 220, radius: 15, cov: 'park', unlock: 4, desc: 'Large park with a pond.' },
    stadium: { name: 'Stadium', cat: 'landmarks', size: [4, 4], cost: 60000, upkeep: 1500, radius: 30, cov: 'landmark', unlock: 5, desc: 'Attracts visitors citywide.' },
    tower: { name: 'Observation Tower', cat: 'landmarks', size: [2, 2], cost: 45000, upkeep: 800, radius: 26, cov: 'landmark', unlock: 5, desc: 'A city icon. Raises land value.' },
    arch: { name: 'Grand Arch', cat: 'landmarks', size: [3, 3], cost: 120000, upkeep: 1000, radius: 40, cov: 'landmark', unlock: 6, desc: 'Monument to a great metropolis.' },
  };

  C.TRANSIT = {
    bus: { name: 'Bus', speed: 10, cap: 30, upkeep: 90, fare: 2, stopCost: 250, unlock: 1, len: 10 },
    rail: { name: 'Train / Metro', speed: 24, cap: 160, upkeep: 600, fare: 3, stopCost: 7000, ugStopCost: 11000, unlock: 3, len: 14 },
  };
  C.RAIL = [null,
    { key: 'elev', name: 'Elevated Track', cost: 160, upkeep: 1.5, desc: 'Track on a viaduct. Can cross roads and water.' },
    { key: 'sub', name: 'Subway Tunnel', cost: 320, upkeep: 2.5, desc: 'Underground track. Nothing on the surface is affected.' },
  ];

  C.MILESTONES = [
    { name: 'Settlement', pop: 0, reward: 0, unlocks: '' },
    { name: 'Village', pop: 250, reward: 15000, unlocks: 'Medium density housing, bus lines, Town Plaza' },
    { name: 'Town', pop: 800, reward: 25000, unlocks: 'Highways, high density commercial, High School' },
    { name: 'Small City', pop: 2000, reward: 40000, unlocks: 'Trains & metro, offices, Hospital, Police HQ' },
    { name: 'City', pop: 4000, reward: 60000, unlocks: 'High density housing, University, Central Park' },
    { name: 'Big City', pop: 8000, reward: 90000, unlocks: 'Stadium, Observation Tower' },
    { name: 'Metropolis', pop: 15000, reward: 150000, unlocks: 'Grand Arch' },
  ];

  C.QUALITY = {
    low: { res: 0.7, shadows: 0, aa: false, view: 1100, cars: 250, trees: 0.35, lighting: 'simple', water: 'simple' },
    medium: { res: 1, shadows: 1024, aa: true, view: 1700, cars: 500, trees: 0.7, lighting: 'pbr', water: 'simple' },
    high: { res: 1.25, shadows: 2048, aa: true, view: 2400, cars: 900, trees: 1, lighting: 'pbr', water: 'waves' },
    ultra: { res: 2, shadows: 4096, aa: true, view: 3200, cars: 1400, trees: 1.4, lighting: 'pbr', water: 'waves' },
  };

  // ---------- Utils ----------
  const U = CB.U = {};
  const W = C.W;
  U.idx = (x, y) => y * W + x;
  U.tx = i => i % W;
  U.ty = i => (i / W) | 0;
  U.inWorld = (x, y) => x >= 0 && y >= 0 && x < W && y < W;
  U.inPlay = (x, y) => x >= C.P0 && y >= C.P0 && x < C.P1 && y < C.P1;
  U.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.smooth = (e0, e1, x) => { const t = U.clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  U.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };
  U.hash = function (x, y, s) {
    let h = (x * 374761393 + y * 668265263 + (s || 0) * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967296;
  };
  U.lin = v => Math.pow(v, 2.2);
  U.hex = function (h) {
    const n = parseInt(h.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  };
  U.money = function (n) {
    const s = Math.round(Math.abs(n)).toLocaleString('en-US');
    return (n < 0 ? '-$' : '$') + s;
  };
  U.num = n => Math.round(n).toLocaleString('en-US');
  U.dist = (a, b) => Math.abs(U.tx(a) - U.tx(b)) + Math.abs(U.ty(a) - U.ty(b));
  U.pick = (arr, r) => arr[Math.floor((r || Math.random)() * arr.length)];

  U.makeNoise = function (seed) {
    const rnd = U.rng(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
    const perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    const g = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
    const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
    return function (xin, yin) {
      let n0 = 0, n1 = 0, n2 = 0;
      const s = (xin + yin) * F2;
      const i = Math.floor(xin + s), j = Math.floor(yin + s);
      const t = (i + j) * G2;
      const x0 = xin - (i - t), y0 = yin - (j - t);
      const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
      const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
      const ii = i & 255, jj = j & 255;
      let t0 = 0.5 - x0 * x0 - y0 * y0;
      if (t0 > 0) { const q = g[perm[ii + perm[jj]] & 7]; t0 *= t0; n0 = t0 * t0 * (q[0] * x0 + q[1] * y0); }
      let t1 = 0.5 - x1 * x1 - y1 * y1;
      if (t1 > 0) { const q = g[perm[ii + i1 + perm[jj + j1]] & 7]; t1 *= t1; n1 = t1 * t1 * (q[0] * x1 + q[1] * y1); }
      let t2 = 0.5 - x2 * x2 - y2 * y2;
      if (t2 > 0) { const q = g[perm[ii + 1 + perm[jj + 1]] & 7]; t2 *= t2; n2 = t2 * t2 * (q[0] * x2 + q[1] * y2); }
      return 70 * (n0 + n1 + n2);
    };
  };
  U.fbm = function (nf, x, y, oct) {
    let a = 1, f = 1, s = 0, n = 0;
    for (let o = 0; o < oct; o++) { s += nf(x * f, y * f) * a; n += a; a *= 0.5; f *= 2.03; }
    return s / n;
  };

  U.Heap = class {
    constructor() { this.ids = []; this.pr = []; }
    get size() { return this.ids.length; }
    clear() { this.ids.length = 0; this.pr.length = 0; }
    push(id, p) {
      const a = this.ids, b = this.pr; let i = a.length; a.push(id); b.push(p);
      while (i > 0) { const q = (i - 1) >> 1; if (b[q] <= p) break; a[i] = a[q]; b[i] = b[q]; i = q; }
      a[i] = id; b[i] = p;
    }
    pop() {
      const a = this.ids, b = this.pr; const top = a[0];
      const lid = a.pop(), lp = b.pop(); const n = a.length;
      if (n > 0) {
        let i = 0;
        for (;;) {
          const l = 2 * i + 1; if (l >= n) break;
          const r = l + 1; const m = (r < n && b[r] < b[l]) ? r : l;
          if (b[m] >= lp) break;
          a[i] = a[m]; b[i] = b[m]; i = m;
        }
        a[i] = lid; b[i] = lp;
      }
      return top;
    }
  };

  // Base64 helpers for save files (with simple RLE for sparse arrays)
  U.encodeRLE = function (arr) {
    const out = [];
    for (let i = 0; i < arr.length;) {
      const v = arr[i]; let n = 1;
      while (i + n < arr.length && arr[i + n] === v && n < 65535) n++;
      out.push(v, n); i += n;
    }
    return out.join(',');
  };
  U.decodeRLE = function (str, Type, len) {
    const a = new Type(len); const parts = str.split(',');
    let k = 0;
    for (let i = 0; i < parts.length; i += 2) {
      const v = +parts[i], n = +parts[i + 1];
      for (let j = 0; j < n && k < len; j++) a[k++] = v;
    }
    return a;
  };
})();
