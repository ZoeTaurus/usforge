// Expansion 3 (art + behaviour): ten viruses, five bosses (Replicator, Cytokine Storm, Retrovirus, Naegleria, Toxoplasma),
// and icons for five power-ups.
(() => {
  const V = window.VAX;
  const { SPR } = V;
  const { mk, art, whiteOf, virus, cluster } = V.kit;
  const R = Math.round, TAU = Math.PI * 2;
  const two = fn => [0, 1].map(fn), spin = f => f * Math.PI / 8;

  // ---------- sprites ----------
  // Naegleria: a lumpy amoeba that changes shape between frames, with a dark nucleus
  const blob = (r0, col, dark, light, nuc) => two(f => { const S = 2 * r0 + 7, c = S / 2; return mk(S, S, p => {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const a = Math.atan2(y - c, x - c), rr = r0 + Math.sin(a * 3 + f * 1.7) * 2.2 + Math.sin(a * 5 - f) * 1.2, d = Math.hypot(x - c, y - c);
      if (d > rr) continue;
      const nd = Math.hypot(x - c - 2, y - c + 1);
      p(x, y, nd < r0 * .3 ? nuc : d > rr - 1.2 ? dark : (x + y < c * 1.6 ? light : col));
    }
  }); });
  Object.assign(SPR, {
    reo: two(f => virus(4, '#80c0ff', '#1a3a6a', '#d0e8ff', '#ffffff', spin(f))),
    hcv: two(f => virus(4, '#60e0a0', '#0a4a2a', '#c0ffe0', '#ffffff', spin(f))),
    coxsackie: two(f => virus(3, '#ff90c0', '#6a1a40', '#ffd0e8', '#ffffff', spin(f))),
    vzv: two(f => virus(4, '#ffb070', '#6a3000', '#ffe0c0', '#ff4040', spin(f))),
    ebv: two(f => virus(3, '#b0a0ff', '#2a1a6a', '#e0d8ff', '#ffffff', spin(f))),
    cmv0: two(f => virus(4, '#e0e060', '#4a4a00', '#ffffc0', '#ffffff', spin(f))),
    cmv1: two(f => virus(6, '#d8d040', '#4a4400', '#fffaa0', '#ffffff', spin(f))),
    cmv2: two(f => virus(8, '#d0c030', '#403a00', '#fff080', '#ff8040', spin(f))),
    influb: two(f => virus(4, '#90c0e0', '#1a3a5a', '#d0f0ff', '#ffe060', spin(f))),
    flufrag: two(f => art(f ? ['.f.', 'fFf', '.f.'] : ['f.f', '.F.', 'f.f'], { f: '#4a8ab0', F: '#d0f0ff' })),
    polyoma: two(f => virus(4, '#e0e0ff', '#40406a', '#ffffff', '#b0b0ff', spin(f))),
    mpox: two(f => cluster([[5, 5, 4], [2, 2, 1.4], [8, 2.5, 1.4], [2, 8, 1.4], [8.5, 8, 1.4]], 11, 11, 3, '#d09070', '#5a2a10', '#f8d0b0')),
    parvo: two(f => virus(2, '#ff7070', '#6a1010', '#ffc0c0', '#ffffff', spin(f))),
    replicator: two(f => virus(10, '#70f0d0', '#0a4a3a', '#d0fff0', '#ffffff', spin(f))),
    replica: two(f => virus(7, '#50b0a0', '#0a3a30', '#a0e0d0', '#d0fff0', spin(f))),
    storm: two(f => virus(10, '#ffe060', '#6a4a00', '#fff8c0', '#ff6040', spin(f))),
    retro: two(f => virus(9, '#c080ff', '#3a0a6a', '#ecd8ff', '#ffe060', spin(f))),
    amoeba: blob(12, '#f0a0b0', '#7a2a40', '#ffd8e0', '#6a1a30'),
    toxo: two(f => mk(24, 14, p => {   // Toxoplasma is crescent-shaped
      for (let y = 0; y < 14; y++) for (let x = 0; x < 24; x++) {
        const a = Math.hypot((x - 12) / 11, (y - 9) / 6.5), b = Math.hypot((x - 12) / 9, (y - 12 + f) / 5.5);
        if (a <= 1 && b > 1) p(x, y, a > .82 ? '#3a0a5a' : y < 6 ? '#e0b0ff' : '#b060e0');
      }
    })),
    confShot: art(['.c.', 'cCc', '.c.'], { c: '#7a2aa0', C: '#e0b0ff' }),
    // power-up icons
    lyso: art(['..l.l..', '.lLLLl.', 'lLWLWLl', 'lLLLLLl', 'lLWLWLl', '.lLLLl.', '..l.l..'], { l: '#3a8a6a', L: '#c0ffe0', W: '#fff' }),
    chain: art(['...cc..', '..cC...', '.cCc...', 'cCCCCc.', '...cCc.', '...Cc..', '..cc...'], { c: '#2a5aa0', C: '#b0e0ff' }),
    stasis: art(['.s.s.s.', 's.sSs.s', '.sSWSs.', 'sSWWWSs', '.sSWSs.', 's.sSs.s', '.s.s.s.'], { s: '#4a8ab0', S: '#a0e0ff', W: '#fff' }),
    plasma: art(['.pp.pp.', 'pPPpPPp', 'pPWPPPp', 'pPPPPPp', '.pPPPp.', '..pPp..', '...p...'], { p: '#a02040', P: '#ff80a0', W: '#fff' }),
    stealth: art(['..ggg..', '.gGGGg.', 'gG.G.Gg', 'gGGGGGg', 'gGGGGGg', 'gG.g.Gg', 'g.....g'], { g: '#50506a', G: '#b0b0d0' }),
  });
  SPR.cmv = SPR.cmv0;
  const KEYS = ['reo', 'hcv', 'coxsackie', 'vzv', 'ebv', 'cmv0', 'cmv1', 'cmv2', 'influb', 'flufrag', 'polyoma', 'mpox', 'parvo', 'replica'];
  const BOSSK = ['replicator', 'storm', 'retro', 'amoeba', 'toxo'];
  for (const k of [...KEYS, ...BOSSK]) SPR[k + 'W'] = SPR[k].map(whiteOf);
  SPR.cmvW = SPR.cmv0W;
  const tint = src => mk(src.width, src.height, (p, g) => { g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = .5; g.fillStyle = '#ff2040'; g.fillRect(0, 0, src.width, src.height); });
  for (const k of KEYS) SPR[k + 'M'] = SPR[k].map(tint);
  SPR.cmvM = SPR.cmv0M;
  V.SKEY.cmv = e => 'cmv' + (e.size || 0);

  Object.assign(V.PCOL, {
    reo: ['#80c0ff', '#d0e8ff'], hcv: ['#60e0a0', '#c0ffe0'], coxsackie: ['#ff90c0', '#ffd0e8'], vzv: ['#ffb070', '#ffe0c0'], ebv: ['#b0a0ff', '#e0d8ff'],
    cmv: ['#e0e060', '#ffffc0'], influb: ['#90c0e0', '#d0f0ff'], flufrag: ['#4a8ab0', '#d0f0ff'], polyoma: ['#e0e0ff', '#b0b0ff'], mpox: ['#d09070', '#f8d0b0'],
    parvo: ['#ff7070', '#ffc0c0'], replica: ['#50b0a0', '#a0e0d0'],
    replicator: ['#70f0d0', '#d0fff0', '#0a4a3a', '#fff'], storm: ['#ffe060', '#fff8c0', '#ff6040', '#fff'], retro: ['#c080ff', '#ecd8ff', '#ffe060', '#fff'],
    amoeba: ['#f0a0b0', '#ffd8e0', '#7a2a40', '#fff'], toxo: ['#b060e0', '#e0b0ff', '#3a0a5a', '#fff'],
  });

  // ---------- behaviour ----------
  const wobble = (e, X, amp, freq) => { const w = Math.sin(e.t * freq) * amp; X.tx += -X.uy * w; X.ty += X.ux * w; };
  const allies = (X, e, r) => X.S.enemies.filter(o => o !== e && o.hp > 0 && !o.boss && Math.hypot(o.x - e.x, o.y - e.y) < r);
  Object.assign(V.AI, {
    reo(e, X) {   // keeps a shield on the nearest friend
      wobble(e, X, 8, 2);
      let best = null, bd = 50;
      for (const o of allies(X, e, 50)) { const d = Math.hypot(o.x - e.x, o.y - e.y); if (d < bd && o.type !== 'reo') { bd = d; best = o; } }
      if (best) { best.reoUntil = V.G.clock + .25; e.shieldOn = best; } else e.shieldOn = null;
    },
    hcv(e, X) {   // heals everything around it in pulses
      if (X.d < 60) { X.tx = -X.ux * e.spd; X.ty = -X.uy * e.spd; } else wobble(e, X, 10, 1.5);
      e.heal -= X.dt;
      if (e.heal <= 0 && X.inside) {
        e.heal = 2.2; e.pulse = .5;
        for (const o of allies(X, e, 42)) if (o.hp < o.maxHp) { o.hp = Math.min(o.maxHp, o.hp + o.maxHp * .2); X.burst(o.x, o.y, 4, ['#60e0a0', '#fff'], 30); }
      }
      e.pulse = (e.pulse || 0) - X.dt;
    },
    coxsackie(e, X) {   // blinks aside when a shot is about to land
      wobble(e, X, 12, 5);
      e.hopT -= X.dt;
      if (e.hopT > 0 || !X.inside) return;
      for (const b of X.S.bullets) {
        const rx = e.x - b.x, ry = e.y - b.y, bv = Math.hypot(b.vx, b.vy) || 1, along = (rx * b.vx + ry * b.vy) / bv;
        if (along < 0 || along > 30 || Math.abs((rx * b.vy - ry * b.vx) / bv) > e.r + 2) continue;
        if (Math.random() < .5 + X.sm * .3) {
          const s = Math.random() < .5 ? -1 : 1;
          X.burst(e.x, e.y, 6, X.V.PCOL.coxsackie, 40);
          e.x = X.clamp(e.x + b.vy / bv * 22 * s, 8, X.W - 8); e.y = X.clamp(e.y - b.vx / bv * 22 * s, X.TOP + 8, X.BOT - 8);
          X.burst(e.x, e.y, 6, X.V.PCOL.coxsackie, 40); X.V.SND.blink();
        }
        e.hopT = X.rnd(1.6, 2.4); break;
      }
    },
    vzv(e, X) {   // leaves itchy spots
      wobble(e, X, 10, 3);
      e.spot -= X.dt;
      if (e.spot <= 0 && X.inside && X.S.mines.length < 14) { e.spot = X.rnd(2.2, 3) * X.D.fire; X.S.mines.push({ x: e.x, y: e.y, t: 0, fuse: 2.2, small: true }); }
    },
    ebv(e, X) {   // a tightening spiral around you, sniping as it closes
      const P = X.P;
      e.orbit += X.dt * (1 + (95 - e.rad) / 60);
      e.rad -= X.dt * 12; if (e.rad < 22) e.rad = 95;
      const gx = X.clamp(P.x + Math.cos(e.orbit) * e.rad, 8, X.W - 8), gy = X.clamp(P.y + Math.sin(e.orbit) * e.rad * .75, X.TOP + 8, X.BOT - 8);
      X.tx = X.clamp((gx - e.x) * 4, -e.spd * 1.5, e.spd * 1.5); X.ty = X.clamp((gy - e.y) * 4, -e.spd * 1.5, e.spd * 1.5);
      e.fire -= X.dt;
      if (e.fire <= 0 && X.inside) { e.fire = X.rnd(1.8, 2.6) * X.D.fire; X.toxin(e.x, e.y, X.aimA, 64); X.V.SND.spit(); }
    },
    cmv(e, X) {   // eats smaller viruses to grow
      if ((e.size || 0) >= 2) { X.tx *= .8; X.ty *= .8; return; }
      const SMALL = ['virus', 'mini', 'zika', 'parvo', 'spore', 'h5n1', 'coxsackie'];
      let best = null, bd = 70;
      for (const o of X.S.enemies) {
        if (o.hp <= 0 || !SMALL.includes(o.type)) continue;
        const dd = Math.hypot(o.x - e.x, o.y - e.y);
        if (dd < e.r + o.r + 1) {
          e.size = Math.min(2, (e.size || 0) + 1); e.hp += o.maxHp * 2; e.maxHp += o.maxHp * 2; e.r = 4 + e.size * 2; e.score += o.score;
          X.kill(o, true); X.burst(e.x, e.y, 10, X.V.PCOL.cmv, 50); X.V.SND.spores(); return;
        }
        if (dd < bd) { bd = dd; best = o; }
      }
      if (best) { X.tx = (best.x - e.x) / bd * e.spd * 1.4; X.ty = (best.y - e.y) / bd * e.spd * 1.4; }
    },
    influb(e, X) { wobble(e, X, 12, 4); },
    flufrag(e, X) { e.life -= X.dt; if (e.life <= 0) { X.kill(e, true); return 'gone'; } X.snap = true; X.tx = e.fvx; X.ty = e.fvy; },
    polyoma(e, X) {   // glows (and reflects shots) on a cycle
      wobble(e, X, 8, 2.5);
      e.glowT -= X.dt;
      if (e.glowT <= 0) { e.glow = !e.glow; e.glowT = e.glow ? 1.1 : X.rnd(2.2, 3); }
      e.invuln = !!e.glow;
    },
    mpox(e, X) {   // tractor beam: winds up, then drags you in
      const P = X.P;
      if (e.state === 'pull') {
        X.tx = X.ty = 0; X.snap = true; e.st -= X.dt;
        const str = 34 + X.sm * 16; X.S.tugX += -X.ux * str; X.S.tugY += -X.uy * str;
        if (e.st <= 0 || X.d > 140) { e.state = 'move'; e.cd = X.rnd(3, 4.5) * X.D.fire; }
        return;
      }
      wobble(e, X, 6, 2);
      if (X.d < 50) { X.tx = -X.ux * e.spd; X.ty = -X.uy * e.spd; }
      e.cd -= X.dt;
      if (e.cd <= 0 && X.inside && X.d < 120) { e.state = 'pull'; e.st = 1.6; X.V.SND.charge(); }
    },
    parvo(e, X) { wobble(e, X, 10, 9); },

    // ---------- bosses ----------
    replicator(e, X) {   // copies itself; heals while copies live
      const P = X.P, rage = e.hp < e.maxHp / 2;
      X.tx = ((X.W - 44) - e.x) * 1.1; X.ty = X.clamp((P.y - e.y) * .6 + Math.sin(e.t * .8) * 18, -e.spd, e.spd);
      const reps = X.S.enemies.filter(o => o.type === 'replica' && o.hp > 0);
      // each copy heals it a little — capped, and never once it's enraged, so the fight can't stall
      // (and never faster than 40% of your damage output, so any build makes progress)
      if (reps.length && !e.enraged) e.hp = Math.min(e.maxHp, e.hp + Math.min(e.maxHp * Math.min(.012, .005 * reps.length), X.V.game.playerDPS() * .4) * X.dt);
      e.copyT -= X.dt;
      if (e.copyT <= 0 && X.inside && reps.length < (rage ? 3 : 2)) {
        e.copyT = (rage ? 6.5 : 8) * X.D.fire;
        const c = X.spawn('replica', e.x - 8, e.y + X.rnd(-10, 10)); c.hp = c.maxHp = Math.min(e.maxHp * .065, X.V.game.playerDPS() * 6);   // a copy never takes more than ~6s of your fire c.kx = -80;
        X.burst(e.x, e.y, 20, X.V.PCOL.replicator, 60); X.V.SND.spores(); X.V.ui.toast(X.up(X.t('toast.replica')), '#70f0d0');
      }
      e.spin += X.dt * 1.2; e.fire -= X.dt;
      if (e.fire <= 0 && X.inside) { e.fire = (rage ? 1.4 : 1.9) * X.D.fire; for (let i = 0; i < 10; i++) X.toxin(e.x, e.y, e.spin + i * TAU / 10, 44); for (let i = -1; i <= 1; i++) X.toxin(e.x, e.y, X.aimA + i * .15, 62); X.V.SND.bossShot(); }
    },
    replica(e, X) {   // a weaker copy that fights like the original
      wobble(e, X, 14, 1.5);
      if (X.d < 50) { X.tx = -X.ux * e.spd; X.ty = -X.uy * e.spd; }
      e.spin += X.dt * 1.2; e.fire -= X.dt;
      if (e.fire <= 0 && X.inside) { e.fire = 2.4 * X.D.fire; for (let i = 0; i < 6; i++) X.toxin(e.x, e.y, e.spin + i * TAU / 6, 42); }
    },
    storm(e, X) {   // strikes on marked circles, plus aimed bolts
      const P = X.P, rage = e.hp < e.maxHp / 2;
      X.tx = ((X.W / 2 + Math.sin(e.t * .5) * 70) - e.x) * .8; X.ty = ((X.TOP + 22) - e.y) * 1.5;
      e.strikeT -= X.dt;
      if (e.strikeT <= 0 && X.inside) {
        e.strikeT = (rage ? .75 : 1.1) * X.D.fire;
        const n = rage ? 3 : 2;
        for (let i = 0; i < n; i++) {
          const x = i === 0 ? P.x + P.svx * .8 * X.sm : P.x + X.rnd(-55, 55), y = i === 0 ? P.y + P.svy * .8 * X.sm : P.y + X.rnd(-40, 40);
          e.strikes.push({ x: X.clamp(x, 10, X.W - 10), y: X.clamp(y, X.TOP + 10, X.BOT - 10), t: 0 });
        }
      }
      for (const s of e.strikes) {
        s.t += X.dt;
        if (s.t >= 1 && !s.hit) {
          s.hit = true;
          X.S.toxins.push({ x: s.x, y: s.y, vx: 0, vy: 0, life: .2, r: 9 });
          for (let i = 0; i < 6; i++) X.toxin(s.x, s.y, i * TAU / 6 + s.x, 46);
          X.burst(s.x, s.y, 16, ['#ffe060', '#fff', '#ff6040'], 70); X.V.SND.boom(); X.shake(.12);
        }
      }
      e.strikes = e.strikes.filter(s => s.t < 1.2);
      e.bolt -= X.dt;
      if (e.bolt <= 0 && X.inside) { e.bolt = (rage ? 1.4 : 2) * X.D.fire; for (let i = -1; i <= 1; i++) X.toxin(e.x, e.y, X.aimA + i * .12, 80); X.V.SND.snipe(); }
    },
    retro(e, X) {   // rewinds its health to 3s ago — unless you dash through it while it winds up
      const P = X.P, rage = e.hp < e.maxHp / 2;
      e.histT -= X.dt;
      if (e.histT <= 0) { e.histT = .25; e.hist.push([e.hp, e.x, e.y]); if (e.hist.length > 12) e.hist.shift(); }
      if (e.state === 'wind') {
        X.tx = X.ty = 0; e.st -= X.dt;
        if (P.dashing > 0 && Math.hypot(P.x - e.x, P.y - e.y) < e.r + 10) {
          e.state = 'move'; e.rewT = (rage ? 6 : 8) * X.D.fire; X.burst(e.x, e.y, 24, ['#c080ff', '#fff'], 80); X.V.SND.shell();
          X.V.ui.toast(X.up(X.t('toast.rewindStop')), '#c080ff'); return;
        }
        if (e.st <= 0) {
          const [hp, x, y] = e.hist[0] || [e.hp, e.x, e.y];
          X.burst(e.x, e.y, 20, X.V.PCOL.retro, 60);
          e.hp = Math.max(e.hp, Math.min(e.maxHp, hp)); e.x = x; e.y = y; e.vx = e.vy = e.kx = e.ky = 0; e.hist = [];
          X.burst(e.x, e.y, 20, X.V.PCOL.retro, 60); X.V.SND.blink(); X.V.ui.toast(X.up(X.t('toast.rewind')), '#c080ff');
          for (let i = 0; i < 14; i++) X.toxin(e.x, e.y, i * TAU / 14, 46);
          e.state = 'move'; e.rewT = (rage ? 6 : 8) * X.D.fire;
        }
        return;
      }
      const s = X.d > 60 ? 1 : -.6; X.tx = X.ux * e.spd * s - X.uy * e.spd * .7; X.ty = X.uy * e.spd * s + X.ux * e.spd * .7;
      e.fire -= X.dt;
      if (e.fire <= 0 && X.inside) { e.fire = (rage ? 1.1 : 1.5) * X.D.fire; for (let i = -1; i <= 1; i++) X.toxin(e.x, e.y, X.aimA + i * .16, 64); X.V.SND.bossShot(); }
      e.rewT -= X.dt;
      if (e.rewT <= 0 && X.inside) { e.state = 'wind'; e.st = 1.4; X.V.SND.charge(); }
    },
    amoeba(e, X) {   // slow; reaches with pseudopods of toxin; swallows you on contact until you dash out
      const P = X.P, rage = e.hp < e.maxHp / 2;
      if (P.engulfedBy === e) {
        X.tx = X.ux * e.spd * .3; X.ty = X.uy * e.spd * .3; e.harmless = true;
        P.x = e.x; P.y = e.y;
        e.biteT -= X.dt;
        if (e.biteT <= 0) { e.biteT = 1.4; P.inv = 0; X.V.game.hurtAt(e.x, e.y, 'amoeba'); }
        if (P.dashing > 0) {   // break free
          P.engulfedBy = null; e.harmless = false; P.inv = 1.2; e.cd = 3;
          X.burst(P.x, P.y, 24, X.V.PCOL.amoeba, 90); X.V.SND.shell();
        }
        return;
      }
      e.harmless = false;
      X.tx = X.ux * e.spd; X.ty = X.uy * e.spd;
      e.cd -= X.dt;
      if (X.d < e.r + 4 && e.cd <= 0 && P.dashInv <= 0 && P.inv <= 0) {
        P.engulfedBy = e; e.biteT = .8; X.V.SND.hurt(); X.V.ui.toast(X.up(X.t('toast.engulfed')), '#f0a0b0');
        return;
      }
      if (e.cd <= 0 && X.d < 90 && e.state !== 'lunge') { e.state = 'lunge'; e.cd = 0; X.V.SND.charge(); }
      if (e.state === 'lunge') { X.snap = true; X.tx = X.ux * 70; X.ty = X.uy * 70; if (X.d > 110 || e.cd < -1.5) { e.state = 'move'; e.cd = 3; } }
      e.podT -= X.dt;
      if (e.podT <= 0 && X.inside) {
        e.podT = (rage ? 2.3 : 3) * X.D.fire;
        for (let i = 0; i < (rage ? 2 : 1); i++) e.pods.push({ a: X.aimA + (i ? X.rnd(-.8, .8) : 0), t: 0 });
        X.V.SND.charge();
      }
      for (const p of e.pods) {
        p.t += X.dt;
        if (p.t >= .8 && !p.fired) { p.fired = true; for (let d = e.r + 2; d < 90; d += 5) X.S.toxins.push({ x: e.x + Math.cos(p.a) * d, y: e.y + Math.sin(p.a) * d, vx: 0, vy: 0, life: .5 }); }
      }
      e.pods = e.pods.filter(p => p.t < 1.3);
    },
    toxo(e, X) {   // slow purple pulses that scramble your controls, aimed shots, and short blinks
      const P = X.P, rage = e.hp < e.maxHp / 2;
      if (e.state === 'tele') {
        X.tx = X.ty = 0; e.st -= X.dt;
        if (e.st <= 0) { X.burst(e.x, e.y, 14, X.V.PCOL.toxo, 50); e.x = e.bx; e.y = e.by; e.vx = e.vy = e.kx = e.ky = 0; X.burst(e.x, e.y, 14, X.V.PCOL.toxo, 50); X.V.SND.blink(); e.state = 'move'; }
        return;
      }
      wobble(e, X, 16, 1.2);
      if (X.d < 60) { X.tx = -X.ux * e.spd; X.ty = -X.uy * e.spd; }
      e.pulse -= X.dt;
      if (e.pulse <= 0 && X.inside) {
        e.pulse = (rage ? 2.6 : 3.4) * X.D.fire;
        const n = rage ? 14 : 10;
        for (let i = 0; i < n; i++) { const a = e.t + i * TAU / n; X.S.toxins.push({ x: e.x, y: e.y, vx: Math.cos(a) * 32, vy: Math.sin(a) * 32, life: 5, confuse: true, r: 3 }); }
        X.V.SND.spores();
      }
      e.fire -= X.dt;
      if (e.fire <= 0 && X.inside) { e.fire = (rage ? 1.2 : 1.6) * X.D.fire; for (let i = -1; i <= 1; i++) X.toxin(e.x, e.y, X.aimA + i * .18, 62); X.V.SND.bossShot(); }
      e.blinkT -= X.dt;
      if (e.blinkT <= 0 && X.inside) {
        e.blinkT = X.rnd(5, 7);
        const a = X.rnd(0, TAU); e.bx = X.clamp(P.x + Math.cos(a) * 80, 16, X.W - 16); e.by = X.clamp(P.y + Math.sin(a) * 50, X.TOP + 14, X.BOT - 14);
        e.state = 'tele'; e.st = .6;
      }
    },
  });
  Object.assign(V.ON_KILL, {
    influb: (e, X) => { for (let i = 0; i < 3; i++) { const a = i * TAU / 3 + X.rnd(0, 1), f = X.spawn('flufrag', e.x, e.y); f.fvx = Math.cos(a) * 95; f.fvy = Math.sin(a) * 95; } },
    replicator: (e, X) => { for (const o of X.S.enemies) if (o.type === 'replica' && o.hp > 0) X.kill(o, true); },
    amoeba: (e, X) => { if (X.P.engulfedBy === e) { X.P.engulfedBy = null; X.P.inv = 1; } },
  });
  // Polyomavirus: while glowing, it bounces your shots back
  V.ON_HIT.polyoma = (e, b, X) => { if (e.glow && e.t - (e.lastR ?? -9) > .12) { e.lastR = e.t; X.toxin(b.x, b.y, Math.atan2(-b.vy, -b.vx) + X.rnd(-.1, .1), 80); } };

  Object.assign(V.DRAW, {
    replica(ctx, e, { R }) {   // a pulsing green heal link to the Replicator
      const b = V.G.S.enemies.find(o => o.type === 'replicator' && o.hp > 0); if (!b || b.enraged) return;
      const n = Math.ceil(Math.hypot(b.x - e.x, b.y - e.y) / 3), off = Math.floor(e.t * 12);
      ctx.fillStyle = '#60e0a0';
      for (let k = 1; k < n; k++) if ((k + off) % 3 === 0) ctx.fillRect(R(e.x + (b.x - e.x) * k / n), R(e.y + (b.y - e.y) * k / n), 1, 1);
    },
    reo(ctx, e, { ring }) { const o = e.shieldOn; if (o && o.hp > 0) { ctx.globalAlpha = .6; ring(o.x, o.y, o.r + 3, 12, '#80c0ff', e.t * 2); ctx.globalAlpha = 1; } },
    hcv(ctx, e, { ring }) { if (e.pulse > 0) { ctx.globalAlpha = e.pulse * 1.4; ring(e.x, e.y, 42 - e.pulse * 60, 24, '#60e0a0'); ctx.globalAlpha = 1; } },
    polyoma(ctx, e, { ring }) { if (e.glow) { ring(e.x, e.y, e.r + 3, 14, '#ffffff', e.t * 4); ring(e.x, e.y, e.r + 5, 10, '#b0b0ff', -e.t * 3); } },
    mpox(ctx, e, { R }) {
      if (e.state !== 'pull') return;
      const P = V.G.P, n = Math.ceil(Math.hypot(P.x - e.x, P.y - e.y) / 3);
      ctx.fillStyle = '#f8d0b0';
      for (let k = 1; k < n; k++) if ((k + Math.floor(e.t * 20)) % 3 === 0) ctx.fillRect(R(e.x + (P.x - e.x) * k / n), R(e.y + (P.y - e.y) * k / n), 1, 1);
    },
    storm(ctx, e, { ring }) {
      for (const s of e.strikes) { if (s.hit) continue; const late = s.t > .6; if (late && Math.floor(s.t * 16) % 2) continue; ring(s.x, s.y, 10 - s.t * 3, 18, late ? '#ff6040' : '#ffe060', s.t * 3); ring(s.x, s.y, 3, 6, '#fff'); }
    },
    retro(ctx, e, { ring, R }) {
      if (e.state !== 'wind') return;
      ring(e.x, e.y, e.r + 6, 20, '#c080ff', -e.t * 6);   // a clock hand sweeping backwards
      const a = -e.t * 8; ctx.fillStyle = '#ffe060';
      for (let k = 0; k < 8; k++) ctx.fillRect(R(e.x + Math.cos(a) * k * 1.5), R(e.y + Math.sin(a) * k * 1.5), 1, 1);
      const h = e.hist[0]; if (h) { ctx.globalAlpha = .35; ring(h[1], h[2], e.r, 16, '#c080ff'); ctx.globalAlpha = 1; }   // where it'll snap back to
    },
    amoeba(ctx, e, { R }) {
      for (const p of e.pods) { if (p.fired && p.t > 1) continue; const late = p.t > .5; if (late && Math.floor(p.t * 20) % 2) continue;
        ctx.fillStyle = late ? '#ff6080' : '#8a3a50'; for (let d = e.r + 2; d < 90; d += late ? 2 : 4) ctx.fillRect(R(e.x + Math.cos(p.a) * d), R(e.y + Math.sin(p.a) * d), 1, 1); }
    },
    toxo(ctx, e, { ring }) { if (e.state === 'tele' && Math.floor(e.t * 10) % 2) ring(e.bx, e.by, 10, 16, '#b060e0'); },
  });
})();
