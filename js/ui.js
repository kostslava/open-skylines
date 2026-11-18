'use strict';
// Open Skylines — DOM interface: top bar, tool dock, panels, info views, goals, toasts
(function () {
  const { C, U } = CB;
  const $ = id => document.getElementById(id);
  const UI = CB.UI = { selected: null, selVehicle: null, selStop: null, overlay: null, panel: null, lastSpeed: 1, follow: false };

  // ---------------- icons ----------------
  const IC = {
    street: '<path d="M8 3L5 21M16 3l3 18M12 4v3M12 10v3M12 16v3"/>',
    avenue: '<path d="M6 3L3 21M18 3l3 18M10 4v3M10 10v3M10 16v3M14 4v3M14 10v3M14 16v3"/>',
    highway: '<path d="M5 3L2 21M19 3l3 18M12 3v18M8 5v2M8 11v2M8 17v2M16 5v2M16 11v2M16 17v2"/>',
    rlow: '<path d="M3 11l9-7 9 7M5 10v10h14V10M10 20v-5h4v5"/>',
    rmed: '<path d="M4 20V8h7v12M11 20V4h9v16M6 11h3M6 15h3M14 8h3M14 12h3M14 16h3"/>',
    rhigh: '<path d="M8 21V3h8v18M5 21h14M10 6h4M10 10h4M10 14h4"/>',
    clow: '<path d="M3 9l2-5h14l2 5M4 9v11h16V9M3 9h18M9 20v-6h6v6"/>',
    chigh: '<path d="M2 20V9l10-5 10 5v11M6 20v-7h12v7M2 20h20"/>',
    ind: '<path d="M3 20V10l5 3V10l5 3V10l5 3V4h3v16zM3 20h18"/>',
    office: '<path d="M5 21V5l7-2 7 2v16M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1"/>',
    dezone: '<path d="M4 4h16v16H4zM4 4l16 16"/>',
    police: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    fire: '<path d="M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 2-7 2 1 3 3 3 5 1-2 1-6 1-9z"/>',
    health: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
    edu: '<path d="M2 9l10-5 10 5-10 5zM6 11v5c3 2 9 2 12 0v-5"/>',
    garbage: '<path d="M4 6h16M9 6V4h6v2M6 6l1 14h10l1-14M10 10v6M14 10v6"/>',
    park: '<path d="M12 21v-6M12 3l6 9H6zM12 7l5 8H7z"/>',
    plaza: '<path d="M4 20h16M6 20c0-3 2-4 6-4s6 1 6 4M12 16V8M9 6c1-2 5-2 6 0"/>',
    stadium: '<ellipse cx="12" cy="12" rx="9" ry="6"/><ellipse cx="12" cy="12" rx="4" ry="2.5"/>',
    tower: '<path d="M12 2v4M9 6h6l-1 4h-4zM10.5 10L9 21h6l-1.5-11"/>',
    arch: '<path d="M3 21V6h18v15M7 21v-9a5 5 0 0 1 10 0v9"/>',
    busstop: '<path d="M6 21V3M6 4h8v6H6M10 21v-6"/>',
    busline: '<rect x="4" y="4" width="16" height="13" rx="2"/><path d="M4 11h16M7 21v-4M17 21v-4"/>',
    elev: '<path d="M3 8h18M3 12h18M6 12v9M18 12v9M7 8V5M12 8V5M17 8V5"/>',
    sub: '<path d="M3 20a9 9 0 0 1 18 0M7 20a5 5 0 0 1 10 0M12 7V3"/>',
    station: '<rect x="3" y="8" width="18" height="8" rx="2"/><path d="M2 8l10-5 10 5M8 20l1-4M16 20l-1-4"/>',
    metro: '<rect x="6" y="3" width="12" height="15" rx="4"/><path d="M6 11h12M9 21l1-3M15 21l-1-3"/>',
    zones: '<path d="M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z"/>',
    bulldoze: '<path d="M5 5l14 14M19 5L5 19"/>',
  };
  Object.assign(IC, {
    junction: '<path d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6"/><circle cx="12" cy="12" r="1.5"/>',
    lights: '<rect x="8" y="2" width="8" height="18" rx="2"/><circle cx="12" cy="6" r="1.5"/><circle cx="12" cy="11" r="1.5"/><circle cx="12" cy="16" r="1.5"/>',
    stop: '<path d="M8 3h8l5 5v8l-5 5H8l-5-5V8z"/>',
    round: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
    free: '<path d="M12 3v18M3 12h18"/>',
    tramstop: '<path d="M6 21V3M6 4h8v6H6M10 21v-6"/><path d="M14 18h6"/>',
    tramline: '<rect x="5" y="5" width="14" height="12" rx="3"/><path d="M9 2h6M12 2v3M8 21l2-4M16 21l-2-4"/>',
    playground: '<path d="M4 20V8l8-4 8 4v12M8 20v-6h8v6"/>',
    landmark: '<path d="M12 2l3 7h7l-5.5 4 2 7-6.5-4.5L5.5 20l2-7L2 9h7z"/>',
    recycle: '<path d="M7 19l-4-7 4-7M17 5l4 7-4 7M8 5h8M8 19h8"/>',
  });
  const svg = k => '<svg viewBox="0 0 24 24" aria-hidden="true">' + (IC[k] || IC.landmark) + '</svg>';
  const SVC_ICON = { police: 'police', policehq: 'police', fire: 'fire', firehq: 'fire', clinic: 'health', hospital: 'health', elem: 'edu', high: 'edu', univ: 'edu', garbage: 'garbage', recycle: 'recycle', plaza: 'plaza', grandplaza: 'plaza', miniplaza: 'plaza', playground: 'playground', bigplay: 'playground', stadium: 'stadium', tower: 'tower', claude: 'arch' };
  const SVC_COL = { police: '#2c5aa0', fire: '#b8322a', health: '#c8323e', edu: '#a0632f', garbage: '#4d7a4a', park: '#3f8a3a', landmark: '#8a6a2a' };

  // top-down cross-section thumbnail of a road
  function roadSvg(R) {
    const L = R.L, S = 6; // px per metre
    const W = 10 * S * R.w, H = 44;
    let g = '';
    const rect = (x, w, col) => { g += `<rect x="${x.toFixed(1)}" y="0" width="${Math.max(0.5, w).toFixed(1)}" height="${H}" fill="${col}"/>`; };
    const dash = (x, col) => { g += `<line x1="${x}" y1="2" x2="${x}" y2="${H - 2}" stroke="${col || '#e6e6df'}" stroke-width="1" stroke-dasharray="5 4"/>`; };
    const solid = (x, col) => { g += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${col}" stroke-width="1.2"/>`; };
    const arrow = (x, up) => { g += up ? `<path d="M${x} 13l-3 5h6z M${x - 0.6} 18h1.2v12h-1.2z" fill="#fff" opacity="0.85"/>` : `<path d="M${x} 31l-3 -5h6z M${x - 0.6} 14h1.2v12h-1.2z" fill="#fff" opacity="0.85"/>`; };
    if (!R.car) {
      rect(0, W, '#6b9444'); rect(W / 2 - 10, 20, R.key === 'bikepath' ? '#7a4a3c' : '#c9c1ad');
      if (R.key === 'bikepath') dash(W / 2);
      return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${g}</svg>`;
    }
    const asph = R.surf === 'dirt' ? '#8a7458' : '#3c3f44';
    const strip = (ox, mirror) => {
      const X = u => ox + (mirror ? 10 - u : u) * S;
      const band = (u0, u1, col) => { const a = X(u0), b = X(u1); rect(Math.min(a, b), Math.abs(b - a), col); };
      band(0, 10, asph);
      const sw = R.side, bw = L.bw;
      const sides = R.w === 2 ? [1] : [0, 1];
      for (const sd of sides) {
        if (sw > 0) band(sd ? 10 - sw : 0, sd ? 10 : sw, R.grp === 'highway' ? '#6b6b66' : '#aeada6');
        if (R.trees && sw > 0) { const cx = X(sd ? 10 - sw / 2 : sw / 2); g += `<circle cx="${cx}" cy="12" r="4.5" fill="#4f7d34"/><circle cx="${cx}" cy="32" r="4.5" fill="#4f7d34"/>`; }
        if (bw > 0) { band(sd ? 10 - sw - bw : sw, sd ? 10 - sw : sw + bw, '#3f7a4e'); if (R.bike === 2) band(sd ? 10 - sw - bw : sw + bw - 0.35, sd ? 10 - sw - bw + 0.35 : sw + bw, '#aeada6'); }
      }
      if (R.surf === 'dirt') return;
      if (R.w === 2) {
        if (R.med === 'paint') solid(X(0.07), '#dfb33a');
        else if (R.med === 'barrier') band(0, 0.4, '#b9b6ad');
        else band(0, L.med, R.med === 'curb' ? '#aeada6' : '#5d8c3c');
        if (R.med === 'trees') g += `<circle cx="${X(0.3)}" cy="22" r="4" fill="#3f6b30"/>`;
        for (let j = 0; j < L.fwd.length - 1; j++) dash(X(5 + (L.fwd[j] + L.fwd[j + 1]) / 2));
        for (const o of L.fwd) arrow(X(5 + o), !mirror);
        if (R.tram) for (const o of L.fwd.slice(-1)) { solid(X(5 + o - 0.7), '#9095a0'); solid(X(5 + o + 0.7), '#9095a0'); }
      } else if (R.oneway) {
        for (let j = 0; j < L.fwd.length - 1; j++) dash(X(5 + (L.fwd[j] + L.fwd[j + 1]) / 2));
        for (const o of L.fwd) arrow(X(5 + o), true);
      } else {
        const mx = L.medX;
        if (R.med === 'curb') band(mx - L.med / 2, mx + L.med / 2, '#aeada6');
        else if (R.grp === 'highway') dash(X(mx));
        else { solid(X(mx - 0.13), '#dfb33a'); solid(X(mx + 0.13), '#dfb33a'); }
        for (let j = 0; j < L.fwd.length - 1; j++) dash(X(5 + (L.fwd[j] + L.fwd[j + 1]) / 2));
        for (let j = 0; j < L.back.length - 1; j++) dash(X(5 - (L.back[j] + L.back[j + 1]) / 2));
        for (const o of L.fwd) arrow(X(5 + o), true);
        for (const o of L.back) arrow(X(5 - o), false);
        if (R.tram) for (const x of [5 + L.fwd[0], 5 - L.back[0]]) { solid(X(x - 0.7), '#9095a0'); solid(X(x + 0.7), '#9095a0'); }
      }
    };
    if (R.w === 2) { strip(0, true); strip(10 * S, false); } else strip(0, false);
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${g}</svg>`;
  }

  function pathSvg(P) {
    return `<svg viewBox="0 0 60 44" preserveAspectRatio="none"><rect width="60" height="44" fill="#6b9444"/><rect x="0" y="0" width="30" height="44" fill="#aeada6" opacity="0.35"/><rect x="11" y="0" width="8" height="44" fill="${P.col}"/><rect x="11" y="18" width="38" height="8" fill="${P.col}"/>${P.key === 'shared' ? '<line x1="15" y1="2" x2="15" y2="16" stroke="#f2c230" stroke-dasharray="3 3"/><line x1="22" y1="22" x2="47" y2="22" stroke="#f2c230" stroke-dasharray="3 3"/><rect x="10" y="0" width="1" height="44" fill="#eee"/><rect x="19" y="0" width="1" height="18" fill="#eee"/>' : ''}${P.key === 'bike' ? '<line x1="15" y1="2" x2="15" y2="16" stroke="#fff" stroke-dasharray="3 3"/><line x1="22" y1="22" x2="47" y2="22" stroke="#fff" stroke-dasharray="3 3"/>' : ''}<text x="44" y="11" fill="#fff" font-size="8" text-anchor="middle" opacity="0.8">½</text></svg>`;
  }
  const roadItem = (r) => { const R = C.ROADS[r]; return { name: R.name, cost: U.money(R.cost) + '/tile', unlock: R.unlock, tool: { type: 'road', rt: r }, thumb: roadSvg(R), desc: R.desc + (R.w === 2 ? ' Two tiles wide.' : '') }; };
  const img = u => u ? `<img src="${u}" alt="">` : '';
  const svcThumb = k => { const sv = C.SERVICES[k]; return img(CB.Meshes.thumb('svc:' + k, { kind: 'svc', svc: k, w: sv.size[0], d: sv.size[1] })); };
  const ZONE_SAMPLE = { 1: [1, 2, 3], 2: [2, 2, 3], 3: [2, 2, 4], 4: [1, 2, 3], 5: [2, 2, 3], 6: [2, 3, 3], 7: [2, 2, 3], 8: [2, 2, 4] };
  const zoneThumb = z => { const [w, d, level] = ZONE_SAMPLE[z]; return img(CB.Meshes.thumb('zone:' + z, { kind: 'zone', zone: z, w, d, level, seed: 4242 + z })); };
  const svcItem = (k) => { const sv = C.SERVICES[k]; return { thumb: svcThumb(k), name: sv.name, cost: U.money(sv.cost), unlock: sv.unlock, tool: { type: 'svc', key: k }, icon: SVC_ICON[k] || (sv.cat === 'parks' ? 'park' : sv.cat === 'landmarks' ? 'landmark' : 'police'), col: SVC_COL[sv.cov] || '#555', desc: (sv.desc || '') + ` ${sv.size[0]}×${sv.size[1]} tiles.` }; };
  const CATS = [
    { key: 'roads', name: 'Roads', icon: 'avenue', tabs: C.ROAD_GROUPS.concat([['junction', 'Intersections']]) },
    { key: 'zones', name: 'Zoning', icon: 'zones' },
    { key: 'services', name: 'Services', icon: 'police', tabs: C.SVC_TABS },
    { key: 'parks', name: 'Parks', icon: 'park', tabs: C.PARK_TABS },
    { key: 'transit', name: 'Transit', icon: 'busline', tabs: [['bus', 'Bus'], ['tram', 'Streetcar'], ['train', 'Train'], ['metro', 'Metro']] },
    { key: 'landmarks', name: 'Landmarks', icon: 'landmark' },
  ];
  UI.tab = {};
  function catItems(key, tab) {
    const items = [];
    if (key === 'roads') {
      if (tab === 'junction') {
        items.push({ name: 'Edit Intersection', cost: 'Free', unlock: 0, tool: { type: 'junction' }, icon: 'junction', col: '#3d6b9a', desc: 'Click an intersection to change its control and lane arrows.' });
        items.push({ name: 'Traffic Lights', cost: 'Free', unlock: 0, tool: { type: 'junction', apply: 'lights' }, icon: 'lights', col: '#2f6a3a', desc: 'Click intersections to add signals.' });
        items.push({ name: 'Stop Signs', cost: 'Free', unlock: 0, tool: { type: 'junction', apply: 'stop' }, icon: 'stop', col: '#a83228', desc: 'The smaller road stops. Change which sides in the editor.' });
        items.push({ name: 'All-Way Stop', cost: 'Free', unlock: 0, tool: { type: 'junction', apply: 'allstop' }, icon: 'stop', col: '#7a2a22', desc: 'Everyone stops, first come first served.' });
        items.push({ name: 'Roundabout', cost: 'Free', unlock: 2, tool: { type: 'junction', apply: 'round' }, icon: 'round', col: '#2f5a9a', desc: 'Yield on entry, keep moving.' });
        items.push({ name: 'No Control', cost: 'Free', unlock: 0, tool: { type: 'junction', apply: 'none' }, icon: 'free', col: '#555c66', desc: 'Free-for-all. Fine for quiet streets.' });
        items.push({ name: 'Reset to Auto', cost: 'Free', unlock: 0, tool: { type: 'junction', apply: 'auto' }, icon: 'junction', col: '#444a52', desc: 'Lights on medium and larger roads, nothing on small ones.' });
      } else if (tab === 'path') {
        for (let k = 1; k < C.PATHS.length; k++) { const P = C.PATHS[k]; items.push({ name: P.name, cost: U.money(P.cost) + '/cell', unlock: P.unlock, tool: { type: 'path', pk: k }, thumb: pathSvg(P), desc: P.desc }); }
      } else for (let r = 1; r < C.ROADS.length; r++) if (C.ROADS[r].grp === tab) items.push(roadItem(r));
    } else if (key === 'zones') {
      for (const z of [1, 2, 8, 3, 4, 5, 6, 7]) { const Z = C.ZONES[z]; if (!Z) continue; items.push({ name: Z.name, cost: 'Free', unlock: Z.unlock, tool: { type: 'zone', z }, icon: Z.key, col: Z.color, thumb: zoneThumb(z), tint: Z.color }); }
      items.push({ name: 'Remove Zoning', cost: 'Free', unlock: 0, tool: { type: 'dezone' }, icon: 'dezone', col: '#555c66' });
    } else if (key === 'transit') {
      const TR = C.TRANSIT;
      if (tab === 'bus') {
        items.push({ name: 'Bus Stop', cost: U.money(TR.bus.stopCost), unlock: TR.bus.unlock, tool: { type: 'stop', st: 'bus' }, icon: 'busstop', col: '#2f86e0' });
        items.push({ name: 'Bus Line', cost: U.money(TR.bus.upkeep) + '/bus/mo', unlock: TR.bus.unlock, tool: { type: 'line', lt: 'bus' }, icon: 'busline', col: '#2f86e0', desc: 'Click stops in order, then the first stop again.' });
      } else if (tab === 'tram') {
        for (let r = 1; r < C.ROADS.length; r++) if (C.ROADS[r].tram) items.push(roadItem(r));
        items.push({ name: 'Streetcar Stop', cost: U.money(TR.tram.stopCost), unlock: TR.tram.unlock, tool: { type: 'stop', st: 'tram' }, icon: 'tramstop', col: '#d8642a', desc: 'Goes on roads with tram tracks.' });
        items.push({ name: 'Streetcar Line', cost: U.money(TR.tram.upkeep) + '/car/mo', unlock: TR.tram.unlock, tool: { type: 'line', lt: 'tram' }, icon: 'tramline', col: '#d8642a', desc: 'Click stops in order, then the first stop again.' });
      } else if (tab === 'train') {
        items.push({ name: C.RAIL[1].name, cost: U.money(C.RAIL[1].cost) + '/tile', unlock: TR.rail.unlock, tool: { type: 'rail', rr: 1 }, icon: 'elev', col: '#7a5a9a', desc: C.RAIL[1].desc });
        items.push({ name: 'Train Station', cost: U.money(TR.rail.stopCost), unlock: TR.rail.unlock, tool: { type: 'stop', st: 'rail' }, icon: 'station', col: '#e85d2a' });
        items.push({ name: 'Train Line', cost: U.money(TR.rail.upkeep) + '/train/mo', unlock: TR.rail.unlock, tool: { type: 'line', lt: 'rail' }, icon: 'metro', col: '#e85d2a' });
      } else {
        items.push({ name: C.RAIL[2].name, cost: U.money(C.RAIL[2].cost) + '/tile', unlock: TR.rail.unlock, tool: { type: 'rail', rr: 2 }, icon: 'sub', col: '#5a4a7a', desc: C.RAIL[2].desc });
        items.push({ name: 'Metro Station', cost: U.money(TR.rail.ugStopCost), unlock: TR.rail.unlock, tool: { type: 'stop', st: 'rail' }, icon: 'station', col: '#c8452a' });
        items.push({ name: 'Metro Line', cost: U.money(TR.rail.upkeep) + '/train/mo', unlock: TR.rail.unlock, tool: { type: 'line', lt: 'rail' }, icon: 'metro', col: '#c8452a' });
      }
    } else {
      for (const k in C.SERVICES) { const sv = C.SERVICES[k]; if (sv.cat !== key || (tab && sv.tab !== tab)) continue; items.push(svcItem(k)); }
    }
    return items;
  }
  UI.catItems = catItems;
  const idOf = it => JSON.stringify(it.tool);
  // every buildable item, tagged with its menu and tab
  function allItems() {
    const out = [];
    for (const c of CATS) for (const t of (c.tabs || [[null]])) for (const it of catItems(c.key, t[0])) out.push(Object.assign({ cat: c.key, tab: t[0] }, it));
    return out;
  }
  const isNew = it => (CB.Sim.unseen || []).includes(idOf(it));
  function refreshBadges() {
    const un = new Set(CB.Sim.unseen || []);
    const all = allItems().filter(it => un.has(idOf(it)));
    document.querySelectorAll('#toolbar [data-cat]').forEach(b => b.classList.toggle('new', all.some(it => it.cat === b.dataset.cat)));
    document.querySelectorAll('#palette [data-tab]').forEach(b => b.classList.toggle('new', all.some(it => it.cat === UI.cat && it.tab === b.dataset.tab)));
  }
  UI.refreshBadges = refreshBadges;

  // ---------------- init ----------------
  UI.init = function () {
    const tb = $('toolbar');
    tb.innerHTML = CATS.map(c => `<button class="tbtn" data-cat="${c.key}" title="${c.name}">${svg(c.icon)}<span>${c.name}</span></button>`).join('') +
      '<div class="sep"></div><button class="tbtn danger" id="bdz" title="Bulldoze (B)">' + svg('bulldoze') + '<span>Bulldoze</span></button>';
    tb.querySelectorAll('[data-cat]').forEach(b => b.addEventListener('click', () => UI.openCat(b.dataset.cat === UI.cat ? null : b.dataset.cat)));
    $('bdz').addEventListener('click', () => { const on = CB.Tools.tool.type === 'bulldoze'; UI.openCat(null); CB.Tools.setTool(on ? null : { type: 'bulldoze' }); });
    for (const s of [0, 1, 2, 4]) $('sp' + s).addEventListener('click', () => UI.setSpeed(s));
    document.querySelectorAll('#menu [data-panel]').forEach(b => b.addEventListener('click', () => UI.openPanel(UI.panel === b.dataset.panel ? null : b.dataset.panel)));
    const D = [['rlow', 'L', '#5fcf5a'], ['rmed', 'M', '#2f9e48'], ['rhigh', 'H', '#167a3a'], ['com', 'C', '#59a6f5'], ['ind', 'I', '#f0c43a'], ['off', 'O', '#b276f2']];
    $('demand').innerHTML = D.map(d => `<div class="dbar" id="dm_${d[0]}" title="${d[0]}"><div class="track"><i style="background:${d[2]}"></i></div><span>${d[1]}</span></div>`).join('');
    const titles = { rlow: 'Residential · low density', rmed: 'Residential · medium density', rhigh: 'Residential · high density', com: 'Commercial', ind: 'Industrial', off: 'Office' };
    for (const d of D) $('dm_' + d[0]).title = titles[d[0]] + ' demand';
    setTimeout(refreshBadges, 0);
    document.addEventListener('pointermove', e => { const t = $('tip'); t.style.left = e.clientX + 'px'; t.style.top = e.clientY + 'px'; });
    UI.goalsOpen = true;
    setInterval(UI.update, 250);
  };

  UI.openCat = function (key) {
    UI.cat = key;
    document.querySelectorAll('#toolbar [data-cat]').forEach(b => b.classList.toggle('on', b.dataset.cat === key));
    const p = $('palette');
    if (!key) { p.hidden = true; p.innerHTML = ''; if (CB.Tools.tool.type !== 'bulldoze') CB.Tools.setTool(null); return; }
    const cat = CATS.find(c => c.key === key);
    if (cat.tabs && !UI.tab[key]) UI.tab[key] = cat.tabs[0][0];
    if (CB.Tools.tool.type !== 'select') CB.Tools.setTool(null);
    renderPalette();
    p.hidden = false;
  };
  function tabLocked(cat, tab) { return catItems(cat.key, tab).every(it => !CB.Sim.unlocked(it.unlock)); }
  function renderPalette() {
    const key = UI.cat; if (!key) return;
    const S = CB.Sim, cat = CATS.find(c => c.key === key);
    const tab = cat.tabs ? UI.tab[key] : null;
    const items = catItems(key, tab);
    const p = $('palette');
    const roadMode = key === 'roads' && tab !== 'junction' && tab !== 'path' || key === 'transit' && tab === 'tram';
    const modeSw = roadMode ? `<div class="pmode" title="C cycles modes"><button data-mode="straight" class="${CB.Tools.roadMode === 'straight' ? 'on' : ''}">Straight</button><button data-mode="curve" class="${CB.Tools.roadMode === 'curve' ? 'on' : ''}">Curved</button><button data-mode="sbend" title="Each piece carries on from the direction the last one ended" class="${CB.Tools.roadMode === 'sbend' ? 'on' : ''}">S-bend</button></div>` : '';
    const tabs = cat.tabs ? `<div class="ptabs" role="tablist">${cat.tabs.map(t => `<button role="tab" class="ptab ${t[0] === tab ? 'on' : ''} ${tabLocked(cat, t[0]) ? 'dim' : ''}" data-tab="${t[0]}">${t[1]}</button>`).join('')}${modeSw}</div>` : '';
    p.innerHTML = tabs + `<div class="cards">` + items.map((it, k) => {
      const locked = !S.unlocked(it.unlock);
      return `<button class="card ${locked ? 'locked' : ''}" data-k="${k}" title="${(it.name + (it.desc ? ' — ' + it.desc : '')).replace(/"/g, '&quot;')}">
        ${locked ? `<span class="lock">${C.MILESTONES[it.unlock].pop.toLocaleString()} pop</span>` : isNew(it) ? '<span class="lock newb">New</span>' : ''}
        <div class="sw" style="${it.thumb ? 'background:linear-gradient(#3a4654,#232a33)' : 'background:' + it.col}${it.tint ? ';box-shadow:inset 0 -3px 0 ' + it.tint : ''}">${it.thumb || svg(it.icon)}</div>
        <b>${it.name}</b><small>${locked ? C.MILESTONES[it.unlock].name : it.cost}</small></button>`;
    }).join('') + `</div>`;
    p.dataset.cat = key; p.dataset.tab = tab || '';
    p.querySelectorAll('[data-tab]').forEach(el => el.addEventListener('click', () => { UI.tab[key] = el.dataset.tab; CB.Tools.setTool(null); renderPalette(); }));
    p.querySelectorAll('[data-mode]').forEach(el => el.addEventListener('click', () => CB.Tools.setRoadMode(el.dataset.mode)));
    p.querySelectorAll('.card').forEach(el => el.addEventListener('click', () => {
      const it = items[+el.dataset.k];
      if (!it) return;
      if (!S.unlocked(it.unlock)) { UI.toast('Unlocks at ' + C.MILESTONES[it.unlock].name + ' (' + C.MILESTONES[it.unlock].pop.toLocaleString() + ' residents)', 'bad'); return; }
      if (isNew(it)) { CB.Sim.unseen = CB.Sim.unseen.filter(x => x !== idOf(it)); const nb = el.querySelector('.newb'); if (nb) nb.remove(); refreshBadges(); }
      const same = JSON.stringify(CB.Tools.tool) === JSON.stringify(it.tool);
      CB.Tools.setTool(same ? null : it.tool);
    }));
    markPalette();
    refreshBadges();
  }
  UI.onRoadMode = function () { document.querySelectorAll('#palette [data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === CB.Tools.roadMode)); };
  function markPalette() {
    const p = $('palette');
    if (!UI.cat || p.hidden && !p.children.length) return;
    const cat = CATS.find(c => c.key === UI.cat);
    const items = catItems(UI.cat, cat && cat.tabs ? UI.tab[UI.cat] : null);
    const t = JSON.stringify(CB.Tools.tool);
    p.querySelectorAll('.card').forEach(el => { const it = items[+el.dataset.k]; el.classList.toggle('on', !!it && JSON.stringify(it.tool) === t); });
  }
  UI.onToolChange = function () {
    if (UI.panel === 'transit' && (CB.Tools.tool.type === 'lineEdit') !== !!UI._editing) { UI._editing = CB.Tools.tool.type === 'lineEdit'; UI.refreshTransit(); }
    markPalette();
    $('bdz').classList.toggle('on', CB.Tools.tool.type === 'bulldoze');
    if (CB.Tools.tool.type === 'bulldoze' && UI.cat) { UI.cat = null; $('palette').hidden = true; $('palette').innerHTML = ''; document.querySelectorAll('#toolbar [data-cat]').forEach(b => b.classList.remove('on')); }
  };

  // ---------------- intersection editor ----------------
  const DIRN = ['north', 'east', 'south', 'west'];
  const CTRL = [['auto', 'Auto'], ['none', 'No control'], ['lights', 'Traffic lights'], ['stop', 'Stop signs'], ['allstop', 'All-way stop'], ['round', 'Roundabout']];
  const TURN_BITS = [[4, 'L', 'Left'], [1, 'S', 'Straight'], [2, 'R', 'Right'], [8, 'U', 'U-turn']];
  UI.junctionTile = -1;
  function applyJunction() {
    const Wd = CB.World;
    Wd.updateJunctions(); Wd.roadVer++;
    CB.Meshes.junctionsChanged();
  }
  UI.setJunctionCtrl = function (tile, ctrl) {
    const Wd = CB.World, c = Wd.jcl[tile]; if (c < 0) return;
    Wd.clusters[c].cfg.ctrl = ctrl;
    applyJunction();
  };
  UI.openJunction = function (tile) {
    UI.select(null);
    UI.junctionTile = tile;
    const Wd = CB.World, p = $('infoPanel');
    const c = Wd.jcl[tile];
    if (c < 0) { p.hidden = true; UI.junctionTile = -1; return; }
    const cl = Wd.clusters[c], cfg = cl.cfg;
    p.hidden = false;
    const roads = [...new Set(cl.aps.map(ap => C.ROADS[Wd.road[ap.tile]].name))];
    const ctrlNow = cl.ctrl;
    const label = { none: 'No control', lights: 'Traffic lights', stop: 'Stop signs', allstop: 'All-way stop', round: 'Roundabout' };
    let html = head('Intersection', roads.join(' × ')) +
      `<div class="seg">${CTRL.map(o => `<button data-ctrl="${o[0]}" class="${cfg.ctrl === o[0] ? 'on' : ''}">${o[1]}${o[0] === 'auto' && cfg.ctrl === 'auto' ? ` <small>(${label[ctrlNow]})</small>` : ''}</button>`).join('')}</div>`;
    html += junctionDiagram(cl);
    if (ctrlNow === 'lights') {
      const g = cfg.green || [12, 12];
      html += `<div class="sec"><div class="lbl">Green time</div>
        ${[['North–south', 0], ['East–west', 1]].map(([n, ax]) => `<div class="tax"><label>${n}</label><input type="range" min="5" max="30" value="${g[ax]}" data-green="${ax}"><b class="num">${g[ax]}s</b></div>`).join('')}</div>`;
    }
    if (ctrlNow === 'stop') {
      html += `<div class="sec"><div class="lbl">Who stops</div>${cl.aps.map(ap => `<label class="row"><span>From the ${DIRN[(ap.d + 2) % 4]} · ${C.ROADS[Wd.road[ap.tile]].name}</span><input type="checkbox" data-stopk="${ap.key}" ${CB.Traffic.isStopFor(cl, ap.key) ? 'checked' : ''}></label>`).join('')}</div>`;
    }
    html += `<div class="sec"><div class="lbl">Lane arrows <span style="text-transform:none;letter-spacing:0;font-weight:500">· click to allow or forbid a turn</span></div>`;
    for (const ap of cl.aps) {
      const masks = cfg.lanes[ap.key] || [];
      const avail = cl.avail[ap.d];
      html += `<div class="appr"><div class="an">From the ${DIRN[(ap.d + 2) % 4]} <small>${C.ROADS[Wd.road[ap.tile]].name}</small></div><div class="lanes">` +
        masks.map((m, k) => `<div class="lane" title="Lane ${k + 1} (${k === 0 ? 'rightmost' : k === masks.length - 1 ? 'leftmost' : 'middle'})">${TURN_BITS.map(([bit, l, nm]) => (avail & bit) ? `<button data-ap="${ap.key}" data-lane="${k}" data-bit="${bit}" class="${m & bit ? 'on' : ''}" title="${nm}">${l === 'L' ? '↰' : l === 'S' ? '↑' : l === 'R' ? '↱' : '↶'}</button>` : '').join('')}</div>`).reverse().join('') +
        `</div></div>`;
    }
    html += `</div><div class="btns" style="margin-top:10px"><button class="btn" id="jreset">Reset lanes</button></div>`;
    p.innerHTML = html;
    bindClose(p, () => { UI.junctionTile = -1; p.hidden = true; });
    p.querySelectorAll('[data-ctrl]').forEach(b => b.onclick = () => { cfg.ctrl = b.dataset.ctrl; applyJunction(); UI.openJunction(tile); });
    p.querySelectorAll('[data-green]').forEach(inp => inp.oninput = () => { cfg.green = cfg.green || [12, 12]; cfg.green[+inp.dataset.green] = +inp.value; inp.nextElementSibling.textContent = inp.value + 's'; });
    p.querySelectorAll('[data-stopk]').forEach(cb => cb.onchange = () => { cfg.stops[cb.dataset.stopk] = cb.checked; applyJunction(); UI.openJunction(tile); });
    p.querySelectorAll('[data-ap]').forEach(btn => btn.onclick = () => {
      const k = +btn.dataset.ap, lane = +btn.dataset.lane, bit = +btn.dataset.bit;
      const arr = cfg.lanes[k]; if (!arr) return;
      const nv = arr[lane] ^ bit;
      if (!nv) { UI.toast('Every lane needs at least one direction', 'bad'); return; }
      arr[lane] = nv;
      applyJunction(); UI.openJunction(tile);
    });
    p.querySelector('#jreset').onclick = () => { cfg.lanes = {}; applyJunction(); UI.openJunction(tile); };
  };
  function junctionDiagram(cl) {
    const Wd = CB.World;
    const cx = 80, cy = 80, box = 26;
    let g = `<rect x="${cx - box}" y="${cy - box}" width="${box * 2}" height="${box * 2}" fill="#3c3f44"/>`;
    const st = cl.ctrl;
    for (let d = 0; d < 4; d++) {
      const aps = cl.aps.filter(a => a.d === (d + 2) % 4), exs = cl.exits.filter(e => e.d === d);
      if (!aps.length && !exs.length) continue;
      const fx = C.DX[d], fy = C.DY[d];
      const x0 = cx + fx * box, y0 = cy + fy * box;
      const w = 22;
      const rx = fx ? (fx > 0 ? x0 : x0 - 50) : cx - w, ry = fy ? (fy > 0 ? y0 : y0 - 50) : cy - w;
      g += `<rect x="${rx}" y="${ry}" width="${fx ? 50 : w * 2}" height="${fy ? 50 : w * 2}" fill="#4a4e55"/>`;
      // approach arrows
      for (const ap of aps) {
        const m = (cl.cfg.lanes[ap.key] || []).reduce((a, b) => a | b, 0);
        const lab = (m & 4 ? '↰' : '') + (m & 1 ? '↑' : '') + (m & 2 ? '↱' : '') + (m & 8 ? '↶' : '');
        const tx = cx + fx * (box + 30) + (fy ? -fy * 10 : 0), ty = cy + fy * (box + 30) + (fx ? fx * 10 : 0) + 5;
        const rot = [180, 270, 0, 90][d];
        g += `<text x="${tx}" y="${ty}" fill="#fff" font-size="13" text-anchor="middle" transform="rotate(${rot} ${tx} ${ty - 5})">${lab}</text>`;
        if (st === 'lights') g += `<circle cx="${cx + fx * (box + 6) + (fy ? -fy * 16 : 0)}" cy="${cy + fy * (box + 6) + (fx ? fx * 16 : 0)}" r="4" fill="#28e05a"/>`;
        if ((st === 'stop' || st === 'allstop') && CB.Traffic.isStopFor(cl, ap.key)) g += `<polygon points="${oct(cx + fx * (box + 6) + (fy ? -fy * 16 : 0), cy + fy * (box + 6) + (fx ? fx * 16 : 0), 5)}" fill="#c8231c"/>`;
      }
    }
    if (st === 'round') g += `<circle cx="${cx}" cy="${cy}" r="11" fill="#5d8c3c" stroke="#aeada6" stroke-width="2"/>`;
    return `<svg class="jdia" viewBox="0 0 160 160">${g}</svg>`;
  }
  function oct(x, y, r) { const p = []; for (let k = 0; k < 8; k++) { const a = Math.PI / 8 + k * Math.PI / 4; p.push((x + Math.cos(a) * r).toFixed(1) + ',' + (y + Math.sin(a) * r).toFixed(1)); } return p.join(' '); }

  UI.setSpeed = function (s) {
    if (s > 0) UI.lastSpeed = s;
    CB.Sim.speed = s;
    for (const k of [0, 1, 2, 4]) $('sp' + k).classList.toggle('on', k === s);
  };

  // ---------------- toasts / sfx ----------------
  UI.toast = function (text, kind) {
    const el = document.createElement('div');
    el.className = 'glass toast ' + (kind || '');
    el.textContent = text;
    $('toasts').appendChild(el);
    setTimeout(() => el.remove(), kind === 'bad' ? 3800 : 4600);
    while ($('toasts').children.length > 5) $('toasts').firstChild.remove();
  };
  let actx = null;
  UI.sfx = function (kind) {
    try {
      if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      const f = { build: 520, zone: 660, demolish: 180, click: 880 }[kind] || 600;
      o.type = kind === 'demolish' ? 'sawtooth' : 'triangle';
      o.frequency.setValueAtTime(f, actx.currentTime);
      o.frequency.exponentialRampToValueAtTime(f * (kind === 'demolish' ? 0.5 : 1.5), actx.currentTime + 0.09);
      g.gain.setValueAtTime(0.045, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.14);
      o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + 0.15);
    } catch (e) { /* audio unavailable */ }
  };

  UI.milestone = function (m) {
    const idx = C.MILESTONES.indexOf(m);
    const seen = new Set();
    const items = allItems().filter(it => it.unlock === idx && !seen.has(idOf(it)) && seen.add(idOf(it)));
    const S = CB.Sim;
    for (const it of items) if (!S.unseen.includes(idOf(it))) S.unseen.push(idOf(it));
    const catName = k => CATS.find(c => c.key === k).name;
    const show = items.slice(0, 18);
    const M = $('modal');
    M.innerHTML = `<div class="glass mbox wide"><div class="eyebrow">Milestone reached</div><h2>${m.name}</h2>
      <p>${S.name} now has ${m.pop.toLocaleString()} residents. The city treasury receives a grant of <b style="color:var(--accent-2)">${U.money(m.reward)}</b>.</p>
      ${show.length ? `<div class="lbl" style="text-align:left;margin-bottom:6px">Unlocked</div><div class="unl">${show.map(it => `<div class="ucard"><div class="sw" style="${it.thumb ? 'background:linear-gradient(#3a4654,#232a33)' : 'background:' + it.col}">${it.thumb || svg(it.icon)}</div><b>${it.name}</b><small>${catName(it.cat)}</small></div>`).join('')}</div>${items.length > show.length ? `<div class="sub" style="margin-top:6px">and ${items.length - show.length} more</div>` : ''}` : ''}
      <button class="btn primary" id="mok" style="margin-top:14px">Keep building</button></div>`;
    M.hidden = false;
    $('mok').onclick = () => { M.hidden = true; renderPalette(); refreshBadges(); };
    refreshBadges();
    UI.sfx('build');
  };

  // ---------------- side panels ----------------
  UI.openPanel = function (key) {
    if (UI.panel === 'transit' && key !== 'transit') { const tt = CB.Tools.tool.type; CB.Transit.showRibbons(UI.overlay === 'transit' || ['line', 'stop', 'rail', 'lineEdit'].includes(tt), tt === 'lineEdit' ? CB.Transit.lineById(CB.Tools.tool.line) : null); }
    UI.panel = key;
    document.querySelectorAll('#menu [data-panel]').forEach(b => b.classList.toggle('on', b.dataset.panel === key));
    const p = $('sidePanel');
    if (!key) { p.hidden = true; return; }
    p.hidden = false;
    PANELS[key](p);
  };
  UI.closePanels = function () { UI.openPanel(null); };
  const head = (title, sub) => `<div class="phead"><div><h3>${title}</h3>${sub ? `<div class="sub">${sub}</div>` : ''}</div><button class="x" data-close aria-label="Close">×</button></div>`;
  function bindClose(p, fn) { p.querySelector('[data-close]').onclick = fn; }
  function sv(root, k, v) { const e = root.querySelector(`[data-v="${k}"]`); if (e && e.textContent !== String(v)) e.textContent = v; }
  function sm(root, k, frac, col) { const e = root.querySelector(`[data-m="${k}"]`); if (e) { e.style.width = (U.clamp(frac, 0, 1) * 100).toFixed(1) + '%'; if (col) e.style.background = col; } }
  const goodCol = f => f > 0.66 ? 'var(--good)' : f > 0.4 ? 'var(--warn)' : 'var(--bad)';
  const meter = k => `<div class="meter"><i data-m="${k}"></i></div>`;

  const VIEWS = [
    [null, 'None', '#555'], ['traffic', 'Traffic', 'linear-gradient(90deg,#3fd65a,#e6c833,#e6332a)'], ['lv', 'Land value', 'linear-gradient(90deg,#e6332a,#3fd65a)'],
    ['happy', 'Happiness', 'linear-gradient(90deg,#e6332a,#3fd65a)'], ['pollution', 'Pollution', '#8a5a2a'], ['noise', 'Noise', '#c85ad8'],
    ['police', 'Police', '#2c5aa0'], ['fire', 'Fire', '#b8322a'], ['health', 'Health', '#c8323e'],
    ['edu', 'Education', '#a0632f'], ['garbage', 'Garbage', '#4d7a4a'], ['park', 'Parks', '#3f8a3a'], ['transit', 'Transit', '#2f86e0'],
  ];
  const PANELS = {};
  PANELS.views = function (p) {
    p.innerHTML = head('Info views', 'Color the city by one statistic') +
      `<div class="views">${VIEWS.map(v => `<button data-ov="${v[0] || ''}" class="${(UI.overlay || '') === (v[0] || '') ? 'on' : ''}"><i style="background:${v[2]}"></i>${v[1]}</button>`).join('')}</div>
      <div class="sec"><div class="legend"><span>Poor</span><span class="grad"></span><span>Good</span></div>
      <div class="sub" style="font-size:12px;line-height:1.4">Traffic view: green roads flow freely, red roads are jammed. Coverage views show how far each service building reaches.</div></div>`;
    bindClose(p, () => UI.openPanel(null));
    p.querySelectorAll('[data-ov]').forEach(b => b.onclick = () => { UI.setOverlay(b.dataset.ov || null); PANELS.views(p); });
  };
  UI.setOverlay = function (k) {
    UI.overlay = k;
    CB.Gfx.uni.uOvOn.value = k ? 1 : 0;
    CB.Transit.showRibbons(k === 'transit' || ['line', 'stop', 'rail'].includes(CB.Tools.tool.type));
    if (k) refreshOverlay();
  };
  function refreshOverlay() { if (UI.overlay) CB.Meshes.writeOverlay(CB.Sim.overlayFn(UI.overlay)); }

  PANELS.budget = function (p) {
    const S = CB.Sim;
    const rowsI = [['res', 'Residential tax'], ['com', 'Commercial tax'], ['ind', 'Industrial tax'], ['off', 'Office tax'], ['fares', 'Transit fares']];
    const rowsE = [['services', 'City services'], ['roads', 'Road & track upkeep'], ['transit', 'Transit vehicles'], ['utilities', 'Water & power (automatic)'], ['loans', 'Loan payments']];
    p.innerHTML = head('Budget', 'Monthly figures.') +
      `<table class="bud"><tr><td class="lbl">Income</td><td class="lbl">This month</td><td class="lbl">Last month</td></tr>
      ${rowsI.map(r => `<tr><td>${r[1]}</td><td data-v="ti_${r[0]}"></td><td data-v="li_${r[0]}"></td></tr>`).join('')}
      <tr><td class="lbl" style="padding-top:8px">Expenses</td><td></td><td></td></tr>
      ${rowsE.map(r => `<tr><td>${r[1]}</td><td data-v="te_${r[0]}"></td><td data-v="le_${r[0]}"></td></tr>`).join('')}
      <tr class="tot"><td>Net</td><td data-v="tnet"></td><td data-v="lnet"></td></tr></table>
      <div class="sec"><div class="lbl">Tax rates</div>
      ${[['res', 'Residential'], ['com', 'Commercial'], ['ind', 'Industrial'], ['off', 'Office']].map(t => `<div class="tax"><label for="tax_${t[0]}">${t[1]}</label><input type="range" id="tax_${t[0]}" min="0" max="30" value="${S.tax[t[0]]}"><b class="num" data-v="tx_${t[0]}">${S.tax[t[0]]}%</b></div>`).join('')}
      <div class="sub" style="font-size:12px">Higher taxes bring in more money but lower demand and happiness. 10% is neutral.</div></div>
      <div class="sec"><div class="lbl">Loans</div><div data-v="loans" class="sub"></div><div id="loanList" style="display:grid;gap:6px"></div>
      <div class="btns">${[25000, 50000, 100000].map(a => `<button class="btn" data-loan="${a}">Borrow ${U.money(a)}</button>`).join('')}</div>
      <div class="sub" style="font-size:12px">Repaid over 24 months with 12% interest. Up to 3 loans at once.</div></div>`;
    bindClose(p, () => UI.openPanel(null));
    for (const t of ['res', 'com', 'ind', 'off']) {
      const inp = p.querySelector('#tax_' + t);
      inp.oninput = () => { S.tax[t] = +inp.value; sv(p, 'tx_' + t, inp.value + '%'); };
    }
    p.querySelectorAll('[data-loan]').forEach(b => b.onclick = () => { if (!S.takeLoan(+b.dataset.loan)) UI.toast('You can only hold 3 loans at once.', 'bad'); renderLoans(p); });
    renderLoans(p);
    updBudget(p);
  };
  function renderLoans(p) {
    const S = CB.Sim, L = p.querySelector('#loanList'); if (!L) return;
    L.innerHTML = S.loans.map((l, k) => `<div class="row"><span>${U.money(l.amount)} · ${l.left} months left · ${U.money(l.payment)}/mo</span><button class="btn" data-repay="${k}">Repay ${U.money(l.payment * l.left)}</button></div>`).join('') || '<div class="sub">No loans.</div>';
    L.querySelectorAll('[data-repay]').forEach(b => b.onclick = () => { if (!S.repayLoan(+b.dataset.repay)) UI.toast('Not enough money to repay this loan.', 'bad'); renderLoans(p); });
  }
  function updBudget(p) {
    const S = CB.Sim, B = S.budget, L = S.last;
    let ti = 0, te = 0, li = 0, le = 0;
    for (const k in B.inc) { sv(p, 'ti_' + k, U.money(B.inc[k])); sv(p, 'li_' + k, S.month ? U.money(L.inc[k]) : '–'); ti += B.inc[k]; li += L.inc[k]; }
    for (const k in B.exp) { sv(p, 'te_' + k, U.money(-B.exp[k])); sv(p, 'le_' + k, S.month ? U.money(-L.exp[k]) : '–'); te += B.exp[k]; le += L.exp[k]; }
    sv(p, 'tnet', U.money(ti - te)); sv(p, 'lnet', S.month ? U.money(li - le) : '–');
  }

  PANELS.transit = function (p) {
    const X = CB.Transit, S = CB.Sim;
    const busOK = S.unlocked(C.TRANSIT.bus.unlock), railOK = S.unlocked(C.TRANSIT.rail.unlock), tramOK = S.unlocked(C.TRANSIT.tram.unlock);
    p.innerHTML = head('Public transport', 'Every line, its vehicles, colour and fares') +
      `<div class="row"><span>Riders last month</span><b data-v="riders"></b></div>
       <div class="row"><span>Trips by transit</span><b data-v="share"></b></div>
       <div class="row"><span>Waiting at stops</span><b data-v="waiting"></b></div>
       <div class="btns" style="margin-top:8px"><button class="btn primary" id="nbus" ${busOK ? '' : 'disabled'}>New bus line</button><button class="btn primary" id="ntram" ${tramOK ? '' : 'disabled'}>New streetcar line</button><button class="btn primary" id="nrail" ${railOK ? '' : 'disabled'}>New metro line</button></div>
       <div class="sec tlines" id="lineList"></div>`;
    bindClose(p, () => UI.openPanel(null));
    p.querySelector('#nbus').onclick = () => { UI.tab.transit = 'bus'; UI.openCat('transit'); CB.Tools.setTool({ type: 'line', lt: 'bus' }); };
    p.querySelector('#ntram').onclick = () => { UI.tab.transit = 'tram'; UI.openCat('transit'); CB.Tools.setTool({ type: 'line', lt: 'tram' }); };
    p.querySelector('#nrail').onclick = () => { UI.tab.transit = 'metro'; UI.openCat('transit'); CB.Tools.setTool({ type: 'line', lt: 'rail' }); };
    X.showRibbons(true);
    renderLines(p);
    updTransit(p);
  };
  const TYPE_NAME = { bus: 'Bus', tram: 'Streetcar', rail: 'Metro' };
  function renderLines(p) {
    const X = CB.Transit, L = p.querySelector('#lineList'); if (!L) return;
    const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    L.innerHTML = X.lines.length ? X.lines.map(l => {
      const editing = CB.Tools.tool.type === 'lineEdit' && CB.Tools.tool.line === l.id;
      return `<div class="tline ${l.broken ? 'broken' : ''} ${editing ? 'editing' : ''}" data-l="${l.id}">
      <div class="tl-head"><input type="color" value="${l.color}" data-a="col" title="Line colour"><input class="tl-name" value="${esc(l.name)}" data-a="name" maxlength="28"><span class="chip">${TYPE_NAME[l.type]}</span><button class="ib" data-a="v" title="Show on the map">◎</button><button class="ib" data-a="x" title="Delete line">×</button></div>
      <div class="tl-grid">
        <span>${l.type === 'rail' ? 'Trains' : l.type === 'tram' ? 'Streetcars' : 'Buses'}</span><div class="stepper"><button data-a="-">−</button><b data-v="lv_${l.id}"></b><button data-a="+">+</button></div>
        <span>Ticket price</span><div class="stepper"><button data-a="f-">−</button><b data-v="lf_${l.id}"></b><button data-a="f+">+</button></div>
        <span>Riders</span><b data-v="lr_${l.id}"></b>
        <span>Every</span><b data-v="lh_${l.id}"></b>
        <span>Upkeep</span><b data-v="lu_${l.id}"></b>
      </div>
      <div class="tl-stops">${l.stops.map(id => { const s = X.stopById(id); return s ? `<button class="sstop" data-s="${s.id}" title="Show ${esc(s.name)}"><i style="background:${l.color}"></i>${esc(s.name)}</button>` : ''; }).join('<span class="arr">›</span>')}</div>
      <div class="btns"><button class="btn ${editing ? 'primary' : ''}" data-a="edit">${editing ? 'Done editing' : 'Edit route'}</button></div>
      ${l.broken ? '<div class="sub bad">Broken route: a stop can no longer be reached. Edit the route or fix the roads.</div>' : ''}
    </div>`; }).join('')
      : '<div class="sub">No lines yet. Pick a line tool, click stops in order (each stop sits on the side of the road you click), then click the first stop again to close the loop.</div>';
    L.querySelectorAll('.tline').forEach(el => {
      const l = X.lineById(+el.dataset.l);
      el.querySelectorAll('[data-a]').forEach(b => {
        const a = b.dataset.a;
        if (a === 'col') { b.oninput = () => { X.setColor(l, b.value); el.querySelectorAll('.sstop i').forEach(i => i.style.background = b.value); }; return; }
        if (a === 'name') { b.onchange = () => { l.name = b.value.trim() || l.name; UI.refreshTransit(); }; b.onkeydown = e => e.stopPropagation(); return; }
        b.onclick = () => {
          if (a === '+') X.setVehicles(l, l.vehicles + 1);
          else if (a === '-') X.setVehicles(l, l.vehicles - 1);
          else if (a === 'f+') X.setFare(l, X.fareOf(l) + 0.5);
          else if (a === 'f-') X.setFare(l, X.fareOf(l) - 0.5);
          else if (a === 'x') { if (CB.Tools.tool.line === l.id) CB.Tools.setTool(null); X.deleteLine(l); renderLines(p); return; }
          else if (a === 'v') { const s = X.stopById(l.stops[0]); if (s) CB.Gfx.focus((U.tx(s.tile) + 0.5) * C.TILE, (U.ty(s.tile) + 0.5) * C.TILE, 500); X.showRibbons(true, l); }
          else if (a === 'edit') {
            const on = CB.Tools.tool.type === 'lineEdit' && CB.Tools.tool.line === l.id;
            CB.Tools.setTool(on ? null : { type: 'lineEdit', line: l.id });
            if (!on) UI.toast('Editing ' + l.name + ': click a stop on it to remove it, click a road to add a stop. Esc when done.', 'good');
            renderLines(p); return;
          }
          updTransit(p);
        };
      });
      el.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { const s = X.stopById(+b.dataset.s); if (s) { CB.Gfx.focus((U.tx(s.tile) + 0.5) * C.TILE, (U.ty(s.tile) + 0.5) * C.TILE, 260); UI.selectStop(s); } });
    });
  }
  UI.refreshTransit = function () { if (UI.panel === 'transit') renderLines($('sidePanel')); };
  function updTransit(p) {
    const X = CB.Transit, S = CB.Sim;
    let r = 0; for (const l of X.lines) r += l.ridersLast || 0;
    sv(p, 'riders', U.num(r));
    sv(p, 'share', Math.round(S.stats.transitShare * 100) + '%');
    sv(p, 'waiting', U.num(X.stats.waiting));
    for (const l of X.lines) {
      sv(p, 'lv_' + l.id, l.vehicles);
      sv(p, 'lf_' + l.id, '$' + X.fareOf(l).toFixed(2));
      sv(p, 'lr_' + l.id, U.num(l.ridersMonth) + ' this month · ' + U.num(l.ridersLast || 0) + ' last');
      sv(p, 'lh_' + l.id, l.loopTime ? Math.max(1, Math.round(l.loopTime / l.vehicles * 60 / C.HOUR_SEC)) + ' min' : '–');
      sv(p, 'lu_' + l.id, U.money(l.vehicles * C.TRANSIT[l.type].upkeep) + '/mo');
    }
  }

  PANELS.stats = function (p) {
    p.innerHTML = head('City statistics', '') +
      `<div class="lbl">Population</div><canvas class="spark" id="spPop" width="600" height="112"></canvas>
       <div class="lbl" style="margin-top:6px">Funds</div><canvas class="spark" id="spMoney" width="600" height="112"></canvas>
       <div class="sec">
       <div class="row"><span>Jobs filled</span><b data-v="jobs"></b></div>
       <div class="row"><span>Unemployment</span><b data-v="unemp"></b></div>
       <div class="row"><span>Commuters from out of town</span><b data-v="cin"></b></div>
       <div class="row"><span>Education coverage</span><b data-v="edu"></b></div>
       <div class="row"><span>Average commute</span><b data-v="comm"></b></div>
       <div class="row"><span>Traffic flow</span><b data-v="flow"></b></div>
       <div class="row"><span>Vehicles on the road</span><b data-v="veh"></b></div>
       <div class="row"><span>Cyclists / pedestrians</span><b data-v="soft"></b></div>
       <div class="row"><span>How people get around</span><b data-v="modes"></b></div>
       <div class="row"><span>Cars that gave up (gridlock)</span><b data-v="stuck"></b></div>
       <div class="row"><span>Buildings</span><b data-v="bcount"></b></div></div>`;
    bindClose(p, () => UI.openPanel(null));
    updStats(p);
  };
  function spark(cv, vals, col) {
    if (!cv) return;
    const g = cv.getContext('2d'), w = cv.width, h = cv.height;
    g.clearRect(0, 0, w, h);
    if (vals.length < 2) { g.fillStyle = '#93a4b4'; g.font = '22px Barlow, sans-serif'; g.fillText('Shown after the first month', 8, h / 2 + 6); return; }
    const mx = Math.max(...vals), mn = Math.min(0, ...vals), rg = mx - mn || 1;
    g.strokeStyle = 'rgba(160,190,215,0.15)'; g.lineWidth = 1;
    for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(0, h * k / 4); g.lineTo(w, h * k / 4); g.stroke(); }
    g.beginPath();
    vals.forEach((v, k) => { const x = k / (vals.length - 1) * (w - 8) + 4, y = h - 6 - (v - mn) / rg * (h - 14); k ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.strokeStyle = col; g.lineWidth = 3; g.stroke();
    g.lineTo(w - 4, h); g.lineTo(4, h); g.closePath(); g.fillStyle = col + '30'; g.fill();
    const lv = vals[vals.length - 1], ly = h - 6 - (lv - mn) / rg * (h - 14);
    g.fillStyle = col; g.beginPath(); g.arc(w - 4, ly, 5, 0, 7); g.fill();
  }
  function updStats(p) {
    const S = CB.Sim, st = S.stats, Tr = CB.Traffic;
    sv(p, 'jobs', U.num(st.filled + st.outsideIn) + ' / ' + U.num(st.jobs));
    sv(p, 'unemp', (st.unemp * 100).toFixed(1) + '%');
    sv(p, 'cin', U.num(st.outsideIn));
    sv(p, 'edu', Math.round(st.edu * 100) + '%');
    sv(p, 'comm', st.commute ? Math.round(st.commute * 60 / C.HOUR_SEC) + ' min' : '–');
    sv(p, 'flow', Math.round(Tr.stats.flow * 100) + '%');
    sv(p, 'veh', U.num(Tr.stats.active));
    sv(p, 'stuck', U.num(Tr.stats.stuck));
    sv(p, 'soft', U.num(Tr.stats.bikes) + ' / ' + U.num(Tr.stats.peds));
    const M = Tr.mode, tot = M.car + M.transit + M.bike + M.walk || 1;
    sv(p, 'modes', `🚗 ${Math.round(M.car / tot * 100)}%  🚌 ${Math.round(M.transit / tot * 100)}%  🚲 ${Math.round(M.bike / tot * 100)}%  🚶 ${Math.round(M.walk / tot * 100)}%`);
    sv(p, 'bcount', U.num(st.buildingCount));
    const hist = S.history.concat([{ pop: st.pop, money: S.money }]);
    spark(p.querySelector('#spPop'), hist.map(h => h.pop), '#5fcf5a');
    spark(p.querySelector('#spMoney'), hist.map(h => h.money), '#ffb547');
  }

  PANELS.settings = function (p) {
    const s = CB.Gfx.settings;
    const opt = (id, label, opts, val) => `<label for="${id}">${label}</label><select id="${id}">${opts.map(o => `<option value="${o[0]}" ${String(o[0]) === String(val) ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>`;
    p.innerHTML = head('Settings', 'Graphics changes apply immediately') +
      `<div class="set">
        ${opt('st_preset', 'Quality preset', [['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['ultra', 'Ultra'], ['custom', 'Custom']], s.preset)}
        ${opt('st_res', 'Render resolution', [[0.5, '50%'], [0.7, '70%'], [1, '100%'], [1.25, '125%'], [1.5, '150%'], [2, 'Native (max 200%)']], s.res)}
        ${opt('st_shadows', 'Shadows', [[0, 'Off'], [1024, 'Low'], [2048, 'Medium'], [4096, 'High']], s.shadows)}
        ${opt('st_aa', 'Anti-aliasing', [[0, 'Off'], [1, 'On']], s.aa ? 1 : 0)}
        ${opt('st_view', 'View distance', [[1100, 'Near'], [1700, 'Medium'], [2400, 'Far'], [3200, 'Very far']], s.view)}
        ${opt('st_cars', 'Vehicle limit', [[150, '150'], [250, '250'], [500, '500'], [900, '900'], [1400, '1,400'], [2000, '2,000']], s.cars)}
        ${opt('st_detail', 'Vehicle & people detail', [[0, 'Simple'], [1, 'Detailed']], s.detail ? 1 : 0)}
        ${opt('st_trees', 'Tree density', [[0.2, 'Sparse'], [0.35, 'Low'], [0.7, 'Medium'], [1, 'High'], [1.4, 'Lush']], s.trees)}
        ${opt('st_lighting', 'Lighting', [['simple', 'Simple (fast)'], ['pbr', 'Realistic']], s.lighting)}
        ${opt('st_water', 'Water', [['simple', 'Still'], ['waves', 'Animated waves']], s.water)}
        ${opt('st_dayNight', 'Day & night cycle', [[1, 'On'], [0, 'Off (always day)']], s.dayNight ? 1 : 0)}
        ${opt('st_fps', 'Show FPS', [[0, 'Off'], [1, 'On']], s.fps ? 1 : 0)}
      </div>
      <div class="sub" style="font-size:12px;margin-top:6px">The vehicle limit also caps how much traffic is simulated. Lower it if the game stutters in a big city.</div>
      <div class="sec"><div class="lbl">Game</div><div class="btns"><button class="btn" id="st_save">Save now</button><button class="btn danger" id="st_new">Start a new city</button></div><div id="st_confirm"></div></div>
      <div class="sec"><div class="lbl">Controls</div><div class="keys">
        <kbd>W A S D</kbd><span>Move the camera (Shift for faster)</span><kbd>Q / E</kbd><span>Rotate</span><kbd>R / F</kbd><span>Zoom in and out</span><kbd>T / G</kbd><span>Tilt</span>
        <kbd>Right-drag</kbd><span>Rotate and tilt</span><kbd>Middle-drag</kbd><span>Pan</span><kbd>Wheel</kbd><span>Zoom</span>
        <kbd>Space</kbd><span>Pause</span><kbd>1 2 3</kbd><span>Game speed</span><kbd>B</kbd><span>Bulldoze</span><kbd>C</kbd><span>Road mode: straight, curved, S-bend</span><kbd>R</kbd><span>Rotate a building before placing it</span><kbd>Esc</kbd><span>Cancel tool</span></div></div>`;
    bindClose(p, () => UI.openPanel(null));
    p.querySelectorAll('select').forEach(sel => sel.onchange = () => {
      const k = sel.id.slice(3);
      const ns = Object.assign({}, CB.Gfx.settings);
      if (k === 'preset') {
        if (sel.value !== 'custom') Object.assign(ns, C.QUALITY[sel.value], { preset: sel.value });
        else ns.preset = 'custom';
      } else {
        let v = sel.value;
        if (['res', 'shadows', 'view', 'cars', 'trees'].includes(k)) v = +v;
        if (['aa', 'dayNight', 'fps', 'detail'].includes(k)) v = v === '1';
        ns[k] = v; ns.preset = 'custom';
      }
      CB.Game.applySettings(ns);
      PANELS.settings(p);
    });
    p.querySelector('#st_save').onclick = () => { if (CB.Game.save()) UI.toast('City saved.', 'good'); };
    p.querySelector('#st_new').onclick = () => {
      const c = p.querySelector('#st_confirm');
      c.innerHTML = `<div class="chip bad" style="margin-top:6px">This replaces your saved city.</div><div class="btns" style="margin-top:6px"><button class="btn danger" id="st_yes">Yes, start over</button><button class="btn" id="st_no">Keep playing</button></div>`;
      c.querySelector('#st_yes').onclick = () => CB.Game.showStart(true);
      c.querySelector('#st_no').onclick = () => { c.innerHTML = ''; };
    };
  };

  // ---------------- selection panels ----------------
  UI.select = function (b) {
    UI.junctionTile = -1;
    UI.selected = b; UI.selVehicle = null; UI.selStop = null; UI.follow = false;
    clearPathRibbon();
    CB.Meshes.setSelection(b);
    const p = $('infoPanel');
    if (!b) { p.hidden = true; return; }
    p.hidden = false;
    renderBuilding(p, b);
  };
  UI.selectVehicle = function (v) {
    UI.select(null);
    UI.selVehicle = v;
    const p = $('infoPanel'); p.hidden = false;
    const names = { tram: 'Streetcar', car: 'Car', suv: 'SUV', van: 'Moving van', truck: 'Delivery truck', bus: 'Bus', police: 'Police car', ambulance: 'Ambulance', fire: 'Fire truck', garbage: 'Garbage truck' };
    p.innerHTML = head(names[v.kind] || 'Vehicle', v.line ? v.line.name : v.purpose) +
      `<div class="row"><span>Status</span><b data-v="status"></b></div>
       <div class="row"><span>Speed</span><b data-v="spd"></b></div>
       <div class="row"><span>Road</span><b data-v="road"></b></div>
       <div class="row"><span>Lane</span><b data-v="lane"></b></div>
       ${v.line ? '<div class="row"><span>Passengers</span><b data-v="pax"></b></div>' : '<div class="row"><span>Time on the road</span><b data-v="trip"></b></div>'}
       <div class="btns" style="margin-top:8px"><button class="btn primary" id="vfollow">Follow</button></div>`;
    bindClose(p, () => { UI.selVehicle = null; UI.follow = false; clearPathRibbon(); p.hidden = true; });
    p.querySelector('#vfollow').onclick = () => { UI.follow = !UI.follow; p.querySelector('#vfollow').textContent = UI.follow ? 'Stop following' : 'Follow'; };
    drawPathRibbon(v);
    updVehicle(p);
  };
  function drawPathRibbon(v) {
    clearPathRibbon();
    if (v.loop) return;
    const Wd = CB.World, pts = [];
    for (let k = v.seg; k < v.path.length; k++) { const i = v.path[k]; const x = (U.tx(i) + 0.5) * C.TILE, z = (U.ty(i) + 0.5) * C.TILE; pts.push(x, Wd.roadH(x, z) + 1.2, z); }
    UI.pathRibbon = CB.Meshes.ribbon(pts, 1.4, '#9fd3ff', false);
    if (UI.pathRibbon) CB.Gfx.scene.add(UI.pathRibbon);
  }
  function clearPathRibbon() { if (UI.pathRibbon) { CB.Gfx.scene.remove(UI.pathRibbon); UI.pathRibbon.geometry.dispose(); UI.pathRibbon = null; } }
  function updVehicle(p) {
    const v = UI.selVehicle; if (!v) return;
    if (!CB.Traffic.vehicles.includes(v)) { sv(p, 'status', 'Arrived'); UI.follow = false; clearPathRibbon(); return; }
    const kmh = Math.round(v.speed / C.VEH_SPEED * 3.6);
    sv(p, 'status', v.dwell > 0 ? 'At a stop' : v.speed < 0.5 ? 'Waiting in traffic' : 'Driving');
    sv(p, 'spd', kmh + ' km/h');
    const rt = CB.World.road[v.cur];
    sv(p, 'road', rt ? C.ROADS[rt].name : '–');
    const nl = CB.World.lanesToward(v.cur, v.din).length;
    sv(p, 'lane', nl > 1 ? 'Lane ' + (v.laneIn + 1) + ' of ' + nl + (v.laneIn === 0 ? ' (right)' : v.laneIn === nl - 1 ? ' (left)' : '') : 'Single lane');
    sv(p, 'trip', Math.round((CB.Traffic.time - v.born) * 60 / C.HOUR_SEC) + ' min');
    if (v.line) sv(p, 'pax', (v.load || 0) + ' / ' + C.TRANSIT[v.line.type].cap);
  }
  UI.selectStop = function (s) {
    UI.select(null);
    UI.selStop = s;
    const p = $('infoPanel'); p.hidden = false;
    const lines = CB.Transit.lines.filter(l => l.stops.includes(s.id));
    p.innerHTML = head(s.name, s.type === 'bus' ? 'Bus stop' : s.type === 'tram' ? 'Streetcar stop' : (CB.World.rail[s.tile] === 2 ? 'Underground station' : 'Elevated station')) +
      `<div class="row"><span>Waiting passengers</span><b data-v="wait"></b></div>
       <div class="sec">${lines.length ? lines.map(l => `<div class="row"><span><span class="chip" style="background:${l.color}33;color:#fff">${l.name}</span></span><b>${l.vehicles} ${({ bus: 'buses', tram: 'streetcars', rail: 'trains' })[l.type]}</b></div>`).join('') : '<div class="sub">No line serves this stop yet.</div>'}</div>
       <div class="btns" style="margin-top:10px"><button class="btn danger" id="sdel">Remove stop</button></div>`;
    bindClose(p, () => { UI.selStop = null; p.hidden = true; });
    p.querySelector('#sdel').onclick = () => { CB.Transit.removeStop(s); UI.selStop = null; p.hidden = true; UI.refreshTransit(); };
    sv(p, 'wait', s.waiting.reduce((a, q) => a + q.n, 0));
  };

  const PROB = {
    noroad: ['No road access', 'Connect a road to the front of this building.'],
    noconn: ['Not connected to the highway', 'Residents and goods cannot reach this building. Connect its road to the rest of the city.'],
    garbage: ['Garbage is piling up', 'Build a Waste Transfer Station within range.'],
    workers: ['Not enough workers', 'More housing nearby, or better transit, will fill these jobs.'],
    customers: ['Not enough customers', 'Shops need residents nearby. Zone more housing or add transit.'],
    fire: ['On fire', 'A fire truck is needed. Build a Fire Station within range.'],
  };
  function renderBuilding(p, b) {
    const S = CB.Sim;
    if (b.kind === 'svc') {
      const s = C.SERVICES[b.svc];
      p.innerHTML = head(s.name, s.desc) +
        `<div class="row"><span>Upkeep</span><b>${U.money(s.upkeep)} / month</b></div>
         ${s.cov !== 'landmark' && s.cov !== 'park' ? `<div class="row"><span>Works best within</span><b>~${Math.round(s.radius * 0.55 * C.TILE / 10) * 10} m</b></div>` : ''}
         ${s.veh ? `<div class="row"><span>Vehicles out</span><b data-v="veh"></b></div>` : ''}
         <div data-v="sprob" class="sub"></div>
         <div class="btns" style="margin-top:10px"><button class="btn danger" id="bdel">Demolish</button></div>`;
    } else {
      const z = C.ZONES[b.zone], res = z.cat === 'res';
      p.innerHTML = head(b.name, z.name) +
        `<div class="row"><span>Level</span><b class="stars" data-v="stars"></b></div>
         <div data-v="chip"></div>
         <div class="sec">
         ${res ? `<div class="row"><span>Residents</span><b data-v="res"></b></div><div class="row"><span>Employed</span><b data-v="emp"></b></div><div class="row"><span>Average commute</span><b data-v="comm"></b></div>`
          : `<div class="row"><span>Workers</span><b data-v="wk"></b></div><div class="row"><span>From out of town</span><b data-v="out"></b></div>${z.cat === 'com' ? '<div class="row"><span>Customers</span>' + meter('cust') + '</div>' : ''}`}
         <div class="row"><span>Happiness</span>${meter('happy')}</div>
         <div class="row"><span>Land value</span>${meter('lv')}</div>
         <div class="row"><span>Level progress</span>${meter('prog')}</div>
         <div class="row"><span>Garbage</span>${meter('garb')}</div></div>
         <div class="sec"><div class="lbl">Services in range</div>
         ${[['police', 'Police'], ['fire', 'Fire'], ['health', 'Health'], ['edu', 'Education'], ['park', 'Parks'], ['transit', 'Transit']].map(k => `<div class="row"><span>${k[1]}</span>${meter('c_' + k[0])}</div>`).join('')}</div>
         <div class="btns" style="margin-top:10px"><button class="btn danger" id="bdel">Demolish</button></div>`;
    }
    bindClose(p, () => UI.select(null));
    p.querySelector('#bdel').onclick = () => { S.removeBuilding(b); UI.sfx('demolish'); UI.select(null); };
    updBuilding(p, b);
  }
  function updBuilding(p, b) {
    const S = CB.Sim, cv = S.cov, i = S.centerTile(b);
    if (!S.buildings.has(b.id)) { UI.select(null); return; }
    if (b.kind === 'svc') {
      const s = C.SERVICES[b.svc];
      if (s.veh) sv(p, 'veh', b.vehOut + ' / ' + s.vehCount);
      sv(p, 'sprob', b.prob === 'noroad' ? 'This building has no road access.' : '');
      return;
    }
    const z = C.ZONES[b.zone], res = z.cat === 'res';
    const stars = p.querySelector('[data-v="stars"]');
    if (stars && stars.dataset.l !== String(b.level)) { stars.dataset.l = b.level; stars.innerHTML = '★'.repeat(b.level) + '<span style="color:rgba(255,255,255,0.18)">' + '★'.repeat(5 - b.level) + '</span>'; }
    const chip = p.querySelector('[data-v="chip"]');
    let html;
    if (b.state === 'build') html = '<span class="chip warn">Under construction</span>';
    else if (b.state === 'aband') html = '<span class="chip bad">Abandoned: residents left because they were unhappy</span>';
    else if (b.state === 'fire') html = `<span class="chip bad">${PROB.fire[0]}</span><div class="sub" style="font-size:12px;margin-top:4px">${PROB.fire[1]}</div>`;
    else if (b.prob && PROB[b.prob]) html = `<span class="chip bad">${PROB[b.prob][0]}</span><div class="sub" style="font-size:12px;margin-top:4px">${PROB[b.prob][1]}</div>`;
    else if (b.level < 5 && cv.lv[i] < C.LV_REQ[b.level]) html = '<span class="chip warn">Land value too low to level up</span><div class="sub" style="font-size:12px;margin-top:4px">Parks, schools, health care and transit raise land value.</div>';
    else html = '<span class="chip good">Doing well</span>';
    if (chip.dataset.h !== html) { chip.innerHTML = html; chip.dataset.h = html; }
    if (res) {
      sv(p, 'res', b.res + ' / ' + b.cap + (z.perBuilding ? ' (1 household)' : ' (' + Math.max(1, Math.round(b.cap / 2.6)) + ' households)'));
      sv(p, 'emp', S.employedOf(b) + ' of ' + Math.round(b.res * 0.55) + ' workers');
      sv(p, 'comm', b.commute ? Math.round(b.commute * 60 / C.HOUR_SEC) + ' min' : '–');
    } else {
      sv(p, 'wk', (b.filled + b.outside) + ' / ' + b.jobs);
      sv(p, 'out', b.outside);
      sm(p, 'cust', b.custRatio, goodCol(b.custRatio));
    }
    sm(p, 'happy', b.happy / 100, goodCol(b.happy / 100));
    sm(p, 'lv', cv.lv[i] / 80, goodCol(cv.lv[i] / 70));
    sm(p, 'prog', b.level >= 5 ? 1 : b.prog, 'var(--accent)');
    sm(p, 'garb', b.garbage / 150, b.garbage > 100 ? 'var(--bad)' : 'var(--mute)');
    for (const k of ['police', 'fire', 'health', 'edu', 'park', 'transit']) { const v = Math.min(1, cv[k][i]); sm(p, 'c_' + k, v, goodCol(v)); }
  }

  // ---------------- goals ----------------
  const GOALS = [
    ['Draw a road from the end of the highway', () => countRoads() > 3],
    ['Zone low density housing beside your road', () => hasZone(1)],
    ['Zone some commercial and industry', () => hasZone(4) && hasZone(6)],
    ['Reach 50 residents (Hamlet)', () => CB.Sim.milestone >= 1],
    ['Build a Waste Transfer Station and a Medical Clinic', () => hasSvc('garbage') && hasSvc('clinic')],
    ['Add bike lanes or a bike path', () => hasRoad(r => r.bike || !r.car)],
    ['Reach 150 residents (Village)', () => CB.Sim.milestone >= 2],
    ['Build a Police Station and a Fire Station', () => hasSvc('police') && hasSvc('fire')],
    ['Build an Elementary School', () => hasSvc('elem')],
    ['Lay a four-lane avenue', () => hasRoad(r => r.grp === 'medium')],
    ['Change an intersection in the editor', () => CB.World.clusters.some(c => c.cfg.ctrl !== 'auto')],
    ['Reach 300 residents and start a bus line', () => CB.Transit.lines.some(l => l.type === 'bus' && l.stops.length >= 3)],
    ['Grow to a Town (600 residents)', () => CB.Sim.milestone >= 4],
    ['Grow to a Large Town (1,200 residents)', () => CB.Sim.milestone >= 5],
    ['Grow to a Small City (2,500 residents)', () => CB.Sim.milestone >= 6],
    ['Build your first landmark', () => [...CB.Sim.buildings.values()].some(b => b.kind === 'svc' && C.SERVICES[b.svc].cat === 'landmarks')],
    ['Reach Metropolis (15,000 residents)', () => CB.Sim.milestone >= 9],
  ];
  let roadCache = { t: 0, set: new Set() };
  function hasRoad(fn) {
    const now = performance.now();
    if (now - roadCache.t > 1500) { roadCache.t = now; roadCache.set = new Set(); const R = CB.World.road; for (let i = 0; i < R.length; i++) if (R[i]) roadCache.set.add(R[i]); }
    for (const r of roadCache.set) if (fn(C.ROADS[r])) return true;
    return false;
  }
  let zoneCache = { t: 0, set: new Set() };
  function hasZone(z) {
    const now = performance.now();
    if (now - zoneCache.t > 1500) { zoneCache.t = now; zoneCache.set = new Set(); const Z = CB.World.zone; for (let i = 0; i < Z.length; i++) if (Z[i]) zoneCache.set.add(Z[i]); }
    return zoneCache.set.has(z);
  }
  function hasSvc(k) { for (const b of CB.Sim.buildings.values()) if (b.svc === k) return true; return false; }
  function countRoads() { const Wd = CB.World; let n = 0; for (let i = 0; i < Wd.road.length; i++) if (Wd.road[i] && C.ROADS[Wd.road[i]].grp !== 'highway' && Wd.conn[i]) { n++; if (n > 5) break; } return n; }
  function updGoals() {
    const g = $('goals');
    let done = 0; const st = GOALS.map(q => { const d = q[1](); return d; });
    let first = st.findIndex(d => !d); if (first < 0) first = GOALS.length;
    const from = Math.max(0, first - 1), to = Math.min(GOALS.length, first + 3);
    const html = `<h4><span>City goals · ${first}/${GOALS.length}</span><button id="gtog" aria-label="Toggle goals">${UI.goalsOpen ? '−' : '+'}</button></h4>` +
      (UI.goalsOpen ? `<ol start="${from + 1}">${GOALS.slice(from, to).map((q, k) => `<li class="${st[from + k] ? 'done' : (from + k === first ? 'cur' : '')}">${q[0]}</li>`).join('')}</ol>` : '');
    if (g.dataset.h !== html) { g.innerHTML = html; g.dataset.h = html; g.querySelector('#gtog').onclick = () => { UI.goalsOpen = !UI.goalsOpen; g.dataset.h = ''; updGoals(); }; }
  }

  // ---------------- periodic update ----------------
  let tick = 0;
  UI.update = function () {
    if (!CB.Game || !CB.Game.running) return;
    tick++;
    const S = CB.Sim, st = S.stats;
    $('cityName').textContent = S.name;
    $('money').textContent = U.money(S.money);
    $('money').className = 'num' + (S.money < 0 ? ' neg' : '');
    const pr = S.projected();
    const net = $('net'); net.textContent = (pr.net >= 0 ? '+' : '') + U.money(pr.net) + ' / month'; net.className = 'num ' + (pr.net >= 0 ? 'pos' : 'neg');
    $('pop').textContent = U.num(st.pop);
    $('popsub').textContent = U.num(st.filled + st.outsideIn) + ' jobs filled';
    $('happy').textContent = st.pop ? Math.round(st.happy) + '%' : '–';
    $('happysub').textContent = !st.pop ? '' : st.happy > 70 ? 'Delighted' : st.happy > 55 ? 'Content' : st.happy > 40 ? 'Uneasy' : 'Unhappy';
    const hh = Math.floor(S.hour), mm = Math.floor((S.hour - hh) * 60);
    $('time').textContent = String(hh).padStart(2, '0') + ':' + String(Math.floor(mm / 15) * 15).padStart(2, '0');
    $('date').textContent = S.dateStr();
    for (const k in S.demand) {
      const el = $('dm_' + k); if (!el) continue;
      el.querySelector('i').style.height = Math.round(S.demand[k]) + '%';
      const off = (k === 'rmed' && !S.unlocked(C.ZONES[2].unlock)) || (k === 'rhigh' && !S.unlocked(C.ZONES[3].unlock)) || (k === 'off' && !S.unlocked(C.ZONES[7].unlock));
      el.classList.toggle('off', off);
    }
    const m = S.milestone, nx = C.MILESTONES[m + 1];
    if (nx) {
      const prev = C.MILESTONES[m].pop;
      $('mileFill').style.width = U.clamp((st.pop - prev) / (nx.pop - prev), 0, 1) * 100 + '%';
      $('mileText').textContent = C.MILESTONES[m].name + ' → ' + nx.name + ' at ' + nx.pop.toLocaleString();
    } else { $('mileFill').style.width = '100%'; $('mileText').textContent = C.MILESTONES[m].name; }
    while (S.notices.length) { const n = S.notices.shift(); UI.toast(n.text, n.kind); }
    const tip = $('tip'); const tt = CB.Tools.tip;
    tip.hidden = !tt; if (tt) tip.textContent = tt;
    // panels
    const ip = $('infoPanel');
    if (!ip.hidden) { if (UI.selected) updBuilding(ip, UI.selected); else if (UI.selVehicle) updVehicle(ip); else if (UI.selStop) sv(ip, 'wait', UI.selStop.waiting.reduce((a, q) => a + q.n, 0)); }
    const sp = $('sidePanel');
    if (!sp.hidden) {
      if (UI.panel === 'budget') updBudget(sp);
      else if (UI.panel === 'transit') updTransit(sp);
      else if (UI.panel === 'stats' && tick % 4 === 0) updStats(sp);
    }
    if (UI.overlay && tick % 4 === 0) refreshOverlay();
    if (tick % 2 === 0) updGoals();
    if (tick % 8 === 0 && UI.cat) {
      const cat = CATS.find(c => c.key === UI.cat);
      const locks = document.querySelectorAll('#palette .card.locked').length;
      const items = catItems(UI.cat, cat.tabs ? UI.tab[UI.cat] : null).filter(it => !S.unlocked(it.unlock)).length;
      if (locks !== items) renderPalette();
    }
    if (UI.junctionTile >= 0 && CB.World.jcl[UI.junctionTile] < 0) { $('infoPanel').hidden = true; UI.junctionTile = -1; }
  };
})();
