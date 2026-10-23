// Roadster Racer — Stage 1: Austin, TX
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { makeRoadster, makeWaymo, makeCybercab, makeRTX5090, makeH100, makeBlackwell } from './models.js';

// ---------- quality ----------
const IS_MOBILE = matchMedia('(pointer: coarse)').matches || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
const Q = IS_MOBILE
  ? { pr: Math.min(devicePixelRatio, 1.5), shadow: 1024, bStep: 24, bloomRes: 0.5 }
  : { pr: Math.min(devicePixelRatio, 2), shadow: 2048, bStep: 17, bloomRes: 1 };

// ---------- tuning ----------
const G = 32;
const ROAD_HALF = 12;
const LANES = [-9, -3, 3, 9];
const GAP0 = 2500, GAP1 = 2536;          // broken Congress Ave bridge
const BRIDGE0 = 2445, BRIDGE1 = 2615;
const FINISH_S = 2900;
const JUMP_V = 13;
const RECHARGE = 8;                       // seconds per jump charge
const AIR_FUEL = 1.3;                     // seconds of landing thrust

// ---------- save ----------
const SAVE_KEY = 'roadster-racer-save-v1';
const save = loadSave();
function loadSave() {
  try { return Object.assign({ level: 1, xp: 0, doge: 0, best: 0 }, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); }
  catch { return { level: 1, xp: 0, doge: 0, best: 0 }; }
}
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch {} }
const xpNeed = (lv) => 100 + (lv - 1) * 80;
const maxCharges = () => Math.min(8, 2 + save.level);

// ---------- track geometry ----------
function cx(s) {
  const k = THREE.MathUtils.smoothstep(s, 120, 420);
  return k * (38 * Math.sin(s / 420) + 16 * Math.sin(s / 170 + 1.3) - 16 * Math.sin(1.3) * 0);
}
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
  return out.set(fr.x + fr.r.x * d, y, fr.z + fr.r.z * d);
}

// ramps: {s0, len, dL, dR, h}
const RAMPS = [
  { s0: 260, len: 16, dL: -12, dR: -5, h: 2.6 },
  { s0: 420, len: 16, dL: 5, dR: 12, h: 2.6 },
  { s0: 620, len: 18, dL: -6, dR: 6, h: 3.2 },
  { s0: 860, len: 14, dL: -12, dR: -6, h: 2.4 },
  { s0: 860, len: 14, dL: 6, dR: 12, h: 2.4 },
  { s0: 1120, len: 16, dL: -3, dR: 6, h: 4.0 },
  { s0: 1380, len: 14, dL: 4, dR: 12, h: 2.8 },
  { s0: 1600, len: 16, dL: -12, dR: -2, h: 3.0 },
  { s0: 1850, len: 18, dL: -6, dR: 6, h: 3.6 },
  { s0: 2100, len: 14, dL: -12, dR: -6, h: 2.6 },
  { s0: 2100, len: 14, dL: 6, dR: 12, h: 2.6 },
  { s0: 2300, len: 16, dL: -4, dR: 4, h: 3.0 },
  { s0: GAP0 - 20, len: 20, dL: -ROAD_HALF, dR: ROAD_HALF, h: 2.6 },
];
function rampAt(s, d) {
  for (const r of RAMPS) if (s >= r.s0 && s <= r.s0 + r.len && d >= r.dL && d <= r.dR) return r;
  return null;
}
function groundAt(s, d) {
  if (s > GAP0 && s < GAP1) return -1e9;
  const r = rampAt(s, d);
  return r ? r.h * (s - r.s0) / r.len : 0;
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
const FOG = new THREE.Color('#4a2346');
scene.fog = new THREE.Fog(FOG, 140, 950);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.3, 3000);

// sky
const SUN_DIR = new THREE.Vector3(-0.35, 0.16, -1).normalize();
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { sunDir: { value: SUN_DIR } },
  vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
  fragmentShader: `varying vec3 vP; uniform vec3 sunDir;
    void main(){ float h = vP.y;
      vec3 top = vec3(0.06,0.04,0.17), mid = vec3(0.42,0.12,0.36), hor = vec3(1.0,0.45,0.25), low = vec3(0.29,0.13,0.25);
      vec3 c = h > 0.0 ? mix(hor, mix(mid, top, smoothstep(0.15,0.7,h)), smoothstep(0.0,0.18,h)) : mix(hor*0.6, low, smoothstep(0.0,-0.2,h));
      float sd = max(dot(vP, sunDir), 0.0);
      c += vec3(1.0,0.55,0.25) * pow(sd, 18.0) * 0.9 + vec3(1.0,0.85,0.6) * pow(sd, 900.0) * 6.0;
      gl_FragColor = vec4(c, 1.0); }`,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(2400, 32, 16), skyMat);
scene.add(sky);
{
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), skyMat));
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(envScene, 0.02).texture;
  // real sunset HDRI (CC0, Poly Haven "Venice Sunset"), stored as RGBE bytes in a grayscale PNG
  const img = new Image();
  img.onload = () => {
    try {
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
      const src = g.getImageData(0, 0, c.width, c.height).data, W = c.width / 4, H = c.height;
      const f = new Float32Array(W * H * 4);
      for (let i = 0; i < W * H; i++) {
        const e = src[(i * 4 + 3) * 4], k = e ? Math.pow(2, e - 136) : 0;
        f[i * 4] = src[i * 16] * k; f[i * 4 + 1] = src[(i * 4 + 1) * 4] * k; f[i * 4 + 2] = src[(i * 4 + 2) * 4] * k; f[i * 4 + 3] = 1;
      }
      const tex = new THREE.DataTexture(f, W, H, THREE.RGBAFormat, THREE.FloatType);
      tex.mapping = THREE.EquirectangularReflectionMapping; tex.colorSpace = THREE.LinearSRGBColorSpace;
      tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.flipY = false; tex.needsUpdate = true;
      scene.environment = pm.fromEquirectangular(tex).texture;
      tex.dispose();
    } catch (err) { console.warn('HDRI skipped', err); }
  };
  img.src = 'assets/sunset_rgbe_gray.png';
}

scene.add(new THREE.HemisphereLight('#9d7be0', '#2a1712', 0.7));
const sun = new THREE.DirectionalLight('#ffb27a', 2.4);
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
const roadTex = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#26222b'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) { const v = 30 + Math.random() * 30; g.fillStyle = `rgb(${v},${v - 3},${v + 4})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  g.fillStyle = '#e9e4f0';
  g.fillRect(w * 0.025, 0, 6, h); g.fillRect(w * 0.975 - 6, 0, 6, h);
  for (const u of [0.25, 0.75]) g.fillRect(w * u - 3, 0, 6, h * 0.5);
  g.fillStyle = '#ffc83d'; g.fillRect(w * 0.5 - 9, 0, 6, h); g.fillRect(w * 0.5 + 3, 0, 6, h);
}, true);
const hazardTex = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#ffc400'; g.fillRect(0, 0, w, h); g.fillStyle = '#141414';
  for (let i = -w; i < w * 2; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 16, 0); g.lineTo(i + 16 - h, h); g.lineTo(i - h, h); g.fill(); }
}, true);
const windowTex = canvasTex(128, 256, (g, w, h) => {
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  for (let y = 6; y < h - 6; y += 12) for (let x = 6; x < w - 6; x += 10) {
    if (Math.random() < 0.38) { g.fillStyle = Math.random() < 0.75 ? '#ffd79a' : '#8ff3ff'; g.globalAlpha = 0.5 + Math.random() * 0.5; g.fillRect(x, y, 5, 7); }
  }
  g.globalAlpha = 1;
});
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
// vertical wall following the track at lateral d, between y0(s) and y1(s)
function wall(s0, s1, d, step, y0Fn, y1Fn) {
  const segs = Math.max(1, Math.ceil((s1 - s0) / step));
  const pos = [], idx = [], v = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const s = s0 + (s1 - s0) * i / segs;
    world(s, d, y0Fn(s), v); pos.push(v.x, v.y, v.z);
    world(s, d, y1Fn(s), v); pos.push(v.x, v.y, v.z);
    if (i < segs) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
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
const M = {
  road: new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.42, metalness: 0.15, envMapIntensity: 0.9 }),
  ground: new THREE.MeshStandardMaterial({ color: '#1c1418', roughness: 0.95 }),
  walk: new THREE.MeshStandardMaterial({ color: '#3a3240', roughness: 0.8 }),
  concrete: new THREE.MeshStandardMaterial({ color: '#8a7f86', roughness: 0.85, side: THREE.DoubleSide }),
  ramp: new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.5, metalness: 0.3, side: THREE.DoubleSide }),
  water: new THREE.MeshStandardMaterial({ color: '#0f3a52', roughness: 0.06, metalness: 0.4, envMapIntensity: 1.4 }),
  dirt: new THREE.MeshStandardMaterial({ color: '#3a2a22', roughness: 1, side: THREE.DoubleSide }),
};
const flat0 = () => 0;

function buildWorld() {
  // road (with the bridge gap)
  for (const [a, b] of [[-120, GAP0], [GAP1, FINISH_S + 260]]) {
    const m = new THREE.Mesh(ribbon(a, b, -ROAD_HALF, ROAD_HALF, 3, flat0, 24), M.road);
    m.receiveShadow = true; scene.add(m);
  }
  // ground split by the river
  for (const [a, b] of [[-400, BRIDGE0], [BRIDGE1, 3500]]) {
    for (const [l, r] of [[-500, -15.5], [15.5, 500]]) {
      const g = new THREE.Mesh(ribbon(a, b, l, r, 20, () => -0.05), M.ground); g.receiveShadow = true; scene.add(g);
    }
  }
  // sidewalks
  for (const [a, b] of [[-120, BRIDGE0], [BRIDGE1, FINISH_S + 260]]) {
    for (const [l, r] of [[-15.5, -ROAD_HALF], [ROAD_HALF, 15.5]]) {
      const w = new THREE.Mesh(ribbon(a, b, l, r, 4, () => 0.12), M.walk); w.receiveShadow = true; scene.add(w);
    }
  }
  // river + banks
  scene.add(new THREE.Mesh(ribbon(BRIDGE0 - 1, BRIDGE1 + 1, -500, 500, 10, () => -6), M.water));
  scene.add(new THREE.Mesh(crossWall(BRIDGE0, -500, 500, -6.2, 0), M.dirt));
  scene.add(new THREE.Mesh(crossWall(BRIDGE1, -500, 500, -6.2, 0), M.dirt));
  // bridge deck underside, rails, broken edges, pillars
  for (const [a, b] of [[BRIDGE0, GAP0], [GAP1, BRIDGE1]]) {
    scene.add(new THREE.Mesh(ribbon(a, b, -ROAD_HALF - 1, ROAD_HALF + 1, 5, () => -0.9), M.concrete));
    for (const d of [-ROAD_HALF - 0.6, ROAD_HALF + 0.6]) scene.add(new THREE.Mesh(wall(a, b, d, 4, () => -0.9, () => 1.1), M.concrete));
  }
  scene.add(new THREE.Mesh(crossWall(GAP0, -ROAD_HALF - 1, ROAD_HALF + 1, -0.9, 0), M.concrete));
  scene.add(new THREE.Mesh(crossWall(GAP1, -ROAD_HALF - 1, ROAD_HALF + 1, -0.9, 0), M.concrete));
  const pillarGeo = new THREE.CylinderGeometry(1.1, 1.3, 6, 12);
  for (let s = BRIDGE0 + 12; s < BRIDGE1; s += 26) {
    if (s > GAP0 - 4 && s < GAP1 + 4) continue;
    for (const d of [-7, 7]) { const p = new THREE.Mesh(pillarGeo, M.concrete); world(s, d, -3.9, p.position); scene.add(p); }
  }
  // broken-bridge barriers + sign
  const barrierMat = new THREE.MeshStandardMaterial({ color: '#ff6a1a', emissive: '#ff4a00', emissiveIntensity: 0.6 });
  for (const s of [GAP0 - 1.2]) for (let d = -10; d <= 10; d += 10) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 0.3), barrierMat); world(s, d === 0 ? 14 : d * 1.3, 0.5, b.position); b.rotation.y = frame(s).yaw; scene.add(b);
  }
  addBillboard(GAP0 - 140, -17, 9, '다리 끊김! 점프!', '#ff6a1a', 11, 3.4);
  addBillboard(GAP0 - 320, 17, 9, 'BRIDGE OUT', '#ff6a1a', 11, 3.4);

  // ramps
  for (const r of RAMPS) {
    const top = new THREE.Mesh(ribbon(r.s0, r.s0 + r.len, r.dL, r.dR, 2, (s) => r.h * (s - r.s0) / r.len, 4), M.ramp);
    top.castShadow = top.receiveShadow = true; scene.add(top);
    for (const d of [r.dL, r.dR]) scene.add(new THREE.Mesh(wall(r.s0, r.s0 + r.len, d, 2, () => 0, (s) => r.h * (s - r.s0) / r.len), M.concrete));
    scene.add(new THREE.Mesh(crossWall(r.s0 + r.len, r.dL, r.dR, 0, r.h), M.concrete));
  }

  buildBuildings();
  buildStreetlights();
  buildLandmarks();
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

const NEON = [['6TH ST', '#ff3d9a'], ['LIVE MUSIC', '#38f5ff'], ['DOGE BBQ', '#ffc83d'], ['KEEP AUSTIN WEIRD', '#b07dff'], ['TACOS', '#ff7a3d'], ['GPU PAWN', '#3dff9a'], ['ROBOTAXI', '#ffffff'], ['라이다 수리점', '#ff3d6e'], ['QUESO 24H', '#ffc83d'], ['H100 삽니다', '#3dff9a']];
const neonMats = NEON.map(([t, c]) => {
  const m = new THREE.MeshBasicMaterial({ map: textTex(t, c, { size: t.length > 9 ? 56 : 84 }), transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  m.color.setScalar(2.2); return m;
});
function buildBuildings() {
  const items = [];
  for (let s = -60; s < FINISH_S + 150; s += Q.bStep) {
    if (s > BRIDGE0 - 30 && s < BRIDGE1 + 30) continue;
    for (const side of [-1, 1]) {
      if (side < 0 && s < 170) continue; // Giga Texas lot
      const downtown = s > 1500 && s < 2400, sixth = s > 550 && s < 1500;
      const h = downtown ? 30 + Math.random() * 110 : sixth ? 9 + Math.random() * 16 : 6 + Math.random() * 14;
      const dp = 10 + Math.random() * 12, w = Q.bStep * (0.6 + Math.random() * 0.35);
      const face = ROAD_HALF + 5 + Math.random() * 3;
      items.push({ s, d: side * (face + dp / 2), h, dp, w, side, face, sixth, downtown });
      // back row skyline
      if (Math.random() < 0.7) items.push({ s: s + Q.bStep / 2, d: side * (face + dp + 14 + Math.random() * 30), h: h * (1 + Math.random()), dp: 14, w: Q.bStep * 0.8, side });
    }
  }
  const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
  const mat = new THREE.MeshStandardMaterial({ color: '#2a1f33', roughness: 0.7, metalness: 0.2, emissiveMap: windowTex, emissive: '#ffffff', emissiveIntensity: 1.25 });
  const inst = new THREE.InstancedMesh(geo, mat, items.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
  const tints = ['#3b2a4a', '#2c2338', '#43304a', '#2a2a3c', '#4a3036'];
  items.forEach((b, i) => {
    world(b.s, b.d, 0, p); q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, frame(b.s).yaw);
    sc.set(b.dp, b.h, b.w); m4.compose(p, q, sc); inst.setMatrixAt(i, m4);
    inst.setColorAt(i, col.set(tints[i % tints.length]));
  });
  inst.receiveShadow = true;
  scene.add(inst);
  // neon signs on the road-facing side
  const signGeo = new THREE.PlaneGeometry(7, 2.2);
  for (const b of items) {
    if (!b.face || !(b.sixth || b.downtown || Math.random() < 0.25) || Math.random() < 0.35) continue;
    const m = new THREE.Mesh(signGeo, neonMats[(Math.random() * neonMats.length) | 0]);
    const y = 4 + Math.random() * Math.min(6, b.h - 3);
    world(b.s, b.side * (b.face - 0.25), y, m.position);
    m.lookAt(world(b.s, 0, y)); scene.add(m);
  }
}
function buildStreetlights() {
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 8, 6); poleGeo.translate(0, 4, 0);
  const bulbGeo = new THREE.SphereGeometry(0.42, 10, 8);
  const list = [];
  for (let s = 0; s < FINISH_S + 100; s += 36) for (const side of [-1, 1]) list.push([s + (side > 0 ? 18 : 0), side]);
  const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshStandardMaterial({ color: '#2b2a30', metalness: 0.7, roughness: 0.4 }), list.length);
  const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.4, 1.5), toneMapped: false });
  const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, list.length);
  const m4 = new THREE.Matrix4(), p = new THREE.Vector3();
  list.forEach(([s, side], i) => {
    const bridge = s > BRIDGE0 && s < BRIDGE1;
    world(s, side * (bridge ? 13.2 : 14), bridge ? 1 : 0.1, p); m4.makeTranslation(p.x, p.y, p.z); poles.setMatrixAt(i, m4);
    world(s, side * 12.6, p.y + 7.8, p); m4.makeTranslation(p.x, p.y, p.z); bulbs.setMatrixAt(i, m4);
  });
  scene.add(poles, bulbs);
}
function buildLandmarks() {
  // Giga Texas
  const giga = new THREE.Mesh(new THREE.BoxGeometry(70, 22, 200), new THREE.MeshStandardMaterial({ color: '#b9b6c4', roughness: 0.55, metalness: 0.2 }));
  world(60, -58, 11, giga.position); giga.rotation.y = frame(60).yaw; giga.castShadow = false; giga.receiveShadow = true; scene.add(giga);
  const gs = new THREE.Mesh(new THREE.PlaneGeometry(40, 7), new THREE.MeshBasicMaterial({ map: textTex('GIGA TEXAS', '#ff2a3a', { w: 1024, h: 180, size: 130, glow: 18 }), transparent: true, toneMapped: false }));
  gs.material.color.setScalar(2); world(60, -22.9, 14, gs.position); gs.lookAt(world(60, 0, 14)); scene.add(gs);
  // start + finish lines
  const checker = canvasTex(256, 64, (g, w, h) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#f4f4f4'; g.fillRect(x * 16, y * 16, 16, 16); } });
  for (const s of [12, FINISH_S]) {
    const m = new THREE.Mesh(ribbon(s, s + 3, -ROAD_HALF, ROAD_HALF, 3, () => 0.02), new THREE.MeshStandardMaterial({ map: checker, roughness: 0.6 }));
    scene.add(m);
  }
  // finish arch
  const archMat = new THREE.MeshStandardMaterial({ color: '#1a1a22', metalness: 0.8, roughness: 0.3 });
  for (const d of [-13.5, 13.5]) { const p = new THREE.Mesh(new THREE.BoxGeometry(1.2, 10, 1.2), archMat); world(FINISH_S, d, 5, p.position); p.rotation.y = frame(FINISH_S).yaw; scene.add(p); }
  const ban = new THREE.Mesh(new THREE.PlaneGeometry(28, 3.2), new THREE.MeshBasicMaterial({ map: textTex('FINISH · 텍사스 주의회 의사당', '#38f5ff', { w: 1024, h: 120, size: 70, bg: '#0b0716' }), toneMapped: false, side: THREE.DoubleSide }));
  ban.material.color.setScalar(1.6); world(FINISH_S, 0, 9.4, ban.position); ban.lookAt(world(FINISH_S - 50, 0, 9.4)); scene.add(ban);
  // Texas State Capitol
  const capMat = new THREE.MeshStandardMaterial({ color: '#d8a48c', roughness: 0.7, emissive: '#5a2a1a', emissiveIntensity: 0.25 });
  const cap = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(90, 18, 40), capMat); base.position.y = 9; cap.add(base);
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(12, 13, 16, 32), capMat); drum.position.y = 26; cap.add(drum);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(12, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), capMat); dome.position.y = 34; cap.add(dome);
  const lant = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2, 7, 12), capMat); lant.position.y = 49; cap.add(lant);
  const star = new THREE.Mesh(new THREE.SphereGeometry(1.2, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3, 1.5), toneMapped: false })); star.position.y = 53.5; cap.add(star);
  world(FINISH_S + 330, 0, 0, cap.position); cap.rotation.y = frame(FINISH_S + 330).yaw; scene.add(cap);
  // trees by the river
  const treeGeo = new THREE.ConeGeometry(2.4, 7, 7); treeGeo.translate(0, 3.5, 0);
  const trees = new THREE.InstancedMesh(treeGeo, new THREE.MeshStandardMaterial({ color: '#1f3a2c', roughness: 0.9 }), 120);
  const m4 = new THREE.Matrix4(), p = new THREE.Vector3();
  for (let i = 0; i < 120; i++) {
    const s = (i % 2 ? BRIDGE1 + 4 + Math.random() * 60 : BRIDGE0 - 4 - Math.random() * 60), d = (Math.random() < 0.5 ? -1 : 1) * (18 + Math.random() * 120);
    world(s, d, 0, p); const k = 0.7 + Math.random() * 0.8; m4.makeScale(k, k * (0.8 + Math.random() * 0.6), k).setPosition(p); trees.setMatrixAt(i, m4);
  }
  scene.add(trees);
}

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
const P = {};
let traffic = [], pickups = [], state = 'loading', raceT = 0, countdown = 0, penalty = 0;
const stats = { perfect: 0, coins: 0, xpGain: 0, dogeGain: 0, jumpsOver: 0 };
const radioQueue = [];
const radioFlags = new Set();

function resetRace() {
  Object.assign(P, { s: 0, d: 3, y: 0, v: 0, vy: 0, grounded: true, charges: maxCharges(), recharge: 0, fuel: AIR_FUEL, slope: 0, air: 0, boostT: 0, boostG: 30, crashT: 0, shake: 0, steerVis: 0, finished: false });
  raceT = 0; penalty = 0;
  Object.assign(stats, { perfect: 0, coins: 0, xpGain: 0, dogeGain: 0, jumpsOver: 0 });
  radioFlags.clear(); radioQueue.length = 0;
  for (const t of traffic) scene.remove(t.mesh);
  for (const p of pickups) scene.remove(p.mesh);
  spawnTraffic(); spawnPickups();
}
function spawnTraffic() {
  traffic = [];
  const wProto = makeWaymo(), cProto = makeCybercab();
  for (let i = 0; i < 26; i++) {
    const waymo = i % 5 !== 2;
    const mesh = (waymo ? wProto : cProto).clone();
    const tail = (waymo ? wProto : cProto).userData.tail.clone();
    mesh.traverse((o) => { if (o.name === 'tail') o.material = tail; });
    mesh.userData = { tail, pivot: mesh.getObjectByName('pivot') };
    const t = { type: waymo ? 'waymo' : 'cab', s: 180 + i * 85 + Math.random() * 40, d: LANES[(Math.random() * 4) | 0], base: waymo ? 20 + Math.random() * 4 : 31 + Math.random() * 4, v: 0, brakeT: 0, cool: 0, over: false, mesh };
    t.v = t.base;
    if (t.s > GAP0 - 70) t.s -= 900;
    scene.add(mesh); traffic.push(t);
  }
}
function addPickup(type, s, d, y) {
  const mesh = pickupProtos[type].clone();
  mesh.userData.fans = []; mesh.traverse((o) => { if (o.name === 'rotor') mesh.userData.fans.push(o); });
  scene.add(mesh); pickups.push({ type, s, d, y, mesh, taken: false, phase: Math.random() * 6 });
}
function spawnPickups() {
  pickups = [];
  // coin lines
  for (let s = 90; s < FINISH_S - 40; s += 70 + Math.random() * 50) {
    if (s > GAP0 - 30 && s < GAP1 + 10) continue;
    const d = LANES[(Math.random() * 4) | 0], n = 5 + ((Math.random() * 4) | 0);
    for (let i = 0; i < n; i++) addPickup('coin', s + i * 5, d, 1.1 + groundAt(s + i * 5, d));
  }
  // GPUs scattered
  for (let s = 150; s < FINISH_S - 40; s += 55 + Math.random() * 45) {
    if (s > GAP0 - 30 && s < GAP1 + 10) continue;
    addPickup('gpu', s, LANES[(Math.random() * 4) | 0] + (Math.random() - 0.5) * 2, 1.2);
  }
  // H100 above ramp flight paths, air tanks before ramps
  for (const r of RAMPS) {
    const d = (r.dL + r.dR) / 2;
    if (r.dR - r.dL < 20) addPickup('h100', r.s0 + r.len + 18, d, r.h + 2.2);
    addPickup('air', r.s0 - 45, d, 1.2);
  }
  addPickup('legend', 1120 + 16 + 30, 1.5, 11);   // only reachable with ramp + jump
  // coin arc over the bridge gap
  for (let i = 0; i < 9; i++) { const s = GAP0 - 4 + i * 5.2, x = (s - (GAP0 - 4)) / 42; addPickup('coin', s, 0, 3 + 7 * Math.sin(Math.PI * x)); }
}

// ---------- input ----------
const input = { left: false, right: false, jump: false, brake: false, boost: false, jumpEdge: false };
const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'jump', ArrowUp: 'jump', KeyW: 'jump', ArrowDown: 'brake', KeyS: 'brake', ShiftLeft: 'boost', ShiftRight: 'boost', KeyB: 'boost' };
addEventListener('keydown', (e) => {
  const k = KEYMAP[e.code]; if (!k) return;
  e.preventDefault();
  if (k === 'jump' && !input.jump) input.jumpEdge = true;
  input[k] = true;
});
addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) input[k] = false; });
for (const btn of document.querySelectorAll('[data-key]')) {
  const k = btn.dataset.key;
  const on = (e) => { e.preventDefault(); if (k === 'jump' && !input.jump) input.jumpEdge = true; input[k] = true; btn.classList.add('down'); };
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
function radio(text, who = '일론', ava = 'EM') {
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
    const fill = i < P.charges ? 1 : i === P.charges ? P.recharge / RECHARGE : 0;
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
  renderPips();
}
const fmtTime = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(2).padStart(5, '0')}`;

// ---------- simulation ----------
const RADIO_SCRIPT = [
  [25, '오스틴에 온 걸 환영해. 로보택시가 처음 달리기 시작한 도시야.'],
  [190, '노란 경사로 보이면 점프! 공중에서 버튼을 꾹 누르면 사뿐히 착지해.'],
  [330, '저 하얀 웨이모들 지붕에 도는 거 보이지? 라이다야. 빨간 빛에 걸리면 겁먹고 급정거해.'],
  [600, '6번가야. 도지코인은 상점에서 쓸 거니까 싹 다 주워.'],
  [1050, '저 위에 보라색으로 빛나는 거, 전설의 블랙웰 칩이야. 큰 경사로에서 점프 버튼까지 같이 눌러봐.'],
  [1550, '다운타운이야. 이 빌딩들 전부 데이터센터로 바꾸면 딱인데.'],
  [2330, '다리가 끊겼어! 텍사스 교통국 또 일 안 했네. 속도 유지하고 경사로에서 점프!'],
];
function step(dt) {
  raceT += dt;
  const fr0 = frame(P.s);
  // speed
  const boosting = P.boostT > 0;
  let vmax = 62 + save.level * 0.8 + (boosting ? 20 : 0);
  let acc = (boosting ? 34 : 15) * Math.max(0, 1 - P.v / vmax) + (boosting ? 6 : 0);
  if (P.v > vmax) acc = -12;
  if (P.crashT > 0) { P.crashT -= dt; acc *= 0.3; }
  if (input.brake && P.grounded) acc = -42;
  P.v = Math.max(0, P.v + acc * dt);
  if (P.boostT > 0) P.boostT -= dt;
  if (input.boost && !boosting && P.boostG >= 35) { P.boostT = P.boostG / 35 * 1.1; P.boostG = 0; blip(200, 900, 0.5, 'sawtooth', 0.08); toast('부스트!', '', '#ff3d6e'); }

  // steering
  const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  P.d += steer * (P.grounded ? 15 : 9) * dt * Math.min(1, 0.4 + P.v / 40);
  P.d = THREE.MathUtils.clamp(P.d, -ROAD_HALF + 1.2, ROAD_HALF - 1.2);
  P.steerVis += (steer - P.steerVis) * Math.min(1, dt * 8);
  P.s += P.v * dt;

  // jump / thrust
  if (input.jumpEdge && P.grounded) {
    if (P.charges > 0) {
      P.charges--; P.vy = JUMP_V + P.slope * P.v; P.grounded = false; P.air = 0;
      blip(160, 520, 0.25, 'triangle', 0.15);
      const base = world(P.s, P.d, P.y);
      for (let i = 0; i < 14; i++) puff(base, new THREE.Vector3((Math.random() - 0.5) * 12, -1 + Math.random() * 2, (Math.random() - 0.5) * 12), '#e8f6ff', 1.2, 0.7);
    } else { toast('충전 중…', '압축공기가 부족해요', '#ff3d6e'); blip(200, 120, 0.15, 'square', 0.06); }
  }
  input.jumpEdge = false;
  if (P.recharge < RECHARGE && P.charges < maxCharges()) {
    P.recharge += dt;
    if (P.recharge >= RECHARGE) { P.recharge = 0; P.charges++; }
  } else if (P.charges >= maxCharges()) P.recharge = 0;

  P.thrusting = false;
  const g = groundAt(P.s, P.d);
  if (P.grounded) {
    if (g < P.y - 0.3) { // left a ramp top or a broken bridge
      P.grounded = false; P.vy = P.slope * P.v; P.air = 0;
    } else {
      const r = rampAt(P.s, P.d); P.slope = r ? r.h / r.len : 0; P.y = g;
    }
    P.fuel = Math.min(AIR_FUEL, P.fuel + dt * 1.5);
  }
  if (!P.grounded) {
    P.air += dt;
    P.vy -= G * dt;
    if (input.jump && P.vy < 3 && P.fuel > 0) {
      P.thrusting = true; P.fuel -= dt; P.vy += 27 * dt; if (P.vy < -7) P.vy += 20 * dt;
      if (Math.random() < 0.8) { const base = world(P.s, P.d + (Math.random() - 0.5) * 1.6, P.y); puff(base, new THREE.Vector3(0, -14, 0), '#cfefff', 0.6, 0.35); }
    }
    P.y += P.vy * dt;
    if (P.y <= g) land(g);
    if (P.y < -5.5) splash();
  }

  // traffic
  for (const t of traffic) {
    if (t.brakeT > 0) { t.brakeT -= dt; t.v = Math.max(0, t.v - 60 * dt); if (t.brakeT <= 0) t.cool = 3; }
    else t.v += (t.base - t.v) * Math.min(1, dt * 0.8);
    t.cool -= dt;
    t.s += t.v * dt;
    if (t.s < P.s - 80 || t.s > GAP0 - 40) {
      t.s = Math.min(GAP0 - 60, P.s + 320 + Math.random() * 380); t.d = LANES[(Math.random() * 4) | 0]; t.over = false; t.brakeT = 0; t.v = t.base;
      if (t.s < P.s + 120) t.s = P.s - 100; // nothing left ahead: park it behind
    }
    const ds = t.s - P.s, dd = Math.abs(t.d - P.d);
    if (t.type === 'waymo' && t.brakeT <= 0 && t.cool <= 0 && ds > -6 && ds < 26 && dd < 6.5 && P.y < 2) {
      t.brakeT = 2.6;
      if (!radioFlags.has('lidar')) { radioFlags.add('lidar'); floatText('웨이모: 장애물 감지! 급정거!'); }
      else if (Math.random() < 0.3) floatText('웨이모: 장애물 감지!');
    }
    if (Math.abs(ds) < 4.5 && dd < 2.1) {
      if (P.y < 1.6) crash(t);
      else if (!t.over) { t.over = true; stats.jumpsOver++; gainXP(15, '자율주행차 뛰어넘기 +15 EXP'); P.boostG = Math.min(100, P.boostG + 15); blip(600, 900, 0.12); }
    }
  }

  // pickups
  for (const p of pickups) {
    if (p.taken) continue;
    const ds = p.s - P.s; if (ds > 6 || ds < -4) continue;
    if (Math.abs(p.d - P.d) < PICK[p.type].r && Math.abs(p.y - (P.y + 0.7)) < PICK[p.type].r + 0.4) collect(p);
  }

  // radio
  for (const [s, text] of RADIO_SCRIPT) if (P.s > s && !radioFlags.has(s)) { radioFlags.add(s); radio(text); }

  if (P.s >= FINISH_S && !P.finished) finish();
  if (P.shake > 0) P.shake -= dt * 1.8;
  return fr0;
}
function land(g) {
  const impact = -P.vy;
  P.y = g; P.grounded = true; P.vy = 0;
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
function crash(t) {
  P.v = Math.min(P.v * 0.45, t.v + 2); P.s = t.s - 4.6; P.crashT = 0.8; P.shake = 0.8;
  toast('쾅!', t.type === 'waymo' ? '웨이모와 충돌' : '로보택시와 충돌', '#ff3d6e');
  blip(180, 40, 0.35, 'sawtooth', 0.2);
  const base = world(P.s + 2, P.d, 1);
  for (let i = 0; i < 18; i++) puff(base, new THREE.Vector3((Math.random() - 0.5) * 10, Math.random() * 5, (Math.random() - 0.5) * 10), i % 2 ? '#ffb347' : '#555', 0.9, 0.6);
}
function splash() {
  const base = world(P.s, P.d, -6);
  for (let i = 0; i < 30; i++) puff(base, new THREE.Vector3((Math.random() - 0.5) * 10, 6 + Math.random() * 10, (Math.random() - 0.5) * 10), '#bfe9ff', 1.4, 1);
  toast('풍덩!', '콜로라도강에 빠졌어요 · +3초', '#38f5ff');
  radio('괜찮아, 로드스터는 방수야. 아마도. 다시 가자!');
  blip(300, 60, 0.5, 'sine', 0.2);
  Object.assign(P, { s: GAP0 - 150, y: 0, vy: 0, v: 52, grounded: true, charges: Math.max(P.charges, 1), shake: 0.4 });
  penalty += 3;
}
function collect(p) {
  p.taken = true; scene.remove(p.mesh);
  switch (p.type) {
    case 'coin': save.doge += 5; stats.dogeGain += 5; stats.coins++; P.boostG = Math.min(100, P.boostG + 3); blip(988, 1480, 0.09, 'square', 0.06); break;
    case 'air': P.charges = Math.min(maxCharges(), P.charges + 1); P.fuel = AIR_FUEL; floatText('압축공기 +1'); blip(300, 900, 0.18, 'sine', 0.12); break;
    default: gainXP(PICK[p.type].xp, PICK[p.type].label); blip(660, 1320, 0.16, 'triangle', 0.14);
      if (p.type === 'legend') { toast('전설의 블랙웰 칩!', '+200 EXP', '#b07dff'); radio('그거 젠슨이 찾고 있던 건데… 우리가 가져가자.'); }
  }
}
function finish() {
  P.finished = true; state = 'finish';
  const t = raceT + penalty;
  const stars = 1 + (t <= 62 ? 1 : 0) + (stats.perfect >= 3 ? 1 : 0);
  const best = save.best && save.best < t ? save.best : t; save.best = best;
  writeSave();
  radio('착지 완벽. 다음 목적지는 LA야. 준비해둬.');
  setTimeout(() => {
    $('rTime').textContent = fmtTime(t);
    $('rBest').textContent = fmtTime(best);
    $('rStars').innerHTML = [0, 1, 2].map((i) => `<span class="${i < stars ? 'on' : ''}">★</span>`).join('');
    $('rPerfect').textContent = stats.perfect;
    $('rCoins').textContent = `+${stats.dogeGain}`;
    $('rXp').textContent = `+${stats.xpGain}`;
    $('rLv').textContent = `LV ${save.level}`;
    $('results').hidden = false;
  }, 900);
}

// ---------- render sync ----------
const tmpV = new THREE.Vector3(), lookV = new THREE.Vector3(), camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
let orbitT = 0;
function placeCar() {
  const fr = frame(P.s);
  world(P.s, P.d, P.y, car.position);
  const pitch = P.grounded ? -Math.atan(P.slope) : -Math.atan2(P.vy, Math.max(P.v, 10)) * 0.8;
  car.rotation.set(0, 0, 0);
  car.rotation.order = 'YXZ';
  car.rotation.y = fr.yaw - P.steerVis * 0.12;
  car.rotation.x = -pitch * -1;
  car.rotation.z = -P.steerVis * 0.05;
  for (const w of car.userData.wheels) w.children.forEach((c) => (c.rotation.x -= P.v * 0.016));
  const blob = car.getObjectByName('blob'); if (blob) { blob.visible = groundAt(P.s, P.d) > -100; blob.position.y = 0.03 - P.y + groundAt(P.s, P.d); blob.material.opacity = 0.9 / (1 + Math.max(0, P.y - groundAt(P.s, P.d)) * 0.35); }
  car.userData.jet.opacity = P.thrusting ? 0.9 : Math.max(0, car.userData.jet.opacity - 0.08);
  car.userData.tail.color.setRGB(input.brake ? 8 : 4, 0.25, 0.35);
}
function syncTraffic(time) {
  for (const t of traffic) {
    world(t.s, t.d, 0, t.mesh.position);
    t.mesh.rotation.y = frame(t.s).yaw;
    if (t.mesh.userData.pivot) t.mesh.userData.pivot.rotation.y = time * 5 + t.s;
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
function updateCamera(dt, time) {
  const fr = frame(P.s);
  if (state === 'poster' || state === 'loading') {
    orbitT += dt * 0.18;
    const a = orbitT + 0.6;
    camPos.set(car.position.x + Math.sin(a) * 9, 2.3 + Math.sin(orbitT * 0.7) * 0.6, car.position.z + Math.cos(a) * 9);
    camera.position.copy(camPos); camera.lookAt(car.position.x, 0.9, car.position.z);
    camera.fov = 48; camera.updateProjectionMatrix();
    return;
  }
  const speedK = P.v / 70;
  tmpV.copy(car.position).addScaledVector(fr.f, -(8.5 + speedK * 2.5)); tmpV.y = Math.max(P.y * 0.7, 0) + 3.4 + speedK * 0.4;
  lookV.copy(car.position).addScaledVector(fr.f, 10); lookV.y = P.y * 0.55 + 1.4;
  const k = Math.min(1, dt * 7);
  camPos.lerp(tmpV, k); camLook.lerp(lookV, Math.min(1, dt * 10));
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
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth * Q.bloomRes, innerHeight * Q.bloomRes), 0.6, 0.5, 0.9);
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
  $('poster').hidden = true; $('results').hidden = true; $('hud').hidden = false;
  resetRace(); placeCar();
  const fr = frame(0); camPos.copy(car.position).addScaledVector(fr.f, -9); camPos.y = 3.4; camLook.copy(car.position);
  state = 'count'; countdown = 3.2;
}
$('startBtn').addEventListener('click', startRace);
$('againBtn').addEventListener('click', startRace);

let last = performance.now();
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
  if (state === 'race') { const sub = 2; for (let i = 0; i < sub; i++) step(dt / sub); }
  else if (state === 'finish') { P.v = Math.max(0, P.v - 30 * dt); P.s += P.v * dt; P.thrusting = false; }
  if (state !== 'loading') { placeCar(); syncTraffic(time); syncPickups(time); }
  updatePuffs(dt); updateRadio(dt);
  if (toastT > 0) toastT -= dt;
  if (!window.__game?.frozen) updateCamera(dt, time);
  sky.position.copy(camera.position);
  const fr = frame(P.s || 0);
  sun.position.copy(car.position).addScaledVector(SUN_DIR, 80); sun.position.y = 45; sun.target.position.copy(car.position);
  if (state !== 'poster' && state !== 'loading') updateHUD();
  updateAudio();
  composer.render();
  requestAnimationFrame(loop);
}

// ---------- boot ----------
function boot() {
  buildWorld();
  resetRace(); placeCar(); syncTraffic(0); syncPickups(0);
  state = 'poster';
  $('startBtn').disabled = false; $('startBtn').textContent = '출발';
  $('loadTxt').hidden = true;
  $('saveLine').textContent = `LV ${save.level} · Ð ${save.doge.toLocaleString()}${save.best ? ` · 최고 기록 ${fmtTime(save.best)}` : ''}`;
}
document.fonts?.ready.then(() => setTimeout(boot, 30)) ?? setTimeout(boot, 30);
requestAnimationFrame(loop);
window.__game = { P, get state() { return state; }, input, scene, camera, car, THREE, models: { makeRoadster, makeWaymo, makeCybercab, makeRTX5090, makeH100 },
  freeze(on) { this.frozen = on; } };
