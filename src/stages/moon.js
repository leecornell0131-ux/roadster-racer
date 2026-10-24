// Stage 8: the Moon, Mare Tranquillitatis at low sun. Graded regolith tracks across craters (their rims
// throw the car in one-third gravity), past the Apollo 11 site, over rilles, by Jeff Baesongs' lunar
// fulfilment centre. Meteors strike marked spots. The roadster now carries two Raptor cannons off the HLS:
// hold fire for auto-aimed rapid fire (stage.gun). Each event is its own track across the mare.
// Boss: Jeff Baesongs' Late Shepherd, a rocket in a cowboy hat that drops same-day boxes and drones.
import * as THREE from 'three';
import { shipKit } from './starbase.js';
import { makeEarth, makeParcelSat } from './starlink.js';

const ROAD_HALF = 12;
const LANES = [-9, -3, 3, 9];
const HLS = { s: -70, d: -32 };
const sm = THREE.MathUtils.smoothstep;

function craterH(x, h) { // x = distance / radius
  const bowl = x < 1 ? -h * (1 - x * x) ** 1.6 : 0;
  const rim = h * 0.62 * Math.exp(-(((x - 1) / 0.2) ** 2));
  return bowl + rim;
}

// ---------- course factory ----------
// craters the road crosses ({ s, d, r, h }; their 2D bowls continue into the terrain), an optional rille
// (a channel with a full-width ramp before it), the landmarks beside the road and the meteor spots
function lunar({ finish, craters, rille = null, sway = [46, 520], apollo = null, depot = null, meteors = [], ramps = [], extra = [] }) {
  const raw = (s) => { let y = 2.5 * Math.sin(s / 260) + 1.5 * Math.sin(s / 97 + 1); for (const c of craters) y += craterH(Math.abs(s - c.s) / c.r, c.h); return y; };
  const E0 = -600, EN = finish + 800;
  const tab = new Float32Array(EN - E0 + 1); for (let i = 0; i < tab.length; i++) tab[i] = raw(E0 + i);
  const elev = (s) => { const x = THREE.MathUtils.clamp(s - E0, 0, EN - E0 - 1), i = Math.floor(x), f = x - i; return tab[i] * (1 - f) + tab[i + 1] * f; };
  return {
    finish, elev,
    gaps: rille ? [{ s0: rille[0], s1: rille[1], respawn: rille[0] - 150 }] : [],
    cx: (s) => sway[0] * Math.sin((s - 200) / sway[1]) * sm(s, 150, 600),
    ramps: [...(rille ? [{ s0: rille[0] - 22, len: 16, dL: -ROAD_HALF, dR: ROAD_HALF, h: 3.4 }] : []), ...ramps],
    // meteor strikes: a red ring marks a lane, then the impact; tick picks the lane each cycle
    hazards: meteors.map((s, i) => ({ s, l: 5, dL: 99, dR: 99, h: 3.5, period: 3.4 + (i % 2) * 0.6, on: 0.45, ph: i * 1.3, active: false, text: ['운석 직격!', '마이크로 운석 · 급감속', '#ff8a3d'] })),
    pickups: [
      ...(rille ? range(0, rille[1] - rille[0] + 18, 8).map((x) => ['coin', rille[0] - 10 + x, 0, 3 + 0.22 * x - 0.0024 * x * x]) : []),
      ...craters.flatMap((c, i) => range(0, 40, 8).map((x) => ['coin', c.s - c.r + x, LANES[(i + 2) % 4], 2.2 + 0.1 * x])),
      ...extra,
    ],
    trafficMaxS: finish + 100,
    mv: { craters, rille: rille || [1e9, 1e9], apollo, depot },
  };
}
const NOBOSS = { boss: null, legend: null };
const POSTER = { s: 400, d: 2, y: 0, cam: { back: 11, side: -5, y: 2, ahead: 30, lookSide: 3, lookY: 4, fov: 58 } };

// event 1: errands between the new bases, past the Apollo 11 site
const ARTEMIS = lunar({ finish: 3400, craters: [{ s: 700, d: 0, r: 60, h: 6 }, { s: 1500, d: -4, r: 70, h: 7 }, { s: 2620, d: 3, r: 65, h: 6 }],
  rille: [2050, 2100], sway: [60, 440], apollo: { s: 1240, d: 42 }, meteors: [1320, 2800],
  extra: [['h100', 900, 9, 1.6], ['air', 1700, -3, 1.2], ['h100', 2450, -9, 1.6], ['air', 3200, 3, 1.2]] });
// event 2: Baesongs' same-day drones swarm out of the fulfilment centre; shoot them down
const DRONES = lunar({ finish: 3300, craters: [{ s: 600, d: 0, r: 50, h: 5 }, { s: 1300, d: 5, r: 80, h: 8 }, { s: 2250, d: -3, r: 55, h: 6 }, { s: 2900, d: 0, r: 60, h: 5 }],
  rille: [1720, 1780], sway: [40, 600], depot: { s: 1000, d: -95 }, meteors: [1450, 2500],
  extra: [['air', 450, 3, 1.2], ['h100', 1600, 9, 1.6], ['air', 2100, -9, 1.2], ['h100', 3000, -3, 1.6]] });
// event 3: a rally against souped-up rovers: no rille (rovers can't jump), wide craters, meteor showers
const RALLY = lunar({ finish: 3500, craters: [{ s: 800, d: 0, r: 90, h: 5 }, { s: 1750, d: 4, r: 70, h: 5 }, { s: 2750, d: -4, r: 100, h: 6 }],
  sway: [75, 380], meteors: [1200, 1950, 2300, 3100],
  extra: [['air', 600, -9, 1.2], ['h100', 1400, 3, 1.6], ['air', 2200, 9, 1.2], ['h100', 3200, -3, 1.6]] });
// event 4: the original track with the boss
const SHEPHERD = lunar({ finish: 3200, craters: [{ s: 900, d: 0, r: 72, h: 7 }, { s: 1640, d: 6, r: 60, h: 6 }, { s: 2460, d: -4, r: 80, h: 8 }],
  rille: [2050, 2112], apollo: { s: 1250, d: -40 }, depot: { s: 2640, d: 95 }, meteors: [1420, 1560, 1830, 2700, 2880],
  ramps: [
    { s0: 520, len: 16, dL: -9, dR: -3, h: 3 },
    { s0: 1206, len: 18, dL: -12, dR: -5, h: 4.4 },   // Apollo hop: the legend floats over the flag
    { s0: 2300, len: 16, dL: 3, dR: 9, h: 3 },
    { s0: 2960, len: 16, dL: -3, dR: 3, h: 3 },
  ],
  extra: [
    ...range(140, 460, 16).map((s, i) => ['coin', s, i % 4 < 2 ? 3 : -3, 1.2]),
    ...range(2700, 3150, 18).map((s, i) => ['coin', s, [9, 3, -3, -9][i % 4], 1.2]),
    ['h100', 700, 9, 1.6], ['h100', 1900, -9, 1.6], ['h100', 2800, 0, 1.6],
    ['air', 600, 3, 1.2], ['air', 1350, 9, 1.2], ['air', 1990, -3, 1.2], ['air', 2600, -9, 1.2],
    ['gpu', 380, -9, 1.4], ['gpu', 1100, 3, 1.4], ['gpu', 1750, -3, 1.4], ['gpu', 2250, 9, 1.4], ['gpu', 3050, -9, 1.4],
  ] });

export default {
  id: 'moon', num: 8, name: '달',
  roadHalf: ROAD_HALF, lanes: LANES,
  gravity: 11,
  gun: { rate: 9, dmg: 1, heat: 3.5 },
  ...SHEPHERD,
  splashY: () => -14,
  legend: { s: 1290, d: -11, y: 12 },
  road: { tex: 'moon', yellow: false, dashes: [0.25, 0.5, 0.75], tint: 'rgba(26,24,24,0.42)' },
  env: {
    bg: false, hdri: '', sun: ['#fffaf2', 3.6], hemi: ['#14161c', '#5d5a55', 0.32],
    sunDir: [-0.82, 0.24, 0.3],
    sky: { top: [0.003, 0.003, 0.006], mid: [0.006, 0.006, 0.01], hor: [0.03, 0.03, 0.035], low: [0.18, 0.17, 0.16], glow: [1, 0.95, 0.88] },
    fog: ['#050506', 1800, 5200], exposure: 1.0, bloom: 0.32,
  },
  traffic: {
    rover: { make: makeLRV, name: '아폴로 월면차 (빈티지)', speed: [15, 19], n: 4, color: '#c9c2b0' },
    parcel: { make: () => makeParcelSat('#b88a58', '당일배송'), name: '배송 로버', speed: [19, 24], n: 6, color: '#b88a58' },
  },
  boss: 'bezos',
  heads: ['bezos'],
  radio: [
    [20, '달 도착! HLS에서 랩터 엔진 두 개 떼다 붙였어. 이제 쏠 수 있다!'],
    [300, '중력이 약해서 크레이터 가장자리에서 붕 떠. 착지는 점프 꾹!'],
    [640, '저기 하늘에서 로켓이 내려온다… 카우보이 모자 쓴 로켓?!'],
    [1150, '왼쪽이 아폴로 11호 착륙지! 국기 옆 점프대로 날면 블랙웰 칩!'],
    [1390, '빨간 원은 운석 낙하 지점이야. 피해!'],
    [1950, '앞에 협곡! 점프대 타고 건너!'],
    [2560, '오른쪽은 배송스 달 물류센터. 당일배송이라는데 지구 기준 3일 걸린대.'],
    [3040, '결승선 보인다! 다음은 화성이다!'],
  ],
  lines: { finish: '달 정복! 다음 목적지는 화성!', fall: ['협곡 추락!', '+3초', '레골리스 털고 다시 가자.'] },
  stars: { time: 72, text: '완주 · 보스 격추 · 72초 이내 또는 퍼펙트 랜딩 4회', perfect: 4 },
  poster: { s: 890, d: 2, y: 5, boss: [34, 4, 13, 0.1], cam: { back: 12, side: -6, y: 1.2, ahead: 40, lookSide: 3, lookY: 12, fov: 62 } },
  text: {
    eyebrow: 'STAGE 08 · THE MOON', title: 'MOON', sub: '늦게 온 배송왕',
    tip: '<b>TIP</b> 이제 <b>랩터 캐논</b>이 달렸어요. <b>F 꾹</b>(휴대폰은 🔥 버튼)으로 연사, 너무 오래 쏘면 과열돼요. 드론부터 떨구고 보스가 <b>착륙 연습</b>할 때 집중 사격! 빨간 원이 생기면 운석이 떨어져요.',
    tweet: '달에 먼저 온 사람: 나. 배송스는 늦게 오면서 모자는 챙겨 옴.',
    meta: '고요의 바다 · 달 · 리트윗 510만', load: '레골리스 다지는 중 · 랩터 캐논 장전 중',
    hud: 'STAGE 8 · THE MOON', clear: 'STAGE 08 CLEAR', clearTitle: '달 정복',
  },
  // chapter 8: three jobs on their own tracks across the mare, then the original track with the boss
  events: [
    {
      id: 'artemis', name: '달 기지 배송', ...ARTEMIS, ...NOBOSS,
      brief: '<b>배송</b> 새로 생긴 달 기지들에 손님을 내려 줘요. 아르테미스 기지, 헬륨-3 광산, 달 먼지 세탁소, 월면 부동산. 초록 정차 구역에서 <b>↓ 브레이크</b>. 중력이 약해서 크레이터 가장자리에선 붕 떠요.',
      mission: { type: 'deliver', time: 95, allowMiss: 1, stops: [
        { s: 1050, d: -9, name: '아르테미스 기지', thanks: '예산 삭감 전에 와 주셔서 다행이에요', line: '아르테미스 기지 직원 내렸어. 발사가 또 연기됐대.' },
        { s: 1850, d: 9, name: '헬륨-3 광산', thanks: '핵융합 발전소는 아직 30년 남았대요' },
        { s: 2350, d: -9, name: '달 먼지 세탁소', thanks: '레골리스는 절대 안 지워져요', line: '달 먼지는 정전기 때문에 옷에 딱 붙는대. 세탁소 사장님 울고 있어.' },
        { s: 3060, d: 9, name: '월면 부동산', thanks: '지구 보이는 방, 1억 달러부터예요' },
      ] },
      radio: [[20, '달 택시 알바야. 기지 네 군데. 랩터 캐논은 오늘은 그냥 장식이야.'], [1150, '오른쪽에 아폴로 11호 착륙지! 국기가 아직 서 있어.'], [1970, '앞에 협곡! 점프대 타고 넘어!']],
      lines: { finish: '배송 끝. 팁은 헬륨-3 한 통. 쓸 데는 없대.', failed: '달 기지 손님들이 기다리다 산소가 떨어질 뻔했어… 다시 가자.' },
      poster: POSTER, finishText: 'FINISH · 월면 부동산',
      text: { clear: 'DELIVERY DONE', clearTitle: '배송 완료' },
    },
    {
      id: 'drones', name: '당일배송 드론 사냥', ...DRONES, ...NOBOSS,
      brief: '<b>사냥</b> 배송스 물류센터에서 당일배송 드론이 쏟아져 나와요. <b>F 꾹</b>(휴대폰은 🔥)으로 랩터 캐논을 쏘면 가까운 드론을 자동 조준해요. 과열되지 않게 끊어 쏘고, 지나친 드론은 도망가요.',
      mission: { type: 'hunt', time: 62, need: 12, hp: 6, name: '당일배송 드론', make: () => makeParcelSat('#b88a58', '당일배송'),
        // pairs: the cannon has to switch fast to get both before they get away
        targets: [300, 650, 1000, 1350, 1950, 2250, 2600, 2950, 3200].flatMap((s0, i) => [[s0, (i % 2 ? 1 : -1) * 6, 5], [s0 + 30, (i % 2 ? -1 : 1) * 4, 7]]) },
      radio: [[20, '배송스 물류센터에서 드론이 떼로 나온다! 랩터 캐논 F 꾹! 자동 조준이야.'], [700, '너무 오래 쏘면 과열돼. 끊어서 쏴.'], [1650, '앞에 협곡! 점프하면서도 쏠 수 있어.'], [2600, '드론 아직 남았어. 다 떨어뜨려!']],
      lines: { finish: '드론 격추 완료! 배송스 본사에 "배송 지연" 문자 보냈어.', failed: '드론이 너무 많이 도망갔어. 끊어 쏘면서 과열을 피해 봐.' },
      poster: POSTER, finishText: 'FINISH · 드론 사냥 끝',
      text: { clear: 'DRONES DOWN', clearTitle: '드론 사냥 성공' },
    },
    {
      id: 'rally', name: '월면차 랠리', ...RALLY, ...NOBOSS,
      traffic: { rover: { make: makeLRV, name: '아폴로 월면차 (빈티지)', speed: [15, 19], n: 5, color: '#c9c2b0' } },
      brief: '<b>레이스</b> 고요의 바다 랠리. 상대는 튜닝한 빈티지 월면차 셋. 넓은 크레이터를 넘을 때 퍼펙트 착지로 부스트를 챙기고, 운석이 떨어지는 빨간 원은 피해요.',
      mission: { type: 'rivals', time: 64, perfect: 2, rivals: [
        { type: 'rover', name: '아폴로 15호 (튜닝)', label: 'APOLLO 15', speed: 55.5, d: -3, s: 24, color: '#e0d8c4' },
        { type: 'rover', name: '아폴로 16호 (튜닝)', label: 'APOLLO 16', speed: 57, d: 9, s: 30, color: '#d8c890' },
        { type: 'rover', name: '아폴로 17호 (터보)', label: 'APOLLO 17', speed: 58.5, d: -9, s: 36, color: '#f2b632', tagColor: '#ffc83d' },
      ] },
      radio: [[20, '1972년식 월면차들이 랠리 걸어왔어. 50년 동안 튜닝만 했대.'], [1150, '운석 소나기 구간! 빨간 원 피해!'], [2600, '마지막 큰 크레이터야. 퍼펙트 착지하면 부스트!']],
      lines: { finish: '랠리 우승! 월면차 할아버지들이 박물관으로 돌아갔어.', failed: '50년 된 차한테 졌어… 크레이터에서 퍼펙트 착지 부스트 챙겨.' },
      poster: POSTER, finishText: 'FINISH · 고요의 바다 랠리',
      text: { clear: 'WINNER', clearTitle: '랠리 우승' },
    },
    {
      id: 'shepherd', name: '레이트 셰퍼드 격추',
      brief: '<b>보스전</b> 카우보이 모자를 쓴 배송스의 로켓이 상자와 드론을 떨궈요. 드론부터 쏘고, 보스가 <b>착륙 연습</b>할 때 랩터 캐논을 집중 사격해요.',
      mission: { type: 'boss', time: 72, perfect: 4 },
    },
  ],
  build,
  tick,
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
const live = { k: null, earth: null, atmo: null, sun: null, meteors: [], beacons: null };

// ---------- terrain: the road's own profile near it, a cratered mare beyond, highlands on the horizon ----------
// the course being built (set from the event's fields in build)
let FINISH_S, RILLE, APOLLO, DEPOT, METEORS, elev, FIELD;
function setCourse(ST) {
  ({ finish: FINISH_S, hazards: METEORS, elev } = ST);
  ({ rille: RILLE, apollo: APOLLO, depot: DEPOT } = ST.mv);
  const r = rnd(42); FIELD = [...ST.mv.craters];
  for (let i = 0; i < 70; i++) {
    const s = -400 + r() * (FINISH_S + 1100), d = (r() < 0.5 ? -1 : 1) * (40 + r() * 600), rad = 8 + r() ** 2 * 70;
    FIELD.push({ s, d, r: rad, h: rad * (0.12 + r() * 0.06) });
  }
}
function field(s, d) {
  let y = 3 * (noise(s / 180, d / 180) - 0.5) + 1.2 * (noise(s / 40, d / 40) - 0.5);
  const a = Math.abs(d);
  y += 70 * sm(a, 320, 1100) * (0.4 + noise(s / 380, d / 300)) + 30 * sm(a, 700, 1300) * noise(s / 90, d / 120);
  for (const c of FIELD) { const dx = (s - c.s) / c.r, dz = (d - c.d) / c.r, q = dx * dx + dz * dz; if (q < 2.4) y += craterH(Math.sqrt(q), c.h); }
  return y;
}
function groundRel(s, d) {
  if (s > RILLE[0] - 1 && s < RILLE[1] + 1) return -40; // the rille: a steep channel across everything
  const a = Math.abs(d);
  if (a < ROAD_HALF + 0.6) return -0.12;
  const b = sm(a, ROAD_HALF + 0.6, 46);
  return THREE.MathUtils.lerp(-0.12, field(s, d) - elev(s), b);
}

// ---------- traffic: a vintage lunar roving vehicle ----------
function makeLRV() {
  const g = new THREE.Group();
  const frame = new THREE.MeshStandardMaterial({ color: '#c9c2b0', metalness: 0.7, roughness: 0.4 }); frame.name = 'paint';
  const dark = new THREE.MeshStandardMaterial({ color: '#2a2a2e', roughness: 0.7 });
  const mesh = new THREE.MeshStandardMaterial({ color: '#9a958a', metalness: 0.8, roughness: 0.5, wireframe: false });
  const gold = new THREE.MeshStandardMaterial({ color: '#c89a3a', metalness: 1, roughness: 0.35 });
  const box = (w, h, d, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; g.add(b); return b; };
  box(1.9, 0.12, 3.0, 0, 0.75, 0, frame);
  for (const x of [-0.45, 0.45]) { box(0.5, 0.08, 0.55, x, 0.95, 0.15, dark); box(0.5, 0.5, 0.06, x, 1.2, 0.45, dark); }
  box(1.6, 0.35, 0.6, 0, 0.98, 1.25, gold);
  box(0.5, 0.4, 0.4, 0, 1.0, -1.2, frame);
  for (const z of [-1.15, 1.15]) for (const x of [-1, 1]) {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.25, 6, 1, true, 0, Math.PI), frame); f.rotation.z = Math.PI / 2; f.position.set(x * 0.95, 0.72, z); g.add(f);
    const hub = new THREE.Group(); hub.name = 'wheel'; hub.userData.r = 0.41; hub.position.set(x * 0.95, 0.41, z);
    const sp = new THREE.Group(); const w = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.09, 8, 18), mesh); w.rotation.y = Math.PI / 2; sp.add(w);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.1, 12), dark); disc.rotation.z = Math.PI / 2; sp.add(disc); hub.add(sp); g.add(hub);
  }
  // high-gain antenna umbrella on a mast
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6), frame); mast.position.set(0.5, 1.5, -1.1); g.add(mast);
  const pivot = new THREE.Group(); pivot.name = 'pivot'; pivot.position.set(0.5, 2.05, -1.1); g.add(pivot);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 6, 0, Math.PI * 2, 0, 0.9), new THREE.MeshStandardMaterial({ color: '#e8e4da', roughness: 0.5, side: THREE.DoubleSide })); dish.rotation.x = Math.PI * 0.75; pivot.add(dish);
  const tl = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 0.15, 0.2), toneMapped: false }); tl.name = 'tail';
  for (const x of [-0.8, 0.8]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.04), tl); t.position.set(x, 0.75, 1.52); g.add(t); }
  g.userData = { kind: 'lrv', cfg: { colors: ['#c9c2b0'] }, size: new THREE.Vector3(2.0, 1.4, 3.1) };
  return g;
}

// ---------- build ----------
let MAT = null;
function foilTex(k, base = '#c8952e') {
  const r = rnd(9);
  return k.canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 300; i++) { const x = r() * w, y = r() * h, a = r() * Math.PI, l = 8 + r() * 40, v = r(); g.strokeStyle = v > 0.5 ? `rgba(255,235,160,${0.2 + v * 0.35})` : `rgba(70,40,5,${0.3 + v * 0.3})`; g.lineWidth = 1 + r() * 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  }, true);
}
function build(k) {
  live.k = k;
  setCourse(k.ST);
  const foil = foilTex(k);
  MAT = {
    ground: new THREE.MeshStandardMaterial({ map: k.photo('moondust_diff.jpg', { rep: [1, 1] }), normalMap: k.photo('moondust_nor.jpg', { srgb: false }), normalScale: new THREE.Vector2(1.2, 1.2), color: '#c8c4bc', roughness: 1, vertexColors: true }),
    far: new THREE.MeshStandardMaterial({ map: k.photo('moon_diff.jpg', { rep: [1, 1] }), color: '#b4b0a8', roughness: 1, vertexColors: true }),
    rock: new THREE.MeshStandardMaterial({ map: k.photo('moonrock_diff.jpg'), color: '#a8a49c', roughness: 0.95 }),
    foil: new THREE.MeshStandardMaterial({ map: foil, bumpMap: foil, bumpScale: 2, metalness: 1, roughness: 0.35 }),
    white: new THREE.MeshStandardMaterial({ color: '#eef0f2', roughness: 0.45, metalness: 0.1 }),
    metal: new THREE.MeshStandardMaterial({ color: '#9aa0a8', metalness: 1, roughness: 0.35 }),
    dark: new THREE.MeshStandardMaterial({ color: '#202226', roughness: 0.6, metalness: 0.4 }),
  };
  k.sky.visible = false;
  const stars = k.photo(k.IS_MOBILE ? 'space_stars_m.jpg' : 'space_stars.jpg', { rep: [1, 1] });
  stars.wrapS = stars.wrapT = THREE.ClampToEdgeWrapping; stars.mapping = THREE.EquirectangularReflectionMapping;
  k.scene.background = stars; k.scene.backgroundIntensity = 0.45;
  buildTerrain(k);
  buildRocks(k);
  buildBeacons(k);
  if (APOLLO) buildApollo(k);
  if (DEPOT) buildDepot(k);
  buildHLS(k);
  buildCannons(k);
  buildSky(k);
  buildMeteors(k);
  k.finishArch(k.ST.finishText || 'FINISH · 다음은 화성');
}

function shade(geo, k, fn) {
  // per-vertex tint: darker mare patches, bright ejecta around crater rims
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) { const v = fn(-pos.getZ(i), pos.getX(i)); col[i * 3] = v; col[i * 3 + 1] = v * 0.99; col[i * 3 + 2] = v * 0.97; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}
function tone(sWorld, x) {
  const n = noise(sWorld / 260, x / 260), n2 = noise(sWorld / 30, x / 30);
  return 0.62 + 0.38 * n + 0.1 * (n2 - 0.5);
}
function buildTerrain(k) {
  const st = k.IS_MOBILE ? 6 : 4;
  const near = k.grid(-450, FINISH_S + 700, -170, 170, st, st, groundRel, 9);
  shade(near, k, tone);
  const m = new THREE.Mesh(near, MAT.ground); m.receiveShadow = true; k.scene.add(m);
  // highlands to the horizon
  for (const side of [-1, 1]) {
    const dL = side < 0 ? -1500 : 160, dR = side < 0 ? -160 : 1500;
    const geo = k.grid(-1200, FINISH_S + 1500, dL, dR, 40, 30, (s, d) => field(s, d) - elev(s) - 0.5, 60);
    shade(geo, k, (s, x) => 0.55 + 0.35 * noise(s / 500, x / 500));
    const f = new THREE.Mesh(geo, MAT.far); f.receiveShadow = true; k.scene.add(f);
  }
}
function buildRocks(k) {
  const r = rnd(3), geo = new THREE.IcosahedronGeometry(1, 1), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const f = 0.7 + hash(p.getX(i) * 3, p.getY(i) * 5 + p.getZ(i)) * 0.6; p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * 0.7, p.getZ(i) * f); }
  geo.computeVertexNormals();
  const N = k.IS_MOBILE ? 500 : 1100, im = new THREE.InstancedMesh(geo, MAT.rock, N);
  let n = 0;
  for (let i = 0; i < N * 3 && n < N; i++) {
    const s = -300 + r() * (FINISH_S + 700), d = (r() < 0.5 ? -1 : 1) * (ROAD_HALF + 2 + r() ** 1.5 * 160);
    if (s > RILLE[0] - 4 && s < RILLE[1] + 4) continue;
    const sc = 0.15 + r() ** 3 * 2.4;
    k.world(s, d, groundRel(s, d) + sc * 0.2, _p); _q.setFromEuler(_e.set(r() * 3, r() * 6, r() * 3));
    im.setMatrixAt(n++, _m.compose(_p, _q, _s.set(sc * (0.8 + r() * 0.6), sc, sc * (0.8 + r() * 0.6))));
  }
  im.count = n; im.castShadow = im.receiveShadow = true; k.scene.add(im);
}
// marker poles with blinking beacons on both edges (a graded route needs to be seen from orbit)
function buildBeacons(k) {
  const spots = []; for (let s = -60; s < FINISH_S + 80; s += 24) if (s < RILLE[0] - 2 || s > RILLE[1] + 2) for (const d of [-ROAD_HALF - 1, ROAD_HALF + 1]) spots.push([s, d]);
  const pole = new THREE.CylinderGeometry(0.05, 0.06, 1.4, 6); pole.translate(0, 0.7, 0);
  const pi = new THREE.InstancedMesh(pole, MAT.metal, spots.length);
  const lamp = new THREE.InstancedMesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.6, 0.4), toneMapped: false }), spots.length);
  spots.forEach(([s, d], i) => { k.world(s, d, 0, _p); pi.setMatrixAt(i, _m.compose(_p, _q.identity(), _s.set(1, 1, 1))); _p.y += 1.45; lamp.setMatrixAt(i, _m.compose(_p, _q, _s)); });
  k.scene.add(pi, lamp); live.beacons = lamp;
}
// Tranquility Base: the descent stage left behind, the flag, a reflector, bootprints
function buildApollo(k) {
  const g = new THREE.Group(); k.world(APOLLO.s, APOLLO.d, groundRel(APOLLO.s, APOLLO.d), g.position); g.rotation.y = k.frame(APOLLO.s).yaw + 0.6; k.scene.add(g);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 1.6, 8), MAT.foil); body.position.y = 1.9; g.add(body);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.1, 0.15, 8), MAT.dark); top.position.y = 2.75; g.add(top);
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2 + Math.PI / 4, x = Math.cos(a), z = Math.sin(a);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.2, 8), MAT.foil); leg.position.set(x * 2.6, 1.15, z * 2.6); leg.rotation.set(z * 0.55, 0, -x * 0.55); g.add(leg);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.1, 16), MAT.foil); pad.position.set(x * 3.4, 0.05, z * 3.4); g.add(pad);
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6), MAT.metal); strut.position.set(x * 2.2, 1.0, z * 2.2); strut.rotation.set(z * 1.0, 0, -x * 1.0); g.add(strut);
  }
  const ladder = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.4, 0.05), MAT.metal); ladder.position.set(0, 1.2, 2.7); ladder.rotation.x = -0.45; g.add(ladder);
  // the flag, held out by its top rod
  const flagTex = k.canvasTex(330, 174, (c, w, h) => {
    for (let i = 0; i < 13; i++) { c.fillStyle = i % 2 ? '#f4f4f0' : '#b22234'; c.fillRect(0, i * h / 13, w, h / 13 + 1); }
    c.fillStyle = '#3c3b6e'; c.fillRect(0, 0, w * 0.4, h * 7 / 13);
    c.fillStyle = '#fff'; for (let y = 0; y < 9; y++) for (let x = 0; x < (y % 2 ? 5 : 6); x++) { c.beginPath(); c.arc(8 + x * 22 + (y % 2) * 11, 7 + y * 10, 2.2, 0, Math.PI * 2); c.fill(); }
  });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.6, 6), MAT.metal); pole.position.set(5.5, 1.3, 1); g.add(pole);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 6), MAT.metal); rod.rotation.z = Math.PI / 2; rod.position.set(6.25, 2.55, 1); g.add(rod);
  const geo = new THREE.PlaneGeometry(1.5, 0.8, 12, 4); const fp = geo.attributes.position;
  for (let i = 0; i < fp.count; i++) fp.setZ(i, Math.sin(fp.getX(i) * 5) * 0.05 * (fp.getX(i) + 0.75));
  const flag = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: flagTex, roughness: 0.8, side: THREE.DoubleSide })); flag.position.set(6.25, 2.13, 1); g.add(flag);
  const lrr = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.45), MAT.metal); lrr.position.set(-4, 0.35, 2); lrr.rotation.x = -0.4; g.add(lrr);
  // bootprints
  const r = rnd(8), bp = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.16, 0.32), new THREE.MeshBasicMaterial({ color: '#2b2926', transparent: true, opacity: 0.55, depthWrite: false }), 160);
  for (let i = 0; i < 160; i++) { const a = r() * Math.PI * 2, rr = 2 + r() * 12; _p.set(Math.cos(a) * rr, 0.04, Math.sin(a) * rr); _q.setFromEuler(_e.set(-Math.PI / 2, 0, r() * 6)); bp.setMatrixAt(i, _m.compose(_p, _q, _s.set(1, 1, 1))); }
  g.add(bp);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  // the plaque by the road
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.6), new THREE.MeshBasicMaterial({ map: k.textTex('TRANQUILITY BASE · 1969', '#ffd28a', { w: 1024, h: 200, size: 78, bg: 'rgba(10,8,6,0.85)', frame: true }), transparent: true, toneMapped: false, side: THREE.DoubleSide }));
  plaque.material.color.setScalar(1.3); k.world(APOLLO.s - 40, -ROAD_HALF - 5, 2.6, plaque.position); plaque.lookAt(k.world(APOLLO.s - 120, 0, 2.6)); k.scene.add(plaque);
}
// Jeff Baesongs' lunar fulfilment centre: inflatable domes, a warehouse, a pad with a late lander
function buildDepot(k) {
  const g = new THREE.Group(); k.world(DEPOT.s, DEPOT.d, groundRel(DEPOT.s, DEPOT.d) - 0.3, g.position); g.rotation.y = k.frame(DEPOT.s).yaw; k.scene.add(g);
  const blue = new THREE.MeshStandardMaterial({ color: '#2f62d8', roughness: 0.5, metalness: 0.2 });
  const dome = (r, x, z) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), MAT.white); m.position.set(x, 0, z); m.castShadow = m.receiveShadow = true; g.add(m); const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.25, 8, 40), blue); ring.rotation.x = Math.PI / 2; ring.position.set(x, 0.25, z); g.add(ring); };
  dome(18, -10, 40); dome(12, 30, 70); dome(9, -40, 90);
  const wh = new THREE.Mesh(new THREE.BoxGeometry(70, 16, 34), MAT.white); wh.position.set(10, 8, -30); wh.castShadow = wh.receiveShadow = true; g.add(wh);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(70.2, 2.2, 34.2), blue); stripe.position.set(10, 12.5, -30); g.add(stripe);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(46, 7), new THREE.MeshBasicMaterial({ map: k.textTex('배송스 달 물류센터', '#9cc2ff', { w: 1024, h: 160, size: 96, bg: '#0b1840', frame: true }), toneMapped: false, side: THREE.DoubleSide }));
  sign.material.color.setScalar(1.5); sign.position.set(10, 21, -12.8); sign.rotation.y = -Math.PI / 2; g.add(sign);
  const sub = new THREE.Mesh(new THREE.PlaneGeometry(40, 4.5), new THREE.MeshBasicMaterial({ map: k.textTex('당일배송! (지구 기준 3일)', '#ffd28a', { w: 1024, h: 120, size: 72, bg: '#140c04' }), toneMapped: false, side: THREE.DoubleSide }));
  sub.material.color.setScalar(1.4); sub.position.set(-25.1, 7, -30); sub.rotation.y = -Math.PI / 2; g.add(sub);
  // stacks of boxes waiting for a rocket that is always late
  const boxTex = k.canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#b88a58'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(80,130,220,0.85)'; c.fillRect(0, 54, w, 20); });
  const bm = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 1.2, 1.6), new THREE.MeshStandardMaterial({ map: boxTex, roughness: 0.9 }), 120);
  const r = rnd(4); for (let i = 0; i < 120; i++) { const stack = i % 12, col = Math.floor(i / 12); _p.set(-34 + (col % 5) * 2.2, 0.6 + stack % 4 * 1.2, 6 + Math.floor(col / 5) * 2.4 + (stack > 3 ? 4.6 : 0) + (stack > 7 ? 4.6 : 0)); _q.setFromEuler(_e.set(0, (r() - 0.5) * 0.3, 0)); bm.setMatrixAt(i, _m.compose(_p, _q, _s.set(1, 1, 1))); }
  bm.castShadow = true; g.add(bm);
  // a squat lander on its pad, legs folded, a "DELAYED" board in front
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(16, 16, 0.4, 40), MAT.dark); pad.position.set(-10, 0.2, -80); g.add(pad);
  const lander = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 11, 24), MAT.white); lander.position.set(-10, 6.5, -80); lander.castShadow = true; g.add(lander);
  const lt = new THREE.Mesh(new THREE.ConeGeometry(4, 4, 24), MAT.white); lt.position.set(-10, 14, -80); g.add(lt);
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2, l = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 6, 8), MAT.metal); l.position.set(-10 + Math.cos(a) * 5.5, 2.4, -80 + Math.sin(a) * 5.5); l.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); g.add(l); }
  const board = new THREE.Mesh(new THREE.PlaneGeometry(14, 3), new THREE.MeshBasicMaterial({ map: k.textTex('출발 지연 · DELAYED', '#ff5a4a', { w: 1024, h: 200, size: 96, bg: '#120404', frame: true }), toneMapped: false, side: THREE.DoubleSide }));
  board.material.color.setScalar(1.6); board.position.set(-10 - 18, 4, -80); board.rotation.y = -Math.PI / 2; g.add(board);
}
// the Starship HLS that landed us, standing behind the start
function buildHLS(k) {
  const { makeShip, R, MAT: SM } = shipKit(k);
  const ship = makeShip({ tiles: false });
  const g = new THREE.Group(); g.add(ship); k.world(HLS.s, HLS.d, groundRel(HLS.s, HLS.d) + 4, g.position); k.scene.add(g);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.03, R + 0.03, 22, 48, 1, true), MAT.white); band.position.y = 37; g.add(band);
  const nose = new THREE.Mesh(new THREE.LatheGeometry([[R + 0.03, 0], [R * 0.98 + 0.03, 2.5], [R * 0.9 + 0.03, 5], [R * 0.72 + 0.03, 8], [R * 0.45 + 0.03, 10.8], [R * 0.18 + 0.03, 12.6], [0.05, 13]].map(([r, y]) => new THREE.Vector2(r, y)), 48), MAT.white); nose.position.y = 48; g.add(nose);
  // landing legs and the crew elevator down to the regolith
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, l = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 7, 8), SM.steelDark); l.position.set(Math.cos(a) * (R + 1.4), -1.5, Math.sin(a) * (R + 1.4)); l.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35); g.add(l); }
  const lift = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.25, 3.4), MAT.metal); lift.position.set(R + 1.8, -3.8, 0); g.add(lift);
  for (const z of [-1.6, 1.6]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 44, 4), MAT.metal); c.position.set(R + 1.8, 18, z); g.add(c); }
  const hatch = new THREE.Mesh(new THREE.PlaneGeometry(3, 3.4), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.8, 2.2), toneMapped: false })); hatch.position.set(R + 0.06, 40, 0); hatch.rotation.y = Math.PI / 2; g.add(hatch);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
}
// two Raptor cannons strapped to the roadster, salvaged from the HLS
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
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), glow); tip.position.set(x, 1.05, -1.96); kit.add(tip);
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.6), dark); strut.position.set(x * 0.92, 0.9, -0.2); kit.add(strut);
  }
  const saddle = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.06, 0.5), steel); saddle.position.set(0, 1.2, -0.1); kit.add(saddle);
  kit.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  car.add(kit); car.userData.cannons = kit;
}
function buildSky(k) {
  const sunDir = new THREE.Vector3(-0.82, 0.24, 0.3);
  const { earth, atmo } = makeEarth(k, 170, sunDir);
  earth.rotation.set(0.4, 1.2, 0.1);
  k.scene.add(earth, atmo); live.earth = earth; live.atmo = atmo;
  const glowTex = k.canvasTex(256, 256, (g) => { const r = g.createRadialGradient(128, 128, 0, 128, 128, 128); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.07, 'rgba(255,250,240,0.9)'); r.addColorStop(0.22, 'rgba(255,230,200,0.18)'); r.addColorStop(1, 'rgba(255,220,180,0)'); g.fillStyle = r; g.fillRect(0, 0, 256, 256); });
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(6, 5.7, 5.2), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false }));
  sun.scale.setScalar(240); sun.renderOrder = -7; k.scene.add(sun); live.sun = sun;
}
function buildMeteors(k) {
  const ringTex = k.canvasTex(256, 256, (g) => { g.strokeStyle = '#ff3a2a'; g.lineWidth = 14; g.beginPath(); g.arc(128, 128, 110, 0, Math.PI * 2); g.stroke(); g.lineWidth = 6; g.beginPath(); g.arc(128, 128, 70, 0, Math.PI * 2); g.stroke(); g.fillStyle = 'rgba(255,60,40,0.18)'; g.beginPath(); g.arc(128, 128, 110, 0, Math.PI * 2); g.fill(); });
  for (const hz of METEORS) {
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, toneMapped: false, color: new THREE.Color(2.4, 1, 1) }));
    ring.rotation.x = -Math.PI / 2; ring.visible = false; k.scene.add(ring);
    const streak = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.5, 30, 8, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 2.6, 1.2), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    streak.visible = false; k.scene.add(streak);
    const flash = new THREE.PointLight('#ffb070', 0, 60, 1.5); k.scene.add(flash);
    live.meteors.push({ hz, ring, streak, flash, lane: 0, cyc: -1 });
  }
}

// ---------- per frame ----------
function tick(time, camera) {
  if (!live.k) return;
  const k = live.k;
  if (live.earth) {
    live.earth.position.copy(camera.position).add(_p.set(0.3, 0.2, -0.93).normalize().multiplyScalar(2300));
    live.earth.rotation.y = 1.2 + time * 0.01;
    live.atmo.position.copy(live.earth.position); live.atmo.material.uniforms.center.value.copy(live.earth.position);
    live.sun.position.copy(camera.position).add(_p.set(-0.82, 0.24, 0.3).normalize().multiplyScalar(2600));
  }
  if (live.beacons) live.beacons.material.color.setScalar(Math.sin(time * 4) > 0.3 ? 3 : 0.4).multiply(new THREE.Color(1, 0.55, 0.15));
  // meteors: warn for 1.4 s, then strike the marked lane
  const lanes = [-9, -3, 3, 9];
  for (const mt of live.meteors) {
    const hz = mt.hz, ph = (time + hz.ph) % hz.period, cyc = Math.floor((time + hz.ph) / hz.period);
    if (cyc !== mt.cyc) { mt.cyc = cyc; mt.lane = lanes[(hash(cyc, hz.s) * 4) | 0]; hz.dL = mt.lane - 3; hz.dR = mt.lane + 3; }
    const warnStart = hz.period - 1.4 - hz.on;
    const warn = ph > warnStart && ph < hz.period - hz.on, strike = ph >= hz.period - hz.on;
    hz.active = strike;
    mt.ring.visible = warn || strike;
    if (mt.ring.visible) { k.world(hz.s, mt.lane, 0.08, mt.ring.position); mt.ring.rotation.set(-Math.PI / 2, 0, time * 2); mt.ring.material.opacity = warn ? 0.5 + 0.5 * Math.sin(time * 18) : 1; }
    const fall = warn ? (ph - warnStart) / 1.4 : 1;
    mt.streak.visible = warn && fall > 0.55;
    if (mt.streak.visible) { const u = (fall - 0.55) / 0.45; k.world(hz.s + 40 * (1 - u), mt.lane - 30 * (1 - u), 2 + 120 * (1 - u), mt.streak.position); mt.streak.rotation.set(0.55, 0, -0.45); }
    mt.flash.intensity = strike ? 900 * (1 - (ph - (hz.period - hz.on)) / hz.on) : 0;
    if (strike) k.world(hz.s, mt.lane, 2, mt.flash.position);
  }
}
