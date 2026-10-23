// Real scanned/modelled cars (glTF packed as .json with embedded buffers, see tools/pack-model.mjs).
// Each loader swaps a procedural stand-in from models.js for the real mesh in place, keeping the
// userData hooks the game drives (wheels, tail, jet, blob), so a failed load just leaves the stand-in.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { wheel as stockWheel } from './models.js';

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

export async function loadGltfJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(url + ' ' + res.status);
  const text = await res.text();
  return new Promise((ok, fail) => loader.parse(text, url.replace(/[^/]*$/, ''), ok, fail));
}

// bake a mesh into car space as a plain float, non-indexed geometry (quantized attributes can't be re-transformed)
function baked(mesh, inv) {
  const src = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
  const g = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) {
    const a = src.getAttribute(name); if (!a) continue;
    const out = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k);
    g.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize));
  }
  const m = new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld);
  g.applyMatrix4(m);
  return g;
}

// split triangles into the four wheel corners by centroid
function quadrants(g) {
  const p = g.getAttribute('position'), n = g.getAttribute('normal');
  const bins = [[], [], [], []], nb = [[], [], [], []];
  for (let t = 0; t < p.count; t += 3) {
    const cx = (p.getX(t) + p.getX(t + 1) + p.getX(t + 2)) / 3, cz = (p.getZ(t) + p.getZ(t + 1) + p.getZ(t + 2)) / 3;
    const q = (cx > 0 ? 1 : 0) + (cz > 0 ? 2 : 0);
    for (let k = 0; k < 3; k++) {
      bins[q].push(p.getX(t + k), p.getY(t + k), p.getZ(t + k));
      if (n) nb[q].push(n.getX(t + k), n.getY(t + k), n.getZ(t + k));
    }
  }
  return bins.map((b, i) => {
    const q = new THREE.BufferGeometry();
    q.setAttribute('position', new THREE.Float32BufferAttribute(b, 3));
    if (n) q.setAttribute('normal', new THREE.Float32BufferAttribute(nb[i], 3)); else q.computeVertexNormals();
    return q;
  });
}

// ZTOONE3D "Tesla Roadster 2.0" (Sketchfab, CC BY-NC 4.0). Faces +z in the file; the game drives toward -z.
export async function upgradeRoadster(car, url = 'assets/cars/roadster.json', color = '#b0081c') {
  const gltf = await loadGltfJson(url);
  const root = gltf.scene;
  const holder = new THREE.Group(); holder.add(root); holder.rotation.y = Math.PI;
  holder.updateMatrixWorld(true);
  // normalise: 4.4 m long, tyres on y = 0, centred
  const box = new THREE.Box3().setFromObject(holder);
  const s = 4.4 / (box.max.z - box.min.z);
  holder.scale.setScalar(s);
  holder.updateMatrixWorld(true);
  box.setFromObject(holder);
  holder.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  holder.updateMatrixWorld(true);
  const inv = new THREE.Matrix4(); // meshes bake straight into car space

  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: 0.45, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 0.9 });
  const gloss = new THREE.MeshPhysicalMaterial({ color: '#07080a', metalness: 0.3, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 0.8 });
  const under = new THREE.MeshStandardMaterial({ color: '#0b0b0d', metalness: 0.2, roughness: 0.7 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#05070a', metalness: 0.1, roughness: 0.03, clearcoat: 1, envMapIntensity: 1.8 });
  const chrome = new THREE.MeshStandardMaterial({ color: '#c8ccd4', metalness: 1, roughness: 0.12, envMapIntensity: 1.2 });
  const led = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 3.2, 3.6), toneMapped: false });
  const rim = new THREE.MeshStandardMaterial({ color: '#3a3d44', metalness: 0.9, roughness: 0.3, envMapIntensity: 1 });
  const tyre = new THREE.MeshStandardMaterial({ color: '#111113', metalness: 0, roughness: 0.88 });
  const disc = new THREE.MeshStandardMaterial({ color: '#6c6e72', metalness: 0.85, roughness: 0.38 });
  const caliper = new THREE.MeshStandardMaterial({ color: '#c21420', metalness: 0.3, roughness: 0.4 });
  const tail = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.25, 0.35), toneMapped: false });

  const out = new THREE.Group();
  const wheelParts = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const n = o.name;
    const g = baked(o, inv);
    let mat = paint, spin = false;
    if (n.startsWith('Logo')) return; // no trademark badges
    if (n.startsWith('Body base')) mat = under;
    else if (n.startsWith('Black Body')) mat = gloss;
    else if (n.startsWith('Glass')) mat = glass;
    else if (n.startsWith('Headlight')) mat = /005|006/.test(n) ? led : chrome;
    else if (n.startsWith('side Light')) mat = /003|016/.test(n) ? tail : gloss;
    else if (n.startsWith('Maxs')) { mat = rim; spin = true; }
    else if (n.startsWith('Tires')) { mat = tyre; spin = true; }
    else if (n.startsWith('Disc')) { mat = disc; spin = true; }
    else if (n.startsWith('Breaks')) mat = caliper;
    if (spin) { wheelParts.push({ g, mat, tyre: mat === tyre }); return; }
    const m = new THREE.Mesh(g, mat);
    m.castShadow = mat !== led && mat !== tail; m.receiveShadow = true;
    out.add(m);
  });

  // four wheel pivots centred on each tyre, so the game's spin (children.rotation.x) turns them about the axle
  const wheels = [0, 1, 2, 3].map(() => ({ parts: [], box: new THREE.Box3() }));
  for (const part of wheelParts) quadrants(part.g).forEach((q, i) => {
    if (!q.getAttribute('position').count) return;
    wheels[i].parts.push({ g: q, mat: part.mat });
    if (part.tyre) { q.computeBoundingBox(); wheels[i].box.union(q.boundingBox); }
  });
  const pivots = [];
  for (const w of wheels) {
    if (!w.parts.length) continue;
    const c = w.box.getCenter(new THREE.Vector3());
    c.y = (w.box.max.y - w.box.min.y) / 2;
    const hub = new THREE.Group(); hub.position.copy(c);
    const spinner = new THREE.Group(); hub.add(spinner);
    for (const p of w.parts) {
      p.g.translate(-c.x, -c.y, -c.z);
      const m = new THREE.Mesh(p.g, p.mat); m.castShadow = true; spinner.add(m);
    }
    out.add(hub); pivots.push(hub);
  }

  // swap: keep the thrusters and the blob shadow from the stand-in
  for (const child of [...car.children]) {
    const keep = child.name === 'blob' || child.material === car.userData.jet;
    if (!keep) car.remove(child);
  }
  car.add(out);
  car.userData.wheels = pivots;
  car.userData.tail = tail;
  car.userData.paint = paint;
  car.userData.real = true;
  return car;
}

// ---------- traffic ----------
// yaw turns the file so its nose points to -z; len is the real length in metres.
// paint/glass/head/tail/wheel/hide are regexes on material (or mesh) names.
export const CARS = {
  modely: { url: 'assets/cars/modely.json', yaw: Math.PI, len: 4.79, paint: /^Material_2125765635$/, glass: /glass/, head: /front_white|^material$/, tail: /back_red|red_plastic/, wheel: /Rubber|black222|Material_111|black\.00[12]|Iron_Clean/,
    colors: ['#f2f2f0', '#f2f2f0', '#111214', '#8a8f96', '#1d3f8f', '#9b0d14'], credit: '2025 Tesla Model Y — BloxBloger (CC BY-NC 4.0)' },
  model3: { url: 'assets/cars/model3.json', yaw: 0, len: 4.69, paint: /^primary(\.00[124])?$/, glass: /^glass/, head: /aluminium_light|front_light/, tail: /rear_light|breaklight|tembus_red/, wheel: /^wheels|^hub_/,
    colors: ['#f2f2f0', '#111214', '#5d636b', '#1d3f8f', '#a3101a', '#c9ccd1'], credit: 'Tesla 2018 Model 3 — Ameer Studio (CC BY 4.0)' },
  cybertruck: { url: 'assets/cars/cybertruck.json', yaw: -Math.PI / 2, len: 5.68, paint: /^Bodyl$/, glass: /^Glass/, head: /Light_W/, tail: /Light_R/, wheel: /^Tire$/, stockWheels: true,
    colors: ['#a4a8ad', '#a4a8ad', '#a4a8ad', '#2b2d31'], metal: true, credit: 'Tesla Cybertruck — TAIGA-ZOE (CC BY 4.0)' },
  ioniq5: { url: 'assets/cars/ioniq5.json', yaw: 0, len: 4.64, paint: /Gravity_Gold/, glass: /^$/, head: /Emission/, tail: /^$/, wheel: /Tires/,
    colors: ['#f4f4f2'], credit: 'Hyundai Ioniq 5 Lowpoly — andikapratamaw (CC BY 4.0)' },
  dolphin: { url: 'assets/cars/dolphin.json', yaw: Math.PI, len: 4.29, paint: /Paint_Color/, glass: /D_glass$/, head: /Light_Emiss/, tail: /^$/, wheel: /D_tire/,
    colors: ['#2a7f8f', '#d9dde0', '#e8b6c4', '#3c4b5a', '#f0ecdf'], credit: '2021 BYD Dolphin EV — Ddiaz Design (CC BY-NC-SA 4.0)' },
  sealion7: { url: 'assets/cars/sealion7.json', yaw: 0, len: 4.83, paint: /carpaint/, glass: /^glass1$/, head: /^$/, tail: /^light$|rear_L/, wheel: /rim_B|Chrome_Rim|^tire$|disk1/,
    colors: ['#1c3d6e', '#e9ebec', '#2a2c30', '#6d7f8c'], credit: '2024 BYD Sealion 7 — Ddiaz Design (CC BY-NC-SA 4.0)' },
  torino: { url: 'assets/cars/torino.json', yaw: 0, len: 13.2, paint: /^prefen$/, glass: /^vidro$/, head: /luz_high|farois_NONE/, tail: /Materiais\.005/, wheel: /^tires$|^wheel$/,
    colors: ['#e2d21a', '#f2f2f0', '#2a7f8f'], credit: 'Torino BYD bus — lael.eugenio (CC BY 4.0)' },
};

const FLAT = ['position', 'normal', 'uv'];
function unify(g) { // same attribute set on every piece so they merge
  if (!g.getAttribute('normal')) g = toCreasedNormals(g, 0.6);
  if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
  for (const k of Object.keys(g.attributes)) if (!FLAT.includes(k)) g.deleteAttribute(k);
  return g;
}

// returns a prototype car: static parts merged per material, wheels on spin pivots
export async function loadCar(kind) {
  const cfg = CARS[kind];
  const gltf = await loadGltfJson(cfg.url);
  const holder = new THREE.Group(); holder.add(gltf.scene); holder.rotation.y = cfg.yaw;
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder);
  holder.scale.setScalar(cfg.len / (box.max.z - box.min.z));
  holder.updateMatrixWorld(true); box.setFromObject(holder);
  holder.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  holder.updateMatrixWorld(true);
  const I = new THREE.Matrix4();

  const paint = new THREE.MeshPhysicalMaterial({ color: cfg.colors[0], metalness: cfg.metal ? 0.9 : 0.4, roughness: cfg.metal ? 0.42 : 0.3, clearcoat: cfg.metal ? 0 : 1, clearcoatRoughness: 0.05, envMapIntensity: 0.9 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#06080b', metalness: 0.1, roughness: 0.04, clearcoat: 1, envMapIntensity: 1.6 });
  const head = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.8, 2), toneMapped: false });
  const tail = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 0.15, 0.2), toneMapped: false });
  paint.name = 'paint'; tail.name = 'tail';
  const byMat = new Map(), wheelParts = [], clones = new Map();
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const mn = o.material?.name || '', nn = o.name;
    const is = (re) => re.test(mn) || re.test(nn);
    let g = baked(o, I);
    let mat;
    if (is(cfg.paint)) mat = paint;
    else if (is(cfg.glass) || o.material?.transmission > 0) mat = glass;
    else if (is(cfg.head)) mat = head;
    else if (is(cfg.tail)) mat = tail;
    else {
      if (!clones.has(o.material)) {
        let c = o.material.clone(); c.flatShading = false; c.transmission = 0;
        if (c.transparent && c.opacity < 0.5) c = glass;
        clones.set(o.material, c);
      }
      mat = clones.get(o.material);
    }
    if (is(cfg.wheel)) { wheelParts.push({ g, mat }); return; }
    if (mat !== head && mat !== tail) g = toCreasedNormals(g, 0.6); // simplified panels carry wobbly normals; clearcoat shows every one
    g = unify(g);
    if (!byMat.has(mat)) byMat.set(mat, []);
    byMat.get(mat).push(g);
  });
  const car = new THREE.Group();
  for (const [mat, gs] of byMat) {
    const m = new THREE.Mesh(gs.length > 1 ? mergeGeometries(gs) : gs[0], mat);
    m.castShadow = mat !== head && mat !== tail; m.receiveShadow = true;
    if (mat === tail) m.name = 'tail';
    car.add(m);
  }
  const corners = [0, 1, 2, 3].map(() => ({ parts: [], box: new THREE.Box3() }));
  for (const p of wheelParts) quadrants(p.g).forEach((q, i) => {
    if (!q.getAttribute('position').count) return;
    corners[i].parts.push({ g: q, mat: p.mat }); q.computeBoundingBox(); corners[i].box.union(q.boundingBox);
  });
  const wheels = [];
  for (const c of corners) {
    if (!c.parts.length) continue;
    const ctr = c.box.getCenter(new THREE.Vector3()); const r = (c.box.max.y - c.box.min.y) / 2; ctr.y = c.box.min.y + r;
    const hub = new THREE.Group(); hub.position.copy(ctr); hub.name = 'wheel'; hub.userData.r = Math.max(r, 0.2);
    if (cfg.stockWheels) { // file's tyres are too dense to ship per car; swap in a light procedural wheel of the same size
      const w = stockWheel({ r, width: (c.box.max.x - c.box.min.x) * 0.9, rim: '#2b2d31', spokes: 6, rimR: r * 0.66, aero: true });
      const g = w.children[0]; g.rotation.y = ctr.x < 0 ? -Math.PI / 2 : Math.PI / 2;
      hub.add(g); car.add(hub); wheels.push(hub); continue;
    }
    const spin = new THREE.Group(); hub.add(spin);
    const merged = new Map();
    for (const p of c.parts) { p.g.translate(-ctr.x, -ctr.y, -ctr.z); if (!merged.has(p.mat)) merged.set(p.mat, []); merged.get(p.mat).push(unify(p.g)); }
    for (const [mat, gs] of merged) { const m = new THREE.Mesh(gs.length > 1 ? mergeGeometries(gs) : gs[0], mat); m.castShadow = true; spin.add(m); }
    car.add(hub); wheels.push(hub);
  }
  // re-centre on what actually got built (the file's bounds can include helpers or dropped parts)
  box.setFromObject(car);
  const off = new THREE.Vector3(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  for (const c of car.children) c.position.add(off);
  box.setFromObject(car);
  car.userData = { kind, cfg, size: box.getSize(new THREE.Vector3()) };
  return car;
}

// a traffic instance: shares geometry, gets its own paint and brake-light material
export function instance(proto, color) {
  const m = proto.clone();
  const cfg = proto.userData.cfg;
  let pm = null, tm = null;
  m.traverse((o) => {
    if (!o.isMesh) return;
    if (o.material.name === 'paint') { pm ??= o.material.clone(); pm.color.set(color ?? cfg.colors[(Math.random() * cfg.colors.length) | 0]); o.material = pm; }
    else if (o.material.name === 'tail') { tm ??= o.material.clone(); o.material = tm; }
  });
  m.userData = { kind: proto.userData.kind, size: proto.userData.size, tail: tm || new THREE.MeshBasicMaterial(), wheels: m.children.filter((c) => c.name === 'wheel'), pivot: m.getObjectByName('pivot') };
  return m;
}

// 5th-gen-style robotaxi sensor kit (roof lidar can + spinning beam + corner pods) for any car prototype
export function addSensorKit(car) {
  const { size } = car.userData, top = size.y, hw = size.x / 2, hl = size.z / 2;
  const white = new THREE.MeshPhysicalMaterial({ color: '#f1f2f0', metalness: 0.1, roughness: 0.35, clearcoat: 0.8 });
  const black = new THREE.MeshPhysicalMaterial({ color: '#0b0c10', metalness: 0.6, roughness: 0.1, clearcoat: 1 });
  const kit = new THREE.Group(); kit.position.set(0, top - 0.04, 0.15);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.14, 24), white); base.position.y = 0.07; kit.add(base);
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.31, 0.3, 28), black); can.position.y = 0.29; kit.add(can);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), white); cap.scale.y = 0.35; cap.position.y = 0.44; kit.add(cap);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.012, 6, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.25, 0.25), toneMapped: false })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.33; kit.add(ring);
  for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.2), white); c.position.set(s * 0.42, 0.06, -0.15); kit.add(c); }
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.2, 14), black); pod.position.set(x * (hw - 0.12), size.y * 0.55, z * (hl - 0.35)); car.add(pod);
  }
  const pivot = new THREE.Group(); pivot.name = 'pivot'; pivot.position.y = 0.29; kit.add(pivot);
  const cone = new THREE.ConeGeometry(2.4, 15, 20, 1, true); cone.translate(0, -7.5, 0); cone.rotateX(-Math.PI / 2);
  const laser = new THREE.Mesh(cone, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 0.1, 0.12), transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  laser.rotation.x = 0.1; pivot.add(laser);
  kit.traverse((o) => { if (o.isMesh && o !== laser) o.castShadow = true; });
  car.add(kit);
  car.userData.size = size.clone().setY(top + 0.5);
  return car;
}
