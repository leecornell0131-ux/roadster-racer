// Stage 2: Los Angeles. The 405 at 3 pm: six lanes of parked traffic you drive across the roofs of,
// a copycat BYD swarm, overpasses, palms, golden hills, and the HOLLYBYD sign moved onto an overpass.
import * as THREE from 'three';

const ROAD_HALF = 18;
const FINISH_S = 3300;
const OVERPASSES = [650, 1250, 1900, 2575, 3080];
const SIGN_S = 2575;                       // the overpass carrying the sign
const GANTRIES = [
  [230, '405 NORTH', '셔먼오크스 · 할리바이드 12 mi'],
  [900, 'EXIT 54', '테슬라 슈퍼차저 · 다음 출구'],
  [1380, 'ALL LANES', 'BYD 전용 차로 (전 차로)'],
  [2150, '405 NORTH', '할리바이드 사인 · 2 mi'],
  [2950, 'DOWNTOWN LA', '결승선 · 1 mi'],
];
// the sign letters (parody of the hillside sign; the real one is trademarked)
const LETTERS = 'HOLLYBYD';
const LETTER_W = 4.6, LETTER_H = 8.6, DECK_TOP = 8.6, DECK_BOT = 7.1, O_W = 6.2;
const O_INDEX = 1;
const letterD = (i) => (i - (LETTERS.length - 1) / 2) * LETTER_W + (i === 0 ? -0.8 : i === 1 ? 0 : 0.8) + 2.5; // O over the -9 lane
// the O's opening (the letter is drawn wider than the rest so a car fits through)
const O = { d: letterD(O_INDEX), y: DECK_TOP + LETTER_H * 0.5, rx: O_W * (0.5 - 0.24 * 0.95), ry: LETTER_H * (0.5 - 0.12) };

export default {
  id: 'la', num: 2, name: 'LA',
  roadHalf: ROAD_HALF, lanes: [-15, -9, -3, 3, 9, 15], finish: FINISH_S,
  gaps: [],
  cx(s) {
    const k = THREE.MathUtils.smoothstep(s, 150, 500);
    return k * (55 * Math.sin(s / 650) + 20 * Math.sin(s / 240 + 0.6));
  },
  ramps: [
    { s0: 316, len: 16, dL: -ROAD_HALF, dR: ROAD_HALF, h: 2.4 },
    { s0: 800, len: 16, dL: -6, dR: 6, h: 3.2 },
    { s0: 1020, len: 14, dL: -18, dR: -8, h: 2.6 },
    { s0: 1020, len: 14, dL: 8, dR: 18, h: 2.6 },
    { s0: 1452, len: 16, dL: -ROAD_HALF, dR: ROAD_HALF, h: 2.4 },
    { s0: 2060, len: 16, dL: -18, dR: -6, h: 3.2 },
    { s0: 2260, len: 16, dL: 6, dR: 18, h: 3.2 },
    { s0: 2492, len: 22, dL: -18, dR: -8, h: 5.4 },   // the hidden one: line it up with the O
    { s0: 2800, len: 16, dL: -6, dR: 6, h: 3.0 },
  ],
  // parked traffic: every lane, bumper to bumper (a few holes to fall into)
  jams: [[348, 530], [1484, 1650]],
  // copycats: a wave of identical Dolphins that steer into whatever lane you're in
  swarm: { at: 1120, until: 1440, n: 12, type: 'dolphin', color: '#2f8797', name: 'BYD 카피캣' },
  // solid things overhead: overpass decks and sign gantries; holes you can fly through
  ceilings: [
    ...OVERPASSES.map((s) => ({ s0: s - 7, s1: s + 7, y0: DECK_BOT, y1: DECK_TOP + 1.1, what: '고가도로' })),
    { s0: SIGN_S - 0.6, s1: SIGN_S + 0.6, y0: DECK_TOP, y1: DECK_TOP + LETTER_H, what: '할리바이드 사인', holes: [O] },
    ...GANTRIES.map(([s]) => ({ s0: s - 0.8, s1: s + 0.8, y0: 6.2, y1: 9.6, what: '표지판' })),
  ],
  holeBonus: { xp: 300, doge: 100, text: '할리바이드 사인 통과!', sub: '+300 EXP · Ð +100' },
  legend: { s: SIGN_S, d: O.d, y: O.y },
  // a coin trail tracing the jump that threads the O (mega ramp + jump at the lip, about 190 km/h)
  pickups: Array.from({ length: 9 }, (_, i) => { const t = 0.12 + i * 0.12; return ['coin', 2514 + 53 * t, O.d, 5.4 + 26 * t - 16 * t * t + 0.7]; }),
  trafficMaxS: FINISH_S + 200,
  road: { yellow: false, dashes: [1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6], tex: 'la_road', tint: 'rgba(40,36,32,0.18)' },
  env: {
    bg: true, sun: ['#fff0d8', 2.7], hemi: ['#bcd4ff', '#8a7258', 0.55],
    fog: ['#cdbba5', 220, 1500], hdri: 'assets/la_day_rgbe_gray.png', exposure: 0.78, bgIntensity: 0.9, bloom: 0.32,
  },
  traffic: {
    waymo: { car: 'ioniq5', kit: true, name: '웨이모', speed: [22, 26], brakes: true, n: 4 },
    robotaxi: { car: 'modely', name: '테슬라 로보택시', speed: [30, 34], color: '#f2f2f0', n: 3 },
    model3: { car: 'model3', name: '모델 3', speed: [26, 32], n: 4 },
    cybertruck: { car: 'cybertruck', name: '사이버트럭', speed: [24, 29], n: 3 },
    dolphin: { car: 'dolphin', name: 'BYD 돌핀', speed: [28, 33], n: 3 },
    sealion: { car: 'sealion7', name: 'BYD 씰라이언', speed: [27, 32], n: 3 },
    bus: { car: 'torino', name: 'BYD 전기버스', speed: [15, 18], n: 1 },
  },
  jamMix: { model3: 6, robotaxi: 3, sealion: 6, dolphin: 2, cybertruck: 3, waymo: 2, bus: 1 },
  boss: 'trailer',
  radio: [
    [20, 'LA 405번 고속도로야. 세계에서 제일 긴 주차장이지.'],
    [190, '앞에 꽉 막혔어. 경사로 타고 지붕 위로 달려! 차 지붕은 원래 공짜 도로야.'],
    [420, '버스는 높으니까 점프로 넘어. 틈에 빠지면 다시 점프!'],
    [1060, '뒤에 BYD 돌핀 떼가 온다. 전부 똑같이 생겼지? 네 차선을 그대로 따라 해. 카피캣이야.'],
    [1400, '또 막혔다. 경사로로 바로 올라타!'],
    [2400, '왼쪽 끝 큰 경사로 보여? 고가도로에 올라간 할리바이드 사인, O 구멍으로 통과하면 대박이야.'],
    [3000, '다운타운 다 왔어. 결승선까지 밟아!'],
  ],
  lines: { finish: '할리우드 데뷔 성공. 다음은 샌프란시스코야. 샘이 기다리고 있대.' },
  stars: { time: 75, text: '완주 · 클론 트레일러 격추 · 75초 이내 또는 퍼펙트 랜딩 4회', perfect: 4 },
  poster: { s: 505, d: -1.5, y: 4.2, boss: [48, -5, 0], cam: { back: 12, side: -5, y: 2.2, ahead: 10, lookSide: -2, lookY: 5.2, fov: 44 } },
  text: {
    eyebrow: 'STAGE 02 · GRIDLOCK', title: 'LOS ANGELES', sub: '10차선 주차장 위를 달려라',
    tip: '<b>TIP</b> 막힌 차들의 <b>지붕 위로 착지</b>하면 그대로 달릴 수 있어요. 버스는 점프로 넘고, 틈에 빠지면 다시 점프. 고가도로 아래에선 너무 높이 뛰지 마세요.',
    tweet: '405번 고속도로 평균 시속 4km. 해결책: 차 위로 달리면 됨. 지붕은 다 공짜 도로임. 근데 뒤에서 BYD 회장님 트레일러가 클론을 계속 뽑아내는 중.',
    meta: '오후 3:15 · 로스앤젤레스 · 리트윗 88만', load: 'LA 고속도로 정체 재현 중 · 야자수 심는 중',
    hud: 'STAGE 2 · LOS ANGELES', clear: 'STAGE 02 CLEAR', clearTitle: 'LA 탈출',
  },
  build,
};

// smooth value noise for the hills
function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function noise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function hillY(s, d) {
  const a = Math.abs(d);
  const rise = THREE.MathUtils.smoothstep(a, 26, 140);
  const n = noise(s / 160, d / 160) * 0.65 + noise(s / 55, d / 55) * 0.25 + noise(s / 18, d / 18) * 0.1;
  const range = THREE.MathUtils.smoothstep(a, 300, 900) * (90 + 140 * noise(s / 420, Math.sign(d) * 3.3));
  return -0.05 + rise * (8 + 48 * n) + range;
}

function build(k) {
  const { scene, world, frame, ribbon, wall, grid, photo, M, textTex, canvasTex } = k;
  const concrete = new THREE.MeshStandardMaterial({ map: photo('la_wall_diff.jpg', { rep: [0.25, 0.25] }), normalMap: photo('la_wall_nor.jpg', { srgb: false, rep: [0.25, 0.25] }), color: '#d8d0c4', roughness: 0.88, side: THREE.DoubleSide });
  const hill = new THREE.MeshStandardMaterial({ map: photo('la_sand_diff.jpg', { rep: [1 / 30, 1 / 30] }), color: '#e6cc9a', roughness: 1 });
  const grass = new THREE.MeshStandardMaterial({ map: photo('la_hill_diff.jpg', { rep: [1 / 12, 1 / 12] }), normalMap: photo('la_hill_nor.jpg', { srgb: false, rep: [1 / 12, 1 / 12] }), color: '#f0d595', roughness: 1 });
  // golden grass: lift the green out of the photo so the hills read as dry Southern California grass
  grass.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.45, 0.4, 0.15))) * vec3(1.25, 1.0, 0.62), 0.75);'); };

  // shoulders, then golden hills rolling up to the San Gabriels
  for (const side of [-1, 1]) {
    const sh = new THREE.Mesh(ribbon(-200, FINISH_S + 700, side * ROAD_HALF, side * (ROAD_HALF + 7), 6, () => 0.01, 6), concrete); sh.receiveShadow = true; scene.add(sh);
    const [l, r] = side < 0 ? [-140, -(ROAD_HALF + 6.5)] : [ROAD_HALF + 6.5, 140];
    const near = new THREE.Mesh(grid(-300, FINISH_S + 900, l, r, 12, 6, hillY, 1), grass); near.receiveShadow = true; scene.add(near);
    const [l2, r2] = side < 0 ? [-1600, -138] : [138, 1600];
    scene.add(new THREE.Mesh(grid(-700, FINISH_S + 1600, l2, r2, 60, 40, hillY, 1), hill));
  }
  // jersey barriers both sides
  for (const side of [-1, 1]) {
    const dIn = side * (ROAD_HALF + 0.3), dOut = side * (ROAD_HALF + 0.95);
    const top = () => 1.05;
    scene.add(new THREE.Mesh(wall(-200, FINISH_S + 700, dIn, 6, () => 0, top, 4), concrete));
    scene.add(new THREE.Mesh(wall(-200, FINISH_S + 700, dOut, 6, () => 0, top, 4), concrete));
    scene.add(new THREE.Mesh(ribbon(-200, FINISH_S + 700, Math.min(dIn, dOut), Math.max(dIn, dOut), 6, top, 4), concrete));
  }
  // sound walls on some stretches
  for (const [a, b] of [[60, 520], [1100, 1700], [2700, 3200]]) for (const side of [-1, 1]) {
    const m = new THREE.Mesh(wall(a, b, side * (ROAD_HALF + 6.2), 4, (s) => 0, () => 4.6, 4), concrete); m.receiveShadow = true; scene.add(m);
  }

  buildShrubs(k);
  buildOverpasses(k, concrete);
  buildGantries(k);
  buildLights(k);
  buildPalms(k);
  buildSkyline(k);
  k.finishArch('FINISH · 다운타운 LA');
}

function buildOverpasses(k, concrete) {
  const { scene, world, frame, textTex } = k;
  const deckMat = concrete.clone(); deckMat.map = concrete.map.clone(); deckMat.map.repeat.set(12, 1); deckMat.map.needsUpdate = true;
  const railMat = concrete;
  const pillarGeo = new THREE.CylinderGeometry(0.75, 0.85, DECK_BOT, 14); pillarGeo.translate(0, DECK_BOT / 2, 0);
  const carMats = ['#f2f2f0', '#1b1c20', '#8a8f96', '#a3101a', '#1d3f8f'].map((c) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.5, roughness: 0.35 }));
  for (const s of OVERPASSES) {
    const g = new THREE.Group();
    const span = 150;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(span, DECK_TOP - DECK_BOT, 14), deckMat); deck.position.y = (DECK_TOP + DECK_BOT) / 2; deck.castShadow = deck.receiveShadow = true; g.add(deck);
    const girder = new THREE.Mesh(new THREE.BoxGeometry(span, 0.5, 11), deckMat); girder.position.y = DECK_BOT - 0.25; g.add(girder);
    for (const z of [-6.6, 6.6]) { const r = new THREE.Mesh(new THREE.BoxGeometry(span, 1.1, 0.4), railMat); r.position.set(0, DECK_TOP + 0.55, z); g.add(r); }
    for (const x of [-(ROAD_HALF + 3), ROAD_HALF + 3, -48, 48]) for (const z of [-4, 4]) { const p = new THREE.Mesh(pillarGeo, concrete); p.position.set(x, 0, z); p.castShadow = true; g.add(p); }
    // a few cars crossing the overpass (silhouettes at this distance)
    for (let i = 0; i < 4; i++) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.4, 1.9), carMats[i % carMats.length]); c.position.set(-60 + Math.random() * 120, DECK_TOP + 0.7, i % 2 ? 3 : -3); g.add(c);
    }
    if (s === SIGN_S) {
      // HOLLYBYD letters standing on the deck, the O open in the middle
      const letterMat = new THREE.MeshStandardMaterial({ color: '#f3f1ec', roughness: 0.6, metalness: 0.1 });
      const scaffold = new THREE.MeshStandardMaterial({ color: '#4a4844', metalness: 0.7, roughness: 0.5 });
      [...LETTERS].forEach((ch, i) => {
        const shape = letterShape(ch);
        const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false, curveSegments: 18 });
        geo.scale(i === O_INDEX ? O_W : LETTER_W * 0.9, LETTER_H, 1); geo.translate(0, 0, -0.25);
        const m = new THREE.Mesh(geo, letterMat); m.castShadow = true;
        m.position.set(letterD(i), DECK_TOP, 0); // extruded toward +z: the face reads correctly to the oncoming car
        g.add(m);
        for (const x of i === O_INDEX ? [-2.6, 2.6] : [-1.2, 1.2]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.16, LETTER_H, 0.16), scaffold); b.position.set(letterD(i) + x, DECK_TOP + LETTER_H / 2, -0.6); g.add(b); }
      });
    }
    // laid out with x across the freeway and z along it
    world(s, 0, 0, g.position); g.rotation.y = frame(s).yaw;
    scene.add(g);
  }
}

// block-letter outlines in a unit box (x -0.5..0.5, y 0..1); the O keeps its hole
function letterShape(ch) {
  const S = new THREE.Shape();
  const rect = (sh, x0, y0, x1, y1) => { sh.moveTo(x0, y0); sh.lineTo(x1, y0); sh.lineTo(x1, y1); sh.lineTo(x0, y1); sh.lineTo(x0, y0); };
  const t = 0.24;
  if (ch === 'O') {
    S.absellipse(0, 0.5, 0.5, 0.5, 0, Math.PI * 2, false);
    const h = new THREE.Path(); h.absellipse(0, 0.5, 0.5 - t * 0.95, 0.5 - t * 0.5, 0, Math.PI * 2, true); S.holes.push(h);
    return S;
  }
  const shapes = {
    H: [[-0.5, 0, -0.5 + t, 1], [0.5 - t, 0, 0.5, 1], [-0.5, 0.42, 0.5, 0.58]],
    L: [[-0.5, 0, -0.5 + t, 1], [-0.5, 0, 0.5, t * 0.8]],
    Y: [[-0.12, 0, 0.12, 0.55], [-0.5, 0.55, 0.5, 0.7], [-0.5, 0.7, -0.5 + t, 1], [0.5 - t, 0.7, 0.5, 1]],
    B: [[-0.5, 0, -0.5 + t, 1], [-0.5, 0, 0.32, 0.18], [-0.5, 0.42, 0.3, 0.58], [-0.5, 0.82, 0.3, 1], [0.26, 0, 0.5, 0.5], [0.22, 0.5, 0.46, 1]],
    D: [[-0.5, 0, -0.5 + t, 1], [-0.5, 0, 0.3, 0.18], [-0.5, 0.82, 0.3, 1], [0.26, 0.1, 0.5, 0.9]],
  }[ch] || [[-0.5, 0, 0.5, 1]];
  // union of rectangles as separate sub-paths of one shape is fine for extrusion
  const [first, ...rest] = shapes;
  rect(S, ...first);
  const all = [S];
  for (const r of rest) { const s = new THREE.Shape(); rect(s, ...r); all.push(s); }
  return all;
}

function buildGantries(k) {
  const { scene, world, frame, canvasTex } = k;
  const steel = new THREE.MeshStandardMaterial({ color: '#8d9196', metalness: 0.8, roughness: 0.45 });
  for (const [s, big, small] of GANTRIES) {
    const g = new THREE.Group();
    for (const x of [-(ROAD_HALF + 1.6), ROAD_HALF + 1.6]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 9.4, 0.5), steel); p.position.set(x, 4.7, 0); p.castShadow = true; g.add(p); }
    for (const y of [6.4, 9.2]) { const b = new THREE.Mesh(new THREE.BoxGeometry(2 * ROAD_HALF + 4, 0.3, 0.3), steel); b.position.set(0, y, 0); g.add(b); }
    for (let x = -ROAD_HALF; x <= ROAD_HALF; x += 3) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.8, 0.12), steel); d.position.set(x, 7.8, 0); d.rotation.z = 0.8; g.add(d); }
    const tex = canvasTex(1024, 300, (c, w, h) => {
      c.fillStyle = '#0d6b3a'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#f2f2ea'; c.lineWidth = 10; c.strokeRect(14, 14, w - 28, h - 28);
      c.fillStyle = '#f2f2ea'; c.textAlign = 'center';
      c.font = '700 120px "Chakra Petch", "Noto Sans KR", sans-serif'; c.fillText(big, w / 2, 140);
      c.font = '900 64px "Noto Sans KR", sans-serif'; c.fillText(small, w / 2, 240);
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(13, 3.8), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.2, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.12 }));
    sign.position.set(((s / 7) | 0) % 2 ? 7 : -7, 7.8, 0.25); g.add(sign);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(13, 3.8), steel); back.position.copy(sign.position); back.position.z -= 0.05; back.rotation.y = Math.PI; g.add(back);
    world(s, 0, 0, g.position); g.rotation.y = frame(s).yaw;
    scene.add(g);
  }
}

function buildLights(k) {
  const { scene, world } = k;
  const poleGeo = new THREE.CylinderGeometry(0.11, 0.16, 11, 6); poleGeo.translate(0, 5.5, 0);
  const armGeo = new THREE.BoxGeometry(2.6, 0.16, 0.2); armGeo.translate(-1.3, 0, 0);
  const headGeo = new THREE.BoxGeometry(0.8, 0.2, 0.4);
  const steel = new THREE.MeshStandardMaterial({ color: '#8d9196', metalness: 0.8, roughness: 0.45 });
  const list = [];
  for (let s = 0; s < FINISH_S + 200; s += 64) for (const side of [-1, 1]) list.push([s + (side > 0 ? 32 : 0), side]);
  const poles = new THREE.InstancedMesh(poleGeo, steel, list.length), arms = new THREE.InstancedMesh(armGeo, steel, list.length), heads = new THREE.InstancedMesh(headGeo, steel, list.length);
  const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
  list.forEach(([s, side], i) => {
    const yaw = k.frame(s).yaw + (side > 0 ? 0 : Math.PI);
    q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, yaw + Math.PI / 2);
    world(s, side * (ROAD_HALF + 0.6), 1.05, p); m4.compose(p, q, one); poles.setMatrixAt(i, m4);
    world(s, side * (ROAD_HALF + 0.6), 11.9, p); q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, k.frame(s).yaw + (side > 0 ? 0 : Math.PI)); m4.compose(p, q, one); arms.setMatrixAt(i, m4);
    world(s, side * (ROAD_HALF - 2), 11.8, p); m4.compose(p, q, one); heads.setMatrixAt(i, m4);
  });
  scene.add(poles, arms, heads);
}

// Mexican fan palms (Washingtonia): very tall thin trunk, shaggy dead-frond skirt, round crown of fans
function buildPalms(k) {
  const { scene, world, canvasTex } = k;
  const bark = canvasTex(64, 512, (c, w, h) => {
    c.fillStyle = '#6d6257'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 5 + Math.random() * 4) { c.fillStyle = `rgba(${40 + Math.random() * 30},${34 + Math.random() * 25},${28 + Math.random() * 20},0.55)`; c.fillRect(0, y, w, 1.5 + Math.random() * 2); }
    for (let i = 0; i < 300; i++) { c.fillStyle = `rgba(200,190,170,${Math.random() * 0.12})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 6); }
  }, true);
  const leaf = canvasTex(256, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h); c.translate(w / 2, h);
    // solid-ish fan core so the cut-out survives mipmapping at distance, then the leaflet fringe
    c.fillStyle = 'rgb(62,92,44)'; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, h * 0.62, -Math.PI * 0.95, -Math.PI * 0.05); c.closePath(); c.fill();
    for (let i = 0; i < 40; i++) {
      const a = -Math.PI * 0.97 + (i / 39) * Math.PI * 0.94;
      const L = h * (0.85 + Math.random() * 0.14);
      c.strokeStyle = `rgb(${54 + Math.random() * 34},${86 + Math.random() * 36},${36 + Math.random() * 18})`; c.lineWidth = 9;
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(Math.cos(a) * L * 0.55, Math.sin(a) * L * 0.55, Math.cos(a) * L, Math.sin(a) * L + 18); c.stroke();
    }
  });
  const skirtTex = canvasTex(128, 256, (c, w, h) => {
    c.fillStyle = '#7b6a52'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) { c.strokeStyle = `rgba(${70 + Math.random() * 60},${58 + Math.random() * 45},${40 + Math.random() * 30},0.9)`; c.lineWidth = 2; const x = Math.random() * w; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + (Math.random() - 0.5) * 12, h); c.stroke(); }
  }, true);
  // unit-height trunk (scaled per palm), skirt + crown at the top
  const trunkGeo = new THREE.CylinderGeometry(0.2, 0.36, 1, 8, 1); trunkGeo.translate(0, 0.5, 0);
  const crown = [];
  const fans = 22;
  for (let i = 0; i < fans; i++) {
    const az = (i / fans) * Math.PI * 2 + Math.random() * 0.2;
    const droop = -0.9 + (i % 3) * 0.55 + Math.random() * 0.3;
    const f = new THREE.PlaneGeometry(3, 3); f.translate(0, 1.5, 0);
    f.rotateX(-Math.PI / 2 + 0.25); // lay the fan out, tipped up a little
    f.rotateX(-droop * 0.6);
    f.translate(0, 0.25, -0.5);
    f.rotateY(az);
    crown.push(f);
  }
  const crownGeo = mergeAll(crown);
  const skirtGeo = new THREE.CylinderGeometry(0.45, 0.62, 1.7, 10, 1, true); skirtGeo.translate(0, -0.75, 0);
  const list = [];
  for (let s = -60; s < FINISH_S + 500; s += 22 + Math.random() * 30) {
    for (const side of [-1, 1]) {
      if (Math.random() < 0.35) continue;
      const d = side * (ROAD_HALF + 9 + Math.random() * (Math.random() < 0.6 ? 6 : 50));
      list.push({ s: s + Math.random() * 12, d, h: 13 + Math.random() * 12, lean: (Math.random() - 0.5) * 0.08 });
    }
  }
  const trunkMat = new THREE.MeshStandardMaterial({ map: bark, roughness: 0.95 });
  const crownMat = new THREE.MeshStandardMaterial({ map: leaf, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.75 });
  const skirtMat = new THREE.MeshStandardMaterial({ map: skirtTex, color: '#8a7a66', roughness: 1, side: THREE.DoubleSide });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, list.length);
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, list.length);
  const skirts = new THREE.InstancedMesh(skirtGeo, skirtMat, list.length);
  const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), e = new THREE.Euler();
  list.forEach((t, i) => {
    world(t.s, t.d, hillY(t.s, t.d) - 0.2, p);
    q.setFromEuler(e.set(t.lean, Math.random() * 6, t.lean * 0.7)); sc.set(1, t.h, 1); m4.compose(p, q, sc); trunks.setMatrixAt(i, m4);
    const top = new THREE.Vector3(0, t.h, 0).applyQuaternion(q).add(p);
    const kk = 0.85 + Math.random() * 0.3; sc.setScalar(kk);
    q.setFromEuler(e.set(t.lean, Math.random() * 6, 0)); m4.compose(top, q, sc); crowns.setMatrixAt(i, m4); skirts.setMatrixAt(i, m4);
  });
  trunks.castShadow = crowns.castShadow = true;
  scene.add(trunks, crowns, skirts);
}

// dark chaparral clumps dotting the golden hills
function buildShrubs(k) {
  const { scene, world } = k;
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) { const n = 0.75 + hash(pos.getX(i) * 3, pos.getZ(i) * 3) * 0.5; pos.setXYZ(i, pos.getX(i) * n, pos.getY(i) * n * 0.6, pos.getZ(i) * n); }
  geo.computeVertexNormals();
  const n = 2600;
  const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: '#4a5a32', roughness: 1 }), n);
  const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), col = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const s = -200 + Math.random() * (FINISH_S + 900), side = Math.random() < 0.5 ? -1 : 1;
    const d = side * (ROAD_HALF + 10 + Math.pow(Math.random(), 1.6) * 260);
    // clumps gather in the folds (where the noise dips)
    if (noise(s / 55, d / 55) > 0.62 && Math.random() < 0.7) { i--; continue; }
    world(s, d, hillY(s, d) - 0.2, p);
    const r = 0.8 + Math.random() * 2.2;
    q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, Math.random() * 6); m4.compose(p, q, sc.set(r * (0.8 + Math.random() * 0.6), r, r)); im.setMatrixAt(i, m4);
    im.setColorAt(i, col.setHSL(0.2 + Math.random() * 0.06, 0.25 + Math.random() * 0.15, 0.14 + Math.random() * 0.1));
  }
  im.receiveShadow = true;
  scene.add(im);
}

function mergeAll(geos) {
  let n = 0; for (const g of geos) n += g.getAttribute('position').count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), idx = [];
  let o = 0;
  for (const g of geos) {
    pos.set(g.getAttribute('position').array, o * 3); nor.set(g.getAttribute('normal').array, o * 3); uv.set(g.getAttribute('uv').array, o * 2);
    for (const i of g.index.array) idx.push(i + o);
    o += g.getAttribute('position').count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(idx); return out;
}

// downtown LA towers past the finish, hazy in the distance
function buildSkyline(k) {
  const kinds = k.FACADES.map(() => []);
  for (let i = 0; i < 70; i++) {
    const s = FINISH_S + 260 + Math.random() * 700, side = Math.random() < 0.5 ? -1 : 1;
    const d = side * (34 + Math.random() * 260), h = 40 + Math.random() * (Math.abs(d) < 120 ? 250 : 120);
    const w = 20 + Math.random() * 22;
    kinds[Math.random() < 0.6 ? 0 : 1].push({ s, d, h, dp: w, w: w * (0.8 + Math.random() * 0.4) });
  }
  // low-rise sprawl on the flats either side of the freeway near downtown
  for (let s = 2700; s < FINISH_S + 300; s += 26) for (const side of [-1, 1]) {
    if (Math.random() < 0.3) continue;
    const d = side * (ROAD_HALF + 30 + Math.random() * 60);
    kinds[Math.random() < 0.5 ? 2 : 3].push({ s, d, h: 8 + Math.random() * 18, dp: 14 + Math.random() * 10, w: 16 + Math.random() * 8, y: hillY(s, d) - 1 });
  }
  k.placeBuildings(kinds);
}
