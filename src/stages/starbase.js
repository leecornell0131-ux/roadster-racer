// Stage 6: Starbase, Texas at noon. Highway 4 from the production site (Mega Bays, the rocket garden of
// stainless prototypes) over the coastal dunes, past a prototype doing a hop and Raptor test stands that
// fire across the road, to the launch site: tank farm, the tower with its chopsticks, the full stack.
// No boss: the finish is the launch. The roadster is lifted into the ship and the stack lifts off.
import * as THREE from 'three';
import { bigTurns, rampRun, CITY_ROAD } from './city.js';
import { cityPolys } from '../osm.js';

const ROAD_HALF = 12;
const FINISH_S = 3050;
const TOWER_S = 3120, MOUNT_D = 52, TOWER_D = MOUNT_D + 21;
const HOP = { s: 1380, d: 170 };
const STACK_BASE = 21;                 // launch table height: the booster stands on it
const BOOSTER_H = 71, SHIP_H = 50, R = 4.5;

const KEYS = [[-500, 0], [1100, 0], [1160, 5], [1178, 5], [1228, 0], [1400, 0], [1468, 7], [1486, 7], [1550, 0], [1700, 0],
  [1758, 6], [1774, 6], [1830, 0], [2150, 0], [2205, 5], [2220, 5], [2270, 0], [4200, 0]];
const E0 = -500, EN = 4200;
const ETAB = (() => {
  const raw = new Float32Array(EN - E0 + 1);
  for (let i = 0; i < raw.length; i++) {
    const s = E0 + i; let k = 0; while (k < KEYS.length - 2 && KEYS[k + 1][0] < s) k++;
    const [sa, ya] = KEYS[k], [sb, yb] = KEYS[k + 1];
    raw[i] = ya + (yb - ya) * THREE.MathUtils.clamp((s - sa) / (sb - sa), 0, 1);
  }
  const out = new Float32Array(raw.length), RR = 4;
  for (let i = 0; i < raw.length; i++) { let a = 0, n = 0; for (let j = -RR; j <= RR; j++) { const v = raw[i + j]; if (v !== undefined) { a += v; n++; } } out[i] = a / n; }
  return out;
})();
function elev(s) {
  const x = THREE.MathUtils.clamp(s - E0, 0, EN - E0 - 1), i = Math.floor(x), f = x - i;
  return ETAB[i] * (1 - f) + ETAB[i + 1] * f;
}

// Raptor test stands that fire across the road on a cycle
const HAZARDS = [
  { s: 1620, l: 4.5, dL: -1, dR: ROAD_HALF, h: 3.2, side: 1, period: 3.6, on: 1.5, ph: 0, text: ['랩터 엔진 화염!', '시험 중인 차선 · 급감속', '#ff6a1a'] },
  { s: 1980, l: 4.5, dL: -ROAD_HALF, dR: 1, h: 3.2, side: -1, period: 3.6, on: 1.5, ph: 1.8, text: ['랩터 엔진 화염!', '시험 중인 차선 · 급감속', '#ff6a1a'] },
  { s: 2560, l: 4.5, dL: -1, dR: ROAD_HALF, h: 3.2, side: 1, period: 3.2, on: 1.4, ph: 0.6, text: ['랩터 엔진 화염!', '시험 중인 차선 · 급감속', '#ff6a1a'] },
];

// real-map events (Brownsville, South Padre Island): the stage's own Highway 4 scenery is off there
const STREET_TRAFFIC = {
  model3: { car: 'model3', name: '모델 3', speed: [26, 32], n: 4 },
  cybertruck: { car: 'cybertruck', name: '사이버트럭', speed: [24, 29], n: 5 },
  modely: { car: 'modely', name: '모델 Y', speed: [26, 31], n: 3 },
  raptor: { make: makeRaptorHauler, name: '랩터 엔진 운반차', speed: [12, 15], n: 2, lanes: [-3, 3], range: [200, 9000], color: '#f2f2f0' },
};
const ON_STREETS = { elev: null, gaps: [], hazards: [], legend: null, pickups: [], jams: [], trafficMaxS: 9000, finishDelay: 900, traffic: STREET_TRAFFIC };
const CITY_POSTER = { s: 300, d: -6, y: 0, cam: { back: 10, side: 3, y: 2.6, ahead: 8, lookSide: -3, lookY: 1.4, fov: 46 } };

export default {
  id: 'starbase', num: 6, name: '스타베이스',
  roadHalf: ROAD_HALF, lanes: [-9, -3, 3, 9], finish: FINISH_S,
  gaps: [],
  elev,
  cx(s) { return 34 * Math.sin((s - 300) / 420) * THREE.MathUtils.smoothstep(s, 300, 700) * (1 - THREE.MathUtils.smoothstep(s, 2450, 2800)); },
  ramps: [
    { s0: 520, len: 16, dL: -6, dR: 6, h: 3.0 },
    { s0: 960, len: 16, dL: -12, dR: -4, h: 3.2 },
    { s0: 1320, len: 16, dL: 4, dR: 12, h: 3.2 },
    { s0: 2380, len: 18, dL: 6, dR: 12, h: 4.6 },   // the high one: legend above its flight
    { s0: 2740, len: 16, dL: -6, dR: 6, h: 3.0 },
  ],
  hazards: HAZARDS,
  legend: { s: 2440, d: 9, y: 11 },
  pickups: [
    ...[1178, 1486, 1774, 2220].flatMap((s0) => range(4, 46, 7).map((x) => ['coin', s0 + x, 3, 1.2 + 0.2 * x - 14 * (x / 60) ** 2])),
    ...range(536, 570, 6).map((s, i) => ['coin', s, 0, 3.5 + i * 0.9]),
    ['h100', 900, -9, 1.6], ['h100', 1700, 9, 1.6], ['h100', 2860, 0, 1.6],
    ['air', 450, 3, 1.2], ['air', 1250, -3, 1.2], ['air', 2000, 9, 1.2], ['air', 2700, -9, 1.2],
    ['gpu', 300, -3, 1.4], ['gpu', 1050, 9, 1.4], ['gpu', 1900, -9, 1.4], ['gpu', 2600, -3, 1.4],
  ],
  trafficMaxS: FINISH_S + 200,
  road: { yellow: true, dashes: [0.25, 0.75] },
  env: {
    bg: true, sun: ['#fffaf0', 3.0], hemi: ['#cfe0ff', '#9a8a6a', 0.55],
    fog: ['#d8dde2', 380, 3200], hdri: 'assets/starbase_noon_rgbe_gray.png', exposure: 0.7, bgIntensity: 0.95, bloom: 0.3, hdrMax: 2500,
  },
  traffic: {
    model3: { car: 'model3', name: '모델 3', speed: [26, 32], n: 3 },
    cybertruck: { car: 'cybertruck', name: '사이버트럭', speed: [24, 29], n: 5 },
    modely: { car: 'modely', name: '모델 Y', speed: [26, 31], n: 2 },
    raptor: { make: makeRaptorHauler, name: '랩터 엔진 운반차', speed: [12, 15], n: 4, lanes: [-3, 3], range: [150, 2900], color: '#f2f2f0' },
  },
  radio: [
    [20, '스타베이스야. 텍사스 보카치카. 여기서 스타쉽에 합체한다!'],
    [260, '오른쪽 거대한 건물이 메가베이. 스타쉽을 통째로 조립하는 공장이야.'],
    [640, '왼쪽 로켓 가든! 시제품들이 줄지어 서 있어. 다 스테인리스야.'],
    [1060, '모래 언덕 구간. 꼭대기에서 날아오르면 점프 꾹!'],
    [1280, '오른쪽 봐, 시제품이 호핑 테스트 한다!'],
    [1540, '랩터 엔진 시험대! 경고등 깜빡이면 그쪽 차선은 피해!'],
    [2330, '발사장 보인다. 메카질라 젓가락이 우릴 기다려!'],
    [2880, 'T-30초! 타워 앞 결승선까지 밟아!'],
  ],
  lines: { finish: '젓가락이 우릴 집어 올린다! 스타쉽 합체… 발사!' },
  stars: { time: 62, text: '완주 · 62초 이내 · 퍼펙트 랜딩 4회', perfect: 4 },
  finishDelay: 9000,
  props: ['starship', 'falcon9'],
  poster: { s: 2925, d: -2, y: 5, boss: [0, 0, 0], cam: { back: 15, side: -7, y: 1.5, ahead: 190, lookSide: 22, lookY: 55, fov: 56 } },
  text: {
    eyebrow: 'STAGE 06 · STARBASE', title: 'STARBASE', sub: '스타쉽에 합체하라',
    tip: '<b>TIP</b> 랩터 엔진 시험대의 <b>경고등</b>이 깜빡이면 불꽃이 차선을 덮쳐요. 모래 언덕 꼭대기에선 차가 날아오르니 점프로 부드럽게 착지하세요. 결승선을 넘으면 <b>발사</b>!',
    tweet: '지구에서 할 일 다 했음. 이제 스타쉽에 로드스터 싣고 우주로 간다. 젓가락이 차를 집어주는 시대.',
    meta: '오후 12:00 · 스타베이스, 텍사스 · 리트윗 300만', load: '메카질라 젓가락 보정 중 · 랩터 엔진 예열 중',
    hud: 'STAGE 6 · STARBASE', clear: 'STAGE 06 CLEAR', clearTitle: '발사 성공',
  },
  eggs: [
    { id: 'sb_texas', ev: 'parts', place: 'Welcome to Texas Sign', y: 1.4, name: '웰컴 투 텍사스 표지판 조각', line: '국경 다리 앞 텍사스 환영 표지판 조각. 화성에도 하나 세우자.' },
    { id: 'sb_ferry', ev: 'border', place: 'Brownsville-Matamoros Ferries and River Boardwalk', y: 1.4, name: '옛 국경 나룻배 표', line: '100년 전 국경 나룻배 표야. 요금 5센트. 스타쉽 표는 좀 더 비싸.' },
    { id: 'sb_tesla', ev: 'causeway', place: 'Tesla Supercharger', y: 1.4, name: '사우스파드레 슈퍼차저 케이블', line: '섬 끝 슈퍼차저 케이블이야. 로켓은 이걸로 충전 안 돼.' },
  ],
  // chapter 6: errands in real Brownsville and a race over the real Queen Isabella Causeway, then Highway 4 to the launch
  events: [
    {
      id: 'parts', name: '브라운스빌 부품 배송', city: 'brownsville', ...CITY_ROAD, ...ON_STREETS,
      brief: '<b>배송</b> 진짜 브라운스빌 다운타운 지도예요. 스타베이스로 가는 부품을 받으러 포트 브라운에서 출발해 스틸먼 하우스, 퍼블릭 마켓, 시청, 옛 철도역을 거쳐 어린이 박물관까지. 초록 정차 구역에서 <b>↓ 브레이크</b>.',
      route: { from: 'Fort Brown', via: ['Stillman House Museum', 'Public Market and Town Hall', 'Brownsville City Hall', 'Southern Pacific Railroad Passenger Depot'], to: 'Children’s Museum of Brownsville' },
      forks: (L, R) => bigTurns(R, 1).map((t) => ({ at: t.s, name: '정상 경로' })),
      ramps: (L) => rampRun(380, L - 200, 300, 2),
      mission: { type: 'deliver', time: 110, allowMiss: 1, stops: [
        { place: 'Stillman House Museum', name: '스틸먼 하우스', thanks: '브라운스빌을 세운 집이에요. 볼트 받아 가세요', line: '스틸먼 씨가 이 도시를 세웠대. 지금은 일론이 옆 동네를 통째로 세우는 중이고.' },
        { place: 'Public Market and Town Hall', name: '퍼블릭 마켓', thanks: '타코 서른 개 스타베이스로 배달이요' },
        { place: 'Brownsville City Hall', name: '브라운스빌 시청', thanks: '스타베이스 시 승인 서류예요. 도장 세 개 찍었어요', line: '시청 직원 내렸다. 옆 동네가 아예 시가 됐대. 시장 이름은 비밀.' },
        { place: 'Southern Pacific Railroad Passenger Depot', name: '옛 철도역', thanks: '기차는 끊겼지만 로켓은 떠요' },
      ] },
      radio: [[20, '브라운스빌이야. 진짜 지도. 스타베이스 가기 전에 부품이랑 타코 챙겨야 해.'], [1400, '여기 국경 바로 앞이야. 강 건너가 멕시코 마타모로스.']],
      lines: { finish: '부품 다 챙겼어. 타코도. 이제 섬으로 가자.', failed: '부품을 다 못 받았어… 스타베이스 일정이 또 밀린대. 다시 가자.' },
      poster: CITY_POSTER, finishText: 'FINISH · 어린이 박물관',
      text: { clear: 'DELIVERY DONE', clearTitle: '부품 배송 완료' },
    },
    {
      id: 'border', name: '국경 도로 스턴트', city: 'brownsville', ...CITY_ROAD, ...ON_STREETS,
      brief: '<b>스턴트</b> 샘스 메모리얼 스타디움에서 출발해 국경 강변 도로를 따라 UTRGV 캠퍼스까지. 정체 구간은 점프대로 차 지붕 위로, 아슬 추월과 배럴롤로 <b>콤보 배수</b>를 키워요.',
      route: { from: 'Sams Memorial Stadium', to: 'The University of Texas Rio Grande Valley' },
      ramps: (L) => { const j = [Math.round(L * 0.35) - 40, Math.round(L * 0.7) - 40];
        return [...rampRun(260, L - 150, 170, 4).filter((r) => j.every((s) => Math.abs(r.s0 - s) > 110)), ...j.map((s0) => ({ s0, len: 18, dL: -12, dR: 12, h: 3.4 }))]; },
      jams: (L) => [[Math.round(L * 0.35), Math.round(L * 0.35) + 150], [Math.round(L * 0.7), Math.round(L * 0.7) + 150]],
      jamMix: { cybertruck: 3, model3: 2, raptor: 2 },
      mission: { type: 'stunt', scores: [14000, 28000, 45000] },
      radio: [[20, '국경 도로 스턴트 쇼야. 관객은 강 양쪽 두 나라.'], [800, '앞에 정체! 점프대 타고 지붕 위로!']],
      lines: { finish: '대학생들이 우리 묘기 보고 전공을 항공우주로 바꾼대.', failed: '박수가 좀 약했어. 지붕 위에서 콤보를 이어 봐.' },
      poster: CITY_POSTER, finishText: 'FINISH · UTRGV 캠퍼스',
      text: { clear: 'SHOW TIME', clearTitle: '스턴트 쇼 성공' },
    },
    {
      id: 'causeway', name: '퀸 이사벨라 코즈웨이', city: 'padre', ...CITY_ROAD, ...ON_STREETS,
      brief: '<b>레이스</b> 진짜 사우스파드레 지도. 포트 이사벨 등대에서 4km짜리 퀸 이사벨라 코즈웨이를 건너 섬 끝 테슬라 슈퍼차저까지. 상대는 스타베이스 출근길 사이버트럭 셋.',
      route: { from: 'Port Isabel Lighthouse', to: 'Tesla Supercharger' },
      sea: [-1380, -3400, 2240, 3400],   // the Laguna Madre between Port Isabel and the island (world metres)
      ramps: (L) => rampRun(300, L - 150, 260, 3),
      mission: { type: 'rivals', time: 82, perfect: 2, rivals: [
        { type: 'cybertruck', name: '출근길 사이버트럭 #1', label: 'COMMUTER 1', speed: 56, d: -3, s: 24 },
        { type: 'cybertruck', name: '출근길 사이버트럭 #2', label: 'COMMUTER 2', speed: 58, d: 9, s: 30 },
        { type: 'cybertruck', name: '지각한 엔지니어', label: 'LATE ENGINEER', speed: 59.5, d: -9, s: 36, tagColor: '#ffc83d' },
      ] },
      radio: [[20, '포트 이사벨 등대야. 저 긴 다리가 퀸 이사벨라 코즈웨이. 텍사스에서 제일 긴 다리래.'], [2200, '다리 한가운데야. 바다 바람 세니까 착지 조심.'], [4200, '섬에 들어왔어. 슈퍼차저까지 밟아!']],
      lines: { finish: '우승! 지각한 엔지니어는 오늘도 지각. 이제 하이웨이 4로 발사장 가자.', failed: '출근길 사이버트럭한테 졌어… 퍼펙트 착지 부스트로 붙어.' },
      poster: CITY_POSTER, finishText: 'FINISH · 테슬라 슈퍼차저',
      text: { clear: 'WINNER', clearTitle: '코즈웨이 우승' },
    },
    {
      id: 'launch', name: '하이웨이 4 발사',
      brief: '<b>주행</b> 하이웨이 4를 따라 메가베이와 로켓 가든, 모래 언덕, 랩터 시험대를 지나 발사장까지. 결승선을 넘으면 젓가락이 차를 집어 <b>스타쉽에 합체, 발사</b>!',
    },
  ],
  build,
  tick,
  finishCam,
};

function range(a, b, step) { const out = []; for (let s = a; s <= b; s += step) out.push(s); return out; }
function rnd(seed) { let x = seed >>> 0; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; }; }
function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function noise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const glow = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), toneMapped: false });
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const live = { k: null, hop: null, hopT: -1, stack: null, flames: [], hz: [], cut: null, smoke: [], water: null };

// ---------- materials ----------
let MAT = null;
function steelTex() {
  // stainless rings: welded bands every ~1.8 m, slight tone shifts between them
  const c = document.createElement('canvas'); c.width = 64; c.height = 512; const x = c.getContext('2d');
  for (let i = 0; i < 16; i++) { const v = 196 + ((i * 37) % 23) - 11; x.fillStyle = `rgb(${v},${v + 2},${v + 5})`; x.fillRect(0, i * 32, 64, 32); x.fillStyle = 'rgba(70,70,75,0.55)'; x.fillRect(0, i * 32, 64, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function tileTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#141416'; x.fillRect(0, 0, 256, 256);
  for (let r = 0; r < 12; r++) for (let q = 0; q < 10; q++) {
    const cx = q * 26 + (r % 2 ? 13 : 0), cy = r * 22; x.beginPath();
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + Math.PI / 6; x.lineTo(cx + Math.cos(a) * 12.5, cy + Math.sin(a) * 12.5); }
    x.closePath(); const v = 18 + ((r * 7 + q * 13) % 9); x.fillStyle = Math.random() < 0.04 ? '#e8e8e8' : `rgb(${v},${v},${v + 2})`; x.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function mats(k) {
  const steelMap = steelTex();
  return {
    steel: new THREE.MeshPhysicalMaterial({ map: steelMap, color: '#ffffff', metalness: 1, roughness: 0.26, clearcoat: 0.2, envMapIntensity: 1.15 }),
    steelDark: new THREE.MeshStandardMaterial({ color: '#7a7e84', metalness: 0.9, roughness: 0.4 }),
    tiles: new THREE.MeshStandardMaterial({ map: tileTex(), roughness: 0.75, metalness: 0.1 }),
    frost: new THREE.MeshStandardMaterial({ color: '#f2f4f6', roughness: 0.8 }),
    sand: new THREE.MeshStandardMaterial({ map: k.photo('sb_sand_diff.jpg', { rep: [1 / 14, 1 / 14] }), normalMap: k.photo('sb_sand_nor.jpg', { srgb: false, rep: [1 / 14, 1 / 14] }), color: '#e8dcc0', roughness: 1 }),
    flats: new THREE.MeshStandardMaterial({ map: k.photo('la_sand_diff.jpg', { rep: [1 / 30, 1 / 30] }), color: '#cfc2a8', roughness: 1 }),
    concrete: new THREE.MeshStandardMaterial({ map: k.photo('concrete_diff.jpg', { rep: [0.08, 0.08] }), color: '#c8c6c2', roughness: 0.9 }),
    white: new THREE.MeshStandardMaterial({ color: '#eef0f2', roughness: 0.5, metalness: 0.2 }),
    truss: new THREE.MeshStandardMaterial({ color: '#4e5258', metalness: 0.8, roughness: 0.45 }),
    dark: new THREE.MeshStandardMaterial({ color: '#16171a', roughness: 0.6 }),
    bell: new THREE.MeshStandardMaterial({ color: '#3a3532', metalness: 0.9, roughness: 0.35, side: THREE.DoubleSide }),
  };
}

// ---------- vehicles: Starship, Super Heavy ----------
function lathe(profile, seg = 48) { return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg); }
function engines(g, y, rings, bellR = 0.65) {
  const bell = lathe([[0.25, 0], [0.32, -0.3], [0.5, -0.9], [bellR, -1.6]], 20);
  for (const [n, rr] of rings) for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, b = new THREE.Mesh(bell, MAT.bell); b.position.set(Math.cos(a) * rr, y, Math.sin(a) * rr); g.add(b); }
}
function makeShip({ tiles = true, flapsOpen = 0 } = {}) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 37, 64, 1, true), MAT.steel); body.position.y = 18.5; g.add(body);
  body.material.map.repeat.set(1, 1);
  const nose = new THREE.Mesh(lathe([[R, 0], [R * 0.98, 2.5], [R * 0.9, 5], [R * 0.72, 8], [R * 0.45, 10.8], [R * 0.18, 12.6], [0.05, 13]], 64), MAT.steel); nose.position.y = 37; g.add(nose);
  if (tiles) {
    // black hexagonal heat shield over the windward half
    const ts = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.03, R + 0.03, 37, 48, 1, true, -Math.PI / 2, Math.PI), MAT.tiles); ts.position.y = 18.5; ts.material.map.repeat.set(6, 14); g.add(ts);
    const tn = new THREE.Mesh(lathe([[R + 0.03, 0], [R * 0.98 + 0.03, 2.5], [R * 0.9 + 0.03, 5], [R * 0.72 + 0.03, 8], [R * 0.45 + 0.03, 10.8]], 48), MAT.tiles); tn.geometry = new THREE.LatheGeometry([[R + 0.03, 0], [R * 0.98 + 0.03, 2.5], [R * 0.9 + 0.03, 5], [R * 0.72 + 0.03, 8], [R * 0.45 + 0.03, 10.8]].map(([r, y]) => new THREE.Vector2(r, y)), 24, -Math.PI / 2, Math.PI); tn.position.y = 37; g.add(tn);
  }
  // flaps: two forward on the nose, two big aft
  const flap = (w, h, y, side, ang) => { const f = new THREE.Mesh(new THREE.BoxGeometry(0.25, h, w), MAT.tiles); f.geometry.translate(0, 0, w / 2); const p = new THREE.Group(); p.position.set(0, y, side * (R - 0.3)); p.rotation.y = side > 0 ? 0 : Math.PI; f.rotation.x = -ang; p.add(f); g.add(p); return f; };
  for (const sd of [-1, 1]) { flap(2.4, 5, 40, sd, 0.15 + flapsOpen); flap(3.6, 9, 4.5, sd, 0.1 + flapsOpen); }
  engines(g, 0, [[3, 1.2], [3, 3.1]], 0.8);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
function makeBooster() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, BOOSTER_H, 64, 1, true), MAT.steel); body.position.y = BOOSTER_H / 2; g.add(body);
  // frost line over the propellant tanks after loading
  const fr = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.02, R + 0.02, 44, 64, 1, true), new THREE.MeshStandardMaterial({ color: '#eef2f6', roughness: 0.85, transparent: true, opacity: 0.55 })); fr.position.y = 26; g.add(fr);
  // hot-staging ring: vented band at the top
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.05, R + 0.05, 2.4, 64, 1, true), MAT.dark); ring.position.y = BOOSTER_H + 1.2; g.add(ring);
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, b = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.4, 0.9), MAT.steel); b.position.set(Math.cos(a) * (R + 0.08), BOOSTER_H + 1.2, Math.sin(a) * (R + 0.08)); b.rotation.y = -a; g.add(b); }
  // grid fins
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2 + Math.PI / 4, f = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.2, 4.2), MAT.steelDark); frame.position.x = 1.9; f.add(frame);
    f.position.set(Math.cos(a) * R, BOOSTER_H - 4, Math.sin(a) * R); f.rotation.y = -a; g.add(f);
  }
  // chines down the sides
  for (const a of [0.3, Math.PI + 0.3]) { const ch = new THREE.Mesh(new THREE.BoxGeometry(0.6, BOOSTER_H * 0.8, 0.5), MAT.steelDark); ch.position.set(Math.cos(a) * (R + 0.2), BOOSTER_H * 0.45, Math.sin(a) * (R + 0.2)); ch.rotation.y = -a; g.add(ch); }
  engines(g, 0, [[3, 0.9], [10, 2.5], [20, 3.9]], 0.62);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
// a flatbed carrying three Raptor engines lying down (procedural traffic)
function makeRaptorHauler() {
  const g = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color: '#f2f2f0', roughness: 0.35, clearcoat: 0.8 }); paint.name = 'paint';
  const dark = new THREE.MeshStandardMaterial({ color: '#202226', roughness: 0.6 });
  const chrome = new THREE.MeshStandardMaterial({ color: '#c8ccd2', metalness: 1, roughness: 0.25 });
  const copper = new THREE.MeshStandardMaterial({ color: '#8a5a3a', metalness: 1, roughness: 0.35 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#10161c', roughness: 0.05, metalness: 0.2, clearcoat: 1 });
  const tail = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 0.15, 0.2), toneMapped: false }); tail.name = 'tail';
  const L = 13, W = 2.6;
  const box = (w, h, d, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; g.add(b); return b; };
  box(W, 2.4, 2.6, 0, 1.9, -L / 2 + 1.3, paint);                       // cab
  box(W - 0.2, 0.9, 0.05, 0, 2.5, -L / 2 - 0.01, glass);
  box(W, 0.35, L - 3, 0, 1.2, 1.4, dark);                              // bed
  for (const sx of [-1, 1]) { const tl = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.05), tail); tl.position.set(sx * (W / 2 - 0.25), 1.2, L / 2 + 0.02); g.add(tl); }
  // three Raptors: bell + powerhead + plumbing, on cradles
  const bell = lathe([[0.35, 0], [0.45, 0.4], [0.75, 1.4], [0.95, 2.4]], 28);
  for (const z of [-2.2, 1.4, 5]) {
    const e = new THREE.Group(); e.position.set(0, 2.15, z); e.rotation.x = Math.PI / 2; g.add(e);
    const b = new THREE.Mesh(bell, copper); b.material.side = THREE.DoubleSide; b.position.y = 0; e.add(b);
    const ph = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.38, 1.1, 20), chrome); ph.position.y = -0.55; e.add(ph);
    for (const [x, zz] of [[0.42, 0.2], [-0.4, -0.25]]) { const tp = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.9, 14), chrome); tp.position.set(x, -0.6, zz); e.add(tp); }
    const pipe = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 6, 20, Math.PI * 1.3), chrome); pipe.position.y = -0.2; e.add(pipe);
    box(1.6, 0.5, 0.4, 0, 1.55, z + 0.6, dark);
  }
  for (const z of [-L / 2 + 1.4, 2.6, 4.6]) for (const x of [-1.05, 1.05]) {
    const hub = new THREE.Group(); hub.name = 'wheel'; hub.userData.r = 0.5; hub.position.set(x, 0.5, z);
    const sp = new THREE.Group(); const w = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 18), dark); w.rotation.z = Math.PI / 2; sp.add(w); hub.add(sp); g.add(hub);
  }
  g.userData = { kind: 'raptor', cfg: { colors: ['#f2f2f0'] }, size: new THREE.Vector3(W, 3.2, L) };
  return g;
}

// ---------- build ----------
function groundY(s, d) {
  const a = Math.abs(d);
  const quiet = s < 950 || s > 2420 ? 0.15 : 1;      // the sites are graded flat
  const dune = THREE.MathUtils.smoothstep(a, 18, 42) * (1 - THREE.MathUtils.smoothstep(a, 120, 220)) * (1.2 + 5.5 * noise(s / 70, d / 40)) * quiet;
  const lagoon = d < 0 && s > 900 && s < 2500 ? -2.2 * THREE.MathUtils.smoothstep(-d, 90, 160) : 0;
  const shore = s > 1800 ? THREE.MathUtils.lerp(700, 190, THREE.MathUtils.smoothstep(s, 1800, 2400)) : 1e5;
  const beach = d > 0 ? -3 * THREE.MathUtils.smoothstep(d, shore - 30, shore + 40) : 0;
  return 0.08 + dune + lagoon + beach;
}
// the Starship / Super Heavy models, for the later stages that fly with them
export function shipKit(k) { MAT ??= mats(k); return { makeShip, makeBooster, R, BOOSTER_H, SHIP_H, MAT }; }

function build(k) {
  if (k.CITY) { k.buildCity(); if (k.ST.sea) buildSea(k, k.ST.sea); k.finishArch(k.ST.finishText || 'FINISH'); return; }
  live.k = k; MAT = mats(k);
  const rand = rnd(6);
  const { scene } = k;
  // shoulders, then sand and dunes; the sea and lagoon are one water plane under it all
  for (const side of [-1, 1]) {
    const [a, b] = side < 0 ? [-(ROAD_HALF + 3), -ROAD_HALF] : [ROAD_HALF, ROAD_HALF + 3];
    const sh = new THREE.Mesh(k.ribbon(-300, FINISH_S + 300, a, b, 4, () => 0.05, 4), MAT.flats); sh.receiveShadow = true; scene.add(sh);
    const [l, r] = side < 0 ? [-1200, -(ROAD_HALF + 2.9)] : [ROAD_HALF + 2.9, 1200];
    const g = new THREE.Mesh(k.grid(-500, 3700, l, r, 10, side < 0 ? 12 : 12, groundY, 1), MAT.sand); g.receiveShadow = true; scene.add(g);
  }
  buildWater(k);
  buildMegaBays(k);
  buildTents(k, rand);
  buildRocketGarden(k);
  buildHop(k);
  buildTestStands(k);
  buildTankFarm(k);
  buildLaunchSite(k);
  buildScrub(k, rand);
  buildPoles(k);
  k.finishArch('FINISH · 오비탈 발사대');
}

// the lagoon under the causeway: OSM draws the sea as coastline lines, not polygons, so the city ground
// would be dry there. Lay a water rectangle (world x0, z0, x1, z1) between the two shores.
function buildSea(k, [x0, z0, x1, z1]) {
  k.scene.add(new THREE.Mesh(cityPolys([[-1, [x0, z0, x1, z0, x1, z1, x0, z1]]], -0.07), k.M.water));
}
function buildWater(k) {
  const N = 256;
  const nor = k.canvasTex(N, N, (c) => {
    const img = c.createImageData(N, N), hgt = new Float32Array(N * N);
    const waves = Array.from({ length: 9 }, () => ({ kx: ((Math.random() * 9) | 0) + 1, ky: ((Math.random() * 9) | 0) - 4, ph: Math.random() * 6, a: 0.4 + Math.random() }));
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let h = 0; for (const w of waves) h += w.a * Math.sin(((x * w.kx + y * w.ky) / N) * Math.PI * 2 + w.ph); hgt[y * N + x] = h; }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = hgt[y * N + (x + 1) % N] - hgt[y * N + (x + N - 1) % N], dy = hgt[((y + 1) % N) * N + x] - hgt[((y + N - 1) % N) * N + x];
      const nx = -dx * 0.6, ny = -dy * 0.6, l = Math.hypot(nx, ny, 1), o = (y * N + x) * 4;
      img.data[o] = (nx / l * 0.5 + 0.5) * 255; img.data[o + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[o + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[o + 3] = 255;
    }
    c.putImageData(img, 0, 0);
  }, true);
  nor.colorSpace = THREE.NoColorSpace; nor.repeat.set(160, 160);
  const mat = new THREE.MeshPhysicalMaterial({ color: '#2e6470', metalness: 0.1, roughness: 0.12, normalMap: nor, normalScale: new THREE.Vector2(0.45, 0.45), envMapIntensity: 1.2, clearcoat: 0.6, clearcoatRoughness: 0.2 });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), mat); sea.rotation.x = -Math.PI / 2; sea.position.set(0, -0.9, -1600); k.scene.add(sea);
  live.water = nor;
}

function megaTex(k) {
  return k.canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#dfe2e4'; c.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 8) { c.fillStyle = x % 16 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.25)'; c.fillRect(x, 0, 3, h); }
    c.fillStyle = 'rgba(0,0,0,0.12)'; for (let y = 0; y < h; y += 64) c.fillRect(0, y, w, 2);
  }, true);
}
function placeBox(k, s, d, w, dp, h, mat, y = 0) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(dp, h, w), mat); k.world(s, d, y + h / 2, b.position); b.rotation.y = k.frame(s).yaw; b.castShadow = b.receiveShadow = true; k.scene.add(b); return b;
}
function buildMegaBays(k) {
  const tex = megaTex(k);
  const mk = (w, h) => { const t = tex.clone(); t.needsUpdate = true; t.repeat.set(w / 30, h / 30); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.55, metalness: 0.4 }); };
  for (const [s, w, dp, h] of [[240, 70, 110, 88], [400, 60, 100, 80]]) {
    const d = ROAD_HALF + 60 + dp / 2;
    placeBox(k, s, d, w, dp, h, mk(w, h));
    // the tall door slot facing the road, and the roof frame
    const door = new THREE.Mesh(new THREE.PlaneGeometry(20, h - 8), new THREE.MeshStandardMaterial({ color: '#3a3f46', roughness: 0.6, metalness: 0.5 }));
    k.world(s, d - dp / 2 - 0.05, (h - 8) / 2, door.position); door.lookAt(k.world(s, 0, (h - 8) / 2)); k.scene.add(door);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(36, 5.5), new THREE.MeshBasicMaterial({ map: k.textTex('STARBASE', '#1b1d22', { w: 1024, h: 160, size: 120, glow: 0 }), transparent: true }));
    k.world(s, d - dp / 2 - 0.1, h - 6, sign.position); sign.lookAt(k.world(s, 0, h - 6)); k.scene.add(sign);
  }
  // high bays: tall and narrow, with cranes on top
  for (const s of [560, 615]) { placeBox(k, s, ROAD_HALF + 48, 26, 30, 82, mk(26, 82)); placeBox(k, s, ROAD_HALF + 48, 4, 4, 14, MAT.truss, 82); }
  // offices, parking
  for (const [s, w] of [[90, 60], [160, 40]]) placeBox(k, s, -(ROAD_HALF + 30), w, 24, 9, MAT.white);
}
function buildTents(k, rand) {
  const geo = new THREE.CylinderGeometry(1, 1, 1, 32, 1, false, 0, Math.PI); geo.rotateZ(Math.PI / 2); geo.rotateY(Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ color: '#f4f4f0', roughness: 0.7, side: THREE.DoubleSide });
  const list = [[180, -80, 60, 16], [270, -85, 50, 18], [360, -78, 70, 15], [480, -90, 40, 20]];
  const im = new THREE.InstancedMesh(geo, mat, list.length);
  list.forEach(([s, d, len, r], i) => { k.world(s, d, 0, _p); _q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, k.frame(s).yaw); im.setMatrixAt(i, _m.compose(_p, _q, _s.set(r, r, len))); });
  im.castShadow = true; im.receiveShadow = true; k.scene.add(im);
}
function buildRocketGarden(k) {
  // a flown Falcon 9 booster on display at the garden's entrance
  const f9 = k.prop('falcon9', 70);
  if (f9) { k.world(660, -40, 0.3, f9.position); f9.rotation.y = 0.6; k.scene.add(f9); const st = new THREE.Mesh(new THREE.CylinderGeometry(6, 7, 0.6, 32), MAT.concrete); k.world(660, -40, 0.3, st.position); k.scene.add(st); }
  // stainless prototypes standing in a row (some ships, two boosters), the garden by the highway
  const spots = [[700, -46, 'ship'], [732, -58, 'ship'], [765, -48, 'booster'], [800, -62, 'ship'], [836, -50, 'ship'], [880, -66, 'booster']];
  for (const [s, d, kind] of spots) {
    const r = kind === 'ship' ? (k.prop('starship') || makeShip({ tiles: Math.random() < 0.6 })) : makeBooster();
    k.world(s, d, 0.3, r.position); r.rotation.y = Math.random() * 6.28; k.scene.add(r);
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(R + 1.2, R + 1.6, 0.6, 32), MAT.concrete); k.world(s, d, 0.3, stand.position); k.scene.add(stand);
  }
}
// a prototype doing a hop: ascent, belly flop, flip and land, played as you drive past
function buildHop(k) {
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(16, 18, 1, 48), MAT.concrete); k.world(HOP.s, HOP.d, 0.5, pad.position); k.scene.add(pad);
  const ship = makeShip({ tiles: true });
  const g = new THREE.Group(); g.add(ship); ship.position.y = -18; // pivot at the middle for the flips
  k.world(HOP.s, HOP.d, 18.5, g.position); k.scene.add(g);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(2.6, 22, 24, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.6, 0.7), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  flame.rotation.x = Math.PI; flame.position.y = -18 - 12; flame.visible = false; g.add(flame);
  live.hop = { g, base: g.position.clone(), flame };
}
function buildTestStands(k) {
  // a Raptor on a stand beside the road, nozzle pointing across it; a beacon blinks before it fires
  const bell = lathe([[0.5, 0], [0.7, 0.6], [1.1, 2], [1.4, 3.2]], 28);
  for (const hz of HAZARDS) {
    const sd = hz.side, g = new THREE.Group();
    box3(g, 6, 7, 6, 0, 3.5, 0, MAT.truss);
    const e = new THREE.Mesh(bell, MAT.bell); e.rotation.z = sd * Math.PI / 2; e.position.set(-sd * 3.5, 4.5, 0); g.add(e);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), glow(4, 0.3, 0.1)); beacon.position.set(0, 7.6, 0); g.add(beacon);
    // the flame: a long additive cone lying across the lanes
    const fl = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 2.6, ROAD_HALF * 2 + 8, 20, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.4, 1.7, 0.6), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    fl.rotation.z = Math.PI / 2; fl.position.set(-sd * (3.5 + ROAD_HALF + 4), 1.6, 0); fl.visible = false; g.add(fl);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.2, ROAD_HALF * 2 + 6, 14, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 2.2, 4), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); core.rotation.z = Math.PI / 2; core.position.copy(fl.position); core.visible = false; g.add(core);
    // warning stripe on the road
    const strip = new THREE.Mesh(k.ribbon(hz.s - hz.l, hz.s + hz.l, hz.dL, hz.dR, hz.l, () => 0.03), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.4, 0.1), transparent: true, opacity: 0, depthWrite: false, toneMapped: false })); k.scene.add(strip);
    k.world(hz.s, sd * (ROAD_HALF + 7), 0, g.position); g.rotation.y = k.frame(hz.s).yaw; k.scene.add(g);
    live.hz.push({ hz, beacon, fl, core, strip });
  }
}
function box3(g, w, h, d, x, y, z, m) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; g.add(b); return b; }
function buildTankFarm(k) {
  const vt = new THREE.CylinderGeometry(3.6, 3.6, 24, 32); vt.translate(0, 12, 0);
  const cap = new THREE.SphereGeometry(3.6, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2); cap.translate(0, 24, 0);
  const spots = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) spots.push([2560 + i * 11, -(ROAD_HALF + 40 + j * 11)]);
  for (let i = 0; i < 3; i++) spots.push([TOWER_S + 60 + i * 11, MOUNT_D + 40]);
  const a = new THREE.InstancedMesh(vt, MAT.white, spots.length), b = new THREE.InstancedMesh(cap, MAT.white, spots.length);
  spots.forEach(([s, d], i) => { k.world(s, d, 0, _p); _m.compose(_p, _q.identity(), _s.set(1, 1, 1)); a.setMatrixAt(i, _m); b.setMatrixAt(i, _m); });
  a.castShadow = true; k.scene.add(a, b);
  // horizontal tanks
  const ht = new THREE.CapsuleGeometry(2.2, 18, 8, 24); ht.rotateZ(Math.PI / 2);
  const h = new THREE.InstancedMesh(ht, MAT.white, 6);
  for (let i = 0; i < 6; i++) { k.world(2470 + i * 7, -(ROAD_HALF + 32), 2.6, _p); _q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, k.frame(2470).yaw); h.setMatrixAt(i, _m.compose(_p, _q, _s.set(1, 1, 1))); }
  h.castShadow = true; k.scene.add(h);
}

// ---------- the launch site: mount, tower with chopsticks, full stack ----------
function buildLaunchSite(k) {
  const site = new THREE.Group();
  k.world(TOWER_S, MOUNT_D, 0, site.position); site.rotation.y = k.frame(TOWER_S).yaw; k.scene.add(site);
  // concrete pad
  box3(site, 90, 1, 90, 6, 0.5, 0, MAT.concrete);
  // orbital launch mount: six legs, the table, the ring
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, l = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2, STACK_BASE - 3, 12), MAT.concrete); l.position.set(Math.cos(a) * 9, (STACK_BASE - 3) / 2 + 1, Math.sin(a) * 9); site.add(l); }
  box3(site, 26, 4, 26, 0, STACK_BASE - 2, 0, MAT.steelDark);
  const ringM = new THREE.Mesh(new THREE.TorusGeometry(R + 0.6, 0.9, 12, 48), MAT.steelDark); ringM.rotation.x = Math.PI / 2; ringM.position.y = STACK_BASE; site.add(ringM);
  // the tower: a square lattice 150 m tall beside the mount
  const TH = 150, TW = 11, tx = TOWER_D - MOUNT_D;
  const bars = [];
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) bars.push([tx + x * TW / 2, TH / 2, z * TW / 2, 1.1, TH, 1.1, 0]);
  for (let y = 4; y < TH; y += 9) { for (const z of [-TW / 2, TW / 2]) bars.push([tx, y, z, TW, 0.6, 0.6, 0]); for (const x of [-TW / 2, TW / 2]) bars.push([tx + x, y, 0, 0.6, 0.6, TW, 0]); }
  const diag = Math.hypot(TW, 9), ang = Math.atan2(9, TW);
  for (let y = 8.5; y < TH; y += 9) for (const z of [-TW / 2, TW / 2]) bars.push([tx, y, z, diag, 0.35, 0.35, ((y / 9) | 0) % 2 ? ang : -ang, 'z']);
  for (let y = 8.5; y < TH; y += 9) for (const x of [-TW / 2, TW / 2]) bars.push([tx + x, y, 0, 0.35, 0.35, diag, ((y / 9) | 0) % 2 ? ang : -ang, 'x']);
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), MAT.truss, bars.length);
  const e = new THREE.Euler();
  bars.forEach(([x, y, z, sx, sy, sz, a, ax], i) => { e.set(ax === 'x' ? a : 0, 0, ax === 'z' ? a : 0); _q.setFromEuler(e); im.setMatrixAt(i, _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz))); });
  im.castShadow = true; site.add(im);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 14, 8), MAT.truss); rod.position.set(tx, TH + 7, 0); site.add(rod);
  // chopsticks: a carriage on the tower and two long arms reaching around the stack
  const CH = STACK_BASE + BOOSTER_H + 30;
  box3(site, TW + 2, 6, TW + 2, tx, CH, 0, MAT.steelDark);
  for (const sd of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(tx - TW / 2, CH, sd * (TW / 2 - 1)); arm.rotation.y = sd * 0.42; site.add(arm);
    box3(arm, 34, 3.2, 1.6, -17, 0, 0, MAT.truss); box3(arm, 34, 0.5, 2.4, -17, 1.8, 0, MAT.steelDark);
  }
  // quick-disconnect arm to the ship
  box3(site, tx - R - 1, 2.2, 3, (tx + R + 1) / 2 - 0.5, STACK_BASE + BOOSTER_H + 38, 0, MAT.truss);
  // the full stack
  const stack = new THREE.Group(); stack.position.y = STACK_BASE; site.add(stack);
  stack.add(makeBooster());
  const ship = makeShip({ tiles: true }); ship.position.y = BOOSTER_H + 2.4; ship.rotation.y = Math.PI; stack.add(ship);
  // launch flame + glow (hidden until ignition)
  const flame = new THREE.Mesh(new THREE.ConeGeometry(R + 1.5, 60, 32, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.4, 1.9, 0.9), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  flame.rotation.x = Math.PI; flame.position.y = -30; flame.visible = false; stack.add(flame);
  const core = new THREE.Mesh(new THREE.ConeGeometry(R, 22, 32, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.6, 4), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  core.rotation.x = Math.PI; core.position.y = -11; core.visible = false; stack.add(core);
  const light = new THREE.PointLight('#ffb070', 0, 600, 1.2); light.position.y = -8; stack.add(light);
  live.stack = { site, stack, flame, core, light, door: new THREE.Vector3(-R - 0.5, BOOSTER_H + 2.4 + 30, 0) };
  // smoke billboards for liftoff
  const smokeTex = k.canvasTex(128, 128, (c) => { const g = c.createRadialGradient(64, 64, 4, 64, 64, 64); g.addColorStop(0, 'rgba(240,236,230,0.95)'); g.addColorStop(0.6, 'rgba(210,205,200,0.5)'); g.addColorStop(1, 'rgba(200,200,200,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128); });
  for (let i = 0; i < 40; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0 }));
    sp.visible = false; site.add(sp); live.smoke.push({ sp, a: Math.random() * Math.PI * 2, v: 14 + Math.random() * 22, up: Math.random() * 6 });
  }
  // cryogenic venting: white vapor curling off the fueled stack
  live.vent = [];
  for (let i = 0; i < (k.IS_MOBILE ? 10 : 22); i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0, color: '#eef3f8' }));
    const hi = i % 3 === 0; site.add(sp);
    live.vent.push({ sp, y0: STACK_BASE + (hi ? BOOSTER_H + 1 : 4 + Math.random() * 10), a: Math.random() * Math.PI * 2, ph: Math.random() });
  }
}

// low scrub and grass tufts on the sand
function buildScrub(k, rand) {
  const geo = new THREE.IcosahedronGeometry(1, 1); geo.scale(1, 0.55, 1);
  const N = 700, im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: '#7d8a52', roughness: 1 }), N), col = new THREE.Color();
  let n = 0;
  for (let i = 0; i < N * 2 && n < N; i++) {
    const s = -300 + rand() * 3700, d = (rand() < 0.5 ? -1 : 1) * (ROAD_HALF + 5 + rand() * 260);
    if (s > 100 && s < 950 && d > 0 && d < 200) continue;
    if (s > TOWER_S - 80 && s < TOWER_S + 80 && d > 0 && d < 140) continue;
    const y = groundY(s, d); if (y < -0.6) continue;
    k.world(s, d, y, _p); const sc = 0.4 + rand() * 1.2;
    im.setMatrixAt(n, _m.compose(_p, _q.identity(), _s.set(sc * (1 + rand()), sc, sc * (1 + rand()))));
    im.setColorAt(n, col.setHSL(0.16 + rand() * 0.06, 0.3, 0.28 + rand() * 0.12)); n++;
  }
  im.count = n; im.receiveShadow = true; k.scene.add(im);
}
function buildPoles(k) {
  const geo = new THREE.CylinderGeometry(0.14, 0.2, 10, 6); geo.translate(0, 5, 0);
  const spots = []; for (let s = -100; s < FINISH_S + 150; s += 45) spots.push(s);
  const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: '#6a5a48', roughness: 1 }), spots.length);
  const bar = new THREE.InstancedMesh(new THREE.BoxGeometry(0.15, 0.15, 2.6), new THREE.MeshStandardMaterial({ color: '#6a5a48', roughness: 1 }), spots.length);
  spots.forEach((s, i) => { k.world(s, -(ROAD_HALF + 5), 0, _p); _q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, k.frame(s).yaw + Math.PI / 2); im.setMatrixAt(i, _m.compose(_p, _q, _s.set(1, 1, 1))); _p.y += 9.4; bar.setMatrixAt(i, _m.compose(_p, _q, _s)); });
  k.scene.add(im, bar);
}

// ---------- per frame: water, hop, test stands, the launch ----------
const ease = (x) => x * x * (3 - 2 * x);
function tick(time, camera, info) {
  if (!live.k) return;
  if (live.water) live.water.offset.set(time * 0.004, time * 0.0025);
  const sCam = -camera.position.z;
  // test stands: beacon blinks for a second, then fire
  for (const h of live.hz) {
    const ph = ((time + h.hz.ph) % h.hz.period), on = ph < h.hz.on, warn = !on && ph > h.hz.period - 1.1;
    h.hz.active = on;
    h.fl.visible = h.core.visible = on; if (on) { h.fl.scale.set(1 + Math.sin(time * 40) * 0.08, 1, 1 + Math.sin(time * 33) * 0.08); h.fl.material.opacity = 0.7 + Math.random() * 0.25; }
    h.beacon.material.color.setRGB(warn && Math.sin(time * 20) > 0 ? 6 : on ? 4 : 0.6, 0.3, 0.1);
    h.strip.material.opacity = on ? 0.35 : warn ? 0.12 + 0.1 * Math.sin(time * 20) : 0;
  }
  // the hop plays once as you approach
  const hp = live.hop;
  if (hp) {
    if (hp.t0 == null && sCam > HOP.s - 260 && sCam < HOP.s + 200) hp.t0 = time;
    if (sCam < HOP.s - 400) hp.t0 = null;
    const t = hp.t0 == null ? -1 : time - hp.t0;
    let y = 0, rx = 0, fire = false;
    if (t > 0 && t < 1.2) { fire = true; }
    else if (t >= 1.2 && t < 5.5) { y = 150 * ease((t - 1.2) / 4.3); fire = t < 4.2; }
    else if (t >= 5.5 && t < 7) { y = 150 - 20 * ((t - 5.5) / 1.5) ** 2; rx = (Math.PI / 2) * ease((t - 5.5) / 1.5); }
    else if (t >= 7 && t < 10.5) { y = 130 - 100 * ((t - 7) / 3.5); rx = Math.PI / 2; }
    else if (t >= 10.5 && t < 11.6) { y = 30 - 18 * ease((t - 10.5) / 1.1); rx = (Math.PI / 2) * (1 - ease((t - 10.5) / 1.1)); fire = true; }
    else if (t >= 11.6 && t < 13.2) { y = 12 * (1 - ease((t - 11.6) / 1.6)); fire = true; }
    hp.g.position.copy(hp.base); hp.g.position.y += y; hp.g.rotation.x = rx;
    hp.flame.visible = fire; if (fire) hp.flame.scale.set(1 + Math.sin(time * 50) * 0.1, 0.8 + Math.random() * 0.4, 1);
  }
  // the launch, after the finish line
  const st = live.stack;
  if (!st) return;
  if (live.vent) for (const v of live.vent) {
    const u = (time * 0.18 + v.ph) % 1, off = st.stack.position.y - STACK_BASE;
    v.sp.position.set(Math.cos(v.a) * (R + 1 + u * 9), v.y0 + off - u * 6, Math.sin(v.a) * (R + 1 + u * 9));
    v.sp.scale.setScalar(4 + u * 12); v.sp.material.opacity = off > 1 ? 0 : 0.5 * Math.sin(u * Math.PI);
  }
  if (info?.state === 'finish') {
    live.cut ??= { t0: time, from: info.car.position.clone(), quat: info.car.quaternion.clone() };
    const t = time - live.cut.t0, car = info.car;
    const door = st.site.localToWorld(st.door.clone());
    if (t > 1.4 && t < 4.2) {
      // the chopsticks' magic: the car rises in an arc to the ship's door
      const u = ease(Math.min(1, (t - 1.4) / 2.6));
      const mid = live.cut.from.clone().lerp(door, 0.5); mid.y = door.y * 0.55 + 20;
      const a = live.cut.from.clone().lerp(mid, u), b = mid.clone().lerp(door, u); car.position.copy(a.lerp(b, u));
      car.rotation.set(0, k0yaw() + u * 1.2, Math.sin(t * 3) * 0.1);
      car.scale.setScalar(1 - Math.max(0, u - 0.85) * 6);
    } else if (t >= 4.2) { car.visible = false; }
    if (t > 4.6) {
      const lt = t - 4.6;
      st.flame.visible = st.core.visible = true; st.flame.scale.set(1 + Math.sin(time * 40) * 0.05, 0.8 + Math.random() * 0.3, 1 + Math.sin(time * 37) * 0.05);
      st.light.intensity = 900;
      const rise = lt > 1.2 ? 0.5 * 7 * (lt - 1.2) ** 2 : 0;
      st.stack.position.y = STACK_BASE + rise;
      for (const sm of live.smoke) {
        sm.sp.visible = true; const r = Math.min(80, lt * sm.v);
        sm.sp.position.set(Math.cos(sm.a) * r, 2 + sm.up + lt * 2, Math.sin(sm.a) * r);
        sm.sp.scale.setScalar(10 + lt * 8); sm.sp.material.opacity = Math.max(0, 0.85 - lt * 0.06);
      }
    }
  } else if (live.cut) {
    // back on the road (retry): put everything back
    live.cut = null; info?.car && (info.car.visible = true, info.car.scale.setScalar(1));
    st.stack.position.y = STACK_BASE; st.flame.visible = st.core.visible = false; st.light.intensity = 0;
    for (const sm of live.smoke) { sm.sp.visible = false; sm.sp.material.opacity = 0; }
  }
}
function k0yaw() { return live.k.frame(FINISH_S).yaw; }
function finishCam(camera, time) {
  const c = live.cut; if (!c) return false;
  const t = time - c.t0, k = live.k, st = live.stack;
  if (t < 1.4) return false; // the usual chase cam while braking over the line
  const base = st.site.position;
  if (t < 4.6) {
    k.world(FINISH_S - 70, -45, 14, camera.position);
    camera.lookAt(base.x, base.y + 70, base.z); camera.fov = 52;
  } else {
    const lt = t - 4.6, shake = Math.min(1, lt) * 0.35;
    k.world(FINISH_S - 150, -80, 6, camera.position);
    camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake;
    camera.lookAt(base.x, base.y + STACK_BASE + 60 + (st.stack.position.y - STACK_BASE) * 0.9, base.z); camera.fov = 50;
  }
  camera.updateProjectionMatrix();
  return true;
}
