// Stage 5: Washington, D.C. on a clear morning. Constitution Avenue from the Lincoln Memorial to the
// Capitol: the Reflecting Pool (a real mirror on desktop), the WWII Memorial fountains, the Washington
// Monument ringed with flags, the White House across the Ellipse, cherry blossoms, limestone federal
// blocks, a motorcade gridlock to drive across, then up Capitol Hill.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const ROAD_HALF = 12;
const FINISH_S = 3150;
const AXIS = 95;                     // the Mall's axis, as world x (Constitution Ave runs north of it)
const POOL = [170, 770], POOL_W = 30;
const WWII_S = 860, MONUMENT_S = 1060, WH_S = 1060, CAPITOL_S = 3440, LINCOLN_S = -110;
const HILL = [2650, 2950], HILL_H = 9;

function cxRaw(s) { return 30 * THREE.MathUtils.smoothstep(s, 2450, 2950); }
const axisD = (s) => AXIS - cxRaw(s);   // lateral d of the Mall axis at s
function elev(s) { return HILL_H * THREE.MathUtils.smoothstep(s, HILL[0], HILL[1]); }

export default {
  id: 'dc', num: 5, name: '워싱턴 DC',
  roadHalf: ROAD_HALF, lanes: [-9, -3, 3, 9], finish: FINISH_S,
  gaps: [],
  elev,
  cx: cxRaw,
  ramps: [
    { s0: 330, len: 16, dL: -6, dR: 6, h: 3.0 },
    { s0: 1240, len: 18, dL: -12, dR: -6, h: 4.6 },   // the high one: legend above its flight
    { s0: 1560, len: 16, dL: 3, dR: 12, h: 3.2 },
    { s0: 538, len: 16, dL: -ROAD_HALF, dR: ROAD_HALF, h: 2.4 },
    { s0: 1848, len: 16, dL: -6, dR: 6, h: 3.0 },
    { s0: 2300, len: 16, dL: -6, dR: 6, h: 3.2 },
    { s0: 2600, len: 16, dL: -12, dR: -3, h: 3.2 },
  ],
  jams: [[570, 730]],
  legend: { s: 1300, d: -9, y: 11 },
  pickups: [
    ...range(346, 380, 6).map((s, i) => ['coin', s, 0, 3.5 + i * 0.9]),
    ...range(1576, 1610, 6).map((s, i) => ['coin', s, 7.5, 3.8 + i * 0.9]),
    ['h100', 1000, 9, 1.6], ['h100', 2320, 0, 9], ['h100', 2900, -9, 1.6],
    ['air', 380, 3, 1.2], ['air', 1200, -9, 1.2], ['air', 1820, 3, 1.2], ['air', 2560, -9, 1.2],
    ['gpu', 700, -3, 1.4], ['gpu', 1400, 3, 1.4], ['gpu', 2200, -9, 1.4], ['gpu', 2750, 9, 1.4],
  ],
  trafficMaxS: FINISH_S + 200,
  road: { yellow: true, dashes: [0.25, 0.75] },
  env: {
    bg: true, sun: ['#fff3e0', 2.8], hemi: ['#c4d8ff', '#7a7058', 0.6],
    fog: ['#c9d6e6', 320, 2800], hdri: 'assets/dc_day_rgbe_gray.png', exposure: 0.72, bgIntensity: 0.95, bloom: 0.28, hdrMax: 2500,
  },
  traffic: {
    model3: { car: 'model3', name: '모델 3', speed: [26, 32], n: 4 },
    robotaxi: { car: 'modely', name: '테슬라 로보택시', speed: [30, 34], color: '#f2f2f0', n: 3 },
    suv: { car: 'modely', name: '경호 SUV', speed: [22, 27], color: '#0d0e12', n: 4, brakes: true },
    cybertruck: { car: 'cybertruck', name: '사이버트럭', speed: [24, 29], n: 2 },
    bus: { car: 'torino', name: '관광버스', speed: [15, 18], n: 1 },
  },
  jamMix: { suv: 8, model3: 3, robotaxi: 2, bus: 1 },
  boss: 'icecream',
  props: ['icecream', 'af1'],
  radio: [
    [20, '워싱턴 DC야. 링컨 기념관에서 출발해서 의사당까지 컨스티튜션 애비뉴를 달린다.'],
    [200, '오른쪽이 리플렉팅 풀. 물에 비친 워싱턴 기념탑 봐. 진짜 거울 같지?'],
    [470, '경호 행렬 때문에 꽉 막혔어. 경사로 타고 지붕 위로!'],
    [800, '저 멀리 왼쪽이 화이트하우스야. 경호원들이 우릴 째려보는 중.'],
    [1180, '왼쪽 끝 큰 경사로! 끝에서 점프하면 전설 칩이 떠 있어.'],
    [1480, '벚꽃 폈다! 박물관 거리야.'],
    [2640, '캐피톨 힐 오르막이야. 결승선까지 밟아!'],
  ],
  lines: { finish: '의사당 도착! 지구는 여기까지. 다음은 스타베이스에서 스타쉽에 합체한다!' },
  stars: { time: 66, text: '완주 · 아이스크림 트럭 격추 · 66초 이내 또는 퍼펙트 랜딩 4회', perfect: 4 },
  poster: { s: 930, d: 4, y: 5, boss: [22, -4, 0, 0], cam: { back: 14, side: -7, y: 2, ahead: 130, lookSide: 50, lookY: 45, fov: 58 } },
  text: {
    eyebrow: 'STAGE 05 · RED TAPE', title: 'WASHINGTON D.C.', sub: '규제의 수도를 돌파하라',
    tip: '<b>TIP</b> 보스가 <b>졸면</b> 3초 동안 무방비예요. 트럭 지붕에 착지해서 밟으세요. 드론이 합류하면 <b>메가폰 충격파</b>는 점프로 넘으면 돼요.',
    tweet: '워싱턴에 왔더니 아이스크림 트럭이 규제 서류를 던짐. 에어포스 원은 드론이 돼서 연비 단속 중. 나는 그냥 의사당까지 달릴 뿐.',
    meta: '오전 9:41 · 워싱턴 DC · 리트윗 150만', load: '규제 서류 3만 장 인쇄 중 · 벚꽃 피우는 중',
    hud: 'STAGE 5 · WASHINGTON D.C.', clear: 'STAGE 05 CLEAR', clearTitle: '규제 돌파',
  },
  build,
  tick,
};

function range(a, b, step) { const out = []; for (let s = a; s <= b; s += step) out.push(s); return out; }
function rnd(seed) { let x = seed >>> 0; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; }; }
const glow = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), toneMapped: false });
const live = { jets: [], flags: [], pool: null };

// shared materials, built in build() once the kit is here
let MAT = null;
function mats(k) {
  const stone = (rep, color) => new THREE.MeshStandardMaterial({ map: k.photo('dc_stone_diff.jpg', { rep }), normalMap: k.photo('dc_stone_nor.jpg', { srgb: false, rep }), color, roughness: 0.75 });
  return {
    marble: stone([0.12, 0.12], '#fbf8f0'),
    lime: stone([0.1, 0.1], '#efe6d2'),
    white: new THREE.MeshStandardMaterial({ color: '#f6f5f1', roughness: 0.55, map: k.photo('dc_stone_diff.jpg', { rep: [0.06, 0.06] }) }),
    sandstone: stone([0.15, 0.15], '#b8634a'),
    plaza: new THREE.MeshStandardMaterial({ map: k.photo('dc_plaza_diff.jpg', { rep: [0.12, 0.12] }), normalMap: k.photo('dc_plaza_nor.jpg', { srgb: false, rep: [0.12, 0.12] }), color: '#e6ddc8', roughness: 0.85 }),
    gravel: new THREE.MeshStandardMaterial({ map: k.photo('dc_plaza_diff.jpg', { rep: [0.3, 0.3] }), color: '#d8c8a4', roughness: 1 }),
    grass: new THREE.MeshStandardMaterial({ map: k.photo('sf_grass_diff.jpg', { rep: [1 / 8, 1 / 8] }), normalMap: k.photo('sf_grass_nor.jpg', { srgb: false, rep: [1 / 8, 1 / 8] }), color: '#8fb06a', roughness: 1 }),
    walk: new THREE.MeshStandardMaterial({ map: k.photo('sf_walk_diff.jpg', { rep: [0.25, 0.25] }), normalMap: k.photo('sf_walk_nor.jpg', { srgb: false, rep: [0.25, 0.25] }), color: '#d4cdc2', roughness: 0.85 }),
    dark: new THREE.MeshStandardMaterial({ color: '#1c1d22', roughness: 0.6 }),
    iron: new THREE.MeshStandardMaterial({ color: '#1a1a1c', metalness: 0.7, roughness: 0.45 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#1b2430', roughness: 0.08, metalness: 0.3, clearcoat: 1 }),
    bronze: new THREE.MeshStandardMaterial({ color: '#6a5a3a', metalness: 0.9, roughness: 0.4 }),
  };
}
// column instances collected from every temple, drawn in one go per material
const COLS = { marble: [], white: [], lime: [] };
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();

// place a group on the track: at (s, d) with its local +x turned by rot from the road's lateral axis
function place(k, g, s, d, y, rot) {
  k.world(s, d, y, g.position); g.rotation.y = k.frame(s).yaw + rot; k.scene.add(g); g.updateMatrixWorld(true);
  return g;
}
function box(g, w, h, dp, x, y, z, m, shadow = true) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, dp), m); b.position.set(x, y, z); b.castShadow = shadow; b.receiveShadow = true; g.add(b); return b; }
function column(g, matKey, x, y, z, r, h) {
  // fluted shaft drawn later as an instance: remember its matrix relative to the group
  (g.userData.cols ??= []).push({ key: matKey, m: new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(r, h, r)) });
}
function flushCols(g) { for (const c of g.userData.cols || []) COLS[c.key].push(new THREE.Matrix4().multiplyMatrices(g.matrixWorld, c.m)); }
function pediment(g, w, h, depth, x, y, m) {
  const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(0, h); sh.lineTo(-w / 2, 0);
  const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false }); geo.translate(0, 0, -depth / 2);
  const p = new THREE.Mesh(geo, m); p.rotation.y = Math.PI / 2; p.position.set(x, y, 0); p.castShadow = true; g.add(p);
  // tympanum shadow: a recessed darker triangle on the face
  return p;
}
// a classical front: podium + steps, body, portico of n columns facing local +x, entablature, pediment
function temple(g, { w, dp, h, n, pd = 6, mat = 'marble', ped = true, body = true, stepsN = 5, colsAround = false }) {
  const M = MAT[mat], podH = 2.2;
  box(g, dp + pd + 2, podH, w + 2, pd / 2, podH / 2, 0, M);
  for (let i = 0; i < stepsN; i++) box(g, 0.6, podH * (1 - i / stepsN), w * 0.7, dp / 2 + pd + 1 + 0.3 + i * 0.6, podH * (1 - i / stepsN) / 2, 0, M);
  if (body) box(g, dp, h, w, 0, podH + h / 2, 0, M);
  const colH = h * 0.92, r = colH / 19, cw = w * (colsAround ? 0.96 : 0.62);
  for (let i = 0; i < n; i++) column(g, mat, dp / 2 + pd - 1.2, podH, -cw / 2 + i * cw / (n - 1), r, colH);
  if (colsAround) for (let i = 1; i < Math.round(n * dp / w); i++) for (const z of [-cw / 2, cw / 2]) column(g, mat, dp / 2 + pd - 1.2 - i * (dp + pd - 2.4) / Math.round(n * dp / w), podH, z, r, colH);
  const ent = h * 0.13;
  box(g, pd + 0.5 + (colsAround ? dp : 0), ent, cw + r * 4, colsAround ? pd / 2 : dp / 2 + pd / 2, podH + colH + ent / 2, 0, M);
  if (ped) pediment(g, cw + r * 4, cw * 0.17, pd + 0.6, dp / 2 + pd / 2, podH + colH + ent, M);
  return podH + colH + ent;
}

function build(k) {
  MAT = mats(k);
  const rand = rnd(5);
  buildGround(k, rand);
  buildPool(k);
  buildLincoln(k);
  buildWWII(k);
  buildMonument(k);
  buildWhiteHouse(k);
  buildFederal(k, rand);
  buildSmithsonian(k);
  buildCapitol(k);
  buildTrees(k, rand);
  buildLamps(k);
  buildColumns(k);
  k.finishArch('FINISH · 미국 국회의사당');
}

// ---------- ground: lawns, the avenue's sidewalks, gravel paths along the Mall ----------
function buildGround(k) {
  const { scene } = k;
  for (const side of [-1, 1]) {
    const [a, b] = side < 0 ? [-(ROAD_HALF + 5), -ROAD_HALF] : [ROAD_HALF, ROAD_HALF + 5];
    const sw = new THREE.Mesh(k.ribbon(-300, FINISH_S + 300, a, b, 4, () => 0.16, 4), MAT.walk); sw.receiveShadow = true; scene.add(sw);
    scene.add(new THREE.Mesh(k.wall(-300, FINISH_S + 300, side * ROAD_HALF, 4, () => 0, () => 0.16, 1), MAT.walk));
    const [l, r] = side < 0 ? [-900, -(ROAD_HALF + 4.9)] : [ROAD_HALF + 4.9, 900];
    const g = new THREE.Mesh(k.grid(-500, CAPITOL_S + 300, l, r, 14, 20, () => 0.1, 1), MAT.grass); g.receiveShadow = true; scene.add(g);
  }
  // gravel walks either side of the Mall axis, from the Monument to the Capitol
  for (const o of [-36, 36]) {
    const m = new THREE.Mesh(k.ribbon(MONUMENT_S + 120, CAPITOL_S - 160, 0, 1, 6, () => 0.13), MAT.gravel);
    // ribbon dL/dR must follow the axis: rebuild positions along axisD
    const pos = m.geometry.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) { const seg = i >> 1, s = MONUMENT_S + 120 + (CAPITOL_S - 160 - MONUMENT_S - 120) * seg / (pos.count / 2 - 1); k.world(s, axisD(s) + o + (i & 1 ? 5 : -5), 0.13, v); pos.setXYZ(i, v.x, v.y, v.z); }
    pos.needsUpdate = true; m.geometry.computeVertexNormals(); m.receiveShadow = true; scene.add(m);
  }
  // cross streets
  for (const s of [640, 1320, 1700, 2150, 2480]) for (const side of [-1, 1]) {
    const [l, r] = side < 0 ? [-900, -ROAD_HALF] : [ROAD_HALF, side > 0 && s < 1300 ? 30 : 900];
    const m = new THREE.Mesh(k.grid(s - 8, s + 8, l, r, 16, 30, () => 0.14, 1), k.M.road); m.receiveShadow = true; scene.add(m);
  }
}

// ---------- the Reflecting Pool ----------
function buildPool(k) {
  const len = POOL[1] - POOL[0], mid = (POOL[0] + POOL[1]) / 2;
  const g = new THREE.Group();
  const geo = new THREE.PlaneGeometry(POOL_W, len);
  let water;
  if (!k.IS_MOBILE) {
    water = new Reflector(geo, { textureWidth: Math.round(innerWidth * 0.6), textureHeight: Math.round(innerHeight * 0.6), color: '#9aa8ab', clipBias: 0.003, multisample: 0 });
  } else water = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: '#4a6068', roughness: 0.04, metalness: 0.3, envMapIntensity: 1.3 }));
  water.rotation.x = -Math.PI / 2; water.position.y = 0.55; g.add(water);
  // granite coping and the walk around it
  for (const x of [-POOL_W / 2 - 0.6, POOL_W / 2 + 0.6]) box(g, 1.2, 0.8, len + 2.4, x, 0.4, 0, MAT.marble);
  for (const z of [-len / 2 - 0.6, len / 2 + 0.6]) box(g, POOL_W + 2.4, 0.8, 1.2, 0, 0.4, z, MAT.marble);
  for (const x of [-POOL_W / 2 - 6, POOL_W / 2 + 6]) box(g, 9.6, 0.14, len + 12, x, 0.07, 0, MAT.gravel, false);
  // the pool runs along the track; its local z is the track direction (rot 0 → local x = d)
  place(k, g, mid, axisD(mid), 0, 0);
  live.pool = water;
}

// ---------- Lincoln Memorial: the start line's backdrop ----------
function buildLincoln(k) {
  const g = new THREE.Group();
  const W = 58, D = 36, H = 13;
  // stepped terraces
  for (let i = 0; i < 4; i++) box(g, D + 30 - i * 6, 1.4, W + 30 - i * 6, 0, 0.7 + i * 1.4, 0, MAT.marble);
  const base = 5.6;
  box(g, D - 8, H + 2, W - 8, 0, base + (H + 2) / 2, 0, MAT.dark); // the dim hall inside the colonnade
  // the 36-column peristyle
  const r = 0.95, n = 12, m = 6;
  for (let i = 0; i < n; i++) for (const x of [-D / 2 + 1.5, D / 2 - 1.5]) column(g, 'marble', x, base, -W / 2 + 1.5 + i * (W - 3) / (n - 1), r, H);
  for (let i = 1; i < m - 1; i++) for (const z of [-W / 2 + 1.5, W / 2 - 1.5]) column(g, 'marble', -D / 2 + 1.5 + i * (D - 3) / (m - 1), base, z, r, H);
  box(g, D + 0.5, 2.4, W + 0.5, 0, base + H + 1.2, 0, MAT.marble);   // entablature
  box(g, D - 6, 4.2, W - 6, 0, base + H + 2.4 + 2.1, 0, MAT.marble); // attic
  // the seated figure, a bronze-dark silhouette inside
  const fig = new THREE.Mesh(new THREE.CapsuleGeometry(1.8, 3.4, 6, 12), MAT.marble); fig.position.set(-D / 2 + 9, base + 4.2, 0); g.add(fig);
  // faces down the pool (track direction): local +x → forward
  place(k, g, LINCOLN_S, axisD(LINCOLN_S), 0, Math.PI / 2);
  flushCols(g);
}

// ---------- WWII Memorial: oval fountain plaza ringed by pillars ----------
function buildWWII(k) {
  const g = new THREE.Group();
  const RX = 46, RZ = 34;
  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.5, 64), MAT.plaza); plaza.scale.set(RX + 14, 1, RZ + 14); plaza.position.y = 0.25; plaza.receiveShadow = true; g.add(plaza);
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.6, 64), new THREE.MeshPhysicalMaterial({ color: '#567a86', roughness: 0.03, metalness: 0.3, envMapIntensity: 1.4 })); basin.scale.set(RX * 0.62, 1, RZ * 0.62); basin.position.y = 0.4; g.add(basin);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 6, 96), MAT.marble); rim.rotation.x = Math.PI / 2; rim.scale.set(RX * 0.63, RZ * 0.63, 40); rim.position.y = 0.75; g.add(rim);
  // 56 granite pillars with bronze wreaths, in two arcs
  const pil = new THREE.BoxGeometry(1.3, 5.2, 0.9); pil.translate(0, 2.6, 0);
  const im = new THREE.InstancedMesh(pil, MAT.marble, 56);
  const wr = new THREE.InstancedMesh(new THREE.TorusGeometry(0.4, 0.09, 6, 16), MAT.bronze, 56);
  let i = 0;
  for (const side of [-1, 1]) for (let j = 0; j < 28; j++) {
    const a = side * (0.25 + j / 27 * (Math.PI - 0.5)) + (side < 0 ? 0 : 0), x = Math.cos(a) * RX, z = Math.sin(a) * RZ;
    _q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, -a); im.setMatrixAt(i, _m.compose(_p.set(x, 0.5, z), _q, _s.set(1, 1, 1)));
    wr.setMatrixAt(i, _m.compose(_p.set(x * 0.985, 4.4, z * 0.985), _q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)), _s.set(1, 1, 1)));
    i++;
  }
  im.castShadow = true; g.add(im, wr);
  // the two arches (Atlantic, Pacific)
  for (const z of [-RZ - 2, RZ + 2]) { box(g, 7, 13, 7, 0, 6.5, z, MAT.marble); box(g, 3.2, 8, 7.4, 0, 4, z, MAT.dark); }
  // fountain jets
  const jetMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false });
  for (let j = 0; j < 14; j++) {
    const a = j / 14 * Math.PI * 2, jet = new THREE.Mesh(new THREE.ConeGeometry(0.35, 6, 10, 1, true), jetMat);
    jet.position.set(Math.cos(a) * RX * 0.5, 3.4, Math.sin(a) * RZ * 0.5); g.add(jet); live.jets.push({ m: jet, ph: a * 3 });
  }
  place(k, g, WWII_S, axisD(WWII_S), 0, 0);
}

// ---------- the Washington Monument and its ring of flags ----------
function flagTex() {
  const c = document.createElement('canvas'); c.width = 380; c.height = 200; const x = c.getContext('2d');
  for (let i = 0; i < 13; i++) { x.fillStyle = i % 2 ? '#ffffff' : '#b22234'; x.fillRect(0, i * 200 / 13, 380, 200 / 13 + 1); }
  x.fillStyle = '#3c3b6e'; x.fillRect(0, 0, 152, 108);
  x.fillStyle = '#ffffff'; for (let r = 0; r < 9; r++) for (let q = 0; q < (r % 2 ? 5 : 6); q++) { x.beginPath(); x.arc(13 + q * 25 + (r % 2 ? 12.5 : 0), 7 + r * 11.5, 3.2, 0, Math.PI * 2); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function buildMonument(k) {
  const g = new THREE.Group();
  // the grassy knoll it stands on
  const knoll = new THREE.Mesh(new THREE.CylinderGeometry(70, 110, 5, 48), MAT.grass); knoll.position.y = 2.2; knoll.receiveShadow = true; g.add(knoll);
  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(38, 38, 0.4, 48), MAT.plaza); plaza.position.y = 4.9; plaza.receiveShadow = true; g.add(plaza);
  const base = 5.1, H = 152, B = 8.4 * Math.SQRT2, T = 5.25 * Math.SQRT2;
  // shaft in two marbles (construction paused for 23 years; the stone changes colour a third of the way up)
  const lowH = 46;
  const low = new THREE.Mesh(new THREE.CylinderGeometry(B - (B - T) * lowH / H, B, lowH, 4, 1), new THREE.MeshStandardMaterial({ map: MAT.marble.map, normalMap: MAT.marble.normalMap, color: '#ffffff', roughness: 0.65 }));
  low.rotation.y = Math.PI / 4; low.position.y = base + lowH / 2; low.castShadow = true; g.add(low);
  const up = new THREE.Mesh(new THREE.CylinderGeometry(T, B - (B - T) * lowH / H, H - lowH, 4, 1), new THREE.MeshStandardMaterial({ map: MAT.marble.map, normalMap: MAT.marble.normalMap, color: '#f6eee2', roughness: 0.65 }));
  up.rotation.y = Math.PI / 4; up.position.y = base + lowH + (H - lowH) / 2; up.castShadow = true; g.add(up);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(T, 17, 4), up.material); cap.rotation.y = Math.PI / 4; cap.position.y = base + H + 8.5; cap.castShadow = true; g.add(cap);
  // observation windows and aircraft warning lights near the top
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2, w = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), MAT.dark); w.position.set(Math.sin(a) * 5.35, base + H - 6, Math.cos(a) * 5.35); w.rotation.y = a; g.add(w); }
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4, l = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), glow(4, 0.2, 0.15)); l.position.set(Math.sin(a) * 7.1, base + H - 1, Math.cos(a) * 7.1); g.add(l); }
  // fifty flags
  const fm = new THREE.MeshStandardMaterial({ map: flagTex(), side: THREE.DoubleSide, roughness: 0.8 });
  const fgeo = new THREE.PlaneGeometry(3.2, 1.7, 12, 1); fgeo.translate(1.6, 0, 0);
  const pos = fgeo.attributes.position; for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 1.6) * 0.18 * pos.getX(i) / 3.2);
  fgeo.computeVertexNormals();
  const poleGeo = new THREE.CylinderGeometry(0.07, 0.09, 11, 6); poleGeo.translate(0, 5.5, 0);
  const poles = new THREE.InstancedMesh(poleGeo, MAT.white, 50), flags = new THREE.InstancedMesh(fgeo, fm, 50);
  for (let i = 0; i < 50; i++) {
    const a = i / 50 * Math.PI * 2; _p.set(Math.cos(a) * 33, base, Math.sin(a) * 33);
    poles.setMatrixAt(i, _m.compose(_p, _q.identity(), _s.set(1, 1, 1)));
    _p.y = base + 10; _q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, 0.6); flags.setMatrixAt(i, _m.compose(_p, _q, _s.set(1, 1, 1)));
  }
  g.add(poles, flags);
  place(k, g, MONUMENT_S, axisD(MONUMENT_S), -0.1, 0);
}

// ---------- the White House across the Ellipse ----------
function buildWhiteHouse(k) {
  const g = new THREE.Group();
  const W = 52, D = 26, H = 17;
  box(g, D, H, W, 0, H / 2, 0, MAT.white);
  box(g, D + 0.8, 1.2, W + 0.8, 0, H + 0.6, 0, MAT.white); // balustrade
  box(g, D - 6, 2.5, W - 6, 0, H + 1.25, 0, new THREE.MeshStandardMaterial({ color: '#8e9296', roughness: 0.6 })); // the low roof
  // two rows of windows on the south face (+x)
  for (let row = 0; row < 2; row++) for (let i = 0; i < 11; i++) { if (i >= 4 && i <= 6 && row === 0) continue; const w = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.6), MAT.glass); w.position.set(D / 2 + 0.02, 4.5 + row * 6.5, -W / 2 + 4 + i * (W - 8) / 10); w.rotation.y = Math.PI / 2; g.add(w); }
  // the south portico: a half-round of six columns with the Truman balcony
  const R = 9;
  for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i / 5 * Math.PI; column(g, 'white', D / 2 + Math.cos(a) * R * 0.8, 0, Math.sin(a) * R, 0.55, H - 1.5); }
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.6, R + 0.6, 1.4, 32, 1, false, 0, Math.PI), MAT.white); drum.position.set(D / 2, H - 0.8, 0); drum.scale.x = 0.8; g.add(drum);
  const bal = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.3, 32, 1, false, 0, Math.PI), MAT.white); bal.position.set(D / 2, 6.5, 0); bal.scale.x = 0.8; g.add(bal);
  // flag on the roof
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 7, 6), MAT.white); pole.position.set(0, H + 5.5, 0); g.add(pole);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.6), new THREE.MeshStandardMaterial({ map: flagTex(), side: THREE.DoubleSide })); fl.position.set(0, H + 8, 1.5); fl.rotation.y = Math.PI / 2; g.add(fl);
  // south lawn with the fountain, and the iron fence
  const lawn = new THREE.Mesh(new THREE.CircleGeometry(60, 48), MAT.grass); lawn.rotation.x = -Math.PI / 2; lawn.position.set(D / 2 + 50, 0.15, 0); lawn.scale.y = 1.3; lawn.receiveShadow = true; g.add(lawn);
  const fn = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 0.6, 32), MAT.marble); fn.position.set(D / 2 + 45, 0.3, 0); g.add(fn);
  const fj = new THREE.Mesh(new THREE.ConeGeometry(0.6, 7, 10, 1, true), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false })); fj.position.set(D / 2 + 45, 4, 0); g.add(fj); live.jets.push({ m: fj, ph: 0 });
  const fence = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 2.2, 0.08), MAT.iron, 300);
  for (let i = 0; i < 300; i++) { const z = -140 + i * 280 / 300; fence.setMatrixAt(i, _m.compose(_p.set(D / 2 + 112, 1.1, z), _q.identity(), _s.set(1, 1, 1))); }
  g.add(fence);
  place(k, g, WH_S, -230, 0, 0); // faces +x: south, toward the avenue
  flushCols(g);
}

// ---------- limestone federal blocks along the north side ----------
function stoneFacade(k) {
  // instanced boxes; the window grid tiles by the instance's scale (8 m x 4.5 m bays)
  const tex = k.canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#e9dfc9'; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(120,100,70,0.25)'; for (let y = 0; y < h; y += 32) c.fillRect(0, y, w, 2);
    c.fillStyle = '#2a2f36'; c.fillRect(w * 0.3, h * 0.22, w * 0.4, h * 0.56);
    c.fillStyle = '#d8ccb2'; c.fillRect(w * 0.26, h * 0.18, w * 0.48, h * 0.05); c.fillRect(w * 0.26, h * 0.78, w * 0.48, h * 0.06);
    c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(w * 0.32, h * 0.24, w * 0.1, h * 0.25);
  }, true);
  const mat = new THREE.MeshStandardMaterial({ map: tex, normalMap: k.photo('dc_stone_nor.jpg', { srgb: false }), roughness: 0.7 });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
      float lx = length(instanceMatrix[0].xyz), ly = length(instanceMatrix[1].xyz), lz = length(instanceMatrix[2].xyz);
      vec2 fsc = abs(normal.x) > 0.5 ? vec2(lz, ly) : abs(normal.z) > 0.5 ? vec2(lx, ly) : vec2(lx, lz);
      vec2 fuv = uv * fsc / vec2(8.0, 4.5); if (abs(normal.y) > 0.5) fuv *= 0.0; vMapUv = fuv; vNormalMapUv = fuv * 0.3;`);
  };
  return mat;
}
function buildFederal(k, rand) {
  const list = [];
  let s = 1220;
  while (s < 2900) {
    const w = 60 + rand() * 70, dp = 45 + rand() * 30, h = 20 + rand() * 10;
    list.push({ s: s + w / 2, d: -(ROAD_HALF + 14 + dp / 2), w, dp, h });
    s += w + 18;
  }
  // a few on the Mall side past the monument (museums), leaving the axis open
  for (const [s0, w] of [[1300, 90], [1720, 110], [2200, 80], [2420, 100]]) list.push({ s: s0, d: ROAD_HALF + 10 + 13, w, dp: 26, h: 20, museum: true });
  const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
  const im = new THREE.InstancedMesh(geo, stoneFacade(k), list.length);
  const roof = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: '#7d8a8c', roughness: 0.7, metalness: 0.2 }), list.length);
  list.forEach((b, i) => {
    k.world(b.s, b.d, 0, _p); _q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, k.frame(b.s).yaw);
    im.setMatrixAt(i, _m.compose(_p, _q, _s.set(b.dp, b.h, b.w)));
    _p.y += b.h; roof.setMatrixAt(i, _m.compose(_p, _q, _s.set(b.dp - 4, 3, b.w - 4)));
    // columned fronts facing the avenue
    const g = new THREE.Group(); const side = Math.sign(b.d);
    const n = Math.max(6, Math.round(b.w / 9));
    temple(g, { w: b.w * 0.9, dp: 2, h: b.h - 3, n, pd: 5, mat: 'lime', body: false, stepsN: 4 });
    place(k, g, b.s, b.d - side * (b.dp / 2), 0, side < 0 ? 0 : Math.PI);
    flushCols(g);
  });
  im.receiveShadow = true; im.castShadow = true;
  k.scene.add(im, roof);
}

// ---------- the Smithsonian Castle (red sandstone, towers) ----------
function buildSmithsonian(k) {
  const g = new THREE.Group();
  const M = MAT.sandstone;
  box(g, 22, 16, 100, 0, 8, 0, M);
  box(g, 22.6, 1, 100.6, 0, 16.5, 0, M);
  const roofG = new THREE.CylinderGeometry(0, 15, 6, 4, 1); roofG.rotateY(Math.PI / 4);
  const r = new THREE.Mesh(roofG, new THREE.MeshStandardMaterial({ color: '#4a4a50', roughness: 0.7 })); r.scale.set(0.8, 1, 3.4); r.position.y = 19; g.add(r);
  for (const [x, z, w, h] of [[0, -14, 9, 44], [0, 6, 7, 36], [8, 30, 6, 30], [-6, -40, 8, 28], [6, 46, 5, 26], [-8, 20, 6, 32]]) {
    box(g, w, h, w, x, h / 2, z, M);
    const sp = new THREE.Mesh(new THREE.ConeGeometry(w * 0.72, w * 1.2, 4), new THREE.MeshStandardMaterial({ color: '#4a4a50', roughness: 0.7 })); sp.rotation.y = Math.PI / 4; sp.position.set(x, h + w * 0.6, z); g.add(sp);
    for (const yy of [h * 0.4, h * 0.75]) { const w2 = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.3, w * 0.6), MAT.dark); w2.position.set(x - w / 2 - 0.02, yy, z); w2.rotation.y = -Math.PI / 2; g.add(w2); }
  }
  // the castle stands on the far (south) side of the Mall
  place(k, g, 1550, axisD(1550) + 95, 0, 0);
}

// ---------- the Capitol ----------
function buildCapitol(k) {
  const g = new THREE.Group();
  const M = MAT.white;
  // terraces
  box(g, 120, 4, 260, -10, 2, 0, MAT.marble);
  for (let i = 0; i < 8; i++) box(g, 1, 4 - i * 0.5, 70, 50 + 0.5 + i, (4 - i * 0.5) / 2, 0, MAT.marble);
  const base = 4;
  // centre block with the east-front style portico facing the player (local +x)
  const gc = new THREE.Group(); gc.position.set(0, base, 0); g.add(gc);
  temple(gc, { w: 76, dp: 40, h: 22, n: 10, pd: 9, mat: 'white' });
  // wings (House and Senate)
  for (const z of [-82, 82]) {
    const gw = new THREE.Group(); gw.position.set(-4, base, z); g.add(gw);
    temple(gw, { w: 64, dp: 34, h: 19, n: 8, pd: 7, mat: 'white' });
  }
  for (const z of [-46, 46]) box(g, 28, 19, 22, -6, base + 9.5, z, M);
  // dome: peristyle drum, attic, dome, lantern, statue
  const top = base + 2.2 + 22 * 0.92 + 22 * 0.13;
  const drumY = top + 2;
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(20, 21, 3, 48), M); drum.position.set(-6, top + 1.5, 0); g.add(drum);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(16, 16, 22, 48), M); core.position.set(-6, drumY + 11, 0); core.castShadow = true; g.add(core);
  for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2; column(g, 'white', -6 + Math.cos(a) * 19, drumY, Math.sin(a) * 19, 0.7, 17); }
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(20, 20, 2.4, 48), M); ring.position.set(-6, drumY + 18.2, 0); g.add(ring);
  const attic = new THREE.Mesh(new THREE.CylinderGeometry(16.5, 17.5, 7, 48), M); attic.position.set(-6, drumY + 22.8, 0); g.add(attic);
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, w = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 3.4), MAT.dark); w.position.set(-6 + Math.cos(a) * 16.05, drumY + 11, Math.sin(a) * 16.05); w.rotation.y = -a + Math.PI / 2; g.add(w); }
  const dome = new THREE.Mesh(new THREE.SphereGeometry(16.5, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ map: MAT.white.map, color: '#f8f6f0', roughness: 0.4, clearcoat: 0.3 }));
  dome.scale.y = 1.3; dome.position.set(-6, drumY + 26.3, 0); dome.castShadow = true; g.add(dome);
  // ribs
  for (let i = 0; i < 18; i++) { const rib = new THREE.Mesh(new THREE.TorusGeometry(16.6, 0.18, 4, 32, Math.PI / 2), M); rib.rotation.set(0, i / 18 * Math.PI * 2, 0); rib.rotateX(0); rib.scale.y = 1.3; rib.position.set(-6, drumY + 26.3, 0); g.add(rib); }
  const lan = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 7, 20), M); lan.position.set(-6, drumY + 26.3 + 21.4 + 3.5, 0); g.add(lan);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; column(g, 'white', -6 + Math.cos(a) * 3, drumY + 26.3 + 21.4, Math.sin(a) * 3, 0.22, 6.5); }
  const lanTop = new THREE.Mesh(new THREE.SphereGeometry(3.1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), M); lanTop.position.set(-6, drumY + 26.3 + 28.4, 0); g.add(lanTop);
  const statue = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.7, 5.5, 10), MAT.bronze); statue.position.set(-6, drumY + 26.3 + 33.8, 0); g.add(statue);
  // the Capitol Reflecting Pool in front
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(60, 140), new THREE.MeshPhysicalMaterial({ color: '#4d6670', roughness: 0.04, metalness: 0.3 })); pool.rotation.x = -Math.PI / 2; pool.rotation.z = Math.PI / 2; pool.position.set(130, 0.3, 0); g.add(pool);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  // faces down the Mall toward the player: local +x → backward along the track
  g.scale.setScalar(1.35);
  place(k, g, CAPITOL_S, 0, 0, -Math.PI / 2);   // dead ahead where the avenue ends
  for (const c of g.children.filter((o) => o.isGroup)) flushCols(c);
  flushCols(g);
}

// ---------- trees: American elms down the Mall, cherry blossoms around the Monument ----------
function buildTrees(k, rand) {
  const elm = [], cherry = [];
  for (let s = POOL[0] - 20; s < CAPITOL_S - 200; s += 16) {
    if (Math.abs(s - MONUMENT_S) < 150 || Math.abs(s - WWII_S) < 70) continue;
    const near = s < POOL[1] + 10 ? POOL_W / 2 + 14 : 30;
    for (const o of [-near, near, -(near + 12), near + 12]) elm.push([s + rand() * 4, axisD(s) + o + (rand() - 0.5) * 2, 0.9 + rand() * 0.25]);
  }
  for (let s = -80; s < FINISH_S + 120; s += 22) elm.push([s, -(ROAD_HALF + 8), 0.75 + rand() * 0.2]);
  for (let i = 0; i < 240; i++) {
    const a = rand() * Math.PI * 2, r = 85 + rand() * 120;
    const s = MONUMENT_S + Math.cos(a) * r, d = axisD(MONUMENT_S) + Math.sin(a) * r;
    if (d < ROAD_HALF + 8) continue;
    cherry.push([s, d, 0.8 + rand() * 0.5]);
  }
  for (let s = 1180; s < 1760; s += 13) for (const d of [ROAD_HALF + 8, ROAD_HALF + 15]) cherry.push([s + rand() * 5, d + rand() * 2, 0.8 + rand() * 0.4]);
  // elm: tall vase; cherry: low, wide and pink
  const mk = (spots, trunkH, crownR, crownY, sx, sy, color, emi, seed) => {
    const r2 = rnd(seed);
    const trunk = new THREE.CylinderGeometry(0.2, 0.38, trunkH, 7); trunk.translate(0, trunkH / 2, 0);
    // a crown is a cluster of lumpy blobs, not one ball
    const parts = [];
    for (let j = 0; j < 7; j++) {
      const r = crownR * (j ? 0.42 + r2() * 0.18 : 0.62), a = j * 2.4, rr = j ? crownR * 0.48 : 0;
      const b = new THREE.IcosahedronGeometry(r, 2), pos = b.attributes.position, v = new THREE.Vector3();
      const ox = Math.cos(a) * rr, oz = Math.sin(a) * rr, oy = (j ? (r2() - 0.3) * crownR * 0.5 : 0.1 * crownR);
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); const n = 0.85 + 0.25 * Math.sin(v.x * 4.1 + v.y * 3.3 + j) * Math.cos(v.z * 3.7 + v.y * 2); v.multiplyScalar(n); pos.setXYZ(i, (v.x + ox) * sx, (v.y + oy) * sy + crownY, (v.z + oz) * sx); }
      parts.push(b);
    }
    const crown = mergeGeometries(parts); crown.computeVertexNormals();
    const leaf = new THREE.MeshStandardMaterial({ color, roughness: 0.9, emissive: emi, flatShading: false });
    const ti = new THREE.InstancedMesh(trunk, new THREE.MeshStandardMaterial({ color: '#3e342c', roughness: 1 }), spots.length), ci = new THREE.InstancedMesh(crown, leaf, spots.length), col = new THREE.Color();
    spots.forEach(([s, d, k0], i) => {
      k.world(s, d, 0.1, _p); _q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, r2() * 6.28);
      _m.compose(_p, _q, _s.set(k0, k0 * (0.9 + r2() * 0.25), k0)); ti.setMatrixAt(i, _m); ci.setMatrixAt(i, _m);
      ci.setColorAt(i, col.set(color).offsetHSL((r2() - 0.5) * 0.03, 0, (r2() - 0.5) * 0.1));
    });
    ti.castShadow = ci.castShadow = true; ci.receiveShadow = true; k.scene.add(ti, ci);
  };
  mk(elm, 7, 5.2, 11, 1.25, 0.9, '#6f8f48', '#0a1204', 11);
  mk(cherry, 2.6, 3.6, 4.6, 1.35, 0.75, '#ffd6e4', '#4a2632', 12);
}

function buildLamps(k) {
  // Washington globe lamps along the avenue
  const pole = new THREE.CylinderGeometry(0.1, 0.16, 4.2, 8); pole.translate(0, 2.1, 0);
  const globe = new THREE.SphereGeometry(0.42, 16, 12);
  const spots = [];
  for (let s = -60; s < FINISH_S + 100; s += 30) if (!(s > 560 && s < 740)) for (const side of [-1, 1]) spots.push([s, side * (ROAD_HALF + 1.4)]);
  const pi = new THREE.InstancedMesh(pole, MAT.iron, spots.length), gi = new THREE.InstancedMesh(globe, new THREE.MeshStandardMaterial({ color: '#fffaf0', emissive: '#fff2d8', emissiveIntensity: 0.5, roughness: 0.2, transparent: true, opacity: 0.9 }), spots.length);
  spots.forEach(([s, d], i) => { k.world(s, d, 0, _p); pi.setMatrixAt(i, _m.compose(_p, _q.identity(), _s.set(1, 1, 1))); _p.y += 4.5; gi.setMatrixAt(i, _m.compose(_p, _q, _s)); });
  pi.castShadow = true; k.scene.add(pi, gi);
}

// every column from every building, as instanced fluted shafts with bases and capitals
function buildColumns(k) {
  const shaft = new THREE.CylinderGeometry(1, 1.06, 1, 20, 1); shaft.translate(0, 0.5, 0);
  // fake fluting: pinch the radius at 20 points around
  const pos = shaft.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); const a = Math.atan2(v.z, v.x), f = 1 - 0.04 * Math.abs(Math.sin(a * 10)); pos.setXYZ(i, v.x * f, v.y, v.z * f); }
  shaft.computeVertexNormals();
  const cap = new THREE.BoxGeometry(2.6, 0.06, 2.6); cap.translate(0, 0.99, 0);
  const base = new THREE.CylinderGeometry(1.3, 1.4, 0.05, 20); base.translate(0, 0.025, 0);
  for (const [key, list] of Object.entries(COLS)) {
    if (!list.length) continue;
    for (const geo of [shaft, cap, base]) {
      const im = new THREE.InstancedMesh(geo, MAT[key], list.length);
      list.forEach((m, i) => im.setMatrixAt(i, m));
      im.castShadow = geo === shaft; im.receiveShadow = true; k.scene.add(im);
    }
  }
}

function tick(time) {
  for (const j of live.jets) { j.m.scale.y = 0.85 + Math.sin(time * 6 + j.ph) * 0.12; j.m.material.opacity = 0.45 + Math.sin(time * 9 + j.ph) * 0.1; }
}
