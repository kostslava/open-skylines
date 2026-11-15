'use strict';
// Arterial — input handling and build tools
(function () {
  const { C, U } = CB;
  const T = C.TILE;
  const Tl = CB.Tools = { tool: { type: 'select' }, hover: null, drag: null, rot: 0, lineStops: [], tip: '' };

  Tl.setTool = function (t) {
    Tl.tool = t || { type: 'select' };
    Tl.drag = null;
    Tl.lineStops = [];
    clearPreview();
    const isZone = Tl.tool.type === 'zone' || Tl.tool.type === 'dezone';
    CB.Gfx.uni.uGrid.value = isZone ? 1 : 0;
    CB.Meshes.updateZoneTex(isZone);
    Tl.zoneView = isZone;
    const transitTool = Tl.tool.type === 'line' || Tl.tool.type === 'stop' || Tl.tool.type === 'rail';
    CB.Transit.showRibbons(transitTool || CB.UI.overlay === 'transit');
    if (Tl.tool.type === 'svc') Tl.rot = 0;
    CB.UI.onToolChange();
  };
  function clearPreview() {
    const Mx = CB.Meshes;
    Mx.setGhostTiles([]); Mx.setGhostBox(null); Mx.setRing(null);
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
  function lPath(a, b) {
    const ax = U.tx(a), ay = U.ty(a), bx = U.tx(b), by = U.ty(b);
    const out = [];
    const horizFirst = Math.abs(bx - ax) >= Math.abs(by - ay);
    let x = ax, y = ay;
    out.push(U.idx(x, y));
    const sx = Math.sign(bx - ax), sy = Math.sign(by - ay);
    if (horizFirst) { while (x !== bx) { x += sx; out.push(U.idx(x, y)); } while (y !== by) { y += sy; out.push(U.idx(x, y)); } }
    else { while (y !== by) { y += sy; out.push(U.idx(x, y)); } while (x !== bx) { x += sx; out.push(U.idx(x, y)); } }
    return out;
  }
  function roadEval(tiles, rt) {
    const Wd = CB.World, R = C.ROADS[rt];
    let cost = 0, bad = null;
    const list = tiles.map(i => {
      let ok = true, col = null, c = 0;
      if (!Wd.roadOK(i)) { ok = false; bad = U.inPlay(U.tx(i), U.ty(i)) ? 'Too steep here' : 'Outside the city limits'; }
      else if (Wd.bld[i]) { ok = false; bad = 'A building is in the way'; }
      else if (Wd.road[i] === rt) { col = [0.5, 0.7, 1.0]; }
      else if (Wd.road[i]) { c = Math.max(0, R.cost - C.ROADS[Wd.road[i]].cost) + 5; col = [1, 0.85, 0.3]; }
      else c = R.cost * (Wd.isWater(i) ? 3 : 1);
      cost += c;
      const y = Wd.isWater(i) ? Wd.BRIDGE_H : undefined;
      return { i, ok, col, y, h: 0.4 };
    });
    return { list, cost, bad };
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
      if (e.button === 0 && !mouse.touchPan) onDown();
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
      if (mouse.btn === 0 && !mouse.touchPan) onUp(e);
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
    if (k === 'r' && Tl.tool.type === 'svc') { Tl.rot = (Tl.rot + 1) % 4; Tl.needHover = true; return; }
    CB.Gfx.cam.keys[k] = true;
    if (e.key === 'Shift') CB.Gfx.cam.keys.Shift = true;
    if (k === ' ') { e.preventDefault(); CB.UI.setSpeed(S.speed === 0 ? (CB.UI.lastSpeed || 1) : 0); }
    else if (k === '1') CB.UI.setSpeed(1);
    else if (k === '2') CB.UI.setSpeed(2);
    else if (k === '3') CB.UI.setSpeed(4);
    else if (k === 'Escape') {
      if (Tl.tool.type === 'line' && Tl.lineStops.length) { Tl.lineStops = []; refreshLinePreview(); }
      else if (Tl.tool.type !== 'select') Tl.setTool(null);
      else { CB.UI.select(null); CB.UI.closePanels(); }
    }
    else if (k === 'b') Tl.setTool({ type: 'bulldoze' });
    else if (k === 'Enter' && Tl.tool.type === 'line') finishLine();
    else if (k === 'Backspace' && Tl.tool.type === 'line') { Tl.lineStops.pop(); refreshLinePreview(); }
  }
  function onRightClick() {
    if (Tl.tool.type === 'line' && Tl.lineStops.length) { Tl.lineStops.pop(); refreshLinePreview(); }
    else if (Tl.tool.type !== 'select' && !mouse.moved) Tl.setTool(null);
  }

  function onDown() {
    const h = Tl.hover; if (!h || h.i < 0) return;
    const t = Tl.tool.type;
    if (t === 'road' || t === 'rail' || t === 'zone' || t === 'dezone' || t === 'bulldoze') Tl.drag = { start: h.i };
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
    if (t.type === 'road' && Tl.drag) {
      const tiles = lPath(Tl.drag.start, h ? h.i : Tl.drag.start);
      const ev = roadEval(tiles, t.rt);
      Tl.drag = null; clearPreview();
      if (ev.bad) { CB.UI.toast(ev.bad, 'bad'); return; }
      if (!spend(ev.cost)) return;
      let changed = false;
      for (const i of tiles) if (Wd.road[i] !== t.rt) { S.setRoad(i, t.rt); changed = true; }
      if (changed) { S.networkChanged(); CB.UI.sfx('build'); }
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
      const why = CB.Transit.canPlaceStop(t.st, h.i);
      if (why) { CB.UI.toast(why, 'bad'); return; }
      const cost = stopCost(t.st, h.i);
      if (!spend(cost)) return;
      CB.Transit.addStop(t.st, h.i);
      CB.UI.sfx('build');
      return;
    }
    if (t.type === 'line') { lineClick(h.i); return; }
  }
  function stopCost(type, i) {
    if (type === 'bus') return C.TRANSIT.bus.stopCost;
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
    const killRail = i => { S.setRail(i, 0); net = true; any = true; };
    const killRoad = i => { refund += C.ROADS[Wd.road[i]].cost * 0.5; S.setRoad(i, 0); net = true; any = true; };
    if (single) {
      if (!U.inPlay(r.x0, r.y0)) return;
      const i = U.idx(r.x0, r.y0);
      if (Wd.bld[i]) killB(i);
      else if (X.stops.some(s => s.tile === i)) killStops(i);
      else if (Wd.rail[i]) killRail(i);
      else if (Wd.road[i]) killRoad(i);
    } else {
      for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) {
        if (!U.inPlay(x, y)) continue;
        const i = U.idx(x, y);
        if (Wd.bld[i]) killB(i);
        killStops(i);
        if (Wd.rail[i]) killRail(i);
        if (Wd.road[i]) killRoad(i);
      }
    }
    if (net) S.networkChanged();
    if (refund) S.money += refund;
    if (any) { CB.Meshes.updateZoneTex(false); CB.UI.sfx('demolish'); }
  }

  // ---------------- transit lines ----------------
  function lineClick(i) {
    const X = CB.Transit, type = Tl.tool.lt;
    let s = X.stopAtTile(i, type);
    if (!s) {
      const why = X.canPlaceStop(type, i);
      if (why) { CB.UI.toast(type === 'bus' ? 'Click a road to add a stop' : 'Click on rail track to add a station', 'bad'); return; }
      if (!spend(stopCost(type, i))) return;
      s = X.addStop(type, i);
    }
    const L = Tl.lineStops;
    if (L.length >= 2 && s.id === L[0]) { finishLine(); return; }
    if (L.includes(s.id)) return;
    // check that the new stop is reachable
    if (L.length) {
      const prev = X.stopById(L[L.length - 1]);
      const p = type === 'bus' ? CB.Traffic.findPath(prev.tile, s.tile, true) : CB.Traffic.findRailPath(prev.tile, s.tile);
      if (!p) { CB.UI.toast(type === 'bus' ? 'No road connects these stops' : 'No track connects these stations', 'bad'); return; }
    }
    L.push(s.id);
    CB.UI.sfx('click');
    refreshLinePreview();
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
  function refreshLinePreview(hoverTile) {
    const Mx = CB.Meshes, X = CB.Transit, Wd = CB.World;
    if (Tl.previewRibbon) { Mx.lineGroup.remove(Tl.previewRibbon); Tl.previewRibbon.geometry.dispose(); Tl.previewRibbon = null; }
    const L = Tl.lineStops.map(id => X.stopById(id)).filter(Boolean);
    const tiles = L.map(s => s.tile);
    if (hoverTile !== undefined && hoverTile >= 0 && tiles.length) tiles.push(hoverTile);
    if (tiles.length < 2) return;
    const pts = [];
    const type = Tl.tool.lt;
    for (let k = 0; k < tiles.length - 1; k++) {
      const p = type === 'bus' ? CB.Traffic.findPath(tiles[k], tiles[k + 1], true) : CB.Traffic.findRailPath(tiles[k], tiles[k + 1]);
      if (!p) continue;
      for (const i of p) {
        const x = (U.tx(i) + 0.5) * T, z = (U.ty(i) + 0.5) * T;
        const y = type === 'bus' ? Wd.roadH(x, z) + 2 : (Wd.rail[i] === 1 ? Wd.deckH(x, z) + 2 : Math.max(Wd.groundH(x, z), 0) + 2.5);
        pts.push(x, y, z);
      }
    }
    Tl.previewRibbon = Mx.ribbon(pts, 2.2, '#ffffff', false);
    if (Tl.previewRibbon) Mx.lineGroup.add(Tl.previewRibbon);
  }

  // test hook: perform a tool action from tile a to tile b as if the player dragged
  Tl._simulate = function (tool, a, b) {
    Tl.setTool(tool);
    const mk = i => ({ i, tx: U.tx(i), ty: U.ty(i), x: (U.tx(i) + 0.5) * T, z: (U.ty(i) + 0.5) * T });
    Tl.hover = mk(a);
    mouse.moved = false;
    onDown();
    Tl.hover = mk(b);
    onUp();
  };

  // ---------------- per-frame hover & previews ----------------
  Tl.update = function () {
    const G = CB.Gfx, Mx = CB.Meshes, Wd = CB.World, S = CB.Sim;
    if (Tl.needHover || Tl.drag || Tl.tool.type !== 'select') {
      Tl.needHover = false;
      Tl.hover = G.pick(mouse.x, mouse.y);
    }
    const h = Tl.hover, t = Tl.tool;
    if (!h || h.i < 0) { if (t.type !== 'select') { Mx.setGhostTiles([]); Mx.setGhostBox(null); Mx.setRing(null); } Tl.tip = ''; return; }
    if (t.type === 'road') {
      const tiles = Tl.drag ? lPath(Tl.drag.start, h.i) : [h.i];
      const ev = roadEval(tiles, t.rt);
      Mx.setGhostTiles(ev.list);
      Tl.tip = (Tl.drag ? tiles.length + ' tiles · ' : '') + U.money(ev.cost) + (ev.bad ? ' · ' + ev.bad : '');
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
        if (b && !Tl.drag) {
          Mx.setGhostBox(b.x * T, b.y * T, (b.x + b.fw) * T, (b.y + b.fh) * T, b.baseY - 0.5, 3, false);
          Tl.tip = 'Demolish ' + b.name;
        } else { Mx.setGhostBox(null); Tl.tip = Tl.drag ? 'Release to demolish everything in the area' : 'Click or drag to demolish'; }
      } else {
        const z = Wd.zonable[h.i];
        Tl.tip = t.type === 'zone' ? (z ? C.ZONES[t.z].name : 'Zones must be within 3 tiles of a road') : 'Remove zoning';
      }
    } else if (t.type === 'svc') {
      const sv = C.SERVICES[t.key];
      const lot = S.serviceLot(t.key, h.tx, h.ty, Tl.rot);
      const y = Math.max(Wd.groundH((lot.x + lot.fw / 2) * T, (lot.y + lot.fh / 2) * T), 0);
      Mx.setGhostBox(lot.x * T, lot.y * T, (lot.x + lot.fw) * T, (lot.y + lot.fh) * T, y, 9, lot.ok);
      Mx.setRing((lot.x + lot.fw / 2) * T, (lot.y + lot.fh / 2) * T, sv.radius * T);
      Tl.tip = sv.name + ' · ' + U.money(sv.cost) + (lot.ok ? ' · R to rotate' : ' · ' + lot.reason);
    } else if (t.type === 'stop') {
      const why = CB.Transit.canPlaceStop(t.st, h.i);
      Mx.setGhostTiles([{ i: h.i, ok: !why, y: t.st === 'rail' && Wd.rail[h.i] === 1 ? Wd.deckH(h.x, h.z) : undefined, h: 3 }]);
      Tl.tip = why || ((t.st === 'bus' ? 'Bus stop' : 'Station') + ' · ' + U.money(stopCost(t.st, h.i)));
    } else if (t.type === 'line') {
      const X = CB.Transit;
      const s = X.stopAtTile(h.i, t.lt);
      if (Tl._lastHoverTile !== h.i) { Tl._lastHoverTile = h.i; refreshLinePreview(h.i); }
      Mx.setGhostTiles([{ i: h.i, ok: !!s || !X.canPlaceStop(t.lt, h.i), h: 2 }]);
      const L = Tl.lineStops;
      if (s && L.length >= 2 && s.id === L[0]) Tl.tip = 'Click to finish the line';
      else if (s) Tl.tip = s.name + (L.length ? ' · add to line' : ' · start line here');
      else Tl.tip = X.canPlaceStop(t.lt, h.i) ? (t.lt === 'bus' ? 'Click a road' : 'Click rail track') : 'New ' + (t.lt === 'bus' ? 'stop' : 'station') + ' · ' + U.money(stopCost(t.lt, h.i));
    } else {
      Tl.tip = '';
      if (h.i >= 0) {
        const bid = Wd.bld[h.i];
        Tl.hoverB = bid ? S.buildings.get(bid) : null;
      }
    }
  };
})();
