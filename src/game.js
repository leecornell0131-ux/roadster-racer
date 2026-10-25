// Roadster Racer — engine. Stage content (track, scenery, traffic mix, boss, texts) lives in src/stages/.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { makeRoadster, makeWaymo, makeCybercab, makeRTX5090, makeH100, makeBlackwell } from './models.js';
import { upgradeRoadster, loadCar, instance, addSensorKit, fleet, CARS, ROADSTER_CREDIT } from './realcars.js';
import { createBoss } from './boss.js';
import { loadProps, prop, propCredits, failed as loadFailed } from './props.js';
import { loadHeads, portraits, headCredits } from './heads.js';
import { STAGES, ORDER } from './stages/index.js';
import { createMission, SLOW } from './missions.js';
import { loadCity, planRoute, project, cityBuildings, cityPolys } from './osm.js';

// ---------- quality ----------
const IS_MOBILE = matchMedia('(pointer: coarse)').matches || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
const Q = IS_MOBILE
  ? { pr: Math.min(devicePixelRatio, 1.5), shadow: 1024, bStep: 24, bloomRes: 0.5 }
  : { pr: Math.min(devicePixelRatio, 2), shadow: 2048, bStep: 17, bloomRes: 1 };

// ---------- stage ----------
// A stage is a region; its events (stage.events) are the campaign's chapters' parts. Each event is a full
// track of its own: it overrides any stage field (finish, ramps, traffic, boss, radio, texts) and adds a mission.
const STAGE_KEY = 'roadster-racer-stage', EVENT_KEY = 'roadster-racer-event';
const BASE = (() => {
  let id = new URLSearchParams(location.search).get('stage');
  if (!STAGES[id]) try { id = localStorage.getItem(STAGE_KEY); } catch {}
  return STAGES[id] || ORDER[0];
})();
const EVENTS = BASE.events || [{ id: 'run', name: BASE.name }];
const EV_I = (() => {
  let i = parseInt(new URLSearchParams(location.search).get('ev'), 10);
  if (!(i >= 0)) try { const v = JSON.parse(localStorage.getItem(EVENT_KEY) || 'null'); if (v?.stage === BASE.id) i = v.i; } catch {}
  return Math.min(EVENTS.length - 1, Math.max(0, i || 0));
})();
const EV = EVENTS[EV_I];
const ST = { ...BASE, ...EV, id: BASE.id, name: BASE.name, event: EV, evIndex: EV_I, evKey: `${BASE.id}:${EV.id}`,
  text: { ...BASE.text, ...EV.text }, lines: { ...BASE.lines, ...EV.lines }, env: { ...BASE.env, ...EV.env } };
// real-city events: the track is a route on the city's OpenStreetMap road graph. Length, corners, stops
// and eggs come from the real streets; fields given as functions of the route length are resolved here.
const CITY = ST.route ? await loadCity(ST.city) : null;
const ROUTE = CITY ? planRoute(CITY, ST.route) : null;
if (ROUTE) {
  ST.finish = ROUTE.finish; ST.turns = ROUTE.turns; ST.cx = null;
  for (const k of ['ramps', 'jams', 'zones', 'radio', 'forks', 'checkpoints', 'legend']) if (typeof ST[k] === 'function') ST[k] = ST[k](ROUTE.finish, ROUTE);
  // a named place lands where the route passes it, in the lane on its side of the street
  const at = (name, lane) => {
    const l = CITY.landmarks.find((x) => (typeof x.name === 'string' ? x.name : CITY.names[x.name]) === name);
    if (!l) return null;
    const pr = project(ROUTE.track, l.x, l.z), side = Math.sign(pr.d) || 1;
    // a stop right on a corner (or inside a fork's split) can't be braked into: slide it onto the nearest calm stretch
    const calm = (s) => !ROUTE.turns.some((t) => Math.abs(t.a) > 0.6 && s > t.s - 220 && s < t.s + 180);
    const s0 = Math.min(ROUTE.finish - 60, Math.max(120, pr.s));
    const s = [0, -60, 60, -120, 120, -200, 200, -280, 280, -360, 360].map((o) => s0 + o).find((x) => x > 120 && x < ROUTE.finish - 60 && calm(x)) ?? s0;
    return { s: Math.round(s), d: lane ?? side * (ST.lanes.at(-1)) };
  };
  if (ST.mission?.stops) ST.mission = { ...ST.mission, stops: ST.mission.stops.map((st) => ({ ...st, ...(st.place ? at(st.place, st.d) : {}) })).sort((a, b) => a.s - b.s) };
  // no launch ramp in the run-up to a stop: you can't brake while airborne
  if (ST.mission?.stops && Array.isArray(ST.ramps)) ST.ramps = ST.ramps.filter((r) => !ST.mission.stops.some((st) => r.s0 > st.s - 170 && r.s0 < st.s + 30));
  ST.cityEggs = (BASE.eggs || []).filter((e) => e.ev === EV.id && e.place).map((e) => ({ ...e, ...at(e.place, e.d) }));
}
function goStage(id, i = 0) {
  try { localStorage.setItem(STAGE_KEY, id); localStorage.setItem(EVENT_KEY, JSON.stringify({ stage: id, i })); } catch {}
  const u = new URL(location.href); u.searchParams.delete('stage'); u.searchParams.delete('ev');
  if (u.toString() === location.href) location.reload(); else location.href = u.toString();
}

// ---------- tuning ----------
const G = ST.gravity ?? 32;            // m/s², low on the space stages
const ROAD_HALF = ST.roadHalf;
const LANES = ST.lanes;
const GAPS = ST.gaps || [];
const FINISH_S = ST.finish;
const CEILINGS = ST.ceilings || [];
const JUMP_V = 13;
const AIR_FUEL = 1.3;                     // seconds of landing thrust

// ---------- cast ----------
// Display names live here so parody names can replace real ones in one place.
export const CAST = {
  hero: { name: '일론', ava: 'EM', face: 'elon' },
  trump: { name: '도널드 트럼펫', ava: 'DT', face: 'trump' },
};

// ---------- save ----------
const SAVE_KEY = 'roadster-racer-save-v1';
const save = loadSave();
function loadSave() {
  // camp: per event key ('austin:deliver') { done, stars, best, score, play (seconds actually played), tries }
  const base = () => ({ level: 1, xp: 0, doge: 0, best: 0, bests: {}, camp: {}, eggs: {}, ach: {}, play: 0, hp: 100, parts: 3, partsT: Date.now(), up: { magnet: 0, tank: 0, comp: 0, motor: 0, fan: 0, armor: 0, optimus: 0, copilot: 0 } });
  try {
    const s = Object.assign(base(), JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); s.up = Object.assign(base().up, s.up);
    if (s.best && !s.bests.austin) s.bests.austin = s.best; // v1 saves kept one best time (Austin)
    return s;
  }
  catch { return base(); }
}
let saveTimer = 0;
function writeSaveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(writeSave, 800); }
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch {} }
const xpNeed = (lv) => 100 + (lv - 1) * 80;
// ---------- body damage + repair parts ----------
// Hard landings, crashes, boss hits and falls wear the body down (it carries over between runs). The bar has
// three bands like a Terran building: green, yellow (sparks), red (battery fire: it keeps burning down slowly
// and costs top speed). It never stops you finishing. Repairs cost parts: wrench pickups on the track, event
// clears, and one free part every 5 minutes (up to 10). Optimus riding along patches you up to the green line.
const PART_EVERY = 5 * 60 * 1000, PART_MAX = 10, PART_FRAC = 0.25;
const GREEN = 0.6, RED = 0.3;
const hpMax = () => 100 + (save.up.armor || 0) * 20;
const hpF = () => save.hp / hpMax();
const hpZone = () => (hpF() >= GREEN ? 'green' : hpF() >= RED ? 'yellow' : 'red');
function grantParts() {
  const n = Math.floor((Date.now() - (save.partsT || 0)) / PART_EVERY);
  if (save.parts >= PART_MAX) { save.partsT = Date.now(); return 0; }
  if (n > 0) { const add = Math.min(n, PART_MAX - save.parts); save.parts += add; save.partsT += n * PART_EVERY; if (save.parts >= PART_MAX) save.partsT = Date.now(); writeSaveSoon(); return add; }
  return 0;
}
const hpSpeed = () => (hpF() >= RED ? 1 : 0.78 + 0.22 * hpF() / RED);
function repair(withDoge) {
  if (save.hp >= hpMax()) return false;
  if (withDoge) { const cost = 120; if (save.doge < cost) return false; save.doge -= cost; passDoge(); } else { if (save.parts < 1) return false; save.parts--; }
  save.hp = Math.min(hpMax(), save.hp + hpMax() * PART_FRAC); writeSave(); return true;
}
// during a run: the fire burns, Optimus repairs
function stepBody(dt) {
  const z = hpZone(), was = save.hp;
  if (z === 'red' && save.hp > 0) save.hp = Math.max(0, save.hp - 0.55 * dt);
  const opt = save.up.optimus || 0;
  if (opt && hpF() < GREEN) save.hp = Math.min(hpMax() * GREEN, save.hp + (0.35 + 0.35 * opt) * dt);
  if (was > 0 && save.hp <= 0) toast('배터리 전소 직전!', '최고속도 -22% · 개러지에서 수리', '#ff3d6e');
}
// ---------- upgrades (X Garage) ----------
// cost(lv) is the price of the next level; Dogecoin only (soft currency).
const UPGRADES = {
  magnet: { name: '자석', desc: (l) => `끌어당김 범위 ${magnetRange(l).toFixed(1)}m`, max: 8, cost: (l) => Math.round(60 * Math.pow(1.55, l)) },
  tank: { name: '압축공기 탱크', desc: (l) => `점프 최대 +${l}회`, max: 4, cost: (l) => Math.round(180 * Math.pow(1.9, l)) },
  comp: { name: '컴프레서', desc: (l) => `점프 충전 ${(recharge(l) * SLOW).toFixed(1)}초`, max: 5, cost: (l) => Math.round(90 * Math.pow(1.65, l)) },
  motor: { name: '듀얼 모터', desc: (l) => `최고속도 +${l * 4 * 3.6 | 0}km/h`, max: 6, cost: (l) => Math.round(110 * Math.pow(1.6, l)) },
  fan: { name: '흡착 팬 (스페이스X 패키지)', desc: (l) => `코너 접지력 ${(gripLimit(l) / 9.8).toFixed(1)}G · 더 빠르게 꺾어도 안 밀려요`, max: 6, cost: (l) => Math.round(130 * Math.pow(1.65, l)) },
  armor: { name: '배터리 팩 보강', desc: (l) => `최대 내구도 ${100 + l * 20}`, max: 5, cost: (l) => Math.round(150 * Math.pow(1.7, l)) },
  // the AI copilot (user, 2026-10-24): lands the car for you, then shoots for you. Parody of Grok
  copilot: { name: '그럭 AI 부조종사 (그럭저럭 잘함)', desc: (l) => ['알아서 착지·사격까지 해 주는 AI · 레벨 1: 착지 직전 압축공기 자동 분사', '착지 직전 자동 분사로 하드 랜딩 방지 · 다음: 자동 퍼펙트 착지', '자동 퍼펙트 착지 · 다음: 보스전 자동 사격', '자동 퍼펙트 착지 + 보스전·사격 구간 자동 공격'][l], max: 3, cost: (l) => [350, 900, 1800][l] },
  optimus: { name: '옵티머스 동승 정비', desc: (l) => (l ? `옵티머스가 옆자리에서 초당 ${(0.35 + 0.35 * l).toFixed(2)}씩 수리 · 초록 구간까지만` : '옵티머스가 옆자리에 타서 달리는 중에 고쳐 줘요 · 초록 구간까지만'), max: 3, cost: (l) => Math.round(400 * Math.pow(2, l)) },
};
const magnetRange = (l = save.up.magnet) => 3 + l * 1.6 + (save.level - 1) * 0.15;
const recharge = (l = save.up.comp) => 8 - l * 0.9;
// tyre grip: the sideways acceleration (m/s²) the car can hold in a bend before it slides wide. The suction
// fan upgrade pulls the car onto the road and lets it ignore more of the centrifugal force (user, 2026-10-24)
const gripLimit = (l = save.up.fan || 0) => 14 + l * 4;
const maxCharges = () => Math.min(12, 2 + save.level + save.up.tank);

// ---------- track geometry ----------
// Two kinds of track. Old stages give cx(s): a lateral wiggle on a road that runs along -z. Tracks with
// `turns` are laid out by heading instead, so they can take real corners, interchange loops and hairpins:
// turns = [{ s (corner middle), a (radians, + = left), r (radius m) }]. Both end up in the same table.
const cx = ST.cx || (() => 0);
// road height above sea level along the track; every y in track space is measured from it
const elev = ST.elev || (() => 0);
const elevSlope = (s) => elev(s + 0.5) - elev(s - 0.5);
const _f = new THREE.Vector3(), _r = new THREE.Vector3();
const TURNS = ST.turns || null;
// curvature (1/m, + = left) at s
function curvature(s) {
  if (ROUTE) { const T = ROUTE.track, u = Math.min(T.n - 1, Math.max(0, Math.floor(s - T.s0))); return T.hs[u + 1] - T.hs[u]; }
  if (!TURNS) { const d1 = cx(s + 1) - cx(s - 1), d2 = cx(s + 1) - 2 * cx(s) + cx(s - 1); return -d2 / Math.pow(1 + (d1 / 2) ** 2, 1.5); }
  let k = 0; for (const t of TURNS) { const L = Math.abs(t.a) * t.r; if (Math.abs(s - t.s) < L / 2) k += t.a / L; } return k;
}
const TRACK = ROUTE ? ROUTE.track : TURNS && (() => {
  const s0 = -600, n = Math.ceil((ST.finish + 1600 - s0)), xs = new Float64Array(n + 1), zs = new Float64Array(n + 1), hs = new Float64Array(n + 1);
  let x = 0, z = 0, h = 0; // start at the origin facing -z
  // integrate back from 0 to s0 first so s = 0 sits at the origin
  const at = (i) => s0 + i;
  const i0 = -s0;
  xs[i0] = 0; zs[i0] = 0; hs[i0] = 0;
  for (let i = i0 + 1; i <= n; i++) { const sm = at(i) - 0.5; h += curvature(sm); x += -Math.sin(h - curvature(sm) / 2); z += -Math.cos(h - curvature(sm) / 2); xs[i] = x; zs[i] = z; hs[i] = h; }
  x = 0; z = 0; h = 0;
  for (let i = i0 - 1; i >= 0; i--) { const sm = at(i) + 0.5; h -= curvature(sm); x -= -Math.sin(h + curvature(sm) / 2); z -= -Math.cos(h + curvature(sm) / 2); xs[i] = x; zs[i] = z; hs[i] = h; }
  return { s0, n, xs, zs, hs };
})();
function frame(s) {
  if (TRACK) {
    const u = THREE.MathUtils.clamp(s - TRACK.s0, 0, TRACK.n - 1), i = Math.floor(u), t = u - i;
    const h = TRACK.hs[i] + (TRACK.hs[i + 1] - TRACK.hs[i]) * t;
    _f.set(-Math.sin(h), 0, -Math.cos(h)); _r.set(Math.cos(h), 0, -Math.sin(h));
    return { x: TRACK.xs[i] + (TRACK.xs[i + 1] - TRACK.xs[i]) * t, z: TRACK.zs[i] + (TRACK.zs[i + 1] - TRACK.zs[i]) * t, f: _f, r: _r, yaw: h };
  }
  const dx = (cx(s + 0.5) - cx(s - 0.5));
  const L = Math.hypot(dx, 1);
  _f.set(dx / L, 0, -1 / L);
  _r.set(1 / L, 0, dx / L);
  return { x: cx(s), z: -s, f: _f, r: _r, yaw: Math.atan2(-_f.x, -_f.z) };
}
// forks: at a big corner the road splits. The main road takes the corner tight; an exit lane on the outside
// swings wide around it on its own carriageway and merges back after. It is a real, longer road (the car
// covers more ground per metre of track out there), so missing the turn costs time, never the run.
// forks = [{ at: s of a turn, off: widest gap from the main road (m), name }]
const FORK_W = 6, FORK_LEAD = 150, FORK_OPEN = 90;
const smooth01 = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const FORKS = (TURNS ? ST.forks || [] : []).map((f, id) => {
  const t = TURNS.find((u) => u.s === f.at), L = Math.abs(t.a) * t.r, off = f.off ?? 50;
  const s0 = t.s - L / 2 - FORK_LEAD, s1 = t.s + L / 2 + FORK_LEAD;
  const gap = (s) => (s <= s0 || s >= s1 ? 0 : off * Math.min(smooth01((s - s0) / FORK_LEAD), smooth01((s1 - s) / FORK_LEAD)));
  // the exit lane opens 90..60 m before the split and closes 60..90 m after the merge
  const laneW = (s) => 2 * FORK_W * Math.min(smooth01((s - (s0 - FORK_OPEN)) / 30), smooth01((s1 + FORK_OPEN - s) / 30));
  const inner = (s) => ROAD_HALF + gap(s), outer = (s) => inner(s) + laneW(s);
  return { ...f, id, turn: t, side: Math.sign(t.a), s0, s1, a: s0 - FORK_OPEN, b: s1 + FORK_OPEN, off, gap, laneW, inner, outer };
});
const forkAt = (s) => FORKS.find((f) => s > f.a && s < f.b) || null;
// true where (s, d) is taken by a fork's lane, island or verge: scenery stays out
const forkZone = (s, d, pad = 4) => FORKS.some((f) => s > f.a - pad && s < f.b + pad && d * f.side > ROAD_HALF - 1 && d * f.side < ROAD_HALF + f.off + 2 * FORK_W + pad);
// stretches [a, b] of one road side with the forks on that side cut out
function sideRuns(a, b, side) {
  const out = []; let x = a;
  for (const f of FORKS.filter((f) => f.side === side).sort((p, q) => p.a - q.a)) { if (f.b < x || f.a > b) continue; if (f.a > x) out.push([x, f.a]); x = Math.max(x, f.b); }
  if (x < b) out.push([x, b]);
  return out;
}
// on a track that bends back on itself (hairpins, loops) the scenery beside one stretch can sit on another
// stretch's road: anything placed with clearOfRoad() checks every bit of road, not just its own
const roadGrid = TRACK && (() => {
  const g = new Map(), C = 24;
  const put = (x, z) => { const k = `${Math.floor(x / C)},${Math.floor(z / C)}`; (g.get(k) || g.set(k, []).get(k)).push(x, z); };
  for (let s = -300; s < ST.finish + 700; s += 4) { const f = frame(s); put(f.x, f.z); }
  // fork lanes and the island inside them count as road
  for (const fk of FORKS) for (let s = fk.a; s < fk.b; s += 4) for (let d = ROAD_HALF + 8; d < fk.outer(s) + 6; d += 12) { const f = frame(s); put(f.x + f.r.x * d * fk.side, f.z + f.r.z * d * fk.side); }
  return { g, C };
})();
function clearOfRoad(x, z, r) {
  if (!roadGrid) return true;
  const { g, C } = roadGrid, R = ROAD_HALF + 3 + r, n = Math.ceil(R / C);
  const cx0 = Math.floor(x / C), cz0 = Math.floor(z / C);
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
    const pts = g.get(`${cx0 + i},${cz0 + j}`); if (!pts) continue;
    for (let q = 0; q < pts.length; q += 2) if ((pts[q] - x) ** 2 + (pts[q + 1] - z) ** 2 < R * R) return false;
  }
  return true;
}
function world(s, d, y, out = new THREE.Vector3()) {
  const fr = frame(s);
  return out.set(fr.x + fr.r.x * d, y + elev(s), fr.z + fr.r.z * d);
}

// ramps: {s0, len, dL, dR, h}
const RAMPS = ST.ramps;
function rampAt(s, d) {
  for (const r of RAMPS) if (s >= r.s0 && s <= r.s0 + r.len && d >= r.dL && d <= r.dR) return r;
  return null;
}
// the car is ~1.8 m wide: it rides up a ramp if either side is on it.
// With yRef (the car's height) roofs count too: anything you're at or above can be landed on.
function carGround(s, d, yRef) {
  const g = Math.max(groundAt(s, d - 0.8), groundAt(s, d), groundAt(s, d + 0.8));
  if (yRef == null) return g;
  return Math.max(g, roofAt(s, d - 0.7, yRef), roofAt(s, d, yRef), roofAt(s, d + 0.7, yRef));
}
// raised things you can drive along (bridge cables): { s0, s1, y(s), d(s), w(s) half width }
const SURFACES = ST.surfaces || [];
const surfaceAt = (s, d, yRef) => { for (const u of SURFACES) if (s > u.s0 && s < u.s1 && Math.abs(d - u.d(s)) < u.w(s) && yRef >= u.y(s) - 0.7) return u; return null; };
// lateral reach: some stretches (a bridge) let you leave the deck when up high, over open water
const reach = (s, y) => (ST.wide && s > ST.wide.s0 && s < ST.wide.s1 && y > 1.5 ? ST.wide.half : ROAD_HALF - 1.2);
function groundAt(s, d) {
  for (const g of GAPS) if (s > g.s0 && s < g.s1) return -1e9;
  if (ST.wide && s > ST.wide.s0 && s < ST.wide.s1 && Math.abs(d) > ROAD_HALF) return -1e9;
  const r = rampAt(s, d);
  return r ? r.h * (s - r.s0) / r.len : 0;
}
function roofAt(s, d, yRef) {
  let top = -1e9;
  for (const t of traffic) {
    if (Math.abs(t.s - s) > t.hl * 0.92 || Math.abs(t.d - d) > t.hw * 0.85) continue;
    const r = t.y + t.h;
    if (yRef >= r - 0.7 && r > top) top = r;
  }
  for (const c of CEILINGS) if (!c.holes && s > c.s0 && s < c.s1 && yRef >= c.y1 - 0.7 && c.y1 > top) top = c.y1; // overpass decks are floors from above
  for (const u of SURFACES) if (s > u.s0 && s < u.s1 && Math.abs(d - u.d(s)) < u.w(s)) { const y = u.y(s); if (yRef >= y - 0.7 && y > top) top = y; }
  const b = boss?.roofAt?.(s, d, yRef);
  return b != null && b > top ? b : top;
}

// ---------- renderer / scene ----------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !IS_MOBILE, powerPreference: 'high-performance' });
renderer.setPixelRatio(Q.pr);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;

const scene = new THREE.Scene();
const ENV = ST.env;
const FOG = new THREE.Color(ENV.fog[0]);
scene.fog = new THREE.Fog(FOG, ENV.fog[1], ENV.fog[2]);
renderer.toneMappingExposure = ENV.exposure ?? 0.92;
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.3, 3000);

// sky
const SUN_DIR = new THREE.Vector3(...(ENV.sunDir || [-0.35, 0.3, -1])).normalize();
const SKY = ENV.sky || { top: [0.2, 0.36, 0.62], mid: [0.42, 0.56, 0.76], hor: [0.8, 0.78, 0.72], low: [0.5, 0.46, 0.4], glow: [1, 0.9, 0.7] };
const v3 = (a) => `vec3(${a.map((x) => x.toFixed(3)).join(',')})`;
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { sunDir: { value: SUN_DIR } },
  vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
  fragmentShader: `varying vec3 vP; uniform vec3 sunDir;
    void main(){ float h = vP.y;
      vec3 top = ${v3(SKY.top)}, mid = ${v3(SKY.mid)}, hor = ${v3(SKY.hor)}, low = ${v3(SKY.low)};
      vec3 c = h > 0.0 ? mix(hor, mix(mid, top, smoothstep(0.15,0.7,h)), smoothstep(0.0,0.18,h)) : mix(hor*0.6, low, smoothstep(0.0,-0.2,h));
      float sd = max(dot(vP, sunDir), 0.0);
      c += ${v3(SKY.glow)} * pow(sd, 18.0) * 0.9 + vec3(1.0,0.85,0.6) * pow(sd, 900.0) * 6.0;
      gl_FragColor = vec4(c, 1.0); }`,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(2400, 32, 16), skyMat);
scene.add(sky);
{
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), skyMat));
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(envScene, 0.02).texture;
  // real HDRI (CC0, Poly Haven), stored as RGBE bytes in a grayscale PNG; with env.bg it is also the sky
  const img = new Image();
  img.onload = () => {
    try {
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
      const src = g.getImageData(0, 0, c.width, c.height).data, W = c.width / 4, H = c.height;
      const f = new Float32Array(W * H * 4);
      let best = -1, bi = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x, o = ((ENV.envUpsideDown ? y : H - 1 - y) * W + x) * 4; // PNG rows run top-down, texture rows bottom-up
        const e = src[(i * 4 + 3) * 4], k = e ? Math.pow(2, e - 136) : 0;
        const cap = ENV.hdrMax ?? Infinity; // a very hot sun disc overflows the half-float bloom buffers (black frame)
        f[o] = Math.min(cap, src[i * 16] * k); f[o + 1] = Math.min(cap, src[(i * 4 + 1) * 4] * k); f[o + 2] = Math.min(cap, src[(i * 4 + 2) * 4] * k); f[o + 3] = 1;
        const l = f[o] + f[o + 1] + f[o + 2]; if (l > best) { best = l; bi = o / 4; }
      }
      const tex = new THREE.DataTexture(f, W, H, THREE.RGBAFormat, THREE.FloatType);
      tex.mapping = THREE.EquirectangularReflectionMapping; tex.colorSpace = THREE.LinearSRGBColorSpace;
      tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.flipY = false; tex.needsUpdate = true;
      scene.environment = pm.fromEquirectangular(tex).texture;
      if (ENV.bg) {
        // aim the shadow-casting sun at the HDRI's sun
        const u = (bi % W + 0.5) / W, v = (Math.floor(bi / W) + 0.5) / H;
        const phi = (u - 0.5) * Math.PI * 2, el = (v - 0.5) * Math.PI;
        SUN_DIR.set(Math.cos(phi) * Math.cos(el), Math.sin(el), Math.sin(phi) * Math.cos(el));
        scene.background = tex; scene.backgroundIntensity = ENV.bgIntensity ?? 1; sky.visible = false;
      } else tex.dispose();
    } catch (err) { console.warn('HDRI skipped', err); }
  };
  img.src = ENV.hdri;
}

scene.add(new THREE.HemisphereLight(...ENV.hemi));
const sun = new THREE.DirectionalLight(...ENV.sun);
sun.castShadow = true;
sun.shadow.mapSize.set(Q.shadow, Q.shadow);
Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 200 });
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);

// ---------- textures ----------
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}
// ---------- photo textures (CC0: Poly Haven, ambientCG) ----------
const texLoader = new THREE.TextureLoader();
function photo(url, { srgb = true, rep = [1, 1], onload } = {}) {
  const t = texLoader.load('assets/tex/' + url, onload);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 8;
  return t;
}
// lane paint drawn over real asphalt: one canvas tile = the road's width x 24 m
const ROAD = ST.road || {};
function drawRoad(g, w, h, asphalt, R = ROAD, half = ROAD_HALF) {
  const tiles = Math.max(2, Math.round(half / 3));
  if (asphalt) { for (let x = 0; x < tiles; x++) for (let y = 0; y < 4; y++) g.drawImage(asphalt, x * w / tiles, y * h / 4, w / tiles + 1, h / 4 + 1); g.fillStyle = ROAD.tint || 'rgba(20,16,26,0.35)'; g.fillRect(0, 0, w, h); }
  else { g.fillStyle = '#26222b'; g.fillRect(0, 0, w, h); }
  const lw = 0.15 / (half * 2) * w; // 15 cm lines
  const paint = (c, x, y0, ww, hh) => { g.fillStyle = c; g.globalAlpha = 0.88; g.fillRect(x, y0, ww, hh); g.globalAlpha = 1; };
  paint('#e9e4f0', w * 0.012, 0, lw, h); paint('#e9e4f0', w * 0.988 - lw, 0, lw, h);
  for (const u of R.dashes || [0.25, 0.75]) paint('#e9e4f0', w * u - lw / 2, 0, lw, h * 0.4);
  if (R.yellow ?? true) { paint('#ffc83d', w * 0.5 - lw * 1.5, 0, lw, h); paint('#ffc83d', w * 0.5 + lw * 0.5, 0, lw, h); }
}
const roadTex = canvasTex(1024, 1024, (g, w, h) => drawRoad(g, w, h), true);
// fork lanes: two lanes, one dashed line
const BRANCH = { ...ROAD, dashes: [0.5], yellow: false };
const branchTex = FORKS.length ? canvasTex(512, 1024, (g, w, h) => drawRoad(g, w, h, null, BRANCH, FORK_W), true) : null;
photo(`${ROAD.tex || 'asphalt'}_diff.jpg`, { onload: (t) => {
  const c = roadTex.image; drawRoad(c.getContext('2d'), c.width, c.height, t.image); roadTex.needsUpdate = true;
  if (branchTex) { const b = branchTex.image; drawRoad(b.getContext('2d'), b.width, b.height, t.image, BRANCH, FORK_W); branchTex.needsUpdate = true; }
} });
const hazardTex = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#ffc400'; g.fillRect(0, 0, w, h); g.fillStyle = '#141414';
  for (let i = -w; i < w * 2; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 16, 0); g.lineTo(i + 16 - h, h); g.lineTo(i - h, h); g.fill(); }
}, true);
function textTex(text, color, opts = {}) {
  const w = opts.w || 512, h = opts.h || 160;
  return canvasTex(w, h, (g) => {
    g.clearRect(0, 0, w, h);
    if (opts.bg) { g.fillStyle = opts.bg; g.fillRect(0, 0, w, h); }
    g.font = `${opts.weight || 900} ${opts.size || 96}px "Black Han Sans", "Noto Sans KR", sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (opts.frame) { g.strokeStyle = color; g.lineWidth = 8; g.shadowColor = color; g.shadowBlur = 24; g.strokeRect(14, 14, w - 28, h - 28); }
    g.shadowColor = color; g.shadowBlur = opts.glow ?? 28; g.fillStyle = opts.fill || color;
    g.fillText(text, w / 2, h / 2 + 4);
    g.shadowBlur = 0; g.fillText(text, w / 2, h / 2 + 4);
  });
}

// ---------- ribbon builder ----------
function ribbon(s0, s1, dL, dR, step, yFn, uvLen = 0) {
  const segs = Math.max(1, Math.ceil((s1 - s0) / step));
  const pos = [], uv = [], idx = [];
  const v = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const s = s0 + (s1 - s0) * i / segs;
    for (let j = 0; j < 2; j++) {
      const d = j ? (typeof dR === 'function' ? dR(s) : dR) : (typeof dL === 'function' ? dL(s) : dL);
      world(s, d, yFn(s, d), v); pos.push(v.x, v.y, v.z);
      uv.push(j, uvLen ? s / uvLen : i / segs);
    }
    if (i < segs) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}
// vertical wall following the track at lateral d, between y0(s) and y1(s); uv in metres / uvLen
function wall(s0, s1, d, step, y0Fn, y1Fn, uvLen = 1) {
  const segs = Math.max(1, Math.ceil((s1 - s0) / step));
  const pos = [], uv = [], idx = [], v = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const s = s0 + (s1 - s0) * i / segs;
    const a0 = y0Fn(s), a1 = y1Fn(s), dd = typeof d === 'function' ? d(s) : d;
    world(s, dd, a0, v); pos.push(v.x, v.y, v.z); uv.push(s / uvLen, a0 / uvLen);
    world(s, dd, a1, v); pos.push(v.x, v.y, v.z); uv.push(s / uvLen, a1 / uvLen);
    if (i < segs) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}
// terrain sheet over (s, d) with height yFn(s, d); uv in metres / uvLen
function grid(s0, s1, dL, dR, stepS, stepD, yFn, uvLen = 1) {
  const ns = Math.max(1, Math.ceil((s1 - s0) / stepS)), nd = Math.max(1, Math.ceil((dR - dL) / stepD));
  const pos = new Float32Array((ns + 1) * (nd + 1) * 3), uv = new Float32Array((ns + 1) * (nd + 1) * 2), idx = [];
  const v = new THREE.Vector3();
  for (let i = 0; i <= ns; i++) for (let j = 0; j <= nd; j++) {
    const s = s0 + (s1 - s0) * i / ns, d = dL + (dR - dL) * j / nd, o = i * (nd + 1) + j;
    world(s, d, yFn(s, d), v); pos.set([v.x, v.y, v.z], o * 3); uv.set([d / uvLen, s / uvLen], o * 2);
    if (i < ns && j < nd) idx.push(o, o + 1, o + nd + 1, o + 1, o + nd + 2, o + nd + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}
// a flat quad across the track at s (from dL to dR, y0..y1)
function crossWall(s, dL, dR, y0, y1) {
  const a = world(s, dL, y0), b = world(s, dR, y0), c = world(s, dL, y1), e = world(s, dR, y1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, e.x, e.y, e.z], 3));
  geo.setIndex([0, 1, 2, 1, 3, 2]); geo.computeVertexNormals();
  return geo;
}

// ---------- world building ----------
// shared materials, created on first use so a stage only loads the photos it needs
const MATS = {
  road: () => new THREE.MeshStandardMaterial({ map: roadTex, normalMap: photo(`${ROAD.tex || 'asphalt'}_nor.jpg`, { srgb: false, rep: [4, 4] }), normalScale: new THREE.Vector2(0.8, 0.8), roughnessMap: ROAD.tex ? null : photo('asphalt_rough.jpg', { srgb: false, rep: [4, 4] }), roughness: 0.95, metalness: 0.05, envMapIntensity: 1.1 }),
  ground: () => new THREE.MeshStandardMaterial({ map: photo('grass_diff.jpg', { rep: [24, 1] }), color: '#6b5a52', roughness: 0.95 }),
  walk: () => new THREE.MeshStandardMaterial({ map: photo('walk_diff.jpg'), normalMap: photo('walk_nor.jpg', { srgb: false }), color: '#b8aeb4', roughness: 0.85 }),
  concrete: () => new THREE.MeshStandardMaterial({ map: photo('concrete_diff.jpg', { rep: [0.25, 0.25] }), color: '#b0a8ac', roughness: 0.85, side: THREE.DoubleSide }),
  ramp: () => new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.5, metalness: 0.3, side: THREE.DoubleSide }),
  water: () => new THREE.MeshStandardMaterial({ color: '#0f3a52', roughness: 0.06, metalness: 0.4, envMapIntensity: 1.4 }),
  dirt: () => new THREE.MeshStandardMaterial({ color: '#3a2a22', roughness: 1, side: THREE.DoubleSide }),
};
const M = new Proxy({}, { get: (c, k) => (c[k] ??= MATS[k]()) });
const flat0 = () => 0;

function buildWorld() {
  // road, broken by any gaps
  let a = -120;
  if (!ROAD.hide) for (const g of [...GAPS, { s0: FINISH_S + 260 }]) {
    const m = new THREE.Mesh(ribbon(a, g.s0, -ROAD_HALF, ROAD_HALF, 3, flat0, 24), M.road);
    m.receiveShadow = true; scene.add(m); a = g.s1;
  }
  // ramps
  for (const r of RAMPS) {
    const top = new THREE.Mesh(ribbon(r.s0, r.s0 + r.len, r.dL, r.dR, 2, (s) => r.h * (s - r.s0) / r.len, 4), M.ramp);
    top.castShadow = top.receiveShadow = true; scene.add(top);
    for (const d of [r.dL, r.dR]) scene.add(new THREE.Mesh(wall(r.s0, r.s0 + r.len, d, 2, () => 0, (s) => r.h * (s - r.s0) / r.len), M.concrete));
    scene.add(new THREE.Mesh(crossWall(r.s0 + r.len, r.dL, r.dR, 0, r.h), M.concrete));
  }
  // start + finish lines
  const checker = canvasTex(256, 64, (g, w, h) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#f4f4f4'; g.fillRect(x * 16, y * 16, 16, 16); } });
  for (const s of [12, FINISH_S]) scene.add(new THREE.Mesh(ribbon(s, s + 3, -ROAD_HALF, ROAD_HALF, 3, () => 0.02), new THREE.MeshStandardMaterial({ map: checker, roughness: 0.6 })));
  // checkpoint gates: two glowing posts at the road edges
  const postGeo = new THREE.CylinderGeometry(0.16, 0.16, 3.2, 8); postGeo.translate(0, 1.6, 0);
  const postMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 2.4, 3.2), toneMapped: false });
  for (const c of CHECKS) for (const d of [-ROAD_HALF + 0.3, ROAD_HALF - 0.3]) { const m = new THREE.Mesh(postGeo, postMat); world(c, d, 0, m.position); scene.add(m); }
  for (const fk of FORKS) buildFork(fk);
  ST.build(kit);
}
function buildFork(fk) {
  const sd = fk.side, inn = (s) => sd * fk.inner(s), out = (s) => sd * fk.outer(s);
  const [L, R] = sd > 0 ? [inn, out] : [out, inn];
  const mat = M.road.clone(); mat.map = branchTex; mat.side = THREE.DoubleSide;
  const lane = new THREE.Mesh(ribbon(fk.a, fk.b, L, R, 2, () => 0.004, 24), mat);
  lane.receiveShadow = true; scene.add(lane);
  // the island between the carriageways, with kerbs on both sides and along the outer edge
  const isl = (s) => sd * (ROAD_HALF + 0.05), isr = (s) => sd * (fk.inner(s) - 0.05);
  const [IL, IR] = sd > 0 ? [isl, isr] : [isr, isl];
  const island = new THREE.Mesh(ribbon(fk.s0 + 6, fk.s1 - 6, IL, IR, 3, () => 0.14, 8), M.walk); island.receiveShadow = true; scene.add(island);
  const grass = new THREE.MeshStandardMaterial({ color: '#4c5b34', roughness: 1 });
  const gl = (s) => sd * (ROAD_HALF + Math.min(1.6, fk.gap(s) / 2)), gr = (s) => sd * (fk.inner(s) - Math.min(1.6, fk.gap(s) / 2));
  scene.add(new THREE.Mesh(ribbon(fk.s0 + 12, fk.s1 - 12, sd > 0 ? gl : gr, sd > 0 ? gr : gl, 3, () => 0.16, 8), grass));
  for (const [d, a, b] of [[(s) => sd * (ROAD_HALF + 0.15), fk.s0 + 4, fk.s1 - 4], [(s) => sd * (fk.inner(s) - 0.15), fk.s0 + 4, fk.s1 - 4], [(s) => sd * (fk.outer(s) + 0.2), fk.a + 20, fk.b - 20]]) scene.add(new THREE.Mesh(wall(a, b, d, 2, () => 0, () => 0.55, 2), M.concrete));
  // lamps on the island side of the long way round (the outside is where the chase camera swings), so it reads as a real road at night
  const lampAt = []; for (let s = fk.s0 + 20; s < fk.s1 - 20; s += 28) if (fk.gap(s) > 5) lampAt.push(s);
  const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.16, 7, 6).translate(0, 3.5, 0), M.concrete, lampAt.length);
  const bulb = new THREE.InstancedMesh(new THREE.SphereGeometry(0.38, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.4, 1.5), toneMapped: false }), lampAt.length);
  const m4 = new THREE.Matrix4(), v = new THREE.Vector3();
  lampAt.forEach((s, i) => { world(s, sd * (fk.inner(s) - 1.1), 0.15, v); m4.makeTranslation(v.x, v.y, v.z); pole.setMatrixAt(i, m4); world(s, sd * (fk.inner(s) + 0.3), 7, v); m4.makeTranslation(v.x, v.y, v.z); bulb.setMatrixAt(i, m4); });
  scene.add(pole, bulb);
  // gore point: hazard chevrons where the lanes part and meet
  for (const s of [fk.s0 + 3, fk.s1 - 3]) { const g = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 0.3), M.ramp); world(s, sd * (ROAD_HALF + 0.8), 0.55, g.position); g.rotation.y = frame(s).yaw; g.castShadow = true; scene.add(g); }
  // overhead signs: the main road is the turn, the exit lane is the long way round
  const t = fk.turn, word = t.a > 0 ? '좌회전' : '우회전';
  const signAt = (s, d, text, bg) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.4), new THREE.MeshBasicMaterial({ map: textTex(text, '#ffffff', { w: 1024, h: 270, size: 92, bg, glow: 4 }), side: THREE.DoubleSide, toneMapped: false }));
    m.material.color.setScalar(1.15); world(s, d, 7.4, m.position); m.lookAt(world(s - 40, d, 7.4)); scene.add(m);
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.4, 7.6, 0.4), M.concrete); world(s + 0.3, d + 4.8 * (d > 0 ? 1 : -1), 3.8, pole.position); scene.add(pole);
  };
  signAt(fk.a + 10, sd * -4, `${t.a > 0 ? '↰' : '↱'} ${fk.name || word}`, '#0b5a2a');
  signAt(fk.a + 10, sd * (ROAD_HALF + FORK_W), `${t.a > 0 ? '↗' : '↖'} 우회로 · 합류`, '#5a4a0b');
}
// the real city around the route: a ground sheet, the lake and parks, and every building within a few
// blocks at its real footprint and height (the ones that would stand on the track are left out)
function buildCity() {
  const ext = CITY.meta.extent, W = (ext.x[1] - ext.x[0]) * 1.6, D = (ext.z[1] - ext.z[0]) * 1.6;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: photo('walk_diff.jpg', { rep: [W / 6, D / 6] }), color: '#6d6670', roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.08; ground.receiveShadow = true; scene.add(ground);
  const water = new THREE.Mesh(cityPolys(CITY.water, -0.03), M.water); scene.add(water);
  const green = new THREE.Mesh(cityPolys(CITY.green, -0.05), new THREE.MeshStandardMaterial({ map: photo('grass_diff.jpg', { rep: [1 / 8, 1 / 8] }), color: '#7f8f62', roughness: 1 }));
  green.receiveShadow = true; scene.add(green);
  // route samples every 8 m on a coarse grid: "near" = within 300 m of the road you drive
  const C = 100, near = new Set();
  for (let s = -200; s < FINISH_S + 300; s += 8) { const f = frame(s); for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) near.add(`${Math.floor(f.x / C) + i},${Math.floor(f.z / C) + j}`); }
  const blds = cityBuildings(CITY, (x, z) => near.has(`${Math.floor(x / C)},${Math.floor(z / C)}`), (x, z) => clearOfRoad(x, z, -1.2),
    (h, b) => (h > 60 ? 0 : h > 28 ? 1 : (Math.abs(b[4][0] * 3.1) | 0) % 2 ? 2 : 3));
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  for (const { kind, geo } of blds) {
    const inst = new THREE.InstancedMesh(geo, facadeMat(FACADES[kind]), 1);
    inst.setMatrixAt(0, m4.identity()); inst.setColorAt(0, col.setHSL(FACADES[kind].hue, 0.1, 0.5));
    inst.receiveShadow = true; inst.frustumCulled = false; scene.add(inst);
  }
  stats.cityBuildings = blds.length;
}
function finishArch(text) {
  const archMat = new THREE.MeshStandardMaterial({ color: '#1a1a22', metalness: 0.8, roughness: 0.3 });
  const half = ROAD_HALF + 1.5;
  for (const d of [-half, half]) { const p = new THREE.Mesh(new THREE.BoxGeometry(1.2, 10, 1.2), archMat); world(FINISH_S, d, 5, p.position); p.rotation.y = frame(FINISH_S).yaw; scene.add(p); }
  const ban = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 + 1, 3.2), new THREE.MeshBasicMaterial({ map: textTex(text, '#38f5ff', { w: 1024, h: 120, size: 70, bg: '#0b0716' }), toneMapped: false, side: THREE.DoubleSide }));
  ban.material.color.setScalar(1.6); world(FINISH_S, 0, 9.4, ban.position); ban.lookAt(world(FINISH_S - 50, 0, 9.4)); scene.add(ban);
}

function addBillboard(s, d, y, text, color, w = 8, h = 2.6) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: textTex(text, color, { frame: true, size: 84 }), transparent: true, side: THREE.DoubleSide, toneMapped: false }));
  m.material.color.setScalar(1.8);
  world(s, d, y, m.position);
  m.lookAt(world(s - 60, 0, y));
  scene.add(m);
  // posts
  for (const o of [-w / 3, w / 3]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.25, y, 0.25), M.concrete);
    world(s, d + o * 0.2, y / 2 - h / 2, p.position); scene.add(p);
  }
  return m;
}

// tile = metres covered by one texture repeat, grid = window cells per tile (for lighting random windows)
const FACADES = [
  { name: '006', tile: [28, 28], grid: [12, 8], mask: 'dark', lit: 0.3, metal: 0.55, rough: 0.18, hue: 0.55 },
  { name: '009', tile: [30, 30], emi: true, metal: 0.5, rough: 0.2, hue: 0.6 },
  { name: '018A', tile: [24, 24], grid: [8, 8], mask: 'blue', lit: 0, metal: 0.1, rough: 0.8, hue: 0.03 },
  { name: '020A', tile: [26, 30], grid: [8, 9], mask: 'blue', lit: 0, metal: 0.1, rough: 0.75, hue: 0.08 },
];
function facadeMat(f) {
  const mat = new THREE.MeshStandardMaterial({
    map: photo(`fac${f.name}_col.jpg`), normalMap: photo(`fac${f.name}_nor.jpg`, { srgb: false }),
    metalness: f.metal, roughness: f.rough, envMapIntensity: 1.2,
    emissive: '#ffffff', emissiveIntensity: 1, emissiveMap: f.emi ? photo(`fac${f.name}_emi.jpg`) : null,
  });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.tile = { value: new THREE.Vector2(...f.tile) };
    sh.uniforms.grid = { value: new THREE.Vector2(...(f.grid || [1, 1])) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec2 tile; varying float vRoof; varying vec2 vSeed;')
      .replace('#include <uv_vertex>', `#include <uv_vertex>
        float lx = length(instanceMatrix[0].xyz), ly = length(instanceMatrix[1].xyz), lz = length(instanceMatrix[2].xyz);
        vec2 fsc = abs(normal.x) > 0.5 ? vec2(lz, ly) : abs(normal.z) > 0.5 ? vec2(lx, ly) : vec2(lx, lz);
        vec2 fuv = uv * fsc / tile; vRoof = abs(normal.y);
        vSeed = instanceMatrix[3].xz;
        vMapUv = fuv; vNormalMapUv = fuv;${f.emi ? ' vEmissiveMapUv = fuv;' : ''}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec2 grid; varying float vRoof; varying vec2 vSeed;\nfloat fhash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }')
      .replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb *= mix(1.0, 0.18, vRoof);')
      .replace('#include <emissivemap_fragment>', f.emi ? '#include <emissivemap_fragment>\n totalEmissiveRadiance *= 0.9 * (1.0 - vRoof);' : `
        vec3 fc = texture2D(map, vMapUv).rgb;
        float win = ${f.mask === 'dark' ? '1.0 - smoothstep(0.28, 0.42, dot(fc, vec3(0.33)))' : 'smoothstep(0.02, 0.09, fc.b - fc.r) * (1.0 - smoothstep(0.35, 0.5, dot(fc, vec3(0.33))))'};
        vec2 cell = floor(vMapUv * grid);
        float hh = fhash(cell + floor(vSeed));
        float lit = step(${(1 - f.lit).toFixed(2)}, hh) * (1.0 - vRoof);
        totalEmissiveRadiance = mix(vec3(1.0, 0.72, 0.42), vec3(0.62, 0.9, 1.0), step(0.85, fract(hh * 7.3))) * win * lit * (0.35 + 0.4 * fract(hh * 13.1));`);
  };
  return mat;
}
// buildings: kinds[k] = list of { s, d, h, dp, w, y? } boxes drawn with FACADES[k]
function placeBuildings(kinds) {
  const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
  if (roadGrid) kinds = kinds.map((list) => list.filter((b) => { world(b.s, b.d, 0, p); return clearOfRoad(p.x, p.z, Math.max(b.w, b.dp) * 0.55); }));
  kinds.forEach((list, k) => {
    if (!list.length) return;
    const inst = new THREE.InstancedMesh(geo, facadeMat(FACADES[k]), list.length);
    list.forEach((b, i) => {
      world(b.s, b.d, b.y || 0, p); q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, frame(b.s).yaw);
      sc.set(b.dp, b.h, b.w); m4.compose(p, q, sc); inst.setMatrixAt(i, m4);
      inst.setColorAt(i, col.setHSL(FACADES[k].hue + (Math.random() - 0.5) * 0.04, 0.1, 0.42 + Math.random() * 0.16));
    });
    inst.receiveShadow = true;
    scene.add(inst);
  });
}
const kit = { ST, CITY, ROUTE, buildCity: () => buildCity(), clearOfRoad, forkZone, sideRuns, FORKS, curvature, THREE, scene, sky, prop, Q, IS_MOBILE, M, world, frame, elev, ribbon, wall, crossWall, grid, photo, canvasTex, textTex, addBillboard, FACADES, facadeMat, placeBuildings, finishArch };

// ---------- vehicles ----------
// ---------- pickups ----------
const PICK = {
  coin: { r: 1.4 },
  gpu: { r: 1.6, xp: 10, label: 'RTX 5090 +10 EXP' },
  h100: { r: 1.8, xp: 50, label: 'H100 +50 EXP' },
  legend: { r: 2.2, xp: 200, label: '전설의 블랙웰 칩 +200 EXP' },
  air: { r: 1.6 },
  wrench: { r: 1.8 },
  egg: { r: 2.2 },
};
const pickupProtos = (() => {
  const coinFace = textTex('Ð', '#6b4300', { w: 128, h: 128, size: 100, glow: 0, bg: '#ffc83d' });
  const gold = new THREE.MeshStandardMaterial({ color: '#ffc83d', metalness: 1, roughness: 0.25, emissive: '#a86a00', emissiveIntensity: 0.6 });
  const face = new THREE.MeshStandardMaterial({ map: coinFace, metalness: 0.8, roughness: 0.3, emissive: '#7a4a00', emissiveIntensity: 0.5 });
  const cg = new THREE.CylinderGeometry(0.7, 0.7, 0.14, 28); cg.rotateX(Math.PI / 2);
  const coin = new THREE.Mesh(cg, [gold, face, face]);

  const gpu = makeRTX5090(), h100 = makeH100(), legend = makeBlackwell();
  const air = new THREE.Group();
  air.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.9, 6, 14), new THREE.MeshPhysicalMaterial({ color: '#2b7cff', metalness: 0.6, roughness: 0.2, clearcoat: 1 })));
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.06, 6, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.6, 3.4), toneMapped: false })); band.rotation.x = Math.PI / 2; air.add(band);
  // repair part: an orange wrench in a soft halo
  const wrench = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: '#ff8a2a', metalness: 0.8, roughness: 0.3, emissive: '#a84300', emissiveIntensity: 0.6 });
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.26, 1.3, 0.12), steel); wrench.add(shaft);
  for (const y of [-0.75, 0.75]) { const head = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.1, 8, 16, Math.PI * 1.5), steel); head.position.y = y; head.rotation.z = y > 0 ? -Math.PI * 0.25 : Math.PI * 0.75; wrench.add(head); }
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.05, 6, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.4, 0.3), toneMapped: false })); wrench.add(halo);
  wrench.rotation.z = 0.5;
  // easter egg: a slowly turning purple-gold crystal with a halo; one of a kind per spot
  const egg = new THREE.Group();
  egg.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.85, 0), new THREE.MeshPhysicalMaterial({ color: '#c79bff', metalness: 0.3, roughness: 0.08, transmission: 0.4, thickness: 0.6, emissive: '#6a2cff', emissiveIntensity: 0.9, clearcoat: 1 })));
  const eh = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.05, 6, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.8, 0.4), toneMapped: false })); eh.rotation.x = Math.PI / 2; egg.add(eh);
  return { coin, gpu, h100, legend, air, wrench, egg };
})();

// ---------- particles ----------
const puffs = [];
{
  const geo = new THREE.SphereGeometry(0.5, 8, 6);
  for (let i = 0; i < 140; i++) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#e8f6ff', transparent: true, opacity: 0, depthWrite: false }));
    m.visible = false; scene.add(m); puffs.push({ m, life: 0, vel: new THREE.Vector3() });
  }
}
let puffIdx = 0;
function puff(pos, vel, color = '#e8f6ff', size = 1, life = 0.6) {
  const p = puffs[puffIdx++ % puffs.length];
  p.m.position.copy(pos); p.vel.copy(vel); p.life = p.max = life; p.size = size;
  p.m.material.color.set(color); p.m.visible = true;
}
function updatePuffs(dt) {
  for (const p of puffs) {
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) { p.m.visible = false; continue; }
    const k = p.life / p.max;
    p.m.position.addScaledVector(p.vel, dt); p.vel.multiplyScalar(1 - 2.5 * dt);
    p.m.scale.setScalar(p.size * (1.6 - k));
    p.m.material.opacity = 0.7 * k;
  }
}

// ---------- game state ----------
const car = makeRoadster(); scene.add(car); kit.car = car;
// SpaceX-package cold-gas thrusters behind the rear plate: two expanding nitrogen plumes, white with a cold
// blue core, flickering. Fired by the launch (0-100 in ~1.1 s) and by the boost.
const coldGas = (() => {
  const g = new THREE.Group(); g.name = 'coldgas';
  const mat = (col, k) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
    uniforms: { amt: { value: 0 }, time: { value: 0 }, col: { value: new THREE.Color(...col) } },
    vertexShader: 'varying vec2 vUv; varying vec3 vN, vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: `uniform float amt, time; uniform vec3 col; varying vec2 vUv; varying vec3 vN, vV;
      void main(){ float along = vUv.y; // 1 at the nozzle, 0 at the far end
        float edge = pow(abs(dot(vN, vV)), ${k.toFixed(1)});
        float ripple = 0.75 + 0.25 * sin(along * 38.0 - time * 70.0) * sin(vUv.x * 25.0 + time * 31.0);
        float a = amt * pow(along, 1.6) * edge * ripple;
        gl_FragColor = vec4(col * a, a); }`,
  });
  const outer = mat([1.6, 1.9, 2.2], 0.8), core = mat([1.4, 2.8, 4.2], 2.0);
  const cone = (r, h) => { const c = new THREE.ConeGeometry(r, h, 20, 1, true); c.rotateX(-Math.PI / 2); c.translate(0, 0, h / 2); return c; };
  for (const x of [-0.3, 0.3]) {
    const o = new THREE.Mesh(cone(0.5, 3.4), outer), c = new THREE.Mesh(cone(0.19, 1.9), core);
    for (const m of [o, c]) { m.position.set(x, 0.48, 2.12); m.frustumCulled = false; m.renderOrder = 3; g.add(m); }
  }
  g.userData = { outer, core, amt: 0 };
  return g;
})();
function updateColdGas(dt, time) {
  if (state === 'race') {
    const z = hpZone();
    if (z === 'red') { // battery fire under the floor: flames, then thick smoke
      const at = () => world(P.s + 0.4 + Math.random() * 1.6, P.d + (Math.random() - 0.5) * 1.4, P.y + 0.35);
      if (Math.random() < 0.8) puff(at(), new THREE.Vector3((Math.random() - 0.5) * 2, 4 + Math.random() * 2, (Math.random() - 0.5) * 2), Math.random() < 0.5 ? '#ff7a1a' : '#ffc23d', 0.55, 0.35);
      if (Math.random() < 0.5) puff(at(), new THREE.Vector3((Math.random() - 0.5) * 2, 3.5, (Math.random() - 0.5) * 2), '#2a2a2e', 1.1, 1.1);
    } else if (z === 'yellow' && Math.random() < 0.12) puff(world(P.s + (Math.random() - 0.5) * 3, P.d + (Math.random() < 0.5 ? -1 : 1) * 0.9, P.y + 0.3), new THREE.Vector3((Math.random() - 0.5) * 6, 3 + Math.random() * 3, (Math.random() - 0.5) * 6), '#fff2a8', 0.18, 0.3);
  }
  const on = state === 'race' && (P.launchT > 0 || P.boostT > 0);
  const u = coldGas.userData; u.amt += ((on ? 1 : 0) - u.amt) * Math.min(1, dt * (on ? 18 : 6));
  coldGas.visible = u.amt > 0.02;
  for (const m of [u.outer, u.core]) { m.uniforms.amt.value = u.amt * (0.85 + Math.random() * 0.15); m.uniforms.time.value = time; }
  coldGas.scale.set(1, 1, 0.8 + u.amt * 0.35 + Math.random() * 0.08);
  // condensation: the expanding gas chills the air into a short white trail
  if (on && Math.random() < 0.7) {
    const fr = frame(P.s), base = world(P.s - 2.6, P.d + (Math.random() - 0.5) * 0.7, P.y + 0.45);
    puff(base, new THREE.Vector3(-fr.f.x * 6 + (Math.random() - 0.5) * 3, 0.6 + Math.random(), -fr.f.z * 6 + (Math.random() - 0.5) * 3), '#eef8ff', 0.45, 0.4);
  }
}
const magnetRing = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 1.6, 2.2), transparent: true, opacity: 0.22, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
magnetRing.rotation.x = -Math.PI / 2; scene.add(magnetRing);
const P = {};
let boss = null;
let traffic = [], pickups = [], state = 'loading', raceT = 0, countdown = 0, penalty = 0;
const stats = { perfect: 0, coins: 0, xpGain: 0, dogeGain: 0, jumpsOver: 0 };
const radioQueue = [];
const radioFlags = new Set();

function resetRace() {
  Object.assign(P, { s: 0, d: 3, y: 0, v: 0, vy: 0, grounded: true, charges: maxCharges(), recharge: 0, fuel: AIR_FUEL, slope: 0, air: 0, boostT: 0, boostG: 30, crashT: 0, shake: 0, steerVis: 0, roll: 0, rollTo: 0, rollDir: 1, finished: false, coil: 0, bonkT: 0, roofRun: 0, lastG: 0, kG: 0, slipT: 0, slipV: 0, heat: 0, overheat: 0, launchT: 0, t100: 0, cp: 0, cpI: 0, combo: 0, comboT: 0, comboBest: 0, score: 0, lastThrust: -9, nearMiss: 0 });
  boss?.reset(); for (const sh of gunShots) sh.m.visible = sh.live = false;
  raceT = 0; penalty = 0; swarmDone = false;
  Object.assign(stats, { perfect: 0, good: 0, coins: 0, xpGain: 0, dogeGain: 0, jumpsOver: 0, roofs: 0, nearMiss: 0, crashes: 0, falls: 0, damage: 0, parts: 0, detours: 0, lines: 0, eggs: 0 });
  radioFlags.clear(); radioQueue.length = 0;
  for (const t of traffic) if (t.mesh) scene.remove(t.mesh);
  for (const f of jamFleets) scene.remove(f);
  for (const p of pickups) scene.remove(p.mesh);
  PUDDLES.length = 0; PUDDLES.push(...(ST.puddles || []));
  spawnTraffic(); spawnPickups();
  missionObjs.forEach((o) => scene.remove(o)); missionObjs.length = 0;
  mission = createMission(MISSION, missionCtx);
}
// who's on the road: real car models where they loaded, procedural stand-ins otherwise
const TRAFFIC = ST.traffic;
const trafficProtos = {};
const lodProtos = {}; // simplified copies for parked jams
const propsReady = loadProps(ST.props || []);
const HEAD_LIST = [...new Set(['elon', ...(ST.heads || [])])];
const headsReady = loadHeads(HEAD_LIST);
const FACES = {}; // speaker/boss key -> portrait data URL
const trafficReady = Promise.all(Object.entries(TRAFFIC).map(async ([k, d]) => {
  await propsReady;
  try { const pr = d.make ? d.make() : await loadCar(d.car); trafficProtos[k] = d.kit ? addSensorKit(pr) : pr; }
  catch (e) { console.warn('traffic model failed, using stand-in', k, e); }
  if (ST.jams && ST.jamMix?.[k]) try { const pr = await loadCar(d.car, true); lodProtos[k] = d.kit ? addSensorKit(pr) : pr; } catch { lodProtos[k] = trafficProtos[k]; }
}));
const JAMS = ST.jams || [];
const inJam = (s, pad = 5) => JAMS.some(([a, b]) => s > a - pad && s < b + pad);
const randLane = (type) => { const l = (type && TRAFFIC[type].lanes) || LANES; return l[(Math.random() * l.length) | 0]; };
const TRAFFIC_MAX_S = ST.trafficMaxS ?? FINISH_S + 200;
let jamFleets = [], swarmDone = false;
let standIns = null;
function trafficMesh(type, color) {
  const d = TRAFFIC[type];
  if (trafficProtos[type]) return instance(trafficProtos[type], color ?? d.color);
  standIns ??= { w: makeWaymo(), c: makeCybercab() };
  const pr = d.brakes ? standIns.w : standIns.c;
  const mesh = pr.clone();
  const tail = pr.userData.tail.clone();
  mesh.traverse((o) => { if (o.name === 'tail') o.material = tail; });
  mesh.userData = { tail, pivot: mesh.getObjectByName('pivot'), wheels: [], size: new THREE.Vector3(2.1, 1.6, 4.7) };
  return mesh;
}
// one car on the road; opts: { v, parked, temp, copy, color, name }
function addTraffic(type, s, d, opts = {}) {
  const def = TRAFFIC[type];
  const mesh = opts.parked ? null : trafficMesh(type, opts.color);
  const sz = mesh ? mesh.userData.size : trafficProtos[type].userData.size;
  const base = opts.v ?? def.speed[0] + Math.random() * (def.speed[1] - def.speed[0]);
  const t = { type, name: opts.name || def.name, brakes: !!def.brakes && !opts.parked, hl: sz.z / 2, hw: sz.x / 2, h: Math.min(sz.y, 3.6), s, d, dT: d, y: 0, base, v: opts.parked ? 0 : base, brakeT: 0, cool: 0, over: false, mesh, parked: !!opts.parked, temp: !!opts.temp, copy: !!opts.copy, copyT: 0, signals: !!def.signal && !opts.parked };
  if (mesh) scene.add(mesh);
  if (t.signals && mesh) addBlinkers(t);
  traffic.push(t);
  return t;
}
function spawnTraffic() {
  traffic = []; jamFleets = [];
  const roster = Object.entries(TRAFFIC).flatMap(([k, d]) => Array(d.n).fill(k));
  for (let i = roster.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [roster[i], roster[j]] = [roster[j], roster[i]]; }
  roster.forEach((type, i) => {
    let s = 180 + i * 85 + Math.random() * 40;
    if (s > TRAFFIC_MAX_S - 30) s -= 900;
    for (const [a, b] of JAMS) if (s > a - 40 && s < b + 5) s = b + 20 + Math.random() * 40;
    const rg = TRAFFIC[type].range; if (rg) s = rg[0] + Math.random() * (rg[1] - rg[0]);
    addTraffic(type, s, randLane(type));
  });
  // parked jams: every lane bumper to bumper, a few holes; drawn as instanced fleets
  const mix = Object.entries(ST.jamMix || {}).filter(([k]) => trafficProtos[k]);
  const total = mix.reduce((a, [, w]) => a + w, 0);
  const pick = () => { let r = Math.random() * total; for (const [k, w] of mix) if ((r -= w) <= 0) return k; return mix[0][0]; };
  const byType = {};
  if (mix.length) JAMS.forEach(([a, b], ji) => { for (const d of LANES) {
    let s = a + Math.random() * 4;
    while (s < b) {
      if (Math.random() < 0.05) { s += 10; continue; }
      const type = pick(), hl = trafficProtos[type].userData.size.z / 2;
      const t = addTraffic(type, s + hl, d + (Math.random() - 0.5) * 0.6, { parked: true });
      (byType[ji + ':' + type] ??= []).push(t);
      s += hl * 2 + 1.6 + Math.random() * 1.6;
    }
  } });
  const q = new THREE.Quaternion(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const blobs = [];
  for (const [key, list] of Object.entries(byType)) {
    const [ji, type] = key.split(':');
    const f = fleet(lodProtos[type] || trafficProtos[type], list.map((t) => ({ m: new THREE.Matrix4().compose(world(t.s, t.d, 0, p), q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, frame(t.s).yaw + (Math.random() - 0.5) * 0.06), one), color: TRAFFIC[type].color })));
    f.traverse((o) => { o.castShadow = false; });
    f.userData.jam = JAMS[+ji]; scene.add(f); jamFleets.push(f);
    blobs.push(...list);
  }
  // contact shadows under the parked cars (they don't cast real ones: too many triangles)
  if (blobs.length) {
    const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
    const im = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ map: blobShadowTex(), transparent: true, depthWrite: false, opacity: 0.85 }), blobs.length);
    const sc = new THREE.Vector3();
    blobs.forEach((t, i) => { im.setMatrixAt(i, new THREE.Matrix4().compose(world(t.s, t.d, 0.03, p), q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, frame(t.s).yaw), sc.set(t.hw * 2.5, 1, t.hl * 2.3))); });
    im.renderOrder = -1; scene.add(im); jamFleets.push(im);
  }
}
// copycats: identical clones that steer into your lane
function spawnSwarm() {
  const sw = ST.swarm; swarmDone = true;
  if (!trafficProtos[sw.type]) return;
  for (let i = 0; i < sw.n; i++) addTraffic(sw.type, P.s + 80 + i * 18 + Math.random() * 8, randLane(), { v: Math.max(24, P.v * 0.72), temp: true, copy: true, color: sw.color, name: sw.name });
  toast(sw.name.toUpperCase(), '똑같이 생긴 차가 우르르!', '#ff6a1a');
}
function addPickup(type, s, d, y) {
  const mesh = pickupProtos[type].clone();
  mesh.userData.fans = []; mesh.traverse((o) => { if (o.name === 'rotor') mesh.userData.fans.push(o); });
  scene.add(mesh); pickups.push({ type, s, d, y, mesh, taken: false, phase: Math.random() * 6 });
}
const nearGap = (s) => GAPS.some((g) => s > g.s0 - 30 && s < g.s1 + 10);
function spawnPickups() {
  pickups = [];
  // coin lines (up on the roofs through a jam)
  for (let s = 90; s < FINISH_S - 40; s += 70 + Math.random() * 50) {
    if (nearGap(s)) continue;
    const d = randLane(), n = 5 + ((Math.random() * 4) | 0);
    for (let i = 0; i < n; i++) addPickup('coin', s + i * 5, d, 1.1 + groundAt(s + i * 5, d) + (inJam(s + i * 5, 0) ? 1.7 : 0));
  }
  // GPUs scattered
  for (let s = 150; s < FINISH_S - 40; s += 55 + Math.random() * 45) {
    if (nearGap(s)) continue;
    addPickup('gpu', s, randLane() + (Math.random() - 0.5) * 2, 1.2 + (inJam(s, 0) ? 1.7 : 0));
  }
  // H100 above ramp flight paths, air tanks before ramps
  for (const r of RAMPS) {
    const d = (r.dL + r.dR) / 2;
    if (r.dR - r.dL < 20) addPickup('h100', r.s0 + r.len + 18, d, r.h + 2.2);
    addPickup('air', r.s0 - 45, d, 1.2);
  }
  // repair parts, a few per track, in an outside lane
  for (let s = 700; s < FINISH_S - 200; s += 1100 + Math.random() * 300) if (!nearGap(s)) addPickup('wrench', s, LANES[Math.random() < 0.5 ? 0 : LANES.length - 1], 1.3);
  if (ST.legend) addPickup('legend', ST.legend.s, ST.legend.d, ST.legend.y);   // only reachable with ramp + jump
  for (const [type, ps, pd, py] of ST.pickups || []) addPickup(type, ps, pd, py);
  // easter eggs for this event that haven't been found yet
  for (const e0 of [...(BASE.eggs || []).filter((e) => !e.place), ...(ST.cityEggs || [])]) {
    if (e0.ev !== EV.id || save.eggs[e0.id]) continue;
    const fk = e0.fork != null ? FORKS[e0.fork] : null; if (e0.fork != null && !fk) continue;
    // an egg on a fork sits in the middle of the long way round
    const e = fk ? { ...e0, s: fk.turn.s, d: fk.side * (ROAD_HALF + fk.off + FORK_W) } : e0;
    addPickup('egg', e.s, e.d, e.y ?? 1.4); pickups[pickups.length - 1].egg = e;
  }
  // coin arcs over gaps
  for (const g of GAPS) for (let i = 0; i < 9; i++) { const s = g.s0 - 4 + i * 5.2, x = (s - (g.s0 - 4)) / 42; addPickup('coin', s, 0, 3 + 7 * Math.sin(Math.PI * x)); }
}

// ---------- input ----------
const input = { left: false, right: false, jump: false, brake: false, boost: false, fire: false, gas: false, stickGas: false, stickBrake: false, jumpEdge: false, fireEdge: false };
const KEYMAP = { KeyF: 'fire', KeyE: 'fire', Enter: 'fire', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'jump', ArrowUp: 'gas', KeyW: 'gas', ArrowDown: 'brake', KeyS: 'brake', ShiftLeft: 'boost', ShiftRight: 'boost', KeyB: 'boost' };
addEventListener('keydown', (e) => {
  if (boss?.inCut && !e.repeat && e.code !== 'Escape' && e.code !== 'KeyP') { e.preventDefault(); boss.skipCut(); return; }
  const k = KEYMAP[e.code]; if (!k) return;
  e.preventDefault();
  if (k === 'jump' && !input.jump) input.jumpEdge = true;
  if (k === 'fire' && !input.fire) input.fireEdge = true;
  input[k] = true;
});
addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) input[k] = false; });
for (const btn of document.querySelectorAll('[data-key]')) {
  const k = btn.dataset.key;
  const on = (e) => { e.preventDefault(); haptic(k === 'jump' ? 'jump' : 'tap'); if (k === 'jump' && !input.jump) input.jumpEdge = true; if (k === 'fire' && !input.fire) input.fireEdge = true; input[k] = true; btn.classList.add('down'); };
  const off = (e) => { e.preventDefault(); input[k] = false; btn.classList.remove('down'); };
  btn.addEventListener('pointerdown', on); btn.addEventListener('pointerup', off);
  btn.addEventListener('pointercancel', off); btn.addEventListener('pointerleave', off);
}
document.body.classList.toggle('touch', IS_MOBILE);
// touch steering: a floating analog stick. The base jumps to where the thumb lands; the knob's sideways
// offset (with a small dead zone and a soft curve) is the steering amount, -1..1.
input.axis = 0;
{
  const zone = document.getElementById('stickZone'), stick = document.getElementById('stick'), knob = document.getElementById('knob');
  const R = 52; let id = null, ox = 0, oy = 0;
  const home = () => { stick.style.left = stick.style.top = stick.style.bottom = ''; };
  const move = (e) => {
    let dx = e.clientX - ox, dy = e.clientY - oy; const len = Math.hypot(dx, dy);
    if (len > R) { dx *= R / len; dy *= R / len; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const a = dx / R, dead = 0.08, m = Math.max(0, Math.abs(a) - dead) / (1 - dead);
    input.axis = Math.sign(a) * Math.pow(m, 1.35);
    // a 2D stick: forward is the throttle (proportional), back brakes and then reverses; let go to coast
    const fwd = -dy / R;
    input.stickBrake = fwd < -0.35; input.stickGas = fwd > 0.15 ? Math.min(1, (fwd - 0.15) / 0.6) : 0;
  };
  zone.addEventListener('pointerdown', (e) => {
    if (id !== null) return; e.preventDefault(); id = e.pointerId; zone.setPointerCapture(id);
    const r = zone.getBoundingClientRect(); ox = e.clientX; oy = e.clientY;
    stick.style.bottom = 'auto'; stick.style.left = `${ox - r.left - 66}px`; stick.style.top = `${oy - r.top - 66}px`;
    stick.classList.add('on'); move(e);
  });
  zone.addEventListener('pointermove', (e) => { if (e.pointerId === id) { e.preventDefault(); move(e); } });
  const end = (e) => { if (e.pointerId !== id) return; id = null; input.axis = 0; input.stickGas = input.stickBrake = false; knob.style.transform = ''; stick.classList.remove('on'); home(); };
  zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
}

// ---------- audio ----------
// The Roadster is electric: no exhaust note. A motor/inverter whine that climbs with speed, tyre and wind roar,
// and the hiss of the cold-gas thrusters.
let AC = null, engine = null, hiss = null, road = null, muted = false, burst = 0;
function initAudio() {
  if (AC) return;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    const master = AC.createGain(); master.gain.value = 0.5; master.connect(AC.destination);
    const osc = (type) => { const o = AC.createOscillator(); o.type = type; o.start(); return o; };
    // motor: fundamental + inverter harmonic + a faint gear mesh, through a gentle low-pass
    engine = { a: osc('sine'), b: osc('triangle'), c: osc('sine'), ga: AC.createGain(), gb: AC.createGain(), gc: AC.createGain(), gain: AC.createGain(), lp: AC.createBiquadFilter() };
    engine.lp.type = 'lowpass'; engine.lp.frequency.value = 3800; engine.gain.gain.value = 0;
    engine.ga.gain.value = 0.55; engine.gb.gain.value = 0.16; engine.gc.gain.value = 0.07;
    for (const k of ['a', 'b', 'c']) { engine[k].connect(engine['g' + k]); engine['g' + k].connect(engine.lp); }
    engine.lp.connect(engine.gain); engine.gain.connect(master);
    const buf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const ch = buf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    const noise = () => { const src = AC.createBufferSource(); src.buffer = buf; src.loop = true; src.start(); return src; };
    // cold gas
    const hp = AC.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1400;
    hiss = AC.createGain(); hiss.gain.value = 0; noise().connect(hp); hp.connect(hiss); hiss.connect(master);
    // tyres + wind
    const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 0.7;
    road = AC.createGain(); road.gain.value = 0; noise().connect(bp); bp.connect(road); road.connect(master); road.bp = bp;
    AC.master = master;
  } catch { AC = null; }
}
function hissBurst(dur) { burst = Math.max(burst, dur); }
function blip(f0, f1, dur = 0.12, type = 'sine', vol = 0.18) {
  if (!AC || muted) return;
  const o = AC.createOscillator(), g = AC.createGain(); o.type = type;
  o.frequency.setValueAtTime(f0, AC.currentTime); o.frequency.exponentialRampToValueAtTime(f1, AC.currentTime + dur);
  g.gain.setValueAtTime(vol, AC.currentTime); g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + dur);
  o.connect(g); g.connect(AC.master); o.start(); o.stop(AC.currentTime + dur + 0.02);
}
let lastAudio = 0;
function updateAudio() {
  if (!AC) return;
  const t = AC.currentTime, on = state === 'race' && !muted, dt = Math.min(0.1, t - lastAudio); lastAudio = t;
  const f = 140 + P.v * 15 + (P.boostT > 0 ? 90 : 0);
  engine.a.frequency.setTargetAtTime(f, t, 0.06); engine.b.frequency.setTargetAtTime(f * 2.02, t, 0.06); engine.c.frequency.setTargetAtTime(f * 3.13, t, 0.06);
  const load = P.launchT > 0 || P.boostT > 0 ? 1 : input.brake ? 0.6 : 0.45;
  engine.gain.gain.setTargetAtTime(on ? 0.035 + 0.035 * load : 0, t, 0.08);
  road.gain.setTargetAtTime(on && P.grounded ? Math.min(0.09, 0.0045 + (P.v / 62) ** 2 * 0.08) : on ? 0.02 * P.v / 62 : 0, t, 0.1);
  road.bp.frequency.setTargetAtTime(380 + P.v * 9, t, 0.2);
  burst = Math.max(0, burst - dt);
  hiss.gain.setTargetAtTime(on && (P.thrusting || burst > 0) ? (burst > 0 ? 0.16 : 0.12) : 0, t, 0.03);
}
document.getElementById('mute').addEventListener('click', () => { muted = !muted; document.getElementById('mute').textContent = muted ? '소리 끔' : '소리 켬'; });

// ---------- haptics ----------
// Android browsers: the Vibration API. iOS Safari has none; flipping a hidden <input switch> plays the
// system's selection tick there (iOS 18+, only inside a touch). A native build swaps this for the OS haptics.
const HAPTIC = { tap: 7, jump: 12, land: [10, 30, 14], perfect: [10, 25, 10, 25, 22], hard: 45, crash: [45, 30, 30], hit: 55, check: 9, warn: [30, 60, 30, 60, 30], fork: [8, 40, 8] };
let hapticSw = null;
function haptic(kind) {
  if (!IS_MOBILE || save.haptic === false) return;
  const pat = HAPTIC[kind] ?? kind;
  if (navigator.vibrate) { try { navigator.vibrate(pat); } catch {} return; }
  if (!hapticSw) {
    hapticSw = document.createElement('label'); hapticSw.setAttribute('aria-hidden', 'true');
    hapticSw.style.cssText = 'position:fixed;left:-100px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
    const i = document.createElement('input'); i.type = 'checkbox'; i.setAttribute('switch', ''); i.tabIndex = -1; hapticSw.append(i); document.body.append(hapticSw);
  }
  const ticks = Array.isArray(pat) ? Math.ceil(pat.length / 2) : 1;
  for (let i = 0; i < ticks; i++) setTimeout(() => hapticSw.click(), i * 70);
}
const vibLabel = () => { document.getElementById('vib').textContent = save.haptic === false ? '진동 끔' : '진동 켬'; };
document.getElementById('vib').addEventListener('click', () => { save.haptic = save.haptic === false; writeSaveSoon(); vibLabel(); haptic('land'); });
vibLabel();
if (!IS_MOBILE) document.getElementById('vib').hidden = true;

// ---------- pause ----------
let paused = false;
function setPause(on) {
  if (on && state !== 'race') return;
  paused = on; document.getElementById('pause').hidden = !on;
  if (AC) on ? AC.suspend() : AC.resume();
  for (const k of ['left', 'right', 'jump', 'brake', 'boost', 'fire']) input[k] = false;
  input.axis = 0;
}
document.getElementById('pauseBtn').addEventListener('click', () => { haptic('tap'); setPause(true); });
document.getElementById('resumeBtn').addEventListener('click', () => setPause(false));
document.getElementById('cine').addEventListener('pointerdown', (e) => { e.preventDefault(); boss?.skipCut(); });
document.getElementById('restartBtn').addEventListener('click', () => { setPause(false); startRace(); });
document.getElementById('pMapBtn').addEventListener('click', () => location.reload());
addEventListener('keydown', (e) => { if (e.code === 'Escape' || e.code === 'KeyP') setPause(!paused); });
document.addEventListener('visibilitychange', () => { if (document.hidden) setPause(true); });

// ---------- navigation ----------
// the next real turn (gentle bends aren't announced), its distance, the one after it, and a route strip
// with the turns, forks, checkpoints and the boss on it, like a car's nav app
const NAV_TURNS = (TURNS || []).filter((t) => Math.abs(t.a) >= 0.6).map((t) => { const L = Math.abs(t.a) * t.r; return { ...t, in: t.s - L / 2, out: t.s + L / 2, fork: FORKS.find((f) => f.turn === t) }; });
const turnWord = (a) => (Math.abs(a) > 2.6 ? 'U턴' : a > 0 ? '좌회전' : '우회전');
const turnGlyph = (a) => (Math.abs(a) > 2.6 ? '⮌' : a > 0 ? '↰' : '↱');
const fmtDist = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.max(0, Math.round(m / 10) * 10)}m`);
function arrowGeom(a) {
  const f = (n) => n.toFixed(1);
  if (Math.abs(a) > 2.6) {
    const L = a > 0, x = (v) => (L ? v : 100 - v);
    return { stem: `M${x(66)} 92 V44 A16 16 0 0 ${L ? 0 : 1} ${x(34)} 44 V62`, head: `M${x(34)} 82 L${x(21)} 62 L${x(47)} 62 Z` };
  }
  const dx = -Math.sin(a), dy = -Math.cos(a), ex = 50 + dx * 28, ey = 50 + dy * 28, px = -dy, py = dx;
  return { stem: `M50 92 V50 L${f(ex)} ${f(ey)}`, head: `M${f(ex + dx * 17)} ${f(ey + dy * 17)} L${f(ex + px * 13)} ${f(ey + py * 13)} L${f(ex - px * 13)} ${f(ey - py * 13)} Z` };
}
let navA = null;
function setArrow(a) { if (a === navA) return; navA = a; const g = arrowGeom(a); $('navStem').setAttribute('d', g.stem); $('navHead').setAttribute('d', g.head); }
function updateNav() {
  const nav = $('nav');
  if (!NAV_TURNS.length || state !== 'race') { nav.hidden = true; return; }
  const fk = forkAt(P.s);
  if (P.branch && fk) {
    nav.hidden = false; nav.className = 'panel wrong'; setArrow(fk.side * 0.6);
    $('navDist').textContent = fmtDist(fk.s1 - P.s); $('navTxt').textContent = '우회로 · 합류까지'; $('navNext').textContent = '경로 재탐색: 조금 돌아가요';
    return;
  }
  const i = NAV_TURNS.findIndex((t) => t.out > P.s), t = NAV_TURNS[i];
  if (!t || t.in - P.s > 700) { nav.hidden = true; return; }
  const dist = t.in - P.s, now = dist < 50;
  nav.hidden = false; nav.className = now ? 'panel now' : 'panel'; setArrow(t.a);
  $('navDist').textContent = now ? '지금' : fmtDist(dist);
  // the fastest the tyres (and the fan upgrade) hold this corner at, as the speedometer shows it
  const vCorner = Math.sqrt(gripLimit() * t.r), kmhCorner = Math.round(vCorner * 3.6 * 1.1 / 5) * 5;
  $('navTxt').textContent = turnWord(t.a) + ` · ${kmhCorner}km/h 이하` + (t.fork ? ` · ${t.a > 0 ? '오른쪽' : '왼쪽'} 끝 차로는 우회로` : '');
  if (!now && dist < 160 && P.v > vCorner + 3) nav.className = 'panel now';
  const n = NAV_TURNS[i + 1];
  $('navNext').textContent = n && n.in - t.out < 900 ? `그다음 ${turnGlyph(n.a)} ${turnWord(n.a)} ${fmtDist(n.in - P.s)}` : '';
  if (t.fork && !P.navWarned?.has(t.s) && dist < 320) { (P.navWarned ??= new Set()).add(t.s); haptic('fork'); }
}
function buildRoute() {
  const pc = (s) => `${(100 * THREE.MathUtils.clamp(s / FINISH_S, 0, 1)).toFixed(2)}%`;
  let h = '';
  for (const t of NAV_TURNS) h += `<i style="bottom:${pc(t.in)}"></i>`;
  for (const f of FORKS) h += `<i class="fork" style="bottom:${pc(f.s0)};height:${(100 * (f.s1 - f.s0) / FINISH_S).toFixed(2)}%"></i>`;
  for (const c of CHECKS) h += `<i class="cp" style="bottom:${pc(c)}"></i>`;
  const ba = ST.bossOpts?.appearAt ?? (ST.boss ? 430 : null);
  if (ba != null) h += `<i class="boss" style="bottom:${pc(ba)}"></i>`;
  $('routeMarks').innerHTML = h;
}
function updateRoute() {
  const pr = `${(100 * THREE.MathUtils.clamp(P.s / FINISH_S, 0, 1)).toFixed(2)}%`;
  $('routeDone').style.height = pr; $('routeCar').style.bottom = pr;
  const left = Math.max(0, FINISH_S - P.s);
  $('routeLeft').textContent = fmtDist(left);
  const avg = raceT > 3 ? P.s / raceT : 30;
  $('routeEta').textContent = `도착 ~${fmtTime(raceT + penalty + left / Math.max(12, avg)).slice(0, 5)}`;
}
// level and coins are P3 on a phone: hidden in the race, they peek in for a moment when they change
let peekKey = '', peekUntil = 0;
function updatePeek() {
  const k = `${save.level}|${save.xp}|${save.doge}`, t = performance.now();
  if (k !== peekKey) { peekKey = k; peekUntil = t + 1800; }
  document.querySelector('.tl').classList.toggle('peek', t < peekUntil || state !== 'race');
}

// ---------- HUD ----------
const $ = (id) => document.getElementById(id);
const hud = { combo: $('combo'), comboName: $('comboName'), comboMult: $('comboMult'), comboBar: $('comboBar'), score: $('score'), mLine: $('mLine'), mission: $('mission'), prompt: $('prompt'), lv: $('lv'), xpTxt: $('xpTxt'), xpBar: $('xpBar'), doge: $('doge'), time: $('time'), prog: $('prog'), progDot: $('progDot'), kmh: $('kmh'), pips: $('pips'), jumpTxt: $('jumpTxt'), boost: $('boostFill'), toast: $('toast'), radio: $('radio'), radioTxt: $('radioTxt'), count: $('count'), fuel: $('fuelFill') };
let toastT = 0;
function toast(big, small = '', color = '#38f5ff') {
  hud.toast.innerHTML = `${big}${small ? `<small>${small}</small>` : ''}`;
  hud.toast.style.setProperty('--tc', color);
  hud.toast.classList.remove('show'); void hud.toast.offsetWidth; hud.toast.classList.add('show');
  toastT = 1.6;
}
let radioT = 0;
function radio(text, who = CAST.hero.name, ava = CAST.hero.ava, face = CAST.hero.face) {
  radioQueue.push({ text, who, ava, face });
}
function updateRadio(dt) {
  radioT -= dt;
  if (radioT <= 0 && radioQueue.length) {
    const r = radioQueue.shift();
    $('radioWho').textContent = r.who; hud.radioTxt.textContent = r.text;
    const av = $('radioAva'), img = FACES[r.face]; av.textContent = img ? '' : r.ava; av.style.backgroundImage = img ? `url(${img})` : '';
    hud.radio.classList.add('show'); radioT = 4.2;
  } else if (radioT <= 0) hud.radio.classList.remove('show');
}
function gainXP(n, why) {
  save.xp += n; stats.xpGain += n;
  while (save.xp >= xpNeed(save.level)) {
    save.xp -= xpNeed(save.level); save.level++;
    P.charges = maxCharges();
    setTimeout(() => toast(`레벨 업! LV ${save.level}`, `점프 최대 ${maxCharges()}회`, '#3dff9a'), 500);
    blip(440, 1320, 0.4, 'triangle', 0.2);
  }
  if (why) floatText(why);
}
function floatText(t) {
  const el = document.createElement('div'); el.className = 'float'; el.textContent = t;
  $('floats').appendChild(el); setTimeout(() => el.remove(), 1200);
}
function renderPips() {
  const max = maxCharges();
  if (hud.pips.childElementCount !== max) hud.pips.innerHTML = '<i></i>'.repeat(max);
  [...hud.pips.children].forEach((el, i) => {
    const fill = i < P.charges ? 1 : i === P.charges ? P.recharge / recharge() : 0;
    el.style.setProperty('--f', fill);
    el.classList.toggle('full', fill >= 1);
  });
  hud.jumpTxt.textContent = P.charges > 0 ? `압축공기 점프 ${P.charges}/${max}` : '압축공기 충전 중…';
}
function updateHUD() {
  hud.lv.textContent = `LV ${save.level}`;
  hud.xpTxt.textContent = `EXP ${save.xp} / ${xpNeed(save.level)}`;
  hud.xpBar.style.width = `${(100 * save.xp / xpNeed(save.level)).toFixed(1)}%`;
  hud.doge.textContent = save.doge.toLocaleString();
  hud.time.textContent = fmtTime(raceT + penalty);
  const pr = THREE.MathUtils.clamp(P.s / FINISH_S, 0, 1) * 100;
  hud.prog.style.width = pr + '%'; hud.progDot.style.left = pr + '%';
  updateNav(); updateRoute(); updatePeek();
  hud.kmh.textContent = P.v < -0.5 ? `R ${Math.round(-P.v * 3.6 * 1.1)}` : Math.round(P.v * 3.6 * 1.1);
  hud.boost.style.width = `${P.boostG}%`;
  hud.fuel.style.width = `${100 * P.fuel / AIR_FUEL}%`;
  $('hpFill').style.width = `${100 * hpF()}%`; $('hpMeter').dataset.z = hpZone();
  $('boostBtn').classList.toggle('ready', P.boostG >= 35);
  if (GUN) {
    $('coilRow').hidden = false; $('fireBtn').hidden = false; $('fireBtn').textContent = '🔥';
    $('coilFill').style.width = `${P.heat}%`;
    $('coilMeter').classList.toggle('full', P.overheat > 0); $('fireBtn').classList.toggle('ready', P.overheat <= 0);
    $('coilTxt').textContent = P.overheat > 0 ? '🔥 과열! 식는 중…' : (IS_MOBILE ? '🔥 랩터 캐논 · 버튼 꾹' : '🔥 랩터 캐논 · F 꾹 누르기');
  } else if (boss?.B.active) {
    $('coilFill').style.width = `${P.coil}%`;
    const ready = P.coil >= 100;
    $('coilMeter').classList.toggle('full', ready); $('fireBtn').classList.toggle('ready', ready);
    $('coilTxt').textContent = ready ? (IS_MOBILE ? '⚡ 코일 발사 준비!' : '⚡ F 키로 코일 발사!') : '⚡ 테슬라 코일 충전 중';
  }
  renderPips();
  // combo + score + objective
  hud.combo.hidden = P.combo < 1;
  if (P.combo >= 1) { hud.comboMult.textContent = `×${comboMult()}`; hud.comboBar.style.width = `${100 * (P.grounded ? P.comboT / COMBO_T : 1)}%`; }
  hud.score.textContent = P.score.toLocaleString();
  const mh = mission?.hud?.() || {};
  hud.mLine.textContent = mh.line || ''; hud.mission.classList.toggle('warn', !!mh.warn);
  hud.prompt.hidden = !mh.big; if (mh.big) { hud.prompt.textContent = mh.line.replace(/^\d+\/\d+ · /, ''); hud.prompt.classList.toggle('flash', !!mh.flash); }
}
const fmtTime = (t) => { t *= SLOW; return `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(2).padStart(5, '0')}`; }; // game seconds in, real seconds shown

// ---------- tricks, combo, score ----------
// Every trick adds to a chain; the chain's multiplier (x1..x5) scales its points. A crash, a fall or a hard
// landing breaks it; 3.2 s on the ground without a trick ends it.
const COMBO_T = 3.2;
const comboMult = () => (P.combo >= 9 ? 5 : P.combo >= 6 ? 4 : P.combo >= 4 ? 3 : P.combo >= 2 ? 2 : 1);
function trick(name, pts, quiet) {
  P.combo++; P.comboT = COMBO_T;
  const m = comboMult(), got = Math.round(pts * m); P.score += got; P.comboBest = Math.max(P.comboBest, m); if (m >= 5) unlockAch('combo5');
  hud.comboName.textContent = `${name} +${got.toLocaleString()}`;
  hud.combo.classList.toggle('hot', m >= 3);
  if (!quiet || P.combo % 5 === 0) { hud.combo.classList.remove('pop'); void hud.combo.offsetWidth; hud.combo.classList.add('pop'); }
  mission?.on?.('trick', { name, pts: got });
}
function damage(n, why) {
  if (n <= 0 || state !== 'race') return;
  const z0 = hpZone(); const was = save.hp; save.hp = Math.max(0, save.hp - n); stats.damage = (stats.damage || 0) + (was - save.hp); writeSaveSoon();
  floatText(`차체 -${n} · ${why}`); if (n >= 5) haptic('hit');
  const z1 = hpZone();
  if (z0 === 'green' && z1 === 'yellow') toast('차체 손상!', '노란 구간 · 스파크가 튀어요', '#ffc83d');
  if (z0 !== 'red' && z1 === 'red') haptic('warn');
  if (z0 !== 'red' && z1 === 'red') toast('배터리 화재!', '빨간 구간 · 계속 타면서 닳아요 · 최고속도 감소', '#ff3d6e');
}
function endCombo(broken) {
  if (!P.combo) return;
  if (broken && P.combo >= 2) floatText(`콤보 끊김 ×${comboMult()}`);
  else if (P.combo >= 3) { floatText(`콤보 ×${comboMult()} 마무리`); blip(700, 1050, 0.15, 'triangle', 0.08); }
  P.combo = 0; P.comboT = 0;
}
function flash(color, dur = 0.25) {
  const el = $('flash'); el.style.background = color; el.style.transition = 'none'; el.style.opacity = '1';
  void el.offsetWidth; el.style.transition = `opacity ${dur}s ease-out`; el.style.opacity = '0';
}

// ---------- landing marker ----------
// While airborne: where you will come down (cyan; red = nothing there) and a ring that closes on it as the
// ground arrives. It turns gold in the perfect-landing window: hold jump then.
const landMark = (() => {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshBasicMaterial({ color: new THREE.Color(...c), transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const spot = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.4, 48), mat([0.4, 2.2, 3])); spot.rotation.x = -Math.PI / 2;
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.28, 24), mat([0.4, 2.2, 3])); dot.rotation.x = -Math.PI / 2;
  const timing = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.1, 48), mat([1, 1, 1])); timing.rotation.x = -Math.PI / 2;
  g.add(spot, dot, timing); g.visible = false; g.renderOrder = 4; scene.add(g);
  return { g, spot, dot, timing };
})();
const _lp = new THREE.Vector3();
function predictLanding() {
  let s = P.s, d = P.d, y = P.y, vy = P.vy, t = 0;
  const v = P.v, dt = 1 / 60, splashY = ST.splashY?.(P.s) ?? -5.5;
  for (let i = 0; i < 360; i++) {
    vy -= G * dt; const eS = elevSlope(s); y += (vy - eS * v) * dt; s += v * dt; t += dt;
    const g = carGround(s, d, y);
    if (vy - eS * v < 0 && y <= g) return { s, d, y: g, t, fall: false };
    if (y < splashY) return { s, d, y: Math.max(splashY, -5), t, fall: true };
  }
  return null;
}
function updateLandMark(time) {
  const m = landMark;
  if (state !== 'race' || P.grounded || P.air < 0.08) { m.g.visible = false; $('landCue').hidden = true; return; }
  const L = predictLanding();
  if (!L) { m.g.visible = false; $('landCue').hidden = true; return; }
  m.g.visible = true;
  world(L.s, L.d, L.y + 0.08, _lp); m.g.position.copy(_lp); m.g.rotation.y = frame(L.s).yaw;
  const win = !L.fall && L.t < PERFECT_WINDOW + 0.05 && P.air > 0.35;
  const col = L.fall ? [3, 0.25, 0.3] : win ? [3.2, 2.2, 0.4] : [0.4, 2.2, 3];
  m.spot.material.color.setRGB(...col); m.dot.material.color.setRGB(...col); m.timing.material.color.setRGB(...(win ? [3.4, 2.6, 0.8] : [1.2, 1.2, 1.3]));
  m.timing.scale.setScalar(1 + Math.min(L.t, 1.4) * 1.9);
  m.spot.scale.setScalar(win ? 1.15 + Math.sin(time * 30) * 0.06 : 1);
  const cue = $('landCue'); cue.hidden = !(win || L.fall);
  if (L.fall) { cue.textContent = '착지할 곳 없음!'; cue.className = 'fall'; }
  else if (win) { cue.textContent = P.thrusting ? '좋아요, 유지!' : (IS_MOBILE ? '지금 점프 꾹!' : '지금 Space 꾹!'); cue.className = 'now'; }
}

// ---------- mission plumbing ----------
let mission = null;
const MISSION = ST.mission || { type: 'race', time: ST.stars?.time, perfect: ST.stars?.perfect || 3, bossStar: !!ST.boss };
const missionObjs = [];
const missionCtx = {
  P, get kit() { return kit; }, toast, floatText, blip, trick, puff, touch: IS_MOBILE,
  radio: (text, who) => { const c = CAST[who] || CAST.hero; radio(text, c.name, c.ava, c.face); },
  score: () => P.score, boss: () => boss, time: () => performance.now() / 1000, raceT: () => raceT,
  respawn: (s, v) => respawn(s, v),
  addRival: (def, i) => addRival(def, i),
  add: (o) => { scene.add(o); missionObjs.push(o); return o; },
};
// rivals: named cars that race you to the line. They hold a racing speed, overtake slower traffic, and blink
// the turn signal for ~0.9 s before every lane change, so a sharp eye can read where the gap will close.
function addRival(def, i) {
  const t = addTraffic(def.type, def.s ?? 20 + i * 14, def.d ?? LANES[(i + 1) % LANES.length], { v: 0, name: def.name, color: def.color });
  Object.assign(t, { rival: true, base: def.speed, v: 0, launch: def.launch ?? 0.4 + i * 0.15, finishT: null, signals: true });
  if (t.mesh) addBlinkers(t);
  if (def.label && t.mesh) { const tag = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 0.9), new THREE.MeshBasicMaterial({ map: textTex(def.label, def.tagColor || '#ff3d6e', { w: 512, h: 104, size: 64 }), transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })); tag.material.color.setScalar(1.5); tag.position.set(0, t.h + 1.1, 0); t.mesh.add(tag); }
  return t;
}
function addBlinkers(t) {
  const mat = () => new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.6, 0.1), toneMapped: false, transparent: true, opacity: 0 });
  const L = mat(), R = mat(), geo = new THREE.SphereGeometry(0.13, 10, 8);
  for (const [m, x] of [[L, -1], [R, 1]]) for (const z of [-1, 1]) { const b = new THREE.Mesh(geo, m); b.position.set(x * (t.hw - 0.05), 0.75, z * (t.hl - 0.15)); t.mesh.add(b); }
  t.blink = { L, R };
}
// a lane change that waits for its signal
function wantLane(t, lane) {
  if (Math.abs(lane - t.dT) < 0.5 || t.pend != null) return;
  if (!t.signals) { t.dT = lane; return; }
  t.pend = lane; t.sigT = 0.9;
}
function stepSignals(t, dt, time) {
  if (t.pend != null) { t.sigT -= dt; if (t.sigT <= 0) { t.dT = t.pend; t.pend = null; t.sigAfter = 0.5; } }
  else if (t.sigAfter > 0) t.sigAfter -= dt;
  if (!t.blink) return;
  const dir = t.pend != null ? Math.sign(t.pend - t.d) : t.sigAfter > 0 ? Math.sign(t.dT - t.d) : 0;
  const on = Math.sin(time * 18) > 0 ? 1 : 0;
  t.blink.L.opacity = dir < 0 ? on : 0; t.blink.R.opacity = dir > 0 ? on : 0;
}
function stepRival(t, dt) {
  if (raceT < t.launch) return;
  if (t.s > FINISH_S && t.finishT == null) t.finishT = raceT;
  // racing speed with a soft rubber band so the race stays close both ways
  const ahead = t.s - P.s, band = ahead > 70 ? 0.9 : ahead < -70 ? 1.08 : 1;
  let target = t.finishT != null ? 18 : t.base * band;
  // real corners: rivals brake for them like you do
  let kMax = 0; for (let ds = 0; ds < 60; ds += 6) kMax = Math.max(kMax, Math.abs(curvature(t.s + ds)));
  if (kMax > 0) target = Math.min(target, Math.sqrt(gripLimit(0) / kMax)); // rivals have stock grip
  let lead = null;
  for (const o of traffic) if (o !== t && o.s > t.s && o.s - t.s < 38 && Math.abs(o.d - t.dT) < 2.8 && (!lead || o.s < lead.s)) lead = o;
  if (lead && lead.v < target - 2 && t.pend == null) {
    const free = LANES.filter((l) => Math.abs(l - t.dT) < 7 && Math.abs(l - t.dT) > 1 && !traffic.some((o) => o !== t && Math.abs(o.d - l) < 2.6 && o.s > t.s - 12 && o.s < t.s + 30) && !AVOID.some((r) => r.s0 - t.s > 0 && r.s0 - t.s < 50 && l + 1.2 > r.dL && l - 1.2 < r.dR));
    if (free.length) wantLane(t, free[(Math.random() * free.length) | 0]);
    else target = Math.min(target, lead.v + Math.max(0, lead.s - t.s - lead.hl - t.hl - 5) * 0.8);
  }
  t.v += THREE.MathUtils.clamp(target - t.v, -40 * dt, (t.v < 25 ? 22 : 9) * dt);
}


// ---------- Starship cannon (space stages): hold fire, the twin Raptor guns pick the nearest target ----------
// stage.gun = { rate, dmg, heat (seconds of fire to overheat) }; targets: the boss's weak point, the boss's
// drones (boss.targets) and whatever the stage offers (stage.targets(): [{ pos, hit(dmg), r }]).
const GUN = ST.gun || null;
const gunShots = [];
if (GUN) {
  const kh = document.getElementById('keysHint'); if (kh) kh.innerHTML = kh.innerHTML.replace('F 테슬라 코일(보스전)', 'F 꾹 = 랩터 캐논 연사');
  const geo = new THREE.CylinderGeometry(0.13, 0.13, 4.5, 6); geo.rotateX(Math.PI / 2);
  for (let i = 0; i < 48; i++) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 2.6, 5), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    m.visible = false; scene.add(m); gunShots.push({ m, live: false, pos: new THREE.Vector3(), tgt: null, life: 0 });
  }
}
let gunCd = 0, gunSide = 1;
const _gv = new THREE.Vector3(), _gt = new THREE.Vector3();
function gunTargets() {
  const out = [...(ST.targets?.() || []), ...(boss?.targets?.() || []), ...(mission?.targets?.() || [])];
  if (boss?.B.active && !boss.B.defeated && boss.B.mesh.visible) out.push({ pos: boss.B.mesh.userData.eye.getWorldPosition(new THREE.Vector3()), r: 2.5, boss: true, hit: (n) => boss.damage(n, '랩터 캐논', true) });
  return out;
}
function stepGun(dt) {
  P.overheat = Math.max(0, P.overheat - dt);
  P.heat = Math.max(0, P.heat - dt * (P.overheat > 0 ? 45 : 30));
  gunCd -= dt;
  // 그럭 Lv3 fires in bursts on its own whenever something is in the cone, keeping the cannon off overheat
  const autoGun = !input.fire && (save.up.copilot || 0) >= 3 && P.heat < 78;
  if ((input.fire || autoGun) && P.overheat <= 0 && gunCd <= 0) {
    // nearest target ahead, in a cone in front of the car
    const me = world(P.s, P.d, P.y + 1, _gv);
    let best = null, bd = 1e9;
    for (const t of gunTargets()) {
      const dz = me.z - t.pos.z, dist = me.distanceTo(t.pos);
      if (dz < 3 || dist > 170 || Math.abs(t.pos.x - me.x) > dz * 0.9 + 6) continue;
      const score = dist - (t.boss ? 25 : 0); if (score < bd) { bd = score; best = t; }
    }
    if (autoGun && !best) gunCd = 0.1;
    else {
      gunCd = 1 / GUN.rate;
      P.heat += 100 / (GUN.rate * GUN.heat) + 30 / GUN.rate;
      if (P.heat >= 100) { P.heat = 100; P.overheat = 1.6; toast('과열!', '랩터 캐논 냉각 중', '#ff6a1a'); blip(400, 90, 0.4, 'sawtooth', 0.12); }
      const sh = gunShots.find((x) => !x.live);
      if (sh) {
        gunSide = -gunSide;
        world(P.s + 1.8, P.d + gunSide * 0.95, P.y + 1.05, sh.pos);
        sh.tgt = best; sh.live = true; sh.life = 0.9; sh.m.visible = true;
        sh.dir = best ? best.pos.clone().sub(sh.pos).normalize() : new THREE.Vector3(-Math.sin(frame(P.s).yaw), 0.02, -Math.cos(frame(P.s).yaw));
        blip(1400, 700, 0.06, 'square', 0.035);
      }
    }
  }
  for (const sh of gunShots) {
    if (!sh.live) continue;
    sh.life -= dt;
    if (sh.tgt) { _gt.copy(sh.tgt.pos).sub(sh.pos); const dist = _gt.length(); if (dist < 4 + (sh.tgt.r || 1)) { sh.tgt.hit(GUN.dmg); sh.live = false; sh.m.visible = false; puff(sh.pos, new THREE.Vector3(0, 2, 0), '#9fd8ff', 0.8, 0.25); continue; } sh.dir.lerp(_gt.normalize(), Math.min(1, dt * 14)).normalize(); }
    sh.pos.addScaledVector(sh.dir, (P.v + 240) * dt);
    sh.m.position.copy(sh.pos); sh.m.lookAt(_gt.copy(sh.pos).add(sh.dir));
    if (sh.life <= 0) { sh.live = false; sh.m.visible = false; }
  }
}

// ---------- simulation ----------
const RADIO_SCRIPT = ST.radio;
const AVOID = [...RAMPS, ...(ST.blocks || [])]; // where traffic changes lane
const PUDDLES = [...(ST.puddles || [])]; // bosses can add more (sunscreen)
const PADS = ST.pads || [];             // like-button jump pads
const HAZARDS = ST.hazards || [];
// slope of whatever the car stands on (ramp or raised surface), on top of the road's own grade
function slopeAt(s, d, y) {
  const r = rampAt(s, d) || rampAt(s, d - 0.8) || rampAt(s, d + 0.8);
  if (r) return r.h / r.len;
  const u = surfaceAt(s, d, y + 0.3); if (u && Math.abs(y - u.y(s)) < 0.4) return u.y(s + 0.5) - u.y(s - 0.5);
  return 0;
}
function step(dt) {
  raceT += dt;
  if ((save.up.copilot || 0) >= 3 && boss?.B.active && !GUN && P.coil >= 100 && boss.fireCoil()) floatText('그럭: 코일 대신 쐈어');
  if (boss) { boss.update(dt); if (!GUN && input.fireEdge) { input.fireEdge = false; if (!boss.fireCoil() && boss.B.active) floatText('코일 충전 중…'); } }
  if (GUN) { input.fireEdge = false; stepGun(dt); }
  const fr0 = frame(P.s);
  // speed
  const boosting = P.boostT > 0;
  let vmax = (62 + save.level * 0.8 + save.up.motor * 4) * hpSpeed() + (boosting ? 20 : 0);
  // throttle: ↑/W, or a thumb on the touch stick. No input = coasting on rolling drag (user, 2026-10-24:
  // the car shouldn't keep accelerating by itself); a boost still pushes on its own
  // throttle 0..1: ↑/W is full, the touch stick pushed forward is proportional
  const gas = input.gas ? 1 : input.stickGas || 0;
  // coasting keeps most of the momentum: rolling resistance plus air drag growing with speed
  const drag = P.grounded ? Math.sign(P.v) * (0.3 + 0.00025 * P.v * P.v) : 0;
  let acc = boosting ? 34 * Math.max(0, 1 - P.v / vmax) + 6 : gas > 0 ? 15 * gas * Math.max(0, 1 - P.v / vmax) + (P.v < 0 ? 20 : 0) : -drag;
  if (P.v > vmax) acc = -12;
  // launch: the cold-gas thrusters fire with the motors, 0-100 km/h (as the HUD shows it) in about 1.1 s
  if (P.launchT > 0 && gas) { P.launchT -= dt; acc = Math.max(acc, 23.5); }
  if (!P.t100 && P.v * 3.6 * 1.1 >= 100) { P.t100 = raceT; if (raceT < 1.2) unlockAch('launch'); if (raceT < 2) floatText(`0→100km/h ${(raceT * SLOW).toFixed(2)}초 · 콜드가스 스러스터`); }
  if (P.crashT > 0) { P.crashT -= dt; acc *= 0.3; }
  // brake; held at a standstill it reverses (slowly)
  if ((input.brake || input.stickBrake) && P.grounded) acc = P.v > 0.3 ? -42 : P.v > -9 ? -7 : 0;
  P.v = Math.max(-9, P.v + acc * dt);
  if (P.boostT > 0) P.boostT -= dt;
  if (input.boost && !boosting && P.boostG >= 35) { P.boostT = P.boostG / 35 * 1.1; P.boostG = 0; hissBurst(P.boostT); toast('부스트!', '', '#ff3d6e'); }

  // steering
  const steer = input.axis || (input.right ? 1 : 0) - (input.left ? 1 : 0); // analog stick on touch, keys otherwise
  const grip = P.slipT > 0 ? 0.25 : 1;
  P.d += steer * (P.grounded ? 15 : 14) * grip * dt * Math.min(1, 0.4 + P.v / 40);
  if (P.slipT > 0) { P.slipT -= dt; P.d += P.slipV * dt; P.slipV *= 1 - dt * 1.2; }
  // corners: the road bends under you, the car wants to carry on straight. Steer in; brake for tight ones.
  // off the centre line a bend is wider or tighter (radius r + d); stretch > 1 out wide, < 1 on the inside line
  const kNow = curvature(P.s), stretch = Math.max(0.3, 1 + P.d * kNow);
  const lat = P.v * P.v * kNow / stretch; // m/s² toward the outside of the bend
  P.lat = lat;
  // within the grip limit the tyres hold the line (a light pull you steer against); past it the car
  // slides wide in proportion to the excess and the tyres scrub speed
  const gl = gripLimit(), over = Math.max(0, Math.abs(lat) - gl) * Math.sign(lat);
  P.d += (P.grounded ? Math.min(Math.abs(lat), gl) * Math.sign(lat) * 0.03 + over * 0.16 : lat * 0.11) * dt;
  if (P.grounded && Math.abs(over) > 0) {
    P.v -= Math.abs(over) * 0.12 * dt * Math.sign(P.v); // tyres at the limit scrub speed
    if (Math.random() < 0.5) puff(world(P.s - 1.5, P.d + Math.sign(lat) * 0.8, 0.2), new THREE.Vector3((Math.random() - 0.5) * 3, 1.5, (Math.random() - 0.5) * 3), '#9a9aa4', 0.9, 0.6);
    if (!P.skidMsg) { P.skidMsg = 1; floatText('타이어 한계! 코너 전에 ↓ 브레이크'); }
  } else if (Math.abs(lat) < 20) P.skidMsg = 0;
  const lim = reach(P.s, P.y);
  if (P.grounded && Math.abs(P.d) > lim && Math.sign(P.d) === Math.sign(lat || 1) * -1 * -1 && Math.abs(lat) > 18) {
    // scraping the outside barrier
    P.v *= 1 - 0.9 * dt; P.shake = Math.max(P.shake, 0.25);
    if (Math.random() < 0.6) puff(world(P.s, Math.sign(P.d) * lim, 0.4), new THREE.Vector3(0, 2, 0), '#ffb347', 0.4, 0.3);
  }
  const fk = forkAt(P.s);
  if (fk) {
    const sd = fk.side, inGap = P.s > fk.s0 && P.s < fk.s1;
    if (inGap && P.forkId !== fk.id) { P.forkId = fk.id; P.branch = P.d * sd > ROAD_HALF; if (P.branch) { toast('우회로', `합류까지 ${(fk.s1 - P.s) | 0}m 돌아가요`, '#ffc83d'); stats.detours = (stats.detours || 0) + 1; } else { trick('정확한 진입', 120); if ((stats.lines = (stats.lines || 0) + 1) >= 3) unlockAch('line3'); } }
    if (!inGap) P.branch = false;
    if (P.branch) {
      P.d += sd * (fk.gap(P.s + P.v * dt / stretch) - fk.gap(P.s)); // the lane carries you out and back
      const lo = fk.inner(P.s) + 1.2, hi = Math.max(lo, fk.outer(P.s) - 1.2);
      P.d = sd * THREE.MathUtils.clamp(P.d * sd, lo, hi);
    } else {
      const far = inGap ? lim : Math.max(lim, fk.outer(P.s) - 1.2);
      P.d = sd > 0 ? THREE.MathUtils.clamp(P.d, -lim, far) : THREE.MathUtils.clamp(P.d, -far, lim);
    }
  } else { P.d = THREE.MathUtils.clamp(P.d, -lim, lim); P.forkId = -1; P.branch = false; }
  P.steerVis += (steer - P.steerVis) * Math.min(1, dt * 8);
  P.s += P.v * dt / stretch;

  // jump / thrust
  if (input.jumpEdge) P.jumpBuf = 0.18;
  P.jumpBuf = Math.max(0, (P.jumpBuf || 0) - dt);
  P.coyote = P.grounded ? 0.28 : Math.max(0, (P.coyote || 0) - dt);
  if (P.jumpBuf > 0 && (P.grounded || P.coyote > 0)) {
    P.jumpBuf = 0; P.coyote = 0;
    if (P.charges > 0) {
      P.charges--; P.vy = P.grounded ? (elevSlope(P.s) + P.slope) * P.v + JUMP_V : Math.max(P.vy - elevSlope(P.s) * P.v, 0) + elevSlope(P.s) * P.v + JUMP_V; P.grounded = false; P.air = 0;
      // signature move from the Roadster demo: a full sideways twist in the air
      P.rollDir = Math.abs(steer) > 0.2 ? Math.sign(steer) : -P.rollDir; P.rollTo = P.roll + Math.PI * 2 * P.rollDir;
      blip(160, 520, 0.25, 'triangle', 0.15);
      const base = world(P.s, P.d, P.y);
      for (let i = 0; i < 14; i++) puff(base, new THREE.Vector3((Math.random() - 0.5) * 12, -1 + Math.random() * 2, (Math.random() - 0.5) * 12), '#e8f6ff', 1.2, 0.7);
    } else if (input.jumpEdge) { toast('충전 중…', '압축공기가 부족해요', '#ff3d6e'); blip(200, 120, 0.15, 'square', 0.06); }
  }
  input.jumpEdge = false;
  if (P.charges < maxCharges()) {
    P.recharge += dt;
    if (P.recharge >= recharge()) { P.recharge = 0; P.charges++; }
  } else if (P.charges >= maxCharges()) P.recharge = 0;

  P.thrusting = false;
  const g = carGround(P.s, P.d, P.y);
  const eS = elevSlope(P.s);
  if (P.grounded) {
    if (g < P.y - 0.3) { // left a ramp top or a broken bridge
      P.grounded = false; P.air = 0;
    } else {
      const kPrev = P.kG ?? eS;
      P.slope = slopeAt(P.s, P.d, g); P.y = g; P.lastG = g;
      P.kG = eS + P.slope; P.vy = P.kG * P.v;
      // over a crest the ground drops away faster than gravity can follow: the car flies (SF hills)
      if ((P.kG - kPrev) * P.v / dt < -G * 1.15 && P.v > 15) { P.grounded = false; P.air = 0; P.vy = kPrev * P.v; }
    }
    if (P.slipT <= 0) for (const q of PUDDLES) if (Math.abs(P.s - q.s) < q.l && Math.abs(P.d - q.d) < q.w) {
      P.slipT = 0.9; P.slipV = (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 3); P.v *= 0.9;
      const [big, small, col] = q.text || ['냉각수!', '데이터센터 냉각수에 미끄러짐', '#5ff0ff'];
      toast(big, small, col); blip(500, 200, 0.3, 'sine', 0.12);
      for (let i = 0; i < 10; i++) puff(world(P.s, P.d, 0.3), new THREE.Vector3((Math.random() - 0.5) * 8, 2 + Math.random() * 3, (Math.random() - 0.5) * 8), '#c8fbff', 1.1, 0.7);
      break;
    }
    for (const q of PADS) if (P.grounded && Math.abs(P.s - q.s) < q.l && Math.abs(P.d - q.d) < q.w) {
      P.grounded = false; P.air = 0; P.vy = (P.kG || 0) * P.v + q.v; P.rollDir = -P.rollDir; P.rollTo = P.roll + Math.PI * 2 * P.rollDir;
      floatText('좋아요 점프!'); blip(300, 1200, 0.3, 'triangle', 0.16);
      for (let i = 0; i < 12; i++) puff(world(P.s, P.d, 0.3), new THREE.Vector3((Math.random() - 0.5) * 10, 4 + Math.random() * 4, (Math.random() - 0.5) * 10), '#7ab8ff', 1, 0.6);
    }
    P.fuel = Math.min(AIR_FUEL, P.fuel + dt * 1.5);
  }
  if (P.roll !== P.rollTo) {
    const left = P.rollTo - P.roll, sp = (P.grounded ? 20 : 8.5) * dt;
    if (Math.abs(left) <= sp) {
      P.roll = P.rollTo = 0;
      if (!P.grounded) { gainXP(10); P.boostG = Math.min(100, P.boostG + 10); trick('배럴롤', 100); }
    } else P.roll += Math.sign(left) * sp;
  }
  if (!P.grounded) {
    P.air += dt;
    P.vy -= G * dt;
    const rv = P.vy - eS * P.v; // vertical speed relative to the road under you
    // 그럭 copilot: fires the landing thrust itself when the ground is coming up fast (Lv1), and right at
    // touchdown so it counts as a perfect landing (Lv2). Only Lv2+ thrust counts toward the perfect window.
    const cop = save.up.copilot || 0, h = P.y - g, tti = rv < -0.5 ? h / -rv : 9;
    const auto = !input.jump && cop > 0 && P.air > 0.3 && rv < 3 && ((rv < -9 && tti < 0.75) || (cop >= 2 && tti < 0.22));
    if ((input.jump || auto) && rv < 3 && P.fuel > 0) {
      P.thrusting = true; if (!auto || cop >= 2) P.lastThrust = raceT; P.fuel -= dt; P.vy += 27 * dt; if (rv < -7) P.vy += 20 * dt;
      if (Math.random() < 0.8) { const base = world(P.s, P.d + (Math.random() - 0.5) * 1.6, P.y); puff(base, new THREE.Vector3(0, -14, 0), '#cfefff', 0.6, 0.35); }
    }
    P.y += (P.vy - eS * P.v) * dt;
    if (P.y <= g) land(g);
    if (P.y < (ST.splashY?.(P.s) ?? -5.5)) splash();
  }
  // overpasses and sign gantries: solid overhead, except their holes
  P.bonkT -= dt;
  for (const c of CEILINGS) {
    if (P.s < c.s0 || P.s > c.s1 || P.y + 1.3 < c.y0 || P.y > c.y1 - 0.05) continue;
    const hole = c.holes?.find((h) => ((P.d - h.d) / h.rx) ** 2 + ((P.y + 0.65 - h.y) / h.ry) ** 2 < 1);
    if (hole) {
      if (!radioFlags.has(hole)) {
        radioFlags.add(hole); const b = ST.holeBonus;
        toast(b.text, b.sub, '#ffc83d'); gainXP(b.xp); save.doge += b.doge; stats.dogeGain += b.doge; writeSaveSoon();
        P.boostT = Math.max(P.boostT, 1.5); blip(520, 1560, 0.5, 'triangle', 0.18);
      }
      continue;
    }
    if (P.bonkT > 0) continue;
    const under = P.y + 1.3 - c.y0 < 0.9, face = P.s - P.v * dt * 1.5 < c.s0;
    if (!under && !face) continue; // came down onto it from above: the deck is a floor (roofAt)
    P.bonkT = 0.5; P.shake = 0.7; P.v *= 0.45; P.vy = Math.min(P.vy, eS * P.v - 3); P.grounded = false;
    if (under) P.y = c.y0 - 1.35; else P.s = c.s0 - 0.4; // underside: pushed down; face: stopped
    toast('쿵!', `${c.what}에 부딪힘`, '#ff3d6e'); blip(150, 40, 0.3, 'square', 0.18);
  }
  if (ST.swarm && !swarmDone && P.s > ST.swarm.at) spawnSwarm();
  // stage hazards the stage switches on and off (engine test fire): { s, l, dL, dR, h, active, text }
  for (const hz of HAZARDS) {
    hz.cd = (hz.cd || 0) - dt;
    if (!hz.active || hz.cd > 0 || Math.abs(P.s - hz.s) > hz.l || P.d < hz.dL || P.d > hz.dR || P.y > (hz.h ?? 3) || P.y + 1.3 < (hz.y0 ?? -9)) continue;
    hz.cd = 1; P.v *= 0.5; P.crashT = 0.6; P.shake = 0.8; damage(8, '위험 구역');
    const [big, small, col] = hz.text || ['앗 뜨거!', '', '#ff6a1a']; toast(big, small, col); blip(120, 40, 0.4, 'sawtooth', 0.2);
    for (let i = 0; i < 16; i++) puff(world(P.s, P.d, 0.8), new THREE.Vector3((Math.random() - 0.5) * 10, 3 + Math.random() * 5, (Math.random() - 0.5) * 10), i % 2 ? '#ff8a2a' : '#555', 1.3, 0.7);
  }

  // traffic
  for (const t of traffic) {
    if (!t.parked) {
      if (t.signals) stepSignals(t, dt, raceT);
      if (t.rival) stepRival(t, dt);
      else if (t.brakeT > 0) { t.brakeT -= dt; t.v = Math.max(0, t.v - 60 * dt); if (t.brakeT <= 0) t.cool = 3; }
      else {
        // keep a gap to whoever is ahead in the lane (jams back up naturally)
        let target = t.base, lead = null;
        for (const o of traffic) if (o !== t && o.s > t.s && o.s - t.s < 45 && Math.abs(o.d - t.dT) < 2.8 && (!lead || o.s < lead.s)) lead = o;
        if (lead) { const gap = lead.s - t.s - lead.hl - t.hl; if (gap < 14) target = Math.min(target, Math.max(0, lead.v + (gap - 4) * 0.8)); }
        t.v += (target - t.v) * Math.min(1, dt * (target < t.v ? 3 : 0.8));
      }
      t.cool -= dt;
      t.s += t.v * dt;
      // lidar (and the robotaxi's cameras) see the ramp ahead and change lane
      const ahead = AVOID.find((r) => r.s0 - t.s > 0 && r.s0 - t.s < 45 && t.dT + 1.2 > r.dL && t.dT - 1.2 < r.dR);
      if (ahead) { const free = LANES.filter((l) => !AVOID.some((r) => Math.abs(r.s0 - ahead.s0) < 2 && l + 1.2 > r.dL && l - 1.2 < r.dR)); if (free.length) wantLane(t, free.reduce((a, b) => (Math.abs(b - t.d) < Math.abs(a - t.d) ? b : a))); }
      else if (t.copy) {
        // copycats mirror your lane, a beat late
        t.copyT -= dt;
        if (t.copyT <= 0 && t.s - P.s > 10 && t.s - P.s < 140) { t.copyT = 0.5 + Math.random() * 0.7; t.dT = LANES.reduce((a, b) => (Math.abs(b - P.d) < Math.abs(a - P.d) ? b : a)); }
      }
      t.d += THREE.MathUtils.clamp(t.dT - t.d, -6 * dt, 6 * dt);
      t.y = carGround(t.s, t.d);
      if (t.temp && t.s < P.s - 80) { t.dead = true; scene.remove(t.mesh); continue; }
      if (t.rival) { if (t.s > FINISH_S + 400) t.v = 0; }
      else {
      const maxS = TRAFFIC[t.type].range?.[1] ?? TRAFFIC_MAX_S;
      if (t.s < P.s - 80 || t.s > maxS) {
        t.s = Math.min(maxS - 20, P.s + 320 + Math.random() * 380); t.d = t.dT = randLane(t.type); t.over = false; t.brakeT = 0; t.v = t.base;
        for (const [a, b] of JAMS) if (t.s > a - 40 && t.s < b + 5) t.s = b + 20 + Math.random() * 40;
        if (t.s < P.s + 120) t.s = P.s - 100; // nothing left ahead: park it behind
        t.nm = false; t.pend = null;
      }
      }
    }
    const ds = t.s - P.s, dd = Math.abs(t.d - P.d);
    // near miss: you shot past it with under a metre to spare
    if (!t.nm && t.pds > 0 && ds <= 0 && P.v > t.v + 4 && P.y - t.y < t.h) {
      const clear = dd - t.hw - 0.95;
      if (clear > -0.05 && clear < 1.0) { t.nm = true; stats.nearMiss++; P.boostG = Math.min(100, P.boostG + 8); trick('아슬아슬 추월', 60); blip(1200, 600, 0.08, 'sine', 0.06); }
    }
    t.pds = ds;
    if (t.brakes && t.brakeT <= 0 && t.cool <= 0 && ds > -6 && ds < 26 && dd < 6.5 && P.y < 2) {
      t.brakeT = 2.6;
      if (!radioFlags.has('lidar')) { radioFlags.add('lidar'); floatText('웨이모: 장애물 감지! 급정거!'); }
      else if (Math.random() < 0.3) floatText('웨이모: 장애물 감지!');
    }
    if (Math.abs(ds) < t.hl + 2.2 && dd < t.hw + 1) {
      if (P.y - t.y < t.h - 0.55) {
        // running along a jam's roofs into a taller one (car roof → bus): hop up onto it instead of a dead stop
        if (P.y > 0.8 && P.y - t.y > t.h - 2.4 && P.v > 8 && ds > 0) { P.vy = Math.max(P.vy, 7.5); P.grounded = false; P.y = Math.max(P.y, t.y + t.h - 0.5); }
        else if (ds > -t.hl * 0.5) crash(t);
      }
      else if (!t.over) {
        t.over = true;
        if (P.grounded && P.v < 10) { /* creeping on a roof edge: no score farming */ }
        else if (P.grounded) { // driving across roofs
          stats.roofs++; P.roofRun++; gainXP(3); P.boostG = Math.min(100, P.boostG + 4); trick('지붕 질주', 40, true);
          if (P.roofRun % 5 === 0) floatText(`지붕 질주 ×${P.roofRun}`);
        } else if (P.v > 10) { stats.jumpsOver++; gainXP(15); P.boostG = Math.min(100, P.boostG + 15); blip(600, 900, 0.12); trick('차 뛰어넘기', 120); }
      }
    }
  }
  if (traffic.some((t) => t.dead)) traffic = traffic.filter((t) => !t.dead);

  // pickups
  const R = magnetRange(), cy = P.y + 0.7;
  for (const p of pickups) {
    if (p.taken) continue;
    let ds = p.s - P.s; if (ds > R + 6 || ds < -R) continue;
    // magnet: anything inside the radius flies to the car, faster than the car moves
    const dd = P.d - p.d, dy = cy - p.y, dist = Math.hypot(ds, dd, dy);
    if (p.type !== 'legend' && (p.pulled || dist < R)) {
      p.pulled = true;
      const sp = (P.v + 30) * dt, k = Math.min(1, sp / Math.max(dist, 0.001));
      p.s -= ds * k; p.d += dd * k; p.y += dy * k; ds = p.s - P.s;
    }
    if (Math.abs(p.d - P.d) < PICK[p.type].r && Math.abs(p.y - (P.y + 0.7)) < PICK[p.type].r + 0.4) collect(p);
  }

  // radio
  for (const [s, text, who] of RADIO_SCRIPT) if (P.s > s && !radioFlags.has(s)) { radioFlags.add(s); const c = CAST[who] || CAST.hero; radio(text, c.name, c.ava, c.face); }

  passCheckpoints();
  stepBody(dt);
  mission?.step?.(dt);
  if (P.combo > 0 && P.grounded) { P.comboT -= dt; if (P.comboT <= 0) endCombo(false); }
  if (P.s >= FINISH_S && !P.finished) finish();
  if (P.shake > 0) P.shake -= dt * 1.8;
  return fr0;
}
// Landing grades. PERFECT = soft touchdown with the thrusters firing as you touch (the ring turns gold in the
// last ~0.3 s: hold jump then); GOOD = soft but not timed; HARD = fast and unbraked.
const PERFECT_WINDOW = 0.32;
function land(g) {
  const impact = -(P.vy - elevSlope(P.s) * P.v);
  if (g < 0.5) P.roofRun = 0;
  P.y = g; P.grounded = true; P.lastG = g; P.slope = slopeAt(P.s, P.d, g); P.kG = elevSlope(P.s) + P.slope; P.vy = P.kG * P.v;
  const base = world(P.s, P.d, P.y);
  let grade = 'small';
  if (P.air > 0.45 && impact < 11.5) {
    if (raceT - P.lastThrust < PERFECT_WINDOW) {
      grade = 'perfect'; stats.perfect++; haptic('perfect'); unlockAch('perfect1'); P.boostT = Math.max(P.boostT, 1.0); P.boostG = Math.min(100, P.boostG + 25);
      toast('PERFECT LANDING!', '속도 부스트 · 부스트 게이지 +25', '#38f5ff'); gainXP(5); trick('퍼펙트 착지', 150);
      blip(523, 1046, 0.18, 'triangle', 0.13); setTimeout(() => blip(659, 1318, 0.18, 'triangle', 0.12), 70); setTimeout(() => blip(784, 1568, 0.3, 'triangle', 0.12), 140);
      flash('rgba(120, 240, 255, .35)');
      for (let i = 0; i < 22; i++) puff(base, new THREE.Vector3((Math.random() - 0.5) * 18, Math.random() * 2, (Math.random() - 0.5) * 18), '#aeeaff', 1, 0.5);
    } else {
      grade = 'good'; stats.good++; haptic('land'); P.boostG = Math.min(100, P.boostG + 10); trick('착지', 50); if (impact > 7) damage(2, '서스펜션');
      floatText('굿 랜딩 · 금색 링일 때 점프를 꾹 누르면 퍼펙트'); blip(440, 660, 0.12, 'triangle', 0.1);
    }
  } else if (impact > 19) {
    grade = 'hard'; endCombo(true); damage(9, '하드 랜딩'); haptic('hard');
    P.v *= 0.72; P.shake = 0.6; toast('쿵! 하드 랜딩', '링이 금색일 때 점프를 꾹 = 사뿐 착지', '#ffc83d');
    blip(120, 50, 0.3, 'square', 0.15);
    for (let i = 0; i < 12; i++) puff(base, new THREE.Vector3((Math.random() - 0.5) * 10, Math.random() * 3, (Math.random() - 0.5) * 10), '#a08a7a', 1.3, 0.8);
  }
  mission?.on?.('land', grade);
}
// Korean 와/과 by whether the last syllable has a final consonant
function withWa(w) {
  const c = w.charCodeAt(w.length - 1);
  const batchim = c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 !== 0 : '013678'.includes(w[w.length - 1]);
  return batchim ? '과' : '와';
}
function crash(t) {
  P.v = Math.min(P.v * 0.45, t.v + (t.parked ? 9 : 2)); P.s = t.s - t.hl - 2.3; // parked: enough left to hop onto it
  P.crashT = 0.8; P.shake = 0.8; stats.crashes++; haptic('crash'); damage(t.parked ? 6 : 10, t.name + ' 추돌'); endCombo(true); mission?.on?.('crash', t);
  toast('쾅!', t.name + withWa(t.name) + ' 충돌', '#ff3d6e');
  blip(180, 40, 0.35, 'sawtooth', 0.2);
  const base = world(P.s + 2, P.d, 1);
  for (let i = 0; i < 18; i++) puff(base, new THREE.Vector3((Math.random() - 0.5) * 10, Math.random() * 5, (Math.random() - 0.5) * 10), i % 2 ? '#ffb347' : '#555', 0.9, 0.6);
}
// ---------- checkpoints ----------
// a fall puts you back at the last one you passed (or the stage's own spot before a gap), rolling, in under a second
const CHECKS = (ST.checkpoints || (() => { const out = []; for (let s = 450; s < FINISH_S - 150; s += 450) if (!GAPS.some((g) => s > g.s0 - 90 && s < g.s1 + 30)) out.push(s); return out; })()).slice().sort((a, b) => a - b);
function passCheckpoints() {
  while (P.cpI < CHECKS.length && P.s >= CHECKS[P.cpI]) { P.cp = CHECKS[P.cpI++]; if (state === 'race' && raceT > 1) { floatText('체크포인트'); haptic('check'); blip(880, 1320, 0.1, 'sine', 0.08); } }
}
function respawn(s, v = 46, why) {
  flash('rgba(8, 4, 20, .9)', 0.45);
  Object.assign(P, { s, d: THREE.MathUtils.clamp(P.d, -ROAD_HALF + 1.2, ROAD_HALF - 1.2), y: 0, vy: 0, v, grounded: true, lastG: 0, kG: undefined, air: 0, roll: 0, rollTo: 0, charges: Math.max(P.charges, 1), fuel: AIR_FUEL, shake: 0.2, crashT: 0 });
  P.cpI = CHECKS.findIndex((c) => c > s); if (P.cpI < 0) P.cpI = CHECKS.length;
  // clear the road just ahead so you don't land in someone's boot
  for (const t of traffic) if (!t.parked && !t.rival && t.s > s - 10 && t.s < s + 45) t.s = s + 120 + Math.random() * 80;
  snapCam = true;
}
function splash() {
  const base = world(P.s, P.d, (ST.splashY?.(P.s) ?? -5.5) - 0.5);
  for (let i = 0; i < 30; i++) puff(base, new THREE.Vector3((Math.random() - 0.5) * 10, 6 + Math.random() * 10, (Math.random() - 0.5) * 10), '#bfe9ff', 1.4, 1);
  const [big, small, line] = ST.lines.fall || ['추락!', '+2초', '다시 가자!'];
  toast(big, small.replace('+3초', '+2초'), '#38f5ff');
  radio(line);
  blip(300, 60, 0.5, 'sine', 0.2);
  stats.falls++; endCombo(true); damage(8, '추락'); mission?.on?.('fall');
  const gap = GAPS.find((g) => P.s > g.s0 - 60 && P.s < g.s1 + 60);
  respawn(gap ? Math.max(gap.respawn, Math.min(P.cp, gap.s0 - 120)) : Math.max(P.cp, P.s - (ST.respawnBack ?? 100)), 52);
  penalty += 2;
}
function collect(p) {
  p.taken = true; scene.remove(p.mesh);
  switch (p.type) {
    case 'coin': if (boss?.B.active) P.coil = Math.min(100, P.coil + 6); save.doge += 5; writeSaveSoon(); stats.dogeGain += 5; stats.coins++; P.boostG = Math.min(100, P.boostG + 3); blip(988, 1480, 0.09, 'square', 0.06); break;
    case 'wrench': if (save.parts < PART_MAX) save.parts++; writeSaveSoon(); stats.parts = (stats.parts || 0) + 1; floatText(`수리 부품 +1 (${save.parts}개)`); blip(500, 1000, 0.2, 'triangle', 0.12); break;
    case 'air': P.charges = Math.min(maxCharges(), P.charges + 1); P.fuel = AIR_FUEL; floatText('압축공기 +1'); blip(300, 900, 0.18, 'sine', 0.12); break;
    default: if (boss?.B.active) P.coil = Math.min(100, P.coil + (p.type === 'gpu' ? 22 : 40)); gainXP(PICK[p.type].xp, PICK[p.type].label); blip(660, 1320, 0.16, 'triangle', 0.14);
      if (p.type === 'legend') { toast('전설의 블랙웰 칩!', '+200 EXP', '#b07dff'); radio('그거 젠슨이 찾고 있던 건데… 우리가 가져가자.'); }
      break;
    case 'egg': {
      const e = p.egg; save.eggs[e.id] = Date.now(); writeSave(); stats.eggs = (stats.eggs || 0) + 1;
      toast('이스터에그 발견!', e.name, '#b07dff'); haptic('perfect'); unlockAch('egg1'); flash('rgba(176, 125, 255, .35)'); gainXP(30);
      if (e.line) radio(e.line, e.who);
      blip(523, 1568, 0.4, 'triangle', 0.14); trick('이스터에그', 300);
    }
  }
}
// ---------- achievements ----------
// across the whole game; some unlock mid-run (unlockAch), the rest are checked at the finish line
const ACH = [
  { id: 'perfect1', name: '사뿐히', desc: '첫 퍼펙트 착지' },
  { id: 'combo5', name: '콤보 장인', desc: '콤보 ×5' },
  { id: 'launch', name: '로켓 스타트', desc: '출발 0→100km/h 1.8초 안에' },
  { id: 'clean', name: '무사고 운전', desc: '충돌·추락 없이 완주' },
  { id: 'detour', name: '경로 재탐색 장인', desc: '우회로로 돌아서도 통과' },
  { id: 'line3', name: '인코스의 신', desc: '한 판에 갈림길 정확한 진입 3번' },
  { id: 'onfire', name: '불타는 로드스터', desc: '배터리 화재 상태로 결승 통과' },
  { id: 'egg1', name: '오스틴은 이상해', desc: '이스터에그 첫 발견' },
  { id: 'roof10', name: '지붕 위의 질주', desc: '한 판에 차 지붕 10대 밟기' },
  { id: 'boss', name: '로보택시 해방', desc: '보스 첫 격추' },
];
function unlockAch(id) {
  if (save.ach[id]) return;
  const a = ACH.find((x) => x.id === id); if (!a) return;
  save.ach[id] = Date.now(); writeSaveSoon();
  setTimeout(() => { toast(`업적: ${a.name}`, a.desc, '#ffc83d'); blip(784, 1568, 0.3, 'triangle', 0.12); }, 700);
}
function finish() {
  P.finished = true; state = 'finish';
  const t = raceT + penalty;
  endCombo(false);
  const run = { t, perfect: stats.perfect, score: P.score, crashes: stats.crashes, falls: stats.falls };
  const res = mission.result(run);
  const nStars = res.stars.filter((x) => x.ok).length;
  const pct0 = mapPct(BASE), open0 = ORDER.map((st, si) => stageOpen(si));
  if (res.pass) {
    if (!stats.crashes && !stats.falls) unlockAch('clean');
    if (stats.detours) unlockAch('detour');
    if (hpZone() === 'red') unlockAch('onfire');
    if (boss?.B.defeated) unlockAch('boss');
  }
  if (stats.roofs >= 10) unlockAch('roof10');
  const rec = save.camp[ST.evKey] ??= { done: false, stars: 0, best: 0, score: 0, play: 0, tries: 0 };
  const firstClear = res.pass && !rec.done;
  const partsWon = res.pass ? (firstClear ? 2 : 1) : 0; save.parts = Math.min(PART_MAX, save.parts + partsWon);
  if (res.pass) { rec.done = true; rec.stars = Math.max(rec.stars, nStars); if (!rec.best || t < rec.best) rec.best = t; rec.score = Math.max(rec.score || 0, P.score); }
  if (!EVENTS.length || EVENTS.length === 1) { const prev = save.bests[ST.id]; if (res.pass && (!prev || t < prev)) save.bests[ST.id] = t; }
  writeSave();
  radio(res.pass ? ST.lines.finish : (ST.lines.failed || '괜찮아, 한 번 더 가자.'));
  const goal = res.stars.find((x) => !x.ok && x.gap);
  setTimeout(() => {
    $('rEyebrow').textContent = res.pass ? (ST.text.clear || 'CLEAR') : 'TRY AGAIN';
    $('rTitle').textContent = res.pass ? (ST.text.clearTitle || EV.name) : `${EV.name} 실패`;
    $('rTime').textContent = fmtTime(t);
    $('rBest').textContent = rec.best ? fmtTime(rec.best) : '—';
    $('rStars').innerHTML = res.stars.map((x) => `<span class="${x.ok ? 'on' : ''}" title="${x.text}">★</span>`).join('');
    $('rStarList').innerHTML = res.stars.map((x) => `<li class="${x.ok ? 'on' : ''}">${x.ok ? '★' : '☆'} ${x.text}</li>`).join('');
    $('rPerfect').textContent = stats.perfect;
    $('rScore').textContent = P.score.toLocaleString() + (P.comboBest > 1 ? ` · 최대 ×${P.comboBest}` : '');
    $('rCoins').textContent = `+${stats.dogeGain}`;
    $('rHp').textContent = `${Math.round(save.hp)}/${hpMax()}${stats.damage ? ` (-${Math.round(stats.damage)})` : ''} · 부품 ${save.parts}개${partsWon || stats.parts ? ` (+${partsWon + (stats.parts || 0)})` : ''}`;
    $('rXp').textContent = `+${stats.xpGain} · LV ${save.level}`;
    $('rBoss').textContent = boss?.B.defeated ? '격추' : '놓침';
    $('rBoss').hidden = $('rBoss').previousElementSibling.hidden = !boss;
    $('rRoofs').textContent = stats.roofs;
    $('rRoofRow').hidden = !JAMS.length; $('rRoofRow2').hidden = !JAMS.length;
    // one concrete thing to do next: why it failed, else the nearest star, else the next event
    const nxt = nextEvent();
    $('rGoal').innerHTML = !res.pass ? `<b>다음 목표</b> ${res.fail}` : goal ? `<b>다음 목표</b> ${goal.gap}` : nxt ? `<b>다음</b> ${nxt.label}` : '<b>전부 달성!</b> 엔딩까지 왔어요.';
    $('rGoal').classList.toggle('fail', !res.pass);
    $('nextBtn').hidden = !res.pass || !nxt;
    if (nxt) { $('nextBtn').textContent = `다음: ${nxt.short} →`; $('nextBtn').onclick = () => goStage(nxt.stage, nxt.i); }
    $('againBtn').textContent = res.pass ? '다시 달리기' : '다시 도전';
    $('againBtn').classList.toggle('go', !res.pass); $('againBtn').classList.toggle('ghost', res.pass);
    const pct1 = mapPct(BASE), newly = ORDER.find((st, si) => stageOpen(si) && !open0[si]);
    $('rNext').textContent = `${BASE.name} 진행도 ${pct0}% → ${pct1}%` + (newly ? ` · 새 지역 열림: ${newly.name}!` : pct1 < UNLOCK_PCT && ORDER[ORDER.indexOf(BASE) + 1] ? ` · ${UNLOCK_PCT}%면 다음 지역` : '');
    $('results').hidden = false;
  }, ST.finishDelay ?? 900);
}

// ---------- render sync ----------
const tmpV = new THREE.Vector3(), lookV = new THREE.Vector3(), camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
let orbitT = 0, snapCam = false;
function placeCar() {
  const fr = frame(P.s);
  world(P.s, P.d, P.y, car.position);
  const pitch = P.grounded ? -Math.atan(P.slope + elevSlope(P.s)) : -Math.atan2(P.vy, Math.max(P.v, 10)) * 0.8;
  car.rotation.set(0, 0, 0);
  car.rotation.order = 'YXZ';
  car.rotation.y = fr.yaw - P.steerVis * 0.12;
  car.rotation.x = -pitch; // nose up on the way up (the car faces -z)
  car.rotation.z = -P.steerVis * 0.05 + P.roll;
  // roll around the body's centre (0.55 m up), not the tyre contact point
  const sr = Math.sin(P.roll), cr = 1 - Math.cos(P.roll);
  car.position.addScaledVector(fr.r, 0.55 * sr).y += 0.55 * cr;
  for (const w of car.userData.wheels) w.children.forEach((c) => (c.rotation.x -= P.v * 0.016));
  const under = carGround(P.s, P.d, P.y + 0.01);
  const blob = car.getObjectByName('blob'); if (blob) { blob.visible = under > -100; blob.position.y = 0.03 - P.y + under; blob.material.opacity = 0.9 / (1 + Math.max(0, P.y - under) * 0.35); }
  { const gr = under; magnetRing.visible = gr > -100 && state !== 'poster'; world(P.s, P.d, gr + 0.06, magnetRing.position); magnetRing.scale.setScalar(magnetRange()); }
  car.userData.jet.opacity = P.thrusting ? 0.9 : Math.max(0, car.userData.jet.opacity - 0.08);
  car.userData.tail.color.setRGB(input.brake ? 8 : 4, 0.25, 0.35);
}
let blobTexCache = null;
function blobShadowTex() {
  return blobTexCache ??= canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 6, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,0.8)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
}
function syncTraffic(time) {
  for (const f of jamFleets) if (f.userData.jam) { const [a, b] = f.userData.jam; f.visible = P.s > a - 700 && P.s < b + 60; }
  for (const t of traffic) {
    if (!t.mesh) continue;
    t.mesh.visible = Math.abs(t.s - P.s) < 380; if (!t.mesh.visible) continue;
    world(t.s, t.d, t.y, t.mesh.position);
    t.mesh.rotation.order = 'YXZ'; t.mesh.rotation.set(Math.atan(elevSlope(t.s)), frame(t.s).yaw, 0);
    if (t.mesh.userData.pivot) t.mesh.userData.pivot.rotation.y = time * 5 + t.s;
    for (const w of t.mesh.userData.wheels) w.children[0].rotation.x = -t.s / w.userData.r;
    const braking = t.brakeT > 0;
    t.mesh.userData.tail.color.setRGB(braking ? (Math.sin(time * 18) > 0 ? 8 : 1) : 2.5, braking ? 1.2 : 0.15, 0.2);
  }
}
function syncPickups(time) {
  for (const p of pickups) {
    if (p.taken) continue;
    const near = Math.abs(p.s - P.s) < 420;
    p.mesh.visible = near; if (!near) continue;
    world(p.s, p.d, p.y + Math.sin(time * 3 + p.phase) * 0.15, p.mesh.position);
    p.mesh.rotation.y = time * (p.type === 'coin' ? 3 : 1.4) + p.phase;
    for (const f of p.mesh.userData.fans || []) f.rotation.z = time * 14;
  }
}
// loading-screen staging: the Roadster mid barrel-roll over 6th Street, the boss looming behind
const POSTER = ST.poster;
const PCAM = Object.assign({ back: 10, side: -3.4, y: 1.3, ahead: 10, lookSide: -2.5, lookY: 5.2, fov: 44 }, POSTER.cam);
function posterStage(time) {
  world(POSTER.s, POSTER.d, POSTER.y + Math.sin(time * 1.3) * 0.15, car.position);
  car.rotation.order = 'YXZ';
  car.rotation.set(-0.16, frame(POSTER.s).yaw + 0.25, 0.42 + Math.sin(time * 0.9) * 0.04);
  car.userData.jet.opacity = 0.45 + Math.sin(time * 25) * 0.08;
  const blob = car.getObjectByName('blob'); if (blob) blob.visible = false;
  magnetRing.visible = false;
  boss?.posterPose(POSTER.s + POSTER.boss[0], POSTER.boss[1], POSTER.boss[2], time, POSTER.boss[3] || 0);
}
function updateCamera(dt, time) {
  const fr = frame(P.s);
  if (state === 'finish' && ST.finishCam?.(camera, time)) return; // a stage's own ending (Starbase launch)
  if (state === 'poster' && (boss || ST.poster?.cam)) {
    orbitT += dt * 0.05;
    const sway = Math.sin(orbitT) * 1.2;
    world(POSTER.s - PCAM.back, POSTER.d + PCAM.side + sway, PCAM.y, camPos);
    camera.position.copy(camPos);
    world(POSTER.s + PCAM.ahead, POSTER.d + PCAM.lookSide, PCAM.lookY, camLook); camera.lookAt(camLook);
    camera.fov = PCAM.fov; camera.updateProjectionMatrix();
    return;
  }
  if (state === 'poster' || state === 'loading') {
    orbitT += dt * 0.18;
    const a = orbitT + 0.6;
    camPos.set(car.position.x + Math.sin(a) * 9, car.position.y + 2.3 + Math.sin(orbitT * 0.7) * 0.6, car.position.z + Math.cos(a) * 9);
    camera.position.copy(camPos); camera.lookAt(car.position.x, car.position.y + 0.9, car.position.z);
    camera.fov = 48; camera.updateProjectionMatrix();
    return;
  }
  const speedK = P.v / 70;
  // follow the car's height, but only part of the way up a jump (above where it last stood)
  // sits a little high and aims far down the road, so ramps, gaps and traffic read early
  // high chase cam looking down the road (user ask, 2026-10-24): see further ahead, car sits in the lower middle
  const lift = Math.max(0, P.y - (P.lastG || 0)), back = 10.5 + speedK * 2.6, ahead = 24 + speedK * 8;
  tmpV.copy(car.position).addScaledVector(fr.f, -back); tmpV.y = Math.max(elev(P.s), elev(P.s - back) - 1.5) + Math.max(P.y - lift * 0.3, 0) + 6.4 + speedK * 0.8;
  lookV.copy(car.position).addScaledVector(fr.f, ahead); lookV.y = elev(P.s + ahead) + P.y - lift * 0.45 - 4.2; // aim below the road ahead: tilts the view down so the car stays clear of the bottom HUD
  const k = snapCam ? 1 : Math.min(1, dt * 7);
  camPos.lerp(tmpV, k); camLook.lerp(lookV, snapCam ? 1 : Math.min(1, dt * 10)); snapCam = false;
  camera.position.copy(camPos);
  if (P.shake > 0) camera.position.add(new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5), 0).multiplyScalar(P.shake * 0.6));
  camera.lookAt(camLook);
  const targetFov = 64 + speedK * 12 + (P.boostT > 0 || P.launchT > 0 ? 9 : 0);
  camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 3); camera.updateProjectionMatrix();
}

// ---------- post ----------
const composer = new EffectComposer(renderer);
composer.setPixelRatio(Q.pr);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth * Q.bloomRes, innerHeight * Q.bloomRes), ENV.bloom ?? 0.6, 0.5, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());
function resize() {
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  bloom.resolution.set(innerWidth * Q.bloomRes, innerHeight * Q.bloomRes);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

// ---------- flow ----------
function startRace() {
  initAudio(); if (AC && AC.state === 'suspended') AC.resume();
  $('poster').hidden = true; $('results').hidden = true; $('garage').hidden = true; $('hud').hidden = false;
  resetRace(); placeCar(); buildRoute(); setPause(false);
  (save.camp[ST.evKey] ??= { done: false, stars: 0, best: 0, score: 0, play: 0, tries: 0 }).tries++; writeSaveSoon();
  const fr = frame(0); camPos.copy(car.position).addScaledVector(fr.f, -9); camPos.y = 3.4; camLook.copy(car.position);
  state = 'count'; countdown = 3.2;
}
// ---------- X Garage ----------
function renderGarage() { passDoge();
  grantParts();
  $('gDoge').textContent = save.doge.toLocaleString();
  const left = save.parts >= PART_MAX ? '가득' : `${Math.ceil((PART_EVERY - (Date.now() - save.partsT)) / 60000)}분 뒤 +1`;
  $('gRepair').innerHTML = `<div><h3>차체 내구도 ${Math.round(save.hp)} / ${hpMax()}</h3><div class="hpbar" data-z="${hpZone()}"><i style="width:${100 * hpF()}%"></i><b style="left:${RED * 100}%"></b><b style="left:${GREEN * 100}%"></b></div><p>수리 부품 ${save.parts}/${PART_MAX}개 · ${left} · 부품 1개 = 최대의 ${PART_FRAC * 100}%</p></div>
    <div class="rbtns"><button class="buy" data-repair="part" ${save.hp >= hpMax() || save.parts < 1 ? 'disabled' : ''}>부품으로 수리</button><button class="buy alt" data-repair="doge" ${save.hp >= hpMax() || save.doge < 120 ? 'disabled' : ''}>Ð 120 수리</button></div>`;
  $('gList').innerHTML = Object.entries(UPGRADES).map(([k, u]) => {
    const l = save.up[k], maxed = l >= u.max, cost = u.cost(l);
    return `<div class="gitem"><div><h3>${u.name}</h3><div class="lvl">${'<i class="on"></i>'.repeat(l)}${'<i></i>'.repeat(u.max - l)}</div></div>
      <button class="buy" data-up="${k}" ${maxed || save.doge < cost ? 'disabled' : ''}>${maxed ? 'MAX' : `Ð ${cost.toLocaleString()}`}</button>
      <p>지금: ${u.desc(l)}${maxed ? '' : ` → <b>${u.desc(l + 1)}</b>`}</p></div>`;
  }).join('');
}
$('gRepair').addEventListener('click', (e) => {
  const k = e.target.closest('[data-repair]')?.dataset.repair; if (!k) return;
  if (repair(k === 'doge')) { initAudio(); blip(400, 1200, 0.3, 'triangle', 0.15); renderGarage(); refreshSaveLine(); }
});
$('gList').addEventListener('click', (e) => {
  const k = e.target.closest('[data-up]')?.dataset.up; if (!k) return;
  const u = UPGRADES[k], l = save.up[k], cost = u.cost(l);
  if (l >= u.max || save.doge < cost) return;
  save.doge -= cost; save.up[k]++; passDoge(); writeSave(); renderGarage(); refreshSaveLine();
  initAudio(); blip(520, 1560, 0.25, 'triangle', 0.15);
});
function openGarage() { renderGarage(); $('garage').hidden = false; $('gClose').focus(); }
$('garageBtn').addEventListener('click', openGarage);
$('garageBtn2').addEventListener('click', openGarage);
$('gClose').addEventListener('click', () => { $('garage').hidden = true; });
const PASS_DOGE = 9999999;
function passDoge() { if (!save.allPass) return; if (save.dogeReal == null) save.dogeReal = save.doge; save.doge = PASS_DOGE; } // a save from before this field parks its balance on first use
function refreshSaveLine() { passDoge(); grantParts(); const b = save.camp[ST.evKey]?.best || save.bests[ST.id]; $('saveLine').textContent = `LV ${save.level} · Ð ${save.doge.toLocaleString()} · 차체 ${Math.round(100 * hpF())}% · 부품 ${save.parts}${b ? ` · 최고 기록 ${fmtTime(b)}` : ''}`; }
// stage texts, stage picker, next-stage button
// ---------- campaign ----------
// every event of every region in play order; an event opens when the one before it is cleared
const CAMPAIGN = ORDER.flatMap((st, si) => (st.events || [{ id: 'run', name: st.name }]).map((e, i) => ({ st, si, e, i, key: `${st.id}:${e.id}` })));
// all-pass: every region and event open for testing/trying (poster toggle, or ?unlock); progress still counts
const URL_UNLOCK = new URLSearchParams(location.search).has('unlock');
let UNLOCK_ALL = URL_UNLOCK || !!save.allPass;
const isDone = (k) => !!save.camp[CAMPAIGN[k].key]?.done || (CAMPAIGN[k].e.id === 'run' && !!save.bests[CAMPAIGN[k].st.id]);
// map progress: each event is worth 4 (clear + 3 stars), each easter egg 1. A region opens when the one
// before it reaches UNLOCK_PCT (one-run regions: when that run is cleared). Inside a region the tutorial
// comes first, then every destination is open to pick from; the boss opens after two of them.
const UNLOCK_PCT = 60;
function mapUnits(st) {
  const evs = st.events || [{ id: 'run' }];
  let got = 0, all = evs.length * 4 + (st.eggs?.length || 0);
  for (const e of evs) { const r = save.camp[`${st.id}:${e.id}`]; if (r?.done) got += 1 + (r.stars || 0); else if (e.id === 'run' && save.bests[st.id]) got += 1; }
  for (const e of st.eggs || []) if (save.eggs[e.id]) got++;
  return { got, all };
}
const mapPct = (st) => { const u = mapUnits(st); return Math.round(100 * u.got / u.all); };
function stageOpen(si) {
  if (UNLOCK_ALL || si === 0) return true;
  const prev = ORDER[si - 1];
  if (!prev.events || prev.events.length < 2) return CAMPAIGN.some((c, k) => c.st === prev && isDone(k));
  return mapPct(prev) >= UNLOCK_PCT;
}
function isOpen(k) {
  const c = CAMPAIGN[k];
  if (UNLOCK_ALL || isDone(k)) return true;
  if (!stageOpen(c.si)) return false;
  const evs = c.st.events; if (!evs || evs.length < 2 || c.i === 0) return true;
  const ks = CAMPAIGN.map((x, j) => j).filter((j) => CAMPAIGN[j].st === c.st);
  if (!isDone(ks[0])) return false; // tutorial first
  if (c.e.mission?.type === 'boss') return ks.filter((j) => j !== k && j !== ks[0] && isDone(j)).length >= 2;
  return true;
}
const curK = CAMPAIGN.findIndex((c) => c.key === ST.evKey);
const label = (c) => (c.st.events ? `${c.st.name} · ${c.e.name}` : c.st.name);
function nextEvent() {
  const c = CAMPAIGN[curK + 1]; if (!c) return null;
  return { stage: c.st.id, i: c.i, label: label(c), short: c.st.events ? c.e.name : c.st.name };
}
const fmtPlay = (t) => (t >= 3600 ? `${Math.floor(t / 3600)}시간 ${Math.floor(t % 3600 / 60)}분` : `${Math.floor(t / 60)}분 ${Math.floor(t % 60)}초`);
const TYPE_NAME = { tutorial: '연습', deliver: '배송', stunt: '스턴트', rivals: '레이스', boss: '보스전', race: '주행', hunt: '사냥' };
function allPassUI() {
  const b = $('passBtn'); if (!b) return;
  b.textContent = UNLOCK_ALL ? '🔓 올패스 켬' : '🔒 올패스'; b.classList.toggle('on', UNLOCK_ALL);
  b.onclick = () => {
    save.allPass = !save.allPass; UNLOCK_ALL = URL_UNLOCK || save.allPass;
    // all-pass money: the real balance is parked and comes back when all-pass goes off
    if (save.allPass) { save.dogeReal = save.doge; passDoge(); } else if (save.dogeReal != null) { save.doge = save.dogeReal; delete save.dogeReal; }
    writeSave(); haptic('tap'); renderCampaign(); allPassUI(); refreshSaveLine();
  };
}
function renderCampaign() {
  // region chips: progress per region
  $('stagePick').innerHTML = ORDER.map((st, si) => {
    const ks = CAMPAIGN.map((c, k) => k).filter((k) => CAMPAIGN[k].si === si);
    const open = stageOpen(si), pct = mapPct(st);
    return `<button type="button" class="chip${st === BASE ? ' on' : ''}${open ? '' : ' locked'}" data-stage="${st.id}" ${open ? '' : 'disabled'}>${String(st.num).padStart(2, '0')} ${st.name}${open && pct ? ` <small>${pct}%</small>` : ''}</button>`;
  }).join('');
  $('stagePick').onclick = (e) => { const id = e.target.closest('[data-stage]:not([disabled])')?.dataset.stage; if (!id || id === BASE.id) return; const st = STAGES[id]; const ks = CAMPAIGN.map((c, k) => k).filter((k) => CAMPAIGN[k].st === st); const k = ks.find((x) => isOpen(x) && !isDone(x)) ?? ks[0]; goStage(id, CAMPAIGN[k].i); };
  // this region's events
  const evs = CAMPAIGN.map((c, k) => ({ c, k })).filter(({ c }) => c.st === BASE);
  $('evList').hidden = evs.length < 2;
  $('evList').innerHTML = evs.map(({ c, k }) => {
    const r = save.camp[c.key], open = isOpen(k), stars = r?.done ? r.stars : 0;
    return `<button type="button" class="ev${c.key === ST.evKey ? ' on' : ''}${open ? '' : ' locked'}" data-i="${c.i}" ${open ? '' : 'disabled'}>
      <span class="n">${c.i + 1}</span><span class="t"><b>${c.e.name}</b><small>${TYPE_NAME[c.e.mission?.type || 'race']}${r?.play ? ` · ${fmtPlay(r.play)}` : ''}</small></span>
      <span class="s">${open ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : '🔒'}</span></button>`;
  }).join('');
  $('evList').onclick = (e) => { const b = e.target.closest('[data-i]:not([disabled])'); if (b && +b.dataset.i !== EV_I) goStage(BASE.id, +b.dataset.i); };
  // continue: the first open event not cleared yet
  const ck = CAMPAIGN.findIndex((c, k) => isOpen(k) && !isDone(k));
  const cont = CAMPAIGN[ck];
  $('contBtn').hidden = !cont || cont.key === ST.evKey;
  if (cont) { $('contBtn').textContent = `이어하기: ${label(cont)}`; $('contBtn').onclick = () => goStage(cont.st.id, cont.i); }
  const u = mapUnits(BASE), pct = mapPct(BASE), eggs = (BASE.eggs || []).filter((e) => save.eggs[e.id]).length, si = ORDER.indexOf(BASE), nextSt = ORDER[si + 1];
  $('mapProg').hidden = false;
  $('mapPct').textContent = `${pct}%`; $('mapBar').style.width = `${pct}%`; $('mapBar').parentElement.style.setProperty('--gate', `${UNLOCK_PCT}%`);
  $('mapInfo').textContent = `${BASE.name} 진행도 · 별 ${u.got - eggs}/${u.all - (BASE.eggs?.length || 0)}${BASE.eggs?.length ? ` · 이스터에그 ${eggs}/${BASE.eggs.length}` : ''}` + (nextSt ? (stageOpen(si + 1) ? ` · ${nextSt.name} 열림` : ` · ${UNLOCK_PCT}%면 ${nextSt.name} 열림`) : '');
  const achN = ACH.filter((a) => save.ach[a.id]).length;
  $('campLine').textContent = `업적 ${achN}/${ACH.length} · 플레이 ${fmtPlay(save.play || 0)}`;
  $('campLine').title = ACH.map((a) => `${save.ach[a.id] ? '✓' : '·'} ${a.name}: ${a.desc}`).join('\n');
}
// stage texts, event brief
function stageUI() {
  const T = ST.text;
  const multi = EVENTS.length > 1;
  $('pEyebrow').textContent = multi ? `CHAPTER ${String(BASE.num).padStart(2, '0')} · ${EV_I + 1}/${EVENTS.length} ${TYPE_NAME[EV.mission?.type || 'race']}` : T.eyebrow;
  $('pTitle').textContent = T.title; $('pSub').textContent = multi ? EV.name : T.sub;
  // long names (SAN FRANCISCO) shrink until the longest word fits the column
  const fitTitle = () => { const el = $('pTitle'); el.style.fontSize = ''; el.style.whiteSpace = 'nowrap'; const w = el.clientWidth; el.style.whiteSpace = '';
    const words = T.title.split(' '); const probe = document.createElement('span'); probe.style.whiteSpace = 'nowrap'; el.textContent = ''; el.append(probe);
    let worst = 0; for (const wd of words) { probe.textContent = wd; worst = Math.max(worst, probe.offsetWidth); } el.textContent = T.title;
    if (worst > w && w > 0) el.style.fontSize = `${parseFloat(getComputedStyle(el).fontSize) * w / worst * 0.97}px`; };
  fitTitle(); document.fonts?.ready.then(fitTitle); addEventListener('resize', fitTitle);
  $('pTip').innerHTML = EV.brief || T.tip; $('pTweet').textContent = T.tweet; $('pMeta').textContent = T.meta; $('loadTxt').textContent = T.load;
  $('hudStage').textContent = multi ? `${BASE.name} · ${EV.name}` : T.hud;
  $('mTitle').textContent = EV.mission ? EV.name : '';
  renderCampaign(); allPassUI();
  document.title = `Roadster Racer · ${ST.name}`;
}

$('startBtn').addEventListener('click', startRace);
$('againBtn').addEventListener('click', startRace);
$('mapBtn').addEventListener('click', () => location.reload());

let last = performance.now(), tickAcc = 0, playSaveT = 0;
setInterval(() => { if (grantParts() && state !== 'race') refreshSaveLine(); }, 15000);
const TICK = 1 / 120; // fixed physics tick, deterministic for future replays and ghosts
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const time = now / 1000;
  if (state === 'count') {
    countdown -= dt;
    const n = Math.ceil(countdown);
    hud.count.textContent = n > 0 ? n : 'GO!'; hud.count.hidden = countdown < -0.6;
    if (countdown <= 0) { state = 'race'; hud.count.textContent = 'GO!'; blip(880, 880, 0.3, 'square', 0.1); P.launchT = 1.15; hissBurst(1.2); radio(RADIO_SCRIPT[0][1]); radioFlags.add(RADIO_SCRIPT[0][0]); }
    else if (Math.ceil(countdown + dt) !== n) blip(440, 440, 0.15, 'square', 0.08);
  }
  if (state === 'race' && !hud.count.hidden && raceT > 0.8) hud.count.hidden = true;
  if (state === 'race' && !paused && !window.__game?.manual && !boss?.inCut) { tickAcc += dt / SLOW; while (tickAcc >= TICK) { step(TICK); tickAcc -= TICK; } }
  else if (state === 'finish') { P.v = Math.max(0, P.v - 30 * dt / SLOW); P.s += P.v * dt / SLOW; P.thrusting = false; }
  if (state !== 'loading') { placeCar(); syncTraffic(time); syncPickups(time); boss?.sync(time); }
  if (state === 'poster') posterStage(time);
  ST.tick?.(time, camera, { state, P, car });
  updateColdGas(dt, time); updateLandMark(time); updatePuffs(dt); updateRadio(dt);
  // real play time per event (what a person actually spent here), saved every few seconds
  if (!paused && (state === 'race' || state === 'count' || (state === 'finish' && $('results').hidden))) {
    const rec = save.camp[ST.evKey] ??= { done: false, stars: 0, best: 0, score: 0, play: 0, tries: 0 };
    rec.play += dt; save.play += dt; if ((playSaveT += dt) > 5) { playSaveT = 0; writeSave(); }
  }
  if (toastT > 0) toastT -= dt;
  if (!window.__game?.frozen) {
    // a boss entrance cutscene owns the camera while it plays; the chase cam then eases back from that shot
    if (boss?.inCut && boss.cine(paused ? 0 : dt, time, camera)) { camPos.copy(camera.position); camLook.copy(car.position); }
    else updateCamera(dt, time);
  }
  sky.position.copy(camera.position);
  const fr = frame(P.s || 0);
  sun.position.copy(car.position).addScaledVector(SUN_DIR, 80); sun.position.y = car.position.y + 45; sun.target.position.copy(car.position);
  if (state !== 'poster' && state !== 'loading') updateHUD();
  updateAudio();
  composer.render();
  requestAnimationFrame(loop);
}

// ---------- boot ----------
const carReady = Promise.race([
  upgradeRoadster(car).catch((e) => console.warn('real roadster failed, keeping stand-in', e)),
  new Promise((ok) => setTimeout(ok, 20000)),
]);
async function boot() {
  await propsReady; await headsReady;
  try { Object.assign(FACES, portraits(HEAD_LIST)); } catch (e) { console.warn('portraits failed', e); }
  const tav = document.querySelector('.tweet .av'); if (tav && FACES.elon) { tav.textContent = ''; tav.style.background = `url(${FACES.elon}) center / 150% no-repeat #333`; }
  buildWorld();
  await carReady; await trafficReady;
  car.add(coldGas);
  try {
    boss = createBoss({ damage, faces: FACES, noCut: () => !!window.__game?.manual, scene, P, LANES, ROAD_HALF, world, frame, carGround, puff, toast, radio, floatText, blip, gainXP, $, camera, car, addTraffic, crash, traffic: () => traffic,
      addPuddle: (q) => PUDDLES.push(q), removePuddle: (q) => { const i = PUDDLES.indexOf(q); if (i >= 0) PUDDLES.splice(i, 1); },
      addDoge: (n) => { n = Math.max(n, -save.doge); save.doge += n; stats.dogeGain += n; writeSaveSoon(); } }, ST.boss, trafficProtos, ST.bossOpts);
  } catch (e) { console.warn('boss skipped', e); boss = null; }
  $('credits').textContent = '3D models: ' + ROADSTER_CREDIT + ' · ' + Object.values(CARS).map((c) => c.credit).join(' · ') + ' · ' + [...propCredits(ST.props || []), ...headCredits(HEAD_LIST)].map((c) => c + ' · ').join('') + 'Textures & HDRI: Poly Haven, ambientCG (CC0) · Earth & stars: NASA Blue Marble, Black Marble, SVS Deep Star Maps' + (CITY ? ' · Map data © OpenStreetMap contributors (ODbL)' : '') + (loadFailed.length ? ' · ⚠ ' + loadFailed.join(' / ') : '');
  resetRace(); placeCar(); syncTraffic(0); syncPickups(0);
  state = 'poster';
  $('startBtn').disabled = false; $('startBtn').textContent = '출발';
  $('loadTxt').hidden = true;
  refreshSaveLine();
}
stageUI();
document.fonts?.ready.then(() => setTimeout(boot, 30)) ?? setTimeout(boot, 30);
requestAnimationFrame(loop);
window.__game = { gripLimit, save, ST, get boss() { return boss; }, get pickups() { return pickups; }, get traffic() { return traffic; }, P, get state() { return state; }, input, scene, camera, car, THREE, realcars: { loadCar, instance, CARS }, models: { makeRoadster, makeWaymo, makeCybercab, makeRTX5090, makeH100 },
  gunDbg: () => ({ heat: P.heat, over: P.overheat, me: world(P.s, P.d, P.y + 1).toArray(), targets: gunTargets().map((t) => t.pos.toArray()), live: gunShots.filter((x) => x.live).length }),
  freeze(on) { this.frozen = on; }, skipCount() { countdown = 0.01; }, snap() { snapCam = true; }, pcam: PCAM, get stage() { return ST; }, renderer, step: (dt) => step(dt),
  // for the autopilot that measures clean-run times: with manual set, only step() advances the race
  manual: false, get mission() { return mission; }, get raceT() { return raceT + penalty; }, ramps: RAMPS, finishS: FINISH_S, LANES, curvature, forkAt, carGround };
