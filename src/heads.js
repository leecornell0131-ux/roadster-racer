// Celebrity heads (Sketchfab, CC BY 4.0, see CREDITS.md) for the bosses and the radio portraits.
// Each file is cut down to the head (materials to keep, a box crop in 0..1 of its bounds), then
// normalised: 1 unit tall, centred on the origin, face looking along +z (towards the chasing car).
import * as THREE from 'three';
import { loadGltfJson } from './realcars.js';
import { failed } from './props.js';

export const HEADS = {
  elon: { file: 'h_elon', yaw: 0, credit: 'Elon Musk face 3d — riccardogiorato' },
  trump: { file: 'h_trump', yaw: 0, credit: 'Donald Trump Head — Freegives' },
  zuck: { file: 'h_zuck', yaw: 0, keep: /Head|hair/i, crop: { y: [0.22, 1] }, hair: [/hair/i, 0.8, 0.92], credit: 'Mark Zuckerberg Low Poly — Vadim Fedenko' },
  bezos: { file: 'h_bezos', yaw: 0, crop: { y: [0.28, 1] }, credit: 'Jeff Bezos — EntropyNine' },
  biden: { file: 'h_biden', yaw: 0, keep: /AvatarHead|Hair|Brow/i, credit: 'JOE BIDEN — M.H6LL ENTERAR/VR' },
  obama: { file: 'h_obama', yaw: -Math.PI / 2 + 0.35, dropDark: 0.07, tint: '#e0a682', credit: 'BARACK OBAMA — LOUIS' },
};

const cache = new Map();
const GET = ['getX', 'getY', 'getZ', 'getW'];
export const heads = {};

// world-space copy of every kept mesh, with triangles outside the crop box dropped
function bake(cfg, root) {
  root.updateMatrixWorld(true);
  const parts = [];
  root.traverse((o) => {
    if (!o.isMesh || (cfg.keep && !cfg.keep.test(o.material?.name || '') && !cfg.keep.test(o.name))) return;
    const g = o.geometry.clone(); g.deleteAttribute('skinIndex'); g.deleteAttribute('skinWeight');
    // meshopt files carry quantised (int16, normalised) attributes: expand them to floats before transforming
    for (const [k, a] of Object.entries(g.attributes)) if (!(a.array instanceof Float32Array)) {
      const f = new Float32Array(a.count * a.itemSize);
      for (let i = 0; i < a.count; i++) for (let j = 0; j < a.itemSize; j++) f[i * a.itemSize + j] = a[GET[j]](i);
      g.setAttribute(k, new THREE.BufferAttribute(f, a.itemSize));
    }
    g.applyMatrix4(o.matrixWorld);
    parts.push({ g, mat: o.material });
  });
  const box = new THREE.Box3(); for (const p of parts) { p.g.computeBoundingBox(); box.union(p.g.boundingBox); }
  const size = box.getSize(new THREE.Vector3());
  if (cfg.crop) {
    const lim = {}; for (const ax of ['x', 'y', 'z']) { const [a, b] = cfg.crop[ax] || [0, 1]; lim[ax] = [box.min[ax] + a * size[ax] - 1e-6, box.min[ax] + b * size[ax] + 1e-6]; }
    const inside = (pos, i) => pos.getX(i) >= lim.x[0] && pos.getX(i) <= lim.x[1] && pos.getY(i) >= lim.y[0] && pos.getY(i) <= lim.y[1] && pos.getZ(i) >= lim.z[0] && pos.getZ(i) <= lim.z[1];
    for (const p of parts) {
      if (!p.g.index) p.g.setIndex([...Array(p.g.getAttribute('position').count).keys()]);
      const pos = p.g.getAttribute('position'), idx = p.g.index.array, keep = [];
      for (let t = 0; t < idx.length; t += 3) if (inside(pos, idx[t]) && inside(pos, idx[t + 1]) && inside(pos, idx[t + 2])) keep.push(idx[t], idx[t + 1], idx[t + 2]);
      p.g.setIndex(keep);
    }
  }
  // scans baked onto a black backdrop: drop triangles whose texture is near black
  if (cfg.dropDark) for (const p of parts) {
    const img = p.mat?.map?.image, uv = p.g.getAttribute('uv'); if (!img || !uv) continue;
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256; const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0, 256, 256);
    const px = cx.getImageData(0, 0, 256, 256).data;
    const lum = (u, v) => { const x = Math.min(255, Math.max(0, (u * 256) | 0)), y = Math.min(255, Math.max(0, ((p.mat.map.flipY ? 1 - v : v) * 256) | 0)), i = (y * 256 + x) * 4; return (px[i] + px[i + 1] + px[i + 2]) / 765; };
    if (!p.g.index) p.g.setIndex([...Array(p.g.getAttribute('position').count).keys()]);
    const idx = p.g.index.array, keep = [];
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t], b = idx[t + 1], c = idx[t + 2];
      if (lum((uv.getX(a) + uv.getX(b) + uv.getX(c)) / 3, (uv.getY(a) + uv.getY(b) + uv.getY(c)) / 3) > cfg.dropDark) keep.push(a, b, c);
    }
    p.g.setIndex(keep);
  }
  // drop the vertices no kept triangle uses, so the bounds (and the framing) fit the head
  for (const p of parts) if (p.g.index && (cfg.crop || cfg.dropDark)) p.g = p.g.toNonIndexed();
  return parts.filter((p) => p.g.getAttribute('position').count);
}

function normalise(name, gltf) {
  const cfg = HEADS[name];
  const parts = bake(cfg, gltf.scene);
  // hair cards that sit too wide on a skinned model: squeeze them around the head's axis
  if (cfg.hair) {
    const box = new THREE.Box3(); for (const p of parts) if (!cfg.hair[0].test(p.mat?.name || '')) { p.g.computeBoundingBox(); box.union(p.g.boundingBox); }
    const c = box.getCenter(new THREE.Vector3());
    for (const p of parts) if (cfg.hair[0].test(p.mat?.name || '')) p.g.translate(-c.x, -box.max.y, -c.z).scale(cfg.hair[1], cfg.hair[2], cfg.hair[1]).translate(c.x, box.max.y, c.z);
  }
  const inner = new THREE.Group();
  for (const { g, mat } of parts) {
    let m = mat;
    if (cfg.tint) { m = mat.clone(); m.color.set(cfg.tint); }
    const mesh = new THREE.Mesh(g, m); mesh.castShadow = true; inner.add(mesh);
  }
  inner.rotation.y = cfg.yaw; inner.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(inner), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const k = 1 / size.y; inner.scale.setScalar(k); inner.position.copy(c).multiplyScalar(-k);
  const g = new THREE.Group(); g.add(inner);
  g.userData = { head: name, size: size.multiplyScalar(k) };
  return g;
}

export function loadHeads(names = Object.keys(HEADS)) {
  return Promise.all(names.map((n) => {
    if (!cache.has(n)) cache.set(n, loadGltfJson(`assets/props/${HEADS[n].file}.json`).then((gl) => (heads[n] = normalise(n, gl))).catch((e) => { console.warn('head failed', n, e); failed.push(n + ': ' + String(e?.message || e).replace(/data:[^,]*,[A-Za-z0-9+/=]+/g, 'data-uri').slice(0, 90)); return null; }));
    return cache.get(n);
  })).then(() => heads);
}

// a clone `h` metres tall (shares geometry and materials)
export function head(name, h = 1) {
  const p = heads[name]; if (!p) return null;
  const c = p.clone(); c.scale.setScalar(h); c.userData = { ...p.userData, size: p.userData.size.clone().multiplyScalar(h) };
  return c;
}

// small square portraits (data URLs) for the radio and the boss bar, drawn once with a throwaway renderer
export function portraits(names, px = 128) {
  const out = {};
  const r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  r.setSize(px, px, false); r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight('#fff6ec', '#40384a', 2.2));
  const key = new THREE.DirectionalLight('#ffffff', 2.4); key.position.set(0.6, 0.8, 1); sc.add(key);
  const cam = new THREE.PerspectiveCamera(26, 1, 0.1, 20); cam.position.set(0, 0.04, 2.5); cam.lookAt(0, 0, 0);
  for (const n of names) {
    const h = head(n); if (!h) continue;
    sc.add(h); r.render(sc, cam); out[n] = r.domElement.toDataURL('image/png'); sc.remove(h);
  }
  r.dispose(); r.forceContextLoss?.();
  return out;
}

export const headCredits = (names) => names.filter((n) => heads[n]).map((n) => HEADS[n].credit + ' (CC BY 4.0)');
