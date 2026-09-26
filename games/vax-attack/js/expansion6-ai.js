// Expansion 6 (art + behaviour): eight viruses that think (cover, retreat, dodging, pack tactics, calling for help,
// regrouping) and five bosses that predict you (Prism, Oracle, Puppeteer, Chimera, Warden).
(() => {
  const V = window.VAX;
  const { SPR } = V;
  const { mk, whiteOf, virus, cluster } = V.kit;
  const TAU = Math.PI * 2;
  const two = fn => [0, 1].map(fn), spin = f => f * Math.PI / 8;

  // ---------- sprites ----------
  Object.assign(SPR, {
    hpv: two(f => virus(4, '#e0c0a0', '#5a3a20', '#fff0e0', '#ffffff', spin(f))),
    lcmv: two(f => virus(3, '#a0a0e0', '#2a2a5a', '#e0e0ff', '#ffffff', spin(f))),
    hev: two(f => virus(4, '#e0a060', '#5a3010', '#ffe0c0', '#ffffff', spin(f))),
    sapo: two(f => virus(3, '#80e0e0', '#105a5a', '#e0ffff', '#ffffff', spin(f))),
    junin: two(f => virus(4, '#e06080', '#5a1020', '#ffc0d0', '#ffffff', spin(f))),
    kfd: two(f => virus(4, '#c0e060', '#3a5a10', '#f0ffc0', '#ff4040', spin(f))),
    astro: two(f => mk(11, 11, p => { for (let y = 0; y < 11; y++) for (let x = 0; x < 11; x++) { const dx = x - 5, dy = y - 5, a = Math.atan2(dy, dx) + f * .4, r = Math.hypot(dx, dy), edge = 3 + 2 * Math.abs(Math.cos(a * 2.5)); if (r <= edge) p(x, y, r > edge - 1 ? '#6a2a6a' : r < 1.5 ? '#ffffff' : '#ffe0ff'); } })),
    bunya: two(f => cluster([[3.5, 3.5, 2.8], [8.5, 3.5, 2.8], [6, 8, 2.8]], 12, 12, 3, '#60c0a0', '#104a30', '#c0ffe0')),
    bunyaseg: two(f => virus(2, '#60c0a0', '#104a30', '#c0ffe0', '#ffffff', spin(f))),
    prism: two(f => mk(19, 19, p => { for (let y = 0; y < 19; y++) for (let x = 0; x < 19; x++) { const m = Math.abs(x - 9) + Math.abs(y - 9); if (m <= 8) p(x, y, m > 7 ? '#3a6a8a' : (x + y + f * 2) % 6 < 2 ? '#ffffff' : m < 3 ? '#e0ffff' : '#a0e0ff'); } })),
    oracle: two(f => mk(17, 17, p => { for (let y = 0; y < 17; y++) for (let x = 0; x < 17; x++) { const d = Math.hypot(x - 8, y - 8), pd = Math.hypot(x - 8 - (f ? 1 : -1), y - 8); if (d <= 8) p(x, y, d > 7 ? '#6a5010' : pd < 2 ? '#000000' : pd < 4 ? '#c04020' : d < 6.5 ? '#fff8e0' : '#ffe080'); } })),
    puppeteer: two(f => virus(6, '#d0a0ff', '#3a1a5a', '#f0e0ff', '#ffffff', spin(f))),
    chimera: two(f => cluster([[10, 10, 7], [4, 5, 3.5], [16, 5, 3.5], [10, 17, 3]], 21, 21, 3, '#ff9060', '#5a2010', '#ffd0a0')),
    warden: two(f => mk(21, 21, p => { for (let y = 0; y < 21; y++) for (let x = 0; x < 21; x++) { const edge = x < 2 || y < 2 || x > 18 || y > 18, bar = (x + f) % 4 === 0; const d = Math.hypot(x - 10, y - 10); if (edge) p(x, y, '#3a4a5a'); else if (d < 3.5) p(x, y, d < 1.5 ? '#ffffff' : '#ff6060'); else if (bar) p(x, y, '#80a0c0'); else p(x, y, '#1a2a3a'); } })),
  });
  const KEYS = ['hpv', 'lcmv', 'hev', 'sapo', 'junin', 'kfd', 'astro', 'bunya', 'bunyaseg'];
  const BOSSK = ['prism', 'oracle', 'puppeteer', 'chimera', 'warden'];
  for (const k of [...KEYS, ...BOSSK]) if (SPR[k]) SPR[k + 'W'] = SPR[k].map(whiteOf);
  const tint = src => mk(src.width, src.height, (p, g) => { g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = .5; g.fillStyle = '#ff2040'; g.fillRect(0, 0, src.width, src.height); });
  for (const k of KEYS) if (SPR[k]) SPR[k + 'M'] = SPR[k].map(tint);
  Object.assign(V.PCOL, {
    hpv: ['#e0c0a0', '#fff0e0'], lcmv: ['#a0a0e0', '#e0e0ff'], hev: ['#e0a060', '#ffe0c0'], sapo: ['#80e0e0', '#e0ffff'], junin: ['#e06080', '#ffc0d0'],
    kfd: ['#c0e060', '#f0ffc0'], astro: ['#ffe0ff', '#ff80ff'], bunya: ['#60c0a0', '#c0ffe0'], bunyaseg: ['#60c0a0', '#c0ffe0'],
    prism: ['#a0e0ff', '#ffffff', '#3a6a8a', '#e0ffff'], oracle: ['#ffe080', '#fff8e0', '#c04020', '#fff'], puppeteer: ['#d0a0ff', '#f0e0ff', '#3a1a5a', '#fff'],
    chimera: ['#ff9060', '#ffd0a0', '#5a2010', '#ffe060'], warden: ['#80a0c0', '#ff6060', '#1a2a3a', '#fff'],
  });

  // ---------- helpers ----------
  const wobble = (e, X, amp, freq) => { const w = Math.sin(e.t * freq) * amp; X.tx += -X.uy * w; X.ty += X.ux * w; };
  const segDist = (px, py, ax, ay, bx, by) => { const vx = bx - ax, vy = by - ay, l = vx * vx + vy * vy || 1, k = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / l)); return Math.hypot(px - ax - vx * k, py - ay - vy * k); };
  const seek = (e, X, gx, gy, k = 3, cap = 1.4) => { X.tx = X.clamp((gx - e.x) * k, -e.spd * cap, e.spd * cap); X.ty = X.clamp((gy - e.y) * k, -e.spd * cap, e.spd * cap); };
  const inArena = (X, x, y, m = 10) => [X.clamp(x, m, X.W - m), X.clamp(y, X.TOP + m, X.BOT - m)];
  // the antibody most likely to hit e soon: returns the sidestep direction, or null
  function threat(e, S, range, pad) {
    for (const b of S.bullets) {
      const sp = Math.hypot(b.vx, b.vy) || 1, vx = b.vx / sp, vy = b.vy / sp, rx = e.x - b.x, ry = e.y - b.y, along = rx * vx + ry * vy;
      if (along <= 0 || along > range) continue;
      const cross = vx * ry - vy * rx;
      if (Math.abs(cross) < e.r + pad) { const s = cross >= 0 ? 1 : -1; return [-vy * s, vx * s]; }
    }
    return null;
  }
  const clock = () => V.G.clock;
  // a marked spot that erupts a moment later (Oracle, Chimera)
  const omen = (S, x, y, t = .8) => (S.omens ??= []).push({ x, y, t, t0: t });

  // ---------- behaviour ----------
  Object.assign(V.AI, {
    hpv(e, X) {   // wart shell soaks up shots and regrows if you stop hitting it
      wobble(e, X, 6, 2);
      if (e.hp < (e.lastHp ?? e.hp) || e.shell < (e.lastSh ?? e.shell)) e.quiet = 0; else e.quiet += X.dt;
      if (e.shell <= 0 && e.quiet > 3) { e.shell = e.shellMax; X.burst(e.x, e.y, 10, X.V.PCOL.hpv, 40); X.V.SND.shell(); }
      e.lastHp = e.hp; e.lastSh = e.shell;
    },
    lcmv(e, X) {   // takes cover behind another pathogen, leans out to shoot
      const S = X.S, P = X.P;
      let cover = null, best = 1e9;
      for (const o of S.enemies) { if (o === e || o.boss || o.hp <= 0 || o.type === 'lcmv' || o.x < 12 || o.x > X.W - 12) continue; const dd = Math.hypot(o.x - e.x, o.y - e.y); if (dd < best && dd < 110) { best = dd; cover = o; } }
      if (e.state === 'peek') {
        e.pt -= X.dt; seek(e, X, e.px, e.py, 4, 1.6);
        if (!e.shot && e.pt < .4 && X.inside) { e.shot = true; const a = X.aimAt(e.x, e.y, 66); for (let i = -1; i <= 1; i++) X.toxin(e.x, e.y, a + i * .1, 66); X.V.SND.spit(); }
        if (e.pt <= 0) { e.state = 'hide'; e.peek = X.rnd(1.6, 2.6) * X.D.fire; }
        return;
      }
      if (cover) {
        const cx = cover.x - P.x, cy = cover.y - P.y, cd = Math.hypot(cx, cy) || 1;
        const [hx, hy] = inArena(X, cover.x + cx / cd * (cover.r + 6), cover.y + cy / cd * (cover.r + 6));
        seek(e, X, hx, hy, 4, 1.5);
      } else if (X.d < 70) { X.tx = -X.ux * e.spd; X.ty = -X.uy * e.spd; }
      e.peek -= X.dt;
      if (e.peek <= 0 && X.inside) {   // lean out sideways, fire, duck back
        const s = Math.random() < .5 ? -1 : 1;
        [e.px, e.py] = inArena(X, e.x - X.uy * 16 * s, e.y + X.ux * 16 * s);
        e.state = 'peek'; e.pt = .7; e.shot = false;
      }
    },
    hev(e, X) {   // fights until hurt, then runs off to heal
      if (e.state === 'flee') {
        const [gx, gy] = inArena(X, X.P.x < X.W / 2 ? X.W - 12 : 12, X.P.y < (X.TOP + X.BOT) / 2 ? X.BOT - 12 : X.TOP + 12);
        seek(e, X, gx, gy, 2, 1.7);
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * .1 * X.dt);
        if (e.hp >= e.maxHp * .9) { e.state = 'fight'; e.healed = (e.healed || 0) + 1; }
        return;
      }
      if (e.hp < e.maxHp * .45 && (e.healed || 0) < 2) { e.state = 'flee'; X.V.SND.blink(); return; }
      if (X.d < 60) { X.tx = -X.uy * e.spd; X.ty = X.ux * e.spd; }
      e.fire -= X.dt;
      if (e.fire <= 0 && X.inside && X.d < 120) { e.fire = X.rnd(1.8, 2.6) * X.D.fire; X.toxin(e.x, e.y, X.aimA, 58); X.V.SND.spit(); }
    },
    sapo(e, X) {   // reads your antibodies and steps out of their line
      e.tired = (e.tired || 0) - X.dt;
      const dir = e.tired <= 0 ? threat(e, X.S, 70, 5) : null;
      if (dir) {
        if (!e.dodging) { e.dodging = true; e.stam -= .34; }   // every sidestep costs breath (about three in a row)
        X.tx = dir[0] * 110; X.ty = dir[1] * 110; X.snap = true;
        if (e.stam <= 0) { e.tired = 1.8; e.stam = 0; }   // out of breath: easy to hit for a moment
        return;
      }
      e.dodging = false;
      if (e.tired <= 0) e.stam = Math.min(.8 + X.sm * .5, e.stam + X.dt * .25);
      if (X.d < 65) { X.tx = -X.ux * e.spd * .6 - X.uy * e.spd; X.ty = -X.uy * e.spd * .6 + X.ux * e.spd; }
      e.fire -= X.dt;
      if (e.fire <= 0 && X.inside && X.d < 130) { e.fire = X.rnd(1.8, 2.6) * X.D.fire; X.toxin(e.x, e.y, X.aimA, 62); X.V.SND.spit(); }
    },
    junin(e, X) {   // pack hunter: surround you, then everybody fires at once
      const S = X.S, P = X.P, pack = S.enemies.filter(o => o.type === 'junin' && o.hp > 0), i = pack.indexOf(e), n = pack.length;
      if (i === 0) {
        S.junBase = (S.junBase ?? Math.PI) + X.dt * .35;
        S.junT = (S.junT ?? 2.5) - X.dt;
        if (S.junT <= 0) { S.junT = X.rnd(2.4, 3) * X.D.fire; S.junVolley = (S.junVolley || 0) + 1; }
      }
      const a = S.junBase + i * TAU / Math.max(1, n), [gx, gy] = inArena(X, P.x + Math.cos(a) * 58, P.y + Math.sin(a) * 48);
      seek(e, X, gx, gy, 2.5, 1.3);
      if (S.junT < .35) e.flash = .05;   // everyone flashes just before the volley
      if (e.volley !== S.junVolley) { e.volley = S.junVolley; if (X.inside && S.junVolley) { X.toxin(e.x, e.y, X.aimAt(e.x, e.y, 58), 58); X.V.SND.spit(); } }
    },
    kfd(e, X) {   // howls: every pathogen around rushes you for a few seconds
      wobble(e, X, 8, 2.5);
      e.howl -= X.dt;
      if (e.howl <= 0 && X.inside && X.d < 95) {
        e.howl = X.rnd(5.5, 7) * X.D.fire; e.flash = .15;
        for (const o of X.S.enemies) if (!o.boss && o.hp > 0 && Math.hypot(o.x - e.x, o.y - e.y) < 100) o.rally = 3;
        (X.S.howls ??= []).push({ x: e.x, y: e.y, t: 0 });
        X.V.SND.charge();
      }
    },
    astro(e, X) {   // spinning two-armed spirals, with pauses between
      seek(e, X, X.W - 55, X.clamp(X.P.y, X.TOP + 14, X.BOT - 14), 1.2, 1);
      if (e.on > 0) {
        e.on -= X.dt; e.shot = (e.shot || 0) - X.dt;
        if (e.shot <= 0) { e.shot = .12; for (let k = 0; k < 2; k++) X.toxin(e.x, e.y, e.spin + k * Math.PI, 40); e.spin += .33; }
        return;
      }
      e.burst -= X.dt;
      if (e.burst <= 0 && X.inside) { e.on = 1.6; e.burst = X.rnd(2.4, 3) * X.D.fire; X.V.SND.bossShot(); }
    },
    bunya(e, X) {
      wobble(e, X, 10, 2);
      e.fire = (e.fire ?? X.rnd(1.5, 2.5)) - X.dt;
      if (e.fire <= 0 && X.inside && X.d < 120) { e.fire = X.rnd(2.2, 3) * X.D.fire; for (let i = -1; i <= 1; i++) X.toxin(e.x, e.y, X.aimA + i * .25, 52); }
    },
    bunyaseg(e, X) {   // segments crawl back together; if all three meet, the virus reforms
      const mates = X.S.enemies.filter(o => o.type === 'bunyaseg' && o.g === e.g && o.hp > 0);
      if (mates.length < 3) { wobble(e, X, 12, 5); return; }
      const cx = mates.reduce((s, o) => s + o.x, 0) / 3, cy = mates.reduce((s, o) => s + o.y, 0) / 3;
      seek(e, X, cx, cy, 3, 1.2);
      e.merge -= X.dt;
      if (mates[0] === e && e.merge <= 0 && mates.every(o => Math.hypot(o.x - cx, o.y - cy) < 7)) {
        for (const o of mates) X.kill(o, true);
        const b = X.spawn('bunya', cx, cy); b.hp = b.maxHp * .6;
        X.burst(cx, cy, 16, X.V.PCOL.bunya, 50); X.V.SND.spores();
        return 'gone';
      }
    },

    // ---------- bosses ----------
    prism(e, X) {   // spinning facets turn your shots into toxins; gaps between them let shots through
      const rage = e.hp < e.maxHp / 2;
      seek(e, X, X.W - 48 + Math.sin(e.t * .5) * 10, (X.TOP + X.BOT) / 2 + Math.sin(e.t * .7) * 36, 1, 1);
      e.spin += X.dt * (rage ? 1.5 : 1); e.hw = rage ? .72 : .58;
      e.fire -= X.dt;
      if (e.fire <= 0 && X.inside) {
        e.fire = (rage ? 1.5 : 2.1) * X.D.fire;
        for (let i = 0; i < 10; i++) X.toxin(e.x, e.y, e.spin + i * TAU / 10, 40);
        for (let i = -1; i <= 1; i++) X.toxin(e.x, e.y, X.aimA + i * .14, 62);
        X.V.SND.bossShot();
      }
    },
    oracle(e, X) {   // predicts: marks where you'll be, alternates how far it leads you, blinks out of your line of fire
      const S = X.S, P = X.P, rage = e.hp < e.maxHp / 2;
      const gx = X.clamp(P.x + 110, X.W * .45, X.W - 20), gy = X.clamp((X.TOP + X.BOT) - P.y, X.TOP + 14, X.BOT - 14);
      seek(e, X, gx, gy, 1.5, 1.3);
      e.blink -= X.dt;
      if (e.blink <= 0 && threat(e, S, 26, 4)) {
        const dir = threat(e, S, 26, 4); X.burst(e.x, e.y, 10, X.V.PCOL.oracle, 40);
        [e.x, e.y] = inArena(X, e.x + dir[0] * 34, e.y + dir[1] * 34, 14);
        e.blink = rage ? 1.5 : 2.4; X.V.SND.blink(); X.burst(e.x, e.y, 10, X.V.PCOL.oracle, 40);
      }
      e.fire -= X.dt;
      if (e.fire <= 0 && X.inside) {
        e.fire = (rage ? 1 : 1.35) * X.D.fire; e.volley++;
        const k = [0, 1.9, 1][e.volley % 3], a = X.aimAt(e.x, e.y, 66, k);   // no single dodge works every time
        for (let i = -1; i <= 1; i++) X.toxin(e.x, e.y, a + i * .12, 66);
        X.V.SND.bossShot();
      }
      e.omen -= X.dt;
      if (e.omen <= 0 && X.inside) {
        e.omen = (rage ? 2 : 2.8) * X.D.fire;
        const [ox, oy] = inArena(X, P.x + P.svx * .9, P.y + P.svy * .9, 8);
        omen(S, ox, oy);
        if (rage) omen(S, P.x, P.y, 1.1);
      }
    },
    puppeteer(e, X) {   // pulls strings: takes over other pathogens and moves them in formation
      const S = X.S, P = X.P, rage = e.hp < e.maxHp / 2;
      seek(e, X, X.W - 36, X.clamp(P.y, X.TOP + 20, X.BOT - 20), .8, 1);
      const puppets = S.enemies.filter(o => o.puppet === e && o.hp > 0);
      e.dmgMul = puppets.length ? .7 : 1;   // hard to hurt while it has puppets
      e.recruit -= X.dt;
      if (e.recruit <= 0 && puppets.length < 3) {
        e.recruit = (rage ? 6 : 7) * X.D.fire;
        let o = S.enemies.find(o => !o.boss && o.hp > 0 && !o.puppet && !X.V.MINIONS.has(o.type));
        if (!o) { const pool = ['virus', 'bug', 'hiv', 'zika', 'hendra', 'junin', 'salmo']; o = X.spawn(pool[Math.floor(Math.random() * pool.length)]); }
        o.puppet = e; o.hp = o.maxHp = Math.min(o.maxHp, X.V.game.playerDPS() * 1.2); X.burst(o.x, o.y, 10, X.V.PCOL.puppeteer, 40); X.V.SND.blink();
      }
      e.formT -= X.dt;
      if (e.formT <= 0) { e.formT = 7; e.form = (e.form + 1) % 3; }
      puppets.forEach((o, i) => {
        const n = puppets.length; let sx, sy;
        if (e.form === 0) { const a = e.t * 1.2 + i * TAU / n; sx = e.x + Math.cos(a) * 28; sy = e.y + Math.sin(a) * 28; }                   // ring around it
        else if (e.form === 1) { sx = e.x - 42; sy = e.y + (i - (n - 1) / 2) * 16; }                                                        // shield wall
        else { const a = e.t * .6 + i * TAU / n; sx = P.x + Math.cos(a) * 60; sy = P.y + Math.sin(a) * 50; }                               // pincer around you
        [sx, sy] = inArena(X, sx, sy);
        const k = Math.min(1, X.dt * 2.5); o.x += (sx - o.x) * k; o.y += (sy - o.y) * k;
      });
      e.fire -= X.dt;
      if (e.fire <= 0 && X.inside) {
        e.fire = (rage ? 1.6 : 2.2) * X.D.fire;
        for (const o of puppets) X.toxin(o.x, o.y, X.aimAt(o.x, o.y, 60), 60);
        for (let i = 0; i < 8; i++) X.toxin(e.x, e.y, e.t + i * TAU / 8, 42);
        X.V.SND.bossShot();
      }
    },
    chimera(e, X) {   // three forms: charger, breeder, stormcaller
      const S = X.S, P = X.P, phase = e.hp > e.maxHp * .66 ? 0 : e.hp > e.maxHp * .33 ? 1 : 2;
      if (phase !== e.phase) { e.phase = phase; e.state = 'move'; e.cd = 1.5; X.burst(e.x, e.y, 40, X.V.PCOL.chimera, 90); X.shake(.4); X.V.SND.boss?.(); }
      if (phase === 0) {
        if (e.state === 'tele') { X.tx = X.ty = 0; e.st -= X.dt; e.flash = .05; if (e.st <= 0) { const a = X.aimAt(e.x, e.y, 150); e.state = 'dash'; e.st = .75; e.dx = Math.cos(a); e.dy = Math.sin(a); } return; }
        if (e.state === 'dash') {
          X.tx = e.dx * 150; X.ty = e.dy * 150; X.snap = true; e.st -= X.dt;
          if (e.st <= 0 || e.x < 14 || e.x > X.W - 14 || e.y < X.TOP + 10 || e.y > X.BOT - 10) { e.state = 'move'; e.cd = 2.6 * X.D.fire; for (let i = 0; i < 12; i++) X.toxin(e.x, e.y, i * TAU / 12, 44); X.V.SND.boom(); }
          return;
        }
        seek(e, X, X.W - 45, X.clamp(P.y, X.TOP + 20, X.BOT - 20), 1.2, 1.2);
        e.cd -= X.dt; if (e.cd <= 0 && X.inside) { e.state = 'tele'; e.st = .7; X.V.SND.charge(); }
      } else if (phase === 1) {
        seek(e, X, X.W - 50, (X.TOP + X.BOT) / 2 + Math.sin(e.t * .8) * 40, 1, 1);
        e.fire -= X.dt;
        if (e.fire <= 0 && X.inside) { e.fire = 1.3 * X.D.fire; for (let i = -2; i <= 2; i++) X.toxin(e.x, e.y, X.aimA + i * .17, 60); X.V.SND.bossShot(); }
        e.brood = (e.brood ?? 2) - X.dt;
        if (e.brood <= 0 && S.enemies.length < 12) { e.brood = 4 * X.D.fire; for (let i = 0; i < 3; i++) X.spawn('parvo', e.x - 8, e.y + (i - 1) * 8); X.V.SND.spores(); }
      } else {
        seek(e, X, X.W - 60 + Math.sin(e.t) * 20, (X.TOP + X.BOT) / 2 + Math.cos(e.t * .9) * 45, 1.5, 1.5);
        e.omen -= X.dt;
        if (e.omen <= 0) { e.omen = 1.6 * X.D.fire; const [ox, oy] = inArena(X, P.x + P.svx * .8, P.y + P.svy * .8, 8); omen(S, ox, oy, .75); omen(S, P.x, P.y, 1.2); }
        e.fire -= X.dt; e.spin = (e.spin || 0);
        if (e.fire <= 0 && X.inside) { e.fire = .14; e.spin += .4; for (let k = 0; k < 3; k++) X.toxin(e.x, e.y, e.spin + k * TAU / 3, 38); if (Math.random() < .08) e.fire = 1.2 * X.D.fire; }
      }
    },
    warden(e, X) {   // cages you in shrinking toxin rings, sweeps a beam across the vessel
      const S = X.S, P = X.P, rage = e.hp < e.maxHp / 2;
      seek(e, X, X.W - 30, X.clamp(P.y, X.TOP + 22, X.BOT - 22), .7, 1);
      e.cage -= X.dt;
      if (e.cage <= 0 && X.inside) {
        e.cage = (rage ? 6 : 7.5) * X.D.fire;
        const n = 30, gap = Math.atan2(P.y - e.y, P.x - e.x) + X.rnd(-1.3, 1.3), r = 46, sp = 15;
        for (let i = 0; i < n; i++) {
          const a = i * TAU / n; if (Math.abs(((a - gap + Math.PI * 3) % TAU) - Math.PI) < .5) continue;   // one way out
          S.toxins.push({ x: P.x + Math.cos(a) * r, y: P.y + Math.sin(a) * r, vx: -Math.cos(a) * sp, vy: -Math.sin(a) * sp, life: 3.1, src: 'warden' });
        }
        X.V.SND.shell();
      }
      e.beam -= X.dt;
      if (e.beam <= 0 && X.inside) {
        e.beam = (rage ? 4.8 : 6.2) * X.D.fire;
        const s = Math.random() < .5 ? -1 : 1;
        (S.beams ??= []).push({ owner: e, a: X.aimA - .7 * s, va: 1.1 * s, warn: .75, t: 1.3 });
        X.V.SND.charge();
      }
      e.fire -= X.dt;
      if (e.fire <= 0 && X.inside) { e.fire = (rage ? 1.5 : 2) * X.D.fire; for (let i = -1; i <= 1; i++) X.toxin(e.x, e.y, X.aimA + i * .2, 58); }
    },
  });

  V.ON_SPAWN.hpv = e => { e.shell = e.shellMax = Math.max(3, e.maxHp * .8); };
  V.PRE_HIT.prism = (e, b, X) => {   // hit a facet: the shot splits into three toxins aimed back at you
    if (b.pierce || b.crit) return false;
    const a = Math.atan2(b.y - e.y, b.x - e.x);
    for (let k = 0; k < 3; k++) {
      const c = e.spin + k * TAU / 3, off = Math.abs(((a - c + Math.PI * 3) % TAU) - Math.PI);
      if (off < (e.hw || .58)) {
        e.flash = .03; X.burst(b.x, b.y, 3, ['#ffffff', '#a0e0ff']);
        if (clock() > e.refr && X.toxin) { e.refr = clock() + .12; const aim = X.aimAt(b.x, b.y, 62); for (let i = -1; i <= 1; i++) X.toxin(b.x, b.y, aim + i * .22, 62); }
        return true;
      }
    }
    return false;
  };
  Object.assign(V.ON_KILL, {
    bunya: (e, X) => { const g = Math.random(); for (let i = 0; i < 3; i++) { const s = X.spawn('bunyaseg', e.x, e.y); s.g = g; const a = i * TAU / 3; s.kx = Math.cos(a) * 90; s.ky = Math.sin(a) * 90; } },
    puppeteer: (e, X) => { for (const o of X.S.enemies) if (o.puppet === e) o.puppet = null; },
    oracle: (e, X) => { X.S.omens = []; },
    chimera: (e, X) => { X.S.omens = []; },
    warden: (e, X) => { X.S.beams = []; },
  });

  // ---------- world effects: marked spots, beams, rallies ----------
  const powfx = V.POWFX;
  V.POWFX = (S, P, dt, X) => {
    powfx?.(S, P, dt, X);
    if (S.omens?.length) {
      for (const o of S.omens) {
        o.t -= dt;
        if (o.t <= 0) {
          for (let i = 0; i < 10; i++) S.toxins.push({ x: o.x, y: o.y, vx: Math.cos(i * TAU / 10) * 46 * S.D.toxinSpd, vy: Math.sin(i * TAU / 10) * 46 * S.D.toxinSpd, life: 2.5, src: 'oracle' });
          if (Math.hypot(P.x - o.x, P.y - o.y) < 9) V.game.hurtAt(o.x, o.y, 'oracle');
          X.burst(o.x, o.y, 14, ['#ffe080', '#ff6040', '#fff'], 70); V.SND.boom();
        }
      }
      S.omens = S.omens.filter(o => o.t > 0);
    }
    if (S.beams?.length) {
      for (const b of S.beams) {
        if (b.owner.hp <= 0) { b.t = 0; continue; }
        if (b.warn > 0) { b.warn -= dt; continue; }
        b.t -= dt; b.a += b.va * dt;
        const x = b.owner.x, y = b.owner.y;
        if (segDist(P.x, P.y, x, y, x + Math.cos(b.a) * 320, y + Math.sin(b.a) * 320) < 3) V.game.hurtAt(x, y, b.owner.type);
      }
      S.beams = S.beams.filter(b => b.t > 0);
    }
    for (const o of S.enemies) if (o.rally > 0) {   // Kyasanur's howl: rush the player
      o.rally -= dt;
      const d = Math.hypot(P.x - o.x, P.y - o.y) || 1;
      if (d > 14) { o.x += (P.x - o.x) / d * 26 * dt; o.y += (P.y - o.y) / d * 26 * dt; }
    }
    if (S.howls) { for (const h of S.howls) h.t += dt; S.howls = S.howls.filter(h => h.t < .5); }
  };

  // ---------- extra drawing ----------
  Object.assign(V.DRAW, {
    hpv(ctx, e, { ring }) { if (e.shell > 0) { ctx.globalAlpha = .4 + .6 * e.shell / e.shellMax; ring(e.x, e.y, e.r + 2, 12, '#c0a080', e.t); ctx.globalAlpha = 1; } },
    hev(ctx, e, { R }) { if (e.state === 'flee') { ctx.fillStyle = '#60ff90'; ctx.fillRect(R(e.x) - 1, R(e.y - e.r - 5), 3, 1); ctx.fillRect(R(e.x), R(e.y - e.r - 6), 1, 3); } },
    sapo(ctx, e, { ring }) { if (e.tired > 0) { ctx.globalAlpha = .5; ring(e.x, e.y, e.r + 2, 6, '#80e0e0', e.t * 4); ctx.globalAlpha = 1; } },
    prism(ctx, e) {
      ctx.lineWidth = 2; ctx.strokeStyle = '#e0ffff';
      for (let k = 0; k < 3; k++) { const c = e.spin + k * TAU / 3; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 5, c - (e.hw || .58), c + (e.hw || .58)); ctx.stroke(); }
      ctx.lineWidth = 1;
    },
    puppeteer(ctx, e) {
      ctx.strokeStyle = '#d0a0ff'; ctx.globalAlpha = .45; ctx.lineWidth = 1;
      for (const o of V.G.S.enemies) if (o.puppet === e && o.hp > 0) { ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(o.x, o.y); ctx.stroke(); }
      ctx.globalAlpha = 1;
    },
    chimera(ctx, e, { ring }) { ring(e.x, e.y, e.r + 3, 16, ['#ff9060', '#80e080', '#ffe060'][e.phase || 0], e.t * 2); },
  });
  const drawExtras = V.drawExtras;
  V.drawExtras = (ctx, S, P, h) => {
    drawExtras?.(ctx, S, P, h);
    for (const o of S.omens || []) {   // marked spot: shrinking ring, faster flicker as it's about to erupt
      const k = 1 - o.t / o.t0;
      ctx.globalAlpha = .5 + .5 * Math.abs(Math.sin(k * k * 30));
      h.ring(o.x, o.y, 10 - k * 4, 14, '#ff6040', k * 3); h.ring(o.x, o.y, 3, 6, '#ffe080', -k * 5);
      ctx.globalAlpha = 1;
    }
    for (const b of S.beams || []) {
      const x = b.owner.x, y = b.owner.y, ex = x + Math.cos(b.a) * 320, ey = y + Math.sin(b.a) * 320;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey);
      if (b.warn > 0) { ctx.strokeStyle = '#ff6060'; ctx.globalAlpha = .35 + .3 * Math.sin(b.warn * 40); ctx.lineWidth = 1; }
      else { ctx.strokeStyle = '#ffd0d0'; ctx.globalAlpha = .9; ctx.lineWidth = 3; }
      ctx.stroke(); ctx.globalAlpha = 1; ctx.lineWidth = 1;
    }
    for (const w of S.howls || []) { ctx.globalAlpha = 1 - w.t / .5; h.ring(w.x, w.y, 10 + w.t * 180, 28, '#c0e060', 0); ctx.globalAlpha = 1; }
    ctx.fillStyle = '#ff6060';
    for (const o of S.enemies) if (o.rally > 0 && o.hp > 0) { ctx.fillRect(h.R(o.x), h.R(o.y - o.r - 6), 1, 3); ctx.fillRect(h.R(o.x), h.R(o.y - o.r - 2), 1, 1); }
  };
})();
