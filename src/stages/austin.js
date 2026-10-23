// Stage 1: Austin, TX. Sunset over 6th Street, downtown towers, the broken Congress Ave bridge.
import * as THREE from 'three';

const ROAD_HALF = 12;
const GAP0 = 2500, GAP1 = 2536;          // broken Congress Ave bridge
const BRIDGE0 = 2445, BRIDGE1 = 2615;
const FINISH_S = 2900;

export default {
  id: 'austin', num: 1, name: '오스틴',
  roadHalf: ROAD_HALF, lanes: [-9, -3, 3, 9], finish: FINISH_S,
  gaps: [{ s0: GAP0, s1: GAP1, respawn: GAP0 - 150 }],
  trafficMaxS: GAP0 - 40,
  cx(s) {
    const k = THREE.MathUtils.smoothstep(s, 120, 420);
    return k * (38 * Math.sin(s / 420) + 16 * Math.sin(s / 170 + 1.3));
  },
  ramps: [
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
  ],
  legend: { s: 1120 + 16 + 30, d: 1.5, y: 11 },
  road: { yellow: true, dashes: [0.25, 0.75] },
  env: {
    sky: { top: [0.06, 0.04, 0.17], mid: [0.42, 0.12, 0.36], hor: [1.0, 0.45, 0.25], low: [0.29, 0.13, 0.25], glow: [1.0, 0.55, 0.25] },
    sunDir: [-0.35, 0.16, -1], sun: ['#ffb27a', 2.4], hemi: ['#9d7be0', '#2a1712', 0.7],
    fog: ['#4a2346', 140, 950], hdri: 'assets/city_sunset_rgbe_gray.png', exposure: 0.92,
    envUpsideDown: true, // the look stage 1 was tuned with: reflections take the warm street, not the bright sky
  },
  traffic: {
    waymo: { car: 'ioniq5', kit: true, name: '웨이모', speed: [20, 24], brakes: true, n: 9 },
    robotaxi: { car: 'modely', name: '테슬라 로보택시', speed: [31, 35], color: '#f2f2f0', n: 4 },
    model3: { car: 'model3', name: '모델 3', speed: [26, 32], n: 3 },
    cybertruck: { car: 'cybertruck', name: '사이버트럭', speed: [24, 29], n: 2 },
    dolphin: { car: 'dolphin', name: 'BYD 돌핀', speed: [29, 35], n: 3 },
    sealion: { car: 'sealion7', name: 'BYD 씰라이언', speed: [28, 33], n: 3 },
    bus: { car: 'torino', name: 'BYD 전기버스', speed: [14, 17], n: 2 },
  },
  boss: 'waymo',
  radio: [
    [25, '오스틴에 온 걸 환영해. 로보택시가 처음 달리기 시작한 도시야.'],
    [190, '노란 경사로 보이면 점프! 공중에서 버튼을 꾹 누르면 사뿐히 착지해.'],
    [330, '저 하얀 웨이모들 지붕에 도는 거 보이지? 라이다야. 빨간 빛에 걸리면 겁먹고 급정거해.'],
    [600, '6번가야. 도지코인은 상점에서 쓸 거니까 싹 다 주워.'],
    [1050, '저 위에 보라색으로 빛나는 거, 전설의 블랙웰 칩이야. 큰 경사로에서 점프 버튼까지 같이 눌러봐.'],
    [1550, '다운타운이야. 이 빌딩들 전부 데이터센터로 바꾸면 딱인데.'],
    [2330, '다리가 끊겼어! 텍사스 교통국 또 일 안 했네. 속도 유지하고 경사로에서 점프!'],
  ],
  lines: { finish: '착지 완벽. 다음 목적지는 LA야. 준비해둬.', fall: ['풍덩!', '콜로라도강에 빠졌어요 · +3초', '괜찮아, 로드스터는 방수야. 아마도. 다시 가자!'] },
  stars: { time: 62, text: '완주 · 웨이모 마더십 격추 · 62초 이내 또는 퍼펙트 랜딩 3회' },
  poster: { s: 820, d: 2.2, y: 3.6, boss: [30, -5, 10.5] },
  text: {
    eyebrow: 'STAGE 01 · ROBOTAXI CITY', title: 'AUSTIN, TX', sub: '로보택시가 처음 달린 도시',
    tip: '<b>TIP</b> 노란 경사로에서 점프하고, 공중에서 점프 버튼을 <b>꾹 누르면</b> 압축공기를 뿜으며 사뿐히 착지해요. 퍼펙트 랜딩은 속도 보너스. 점프는 시간이 지나면 다시 충전돼요.',
    tweet: '로보택시는 오늘도 오스틴에서 영업 중. 웨이모는 아직 라이다한테 길 물어보는 중. 다리 하나 끊겼다던데 우리 차는 날 수 있으니 상관없음.',
    meta: '오후 7:42 · 오스틴, 텍사스 · 리트윗 42만', load: '오스틴 도로를 까는 중 · 실제 차 모델 불러오는 중',
    hud: 'STAGE 1 · AUSTIN, TX', clear: 'STAGE 01 CLEAR', clearTitle: '오스틴 정복',
  },
  build,
};

const NEON = [['6TH ST', '#ff3d9a'], ['LIVE MUSIC', '#38f5ff'], ['DOGE BBQ', '#ffc83d'], ['KEEP AUSTIN WEIRD', '#b07dff'], ['TACOS', '#ff7a3d'], ['GPU PAWN', '#3dff9a'], ['ROBOTAXI', '#ffffff'], ['라이다 수리점', '#ff3d6e'], ['QUESO 24H', '#ffc83d'], ['H100 삽니다', '#3dff9a']];

function build(k) {
  const { scene, M, ribbon, wall, crossWall, world, frame } = k;
  // ground split by the river
  for (const [a, b] of [[-400, BRIDGE0], [BRIDGE1, 3500]]) {
    for (const [l, r] of [[-500, -15.5], [15.5, 500]]) {
      const g = new THREE.Mesh(ribbon(a, b, l, r, 20, () => -0.05, 20), M.ground); g.receiveShadow = true; scene.add(g);
    }
  }
  // sidewalks
  for (const [a, b] of [[-120, BRIDGE0], [BRIDGE1, FINISH_S + 260]]) {
    for (const [l, r] of [[-15.5, -ROAD_HALF], [ROAD_HALF, 15.5]]) {
      const w = new THREE.Mesh(ribbon(a, b, l, r, 4, () => 0.12, 3.5), M.walk); w.receiveShadow = true; scene.add(w);
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
  k.addBillboard(GAP0 - 140, -17, 9, '다리 끊김! 점프!', '#ff6a1a', 11, 3.4);
  k.addBillboard(GAP0 - 320, 17, 9, 'BRIDGE OUT', '#ff6a1a', 11, 3.4);

  buildBuildings(k);
  buildStreetlights(k);
  buildLandmarks(k);
}

function buildBuildings(k) {
  const { scene, world, frame, Q, FACADES, facadeMat, textTex } = k;
  const neonMats = NEON.map(([t, c]) => {
    const m = new THREE.MeshBasicMaterial({ map: textTex(t, c, { size: t.length > 9 ? 56 : 84 }), transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    m.color.setScalar(2.2); return m;
  });
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
  // photo facades; each building picks one by district
  const kinds = FACADES.map(() => []);
  for (const b of items) {
    const kk = b.downtown ? (Math.random() < 0.55 ? 0 : 1) : b.sixth ? (Math.random() < 0.7 ? 2 : 3) : (Math.random() < 0.6 ? 3 : 2);
    kinds[b.face ? kk : (b.h > 40 ? 1 : kk)].push(b);
  }
  k.placeBuildings(kinds);
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

function buildStreetlights(k) {
  const { scene, world } = k;
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

function buildLandmarks(k) {
  const { scene, world, frame, textTex } = k;
  // Giga Texas
  const giga = new THREE.Mesh(new THREE.BoxGeometry(70, 22, 200), new THREE.MeshStandardMaterial({ color: '#b9b6c4', roughness: 0.55, metalness: 0.2 }));
  world(60, -58, 11, giga.position); giga.rotation.y = frame(60).yaw; giga.receiveShadow = true; scene.add(giga);
  const gs = new THREE.Mesh(new THREE.PlaneGeometry(40, 7), new THREE.MeshBasicMaterial({ map: textTex('GIGA TEXAS', '#ff2a3a', { w: 1024, h: 180, size: 130, glow: 18 }), transparent: true, toneMapped: false }));
  gs.material.color.setScalar(2); world(60, -22.9, 14, gs.position); gs.lookAt(world(60, 0, 14)); scene.add(gs);
  k.finishArch('FINISH · 텍사스 주의회 의사당');
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
    world(s, d, 0, p); const kk = 0.7 + Math.random() * 0.8; m4.makeScale(kk, kk * (0.8 + Math.random() * 0.6), kk).setPosition(p); trees.setMatrixAt(i, m4);
  }
  scene.add(trees);
}
