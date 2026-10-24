// Shared helpers for events that run on real OpenStreetMap streets (see src/osm.js and the route field).
// the big corners of a real route that have room for a fork (no other corner within 330 m either side)
export function bigTurns(R, n = 2) {
  const big = R.turns.filter((t) => Math.abs(t.a) > 1.2 && t.s > 420 && t.s < R.finish - 330);
  return big.filter((t) => !R.turns.some((u) => u !== t && Math.abs(u.a) > 0.25 && Math.abs(u.s - t.s) < 330)).slice(0, n);
}
// a ramp pattern for a stretch: alternating sides, a wide centre kicker now and then
export function rampRun(s0, s1, every = 230, seed = 1) {
  const out = []; let i = seed;
  for (let s = s0; s < s1; s += every + ((i * 37) % 60), i++) {
    const k = i % 5;
    if (k === 0) out.push({ s0: s, len: 18, dL: -6, dR: 6, h: 3.4 });
    else if (k === 1) out.push({ s0: s, len: 16, dL: -12, dR: -5, h: 2.6 });
    else if (k === 2) out.push({ s0: s, len: 16, dL: 5, dR: 12, h: 2.6 });
    else if (k === 3) { out.push({ s0: s, len: 14, dL: -12, dR: -6, h: 2.4 }); out.push({ s0: s, len: 14, dL: 6, dR: 12, h: 2.4 }); }
    else out.push({ s0: s, len: 16, dL: -3, dR: 6, h: 4.0 });
  }
  return out;
}

// a city street cross-section for real-map events: 4 lanes, 12 m half width
export const CITY_ROAD = { roadHalf: 12, lanes: [-9, -3, 3, 9] };
