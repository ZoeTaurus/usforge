// Expansion 4 (art + behaviour): ten viruses, five bosses (Hivemind, Doppelgänger, Singularity, Architect, Hatchery),
// five power-ups (Reflective Coat, Antibody Drone, Phagocyte Vortex, Adrenaline, Precision).
(() => {
  const V = window.VAX;
  const { SPR } = V;
  const { mk, art, whiteOf, virus, cluster, bacterium } = V.kit;
  const R = Math.round, TAU = Math.PI * 2;
  const two = fn => [0, 1].map(fn), spin = f => f * Math.PI / 8;

  // ---------- sprites ----------
  Object.assign(SPR, {
    hmpv: two(f => virus(3, '#a0e0ff', '#1a4a6a', '#e0f8ff', '#ffffff', spin(f))),
    shigella: two(f => bacterium(9, 5, '#e0b060', '#5a3a10', '#fff0c0', f)),
    shigmini: two(f => bacterium(5, 3, '#e0b060', '#5a3a10', '#fff0c0', f)),
    legion0: two(f => bacterium(10, 6, '#c0a0e0', '#3a2a5a', '#f0e0ff', f)),
    legion1: two(f => bacterium(12, 8, '#b080e0', '#3a1a5a', '#f0d0ff', f)),
    chapare: two(f => virus(3, '#ff6040', '#6a1000', '#ffc0a0', '#ffe060', spin(f))),
    borna: two(f => virus(4, '#90b0ff', '#1a2a6a', '#d0e0ff', '#ffffff', spin(f))),
    echo: two(f => virus(4, '#ffe0a0', '#6a5010', '#fff8e0', '#7fe0d4', spin(f))),
    aav: two(f => virus(3, '#d0d0d0', '#4a4a4a', '#ffffff', '#ff4040', spin(f))),
    leish: two(f => mk(12, 7, p => { for (let x = 0; x < 12; x++) { const y = R(3 + Math.sin(x * .9 + f * 2) * 1.5); p(x, y, x > 3 ? '#80e060' : '#2a5a10'); if (x > 4 && x < 11) p(x, y + 1, '#80e060'); } p(10, R(3 + Math.sin(9 + f * 2) * 1.5), '#e0ffc0'); })),
    rubella: two(f => virus(4, '#ff90a0', '#6a1a2a', '#ffd0d8', '#ffffff', spin(f))),
    hendra: two(f => virus(4, '#b0c070', '#3a4a10', '#e0f0b0', '#ffffff', spin(f))),
    egg: two(f => mk(9, 11, p => { for (let y = 0; y < 11; y++) for (let x = 0; x < 9; x++) { const d = ((x - 4) / 4.2) ** 2 + ((y - 5.5) / 5.3) ** 2; if (d <= 1) p(x, y, d > .75 ? '#8a6a3a' : (x + y + f) % 5 === 0 ? '#c0a070' : '#f0d0a0'); } })),
    hivemind: two(f => virus(6, '#d080ff', '#4a0a6a', '#f0d0ff', '#ffffff', spin(f))),
    doppel: two(f => { const s = V.cos.skinSprite('classic'); return mk(s.width + 2, s.height + 2, (p, g) => { g.drawImage(s, 1, 1); g.globalCompositeOperation = 'source-atop'; g.fillStyle = f ? '#4a0a2a' : '#6a1030'; g.globalAlpha = .55; g.fillRect(0, 0, s.width + 2, s.height + 2); }); }),
    singular: two(f => mk(19, 19, p => { for (let y = 0; y < 19; y++) for (let x = 0; x < 19; x++) { const d = Math.hypot(x - 9, y - 9); if (d < 3.5) p(x, y, '#000000'); else if (d < 5) p(x, y, '#6040a0'); else if (d < 9 && (Math.round(Math.atan2(y - 9, x - 9) * 3 + d + f * 2) % 4 === 0)) p(x, y, '#a080e0'); } })),
    architect: two(f => cluster([[9, 9, 6], [3, 3, 2.5], [15, 3, 2.5], [3, 15, 2.5], [15, 15, 2.5]], 19, 19, 3, '#a0c080', '#2a4a10', '#e0f0c0')),
    hatchery: two(f => mk(26, 20, p => { for (let y = 0; y < 20; y++) for (let x = 0; x < 26; x++) { const d = ((x - 13) / 12.5) ** 2 + ((y - 10) / (9 + f * .5)) ** 2; if (d <= 1) p(x, y, d > .85 ? '#7a5a30' : (x * 3 + y * 5) % 11 === 0 ? '#fff0d0' : '#f0d0a0'); } })),
    flungShot: art(['.v.', 'vVv', '.v.'], { v: '#6040a0', V: '#d0c0ff' }),
    // power-up icons
    mirror: art(['.mmmmm.', 'mMWWWMm', 'mWMMMWm', 'mWMMMWm', 'mWMMMWm', 'mMWWWMm', '.mmmmm.'], { m: '#5a7a9a', M: '#a0c8e8', W: '#ffffff' }),
    turret: art(['...t...', '..tTt..', '.tTWTt.', 'tTTTTTt', '.tTTTt.', '..t.t..', '.t...t.'], { t: '#2f8f86', T: '#7fe0d4', W: '#fff' }),
    vortex: art(['..vvv..', '.v...v.', 'v..V..v', 'v.VWV.v', 'v..V..v', '.v...v.', '..vvv..'], { v: '#6a40c0', V: '#b080ff', W: '#fff' }),
    adren: art(['...a...', '..aA...', '.aAA...', 'aAAAAAa', '...AAa.', '...Aa..', '...a...'], { a: '#a02010', A: '#ff6040' }),
    crit: art(['...c...', '...C...', '.cCWCc.', 'cCWWWCc', '.cCWCc.', '...C...', '...c...'], { c: '#a08020', C: '#ffe080', W: '#fff' }),
    turretBody: two(f => art(f ? ['.t.', 'tWt', '.t.'] : ['t.t', '.W.', 't.t'], { t: '#7fe0d4', W: '#ffffff' })),
  });
  SPR.legion = SPR.legion0;
  const KEYS = ['hmpv', 'shigella', 'shigmini', 'legion0', 'legion1', 'chapare', 'borna', 'echo', 'aav', 'leish', 'rubella', 'hendra', 'egg'];
  const BOSSK = ['hivemind', 'doppel', 'singular', 'architect', 'hatchery'];
  for (const k of [...KEYS, ...BOSSK]) SPR[k + 'W'] = SPR[k].map(whiteOf);
  SPR.legionW = SPR.legion0W;
  const tint = src => mk(src.width, src.height, (p, g) => { g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = .5; g.fillStyle = '#ff2040'; g.fillRect(0, 0, src.width, src.height); });
  for (const k of KEYS) SPR[k + 'M'] = SPR[k].map(tint);
  SPR.legionM = SPR.legion0M;
  V.SKEY.legion = e => e.ate >= 6 ? 'legion1' : 'legion0';

  Object.assign(V.PCOL, {
    hmpv: ['#a0e0ff', '#e0f8ff'], shigella: ['#e0b060', '#fff0c0'], shigmini: ['#e0b060', '#fff0c0'], legion: ['#c0a0e0', '#f0e0ff'], chapare: ['#ff6040', '#ffe060'],
    borna: ['#90b0ff', '#d0e0ff'], echo: ['#ffe0a0', '#7fe0d4'], aav: ['#d0d0d0', '#ff4040'], leish: ['#80e060', '#e0ffc0'], rubella: ['#ff90a0', '#ffd0d8'],
    hendra: ['#b0c070', '#e0f0b0'], egg: ['#f0d0a0', '#8a6a3a'],
    hivemind: ['#d080ff', '#f0d0ff', '#4a0a6a', '#fff'], doppel: ['#7fe0d4', '#ff6080', '#fff'], singular: ['#6040a0', '#a080e0', '#000', '#fff'],
    architect: ['#a0c080', '#e0f0c0', '#2a4a10', '#fff'], hatchery: ['#f0d0a0', '#fff0d0', '#7a5a30', '#fff'],
  });

  // ---------- behaviour ----------
  const wobble = (e, X, amp, freq) => { const w = Math.sin(e.t * freq) * amp; X.tx += -X.uy * w; X.ty += X.ux * w; };
  const segDist = (px, py, ax, ay, bx, by) => { const vx = bx - ax, vy = by - ay, l = vx * vx + vy * vy || 1, k = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / l)); return Math.hypot(px - ax - vx * k, py - ay - vy * k); };
  const HATCH = ['virus', 'zika', 'parvo', 'coxsackie', 'chikv', 'westnile', 'h5n1', 'chapare'];
  Object.assign(V.AI, {
    hmpv(e, X) {   // pairs up with another and holds a toxic tether between them
      if (!e.mate || e.mate.hp <= 0) {
        e.mate = null;
        const o = X.S.enemies.find(o => o !== e && o.type === 'hmpv' && o.hp > 0 && !o.mate && Math.hypot(o.x - e.x, o.y - e.y) < 90);
        if (o) { e.mate = o; o.mate = e; e.lead = true; o.lead = false; }
      }
      wobble(e, X, 14, 2);
      const m = e.mate;
      if (m) {
        const d = Math.hypot(m.x - e.x, m.y - e.y);   // keep the tether taut: not too close, not too far
        if (d > 60) { X.tx += (m.x - e.x) / d * e.spd; X.ty += (m.y - e.y) / d * e.spd; } else if (d < 34) { X.tx -= (m.x - e.x) / (d || 1) * e.spd; X.ty -= (m.y - e.y) / (d || 1) * e.spd; }
        if (e.lead && d < 95 && X.inside && segDist(X.P.x, X.P.y, e.x, e.y, m.x, m.y) < 3) X.V.game.hurtAt(e.x, e.y, 'hmpv');
      }
    },
    shigella(e, X) { wobble(e, X, 8, 3); },
    shigmini(e, X) { wobble(e, X, 12, 6); },
    legion(e, X) {   // swallows shots; spits them back when full
      wobble(e, X, 6, 2);
      if (e.open > 0) e.open -= X.dt;
      if (e.ate >= 8) {
        for (let i = 0; i < 12; i++) X.toxin(e.x, e.y, e.t + i * TAU / 12, 52);
        for (let i = -1; i <= 1; i++) X.toxin(e.x, e.y, X.aimA + i * .15, 64);
        e.ate = 0; e.open = 2.5; X.burst(e.x, e.y, 14, X.V.PCOL.legion, 60); X.V.SND.boom();
      }
    },
    chapare(e, X) {   // rushes you, flashes, explodes
      if (e.state === 'tele') {
        X.tx = X.ty = 0; e.st -= X.dt;
        if (e.st <= 0) {
          for (let i = 0; i < 10; i++) X.toxin(e.x, e.y, i * TAU / 10, 58);
          X.S.toxins.push({ x: e.x, y: e.y, vx: 0, vy: 0, life: .15, r: 8 });
          X.burst(e.x, e.y, 24, ['#ff6040', '#ffe060', '#fff'], 90); X.V.SND.boom(); X.shake(.2); X.kill(e, true); return 'gone';
        }
        return;
      }
      X.tx *= 1.4; X.ty *= 1.4;
      if (X.d < 24 && X.inside) { e.state = 'tele'; e.st = .55; X.V.SND.charge(); }
    },
    borna(e, X) { wobble(e, X, 8, 1.5); if (X.d < 45) { X.tx = -X.ux * e.spd; X.ty = -X.uy * e.spd; } X.S.fields.push({ x: e.x, y: e.y, r: 30, slow: .4 }); },
    echo(e, X) {   // mirrors your movement: you go left, it goes right
      const P = X.P;
      if (e.ax === undefined) { e.ax = X.clamp(X.W - P.x, 20, X.W - 20); e.ay = X.clamp(X.TOP + X.BOT - P.y, X.TOP + 10, X.BOT - 10); }
      if (!X.inside) { X.tx = X.ux * 40; X.ty = X.uy * 40; return; }
      const gx = X.clamp(X.W - P.x, 10, X.W - 10), gy = X.clamp(X.TOP + X.BOT - P.y, X.TOP + 8, X.BOT - 8);
      X.tx = X.clamp((gx - e.x) * 4, -e.spd, e.spd); X.ty = X.clamp((gy - e.y) * 4, -e.spd, e.spd);
      if (X.d < 30) { X.tx -= X.ux * e.spd; X.ty -= X.uy * e.spd; }
      e.fire = (e.fire ?? 2) - X.dt;
      if (e.fire <= 0) { e.fire = X.rnd(2, 2.8) * X.D.fire; X.toxin(e.x, e.y, X.aimA, 56); }
    },
    aav(e, X) { wobble(e, X, 10, 2); X.S.fields.push({ x: e.x, y: e.y, r: 42, pull: 5 }); },
    leish(e, X) {   // drains your power-ups while it's near
      wobble(e, X, 10, 4);
      if (X.d < 46) { e.draining = true; for (const k in X.P.fx) if (X.P.fx[k] > 0) X.P.fx[k] = Math.max(0, X.P.fx[k] - X.dt * 1.5); } else e.draining = false;
    },
    rubella(e, X) {   // sends out a wide, slow shockwave ring
      wobble(e, X, 8, 1.5);
      if (X.d < 50) { X.tx = -X.ux * e.spd; X.ty = -X.uy * e.spd; }
      e.wave -= X.dt;
      if (e.wave <= 0 && X.inside) { e.wave = X.rnd(3, 4) * X.D.fire; for (let i = 0; i < 26; i++) X.toxin(e.x, e.y, i * TAU / 26 + e.t, 40); X.V.SND.spores(); }
    },
    hendra(e, X) {   // one shot where you are, one where you're going
      wobble(e, X, 10, 2);
      if (X.d < 55) { X.tx = -X.ux * e.spd; X.ty = -X.uy * e.spd; }
      e.fire -= X.dt;
      if (e.fire <= 0 && X.inside) { e.fire = X.rnd(1.8, 2.5) * X.D.fire; X.toxin(e.x, e.y, X.aimAt(e.x, e.y, 62, 0), 62); X.toxin(e.x, e.y, X.aimAt(e.x, e.y, 62, 1.5), 62); X.V.SND.spit(); }
    },
    egg(e, X) {   // hatches into two random viruses unless broken
      X.snap = true; X.tx = X.ty = 0; e.kx = e.ky = 0;
      e.hatch -= X.dt;
      if (e.hatch <= 0) { for (let i = 0; i < 2; i++) X.spawn(HATCH[Math.floor(Math.random() * HATCH.length)], e.x + X.rnd(-4, 4), e.y + X.rnd(-4, 4)); X.burst(e.x, e.y, 12, X.V.PCOL.egg, 50); X.V.SND.spores(); X.kill(e, true); return 'gone'; }
    },

    // ---------- bosses ----------
    hivemind(e, X) {   // no body of its own: it jumps between hosts and summons more
      const S = X.S, rage = e.hp < e.maxHp / 2;
      X.snap = true; X.tx = X.ty = 0;
      const h = e.host;
      if (h && h.hp > 0) { e.x = h.x; e.y = h.y; }
      e.jumpT -= X.dt;
      if (!h || h.hp <= 0 || e.jumpT <= 0) {
        const pool = S.enemies.filter(o => !o.boss && o.hp > 0 && !X.V.MINIONS.has(o.type) && o.x > 10 && o.x < X.W - 10);
        if (h) h.possessedBy = null;
        e.host = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
        if (e.host) { e.host.possessedBy = e; X.burst(e.host.x, e.host.y, 16, X.V.PCOL.hivemind, 60); X.V.SND.blink(); }
        e.jumpT = (rage ? 4 : 5.5) * X.D.fire;
      }
      e.brood -= X.dt;
      const alive = S.enemies.filter(o => !o.boss && o.hp > 0).length;
      if (e.brood <= 0 && alive < (rage ? 10 : 8)) {
        e.brood = (rage ? 1.2 : 1.7) * X.D.fire;
        const pool = ['virus', 'bact', 'bug', 'salmo', 'hiv', 'zika', 'hendra', 'polio'];
        X.spawn(pool[Math.floor(Math.random() * pool.length)]);
      }
      if (e.host && e.host.hp > 0) {   // the host fights harder
        e.hfire = (e.hfire ?? 1.5) - X.dt;
        if (e.hfire <= 0 && X.inside) { e.hfire = (rage ? 1.1 : 1.5) * X.D.fire; const a = X.aimAt(e.host.x, e.host.y, 62); for (let i = -1; i <= 1; i++) X.toxin(e.host.x, e.host.y, a + i * .16, 62); X.V.SND.bossShot(); }
      }
    },
    doppel(e, X) {   // your own weapon, turned against you
      const P = X.P, rage = e.hp < e.maxHp / 2;
      const gx = X.clamp(X.W - P.x, 20, X.W - 20), gy = X.clamp(X.TOP + X.BOT - P.y, X.TOP + 10, X.BOT - 10);
      X.tx = X.clamp((gx - e.x) * 3, -e.spd, e.spd); X.ty = X.clamp((gy - e.y) * 3, -e.spd, e.spd);
      if (X.d < 50) { X.tx -= X.ux * e.spd; X.ty -= X.uy * e.spd; }
      if (P.dashing > 0 && !e.dashed) { e.dashed = true; e.kx += -P.dvx * .8; e.ky += -P.dvy * .8; X.burst(e.x, e.y, 8, X.V.PCOL.doppel, 50); } else if (P.dashing <= 0) e.dashed = false;
      e.fire -= X.dt;
      if (e.fire <= 0 && X.inside) {
        e.fire = Math.max(.32, P.rate * (rage ? 2.2 : 2.8)) * X.D.fire;
        const lanes = P.multi === 1 ? [0] : P.multi === 2 ? [-3, 3] : [-4, 0, 4], a = X.aimA, px = -Math.sin(a), py = Math.cos(a);
        for (const off of P.fx.spread > 0 ? [-.2, 0, .2] : [0]) for (const l of lanes) X.toxin(e.x + px * l, e.y + py * l, a + off, 88);
        X.V.SND.shoot();
      }
    },
    singular(e, X) {   // gravity: toxins nearby fall into orbit, then get flung at you
      const P = X.P, S = X.S, rage = e.hp < e.maxHp / 2;
      X.tx = ((X.W * .62) - e.x) * .6 + Math.sin(e.t * .4) * 10; X.ty = ((X.TOP + X.BOT) / 2 + Math.sin(e.t * .5) * 30 - e.y) * .6;
      e.spin += X.dt * 2;
      let orbiting = 0;
      for (const t of S.toxins) {
        const dx = t.x - e.x, dy = t.y - e.y, d = Math.hypot(dx, dy);
        if (t.flung || d > 60 || d < 1) continue;
        const a = Math.atan2(dy, dx) + X.dt * 2.2, r = Math.max(16, d - X.dt * 10);   // spiral into an orbit
        t.x = e.x + Math.cos(a) * r; t.y = e.y + Math.sin(a) * r; t.vx = t.vy = 0; t.life = Math.max(t.life, 2); orbiting++;
      }
      S.fields.push({ x: e.x, y: e.y, r: 55, pull: 2.2 });
      S.tugX += (e.x - P.x) / (X.d || 1) * 12; S.tugY += (e.y - P.y) / (X.d || 1) * 12;
      e.fire -= X.dt;
      if (e.fire <= 0 && X.inside) { e.fire = (rage ? 1.2 : 1.6) * X.D.fire; for (let i = 0; i < 8; i++) X.toxin(e.x, e.y, e.spin + i * TAU / 8, 30); }
      e.fling -= X.dt;
      if (e.fling <= 0 && orbiting) {   // release: everything in orbit shoots at you
        e.fling = (rage ? 3 : 4) * X.D.fire; X.V.SND.boom(); X.shake(.2);
        for (const t of S.toxins) { const dx = t.x - e.x, dy = t.y - e.y, d = Math.hypot(dx, dy); if (t.flung || d > 60) continue;
          const a = X.aimAt(t.x, t.y, 70) + X.rnd(-.12, .12); t.vx = Math.cos(a) * 70 * X.D.toxinSpd; t.vy = Math.sin(a) * 70 * X.D.toxinSpd; t.flung = true; t.life = 4; }
      }
    },
    architect(e, X) {   // builds biofilm walls between you and it
      const P = X.P, S = X.S, rage = e.hp < e.maxHp / 2;
      X.tx = ((X.W - 36) - e.x) * 1.1; X.ty = X.clamp((P.y - e.y) * .6, -e.spd, e.spd);
      e.build -= X.dt;
      if (e.build <= 0 && X.inside && S.walls.length < (rage ? 7 : 5)) {
        e.build = (rage ? 2.4 : 3.2) * X.D.fire;
        const x = X.clamp(P.x + X.rnd(30, 70), 30, X.W - 60), vertical = Math.random() < .65;
        const w = vertical ? { x, y: X.clamp(P.y - 14, X.TOP + 4, X.BOT - 32), w: 7, h: 28 } : { x: x - 10, y: X.clamp(P.y + X.rnd(-24, 24), X.TOP + 4, X.BOT - 12), w: 28, h: 7 };
        w.hp = w.maxHp = Math.max(8, X.V.game.playerDPS() * 1.2); S.walls.push(w);
        X.burst(w.x + w.w / 2, w.y + w.h / 2, 12, ['#a0c080', '#e0f0c0'], 40); X.V.SND.shell();
      }
      e.fire -= X.dt;
      if (e.fire <= 0 && X.inside) { e.fire = (rage ? 1.3 : 1.8) * X.D.fire; for (let i = -2; i <= 2; i++) X.toxin(e.x, e.y, X.aimA + i * .18, 60); X.V.SND.bossShot(); }
    },
    hatchery(e, X) {   // lays eggs that hatch into viruses
      const P = X.P, rage = e.hp < e.maxHp / 2;
      X.tx = ((X.W - 40) - e.x) * .8; X.ty = X.clamp((P.y - e.y) * .5 + Math.sin(e.t * .6) * 20, -e.spd * 2, e.spd * 2);
      e.lay -= X.dt;
      if (e.lay <= 0 && X.inside && X.S.enemies.length < 10 && X.S.enemies.filter(o => o.type === 'egg').length < (rage ? 4 : 3)) {
        e.lay = (rage ? 3.6 : 4.6) * X.D.fire;
        const g = X.spawn('egg', e.x - 12, e.y + X.rnd(-10, 10)); g.hp = g.maxHp = Math.max(4, X.V.game.playerDPS() * .6); g.kx = -X.rnd(20, 50); g.ky = X.rnd(60, 110) * (Math.random() < .5 ? -1 : 1);   // scattered up and down, not into your line of fire
      }
      e.fire -= X.dt;
      if (e.fire <= 0 && X.inside) { e.fire = (rage ? 1.6 : 2.2) * X.D.fire; for (let i = 0; i < 12; i++) X.toxin(e.x, e.y, e.t + i * TAU / 12, 42); X.V.SND.bossShot(); }
    },
  });
  // the egg keeps its kick briefly after being laid, then settles
  V.AI.egg = (orig => (e, X) => { if (Math.abs(e.kx) > 5 || Math.abs(e.ky) > 5) { e.hatch -= X.dt; return; } return orig(e, X); })(V.AI.egg);

  V.ON_HIT.shigella = (e, b, X) => { e.hits++; if (e.hits % 3 === 0 && e.hp > 0) { const c = X.spawn('shigmini', e.x, e.y); c.kx = X.rnd(-60, 60); c.ky = X.rnd(-60, 60); } };
  V.PRE_HIT = { legion: (e, b, X) => { if (e.ate >= 8 || e.open > 0 || b.pierce || b.crit) return false; e.ate++; e.flash = .04; X.burst(b.x, b.y, 2, ['#c0a0e0']); return true; } };
  Object.assign(V.ON_KILL, {
    hivemind: (e, X) => { if (e.host) e.host.possessedBy = null; },
    architect: (e, X) => { for (const w of X.S.walls) X.burst(w.x + w.w / 2, w.y + w.h / 2, 12, ['#a0c080'], 50); X.S.walls = []; },
    hatchery: (e, X) => { for (const o of X.S.enemies) if (o.type === 'egg' && o.hp > 0) X.kill(o, true); },
  });

  // ---------- power-ups that run every frame ----------
  V.POWFX = (S, P, dt, X) => {
    S.fields = [];   // pathogen fields are rebuilt by their AI each frame
    // Antibody Drone
    if (P.fx.turret > 0) {
      const T = S.drone ??= { a: 0, cd: 0, t: 0 };
      T.a += dt * 2.4; T.t += dt; T.cd -= dt;
      T.x = P.x + Math.cos(T.a) * 18; T.y = P.y + Math.sin(T.a) * 14;
      if (T.cd <= 0) {
        let tgt = null, bs = -1e9;
        for (const e of S.enemies) { if (e.hp <= 0 || e.x < 2 || e.x > X.W - 2 || V.game.hiddenOrCloaked(e)) continue; const sc = V.game.threat(e) - Math.hypot(e.x - T.x, e.y - T.y) * .4; if (sc > bs) { bs = sc; tgt = e; } }
        if (tgt) { T.cd = .32; const a = Math.atan2(tgt.y - T.y, tgt.x - T.x); S.bullets.push({ x: T.x, y: T.y, vx: Math.cos(a) * 200, vy: Math.sin(a) * 200, life: 1.2, dmg: P.dmg * .8, homing: false, hit: null }); }
      }
    } else S.drone = null;
    // Phagocyte Vortex
    const Vx = S.vortex;
    if (Vx) {
      Vx.t -= dt; Vx.spin += dt * 6;
      for (const e of S.enemies) {
        if (e.hp <= 0) continue;
        const dx = Vx.x - e.x, dy = Vx.y - e.y, d = Math.hypot(dx, dy) || 1;
        if (!e.boss && d < 60) { e.kx += dx / d * 540 * dt; e.ky += dy / d * 540 * dt; }   // drag them in
        if (d < 16 + e.r) { e.vxDmg = (e.vxDmg || 0) - dt; if (e.vxDmg <= 0) { e.vxDmg = .2; V.game.strikeAt(e, P.dmg * 3); } }   // and grind them
      }
      for (const t of S.toxins) { const dx = Vx.x - t.x, dy = Vx.y - t.y, d = Math.hypot(dx, dy) || 1; if (d < 70) { t.x += dx / d * 90 * dt; t.y += dy / d * 90 * dt; if (d < 8) t.life = 0; } }
      if (Vx.t <= 0) S.vortex = null;
    }
  };

  // ---------- drawing ----------
  Object.assign(V.DRAW, {
    hmpv(ctx, e, { R }) {
      const m = e.mate; if (!e.lead || !m || m.hp <= 0) return;
      const n = Math.ceil(Math.hypot(m.x - e.x, m.y - e.y) / 2);
      for (let k = 1; k < n; k++) { ctx.fillStyle = (k + Math.floor(e.t * 16)) % 4 < 2 ? '#a0e0ff' : '#ffffff'; ctx.fillRect(R(e.x + (m.x - e.x) * k / n), R(e.y + (m.y - e.y) * k / n), 1, 1); }
    },
    borna(ctx, e, { ring }) { ctx.globalAlpha = .3; ring(e.x, e.y, 30, 26, '#90b0ff', e.t * .5); ctx.globalAlpha = 1; },
    aav(ctx, e, { ring }) { ctx.globalAlpha = .35; ring(e.x, e.y, 42 - (e.t * 20) % 30, 20, '#ff8080', -e.t); ctx.globalAlpha = 1; },
    leish(ctx, e, { ring }) { if (e.draining) { ctx.globalAlpha = .5 + .3 * Math.sin(e.t * 12); ring(e.x, e.y, 8, 12, '#80e060', e.t * 4); ctx.globalAlpha = 1; } },
    legion(ctx, e, { R }) { if (e.open > 0 && (e.open > .8 || e.open * 10 % 2 > 1)) { ctx.strokeStyle = '#ff6080'; ctx.strokeRect(R(e.x - e.r - 2) + .5, R(e.y - e.r - 2) + .5, e.r * 2 + 3, e.r * 2 + 3); } if (e.ate > 0) { ctx.fillStyle = '#f0e0ff'; for (let i = 0; i < e.ate; i++) ctx.fillRect(R(e.x - 7 + i * 2), R(e.y - e.r - 4), 1, 2); } },
    egg(ctx, e, { ring }) { if (e.hatch < 1.5 && Math.floor(e.t * 10) % 2) ring(e.x, e.y, 7, 10, '#fff0d0'); },
    singular(ctx, e, { ring }) { ctx.globalAlpha = .25; ring(e.x, e.y, 58, 36, '#a080e0', e.spin * .3); ring(e.x, e.y, 30, 20, '#6040a0', -e.spin * .5); ctx.globalAlpha = 1; },
  });
  // host glow for the Hivemind, walls, the drone and the vortex (drawn from the render loop)
  V.drawExtras = (ctx, S, P, { ring, draw, R }) => {
    for (const w of S.walls || []) {
      ctx.fillStyle = w.flash > 0 ? '#ffffff' : '#5a7a3a'; ctx.fillRect(R(w.x), R(w.y), R(w.w), R(w.h));
      ctx.fillStyle = '#a0c080'; ctx.fillRect(R(w.x) + 1, R(w.y) + 1, R(w.w) - 2, Math.max(1, R((w.h - 2) * w.hp / w.maxHp)));
      w.flash = (w.flash || 0) - 1 / 60;
    }
    for (const e of S.enemies) if (e.possessedBy) { ctx.globalAlpha = .6 + .3 * Math.sin(e.t * 10); ring(e.x, e.y, e.r + 5, 16, '#d080ff', e.t * 4); ring(e.x, e.y, e.r + 8, 10, '#f0d0ff', -e.t * 3); ctx.globalAlpha = 1; }
    if (S.drone) draw(SPR.turretBody[Math.floor(S.drone.t * 6) % 2], S.drone.x, S.drone.y);
    if (S.vortex) { const Vx = S.vortex; for (let k = 0; k < 3; k++) ring(Vx.x, Vx.y, 6 + k * 7, 10 + k * 6, k % 2 ? '#b080ff' : '#6a40c0', Vx.spin * (k % 2 ? -1 : 1)); }
    if (P.fx.mirror > 0 && P.hp > 0) { ctx.globalAlpha = .5; ring(P.x, P.y, 11, 18, '#e0f0ff', V.G.clock * 3); ctx.globalAlpha = 1; }
  };
})();
