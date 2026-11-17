<p align="center">
  <img src="assets/banner.svg" width="100%" alt="Open Skylines: a city builder that runs in your browser">
</p>

<p align="center">
  <a href="https://kostslava.github.io/open-skylines/"><img src="assets/play.svg" height="52" alt="Play in your browser"></a>
<## what is this

a city builder you play in the browser. kinda like cities skylines but way smaller, made in three.js. nothing to install, just open the link.

you start with an empty island and a highway. lay a street, zone some houses, and the town grows. every car, bike and pedestrian is its own agent with its own route, so if you build a dumb intersection you'll watch it jam up, and if you build bike lanes people actually ride them.

water and power are automatic because managing pipes is boring.

## how the city grows

you start with just roads and zoning. services unlock as people move in:

| milestone | pop | unlocks |
|---|---:|---|
| settlement | 0 | small roads, low density homes and shops, industry |
| hamlet | 50 | garbage, medical clinic, bike lanes and paths, small parks |
| village | 150 | police, fire, elementary school, avenues, more small roads, roundabouts |
| small town | 300 | buses, medium density housing, medium parks, protected bike lanes |
| town | 600 | highways, streetcars, high school, recycling, dense commercial |
| large town | 1,200 | boulevards, offices, hospital, police and fire HQ |
| small city | 2,500 | trains and metro, university, high density housing, large parks |
| city | 5,000 | landmarks: claude arch, vs code tower, octocat statue, rubber duck |
| big city | 9,000 | terminal monolith, stack tower, neural net sphere, penguin plaza |
| metropolis | 15,000 | twin serpent towers, container whale, hackathon arena, cloud spire |

## what's in it

- **roads.** small roads are one tile, avenues, boulevards and highways are two tiles wide (one carriageway each way). 29 road types: one-ways, 1+2 asymmetric, gravel, medians, tree-lined, painted and protected bike lanes, tram tracks, ramps, bike and foot paths. the menu is split into tabs like the real thing
- **intersections.** traffic lights go up automatically where avenues or bigger meet; small street crossings stay uncontrolled. every approach gets painted lane arrows. the intersection editor (roads → intersections) lets you switch between lights, stop signs, all-way stops and roundabouts, pick who stops, tune green times, and choose which turns each lane allows. cars plan routes around the arrows
- **traffic.** cars pathfind with direction-aware A*, respect one-ways, pick lanes from the arrows, follow each other and wait at signals. people only drive when it makes sense: short trips are walked, medium trips are cycled if the route is safe (more bike lanes = more cyclists), and transit wins when it's quicker. shifts are staggered so not everyone leaves at 8:00
- **zoning.** residential, commercial, industrial and office. low density lots come in five sizes, from cottages to estates with a pool
- **transit.** buses, streetcars, elevated trains and metro
- **services and parks.** garbage, health, police, fire, education, 22 parks from pocket parks to woodland reserves
- **the rest.** day/night cycle, info views, budget and loans, residents who complain about stuff

uff

## controls

| key | does |
|---|---|
| <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> | move camera, hold <kbd>Shift</kbd> to go faster |
| <kbd>Q</kbd> <kbd>E</kbd> | rotate |
| <kbd>R</kbd> <kbd>F</kbd> | zoom in / out |
| <kbd>T</kbd> <kbd>G</kbd> | tilt |
| right drag | rotate + tilt |
| middle drag | pan |
| scroll | zoom |
| <kbd>Space</kbd> | pause |
| <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> | game speed |
| <kbd>B</kbd> | bulldoze |
| <kbd>R</kbd> | rotate a building before you place it |
| <kbd>Esc</kbd> | cancel tool |

## if it's your first city

1. drag a small road from the little connector at the end of the highway. roads that aren't connected don't count
2. drag zones along the road and watch the R / C / I demand bars at the top
3. people need jobs and shops, and industry is loud, so don't put it right next to houses
4. at 50 people build a clinic and garbage, at 150 a fire station. fires will wreck you otherwise
5. one-way roads follow the direction you drag. the yellow arrows in the preview show the flow
6. if traffic jams, open the traffic view. add bike lanes, a second route, or fix the intersection in the editor

## graphics

there's a quality dropdown on the start screen (low, medium, high, ultra) and you can change it in settings whenever. low is for older laptops and integrated graphics, ultra is for a real gpu.

## running it locally

just clone it and open `index.html` in chrome, edge or firefox. you still need internet because three.js and the fonts load from a cdn.

```bash
git clone https://github.com/kostslava/open-skylines.git
```

your city saves in your browser. it autosaves every in-game month, or hit settings → save now. saves don't carry over between computers.

`dist/open-skylines.html` is the whole game in one file. if you edit anything in `js/`, rebuild it with:

```bash
./build.sh
```

(or `powershell -File build.ps1` on windows)

## code

no framework, no bundler. just plain scripts loaded in order that share one global `CB` object.

| file | what it does |
|---|---|
| `js/core.js` | constants and balance: roads, zones, services, milestones, quality presets |
| `js/world.js` | tile grid, terrain gen, road links, one-ways, junction clusters |
| `js/gfx.js` | renderer, lighting, day/night, sky, water, terrain, camera, picking |
| `js/meshes.js` | procedural buildings, roads, rail, trees, vehicles |
| `js/traffic.js` | direction-aware A*, lane arrows, signals, car following, cyclists and pedestrians |
| `js/transit.js` | stops, bus and metro lines, passenger routing, trains |
| `js/sim.js` | growth, demand, jobs, mode choice, happiness, services, money, milestones |
| `js/tools.js` | input and build tools |
| `js/ui.js` | panels, info views, goals |
| `js/main.js` | boot, main loop, save/load |

<details>
<summary><b>debug url params</b></summary>

<br>

| param | does |
|---|---|
| `?demo=1&ms=7&ff=72` | builds a demo town, unlocks up to milestone 4, fast forwards 72 game hours |
| `&preset=low\|medium\|high\|ultra` | forces a graphics preset |
| `&hour=21` | sets the time of day |
| `&ov=traffic` | opens an info view on load |

</details>
