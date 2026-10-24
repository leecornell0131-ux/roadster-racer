// Stage bosses. A boss hovers above the road ahead of the player and attacks lanes with a
// telegraph first; the player answers with the auto-aimed Tesla coil (charged by pickups)
// or a jump attack from below. Everything game-side comes in through ctx so bosses stay data.
import * as THREE from 'three';
import { instance, addSensorKit } from './realcars.js';
import { wheel, makeRTX5090 } from './models.js';
import { prop } from './props.js';
import { head } from './heads.js';
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
  const real = prop('carrier', 22);
  if (real) return buildCarrierTrailer(protos, real);
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

// the Sketchfab car carrier (truck at -z, trailer behind it): clones ride its decks, the reactor sits on the rack over the cab
function buildCarrierTrailer(protos, real) {
  const g = new THREE.Group(); g.add(real);
  const clones = [];
  for (const [y, z, tilt] of [[2.78, 8.6, 0], [2.78, 4.1, 0], [2.86, -0.3, -0.03], [0.42, 2.2, 0]]) {
    const c = instance(protos.dolphin, CLONE_COLOR); c.position.set(0, y, z); c.rotation.x = tilt; g.add(c); clones.push(c);
  }
  const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.25, 0.2), toneMapped: false });
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.2, 28), new THREE.MeshPhysicalMaterial({ color: '#202428', metalness: 0.9, roughness: 0.25, clearcoat: 1 }));
  tank.rotation.z = Math.PI / 2; tank.position.set(0, 4.7, -3.6); g.add(tank);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.7, 24, 16), eyeMat); eye.position.copy(tank.position); eye.scale.set(1.5, 1, 1); eye.name = 'eye'; g.add(eye);
  for (const x of [-1.15, 1.15]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.1, 8, 28), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 2.4, 3.2), toneMapped: false })); r.rotation.y = Math.PI / 2; r.position.set(x * 0.8, 4.7, -3.6); g.add(r); }
  const strut = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1, 0.5), new THREE.MeshStandardMaterial({ color: '#30343a', metalness: 0.85, roughness: 0.38 })); strut.position.set(0, 3.8, -3.6); g.add(strut);
  const c = document.createElement('canvas'); c.width = 512; c.height = 160; const x = c.getContext('2d');
  x.font = '900 120px "Black Han Sans", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = '#ff2a3a'; x.shadowBlur = 20; x.fillStyle = '#ff5a5a'; x.fillText('-50%', 256, 84);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const holo = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.4), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  holo.material.color.setScalar(2); holo.position.set(0, 6.5, -3.6); holo.rotation.y = Math.PI; g.add(holo);
  // standing surfaces (local z, backward positive): the truck roof, then the clones on the top deck
  const roofs = [{ z0: -11, z1: -6.4, top: 2.95 }, { z0: -2.4, z1: 10.8, top: 4.3 }];
  g.userData = { size: new THREE.Vector3(2.9, 5, 24), pivots: [], jets: [], eyeMat, eye, holo, rear: 12.4, front: 11, roofs };
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
  // the real headset (when it loaded): its front box is the body, the strap trails behind; the face screen sits on its front
  const real = prop('vrheadset', 14);
  if (real) {
    for (const o of [body, visor, strap, top]) g.remove(o);
    for (const o of g.children.filter((o) => o.geometry?.type === 'CylinderGeometry' && o !== tongue)) g.remove(o);
    real.position.set(0, -2.3, -5); g.add(real);
    screen.position.z = D / 2 + 0.06; screen.scale.set(0.86, 0.86, 1); eye.position.z = D / 2 + 0.1;
    real.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.multiplyScalar(2.2); o.material.envMapIntensity = 2.5; } });
    label.position.set(0, H / 2 + 0.05, 0.4); label.rotation.x = -Math.PI / 2;
  }
  // the wearer: a giant Zuck head behind the visor, eyes level with the screen
  const zuck = head('zuck', 9.5);
  if (zuck) { zuck.position.set(0, -0.6, -6.2); g.add(zuck); g.userData.bobble = zuck; }
  const size = new THREE.Vector3(W, H, D);
  g.userData = { size, pivots: [], jets: [halo], eyeMat, eye, eyeCol: new THREE.Color(0.32, 0.32, 0.32), happy, lizard, tongue, screen };
  return g;
}

// ---------- Uncle Joe's ice-cream truck + Air Force Won drone (stage 5) ----------
// a step-van ice-cream truck blown up to boss size, a soft-serve cone on the roof as its weak point.
// At half health a drone shaped like the presidential jet swoops in and docks above it.
function truckLivery() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const x = c.getContext('2d');
  x.fillStyle = '#f7f5ef'; x.fillRect(0, 0, 1024, 512);
  x.fillStyle = '#7ec8ea'; x.fillRect(0, 360, 1024, 152); x.fillStyle = '#f39ab8'; x.fillRect(0, 336, 1024, 24); x.fillStyle = '#1f4f9a'; x.fillRect(0, 496, 1024, 16);
  // painted soft-serve on the side
  x.fillStyle = '#e0a860'; x.beginPath(); x.moveTo(700, 330); x.lineTo(800, 330); x.lineTo(750, 470); x.fill();
  x.strokeStyle = '#b07830'; x.lineWidth = 4; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(705 + i * 16, 330); x.lineTo(750 + i * 4, 460); x.stroke(); }
  for (const [y, r] of [[300, 62], [240, 50], [190, 36], [150, 20]]) { const g = x.createRadialGradient(735, y - 10, 5, 750, y, r); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#f0e4d0'); x.fillStyle = g; x.beginPath(); x.ellipse(750, y, r, r * 0.55, 0, 0, Math.PI * 2); x.fill(); }
  x.fillStyle = '#d81e2a'; x.font = '900 112px "Black Han Sans", sans-serif'; x.textAlign = 'left'; x.textBaseline = 'middle';
  x.fillText('아이스크림 조', 50, 120);
  x.fillStyle = '#1f4f9a'; x.font = '700 44px "Noto Sans KR", sans-serif';
  x.fillText('규제 맛 · 서류 맛 · 바닐라', 56, 218); x.fillText('1972년부터 영업 중', 56, 276);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function wordTex(text, color, w = 1024, h = 128, size = 84, bg = null) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  if (bg) { x.fillStyle = bg; x.fillRect(0, 0, w, h); }
  x.font = `900 ${size}px "Chakra Petch", "Black Han Sans", sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = color; x.fillText(text, w / 2, h / 2 + 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function buildAF1Drone() {
  const g = new THREE.Group();
  const white = new THREE.MeshPhysicalMaterial({ color: '#f4f5f6', roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.1 });
  const blue = new THREE.MeshPhysicalMaterial({ color: '#7aa6c8', roughness: 0.3, clearcoat: 1 });
  const navy = new THREE.MeshPhysicalMaterial({ color: '#1d3557', roughness: 0.3, clearcoat: 1 });
  const metal = new THREE.MeshStandardMaterial({ color: '#9aa0a8', metalness: 1, roughness: 0.3 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#0c1218', roughness: 0.05, metalness: 0.3, clearcoat: 1 });
  const L = 9.5, R = 0.78;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(R, R, L, 32, 1, false, -Math.PI / 2, Math.PI), white); top.rotation.x = Math.PI / 2; g.add(top);
  const bot = new THREE.Mesh(new THREE.CylinderGeometry(R, R, L, 32, 1, false, Math.PI / 2, Math.PI), blue); bot.rotation.x = Math.PI / 2; g.add(bot);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), white); nose.rotation.x = -Math.PI / 2; nose.scale.set(1, 2.1, 1); nose.position.z = -L / 2; g.add(nose);
  const hump = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.62, 2.6, 8, 20), white); hump.rotation.x = Math.PI / 2; hump.position.set(0, R * 0.55, -L / 2 + 2.3); g.add(hump);  // the 747 upper deck
  const tailc = new THREE.Mesh(new THREE.ConeGeometry(R, 2.4, 32), white); tailc.rotation.x = Math.PI / 2; tailc.position.z = L / 2 + 1.2; g.add(tailc);
  const cock = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.4), glass); cock.position.set(0, R * 1.0, -L / 2 - 0.2); cock.rotation.x = 0.4; g.add(cock);
  // cheat line and windows
  for (const sx of [-1, 1]) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(L + 1.5, 0.16), navy); line.position.set(sx * (R + 0.005), -0.08, 0.4); line.rotation.y = sx * Math.PI / 2; g.add(line);
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 0.55), new THREE.MeshBasicMaterial({ map: wordTex('AIR FORCE WON', '#1d3557'), transparent: true }));
    lab.position.set(sx * (R + 0.01), 0.36, -0.6); lab.rotation.y = sx * Math.PI / 2; g.add(lab);
  }
  // wings, tailplane, fin (swept)
  const wingShape = new THREE.Shape(); wingShape.moveTo(0, 0); wingShape.lineTo(5.2, 2.4); wingShape.lineTo(5.2, 3.2); wingShape.lineTo(0, 2.6); wingShape.lineTo(0, 0);
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2 });
  for (const sx of [-1, 1]) {
    const w = new THREE.Mesh(wingGeo, white); w.rotation.x = Math.PI / 2; w.scale.x = sx; w.position.set(0, -0.35, -1.4); g.add(w);
    const tp = new THREE.Mesh(wingGeo, white); tp.rotation.x = Math.PI / 2; tp.scale.set(sx * 0.42, 0.42, 1); tp.position.set(0, 0.1, L / 2); g.add(tp);
    // engines under the wing
    for (const k of [1.8, 3.6]) { const e = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 1.2, 20), metal); e.rotation.x = Math.PI / 2; e.position.set(sx * k, -0.75, -1.2 + k * 0.45); g.add(e); }
  }
  const fin = new THREE.Mesh(wingGeo, blue); fin.rotation.set(0, -Math.PI / 2, Math.PI / 2); fin.scale.set(0.5, 0.62, 1); fin.position.set(0.07, 0.4, L / 2 - 0.4); g.add(fin);
  // the real 747 (when it loaded) replaces the hand-built fuselage, wings and fin; the drone bits stay
  const real = prop('af1', 12);
  if (real) {
    for (const o of g.children.splice(0)) o.geometry?.dispose();
    real.position.set(0, -1.05, 0.2); g.add(real);
    for (const sx of [-1, 1]) {
      const lab = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.4), new THREE.MeshBasicMaterial({ map: wordTex('AIR FORCE WON', '#1d3557'), transparent: true }));
      lab.position.set(sx * 0.62, 0.05, -1.2); lab.rotation.y = sx * Math.PI / 2; g.add(lab);
    }
  }
  const obama = head('obama', 2.4);
  if (obama) { obama.position.set(0, 1.9, -2.8); g.add(obama); }
  // it's a drone: four lift rotors on outriggers
  const pivots = [];
  for (const [x, z] of [[-3.4, -3.2], [3.4, -3.2], [-3.4, 3.6], [3.4, 3.6]]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(x), 0.12, 0.2), metal); arm.position.set(x / 2, 0.55, z); g.add(arm);
    const duct = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.1, 8, 32), navy); duct.rotation.x = Math.PI / 2; duct.position.set(x, 0.6, z); g.add(duct);
    const pv = new THREE.Group(); pv.position.set(x, 0.6, z); g.add(pv); pivots.push(pv);
    for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.03, 0.16), metal); b.rotation.y = i * Math.PI / 3; pv.add(b); }
  }
  // the megaphone it shouts through, slung under the nose
  const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.18, 1.6, 24, 1, true), new THREE.MeshPhysicalMaterial({ color: '#e8e8ea', metalness: 0.3, roughness: 0.3, side: THREE.DoubleSide }));
  horn.rotation.x = -Math.PI / 2; horn.position.set(0, -1.05, -L / 2 + 0.6); g.add(horn);
  const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.3, 0.3), toneMapped: false });
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 10), eyeMat); eye.position.set(0, -0.2, -L / 2 - 1.3); g.add(eye);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData = { pivots, eye, eyeMat, horn };
  return g;
}
// measured off the Sketchfab truck (truck body 11.4 m) (local z, backward positive)
const REAL_ICE = { scale: 1.31, backY: 2.9, backZ: -0.04, coneY: 6, coneZ: 2.5, roofs: [{ z0: -5.7, z1: 5.6, top: 4.9 }] };
export function buildIceTruck() {
  const g = new THREE.Group();
  const K = 1.5, L = 7.6 * K, W = 2.5 * K;
  const paint = new THREE.MeshPhysicalMaterial({ color: '#f7f5ef', roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  const livery = new THREE.MeshPhysicalMaterial({ map: truckLivery(), roughness: 0.35, clearcoat: 0.8 });
  const chrome = new THREE.MeshPhysicalMaterial({ color: '#d8dce2', metalness: 1, roughness: 0.15 });
  const dark = new THREE.MeshStandardMaterial({ color: '#1b1c20', roughness: 0.7 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#10161c', roughness: 0.04, metalness: 0.2, clearcoat: 1, envMapIntensity: 1.4 });
  const box = (w, h, d, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; g.add(b); return b; };
  const zCab = -L / 2 + 1.6 * K;                            // cab/box boundary
  // chassis + bumpers
  box(W - 0.2, 0.5 * K, L - 0.4, 0, 0.55 * K, 0, dark);
  box(W + 0.1, 0.3 * K, 0.3, 0, 0.55 * K, -L / 2 + 0.05, chrome); box(W + 0.1, 0.3 * K, 0.3, 0, 0.55 * K, L / 2 - 0.05, chrome);
  // the box body: livery on the flanks
  const bodyH = 2.45 * K, bodyY = 0.8 * K + bodyH / 2, bodyL = L / 2 - zCab;
  box(W, bodyH, bodyL, 0, bodyY, zCab + bodyL / 2, paint);
  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(bodyL - 0.1, bodyH - 0.1), livery); side.position.set(sx * (W / 2 + 0.01), bodyY, zCab + bodyL / 2); side.rotation.y = sx * Math.PI / 2; g.add(side);
  }
  // serving window with a striped awning (right side, the kerb side)
  const win = box(0.06, 0.9 * K, 2.6 * K, W / 2 + 0.03, bodyY + 0.25 * K, zCab + bodyL * 0.42, glass);
  const awnTex = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d'); for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#ffffff' : '#e8466e'; x.fillRect(i * 32, 0, 32, 64); } const tt = new THREE.CanvasTexture(c); tt.colorSpace = THREE.SRGBColorSpace; return tt; })();
  const awn = new THREE.Mesh(new THREE.PlaneGeometry(2.9 * K, 0.9), new THREE.MeshStandardMaterial({ map: awnTex, side: THREE.DoubleSide, roughness: 0.7 }));
  awn.position.set(W / 2 + 0.35, bodyY + 0.85 * K, win.position.z); awn.rotation.set(0, Math.PI / 2, 0); awn.rotateX(-0.9); g.add(awn);
  // the cab: lower roof, big windshield, round headlights
  const cabH = 1.95 * K;
  box(W, cabH, zCab + L / 2, 0, 0.8 * K + cabH / 2, (zCab - L / 2) / 2, paint);
  const ws = box(W - 0.3, 0.9 * K, 0.05, 0, 0.8 * K + cabH - 0.55 * K, -L / 2 - 0.02, glass); ws.rotation.x = -0.12;
  for (const sx of [-1, 1]) {
    box(0.05, 0.7 * K, 1.0 * K, sx * (W / 2 + 0.02), 0.8 * K + cabH - 0.5 * K, -L / 2 + 0.9 * K, glass);
    const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * K, 0.2 * K, 0.08, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.8, 2.2), toneMapped: false })); hl.rotation.x = Math.PI / 2; hl.position.set(sx * (W / 2 - 0.4), 1.05 * K, -L / 2 - 0.04); g.add(hl);
  }
  box(W * 0.6, 0.45 * K, 0.06, 0, 1.0 * K, -L / 2 - 0.03, chrome); // grille
  // rear: doors, tail lights, a "STOP" arm folded on the side
  const tail = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 0.15, 0.2), toneMapped: false }); tail.name = 'tail';
  for (const sx of [-1, 1]) { const tl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.05), tail); tl.position.set(sx * (W / 2 - 0.3), 1.3 * K, L / 2 + 0.02); g.add(tl); }
  // the rear doors you chase: menu art and a warning
  const rc = document.createElement('canvas'); rc.width = 512; rc.height = 640; const rx = rc.getContext('2d');
  rx.fillStyle = '#f7f5ef'; rx.fillRect(0, 0, 512, 640); rx.fillStyle = '#7ec8ea'; rx.fillRect(0, 470, 512, 170); rx.fillStyle = '#f39ab8'; rx.fillRect(0, 450, 512, 20);
  rx.fillStyle = '#d81e2a'; rx.font = '900 64px "Black Han Sans", sans-serif'; rx.textAlign = 'center'; rx.fillText('아이스크림 조', 256, 84);
  rx.fillStyle = '#e0a860'; rx.beginPath(); rx.moveTo(196, 330); rx.lineTo(316, 330); rx.lineTo(256, 440); rx.fill();
  for (const [y, r] of [[300, 72], [236, 56], [184, 40], [146, 22]]) { rx.fillStyle = '#ffffff'; rx.strokeStyle = '#e8d8c0'; rx.lineWidth = 4; rx.beginPath(); rx.ellipse(256, y, r, r * 0.55, 0, 0, Math.PI * 2); rx.fill(); rx.stroke(); }
  rx.fillStyle = '#1f4f9a'; rx.font = '700 34px "Noto Sans KR", sans-serif'; rx.fillText('오늘의 맛: 규제 소프트콘', 256, 530);
  rx.fillStyle = '#d81e2a'; rx.font = '900 40px "Black Han Sans", sans-serif'; rx.fillText('어린이 보호 · 천천히', 256, 600);
  const rt = new THREE.CanvasTexture(rc); rt.colorSpace = THREE.SRGBColorSpace;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.2, bodyH - 0.2), new THREE.MeshPhysicalMaterial({ map: rt, roughness: 0.35, clearcoat: 0.8 })); back.position.set(0, bodyY, L / 2 + 0.03); g.add(back);
  // wheels
  for (const z of [-L / 2 + 1.25 * K, L / 2 - 1.5 * K]) for (const x of [-W / 2 + 0.25, W / 2 - 0.25]) {
    const w = wheel({ r: 0.52 * K, width: 0.36 * K, rim: '#e8e8ea', spokes: 8, rimR: 0.3 * K }); w.position.set(x, 0.52 * K, z); w.name = 'wheel'; w.userData.r = 0.52 * K; g.add(w);
  }
  // roof: speakers playing the chime, and the giant soft-serve cone (weak point)
  const roofY = 0.8 * K + bodyH;
  for (const sx of [-1, 1]) { const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.12, 0.9, 20, 1, true), chrome); sp.rotation.z = sx * Math.PI / 2; sp.position.set(sx * 0.9, 0.8 * K + cabH + 0.3, -L / 2 + 0.9 * K); g.add(sp); }
  const coneG = new THREE.Group(); coneG.position.set(0, roofY, zCab + bodyL * 0.45); g.add(coneG);
  const waffle = new THREE.Mesh(new THREE.ConeGeometry(0.95, 2.6, 28, 1, true), new THREE.MeshStandardMaterial({ color: '#d39a52', roughness: 0.75 })); waffle.rotation.x = Math.PI; waffle.position.y = 1.3; coneG.add(waffle);
  const cream = new THREE.MeshPhysicalMaterial({ color: '#fbf6ec', roughness: 0.45, sheen: 1, sheenColor: new THREE.Color('#fff8ee'), clearcoat: 0.3 });
  [[2.75, 1.05], [3.35, 0.85], [3.85, 0.62], [4.25, 0.38]].forEach(([y, r]) => { const t = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.5, 16, 40), cream); t.rotation.x = Math.PI / 2; t.position.y = y; coneG.add(t); });
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 16), cream); tip.position.y = 4.65; coneG.add(tip);
  const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.3, 0.5), toneMapped: false, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
  const eye = new THREE.Mesh(new THREE.SphereGeometry(1.5, 20, 14), eyeMat); eye.position.y = 3.2; eye.scale.y = 1.6; coneG.add(eye);
  // the real truck (when it loaded) replaces the hand-built body; the rear menu art and the cone's glow stay
  const real = prop('icecream', L * REAL_ICE.scale); // the file's bounds run long: the truck itself is 1/1.31 of them
  let roofs = [{ z0: -L / 2 + 0.2, z1: zCab, top: 0.8 * K + cabH }, { z0: zCab, z1: L / 2 - 0.1, top: roofY }];
  if (real) {
    for (const o of g.children.splice(0)) if (o === back || o === coneG) g.add(o);
    for (const o of coneG.children.splice(0)) if (o === eye) coneG.add(o);
    g.add(real); back.scale.set(0.82, 0.82, 1); back.position.set(0, REAL_ICE.backY, L / 2 + REAL_ICE.backZ);
    coneG.position.set(0, REAL_ICE.coneY, REAL_ICE.coneZ); eye.position.y = 1.2; eye.scale.set(0.6, 1, 0.6);
    roofs = REAL_ICE.roofs;
  }
  // Uncle Joe himself, a bobblehead poking out of the roof hatch at the back, beside the cone
  const joe = head('biden', 3.6);
  if (joe) { joe.position.set(-1.25, (real ? REAL_ICE.roofs[0].top : roofY) + 1.5, 3.9); joe.rotation.z = 0.12; g.add(joe); }
  // the drone that joins in phase 2
  const drone = buildAF1Drone(); drone.position.set(0, roofY + 8, 0); drone.visible = false; g.add(drone);
  const size = new THREE.Vector3(W, roofY + 4.8, L);
  g.userData = { size, pivots: drone.userData.pivots, jets: [], eyeMat, eye, holo: coneG, cone: coneG, drone, droneY: roofY + 4.2, eyeCol: new THREE.Color(0.35, 0.1, 0.18), rear: L / 2, front: L / 2,
    roofs };
  return g;
}


// ---------- Jeff Baesongs' Late Shepherd (stage 8, the Moon) ----------
// a stubby suborbital rocket with a crew capsule on top, flying low over the regolith on its engine.
// A giant cowboy hat sits on the capsule. The big capsule window is the weak point.
function shepherdLivery() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 1024; const x = c.getContext('2d');
  x.fillStyle = '#f2f3f5'; x.fillRect(0, 0, 512, 1024);
  x.fillStyle = 'rgba(0,0,0,0.06)'; for (let y = 0; y < 1024; y += 128) x.fillRect(0, y, 512, 3);
  for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(120,110,100,${Math.random() * 0.05})`; x.fillRect(Math.random() * 512, Math.random() * 1024, 2 + Math.random() * 10, 1 + Math.random() * 3); }
  x.save(); x.translate(256, 560); x.rotate(-Math.PI / 2);
  x.font = '900 96px "Black Han Sans", "Noto Sans KR", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = '#1b2a6b'; x.fillText('LATE SHEPHERD', 0, -60);
  x.font = '900 56px "Black Han Sans", "Noto Sans KR", sans-serif'; x.fillStyle = '#2f62d8'; x.fillText('배송스 오리진 · 6년 늦게 출발', 0, 50);
  x.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function buildShepherd() {
  const g = new THREE.Group();
  const R = 2.3, H = 15;
  const white = new THREE.MeshPhysicalMaterial({ map: shepherdLivery(), roughness: 0.35, metalness: 0.1, clearcoat: 0.6 });
  const metal = new THREE.MeshStandardMaterial({ color: '#b9bec6', metalness: 1, roughness: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ color: '#25272c', metalness: 0.6, roughness: 0.5 });
  const blue = new THREE.MeshStandardMaterial({ color: '#2c55c8', metalness: 0.3, roughness: 0.4 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 48), white); body.position.y = H / 2 + 1.2; body.rotation.y = Math.PI / 2; g.add(body);
  // the ring fin near the top and four wedge fins at the base
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R + 0.9, 0.22, 8, 48), metal); ring.rotation.x = Math.PI / 2; ring.position.y = H - 0.6; g.add(ring);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, st = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 1.0), metal); st.position.set(Math.cos(a) * (R + 0.45), H - 0.6, Math.sin(a) * (R + 0.45)); st.rotation.y = -a; g.add(st); }
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2 + Math.PI / 4, fin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.6, 1.7), white);
    fin.geometry.translate(0, 0, 0.85); fin.position.set(Math.cos(a) * R, 2.6, Math.sin(a) * R); fin.rotation.y = -a + Math.PI / 2; g.add(fin);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 3.2, 8), metal); leg.position.set(Math.cos(a) * (R + 0.9), 0.5, Math.sin(a) * (R + 0.9)); leg.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35); g.add(leg);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.12, 12), dark); pad.position.set(Math.cos(a) * (R + 1.5), -1, Math.sin(a) * (R + 1.5)); g.add(pad);
  }
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.85, 1.2, 48, 1, true), dark); skirt.position.y = 0.6; g.add(skirt);
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.15, 1.4, 24, 1, true), new THREE.MeshStandardMaterial({ color: '#3a3532', metalness: 0.9, roughness: 0.35, side: THREE.DoubleSide })); bell.position.y = -0.4; g.add(bell);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(1.1, 7, 20, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.2, 3.2), transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  flame.rotation.x = Math.PI; flame.position.y = -4.4; flame.geometry.translate(0, 0, 0); g.add(flame);
  // crew capsule: blunt cone, dark windows, the big one facing the player is the eye
  const capY = H + 1.2;
  const cap = new THREE.Mesh(new THREE.LatheGeometry([[0.01, 3.4], [0.9, 3.25], [1.7, 2.6], [2.15, 1.3], [2.3, 0.2], [2.25, 0]].map(([r, y]) => new THREE.Vector2(r, y)), 48), white);
  cap.position.y = capY; g.add(cap);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(2.32, 2.32, 0.35, 48), blue); band.position.y = capY + 0.15; g.add(band);
  const glass = new THREE.MeshPhysicalMaterial({ color: '#05070c', roughness: 0.05, metalness: 0.3, clearcoat: 1, envMapIntensity: 1.6 });
  for (let i = 0; i < 6; i++) { if (i === 0) continue; const a = i / 6 * Math.PI * 2 + Math.PI / 2, w = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), glass); w.position.set(Math.cos(a) * 2.02, capY + 1.25, Math.sin(a) * 2.02); w.lookAt(Math.cos(a) * 9, capY + 2.2, Math.sin(a) * 9); g.add(w); }
  const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.75, 0.3), toneMapped: false });
  const win = new THREE.Mesh(new THREE.CircleGeometry(0.85, 32), eyeMat); win.position.set(0, capY + 1.3, 2.0); win.rotation.x = -0.32; g.add(win);
  const frame = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.08, 8, 32), metal); frame.position.copy(win.position); frame.rotation.x = -0.32; g.add(frame);
  // the passenger: a silhouette in the window
  const jeff = head('bezos', 3.4);
  if (jeff) { jeff.position.set(0, capY + 1.6, 0.7); g.add(jeff); win.visible = frame.visible = false; } // the passenger is all head, and the hat is his
  else { const sil = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), new THREE.MeshBasicMaterial({ color: '#2a1a12' })); sil.position.set(0, capY + 1.25, 1.75); g.add(sil); }
  const eye = new THREE.Object3D(); eye.position.set(0, capY + 1.3, 2.2); eye.name = 'eye'; g.add(eye);
  // the hat: a cowboy hat sized for a rocket
  const felt = new THREE.MeshStandardMaterial({ color: '#d8c39a', roughness: 0.9 });
  const brim = new THREE.Mesh(new THREE.LatheGeometry([[0.01, 0.02], [2.0, 0.0], [3.4, 0.12], [4.1, 0.55], [4.25, 0.75], [4.0, 0.62], [3.3, 0.22], [2.0, 0.12], [0.01, 0.14]].map(([r, y]) => new THREE.Vector2(r, y)), 48), felt);
  brim.scale.set(1, 1, 0.82); brim.position.y = capY + 2.9; brim.rotation.z = 0.08; g.add(brim);
  const crown = new THREE.Mesh(new THREE.LatheGeometry([[2.0, 0], [2.05, 1.2], [1.9, 2.2], [1.4, 2.6], [0.6, 2.35], [0.01, 2.5]].map(([r, y]) => new THREE.Vector2(r, y)), 40), felt);
  crown.scale.set(1, 1, 0.8); crown.position.y = capY + 3.0; crown.rotation.z = 0.08; g.add(crown);
  const hatBand = new THREE.Mesh(new THREE.CylinderGeometry(2.07, 2.07, 0.35, 40, 1, true), new THREE.MeshStandardMaterial({ color: '#3a2416', roughness: 0.7 })); hatBand.scale.set(1, 1, 0.8); hatBand.position.y = capY + 3.25; hatBand.rotation.z = 0.08; g.add(hatBand);
  g.traverse((o) => { if (o.isMesh && o !== flame) o.castShadow = true; });
  const size = new THREE.Vector3(R * 2 + 2, capY + 6, R * 2 + 2);
  g.userData = { size, pivots: [], jets: [flame], eyeMat, eye, shepherd: true, eyeCol: new THREE.Color(1, 0.72, 0.28) };
  return g;
}

// ---------- AGI Overlord (stage 9, Mars) ----------
// three tech bosses pooled their GPUs into one mecha: a torso of server racks and graphics cards, two
// arms, and three heads that fight over the controls: Alt-Man's orb, Lizard Zuck's headset and
// Amo-Day's safety shield. The head in control glows and is the weak point.
export function buildOverlord() {
  const g = new THREE.Group();
  const chrome = new THREE.MeshPhysicalMaterial({ color: '#c9ccd3', metalness: 1, roughness: 0.15, clearcoat: 1, envMapIntensity: 1.4 });
  const dark = new THREE.MeshStandardMaterial({ color: '#17181c', metalness: 0.8, roughness: 0.35 });
  const led = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 3, 1.4), toneMapped: false });
  const core = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.2, 0.5), toneMapped: false });
  const torso = new THREE.Mesh(new RoundedBoxGeometry(10, 7.5, 5.5, 4, 0.8), dark); torso.position.y = 7; g.add(torso);
  const chest = new THREE.Mesh(new RoundedBoxGeometry(7.6, 5.2, 0.6, 3, 0.25), chrome); chest.position.set(0, 7.4, 2.75); g.add(chest);
  // rack fronts with blinking LEDs across the chest
  for (let r = 0; r < 6; r++) for (const x of [-2.6, 2.6]) { const l = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.06, 0.04), led); l.position.set(x, 5.4 + r * 0.72, 3.08); g.add(l); }
  const reactor = new THREE.Mesh(new THREE.CircleGeometry(1.1, 32), core); reactor.position.set(0, 7.4, 3.07); g.add(reactor);
  const rr = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.12, 8, 40), chrome); rr.position.set(0, 7.4, 3.1); g.add(rr);
  // graphics-card armour plates on shoulders and belly
  const card = makeRTX5090();
  for (const [x, y, z, ry, rz, sc] of [[-5.6, 9.6, 0, 0, 0.5, 3], [5.6, 9.6, 0, 0, -0.5, 3], [-3.2, 3.1, 2.4, 0.2, 0, 2.2], [3.2, 3.1, 2.4, -0.2, 0, 2.2], [0, 2.6, 2.6, 0, 0, 2.2]]) {
    const c = card.clone(); c.scale.setScalar(sc); c.position.set(x, y, z); c.rotation.set(Math.PI / 2, ry, rz); g.add(c);
  }
  // arms: shoulder ball, upper arm, forearm, a fist of stacked GPUs; the pivots let sync swing them
  const arms = [];
  for (const sx of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(sx * 6.6, 9, 0); g.add(sh);
    sh.add(new THREE.Mesh(new THREE.SphereGeometry(1.4, 24, 16), chrome));
    const up = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.6, 4.4, 16), dark); up.position.y = -2.4; sh.add(up);
    const el = new THREE.Group(); el.position.y = -4.6; sh.add(el);
    el.add(new THREE.Mesh(new THREE.SphereGeometry(0.85, 16, 12), chrome));
    const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.85, 4, 16), chrome); fore.rotation.x = Math.PI / 2; fore.position.z = 2; el.add(fore);
    const fist = new THREE.Mesh(new RoundedBoxGeometry(2.2, 2.2, 2.2, 3, 0.4), dark); fist.position.z = 4.4; el.add(fist);
    for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.08, 0.05), led); l.position.set(0, -0.6 + i * 0.6, 5.52); el.add(l); }
    el.rotation.x = -0.5; arms.push({ sh, el, sx });
  }
  // hover jets under the hips
  const jets = [];
  for (const x of [-3, 0, 3]) {
    const n = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1, 1.2, 16, 1, true), dark); n.position.set(x, 2.6, 0); g.add(n);
    const j = new THREE.Mesh(new THREE.ConeGeometry(0.9, 5, 16, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.8, 4), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    j.rotation.x = Math.PI; j.position.set(x, -0.4, 0); g.add(j); jets.push(j);
  }
  // the three heads on a neck bar
  const neck = new THREE.Mesh(new THREE.BoxGeometry(9, 0.8, 2), chrome); neck.position.y = 11.1; g.add(neck);
  const heads = [];
  // 0: Alt-Man's orb
  {
    const h = new THREE.Group(); h.position.set(-3.6, 13.3, 0); g.add(h);
    h.add(new THREE.Mesh(new THREE.SphereGeometry(1.9, 40, 24), chrome));
    const face = new THREE.Mesh(new THREE.SphereGeometry(1.91, 32, 16, 0, Math.PI * 2, 0, 0.7), new THREE.MeshPhysicalMaterial({ color: '#06070a', roughness: 0.04, clearcoat: 1 })); face.rotation.x = Math.PI / 2; h.add(face);
    const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 0.7, 4), toneMapped: false });
    const iris = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.75, 40), eyeMat); iris.position.z = 1.93; h.add(iris);
    const eye = new THREE.Object3D(); eye.position.z = 2; h.add(eye);
    heads.push({ h, eye, eyeMat, col: new THREE.Color(0.35, 0.17, 1), name: '올트-맨', label: '조종권: 올트-맨 · 청구서 폭격' });
  }
  // 1: Lizard Zuck's headset (a reptile eye on the display)
  {
    const h = new THREE.Group(); h.position.set(0, 13.6, 0.3); g.add(h);
    const body = new THREE.Mesh(new RoundedBoxGeometry(4.2, 2.3, 2.6, 4, 0.6), new THREE.MeshPhysicalMaterial({ color: '#f4f4f6', roughness: 0.3, clearcoat: 0.8 })); h.add(body);
    const strap = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.22, 8, 32, Math.PI), dark); strap.rotation.set(0, Math.PI / 2, Math.PI / 2); strap.position.z = -0.6; h.add(strap);
    const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.6, 0.6), toneMapped: false });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.7), eyeMat); screen.position.z = 1.31; h.add(screen);
    const slit = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 1.4), new THREE.MeshBasicMaterial({ color: '#050805' })); slit.position.z = 1.32; h.add(slit);
    const eye = new THREE.Object3D(); eye.position.z = 1.5; h.add(eye);
    heads.push({ h, eye, eyeMat, col: new THREE.Color(0.25, 1, 0.3), name: '리자드 저크', label: '조종권: 리자드 저크 · 선크림 살포' });
  }
  // 2: Amo-Day's safety shield head
  {
    const h = new THREE.Group(); h.position.set(3.6, 13.3, 0); g.add(h);
    const shape = new THREE.Shape(); shape.moveTo(0, 2); shape.quadraticCurveTo(1.8, 2, 1.9, 1.1); shape.lineTo(1.7, -0.6); shape.quadraticCurveTo(1.0, -1.8, 0, -2.3); shape.quadraticCurveTo(-1.0, -1.8, -1.7, -0.6); shape.lineTo(-1.9, 1.1); shape.quadraticCurveTo(-1.8, 2, 0, 2);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 1.6, bevelEnabled: true, bevelSize: 0.15, bevelThickness: 0.2, bevelSegments: 3 }); geo.translate(0, 0, -0.8);
    h.add(new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: '#d9a070', roughness: 0.4, clearcoat: 0.6 })));
    const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2.2, 0.6), toneMapped: false });
    const iris = new THREE.Mesh(new THREE.CircleGeometry(0.7, 32), eyeMat); iris.position.set(0, 0.3, 1.02); h.add(iris);
    const cross = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.09, 8, 32), dark); cross.position.set(0, 0.3, 1.0); h.add(cross);
    const eye = new THREE.Object3D(); eye.position.set(0, 0.3, 1.2); h.add(eye);
    heads.push({ h, eye, eyeMat, col: new THREE.Color(1, 0.55, 0.15), name: '아모-데이', label: '조종권: 아모-데이 · 안전 가드레일' });
  }
  g.traverse((o) => { if (o.isMesh && !jets.includes(o)) o.castShadow = true; });
  const size = new THREE.Vector3(14, 16, 6);
  g.userData = { size, pivots: [], jets, heads, arms, eye: heads[0].eye, eyeMat: heads[0].eyeMat, eyeCol: heads[0].col, overlord: true };
  return g;
}

// delivery drone: four rotors and a parcel hanging under it
function parcelTex(label = '당일배송') {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#b88a58'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 600; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '60,35,10' : '255,240,210'},${0.05 + Math.random() * 0.05})`; x.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  x.fillStyle = 'rgba(80,130,220,0.85)'; x.fillRect(0, 110, 256, 36);
  x.fillStyle = '#fff'; x.font = '900 30px "Black Han Sans", "Noto Sans KR", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(label, 128, 129);
  x.fillStyle = '#2a1a0a'; x.font = '700 18px sans-serif'; x.fillText('(지구 기준 3일)', 128, 190);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
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
    face: 'zuck', name: '리자드 저크의 메가 헤드셋', sub: '메가 퀘스트 프로 · 다리는 다음 업데이트에', hp: 110, appearAt: 760, giveUpAt: 3100, hover: 6.5, lizard: true,
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
  icecream: {
    face: 'biden', name: '아이스크림 조의 트럭', sub: '+ 버락 오바바의 에어포스 원 드론', hp: 130, appearAt: 950, giveUpAt: 3020, ground: true, truck: true,
    xp: 480, doge: 260, need: [],
    bump: '아이스크림 트럭에 부딪힘', stompText: '트럭 지붕을 밟았다', dropHit: '규제 서류 폭탄!',
    lines: {
      intro: '아이스크림 조의 트럭이다! 지붕 위 소프트콘이 약점이야. 서류 폭탄 떨어지는 차선은 피해!',
      coil: '코일 충전 완료! F(⚡)로 콘을 쏴. 자동 조준이야.',
      jump: '경사로에서 날아서 트럭 지붕에 착지하면 스톰프야!',
      doze: '어… 운전하다 졸았어! 지금 지붕에 올라타!',
      half: '하늘에서 에어포스 원 드론 합류! 연비 레이저랑 메가폰 충격파 조심. 충격파는 점프로 넘어!',
      win: '트럭이 녹아버렸어. 아이스크림이니까.',
      flee: '국회의사당 쪽으로 도망갔어… 다음엔 꼭 잡자.',
    },
  },
  bezos: {
    face: 'bezos', name: '제프 배송스의 레이트 셰퍼드', sub: '배송스 오리진 · 항상 한 발 늦게 도착', hp: 170, appearAt: 700, giveUpAt: 3150, hover: 3, gap: 56, landGap: 34, shepherd: true, landing: true,
    xp: 600, doge: 320, need: [],
    dropHit: '당일배송 폭탄!', beamText: ['프라임 레이저!', '반품 불가 · 급감속', '#7ab8ff'],
    lines: {
      intro: '제프 배송스다! 우리보다 먼저 달에 왔다고 우기는 중. 랩터 캐논 F 꾹 눌러서 창문을 쏴!',
      coil: '캐논은 꾹 누르면 연사돼. 너무 오래 쏘면 과열되니까 끊어서 쏴!',
      jump: '착륙 연습할 땐 로켓이 바닥까지 내려와. 그때 창문에 쏟아부어!',
      land: '착륙 연습한대! 지금이야, 집중 사격!',
      half: '화났다! 배송 드론 떼거리랑 프라임 레이저까지. 드론부터 떨궈!',
      win: '레이트 셰퍼드 추락! 모자는 무사하대.',
      flee: '물류센터로 도망갔어… 다음엔 꼭 잡자.',
    },
  },
  agi: {
    name: 'AGI 오버로드', sub: '올트-맨 × 리자드 저크 × 아모-데이 · GPU 100만 장 합체', hp: 300, appearAt: 650, giveUpAt: 3330, hover: 2.5, gap: 36, overlord: true,
    xp: 1000, doge: 600, need: [],
    dropHit: '서버랙 투하!', beamText: ['안전 가드레일 레이저!', '속도 제한 시속 30km · 급감속', '#ffb347'],
    lines: {
      intro: 'AGI 오버로드다! 셋이 GPU를 합쳐서 만든 메카야. 지금 빛나는 머리가 조종 중이니까 그걸 쏴!',
      coil: '캐논이 조종 중인 머리를 알아서 노려. 과열만 조심!',
      jump: '셋이 주도권 싸움을 시작하면 공격이 멈춰. 그때 쏟아부어!',
      feud: ['"내가 CEO야!" "아니 안전이 먼저야!" "메타버스로 가자!" 싸운다, 지금이야!', '셋이 서로 조종간을 뺏고 있어! 집중 사격!', '"이사회 소집!" "헌법부터 읽어!" "다리는 다음 업데이트!" 내분 발생!'],
      half: '절반! 셋이 동시에 조종하려고 해서 공격이 더 꼬인다!',
      win: 'AGI 오버로드 다운! 결국 셋이 합의를 못 했네. 화성은 우리 거다!',
      flee: '모래폭풍 속으로 사라졌어…',
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
  const truck = !!def.truck;
  const shepherd = !!def.shepherd, overlord = !!def.overlord;
  const mesh = overlord ? buildOverlord() : shepherd ? buildShepherd() : truck ? buildIceTruck() : def.ground ? buildCloneTrailer(protos) : orb ? buildOrb() : lizard ? buildHeadset() : buildWaymoMothership(protos.waymo);
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
  // stacks of regulations tied in red tape (the truck lobs them into lanes)
  const paperMat = new THREE.MeshStandardMaterial({ color: '#f3f0e6', roughness: 0.85 });
  const tapeMat = new THREE.MeshStandardMaterial({ color: '#c81e2a', roughness: 0.5, emissive: '#5a0008', emissiveIntensity: 0.4 });
  function makePaper() {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.42, 1.4), paperMat); p.position.y = 0.21 + i * 0.43; p.rotation.y = (Math.random() - 0.5) * 0.3; p.castShadow = true; g.add(p); }
    for (const r of [0, Math.PI / 2]) { const tp = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.34, 0.16), tapeMat); tp.position.y = 0.66; tp.rotation.y = r; tp.scale.x = r ? 0.74 : 1; g.add(tp); }
    return g;
  }
  // the megaphone shockwave: a ring of sound across the whole road; jump over it
  const waveTex = (() => { const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d'); const gr = x.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(120,200,255,0)'); gr.addColorStop(0.5, 'rgba(160,220,255,0.9)'); gr.addColorStop(1, 'rgba(120,200,255,0.2)'); x.fillStyle = gr; x.fillRect(0, 0, 512, 128); x.font = '900 64px "Black Han Sans", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = 'rgba(255,255,255,0.95)'; x.fillText('YES WE CAN', 256, 70); const tt = new THREE.CanvasTexture(c); tt.colorSpace = THREE.SRGBColorSpace; return tt; })();
  const waveMat = new THREE.MeshBasicMaterial({ map: waveTex, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  waveMat.color.setScalar(1.6);
  function makeWave() {
    const g = new THREE.Group();
    const p = new THREE.Mesh(new THREE.PlaneGeometry(ctx.ROAD_HALF * 2, 1.5), waveMat); p.position.y = 0.75; g.add(p);
    const r = new THREE.Mesh(new THREE.BoxGeometry(ctx.ROAD_HALF * 2, 0.06, 0.4), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 2.2, 3.4), toneMapped: false })); r.position.y = 0.05; g.add(r);
    return g;
  }
  // Late Shepherd ammunition: same-day boxes and delivery drones
  const boxMat = new THREE.MeshStandardMaterial({ map: parcelTex(), roughness: 0.9 });
  function makeBox() { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 1.6), boxMat); b.position.y = 0.6; b.castShadow = true; g.add(b); return g; }
  const droneMat = new THREE.MeshStandardMaterial({ color: '#e8eaee', metalness: 0.4, roughness: 0.35 });
  const rotorMat = new THREE.MeshBasicMaterial({ color: '#aab', transparent: true, opacity: 0.35, depthWrite: false });
  const ledMat2 = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 1.4, 4), toneMapped: false });
  function makeDrone() {
    const g = new THREE.Group();
    const hub = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.9), droneMat); g.add(hub);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 1.2), droneMat); arm.position.set(x * 0.45, 0, z * 0.45); arm.rotation.y = Math.atan2(x, z); g.add(arm);
      const rot = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), rotorMat); rot.rotation.x = -Math.PI / 2; rot.position.set(x * 0.85, 0.12, z * 0.85); g.add(rot);
    }
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), ledMat2); led.position.set(0, -0.05, 0.47); g.add(led);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), boxMat); box.position.y = -0.6; g.add(box);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
  }
  const makeDrop = overlord ? makeRack : shepherd ? makeBox : truck ? makePaper : ground ? makeTag : orb ? makeRack : makeCone;
  const home = { eye: mesh.userData.eye, eyeMat: mesh.userData.eyeMat, eyeCol: mesh.userData.eyeCol };

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
    const face = def.face && ctx.faces?.[def.face];
    ctx.$('bossName').innerHTML = `${face ? `<img class="face" src="${face}" alt="">` : ''}${def.name}<small>${def.sub}</small>`;
    if (ground) { B.s = ctx.P.s + rearOff + 120; B.y = 0; B.d = ctx.LANES[(NL / 2) | 0]; }
    if (truck) { Object.assign(mesh.userData, home); mesh.userData.drone.visible = false; B.dozeT = 7; }
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
  function damage(n, why, quiet = false) {
    if (!B.active || B.defeated) return;
    if (B.fired || B.doze || B.land || B.feud) n = quiet ? n * 1.5 : Math.round(n * 1.5);
    B.hp -= n; B.hurtT = quiet ? 0.12 : 0.35; hud();
    mesh.userData.eye.getWorldPosition(tmp);
    if (quiet) { // rapid fire: one spark per hit, a number now and then
      ctx.puff(tmp, new THREE.Vector3((Math.random() - 0.5) * 8, Math.random() * 5, (Math.random() - 0.5) * 8), '#ffd27a', 0.9, 0.35);
      B.quietSum = (B.quietSum || 0) + n; if ((B.quietT = (B.quietT || 0) - 1) <= 0) { B.quietT = 6; ctx.floatText(`${why} -${Math.round(B.quietSum)}`); B.quietSum = 0; }
    } else {
    ctx.floatText(`${why} -${n}`);
    ctx.blip(900, 200, 0.25, 'square', 0.16);
    }
    if (!quiet) for (let i = 0; i < 14; i++) ctx.puff(tmp, new THREE.Vector3((Math.random() - 0.5) * 18, Math.random() * 8, (Math.random() - 0.5) * 18), i % 2 ? '#ffb347' : '#ffe9a0', 1.4, 0.6);
    if (B.phase === 1 && B.hp <= def.hp / 2) {
      if (orb) {
        if (!B.fired && !B.wasFired) {
          B.wasFired = true; B.fired = { t: 5 }; B.telegraph = null; B.beam = null;
          mesh.userData.holoMap ??= mesh.userData.holoMat.map; mesh.userData.holoMat.map = mesh.userData.firedTex; mesh.userData.holoMat.needsUpdate = true;
          ctx.toast('이사회: 해임!', '5초 동안 무방비 · 데미지 1.5배', '#ff4a6a'); ctx.radio(def.lines.fired);
        }
      } else {
        B.phase = 2; ctx.radio(def.lines.half);
        if (truck) { const dr = mesh.userData.drone; dr.visible = true; B.dock = 0; B.doze = null; mesh.userData.eye = dr.userData.eye; mesh.userData.eyeMat = dr.userData.eyeMat; mesh.userData.eyeCol = new THREE.Color(1, 0.12, 0.12); ctx.toast('에어포스 원 드론 합류!', '연비 레이저 · 메가폰 충격파', '#7ab8ff'); }
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
    if (overlord) {
      const hd = B.head ?? 0;
      if (hd === 0) { // invoices, sometimes behind a hype wall
        const lanes = new Set([nearLane, (Math.random() * NL) | 0]);
        if (Math.random() < 0.35) { const m = makeHoloWall(); ctx.scene.add(m); B.cones.push({ kind: 'wall', s: B.s - 20, d: 0, y: 0, vy: 0, vs: Math.max(10, P.v * 0.35), m, hit: false, landed: true }); ctx.floatText('과대광고 홀로그램!'); }
        spawnInvoices([...lanes], B.s - 16); ctx.floatText('구독료 청구서 발송!'); ctx.blip(700, 300, 0.3, 'square', 0.12);
        B.atkT = B.phase === 2 ? 2.2 : 3.0; return;
      }
      if (hd === 1) { // sunscreen across two lanes, and server racks in phase 2
        for (const i of new Set([nearLane, (Math.random() * NL) | 0])) {
          const q = { s: B.s - 30, d: ctx.LANES[i], l: 5, w: 2.4, text: ['선크림!', 'SPF 100에 미끄러짐', '#ffffff'] };
          const m = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 10), sunMat); m.rotation.x = -Math.PI / 2; ctx.scene.add(m);
          B.cones.push({ kind: 'puddle', s: q.s, d: q.d, y: 0.04, vs: 0, m, q, hit: false, landed: true }); ctx.addPuddle(q);
        }
        ctx.floatText('선크림 분사!');
        if (B.phase === 2) ctx.LANES.forEach((l, i) => { if (i === nearLane || Math.random() < 0.5) return; const m = makeDrop(); ctx.scene.add(m); B.cones.push({ s: B.s - 26, d: l, y: 9, vy: 0, m, hit: false, landed: false }); });
        B.atkT = B.phase === 2 ? 2.4 : 3.0; return;
      }
      // hd 2: guardrail laser across the player's lane and a neighbour (falls through to the telegraph below)
    }
    if (shepherd && Math.random() < (B.phase === 2 ? 0.45 : 0.3)) {
      const n = B.phase === 2 ? 4 : 3;
      for (let i = 0; i < n; i++) { const m = makeDrone(); ctx.scene.add(m); B.cones.push({ kind: 'drone', s: B.s - 4 - i * 7, d: ctx.LANES[(Math.random() * NL) | 0], y: 10 + i, vs: Math.max(10, P.v * 0.84), m, hit: false, landed: true, hp: 3, spin: Math.random() * 6 }); }
      ctx.floatText('배송 드론 출동!'); ctx.blip(700, 1100, 0.3, 'triangle', 0.12);
      B.atkT = 3.2;
      return;
    }
    if (truck && B.phase === 2 && Math.random() < 0.4) {
      const m = makeWave(); ctx.scene.add(m);
      B.cones.push({ kind: 'wave', s: B.s - rearOff - 2, d: 0, y: 0, vy: 0, vs: Math.max(8, P.v - 16), m, hit: false, landed: true });
      ctx.floatText('예스 위 캔!'); ctx.blip(140, 420, 0.6, 'sawtooth', 0.16);
      B.atkT = 2.8;
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
      B.gap = B.doze ? rearOff + 8 : rearOff + 17 + Math.sin(t * 0.6) * 4;
      // the driver nods off now and then: no attacks, slows down, takes extra damage
      if (truck && B.phase === 1) {
        if (B.doze) { B.doze.t -= dt; if (Math.random() < dt * 3) ctx.floatText('Zzz…'); if (B.doze.t <= 0) { B.doze = null; B.dozeT = 10 + Math.random() * 4; ctx.floatText('번쩍!'); } }
        else if ((B.dozeT = (B.dozeT ?? 7) - dt) <= 0 && !B.telegraph) { B.doze = { t: 3.4 }; ctx.toast('졸음 운전!', '3.4초 무방비 · 데미지 1.5배', '#7ab8ff'); ctx.radio(def.lines.doze); }
      }
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
        if (P.y < top - 0.6 && P.s < rear + 1) { P.s = rear - 2.3; P.v = Math.min(P.v, (B.v || P.v) * 0.6); P.crashT = 0.6; P.shake = 0.7; if (B.bumpT <= 0 || B.bumpT == null) { ctx.toast('쾅!', def.bump || '트레일러에 부딪힘', '#ff3d6e'); ctx.blip(160, 40, 0.3, 'sawtooth', 0.18); } B.bumpT = 0.6; }
      }
      B.bumpT = (B.bumpT || 0) - dt;
    } else {
      // the Overlord's heads take turns at the controls, and now and then fight over them
      if (overlord) {
        const ud = mesh.userData;
        if (B.feud) { B.feud.t -= dt; if (Math.random() < dt * 2) ctx.floatText(['내 차례야!', '안전 먼저!', '메타버스!', '이사회 소집!'][(Math.random() * 4) | 0]); if (B.feud.t <= 0) { B.feud = null; B.feudT = 11 + Math.random() * 4; ctx.floatText('합의 실패…'); } }
        else if ((B.feudT = (B.feudT ?? 9) - dt) <= 0 && !B.telegraph && !B.beam) { B.feud = { t: 4 }; ctx.toast('주도권 싸움!', '4초 무방비 · 데미지 1.5배', '#ffc83d'); ctx.radio(def.lines.feud[(Math.random() * def.lines.feud.length) | 0]); }
        if ((B.headT = (B.headT ?? 6) - dt) <= 0 && !B.telegraph && !B.beam && !B.feud) {
          B.headT = B.phase === 2 ? 4.5 : 6.5; B.head = ((B.head ?? 0) + 1 + (Math.random() < 0.3 ? 1 : 0)) % 3;
          const hd = ud.heads[B.head]; ud.eye = hd.eye; ud.eyeMat = hd.eyeMat; ud.eyeCol = hd.col;
          for (const o of ud.heads) if (o !== hd) o.eyeMat.color.copy(o.col).multiplyScalar(0.35);
          ctx.floatText(hd.label);
        }
      }
      // landing practice (Late Shepherd, phase 2): it sets down on the road ahead for a few seconds
      if (def.landing && B.phase === 2) {
        if (B.land) { B.land.t -= dt; if (B.land.t <= 0) { B.land = null; B.landT = 9 + Math.random() * 4; ctx.floatText('재발사!'); } }
        else if ((B.landT = (B.landT ?? 4) - dt) <= 0 && !B.telegraph && !B.beam) { B.land = { t: 3.5 }; ctx.toast('착륙 연습 중!', '3.5초 무방비 · 데미지 1.5배', '#ffc83d'); ctx.radio(def.lines.land); }
      }
      // hover ahead, matching speed, weaving slowly
      B.gap = (B.land ? def.landGap ?? 32 : def.gap ?? 23) + Math.sin(t * 0.7) * 4;
      B.s += P.v * dt + (P.s + B.gap - B.s) * Math.min(1, dt * 1.5);
      const targetD = B.telegraph ? B.d : Math.sin(t * 0.45) * 5;
      B.d += (targetD - B.d) * Math.min(1, dt * 1.5);
      const hoverY = B.land ? 1.3 : def.hover + Math.sin(t * 2.1) * 0.35;
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
        } else if (truck && B.phase === 1) {
          // regulation bombs lobbed over the back into the marked lanes
          for (const i of B.telegraph.lanes) for (let k = 0; k < 2; k++) { const m = makeDrop(); ctx.scene.add(m); B.cones.push({ s: B.s - rearOff - 3 - k * 7, d: ctx.LANES[i], y: 4.5, vy: 3, m, hit: false, landed: false }); }
          ctx.floatText('규제 서류 폭탄!'); ctx.blip(500, 150, 0.35, 'square', 0.14);
          B.telegraph = null; B.atkT = 3.0;
        } else if (truck) {
          B.beam = { lanes: B.telegraph.lanes, t: 0.5, hit: false }; B.telegraph = null; ctx.blip(1200, 80, 0.45, 'sawtooth', 0.16);
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
        if (lizard) ctx.toast('혀 날름!', '렙틸리언 혀에 붙잡힘', '#7dff5a'); else if (truck) ctx.toast('연비 규제 레이저!', '리터당 50km 미달 · 급감속', '#7ab8ff'); else if (def.beamText) ctx.toast(...def.beamText); else ctx.toast('장애물 감지!', '라이다에 걸려 급정거', '#ff3d6e');
        ctx.blip(200, 60, 0.4, 'square', 0.2);
      }
      if (B.beam.t <= 0) B.beam = null;
    } else if (!B.fired && !B.doze && !B.land && !B.feud) {
      B.atkT -= dt;
      if (B.atkT <= 0) startAttack();
    }

    // cones fall and sit on the road
    for (const c of B.cones) {
      if (c.kind) {
        c.s += c.vs * dt;
        const near = Math.abs(c.s - P.s) < 1.8;
        if (c.kind === 'puddle') continue;
        if (c.kind === 'drone') {
          if (c.dead) { c.y -= 14 * dt; continue; }
          // sink to the car's height and slide into its lane
          c.d += THREE.MathUtils.clamp(P.d - c.d, -3.5 * dt, 3.5 * dt); c.y += (1.8 - c.y) * Math.min(1, dt * 0.9);
          if (Math.abs(c.s - P.s) < 2 && Math.abs(c.d - P.d) < 2 && Math.abs(P.y + 0.7 - c.y) < 1.8) {
            c.dead = true; P.v *= 0.72; P.crashT = 0.4; P.shake = 0.5;
            ctx.toast('배송 완료!', '드론이 택배를 던짐 · 감속', '#ffc83d'); ctx.blip(500, 120, 0.3, 'square', 0.14);
          }
          continue;
        }
        if (c.kind === 'wave') { if (!c.hit && Math.abs(c.s - P.s) < 1.6) { c.hit = true; if (P.y - ctx.carGround(P.s, P.d) < 1.0) { P.v *= 0.6; P.crashT = 0.5; P.shake = 0.6; ctx.toast('예스 위 캔!', '메가폰 충격파에 맞음 · 점프로 넘어요', '#7ab8ff'); ctx.blip(120, 40, 0.4, 'sawtooth', 0.18); } else { ctx.gainXP(5); ctx.floatText('충격파 회피 +5 EXP'); } } continue; }
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
        if (P.y - ctx.carGround(P.s, P.d) < 0.9) { c.hit = true; P.v *= 0.72; P.shake = 0.4; ctx.floatText(def.dropHit || (ground ? '가격 파괴!' : '콘 충돌!')); ctx.blip(300, 100, 0.2, 'square', 0.12); c.flyV = new THREE.Vector3((Math.random() - 0.5) * 8, 9, -8); }
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
        ctx.toast('스톰프!', def.stompText || '트레일러를 밟았다', '#ffc83d');
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
    if (mesh.userData.roofs) { for (const r of mesh.userData.roofs) if (z > r.z0 && z < r.z1) top = r.top; }
    else if (z > -frontOff && z < -2) top = 3.35;            // bus roof
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
    if (overlord) {
      const ud = mesh.userData;
      for (const hd of ud.heads) { if (hd.eyeMat !== eye) hd.eyeMat.color.copy(hd.col).multiplyScalar(B.feud ? 2 + Math.sin(time * 20 + hd.h.position.x) * 1.5 : 0.35); hd.h.rotation.set(B.feud ? Math.sin(time * 9 + hd.h.position.x) * 0.25 : 0, B.feud ? Math.sin(time * 7 + hd.h.position.x * 2) * 0.5 : 0, 0); }
      for (const a of ud.arms) { a.sh.rotation.x = -0.35 + Math.sin(time * 1.3 + a.sx) * 0.3 - (B.telegraph ? 0.5 : 0); a.sh.rotation.z = a.sx * (0.2 + (B.feud ? Math.sin(time * 8) * 0.4 : 0)); a.el.rotation.x = -0.6 + Math.sin(time * 1.7 + a.sx) * 0.25; }
    }
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
      if (truck) mesh.userData.drone.userData.horn.getWorldPosition(tmp); else if (shepherd || overlord) mesh.userData.eye.getWorldPosition(tmp); else ctx.world(B.s, B.d + (ctx.LANES[i] - B.d) * 0.3, B.y, tmp);
      ctx.world(sEnd, ctx.LANES[i], 0.2, tmp2);
      bm.position.copy(tmp).add(tmp2).multiplyScalar(0.5);
      const len = tmp.distanceTo(tmp2);
      bm.scale.set(1, len, 1);
      const dir = tmp2.clone().sub(tmp).normalize();
      bm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      bm.scale.x = 1.4; bm.material.opacity = 0.5 * B.beam.t / 0.5;
    });
    if (truck && mesh.userData.drone.visible) {
      const dr = mesh.userData.drone; B.dock = Math.min(1, (B.dock ?? 1) + 1 / 120);
      const e = 1 - (1 - B.dock) ** 3;
      dr.position.y = mesh.userData.droneY + 2 + (1 - e) * 40 + Math.sin(time * 1.6) * 0.35; dr.position.z = (1 - e) * -30;
      dr.rotation.set(0.04 + (B.beam ? 0.12 : 0), 0, Math.sin(time * 1.1) * 0.06);
      for (const p of mesh.userData.pivots) p.rotation.y = time * 14;
    }
    if (lizard) {
      const tg = mesh.userData.tongue; tg.visible = !!B.beam;
      if (B.beam) { const k = 1 - B.beam.t / 0.5; tg.scale.set(1, 6 + 22 * Math.sin(Math.min(1, k * 1.6) * Math.PI), 1); tg.rotation.set(Math.PI / 2 + 0.35, 0, 0); tg.position.set(0, -1.4, 2.2); }
      if (B.glitchT > 0) { B.glitchT -= 1 / 60; mesh.userData.screen.position.x = (Math.random() - 0.5) * 0.6; mesh.userData.screen.scale.y = 0.6 + Math.random() * 0.6; } else { mesh.userData.screen.position.x = 0; mesh.userData.screen.scale.y = 1; }
    }
    for (const c of B.cones) {
      c.m.visible = true; ctx.world(c.s, c.d, c.y + (c.kind === 'invoice' ? Math.sin(time * 6 + c.spin) * 0.25 : 0), c.m.position);
      if (c.kind === 'wave') { c.m.rotation.set(0, ctx.frame(c.s).yaw, 0); c.m.scale.y = 1 + Math.sin(time * 20) * 0.15; continue; }
      if (c.kind === 'puddle') { c.m.rotation.set(-Math.PI / 2, 0, ctx.frame(c.s).yaw); continue; }
      if (c.kind === 'drone') { c.m.rotation.set(c.dead ? time * 6 : 0.25, ctx.frame(c.s).yaw + Math.sin(time * 2 + c.spin) * 0.3, c.dead ? time * 4 : Math.sin(time * 3 + c.spin) * 0.12); continue; }
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
    if (overlord) { const ud = mesh.userData, hd = ud.heads[0]; ud.eye = hd.eye; ud.eyeMat = hd.eyeMat; ud.eyeCol = hd.col; }
    for (const c of B.cones) { ctx.scene.remove(c.m); if (c.q) ctx.removePuddle(c.q); }
    Object.assign(B, { hp: def.hp, active: false, done: false, defeated: false, fleeing: false, land: null, landT: 4, feud: null, feudT: 9, head: 0, headT: 6, telegraph: null, beam: null, phase: 1, atkT: 4, cones: [], coilHint: false, jumpHintAt: null, fired: null, wasFired: false });
    if (mesh.userData.holoMap) { mesh.userData.holoMat.map = mesh.userData.holoMap; mesh.userData.holoMat.needsUpdate = true; }
    if (mesh.userData.happy) { mesh.userData.eyeMat.map = mesh.userData.happy; mesh.userData.eyeMat.needsUpdate = true; }
    if (truck) { Object.assign(mesh.userData, home); mesh.userData.drone.visible = false; B.doze = null; B.dozeT = 7; }
    mesh.visible = false; mesh.rotation.set(0, 0, 0);
    end(); B.done = false;
  }

  // movie-poster pose for the loading screen: looming over the street, eye blazing
  function posterPose(sPos, d, y, time, yawOff = 0) {
    mesh.visible = true;
    if (truck) {
      ctx.world(sPos, d, y, mesh.position); mesh.rotation.set(0, ctx.frame(sPos).yaw + 0.12 + yawOff, 0);
      const dr = mesh.userData.drone; dr.visible = true; dr.position.y = mesh.userData.droneY + 2.2 + Math.sin(time * 1.4) * 0.3; dr.rotation.set(0.06, 0, Math.sin(time * 0.9) * 0.05);
      for (const p of mesh.userData.pivots) p.rotation.y = time * 14;
      home.eyeMat.color.setScalar(1.2 + Math.sin(time * 3) * 0.3); return;
    }
    if (ground) { ctx.world(sPos, d, y, mesh.position); mesh.rotation.set(0, ctx.frame(sPos).yaw + 0.12, 0); mesh.userData.eyeMat.color.setRGB(6 + Math.sin(time * 4) * 2, 0.25, 0.2); return; }
    ctx.world(sPos, d, y + Math.sin(time * 1.1) * 0.3, mesh.position);
    mesh.rotation.set(0.08, ctx.frame(sPos).yaw + 0.35, 0.05);
    for (const p of mesh.userData.pivots) p.rotation.y = time * 6;
    if (overlord) { mesh.rotation.set(0.04, ctx.frame(sPos).yaw + yawOff, 0); for (const hd of mesh.userData.heads) hd.eyeMat.color.copy(hd.col).multiplyScalar(4 + Math.sin(time * 4) * 1.5); for (const a of mesh.userData.arms) { a.sh.rotation.x = -0.6; a.sh.rotation.z = a.sx * 0.35; a.el.rotation.x = -1.0; } }
    else if (shepherd) { mesh.rotation.set(0.05, ctx.frame(sPos).yaw + yawOff, 0.04); mesh.userData.eyeMat.color.setRGB(3.2, 2.2, 0.8); for (const j of mesh.userData.jets) j.scale.y = 0.9 + Math.sin(time * 30) * 0.1; }
    else if (mesh.userData.screen) { mesh.rotation.set(0.1, ctx.frame(sPos).yaw + 0.25 + yawOff, 0); mesh.userData.eyeMat.color.setScalar(1.0); mesh.userData.eyeMat.map = mesh.userData.happy; }
    else if (mesh.userData.eyeCol) { mesh.userData.eyeMat.color.copy(mesh.userData.eyeCol).multiplyScalar(6 + Math.sin(time * 4) * 2); mesh.rotation.set(0.12, ctx.frame(sPos).yaw + 0.2, 0); mesh.userData.ring.rotation.y = time * 0.5; mesh.userData.holo.lookAt(ctx.camera.position); }
    else mesh.userData.eyeMat.color.setRGB(6 + Math.sin(time * 4) * 2, 0.2, 0.25);
  }

  // things the space-stage cannon can shoot besides the weak point
  function targets() {
    return B.cones.filter((c) => c.kind === 'drone' && !c.dead).map((c) => ({ pos: c.m.position, r: 1.2, hit: (n) => {
      c.hp -= n; if (c.hp > 0 || c.dead) return;
      c.dead = true; ctx.addDoge(3); ctx.gainXP(4); ctx.floatText('드론 격추 +Ð3'); ctx.blip(300, 90, 0.25, 'square', 0.12);
      for (let i = 0; i < 12; i++) ctx.puff(c.m.position, new THREE.Vector3((Math.random() - 0.5) * 10, Math.random() * 6, (Math.random() - 0.5) * 10), i % 2 ? '#ffb347' : '#ddd', 1.1, 0.5);
    } }));
  }
  return { B, update, sync, reset, fireCoil, posterPose, roofAt, damage, targets };
}
