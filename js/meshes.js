'use strict';
// Arterial — procedural geometry: buildings, roads, rail, trees, vehicles, previews, icons
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
      if (this.noLit && st >= 1 && st <= 5) st = 0;
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
    gable(x0, z0, x1, z1, y, h, alongX, col, wall) {
      wall = wall || col;
      if (alongX) {
        const zm = (z0 + z1) / 2;
        this.quad([x1, y, z0], [x0, y, z0], [x0, y + h, zm], [x1, y + h, zm], col);
        this.quad([x0, y, z1], [x1, y, z1], [x1, y + h, zm], [x0, y + h, zm], col);
        this.tri([x0, y, z0], [x0, y, z1], [x0, y + h, zm], wall);
        this.tri([x1, y, z1], [x1, y, z0], [x1, y + h, zm], wall);
      } else {
        const xm = (x0 + x1) / 2;
        this.quad([x0, y, z0], [x0, y, z1], [xm, y + h, z1], [xm, y + h, z0], col);
        this.quad([x1, y, z1], [x1, y, z0], [xm, y + h, z0], [xm, y + h, z1], col);
        this.tri([x1, y, z0], [x0, y, z0], [xm, y + h, z0], wall);
        this.tri([x0, y, z1], [x1, y, z1], [xm, y + h, z1], wall);
      }
    }
    pyr(x0, z0, x1, z1, y, h, col) {
      const a = [(x0 + x1) / 2, y + h, (z0 + z1) / 2];
      this.tri([x1, y, z0], [x0, y, z0], a, col);
      this.tri([x0, y, z1], [x1, y, z1], a, col);
      this.tri([x0, y, z0], [x0, y, z1], a, col);
      this.tri([x1, y, z1], [x1, y, z0], a, col);
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
    addThree(g, mx, col) {
      const ng = g.index ? g.toNonIndexed() : g;
      ng.applyMatrix4(mx);
      ng.computeVertexNormals();
      const p = ng.attributes.position.array, n = ng.attributes.normal.array;
      const cl = lc(col);
      for (let i = 0; i < p.length; i += 3) {
        this.p.push(p[i], p[i + 1], p[i + 2]); this.n.push(n[i], n[i + 1], n[i + 2]);
        this.c.push(cl[0], cl[1], cl[2]); this.u.push(0, 0); this.s.push(0);
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
  function foundation(gb, LW, LD, b, top) {
    const dy = Math.min(-0.6, b.minY - b.baseY - 0.6);
    gb.box(0.05, dy, 0.05, LW - 0.05, 0.08, LD - 0.05, '#8d8a82', 0, { top });
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
  GEN.rlow = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, U.pick(PAL.lawn, r));
    const lvl = b.level;
    const fl = (lvl >= 3 && r() < 0.65) || r() < 0.25 ? 2 : 1;
    const hw = 5.8 + r() * 1.6 + lvl * 0.2, hd = 6.4 + r() * 1.8 + lvl * 0.35;
    const x0 = (LW - hw) / 2 + (r() - 0.5) * 1.2, z0 = 3.2 + r() * 1.4;
    const H = fl * 3.0 + 0.3;
    const wall = U.pick(PAL.resWall, r), roof = U.pick(PAL.roof, r);
    gb.box(x0, 0, z0, x0 + hw, H, z0 + hd, wall, 1);
    const along = r() < 0.65;
    gb.gable(x0 - 0.35, z0 - 0.35, x0 + hw + 0.35, z0 + hd + 0.35, H, 1.9 + r() * 1.1, along, roof, wall);
    gb.box(x0 + hw / 2 - 0.55, 0, z0 - 0.1, x0 + hw / 2 + 0.55, 2.1, z0, '#5a3d2b');
    // porch roof
    if (r() < 0.5) gb.box(x0 + hw / 2 - 1.6, 2.6, z0 - 1.4, x0 + hw / 2 + 1.6, 2.8, z0, roof);
    // garage
    let gx = x0 + hw;
    if (lvl >= 2 && gx + 3.0 < LW - 0.2) {
      gb.box(gx, 0, z0 + 0.6, gx + 3.0, 2.8, z0 + 6.2, wall, 0, { top: roof });
      gb.box(gx + 0.3, 0, z0 + 0.5, gx + 2.7, 2.3, z0 + 0.6, '#d8d8d4');
      gb.flat(gx + 0.2, 0.1, gx + 2.8, z0 + 0.6, 0.1, '#9a9893');
    } else {
      gb.flat(x0 + hw / 2 - 0.6, 0.1, x0 + hw / 2 + 0.6, z0, 0.1, '#a9a49a');
    }
    if (r() < 0.45) gb.box(x0 + hw * 0.7, H, z0 + hd * 0.4, x0 + hw * 0.7 + 0.8, H + 2.6, z0 + hd * 0.4 + 0.8, '#7a5a4a');
    // backyard
    const by = z0 + hd + 1.5;
    if (lvl >= 2) {
      gb.box(0.2, 0, LD - 0.4, LW - 0.2, 1.1, LD - 0.25, '#b49a78');
      gb.box(0.2, 0, by, 0.35, 1.1, LD - 0.25, '#b49a78');
      gb.box(LW - 0.35, 0, by, LW - 0.2, 1.1, LD - 0.25, '#b49a78');
    }
    if (lvl >= 4 && r() < 0.55) gb.box(2, 0.0, by + 1.5, 6, 0.18, by + 4.5, '#1d6f8a', 13);
    else if (r() < 0.75) yardTree(gb, 2 + r() * 6, by + 2 + r() * (LD - by - 3.5), r);
    if (r() < 0.5) yardTree(gb, 1 + r() * 1.2, 1.5, r);
  };
  GEN.rmed = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, r() < 0.5 ? U.pick(PAL.lawn, r) : PAL.paved);
    const lvl = b.level;
    const wall = r() < 0.5 ? U.pick(PAL.brick, r) : U.pick(PAL.resWall, r);
    if (LW <= T + 0.1) {
      const rowhouse = lvl <= 2 && r() < 0.5;
      const floors = rowhouse ? 3 : 3 + Math.floor(lvl / 2) + (r() < 0.3 ? 1 : 0);
      const d = 10.5 + r() * 3.5, z0 = 1.6 + r() * 1.2;
      const H = floors * 3.1;
      gb.box(0.5, 0, z0, LW - 0.5, H, z0 + d, wall, 1);
      if (rowhouse) gb.gable(0.3, z0 - 0.3, LW - 0.3, z0 + d + 0.3, H, 2.6, true, U.pick(PAL.roof, r), wall);
      else {
        gb.box(0.4, H, z0 - 0.1, LW - 0.4, H + 0.6, z0 + d + 0.1, '#77736c');
        gb.box(3, H + 0.6, z0 + 3, 6, H + 2.2, z0 + 6, '#9a968e');
      }
      if (lvl >= 2) for (let f = 1; f < floors; f++) gb.box(1.5, f * 3.1 - 0.15, z0 - 1.0, LW - 1.5, f * 3.1 + 0.05, z0, '#c9c5bc');
      gb.box(LW / 2 - 0.7, 0, z0 - 0.1, LW / 2 + 0.7, 2.3, z0, '#3a2c22');
      if (r() < 0.6) yardTree(gb, 3 + r() * 4, z0 + d + 2.5, r);
    } else {
      const floors = 3 + lvl + (r() < 0.4 ? 1 : 0);
      const H = floors * 3.1;
      const z0 = 2.2 + r(), d = 13 + r() * 2.5;
      gb.box(1.2, 0, z0, LW - 1.2, 3.6, z0 + d, '#cfcac0', 3);
      gb.box(1.2, 3.6, z0, LW - 1.2, H, z0 + d, wall, 1, { vb: 0.5 });
      gb.box(1.0, H, z0 - 0.2, LW - 1.0, H + 0.7, z0 + d + 0.2, '#6f6b64');
      gb.box(LW / 2 - 3, H + 0.7, z0 + 4, LW / 2 + 3, H + 3, z0 + 8, '#8f8b84');
      if (lvl >= 3) for (let f = 2; f < floors; f++) {
        for (let k = 0; k < 3; k++) {
          const bx = 2.5 + k * 5.6;
          gb.box(bx, f * 3.1 - 0.15, z0 - 1.2, bx + 3.4, f * 3.1 + 0.05, z0, '#d6d2c8');
        }
      }
      if (r() < 0.7) yardTree(gb, 2.5, LD - 2.5, r);
      if (r() < 0.7) yardTree(gb, LW - 2.5, LD - 2.5, r);
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
  GEN.clow = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, PAL.paved);
    const lvl = b.level, acc = U.pick(PAL.accent, r);
    if (LW <= T + 0.1) {
      const up = Math.min(3, Math.floor((lvl - 1) / 2) + (r() < 0.4 ? 1 : 0));
      const d = 10 + r() * 4, z0 = 0.6;
      const wall = r() < 0.5 ? U.pick(PAL.brick, r) : U.pick(PAL.resWall, r);
      gb.box(0.3, 0, z0, LW - 0.3, 4.2, z0 + d, wall, 3);
      if (up) gb.box(0.3, 4.2, z0, LW - 0.3, 4.2 + up * 3.1, z0 + d, wall, 1, { vb: 1.2 });
      const top = 4.2 + up * 3.1;
      gb.box(0.2, top, z0 - 0.1, LW - 0.2, top + 0.7, z0 + d + 0.1, '#6c6862');
      gb.box(0.6, 3.0, z0 - 1.5, LW - 0.6, 3.2, z0, acc);
      gb.box(1.6, 3.4, z0 - 0.3, LW - 1.6, 4.1, z0 - 0.05, acc, 5);
      parkedCar(gb, 3, LD - 3, true, r);
      if (r() < 0.6) parkedCar(gb, 7, LD - 3, true, r);
    } else {
      const big = lvl >= 3 || r() < 0.4;
      const z0 = big ? 7.5 : 1.0, d = big ? 11.5 : 14;
      const wall = U.pick(PAL.conc, r);
      gb.box(1, 0, z0, LW - 1, 5.6, z0 + d, wall, 3);
      gb.box(0.8, 5.6, z0 - 0.1, LW - 0.8, 6.4, z0 + d + 0.1, acc);
      gb.box(LW / 2 - 5, 6.4, z0 - 0.3, LW / 2 + 5, 8.0, z0 + 0.2, acc, 5);
      if (big) for (let k = 0; k < 4; k++) parkedCar(gb, 3 + k * 4.6, 3.2, true, r);
      else { parkedCar(gb, 4, LD - 3, true, r); parkedCar(gb, 9, LD - 3, true, r); }
    }
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
    for (let k = 0; k < 3; k++) gb.box(x0 + 1 + k * 5, 0, z0 - 0.1, x0 + 4.4 + k * 5, 4.3, z0, '#c43a2a');
    gb.box(x0 + w - 3.5, 0, z0 + d - 3.5, x0 + w, 14, z0 + d, '#8a3326', 1);
    gb.pyr(x0 + w - 3.7, z0 + d - 3.7, x0 + w + 0.2, z0 + d + 0.2, 14, 2, '#3a3a3a');
    gb.box(x0 + 2, 5.2, z0 - 0.15, x0 + w - 2, 6.2, z0 - 0.02, '#f2d24a', 5);
  };
  SGEN.clinic = function (gb, b, r, LW, LD, big) {
    foundation(gb, LW, LD, b, PAL.paved);
    if (!big) {
      const x0 = 3, z0 = 3, w = 14, d = 11;
      gb.box(x0, 0, z0, x0 + w, 7, z0 + d, '#eceae4', 1);
      gb.box(x0 - 0.2, 7, z0 - 0.2, x0 + w + 0.2, 7.6, z0 + d + 0.2, '#6c7a86');
      gb.box(LW / 2 - 3, 3, z0 - 2.2, LW / 2 + 3, 3.3, z0, '#d8d8d8');
      cross(gb, x0 + w - 2.5, 5.2, z0, 1);
      gb.box(LW / 2 - 1, 0, z0 - 0.1, LW / 2 + 1, 2.5, z0, '#9fc5d8', 9);
    } else {
      const x0 = 3, z0 = 3;
      gb.box(x0, 0, z0, LW - 3, 4.2, LD - 6, '#e6e4de', 3);
      gb.box(x0 + 2, 4.2, z0 + 2, LW - 5, 20, z0 + 12, '#f0eee8', 1, { vb: 0.4 });
      gb.box(LW - 13, 4.2, z0 + 12, LW - 5, 12, LD - 7, '#e1dfd8', 1, { vb: 0.4 });
      gb.box(x0 + 1.8, 20, z0 + 1.8, LW - 4.8, 20.8, z0 + 12.2, '#6c7a86');
      gb.cyl(x0 + 10, 20.8, z0 + 7, 4, 0.3, 12, '#505860', 0, '#3e454c');
      cross(gb, LW / 2, 16, z0 + 2, 1.6);
      gb.box(LW / 2 - 4, 3.2, z0 - 3, LW / 2 + 4, 3.5, z0, '#d8d8d8');
    }
  };
  SGEN.hospital = (gb, b, r, LW, LD) => SGEN.clinic(gb, b, r, LW, LD, true);
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
  SGEN.garbage = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, PAL.conc2);
    gb.box(2, 0, 5, 20, 9, 17, '#6f8a6a', 4, { top: '#585f5c' });
    for (let k = 0; k < 3; k++) gb.box(3 + k * 5.5, 0, 4.9, 7 + k * 5.5, 5, 5, '#33383a');
    gb.pyr(22, 6, 28, 12, 0, 3.5, '#6b5b47');
    gb.pyr(22.5, 12.5, 27.5, 17.5, 0, 2.8, '#5f6158');
    gb.box(22, 0, 1.5, 28, 2.6, 4, '#2d7a4a');
    gb.box(2, 0, 1.2, 8.5, 2.8, 3.6, '#e6e6e6'); gb.box(8.5, 0, 1.2, 10.5, 2.3, 3.6, '#2f7a3b');
  };
  SGEN.park = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, '#5f9a40');
    gb.quad([0.5, 0.1, 9.5], [1.8, 0.1, 9.5], [9.5, 0.1, 1.8], [9.5, 0.1, 0.5], '#cdbf9a');
    yardTree(gb, 2.5, 3, r); yardTree(gb, 7.2, 7.4, r); if (r() < 0.6) yardTree(gb, 2.6, 7.6, r);
    gb.box(5.6, 0, 2.2, 7.4, 0.5, 2.7, '#7a5a3c');
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
  SGEN.arch = function (gb, b, r, LW, LD) {
    foundation(gb, LW, LD, b, '#d3cab8');
    const st = '#ece6d8';
    gb.box(4, 0, 11, 9, 36, 19, st);
    gb.box(21, 0, 11, 26, 36, 19, st);
    gb.box(3, 36, 10, 27, 44, 20, st);
    gb.box(2.5, 44, 9.5, 27.5, 45, 20.5, '#cbc3b2');
    gb.box(9, 30, 10.9, 21, 32, 11, '#d9b86a', 5);
    gb.flat(13, 0.5, 17, 29.5, 0.11, '#b9b09c');
  };

  M.genBuilding = function (gb, b) {
    const r = U.rng(b.seed + b.level * 977);
    lotFrame(gb, b);
    gb.tint = b.state === 'aband' ? 0.55 : null;
    gb.noLit = b.state === 'aband';
    const LW = b.w * T, LD = b.d * T;
    if (b.kind === 'zone') GEN[C.ZONES[b.zone].key](gb, b, r, LW, LD);
    else SGEN[b.svc](gb, b, r, LW, LD);
    gb.tint = null; gb.noLit = false;
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
    barrier: '#b9b6ad', deck: '#a9a69e', ballast: '#5a5650', rail: '#9095a0', sleeper: '#6a5f55',
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
      flatQ(x0, z0, x1, z1, top, col);
      const sc = sideCol || COL.curb, lo = -0.4;
      gb.quad(P(x1, lo, z0), P(x0, lo, z0), P(x0, top, z0), P(x1, top, z0), sc);
      gb.quad(P(x0, lo, z1), P(x1, lo, z1), P(x1, top, z1), P(x0, top, z1), sc);
      gb.quad(P(x0, lo, z0), P(x0, lo, z1), P(x0, top, z1), P(x0, top, z0), sc);
      gb.quad(P(x1, lo, z1), P(x1, lo, z0), P(x1, top, z0), P(x1, top, z1), sc);
    };
    const h = U.hash(x, y, 3) * 0.04 - 0.02;
    const asph = rt === 3 ? COL.asphHw : COL.asph;
    const ac = lc(asph); const asphC = [ac[0] + h * ac[0], ac[1] + h * ac[1], ac[2] + h * ac[2]].map(v => Math.pow(Math.max(0, v), 1 / 2.2));
    flatQ(0, 0, T, T, 0.16, asphC);
    const sw = R.sidewalk;
    const con = d => (m & (1 << d)) !== 0;
    if (sw > 0) {
      if (!con(0)) slab(0, 0, T, sw, 0.32, COL.walk);
      if (!con(1)) slab(T - sw, 0, T, T, 0.32, COL.walk);
      if (!con(2)) slab(0, T - sw, T, T, 0.32, COL.walk);
      if (!con(3)) slab(0, 0, sw, T, 0.32, COL.walk);
      if (con(0) && con(1)) slab(T - sw, 0, T, sw, 0.32, COL.walk);
      if (con(1) && con(2)) slab(T - sw, T - sw, T, T, 0.32, COL.walk);
      if (con(2) && con(3)) slab(0, T - sw, sw, T, 0.32, COL.walk);
      if (con(3) && con(0)) slab(0, 0, sw, sw, 0.32, COL.walk);
    } else {
      // highway guard rails
      if (!con(0)) slab(0, 0.1, T, 0.35, 0.9, COL.barrier);
      if (!con(1)) slab(T - 0.35, 0, T - 0.1, T, 0.9, COL.barrier);
      if (!con(2)) slab(0, T - 0.35, T, T - 0.1, 0.9, COL.barrier);
      if (!con(3)) slab(0.1, 0, 0.35, T, 0.9, COL.barrier);
    }
    const ns = con(0) && con(2) && !con(1) && !con(3);
    const ew = con(1) && con(3) && !con(0) && !con(2);
    const mk = 0.19;
    const line = (x0, z0, x1, z1, col) => flatQ(x0, z0, x1, z1, mk, col);
    if (ns || ew) {
      const L = (a0, b0, a1, b1, col) => ns ? line(a0, b0, a1, b1, col) : line(b0, a0, b1, a1, col);
      const c = T / 2;
      if (rt === 1) { L(c - 0.08, 0.6, c + 0.08, 4.0, COL.white); L(c - 0.08, 5.6, c + 0.08, 9.0, COL.white); }
      else if (rt === 2) {
        L(c - 0.26, 0, c - 0.1, T, COL.yellow); L(c + 0.1, 0, c + 0.26, T, COL.yellow);
        for (const o of [-2.05, 2.05]) { L(c + o - 0.07, 0.8, c + o + 0.07, 3.8, COL.white); L(c + o - 0.07, 5.8, c + o + 0.07, 8.8, COL.white); }
      } else {
        if (ns) slab(c - 0.25, 0, c + 0.25, T, 0.95, COL.barrier); else slab(0, c - 0.25, T, c + 0.25, 0.95, COL.barrier);
        for (const o of [-2.5, 2.5]) { L(c + o - 0.07, 0.8, c + o + 0.07, 4.2, COL.white); L(c + o - 0.07, 5.8, c + o + 0.07, 9.2, COL.white); }
        for (const o of [-4.6, 4.6]) L(c + o - 0.08, 0, c + o + 0.08, T, COL.white);
      }
    }
    let deg = 0; for (let d = 0; d < 4; d++) if (con(d)) deg++;
    if (deg >= 3 && rt !== 3) {
      for (let d = 0; d < 4; d++) {
        if (!con(d)) continue;
        for (let s = sw + 0.3; s < T - sw - 0.4; s += 1.0) {
          if (d === 0) line(s, 0.35, s + 0.5, 2.0, COL.white);
          else if (d === 2) line(s, T - 2.0, s + 0.5, T - 0.35, COL.white);
          else if (d === 1) line(T - 2.0, s, T - 0.35, s + 0.5, COL.white);
          else line(0.35, s, 2.0, s + 0.5, COL.white);
        }
      }
    }
    if (bridge) {
      const y0 = Wd.BRIDGE_H;
      gb.box(X0, y0 - 1.3, Z0, X0 + T, y0 + 0.1, Z0 + T, COL.deck, 0, { skip: 16, bottom: true });
      const g = Math.min(Wd.groundH(X0 + 5, Z0 + 5), -0.5);
      if ((x + y) % 2 === 0) gb.box(X0 + 4.1, g - 1, Z0 + 4.1, X0 + 5.9, y0 - 1.3, Z0 + 5.9, COL.deck);
    }
  }

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
      const sw = Wd.road[i] ? C.ROADS[Wd.road[i]].sidewalk : 1.8;
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
    initTrees(); initLamps(); initVehicles(); initGhosts(); initIcons();
    M.lineGroup = new THREE.Group(); G.scene.add(M.lineGroup);
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
  M.rebuildAll = function () {
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
      if (!t || Wd.bld[i] || Wd.road[i] || Wd.rail[i] === 1) continue;
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
      if (rt === 3) continue;
      const m = Wd.roadMask(i);
      let side = -1;
      const pref = (x + y) % 4 === 0 ? [0, 1, 2, 3] : [2, 3, 0, 1];
      for (const d of pref) if (!(m & (1 << d))) { side = d; break; }
      if (side < 0) continue;
      const sw = C.ROADS[rt].sidewalk;
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
  M.VEH_KINDS = ['car', 'suv', 'van', 'truck', 'bus', 'police', 'ambulance', 'fire', 'garbage', 'train'];
  function initVehicles() {
    const G = CB.Gfx;
    M.veh = {};
    const cars = G.settings.cars;
    const caps = { car: cars, suv: Math.ceil(cars * 0.6), van: 80, truck: Math.ceil(cars * 0.5), bus: 200, police: 80, ambulance: 60, fire: 60, garbage: 120, train: 600 };
    for (const k of M.VEH_KINDS) {
      const g = vehGeom(k);
      const mesh = new THREE.InstancedMesh(g, G.mats.city, caps[k]);
      mesh.frustumCulled = false;
      mesh.castShadow = G.settings.shadows >= 2048;
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
  M.beginVehicles = function () { for (const k of M.VEH_KINDS) M.veh[k].n = 0; };
  M.pushVehicle = function (kind, x, y, z, dx, dz, col, pitch) {
    const v = M.veh[kind]; if (v.n >= v.cap) return false;
    const j = v.n++;
    const a = v.mesh.instanceMatrix.array, e = j * 16;
    const p = pitch || 0, cp = Math.cos(p), sp = Math.sin(p);
    // forward (dx, sp, dz) with pitch, up approx
    a[e] = dx * cp; a[e + 1] = sp; a[e + 2] = dz * cp; a[e + 3] = 0;
    a[e + 4] = -dx * sp; a[e + 5] = cp; a[e + 6] = -dz * sp; a[e + 7] = 0;
    a[e + 8] = -dz; a[e + 9] = 0; a[e + 10] = dx; a[e + 11] = 0;
    a[e + 12] = x; a[e + 13] = y; a[e + 14] = z; a[e + 15] = 1;
    const c = v.mesh.instanceColor.array;
    if (col) { c[j * 3] = col[0]; c[j * 3 + 1] = col[1]; c[j * 3 + 2] = col[2]; }
    else { c[j * 3] = 1; c[j * 3 + 1] = 1; c[j * 3 + 2] = 1; }
    return true;
  };
  M.endVehicles = function () {
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
      const t = list[j], x = (U.tx(t.i) + 0.5) * T, z = (U.ty(t.i) + 0.5) * T;
      const y = (t.y !== undefined ? t.y : Math.max(Wd.groundH(x, z), C.WATER)) + 0.05;
      const e = j * 16, hs = t.h || 1;
      a.set([1, 0, 0, 0, 0, hs, 0, 0, 0, 0, 1, 0, x, y, z, 1], e);
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
