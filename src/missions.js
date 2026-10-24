// Event missions: what an event asks of you on top of reaching the finish. One object per run, made by
// createMission(def, ctx). The engine calls step(dt) every tick, on(evt, data) for things that happen
// (land, crash, trick, fall), hud() for the objective line, and result(run) at the finish.
// result() returns { pass, fail?, stars: [{ ok, text, gap }] x3 }; the first star not met is the next goal.
import * as THREE from 'three';

// the world runs SLOW times slower than its own clock (user: it felt like 1.5x fast-forward, 2026-10-24).
// Physics, limits and records stay in game seconds; anything shown to the player is in real seconds.
export const SLOW = 1.5;
const fmt = (t) => { t *= SLOW; return `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`; };
const timeStar = (run, T) => ({ ok: run.t <= T, text: `${fmt(T)} 이내`, gap: `${((run.t - T) * SLOW).toFixed(1)}초만 더 빠르면 ★` });
const perfectStar = (run, n) => ({ ok: run.perfect >= n, text: `퍼펙트 착지 ${n}번`, gap: `퍼펙트 착지 ${n - run.perfect}번만 더 (링이 금색일 때 점프 꾹)` });

export function createMission(def = {}, ctx) {
  const make = TYPES[def.type || 'race'];
  return make(def, ctx);
}

const TYPES = {
  // reach the finish; stars for time and landings (the old stage rules)
  race(def, ctx) {
    return {
      title: def.title || '결승선까지',
      hud: () => ({ line: def.line || '결승선까지 달려요' }),
      result: (run) => {
        if (!def.bossStar) return { pass: true, stars: [{ ok: true, text: '완주' }, timeStar(run, def.time ?? 70), perfectStar(run, def.perfect ?? 3)] };
        const win = !!ctx.boss()?.B.defeated, t = timeStar(run, def.time ?? 70), pf = perfectStar(run, def.perfect ?? 3);
        return { pass: true, stars: [{ ok: true, text: '완주' }, { ok: win, text: '보스 격추', gap: '보스를 격추하면 ★' }, { ok: t.ok || pf.ok, text: `${t.text} 또는 ${pf.text}`, gap: t.gap }] };
      },
    };
  },

  // the boss must go down; the run is the fight
  boss(def, ctx) {
    return {
      title: def.title || '보스전',
      hud: () => { const B = ctx.boss()?.B; return { line: !B?.active && !B?.done ? '보스가 곧 나타나요' : B?.defeated ? '격추! 결승선까지' : `코일(F·⚡)과 점프 공격으로 격추` }; },
      result: (run) => {
        const win = !!ctx.boss()?.B.defeated;
        return { pass: win, fail: win ? null : `${ctx.boss()?.B.def.name || '보스'}가 도망쳤어요. 코일을 모아서 쏘고, 경사로 점프로 들이받으세요.`,
          stars: [{ ok: win, text: '보스 격추', gap: '보스를 격추하면 통과' }, perfectStar(run, def.perfect ?? 3), timeStar(run, def.time ?? 80)] };
      },
    };
  },

  // stop in each glowing bay (brake, under 6 m/s) to drop a passenger off
  deliver(def, ctx) {
    const stops = def.stops.map((st) => ({ ...st, state: 'wait', dwell: 0 }));
    const bays = stops.map((st) => bay(ctx, st));
    let done = 0, missed = 0;
    return {
      title: def.title || '배송',
      step(dt) {
        const P = ctx.P;
        // stop assist: in the stop's lane on the run-in, the car eases itself down to pickup speed
        // (user: too fast to pick passengers up, 2026-10-24); change lanes to drive past instead
        const next = stops.find((st) => st.state === 'wait');
        if (next && P.grounded && Math.abs(P.d - next.d) < 4) {
          const ahead = next.s - P.s;
          if (ahead > -8 && ahead < 90) { const vt = 7 + Math.max(0, ahead) * 0.32; if (P.v > vt) { P.v = Math.max(vt, P.v - 34 * dt); next.assist = true; } }
        }
        stops.forEach((st, i) => {
          if (st.state !== 'wait') return;
          const inside = Math.abs(P.s - st.s) < 9 && Math.abs(P.d - st.d) < 3.4 && P.grounded;
          if (inside && P.v < 10) {
            st.dwell += dt;
            if (st.dwell > 0.3) { st.state = 'done'; done++; bays[i].done(); ctx.trick('배송 완료', 250); ctx.toast(st.name, st.thanks || '별 다섯 개!', '#3dff9a'); if (st.line) ctx.radio(st.line, st.who); }
          } else st.dwell = 0;
          if (P.s > st.s + 10 && st.state === 'wait') { st.state = 'missed'; missed++; bays[i].miss(); ctx.toast('손님 놓침!', `${st.name} · 초록 차선에 그대로 있으면 알아서 감속해요`, '#ff3d6e'); }
        });
        for (const b of bays) b.tick(ctx.time());
      },
      hud() {
        const next = stops.find((st) => st.state === 'wait');
        const dist = next ? Math.max(0, next.s - ctx.P.s) : 0;
        return { line: next ? `배송 ${done}/${stops.length} · 다음: ${next.name} ${dist | 0}m${dist < 160 ? ' · 초록 차선으로! 자동 감속' : ''}` : `배송 ${done}/${stops.length} · 결승선까지`, warn: next && dist < 160 };
      },
      result(run) {
        const need = stops.length - (def.allowMiss ?? 1);
        return { pass: done >= need, fail: done >= need ? null : `손님 ${missed}명을 놓쳤어요. 초록 기둥이 보이면 그 차선으로 옮기세요. 차가 알아서 감속해요.`,
          stars: [{ ok: done >= need, text: `배송 ${need}건 이상`, gap: '' }, { ok: done === stops.length, text: `전원 배송 ${stops.length}건`, gap: `손님 ${stops.length - done}명만 더 태워 주면 ★` }, timeStar(run, def.time ?? 150)] };
      },
    };
  },

  // score attack: tricks x combo multiplier; thresholds are the stars
  stunt(def, ctx) {
    const [a, b, c] = def.scores;
    return {
      title: def.title || '스턴트 쇼',
      hud: () => { const sc = ctx.score(); const goal = sc < a ? a : sc < b ? b : c; return { line: `점수 ${sc.toLocaleString()} / ${goal.toLocaleString()} · 아슬 추월→배럴롤→퍼펙트 착지로 배수 UP` }; },
      result: (run) => ({ pass: run.score >= a, fail: run.score >= a ? null : `점수 ${run.score.toLocaleString()}점. ${a.toLocaleString()}점이 필요해요. 콤보가 끊기기 전에 기술을 이어 주세요.`,
        stars: [a, b, c].map((n) => ({ ok: run.score >= n, text: `${n.toLocaleString()}점`, gap: `${(n - run.score).toLocaleString()}점만 더 (콤보 배수를 키워요)` })) }),
    };
  },

  // race named rivals to the line; they signal before every lane change
  rivals(def, ctx) {
    const rivals = def.rivals.map((r, i) => ctx.addRival(r, i));
    return {
      title: def.title || '레이스',
      rivals,
      hud: () => { const pos = 1 + rivals.filter((r) => r.s > ctx.P.s).length; return { line: `${pos}위 / ${rivals.length + 1} · 깜빡이 켠 쪽으로 차선 바꿔요`, warn: pos > 1 }; },
      result: (run) => {
        const pos = 1 + rivals.filter((r) => r.finishT != null && r.finishT < run.t).length;
        return { pass: pos === 1, fail: pos === 1 ? null : `${pos}위로 들어왔어요. 지름길 경사로와 퍼펙트 착지 부스트로 앞질러요.`,
          stars: [{ ok: pos === 1, text: '1위', gap: '' }, timeStar(run, def.time ?? 110), perfectStar(run, def.perfect ?? 4)] };
      },
    };
  },

  // shoot down the marked targets (gun stages): each hovers over its lane, dodging side to side, and gets
  // away once you pass it. The gun auto-aims at the nearest one ahead (ctx.targets feeds gunTargets).
  hunt(def, ctx) {
    const { THREE: T, world } = ctx.kit;
    // a red lock-on ring around every live target so it reads from far, even in a dust storm
    const ringTex = ctx.kit.canvasTex(128, 128, (g) => { g.strokeStyle = '#ff3a2a'; g.lineWidth = 8; g.beginPath(); g.arc(64, 64, 52, 0, Math.PI * 2); g.stroke(); g.fillStyle = '#ff3a2a'; for (let k = 0; k < 4; k++) { g.save(); g.translate(64, 64); g.rotate(k * Math.PI / 2); g.fillRect(-3, -62, 6, 18); g.restore(); } });
    const tg = def.targets.map(([s, d, y = 5], i) => {
      const m = ctx.add(def.make(i)); m.scale.setScalar(def.scale ?? 1.6);
      const ring = ctx.add(new T.Sprite(new T.SpriteMaterial({ map: ringTex, color: new T.Color(2.4, 1, 1), transparent: true, depthWrite: false, depthTest: false, fog: false, toneMapped: false })));
      ring.scale.setScalar(6);
      return { s, d, y, hp: def.hp ?? 5, state: 'live', m, ring, ph: i * 1.7, pos: new T.Vector3(), fall: 0 };
    });
    let down = 0, lost = 0;
    const n = tg.length, need = def.need ?? Math.ceil(n * 0.7), name = def.name || '목표';
    const hit = (t) => (dmg) => {
      if (t.state !== 'live') return;
      t.hp -= dmg; ctx.blip(900, 500, 0.05, 'square', 0.04);
      if (t.hp <= 0) { t.state = 'down'; t.ring.visible = false; down++; ctx.trick(`${name} 격추`, 300); ctx.puff?.(t.pos, new T.Vector3(0, 6, 0), '#ffb070', 3, 0.8); ctx.floatText(`격추 ${down}/${n}`); }
    };
    tg.forEach((t) => { t.target = { pos: t.pos, r: 2.2, hit: hit(t) }; });
    return {
      title: def.title || '사냥',
      targets: () => tg.filter((t) => t.state === 'live').map((t) => t.target),
      step(dt) {
        const P = ctx.P, time = ctx.time();
        for (const t of tg) {
          if (t.state === 'live') {
            world(t.s, t.d + 3.5 * Math.sin(time * 1.3 + t.ph), t.y + 0.8 * Math.sin(time * 2.1 + t.ph), t.pos); t.m.position.copy(t.pos);
            const ahead = t.s - P.s; t.ring.visible = ahead > -4 && ahead < 260; t.ring.position.copy(t.pos); t.ring.material.rotation = time * 1.5;
            t.m.rotation.set(0.15 * Math.sin(time * 2 + t.ph), Math.PI + 0.3 * Math.sin(time + t.ph), 0.2 * Math.sin(time * 1.3 + t.ph));
            if (P.s > t.s + 6) { t.state = 'lost'; t.ring.visible = false; lost++; ctx.toast(`${name} 놓침`, '지나간 목표는 도망가요', '#ff9a3d'); }
          } else if (t.state === 'down') { t.fall += dt; t.m.position.y -= dt * (6 + t.fall * 20); t.m.rotation.x += dt * 5; t.m.rotation.z += dt * 3; if (t.fall > 1.2) t.m.visible = false; }
          else { t.fall += dt; t.m.position.y += dt * 25; if (t.fall > 1.5) t.m.visible = false; }
        }
      },
      hud: () => ({ line: `격추 ${down}/${n} · 목표 ${need}대 · F 꾹 = 랩터 캐논 자동 조준`, warn: n - lost < need }),
      result: (run) => ({ pass: down >= need, fail: down >= need ? null : `${down}대 격추. ${need}대가 필요해요. 끊어 쏘면서 과열을 피하고, 다가오는 목표를 먼저 쏘세요.`,
        stars: [{ ok: down >= need, text: `격추 ${need}대 이상`, gap: '' }, { ok: down === n, text: `전부 격추 ${n}대`, gap: `${n - down}대만 더 떨어뜨리면 ★` }, timeStar(run, def.time ?? 80)] }),
    };
  },

  // hands-on basics: each step has to be done before the next one shows; a miss puts you back a little
  tutorial(def, ctx) {
    const steps = def.steps.map((st) => ({ ...st }));
    let i = 0, flash = 0;
    const objs = steps.map((st) => (st.build ? st.build(ctx) : null));
    const cur = () => steps[i];
    function pass() { const st = cur(); ctx.blip(660, 1320, 0.25, 'triangle', 0.16); ctx.floatText('성공!'); st.ok = true; i++; flash = 1.2; if (steps[i]) ctx.radio(steps[i].say); }
    function retry() { const st = cur(); ctx.toast('다시 한 번!', st.hint, '#ffc83d'); ctx.respawn(st.back, st.v ?? 30); }
    ctx.radio(steps[0].say);
    return {
      title: def.title || '시운전',
      step(dt) {
        flash -= dt;
        const st = cur(); if (!st) return;
        const r = st.test ? st.test(ctx, dt) : null;
        if (r === true) pass(); else if (r === false) retry();
        for (const o of objs) o?.tick?.(ctx.time());
      },
      on(evt, data) { const st = cur(); if (st?.on) { const r = st.on(evt, data, ctx); if (r === true) pass(); else if (r === false) retry(); } },
      hud: () => { const st = cur(); return { line: st ? `${i + 1}/${steps.length} · ${ctx.touch ? st.touch || st.text : st.text}` : '완료! 결승선까지 부스트', big: !!st, flash: flash > 0 }; },
      result: (run) => ({ pass: i >= steps.length, fail: i >= steps.length ? null : '연습을 다 마치지 못했어요.', stars: [{ ok: i >= steps.length, text: '기본 조작 완료', gap: '' }, perfectStar(run, def.perfect ?? 2), timeStar(run, def.time ?? 60)] }),
    };
  },
};

// a delivery bay: green pad on the lane, a light column and the stop's name
function bay(ctx, st) {
  const { THREE: T, scene, world, frame, textTex } = ctx.kit;
  const g = new T.Group();
  const padMat = new T.MeshBasicMaterial({ color: new T.Color(0.3, 2.4, 1.1), transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false, blending: T.AdditiveBlending });
  const pad = new T.Mesh(new T.PlaneGeometry(6.5, 18), padMat); pad.rotation.x = -Math.PI / 2; pad.position.y = 0.05; g.add(pad);
  const edge = new T.Mesh(new T.RingGeometry(0.97, 1, 4, 1), padMat.clone()); edge.material.opacity = 0.9; edge.rotation.set(-Math.PI / 2, 0, Math.PI / 4); edge.scale.set(4.6, 12.7, 1); edge.position.y = 0.06; g.add(edge);
  const colMat = new T.MeshBasicMaterial({ color: new T.Color(0.3, 2, 1), transparent: true, opacity: 0.22, depthWrite: false, toneMapped: false, blending: T.AdditiveBlending, side: T.DoubleSide });
  const col = new T.Mesh(new T.CylinderGeometry(1.2, 1.2, 26, 16, 1, true), colMat); col.position.y = 13; g.add(col);
  const label = new T.Mesh(new T.PlaneGeometry(8, 1.6), new T.MeshBasicMaterial({ map: textTex(st.name, '#3dff9a', { w: 768, h: 150, size: 80 }), transparent: true, depthWrite: false, toneMapped: false, side: T.DoubleSide }));
  label.material.color.setScalar(1.6); label.position.y = 6.5; g.add(label);
  world(st.s, st.d, 0, g.position); g.rotation.y = frame(st.s).yaw; if (ctx.add) ctx.add(g); else scene.add(g);
  let state = 'wait';
  return {
    tick(t) { if (state !== 'wait') { g.scale.y = Math.max(0.01, g.scale.y - 0.03); if (g.scale.y < 0.02) g.visible = false; return; } padMat.opacity = 0.4 + Math.sin(t * 6) * 0.15; label.rotation.y = Math.sin(t) * 0.2; },
    done() { state = 'done'; padMat.color.setRGB(0.6, 2.6, 3.2); },
    miss() { state = 'miss'; padMat.color.setRGB(3, 0.3, 0.3); },
  };
}
