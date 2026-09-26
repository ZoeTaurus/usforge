// Expansion 2 (art + behaviour): Staph Twins, Anthrax Sovereign, Cholera Tide, the Superbug, Sepsis, and six power-up icons.
(() => {
  const V = window.VAX;
  const { SPR } = V;
  const { mk, art, whiteOf, virus, bacterium, cluster } = V.kit;
  const R = Math.round, TAU = Math.PI * 2;
  const two = fn => [0, 1].map(fn);

  // ---------- sprites ----------
  // Bacillus anthracis grows in "boxcar" chains of square-ended rods
  const boxcars = two(f => mk(28, 11, (p, g) => {
    for (let i = 0; i < 3; i++) g.drawImage(bacterium(6, 8, '#e05050', '#5a1010', '#ffb0b0', f), i * 8 - 2 + (i === 1 && f ? 1 : 0), 0);
  }));
  // Vibrio cholerae: a curved comma with one long whipping flagellum
  const comma = two(f => mk(22, 14, p => {
    for (let k = 0; k <= 22; k++) {
      const a = Math.PI * .15 + k / 22 * Math.PI * .7, cx = 13 + Math.cos(a) * 8, cy = 13 - Math.sin(a) * 9;
      for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (x * x + y * y <= 5) p(R(cx + x), R(cy + y), x * x + y * y > 3 ? '#1a4a60' : y < 0 ? '#b0f0ff' : '#60c0e0');
    }
    for (let x = 0; x < 6; x++) p(x, R(9 + Math.sin(x * 1.3 + f * Math.PI) * 2), '#1a4a60');
  }));
  const grapes = (col, dark, light) => two(f => cluster(f ? [[5, 5, 3.4], [11, 4, 3.2], [8, 10, 3.4], [14, 9, 3], [3, 11, 2.8]] : [[5, 5, 3.4], [11, 5, 3.2], [8, 10, 3.4], [14, 10, 3], [3, 10, 2.8]], 18, 15, 3, col, dark, light));
  Object.assign(SPR, {
    twins: grapes('#ffc040', '#6a4000', '#fff0b0'),
    twins2: grapes('#f0f0e0', '#5a5a50', '#ffffff'),
    anthrax: boxcars,
    cholera: comma,
    superbug: two(f => cluster(f ? [[9, 9, 6], [3.5, 5, 3], [14.5, 5, 3], [4, 14, 3], [14, 14, 3]] : [[9, 9, 6], [3, 6, 3], [15, 5.5, 3], [4.5, 14.5, 3], [13.5, 14, 3]], 19, 19, 3, '#a0ff60', '#205a00', '#e0ffc0')),
    sepsis: two(f => virus(10, '#c02040', '#400010', '#ff7090', '#ff4060', f * Math.PI / 8)),
    // power-up icons
    bounce: art(['p.....p', '.p...p.', '..pPp..', '...W...', '..pPp..', '.p...p.', 'p.....p'], { p: '#c06a9a', P: '#ffb0e0', W: '#fff' }),
    mega: art(['..ooo..', '.oOOOo.', 'oOOWOOo', 'oOWWWOo', 'oOOWOOo', '.oOOOo.', '..ooo..'], { o: '#a04a00', O: '#ff9a40', W: '#fff0d0' }),
    halo: art(['..a.a..', '.a...a.', 'a..A..a', '..AWA..', 'a..A..a', '.a...a.', '..a.a..'], { a: '#a0fff0', A: '#4ab0a0', W: '#fff' }),
    antitox: art(['..ggg..', '.gGGGg.', 'gGGWGGg', 'gGWWWGg', 'gGGWGGg', '.gGGGg.', '..ggg..'], { g: '#2a8a4a', G: '#80ffa0', W: '#fff' }),
    nk: art(['.n...n.', 'nNn.nNn', '.nNNNn.', '..NKN..', '.nNNNn.', 'nNn.nNn', '.n...n.'], { n: '#a02050', N: '#ff6a9a', K: '#400818' }),
    clone: art(['.cc.cc.', 'cCCcCCc', 'cCWcCWc', 'cCCcCCc', 'cCCcCCc', '.cc.cc.', '..c..c.'], { c: '#3a6aa0', C: '#9ad0ff', W: '#fff' }),
    shotBig: art(['.aAa.', 'aAWAa', '.aAa.'], { a: '#ff9a40', A: '#ffd0a0', W: '#fff' }),
    shotB: art(['b.b', '.B.', '.b.'], { b: '#ffb0e0', B: '#fff' }),
    haloOrb: art(['.a.', 'aWa', '.a.'], { a: '#a0fff0', W: '#fff' }),
    nkCell: two(f => cluster(f ? [[4.5, 4.5, 3.6], [1.5, 1.5, 1.2], [7.5, 7.5, 1.2]] : [[4.5, 4.5, 3.6], [7.5, 1.5, 1.2], [1.5, 7.5, 1.2]], 9, 9, 3, '#ff6a9a', '#6a1030', '#ffd0e0')),
  });
  for (const k of ['twins', 'twins2', 'anthrax', 'cholera', 'superbug', 'sepsis']) SPR[k + 'W'] = SPR[k].map(whiteOf);
  Object.assign(V.PCOL, {
    twins: ['#ffc040', '#fff0b0', '#6a4000', '#fff'], twins2: ['#f0f0e0', '#ffffff', '#5a5a50'], anthrax: ['#e05050', '#ffb0b0', '#5a1010', '#fff'],
    cholera: ['#60c0e0', '#b0f0ff', '#1a4a60', '#fff'], superbug: ['#a0ff60', '#e0ffc0', '#205a00', '#fff'], sepsis: ['#c02040', '#ff7090', '#400010', '#fff'],
  });

  // ---------- behaviour ----------
  const twin = (e, X) => {
    const P = X.P, mate = X.S.enemies.find(o => o !== e && (o.type === 'twins' || o.type === 'twins2') && o.hp > 0);
    e.spin += X.dt * (mate ? .9 : 1.6);
    const cx = X.clamp(P.x + 80, X.W * .45, X.W - 40), cy = (X.TOP + X.BOT) / 2 + Math.sin(e.t * .5) * 20;
    const gx = cx + Math.cos(e.spin) * 32, gy = cy + Math.sin(e.spin) * 26, m = e.spd * 2;
    X.tx = X.clamp((gx - e.x) * 2.5, -m, m); X.ty = X.clamp((gy - e.y) * 2.5, -m, m);
    e.fire -= X.dt * (mate ? 1 : 1.6);   // alone, it fights twice as hard
    if (e.fire <= 0 && X.inside) {
      if (e.role === 0) { e.fire = 1.6 * X.D.fire; for (let i = 0; i < 12; i++) X.toxin(e.x, e.y, e.t + i * TAU / 12, 44); }
      else { e.fire = 1 * X.D.fire; for (let i = -2; i <= 2; i++) X.toxin(e.x, e.y, X.aimA + i * .16, 64); }
      X.V.SND.bossShot();
    }
    // its partner fell: finish this one before the timer runs out, or the partner comes back
    if (!mate && e.mateDead) {
      e.revT -= X.dt;
      if (e.revT <= 0) {
        const c = X.spawn(e.mateDead, e.x + 12, e.y); c.maxHp = e.mateMax; c.hp = e.mateMax * .5; c.age = e.age; c.enrageAt = e.enrageAt;
        e.mateDead = null; X.burst(c.x, c.y, 30, X.V.PCOL[c.type], 80); X.V.SND.boss();
        X.V.ui.toast(X.up(X.t('toast.twinRevived')), '#ffc040');
      }
    }
  };
  Object.assign(V.AI, {
    twins: twin, twins2: twin,
    anthrax(e, X) {   // marks lines across the vessel, then fills them with toxin
      const P = X.P, rage = e.hp < e.maxHp / 2;
      X.tx = ((X.W - 40) - e.x) * 1.1; X.ty = X.clamp((P.y - e.y) * .6 + Math.sin(e.t * .7) * 18, -e.spd, e.spd);
      e.lineT -= X.dt;
      if (e.lineT <= 0 && X.inside) {
        e.lineT = (rage ? 2.4 : 3.2) * X.D.fire;
        for (let i = 0, n = rage ? 3 : 2; i < n; i++) {
          const horiz = i === 0 ? Math.random() < .5 : Math.random() < .5;
          // the first line always runs right through you; the others land nearby
          const pos = horiz ? X.clamp(P.y + (i ? X.rnd(-34, 34) : 0), X.TOP + 6, X.BOT - 6) : X.clamp(P.x + (i ? X.rnd(-50, 50) : 0), 6, X.W - 6);
          e.lines.push({ horiz, pos, t: 0 });
        }
        X.V.SND.charge();
      }
      for (const L of e.lines) {
        L.t += X.dt;
        if (L.t >= .9 && !L.fired) {
          L.fired = true;
          if (L.horiz) for (let x = 3; x < X.W; x += 5) X.S.toxins.push({ x, y: L.pos, vx: 0, vy: 0, life: .45 });
          else for (let y = X.TOP + 3; y < X.BOT; y += 5) X.S.toxins.push({ x: L.pos, y, vx: 0, vy: 0, life: .45 });
          X.V.SND.boom(); X.shake(.15);
        }
      }
      e.lines = e.lines.filter(L => L.t < 1.35);
      e.fire -= X.dt;
      if (e.fire <= 0 && X.inside) { e.fire = (rage ? 1.6 : 2.2) * X.D.fire; for (let i = -1; i <= 1; i++) X.toxin(e.x, e.y, X.aimA + i * .2, 60); X.V.SND.bossShot(); }
      e.brood -= X.dt;
      if (e.brood <= 0 && X.inside) { e.brood = (rage ? 4 : 5.5) * X.D.fire; for (let i = 0; i < 3; i++) X.spawn('spore', e.x + X.rnd(-8, 8), e.y + X.rnd(-8, 8)); }
    },
    cholera(e, X) {   // a current that drags you, and toxin walls with one gap sweeping across
      const P = X.P, S = X.S, rage = e.hp < e.maxHp / 2;
      X.tx = ((X.W - 44) - e.x) * 1.1; X.ty = X.clamp((P.y - e.y) * .7, -e.spd, e.spd);
      e.flowT -= X.dt;
      if (e.flowT <= 0) {
        e.flowPhase = ((e.flowPhase ?? 2) + 1) % 3;   // 0 warn → 1 push → 2 calm
        if (e.flowPhase === 0) { e.flowT = 1.1; e.flowDir = -(e.flowDir || 1); X.V.SND.charge(); }
        else if (e.flowPhase === 1) e.flowT = rage ? 4.5 : 4;
        else e.flowT = rage ? 1.5 : 2.5;
      }
      S.flowX = e.flowPhase === 1 ? e.flowDir * (rage ? 46 : 34) : 0;
      e.warn = e.flowPhase === 0;
      e.wallT -= X.dt;
      if (e.wallT <= 0 && X.inside) {
        e.wallT = (rage ? 2.6 : 3.4) * X.D.fire;
        const gap = X.clamp(P.y + X.rnd(-30, 30), X.TOP + 18, X.BOT - 18);
        for (let y = X.TOP + 3; y < X.BOT; y += 6) if (Math.abs(y - gap) > 14) S.toxins.push({ x: X.W + 4, y, vx: -55 * X.D.toxinSpd, vy: 0, life: 6 });
      }
      e.fire -= X.dt;
      if (e.fire <= 0 && X.inside) { e.fire = (rage ? 1.8 : 2.4) * X.D.fire; for (let i = -1; i <= 1; i++) X.toxin(e.x, e.y, X.aimA + i * .22, 58); X.V.SND.bossShot(); }
    },
    superbug(e, X) {   // antibody-proof shield — only a dash through it breaks it
      const P = X.P, rage = e.hp < e.maxHp / 2;
      if (e.shieldUp) {
        if (P.dashing > 0 && Math.hypot(P.x - e.x, P.y - e.y) < e.r + 10) {
          e.shieldUp = false; e.shieldT = rage ? 3 : 3.8;
          X.burst(e.x, e.y, 30, ['#a0ff60', '#fff'], 90); X.V.SND.shell(); X.shake(.3);
          X.V.ui.toast(X.up(X.t('toast.shieldBroken')), '#a0ff60'); X.V.meta.event('shield');
        }
        if (!X.S.seenBugHint && X.inside && e.t > 2) { X.S.seenBugHint = true; X.V.ui.toast(X.up(X.t('toast.dashShield')), '#a0ff60'); }
      } else {
        e.shieldT -= X.dt;
        if (e.shieldT <= 0) { e.shieldUp = true; X.burst(e.x, e.y, 20, ['#a0ff60', '#205a00'], 60); X.V.SND.shell(); for (let i = 0; i < 18; i++) X.toxin(e.x, e.y, e.t + i * TAU / 18, 48); }
      }
      e.invuln = e.shieldUp; e.dmgMul = e.shieldUp ? 1 : 1.5;   // exposed, it takes extra damage
      if (e.state === 'tele') { X.tx = X.ty = 0; e.st -= X.dt; if (e.st <= 0) { e.state = 'dash'; e.st = .6; e.cx = X.ux; e.cy = X.uy; } }
      else if (e.state === 'dash') {
        X.snap = true; X.tx = e.cx * 150; X.ty = e.cy * 150; e.st -= X.dt;
        if (e.st <= 0 || e.x < 14 || e.x > X.W - 14) { e.state = 'move'; e.cd = X.rnd(2.2, 3.2) * X.D.fire; for (let i = 0; i < 8; i++) X.toxin(e.x, e.y, i * TAU / 8 + e.t, 50); }
      } else {
        const s = X.d > 60 ? 1 : -.5;
        X.tx = X.ux * e.spd * s - X.uy * e.spd * .5; X.ty = X.uy * e.spd * s + X.ux * e.spd * .5;
        e.cd -= X.dt;
        if (e.cd <= 0 && X.inside) { e.state = 'tele'; e.st = .7; X.V.SND.charge(); }
      }
      e.fire -= X.dt;
      if (e.fire <= 0 && X.inside && e.state !== 'tele') { e.fire = (rage ? .9 : 1.2) * X.D.fire; const n = rage ? 5 : 3; for (let i = 0; i < n; i++) X.toxin(e.x, e.y, X.aimA + (i - (n - 1) / 2) * .18, 62); X.V.SND.bossShot(); }
    },
    sepsis(e, X) {   // the vessel closes in; every quarter of its health you take opens it back up
      const P = X.P, S = X.S, rage = e.hp < e.maxHp / 2;
      X.tx = (X.W - 40) - e.x; X.ty = X.clamp((P.y - e.y) * .5, -e.spd, e.spd);
      if (X.inside) S.sq = Math.min(28, (S.sq || 0) + X.dt * (rage ? 2.2 : 1.6));
      while (e.hp > 0 && e.relax.length && e.hp / e.maxHp < e.relax[0]) { e.relax.shift(); S.sq = 0; X.shake(.3); X.burst(e.x, e.y, 24, X.V.PCOL.sepsis, 70); X.V.SND.clear(); }
      e.spin += X.dt * (rage ? 1.4 : 1);
      e.fire -= X.dt;
      if (e.fire <= 0 && X.inside) { e.fire = (rage ? .35 : .45) * X.D.fire; for (let i = 0; i < 2; i++) X.toxin(e.x, e.y, e.spin + i * Math.PI, 46); }
      e.aim -= X.dt;
      if (e.aim <= 0 && X.inside) { e.aim = (rage ? 1.3 : 1.8) * X.D.fire; for (let i = -2; i <= 2; i++) X.toxin(e.x, e.y, X.aimA + i * .15, 60); X.V.SND.bossShot(); }
    },
  });
  Object.assign(V.ON_SPAWN, {
    twins: (e, S) => { if (!S.enemies.some(o => o.type === 'twins2' && o.hp > 0)) { const b = V.game.X.spawn('twins2', e.x + 16, e.y + 20); b.enrageAt = undefined; } },
  });
  const twinDown = (e, X) => {
    const mate = X.S.enemies.find(o => o !== e && (o.type === 'twins' || o.type === 'twins2') && o.hp > 0);
    if (mate) { mate.mateDead = e.type; mate.mateMax = e.maxHp; mate.revT = 8; X.V.ui.toast(X.up(X.t('toast.twinDown')), '#ffc040'); }
  };
  Object.assign(V.ON_KILL, {
    twins: twinDown, twins2: twinDown,
    cholera: (e, X) => { X.S.flowX = 0; },
    sepsis: (e, X) => { X.S.sq = 0; },
  });

  Object.assign(V.DRAW, {
    anthrax(ctx, e, { R }) {   // red telegraph lines that turn solid just before they fire
      for (const L of e.lines) {
        if (L.fired) continue;
        const late = L.t > .6;
        if (late && Math.floor(L.t * 20) % 2) continue;
        ctx.fillStyle = late ? '#ff4a4a' : '#8a1a2a';
        if (L.horiz) for (let x = 0; x < V.W; x += late ? 2 : 4) ctx.fillRect(x, R(L.pos), 1, 1);
        else for (let y = V.TOP; y < V.BOT; y += late ? 2 : 4) ctx.fillRect(R(L.pos), y, 1, 1);
      }
    },
    cholera(ctx, e) {   // current arrows streaming across the vessel (blinking while it's about to change)
      const S = V.G.S, dir = S.flowX ? Math.sign(S.flowX) : e.warn ? e.flowDir : 0;
      if (!dir || (e.warn && Math.floor(e.t * 8) % 2)) return;
      ctx.fillStyle = e.warn ? '#b0f0ff' : '#3a8aa8';
      const off = (V.G.clock * 40 * dir) % 32;
      for (let y = V.TOP + 16; y < V.BOT - 8; y += 24) for (let x = -32; x < V.W + 32; x += 32) {
        const ax = R(x + off), ay = y + ((x / 32) % 2 ? 12 : 0);
        ctx.fillRect(ax, ay, 4, 1); ctx.fillRect(ax + (dir > 0 ? 3 : 0), ay - 1, 1, 3);
      }
    },
    superbug(ctx, e, { ring }) {
      if (e.shieldUp) { ctx.globalAlpha = .7; ring(e.x, e.y, e.r + 5, 18, '#a0ff60', e.t * 2); ring(e.x, e.y, e.r + 7, 12, '#e0ffc0', -e.t * 1.5); ctx.globalAlpha = 1; }
      else if (Math.floor(e.t * 6) % 2) ring(e.x, e.y, e.r + 4, 10, '#ff4a4a', e.t);
    },
    sepsis(ctx) {   // inflamed tissue closing in from both walls
      const sq = V.G.S.sq || 0; if (sq < .5) return;
      ctx.fillStyle = '#5a0a1a'; ctx.globalAlpha = .85;
      ctx.fillRect(0, V.TOP, V.W, R(sq)); ctx.fillRect(0, R(V.BOT - sq), V.W, R(sq));
      ctx.globalAlpha = 1; ctx.fillStyle = '#c02040';
      for (let x = 0; x < V.W; x += 3) { const w = Math.sin(x * .4 + V.G.clock * 3) > 0 ? 1 : 0; ctx.fillRect(x, R(V.TOP + sq) - w, 2, 1); ctx.fillRect(x, R(V.BOT - sq) + w - 1, 2, 1); }
    },
    twins(ctx, e, { ring }) { if (e.mateDead) ring(e.x, e.y, 6 + e.revT * 3, 20, '#ffc040', e.t); },
    twins2(ctx, e, { ring }) { if (e.mateDead) ring(e.x, e.y, 6 + e.revT * 3, 20, '#f0f0e0', e.t); },
  });
})();
