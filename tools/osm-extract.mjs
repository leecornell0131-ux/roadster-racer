// Bakes an OpenStreetMap extract into a compact city JSON for the engine (assets/osm/<id>.json).
// Data © OpenStreetMap contributors, ODbL 1.0 — the attribution string travels inside the JSON (meta.attribution).
// usage: node tools/osm-extract.mjs austin            fetch from Overpass (mirrors tried in order) and bake
//        node tools/osm-extract.mjs austin raw.json   bake from an Overpass JSON saved earlier
import fs from 'node:fs';

const CITIES = {
  austin: { name: 'Austin, TX (downtown)', bbox: [30.25, -97.765, 30.29, -97.725] }, // south, west, north, east
};
const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const ATTRIBUTION = '© OpenStreetMap contributors';

const [, , id = 'austin', rawPath] = process.argv;
const city = CITIES[id];
if (!city) throw new Error(`unknown city ${id}`);
const [S, W, N, E] = city.bbox;

const query = `[out:json][timeout:180][bbox:${S},${W},${N},${E}];
(
  way[highway]; way[building]; relation[building];
  way[natural=water]; relation[natural=water]; way[waterway];
  way[leisure~"^(park|stadium|pitch|garden|golf_course)$"]; relation[leisure=park];
  way[landuse~"^(grass|recreation_ground|forest|cemetery)$"];
  way[railway~"^(rail|light_rail)$"];
  node[tourism~"^(attraction|museum|viewpoint|artwork|hotel)$"][name];
  node[amenity~"^(theatre|university|place_of_worship|townhall|cinema|bar|restaurant|cafe|fuel|charging_station)$"][name];
  node[historic][name]; node[highway=traffic_signals];
  way[tourism~"^(attraction|museum|hotel)$"][name]; way[amenity~"^(university|townhall|theatre|place_of_worship)$"][name];
  way[historic][name]; way[leisure=stadium][name];
);
out body geom qt;`;

async function fetchRaw() {
  for (const url of MIRRORS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: query }), headers: { 'User-Agent': 'roadster-racer map baker' } });
        const text = await res.text();
        if (text.startsWith('{')) return JSON.parse(text);
        console.warn(`${url}: ${(text.match(/Error<\/strong>: ([^<]*)/) || [, res.status])[1]}`);
      } catch (e) { console.warn(`${url}: ${e.message}`); }
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  throw new Error('all Overpass mirrors failed');
}

const raw = rawPath ? JSON.parse(fs.readFileSync(rawPath, 'utf8')) : await fetchRaw();
const els = raw.elements;

// Local metres around the bbox centre. Three.js axes: x = east, z = south (north is -z), y up.
const lat0 = (S + N) / 2, lon0 = (W + E) / 2, phi = (lat0 * Math.PI) / 180;
const mLat = 111132.92 - 559.82 * Math.cos(2 * phi) + 1.175 * Math.cos(4 * phi);
const mLon = 111412.84 * Math.cos(phi) - 93.5 * Math.cos(3 * phi);
const proj = (p) => [(p.lon - lon0) * mLon, -(p.lat - lat0) * mLat];
const half = [((E - W) / 2) * mLon, ((N - S) / 2) * mLat];
const inside = ([x, z]) => Math.abs(x) <= half[0] && Math.abs(z) <= half[1];
const r1 = (v) => Math.round(v * 10) / 10;
const flat = (pts) => pts.flatMap(([x, z]) => [r1(x), r1(z)]);

// Douglas–Peucker; `keep` marks indices that must survive (graph nodes).
function simplify(pts, tol, keep) {
  if (pts.length < 3) return pts;
  const mark = new Uint8Array(pts.length); mark[0] = mark[pts.length - 1] = 1;
  if (keep) keep.forEach((k, i) => { if (k) mark[i] = 1; });
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let best = -1, bi = -1;
    const [ax, az] = pts[a], [bx, bz] = pts[b], dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((pts[i][0] - ax) * dz - (pts[i][1] - az) * dx) / L;
      if (mark[i]) { stack.push([a, i], [i, b]); best = -2; break; }
      if (d > best) { best = d; bi = i; }
    }
    if (best > tol) { mark[bi] = 1; stack.push([a, bi], [bi, b]); }
  }
  return pts.filter((_, i) => mark[i]);
}

// Sutherland–Hodgman against the bbox (convex, so one pass per edge is exact).
function clipPoly(pts) {
  const edges = [[0, -1, half[0]], [0, 1, half[0]], [1, -1, half[1]], [1, 1, half[1]]];
  for (const [ax, sgn, lim] of edges) {
    const inn = (p) => sgn * p[ax] <= lim, out = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      if (inn(p)) out.push(p);
      if (inn(p) !== inn(q)) { const t = (sgn * lim - p[ax]) / (q[ax] - p[ax]); out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]); }
    }
    pts = out;
    if (!pts.length) break;
  }
  return pts;
}

const area = (pts) => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
const centroid = (pts) => { const n = pts.length; return pts.reduce((c, p) => [c[0] + p[0] / n, c[1] + p[1] / n], [0, 0]); };

// Joins multipolygon member ways into closed rings (role "outer" only).
function outerRings(rel) {
  const segs = rel.members.filter((m) => m.type === 'way' && m.role !== 'inner' && m.geometry).map((m) => m.geometry.map(proj));
  const rings = [];
  while (segs.length) {
    let ring = segs.shift();
    for (let grew = true; grew && segs.length;) {
      grew = false;
      const end = ring[ring.length - 1];
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i], same = (a, b) => Math.abs(a[0] - b[0]) < 0.01 && Math.abs(a[1] - b[1]) < 0.01;
        if (same(s[0], end)) ring = ring.concat(s.slice(1));
        else if (same(s[s.length - 1], end)) ring = ring.concat(s.slice(0, -1).reverse());
        else continue;
        segs.splice(i, 1); grew = true; break;
      }
    }
    rings.push(ring);
  }
  return rings;
}
// Rings come back open (closing duplicate dropped) so Douglas–Peucker gets a real baseline.
const open = (r) => (r.length > 1 && Math.hypot(r[0][0] - r.at(-1)[0], r[0][1] - r.at(-1)[1]) < 0.01 ? r.slice(0, -1) : r);
const ringsOf = (el) => (el.type === 'relation' ? outerRings(el) : el.geometry ? [el.geometry.map(proj)] : []).map(open);

const names = [], nameIdx = new Map();
const nm = (s) => { if (!s) return -1; if (!nameIdx.has(s)) { nameIdx.set(s, names.length); names.push(s); } return nameIdx.get(s); };

// ---- road graph (drivable ways) ----
const DRIVE = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'service',
  'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link'];
const PATHS = ['footway', 'pedestrian', 'cycleway', 'path', 'steps'];
const WIDTH = { motorway: 3.7, trunk: 3.6, primary: 3.5, secondary: 3.4, tertiary: 3.3, unclassified: 3, residential: 3, living_street: 2.8, service: 2.8 };
const DEFAULT_LANES = { motorway: 3, trunk: 2, primary: 2, secondary: 2, tertiary: 2 };
const drive = els.filter((e) => e.type === 'way' && DRIVE.includes(e.tags?.highway) && e.geometry && !['parking_aisle', 'drive-through'].includes(e.tags.service));
const uses = new Map();
for (const w of drive) w.nodes.forEach((n, i) => uses.set(n, (uses.get(n) || 0) + (i === 0 || i === w.nodes.length - 1 ? 2 : 1)));
const nodeXZ = [], nodeOf = new Map();
const gnode = (osmId, p) => { if (!nodeOf.has(osmId)) { nodeOf.set(osmId, nodeXZ.length / 2); nodeXZ.push(r1(p[0]), r1(p[1])); } return nodeOf.get(osmId); };
const edges = [];
for (const w of drive) {
  const t = w.tags, type = t.highway, base = type.replace('_link', '');
  const lanes = +t.lanes || (t.oneway === 'yes' ? 1 : DEFAULT_LANES[base] || 1) * (t.oneway === 'yes' ? 1 : 2);
  const oneway = t.oneway === 'yes' || t.oneway === '1' || type === 'motorway' || t.junction === 'roundabout' ? 1 : t.oneway === '-1' ? -1 : 0;
  const layer = t.bridge ? Math.max(1, +t.layer || 1) : t.tunnel ? Math.min(-1, +t.layer || -1) : +t.layer || 0;
  const meta = { type, name: nm(t.name || t.ref), lanes, oneway, layer, width: r1(lanes * (WIDTH[base] || 3)), speed: parseInt(t.maxspeed) || 0 };
  const pts = w.geometry.map(proj);
  let run = []; // [osmId, xz] runs that stay inside the bbox, cut at graph nodes
  const flush = () => {
    if (run.length >= 2) {
      const shape = simplify(run.map((r) => r[1]), 1.0);
      edges.push([gnode(run[0][0], run[0][1]), gnode(run.at(-1)[0], run.at(-1)[1]), meta, flat(shape.slice(1, -1))]);
    }
  };
  for (let i = 0; i < pts.length; i++) {
    if (!inside(pts[i])) { flush(); run = []; continue; }
    run.push([w.nodes[i], pts[i]]);
    if (run.length > 1 && (uses.get(w.nodes[i]) > 1 || i === pts.length - 1)) { flush(); run = [run.at(-1)]; }
  }
  flush();
}
const TYPES = [...new Set(edges.map((e) => e[2].type))];

// ---- everything else ----
const buildings = [], paths = [], water = [], waterways = [], green = [], rail = [], landmarks = [], signals = [];
const seen = new Set();
const lm = (name, kind, xz) => { const k = `${name}|${kind}`; if (!name || seen.has(k) || !inside(xz)) return; seen.add(k); landmarks.push({ name, kind, x: r1(xz[0]), z: r1(xz[1]) }); };
const heightOf = (t) => {
  const h = parseFloat(t.height), lv = parseFloat(t['building:levels']);
  if (h > 0) return h;
  if (lv > 0) return lv * 3.3 + 1;
  return { house: 6, residential: 7, garage: 3.5, shed: 3, roof: 4, parking: 9, apartments: 14, office: 18, commercial: 9, retail: 6 }[t.building] || 8;
};
for (const e of els) {
  const t = e.tags || {};
  if (t.building && e.type !== 'node') {
    for (let ring of ringsOf(e)) {
      ring = clipPoly(simplify(ring, 0.4));
      if (ring.length < 3 || Math.abs(area(ring)) < 8) continue;
      if (area(ring) > 0) ring.reverse(); // emit counter-clockwise seen from above (x east, z south ⇒ negative signed area)
      buildings.push([r1(heightOf(t)), r1(parseFloat(t.min_height) || (parseFloat(t['building:min_level']) || 0) * 3.3), nm(t.name), t.building === 'yes' ? '' : t.building, flat(ring)]);
    }
    if (t.name && (t.tourism || t.historic || t.amenity)) lm(t.name, t.tourism || t.amenity || 'historic', centroid(ringsOf(e)[0] || [[1e9, 1e9]]));
    continue;
  }
  if (e.type === 'way' && PATHS.includes(t.highway) && e.geometry && !['sidewalk', 'crossing'].includes(t.footway)) {
    const cut = []; let run = [];
    for (const p of e.geometry.map(proj)) { if (inside(p)) run.push(p); else { if (run.length > 1) cut.push(run); run = []; } }
    if (run.length > 1) cut.push(run);
    for (const c of cut) paths.push([t.highway, nm(t.name), flat(simplify(c, 1.0))]);
    continue;
  }
  if (t.natural === 'water' || t.leisure || t.landuse) {
    const out = t.natural === 'water' ? water : green;
    for (const ring of ringsOf(e)) {
      const c = clipPoly(simplify(ring, 1.0));
      if (c.length >= 3 && Math.abs(area(c)) > 20) out.push(t.natural === 'water' ? [nm(t.name), flat(c)] : [t.leisure || t.landuse, nm(t.name), flat(c)]);
    }
    if (t.name && (t.leisure === 'stadium' || t.leisure === 'park')) lm(t.name, t.leisure, centroid(ringsOf(e)[0] || [[1e9, 1e9]]));
    continue;
  }
  if (e.type === 'way' && (t.waterway || t.railway) && e.geometry) {
    const pts = e.geometry.map(proj).filter(inside);
    if (pts.length > 1) (t.waterway ? waterways : rail).push([t.waterway || t.railway, nm(t.name), flat(simplify(pts, 1.0))]);
    continue;
  }
  if (e.type === 'node') {
    const p = proj(e);
    if (t.highway === 'traffic_signals') { if (inside(p)) signals.push(r1(p[0]), r1(p[1])); }
    else lm(t.name, t.tourism || t.amenity || (t.historic && 'historic'), p);
    continue;
  }
  if (t.name && (t.tourism || t.amenity || t.historic)) lm(t.name, t.tourism || t.amenity || 'historic', centroid(ringsOf(e)[0] || [[1e9, 1e9]]));
}

// Nearest graph node per landmark, so the engine can route to it as a destination.
const nearest = (x, z) => { let b = -1, bd = Infinity; for (let i = 0; i < nodeXZ.length; i += 2) { const d = (nodeXZ[i] - x) ** 2 + (nodeXZ[i + 1] - z) ** 2; if (d < bd) { bd = d; b = i / 2; } } return [b, r1(Math.sqrt(bd))]; };
for (const l of landmarks) [l.node, l.nodeDist] = nearest(l.x, l.z);

const out = {
  meta: {
    id, name: city.name, attribution: ATTRIBUTION, license: 'ODbL-1.0 (https://www.openstreetmap.org/copyright)',
    source: 'OpenStreetMap via Overpass API', osmTimestamp: raw.osm3s?.timestamp_osm_base, baked: new Date().toISOString().slice(0, 10),
    bbox: { south: S, west: W, north: N, east: E }, origin: { lat: lat0, lon: lon0 },
    units: 'metres, 0.1 m precision', axes: 'x = east, z = south (north is -z), y up; origin = bbox centre',
    extent: { x: [-r1(half[0]), r1(half[0])], z: [-r1(half[1]), r1(half[1])] },
    format: {
      names: 'string table; every *name field below is an index into it, -1 = unnamed',
      roads: 'nodes = flat [x,z,...] graph nodes (intersections, dead ends, bbox cuts); edges = [a, b, typeIdx, name, lanes, oneway(1 a→b, -1 b→a, 0 both), layer(+bridge/-tunnel), widthM, maxspeedMph(0 unknown), flat interior shape points a→b]; types = highway type table',
      buildings: '[heightM, minHeightM, name, buildingType("" = generic), flat footprint ring, CCW from above, not closed]',
      paths: '[highwayType, name, flat polyline] for footways/cycleways/steps (sidewalks omitted)',
      water: '[name, flat polygon] clipped to bbox', waterways: '[waterwayType, name, flat polyline]',
      green: '[leisureOrLanduse, name, flat polygon]', rail: '[railwayType, name, flat polyline]',
      landmarks: '{name, kind, x, z, node (nearest road graph node), nodeDist}', signals: 'flat [x,z,...] traffic signal positions',
    },
  },
  names,
  roads: { types: TYPES, nodes: nodeXZ, edges: edges.map(([a, b, m, shape]) => [a, b, TYPES.indexOf(m.type), m.name, m.lanes, m.oneway, m.layer, m.width, m.speed, shape]) },
  buildings, paths, water, waterways, green, rail, landmarks, signals,
};
fs.mkdirSync('assets/osm', { recursive: true });
const json = JSON.stringify(out);
fs.writeFileSync(`assets/osm/${id}.json`, json);
console.log(`assets/osm/${id}.json ${(json.length / 1e6).toFixed(2)} MB — ${nodeXZ.length / 2} nodes, ${edges.length} edges, ${buildings.length} buildings, ${paths.length} paths, ${water.length} water, ${green.length} green, ${landmarks.length} landmarks, ${signals.length / 2} signals`);
for (const k of ['roads', 'buildings', 'paths', 'water', 'waterways', 'green', 'rail', 'landmarks', 'signals', 'names']) console.log(`  ${k.padEnd(10)} ${(JSON.stringify(out[k]).length / 1e3).toFixed(0)} KB`);
