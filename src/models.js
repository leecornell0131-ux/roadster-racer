// Procedural vehicle and hardware models. Bodies are lofted from superellipse
// cross-sections so they read as smooth car surfaces rather than boxes.
// Any of these can be swapped for a real GLB later (see loadOverride in game.js).
import * as THREE from 'three';

// ---------- helpers ----------
// stations: [{ z, w, top, bot, n?, nb? }] front (-z) to rear (+z).
// n = superellipse exponent for the upper half (2 = ellipse, higher = boxier), nb for the lower half.
export function loft(stations, opts = {}) {
  const seg = opts.seg || 40;
  const sm = opts.smooth ?? 3; // catmull-rom subdivisions between stations
  const st = resample(stations, sm);
  const pos = [], uv = [], idx = [];
  const ring = seg + 1;
  st.forEach((s, i) => {
    const mid = (s.top + s.bot) / 2, hu = s.top - mid, hl = mid - s.bot;
    const n = s.n ?? 3.2, nb = s.nb ?? 5;
    for (let j = 0; j <= seg; j++) {
      const a = (j / seg) * Math.PI * 2;
      const c = Math.cos(a), sn = Math.sin(a);
      const up = sn >= 0;
      const e = up ? n : nb;
      const x = s.w * Math.sign(c) * Math.pow(Math.abs(c), 2 / e);
      const y = mid + (up ? hu : hl) * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / e);
      pos.push(x, y, s.z);
      uv.push(j / seg, i / (st.length - 1));
    }
    if (i < st.length - 1) for (let j = 0; j < seg; j++) {
      const a = i * ring + j, b = a + ring;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  });
  // end caps
  for (const [i, flip] of [[0, true], [st.length - 1, false]]) {
    const s = st[i], c = pos.length / 3;
    pos.push(0, (s.top + s.bot) / 2, s.z); uv.push(0.5, 0.5);
    for (let j = 0; j < seg; j++) {
      const a = i * ring + j;
      flip ? idx.push(c, a + 1, a) : idx.push(c, a, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
function resample(st, k) {
  if (k <= 1) return st;
  const keys = ['z', 'w', 'top', 'bot', 'n', 'nb'];
  const out = [];
  for (let i = 0; i < st.length - 1; i++) {
    const p0 = st[Math.max(0, i - 1)], p1 = st[i], p2 = st[i + 1], p3 = st[Math.min(st.length - 1, i + 2)];
    for (let t = 0; t < k; t++) {
      const u = t / k, o = {};
      for (const key of keys) {
        const v = [p0, p1, p2, p3].map((p) => p[key] ?? p1[key] ?? 3);
        o[key] = 0.5 * ((2 * v[1]) + (-v[0] + v[2]) * u + (2 * v[0] - 5 * v[1] + 4 * v[2] - v[3]) * u * u + (-v[0] + 3 * v[1] - 3 * v[2] + v[3]) * u * u * u);
      }
      if (o.w < 0.001) o.w = 0.001;
      out.push(o);
    }
  }
  out.push(st[st.length - 1]);
  return out;
}
export function labelTex(lines, opts = {}) {
  const w = opts.w || 512, h = opts.h || 128;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (opts.bg) { g.fillStyle = opts.bg; g.fillRect(0, 0, w, h); }
  g.textAlign = opts.align || 'center'; g.textBaseline = 'middle';
  lines.forEach(([text, font, color, y, glow]) => {
    g.font = font; g.fillStyle = color;
    g.shadowColor = color; g.shadowBlur = glow || 0;
    g.fillText(text, opts.align === 'left' ? 16 : w / 2, y * h);
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
export function wheel({ r = 0.36, width = 0.28, rim = '#c9ccd6', spokes = 10, rimR = 0.25, aero = false }) {
  const g = new THREE.Group();
  const tireGeo = new THREE.TorusGeometry(r - 0.08, 0.085, 12, 32);
  const tire = new THREE.MeshStandardMaterial({ color: '#111114', roughness: 0.85 });
  const t1 = new THREE.Mesh(tireGeo, tire); t1.scale.z = width / 0.17; g.add(t1);
  const rimMat = new THREE.MeshPhysicalMaterial({ color: rim, metalness: 1, roughness: 0.22, clearcoat: 0.5 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(rimR, rimR, width * 0.8, 32, 1), new THREE.MeshStandardMaterial({ color: '#1a1b20', metalness: 0.8, roughness: 0.4 }));
  disc.rotation.x = Math.PI / 2; g.add(disc);
  if (aero) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(rimR * 0.98, rimR * 0.98, 0.02, 32), rimMat);
    cap.rotation.x = Math.PI / 2; cap.position.z = width * 0.42; g.add(cap);
  }
  for (let i = 0; i < spokes; i++) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.035, rimR * 0.95, 0.03), rimMat);
    const a = (i / spokes) * Math.PI * 2;
    sp.position.set(Math.sin(a) * rimR * 0.5, Math.cos(a) * rimR * 0.5, width * 0.43);
    sp.rotation.z = -a + 0.25;
    g.add(sp);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 16), rimMat); hub.rotation.x = Math.PI / 2; hub.position.z = width * 0.45; g.add(hub);
  const disk = new THREE.Mesh(new THREE.TorusGeometry(rimR * 0.78, 0.02, 6, 24), new THREE.MeshStandardMaterial({ color: '#666', metalness: 1, roughness: 0.5 }));
  disk.position.z = width * 0.1; g.add(disk);
  // orient so the wheel axle is the X axis
  g.rotation.y = Math.PI / 2;
  const outer = new THREE.Group(); outer.add(g);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return outer;
}
let blobTex = null;
export function blobShadow(w, l) {
  if (!blobTex) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 8, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,0.85)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); blobTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.9 }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.03; m.renderOrder = -1; m.name = 'blob';
  return m;
}
const glow = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), toneMapped: false });

// ---------- Tesla Roadster (2nd gen) ----------
export function makeRoadster(color = '#b5091f') {
  const car = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: 0.35, roughness: 0.42, clearcoat: 0.7, clearcoatRoughness: 0.06, envMapIntensity: 0.55 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#06070a', metalness: 0.2, roughness: 0.02, clearcoat: 1, envMapIntensity: 1.6 });
  const black = new THREE.MeshStandardMaterial({ color: '#0c0c0f', metalness: 0.4, roughness: 0.45 });
  // long, low body with wide rear haunches. Real car: 4.4 m long, 2.0 m wide, 1.1 m tall.
  const body = loft([
    { z: -2.24, w: 0.30, top: 0.47, bot: 0.30, n: 2.4, nb: 3 },
    { z: -2.16, w: 0.70, top: 0.53, bot: 0.24, n: 2.6 },
    { z: -1.95, w: 0.88, top: 0.60, bot: 0.20, n: 3.2 },
    { z: -1.55, w: 1.0, top: 0.68, bot: 0.36, n: 3.6, nb: 1.6 },
    { z: -1.05, w: 0.96, top: 0.74, bot: 0.21, n: 4.2 },
    { z: -0.55, w: 0.90, top: 0.80, bot: 0.19, n: 4.2 },
    { z: 0.05, w: 0.88, top: 0.84, bot: 0.19, n: 4 },
    { z: 0.65, w: 0.96, top: 0.86, bot: 0.19, n: 4 },
    { z: 1.25, w: 1.04, top: 0.86, bot: 0.38, n: 4, nb: 1.6 },
    { z: 1.70, w: 0.98, top: 0.84, bot: 0.22, n: 4 },
    { z: 2.02, w: 0.92, top: 0.80, bot: 0.27, n: 3.6 },
    { z: 2.18, w: 0.78, top: 0.75, bot: 0.34, n: 3 },
    { z: 2.24, w: 0.40, top: 0.70, bot: 0.42, n: 2.5 },
  ], { seg: 48 });
  const bm = new THREE.Mesh(body, paint); bm.castShadow = bm.receiveShadow = true; car.add(bm);
  // teardrop glass canopy (targa roof reads as one dark glass bubble)
  const canopy = loft([
    { z: -0.62, w: 0.50, top: 0.80, bot: 0.76, n: 2.2 },
    { z: -0.35, w: 0.68, top: 0.97, bot: 0.78, n: 2.6 },
    { z: 0.05, w: 0.74, top: 1.11, bot: 0.80, n: 3 },
    { z: 0.45, w: 0.74, top: 1.15, bot: 0.82, n: 3 },
    { z: 0.95, w: 0.70, top: 1.09, bot: 0.83, n: 3 },
    { z: 1.40, w: 0.58, top: 0.97, bot: 0.83, n: 2.8 },
    { z: 1.78, w: 0.32, top: 0.87, bot: 0.82, n: 2.4 },
  ], { seg: 40 });
  car.add(new THREE.Mesh(canopy, glass));
  // body-colour roof spine between windshield and rear glass
  const roof = loft([
    { z: -0.1, w: 0.44, top: 1.125, bot: 1.06, n: 3 },
    { z: 0.45, w: 0.46, top: 1.165, bot: 1.10, n: 3 },
    { z: 0.95, w: 0.40, top: 1.10, bot: 1.05, n: 3 },
  ], { seg: 32, smooth: 4 });
  car.add(new THREE.Mesh(roof, paint));
  // splitter, side skirts, diffuser
  const split = loft([
    { z: -2.26, w: 0.6, top: 0.27, bot: 0.2, n: 2 }, { z: -1.9, w: 0.9, top: 0.25, bot: 0.17, n: 6 }, { z: -1.5, w: 0.9, top: 0.22, bot: 0.17, n: 6 },
  ], { seg: 24 });
  car.add(new THREE.Mesh(split, black));
  const diff = loft([{ z: 1.7, w: 0.8, top: 0.3, bot: 0.18, n: 6 }, { z: 2.2, w: 0.75, top: 0.42, bot: 0.24, n: 6 }, { z: 2.27, w: 0.6, top: 0.4, bot: 0.3, n: 4 }], { seg: 24 });
  car.add(new THREE.Mesh(diff, black));
  // wheels: 19" front, 20" rear, turbine-style
  car.userData.wheels = [];
  for (const [x, z, r] of [[-0.8, -1.42, 0.35], [0.8, -1.42, 0.35], [-0.83, 1.33, 0.37], [0.83, 1.33, 0.37]]) {
    const w = wheel({ r, rim: '#9aa0ad', spokes: 14, rimR: r - 0.1 });
    w.position.set(x, r, z); if (x < 0) w.rotation.y = Math.PI;
    car.add(w); car.userData.wheels.push(w);
  }
  // headlights: thin slanted LED blades
  const led = glow(3, 3, 3.4);
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.035, 0.06), led);
    h.position.set(s * 0.6, 0.55, -2.1); h.rotation.set(-0.35, s * 0.35, s * -0.08); car.add(h);
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.09, 0.05), glass); lens.position.set(s * 0.6, 0.53, -2.08); lens.rotation.copy(h.rotation); car.add(lens);
  }
  // full-width taillight
  const tail = glow(5, 0.25, 0.35);
  const tl = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 0.04), tail); tl.position.set(0, 0.72, 2.2); car.add(tl);
  for (const s of [-1, 1]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.05), tail); t.position.set(s * 0.82, 0.71, 2.08); t.rotation.y = s * 0.55; car.add(t); }
  car.userData.tail = tail;
  // SpaceX cold-gas thrusters (hidden behind the plate, glow when firing)
  const jet = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.4, 3.2), toneMapped: false, transparent: true, opacity: 0 });
  for (const [x, z] of [[-0.6, -1.85], [0.6, -1.85], [-0.6, 1.85], [0.6, 1.85]]) {
    const j = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.26, 0.5, 12), jet); j.position.set(x, 0.0, z); car.add(j);
  }
  car.userData.jet = jet;
  car.add(blobShadow(2.6, 5.2));
  return car;
}

// ---------- Waymo (Jaguar I-Pace with the 5th-gen sensor kit) ----------
export function makeWaymo() {
  const car = new THREE.Group();
  const white = new THREE.MeshPhysicalMaterial({ color: '#e9ebee', metalness: 0.0, roughness: 0.45, clearcoat: 0.8, clearcoatRoughness: 0.08, envMapIntensity: 0.7 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#05070b', metalness: 0.3, roughness: 0.03, clearcoat: 1 });
  const black = new THREE.MeshStandardMaterial({ color: '#16181d', metalness: 0.5, roughness: 0.4 });
  car.add(new THREE.Mesh(loft([
    { z: -2.34, w: 0.40, top: 0.72, bot: 0.40, n: 2.4 },
    { z: -2.25, w: 0.80, top: 0.82, bot: 0.30, n: 3 },
    { z: -1.9, w: 0.97, top: 0.92, bot: 0.26, n: 4.4 },
    { z: -1.2, w: 1.0, top: 0.98, bot: 0.25, n: 5 },
    { z: -0.2, w: 1.0, top: 1.0, bot: 0.25, n: 5 },
    { z: 0.9, w: 1.02, top: 1.04, bot: 0.25, n: 5 },
    { z: 1.8, w: 0.98, top: 1.04, bot: 0.28, n: 4.6 },
    { z: 2.25, w: 0.88, top: 1.0, bot: 0.36, n: 3.6 },
    { z: 2.36, w: 0.5, top: 0.96, bot: 0.45, n: 2.6 },
  ], { seg: 44 }), white));
  car.add(new THREE.Mesh(loft([
    { z: -1.35, w: 0.84, top: 1.0, bot: 0.96, n: 3 },
    { z: -0.85, w: 0.84, top: 1.32, bot: 0.97, n: 3.6 },
    { z: -0.1, w: 0.82, top: 1.52, bot: 0.98, n: 4 },
    { z: 0.9, w: 0.8, top: 1.54, bot: 1.0, n: 4 },
    { z: 1.6, w: 0.74, top: 1.42, bot: 1.0, n: 3.6 },
    { z: 2.05, w: 0.6, top: 1.2, bot: 1.0, n: 3 },
  ], { seg: 40 }), glass));
  car.add(new THREE.Mesh(loft([
    { z: -0.55, w: 0.72, top: 1.53, bot: 1.44, n: 4 }, { z: 0.4, w: 0.74, top: 1.585, bot: 1.5, n: 4 }, { z: 1.5, w: 0.66, top: 1.5, bot: 1.42, n: 4 },
  ], { seg: 32 }), white));
  // grille, wheels
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.28, 0.06), black); grille.position.set(0, 0.55, -2.3); car.add(grille);
  for (const [x, z] of [[-0.9, -1.48], [0.9, -1.48], [-0.9, 1.5], [0.9, 1.5]]) {
    const w = wheel({ r: 0.39, rim: '#3a3d44', spokes: 10, rimR: 0.27 }); w.position.set(x, 0.39, z); if (x < 0) w.rotation.y = Math.PI; car.add(w);
  }
  // sensor dome: black lidar can + white housing
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.14, 24), white); base.position.set(0, 1.66, 0.25); car.add(base);
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.31, 0.3, 28), new THREE.MeshPhysicalMaterial({ color: '#0b0c10', metalness: 0.6, roughness: 0.1, clearcoat: 1 })); can.position.set(0, 1.88, 0.25); car.add(can);
  const capm = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), white); capm.scale.y = 0.35; capm.position.set(0, 2.03, 0.25); car.add(capm);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.012, 6, 32), glow(3, 0.25, 0.25)); ring.rotation.x = Math.PI / 2; ring.position.set(0, 1.92, 0.25); car.add(ring);
  // corner pods + side mirror cameras
  for (const [x, z] of [[-1.0, -1.95], [1.0, -1.95], [-0.98, 2.05], [0.98, 2.05]]) {
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.2, 14), black); pod.position.set(x, 0.92, z); car.add(pod);
  }
  for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.22), white); m.position.set(s * 1.05, 1.08, -0.95); car.add(m); }
  // logo strip
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.16), new THREE.MeshBasicMaterial({ map: labelTex([['waymo', '700 84px Arial', '#1b4cff', 0.55]], { w: 512, h: 128 }), transparent: true }));
  for (const s of [-1, 1]) { const l = logo.clone(); l.position.set(s * 1.035, 0.7, 0.2); l.rotation.y = s * Math.PI / 2; car.add(l); }
  // spinning lidar beam
  const pivot = new THREE.Group(); pivot.name = 'pivot'; pivot.position.set(0, 1.88, 0.25); car.add(pivot);
  const cone = new THREE.ConeGeometry(2.4, 15, 20, 1, true); cone.translate(0, -7.5, 0); cone.rotateX(-Math.PI / 2);
  const laser = new THREE.Mesh(cone, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 0.1, 0.12), transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  laser.rotation.x = 0.1; pivot.add(laser);
  const tail = glow(2.5, 0.15, 0.2);
  for (const s of [-1, 1]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.05), tail); t.name = 'tail'; t.position.set(s * 0.55, 0.98, 2.33); car.add(t); }
  car.userData.tail = tail;
  car.traverse((o) => { if (o.isMesh && o !== laser) o.castShadow = true; });
  car.add(blobShadow(2.7, 5.4));
  return car;
}

// ---------- Tesla Cybercab ----------
export function makeCybercab() {
  const car = new THREE.Group();
  const silver = new THREE.MeshPhysicalMaterial({ color: '#a9adb6', metalness: 0.9, roughness: 0.42, clearcoat: 0.3, clearcoatRoughness: 0.3, envMapIntensity: 0.8 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#07080c', metalness: 0.3, roughness: 0.02, clearcoat: 1 });
  car.add(new THREE.Mesh(loft([
    { z: -2.05, w: 0.5, top: 0.66, bot: 0.34, n: 2.4 },
    { z: -1.95, w: 0.86, top: 0.74, bot: 0.26, n: 3.4 },
    { z: -1.4, w: 0.95, top: 0.82, bot: 0.24, n: 4.6 },
    { z: -0.3, w: 0.97, top: 0.88, bot: 0.24, n: 5 },
    { z: 0.9, w: 0.97, top: 0.9, bot: 0.24, n: 5 },
    { z: 1.7, w: 0.9, top: 0.92, bot: 0.3, n: 4 },
    { z: 2.0, w: 0.7, top: 0.92, bot: 0.4, n: 3 },
    { z: 2.06, w: 0.35, top: 0.9, bot: 0.5, n: 2.4 },
  ], { seg: 44 }), silver));
  // big glass canopy that falls all the way to the tail (fastback)
  car.add(new THREE.Mesh(loft([
    { z: -1.3, w: 0.8, top: 0.86, bot: 0.82, n: 3 },
    { z: -0.6, w: 0.84, top: 1.28, bot: 0.84, n: 3.6 },
    { z: 0.2, w: 0.82, top: 1.42, bot: 0.86, n: 4 },
    { z: 1.0, w: 0.76, top: 1.30, bot: 0.88, n: 3.6 },
    { z: 1.7, w: 0.6, top: 1.05, bot: 0.9, n: 3 },
    { z: 2.0, w: 0.4, top: 0.94, bot: 0.9, n: 2.6 },
  ], { seg: 40 }), glass));
  for (const [x, z] of [[-0.84, -1.3], [0.84, -1.3], [-0.84, 1.3], [0.84, 1.3]]) {
    const w = wheel({ r: 0.38, rim: '#d0d3da', spokes: 6, rimR: 0.27, aero: true }); w.position.set(x, 0.38, z); if (x < 0) w.rotation.y = Math.PI; car.add(w);
  }
  const strip = glow(4, 4, 4.4);
  const f = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.03, 0.03), strip); f.position.set(0, 0.7, -2.0); car.add(f);
  const tail = glow(4, 0.2, 0.3);
  const t = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.04, 0.04), tail); t.name = 'tail'; t.position.set(0, 0.86, 2.04); car.add(t);
  car.userData.tail = tail;
  car.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  car.add(blobShadow(2.5, 4.8));
  return car;
}

// ---------- GPUs (shown 4x real size so you can see them at speed) ----------
function fan(r, blades, mat, hubMat) {
  const g = new THREE.Group();
  const ringM = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.05, 8, 40), hubMat); g.add(ringM);
  const rotor = new THREE.Group(); rotor.name = 'rotor'; g.add(rotor);
  for (let i = 0; i < blades; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(r * 0.32, r * 0.86, 0.01), mat);
    const a = (i / blades) * Math.PI * 2;
    b.position.set(Math.sin(a) * r * 0.48, Math.cos(a) * r * 0.48, 0); b.rotation.set(0.35, 0, -a);
    rotor.add(b);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.3, r * 0.3, 0.04, 24), hubMat); hub.rotation.x = Math.PI / 2; rotor.add(hub);
  return g;
}
export function makeRTX5090() {
  // Founders Edition: dark gunmetal shroud, two flow-through fans, lit GEFORCE RTX strip
  const S = 4, L = 0.304 * S, H = 0.137 * S, T = 0.04 * S;
  const g = new THREE.Group();
  const shroud = new THREE.MeshPhysicalMaterial({ color: '#3a3c42', metalness: 1, roughness: 0.32, clearcoat: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: '#0e0f12', metalness: 0.6, roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(L, H, T), shroud); g.add(body);
  const finM = new THREE.MeshStandardMaterial({ color: '#1a1b1f', metalness: 0.9, roughness: 0.35 });
  for (const x of [-L * 0.27, L * 0.27]) {
    const f = fan(H * 0.4, 9, new THREE.MeshStandardMaterial({ color: '#15161a', metalness: 0.3, roughness: 0.6, side: THREE.DoubleSide }), finM);
    f.position.set(x, 0, T / 2 + 0.005); g.add(f);
    const recess = new THREE.Mesh(new THREE.CylinderGeometry(H * 0.43, H * 0.43, 0.01, 40), dark); recess.rotation.x = Math.PI / 2; recess.position.set(x, 0, T / 2 - 0.001); g.add(recess);
  }
  const xbar = new THREE.Mesh(new THREE.BoxGeometry(L * 0.08, H * 1.0, T * 1.02), dark); g.add(xbar);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(L * 0.55, T * 0.62), new THREE.MeshBasicMaterial({ map: labelTex([['GEFORCE RTX 5090', '700 60px Arial', '#ffffff', 0.55, 14]], { w: 1024, h: 96, bg: '#0d0e11' }), toneMapped: false }));
  label.material.color.setScalar(1.6);
  label.position.set(-L * 0.12, H / 2 + 0.003, 0); label.rotation.x = -Math.PI / 2; g.add(label);
  const pcie = new THREE.Mesh(new THREE.BoxGeometry(L * 0.35, H * 0.08, T * 0.15), new THREE.MeshStandardMaterial({ color: '#d4a43a', metalness: 1, roughness: 0.3 }));
  pcie.position.set(-L * 0.15, -H / 2 - H * 0.04, 0); g.add(pcie);
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.02, H * 1.12, T * 1.2), new THREE.MeshStandardMaterial({ color: '#b9bcc4', metalness: 1, roughness: 0.3 }));
  bracket.position.set(-L / 2 - 0.01, 0, 0); g.add(bracket);
  g.userData.fans = []; g.traverse((o) => { if (o.name === 'rotor') g.userData.fans.push(o); });
  g.rotation.x = -0.35;
  const wrap = new THREE.Group(); wrap.add(g); wrap.userData.fans = g.userData.fans;
  return wrap;
}
export function makeH100() {
  // H100 PCIe: brass-gold shroud with a black centre grille and NVIDIA wordmark
  const S = 4, L = 0.268 * S, H = 0.111 * S, T = 0.035 * S;
  const g = new THREE.Group();
  const gold = new THREE.MeshPhysicalMaterial({ color: '#c9a24a', metalness: 1, roughness: 0.26, clearcoat: 0.6 });
  g.add(new THREE.Mesh(new THREE.BoxGeometry(L, H, T), gold));
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#0b0b0b'; x.fillRect(0, 0, 512, 128);
  for (let i = 0; i < 512; i += 8) { x.fillStyle = '#2a2a2a'; x.fillRect(i, 0, 3, 128); }
  x.fillStyle = '#76b900'; x.font = '900 54px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = '#76b900'; x.shadowBlur = 12; x.fillText('NVIDIA H100', 256, 66);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const grille = new THREE.Mesh(new THREE.PlaneGeometry(L * 0.72, H * 0.6), new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: '#ffffff', emissiveIntensity: 0.9, metalness: 0.5, roughness: 0.5 }));
  grille.position.z = T / 2 + 0.003; g.add(grille);
  const back = grille.clone(); back.rotation.y = Math.PI; back.position.z = -T / 2 - 0.003; g.add(back);
  const pcie = new THREE.Mesh(new THREE.BoxGeometry(L * 0.35, H * 0.08, T * 0.15), new THREE.MeshStandardMaterial({ color: '#d4a43a', metalness: 1, roughness: 0.3 }));
  pcie.position.set(-L * 0.12, -H / 2 - H * 0.04, 0); g.add(pcie);
  g.rotation.x = -0.35;
  const wrap = new THREE.Group(); wrap.add(g); wrap.userData.fans = [];
  return wrap;
}
export function makeBlackwell() {
  // B200 superchip module: dark board, two big dies under a glowing heat spreader
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 1.0), new THREE.MeshStandardMaterial({ color: '#0d3b1e', metalness: 0.3, roughness: 0.6 })));
  for (const x of [-0.3, 0.3]) {
    const die = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.6), new THREE.MeshPhysicalMaterial({ color: '#1a1530', metalness: 1, roughness: 0.1, emissive: '#7a3dff', emissiveIntensity: 1.4, clearcoat: 1 }));
    die.position.set(x, 0.07, 0); g.add(die);
  }
  for (let i = 0; i < 8; i++) {
    const hbm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.18), new THREE.MeshStandardMaterial({ color: '#2a2a30', metalness: 0.9, roughness: 0.3 }));
    hbm.position.set((i % 4 - 1.5) * 0.32, 0.06, i < 4 ? -0.4 : 0.4); g.add(hbm);
  }
  const halo = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.05, 8, 48), glow(2.4, 1.4, 4)); halo.rotation.x = Math.PI / 2; g.add(halo);
  g.userData.fans = [];
  return g;
}
