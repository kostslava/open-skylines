'use strict';
// Open Skylines — input handling and build tools
(function () {
  const { C, U } = CB;
  const T = C.TILE;
  const Tl = CB.Tools = { tool: { type: 'select' }, hover: null, drag: null, rot: 0, lineStops: [], tip: '' };

  Tl.setTool = function (t) {
    Tl.tool = t || { type: 'select' };
    Tl.drag = null;
    Tl.lineStops = [];
    Tl.curve = null;
    clearPreview();
    const isZone = Tl.tool.type === 'zone' || Tl.tool.type === 'dezone';
    CB.Gfx.uni.uGrid.value = isZone ? 1 : 0;
    CB.Meshes.updateZoneTex(isZone);
    Tl.zoneView = isZone;
    const transitTool = Tl.tool.type === 'line' || Tl.tool.type === 'stop' || Tl.tool.type === 'rail' || Tl.tool.type === 'lineEdit';
    CB.Transit.showRibbons(transitTool || CB.UI.overlay === 'transit', Tl.tool.type === 'lineEdit' ? CB.Transit.lineById(Tl.tool.line) : null);
    if (Tl.tool.type === 'svc') Tl.rot = 0;
    if (Tl.tool.type === 'move') { const mb = CB.Sim.buildings.get(Tl.tool.id); Tl.rot = mb && mb.dir !== undefined ? mb.dir : 0; }
    CB.UI.onToolChange();
  };
  Tl.setRoadMode = function (m) { Tl.roadMode = m; Tl.curve = null; Tl.drag = null; Tl.needHover = true; if (CB.UI.onRoadMode) CB.UI.onRoadMode(); };
  function junctionNear(i) {
    const Wd = CB.World;
    if (Wd.jcl[i] >= 0) return Wd.clusters[Wd.jcl[i]];
    for (let d = 0; d < 4; d++) { const j = Wd.neighbor(i, d); if (j >= 0 && Wd.jcl[j] >= 0) return Wd.clusters[Wd.jcl[j]]; }
    return null;
  }
  function clearPreview() {
    const Mx = CB.Meshes;
    Mx.setFlowArrows(null); Mx.setGuide(null);
    Mx.setGhostTiles([]); Mx.setGhostBox(null); Mx.setRing(null); Mx.setGhostModel(null); prevKey = '';
    CB.Gfx.uni.uBrushOn.value = 0;
    if (Tl.previewRibbon) { Mx.lineGroup.remove(Tl.previewRibbon); Tl.previewRibbon.geometry.dispose(); Tl.previewRibbon = null; }
    Tl.tip = '';
  }

  function spend(cost) {
    const S = CB.Sim;
    if (S.money < cost) { CB.UI.toast('Not enough money. You need ' + U.money(cost) + '.', 'bad'); return false; }
    S.money -= cost; return true;
  }

  // ---------------- path helpers ----------------
  function lPath(a, b, hf) {
    const ax = U.tx(a), ay = U.ty(a), bx = U.tx(b), by = U.ty(b);
    const out = [];
    const horizFirst = hf !== undefined ? hf : Math.abs(bx - ax) >= Math.abs(by - ay);
    let x = ax, y = ay;
    out.push(U.idx(x, y));
    const sx = Math.sign(bx - ax), sy = Math.sign(by - ay);
    if (horizFirst) { while (x !== bx) { x += sx; out.push(U.idx(x, y)); } while (y !== by) { y += sy; out.push(U.idx(x, y)); } }
    else { while (y !== by) { y += sy; out.push(U.idx(x, y)); } while (x !== bx) { x += sx; out.push(U.idx(x, y)); } }
    return out;
  }
  const dirOf = (a, b) => { const dx = U.tx(b) - U.tx(a), dy = U.ty(b) - U.ty(a); return dy < 0 ? 0 : dx > 0 ? 1 : dy > 0 ? 2 : 3; };
  const step = (i, d) => U.idx(U.tx(i) + C.DX[d], U.ty(i) + C.DY[d]);
  // ---------------- road planning ----------------
  // Single-strip roads snap to tile centres. Dual carriageways snap to grid corners: the drag line is the
  // median, with one one-way strip on each side (traffic keeps right). Drags are L-shaped, or quadratic
  // curves in curve mode (click start, click a bend point, click the end).
  Tl.roadMode = 'straight';
  Tl.curve = null;
  const isDual = rt => C.ROADS[rt].w === 2;
  const snapWorld = (p, rt) => { const s = snapPt(p, isDual(rt)); return { x: s.x * T, z: s.y * T }; };
  function snapPt(p, dual) {
    if (dual) return { x: Math.round(p.x / T), y: Math.round(p.z / T) };
    return { x: Math.floor(p.x / T) + 0.5, y: Math.floor(p.z / T) + 0.5 };
  }
  function cutLoops(pts) {
    const out = [], seenAt = new Map();
    for (const p of pts) {
      const k = p[0] * 4096 + p[1];
      if (seenAt.has(k)) { const j = seenAt.get(k); for (let q = j + 1; q < out.length; q++) seenAt.delete(out[q][0] * 4096 + out[q][1]); out.length = j + 1; continue; }
      seenAt.set(k, out.length); out.push(p);
    }
    return out;
  }
  // 4-connected lattice walk (off = 0.5: tile centres, 0: grid corners)
  function latticeL(A, B, off) {
    const ax = Math.round(A.x - off), ay = Math.round(A.y - off), bx = Math.round(B.x - off), by = Math.round(B.y - off);
    const out = [[ax, ay]], hf = Math.abs(bx - ax) >= Math.abs(by - ay);
    let x = ax, y = ay; const sx = Math.sign(bx - ax), sy = Math.sign(by - ay);
    if (hf) { while (x !== bx) { x += sx; out.push([x, y]); } while (y !== by) { y += sy; out.push([x, y]); } }
    else { while (y !== by) { y += sy; out.push([x, y]); } while (x !== bx) { x += sx; out.push([x, y]); } }
    return out;
  }
  // Follow a quadratic curve with octilinear moves only (straight runs and clean 45 degree staircases):
  // the renderer smooths those into an even curve, where arbitrary slopes would come out wavy.
  // sampled quadratic curve, optionally offset sideways by s tiles (+ = right of travel)
  function sampleCurve(A, Cp, B, s) {
    const n = 400, cv = [];
    for (let k = 0; k <= n; k++) {
      const t = k / n, u = 1 - t;
      let x = u * u * A.x + 2 * u * t * Cp.x + t * t * B.x, y = u * u * A.y + 2 * u * t * Cp.y + t * t * B.y;
      if (s) {
        let tx = 2 * u * (Cp.x - A.x) + 2 * t * (B.x - Cp.x), ty = 2 * u * (Cp.y - A.y) + 2 * t * (B.y - Cp.y);
        if (Math.abs(tx) + Math.abs(ty) < 1e-6) { tx = B.x - A.x; ty = B.y - A.y; }
        const l = Math.hypot(tx, ty) || 1, k = (Math.abs(tx) + Math.abs(ty)) / l; // wider on diagonals so the two staircases never touch
        x += -ty / l * s * k; y += tx / l * s * k;
      }
      cv.push([x, y]);
    }
    if (s) { // first and last tile centres sit half a tile inside the end points
      const cum = [0];
      for (let k = 1; k <= n; k++) cum.push(cum[k - 1] + Math.hypot(cv[k][0] - cv[k - 1][0], cv[k][1] - cv[k - 1][1]));
      let a = 0, b = n;
      while (a < n && cum[a] < 0.5) a++;
      while (b > a && cum[n] - cum[b] < 0.5) b--;
      return cv.slice(a, b + 1);
    }
    return cv;
  }
  function latticeCurve(A, Cp, B, off) { return latticeFollow(sampleCurve(A, Cp, B, 0), off); }
  function latticeFollow(cv, off) {
    const n = cv.length - 1, B = { x: cv[n][0], y: cv[n][1] }, A = { x: cv[0][0], y: cv[0][1] };
    const end = [Math.round(B.x - off), Math.round(B.y - off)];
    let p = [Math.round(A.x - off), Math.round(A.y - off)];
    const out = [p.slice()];
    let k = 0, lastX = null;
    const D = (q, x, y) => Math.hypot(q[0] - x, q[1] - y);
    for (let guard = 0; guard < 3000; guard++) {
      if (p[0] === end[0] && p[1] === end[1]) break;
      const px = p[0] + off, py = p[1] + off;
      while (k < n && D(cv[k + 1], px, py) <= D(cv[k], px, py) + 1e-9) k++;
      let j = k; while (j < n && D(cv[j], px, py) < 2.5) j++;
      let dx, dy;
      if (Math.abs(end[0] - p[0]) + Math.abs(end[1] - p[1]) <= 3 || j >= n) { dx = end[0] - p[0]; dy = end[1] - p[1]; }
      else { dx = cv[j][0] - px; dy = cv[j][1] - py; }
      const oct = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
      let sx = Math.round(Math.cos(oct * Math.PI / 4)), sy = Math.round(Math.sin(oct * Math.PI / 4));
      if (dx === 0 && dy === 0) break;
      let step;
      if (!sx || !sy) step = [sx, sy];
      else step = lastX ? [0, sy] : [sx, 0];
      if (Math.abs(end[0] - p[0]) + Math.abs(end[1] - p[1]) <= 3) { // never step away from the end
        if (step[0] && Math.sign(step[0]) !== Math.sign(end[0] - p[0])) step = [0, Math.sign(end[1] - p[1])];
        else if (step[1] && Math.sign(step[1]) !== Math.sign(end[1] - p[1])) step = [Math.sign(end[0] - p[0]), 0];
      }
      p = [p[0] + step[0], p[1] + step[1]]; lastX = step[0] !== 0;
      out.push(p.slice());
    }
    return cutLoops(out);
  }
  // tiles beside a corner-lattice polyline: s = +1 right-hand side, -1 left-hand side
  function offsetStrip(V, s) {
    const n = V.length, D = [];
    for (let k = 0; k < n - 1; k++) D.push([V[k + 1][0] - V[k][0], V[k + 1][1] - V[k][1]]);
    const rt = d => [-d[1], d[0]];
    const O = [];
    for (let k = 0; k < n; k++) {
      const a = D[Math.max(0, k - 1)], b = D[Math.min(n - 2, k)];
      let o;
      if (k === 0) o = rt(b); else if (k === n - 1) o = rt(a);
      else if (a[0] === b[0] && a[1] === b[1]) o = rt(a);
      else { const ra = rt(a), rb = rt(b); o = [ra[0] + rb[0], ra[1] + rb[1]]; }
      O.push([V[k][0] + s * 0.5 * o[0], V[k][1] + s * 0.5 * o[1]]);
    }
    const tiles = [];
    for (let k = 0; k < n - 1; k++) {
      const [ax, ay] = O[k], [bx, by] = O[k + 1], m = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay) * 8));
      for (let q = 0; q < m; q++) {
        const t = (q + 0.5) / m, x = Math.floor(ax + (bx - ax) * t), y = Math.floor(ay + (by - ay) * t);
        const l = tiles[tiles.length - 1];
        if (!l || l[0] !== x || l[1] !== y) tiles.push([x, y]);
      }
    }
    return cutLoops(tiles);
  }
  function toStrip(pts) {
    const tiles = [];
    for (const [x, y] of pts) { if (!U.inWorld(x, y)) return null; tiles.push(U.idx(x, y)); }
    for (let k = 1; k < tiles.length; k++) if (U.dist(tiles[k - 1], tiles[k]) !== 1) return null;
    const dirs = tiles.map((t, k) => k + 1 < tiles.length ? dirOf(t, tiles[k + 1]) : (k > 0 ? dirOf(tiles[k - 1], t) : 1));
    return { tiles, dirs };
  }
  // plan from world points a -> b (optionally bending through c). Returns { strips, bad }
  function planRoad(rt, a, b, c) {
    const dual = isDual(rt), off = dual ? 0 : 0.5;
    const A = snapPt(a, dual), B = snapPt(b, dual);
    let V;
    if (c) V = latticeCurve(A, { x: c.x / T, y: c.z / T }, B, off);
    else V = latticeL(A, B, off);
    const curved = !!c && V.length > 2;
    if (!dual) { const st = toStrip(V); return st ? { strips: [st], curved } : { strips: [], bad: 'Outside the map' }; }
    if (V.length < 2) { // a single click: a short stub eastwards
      V = [V[0], [V[0][0] + 1, V[0][1]]];
    }
    let fp, rp;
    if (c && V.length > 2) { // curves: each carriageway follows its own offset of the curve
      const Cp = { x: c.x / T, y: c.z / T };
      for (const o of [0.5, 0.56, 0.62, 0.7]) { // widen the offset a little if the two staircases bump into each other
        fp = latticeFollow(sampleCurve(A, Cp, B, o), 0.5);
        rp = latticeFollow(sampleCurve(A, Cp, B, -o), 0.5).reverse();
        const fs = new Set(fp.map(q => q[0] * 4096 + q[1]));
        if (!rp.some(q => fs.has(q[0] * 4096 + q[1]))) break;
      }
    } else { fp = offsetStrip(V, 1); rp = offsetStrip(V, -1).reverse(); }
    const f = toStrip(fp), r = toStrip(rp);
    if (!f || !r) return { strips: [], bad: 'Outside the map' };
    const used = new Set(f.tiles);
    if (r.tiles.some(t => used.has(t))) return { strips: [f, r], bad: 'Curve is too tight for a dual road' };
    return { strips: [f, r], curved };
  }
  // straight drag between two tiles (used by the demo city and tests)
  function roadStrips(a, b, rt) {
    const P = i => isDual(rt) ? { x: U.tx(i) * T, z: U.ty(i) * T } : { x: (U.tx(i) + 0.5) * T, z: (U.ty(i) + 0.5) * T };
    return planRoad(rt, P(a), P(b)).strips;
  }
  Tl.roadStrips = roadStrips;
  // ---- half-tile paths ----
  const FW = C.FW;
  const fcellAt = h => U.clamp(Math.floor(h.z / (T / 2)), 0, FW - 1) * FW + U.clamp(Math.floor(h.x / (T / 2)), 0, FW - 1);
  function lPathF(a, b) {
    const ax = a % FW, ay = (a / FW) | 0, bx = b % FW, by = (b / FW) | 0, out = [];
    const hf = Math.abs(bx - ax) >= Math.abs(by - ay);
    let x = ax, y = ay; out.push(y * FW + x);
    const sx = Math.sign(bx - ax), sy = Math.sign(by - ay);
    if (hf) { while (x !== bx) { x += sx; out.push(y * FW + x); } while (y !== by) { y += sy; out.push(y * FW + x); } }
    else { while (y !== by) { y += sy; out.push(y * FW + x); } while (x !== bx) { x += sx; out.push(y * FW + x); } }
    return out;
  }
  function pathEval(cells, pk) {
    const Wd = CB.World, P = C.PATHS[pk];
    let cost = 0, bad = null;
    const list = cells.map(f => {
      const i = U.idx((f % FW) >> 1, ((f / FW) | 0) >> 1);
      let ok = true, col = null;
      if (!U.inPlay(U.tx(i), U.ty(i))) { ok = false; bad = 'Outside the city limits'; }
      else if (Wd.road[i]) { ok = false; bad = 'Paths go beside roads, not on them'; }
      else if (Wd.bld[i]) { ok = false; bad = 'A building is in the way'; }
      else if (Wd.isWater(i) || Wd.slope(i) > 6) { ok = false; bad = 'Too steep or wet here'; }
      else if (Wd.rail[i] === 1) { ok = false; bad = 'Elevated track is in the way'; }
      else if (Wd.pcell[f] === pk) col = [0.5, 0.7, 1];
      else cost += P.cost;
      return { f, ok, col, h: 0.3 };
    });
    return { list, cost, bad };
  }
  function roadEval(strips, rt) {
    const Wd = CB.World, R = C.ROADS[rt];
    let cost = 0, bad = null;
    const list = [];
    for (const st of strips) for (const i of st.tiles) {
      let ok = true, col = null, c = 0;
      if (!Wd.roadOK(i)) { ok = false; bad = U.inPlay(U.tx(i), U.ty(i)) ? 'Too steep here' : 'Outside the city limits'; }
      else if (Wd.bld[i]) { ok = false; bad = 'A building is in the way'; }
      else if (Wd.road[i] === rt) { col = [0.5, 0.7, 1.0]; }
      else if (Wd.road[i]) { c = Math.max(0, R.cost / R.w - C.ROADS[Wd.road[i]].cost / C.ROADS[Wd.road[i]].w) + 5; col = [1, 0.85, 0.3]; }
      else c = R.cost / R.w * (Wd.isWater(i) ? 3 : 1);
      cost += c;
      const y = Wd.isWater(i) ? Wd.BRIDGE_H : undefined;
      list.push({ i, ok, col, y, h: 0.4 });
    }
    return { list, cost, bad };
  }
  function placeRoad(strips, rt, curved) {
    const Wd = CB.World, S = CB.Sim, R = C.ROADS[rt];
    let changed = false;
    for (const st of strips) {
      const T2 = st.tiles;
      for (let k = 0; k < T2.length; k++) {
        const i = T2[k], d = st.dirs[k];
        const axisLinked = Wd.linked(i, d) || Wd.linked(i, (d + 2) % 4);
        const perpLinked = Wd.linked(i, (d + 1) % 4) || Wd.linked(i, (d + 3) % 4);
        const crossing = Wd.road[i] && perpLinked && !axisLinked;
        if (!crossing || C.GRP_RANK[R.grp] > C.GRP_RANK[C.ROADS[Wd.road[i]].grp]) {
          if (Wd.road[i] !== rt || Wd.rdir[i] !== d) changed = true;
          S.setRoad(i, rt);
          if (!crossing) { Wd.rdir[i] = d; Wd.rpart[i] = R.w === 2 ? ((d + 3) % 4) + 1 : 0; Wd.curv[i] = curved ? 1 : 0; }
        }
        if (k > 0 && !Wd.linked(T2[k - 1], dirOf(T2[k - 1], i))) { Wd.linkTiles(T2[k - 1], i); changed = true; }
      }
    }
    // snap: a road that starts or ends right next to another road joins it (straight on or as a T)
    for (const st of strips) {
      const A = st.tiles, n = A.length;
      const ends = [[A[0], (st.dirs[0] + 2) % 4], [A[n - 1], st.dirs[n - 1]]];
      for (const [t, d] of ends) {
        const o = Wd.neighbor(t, d);
        if (o < 0 || !Wd.road[o] || Wd.linked(t, d)) continue;
        if (strips.length === 2 && strips.some(q => q.tiles.includes(o))) continue; // own partner strip
        Wd.linkTiles(t, o); changed = true;
      }
    }
    // a U-turn link across a median is only for dead ends: drop it once the road continues
    const touched = new Set();
    for (const st of strips) for (const t of st.tiles) { touched.add(t); for (let d = 0; d < 4; d++) { const o = Wd.neighbor(t, d); if (o >= 0) touched.add(o); } }
    for (const t of touched) for (let d = 0; d < 4; d++) {
      if (!Wd.linked(t, d) || !Wd.isUturnLink(t, d)) continue;
      const o = Wd.neighbor(t, d);
      if (Wd.degree(t) > 2 || Wd.degree(o) > 2) { Wd.unlinkTiles(t, o); changed = true; }
    }
    // dual carriageway ends: let vehicles turn around at a dead end
    if (strips.length === 2) {
      const A = strips[0].tiles, B = strips[1].tiles;
      for (const [p, q] of [[A[0], B[B.length - 1]], [A[A.length - 1], B[0]]]) if (Wd.degree(p) <= 1 && Wd.degree(q) <= 1 && U.dist(p, q) === 1) Wd.linkTiles(p, q);
    }
    return changed;
  }
  function buildRoad(plan, rt) {
    const S = CB.Sim;
    clearPreview();
    if (plan.bad) { CB.UI.toast(plan.bad, 'bad'); return false; }
    const ev = roadEval(plan.strips, rt);
    if (ev.bad) { CB.UI.toast(ev.bad, 'bad'); return false; }
    if (!spend(ev.cost)) return false;
    if (placeRoad(plan.strips, rt, plan.curved)) { S.networkChanged(); markAround(plan.strips.flatMap(q => q.tiles)); CB.UI.sfx('build'); }
    return true;
  }
  // Road preview: the real road model for the planned tiles (built by applying the plan to a copy of the
  // network state for a moment), plus the tiles that would become zonable. Rebuilt only when the plan changes.
  let prevKey = '';
  function previewRoad(plan, rt, ev) {
    const Wd = CB.World, Mx = CB.Meshes, R = C.ROADS[rt];
    const tiles = plan.strips.flatMap(q => q.tiles);
    const bad = plan.bad || ev.bad;
    const key = rt + ':' + plan.curved + ':' + plan.strips.map(q => q.tiles.join(',')).join('|');
    if (key !== prevKey) {
      prevKey = key;
      // zoning that the new road would open up
      const z = [];
      if (R.zonable && !bad) {
        const seen = new Set(tiles), news = new Set(tiles.filter(i => !Wd.road[i]));
        for (const i of news) for (let d = 0; d < 4; d++) for (let k = 1; k <= 3; k++) {
          const x = U.tx(i) + C.DX[d] * k, y = U.ty(i) + C.DY[d] * k;
          if (!U.inPlay(x, y)) break;
          const j = U.idx(x, y);
          if (Wd.road[j] || seen.has(j) || Wd.pmask[j] || Wd.bld[j] || !Wd.buildable(j) || Wd.rail[j] === 1) break;
          seen.add(j); if (!Wd.zonable[j]) z.push({ i: j, ok: true, h: 0.06, col: [0.55, 0.95, 0.6] });
        }
      }
      Tl._zonePrev = z;
      Mx.setGhostModel(tiles.length ? 'road:' + key : null, gb => {
        const keys = ['road', 'link', 'rdir', 'rpart', 'curv'], save = new Map();
        const touch = new Set(); for (const i of tiles) { touch.add(i); for (let d = 0; d < 4; d++) { const j = Wd.neighbor(i, d); if (j >= 0) touch.add(j); } }
        for (const i of touch) save.set(i, keys.map(k => Wd[k][i]));
        for (const st of plan.strips) st.tiles.forEach((i, k) => {
          if (!Wd.road[i] || C.GRP_RANK[R.grp] > C.GRP_RANK[C.ROADS[Wd.road[i]].grp]) { Wd.road[i] = rt; Wd.rdir[i] = st.dirs[k]; Wd.rpart[i] = R.w === 2 ? ((st.dirs[k] + 3) % 4) + 1 : 0; Wd.curv[i] = plan.curved ? 1 : 0; }
          if (k > 0) Wd.linkTiles(st.tiles[k - 1], i);
        });
        Wd.clearEdgeCache();
        try {
          for (const i of tiles) {
            const was = save.get(i)[0];
            gb.tintCol = !was ? [0.5, 0.82, 1.0, 0.45] : was !== rt ? [1.0, 0.68, 0.18, 0.55] : [0.6, 0.9, 1.0, 0.25];
            Mx.genRoadTile(gb, i);
          }
        }
        finally { gb.tintCol = null; for (const [i, v] of save) keys.forEach((k, n) => { Wd[k][i] = v[n]; }); Wd.clearEdgeCache(); }
      }, 0, 0.12, 0, !bad);
    }
    Mx.setGhostModel(tiles.length ? 'road:' + key : null, null, 0, 0.12, 0, !bad);
    Mx.setGhostTiles([...ev.list.filter(g => !g.ok).map(g => Object.assign(g, { h: 0.5 })), ...(Tl._zonePrev || [])]);
  }
  // curves are smoothed over a few tiles, so redraw a little further out than the tiles that changed
  function markAround(tiles) {
    const Mx = CB.Meshes;
    for (const t of tiles) for (const [ox, oy] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) { const x = U.tx(t) + ox, y = U.ty(t) + oy; if (U.inWorld(x, y)) Mx.markInfra(U.idx(x, y)); }
  }
  function railEval(tiles, rr) {
    const Wd = CB.World, R = C.RAIL[rr];
    let cost = 0, bad = null;
    const list = tiles.map(i => {
      let ok = true, col = null, c = 0;
      const x = U.tx(i), y = U.ty(i);
      if (!U.inPlay(x, y)) { ok = false; bad = 'Outside the city limits'; }
      else if (rr === 1 && Wd.bld[i]) { ok = false; bad = 'A building is in the way. Use a subway tunnel to go under it.'; }
      else if (Wd.rail[i] === rr) col = [0.5, 0.7, 1.0];
      else c = R.cost * (rr === 1 && Wd.isWater(i) ? 1.5 : 1);
      cost += c;
      const yy = rr === 1 ? Wd.deckH((x + 0.5) * T, (y + 0.5) * T) - 1 : undefined;
      return { i, ok, col: col || (rr === 2 && ok ? [0.75, 0.55, 1] : null), y: yy, h: 0.5 };
    });
    return { list, cost, bad };
  }

  // Road drawing is click-based, like a pen tool. Every mode keeps drawing from the end of the last piece
  // until Esc / right-click.
  //   straight: click the start, click the end.
  //   curve:    click the start, click where it bends (a dotted guide shows the direction), click the end.
  //   sbend:    like curve for the first piece; after that each piece leaves in the direction the last one
  //             ended, so one click per piece gives smooth S-bends and sweeping curves.
  function autoBend(a, tan, b) {
    const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz);
    if (L < 1) return null;
    const dp = dx * tan[0] + dz * tan[1];
    const k = L * L / (2 * Math.max(dp, 0.34 * L)); // tangent intersection of a circular arc, capped near 90 degrees
    return { x: a.x + tan[0] * k, z: a.z + tan[1] * k };
  }
  // the bend point for the piece ending at p, or undefined for a straight piece / null while choosing it
  function bendFor(p) {
    const cu = Tl.curve; if (!cu) return undefined;
    if (Tl.roadMode === 'straight' || Tl.roadMode === 'grid') return undefined;
    if (cu.c) return cu.c;
    if (Tl.roadMode === 'sbend' && cu.tan) return autoBend(cu.a, cu.tan, p);
    return null;
  }
  // Grid mode: two clicks span a rectangle that is filled with a street grid. Blocks are six tiles deep
  // between roads, so every tile can be zoned from one side or the other.
  function gridPlans(rt, a, b) {
    const dual = isDual(rt), A = snapPt(a, dual), B = snapPt(b, dual), S = dual ? 8 : 7;
    const x0 = Math.min(A.x, B.x), x1 = Math.max(A.x, B.x), y0 = Math.min(A.y, B.y), y1 = Math.max(A.y, B.y);
    const steps = (lo, hi) => { const out = []; for (let v = lo; v <= hi - 3; v += S) out.push(v); if (!out.length || hi - out[out.length - 1] >= 3) out.push(hi); else out[out.length - 1] = hi; return out; };
    const W2 = (x, y) => ({ x: x * T, z: y * T });
    if (x1 - x0 < 2 || y1 - y0 < 2) return [planRoad(rt, a, b)];
    const plans = [];
    for (const y of steps(y0, y1)) plans.push(planRoad(rt, W2(x0, y), W2(x1, y)));
    for (const x of steps(x0, x1)) plans.push(planRoad(rt, W2(x, y0), W2(x, y1)));
    return plans;
  }
  const mergePlans = plans => ({ strips: plans.flatMap(q => q.strips), bad: (plans.find(q => q.bad) || {}).bad });
  function buildGrid(plans, rt) {
    const S = CB.Sim;
    clearPreview();
    const all = mergePlans(plans);
    if (all.bad) { CB.UI.toast(all.bad, 'bad'); return false; }
    const ev = roadEval(all.strips, rt);
    if (ev.bad) { CB.UI.toast(ev.bad, 'bad'); return false; }
    if (!spend(ev.cost)) return false;
    let ch = false;
    for (const p of plans) if (placeRoad(p.strips, rt, false)) ch = true;
    if (ch) { S.networkChanged(); markAround(all.strips.flatMap(q => q.tiles)); CB.UI.sfx('build'); }
    return true;
  }
  function roadClick(h) {
    const t = Tl.tool;
    if (!h || h.i < 0 || mouse.moved) return;
    const p = { x: h.x, z: h.z };
    if (!Tl.curve) { Tl.curve = { a: p }; CB.UI.sfx('click'); return; }
    if (Tl.roadMode === 'grid') { if (buildGrid(gridPlans(t.rt, Tl.curve.a, p), t.rt)) Tl.curve = null; return; }
    const c = bendFor(p);
    if (c === null) { Tl.curve.c = p; CB.UI.sfx('click'); return; }
    const plan = planRoad(t.rt, Tl.curve.a, p, c || undefined);
    if (!buildRoad(plan, t.rt)) return;
    const nx = { a: p };
    if (c) { const dx = p.x - c.x, dz = p.z - c.z, l = Math.hypot(dx, dz); if (l > 0.5) nx.tan = [dx / l, dz / l]; }
    else { const a = Tl.curve.a, dx = p.x - a.x, dz = p.z - a.z, l = Math.hypot(dx, dz); if (l > 0.5) nx.tan = Math.abs(dx) >= Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz)]; }
    Tl.curve = nx;
  }
  Tl._roadClick = (x, z) => { const tx = Math.floor(x / T), tz = Math.floor(z / T); const m = mouse.moved; mouse.moved = false; roadClick({ i: U.idx(tx, tz), tx, ty: tz, x, z }); mouse.moved = m; };

  // ---------------- pointer handling ----------------
  let mouse = { x: 0, y: 0, down: false, btn: -1, sx: 0, sy: 0, moved: false };
  Tl.mouse = mouse;
  Tl.init = function (el) {
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('pointerdown', e => {
      if (e.target.closest && e.target.closest('.ui')) return;
      el.setPointerCapture(e.pointerId);
      mouse.down = true; mouse.btn = e.button; mouse.sx = mouse.x = e.clientX; mouse.sy = mouse.y = e.clientY; mouse.moved = false;
      mouse.touchPan = e.pointerType === 'touch' && Tl.tool.type === 'select';
      if (e.button === 0 && !mouse.touchPan) { Tl.hover = CB.Gfx.pick(mouse.x, mouse.y); onDown(); }
    });
    el.addEventListener('pointermove', e => {
      const dx = e.clientX - mouse.x, dy = e.clientY - mouse.y;
      mouse.x = e.clientX; mouse.y = e.clientY;
      if (Math.abs(mouse.x - mouse.sx) + Math.abs(mouse.y - mouse.sy) > 4) mouse.moved = true;
      const cam = CB.Gfx.cam;
      if (mouse.down && (mouse.btn === 2 || (mouse.btn === 0 && e.altKey))) {
        cam.yaw -= dx * 0.005; cam.pitch = U.clamp(cam.pitch + dy * 0.004, 0.12, 1.45);
      } else if (mouse.down && (mouse.btn === 1 || mouse.touchPan)) {
        const k = cam.dist * 0.0016;
        const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
        cam.tx += (-dx * rx + dy * fx) * k; cam.tz += (-dx * rz + dy * fz) * k;
      }
      Tl.needHover = true;
    });
    el.addEventListener('pointerup', e => {
      if (mouse.btn === 0 && !mouse.touchPan) { mouse.x = e.clientX; mouse.y = e.clientY; Tl.hover = CB.Gfx.pick(mouse.x, mouse.y); onUp(e); Tl.needHover = true; }
      if (mouse.btn === 2 && !mouse.moved) onRightClick();
      mouse.down = false; mouse.btn = -1;
    });
    el.addEventListener('wheel', e => {
      e.preventDefault();
      CB.Gfx.cam.tdist *= Math.exp(e.deltaY * 0.0011);
    }, { passive: false });
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', e => { CB.Gfx.cam.keys[keyName(e)] = false; });
    window.addEventListener('blur', () => { CB.Gfx.cam.keys = {}; });
  };
  function keyName(e) { return e.key.length === 1 ? e.key.toLowerCase() : e.key; }
  function onKey(e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) return;
    const k = keyName(e);
    const S = CB.Sim;
    if (k === 'r' && (Tl.tool.type === 'svc' || Tl.tool.type === 'move')) { Tl.rot = (Tl.rot + 1) % 4; Tl.needHover = true; return; }
    if (k === 'c' && Tl.tool.type === 'road') { Tl.setRoadMode(({ straight: 'curve', curve: 'sbend', sbend: 'grid', grid: 'straight' })[Tl.roadMode]); return; }
    CB.Gfx.cam.keys[k] = true;
    if (e.key === 'Shift') CB.Gfx.cam.keys.Shift = true;
    if (k === ' ') { e.preventDefault(); CB.UI.setSpeed(S.speed === 0 ? (CB.UI.lastSpeed || 1) : 0); }
    else if (k === '1') CB.UI.setSpeed(1);
    else if (k === '2') CB.UI.setSpeed(2);
    else if (k === '3') CB.UI.setSpeed(4);
    else if (k === 'Escape') {
      if (Tl.tool.type === 'line' && Tl.lineStops.length) { Tl.lineStops = []; refreshLinePreview(); }
      else if (Tl.tool.type === 'road' && Tl.curve) { Tl.curve = null; Tl.needHover = true; }
      else if (Tl.tool.type !== 'select') Tl.setTool(null);
      else { CB.UI.select(null); CB.UI.closePanels(); }
    }
    else if (k === 'b') { CB.UI.openCat(null); Tl.setTool(Tl.tool.type === 'bulldoze' ? null : { type: 'bulldoze' }); }
    else if (k === 'Enter' && Tl.tool.type === 'line') finishLine();
    else if (k === 'Backspace' && Tl.tool.type === 'line') { Tl.lineStops.pop(); refreshLinePreview(); }
  }
  function onRightClick() {
    if (Tl.tool.type === 'line' && Tl.lineStops.length) { Tl.lineStops.pop(); refreshLinePreview(); }
    else if (Tl.tool.type === 'road' && Tl.curve) { if (Tl.curve.c) Tl.curve.c = null; else Tl.curve = null; Tl.needHover = true; }
    else if (Tl.tool.type !== 'select' && !mouse.moved) Tl.setTool(null);
  }

  function onDown() {
    const h = Tl.hover; if (!h || h.i < 0) return;
    const t = Tl.tool.type;
    if (t === 'road') return; // roads are click to start, click to end
    if (t === 'rail' || t === 'zone' || t === 'dezone' || t === 'bulldoze') Tl.drag = { start: h.i, p: { x: h.x, z: h.z } };
    if (t === 'path') Tl.drag = { start: h.i, f: fcellAt(h) };
  }
  function onUp() {
    const h = Tl.hover;
    const t = Tl.tool;
    const S = CB.Sim, Wd = CB.World;
    if (t.type === 'select') {
      if (mouse.moved || !h) return;
      const v = CB.Traffic.pick(h.x, h.z, 6);
      const bid = h.i >= 0 ? Wd.bld[h.i] : 0;
      if (bid) { CB.UI.select(S.buildings.get(bid)); return; }
      if (v) { CB.UI.selectVehicle(v); return; }
      const st = h.i >= 0 && CB.Transit.stops.find(s => s.tile === h.i);
      if (st) { CB.UI.selectStop(st); return; }
      CB.UI.select(null);
      return;
    }
    if (t.type === 'road') { roadClick(h); return; }
    if (t.type === 'path' && Tl.drag) {
      const cells = lPathF(Tl.drag.f, h ? fcellAt(h) : Tl.drag.f);
      const ev = pathEval(cells, t.pk);
      Tl.drag = null; clearPreview();
      if (ev.bad) { CB.UI.toast(ev.bad, 'bad'); return; }
      if (!spend(ev.cost)) return;
      for (const f of cells) {
        Wd.setPath(f, t.pk);
        const i = U.idx((f % FW) >> 1, ((f / FW) | 0) >> 1);
        Wd.zone[i] = 0; Wd.tree[i] = 0; CB.Meshes.markInfra(i);
      }
      CB.Meshes.treesDirty = true;
      S.networkChanged(); CB.UI.sfx('build');
      return;
    }
    if (t.type === 'junction') {
      if (!h || h.i < 0) return;
      const cl = junctionNear(h.i);
      if (!cl) { CB.UI.toast('Click on an intersection', 'bad'); return; }
      if (t.apply) { CB.UI.setJunctionCtrl(cl.tiles[0], t.apply); CB.UI.sfx('click'); if (CB.UI.junctionTile >= 0) CB.UI.openJunction(cl.tiles[0]); }
      else CB.UI.openJunction(cl.tiles[0]);
      return;
    }
    if (t.type === 'rail' && Tl.drag) {
      const tiles = lPath(Tl.drag.start, h ? h.i : Tl.drag.start);
      const ev = railEval(tiles, t.rr);
      Tl.drag = null; clearPreview();
      if (ev.bad) { CB.UI.toast(ev.bad, 'bad'); return; }
      if (!spend(ev.cost)) return;
      for (const i of tiles) if (Wd.rail[i] !== t.rr) S.setRail(i, t.rr);
      S.networkChanged(); CB.UI.sfx('build');
      return;
    }
    if ((t.type === 'zone' || t.type === 'dezone') && Tl.drag) {
      const r = rectOf(Tl.drag.start, h ? h.i : Tl.drag.start);
      Tl.drag = null; CB.Gfx.uni.uBrushOn.value = 0;
      let n = 0;
      for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) {
        const i = U.idx(x, y);
        if (S.setZone(i, t.type === 'zone' ? t.z : 0)) n++;
      }
      if (n) { CB.Meshes.updateZoneTex(true); CB.UI.sfx('zone'); }
      return;
    }
    if (t.type === 'bulldoze' && Tl.drag) {
      const r = rectOf(Tl.drag.start, h ? h.i : Tl.drag.start);
      Tl.drag = null; CB.Gfx.uni.uBrushOn.value = 0;
      bulldoze(r);
      return;
    }
    if (!h || h.i < 0) return;
    if (t.type === 'svc') {
      const sv = C.SERVICES[t.key];
      const lot = S.serviceLot(t.key, h.tx, h.ty, Tl.rot);
      if (!lot.ok) { CB.UI.toast(lot.reason, 'bad'); return; }
      if (!spend(sv.cost)) return;
      const b = S.placeService(t.key, lot);
      CB.Meshes.updateZoneTex(false);
      CB.UI.sfx('build');
      CB.UI.toast(sv.name + ' built.', 'good');
      return;
    }
    if (t.type === 'stop') {
      const side = stopSide(t.st, h);
      const why = CB.Transit.canPlaceStop(t.st, h.i, side);
      if (why) { CB.UI.toast(why, 'bad'); return; }
      const cost = stopCost(t.st, h.i);
      if (!spend(cost)) return;
      CB.Transit.addStop(t.st, h.i, null, side);
      CB.UI.sfx('build');
      return;
    }
    if (t.type === 'move') {
      const b = S.buildings.get(t.id); if (!b) { Tl.setTool(null); return; }
      const lot = S.serviceLot(b.svc, h.tx, h.ty, Tl.rot, b.id);
      if (!lot.ok) { CB.UI.toast(lot.reason, 'bad'); return; }
      if (!spend(S.moveCost(b))) return;
      S.relocateService(b, lot);
      CB.Meshes.updateZoneTex(false);
      CB.UI.sfx('build'); CB.UI.toast(b.name + ' moved.', 'good');
      Tl.setTool(null);
      return;
    }
    if (t.type === 'line') { lineClick(h); return; }
    if (t.type === 'lineEdit') { lineEditClick(h); return; }
  }
  // which side of the road the cursor is on (rail stations have no side)
  function stopSide(type, h) { return type === 'rail' || !CB.World.road[h.i] ? undefined : CB.Transit.sideAt(h.i, h.x, h.z); }
  // the stop under the cursor: the one on the hovered side first, then any on that tile
  function stopUnder(type, h) {
    const X = CB.Transit, side = stopSide(type, h);
    return X.stopAtTile(h.i, type, side) || null;
  }
  function stopCost(type, i) {
    if (type !== 'rail') return C.TRANSIT[type].stopCost;
    return CB.World.rail[i] === 2 ? C.TRANSIT.rail.ugStopCost : C.TRANSIT.rail.stopCost;
  }
  function rectOf(a, b) {
    return { x0: Math.min(U.tx(a), U.tx(b)), x1: Math.max(U.tx(a), U.tx(b)), y0: Math.min(U.ty(a), U.ty(b)), y1: Math.max(U.ty(a), U.ty(b)) };
  }
  function bulldoze(r) {
    const S = CB.Sim, Wd = CB.World, X = CB.Transit;
    let net = false, refund = 0, any = false;
    const single = r.x0 === r.x1 && r.y0 === r.y1;
    const killB = i => {
      const b = S.buildings.get(Wd.bld[i]);
      if (b) { if (b.kind === 'svc') refund += C.SERVICES[b.svc].cost * 0.25; S.removeBuilding(b); any = true; }
    };
    const killStops = i => { for (const s of X.stops.filter(s => s.tile === i)) { X.removeStop(s); any = true; } };
    const killPath = i => { for (let q = 0; q < 4; q++) Wd.setPath(Wd.cellOf(i, q), 0); CB.Meshes.markInfra(i); net = true; any = true; };
    const killRail = i => { S.setRail(i, 0); net = true; any = true; };
    const killRoad = i => {
      const R = C.ROADS[Wd.road[i]]; if (!R) return;
      refund += R.cost / R.w * 0.5;
      if (i === Wd.outIn || i === Wd.outOut) return; // the highway to the outside world stays
      Wd.unlinkAll(i); S.setRoad(i, 0); Wd.rdir[i] = 0; Wd.rpart[i] = 0; Wd.curv[i] = 0; net = true; any = true;
    };
    if (single) {
      if (!U.inPlay(r.x0, r.y0)) return;
      const i = U.idx(r.x0, r.y0);
      if (Wd.bld[i]) killB(i);
      else if (Wd.pmask[i]) killPath(i);
      else if (X.stops.some(s => s.tile === i)) killStops(i);
      else if (Wd.rail[i]) killRail(i);
      else if (Wd.road[i]) { const seg = roadCut(i); for (const t of seg) killRoad(t); markAround(seg); } // just this tile (and the other carriageway beside it)
    } else {
      for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) {
        if (!U.inPlay(x, y)) continue;
        const i = U.idx(x, y);
        if (Wd.bld[i]) killB(i);
        if (Wd.pmask[i]) killPath(i);
        killStops(i);
        if (Wd.rail[i]) killRail(i);
        if (Wd.road[i]) killRoad(i);
      }
    }
    if (net) S.networkChanged();
    if (refund) S.money += refund;
    if (any) { CB.Meshes.updateZoneTex(false); CB.UI.sfx('demolish'); }
  }

  // the stretch of road between two intersections (both strips of a dual carriageway)
  // the tiles a single bulldoze click removes: the tile itself, plus the opposite carriageway of a dual road
  function roadCut(i) {
    const Wd = CB.World, R = C.ROADS[Wd.road[i]];
    if (!R) return [];
    const out = [i];
    if (R.w === 2 && Wd.rpart[i] && Wd.jcl[i] < 0) {
      const j = Wd.neighbor(i, Wd.rpart[i] - 1);
      if (j >= 0 && Wd.road[j] === Wd.road[i] && Wd.jcl[j] < 0 && j !== Wd.outIn && j !== Wd.outOut) out.push(j);
    }
    return out;
  }
  function roadSegment(i) {
    const Wd = CB.World;
    if (!Wd.road[i]) return [];
    if (Wd.jcl[i] >= 0) return [i];
    const out = [i], seen = new Set(out), q = [i];
    const add = j => { if (j >= 0 && !seen.has(j) && Wd.road[j] && Wd.jcl[j] < 0 && j !== Wd.outIn && j !== Wd.outOut) { seen.add(j); out.push(j); q.push(j); } };
    while (q.length && out.length < 3000) {
      const t = q.pop();
      for (let d = 0; d < 4; d++) {
        if (!Wd.linked(t, d)) continue;
        const j = Wd.neighbor(t, d);
        if (C.ROADS[Wd.road[t]].w !== 2 && Wd.isUturnLink(t, d)) continue;
        add(j);
      }
      // partner strip of a dual carriageway
      const R = C.ROADS[Wd.road[t]];
      if (R.w === 2) for (let d = 0; d < 4; d++) {
        if (d % 2 === Wd.rdir[t] % 2) continue;
        const j = Wd.neighbor(t, d);
        if (j >= 0 && Wd.road[j] === Wd.road[t] && Wd.rdir[j] === (Wd.rdir[t] + 2) % 4) add(j);
      }
    }
    return out;
  }
  Tl.roadSegment = roadSegment;

  // ---------------- transit lines ----------------
  function lineClick(h) {
    const X = CB.Transit, type = Tl.tool.lt, i = h.i, side = stopSide(type, h);
    let s = stopUnder(type, h);
    if (!s) {
      const why = X.canPlaceStop(type, i, side);
      if (why) { CB.UI.toast(why, 'bad'); return; }
      if (!spend(stopCost(type, i))) return;
      s = X.addStop(type, i, null, side);
    }
    const L = Tl.lineStops;
    if (L.length >= 2 && s.id === L[0]) { finishLine(); return; }
    if (L.includes(s.id)) return;
    // check that the new stop is reachable
    if (L.length) {
      const prev = X.stopById(L[L.length - 1]);
      const p = CB.Transit.segPath(type, prev, s);
      if (!p) { CB.UI.toast(type === 'rail' ? 'No track connects these stations' : type === 'tram' ? 'No tram track connects these stops' : 'No road connects these stops (check one-way streets)', 'bad'); return; }
    }
    L.push(s.id);
    CB.UI.sfx('click');
    refreshLinePreview();
  }
  // edit an existing line: click a stop on it to drop it, click anywhere else on a road to add a stop there
  function lineEditClick(h) {
    const X = CB.Transit, l = X.lineById(Tl.tool.line); if (!l) { Tl.setTool(null); return; }
    const type = l.type, side = stopSide(type, h);
    let s = stopUnder(type, h);
    if (s && l.stops.includes(s.id)) {
      if (!X.removeFromLine(l, s)) { CB.UI.toast('A line needs at least two stops', 'bad'); return; }
      CB.UI.toast(s.name + ' removed from ' + l.name, 'good'); CB.UI.sfx('click');
    } else {
      if (!s) {
        const why = X.canPlaceStop(type, h.i, side);
        if (why) { CB.UI.toast(why, 'bad'); return; }
        if (!spend(stopCost(type, h.i))) return;
        s = X.addStop(type, h.i, null, side);
      }
      if (!X.insertStop(l, s)) { CB.UI.toast('That stop cannot be reached from this line', 'bad'); return; }
      CB.UI.toast(s.name + ' added to ' + l.name, 'good'); CB.UI.sfx('build');
    }
    X.showRibbons(true, l);
    CB.UI.refreshTransit();
  }
  function finishLine() {
    const X = CB.Transit;
    if (Tl.lineStops.length < 2) { CB.UI.toast('A line needs at least two stops', 'bad'); return; }
    const l = X.createLine(Tl.tool.lt, Tl.lineStops);
    Tl.lineStops = [];
    refreshLinePreview();
    if (l.broken) CB.UI.toast('The line cannot loop back to its first stop. Check that roads or tracks connect.', 'bad');
    else { CB.UI.toast(l.name + ' created with ' + l.stops.length + ' stops.', 'good'); CB.UI.sfx('build'); }
    CB.UI.refreshTransit();
  }
  function refreshLinePreview(hoverStop) {
    const Mx = CB.Meshes, X = CB.Transit, Wd = CB.World;
    if (Tl.previewRibbon) { Mx.lineGroup.remove(Tl.previewRibbon); Tl.previewRibbon.geometry.dispose(); Tl.previewRibbon = null; }
    const tiles = Tl.lineStops.map(id => X.stopById(id)).filter(Boolean);
    if (hoverStop && tiles.length) tiles.push(hoverStop);
    if (tiles.length < 2) return;
    const pts = [];
    const type = Tl.tool.lt;
    for (let k = 0; k < tiles.length - 1; k++) {
      const p = CB.Transit.segPath(type, tiles[k], tiles[k + 1]);
      if (!p) continue;
      for (const i of p) {
        const x = (U.tx(i) + 0.5) * T, z = (U.ty(i) + 0.5) * T;
        const y = type !== 'rail' ? Wd.roadH(x, z) + 2 : (Wd.rail[i] === 1 ? Wd.deckH(x, z) + 2 : Math.max(Wd.groundH(x, z), 0) + 2.5);
        pts.push(x, y, z);
      }
    }
    Tl.previewRibbon = Mx.ribbon(pts, 2.2, '#ffffff', false);
    if (Tl.previewRibbon) Mx.lineGroup.add(Tl.previewRibbon);
  }

  // test hook: perform a tool action from tile a to tile b as if the player dragged
  Tl._simulate = function (tool, a, b) {
    Tl.setTool(tool);
    if (tool.type === 'road') { buildRoad({ strips: roadStrips(a, b, tool.rt) }, tool.rt); return; }
    const corner = 0.5;
    const mk = i => ({ i, tx: U.tx(i), ty: U.ty(i), x: (U.tx(i) + corner) * T, z: (U.ty(i) + corner) * T });
    Tl.hover = mk(a);
    mouse.moved = false;
    onDown();
    Tl.hover = mk(b);
    onUp();
  };

  // test hook: build a road from world point a to b, optionally bending through c
  Tl._road = function (rt, a, b, c) { return buildRoad(planRoad(rt, a, b, c), rt); };
  Tl._plan = planRoad;
  Tl._simulateAt = function (tool, ax, az, bx, bz) {
    Tl.setTool(tool);
    const mk = (x, z) => { const tx = Math.floor(x / T), ty = Math.floor(z / T); return { i: U.idx(tx, ty), tx, ty, x, z }; };
    Tl.hover = mk(ax, az); mouse.moved = false; onDown();
    Tl.hover = mk(bx, bz); onUp();
  };

  // ---------------- per-frame hover & previews ----------------
  Tl.update = function () {
    const G = CB.Gfx, Mx = CB.Meshes, Wd = CB.World, S = CB.Sim;
    if (Tl.needHover || Tl.drag || Tl.tool.type !== 'select') {
      Tl.needHover = false;
      Tl.hover = G.pick(mouse.x, mouse.y);
    }
    const h = Tl.hover, t = Tl.tool;
    if (!h || h.i < 0) { if (t.type !== 'select') { Mx.setGhostTiles([]); Mx.setGhostBox(null); Mx.setRing(null); Mx.setGhostModel(null); } Tl.tip = ''; return; }
    if (t.type === 'road') {
      const hp = { x: h.x, z: h.z }, cu = Tl.curve, mode = Tl.roadMode;
      const c = bendFor(hp);
      const choosing = c === null; // picking the bend direction: only a guide line, no road yet
      const plan = !cu ? planRoad(t.rt, hp, hp) : choosing ? { strips: [] } : mode === 'grid' ? mergePlans(gridPlans(t.rt, cu.a, hp)) : planRoad(t.rt, cu.a, hp, c || undefined);
      const strips = plan.strips;
      const ev = roadEval(strips, t.rt);
      previewRoad(plan, t.rt, ev);
      Mx.setFlowArrows(strips, t.rt);
      // dotted construction lines from the start through the bend point
      const sa = cu && snapWorld(cu.a, t.rt);
      if (choosing) Mx.setGuide([[sa.x, sa.z, hp.x, hp.z]]);
      else if (c) Mx.setGuide([[sa.x, sa.z, c.x, c.z], [c.x, c.z, hp.x, hp.z]]);
      else Mx.setGuide(null);
      if (cu && cu.c) Mx.setRing(cu.c.x, cu.c.z, 2.2); else Mx.setRing(null);
      const R = C.ROADS[t.rt], bad = plan.bad || ev.bad;
      const upg = ev.list.filter(g => g.col && g.col[0] === 1).length;
      const hint = mode === 'grid' ? (!cu ? 'click one corner of the grid' : 'click the opposite corner') : !cu ? 'click to start the road' : choosing ? 'click where the road should bend' : (R.oneway ? 'click the end (traffic flows this way)' : 'click the end') + ' · Esc to stop';
      const nm = { straight: 'Straight', curve: 'Curve', sbend: 'S-bend', grid: 'Grid' };
      Tl.tip = R.name + ' · ' + (strips.length && strips[0].tiles.length > 1 ? strips[0].tiles.length + ' tiles · ' : '') + (upg ? 'upgrades ' + upg + ' tiles · ' : '') + U.money(ev.cost) + ' · ' + (bad || hint) + ' · C: mode (' + nm[mode] + ')';
    } else if (t.type === 'path') {
      const cells = Tl.drag ? lPathF(Tl.drag.f, fcellAt(h)) : [fcellAt(h)];
      const ev = pathEval(cells, t.pk);
      Mx.setGhostTiles(ev.list);
      Tl.tip = C.PATHS[t.pk].name + ' · ' + U.money(ev.cost) + (ev.bad ? ' · ' + ev.bad : ' · joins sidewalks it touches');
    } else if (t.type === 'junction') {
      const cl = junctionNear(h.i);
      Mx.setGhostTiles(cl ? cl.tiles.map(i => ({ i, ok: true, h: 0.6, col: [0.4, 0.8, 1] })) : []);
      const nm = { lights: 'add traffic lights', stop: 'add stop signs', allstop: 'make it an all-way stop', round: 'make it a roundabout', none: 'remove all control', auto: 'reset to automatic' };
      Tl.tip = cl ? (t.apply ? 'Click to ' + nm[t.apply] : 'Click to edit this intersection') : 'Hover an intersection';
    } else if (t.type === 'rail') {
      const tiles = Tl.drag ? lPath(Tl.drag.start, h.i) : [h.i];
      const ev = railEval(tiles, t.rr);
      Mx.setGhostTiles(ev.list);
      Tl.tip = (Tl.drag ? tiles.length + ' tiles · ' : '') + U.money(ev.cost) + (ev.bad ? ' · ' + ev.bad : '');
    } else if (t.type === 'zone' || t.type === 'dezone' || t.type === 'bulldoze') {
      const r = Tl.drag ? rectOf(Tl.drag.start, h.i) : rectOf(h.i, h.i);
      G.uni.uBrushOn.value = 1;
      G.uni.uBrush.value.set(r.x0 * T, r.y0 * T, (r.x1 + 1) * T, (r.y1 + 1) * T);
      if (t.type === 'zone') { const c = U.hex(C.ZONES[t.z].color); G.uni.uBrushCol.value.setRGB(c[0], c[1], c[2]); }
      else G.uni.uBrushCol.value.setRGB(1, 0.3, 0.25);
      if (t.type === 'bulldoze') {
        const bid = Wd.bld[h.i];
        const b = bid && S.buildings.get(bid);
        Mx.setGhostTiles([]);
        if (b && !Tl.drag) {
          Mx.setGhostBox(b.x * T, b.y * T, (b.x + b.fw) * T, (b.y + b.fh) * T, b.baseY - 0.5, 3, false);
          Tl.tip = 'Demolish ' + b.name;
        } else if (!Tl.drag && Wd.road[h.i] && !Wd.pmask[h.i] && !CB.Transit.stops.some(s => s.tile === h.i) && !Wd.rail[h.i]) {
          Mx.setGhostBox(null);
          const seg = roadCut(h.i);
          Mx.setGhostTiles(seg.map(i => ({ i, ok: false, h: 0.5 })));
          G.uni.uBrushOn.value = 0;
          Tl.tip = 'Click to remove this ' + (Wd.jcl[h.i] >= 0 ? 'intersection tile' : seg.length > 1 ? 'piece of avenue' : 'road tile') + ' · drag to clear an area';
        } else { Mx.setGhostBox(null); Tl.tip = Tl.drag ? 'Release to demolish everything in the area' : 'Click or drag to demolish'; }
      } else {
        const z = Wd.zonable[h.i];
        Tl.tip = t.type === 'zone' ? (z ? C.ZONES[t.z].name : 'Zones must be within 3 tiles of a road') : 'Remove zoning';
      }
    } else if (t.type === 'svc') {
      const sv = C.SERVICES[t.key];
      const lot = S.serviceLot(t.key, h.tx, h.ty, Tl.rot);
      let y = 0; for (let yy = lot.y; yy < lot.y + lot.fh; yy++) for (let xx = lot.x; xx < lot.x + lot.fw; xx++) if (U.inWorld(xx, yy)) y = Math.max(y, Wd.tileAvg(U.idx(xx, yy)));
      Mx.setGhostBuilding(t.key, sv.size[0], sv.size[1], lot.dir !== undefined ? lot.dir : Tl.rot, lot.x * T, lot.y * T, Math.max(y, 0.1), lot.ok);
      Mx.setGhostBox(lot.x * T, lot.y * T, (lot.x + lot.fw) * T, (lot.y + lot.fh) * T, Math.max(y, 0.1) - 0.3, 0.45, lot.ok);
      Mx.setRing(null);
      Tl.tip = sv.name + ' · ' + U.money(sv.cost) + (lot.ok ? ' · R to rotate' : ' · ' + lot.reason);
    } else if (t.type === 'move') {
      const b = S.buildings.get(t.id); if (!b) { Tl.setTool(null); return; }
      const sv = C.SERVICES[b.svc];
      const lot = S.serviceLot(b.svc, h.tx, h.ty, Tl.rot, b.id);
      let y = 0; for (let yy = lot.y; yy < lot.y + lot.fh; yy++) for (let xx = lot.x; xx < lot.x + lot.fw; xx++) if (U.inWorld(xx, yy)) y = Math.max(y, Wd.tileAvg(U.idx(xx, yy)));
      Mx.setGhostBuilding(b.svc, sv.size[0], sv.size[1], lot.dir !== undefined ? lot.dir : Tl.rot, lot.x * T, lot.y * T, Math.max(y, 0.1), lot.ok);
      Mx.setGhostBox(lot.x * T, lot.y * T, (lot.x + lot.fw) * T, (lot.y + lot.fh) * T, Math.max(y, 0.1) - 0.3, 0.45, lot.ok);
      Tl.tip = 'Move ' + b.name + ' · ' + U.money(S.moveCost(b)) + (lot.ok ? ' · R to rotate · Esc to cancel' : ' · ' + lot.reason);
    } else if (t.type === 'stop') {
      const side = stopSide(t.st, h);
      const why = CB.Transit.canPlaceStop(t.st, h.i, side);
      if (t.st === 'rail') { Mx.setGhostTiles([{ i: h.i, ok: !why, y: Wd.rail[h.i] === 1 ? Wd.deckH(h.x, h.z) : undefined, h: 3 }]); Mx.setGhostStop(Wd.rail[h.i] ? { type: 'rail', tile: h.i } : null, !why); }
      else { Mx.setGhostTiles([]); Mx.setGhostStop(Wd.road[h.i] ? { type: t.st, tile: h.i, side } : null, !why); }
      const sn = ['north', 'east', 'south', 'west'];
      Tl.tip = why || (({ bus: 'Bus stop', tram: 'Streetcar stop', rail: 'Station' })[t.st] + (side !== undefined ? ' · ' + sn[side] + ' side' : '') + ' · ' + U.money(stopCost(t.st, h.i)) + (side !== undefined ? ' · move across the road for the other side' : ''));
    } else if (t.type === 'line' || t.type === 'lineEdit') {
      const X = CB.Transit, lt = t.type === 'line' ? t.lt : (X.lineById(t.line) || {}).type;
      if (!lt) { Tl.setTool(null); return; }
      const side = stopSide(lt, h), s = stopUnder(lt, h);
      const why = s ? null : X.canPlaceStop(lt, h.i, side);
      if (t.type === 'line') {
        const key = h.i + ':' + side;
        if (Tl._lastHoverTile !== key) { Tl._lastHoverTile = key; refreshLinePreview(s || (Wd.road[h.i] || Wd.rail[h.i] ? { tile: h.i, side } : null)); }
      }
      Mx.setGhostTiles(s ? [{ i: h.i, ok: true, h: 0.4, col: [0.4, 0.8, 1] }] : []);
      Mx.setGhostStop(!s && !why ? (lt === 'rail' ? { type: 'rail', tile: h.i } : { type: lt, tile: h.i, side }) : null, true);
      if (t.type === 'lineEdit') {
        const l = X.lineById(t.line);
        Tl.tip = s ? (l.stops.includes(s.id) ? 'Click to remove ' + s.name + ' from ' + l.name : 'Click to add ' + s.name + ' to ' + l.name) : (why || 'Click to add a new stop here · ' + U.money(stopCost(lt, h.i))) + ' · Esc when done';
      } else {
        const L = Tl.lineStops;
        if (s && L.length >= 2 && s.id === L[0]) Tl.tip = 'Click to finish the line';
        else if (s) Tl.tip = s.name + (L.length ? ' · add to line' : ' · start line here');
        else Tl.tip = why || ('New ' + (lt === 'rail' ? 'station' : 'stop') + ' · ' + U.money(stopCost(lt, h.i)));
      }
    } else {
      Tl.tip = '';
      if (h.i >= 0) {
        const bid = Wd.bld[h.i];
        Tl.hoverB = bid ? S.buildings.get(bid) : null;
      }
    }
  };
})();
