// Stage bosses. A boss hovers above the road ahead of the player and attacks lanes with a
// telegraph first; the player answers with the auto-aimed Tesla coil (charged by pickups)
// or a jump attack from below. Everything game-side comes in through ctx so bosses stay data.
import * as THREE from 'three';
import { instance, addSensorKit } from './realcars.js';

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
  eye.position.set(0, size.y * 0.45, size.z / 2 + 0.2); eye.scale.z = 0.5; g.add(eye);
  const eyeRing = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.12, 8, 32), new THREE.MeshStandardMaterial({ color: '#15161a', metalness: 0.8, roughness: 0.3 }));
  eyeRing.position.copy(eye.position); g.add(eyeRing);
  g.userData = { size, pivots, jets, eyeMat };
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
};

export function createBoss(ctx, key, proto) {
  const def = BOSSES[key];
  const mesh = buildWaymoMothership(proto);
  mesh.visible = false; ctx.scene.add(mesh);
  const size = mesh.userData.size;
  const B = { def, mesh, hp: def.hp, active: false, done: false, defeated: false, s: 0, d: 0, y: def.hover, gap: 34, atkT: 4, phase: 1, telegraph: null, beam: null, hurtT: 0, fallV: 0, jumpCd: 0, cones: [] };

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
    mesh.getWorldPosition(tmp);
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
      // cone drop: every lane but one
      const free = (Math.random() * 4) | 0;
      ctx.LANES.forEach((l, i) => {
        if (i === free) return;
        const m = makeCone(); ctx.scene.add(m);
        B.cones.push({ s: B.s - size.z * 0.3, d: l + (Math.random() - 0.5) * 2, y: B.y, vy: 0, m, hit: false, landed: false });
      });
      ctx.floatText('콘 투하!');
      B.atkT = 2.6;
      return;
    }
    // lidar scan: the player's lane plus one neighbour (two neighbours in phase 2)
    const lanes = new Set([nearLane]);
    const nb = nearLane + (Math.random() < 0.5 ? -1 : 1);
    lanes.add(THREE.MathUtils.clamp(nb, 0, 3));
    if (B.phase === 2) lanes.add(THREE.MathUtils.clamp(nearLane - (nb - nearLane), 0, 3));
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

    // hover ahead, matching speed, weaving slowly
    const t = performance.now() / 1000;
    B.gap = 23 + Math.sin(t * 0.7) * 4;
    B.s += P.v * dt + (P.s + B.gap - B.s) * Math.min(1, dt * 1.5);
    const targetD = B.telegraph ? B.d : Math.sin(t * 0.45) * 5;
    B.d += (targetD - B.d) * Math.min(1, dt * 1.5);
    const hoverY = def.hover + Math.sin(t * 2.1) * 0.35;
    B.y += (hoverY - B.y) * Math.min(1, dt * 1.5);

    // coil charges on its own too
    P.coil = Math.min(100, P.coil + dt * 3.2);
    if (P.coil >= 100 && !B.coilHint) { B.coilHint = true; ctx.radio(def.lines.coil); }

    // attacks
    if (B.telegraph) {
      B.telegraph.t -= dt;
      if (B.telegraph.t <= 0) { B.beam = { lanes: B.telegraph.lanes, t: 0.5, hit: false }; B.telegraph = null; ctx.blip(1200, 80, 0.45, 'sawtooth', 0.16); }
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
      if (!c.hit && Math.abs(c.s - P.s) < 1.6 && Math.abs(c.d - P.d) < 1.4) {
        if (P.y - ctx.carGround(P.s, P.d) < 0.9) { c.hit = true; P.v *= 0.72; P.shake = 0.4; ctx.floatText('콘 충돌!'); ctx.blip(300, 100, 0.2, 'square', 0.12); c.flyV = new THREE.Vector3((Math.random() - 0.5) * 8, 9, -8); }
      }
      if (c.hit && c.flyV) { c.flyV.y -= 30 * dt; c.y += c.flyV.y * dt; c.d += c.flyV.x * dt; c.s += (P.v + 6) * dt; }
    }
    B.cones = B.cones.filter((c) => { const keep = c.s > P.s - 30 && c.y > -5; if (!keep) ctx.scene.remove(c.m); return keep; });

    // jump attack: airborne car hits the belly from below
    B.jumpCd -= dt;
    const ds = B.s - P.s;
    if (B.jumpCd <= 0 && !P.grounded && Math.abs(ds) < size.z / 2 + 1.5 && Math.abs(B.d - P.d) < size.x / 2 + 0.8 && P.y + 1.2 > B.y - 0.6) {
      B.jumpCd = 1.6; damage(22, '점프 어택');
      P.vy = Math.min(P.vy, -4); P.v *= 0.92;
      ctx.toast('점프 어택!', '배를 들이받았다', '#ffc83d');
    }
    if (B.jumpHintAt == null && P.s > def.appearAt + 500) { B.jumpHintAt = P.s; ctx.radio(def.lines.jump); }
    B.hurtT -= dt;
  }

  function sync(time) {
    if (!mesh.visible) { for (const c of B.cones) c.m.visible = false; return; }
    ctx.world(B.s, B.d, B.y, mesh.position);
    if (!B.defeated) { mesh.rotation.set(0, ctx.frame(B.s).yaw, Math.sin(time * 1.3) * 0.04); }
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
      const sMid = B.s - STRIPE_LEN / 2;
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
      tmp2.copy(mesh.position).add(new THREE.Vector3(0, size.y * 0.45, 0));
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
    ctx.world(sPos, d, y + Math.sin(time * 1.1) * 0.3, mesh.position);
    mesh.rotation.set(0.08, ctx.frame(sPos).yaw + 0.35, 0.05);
    for (const p of mesh.userData.pivots) p.rotation.y = time * 6;
    mesh.userData.eyeMat.color.setRGB(6 + Math.sin(time * 4) * 2, 0.2, 0.25);
  }

  return { B, update, sync, reset, fireCoil, posterPose };
}
