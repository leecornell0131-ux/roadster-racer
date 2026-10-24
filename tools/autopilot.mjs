// Autopilot: drives each event headless with a simple rule-based player and reports the clean-run
// game time, pass/fail and stars. It measures how long the content takes for a competent, retry-free
// run; a real first-time player is slower. usage: node tools/autopilot.mjs austin:0 austin:1 ...
// needs: a static server for the repo on :8123 and Playwright's Chromium.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';
const three = new URL('../node_modules/three/', import.meta.url).pathname;
const evs = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const ev of evs) {
  const p = await b.newPage({ viewport: { width: 480, height: 270 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.text().startsWith('bot')) console.log(m.text()); });
  await p.addInitScript(() => { window.__dbg = true; });
  await p.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', (r) => r.fulfill({ body: readFileSync(three + r.request().url().split('three@0.160.0/')[1]), contentType: 'application/javascript' }));
  const [st, i] = ev.split(':');
  await p.goto(`http://localhost:8123/index.html?stage=${st}&ev=${i}&unlock`);
  await p.waitForFunction(() => window.__game && __game.state === 'poster', null, { timeout: 120000 });
  await p.evaluate(() => { localStorage.clear(); });
  await p.evaluate(() => { document.getElementById('startBtn').click(); __game.skipCount(); __game.manual = true; });
  await p.waitForFunction(() => __game.state === 'race', null, { timeout: 30000 });
  let res = null;
  for (let chunk = 0; chunk < 200 && !res; chunk++) {
    res = await p.evaluate(() => {
      const g = __game, P = g.P, I = g.input, ST = g.stage, M = ST.mission || {};
      const B = (g.bot ??= { t: 0, jumpT: 0, rollT: 0, fireT: 0 });
      const DT = 1 / 120;
      for (let n = 0; n < 120 * 5; n++) {
        if (g.state !== 'race') break;
        B.t += DT;
        // where to be: the clearest lane, a delivery bay, a tutorial gate
        const ahead = (lane) => { let best = 999; for (const t of g.traffic) { if (t.dead || Math.abs(t.d - lane) > 2.7) continue; const ds = t.s - P.s; if (ds > -4 && ds < best) best = ds; } return best; };
        if (B.lane == null || B.t > (B.laneT || 0)) {
          const cur = g.LANES.reduce((a, l) => (Math.abs(l - P.d) < Math.abs(a - P.d) ? l : a), g.LANES[0]);
          const clear = ahead(cur);
          if (clear < 70) { let bestL = cur, bestC = clear; for (const l of g.LANES) { const c = ahead(l) - Math.abs(l - P.d) * 1.5; if (c > bestC + 8) { bestC = c; bestL = l; } } B.lane = bestL; } else B.lane = cur;
          B.laneT = B.t + 0.35;
        }
        let td = B.lane, wantV = null;
        const hud = g.mission?.hud?.().line || '';
        if (M.type === 'deliver') {
          const nx = M.stops.find((s) => s.s > P.s - 3 && !(B.done || []).includes(s.s));
          if (nx && nx.s - P.s < 260) { td = nx.d; if (nx.s - P.s < P.v * P.v / 45 + 14) { wantV = 3; I.boost = false; } if (Math.abs(nx.s - P.s) < 4 && P.v < 4) { B.dwell = (B.dwell || 0) + DT; if (B.dwell > 0.7) { (B.done ??= []).push(nx.s); B.dwell = 0; } } }
        }
        if (M.type === 'tutorial') {
          const k = +hud.split('/')[0];
          if (k === 1) td = -7.5; else if (k === 2) td = 7.5; else td = 0;
          if (k === 3 && P.s > 452 && P.s < 466 && P.grounded) I.jumpEdge = true;
          if (k === 5 && P.boostG >= 35) I.boost = true;
          if (k === 6 && P.grounded && P.charges > 0 && B.t > B.rollT) { I.jumpEdge = true; B.rollT = B.t + 2; I.axis = 1; }
        }
        // stunt: jump and roll whenever charged, the show wants tricks
        if (M.type === 'stunt' && P.grounded && P.charges > 1 && B.t > B.rollT) { I.jumpEdge = true; B.rollT = B.t + 1.6; }
        // corners: hold a speed the tyres can carry
        let kMax = 0; for (let ds = 0; ds < 60; ds += 5) kMax = Math.max(kMax, Math.abs(g.curvature(P.s + ds)));
        if (kMax > 0) { const vc = Math.sqrt(58 / kMax); if (P.v > vc + 1.5) wantV = Math.min(wantV ?? 1e9, vc); }
        // steering: proportional to the error plus the bend's push
        const ff = -(P.lat || 0) * 0.075 / 15;
        I.axis = Math.max(-1, Math.min(1, (td - P.d) * 0.3 + ff * (P.grounded ? 1 : 0)));
        if (M.type === 'tutorial' && +hud.split('/')[0] === 6 && !P.grounded) I.axis = 1;
        I.brake = wantV != null && P.v > wantV;
        // perfect landing: thrust just before touchdown
        if (!P.grounded) { const gr = g.carGround(P.s, P.d, P.y), fall = -(P.vy - (P.kG || 0) * 0); I.jump = fall > 0 && (P.y - gr) / Math.max(fall, 0.1) < 0.7; } else I.jump = false;
        if (M.type !== 'tutorial' && P.boostG >= 35 && kMax < 0.004 && !I.brake) I.boost = true; else if (M.type !== 'tutorial') I.boost = false;
        if (g.boss?.B.active && B.t > B.fireT) { I.fireEdge = true; B.fireT = B.t + 0.8; }
        // gun stages: hold fire in bursts so it never overheats
        if (g.ST?.gun) I.fire = P.overheat <= 0 && P.heat < (I.fire ? 85 : 40);
        I.gas = true;
        g.step(DT);
        I.jumpEdge = false; if (M.type === 'tutorial') I.boost = false;
      }
      if (g.state === "race") { if (window.__dbg) console.warn("bot", P.s | 0, P.d.toFixed(1), P.v | 0, g.mission?.hud?.().line); return null; }
      return { t: +g.raceT.toFixed(1), stars: [...document.querySelectorAll('#rStarList li')].map((l) => l.className), s: P.s | 0 };
    });
  }
  await p.waitForTimeout(1500);
  const out = await p.evaluate(() => ({ title: document.getElementById('rTitle').textContent, stars: [...document.querySelectorAll('#rStarList li')].map((l) => l.textContent), goal: document.getElementById('rGoal').textContent, play: JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.includes('roadster')) || 'x') || 'null')?.camp }));
  console.log(ev, JSON.stringify({ t: res?.t, s: res?.s, ...out, errs: errs.slice(0, 3) }));
  await p.close();
}
await b.close();
