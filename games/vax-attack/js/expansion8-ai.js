// Expansion 8 (art + behaviour): viruses that study you (bodyguard, blind-side flanker, burrower, heat-map trapper,
// dash punisher) and five bosses: the Hunter, Sniper, Nemesis, Leviathan and Mimic.
(() => {
  const V = window.VAX;
  const { SPR } = V;
  const { mk, whiteOf, virus } = V.kit;
  const TAU = Math.PI * 2;
  const two = fn => [0, 1].map(fn), spin = f => f * Math.PI / 8;
  const angOff = (a, b) => Math.abs(((a - b + Math.PI * 3) % TAU) - Math.PI);

  // ---------- sprites ----------
  Object.assign(SPR, {
    cchf: two(f => virus(4, '#c08060', '#4a2010', '#ffd0b0', '#ffffff', spin(f))),
    rvf: two(f => virus(3, '#80c0ff', '#10305a', '#d0e8ff', '#ffffff', spin(f))),
    powv: two(f => virus(4, '#a07050', '#3a2010', '#e0c0a0', '#ffe060', spin(f))),
    oro: two(f => virus(4, '#b0e080', '#2a4a10', '#e8ffd0', '#ffffff', spin(f))),
    sabia: two(f => virus(3, '#ff80a0', '#5a1020', '#ffd0e0', '#ffffff', spin(f))),
    hunter: two(f => mk(17, 17, p => { for (let y = 0; y < 17; y++) for (let x = 0; x < 17; x++) { const dx = x - 8, dy = y - 8, d = Math.hypot(dx, dy); if (d > 8) continue; const eye = Math.abs(dy + 1) < 1 && (Math.abs(dx - 3) < 1.2 || Math.abs(dx + 3) < 1.2); p(x, y, d > 7 ? '#2a2a2a' : eye ? (f ? '#ff3030' : '#ffa030') : (x * 3 + y * 7) % 9 < 2 ? '#707070' : '#909090'); } })),
    sniper: two(f => mk(17, 17, p => { for (let y = 0; y < 17; y++) for (let x = 0; x < 17; x++) { const d = Math.hypot(x - 8, y - 8); if (d > 8) continue; const scope = Math.abs(x - 8) < 1 || Math.abs(y - 8) < 1; p(x, y, d > 7 ? '#401010' : d < 2 ? '#ff4040' : scope && d < 6 ? (f ? '#ffffff' : '#ffc0c0') : '#a02828'); } })),
    nemesis: two(f => virus(6, '#6040a0', '#1a0a3a', '#c0a0ff', '#ff4080', spin(f))),
    leviathan: two(f => mk(17, 17, p => { for (let y = 0; y < 17; y++) for (let x = 0; x < 17; x++) { const d = Math.hypot(x - 8, y - 8); if (d > 8) continue; const eye = Math.hypot(x - 11, y - 5) < 1.5 || Math.hypot(x - 11, y - 11) < 1.5; p(x, y, d > 7 ? '#104040' : eye ? '#ffe060' : (y + f) % 4 === 0 ? '#80e0e0' : '#40a0a0'); } })),
    mimic: two(f => mk(19, 19, p => { for (let y = 0; y < 19; y++) for (let x = 0; x < 19; x++) { const d = Math.hypot(x - 9, y - 9) + Math.sin(Math.atan2(y - 9, x - 9) * 5 + f) * .8; if (d > 8.5) continue; p(x, y, d > 7.5 ? '#606060' : (x + y) % 4 === f ? '#ffffff' : '#c0c0c0'); } })),
  });
  const KEYS = ['cchf', 'rvf', 'powv', 'oro', 'sabia'], BOSSK = ['hunter', 'sniper', 'nemesis', 'leviathan', 'mimic'];
  for (const k of [...KEYS, ...BOSSK]) SPR[k + 'W'] = SPR[k].map(whiteOf);
  const tint = src => mk(src.width, src.height, (p, g) => { g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = .5; g.fillStyle = '#ff2040'; g.fillRect(0, 0, src.width, src.height); });
  for (const k of KEYS) SPR[k + 'M'] = SPR[k].map(tint);
  Object.assign(V.PCOL, {
    cchf: ['#c08060', '#ffd0b0'], rvf: ['#80c0ff', '#d0e8ff'], powv: ['#a07050', '#e0c0a0'], oro: ['#b0e080', '#e8ffd0'], sabia: ['#ff80a0', '#ffd0e0'],
    hunter: ['#909090', '#ff3030', '#2a2a2a', '#fff'], sniper: ['#a02828', '#ff4040', '#ffffff', '#401010'], nemesis: ['#6040a0', '#c0a0ff', '#ff4080', '#fff'],
    leviathan: ['#40a0a0', '#80e0e0', '#ffe060', '#104040'], mimic: ['#c0c0c0', '#ffffff', '#606060', '#e0e0ff'],
  });

  // ---------- helpers ----------
  const seek = (e, X, gx, gy, k = 2, cap = 1.3) => { X.tx = X.clamp((gx - e.x) * k, -e.spd * cap, e.spd * cap); X.ty = X.clamp((gy - e.y) * k, -e.spd * cap, e.spd * cap); };
  const inArena = (X, x, y, m = 10) => [X.clamp(x, m, X.W - m), X.clamp(y, X.TOP + m, X.BOT - m)];
  const wobble = (e, X, amp, freq) => { const w = Math.sin(e.t * freq) * amp; X.tx += -X.uy * w; X.ty += X.ux * w; };
  const omen = (S, x, y, t = .85) => (S.omens ??= []).push({ x, y, t, t0: t });
  // where you like to be: a coarse heat map of the time you spend in each part of the vessel (filled in below)
  const HW = 16, HH = 8, cellW = 256 / HW;
  const hottest = (S, X) => {
    const h = S.heat; if (!h) return [X.P.x, X.P.y];
    let bi = 0; for (let i = 1; i < h.length; i++) if (h[i] > h[bi]) bi = i;
    const cellH = (X.BOT - X.TOP) / HH;
    return [(bi % HW + .5) * cellW, X.TOP + (Math.floor(bi / HW) + .5) * cellH];
  };

  // ---------- behaviour ----------
  Object.assign(V.AI, {
    cchf(e, X) {   // bodyguard: stands between you and the toughest pathogen around
      const S = X.S, P = X.P;
      let ward = null;
      for (const o of S.enemies) if (o !== e && o.hp > 0 && o.type !== 'cchf' && Math.hypot(o.x - e.x, o.y - e.y) < 160 && (!ward || o.maxHp > ward.maxHp)) ward = o;
      if (ward) {
        const dx = P.x - ward.x, dy = P.y - ward.y, d = Math.hypot(dx, dy) || 1;
        const [gx, gy] = inArena(X, ward.x + dx / d * (ward.r + 10), ward.y + dy / d * (ward.r + 10));
        seek(e, X, gx, gy, 3, 1.4);
      } else wobble(e, X, 8, 2);
      e.fire -= X.dt;
      if (e.fire <= 0 && X.inside && X.d < 130) { e.fire = X.rnd(1.8, 2.6) * X.D.fire; X.toxin(e.x, e.y, X.aimA, 58); X.V.SND.spit(); }
    },
    rvf(e, X) {   // keeps to your blind side: wherever you aren't aiming
      const P = X.P;
      if (angOff(Math.atan2(e.y - P.y, e.x - P.x), P.aim) < .5) e.side = -e.side;   // you swung toward it: slip the other way
      const a = P.aim + e.side * 1.9, [gx, gy] = inArena(X, P.x + Math.cos(a) * 72, P.y + Math.sin(a) * 60);
      seek(e, X, gx, gy, 2.5, 1.3);
      e.fire -= X.dt;
      if (e.fire <= 0 && X.inside) { e.fire = X.rnd(1.4, 2) * X.D.fire; X.toxin(e.x, e.y, X.aimAt(e.x, e.y, 64), 64); X.V.SND.spit(); }
    },
    powv(e, X) {   // burrows, tunnels to where you're heading, erupts there
      const P = X.P;
      if (e.state === 'down') {
        seek(e, X, e.gx, e.gy, 6, 4); X.snap = true;
        if (Math.hypot(e.gx - e.x, e.gy - e.y) < 3) {
          e.state = 'up'; e.under = false; e.harmless = false; e.dig = X.rnd(2.5, 3.5) * X.D.fire;
          for (let i = 0; i < 10; i++) X.toxin(e.x, e.y, i * TAU / 10, 44);
          X.burst(e.x, e.y, 14, ['#a07050', '#e0c0a0'], 60); X.V.SND.boom();
        }
        return;
      }
      wobble(e, X, 8, 2.5);
      e.dig -= X.dt;
      if (e.dig <= 0 && X.inside) {
        [e.gx, e.gy] = inArena(X, P.x + P.svx * 1.1, P.y + P.svy * 1.1, 12);
        e.state = 'down'; e.under = true; e.harmless = true; X.V.SND.blink();
      }
    },
    oro(e, X) {   // keeps its distance and webs your favourite spot
      if (X.d < 80) { X.tx = -X.ux * e.spd; X.ty = -X.uy * e.spd; } else wobble(e, X, 10, 1.5);
      e.web -= X.dt;
      if (e.web <= 0 && X.inside) { e.web = X.rnd(4, 5) * X.D.fire; const [hx, hy] = hottest(X.S, X); (X.S.webs ??= []).push({ x: hx, y: hy, t: .9 }); X.V.SND.spores(); }
    },
    sabia(e, X) {   // punishes dashes: fires at where you'll land
      const P = X.P;
      if (P.dashing > 0 && !e.saw) {
        e.saw = true;
        const lx = P.x + P.dvx * P.dashing, ly = P.y + P.dvy * P.dashing, a = Math.atan2(ly - e.y, lx - e.x);
        if (X.inside) { for (let i = -1; i <= 1; i++) X.toxin(e.x, e.y, a + i * .08, 82); X.V.SND.spit(); }
      } else if (P.dashing <= 0) e.saw = false;
      const hunting = P.dashT > .4;   // your dash is on cooldown: press in
      if (hunting) wobble(e, X, 6, 3); else if (X.d < 85) { X.tx = -X.ux * e.spd; X.ty = -X.uy * e.spd; }
      e.fire -= X.dt;
      if (e.fire <= 0 && X.inside && X.d < 140) { e.fire = (hunting ? 1.1 : 2.3) * X.D.fire; X.toxin(e.x, e.y, X.aimA, 62); }
    },

    // ---------- bosses ----------
    hunter(e, X) {   // stalks unseen behind you, reveals, pounces, then stands exposed
      const P = X.P, rage = e.hp < e.maxHp / 2;
      e.st -= X.dt;
      if (e.state === 'stalk') {
        e.latent = true; e.harmless = true;
        const a = P.aim + Math.PI + Math.sin(e.t) * .6, [gx, gy] = inArena(X, P.x + Math.cos(a) * 62, P.y + Math.sin(a) * 50);
        seek(e, X, gx, gy, 2, 1.5);
        if (rage && Math.random() < X.dt * .5) X.toxin(e.x, e.y, X.aimA, 60);   // shots out of nowhere
        if (e.st <= 0) { e.state = 'reveal'; e.st = .7; e.latent = false; e.harmless = false; X.V.SND.charge(); }
        return;
      }
      if (e.state === 'reveal') { X.tx = X.ty = 0; e.flash = .05; if (e.st <= 0) { const a = X.aimAt(e.x, e.y, 170, 1); e.dx = Math.cos(a); e.dy = Math.sin(a); e.state = 'pounce'; e.st = .45; } return; }
      if (e.state === 'pounce') {
        X.tx = e.dx * 175; X.ty = e.dy * 175; X.snap = true;
        if (e.st <= 0) { e.state = 'exposed'; e.st = rage ? 1.8 : 2.4; for (let i = 0; i < 12; i++) X.toxin(e.x, e.y, i * TAU / 12, 46); X.V.SND.boom(); }
        return;
      }
      wobble(e, X, 10, 3); X.tx *= .4; X.ty *= .4;   // exposed: slow, and hittable
      if (e.st <= 0) { e.state = 'stalk'; e.st = X.rnd(2, 3) * (rage ? .75 : 1); X.burst(e.x, e.y, 12, ['#909090', '#2a2a2a'], 40); X.V.SND.blink(); }
    },
    sniper(e, X) {   // laser sight tracks you (with a lag), then a rail shot; shells where you stand; relocates if you close in
      const P = X.P, S = X.S, rage = e.hp < e.maxHp / 2;
      if (X.d < 90 && !e.moving) { e.ly = P.y < (X.TOP + X.BOT) / 2 ? X.BOT - 16 : X.TOP + 16; e.moving = true; X.V.SND.blink(); }
      const gy = e.ly ?? (X.TOP + X.BOT) / 2;
      seek(e, X, X.W - 24, gy, 2, 1.6);
      if (Math.abs(e.y - gy) < 4) e.moving = false;
      if (e.phase === 'lock') {
        const want = X.aimAt(e.x, e.y, 170, .6), turn = (rage ? 2.2 : 1.6) * X.dt, diff = ((want - e.la + Math.PI * 3) % TAU) - Math.PI;
        e.la += Math.max(-turn, Math.min(turn, diff)); e.pt -= X.dt;
        if (e.pt <= 0) { e.phase = 'flash'; e.pt = .25; X.V.SND.charge(); }
      } else if (e.phase === 'flash') {
        e.pt -= X.dt;
        if (e.pt <= 0) { e.phase = null; for (let i = 0; i < 6; i++) S.toxins.push({ x: e.x + Math.cos(e.la) * i * 6, y: e.y + Math.sin(e.la) * i * 6, vx: Math.cos(e.la) * 170 * X.D.toxinSpd, vy: Math.sin(e.la) * 170 * X.D.toxinSpd, life: 2.5 }); X.V.SND.boom(); X.shake(.1); }
      } else {
        e.lockT -= X.dt;
        if (e.lockT <= 0 && X.inside) { e.lockT = (rage ? 1.8 : 2.4) * X.D.fire; e.phase = 'lock'; e.pt = rage ? .85 : 1.15; e.la = X.aimA; }
      }
      e.mortar -= X.dt;
      if (e.mortar <= 0 && X.inside) { e.mortar = (rage ? 2.4 : 3.2) * X.D.fire; omen(S, P.x, P.y, .9); if (rage) { const [ox, oy] = inArena(X, P.x + P.svx, P.y + P.svy); omen(S, ox, oy, 1.1); } }
    },
    nemesis(e, X) {   // uses what it's learned: your favourite spot, your dodge side, your preferred range
      const S = X.S, P = X.P, rage = e.hp < e.maxHp / 2;
      if (X.d > 105) seek(e, X, P.x + 80, P.y, 1.5, 1.2);                        // you like it far: it closes in
      else if (X.d < 55) { X.tx = -X.ux * e.spd * 1.3; X.ty = -X.uy * e.spd * 1.3; }   // too close: back off and blast
      else { X.tx = -X.uy * e.spd * Math.sign(P.svy || 1); X.ty = X.ux * e.spd * .5; }
      e.read -= X.dt;
      if (e.read <= 0 && X.inside) {
        e.read = (rage ? 2 : 2.8) * X.D.fire;
        const [hx, hy] = hottest(S, X); omen(S, hx, hy, .9);
        const [px, py] = inArena(X, P.x + P.svx * .9, P.y + P.svy * .9); omen(S, px, py, .85);
        const side = Math.sign(S.dodgeLearn || (Math.random() - .5)), [sx, sy] = inArena(X, px - X.uy * 26 * side, py + X.ux * 26 * side);
        omen(S, sx, sy, 1);
        X.V.SND.charge();
      }
      e.fire -= X.dt;
      if (e.fire <= 0 && X.inside) {
        e.fire = (rage ? 1.2 : 1.6) * X.D.fire;
        if (X.d < 60) for (let i = -3; i <= 3; i++) X.toxin(e.x, e.y, X.aimA + i * .14, 70);
        else for (let i = -1; i <= 1; i++) X.toxin(e.x, e.y, X.aimAt(e.x, e.y, 64, 1.4) + i * .12, 64);
        X.V.SND.bossShot();
      }
    },
    leviathan(e, X) {   // a serpent: the head hunts where you're going; the body walls you in and fires broadsides
      const P = X.P, rage = e.hp < e.maxHp / 2;
      let [gx, gy] = inArena(X, P.x + P.svx * .7, P.y + P.svy * .7);
      if (e.x < 20 || e.x > X.W - 20 || e.y < X.TOP + 14 || e.y > X.BOT - 14) { gx = X.W / 2; gy = (X.TOP + X.BOT) / 2; }
      const want = Math.atan2(gy - e.y, gx - e.x), turn = (rage ? 2.4 : 1.8) * X.dt, diff = ((want - e.dir + Math.PI * 3) % TAU) - Math.PI;
      e.dir += Math.max(-turn, Math.min(turn, diff));
      const sp = e.spd * (rage ? 1.2 : 1);
      X.tx = Math.cos(e.dir) * sp; X.ty = Math.sin(e.dir) * sp; X.snap = true;
      const last = e.trail[0];
      if (!last || Math.hypot(last[0] - e.x, last[1] - e.y) > 2) { e.trail.unshift([e.x, e.y]); if (e.trail.length > 48) e.trail.pop(); }
      e.segs = []; for (let i = 4; i < e.trail.length; i += 4) e.segs.push(e.trail[i]);
      e.broad -= X.dt;
      if (e.broad <= 0 && e.segs.length) {
        e.broad = (rage ? 2 : 3) * X.D.fire;
        e.segs.forEach((s, i) => { if (!rage && i % 2) return; const n = e.trail[i * 4 + 1] || s, a = Math.atan2(s[1] - n[1], s[0] - n[0]) + Math.PI / 2; X.toxin(s[0], s[1], a, 40); X.toxin(s[0], s[1], a + Math.PI, 40); });
        X.V.SND.bossShot();
      }
    },
    mimic(e, X) {   // borrows the fighting style of an earlier boss, and switches at every quarter of its health
      const S = X.S, quarter = Math.min(3, Math.floor((1 - e.hp / e.maxHp) * 4));
      if (!e.form || quarter !== e.formN) {
        const pool = ['singular', 'architect', 'prism', 'oracle', 'warden', 'pulsar', 'tempest', 'doppel', 'siphon', 'sniper', 'nemesis'].filter(k => V.AI[k] && k !== e.form);
        if (e.form) V.ON_KILL[e.form]?.(e, X);   // clean up the old form's walls, beams, winds…
        const k = pool[Math.floor(Math.random() * pool.length)], def = V.ENEMIES[k];
        e.form = k; e.formN = quarter; def.init?.(e); e.r = def.r; e.spd = def.spd * S.D.enemySpd;
        X.burst(e.x, e.y, 30, ['#ffffff', '#c0c0c0', ...(X.V.PCOL[k] || [])], 80); X.shake(.3); X.V.SND.blink();
        S.floaters.push({ x: e.x, y: e.y - 14, text: X.V.tx.bossName(k).toLocaleUpperCase(X.V.i18n.lang), t: 0, col: '#e0e0ff' });
      }
      return V.AI[e.form](e, X);
    },
  });
  V.SKEY.mimic = e => e.form || 'mimic';
  V.PRE_HIT.mimic = (e, b, X) => e.form ? !!V.PRE_HIT[e.form]?.(e, b, X) : false;
  Object.assign(V.ON_KILL, {
    mimic: (e, X) => { if (e.form) V.ON_KILL[e.form]?.(e, X); },
    sniper: (e, X) => { X.S.omens = []; },
    nemesis: (e, X) => { X.S.omens = []; },
  });

  // ---------- world: heat map, webs, the serpent's body ----------
  const powfx = V.POWFX;
  V.POWFX = (S, P, dt, X) => {
    powfx?.(S, P, dt, X);
    if (!S.heat) S.heat = new Float32Array(HW * HH);
    const cx = Math.max(0, Math.min(HW - 1, Math.floor(P.x / cellW))), cy = Math.max(0, Math.min(HH - 1, Math.floor((P.y - X.TOP) / ((X.BOT - X.TOP) / HH))));
    for (let i = 0; i < S.heat.length; i++) S.heat[i] *= 1 - dt * .03;
    S.heat[cy * HW + cx] += dt;
    if (S.webs?.length) {
      for (const w of S.webs) {
        w.t -= dt;
        if (w.t <= 0) for (let i = 0; i < 7; i++) { const a = i * TAU / 6, r = i ? 9 : 0; S.toxins.push({ x: w.x + Math.cos(a) * r, y: w.y + Math.sin(a) * r, vx: 0, vy: 0, life: 5, src: 'oro' }); }
      }
      S.webs = S.webs.filter(w => w.t > 0);
    }
    for (const e of S.enemies) {
      if (e.hp <= 0 || !e.segs?.length) continue;
      for (const s of e.segs) {
        for (const b of S.bullets) if (b.life > 0 && !b.pierce && Math.abs(b.x - s[0]) < 5 && Math.abs(b.y - s[1]) < 5) { b.life = 0; X.burst(b.x, b.y, 2, ['#80e0e0', '#fff']); }
        if (Math.hypot(P.x - s[0], P.y - s[1]) < 6) V.game.hurtAt(s[0], s[1], e.type);
      }
    }
  };

  // ---------- drawing ----------
  Object.assign(V.DRAW, {
    sniper(ctx, e) {
      if (!e.phase) return;
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(e.la) * 300, e.y + Math.sin(e.la) * 300);
      if (e.phase === 'lock') { ctx.strokeStyle = '#ff4040'; ctx.globalAlpha = .35 + .25 * Math.sin(e.t * 30); ctx.lineWidth = 1; }
      else { ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = .9; ctx.lineWidth = 2; }
      ctx.stroke(); ctx.globalAlpha = 1; ctx.lineWidth = 1;
    },
    leviathan(ctx, e) {
      (e.segs || []).forEach((s, i) => {
        const r = Math.max(3, 6.5 - i * .3);
        ctx.fillStyle = '#104040'; ctx.beginPath(); ctx.arc(s[0], s[1], r + 1, 0, TAU); ctx.fill();
        ctx.fillStyle = i % 2 ? '#40a0a0' : '#60c0c0'; ctx.beginPath(); ctx.arc(s[0], s[1], r, 0, TAU); ctx.fill();
      });
    },
    mimic(ctx, e, h) { V.DRAW[e.form]?.(ctx, e, h); ctx.globalAlpha = .5; h.ring(e.x, e.y, e.r + 4, 18, '#ffffff', -e.t * 2); ctx.globalAlpha = 1; },
    hunter(ctx, e, { ring }) { if (e.state === 'stalk') { ctx.globalAlpha = .25; ring(e.x, e.y, e.r, 10, '#c0c0c0', e.t * 3); ctx.globalAlpha = 1; } },
  });
  const drawExtras = V.drawExtras;
  V.drawExtras = (ctx, S, P, h) => {
    drawExtras?.(ctx, S, P, h);
    for (const w of S.webs || []) { ctx.globalAlpha = .4 + .5 * Math.abs(Math.sin(w.t * 12)); h.ring(w.x, w.y, 11, 12, '#b0e080', w.t * 4); ctx.globalAlpha = 1; }
    for (const e of S.enemies) if (e.type === 'powv' && e.state === 'down' && e.hp > 0) { ctx.globalAlpha = .7; h.ring(e.gx, e.gy, 7, 10, '#a07050', V.G.clock * 5); h.ring(e.x, e.y, 3, 5, '#e0c0a0', V.G.clock * 8); ctx.globalAlpha = 1; }
  };

  // ---------- the demo bot learns these too ----------
  const bot0 = V.botExtra;
  V.botExtra = (S, P) => {
    const o = bot0?.(S, P) || { fx: 0, fy: 0, dash: false, why: null };
    for (const e of S.enemies) {
      if (e.hp <= 0) continue;
      if (e.type === 'sniper' && e.phase) {   // get off the laser line
        const cx = Math.cos(e.la), cy = Math.sin(e.la), rx = P.x - e.x, ry = P.y - e.y, side = rx * cy - ry * cx;
        if (rx * cx + ry * cy > 0 && Math.abs(side) < 16) { const s = side >= 0 ? 1 : -1; o.fx += cy * s * 5; o.fy += -cx * s * 5; }
      }
      for (const s of e.segs || []) { const dx = P.x - s[0], dy = P.y - s[1], d = Math.hypot(dx, dy) || 1; if (d < 22) { o.fx += dx / d * 3; o.fy += dy / d * 3; } }
      if (e.type === 'powv' && e.state === 'down') { const dx = P.x - e.gx, dy = P.y - e.gy, d = Math.hypot(dx, dy) || 1; if (d < 16) { o.fx += dx / d * 3; o.fy += dy / d * 3; } }
    }
    for (const w of S.webs || []) { const dx = P.x - w.x, dy = P.y - w.y, d = Math.hypot(dx, dy) || 1; if (d < 18) { o.fx += dx / d * 3; o.fy += dy / d * 3; } }
    return o;
  };
})();
