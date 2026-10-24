// Stage 1: Austin, TX. Chapter 1 of the campaign: a hands-on tutorial at Giga Texas, then three events on
// different parts of town (a robotaxi delivery round, a stunt show on 6th Street, a robotaxi race up I-35)
// and the Waymo Mothership boss over downtown and the broken Congress Ave bridge.
// Every event is its own track: `zones` say which district each stretch is (scenery), `bridge` adds the river.
import * as THREE from 'three';

const ROAD_HALF = 12;
const LANES = [-9, -3, 3, 9];

// boss track (the original stage): 6th Street, downtown, the broken bridge, the Capitol
const B_GAP0 = 3700, B_GAP1 = 3736, B_BR0 = 3645, B_BR1 = 3815, B_FIN = 4100;

const curve = (a, b, ph = 0) => (s) => { const k = THREE.MathUtils.smoothstep(s, 120, 420); return k * (a * Math.sin(s / 420 + ph) + b * Math.sin(s / 170 + 1.3 + ph)); };
// a ramp pattern for a stretch: alternating sides, a wide centre kicker now and then
// the big corners of a real route that have room for a fork (no other corner within 330 m either side)
function bigTurns(R, n = 2) {
  const big = R.turns.filter((t) => Math.abs(t.a) > 1.2 && t.s > 420 && t.s < R.finish - 330);
  return big.filter((t) => !R.turns.some((u) => u !== t && Math.abs(u.a) > 0.25 && Math.abs(u.s - t.s) < 330)).slice(0, n);
}
function rampRun(s0, s1, every = 230, seed = 1) {
  const out = []; let i = seed;
  for (let s = s0; s < s1; s += every + ((i * 37) % 60), i++) {
    const k = i % 5;
    if (k === 0) out.push({ s0: s, len: 18, dL: -6, dR: 6, h: 3.4 });
    else if (k === 1) out.push({ s0: s, len: 16, dL: -12, dR: -5, h: 2.6 });
    else if (k === 2) out.push({ s0: s, len: 16, dL: 5, dR: 12, h: 2.6 });
    else if (k === 3) { out.push({ s0: s, len: 14, dL: -12, dR: -6, h: 2.4 }); out.push({ s0: s, len: 14, dL: 6, dR: 12, h: 2.4 }); }
    else out.push({ s0: s, len: 16, dL: -3, dR: 6, h: 4.0 });
  }
  return out;
}

const TRAFFIC = {
  waymo: { car: 'ioniq5', kit: true, name: '웨이모', speed: [20, 24], brakes: true, n: 9 },
  robotaxi: { car: 'modely', name: '테슬라 로보택시', speed: [31, 35], color: '#f2f2f0', n: 4, signal: true },
  model3: { car: 'model3', name: '모델 3', speed: [26, 32], n: 3 },
  cybertruck: { car: 'cybertruck', name: '사이버트럭', speed: [24, 29], n: 2 },
  dolphin: { car: 'dolphin', name: 'BYD 돌핀', speed: [29, 35], n: 3 },
  sealion: { car: 'sealion7', name: 'BYD 씰라이언', speed: [28, 33], n: 3 },
  bus: { car: 'torino', name: 'BYD 전기버스', speed: [14, 17], n: 2 },
};
const more = (mul, extra = {}) => Object.fromEntries(Object.entries(TRAFFIC).map(([k, d]) => [k, { ...d, n: Math.round(d.n * mul), ...extra[k] }]));

export default {
  id: 'austin', num: 1, name: '오스틴',
  roadHalf: ROAD_HALF, lanes: LANES, finish: B_FIN,
  // easter eggs: one per spot, saved once found; two of them live only on the long way round
  city: 'austin',
  eggs: [
    { id: 'au_beer', ev: 'tutorial', s: 1120, d: 10, y: 1.4, name: '사이버 맥주캔', line: '직원 냉장고에서 나온 각진 맥주캔. 따는 데 망치가 필요해.' },
    { id: 'au_weird', ev: 'deliver', fork: 0, y: 1.4, name: 'Keep Austin Weird 벽화 조각', line: '우회로로 온 사람만 보는 오스틴이야. 길 잃는 것도 실력이지.' },
    { id: 'au_comedy', ev: 'stunt', fork: 0, y: 1.6, name: '코미디 마더십 티켓', line: '조 로갓 쇼 티켓이네. 주제는 아마 화성 이주겠지.' },
    { id: 'au_bats', ev: 'soco', place: 'South Congress Bat Colony', y: 1.6, name: '콩그레스 다리 박쥐', line: '150만 마리 중 한 마리가 따라왔어. 이름은 배트모빌로 하자.' },
    { id: 'au_lens', ev: 'race', s: 544, d: 8.5, y: 5.2, name: '웨이모 라이다 렌즈', line: '경쟁사 라이다 렌즈다. 카메라 여덟 개면 충분한데 말이야.' },
    { id: 'au_horn', ev: 'ut', place: 'Stark Center for Physical Culture and Sports', y: 1.6, name: '롱혼 뿔 장식', line: '훅 뎀 혼스! 보닛에 달면 공기저항 300% 증가.' },
  ],
  zones: [[-200, 'sixth'], [1500, 'downtown'], [B_BR0, 'river'], [B_BR1, 'capitol']],
  bridge: { b0: B_BR0, b1: B_BR1, g0: B_GAP0, g1: B_GAP1 },
  gaps: [{ s0: B_GAP0, s1: B_GAP1, respawn: B_GAP0 - 150 }],
  trafficMaxS: B_GAP0 - 40,
  cx: curve(38, 16),
  ramps: [
    { s0: 260, len: 16, dL: -12, dR: -5, h: 2.6 }, { s0: 420, len: 16, dL: 5, dR: 12, h: 2.6 }, { s0: 620, len: 18, dL: -6, dR: 6, h: 3.2 },
    { s0: 860, len: 14, dL: -12, dR: -6, h: 2.4 }, { s0: 860, len: 14, dL: 6, dR: 12, h: 2.4 }, { s0: 1120, len: 16, dL: -3, dR: 6, h: 4.0 },
    ...rampRun(1380, 3450, 230, 1),
    { s0: B_GAP0 - 20, len: 20, dL: -ROAD_HALF, dR: ROAD_HALF, h: 2.6 },
  ],
  legend: { s: 1120 + 16 + 30, d: 1.5, y: 11 },
  road: { yellow: true, dashes: [0.25, 0.75] },
  env: {
    sky: { top: [0.06, 0.04, 0.17], mid: [0.42, 0.12, 0.36], hor: [1.0, 0.45, 0.25], low: [0.29, 0.13, 0.25], glow: [1.0, 0.55, 0.25] },
    sunDir: [-0.35, 0.16, -1], sun: ['#ffb27a', 2.4], hemi: ['#9d7be0', '#2a1712', 0.7],
    fog: ['#4a2346', 160, 1100], hdri: 'assets/city_sunset_rgbe_gray.png', exposure: 0.92,
    envUpsideDown: true, // the look stage 1 was tuned with: reflections take the warm street, not the bright sky
  },
  traffic: TRAFFIC,
  boss: 'waymo',
  bossOpts: { appearAt: 430, giveUpAt: B_GAP0 - 80, hp: 130 },
  radio: [
    [25, '오스틴에 온 걸 환영해. 로보택시가 처음 달리기 시작한 도시야.'],
    [330, '저 하얀 웨이모들 지붕에 도는 거 보이지? 라이다야. 빨간 빛에 걸리면 겁먹고 급정거해.'],
    [1050, '저 위에 보라색으로 빛나는 거, 전설의 블랙웰 칩이야. 큰 경사로에서 점프 버튼까지 같이 눌러봐.'],
    [1550, '다운타운이야. 이 빌딩들 전부 데이터센터로 바꾸면 딱인데.'],
    [B_GAP0 - 170, '다리가 끊겼어! 텍사스 교통국 또 일 안 했네. 속도 유지하고 경사로에서 점프!'],
  ],
  lines: { finish: '착지 완벽. 다음 목적지는 LA야. 준비해둬.', fall: ['풍덩!', '콜로라도강에 빠졌어요 · +2초', '괜찮아, 로드스터는 방수야. 아마도. 다시 가자!'] },
  stars: { time: 62, text: '완주 · 웨이모 마더십 격추 · 62초 이내 또는 퍼펙트 랜딩 3회' },
  poster: { s: 820, d: 2.2, y: 3.6, boss: [30, -5, 10.5] },
  finishText: 'FINISH · 텍사스 주의회 의사당',
  text: {
    eyebrow: 'STAGE 01 · ROBOTAXI CITY', title: 'AUSTIN, TX', sub: '로보택시가 처음 달린 도시',
    tip: '<b>TIP</b> 노란 경사로에서 점프하고, 공중에서 점프 버튼을 <b>꾹 누르면</b> 압축공기를 뿜으며 사뿐히 착지해요. 퍼펙트 랜딩은 속도 보너스. 점프는 시간이 지나면 다시 충전돼요.',
    tweet: '로보택시는 오늘도 오스틴에서 영업 중. 웨이모는 아직 라이다한테 길 물어보는 중. 다리 하나 끊겼다던데 우리 차는 날 수 있으니 상관없음.',
    meta: '오후 7:42 · 오스틴, 텍사스 · 리트윗 42만', load: '오스틴 도로를 까는 중 · 실제 차 모델 불러오는 중',
    hud: 'STAGE 1 · AUSTIN, TX', clear: 'STAGE 01 CLEAR', clearTitle: '오스틴 정복',
  },
  events: [
    {
      id: 'tutorial', name: '기가 텍사스 시운전',
      brief: '<b>연습</b> 공장 주차장에서 조향, 점프, <b>착지 분사</b>, 부스트를 하나씩 직접 해봐요. 실패하면 바로 그 자리에서 다시.',
      finish: 1250, zones: [[-200, 'lot']], bridge: null, gaps: [], trafficMaxS: 0, traffic: {}, boss: null, legend: null,
      cx: (s) => 0,
      ramps: [{ s0: 600, len: 18, dL: -ROAD_HALF, dR: ROAD_HALF, h: 3.2 }, { s0: 880, len: 16, dL: -6, dR: 6, h: 3.0 }],
      checkpoints: [],
      finishText: 'FINISH · 시운전 끝',
      poster: { s: 60, d: 2, y: 0, cam: { back: 9, side: -5, y: 2.2, ahead: 6, lookSide: 0, lookY: 1.2, fov: 46 } },
      radio: [[10, '여기 기가 텍사스야. 출고 전 시운전 한 바퀴 돌자.']],
      lines: { finish: '합격. 이 정도면 로보택시 면허도 따겠는데? 시내로 가자.' },
      mission: {
        type: 'tutorial', perfect: 1, time: 50,
        steps: [
          { text: '← → 로 초록 게이트 통과', touch: '왼쪽 엄지로 조이스틱 → 초록 게이트 통과', say: '왼쪽 화면을 누른 채 밀면 조향이야. 초록 게이트로 들어가.', hint: '게이트 쪽으로 미리 조향해요', back: 120, v: 26,
            build: (ctx) => gate(ctx, 220, -7.5), test: (ctx) => (ctx.P.s > 220 ? Math.abs(ctx.P.d + 7.5) < 3.2 : null) },
          { text: '반대쪽 게이트로!', touch: '반대쪽 게이트로!', say: '좋아. 이번엔 반대쪽.', hint: '게이트 쪽으로 미리 조향해요', back: 245, v: 30,
            build: (ctx) => gate(ctx, 330, 7.5), test: (ctx) => (ctx.P.s > 330 ? Math.abs(ctx.P.d - 7.5) < 3.2 : null) },
          { text: 'Space로 점프해서 바리케이드 넘기', touch: '점프 버튼으로 바리케이드 넘기', say: '앞에 바리케이드! 점프로 넘어.', hint: '바리케이드 바로 앞에서 점프', back: 380, v: 34,
            build: (ctx) => barricade(ctx, 470), test: (ctx) => (ctx.P.s > 470 ? ctx.P.y > 0.9 : null) },
          { text: '경사로 점프 → 링이 금색일 때 Space 꾹', touch: '경사로 점프 → 링이 금색일 때 점프 꾹', say: '이제 진짜 기술. 공중에서 바닥에 링이 보이지? 금색이 되는 순간 점프를 꾹 눌러.', hint: '링이 금색이 되면 점프를 꾹 (착지까지 유지)', back: 520, v: 40,
            on: (evt, grade, ctx) => (evt === 'land' && ctx.P.s > 610 ? grade === 'perfect' : null) },
          { text: 'Shift로 부스트!', touch: '부스트 버튼!', say: '퍼펙트 착지로 부스트가 찼어. 쏴!', hint: '부스트 게이지가 차면 Shift', back: 700, v: 40,
            test: (ctx) => (ctx.P.boostT > 0 && ctx.P.launchT <= 0 ? true : null) },
          { text: '점프 중 ← 또는 → = 배럴롤', touch: '점프 중 조이스틱 옆으로 = 배럴롤', say: '마지막. 점프하면서 옆으로 밀면 배럴롤. 착지까지 이으면 콤보야.', hint: '경사로에서 점프 + 방향', back: 800, v: 44,
            on: (evt, d) => (evt === 'trick' && d.name === '배럴롤' ? true : null) },
        ],
      },
      text: { clear: 'TEST DRIVE CLEAR', clearTitle: '시운전 합격' },
    },
    {
      id: 'deliver', name: '첫 손님 배송',
      brief: '<b>배송</b> 진짜 오스틴 시내 지도예요. 레이니 스트리트에서 주의회 의사당까지 손님 넷을 내려 줘요. 초록 정차 구역에서 <b>↓ 브레이크</b>로 거의 멈춰야 내려요.',
      // a real route on OpenStreetMap streets; the stops are the real places it passes
      route: { from: 'Rainey Street Historic District', via: ["Esther's Follies", 'Mexic-Arte Museum', 'Austin Central Library', 'Moody Theater'], to: 'Texas State Capitol' },
      zones: [[-200, 'downtown']], bridge: null, gaps: [], trafficMaxS: 9000,
      forks: (L, R) => bigTurns(R, 1).map((t) => ({ at: t.s, name: '정상 경로' })),
      boss: null, legend: null,
      ramps: (L) => rampRun(380, L - 200, 300, 3),
      traffic: more(1.0),
      mission: { type: 'deliver', time: 140, allowMiss: 1, stops: [
        { place: "Esther's Follies", name: '에스더스 폴리스', thanks: '코미디 쇼 늦지 않았어요!', line: '첫 손님 내렸다. 6번가 코미디 극장이야.' },
        { place: 'Mexic-Arte Museum', name: '멕시카르테 미술관', thanks: '그라시아스!' },
        { place: 'Austin Central Library', name: '오스틴 중앙도서관', thanks: '반납 기한 딱 맞췄어요', line: '도서관 옥상 정원 봤어? 거기서 GPU 식히면 딱인데.' },
        { place: 'Moody Theater', name: '무디 시어터', thanks: 'ACL 녹화 시작 전이에요!' },
      ] },
      radio: [[20, '오늘은 로보택시 알바야. 진짜 오스틴 길이야. 네비 보고 회전 놓치지 마.'], [900, '웨이모는 라이다에 걸리면 급정거해. 거리 두고.']],
      lines: { finish: '주의회 의사당 도착. 우버보다 빠르고, 웨이모보다 덜 멈췄어.', failed: '손님들이 별점 테러 중이야… 다시 가자.' },
      poster: { s: 300, d: -6, y: 0, cam: { back: 10, side: 3, y: 2.6, ahead: 8, lookSide: -3, lookY: 1.4, fov: 46 } },
      finishText: 'FINISH · 텍사스 주의회 의사당',
      text: { clear: 'DELIVERY DONE', clearTitle: '배송 완료' },
    },
    {
      id: 'stunt', name: '6번가 스턴트 쇼',
      brief: '<b>스턴트</b> 진짜 6번가를 동쪽 끝에서 시호름 발전소까지. 차 옆 아슬아슬 추월, 점프 중 배럴롤, 퍼펙트 착지를 이어 <b>콤보 배수</b>를 키워요. 버스 행렬 지붕 위가 점수 노다지.',
      route: { from: 'Republic of Texas Museum', via: ['Driskill Hotel'], to: 'Seaholm Power Plant' },
      zones: [[-200, 'sixth']], bridge: null, gaps: [], trafficMaxS: 9000,
      forks: (L, R) => bigTurns(R, 1).map((t) => ({ at: t.s, name: '정상 경로' })),
      boss: null,
      ramps: (L) => { const j = [Math.round(L * 0.32) - 40, Math.round(L * 0.68) - 40];
        return [...rampRun(260, L - 150, 170, 0).filter((r) => j.every((s) => Math.abs(r.s0 - s) > 110)), ...j.map((s0) => ({ s0, len: 18, dL: -ROAD_HALF, dR: ROAD_HALF, h: 3.4 }))]; }, // full width: every lane can hop the jam
      jams: (L) => [[Math.round(L * 0.32), Math.round(L * 0.32) + 140], [Math.round(L * 0.68), Math.round(L * 0.68) + 150]], jamMix: { bus: 3, waymo: 2, robotaxi: 2 },
      traffic: more(1.5),
      legend: null,
      mission: { type: 'stunt', scores: [7000, 14000, 24000] },
      radio: [[20, '오늘 6번가 스턴트 쇼야. 진짜 그 거리야. 아슬아슬 추월, 배럴롤, 퍼펙트 착지. 끊지 말고 이어 붙여.'], [500, '저 정체 구간 보이지? 지붕 위로 달리면 점수 폭발이야.']],
      lines: { finish: '관객들 난리 났어. 다음은 콩그레스 다리야.', failed: '박수가 좀 약했어. 콤보를 끊지 말고 이어 봐.' },
      poster: { s: 400, d: 2, y: 0, cam: { back: 9, side: -4, y: 1.6, ahead: 10, lookSide: -2, lookY: 2.6, fov: 46 } },
      finishText: 'FINISH · 시호름 발전소',
      text: { clear: 'SHOW TIME', clearTitle: '스턴트 쇼 성공' },
    },
    {
      id: 'soco', name: '콩그레스 다리 드래그',
      brief: '<b>레이스</b> 주의회 의사당에서 콩그레스 애비뉴를 쭉 내려가 레이디버드 호수 다리를 건너 사우스 콩그레스의 \'I love you so much\' 벽화까지. 로보택시 셋과 직선 승부. 깜빡이 반대쪽으로 추월해요.',
      route: { from: 'Texas State Capitol', via: ['Congress Avenue'], to: [-400, 2075] }, // on South Congress right by the mural (its own node is round the corner)
      zones: [[-200, 'downtown']], bridge: null, gaps: [], trafficMaxS: 9000,
      boss: null, legend: null,
      ramps: (L) => rampRun(300, L - 150, 230, 1),
      traffic: more(0.8),
      mission: { type: 'rivals', time: 50, perfect: 2, rivals: [
        { type: 'robotaxi', name: '로보택시 #1', label: 'ROBOTAXI 1', speed: 56, d: -3, s: 24 },
        { type: 'robotaxi', name: '로보택시 #2', label: 'ROBOTAXI 2', speed: 58, d: 9, s: 30 },
        { type: 'waymo', name: '웨이모 원', label: 'WAYMO', speed: 59, d: -9, s: 36, tagColor: '#ffc83d' },
      ] },
      radio: [[20, '콩그레스 애비뉴 직선이야. 끝에 다리 지나면 박쥐 150만 마리 사는 곳.'], [1150, '호수 위다! 부스트 아끼지 마.'], [1900, '저 벽화 앞에서 다들 사진 찍어. 우리 차가 배경이 될 차례야.']],
      lines: { finish: '다리 위에서 다 제쳤어. 박쥐들도 박수 치는 중.', failed: '직선에서 졌다고? 퍼펙트 착지 부스트로 붙어.' },
      poster: { s: 200, d: 3, y: 0, cam: { back: 11, side: -6, y: 2.4, ahead: 12, lookSide: 2, lookY: 1.6, fov: 44 } },
      finishText: 'FINISH · I LOVE YOU SO MUCH',
      text: { clear: 'CONGRESS WINNER', clearTitle: '드래그 레이스 우승' },
    },
    {
      id: 'race', name: 'I-35 로보택시 레이스',
      brief: '<b>레이스</b> 로보택시 3대와 I-35 고속도로 결승. 상대는 차선을 바꾸기 전에 <b>깜빡이</b>를 켜요. 깜빡이 반대쪽으로 추월하고, 경사로 지름길과 퍼펙트 착지 부스트로 앞질러요.',
      finish: 5200, zones: [[-200, 'highway']], bridge: null, gaps: [], trafficMaxS: 5400,
      // I-35: long sweepers, then the construction detour: two hairpins (a switchback) and back onto the main line
      turns: [{ s: 700, a: 0.5, r: 400 }, { s: 1500, a: -0.7, r: 350 }, { s: 2350, a: Math.PI, r: 48 }, { s: 2850, a: -Math.PI, r: 52 }, { s: 3700, a: 0.6, r: 300 }, { s: 4500, a: -0.45, r: 380 }],
      boss: null, legend: null,
      ramps: rampRun(500, 5000, 300, 2),
      traffic: more(0.9, { waymo: { n: 6 }, bus: { n: 1 }, robotaxi: { n: 5 } }),
      mission: { type: 'rivals', time: 100, perfect: 3, rivals: [
        { type: 'robotaxi', name: '로보택시 #1', label: 'ROBOTAXI 1', speed: 57, d: -3, s: 24 },
        { type: 'robotaxi', name: '로보택시 #2', label: 'ROBOTAXI 2', speed: 59, d: 9, s: 30 },
        { type: 'robotaxi', name: '로보택시 #3', label: 'ROBOTAXI 3', speed: 61, d: -9, s: 38, tagColor: '#ffc83d' },
      ] },
      radio: [[20, '로보택시 셋이 결승 붙자는데? 앞에서 깜빡이 켜는 거 잘 봐. 그쪽으로 들어온다는 뜻이야.'], [1800, '3번이 제일 빨라. 경사로 퍼펙트 착지 부스트로 따라잡아.'], [4300, '마지막 1km! 부스트 아끼지 마.']],
      lines: { finish: '로보택시 셋 다 백미러 속이야. 이제 마더십 잡으러 가자.', failed: '로보택시한테 졌다고? 깜빡이 보고 반대쪽으로 빠져.' },
      poster: { s: 600, d: 3, y: 0, cam: { back: 11, side: -6, y: 2.4, ahead: 12, lookSide: 2, lookY: 1.6, fov: 44 } },
      text: { clear: 'I-35 WINNER', clearTitle: '레이스 우승' },
    },
    {
      id: 'ut', name: '게임데이 UT 셔틀',
      brief: '<b>배송</b> 롱혼스 경기 날. 시호름에서 출발해 주의회 의사당을 돌아 UT 캠퍼스까지 팬들을 실어 날라요. 도로는 진짜 오스틴 지도 그대로.',
      route: { from: 'Seaholm Power Plant', via: ['Austin Central Library', 'Texas State Capitol', 'Stark Center for Physical Culture and Sports'], to: 'Bates Recital Hall' },
      zones: [[-200, 'downtown']], bridge: null, gaps: [], trafficMaxS: 9000,
      forks: (L, R) => bigTurns(R, 2).map((t) => ({ at: t.s, name: '정상 경로' })),
      boss: null, legend: null,
      ramps: (L) => rampRun(380, L - 200, 320, 2),
      traffic: more(1.2),
      mission: { type: 'deliver', time: 170, allowMiss: 1, stops: [
        { place: 'Austin Central Library', name: '중앙도서관 앞 팬', thanks: '훅 뎀 혼스!' },
        { place: 'Texas State Capitol', name: '의사당 앞 응원단', thanks: '응원가 시작!', line: '의사당 앞 응원단 태웠어. 다음은 캠퍼스.' },
        { place: 'Stark Center for Physical Culture and Sports', name: '스타크 센터', thanks: '킥오프 전에 도착!' },
      ] },
      radio: [[20, '오늘 롱혼스 경기야. 팬들 태우고 캠퍼스까지. 네비 회전 안내 잘 봐.']],
      lines: { finish: '킥오프 전에 도착. 오늘 MVP는 우리 차야.', failed: '팬들이 1쿼터 놓쳤대… 다시 가자.' },
      poster: { s: 300, d: -6, y: 0, cam: { back: 10, side: 3, y: 2.6, ahead: 8, lookSide: -3, lookY: 1.4, fov: 46 } },
      finishText: 'FINISH · UT 캠퍼스',
      text: { clear: 'GAME DAY', clearTitle: '셔틀 완료' },
    },
    {
      id: 'boss', name: '웨이모 마더십',
      brief: '<b>보스전</b> 라이다 47개짜리 마더십이 6번가부터 다운타운까지 쫓아와요. 빨간 줄 차선은 피하고, 칩을 모아 <b>F(⚡) 코일</b>, 경사로 점프로 <b>몸통 박치기</b>. 끝엔 끊긴 다리가 기다려요.',
      mission: { type: 'boss', time: 95, perfect: 4 },
    },
  ],
  build,
};

// ---------- scenery ----------
const NEON = [['6TH ST', '#ff3d9a'], ['LIVE MUSIC', '#38f5ff'], ['DOGE BBQ', '#ffc83d'], ['KEEP AUSTIN WEIRD', '#b07dff'], ['TACOS', '#ff7a3d'], ['GPU PAWN', '#3dff9a'], ['ROBOTAXI', '#ffffff'], ['라이다 수리점', '#ff3d6e'], ['QUESO 24H', '#ffc83d'], ['H100 삽니다', '#3dff9a']];

function zoneFn(T) {
  const z = T.zones || [[-1e9, 'sixth']];
  return (s) => { let k = z[0][1]; for (const [a, kind] of z) if (s >= a) k = kind; return k; };
}

function build(k) {
  const T = k.ST, FIN = T.finish, br = T.bridge, zone = zoneFn(T);
  const { scene, M, ribbon, wall, crossWall, world, frame } = k;
  const end = FIN + 420;
  const wet = (a, b) => !br || b < br.b0 || a > br.b1;
  // ground split by the river
  if (k.CITY) k.buildCity();
  else for (const [a, b] of br ? [[-400, br.b0], [br.b1, end + 400]] : [[-400, end + 400]]) {
    for (const [l, r] of [[-500, -15.5], [15.5, 500]]) {
      const g = new THREE.Mesh(ribbon(a, b, l, r, 20, () => -0.05, 20), M.ground); g.receiveShadow = true; scene.add(g);
    }
  }
  // sidewalks (concrete shoulders and sound walls on the highway)
  for (const [a0, b0] of br ? [[-120, br.b0], [br.b1, end]] : [[-120, end]]) {
    for (const [l, r, side] of [[-15.5, -ROAD_HALF, -1], [ROAD_HALF, 15.5, 1]]) for (const [a, b] of k.sideRuns(a0, b0, side)) {
      const w = new THREE.Mesh(ribbon(a, b, l, r, 4, () => 0.12, 3.5), M.walk); w.receiveShadow = true; scene.add(w);
    }
  }
  buildHighway(k, zone, end);
  if (br) buildBridge(k, br);
  if (!k.CITY) buildBuildings(k, zone, end, br);
  buildStreetlights(k, zone, end, br);
  buildLandmarks(k, zone, br);
  k.finishArch(T.finishText || 'FINISH');
}

function buildBridge(k, br) {
  const { scene, M, ribbon, wall, crossWall, world, frame } = k;
  scene.add(new THREE.Mesh(ribbon(br.b0 - 1, br.b1 + 1, -500, 500, 10, () => -6), M.water));
  scene.add(new THREE.Mesh(crossWall(br.b0, -500, 500, -6.2, 0), M.dirt));
  scene.add(new THREE.Mesh(crossWall(br.b1, -500, 500, -6.2, 0), M.dirt));
  for (const [a, b] of [[br.b0, br.g0], [br.g1, br.b1]]) {
    scene.add(new THREE.Mesh(ribbon(a, b, -ROAD_HALF - 1, ROAD_HALF + 1, 5, () => -0.9), M.concrete));
    for (const d of [-ROAD_HALF - 0.6, ROAD_HALF + 0.6]) scene.add(new THREE.Mesh(wall(a, b, d, 4, () => -0.9, () => 1.1), M.concrete));
  }
  scene.add(new THREE.Mesh(crossWall(br.g0, -ROAD_HALF - 1, ROAD_HALF + 1, -0.9, 0), M.concrete));
  scene.add(new THREE.Mesh(crossWall(br.g1, -ROAD_HALF - 1, ROAD_HALF + 1, -0.9, 0), M.concrete));
  const pillarGeo = new THREE.CylinderGeometry(1.1, 1.3, 6, 12);
  for (let s = br.b0 + 12; s < br.b1; s += 26) {
    if (s > br.g0 - 4 && s < br.g1 + 4) continue;
    for (const d of [-7, 7]) { const p = new THREE.Mesh(pillarGeo, M.concrete); world(s, d, -3.9, p.position); scene.add(p); }
  }
  const barrierMat = new THREE.MeshStandardMaterial({ color: '#ff6a1a', emissive: '#ff4a00', emissiveIntensity: 0.6 });
  for (let d = -10; d <= 10; d += 10) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 0.3), barrierMat); world(br.g0 - 1.2, d === 0 ? 14 : d * 1.3, 0.5, b.position); b.rotation.y = frame(br.g0).yaw; scene.add(b);
  }
  k.addBillboard(br.g0 - 140, -17, 9, '다리 끊김! 점프!', '#ff6a1a', 11, 3.4);
  k.addBillboard(br.g0 - 320, 17, 9, 'BRIDGE OUT', '#ff6a1a', 11, 3.4);
  // trees by the river
  const treeGeo = new THREE.ConeGeometry(2.4, 7, 7); treeGeo.translate(0, 3.5, 0);
  const trees = new THREE.InstancedMesh(treeGeo, new THREE.MeshStandardMaterial({ color: '#1f3a2c', roughness: 0.9 }), 120);
  const m4 = new THREE.Matrix4(), p = new THREE.Vector3();
  for (let i = 0; i < 120; i++) {
    const s = (i % 2 ? br.b1 + 4 + Math.random() * 60 : br.b0 - 4 - Math.random() * 60), d = (Math.random() < 0.5 ? -1 : 1) * (18 + Math.random() * 120);
    world(s, d, 0, p); const kk = 0.7 + Math.random() * 0.8; m4.makeScale(kk, kk * (0.8 + Math.random() * 0.6), kk).setPosition(p); trees.setMatrixAt(i, m4);
  }
  scene.add(trees);
}

// I-35: concrete sound walls, overhead sign gantries, an elevated deck in the distance
function buildHighway(k, zone, end) {
  const { scene, M, wall, world, frame, textTex } = k;
  let a = null;
  const runs = [];
  for (let s = -120; s <= end; s += 20) { const on = zone(s) === 'highway'; if (on && a == null) a = s; if ((!on || s + 20 > end) && a != null) { runs.push([a, s]); a = null; } }
  for (const [s0, s1] of runs) {
    for (const d of [-16, 16]) scene.add(new THREE.Mesh(wall(s0, s1, d, 6, () => 0, () => 4.2, 6), M.concrete));
    const signs = [['I-35 N · 다운타운', '#3dff9a'], ['로보택시 전용 차로', '#ffffff'], ['GIGA TEXAS 출구 2km', '#3dff9a'], ['웨이모 감속 구간', '#ffc83d'], ['오스틴 · 댈러스 300km', '#3dff9a']];
    const postMat = new THREE.MeshStandardMaterial({ color: '#5d6168', metalness: 0.7, roughness: 0.4 });
    let i = 0;
    for (let s = s0 + 300; s < s1 - 100; s += 620, i++) {
      for (const d of [-14.8, 14.8]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 10.5, 0.5), postMat); world(s, d, 5.25, p.position); p.rotation.y = frame(s).yaw; scene.add(p); }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(30, 0.6, 0.6), postMat); world(s, 0, 10.2, beam.position); beam.rotation.y = frame(s).yaw; scene.add(beam);
      const [t, c] = signs[i % signs.length];
      const sg = new THREE.Mesh(new THREE.PlaneGeometry(13, 3), new THREE.MeshBasicMaterial({ map: textTex(t, '#ffffff', { w: 1024, h: 230, size: 96, bg: c === '#ffc83d' ? '#6a4a00' : '#0b5a2a', glow: 4 }), side: THREE.DoubleSide, toneMapped: false }));
      sg.material.color.setScalar(1.15); world(s + 0.4, -5, 8.6, sg.position); sg.lookAt(world(s - 40, -5, 8.6)); scene.add(sg);
    }
  }
}

function buildBuildings(k, zone, end, br) {
  const { scene, world, Q, FACADES, textTex } = k;
  const neonMats = NEON.map(([t, c]) => {
    const m = new THREE.MeshBasicMaterial({ map: textTex(t, c, { size: t.length > 9 ? 56 : 84 }), transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    m.color.setScalar(2.2); return m;
  });
  const items = [];
  for (let s = -60; s < end; s += Q.bStep) {
    if (br && s > br.b0 - 30 && s < br.b1 + 30) continue;
    const z = zone(s);
    for (const side of [-1, 1]) {
      if (z === 'lot') { if (side < 0) continue; } // Giga Texas fills the left
      if (z === 'capitol') continue;
      const hw = z === 'highway';
      const H = { downtown: [30, 110], sixth: [9, 16], rainey: [18, 50], east: [6, 10], lot: [8, 6], highway: [8, 30] }[z] || [6, 14];
      if (hw && Math.random() < 0.55) continue;
      const h = H[0] + Math.random() * H[1];
      const dp = 10 + Math.random() * 12, w = Q.bStep * (0.6 + Math.random() * 0.35);
      const face = hw ? 40 + Math.random() * 60 : z === 'lot' ? 40 : ROAD_HALF + 5 + Math.random() * 3;
      if (k.forkZone(s, side * (face + 2), 12)) continue;
      items.push({ s, d: side * (face + dp / 2), h, dp, w, side, face, z });
      if (Math.random() < (hw ? 0.4 : 0.7)) items.push({ s: s + Q.bStep / 2, d: side * (face + dp + 14 + Math.random() * 30), h: h * (1 + Math.random()), dp: 14, w: Q.bStep * 0.8, side, z });
    }
  }
  const kinds = FACADES.map(() => []);
  for (const b of items) {
    const kk = b.z === 'downtown' || b.z === 'rainey' ? (Math.random() < 0.55 ? 0 : 1) : b.z === 'sixth' ? (Math.random() < 0.7 ? 2 : 3) : (Math.random() < 0.6 ? 3 : 2);
    kinds[b.face ? kk : (b.h > 40 ? 1 : kk)].push(b);
  }
  k.placeBuildings(kinds);
  const signGeo = new THREE.PlaneGeometry(7, 2.2);
  for (const b of items) {
    if (!b.face || b.z === 'highway' || b.z === 'lot') continue;
    if (!(b.z === 'sixth' || b.z === 'downtown' || Math.random() < 0.25) || Math.random() < 0.35) continue;
    const m = new THREE.Mesh(signGeo, neonMats[(Math.random() * neonMats.length) | 0]);
    const y = 4 + Math.random() * Math.min(6, b.h - 3);
    world(b.s, b.side * (b.face - 0.25), y, m.position);
    m.lookAt(world(b.s, 0, y)); scene.add(m);
  }
}

function buildStreetlights(k, zone, end, br) {
  const { scene, world } = k;
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 8, 6); poleGeo.translate(0, 4, 0);
  const bulbGeo = new THREE.SphereGeometry(0.42, 10, 8);
  const list = [];
  for (let s = 0; s < end - 300; s += 36) for (const side of [-1, 1]) if (!k.forkZone(s + (side > 0 ? 18 : 0), side * 14)) list.push([s + (side > 0 ? 18 : 0), side]);
  const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshStandardMaterial({ color: '#2b2a30', metalness: 0.7, roughness: 0.4 }), list.length);
  const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.4, 1.5), toneMapped: false });
  const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, list.length);
  const m4 = new THREE.Matrix4(), p = new THREE.Vector3();
  list.forEach(([s, side], i) => {
    const bridge = br && s > br.b0 && s < br.b1;
    world(s, side * (bridge ? 13.2 : 14), bridge ? 1 : 0.1, p); m4.makeTranslation(p.x, p.y, p.z); poles.setMatrixAt(i, m4);
    world(s, side * 12.6, p.y + 7.8, p); m4.makeTranslation(p.x, p.y, p.z); bulbs.setMatrixAt(i, m4);
  });
  scene.add(poles, bulbs);
}

function buildLandmarks(k, zone, br) {
  const { scene, world, frame, textTex } = k;
  const T = k.ST;
  // Giga Texas: the start of the original run, the whole left side of the test-drive lot
  const lot = zone(0) === 'lot';
  if (k.CITY) return; // real downtown streets: the OSM buildings stand in for everything here
  const giga = new THREE.Mesh(new THREE.BoxGeometry(lot ? 90 : 70, 26, lot ? 1300 : 200), new THREE.MeshStandardMaterial({ color: '#b9b6c4', roughness: 0.55, metalness: 0.2 }));
  world(lot ? 600 : 60, lot ? -68 : -58, 13, giga.position); giga.rotation.y = frame(60).yaw; giga.receiveShadow = true; scene.add(giga);
  for (const s of lot ? [150, 650, 1150] : [60]) {
    const gs = new THREE.Mesh(new THREE.PlaneGeometry(40, 7), new THREE.MeshBasicMaterial({ map: textTex('GIGA TEXAS', '#ff2a3a', { w: 1024, h: 180, size: 130, glow: 18 }), transparent: true, toneMapped: false }));
    gs.material.color.setScalar(2); world(s, lot ? -22.9 : -22.9, 15, gs.position); gs.lookAt(world(s, 0, 15)); scene.add(gs);
  }
  if (lot) {
    // test-lot paint: white bays on the right
    const bay = new THREE.MeshBasicMaterial({ color: '#d8d8e0' });
    for (let s = 40; s < T.finish; s += 6) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 5), bay); m.rotation.x = -Math.PI / 2; world(s, 21, 0.14, m.position); m.rotation.z = frame(s).yaw; scene.add(m); }
  }
  // Texas State Capitol beyond the boss run's finish
  if (zone(T.finish + 300) !== 'capitol') return;
  const capMat = new THREE.MeshStandardMaterial({ color: '#d8a48c', roughness: 0.7, emissive: '#5a2a1a', emissiveIntensity: 0.25 });
  const cap = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(90, 18, 40), capMat); base.position.y = 9; cap.add(base);
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(12, 13, 16, 32), capMat); drum.position.y = 26; cap.add(drum);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(12, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), capMat); dome.position.y = 34; cap.add(dome);
  const lant = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2, 7, 12), capMat); lant.position.y = 49; cap.add(lant);
  const star = new THREE.Mesh(new THREE.SphereGeometry(1.2, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3, 1.5), toneMapped: false })); star.position.y = 53.5; cap.add(star);
  world(T.finish + 330, 0, 0, cap.position); cap.rotation.y = frame(T.finish + 330).yaw; scene.add(cap);
}

// ---------- tutorial props ----------
function gate(ctx, s, d) {
  const { THREE: T, world, frame, textTex } = ctx.kit;
  const g = new T.Group();
  const mat = new T.MeshBasicMaterial({ color: new T.Color(0.4, 3, 1.3), toneMapped: false });
  for (const o of [-2.6, 2.6]) { const p = new T.Mesh(new T.CylinderGeometry(0.18, 0.18, 4, 8), mat); p.position.set(o, 2, 0); g.add(p); }
  const top = new T.Mesh(new T.BoxGeometry(5.6, 0.3, 0.3), mat); top.position.y = 4; g.add(top);
  const tag = new T.Mesh(new T.PlaneGeometry(5, 1.2), new T.MeshBasicMaterial({ map: textTex('여기로!', '#3dff9a', { w: 512, h: 120, size: 80 }), transparent: true, depthWrite: false, toneMapped: false, side: T.DoubleSide }));
  tag.position.y = 5; g.add(tag);
  world(s, d, 0, g.position); g.rotation.y = frame(s).yaw; ctx.add(g);
  return { tick: (t) => { tag.position.y = 5 + Math.sin(t * 4) * 0.2; } };
}
function barricade(ctx, s) {
  const { THREE: T, world, frame, M } = ctx.kit;
  const g = new T.Group();
  const block = new T.Mesh(new T.BoxGeometry(ROAD_HALF * 2, 0.8, 0.6), M.ramp); block.position.y = 0.4; block.castShadow = true; g.add(block);
  world(s, 0, 0, g.position); g.rotation.y = frame(s).yaw; ctx.add(g);
  return null;
}
