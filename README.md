<div align="center">

# 🏙️ Arterial

**A 3D city builder that runs in your browser.**
Lay roads off the highway, zone neighbourhoods, and watch every car find its own way through town.
Grow from a village of cottages into a metropolis of towers, linked by buses and trains.

[![Play now](https://img.shields.io/badge/▶_PLAY_NOW-kostslava.github.io%2Fopen--skylines-3d8bff?style=for-the-badge)](https://kostslava.github.io/open-skylines/)

![Three.js](https://img.shields.io/badge/Three.js-r158-000000?style=flat-square&logo=threedotjs)
![JavaScript](https://img.shields.io/badge/Vanilla_JS-no_build_step-f7df1e?style=flat-square&logo=javascript&logoColor=black)
![Runs in](https://img.shields.io/badge/runs_in-Chrome_·_Edge_·_Firefox-4fd17a?style=flat-square)
![Install](https://img.shields.io/badge/install-nothing-ffb547?style=flat-square)

</div>

---

## ✨ What's in it

| | |
|---|---|
| 🚗 **Living traffic** | Every car is a real agent. It plans a route with A*, picks a lane, follows the car in front, and queues at junctions. Build a bad intersection and you'll *see* the jam. |
| 🏘️ **Zoning that grows** | Residential, commercial, industrial and office zones. Buildings appear when there's demand and level up as land value rises. |
| 🚌 **Transit that matters** | Draw bus lines and train/metro lines (elevated or underground). Passengers walk to stops, transfer between lines and pay fares. |
| 🚒 **City services** | Police, fire, health, schools, garbage and parks, each with a coverage radius and vehicles out on the roads. |
| 💰 **Budget & taxes** | Set tax rates per zone, watch income against upkeep, and take out loans when you're in a pinch. |
| 🌗 **Day & night** | Windows light up, streetlights glow and the city changes mood as the clock runs. |
| 🔍 **Info views** | Traffic, land value, happiness, pollution, noise, and coverage for every service. |
| 💬 **Resident chatter** | Your citizens comment on what's happening in their city. |

Water and power are **fully automatic**, so you can spend your time on the fun parts.

---

## 📈 From settlement to metropolis

You start small. Hitting each population milestone pays a cash reward and unlocks new tools.

| Milestone | Population | Unlocks |
|---|---:|---|
| 🛖 Settlement | 0 | Small roads, avenues, low density housing & shops, industry, basic services |
| 🏡 Village | 250 | Medium density housing, bus lines, Town Plaza |
| 🏘️ Town | 800 | Highways, high density commercial, High School |
| 🏙️ Small City | 2,000 | Trains & metro, offices, Hospital, Police HQ |
| 🌆 City | 4,000 | High density housing, University, Central Park |
| 🌃 Big City | 8,000 | Stadium, Observation Tower |
| 👑 Metropolis | 15,000 | The Grand Arch |

---

## 🎮 Controls

| Key | Action |
|---|---|
| <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> | Move the camera (hold <kbd>Shift</kbd> to go faster) |
| <kbd>Q</kbd> / <kbd>E</kbd> | Rotate |
| <kbd>R</kbd> / <kbd>F</kbd> | Zoom in / out |
| <kbd>T</kbd> / <kbd>G</kbd> | Tilt |
| Right-drag | Rotate and tilt |
| Middle-drag | Pan |
| Mouse wheel | Zoom |
| <kbd>Space</kbd> | Pause |
| <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> | Game speed |
| <kbd>B</kbd> | Bulldoze |
| <kbd>R</kbd> | Rotate a building before placing it |
| <kbd>Esc</kbd> | Cancel the current tool |

### 💡 Tips for a first city
1. **Branch off the highway** with a small road. Only roads connected to the highway count.
2. **Zone along your roads** by dragging a rectangle. Watch the R / C / I demand bars at the top.
3. **Mix it up.** Homes need jobs and shops, and industry is noisy, so give it some distance.
4. **Open the Traffic view** when things feel slow. Red roads are jammed: add an avenue, a second route or a bus line.
5. **Keep an eye on the budget.** A clinic and a fire station early on will save you from disasters.

---

## 🖥️ Graphics presets

Pick one on the start screen and change it any time in **Settings**.

| Preset | Good for |
|---|---|
| **Low** | Integrated graphics, older laptops |
| **Medium** | Most laptops |
| **High** | Gaming laptops and desktops |
| **Ultra** | Powerful desktop GPUs |

---

## 🚀 Running it

**Easiest:** just open **[kostslava.github.io/open-skylines](https://kostslava.github.io/open-skylines/)**.

**Locally:** clone the repo and open `index.html` in Chrome, Edge or Firefox. You'll need an internet connection, because the 3D engine and fonts load from a CDN.

```bash
git clone https://github.com/kostslava/open-skylines.git
```

**Saving:** your city saves to your browser's local storage. It autosaves every in-game month, and you can save by hand with **Settings → Save now**. Saves stay on the computer and browser you played on.

**Single file:** `dist/arterial.html` is the whole game bundled into one file. After editing anything in `js/`, rebuild it with:

```powershell
powershell -File build.ps1
```

---

## 🗂️ How the code is laid out

No framework and no bundler. It's plain scripts loaded in order, sharing one global `CB` namespace.

| File | What it does |
|---|---|
| `js/core.js` | Constants and balance: roads, zones, services, milestones, quality presets |
| `js/world.js` | Tile grid, terrain generation (island, river, mountains), height queries |
| `js/gfx.js` | Renderer, lighting, day/night, sky, water, terrain, shader patches, camera, picking |
| `js/meshes.js` | Procedural buildings, roads, rail, trees, vehicles, previews, icons |
| `js/traffic.js` | Cost-based A* routing, lane choice, car following, junction queueing, congestion |
| `js/transit.js` | Stops, bus and metro lines, passenger routing with transfers, trains |
| `js/sim.js` | Growth, demand, jobs, happiness, levels, services, fires, garbage, economy, milestones |
| `js/tools.js` | Input handling and build tools |
| `js/ui.js` | Interface panels, info views, goals |
| `js/main.js` | Boot, main loop, save/load |

<details>
<summary><b>🧪 Debug URL parameters</b> (for testing)</summary>

<br>

| Parameter | Effect |
|---|---|
| `?demo=1&ms=4&ff=72` | Build a demo town, unlock up to milestone 4, then fast-forward 72 game hours |
| `&preset=low\|medium\|high\|ultra` | Force a graphics preset |
| `&hour=21` | Set the time of day |
| `&ov=traffic` | Open an info view on load |

</details>

---

<div align="center">
<sub>Inspired by the big city builders, but made small enough to run in a browser tab.</sub>
</div>
