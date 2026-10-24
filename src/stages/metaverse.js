// Stage 4: the Metaverse. Starts on a real Menlo Park campus at dusk (glass offices, green roofs, the
// giant thumbs-up sign), then a portal at the end of Hacker Way drops you into the virtual world: a neon
// road floating over an endless grid, low-poly islands, glitch shards, legless avatars. The road breaks
// in three places; blue like-button pads launch you across.
import * as THREE from 'three';

const ROAD_HALF = 12;
const FINISH_S = 3250;
const PORTAL = 660, EDGE = PORTAL + 22;   // the campus ground ends just past the portal
const FLOOR_Y = -70;                        // absolute height of the virtual grid floor

// ---------- road profile ----------
// flat campus, then the floating road rolls up and over crests that throw you into the air
const KEYS = [[-500, 0], [PORTAL, 0], [740, 12], [770, 12], [830, 2], [900, 2], [980, 16], [1005, 16], [1080, 4],
  [1150, 20], [1310, 20], [1330, 18], [1400, 30], [1420, 30], [1500, 14], [1560, 14], [1640, 30], [1660, 30],
  [1740, 16], [1975, 16], [2060, 28], [2080, 28], [2160, 10], [2520, 10], [2580, 22], [2720, 22], [2800, 8], [4400, 8]];
const E0 = -500, EN = 4400;
const ETAB = (() => {
  const raw = new Float32Array(EN - E0 + 1);
  for (let i = 0; i < raw.length; i++) {
    const s = E0 + i; let k = 0; while (k < KEYS.length - 2 && KEYS[k + 1][0] < s) k++;
    const [sa, ya] = KEYS[k], [sb, yb] = KEYS[k + 1];
    raw[i] = ya + (yb - ya) * THREE.MathUtils.clamp((s - sa) / (sb - sa), 0, 1);
  }
  const out = new Float32Array(raw.length), R = 5;
  for (let i = 0; i < raw.length; i++) { let a = 0, n = 0; for (let j = -R; j <= R; j++) { const v = raw[i + j]; if (v !== undefined) { a += v; n++; } } out[i] = a / n; }
  return out;
})();
function elev(s) {
  const x = THREE.MathUtils.clamp(s - E0, 0, EN - E0 - 1), i = Math.floor(x), f = x - i;
  return ETAB[i] * (1 - f) + ETAB[i + 1] * f;
}

const GAPS = [[1240, 1310], [1900, 1970], [2640, 2710]].map(([s0, s1]) => ({ s0, s1, respawn: s0 - 130 }));
const LANES = [-9, -3, 3, 9];
const BOSS_PADS = [[2200, -9], [2200, 3], [2290, -3], [2290, 9], [2380, -9], [2380, 3], [2470, -3], [2470, 9]];
// like-button pads: a row before every gap, a pair on campus, a staggered field under the boss
const PADS = [
  ...GAPS.flatMap((g) => LANES.map((d) => ({ s: g.s0 - 9, d, l: 1.7, w: 2.3, v: 28 }))),
  { s: 300, d: -3, l: 1.7, w: 2.3, v: 17 }, { s: 300, d: 3, l: 1.7, w: 2.3, v: 17 },
  ...BOSS_PADS.map(([s, d]) => ({ s, d, l: 1.7, w: 2.3, v: 20 })),
];

export default {
  id: 'metaverse', num: 4, name: '메타버스',
  roadHalf: ROAD_HALF, lanes: LANES, finish: FINISH_S,
  gaps: GAPS,
  elev,
  cx(s) {
    const on = THREE.MathUtils.smoothstep(s, 700, 950) * (1 - THREE.MathUtils.smoothstep(s, 2950, 3150));
    return on * (70 * Math.sin((s - 700) / 260) + 25 * Math.sin((s - 700) / 120));
  },
  ramps: [],
  pads: PADS,
  splashY: (s) => (s > EDGE ? -16 : -5.5),
  respawnBack: 120,
  legend: { s: 1944, d: -3, y: 12 },   // the peak of a pad flight over the second gap, lane -3
  pickups: [
    // coin arcs over the crest flights
    ...[770, 1005, 1420, 1660, 2080].flatMap((s0) => range(4, 46, 7).map((x) => ['coin', s0 + x, -3, 1.2 + 0.22 * x - 15 * (x / 60) ** 2])),
    ...range(320, 620, 12).map((s) => ['coin', s, 9, 1.2]),
    ['h100', 1600, -9, 1.6], ['h100', 2325, 9, 6], ['h100', 2930, 3, 1.6],
    ['air', 560, -9, 1.2], ['air', 1180, 3, 1.2], ['air', 1840, -3, 1.2], ['air', 2580, 9, 1.2],
    ...BOSS_PADS.map(([s, d]) => ['gpu', s + 30, d, 6]),
  ],
  trafficMaxS: FINISH_S + 200,
  road: { yellow: false, dashes: [0.25, 0.5, 0.75] },
  env: {
    bg: false, sun: ['#ffc4a0', 2.1], hemi: ['#b9a8e8', '#3a2a40', 0.7], sunDir: [-0.35, 0.16, -1],
    sky: { top: [0.1, 0.12, 0.3], mid: [0.3, 0.28, 0.55], hor: [0.95, 0.55, 0.45], low: [0.25, 0.18, 0.25], glow: [1, 0.6, 0.35] },
    fog: ['#8a6f95', 220, 1700], hdri: 'assets/night_city_rgbe_gray.png', exposure: 0.85, bloom: 0.42, hdrMax: 6,
  },
  traffic: {
    avatar: { make: makeAvatar, name: '다리 없는 아바타', speed: [6, 9], n: 16, range: [720, 3200] },
    model3: { car: 'model3', name: '모델 3', speed: [24, 30], n: 3, range: [60, 600] },
    modely: { car: 'modely', name: '모델 Y', speed: [24, 30], n: 2, range: [60, 600] },
    ioniq5: { car: 'ioniq5', name: '사내 셔틀', speed: [18, 22], n: 2, range: [60, 600], color: '#f2f2f0' },
  },
  boss: 'headset',
  heads: ['zuck'],
  props: ['vrheadset'],
  radio: [
    [20, '멘로파크야. 리자드 저크 본사. 직원들 표정이 다 똑같지? 다 아바타라서 그래.'],
    [230, '도로 위 파란 좋아요 버튼 밟아봐. 점프대야. 밟으면 날아가.'],
    [520, '저 앞에 포털! 들어가면 메타버스야. 다리 없는 아바타들 조심해.'],
    [690, '400억 달러짜리 가상세계래. 아래로 떨어지면 로그아웃이야.'],
    [1170, '길이 끊겼어! 좋아요 패드 밟고 날아서 건너!'],
    [1830, '또 끊긴다. 패드 놓쳤으면 점프 꾹!'],
    [2570, '마지막 끊긴 구간이야. 넘으면 호라이즌 광장이 보여.'],
    [3040, '접속자 3명짜리 광장 도착. 결승선까지 밟아!'],
  ],
  lines: { finish: '메타버스 탈출! 다음은 워싱턴 DC야. 아이스크림 트럭이 기다린대.', fall: ['로그아웃!', '메타버스 밖으로 추락 · +3초', '떨어지면 재접속이야. 다시 가자!'] },
  stars: { time: 62, text: '완주 · 메가 헤드셋 격추 · 62초 이내 또는 퍼펙트 랜딩 5회', perfect: 5 },
  poster: { s: 674, d: 4, y: 5, boss: [-3, -9, 12, 2.85], cam: { back: -12, side: -4, y: 4, ahead: -30, lookSide: -2, lookY: 10, fov: 64 } },
  text: {
    eyebrow: 'STAGE 04 · THE METAVERSE', title: 'METAVERSE', sub: '다리 없는 세계로 로그인',
    tip: '<b>TIP</b> 파란 <b>좋아요 패드</b>를 밟으면 차가 튀어 올라요. 끊긴 도로 앞엔 꼭 패드가 있으니 차선을 맞추세요. 하얀 <b>선크림</b> 차선은 미끄러워요.',
    tweet: '메타버스에 400억 달러 쓴 곳에 가봤는데 접속자가 3명이었음. 그중 하나가 나였음. 다리도 없음.',
    meta: '오후 11:12 · 멘로파크 · 리트윗 89만', load: '아바타 다리 렌더링 포기하는 중 · 포털 여는 중',
    hud: 'STAGE 4 · METAVERSE', clear: 'STAGE 04 CLEAR', clearTitle: '로그아웃 성공',
  },
  build,
  tick,
};

function range(a, b, step) { const out = []; for (let s = a; s <= b; s += step) out.push(s); return out; }
function rnd(seed) { let x = seed >>> 0; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; }; }
const inGap = (s, pad = 0) => GAPS.some((g) => s > g.s0 - pad && s < g.s1 + pad);
const glow = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), toneMapped: false });

// things tick() animates
const live = { k: null, portal: null, vsky: null, floor: null, shards: null, holos: [], pads: null, lights: null, fogA: new THREE.Color('#8a6f95'), fogB: new THREE.Color('#1c0d38'), roadGrid: null, voxels: null };

function build(k) {
  live.k = k;
  const rand = rnd(4);
  buildCampus(k, rand);
  buildLikeSign(k);
  buildPortal(k);
  buildVoxelEdge(k, rand);
  buildVirtualRoad(k);
  buildPads(k);
  buildFloor(k);
  buildVirtualSky(k);
  buildIslands(k, rand);
  buildShards(k, rand);
  buildHolos(k);
  buildPlaza(k);
  k.finishArch('FINISH · 호라이즌 광장');
}

// ---------- campus (real world) ----------
function buildCampus(k, rand) {
  const { scene } = k;
  const grass = new THREE.MeshStandardMaterial({ map: k.photo('sf_grass_diff.jpg', { rep: [1 / 8, 1 / 8] }), normalMap: k.photo('sf_grass_nor.jpg', { srgb: false, rep: [1 / 8, 1 / 8] }), color: '#9fb07a', roughness: 1 });
  const walk = new THREE.MeshStandardMaterial({ map: k.photo('sf_walk_diff.jpg', { rep: [0.25, 0.25] }), normalMap: k.photo('sf_walk_nor.jpg', { srgb: false, rep: [0.25, 0.25] }), color: '#bdb6b0', roughness: 0.85 });
  const lot = new THREE.MeshStandardMaterial({ map: k.photo('asphalt_diff.jpg', { rep: [1 / 10, 1 / 10] }), color: '#6c6872', roughness: 0.9 });
  for (const side of [-1, 1]) {
    const [a, b] = side < 0 ? [-(ROAD_HALF + 4), -ROAD_HALF] : [ROAD_HALF, ROAD_HALF + 4];
    const sw = new THREE.Mesh(k.ribbon(-200, EDGE, a, b, 4, () => 0.16, 4), walk); sw.receiveShadow = true; scene.add(sw);
    scene.add(new THREE.Mesh(k.wall(-200, EDGE, side * ROAD_HALF, 4, () => 0, () => 0.16, 1), walk));
    const [l, r] = side < 0 ? [-700, -(ROAD_HALF + 3.9)] : [ROAD_HALF + 3.9, 700];
    const g = new THREE.Mesh(k.grid(-300, EDGE, l, r, 12, 20, () => 0.1, 1), grass); g.receiveShadow = true; scene.add(g);
    // parking lots in front of the offices
    const [pl, pr] = side < 0 ? [-58, -24] : [24, 58];
    const p = new THREE.Mesh(k.grid(40, 560, pl, pr, 20, 34, () => 0.13, 1), lot); p.receiveShadow = true; scene.add(p);
  }
  // the cut edge of reality: a dark cliff where the ground stops
  scene.add(new THREE.Mesh(k.crossWall(EDGE, -700, -ROAD_HALF, -40, 0.1), new THREE.MeshStandardMaterial({ color: '#16121e', roughness: 1, side: THREE.DoubleSide })));
  scene.add(new THREE.Mesh(k.crossWall(EDGE, ROAD_HALF, 700, -40, 0.1), new THREE.MeshStandardMaterial({ color: '#16121e', roughness: 1, side: THREE.DoubleSide })));

  // low glass offices with green roofs (MPK style), a taller tower or two behind
  const glass = [], lit = [], roofs = [];
  for (const side of [-1, 1]) {
    let s = -120;
    while (s < 600) {
      const w = 50 + rand() * 50, dp = 34 + rand() * 30, h = 11 + rand() * 9, d = side * (64 + dp / 2 + rand() * 20);
      (rand() < 0.7 ? glass : lit).push({ s: s + w / 2, d, h, dp, w });
      roofs.push({ s: s + w / 2, d, h, dp, w });
      s += w + 14 + rand() * 18;
    }
    for (let i = 0; i < 5; i++) { const s0 = -60 + i * 150 + rand() * 50; lit.push({ s: s0, d: side * (220 + rand() * 120), h: 30 + rand() * 40, dp: 30 + rand() * 20, w: 30 + rand() * 20 }); }
  }
  k.placeBuildings([glass, lit, [], []]);
  const roofMat = new THREE.MeshStandardMaterial({ map: k.photo('sf_grass_diff.jpg', { rep: [1 / 6, 1 / 6] }), color: '#8fae6a', roughness: 1 });
  const parapet = new THREE.MeshStandardMaterial({ color: '#d8d4ce', roughness: 0.7 });
  const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
  const roofI = new THREE.InstancedMesh(box, roofMat, roofs.length), parI = new THREE.InstancedMesh(box, parapet, roofs.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  const treeSpots = [];
  roofs.forEach((b, i) => {
    k.world(b.s, b.d, b.h, p); q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, k.frame(b.s).yaw);
    roofI.setMatrixAt(i, m4.compose(p, q, sc.set(b.dp - 3, 0.6, b.w - 3)));
    parI.setMatrixAt(i, m4.compose(p, q, sc.set(b.dp + 0.4, 0.35, b.w + 0.4)));
    for (let t = 0; t < 4; t++) treeSpots.push([b.s + (rand() - 0.5) * (b.w - 8), b.d + (rand() - 0.5) * (b.dp - 8), b.h + 0.6, 0.6 + rand() * 0.4]);
  });
  roofI.receiveShadow = true; scene.add(roofI, parI);

  // trees: along the road, around the lots, on the roofs
  for (let s = -150; s < PORTAL - 20; s += 18 + rand() * 10) for (const side of [-1, 1]) treeSpots.push([s, side * (ROAD_HALF + 7 + rand() * 4), 0.1, 0.8 + rand() * 0.5]);
  for (let i = 0; i < 90; i++) { const side = rand() < 0.5 ? -1 : 1; treeSpots.push([-200 + rand() * 820, side * (140 + rand() * 260), 0.1, 0.9 + rand() * 0.6]); }
  buildTrees(k, treeSpots, rand);

  // street lamps
  const pole = new THREE.MeshStandardMaterial({ color: '#2c2c30', metalness: 0.7, roughness: 0.4 });
  const lampGeo = new THREE.CylinderGeometry(0.09, 0.12, 7, 8); lampGeo.translate(0, 3.5, 0);
  const headGeo = new THREE.BoxGeometry(0.5, 0.16, 1.1);
  const spots = [];
  for (let s = -100; s < PORTAL - 30; s += 36) for (const side of [-1, 1]) spots.push([s, side * (ROAD_HALF + 1.2)]);
  const poles = new THREE.InstancedMesh(lampGeo, pole, spots.length), heads = new THREE.InstancedMesh(headGeo, glow(3, 2.5, 1.8), spots.length);
  spots.forEach(([s, d], i) => {
    k.world(s, d, 0, p); q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, k.frame(s).yaw); poles.setMatrixAt(i, m4.compose(p, q, sc.set(1, 1, 1)));
    k.world(s, d - Math.sign(d) * 0.6, 7, p); heads.setMatrixAt(i, m4.compose(p, q, sc.set(1, 1, 1)));
  });
  poles.castShadow = true; scene.add(poles, heads);

  // the street name on a sign gantry
  const signMat = new THREE.MeshBasicMaterial({ map: k.textTex('1 HACKER WAY', '#ffffff', { w: 1024, h: 160, size: 96, glow: 0, bg: '#1d5a34' }), side: THREE.DoubleSide });
  for (const [s, d] of [[140, -(ROAD_HALF + 2)], [140, ROAD_HALF + 2]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.4, 8), pole); k.world(s, d, 1.7, post.position); scene.add(post);
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.5), signMat); k.world(s, d, 3.3, sg.position); sg.lookAt(k.world(s - 20, d, 3.3)); scene.add(sg);
  }
}

function buildTrees(k, spots, rand) {
  const trunk = new THREE.CylinderGeometry(0.18, 0.3, 4, 7); trunk.translate(0, 2, 0);
  const crown = new THREE.IcosahedronGeometry(2.4, 1);
  const pos = crown.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); const n = 0.8 + 0.35 * Math.sin(v.x * 3.1 + v.y * 1.7) * Math.cos(v.z * 2.3); v.multiplyScalar(n); v.y *= 0.85; pos.setXYZ(i, v.x, v.y + 5, v.z); }
  crown.computeVertexNormals();
  const bark = new THREE.MeshStandardMaterial({ color: '#4a3a2e', roughness: 1 });
  const leaf = new THREE.MeshStandardMaterial({ map: k.photo('sf_grass_diff.jpg', { rep: [0.5, 0.5] }), color: '#6f8a4a', roughness: 0.95 });
  const ti = new THREE.InstancedMesh(trunk, bark, spots.length), ci = new THREE.InstancedMesh(crown, leaf, spots.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
  spots.forEach(([s, d, y, k0], i) => {
    k.world(s, d, y, p); q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rand() * 6.28);
    m4.compose(p, q, sc.set(k0, k0 * (0.9 + rand() * 0.3), k0)); ti.setMatrixAt(i, m4); ci.setMatrixAt(i, m4);
    ci.setColorAt(i, col.setHSL(0.22 + rand() * 0.06, 0.35, 0.32 + rand() * 0.12));
  });
  ti.castShadow = ci.castShadow = true; ci.receiveShadow = true;
  k.scene.add(ti, ci);
}

// the giant thumbs-up sign at the entrance, as a real extruded sculpture on a lawn plinth
function thumbShape() {
  const sh = new THREE.Shape();
  sh.moveTo(-0.42, -0.6); sh.lineTo(0.38, -0.6);
  sh.quadraticCurveTo(0.56, -0.6, 0.55, -0.44);
  sh.quadraticCurveTo(0.68, -0.36, 0.61, -0.22);
  sh.quadraticCurveTo(0.71, -0.11, 0.62, 0.01);
  sh.quadraticCurveTo(0.69, 0.15, 0.52, 0.2);
  sh.lineTo(0.12, 0.2);
  sh.quadraticCurveTo(0.2, 0.45, 0.16, 0.62);
  sh.quadraticCurveTo(0.12, 0.82, -0.02, 0.8);
  sh.quadraticCurveTo(-0.13, 0.78, -0.12, 0.6);
  sh.quadraticCurveTo(-0.14, 0.38, -0.42, 0.12);
  sh.lineTo(-0.42, -0.6);
  const cuff = new THREE.Shape(); cuff.moveTo(-0.74, -0.6); cuff.lineTo(-0.5, -0.6); cuff.lineTo(-0.5, 0.14); cuff.lineTo(-0.74, 0.14); cuff.lineTo(-0.74, -0.6);
  return [sh, cuff];
}
function buildLikeSign(k) {
  const g = new THREE.Group();
  const blue = new THREE.MeshPhysicalMaterial({ color: '#2f6fdf', roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  const white = new THREE.MeshPhysicalMaterial({ color: '#f4f6fa', roughness: 0.3, clearcoat: 0.9 });
  const stone = new THREE.MeshStandardMaterial({ map: k.photo('concrete_diff.jpg', { rep: [0.5, 0.5] }), color: '#bdb8b0', roughness: 0.9 });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(9, 9, 1.4), blue); slab.position.y = 6.2; slab.castShadow = true; g.add(slab);
  const geo = new THREE.ExtrudeGeometry(thumbShape(), { depth: 0.5, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.05, bevelSegments: 4, curveSegments: 16 });
  for (const z of [0.7, -0.7]) { const t = new THREE.Mesh(geo, white); t.scale.set(5.4, 5.4, 1); t.position.set(z > 0 ? -0.4 : 0.4, 6.2, z); if (z < 0) t.rotation.y = Math.PI; t.castShadow = true; g.add(t); }
  const base = new THREE.Mesh(new THREE.BoxGeometry(11, 1.6, 3), stone); base.position.y = 0.8; base.castShadow = base.receiveShadow = true; g.add(base);
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.1), new THREE.MeshStandardMaterial({ map: k.textTex('1 HACKER WAY', '#2a2a2a', { w: 1024, h: 128, size: 92, glow: 0 }), transparent: true }));
  lab.position.set(0, 0.85, 1.52); g.add(lab);
  // a flock of employees' selfie-sticks would be here; instead, uplights
  for (const x of [-4, 4]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.6), glow(3, 2.8, 2.2)); l.position.set(x, 1.7, 1.8); g.add(l); }
  k.world(90, -30, 0, g.position); g.rotation.y = k.frame(90).yaw + 0.55;
  k.scene.add(g);
  // a second one across the road for the other side of traffic
  const g2 = g.clone(); k.world(430, 32, 0, g2.position); g2.rotation.y = k.frame(430).yaw - 0.6; k.scene.add(g2);
}

// ---------- the portal ----------
function buildPortal(k) {
  const R = 15.5, Y = 3;
  const g = new THREE.Group();
  const chrome = new THREE.MeshPhysicalMaterial({ color: '#c8ccd8', metalness: 1, roughness: 0.12, clearcoat: 1 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 1.3, 24, 120), chrome); ring.castShadow = true; g.add(ring);
  const inner = new THREE.Mesh(new THREE.TorusGeometry(R - 1.25, 0.28, 10, 120), glow(0.6, 2.2, 3.4)); g.add(inner);
  const outer = new THREE.Mesh(new THREE.TorusGeometry(R + 1.3, 0.2, 10, 120), glow(3, 0.5, 2.6)); g.add(outer);
  // segment lights around the ring
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.6, 0.5), glow(2.6, 2.6, 3.2)); b.position.set(Math.cos(a) * (R + 0.2), Math.sin(a) * (R + 0.2), 1.2); b.rotation.z = a; g.add(b); }
  const disc = new THREE.Mesh(new THREE.CircleGeometry(R - 1.1, 96), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { time: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec2 vUv; uniform float time;
      void main(){ vec2 p = vUv * 2.0 - 1.0; float r = length(p), a = atan(p.y, p.x);
        float sw = sin(a * 5.0 + r * 14.0 - time * 3.0) * 0.5 + 0.5, sw2 = sin(a * 9.0 - r * 22.0 + time * 4.3) * 0.5 + 0.5;
        vec3 c = mix(vec3(0.2, 0.9, 1.6), vec3(1.6, 0.2, 1.3), sw) + vec3(1.0) * pow(sw2, 8.0) * 0.6;
        float edge = smoothstep(1.0, 0.82, r), hole = smoothstep(0.0, 0.35, r);
        gl_FragColor = vec4(c * (0.08 + 0.22 * hole) * edge, 1.0); }`,
  }));
  g.add(disc);
  k.world(PORTAL, 0, Y, g.position); g.lookAt(k.world(PORTAL - 10, 0, Y));
  k.scene.add(g);
  // feet where the ring meets the ground
  const footMat = new THREE.MeshStandardMaterial({ color: '#2a2c36', metalness: 0.8, roughness: 0.3 });
  for (const d of [-(ROAD_HALF + 2.5), ROAD_HALF + 2.5]) { const f = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 4), footMat); k.world(PORTAL, d, 0.6, f.position); f.rotation.y = k.frame(PORTAL).yaw; k.scene.add(f); }
  live.portal = disc.material;
}

// reality falls apart into voxels past the portal
function buildVoxelEdge(k, rand) {
  const N = 260, geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshStandardMaterial({ map: k.photo('sf_grass_diff.jpg', { rep: [0.2, 0.2] }), color: '#9fb07a', roughness: 1 });
  const im = new THREE.InstancedMesh(geo, mat, N), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
  const base = [];
  for (let i = 0; i < N; i++) {
    const side = rand() < 0.5 ? -1 : 1, d = side * (ROAD_HALF + 4 + rand() * 140), t = rand();
    const s = EDGE + 2 + t * 90, y = -t * t * 45 - rand() * 6, z = 0.8 + rand() * 2.6 * (1 - t * 0.5);
    base.push({ s, d, y, z, rx: rand() * 3, ry: rand() * 3, sp: 0.2 + rand() * 0.6 });
    im.setColorAt(i, rand() < 0.3 ? col.setRGB(0.5, 0.4, 0.9) : col.setHSL(0.24, 0.3, 0.35 + rand() * 0.2));
  }
  live.voxels = { im, base, m4, q, p, sc, e: new THREE.Euler() };
  updateVoxels(0);
  k.scene.add(im);
}
function updateVoxels(time) {
  const v = live.voxels; if (!v) return;
  v.base.forEach((b, i) => {
    live.k.world(b.s, b.d, b.y + Math.sin(time * b.sp + i) * 0.8, v.p);
    v.q.setFromEuler(v.e.set(b.rx + time * b.sp * 0.4, b.ry + time * b.sp * 0.3, 0));
    v.im.setMatrixAt(i, v.m4.compose(v.p, v.q, v.sc.setScalar(b.z)));
  });
  v.im.instanceMatrix.needsUpdate = true;
}

// ---------- the floating neon road ----------
function buildVirtualRoad(k) {
  const { scene } = k;
  // glossy black deck with a glowing grid, laid over the asphalt from the portal on
  const gridTex = k.canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#05040c'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(80,220,255,0.35)'; g.lineWidth = 2;
    for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * w / 8, 0); g.lineTo(i * w / 8, h); g.stroke(); g.beginPath(); g.moveTo(0, i * h / 8); g.lineTo(w, i * h / 8); g.stroke(); }
    // lane lines between the four lanes, and the edges
    g.fillStyle = '#ff4fd8'; for (const u of [0.25, 0.75]) for (let y = 0; y < h; y += 128) g.fillRect(u * w - 3, y, 6, 64);
    g.fillStyle = '#ffffff'; for (let y = 0; y < h; y += 128) g.fillRect(w / 2 - 3, y, 6, 64);
    g.fillStyle = '#5ff0ff'; g.fillRect(4, 0, 8, h); g.fillRect(w - 12, 0, 8, h);
  }, true);
  const emi = gridTex.clone(); emi.needsUpdate = true;
  const deck = new THREE.MeshStandardMaterial({ map: gridTex, emissive: '#ffffff', emissiveMap: emi, emissiveIntensity: 0.7, color: '#ffffff', metalness: 0.3, roughness: 0.45, envMapIntensity: 0.35, polygonOffset: true, polygonOffsetFactor: -2 });
  live.roadGrid = deck;
  const under = new THREE.MeshStandardMaterial({ color: '#0c0a16', metalness: 0.7, roughness: 0.35, side: THREE.DoubleSide });
  const rail = glow(0.4, 2.4, 3.2), rail2 = glow(2.6, 0.4, 2.4);
  const segs = []; let a = PORTAL + 1;
  for (const g of [...GAPS, { s0: FINISH_S + 260, s1: 0 }]) { segs.push([a, g.s0]); a = g.s1; }
  for (const [s0, s1] of segs) {
    scene.add(new THREE.Mesh(k.ribbon(s0, s1, -ROAD_HALF, ROAD_HALF, 3, () => 0.02, 24), deck));
    if (s0 < EDGE) continue; // still on the campus ground (only the deck overlay)
    const u = new THREE.Mesh(k.ribbon(s0, s1, -ROAD_HALF - 0.6, ROAD_HALF + 0.6, 4, () => -1.6), under); scene.add(u);
    for (const side of [-1, 1]) {
      scene.add(new THREE.Mesh(k.wall(s0, s1, side * (ROAD_HALF + 0.6), 4, () => -1.6, () => 0.1), under));
      scene.add(new THREE.Mesh(k.wall(s0, s1, side * (ROAD_HALF + 0.62), 4, () => -0.55, () => -0.35), rail));
      scene.add(new THREE.Mesh(k.wall(s0, s1, side * (ROAD_HALF + 0.62), 4, () => -1.4, () => -1.32), rail2));
    }
    // broken ends: glowing torn edges
    for (const s of [s0, s1]) if (GAPS.some((g) => Math.abs(g.s0 - s) < 1 || Math.abs(g.s1 - s) < 1)) {
      scene.add(new THREE.Mesh(k.crossWall(s, -ROAD_HALF - 0.6, ROAD_HALF + 0.6, -1.6, 0.05), rail2));
      for (let i = 0; i < 10; i++) {
        const c = new THREE.Mesh(new THREE.BoxGeometry(1 + Math.random() * 1.5, 0.5 + Math.random(), 1 + Math.random() * 1.5), Math.random() < 0.5 ? rail : under);
        const into = GAPS.some((g) => Math.abs(g.s0 - s) < 1) ? 1 : -1;
        k.world(s + into * (1 + Math.random() * 10), (Math.random() - 0.5) * 24, -2 - Math.random() * 8, c.position); c.rotation.set(Math.random() * 3, Math.random() * 3, 0); scene.add(c);
      }
    }
  }
}

function buildPads(k) {
  const tex = k.canvasTex(256, 256, (g, w, h) => {
    const r = 40; g.fillStyle = '#1f6bff'; g.beginPath(); g.roundRect(6, 6, w - 12, h - 12, r); g.fill();
    g.strokeStyle = '#bfe0ff'; g.lineWidth = 8; g.stroke();
    g.save(); g.translate(w / 2 + 6, h / 2 - 6); g.scale(118, -118); g.fillStyle = '#ffffff';
    for (const sh of thumbShape()) { g.beginPath(); const pts = sh.getPoints(12); pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.fill(); }
    g.restore();
  });
  const mat = new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.9, roughness: 0.3, metalness: 0.2, transparent: true, polygonOffset: true, polygonOffsetFactor: -4 });
  live.pads = mat;
  for (const q of PADS) {
    // the texture runs across the pad (u) and along it (v); a 0..1 v over the pad's length
    const m = new THREE.Mesh(k.ribbon(q.s - q.l, q.s + q.l, q.d - q.w, q.d + q.w, q.l, () => 0.06), mat);
    k.scene.add(m);
    const lip = new THREE.Mesh(k.wall(q.s - q.l, q.s + q.l, q.d - q.w, q.l, () => 0, () => 0.06), mat); k.scene.add(lip);
  }
}

// ---------- the virtual world around it ----------
function buildFloor(k) {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, toneMapped: false, extensions: { derivatives: true },
    uniforms: { time: { value: 0 }, fade: { value: 1 } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `varying vec3 vW; uniform float time, fade;
      float lines(vec2 p, float w){ vec2 g = abs(fract(p - 0.5) - 0.5) / fwidth(p); return 1.0 - min(min(g.x, g.y) / w, 1.0); }
      void main(){
        float dist = length(vW.xz - cameraPosition.xz);
        float l1 = lines(vW.xz / 24.0, 1.2), l2 = lines(vW.xz / 120.0, 2.0);
        float pulse = 0.5 + 0.5 * sin(vW.z * 0.01 + time * 1.4);
        vec3 c = mix(vec3(0.05, 0.5, 0.9), vec3(0.8, 0.08, 0.7), pulse) * (l1 * 0.5 + l2 * 0.9);
        float f = exp(-dist / 900.0);
        gl_FragColor = vec4(c * f * fade + vec3(0.02, 0.0, 0.05), (0.85 * f + 0.15) * fade); }`,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), mat); floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR_Y; floor.renderOrder = -5;
  k.scene.add(floor);
  live.floor = floor;
}

function buildVirtualSky(k) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false, fog: false, toneMapped: false,
    uniforms: { mixv: { value: 0 }, time: { value: 0 } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vP; uniform float mixv, time;
      float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      void main(){ float h = vP.y;
        vec3 top = vec3(0.02, 0.01, 0.07), mid = vec3(0.12, 0.03, 0.22), hor = vec3(0.55, 0.12, 0.5);
        vec3 c = h > 0.0 ? mix(hor, mix(mid, top, smoothstep(0.1, 0.6, h)), smoothstep(0.0, 0.22, h)) : mix(hor * 0.5, vec3(0.01, 0.0, 0.03), smoothstep(0.0, -0.25, h));
        // stars
        vec3 q = floor(vP * 320.0); float st = step(0.9975, h3(q)) * smoothstep(0.02, 0.25, h);
        c += vec3(0.9, 0.85, 1.2) * st * (0.6 + 0.4 * sin(time * 2.0 + h3(q + 1.0) * 30.0));
        // a striped synth sun low ahead (the track runs toward -z)
        vec3 sd = normalize(vec3(0.0, 0.1, -1.0)); float d = acos(clamp(dot(vP, sd), -1.0, 1.0));
        if (d < 0.2) { float y = (vP.y - sd.y) / 0.2; float band = step(0.0, sin(y * 60.0 + time * 0.8)) + step(0.2, y);
          c = mix(c, mix(vec3(0.9, 0.12, 0.45), vec3(1.1, 0.6, 0.15), smoothstep(-0.8, 0.9, y)), smoothstep(0.2, 0.19, d) * min(band, 1.0)); }
        c += vec3(0.8, 0.15, 0.6) * exp(-d * 6.0) * 0.12;
        gl_FragColor = vec4(c, mixv); }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(2200, 48, 24), mat); sky.renderOrder = -10; sky.frustumCulled = false;
  k.scene.add(sky);
  live.vsky = sky;
}

function buildIslands(k, rand) {
  const geo = new THREE.IcosahedronGeometry(1, 2).toNonIndexed();
  const pos = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = 1 + 0.18 * Math.sin(v.x * 5.3 + v.z * 3.1) * Math.cos(v.y * 4.1);
    if (v.y > 0) v.y = 0.12 + v.y * 0.12; else v.y *= 1.5 * n;
    v.x *= n; v.z *= n; pos.setXYZ(i, v.x, v.y, v.z);
  }
  const colors = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let f = 0; f < pos.count; f += 3) {
    const y = (pos.getY(f) + pos.getY(f + 1) + pos.getY(f + 2)) / 3;
    if (y > 0.1) c.setHSL(0.36 + Math.sin(f) * 0.03, 0.55, 0.38 + Math.sin(f * 1.7) * 0.05);
    else c.setHSL(0.74 + Math.sin(f * 0.7) * 0.04, 0.35, 0.16 + Math.sin(f * 2.3) * 0.04 + (y + 1.5) * 0.06);
    for (let j = 0; j < 3; j++) colors.set([c.r, c.g, c.b], (f + j) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8, metalness: 0.05 });
  const N = 70, im = new THREE.InstancedMesh(geo, mat, N);
  const crystal = new THREE.OctahedronGeometry(1, 0), cm = glow(0.5, 2, 3), ci = new THREE.InstancedMesh(crystal, cm, N * 3);
  const treeG = new THREE.ConeGeometry(1, 3, 6); treeG.translate(0, 1.5, 0);
  const tm = new THREE.MeshStandardMaterial({ color: '#3fbf7a', flatShading: true, roughness: 0.7, emissive: '#0b3a22' }), ti = new THREE.InstancedMesh(treeG, tm, N * 4);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  let nc = 0, nt = 0;
  for (let i = 0; i < N; i++) {
    const s = EDGE + 60 + rand() * (FINISH_S - EDGE + 200), side = rand() < 0.5 ? -1 : 1;
    const R = 10 + rand() * 38, d = side * (ROAD_HALF + 30 + R + rand() * 380), y = -40 + rand() * 90;
    k.world(s, d, 0, p); p.y = elev(s) + y; q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rand() * 6.28);
    im.setMatrixAt(i, m4.compose(p, q, sc.set(R, R * (0.7 + rand() * 0.5), R)));
    const top = p.clone(); top.y += R * 0.12 * 0.9;
    for (let j = 0; j < 3; j++) { const a = rand() * 6.28, r = rand() * R * 0.6; const cp = top.clone().add(new THREE.Vector3(Math.cos(a) * r, 1.5, Math.sin(a) * r)); ci.setMatrixAt(nc++, m4.compose(cp, q, sc.set(0.8, 2.4, 0.8).multiplyScalar(0.6 + rand() * 1.2))); }
    for (let j = 0; j < 4; j++) { const a = rand() * 6.28, r = rand() * R * 0.7; const tp = top.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); ti.setMatrixAt(nt++, m4.compose(tp, q, sc.setScalar(1 + rand() * 2))); }
  }
  im.receiveShadow = true;
  k.scene.add(im, ci, ti);
}

function buildShards(k, rand) {
  const N = k.IS_MOBILE ? 90 : 160;
  const geo = new THREE.TetrahedronGeometry(1, 0);
  const mat = new THREE.MeshBasicMaterial({ toneMapped: false });
  const im = new THREE.InstancedMesh(geo, mat, N), col = new THREE.Color();
  const base = [];
  for (let i = 0; i < N; i++) {
    const s = EDGE + rand() * (FINISH_S - EDGE + 150), side = rand() < 0.5 ? -1 : 1;
    base.push({ s, d: side * (ROAD_HALF + 6 + rand() * 70), y: -14 + rand() * 40, z: 0.4 + rand() * 1.6, sp: 0.4 + rand() * 1.2, ph: rand() * 6 });
    const t = rand(); im.setColorAt(i, t < 0.45 ? col.setRGB(0.25, 1.2, 1.7) : t < 0.85 ? col.setRGB(1.5, 0.2, 1.3) : col.setRGB(1.4, 1.4, 1.6));
  }
  im.frustumCulled = false;
  live.shards = { im, base, m4: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), sc: new THREE.Vector3(), e: new THREE.Euler() };
  k.scene.add(im);
}

function holoPanel(k, text, color, w, h, s, d, y, sub) {
  const tex = k.canvasTex(1024, Math.round(1024 * h / w), (g, W, H) => {
    g.fillStyle = 'rgba(20,6,40,0.55)'; g.fillRect(0, 0, W, H);
    g.strokeStyle = color; g.lineWidth = 10; g.shadowColor = color; g.shadowBlur = 30; g.strokeRect(12, 12, W - 24, H - 24);
    g.font = `900 ${Math.round(H * (sub ? 0.34 : 0.5))}px "Black Han Sans", "Noto Sans KR", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color;
    g.fillText(text, W / 2, H * (sub ? 0.4 : 0.52));
    if (sub) { g.shadowBlur = 10; g.font = `700 ${Math.round(H * 0.16)}px "Noto Sans KR", sans-serif`; g.fillStyle = '#ffffff'; g.fillText(sub, W / 2, H * 0.76); }
    g.globalAlpha = 0.18; g.fillStyle = '#000'; for (let yy = 0; yy < H; yy += 6) g.fillRect(0, yy, W, 2);
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.material.color.setScalar(1.1);
  k.world(s, d, y, m.position); m.lookAt(k.world(s - 80, 0, y)); k.scene.add(m);
  live.holos.push({ m, ph: Math.random() * 10 });
  return m;
}
function buildHolos(k) {
  holoPanel(k, '좋아요 10억 개', '#5ff0ff', 26, 9, 820, -38, 24, '그런데 누가 누른 거지?');
  holoPanel(k, '다리 업데이트', '#ff6ad5', 24, 9, 1120, 40, 30, '2027년 출시 예정 · 아마도');
  holoPanel(k, '토지 분양 중', '#ffd04a', 24, 9, 1480, -42, 38, '가상 부동산 1평 = 실제 아파트 1채');
  holoPanel(k, '회의실 입장', '#5ff0ff', 22, 8, 1820, 38, 30, '참석자: 아바타 0명');
  holoPanel(k, '실시간 접속자', '#ff6ad5', 24, 9, 2240, -40, 34, '전 세계 3명 (봇 2명 포함)');
  holoPanel(k, '400억 달러', '#ffd04a', 28, 10, 2760, 44, 34, '여기 다 썼음');
}

// the finish plaza: a floating round deck with a giant "users online" counter
function buildPlaza(k) {
  const s = FINISH_S - 40;
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(60, 52, 3, 64, 1), new THREE.MeshStandardMaterial({ color: '#141026', metalness: 0.7, roughness: 0.3 }));
  k.world(s, 0, -1.65, deck.position); deck.receiveShadow = true; k.scene.add(deck);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(60, 0.35, 8, 128), glow(0.5, 2.4, 3.2)); rim.rotation.x = Math.PI / 2; k.world(s, 0, -0.2, rim.position); k.scene.add(rim);
  holoPanel(k, '현재 접속자 3명', '#5ff0ff', 36, 12, FINISH_S + 60, 0, 16, '호라이즌 광장에 오신 것을 환영합니다');
}

// ---------- a legless avatar (procedural traffic) ----------
function makeAvatar() {
  const g = new THREE.Group();
  const shirt = new THREE.MeshPhysicalMaterial({ color: '#4a7bd8', roughness: 0.6, sheen: 1, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.6 }); shirt.name = 'paint';
  const skin = new THREE.MeshPhysicalMaterial({ color: '#e7b996', roughness: 0.5, clearcoat: 0.3 });
  const hair = new THREE.MeshStandardMaterial({ color: '#3a2a20', roughness: 0.8 });
  const dark = new THREE.MeshBasicMaterial({ color: '#141418' });
  const white = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const tail = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2, 3), toneMapped: false, transparent: true, opacity: 0.85 });
  const S = 1.15; // avatars here are a bit larger than life
  const body = new THREE.Group(); body.position.y = 1.1 * S; body.scale.setScalar(S); g.add(body);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.55, 8, 20), shirt); torso.scale.set(1, 1, 0.72); torso.position.y = 0.55; torso.castShadow = true; body.add(torso);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.2, 12), skin); neck.position.y = 1.15; body.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 28, 20), skin); head.scale.set(0.92, 1.05, 0.95); head.position.y = 1.5; head.castShadow = true; body.add(head);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.375, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.42), hair); cap.position.y = 1.53; cap.rotation.x = 0.35; body.add(cap);
  // face toward +z: it turns around to wave at you as you come up behind it
  for (const x of [-0.12, 0.12]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 10), white); e.position.set(x, 1.55, 0.31); body.add(e);
    const pu = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), dark); pu.position.set(x, 1.55, 0.36); body.add(pu);
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.018, 6, 16, Math.PI), dark); smile.rotation.z = Math.PI; smile.position.set(0, 1.4, 0.33); body.add(smile);
  // floating hands, no arms (very on-brand)
  for (const [x, y] of [[-0.62, 0.6], [0.66, 1.3]]) { const h = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), skin); h.scale.set(1, 1.15, 0.7); h.position.set(x, y, 0.15); body.add(h); }
  // no legs: a hover ring where they would be, spinning
  const pivot = new THREE.Group(); pivot.name = 'pivot'; pivot.position.y = 0.45; g.add(pivot);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62 * S, 0.05, 8, 40), tail); ring.rotation.x = Math.PI / 2; pivot.add(ring);
  for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.3), tail); const a = i / 3 * Math.PI * 2; b.position.set(Math.cos(a) * 0.62 * S, 0, Math.sin(a) * 0.62 * S); b.rotation.y = -a; pivot.add(b); }
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.55 * S, 0.25 * S, 0.9, 20, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.2, 1.8), transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  beam.position.y = 0.45; g.add(beam);
  // name tag
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = 'rgba(10,10,30,0.7)'; x.beginPath(); x.roundRect(8, 16, 496, 96, 48); x.fill();
  x.font = '700 54px "Noto Sans KR", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#ffffff'; x.fillText('다리 없음 · Lv.1', 256, 66);
  const tt = new THREE.CanvasTexture(c); tt.colorSpace = THREE.SRGBColorSpace;
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.42), new THREE.MeshBasicMaterial({ map: tt, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  tag.position.y = 1.1 * S + 2.1 * S; g.add(tag);
  g.userData = { kind: 'avatar', cfg: { colors: ['#4a7bd8', '#e0504a', '#3aa876', '#f2b632', '#8a5ad8', '#2a2a32', '#f2f2f0', '#e86aa8'] }, size: new THREE.Vector3(1.4, 2.8, 1.2) };
  return g;
}

// ---------- per frame ----------
function tick(time, camera) {
  if (!live.k) return;
  const sCam = -camera.position.z;
  const v = THREE.MathUtils.smoothstep(sCam, PORTAL - 15, PORTAL + 25);
  if (live.portal) live.portal.uniforms.time.value = time;
  if (live.vsky) { live.vsky.position.copy(camera.position); live.vsky.material.uniforms.mixv.value = v; live.vsky.material.uniforms.time.value = time; live.vsky.visible = v > 0.001; }
  if (live.floor) { live.floor.position.x = camera.position.x; live.floor.position.z = camera.position.z; live.floor.material.uniforms.time.value = time; live.floor.material.uniforms.fade.value = 0.25 + 0.75 * v; }
  const sc = live.k.scene;
  if (sc.fog) sc.fog.color.copy(live.fogA).lerp(live.fogB, v);
  live.lights ??= { hemi: sc.children.find((o) => o.isHemisphereLight), sun: sc.children.find((o) => o.isDirectionalLight) };
  if (live.lights.hemi) live.lights.hemi.intensity = 0.7 + v * 0.25;
  if (live.lights.sun) { live.lights.sun.intensity = 2.1 - v * 0.9; live.lights.sun.color.setRGB(1, 0.77 - v * 0.2, 0.63 + v * 0.35); }
  if (live.pads) live.pads.emissiveIntensity = 0.75 + Math.sin(time * 4) * 0.3;
  if (live.roadGrid) live.roadGrid.emissiveIntensity = (0.6 + Math.sin(time * 1.3) * 0.12) * v;
  for (const h of live.holos) h.m.material.opacity = Math.sin(time * 23 + h.ph) > 0.96 ? 0.35 : 1;
  const sh = live.shards;
  if (sh && v > 0) sh.base.forEach((b, i) => {
    if (Math.abs(b.s - sCam) > 420) { sh.im.setMatrixAt(i, sh.m4.makeScale(0, 0, 0)); return; }
    live.k.world(b.s, b.d, b.y + Math.sin(time * b.sp + b.ph) * 1.5, sh.p);
    sh.q.setFromEuler(sh.e.set(time * b.sp, time * b.sp * 0.7 + b.ph, 0));
    sh.im.setMatrixAt(i, sh.m4.compose(sh.p, sh.q, sh.sc.setScalar(b.z)));
  });
  if (sh) sh.im.instanceMatrix.needsUpdate = true;
  if (Math.abs(sCam - EDGE) < 400) updateVoxels(time);
}
