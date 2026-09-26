// Expansion 7 (art + behaviour): the Juggernaut, Siphon, Tempest, Thief and Pulsar, and five power-ups
// (T-Cell Lance, Fission Shots, Sentinel Cells, Kinase Rush, Antibody Barrage).
(() => {
  const V = window.VAX;
  const { SPR } = V;
  const { mk, art, whiteOf, virus } = V.kit;
  const TAU = Math.PI * 2;
  const two = fn => [0, 1].map(fn), spin = f => f * Math.PI / 8;
  const angOff = (a, b) => Math.abs(((a - b + Math.PI * 3) % TAU) - Math.PI);

  // ---------- sprites ----------
  Object.assign(SPR, {
    juggernaut: two(f => mk(21, 21, p => { for (let y = 0; y < 21; y++) for (let x = 0; x < 21; x++) { const d = Math.hypot(x - 10, y - 10); if (d <= 10) p(x, y, d > 9 ? '#3a3a4a' : (Math.round(Math.atan2(y - 10, x - 10) * 4 + f) % 3 === 0 && d > 5) ? '#8080a0' : d < 3 ? '#ff5050' : '#b0b0c0'); } })),
    siphon: two(f => virus(6, '#c060ff', '#3a0a5a', '#f0c0ff', '#ff4080', spin(f))),
    tempest: two(f => mk(19, 19, p => { for (let y = 0; y < 19; y++) for (let x = 0; x < 19; x++) { const dx = x - 9, dy = y - 9, d = Math.hypot(dx, dy); if (d > 9) continue; const sw = (Math.atan2(dy, dx) + d * .5 + f * .8) % 1.6; p(x, y, d > 8 ? '#2a5a7a' : sw < .5 ? '#ffffff' : d < 3 ? '#e0ffff' : '#a0e0ff'); } })),
    thief: two(f => mk(17, 17, p => { for (let y = 0; y < 17; y++) for (let x = 0; x < 17; x++) { const d = Math.hypot(x - 8, y - 8); if (d > 8) continue; const mask = y > 5 && y < 9; p(x, y, d > 7 ? '#5a4010' : mask ? ((x === 5 || x === 11) ? '#ffffff' : '#1a1a1a') : (x + y + f) % 5 === 0 ? '#fff0a0' : '#ffd040'); } })),
    pulsar: two(f => mk(21, 21, p => { for (let y = 0; y < 21; y++) for (let x = 0; x < 21; x++) { const d = Math.hypot(x - 10, y - 10); if (d > 10) continue; const ring = Math.abs(d - (f ? 7 : 6)) < .7; p(x, y, d > 9.2 ? '#5a1040' : ring ? '#ffffff' : d < 3 ? '#ffe0f0' : d < 5 ? '#ff80c0' : '#c04080'); } })),
    lance: art(['......L', '.....Lc', '....Lc.', '...Lc..', '..Lc...', '.Lc....', 'Lc.....'], { L: '#ffffff', c: '#80ffff' }),
    fission: art(['o.....o', '.o...o.', '..oOo..', '..OWO..', '..oOo..', '.o...o.', 'o.....o'], { o: '#ffb060', O: '#ffd0a0', W: '#fff' }),
    sentinel: art(['.g...g.', '..ggg..', '.gGWGg.', 'ggWWWgg', '.gGWGg.', '..ggg..', '.g...g.'], { g: '#60c040', G: '#a0ff80', W: '#fff' }),
    kinase: art(['..k....', '.kK....', 'kKKkkk.', '.kKKKKk', '...kKk.', '...kk..', '...k...'], { k: '#c03030', K: '#ff7070' }),
    barrage: art(['b..b..b', 'B..B..B', 'B..B..B', 'W..W..W', '.......', 'r.r.r.r', '.r.r.r.'], { b: '#ffffff', B: '#ffe0a0', W: '#ffb040', r: '#ff6040' }),
    sentMine: two(f => art(['.g.', 'gWg', '.g.'].map(r => f ? r : r.replace('W', 'G')), { g: '#60c040', G: '#a0ff80', W: '#ffffff' })),
  });
  for (const k of ['juggernaut', 'siphon', 'tempest', 'thief', 'pulsar']) SPR[k + 'W'] = SPR[k].map(whiteOf);
  Object.assign(V.PCOL, {
    juggernaut: ['#b0b0c0', '#8080a0', '#ff5050', '#fff'], siphon: ['#c060ff', '#f0c0ff', '#ff4080', '#fff'], tempest: ['#a0e0ff', '#ffffff', '#2a5a7a', '#e0ffff'],
    thief: ['#ffd040', '#fff0a0', '#1a1a1a', '#fff'], pulsar: ['#ff80c0', '#ffffff', '#c04080', '#ffe0f0'],
  });

  const seek = (e, X, gx, gy, k = 1, cap = 1.3) => { X.tx = X.clamp((gx - e.x) * k, -e.spd * cap, e.spd * cap); X.ty = X.clamp((gy - e.y) * k, -e.spd * cap, e.spd * cap); };
  const midY = X => (X.TOP + X.BOT) / 2;

  // ---------- bosses ----------
  Object.assign(V.AI, {
    juggernaut(e, X) {   // armoured front: turns slowly to face you; charges; stunned after a charge (its back is open)
      const P = X.P, rage = e.hp < e.maxHp / 2, want = Math.atan2(P.y - e.y, P.x - e.x);
      if (e.state === 'move' || e.state === 'tele') {
        const turn = (rage ? 1.25 : .9) * X.dt, diff = ((want - e.face + Math.PI * 3) % TAU) - Math.PI;
        e.face += Math.max(-turn, Math.min(turn, diff));
      }
      if (e.state === 'tele') { X.tx = X.ty = 0; e.st -= X.dt; e.flash = .05; if (e.st <= 0) { e.state = 'charge'; e.st = .9; } return; }
      if (e.state === 'charge') {
        X.tx = Math.cos(e.face) * 150; X.ty = Math.sin(e.face) * 150; X.snap = true; e.st -= X.dt;
        const wall = e.x < 14 || e.x > X.W - 14 || e.y < X.TOP + 12 || e.y > X.BOT - 12;
        if (e.st <= 0 || wall) { e.state = 'stun'; e.st = rage ? 1.3 : 1.8; if (wall) { X.shake(.3); X.V.SND.boom(); } for (let i = 0; i < 10; i++) X.toxin(e.x, e.y, i * TAU / 10, 40); }
        return;
      }
      if (e.state === 'stun') { X.tx = X.ty = 0; e.st -= X.dt; if (e.st <= 0) { e.state = 'move'; e.cd = (rage ? 2.4 : 3.2) * X.D.fire; } return; }
      // walk the way it faces; too close and it backs off; never hide at the edge of the vessel
      const k = X.d > 70 ? .7 : X.d < 45 ? -.6 : 0;
      X.tx = Math.cos(e.face) * e.spd * k; X.ty = Math.sin(e.face) * e.spd * k;
      if (e.x > X.W - 30) X.tx = -e.spd; else if (e.x < 30) X.tx = e.spd;
      if (e.y < X.TOP + 20) X.ty = e.spd; else if (e.y > X.BOT - 20) X.ty = -e.spd;
      e.cd -= X.dt;
      if (e.cd <= 0 && X.inside) { e.state = 'tele'; e.st = .7; X.V.SND.charge(); }
      e.fire -= X.dt;
      if (e.fire <= 0 && X.inside) { e.fire = (rage ? 1.3 : 1.8) * X.D.fire; const a = X.aimAt(e.x, e.y, 60); for (let i = -2; i <= 2; i++) X.toxin(e.x, e.y, a + i * .15, 60); X.V.SND.bossShot(); }
    },
    siphon(e, X) {   // tethers onto you and drains: it heals, you shoot slower, and holding on too long hurts
      const S = X.S, P = X.P, rage = e.hp < e.maxHp / 2;
      const gx = P.x + (e.x - P.x) / X.d * 68, gy = P.y + (e.y - P.y) / X.d * 68;
      seek(e, X, X.clamp(gx, 20, X.W - 14), X.clamp(gy, X.TOP + 12, X.BOT - 12), 1.5, 1.3);
      e.tcd -= X.dt;
      if (!e.teth && e.tcd <= 0 && X.d < 95 && X.inside) { e.teth = 1; e.held = 0; X.V.SND.charge(); }
      if (e.teth) {
        if (X.d > 118 || P.dashing > 0) {   // broken
          e.teth = 0; e.tcd = rage ? 2.4 : 3.4; X.V.SND.block();
          for (let k = 0; k <= 6; k++) X.burst(e.x + (P.x - e.x) * k / 6, e.y + (P.y - e.y) * k / 6, 2, ['#c060ff', '#fff'], 30);
        } else {
          e.held += X.dt;
          e.hp = Math.min(e.maxHp, e.hp + e.maxHp * .012 * (rage ? 1.5 : 1) * X.dt);
          P.fireT += X.dt * .4;   // your antibodies come out slower
          S.tugX += (e.x - P.x) / X.d * 22; S.tugY += (e.y - P.y) / X.d * 22;
          if (e.held >= 3) { e.held = 0; X.V.game.hurtAt(e.x, e.y, 'siphon'); }
        }
      }
      e.fire -= X.dt;
      if (e.fire <= 0 && X.inside) { e.fire = (rage ? 1.6 : 2.2) * X.D.fire * (e.teth ? 1.4 : 1); for (let i = -2; i <= 2; i++) X.toxin(e.x, e.y, X.aimA + i * .16, 58); X.V.SND.bossShot(); }
    },
    tempest(e, X) {   // wind: a warning lull, then a gust that shoves you and bends your antibodies
      const S = X.S, P = X.P, rage = e.hp < e.maxHp / 2;
      seek(e, X, X.W * .7 + Math.sin(e.t * .5) * 20, midY(X) + Math.sin(e.t * .8) * 40, 1, 1);
      e.gust -= X.dt;
      if (e.warn > 0) {
        e.warn -= X.dt;
        if (e.warn <= 0) S.wind = { x: e.wx, y: e.wy, t: rage ? 5.5 : 4.5 };
      } else if (e.gust <= 0) {
        // blow you toward the nearest wall — it's harder to dodge there
        const ox = P.x - X.W / 2, oy = P.y - midY(X), a = Math.atan2(oy, ox * .6) + X.rnd(-.6, .6), str = rage ? 1.3 : 1;
        e.wx = Math.cos(a) * str; e.wy = Math.sin(a) * str; e.warn = .9; S.wind = null; S.windWarn = { x: e.wx, y: e.wy, t: .9 };
        e.gust = (rage ? 5.5 : 6.5) * X.D.fire; X.V.SND.charge();
      }
      e.fire -= X.dt;
      if (e.fire <= 0 && X.inside) {
        e.fire = (rage ? 1.4 : 2) * X.D.fire; e.alt = !e.alt;
        if (e.alt) for (let i = 0; i < 10; i++) X.toxin(e.x, e.y, e.t + i * TAU / 10, 40);
        else for (let i = -1; i <= 1; i++) X.toxin(e.x, e.y, X.aimA + i * .2, 58);
        X.V.SND.bossShot();
      }
    },
    thief(e, X) {   // races you for power-ups, steals the ones you have, and fights with them
      const S = X.S, P = X.P, rage = e.hp < e.maxHp / 2, L = e.loot;
      for (const k in L) if (L[k] > 0) L[k] -= X.dt;
      const has = k => L[k] > 0, fast = has('speed') || has('adren') || has('vitc');
      const pk = S.pickups.filter(p => p.x > 4 && p.x < X.W - 4).sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y))[0];
      if (pk) {
        seek(e, X, pk.x, pk.y, 3, fast ? 1.8 : 1.3);
        if (Math.hypot(pk.x - e.x, pk.y - e.y) < 8) {
          S.pickups.splice(S.pickups.indexOf(pk), 1);
          if (pk.kind === 'heal') e.hp = Math.min(e.maxHp, e.hp + e.maxHp * .05);
          else { L[pk.kind] = 9; e.stolen ??= []; if (!e.stolen.includes(pk.kind) && e.stolen.length < 4) e.stolen.push(pk.kind); }
          X.V.ui.toast(X.V.t('toast.stolen', { name: X.V.tx.pow(pk.kind) }).toLocaleUpperCase(X.V.i18n.lang), '#ffd040'); X.V.SND.pick();
        }
      } else {
        const a = e.t * .6, gx = X.clamp(P.x + 90 + Math.cos(a) * 20, X.W * .4, X.W - 16), gy = X.clamp(P.y + Math.sin(a) * 50, X.TOP + 14, X.BOT - 14);
        seek(e, X, gx, gy, 1.5, fast ? 1.6 : 1.2);
      }
      e.bait -= X.dt;   // it tosses out a power-up to race you for
      if (e.bait <= 0) { e.bait = (rage ? 5 : 7) * X.D.fire; X.drop(X.V.randomPower(S.primed), X.rnd(X.W * .3, X.W * .6), X.rnd(X.TOP + 16, X.BOT - 16)); }
      e.steal -= X.dt;
      if (e.steal <= 0 && X.d < 130 && X.inside) {
        e.steal = (rage ? 5 : 7) * X.D.fire;
        const k = Object.keys(P.fx).filter(k => P.fx[k] > .5 && k !== 'atp').sort((a, b) => P.fx[b] - P.fx[a])[0];
        if (k) {
          L[k] = Math.min(10, P.fx[k]); P.fx[k] = 0; e.stolen ??= []; if (!e.stolen.includes(k) && e.stolen.length < 4) e.stolen.push(k);
          (S.zaps ??= []).push({ x1: e.x, y1: e.y, x2: P.x, y2: P.y, t: .25 });
          X.V.ui.toast(X.V.t('toast.stolen', { name: X.V.tx.pow(k) }).toLocaleUpperCase(X.V.i18n.lang), '#ffd040'); X.V.SND.blink(); X.V.ui.hud();
        }
      }
      e.fire -= X.dt;
      if (e.fire <= 0 && X.inside) {   // stolen power-ups change how it shoots
        e.fire = (rage ? 1.2 : 1.6) * X.D.fire * (has('rapid') || has('kinase') || has('vitc') ? .5 : 1);
        const n = has('spread') ? 5 : 3, sp = has('mega') || has('il2') || has('crit') ? 80 : 62;
        for (let i = 0; i < n; i++) X.toxin(e.x, e.y, X.aimAt(e.x, e.y, sp) + (i - (n - 1) / 2) * .16, sp);
        if (Object.values(L).filter(v => v > 0).length >= 2) for (let i = 0; i < 8; i++) X.toxin(e.x, e.y, e.t + i * TAU / 8, 40);
        X.V.SND.bossShot();
      }
    },
    pulsar(e, X) {   // expanding rings with two gaps, and slowly spinning beams
      const S = X.S, rage = e.hp < e.maxHp / 2;
      seek(e, X, X.W * .68, midY(X) + Math.sin(e.t * .4) * 20, 1, 1);
      e.pulse -= X.dt;
      if (e.pulse <= 0 && X.inside) {
        e.pulse = (rage ? 1.8 : 2.5) * X.D.fire;
        const g = X.rnd(0, TAU), gw = rage ? .32 : .45;
        for (let i = 0; i < 40; i++) { const a = i * TAU / 40; if (angOff(a, g) < gw || angOff(a, g + Math.PI) < gw) continue; X.toxin(e.x, e.y, a, 34); }
        X.V.SND.boom(); X.shake(.08);
      }
      e.beamT -= X.dt;
      if (e.beamT <= 0 && X.inside) {
        e.beamT = (rage ? 5 : 7) * X.D.fire;
        const n = rage ? 3 : 2, base = X.rnd(0, TAU), dir = Math.random() < .5 ? -1 : 1;
        for (let i = 0; i < n; i++) (S.beams ??= []).push({ owner: e, a: base + i * TAU / n, va: (rage ? .8 : .6) * dir, warn: .9, t: 2.6 });
        X.V.SND.charge();
      }
      e.fire = (e.fire ?? 1.5) - X.dt;
      if (e.fire <= 0 && X.inside) { e.fire = (rage ? 1.1 : 1.5) * X.D.fire; for (let i = -1; i <= 1; i += 2) X.toxin(e.x, e.y, X.aimA + i * .1, 62); }
    },
  });

  V.PRE_HIT.juggernaut = (e, b, X) => {   // shots on the armoured front just spark off (critical hits crack it)
    if (b.crit) return false;
    const off = angOff(Math.atan2(b.y - e.y, b.x - e.x), e.face);
    e.dmgMul = off > 2.1 ? 1.5 : 1;   // hits on its back land harder
    if (off < .85) { X.burst(b.x, b.y, 3, ['#ffffff', '#b0b0c0']); e.flash = .02; return true; }
    return false;
  };
  Object.assign(V.ON_KILL, {
    tempest: (e, X) => { X.S.wind = null; X.S.windWarn = null; },
    pulsar: (e, X) => { X.S.beams = []; },
    thief: (e, X) => { (e.stolen || []).forEach((k, i) => X.drop(k, e.x + (i - 1.5) * 9, e.y + (i % 2 ? 6 : -6))); },   // you get it all back
  });

  // ---------- power-ups ----------
  V.COLLECT = Object.assign(V.COLLECT || {}, {
    sentinel(S, P, X) {
      for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + Math.PI / 4; (S.traps ??= []).push({ x: X.clamp(P.x + Math.cos(a) * 20, 6, X.W - 6), y: X.clamp(P.y + Math.sin(a) * 20, X.TOP + 6, X.BOT - 6), t: 14 * P.dur }); }
      X.burst(P.x, P.y, 16, ['#a0ff80', '#fff'], 60);
    },
  });
  const MOD = V.MOD, kill0 = MOD.kill;
  MOD.kill = (e, S, P) => { kill0?.(e, S, P); if (P.fx.kinase > 0) P.kin = Math.min(1, (P.kin || 0) + .1); };
  MOD.afterHit = (e, b, P, S) => {   // Fission Shots: three shards burst out the far side
    if (!(P.fx.fission > 0) || b.frag) return;
    const a = Math.atan2(b.vy, b.vx);
    for (const off of [-.55, 0, .55]) S.bullets.push({ x: b.x, y: b.y, vx: Math.cos(a + off) * 160, vy: Math.sin(a + off) * 160, life: .45, dmg: b.dmg * .4, frag: true, pierce: false, hit: new Set([e]) });
  };
  const segDist = (px, py, ax, ay, bx, by) => { const vx = bx - ax, vy = by - ay, l = vx * vx + vy * vy || 1, k = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / l)); return Math.hypot(px - ax - vx * k, py - ay - vy * k); };

  const powfx = V.POWFX;
  V.POWFX = (S, P, dt, X) => {
    powfx?.(S, P, dt, X);
    const G = V.G, game = V.game;
    // T-Cell Lance: a beam along your aim while you're firing
    S.lanceOn = null;
    if (P.fx.lance > 0 && G.clock - (P.shotAt || -9) < .2 && P.hp > 0) {
      const x2 = P.x + Math.cos(P.aim) * 300, y2 = P.y + Math.sin(P.aim) * 300;
      S.lanceOn = { x2, y2 };
      P.lanceT = (P.lanceT || 0) - dt;
      if (P.lanceT <= 0) {
        P.lanceT = .1;
        for (const e of S.enemies) if (e.hp > 0 && !game.cloaked(e) && segDist(e.x, e.y, P.x, P.y, x2, y2) < e.r + 2) game.strikeAt(e, P.dmg / P.rate * .13);
        for (const t of S.toxins) if (segDist(t.x, t.y, P.x, P.y, x2, y2) < 3) t.life = 0;
      }
    }
    // Kinase Rush: the fire timer runs faster the more you've killed
    if (P.fx.kinase > 0) P.fireT -= dt * (P.kin || 0); else P.kin = 0;
    // Antibody Barrage: homing missiles at the biggest threats
    if (P.fx.barrage > 0) {
      P.barT = (P.barT || 0) - dt;
      if (P.barT <= 0) {
        P.barT = 1;
        const tg = S.enemies.filter(e => e.hp > 0 && !game.cloaked(e) && e.x > 0 && e.x < X.W).sort((a, b) => game.threat(b) - game.threat(a)).slice(0, 5);
        tg.forEach((e, i) => { const a = Math.atan2(e.y - P.y, e.x - P.x) + (i - 2) * .25; S.bullets.push({ x: P.x, y: P.y, vx: Math.cos(a) * 140, vy: Math.sin(a) * 140, life: 1.8, dmg: P.dmg * 1.5, homing: true, boom: true, big: true, pierce: false, hit: null }); });
        if (tg.length) V.SND.shoot();
      }
    }
    // Sentinel Cells: mines go off when a pathogen comes close
    if (S.traps?.length) {
      for (const m of S.traps) {
        m.t -= dt;
        if (m.t > 0 && S.enemies.some(e => e.hp > 0 && !game.cloaked(e) && Math.hypot(e.x - m.x, e.y - m.y) < 12 + e.r)) {
          m.t = 0;
          for (const e of S.enemies) if (e.hp > 0 && Math.hypot(e.x - m.x, e.y - m.y) < 26 + e.r) game.strikeAt(e, P.dmg * 10);
          for (const t of S.toxins) if (Math.hypot(t.x - m.x, t.y - m.y) < 26) t.life = 0;
          X.burst(m.x, m.y, 22, ['#a0ff80', '#ffffff', '#60c040'], 90); X.shake(.12); V.SND.boom();
        }
      }
      S.traps = S.traps.filter(m => m.t > 0);
    }
    // the Tempest's wind: shoves you, bends your antibodies, carries its own toxins
    if (S.windWarn) { S.windWarn.t -= dt; if (S.windWarn.t <= 0) S.windWarn = null; }
    if (S.wind) {
      const w = S.wind; w.t -= dt;
      if (w.t <= 0 || !S.enemies.some(e => e.type === 'tempest' && e.hp > 0)) S.wind = null;
      else {
        S.tugX += w.x * 30; S.tugY += w.y * 30;
        for (const b of S.bullets) { b.vx += w.x * 90 * dt; b.vy += w.y * 90 * dt; }
        for (const t of S.toxins) if (t.src === 'tempest') { t.vx += w.x * 30 * dt; t.vy += w.y * 30 * dt; }
      }
    }
  };

  // ---------- what the demo bot knows about these fights ----------
  V.botExtra = (S, P) => {
    const { W, TOP, BOT } = V;
    let fx = 0, fy = 0, dash = false, why = null;
    for (const e of S.enemies) {
      if (e.hp <= 0) continue;
      if (e.type === 'juggernaut') {   // circle round to its back
        const bx = Math.max(16, Math.min(W - 16, e.x - Math.cos(e.face) * 55)), by = Math.max(TOP + 12, Math.min(BOT - 12, e.y - Math.sin(e.face) * 55)), dx = bx - P.x, dy = by - P.y, d = Math.hypot(dx, dy) || 1;
        if (e.state !== 'tele' && e.state !== 'charge') { fx += dx / d * 2.2; fy += dy / d * 2.2; }
      }
      if (e.type === 'siphon' && e.teth && e.held > 1.2) dash = true;
    }
    for (const b of S.beams || []) {   // step off a beam's line (and the way it's sweeping)
      const x = b.owner.x, y = b.owner.y, cx = Math.cos(b.a), cy = Math.sin(b.a), rx = P.x - x, ry = P.y - y, along = rx * cx + ry * cy, side = rx * cy - ry * cx;
      if (along > 0 && Math.abs(side) < 18) { const s = side >= 0 ? 1 : -1; fx += cy * s * 4; fy += -cx * s * 4; }
    }
    for (const o of S.omens || []) { const dx = P.x - o.x, dy = P.y - o.y, d = Math.hypot(dx, dy) || 1; if (d < 16) { fx += dx / d * 4; fy += dy / d * 4; } }
    return { fx, fy, dash, why };
  };

  // ---------- drawing ----------
  Object.assign(V.DRAW, {
    juggernaut(ctx, e) {
      ctx.lineWidth = 3; ctx.strokeStyle = e.state === 'stun' ? '#606070' : '#e0e0f0';
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 3, e.face - 1, e.face + 1); ctx.stroke(); ctx.lineWidth = 1;
      if (e.state === 'stun') { ctx.fillStyle = '#ffe060'; for (let i = 0; i < 3; i++) { const a = e.t * 6 + i * TAU / 3; ctx.fillRect(Math.round(e.x + Math.cos(a) * 6), Math.round(e.y - e.r - 4 + Math.sin(a) * 2), 1, 1); } }
    },
    siphon(ctx, e) {
      if (!e.teth) return;
      const P = V.G.P;
      ctx.strokeStyle = '#c060ff'; ctx.globalAlpha = .6 + .4 * Math.sin(e.t * 20); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(P.x, P.y); ctx.stroke();
      ctx.strokeStyle = '#ff80c0'; ctx.lineWidth = 1; ctx.globalAlpha = Math.min(1, e.held / 3);
      ctx.beginPath(); ctx.arc(P.x, P.y, 9, -Math.PI / 2, -Math.PI / 2 + TAU * e.held / 3); ctx.stroke();   // fills up as the drain builds
      ctx.globalAlpha = 1;
    },
    thief(ctx, e) {
      const ks = Object.keys(e.loot).filter(k => e.loot[k] > 0);
      ks.forEach((k, i) => { const a = e.t * 3 + i * TAU / ks.length; ctx.fillStyle = V.POW[k]?.color || '#fff'; ctx.fillRect(Math.round(e.x + Math.cos(a) * (e.r + 4)) - 1, Math.round(e.y + Math.sin(a) * (e.r + 4)) - 1, 2, 2); });
    },
  });
  const drawExtras = V.drawExtras;
  V.drawExtras = (ctx, S, P, h) => {
    drawExtras?.(ctx, S, P, h);
    for (const m of S.traps || []) h.draw(SPR.sentMine[Math.floor(V.G.clock * 4) % 2], m.x, m.y);
    if (S.lanceOn) {
      ctx.strokeStyle = '#80ffff'; ctx.globalAlpha = .55 + .35 * Math.sin(V.G.clock * 50); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.lineTo(S.lanceOn.x2, S.lanceOn.y2); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;
    }
    const w = S.wind || S.windWarn;
    if (w) {   // wind streaks (steady during a gust, blinking arrows during the warning)
      ctx.fillStyle = S.wind ? '#e0f8ff' : '#ffffff'; ctx.globalAlpha = S.wind ? .35 : .5 * (Math.sin(V.G.clock * 20) > 0 ? 1 : 0);
      const c = V.G.clock * 90, l = Math.hypot(w.x, w.y) || 1, ux = w.x / l, uy = w.y / l;
      for (let i = 0; i < 18; i++) {
        const bx = (i * 53 % 256), by = 14 + (i * 37 % 132), s = S.wind ? c : 0, x = ((bx + ux * s) % 256 + 256) % 256, y = 12 + (((by + uy * s) - 12) % 136 + 136) % 136;
        for (let k = 0; k < 6; k++) ctx.fillRect(Math.round(x - ux * k), Math.round(y - uy * k), 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    if (P.lastStand > 0 && P.hp > 0) { ctx.globalAlpha = .35; h.ring(P.x, P.y, 8, 6, '#ffd23a', V.G.clock * 1.5); ctx.globalAlpha = 1; }   // Last Stand is ready
  };
})();
