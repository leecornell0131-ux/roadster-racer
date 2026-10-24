// Scenery and boss props from Sketchfab (all CC BY 4.0, see CREDITS.md), packed by tools/pack-model.mjs.
// A stage or boss lists the props it needs; they load once, get normalised (sized in metres,
// standing on y=0, centred, nose along -z like the cars) and are handed out as clones.
import * as THREE from 'three';
import { loadGltfJson } from './realcars.js';

// fit: which axis of the file gets `size` metres; yaw turns the file so its front faces -z
export const PROPS = {
  semi: { fit: 'z', size: 7.2, yaw: Math.PI, credit: 'Semi Truck Baked — 3DE_Study' },
  carrier: { fit: 'z', size: 22, yaw: Math.PI, credit: 'Car Carrier Trailer — Dakta.Grower.Nzl' },
  icecream: { fit: 'z', size: 11.4, yaw: -Math.PI / 2 - 0.513, credit: 'Ice Cream Truck — Pooi Woon Hoh' },
  af1: { fit: 'z', size: 70, yaw: Math.PI, credit: 'Boeing 747 Air Force One — JUSTGAME' },
  airship: { fit: 'z', size: 120, yaw: 0, credit: 'L30 Airship — BocajLegMeat' },
  falcon9: { fit: 'y', size: 70, yaw: 0, credit: 'Falcon 9 Block 5 — AllThingsSpace', plain: /F9_First_Stage/ }, // plain: drop the texture (lettering, flag)
  optimus: { fit: 'y', size: 1.73, yaw: 0, credit: 'Tesla Optimus — mriexinger' },
  starlink: { fit: 'y', size: 10, yaw: 0, credit: 'Starlink Satellite — Malacodart' },
  starship: { fit: 'y', size: 50, yaw: 0, credit: 'SpaceX Starship — AllThingsSpace' },
  vrheadset: { fit: 'z', size: 1, yaw: 0, credit: 'VR Headset — Vitamin' },
};

const cache = new Map();
export const loaded = {};

function normalise(name, scene) {
  const cfg = PROPS[name];
  const holder = new THREE.Group(); holder.add(scene); holder.rotation.y = cfg.yaw; holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder);
  const span = box.max[cfg.fit] - box.min[cfg.fit];
  holder.scale.setScalar(cfg.size / span); holder.updateMatrixWorld(true); box.setFromObject(holder);
  holder.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  scene.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = o.receiveShadow = true;
    const m = o.material; if (cfg.plain?.test(m?.name)) { o.material = m.clone(); o.material.map = null; o.material.color.set('#ececec'); o.material.needsUpdate = true; }
    if (m) { m.envMapIntensity ??= 1; if (m.transparent && m.opacity > 0.95) m.transparent = false; }
  });
  const g = new THREE.Group(); g.add(holder); g.updateMatrixWorld(true);
  g.userData = { prop: name, size: new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3()) };
  return g;
}

export function loadProps(names = []) {
  return Promise.all(names.map((n) => {
    if (!cache.has(n)) cache.set(n, loadGltfJson(`assets/props/${n}.json`).then((gl) => (loaded[n] = normalise(n, gl.scene))).catch((e) => { console.warn('prop failed', n, e); return null; }));
    return cache.get(n);
  })).then(() => loaded);
}

// a clone scaled so its fit axis is `size` metres (shares geometry and materials)
export function prop(name, size) {
  const p = loaded[name]; if (!p) return null;
  const c = p.clone(); if (size) c.scale.setScalar(size / PROPS[name].size);
  c.userData = { ...p.userData, size: p.userData.size.clone().multiplyScalar(size ? size / PROPS[name].size : 1) };
  return c;
}

export const propCredits = (names) => names.filter((n) => loaded[n]).map((n) => PROPS[n].credit + ' (CC BY 4.0)');
