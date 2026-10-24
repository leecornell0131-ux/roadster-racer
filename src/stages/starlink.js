// Stage 7: Starlink orbit, 550 km up. The satellites of one orbital plane are docked nose to tail and their
// flat buses are the road; solar wings fan out on both sides. Low gravity, missing satellites to fly
// across, tumbling debris crossing the lanes, late-delivery parcel satellites and a clone constellation as
// traffic. Earth turns below (day side, city lights past the terminator), the Moon waits ahead.
// No boss (bonus stage): at the end of every event a Starship scoops the roadster up; after the last one it burns for the Moon.
import * as THREE from 'three';
import { shipKit } from './starbase.js';

const ROAD_HALF = 10;
const LANES = [-7.5, -2.5, 2.5, 7.5];
const SAT = 38.5, DOCK = 2.5;          // one satellite bus + its docking truss, along the road
const WING_W = 26, WING_L = 11;
const SHIP_START = { s: -80, d: -26 };

const sm = THREE.MathUtils.smoothstep;

// ---------- course factory ----------
// the deck's long orbital wave, plus swells (stretches where it rolls hard: [s0, s1, amp, wavelength]);
// a full-width launch ramp before every missing satellite unless the course puts laser pads there
function orbit({ finish, gaps = [], wave = [4, 150], swells = [], sway = [40, 500], ramps = [], padGaps = [], debris = [], extra = [], coinRuns = [] }) {
  const elev = (s) => {
    let y = wave[0] * Math.sin(s / wave[1]);
    for (const [s0, s1, A, wl] of swells) y += A * Math.sin((s - s0) / wl) * sm(s, s0, s0 + 80) * (1 - sm(s, s1 - 80, s1));
    return y;
  };
  return {
    finish, elev,
    gaps: gaps.map(([s0, s1]) => ({ s0, s1, respawn: s0 - 130 })),
    cx: (s) => sway[0] * Math.sin(s / sway[1]) * sm(s, 100, 500) * (1 - sm(s, finish - 200, finish)),
    ramps: [
      ...gaps.filter((g, i) => !padGaps.includes(i)).map(([s0, s1]) => ({ s0: s0 - 26, len: 16, dL: -ROAD_HALF, dR: ROAD_HALF, h: s1 - s0 > 80 ? 4 : 3 })),
      ...ramps,
    ],
    pads: gaps.filter((g, i) => padGaps.includes(i)).flatMap(([s0]) => LANES.map((d) => ({ s: s0 - 22, d, l: 3, w: 2.2, v: 16 }))),
    // debris: [s, sweep speed, phase] chunks that sweep across the lanes; tick moves the hit boxes with them
    hazards: debris.map(([s, w, ph]) => ({ s, w, ph, A: 13, l: 2, dL: 99, dR: 99, h: 2.4, y0: -2, active: true, text: ['우주 쓰레기 충돌!', '경쟁사 위성 파편 · 급감속', '#ff9a3d'] })),
    pickups: [
      // an arc over every hole
      ...gaps.flatMap(([s0, s1], i) => range(0, s1 - s0 + 30, 8).map((x) => ['coin', s0 - 5 + x, LANES[(i + 1) % 4], 2 + 0.2 * x - 0.2 * x * x / (s1 - s0 + 30)])),
      // lane runs (bonus stage: Dogecoin everywhere)
      ...coinRuns.flatMap(([a, b], j) => range(a, b, 10).map((s, i) => ['coin', s, LANES[((i >> 2) + j) % 4], 1.2])),
      ...extra,
    ],
    trafficMaxS: finish - 40,
    shipEnd: { s: finish + 20, d: 26 },   // the waiting Starship (nose at s + 60)
  };
}
const debrisRun = (list, w0, step, ph0) => list.map((s, i) => [s, w0 + (i % 3) * 0.22, i * step + ph0]);
const sats = (n) => ({
  parcel: { make: () => makeParcelSat('#a8774a', '지각배송'), name: '지각배송 위성', speed: [18, 23], n, color: '#a8774a' },
});

// event 1: stranded crews to pick up and drop off along a calm plane with one missing satellite
const RESCUE = orbit({ finish: 3300, gaps: [[1580, 1640]], wave: [3, 190], swells: [[2300, 2700, 7, 60]], sway: [55, 420],
  debris: debrisRun([1950, 2010, 2070], 0.7, 2.3, 0), coinRuns: [[150, 400], [2780, 3000]],
  extra: [['h100', 1200, 7.5, 1.6], ['air', 1500, -2.5, 1.2], ['h100', 2500, 0, 3.2], ['air', 3100, 2.5, 1.2]] });
// event 2: the junk belt: four holes, two big swells, debris everywhere, made for low-gravity flips
const JUNK = orbit({ finish: 3200, gaps: [[540, 600], [1180, 1260], [1900, 1960], [2580, 2680]], padGaps: [2], wave: [5, 130],
  swells: [[700, 1100, 12, 50], [2050, 2450, 13, 48]], sway: [30, 360],
  ramps: [{ s0: 380, len: 14, dL: -9, dR: -3, h: 3.6 }, { s0: 1500, len: 16, dL: 3, dR: 9, h: 4.4 }, { s0: 2900, len: 14, dL: -3, dR: 3, h: 3 }],
  debris: [...debrisRun([300, 350, 410, 460, 1320, 1370, 1420, 1470, 1530, 1600], 0.9, 1.9, 0.3), ...debrisRun([2000, 2700, 2760, 2820, 2880, 3000, 3060], 1.1, 1.6, 1)],
  coinRuns: [[150, 280], [1300, 1450]],
  extra: [['h100', 900, 7.5, 6], ['air', 1700, -7.5, 1.2], ['h100', 2300, 0, 6], ['air', 2850, 2.5, 1.2]] });
// event 3: a drag race against the clone constellation: no holes, long sweeping bends, one swell
const CLONES = orbit({ finish: 3400, wave: [3, 220], swells: [[1600, 2000, 6, 70]], sway: [90, 380],
  coinRuns: [[300, 600], [2300, 2700]],
  extra: [['air', 900, 2.5, 1.2], ['h100', 1800, -7.5, 1.6], ['air', 2900, -2.5, 1.2]] });
// event 4: the original plane, then the Starship to the Moon
const DOCK_RUN = orbit({ finish: 3000, gaps: [[770, 820], [1420, 1490], [2150, 2250]], padGaps: [1], swells: [[1520, 2040, 11, 55]],
  ramps: [{ s0: 560, len: 14, dL: 3, dR: 9, h: 2.6 }, { s0: 1720, len: 16, dL: -9, dR: -3, h: 4.2 }, { s0: 2860, len: 14, dL: -3, dR: 3, h: 2.6 }],
  debris: [...debrisRun([940, 985, 1030, 1090, 1150, 1215, 1280], 0.8, 2.1, 0), ...debrisRun([2330, 2400, 2460, 2530, 2600, 2650, 2720], 1.0, 1.7, 0.5)],
  coinRuns: [[120, 420], [2780, 2980]],
  extra: [
    ...range(1560, 1960, 12).map((s, i) => ['coin', s, i % 2 ? 2.5 : -2.5, 1.2]),
    ['h100', 900, 7.5, 1.6], ['h100', 1600, -7.5, 1.6], ['h100', 2500, 0, 3.2],
    ['air', 480, -2.5, 1.2], ['air', 1340, 7.5, 1.2], ['air', 2060, -7.5, 1.2], ['air', 2780, 2.5, 1.2],
    ['gpu', 300, 2.5, 1.4], ['gpu', 1120, -7.5, 1.4], ['gpu', 1700, 7.5, 1.4], ['gpu', 2300, -2.5, 1.4], ['gpu', 2900, 7.5, 1.4],
  ] });
const POSTER = { s: 300, d: 2, y: 0, cam: { back: 11, side: -4, y: 3, ahead: 20, lookSide: 3, lookY: 2, fov: 58 } };

export default {
  id: 'starlink', num: 7, name: '스타링크 궤도',
  roadHalf: ROAD_HALF, lanes: LANES,
  gravity: 14,
  ...DOCK_RUN,
  splashY: () => -16,
  legend: { s: 1830, d: -6, y: 15 },
  road: { hide: true },
  env: {
    bg: false, hdri: '', sun: ['#fff6ea', 3.4], hemi: ['#0a0e18', '#2c4a7c', 0.55],
    sunDir: [-0.62, 0.33, -0.71],
    sky: { top: [0.004, 0.005, 0.01], mid: [0.01, 0.014, 0.03], hor: [0.08, 0.16, 0.34], low: [0.12, 0.24, 0.48], glow: [1, 0.95, 0.85] },
    fog: ['#03050b', 2600, 6000], exposure: 0.95, bloom: 0.38,
  },
  traffic: {
    ...sats(6),
    clone: { make: () => makeParcelSat('#b8302c', '천범 ★'), name: '천범 복제 위성', speed: [21, 26], n: 6, range: [2250, 2950], color: '#b8302c' },
  },
  radio: [
    [20, '마지막 궤도 구간! 이번엔 진짜 달로 가는 스타쉽이 끝에서 기다려.'],
    [260, '저 갈색 상자들 보여? 지각배송 위성. 항상 한 발 늦게 오는 그 회사 거.'],
    [640, '앞에 위성 하나가 빠졌어! 점프대 타고 건너!'],
    [900, '우주 쓰레기 구간! 굴러오는 파편은 점프로 넘거나 피해.'],
    [1330, '레이저 링크 점프대! 밟으면 쭉 날아가.'],
    [1520, '궤도 너울 구간. 중력이 약해서 꼭대기에서 붕 뜬다!'],
    [2040, '이번 구멍은 길어. 점프하고 공중에서 꾹 눌러 분사!'],
    [2300, '천범 복제 위성 떼다! 똑같이 생긴 게 끝도 없이 와.'],
    [2760, '스타쉽 보인다! 화물칸으로 들어가서 달로 간다!'],
  ],
  lines: { finish: '도킹 완료! 다음 정거장은 달이다!', fall: ['궤도 이탈!', '+3초', '스타쉽이 다시 건져 왔어. 조심!'] },
  stars: { time: 60, text: '완주 · 60초 이내 · 퍼펙트 랜딩 4회', perfect: 4 },
  finishDelay: 9000,
  props: ['starlink'],
  poster: { s: 1428, d: 2, y: 6, boss: [0, 0, 0], cam: { back: 15, side: -7, y: 3, ahead: 70, lookSide: 12, lookY: 4, fov: 60 } },
  text: {
    eyebrow: 'STAGE 07 · STARLINK ORBIT', title: 'ORBIT', sub: '위성이 도로가 되는 곳',
    tip: '<b>TIP</b> 중력이 약해서 점프가 훨씬 멀리 날아가요. 위성이 빠진 <b>구멍</b>은 점프대로 건너고, 굴러오는 <b>우주 쓰레기</b>는 점프로 넘으세요. 공중에서 점프를 누르고 있으면 분사로 더 오래 떠 있어요.',
    tweet: '위성 6천 개 깔았더니 그냥 도로가 됐음. 요금 인상은 없음(아마도).',
    meta: '고도 550km · 궤도 속도 7.6km/s · 리트윗 420만', load: '레이저 링크 정렬 중 · 궤도 속도 맞추는 중',
    hud: 'STAGE 7 · STARLINK ORBIT', clear: 'STAGE 07 CLEAR', clearTitle: '도킹 성공',
  },
  // chapter 7: three jobs on their own orbital planes, then the original plane to the Moon ship
  events: [
    {
      id: 'rescue', name: '갇힌 우주인 구조', ...RESCUE, legend: null, traffic: sats(5),
      brief: '<b>배송</b> 궤도에 손님들이 떠 있어요. 9개월째 못 돌아간 우주인, 우주 관광객, 고장 난 화장실 수리공까지. 초록 정차 구역에서 <b>↓ 브레이크</b>. 중력이 약해서 제동 거리가 길어요.',
      mission: { type: 'deliver', time: 102, allowMiss: 1, stops: [
        { s: 820, d: 7.5, name: '우주 정거장 화장실', thanks: '화장실이 또 고장 났어요. 빨리요!', line: '수리공 내렸다. 우주 화장실 수리비가 2천만 달러래.' },
        { s: 1320, d: -7.5, name: '스타-라이너 캡슐', thanks: '9개월 만에 집에 가요!', line: '저 우주인들 8일 출장 왔다가 9개월 있었대. 캡슐이 고장 나서.' },
        { s: 2150, d: 7.5, name: '우주 관광객', thanks: '5천만 달러짜리 여행인데 기내식이 없네요' },
        { s: 2950, d: -7.5, name: '궤도 피자 가게', thanks: '무중력이라 토핑이 다 날아갔어요', line: '피자 배달 완료. 치즈가 아직 공중에 떠 있어.' },
      ] },
      radio: [[20, '궤도 택시 알바야. 우주에 갇힌 손님이 넷. 중력이 약하니까 브레이크 일찍!'], [1450, '앞에 위성 하나 빠졌어. 점프대로 넘어. 착지하면 바로 다음 손님은 아니니까 안심.'], [2250, '너울 구간이야. 꼭대기에서 붕 뜨니까 공중에서 차선 맞춰.']],
      lines: { finish: '손님 다 내려 줬어. 팁은 우주 정거장 쿠키 한 봉지래.', failed: '우주인들이 또 기다리게 됐어… 다시 가자.' },
      poster: POSTER, finishText: 'FINISH · 궤도 택시 승강장',
      text: { clear: 'DELIVERY DONE', clearTitle: '구조 완료' },
    },
    {
      id: 'junk', name: '우주 쓰레기 스턴트', ...JUNK, legend: { s: 1560, d: 6, y: 16 }, traffic: sats(4),
      brief: '<b>스턴트</b> 경쟁사 위성 파편이 둥둥 떠다니는 쓰레기 벨트. 구멍 넷, 큰 너울 둘. 낮은 중력으로 오래 떠서 <b>배럴롤</b>을 여러 번 돌리고, 파편 사이 아슬 추월로 콤보를 이어요.',
      mission: { type: 'stunt', scores: [4000, 9000, 17000] },
      radio: [[20, '우주 쓰레기 벨트야. 위험하지만 묘기 부리기엔 최고지. 중력이 약해서 롤 몇 바퀴 돌릴 수 있어.'], [680, '너울 구간! 꼭대기마다 날아올라서 롤!'], [1850, '레이저 패드 밟고 구멍 넘어!'], [2550, '마지막 구멍 길어. 공중에서 분사 꾹!']],
      lines: { finish: '쓰레기 벨트 통과! 파편들이 우리 묘기에 박수 쳤어. 사실 그냥 부딪힌 거지만.', failed: '파편보다 점수가 적었어. 낮은 중력 활용해서 롤 더 돌려 봐.' },
      poster: POSTER, finishText: 'FINISH · 쓰레기 벨트 탈출',
      text: { clear: 'SHOW TIME', clearTitle: '스턴트 쇼 성공' },
    },
    {
      id: 'clones', name: '복제 위성 드래그', ...CLONES, legend: null,
      traffic: { ...sats(5), clone: { make: () => makeParcelSat('#b8302c', '천범 ★'), name: '천범 복제 위성', speed: [21, 26], n: 8, range: [400, 3300], color: '#b8302c' } },
      brief: '<b>레이스</b> 똑같이 생긴 위성을 끝없이 찍어내는 천범 컨스텔레이션이 궤도 레이스를 걸어왔어요. 상대는 복제 위성 셋. 너울에서 퍼펙트 착지 부스트로 따라잡아요.',
      mission: { type: 'rivals', time: 62, perfect: 2, rivals: [
        { type: 'clone', name: '천범 복제 #1', label: 'CLONE 1', speed: 53, d: -2.5, s: 24 },
        { type: 'clone', name: '천범 복제 #2', label: 'CLONE 2', speed: 55, d: 7.5, s: 30 },
        { type: 'clone', name: '천범 복제 #9999', label: 'CLONE 9999', speed: 57, d: -7.5, s: 36, tagColor: '#ffc83d' },
      ] },
      radio: [[20, '천범 위성들이 레이스 걸어왔어. 셋 다 똑같이 생겼지? 복붙이라 그래.'], [1550, '너울 구간이야. 점프로 퍼펙트 착지하면 부스트!'], [2800, '스타쉽 보인다! 결승까지 밟아!']],
      lines: { finish: '원본이 이겼다! 복제 위성들이 우리 차도 복사하겠대. 저작권은 우리 거야.', failed: '복사본한테 졌어… 퍼펙트 착지 부스트로 붙어.' },
      poster: POSTER, finishText: 'FINISH · 궤도 결승선',
      text: { clear: 'WINNER', clearTitle: '궤도 레이스 우승' },
    },
    {
      id: 'dock', name: '스타쉽 도킹',
      brief: '<b>주행</b> 원래의 위성 도로. 구멍 셋과 우주 쓰레기 구간을 지나 끝에서 기다리는 스타쉽 화물칸으로. 들어가면 <b>달로 출발</b>!',
    },
  ],
  build,
  tick,
  finishCam,
};

function range(a, b, step) { const out = []; for (let s = a; s <= b; s += step) out.push(s); return out; }
function rnd(seed) { let x = seed >>> 0; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; }; }
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();
const live = { k: null, earth: null, atmo: null, moon: null, sun: null, debris: [], ships: null, cut: null, links: null, plume: null };
const inGap = (s) => GAPS.some(([a, b]) => s > a - 1 && s < b + 1);

// the course being built (set from the event's fields in build)
let FINISH_S, GAPS, SHIP_END, DEBRIS, elev;
const elevSlope = (s) => elev(s + 0.5) - elev(s - 0.5);

// ---------- textures ----------
function canvas(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }
function tex(c, srgb = true) { const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; }
// one tile = the road's width x one satellite (bus + docking truss). Solar cells, busbars, lane paint.
function deckCanvas(emissive) {
  return canvas(512, 1024, (g, w, h) => {
    const busH = h * (SAT - DOCK) / SAT;
    if (!emissive) {
      g.fillStyle = '#0a1430'; g.fillRect(0, 0, w, busH);
      const nx = 20, ny = 36, cw = w / nx, ch = busH / ny;
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
        const v = (i * 7 + j * 13) % 5;
        const gr = g.createLinearGradient(0, j * ch, 0, (j + 1) * ch);
        gr.addColorStop(0, `rgb(${16 + v},${30 + v * 2},${70 + v * 4})`); gr.addColorStop(1, `rgb(${10 + v},${20 + v},${52 + v * 3})`);
        g.fillStyle = gr; g.fillRect(i * cw + 1, j * ch + 1, cw - 2, ch - 2);
        g.fillStyle = 'rgba(170,185,210,0.35)'; for (let k = 1; k < 4; k++) g.fillRect(i * cw + 1, j * ch + k * ch / 4, cw - 2, 1);
      }
      g.fillStyle = '#9aa4b4'; g.fillRect(0, 0, w, 3); g.fillRect(0, busH - 3, w, 3);
      // docking truss: dark grate with hazard stripes
      g.fillStyle = '#1c1f24'; g.fillRect(0, busH, w, h - busH);
      g.fillStyle = '#3a3f47'; for (let x = 0; x < w; x += 12) g.fillRect(x, busH, 4, h - busH);
      for (let x = -40; x < w + 40; x += 40) { g.fillStyle = '#d8a400'; g.beginPath(); g.moveTo(x, busH); g.lineTo(x + 20, busH); g.lineTo(x + 10, busH + 10); g.lineTo(x - 10, busH + 10); g.fill(); }
    } else { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); }
    // lane paint: solid edges, dashes between lanes (glowing versions go in the emissive map)
    const lw = 0.16 / (ROAD_HALF * 2) * w;
    g.fillStyle = emissive ? '#3fd8ff' : '#e8f0ff';
    g.fillRect(w * 0.012, 0, lw, busH); g.fillRect(w * 0.988 - lw, 0, lw, busH);
    for (const u of [0.25, 0.5, 0.75]) for (let y = 0; y < busH - 60; y += busH / 6) g.fillRect(w * u - lw / 2, y + 20, lw, busH / 14);
    if (emissive) { g.fillStyle = '#ffffff'; for (let x = 8; x < w; x += 32) g.fillRect(x, busH + (h - busH) / 2 - 2, 10, 4); }
  });
}
function wingCanvas() {
  return canvas(512, 256, (g, w, h) => {
    g.fillStyle = '#c9ccd2'; g.fillRect(0, 0, w, h);
    const nx = 24, ny = 10, cw = (w - 8) / nx, ch = (h - 8) / ny;
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      const v = (i * 11 + j * 5) % 7;
      g.fillStyle = `rgb(${18 + v},${24 + v * 2},${58 + v * 5})`; g.fillRect(4 + i * cw + 1, 4 + j * ch + 1, cw - 2, ch - 2);
      g.fillStyle = 'rgba(200,210,230,0.22)'; g.fillRect(4 + i * cw + cw / 2, 4 + j * ch + 1, 1, ch - 2);
    }
    for (let i = 4; i < nx; i += 4) { g.fillStyle = '#b8bcc4'; g.fillRect(4 + i * cw - 1, 0, 3, h); }
  });
}
function foilCanvas() {
  // crinkled multi-layer insulation: gold with creases
  const r = rnd(7);
  return canvas(256, 256, (g, w, h) => {
    g.fillStyle = '#b8862a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const x = r() * w, y = r() * h, a = r() * Math.PI, l = 10 + r() * 40, v = r();
      g.strokeStyle = v > 0.5 ? `rgba(255,230,150,${0.25 + v * 0.3})` : `rgba(90,55,10,${0.3 + v * 0.3})`;
      g.lineWidth = 1 + r() * 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
  });
}
function parcelCanvas(color, label) {
  return canvas(256, 256, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    const r = rnd(label.length * 31);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,240,220'},${0.04 + r() * 0.05})`; g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3); }
    g.fillStyle = 'rgba(230,215,180,0.75)'; g.fillRect(w * 0.44, 0, w * 0.12, h);       // packing tape
    g.fillStyle = '#f4f1ea'; g.fillRect(24, 150, 120, 70); g.fillStyle = '#111';
    g.font = '900 26px "Black Han Sans","Noto Sans KR",sans-serif'; g.fillText(label, 30, 196);
    g.fillRect(30, 158, 100, 3); for (let x = 30; x < 130; x += 5) g.fillRect(x, 204, 2 + (x % 3), 10);
    g.font = '900 18px sans-serif'; g.fillStyle = '#4a2a10'; g.fillText('THIS SIDE UP ↑', 150, 40);
  });
}

// ---------- traffic: parcel satellite (a cardboard box with wings) ----------
export function makeParcelSat(color, label) {
  const g = new THREE.Group();
  const map = tex(parcelCanvas(color, label));
  const paint = new THREE.MeshStandardMaterial({ map, color: '#ffffff', roughness: 0.95 }); // keep its own colour: not named 'paint'
  const W = 2.4, H = 2.0, L = 3.6;
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, L), paint); body.position.y = H / 2 + 0.6; body.castShadow = true; g.add(body);
  const flap = new THREE.MeshStandardMaterial({ map, roughness: 0.95, side: THREE.DoubleSide });
  for (const sx of [-1, 1]) { const f = new THREE.Mesh(new THREE.PlaneGeometry(W / 2, L), flap); f.position.set(sx * W / 4 * 1.6, H + 0.75, 0); f.rotation.set(-Math.PI / 2, sx * 0.5, 0); f.rotation.order = 'ZXY'; f.rotation.z = -sx * 0.6; g.add(f); }
  const cells = new THREE.MeshStandardMaterial({ map: tex(wingCanvas()), metalness: 0.4, roughness: 0.35 });
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6), new THREE.MeshStandardMaterial({ color: '#888', metalness: 1, roughness: 0.4 }));
    arm.rotation.z = Math.PI / 2; arm.position.set(sx * (W / 2 + 0.6), H / 2 + 0.6, 0); g.add(arm);
    const p = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.04, 1.4), cells); p.position.set(sx * (W / 2 + 2.1), H / 2 + 0.6, 0); p.rotation.x = 0.5; g.add(p);
  }
  // a cold-gas thruster that glows at the back; the hover jets keep it 60 cm off the deck
  const tail = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.8, 1.5), toneMapped: false });
  const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 0.4, 14), tail); noz.rotation.x = Math.PI / 2; noz.position.set(0, H / 2 + 0.6, L / 2 + 0.2); g.add(noz);
  const jet = new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.6, 16, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 0.9, 1.6), transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  jet.position.y = 0.3; g.add(jet);
  const pivot = new THREE.Group(); pivot.name = 'pivot'; pivot.position.y = H + 0.6; g.add(pivot);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#ddd', metalness: 0.5, roughness: 0.4, side: THREE.DoubleSide }));
  dish.rotation.x = 1.2; dish.position.set(0, 0.25, 0.8); pivot.add(dish);
  g.userData = { kind: 'parcel', cfg: { colors: [color] }, size: new THREE.Vector3(W, H + 0.6, L) };
  return g;
}

// ---------- build ----------
let MAT = null;
function build(k) {
  live.k = k;
  ({ finish: FINISH_S, shipEnd: SHIP_END, hazards: DEBRIS, elev } = k.ST);
  GAPS = k.ST.gaps.map((g) => [g.s0, g.s1]);
  const maxA = k.IS_MOBILE ? 4 : 8;
  const deck = tex(deckCanvas(false)), deckE = tex(deckCanvas(true), true);
  for (const t of [deck, deckE]) t.anisotropy = maxA;
  const foil = tex(foilCanvas());
  MAT = {
    deck: new THREE.MeshPhysicalMaterial({ map: deck, emissiveMap: deckE, emissive: '#ffffff', emissiveIntensity: 0.7, metalness: 0.25, roughness: 0.7, clearcoat: 0.15, clearcoatRoughness: 0.5, envMapIntensity: 0.45 }),
    foil: new THREE.MeshStandardMaterial({ map: foil, bumpMap: foil, bumpScale: 2, metalness: 1, roughness: 0.38, side: THREE.DoubleSide }),
    under: new THREE.MeshStandardMaterial({ color: '#e8eaee', roughness: 0.6, metalness: 0.2, side: THREE.DoubleSide }),
    wing: new THREE.MeshStandardMaterial({ map: tex(wingCanvas()), metalness: 0.35, roughness: 0.42, side: THREE.DoubleSide, envMapIntensity: 1.3 }),
    mast: new THREE.MeshStandardMaterial({ color: '#9aa0a8', metalness: 1, roughness: 0.35 }),
  };
  // stars: NASA SVS Deep Star Maps 2020 (public domain) as the background
  k.sky.visible = false;
  const stars = k.photo(k.IS_MOBILE ? 'space_stars_m.jpg' : 'space_stars.jpg', { rep: [1, 1] });
  stars.wrapS = stars.wrapT = THREE.ClampToEdgeWrapping; stars.mapping = THREE.EquirectangularReflectionMapping;
  k.scene.background = stars; k.scene.backgroundIntensity = 0.55; k.scene.backgroundRotation?.set(0.5, 2.2, 0.3);
  buildRoad(k);
  buildWings(k);
  buildTrains(k);
  buildEarth(k);
  buildMoonSun(k);
  buildDebris(k);
  buildShips(k);
  buildNeighbours(k);
  k.finishArch('FINISH · 스타쉽 도킹');
}

function buildRoad(k) {
  let a = -140;
  for (const [s0, s1] of [...GAPS, [FINISH_S + 120, 0]]) {
    // the hole edges sit on a satellite boundary so a missing satellite reads as missing
    const top = new THREE.Mesh(k.ribbon(a, s0, -ROAD_HALF, ROAD_HALF, 3, () => 0, SAT), MAT.deck); top.receiveShadow = true; k.scene.add(top);
    for (const d of [-ROAD_HALF, ROAD_HALF]) k.scene.add(new THREE.Mesh(k.wall(a, s0, d, 3, () => -1.3, () => 0, 4), MAT.foil));
    k.scene.add(new THREE.Mesh(k.ribbon(a, s0, ROAD_HALF, -ROAD_HALF, 3, () => -1.3, 6), MAT.under));
    for (const s of [a, s0]) k.scene.add(new THREE.Mesh(k.crossWall(s, -ROAD_HALF, ROAD_HALF, -1.3, 0), MAT.foil));
    a = s1;
  }
  // glowing laser-link beams that bridge each hole: the satellite that should be there is missing
  for (const [s0, s1] of GAPS) for (const d of [-ROAD_HALF + 0.4, ROAD_HALF - 0.4]) {
    const p0 = k.world(s0, d, -0.4), p1 = k.world(s1, d, -0.4);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, p0.distanceTo(p1), 6, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.4, 0.4), toneMapped: false }));
    beam.position.copy(p0).lerp(p1, 0.5); beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p1.clone().sub(p0).normalize()); k.scene.add(beam);
  }
}
// two solar wings per satellite plus the masts; skipped where a satellite is missing
function buildWings(k) {
  const spots = [];
  for (let s = -140 + SAT / 2; s < FINISH_S + 120; s += SAT) if (!inGap(s - SAT / 2) && !inGap(s + SAT / 2)) spots.push(s);
  const geo = new THREE.PlaneGeometry(WING_W, WING_L); geo.rotateX(-Math.PI / 2);
  const wings = new THREE.InstancedMesh(geo, MAT.wing, spots.length * 2);
  const mg = new THREE.CylinderGeometry(0.09, 0.09, 1, 6); mg.rotateZ(Math.PI / 2);
  const masts = new THREE.InstancedMesh(mg, MAT.mast, spots.length * 2);
  let n = 0;
  for (const s of spots) for (const side of [-1, 1]) {
    const fr = k.frame(s), pitch = Math.atan(elevSlope(s)), tilt = side * (0.18 + 0.08 * Math.sin(s * 0.013));
    _e.set(pitch, fr.yaw, tilt, 'YXZ'); _q.setFromEuler(_e);
    k.world(s, side * (ROAD_HALF + 3 + WING_W / 2), -0.65 + Math.sin(tilt) * side * WING_W / 2, _p);
    wings.setMatrixAt(n, _m.compose(_p, _q, _s.set(1, 1, 1)));
    k.world(s, side * (ROAD_HALF + 1.5), -0.65, _p); masts.setMatrixAt(n, _m.compose(_p, _q, _s.set(3, 1, 1)));
    n++;
  }
  wings.receiveShadow = true; k.scene.add(wings, masts);
}
// other orbital planes: long strings of satellites glinting in the sun, plus a few laser links to them
function buildTrains(k) {
  const r = rnd(11);
  const body = new THREE.BoxGeometry(1.4, 0.3, 2.8);
  const wing = new THREE.BoxGeometry(9, 0.04, 2.4);
  const mat = new THREE.MeshStandardMaterial({ color: '#d0d4dc', metalness: 0.9, roughness: 0.25, envMapIntensity: 1.5 });
  const wmat = new THREE.MeshStandardMaterial({ map: MAT.wing.map, metalness: 0.5, roughness: 0.25 });
  const N = k.IS_MOBILE ? 260 : 520;
  const bi = new THREE.InstancedMesh(body, mat, N), wi = new THREE.InstancedMesh(wing, wmat, N);
  const ends = [];
  let n = 0;
  for (let t = 0; n < N; t++) {
    const side = t % 2 ? 1 : -1, off = 120 + r() * 500, y = -120 + r() * 260, s0 = -400 + r() * 600, ang = (r() - 0.5) * 0.5;
    for (let i = 0; i < 40 && n < N; i++) {
      const s = s0 + i * 90, d = side * (off + Math.sin(ang) * i * 90);
      if (s > FINISH_S + 700) break;
      k.world(s, d, y + i * ang * 6, _p); _q.setFromEuler(_e.set(0, k.frame(s).yaw + ang, 0));
      _s.setScalar(3);
      bi.setMatrixAt(n, _m.compose(_p, _q, _s)); wi.setMatrixAt(n, _m.compose(_p, _q, _s));
      if (i % 13 === 6 && r() < 0.35) ends.push(_p.clone());
      n++;
    }
  }
  bi.count = wi.count = n; bi.frustumCulled = wi.frustumCulled = false;
  k.scene.add(bi, wi);
  // laser links from our road to the neighbours: thin red lines that flicker
  const pts = [];
  for (const e of ends) { const s = THREE.MathUtils.clamp(-e.z, 0, FINISH_S), side = Math.sign(e.x - k.frame(s).x) || 1; if (inGap(s)) continue; pts.push(k.world(s, side * ROAD_HALF, -0.5), e); }
  const lg = new THREE.BufferGeometry().setFromPoints(pts);
  const links = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: new THREE.Color(2.2, 0.25, 0.3), transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  k.scene.add(links); live.links = links;
}

// a few real satellites close to the deck, close enough to see the solar array cells
function buildNeighbours(k) {
  if (!k.prop('starlink')) return;
  const r = rnd(23);
  for (let s = 140; s < FINISH_S; s += 150 + r() * 120) {
    const sat = k.prop('starlink', 9 + r() * 4), side = r() < 0.5 ? -1 : 1;
    k.world(s, side * (ROAD_HALF + 14 + r() * 30), -6 + r() * 22, sat.position);
    sat.rotation.set(Math.PI / 2 + (r() - 0.5) * 0.6, k.frame(s).yaw + (r() - 0.5) * 1.2, side * (0.4 + r() * 0.5));
    k.scene.add(sat);
  }
}

// ---------- Earth: NASA Blue Marble + Black Marble (public domain), clouds from noise, an atmosphere rim ----------
const E_R = 1600, E_D = 1740, E_DIR = new THREE.Vector3(0.5, -0.78, -0.38).normalize();
function buildEarth(k) {
  const { earth, atmo } = makeEarth(k, E_R, new THREE.Vector3(-0.62, 0.33, -0.71));
  earth.rotation.set(0.35, 2.6, 0.2);
  k.scene.add(earth, atmo); live.earth = earth; live.atmo = atmo;
}
// Earth + atmosphere shell of radius R lit from sunDir (also the Moon stage's earthrise)
export function makeEarth(k, E_R, sunDir) {
  sunDir = sunDir.clone().normalize();
  const day = k.photo('earth_day.jpg', { rep: [1, 1] }), night = k.photo('earth_night.jpg', { rep: [1, 1] }), water = k.photo('earth_water.png', { srgb: false, rep: [1, 1] });
  for (const t of [day, night, water]) { t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 8; }
  const mat = new THREE.ShaderMaterial({
    uniforms: { day: { value: day }, night: { value: night }, water: { value: water }, sunDir: { value: sunDir }, time: { value: 0 } },
    vertexShader: `varying vec2 vUv; varying vec3 vN, vW, vO;
      void main(){ vUv = uv; vO = position / ${E_R.toFixed(1)}; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform sampler2D day, night, water; uniform vec3 sunDir; uniform float time;
      varying vec2 vUv; varying vec3 vN, vW, vO;
      float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
      float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 6; i++){ s += a * n3(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }
      void main(){
        vec3 N = normalize(vN), V = normalize(cameraPosition - vW), L = normalize(sunDir);
        float ndl = dot(N, L), lit = smoothstep(-0.08, 0.25, ndl);
        vec3 col = texture2D(day, vUv).rgb * 1.15;
        float ocean = texture2D(water, vUv).r;
        // clouds: warped noise on the sphere, bands of weather
        vec3 q = vO * 5.0 + vec3(time * 0.004, 0.0, 0.0);
        float w = fbm(q * 1.3);
        float c = fbm(q * 2.2 + w * 1.6);
        float lat = abs(vO.y);
        float cover = smoothstep(0.55, 0.82, c + 0.12 * sin(lat * 9.0) - 0.05);
        vec3 dayCol = mix(col * (0.25 + 0.95 * max(ndl, 0.0)), vec3(1.0, 0.99, 0.97) * (0.12 + 1.05 * max(ndl, 0.0)), cover);
        vec3 R = reflect(-L, N);
        dayCol += vec3(1.0, 0.92, 0.8) * pow(max(dot(R, V), 0.0), 40.0) * ocean * (1.0 - cover) * 1.6 * step(0.0, ndl);
        vec3 lights = texture2D(night, vUv).rgb; lights = pow(lights, vec3(1.6)) * vec3(1.0, 0.78, 0.5) * 3.0 * (1.0 - cover * 0.8);
        vec3 c3 = dayCol * lit + lights * (1.0 - smoothstep(-0.15, 0.05, ndl));
        // twilight band and atmospheric haze toward the limb
        float fres = pow(1.0 - max(dot(N, V), 0.0), 2.5);
        c3 += vec3(1.0, 0.45, 0.2) * exp(-pow(ndl * 9.0, 2.0)) * 0.25 * (1.0 - cover * 0.5);
        c3 = mix(c3, vec3(0.32, 0.58, 1.0) * (0.15 + lit), fres * 0.75);
        gl_FragColor = vec4(c3, 1.0);
      }`,
    depthWrite: false, fog: false,
  });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(E_R, 128, 64), mat);
  earth.renderOrder = -10; earth.frustumCulled = false;
  // atmosphere shell: additive glow around the limb
  const am = new THREE.ShaderMaterial({
    uniforms: { sunDir: { value: sunDir }, center: { value: new THREE.Vector3() } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 sunDir, center; varying vec3 vW;
      void main(){
        vec3 V = normalize(vW - cameraPosition), O = cameraPosition - center;
        // closest approach of the view ray to the planet centre, in planet radii
        float t = -dot(O, V), dmin = length(O + V * t) / ${E_R.toFixed(1)};
        float h = (dmin - 1.0) / 0.035;
        if (h < 0.0) discard;
        float glow = exp(-h * 3.2) * (1.0 - smoothstep(0.85, 1.0, h));
        vec3 P = normalize(O + V * t);
        float day = smoothstep(-0.35, 0.35, dot(P, normalize(sunDir)));
        vec3 col = mix(vec3(0.05, 0.08, 0.22), vec3(0.35, 0.62, 1.0), day) + vec3(1.0, 0.5, 0.2) * exp(-pow(dot(P, normalize(sunDir)) * 4.0, 2.0)) * 0.5;
        gl_FragColor = vec4(col * glow * 2.4, glow);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.BackSide,
  });
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(E_R * 1.035, 96, 48), am);
  atmo.renderOrder = -9; atmo.frustumCulled = false;
  return { earth, atmo };
}
function buildMoonSun(k) {
  const moon = new THREE.Mesh(new THREE.SphereGeometry(80, 48, 24), new THREE.MeshStandardMaterial({ map: k.photo('moon_diff.jpg', { rep: [2, 1] }), color: '#d8d4cc', roughness: 1, fog: false }));
  moon.renderOrder = -8; k.scene.add(moon); live.moon = moon;
  const glowTex = k.canvasTex(256, 256, (g) => { const r = g.createRadialGradient(128, 128, 0, 128, 128, 128); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.08, 'rgba(255,250,235,0.9)'); r.addColorStop(0.25, 'rgba(255,220,170,0.25)'); r.addColorStop(1, 'rgba(255,200,150,0)'); g.fillStyle = r; g.fillRect(0, 0, 256, 256); });
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(6, 5.6, 5), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false }));
  sun.scale.setScalar(220); sun.renderOrder = -7; k.scene.add(sun); live.sun = sun;
}
// tumbling debris: broken panels, a dead satellite bus, a lost toolbag
function buildDebris(k) {
  const r = rnd(5);
  const metal = new THREE.MeshStandardMaterial({ color: '#8d9198', metalness: 0.9, roughness: 0.45 });
  const burnt = new THREE.MeshStandardMaterial({ color: '#3a3430', metalness: 0.6, roughness: 0.7 });
  for (const hz of DEBRIS) {
    const g = new THREE.Group(), kind = Math.floor(r() * 3);
    if (kind === 0) { // a snapped solar panel with its bus fragment
      const p = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.06, 1.8), MAT.wing); p.rotation.y = 0.3; g.add(p);
      const b = new THREE.Mesh(new THREE.BoxGeometry(1, 0.9, 1.2), MAT.foil); b.position.x = -1.4; g.add(b);
    } else if (kind === 1) { // dead satellite bus, crumpled
      const geo = new THREE.IcosahedronGeometry(1.2, 1), pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) * (0.8 + r() * 0.5), pos.getY(i) * (0.6 + r() * 0.4), pos.getZ(i) * (0.8 + r() * 0.5));
      geo.computeVertexNormals(); g.add(new THREE.Mesh(geo, kind ? burnt : metal));
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 5), metal); ant.rotation.z = 1; g.add(ant);
    } else { // tank fragment
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 2, 14, 1, true, 0, Math.PI * 1.4), metal); t.material.side = THREE.DoubleSide; g.add(t);
    }
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    // a warning glint so it reads from far
    const blink = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 1.6, 0.3), toneMapped: false })); blink.position.y = 0.9; g.add(blink);
    k.scene.add(g);
    live.debris.push({ hz, g, blink, spin: new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).multiplyScalar(2.2) });
  }
}
// the Starship that dropped us off (behind the start, payload door open) and the one waiting at the end
function buildShips(k) {
  const { makeShip, R } = shipKit(k);
  const place = (at) => {
    const ship = makeShip({ tiles: true });
    const holder = new THREE.Group(); holder.add(ship);
    ship.rotation.x = -Math.PI / 2; // lying along -z, nose forward
    ship.rotation.y = 0;
    k.world(at.s, at.d, 5, holder.position); holder.rotation.y = k.frame(at.s).yaw;
    k.scene.add(holder);
    // the payload slot: a glowing door on the side facing the road
    const side = Math.sign(-at.d);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(7, 2.6), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.9, 2.4), toneMapped: false, side: THREE.DoubleSide }));
    door.position.set(side * (R + 0.06), 0, -30); door.rotation.y = Math.PI / 2; holder.add(door);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(R * 0.9, 40, 24, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.8, 3.6), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    flame.rotation.x = -Math.PI / 2; flame.position.z = 20; flame.visible = false; holder.add(flame);
    return { holder, flame, door, base: holder.position.clone(), yaw: holder.rotation.y };
  };
  live.ships = { start: place(SHIP_START), end: place(SHIP_END) };
}

// ---------- per frame ----------
const ease = (x) => x * x * (3 - 2 * x);
function tick(time, camera, info) {
  if (!live.k) return;
  const k = live.k;
  // sky objects ride with the camera
  if (live.earth) {
    live.earth.position.copy(camera.position).addScaledVector(E_DIR, E_D);
    live.earth.rotation.y = 2.6 + time * 0.0035;
    live.earth.material.uniforms.time.value = time;
    live.atmo.position.copy(live.earth.position); live.atmo.material.uniforms.center.value.copy(live.earth.position);
    live.moon.position.copy(camera.position).add(_p.set(0.3, 0.32, -0.9).normalize().multiplyScalar(2500));
    live.moon.rotation.y = 1.2;
    live.sun.position.copy(camera.position).add(_p.set(-0.62, 0.33, -0.71).normalize().multiplyScalar(2700));
  }
  if (live.links) live.links.material.opacity = 0.12 + 0.08 * Math.sin(time * 7) * Math.sin(time * 2.3);
  // debris sweeps the lanes: the hit box follows the mesh
  for (const db of live.debris) {
    const hz = db.hz, dc = hz.A * Math.sin(time * hz.w * 0.6 + hz.ph);
    hz.dL = dc - 2.3; hz.dR = dc + 2.3;
    k.world(hz.s, dc, 1.25 + 0.25 * Math.sin(time * 1.3 + hz.ph), db.g.position);
    db.g.rotation.set(time * db.spin.x, time * db.spin.y, time * db.spin.z);
    db.blink.visible = Math.sin(time * 6 + hz.ph) > 0;
  }
  // the end: the waiting ship takes the car through its payload door, then burns for the Moon
  const sh = live.ships?.end;
  if (!sh) return;
  if (info?.state === 'finish') {
    live.cut ??= { t0: time, from: info.car.position.clone() };
    const t = time - live.cut.t0, car = info.car;
    const door = sh.holder.localToWorld(sh.door.position.clone());
    if (t > 1.2 && t < 3.8) {
      const u = ease(Math.min(1, (t - 1.2) / 2.6));
      const mid = live.cut.from.clone().lerp(door, 0.5); mid.y += 9;
      const a = live.cut.from.clone().lerp(mid, u), b = mid.clone().lerp(door, u); car.position.copy(a.lerp(b, u));
      car.rotation.set(0, sh.yaw - u * 1.3, Math.sin(t * 3) * 0.12);
      car.scale.setScalar(1 - Math.max(0, u - 0.85) * 6);
    } else if (t >= 3.8) car.visible = false;
    sh.door.material.color.setScalar(t > 3.9 ? 0.15 : 1.9);
    if (t > 4.4) {
      const lt = t - 4.4;
      sh.flame.visible = true; sh.flame.scale.set(1 + Math.sin(time * 40) * 0.06, Math.min(1, lt * 2) * (0.85 + Math.random() * 0.3), 1);
      const fwd = 0.5 * 9 * lt * lt;
      sh.holder.position.copy(sh.base).addScaledVector(_p.set(-Math.sin(sh.yaw), 0, -Math.cos(sh.yaw)), fwd);
      sh.holder.position.y += lt * lt * 0.8;
      sh.holder.rotation.set(0, sh.yaw, 0);
    }
  } else if (live.cut) {
    live.cut = null; info?.car && (info.car.visible = true, info.car.scale.setScalar(1));
    sh.holder.position.copy(sh.base); sh.holder.rotation.set(0, sh.yaw, 0); sh.flame.visible = false; sh.door.material.color.setScalar(1.9);
  }
}
function finishCam(camera, time) {
  const c = live.cut; if (!c) return false;
  const t = time - c.t0, k = live.k, sh = live.ships.end;
  if (t < 1.2) return false;
  if (t < 4.4) {
    k.world(FINISH_S - 40, -18, 10, camera.position);
    camera.lookAt(sh.holder.position.x, sh.holder.position.y + 2, sh.holder.position.z); camera.fov = 55;
  } else {
    const lt = t - 4.4, shake = Math.min(1, lt) * 0.2;
    k.world(SHIP_END.s + 30, -30, 14, camera.position);
    camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake;
    camera.lookAt(sh.holder.position); camera.fov = 52;
  }
  camera.updateProjectionMatrix();
  return true;
}
