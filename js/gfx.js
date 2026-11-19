'use strict';
// Open Skylines — renderer, scene, lighting, sky, water, terrain, materials, camera & picking
(function () {
  const { C, U } = CB;
  const T = C.TILE, W = C.W;
  const G = CB.Gfx = {};

  G.settings = null;
  G.uni = null;
  G.cityMeshes = new Set();

  // ---------------- materials ----------------
  const CITY_COMMON = `
uniform float uNight; uniform float uLit; uniform float uOvOn; uniform sampler2D uOvTex; uniform float uWorld; uniform float uDetail;
varying float vStyle; varying vec2 vUvm; varying vec3 vWP;
float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hh(i), hh(i+vec2(1,0)), f.x), mix(hh(i+vec2(0,1)), hh(i+vec2(1,1)), f.x), f.y); }
// fade a procedural pattern out where it would alias (far away)
float fadeK(vec2 p){ vec2 w = fwidth(p); return clamp(1.5 - max(w.x, w.y) * 4.5, 0.0, 1.0); }
`;
  const CITY_COLOR = `
#include <color_fragment>
float gWin = 0.0; vec3 gEmis = vec3(0.0); float gRough = -1.0;
int st0 = int(vStyle + 0.5);
int mat = st0 / 32;
int st = st0 - mat * 32;
if (mat > 0 && uDetail > 0.5) {
  bool hasUv = abs(vUvm.x) + abs(vUvm.y) > 1e-4;
  vec2 wuv = hasUv ? vUvm : vec2(vWP.x + vWP.z * 0.7071, vWP.z - vWP.x * 0.7071);
  vec2 roofUv = vec2(vWP.x + vWP.z, vWP.y * 1.6 + (vWP.x - vWP.z) * 0.02);
  vec3 c = diffuseColor.rgb;
  if (mat == 1) { // brick
    vec2 p = wuv * vec2(1.0 / 0.46, 1.0 / 0.17); float row = floor(p.y); p.x += 0.5 * mod(row, 2.0);
    vec2 f = fract(p); vec2 id = floor(p); float k = fadeK(p);
    float mort = (1.0 - smoothstep(0.0, 0.07, f.x) * smoothstep(1.0, 0.93, f.x) * smoothstep(0.0, 0.12, f.y) * smoothstep(1.0, 0.88, f.y));
    vec3 bc = c * (0.82 + 0.32 * hh(id)) * (0.94 + 0.12 * vn(wuv * 3.0));
    vec3 pat = mix(bc, mix(c * 1.6, vec3(0.5, 0.48, 0.45), 0.5), mort * 0.75);
    c = mix(c * (0.96 + 0.08 * vn(wuv * 0.8)), pat, k);
    gRough = 0.9;
  } else if (mat == 2) { // clapboard siding
    float v = wuv.y / 0.21; float k = fadeK(vec2(v));
    float sh = 1.0 - 0.22 * smoothstep(0.72, 1.0, fract(v)) + 0.05 * smoothstep(0.0, 0.2, fract(v));
    c *= mix(0.95, sh, k) * (0.97 + 0.06 * vn(wuv * vec2(0.4, 8.0)));
  } else if (mat == 3) { // stucco / render
    c *= 0.9 + 0.14 * vn(wuv * 2.5) + 0.05 * vn(wuv * 19.0);
    gRough = 0.95;
  } else if (mat == 4 || mat == 5) { // asphalt shingles / clay tiles
    vec2 p = roofUv * (mat == 4 ? vec2(3.2, 4.6) : vec2(2.6, 3.4)); float row = floor(p.y); p.x += 0.5 * mod(row, 2.0);
    vec2 f = fract(p); float k = fadeK(p);
    float tab = hh(floor(p));
    float edge = 1.0 - 0.32 * smoothstep(0.7, 1.0, f.y);
    float wave = mat == 5 ? 0.78 + 0.22 * sin(f.x * 6.2832) : 1.0 - 0.18 * smoothstep(0.9, 1.0, f.x);
    vec3 pat = c * edge * wave * (0.84 + 0.28 * tab);
    c = mix(c * 0.92, pat, k) * (0.92 + 0.12 * vn(roofUv * 0.6));
    gRough = 0.85;
  } else if (mat == 6) { // precast concrete panels
    vec2 p = wuv / vec2(3.0, 1.5); vec2 f = fract(p); float k = fadeK(p);
    float j = smoothstep(0.0, 0.015, f.x) * smoothstep(0.0, 0.03, f.y);
    c *= mix(0.97, 0.78 + 0.22 * j, k) * (0.92 + 0.1 * vn(wuv * 1.3) + 0.04 * vn(wuv * 13.0));
  } else if (mat == 7 || mat == 12) { // corrugated metal / standing-seam roof
    float u = (hasUv ? wuv.x : (vWP.x + vWP.z)) / (mat == 7 ? 0.14 : 0.55); float k = fadeK(vec2(u));
    float sh = mat == 7 ? 0.8 + 0.2 * sin(u * 6.2832) : 1.0 - 0.25 * smoothstep(0.9, 1.0, fract(u));
    c *= mix(0.92, sh, k) * (0.93 + 0.1 * vn(wuv * vec2(0.3, 2.0)));
    gRough = 0.45;
  } else if (mat == 8) { // lawn
    vec2 p = vWP.xz;
    float n = vn(p * 0.35) * 0.6 + vn(p * 2.3) * 0.3 + vn(p * 11.0) * 0.1;
    c *= 0.78 + 0.42 * n;
    c = mix(c, c * vec3(1.08, 1.02, 0.7), smoothstep(0.62, 0.8, vn(p * 0.17)));
    gRough = 1.0;
  } else if (mat == 9) { // paving stones
    vec2 p = vWP.xz / 0.62; float row = floor(p.y); p.x += 0.5 * mod(row, 2.0);
    vec2 f = fract(p); float k = fadeK(p);
    float j = smoothstep(0.0, 0.06, f.x) * smoothstep(1.0, 0.94, f.x) * smoothstep(0.0, 0.06, f.y) * smoothstep(1.0, 0.94, f.y);
    c *= mix(0.95, (0.8 + 0.2 * j) * (0.9 + 0.18 * hh(floor(p))), k);
  } else if (mat == 10) { // wood planks
    float v = (hasUv ? wuv.y : vWP.z) / 0.16; float k = fadeK(vec2(v));
    c *= mix(0.95, (0.85 + 0.15 * smoothstep(0.0, 0.08, fract(v))) * (0.88 + 0.2 * hh(vec2(floor(v), 3.0))), k) * (0.92 + 0.1 * vn(wuv * vec2(6.0, 0.6)));
  } else if (mat == 13) { // asphalt: aggregate, wear, patches and cracks
    vec2 p = vWP.xz;
    float g = hh(floor(p * 11.0)) * fadeK(p * 11.0);
    float n = vn(p * 0.21) * 0.55 + vn(p * 1.4) * 0.3 + vn(p * 5.0) * 0.15;
    c *= 0.84 + 0.2 * n + 0.12 * (g - 0.5);
    vec2 pc = floor(p / vec2(4.3, 2.9) + vec2(0.0, floor(p.x / 4.3) * 0.37));
    c *= 1.0 - 0.11 * step(0.9, hh(pc)) * fadeK(p * 0.5);
    float crk = abs(vn(p * 0.5 + 7.0) - 0.5) + 0.004 * vn(p * 9.0);
    c *= 1.0 - 0.4 * (1.0 - smoothstep(0.0, 0.014, crk)) * fadeK(p * 1.6) * smoothstep(0.5, 0.65, vn(p * 0.09 + 3.0));
    c = mix(c, c * vec3(0.7, 0.68, 0.66), smoothstep(0.78, 0.95, vn(p * 0.33 + 11.0)) * 0.5); // oil and tyre stains
    gRough = 0.93;
  } else if (mat == 14) { // concrete sidewalk slabs
    vec2 p = vWP.xz / 1.5; vec2 f = fract(p); float k = fadeK(p);
    float j = smoothstep(0.0, 0.035, f.x) * smoothstep(1.0, 0.965, f.x) * smoothstep(0.0, 0.035, f.y) * smoothstep(1.0, 0.965, f.y);
    c *= mix(0.96, 0.8 + 0.2 * j, k) * (0.92 + 0.1 * hh(floor(p))) * (0.93 + 0.1 * vn(vWP.xz * 0.8)) * (0.97 + 0.05 * hh(floor(vWP.xz * 14.0)) * fadeK(vWP.xz * 14.0));
    gRough = 0.9;
  } else if (mat == 15) { // packed dirt and gravel
    vec2 p = vWP.xz;
    c *= 0.78 + 0.26 * vn(p * 0.55) + 0.14 * vn(p * 2.7);
    float k = fadeK(p * 6.0);
    c = mix(c, c * 1.4 + 0.04, step(0.82, hh(floor(p * 6.0))) * 0.55 * k);
    c *= 1.0 - 0.28 * step(0.86, hh(floor(p * 6.0) + 3.0)) * k;
    c = mix(c, c * vec3(0.82, 0.86, 0.7), smoothstep(0.6, 0.85, vn(p * 0.2 + 5.0)) * 0.6); // weedy patches
    gRough = 1.0;
  } else if (mat == 11) { // gravel
    c *= 0.82 + 0.3 * hh(floor(vWP.xz * 6.0)) * fadeK(vWP.xz * 6.0) + 0.1 * vn(vWP.xz);
    gRough = 1.0;
  }
  // grime and contact shadow at the foot of walls
  if (hasUv && (mat <= 3 || mat == 6 || mat == 7 || mat == 10)) c *= 0.8 + 0.2 * smoothstep(0.0, 1.1, vUvm.y);
  diffuseColor.rgb = c;
}
if (st >= 1 && st <= 4) {
  vec2 cs; vec2 mg; vec3 glass; vec3 litc;
  if (st == 1) { cs = vec2(2.9, 3.0); mg = vec2(0.24, 0.25); glass = vec3(0.07,0.09,0.12); litc = vec3(1.0,0.70,0.36); }
  else if (st == 2) { cs = vec2(1.7, 3.6); mg = vec2(0.05, 0.10); glass = vec3(0.10,0.17,0.25); litc = vec3(0.45,0.5,0.6); }
  else if (st == 3) { cs = vec2(4.2, 4.0); mg = vec2(0.05, 0.10); glass = vec3(0.08,0.11,0.14); litc = vec3(1.0,0.82,0.5); }
  else { cs = vec2(5.0, 6.0); mg = vec2(0.18, 0.64); glass = vec3(0.10,0.12,0.14); litc = vec3(1.0,0.88,0.6); }
  vec2 c = vUvm / cs; vec2 f = fract(c); vec2 id = floor(c);
  vec2 fw = fwidth(c) + 1e-4;
  vec2 a = smoothstep(mg - fw, mg + fw, f) * (1.0 - smoothstep(1.0 - mg - fw, 1.0 - mg + fw, f));
  float win = a.x * a.y;
  float far = clamp(max(fw.x, fw.y) * 2.5 - 0.4, 0.0, 1.0);
  float cover = (1.0 - 2.0 * mg.x) * (1.0 - 2.0 * mg.y);
  win = mix(win, cover * 0.8, far);
  float r = hh(id + floor(vWP.xz * 0.09) * 7.13);
  vec3 refl = glass + vec3(0.05,0.07,0.10) * (0.5 + 0.5 * sin(id.x * 1.7 + id.y * 0.9 + vWP.x * 0.01));
  if (uDetail > 0.5) {
    // sky reflection gradient, interior curtains, frames and mullions
    vec2 g = (f - mg) / (1.0 - 2.0 * mg);
    refl += vec3(0.10, 0.13, 0.17) * smoothstep(0.2, 1.0, g.y) * (1.0 - far);
    float rc = hh(id * 1.37 + 4.1);
    if (st == 1 && rc > 0.55) refl = mix(refl, vec3(0.55, 0.45, 0.32) * (0.4 + 0.5 * hh(id + 9.0)), 0.35 * (1.0 - smoothstep(0.15, 0.3, abs(g.x - 0.5))));
    float fr = 0.0;
    if (st == 1 || st == 3) fr = max(1.0 - smoothstep(0.0, 0.05, abs(g.x - 0.5)), 1.0 - smoothstep(0.0, 0.05, abs(g.y - 0.55)));
    else if (st == 2) fr = 1.0 - smoothstep(0.0, 0.03, abs(g.y - 0.08));
    vec3 frameC = st == 2 ? vec3(0.16, 0.17, 0.19) : vec3(0.85, 0.84, 0.8);
    refl = mix(refl, frameC, fr * (1.0 - far) * 0.9);
    // frame border just outside the glass for punched windows
    if (st == 1) { vec2 a2 = smoothstep(mg - 0.06 - fw, mg - 0.06 + fw, f) * (1.0 - smoothstep(1.0 - mg + 0.06 - fw, 1.0 - mg + 0.06 + fw, f)); float rim = a2.x * a2.y - win; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.89, 0.85), clamp(rim, 0.0, 1.0) * (1.0 - far)); }
  }
  diffuseColor.rgb = mix(diffuseColor.rgb, refl, win);
  gWin = win;
  float lit = step(r, uLit * 1.4);
  if (st == 3) lit = step(0.1, uLit);
  gEmis = litc * win * lit * uNight * (0.45 + 0.55 * hh(id * 3.1 + 1.7));
} else if (st == 14) {
  if (mat == 0 && uDetail > 0.5 && dot(diffuseColor.rgb, vec3(0.33)) > 0.35) diffuseColor.rgb *= 0.74 + 0.26 * smoothstep(0.15, 0.6, vn(vWP.xz * 1.9)); // worn paint
  gEmis = diffuseColor.rgb * vec3(1.0, 0.8, 0.55) * 0.5 * uNight;
}
else if (st == 5) { gEmis = diffuseColor.rgb * (0.25 + 1.6 * uNight); }
else if (st == 16) { diffuseColor.rgb = vec3(0.55, 0.57, 0.6); }
else if (st == 17) { diffuseColor.rgb = vec3(0.025, 0.026, 0.03); }
else if (st == 18) { diffuseColor.rgb = vec3(0.62, 0.42, 0.3); }
else if (st == 15) { gEmis = diffuseColor.rgb * (1.4 + 1.6 * uNight); }
else if (st == 6) { diffuseColor.rgb = vec3(0.95, 0.93, 0.8); gEmis = vec3(1.0, 0.95, 0.8) * 3.0 * uNight; }
else if (st == 7) { diffuseColor.rgb = vec3(0.5, 0.03, 0.03); gEmis = vec3(1.0, 0.06, 0.04) * (0.25 + 1.8 * uNight); }
else if (st == 8) { diffuseColor.rgb = vec3(0.9, 0.85, 0.7); gEmis = vec3(1.0, 0.78, 0.45) * 3.5 * uNight; }
else if (st == 9) { diffuseColor.rgb = vec3(0.04, 0.055, 0.07); gWin = 0.8; }
else if (st == 10) {
  // building glass: one random state per pane (cells ~1.4 m across, one per storey)
  vec2 wid = vec2(floor((vWP.x + vWP.z * 1.37) / 1.4), floor(vWP.y / 3.0));
  float r = hh(wid + floor(vWP.xz / 23.0) * 3.7);
  float lit = step(r, min(0.95, uLit * 1.9));
  float warm = hh(wid * 1.9 + 5.3);
  vec3 litc = mix(vec3(1.0, 0.72, 0.38), vec3(0.95, 0.9, 0.8), step(0.8, warm));
  float g = fract(vWP.y / 3.0);
  vec3 refl = vec3(0.045, 0.06, 0.08) + vec3(0.06, 0.08, 0.11) * smoothstep(0.3, 0.9, g);
  vec3 tnt = diffuseColor.rgb / max(0.02, max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b))); // glass tint from the vertex colour (white = clear)
  refl *= mix(vec3(1.0), tnt, 0.75) * (0.7 + 0.3 * max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b)));
  diffuseColor.rgb = mix(refl, litc * 0.35, lit * uNight * 0.6);
  gWin = 0.8 * (1.0 - lit * uNight);
  gEmis = litc * lit * uNight * (0.55 + 0.6 * hh(wid * 3.1 + 1.7)) * (0.75 + 0.25 * smoothstep(0.0, 0.6, g));
}
else if (st == 11) { diffuseColor.rgb = vec3(0.03); }
else if (st == 12) { diffuseColor.rgb = vec3(0.20, 0.13, 0.08); }
else if (st == 13) { diffuseColor.rgb = vec3(0.12, 0.30, 0.38); gWin = 1.0; }
if (uOvOn > 0.5) {
  vec4 ov = texture2D(uOvTex, vWP.xz / uWorld);
  float l = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
  diffuseColor.rgb = mix(vec3(0.30 + l * 0.6), ov.rgb, ov.a * 0.9);
  gEmis *= 0.15;
}
`;
  function patchCity(mat, pbr) {
    mat.onBeforeCompile = function (sh) {
      const u = G.uni;
      sh.uniforms.uNight = u.uNight; sh.uniforms.uLit = u.uLit; sh.uniforms.uOvOn = u.uOvOn;
      sh.uniforms.uOvTex = u.uOvTex; sh.uniforms.uWorld = u.uWorld; sh.uniforms.uDetail = u.uDetail;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float wstyle; attribute vec2 uvm; varying float vStyle; varying vec2 vUvm; varying vec3 vWP;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
vStyle = wstyle; vUvm = uvm;
vec4 wp4 = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
wp4 = instanceMatrix * wp4;
#endif
vWP = (modelMatrix * wp4).xyz;`);
      let fs = sh.fragmentShader
        .replace('#include <common>', '#include <common>\n' + CITY_COMMON)
        .replace('#include <color_fragment>', CITY_COLOR)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += gEmis;');
      if (pbr) fs = fs.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nif (gRough >= 0.0) roughnessFactor = gRough;\nroughnessFactor = mix(roughnessFactor, 0.18, gWin);');
      sh.fragmentShader = fs;
    };
    mat.customProgramCacheKey = () => 'city' + (pbr ? 1 : 0);
  }

  function patchTerrain(mat) {
    mat.onBeforeCompile = function (sh) {
      const u = G.uni;
      Object.assign(sh.uniforms, {
        uZoneTex: u.uZoneTex, uOvTex: u.uOvTex, uOvOn: u.uOvOn, uWorld: u.uWorld, uGrid: u.uGrid,
        uBrush: u.uBrush, uBrushOn: u.uBrushOn, uBrushCol: u.uBrushCol, uTile: { value: T }, uPlay: u.uPlay, uDetail: u.uDetail,
      });
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
uniform sampler2D uZoneTex; uniform sampler2D uOvTex; uniform float uOvOn; uniform float uWorld; uniform float uGrid;
uniform vec4 uBrush; uniform float uBrushOn; uniform vec3 uBrushCol; uniform float uTile; uniform vec2 uPlay; uniform float uDetail;
varying vec3 vWP;
float th(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float tn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(th(i), th(i+vec2(1,0)), f.x), mix(th(i+vec2(0,1)), th(i+vec2(1,1)), f.x), f.y); }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
if (uDetail > 0.5) {
  // grass: patchy colour at a few scales, fading the fine detail with distance
  vec2 p = vWP.xz;
  float fine = clamp(1.4 - length(fwidth(p * 2.5)) * 3.0, 0.0, 1.0);
  float n = tn(p * 0.05) * 0.45 + tn(p * 0.3) * 0.35 + tn(p * 2.5) * 0.2 * fine;
  float green = step(diffuseColor.r * 1.05, diffuseColor.g);
  diffuseColor.rgb *= mix(1.0, 0.8 + 0.4 * n, green);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.12, 1.05, 0.72), green * smoothstep(0.6, 0.85, tn(p * 0.012)) * 0.7);
}
vec2 tuv = vWP.xz / uWorld;
vec4 zt = texture2D(uZoneTex, tuv);
diffuseColor.rgb = mix(diffuseColor.rgb, zt.rgb, zt.a);
if (uGrid > 0.5 && zt.a > 0.01) {
  vec2 gc = vWP.xz / uTile; vec2 g = fract(gc); vec2 fw = fwidth(gc) * 1.5;
  vec2 e = smoothstep(vec2(0.0), fw, g) * smoothstep(vec2(0.0), fw, 1.0 - g);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95), (1.0 - e.x * e.y) * 0.6);
}
if (uOvOn > 0.5) {
  vec4 ov = texture2D(uOvTex, tuv);
  float l = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
  diffuseColor.rgb = mix(vec3(0.22 + l * 0.5), ov.rgb, ov.a * 0.85);
}
if (uBrushOn > 0.5 && vWP.x > uBrush.x && vWP.x < uBrush.z && vWP.z > uBrush.y && vWP.z < uBrush.w) {
  diffuseColor.rgb = mix(diffuseColor.rgb, uBrushCol, 0.45);
}
float inside = step(uPlay.x, vWP.x) * step(vWP.x, uPlay.y) * step(uPlay.x, vWP.z) * step(vWP.z, uPlay.y);
diffuseColor.rgb *= mix(0.72, 1.0, inside);`);
    };
    mat.customProgramCacheKey = () => 'terrain';
  }

  function patchWater(mat, waves) {
    mat.onBeforeCompile = function (sh) {
      sh.uniforms.uTime = G.uni.uTime;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      let fs = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uTime; varying vec3 vWP;');
      if (waves) {
        fs = fs.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
vec2 wp = vWP.xz;
float w1 = sin(wp.x * 0.08 + uTime * 1.3) + sin(wp.y * 0.11 - uTime * 1.1) + sin((wp.x + wp.y) * 0.23 + uTime * 2.1) * 0.6 + sin(wp.x*0.5 - uTime*3.0)*0.25;
float w2 = cos(wp.x * 0.09 - uTime * 1.2) + cos(wp.y * 0.07 + uTime * 1.5) + cos((wp.x - wp.y) * 0.19 - uTime * 1.7) * 0.6 + cos(wp.y*0.45 + uTime*2.7)*0.25;
normal = normalize(normal + (viewMatrix * vec4(w1 * 0.05, 0.0, w2 * 0.05, 0.0)).xyz);`);
      }
      sh.fragmentShader = fs;
    };
    mat.customProgramCacheKey = () => 'water' + (waves ? 1 : 0);
  }

  function makeMaterials() {
    const s = G.settings;
    const pbr = s.lighting !== 'simple';
    const m = G.mats || {};
    if (m.city) m.city.dispose();
    if (m.terrain) m.terrain.dispose();
    if (m.water) m.water.dispose();
    m.city = pbr ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.02 })
      : new THREE.MeshLambertMaterial({ vertexColors: true });
    patchCity(m.city, pbr);
    m.terrain = pbr ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97, metalness: 0 })
      : new THREE.MeshLambertMaterial({ vertexColors: true });
    patchTerrain(m.terrain);
    const waves = s.water === 'waves';
    m.water = new THREE.MeshStandardMaterial({ color: 0x2c6a80, roughness: waves ? 0.06 : 0.25, metalness: 0.1, transparent: true, opacity: 0.86 });
    patchWater(m.water, waves);
    if (!m.ghost) {
      m.ghost = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false, vertexColors: false });
      m.ghostInst = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false });
      m.ring = new THREE.MeshBasicMaterial({ color: 0x7fd4ff, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
      m.line = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.92, depthWrite: false, side: THREE.DoubleSide });
    }
    G.mats = m;
    // reassign
    G.cityMeshes.forEach(mesh => { mesh.material = m.city; });
    if (G.terrain) G.terrain.material = m.terrain;
    if (G.water) G.water.material = m.water;
  }

  // ---------------- init ----------------
  G.init = function (container, settings) {
    G.container = container;
    G.settings = settings;
    G.scene = new THREE.Scene();
    G.camera = new THREE.PerspectiveCamera(48, 1, 1.5, settings.view * 1.6);
    const zoneData = new Uint8Array(W * W * 4);
    const ovData = new Uint8Array(W * W * 4);
    const mk = (d) => { const t = new THREE.DataTexture(d, W, W, THREE.RGBAFormat); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.needsUpdate = true; return t; };
    G.zoneTex = mk(zoneData); G.ovTex = mk(ovData);
    G.uni = {
      uNight: { value: 0 }, uLit: { value: 0.3 }, uTime: { value: 0 }, uDetail: { value: settings.detail ? 1 : 0 },
      uOvOn: { value: 0 }, uOvTex: { value: G.ovTex }, uWorld: { value: C.WORLD },
      uZoneTex: { value: G.zoneTex }, uGrid: { value: 0 },
      uBrush: { value: new THREE.Vector4() }, uBrushOn: { value: 0 }, uBrushCol: { value: new THREE.Color(0.3, 0.85, 1.0) },
      uPlay: { value: new THREE.Vector2(C.P0 * T, C.P1 * T) },
    };
    createRenderer();
    makeMaterials();

    // lights
    G.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x4a4236, 0.9);
    G.scene.add(G.hemi);
    G.sun = new THREE.DirectionalLight(0xffffff, 2.6);
    G.sun.shadow.bias = -0.0004;
    G.sun.shadow.normalBias = 0.6;
    G.scene.add(G.sun); G.scene.add(G.sun.target);

    // sky
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, bot: { value: new THREE.Color() },
        sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, night: { value: 0 },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
      fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 bot; uniform vec3 sunDir; uniform vec3 sunCol; uniform float night; varying vec3 vDir;
float h2(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
void main(){ vec3 d = normalize(vDir); float h = d.y;
 vec3 c = h > 0.0 ? mix(hor, top, pow(clamp(h,0.0,1.0), 0.55)) : mix(hor, bot, pow(clamp(-h,0.0,1.0), 0.35));
 float s = max(dot(d, normalize(sunDir)), 0.0);
 c += sunCol * (pow(s, 600.0) * 4.0 + pow(s, 12.0) * 0.18);
 if (night > 0.01 && h > 0.05) { vec3 q = floor(d * 380.0); float st = step(0.9975, h2(q)); c += vec3(st) * night * 0.9 * smoothstep(0.05, 0.3, h); }
 gl_FragColor = vec4(c, 1.0);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    G.sky = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), skyMat);
    G.sky.renderOrder = -10; G.sky.frustumCulled = false;
    G.scene.add(G.sky);
    G.scene.fog = new THREE.Fog(0xc4dcf0, 400, settings.view);

    buildTerrain();
    // water
    const wg = new THREE.PlaneGeometry(C.WORLD * 3, C.WORLD * 3, 1, 1);
    wg.rotateX(-Math.PI / 2);
    G.water = new THREE.Mesh(wg, G.mats.water);
    G.water.position.set(C.WORLD / 2, C.WATER, C.WORLD / 2);
    G.water.receiveShadow = true;
    G.scene.add(G.water);


    // camera rig
    const hw = CB.World.hwRow;
    G.cam = { tx: (C.P0 + 22) * T, tz: (hw + 0.5) * T, ty: 4, dist: 260, tdist: 260, yaw: 2.35, pitch: 0.72, keys: {} };
    G.cam.yaw = -0.6 + Math.PI;
    G.applySettings(settings, true);
    window.addEventListener('resize', G.resize);
    G.resize();
  };

  function createRenderer() {
    const s = G.settings;
    if (G.renderer) {
      G.renderer.dispose();
      G.renderer.domElement.remove();
    }
    const r = new THREE.WebGLRenderer({ antialias: !!s.aa, powerPreference: 'high-performance' });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = s.shadows > 0;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    G.container.prepend(r.domElement);
    r.domElement.id = 'gl';
    G.renderer = r;
    G.aaState = !!s.aa;
  }

  G.applySettings = function (s, first) {
    G.settings = s;
    if (G.uni) G.uni.uDetail.value = s.detail ? 1 : 0;
    if (!first && G.aaState !== !!s.aa) createRenderer();
    const r = G.renderer;
    const dpr = window.devicePixelRatio || 1;
    r.setPixelRatio(Math.min(dpr * 1, s.res) );
    r.shadowMap.enabled = s.shadows > 0;
    G.sun.castShadow = s.shadows > 0;
    if (s.shadows > 0) {
      if (G.sun.shadow.map) { G.sun.shadow.map.dispose(); G.sun.shadow.map = null; }
      G.sun.shadow.mapSize.set(s.shadows, s.shadows);
    }
    G.camera.far = s.view * 1.6;
    G.camera.updateProjectionMatrix();
    G.scene.fog.far = s.view;
    G.scene.fog.near = s.view * 0.25;
    const pbr = s.lighting !== 'simple';
    const needMat = !G.mats || (G.mats.city.isMeshStandardMaterial !== pbr) || G.matWater !== s.water;
    G.matWater = s.water;
    if (needMat && !first) makeMaterials();
    // force shader recompile for shadow state change
    G.scene.traverse(o => { if (o.material && !Array.isArray(o.material)) o.material.needsUpdate = true; });
    G.resize();
  };

  G.resize = function () {
    const w = G.container.clientWidth, h = G.container.clientHeight;
    G.renderer.setSize(w, h, false);
    G.renderer.domElement.style.width = w + 'px';
    G.renderer.domElement.style.height = h + 'px';
    G.camera.aspect = w / Math.max(1, h);
    G.camera.updateProjectionMatrix();
  };

  // ---------------- terrain ----------------
  function buildTerrain() {
    const Wd = CB.World;
    const n = W + 1;
    const pos = new Float32Array(n * n * 3), col = new Float32Array(n * n * 3);
    const noise = U.makeNoise(Wd.seed + 333);
    const grassA = U.hex('#5b7f37'), grassB = U.hex('#7b9443'), dry = U.hex('#9c9a5c'), sand = U.hex('#cdbb8b'),
      mud = U.hex('#6d6248'), rock = U.hex('#7c766c'), snow = U.hex('#eef0f3'), forest = U.hex('#46662d');
    const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const k = y * n + x;
        const h = Wd.cornerH(x, y);
        pos[k * 3] = x * T; pos[k * 3 + 1] = h; pos[k * 3 + 2] = y * T;
        const hx = Wd.cornerH(Math.min(x + 1, W), y) - Wd.cornerH(Math.max(x - 1, 0), y);
        const hy = Wd.cornerH(x, Math.min(y + 1, W)) - Wd.cornerH(x, Math.max(y - 1, 0));
        const sl = Math.sqrt(hx * hx + hy * hy) / (2 * T);
        const nv = U.fbm(noise, x * 0.07, y * 0.07, 3);
        let c = mix(grassA, grassB, U.clamp(0.5 + nv * 0.9, 0, 1));
        c = mix(c, dry, U.clamp((h - 7) / 10, 0, 0.6));
        // forest floor
        const ti = U.idx(Math.min(x, W - 1), Math.min(y, W - 1));
        if (Wd.tree[ti] >= 2) c = mix(c, forest, 0.45);
        if (h < 1.1) c = mix(sand, c, U.clamp((h - 0.25) / 0.85, 0, 1));
        if (h < 0.2) c = mix(mud, sand, U.clamp((h + 3) / 3.2, 0, 1));
        c = mix(c, rock, U.clamp((sl - 0.35) * 2.2, 0, 1));
        c = mix(c, rock, U.clamp((h - 32) / 18, 0, 1));
        c = mix(c, snow, U.clamp((h - 72) / 12, 0, 1) * U.clamp(1.2 - sl, 0, 1));
        col[k * 3] = U.lin(c[0]); col[k * 3 + 1] = U.lin(c[1]); col[k * 3 + 2] = U.lin(c[2]);
      }
    }
    const idx = new Uint32Array(W * W * 6);
    let q = 0;
    for (let y = 0; y < W; y++) {
      for (let x = 0; x < W; x++) {
        const a = y * n + x, b = a + 1, c = a + n, d = c + 1;
        idx[q++] = a; idx[q++] = c; idx[q++] = b;
        idx[q++] = b; idx[q++] = c; idx[q++] = d;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    G.terrain = new THREE.Mesh(g, G.mats.terrain);
    G.terrain.receiveShadow = true;
    G.scene.add(G.terrain);
  }

  // heights changed (building lots levelled): move the terrain vertices and recompute normals
  G.refreshTerrain = function () {
    const Wd = CB.World, n = W + 1, g = G.terrain.geometry, pos = g.attributes.position.array;
    for (let k = 0; k < n * n; k++) pos[k * 3 + 1] = Wd.hc[k];
    g.attributes.position.needsUpdate = true;
    g.computeVertexNormals();
    g.computeBoundingSphere();
  };

  // ---------------- time of day ----------------
  const KEYS = [
    { h: 0, top: '#060c1e', hor: '#1a2846', sun: '#8aa4ff', si: 0.45, hemi: 0.42, sky: '#41588a', gnd: '#1a2230', night: 1 },
    { h: 4.8, top: '#0b1430', hor: '#26355a', sun: '#8aa4ff', si: 0.45, hemi: 0.44, sky: '#44598a', gnd: '#1a2230', night: 1 },
    { h: 6.0, top: '#2a3f70', hor: '#e49a68', sun: '#ffae6c', si: 0.9, hemi: 0.5, sky: '#9fb2d8', gnd: '#4a3d30', night: 0.45 },
    { h: 7.6, top: '#3f7bc4', hor: '#b7d1e8', sun: '#fff0d4', si: 2.3, hemi: 0.85, sky: '#bcd4f2', gnd: '#4f4637', night: 0 },
    { h: 12, top: '#3874c4', hor: '#c2daee', sun: '#fffaf0', si: 2.9, hemi: 1.0, sky: '#c6dcf6', gnd: '#544a3a', night: 0 },
    { h: 16.8, top: '#3c74bd', hor: '#c8d6e2', sun: '#ffefd2', si: 2.5, hemi: 0.9, sky: '#c2d4ec', gnd: '#544838', night: 0 },
    { h: 18.6, top: '#2e3c76', hor: '#f08858', sun: '#ff9258', si: 0.95, hemi: 0.5, sky: '#a39ec8', gnd: '#4a3a2e', night: 0.4 },
    { h: 20.2, top: '#0b1430', hor: '#2a3558', sun: '#8aa4ff', si: 0.45, hemi: 0.44, sky: '#44598a', gnd: '#1a2230', night: 1 },
    { h: 24, top: '#060c1e', hor: '#1a2846', sun: '#8aa4ff', si: 0.45, hemi: 0.42, sky: '#41588a', gnd: '#1a2230', night: 1 },
  ];
  const cA = new THREE.Color(), cB = new THREE.Color();
  function lerpCol(target, a, b, t) { cA.set(a); cB.set(b); target.copy(cA).lerp(cB, t); }
  G.sunDir = new THREE.Vector3(0, 1, 0);
  G.setTime = function (hour) {
    if (!G.settings.dayNight) hour = 13;
    let k = 0;
    while (k < KEYS.length - 2 && KEYS[k + 1].h <= hour) k++;
    const a = KEYS[k], b = KEYS[k + 1];
    const t = U.clamp((hour - a.h) / (b.h - a.h), 0, 1);
    const sk = G.sky.material.uniforms;
    lerpCol(sk.top.value, a.top, b.top, t);
    lerpCol(sk.hor.value, a.hor, b.hor, t);
    sk.bot.value.copy(sk.hor.value).multiplyScalar(0.6);
    lerpCol(G.sun.color, a.sun, b.sun, t);
    G.sun.intensity = U.lerp(a.si, b.si, t);
    G.hemi.intensity = U.lerp(a.hemi, b.hemi, t);
    lerpCol(G.hemi.color, a.sky, b.sky, t);
    lerpCol(G.hemi.groundColor, a.gnd, b.gnd, t);
    const night = U.lerp(a.night, b.night, t);
    G.uni.uNight.value = night;
    G.uni.uLit.value = 0.08 + night * 0.32;
    sk.night.value = night;
    G.scene.fog.color.copy(sk.hor.value);
    // sun path
    const ang = (hour - 6) / 12 * Math.PI;
    const el = Math.sin(ang);
    if (el > -0.05) {
      G.sunDir.set(Math.cos(ang) * 0.85, Math.max(0.08, el * 0.92), 0.45).normalize();
      sk.sunCol.value.copy(G.sun.color).multiplyScalar(night > 0.9 ? 0 : 1);
    } else {
      G.sunDir.set(-0.35, 0.8, 0.45).normalize(); // moon
      sk.sunCol.value.setRGB(0, 0, 0);
    }
    sk.sunDir.value.copy(G.sunDir);
    G.night = night;
  };

  // ---------------- camera ----------------
  G.updateCamera = function (dt) {
    const c = G.cam, k = c.keys;
    const spd = c.dist * 1.25 * (k.Shift ? 2.5 : 1);
    const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw);
    const rx = Math.cos(c.yaw), rz = -Math.sin(c.yaw);
    let mx = 0, mz = 0;
    if (k.w || k.ArrowUp) { mx += fx; mz += fz; }
    if (k.s || k.ArrowDown) { mx -= fx; mz -= fz; }
    if (k.d || k.ArrowRight) { mx += rx; mz += rz; }
    if (k.a || k.ArrowLeft) { mx -= rx; mz -= rz; }
    c.tx += mx * spd * dt; c.tz += mz * spd * dt;
    if (k.q) c.yaw += 1.6 * dt;
    if (k.e) c.yaw -= 1.6 * dt;
    if (k.r) c.tdist *= Math.exp(-1.6 * dt);
    if (k.f) c.tdist *= Math.exp(1.6 * dt);
    if (k.t) c.pitch = Math.min(1.45, c.pitch + 0.9 * dt);
    if (k.g) c.pitch = Math.max(0.12, c.pitch - 0.9 * dt);
    c.tdist = U.clamp(c.tdist, 22, 1900);
    c.dist += (c.tdist - c.dist) * Math.min(1, dt * 10);
    c.tx = U.clamp(c.tx, C.P0 * T - 150, C.P1 * T + 150);
    c.tz = U.clamp(c.tz, C.P0 * T - 150, C.P1 * T + 150);
    const gh = Math.max(CB.World.groundH(c.tx, c.tz), C.WATER);
    c.ty += (gh - c.ty) * Math.min(1, dt * 4);
    const cp = Math.cos(c.pitch);
    let px = c.tx + Math.sin(c.yaw) * cp * c.dist;
    let pz = c.tz + Math.cos(c.yaw) * cp * c.dist;
    let py = c.ty + Math.sin(c.pitch) * c.dist;
    const g2 = Math.max(CB.World.groundH(px, pz), C.WATER) + 3;
    if (py < g2) py = g2;
    G.camera.position.set(px, py, pz);
    G.camera.lookAt(c.tx, c.ty, c.tz);
    // push the near plane out as the camera pulls back: keeps depth precision (no z-fighting)
    const nearP = U.clamp(c.dist * 0.04, 0.6, 30);
    if (Math.abs(G.camera.near - nearP) > 0.05) { G.camera.near = nearP; G.camera.updateProjectionMatrix(); }
    G.sky.position.copy(G.camera.position);
    G.sky.scale.setScalar(G.settings.view * 1.4);
    // shadows follow the view
    if (G.sun.castShadow) {
      const ext = U.clamp(c.dist * 0.95, 70, 650);
      const sc = G.sun.shadow.camera;
      if (sc.right !== ext) {
        sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext;
        sc.near = 1; sc.far = 2400; sc.updateProjectionMatrix();
      }
      const texel = (2 * ext) / G.settings.shadows;
      const tx = Math.round(c.tx / texel) * texel, tz = Math.round(c.tz / texel) * texel;
      G.sun.target.position.set(tx, c.ty, tz);
      G.sun.position.set(tx + G.sunDir.x * 900, c.ty + G.sunDir.y * 900, tz + G.sunDir.z * 900);
    } else {
      G.sun.target.position.set(c.tx, c.ty, c.tz);
      G.sun.position.set(c.tx + G.sunDir.x * 900, c.ty + G.sunDir.y * 900, c.tz + G.sunDir.z * 900);
    }
  };
  G.focus = function (wx, wz, dist) {
    G.cam.tx = wx; G.cam.tz = wz; if (dist) G.cam.tdist = dist;
  };

  // ---------------- picking ----------------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  G.pick = function (clientX, clientY) {
    const rect = G.renderer.domElement.getBoundingClientRect();
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    ray.setFromCamera(ndc, G.camera);
    const o = ray.ray.origin, d = ray.ray.direction;
    if (d.y > -0.001) return null;
    const Wd = CB.World;
    const surf = (x, z) => Math.max(Wd.groundH(x, z), C.WATER);
    let t = 0, step = Math.max(1.5, G.cam.dist / 120);
    let prev = 0;
    const maxT = G.settings.view * 1.5;
    while (t < maxT) {
      const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
      if (y <= surf(x, z)) {
        let lo = prev, hi = t;
        for (let i = 0; i < 10; i++) {
          const m = (lo + hi) / 2;
          const yy = o.y + d.y * m;
          if (yy <= surf(o.x + d.x * m, o.z + d.z * m)) hi = m; else lo = m;
        }
        const px = o.x + d.x * hi, pz = o.z + d.z * hi;
        const tx = Math.floor(px / T), ty = Math.floor(pz / T);
        return { x: px, z: pz, y: o.y + d.y * hi, tx, ty, i: U.inWorld(tx, ty) ? U.idx(tx, ty) : -1 };
      }
      prev = t; t += step;
      step *= 1.01;
    }
    return null;
  };

  G.render = function () {
    G.renderer.render(G.scene, G.camera);
  };
})();
