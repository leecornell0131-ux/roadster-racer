// Lays out each event's track the way the engine does (turns or cx) and reports self-crossings:
// stretches more than 150 m apart along the road that come within `min` metres of each other.
// usage: node tools/check-track.mjs austin [min=40]
import { STAGES } from '../src/stages/index.js';
const [, , id = 'austin', minArg = '40'] = process.argv;
const st = STAGES[id], MIN = +minArg;
for (const ev of st.events || [{ id: 'run' }]) {
  const T = { ...st, ...ev };
  const pts = [];
  if (T.turns) {
    let x = 0, z = 0, h = 0;
    const k = (s) => { let c = 0; for (const t of T.turns) { const L = Math.abs(t.a) * t.r; if (Math.abs(s - t.s) < L / 2) c += t.a / L; } return c; };
    for (let s = 0; s <= T.finish + 300; s++) { const c = k(s + 0.5); x += -Math.sin(h + c / 2); z += -Math.cos(h + c / 2); h += c; if (s % 5 === 0) pts.push([s, x, z]); }
  } else for (let s = 0; s <= T.finish + 300; s += 5) pts.push([s, T.cx(s), -s]);
  let worst = null;
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    if (pts[j][0] - pts[i][0] < 150) continue;
    const d = Math.hypot(pts[i][1] - pts[j][1], pts[i][2] - pts[j][2]);
    if (d < MIN && (!worst || d < worst.d)) worst = { d, a: pts[i][0], b: pts[j][0] };
  }
  const xs = pts.map((p) => p[1]), zs = pts.map((p) => p[2]);
  console.log(`${ev.id.padEnd(9)} len ${T.finish}  box ${(Math.max(...xs) - Math.min(...xs)) | 0} x ${(Math.max(...zs) - Math.min(...zs)) | 0} m  ${worst ? `CLOSE ${worst.d.toFixed(0)} m at s ${worst.a} / ${worst.b}` : 'ok'}`);
}
