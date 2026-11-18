'use strict';
// Open Skylines — boot, main loop, settings, save/load
(function () {
  const { C, U } = CB;
  const $ = id => document.getElementById(id);
  const Game = CB.Game = { running: false };

  function showErr(msg) {
    let e = $('err');
    if (!e) { e = document.createElement('div'); e.id = 'err'; document.body.appendChild(e); }
    e.textContent = msg;
  }
  window.addEventListener('error', ev => showErr('Error: ' + ev.message + (ev.filename ? '\n' + ev.filename.split('/').pop() + ':' + ev.lineno : '')));

  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); return true; } catch (e) { return null; } }
  function storeDel(k) { try { localStorage.removeItem(k); } catch (e) { /* storage blocked */ } }

  function defaultPreset() {
    const mobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    const cores = navigator.hardwareConcurrency || 4;
    if (mobile || cores <= 2) return 'low';
    return 'medium';
  }
  function loadSettings() {
    let s = null;
    try { s = JSON.parse(store(C.SET_KEY) || 'null'); } catch (e) { s = null; }
    const preset = (s && s.preset) || defaultPreset();
    const base = Object.assign({ preset, dayNight: true, fps: false }, C.QUALITY[preset === 'custom' ? 'medium' : preset]);
    return Object.assign(base, s || {});
  }
  Game.applySettings = function (ns) {
    const old = CB.Gfx.settings;
    CB.Gfx.applySettings(ns);
    if (old.cars !== ns.cars || old.shadows !== ns.shadows || old.detail !== ns.detail) CB.Meshes.resizeVehicles();
    if (old.trees !== ns.trees) CB.Meshes.treesDirty = true;
    store(C.SET_KEY, JSON.stringify(ns));
  };

  Game.save = function (quiet) {
    if (!Game.running) return false;
    try {
      localStorage.setItem(C.SAVE_KEY, JSON.stringify(CB.Sim.serialize()));
      return true;
    } catch (e) {
      if (!quiet) CB.UI.toast('Could not save: browser storage is blocked or full.', 'bad');
      return false;
    }
  };
  Game.autosave = function () { Game.save(true); };
  function readSave() { try { const s = store(C.SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }

  Game.showStart = function (fresh) {
    if (fresh) {
      storeDel(C.SAVE_KEY);
      try { sessionStorage.setItem('openskylines.fresh', '1'); } catch (e) { /* ignore */ }
      location.reload();
    }
  };

  // ------------------------------------------------------------------
  function boot() {
    if (!window.THREE) { $('loading').textContent = 'Could not load the 3D engine. Check your internet connection and reload.'; return; }
    const save = readSave();
    const params = new URLSearchParams(location.search);
    let fresh = false;
    try { fresh = sessionStorage.getItem('openskylines.fresh') === '1'; sessionStorage.removeItem('openskylines.fresh'); } catch (e) { /* ignore */ }
    let seed = save && !fresh ? save.seed : Math.floor(Math.random() * 1e6) + 1;
    if (params.get('seed')) seed = +params.get('seed');
    if (params.get('trace')) console.log('seed ' + seed);
    const settings = loadSettings();
    if (params.get('preset')) Object.assign(settings, C.QUALITY[params.get('preset')], { preset: params.get('preset') });
    CB.World.init(seed);
    CB.Gfx.init($('view'), settings);
    CB.Meshes.init();
    CB.Sim.init({ seed, name: 'Port Alder' });
    CB.Tools.init($('view'));
    CB.UI.init();
    CB.Meshes.updateZoneTex(false);
    $('loading').remove();

    // start screen
    const st = $('start');
    st.hidden = false;
    $('topbar').hidden = true; $('toolbar').hidden = true;
    $('presetStart').value = settings.preset === 'custom' ? 'medium' : settings.preset;
    $('presetStart').onchange = () => {
      const p = $('presetStart').value;
      Game.applySettings(Object.assign({}, CB.Gfx.settings, C.QUALITY[p], { preset: p }));
    };
    if (save && !fresh) { $('btnContinue').hidden = false; $('btnContinue').textContent = 'Continue ' + save.name; }
    $('btnNew').onclick = () => startNew(($('cityInput').value || 'Port Alder').trim());
    $('btnContinue').onclick = () => continueSave(save);
    G0.orbit = true;
    requestAnimationFrame(loop);

    if (params.get('demo')) { startNew('Demo City'); demoCity(+params.get('ms') || 0); }
    if (params.get('play')) { startNew('Play Test'); playTest(); }
    if (params.get('autoload') && save) continueSave(save);
    if (params.get('ff')) fastForward(+params.get('ff'));
    if (params.get('autosave')) Game.save();
    if (params.get('cam')) { const c = CB.Gfx.cam; const v = params.get('cam').split(',').map(Number); c.tx = v[0]; c.tz = v[1]; c.tdist = c.dist = v[2]; c.yaw = v[3]; c.pitch = v[4]; }
    if (params.get('view')) { const c = CB.Gfx.cam; const v = params.get('view').split(',').map(Number); c.tdist = c.dist = v[0]; c.yaw = v[1]; c.pitch = v[2]; if (v.length > 3) { c.tx += v[3]; c.tz += v[4]; } }
    if (params.get('hour')) CB.Sim.hour = +params.get('hour');
    if (params.get('seed')) { /* seed is chosen at boot; see below */ }
    if (params.get('ov')) CB.UI.setOverlay(params.get('ov'));
    if (params.get('panel')) CB.UI.openPanel(params.get('panel'));
    if (params.get('cat')) CB.UI.openCat(params.get('cat'));
    if (params.get('sel')) { const z = +params.get('sel'); for (const b of CB.Sim.buildings.values()) if (b.zone === z && b.state === 'live') { CB.UI.select(b); break; } }
    if (params.get('dbg')) {
      const pre = document.createElement('pre'); pre.id = 'dbg'; pre.style.display = 'none'; document.body.appendChild(pre);
      const S = CB.Sim;
      const counts = {}; S.buildings.forEach(b => { const k = b.kind === 'svc' ? 'svc' : C.ZONES[b.zone].key + ':' + b.state; counts[k] = (counts[k] || 0) + 1; });
      pre.textContent = JSON.stringify({ month: S.month, hour: S.hour, money: Math.round(S.money), stats: S.stats, demand: S.demand, ms: S.milestone, last: S.last, veh: CB.Traffic.stats, nveh: CB.Traffic.vehicles.length, counts, riders: CB.Transit.stats,
        lines: CB.Transit.lines.map(l => ({ b: l.broken, n: l.stops.length, p: l.path && l.path.length, veh: CB.Transit.vehiclesOf(l).length, rm: l.ridersMonth })),
        rt: (() => { const s = CB.Transit.stops; if (s.length < 3) return null; const r = CB.Transit.route(s[0].tile, s[2].tile); return r ? { t: r.time, legs: r.legs } : 'null'; })(),
        wait: CB.Transit.stops.map(s => s.waiting.length), play: Game.playLog }, (k, v) => typeof v === 'number' ? Math.round(v * 100) / 100 : v);
    }
  }
  const G0 = { orbit: false };

  function startNew(name) {
    CB.Sim.name = name || 'Port Alder';
    $('start').hidden = true;
    $('topbar').hidden = false; $('toolbar').hidden = false;
    G0.orbit = false;
    Game.running = true;
    $('goals').hidden = false;
    CB.UI.setSpeed(1);
    const hw = CB.World.hwRow;
    CB.Gfx.focus((C.P0 + 18) * C.TILE, (hw + 1) * C.TILE, 260);
    CB.UI.toast('Welcome to ' + CB.Sim.name + '. Open Roads and drag a street from the little road at the end of the highway.', 'good');
    Game.save(true);
  }
  function continueSave(save) {
    try {
      CB.Sim.load(save);
      CB.Transit.buildAll();
      CB.Meshes.rebuildAll();
      CB.Meshes.updateZoneTex(false);
    } catch (e) { showErr('Could not load the saved city: ' + e.message); return; }
    $('start').hidden = true;
    $('topbar').hidden = false; $('toolbar').hidden = false;
    G0.orbit = false;
    Game.running = true;
    $('goals').hidden = false;
    CB.UI.setSpeed(1);
    // look at the city centre
    let sx = 0, sz = 0, n = 0;
    CB.Sim.buildings.forEach(b => { sx += b.x; sz += b.y; n++; });
    if (n) CB.Gfx.focus(sx / n * C.TILE, sz / n * C.TILE, 420);
  }

  // ------------------------------------------------------------------
  let last = performance.now(), fpsT = 0, fpsN = 0, iconT = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    let dt = (now - last) / 1000; last = now;
    if (!(dt > 0)) dt = 0.016;
    dt = Math.min(dt, 0.1);
    const S = CB.Sim, Gx = CB.Gfx, Mx = CB.Meshes;
    if (Game.running && S.speed > 0) {
      let simDt = dt * S.speed;
      const steps = Math.ceil(simDt / 0.1);
      const sd = simDt / steps;
      for (let k = 0; k < steps; k++) { S.step(sd); CB.Traffic.update(sd); CB.Transit.update(sd); }
    }
    if (G0.orbit) { Gx.cam.yaw += dt * 0.04; Gx.cam.tdist = 520; Gx.cam.pitch = 0.5; }
    Gx.uni.uTime.value += dt;
    Gx.setTime(S.hour);
    CB.Tools.update();
    if (CB.UI.follow && CB.UI.selVehicle) { const v = CB.UI.selVehicle; Gx.cam.tx += (v.x - Gx.cam.tx) * Math.min(1, dt * 5); Gx.cam.tz += (v.z - Gx.cam.tz) * Math.min(1, dt * 5); }
    Gx.updateCamera(dt);
    Mx.update(6);
    if (S.zoneTexDirty) { S.zoneTexDirty = false; Mx.updateZoneTex(CB.Tools.zoneView); }
    Mx.beginVehicles(); CB.Traffic.render(); CB.Transit.render(); Mx.endVehicles();
    iconT += dt;
    if (iconT > 0.5) { iconT = 0; Mx.setIcons(Game.running ? S.icons : []); }
    Mx.cullTrees(Gx.camera);
    Gx.render();
    fpsN++; fpsT += dt;
    if (fpsT > 0.5) {
      const f = $('fps');
      f.textContent = Gx.settings.fps ? Math.round(fpsN / fpsT) + ' fps · ' + Gx.renderer.info.render.calls + ' draws · ' + (Gx.renderer.info.render.triangles / 1000).toFixed(0) + 'k tris' : '';
      fpsN = 0; fpsT = 0;
    }
  }

  // ------------------------------------------------------------------
  // Test helpers (URL params): ?demo=1 builds a starter town, ?ff=N runs N game hours
  function fastForward(hours) {
    const S = CB.Sim;
    const steps = Math.round(hours * C.SIM_SEC / 0.25);
    const trace = new URLSearchParams(location.search).get('trace');
    for (let k = 0; k < steps; k++) {
      if (trace) console.log('ff ' + k + ' S h=' + S.hour.toFixed(2));
      S.step(0.25);
      if (trace) console.log('ff ' + k + ' T veh=' + CB.Traffic.vehicles.length + ' q=' + CB.Traffic.queue.length);
      CB.Traffic.update(0.25);
      if (trace) console.log('ff ' + k + ' X');
      CB.Transit.update(0.25);
      if (k % 40 === 0) { if (trace) console.log('ff ' + k + ' M'); CB.Meshes.update(1); }
    }
  }
  function demoCity(ms) {
    const Wd = CB.World, S = CB.Sim, U2 = U, I = U.idx, Tl = CB.Tools;
    S.money = 900000;
    S.milestone = ms || 0;
    const r = Wd.hwRow, x0 = C.P0 + 16;
    const road = (rt, a, b) => { Tl._simulate({ type: 'road', rt }, a, b); };
    const AVE = C.ROADS.findIndex(q => q && q.key === 'ave4');
    const BIKE = C.ROADS.findIndex(q => q && q.key === 'bike2');
    // main avenue east from the connector
    road(ms >= 2 ? AVE : 1, I(x0, r + 1), I(x0 + 46, r + 1));
    for (let k = 0; k <= 6; k++) road(k % 2 && ms >= 1 ? BIKE : 1, I(x0 + 6 + k * 6, r - 20), I(x0 + 6 + k * 6, r + 21));
    for (let j = 0; j <= 7; j++) { const y = r - 20 + j * 6; if (Math.abs(y - r) <= 2) continue; road(1, I(x0 + 6, y), I(x0 + 42, y)); }
    if (ms >= 6) { for (let x = x0 + 4; x <= x0 + 46; x++) S.setRail(U2.idx(x, r - 7), 1); S.networkChanged(); }
    const X = CB.Transit;
    if (ms >= 3) {
      // eastbound along the avenue (south kerb), westbound back along the street to the north (north kerb)
      const ids = [[x0 + 9, r + 1, 2], [x0 + 21, r + 1, 2], [x0 + 33, r + 1, 2], [x0 + 33, r - 8, 0], [x0 + 21, r - 8, 0], [x0 + 9, r - 8, 0]].map(([x, y, sd]) => (X.stopAtTile(I(x, y), 'bus', sd) || X.addStop('bus', I(x, y), null, sd)).id);
      X.createLine('bus', ids);
    }
    if (ms >= 6) { const ids = [x0 + 6, x0 + 25, x0 + 44].map(x => X.addStop('rail', I(x, r - 7)).id); X.createLine('rail', ids); X.setVehicles(X.lines[X.lines.length - 1], 2); }
    const place = (key, tx, ty) => {
      for (let rad = 0; rad < 12; rad++) for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
        const lot = S.serviceLot(key, tx + dx, ty + dy, 0);
        if (lot.ok) { S.placeService(key, lot); return true; }
      }
      return false;
    };
    if (ms >= 1) { place('clinic', x0 + 14, r - 3); place('garbage', x0 + 40, r + 15); place('park', x0 + 9, r - 9); place('playground', x0 + 27, r - 15); }
    if (ms >= 2) { place('fire', x0 + 26, r + 4); place('police', x0 + 32, r - 3); place('elem', x0 + 20, r - 9); }
    if (ms >= 3) place('plaza', x0 + 20, r + 5);
    if (ms >= 7) { place('claude', x0 + 33, r + 10); place('vscode', x0 + 14, r + 10); place('octocat', x0 + 38, r - 15); place('duck', x0 + 9, r - 15); }
    for (let i = 0; i < Wd.zone.length; i++) {
      if (!Wd.zonable[i] || Wd.bld[i]) continue;
      const x = U2.tx(i), y = U2.ty(i);
      if (x < x0 + 3 || x > x0 + 47 || Math.abs(y - r) > 22) continue;
      const dy = y - r;
      let z = 1;
      if (Math.abs(dy) <= 3) z = 4;
      else if (dy > 12) z = 6;
      else if (dy > 3 && x > x0 + 30) z = 4;
      else if (dy < -12 && ms >= 3) z = 2;
      if (ms >= 6 && Math.abs(dy) <= 8 && x < x0 + 20 && dy < 0) z = 3;
      if (ms >= 5 && dy > 3 && dy <= 8 && x < x0 + 18) z = 7;
      S.setZone(i, z);
    }
    S.zoneTexDirty = true;
    Tl.setTool(null);
    CB.Gfx.focus((x0 + 24) * C.TILE, r * C.TILE, 520);
  }
  // drives the real tools the way a player would
  function playTest() {
    const Wd = CB.World, Tl = CB.Tools, I = U.idx;
    const r = Wd.hwRow, x0 = C.P0 + 16;
    const log = [];
    const m0 = CB.Sim.money;
    Tl._simulate({ type: "road", rt: 1 }, I(x0, r + 1), I(x0 + 24, r + 1));            // main street east
    Tl._simulate({ type: 'road', rt: 1 }, I(x0 + 8, r - 10), I(x0 + 8, r + 10)); // cross street
    Tl._simulate({ type: 'road', rt: 1 }, I(x0 + 16, r - 10), I(x0 + 16, r + 10));
    Tl._simulate({ type: 'road', rt: 1 }, I(x0 + 8, r - 10), I(x0 + 16, r - 10));
    log.push('roads cost ' + Math.round(m0 - CB.Sim.money) + ', conn tiles ' + Wd.conn.reduce((a, b) => a + b, 0));
    Tl._simulate({ type: 'zone', z: 1 }, I(x0 + 1, r - 9), I(x0 + 15, r - 1));
    Tl._simulate({ type: 'zone', z: 4 }, I(x0 + 1, r + 1), I(x0 + 7, r + 3));
    Tl._simulate({ type: 'zone', z: 6 }, I(x0 + 17, r + 1), I(x0 + 24, r + 3));
    let zc = [0, 0, 0, 0, 0, 0, 0, 0]; for (let i = 0; i < Wd.zone.length; i++) zc[Wd.zone[i]]++;
    log.push('zones ' + zc.join(','));
    Tl._simulate({ type: 'svc', key: 'clinic' }, I(x0 + 11, r + 2), I(x0 + 11, r + 2));
    Tl._simulate({ type: 'bulldoze' }, I(x0 + 24, r), I(x0 + 24, r));
    log.push('buildings ' + CB.Sim.buildings.size + ', road at end ' + Wd.road[I(x0 + 24, r)]);
    Tl.setTool(null);
    Game.playLog = log;
  }
  Game.demoCity = demoCity;
  Game.fastForward = fastForward;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
