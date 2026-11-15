# Arterial

A browser city builder inspired by Cities: Skylines II, built with Three.js (r158, loaded from a CDN).

## Run it
Open `index.html` in Chrome, Edge or Firefox. An internet connection is needed for the 3D engine and fonts. Your city saves to the browser's local storage: it autosaves every in-game month, and you can also use Settings → Save now.

`dist/arterial.html` is the same game bundled into one file. Run `powershell -File build.ps1` to rebuild it after editing `js/`.

## Code map
| File | What it does |
|---|---|
| `js/core.js` | Constants and balance: roads, zones, services, milestones, quality presets |
| `js/world.js` | Tile grid, terrain generation (island, river, mountains), height queries |
| `js/gfx.js` | Renderer, lighting and day/night, sky, water, terrain, shader patches (night windows), camera, picking |
| `js/meshes.js` | Procedural buildings, roads, rail, trees, vehicles, previews, icons |
| `js/traffic.js` | Cost-based A* routing, lane choice, car following, junction queueing, congestion |
| `js/transit.js` | Stops, bus and metro lines, passenger routing with transfers, trains |
| `js/sim.js` | Growth, demand, jobs, happiness, levels, services, fires, garbage, economy, milestones |
| `js/tools.js` | Input handling and build tools |
| `js/ui.js` | Interface panels, info views, goals |
| `js/main.js` | Boot, main loop, save/load |

## Test URL parameters (local file only)
- `?demo=1&ms=4&ff=72`: builds a demo town, unlocks up to milestone 4, then fast-forwards 72 game hours
- `&preset=low|medium|high|ultra`: forces a graphics preset
- `&hour=21`: sets the time of day
- `&ov=traffic`: opens an info view on load
