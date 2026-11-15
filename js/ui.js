'use strict';
// Arterial — DOM interface: top bar, tool dock, panels, info views, goals, toasts
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
  const svg = k => '<svg viewBox="0 0 24 24" aria-hidden="true">' + (IC[k] || '') + '</svg>';
  const SVC_ICON = { police: 'police', policehq: 'police', fire: 'fire', clinic: 'health', hospital: 'health', elem: 'edu', high: 'edu', univ: 'edu', garbage: 'garbage', park: 'park', plaza: 'plaza', bigpark: 'park', stadium: 'stadium', tower: 'tower', arch: 'arch' };
  const SVC_COL = { police: '#2c5aa0', fire: '#b8322a', health: '#c8323e', edu: '#a0632f', garbage: '#4d7a4a', park: '#3f8a3a', landmark: '#8a6a2a' };

  function catItems(key) {
    const S = CB.Sim, items = [];
    if (key === 'roads') {
      for (let r = 1; r <= 3; r++) { const R = C.ROADS[r]; items.push({ name: R.name, cost: U.money(R.cost) + ' / tile', unlock: R.unlock, tool: { type: 'road', rt: r }, icon: R.key, col: '#3a4048', desc: R.desc }); }
    } else if (key === 'zones') {
      for (let z = 1; z < C.ZONES.length; z++) { const Z = C.ZONES[z]; items.push({ name: Z.name, cost: 'Free', unlock: Z.unlock, tool: { type: 'zone', z }, icon: Z.key, col: Z.color }); }
      items.push({ name: 'Remove Zoning', cost: 'Free', unlock: 0, tool: { type: 'dezone' }, icon: 'dezone', col: '#555c66' });
    } else if (key === 'transit') {
      items.push({ name: 'Bus Stop', cost: U.money(C.TRANSIT.bus.stopCost), unlock: 1, tool: { type: 'stop', st: 'bus' }, icon: 'busstop', col: '#2f86e0' });
      items.push({ name: 'Bus Line', cost: U.money(C.TRANSIT.bus.upkeep) + ' / bus / mo', unlock: 1, tool: { type: 'line', lt: 'bus' }, icon: 'busline', col: '#2f86e0' });
      items.push({ name: C.RAIL[1].name, cost: U.money(C.RAIL[1].cost) + ' / tile', unlock: 3, tool: { type: 'rail', rr: 1 }, icon: 'elev', col: '#7a5a9a' });
      items.push({ name: C.RAIL[2].name, cost: U.money(C.RAIL[2].cost) + ' / tile', unlock: 3, tool: { type: 'rail', rr: 2 }, icon: 'sub', col: '#5a4a7a' });
      items.push({ name: 'Train Station', cost: U.money(C.TRANSIT.rail.stopCost) + '+', unlock: 3, tool: { type: 'stop', st: 'rail' }, icon: 'station', col: '#e85d2a' });
      items.push({ name: 'Train / Metro Line', cost: U.money(C.TRANSIT.rail.upkeep) + ' / train / mo', unlock: 3, tool: { type: 'line', lt: 'rail' }, icon: 'metro', col: '#e85d2a' });
    } else {
      for (const k in C.SERVICES) {
        const sv = C.SERVICES[k]; if (sv.cat !== key) continue;
        items.push({ name: sv.name, cost: U.money(sv.cost), unlock: sv.unlock, tool: { type: 'svc', key: k }, icon: SVC_ICON[k], col: SVC_COL[sv.cov] || '#555', desc: sv.desc });
      }
    }
    return items;
  }
  const CATS = [
    { key: 'roads', name: 'Roads', icon: 'avenue', hint: 'Drag to draw. Roads bend once at the corner. Start from the highway.' },
    { key: 'zones', name: 'Zoning', icon: 'zones', hint: 'Drag a rectangle along roads. Buildings grow when there is demand.' },
    { key: 'services', name: 'Services', icon: 'police', hint: 'Buildings must face a road. Press R to rotate.' },
    { key: 'parks', name: 'Parks', icon: 'park', hint: 'Parks raise happiness and land value, so buildings level up.' },
    { key: 'transit', name: 'Transit', icon: 'busline', hint: 'Choose a line tool, click stops in order, then click the first stop again to close the loop.' },
    { key: 'landmarks', name: 'Landmarks', icon: 'arch', hint: 'Landmarks unlock at large populations and attract visitors.' },
  ];

  // ---------------- init ----------------
  UI.init = function () {
    const tb = $('toolbar');
    tb.innerHTML = CATS.map(c => `<button class="tbtn" data-cat="${c.key}" title="${c.name}">${svg(c.icon)}<span>${c.name}</span></button>`).join('') +
      '<div class="sep"></div><button class="tbtn danger" id="bdz" title="Bulldoze (B)">' + svg('bulldoze') + '<span>Bulldoze</span></button>';
    tb.querySelectorAll('[data-cat]').forEach(b => b.addEventListener('click', () => UI.openCat(b.dataset.cat === UI.cat ? null : b.dataset.cat)));
    $('bdz').addEventListener('click', () => { UI.openCat(null); CB.Tools.setTool(CB.Tools.tool.type === 'bulldoze' ? null : { type: 'bulldoze' }); });
    for (const s of [0, 1, 2, 4]) $('sp' + s).addEventListener('click', () => UI.setSpeed(s));
    document.querySelectorAll('#menu [data-panel]').forEach(b => b.addEventListener('click', () => UI.openPanel(UI.panel === b.dataset.panel ? null : b.dataset.panel)));
    // demand bars
    const D = [['rlow', 'L', '#5fcf5a'], ['rmed', 'M', '#2f9e48'], ['rhigh', 'H', '#167a3a'], ['com', 'C', '#59a6f5'], ['ind', 'I', '#f0c43a'], ['off', 'O', '#b276f2']];
    $('demand').innerHTML = D.map(d => `<div class="dbar" id="dm_${d[0]}" title="${d[0]}"><div class="track"><i style="background:${d[2]}"></i></div><span>${d[1]}</span></div>`).join('');
    const titles = { rlow: 'Residential · low density', rmed: 'Residential · medium density', rhigh: 'Residential · high density', com: 'Commercial', ind: 'Industrial', off: 'Office' };
    for (const d of D) $('dm_' + d[0]).title = titles[d[0]] + ' demand';
    document.addEventListener('pointermove', e => { const t = $('tip'); t.style.left = e.clientX + 'px'; t.style.top = e.clientY + 'px'; });
    UI.goalsOpen = true;
    setInterval(UI.update, 250);
  };

  UI.openCat = function (key) {
    UI.cat = key;
    document.querySelectorAll('#toolbar [data-cat]').forEach(b => b.classList.toggle('on', b.dataset.cat === key));
    const p = $('palette');
    if (!key) { p.hidden = true; if (CB.Tools.tool.type !== 'bulldoze') CB.Tools.setTool(null); return; }
    renderPalette();
    p.hidden = false;
    CB.Tools.setTool(null);
  };
  function renderPalette() {
    const key = UI.cat; if (!key) return;
    const S = CB.Sim, cat = CATS.find(c => c.key === key);
    const items = catItems(key);
    const p = $('palette');
    p.innerHTML = items.map((it, k) => {
      const locked = !S.unlocked(it.unlock);
      return `<button class="card ${locked ? 'locked' : ''}" data-k="${k}" title="${it.desc || it.name}">
        ${locked ? `<span class="lock">${C.MILESTONES[it.unlock].name}</span>` : ''}
        <div class="sw" style="background:${it.col}">${svg(it.icon)}</div>
        <b>${it.name}</b><small>${locked ? C.MILESTONES[it.unlock].pop.toLocaleString() + ' residents' : it.cost}</small></button>`;
    }).join('') + `<div class="hint">${cat.hint}</div>`;
    p.querySelectorAll('.card').forEach(el => el.addEventListener('click', () => {
      const it = items[+el.dataset.k];
      if (!S.unlocked(it.unlock)) { UI.toast('Unlocks at ' + C.MILESTONES[it.unlock].name + ' (' + C.MILESTONES[it.unlock].pop.toLocaleString() + ' residents)', 'bad'); return; }
      const t = CB.Tools.tool;
      const same = JSON.stringify(t) === JSON.stringify(it.tool);
      CB.Tools.setTool(same ? null : it.tool);
    }));
    markPalette();
  }
  function markPalette() {
    const items = UI.cat ? catItems(UI.cat) : [];
    const t = JSON.stringify(CB.Tools.tool);
    document.querySelectorAll('#palette .card').forEach(el => el.classList.toggle('on', JSON.stringify(items[+el.dataset.k].tool) === t));
  }
  UI.onToolChange = function () {
    markPalette();
    $('bdz').classList.toggle('on', CB.Tools.tool.type === 'bulldoze');
    if (CB.Tools.tool.type === 'bulldoze' && UI.cat) { UI.cat = null; $('palette').hidden = true; document.querySelectorAll('#toolbar [data-cat]').forEach(b => b.classList.remove('on')); }
  };

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
    const M = $('modal');
    M.innerHTML = `<div class="glass mbox"><div class="eyebrow">Milestone reached</div><h2>${m.name}</h2>
      <p>${CB.Sim.name} now has ${m.pop.toLocaleString()} residents. The city treasury receives a grant of <b style="color:var(--accent-2)">${U.money(m.reward)}</b>.</p>
      <p><b style="color:var(--fg)">Unlocked:</b> ${m.unlocks}</p><button class="btn primary" id="mok">Keep building</button></div>`;
    M.hidden = false;
    $('mok').onclick = () => { M.hidden = true; renderPalette(); };
    UI.sfx('build');
  };

  // ---------------- side panels ----------------
  UI.openPanel = function (key) {
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
    p.innerHTML = head('Budget', 'Monthly figures. One day is one month.') +
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
    const busOK = S.unlocked(1), railOK = S.unlocked(3);
    p.innerHTML = head('Public transport', 'Buses and trains take cars off the road') +
      `<div class="row"><span>Riders last month</span><b data-v="riders"></b></div>
       <div class="row"><span>Trips by transit</span><b data-v="share"></b></div>
       <div class="row"><span>Waiting at stops</span><b data-v="waiting"></b></div>
       <div class="btns" style="margin-top:8px"><button class="btn primary" id="nbus" ${busOK ? '' : 'disabled'}>New bus line</button><button class="btn primary" id="nrail" ${railOK ? '' : 'disabled'}>New metro line</button></div>
       ${!busOK ? '<div class="sub" style="font-size:12px">Bus lines unlock at Village (250 residents).</div>' : ''}
       ${busOK && !railOK ? '<div class="sub" style="font-size:12px">Trains and metro unlock at Small City (2,000 residents).</div>' : ''}
       <div class="sec" id="lineList"></div>`;
    bindClose(p, () => UI.openPanel(null));
    p.querySelector('#nbus').onclick = () => { UI.openCat('transit'); CB.Tools.setTool({ type: 'line', lt: 'bus' }); };
    p.querySelector('#nrail').onclick = () => { UI.openCat('transit'); CB.Tools.setTool({ type: 'line', lt: 'rail' }); };
    renderLines(p);
    updTransit(p);
  };
  function renderLines(p) {
    const X = CB.Transit, L = p.querySelector('#lineList'); if (!L) return;
    L.innerHTML = X.lines.length ? X.lines.map(l => `<div class="line ${l.broken ? 'broken' : ''}" data-l="${l.id}"><span class="dot" style="background:${l.color}"></span>
      <div><div class="nm">${l.name}</div><div class="meta" data-v="lm_${l.id}"></div></div>
      <div class="ctl"><button data-a="-" title="Fewer vehicles">−</button><b class="num" data-v="lv_${l.id}" style="min-width:18px;text-align:center"></b><button data-a="+" title="More vehicles">+</button><button data-a="v" title="Show on map">◎</button><button data-a="x" title="Delete line">×</button></div></div>`).join('')
      : '<div class="sub">No lines yet. Choose a line tool, click stops in order, and click the first stop again to close the loop.</div>';
    L.querySelectorAll('.line').forEach(el => {
      const l = X.lineById(+el.dataset.l);
      el.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
        const a = b.dataset.a;
        if (a === '+') X.setVehicles(l, l.vehicles + 1);
        else if (a === '-') X.setVehicles(l, l.vehicles - 1);
        else if (a === 'x') { X.deleteLine(l); renderLines(p); return; }
        else if (a === 'v') { const s = X.stopById(l.stops[0]); if (s) CB.Gfx.focus((U.tx(s.tile) + 0.5) * C.TILE, (U.ty(s.tile) + 0.5) * C.TILE, 500); X.showRibbons(X.ribbonsOn, l); }
        updTransit(p);
      });
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
      sv(p, 'lm_' + l.id, l.broken ? 'Broken route: reconnect the stops' : `${l.stops.length} stops · ${U.num(l.ridersMonth)} riders this month · ${U.money(l.vehicles * C.TRANSIT[l.type].upkeep)}/mo`);
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
    sv(p, 'comm', st.commute ? Math.round(st.commute) + ' min' : '–');
    sv(p, 'flow', Math.round(Tr.stats.flow * 100) + '%');
    sv(p, 'veh', U.num(Tr.stats.active));
    sv(p, 'stuck', U.num(Tr.stats.stuck));
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
        <kbd>Space</kbd><span>Pause</span><kbd>1 2 3</kbd><span>Game speed</span><kbd>B</kbd><span>Bulldoze</span><kbd>R</kbd><span>Rotate a building before placing it</span><kbd>Esc</kbd><span>Cancel tool</span></div></div>`;
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
        if (['aa', 'dayNight', 'fps'].includes(k)) v = v === '1';
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
    const names = { car: 'Car', suv: 'SUV', van: 'Moving van', truck: 'Delivery truck', bus: 'Bus', police: 'Police car', ambulance: 'Ambulance', fire: 'Fire truck', garbage: 'Garbage truck' };
    p.innerHTML = head(names[v.kind] || 'Vehicle', v.line ? v.line.name : v.purpose) +
      `<div class="row"><span>Status</span><b data-v="status"></b></div>
       <div class="row"><span>Speed</span><b data-v="spd"></b></div>
       <div class="row"><span>Road</span><b data-v="road"></b></div>
       <div class="row"><span>Lane</span><b data-v="lane"></b></div>
       ${v.line ? '<div class="row"><span>Passengers</span><b data-v="pax"></b></div>' : '<div class="row"><span>Time on the road</span><b data-v="trip"></b></div>'}
       <div class="sec sub" style="font-size:12px;line-height:1.4">Each vehicle picks its route by weighing travel time against congestion, keeps a safe gap to the car ahead, picks its lane for the next turn and waits to enter busy junctions.</div>
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
    sv(p, 'lane', rt && C.ROADS[rt].lanes > 1 ? (v.laneIn === 0 ? 'Right lane' : 'Left lane') : 'Single lane');
    sv(p, 'trip', Math.round(CB.Traffic.time - v.born) + ' min');
    if (v.line) sv(p, 'pax', (v.load || 0) + ' / ' + C.TRANSIT.bus.cap);
  }
  UI.selectStop = function (s) {
    UI.select(null);
    UI.selStop = s;
    const p = $('infoPanel'); p.hidden = false;
    const lines = CB.Transit.lines.filter(l => l.stops.includes(s.id));
    p.innerHTML = head(s.name, s.type === 'bus' ? 'Bus stop' : (CB.World.rail[s.tile] === 2 ? 'Underground station' : 'Elevated station')) +
      `<div class="row"><span>Waiting passengers</span><b data-v="wait"></b></div>
       <div class="sec">${lines.length ? lines.map(l => `<div class="row"><span><span class="chip" style="background:${l.color}33;color:#fff">${l.name}</span></span><b>${l.vehicles} ${l.type === 'bus' ? 'buses' : 'trains'}</b></div>`).join('') : '<div class="sub">No line serves this stop yet.</div>'}</div>
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
         <div class="row"><span>Coverage radius</span><b>${s.radius * C.TILE} m</b></div>
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
      sv(p, 'comm', b.commute ? Math.round(b.commute) + ' min' : '–');
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
    ['Draw a road off the highway', () => countRoads() > 3],
    ['Zone low density housing beside your road', () => hasZone(1)],
    ['Zone some commercial and industry', () => hasZone(4) && hasZone(6)],
    ['Reach 60 residents', () => CB.Sim.stats.pop >= 60],
    ['Build a Medical Clinic and a Fire Station', () => hasSvc('clinic') && hasSvc('fire')],
    ['Add a Police Station and a Waste Transfer Station', () => hasSvc('police') && hasSvc('garbage')],
    ['Build an Elementary School', () => hasSvc('elem')],
    ['Grow to a Village (250 residents)', () => CB.Sim.milestone >= 1],
    ['Create a bus line with 3 or more stops', () => CB.Transit.lines.some(l => l.type === 'bus' && l.stops.length >= 3)],
    ['Zone medium density housing', () => hasZone(2)],
    ['Grow to a Town (800 residents)', () => CB.Sim.milestone >= 2],
    ['Grow to a Small City (2,000 residents)', () => CB.Sim.milestone >= 3],
    ['Build a metro or train line', () => CB.Transit.lines.some(l => l.type === 'rail')],
    ['Grow to a City and zone high density housing', () => CB.Sim.milestone >= 4 && hasZone(3)],
    ['Reach Metropolis (15,000 residents)', () => CB.Sim.milestone >= 6],
  ];
  let zoneCache = { t: 0, set: new Set() };
  function hasZone(z) {
    const now = performance.now();
    if (now - zoneCache.t > 1500) { zoneCache.t = now; zoneCache.set = new Set(); const Z = CB.World.zone; for (let i = 0; i < Z.length; i++) if (Z[i]) zoneCache.set.add(Z[i]); }
    return zoneCache.set.has(z);
  }
  function hasSvc(k) { for (const b of CB.Sim.buildings.values()) if (b.svc === k) return true; return false; }
  function countRoads() { const Wd = CB.World; let n = 0; for (let i = 0; i < Wd.road.length; i++) if (Wd.road[i] && Wd.road[i] !== 3 && Wd.conn[i]) { n++; if (n > 3) break; } return n; }
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
      const off = (k === 'rmed' && !S.unlocked(1)) || (k === 'rhigh' && !S.unlocked(4)) || (k === 'off' && !S.unlocked(3));
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
      // refresh lock states after milestones
      const locks = document.querySelectorAll('#palette .card.locked').length;
      const items = catItems(UI.cat).filter(it => !S.unlocked(it.unlock)).length;
      if (locks !== items) renderPalette();
    }
  };
})();
