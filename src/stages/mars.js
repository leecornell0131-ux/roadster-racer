// Stage 9 (final): Mars. Red dunes, the flank of Olympus Mons, dust devils, canyons in Valles Marineris
// country, the first Mars city. Dust storms roll in and out (visibility). Raptor cannons as on the Moon.
// Each event is its own route across the plains; the last one climbs Olympus Mons to the city.
// Final boss: the AGI Overlord, three tech heads fighting over one GPU mecha.
// The ending: the city switches on and the camera rises over it.
import * as THREE from 'three';
import { prop } from '../props.js';
import { shipKit } from './starbase.js';

const ROAD_HALF = 12;
const LANES = [-9, -3, 3, 9];
const sm = THREE.MathUtils.smoothstep;

// ---------- course factory ----------
// keys: the road's height profile; dunes: [s0, s1] stretches of short rollers; canyons: breaks with a
// full-width ramp before each; volcano: where Olympus Mons stands (a broad dome in the terrain);
// storms: [s0, s1] where the dust closes in; devils: whirlwinds that wander across the lanes
function areo({ finish, keys, dunes = [], canyons = [], volcano = { s: 2000, d: 900 }, storms = [], devils = [], sway = [60, 600], ramps = [], extra = [], city = false }) {
  const E0 = -600, EN = finish + 1100;
  const K = [...keys, [EN, keys.at(-1)[1]]];
  const raw = new Float32Array(EN - E0 + 1);
  for (let i = 0, k = 0; i < raw.length; i++) {
    const s = E0 + i; while (k < K.length - 2 && K[k + 1][0] < s) k++;
    const [sa, ya] = K[k], [sb, yb] = K[k + 1];
    let dn = 0; for (const [a, b] of dunes) dn += (1.6 * Math.sin(s / 34) + 1.2 * Math.sin(s / 21 + 1)) * sm(s, a, a + 100) * (1 - sm(s, b - 100, b));
    raw[i] = ya + (yb - ya) * THREE.MathUtils.clamp((s - sa) / (sb - sa), 0, 1) + dn;
  }
  const tab = new Float32Array(raw.length), RR = 14;
  for (let i = 0; i < raw.length; i++) { let a = 0, n = 0; for (let j = -RR; j <= RR; j++) { const v = raw[i + j]; if (v !== undefined) { a += v; n++; } } tab[i] = a / n; }
  const elev = (s) => { const x = THREE.MathUtils.clamp(s - E0, 0, EN - E0 - 1), i = Math.floor(x), f = x - i; return tab[i] * (1 - f) + tab[i + 1] * f; };
  return {
    finish, elev,
    gaps: canyons.map(([s0, s1]) => ({ s0, s1, respawn: s0 - 150 })),
    cx: (s) => sway[0] * Math.sin((s - 150) / sway[1]) * sm(s, 100, 600) * (1 - sm(s, finish - 350, finish - 50)),
    ramps: [...canyons.map(([s0]) => ({ s0: s0 - 24, len: 16, dL: -ROAD_HALF, dR: ROAD_HALF, h: 3.6 })), ...ramps],
    hazards: devils.map((s, i) => ({ s, w: 0.5 + (i % 3) * 0.15, ph: i * 1.9, A: 11, l: 3, dL: 99, dR: 99, h: 4, active: true, text: ['먼지 회오리!', '시야 0 · 급감속', '#ffb37a'] })),
    pickups: [
      ...canyons.flatMap(([s0, s1]) => range(0, s1 - s0 + 20, 8).map((x) => ['coin', s0 - 10 + x, 0, 3 + 0.2 * x - 0.2 * x * x / (s1 - s0 + 20)])),
      ...extra,
    ],
    trafficMaxS: finish + 100,
    finishDelay: city ? 9000 : 900,
    mv: { canyons, volcano, storms, city: city ? { s: finish + 160, d: 0 } : null },
  };
}
const NOBOSS = { boss: null, legend: null };
const POSTER = { s: 400, d: 2, y: 0, cam: { back: 11, side: -5, y: 2, ahead: 30, lookSide: 3, lookY: 4, fov: 58 } };

// event 1: the colony errands: dunes, one canyon, Olympus Mons on the horizon
const COLONY = areo({ finish: 3300, keys: [[-600, 0], [900, 0], [1300, 14], [1700, 14], [2100, 2], [3400, 0]], dunes: [[200, 800], [2300, 2800]],
  canyons: [[1960, 2020]], volcano: { s: 1800, d: 2600 }, storms: [[1150, 1650]], devils: [1250, 1500, 2600], sway: [80, 520],
  extra: [['h100', 700, 9, 1.6], ['air', 1400, -3, 1.2], ['h100', 2300, 3, 1.6], ['air', 3000, -9, 1.2],
    ...range(300, 800, 14).map((s, i) => ['coin', s, [-3, 3, 9, 3, -3, -9][i % 6], 1.2])] });
// event 2: rogue AI drones over the plains near the volcano's foot; shoot them down
const SWARM = areo({ finish: 3400, keys: [[-600, 0], [1200, 0], [1500, 22], [1900, 26], [2300, 6], [3500, 0]], dunes: [[2500, 3200]],
  canyons: [[1000, 1060]], volcano: { s: 1700, d: 1500 }, storms: [[2400, 2900]], devils: [1600, 1800, 2700], sway: [50, 700],
  extra: [['air', 600, 3, 1.2], ['h100', 1400, -9, 1.6], ['air', 2200, 9, 1.2], ['h100', 3100, -3, 1.6]] });
// event 3: Valles Marineris: three canyons, mesas, a long downhill run, made for flips
const VALLES = areo({ finish: 3300, keys: [[-600, 30], [400, 30], [900, 18], [1500, 18], [2000, 6], [2600, 6], [3000, 0], [3400, 0]],
  dunes: [[1550, 1900]], canyons: [[700, 770], [1350, 1430], [2350, 2440]], volcano: { s: 3000, d: -2800 }, storms: [[1700, 2100]], devils: [1100, 1250, 2900, 3050], sway: [45, 380],
  ramps: [{ s0: 1050, len: 16, dL: -9, dR: -3, h: 4 }, { s0: 1800, len: 18, dL: 3, dR: 9, h: 4.4 }, { s0: 2750, len: 16, dL: -3, dR: 3, h: 3.4 }],
  extra: [['h100', 1000, 3, 1.6], ['air', 1700, -9, 1.2], ['h100', 2600, 9, 1.6], ['air', 3100, 3, 1.2],
    ...range(1550, 1900, 14).map((s, i) => ['coin', s, i % 2 ? 6 : -6, 1.2])] });
// event 4: the original climb over Olympus Mons to the city, the boss and the ending
const FINAL = areo({ finish: 3400, keys: [[-600, 0], [1150, 0], [1880, 58], [1930, 62], [1990, 56], [2060, 60], [2110, 63], [2190, 52], [2700, 4], [2900, 0], [4500, 0]],
  dunes: [[250, 1050]], canyons: [[2930, 3000]], storms: [[700, 1300], [2350, 2900]], devils: [1500, 1700, 2300, 2450, 2600, 2800], city: true,
  ramps: [
    { s0: 560, len: 16, dL: 3, dR: 9, h: 3 },
    { s0: 820, len: 16, dL: -9, dR: -3, h: 3 },
    { s0: 1960, len: 18, dL: -12, dR: -5, h: 4.4 },   // over the caldera dip: the legend hangs above it
    { s0: 3200, len: 16, dL: -3, dR: 3, h: 3 },
  ],
  extra: [
    ...range(260, 960, 14).map((s, i) => ['coin', s, [-3, 3, 9, 3, -3, -9][i % 6], 1.2]),
    ...range(1250, 1850, 20).map((s, i) => ['coin', s, i % 2 ? 6 : -6, 1.2]),
    ...range(3250, 3390, 10).map((s, i) => ['coin', s, [9, 3, -3, -9][i % 4], 1.2]),
    ['h100', 700, 9, 1.6], ['h100', 1600, 0, 1.6], ['h100', 2500, -9, 1.6], ['h100', 3100, 9, 1.6],
    ['air', 500, -3, 1.2], ['air', 1400, 3, 1.2], ['air', 2200, -9, 1.2], ['air', 2850, 3, 1.2],
    ['gpu', 400, 9, 1.4], ['gpu', 1100, -9, 1.4], ['gpu', 1800, 3, 1.4], ['gpu', 2400, 9, 1.4], ['gpu', 3300, -3, 1.4],
  ] });

export default {
  id: 'mars', num: 9, name: '화성',
  roadHalf: ROAD_HALF, lanes: LANES,
  gravity: 16,
  gun: { rate: 9, dmg: 1, heat: 3.5 },
  ...FINAL,
  splashY: () => -18,
  legend: { s: 2040, d: -9, y: 12 },
  road: { tex: 'mars', yellow: false, dashes: [0.25, 0.5, 0.75], tint: 'rgba(40,16,8,0.35)' },
  env: {
    bg: false, hdri: '', sun: ['#ffe4c8', 2.7], hemi: ['#e2a682', '#5a2816', 0.75],
    sunDir: [-0.5, 0.42, -0.6],
    sky: { top: [0.28, 0.16, 0.1], mid: [0.62, 0.4, 0.26], hor: [0.92, 0.66, 0.46], low: [0.5, 0.3, 0.2], glow: [0.75, 0.82, 1] },
    fog: ['#c08060', 300, 2600], exposure: 0.95, bloom: 0.3,
  },
  traffic: {
    cybertruck: { car: 'cybertruck', name: '화성 사이버트럭', speed: [22, 27], n: 6, color: '#d8d8d4' },
    optimus: { make: makeOptimusCart, name: '옵티머스 배달 카트', speed: [15, 19], n: 4, color: '#eeeeee' },
  },
  boss: 'agi',
  heads: ['altman', 'zuck'],
  props: ['optimus', 'starship'],
  radio: [
    [20, '화성이다! 마지막 스테이지. 먼지폭풍 오면 시야가 확 줄어.'],
    [380, '모래 언덕 지나면 올림푸스 몬스. 태양계에서 제일 높은 산이야!'],
    [1180, '오르막 시작! 부스트 아껴 뒀다가 써.'],
    [1450, '먼지 회오리 조심! 갈색 기둥에 들어가면 확 느려져.'],
    [1900, '정상 칼데라! 왼쪽 점프대로 날면 블랙웰 칩!'],
    [2250, '내리막! 속도 붙는다.'],
    [2820, '마리너스 협곡! 점프대 타고 건너!'],
    [3200, '저기 화성 첫 도시! 마지막 스퍼트!'],
  ],
  lines: { finish: '도착! 화성 첫 도시 완성. 인류는 이제 다행성 종족이다!', fall: ['협곡 추락!', '+3초', '붉은 먼지 털고 다시!'] },
  stars: { time: 80, text: '완주 · 보스 격추 · 80초 이내 또는 퍼펙트 랜딩 4회', perfect: 4 },
  poster: { s: 1340, d: 0, y: 2.5, boss: [30, 18, 12, -0.4], cam: { back: 12, side: -6, y: 1, ahead: 46, lookSide: 2, lookY: 13, fov: 62 } },
  text: {
    eyebrow: 'STAGE 09 · MARS · FINAL', title: 'MARS', sub: 'AGI 오버로드와 최후의 결전',
    tip: '<b>TIP</b> 최종 보스 <b>AGI 오버로드</b>는 머리 셋이 번갈아 조종해요. <b>빛나는 머리</b>가 약점이고 캐논이 알아서 노려요. 셋이 <b>주도권 싸움</b>을 하면 무방비! 먼지폭풍이 오면 시야가 줄어요.',
    tweet: '화성에 도시 하나 세우는 중. 와이파이는 스타링크, 배송은 아직도 배송스 기다리는 중.',
    meta: '올림푸스 몬스 · 화성 · 리트윗 1,200만', load: '산소 발생기 가동 중 · 돔 압력 맞추는 중',
    hud: 'STAGE 9 · MARS', clear: 'FINAL STAGE CLEAR', clearTitle: '화성 첫 도시 건설!',
  },
  // chapter 9: three jobs on their own routes, then the climb over Olympus Mons with the final boss
  events: [
    {
      id: 'colony', name: '화성 콜로니 배송', ...COLONY, ...NOBOSS,
      brief: '<b>배송</b> 첫 화성 정착민들의 심부름. 산소 공장, 감자 농장, 스타링크 화성 지점, 화성 1호 학교. 초록 정차 구역에서 <b>↓ 브레이크</b>. 먼지폭풍이 오면 앞이 안 보이니 네비를 믿어요.',
      mission: { type: 'deliver', time: 110, allowMiss: 1, stops: [
        { s: 1000, d: 9, name: '산소 공장', thanks: '숨 쉬는 건 유료 구독이에요', line: '산소 공장 직원 내렸어. 산소도 월 구독제래. 프리미엄은 질소 빼 준대.' },
        { s: 1800, d: -9, name: '감자 농장', thanks: '감자 말고 다른 것도 키우고 싶어요', line: '감자 농부님 내렸다. 영화 보고 왔는데 진짜 감자밖에 안 자란대.' },
        { s: 2450, d: 9, name: '스타링크 화성 지점', thanks: '핑 20분이에요. 빛의 속도 탓이래요' },
        { s: 3020, d: -9, name: '화성 1호 학교', thanks: '첫 등교예요! 학생은 저 하나', line: '화성 첫 학생 내렸어. 반장, 부반장, 전교 1등 다 혼자 한대.' },
      ] },
      radio: [[20, '화성 콜로니 배송 알바야. 손님 넷. 저 멀리 큰 산이 올림푸스 몬스야.'], [1100, '먼지폭풍 온다! 앞이 안 보이면 네비 표지판 봐.'], [1880, '협곡이야! 점프대 타고 넘어!']],
      lines: { finish: '배송 끝. 팁은 감자 한 포대. 화성에선 이게 화폐래.', failed: '정착민들이 산소 아끼느라 기다리기 힘들대… 다시 가자.' },
      poster: POSTER, finishText: 'FINISH · 화성 1호 학교',
      text: { clear: 'DELIVERY DONE', clearTitle: '배송 완료' },
    },
    {
      id: 'swarm', name: '폭주 AI 드론 사냥', ...SWARM, ...NOBOSS,
      brief: '<b>사냥</b> 데이터센터에서 탈출한 AI 드론들이 화성 평원을 점령했어요. <b>F 꾹</b>(휴대폰은 🔥)으로 랩터 캐논 연사. 가까운 드론을 자동 조준해요. 과열되지 않게 끊어 쏘세요.',
      mission: { type: 'hunt', time: 66, need: 13, hp: 5, name: 'AI 드론', make: makeDrone,
        // squadrons of three over the plains: the cannon can't clear every one before it gets away
        targets: [320, 800, 1250, 1700, 2150, 2600, 3050].flatMap((s0, i) => [[s0, -6, 5], [s0 + 30, 6, 6.5], [s0 + 60, (i % 2 ? 1 : -1) * 2, 8]]) },
      radio: [[20, 'AI 드론들이 탈출했대. 다들 자기가 AGI래. 랩터 캐논 F 꾹!'], [950, '협곡 지나면 오르막이야. 쏘면서 올라가!'], [2350, '먼지폭풍 속에서도 캐논은 자동 조준이야. 계속 쏴!']],
      lines: { finish: '드론 정리 끝! 다들 "나는 그냥 언어 모델이에요" 하면서 떨어졌어.', failed: '드론이 너무 많이 도망갔어. 끊어 쏘면서 과열 피해 봐.' },
      poster: POSTER, finishText: 'FINISH · 드론 사냥 끝',
      text: { clear: 'DRONES DOWN', clearTitle: '드론 사냥 성공' },
    },
    {
      id: 'valles', name: '마리너스 협곡 스턴트', ...VALLES, ...NOBOSS, legend: { s: 1860, d: 6, y: 13 },
      brief: '<b>스턴트</b> 마리너스 협곡 내리막. 협곡 셋을 점프대로 넘으며 <b>배럴롤</b>, 퍼펙트 착지, 먼지 회오리 사이 아슬 추월로 <b>콤보 배수</b>를 키워요.',
      mission: { type: 'stunt', scores: [5000, 11000, 20000] },
      radio: [[20, '마리너스 협곡이야. 지구 그랜드캐니언의 다섯 배래. 묘기 부리기 딱이지.'], [620, '첫 협곡! 날면서 롤!'], [1650, '먼지폭풍 구간. 회오리 사이로 아슬하게 빠지면 점수야.'], [2280, '마지막 협곡 길어. 점프 꾹!']],
      lines: { finish: '협곡 정복! 화성 첫 스턴트 기록이야. 관객은 탐사 로버 하나.', failed: '점수가 모자랐어. 협곡 위에서 롤 더 돌려 봐.' },
      poster: POSTER, finishText: 'FINISH · 협곡 끝',
      text: { clear: 'SHOW TIME', clearTitle: '스턴트 쇼 성공' },
    },
    {
      id: 'final', name: 'AGI 오버로드 최후의 결전',
      brief: '<b>최종 보스전</b> 올림푸스 몬스를 넘어 화성 첫 도시로. 머리 셋이 번갈아 조종하는 <b>AGI 오버로드</b>의 빛나는 머리를 랩터 캐논으로 노려요. 셋이 주도권 싸움을 하면 무방비!',
      mission: { type: 'boss', time: 80, perfect: 4 },
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
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();
const live = { k: null, devils: [], dust: null, city: null, cut: null, fog: null, domes: [], lights: [], fireworks: [] };

// ---------- terrain ----------
// world height away from the road: the volcano's flank rises on the right, dunes and mesas elsewhere
function field(s, d) {
  const a = Math.abs(d);
  let y = 4 * (noise(s / 160, d / 160) - 0.5) + 1.5 * (noise(s / 35, d / 35) - 0.5);
  // the volcano is a broad dome centred off to the right of the summit stretch
  const vs = (s - VOLCANO.s) / 1400, vd = (d - VOLCANO.d) / 1400, vr = Math.sqrt(vs * vs + vd * vd);
  y += 260 * Math.max(0, 1 - vr) ** 1.6;
  // mesas on the horizon
  y += 90 * sm(a, 600, 1400) * sm(noise(s / 500, d / 400), 0.45, 0.6);
  return y;
}
// the course being built (set from the event's fields in build)
let FINISH_S, CANYONS, CITY, VOLCANO, STORMS, DEVILS, elev;
const inCanyon = (s, pad = 1) => CANYONS.some(([a, b]) => s > a - pad && s < b + pad);
function groundRel(s, d) {
  if (inCanyon(s)) return -60;
  const a = Math.abs(d);
  if (a < ROAD_HALF + 0.6) return -0.12;
  // the road is cut into the slope: banks blend into the natural ground
  const b = sm(a, ROAD_HALF + 0.6, 60);
  return THREE.MathUtils.lerp(-0.12, field(s, d) - elev(s), b);
}

// ---------- traffic: an Optimus robot riding a little delivery cart ----------
function makeOptimusCart() {
  const g = new THREE.Group();
  const white = new THREE.MeshPhysicalMaterial({ color: '#eeeeee', roughness: 0.3, clearcoat: 0.8 }); white.name = 'paint';
  const black = new THREE.MeshPhysicalMaterial({ color: '#0d0e10', roughness: 0.15, metalness: 0.4, clearcoat: 1 });
  const grey = new THREE.MeshStandardMaterial({ color: '#7a7e84', metalness: 0.8, roughness: 0.35 });
  const box = (w, h, d, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; g.add(b); return b; };
  box(1.6, 0.35, 2.6, 0, 0.55, 0, grey);
  box(1.4, 0.7, 1.2, 0, 1.08, 0.6, new THREE.MeshStandardMaterial({ color: '#b88a58', roughness: 0.9 }));
  for (const z of [-0.9, 0.9]) for (const x of [-0.8, 0.8]) {
    const hub = new THREE.Group(); hub.name = 'wheel'; hub.userData.r = 0.33; hub.position.set(x, 0.33, z);
    const sp = new THREE.Group(); const w = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.25, 14), black); w.rotation.z = Math.PI / 2; sp.add(w); hub.add(sp); g.add(hub);
  }
  // the robot: the real Optimus standing on the deck when it loaded, else a sketch of one
  const bot = prop('optimus', 1.73);
  if (bot) { bot.position.set(0, 0.72, -0.55); g.add(bot); }
  else {
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.6, 4, 12), white); torso.position.set(0, 1.55, -0.55); g.add(torso);
  const pelvis = box(0.5, 0.25, 0.3, 0, 1.0, -0.55, black);
  void pelvis;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), white); head.scale.set(1, 1.15, 1.05); head.position.set(0, 2.28, -0.55); g.add(head);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.201, 16, 12, -0.9, 1.8, 0.6, 1.2), black); face.scale.copy(head.scale); face.position.copy(head.position); face.rotation.y = Math.PI; g.add(face);
  for (const x of [-0.42, 0.42]) { const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.6, 4, 8), white); arm.position.set(x, 1.5, -0.85); arm.rotation.x = 0.9; g.add(arm); }
  }
  box(1.1, 0.06, 0.06, 0, 1.3, -1.15, grey);
  const tl = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 0.15, 0.2), toneMapped: false }); tl.name = 'tail';
  for (const x of [-0.65, 0.65]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.03), tl); t.position.set(x, 0.6, 1.31); g.add(t); }
  g.userData = { kind: 'optimus', cfg: { colors: ['#eeeeee'] }, size: new THREE.Vector3(1.7, 2.5, 2.7) };
  return g;
}

// ---------- a rogue AI drone (hunt targets): a quadcopter with a GPU belly and one glowing eye ----------
function makeDrone() {
  const g = new THREE.Group();
  const shell = new THREE.MeshPhysicalMaterial({ color: '#2a2d33', metalness: 0.7, roughness: 0.3, clearcoat: 0.8 });
  const fin = new THREE.MeshStandardMaterial({ color: '#76b900', metalness: 0.5, roughness: 0.4 });
  const glowM = (r, gg, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, gg, b), toneMapped: false });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.7, 1.4, 6, 16), shell); body.rotation.x = Math.PI / 2; body.castShadow = true; g.add(body);
  const gpu = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.35, 1.6), fin); gpu.position.y = -0.7; g.add(gpu);
  for (let i = 0; i < 5; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.04, 0.1), shell); f.position.set(0, -0.62, -0.6 + i * 0.3); g.add(f); }
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), glowM(4, 0.4, 0.3)); eye.position.set(0, 0.1, 1.2); g.add(eye);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.06, 8, 24), glowM(0.4, 1.6, 2.6)); ring.position.copy(eye.position); g.add(ring);
  const rotorM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 0.6, 0.65), transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });
  for (const [x, z] of [[-1.3, -1], [1.3, -1], [-1.3, 1], [1.3, 1]]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(x, z) * 1.6, 0.12, 0.18), shell); arm.position.set(x / 2, 0.25, z / 2); arm.rotation.y = -Math.atan2(z, x); g.add(arm);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.3, 10), shell); hub.position.set(x, 0.35, z); g.add(hub);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.85, 24), rotorM); disc.rotation.x = -Math.PI / 2; disc.position.set(x, 0.52, z); g.add(disc);
  }
  return g;
}

// ---------- build ----------
let MAT = null;
function build(k) {
  live.k = k;
  ({ finish: FINISH_S, hazards: DEVILS, elev } = k.ST);
  ({ canyons: CANYONS, city: CITY, volcano: VOLCANO, storms: STORMS } = k.ST.mv);
  MAT = {
    ground: new THREE.MeshStandardMaterial({ map: k.photo('marssand_diff.jpg'), normalMap: k.photo('marssand_nor.jpg', { srgb: false }), color: '#e0b39a', roughness: 1, vertexColors: true }),
    rock: new THREE.MeshStandardMaterial({ map: k.photo('marsrock_diff.jpg'), normalMap: k.photo('marsrock_nor.jpg', { srgb: false }), color: '#c87a5a', roughness: 0.95 }),
    far: new THREE.MeshStandardMaterial({ map: k.photo('marsrock_diff.jpg'), color: '#d08a66', roughness: 1, vertexColors: true }),
    white: new THREE.MeshStandardMaterial({ color: '#f0f0ee', roughness: 0.4, metalness: 0.15 }),
    metal: new THREE.MeshStandardMaterial({ color: '#9aa0a8', metalness: 1, roughness: 0.35 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#d8ecff', metalness: 0, roughness: 0.05, transmission: 0, transparent: true, opacity: 0.35, clearcoat: 1, envMapIntensity: 1.5, side: THREE.DoubleSide, depthWrite: false }),
    dark: new THREE.MeshStandardMaterial({ color: '#202226', roughness: 0.6, metalness: 0.4 }),
  };
  live.fog = { near: k.scene.fog.near, far: k.scene.fog.far, col: k.scene.fog.color.clone() };
  buildTerrain(k);
  buildRocks(k);
  buildLandingZone(k);
  if (CITY) buildCity(k);
  buildCannons(k);
  buildDevils(k);
  buildDust(k);
  buildSky(k);
  k.finishArch(k.ST.finishText || 'FINISH · 화성 첫 도시');
}

function shade(geo, fn) {
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) { const [r, g, b] = fn(-pos.getZ(i), pos.getX(i), pos.getY(i)); col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = b; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}
function tint(s, x) {
  const n = noise(s / 220, x / 220), n2 = noise(s / 26, x / 26);
  const v = 0.7 + 0.3 * n + 0.1 * (n2 - 0.5), dark = sm(noise(s / 90 + 7, x / 90), 0.6, 0.8) * 0.25;
  return [v - dark * 0.9, (v - dark) * 0.92, (v - dark) * 0.86];
}
function buildTerrain(k) {
  const st = k.IS_MOBILE ? 6 : 4;
  const near = k.grid(-450, FINISH_S + 520, -180, 180, st, st, groundRel, 10);
  shade(near, tint);
  const m = new THREE.Mesh(near, MAT.ground); m.receiveShadow = true; k.scene.add(m);
  for (const side of [-1, 1]) {
    const dL = side < 0 ? -1700 : 170, dR = side < 0 ? -170 : 1700;
    const geo = k.grid(-1200, FINISH_S + 1500, dL, dR, 40, 30, (s, d) => field(s, d) - elev(s) - 0.6, 80);
    shade(geo, (s, x, y) => { const v = 0.6 + 0.3 * noise(s / 500, x / 500); return [v, v * 0.88, v * 0.8]; });
    const f = new THREE.Mesh(geo, MAT.far); f.receiveShadow = true; k.scene.add(f);
  }
}
function buildRocks(k) {
  const r = rnd(13), geo = new THREE.IcosahedronGeometry(1, 1), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const f = 0.7 + hash(p.getX(i) * 3, p.getY(i) * 5 + p.getZ(i)) * 0.6; p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * 0.75, p.getZ(i) * f); }
  geo.computeVertexNormals();
  const N = k.IS_MOBILE ? 600 : 1400, im = new THREE.InstancedMesh(geo, MAT.rock, N);
  let n = 0;
  for (let i = 0; i < N * 3 && n < N; i++) {
    const s = -300 + r() * (FINISH_S + 600), d = (r() < 0.5 ? -1 : 1) * (ROAD_HALF + 2 + r() ** 1.4 * 170);
    if (inCanyon(s, 4)) continue;
    if (CITY && s > CITY.s - 260 && Math.abs(d) < 160) continue;
    const sc = 0.15 + r() ** 3 * 2.8;
    k.world(s, d, groundRel(s, d) + sc * 0.2, _p); _q.setFromEuler(_e.set(r() * 3, r() * 6, r() * 3));
    im.setMatrixAt(n++, _m.compose(_p, _q, _s.set(sc * (0.8 + r() * 0.7), sc, sc * (0.8 + r() * 0.7))));
  }
  im.count = n; im.castShadow = im.receiveShadow = true; k.scene.add(im);
}
// two Starships on the landing zone behind the start
function buildLandingZone(k) {
  const { makeShip, R } = shipKit(k);
  for (const [s, d, rot] of [[-90, -40, 0.3], [-160, 34, 1.4]]) {
    const ship = makeShip({ tiles: true }); const g = new THREE.Group(); g.add(ship);
    k.world(s, d, groundRel(s, d) + 3, g.position); g.rotation.y = rot; k.scene.add(g);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, l = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 7, 8), MAT.metal); l.position.set(Math.cos(a) * (R + 1.2), -1.2, Math.sin(a) * (R + 1.2)); l.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35); g.add(l); }
    const scorch = new THREE.Mesh(new THREE.CircleGeometry(16, 32), new THREE.MeshBasicMaterial({ color: '#2a140c', transparent: true, opacity: 0.55, depthWrite: false })); scorch.rotation.x = -Math.PI / 2; scorch.position.y = -3.2; g.add(scorch);
  }
}
// the first Mars city: domes (lit from inside at the end), habitats, greenhouses, solar fields, ships
function buildCity(k) {
  const { makeShip } = shipKit(k);
  const city = new THREE.Group(); k.world(CITY.s, CITY.d, 0, city.position); city.rotation.y = k.frame(CITY.s).yaw; k.scene.add(city);
  const r = rnd(21);
  const ringMat = new THREE.MeshStandardMaterial({ color: '#d8d6d0', metalness: 0.6, roughness: 0.35 });
  const lightMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.25, 0.15), toneMapped: false });
  const greenMat = new THREE.MeshStandardMaterial({ color: '#2f6b2a', roughness: 0.8, emissive: '#183812', emissiveIntensity: 0.3 });
  const domes = [[0, -60, 42], [-80, -120, 30], [85, -110, 34], [-150, -40, 22], [150, -30, 24], [-40, -200, 26], [60, -210, 22]];
  for (const [x, z, rad] of domes) {
    const y = groundRel(CITY.s - z, x) - 0.5;
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(rad + 0.6, rad + 1.2, 2.4, 48), ringMat); ring.position.set(x, y + 1.2, z); ring.receiveShadow = true; city.add(ring);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(rad, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2), MAT.glass); dome.position.set(x, y + 2.4, z); city.add(dome);
    const frame = new THREE.Mesh(new THREE.SphereGeometry(rad + 0.05, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#cfd2d8', metalness: 0.9, roughness: 0.3, wireframe: true })); frame.position.copy(dome.position); city.add(frame);
    // inside: trees and lit blocks
    const ins = new THREE.InstancedMesh(new THREE.ConeGeometry(1.4, 4, 8), greenMat, 30);
    for (let i = 0; i < 30; i++) { const a = r() * Math.PI * 2, rr = r() * rad * 0.75; _p.set(x + Math.cos(a) * rr, y + 4.4, z + Math.sin(a) * rr); ins.setMatrixAt(i, _m.compose(_p, _q.identity(), _s.setScalar(0.7 + r() * 0.8))); }
    city.add(ins);
    const blocks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lightMat, 14);
    for (let i = 0; i < 14; i++) { const a = r() * Math.PI * 2, rr = r() * rad * 0.6, h = 3 + r() * rad * 0.35; _p.set(x + Math.cos(a) * rr, y + 2.4 + h / 2, z + Math.sin(a) * rr); blocks.setMatrixAt(i, _m.compose(_p, _q.identity(), _s.set(3 + r() * 4, h, 3 + r() * 4))); }
    city.add(blocks);
    const glow = new THREE.PointLight('#ffd8a0', 0, rad * 3, 1.5); glow.position.set(x, y + rad * 0.5, z); city.add(glow);
    live.domes.push({ dome, glow, rad });
  }
  live.lights.push(lightMat);
  // tubes between domes
  for (let i = 1; i < domes.length; i++) {
    const [x0, z0] = domes[0], [x1, z1] = domes[i], len = Math.hypot(x1 - x0, z1 - z0);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, len, 16), ringMat); t.rotation.z = Math.PI / 2; t.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    t.position.set((x0 + x1) / 2, groundRel(CITY.s - (z0 + z1) / 2, (x0 + x1) / 2) + 1.4, (z0 + z1) / 2); city.add(t);
  }
  // solar fields
  const panel = new THREE.InstancedMesh(new THREE.BoxGeometry(4, 0.08, 2.2), new THREE.MeshStandardMaterial({ color: '#1a2a55', metalness: 0.6, roughness: 0.25 }), 240);
  let n = 0; for (const side of [-1, 1]) for (let i = 0; i < 12; i++) for (let j = 0; j < 10; j++) { _p.set(side * (60 + j * 6), 1.4, 40 + i * 5); _q.setFromEuler(_e.set(-0.5, 0, 0)); panel.setMatrixAt(n++, _m.compose(_p, _q, _s.set(1, 1, 1))); }
  city.add(panel);
  // landed ships around the city
  for (const [x, z] of [[-210, -150], [200, -170], [-120, -280], [130, -300]]) { const sh = k.prop('starship') || makeShip({ tiles: true }); sh.position.set(x, 2, z); sh.rotation.y = r() * 6; city.add(sh); }
  // the welcome sign
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(40, 7), new THREE.MeshBasicMaterial({ map: k.textTex('MARS CITY 1 · 화성 첫 도시', '#ffd28a', { w: 1024, h: 180, size: 84, bg: '#160904', frame: true }), toneMapped: false, side: THREE.DoubleSide }));
  sign.material.color.setScalar(1.5); sign.position.set(0, 14, 40); city.add(sign);
  for (const x of [-18, 18]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 14, 8), MAT.metal); p.position.set(x, 7, 40); city.add(p); }
  // fireworks for the ending (hidden)
  const fwTex = k.canvasTex(64, 64, (g) => { const r2 = g.createRadialGradient(32, 32, 0, 32, 32, 32); r2.addColorStop(0, 'rgba(255,255,255,1)'); r2.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r2; g.fillRect(0, 0, 64, 64); });
  for (let i = 0; i < 6; i++) {
    const pts = new Float32Array(90 * 3), geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    const col = new THREE.Color().setHSL(r(), 0.9, 0.6).multiplyScalar(4);
    const pm = new THREE.Points(geo, new THREE.PointsMaterial({ map: fwTex, color: col, size: 3.2, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    pm.visible = false; pm.frustumCulled = false; city.add(pm);
    const dirs = []; for (let j = 0; j < 90; j++) dirs.push(new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(14 + r() * 8));
    live.fireworks.push({ pm, dirs, at: new THREE.Vector3(-120 + r() * 240, 50 + r() * 40, -60 - r() * 180), t0: i * 0.7 });
  }
  live.city = city;
}
// the same Raptor cannons as on the Moon
function buildCannons(k) {
  const car = k.car; if (!car || car.userData.cannons) return;
  const steel = new THREE.MeshStandardMaterial({ color: '#cfd3d8', metalness: 1, roughness: 0.22, envMapIntensity: 1.3 });
  const dark = new THREE.MeshStandardMaterial({ color: '#2a2c30', metalness: 0.8, roughness: 0.4 });
  const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 2.2, 4.5), toneMapped: false });
  const kit = new THREE.Group(); kit.name = 'cannons';
  for (const x of [-0.95, 0.95]) {
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 2.6, 18), steel); pod.rotation.x = Math.PI / 2; pod.position.set(x, 1.05, -0.2); kit.add(pod);
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.42, 18, 1, true), new THREE.MeshStandardMaterial({ color: '#4a3a30', metalness: 0.9, roughness: 0.3, side: THREE.DoubleSide })); bell.rotation.x = Math.PI / 2; bell.position.set(x, 1.05, 1.28); kit.add(bell);
    const ring = new THREE.Mesh(new THREE.CircleGeometry(0.19, 18), glow); ring.position.set(x, 1.05, 1.27); ring.rotation.y = Math.PI; kit.add(ring);
    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.5, 10), dark); muzzle.rotation.x = Math.PI / 2; muzzle.position.set(x, 1.05, -1.7); kit.add(muzzle);
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.6), dark); strut.position.set(x * 0.92, 0.9, -0.2); kit.add(strut);
  }
  const saddle = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.06, 0.5), steel); saddle.position.set(0, 1.2, -0.1); kit.add(saddle);
  kit.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  car.add(kit); car.userData.cannons = kit;
}
function buildDevils(k) {
  const tex = k.canvasTex(128, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(190,120,80,0)'); gr.addColorStop(0.5, 'rgba(200,135,95,0.75)'); gr.addColorStop(1, 'rgba(190,120,80,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(0,0,0,${0.3 + Math.random() * 0.4})`; g.fillRect(0, Math.random() * h, w, 2 + Math.random() * 6); }
  }, true);
  for (const hz of DEVILS) {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(2.4 + i * 1.2, 0.8 + i * 0.4, 26 - i * 4, 20, 1, true), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.55 - i * 0.12, depthWrite: false, side: THREE.DoubleSide, color: '#e0a07a' }));
      m.position.y = 13 - i * 2; g.add(m);
    }
    k.scene.add(g); live.devils.push({ hz, g });
  }
}
// drifting dust around the camera; denser in the storms
function buildDust(k) {
  const N = k.IS_MOBILE ? 500 : 1200, pos = new Float32Array(N * 3), r = rnd(31);
  for (let i = 0; i < N; i++) pos.set([(r() - 0.5) * 160, r() * 40, (r() - 0.5) * 160], i * 3);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const tex = k.canvasTex(32, 32, (g) => { const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,220,190,0.9)'); gr.addColorStop(1, 'rgba(255,220,190,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); });
  const dust = new THREE.Points(geo, new THREE.PointsMaterial({ map: tex, color: '#d79a74', size: 0.5, transparent: true, opacity: 0.5, depthWrite: false }));
  dust.frustumCulled = false; k.scene.add(dust); live.dust = dust;
}
function buildSky(k) {
  // Phobos: a lumpy little moon high up, and the small Martian sun disc
  const geo = new THREE.IcosahedronGeometry(30, 3), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const f = 0.8 + 0.35 * noise(p.getX(i) * 0.08 + 3, p.getY(i) * 0.08 + p.getZ(i) * 0.05); p.setXYZ(i, p.getX(i) * f * 1.25, p.getY(i) * f, p.getZ(i) * f); }
  geo.computeVertexNormals();
  const phobos = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: k.photo('marsrock_diff.jpg'), color: '#8a7a70', roughness: 1, fog: false }));
  phobos.renderOrder = -8; k.scene.add(phobos); live.phobos = phobos;
  const glowTex = k.canvasTex(256, 256, (g) => { const r = g.createRadialGradient(128, 128, 0, 128, 128, 128); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.05, 'rgba(255,250,240,0.9)'); r.addColorStop(0.2, 'rgba(200,215,255,0.25)'); r.addColorStop(1, 'rgba(200,215,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 256, 256); });
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(4, 3.8, 3.6), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false }));
  sun.scale.setScalar(260); sun.renderOrder = -7; k.scene.add(sun); live.sun = sun;
}

// ---------- per frame ----------
const ease = (x) => x * x * (3 - 2 * x);
function tick(time, camera, info) {
  if (!live.k) return;
  const k = live.k, sCam = -camera.position.z;
  live.phobos.position.copy(camera.position).add(_p.set(0.5, 0.55, -0.67).normalize().multiplyScalar(2300)); live.phobos.rotation.y = time * 0.02;
  live.sun.position.copy(camera.position).add(_p.set(-0.5, 0.42, -0.6).normalize().multiplyScalar(2600));
  // dust storms: two big ones on the route plus a slow swell; fog closes in and turns browner
  const storm = STORMS.reduce((m, [a, b]) => Math.max(m, sm(sCam, a, a + 200) * (1 - sm(sCam, b - 150, b))), 0) * (0.75 + 0.25 * Math.sin(time * 0.7));
  const fog = k.scene.fog, F = live.fog;
  fog.near = THREE.MathUtils.lerp(F.near, 15, storm); fog.far = THREE.MathUtils.lerp(F.far, 260, storm);
  fog.color.copy(F.col).lerp(_c.set('#9a5a3a'), storm * 0.7);
  live.sun.material.opacity = 1 - storm * 0.85;
  if (live.dust) {
    live.dust.position.set(camera.position.x, camera.position.y - 8, camera.position.z);
    live.dust.material.size = 0.4 + storm * 0.9; live.dust.material.opacity = 0.3 + storm * 0.5;
    live.dust.rotation.y = time * 0.05;
  }
  for (const dv of live.devils) {
    const hz = dv.hz, dc = hz.A * Math.sin(time * hz.w + hz.ph);
    hz.dL = dc - 3.2; hz.dR = dc + 3.2;
    k.world(hz.s, dc, 0, dv.g.position);
    dv.g.children.forEach((m, i) => { m.rotation.y = time * (4 + i * 1.5); });
  }
  // the ending: lights come on in the domes, fireworks over the city
  const fin = info?.state === 'finish';
  if (fin) {
    live.cut ??= { t0: time };
    const t = time - live.cut.t0;
    const on = sm(t, 1.5, 4);
    for (const d of live.domes) d.glow.intensity = on * d.rad * 60;
    for (const m of live.lights) m.color.setRGB(0.3 + on * 3.2, 0.25 + on * 2.4, 0.15 + on * 1.2);
    for (const fw of live.fireworks) {
      const u = ((t - 2.5 - fw.t0) % 4.2) / 1.8;
      fw.pm.visible = t > 2.5 + fw.t0 && u < 1;
      if (!fw.pm.visible) continue;
      const pos = fw.pm.geometry.attributes.position;
      fw.dirs.forEach((dir, j) => pos.setXYZ(j, fw.at.x + dir.x * ease(u), fw.at.y + dir.y * ease(u) - u * u * 6, fw.at.z + dir.z * ease(u)));
      pos.needsUpdate = true; fw.pm.material.opacity = 1 - u;
    }
  } else if (live.cut) {
    live.cut = null;
    for (const d of live.domes) d.glow.intensity = 0;
    for (const m of live.lights) m.color.setRGB(0.3, 0.25, 0.15);
    for (const fw of live.fireworks) fw.pm.visible = false;
  }
}
const _c = new THREE.Color();
function finishCam(camera, time) {
  const c = live.cut; if (!c || !CITY) return false;
  const t = time - c.t0, k = live.k;
  if (t < 1.4) return false;
  // rise and swing over the city
  const u = ease(Math.min(1, (t - 1.4) / 7));
  k.world(CITY.s - 330 + u * 150, -90 + u * 160, 12 + u * 70, camera.position);
  k.world(CITY.s - 60, 0, 10, _p); camera.lookAt(_p); camera.fov = 55; camera.updateProjectionMatrix();
  return true;
}
