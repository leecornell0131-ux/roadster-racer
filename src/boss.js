// Stage bosses. A boss hovers above the road ahead of the player and attacks lanes with a
// telegraph first; the player answers with the auto-aimed Tesla coil (charged by pickups)
// or a jump attack from below. Everything game-side comes in through ctx so bosses stay data.
import * as THREE from 'three';
import { instance, addSensorKit } from './realcars.js';
import { wheel } from './models.js';

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
  const mesh = def.ground ? buildCloneTrailer(protos) : buildWaymoMothership(protos.waymo);
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
  const makeDrop = ground ? makeTag : makeCone;

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
    B.hp -= n; B.hurtT = 0.35; hud();
    ctx.floatText(`${why} -${n}`);
    ctx.blip(900, 200, 0.25, 'square', 0.16);
    mesh.userData.eye.getWorldPosition(tmp);
    for (let i = 0; i < 14; i++) ctx.puff(tmp, new THREE.Vector3((Math.random() - 0.5) * 18, Math.random() * 8, (Math.random() - 0.5) * 18), i % 2 ? '#ffb347' : '#ffe9a0', 1.4, 0.6);
    if (B.phase === 1 && B.hp <= def.hp / 2) { B.phase = 2; ctx.radio(def.lines.half); }
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

  function startAttack() {
    const P = ctx.P;
    const nearLane = ctx.LANES.reduce((a, l, i) => (Math.abs(l - P.d) < Math.abs(ctx.LANES[a] - P.d) ? i : a), 0);
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
      B.y += (hoverY - B.y) * Math.min(1, dt * 1.5);
    }

    // coil charges on its own too
    P.coil = Math.min(100, P.coil + dt * 3.2);
    if (P.coil >= 100 && !B.coilHint) { B.coilHint = true; ctx.radio(def.lines.coil); }

    // attacks
    if (B.telegraph) {
      B.telegraph.t -= dt;
      if (B.telegraph.t <= 0) {
        if (ground) {
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
        ctx.toast('장애물 감지!', '라이다에 걸려 급정거', '#ff3d6e');
        ctx.blip(200, 60, 0.4, 'square', 0.2);
      }
      if (B.beam.t <= 0) B.beam = null;
    } else {
      B.atkT -= dt;
      if (B.atkT <= 0) startAttack();
    }

    // cones fall and sit on the road
    for (const c of B.cones) {
      if (!c.landed) { c.vy -= 30 * dt; c.y += c.vy * dt; const gy = ctx.carGround(c.s, c.d); if (c.y <= gy) { c.y = gy; c.landed = true; } }
      if (!c.hit && Math.abs(c.s - P.s) < 1.6 && Math.abs(c.d - P.d) < (ground ? 2.2 : 1.4)) {
        if (P.y - ctx.carGround(P.s, P.d) < 0.9) { c.hit = true; P.v *= 0.72; P.shake = 0.4; ctx.floatText(ground ? '가격 파괴!' : '콘 충돌!'); ctx.blip(300, 100, 0.2, 'square', 0.12); c.flyV = new THREE.Vector3((Math.random() - 0.5) * 8, 9, -8); }
      }
      if (c.hit && c.flyV) { c.flyV.y -= 30 * dt; c.y += c.flyV.y * dt; c.d += c.flyV.x * dt; c.s += (P.v + 6) * dt; }
    }
    B.cones = B.cones.filter((c) => { const keep = c.s > P.s - 30 && c.y > -5; if (!keep) ctx.scene.remove(c.m); return keep; });

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
    for (const j of mesh.userData.jets) { j.scale.y = 0.8 + Math.sin(time * 30 + j.position.x) * 0.2; }
    const eye = mesh.userData.eyeMat;
    const flash = B.hurtT > 0 ? (Math.sin(time * 60) > 0 ? 8 : 2) : B.telegraph ? 6 + Math.sin(time * 30) * 2 : 4;
    eye.color.setRGB(flash, 0.2, 0.25);
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
      const on = B.beam && B.beam.lanes.includes(i);
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
    for (const c of B.cones) { c.m.visible = true; ctx.world(c.s, c.d, c.y, c.m.position); c.m.rotation.y = ctx.frame(c.s).yaw; if (c.flyV) c.m.rotation.x += 0.2; }
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
    for (const c of B.cones) ctx.scene.remove(c.m);
    Object.assign(B, { hp: def.hp, active: false, done: false, defeated: false, fleeing: false, telegraph: null, beam: null, phase: 1, atkT: 4, cones: [], coilHint: false, jumpHintAt: null });
    mesh.visible = false; mesh.rotation.set(0, 0, 0);
    end(); B.done = false;
  }

  // movie-poster pose for the loading screen: looming over the street, eye blazing
  function posterPose(sPos, d, y, time) {
    mesh.visible = true;
    if (ground) { ctx.world(sPos, d, y, mesh.position); mesh.rotation.set(0, ctx.frame(sPos).yaw + 0.12, 0); mesh.userData.eyeMat.color.setRGB(6 + Math.sin(time * 4) * 2, 0.25, 0.2); return; }
    ctx.world(sPos, d, y + Math.sin(time * 1.1) * 0.3, mesh.position);
    mesh.rotation.set(0.08, ctx.frame(sPos).yaw + 0.35, 0.05);
    for (const p of mesh.userData.pivots) p.rotation.y = time * 6;
    mesh.userData.eyeMat.color.setRGB(6 + Math.sin(time * 4) * 2, 0.2, 0.25);
  }

  return { B, update, sync, reset, fireCoil, posterPose, roofAt };
}
