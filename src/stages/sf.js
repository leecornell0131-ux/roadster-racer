// Stage 3: San Francisco at golden hour. Straight-up-and-over hill streets whose flat crossings launch
// you (Bullitt style), Victorian rows, a ClosedAI data center leaking coolant, a Lombard-style zigzag,
// then the Golden Gate: ride up the main cable, fly off the tower top, try to land back on it.
import * as THREE from 'three';
import { bigTurns, rampRun, CITY_ROAD } from './city.js';

const ROAD_HALF = 12;
const FINISH_S = 3060;
// bridge: land ends at B0, cable anchors A1/A2, towers T1/T2, land again at B1
const B0 = 1800, B1 = 2920, A1 = 1830, A2 = 2870, T1 = 2080, T2 = 2620, MID = (T1 + T2) / 2;
const TOWER_H = 58, SAG = 3, CABLE_D = 14.2, CABLE_R = 0.75;

// ---------- road profile ----------
// SF streets climb in straight pitches with flat crossings; going over a flat-to-down edge fast, you fly
const KEYS = [[-500, 0], [200, 0], [310, 17.6], [332, 17.6], [442, 37.4], [464, 37.4], [564, 57.4], [604, 57.4],
  [674, 43.4], [696, 43.4], [766, 28], [788, 28], [858, 12.6], [880, 12.6], [940, 0], [1100, 0],
  [1190, 20], [1210, 20], [1360, 0], [1600, 0], [1720, 19], [4800, 19]];
const CROSSINGS = [321, 453, 584, 685, 777, 869, 1200];  // flat street crossings (cross streets, no houses)
const E0 = -500, EN = 4800;
const ETAB = (() => {
  const raw = new Float32Array(EN - E0 + 1);
  for (let i = 0; i < raw.length; i++) {
    const s = E0 + i; let k = 0; while (k < KEYS.length - 2 && KEYS[k + 1][0] < s) k++;
    const [sa, ya] = KEYS[k], [sb, yb] = KEYS[k + 1];
    raw[i] = ya + (yb - ya) * THREE.MathUtils.clamp((s - sa) / (sb - sa), 0, 1);
  }
  // round every corner over ~11 m so crests stay crisp but read as real road
  const out = new Float32Array(raw.length), R = 5;
  for (let i = 0; i < raw.length; i++) { let a = 0, n = 0; for (let j = -R; j <= R; j++) { const v = raw[i + j]; if (v !== undefined) { a += v; n++; } } out[i] = a / n; }
  return out;
})();
function elev(s) {
  const x = THREE.MathUtils.clamp(s - E0, 0, EN - E0 - 1), i = Math.floor(x), f = x - i;
  return ETAB[i] * (1 - f) + ETAB[i + 1] * f;
}
const DECK = 19;

// ---------- main cables ----------
function cableY(s) {
  if (s < T1) return TOWER_H * (s - A1) / (T1 - A1);
  if (s < T2) return SAG + (TOWER_H - SAG) * ((s - MID) / (MID - T1)) ** 2;
  return TOWER_H * (A2 - s) / (A2 - T2);
}
const ramp01 = (s) => s < A1 + 55 ? THREE.MathUtils.smoothstep(s, A1, A1 + 55) : s > A2 - 55 ? THREE.MathUtils.smoothstep(A2 - s, 0, 55) : 1;
const cableD = (s) => 10.4 + (CABLE_D - 10.4) * ramp01(s);   // the wide on-ramp funnels from the outer lane onto the cable
const cableW = (s) => 4.2 - 2.75 * ramp01(s);

const PUDDLES = [[968, -3], [992, 9], [1015, 3], [1038, -9], [1060, -3], [1078, 9]].map(([s, d]) => ({ s, d, l: 3.4, w: 2.1 }));

// traffic on the real-map events: the stage's mix, cable cars allowed along the whole route
const CITY_TRAFFIC = {
  waymo: { car: 'ioniq5', kit: true, name: '웨이모', speed: [19, 23], brakes: true, n: 9 },
  robotaxi: { car: 'modely', name: '테슬라 로보택시', speed: [30, 34], color: '#f2f2f0', n: 4 },
  model3: { car: 'model3', name: '모델 3', speed: [26, 32], n: 3 },
  cybertruck: { car: 'cybertruck', name: '사이버트럭', speed: [24, 29], n: 2 },
  cablecar: { make: makeCableCar, name: '케이블카', speed: [8, 10], n: 2, lanes: [-3, 3], range: [200, 9000], color: '#8b1e1c' },
};

export default {
  id: 'sf', num: 3, name: 'SF',
  city: 'sf',
  eggs: [
    { id: 'sf_seal', ev: 'wharf', place: 'Fishermans Wharf of San Francisco', y: 1.4, name: '피어 39 바다사자 인형', line: '바다사자가 로드스터 보닛에서 낮잠 자고 싶대. 거절했어.' },
    { id: 'sf_choc', ev: 'wharf', fork: 0, y: 1.4, name: '기라델리 초콜릿 바', line: '우회로로 온 보상. 녹기 전에 먹어. 배터리 열관리보다 급해.' },
    { id: 'sf_book', ev: 'chinatown', place: 'City Lights Booksellers', y: 1.6, name: '시티라이츠 초판 시집', line: '비트 세대 시집이네. 제목은 "울부짖음". 우리 모터 소리 얘기 같아.' },
    { id: 'sf_cookie', ev: 'chinatown', fork: 0, y: 1.4, name: '포춘쿠키', line: '"당신의 AGI는 다음 달에 나옵니다." 36개월째 같은 쪽지야.' },
    { id: 'sf_token', ev: 'market', s: 1200, d: 9, y: 1.4, name: '케이블카 토큰', line: '케이블카 공짜 탑승권. 우리 차가 더 빠르지만.' },
  ],
  roadHalf: ROAD_HALF, lanes: [-9, -3, 3, 9], finish: FINISH_S,
  gaps: [],
  elev,
  cx(s) {
    const zig = s > 1215 && s < 1355 ? 2.6 * Math.sin(((s - 1215) / 70) * Math.PI * 2) * Math.sin(((s - 1215) / 140) * Math.PI) : 0;
    return zig - 70 * THREE.MathUtils.smoothstep(s, 1380, 1780) + 26 * THREE.MathUtils.smoothstep(s, 2960, 3320);
  },
  ramps: [
    { s0: 1440, len: 16, dL: -6, dR: 6, h: 3.0 },
    { s0: 1560, len: 14, dL: -12, dR: -4, h: 2.6 },
    { s0: 1560, len: 14, dL: 4, dR: 12, h: 2.6 },
    { s0: 2230, len: 16, dL: -6, dR: 6, h: 3.2 },
    { s0: 2470, len: 16, dL: -6, dR: 6, h: 3.2 },
  ],
  surfaces: [1, -1].map((side) => ({ s0: A1, s1: A2, y: cableY, d: (s) => side * cableD(s), w: cableW })),
  wide: { s0: B0, s1: B1, half: CABLE_D + 1.7 },
  splashY: (s) => (s > B0 && s < B1 ? -DECK - 0.5 : -5.5),
  respawnBack: 70,
  blocks: [A1 - 15, A2 - 40].flatMap((s0) => [{ s0, len: 60, dL: 6, dR: 12 }, { s0, len: 60, dL: -12, dR: -6 }]),
  puddles: PUDDLES,
  legend: { s: T1 + 3, d: -CABLE_D, y: TOWER_H + 5.2 },   // above the left tower top: jump at the summit
  pickups: [
    ...range(A1 + 12, T1 - 6, 10).map((s) => ['coin', s, -cableD(s), cableY(s) + 1.1]),
    ...range(A1 + 12, T1 - 6, 10).map((s) => ['coin', s, cableD(s), cableY(s) + 1.1]),
    ...range(T1 + 70, T2 - 30, 16).map((s) => ['coin', s, CABLE_D, cableY(s) + 1.1]),
    ['h100', MID, -CABLE_D, SAG + 1.6], ['h100', T2 - 60, CABLE_D, cableY(T2 - 60) + 1.6],
    ['air', A1 - 30, 9, 1.2], ['air', A1 - 30, -9, 1.2], ['air', T1 + 140, -CABLE_D, cableY(T1 + 140) + 1.2],
    // coin arcs that trace the flights off the downhill crossings
    ...[604, 696, 788, 880].flatMap((s0) => range(4, 44, 7).map((x) => ['coin', s0 + x, 3, 1.2 + 0.2 * x - 16 * (x / 60) ** 2])),
  ],
  trafficMaxS: FINISH_S + 200,
  road: { yellow: true, dashes: [0.25, 0.75] },
  env: {
    bg: true, sun: ['#ffd2a0', 2.6], hemi: ['#c8b8e8', '#6a4a3a', 0.6],
    fog: ['#d9a993', 260, 1900], hdri: 'assets/sf_sunset_rgbe_gray.png', exposure: 0.8, bgIntensity: 0.95, bloom: 0.38, hdrMax: 2500,
  },
  traffic: {
    waymo: { car: 'ioniq5', kit: true, name: '웨이모', speed: [19, 23], brakes: true, n: 8 },
    robotaxi: { car: 'modely', name: '테슬라 로보택시', speed: [30, 34], color: '#f2f2f0', n: 4 },
    model3: { car: 'model3', name: '모델 3', speed: [26, 32], n: 3 },
    cybertruck: { car: 'cybertruck', name: '사이버트럭', speed: [24, 29], n: 2 },
    cablecar: { make: makeCableCar, name: '케이블카', speed: [8, 10], n: 3, lanes: [-3, 3], range: [160, 1150], color: '#8b1e1c' },
  },
  boss: 'orb',
  props: ['airship'],
  radio: [
    [20, '샌프란시스코야. 언덕이 미쳤어. 꼭대기 교차로는 평평해서, 속도 그대로 넘으면 붕 떠.'],
    [250, '날아오르면 공중에서 점프 꾹! 착지가 퍼펙트면 속도가 붙어.'],
    [590, '놉힐 꼭대기. 이제 내리막 점프 4연발이다. 코인 줄 따라 날아!'],
    [930, '클로즈드AI 데이터센터 구역이야. 파란 냉각수 웅덩이는 미끄러우니까 피해.'],
    [1185, '롬바드 스트리트! 세상에서 제일 구불구불한 길. 꽃밭은 건드리지 마.'],
    [1700, '금문교다! 바깥 차선 끝에 메인 케이블 올라가는 길 있어. 케이블 타고 탑 꼭대기까지 가자.'],
    [2050, '탑 꼭대기에서 그대로 날아! 아래는 바다야. 내려올 때 점프 꾹!'],
    [2940, '마린 쪽 도착. 결승선까지 밟아!'],
  ],
  lines: { finish: '금문교 통과! 다음은 메타버스야. 현실이 폴리곤처럼 깨지는 곳이래.', fall: ['풍덩!', '샌프란시스코만에 빠짐 · +3초', '케이블 밖으로 나가면 바다야. 다시 가자!'] },
  stars: { time: 72, text: '완주 · AGI 오브 격추 · 72초 이내 또는 퍼펙트 랜딩 5회', perfect: 5 },
  poster: { s: 2010, d: -12, y: 13, boss: [30, 24, 24], cam: { back: 12, side: -9, y: 7, ahead: 30, lookSide: 4, lookY: 24, fov: 55 } },
  text: {
    eyebrow: 'STAGE 03 · HYPE CITY', title: 'SAN FRANCISCO', sub: '언덕 꼭대기에서 날아라',
    tip: '<b>TIP</b> 언덕 위 평평한 교차로를 빠르게 넘으면 차가 <b>저절로 날아요</b>. 공중에서 점프를 꾹 눌러 부드럽게 착지하세요. 금문교에선 바깥 차선 끝 진입로로 <b>메인 케이블</b>에 올라탈 수 있어요.',
    tweet: 'AGI가 "다음 달"에 나온다고 한 지 36개월째. 그동안 나는 금문교 케이블 위로 로드스터 몰고 감. 누가 진짜 미래인지 보자.',
    meta: '오전 2:47 · 샌프란시스코 · 리트윗 120만', load: 'SF 안개 깔는 중 · 언덕 경사 재는 중',
    hud: 'STAGE 3 · SAN FRANCISCO', clear: 'STAGE 03 CLEAR', clearTitle: '안개 속 탈출',
  },
  // chapter 3: three errands on real San Francisco streets (OpenStreetMap), then the original hills-and-bridge run
  events: [
    {
      id: 'wharf', name: '워터프런트 배송', ...CITY_ROAD,
      brief: '<b>배송</b> 진짜 SF 지도예요. 페리 빌딩에서 엠바카데로를 따라 익스플로라토리움, 피셔맨스 워프, 기라델리 스퀘어를 거쳐 롬바드 스트리트 지그재그까지. 초록 정차 구역에서 <b>↓ 브레이크</b>.',
      route: { from: 'San Francisco Ferry Building', via: ['Exploratorium', 'Fishermans Wharf of San Francisco', 'Ghirardelli Chocolate Experience'], to: 'Lombard Street' },
      elev: null, surfaces: [], wide: null, splashY: null, blocks: [], puddles: [], legend: null, pickups: [], gaps: [], boss: null, trafficMaxS: 9000,
      forks: (L, R) => bigTurns(R, 1).map((t) => ({ at: t.s, name: '정상 경로' })),
      ramps: (L) => rampRun(380, L - 300, 300, 3),
      traffic: CITY_TRAFFIC,
      mission: { type: 'deliver', time: 140, allowMiss: 1, stops: [
        { place: 'Exploratorium', name: '익스플로라토리움', thanks: '과학 시간 안 늦었어요!' },
        { place: 'Fishermans Wharf of San Francisco', name: '피셔맨스 워프', thanks: '클램 차우더 먹으러 왔어요', line: '바다사자들이 우리 차 보고 박수 쳤어. 진짜야.' },
        { place: 'Ghirardelli Chocolate Experience', name: '기라델리 스퀘어', thanks: '초콜릿 안 녹았어요!' },
      ] },
      radio: [[20, '샌프란시스코 진짜 길이야. 엠바카데로 따라 바닷가로 간다. 웨이모 진짜 많으니까 조심.'], [3000, '마지막은 롬바드 스트리트! 세상에서 제일 구불구불한 길이야. 천천히.']],
      lines: { finish: '롬바드 꼭대기 도착. 관광객들이 우리 차 사진만 찍더라.', failed: '손님들이 별점 테러 중이야… 다시 가자.' },
      poster: { s: 300, d: -6, y: 0, cam: { back: 10, side: 3, y: 2.6, ahead: 8, lookSide: -3, lookY: 1.4, fov: 46 } },
      finishText: 'FINISH · 롬바드 스트리트',
      text: { clear: 'DELIVERY DONE', clearTitle: '배송 완료' },
    },
    {
      id: 'chinatown', name: '차이나타운 스턴트 쇼', ...CITY_ROAD,
      brief: '<b>스턴트</b> 차이나타운 드래곤 게이트에서 노스비치를 돌아 트랜스아메리카 피라미드까지. 아슬 추월, 배럴롤, 퍼펙트 착지로 <b>콤보 배수</b>. 정체 구간은 점프대로 지붕 위로.',
      route: { from: 'Dragon Gate', via: ['City Lights Booksellers', 'Saints Peter and Paul Church'], to: 'Transamerica Pyramid' },
      elev: null, surfaces: [], wide: null, splashY: null, blocks: [], puddles: [], legend: null, pickups: [], gaps: [], boss: null, trafficMaxS: 9000,
      forks: (L, R) => bigTurns(R, 1).map((t) => ({ at: t.s, name: '정상 경로' })),
      ramps: (L) => { const j = [Math.round(L * 0.3) - 40, Math.round(L * 0.68) - 40];
        return [...rampRun(260, L - 150, 170, 0).filter((r) => j.every((s) => Math.abs(r.s0 - s) > 110)), ...j.map((s0) => ({ s0, len: 18, dL: -12, dR: 12, h: 3.4 }))]; }, // full width: every lane can hop the jam
      jams: (L) => [[Math.round(L * 0.3), Math.round(L * 0.3) + 140], [Math.round(L * 0.68), Math.round(L * 0.68) + 140]],
      jamMix: { waymo: 4, model3: 2, robotaxi: 2 },
      traffic: CITY_TRAFFIC,
      mission: { type: 'stunt', scores: [7000, 14000, 24000] },
      radio: [[20, '차이나타운 스턴트 쇼야. 등불 아래서 배럴롤 한번 보여 줘.'], [800, '웨이모 정체! 전부 라이다가 서로 감지해서 멈춘 거야. 점프대로 지붕 위로!']],
      lines: { finish: '피라미드 앞에서 착지 완벽. 이제 마켓 스트리트에서 웨이모랑 붙자.', failed: '박수가 좀 약했어. 콤보를 끊지 말고 이어 봐.' },
      poster: { s: 400, d: 2, y: 0, cam: { back: 9, side: -4, y: 1.6, ahead: 10, lookSide: -2, lookY: 2.6, fov: 46 } },
      finishText: 'FINISH · 트랜스아메리카 피라미드',
      text: { clear: 'SHOW TIME', clearTitle: '스턴트 쇼 성공' },
    },
    {
      id: 'market', name: '마켓 스트리트 드래그', ...CITY_ROAD,
      brief: '<b>레이스</b> 페리 빌딩 앞에서 마켓 스트리트를 쭉 따라 파월 케이블카 회전대 너머까지 직선 승부. 상대는 웨이모 셋. 웨이모는 장애물을 보면 급정거하니까 뒤에 바짝 붙지 마요.',
      route: { from: [1350, -250], via: ['Cable Car Turntable (Powell & Market)'], to: [-300, 1390] }, // Market St from the Ferry Building end, past Powell
      elev: null, surfaces: [], wide: null, splashY: null, blocks: [], puddles: [], legend: null, pickups: [], gaps: [], jams: [], boss: null, trafficMaxS: 9000,
      ramps: (L) => rampRun(300, L - 150, 230, 1),
      traffic: { ...CITY_TRAFFIC, waymo: { ...CITY_TRAFFIC.waymo, n: 5 } },
      mission: { type: 'rivals', time: 42, perfect: 2, rivals: [
        { type: 'waymo', name: '웨이모 #1', label: 'WAYMO 1', speed: 52, d: -3, s: 24 },
        { type: 'waymo', name: '웨이모 #2', label: 'WAYMO 2', speed: 54, d: 9, s: 30 },
        { type: 'waymo', name: '웨이모 #3', label: 'WAYMO 3', speed: 56, d: -9, s: 36, tagColor: '#ffc83d' },
      ] },
      radio: [[20, '마켓 스트리트 직선이야. 웨이모 셋이 시승 대결 신청했어. 라이다 47개로 우리 카메라 8개를 이기겠대.'], [1300, '파월 회전대 지나간다! 케이블카 조심!']],
      lines: { finish: '웨이모 셋 다 급정거 중. 이제 언덕 넘어 금문교로 가자. 샘의 오브가 기다려.', failed: '웨이모한테 졌다고? 걔들 급정거할 때 옆으로 빠져.' },
      poster: { s: 400, d: -3, y: 0, cam: { back: 10, side: 3, y: 2.2, ahead: 8, lookSide: -3, lookY: 1.4, fov: 46 } },
      finishText: 'FINISH · 마켓 스트리트',
      text: { clear: 'WINNER', clearTitle: '드래그 레이스 우승' },
    },
    {
      id: 'hills', name: '언덕과 금문교 · AGI 오브',
      brief: '<b>보스전</b> 놉힐 언덕 점프, 롬바드 지그재그, 금문교 케이블 위까지. AGI 오브를 <b>F(⚡) 코일</b>과 점프 공격으로 격추해요. 탑 꼭대기에서 날아오르면 대박.',
      mission: { type: 'boss', time: 72, perfect: 5 },
    },
  ],
  build,
  tick,
};

function range(a, b, step) { const out = []; for (let s = a; s <= b; s += step) out.push(s); return out; }
function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function noise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const nearCrossing = (s, pad = 11) => CROSSINGS.some((c) => Math.abs(s - c) < pad);

// animated bits the stage owns (water, fog, steam, the LED crown)
const live = { water: null, fog: [], steam: [], crown: null, puddles: null };

function build(k) {
  const { scene } = k;
  // real-map events: OpenStreetMap streets and buildings instead of the hand-made hills
  if (k.CITY) { k.buildCity(); k.finishArch(k.ST.finishText || 'FINISH'); return; }
  const walk = new THREE.MeshStandardMaterial({ map: k.photo('sf_walk_diff.jpg', { rep: [0.25, 0.25] }), normalMap: k.photo('sf_walk_nor.jpg', { srgb: false, rep: [0.25, 0.25] }), color: '#c9c1bb', roughness: 0.85 });
  const lot = new THREE.MeshStandardMaterial({ map: k.photo('sf_walk_diff.jpg', { rep: [1 / 8, 1 / 8] }), color: '#8d8580', roughness: 0.95 });
  const asphalt = new THREE.MeshStandardMaterial({ map: k.photo('asphalt_diff.jpg', { rep: [1 / 10, 1 / 10] }), color: '#7b7680', roughness: 0.92 });
  const grass = new THREE.MeshStandardMaterial({ map: k.photo('sf_grass_diff.jpg', { rep: [1 / 10, 1 / 10] }), normalMap: k.photo('sf_grass_nor.jpg', { srgb: false, rep: [1 / 10, 1 / 10] }), color: '#c8c58a', roughness: 1 });
  const rock = new THREE.MeshStandardMaterial({ map: k.photo('concrete_diff.jpg', { rep: [0.05, 0.05] }), color: '#6d5f56', roughness: 1, side: THREE.DoubleSide });

  // sidewalks + curbs through the city, then the ground the city stands on
  for (const side of [-1, 1]) {
    const [a, b] = side < 0 ? [-(ROAD_HALF + 4.5), -ROAD_HALF] : [ROAD_HALF, ROAD_HALF + 4.5];
    const sw = new THREE.Mesh(k.ribbon(-200, B0, a, b, 3, () => 0.18, 4), walk); sw.receiveShadow = true; scene.add(sw);
    scene.add(new THREE.Mesh(k.wall(-200, B0, side * ROAD_HALF, 3, () => 0, () => 0.18, 1), walk));
    const [l, r] = side < 0 ? [-700, -(ROAD_HALF + 4.4)] : [ROAD_HALF + 4.4, 700];
    const city = new THREE.Mesh(k.grid(-300, 1380, l, r, 12, 20, () => 0.12, 1), lot); city.receiveShadow = true; scene.add(city);
    // Marina green / Presidio; open bay on the right past the Marina
    const [l2, r2] = side < 0 ? [-900, -(ROAD_HALF + 4.4)] : [ROAD_HALF + 4.4, 70];
    const park = new THREE.Mesh(k.grid(1380, B0, l2, r2, 10, 10, (s, d) => 0.1 + (side < 0 ? THREE.MathUtils.smoothstep(-d, 60, 600) * 70 * noise(s / 120, d / 120) : 0), 1), grass); park.receiveShadow = true; scene.add(park);
  }
  // cliffs where the land meets the Golden Gate
  scene.add(new THREE.Mesh(k.crossWall(B0, -900, 70, -DECK - 3, 0.1), rock));
  scene.add(new THREE.Mesh(k.crossWall(B1, -1600, 1600, -DECK - 3, 0.1), rock));
  // cross streets at the flat crossings, with crosswalks
  const zebra = k.canvasTex(256, 64, (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = 'rgba(240,238,232,0.9)'; for (let x = 4; x < w; x += 22) c.fillRect(x, 0, 12, h); });
  const zebraMat = new THREE.MeshStandardMaterial({ map: zebra, transparent: true, roughness: 0.7, depthWrite: false });
  for (const c of CROSSINGS) {
    for (const side of [-1, 1]) { const [l, r] = side < 0 ? [-700, -ROAD_HALF] : [ROAD_HALF, 700]; const m = new THREE.Mesh(k.grid(c - 9, c + 9, l, r, 18, 30, () => 0.2, 1), asphalt); m.receiveShadow = true; scene.add(m); }
    for (const o of [-10.5, 10.5]) scene.add(new THREE.Mesh(k.ribbon(c + o - 1.5, c + o + 1.5, -ROAD_HALF, ROAD_HALF, 3, () => 0.025), zebraMat));
  }

  buildCableCarTracks(k);
  buildVictorians(k);
  buildDowntown(k);
  buildDataCenter(k);
  buildLombard(k);
  buildLamps(k);
  buildTrees(k);
  buildBridge(k);
  buildWater(k);
  buildMarin(k, grass, rock);
  buildFog(k);
  buildBlimp(k);
  k.finishArch('FINISH · 마린 비스타 포인트');
}

// ---------- city ----------
function buildCableCarTracks(k) {
  const steel = new THREE.MeshStandardMaterial({ color: '#6f6c6a', metalness: 0.9, roughness: 0.5, envMapIntensity: 0.5 });
  const slot = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.9 });
  for (const lane of [-3, 3]) {
    for (const o of [-0.72, 0.72]) k.scene.add(new THREE.Mesh(k.ribbon(150, 1180, lane + o - 0.05, lane + o + 0.05, 4, () => 0.022), steel));
    k.scene.add(new THREE.Mesh(k.ribbon(150, 1180, lane - 0.03, lane + 0.03, 4, () => 0.021), slot));
  }
}

const PASTELS = ['#f2c3bd', '#c6d8ea', '#d4e2be', '#f1e1ad', '#ddcbe6', '#f4efe4', '#b7c9bf', '#eab68c', '#9eb6cb', '#cf8a73', '#e8d4c0', '#a9c2a0'];
function victorianMaps(k, bay) {
  // one facade drawn twice: the paint (siding in light grey, so instance colour tints it) and a mask
  // (R = white trim that keeps its colour, G = window glass)
  const W = 512, H = bay ? 512 : 768;
  const draw = (c, mask) => {
    const trim = mask ? 'rgb(255,0,0)' : '#f3efe6', glass = mask ? 'rgb(0,255,0)' : '#20262c', body = mask ? '#000' : '#cfcfcf';
    c.fillStyle = body; c.fillRect(0, 0, W, H);
    if (!mask) for (let y = 0; y < H; y += 9) { c.fillStyle = 'rgba(0,0,0,0.16)'; c.fillRect(0, y, W, 2); c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(0, y + 2, W, 1); }
    const win = (x, y, w, h) => {
      c.fillStyle = trim; c.fillRect(x - 10, y - 18, w + 20, h + 30); // casing + head
      c.fillStyle = glass; c.fillRect(x, y, w, h);
      c.fillStyle = trim; c.fillRect(x, y + h * 0.48, w, 6); c.fillRect(x + w / 2 - 3, y, 6, h); // sash bars
      if (!mask) { c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(x + 4, y + 4, w * 0.3, h * 0.4); }
    };
    if (bay) {
      for (const y of [40, 290]) for (const x of [40, 200, 360]) win(x, y, 112, 170);
      c.fillStyle = trim; c.fillRect(0, 0, W, 16); c.fillRect(0, 248, W, 18); c.fillRect(0, H - 16, W, 16);
      return;
    }
    // cornice with brackets
    c.fillStyle = trim; c.fillRect(0, 0, W, 64);
    if (!mask) { c.fillStyle = 'rgba(0,0,0,0.35)'; for (let x = 12; x < W; x += 42) c.fillRect(x, 44, 14, 20); c.fillRect(0, 64, W, 5); }
    // two upper floors: a window either side of the bay
    for (const y of [120, 360]) for (const x of [36, 396]) win(x, y, 80, 160);
    c.fillStyle = trim; c.fillRect(0, 330, W, 12);
    // street level: garage and the front door up a few steps
    c.fillStyle = trim; c.fillRect(150, 560, 230, 208); c.fillRect(30, 560, 100, 208);
    c.fillStyle = mask ? '#000' : '#6b5a4a'; c.fillRect(46, 586, 68, 182);
    c.fillStyle = mask ? '#000' : '#8a8680'; c.fillRect(166, 590, 198, 178);
    if (!mask) { c.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 610; y < 768; y += 40) c.fillRect(166, y, 198, 4); }
    c.fillStyle = glass; c.fillRect(56, 596, 48, 60);
  };
  const paint = k.canvasTex(W, H, (c) => draw(c, false));
  const mask = k.canvasTex(W, H, (c) => draw(c, true)); mask.colorSpace = THREE.NoColorSpace;
  return { paint, mask };
}
function victorianMat(k, bay) {
  const { paint, mask } = victorianMaps(k, bay);
  const mat = new THREE.MeshStandardMaterial({ map: paint, roughness: 0.78, metalness: 0, envMapIntensity: 0.9 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.maskMap = { value: mask };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vRoof; varying float vSeed;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n vRoof = abs(normal.y); vSeed = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453); // same for every vertex: stays flat across the face');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D maskMap; varying float vRoof; varying float vSeed;\nfloat vh(float x){ return fract(sin(x * 91.7) * 437.585); }')
      .replace('#include <map_fragment>', '#include <map_fragment>\n vec3 mk = texture2D(maskMap, vMapUv).rgb; float trimM = mk.r * (1.0 - vRoof), glassM = mk.g * (1.0 - vRoof);')
      .replace('#include <color_fragment>', '#if defined(USE_INSTANCING_COLOR) || defined(USE_COLOR)\n diffuseColor.rgb *= mix(vColor, vec3(1.0), trimM);\n#endif\n diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.15, 0.15), vRoof);')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, 0.08, glassM);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n float lit = step(0.72, vh(vSeed * 13.0 + floor(vMapUv.y * 3.0) * 1.7 + floor(vMapUv.x * 2.0)));\n totalEmissiveRadiance += vec3(1.0, 0.62, 0.32) * glassM * lit * 0.55;');
  };
  return mat;
}
function buildVictorians(k) {
  const houses = [];
  const row = (s0, s1, side, d0, skip) => {
    for (let s = s0; s < s1;) {
      const w = 6.4 + Math.random() * 2.2;
      if (!nearCrossing(s + w / 2) && !skip?.(s)) houses.push({ s: s + w / 2, d: side * (d0 + 7.5), side, w, h: 9 + Math.random() * 4.5, bay: Math.random() < 0.8 });
      s += w + 0.15;
    }
  };
  for (const side of [-1, 1]) {
    for (let r = 0; r < 6; r++) row(140, 1185, side, ROAD_HALF + 4.8 + r * 15.6, side > 0 ? (s) => s > 930 && s < 1110 && r < 5 : null);
    row(1210, 1375, side, ROAD_HALF + 5.4, null); row(1210, 1375, side, ROAD_HALF + 21, null);
  }
  row(1395, 1640, -1, ROAD_HALF + 4.8, null);
  const body = new THREE.BoxGeometry(1, 1, 1); body.translate(0, 0.5, 0);
  const mat = victorianMat(k, false), bayMat = victorianMat(k, true);
  const cor = new THREE.MeshStandardMaterial({ color: '#efe9de', roughness: 0.6 });
  const nB = houses.length, nBay = houses.filter((h) => h.bay).length;
  const im = new THREE.InstancedMesh(body, mat, nB), bays = new THREE.InstancedMesh(body, bayMat, nBay), cornice = new THREE.InstancedMesh(body, cor, nB);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color(), off = new THREE.Vector3();
  let bi = 0;
  houses.forEach((h, i) => {
    const fr = k.frame(h.s), yaw = fr.yaw;
    q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
    k.world(h.s, h.d, -4, p); sc.set(15, h.h + 4, h.w); m4.compose(p, q, sc); im.setMatrixAt(i, m4);
    im.setColorAt(i, col.set(PASTELS[(Math.random() * PASTELS.length) | 0]).offsetHSL(0, 0, (Math.random() - 0.5) * 0.06));
    // cornice slab along the street face
    const face = h.d - h.side * 7.5;
    k.world(h.s, face + h.side * 0.1, h.h - 0.2, p); sc.set(1.3, 0.75, h.w + 0.3); m4.compose(p, q, sc); cornice.setMatrixAt(i, m4);
    if (h.bay) {
      k.world(h.s, face - h.side * 0.55, 3.4, p); sc.set(1.1, Math.max(4, h.h - 5.2), Math.min(3.4, h.w - 2.6)); m4.compose(p, q, sc); bays.setMatrixAt(bi, m4);
      bays.setColorAt(bi++, col);
    }
  });
  for (const m of [im, bays, cornice]) { m.castShadow = true; m.receiveShadow = true; k.scene.add(m); }
}

function buildDowntown(k) {
  k.FACADES.push({ name: '001', tile: [26, 26], grid: [10, 10], mask: 'dark', lit: 0.25, metal: 0.3, rough: 0.4, hue: 0.08 });
  const kinds = k.FACADES.map(() => []);
  for (let i = 0; i < 150; i++) {
    const s = 120 + Math.random() * 900, side = Math.random() < 0.5 ? -1 : 1;
    const fin = Math.exp(-(((s - 330) / 260) ** 2)); // the Financial District bunches up near the start
    const d = side * (118 + Math.random() * 320), h = 26 + Math.random() * (40 + 150 * fin);
    const w = 18 + Math.random() * 20;
    kinds[[0, 1, 4, 4, 2][(Math.random() * 5) | 0]].push({ s, d, h, dp: w, w: w * (0.8 + Math.random() * 0.4), y: -6 });
  }
  k.placeBuildings(kinds);
  // the white pyramid
  const pyrTex = k.canvasTex(256, 1024, (c, w, h) => {
    c.fillStyle = '#e8e4dc'; c.fillRect(0, 0, w, h);
    for (let y = 6; y < h; y += 12) for (let x = 4; x < w; x += 10) { c.fillStyle = Math.random() < 0.15 ? '#ffd9a0' : '#3a3f48'; c.fillRect(x, y, 5, 7); }
  });
  const pyr = new THREE.Mesh(new THREE.ConeGeometry(24, 170, 4, 1, true), new THREE.MeshStandardMaterial({ map: pyrTex, roughness: 0.6, metalness: 0.1, emissive: '#ffffff', emissiveMap: pyrTex, emissiveIntensity: 0.05 }));
  k.world(300, 96, 85 - 6, pyr.position); pyr.rotation.y = Math.PI / 4; pyr.castShadow = true; k.scene.add(pyr);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(1.6, 40, 4), new THREE.MeshStandardMaterial({ color: '#e8e4dc', roughness: 0.5 })); k.world(300, 96, 170 + 20 - 6, spire.position); spire.rotation.y = Math.PI / 4; k.scene.add(spire);
  // ClosedAI tower with an LED crown that scrolls the hype
  const prof = [];
  for (let i = 0; i <= 24; i++) { const t = i / 24, y = t * 250; prof.push(new THREE.Vector2(19 * (1 - 0.12 * t) * (t > 0.9 ? Math.sqrt(Math.max(0, 1 - ((t - 0.9) / 0.1) ** 2)) * 0.98 + 0.02 : 1), y)); }
  const fac = k.facadeMat(k.FACADES[0]);
  const tower = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), new THREE.MeshStandardMaterial({ map: k.photo('fac006_col.jpg', { rep: [6, 9] }), normalMap: k.photo('fac006_nor.jpg', { srgb: false, rep: [6, 9] }), metalness: 0.6, roughness: 0.2, color: '#b9c3cc' }));
  void fac;
  k.world(1010, -150, -6, tower.position); tower.castShadow = true; k.scene.add(tower);
  const crownTex = k.canvasTex(2048, 128, (c, w, h) => {
    c.fillStyle = '#000'; c.fillRect(0, 0, w, h); c.font = '900 92px "Black Han Sans", sans-serif'; c.textBaseline = 'middle';
    c.fillStyle = '#c7a8ff'; c.shadowColor = '#8a5cff'; c.shadowBlur = 20; c.fillText('CLOSEDAI · AGI 다음 달 · CLOSEDAI · 구독하면 행복해짐 · ', 10, h / 2 + 4);
  }, true);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(16.9, 16.9, 16, 48, 1, true), new THREE.MeshBasicMaterial({ map: crownTex, toneMapped: false, side: THREE.DoubleSide }));
  crownTex.repeat.set(2, 1); crown.material.color.setScalar(1.6);
  k.world(1010, -150, 214, crown.position); k.scene.add(crown); live.crown = crownTex;
}

function buildDataCenter(k) {
  const { scene } = k;
  const concrete = new THREE.MeshStandardMaterial({ map: k.photo('concrete_diff.jpg', { rep: [0.06, 0.06] }), color: '#b7b4b2', roughness: 0.85 });
  const g = new THREE.Group();
  const L = 150, D = 52, H = 17;
  const hall = new THREE.Mesh(new THREE.BoxGeometry(D, H, L), concrete); hall.position.set(D / 2, H / 2, 0); hall.castShadow = hall.receiveShadow = true; g.add(hall);
  // louvres and the sign on the street face
  const louvre = k.canvasTex(512, 128, (c, w, h) => { c.fillStyle = '#3b3e44'; c.fillRect(0, 0, w, h); for (let y = 4; y < h; y += 10) { c.fillStyle = '#1b1d21'; c.fillRect(0, y, w, 5); } }, true);
  louvre.repeat.set(10, 1);
  const lv = new THREE.Mesh(new THREE.PlaneGeometry(L - 10, 5), new THREE.MeshStandardMaterial({ map: louvre, metalness: 0.6, roughness: 0.5 })); lv.position.set(-0.05, 9, 0); lv.rotation.y = -Math.PI / 2; g.add(lv);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(54, 5.6), new THREE.MeshBasicMaterial({ map: k.textTex('CLOSEDAI · STARGATE SF', '#b48cff', { w: 2048, h: 200, size: 150, bg: '#0a0812' }), toneMapped: false }));
  sign.material.color.setScalar(1.5); sign.position.set(-0.1, 14, 0); sign.rotation.y = -Math.PI / 2; g.add(sign);
  // cooling units on the roof
  const unit = new THREE.CylinderGeometry(3.2, 3.6, 4, 24), grill = new THREE.CircleGeometry(3, 24);
  const unitMat = new THREE.MeshStandardMaterial({ color: '#d5d7d9', metalness: 0.5, roughness: 0.4 });
  const grillMat = new THREE.MeshStandardMaterial({ color: '#202226', metalness: 0.7, roughness: 0.5 });
  for (let i = 0; i < 10; i++) for (const x of [14, 36]) {
    const z = -L / 2 + 10 + i * 14;
    const u = new THREE.Mesh(unit, unitMat); u.position.set(x, H + 2, z); u.castShadow = true; g.add(u);
    const gr = new THREE.Mesh(grill, grillMat); gr.rotation.x = -Math.PI / 2; gr.position.set(x, H + 4.02, z); g.add(gr);
    live.steam.push({ g, x, y: H + 4.5, z, t: Math.random() * 4 });
  }
  // coolant pipes along the kerb, leaking
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, L, 16), new THREE.MeshStandardMaterial({ color: '#5aa0c8', metalness: 0.7, roughness: 0.3 })); pipe.rotation.x = Math.PI / 2; pipe.position.set(-2, 0.7, 0); g.add(pipe);
  k.world(1020, ROAD_HALF + 8, 0, g.position); g.rotation.y = k.frame(1020).yaw; scene.add(g);
  // steam sprites
  const steamTex = softTex(k, 0.9);
  for (const st of live.steam) { st.sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0.4, color: '#f2f4f6' })); g.add(st.sp); }
  // the puddles: coolant glowing on the asphalt
  const pTex = k.canvasTex(256, 256, (c, w, h) => {
    const gr = c.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(120,240,255,0.95)'); gr.addColorStop(0.7, 'rgba(60,200,255,0.75)'); gr.addColorStop(1, 'rgba(40,160,255,0)');
    c.fillStyle = gr; c.beginPath(); for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI * 2, r = w * (0.36 + Math.random() * 0.12); c.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r); } c.fill();
  });
  const pm = new THREE.MeshStandardMaterial({ map: pTex, transparent: true, depthWrite: false, roughness: 0.04, metalness: 0.2, emissive: '#2fd0ff', emissiveMap: pTex, emissiveIntensity: 0.9 });
  for (const q of PUDDLES) scene.add(new THREE.Mesh(k.ribbon(q.s - q.l, q.s + q.l, q.d - q.w, q.d + q.w, 1, () => 0.03), pm));
  live.puddles = pm;
}

function buildLombard(k) {
  const { scene } = k;
  const brick = new THREE.MeshStandardMaterial({ map: k.photo('sf_brick_diff.jpg', { rep: [6, 1] }), normalMap: k.photo('sf_brick_nor.jpg', { srgb: false, rep: [6, 1] }), color: '#b06a5a', roughness: 0.85 });
  const rd = new THREE.Mesh(k.ribbon(1212, 1358, -ROAD_HALF, ROAD_HALF, 1, () => 0.03, 4), brick); rd.receiveShadow = true; scene.add(rd);
  // hedges and hydrangeas along both edges
  const hedge = new THREE.BoxGeometry(1, 1, 1); hedge.translate(0, 0.5, 0);
  const n = 2 * 75;
  const hm = new THREE.InstancedMesh(hedge, new THREE.MeshStandardMaterial({ map: k.photo('sf_grass_diff.jpg', { rep: [1, 1] }), color: '#4f7a3a', roughness: 1 }), n);
  const flower = new THREE.IcosahedronGeometry(0.42, 0);
  const fm = new THREE.InstancedMesh(flower, new THREE.MeshStandardMaterial({ roughness: 0.8 }), n * 3);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
  let i = 0, j = 0;
  for (let s = 1214; s < 1356 && i < n; s += 2) for (const side of [-1, 1]) {
    if (i >= n) break;
    q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, k.frame(s).yaw);
    k.world(s, side * (ROAD_HALF + 0.9), 0.1, p); m4.compose(p, q, sc.set(1.6, 1.0, 2.1)); hm.setMatrixAt(i++, m4);
    for (let f = 0; f < 3 && j < n * 3; f++) {
      k.world(s + (Math.random() - 0.5) * 1.8, side * (ROAD_HALF + 0.9 + (Math.random() - 0.5) * 1.2), 1.1, p); m4.compose(p, q, sc.setScalar(0.7 + Math.random() * 0.6)); fm.setMatrixAt(j, m4);
      fm.setColorAt(j++, col.set(['#e2457a', '#c03a5a', '#8a5ad0', '#ff8ab0', '#f2f2f2'][(Math.random() * 5) | 0]));
    }
  }
  hm.castShadow = true; scene.add(hm, fm);
  k.addBillboard(1205, -ROAD_HALF - 6, 6, 'LOMBARD ST', '#ffc83d', 9, 2.4);
}

function buildLamps(k) {
  const mat = new THREE.MeshStandardMaterial({ color: '#2f3a36', metalness: 0.6, roughness: 0.5 });
  const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.2, 1.2), toneMapped: false });
  const pole = new THREE.CylinderGeometry(0.1, 0.16, 7.5, 8); pole.translate(0, 3.75, 0);
  const head = new THREE.SphereGeometry(0.32, 12, 8);
  const list = [];
  for (let s = 40; s < B0; s += 36) if (!nearCrossing(s, 6)) for (const side of [-1, 1]) list.push([s + (side > 0 ? 18 : 0), side * (ROAD_HALF + 0.8), 0.18, 7.5]);
  for (let s = B0 + 20; s < B1; s += 50) for (const side of [-1, 1]) list.push([s, side * 13.1, 0.2, 8]);
  const pm = new THREE.InstancedMesh(pole, mat, list.length), hm = new THREE.InstancedMesh(head, glow, list.length);
  const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  list.forEach(([s, d, y, h], i) => {
    k.world(s, d, y, p); m4.compose(p, q, sc.set(1, h / 7.5, 1)); pm.setMatrixAt(i, m4);
    k.world(s, d, y + h + 0.1, p); m4.compose(p, q, sc.setScalar(1)); hm.setMatrixAt(i, m4);
  });
  pm.castShadow = true; k.scene.add(pm, hm);
}

// Monterey cypress clumps: Presidio, Marina edge, the Marin headlands
function buildTrees(k) {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) { const n = 0.7 + hash(pos.getX(i) * 3.1, pos.getZ(i) * 2.7) * 0.6; pos.setXYZ(i, pos.getX(i) * n, pos.getY(i) * n * 0.75, pos.getZ(i) * n); }
  geo.computeVertexNormals();
  const trunk = new THREE.CylinderGeometry(0.25, 0.4, 1, 6); trunk.translate(0, 0.5, 0);
  const list = [];
  for (let i = 0; i < 700; i++) {
    const s = 1390 + Math.random() * 420, d = -(ROAD_HALF + 8 + Math.pow(Math.random(), 1.4) * 500);
    list.push([s, d, 0.1 + THREE.MathUtils.smoothstep(-d, 60, 600) * 70 * noise(s / 120, d / 120)]);
  }
  for (let i = 0; i < 900; i++) {
    const s = B1 + 10 + Math.random() * 1200, side = Math.random() < 0.5 ? -1 : 1, d = side * (ROAD_HALF + 6 + Math.pow(Math.random(), 1.5) * 600);
    if (noise(s / 90, d / 90) < 0.45) continue;
    list.push([s, d, marinY(s, d) - 0.3]);
  }
  const crowns = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: '#2f4a2c', roughness: 1 }), list.length * 2);
  const trunks = new THREE.InstancedMesh(trunk, new THREE.MeshStandardMaterial({ color: '#4a3a30', roughness: 1 }), list.length);
  const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), col = new THREE.Color();
  list.forEach(([s, d, y], i) => {
    const h = 5 + Math.random() * 8, r = 3 + Math.random() * 4;
    k.world(s, d, y, p); q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, Math.random() * 6); m4.compose(p, q, sc.set(1, h * 0.6, 1)); trunks.setMatrixAt(i, m4);
    for (let c = 0; c < 2; c++) {
      k.world(s + (Math.random() - 0.5) * r, d + (Math.random() - 0.5) * r, y + h * (0.6 + c * 0.25), p); m4.compose(p, q, sc.set(r * (1.3 - c * 0.4), r * 0.55, r * (1.1 - c * 0.3))); crowns.setMatrixAt(i * 2 + c, m4);
      crowns.setColorAt(i * 2 + c, col.setHSL(0.27 + Math.random() * 0.06, 0.32, 0.16 + Math.random() * 0.08));
    }
  });
  crowns.castShadow = true; crowns.receiveShadow = true; k.scene.add(crowns, trunks);
}

// ---------- the Golden Gate ----------
const ORANGE = '#c0412f';
function buildBridge(k) {
  const { scene } = k;
  const steel = new THREE.MeshStandardMaterial({ color: ORANGE, metalness: 0.55, roughness: 0.55, envMapIntensity: 0.9 });
  const steelDark = new THREE.MeshStandardMaterial({ color: '#8a2c22', metalness: 0.5, roughness: 0.6, side: THREE.DoubleSide });
  const concrete = new THREE.MeshStandardMaterial({ map: k.photo('concrete_diff.jpg', { rep: [0.1, 0.1] }), color: '#a7a19b', roughness: 0.9 });
  // deck: sidewalks, railings, the stiffening truss under it
  for (const side of [-1, 1]) {
    const [a, b] = side < 0 ? [-13.6, -ROAD_HALF] : [ROAD_HALF, 13.6];
    scene.add(new THREE.Mesh(k.ribbon(B0 - 40, B1 + 40, a, b, 4, () => 0.2, 4), concrete));
  }
  const railTex = k.canvasTex(256, 64, (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = '#fff'; c.fillRect(0, 0, w, 7); c.fillRect(0, h - 6, w, 6); for (let x = 0; x < w; x += 16) c.fillRect(x, 0, 6, h); }, true);
  const railMat = new THREE.MeshStandardMaterial({ map: railTex, color: ORANGE, alphaTest: 0.5, metalness: 0.5, roughness: 0.5, side: THREE.DoubleSide });
  const trussTex = k.canvasTex(256, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h); c.strokeStyle = '#fff'; c.lineWidth = 12;
    c.strokeRect(6, 6, w - 12, h - 12); c.beginPath(); c.moveTo(0, h); c.lineTo(w / 2, 0); c.lineTo(w, h); c.moveTo(w / 2, 0); c.lineTo(w / 2, h); c.stroke();
  }, true);
  const trussMat = new THREE.MeshStandardMaterial({ map: trussTex, color: ORANGE, alphaTest: 0.5, metalness: 0.5, roughness: 0.55, side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    scene.add(new THREE.Mesh(k.wall(B0 - 20, B1 + 20, side * 13.6, 4, () => 0.2, () => 1.35, 1.3), railMat));
    scene.add(new THREE.Mesh(k.wall(B0 - 20, B1 + 20, side * 13.4, 4, () => -7.6, () => -0.3, 7.3), trussMat));
    scene.add(new THREE.Mesh(k.wall(B0 - 20, B1 + 20, side * 13.75, 4, () => -0.6, () => 0.25, 1), steel));
  }
  scene.add(new THREE.Mesh(k.ribbon(B0 - 20, B1 + 20, -13.6, 13.6, 6, () => -0.45, 6), steelDark));
  scene.add(new THREE.Mesh(k.ribbon(B0 - 20, B1 + 20, -13.4, 13.4, 6, () => -7.6, 6), steelDark));

  // towers
  for (const sT of [T1, T2]) {
    const g = new THREE.Group();
    const box = (w, h, d, x, y, z, m = steel) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; g.add(b); return b; };
    for (const side of [-1, 1]) {
      const x = side * CABLE_D;
      box(10, 5, 14, x, -DECK - 1, 0, concrete);              // pier
      // the leg in four tapering pitches, each with recessed panels
      const levels = [-DECK + 1.5, 16, 34, 48, TOWER_H - 2];
      for (let i = 0; i < 4; i++) {
        const y0 = levels[i], y1 = levels[i + 1], t = i / 4;
        const w = 3.4 - t * 0.9, dpt = 6.2 - t * 1.6;
        box(w, y1 - y0, dpt, x, (y0 + y1) / 2, 0);
        for (const z of [-dpt * 0.26, dpt * 0.26]) box(w * 0.4, (y1 - y0) * 0.82, 0.3, x + side * w * 0.34, (y0 + y1) / 2, z + Math.sign(z) * dpt * 0.24, steelDark);
      }
      box(2.8, 2.6, 5.2, x, TOWER_H - 1.0, 0);                // saddle housing
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 0.3, 0.2), toneMapped: false })); beacon.position.set(x, TOWER_H + 0.6, 0); g.add(beacon);
    }
    // portal struts between the legs (art-deco stepped)
    for (const [y, hh] of [[17.5, 3.2], [35.5, 2.8], [49.2, 2.4], [TOWER_H - 3.2, 2.2]]) {
      box(2 * CABLE_D - 2, hh, 3.2, 0, y, 0);
      for (let x = -CABLE_D + 3; x <= CABLE_D - 3; x += 2.4) box(0.5, hh * 0.7, 0.3, x, y, 1.75, steelDark);
    }
    k.world(sT, 0, 0, g.position); g.rotation.y = k.frame(sT).yaw; scene.add(g);
  }

  // main cables + the wide on-ramps that funnel onto them
  for (const side of [-1, 1]) {
    const pts = [];
    for (let s = A1; s <= A2; s += 4) pts.push(k.world(s, side * cableD(s), cableY(s) - CABLE_R));
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, CABLE_R, 14, false), steel);
    tube.castShadow = true; scene.add(tube);
    for (const [a, b] of [[A1, A1 + 58], [A2 - 58, A2]]) {
      const ramp = strip(k, a, b, 1, (s) => [side * cableD(s) - cableW(s) * 0.92, side * cableD(s) + cableW(s) * 0.92, cableY(s) + 0.02]);
      scene.add(new THREE.Mesh(ramp, new THREE.MeshStandardMaterial({ map: k.M.ramp.map, roughness: 0.5, metalness: 0.3, side: THREE.DoubleSide })));
    }
    // anchorage blocks
    for (const s of [A1, A2]) { const b = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 8), concrete); k.world(s + (s === A1 ? -3 : 3), side * 10.4, -1.2, b.position); b.rotation.y = k.frame(s).yaw; scene.add(b); }
  }
  // suspender ropes
  const ss = [];
  for (let s = A1 + 60; s < A2 - 60; s += 12) if (Math.abs(s - T1) > 6 && Math.abs(s - T2) > 6) ss.push(s);
  const rope = new THREE.CylinderGeometry(0.07, 0.07, 1, 5); rope.translate(0, 0.5, 0);
  const ropes = new THREE.InstancedMesh(rope, steel, ss.length * 2);
  const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  ss.forEach((s, i) => { for (const [j, side] of [[0, -1], [1, 1]]) { k.world(s, side * (CABLE_D - 0.2), -0.4, p); m4.compose(p, q, sc.set(1, cableY(s) - CABLE_R * 1.8 + 0.4, 1)); ropes.setMatrixAt(i * 2 + j, m4); } });
  scene.add(ropes);
}
// a ribbon whose edges and height vary along s: fn(s) -> [dL, dR, y]
function strip(k, s0, s1, step, fn) {
  const pos = [], idx = [], uv = [], v = new THREE.Vector3();
  const n = Math.ceil((s1 - s0) / step);
  for (let i = 0; i <= n; i++) {
    const s = s0 + (s1 - s0) * i / n, [l, r, y] = fn(s);
    k.world(s, l, y, v); pos.push(v.x, v.y, v.z); uv.push(0, s / 4);
    k.world(s, r, y, v); pos.push(v.x, v.y, v.z); uv.push(1, s / 4);
    if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

function buildWater(k) {
  // ripples: a tiling normal map from summed waves, scrolled every frame
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
  nor.colorSpace = THREE.NoColorSpace; nor.repeat.set(140, 140);
  const mat = new THREE.MeshPhysicalMaterial({ color: '#16424f', metalness: 0.1, roughness: 0.14, normalMap: nor, normalScale: new THREE.Vector2(0.5, 0.5), envMapIntensity: 1.25, clearcoat: 0.6, clearcoatRoughness: 0.2 });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), mat); sea.rotation.x = -Math.PI / 2;
  const c = k.world(2350, 0, -DECK - 1); sea.position.copy(c); sea.receiveShadow = true; k.scene.add(sea);
  live.water = nor;
  // Alcatraz out in the bay
  const isl = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#6b5f50', roughness: 1 }));
  isl.scale.set(120, 22, 55); k.world(1650, 760, -elev(1650) - 1.2, isl.position); k.scene.add(isl);
  const cell = new THREE.Mesh(new THREE.BoxGeometry(70, 12, 22), new THREE.MeshStandardMaterial({ color: '#cfc5b6', roughness: 0.8 })); k.world(1650, 760, -elev(1650) + 24, cell.position); cell.rotation.y = 0.4; k.scene.add(cell);
  const lh = new THREE.Mesh(new THREE.CylinderGeometry(2, 3, 26, 10), cell.material); k.world(1620, 735, -elev(1620) + 30, lh.position); k.scene.add(lh);
}

function marinY(s, d) {
  const a = Math.abs(d);
  return -0.2 + THREE.MathUtils.smoothstep(a, 16, 240) * (24 + 110 * noise(s / 260, d / 260) + 40 * noise(s / 70, d / 70)) + THREE.MathUtils.smoothstep(s, 3150, 3900) * 90 * THREE.MathUtils.smoothstep(a, 10, 400);
}
function buildMarin(k, grass, rock) {
  // the headlands: golden-green grass over rock, rising into Mount Tam
  const g = grass.clone();
  g.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.45, 0.4, 0.15))) * vec3(1.2, 1.05, 0.6), 0.55);'); };
  for (const side of [-1, 1]) {
    const [l, r] = side < 0 ? [-1600, -(ROAD_HALF + 1)] : [ROAD_HALF + 1, 1600];
    const m = new THREE.Mesh(k.grid(B1, 4400, l, r, 14, 12, marinY, 1), g); m.receiveShadow = true; k.scene.add(m);
  }
  void rock;
}

function softTex(k, a = 0.8) {
  return k.canvasTex(128, 128, (c, w, h) => {
    for (let i = 0; i < 9; i++) {
      const x = w * (0.3 + Math.random() * 0.4), y = h * (0.35 + Math.random() * 0.3), r = w * (0.2 + Math.random() * 0.25);
      const gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(255,255,255,${a * 0.5})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
    }
  });
}
// Karl the Fog: banks rolling through the towers and over the headlands
function buildFog(k) {
  const tex = softTex(k, 0.9);
  for (let i = 0; i < 46; i++) {
    const s = 1950 + Math.random() * 1500, side = Math.random() < 0.5 ? -1 : 1, d = side * (30 + Math.random() * 520);
    const y = i < 10 ? -DECK + 2 + Math.random() * 6 : 30 + Math.random() * 70;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.32 + Math.random() * 0.25, color: '#fff1ea' }));
    const size = 120 + Math.random() * 200; sp.scale.set(size, size * 0.42, 1);
    k.world(s, d, y, sp.position); k.scene.add(sp); live.fog.push({ sp, x0: sp.position.x, ph: Math.random() * 6 });
  }
}

function tick(time) {
  if (live.water) { live.water.offset.set(time * 0.004, time * 0.0025); }
  if (live.crown) live.crown.offset.x = -time * 0.03;
  if (live.puddles) live.puddles.emissiveIntensity = 0.75 + Math.sin(time * 3) * 0.2;
  for (const f of live.fog) f.sp.position.x = f.x0 + Math.sin(time * 0.05 + f.ph) * 25;
  for (const st of live.steam) {
    const t = (time * 0.35 + st.t) % 1;
    st.sp.position.set(st.x, st.y + t * 14, st.z); st.sp.scale.setScalar(4 + t * 10); st.sp.material.opacity = 0.45 * (1 - t);
  }
}

// ---------- a cable car (procedural, Powell-line style) ----------
function makeCableCar() {
  const g = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color: '#8b1e1c', metalness: 0.1, roughness: 0.4, clearcoat: 0.8 }); paint.name = 'paint';
  const cream = new THREE.MeshPhysicalMaterial({ color: '#efe4c8', roughness: 0.45, clearcoat: 0.5 });
  const wood = new THREE.MeshStandardMaterial({ color: '#6a4426', roughness: 0.6 });
  const brass = new THREE.MeshStandardMaterial({ color: '#c9a24a', metalness: 1, roughness: 0.25 });
  const dark = new THREE.MeshStandardMaterial({ color: '#1a1a1c', roughness: 0.6 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#141a20', roughness: 0.04, metalness: 0.2, clearcoat: 1, envMapIntensity: 1.4 });
  const tail = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 0.15, 0.2), toneMapped: false }); tail.name = 'tail';
  const head = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.8, 2.2), toneMapped: false });
  const L = 8.3, W = 2.45, box = (w, h, d, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; g.add(b); return b; };
  box(W, 0.18, L, 0, 0.72, 0, wood);                                 // floor
  box(W + 0.06, 0.5, L, 0, 0.5, 0, dark);                            // running board / chassis
  box(W, 0.75, L * 0.44, 0, 1.2, 0, paint);                          // closed saloon, lower panels
  box(W - 0.04, 1.1, L * 0.44, 0, 2.15, 0, glass);                   // saloon windows
  for (let i = 0; i <= 5; i++) box(W + 0.02, 1.12, 0.09, 0, 2.15, -L * 0.22 + i * L * 0.088, cream);
  box(W + 0.04, 0.22, L * 0.44, 0, 2.8, 0, cream);                   // letter board
  for (const z of [-1, 1]) {                                         // open grip sections at both ends
    box(W, 0.4, L * 0.27, 0, 1.05, z * L * 0.36, paint);
    box(W - 0.3, 0.12, L * 0.26, 0, 1.3, z * L * 0.36, wood);        // outward-facing bench
    for (const x of [-1, 1]) for (const zz of [0.25, 0.47]) box(0.07, 1.9, 0.07, x * (W / 2 - 0.05), 1.95, z * L * zz, brass);
    box(W, 0.9, 0.12, 0, 1.4, z * (L / 2 - 0.05), paint);            // dash
    box(1.1, 0.35, 0.05, 0, 2.6, z * (L / 2 - 0.02), cream);         // route sign
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), z < 0 ? head : tail); lamp.position.set(0, 1.55, z * (L / 2 + 0.02)); g.add(lamp);
  }
  // roof with a raised clerestory down the middle
  box(W + 0.3, 0.14, L + 0.2, 0, 2.98, 0, cream);
  box(1.3, 0.34, L * 0.84, 0, 3.2, 0, cream);
  box(1.32, 0.16, L * 0.84, 0, 3.13, 0, glass);
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.25, 12), brass); bell.position.set(0, 3.5, -L * 0.3); g.add(bell);
  // trucks
  for (const z of [-L * 0.3, L * 0.3]) for (const x of [-0.72, 0.72]) {
    const hub = new THREE.Group(); hub.name = 'wheel'; hub.userData.r = 0.33; hub.position.set(x, 0.33, z);
    const sp = new THREE.Group(); const wm = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.12, 14), dark); wm.rotation.z = Math.PI / 2; sp.add(wm); hub.add(sp); g.add(hub);
  }
  g.userData = { kind: 'cablecar', cfg: { colors: ['#8b1e1c'] }, size: new THREE.Vector3(W, 3.5, L) };
  return g;
}

// a hype airship drifting over the city, trailing AGI promises
function buildBlimp(k) {
  const a = k.prop('airship', 110); if (!a) return;
  const g = new THREE.Group(); g.add(a);
  for (const sx of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(56, 9), new THREE.MeshBasicMaterial({ map: k.textTex('AGI 다음 달 출시 · 진짜로', '#ffd23f', { w: 1024, h: 160, size: 92, bg: '#141018' }), side: THREE.DoubleSide, toneMapped: false }));
    b.material.color.setScalar(1.4); b.position.set(sx * 10.6, 9, 4); b.rotation.y = sx * Math.PI / 2; g.add(b);
  }
  k.world(1150, 70, 55, g.position); g.rotation.y = k.frame(1150).yaw + 0.9; k.scene.add(g);
  live.blimp = g;
}
