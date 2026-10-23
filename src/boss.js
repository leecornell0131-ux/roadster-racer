// Stage bosses. A boss hovers above the road ahead of the player and attacks lanes with a
// telegraph first; the player answers with the auto-aimed Tesla coil (charged by pickups)
// or a jump attack from below. Everything game-side comes in through ctx so bosses stay data.
import * as THREE from 'three';
import { instance, addSensorKit } from './realcars.js';
import { wheel, makeRTX5090 } from './models.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const LANE_W = 6;

// ---------- Waymo Mothership (stage 1) ----------
// a robotaxi van blown up to bus size, hovering on lidar-blue thrusters, bristling with sensors
export function buildWaymoMothership(proto) {
  const g = new THREE.Group();
  const body = instance(proto, '#f4f5f3');
  const scale = 3.8;
  body.scale.setScalar(scale);
  g.add(body);
  const size = proto.userData.size.clone().multiplyScalar(scale);
  // extra sensor domes fore and aft of the stock roof kit
  const domes = new THREE.Group();
  for (const z of [-1.1, 1.3]) {
    const k = new THREE.Group(); k.userData.size = proto.userData.size.clone().setY(proto.userData.size.y - 0.5);
    addSensorKit(k);
    const kit = k.children[k.children.length - 1]; kit.position.z += z; kit.scale.setScalar(0.8); domes.add(kit);
  }
  domes.scale.setScalar(scale); g.add(domes);
  const pivots = []; g.traverse((o) => { if (o.name === 'pivot') pivots.push(o); });
  // hover thrusters
  const jetMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 2.2, 3.2), toneMapped: false, transparent: true, opacity: 0.85 });
  const jets = [];
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const j = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 1.1, 1.6, 20, 1, true), jetMat);
    j.position.set(x * size.x * 0.32, -0.6, z * size.z * 0.32); g.add(j); jets.push(j);
  }
  // the weak point: a red "lidar eye" on the tail, glows brighter when charged up
  const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.2, 0.25), toneMapped: false });
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.9, 24, 16), eyeMat);
  eye.position.set(0, size.y * 0.45, size.z / 2 + 0.2); eye.scale.z = 0.5; eye.name = 'eye'; g.add(eye);
  const eyeRing = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.12, 8, 32), new THREE.MeshStandardMaterial({ color: '#15161a', metalness: 0.8, roughness: 0.3 }));
  eyeRing.position.copy(eye.position); g.add(eyeRing);
  g.userData = { size, pivots, jets, eyeMat, eye };
  return g;
}

// ---------- BYD chairman's clone trailer (stage 2) ----------
// the chairman's own electric bus hauling a double-deck car carrier full of identical Dolphins,
// a cloning reactor glowing on the headboard. It drives on the road; the clones roll off the back.
const CLONE_COLOR = '#2f8797';
export function buildCloneTrailer(protos) {
  const g = new THREE.Group();
  const bus = instance(protos.bus, '#f2f2f0'); bus.position.z = -8.6; g.add(bus);
  const steel = new THREE.MeshStandardMaterial({ color: '#30343a', metalness: 0.85, roughness: 0.38 });
  const yellow = new THREE.MeshStandardMaterial({ color: '#d9a21b', metalness: 0.4, roughness: 0.5 });
  const L = 17, z0 = -1.5, zc = z0 + L / 2, W = 2.6;
  const box = (w, h, d, x, y, z, m = steel) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; g.add(b); return b; };
  box(W, 0.35, L, 0, 1.0, zc);                         // lower deck
  box(W, 0.22, L - 1, 0, 3.05, zc + 0.5);              // upper deck
  for (const x of [-W / 2 + 0.08, W / 2 - 0.08]) {
    box(0.16, 0.5, L, x, 0.75, zc, yellow);            // chassis rails
    box(0.12, 0.12, L - 1, x, 4.7, zc + 0.5);          // top rails
    for (let z = z0 + 0.4; z < z0 + L; z += 2.4) box(0.14, 3.8, 0.14, x, 2.8, z);
  }
  box(W, 4.2, 0.3, 0, 2.6, z0 + 0.15);                 // headboard
  // rear ramp (the clones roll down it)
  const ramp = box(W - 0.2, 0.12, 3.6, 0, 0, 0); ramp.position.set(0, 0.95, z0 + L + 1.5); ramp.rotation.x = 0.28;
  // axles
  for (const z of [z0 + L - 5.2, z0 + L - 3.8, z0 + L - 2.4]) for (const x of [-1.05, 1.05]) {
    const w = wheel({ r: 0.52, width: 0.36, rim: '#9aa0a8', spokes: 8, rimR: 0.3 }); w.position.set(x, 0.52, z); w.name = 'wheel'; w.userData.r = 0.52; g.add(w);
  }
  // the cargo: identical clones on both decks
  const clones = [];
  for (const [y, zs] of [[1.18, [z0 + 3, z0 + 7.6, z0 + 12.2]], [3.16, [z0 + 3.4, z0 + 8, z0 + 12.6]]]) for (const z of zs) {
    const c = instance(protos.dolphin, CLONE_COLOR); c.position.set(0, y, z); c.rotation.x = y > 2 ? -0.04 : 0; g.add(c); clones.push(c);
  }
  // cloning reactor on the headboard: the weak point
  const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.25, 0.2), toneMapped: false });
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.2, 28), new THREE.MeshPhysicalMaterial({ color: '#202428', metalness: 0.9, roughness: 0.25, clearcoat: 1 }));
  tank.rotation.z = Math.PI / 2; tank.position.set(0, 5.4, z0 + 0.6); g.add(tank);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.7, 24, 16), eyeMat); eye.position.set(0, 5.4, z0 + 0.6); eye.scale.set(1.5, 1, 1); eye.name = 'eye'; g.add(eye);
  for (const x of [-1.15, 1.15]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.1, 8, 28), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 2.4, 3.2), toneMapped: false })); r.rotation.y = Math.PI / 2; r.position.set(x * 0.8, 5.4, z0 + 0.6); g.add(r); }
  // price-war hologram
  const c = document.createElement('canvas'); c.width = 512; c.height = 160; const x = c.getContext('2d');
  x.font = '900 120px "Black Han Sans", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = '#ff2a3a'; x.shadowBlur = 20; x.fillStyle = '#ff5a5a'; x.fillText('-50%', 256, 84);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const holo = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.4), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  holo.material.color.setScalar(2); holo.position.set(0, 7.2, z0 + 0.6); holo.rotation.y = Math.PI; g.add(holo);
  const size = new THREE.Vector3(W, 6, 31.5);
  g.userData = { size, pivots: [], jets: [], eyeMat, eye, holo, rear: z0 + L + 3.2, front: 15.2 };
  return g;
}

// ---------- the AGI Orb (stage 3) ----------
// a chrome iris-scanning orb the size of a house, ringed by the GPUs it hoarded. The lens is the weak point.
function holoTex(lines, color = '#b48cff', w = 1024, h = 256) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = color; x.shadowBlur = 26; x.fillStyle = '#efe6ff';
  lines.forEach(([t, size], i) => { x.font = `900 ${size}px "Black Han Sans", "Noto Sans KR", sans-serif`; x.fillText(t, w / 2, h * (i + 0.5) / lines.length + 4); });
  x.globalAlpha = 0.18; x.fillStyle = '#000'; for (let y = 0; y < h; y += 6) x.fillRect(0, y, w, 2); // scanlines
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function buildOrb() {
  const g = new THREE.Group();
  const R = 3.3;
  const chrome = new THREE.MeshPhysicalMaterial({ color: '#d9dce2', metalness: 1, roughness: 0.07, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.5 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 40), chrome); body.castShadow = true; g.add(body);
  // seam and the black glass face around the lens (faces the chasing car, +z)
  const seam = new THREE.Mesh(new THREE.TorusGeometry(R * 1.002, 0.035, 8, 96), new THREE.MeshStandardMaterial({ color: '#2a2c30', metalness: 0.8, roughness: 0.4 })); g.add(seam);
  const faceGlass = new THREE.MeshPhysicalMaterial({ color: '#06070a', metalness: 0.2, roughness: 0.04, clearcoat: 1, envMapIntensity: 1.6 });
  const face = new THREE.Mesh(new THREE.SphereGeometry(R * 1.004, 48, 24, 0, Math.PI * 2, 0, 0.62), faceGlass); face.rotation.x = Math.PI / 2; g.add(face);
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(R * Math.sin(0.62), 0.09, 10, 64), chrome); bezel.position.z = R * Math.cos(0.62); g.add(bezel);
  // the iris: glowing rings around a black pupil
  const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 0.7, 4), toneMapped: false });
  const iris = new THREE.Mesh(new THREE.RingGeometry(0.42, 1.05, 64), eyeMat); iris.position.z = R + 0.02; g.add(iris);
  const iris2 = new THREE.Mesh(new THREE.RingGeometry(1.18, 1.26, 64), eyeMat); iris2.position.z = R - 0.05; g.add(iris2);
  const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.42, 48), new THREE.MeshPhysicalMaterial({ color: '#000', roughness: 0.02, clearcoat: 1 })); pupil.position.z = R + 0.03; g.add(pupil);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), new THREE.MeshBasicMaterial({ visible: false })); eye.position.z = R; eye.name = 'eye'; g.add(eye);
  // scanner light cone (its "iris scan")
  const cone = new THREE.ConeGeometry(2.2, 14, 32, 1, true); cone.translate(0, -7, 0); cone.rotateX(-Math.PI / 2); cone.rotateY(Math.PI);
  const scan = new THREE.Mesh(cone, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 0.6, 3.2), transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  scan.position.z = R; g.add(scan);
  // anti-gravity halo underneath
  const haloMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.1, 0.6, 3.2), toneMapped: false, transparent: true, opacity: 0.85 });
  const halo = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.12, 8, 64), haloMat); halo.rotation.x = Math.PI / 2; halo.position.y = -R - 0.6; g.add(halo);
  const halo2 = halo.clone(); halo2.scale.setScalar(0.62); halo2.position.y = -R - 1.2; g.add(halo2);
  // the hoard: a slow ring of graphics cards
  const ring = new THREE.Group(); ring.name = 'gpuRing'; g.add(ring);
  const card = makeRTX5090();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2, c = card.clone();
    c.scale.setScalar(1.7); c.position.set(Math.cos(a) * 6.2, Math.sin(a * 3) * 0.5, Math.sin(a) * 6.2); c.rotation.set(0.3, -a, 0.2);
    ring.add(c);
  }
  // hype hologram
  const holoMat = new THREE.MeshBasicMaterial({ map: holoTex([['AGI 다음 달 출시!', 150], ['진짜임 · 구독 $200/월', 72]]), transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  holoMat.color.setScalar(1.6);
  const holo = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5), holoMat); holo.position.set(0, R + 2.4, 0); g.add(holo);
  const size = new THREE.Vector3(R * 2, R * 2, R * 2);
  g.userData = { size, pivots: [], jets: [halo, halo2], eyeMat, eye, holo, holoMat, ring, scan, eyeCol: new THREE.Color(0.35, 0.17, 1), firedTex: holoTex([['해임됨', 170], ['이사회 결정 · 5초 후 복귀?', 70]], '#ff4a6a') };
  return g;
}

// ---------- Lizard Zuck's Mega Headset (stage 4) ----------
// a VR headset the size of a bus. Its front display shows a friendly avatar face; at half health the
// face glitches off and the reptile underneath looks out. The display is the weak point.
function faceTex(reptile) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const x = c.getContext('2d');
  if (!reptile) {
    const g = x.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#1b2a6b'); g.addColorStop(1, '#3b1a6b'); x.fillStyle = g; x.fillRect(0, 0, 1024, 512);
    x.fillStyle = '#f1c9a5'; x.beginPath(); x.ellipse(512, 270, 230, 250, 0, 0, Math.PI * 2); x.fill();          // face
    x.fillStyle = '#6b4a2e'; x.beginPath(); x.ellipse(512, 120, 250, 110, 0, Math.PI, 0); x.fill(); x.fillRect(262, 110, 500, 40); // caesar cut
    for (const ex of [420, 604]) { x.fillStyle = '#fff'; x.beginPath(); x.ellipse(ex, 250, 52, 40, 0, 0, Math.PI * 2); x.fill(); x.fillStyle = '#3b6fb0'; x.beginPath(); x.arc(ex, 254, 26, 0, Math.PI * 2); x.fill(); x.fillStyle = '#000'; x.beginPath(); x.arc(ex, 254, 12, 0, Math.PI * 2); x.fill(); }
    x.strokeStyle = '#8a3a2e'; x.lineWidth = 12; x.beginPath(); x.arc(512, 340, 90, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke();       // the smile
  } else {
    x.fillStyle = '#1f3a1a'; x.fillRect(0, 0, 1024, 512);
    for (let y = 0; y < 512; y += 26) for (let xx = (y / 26) % 2 ? 13 : 0; xx < 1024; xx += 26) {           // scales
      const g = x.createRadialGradient(xx, y, 2, xx, y, 16); g.addColorStop(0, '#6fa04a'); g.addColorStop(1, '#22401c'); x.fillStyle = g; x.beginPath(); x.arc(xx, y, 15, 0, Math.PI * 2); x.fill();
    }
    for (const ex of [380, 644]) {
      const g = x.createRadialGradient(ex, 250, 10, ex, 250, 95); g.addColorStop(0, '#fff6a0'); g.addColorStop(0.6, '#e8b81a'); g.addColorStop(1, '#6a4a00'); x.fillStyle = g;
      x.beginPath(); x.ellipse(ex, 250, 105, 80, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#000'; x.beginPath(); x.ellipse(ex, 250, 13, 72, 0, 0, Math.PI * 2); x.fill();             // slit pupils
    }
  }
  x.globalAlpha = 0.12; x.fillStyle = '#000'; for (let y = 0; y < 512; y += 4) x.fillRect(0, y, 1024, 1);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function buildHeadset() {
  const g = new THREE.Group();
  const W = 9, H = 4.8, D = 4;
  const shell = new THREE.MeshPhysicalMaterial({ color: '#eceef0', roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.2 });
  const black = new THREE.MeshPhysicalMaterial({ color: '#0a0b0e', roughness: 0.12, clearcoat: 1, envMapIntensity: 1.4 });
  const fabric = new THREE.MeshStandardMaterial({ color: '#3a3d44', roughness: 0.95 });
  const body = new THREE.Mesh(new RoundedBoxGeometry(W, H, D, 6, 1.3), shell); body.castShadow = true; g.add(body);
  const visor = new THREE.Mesh(new RoundedBoxGeometry(W - 0.6, H - 0.6, 0.6, 4, 0.25), black); visor.position.z = D / 2 + 0.05; g.add(visor);
  const happy = faceTex(false), lizard = faceTex(true);
  const eyeMat = new THREE.MeshBasicMaterial({ map: happy, toneMapped: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(W - 1.6, H - 1.4), eyeMat); screen.position.z = D / 2 + 0.37; g.add(screen);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 8), new THREE.MeshBasicMaterial({ visible: false })); eye.position.z = D / 2 + 0.4; eye.name = 'eye'; g.add(eye);
  // tracking cameras on the corners
  for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const cam = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.12, 20), black); cam.rotation.x = Math.PI / 2; cam.position.set(x * (W / 2 - 0.9), y * (H / 2 - 0.7), D / 2 + 0.36); g.add(cam); }
  // head strap loop behind, and the lettering
  const strap = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.45, 10, 40), fabric); strap.rotation.x = Math.PI / 2; strap.scale.set(1.1, 1.5, 1); strap.position.z = -3.6; g.add(strap);
  const top = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.35, 8, 30, Math.PI), fabric); top.rotation.y = Math.PI / 2; top.position.set(0, H / 2 - 0.4, -2.2); g.add(top);
  const c = document.createElement('canvas'); c.width = 512; c.height = 96; const x = c.getContext('2d'); x.font = '900 72px "Chakra Petch", sans-serif'; x.textAlign = 'center'; x.fillStyle = '#9aa0aa'; x.fillText('MEGA QUEST', 256, 72);
  const lt = new THREE.CanvasTexture(c); lt.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.68), new THREE.MeshStandardMaterial({ map: lt, transparent: true })); label.position.set(0, H / 2 - 0.12, D / 2 - 0.4); label.rotation.x = -Math.PI / 2 + 0.6; g.add(label);
  // the tongue, hidden until it lashes
  const tongue = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 1, 12), new THREE.MeshPhysicalMaterial({ color: '#d0445e', roughness: 0.3, clearcoat: 1 }));
  tongue.geometry.translate(0, 0.5, 0); tongue.visible = false; g.add(tongue);
  // hover glow
  const haloMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 1.2, 3.2), toneMapped: false, transparent: true, opacity: 0.8 });
  const halo = new THREE.Mesh(new THREE.TorusGeometry(2.8, 0.12, 8, 48), haloMat); halo.rotation.x = Math.PI / 2; halo.position.y = -H / 2 - 0.8; g.add(halo);
  const size = new THREE.Vector3(W, H, D);
  g.userData = { size, pivots: [], jets: [halo], eyeMat, eye, eyeCol: new THREE.Color(0.32, 0.32, 0.32), happy, lizard, tongue, screen };
  return g;
}

export const BOSSES = {
  waymo: {
    name: '웨이모 마더십', sub: '라이다 47개 탑재', hp: 100, appearAt: 430, giveUpAt: 2420, hover: 4.6,
    xp: 250, doge: 120,
    lines: {
      intro: '저거 봐, 웨이모 마더십이야! 라이다로 도로 전체를 스캔해. 빨간 줄이 깔린 차선은 피해!',
      coil: '코일 충전 완료! F(⚡)로 쏴. 자동 조준이야.',
      jump: '경사로에서 날아올라 배를 들이받아도 크게 들어가.',
      half: '절반 남았어! 이제 콘을 막 뿌릴 거야.',
      win: '라이다가 47개여도 하늘에서 떨어지는 테슬라는 못 보네.',
      flee: '강 건너로 도망갔어… 다음엔 꼭 잡자.',
    },
  },
  orb: {
    name: '올트-맨의 AGI 오브', sub: '클로즈드AI · 홍채 스캔하면 AGI 다음 달에 드림', hp: 100, appearAt: 900, giveUpAt: 2960, hover: 7, orb: true,
    xp: 380, doge: 200, need: [],
    lines: {
      intro: '올트-맨의 AGI 오브다! 구독료 청구서를 날려. 빨간 차선은 청구서 날아오는 자리야!',
      coil: '코일 충전 완료! F(⚡)로 렌즈를 쏴. 자동 조준이야.',
      jump: '저거 높이 떠 있지? 언덕 꼭대기나 경사로에서 날아서 들이받아!',
      fired: '속보! 이사회가 올트-맨을 해임했대! 지금 내려앉았어, 5초 안에 두들겨!',
      back: '…5초 만에 복귀. 직원들이 하트 이모지 700개 날렸대.',
      half: '복귀하더니 서버랙까지 던진다. 빈 차선 찾아!',
      win: '오브 박살! AGI는 다음 달에도 안 나오겠네.',
      flee: '안개 속으로 도망갔어… 다음엔 꼭 잡자.',
    },
  },
  headset: {
    name: '리자드 저크의 메가 헤드셋', sub: '메가 퀘스트 프로 · 다리는 다음 업데이트에', hp: 110, appearAt: 760, giveUpAt: 3100, hover: 6.5, lizard: true,
    xp: 420, doge: 220, need: ['avatar'],
    lines: {
      intro: '저기 거대 VR 헤드셋! 리자드 저크가 안에 있어. 하얀 선크림 뿌린 차선은 미끄러워!',
      coil: '코일 충전 완료! F(⚡)로 디스플레이를 쏴.',
      jump: '좋아요 패드로 날아올라서 헤드셋을 들이받아!',
      half: '화면이 벗겨진다… 렙틸리언 정체 발각! 혀 날름 공격 조심해!',
      win: '헤드셋 박살! 저크는 햇볕 쬐러 나갔대. 선크림 바르고.',
      flee: '로그아웃해버렸어… 다음엔 꼭 잡자.',
    },
  },
  trailer: {
    name: '클론 트레일러', sub: 'BYD 왕회장 전용 · 돌핀 무한 복제', hp: 110, appearAt: 1880, giveUpAt: 3080, ground: true,
    xp: 320, doge: 160, need: ['bus', 'dolphin'],
    lines: {
      intro: '왕회장 트레일러다! 뒤에서 돌핀 클론을 계속 뽑아내. 빨간 차선은 클론이 굴러 나오는 자리야!',
      coil: '코일 충전 완료! F(⚡)로 복제기를 쏴.',
      jump: '경사로에서 날아서 트레일러 위에 착지해봐. 밟으면 크게 들어가.',
      half: '절반! 이제 가격 파괴 폭탄까지 뿌린다. 빈 차선 찾아!',
      win: '복제기 폭발! 이제 돌핀은 한 대씩만 나오겠네.',
      flee: '다운타운으로 빠졌어… 다음엔 꼭 잡자.',
    },
  },
};

export function createBoss(ctx, key, protos) {
  const def = BOSSES[key];
  if (!def) return null;
  for (const k of def.need || ['waymo']) if (!protos[k]) throw new Error('boss needs model ' + k);
  const orb = !!def.orb, lizard = !!def.lizard;
  const mesh = def.ground ? buildCloneTrailer(protos) : orb ? buildOrb() : lizard ? buildHeadset() : buildWaymoMothership(protos.waymo);
  mesh.visible = false; ctx.scene.add(mesh);
  const size = mesh.userData.size;
  const ground = !!def.ground;
  const B = { def, mesh, hp: def.hp, active: false, done: false, defeated: false, s: 0, d: 0, y: ground ? 0 : def.hover, gap: 34, atkT: 4, phase: 1, telegraph: null, beam: null, hurtT: 0, fallV: 0, jumpCd: 0, cones: [] };
  const NL = ctx.LANES.length, laneMax = NL - 1;
  // trailer footprint along the track (s offsets from its origin)
  const rearOff = mesh.userData.rear ?? size.z / 2, frontOff = mesh.userData.front ?? size.z / 2;

  // lane telegraph stripes + beam (one strip per lane)
  const stripeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.1, 0.15), transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending });
  const beamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 0.3, 0.35), transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const STRIPE_LEN = 70;
  const stripes = ctx.LANES.map(() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(LANE_W - 2, STRIPE_LEN), stripeMat.clone()); m.rotation.x = -Math.PI / 2; m.visible = false; ctx.scene.add(m); return m; });
  const beams = ctx.LANES.map(() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1), beamMat.clone()); m.visible = false; ctx.scene.add(m); return m; });

  // traffic cones it drops
  const coneGeo = new THREE.ConeGeometry(0.42, 1.1, 18); coneGeo.translate(0, 0.55, 0);
  const coneMat = new THREE.MeshStandardMaterial({ color: '#ff5a12', roughness: 0.55, emissive: '#ff3a00', emissiveIntensity: 0.35 });
  const bandMat = new THREE.MeshStandardMaterial({ color: '#f4f4f4', roughness: 0.4, emissive: '#ffffff', emissiveIntensity: 0.4 });
  function makeCone() {
    const g = new THREE.Group();
    const c = new THREE.Mesh(coneGeo, coneMat); c.castShadow = true; g.add(c);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.33, 0.16, 18), bandMat); band.position.y = 0.55; g.add(band);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.08, 0.95), coneMat); base.position.y = 0.04; g.add(base);
    return g;
  }

  // price-war barricades the trailer drops in phase 2
  const tagTex = (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
    x.fillStyle = '#d81e2a'; x.fillRect(0, 0, 256, 128); x.fillStyle = '#fff'; x.fillRect(8, 8, 240, 112); x.fillStyle = '#d81e2a'; x.fillRect(16, 16, 224, 96);
    x.fillStyle = '#fff'; x.font = '900 64px "Black Han Sans", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('-50%', 128, 66);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const tagMat = new THREE.MeshStandardMaterial({ map: tagTex, roughness: 0.5, emissive: '#ffffff', emissiveMap: tagTex, emissiveIntensity: 0.35 });
  const legMat = new THREE.MeshStandardMaterial({ color: '#d8d8d8', metalness: 0.7, roughness: 0.4 });
  function makeTag() {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.2, 0.12), tagMat); b.position.y = 1.0; b.castShadow = true; g.add(b);
    for (const x of [-1, 1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 0.5), legMat); l.position.set(x, 0.45, 0); g.add(l); }
    return g;
  }
  // the orb's ammunition: subscription invoices, hype walls, server racks
  const invoiceTex = (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 340; const x = c.getContext('2d');
    x.fillStyle = '#fbfaf6'; x.fillRect(0, 0, 256, 340); x.fillStyle = '#7b4dff'; x.fillRect(0, 0, 256, 54);
    x.fillStyle = '#fff'; x.font = '900 30px "Black Han Sans", sans-serif'; x.textAlign = 'center'; x.fillText('INVOICE', 128, 38);
    x.fillStyle = '#222'; x.font = '700 22px "Noto Sans KR", sans-serif'; x.fillText('ClosedAI Pro 구독', 128, 96);
    x.fillStyle = '#bbb'; for (let y = 120; y < 240; y += 18) x.fillRect(28, y, 200 - (y % 36) * 2, 7);
    x.fillStyle = '#d81e2a'; x.font = '900 52px "Black Han Sans", sans-serif'; x.fillText('$200/월', 128, 300);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const invoiceMat = new THREE.MeshStandardMaterial({ map: invoiceTex, roughness: 0.7, side: THREE.DoubleSide, emissive: '#ffffff', emissiveMap: invoiceTex, emissiveIntensity: 0.55 });
  const invoiceGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.8, 4), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  function makeInvoice() {
    const g = new THREE.Group();
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2), invoiceMat); p.castShadow = true; g.add(p);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.7), invoiceGlow); gl.position.z = -0.02; g.add(gl);
    return g;
  }
  const wallMat = new THREE.MeshBasicMaterial({ map: holoTex([['AGI 다음 달 출시!', 150], ['(이번엔 진짜)', 80]], '#9b7bff'), transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  wallMat.color.setScalar(1.4);
  function makeHoloWall() {
    const g = new THREE.Group();
    const p = new THREE.Mesh(new THREE.PlaneGeometry(ctx.ROAD_HALF * 2, ctx.ROAD_HALF * 0.5), wallMat); p.position.y = ctx.ROAD_HALF * 0.25; g.add(p);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(ctx.ROAD_HALF * 2, 0.08, 0.08), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 0.7, 4), toneMapped: false })); edge.position.y = 0.05; g.add(edge);
    return g;
  }
  const rackMat = new THREE.MeshStandardMaterial({ color: '#16171b', metalness: 0.7, roughness: 0.35 });
  const ledMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 3, 1.2), toneMapped: false });
  function makeRack() {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.1, 1.0), rackMat); b.position.y = 1.05; b.castShadow = true; g.add(b);
    for (let i = 0; i < 7; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.02), ledMat); l.position.set(0, 0.3 + i * 0.26, 0.51); g.add(l); }
    return g;
  }
  const sunTex = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 256; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 128, 10, 64, 128, 64); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.scale(1, 2); x.beginPath(); x.arc(64, 64, 62, 0, Math.PI * 2); x.fill(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const sunMat = new THREE.MeshStandardMaterial({ map: sunTex, transparent: true, depthWrite: false, roughness: 0.1, color: '#fffaf0', emissive: '#fff4e0', emissiveIntensity: 0.25 });
  const makeDrop = ground ? makeTag : orb ? makeRack : makeCone;

  // lightning bolt for the coil shot
  const boltMat = new THREE.LineBasicMaterial({ color: new THREE.Color(1.5, 2.6, 4), toneMapped: false, transparent: true });
  const bolt = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 18 }, () => new THREE.Vector3())), boltMat);
  bolt.frustumCulled = false; bolt.visible = false; ctx.scene.add(bolt);
  let boltT = 0;
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();

  function hud() {
    ctx.$('bossHp').style.width = `${Math.max(0, B.hp / def.hp * 100)}%`;
  }
  function start() {
    B.active = true; mesh.visible = true; B.s = ctx.P.s + 120; B.d = 0; B.y = def.hover + 14;
    ctx.$('bossName').innerHTML = `${def.name}<small>${def.sub}</small>`;
    if (ground) { B.s = ctx.P.s + rearOff + 120; B.y = 0; B.d = ctx.LANES[(NL / 2) | 0]; }
    ctx.$('bossBar').hidden = false; ctx.$('coilRow').hidden = false; ctx.$('fireBtn').hidden = false; document.querySelector('.speed').classList.add('boss');
    ctx.toast(def.name.toUpperCase(), '보스 출현!', '#ff2a3a'); ctx.radio(def.lines.intro);
    ctx.blip(120, 60, 0.8, 'sawtooth', 0.18);
    hud();
  }
  function end() {
    B.active = false; B.done = true;
    ctx.$('bossBar').hidden = true; ctx.$('coilRow').hidden = true; ctx.$('fireBtn').hidden = true; document.querySelector('.speed').classList.remove('boss');
    for (const st of stripes) st.visible = false; for (const b of beams) b.visible = false;
  }
  function damage(n, why) {
    if (!B.active || B.defeated) return;
    if (B.fired) n = Math.round(n * 1.5);
    B.hp -= n; B.hurtT = 0.35; hud();
    ctx.floatText(`${why} -${n}`);
    ctx.blip(900, 200, 0.25, 'square', 0.16);
    mesh.userData.eye.getWorldPosition(tmp);
    for (let i = 0; i < 14; i++) ctx.puff(tmp, new THREE.Vector3((Math.random() - 0.5) * 18, Math.random() * 8, (Math.random() - 0.5) * 18), i % 2 ? '#ffb347' : '#ffe9a0', 1.4, 0.6);
    if (B.phase === 1 && B.hp <= def.hp / 2) {
      if (orb) {
        if (!B.fired && !B.wasFired) {
          B.wasFired = true; B.fired = { t: 5 }; B.telegraph = null; B.beam = null;
          mesh.userData.holoMap ??= mesh.userData.holoMat.map; mesh.userData.holoMat.map = mesh.userData.firedTex; mesh.userData.holoMat.needsUpdate = true;
          ctx.toast('이사회: 해임!', '5초 동안 무방비 · 데미지 1.5배', '#ff4a6a'); ctx.radio(def.lines.fired);
        }
      } else {
        B.phase = 2; ctx.radio(def.lines.half);
        if (lizard) { mesh.userData.eyeMat.map = mesh.userData.lizard; mesh.userData.eyeMat.needsUpdate = true; ctx.toast('렙틸리언 정체 발각!', '혀 날름 공격 주의', '#7dff5a'); B.glitchT = 1.2; }
      }
    }
    if (B.hp <= 0) {
      B.defeated = true; B.fallV = 0;
      ctx.toast('보스 격추!', `+${def.xp} EXP · Ð +${def.doge}`, '#3dff9a');
      ctx.gainXP(def.xp); ctx.addDoge(def.doge);
      ctx.radio(def.lines.win);
      ctx.blip(80, 30, 1.2, 'sawtooth', 0.25);
      ctx.P.shake = 1;
      for (let i = 0; i < 60; i++) ctx.puff(tmp, new THREE.Vector3((Math.random() - 0.5) * 30, Math.random() * 16, (Math.random() - 0.5) * 30), ['#ff6a1a', '#ffd27a', '#555', '#fff'][i % 4], 2.6, 1.1);
      ctx.$('bossBar').hidden = true;
    }
  }
  function fireCoil() {
    if (!B.active || B.defeated || ctx.P.coil < 100) return false;
    ctx.P.coil = 0; boltT = 0.28; bolt.visible = true;
    damage(B.phase === 1 ? 13 : 11, '테슬라 코일');
    ctx.blip(1600, 300, 0.3, 'sawtooth', 0.14);
    return true;
  }

  function spawnInvoices(lanes, sAt) {
    for (const i of lanes) for (let k = 0; k < 2; k++) {
      const m = makeInvoice(); ctx.scene.add(m);
      B.cones.push({ kind: 'invoice', s: sAt - k * 7, d: ctx.LANES[i], y: 1.1, vy: 0, vs: Math.max(14, ctx.P.v * 0.45), m, hit: false, landed: true, spin: Math.random() * 6 });
    }
  }
  function startAttack() {
    const P = ctx.P;
    const nearLane = ctx.LANES.reduce((a, l, i) => (Math.abs(l - P.d) < Math.abs(ctx.LANES[a] - P.d) ? i : a), 0);
    if (lizard && (B.phase === 1 || Math.random() < 0.4)) {
      const lanes = new Set([nearLane, (Math.random() * NL) | 0]);
      if (Math.random() < 0.5) {
        // SPF 100 sprayed across lanes: slippery for a while
        for (const i of lanes) {
          const q = { s: B.s - 26, d: ctx.LANES[i], l: 5, w: 2.4, text: ['선크림!', 'SPF 100에 미끄러짐', '#ffffff'] };
          const m = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 10), sunMat); m.rotation.x = -Math.PI / 2; ctx.scene.add(m);
          B.cones.push({ kind: 'puddle', s: q.s, d: q.d, y: 0.04, vs: 0, m, q, hit: false, landed: true }); ctx.addPuddle(q);
        }
        ctx.floatText('선크림 분사!'); ctx.blip(900, 500, 0.4, 'sine', 0.1);
      } else {
        for (const i of lanes) ctx.addTraffic('avatar', B.s - 4, ctx.LANES[i], { v: Math.max(10, P.v * 0.35), temp: true, name: '다리 없는 아바타' });
        ctx.floatText('아바타 소환!'); ctx.blip(500, 1000, 0.3, 'triangle', 0.1);
      }
      B.atkT = B.phase === 2 ? 2.4 : 3.0;
      return;
    }
    if (orb && B.phase === 1 && Math.random() < 0.35) {
      // a hype wall across the road: harmless, but it hides the invoices behind it
      const m = makeHoloWall(); ctx.scene.add(m);
      const sW = B.s - 8;
      B.cones.push({ kind: 'wall', s: sW, d: 0, y: 0, vy: 0, vs: Math.max(10, P.v * 0.35), m, hit: false, landed: true });
      const hidden = new Set([nearLane, (Math.random() * NL) | 0]);
      spawnInvoices([...hidden], sW + 10);
      ctx.floatText('과대광고 홀로그램!');
      B.atkT = 3.2;
      return;
    }
    if (B.phase === 2 && Math.random() < 0.45) {
      // drop: every lane but one (two free on a wide road)
      const free = new Set([(Math.random() * NL) | 0]); if (NL > 4) free.add((Math.random() * NL) | 0);
      ctx.LANES.forEach((l, i) => {
        if (free.has(i)) return;
        const m = makeDrop(); ctx.scene.add(m);
        B.cones.push({ s: B.s - (ground ? rearOff : size.z * 0.3), d: l + (Math.random() - 0.5) * (ground ? 1 : 2), y: ground ? 2.5 : B.y, vy: 0, m, hit: false, landed: false });
      });
      ctx.floatText(ground ? '가격 파괴 폭탄!' : '콘 투하!');
      B.atkT = 2.6;
      return;
    }
    // lane attack: the player's lane plus one neighbour (two neighbours in phase 2)
    const lanes = new Set([nearLane]);
    const nb = nearLane + (Math.random() < 0.5 ? -1 : 1);
    lanes.add(THREE.MathUtils.clamp(nb, 0, laneMax));
    if (B.phase === 2) lanes.add(THREE.MathUtils.clamp(nearLane - (nb - nearLane), 0, laneMax));
    B.telegraph = { lanes: [...lanes], t: B.phase === 2 ? 0.95 : 1.25 };
    ctx.blip(300, 600, 0.3, 'sine', 0.08);
    B.atkT = B.phase === 2 ? 2.8 : 3.6;
  }

  function update(dt) {
    const P = ctx.P;
    if (!B.active) {
      if (!B.done && P.s > def.appearAt && P.s < def.giveUpAt) start();
      return;
    }
    if (B.defeated && ground) {
      // coasts to a stop, smoking, then blows apart as you pass
      B.s += Math.max(0, P.v * 0.45) * dt; mesh.rotation.z = Math.min(0.3, mesh.rotation.z + dt * 0.2);
      if (Math.random() < 0.5) { mesh.userData.eye.getWorldPosition(tmp); ctx.puff(tmp, new THREE.Vector3((Math.random() - 0.5) * 3, 6, (Math.random() - 0.5) * 3), '#444', 2.2, 1.4); }
      if (P.s > B.s - rearOff - 25) {
        mesh.getWorldPosition(tmp);
        for (let i = 0; i < 70; i++) ctx.puff(tmp, new THREE.Vector3((Math.random() - 0.5) * 34, Math.random() * 18, (Math.random() - 0.5) * 34), ['#ff6a1a', '#ffd27a', '#555', '#fff'][i % 4], 3, 1.2);
        ctx.blip(70, 25, 1, 'sawtooth', 0.25); P.shake = 0.8;
        mesh.visible = false; end();
      }
      return;
    }
    if (B.defeated) {
      B.fallV += 20 * dt; B.y -= B.fallV * dt; B.s += Math.max(0, P.v - 8) * dt * 0.6;
      mesh.rotation.z += dt * 1.6; mesh.rotation.x += dt * 0.5;
      if (B.y < -2) { mesh.visible = false; end(); }
      return;
    }
    if (P.s > def.giveUpAt) {
      ctx.radio(def.lines.flee); ctx.floatText('보스가 도망갔다');
      B.fleeing = true;
    }
    if (B.fleeing) { B.y += 12 * dt; B.s += (P.v + 25) * dt; if (B.y > 60) { mesh.visible = false; end(); } return; }

    const t = performance.now() / 1000;
    if (ground) {
      // drive ahead, rear 18-28 m in front of the car, changing lanes now and then
      B.gap = rearOff + 17 + Math.sin(t * 0.6) * 4;
      const prevS = B.s;
      B.s += P.v * dt + (P.s + B.gap - B.s) * Math.min(1, dt * 1.2);
      B.v = (B.s - prevS) / dt;
      B.laneT = (B.laneT ?? 3) - dt;
      if (B.laneT <= 0 && !B.telegraph) { B.laneT = (B.phase === 2 ? 2.2 : 3.5) + Math.random() * 2; B.laneD = ctx.LANES[1 + ((Math.random() * (NL - 2)) | 0)]; }
      B.d += THREE.MathUtils.clamp((B.laneD ?? B.d) - B.d, -4 * dt, 4 * dt);
      B.yaw = THREE.MathUtils.clamp(((B.laneD ?? B.d) - B.d) * 0.02, -0.06, 0.06);
      // the trailer shoves ordinary traffic out of its way
      for (const o of ctx.traffic()) if (!o.parked && o.s < B.s + frontOff && o.s > B.s - rearOff && Math.abs(o.d - B.d) < 3.2) { o.s = P.s - 120; }
      // rear-ending it hurts; landing on top is the jump attack
      const rear = B.s - rearOff, front = B.s + frontOff;
      if (P.s > rear - 2.2 && P.s < front && Math.abs(P.d - B.d) < size.x / 2 + 0.9) {
        const top = roofAt(P.s, P.d, 99);
        if (P.y < top - 0.6 && P.s < rear + 1) { P.s = rear - 2.3; P.v = Math.min(P.v, (B.v || P.v) * 0.6); P.crashT = 0.6; P.shake = 0.7; if (B.bumpT <= 0 || B.bumpT == null) { ctx.toast('쾅!', '트레일러에 부딪힘', '#ff3d6e'); ctx.blip(160, 40, 0.3, 'sawtooth', 0.18); } B.bumpT = 0.6; }
      }
      B.bumpT = (B.bumpT || 0) - dt;
    } else {
      // hover ahead, matching speed, weaving slowly
      B.gap = 23 + Math.sin(t * 0.7) * 4;
      B.s += P.v * dt + (P.s + B.gap - B.s) * Math.min(1, dt * 1.5);
      const targetD = B.telegraph ? B.d : Math.sin(t * 0.45) * 5;
      B.d += (targetD - B.d) * Math.min(1, dt * 1.5);
      const hoverY = def.hover + Math.sin(t * 2.1) * 0.35;
      if (!B.fired) B.y += (hoverY - B.y) * Math.min(1, dt * 1.5);
    }

    // the board fires him: the orb goes dark and sinks for five seconds, then he's back
    if (B.fired) {
      B.fired.t -= dt;
      B.y += (3.6 - B.y) * Math.min(1, dt * 3);
      if (B.fired.t <= 0) {
        B.fired = null; B.phase = 2; B.hp = Math.min(def.hp, B.hp + 12); hud();
        mesh.userData.holoMat.map = mesh.userData.holoMap; mesh.userData.holoMat.needsUpdate = true;
        ctx.toast('복귀!', '해임 5초 만에 CEO 복귀 · 체력 +12', '#b48cff'); ctx.radio(def.lines.back); ctx.radio(def.lines.half);
        ctx.blip(200, 900, 0.6, 'sawtooth', 0.14); B.atkT = 1.2;
      }
    }

    // coil charges on its own too
    P.coil = Math.min(100, P.coil + dt * 3.2);
    if (P.coil >= 100 && !B.coilHint) { B.coilHint = true; ctx.radio(def.lines.coil); }

    // attacks
    if (B.telegraph) {
      B.telegraph.t -= dt;
      if (B.telegraph.t <= 0) {
        if (orb) {
          spawnInvoices(B.telegraph.lanes, B.s - 4);
          ctx.floatText('구독료 청구서 발송!'); ctx.blip(700, 300, 0.3, 'square', 0.12);
          B.telegraph = null; B.atkT = B.phase === 2 ? 2.3 : 3.2;
        } else if (ground) {
          // clones roll off the back ramp into the marked lanes
          for (const i of B.telegraph.lanes) ctx.addTraffic('dolphin', B.s - rearOff - 3, ctx.LANES[i], { v: Math.max(12, P.v * 0.55), temp: true, color: CLONE_COLOR, name: 'BYD 클론' });
          ctx.floatText('클론 투하!'); ctx.blip(400, 120, 0.35, 'square', 0.14);
          B.telegraph = null; B.atkT = B.phase === 2 ? 2.4 : 3.2;
        } else { B.beam = { lanes: B.telegraph.lanes, t: 0.5, hit: false }; B.telegraph = null; ctx.blip(1200, 80, 0.45, 'sawtooth', 0.16); }
      }
    } else if (B.beam) {
      B.beam.t -= dt;
      const ground = ctx.carGround(P.s, P.d);
      const inLane = B.beam.lanes.some((i) => Math.abs(ctx.LANES[i] - P.d) < LANE_W / 2);
      const ds = B.s - P.s;
      if (!B.beam.hit && inLane && ds > 0 && ds < STRIPE_LEN + 4 && P.y - ground < 1.3) {
        B.beam.hit = true; P.v *= 0.55; P.crashT = 0.6; P.shake = 0.6;
        if (lizard) ctx.toast('혀 날름!', '렙틸리언 혀에 붙잡힘', '#7dff5a'); else ctx.toast('장애물 감지!', '라이다에 걸려 급정거', '#ff3d6e');
        ctx.blip(200, 60, 0.4, 'square', 0.2);
      }
      if (B.beam.t <= 0) B.beam = null;
    } else if (!B.fired) {
      B.atkT -= dt;
      if (B.atkT <= 0) startAttack();
    }

    // cones fall and sit on the road
    for (const c of B.cones) {
      if (c.kind) {
        c.s += c.vs * dt;
        const near = Math.abs(c.s - P.s) < 1.8;
        if (c.kind === 'puddle') continue;
        if (c.kind === 'wall') { if (!c.hit && P.s > c.s) { c.hit = true; ctx.gainXP(5); ctx.floatText('과대광고 통과 +5 EXP'); } continue; }
        if (!c.hit && near && Math.abs(c.d - P.d) < 1.9 && P.y - ctx.carGround(P.s, P.d) < 1.8) {
          c.hit = true; P.v *= 0.7; P.crashT = 0.4; P.shake = 0.45; ctx.addDoge(-10);
          ctx.toast('구독료 자동결제!', '-Ð10 · 감속', '#b48cff'); ctx.blip(900, 300, 0.25, 'square', 0.14);
          c.flyV = new THREE.Vector3((Math.random() - 0.5) * 6, 7, 0);
        }
        if (c.flyV) { c.flyV.y -= 20 * dt; c.y += c.flyV.y * dt; c.d += c.flyV.x * dt; c.s += (P.v - c.vs + 3) * dt; }
        continue;
      }
      if (!c.landed) { c.vy -= 30 * dt; c.y += c.vy * dt; const gy = ctx.carGround(c.s, c.d); if (c.y <= gy) { c.y = gy; c.landed = true; } }
      if (!c.hit && Math.abs(c.s - P.s) < 1.6 && Math.abs(c.d - P.d) < (ground ? 2.2 : 1.4)) {
        if (P.y - ctx.carGround(P.s, P.d) < 0.9) { c.hit = true; P.v *= 0.72; P.shake = 0.4; ctx.floatText(ground ? '가격 파괴!' : '콘 충돌!'); ctx.blip(300, 100, 0.2, 'square', 0.12); c.flyV = new THREE.Vector3((Math.random() - 0.5) * 8, 9, -8); }
      }
      if (c.hit && c.flyV) { c.flyV.y -= 30 * dt; c.y += c.flyV.y * dt; c.d += c.flyV.x * dt; c.s += (P.v + 6) * dt; }
    }
    B.cones = B.cones.filter((c) => { const keep = c.s > P.s - 30 && c.y > -5; if (!keep) { ctx.scene.remove(c.m); if (c.q) ctx.removePuddle(c.q); } return keep; });

    // jump attack: airborne car hits the belly from below
    B.jumpCd -= dt;
    const ds = B.s - P.s;
    if (ground) {
      // stomp: touching down on the trailer's top deck or the bus roof
      const top = roofAt(P.s, P.d, P.y + 0.3);
      if (B.jumpCd <= 0 && top > 2 && P.y - top < 0.25 && P.vy <= 0.5) {
        B.jumpCd = 1.4; damage(22, '스톰프');
        P.vy = 11; P.grounded = false; P.y = top + 0.05; P.air = 0;
        ctx.toast('스톰프!', '트레일러를 밟았다', '#ffc83d');
      }
    } else if (B.jumpCd <= 0 && !P.grounded && Math.abs(ds) < size.z / 2 + 1.5 && Math.abs(B.d - P.d) < size.x / 2 + 0.8 && P.y + 1.2 > B.y - 0.6) {
      B.jumpCd = 1.6; damage(22, '점프 어택');
      P.vy = Math.min(P.vy, -4); P.v *= 0.92;
      ctx.toast('점프 어택!', '배를 들이받았다', '#ffc83d');
    }
    if (B.jumpHintAt == null && P.s > def.appearAt + 500) { B.jumpHintAt = P.s; ctx.radio(def.lines.jump); }
    B.hurtT -= dt;
  }

  // standing surfaces on the trailer (bus roof, top deck cargo) for the game's roof landing
  function roofAt(s, d, yRef) {
    if (!ground || !B.active || B.defeated || !mesh.visible) return null;
    if (Math.abs(d - B.d) > size.x / 2) return null;
    const z = B.s - s; // local z (backward positive)
    let top = null;
    if (z > -frontOff && z < -2) top = 3.35;                 // bus roof
    else if (z > -1.5 && z < rearOff - 3.4) top = 4.75;       // clones on the top deck
    return top != null && yRef >= top - 0.7 ? top : null;
  }

  function sync(time) {
    if (!mesh.visible) { for (const c of B.cones) c.m.visible = false; return; }
    ctx.world(B.s, B.d, B.y, mesh.position);
    if (ground && !B.defeated) {
      mesh.rotation.set(0, ctx.frame(B.s).yaw + (B.yaw || 0), 0);
      mesh.traverse((o) => { if (o.name === 'wheel') { const sp = o.children[0]; if (sp) sp.rotation.x = -B.s / (o.userData.r || 0.5); } });
      mesh.userData.holo.rotation.y = Math.PI + Math.sin(time * 1.5) * 0.25;
    } else if (!B.defeated) { mesh.rotation.set(0, ctx.frame(B.s).yaw, Math.sin(time * 1.3) * 0.04); }
    else mesh.rotation.y = ctx.frame(B.s).yaw;
    for (const p of mesh.userData.pivots) p.rotation.y = time * 6;
    if (!orb) for (const j of mesh.userData.jets) { j.scale.y = 0.8 + Math.sin(time * 30 + j.position.x) * 0.2; }
    const eye = mesh.userData.eyeMat;
    const flash = B.fired ? 0.4 : B.hurtT > 0 ? (Math.sin(time * 60) > 0 ? 8 : 2) : B.telegraph ? 6 + Math.sin(time * 30) * 2 : 4;
    if (mesh.userData.eyeCol) eye.color.copy(mesh.userData.eyeCol).multiplyScalar(flash); else eye.color.setRGB(flash, 0.2, 0.25);
    if (orb) {
      mesh.userData.ring.rotation.y = time * 0.5; mesh.userData.ring.visible = !B.defeated;
      mesh.userData.holo.position.y = 5.7 + Math.sin(time * 1.7) * 0.2; mesh.userData.holo.lookAt(ctx.camera.position);
      mesh.userData.scan.material.opacity = B.fired ? 0 : 0.04 + (B.telegraph ? 0.06 : 0);
      for (const j of mesh.userData.jets) j.material.opacity = B.fired ? 0.1 : 0.85;
    }
    // telegraph stripes and beams
    stripes.forEach((st, i) => {
      const on = (B.telegraph && B.telegraph.lanes.includes(i)) || (B.beam && B.beam.lanes.includes(i));
      st.visible = !!on; if (!on) return;
      const sMid = B.s - (ground ? rearOff : 0) - STRIPE_LEN / 2;
      ctx.world(sMid, ctx.LANES[i], ctx.carGround(sMid, ctx.LANES[i]) + 0.05, st.position);
      st.rotation.set(-Math.PI / 2, 0, ctx.frame(sMid).yaw);
      st.material.opacity = B.beam ? 0.22 : 0.06 + 0.05 * Math.sin(time * 24);
    });
    beams.forEach((bm, i) => {
      const on = B.beam && B.beam.lanes.includes(i) && !lizard;
      bm.visible = !!on; if (!on) return;
      // a sheet of light from the boss down to the far end of the stripe
      const sEnd = B.s - 10;
      ctx.world(B.s, B.d + (ctx.LANES[i] - B.d) * 0.3, B.y, tmp);
      ctx.world(sEnd, ctx.LANES[i], 0.2, tmp2);
      bm.position.copy(tmp).add(tmp2).multiplyScalar(0.5);
      const len = tmp.distanceTo(tmp2);
      bm.scale.set(1, len, 1);
      const dir = tmp2.clone().sub(tmp).normalize();
      bm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      bm.scale.x = 1.4; bm.material.opacity = 0.5 * B.beam.t / 0.5;
    });
    if (lizard) {
      const tg = mesh.userData.tongue; tg.visible = !!B.beam;
      if (B.beam) { const k = 1 - B.beam.t / 0.5; tg.scale.set(1, 6 + 22 * Math.sin(Math.min(1, k * 1.6) * Math.PI), 1); tg.rotation.set(Math.PI / 2 + 0.35, 0, 0); tg.position.set(0, -1.4, 2.2); }
      if (B.glitchT > 0) { B.glitchT -= 1 / 60; mesh.userData.screen.position.x = (Math.random() - 0.5) * 0.6; mesh.userData.screen.scale.y = 0.6 + Math.random() * 0.6; } else { mesh.userData.screen.position.x = 0; mesh.userData.screen.scale.y = 1; }
    }
    for (const c of B.cones) {
      c.m.visible = true; ctx.world(c.s, c.d, c.y + (c.kind === 'invoice' ? Math.sin(time * 6 + c.spin) * 0.25 : 0), c.m.position);
      if (c.kind === 'puddle') { c.m.rotation.set(-Math.PI / 2, 0, ctx.frame(c.s).yaw); continue; }
      c.m.rotation.y = ctx.frame(c.s).yaw;
      if (c.kind === 'invoice') { c.m.rotation.z = Math.sin(time * 4 + c.spin) * 0.35; c.m.rotation.x = -0.2 + Math.sin(time * 5 + c.spin) * 0.15; }
      if (c.kind === 'wall') c.m.children[0].material.opacity = 0.55 + Math.sin(time * 40) * 0.12 + (Math.random() < 0.04 ? -0.4 : 0);
      if (c.flyV) c.m.rotation.x += 0.2;
    }
    // coil bolt from the car's roof to the eye
    if (boltT > 0) {
      boltT -= 1 / 60;
      ctx.car.getWorldPosition(tmp); tmp.y += 1.3;
      mesh.userData.eye.getWorldPosition(tmp2);
      const pos = bolt.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const k = i / (pos.count - 1);
        const j = i === 0 || i === pos.count - 1 ? 0 : 1.2;
        pos.setXYZ(i, tmp.x + (tmp2.x - tmp.x) * k + (Math.random() - 0.5) * j, tmp.y + (tmp2.y - tmp.y) * k + (Math.random() - 0.5) * j, tmp.z + (tmp2.z - tmp.z) * k + (Math.random() - 0.5) * j);
      }
      pos.needsUpdate = true; boltMat.opacity = Math.max(0, boltT / 0.28);
      if (boltT <= 0) bolt.visible = false;
    }
  }

  function reset() {
    for (const c of B.cones) { ctx.scene.remove(c.m); if (c.q) ctx.removePuddle(c.q); }
    Object.assign(B, { hp: def.hp, active: false, done: false, defeated: false, fleeing: false, telegraph: null, beam: null, phase: 1, atkT: 4, cones: [], coilHint: false, jumpHintAt: null, fired: null, wasFired: false });
    if (mesh.userData.holoMap) { mesh.userData.holoMat.map = mesh.userData.holoMap; mesh.userData.holoMat.needsUpdate = true; }
    if (mesh.userData.happy) { mesh.userData.eyeMat.map = mesh.userData.happy; mesh.userData.eyeMat.needsUpdate = true; }
    mesh.visible = false; mesh.rotation.set(0, 0, 0);
    end(); B.done = false;
  }

  // movie-poster pose for the loading screen: looming over the street, eye blazing
  function posterPose(sPos, d, y, time, yawOff = 0) {
    mesh.visible = true;
    if (ground) { ctx.world(sPos, d, y, mesh.position); mesh.rotation.set(0, ctx.frame(sPos).yaw + 0.12, 0); mesh.userData.eyeMat.color.setRGB(6 + Math.sin(time * 4) * 2, 0.25, 0.2); return; }
    ctx.world(sPos, d, y + Math.sin(time * 1.1) * 0.3, mesh.position);
    mesh.rotation.set(0.08, ctx.frame(sPos).yaw + 0.35, 0.05);
    for (const p of mesh.userData.pivots) p.rotation.y = time * 6;
    if (mesh.userData.screen) { mesh.rotation.set(0.1, ctx.frame(sPos).yaw + 0.25 + yawOff, 0); mesh.userData.eyeMat.color.setScalar(1.0); mesh.userData.eyeMat.map = mesh.userData.happy; }
    else if (mesh.userData.eyeCol) { mesh.userData.eyeMat.color.copy(mesh.userData.eyeCol).multiplyScalar(6 + Math.sin(time * 4) * 2); mesh.rotation.set(0.12, ctx.frame(sPos).yaw + 0.2, 0); mesh.userData.ring.rotation.y = time * 0.5; mesh.userData.holo.lookAt(ctx.camera.position); }
    else mesh.userData.eyeMat.color.setRGB(6 + Math.sin(time * 4) * 2, 0.2, 0.25);
  }

  return { B, update, sync, reset, fireCoil, posterPose, roofAt };
}
