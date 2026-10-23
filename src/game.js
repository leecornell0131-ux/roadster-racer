// Roadster Racer — engine. Stage content (track, scenery, traffic mix, boss, texts) lives in src/stages/.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { makeRoadster, makeWaymo, makeCybercab, makeRTX5090, makeH100, makeBlackwell } from './models.js';
import { upgradeRoadster, loadCar, instance, addSensorKit, fleet, CARS } from './realcars.js';
import { createBoss } from './boss.js';
import { STAGES, ORDER } from './stages/index.js';

// ---------- quality ----------
const IS_MOBILE = matchMedia('(pointer: coarse)').matches || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
const Q = IS_MOBILE
  ? { pr: Math.min(devicePixelRatio, 1.5), shadow: 1024, bStep: 24, bloomRes: 0.5 }
  : { pr: Math.min(devicePixelRatio, 2), shadow: 2048, bStep: 17, bloomRes: 1 };

// ---------- stage ----------
const STAGE_KEY = 'roadster-racer-stage';
const ST = (() => {
  let id = new URLSearchParams(location.search).get('stage');
  if (!STAGES[id]) try { id = localStorage.getItem(STAGE_KEY); } catch {}
  return STAGES[id] || ORDER[0];
})();
function goStage(id) { try { localStorage.setItem(STAGE_KEY, id); } catch {} location.reload(); }

// ---------- tuning ----------
const G = 32;
const ROAD_HALF = ST.roadHalf;
const LANES = ST.lanes;
const GAPS = ST.gaps || [];
const FINISH_S = ST.finish;
const CEILINGS = ST.ceilings || [];
const JUMP_V = 13;
const AIR_FUEL = 1.3;                     // seconds of landing thrust

// ---------- cast ----------
// Display names live here so parody names can replace real ones in one place.
export const CAST = {
  hero: { name: '일론', ava: 'EM' },
};

// ---------- save ----------
const SAVE_KEY = 'roadster-racer-save-v1';
const save = loadSave();
function loadSave() {
  const base = () => ({ level: 1, xp: 0, doge: 0, best: 0, bests: {}, up: { magnet: 0, tank: 0, comp: 0, motor: 0 } });
  try {
    const s = Object.assign(base(), JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); s.up = Object.assign(base().up, s.up);
    if (s.best && !s.bests.austin) s.bests.austin = s.best; // v1 saves kept one best time (Austin)
    return s;
  }
  catch { return base(); }
}
let saveTimer = 0;
function writeSaveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(writeSave, 800); }
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch {} }
const xpNeed = (lv) => 100 + (lv - 1) * 80;
// ---------- upgrades (X Garage) ----------
// cost(lv) is the price of the next level; Dogecoin only (soft currency).
const UPGRADES = {
  magnet: { name: '자석', desc: (l) => `끌어당김 범위 ${magnetRange(l).toFixed(1)}m`, max: 8, cost: (l) => Math.round(60 * Math.pow(1.55, l)) },
  tank: { name: '압축공기 탱크', desc: (l) => `점프 최대 +${l}회`, max: 4, cost: (l) => Math.round(180 * Math.pow(1.9, l)) },
  comp: { name: '컴프레서', desc: (l) => `점프 충전 ${recharge(l).toFixed(1)}초`, max: 5, cost: (l) => Math.round(90 * Math.pow(1.65, l)) },
  motor: { name: '듀얼 모터', desc: (l) => `최고속도 +${l * 4 * 3.6 | 0}km/h`, max: 6, cost: (l) => Math.round(110 * Math.pow(1.6, l)) },
};
const magnetRange = (l = save.up.magnet) => 3 + l * 1.6 + (save.level - 1) * 0.15;
const recharge = (l = save.up.comp) => 8 - l * 0.9;
const maxCharges = () => Math.min(12, 2 + save.level + save.up.tank);

// ---------- track geometry ----------
const cx = ST.cx;
// road height above sea level along the track; every y in track space is measured from it
const elev = ST.elev || (() => 0);
const elevSlope = (s) => elev(s + 0.5) - elev(s - 0.5);
const _f = new THREE.Vector3(), _r = new THREE.Vector3();
function frame(s) {
  const dx = (cx(s + 0.5) - cx(s - 0.5));
  const L = Math.hypot(dx, 1);
  _f.set(dx / L, 0, -1 / L);
  _r.set(1 / L, 0, dx / L);
  return { x: cx(s), z: -s, f: _f, r: _r, yaw: Math.atan2(-_f.x, -_f.z) };
}
function world(s, d, y, out = new THREE.Vector3()) {
  const fr = frame(s);
  return out.set(fr.x + fr.r.x * d, y + elev(s), fr.z + fr.r.z * d);
}

// ramps: {s0, len, dL, dR, h}
const RAMPS = ST.ramps;
function rampAt(s, d) {
  for (const r of RAMPS) if (s >= r.s0 && s <= r.s0 + r.len && d >= r.dL && d <= r.dR) return r;
  return null;
}
// the car is ~1.8 m wide: it rides up a ramp if either side is on it.
// With yRef (the car's height) roofs count too: anything you're at or above can be landed on.
function carGround(s, d, yRef) {
  const g = Math.max(groundAt(s, d - 0.8), groundAt(s, d), groundAt(s, d + 0.8));
  if (yRef == null) return g;
  return Math.max(g, roofAt(s, d - 0.7, yRef), roofAt(s, d, yRef), roofAt(s, d + 0.7, yRef));
}
// raised things you can drive along (bridge cables): { s0, s1, y(s), d(s), w(s) half width }
const SURFACES = ST.surfaces || [];
const surfaceAt = (s, d, yRef) => { for (const u of SURFACES) if (s > u.s0 && s < u.s1 && Math.abs(d - u.d(s)) < u.w(s) && yRef >= u.y(s) - 0.7) return u; return null; };
// lateral reach: some stretches (a bridge) let you leave the deck when up high, over open water
const reach = (s, y) => (ST.wide && s > ST.wide.s0 && s < ST.wide.s1 && y > 1.5 ? ST.wide.half : ROAD_HALF - 1.2);
function groundAt(s, d) {
  for (const g of GAPS) if (s > g.s0 && s < g.s1) return -1e9;
  if (ST.wide && s > ST.wide.s0 && s < ST.wide.s1 && Math.abs(d) > ROAD_HALF) return -1e9;
  const r = rampAt(s, d);
  return r ? r.h * (s - r.s0) / r.len : 0;
}
function roofAt(s, d, yRef) {
  let top = -1e9;
  for (const t of traffic) {
    if (Math.abs(t.s - s) > t.hl * 0.92 || Math.abs(t.d - d) > t.hw * 0.85) continue;
    const r = t.y + t.h;
    if (yRef >= r - 0.7 && r > top) top = r;
  }
  for (const c of CEILINGS) if (!c.holes && s > c.s0 && s < c.s1 && yRef >= c.y1 - 0.7 && c.y1 > top) top = c.y1; // overpass decks are floors from above
  for (const u of SURFACES) if (s > u.s0 && s < u.s1 && Math.abs(d - u.d(s)) < u.w(s)) { const y = u.y(s); if (yRef >= y - 0.7 && y > top) top = y; }
  const b = boss?.roofAt?.(s, d, yRef);
  return b != null && b > top ? b : top;
}

// ---------- renderer / scene ----------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !IS_MOBILE, powerPreference: 'high-performance' });
renderer.setPixelRatio(Q.pr);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;

const scene = new THREE.Scene();
const ENV = ST.env;
const FOG = new THREE.Color(ENV.fog[0]);
scene.fog = new THREE.Fog(FOG, ENV.fog[1], ENV.fog[2]);
renderer.toneMappingExposure = ENV.exposure ?? 0.92;
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.3, 3000);

// sky
const SUN_DIR = new THREE.Vector3(...(ENV.sunDir || [-0.35, 0.3, -1])).normalize();
const SKY = ENV.sky || { top: [0.2, 0.36, 0.62], mid: [0.42, 0.56, 0.76], hor: [0.8, 0.78, 0.72], low: [0.5, 0.46, 0.4], glow: [1, 0.9, 0.7] };
const v3 = (a) => `vec3(${a.map((x) => x.toFixed(3)).join(',')})`;
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { sunDir: { value: SUN_DIR } },
  vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
  fragmentShader: `varying vec3 vP; uniform vec3 sunDir;
    void main(){ float h = vP.y;
      vec3 top = ${v3(SKY.top)}, mid = ${v3(SKY.mid)}, hor = ${v3(SKY.hor)}, low = ${v3(SKY.low)};
      vec3 c = h > 0.0 ? mix(hor, mix(mid, top, smoothstep(0.15,0.7,h)), smoothstep(0.0,0.18,h)) : mix(hor*0.6, low, smoothstep(0.0,-0.2,h));
      float sd = max(dot(vP, sunDir), 0.0);
      c += ${v3(SKY.glow)} * pow(sd, 18.0) * 0.9 + vec3(1.0,0.85,0.6) * pow(sd, 900.0) * 6.0;
      gl_FragColor = vec4(c, 1.0); }`,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(2400, 32, 16), skyMat);
scene.add(sky);
{
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), skyMat));
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(envScene, 0.02).texture;
  // real HDRI (CC0, Poly Haven), stored as RGBE bytes in a grayscale PNG; with env.bg it is also the sky
  const img = new Image();
  img.onload = () => {
    try {
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
      const src = g.getImageData(0, 0, c.width, c.height).data, W = c.width / 4, H = c.height;
      const f = new Float32Array(W * H * 4);
      let best = -1, bi = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x, o = ((ENV.envUpsideDown ? y : H - 1 - y) * W + x) * 4; // PNG rows run top-down, texture rows bottom-up
        const e = src[(i * 4 + 3) * 4], k = e ? Math.pow(2, e - 136) : 0;
        const cap = ENV.hdrMax ?? Infinity; // a very hot sun disc overflows the half-float bloom buffers (black frame)
        f[o] = Math.min(cap, src[i * 16] * k); f[o + 1] = Math.min(cap, src[(i * 4 + 1) * 4] * k); f[o + 2] = Math.min(cap, src[(i * 4 + 2) * 4] * k); f[o + 3] = 1;
        const l = f[o] + f[o + 1] + f[o + 2]; if (l > best) { best = l; bi = o / 4; }
      }
      const tex = new THREE.DataTexture(f, W, H, THREE.RGBAFormat, THREE.FloatType);
      tex.mapping = THREE.EquirectangularReflectionMapping; tex.colorSpace = THREE.LinearSRGBColorSpace;
      tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.flipY = false; tex.needsUpdate = true;
      scene.environment = pm.fromEquirectangular(tex).texture;
      if (ENV.bg) {
        // aim the shadow-casting sun at the HDRI's sun
        const u = (bi % W + 0.5) / W, v = (Math.floor(bi / W) + 0.5) / H;
        const phi = (u - 0.5) * Math.PI * 2, el = (v - 0.5) * Math.PI;
        SUN_DIR.set(Math.cos(phi) * Math.cos(el), Math.sin(el), Math.sin(phi) * Math.cos(el));
        scene.background = tex; scene.backgroundIntensity = ENV.bgIntensity ?? 1; sky.visible = false;
      } else tex.dispose();
    } catch (err) { console.warn('HDRI skipped', err); }
  };
  img.src = ENV.hdri;
}

scene.add(new THREE.HemisphereLight(...ENV.hemi));
const sun = new THREE.DirectionalLight(...ENV.sun);
sun.castShadow = true;
sun.shadow.mapSize.set(Q.shadow, Q.shadow);
Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 200 });
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);

// ---------- textures ----------
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}
// ---------- photo textures (CC0: Poly Haven, ambientCG) ----------
const texLoader = new THREE.TextureLoader();
function photo(url, { srgb = true, rep = [1, 1], onload } = {}) {
  const t = texLoader.load('assets/tex/' + url, onload);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 8;
  return t;
}
// lane paint drawn over real asphalt: one canvas tile = the road's width x 24 m
const ROAD = ST.road || {};
function drawRoad(g, w, h, asphalt) {
  const tiles = Math.max(4, Math.round(ROAD_HALF / 3));
  if (asphalt) { for (let x = 0; x < tiles; x++) for (let y = 0; y < 4; y++) g.drawImage(asphalt, x * w / tiles, y * h / 4, w / tiles + 1, h / 4 + 1); g.fillStyle = ROAD.tint || 'rgba(20,16,26,0.35)'; g.fillRect(0, 0, w, h); }
  else { g.fillStyle = '#26222b'; g.fillRect(0, 0, w, h); }
  const lw = 0.15 / (ROAD_HALF * 2) * w; // 15 cm lines
  const paint = (c, x, y0, ww, hh) => { g.fillStyle = c; g.globalAlpha = 0.88; g.fillRect(x, y0, ww, hh); g.globalAlpha = 1; };
  paint('#e9e4f0', w * 0.012, 0, lw, h); paint('#e9e4f0', w * 0.988 - lw, 0, lw, h);
  for (const u of ROAD.dashes || [0.25, 0.75]) paint('#e9e4f0', w * u - lw / 2, 0, lw, h * 0.4);
  if (ROAD.yellow ?? true) { paint('#ffc83d', w * 0.5 - lw * 1.5, 0, lw, h); paint('#ffc83d', w * 0.5 + lw * 0.5, 0, lw, h); }
}
const roadTex = canvasTex(1024, 1024, (g, w, h) => drawRoad(g, w, h), true);
photo(`${ROAD.tex || 'asphalt'}_diff.jpg`, { onload: (t) => { const c = roadTex.image; drawRoad(c.getContext('2d'), c.width, c.height, t.image); roadTex.needsUpdate = true; } });
const hazardTex = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#ffc400'; g.fillRect(0, 0, w, h); g.fillStyle = '#141414';
  for (let i = -w; i < w * 2; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 16, 0); g.lineTo(i + 16 - h, h); g.lineTo(i - h, h); g.fill(); }
}, true);
function textTex(text, color, opts = {}) {
  const w = opts.w || 512, h = opts.h || 160;
  return canvasTex(w, h, (g) => {
    g.clearRect(0, 0, w, h);
    if (opts.bg) { g.fillStyle = opts.bg; g.fillRect(0, 0, w, h); }
    g.font = `${opts.weight || 900} ${opts.size || 96}px "Black Han Sans", "Noto Sans KR", sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (opts.frame) { g.strokeStyle = color; g.lineWidth = 8; g.shadowColor = color; g.shadowBlur = 24; g.strokeRect(14, 14, w - 28, h - 28); }
    g.shadowColor = color; g.shadowBlur = opts.glow ?? 28; g.fillStyle = opts.fill || color;
    g.fillText(text, w / 2, h / 2 + 4);
    g.shadowBlur = 0; g.fillText(text, w / 2, h / 2 + 4);
  });
}

// ---------- ribbon builder ----------
function ribbon(s0, s1, dL, dR, step, yFn, uvLen = 0) {
  const segs = Math.max(1, Math.ceil((s1 - s0) / step));
  const pos = [], uv = [], idx = [];
  const v = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const s = s0 + (s1 - s0) * i / segs;
    for (let j = 0; j < 2; j++) {
      const d = j ? dR : dL;
      world(s, d, yFn(s, d), v); pos.push(v.x, v.y, v.z);
      uv.push(j, uvLen ? s / uvLen : i / segs);
    }
    if (i < segs) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}
// vertical wall following the track at lateral d, between y0(s) and y1(s); uv in metres / uvLen
function wall(s0, s1, d, step, y0Fn, y1Fn, uvLen = 1) {
  const segs = Math.max(1, Math.ceil((s1 - s0) / step));
  const pos = [], uv = [], idx = [], v = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const s = s0 + (s1 - s0) * i / segs;
    const a0 = y0Fn(s), a1 = y1Fn(s);
    world(s, d, a0, v); pos.push(v.x, v.y, v.z); uv.push(s / uvLen, a0 / uvLen);
    world(s, d, a1, v); pos.push(v.x, v.y, v.z); uv.push(s / uvLen, a1 / uvLen);
    if (i < segs) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}
// terrain sheet over (s, d) with height yFn(s, d); uv in metres / uvLen
function grid(s0, s1, dL, dR, stepS, stepD, yFn, uvLen = 1) {
  const ns = Math.max(1, Math.ceil((s1 - s0) / stepS)), nd = Math.max(1, Math.ceil((dR - dL) / stepD));
  const pos = new Float32Array((ns + 1) * (nd + 1) * 3), uv = new Float32Array((ns + 1) * (nd + 1) * 2), idx = [];
  const v = new THREE.Vector3();
  for (let i = 0; i <= ns; i++) for (let j = 0; j <= nd; j++) {
    const s = s0 + (s1 - s0) * i / ns, d = dL + (dR - dL) * j / nd, o = i * (nd + 1) + j;
    world(s, d, yFn(s, d), v); pos.set([v.x, v.y, v.z], o * 3); uv.set([d / uvLen, s / uvLen], o * 2);
    if (i < ns && j < nd) idx.push(o, o + 1, o + nd + 1, o + 1, o + nd + 2, o + nd + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}
// a flat quad across the track at s (from dL to dR, y0..y1)
function crossWall(s, dL, dR, y0, y1) {
  const a = world(s, dL, y0), b = world(s, dR, y0), c = world(s, dL, y1), e = world(s, dR, y1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, e.x, e.y, e.z], 3));
  geo.setIndex([0, 1, 2, 1, 3, 2]); geo.computeVertexNormals();
  return geo;
}

// ---------- world building ----------
// shared materials, created on first use so a stage only loads the photos it needs
const MATS = {
  road: () => new THREE.MeshStandardMaterial({ map: roadTex, normalMap: photo(`${ROAD.tex || 'asphalt'}_nor.jpg`, { srgb: false, rep: [4, 4] }), normalScale: new THREE.Vector2(0.8, 0.8), roughnessMap: ROAD.tex ? null : photo('asphalt_rough.jpg', { srgb: false, rep: [4, 4] }), roughness: 0.95, metalness: 0.05, envMapIntensity: 1.1 }),
  ground: () => new THREE.MeshStandardMaterial({ map: photo('grass_diff.jpg', { rep: [24, 1] }), color: '#6b5a52', roughness: 0.95 }),
  walk: () => new THREE.MeshStandardMaterial({ map: photo('walk_diff.jpg'), normalMap: photo('walk_nor.jpg', { srgb: false }), color: '#b8aeb4', roughness: 0.85 }),
  concrete: () => new THREE.MeshStandardMaterial({ map: photo('concrete_diff.jpg', { rep: [0.25, 0.25] }), color: '#b0a8ac', roughness: 0.85, side: THREE.DoubleSide }),
  ramp: () => new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.5, metalness: 0.3, side: THREE.DoubleSide }),
  water: () => new THREE.MeshStandardMaterial({ color: '#0f3a52', roughness: 0.06, metalness: 0.4, envMapIntensity: 1.4 }),
  dirt: () => new THREE.MeshStandardMaterial({ color: '#3a2a22', roughness: 1, side: THREE.DoubleSide }),
};
const M = new Proxy({}, { get: (c, k) => (c[k] ??= MATS[k]()) });
const flat0 = () => 0;

function buildWorld() {
  // road, broken by any gaps
  let a = -120;
  for (const g of [...GAPS, { s0: FINISH_S + 260 }]) {
    const m = new THREE.Mesh(ribbon(a, g.s0, -ROAD_HALF, ROAD_HALF, 3, flat0, 24), M.road);
    m.receiveShadow = true; scene.add(m); a = g.s1;
  }
  // ramps
  for (const r of RAMPS) {
    const top = new THREE.Mesh(ribbon(r.s0, r.s0 + r.len, r.dL, r.dR, 2, (s) => r.h * (s - r.s0) / r.len, 4), M.ramp);
    top.castShadow = top.receiveShadow = true; scene.add(top);
    for (const d of [r.dL, r.dR]) scene.add(new THREE.Mesh(wall(r.s0, r.s0 + r.len, d, 2, () => 0, (s) => r.h * (s - r.s0) / r.len), M.concrete));
    scene.add(new THREE.Mesh(crossWall(r.s0 + r.len, r.dL, r.dR, 0, r.h), M.concrete));
  }
  // start + finish lines
  const checker = canvasTex(256, 64, (g, w, h) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#f4f4f4'; g.fillRect(x * 16, y * 16, 16, 16); } });
  for (const s of [12, FINISH_S]) scene.add(new THREE.Mesh(ribbon(s, s + 3, -ROAD_HALF, ROAD_HALF, 3, () => 0.02), new THREE.MeshStandardMaterial({ map: checker, roughness: 0.6 })));
  ST.build(kit);
}
function finishArch(text) {
  const archMat = new THREE.MeshStandardMaterial({ color: '#1a1a22', metalness: 0.8, roughness: 0.3 });
  const half = ROAD_HALF + 1.5;
  for (const d of [-half, half]) { const p = new THREE.Mesh(new THREE.BoxGeometry(1.2, 10, 1.2), archMat); world(FINISH_S, d, 5, p.position); p.rotation.y = frame(FINISH_S).yaw; scene.add(p); }
  const ban = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 + 1, 3.2), new THREE.MeshBasicMaterial({ map: textTex(text, '#38f5ff', { w: 1024, h: 120, size: 70, bg: '#0b0716' }), toneMapped: false, side: THREE.DoubleSide }));
  ban.material.color.setScalar(1.6); world(FINISH_S, 0, 9.4, ban.position); ban.lookAt(world(FINISH_S - 50, 0, 9.4)); scene.add(ban);
}

function addBillboard(s, d, y, text, color, w = 8, h = 2.6) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: textTex(text, color, { frame: true, size: 84 }), transparent: true, side: THREE.DoubleSide, toneMapped: false }));
  m.material.color.setScalar(1.8);
  world(s, d, y, m.position);
  m.lookAt(world(s - 60, 0, y));
  scene.add(m);
  // posts
  for (const o of [-w / 3, w / 3]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.25, y, 0.25), M.concrete);
    world(s, d + o * 0.2, y / 2 - h / 2, p.position); scene.add(p);
  }
  return m;
}

// tile = metres covered by one texture repeat, grid = window cells per tile (for lighting random windows)
const FACADES = [
  { name: '006', tile: [28, 28], grid: [12, 8], mask: 'dark', lit: 0.3, metal: 0.55, rough: 0.18, hue: 0.55 },
  { name: '009', tile: [30, 30], emi: true, metal: 0.5, rough: 0.2, hue: 0.6 },
  { name: '018A', tile: [24, 24], grid: [8, 8], mask: 'blue', lit: 0, metal: 0.1, rough: 0.8, hue: 0.03 },
  { name: '020A', tile: [26, 30], grid: [8, 9], mask: 'blue', lit: 0, metal: 0.1, rough: 0.75, hue: 0.08 },
];
function facadeMat(f) {
  const mat = new THREE.MeshStandardMaterial({
    map: photo(`fac${f.name}_col.jpg`), normalMap: photo(`fac${f.name}_nor.jpg`, { srgb: false }),
    metalness: f.metal, roughness: f.rough, envMapIntensity: 1.2,
    emissive: '#ffffff', emissiveIntensity: 1, emissiveMap: f.emi ? photo(`fac${f.name}_emi.jpg`) : null,
  });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.tile = { value: new THREE.Vector2(...f.tile) };
    sh.uniforms.grid = { value: new THREE.Vector2(...(f.grid || [1, 1])) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec2 tile; varying float vRoof; varying vec2 vSeed;')
      .replace('#include <uv_vertex>', `#include <uv_vertex>
        float lx = length(instanceMatrix[0].xyz), ly = length(instanceMatrix[1].xyz), lz = length(instanceMatrix[2].xyz);
        vec2 fsc = abs(normal.x) > 0.5 ? vec2(lz, ly) : abs(normal.z) > 0.5 ? vec2(lx, ly) : vec2(lx, lz);
        vec2 fuv = uv * fsc / tile; vRoof = abs(normal.y);
        vSeed = instanceMatrix[3].xz;
        vMapUv = fuv; vNormalMapUv = fuv;${f.emi ? ' vEmissiveMapUv = fuv;' : ''}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec2 grid; varying float vRoof; varying vec2 vSeed;\nfloat fhash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }')
      .replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb *= mix(1.0, 0.18, vRoof);')
      .replace('#include <emissivemap_fragment>', f.emi ? '#include <emissivemap_fragment>\n totalEmissiveRadiance *= 0.9 * (1.0 - vRoof);' : `
        vec3 fc = texture2D(map, vMapUv).rgb;
        float win = ${f.mask === 'dark' ? '1.0 - smoothstep(0.28, 0.42, dot(fc, vec3(0.33)))' : 'smoothstep(0.02, 0.09, fc.b - fc.r) * (1.0 - smoothstep(0.35, 0.5, dot(fc, vec3(0.33))))'};
        vec2 cell = floor(vMapUv * grid);
        float hh = fhash(cell + floor(vSeed));
        float lit = step(${(1 - f.lit).toFixed(2)}, hh) * (1.0 - vRoof);
        totalEmissiveRadiance = mix(vec3(1.0, 0.72, 0.42), vec3(0.62, 0.9, 1.0), step(0.85, fract(hh * 7.3))) * win * lit * (0.35 + 0.4 * fract(hh * 13.1));`);
  };
  return mat;
}
// buildings: kinds[k] = list of { s, d, h, dp, w, y? } boxes drawn with FACADES[k]
function placeBuildings(kinds) {
  const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
  kinds.forEach((list, k) => {
    if (!list.length) return;
    const inst = new THREE.InstancedMesh(geo, facadeMat(FACADES[k]), list.length);
    list.forEach((b, i) => {
      world(b.s, b.d, b.y || 0, p); q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, frame(b.s).yaw);
      sc.set(b.dp, b.h, b.w); m4.compose(p, q, sc); inst.setMatrixAt(i, m4);
      inst.setColorAt(i, col.setHSL(FACADES[k].hue + (Math.random() - 0.5) * 0.04, 0.1, 0.42 + Math.random() * 0.16));
    });
    inst.receiveShadow = true;
    scene.add(inst);
  });
}
const kit = { THREE, scene, Q, IS_MOBILE, M, world, frame, elev, ribbon, wall, crossWall, grid, photo, canvasTex, textTex, addBillboard, FACADES, facadeMat, placeBuildings, finishArch };

// ---------- vehicles ----------
// ---------- pickups ----------
const PICK = {
  coin: { r: 1.4 },
  gpu: { r: 1.6, xp: 10, label: 'RTX 5090 +10 EXP' },
  h100: { r: 1.8, xp: 50, label: 'H100 +50 EXP' },
  legend: { r: 2.2, xp: 200, label: '전설의 블랙웰 칩 +200 EXP' },
  air: { r: 1.6 },
};
const pickupProtos = (() => {
  const coinFace = textTex('Ð', '#6b4300', { w: 128, h: 128, size: 100, glow: 0, bg: '#ffc83d' });
  const gold = new THREE.MeshStandardMaterial({ color: '#ffc83d', metalness: 1, roughness: 0.25, emissive: '#a86a00', emissiveIntensity: 0.6 });
  const face = new THREE.MeshStandardMaterial({ map: coinFace, metalness: 0.8, roughness: 0.3, emissive: '#7a4a00', emissiveIntensity: 0.5 });
  const cg = new THREE.CylinderGeometry(0.7, 0.7, 0.14, 28); cg.rotateX(Math.PI / 2);
  const coin = new THREE.Mesh(cg, [gold, face, face]);

  const gpu = makeRTX5090(), h100 = makeH100(), legend = makeBlackwell();
  const air = new THREE.Group();
  air.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.9, 6, 14), new THREE.MeshPhysicalMaterial({ color: '#2b7cff', metalness: 0.6, roughness: 0.2, clearcoat: 1 })));
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.06, 6, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.6, 3.4), toneMapped: false })); band.rotation.x = Math.PI / 2; air.add(band);
  return { coin, gpu, h100, legend, air };
})();

// ---------- particles ----------
const puffs = [];
{
  const geo = new THREE.SphereGeometry(0.5, 8, 6);
  for (let i = 0; i < 140; i++) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#e8f6ff', transparent: true, opacity: 0, depthWrite: false }));
    m.visible = false; scene.add(m); puffs.push({ m, life: 0, vel: new THREE.Vector3() });
  }
}
let puffIdx = 0;
function puff(pos, vel, color = '#e8f6ff', size = 1, life = 0.6) {
  const p = puffs[puffIdx++ % puffs.length];
  p.m.position.copy(pos); p.vel.copy(vel); p.life = p.max = life; p.size = size;
  p.m.material.color.set(color); p.m.visible = true;
}
function updatePuffs(dt) {
  for (const p of puffs) {
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) { p.m.visible = false; continue; }
    const k = p.life / p.max;
    p.m.position.addScaledVector(p.vel, dt); p.vel.multiplyScalar(1 - 2.5 * dt);
    p.m.scale.setScalar(p.size * (1.6 - k));
    p.m.material.opacity = 0.7 * k;
  }
}

// ---------- game state ----------
const car = makeRoadster(); scene.add(car);
const magnetRing = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 1.6, 2.2), transparent: true, opacity: 0.22, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
magnetRing.rotation.x = -Math.PI / 2; scene.add(magnetRing);
const P = {};
let boss = null;
let traffic = [], pickups = [], state = 'loading', raceT = 0, countdown = 0, penalty = 0;
const stats = { perfect: 0, coins: 0, xpGain: 0, dogeGain: 0, jumpsOver: 0 };
const radioQueue = [];
const radioFlags = new Set();

function resetRace() {
  Object.assign(P, { s: 0, d: 3, y: 0, v: 0, vy: 0, grounded: true, charges: maxCharges(), recharge: 0, fuel: AIR_FUEL, slope: 0, air: 0, boostT: 0, boostG: 30, crashT: 0, shake: 0, steerVis: 0, roll: 0, rollTo: 0, rollDir: 1, finished: false, coil: 0, bonkT: 0, roofRun: 0, lastG: 0, kG: 0, slipT: 0, slipV: 0 });
  boss?.reset();
  raceT = 0; penalty = 0; swarmDone = false;
  Object.assign(stats, { perfect: 0, coins: 0, xpGain: 0, dogeGain: 0, jumpsOver: 0, roofs: 0 });
  radioFlags.clear(); radioQueue.length = 0;
  for (const t of traffic) if (t.mesh) scene.remove(t.mesh);
  for (const f of jamFleets) scene.remove(f);
  for (const p of pickups) scene.remove(p.mesh);
  PUDDLES.length = 0; PUDDLES.push(...(ST.puddles || []));
  spawnTraffic(); spawnPickups();
}
// who's on the road: real car models where they loaded, procedural stand-ins otherwise
const TRAFFIC = ST.traffic;
const trafficProtos = {};
const lodProtos = {}; // simplified copies for parked jams
const trafficReady = Promise.all(Object.entries(TRAFFIC).map(async ([k, d]) => {
  try { const pr = d.make ? d.make() : await loadCar(d.car); trafficProtos[k] = d.kit ? addSensorKit(pr) : pr; }
  catch (e) { console.warn('traffic model failed, using stand-in', k, e); }
  if (ST.jams && ST.jamMix?.[k]) try { const pr = await loadCar(d.car, true); lodProtos[k] = d.kit ? addSensorKit(pr) : pr; } catch { lodProtos[k] = trafficProtos[k]; }
}));
const JAMS = ST.jams || [];
const inJam = (s, pad = 5) => JAMS.some(([a, b]) => s > a - pad && s < b + pad);
const randLane = (type) => { const l = (type && TRAFFIC[type].lanes) || LANES; return l[(Math.random() * l.length) | 0]; };
const TRAFFIC_MAX_S = ST.trafficMaxS ?? FINISH_S + 200;
let jamFleets = [], swarmDone = false;
let standIns = null;
function trafficMesh(type, color) {
  const d = TRAFFIC[type];
  if (trafficProtos[type]) return instance(trafficProtos[type], color ?? d.color);
  standIns ??= { w: makeWaymo(), c: makeCybercab() };
  const pr = d.brakes ? standIns.w : standIns.c;
  const mesh = pr.clone();
  const tail = pr.userData.tail.clone();
  mesh.traverse((o) => { if (o.name === 'tail') o.material = tail; });
  mesh.userData = { tail, pivot: mesh.getObjectByName('pivot'), wheels: [], size: new THREE.Vector3(2.1, 1.6, 4.7) };
  return mesh;
}
// one car on the road; opts: { v, parked, temp, copy, color, name }
function addTraffic(type, s, d, opts = {}) {
  const def = TRAFFIC[type];
  const mesh = opts.parked ? null : trafficMesh(type, opts.color);
  const sz = mesh ? mesh.userData.size : trafficProtos[type].userData.size;
  const base = opts.v ?? def.speed[0] + Math.random() * (def.speed[1] - def.speed[0]);
  const t = { type, name: opts.name || def.name, brakes: !!def.brakes && !opts.parked, hl: sz.z / 2, hw: sz.x / 2, h: Math.min(sz.y, 3.6), s, d, dT: d, y: 0, base, v: opts.parked ? 0 : base, brakeT: 0, cool: 0, over: false, mesh, parked: !!opts.parked, temp: !!opts.temp, copy: !!opts.copy, copyT: 0 };
  if (mesh) scene.add(mesh);
  traffic.push(t);
  return t;
}
function spawnTraffic() {
  traffic = []; jamFleets = [];
  const roster = Object.entries(TRAFFIC).flatMap(([k, d]) => Array(d.n).fill(k));
  for (let i = roster.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [roster[i], roster[j]] = [roster[j], roster[i]]; }
  roster.forEach((type, i) => {
    let s = 180 + i * 85 + Math.random() * 40;
    if (s > TRAFFIC_MAX_S - 30) s -= 900;
    for (const [a, b] of JAMS) if (s > a - 40 && s < b + 5) s = b + 20 + Math.random() * 40;
    const rg = TRAFFIC[type].range; if (rg) s = rg[0] + Math.random() * (rg[1] - rg[0]);
    addTraffic(type, s, randLane(type));
  });
  // parked jams: every lane bumper to bumper, a few holes; drawn as instanced fleets
  const mix = Object.entries(ST.jamMix || {}).filter(([k]) => trafficProtos[k]);
  const total = mix.reduce((a, [, w]) => a + w, 0);
  const pick = () => { let r = Math.random() * total; for (const [k, w] of mix) if ((r -= w) <= 0) return k; return mix[0][0]; };
  const byType = {};
  if (mix.length) JAMS.forEach(([a, b], ji) => { for (const d of LANES) {
    let s = a + Math.random() * 4;
    while (s < b) {
      if (Math.random() < 0.05) { s += 10; continue; }
      const type = pick(), hl = trafficProtos[type].userData.size.z / 2;
      const t = addTraffic(type, s + hl, d + (Math.random() - 0.5) * 0.6, { parked: true });
      (byType[ji + ':' + type] ??= []).push(t);
      s += hl * 2 + 1.6 + Math.random() * 1.6;
    }
  } });
  const q = new THREE.Quaternion(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const blobs = [];
  for (const [key, list] of Object.entries(byType)) {
    const [ji, type] = key.split(':');
    const f = fleet(lodProtos[type] || trafficProtos[type], list.map((t) => ({ m: new THREE.Matrix4().compose(world(t.s, t.d, 0, p), q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, frame(t.s).yaw + (Math.random() - 0.5) * 0.06), one), color: TRAFFIC[type].color })));
    f.traverse((o) => { o.castShadow = false; });
    f.userData.jam = JAMS[+ji]; scene.add(f); jamFleets.push(f);
    blobs.push(...list);
  }
  // contact shadows under the parked cars (they don't cast real ones: too many triangles)
  if (blobs.length) {
    const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
    const im = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ map: blobShadowTex(), transparent: true, depthWrite: false, opacity: 0.85 }), blobs.length);
    const sc = new THREE.Vector3();
    blobs.forEach((t, i) => { im.setMatrixAt(i, new THREE.Matrix4().compose(world(t.s, t.d, 0.03, p), q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, frame(t.s).yaw), sc.set(t.hw * 2.5, 1, t.hl * 2.3))); });
    im.renderOrder = -1; scene.add(im); jamFleets.push(im);
  }
}
// copycats: identical clones that steer into your lane
function spawnSwarm() {
  const sw = ST.swarm; swarmDone = true;
  if (!trafficProtos[sw.type]) return;
  for (let i = 0; i < sw.n; i++) addTraffic(sw.type, P.s + 80 + i * 18 + Math.random() * 8, randLane(), { v: Math.max(24, P.v * 0.72), temp: true, copy: true, color: sw.color, name: sw.name });
  toast(sw.name.toUpperCase(), '똑같이 생긴 차가 우르르!', '#ff6a1a');
}
function addPickup(type, s, d, y) {
  const mesh = pickupProtos[type].clone();
  mesh.userData.fans = []; mesh.traverse((o) => { if (o.name === 'rotor') mesh.userData.fans.push(o); });
  scene.add(mesh); pickups.push({ type, s, d, y, mesh, taken: false, phase: Math.random() * 6 });
}
const nearGap = (s) => GAPS.some((g) => s > g.s0 - 30 && s < g.s1 + 10);
function spawnPickups() {
  pickups = [];
  // coin lines (up on the roofs through a jam)
  for (let s = 90; s < FINISH_S - 40; s += 70 + Math.random() * 50) {
    if (nearGap(s)) continue;
    const d = randLane(), n = 5 + ((Math.random() * 4) | 0);
    for (let i = 0; i < n; i++) addPickup('coin', s + i * 5, d, 1.1 + groundAt(s + i * 5, d) + (inJam(s + i * 5, 0) ? 1.7 : 0));
  }
  // GPUs scattered
  for (let s = 150; s < FINISH_S - 40; s += 55 + Math.random() * 45) {
    if (nearGap(s)) continue;
    addPickup('gpu', s, randLane() + (Math.random() - 0.5) * 2, 1.2 + (inJam(s, 0) ? 1.7 : 0));
  }
  // H100 above ramp flight paths, air tanks before ramps
  for (const r of RAMPS) {
    const d = (r.dL + r.dR) / 2;
    if (r.dR - r.dL < 20) addPickup('h100', r.s0 + r.len + 18, d, r.h + 2.2);
    addPickup('air', r.s0 - 45, d, 1.2);
  }
  if (ST.legend) addPickup('legend', ST.legend.s, ST.legend.d, ST.legend.y);   // only reachable with ramp + jump
  for (const [type, ps, pd, py] of ST.pickups || []) addPickup(type, ps, pd, py);
  // coin arcs over gaps
  for (const g of GAPS) for (let i = 0; i < 9; i++) { const s = g.s0 - 4 + i * 5.2, x = (s - (g.s0 - 4)) / 42; addPickup('coin', s, 0, 3 + 7 * Math.sin(Math.PI * x)); }
}

// ---------- input ----------
const input = { left: false, right: false, jump: false, brake: false, boost: false, fire: false, jumpEdge: false, fireEdge: false };
const KEYMAP = { KeyF: 'fire', KeyE: 'fire', Enter: 'fire', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'jump', ArrowUp: 'jump', KeyW: 'jump', ArrowDown: 'brake', KeyS: 'brake', ShiftLeft: 'boost', ShiftRight: 'boost', KeyB: 'boost' };
addEventListener('keydown', (e) => {
  const k = KEYMAP[e.code]; if (!k) return;
  e.preventDefault();
  if (k === 'jump' && !input.jump) input.jumpEdge = true;
  if (k === 'fire' && !input.fire) input.fireEdge = true;
  input[k] = true;
});
addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) input[k] = false; });
for (const btn of document.querySelectorAll('[data-key]')) {
  const k = btn.dataset.key;
  const on = (e) => { e.preventDefault(); if (k === 'jump' && !input.jump) input.jumpEdge = true; if (k === 'fire' && !input.fire) input.fireEdge = true; input[k] = true; btn.classList.add('down'); };
  const off = (e) => { e.preventDefault(); input[k] = false; btn.classList.remove('down'); };
  btn.addEventListener('pointerdown', on); btn.addEventListener('pointerup', off);
  btn.addEventListener('pointercancel', off); btn.addEventListener('pointerleave', off);
}
document.body.classList.toggle('touch', IS_MOBILE);

// ---------- audio ----------
let AC = null, engine = null, hiss = null, muted = false;
function initAudio() {
  if (AC) return;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    const master = AC.createGain(); master.gain.value = 0.5; master.connect(AC.destination);
    engine = { osc: AC.createOscillator(), osc2: AC.createOscillator(), gain: AC.createGain(), lp: AC.createBiquadFilter() };
    engine.osc.type = 'sawtooth'; engine.osc2.type = 'square'; engine.lp.type = 'lowpass'; engine.lp.frequency.value = 900;
    engine.gain.gain.value = 0.0;
    engine.osc.connect(engine.lp); engine.osc2.connect(engine.lp); engine.lp.connect(engine.gain); engine.gain.connect(master);
    engine.osc.start(); engine.osc2.start();
    const buf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const ch = buf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    const src = AC.createBufferSource(); src.buffer = buf; src.loop = true;
    const hp = AC.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
    hiss = AC.createGain(); hiss.gain.value = 0; src.connect(hp); hp.connect(hiss); hiss.connect(master); src.start();
    AC.master = master;
  } catch { AC = null; }
}
function blip(f0, f1, dur = 0.12, type = 'sine', vol = 0.18) {
  if (!AC || muted) return;
  const o = AC.createOscillator(), g = AC.createGain(); o.type = type;
  o.frequency.setValueAtTime(f0, AC.currentTime); o.frequency.exponentialRampToValueAtTime(f1, AC.currentTime + dur);
  g.gain.setValueAtTime(vol, AC.currentTime); g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + dur);
  o.connect(g); g.connect(AC.master); o.start(); o.stop(AC.currentTime + dur + 0.02);
}
function updateAudio() {
  if (!AC) return;
  const t = AC.currentTime, on = state === 'race' && !muted;
  engine.osc.frequency.setTargetAtTime(45 + P.v * 2.1, t, 0.05);
  engine.osc2.frequency.setTargetAtTime(22 + P.v * 1.05, t, 0.05);
  engine.gain.gain.setTargetAtTime(on ? 0.05 : 0, t, 0.1);
  hiss.gain.setTargetAtTime(on && P.thrusting ? 0.12 : 0, t, 0.03);
}
document.getElementById('mute').addEventListener('click', () => { muted = !muted; document.getElementById('mute').textContent = muted ? '소리 끔' : '소리 켬'; });

// ---------- HUD ----------
const $ = (id) => document.getElementById(id);
const hud = { lv: $('lv'), xpTxt: $('xpTxt'), xpBar: $('xpBar'), doge: $('doge'), time: $('time'), prog: $('prog'), progDot: $('progDot'), kmh: $('kmh'), pips: $('pips'), jumpTxt: $('jumpTxt'), boost: $('boostFill'), toast: $('toast'), radio: $('radio'), radioTxt: $('radioTxt'), count: $('count'), fuel: $('fuelFill') };
let toastT = 0;
function toast(big, small = '', color = '#38f5ff') {
  hud.toast.innerHTML = `${big}${small ? `<small>${small}</small>` : ''}`;
  hud.toast.style.setProperty('--tc', color);
  hud.toast.classList.remove('show'); void hud.toast.offsetWidth; hud.toast.classList.add('show');
  toastT = 1.6;
}
let radioT = 0;
function radio(text, who = CAST.hero.name, ava = CAST.hero.ava) {
  radioQueue.push({ text, who, ava });
}
function updateRadio(dt) {
  radioT -= dt;
  if (radioT <= 0 && radioQueue.length) {
    const r = radioQueue.shift();
    $('radioWho').textContent = r.who; $('radioAva').textContent = r.ava; hud.radioTxt.textContent = r.text;
    hud.radio.classList.add('show'); radioT = 4.2;
  } else if (radioT <= 0) hud.radio.classList.remove('show');
}
function gainXP(n, why) {
  save.xp += n; stats.xpGain += n;
  while (save.xp >= xpNeed(save.level)) {
    save.xp -= xpNeed(save.level); save.level++;
    P.charges = maxCharges();
    setTimeout(() => toast(`레벨 업! LV ${save.level}`, `점프 최대 ${maxCharges()}회`, '#3dff9a'), 500);
    blip(440, 1320, 0.4, 'triangle', 0.2);
  }
  if (why) floatText(why);
}
function floatText(t) {
  const el = document.createElement('div'); el.className = 'float'; el.textContent = t;
  $('floats').appendChild(el); setTimeout(() => el.remove(), 1200);
}
function renderPips() {
  const max = maxCharges();
  if (hud.pips.childElementCount !== max) hud.pips.innerHTML = '<i></i>'.repeat(max);
  [...hud.pips.children].forEach((el, i) => {
    const fill = i < P.charges ? 1 : i === P.charges ? P.recharge / recharge() : 0;
    el.style.setProperty('--f', fill);
    el.classList.toggle('full', fill >= 1);
  });
  hud.jumpTxt.textContent = P.charges > 0 ? `압축공기 점프 ${P.charges}/${max}` : '압축공기 충전 중…';
}
function updateHUD() {
  hud.lv.textContent = `LV ${save.level}`;
  hud.xpTxt.textContent = `EXP ${save.xp} / ${xpNeed(save.level)}`;
  hud.xpBar.style.width = `${(100 * save.xp / xpNeed(save.level)).toFixed(1)}%`;
  hud.doge.textContent = save.doge.toLocaleString();
  hud.time.textContent = fmtTime(raceT + penalty);
  const pr = THREE.MathUtils.clamp(P.s / FINISH_S, 0, 1) * 100;
  hud.prog.style.width = pr + '%'; hud.progDot.style.left = pr + '%';
  hud.kmh.textContent = Math.round(P.v * 3.6 * 1.1);
  hud.boost.style.width = `${P.boostG}%`;
  hud.fuel.style.width = `${100 * P.fuel / AIR_FUEL}%`;
  $('boostBtn').classList.toggle('ready', P.boostG >= 35);
  if (boss?.B.active) {
    $('coilFill').style.width = `${P.coil}%`;
    const ready = P.coil >= 100;
    $('coilMeter').classList.toggle('full', ready); $('fireBtn').classList.toggle('ready', ready);
    $('coilTxt').textContent = ready ? (IS_MOBILE ? '⚡ 코일 발사 준비!' : '⚡ F 키로 코일 발사!') : '⚡ 테슬라 코일 충전 중';
  }
  renderPips();
}
const fmtTime = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(2).padStart(5, '0')}`;

// ---------- simulation ----------
const RADIO_SCRIPT = ST.radio;
const AVOID = [...RAMPS, ...(ST.blocks || [])]; // where traffic changes lane
const PUDDLES = [...(ST.puddles || [])]; // bosses can add more (sunscreen)
const PADS = ST.pads || [];             // like-button jump pads
const HAZARDS = ST.hazards || [];
// slope of whatever the car stands on (ramp or raised surface), on top of the road's own grade
function slopeAt(s, d, y) {
  const r = rampAt(s, d) || rampAt(s, d - 0.8) || rampAt(s, d + 0.8);
  if (r) return r.h / r.len;
  const u = surfaceAt(s, d, y + 0.3); if (u && Math.abs(y - u.y(s)) < 0.4) return u.y(s + 0.5) - u.y(s - 0.5);
  return 0;
}
function step(dt) {
  raceT += dt;
  if (boss) { boss.update(dt); if (input.fireEdge) { input.fireEdge = false; if (!boss.fireCoil() && boss.B.active) floatText('코일 충전 중…'); } }
  const fr0 = frame(P.s);
  // speed
  const boosting = P.boostT > 0;
  let vmax = 62 + save.level * 0.8 + save.up.motor * 4 + (boosting ? 20 : 0);
  let acc = (boosting ? 34 : 15) * Math.max(0, 1 - P.v / vmax) + (boosting ? 6 : 0);
  if (P.v > vmax) acc = -12;
  if (P.crashT > 0) { P.crashT -= dt; acc *= 0.3; }
  if (input.brake && P.grounded) acc = -42;
  P.v = Math.max(0, P.v + acc * dt);
  if (P.boostT > 0) P.boostT -= dt;
  if (input.boost && !boosting && P.boostG >= 35) { P.boostT = P.boostG / 35 * 1.1; P.boostG = 0; blip(200, 900, 0.5, 'sawtooth', 0.08); toast('부스트!', '', '#ff3d6e'); }

  // steering
  const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const grip = P.slipT > 0 ? 0.25 : 1;
  P.d += steer * (P.grounded ? 15 : 14) * grip * dt * Math.min(1, 0.4 + P.v / 40);
  if (P.slipT > 0) { P.slipT -= dt; P.d += P.slipV * dt; P.slipV *= 1 - dt * 1.2; }
  const lim = reach(P.s, P.y);
  P.d = THREE.MathUtils.clamp(P.d, -lim, lim);
  P.steerVis += (steer - P.steerVis) * Math.min(1, dt * 8);
  P.s += P.v * dt;

  // jump / thrust
  if (input.jumpEdge) P.jumpBuf = 0.18;
  P.jumpBuf = Math.max(0, (P.jumpBuf || 0) - dt);
  P.coyote = P.grounded ? 0.28 : Math.max(0, (P.coyote || 0) - dt);
  if (P.jumpBuf > 0 && (P.grounded || P.coyote > 0)) {
    P.jumpBuf = 0; P.coyote = 0;
    if (P.charges > 0) {
      P.charges--; P.vy = P.grounded ? (elevSlope(P.s) + P.slope) * P.v + JUMP_V : Math.max(P.vy - elevSlope(P.s) * P.v, 0) + elevSlope(P.s) * P.v + JUMP_V; P.grounded = false; P.air = 0;
      // signature move from the Roadster demo: a full sideways twist in the air
      P.rollDir = steer !== 0 ? steer : -P.rollDir; P.rollTo = P.roll + Math.PI * 2 * P.rollDir;
      blip(160, 520, 0.25, 'triangle', 0.15);
      const base = world(P.s, P.d, P.y);
      for (let i = 0; i < 14; i++) puff(base, new THREE.Vector3((Math.random() - 0.5) * 12, -1 + Math.random() * 2, (Math.random() - 0.5) * 12), '#e8f6ff', 1.2, 0.7);
    } else if (input.jumpEdge) { toast('충전 중…', '압축공기가 부족해요', '#ff3d6e'); blip(200, 120, 0.15, 'square', 0.06); }
  }
  input.jumpEdge = false;
  if (P.charges < maxCharges()) {
    P.recharge += dt;
    if (P.recharge >= recharge()) { P.recharge = 0; P.charges++; }
  } else if (P.charges >= maxCharges()) P.recharge = 0;

  P.thrusting = false;
  const g = carGround(P.s, P.d, P.y);
  const eS = elevSlope(P.s);
  if (P.grounded) {
    if (g < P.y - 0.3) { // left a ramp top or a broken bridge
      P.grounded = false; P.air = 0;
    } else {
      const kPrev = P.kG ?? eS;
      P.slope = slopeAt(P.s, P.d, g); P.y = g; P.lastG = g;
      P.kG = eS + P.slope; P.vy = P.kG * P.v;
      // over a crest the ground drops away faster than gravity can follow: the car flies (SF hills)
      if ((P.kG - kPrev) * P.v / dt < -G * 1.15 && P.v > 15) { P.grounded = false; P.air = 0; P.vy = kPrev * P.v; }
    }
    if (P.slipT <= 0) for (const q of PUDDLES) if (Math.abs(P.s - q.s) < q.l && Math.abs(P.d - q.d) < q.w) {
      P.slipT = 0.9; P.slipV = (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 3); P.v *= 0.9;
      const [big, small, col] = q.text || ['냉각수!', '데이터센터 냉각수에 미끄러짐', '#5ff0ff'];
      toast(big, small, col); blip(500, 200, 0.3, 'sine', 0.12);
      for (let i = 0; i < 10; i++) puff(world(P.s, P.d, 0.3), new THREE.Vector3((Math.random() - 0.5) * 8, 2 + Math.random() * 3, (Math.random() - 0.5) * 8), '#c8fbff', 1.1, 0.7);
      break;
    }
    for (const q of PADS) if (P.grounded && Math.abs(P.s - q.s) < q.l && Math.abs(P.d - q.d) < q.w) {
      P.grounded = false; P.air = 0; P.vy = (P.kG || 0) * P.v + q.v; P.rollDir = -P.rollDir; P.rollTo = P.roll + Math.PI * 2 * P.rollDir;
      floatText('좋아요 점프!'); blip(300, 1200, 0.3, 'triangle', 0.16);
      for (let i = 0; i < 12; i++) puff(world(P.s, P.d, 0.3), new THREE.Vector3((Math.random() - 0.5) * 10, 4 + Math.random() * 4, (Math.random() - 0.5) * 10), '#7ab8ff', 1, 0.6);
    }
    P.fuel = Math.min(AIR_FUEL, P.fuel + dt * 1.5);
  }
  if (P.roll !== P.rollTo) {
    const left = P.rollTo - P.roll, sp = (P.grounded ? 20 : 8.5) * dt;
    if (Math.abs(left) <= sp) {
      P.roll = P.rollTo = 0;
      if (!P.grounded) { gainXP(10, '배럴롤 +10 EXP'); P.boostG = Math.min(100, P.boostG + 10); }
    } else P.roll += Math.sign(left) * sp;
  }
  if (!P.grounded) {
    P.air += dt;
    P.vy -= G * dt;
    const rv = P.vy - eS * P.v; // vertical speed relative to the road under you
    if (input.jump && rv < 3 && P.fuel > 0) {
      P.thrusting = true; P.fuel -= dt; P.vy += 27 * dt; if (rv < -7) P.vy += 20 * dt;
      if (Math.random() < 0.8) { const base = world(P.s, P.d + (Math.random() - 0.5) * 1.6, P.y); puff(base, new THREE.Vector3(0, -14, 0), '#cfefff', 0.6, 0.35); }
    }
    P.y += (P.vy - eS * P.v) * dt;
    if (P.y <= g) land(g);
    if (P.y < (ST.splashY?.(P.s) ?? -5.5)) splash();
  }
  // overpasses and sign gantries: solid overhead, except their holes
  P.bonkT -= dt;
  for (const c of CEILINGS) {
    if (P.s < c.s0 || P.s > c.s1 || P.y + 1.3 < c.y0 || P.y > c.y1 - 0.05) continue;
    const hole = c.holes?.find((h) => ((P.d - h.d) / h.rx) ** 2 + ((P.y + 0.65 - h.y) / h.ry) ** 2 < 1);
    if (hole) {
      if (!radioFlags.has(hole)) {
        radioFlags.add(hole); const b = ST.holeBonus;
        toast(b.text, b.sub, '#ffc83d'); gainXP(b.xp); save.doge += b.doge; stats.dogeGain += b.doge; writeSaveSoon();
        P.boostT = Math.max(P.boostT, 1.5); blip(520, 1560, 0.5, 'triangle', 0.18);
      }
      continue;
    }
    if (P.bonkT > 0) continue;
    const under = P.y + 1.3 - c.y0 < 0.9, face = P.s - P.v * dt * 1.5 < c.s0;
    if (!under && !face) continue; // came down onto it from above: the deck is a floor (roofAt)
    P.bonkT = 0.5; P.shake = 0.7; P.v *= 0.45; P.vy = Math.min(P.vy, eS * P.v - 3); P.grounded = false;
    if (under) P.y = c.y0 - 1.35; else P.s = c.s0 - 0.4; // underside: pushed down; face: stopped
    toast('쿵!', `${c.what}에 부딪힘`, '#ff3d6e'); blip(150, 40, 0.3, 'square', 0.18);
  }
  if (ST.swarm && !swarmDone && P.s > ST.swarm.at) spawnSwarm();
  // stage hazards the stage switches on and off (engine test fire): { s, l, dL, dR, h, active, text }
  for (const hz of HAZARDS) {
    hz.cd = (hz.cd || 0) - dt;
    if (!hz.active || hz.cd > 0 || Math.abs(P.s - hz.s) > hz.l || P.d < hz.dL || P.d > hz.dR || P.y > (hz.h ?? 3)) continue;
    hz.cd = 1; P.v *= 0.5; P.crashT = 0.6; P.shake = 0.8;
    const [big, small, col] = hz.text || ['앗 뜨거!', '', '#ff6a1a']; toast(big, small, col); blip(120, 40, 0.4, 'sawtooth', 0.2);
    for (let i = 0; i < 16; i++) puff(world(P.s, P.d, 0.8), new THREE.Vector3((Math.random() - 0.5) * 10, 3 + Math.random() * 5, (Math.random() - 0.5) * 10), i % 2 ? '#ff8a2a' : '#555', 1.3, 0.7);
  }

  // traffic
  for (const t of traffic) {
    if (!t.parked) {
      if (t.brakeT > 0) { t.brakeT -= dt; t.v = Math.max(0, t.v - 60 * dt); if (t.brakeT <= 0) t.cool = 3; }
      else {
        // keep a gap to whoever is ahead in the lane (jams back up naturally)
        let target = t.base, lead = null;
        for (const o of traffic) if (o !== t && o.s > t.s && o.s - t.s < 45 && Math.abs(o.d - t.dT) < 2.8 && (!lead || o.s < lead.s)) lead = o;
        if (lead) { const gap = lead.s - t.s - lead.hl - t.hl; if (gap < 14) target = Math.min(target, Math.max(0, lead.v + (gap - 4) * 0.8)); }
        t.v += (target - t.v) * Math.min(1, dt * (target < t.v ? 3 : 0.8));
      }
      t.cool -= dt;
      t.s += t.v * dt;
      // lidar (and the robotaxi's cameras) see the ramp ahead and change lane
      const ahead = AVOID.find((r) => r.s0 - t.s > 0 && r.s0 - t.s < 45 && t.dT + 1.2 > r.dL && t.dT - 1.2 < r.dR);
      if (ahead) { const free = LANES.filter((l) => !AVOID.some((r) => Math.abs(r.s0 - ahead.s0) < 2 && l + 1.2 > r.dL && l - 1.2 < r.dR)); if (free.length) t.dT = free.reduce((a, b) => (Math.abs(b - t.d) < Math.abs(a - t.d) ? b : a)); }
      else if (t.copy) {
        // copycats mirror your lane, a beat late
        t.copyT -= dt;
        if (t.copyT <= 0 && t.s - P.s > 10 && t.s - P.s < 140) { t.copyT = 0.5 + Math.random() * 0.7; t.dT = LANES.reduce((a, b) => (Math.abs(b - P.d) < Math.abs(a - P.d) ? b : a)); }
      }
      t.d += THREE.MathUtils.clamp(t.dT - t.d, -6 * dt, 6 * dt);
      t.y = carGround(t.s, t.d);
      if (t.temp && t.s < P.s - 80) { t.dead = true; scene.remove(t.mesh); continue; }
      const maxS = TRAFFIC[t.type].range?.[1] ?? TRAFFIC_MAX_S;
      if (t.s < P.s - 80 || t.s > maxS) {
        t.s = Math.min(maxS - 20, P.s + 320 + Math.random() * 380); t.d = t.dT = randLane(t.type); t.over = false; t.brakeT = 0; t.v = t.base;
        for (const [a, b] of JAMS) if (t.s > a - 40 && t.s < b + 5) t.s = b + 20 + Math.random() * 40;
        if (t.s < P.s + 120) t.s = P.s - 100; // nothing left ahead: park it behind
      }
    }
    const ds = t.s - P.s, dd = Math.abs(t.d - P.d);
    if (t.brakes && t.brakeT <= 0 && t.cool <= 0 && ds > -6 && ds < 26 && dd < 6.5 && P.y < 2) {
      t.brakeT = 2.6;
      if (!radioFlags.has('lidar')) { radioFlags.add('lidar'); floatText('웨이모: 장애물 감지! 급정거!'); }
      else if (Math.random() < 0.3) floatText('웨이모: 장애물 감지!');
    }
    if (Math.abs(ds) < t.hl + 2.2 && dd < t.hw + 1) {
      if (P.y - t.y < t.h - 0.55) { if (ds > -t.hl * 0.5) crash(t); }
      else if (!t.over) {
        t.over = true;
        if (P.grounded) { // driving across roofs
          stats.roofs++; P.roofRun++; gainXP(3); P.boostG = Math.min(100, P.boostG + 4);
          if (P.roofRun % 5 === 0) floatText(`지붕 질주 ×${P.roofRun}`);
        } else { stats.jumpsOver++; gainXP(15, '차 뛰어넘기 +15 EXP'); P.boostG = Math.min(100, P.boostG + 15); blip(600, 900, 0.12); }
      }
    }
  }
  if (traffic.some((t) => t.dead)) traffic = traffic.filter((t) => !t.dead);

  // pickups
  const R = magnetRange(), cy = P.y + 0.7;
  for (const p of pickups) {
    if (p.taken) continue;
    let ds = p.s - P.s; if (ds > R + 6 || ds < -R) continue;
    // magnet: anything inside the radius flies to the car, faster than the car moves
    const dd = P.d - p.d, dy = cy - p.y, dist = Math.hypot(ds, dd, dy);
    if (p.type !== 'legend' && (p.pulled || dist < R)) {
      p.pulled = true;
      const sp = (P.v + 30) * dt, k = Math.min(1, sp / Math.max(dist, 0.001));
      p.s -= ds * k; p.d += dd * k; p.y += dy * k; ds = p.s - P.s;
    }
    if (Math.abs(p.d - P.d) < PICK[p.type].r && Math.abs(p.y - (P.y + 0.7)) < PICK[p.type].r + 0.4) collect(p);
  }

  // radio
  for (const [s, text] of RADIO_SCRIPT) if (P.s > s && !radioFlags.has(s)) { radioFlags.add(s); radio(text); }

  if (P.s >= FINISH_S && !P.finished) finish();
  if (P.shake > 0) P.shake -= dt * 1.8;
  return fr0;
}
function land(g) {
  const impact = -(P.vy - elevSlope(P.s) * P.v);
  if (g < 0.5) P.roofRun = 0;
  P.y = g; P.grounded = true; P.lastG = g; P.slope = slopeAt(P.s, P.d, g); P.kG = elevSlope(P.s) + P.slope; P.vy = P.kG * P.v;
  const base = world(P.s, P.d, P.y);
  if (P.air > 0.45 && impact < 11.5) {
    stats.perfect++; P.boostT = Math.max(P.boostT, 0.9); P.boostG = Math.min(100, P.boostG + 20);
    toast('PERFECT LANDING!', '+5 EXP · 속도 부스트', '#38f5ff'); gainXP(5);
    blip(520, 1040, 0.2, 'triangle', 0.14);
    for (let i = 0; i < 16; i++) puff(base, new THREE.Vector3((Math.random() - 0.5) * 16, Math.random() * 2, (Math.random() - 0.5) * 16), '#aeeaff', 1, 0.5);
  } else if (impact > 19) {
    P.v *= 0.72; P.shake = 0.6; toast('쿵! 하드 랜딩', '공중에서 점프를 꾹 누르면 부드럽게 내려와요', '#ffc83d');
    blip(120, 50, 0.3, 'square', 0.15);
    for (let i = 0; i < 12; i++) puff(base, new THREE.Vector3((Math.random() - 0.5) * 10, Math.random() * 3, (Math.random() - 0.5) * 10), '#a08a7a', 1.3, 0.8);
  }
}
// Korean 와/과 by whether the last syllable has a final consonant
function withWa(w) {
  const c = w.charCodeAt(w.length - 1);
  const batchim = c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 !== 0 : '013678'.includes(w[w.length - 1]);
  return batchim ? '과' : '와';
}
function crash(t) {
  P.v = Math.min(P.v * 0.45, t.v + (t.parked ? 9 : 2)); P.s = t.s - t.hl - 2.3; // parked: enough left to hop onto it
  P.crashT = 0.8; P.shake = 0.8;
  toast('쾅!', t.name + withWa(t.name) + ' 충돌', '#ff3d6e');
  blip(180, 40, 0.35, 'sawtooth', 0.2);
  const base = world(P.s + 2, P.d, 1);
  for (let i = 0; i < 18; i++) puff(base, new THREE.Vector3((Math.random() - 0.5) * 10, Math.random() * 5, (Math.random() - 0.5) * 10), i % 2 ? '#ffb347' : '#555', 0.9, 0.6);
}
function splash() {
  const base = world(P.s, P.d, (ST.splashY?.(P.s) ?? -5.5) - 0.5);
  for (let i = 0; i < 30; i++) puff(base, new THREE.Vector3((Math.random() - 0.5) * 10, 6 + Math.random() * 10, (Math.random() - 0.5) * 10), '#bfe9ff', 1.4, 1);
  const [big, small, line] = ST.lines.fall || ['추락!', '+3초', '다시 가자!'];
  toast(big, small, '#38f5ff');
  radio(line);
  blip(300, 60, 0.5, 'sine', 0.2);
  const gap = GAPS.find((g) => P.s > g.s0 - 60 && P.s < g.s1 + 60) || GAPS[0];
  Object.assign(P, { s: gap ? gap.respawn : P.s - (ST.respawnBack ?? 100), d: THREE.MathUtils.clamp(P.d, -ROAD_HALF + 1.2, ROAD_HALF - 1.2), y: 0, vy: 0, v: 52, grounded: true, lastG: 0, kG: undefined, charges: Math.max(P.charges, 1), shake: 0.4 });
  penalty += 3;
}
function collect(p) {
  p.taken = true; scene.remove(p.mesh);
  switch (p.type) {
    case 'coin': if (boss?.B.active) P.coil = Math.min(100, P.coil + 6); save.doge += 5; writeSaveSoon(); stats.dogeGain += 5; stats.coins++; P.boostG = Math.min(100, P.boostG + 3); blip(988, 1480, 0.09, 'square', 0.06); break;
    case 'air': P.charges = Math.min(maxCharges(), P.charges + 1); P.fuel = AIR_FUEL; floatText('압축공기 +1'); blip(300, 900, 0.18, 'sine', 0.12); break;
    default: if (boss?.B.active) P.coil = Math.min(100, P.coil + (p.type === 'gpu' ? 22 : 40)); gainXP(PICK[p.type].xp, PICK[p.type].label); blip(660, 1320, 0.16, 'triangle', 0.14);
      if (p.type === 'legend') { toast('전설의 블랙웰 칩!', '+200 EXP', '#b07dff'); radio('그거 젠슨이 찾고 있던 건데… 우리가 가져가자.'); }
  }
}
function finish() {
  P.finished = true; state = 'finish';
  const t = raceT + penalty;
  const bossWin = !!boss?.B.defeated;
  const stars = boss ? 1 + (bossWin ? 1 : 0) + (t <= ST.stars.time || stats.perfect >= (ST.stars.perfect || 3) ? 1 : 0)
    : 1 + (t <= ST.stars.time ? 1 : 0) + (stats.perfect >= (ST.stars.perfect || 3) ? 1 : 0); // no boss: time and landings are a star each
  const prev = save.bests[ST.id];
  const best = prev && prev < t ? prev : t; save.bests[ST.id] = best;
  writeSave();
  radio(ST.lines.finish);
  setTimeout(() => {
    $('rTime').textContent = fmtTime(t);
    $('rBest').textContent = fmtTime(best);
    $('rStars').innerHTML = [0, 1, 2].map((i) => `<span class="${i < stars ? 'on' : ''}">★</span>`).join('');
    $('rPerfect').textContent = stats.perfect;
    $('rCoins').textContent = `+${stats.dogeGain}`;
    $('rXp').textContent = `+${stats.xpGain}`;
    $('rLv').textContent = `LV ${save.level}`;
    $('rBoss').textContent = bossWin ? '격추' : '놓침';
    $('rBoss').hidden = $('rBoss').previousElementSibling.hidden = !boss;
    $('rRoofs').textContent = stats.roofs;
    $('rRoofRow').hidden = !JAMS.length; $('rRoofRow2').hidden = !JAMS.length;
    $('results').hidden = false;
  }, ST.finishDelay ?? 900);
}

// ---------- render sync ----------
const tmpV = new THREE.Vector3(), lookV = new THREE.Vector3(), camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
let orbitT = 0, snapCam = false;
function placeCar() {
  const fr = frame(P.s);
  world(P.s, P.d, P.y, car.position);
  const pitch = P.grounded ? -Math.atan(P.slope + elevSlope(P.s)) : -Math.atan2(P.vy, Math.max(P.v, 10)) * 0.8;
  car.rotation.set(0, 0, 0);
  car.rotation.order = 'YXZ';
  car.rotation.y = fr.yaw - P.steerVis * 0.12;
  car.rotation.x = -pitch; // nose up on the way up (the car faces -z)
  car.rotation.z = -P.steerVis * 0.05 + P.roll;
  // roll around the body's centre (0.55 m up), not the tyre contact point
  const sr = Math.sin(P.roll), cr = 1 - Math.cos(P.roll);
  car.position.addScaledVector(fr.r, 0.55 * sr).y += 0.55 * cr;
  for (const w of car.userData.wheels) w.children.forEach((c) => (c.rotation.x -= P.v * 0.016));
  const under = carGround(P.s, P.d, P.y + 0.01);
  const blob = car.getObjectByName('blob'); if (blob) { blob.visible = under > -100; blob.position.y = 0.03 - P.y + under; blob.material.opacity = 0.9 / (1 + Math.max(0, P.y - under) * 0.35); }
  { const gr = under; magnetRing.visible = gr > -100 && state !== 'poster'; world(P.s, P.d, gr + 0.06, magnetRing.position); magnetRing.scale.setScalar(magnetRange()); }
  car.userData.jet.opacity = P.thrusting ? 0.9 : Math.max(0, car.userData.jet.opacity - 0.08);
  car.userData.tail.color.setRGB(input.brake ? 8 : 4, 0.25, 0.35);
}
let blobTexCache = null;
function blobShadowTex() {
  return blobTexCache ??= canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 6, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,0.8)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
}
function syncTraffic(time) {
  for (const f of jamFleets) if (f.userData.jam) { const [a, b] = f.userData.jam; f.visible = P.s > a - 700 && P.s < b + 60; }
  for (const t of traffic) {
    if (!t.mesh) continue;
    t.mesh.visible = Math.abs(t.s - P.s) < 380; if (!t.mesh.visible) continue;
    world(t.s, t.d, t.y, t.mesh.position);
    t.mesh.rotation.order = 'YXZ'; t.mesh.rotation.set(Math.atan(elevSlope(t.s)), frame(t.s).yaw, 0);
    if (t.mesh.userData.pivot) t.mesh.userData.pivot.rotation.y = time * 5 + t.s;
    for (const w of t.mesh.userData.wheels) w.children[0].rotation.x = -t.s / w.userData.r;
    const braking = t.brakeT > 0;
    t.mesh.userData.tail.color.setRGB(braking ? (Math.sin(time * 18) > 0 ? 8 : 1) : 2.5, braking ? 1.2 : 0.15, 0.2);
  }
}
function syncPickups(time) {
  for (const p of pickups) {
    if (p.taken) continue;
    const near = Math.abs(p.s - P.s) < 420;
    p.mesh.visible = near; if (!near) continue;
    world(p.s, p.d, p.y + Math.sin(time * 3 + p.phase) * 0.15, p.mesh.position);
    p.mesh.rotation.y = time * (p.type === 'coin' ? 3 : 1.4) + p.phase;
    for (const f of p.mesh.userData.fans || []) f.rotation.z = time * 14;
  }
}
// loading-screen staging: the Roadster mid barrel-roll over 6th Street, the boss looming behind
const POSTER = ST.poster;
const PCAM = Object.assign({ back: 10, side: -3.4, y: 1.3, ahead: 10, lookSide: -2.5, lookY: 5.2, fov: 44 }, POSTER.cam);
function posterStage(time) {
  world(POSTER.s, POSTER.d, POSTER.y + Math.sin(time * 1.3) * 0.15, car.position);
  car.rotation.order = 'YXZ';
  car.rotation.set(-0.16, frame(POSTER.s).yaw + 0.25, 0.42 + Math.sin(time * 0.9) * 0.04);
  car.userData.jet.opacity = 0.45 + Math.sin(time * 25) * 0.08;
  const blob = car.getObjectByName('blob'); if (blob) blob.visible = false;
  magnetRing.visible = false;
  boss?.posterPose(POSTER.s + POSTER.boss[0], POSTER.boss[1], POSTER.boss[2], time, POSTER.boss[3] || 0);
}
function updateCamera(dt, time) {
  const fr = frame(P.s);
  if (state === 'finish' && ST.finishCam?.(camera, time)) return; // a stage's own ending (Starbase launch)
  if (state === 'poster' && (boss || ST.poster?.cam)) {
    orbitT += dt * 0.05;
    const sway = Math.sin(orbitT) * 1.2;
    world(POSTER.s - PCAM.back, POSTER.d + PCAM.side + sway, PCAM.y, camPos);
    camera.position.copy(camPos);
    world(POSTER.s + PCAM.ahead, POSTER.d + PCAM.lookSide, PCAM.lookY, camLook); camera.lookAt(camLook);
    camera.fov = PCAM.fov; camera.updateProjectionMatrix();
    return;
  }
  if (state === 'poster' || state === 'loading') {
    orbitT += dt * 0.18;
    const a = orbitT + 0.6;
    camPos.set(car.position.x + Math.sin(a) * 9, car.position.y + 2.3 + Math.sin(orbitT * 0.7) * 0.6, car.position.z + Math.cos(a) * 9);
    camera.position.copy(camPos); camera.lookAt(car.position.x, car.position.y + 0.9, car.position.z);
    camera.fov = 48; camera.updateProjectionMatrix();
    return;
  }
  const speedK = P.v / 70;
  // follow the car's height, but only part of the way up a jump (above where it last stood)
  const lift = Math.max(0, P.y - (P.lastG || 0)), back = 8.5 + speedK * 2.5;
  tmpV.copy(car.position).addScaledVector(fr.f, -back); tmpV.y = Math.max(elev(P.s), elev(P.s - back) - 1.5) + Math.max(P.y - lift * 0.3, 0) + 3.4 + speedK * 0.4;
  lookV.copy(car.position).addScaledVector(fr.f, 10); lookV.y = elev(P.s + 10) + P.y - lift * 0.45 + 1.4;
  const k = snapCam ? 1 : Math.min(1, dt * 7);
  camPos.lerp(tmpV, k); camLook.lerp(lookV, snapCam ? 1 : Math.min(1, dt * 10)); snapCam = false;
  camera.position.copy(camPos);
  if (P.shake > 0) camera.position.add(new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5), 0).multiplyScalar(P.shake * 0.6));
  camera.lookAt(camLook);
  const targetFov = 60 + speedK * 14 + (P.boostT > 0 ? 8 : 0);
  camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 3); camera.updateProjectionMatrix();
}

// ---------- post ----------
const composer = new EffectComposer(renderer);
composer.setPixelRatio(Q.pr);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth * Q.bloomRes, innerHeight * Q.bloomRes), ENV.bloom ?? 0.6, 0.5, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());
function resize() {
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  bloom.resolution.set(innerWidth * Q.bloomRes, innerHeight * Q.bloomRes);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

// ---------- flow ----------
function startRace() {
  initAudio(); if (AC && AC.state === 'suspended') AC.resume();
  $('poster').hidden = true; $('results').hidden = true; $('garage').hidden = true; $('hud').hidden = false;
  resetRace(); placeCar();
  const fr = frame(0); camPos.copy(car.position).addScaledVector(fr.f, -9); camPos.y = 3.4; camLook.copy(car.position);
  state = 'count'; countdown = 3.2;
}
// ---------- X Garage ----------
function renderGarage() {
  $('gDoge').textContent = save.doge.toLocaleString();
  $('gList').innerHTML = Object.entries(UPGRADES).map(([k, u]) => {
    const l = save.up[k], maxed = l >= u.max, cost = u.cost(l);
    return `<div class="gitem"><div><h3>${u.name}</h3><div class="lvl">${'<i class="on"></i>'.repeat(l)}${'<i></i>'.repeat(u.max - l)}</div></div>
      <button class="buy" data-up="${k}" ${maxed || save.doge < cost ? 'disabled' : ''}>${maxed ? 'MAX' : `Ð ${cost.toLocaleString()}`}</button>
      <p>지금: ${u.desc(l)}${maxed ? '' : ` → <b>${u.desc(l + 1)}</b>`}</p></div>`;
  }).join('');
}
$('gList').addEventListener('click', (e) => {
  const k = e.target.closest('[data-up]')?.dataset.up; if (!k) return;
  const u = UPGRADES[k], l = save.up[k], cost = u.cost(l);
  if (l >= u.max || save.doge < cost) return;
  save.doge -= cost; save.up[k]++; writeSave(); renderGarage(); refreshSaveLine();
  initAudio(); blip(520, 1560, 0.25, 'triangle', 0.15);
});
function openGarage() { renderGarage(); $('garage').hidden = false; $('gClose').focus(); }
$('garageBtn').addEventListener('click', openGarage);
$('garageBtn2').addEventListener('click', openGarage);
$('gClose').addEventListener('click', () => { $('garage').hidden = true; });
function refreshSaveLine() { const b = save.bests[ST.id]; $('saveLine').textContent = `LV ${save.level} · Ð ${save.doge.toLocaleString()}${b ? ` · 최고 기록 ${fmtTime(b)}` : ''}`; }
// stage texts, stage picker, next-stage button
function stageUI() {
  const T = ST.text;
  $('pEyebrow').textContent = T.eyebrow; $('pTitle').textContent = T.title; $('pSub').textContent = T.sub;
  // long names (SAN FRANCISCO) shrink until the longest word fits the column
  const fitTitle = () => { const el = $('pTitle'); el.style.fontSize = ''; el.style.whiteSpace = 'nowrap'; const w = el.clientWidth; el.style.whiteSpace = '';
    const words = T.title.split(' '); const probe = document.createElement('span'); probe.style.whiteSpace = 'nowrap'; el.textContent = ''; el.append(probe);
    let worst = 0; for (const wd of words) { probe.textContent = wd; worst = Math.max(worst, probe.offsetWidth); } el.textContent = T.title;
    if (worst > w && w > 0) el.style.fontSize = `${parseFloat(getComputedStyle(el).fontSize) * w / worst * 0.97}px`; };
  fitTitle(); document.fonts?.ready.then(fitTitle); addEventListener('resize', fitTitle);
  $('pTip').innerHTML = T.tip; $('pTweet').textContent = T.tweet; $('pMeta').textContent = T.meta; $('loadTxt').textContent = T.load;
  $('hudStage').textContent = T.hud; $('rEyebrow').textContent = T.clear; $('rTitle').textContent = T.clearTitle;
  const i = ORDER.indexOf(ST), next = ORDER[i + 1];
  $('rNext').innerHTML = `별 조건: ${ST.stars.text}<br>도지코인은 X 개러지에서 자석, 탱크, 컴프레서, 모터 강화에 써요.${next ? '' : ' 다음 스테이지는 다음 업데이트에서 열려요.'}`;
  $('nextBtn').hidden = !next;
  if (next) { $('nextBtn').textContent = `다음: ${next.name} →`; $('nextBtn').onclick = () => goStage(next.id); }
  $('stagePick').innerHTML = ORDER.map((st) => `<button type="button" class="chip${st === ST ? ' on' : ''}" data-stage="${st.id}">${String(st.num).padStart(2, '0')} ${st.name}</button>`).join('');
  $('stagePick').onclick = (e) => { const id = e.target.closest('[data-stage]')?.dataset.stage; if (id && id !== ST.id) goStage(id); };
  document.title = `Roadster Racer · ${ST.name}`;
}

$('startBtn').addEventListener('click', startRace);
$('againBtn').addEventListener('click', startRace);

let last = performance.now(), tickAcc = 0;
const TICK = 1 / 120; // fixed physics tick, deterministic for future replays and ghosts
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const time = now / 1000;
  if (state === 'count') {
    countdown -= dt;
    const n = Math.ceil(countdown);
    hud.count.textContent = n > 0 ? n : 'GO!'; hud.count.hidden = countdown < -0.6;
    if (countdown <= 0) { state = 'race'; hud.count.textContent = 'GO!'; blip(880, 880, 0.3, 'square', 0.1); radio(RADIO_SCRIPT[0][1]); radioFlags.add(RADIO_SCRIPT[0][0]); }
    else if (Math.ceil(countdown + dt) !== n) blip(440, 440, 0.15, 'square', 0.08);
  }
  if (state === 'race' && !hud.count.hidden && raceT > 0.8) hud.count.hidden = true;
  if (state === 'race') { tickAcc += dt; while (tickAcc >= TICK) { step(TICK); tickAcc -= TICK; } }
  else if (state === 'finish') { P.v = Math.max(0, P.v - 30 * dt); P.s += P.v * dt; P.thrusting = false; }
  if (state !== 'loading') { placeCar(); syncTraffic(time); syncPickups(time); boss?.sync(time); }
  if (state === 'poster') posterStage(time);
  ST.tick?.(time, camera, { state, P, car });
  updatePuffs(dt); updateRadio(dt);
  if (toastT > 0) toastT -= dt;
  if (!window.__game?.frozen) updateCamera(dt, time);
  sky.position.copy(camera.position);
  const fr = frame(P.s || 0);
  sun.position.copy(car.position).addScaledVector(SUN_DIR, 80); sun.position.y = car.position.y + 45; sun.target.position.copy(car.position);
  if (state !== 'poster' && state !== 'loading') updateHUD();
  updateAudio();
  composer.render();
  requestAnimationFrame(loop);
}

// ---------- boot ----------
const carReady = Promise.race([
  upgradeRoadster(car).catch((e) => console.warn('real roadster failed, keeping stand-in', e)),
  new Promise((ok) => setTimeout(ok, 20000)),
]);
async function boot() {
  buildWorld();
  await carReady; await trafficReady;
  try {
    boss = createBoss({ scene, P, LANES, ROAD_HALF, world, frame, carGround, puff, toast, radio, floatText, blip, gainXP, $, camera, car, addTraffic, crash, traffic: () => traffic,
      addPuddle: (q) => PUDDLES.push(q), removePuddle: (q) => { const i = PUDDLES.indexOf(q); if (i >= 0) PUDDLES.splice(i, 1); },
      addDoge: (n) => { n = Math.max(n, -save.doge); save.doge += n; stats.dogeGain += n; writeSaveSoon(); } }, ST.boss, trafficProtos);
  } catch (e) { console.warn('boss skipped', e); boss = null; }
  $('credits').textContent = '3D models (Sketchfab): Tesla Roadster 2.0 — ZTOONE3D (CC BY-NC 4.0) · ' + Object.values(CARS).map((c) => c.credit).join(' · ') + ' · Textures & HDRI: Poly Haven, ambientCG (CC0)';
  resetRace(); placeCar(); syncTraffic(0); syncPickups(0);
  state = 'poster';
  $('startBtn').disabled = false; $('startBtn').textContent = '출발';
  $('loadTxt').hidden = true;
  refreshSaveLine();
}
stageUI();
document.fonts?.ready.then(() => setTimeout(boot, 30)) ?? setTimeout(boot, 30);
requestAnimationFrame(loop);
window.__game = { get boss() { return boss; }, get pickups() { return pickups; }, get traffic() { return traffic; }, P, get state() { return state; }, input, scene, camera, car, THREE, realcars: { loadCar, instance, CARS }, models: { makeRoadster, makeWaymo, makeCybercab, makeRTX5090, makeH100 },
  freeze(on) { this.frozen = on; }, skipCount() { countdown = 0.01; }, snap() { snapCam = true; }, pcam: PCAM, get stage() { return ST; }, renderer, step: (dt) => step(dt) };
