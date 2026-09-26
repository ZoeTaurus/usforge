// The Outbreak expansion, part 2: sprites and behaviour for the 20 new viruses and 10 new bosses.
// game.js calls V.AI[type](e, X) every frame for these, where X holds helpers plus this frame's view of the player
// (dx/dy/d, a lead-aimed angle aimA, inside) and the desired velocity tx/ty that the handler may overwrite.
(() => {
  const V = window.VAX;
  const { SPR } = V;
  const { mk, art, whiteOf, virus, bacterium, cluster } = V.kit;
  const R = Math.round;

  // ---------- sprites ----------
  const two = fn => [0, 1].map(fn);
  const spin = f => f * Math.PI / 8;
  const wheel = (r0, rim, dark, hub) => two(f => { const S = 2 * r0 + 3, c = r0 + 1; return mk(S, S, p => {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const d = Math.hypot(x - c, y - c);
      if (d <= r0 + .4 && d > r0 - 1.6) p(x, y, d > r0 - .6 ? dark : rim);
      else if (d <= r0 * .32) p(x, y, hub);
    }
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + f * Math.PI / 6; for (let t = r0 * .32; t < r0 - 1; t += .5) p(R(c + Math.cos(a) * t), R(c + Math.sin(a) * t), rim); }
  }); });
  // poxviruses really are brick-shaped
  const brick = (w, h, col, dark, light, spot) => two(f => mk(w, h, p => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if ((x === 0 || x === w - 1) && (y === 0 || y === h - 1)) continue;
      const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      p(x, y, edge ? dark : y === 1 ? light : col);
    }
    for (let i = 0, n = Math.floor(w * h / 16); i < n; i++) p(1 + (i * 7 + f * 2) % (w - 2), 2 + (i * 5) % (h - 3), spot);
  }));
  const PHAGE = f => ['..hhh..', '.hHHHh.', '.hHLHh.', '.hHHHh.', '..hhh..', '...s...', '...s...', '...s...', '.lllll.', f ? '.l.l.l.' : 'l..l..l'];
  const PHAGE_PAL = { h: '#5a5a6a', H: '#c0c0d0', L: '#ffffff', s: '#9090a0', l: '#808090' };
  const scaled = (src, k) => mk(src.width * k, src.height * k, (p, g) => { g.imageSmoothingEnabled = false; g.drawImage(src, 0, 0, src.width * k, src.height * k); });
  // a Marburg filament curls into a shepherd's crook
  const crook = two(f => mk(11, 9, p => {
    const pts = [[1, 7], [2, 7], [3, 7], [4, 7], [5, 6], [6, 5], [7, 4], [8, 3], [8, 2], [7, 1], [6, 1], [5, 2]];
    pts.forEach(([x, y], i) => { const yy = y + (f && i < 5 ? (i % 2 ? -1 : 0) : 0); p(x, yy, '#d06040'); p(x, yy + 1, '#5a1a0a'); if (i % 3 === 0) p(x, yy - 1, '#ffa080'); });
  }));

  Object.assign(SPR, {
    zika: two(f => virus(3, '#f0a0c0', '#6a2040', '#ffd0e0', '#ffffff', spin(f))),
    dengue: two(f => virus(4, '#ff6060', '#6a1010', '#ffb0b0', '#ffe060', spin(f))),
    dengue2: two(f => virus(5, '#c01830', '#400008', '#ff7080', '#ffe060', spin(f))),
    rota: wheel(5, '#e0c060', '#6a5010', '#fff0a0'),
    polio: two(f => virus(3, '#70a0ff', '#1a2a70', '#c0d8ff', '#e0f0ff', spin(f))),
    herpes: two(f => virus(4, '#e070a0', '#5a1030', '#ffc0dc', '#ffffff', spin(f))),
    hepb: two(f => virus(5, '#d0b040', '#5a4a00', '#fff0a0', '#ffffff', spin(f))),
    hbsag: two(f => art(f ? ['h.h', '.H.', 'h.h'] : ['.h.', 'hHh', '.h.'], { h: '#8a7a30', H: '#d0b040' })),
    h5n1: two(f => virus(3, '#a0c8ff', '#203a6a', '#e0f0ff', '#ffffff', spin(f))),
    marburg: crook,
    variola: brick(11, 8, '#e8d0a0', '#6a4a20', '#fff4d8', '#c06040'),
    mumps0: two(f => virus(4, '#ffa070', '#6a2a10', '#ffd8c0', '#ffffff', spin(f))),
    mumps1: two(f => virus(6, '#ff9060', '#6a2a10', '#ffd0b0', '#ffffff', spin(f))),
    mumps2: two(f => virus(8, '#ff7040', '#6a1a00', '#ffc0a0', '#ffe060', spin(f))),
    rsv0: two(f => cluster([[4, 4, f ? 2.8 : 3.1]], 8, 8, 3, '#80e0c0', '#1a5a4a', '#d0fff0')),
    rsv1: two(f => cluster([[4.5, 5, 3.2], [9.5, 4.5, f ? 3 : 3.3]], 14, 10, 3, '#70d0b0', '#1a5a4a', '#d0fff0')),
    rsv2: two(f => cluster([[5, 6, 3.6], [11, 5, 3.3], [8, 11, f ? 3 : 3.4]], 16, 15, 3, '#60c0a0', '#104a3a', '#c0f8e8')),
    bphage: two(f => art(PHAGE(f), PHAGE_PAL)),   // ('phage' is the Phage Swarm power-up's icon)
    mers: two(f => virus(5, '#e0a080', '#5a2a10', '#ffd8c0', '#ff6040', spin(f))),
    mersSpike: two(f => art(f ? ['.s.', 'sSs', '.s.'] : ['s.s', '.S.', 's.s'], { s: '#c04020', S: '#ff9070' })),
    yellow: two(f => virus(4, '#f0e040', '#5a5000', '#fffaa0', '#ff8020', spin(f))),
    chikv: two(f => virus(3, '#ff80ff', '#601060', '#ffd0ff', '#ffffff', spin(f))),
    nipah: two(f => virus(4, '#9080c0', '#2a2050', '#d0c8f0', '#ff4060', spin(f))),
    lassa: two(f => virus(4, '#c09060', '#4a3010', '#f0d0a0', '#ffe0c0', spin(f))),
    hanta: two(f => virus(4, '#b0a090', '#3a3020', '#e0d8c8', '#ffffff', spin(f))),
    westnile: two(f => virus(3, '#80d0ff', '#10406a', '#d0f0ff', '#ffffff', spin(f))),
    mimi: two(f => virus(8, '#80e080', '#1a4a1a', '#d0ffd0', '#b0ff80', spin(f))),
    sputnik: two(f => art(f ? ['.s.', 'sSs', '.s.'] : ['s.s', '.S.', 's.s'], { s: '#60c040', S: '#d0ff80' })),
    paraShot: art(['.p.', 'pPp', '.p.'], { p: '#3050c0', P: '#a0c0ff' }),
    dust: two(f => cluster([[4, 4, 3], [7, 5, f ? 2.4 : 2.8]], 10, 9, 2.8, '#7a7060', '#4a4030', '#a8a090')),
    // bosses
    pandemic: two(f => virus(10, '#a0c8ff', '#1a2a5a', '#e0f0ff', '#ff6060', spin(f))),
    fevers: two(f => virus(6, '#ffe0e0', '#6a1010', '#ffffff', '#ff6060', spin(f))),
    feverPart0: two(f => virus(4, '#ff5050', '#5a0a0a', '#ffb0b0', '#ffffff', spin(f))),
    feverPart1: two(f => virus(4, '#ffa040', '#5a2a00', '#ffd8a0', '#ffffff', spin(f))),
    feverPart2: two(f => virus(4, '#d060ff', '#3a0a5a', '#f0c0ff', '#ffffff', spin(f))),
    feverPart3: two(f => virus(4, '#5080ff', '#0a1a5a', '#c0d0ff', '#ffffff', spin(f))),
    wheel: wheel(12, '#e0c060', '#6a5010', '#fff0a0'),
    latency: two(f => virus(8, '#e070a0', '#4a0a28', '#ffc0dc', '#ffffff', spin(f))),
    megavirus: two(f => virus(13, '#60c060', '#0a3a0a', '#c0ffc0', '#e0ff80', spin(f))),
    paralyzer: two(f => virus(9, '#5080ff', '#0a1a5a', '#c0d8ff', '#ffffff', spin(f))),
    smallpox: brick(24, 18, '#e8d0a0', '#6a4a20', '#fff4d8', '#c04030'),
    carrier: two(f => scaled(art(PHAGE(f), Object.assign({}, PHAGE_PAL, { H: '#e0e0f0', L: '#ff4a6a' })), 2)),
    empress: two(f => virus(10, '#f0b050', '#5a3000', '#ffe8b0', '#ff4040', spin(f))),
    zero: two(f => virus(11, '#e8e8f0', '#303040', '#ffffff', '#ff3040', spin(f))),
  });
  SPR.mumps = SPR.mumps0; SPR.rsv = SPR.rsv0;
  const NEW_KEYS = ['zika', 'dengue', 'dengue2', 'rota', 'polio', 'herpes', 'hepb', 'hbsag', 'h5n1', 'marburg', 'variola', 'mumps0', 'mumps1', 'mumps2',
    'rsv0', 'rsv1', 'rsv2', 'bphage', 'mers', 'mersSpike', 'yellow', 'chikv', 'nipah', 'lassa', 'hanta', 'westnile', 'mimi', 'sputnik'];
  const BOSS_KEYS = ['pandemic', 'fevers', 'feverPart0', 'feverPart1', 'feverPart2', 'feverPart3', 'wheel', 'latency', 'megavirus', 'paralyzer', 'smallpox', 'carrier', 'empress', 'zero'];
  for (const k of [...NEW_KEYS, ...BOSS_KEYS]) SPR[k + 'W'] = SPR[k].map(whiteOf);
  SPR.mumpsW = SPR.mumps0W; SPR.rsvW = SPR.rsv0W;
  const tint = src => mk(src.width, src.height, (p, g) => { g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = .5; g.fillStyle = '#ff2040'; g.fillRect(0, 0, src.width, src.height); });
  for (const k of NEW_KEYS) SPR[k + 'M'] = SPR[k].map(tint);
  SPR.mumpsM = SPR.mumps0M; SPR.rsvM = SPR.rsv0M;

  Object.assign(V.PCOL, {
    zika: ['#f0a0c0', '#ffd0e0'], dengue: ['#ff6060', '#ffb0b0', '#ffe060'], rota: ['#e0c060', '#fff0a0'], polio: ['#70a0ff', '#c0d8ff'],
    herpes: ['#e070a0', '#ffc0dc'], hepb: ['#d0b040', '#fff0a0'], hbsag: ['#d0b040', '#8a7a30'], h5n1: ['#a0c8ff', '#e0f0ff'], marburg: ['#d06040', '#ffa080'],
    variola: ['#e8d0a0', '#c06040', '#fff4d8'], mumps: ['#ffa070', '#ffd8c0'], rsv: ['#80e0c0', '#d0fff0'], bphage: ['#c0c0d0', '#ffffff'],
    mers: ['#e0a080', '#ff6040'], yellow: ['#f0e040', '#fffaa0'], chikv: ['#ff80ff', '#ffd0ff'], nipah: ['#9080c0', '#d0c8f0'], lassa: ['#c09060', '#f0d0a0'],
    hanta: ['#b0a090', '#e0d8c8'], westnile: ['#80d0ff', '#d0f0ff'], mimi: ['#80e080', '#d0ffd0', '#b0ff80'], sputnik: ['#b0ff80', '#60c040'],
    pandemic: ['#a0c8ff', '#e0f0ff', '#ff6060', '#fff'], fevers: ['#ff5050', '#ffa040', '#d060ff', '#5080ff', '#fff'], wheel: ['#e0c060', '#fff0a0', '#6a5010', '#fff'],
    latency: ['#e070a0', '#ffc0dc', '#4a0a28', '#fff'], megavirus: ['#60c060', '#c0ffc0', '#e0ff80', '#fff'], paralyzer: ['#5080ff', '#c0d8ff', '#fff'],
    smallpox: ['#e8d0a0', '#c04030', '#fff4d8', '#fff'], carrier: ['#c0c0d0', '#ff4a6a', '#fff'], empress: ['#f0b050', '#ffe8b0', '#ff4040', '#fff'], zero: ['#e8e8f0', '#ff3040', '#303040', '#fff'],
  });

  // which sprite a pathogen uses right now
  V.SKEY = {
    dengue: e => e.second ? 'dengue2' : 'dengue',
    mumps: e => 'mumps' + Math.min(2, Math.floor(e.swell * 3)),
    rsv: e => 'rsv' + (e.size || 0),
  };

  // ---------- behaviour ----------
  const para = (X, x, y, a, v) => X.S.toxins.push({ x, y, vx: Math.cos(a) * v * X.D.toxinSpd, vy: Math.sin(a) * v * X.D.toxinSpd, life: 5, para: true });
  const wobble = (e, X, amp, freq) => { const w = Math.sin(e.t * freq) * amp; X.tx += -X.uy * w; X.ty += X.ux * w; };
  const count = (X, type) => X.S.enemies.reduce((n, o) => n + (o.type === type && o.hp > 0), 0);

  V.AI = {
    zika(e, X) {   // hops in short bursts, resting in between
      if (e.state === 'hop') {
        X.snap = true; X.tx = e.hx * 120; X.ty = e.hy * 120; e.st -= X.dt;
        if (e.st <= 0) { e.state = 'rest'; e.cd = X.rnd(.5, 1); }
      } else {
        X.tx *= .25; X.ty *= .25; e.cd -= X.dt;
        if (e.cd <= 0) { const a = Math.atan2(X.uy, X.ux) + X.rnd(-.6, .6); e.hx = Math.cos(a); e.hy = Math.sin(a); e.state = 'hop'; e.st = .28; }
      }
    },
    dengue(e, X) { wobble(e, X, e.second ? 18 : 10, 5); if (e.second) { X.tx *= 1.3; X.ty *= 1.3; } },
    rota(e, X) {   // rolls along the nearest wall toward you, then leaps across
      if (e.state === 'leap') {
        X.snap = true; X.tx = e.lx * 130; X.ty = e.ly * 130; e.st -= X.dt;
        const wall = e.y <= X.TOP + e.r + 1 || e.y >= X.BOT - e.r - 1;
        if (e.st <= 0 || (e.st < .5 && wall)) { e.state = 'roll'; e.cd = X.rnd(1.2, 2); }
        return;
      }
      const wy = e.y < (X.TOP + X.BOT) / 2 ? X.TOP + e.r + 1 : X.BOT - e.r - 1, P = X.P;
      X.tx = X.clamp((P.x + P.svx * .5 * X.sm - e.x) * 2, -e.spd, e.spd); X.ty = (wy - e.y) * 4;
      e.cd -= X.dt;
      if (e.cd <= 0 && X.inside && Math.abs(P.x - e.x) < 20) { e.state = 'leap'; e.st = .9; e.lx = X.ux; e.ly = X.uy; X.V.SND.charge(); }
    },
    polio(e, X) {   // keeps back and fires paralysing shots
      wobble(e, X, 10, 3);
      if (X.d < 60) { X.tx -= X.ux * e.spd * 1.5; X.ty -= X.uy * e.spd * 1.5; }
      e.fire -= X.dt;
      if (e.fire <= 0 && X.inside) { e.fire = X.rnd(2, 2.8) * X.D.fire; para(X, e.x, e.y, X.aimA, 60); X.V.SND.spit(); }
    },
    herpes(e, X) {   // latent (invisible, untouchable) → flares up when you come close
      if (e.latent) {
        X.tx *= .3; X.ty *= .3; e.cycle -= X.dt;
        if (e.cycle <= 0 || X.d < 45) { e.latent = false; e.flare = 2; e.cycle = X.rnd(4, 5.5); X.burst(e.x, e.y, 10, X.V.PCOL.herpes, 50); X.V.SND.reveal(); }
        return;
      }
      e.flare = (e.flare || 0) - X.dt;
      if (e.flare > 0) { X.tx *= 1.7; X.ty *= 1.7; }
      e.cycle -= X.dt;
      if (e.cycle <= 0 && X.d > 55 && X.inside) { e.latent = true; e.cycle = X.rnd(2.5, 4); }
    },
    hepb(e, X) {   // sheds decoy antigen that soaks up shots
      e.shed -= X.dt;
      if (e.shed <= 0 && X.inside && count(X, 'hbsag') < 14) {
        e.shed = X.rnd(1.1, 1.6);
        const a = Math.atan2(X.dy, X.dx) + X.rnd(-.8, .8), s = X.spawn('hbsag', e.x + Math.cos(a) * 8, e.y + Math.sin(a) * 8);
        s.kx = Math.cos(a) * 30; s.ky = Math.sin(a) * 30;
      }
    },
    hbsag(e, X) { e.life -= X.dt; if (e.life <= 0) { X.kill(e, true); return 'gone'; } X.tx = Math.sin(e.t * 2) * 4; X.ty = Math.cos(e.t * 2) * 4; },
    h5n1(e, X) {   // the first bird leads; the rest hold a V behind it
      const flock = X.S.enemies.filter(o => o.type === 'h5n1' && o.hp > 0), lead = flock[0];
      if (lead === e) { wobble(e, X, 30, 1.5); return; }
      const i = flock.indexOf(e), side = i % 2 ? 1 : -1, rank = Math.ceil(i / 2);
      const vl = Math.hypot(lead.vx, lead.vy) || 1, bx = -lead.vx / vl, by = -lead.vy / vl;
      const gx = lead.x + bx * rank * 7 - by * side * rank * 6, gy = lead.y + by * rank * 7 + bx * side * rank * 6, m = e.spd * 1.6;
      X.tx = X.clamp((gx - e.x) * 3, -m, m); X.ty = X.clamp((gy - e.y) * 3, -m, m);
    },
    marburg(e, X) {   // zigzags, leaving pools of toxin
      const zig = Math.sign(Math.sin(e.t * 2.2)) * e.flank;
      X.tx += -X.uy * e.spd * .9 * zig; X.ty += X.ux * e.spd * .9 * zig;
      e.trail -= X.dt;
      if (e.trail <= 0 && X.inside) { e.trail = .38; X.S.toxins.push({ x: e.x, y: e.y, vx: 0, vy: 0, life: 2.2 }); }
    },
    variola(e, X) { wobble(e, X, 6, 2); },
    mumps(e, X) {   // swells until it bursts — pop it first
      if (X.inside) e.swell += X.dt / 11;
      e.r = 4 + Math.min(1, e.swell) * 4;
      const slow = 1 - Math.min(1, e.swell) * .5; X.tx *= slow; X.ty *= slow;
      if (e.swell >= 1) {
        for (let i = 0; i < 14; i++) X.toxin(e.x, e.y, i * X.TAU / 14 + e.t, 46);
        X.burst(e.x, e.y, 20, X.V.PCOL.mumps, 70); X.V.SND.boom(); X.kill(e, true); return 'gone';
      }
    },
    rsv(e, X) {   // two RSVs that touch fuse into one bigger syncytium
      if ((e.size || 0) >= 2) { X.tx *= .7; X.ty *= .7; return; }
      let best = null, bd = 60;
      for (const o of X.S.enemies) {
        if (o === e || o.type !== 'rsv' || o.hp <= 0 || (o.size || 0) >= 2) continue;
        const dd = Math.hypot(o.x - e.x, o.y - e.y);
        if (dd < e.r + o.r) {
          e.size = Math.min(2, (e.size || 0) + (o.size || 0) + 1); e.hp += o.hp; e.maxHp += o.maxHp; e.r = 4 + e.size * 1.6; e.score += o.score;
          X.kill(o, true); X.burst(e.x, e.y, 8, X.V.PCOL.rsv, 40); return;
        }
        if (dd < bd) { bd = dd; best = o; }
      }
      if (best) { X.tx = (best.x - e.x) / bd * e.spd; X.ty = (best.y - e.y) / bd * e.spd; }
    },
    bphage(e, X) {   // walks, crouches, leaps — shots pass under it mid-air
      if (e.state === 'tele') {
        X.tx = X.ty = 0; e.st -= X.dt;
        if (e.st <= 0) { const a = X.aimAt(e.x, e.y, 150); e.lx = Math.cos(a); e.ly = Math.sin(a); e.state = 'air'; e.st = .45; e.air = true; }
        return;
      }
      if (e.state === 'air') {
        X.snap = true; X.tx = e.lx * 150; X.ty = e.ly * 150; e.st -= X.dt; e.lift = Math.sin((1 - e.st / .45) * Math.PI) * 8;
        if (e.st <= 0) { e.state = 'walk'; e.air = false; e.lift = 0; e.cd = X.rnd(1.2, 2); X.burst(e.x, e.y, 5, X.V.PCOL.bphage, 30); }
        return;
      }
      X.tx *= .6; X.ty *= .6; wobble(e, X, 6, 7);
      e.cd -= X.dt;
      if (e.cd <= 0 && X.inside && X.d < 110) { e.state = 'tele'; e.st = .4; }
    },
    mers(e, X) {   // three orbiting spike proteins; they regrow
      e.spin += X.dt * 2;
      e.guards.forEach((g, i) => { const a = e.spin + i * X.TAU / 3; g.x = e.x + Math.cos(a) * 9; g.y = e.y + Math.sin(a) * 9; g.flash = (g.flash || 0) - X.dt; });
      e.regrow -= X.dt;
      if (e.regrow <= 0) { e.regrow = 6.5; const g = e.guards.find(g => !g.alive); if (g) { g.alive = true; g.hp = e.guardHp; } }
    },
    yellow(e, X) { wobble(e, X, 12, 4); },
    chikv(e, X) {   // pinball: straight lines, faster after every bounce
      X.snap = true;
      if (e.bx === undefined) { const a = Math.atan2(X.uy, X.ux); e.bx = Math.cos(a); e.by = Math.sin(a); e.sp = e.spd; }
      if (Math.abs(e.by) < .35) { e.by = Math.sign(e.by || 1) * .35; const l = Math.hypot(e.bx, e.by); e.bx /= l; e.by /= l; }
      const faster = () => { e.sp = Math.min(e.spd * 2, e.sp * 1.08); };
      if (X.inside) e.entered = true;
      if ((e.x < 6 && e.bx < 0 && e.entered) || (e.x > X.W - 6 && e.bx > 0 && e.entered)) { e.bx = -e.bx; faster(); }
      if (!e.entered) { e.bx = Math.sign(X.W / 2 - e.x) * Math.max(.6, Math.abs(e.bx)); }
      if ((e.y < X.TOP + e.r + 1 && e.by < 0) || (e.y > X.BOT - e.r - 1 && e.by > 0)) { e.by = -e.by; faster(); }
      X.tx = e.bx * e.sp; X.ty = e.by * e.sp;
    },
    nipah(e, X) {   // perches by a wall, then swoops through you in a curve
      const P = X.P, mid = (X.TOP + X.BOT) / 2;
      if (e.state === 'swoop') {
        X.snap = true; e.st += X.dt; const k = e.st / 1.1;
        if (k >= 1) { e.state = 'perch'; e.cd = X.rnd(1.2, 2); return; }
        const x = e.sx + (e.ex - e.sx) * k, y = e.sy + (e.ey - e.sy) * k + Math.sin(k * Math.PI) * e.bow;
        X.tx = X.clamp((x - e.x) / X.dt, -200, 200); X.ty = X.clamp((y - e.y) / X.dt, -200, 200);
        return;
      }
      const wy = e.y < mid ? X.TOP + 10 : X.BOT - 10, wx = X.clamp(P.x + (e.x < P.x ? -50 : 50), 12, X.W - 12);
      X.tx = X.clamp((wx - e.x) * 2, -e.spd, e.spd); X.ty = X.clamp((wy - e.y) * 2, -e.spd, e.spd);
      e.cd -= X.dt;
      if (e.cd <= 0 && X.inside) {
        const px = P.x + P.svx * .5 * X.sm, py = P.y + P.svy * .5 * X.sm;
        e.state = 'swoop'; e.st = 0; e.sx = e.x; e.sy = e.y;
        e.ex = X.clamp(e.x + (px - e.x) * 2, 8, X.W - 8); e.ey = wy < mid ? X.BOT - 10 : X.TOP + 10;
        e.bow = py - (e.sy + e.ey) / 2; X.V.SND.charge();
      }
    },
    lassa(e, X) {   // burrows, tunnels toward you, erupts in a ring
      if (e.state === 'under') {
        e.under = true; X.tx = X.ux * e.spd * 1.3; X.ty = X.uy * e.spd * 1.3; e.st -= X.dt;
        if (X.d < 14 || e.st <= 0) { e.state = 'rise'; e.st = .6; X.V.SND.charge(); }
        return;
      }
      if (e.state === 'rise') {
        X.tx = X.ty = 0; X.snap = true; e.st -= X.dt;
        if (e.st <= 0) {
          e.under = false; e.state = 'up'; e.cd = X.rnd(2.5, 3.5);
          for (let i = 0; i < 8; i++) X.toxin(e.x, e.y, i * X.TAU / 8 + e.t, 50);
          X.burst(e.x, e.y, 12, X.V.PCOL.lassa, 60); X.V.SND.boom();
        }
        return;
      }
      e.cd -= X.dt;
      if (e.cd <= 0 && X.inside) { e.state = 'under'; e.st = 3; }
    },
    hanta(e, X) {   // keeps its distance and puffs slow dust clouds
      const s = X.d > 80 ? 1 : X.d < 60 ? -1 : 0;
      const side = Math.sin(e.t * .7 + e.r) > 0 ? .5 : -.5;
      X.tx = X.ux * e.spd * s - X.uy * e.spd * side; X.ty = X.uy * e.spd * s + X.ux * e.spd * side;
      e.puff -= X.dt;
      if (e.puff <= 0 && X.inside) {
        e.puff = X.rnd(2.4, 3.2) * X.D.fire;
        X.S.toxins.push({ x: e.x, y: e.y, vx: Math.cos(X.aimA) * 26, vy: Math.sin(X.aimA) * 26, life: 5, r: 4, dust: true }); X.V.SND.spores();
      }
    },
    westnile(e, X) {   // circles like a mosquito, then darts straight through you
      const P = X.P;
      if (e.state === 'tele') {
        X.tx = X.ty = 0; e.st -= X.dt;
        if (e.st <= 0) { const a = X.aimAt(e.x, e.y, 160); e.lx = Math.cos(a); e.ly = Math.sin(a); e.state = 'dart'; e.st = .5; }
        return;
      }
      if (e.state === 'dart') {
        X.snap = true; X.tx = e.lx * 160; X.ty = e.ly * 160; e.st -= X.dt;
        if (e.st <= 0) { e.state = 'circle'; e.cd = X.rnd(1.8, 2.6); e.orbit = Math.atan2(e.y - P.y, e.x - P.x); }
        return;
      }
      e.orbit += X.dt * 1.6;
      const gx = X.clamp(P.x + Math.cos(e.orbit) * 60, 8, X.W - 8), gy = X.clamp(P.y + Math.sin(e.orbit) * 45, X.TOP + 8, X.BOT - 8);
      X.tx = X.clamp((gx - e.x) * 3, -e.spd, e.spd); X.ty = X.clamp((gy - e.y) * 3, -e.spd, e.spd);
      e.cd -= X.dt;
      if (e.cd <= 0 && X.inside) { e.state = 'tele'; e.st = .3; }
    },
    mimi(e, X) {   // a giant virus that releases Sputnik virophages
      e.brood -= X.dt;
      if (e.brood <= 0 && X.inside && count(X, 'sputnik') < 12) { e.brood = X.rnd(3, 4) * X.D.fire; for (let i = 0; i < 3; i++) X.spawn('sputnik', e.x + X.rnd(-6, 6), e.y + X.rnd(-6, 6)); X.V.SND.spores(); }
    },
    sputnik(e, X) { e.life -= X.dt; if (e.life <= 0) { X.kill(e, true); return 'gone'; } wobble(e, X, 12, 9); },

    // ---------- bosses ----------
    pandemic(e, X) {   // The 1918 Pandemic: a four-armed spiral, aimed fans, flocks of avian flu
      const P = X.P, rage = e.hp < e.maxHp / 2;
      X.tx = ((X.W - 40) - e.x) * 1.2; X.ty = X.clamp((P.y - e.y) * .8 + Math.sin(e.t * .8) * 20, -e.spd, e.spd);
      e.spin += X.dt * (rage ? 1.5 : 1.05); e.arm -= X.dt;
      if (e.arm <= 0 && X.inside) { e.arm = .3 * X.D.fire; const n = rage ? 5 : 4; for (let i = 0; i < n; i++) X.toxin(e.x, e.y, e.spin + i * X.TAU / n, 48); }
      e.fire -= X.dt;
      if (e.fire <= 0 && X.inside) { e.fire = (rage ? 1.7 : 2.3) * X.D.fire; for (let i = -2; i <= 2; i++) X.toxin(e.x, e.y, X.aimA + i * .16, 62); X.V.SND.bossShot(); }
      e.flock -= X.dt;
      if (e.flock <= 0 && X.inside) { e.flock = (rage ? 6 : 8) * X.D.fire; for (let i = 0, n = rage ? 6 : 4; i < n; i++) X.spawn('h5n1', X.W + 10 + i * 6, X.clamp(P.y + (i - n / 2) * 10, X.TOP + 10, X.BOT - 10)); }
    },
    fevers(e, X) {   // Four Fevers: the core is untouchable until all four serotypes fall; each loss angers the rest
      const P = X.P, n = e.guards.filter(g => g.alive).length, anger = 1 + (4 - n) * .3;
      e.invuln = n > 0;
      const want = X.clamp(P.x + 90, X.W * .45, X.W - 30), m = e.spd * (n ? 2 : 3.2);
      X.tx = X.clamp((want - e.x) * 1.2, -m, m); X.ty = X.clamp((P.y - e.y) * .8 + Math.sin(e.t * .9) * 24, -m, m);
      e.spin += X.dt * (1.2 + (4 - n) * .35);
      e.guards.forEach((g, i) => {
        const a = e.spin + i * X.TAU / 4; g.x = e.x + Math.cos(a) * 22; g.y = e.y + Math.sin(a) * 22; g.flash = (g.flash || 0) - X.dt;
        if (!g.alive || !X.inside) return;
        g.fire -= X.dt * anger;
        if (g.fire > 0) return;
        const aim = X.aimAt(g.x, g.y, 62);
        if (g.sero === 0) { g.fire = 1.6 * X.D.fire; for (let k = -1; k <= 1; k++) X.toxin(g.x, g.y, aim + k * .2, 62); }
        else if (g.sero === 1) { g.fire = 2.2 * X.D.fire; for (let k = 0; k < 8; k++) X.toxin(g.x, g.y, e.t + k * X.TAU / 8, 44); }
        else if (g.sero === 2) { g.fire = .9 * X.D.fire; X.toxin(g.x, g.y, X.aimAt(g.x, g.y, 76), 76); }
        else { g.fire = 2.6 * X.D.fire; for (let k = -1; k <= 1; k++) para(X, g.x, g.y, aim + k * .3, 56); }
      });
      if (n !== e.lastN) { if (e.lastN !== undefined) { X.shake(.3); X.V.SND.boss(); X.burst(e.x, e.y, 20, X.V.PCOL.fevers, 60); } e.lastN = n; }
      if (!n) { e.fire = (e.fire ?? 1) - X.dt; if (e.fire <= 0 && X.inside) { e.fire = .9 * X.D.fire; for (let k = 0; k < 12; k++) X.toxin(e.x, e.y, e.t * 2 + k * X.TAU / 12, 52); X.V.SND.bossShot(); } }
    },
    wheel(e, X) {   // The Great Wheel: rolls the perimeter spraying from its spokes, stops mid-vessel for double rings
      const rage = e.hp < e.maxHp / 2;
      X.snap = true; e.spin += X.dt * (rage ? 2.4 : 1.8);
      if (e.state === 'stop') {
        X.tx = ((X.W / 2) - e.x) * 2; X.ty = (((X.TOP + X.BOT) / 2) - e.y) * 2; e.st -= X.dt; e.ringT = (e.ringT || 0) - X.dt;
        if (e.ringT <= 0) { e.ringT = .7 * X.D.fire; e.alt = !e.alt; for (let i = 0; i < 18; i++) X.toxin(e.x, e.y, e.spin + i * X.TAU / 18 + (e.alt ? X.TAU / 36 : 0), 44); X.V.SND.bossShot(); }
        if (e.st <= 0) { e.state = 'roll'; e.stopT = X.rnd(7, 9); }
        return;
      }
      const m = 16, x0 = m, x1 = X.W - m, y0 = X.TOP + m, y1 = X.BOT - m, w = x1 - x0, h = y1 - y0, per = 2 * (w + h);
      e.path = (e.path + X.dt * e.spd * (rage ? 1.3 : 1)) % per;
      let p = e.path, gx, gy;
      if (p < w) { gx = x1 - p; gy = y0; } else if ((p -= w) < h) { gx = x0; gy = y0 + p; } else if ((p -= h) < w) { gx = x0 + p; gy = y1; } else { p -= w; gx = x1; gy = y1 - p; }
      X.tx = X.clamp((gx - e.x) * 6, -150, 150); X.ty = X.clamp((gy - e.y) * 6, -150, 150);
      e.spoke = (e.spoke || 0) - X.dt;
      if (e.spoke <= 0 && X.inside) { e.spoke = (rage ? .28 : .36) * X.D.fire; for (let i = 0; i < 3; i++) X.toxin(e.x, e.y, e.spin + i * X.TAU / 3, 50); }
      e.stopT -= X.dt;
      if (e.stopT <= 0) { e.state = 'stop'; e.st = 3; }
    },
    latency(e, X) {   // Latency: hides (untouchable), then flares up beside you in a ring
      const P = X.P, rage = e.hp < e.maxHp / 2;
      if (e.state === 'latent') {
        e.latent = true; X.tx = X.ux * e.spd; X.ty = X.uy * e.spd; e.st -= X.dt;
        if (e.st <= 0) {
          const a = X.rnd(0, X.TAU);
          e.fx = X.clamp(P.x + Math.cos(a) * 48, 16, X.W - 16); e.fy = X.clamp(P.y + Math.sin(a) * 40, X.TOP + 12, X.BOT - 12);
          e.state = 'flare'; e.st = .9; X.V.SND.charge();
        }
        return;
      }
      if (e.state === 'flare') {
        X.tx = X.ty = 0; e.st -= X.dt;
        if (e.st <= 0) {
          e.x = e.fx; e.y = e.fy; e.vx = e.vy = e.kx = e.ky = 0; e.latent = false; e.state = 'active'; e.st = rage ? 4.5 : 4;
          X.burst(e.x, e.y, 24, X.V.PCOL.latency, 70); X.V.SND.reveal();
          for (let i = 0; i < 16; i++) X.toxin(e.x, e.y, i * X.TAU / 16, 46);
        }
        return;
      }
      const s = X.d > 50 ? 1 : -.7;
      X.tx = X.ux * e.spd * s - X.uy * e.spd * .6; X.ty = X.uy * e.spd * s + X.ux * e.spd * .6;
      e.fire -= X.dt;
      if (e.fire <= 0 && X.inside) { e.fire = (rage ? .7 : .9) * X.D.fire; for (let i = -1; i <= 1; i++) X.toxin(e.x, e.y, X.aimA + i * .18, 64); X.V.SND.bossShot(); }
      e.st -= X.dt;
      if (e.st <= 0 && X.inside) { e.state = 'latent'; e.st = rage ? 2 : 2.6; X.burst(e.x, e.y, 14, X.V.PCOL.latency, 40); }
    },
    megavirus(e, X) {   // Megavirus: a capsid that regrows when left alone, and endless virophages
      const P = X.P, rage = e.hp < e.maxHp / 2;
      X.tx = (X.W - 50) - e.x; X.ty = X.clamp((P.y - e.y) * .5, -e.spd, e.spd);
      if (e.shell > 0) { e.calm += X.dt; if (e.calm > 3.5 && e.shell < e.shellMax) e.shell = Math.min(e.shellMax, e.shell + e.shellMax * .04 * X.dt); }
      else { e.expT -= X.dt; if (e.expT <= 0) { e.shell = e.shellMax * .6; X.burst(e.x, e.y, 24, ['#c0ffc0', '#fff'], 70); X.V.SND.shell(); } }
      e.brood -= X.dt;
      if (e.brood <= 0 && X.inside && count(X, 'sputnik') < (rage ? 6 : 4)) {   // (capped, so the swarm can't bury the fight)
        e.brood = (rage ? 3.5 : 4.5) * X.D.fire;
        for (let i = 0, n = rage ? 4 : 3; i < n; i++) X.spawn('sputnik', e.x - 10 + X.rnd(-4, 4), e.y + X.rnd(-10, 10));
        if (rage && !e.mimi) { e.mimi = true; X.spawn('mimi', e.x - 16, e.y); }   // one Mimivirus per fight
        X.V.SND.spores();
      }
      e.fire -= X.dt;
      if (e.fire <= 0 && X.inside) {
        e.fire = (rage ? 2 : 2.6) * X.D.fire;
        for (let i = 0; i < 20; i++) X.toxin(e.x, e.y, e.t + i * X.TAU / 20, 36);
        for (let i = -1; i <= 1; i++) X.toxin(e.x, e.y, X.aimA + i * .14, 60);
        X.V.SND.bossShot();
      }
    },
    paralyzer(e, X) {   // The Paralyzer: paralysing fans, aimed shots, and closing rings of paralysis
      const P = X.P, rage = e.hp < e.maxHp / 2;
      X.tx = X.ux * e.spd; X.ty = X.uy * e.spd;
      if (X.d < 55) { X.tx = -X.ux * e.spd; X.ty = -X.uy * e.spd; }
      e.fire -= X.dt;
      if (e.fire <= 0 && X.inside) { e.fire = (rage ? 1.2 : 1.6) * X.D.fire; const n = rage ? 7 : 5; for (let i = 0; i < n; i++) para(X, e.x, e.y, X.aimA + (i - (n - 1) / 2) * .2, 58); X.V.SND.spit(); }
      e.aim -= X.dt;
      if (e.aim <= 0 && X.inside) { e.aim = (rage ? 1.4 : 1.9) * X.D.fire; for (let i = -1; i <= 1; i++) X.toxin(e.x, e.y, X.aimA + i * .12, 70); X.V.SND.bossShot(); }
      // you're paralysed: it capitalizes with a fast aimed volley
      e.punish = (e.punish || 0) - X.dt;
      if (X.P.paraT > 0 && e.punish <= 0 && X.inside) { e.punish = 1.1; for (let i = -2; i <= 2; i++) X.toxin(e.x, e.y, X.aimA + i * .1, 84); X.V.SND.snipe(); }
      e.zone -= X.dt;
      if (e.zone <= 0 && X.inside) {
        e.zone = (rage ? 2.4 : 3.2) * X.D.fire;
        for (let i = 0; i < 10; i++) { const a = i * X.TAU / 10; X.S.toxins.push({ x: P.x + Math.cos(a) * 24, y: P.y + Math.sin(a) * 24, vx: -Math.cos(a) * 14, vy: -Math.sin(a) * 14, life: 2.2, para: true }); }
        X.V.SND.charge();
      }
    },
    smallpox(e, X) {   // Variola Major: every hit fires back; huge pustule rings; sheds variola
      const P = X.P, rage = e.hp < e.maxHp / 2;
      X.tx = ((X.W - 46) - e.x) * 1.1 + Math.sin(e.t * .6) * 20; X.ty = X.clamp((P.y - e.y) * .8, -e.spd, e.spd);
      e.burstT -= X.dt;
      if (e.burstT <= 0 && X.inside) { e.burstT = (rage ? 3.5 : 4.5) * X.D.fire; for (let i = 0; i < 24; i++) X.toxin(e.x, e.y, e.t + i * X.TAU / 24, 40 + (i % 2) * 10); X.V.SND.boom(); X.shake(.2); }
      e.fire -= X.dt;
      if (e.fire <= 0 && X.inside) { e.fire = (rage ? 1.5 : 2) * X.D.fire; for (let i = -2; i <= 2; i++) X.toxin(e.x, e.y, X.aimA + i * .2, 58); X.V.SND.bossShot(); }
      while (e.hp > 0 && e.split.length && e.hp / e.maxHp < e.split[0]) { e.split.shift(); X.shake(.3); for (let i = 0; i < 3; i++) X.spawn('variola', e.x + X.rnd(-10, 10), e.y + X.rnd(-10, 10)); }
    },
    carrier(e, X) {   // Phage Carrier: cruises the upper vessel dropping phage pods, then snipes in volleys
      const rage = e.hp < e.maxHp / 2;
      if (e.dir === undefined) e.dir = -1;
      if (e.x < 40) e.dir = 1; if (e.x > X.W - 30 && X.inside) e.dir = -1;
      if (e.state === 'aim') {
        X.tx = X.ty = 0; X.snap = true; e.st -= X.dt;
        if (e.st > .3) e.la = X.aimAt(e.x, e.y, 170);
        if (e.st <= 0) {
          for (let i = -1; i <= 1; i++) X.toxin(e.x, e.y, e.la + i * .12, 170);
          X.V.SND.snipe(); e.shots--;
          if (e.shots > 0) e.st = e.finalForm ? .42 : rage ? .55 : .7; else { if (e.finalForm) for (let i = 0; i < 14; i++) X.toxin(e.x, e.y, e.t + i * X.TAU / 14, 46); e.state = 'move'; e.cd = (e.finalForm ? X.rnd(1.6, 2.2) : X.rnd(3, 4)) * X.D.fire; }
        }
        return;
      }
      X.tx = e.dir * e.spd; X.ty = ((X.TOP + 28) - e.y) * 2;
      e.drop -= X.dt;
      if (e.drop <= 0 && X.inside) { e.drop = (e.finalForm ? 1.8 : rage ? 2.5 : 3.2) * X.D.fire; for (let i = 0; i < 2; i++) { const p = X.spawn('bphage', e.x + (i ? 6 : -6), e.y + 10); p.cd = .6; } X.V.SND.spores(); }
      e.cd -= X.dt;
      if (e.cd <= 0 && X.inside) { e.state = 'aim'; e.st = e.finalForm ? .8 : 1; e.shots = e.finalForm ? 6 : rage ? 4 : 3; e.la = X.aimA; X.V.SND.charge(); }
    },
    empress(e, X) {   // Crown Empress: rotating spike-protein beams; her crown speeds up every pathogen
      const P = X.P, rage = e.hp < e.maxHp / 2;
      const homeX = X.clamp(P.x + 80, X.W * .5, X.W - 30);
      X.tx = (homeX - e.x) * .9; X.ty = X.clamp((P.y - e.y) * .6 + Math.sin(e.t * .7) * 22, -e.spd * 2, e.spd * 2);
      for (const o of X.S.enemies) if (o !== e && !o.boss) o.buffed = true;
      if (e.finalForm) { e.flipT = (e.flipT ?? 3.5) - X.dt; if (e.flipT <= 0) { e.flipT = X.rnd(3, 4.5); e.dir = -(e.dir || 1); X.V.SND.charge(); } }
      e.spin += X.dt * (rage ? .9 : .6) * (e.dir || 1); e.beamT -= X.dt;
      if (e.beamT <= 0 && X.inside) { e.beamT = .15 * X.D.fire; for (let i = 0, n = rage ? 4 : 3; i < n; i++) X.toxin(e.x, e.y, e.spin + i * X.TAU / n, 70); }
      e.brood -= X.dt;
      if (e.brood <= 0 && X.inside) { e.brood = (rage ? 5 : 7) * X.D.fire; X.spawn('corona', e.x - 10, e.y); for (let i = 0; i < 3; i++) X.spawn('virus', e.x - 8, e.y + X.rnd(-12, 12)); }
      e.fire -= X.dt;
      if (e.fire <= 0 && X.inside) { e.fire = (rage ? 1.8 : 2.4) * X.D.fire; for (let i = -2; i <= 2; i++) X.toxin(e.x, e.y, X.aimA + i * .18, 56); X.V.SND.bossShot(); }
    },
    zero(e, X) {   // Patient Zero: cycles rings → charges → spiral → blinks, and calls in the swarm
      const P = X.P, rage = e.hp < e.maxHp / 2, acts = ['rings', 'charge', 'spiral', 'blink'];
      e.actT -= X.dt;
      if (e.actT <= 0 && e.state !== 'dash' && e.state !== 'tele') { e.act = (e.act + 1) % 4; e.actT = e.finalForm ? 3.2 : rage ? 5 : 6.5; e.state = 'move'; e.fire = .8; X.burst(e.x, e.y, 16, X.V.PCOL.zero, 60); X.V.SND.blink(); }
      const act = acts[e.act]; e.fire -= X.dt;
      if (e.finalForm) { e.ffShot = (e.ffShot ?? 1) - X.dt; if (e.ffShot <= 0 && X.inside) { e.ffShot = 1.1 * X.D.fire; for (let i = -1; i <= 1; i++) X.toxin(e.x, e.y, X.aimA + i * .14, 70); } }   // final form: never stops shooting
      e.brood -= X.dt;
      if (e.brood <= 0 && X.inside) { e.brood = (rage ? 6 : 8) * X.D.fire; const pool = ['virus', 'h5n1', 'zika', 'westnile', 'chikv']; for (let i = 0; i < (e.finalForm ? 5 : 3); i++) { const m = X.spawn(pool[Math.floor(Math.random() * pool.length)], e.x + X.rnd(-10, 10), e.y + X.rnd(-10, 10)); m.hp = m.maxHp = Math.min(m.maxHp, 30); } }
      if (act === 'rings') {
        X.tx = (X.W - 50) - e.x; X.ty = X.clamp((P.y - e.y) * .8, -e.spd, e.spd);
        if (e.fire <= 0 && X.inside) { e.fire = (rage ? 1.3 : 1.7) * X.D.fire; const n = rage ? 16 : 12; for (let i = 0; i < n; i++) X.toxin(e.x, e.y, e.t + i * X.TAU / n, 44); for (let i = -1; i <= 1; i++) X.toxin(e.x, e.y, X.aimA + i * .15, 62); X.V.SND.bossShot(); }
      } else if (act === 'charge') {
        if (e.state === 'tele') { X.tx = X.ty = 0; e.st -= X.dt; if (e.st <= 0) { e.state = 'dash'; e.st = .7; e.cx = X.ux; e.cy = X.uy; } }
        else if (e.state === 'dash') {
          X.snap = true; X.tx = e.cx * 170; X.ty = e.cy * 170; e.st -= X.dt;
          if (e.st <= 0 || e.x < 14 || e.x > X.W - 14) { e.state = 'move'; e.fire = .6; for (let i = 0; i < 10; i++) X.toxin(e.x, e.y, i * X.TAU / 10, 50); }
        } else { X.tx = X.ux * e.spd * .5; X.ty = X.uy * e.spd * .5; if (e.fire <= 0 && X.inside) { e.state = 'tele'; e.st = .7; e.fire = 1.2; X.V.SND.charge(); } }
      } else if (act === 'spiral') {
        X.tx = (X.W * .7) - e.x; X.ty = ((X.TOP + X.BOT) / 2) - e.y;
        e.spin = (e.spin || 0) + X.dt * 1.8 * (Math.sin(e.t * .5) > 0 ? 1 : -1);
        if (e.fire <= 0 && X.inside) { e.fire = .3 * X.D.fire; for (let i = 0, n = rage ? 4 : 3; i < n; i++) X.toxin(e.x, e.y, e.spin + i * X.TAU / n, 50); }
      } else if (e.state === 'tele') {
        X.tx = X.ty = 0; e.st -= X.dt;
        if (e.st <= 0) {
          X.burst(e.x, e.y, 14, X.V.PCOL.zero, 60); e.x = e.bx; e.y = e.by; e.vx = e.vy = e.kx = e.ky = 0;
          X.burst(e.x, e.y, 14, X.V.PCOL.zero, 60); X.V.SND.blink();
          e.state = 'move'; e.fire = (rage ? 1.1 : 1.5) * X.D.fire;
          for (let i = 0; i < 14; i++) X.toxin(e.x, e.y, e.t + i * X.TAU / 14, 46);
        }
      } else {
        wobble(e, X, 14, 1.5); X.tx -= X.ux * e.spd * .3; X.ty -= X.uy * e.spd * .3;
        if (X.d < 45) { X.tx = -X.ux * e.spd; X.ty = -X.uy * e.spd; }
        if (e.fire <= 0 && X.inside) {
          const a = X.rnd(0, X.TAU); e.bx = X.clamp(P.x + Math.cos(a) * 60, 14, X.W - 14); e.by = X.clamp(P.y + Math.sin(a) * 50, X.TOP + 12, X.BOT - 12);
          e.state = 'tele'; e.st = .7;
        }
      }
    },
  };

  // set-up that needs the final (scaled) health
  V.ON_SPAWN = {
    mers: e => { e.guardHp = 1.5 + e.level * .15; for (const g of e.guards) g.hp = e.guardHp; },
    fevers: e => { for (const g of e.guards) g.hp = e.maxHp * .15; e.hp = e.maxHp = e.maxHp * .5; },
  };
  V.ON_KILL = {
    dengue: (e, X) => {   // a second dengue infection is worse than the first
      if (e.second || e.expiredKill) return;
      const c = X.spawn('dengue', e.x, e.y); c.second = true; c.hp = c.maxHp = e.maxHp * 1.6; c.spd = e.spd * 1.3; c.score = e.score; c.r = 5;
      X.burst(e.x, e.y, 12, X.V.PCOL.dengue, 50);
    },
    yellow: (e, X) => { for (let i = 0; i < 6; i++) { const a = i * X.TAU / 6; X.S.toxins.push({ x: e.x + Math.cos(a) * 6, y: e.y + Math.sin(a) * 6, vx: 0, vy: 0, life: 3 }); } },
  };
  // pustules fire back at whoever hit them (rate-limited so rapid fire isn't a death sentence)
  const counter = (gap, spread) => (e, b, X) => {
    if (e.hp <= 0 || e.t - (e.lastC ?? -9) < gap) return;
    e.lastC = e.t; X.toxin(b.x, b.y, Math.atan2(-b.vy, -b.vx) + X.rnd(-spread, spread), 60);
  };
  V.ON_HIT = { variola: counter(.35, .15), smallpox: counter(.22, .25) };

  // extra drawing on top of the sprite
  const laser = (ctx, e, R) => {
    const locked = e.st <= .3, cx = Math.cos(e.la), cy = Math.sin(e.la);
    if (locked && Math.floor(e.t * 20) % 2) return;
    ctx.fillStyle = locked ? '#ff4a4a' : '#a02030';
    for (let d = 8; d < 260; d += locked ? 3 : 5) ctx.fillRect(R(e.x + cx * d), R(e.y + cy * d), 1, 1);
  };
  V.DRAW = {
    lassa(ctx, e, { ring, R }) {
      if (e.state === 'under') { ctx.fillStyle = '#7a5a3a'; for (let i = 0; i < 4; i++) ctx.fillRect(R(e.x + Math.cos(e.t * 9 + i * 1.6) * 3), R(e.y + Math.sin(e.t * 7 + i) * 2), 1, 1); }
      if (e.state === 'rise' && Math.floor(e.t * 12) % 2) ring(e.x, e.y, 7, 12, '#f0d0a0');
    },
    latency(ctx, e, { ring }) { if (e.state === 'flare' && Math.floor(e.t * 12) % 2) { ring(e.fx, e.fy, 12, 20, '#ff90c0'); ring(e.fx, e.fy, 6, 10, '#fff', e.t); } },
    carrier(ctx, e, { R }) { if (e.state === 'aim') laser(ctx, e, R); },
    zero(ctx, e, { ring }) { if (e.state === 'tele' && e.bx !== undefined && e.act === 3 && Math.floor(e.t * 10) % 2) { ring(e.bx, e.by, 12, 20, '#ff3040'); ring(e.bx, e.by, 6, 10, '#fff', e.t); } },
  };
})();
