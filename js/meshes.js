'use strict';
// Open Skylines — procedural geometry: buildings, roads, rail, trees, vehicles, previews, icons
(function () {
  const { C, U } = CB;
  const T = C.TILE, W = C.W;
  const M = CB.Meshes = {};

  // ======================================================================
  // Geometry builder
  // ======================================================================
  const FR = [[1, 0, 0, 1], [0, -1, 1, 0], [-1, 0, 0, -1], [0, 1, -1, 0]];
  const linCache = new Map();
  function lc(c) {
    let v = linCache.get(c);
    if (!v) { const a = typeof c === 'string' ? U.hex(c) : c; v = [U.lin(a[0]), U.lin(a[1]), U.lin(a[2])]; if (typeof c === 'string') linCache.set(c, v); }
    return v;
  }
  class GB {
    constructor() { this.p = []; this.n = []; this.c = []; this.u = []; this.s = []; this.frame(0, 0, 0, 0); this.tint = null; this.noLit = false; }
    frame(ox, oy, oz, f) { this.ox = ox; this.oy = oy; this.oz = oz; const m = FR[f]; this.ma = m[0]; this.mb = m[1]; this.mc = m[2]; this.md = m[3]; }
    _push(P, N, col, st, uv) {
      let r = col[0], g = col[1], b = col[2];
      if (this.tint) { const l = (r + g + b) / 3; r = (l * 0.6 + r * 0.4) * this.tint; g = (l * 0.6 + g * 0.4) * this.tint; b = (l * 0.6 + b * 0.4) * this.tint; }
      if (this.autoMat && st > 0 && st < 5) {
        // pick a surface material from the wall colour: reds/browns -> brick, neutrals -> concrete/stucco, industrial -> metal
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx > 0 ? (mx - mn) / mx : 0;
        if (r > g * 1.35 && r > b * 1.5 && mx < 0.6) st += 32;
        else if (st === 4) st += sat < 0.25 ? 224 : 192;
        else if (sat < 0.3 && mx > 0.25) st += st === 1 ? 96 : (b > r * 1.15 ? 0 : 192);
      }
      if (this.noLit) { const b0 = st % 32; if (b0 >= 1 && b0 <= 5) st -= b0; }
      const nx = this.ma * N[0] + this.mb * N[2], nz = this.mc * N[0] + this.md * N[2];
      for (let k = 0; k < 3; k++) {
        const v = P[k];
        this.p.push(this.ox + this.ma * v[0] + this.mb * v[2], this.oy + v[1], this.oz + this.mc * v[0] + this.md * v[2]);
        this.n.push(nx, N[1], nz);
        this.c.push(r, g, b);
        this.u.push(uv[k * 2], uv[k * 2 + 1]);
        this.s.push(st);
      }
    }
    tri(a, b, c, col, st, uv) {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1;
      this._push([a, b, c], [nx / l, ny / l, nz / l], lc(col), st || 0, uv || [0, 0, 0, 0, 0, 0]);
    }
    quad(a, b, c, d, col, st, u0, u1, v0, v1) {
      st = st || 0;
      u0 = u0 || 0; u1 = u1 || 0; v0 = v0 || 0; v1 = v1 || 0;
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1; const N = [nx / l, ny / l, nz / l];
      const col2 = lc(col);
      this._push([a, b, c], N, col2, st, [u0, v0, u1, v0, u1, v1]);
      this._push([a, c, d], N, col2, st, [u0, v0, u1, v1, u0, v1]);
    }
    box(x0, y0, z0, x1, y1, z1, col, st, o) {
      o = o || {};
      const vb = o.vb !== undefined ? o.vb : y0;
      const v0 = y0 - vb, v1 = y1 - vb, w = x1 - x0, d = z1 - z0;
      const sk = o.skip || 0;
      st = st || 0;
      if (!(sk & 1)) this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], col, st, 0, w, v0, v1);
      if (!(sk & 4)) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], col, st, 0, w, v0, v1);
      if (!(sk & 8)) this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], col, st, 0, d, v0, v1);
      if (!(sk & 2)) this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], col, st, 0, d, v0, v1);
      if (!(sk & 16)) this.quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], o.top || col, o.topSt || 0);
      if (o.bottom) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], col, 0);
    }
    gable(x0, z0, x1, z1, y, h, alongX, col, wall, st, wst) {
      wall = wall || col; st = st || 0; wst = wst || 0;
      if (alongX) {
        const zm = (z0 + z1) / 2;
        this.quad([x1, y, z0], [x0, y, z0], [x0, y + h, zm], [x1, y + h, zm], col, st);
        this.quad([x0, y, z1], [x1, y, z1], [x1, y + h, zm], [x0, y + h, zm], col, st);
        this.tri([x0, y, z0], [x0, y, z1], [x0, y + h, zm], wall, wst);
        this.tri([x1, y, z1], [x1, y, z0], [x1, y + h, zm], wall, wst);
      } else {
        const xm = (x0 + x1) / 2;
        this.quad([x0, y, z0], [x0, y, z1], [xm, y + h, z1], [xm, y + h, z0], col, st);
        this.quad([x1, y, z1], [x1, y, z0], [xm, y + h, z0], [xm, y + h, z1], col, st);
        this.tri([x1, y, z0], [x0, y, z0], [xm, y + h, z0], wall, wst);
        this.tri([x0, y, z1], [x1, y, z1], [xm, y + h, z1], wall, wst);
      }
    }
    pyr(x0, z0, x1, z1, y, h, col, st) {
      const a = [(x0 + x1) / 2, y + h, (z0 + z1) / 2];
      this.tri([x1, y, z0], [x0, y, z0], a, col, st);
      this.tri([x0, y, z1], [x1, y, z1], a, col, st);
      this.tri([x0, y, z0], [x0, y, z1], a, col, st);
      this.tri([x1, y, z1], [x1, y, z0], a, col, st);
    }
    cyl(cx, y0, cz, r, h, seg, col, st, top, r2) {
      r2 = r2 === undefined ? r : r2;
      for (let k = 0; k < seg; k++) {
        const a1 = k / seg * Math.PI * 2, a2 = (k + 1) / seg * Math.PI * 2;
        const c1 = Math.cos(a1), s1 = Math.sin(a1), c2 = Math.cos(a2), s2 = Math.sin(a2);
        const u1 = k / seg * 6.283 * r, u2 = (k + 1) / seg * 6.283 * r;
        this.quad([cx + c2 * r, y0, cz + s2 * r], [cx + c1 * r, y0, cz + s1 * r], [cx + c1 * r2, y0 + h, cz + s1 * r2], [cx + c2 * r2, y0 + h, cz + s2 * r2], col, st || 0, u2, u1, 0, h);
        if (top !== false) this.tri([cx, y0 + h, cz], [cx + c2 * r2, y0 + h, cz + s2 * r2], [cx + c1 * r2, y0 + h, cz + s1 * r2], top || col);
      }
    }
    cone(cx, y0, cz, r, h, seg, col, inv) {
      for (let k = 0; k < seg; k++) {
        const a1 = k / seg * Math.PI * 2, a2 = (k + 1) / seg * Math.PI * 2;
        const b1 = [cx + Math.cos(a1) * r, y0, cz + Math.sin(a1) * r];
        const b2 = [cx + Math.cos(a2) * r, y0, cz + Math.sin(a2) * r];
        if (inv) this.tri(b1, b2, [cx, y0 - h, cz], col);
        else this.tri(b2, b1, [cx, y0 + h, cz], col);
      }
    }
    flat(x0, z0, x1, z1, y, col, st) {
      this.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], col, st || 0);
    }
    tree(x, y, z, s, col, conifer) {
      this.box(x - 0.2 * s, y, z - 0.2 * s, x + 0.2 * s, y + 1.8 * s, z + 0.2 * s, '#5a3d28', 12);
      if (conifer) {
        this.cone(x, y + 1.2 * s, z, 1.7 * s, 3.2 * s, 6, col);
        this.cone(x, y + 2.8 * s, z, 1.25 * s, 3.0 * s, 6, col);
      } else {
        this.cone(x, y + 3.0 * s, z, 2.1 * s, 1.4 * s, 6, col, true);
        this.cone(x, y + 3.0 * s, z, 2.1 * s, 2.6 * s, 6, col);
      }
    }
    addThree(g, mx, col, st) {
      const ng = g.index ? g.toNonIndexed() : g;
      ng.applyMatrix4(mx);
      ng.computeVertexNormals();
      const p = ng.attributes.position.array, n = ng.attributes.normal.array;
      const cl = lc(col);
      for (let i = 0; i < p.length; i += 3) {
        this.p.push(p[i], p[i + 1], p[i + 2]); this.n.push(n[i], n[i + 1], n[i + 2]);
        this.c.push(cl[0], cl[1], cl[2]); this.u.push(0, 0); this.s.push(st || 0);
      }
    }
    get count() { return this.p.length / 3; }
    geometry() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.p), 3));
      g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.n), 3));
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.c), 3));
      g.setAttribute('uvm', new THREE.BufferAttribute(new Float32Array(this.u), 2));
      g.setAttribute('wstyle', new THREE.BufferAttribute(new Float32Array(this.s), 1));
      g.computeBoundingSphere();
      return g;
    }
  }
  M.GB = GB;

  // ======================================================================
  // Palettes
  // ======================================================================
  const PAL = {
    resWall: ['#efe9dc', '#e6dcc6', '#d9cbb0', '#c9d3d6', '#e8e1c4', '#b9a58c', '#cfd8cf', '#dad4cc', '#a9b3a6', '#e3d2bd'],
    roof: ['#4b4f57', '#6b3e2e', '#3d4650', '#7a5a44', '#55504a', '#2f3640', '#5e3a33'],
    brick: ['#9c5a3c', '#8a4b34', '#b06b4b', '#7a4a3a', '#a88468', '#94634a'],
    conc: ['#d1cec6', '#b8b4ab', '#dcd8cf', '#a9a69f', '#c7c1b4', '#e2ded6'],
    glass: ['#8fa3b5', '#6f8aa0', '#9db0bd', '#5f7385', '#a7b6bf', '#7d95a3'],
    accent: ['#d9473c', '#2f86c9', '#e3a02b', '#3aa36a', '#8c4fc0', '#e0603a', '#1e9fa8'],
    ind: ['#9aa3a8', '#7f8a8f', '#b4ab9a', '#6f7f8c', '#a59276', '#8e9b8a'],
    lawn: ['#6b9444', '#73984a', '#62893f'],
    paved: '#a9a7a0', conc2: '#8f8d87', asphalt: '#45474b',
  };

  // ======================================================================
  // Buildings
  // ======================================================================
  function lotFrame(gb, b) {
    const X0 = b.x * T, Z0 = b.y * T, X1 = (b.x + b.fw) * T, Z1 = (b.y + b.fh) * T;
    const o = [[X0, Z0], [X1, Z0], [X1, Z1], [X0, Z1]][b.dir];
    gb.frame(o[0], b.baseY, o[1], b.dir);
  }
  const M8 = { brick: 32, siding: 64, stucco: 96, shingle: 128, tile: 160, concrete: 192, metal: 224, lawn: 256, paving: 288, wood: 320, gravel: 352, seam: 384 };
  M.MAT = M8;
  const LAWNS = new Set(['#6b9444', '#73984a', '#62893f', '#5f9a40', '#5c9840', '#557f38', '#4f7a34', '#6a9a44', '#649a44', '#6fa044', '#4a7230', '#4f8f3a']);
  function foundation(gb, LW, LD, b, top, topSt) {
    const dy = Math.min(-0.6, b.minY - b.baseY - 0.6);
    const ts = topSt !== undefined ? topSt : LAWNS.has(top) ? M8.lawn : (top === PAL.paved || top === '#c9c0ae' || top === '#cfc6b2' || top === '#d9d4c6' || top === '#c9c0ae') ? M8.paving : top === PAL.conc2 ? M8.concrete : 0;
    gb.box(0.05, dy, 0.05, LW - 0.05, 0.08, LD - 0.05, '#8d8a82', M8.concrete, { top, topSt: ts });
  }
  function parkedCar(gb, x, z, rot, r) {
    const col = U.pick(['#c8ccd0', '#2b2f36', '#8a1f1f', '#e6e6e6', '#1f3d6b', '#5f6b70'], r);
    if (rot) { gb.box(x - 0.85, 0.1, z - 2.1, x + 0.85, 1.05, z + 2.1, col); gb.box(x - 0.75, 1.05, z - 1.1, x + 0.75, 1.5, z + 0.9, '#222', 9); }
    else { gb.box(x - 2.1, 0.1, z - 0.85, x + 2.1, 1.05, z + 0.85, col); gb.box(x - 1.1, 1.05, z - 0.75, x + 0.9, 1.5, z + 0.75, '#222', 9); }
  }
  function yardTree(gb, x, z, r) {
    const g = U.pick(['#4f7d34', '#5c8a3a', '#3f6b30', '#6a9440'], r);
    gb.tree(x, 0, z, 0.75 + r() * 0.4, g, r() < 0.3);
  }

  const GEN = {};
  function hip(gb, x0, z0, x1, z1, y, h, col, st) {
    const w = x1 - x0, d = z1 - z0; st = st === undefined ? M8.shingle : st;
    if (w >= d) {
      const k = d / 2, xa = x0 + k, xb = x1 - k, zm = (z0 + z1) / 2;
      gb.quad([x1, y, z0], [x0, y, z0], [xa, y + h, zm], [xb, y + h, zm], col, st);
      gb.quad([x0, y, z1], [x1, y, z1], [xb, y + h, zm], [xa, y + h, zm], col, st);
      gb.tri([x0, y, z0], [x0, y, z1], [xa, y + h, zm], col, st);
      gb.tri([x1, y, z1], [x1, y, z0], [xb, y + h, zm], col, st);
    } else {
      const k = w / 2, za = z0 + k, zb = z1 - k, xm = (x0 + x1) / 2;
      gb.quad([x0, y, z0], [x0, y, z1], [xm, y + h, zb], [xm, y + h, za], col, st);
      gb.quad([x1, y, z1], [x1, y, z0], [xm, y + h, za], [xm, y + h, zb], col, st);
      gb.tri([x1, y, z0], [x0, y, z0], [xm, y + h, za], col, st);
      gb.tri([x0, y, z1], [x1, y, z1], [xm, y + h, zb], col, st);
    }
  }
  // ---- house kit ----
  const HOUSE_WALL = ['#efe9dc', '#e6dcc6', '#d9cbb0', '#c9d3d6', '#e8e1c4', '#cfd8cf', '#dad4cc', '#e3d2bd', '#f2efe6', '#c7b7a3', '#b8c7cf', '#e9d9c9', '#a8b8a0', '#9fb3c4', '#d8c3a5'];
  const BRICKS = ['#9c5a3c', '#8a4b34', '#b06b4b', '#7a4a3a', '#a8735a', '#94634a', '#b8826a'];
  const HOUSE_ROOF = ['#4b4f57', '#3d4650', '#55504a', '#2f3640', '#5e5a55', '#424a52', '#6b4a3a', '#8a4a32', '#7a3e2c'];
  const WORN_WALL = ['#c9bfa8', '#b8ad96', '#a99f8a', '#c4c0b4', '#b5aa98', '#9fa59a', '#bfb3a0'];
  const WORN_ROOF = ['#5a5550', '#6a5040', '#4a4d50', '#605a52', '#7a6a5a'];
  const TRIM = ['#f4f1ea', '#ece7dc', '#ffffff', '#2f3237', '#3a4a52'];
  const SHUTTER = ['#2f4a3a', '#2a2d33', '#3a4f6a', '#6a2f2a', '#55606a'];
  const DOORS = ['#5a3d2b', '#8c1c1c', '#25467a', '#2f5a3a', '#2b2d31', '#c8a040', '#6a3a5a', '#e8e4dc'];
  const roofSt = col => (col === '#6b4a3a' || col === '#8a4a32' || col === '#7a3e2c' || col === '#7a6a5a' || col === '#704a3a') ? M8.tile : M8.shingle;
  // one framed window on a wall. face: 0 front(-z) 1 back(+z) 2 left(-x) 3 right(+x)
  function win(gb, face, a, y, plane, w, h, o) {
    o = o || {};
    const trim = o.trim || '#f2efe8', t = 0.07, out = face === 0 || face === 2 ? -1 : 1;
    const bx = (u0, y0, u1, y1, d0, d1, col, st) => {
      if (face < 2) gb.box(u0, y0, Math.min(plane + out * d0, plane + out * d1), u1, y1, Math.max(plane + out * d0, plane + out * d1), col, st);
      else gb.box(Math.min(plane + out * d0, plane + out * d1), y0, u0, Math.max(plane + out * d0, plane + out * d1), y1, u1, col, st);
    };
    bx(a - w / 2, y, a + w / 2, y + h, -0.02, 0.02, '#fff', 9);                       // glass
    bx(a - w / 2 - t, y + h, a + w / 2 + t, y + h + t, 0, 0.07, trim);                 // head
    bx(a - w / 2 - t, y - t, a + w / 2 + t, y, 0, 0.07, trim);
    bx(a - w / 2 - t, y, a - w / 2, y + h, 0, 0.07, trim); bx(a + w / 2, y, a + w / 2 + t, y + h, 0, 0.07, trim);
    bx(a - w / 2 - 0.12, y - 0.16, a + w / 2 + 0.12, y - 0.07, 0, 0.16, trim);         // sill
    bx(a - 0.025, y, a + 0.025, y + h, 0, 0.04, trim); bx(a - w / 2, y + h * 0.55, a + w / 2, y + h * 0.55 + 0.05, 0, 0.04, trim); // muntins
    if (o.shut) { bx(a - w / 2 - 0.5, y - 0.02, a - w / 2 - 0.1, y + h + 0.02, 0, 0.05, o.shut); bx(a + w / 2 + 0.1, y - 0.02, a + w / 2 + 0.5, y + h + 0.02, 0, 0.05, o.shut); }
    if (o.box) bx(a - w / 2, y - 0.5, a + w / 2, y - 0.16, 0.05, 0.3, '#4a7a36');      // flower box
  }
  function wallWindows(gb, x0, z0, w, d, floors, fh, o, skipFront) {
    o = o || {};
    for (let f = 0; f < floors; f++) {
      const y = f * fh + 0.95, hh = fh * 0.46;
      for (const face of [0, 1, 2, 3]) {
        const len = face < 2 ? w : d, n = Math.max(1, Math.floor((len - 0.6) / (o.spacing || 2.8)));
        if (face >= 2 && len < 4.5) continue;
        for (let k = 0; k < n; k++) {
          const u = (k + 0.5) / n * len;
          if (face === 0 && f === 0 && skipFront && Math.abs(u - skipFront) < 1.2) continue;
          const a = (face < 2 ? x0 : z0) + u, plane = face === 0 ? z0 : face === 1 ? z0 + d : face === 2 ? x0 : x0 + w;
          win(gb, face, a, y, plane, o.ww || 1.05, hh, { trim: o.trim, shut: face === 0 ? o.shut : null, box: face === 0 && f === 0 && o.box });
        }
      }
    }
  }
  function doorway(gb, x, z, col, trim, step) {
    gb.box(x - 0.62, 0, z - 0.1, x + 0.62, 2.35, z + 0.02, trim || '#f2efe8');
    gb.box(x - 0.48, 0, z - 0.13, x + 0.48, 2.2, z, col || '#5a3d2b', M8.wood);
    gb.box(x + 0.25, 1.0, z - 0.17, x + 0.32, 1.08, z - 0.13, '#c9a64a');
    gb.box(x - 0.08, 2.4, z - 0.25, x + 0.08, 2.55, z - 0.1, '#fff', 8);
    if (step) { gb.box(x - 0.8, 0, z - 0.7, x + 0.8, 0.18, z, '#b5b1a8', M8.concrete); gb.box(x - 0.7, 0.18, z - 0.4, x + 0.7, 0.34, z, '#b5b1a8', M8.concrete); }
  }
  function roofOn(gb, kind, x0, z0, x1, z1, y, col, wall, r) {
    const o = 0.45;
    if (kind === 'flat') { gb.box(x0 - 0.15, y, z0 - 0.15, x1 + 0.15, y + 0.55, z1 + 0.15, '#6d6a64', M8.concrete); gb.box(x0 + 0.2, y + 0.55, z0 + 0.2, x1 - 0.2, y + 0.6, z1 - 0.2, '#5d5a55', M8.gravel); return y + 0.6; }
    const span = Math.min(x1 - x0, z1 - z0), h = span * (kind === 'steep' ? 0.62 : 0.38);
    const rs = roofSt(col);
    const alongX = (x1 - x0) >= (z1 - z0);
    if (kind === 'hip') hip(gb, x0 - o, z0 - o, x1 + o, z1 + o, y, h, col, rs);
    else gb.gable(x0 - o, z0 - o, x1 + o, z1 + o, y, h, alongX, col, wall, rs, 0);
    // fascia boards and gutters along the eaves
    const fc = '#f2efe8';
    if (kind === 'hip' || alongX) { gb.box(x0 - o, y - 0.18, z0 - o - 0.05, x1 + o, y + 0.02, z0 - o + 0.05, fc); gb.box(x0 - o, y - 0.18, z1 + o - 0.05, x1 + o, y + 0.02, z1 + o + 0.05, fc); }
    if (kind === 'hip' || !alongX) { gb.box(x0 - o - 0.05, y - 0.18, z0 - o, x0 - o + 0.05, y + 0.02, z1 + o, fc); gb.box(x1 + o - 0.05, y - 0.18, z0 - o, x1 + o + 0.05, y + 0.02, z1 + o, fc); }
    gb.box(x0 - o + 0.1, y - 0.03, z0 - o - 0.1, x0 - o + 0.2, y, z0 - o - 0.05, '#9a9a96');
    gb.box(x0 - 0.05, 0, z0 - 0.08, x0 + 0.05, y, z0 + 0.02, '#e8e6e0');                // downspout
    return y + h;
  }
  function chimney(gb, x, z, y0, y1, col) { gb.box(x - 0.45, y0, z - 0.45, x + 0.45, y1, z + 0.45, col || '#8a4b34', M8.brick); gb.box(x - 0.55, y1, z - 0.55, x + 0.55, y1 + 0.15, z + 0.55, '#6a6862', M8.concrete); }
  function hedge(gb, x0, z0, x1, z1) { gb.box(x0, 0, z0, x1, 0.95, z1, '#3f6b30', M8.lawn, { top: '#4a7a36', topSt: M8.lawn }); }
  function fence(gb, x0, z0, x1, z1, col) { gb.box(x0, 0, z0, x1, 1.1, z1, col || '#e8e2d4', M8.wood); }
  function picket(gb, x0, x1, z) { gb.box(x0, 0.35, z - 0.03, x1, 0.45, z + 0.03, '#f4f1ea'); for (let x = x0; x < x1; x += 0.28) gb.box(x, 0, z - 0.03, x + 0.09, 0.95, z + 0.03, '#f4f1ea'); }
  function bench(gb, x, z, rot) { if (rot) gb.box(x - 0.25, 0, z - 0.9, x + 0.25, 0.5, z + 0.9, '#7a5a3c', M8.wood); else gb.box(x - 0.9, 0, z - 0.25, x + 0.9, 0.5, z + 0.25, '#7a5a3c', M8.wood); }
  function lampPost(gb, x, z) { gb.box(x - 0.07, 0, z - 0.07, x + 0.07, 3.4, z + 0.07, '#3a3d42'); gb.box(x - 0.22, 3.4, z - 0.22, x + 0.22, 3.75, z + 0.22, '#fff', 8); }
  function pathStrip(gb, x0, z0, x1, z1, col) { gb.flat(x0, z0, x1, z1, 0.12, col || '#cdbf9a', M8.paving); }
  function bush(gb, x, z, s, col) { gb.addThree(new THREE.IcosahedronGeometry(0.75 * s, 0), new THREE.Matrix4().makeScale(1, 0.75, 1).setPosition(x, 0.45 * s, z), col || '#4a7a36'); }
  function flowerBed(gb, x0, z0, x1, z1, r) { gb.box(x0, 0, z0, x1, 0.3, z1, '#6a4a32', 0, { top: '#4a3626', topSt: M8.gravel }); for (let k = 0; k < Math.max(4, (x1 - x0) * (z1 - z0) * 2); k++) { const x = x0 + 0.25 + r() * (x1 - x0 - 0.5), z = z0 + 0.25 + r() * (z1 - z0 - 0.5); gb.box(x - 0.14, 0.3, z - 0.14, x + 0.14, 0.5 + r() * 0.15, z + 0.14, U.pick(['#e0503a', '#f2c230', '#d65aa0', '#f2f2f2', '#8a5ad8', '#4a7a36', '#4a7a36'], r)); } }
  function pond(gb, x, z, rad) { gb.cyl(x, 0.0, z, rad + 0.4, 0.18, 16, '#a9a28c', M8.paving, '#a9a28c'); gb.cyl(x, 0.0, z, rad, 0.2, 16, '#1d6f8a', 13, '#1d6f8a'); }
  function grove(gb, x0, z0, x1, z1, n, r, conif) { for (let k = 0; k < n; k++) gb.tree(x0 + r() * (x1 - x0), 0, z0 + r() * (z1 - z0), 0.7 + r() * 0.5, U.pick(['#4f7d34', '#5c8a3a', '#3f6b30', '#2c5a2f', '#6a9440'], r), conif !== undefined ? conif : r() < 0.35); }
  function windingPath(gb, pts, w, col) { for (let k = 0; k < pts.length - 1; k++) { const [ax, az] = pts[k], [bx, bz] = pts[k + 1]; const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1, nx = -dz / l * w / 2, nz = dx / l * w / 2; gb.quad([ax + nx, 0.11, az + nz], [bx + nx, 0.11, bz + nz], [bx - nx, 0.11, bz - nz], [ax - nx, 0.11, az - nz], col || '#cdbf9a', M8.gravel); gb.quad([ax - nx, 0.11, az - nz], [bx - nx, 0.11, bz - nz], [bx + nx, 0.11, bz + nz], [ax + nx, 0.11, az + nz], col || '#cdbf9a', M8.gravel); } }
  function swing(gb, x, z) { gb.box(x - 1.6, 0, z - 0.06, x - 1.5, 2.4, z + 0.06, '#c8392e'); gb.box(x + 1.5, 0, z - 0.06, x + 1.6, 2.4, z + 0.06, '#c8392e'); gb.box(x - 1.6, 2.4, z - 0.08, x + 1.6, 2.55, z + 0.08, '#c8392e'); for (const o of [-0.7, 0.7]) gb.box(x + o - 0.3, 0.6, z - 0.15, x + o + 0.3, 0.7, z + 0.15, '#333'); }
  function slide(gb, x, z, col) { gb.box(x - 0.8, 0, z - 0.8, x + 0.8, 1.8, z + 0.8, col || '#2f86c9'); gb.box(x - 0.9, 1.8, z - 0.9, x + 0.9, 2.0, z + 0.9, '#e3a02b'); gb.quad([x + 0.5, 1.8, z + 0.8], [x - 0.5, 1.8, z + 0.8], [x - 0.5, 0.2, z + 3.2], [x + 0.5, 0.2, z + 3.2], '#e3a02b'); gb.quad([x - 0.5, 1.8, z + 0.8], [x + 0.5, 1.8, z + 0.8], [x + 0.5, 0.2, z + 3.2], [x - 0.5, 0.2, z + 3.2], '#e3a02b'); }
  function statue(gb, x, z, s, col) { gb.box(x - 0.8 * s, 0, z - 0.8 * s, x + 0.8 * s, 1.2 * s, z + 0.8 * s, '#cfc8b8', M8.concrete); gb.box(x - 0.3 * s, 1.2 * s, z - 0.25 * s, x + 0.3 * s, 2.6 * s, z + 0.25 * s, col || '#6f8a7a'); gb.box(x - 0.2 * s, 2.6 * s, z - 0.2 * s, x + 0.2 * s, 3.0 * s, z + 0.2 * s, col || '#6f8a7a'); }
  function fountain(gb, x, z, s) { gb.cyl(x, 0, z, 3 * s, 0.7, 18, '#b7b0a2', M8.concrete, '#1d6f8a'); gb.cyl(x, 0.7, z, 2.7 * s, 0.02, 18, '#1d6f8a', 13); gb.cyl(x, 0.7, z, 0.45 * s, 2.2 * s, 8, '#d8d2c4'); gb.cyl(x, 0.7 + 2.2 * s, z, 1.1 * s, 0.25, 10, '#d8d2c4'); }
  function court(gb, x0, z0, x1, z1, col) { gb.flat(x0, z0, x1, z1, 0.12, col || '#c0603a'); const c = '#f2f2ec', lw = 0.15; gb.flat(x0 + 0.4, z0 + 0.4, x1 - 0.4, z0 + 0.4 + lw, 0.13, c); gb.flat(x0 + 0.4, z1 - 0.4 - lw, x1 - 0.4, z1 - 0.4, 0.13, c); gb.flat(x0 + 0.4, z0 + 0.4, x0 + 0.4 + lw, z1 - 0.4, 0.13, c); gb.flat(x1 - 0.4 - lw, z0 + 0.4, x1 - 0.4, z1 - 0.4, 0.13, c); gb.flat(x0 + 0.4, (z0 + z1) / 2 - lw / 2, x1 - 0.4, (z0 + z1) / 2 + lw / 2, 0.13, c); }
  function hip2(gb, x0, z0, x1, z1, y, h, col) { hip(gb, x0, z0, x1, z1, y, h, col, roofSt(col)); }
  function driveway(gb, x0, x1, z1, car, r) { gb.flat(x0, 0.06, x1, z1, 0.11, '#a8a59e', M8.concrete); if (car) parkedCar(gb, (x0 + x1) / 2, 2.8, true, r); }
  function garage(gb, x0, x1, z0, d, wall, rc, wm) {
    gb.box(x0, 0, z0, x1, 2.9, z0 + d, wall, wm, { top: rc });
    gb.box(x0 + 0.35, 0, z0 - 0.06, x1 - 0.35, 2.35, z0, '#ecebe6', M8.siding);
    gb.box(x0 + 0.25, 2.35, z0 - 0.1, x1 - 0.25, 2.48, z0, '#f2efe8');
    gb.box(x0 - 0.2, 2.9, z0 - 0.3, x1 + 0.2, 3.05, z0 + d + 0.2, rc, M8.shingle);
  }
  function mailbox(gb, x, z) { gb.box(x - 0.04, 0, z - 0.04, x + 0.04, 1.0, z + 0.04, '#3a3d42'); gb.box(x - 0.12, 1.0, z - 0.25, x + 0.12, 1.2, z + 0.2, '#2a2d33'); }
  function acUnit(gb, x, z) { gb.box(x - 0.45, 0, z - 0.45, x + 0.45, 0.8, z + 0.45, '#c9ccd0', M8.metal); }
  function trashBins(gb, x, z) { gb.box(x - 0.3, 0, z - 0.3, x + 0.3, 1.0, z + 0.3, '#2f5a3a'); gb.box(x + 0.45, 0, z - 0.3, x + 1.05, 1.0, z + 0.3, '#2a4a7a'); }

  // a detached house body with real windows, roof and door
  function house(gb, r, x0, z0, w, d, floors, roof, o) {
    const fh = 2.9, H = floors * fh + 0.35;
    gb.box(x0 - 0.06, 0, z0 - 0.06, x0 + w + 0.06, 0.5, z0 + d + 0.06, '#9a968e', M8.concrete);
    gb.box(x0, 0.5, z0, x0 + w, H, z0 + d, o.wall, o.wm);
    if (floors > 1 && o.band) gb.box(x0 - 0.05, fh + 0.32, z0 - 0.05, x0 + w + 0.05, fh + 0.45, z0 + d + 0.05, o.trim);
    for (const [xx, zz] of [[x0, z0], [x0 + w, z0], [x0, z0 + d], [x0 + w, z0 + d]]) gb.box(xx - 0.09, 0.5, zz - 0.09, xx + 0.09, H, zz + 0.09, o.trim);
    const dx = o.doorX !== undefined ? o.doorX : w / 2;
    if (o.door !== false) doorway(gb, x0 + dx, z0, o.doorCol, o.trim, true);
    wallWindows(gb, x0, z0, w, d, floors, fh, { trim: o.trim, shut: o.shut, box: o.box, spacing: o.spacing }, o.door !== false ? dx : null);
    const top = roofOn(gb, roof, x0, z0, x0 + w, z0 + d, H, o.rc, o.wall, r);
    if (o.chimney) chimney(gb, x0 + w * 0.8, z0 + d * 0.5, H - 0.5, top + 0.4, o.chimneyCol);
    return { H, top };
  }
  function porch(gb, x0, x1, z0, depth, h, rc, trim) {
    gb.box(x0, 0, z0 - depth, x1, 0.5, z0, '#a69f92', M8.wood);
    gb.box(x0 - 0.15, h, z0 - depth - 0.2, x1 + 0.15, h + 0.22, z0, rc, M8.shingle);
    const n = Math.max(2, Math.round((x1 - x0) / 2.2));
    for (let k = 0; k <= n; k++) { const x = x0 + 0.15 + (x1 - x0 - 0.3) * k / n; gb.box(x - 0.11, 0.5, z0 - depth + 0.05, x + 0.11, h, z0 - depth + 0.27, trim); }
    gb.box(x0, 0.95, z0 - depth + 0.1, x1, 1.02, z0 - depth + 0.2, trim);
  }

  GEN.rlow = function (gb, b, r, LW, LD) {
    const lvl = b.level, area = b.w * b.d;
    const worn = lvl <= 1, plain = lvl <= 2;
    foundation(gb, LW, LD, b, worn ? '#7a8a4a' : U.pick(PAL.lawn, r), M8.lawn);
    const brick = !worn && r() < (lvl >= 3 ? 0.4 : 0.2);
    const wall = brick ? U.pick(BRICKS, r) : worn ? U.pick(WORN_WALL, r) : U.pick(HOUSE_WALL, r);
    const wm = brick ? M8.brick : (r() < 0.7 ? M8.siding : M8.stucco);
    const rc = worn ? U.pick(WORN_ROOF, r) : U.pick(HOUSE_ROOF, r);
    const trim = worn ? '#d8d2c2' : U.pick(TRIM.slice(0, 3), r);
    const o = { wall, wm, rc, trim, doorCol: U.pick(DOORS, r), shut: !worn && r() < 0.45 ? U.pick(SHUTTER, r) : null, box: lvl >= 3 && r() < 0.4, chimney: r() < 0.6, band: lvl >= 2 };
    const roofK = plain ? U.pick(['gable', 'gable', 'steep'], r) : U.pick(['gable', 'hip', 'hip', 'steep'], r);
    const front = () => { pathStrip(gb, LW / 2 - 0.6, 0.1, LW / 2 + 0.6, 2.4, '#b5ada0'); };
    if (area === 1) {
      if (lvl >= 4) { modernBox(gb, r, 1.4, 2.4, LW - 2.8, 6.2, lvl); bush(gb, 1, 1.2, 0.8); bush(gb, LW - 1, 1.2, 0.8); return; }
      const w = 6.4, d = 5.8, x0 = (LW - w) / 2, z0 = 2.5;
      house(gb, r, x0, z0, w, d, 1, roofK === 'steep' ? 'steep' : 'gable', Object.assign({}, o, { spacing: 2.2 }));
      gb.box(x0 + w / 2 - 1.2, 2.4, z0 - 1.1, x0 + w / 2 + 1.2, 2.55, z0, rc, M8.shingle);
      pathStrip(gb, x0 + w / 2 - 0.5, 0.1, x0 + w / 2 + 0.5, z0 - 0.6, '#b5ada0');
      if (worn) wornYard(gb, r, LW, LD); else { picket(gb, 0.3, x0 + w / 2 - 0.8, 0.5); picket(gb, x0 + w / 2 + 0.8, LW - 0.3, 0.5); }
      mailbox(gb, x0 + w / 2 + 1.2, 0.6);
      if (r() < 0.6) yardTree(gb, LW - 1.2, LD - 1.2, r);
      return;
    }
    const POOLS = area >= 4 ? [null, ['duplex', 'ranchL'], ['duplex', 'ranchL', 'twostoryWide'], ['ranchL', 'twostoryWide', 'estate'], ['twostoryWide', 'estate', 'modernvilla'], ['estate', 'modernvilla', 'modernvilla']]
      : [null, ['saltbox', 'bungalow'], ['saltbox', 'bungalow', 'colonial'], ['colonial', 'bungalow', 'aframe', 'saltbox'], ['colonial', 'modern', 'craftsman'], ['modern', 'modern', 'craftsman']];
    const style = U.pick(POOLS[lvl], r);
    const sc = 0.88 + lvl * 0.03;
    if (style === 'colonial' || style === 'saltbox') {
      const w = Math.min(LW - 2.6, (7.6 + r() * 1.0) * sc), d = 7.2 * sc, x0 = 1.0 + r() * 0.5, z0 = 3.8;
      house(gb, r, x0, z0, w, d, 2, style === 'saltbox' ? 'steep' : (roofK === 'flat' ? 'hip' : roofK), o);
      gb.box(x0 + w / 2 - 1.1, 2.55, z0 - 1.2, x0 + w / 2 + 1.1, 2.7, z0, trim);
      for (const k of [-1, 1]) gb.box(x0 + w / 2 + k * 1.0 - 0.1, 0.18, z0 - 1.15, x0 + w / 2 + k * 1.0 + 0.1, 2.55, z0 - 0.95, trim);
      if (x0 + w + 3 < LW) driveway(gb, x0 + w + 0.4, LW - 0.4, z0 + 4, lvl >= 2 || r() < 0.4, r);
      pathStrip(gb, x0 + w / 2 - 0.55, 0.1, x0 + w / 2 + 0.55, z0 - 0.7, '#b5ada0');
    } else if (style === 'bungalow' || style === 'craftsman') {
      const w = Math.min(LW - 1.6, 8.4), d = (8 + r() * 1.5) * sc, x0 = (LW - w) / 2, z0 = 4.4;
      house(gb, r, x0, z0, w, d, style === 'craftsman' ? 2 : 1, style === 'craftsman' ? 'gable' : 'hip', Object.assign({}, o, { doorX: w * 0.3 }));
      porch(gb, x0 - 0.1, x0 + w + 0.1, z0, 2.2, 2.75, rc, trim);
      if (style === 'craftsman') gb.box(x0 + w * 0.55, 3.2, z0 - 0.4, x0 + w * 0.9, 4.6, z0, wall, wm);
      bench(gb, x0 + w * 0.7, z0 - 1.2);
      front();
    } else if (style === 'modern') {
      modernBox(gb, r, 1.2, 3.4, LW - 2.4, 9 + r() * 1.5, lvl);
      driveway(gb, LW * 0.62, LW - 0.4, 3.4, r() < 0.7, r);
      if (lvl >= 4 && LD > 15) pool(gb, 1.6, LD - 6, 6, 3.6);
    } else if (style === 'aframe') {
      const w = 7, d = 8, x0 = (LW - w) / 2, z0 = 4;
      gb.gable(x0, z0, x0 + w, z0 + d, 0, 7.5, false, rc, wall, roofSt(rc), M8.wood);
      gb.tri([x0 + 0.7, 0.1, z0 - 0.03], [x0 + w - 0.7, 0.1, z0 - 0.03], [x0 + w / 2, 6.3, z0 - 0.03], '#fff', 9);
      gb.tri([x0 + w - 0.7, 0.1, z0 - 0.03], [x0 + 0.7, 0.1, z0 - 0.03], [x0 + w / 2, 6.3, z0 - 0.03], '#fff', 9);
      for (const k of [0.33, 0.66]) gb.box(x0 + 0.7 + (w - 1.4) * k - 0.04, 0.1, z0 - 0.06, x0 + 0.7 + (w - 1.4) * k + 0.04, 6.2 - Math.abs(k - 0.5) * 6, z0 - 0.02, '#2a2d33');
      doorway(gb, x0 + w / 2, z0 - 0.05, '#5a3d2b', '#2a2d33', false);
      gb.box(x0 - 0.6, 0, z0 - 2.6, x0 + w + 0.6, 0.45, z0, '#8a6a4a', M8.wood);
    } else if (style === 'ranchL') {
      const x0 = 1.2, z0 = 3.6, w = LW - 6.8, d = 7.2;
      house(gb, r, x0, z0, w, d, 1, roofK === 'flat' ? 'hip' : roofK, Object.assign({}, o, { doorX: w * 0.35 }));
      house(gb, r, x0, z0 + d, 6.6, Math.max(4, LD - z0 - d - 4), 1, 'hip', Object.assign({}, o, { door: false, chimney: false }));
      garage(gb, x0 + w + 0.1, LW - 0.8, z0 + 0.8, 6.2, wall, rc, wm);
      driveway(gb, x0 + w + 0.3, LW - 1.0, z0 + 0.8, true, r);
      if (lvl >= 2 && LD > 15) pool(gb, 10, LD - 7.2, LW - 12, 4.2); else grove(gb, 9, LD - 7, LW - 2, LD - 2, 2, r);
      fence(gb, 0.2, LD - 0.4, LW - 0.2, LD - 0.25, '#b49a78');
    } else if (style === 'twostoryWide') {
      const w = LW - 5, d = 9, x0 = 2.5, z0 = 4.6;
      house(gb, r, x0, z0, w, d, 2, 'hip', Object.assign({}, o, { spacing: 2.6 }));
      porch(gb, x0 + w / 2 - 2.2, x0 + w / 2 + 2.2, z0, 1.7, 2.75, rc, trim);
      pathStrip(gb, x0 + w / 2 - 0.7, 0.1, x0 + w / 2 + 0.7, z0 - 1.7, '#b5ada0');
      hedge(gb, 0.4, 0.4, x0 + w / 2 - 1.3, 1.1); hedge(gb, x0 + w / 2 + 1.3, 0.4, LW - 0.4, 1.1);
      grove(gb, 1.5, LD - 5, LW - 1.5, LD - 1.5, 3, r);
    } else if (style === 'duplex') {
      for (const side of [0, 1]) {
        const x0 = side ? LW / 2 + 0.05 : 1.5, w = LW / 2 - 1.55, z0 = 4.2;
        const o2 = Object.assign({}, o, { wall: side && !brick ? U.pick(HOUSE_WALL, r) : wall, doorX: side ? w - 1.6 : 1.6, chimney: false });
        house(gb, r, x0, z0, w, 9, 2, 'gable', o2);
        trashBins(gb, side ? LW - 1.4 : 0.9, z0 + 1);
      }
      fence(gb, LW / 2 - 0.05, 13.4, LW / 2 + 0.05, LD - 0.4);
      yardTree(gb, 4, LD - 3, r); yardTree(gb, LW - 4, LD - 3, r);
    } else if (style === 'estate' || style === 'modernvilla') {
      const cx = LW / 2, z0 = 8;
      if (style === 'modernvilla') {
        modernBox(gb, r, cx - 6.5, z0, 13, 9.5, 5);
        pool(gb, cx - 5, z0 + 12, 10, 5);
      } else {
        const mw = Math.min(LW - 7, 12), md = 9;
        house(gb, r, cx - mw / 2, z0, mw, md, 2, 'hip', Object.assign({}, o, { chimney: true, spacing: 2.4, shut: o.shut || '#2a2d33' }));
        for (const sx of [-1, 1]) house(gb, r, sx < 0 ? cx - mw / 2 - 4.6 : cx + mw / 2, z0 + 1.6, 4.6, md - 2.2, 1, 'hip', Object.assign({}, o, { door: false, chimney: false }));
        gb.box(cx - 2.3, 0, z0 - 2.3, cx + 2.3, 0.45, z0, '#cfc8b8', M8.concrete);
        for (const k of [-1.9, -0.65, 0.65, 1.9]) gb.cyl(cx + k, 0.45, z0 - 1.8, 0.2, 5.2, 8, '#f4f1ea');
        gb.box(cx - 2.5, 5.65, z0 - 2.4, cx + 2.5, 6.05, z0, '#f4f1ea');
        gb.cyl(cx, 0.06, 4, 3.4, 0.06, 18, '#c9c1ad', M8.gravel, '#c9c1ad');
        gb.cyl(cx, 0.12, 4, 1.6, 0.05, 14, '#5f9a40', M8.lawn, '#5f9a40');
        statue(gb, cx, 4, 0.6, '#cfc8b8');
        grove(gb, 1, LD - 8, 6, LD - 1, 3, r); grove(gb, LW - 6, LD - 8, LW - 1, LD - 1, 3, r);
        flowerBed(gb, cx - 4, LD - 5, cx + 4, LD - 3, r);
      }
      hedge(gb, 0.3, 0.3, cx - 3.6, 0.95); hedge(gb, cx + 3.6, 0.3, LW - 0.3, 0.95);
      parkedCar(gb, cx + 2.6, 5.4, false, r);
    }
    if (area === 3) {
      gb.box(LW - 4.2, 0, LD - 4.6, LW - 1.2, 2.4, LD - 1.4, U.pick(['#8a6a4a', '#9c5a3c', '#cfd8cf'], r), M8.wood, { top: rc });
      for (let k = 0; k < 3; k++) gb.box(1.2, 0, LD - 9 + k * 2.1, 5.6, 0.3, LD - 8.1 + k * 2.1, '#6a4a32', 0, { top: '#4a7a36', topSt: M8.lawn });
    }
    if (worn) wornYard(gb, r, LW, LD);
    else { mailbox(gb, 1.0, 0.6); acUnit(gb, LW - 0.8, LD * 0.45); }
    if (lvl >= 3 && area >= 2) { flowerBed(gb, 0.6, 1.3, 2.8, 2.4, r); bush(gb, LW - 1.2, 1.6, 0.9); }
    if (area >= 2 && lvl >= 2 && style !== 'ranchL' && style !== 'duplex') { fence(gb, 0.2, LD - 0.4, LW - 0.2, LD - 0.25, '#b49a78'); fence(gb, 0.2, LD * 0.55, 0.35, LD - 0.25, '#b49a78'); fence(gb, LW - 0.35, LD * 0.55, LW - 0.2, LD - 0.25, '#b49a78'); }
    if (area === 2 && r() < 0.8) yardTree(gb, 1.6 + r() * 2, LD - 2.5 - r() * 3, r);
  };
  function pool(gb, x0, z0, w, d) {
    gb.flat(x0 - 0.7, z0 - 0.7, x0 + w + 0.7, z0 + d + 0.7, 0.1, '#e3ddd0', M8.paving);
    gb.box(x0, 0, z0, x0 + w, 0.16, z0 + d, '#3aa8c8', 13);
    for (let k = 0; k < 2; k++) gb.box(x0 + w + 1.0, 0, z0 + 0.6 + k * 1.4, x0 + w + 2.6, 0.35, z0 + 1.2 + k * 1.4, '#f2f2f2');
  }
  function modernBox(gb, r, x0, z0, w, d, lvl) {
    const dark = r() < 0.45, base = dark ? '#3a3d42' : '#ece9e2', up = dark ? '#ece9e2' : '#6a5038';
    gb.box(x0, 0, z0, x0 + w * 0.62, 3.2, z0 + d, base, M8.stucco);
    gb.box(x0 + w * 0.28, 3.2, z0 + 0.8, x0 + w, 6.3, z0 + d, up, dark ? M8.stucco : M8.wood);
    gb.box(x0 - 0.15, 3.12, z0 - 0.3, x0 + w * 0.62 + 0.1, 3.38, z0 + d + 0.1, '#2b2b30');
    gb.box(x0 + w * 0.28 - 0.1, 6.3, z0 + 0.6, x0 + w + 0.15, 6.55, z0 + d + 0.15, '#2b2b30');
    gb.box(x0 + 2.2, 0.35, z0 - 0.04, x0 + w * 0.6 - 0.2, 2.9, z0, '#fff', 9);
    gb.box(x0 + w * 0.32, 3.6, z0 + 0.76, x0 + w - 0.3, 5.9, z0 + 0.8, '#fff', 9);
    for (let k = 1; k < 4; k++) gb.box(x0 + 2.2 + (w * 0.6 - 2.4) * k / 4 - 0.03, 0.35, z0 - 0.07, x0 + 2.2 + (w * 0.6 - 2.4) * k / 4 + 0.03, 2.9, z0 - 0.02, '#1c1d20');
    gb.box(x0 + w * 0.62, 0, z0 + 2, x0 + w, 2.9, z0 + d, '#5a5d62', M8.metal);
    doorway(gb, x0 + 1.2, z0, '#2b2b30', '#1c1d20', false);
    gb.box(x0 - 0.5, 0, z0 - 1.8, x0 + 2.4, 0.22, z0, '#8a6a4a', M8.wood);
    gb.box(x0 + w * 0.3, 0.6, z0 + d + 0.02, x0 + w * 0.55, 2.6, z0 + d + 0.06, '#fff', 9);
  }
  function wornYard(gb, r, LW, LD) {
    for (const y of [0.1, 1.05]) gb.box(0.2, y, LD - 0.36, LW - 0.2, y + 0.04, LD - 0.32, '#8a9095');
    for (let x = 0.2; x <= LW - 0.2; x += 2.5) gb.box(x - 0.04, 0, LD - 0.38, x + 0.04, 1.15, LD - 0.3, '#7a8086');
    gb.flat(LW - 3.4, 0.1, LW - 0.6, Math.min(5, LD - 1), 0.11, '#8a8478', M8.gravel);
    if (r() < 0.6 && LD > 12) gb.box(0.8, 0, LD - 3.6, 3.2, 2.0, LD - 1.2, '#8a8a84', M8.metal, { top: '#6e6a62' });
    if (r() < 0.4) parkedCarOld(gb, LW - 2, 2.6, r);
  }
  function parkedCarOld(gb, x, z, r) { gb.box(x - 0.85, 0.15, z - 2.1, x + 0.85, 1.0, z + 2.1, U.pick(['#7a6a5a', '#5a6a6e', '#8a7a4a'], r)); gb.box(x - 0.75, 1.0, z - 1.0, x + 0.75, 1.45, z + 0.9, '#2a2c30'); }

  // ---- medium density: terraced row houses (and walk-ups at high levels) ----
  const ROW_WALL = [['#9c5a3c', 32], ['#8a4b34', 32], ['#b06b4b', 32], ['#e8dcc4', 96], ['#d8d0c0', 96], ['#c8cfd2', 64], ['#9fb0a0', 64], ['#2f3e52', 64], ['#e9e4d8', 96], ['#7a4a3a', 32], ['#c9a882', 96]];
  GEN.rmed = function (gb, b, r, LW, LD) {
    const lvl = b.level;
    foundation(gb, LW, LD, b, '#a9a69e', M8.paving);
    if (lvl >= 4 && LW > T + 0.1 && r() < 0.6) { walkup(gb, b, r, LW, LD); return; }
    const n = Math.max(2, Math.round(LW / 4.6)), uw = LW / n;
    const floors = 2 + (lvl >= 2 ? 1 : 0) + (lvl >= 4 && r() < 0.5 ? 1 : 0);
    const fh = 3.0, H = floors * fh + 0.4, z0 = 3.2, d = Math.min(LD - z0 - 3, 10.5);
    const rc = U.pick(['#3d4650', '#4b4f57', '#2f3640', '#5a3a30', '#6b4a3a'], r);
    const mansard = lvl >= 3 && r() < 0.35;
    const trimAll = U.pick(['#f4f1ea', '#ece7dc', '#e8e4dc'], r);
    for (let k = 0; k < n; k++) {
      const x0 = k * uw, x1 = x0 + uw, cx = (x0 + x1) / 2;
      const [wall, wm] = U.pick(ROW_WALL, r);
      const hj = (r() - 0.5) * 0.5;
      // body
      gb.box(x0, 0, z0, x1, 0.6, z0 + d, '#8a8780', M8.concrete);
      gb.box(x0 + 0.02, 0.6, z0, x1 - 0.02, H + hj, z0 + d, wall, wm);
      gb.box(x0 - 0.02, H + hj - 0.25, z0 - 0.12, x1 + 0.02, H + hj, z0 + 0.02, trimAll);           // cornice
      // party wall parapet with chimney
      if (k > 0) { gb.box(x0 - 0.18, H - 0.2, z0, x0 + 0.18, H + 2.4, z0 + d, '#7a6a5e', M8.brick); chimney(gb, x0, z0 + d * 0.55, H + 2.2, H + 3.3, '#7a4a3a'); }
      // windows: two per floor (door + one window on the ground floor)
      const doorLeft = (k % 2 === 0);
      const dx = doorLeft ? x0 + uw * 0.28 : x1 - uw * 0.28, wx = doorLeft ? x1 - uw * 0.3 : x0 + uw * 0.3;
      const bay = lvl >= 2 && r() < 0.55;
      if (bay) {
        gb.box(wx - 1.1, 0.6, z0 - 0.75, wx + 1.1, fh + 0.4, z0, wall, wm);
        gb.box(wx - 0.95, 1.0, z0 - 0.79, wx + 0.95, fh - 0.1, z0 - 0.74, '#fff', 9);
        for (const q of [-0.32, 0.32]) gb.box(wx + q - 0.04, 1.0, z0 - 0.82, wx + q + 0.04, fh - 0.1, z0 - 0.76, trimAll);
        gb.box(wx - 1.2, fh + 0.4, z0 - 0.85, wx + 1.2, fh + 0.55, z0, trimAll);
      } else win(gb, 0, wx, 1.1, z0, 1.2, 1.6, { trim: trimAll, box: r() < 0.4 });
      for (let f = 1; f < floors; f++) for (const ax of [dx, wx]) win(gb, 0, ax, f * fh + 1.0, z0, 1.0, 1.55, { trim: trimAll });
      for (let f = 0; f < floors; f++) for (const ax of [x0 + uw * 0.3, x1 - uw * 0.3]) win(gb, 1, ax, f * fh + 1.0, z0 + d, 1.0, 1.45, { trim: trimAll });
      // door with transom, stoop and railings
      doorway(gb, dx, z0, U.pick(DOORS, r), trimAll, false);
      gb.box(dx - 0.6, 2.4, z0 - 0.06, dx + 0.6, 2.85, z0 + 0.01, '#fff', 9);
      for (let st = 0; st < 3; st++) gb.box(dx - 0.75, 0, z0 - 1.5 + st * 0.45, dx + 0.75, 0.2 + st * 0.2, z0, '#b8b2a6', M8.concrete);
      for (const s2 of [-0.78, 0.78]) gb.box(dx + s2 - 0.03, 0.2, z0 - 1.5, dx + s2 + 0.03, 1.15, z0, '#1c1d20');
      // front garden: low wall + iron railing, bins, a shrub
      gb.box(x0 + 0.1, 0, 0.4, x1 - 0.1, 0.5, 0.65, '#9a948a', M8.brick);
      for (let x = x0 + 0.25; x < x1 - 0.2; x += 0.22) gb.box(x, 0.5, 0.5, x + 0.03, 1.05, 0.55, '#1c1d20');
      gb.flat(doorLeft ? x1 - uw * 0.55 : x0 + 0.2, 0.7, doorLeft ? x1 - 0.2 : x0 + uw * 0.55, z0 - 0.2, 0.12, '#4a7a36', M8.lawn);
      if (r() < 0.6) bush(gb, wx, 1.6, 0.8);
      if (r() < 0.5) trashBins(gb, doorLeft ? x0 + 0.5 : x1 - 1.6, z0 - 0.7);
      // back yard: lawn, patio, fence; end-of-terrace side windows
      gb.flat(x0 + 0.05, z0 + d + 2.2, x1 - 0.05, LD - 0.25, 0.115, U.pick(['#5f8a3e', '#6a9444', '#58823a'], r), M8.lawn);
      gb.flat(x0 + 0.05, z0 + d, x1 - 0.05, z0 + d + 2.2, 0.115, '#b8b2a6', M8.paving);
      gb.box(x0, 0, z0 + d, x0 + 0.06, 1.6, LD - 0.2, '#8a6a4a', M8.wood);
      if (k === n - 1) gb.box(x1 - 0.06, 0, z0 + d, x1, 1.6, LD - 0.2, '#8a6a4a', M8.wood);
      gb.box(x0, 0, LD - 0.26, x1, 1.6, LD - 0.2, '#8a6a4a', M8.wood);
      if (k === 0 || k === n - 1) for (let f = 0; f < floors; f++) for (const zz of [z0 + d * 0.3, z0 + d * 0.7]) win(gb, k === 0 ? 2 : 3, zz, f * fh + 1.0, k === 0 ? x0 + 0.02 : x1 - 0.02, 0.9, 1.4, { trim: trimAll });
      if (r() < 0.5) yardTree(gb, cx, Math.min(LD - 1.8, z0 + d + 2.4), r);
      // roof
      const ry = H + hj;
      if (mansard) {
        gb.quad([x1, ry, z0], [x0, ry, z0], [x0, ry + 2.2, z0 + 0.9], [x1, ry + 2.2, z0 + 0.9], rc, M8.shingle);
        gb.quad([x0, ry, z0 + d], [x1, ry, z0 + d], [x1, ry + 2.2, z0 + d - 0.9], [x0, ry + 2.2, z0 + d - 0.9], rc, M8.shingle);
        gb.box(x0, ry + 2.2, z0 + 0.9, x1, ry + 2.3, z0 + d - 0.9, '#55524c', M8.gravel);
        for (const [ex, end] of [[x0, k === 0], [x1, k === n - 1]]) if (end) {
          const P = [[ex, ry, z0], [ex, ry, z0 + d], [ex, ry + 2.2, z0 + d - 0.9], [ex, ry + 2.2, z0 + 0.9]];
          gb.quad(P[0], P[1], P[2], P[3], wall, wm); gb.quad(P[1], P[0], P[3], P[2], wall, wm);
        }
        gb.box(cx - 0.5, ry + 0.4, z0 + 0.25, cx + 0.5, ry + 1.6, z0 + 0.5, wall, wm); win(gb, 0, cx, ry + 0.6, z0 + 0.24, 0.6, 0.85, { trim: trimAll });
      } else {
        gb.gable(x0, z0 - 0.3, x1, z0 + d + 0.3, ry, Math.min(3.6, d * 0.36), true, rc, wall, roofSt(rc), wm);
        if (r() < 0.6) { // dormer
          gb.box(cx - 0.65, ry + 0.2, z0 + 0.6, cx + 0.65, ry + 1.6, z0 + 2.2, wall, wm);
          gb.gable(cx - 0.8, z0 + 0.5, cx + 0.8, z0 + 2.3, ry + 1.6, 0.7, false, rc, wall, roofSt(rc), wm);
          win(gb, 0, cx, ry + 0.45, z0 + 0.6, 0.7, 0.85, { trim: trimAll });
        }
      }
    }
  };
  function walkup(gb, b, r, LW, LD) {
    const lvl = b.level;
    const [wall, wm] = U.pick(ROW_WALL.slice(0, 3).concat(ROW_WALL.slice(3, 5)), r);
    const floors = 3 + lvl + (r() < 0.4 ? 1 : 0), fh = 3.1, H = floors * fh;
    const z0 = 2.4, d = Math.min(LD - 4, 14), x0 = 1.0, x1 = LW - 1.0;
    gb.box(x0, 0, z0, x1, 3.6, z0 + d, '#cfcac0', 3 + M8.stucco);
    gb.box(x0, 3.6, z0, x1, H, z0 + d, wall, 1 + wm, { vb: 0.5 });
    gb.box(x0 - 0.25, H, z0 - 0.25, x1 + 0.25, H + 0.7, z0 + d + 0.25, '#e8e4dc', M8.concrete);
    gb.box(LW / 2 - 3, H + 0.7, z0 + 4, LW / 2 + 3, H + 3, z0 + 8, '#8f8b84', M8.concrete);
    for (let f = 2; f < floors; f++) for (let k = 0; k < 3; k++) { const bx = x0 + 1.6 + k * (x1 - x0 - 3.2) / 2 - 1.6; gb.box(bx, f * fh - 0.15, z0 - 1.2, bx + 3.2, f * fh + 0.05, z0, '#d6d2c8', M8.concrete); gb.box(bx, f * fh + 0.05, z0 - 1.2, bx + 3.2, f * fh + 1.05, z0 - 1.15, '#2b2d31'); }
    doorway(gb, LW / 2, z0, '#2b2d31', '#e8e4dc', true);
    gb.box(LW / 2 - 1.6, 3.0, z0 - 1.6, LW / 2 + 1.6, 3.2, z0, '#2b2d31');
    yardTree(gb, 2.5, LD - 2, r); yardTree(gb, LW - 2.5, LD - 2, r);
    for (let k = 0; k < 4; k++) parkedCar(gb, 3 + k * 4.6, LD - 1.5 - 0, true, r);
  }

  // ---- low density commercial ----
  const AWN = ['#c8392e', '#2f6f9a', '#2f7a4a', '#d8a02b', '#5a3a6a', '#2a2d33', '#c8642a'];
  function storefront(gb, x0, x1, z, H, acc, r, kind) {
    // display glass, mullions, door, sign band, awning
    gb.box(x0, 0, z - 0.05, x1, 0.55, z + 0.02, '#3a3d42');
    gb.box(x0 + 0.15, 0.55, z - 0.04, x1 - 0.15, H - 0.9, z, '#fff', 9);
    const n = Math.max(2, Math.round((x1 - x0) / 1.6));
    for (let k = 0; k <= n; k++) { const x = x0 + 0.1 + (x1 - x0 - 0.2) * k / n; gb.box(x - 0.05, 0.55, z - 0.1, x + 0.05, H - 0.9, z, '#2a2c30'); }
    const dxp = x0 + (x1 - x0) * 0.78;
    gb.box(dxp - 0.55, 0, z - 0.12, dxp + 0.55, 2.3, z - 0.05, '#3a4a52', 9);
    gb.box(x0, H - 0.9, z - 0.14, x1, H, z, '#2a2d33');
    gb.box(x0 + 0.5, H - 0.75, z - 0.2, x1 - 0.5, H - 0.15, z - 0.14, acc, 5);                   // illuminated sign
    { // lettering
      const nL = Math.max(4, Math.floor((x1 - x0 - 1.6) / 0.42)), lx = (x0 + x1) / 2 - nL * 0.21;
      for (let k = 0; k < nL; k++) { if (r() < 0.12) continue; const h = 0.3 + (k === 0 ? 0.08 : 0); gb.box(lx + k * 0.42 + 0.05, H - 0.6, z - 0.24, lx + k * 0.42 + 0.33, H - 0.6 + h, z - 0.2, '#ffffff', 15); }
    }
    for (const px of [x0 - 0.05, x1 - 0.3]) gb.box(px, 0, z - 0.22, px + 0.35, H, z, '#e8e4dc', M8.concrete);   // pilasters
    // striped awning sloping out
    const ay = H - 1.0, depth = 1.5, stripes = Math.max(4, Math.round((x1 - x0) / 0.6));
    for (let k = 0; k < stripes; k++) {
      const a0 = x0 + (x1 - x0) * k / stripes, a1 = x0 + (x1 - x0) * (k + 1) / stripes, col = k % 2 ? '#f2efe6' : acc;
      gb.quad([a0, ay, z], [a1, ay, z], [a1, ay - 0.55, z - depth], [a0, ay - 0.55, z - depth], col);
      gb.quad([a1, ay, z], [a0, ay, z], [a0, ay - 0.55, z - depth], [a1, ay - 0.55, z - depth], col);
      gb.box(a0, ay - 0.85, z - depth - 0.02, a1, ay - 0.55, z - depth + 0.02, col);
    }
    if (kind === 'cafe') { for (let k = 0; k < 2; k++) { const x = x0 + 1.2 + k * 2.4; gb.cyl(x, 0, z - 2.6, 0.45, 0.75, 8, '#f2f2f2', 0, '#f2f2f2'); gb.cyl(x, 0.75, z - 2.6, 0.04, 1.4, 4, '#888'); gb.cone(x, 2.15, z - 2.6, 1.2, 0.45, 8, acc); } }
    if (kind === 'grocer') for (let k = 0; k < 3; k++) gb.box(x0 + 0.4 + k * 1.1, 0, z - 0.9, x0 + 1.3 + k * 1.1, 0.8, z - 0.25, U.pick(['#d84a2a', '#e3a02b', '#4a8a3a'], r), 0, { top: U.pick(['#e85a3a', '#f2c230', '#6aa83a'], r) });
    if (kind === 'sign') { gb.box(x1 - 0.6, 0, z - 1.3, x1 - 0.1, 0.9, z - 1.0, '#2a2d33'); }
  }
  GEN.clow = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, '#b8b4ab', M8.paving);
    const lvl = b.level, acc = U.pick(AWN, r);
    const kind = U.pick(['cafe', 'grocer', 'sign', 'plain'], r);
    if (LW <= T + 0.1) {
      const up = Math.min(3, 1 + Math.floor((lvl - 1) / 2) + (r() < 0.3 ? 1 : 0));
      const brick = r() < 0.65, wall = brick ? U.pick(BRICKS, r) : U.pick(HOUSE_WALL, r), wm = brick ? M8.brick : M8.stucco;
      const z0 = 1.6, d = Math.min(LD - 4, 12 + r() * 2), Hg = 4.3, H = Hg + up * 3.1;
      gb.box(0.15, 0, z0, LW - 0.15, H, z0 + d, wall, wm);
      storefront(gb, 0.4, LW - 0.4, z0, Hg, acc, r, kind);
      for (let f = 0; f < up; f++) for (const ax of [LW * 0.27, LW * 0.73]) win(gb, 0, ax, Hg + 0.6 + f * 3.1, z0, 1.2, 1.7, { trim: '#ece7dc' });
      for (let f = 0; f < up; f++) for (const ax of [LW * 0.3, LW * 0.7]) win(gb, 1, ax, Hg + 0.6 + f * 3.1, z0 + d, 1.1, 1.5, { trim: '#ece7dc' });
      gb.box(0.05, H - 0.35, z0 - 0.3, LW - 0.05, H, z0 + d + 0.05, '#e8e4dc', M8.concrete);   // cornice
      gb.box(0.15, H, z0, LW - 0.15, H + 0.9, z0 + 0.3, wall, wm);                              // parapet
      gb.box(0.15, H, z0 + 0.3, LW - 0.15, H + 0.05, z0 + d, '#55524c', M8.gravel);
      acUnit(gb, LW * 0.6, z0 + d * 0.6); gb.box(LW * 0.25 - 0.45, H, z0 + d * 0.6 - 0.45, LW * 0.25 + 0.45, H + 0.8, z0 + d * 0.6 + 0.45, '#c9ccd0', M8.metal);
      gb.box(LW - 1.8, 0, z0 + d + 0.4, LW - 0.4, 1.4, z0 + d + 1.4, '#2f5a3a');                 // dumpster
      parkedCar(gb, 3, LD - 2.6, true, r);
    } else {
      // small strip mall / grocery with a parking lot
      const big = lvl >= 3 || r() < 0.5;
      const z0 = big ? 9.5 : 2, d = LD - z0 - 1.2, H = 5.4;
      gb.box(1, 0, z0, LW - 1, H, z0 + d, U.pick(['#d8d2c4', '#c9c2b4', '#e2ddd2'], r), M8.concrete);
      const units = big ? 1 : 3;
      for (let k = 0; k < units; k++) { const a0 = 1 + (LW - 2) * k / units, a1 = 1 + (LW - 2) * (k + 1) / units; storefront(gb, a0 + 0.2, a1 - 0.2, z0, H - 0.6, units === 1 ? acc : U.pick(AWN, r), r, units === 1 ? 'grocer' : U.pick(['cafe', 'sign', 'plain'], r)); }
      gb.box(0.8, H, z0 - 0.3, LW - 0.8, H + 1.0, z0 + 0.1, U.pick(['#d8d2c4', '#bfb8aa'], r), M8.concrete);
      if (big) gb.box(LW / 2 - 4, H + 0.2, z0 - 0.4, LW / 2 + 4, H + 1.4, z0 - 0.3, acc, 5);
      gb.box(1.2, H, z0 + 0.1, LW - 1.2, H + 0.05, z0 + d - 0.2, '#55524c', M8.gravel);
      for (let k = 0; k < 3; k++) acUnit(gb, 4 + k * 5, z0 + d * 0.6);
      if (big) {
        gb.flat(0.5, 0.5, LW - 0.5, z0 - 0.5, 0.11, '#45474b');
        for (let k = 0; k <= 6; k++) gb.flat(1.5 + k * 2.8, 2.5, 1.62 + k * 2.8, 7.5, 0.12, '#e6e6df');
        for (let k = 0; k < 6; k++) if (r() < 0.65) parkedCar(gb, 2.9 + k * 2.8, 5, true, r);
        lampPost(gb, LW / 2, 8.4); gb.box(LW - 3, 0, 8.2, LW - 1.2, 1.1, 8.8, '#9aa0a6', M8.metal);
      }
    }
  };
  GEN.rhigh = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, PAL.paved);
    const lvl = b.level;
    const pod = r() < 0.5 ? U.pick(PAL.conc, r) : U.pick(PAL.brick, r);
    const tw = r() < 0.35 ? U.pick(PAL.glass, r) : U.pick(PAL.conc, r);
    const glassy = r() < 0.3;
    gb.box(1.0, 0, 1.0, LW - 1.0, 4.0, LD - 3, pod, 3);
    gb.box(1.0, 4.0, 1.0, LW - 1.0, 7.4, LD - 3, pod, 1, { vb: 0.6 });
    const floors = 9 + lvl * 4 + Math.floor(r() * 7) + (LD > 25 ? 4 : 0);
    const H = 7.4 + floors * 3.0;
    const s = 6 + r() * 2;
    const cx = LW / 2, cz = LD / 2 - 1;
    const st = glassy ? 2 : 1;
    const h1 = 7.4 + (H - 7.4) * (0.68 + r() * 0.12);
    gb.box(cx - s, 7.4, cz - s, cx + s, h1, cz + s, tw, st, { vb: 0.6 });
    gb.box(cx - s + 1.2, h1, cz - s + 1.2, cx + s - 1.2, H, cz + s - 1.2, tw, st, { vb: 0.6 });
    gb.box(cx - s + 1.0, H, cz - s + 1.0, cx + s - 1.0, H + 0.8, cz + s - 1.0, '#5c5a56');
    gb.box(cx - 2.5, H + 0.8, cz - 2.5, cx + 2.5, H + 3.6, cz + 2.5, '#8c8984');
    if (lvl >= 4) gb.box(cx - 0.2, H + 3.6, cz - 0.2, cx + 0.2, H + 10, cz + 0.2, '#ccc');
    if (lvl >= 4) gb.box(cx - 0.3, H + 10, cz - 0.3, cx + 0.3, H + 10.6, cz + 0.3, '#f22', 7);
    yardTree(gb, 2.5, LD - 1.6, r); yardTree(gb, LW - 2.5, LD - 1.6, r);
  };
  GEN.chigh = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, PAL.paved);
    const lvl = b.level, acc = U.pick(PAL.accent, r);
    const wall = U.pick(PAL.glass, r);
    const deep = LD > 25;
    const floors = (deep ? 10 : 3) + lvl * (deep ? 3 : 1) + Math.floor(r() * 3);
    gb.box(1, 0, 1, LW - 1, 8.2, LD - 1.5, U.pick(PAL.conc, r), 3);
    const H = 8.2 + floors * 3.6;
    const inset = deep ? 3.5 : 1.5;
    gb.box(1 + inset, 8.2, 1 + inset, LW - 1 - inset, H, LD - 1.5 - inset, wall, 2, { vb: 0.4 });
    gb.box(1 + inset - 0.2, H, 1 + inset - 0.2, LW - 1 - inset + 0.2, H + 1.0, LD - 1.5 - inset + 0.2, '#4c4f55');
    gb.box(3, 8.6, 0.6, LW - 3, 10.2, 1.0, acc, 5);
    if (lvl >= 3) gb.box(LW / 2 - 4, H + 1.0, 1 + inset + 1, LW / 2 + 4, H + 3.4, 1 + inset + 1.4, acc, 5);
  };
  GEN.ind = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, PAL.conc2);
    const lvl = b.level;
    const wall = U.pick(PAL.ind, r), roofc = U.pick(['#5d6266', '#7a7d80', '#6e5f50'], r);
    const wz0 = 7, wz1 = LD - 2, wx0 = 2, wx1 = LW - 2;
    const H = 7 + r() * 3 + lvl * 0.6;
    gb.box(wx0, 0, wz0, wx1, H, wz1, wall, 4, { top: roofc });
    if (r() < 0.5) {
      const n = Math.max(2, Math.floor((wz1 - wz0) / 4.5));
      const step = (wz1 - wz0) / n;
      for (let k = 0; k < n; k++) {
        const za = wz0 + k * step, zb = za + step;
        gb.quad([wx1, H, za], [wx0, H, za], [wx0, H + 2.2, zb], [wx1, H + 2.2, zb], roofc);
        gb.quad([wx0, H, zb], [wx1, H, zb], [wx1, H + 2.2, zb], [wx0, H + 2.2, zb], '#9fb4c4', 9);
        gb.tri([wx0, H, za], [wx0, H, zb], [wx0, H + 2.2, zb], wall);
        gb.tri([wx1, H, zb], [wx1, H, za], [wx1, H + 2.2, zb], wall);
      }
    } else {
      for (let k = 0; k < 3; k++) gb.box(wx0 + 2 + k * 4, H, wz0 + 3, wx0 + 3.6 + k * 4, H + 1.2, wz0 + 4.6, '#8d9094');
    }
    // loading docks
    for (let k = 0; k < Math.min(4, Math.floor((wx1 - wx0) / 4.5)); k++) {
      gb.box(wx0 + 1 + k * 4.4, 0, wz0 - 0.1, wx0 + 4.1 + k * 4.4, 4, wz0, '#3a3d40');
    }
    // office block
    gb.box(wx0, 0, 2.2, wx0 + 7, 6.2, wz0, U.pick(PAL.conc, r), 1);
    // chimneys and tanks
    if (lvl >= 2 || r() < 0.4) {
      const n = 1 + Math.floor(r() * 2) + (lvl >= 4 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const cx = wx1 - 2.5 - k * 3.2, cz = wz1 - 2.5;
        const ch = 14 + r() * 8 + lvl * 1.5;
        gb.cyl(cx, H, cz, 0.9, ch - H, 8, '#8a7a6c');
        gb.cyl(cx, ch - 1.2, cz, 0.95, 1.2, 8, '#c2392e', 0, '#333');
      }
    }
    if (r() < 0.6) {
      const tx = wx0 + 10, tz = 3.6;
      if (tx + 3 < LW - 1) { gb.cyl(tx, 0, tz, 2.2, 6, 10, '#d9d6cf', 0, '#bdb9b1'); if (tx + 8 < LW - 1) gb.cyl(tx + 5, 0, tz, 2.2, 6, 10, '#d9d6cf', 0, '#bdb9b1'); }
    }
    for (let k = 0; k < 3; k++) gb.box(LW - 4.5 - k * 1.8, 0, 1.5, LW - 3.1 - k * 1.8, 1.4, 2.9, U.pick(['#b5642f', '#2d6a9e', '#6e8d3c'], r));
  };
  GEN.office = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, PAL.paved);
    const lvl = b.level;
    const glass = U.pick(PAL.glass, r);
    const floors = 9 + lvl * 4 + Math.floor(r() * 6) + (LD > 25 ? 5 : 0);
    const H = 5 + floors * 3.6;
    const cx = LW / 2, cz = LD / 2;
    gb.box(1.5, 0, 1.5, LW - 1.5, 5, LD - 1.5, '#c9c5bd', 3);
    const sx = LW / 2 - 3, sz = LD / 2 - 3;
    const shape = Math.floor(r() * 3);
    if (shape === 0) {
      gb.box(cx - sx, 5, cz - sz, cx + sx, H, cz + sz, glass, 2, { vb: 1 });
    } else if (shape === 1) {
      const h1 = 5 + (H - 5) * 0.6;
      gb.box(cx - sx, 5, cz - sz, cx + sx, h1, cz + sz, glass, 2, { vb: 1 });
      gb.box(cx - sx + 2, h1, cz - sz + 2, cx + sx - 2, H, cz + sz - 2, glass, 2, { vb: 1 });
    } else {
      gb.box(cx - sx, 5, cz - sz, cx + 1, H, cz + sz, glass, 2, { vb: 1 });
      gb.box(cx + 1, 5, cz - sz + 2, cx + sx, H * 0.75, cz + sz - 2, U.pick(PAL.glass, r), 2, { vb: 1 });
    }
    gb.box(cx - 3, H, cz - 3, cx + 3, H + 2.4, cz + 3, '#555a60');
    if (lvl >= 3) gb.box(cx - sx + 2.2, H - 1.2, cz - sz - 0.06 + (shape === 1 ? 2 : 0), cx + sx - 2.2, H - 0.4, cz - sz + (shape === 1 ? 2 : 0), '#9fd3ff', 5);
    if (lvl >= 5) { gb.cyl(cx, H + 2.4, cz, 0.6, 16, 6, '#c8ccd0', 0, null, 0.1); gb.box(cx - 0.3, H + 18, cz - 0.3, cx + 0.3, H + 18.6, cz + 0.3, '#f33', 7); }
  };

  // ---- services ----
  function cross(gb, x, y, z, s) {
    gb.box(x - 0.35 * s, y - 1.1 * s, z - 0.12, x + 0.35 * s, y + 1.1 * s, z, '#e0282c', 5);
    gb.box(x - 1.1 * s, y - 0.35 * s, z - 0.12, x + 1.1 * s, y + 0.35 * s, z, '#e0282c', 5);
  }
  function field(gb, x0, z0, x1, z1) {
    gb.flat(x0, z0, x1, z1, 0.12, '#4f8f3a');
    const lw = 0.25, c = '#e8e8e0';
    gb.flat(x0 + 0.5, z0 + 0.5, x1 - 0.5, z0 + 0.5 + lw, 0.14, c);
    gb.flat(x0 + 0.5, z1 - 0.5 - lw, x1 - 0.5, z1 - 0.5, 0.14, c);
    gb.flat(x0 + 0.5, z0 + 0.5, x0 + 0.5 + lw, z1 - 0.5, 0.14, c);
    gb.flat(x1 - 0.5 - lw, z0 + 0.5, x1 - 0.5, z1 - 0.5, 0.14, c);
    gb.flat((x0 + x1) / 2 - lw / 2, z0 + 0.5, (x0 + x1) / 2 + lw / 2, z1 - 0.5, 0.14, c);
  }
  const SGEN = {};
  SGEN.police = function (gb, b, r, LW, LD, big) {
    foundation(gb, LW, LD, b, PAL.paved);
    const w = big ? 24 : 14, d = big ? 15 : 10, fl = big ? 4 : 2;
    const x0 = (LW - w) / 2, z0 = 3;
    gb.box(x0, 0, z0, x0 + w, fl * 3.4, z0 + d, '#d9d7d1', 1);
    gb.box(x0 - 0.1, 3.2, z0 - 0.15, x0 + w + 0.1, 3.9, z0 + d + 0.1, '#2c5aa0');
    gb.box(x0 - 0.2, fl * 3.4, z0 - 0.2, x0 + w + 0.2, fl * 3.4 + 0.6, z0 + d + 0.2, '#3c4148');
    gb.box(LW / 2 - 2.5, 2.8, z0 - 2, LW / 2 + 2.5, 3.1, z0, '#2c5aa0');
    gb.box(LW / 2 - 1.6, 3.2, z0 - 0.2, LW / 2 + 1.6, 3.9, z0 - 0.05, '#4a8fe8', 5);
    gb.box(x0 + 1, 0, 1, x0 + 1.2, 9, 1.2, '#ddd');
    gb.box(x0 + 1.2, 7.6, 1.1, x0 + 3.0, 8.8, 1.15, '#3a6fd0');
    const pz = z0 + d + 2.5;
    for (let k = 0; k < (big ? 4 : 2); k++) {
      const x = 3 + k * 4.5;
      gb.box(x - 0.85, 0.1, pz - 2.1, x + 0.85, 1.05, pz + 2.1, '#f2f2f2');
      gb.box(x - 0.86, 0.5, pz - 0.8, x + 0.86, 0.9, pz + 0.8, '#1e3f8a');
      gb.box(x - 0.6, 1.5, pz - 0.2, x + 0.6, 1.7, pz + 0.2, '#3060ff', 5);
    }
    if (big) { gb.cyl(x0 + w - 3, fl * 3.4 + 0.6, z0 + 3, 0.2, 10, 4, '#ccc'); }
  };
  SGEN.policehq = (gb, b, r, LW, LD) => SGEN.police(gb, b, r, LW, LD, true);
  SGEN.fire = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, PAL.paved);
    const x0 = 2, z0 = 3.5, w = 16, d = 12;
    gb.box(x0, 0, z0, x0 + w, 7.4, z0 + d, '#9c3b2c', 1);
    gb.box(x0 - 0.2, 7.4, z0 - 0.2, x0 + w + 0.2, 8.0, z0 + d + 0.2, '#e8e2d6');
    for (let k = 0; k < 3; k++) { gb.box(x0 + 1 + k * 5, 0, z0 - 0.1, x0 + 4.4 + k * 5, 4.3, z0, '#d8d8d4', M8.siding); for (let q = 0; q < 4; q++) gb.box(x0 + 1.3 + k * 5 + q * 0.75, 2.2, z0 - 0.14, x0 + 1.9 + k * 5 + q * 0.75, 2.8, z0 - 0.1, '#fff', 9); gb.box(x0 + 0.8 + k * 5, 4.3, z0 - 0.2, x0 + 4.6 + k * 5, 4.5, z0, '#e8e2d6'); }
    gb.flat(x0 + 0.6, 0.1, x0 + w - 0.6, z0, 0.11, '#a8a59e', M8.concrete);
    gb.box(x0 + w - 3.5, 0, z0 + d - 3.5, x0 + w, 14, z0 + d, '#8a3326', 1);
    gb.pyr(x0 + w - 3.7, z0 + d - 3.7, x0 + w + 0.2, z0 + d + 0.2, 14, 2, '#3a3a3a');
    gb.box(x0 + 2, 5.2, z0 - 0.15, x0 + w - 2, 6.2, z0 - 0.02, '#f2d24a', 5);
  };
  function lumps(gb, x0, z0, x1, z1, y, n, r) {
    for (let k = 0; k < n; k++) { const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0), s = 0.35 + r() * 0.5; gb.box(x - s, y, z - s * 0.8, x + s, y + s * (0.6 + r() * 0.6), z + s * 0.8, U.pick(['#3a3d42', '#5a5a52', '#7a6a4a', '#2f4a6a', '#8a8a80', '#c8c4b8', '#4a5a3a', '#6a3a2a'], r)); }
  }
  function parkingLot(gb, x0, z0, x1, z1, stalls, r, fill) {
    gb.flat(x0, z0, x1, z1, 0.11, '#45474b');
    const sw = (x1 - x0) / stalls;
    for (let k = 0; k <= stalls; k++) gb.flat(x0 + k * sw - 0.06, z0 + 0.3, x0 + k * sw + 0.06, z0 + 5.0, 0.12, '#e6e6df');
    for (let k = 0; k < stalls; k++) if (r() < (fill || 0.6)) parkedCar(gb, x0 + (k + 0.5) * sw, z0 + 2.6, true, r);
  }
  function chainFence(gb, x0, z0, x1, z1, gapX0, gapX1) {
    const post = (x, z) => gb.box(x - 0.05, 0, z - 0.05, x + 0.05, 2.0, z + 0.05, '#7a8086');
    const run = (ax, az, bx, bz) => { for (const y of [0.15, 1.0, 1.9]) gb.box(Math.min(ax, bx) - 0.02, y, Math.min(az, bz) - 0.02, Math.max(ax, bx) + 0.02, y + 0.05, Math.max(az, bz) + 0.02, '#8a9096'); for (let t = 0; t <= 1; t += 0.02) { const x = ax + (bx - ax) * t, z = az + (bz - az) * t; gb.box(x - 0.008, 0.15, z - 0.008, x + 0.008, 1.9, z + 0.008, '#9aa0a6'); } const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 3); for (let k = 0; k <= n; k++) post(ax + (bx - ax) * k / n, az + (bz - az) * k / n); };
    if (gapX0 !== undefined) { run(x0, z0, gapX0, z0); run(gapX1, z0, x1, z0); } else run(x0, z0, x1, z0);
    run(x0, z1, x1, z1); run(x0, z0, x0, z1); run(x1, z0, x1, z1);
  }
  SGEN.clinic = function (gb, b, r, LW, LD, big) {
    foundation(gb, LW, LD, b, '#b8b4ab', M8.paving);
    if (big) { SGEN.hospitalBig(gb, b, r, LW, LD); return; }
    const z0 = 8.2, z1 = LD - 1.5;
    parkingLot(gb, 0.8, 0.6, 12.6, 6.4, 5, r, 0.7);
    // main block: white panels, ribbon windows upstairs
    gb.box(1.5, 0, z0, 13, 0.45, z1, '#9a968e', M8.concrete);
    gb.box(1.5, 0.45, z0, 13, 3.7, z1, '#f0eee8', M8.concrete);
    gb.box(1.5, 3.7, z0, 13, 7.6, z1, '#f0eee8', 2 + M8.concrete);
    gb.box(1.3, 3.55, z0 - 0.15, 13.2, 3.75, z1 + 0.1, '#5a7a8a');
    gb.box(1.3, 7.6, z0 - 0.15, 13.2, 8.1, z1 + 0.15, '#dcdad4', M8.concrete);
    for (let k = 0; k < 4; k++) win(gb, 0, 3 + k * 2.6, 1.0, z0, 1.6, 1.9, { trim: '#5a7a8a' });
    // glass entrance atrium
    gb.box(13, 0, z0 + 1, 18.6, 5.6, z1 - 3, '#fff', 9);
    for (let k = 0; k <= 5; k++) gb.box(13 + k * 1.12 - 0.05, 0, z0 + 0.94, 13 + k * 1.12 + 0.05, 5.6, z0 + 1.0, '#cfd3d6');
    gb.box(13, 2.75, z0 + 0.92, 18.6, 2.85, z0 + 1.0, '#cfd3d6');
    gb.box(12.8, 5.6, z0 + 0.8, 18.8, 6.0, z1 - 2.8, '#dcdad4', M8.concrete);
    // canopy with columns
    gb.box(13.2, 3.2, z0 - 2.4, 18.4, 3.45, z0 + 1, '#e8e6e0', M8.concrete);
    for (const x of [13.6, 18.0]) gb.cyl(x, 0, z0 - 2, 0.16, 3.2, 8, '#cfd3d6');
    gb.box(15.2, 0, z0 + 0.8, 16.6, 2.4, z0 + 0.9, '#3a4a52', 9);
    // red cross signs
    const cross = (x, y, z, s) => { gb.box(x - 0.3 * s, y - 1 * s, z - 0.1, x + 0.3 * s, y + 1 * s, z, '#e0282c', 15); gb.box(x - 1 * s, y - 0.3 * s, z - 0.1, x + 1 * s, y + 0.3 * s, z, '#e0282c', 15); };
    gb.box(10.6, 5.0, z0 - 0.14, 12.6, 7.0, z0 - 0.04, '#ffffff', 5); cross(11.6, 6.0, z0 - 0.15, 0.75);
    gb.box(15.2, 6.0, z0 + 0.7, 17.8, 7.5, z0 + 0.8, '#ffffff', 5); cross(16.5, 6.75, z0 + 0.69, 0.55);
    // ambulance bay
    gb.box(13, 0, z1 - 3, 18.6, 3.6, z1, '#e4e2dc', M8.concrete);
    gb.box(14.2, 0, z1 - 3.06, 17.4, 3.0, z1 - 3, '#d0d2d4', M8.siding);
    gb.flat(13.4, 6.6, 18.6, z1 - 3.1, 0.115, '#8f8d87', M8.concrete);
    for (const z of [9.0, 10.4]) gb.flat(14.4, z, 17.4, z + 0.3, 0.12, '#e3c23a');
    // planting, bench, flagpole
    for (const [x, z] of [[1.2, 7.2], [19, 7.2], [19, LD - 1.2]]) yardTree(gb, x, z, r);
    gb.box(13.6, 0, 6.8, 18.4, 0.5, 7.4, '#8f877a', M8.concrete, { top: '#4f7d34', topSt: M8.lawn });
    for (let k = 0; k < 4; k++) bush(gb, 14.2 + k * 1.2, 7.1, 0.55);
    bench(gb, 16, 6.2, false);
    gb.cyl(19, 0, 1.2, 0.07, 8, 6, '#cfd3d6'); gb.box(19.07, 6.8, 1.2, 20.1, 7.6, 1.24, '#2f6fd0');
    acUnit(gb, 4, z0 + 4); gb.box(6, 8.1, z0 + 3, 9, 9.4, z0 + 6, '#c9ccd0', M8.metal);
  };
  SGEN.garbage = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, '#8f8d87', M8.concrete);
    // yard paving and stains
    gb.flat(0.6, 0.6, LW - 0.6, LD - 0.6, 0.11, '#7d7b75', M8.concrete);
    for (let k = 0; k < 6; k++) { const x = 3 + r() * 22, z = 2 + r() * 4; gb.flat(x - 0.8, z - 0.5, x + 0.8, z + 0.5, 0.115, '#5a5852'); }
    // tipping shed: corrugated walls, standing-seam roof
    const x0 = 1.5, x1 = 19.5, z0 = 6.5, z1 = LD - 1.2, H = 9.5;
    gb.box(x0, 0, z0, x1, 1.2, z1, '#8a8780', M8.concrete);
    gb.box(x0, 1.2, z0, x1, H, z1, '#6f8f7a', M8.metal);
    gb.gable(x0 - 0.4, z0 - 0.4, x1 + 0.4, z1 + 0.4, H, 2.2, true, '#5b6560', '#6f8f7a', M8.seam, M8.metal);
    // three big bays, one door half up
    for (let k = 0; k < 3; k++) {
      const a0 = x0 + 1 + k * 5.6, a1 = a0 + 4.6;
      gb.box(a0, 0.05, z0 - 0.06, a1, 6.2, z0 + 0.2, '#16181b');
      gb.box(a0 - 0.25, 6.2, z0 - 0.14, a1 + 0.25, 6.6, z0 + 0.02, '#3a3d42');
      if (k === 2) gb.box(a0, 3.2, z0 - 0.1, a1, 6.2, z0 - 0.04, '#9aa0a6', M8.metal);
      lumps(gb, a0 + 0.2, z0 + 0.4, a1 - 0.2, z0 + 3.5, 0.05, 9, r);
      gb.box(a0 - 0.6, 0, z0 - 0.3, a0 - 0.3, 1.0, z0, '#e3c23a'); gb.box(a1 + 0.3, 0, z0 - 0.3, a1 + 0.6, 1.0, z0, '#e3c23a');
    }
    gb.box(x0 + 2, 0, z0 - 0.06, x0 + 2.1, 0.02, z0 - 0.01, '#fff');
    gb.cyl(x1 - 2.5, H + 1.6, z0 + 6, 0.5, 3.8, 10, '#9aa0a6', M8.metal, '#555');
    gb.box(x0 + 3, H + 1.2, z1 - 4, x0 + 6, H + 2.0, z1 - 2, '#9aa0a6', M8.metal);
    // scale house and weighbridge
    gb.box(22, 0, 1.6, 27.5, 3.2, 5.2, '#d8d4ca', M8.siding);
    gb.box(21.8, 3.2, 1.4, 27.7, 3.45, 5.4, '#3a3d42');
    win(gb, 2, 3.4, 1.1, 22, 1.6, 1.2, { trim: '#3a3d42' }); win(gb, 0, 24.7, 1.1, 1.6, 2.2, 1.2, { trim: '#3a3d42' });
    doorway(gb, 26.4, 1.6, '#3a4a52', '#3a3d42', false);
    gb.box(15, 0.05, 1.4, 21, 0.2, 4.6, '#6a6e72', M8.seam);
    // roll-off containers with garbage
    const cc = ['#2f6a3a', '#2a4a7a', '#7a2a22', '#2f6a3a'];
    for (let k = 0; k < 3; k++) {
      const cz = 7.5 + k * 4.2;
      extrude(gb, [[21.5, 0.1], [28.5, 0.1], [28.8, 2.2], [21.2, 2.2]], cz, cz + 2.4, cc[k], M8.metal);
      lumps(gb, 21.6, cz + 0.2, 28.4, cz + 2.2, 1.8, 10, r);
      for (let q = 0; q < 6; q++) gb.box(21.8 + q * 1.25, 0.2, cz - 0.02, 21.9 + q * 1.25, 2.1, cz, '#1c1d20');
    }
    // fence with gate gap on the road side
    chainFence(gb, 0.4, 0.4, LW - 0.4, LD - 0.4, 3, 14.5);
    for (const x of [3, 14.5]) gb.box(x - 0.18, 0, 0.22, x + 0.18, 2.4, 0.58, '#3a3d42');
    lampPost(gb, 20.5, 6); lampPost(gb, 1.2, 4);
  };
  SGEN.hospital = (gb, b, r, LW, LD) => SGEN.clinic(gb, b, r, LW, LD, true);
  SGEN.hospitalBig = function (gb, b, r, LW, LD) {
    const x0 = 3, z0 = 3;
    gb.box(x0, 0, z0, LW - 3, 4.2, LD - 6, '#e6e4de', 3 + M8.concrete);
    gb.box(x0 + 2, 4.2, z0 + 2, LW - 5, 20, z0 + 12, '#f0eee8', 2 + M8.concrete, { vb: 0.4 });
    gb.box(LW - 13, 4.2, z0 + 12, LW - 5, 12, LD - 7, '#e1dfd8', 2 + M8.concrete, { vb: 0.4 });
    gb.box(x0 + 1.8, 20, z0 + 1.8, LW - 4.8, 20.8, z0 + 12.2, '#6c7a86');
    gb.cyl(x0 + 10, 20.8, z0 + 7, 4, 0.3, 16, '#505860', 0, '#3e454c');
    gb.box(x0 + 7.4, 21.1, z0 + 6.85, x0 + 12.6, 21.15, z0 + 7.15, '#f2f2f2'); gb.box(x0 + 9.85, 21.1, z0 + 4.4, x0 + 10.15, 21.15, z0 + 9.6, '#f2f2f2');
    gb.box(LW / 2 - 1.2, 14, z0 + 1.88, LW / 2 + 1.2, 18, z0 + 2, '#e0282c', 15); gb.box(LW / 2 - 2, 15.2, z0 + 1.88, LW / 2 + 2, 16.8, z0 + 2, '#e0282c', 15);
    gb.box(LW / 2 - 4, 3.2, z0 - 3, LW / 2 + 4, 3.5, z0, '#d8d8d8', M8.concrete);
    parkingLot(gb, 1, LD - 5.6, LW - 1, LD - 0.6, 10, r, 0.7);
  };
  SGEN.elem = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, U.pick(PAL.lawn, r));
    const br = U.pick(PAL.brick, r);
    gb.box(1.5, 0, 2.5, 17, 7, 9.5, br, 1);
    gb.box(1.5, 7, 2.3, 17, 7.5, 9.7, '#5a5550');
    gb.box(1.5, 0, 9.5, 7.5, 6, 15, br, 1);
    gb.box(LW / 2 - 2, 2.8, 0.6, LW / 2 + 2, 3.1, 2.5, '#e3a02b');
    field(gb, 9, 11, 18.5, 19);
    gb.box(3, 0, 16.5, 3.4, 2.4, 16.9, '#e3402b'); gb.box(5, 0, 16.5, 5.4, 2.4, 16.9, '#e3402b');
    gb.box(2.8, 2.4, 16.4, 5.6, 2.6, 17, '#2f86c9');
  };
  SGEN.high = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, U.pick(PAL.lawn, r));
    const br = U.pick(PAL.brick, r);
    gb.box(2, 0, 2.5, 26, 10.4, 12, br, 1);
    gb.box(1.8, 10.4, 2.3, 26.2, 11, 12.2, '#56514c');
    gb.box(20, 0, 12, 28, 8, 20, '#c9c5bb', 4);
    gb.flat(2, 14, 19, 28, 0.1, '#a5523c');
    field(gb, 4, 16, 17, 26);
    gb.box(LW / 2 - 3, 3.0, 0.5, LW / 2 + 3, 3.3, 2.5, '#2f86c9');
  };
  SGEN.univ = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, U.pick(PAL.lawn, r));
    const st = '#c9b48f', rf = '#4e5a63';
    gb.box(10, 0, 3, 30, 12, 12, st, 1);
    gb.gable(9.6, 2.6, 30.4, 12.4, 12, 4, true, rf, st);
    gb.box(17.5, 0, 1.5, 22.5, 26, 6, st, 1);
    gb.pyr(17.2, 1.2, 22.8, 6.3, 26, 6, rf);
    gb.box(19, 20, 1.45, 21, 22, 1.5, '#f4f0e0', 5);
    gb.box(3, 0, 15, 11, 9, 36, '#b8a07a', 1);
    gb.box(29, 0, 15, 37, 9, 36, '#b8a07a', 1);
    gb.box(13, 0, 30, 27, 8, 37, st, 1);
    gb.flat(19, 12, 21, 30, 0.12, '#cfc6b0');
    gb.flat(11, 20, 29, 22, 0.12, '#cfc6b0');
    for (let k = 0; k < 6; k++) yardTree(gb, 13.5 + (k % 3) * 6.5, 15.5 + Math.floor(k / 3) * 8.5, r);
  };
  SGEN.plaza = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, '#c9c0ae');
    gb.cyl(10, 0, 10, 4, 0.7, 14, '#b7b0a2', 0, '#1d6f8a');
    gb.cyl(10, 0.7, 10, 3.6, 0.02, 14, '#1d6f8a', 13);
    gb.cyl(10, 0.7, 10, 0.6, 2.6, 8, '#d8d2c4');
    gb.cyl(10, 3.3, 10, 1.4, 0.3, 8, '#d8d2c4');
    for (const [x, z] of [[3, 3], [17, 3], [3, 17], [17, 17]]) { gb.box(x - 1.4, 0, z - 1.4, x + 1.4, 0.7, z + 1.4, '#8f877a', 0, { top: '#4f7d34' }); yardTree(gb, x, z, r); }
    for (const z of [7, 13]) { gb.box(1.5, 0, z, 3.5, 0.5, z + 0.5, '#7a5a3c'); gb.box(16.5, 0, z, 18.5, 0.5, z + 0.5, '#7a5a3c'); }
  };
  SGEN.bigpark = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, '#5c9840');
    gb.cyl(26, 0.0, 26, 8, 0.14, 12, '#1d6f8a', 13);
    gb.flat(19, 0.5, 21, 39.5, 0.11, '#cdbf9a');
    gb.flat(0.5, 13, 39.5, 15, 0.11, '#cdbf9a');
    gb.cyl(9, 0, 30, 3, 0.4, 8, '#d8d2c4');
    for (let k = 0; k < 4; k++) gb.box(6.5 + k * 1.6, 0.4, 28.9, 6.7 + k * 1.6, 3.2, 29.1, '#d8d2c4');
    gb.pyr(5.5, 26.5, 12.5, 33.5, 3.2, 2.2, '#6b3e2e');
    for (let k = 0; k < 18; k++) {
      const x = 2 + r() * 36, z = 2 + r() * 36;
      if (Math.hypot(x - 26, z - 26) < 9.5 || Math.abs(x - 20) < 2 || Math.abs(z - 14) < 2 || Math.hypot(x - 9, z - 30) < 4.5) continue;
      yardTree(gb, x, z, r);
    }
  };
  SGEN.stadium = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, PAL.paved);
    const cx = LW / 2, cz = LD / 2, seg = 20;
    gb.cyl(cx, 0, cz, 18.5, 13, seg, '#d6d3cc', 4, false);
    // stands (facing inward)
    for (let k = 0; k < seg; k++) {
      const a1 = k / seg * Math.PI * 2, a2 = (k + 1) / seg * Math.PI * 2;
      const p = (a, rr, y) => [cx + Math.cos(a) * rr, y, cz + Math.sin(a) * rr];
      gb.quad(p(a1, 11, 1), p(a2, 11, 1), p(a2, 18.3, 12.5), p(a1, 18.3, 12.5), k % 2 ? '#2f5f9e' : '#2a5590');
      gb.quad(p(a1, 18.3, 12.5), p(a2, 18.3, 12.5), p(a2, 18.5, 13), p(a1, 18.5, 13), '#b8b5ae');
    }
    gb.flat(cx - 9, cz - 6, cx + 9, cz + 6, 0.5, '#3f8f34');
    gb.flat(cx - 0.1, cz - 6, cx + 0.1, cz + 6, 0.52, '#eee');
    for (const [x, z] of [[3, 3], [LW - 3, 3], [3, LD - 3], [LW - 3, LD - 3]]) {
      gb.box(x - 0.3, 0, z - 0.3, x + 0.3, 24, z + 0.3, '#9a9a9a');
      gb.box(x - 1.5, 24, z - 1.5, x + 1.5, 25.5, z + 1.5, '#fff', 8);
    }
  };
  SGEN.tower = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, '#c9c0ae');
    const cx = LW / 2, cz = LD / 2;
    gb.cyl(cx, 0, cz, 5, 4, 12, '#bdb7aa', 3);
    gb.cyl(cx, 4, cz, 2.4, 92, 12, '#d8d4cb');
    gb.cyl(cx, 92, cz, 3.2, 3, 16, '#d8d4cb', 0, null, 7);
    gb.cyl(cx, 95, cz, 7, 6, 16, '#7d95a3', 2);
    gb.cyl(cx, 101, cz, 7, 1.2, 16, '#e0dcd2', 0, '#e0dcd2', 5);
    gb.cyl(cx, 102.2, cz, 0.5, 26, 6, '#cfcfcf', 0, null, 0.15);
    gb.box(cx - 0.4, 128, cz - 0.4, cx + 0.4, 129, cz + 0.4, '#f22', 7);
  };
  SGEN.recycle = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, PAL.conc2);
    gb.box(2, 0, 6, 20, 10, 20, '#3f7a6a', 4, { top: '#56605c' });
    gb.box(20, 0, 9, 27, 7, 18, '#6f9a8a', 1);
    for (let k = 0; k < 4; k++) gb.box(3 + k * 4.2, 0, 5.9, 6.3 + k * 4.2, 5, 6, '#33383a');
    for (let k = 0; k < 4; k++) gb.box(2.5 + k * 3.2, 0, 1.5, 5 + k * 3.2, 1.8, 4, U.pick(['#2f86c9', '#3aa36a', '#e3a02b', '#9aa3a8'], r));
    gb.cyl(24, 7, 13, 1.2, 9, 8, '#c8ccd0');
    gb.box(8, 10, 10, 14, 10.4, 12, '#3aa36a', 5);
  };
  SGEN.firehq = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, PAL.paved);
    gb.box(2, 0, 3.5, 26, 8.4, 17, '#9c3b2c', 1);
    gb.box(1.8, 8.4, 3.3, 26.2, 9.0, 17.2, '#e8e2d6');
    for (let k = 0; k < 5; k++) gb.box(3 + k * 4.6, 0, 3.4, 6.6 + k * 4.6, 4.5, 3.5, '#c43a2a');
    gb.box(22, 0, 17, 27, 18, 22, '#8a3326', 1); gb.pyr(21.8, 16.8, 27.2, 22.2, 18, 2.5, '#3a3a3a');
    gb.box(4, 5.4, 3.35, 24, 6.6, 3.45, '#f2d24a', 5);
    for (let k = 0; k < 3; k++) gb.box(3 + k * 5, 0.1, 22, 4.7 + k * 5, 2.4, 28, '#c8231c');
  };
  // ---- parks ----
  const grass = (gb, b, LW, LD, c) => foundation(gb, LW, LD, b, c || '#5f9a40');
  SGEN.playground = function (gb, b, r, LW, LD) {
    grass(gb, b, LW, LD); gb.flat(1, 1, 9, 9, 0.11, '#c9a87a');
    swing(gb, 3.4, 2.6); slide(gb, 6.8, 4.5, U.pick(['#2f86c9', '#d9473c', '#3aa36a'], r));
    gb.cyl(3, 0.1, 7, 1.0, 0.4, 10, '#e3a02b', 0, '#d8c4a0'); bench(gb, 8.4, 8.6, false); yardTree(gb, 1.2, 8.8, r);
  };
  SGEN.grove = function (gb, b, r, LW, LD) {
    grass(gb, b, LW, LD, '#557f38');
    windingPath(gb, [[0, 3], [3, 4.5], [6, 4], [10, 6.5]], 1.1, '#a8916a');
    grove(gb, 0.5, 0.5, 9.5, 2.8, 3, r); grove(gb, 0.5, 6, 9.5, 9.5, 3, r); bench(gb, 5, 5.4, false);
  };
  SGEN.miniplaza = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, '#c9c0ae');
    gb.flat(0.6, 0.6, 9.4, 9.4, 0.11, '#b8ad98');
    statue(gb, 5, 5, 1.1, U.pick(['#6f8a7a', '#8a7a5a', '#5a6a8a'], r));
    for (const [x, z] of [[1.5, 1.5], [8.5, 1.5], [1.5, 8.5], [8.5, 8.5]]) { gb.box(x - 0.8, 0, z - 0.8, x + 0.8, 0.6, z + 0.8, '#8f877a', 0, { top: '#4f7d34' }); bush(gb, x, z, 0.7); }
    bench(gb, 5, 1.6, false); bench(gb, 5, 8.4, false); lampPost(gb, 2.5, 5); lampPost(gb, 7.5, 5);
  };
  SGEN.garden = function (gb, b, r, LW, LD) {
    grass(gb, b, LW, LD);
    for (let k = 0; k < 5; k++) for (let j = 0; j < 2; j++) gb.box(1 + j * 4.4, 0, 1.5 + k * 3.4, 4.4 + j * 4.4, 0.35, 3.6 + k * 3.4, '#6a4a32', 0, { top: U.pick(['#4a7a36', '#5c8a3a', '#7a9a3a', '#3f6b30'], r) });
    gb.box(1, 0, LD - 3, 3.5, 2.2, LD - 1, '#8a6a4a', 0, { top: '#6b3e2e' });
    fence(gb, 0.2, 0.2, LW - 0.2, 0.35, '#b49a78');
    gb.cyl(7, 0.05, LD - 2, 0.6, 0.9, 8, '#2f6f9a');
  };
  SGEN.court = function (gb, b, r, LW, LD) {
    grass(gb, b, LW, LD); court(gb, 1, 2, 9, 18, '#c0603a');
    for (const z of [2.8, 17.2]) { gb.box(4.85, 0, z - 0.1, 5.15, 3.0, z + 0.1, '#666'); gb.box(4.4, 3.0, z - 0.1, 5.6, 3.8, z + 0.1, '#f2f2f2'); }
    fence(gb, 0.6, 1.6, 0.7, 18.4, '#7a8a90'); fence(gb, 9.3, 1.6, 9.4, 18.4, '#7a8a90'); bench(gb, 0.4, 10, true);
  };
  SGEN.dogpark = function (gb, b, r, LW, LD) {
    grass(gb, b, LW, LD, '#6a9a44');
    fence(gb, 0.4, 0.4, LW - 0.4, 0.5, '#7a8a90'); fence(gb, 0.4, LD - 0.5, LW - 0.4, LD - 0.4, '#7a8a90'); fence(gb, 0.4, 0.4, 0.5, LD - 0.4, '#7a8a90'); fence(gb, LW - 0.5, 0.4, LW - 0.4, LD - 0.4, '#7a8a90');
    for (let k = 0; k < 4; k++) gb.box(4 + k * 3, 0, 4.6, 4.3 + k * 3, 0.6 + (k % 2) * 0.4, 5.4, '#e3a02b');
    gb.cyl(14, 0, 3, 0.9, 0.5, 10, '#3a7a9a'); yardTree(gb, 2, 2, r); yardTree(gb, LW - 2, LD - 2.5, r); bench(gb, 16, 7.8, false);
  };
  SGEN.benches = function (gb, b, r, LW, LD) {
    grass(gb, b, LW, LD); pathStrip(gb, 0, 4.2, LW, 5.8, '#cdbf9a');
    for (let k = 0; k < 4; k++) { yardTree(gb, 2.5 + k * 5, 2, r); bench(gb, 2.5 + k * 5, 3.6, false); }
    for (let k = 0; k < 3; k++) { bush(gb, 5 + k * 5, 7.6, 0.9); } lampPost(gb, 5, 6.4); lampPost(gb, 15, 6.4);
  };
  SGEN.park = function (gb, b, r, LW, LD) {
    grass(gb, b, LW, LD);
    windingPath(gb, [[0.5, 9.5], [4, 6], [6, 4.5], [9.5, 0.5]], 1.3);
    yardTree(gb, 2.5, 3, r); yardTree(gb, 7.2, 7.4, r); if (r() < 0.6) yardTree(gb, 2.6, 7.6, r);
    bench(gb, 6.6, 2.4, false); flowerBed(gb, 6.5, 5.6, 8.5, 6.6, r);
  };
  SGEN.trail = function (gb, b, r, LW, LD) {
    grass(gb, b, LW, LD, '#4f7a34');
    windingPath(gb, [[0, 4], [5, 6], [9, 12], [14, 13], [17, 8], [20, 10]], 1.3, '#a8916a');
    windingPath(gb, [[9, 12], [8, 17], [11, 20]], 1.1, '#a8916a');
    grove(gb, 1, 9, 7, 19, 6, r, true); grove(gb, 12, 1, 19, 7, 6, r); grove(gb, 14, 15, 19, 19, 3, r);
    bench(gb, 14, 11.6, false); gb.box(3, 0, 1.5, 4.5, 0.4, 2, '#6a5a4a');
  };
  SGEN.bigplay = function (gb, b, r, LW, LD) {
    grass(gb, b, LW, LD); gb.flat(1, 1, 19, 19, 0.11, '#c9a87a');
    // play tower
    gb.box(8, 0, 8, 12, 3, 12, '#d9473c'); gb.box(7.6, 3, 7.6, 12.4, 3.3, 12.4, '#2f86c9'); gb.pyr(7.6, 7.6, 12.4, 12.4, 3.3, 2.4, '#e3a02b');
    slide(gb, 10, 12.2, '#3aa36a'); swing(gb, 4, 3); swing(gb, 16, 3);
    gb.cyl(4, 0.1, 15, 1.6, 0.5, 12, '#2f86c9', 0, '#d8c4a0'); gb.cyl(16, 0.1, 15, 1.2, 0.9, 6, '#8c4fc0');
    for (let k = 0; k < 5; k++) gb.box(13 + k * 1.1, 0, 7.5, 13.5 + k * 1.1, 0.4 + k * 0.4, 8.5, '#e3a02b');
    bench(gb, 2, 9, true); bench(gb, 18, 9, true); yardTree(gb, 1.5, 18.5, r); yardTree(gb, 18.5, 18.5, r);
  };
  SGEN.skate = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, '#b8b4ab');
    gb.flat(1, 1, 19, 19, 0.11, '#a9a69f');
    // half pipe
    for (let k = 0; k < 6; k++) { const a0 = k / 6 * Math.PI / 2, a1 = (k + 1) / 6 * Math.PI / 2; for (const sgn of [1, -1]) { const z0 = 10 + sgn * (6 - Math.cos(a0) * 4), z1 = 10 + sgn * (6 - Math.cos(a1) * 4); gb.quad([4, 0.1 + Math.sin(a0) * 2.6 * 0 + (1 - Math.cos(a0)) * 2.6, z0], [16, (1 - Math.cos(a0)) * 2.6 + 0.1, z0], [16, (1 - Math.cos(a1)) * 2.6 + 0.1, z1], [4, (1 - Math.cos(a1)) * 2.6 + 0.1, z1], '#c9c5bb'); } }
    gb.box(4, 0, 2, 16, 2.7, 4, '#9a968e'); gb.box(4, 0, 16, 16, 2.7, 18, '#9a968e');
    gb.box(1.5, 0, 8, 3, 0.6, 12, '#7a7d80'); gb.box(17, 0, 9, 18.5, 0.9, 11, '#7a7d80');
    gb.box(2, 0, 1.5, 2.2, 2.4, 1.7, '#3a3d42'); lampPost(gb, 18.5, 1.5); lampPost(gb, 1.5, 18.5);
  };
  SGEN.meadow = function (gb, b, r, LW, LD) {
    grass(gb, b, LW, LD, '#6fa044');
    windingPath(gb, [[10, 0], [9, 8], [12, 16], [10, 30]], 1.4);
    for (let k = 0; k < 5; k++) { const x = 2 + r() * 5, z = 3 + k * 5.5; gb.box(x - 1, 0, z - 0.7, x + 1, 0.75, z + 0.7, '#8a6a4a'); }
    for (let k = 0; k < 4; k++) { const x = 14 + r() * 4, z = 4 + k * 6.5; gb.flat(x - 1, z - 1, x + 1, z + 1, 0.12, U.pick(['#d9473c', '#2f86c9', '#e3a02b'], r)); }
    grove(gb, 1, 24, 8, 29, 4, r); grove(gb, 14, 25, 19, 29, 3, r); pond(gb, 15, 12, 2.2);
  };
  SGEN.soccer = function (gb, b, r, LW, LD) {
    grass(gb, b, LW, LD); field(gb, 1.5, 2, 18.5, 28);
    for (const z of [2.3, 27.7]) { gb.box(7.5, 0, z - 0.1, 7.7, 2.2, z + 0.1, '#fff'); gb.box(12.3, 0, z - 0.1, 12.5, 2.2, z + 0.1, '#fff'); gb.box(7.5, 2.2, z - 0.1, 12.5, 2.4, z + 0.1, '#fff'); }
    for (const z of [8, 15, 22]) gb.box(18.8, 0, z - 2, 19.8, 1.2, z + 2, '#7a8a90');
    for (const [x, z] of [[0.6, 0.6], [19.4, 0.6], [0.6, 29.4], [19.4, 29.4]]) { gb.box(x - 0.15, 0, z - 0.15, x + 0.15, 9, z + 0.15, '#9a9a9a'); gb.box(x - 0.7, 9, z - 0.7, x + 0.7, 9.6, z + 0.7, '#fff', 8); }
  };
  SGEN.flowers = function (gb, b, r, LW, LD) {
    grass(gb, b, LW, LD, '#649a44');
    pathStrip(gb, 9.2, 0, 10.8, 20); pathStrip(gb, 0, 9.2, 20, 10.8);
    for (const [x0, z0] of [[1.5, 1.5], [12, 1.5], [1.5, 12], [12, 12]]) { flowerBed(gb, x0, z0, x0 + 6.5, z0 + 2.4, r); flowerBed(gb, x0, z0 + 3.6, x0 + 6.5, z0 + 6, r); }
    gb.box(8.5, 0, 8.5, 11.5, 3.5, 11.5, '#e8e4dc'); gb.pyr(8.2, 8.2, 11.8, 11.8, 3.5, 2.2, '#3f8a6a');
  };
  SGEN.woods = function (gb, b, r, LW, LD) {
    grass(gb, b, LW, LD, '#4a7230');
    windingPath(gb, [[0, 20], [8, 17], [15, 22], [22, 18], [30, 24], [40, 21]], 1.4, '#a8916a');
    windingPath(gb, [[15, 22], [17, 30], [13, 40]], 1.2, '#a8916a'); windingPath(gb, [[22, 18], [25, 8], [21, 0]], 1.2, '#a8916a');
    pond(gb, 31, 33, 3.5);
    for (let k = 0; k < 45; k++) { const x = 1 + r() * 38, z = 1 + r() * 38; if (Math.abs(z - 20 - Math.sin(x * 0.2) * 2.5) < 2.5 || Math.hypot(x - 31, z - 33) < 5) continue; gb.tree(x, 0, z, 0.75 + r() * 0.55, U.pick(['#2c5a2f', '#36663a', '#3f6b30', '#4f7d34'], r), r() < 0.55); }
    gb.box(8, 0, 17.6, 9.6, 0.5, 18.1, '#6a5a4a'); gb.box(34, 0, 28, 37, 2.6, 30.5, '#7a5a3c', 0, { top: '#5a3d28' });
  };
  SGEN.grandplaza = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, '#cfc6b2');
    for (let k = 0; k < 6; k++) gb.flat(1 + k * 4.7, 1, 1.3 + k * 4.7, 29, 0.115, '#b8ad98');
    fountain(gb, 15, 15, 1.6);
    for (const [x, z] of [[4, 4], [26, 4], [4, 26], [26, 26]]) { statue(gb, x, z, 1, '#8a7a5a'); }
    for (let k = 0; k < 6; k++) { yardTree(gb, 2 + k * 5.2, 9.5, r); yardTree(gb, 2 + k * 5.2, 20.5, r); }
    for (let k = 0; k < 4; k++) { bench(gb, 6 + k * 6, 11.4, false); bench(gb, 6 + k * 6, 18.6, false); lampPost(gb, 3 + k * 8, 15); }
  };
  SGEN.lakepark = function (gb, b, r, LW, LD) {
    grass(gb, b, LW, LD);
    gb.cyl(22, 0, 15, 11, 0.16, 20, '#1d6f8a', 13, '#1d6f8a');
    gb.cyl(22, 0, 15, 11.6, 0.12, 20, '#a9a28c', 0, '#a9a28c');
    gb.box(10, 0.1, 14, 16, 0.5, 16, '#8a6a4a'); gb.box(8, 0, 12.5, 11, 2.6, 17.5, '#7a5a3c', 0, { top: '#6b3e2e' });
    windingPath(gb, [[0, 3], [10, 2.5], [22, 2.5], [36, 4], [40, 10]], 1.3); windingPath(gb, [[0, 27], [14, 28], [30, 28], [40, 22]], 1.3);
    grove(gb, 1, 6, 8, 25, 7, r); grove(gb, 35, 14, 39, 27, 5, r);
    gb.box(25, 0.1, 18, 27, 0.9, 19, '#f2f2f2'); gb.box(19, 0.1, 10, 21, 0.9, 11, '#e3a02b');
  };
  SGEN.zen = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, '#d9d2c0');
    for (let k = 0; k < 12; k++) gb.flat(2, 2 + k * 1.1, 17, 2.4 + k * 1.1, 0.115, '#c9c1ad');
    for (const [x, z, sc] of [[6, 6, 1.4], [11, 9, 1], [14, 5, 0.8]]) gb.cone(x, 0, z, 1.1 * sc, 1.3 * sc, 6, '#7a7d80');
    pond(gb, 22, 22, 4);
    gb.box(18, 0.6, 21.5, 26, 0.9, 22.5, '#b0382c');
    gb.box(3, 0, 20, 9, 3, 26, '#6a4a32'); gb.gable(2.4, 19.4, 9.6, 26.6, 3, 2.4, true, '#2f3640', '#6a4a32');
    for (const x of [24, 27]) gb.box(x, 0, 3, x + 0.4, 4, 3.4, '#b0382c'); gb.box(23.5, 4, 2.8, 28, 4.5, 3.6, '#b0382c');
    for (let k = 0; k < 6; k++) gb.tree(13 + r() * 14, 0, 8 + r() * 8, 0.65, U.pick(['#b04a6a', '#c96a8a', '#4f7d34'], r), false);
  };
  SGEN.sports = function (gb, b, r, LW, LD) {
    grass(gb, b, LW, LD);
    field(gb, 2, 2, 24, 38);
    court(gb, 27, 2, 38, 13, '#3a7aa0'); court(gb, 27, 15, 38, 26, '#3a8a5a');
    gb.cyl(32.5, 0.1, 33, 5, 0.2, 16, '#c0603a', 0, '#c0603a'); gb.cyl(32.5, 0.15, 33, 3.6, 0.2, 16, '#5f9a40', 0, '#5f9a40');
    gb.box(0.5, 0, 12, 1.8, 2.5, 28, '#c9c5bb'); gb.box(24.5, 0, 14, 26, 3.4, 26, '#e0ddd5', 1);
    for (const [x, z] of [[1, 1], [25, 1], [1, 39], [25, 39]]) { gb.box(x - 0.2, 0, z - 0.2, x + 0.2, 12, z + 0.2, '#9a9a9a'); gb.box(x - 1, 12, z - 1, x + 1, 12.8, z + 1, '#fff', 8); }
  };
  SGEN.amphi = function (gb, b, r, LW, LD) {
    grass(gb, b, LW, LD);
    const cx = 15, cz = 26;
    for (let k = 0; k < 6; k++) { const rr = 6 + k * 2; for (let s = 0; s < 10; s++) { const a0 = Math.PI + s / 10 * Math.PI, a1 = Math.PI + (s + 1) / 10 * Math.PI; gb.quad([cx + Math.cos(a1) * rr, k * 0.6 + 0.6, cz + Math.sin(a1) * rr], [cx + Math.cos(a0) * rr, k * 0.6 + 0.6, cz + Math.sin(a0) * rr], [cx + Math.cos(a0) * (rr + 2), k * 0.6 + 0.6, cz + Math.sin(a0) * (rr + 2)], [cx + Math.cos(a1) * (rr + 2), k * 0.6 + 0.6, cz + Math.sin(a1) * (rr + 2)], '#cfc8b8'); } }
    gb.box(cx - 7, 0, cz + 1, cx + 7, 1.2, cz + 7, '#a59b8a');
    gb.box(cx - 7, 1.2, cz + 6, cx + 7, 7, cz + 7, '#e8e4dc'); gb.box(cx - 7.4, 7, cz + 1, cx + 7.4, 7.5, cz + 7.5, '#3c5060');
    grove(gb, 1, 1, 29, 6, 8, r); windingPath(gb, [[0, 9], [15, 7.5], [30, 9]], 1.4);
  };
  // ---- landmarks (code & AI themed) ----
  SGEN.claude = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, '#e8dccb');
    const st = '#d97757', cr = '#f0e6d8';
    // arch made of segments
    const cx = 15, cz = 15, R0 = 9, R1 = 12.5, seg = 14;
    for (let k = 0; k < seg; k++) {
      const a0 = Math.PI * k / seg, a1 = Math.PI * (k + 1) / seg;
      const p = (a, rr, z) => [cx + Math.cos(a) * rr, Math.sin(a) * rr * 2.1 + 0.4, z];
      for (const z of [cz - 2.5, cz + 2.5]) { gb.quad(p(a0, R0, z), p(a1, R0, z), p(a1, R1, z), p(a0, R1, z), st); gb.quad(p(a1, R0, z), p(a0, R0, z), p(a0, R1, z), p(a1, R1, z), st); }
      gb.quad(p(a0, R1, cz - 2.5), p(a1, R1, cz - 2.5), p(a1, R1, cz + 2.5), p(a0, R1, cz + 2.5), st);
      gb.quad(p(a1, R0, cz - 2.5), p(a0, R0, cz - 2.5), p(a0, R0, cz + 2.5), p(a1, R0, cz + 2.5), cr);
    }
    // the spark on top: eight rays
    const sy = R1 * 2.1 + 4;
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2, L = k % 2 ? 2.6 : 4; gb.box(cx - 0.35, sy - 0.35, cz - 0.35, cx + 0.35, sy + 0.35, cz + 0.35, st, 5); gb.quad([cx, sy, cz - 0.4], [cx, sy, cz + 0.4], [cx + Math.cos(a) * L, sy + Math.sin(a) * L, cz + 0.05], [cx + Math.cos(a) * L, sy + Math.sin(a) * L, cz - 0.05], st, 5); gb.quad([cx, sy, cz + 0.4], [cx, sy, cz - 0.4], [cx + Math.cos(a) * L, sy + Math.sin(a) * L, cz - 0.05], [cx + Math.cos(a) * L, sy + Math.sin(a) * L, cz + 0.05], st, 5); }
    gb.flat(13, 0.5, 17, 29.5, 0.11, '#c9b9a0');
    for (const x of [4, 26]) { yardTree(gb, x, 4, r); yardTree(gb, x, 26, r); }
  };
  SGEN.vscode = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, PAL.paved);
    const blue = '#1f8ad2', dark = '#0e5c99', H = 70;
    // the logo seen from above: a folded ribbon. Built as three extruded slabs.
    gb.box(19, 0, 4, 25, H, 26, blue, 2, { vb: 0 });                    // right bar (tall)
    const slant = (x0, z0, x1, z1, w, h, col) => { const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz), nx = -dz / l * w / 2, nz = dx / l * w / 2; const A = [x0 + nx, 0, z0 + nz], B = [x1 + nx, 0, z1 + nz], Cc = [x1 - nx, 0, z1 - nz], D = [x0 - nx, 0, z0 - nz]; const up = p => [p[0], h, p[2]]; gb.quad(A, B, up(B), up(A), col, 2); gb.quad(Cc, D, up(D), up(Cc), col, 2); gb.quad(B, Cc, up(Cc), up(B), col, 2); gb.quad(D, A, up(A), up(D), col, 2); gb.quad(up(A), up(B), up(Cc), up(D), col); };
    slant(20, 6, 6, 18, 4.5, H * 0.72, dark);
    slant(20, 24, 6, 12, 4.5, H * 0.72, blue);
    gb.box(4, 0, 12, 8, H * 0.5, 18, dark, 2);
    gb.box(18.8, H, 3.8, 25.2, H + 1, 26.2, '#16486e');
    gb.box(21.5, H + 1, 14, 22.5, H + 9, 15, '#ccc'); gb.box(21.6, H + 9, 14.1, 22.4, H + 9.6, 14.9, '#f22', 7);
  };
  SGEN.octocat = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, '#c9c0ae');
    const k = '#24292f', cx = 10, cz = 10;
    gb.cyl(cx, 0, cz, 6, 1.2, 16, '#8f877a', 0, '#b8ad98');
    gb.cyl(cx, 1.2, cz, 2.6, 6, 12, k, 0, k, 2.2);            // body
    gb.cyl(cx, 7.2, cz, 3.6, 4.5, 14, k, 0, k, 3.2);          // head
    gb.cone(cx - 2.3, 11.4, cz, 1.3, 2.6, 6, k); gb.cone(cx + 2.3, 11.4, cz, 1.3, 2.6, 6, k); // ears
    gb.box(cx - 2.4, 8.2, cz - 3.5, cx + 2.4, 10.6, cz - 3.0, '#f4c7a8');                    // face
    gb.box(cx - 1.4, 9.2, cz - 3.6, cx - 0.8, 10, cz - 3.45, k); gb.box(cx + 0.8, 9.2, cz - 3.6, cx + 1.4, 10, cz - 3.45, k);
    for (let t = 0; t < 5; t++) { const a = Math.PI * 0.15 + t / 4 * Math.PI * 0.7; const x1 = cx + Math.cos(a) * 4.8, z1 = cz + Math.sin(a) * 4.8 * -1; gb.box(Math.min(cx, x1) - 0.4, 1.2, Math.min(cz, z1) - 0.4, Math.max(cx, x1) + 0.4, 2.0, Math.max(cz, z1) + 0.4, k); }
    for (let t = 0; t < 6; t++) bench(gb, 3 + t * 2.8, 18, false);
  };
  SGEN.duck = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, '#c9c0ae');
    pond(gb, 15, 15, 12);
    const y = '#f5c518', cx = 15, cz = 15;
    gb.addThree(new THREE.SphereGeometry(7, 14, 10), new THREE.Matrix4().makeScale(1.35, 0.8, 1).setPosition(cx, 4.5, cz), y);
    gb.addThree(new THREE.SphereGeometry(4.2, 12, 10), new THREE.Matrix4().setPosition(cx - 6, 12, cz), y);
    gb.addThree(new THREE.ConeGeometry(2, 3.4, 8), new THREE.Matrix4().makeRotationZ(Math.PI / 2).setPosition(cx - 11, 11.4, cz), '#f08a1c');
    gb.addThree(new THREE.SphereGeometry(0.6, 6, 6), new THREE.Matrix4().setPosition(cx - 9, 13.4, cz - 2.4), '#111');
    gb.addThree(new THREE.SphereGeometry(0.6, 6, 6), new THREE.Matrix4().setPosition(cx - 9, 13.4, cz + 2.4), '#111');
    gb.addThree(new THREE.ConeGeometry(2.6, 4, 6), new THREE.Matrix4().makeRotationZ(-Math.PI / 2.6).setPosition(cx + 9.5, 7, cz), y);
  };
  SGEN.terminal = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, '#3a3d42');
    gb.box(4, 0, 8, 16, 52, 12, '#0d0f12');
    gb.box(5.2, 30, 7.94, 7.2, 31.6, 8, '#3cff6a', 5); gb.box(7.4, 29.6, 7.94, 8.9, 32, 8, '#3cff6a', 5); // >
    gb.box(9.6, 29.6, 7.94, 12.6, 30.2, 8, '#3cff6a', 5); // _
    for (let k = 0; k < 8; k++) gb.box(5, 36 + k * 1.6, 7.94, 5 + 2 + r() * 8, 36.6 + k * 1.6, 8, '#2ad15a', 5);
    gb.box(3.6, 52, 7.6, 16.4, 52.6, 12.4, '#2b2f36');
  };
  SGEN.stack = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, PAL.paved);
    const cols = ['#f48024', '#bcbbbb', '#f48024', '#e0e0e0', '#f48024'];
    let y = 0;
    for (let k = 0; k < 14; k++) { const ox = Math.sin(k * 0.9) * 2.2, oz = Math.cos(k * 1.3) * 1.6, h = 5 + (k % 3); gb.box(4 + ox, y, 4 + oz, 16 + ox, y + h - 0.6, 16 + oz, k % 2 ? '#e8e6e0' : '#f48024', 2); gb.box(4.2 + ox, y + h - 0.6, 4.2 + oz, 15.8 + ox, y + h, 15.8 + oz, '#3a3d42'); y += h; }
    gb.box(9.5, y, 9.5, 10.5, y + 10, 10.5, '#ccc'); gb.box(9.6, y + 10, 9.6, 10.4, y + 10.6, 10.4, '#f22', 7);
  };
  SGEN.neural = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, '#c9c0ae');
    const cx = 15, cz = 15, cy = 22, R0 = 13;
    gb.cyl(cx, 0, cz, 3, 9, 10, '#d8d4cb', 0, null, 1.6);
    const pts = [];
    for (let k = 0; k < 26; k++) { const yy = 1 - (k + 0.5) / 26 * 2, rr = Math.sqrt(1 - yy * yy), a = k * 2.399; pts.push([cx + Math.cos(a) * rr * R0, cy + yy * R0, cz + Math.sin(a) * rr * R0]); }
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const p = pts[i], q = pts[j], d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
      if (d > 9.5) continue;
      const m = new THREE.Matrix4(), dir = new THREE.Vector3(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      m.compose(new THREE.Vector3((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2), quat, new THREE.Vector3(1, d, 1));
      gb.addThree(new THREE.CylinderGeometry(0.12, 0.12, 1, 4), m, '#8fa3b5');
    }
    for (const p of pts) gb.box(p[0] - 0.7, p[1] - 0.7, p[2] - 0.7, p[0] + 0.7, p[1] + 0.7, p[2] + 0.7, U.pick(['#9fd3ff', '#d97757', '#b276f2'], r), 5);
  };
  SGEN.python = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, PAL.paved);
    const H = 90;
    for (const [cx, col, ph] of [[10, '#3776ab', 0], [20, '#ffd43b', Math.PI]]) {
      for (let k = 0; k < 30; k++) { const y = k * H / 30, a = ph + k * 0.42, ox = Math.cos(a) * 1.8, oz = Math.sin(a) * 1.8; gb.box(cx - 3.2 + ox, y, 15 - 3.2 + oz, cx + 3.2 + ox, y + H / 30 + 0.05, 15 + 3.2 + oz, col, 2); }
      gb.cone(cx, H, 15, 3.6, 7, 8, col);
    }
    gb.box(10, 36, 13.5, 20, 38, 16.5, '#d8d4cb'); gb.box(10, 62, 13.5, 20, 64, 16.5, '#d8d4cb');
  };
  SGEN.tux = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, '#d9d4c6');
    const cx = 15, cz = 15, k = '#1a1a1a', w = '#f6f6f2', o = '#f2a81d';
    gb.cyl(cx, 0, cz, 8, 0.8, 16, '#b8ad98', 0, '#cfc6b2');
    gb.addThree(new THREE.SphereGeometry(5.5, 14, 10), new THREE.Matrix4().makeScale(1, 1.35, 0.9).setPosition(cx, 8, cz), k);
    gb.addThree(new THREE.SphereGeometry(4.4, 12, 10), new THREE.Matrix4().makeScale(1, 1.25, 0.6).setPosition(cx, 7.5, cz - 2.3), w);
    gb.addThree(new THREE.SphereGeometry(3.6, 12, 10), new THREE.Matrix4().setPosition(cx, 16.5, cz), k);
    gb.addThree(new THREE.SphereGeometry(0.8, 8, 6), new THREE.Matrix4().setPosition(cx - 1.3, 17.2, cz - 3.1), w);
    gb.addThree(new THREE.SphereGeometry(0.8, 8, 6), new THREE.Matrix4().setPosition(cx + 1.3, 17.2, cz - 3.1), w);
    gb.addThree(new THREE.ConeGeometry(1.0, 2.2, 6), new THREE.Matrix4().makeRotationX(-Math.PI / 2).setPosition(cx, 15.6, cz - 4), o);
    gb.box(cx - 3.6, 0.8, cz - 3.4, cx - 0.6, 1.6, cz - 0.6, o); gb.box(cx + 0.6, 0.8, cz - 3.4, cx + 3.6, 1.6, cz - 0.6, o);
    for (let t = 0; t < 8; t++) { const a = t / 8 * Math.PI * 2; yardTree(gb, cx + Math.cos(a) * 12, cz + Math.sin(a) * 12, r); }
  };
  SGEN.whale = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, '#2a6f9a');
    gb.flat(1, 1, LW - 1, LD - 1, 0.12, '#1d6f8a');
    const cx = 20, cz = 15, bl = '#2496ed';
    gb.addThree(new THREE.SphereGeometry(8, 16, 10), new THREE.Matrix4().makeScale(2, 0.7, 1).setPosition(cx, 3, cz), bl);
    gb.addThree(new THREE.ConeGeometry(4, 6, 6), new THREE.Matrix4().makeRotationZ(Math.PI / 2).setPosition(cx + 18, 4, cz), bl);
    gb.box(cx - 8, 6, cz - 5, cx + 8, 7, cz + 5, '#1a74c0');
    const cc = ['#d9473c', '#2f86c9', '#3aa36a', '#e3a02b', '#8c4fc0', '#f2f2f2'];
    for (let lx = 0; lx < 4; lx++) for (let lz = 0; lz < 2; lz++) for (let ly = 0; ly < 1 + ((lx + lz) % 3); ly++) gb.box(cx - 7.6 + lx * 3.9, 7 + ly * 2.6, cz - 4.6 + lz * 4.6, cx - 4.0 + lx * 3.9, 9.5 + ly * 2.6, cz - 0.4 + lz * 4.6, U.pick(cc, r));
    gb.box(cx - 14.6, 5, cz - 3.2, cx - 14, 6, cz - 2.4, '#111'); gb.box(cx - 14.6, 5, cz + 2.4, cx - 14, 6, cz + 3.2, '#111');
  };
  M.genBuilding = function (gb, b) {
    const r = U.rng(b.seed + b.level * 977);
    lotFrame(gb, b);
    gb.tint = b.state === 'aband' ? 0.55 : null;
    gb.noLit = b.state === 'aband';
    gb.autoMat = true;
    const LW = b.w * T, LD = b.d * T;
    if (b.kind === 'zone') GEN[C.ZONES[b.zone].key](gb, b, r, LW, LD);
    else SGEN[b.svc](gb, b, r, LW, LD);
    gb.tint = null; gb.noLit = false; gb.autoMat = false;
  };
  // ---- 3D thumbnails for menus (rendered once, cached as images) ----
  const thumbCache = new Map();
  let TR = null;
  M.thumb = function (key, spec) {
    if (thumbCache.has(key)) return thumbCache.get(key);
    let url = '';
    try {
      if (!TR) {
        const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
        r.setPixelRatio(1); r.setSize(176, 128);
        r.outputColorSpace = CB.Gfx.renderer.outputColorSpace; r.toneMapping = CB.Gfx.renderer.toneMapping; r.toneMappingExposure = CB.Gfx.renderer.toneMappingExposure;
        const sc = new THREE.Scene();
        sc.add(new THREE.HemisphereLight(0xdfeeff, 0x6a5a40, 1.4));
        const sun = new THREE.DirectionalLight(0xfff1dc, 2.6); sun.position.set(-0.6, 1, 0.45); sc.add(sun);
        TR = { r, sc, cam: new THREE.PerspectiveCamera(28, 176 / 128, 1, 4000) };
      }
      const b = Object.assign({ x: 0, y: 0, dir: 2, baseY: 0, minY: -0.5, seed: 1234, level: 3, state: 'live' }, spec);
      b.fw = b.w; b.fh = b.d;
      const gb = new GB(); M.genBuilding(gb, b);
      const geo = gb.geometry(); geo.computeBoundingBox();
      const mesh = new THREE.Mesh(geo, CB.Gfx.mats.city);
      TR.sc.add(mesh);
      const bb = geo.boundingBox, c = new THREE.Vector3(), sz = new THREE.Vector3(); bb.getCenter(c); bb.getSize(sz);
      const rad = Math.max(sz.x, sz.z, sz.y * 0.9) * 0.62 + 4;
      const dist = rad / Math.tan(THREE.MathUtils.degToRad(14));
      TR.cam.position.set(c.x - dist * 0.55, c.y + dist * 0.62, c.z + dist * 0.56);
      TR.cam.lookAt(c.x, c.y - sz.y * 0.05, c.z);
      TR.cam.near = dist * 0.2; TR.cam.far = dist * 3; TR.cam.updateProjectionMatrix();
      TR.r.render(TR.sc, TR.cam);
      url = TR.r.domElement.toDataURL('image/png');
      TR.sc.remove(mesh); geo.dispose();
    } catch (e) { url = ''; }
    thumbCache.set(key, url);
    return url;
  };
  M.buildingHeight = function (b) {
    const gb = new GB(); M.genBuilding(gb, b);
    let mx = 0; for (let i = 1; i < gb.p.length; i += 3) mx = Math.max(mx, gb.p[i] - b.baseY);
    return mx;
  };

  // ======================================================================
  // Roads, rail, stops (infrastructure chunks)
  // ======================================================================
  const COL = {
    asph: '#3c3f44', asphHw: '#35383c', walk: '#aeada6', curb: '#8e8d87', white: '#e6e6df', yellow: '#dfb33a',
    barrier: '#b9b6ad', deck: '#a9a69e', dirt: '#8a7458', bike: '#3f7a4e', ballast: '#5a5650', rail: '#9095a0', sleeper: '#6a5f55',
  };
  function genRoadTile(gb, i) {
    const Wd = CB.World;
    const x = U.tx(i), y = U.ty(i), rt = Wd.road[i], R = C.ROADS[rt], m = Wd.roadMask(i);
    const X0 = x * T, Z0 = y * T;
    const bridge = Wd.isWater(i);
    const base = (lx, lz) => bridge ? Wd.BRIDGE_H : Math.max(Wd.groundH(X0 + lx, Z0 + lz), C.WATER + 0.3);
    const P = (lx, dy, lz) => [X0 + lx, base(lx, lz) + dy, Z0 + lz];
    const flatQ = (x0, z0, x1, z1, dy, col) => gb.quad(P(x0, dy, z1), P(x1, dy, z1), P(x1, dy, z0), P(x0, dy, z0), col, 14);
    const slab = (x0, z0, x1, z1, top, col, sideCol) => {
      if (x1 < x0) [x0, x1] = [x1, x0]; if (z1 < z0) [z0, z1] = [z1, z0];
      flatQ(x0, z0, x1, z1, top, col);
      const sc = sideCol || COL.curb, lo = -0.4;
      gb.quad(P(x1, lo, z0), P(x0, lo, z0), P(x0, top, z0), P(x1, top, z0), sc);
      gb.quad(P(x0, lo, z1), P(x1, lo, z1), P(x1, top, z1), P(x0, top, z1), sc);
      gb.quad(P(x0, lo, z0), P(x0, lo, z1), P(x0, top, z1), P(x0, top, z0), sc);
      gb.quad(P(x1, lo, z1), P(x1, lo, z0), P(x1, top, z0), P(x1, top, z1), sc);
    };
    // strip frame: u across (0 = left when facing direction f), v along (0 = behind, 10 = ahead)
    const FU = (f, u, v) => f === 0 ? [u, T - v] : f === 1 ? [v, u] : f === 2 ? [T - u, v] : [T - v, T - u];
    const fq = (f, u0, v0, u1, v1, dy, col) => { const a = FU(f, u0, v0), b = FU(f, u1, v1); flatQ(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]), dy, col); };
    const fs = (f, u0, v0, u1, v1, top, col, side) => { const a = FU(f, u0, v0), b = FU(f, u1, v1); slab(a[0], a[1], b[0], b[1], top, col, side); };
    const con = d => (m & (1 << d)) !== 0;
    const h = U.hash(x, y, 3) * 0.04 - 0.02;
    const surf = R.surf === 'dirt' ? COL.dirt : R.grp === 'highway' ? COL.asphHw : COL.asph;
    const ac = lc(surf); const asphC = [ac[0] * (1 + h), ac[1] * (1 + h), ac[2] * (1 + h)].map(v => Math.pow(Math.max(0, v), 1 / 2.2));
    const mk = 0.19;
    const jc = Wd.jcl[i];
    let deg = 0; for (let d = 0; d < 4; d++) if (con(d)) deg++;
    const ns = con(0) || con(2), ew = con(1) || con(3);
    const straight = deg <= 2 && !(ns && ew);
    if (!R.car) {
      // bike / foot path: grass verge with a paved ribbon along each connection
      flatQ(0, 0, T, T, 0.12, '#6b9444');
      const pc = R.key === 'bikepath' ? '#7a4a3c' : '#c9c1ad', hw = R.key === 'bikepath' ? 1.6 : 1.3;
      const c = T / 2;
      flatQ(c - hw, c - hw, c + hw, c + hw, 0.18, pc);
      if (con(0)) flatQ(c - hw, 0, c + hw, c, 0.18, pc);
      if (con(2)) flatQ(c - hw, c, c + hw, T, 0.18, pc);
      if (con(1)) flatQ(c, c - hw, T, c + hw, 0.18, pc);
      if (con(3)) flatQ(0, c - hw, c, c + hw, 0.18, pc);
      if (!deg) flatQ(c - hw, 1, c + hw, T - 1, 0.18, pc);
      if (R.key === 'bikepath') { if (con(0) || con(2)) flatQ(c - 0.06, 1, c + 0.06, 4, 0.2, COL.white); if (con(1) || con(3)) flatQ(1, c - 0.06, 4, c + 0.06, 0.2, COL.white); }
      else if (U.hash(x, y, 9) < 0.5) gb.tree(X0 + 1.4, base(1.4, 1.4), Z0 + 1.4, 0.7, '#4f7d34', false);
      addBridge();
      return;
    }
    flatQ(0, 0, T, T, 0.16, asphC);
    if (jc >= 0) {
      // junction tile: sidewalks on closed edges and corners, crosswalks where traffic enters
      const sw = Math.max(1.2, R.side);
      for (let d = 0; d < 4; d++) {
        if (con(d)) continue;
        if (d === 0) slab(0, 0, T, sw, 0.32, COL.walk); else if (d === 2) slab(0, T - sw, T, T, 0.32, COL.walk);
        else if (d === 1) slab(T - sw, 0, T, T, 0.32, COL.walk); else slab(0, 0, sw, T, 0.32, COL.walk);
      }
      const cs = 1.1;
      if (con(0) && con(1)) slab(T - cs, 0, T, cs, 0.32, COL.walk);
      if (con(1) && con(2)) slab(T - cs, T - cs, T, T, 0.32, COL.walk);
      if (con(2) && con(3)) slab(0, T - cs, cs, T, 0.32, COL.walk);
      if (con(3) && con(0)) slab(0, 0, cs, cs, 0.32, COL.walk);
      for (let d = 0; d < 4; d++) {
        if (!con(d)) continue;
        const o = Wd.neighbor(i, d); if (o < 0 || Wd.jcl[o] === jc) continue;
        if (C.ROADS[Wd.road[o]].grp === 'highway') continue;
        for (let s = 1.4; s < T - 1.6; s += 1.0) {
          if (d === 0) flatQ(s, 0.3, s + 0.5, 2.1, mk, COL.white); else if (d === 2) flatQ(s, T - 2.1, s + 0.5, T - 0.3, mk, COL.white);
          else if (d === 1) flatQ(T - 2.1, s, T - 0.3, s + 0.5, mk, COL.white); else flatQ(0.3, s, 2.1, s + 0.5, mk, COL.white);
        }
      }
      const cl = Wd.clusters[jc];
      if (cl && cl.ctrl === 'round' && cl.tiles[0] === i) {
        const cx = (cl.cx - x) * T, cz = (cl.cy - y) * T, rr = cl.tiles.length > 1 ? 4.2 : 2.1;
        const yb = base(Math.min(T, Math.max(0, cx)), Math.min(T, Math.max(0, cz)));
        gb.cyl(X0 + cx, yb + 0.1, Z0 + cz, rr + 0.3, 0.3, 16, COL.curb, 0, COL.curb);
        gb.cyl(X0 + cx, yb + 0.1, Z0 + cz, rr, 0.32, 16, '#5d8c3c', 0, '#5d8c3c');
        gb.tree(X0 + cx, yb + 0.4, Z0 + cz, cl.tiles.length > 1 ? 1 : 0.6, '#4f7d34', false);
      }
    } else {
      // regular strip
      let f = Wd.rdir[i];
      if (straight) { if (ns && (f % 2 !== 0)) f = con(0) ? 0 : 2; if (ew && (f % 2 !== 1)) f = con(1) ? 1 : 3; }
      if (!straight) {
        const sw = R.side;
        if (sw > 0) {
          if (!con(0)) slab(0, 0, T, sw, 0.32, COL.walk);
          if (!con(1)) slab(T - sw, 0, T, T, 0.32, COL.walk);
          if (!con(2)) slab(0, T - sw, T, T, 0.32, COL.walk);
          if (!con(3)) slab(0, 0, sw, T, 0.32, COL.walk);
          const cs = Math.min(sw, 1.6);
          if (con(0) && con(1)) slab(T - cs, 0, T, cs, 0.32, COL.walk);
          if (con(1) && con(2)) slab(T - cs, T - cs, T, T, 0.32, COL.walk);
          if (con(2) && con(3)) slab(0, T - cs, cs, T, 0.32, COL.walk);
          if (con(3) && con(0)) slab(0, 0, cs, cs, 0.32, COL.walk);
        }
      } else {
        const L = R.L, sw = R.side, bw = L.bw;
        const pair = R.w === 2, one = R.oneway;
        const endA = !con((f + 2) % 4), endB = !con(f); // closed behind / ahead
        // outer right side (and left too for single strips)
        const sides = pair ? [1] : [0, 1];
        for (const sd of sides) {
          const u0 = sd ? T - sw : 0, u1 = sd ? T : sw;
          if (sw > 0) {
            if (R.grp === 'highway') { fq(f, u0, 0, u1, T, 0.2, '#6b6b66'); fs(f, sd ? T - 0.35 : 0.1, 0, sd ? T - 0.1 : 0.35, T, 0.9, COL.barrier); }
            else {
              fs(f, u0, 0, u1, T, 0.32, COL.walk);
              if (R.trees) { const p = FU(f, sd ? T - sw / 2 : sw / 2, 5); gb.tree(X0 + p[0], base(p[0], p[1]) + 0.3, Z0 + p[1], 0.62, U.pick(['#4f7d34', '#5c8a3a', '#3f6b30'], () => U.hash(x, y, sd)), false); }
            }
          }
          if (bw > 0) {
            const b0 = sd ? T - sw - bw : sw, b1 = b0 + bw;
            fq(f, b0, 0, b1, T, mk - 0.01, COL.bike);
            if (R.bike === 2) fs(f, sd ? b0 : b1 - 0.35, 0, sd ? b0 + 0.35 : b1, T, 0.3, COL.walk);
            else fq(f, sd ? b0 - 0.05 : b1 - 0.1, 0, sd ? b0 + 0.1 : b1 + 0.05, T, mk, COL.white);
            const p = FU(f, (b0 + b1) / 2, 5); // bike symbol dot
            flatQ(p[0] - 0.25, p[1] - 0.25, p[0] + 0.25, p[1] + 0.25, mk + 0.005, COL.white);
          }
        }
        if (pair) {
          // inner half of the median
          const m0 = 0, m1 = L.med;
          if (R.med === 'paint') fq(f, 0, 0, 0.14, T, mk, COL.yellow);
          else if (R.med === 'barrier') fs(f, 0, 0, Math.max(0.3, m1), T, 0.95, COL.barrier);
          else if (R.med === 'curb') fs(f, m0, 0, m1, T, 0.3, COL.walk);
          else { fs(f, m0, 0, m1, T, 0.3, '#5d8c3c', COL.curb); if (R.med === 'trees' && (x + y) % 2 === 0) { const p = FU(f, 0.2, 5); gb.tree(X0 + p[0], base(p[0], p[1]) + 0.3, Z0 + p[1], 0.7, '#4f7d34', false); } }
          // lane dividers
          const ls = L.fwd.length;
          for (let j = 0; j < ls - 1; j++) { const u = T / 2 + (L.fwd[j] + L.fwd[j + 1]) / 2; dash(f, u); }
          if (R.grp !== 'highway' && ls) { const u = T - sw - bw - 0.1; fq(f, u - 0.06, 0, u + 0.06, T, mk, COL.white); }
          if (R.tram) for (const o of L.fwd.slice(-1)) tramRails(f, T / 2 + o);
        } else if (R.surf !== 'dirt') {
          if (one) {
            for (let j = 0; j < L.fwd.length - 1; j++) dash(f, T / 2 + (L.fwd[j] + L.fwd[j + 1]) / 2);
          } else {
            const mx = L.medX;
            if (R.med === 'curb') fs(f, mx - L.med / 2, 0.6, mx + L.med / 2, T - 0.6, 0.3, COL.walk);
            else if (R.grp === 'highway') { dash(f, mx); }
            else { fq(f, mx - 0.2, 0, mx - 0.07, T, mk, COL.yellow); fq(f, mx + 0.07, 0, mx + 0.2, T, mk, COL.yellow); }
            for (let j = 0; j < L.fwd.length - 1; j++) dash(f, T / 2 + (L.fwd[j] + L.fwd[j + 1]) / 2);
            for (let j = 0; j < L.back.length - 1; j++) dash(f, T / 2 - (L.back[j] + L.back[j + 1]) / 2);
            if (R.tram) { tramRails(f, T / 2 + L.fwd[0]); tramRails(f, T / 2 - L.back[0]); }
          }
        }
        // closed ends get a sidewalk cap
        if (sw > 0 && R.grp !== 'highway') { if (endA) fs(f, 0, 0, T, sw, 0.32, COL.walk); if (endB) fs(f, 0, T - sw, T, T, 0.32, COL.walk); }
        if (one && !pair && ((x + y) % 3 === 0)) flowArrow(f, T / 2 + L.fwd[0], 4);
      }
      // lane arrows & stop lines on junction approaches
      const aps = M.apInfo && M.apInfo.get(i);
      if (aps) for (const ap of aps) approachMarks(ap);
    }
    addBridge();

    function dash(f, u) { fq(f, u - 0.07, 0.8, u + 0.07, 3.8, mk, COL.white); fq(f, u - 0.07, 5.8, u + 0.07, 8.8, mk, COL.white); }
    function tramRails(f, u) { for (const o of [-0.72, 0.72]) fq(f, u + o - 0.06, 0, u + o + 0.06, T, mk + 0.02, COL.rail); }
    function flowArrow(f, u, v) {
      fq(f, u - 0.12, v, u + 0.12, v + 1.6, mk, COL.white);
      const a = FU(f, u - 0.55, v + 1.6), b = FU(f, u + 0.55, v + 1.6), c = FU(f, u, v + 2.5);
      gb.tri(P(a[0], mk, a[1]), P(b[0], mk, b[1]), P(c[0], mk, c[1]), COL.white, 14);
      gb.tri(P(b[0], mk, b[1]), P(a[0], mk, a[1]), P(c[0], mk, c[1]), COL.white, 14);
    }
    function approachMarks(ap) {
      const f = ap.d, lanes = Wd.lanesToward(i, f);
      const cl = Wd.clusters[ap.cl], cfg = cl.cfg, masks = cfg.lanes[ap.key] || [];
      // stop line
      const L = R.L, uR = T - R.side - L.bw, uL = R.w === 2 ? L.med : (R.oneway ? R.side + L.bw : L.medX);
      fq(f, Math.min(uL, uR), 9.0, Math.max(uL, uR), 9.45, mk + 0.01, COL.white);
      for (let k = 0; k < lanes.length; k++) {
        const u = T / 2 + lanes[k], mm = masks[k] || 0, v0 = 5.4, v1 = 7.4;
        const W2 = (a0, b0, a1, b1) => fq(f, a0, b0, a1, b1, mk + 0.01, COL.white);
        const tri = (pa, pb, pc) => { const A = FU(f, pa[0], pa[1]), B = FU(f, pb[0], pb[1]), Cc = FU(f, pc[0], pc[1]); gb.tri(P(A[0], mk + 0.01, A[1]), P(B[0], mk + 0.01, B[1]), P(Cc[0], mk + 0.01, Cc[1]), COL.white, 14); gb.tri(P(B[0], mk + 0.01, B[1]), P(A[0], mk + 0.01, A[1]), P(Cc[0], mk + 0.01, Cc[1]), COL.white, 14); };
        W2(u - 0.09, v0, u + 0.09, v1);
        if (mm & 1) { W2(u - 0.09, v1, u + 0.09, 8.0); tri([u - 0.42, 8.0], [u + 0.42, 8.0], [u, 8.7]); }
        if (mm & 2) { W2(u, v1 - 0.18, u + 0.75, v1); tri([u + 0.75, v1 - 0.45], [u + 0.75, v1 + 0.27], [u + 1.25, v1 - 0.09]); }
        if (mm & 4) { W2(u - 0.75, v1 - 0.18, u, v1); tri([u - 0.75, v1 - 0.45], [u - 0.75, v1 + 0.27], [u - 1.25, v1 - 0.09]); }
        if (mm & 8) { W2(u - 0.6, v1 - 0.18, u, v1); W2(u - 0.69, v0 + 0.4, u - 0.51, v1); }
      }
      // signal pole / stop sign at the right-hand corner
      const pc = FU(f, T - 0.45, 9.4), px = X0 + pc[0], pz = Z0 + pc[1], py = base(pc[0], pc[1]) + 0.3;
      if (cl.ctrl === 'lights') {
        const hp = M.signalPos(ap), top = hp[1] + 1.05;
        gb.box(px - 0.13, py, pz - 0.13, px + 0.13, top + 0.15, pz + 0.13, '#3a3d42');
        // mast arm out over the lanes
        gb.box(Math.min(px, hp[0]) - 0.08, top, Math.min(pz, hp[2]) - 0.08, Math.max(px, hp[0]) + 0.08, top + 0.16, Math.max(pz, hp[2]) + 0.08, '#3a3d42');
        gb.box(hp[0] - 0.32, hp[1] - 0.85, hp[2] - 0.32, hp[0] + 0.32, hp[1] + 0.85, hp[2] + 0.32, '#16181b');
        gb.box(hp[0] - 0.05, hp[1] + 0.85, hp[2] - 0.05, hp[0] + 0.05, top, hp[2] + 0.05, '#3a3d42');
      } else if ((cl.ctrl === 'stop' || cl.ctrl === 'allstop') && CB.Traffic.isStopFor(cl, ap.key)) {
        gb.box(px - 0.06, py, pz - 0.06, px + 0.06, py + 2.3, pz + 0.06, '#9a9a9a');
        gb.cyl(px, py + 2.3, pz, 0.42, 0.08, 8, '#c8231c', 5, '#c8231c');
        gb.cyl(px, py + 2.3, pz, 0.42, 0.08, 8, '#c8231c', 5, '#c8231c');
        gb.box(px - 0.4, py + 2.0, pz - 0.4, px + 0.4, py + 2.8, pz + 0.4, '#c8231c', 5);
      } else if (cl.ctrl === 'round') {
        gb.box(px - 0.05, py, pz - 0.05, px + 0.05, py + 2.0, pz + 0.05, '#9a9a9a');
        gb.box(px - 0.35, py + 2.0, pz - 0.35, px + 0.35, py + 2.6, pz + 0.35, '#2f6fd0', 5);
      }
    }
    function addBridge() {
      if (!bridge) return;
      const y0 = Wd.BRIDGE_H;
      gb.box(X0, y0 - 1.3, Z0, X0 + T, y0 + 0.1, Z0 + T, COL.deck, 0, { skip: 16, bottom: true });
      const g = Math.min(Wd.groundH(X0 + 5, Z0 + 5), -0.5);
      if ((x + y) % 2 === 0) gb.box(X0 + 4.1, g - 1, Z0 + 4.1, X0 + 5.9, y0 - 1.3, Z0 + 5.9, COL.deck);
    }
  }
  // half-tile paths: a paved ribbon through each cell, joined to neighbouring cells and to road sidewalks
  function genPathTile(gb, i) {
    const Wd = CB.World, FW = C.FW, H = T / 2;
    for (let q = 0; q < 4; q++) {
      const f = Wd.cellOf(i, q), k = Wd.pcell[f]; if (!k) continue;
      const P = C.PATHS[k], fx = f % FW, fy = (f / FW) | 0;
      const x0 = fx * H, z0 = fy * H, cx = x0 + H / 2, cz = z0 + H / 2, w = k === 2 ? 1.25 : 1.05;
      const y = (lx, lz) => Math.max(Wd.groundH(lx, lz), C.WATER + 0.3) + 0.2;
      const quad = (ax, az, bx, bz, col, dy) => gb.quad([ax, y(ax, bz) + (dy || 0), bz], [bx, y(bx, bz) + (dy || 0), bz], [bx, y(bx, az) + (dy || 0), az], [ax, y(ax, az) + (dy || 0), az], col, 14);
      quad(cx - w, cz - w, cx + w, cz + w, P.col);
      for (let d = 0; d < 4; d++) {
        const nx = fx + C.DX[d], ny = fy + C.DY[d];
        if (nx < 0 || ny < 0 || nx >= FW || ny >= FW) continue;
        const nf = ny * FW + nx, nt = U.idx(nx >> 1, ny >> 1);
        const toRoad = nt !== i && Wd.walkRoad(nt);
        if (!Wd.pcell[nf] && !toRoad) continue;
        if (d === 0) quad(cx - w, z0, cx + w, cz, P.col); else if (d === 2) quad(cx - w, cz, cx + w, z0 + H, P.col);
        else if (d === 1) quad(cx, cz - w, x0 + H, cz + w, P.col); else quad(x0, cz - w, cx, cz + w, P.col);
        if (k === 2) { if (d % 2 === 0) quad(cx - 0.06, d === 0 ? z0 + 0.6 : cz + 0.6, cx + 0.06, d === 0 ? cz - 0.6 : z0 + H - 0.6, COL.white, 0.01); else quad(d === 3 ? x0 + 0.6 : cx + 0.6, cz - 0.06, d === 3 ? cx - 0.6 : x0 + H - 0.6, cz + 0.06, COL.white, 0.01); }
      }
    }
  }
  // world position of the signal head for a junction approach
  M.signalPos = function (ap) {
    const Wd = CB.World, i = ap.tile, f = ap.d;
    const FU = (u, v) => f === 0 ? [u, T - v] : f === 1 ? [v, u] : f === 2 ? [T - u, v] : [T - v, T - u];
    const ln = Wd.lanesToward(i, f), mid = ln.length ? (ln[0] + ln[ln.length - 1]) / 2 : 1.5;
    const p = FU(T / 2 + mid, 9.4), x = U.tx(i) * T + p[0], z = U.ty(i) * T + p[1];
    return [x, Wd.roadH(x, z) + 5.2, z];
  };
  // the lit lamp sits on the face of the housing pointing at oncoming drivers
  M.signalLampPos = function (ap) {
    const p = M.signalPos(ap);
    return [p[0] - C.DX[ap.d] * 0.42, p[1], p[2] - C.DY[ap.d] * 0.42];
  };
  M.junctionsChanged = function () {
    const Wd = CB.World;
    const old = M.apInfo || new Map();
    M.apInfo = new Map();
    for (const cl of Wd.clusters) for (const ap of cl.aps) {
      ap.cl = cl.id;
      if (!M.apInfo.has(ap.tile)) M.apInfo.set(ap.tile, []);
      M.apInfo.get(ap.tile).push(ap);
    }
    for (const t of new Set([...old.keys(), ...M.apInfo.keys()])) M.markInfra(t);
    for (const cl of Wd.clusters) for (const t of cl.tiles) M.markInfra(t);
  };

  function genRailTile(gb, i) {
    const Wd = CB.World;
    const x = U.tx(i), y = U.ty(i), m = Wd.railMask(i);
    const X0 = x * T, Z0 = y * T;
    if (Wd.rail[i] !== 1) return;
    const D = (lx, lz) => Wd.deckH(X0 + lx, Z0 + lz);
    const P = (lx, dy, lz) => [X0 + lx, D(lx, lz) + dy, Z0 + lz];
    const slab = (x0, z0, x1, z1, lo, top, col, side) => {
      gb.quad(P(x0, top, z1), P(x1, top, z1), P(x1, top, z0), P(x0, top, z0), col);
      const sc = side || col;
      gb.quad(P(x1, lo, z0), P(x0, lo, z0), P(x0, top, z0), P(x1, top, z0), sc);
      gb.quad(P(x0, lo, z1), P(x1, lo, z1), P(x1, top, z1), P(x0, top, z1), sc);
      gb.quad(P(x0, lo, z0), P(x0, lo, z1), P(x0, top, z1), P(x0, top, z0), sc);
      gb.quad(P(x1, lo, z1), P(x1, lo, z0), P(x1, top, z0), P(x1, top, z1), sc);
      if (lo < 0) gb.quad(P(x0, lo, z0), P(x1, lo, z0), P(x1, lo, z1), P(x0, lo, z1), sc);
    };
    const a = 1.2, bb = T - 1.2;
    const con = d => (m & (1 << d)) !== 0;
    slab(a, a, bb, bb, -1.1, 0, COL.deck);
    if (con(0)) slab(a, 0, bb, a, -1.1, 0, COL.deck);
    if (con(2)) slab(a, bb, bb, T, -1.1, 0, COL.deck);
    if (con(1)) slab(bb, a, T, bb, -1.1, 0, COL.deck);
    if (con(3)) slab(0, a, a, bb, -1.1, 0, COL.deck);
    // tracks
    const c = T / 2;
    const arms = [];
    for (let d = 0; d < 4; d++) if (con(d)) arms.push(d);
    if (!arms.length) arms.push(0, 2);
    for (const d of arms) {
      for (const o of [-1.75, 1.75]) {
        for (const ro of [-0.72, 0.72]) {
          const q = o + ro;
          if (d === 0) slab(c + q - 0.07, 0, c + q + 0.07, c + 0.9, 0, 0.32, COL.rail);
          else if (d === 2) slab(c + q - 0.07, c - 0.9, c + q + 0.07, T, 0, 0.32, COL.rail);
          else if (d === 1) slab(c - 0.9, c + q - 0.07, T, c + q + 0.07, 0, 0.32, COL.rail);
          else slab(0, c + q - 0.07, c + 0.9, c + q + 0.07, 0, 0.32, COL.rail);
        }
        const q = o;
        if (d === 0) gb.quad(P(c + q - 1.2, 0.08, c + 1.2), P(c + q + 1.2, 0.08, c + 1.2), P(c + q + 1.2, 0.08, 0), P(c + q - 1.2, 0.08, 0), COL.ballast);
        else if (d === 2) gb.quad(P(c + q - 1.2, 0.08, T), P(c + q + 1.2, 0.08, T), P(c + q + 1.2, 0.08, c - 1.2), P(c + q - 1.2, 0.08, c - 1.2), COL.ballast);
        else if (d === 1) gb.quad(P(c - 1.2, 0.08, c + q + 1.2), P(T, 0.08, c + q + 1.2), P(T, 0.08, c + q - 1.2), P(c - 1.2, 0.08, c + q - 1.2), COL.ballast);
        else gb.quad(P(0, 0.08, c + q + 1.2), P(c + 1.2, 0.08, c + q + 1.2), P(c + 1.2, 0.08, c + q - 1.2), P(0, 0.08, c + q - 1.2), COL.ballast);
      }
    }
    // parapets on open sides
    if (!con(0)) slab(a, a, bb, a + 0.25, 0, 0.8, COL.deck);
    if (!con(2)) slab(a, bb - 0.25, bb, bb, 0, 0.8, COL.deck);
    if (!con(1)) slab(bb - 0.25, a, bb, bb, 0, 0.8, COL.deck);
    if (!con(3)) slab(a, a, a + 0.25, bb, 0, 0.8, COL.deck);
    // pillar
    if (!Wd.road[i]) {
      const g = Wd.groundH(X0 + c, Z0 + c) - 1;
      const top = D(c, c) - 1.1;
      gb.box(X0 + c - 0.8, g, Z0 + c - 0.8, X0 + c + 0.8, top, Z0 + c + 0.8, '#9d9a92');
      gb.box(X0 + c - 1.6, top - 0.8, Z0 + c - 1.6, X0 + c + 1.6, top, Z0 + c + 1.6, '#9d9a92');
    }
  }

  function genStop(gb, stop) {
    const Wd = CB.World;
    const i = stop.tile, x = U.tx(i), y = U.ty(i), X0 = x * T, Z0 = y * T;
    if (stop.type === 'bus') {
      const m = Wd.roadMask(i);
      let side = -1;
      for (let d = 0; d < 4; d++) if (!(m & (1 << d))) { side = d; break; }
      const sw = Wd.road[i] ? Math.max(1.2, C.ROADS[Wd.road[i]].side) : 1.8;
      // local frame: side is "back"
      const f = side < 0 ? 0 : side;
      const o = [[X0, Z0], [X0 + T, Z0], [X0 + T, Z0 + T], [X0, Z0 + T]][f];
      const yb = Wd.roadH(X0 + 5, Z0 + 5) + 0.2;
      gb.frame(o[0], yb, o[1], f);
      const z0 = 0.15, z1 = Math.max(1.2, sw - 0.1);
      gb.box(3.4, 0, z0, 6.6, 0.08, z1, '#9a9a96');
      gb.box(3.4, 0, z0, 6.6, 2.3, z0 + 0.08, '#9fc5d8', 9);
      gb.box(3.4, 2.3, z0 - 0.1, 6.6, 2.45, z1 + 0.25, '#2b3036');
      gb.box(3.4, 0, z0, 3.5, 2.3, z1, '#2b3036'); gb.box(6.5, 0, z0, 6.6, 2.3, z1, '#2b3036');
      gb.box(7.4, 0, z1 - 0.1, 7.5, 2.8, z1, '#555');
      gb.box(7.1, 2.4, z1 - 0.12, 7.8, 3.1, z1 - 0.02, stop.color || '#2b8fe0', 5);
      gb.frame(0, 0, 0, 0);
    } else {
      if (Wd.rail[i] === 1) {
        const m = Wd.railMask(i);
        const nsDir = (m & 5) || !(m & 10);
        const D = Wd.deckH(X0 + 5, Z0 + 5);
        gb.frame(X0, D, Z0, nsDir ? 0 : 1);
        if (!nsDir) gb.frame(X0 + T, D, Z0, 1);
        gb.box(-1.2, -1.1, 0, 1.2, 1.0, T, '#c8c4bb');
        gb.box(T - 1.2, -1.1, 0, T + 1.2, 1.0, T, '#c8c4bb');
        for (const xx of [-0.6, T + 0.6]) for (const zz of [1, T - 1]) gb.box(xx - 0.12, 1.0, zz - 0.12, xx + 0.12, 4.4, zz + 0.12, '#666');
        gb.box(-1.6, 4.4, -0.2, T + 1.6, 4.7, T + 0.2, '#e8e4dc', 0, { top: '#3d6b9a' });
        gb.box(-1.25, 1.0, 4.2, -1.15, 1.9, 5.8, stop.color || '#e85d2a', 5);
        // stair tower to the ground
        const g = Wd.groundH(X0 + 5, Z0 + 5);
        gb.box(-4.5, g - D - 0.5, 3, -1.2, 1.0, 7, '#bdb8ae', 3, { vb: g - D });
        gb.frame(0, 0, 0, 0);
      } else {
        const yb = Wd.road[i] ? Wd.roadH(X0 + 1, Z0 + 1) + 0.2 : Wd.groundH(X0 + 5, Z0 + 5);
        const ox = Wd.road[i] ? 0.2 : 3.5, oz = Wd.road[i] ? 0.2 : 3.5;
        gb.frame(X0 + ox, yb, Z0 + oz, 0);
        const s = Wd.road[i] ? 1.6 : 3;
        gb.box(0, 0, 0, s, 2.6, s, '#c9d1d6', 3);
        gb.box(-0.15, 2.6, -0.15, s + 0.15, 2.9, s + 0.15, '#2b3036');
        gb.box(s * 0.5 - 0.4, 2.9, s * 0.5 - 0.4, s * 0.5 + 0.4, 3.8, s * 0.5 + 0.4, stop.color || '#e85d2a', 5);
        gb.frame(0, 0, 0, 0);
      }
    }
  }

  // ======================================================================
  // Chunks
  // ======================================================================
  const CS = C.CHUNK, CW = Math.ceil(W / CS);
  M.chunks = [];
  M.init = function () {
    const G = CB.Gfx;
    M.root = new THREE.Group(); G.scene.add(M.root);
    for (let cy = 0; cy < CW; cy++) for (let cx = 0; cx < CW; cx++) {
      M.chunks.push({ cx, cy, infra: null, bld: null, infraDirty: true, bldDirty: true, ids: new Set() });
    }
    M.cons = new Map();
    initTrees(); initLamps(); initVehicles(); initGhosts(); initIcons(); initSignals();
    M.lineGroup = new THREE.Group(); G.scene.add(M.lineGroup);
    M.flowGroup = new THREE.Group(); G.scene.add(M.flowGroup);
    M.junctionsChanged();
    CB.Traffic.setColors(['#2f86c9', '#d9473c', '#2b2b30', '#e3a02b', '#3aa36a', '#eeeeee'].map(lc), ['#d9473c', '#2f86c9', '#e3a02b', '#3aa36a', '#8c4fc0', '#f2f2f2', '#2b2b30', '#c45a1c'].map(lc));
  };
  M.chunkAt = (x, y) => M.chunks[Math.floor(y / CS) * CW + Math.floor(x / CS)];
  M.markInfra = function (i) {
    const x = U.tx(i), y = U.ty(i);
    for (let d = -1; d <= 1; d++) for (let e = -1; e <= 1; e++) {
      const nx = x + d, ny = y + e;
      if (U.inWorld(nx, ny)) M.chunkAt(nx, ny).infraDirty = true;
    }
    M.lampsDirty = true;
  };
  M.chunkOfB = b => M.chunkAt(b.x + (b.fw >> 1), b.y + (b.fh >> 1));
  M.addBuilding = function (b) {
    if (b.state === 'build') { addCons(b); return; }
    const ch = M.chunkOfB(b); ch.ids.add(b.id); ch.bldDirty = true;
  };
  M.removeBuilding = function (b) {
    removeCons(b.id);
    const ch = M.chunkOfB(b); if (ch.ids.delete(b.id)) ch.bldDirty = true;
  };
  M.refreshBuilding = function (b) { M.removeBuilding(b); M.addBuilding(b); };

  function addCons(b) {
    const gb = new GB(); M.genBuilding(gb, b);
    const mesh = new THREE.Mesh(gb.geometry(), CB.Gfx.mats.city);
    mesh.castShadow = true; mesh.receiveShadow = true;
    // scale from the base
    mesh.geometry.translate(0, -b.baseY, 0);
    mesh.position.y = b.baseY;
    mesh.scale.y = 0.05;
    CB.Gfx.cityMeshes.add(mesh);
    M.root.add(mesh);
    M.cons.set(b.id, mesh);
  }
  function removeCons(id) {
    const m = M.cons.get(id);
    if (m) { M.root.remove(m); m.geometry.dispose(); CB.Gfx.cityMeshes.delete(m); M.cons.delete(id); }
  }
  M.updateConstruction = function () {
    M.cons.forEach((mesh, id) => {
      const b = CB.Sim.buildings.get(id);
      if (!b) return;
      const p = U.clamp(b.st / b.buildT, 0, 1);
      mesh.scale.y = 0.05 + 0.95 * U.smooth(0, 1, p);
    });
  };

  function setChunkMesh(ch, key, gb, shadow) {
    const G = CB.Gfx;
    const old = ch[key];
    if (old) { M.root.remove(old); old.geometry.dispose(); G.cityMeshes.delete(old); ch[key] = null; }
    if (gb.count === 0) return;
    const mesh = new THREE.Mesh(gb.geometry(), G.mats.city);
    mesh.castShadow = shadow; mesh.receiveShadow = true;
    G.cityMeshes.add(mesh);
    M.root.add(mesh);
    ch[key] = mesh;
  }
  function buildInfra(ch) {
    const Wd = CB.World, gb = new GB();
    const x0 = ch.cx * CS, y0 = ch.cy * CS;
    let elev = false;
    for (let y = y0; y < Math.min(W, y0 + CS); y++) for (let x = x0; x < Math.min(W, x0 + CS); x++) {
      const i = U.idx(x, y);
      if (Wd.road[i]) genRoadTile(gb, i);
      if (Wd.pmask[i]) genPathTile(gb, i);
      if (Wd.rail[i] === 1) { genRailTile(gb, i); elev = true; }
    }
    if (CB.Transit) for (const s of CB.Transit.stops) {
      const sx = U.tx(s.tile), sy = U.ty(s.tile);
      if (sx >= x0 && sx < x0 + CS && sy >= y0 && sy < y0 + CS) { genStop(gb, s); elev = true; }
    }
    setChunkMesh(ch, 'infra', gb, elev);
  }
  function buildBld(ch) {
    const gb = new GB();
    const S = CB.Sim;
    ch.ids.forEach(id => { const b = S.buildings.get(id); if (b && b.state !== 'build') M.genBuilding(gb, b); else ch.ids.delete(id); });
    setChunkMesh(ch, 'bld', gb, true);
  }
  M.update = function (budgetMs) {
    const t0 = performance.now();
    for (const ch of M.chunks) {
      if (ch.infraDirty) { ch.infraDirty = false; buildInfra(ch); }
      if (ch.bldDirty) { ch.bldDirty = false; buildBld(ch); }
      if (performance.now() - t0 > budgetMs) break;
    }
    if (M.treesDirty && performance.now() - (M.treesT || 0) > 400) { M.treesT = performance.now(); M.treesDirty = false; rebuildTrees(); }
    if (M.lampsDirty) { M.lampsDirty = false; rebuildLamps(); }
    M.updateConstruction();
  };
  // flow arrows while previewing a road drag
  M.setFlowArrows = function (strips, rt) {
    const g = M.flowGroup; if (!g) return;
    while (g.children.length) { const c = g.children.pop(); c.geometry.dispose(); }
    if (!strips) return;
    const R = C.ROADS[rt]; if (!R.oneway && R.w !== 2 && R.fwd === R.back) return;
    const Wd = CB.World, gb = new GB();
    for (const st of strips) for (let k = 0; k < st.tiles.length; k += 2) {
      const i = st.tiles[k], d = st.dirs[k], cx = (U.tx(i) + 0.5) * T, cz = (U.ty(i) + 0.5) * T, y = Wd.roadH(cx, cz) + 1.2;
      const fx = C.DX[d], fz = C.DY[d], rx = -fz, rz = fx;
      gb.tri([cx + fx * 3, y, cz + fz * 3], [cx - fx * 1.5 + rx * 2, y, cz - fz * 1.5 + rz * 2], [cx - fx * 1.5 - rx * 2, y, cz - fz * 1.5 - rz * 2], '#ffffff');
      gb.tri([cx + fx * 3, y, cz + fz * 3], [cx - fx * 1.5 - rx * 2, y, cz - fz * 1.5 - rz * 2], [cx - fx * 1.5 + rx * 2, y, cz - fz * 1.5 + rz * 2], '#ffffff');
    }
    const mesh = new THREE.Mesh(gb.geometry(), new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.9, depthTest: false }));
    mesh.renderOrder = 9; g.add(mesh);
  };
  M.rebuildAll = function () {
    M.junctionsChanged();
    for (const ch of M.chunks) { ch.infraDirty = true; ch.bldDirty = true; }
    M.treesDirty = true; M.lampsDirty = true;
  };

  // ======================================================================
  // Trees
  // ======================================================================
  function treeGeom(conifer) {
    const gb = new GB();
    gb.box(-0.22, 0, -0.22, 0.22, 2.0, 0.22, '#5a3d28', 12);
    if (conifer) {
      gb.cone(0, 1.2, 0, 2.0, 3.6, 7, '#ffffff');
      gb.cone(0, 3.0, 0, 1.55, 3.2, 7, '#ffffff');
      gb.cone(0, 4.8, 0, 1.0, 2.8, 7, '#ffffff');
    } else {
      const ico = new THREE.IcosahedronGeometry(2.5, 0);
      gb.addThree(ico, new THREE.Matrix4().makeScale(1, 0.92, 1).setPosition(0, 4.2, 0), '#ffffff');
    }
    return gb.geometry();
  }
  function initTrees() {
    const G = CB.Gfx;
    M.trees = [];
    for (const con of [true, false]) {
      const mesh = new THREE.InstancedMesh(treeGeom(con), G.mats.city, 1);
      mesh.frustumCulled = false; mesh.castShadow = true; mesh.receiveShadow = true; mesh.count = 0;
      M.trees.push(mesh); G.cityMeshes.add(mesh); G.scene.add(mesh);
    }
    M.treesDirty = true;
  }
  function rebuildTrees() {
    const Wd = CB.World, G = CB.Gfx;
    const dens = G.settings.trees;
    const lists = [[], []];
    const n2 = U.makeNoise(Wd.seed + 5);
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      const i = U.idx(x, y);
      const t = Wd.tree[i];
      if (!t || Wd.bld[i] || Wd.road[i] || Wd.pmask[i] === 15 || Wd.rail[i] === 1) continue;
      const play = U.inPlay(x, y);
      let n = t * dens * (play ? 1 : 0.7);
      const base = Math.floor(n); const frac = n - base;
      n = base + (U.hash(x, y, 77) < frac ? 1 : 0);
      for (let k = 0; k < Math.min(n, 4); k++) {
        const jx = U.hash(x, y, k * 3 + 1), jz = U.hash(x, y, k * 3 + 2), js = U.hash(x, y, k * 3 + 9);
        const wx = (x + 0.12 + jx * 0.76) * T, wz = (y + 0.12 + jz * 0.76) * T;
        const gy = Wd.groundH(wx, wz);
        if (gy < C.WATER + 0.3) continue;
        const con = (n2(x * 0.06, y * 0.06) + (gy > 18 ? 0.6 : 0) + (js - 0.5) * 0.5) > 0.05;
        lists[con ? 0 : 1].push(wx, gy, wz, 0.75 + js * 0.6, U.hash(x, y, k + 40));
      }
    }
    const mat = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), yAx = new THREE.Vector3(0, 1, 0);
    const conCols = ['#2c5a2f', '#36663a', '#2a4f2c', '#3d6b3a'], decCols = ['#4f7d34', '#5f8c3b', '#6b9440', '#7a9a3a', '#476f30', '#8a9a3e'];
    for (let k = 0; k < 2; k++) {
      const L = lists[k], n = L.length / 5;
      let mesh = M.trees[k];
      if (mesh.instanceMatrix.count < n) {
        const nm = new THREE.InstancedMesh(mesh.geometry, G.mats.city, Math.ceil(n * 1.2) + 16);
        nm.frustumCulled = false; nm.castShadow = true; nm.receiveShadow = true;
        G.scene.remove(mesh); G.cityMeshes.delete(mesh); mesh.dispose();
        G.scene.add(nm); G.cityMeshes.add(nm); M.trees[k] = nm; mesh = nm;
      }
      const cols = k === 0 ? conCols : decCols;
      const ca = new Float32Array(mesh.instanceMatrix.count * 3);
      for (let j = 0; j < n; j++) {
        const o = j * 5;
        p.set(L[o], L[o + 1] - 0.2, L[o + 2]);
        q.setFromAxisAngle(yAx, L[o + 4] * 6.28);
        const sc = L[o + 3];
        s.set(sc, sc * (0.9 + L[o + 4] * 0.3), sc);
        mat.compose(p, q, s);
        mesh.setMatrixAt(j, mat);
        const c = lc(cols[Math.floor(L[o + 4] * cols.length) % cols.length]);
        ca[j * 3] = c[0]; ca[j * 3 + 1] = c[1]; ca[j * 3 + 2] = c[2];
      }
      mesh.instanceColor = new THREE.InstancedBufferAttribute(ca, 3);
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  // ======================================================================
  // Street lamps
  // ======================================================================
  function initLamps() {
    const G = CB.Gfx, gb = new GB();
    gb.box(-0.1, 0, -0.1, 0.1, 6.6, 0.1, '#4a4d52');
    gb.box(-0.1, 6.4, -0.08, 1.7, 6.55, 0.08, '#4a4d52');
    gb.box(1.3, 6.25, -0.18, 1.9, 6.42, 0.18, '#fff', 8);
    M.lampGeom = gb.geometry();
    M.lamps = new THREE.InstancedMesh(M.lampGeom, G.mats.city, 16);
    M.lamps.frustumCulled = false; M.lamps.count = 0;
    G.scene.add(M.lamps); G.cityMeshes.add(M.lamps);
  }
  function rebuildLamps() {
    const Wd = CB.World, G = CB.Gfx;
    const L = [];
    for (let i = 0; i < W * W; i++) {
      const rt = Wd.road[i]; if (!rt) continue;
      const x = U.tx(i), y = U.ty(i);
      if ((x + y) % 2) continue;
      if (C.ROADS[rt].grp === 'highway' || !C.ROADS[rt].car || CB.World.jcl[i] >= 0) continue;
      const m = Wd.roadMask(i);
      let side = -1;
      const pref = (x + y) % 4 === 0 ? [0, 1, 2, 3] : [2, 3, 0, 1];
      for (const d of pref) if (!(m & (1 << d))) { side = d; break; }
      if (side < 0) continue;
      const sw = Math.max(0.8, C.ROADS[rt].side);
      const cx = (x + 0.5) * T, cz = (y + 0.5) * T;
      const off = T / 2 - sw * 0.45;
      const px = cx + C.DX[side] * off, pz = cz + C.DY[side] * off;
      L.push(px, Wd.roadH(px, pz) + 0.2, pz, -C.DX[side], -C.DY[side]);
    }
    const n = L.length / 5;
    if (M.lamps.instanceMatrix.count < n) {
      G.scene.remove(M.lamps); G.cityMeshes.delete(M.lamps); M.lamps.dispose();
      M.lamps = new THREE.InstancedMesh(M.lampGeom, G.mats.city, Math.ceil(n * 1.3) + 32);
      M.lamps.frustumCulled = false; G.scene.add(M.lamps); G.cityMeshes.add(M.lamps);
    }
    const arr = M.lamps.instanceMatrix.array;
    for (let j = 0; j < n; j++) {
      const o = j * 5, dx = L[o + 3], dz = L[o + 4], e = j * 16;
      arr[e] = dx; arr[e + 1] = 0; arr[e + 2] = dz; arr[e + 3] = 0;
      arr[e + 4] = 0; arr[e + 5] = 1; arr[e + 6] = 0; arr[e + 7] = 0;
      arr[e + 8] = -dz; arr[e + 9] = 0; arr[e + 10] = dx; arr[e + 11] = 0;
      arr[e + 12] = L[o]; arr[e + 13] = L[o + 1]; arr[e + 14] = L[o + 2]; arr[e + 15] = 1;
    }
    M.lamps.count = n;
    M.lamps.instanceMatrix.needsUpdate = true;
  }

  // ======================================================================
  // Vehicles (instanced)
  // ======================================================================
  function vehGeom(kind) {
    const gb = new GB();
    const wheels = (xs, w) => { for (const x of xs) for (const z of [-w, w]) gb.box(x - 0.36, 0, z - 0.14, x + 0.36, 0.7, z + 0.14, '#111', 11); };
    switch (kind) {
      case 'car':
        gb.box(-2.1, 0.3, -0.85, 2.1, 1.0, 0.85, '#fff');
        gb.box(-1.15, 1.0, -0.76, 0.95, 1.52, 0.76, '#fff', 9);
        gb.box(2.08, 0.6, -0.7, 2.14, 0.85, -0.35, '#fff', 6); gb.box(2.08, 0.6, 0.35, 2.14, 0.85, 0.7, '#fff', 6);
        gb.box(-2.14, 0.65, -0.75, -2.08, 0.9, -0.4, '#fff', 7); gb.box(-2.14, 0.65, 0.4, -2.08, 0.9, 0.75, '#fff', 7);
        wheels([-1.35, 1.35], 0.8); break;
      case 'suv':
        gb.box(-2.3, 0.4, -0.95, 2.3, 1.25, 0.95, '#fff');
        gb.box(-1.9, 1.25, -0.88, 1.1, 1.95, 0.88, '#fff', 9);
        gb.box(2.28, 0.75, -0.8, 2.34, 1.0, -0.4, '#fff', 6); gb.box(2.28, 0.75, 0.4, 2.34, 1.0, 0.8, '#fff', 6);
        gb.box(-2.34, 0.8, -0.85, -2.28, 1.05, -0.45, '#fff', 7); gb.box(-2.34, 0.8, 0.45, -2.28, 1.05, 0.85, '#fff', 7);
        wheels([-1.5, 1.5], 0.9); break;
      case 'van':
        gb.box(-2.8, 0.4, -1.0, 1.6, 2.6, 1.0, '#fff');
        gb.box(1.6, 0.4, -1.0, 2.8, 1.6, 1.0, '#fff');
        gb.box(1.6, 1.6, -0.95, 2.3, 2.3, 0.95, '#fff', 9);
        gb.box(2.78, 0.8, -0.85, 2.84, 1.1, -0.5, '#fff', 6); gb.box(2.78, 0.8, 0.5, 2.84, 1.1, 0.85, '#fff', 6);
        wheels([-1.8, 1.9], 0.92); break;
      case 'truck':
        gb.box(1.6, 0.5, -1.15, 3.6, 2.9, 1.15, '#fff');
        gb.box(2.6, 1.8, -1.1, 3.62, 2.6, 1.1, '#fff', 9);
        gb.box(-3.6, 0.7, -1.2, 1.5, 3.5, 1.2, '#e8e6e0');
        gb.box(3.58, 0.9, -1.0, 3.64, 1.2, -0.6, '#fff', 6); gb.box(3.58, 0.9, 0.6, 3.64, 1.2, 1.0, '#fff', 6);
        gb.box(-3.64, 0.9, -1.1, -3.58, 1.2, -0.7, '#fff', 7); gb.box(-3.64, 0.9, 0.7, -3.58, 1.2, 1.1, '#fff', 7);
        wheels([-2.6, -1.4, 2.7], 1.05); break;
      case 'bus':
        gb.box(-5.2, 0.45, -1.25, 5.2, 3.1, 1.25, '#fff');
        gb.box(-5.0, 1.55, -1.27, 4.9, 2.65, 1.27, '#fff', 9);
        gb.box(5.15, 1.3, -1.2, 5.25, 2.9, 1.2, '#fff', 9);
        gb.box(-5.2, 3.1, -1.1, 5.2, 3.3, 1.1, '#dcdcdc');
        gb.box(5.2, 0.7, -1.0, 5.26, 1.0, -0.6, '#fff', 6); gb.box(5.2, 0.7, 0.6, 5.26, 1.0, 1.0, '#fff', 6);
        gb.box(-5.26, 0.8, -1.1, -5.2, 1.1, -0.7, '#fff', 7); gb.box(-5.26, 0.8, 0.7, -5.2, 1.1, 1.1, '#fff', 7);
        wheels([-3.4, 3.5], 1.1); break;
      case 'police':
        gb.box(-2.1, 0.3, -0.86, 2.1, 1.0, 0.86, '#f4f4f4');
        gb.box(-1.0, 0.45, -0.87, 1.2, 0.85, 0.87, '#1b3a8a');
        gb.box(-1.15, 1.0, -0.76, 0.95, 1.52, 0.76, '#fff', 9);
        gb.box(-0.4, 1.52, -0.6, 0.2, 1.7, -0.05, '#ff2020', 5); gb.box(-0.4, 1.52, 0.05, 0.2, 1.7, 0.6, '#2050ff', 5);
        gb.box(2.08, 0.6, -0.7, 2.14, 0.85, -0.35, '#fff', 6); gb.box(2.08, 0.6, 0.35, 2.14, 0.85, 0.7, '#fff', 6);
        wheels([-1.35, 1.35], 0.8); break;
      case 'ambulance':
        gb.box(-2.8, 0.4, -1.05, 1.5, 2.8, 1.05, '#f6f6f6');
        gb.box(1.5, 0.4, -1.05, 2.8, 1.7, 1.05, '#f6f6f6');
        gb.box(1.5, 1.7, -1.0, 2.2, 2.4, 1.0, '#fff', 9);
        gb.box(-2.8, 1.2, -1.06, 2.8, 1.5, 1.06, '#d92a2a');
        gb.box(0.6, 2.8, -0.7, 1.3, 3.0, 0.7, '#ff3030', 5);
        wheels([-1.8, 1.9], 0.95); break;
      case 'fire':
        gb.box(-3.6, 0.5, -1.2, 3.6, 2.6, 1.2, '#c8231c');
        gb.box(2.0, 2.6, -1.15, 3.6, 3.3, 1.15, '#c8231c');
        gb.box(2.4, 1.8, -1.22, 3.62, 3.0, 1.22, '#fff', 9);
        gb.box(-3.2, 2.6, -0.3, 1.8, 3.0, 0.3, '#d8d8d8');
        gb.box(2.6, 3.3, -0.8, 3.2, 3.5, 0.8, '#ff3030', 5);
        wheels([-2.4, 2.5], 1.1); break;
      case 'garbage':
        gb.box(1.8, 0.5, -1.15, 3.6, 2.8, 1.15, '#f0f0f0');
        gb.box(2.6, 1.7, -1.17, 3.62, 2.5, 1.17, '#fff', 9);
        gb.box(-3.6, 0.6, -1.2, 1.7, 3.2, 1.2, '#2f7a3b');
        wheels([-2.5, 2.7], 1.05); break;
      case 'tram':
        gb.box(-6.8, 0.35, -1.25, 6.8, 3.0, 1.25, '#fff');
        gb.box(-6.5, 1.3, -1.27, 6.5, 2.5, 1.27, '#fff', 9);
        gb.box(6.75, 1.2, -1.1, 6.95, 2.7, 1.1, '#fff', 9); gb.box(-6.95, 1.2, -1.1, -6.75, 2.7, 1.1, '#fff', 9);
        gb.box(-6.8, 3.0, -1.0, 6.8, 3.2, 1.0, '#d0d0d0');
        gb.box(-0.6, 3.2, -0.05, 0.6, 4.3, 0.05, '#333'); gb.box(-1.2, 4.25, -0.4, 1.2, 4.35, 0.4, '#333');
        gb.box(6.9, 0.6, -0.9, 6.96, 0.9, -0.5, '#fff', 6); gb.box(6.9, 0.6, 0.5, 6.96, 0.9, 0.9, '#fff', 6);
        break;
      case 'bike':
        gb.box(-0.85, 0.0, -0.04, 0.85, 0.7, 0.04, '#222');
        gb.box(-0.15, 0.7, -0.17, 0.25, 1.35, 0.17, '#fff');
        gb.box(-0.05, 1.35, -0.12, 0.2, 1.65, 0.12, '#e8c4a0');
        break;
      case 'ped':
        gb.box(-0.12, 0, -0.17, 0.12, 0.85, 0.17, '#3a3f4a');
        gb.box(-0.15, 0.85, -0.24, 0.15, 1.45, 0.24, '#fff');
        gb.box(-0.11, 1.45, -0.11, 0.11, 1.72, 0.11, '#e8c4a0');
        break;
      case 'train':
        gb.box(-6.9, 0.6, -1.4, 6.9, 3.6, 1.4, '#fff');
        gb.box(-6.4, 1.7, -1.42, 6.4, 2.9, 1.42, '#fff', 9);
        gb.box(-6.9, 3.6, -1.2, 6.9, 3.85, 1.2, '#cfd3d6');
        gb.box(-6.9, 0.25, -1.1, 6.9, 0.6, 1.1, '#333');
        gb.box(6.88, 1.7, -1.1, 6.96, 3.0, 1.1, '#fff', 9);
        gb.box(6.9, 0.8, -1.1, 6.96, 1.1, -0.6, '#fff', 6); gb.box(6.9, 0.8, 0.6, 6.96, 1.1, 1.1, '#fff', 6);
        break;
    }
    return gb.geometry();
  }
  // ---------------- detailed models (high / ultra) ----------------
  // side profile [x, y] points (convex, counter-clockwise) extruded across z0..z1
  function extrude(gb, prof, z0, z1, col, st, inset) {
    const n = prof.length, k = inset || 0;
    for (let i = 0; i < n; i++) {
      const a = prof[i], b = prof[(i + 1) % n];
      gb.quad([a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1], col, st);
    }
    let cx = 0, cy = 0; for (const p of prof) { cx += p[0]; cy += p[1]; } cx /= n; cy /= n;
    for (let i = 0; i < n; i++) {
      const a = prof[i], b = prof[(i + 1) % n];
      const sh = (p, z) => [p[0] + (cx - p[0]) * k, p[1] + (cy - p[1]) * k, z];
      gb.tri(sh(a, z1), sh(b, z1), [cx, cy, z1], col, st);
      gb.tri(sh(b, z0), sh(a, z0), [cx, cy, z0], col, st);
    }
  }
  const WHEEL = new THREE.CylinderGeometry(1, 1, 1, 14).rotateX(Math.PI / 2);
  const RIM = new THREE.CylinderGeometry(1, 1, 1, 10).rotateX(Math.PI / 2);
  function wheelHQ(gb, x, z, r, w, rimCol) {
    gb.addThree(WHEEL, new THREE.Matrix4().makeScale(r, r, w).setPosition(x, r, z), '#141414', 17);
    const side = z > 0 ? 1 : -1;
    gb.addThree(RIM, new THREE.Matrix4().makeScale(r * 0.6, r * 0.6, 0.04).setPosition(x, r, z + side * w * 0.5), rimCol || '#b8bcc2', 16);
  }
  function lights(gb, xf, xr, y, zs, w) {
    for (const z of zs) {
      gb.box(xf - 0.04, y, z - w, xf + 0.04, y + 0.2, z + w, '#fff', 6);
      gb.box(xr - 0.04, y + 0.05, z - w, xr + 0.04, y + 0.22, z + w, '#fff', 7);
    }
  }
  // window pane on the plane through edge a->b of a side profile, inset along the edge
  function pane(gb, a, b, z0, z1, t0, t1, out) {
    const lx = b[0] - a[0], ly = b[1] - a[1], l = Math.hypot(lx, ly), nx = ly / l * out, ny = -lx / l * out;
    const P = t => [a[0] + lx * t + nx, a[1] + ly * t + ny];
    const A = P(t0), B = P(t1);
    gb.quad([A[0], A[1], z0], [A[0], A[1], z1], [B[0], B[1], z1], [B[0], B[1], z0], '#fff', 9);
    gb.quad([A[0], A[1], z1], [A[0], A[1], z0], [B[0], B[1], z0], [B[0], B[1], z1], '#fff', 9);
  }
  function shrink(prof, k, dy) {
    let cx = 0, cy = 0; for (const p of prof) { cx += p[0]; cy += p[1]; } cx /= prof.length; cy /= prof.length;
    return prof.map(p => [p[0] + (cx - p[0]) * k, p[1] + (cy - p[1]) * k + (dy || 0)]);
  }
  function sideGlass(gb, prof, zs) { for (const z of zs) extrude(gb, prof, z - 0.012, z + 0.012, '#fff', 9); }
  function chamferRect(x0, y0, x1, y1, c, c2) { const d = c2 === undefined ? c : c2; return [[x0, y0 + d], [x0 + d, y0], [x1 - d, y0], [x1, y0 + d], [x1, y1 - c], [x1 - c, y1], [x0 + c, y1], [x0, y1 - c]]; }
  function carHQ(gb, L, W, H, kind) {
    const body = '#fff', trim = '#24262a';
    const sill = 0.3, belt = H * 0.53, roof = H;
    const hood = L * 0.44, rear = -L * 0.8;
    // lower body: rounded nose and tail
    extrude(gb, [[-L + 0.12, sill], [L - 0.15, sill], [L + 0.03, sill + 0.25], [L, belt - 0.2], [L - 0.35, belt + 0.02], [-L + 0.25, belt + 0.05], [-L - 0.02, belt - 0.12], [-L - 0.04, sill + 0.22]], -W, W, body, 0);
    // cabin in body colour, glass as separate panes
    const cab = kind === 'suv'
      ? [[-L + 0.2, belt], [hood - 0.15, belt], [hood - 0.75, roof - 0.05], [hood - 0.95, roof], [-L + 0.42, roof], [-L + 0.3, roof - 0.08]]
      : [[rear + 0.1, belt], [hood, belt], [hood - 0.95, roof - 0.04], [hood - 1.15, roof], [rear + 0.8, roof], [rear + 0.65, roof - 0.04]];
    const cw = W - 0.1;
    extrude(gb, cab, -cw, cw, body, 0);
    pane(gb, cab[1], cab[2], -cw + 0.12, cw - 0.12, 0.08, 0.95, 0.012);          // windscreen
    pane(gb, cab[5], cab[0], -cw + 0.14, cw - 0.14, 0.05, 0.86, 0.012);          // rear window
    const sg = shrink([cab[0], cab[1], cab[2], cab[3], cab[4], cab[5]], 0.2, 0.03);
    sideGlass(gb, sg, [-cw - 0.006, cw + 0.006]);
    for (const z of [-cw - 0.02, cw + 0.02]) gb.box(-0.12, belt, z - 0.015, 0.06, roof - 0.06, z + 0.015, body); // B pillar
    // bumpers, grille, plates, lights
    gb.box(L - 0.06, sill - 0.04, -W + 0.08, L + 0.1, sill + 0.3, W - 0.08, trim, 17);
    gb.box(-L - 0.12, sill - 0.04, -W + 0.08, -L + 0.06, sill + 0.3, W - 0.08, trim, 17);
    gb.box(L + 0.03, belt - 0.5, -W * 0.42, L + 0.06, belt - 0.3, W * 0.42, '#151618');
    gb.box(-L - 0.14, sill + 0.33, -0.3, -L - 0.1, sill + 0.5, 0.3, '#e8e8e0');
    for (const z of [-W + 0.28, W - 0.28]) {
      gb.box(L - 0.02, belt - 0.42, z - 0.22, L + 0.05, belt - 0.24, z + 0.22, '#fff', 6);
      gb.box(-L - 0.07, belt - 0.4, z - 0.24, -L, belt - 0.2, z + 0.24, '#fff', 7);
    }
    for (const z of [-W - 0.13, W + 0.13]) gb.box(hood - 0.4, belt + 0.03, Math.min(z, z * 0.88) - 0.03, hood - 0.2, belt + 0.2, Math.max(z, z * 0.88) + 0.03, body);
    for (const z of [-W - 0.004, W + 0.004]) { gb.box(-L * 0.42, sill + 0.4, z - 0.004, -L * 0.42 + 0.04, belt - 0.06, z + 0.004, trim, 17); gb.box(0.2, belt - 0.2, z - 0.006, 0.42, belt - 0.15, z + 0.006, trim, 17); }
    gb.box(-L + 0.1, sill - 0.02, -W - 0.01, L - 0.1, sill + 0.08, W + 0.01, trim, 17); // rocker strip
    const wr = kind === 'suv' ? 0.42 : 0.35, wx = L * 0.64;
    for (const x of [-wx, wx]) for (const z of [-W + 0.17, W - 0.17]) wheelHQ(gb, x, z, wr, 0.26);
    if (kind === 'suv') { gb.box(-L * 0.6, roof + 0.07, -W + 0.15, L * 0.1, roof + 0.13, -W + 0.22, trim, 17); gb.box(-L * 0.6, roof + 0.07, W - 0.22, L * 0.1, roof + 0.13, W - 0.15, trim, 17); }
  }
  // boxy vehicles: chamfered body, window band, cab with sloped screen
  function cabHQ(gb, x0, x1, H, W, col, opts) {
    opts = opts || {};
    const prof = [[x0, 0.45], [x1 - 0.1, 0.45], [x1 + 0.04, 0.7], [x1, H * 0.55], [x1 - (opts.slope || 0.45), H - 0.1], [x1 - (opts.slope || 0.45) - 0.12, H], [x0, H]];
    extrude(gb, prof, -W, W, col, 0);
    pane(gb, prof[3], prof[4], -W + 0.15, W - 0.15, 0.06, 0.94, 0.012);
    const sg = [[x0 + 0.25, H * 0.55], [x1 - 0.15, H * 0.55], [x1 - (opts.slope || 0.45) + 0.05, H - 0.2], [x0 + 0.25, H - 0.2]];
    sideGlass(gb, sg, [-W - 0.006, W + 0.006]);
    gb.box(x1 - 0.02, 0.5, -W + 0.1, x1 + 0.12, 0.85, W - 0.1, '#24262a');
    for (const z of [-W + 0.28, W - 0.28]) gb.box(x1 + 0.02, 0.95, z - 0.2, x1 + 0.07, 1.15, z + 0.2, '#fff', 6);
    for (const z of [-W - 0.15, W + 0.15]) gb.box(x1 - 0.5, H * 0.55, Math.min(z, z * 0.9) - 0.03, x1 - 0.35, H * 0.55 + 0.35, Math.max(z, z * 0.9) + 0.03, '#24262a');
  }
  function boxBody(gb, x0, x1, y0, y1, W, col, st) { extrude(gb, chamferRect(x0, y0, x1, y1, 0.12, 0.05), -W, W, col, st || 0); }
  function windowBand(gb, x0, x1, y0, y1, W) { for (const z of [-W - 0.006, W + 0.006]) extrude(gb, chamferRect(x0, y0, x1, y1, 0.06), z - 0.012, z + 0.012, '#fff', 9); }
  function tail(gb, x, W, y) { for (const z of [-W + 0.25, W - 0.25]) gb.box(x - 0.05, y, z - 0.18, x + 0.01, y + 0.25, z + 0.18, '#fff', 7); }
  function heavyHQ(gb, kind) {
    switch (kind) {
      case 'van':
        boxBody(gb, -2.8, 1.25, 0.4, 2.55, 1.0, '#fff'); cabHQ(gb, 1.2, 2.8, 2.3, 0.98, '#fff', { slope: 0.6 });
        windowBand(gb, -0.4, 1.0, 1.55, 2.2, 1.0); tail(gb, -2.85, 1.0, 0.8);
        for (const x of [-1.85, 1.95]) for (const z of [-0.8, 0.8]) wheelHQ(gb, x, z, 0.38, 0.28); break;
      case 'ambulance':
        boxBody(gb, -2.8, 1.35, 0.4, 2.8, 1.05, '#f6f6f6'); cabHQ(gb, 1.3, 2.85, 2.25, 1.02, '#f6f6f6', { slope: 0.6 });
        gb.box(-2.82, 1.15, -1.07, 2.86, 1.45, 1.07, '#d92a2a'); gb.box(0.6, 2.8, -0.75, 1.3, 3.0, -0.05, '#ff3030', 5); gb.box(0.6, 2.8, 0.05, 1.3, 3.0, 0.75, '#2050ff', 5);
        tail(gb, -2.85, 1.05, 0.8); for (const x of [-1.85, 1.95]) for (const z of [-0.82, 0.82]) wheelHQ(gb, x, z, 0.38, 0.28); break;
      case 'truck':
        cabHQ(gb, 1.55, 3.6, 2.95, 1.15, '#fff', { slope: 0.35 }); boxBody(gb, -3.65, 1.45, 0.75, 3.55, 1.22, '#e8e6e0');
        gb.box(-3.66, 0.55, -1.0, 1.45, 0.75, 1.0, '#2a2c30'); tail(gb, -3.7, 1.2, 0.9);
        for (const x of [-2.7, -1.5, 2.65]) for (const z of [-0.98, 0.98]) wheelHQ(gb, x, z, 0.46, 0.34); break;
      case 'garbage':
        cabHQ(gb, 1.8, 3.6, 2.85, 1.15, '#f0f0f0', { slope: 0.3 }); boxBody(gb, -3.65, 1.7, 0.6, 3.2, 1.2, '#2f7a3b');
        extrude(gb, [[-3.65, 0.6], [-3.2, 0.6], [-3.2, 3.2], [-3.9, 2.9], [-3.9, 1.0]], -1.15, 1.15, '#27662f');
        tail(gb, -3.92, 1.1, 1.2); for (const x of [-2.5, 2.6]) for (const z of [-0.98, 0.98]) wheelHQ(gb, x, z, 0.46, 0.34); break;
      case 'fire':
        cabHQ(gb, 1.9, 3.6, 2.7, 1.2, '#c8231c', { slope: 0.3 }); boxBody(gb, -3.6, 1.85, 0.5, 2.6, 1.22, '#c8231c');
        gb.box(-3.3, 2.65, -0.35, 1.7, 2.8, -0.25, '#d8d8d8'); gb.box(-3.3, 2.65, 0.25, 1.7, 2.8, 0.35, '#d8d8d8');
        for (let k = 0; k < 9; k++) gb.box(-3.2 + k * 0.55, 2.66, -0.3, -3.12 + k * 0.55, 2.76, 0.3, '#d8d8d8');
        gb.box(2.5, 2.7, -0.8, 3.1, 2.9, 0.8, '#ff3030', 5); for (const z of [-1.23, 1.23]) gb.box(-3.5, 1.2, z - 0.01, 1.8, 1.35, z + 0.01, '#f2d24a', 5);
        for (const x of [-2.4, 2.5]) for (const z of [-1.0, 1.0]) wheelHQ(gb, x, z, 0.46, 0.34); break;
      case 'bus':
        boxBody(gb, -5.2, 5.2, 0.4, 3.1, 1.25, '#fff'); windowBand(gb, -4.9, 4.6, 1.45, 2.65, 1.25);
        pane(gb, [5.2, 1.3], [5.2, 2.95], -1.1, 1.1, 0.03, 0.97, 0.03);
        gb.box(5.21, 2.7, -0.7, 5.25, 2.95, 0.7, '#ffb000', 5); gb.box(-5.2, 3.1, -0.9, 3.0, 3.35, 0.9, '#d9d9d9');
        for (const z of [-0.95, 0.95]) gb.box(5.2, 0.7, z - 0.18, 5.26, 0.9, z + 0.18, '#fff', 6); tail(gb, -5.24, 1.25, 0.8);
        for (const x of [-3.4, 3.5]) for (const z of [-1.04, 1.04]) wheelHQ(gb, x, z, 0.5, 0.3); break;
      case 'tram':
        boxBody(gb, -6.8, 6.8, 0.35, 3.0, 1.25, '#fff'); windowBand(gb, -6.3, 6.3, 1.3, 2.55, 1.25);
        for (const x of [6.8, -6.8]) pane(gb, [x, 1.2], [x, 2.7], -1.05, 1.05, 0.03, 0.97, x > 0 ? 0.03 : -0.03);
        gb.box(-6.8, 3.0, -1.0, 6.8, 3.15, 1.0, '#cfcfcf'); gb.box(-0.6, 3.15, -0.05, 0.6, 4.2, 0.05, '#333'); gb.box(-1.2, 4.15, -0.45, 1.2, 4.25, 0.45, '#333');
        for (const z of [-0.95, 0.95]) gb.box(6.8, 0.6, z - 0.15, 6.86, 0.8, z + 0.15, '#fff', 6);
        for (const x of [-4.6, 4.6]) gb.box(x - 1.1, 0.0, -0.95, x + 1.1, 0.4, 0.95, '#2a2c30'); break;
      default: return false;
    }
    return true;
  }
  function personHQ(gb, pose) {
    // ~1.75 m tall; shirt takes the instance colour, trousers/skin fixed
    const skin = '#d9a77f', pants = U.pick(['#2b3445', '#3a3f4a', '#5a4a3a', '#2a2c30'], () => 0.3), shoe = '#1e1e20';
    const sw = pose ? 0.28 : -0.28;
    for (const [z, k] of [[-0.11, 1], [0.11, -1]]) {
      const off = sw * k;
      gb.box(-0.08 + off * 0.5, 0.45, z - 0.07, 0.08 + off * 0.5, 0.9, z + 0.07, pants, 17);
      gb.box(-0.07 + off, 0.06, z - 0.065, 0.07 + off, 0.47, z + 0.065, pants, 17);
      gb.box(-0.06 + off, 0, z - 0.07, 0.17 + off, 0.08, z + 0.07, shoe, 17);
    }
    extrude(gb, [[-0.12, 0.88], [0.12, 0.88], [0.14, 1.45], [-0.13, 1.45]], -0.22, 0.22, '#fff', 0);
    gb.box(-0.1, 1.45, -0.25, 0.1, 1.52, 0.25, '#fff');
    for (const [z, k] of [[-0.29, -1], [0.29, 1]]) {
      const off = sw * k * 0.8;
      gb.box(-0.05 + off * 0.3, 1.12, z - 0.05, 0.05 + off * 0.3, 1.47, z + 0.05, '#fff');
      gb.box(-0.045 + off, 0.86, z - 0.045, 0.045 + off, 1.14, z + 0.045, skin, 18);
    }
    gb.box(-0.05, 1.52, -0.05, 0.05, 1.6, 0.05, skin, 18);
    gb.addThree(new THREE.IcosahedronGeometry(0.12, 1), new THREE.Matrix4().makeScale(1, 1.12, 0.95).setPosition(0.01, 1.71, 0), skin, 18);
    gb.addThree(new THREE.SphereGeometry(0.125, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.Matrix4().setPosition(-0.01, 1.73, 0), U.pick(['#2a1e16', '#4a3020', '#b08a50', '#151515'], () => 0.6));
  }
  function bikeHQ(gb, pose) {
    const frame = '#fff', dark = '#1a1a1a', skin = '#d9a77f';
    const ring = new THREE.TorusGeometry(0.33, 0.035, 6, 18);
    for (const x of [-0.52, 0.52]) { gb.addThree(ring, new THREE.Matrix4().setPosition(x, 0.36, 0), dark, 17); gb.addThree(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 6).rotateX(Math.PI / 2), new THREE.Matrix4().setPosition(x, 0.36, 0), '#999'); }
    const tube = (a, b, r, col) => {
      const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), len = d.length();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      gb.addThree(new THREE.CylinderGeometry(r, r, 1, 5), new THREE.Matrix4().compose(new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), q, new THREE.Vector3(1, len, 1)), col);
    };
    const bb = [0, 0.38, 0], st = [-0.15, 0.85, 0], ht = [0.4, 0.88, 0];
    tube([-0.52, 0.36, 0], bb, 0.025, frame); tube(bb, st, 0.028, frame); tube(st, ht, 0.026, frame); tube(bb, ht, 0.03, frame); tube([-0.52, 0.36, 0], st, 0.02, frame); tube(ht, [0.52, 0.36, 0], 0.025, frame);
    tube([0.4, 0.88, 0], [0.38, 1.0, 0], 0.02, dark, 17); tube([0.36, 1.0, -0.24], [0.36, 1.0, 0.24], 0.018, dark, 17);
    gb.box(-0.27, 0.9, -0.06, -0.05, 0.95, 0.06, dark, 17);
    // rider
    const pants = '#2b3445';
    const k1 = pose ? 0.16 : -0.16;
    for (const [z, s] of [[-0.11, 1], [0.11, -1]]) {
      const knee = [0.08 + k1 * s * 0.5, 0.72 + k1 * s * 0.4, z], hip = [-0.12, 0.98, z], foot = [0.02 + k1 * s, 0.32 + k1 * s * 0.25, z];
      tube(hip, knee, 0.065, pants); tube(knee, foot, 0.055, pants);
      gb.box(foot[0] - 0.04, foot[1] - 0.04, z - 0.05, foot[0] + 0.14, foot[1] + 0.03, z + 0.05, '#1e1e20', 17);
    }
    tube([-0.12, 0.98, 0], [0.12, 1.45, 0], 0.17, '#fff');
    for (const z of [-0.2, 0.2]) { tube([0.08, 1.4, z], [0.34, 1.02, z * 1.1], 0.045, '#fff'); }
    gb.addThree(new THREE.IcosahedronGeometry(0.115, 1), new THREE.Matrix4().setPosition(0.2, 1.62, 0), skin, 18);
    gb.addThree(new THREE.SphereGeometry(0.135, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.5), new THREE.Matrix4().makeScale(1.15, 0.9, 1).setPosition(0.19, 1.65, 0), '#e8e8e8');
  }
  function vehGeomHQ(kind) {
    const gb = new GB();
    switch (kind) {
      case 'car': carHQ(gb, 2.15, 0.86, 1.5, 'car'); break;
      case 'suv': carHQ(gb, 2.35, 0.95, 1.85, 'suv'); break;
      case 'police': carHQ(gb, 2.15, 0.86, 1.5, 'car'); gb.box(-0.95, 0.5, -0.875, 1.0, 0.95, 0.875, '#1b3a8a'); gb.box(-0.5, 1.56, -0.55, 0.3, 1.72, -0.05, '#ff2020', 5); gb.box(-0.5, 1.56, 0.05, 0.3, 1.72, 0.55, '#2050ff', 5); break;
      case 'van': case 'ambulance': case 'truck': case 'garbage': case 'fire': case 'bus': case 'tram': heavyHQ(gb, kind); break;
      case 'ped': personHQ(gb, 0); break;
      case 'ped2': personHQ(gb, 1); break;
      case 'bike': bikeHQ(gb, 0); break;
      case 'bike2': bikeHQ(gb, 1); break;
      default: return null;
    }
    return gb.geometry();
  }
  M._vehGeomHQ = vehGeomHQ;
  M.VEH_KINDS = ['car', 'suv', 'van', 'truck', 'bus', 'tram', 'police', 'ambulance', 'fire', 'garbage', 'train', 'bike', 'bike2', 'ped', 'ped2'];
  function initVehicles() {
    const G = CB.Gfx;
    M.veh = {};
    const cars = G.settings.cars;
    const caps = { car: cars, suv: Math.ceil(cars * 0.6), van: 80, truck: Math.ceil(cars * 0.5), bus: 200, tram: 120, police: 80, ambulance: 60, fire: 60, garbage: 120, train: 600, bike: Math.ceil(cars * 0.7), bike2: Math.ceil(cars * 0.7), ped: Math.ceil(cars * 0.7), ped2: Math.ceil(cars * 0.7) };
    const detail = G.settings.detail;
    for (const k of M.VEH_KINDS) {
      const g = (detail && vehGeomHQ(k)) || vehGeom(k === 'ped2' ? 'ped' : k === 'bike2' ? 'bike' : k);
      const mesh = new THREE.InstancedMesh(g, G.mats.city, caps[k]);
      mesh.frustumCulled = false;
      mesh.castShadow = G.settings.shadows >= 2048 && !(k.startsWith('ped') || k.startsWith('bike')) || G.settings.shadows >= 4096;
      mesh.receiveShadow = false;
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(caps[k] * 3).fill(1), 3);
      mesh.count = 0;
      G.scene.add(mesh); G.cityMeshes.add(mesh);
      M.veh[k] = { mesh, n: 0, cap: caps[k] };
    }
  }
  M.resizeVehicles = function () {
    const G = CB.Gfx;
    for (const k of M.VEH_KINDS) { const v = M.veh[k]; G.scene.remove(v.mesh); G.cityMeshes.delete(v.mesh); v.mesh.geometry.dispose(); v.mesh.dispose(); }
    initVehicles();
  };
  M.beginVehicles = function () { for (const k of M.VEH_KINDS) M.veh[k].n = 0; M.sigN = 0; };
  // traffic light heads (dynamic)
  const SIG_COLS = [lc('#ff2a1a'), lc('#ffb000'), lc('#28e05a')];
  function initSignals() {
    const G = CB.Gfx, gb = new GB();
    gb.box(-0.26, -0.26, -0.26, 0.26, 0.26, 0.26, '#fff', 15);
    M.sig = new THREE.InstancedMesh(gb.geometry(), G.mats.city, 4000);
    M.sig.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(4000 * 3), 3);
    M.sig.frustumCulled = false; M.sig.count = 0;
    G.scene.add(M.sig); G.cityMeshes.add(M.sig);
    M.sigN = 0;
  }
  M.pushSignal = function (x, y, z, st) {
    if (M.sigN >= 4000) return;
    const j = M.sigN++, a = M.sig.instanceMatrix.array, e = j * 16;
    const yy = y + (st === 2 ? -0.55 : st === 1 ? 0 : 0.55);
    a.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, yy, z, 1], e);
    const c = SIG_COLS[st], ca = M.sig.instanceColor.array;
    ca[j * 3] = c[0]; ca[j * 3 + 1] = c[1]; ca[j * 3 + 2] = c[2];
  };
  M.pushVehicle = function (kind, x, y, z, dx, dz, col, pitch, ws) {
    const v = M.veh[kind]; if (!v || v.n >= v.cap) return false;
    ws = ws || 1;
    const j = v.n++;
    const a = v.mesh.instanceMatrix.array, e = j * 16;
    const p = pitch || 0, cp = Math.cos(p), sp = Math.sin(p);
    // forward (dx, sp, dz) with pitch, up approx
    a[e] = dx * cp; a[e + 1] = sp; a[e + 2] = dz * cp; a[e + 3] = 0;
    a[e + 4] = -dx * sp; a[e + 5] = cp; a[e + 6] = -dz * sp; a[e + 7] = 0;
    a[e + 8] = -dz * ws; a[e + 9] = 0; a[e + 10] = dx * ws; a[e + 11] = 0;
    a[e + 12] = x; a[e + 13] = y; a[e + 14] = z; a[e + 15] = 1;
    const c = v.mesh.instanceColor.array;
    if (col) { c[j * 3] = col[0]; c[j * 3 + 1] = col[1]; c[j * 3 + 2] = col[2]; }
    else { c[j * 3] = 1; c[j * 3 + 1] = 1; c[j * 3 + 2] = 1; }
    return true;
  };
  M.endVehicles = function () {
    M.sig.count = M.sigN; if (M.sigN) { M.sig.instanceMatrix.needsUpdate = true; M.sig.instanceColor.needsUpdate = true; }
    for (const k of M.VEH_KINDS) {
      const v = M.veh[k];
      v.mesh.count = v.n;
      if (v.n) { v.mesh.instanceMatrix.needsUpdate = true; v.mesh.instanceColor.needsUpdate = true; }
    }
  };
  M.CAR_COLORS = ['#d8dadc', '#1e2125', '#8c1c1c', '#f2f2f2', '#25467a', '#5d686e', '#9aa0a4', '#3a5a3a', '#b8862f', '#6e2a4a', '#c45a1c', '#2b2b30'].map(lc);

  // ======================================================================
  // Previews / ghosts
  // ======================================================================
  function initGhosts() {
    const G = CB.Gfx;
    const bg = new THREE.BoxGeometry(T * 0.96, 1.2, T * 0.96); bg.translate(0, 0.6, 0);
    M.ghostTiles = new THREE.InstancedMesh(bg, G.mats.ghostInst, 600);
    M.ghostTiles.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(600 * 3), 3);
    M.ghostTiles.frustumCulled = false; M.ghostTiles.count = 0; M.ghostTiles.renderOrder = 5;
    G.scene.add(M.ghostTiles);
    M.ghostBox = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ color: 0x55ccff, transparent: true, opacity: 0.4, depthWrite: false }));
    M.ghostBox.visible = false; M.ghostBox.renderOrder = 5; G.scene.add(M.ghostBox);
    const rg = new THREE.RingGeometry(0.96, 1, 96); rg.rotateX(-Math.PI / 2);
    M.ring = new THREE.Mesh(rg, G.mats.ring); M.ring.visible = false; M.ring.renderOrder = 6; G.scene.add(M.ring);
    const sel = new THREE.MeshBasicMaterial({ color: 0x66ddff, transparent: true, opacity: 0.35, depthWrite: false });
    M.selMat = sel;
    M.selMesh = null;
  }
  M.setGhostTiles = function (list) { // [{i, ok, h}]
    const Wd = CB.World;
    const g = M.ghostTiles, a = g.instanceMatrix.array, c = g.instanceColor.array;
    const n = Math.min(list.length, 600);
    for (let j = 0; j < n; j++) {
      const t = list[j], half = t.f !== undefined;
      const x = half ? ((t.f % C.FW) + 0.5) * T / 2 : (U.tx(t.i) + 0.5) * T, z = half ? (((t.f / C.FW) | 0) + 0.5) * T / 2 : (U.ty(t.i) + 0.5) * T;
      const y = (t.y !== undefined ? t.y : Math.max(Wd.groundH(x, z), C.WATER)) + 0.05;
      const e = j * 16, hs = t.h || 1, sc = half ? 0.5 : 1;
      a.set([sc, 0, 0, 0, 0, hs, 0, 0, 0, 0, sc, 0, x, y, z, 1], e);
      const col = t.col || (t.ok ? [0.3, 0.9, 0.5] : [1, 0.25, 0.2]);
      c[j * 3] = col[0]; c[j * 3 + 1] = col[1]; c[j * 3 + 2] = col[2];
    }
    g.count = n; g.instanceMatrix.needsUpdate = true; g.instanceColor.needsUpdate = true;
  };
  M.setGhostBox = function (x0, z0, x1, z1, y, h, ok) {
    if (x0 === null) { M.ghostBox.visible = false; return; }
    M.ghostBox.visible = true;
    M.ghostBox.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    M.ghostBox.scale.set(x1 - x0, h, z1 - z0);
    M.ghostBox.material.color.set(ok ? 0x55ccff : 0xff4433);
  };
  M.setRing = function (x, z, r) {
    if (x === null) { M.ring.visible = false; return; }
    M.ring.visible = true;
    M.ring.position.set(x, Math.max(CB.World.groundH(x, z), C.WATER) + 1.5, z);
    M.ring.scale.set(r, 1, r);
  };
  M.setSelection = function (b) {
    const G = CB.Gfx;
    if (M.selMesh) { G.scene.remove(M.selMesh); M.selMesh.geometry.dispose(); M.selMesh = null; }
    if (!b) return;
    const gb = new GB(); M.genBuilding(gb, b);
    const geo = gb.geometry();
    M.selMesh = new THREE.Mesh(geo, M.selMat);
    M.selMesh.renderOrder = 7;
    const cx = (b.x + b.fw / 2) * T, cz = (b.y + b.fh / 2) * T;
    geo.translate(-cx, -b.baseY, -cz);
    M.selMesh.position.set(cx, b.baseY - 0.05, cz);
    M.selMesh.scale.set(1.04, 1.02, 1.04);
    G.scene.add(M.selMesh);
  };

  // ======================================================================
  // Problem icons
  // ======================================================================
  const ICONS = {
    road: ['#e05a3a', 'R'], noconn: ['#e05a3a', '⛔'], garbage: ['#9a7a3a', '🗑'], fire: ['#ff5a1f', '🔥'],
    aband: ['#6a6a6a', '✕'], workers: ['#e0a03a', '👷'], customers: ['#3a8ae0', '$'], sick: ['#d03a3a', '+'], noroad: ['#e05a3a', '⚠'],
  };
  function initIcons() {
    M.iconTex = {};
    for (const k in ICONS) {
      const cv = document.createElement('canvas'); cv.width = cv.height = 64;
      const g = cv.getContext('2d');
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(32, 34, 28, 0, 7); g.fill();
      g.fillStyle = ICONS[k][0]; g.beginPath(); g.arc(32, 31, 27, 0, 7); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 4; g.stroke();
      g.fillStyle = '#fff'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(ICONS[k][1], 32, 33);
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
      M.iconTex[k] = new THREE.SpriteMaterial({ map: t, sizeAttenuation: false, depthTest: false, transparent: true });
    }
    M.iconPool = [];
  }
  M.setIcons = function (list) {
    const G = CB.Gfx;
    while (M.iconPool.length < list.length) {
      const s = new THREE.Sprite(M.iconTex.road); s.scale.set(0.035, 0.035, 1); s.renderOrder = 20;
      G.scene.add(s); M.iconPool.push(s);
    }
    for (let k = 0; k < M.iconPool.length; k++) {
      const s = M.iconPool[k];
      if (k < list.length) {
        const it = list[k];
        s.visible = true; s.material = M.iconTex[it.type] || M.iconTex.road;
        s.position.set(it.x, it.y, it.z);
      } else s.visible = false;
    }
  };

  // ======================================================================
  // Ribbons (transit lines)
  // ======================================================================
  M.ribbon = function (pts, width, color, closed) {
    // pts: flat [x,y,z,...]
    const n = pts.length / 3; if (n < 2) return null;
    const pos = [], col = [];
    const c = lc(color);
    const P = k => { k = closed ? (k + n) % n : U.clamp(k, 0, n - 1); return [pts[k * 3], pts[k * 3 + 1], pts[k * 3 + 2]]; };
    const cnt = closed ? n + 1 : n;
    let prevL = null, prevR = null;
    for (let k = 0; k < cnt; k++) {
      const a = P(k - 1), b = P(k), d = P(k + 1);
      let tx = d[0] - a[0], tz = d[2] - a[2]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      const L = [b[0] - tz * width / 2, b[1], b[2] + tx * width / 2];
      const R = [b[0] + tz * width / 2, b[1], b[2] - tx * width / 2];
      if (prevL) {
        pos.push(...prevL, ...prevR, ...R, ...prevL, ...R, ...L);
        for (let q = 0; q < 6; q++) col.push(c[0], c[1], c[2]);
      }
      prevL = L; prevR = R;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
    const mesh = new THREE.Mesh(g, CB.Gfx.mats.line);
    mesh.renderOrder = 8; mesh.frustumCulled = false;
    return mesh;
  };

  // ======================================================================
  // Zone & overlay textures
  // ======================================================================
  const ZC = C.ZONES.map(z => z ? U.hex(z.color) : null);
  M.updateZoneTex = function (zoneTool) {
    const Wd = CB.World, d = CB.Gfx.zoneTex.image.data;
    for (let i = 0; i < W * W; i++) {
      const z = Wd.zone[i], o = i * 4;
      if (z && !Wd.bld[i]) {
        const c = ZC[z];
        d[o] = c[0] * 255; d[o + 1] = c[1] * 255; d[o + 2] = c[2] * 255; d[o + 3] = zoneTool ? 170 : 95;
      } else if (zoneTool && Wd.zonable[i] && !Wd.bld[i]) {
        d[o] = 235; d[o + 1] = 240; d[o + 2] = 235; d[o + 3] = 40;
      } else d[o + 3] = 0;
    }
    CB.Gfx.zoneTex.needsUpdate = true;
  };
  M.writeOverlay = function (fn) {
    const d = CB.Gfx.ovTex.image.data;
    for (let i = 0; i < W * W; i++) {
      const c = fn(i), o = i * 4;
      if (c) { d[o] = c[0] * 255; d[o + 1] = c[1] * 255; d[o + 2] = c[2] * 255; d[o + 3] = (c[3] === undefined ? 1 : c[3]) * 255; }
      else d[o + 3] = 0;
    }
    CB.Gfx.ovTex.needsUpdate = true;
  };
})();
