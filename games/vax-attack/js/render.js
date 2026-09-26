// Draws one frame onto the 256×160 canvas, which CSS scales up with crisp pixels.
(() => {
  const V = window.VAX;
  const { W, H, TOP, BOT, TAU, rnd, SPR } = V;
  const G = V.G;
  const ctx = document.getElementById('game').getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const R = Math.round;
  const clamp01 = v => Math.min(1, Math.max(0, v));

  const draw = (img, x, y, flip) => {
    const px = R(x - img.width / 2), py = R(y - img.height / 2);
    if (!flip) return ctx.drawImage(img, px, py);
    ctx.save(); ctx.translate(px + img.width, py); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0); ctx.restore();
  };
  const FLIPPABLE = new Set(['bact', 'mini', 'salmo', 'plague', 'pseudo', 'tb', 'rabies', 'botulist', 'borrelia', 'tetanus', 'klebs', 'trypan']);

  // the chosen body location (a Wardrobe cosmetic)
  const background = () => V.cos.background(ctx, V.cos.current, G.cells, G.flecks, G.clock);
  const walls = () => V.cos.walls(ctx, V.cos.current, G.clock);

  // Blinking arrows on the screen edge for pathogens that haven't arrived yet.
  function incoming(S) {
    if (Math.floor(G.clock * 6) % 2) return;
    for (const e of S.enemies) {
      if ((e.x >= 0 && e.x <= W) || e.state === 'hidden') continue;
      const left = e.x < 0, y = R(Math.min(Math.max(e.y, TOP + 4), BOT - 4));
      ctx.fillStyle = V.PCOL[e.type][0];
      const x = left ? 1 : W - 2, dir = left ? 1 : -1;
      ctx.fillRect(x, y - 2, 1, 5);
      ctx.fillRect(x - dir, y - 1, 1, 3);
      ctx.fillRect(x - dir * 2, y, 1, 1);
      if (e.boss) { ctx.fillRect(x + dir * 2, y - 2, 1, 5); }
    }
  }

  const RH = {};
  function ring(x, y, r, n, col, spin = 0) {
    ctx.fillStyle = col;
    for (let i = 0; i < n; i++) { const a = i * TAU / n + spin; ctx.fillRect(R(x + Math.cos(a) * r), R(y + Math.sin(a) * r), 1, 1); }
  }

  Object.assign(RH, { draw, ring, R });

  // ---------- light: pre-rendered soft glows, drawn additively; a vignette; a low-health pulse ----------
  const glowCache = new Map();
  function glowSprite(col, r) {
    const key = col + r;
    let c = glowCache.get(key);
    if (!c) {
      c = document.createElement('canvas'); c.width = c.height = r * 2 + 1;
      const g = c.getContext('2d'), gr = g.createRadialGradient(r + .5, r + .5, 0, r + .5, r + .5, r + .5);
      gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
      glowCache.set(key, c);
    }
    return c;
  }
  const glowAt = (x, y, col, r, a) => { ctx.globalAlpha = a; ctx.drawImage(glowSprite(col, r), R(x - r), R(y - r)); };
  const edgeShade = (inner, col) => {
    const c = document.createElement('canvas'); c.width = W; c.height = BOT - TOP;
    const g = c.getContext('2d'), gr = g.createRadialGradient(W / 2, c.height / 2, c.height * inner, W / 2, c.height / 2, W * .62);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, col); g.fillStyle = gr; g.fillRect(0, 0, W, c.height);
    return c;
  };
  const VIGNETTE = edgeShade(.45, 'rgba(0,0,0,0.55)'), DANGER = edgeShade(.35, 'rgba(255,20,50,0.75)');
  function glowPass(S, P) {
    if (!V.ui.glow) return;
    ctx.globalCompositeOperation = 'lighter';
    for (const e of S.enemies) {
      if (e.hp <= 0 || V.game.hiddenOrCloaked(e)) continue;
      if (e.boss) glowAt(e.x, e.y, V.PCOL[e.type][0], R(e.r + 12), .2 + .06 * Math.sin(e.t * 3));
      else if (e.elite || e.mutant) glowAt(e.x, e.y, e.mutant ? '#ff2040' : '#ffd23a', R(e.r + 6), .28);
    }
    for (const t of S.toxins) glowAt(t.x, t.y, '#ff3050', 4, .32);
    for (const k of S.pickups) glowAt(k.x, k.y, V.POW[k.kind].color, 9, .3 + .12 * Math.sin(k.t * 5));
    for (const o of S.orbs) glowAt(o.x, o.y, '#ffd23a', 3, .35);
    for (const b of S.bullets) glowAt(b.x, b.y, b.crit ? '#ffe080' : b.pierce ? '#ff7ac8' : b.homing ? '#b080ff' : '#60e0d0', b.big ? 6 : 4, .42);
    if (P.hp > 0) {
      glowAt(P.x, P.y, '#7fe0d4', 13, .16);
      if (G.clock - (P.shotAt ?? -9) < .05) glowAt(P.x + Math.cos(P.aim) * 9, P.y + Math.sin(P.aim) * 9, '#ffffff', 5, .55);   // muzzle flash
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
  // expanding shockwave rings: deaths, dashes, pickups
  function rings(S) {
    if (!S.rings?.length) return;
    S.rings = S.rings.filter(r => G.clock - r.at < (r.big ? .6 : .28));
    for (const r of S.rings) {
      const life = r.big ? .6 : .28, k = (G.clock - r.at) / life, rad = r.r + k * (r.big ? 40 : 10);
      ctx.globalAlpha = (1 - k) * .9; ring(r.x, r.y, rad, Math.max(8, R(rad * 2.2)), r.col, 0);
      if (r.big) ring(r.x, r.y, rad * .7, Math.max(8, R(rad * 1.6)), '#ffffff', 0);
    }
    ctx.globalAlpha = 1;
  }
  // the final five: the vessel goes dark, hazard stripes roll, the heart pounds, and a silhouette flickers in
  function bossIntro(I) {
    const fadeIn = Math.min(1, I.t / .6), fadeOut = Math.min(1, Math.max(0, (I.dur - I.t) / .4)), k = fadeIn * fadeOut, last = I.type === 'zero';
    ctx.fillStyle = '#000'; ctx.globalAlpha = .6 * k; ctx.fillRect(0, TOP, W, BOT - TOP);
    // heartbeat vignette on the edges
    const pulse = Math.max(0, Math.sin(I.t * (5 + I.t * 1.6))) * k;
    ctx.fillStyle = last ? '#ff1030' : '#c01030';
    for (let i = 0; i < 6; i++) { ctx.globalAlpha = pulse * (.5 - i * .08); ctx.fillRect(0, TOP + i, W, 1); ctx.fillRect(0, BOT - 1 - i, W, 1); ctx.fillRect(i, TOP, 1, BOT - TOP); ctx.fillRect(W - 1 - i, TOP, 1, BOT - TOP); }
    // rolling hazard stripes
    ctx.globalAlpha = .85 * k;
    const off = Math.floor(I.t * 24) % 8;
    for (const y0 of [TOP + 8, BOT - 14]) for (let y = 0; y < 6; y++) for (let x = -16 + off - y; x < W + 8; x += 8) { ctx.fillStyle = '#ffcc30'; ctx.fillRect(x, y0 + y, 4, 1); ctx.fillStyle = '#1a0a0a'; ctx.fillRect(x + 4, y0 + y, 4, 1); }
    // the boss's silhouette, three times life size
    const spr = SPR[I.type + 'W']?.[0];
    if (spr) {
      ctx.globalAlpha = k * (.12 + .1 * Math.abs(Math.sin(I.t * (last ? 23 : 11))));
      const s = 3, jx = last ? Math.round(Math.sin(I.t * 57) * 2) : 0;
      ctx.drawImage(spr, R(W / 2 - spr.width * s / 2) + jx, R(H / 2 - spr.height * s / 2), spr.width * s, spr.height * s);
    }
    // Patient Zero: glitching scanlines
    if (last) { ctx.fillStyle = '#ff3040'; for (let i = 0; i < 4; i++) { const y = TOP + ((Math.floor(I.t * 30) * 37 + i * 53) % (BOT - TOP)); ctx.globalAlpha = .35 * k; ctx.fillRect(0, y, W, 1); } }
    ctx.globalAlpha = 1;
  }

  function player(P) {
    if (G.mode === 'title' || P.hp <= 0) return;
    // dash afterimages
    for (const g of G.S.ghosts) { ctx.globalAlpha = g.life * 1.6; draw(SPR.player, g.x, g.y); }
    ctx.globalAlpha = 1;
    if (P.inv > 0 && Math.floor(P.inv * 12) % 2) return;
    const recoil = Math.max(0, .06 - (G.clock - (P.shotAt ?? -9))) / .06;   // a tiny kick back with every shot
    const py = P.y + (Math.floor(P.bob * 3) % 2) - Math.sin(P.aim) * recoil * 1.2, pxr = P.x - Math.cos(P.aim) * recoil * 1.2;
    if (P.fx.fever > 0) {
      ctx.globalAlpha = .35 + .15 * Math.sin(G.clock * 10);
      ring(P.x, P.y, 30, 40, '#ff4a2a', G.clock * .8); ring(P.x, P.y, 28, 24, '#ffe066', -G.clock);
      ctx.globalAlpha = 1;
    }
    if (P.dashT > 0) {
      const f = 1 - P.dashT / V.DASH.cd;
      ctx.fillStyle = '#3b1020'; ctx.fillRect(R(P.x) - 5, R(py) + 9, 10, 1);
      ctx.fillStyle = '#7fe0d4'; ctx.fillRect(R(P.x) - 5, R(py) + 9, R(10 * f), 1);
    }
    if (P.shield > 0) {
      ctx.fillStyle = '#7fe0d4'; ctx.globalAlpha = .55 + .2 * Math.sin(G.clock * 8);
      for (let i = 0; i < 20; i++) { const a = i * TAU / 20 + G.clock; ctx.fillRect(R(P.x + Math.cos(a) * 10), R(py + Math.sin(a) * 10), 1, 1); }
      if (P.shield > 1) for (let i = 0; i < 12; i++) { const a = i * TAU / 12 - G.clock; ctx.fillRect(R(P.x + Math.cos(a) * 12), R(py + Math.sin(a) * 12), 1, 1); }
      ctx.globalAlpha = 1;
    }
    if (P.fx.speed > 0 && Math.floor(G.clock * 10) % 2) { ctx.fillStyle = '#9cf04a'; ctx.fillRect(R(P.x) - 7, R(py) + 2, 2, 1); ctx.fillRect(R(P.x) - 8, R(py) + 5, 2, 1); }
    if (V.ui.glow) { ctx.fillStyle = '#000'; ctx.globalAlpha = .25; ctx.fillRect(R(P.x) - 4, R(P.y) + 7, 8, 1); ctx.globalAlpha = 1; }
    draw(SPR.player, pxr, py);
    if (G.clock - (P.shotAt ?? -9) < .035) { ctx.fillStyle = '#ffffff'; ctx.fillRect(R(P.x + Math.cos(P.aim) * 8) - 1, R(P.y + Math.sin(P.aim) * 8) - 1, 2, 2); }
    // aim pip: where the next shot goes
    ctx.fillStyle = P.fx.pierce > 0 ? '#ff7ac8' : '#c8fff6';
    for (const r of [10, 12]) ctx.fillRect(R(P.x + Math.cos(P.aim) * r), R(P.y + Math.sin(P.aim) * r), 1, 1);
  }

  function overlayHud(S, P) {
    // combo meter
    if (S.combo >= 5) {
      const m = V.game.comboMult(), label = 'x' + m;
      V.pixText(ctx, label, 4, TOP + 3, '#ffe066');
      V.pixText(ctx, 'COMBO', 4 + V.pixWidth(label) + 3, TOP + 3, '#f6e7d0');
      ctx.fillStyle = '#3b1020'; ctx.fillRect(4, TOP + 10, 30, 1);
      ctx.fillStyle = '#ffe066'; ctx.fillRect(4, TOP + 10, R(30 * Math.max(0, S.comboT) / 2.5), 1);
    }
    // boss health
    if (S.hurtFlash > 0) {   // a red (or, for a shield block, teal) flash that fades from the edges in
      ctx.fillStyle = S.flashCol || '#ff2040';
      for (let i = 0; i < 10; i++) { ctx.globalAlpha = S.hurtFlash * (.55 - i * .05); ctx.fillRect(0, TOP + i, W, 1); ctx.fillRect(0, BOT - 1 - i, W, 1); ctx.fillRect(i, TOP, 1, BOT - TOP); ctx.fillRect(W - 1 - i, TOP, 1, BOT - TOP); }
      ctx.globalAlpha = S.hurtFlash * .12; ctx.fillRect(0, TOP, W, BOT - TOP); ctx.globalAlpha = 1;
    }
    // Stasis: everything frozen blue; Toxoplasma: scrambled purple edges
    if (P.fx.stasis > 0) { ctx.fillStyle = '#80c8ff'; ctx.globalAlpha = .14 + .05 * Math.sin(G.clock * 8); ctx.fillRect(0, TOP, W, BOT - TOP); ctx.globalAlpha = 1; }
    if (P.confT > 0) { ctx.fillStyle = '#b060e0'; for (let i = 0; i < 6; i++) { ctx.globalAlpha = (.35 - i * .05) * Math.min(1, P.confT); const o = Math.round(Math.sin(G.clock * 20 + i) * 2); ctx.fillRect(0 + o, TOP + i, W, 1); ctx.fillRect(0 - o, BOT - 1 - i, W, 1); } ctx.globalAlpha = 1; }
    if (S.intro) bossIntro(S.intro);
    const boss = S.enemies.find(e => e.boss);
    if (boss) {
      ctx.fillStyle = '#140810'; ctx.fillRect(W / 2 - 51, TOP + 3, 102, 5);
      ctx.fillStyle = V.PCOL[boss.type][0];
      // the Hydra's bar counts every piece plus the pieces they'll still split into (H → 2×H/2 → 4×H/4)
      const Hq = (S.hydraMax || 1) / 3, future = [2 * Hq, Hq / 2, 0];
      const linked = V.LINKED?.[boss.type] ? S.enemies.filter(e => e.type === boss.type || V.LINKED[boss.type].includes(e.type)) : null;
      const frac = linked ? linked.reduce((a, e) => a + Math.max(0, e.hp), 0) / linked.reduce((a, e) => a + e.maxHp, 0) || 0
        : boss.type === 'hydra' && S.hydraMax
        ? S.enemies.filter(e => e.type === 'hydra' && e.hp > 0).reduce((a, e) => a + e.hp + future[e.gen], 0) / S.hydraMax
        : Math.max(0, boss.hp) / boss.maxHp;
      // a white chunk trails behind the bar, so every big hit reads at a glance
      boss.barLag = Math.max(frac, (boss.barLag ?? frac) - Math.max(.002, ((boss.barLag ?? frac) - frac) * .06));
      const jig = boss.flash > 0 ? 1 : 0, col = ctx.fillStyle;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(W / 2 - 50 + jig, TOP + 4, Math.ceil(100 * clamp01(boss.barLag)), 3);
      ctx.fillStyle = col; ctx.fillRect(W / 2 - 50 + jig, TOP + 4, Math.ceil(100 * clamp01(frac)), 3);
      ctx.fillStyle = '#fff'; ctx.fillRect(W / 2, TOP + 3, 1, 5);   // the rage mark: past half health, bosses fight harder
    }
    // last-heart warning
    if (P.hp === 1 && G.mode === 'play' && Math.floor(G.clock * 3) % 2) {
      ctx.fillStyle = '#ff5a6e'; ctx.globalAlpha = .5;
      ctx.fillRect(0, TOP, W, 1); ctx.fillRect(0, BOT - 1, W, 1); ctx.fillRect(0, TOP, 1, BOT - TOP); ctx.fillRect(W - 1, TOP, 1, BOT - TOP);
      ctx.globalAlpha = 1;
    }
  }

  function controls() {
    const I = V.input;
    if (G.mode !== 'play') return;
    // bot mode: a faint dotted line shows exactly what the bot is aiming at
    if (G.bot && I.mouse.down && G.P) {
      const P = G.P, dx = I.mouse.x - P.x, dy = I.mouse.y - P.y, d = Math.hypot(dx, dy) || 1;
      ctx.globalAlpha = .35; ctx.fillStyle = '#7fe0d4';
      for (let r = 16; r < d - 4; r += 5) ctx.fillRect(R(P.x + dx / d * r), R(P.y + dy / d * r), 1, 1);
      ctx.globalAlpha = 1;
    }
    if (!I.touchMode && I.mouse.seen) {
      const x = R(I.mouse.x), y = R(I.mouse.y);
      ctx.fillStyle = I.mouse.down ? '#ffffff' : '#7fe0d4';
      ctx.fillRect(x - 3, y, 2, 1); ctx.fillRect(x + 2, y, 2, 1); ctx.fillRect(x, y - 3, 1, 2); ctx.fillRect(x, y + 2, 1, 2);
    }
    for (const [j, col] of [[I.moveJoy, '#7fe0d4'], [I.aimJoy, '#ff7ac8']]) {
      if (!j) continue;
      ctx.globalAlpha = .35; ctx.fillStyle = '#f6e7d0';
      ctx.fillRect(R(j.ox) - 1, R(j.oy) - 1, 3, 3);
      ctx.globalAlpha = .7; ctx.fillStyle = col;
      ctx.fillRect(R(j.ox + j.dx) - 2, R(j.oy + j.dy) - 2, 5, 5);
      ctx.globalAlpha = 1;
    }
  }

  V.render = () => {
    const { S, P } = G;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (S && (G.mode === 'play' || G.mode === 'dying')) {
      // shake fades out as it runs down, plus a directional jolt when you're hit
      const amp = S.shake > 0 && V.ui.shake ? Math.min(3, .8 + S.shake * 5) : 0;
      S.kickX = (S.kickX || 0) * .8; S.kickY = (S.kickY || 0) * .8;
      const ox = amp * Math.sin(G.clock * 97) + (V.ui.shake ? S.kickX : 0), oy = amp * Math.cos(G.clock * 83) + (V.ui.shake ? S.kickY : 0);
      if (ox || oy) ctx.translate(R(ox), R(oy));
    }
    background();

    if (S) {
      for (const k of S.pickups) {
        if (k.t > 8.5 && Math.floor(k.t * 8) % 2) continue;
        const y = k.y + R(Math.sin(k.t * 4));
        if (Math.floor(k.t * 3) % 2) { ctx.fillStyle = V.POW[k.kind].color; ctx.globalAlpha = .25; ctx.fillRect(R(k.x) - 5, R(y) - 5, 11, 11); ctx.globalAlpha = 1; }
        draw(SPR[k.kind], k.x, y);
      }
      // Norovirus landing spots: a blinking gold ring where it's about to appear
      for (const e of S.enemies) {
        if (e.state !== 'tele' || !(Math.floor(e.t * 10) % 2)) continue;
        if (e.type === 'noro') ring(e.tx, e.ty, 6, 12, '#e8b43a');
        if (e.type === 'phantom') { ring(e.tx, e.ty, 12, 20, '#a898ff'); ring(e.tx, e.ty, 6, 10, '#ff6ad0', e.t); }
        if (e.type === 'shifter') { ring(e.tx, e.ty, 11, 18, '#60e070'); ring(e.tx, e.ty, 5, 8, '#fff', -e.t); }
      }
      // Tetanus sniper sights: a dotted laser that tracks you, then flashes when it locks
      for (const e of S.enemies) {
        if (e.type !== 'tetanus' || e.state !== 'aim') continue;
        const locked = e.st <= .3, cx = Math.cos(e.la), cy = Math.sin(e.la);
        if (locked && Math.floor(e.t * 20) % 2) continue;
        ctx.fillStyle = locked ? '#ff4a4a' : '#a02030';
        for (let d = 6; d < 260; d += locked ? 3 : 5) ctx.fillRect(R(e.x + cx * d), R(e.y + cy * d), 1, 1);
      }
      // soft shadows give everything a bit of depth
      if (V.ui.glow) {
        ctx.fillStyle = '#000'; ctx.globalAlpha = .2;
        for (const e of S.enemies) {
          if (e.hp <= 0 || V.game.cloaked(e) || e.air || e.state === 'hidden' || e.x < -12 || e.x > W + 12) continue;
          const w = Math.max(3, R(e.r * 1.6)); ctx.fillRect(R(e.x - w / 2), R(e.y + e.r * .85), w, e.r > 6 ? 2 : 1);
        }
        ctx.globalAlpha = 1;
      }
      // Coronavirus crowns: a faint aura showing who they're speeding up
      for (const e of S.enemies) if (e.type === 'corona') { ctx.globalAlpha = .35; ring(e.x, e.y, 36, 28, '#e0a040', e.t * .5); ctx.globalAlpha = 1; }
      for (const e of S.enemies) {
        const tele = e.state === 'tele' && Math.floor(e.t * 12) % 2;
        let key = e.type;
        if (key === 'strep' && !e.leader) key = 'strepHead';
        if (e.state === 'hidden') key = 'plasmoHidden';
        if (key === 'colossus') key = 'colossus' + Math.min(3, e.stage);
        if (key === 'hydra') key = 'hydra' + e.gen;
        if (key === 'shifter') key = 'shifter' + (e.phase || 0);
        if (V.SKEY?.[key]) key = V.SKEY[key](e);
        const lit = e.flash > 0 || tele || (e.invT > 0 && Math.floor(e.t * 16) % 2);
        const set = lit ? SPR[key + 'W'] : (e.mutant && SPR[key + 'M']) || SPR[key];
        // the Filament's beaded body, tail first so the head sits on top
        if (e.segPts) {
          const seg = lit ? SPR.ebolaSegW : SPR.ebolaSeg;
          for (let i = e.segPts.length - 1; i >= 0; i--) draw(seg[Math.floor(e.t * 4 + i) % 2], e.segPts[i][0], e.segPts[i][1]);
        }
        // only turn around on a clear change of direction, so wobbling rods don't flicker
        if (Math.abs(e.vx) > 4) e.face = e.vx < 0;
        if (e.type === 'klebs') e.face = Math.cos(e.faceA) < 0;
        if (e.finalForm) { ctx.globalAlpha = .55 + .35 * Math.sin(e.t * 9); ring(e.x, e.y, e.r + 7, 22, '#ff3040', e.t * 3); ring(e.x, e.y, e.r + 10, 16, '#ffb0b8', -e.t * 2); ctx.globalAlpha = 1; }
        // mutants: a crimson spiked double ring
        if (e.mutant) { ring(e.x, e.y, e.r + 4, 10, '#ff2040', e.t * 3); ring(e.x, e.y, e.r + 6, 10, '#ff90a0', -e.t * 2); }
        if (e.buffed && Math.floor(e.t * 6) % 3 === 0) { ctx.fillStyle = '#ffe0a0'; ctx.fillRect(R(e.x + Math.cos(e.t * 9) * (e.r + 2)), R(e.y - e.r - 2), 1, 1); }        // elites wear a spinning golden halo
        if (e.elite && !V.game.hiddenOrCloaked(e)) { ctx.globalAlpha = .6 + .3 * Math.sin(e.t * 6); ring(e.x, e.y, e.r + 4, 12, '#ffd23a', e.t * 2); ctx.globalAlpha = 1; }
        if (e.lift) { ctx.fillStyle = '#0a0408'; ctx.globalAlpha = .6; ctx.fillRect(R(e.x) - 3, R(e.y) + 2, 7, 2); ctx.globalAlpha = 1; }   // shadow under a leaping phage
        if (V.game.cloaked(e) && !e.air) ctx.globalAlpha = e.under ? 0 : .16;
        if (e.state === 'hidden' && V.cos.current.id !== 'blood') ctx.globalAlpha = V.cos.current.alpha;   // blend in with the local cells
        const img = set[Math.floor(e.t * 4) % 2], hitK = e.hitAt ? Math.max(0, .1 - (G.clock - e.hitAt)) / .1 : 0, popK = Math.min(1, (G.clock - (e.born ?? -9)) / .2);
        if (hitK > 0 || popK < 1) {   // squash when hit, pop in when it appears
          const q = e.boss ? .25 : 1, sc = .4 + popK * .6, sx = (1 + hitK * .3 * q) * sc, sy = (1 - hitK * .22 * q) * sc, w = img.width * sx, h = img.height * sy;
          ctx.drawImage(img, R(e.x - w / 2), R(e.y - (e.lift || 0) - h / 2), R(w), R(h));
        } else draw(img, e.x, e.y - (e.lift || 0), FLIPPABLE.has(e.type) && e.face);
        ctx.globalAlpha = 1;
        V.DRAW?.[e.type]?.(ctx, e, RH);
        ctx.globalAlpha = 1;
        // small health bar on tougher pathogens once they've been hurt
        if (V.ui.hpbars && !e.boss && e.maxHp >= 3 && e.hp < e.maxHp && !V.game.hiddenOrCloaked(e) && !e.leader) {
          const w = Math.min(12, R(e.r * 2 + 2)), bx = R(e.x - w / 2), by = R(e.y - e.r - 5);
          ctx.fillStyle = '#140810'; ctx.fillRect(bx - 1, by - 1, w + 2, 3);
          ctx.fillStyle = V.PCOL[e.type][0]; ctx.fillRect(bx, by, Math.max(1, R(w * e.hp / e.maxHp)), 1);
        }
        // Klebsiella's capsule: an arc on the side it's facing
        if (e.type === 'klebs') {
          ctx.fillStyle = '#ffe8e0';
          for (let a = -1.2; a <= 1.2; a += .3) ctx.fillRect(R(e.x + Math.cos(e.faceA + a) * (e.r + 3)), R(e.y + Math.sin(e.faceA + a) * (e.r + 3)), 1, 1);
        }
        // Measles Monarch's shield-virions
        if (e.guards) for (const g of e.guards) if (g.alive) { const gs = (e.guardSpr || 'measlesSat') + (g.sero ?? ''); draw((g.flash > 0 ? SPR[gs + 'W'] : SPR[gs])[Math.floor(e.t * 4) % 2], g.x, g.y); }
        if (e.shell > 0) {
          const big = e.type === 'tb' || e.type === 'megavirus', rr = e.type === 'megavirus' ? 19 : 17;
          ctx.globalAlpha = .45 + .45 * (e.shell / e.shellMax);
          ring(e.x, e.y, big ? rr : 8, big ? rr * 2 : 14, big ? (e.type === 'tb' ? '#f0e8d8' : '#c0ffc0') : '#8fe0a0', e.t);
          if (big) ring(e.x, e.y, rr - 2, rr * 1.5, e.type === 'tb' ? '#c8b8a0' : '#60c060', -e.t);
          ctx.globalAlpha = 1;
        }
      }
      V.drawExtras?.(ctx, S, P, RH);   // walls, possessed hosts, drone, vortex, reflective coat (expansion4-ai.js)
      // macrophage allies (temporary ones flicker in their last 2 seconds)
      for (const A of S.allies) {
        if (!A.perm && P.fx.macro < 2 && Math.floor(G.clock * 8) % 2) continue;
        draw(SPR.macroAlly[Math.floor(A.t * 3) % 2], A.x, A.y);
        ctx.fillStyle = '#6a5ac8'; ctx.fillRect(R(A.x) - 1, R(A.y) - 1, 2, 2);
      }
      glowPass(S, P);
      rings(S);
      for (const t of S.toxins) draw(t.gas ? SPR.gas[Math.floor(t.life * 3) % 2] : t.para ? SPR.paraShot : t.confuse ? SPR.confShot : t.flung ? SPR.flungShot : t.dust ? SPR.dust[Math.floor(t.life * 3) % 2] : SPR.toxin, t.x, t.y);
      // Botulist mines blink faster as the fuse runs down
      for (const m of S.mines) { const left = m.fuse - m.t; draw(SPR.mine[Math.floor(m.t * (left < .6 ? 14 : 5)) % 2], m.x, m.y); if (left < .6) ring(m.x, m.y, 7, 10, '#ff4a2a'); }
      player(P);
      if (P.hp > 0) for (const [ox, oy, temp] of V.game.orbs(P)) {
        if (temp && P.fx.neutro < 2 && Math.floor(G.clock * 8) % 2) continue;
        draw(SPR.orb, ox, oy);
      }
      for (const o of S.orbs) draw(SPR.atpOrb[Math.floor(o.t * 6) % 2], o.x, o.y);
      for (const f of S.phages) draw(SPR.phageShot[Math.floor(f.t * 8) % 2], f.x, f.y);
      // homing antibodies leave a short purple trail, so you can always tell when shots are steering themselves
      for (const b of S.bullets) if (b.homing) { const l = Math.hypot(b.vx, b.vy) || 1; for (let k = 1; k <= 3; k++) { ctx.globalAlpha = .5 - k * .13; ctx.fillStyle = '#b080ff'; ctx.fillRect(R(b.x - b.vx / l * k * 2.5), R(b.y - b.vy / l * k * 2.5), 1, 1); } ctx.globalAlpha = 1; }
      if (S.zaps) { ctx.fillStyle = '#b0e0ff'; for (const z of S.zaps) { const n = Math.ceil(Math.hypot(z.x2 - z.x1, z.y2 - z.y1) / 2); for (let k = 0; k <= n; k++) { const f = k / n; ctx.fillRect(R(z.x1 + (z.x2 - z.x1) * f + (Math.random() - .5) * 3), R(z.y1 + (z.y2 - z.y1) * f + (Math.random() - .5) * 3), 1, 1); } } }
      for (const b of S.bullets) draw(b.big ? SPR.shotBig : b.pierce ? SPR.shotP : b.il2 ? SPR.shotIL : b.homing ? SPR.shotH : b.bounce ? SPR.shotB : SPR.shot, b.x, b.y);
      // expansion power-ups: Booster Clone, Antibody Halo, NK Cell
      if (P.hp > 0 && P.fx.clone > 0) { const c = V.game.clonePos(P); ctx.globalAlpha = P.fx.clone < 2 && Math.floor(G.clock * 8) % 2 ? .25 : .55; draw(SPR.player, c.x, c.y); ctx.globalAlpha = 1; }
      if (P.hp > 0 && P.fx.halo > 0) for (const [x, y] of V.game.haloPts(P)) { if (P.fx.halo < 2 && Math.floor(G.clock * 8) % 2) break; draw(SPR.haloOrb, x, y); }
      if (S.nk) draw(SPR.nkCell[Math.floor(S.nk.t * 5) % 2], S.nk.x, S.nk.y);
      for (const p of S.parts) { ctx.fillStyle = p.col; ctx.globalAlpha = Math.min(1, p.life * 4); const s = p.big && p.life > .25 ? 2 : 1; ctx.fillRect(R(p.x), R(p.y), s, s); }
      ctx.globalAlpha = 1;
      if (V.ui.popups) for (const f of S.floaters) V.pixText(ctx, f.text, R(f.x - V.pixWidth(f.text) / 2), R(f.y - f.t * 14), f.col);
    }

    if (P && P.fx.freeze > 0) {
      ctx.globalAlpha = .1; ctx.fillStyle = '#bfe8ff'; ctx.fillRect(0, TOP, W, BOT - TOP); ctx.globalAlpha = 1;
    }
    if (S && V.ui.glow) { ctx.globalAlpha = .7; ctx.drawImage(VIGNETTE, 0, TOP); ctx.globalAlpha = 1; }
    if (S && P && P.hp === 1 && G.mode === 'play') { ctx.globalAlpha = .35 + .3 * Math.max(0, Math.sin(G.clock * 7)); ctx.drawImage(DANGER, 0, TOP); ctx.globalAlpha = 1; }   // heartbeat
    walls();
    if (P && P.fx.freeze > 0) {
      ctx.fillStyle = '#dff4ff';
      for (let x = 0; x < W; x += 3) { const h = 1 + ((x * 7) % 3); ctx.fillRect(x, TOP, 1, h); ctx.fillRect(x + 1, BOT - h, 1, h); }
    }
    if (S) { incoming(S); overlayHud(S, P); }
    controls();
  };
})();
