// Every sprite is generated in code at load time — no image files.
(() => {
  const V = window.VAX;
  const { TOP } = V;

  function mk(w, h, fn) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    fn((x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); }, g);
    return c;
  }
  function whiteOf(src) {
    return mk(src.width, src.height, (p, g) => {
      g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-in';
      g.fillStyle = '#fff'; g.fillRect(0, 0, src.width, src.height);
    });
  }
  function art(rows, pal) {
    return mk(rows[0].length, rows.length, p => rows.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch]) p(x, y, pal[ch]); })));
  }
  function virus(r, col, dark, light, knob, rot) {
    const S = 2 * r + 7, c = r + 3;
    return mk(S, S, p => {
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4 + rot;
        for (let t = r; t <= r + 2; t++) p(Math.round(c + Math.cos(a) * t), Math.round(c + Math.sin(a) * t), dark);
        p(Math.round(c + Math.cos(a) * (r + 3)), Math.round(c + Math.sin(a) * (r + 3)), knob);
      }
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const dx = x - c, dy = y - c, d = Math.hypot(dx, dy);
        if (d > r + .4) continue;
        let k = d > r - .8 ? dark : col;
        if (d <= r - .8 && dx + dy < -r * .7) k = light;
        if (d <= r - 1.5 && (x * 7 + y * 13) % 11 === 0) k = dark;
        p(x, y, k);
      }
    });
  }
  function bacterium(len, th, col, dark, light, fr) {
    const w = len + 4, h = th + 2, cy = (h - 1) / 2, R = th / 2;
    return mk(w, h, p => {
      for (let x = 0; x < 4; x++) p(x, Math.round(cy + Math.sin(x * 1.6 + fr * Math.PI) * 1.4), dark);
      const x0 = 4 + R - .5, x1 = 4 + len - R - .5;
      for (let y = 0; y < h; y++) for (let x = 4; x < w; x++) {
        const cx = Math.min(Math.max(x, x0), x1), d = Math.hypot(x - cx, y - cy);
        if (d > R) continue;
        let k = d > R - 1 ? dark : col;
        if (k === col && y === Math.floor(cy) - 1) k = light;
        if (k === col && y === Math.ceil(cy) && x % 3 === 0) k = dark;
        p(x, y, k);
      }
    });
  }
  // Rabies virions really are bullet-shaped: a flat back, a rounded nose, spikes along the coat.
  function bulletVirus(fr, col, dark, light, spike) {
    const w = 22, h = 11, cy = 5, R = 4, nose = w - 2 - R;
    return mk(w, h, p => {
      for (let y = 1; y < h - 1; y++) for (let x = 2; x < w - 1; x++) {
        let inside, edge;
        if (x <= nose) { inside = Math.abs(y - cy) <= R; edge = Math.abs(y - cy) > R - 1 || x === 2; }
        else { const d = Math.hypot(x - nose, y - cy); inside = d <= R + .3; edge = d > R - .8; }
        if (!inside) continue;
        let k = edge ? dark : col;
        if (!edge && y === cy - 2) k = light;
        if (!edge && x % 4 === 0 && y === cy + 1) k = dark;
        p(x, y, k);
      }
      for (let x = 3; x < nose; x += 3) { p(x + fr, 0, spike); p(x + fr, h - 1, spike); }
    });
  }
  function cluster(balls, w, h, rad, col, dark, light) {
    return mk(w, h, p => {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let best = 99, bdx = 0, bdy = 0, br = rad;
        for (const [bx, by, r = rad] of balls) { const d = Math.hypot(x - bx, y - by) - r; if (d < best) { best = d; bdx = x - bx; bdy = y - by; br = r; } }
        if (best > .1) continue;
        let k = best > -1 ? dark : col;
        if (k === col && bdx + bdy < -br * .45) k = light;
        p(x, y, k);
      }
    });
  }

  const SPR = V.SPR = {};
  V.kit = { mk, art, whiteOf, virus, bacterium, cluster };
  const PLAYER_ROWS = V.PLAYER_ROWS = [
    '...ccccc...',
    '..cCCCCCc..',
    '...ggggg...',
    '..gwwwwwg..',
    '.gwwwwwwwg.',
    '.glllllllg.',
    '.glklllklg.',
    '.glllllllg.',
    '.gllmmmllg.',
    '.gLLLLLLLg.',
    '.glllllllg.',
    '..glllllg..',
    '...ggggg...',
    '.....n.....',
    '.....n.....',
  ];
  V.PLAYER_PAL = { c: '#5d88d8', C: '#2a3f78', g: '#a8d8e0', w: '#2d5560', l: '#7fe0d4', k: '#140810', m: '#1f5a55', L: '#f6e7d0', n: '#c9d1da' };
  SPR.player = art(PLAYER_ROWS, V.PLAYER_PAL);

  // pathogens, two animation frames each
  SPR.virus = [0, 1].map(f => virus(4, '#b27cf0', '#4a2378', '#dcb8ff', '#ff9ce8', f * Math.PI / 8));
  SPR.hiv = [0, 1].map(f => virus(4, '#5a8cff', '#1a2a70', '#b0c8ff', '#9cf04a', f * Math.PI / 8));
  SPR.bact = [0, 1].map(f => bacterium(11, 5, '#cfd84e', '#5c6414', '#eef59a', f));
  SPR.mini = [0, 1].map(f => bacterium(6, 3, '#cfd84e', '#5c6414', '#eef59a', f));
  SPR.salmo = [0, 1].map(f => bacterium(9, 5, '#d4524a', '#5a1414', '#ff9a8a', f));
  SPR.bug = [0, 1].map(f => cluster(f ? [[4, 4], [8.5, 3.5], [6.5, 7.5], [10, 8.8], [3.5, 9]] : [[4, 4], [8.5, 3.5], [6.5, 7.5], [10.5, 8], [3.5, 9]], 14, 13, 2.7, '#f08a3c', '#6e2c0a', '#ffc48a'));
  SPR.candida = [0, 1].map(f => cluster([[6, 7, 4.2], [11.5, 4, 2.6], [11, 10, f ? 2.8 : 2.2], [2.5, 3, 1.8]], 15, 14, 2, '#e8dcc0', '#6a5a3a', '#fffaf0'));
  SPR.spore = [0, 1].map(f => art(f ? ['s.s', '.S.', 's.s'] : ['.s.', 'sSs', '.s.'], { s: '#a89870', S: '#fffaf0' }));
  SPR.prion = [0, 1].map(f => art(f ? ['..pp.', '.pPPp', 'pPPp.', '.pPPp', '.pp..'] : ['.pp..', 'pPPp.', '.pPPp', 'pPPp.', '..pp.'], { p: '#8a6a7a', P: '#e8c0d0' }));
  SPR.boss = [0, 1].map(f => virus(10, '#e0506a', '#5a0f22', '#ff9cab', '#ffe066', f * Math.PI / 8));
  SPR.plague = [0, 1].map(f => bacterium(26, 11, '#b08a4a', '#4a3010', '#e8c890', f));
  SPR.noro = [0, 1].map(f => virus(3, '#e8b43a', '#6a4a0a', '#fff0b0', '#ffffff', f * Math.PI / 8));
  SPR.pseudo = [0, 1].map(f => bacterium(10, 5, '#3ab0c8', '#0a3a4a', '#b0f0ff', f));
  SPR.strep = [0, 1].map(f => cluster([[2.5, 2.5, f ? 2.2 : 2.5]], 5, 5, 2.5, '#3fbf7f', '#0f4a2c', '#a8f0c8'));
  SPR.strepHead = [0, 1].map(f => art(['..hhh..', '.hHLHh.', 'hHkHkHh', 'hHHHHHh', f ? 'hHmmmHh' : 'hHHmHHh', '.hHHHh.', '..hhh..'],
    { h: '#0f4a2c', H: '#3fbf7f', L: '#a8f0c8', k: '#140810', m: '#0f4a2c' }));
  SPR.plasmo = [0, 1].map(f => art(f ? ['.m.m.', 'mMMMm', '.MLM.', 'mMMMm', '.m.m.'] : ['..m..', '.mMm.', 'mMLMm', '.mMm.', '..m..'],
    { m: '#8a1a6a', M: '#e04ab0', L: '#ffb0e0' }));
  // Plasmodium in disguise: a red cell like the background ones, but solid and with a telltale purple speck
  SPR.plasmoHidden = [0, 1].map(f => mk(9, 5, p => {
    for (let y = 0; y < 5; y++) for (let x = 0; x < 9; x++) {
      const dx = x - 4, dy = y - 2;
      if ((dx / 4.4) ** 2 + (dy / 2.4) ** 2 > 1) continue;
      p(x, y, (dx / 2.2) ** 2 + dy ** 2 <= 1 ? '#4a1020' : '#6a1828');
    }
    p(f ? 5 : 4, 2, '#c040a0');
  }));
  // extra bosses
  SPR.tb = [0, 1].map(f => bacterium(24, 10, '#c8b8a0', '#4a3a2a', '#f0e8d8', f));
  SPR.rabies = [0, 1].map(f => bulletVirus(f, '#9a9ab0', '#2a2a40', '#e0e0f0', '#ff6a6a'));
  SPR.phantom = [0, 1].map(f => virus(9, '#7a5aff', '#1a1060', '#c0b0ff', '#ff6ad0', f * Math.PI / 8));
  SPR.decoy = SPR.phantom; // decoys are deliberately identical

  // MRSA Colossus: a giant grape cluster in four stages — it loses grapes as it takes damage
  const grapes = [[13, 12, 4.6], [7, 8], [19, 8], [7, 16], [19, 16], [13, 5], [13, 19], [3.8, 12], [22.2, 12]];
  for (let st = 0; st < 4; st++) {
    SPR['colossus' + st] = [0, 1].map(f => cluster(grapes.slice(0, 9 - st * 2).map(([x, y, r], i) => [x + (f && i === 1 ? .7 : 0), y, r]),
      26, 24, 3.6, '#e0702a', '#5a2006', '#ffb070'));
  }
  SPR.colossus = SPR.colossus0;

  // The Filament: an Ebola strand — a hooked head (the "shepherd's crook") dragging a beaded body
  SPR.ebola = [0, 1].map(f => art(['..hhhhh..', '.hHHHHHh.', f ? 'hHLHHHhHh' : 'hHLHHHkHh', 'hHHHHHHHh', 'hHHHHHHHh', '.hHHHHHh.', '..hhHhh..', '....hHh..', '.....hh..'],
    { h: '#5a2a10', H: '#e0a060', L: '#ffd8a8', k: '#140810' }));
  SPR.ebolaSeg = [0, 1].map(f => cluster([[2.5, 2.5, f ? 2.1 : 2.5]], 5, 5, 2.5, '#e0a060', '#5a2a10', '#ffd8a8'));

  // Mycelia Queen: a fungal mother-colony with budding lobes
  SPR.mycelia = [0, 1].map(f => cluster([[13, 12, 6.2], [6, 6, 3], [20, 6, f ? 3.4 : 3], [6, 18, f ? 3.4 : 3], [20, 18, 3], [13, 3, 2.4], [13, 21, 2.4], [2.5, 12, 1.8], [23.5, 12, 1.8]],
    26, 24, 3, '#e8d0f0', '#5a3a6a', '#fff6ff'));

  // Adenovirus: an icosahedral capsid with long fibres
  SPR.adeno = [0, 1].map(f => virus(4, '#60c0a0', '#10402e', '#c0f0e0', '#ffe0a0', f * Math.PI / 8));
  // Giardia: the famous "face" — two nuclei for eyes
  SPR.giardia = [0, 1].map(f => art(['..ggggg..', '.gGGGGGg.', 'gGkGGGkGg', 'gGGGGGGGg', '.gGGmGGg.', '..gGGGg..', f ? '..g...g..' : '...g.g...'],
    { g: '#5a7a2a', G: '#c8e080', k: '#140810', m: '#7a9a3a' }));
  // Borrelia: a corkscrew spirochete
  SPR.borrelia = [0, 1].map(f => mk(15, 7, p => {
    for (let x = 0; x < 15; x++) {
      const y = Math.round(3 + Math.sin(x * 1.1 + f * Math.PI) * 2.4);
      p(x, y, '#ffc890'); if (y + 1 < 7) p(x, y + 1, '#7a4020');
    }
  }));
  // Measles Monarch: a teal core crowned by orbiting virions
  SPR.measles = [0, 1].map(f => virus(8, '#2a9aa0', '#0a3a40', '#90f0f0', '#ff8080', f * Math.PI / 8));
  SPR.measlesSat = [0, 1].map(f => virus(1, '#80e8e8', '#0a3a40', '#ffffff', '#ff8080', f * Math.PI / 8));
  // The Botulist: an olive-drab spore-former (think bulging tin cans)
  SPR.botulist = [0, 1].map(f => bacterium(22, 9, '#8a9a5a', '#2a3a10', '#d0e0a0', f));
  SPR.mine = [0, 1].map(f => art(['.m.m.', 'mMMMm', '.MLM.', 'mMMMm', '.m.m.'], { m: '#2a3a10', M: f ? '#ff4a2a' : '#c0d090', L: '#ffffff' }));
  SPR.gas = [0, 1].map(f => cluster([[4.5, 5, 3], [8.5, 4.5, 3], [6.5, 8, 2.6], f ? [10, 7.5, 2] : [3, 8, 2]], 13, 12, 3, '#8a9a5a', '#4a5a2a', '#c0d090'));
  // Prion Hydra: a misfolded mass in three sizes — it splits as you cut it down
  const hydraBlob = (w, balls) => [0, 1].map(f => cluster(balls.map(([x, y, r], i) => [x + (f && i % 2 ? .6 : 0), y, r]), w, w, 2, '#b08aa0', '#4a2a3a', '#f0d0e0'));
  SPR.hydra0 = hydraBlob(23, [[11.5, 11.5, 6.5], [5, 7, 3.4], [18, 6, 3.2], [6, 17, 3], [17.5, 17.5, 3.6], [11.5, 3.5, 2.4]]);
  SPR.hydra1 = hydraBlob(15, [[7.5, 7.5, 4.4], [3.4, 4.5, 2.4], [11.6, 4.2, 2.2], [4, 11.4, 2], [11.4, 11.6, 2.4]]);
  SPR.hydra2 = hydraBlob(9, [[4.5, 4.5, 3], [2, 2.4, 1.5], [7, 6.6, 1.5]]);
  SPR.hydra = SPR.hydra0;

  // Tetanus: a "drumstick" rod with a round spore at one end
  SPR.tetanus = [0, 1].map(f => {
    const rod = bacterium(9, 4, '#a0a8c0', '#303848', '#e8f0ff', f);
    return mk(rod.width + 4, rod.height + 2, (p, g) => {
      g.drawImage(rod, 0, 1);
      const cx = rod.width + 1, cy = (rod.height + 2 - 1) / 2;
      for (let y = 0; y < rod.height + 2; y++) for (let x = rod.width - 2; x < rod.width + 4; x++) {
        const d = Math.hypot(x - cx, y - cy); if (d <= 2.7) p(x, y, d > 1.8 ? '#303848' : '#f0f4ff');
      }
    });
  });
  SPR.klebs = [0, 1].map(f => bacterium(10, 6, '#ff9080', '#6a2020', '#ffd0c8', f));
  SPR.corona = [0, 1].map(f => virus(5, '#e0a040', '#5a3000', '#ffe0a0', '#ff4040', f * Math.PI / 8));
  // Trypanosoma: a wavy flagellate with an undulating membrane
  SPR.trypan = [0, 1].map(f => mk(14, 8, p => {
    for (let x = 0; x < 14; x++) {
      const y = Math.round(3.5 + Math.sin(x * .8 + f * Math.PI) * 2);
      p(x, y, '#d8d0ff'); if (x > 2 && x < 12) p(x, y + 1, '#d8d0ff');
      if (x % 2) p(x, y - 1, '#403070');
    }
    p(12, Math.round(3.5 + Math.sin(12 * .8 + f * Math.PI) * 2), '#ffffff');
  }));
  SPR.drone = [0, 1].map(f => mk(9, 9, (p, g) => {
    g.drawImage(cluster([[4, 4, f ? 2.9 : 3.2]], 9, 9, 3, '#40a0ff', '#0a2860', '#b0e0ff'), 0, 0);
    for (const [x, y] of f ? [[4, 0], [4, 8], [0, 4], [8, 4]] : [[1, 1], [7, 1], [1, 7], [7, 7]]) p(x, y, '#b0e0ff');   // blinking antennae
  }));
  SPR.quorum = [0, 1].map(f => cluster([[9, 9, 5.5], [3, 6, 2.6], [15, 6, f ? 3 : 2.6], [3, 13, f ? 3 : 2.6], [15, 13, 2.6], [9, 2.5, 2.2], [9, 15.5, 2.2]], 19, 19, 2.6, '#40a0ff', '#0a2860', '#b0e0ff'));
  // The Shifter: one virion, three colours for its three strategies
  SPR.shifter0 = [0, 1].map(f => virus(7, '#ff5060', '#5a0a14', '#ffb0b8', '#ffffff', f * Math.PI / 8));
  SPR.shifter1 = [0, 1].map(f => virus(7, '#50a0ff', '#0a2060', '#b0d8ff', '#ffffff', f * Math.PI / 8));
  SPR.shifter2 = [0, 1].map(f => virus(7, '#60e070', '#0a4014', '#c0ffc8', '#ffffff', f * Math.PI / 8));
  SPR.shifter = SPR.shifter0;

  for (const k of [...Object.keys(V.ENEMIES), 'strepHead', 'plasmoHidden', 'colossus1', 'colossus2', 'colossus3', 'ebolaSeg', 'hydra1', 'hydra2', 'measlesSat', 'shifter1', 'shifter2']) if (SPR[k]) SPR[k + 'W'] = SPR[k].map(whiteOf);   // expansion sprites add their own
  SPR.shifter0W = SPR.shifterW;
  // Mutants: every pathogen gets a crimson-tinted twin
  const tintOf = (src, col, a) => mk(src.width, src.height, (p, g) => {
    g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = a; g.fillStyle = col; g.fillRect(0, 0, src.width, src.height);
  });
  for (const k of [...Object.keys(V.ENEMIES).filter(k => !V.ENEMIES[k].boss), 'strepHead']) if (SPR[k]) SPR[k + 'M'] = SPR[k].map(s => tintOf(s, '#ff2040', .5));
  SPR.hydra0W = SPR.hydraW;
  SPR.colossus0W = SPR.colossusW;

  // allies
  SPR.macroAlly = [0, 1].map(f => cluster(f ? [[6, 6, 4.2], [1.8, 4, 1.5], [10, 7.5, 1.5], [6.5, 10.3, 1.3]] : [[6, 6, 4.2], [2.2, 8, 1.5], [9.6, 2.5, 1.5], [5.5, 1.6, 1.3]],
    12, 12, 2, '#e8e0ff', '#6a5ac8', '#ffffff'));
  SPR.orb = art(['.w.', 'wnw', '.w.'], { w: '#f0f0ff', n: '#8a7ad8' });

  // pickups
  SPR.heal = art(['.hh.hh.', 'hhwhhhh', 'hwhhhhh', '.hhhhh.', '..hhh..', '...h...'], { h: '#ff5a6e', w: '#ffd0d6' });
  SPR.heartEmpty = art(['.hh.hh.', 'h..h..h', 'h.....h', '.h...h.', '..h.h..', '...h...'], { h: '#5a1c30' });
  SPR.spread = art(['...y...', '..yYy..', '.yYYYy.', 'yYYWYYy', '.yYYYy.', '..yYy..', '...y...'], { y: '#9a7a10', Y: '#ffe066', W: '#fffbe0' });
  SPR.shield = art(['..bbb..', '.b...b.', 'b..B..b', 'b.BWB.b', 'b..B..b', '.b...b.', '..bbb..'], { b: '#7fe0d4', B: '#3fa89c', W: '#e8fbf8' });
  SPR.rapid = art(['....ll.', '...ll..', '..lll..', '.lllll.', '...ll..', '..ll...', '.ll....'], { l: '#8fd0ff' });
  SPR.pierce = art(['...a...', '..aAa..', '.aAAAa.', '...A...', '...A...', '...A...', '...A...'], { a: '#ff7ac8', A: '#ffd0ec' });
  SPR.speed = art(['g..g...', '.g..g..', '..g..g.', '...g..g', '..g..g.', '.g..g..', 'g..g...'], { g: '#9cf04a' });
  SPR.nova = art(['r..r..r', '.r.r.r.', '..RRR..', 'rrRWRrr', '..RRR..', '.r.r.r.', 'r..r..r'], { r: '#ff8a3c', R: '#ffc070', W: '#fffbe0' });

  SPR.homing = art(['y.....y', '.y...y.', '..y.y..', '...Y...', '...y...', '...y...', '..yyy..'], { y: '#d0b0ff', Y: '#ffffff' });
  SPR.neutro = art(['.wwwww.', 'wwnwnww', 'wnnwnnw', 'wwwnwww', 'wnnwnnw', 'wwnwnww', '.wwwww.'], { w: '#f0f0ff', n: '#8a7ad8' });
  SPR.macro = art(['w..w..w', '.wwwww.', '.wwnnw.', 'wwnnnww', '.wnnww.', '.wwwww.', 'w..w..w'], { w: '#e8e0ff', n: '#6a5ac8' });
  SPR.freeze = art(['...i...', '.i.i.i.', '..iii..', 'iiiIiii', '..iii..', '.i.i.i.', '...i...'], { i: '#bfe8ff', I: '#ffffff' });

  // newer power-ups
  SPR.vitc = art(['..ooo..', '.oOOOo.', 'oOwOwOo', 'oOOwOOo', 'oOwOwOo', '.oOOOo.', '..ooo..'], { o: '#e8801a', O: '#ffb040', w: '#fff0c0' });  // an orange slice
  SPR.atp = art(['.yyyyy.', 'y..Y..y', 'y.YY..y', 'yYYYYYy', 'y..YY.y', 'y..Y..y', '.yyyyy.'], { y: '#ffd23a', Y: '#fff6b0' });   // an energy bolt
  SPR.il2 = art(['...r...', '..rRr..', '.rR.Rr.', '...r...', '..rRr..', '.rR.Rr.', 'r.....r'], { r: '#ff6a3c', R: '#ffd0a0' });    // double chevron
  SPR.complement = art(['.c.c.c.', 'c..C..c', '..CWC..', 'cCWWWCc', '..CWC..', 'c..C..c', '.c.c.c.'], { c: '#4affc0', C: '#b0ffe8', W: '#ffffff' });
  SPR.fever = art(['...f...', '..fF...', '..fFf..', '.fFYFf.', '.fFYFf.', 'fFYYYFf', '.fFFFf.'], { f: '#d02a1a', F: '#ff7a2a', Y: '#ffe066' });
  SPR.phage = art(['..ppp..', '.pPPPp.', '..ppp..', '...p...', '...p...', '.p.p.p.', 'p..p..p'], { p: '#b8b8d8', P: '#ffffff' });  // a bacteriophage
  SPR.phageShot = [0, 1].map(f => art(f ? ['ppp', 'pPp', '.p.', '.p.', 'p.p'] : ['ppp', 'pPp', '.p.', 'p.p', '...'], { p: '#d8d8f0', P: '#ffffff' }));
  SPR.atpOrb = [0, 1].map(f => art(f ? ['.Y.', 'YyY', '.Y.'] : ['y.y', '.Y.', 'y.y'], { y: '#ffd23a', Y: '#fff6b0' }));
  // shop icons
  SPR.maxhp = art(['.hh.hh.', 'hhhwhhh', 'hhwwwhh', '.hhwhh.', '..hhh..', '...h...'], { h: '#ff5a6e', w: '#ffffff' });
  SPR.reroll = art(['..rrr..', '.r...r.', 'r.....r', 'r...rrr', 'r....r.', '.r.....', '..rrr..'], { r: '#7fe0d4' });
  SPR.extra = art(['cc..cc.', 'gg..gg.', 'gl..gl.', 'gl..gl.', 'gl..gl.', 'gg..gg.', '.n...n.'], { c: '#5d88d8', g: '#a8d8e0', l: '#7fe0d4', n: '#c9d1da' });

  SPR.shot = art(['a.a', '.a.', '.a.'], { a: '#c8fff6' });
  SPR.shotIL = art(['a.a', '.A.', '.a.'], { a: '#ff6a3c', A: '#ffd0a0' });
  SPR.shotH = art(['a.a', '.A.', '.a.'], { a: '#d0b0ff', A: '#ffffff' });
  SPR.shotP = art(['a.a', '.A.', '.a.'], { a: '#ff7ac8', A: '#ffd0ec' });
  SPR.toxin = art(['.t.', 'tTt', '.t.'], { t: '#5aa020', T: '#c8ff7a' });
  SPR.rbc = mk(9, 5, p => {
    for (let y = 0; y < 5; y++) for (let x = 0; x < 9; x++) {
      const dx = x - 4, dy = y - 2;
      if ((dx / 4.4) ** 2 + (dy / 2.4) ** 2 > 1) continue;
      p(x, y, (dx / 2.2) ** 2 + (dy / 1) ** 2 <= 1 ? '#4a1020' : '#6a1828');
    }
  });

  // vessel wall tile (seeded so it tiles cleanly)
  let seed = 7; const srnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  SPR.wall = mk(64, TOP, p => {
    const rows = ['#1a060e', '#220812', '#2a0a16', '#330d1b', '#3b1020', '#44132a', '#4d1730', '#551a34', '#5e1d38', '#6a2240', '#7a2844', '#8a2c44'];
    for (let y = 0; y < TOP; y++) for (let x = 0; x < 64; x++) p(x, y, rows[y]);
    for (let i = 0; i < 10; i++) {
      const cx = Math.floor(srnd() * 60) + 2, cy = 3 + Math.floor(srnd() * 5);
      for (let x = -2; x <= 2; x++) p((cx + x + 64) % 64, cy, '#6a1f38');
      p(cx, cy, '#9a3450');
    }
    for (let x = 0; x < 64; x += 2) if (srnd() < .5) p(x, TOP - 1, '#a8405a');
  });

  // data URLs for DOM use (hearts, chips, field guide)
  V.imgURL = {};
  V.urlOf = key => V.imgURL[key] ??= (Array.isArray(SPR[key]) ? SPR[key][0] : SPR[key]).toDataURL();

  // 3×5 bitmap font for in-canvas numbers (score pop-ups, combo meter, warnings)
  const GLYPHS = {
    0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001',
    5: '111100111001111', 6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111',
    '+': '000010111010000', x: '000101010101000', '.': '000000000000010', '!': '010010010000010',
    C: '111100100100111', O: '111101101101111', M: '101111111101101', B: '110101110101110',
  };
  V.pixText = (ctx, str, x, y, col, shadow = '#140810') => {
    str = String(str);
    const draw = (ox, oy, c) => {
      ctx.fillStyle = c;
      [...str].forEach((ch, i) => {
        const g = GLYPHS[ch]; if (!g) return;
        for (let j = 0; j < 15; j++) if (g[j] === '1') ctx.fillRect(x + ox + i * 4 + (j % 3), y + oy + Math.floor(j / 3), 1, 1);
      });
    };
    if (shadow) draw(1, 1, shadow);
    draw(0, 0, col);
  };
  V.pixWidth = str => String(str).length * 4 - 1;
})();
