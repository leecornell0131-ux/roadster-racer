// Real cities from OpenStreetMap (baked by tools/osm-extract.mjs into assets/osm/<city>.json).
// planRoute() finds a drivable route between named places on the real road graph and turns it into a
// track: a 1 m table of positions and headings (corners filleted to arcs a car can take) plus the list of
// corners for the nav and the forks. cityMeshes() raises the real building footprints at their real heights.
import * as THREE from 'three';

export async function loadCity(id) {
  const r = await fetch(`assets/osm/${id}.json`);
  if (!r.ok) throw new Error(`city ${id}: ${r.status}`);
  return prepCity(await r.json());
}

const ROUTE_TYPES = { motorway: 0.75, trunk: 0.8, primary: 0.85, secondary: 0.9, tertiary: 0.95, unclassified: 1.1, residential: 1.25, primary_link: 1, secondary_link: 1, tertiary_link: 1, motorway_link: 0.95 };

function prepCity(C) {
  const N = C.roads.nodes, nodes = N.length / 2, adj = Array.from({ length: nodes }, () => []);
  C.roads.edges.forEach((e, i) => {
    const type = C.roads.types[e[2]], w = ROUTE_TYPES[type]; if (!w) return;
    const pts = [N[e[0] * 2], N[e[0] * 2 + 1], ...e[9], N[e[1] * 2], N[e[1] * 2 + 1]];
    let len = 0; for (let k = 2; k < pts.length; k += 2) len += Math.hypot(pts[k] - pts[k - 2], pts[k + 1] - pts[k - 1]);
    adj[e[0]].push({ i, to: e[1], pts, len, w, type });
    const rev = []; for (let k = pts.length - 2; k >= 0; k -= 2) rev.push(pts[k], pts[k + 1]);
    adj[e[1]].push({ i, to: e[0], pts: rev, len, w, type });
  });
  C.adj = adj;
  C.place = (name) => {
    if (Array.isArray(name)) return nearestNode(C, name[0], name[1]);
    const l = C.landmarks.find((x) => (typeof x.name === 'string' ? x.name : C.names[x.name]) === name);
    if (!l) throw new Error(`no landmark ${name}`);
    return C.adj[l.node].length ? l.node : nearestNode(C, l.x, l.z);
  };
  return C;
}
function nearestNode(C, x, z) {
  let best = -1, bd = 1e18; const N = C.roads.nodes;
  for (let i = 0; i < C.adj.length; i++) { if (!C.adj[i].length) continue; const d = (N[i * 2] - x) ** 2 + (N[i * 2 + 1] - z) ** 2; if (d < bd) { bd = d; best = i; } }
  return best;
}
const dirOf = (pts, end) => { const n = pts.length; const [x0, z0, x1, z1] = end ? [pts[n - 4], pts[n - 3], pts[n - 2], pts[n - 1]] : [pts[0], pts[1], pts[2], pts[3]]; return Math.atan2(x1 - x0, z1 - z0); };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

class Heap {
  a = [];
  get size() { return this.a.length; }
  push(x) { const a = this.a; a.push(x); let i = a.length - 1; while (i) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) { a[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } }
    return top;
  }
}
// shortest route with a cost for every turn (so it keeps to a few real corners, not a block-by-block zigzag)
function shortest(C, from, to, avoid) {
  const key = (n, e) => `${n}|${e}`;
  const dist = new Map(), prev = new Map(), heap = new Heap();
  heap.push([0, from, -1, null]); dist.set(key(from, -1), 0);
  while (heap.size) {
    const [d, n, ein, hin] = heap.pop();
    if (d > (dist.get(key(n, ein)) ?? 1e18)) continue;
    if (n === to) { const out = []; let k = key(n, ein); while (prev.has(k)) { const p = prev.get(k); out.push(p.edge); k = p.k; } return out.reverse(); }
    for (const e of C.adj[n]) {
      if (e.i === ein || avoid?.has(e.i)) continue;
      let c = e.len * e.w;
      if (hin != null) { const turn = Math.abs(wrap(dirOf(e.pts, false) - hin)); if (turn > 2.6) continue; if (turn > 0.5) c += 140; else if (turn > 0.2) c += 25; }
      const nd = d + c, k2 = key(e.to, e.i);
      if (nd < (dist.get(k2) ?? 1e18)) { dist.set(k2, nd); prev.set(k2, { k: key(n, ein), edge: e }); heap.push([nd, e.to, e.i, dirOf(e.pts, true)]); }
    }
  }
  throw new Error('no route');
}

// Douglas-Peucker on a flat [x,z,...] polyline
function simplify(p, tol) {
  const n = p.length / 2, keep = new Uint8Array(n); keep[0] = keep[n - 1] = 1;
  const st = [[0, n - 1]];
  while (st.length) {
    const [a, b] = st.pop(); let bi = -1, bd = tol;
    const ax = p[a * 2], az = p[a * 2 + 1], bx = p[b * 2], bz = p[b * 2 + 1], L = Math.hypot(bx - ax, bz - az) || 1;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((bx - ax) * (az - p[i * 2 + 1]) - (ax - p[i * 2]) * (bz - az)) / L; if (d > bd) { bd = d; bi = i; } }
    if (bi > 0) { keep[bi] = 1; st.push([a, bi], [bi, b]); }
  }
  const out = []; for (let i = 0; i < n; i++) if (keep[i]) out.push(p[i * 2], p[i * 2 + 1]);
  return out;
}

// route spec: { from, via: [], to, rMax } -> track. Places are landmark names or [x, z].
export function planRoute(C, spec, { pre = 600, post = 1600 } = {}) {
  const stops = [spec.from, ...(spec.via || []), spec.to].map((p) => C.place(p));
  const used = new Set(); let pts = [];
  for (let i = 0; i + 1 < stops.length; i++) {
    const edges = shortest(C, stops[i], stops[i + 1], used);
    for (const e of edges) { used.add(e.i); const q = pts.length ? e.pts.slice(2) : e.pts; pts.push(...q); }
  }
  pts = simplify(pts, 3);
  // fillet each corner: the largest arc that fits between its neighbours, capped by rMax for real corners
  const V = []; for (let i = 0; i < pts.length; i += 2) V.push([pts[i], pts[i + 1]]);
  const seg = (i) => Math.hypot(V[i + 1][0] - V[i][0], V[i + 1][1] - V[i][1]);
  const corners = [];
  for (let i = 1; i < V.length - 1; i++) {
    const h0 = Math.atan2(V[i][0] - V[i - 1][0], V[i][1] - V[i - 1][1]), h1 = Math.atan2(V[i + 1][0] - V[i][0], V[i + 1][1] - V[i][1]);
    const da = wrap(h1 - h0); if (Math.abs(da) < 0.02) continue;
    const t = Math.tan(Math.abs(da) / 2), room = Math.min(seg(i - 1), seg(i)) * 0.5;
    const rCap = Math.abs(da) > 0.6 ? (spec.rMax ?? 30) : 400;
    const r = Math.max(6, Math.min(rCap, room / t));
    corners.push({ i, da, r, T: r * t });
  }
  // walk: straight to each tangent point, around the arc, on to the next
  const out = []; let s = 0; const turns = [];
  const push = (x, z) => { out.push(x, z); };
  let cx = V[0][0], cz = V[0][1]; push(cx, cz);
  const lineTo = (x, z) => { const L = Math.hypot(x - cx, z - cz), n = Math.max(1, Math.ceil(L)); for (let k = 1; k <= n; k++) push(cx + (x - cx) * k / n, cz + (z - cz) * k / n); s += L; cx = x; cz = z; };
  for (const c of corners) {
    const [px, pz] = V[c.i - 1], [vx, vz] = V[c.i], [nx, nz] = V[c.i + 1];
    const l0 = Math.hypot(vx - px, vz - pz), l1 = Math.hypot(nx - vx, nz - vz);
    const ax = vx - (vx - px) / l0 * c.T, az = vz - (vz - pz) / l0 * c.T;
    lineTo(ax, az);
    const h0 = Math.atan2(vx - px, vz - pz), L = c.r * Math.abs(c.da), n = Math.max(2, Math.ceil(L));
    // atan2(dx, dz) growing is a left turn for the driver (heading south, east is on the left)
    const sgn = Math.sign(c.da);
    const ox = ax + Math.cos(h0) * c.r * sgn, oz = az - Math.sin(h0) * c.r * sgn;
    for (let k = 1; k <= n; k++) { const h = h0 + c.da * k / n; push(ox - Math.cos(h) * c.r * sgn, oz + Math.sin(h) * c.r * sgn); }
    cx = out[out.length - 2]; cz = out[out.length - 1];
    turns.push({ s: s + L / 2, a: c.da, r: c.r }); // + = left, as in the engine
    s += L;
  }
  lineTo(V[V.length - 1][0], V[V.length - 1][1]);
  const finish = s;
  // resample at 1 m with the straight run-ups before the start and after the finish
  const P = []; for (let i = 0; i < out.length; i += 2) P.push(out[i], out[i + 1]);
  const ext = (i0, i1, len) => { const dx = P[i1 * 2] - P[i0 * 2], dz = P[i1 * 2 + 1] - P[i0 * 2 + 1], L = Math.hypot(dx, dz) || 1; return [dx / L, dz / L]; };
  const m = P.length / 2, [fx0, fz0] = ext(0, Math.min(3, m - 1)), [fx1, fz1] = ext(Math.max(0, m - 4), m - 1);
  const dense = [];
  for (let k = pre; k > 0; k--) dense.push(P[0] - fx0 * k, P[1] - fz0 * k);
  let acc = 0, want = 0; dense.push(P[0], P[1]);
  for (let i = 1; i < m; i++) {
    const x0 = P[i * 2 - 2], z0 = P[i * 2 - 1], x1 = P[i * 2], z1 = P[i * 2 + 1], L = Math.hypot(x1 - x0, z1 - z0);
    while (want + 1 <= acc + L) { want += 1; const t = (want - acc) / L; dense.push(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t); }
    acc += L;
  }
  const ex = dense[dense.length - 2], ez = dense[dense.length - 1];
  for (let k = 1; k <= post; k++) dense.push(ex + fx1 * k, ez + fz1 * k);
  const n = dense.length / 2, xs = new Float64Array(n), zs = new Float64Array(n), hs = new Float64Array(n);
  for (let i = 0; i < n; i++) { xs[i] = dense[i * 2]; zs[i] = dense[i * 2 + 1]; }
  // engine heading: forward = (-sin h, 0, -cos h)
  let hPrev = null;
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    let h = Math.atan2(-(xs[b] - xs[a]), -(zs[b] - zs[a]));
    if (hPrev != null) h = hPrev + wrap(h - hPrev);
    hs[i] = hPrev = h;
  }
  return { track: { s0: -pre, n: n - 1, xs, zs, hs }, turns, finish: Math.floor(finish), names: stops };
}

// project a world point onto the track: { s, d } (nearest of the samples, metres)
export function project(track, x, z) {
  let bi = 0, bd = 1e18;
  for (let i = 0; i < track.n; i += 2) { const d = (track.xs[i] - x) ** 2 + (track.zs[i] - z) ** 2; if (d < bd) { bd = d; bi = i; } }
  const h = track.hs[bi], rx = Math.cos(h), rz = -Math.sin(h);
  return { s: bi + track.s0, d: (x - track.xs[bi]) * rx + (z - track.zs[bi]) * rz, dist: Math.sqrt(bd) };
}

// real buildings near the route: walls with metre-scaled facade uvs and flat roofs, one geometry per facade
// kind. near(x, z) picks the blocks worth drawing, keep(x, z) drops anything standing on the track.
export function cityBuildings(C, near, keep, kindOf) {
  const groups = new Map();
  for (const b of C.buildings) {
    const [h0, minH, , , ring] = b, n = ring.length / 2; if (n < 3) continue;
    let cx = 0, cz = 0, A = 0;
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; cx += ring[i * 2]; cz += ring[i * 2 + 1]; A += ring[i * 2] * ring[j * 2 + 1] - ring[j * 2] * ring[i * 2 + 1]; }
    cx /= n; cz /= n;
    if (!near(cx, cz)) continue;
    let ok = keep(cx, cz); for (let i = 0; i < n && ok; i++) ok = keep(ring[i * 2], ring[i * 2 + 1]); if (!ok) continue;
    const h = h0 > 0 ? h0 : 6 + ((Math.abs(cx * 13.1 + cz * 7.7) | 0) % 8), y0 = minH || 0;
    const kind = kindOf(h, b);
    const g = groups.get(kind) || groups.set(kind, { pos: [], uv: [], idx: [] }).get(kind);
    const flip = A > 0; // wall winding so the faces look outward
    let u = 0;
    for (let i = 0; i < n; i++) {
      const x0 = ring[i * 2], z0 = ring[i * 2 + 1], j = (i + 1) % n, x1 = ring[j * 2], z1 = ring[j * 2 + 1], L = Math.hypot(x1 - x0, z1 - z0);
      const v = g.pos.length / 3;
      g.pos.push(x0, y0, z0, x1, y0, z1, x1, h, z1, x0, h, z0);
      g.uv.push(u, y0, u + L, y0, u + L, h, u, h);
      if (flip) g.idx.push(v, v + 2, v + 1, v, v + 3, v + 2); else g.idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
      u += L;
    }
    const contour = []; for (let i = 0; i < n; i++) contour.push(new THREE.Vector2(ring[i * 2], ring[i * 2 + 1]));
    const tris = THREE.ShapeUtils.triangulateShape(contour, []);
    const v0 = g.pos.length / 3;
    for (let i = 0; i < n; i++) { g.pos.push(ring[i * 2], h, ring[i * 2 + 1]); g.uv.push(ring[i * 2], ring[i * 2 + 1]); }
    for (const [a, b2, c] of tris) {
      const ux = ring[b2 * 2] - ring[a * 2], uz = ring[b2 * 2 + 1] - ring[a * 2 + 1], vx = ring[c * 2] - ring[a * 2], vz = ring[c * 2 + 1] - ring[a * 2 + 1];
      if (uz * vx - ux * vz > 0) g.idx.push(v0 + a, v0 + b2, v0 + c); else g.idx.push(v0 + a, v0 + c, v0 + b2);
    }
  }
  const out = [];
  for (const [kind, g] of groups) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
    geo.setIndex(g.idx); geo.computeVertexNormals(); geo.computeBoundingSphere();
    out.push({ kind, geo });
  }
  return out;
}

// flat polygons (water, parks) as meshes lying at height y
export function cityPolys(list, y) {
  const pos = [], idx = [], uv = [];
  for (const [, , poly] of list.map((p) => (p.length === 2 ? [null, p[0], p[1]] : p))) {
    const n = poly.length / 2; if (n < 3) continue;
    const contour = []; for (let i = 0; i < n; i++) contour.push(new THREE.Vector2(poly[i * 2], poly[i * 2 + 1]));
    const tris = THREE.ShapeUtils.triangulateShape(contour, []);
    const v0 = pos.length / 3;
    for (let i = 0; i < n; i++) pos.push(poly[i * 2], y, poly[i * 2 + 1]);
    for (const [a, b, c] of tris) {
      const ux = poly[b * 2] - poly[a * 2], uz = poly[b * 2 + 1] - poly[a * 2 + 1], vx = poly[c * 2] - poly[a * 2], vz = poly[c * 2 + 1] - poly[a * 2 + 1];
      if (uz * vx - ux * vz > 0) idx.push(v0 + a, v0 + b, v0 + c); else idx.push(v0 + a, v0 + c, v0 + b);
    }
    for (let i = 0; i < n; i++) uv.push(poly[i * 2], poly[i * 2 + 1]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
