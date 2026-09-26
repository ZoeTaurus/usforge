// Cosmetics: vaccine skins and body-location backgrounds, bought with DNA in the Wardrobe.
// Purely visual — nothing here changes how the game plays.
(() => {
  const V = window.VAX;
  const { W, H, TOP, BOT, TAU, SPR } = V;
  const { mk, art } = V.kit;
  const R = Math.round;
  const cos = V.cos = {};

  // ---------- skins: palette swaps (and a couple of shape tweaks) of the vaccine vial ----------
  const crown = rows => rows.map((r, i) => i === 0 ? '..c.c.c.c..' : i === 1 ? '..cJcJcJc..' : r);
  const sprinkles = rows => rows.map((r, i) => ({ 5: '.glslllSlg.', 7: '.gllBllslg.', 10: '.gSllllBlg.', 11: '..glslllg..' })[i] || r);
  V.SKINS = [
    { id: 'classic',   cost: 0 },
    { id: 'bubblegum', cost: 40,  pal: { c: '#ff5aa8', C: '#7a1f50', g: '#ffd0f0', w: '#6a2050', l: '#ff9ce8', m: '#8a2060' } },
    { id: 'toxic',     cost: 60,  pal: { c: '#4a8a20', C: '#1a3a0a', g: '#d8ffb0', w: '#2a5a10', l: '#9cf04a', m: '#2a5a10', L: '#f0ff60' } },
    { id: 'arctic',    cost: 70,  pal: { c: '#8ad0ff', C: '#3a6a90', g: '#ffffff', w: '#5a8aa0', l: '#d8f8ff', m: '#5a8aa0', L: '#8ad0ff' } },
    { id: 'midnight',  cost: 90,  pal: { c: '#3a3a90', C: '#101030', g: '#b0b8ff', w: '#1a1a50', l: '#5a6aff', m: '#10104a', L: '#ffe066' } },
    { id: 'stealth',   cost: 110, pal: { c: '#3a3a46', C: '#141418', g: '#9a9aaa', w: '#1a1a22', l: '#50505e', m: '#ff4a4a', k: '#ff4a4a', L: '#2a2a34', n: '#9a9aaa' } },
    { id: 'inferno',   cost: 130, pal: { c: '#e03a10', C: '#5a0a00', g: '#ffc090', w: '#5a1a00', l: '#ff6a3a', m: '#6a1a00', L: '#ffe0a0' } },
    { id: 'royal',     cost: 160, pal: { c: '#ffd23a', J: '#ff4a6a', g: '#fff0a0', w: '#6a4a00', l: '#ffd23a', m: '#7a5a00', L: '#fff8e0' }, rows: crown },
    { id: 'confetti',  cost: 200, pal: { s: '#ff5aa8', S: '#ffe066', B: '#5aa0ff' }, rows: sprinkles },
    // not for sale: awarded for eradicating Patient Zero
    { id: 'champion',  cost: null, pal: { c: '#fff4c0', J: '#60e070', C: '#c09020', g: '#ffffff', w: '#806010', l: '#ffe680', m: '#8a6a10', L: '#ffffff', n: '#fff4c0' }, rows: crown },
  ];
  const skinCache = {};
  cos.skinSprite = id => skinCache[id] ??= (() => {
    const s = V.SKINS.find(k => k.id === id) || V.SKINS[0];
    return art((s.rows || (r => r))(V.PLAYER_ROWS), Object.assign({}, V.PLAYER_PAL, s.pal));
  })();

  // ---------- backgrounds ----------
  const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const lerp = (a, b, t) => '#' + hex(a).map((v, i) => R(v + (hex(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');
  const grad = (a, b) => Array.from({ length: TOP }, (_, i) => lerp(a, b, i / (TOP - 1)));
  // a 64-px wall tile: a vertical gradient plus scene-specific texture (seeded so it tiles cleanly)
  function wallOf(top, edge, deco) {
    let seed = 11; const srnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const rows = grad(top, edge);
    return mk(64, TOP, p => { for (let y = 0; y < TOP; y++) for (let x = 0; x < 64; x++) p(x, y, rows[y]); deco(p, srnd); });
  }
  const disc = (w, h, fn) => mk(w, h, p => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = fn(x - (w - 1) / 2, y - (h - 1) / 2); if (c) p(x, y, c); } });

  // floating background cells for each place in the body (kept dim so they never look like pathogens)
  const F = {
    lympho: disc(7, 7, (x, y) => { const d = Math.hypot(x, y), n = Math.hypot(x + .6, y - .4); return d > 3.4 ? 0 : n < 2.3 ? '#1c3a31' : d > 2.7 ? '#335a4e' : '#2a4a40'; }),
    dendrite: mk(11, 11, p => {
      for (let k = 0; k < 5; k++) { const a = k * TAU / 5 + .3; for (let t = 1; t < 5.5; t++) p(R(5 + Math.cos(a) * t), R(5 + Math.sin(a) * t), '#24403a'); }
      for (const [x, y] of [[4, 5], [5, 5], [6, 5], [5, 4], [5, 6]]) p(x, y, '#2f5448');
    }),
    bubble: disc(7, 7, (x, y) => { const d = Math.hypot(x, y); return d > 3.4 ? 0 : d > 2.5 ? '#40294a' : (x === -1 && y === -1) ? '#5c4468' : 0; }),
    dust: disc(3, 3, (x, y) => Math.abs(x) + Math.abs(y) <= 1 ? '#36233c' : 0),
    rod: mk(8, 3, p => { for (let x = 0; x < 8; x++) for (let y = 0; y < 3; y++) if (!((x === 0 || x === 7) && y !== 1)) p(x, y, y === 0 ? '#46361a' : '#3a2c14'); }),
    cocci: mk(7, 3, p => { for (const cx of [1, 5]) for (let y = 0; y < 3; y++) for (let x = cx - 1; x <= cx + 1; x++) if (Math.abs(x - cx) + Math.abs(y - 1) <= 1) p(x, y, '#44321a'); }),
    stem: disc(7, 7, (x, y) => { const d = Math.hypot(x, y); return d > 3.4 ? 0 : d < 1.8 ? '#3a2818' : '#4c3824'; }),
    youngRbc: disc(7, 5, (x, y) => (x / 3.4) ** 2 + (y / 2.4) ** 2 > 1 ? 0 : (x / 1.6) ** 2 + y ** 2 <= 1 ? '#3a1414' : '#521a1a'),
    neuron: mk(13, 13, p => {
      for (let k = 0; k < 5; k++) {
        const a = k * TAU / 5 + .5, bend = k % 2 ? .25 : -.25;
        for (let t = 2; t < 6.5; t += .5) p(R(6 + Math.cos(a + bend * t / 6) * t), R(6 + Math.sin(a + bend * t / 6) * t), '#221f48');
      }
      for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (x * x + y * y <= 4) p(6 + x, 6 + y, x + y < -1 ? '#3a3574' : '#2c2860');
    }),
  };

  V.SCENES = [
    { id: 'blood', cost: 0, bg: '#1f0b15', band: '#240d19', fleck: '#2b1020', alpha: .75, flow: 1, floaters: [[() => SPR.rbc, 1]], wall: () => SPR.bloodWall },
    { id: 'lymph', cost: 60, bg: '#0c1813', band: '#0f1f19', fleck: '#172d25', alpha: .85, flow: .45,
      floaters: [[() => F.lympho, 6], [() => F.dendrite, 1]],
      // lymphatic capsule with rounded follicles bulging into the node
      wall: () => wallOf('#050d0a', '#3a6a58', (p, r) => {
        for (let i = 0; i < 4; i++) {
          const cx = i * 16 + 6 + Math.floor(r() * 5);
          for (let y = 5; y < TOP; y++) for (let x = -4; x <= 4; x++) {
            const d = Math.hypot(x, (y - 9) * 1.2);
            if (d <= 3.6) p((cx + x + 64) % 64, y, d < 1.6 ? '#7ab89a' : d < 2.8 ? '#5a9a7e' : '#467e66');
          }
        }
        for (let x = 0; x < 64; x += 3) if (r() < .5) p(x, TOP - 1, '#8ac8aa');
      }),
      // the reticular fibre mesh that lymphocytes crawl along
      deco: (ctx, clock, d) => {
        ctx.fillStyle = '#12241d';
        const off = (clock * 4) % 24;
        for (let x = -24; x < d.w + 24; x += 24) for (let y = d.top; y < d.bot; y += 3) {
          const k = (y - d.top) * .5;
          ctx.fillRect(R(x - off + k), y, 1, 1); ctx.fillRect(R(x - off + 12 - k), y, 1, 1);
        }
      } },
    { id: 'lungs', cost: 90, bg: '#1a0e1b', band: '#21121f', fleck: '#2e1b2d', alpha: .9, flow: .7, breath: true,
      floaters: [[() => F.bubble, 3], [() => F.dust, 2]],
      // alveolar sacs: a honeycomb of hollow air pockets
      wall: () => wallOf('#0e060d', '#7a4060', (p, r) => {
        for (let i = 0; i < 9; i++) {
          const cx = i * 7 + 3, cy = 4 + (i % 2) * 3 + Math.floor(r() * 2);
          for (let a = 0; a < TAU; a += .4) p((R(cx + Math.cos(a) * 2.4) + 64) % 64, R(cy + Math.sin(a) * 2.4), '#b0708e');
          p(cx, cy, '#3a1a2c');
        }
        for (let x = 0; x < 64; x += 2) if (r() < .6) p(x, TOP - 1, '#c888a4');
      }) },
    { id: 'gut', cost: 120, bg: '#1b1308', band: '#22180a', fleck: '#2f2210', alpha: .85, flow: .6,
      floaters: [[() => F.rod, 3], [() => F.cocci, 2]],
      // intestinal villi: finger-like folds reaching into the lumen
      wall: () => wallOf('#0c0803', '#6a4420', (p, r) => {
        for (let x0 = 0; x0 < 64; x0 += 5) {
          const len = 3 + Math.floor(r() * 3);
          for (let y = TOP - len; y < TOP; y++) for (let x = x0 + 1; x < x0 + 4; x++) p(x % 64, y, x === x0 + 1 ? '#8a5a2a' : '#b07a40');
          p((x0 + 2) % 64, TOP - len, '#d8a060');
        }
      }) },
    { id: 'marrow', cost: 150, bg: '#1d1109', band: '#24160b', fleck: '#311d10', alpha: .85, flow: .5,
      floaters: [[() => F.stem, 3], [() => F.youngRbc, 2], [() => SPR.rbc, 1]],
      // spongy bone: pale trabeculae full of holes
      wall: () => wallOf('#16100a', '#c8b890', (p, r) => {
        for (let i = 0; i < 14; i++) {
          const cx = Math.floor(r() * 64), cy = 2 + Math.floor(r() * 7), rx = 1.5 + r() * 2;
          for (let y = -2; y <= 2; y++) for (let x = -4; x <= 4; x++) if ((x / rx) ** 2 + (y / 1.3) ** 2 <= 1) p((cx + x + 64) % 64, cy + y, '#4a3624');
        }
        for (let x = 0; x < 64; x += 2) if (r() < .5) p(x, TOP - 1, '#efe2c0');
      }) },
    { id: 'brain', cost: 180, bg: '#0b0a1b', band: '#0f0e23', fleck: '#191737', alpha: 1, flow: .35,
      floaters: [[() => F.neuron, 1]],
      // the blood–brain barrier: tightly sealed endothelial cells
      wall: () => wallOf('#050410', '#4a4090', (p, r) => {
        for (let y = 0; y < TOP; y++) for (let x = 0; x < 64; x++) if ((x + (Math.floor(y / 4) % 2) * 4) % 8 === 0 || y % 4 === 0) p(x, y, lerp('#0a0820', '#2a2462', y / TOP));
        for (let x = 0; x < 64; x++) p(x, TOP - 1, x % 8 === 3 ? '#b8b0ff' : '#8a80e0');
      }),
      // synapses firing: brief sparks that hop between random spots
      deco: (ctx, clock, d) => {
        const k = Math.floor(clock * 6);
        for (let i = 0; i < 5; i++) {
          const h = Math.sin((k + i * 37) * 12.9898) * 43758.5453, u = h - Math.floor(h), v = (h * 7.13) - Math.floor(h * 7.13);
          ctx.fillStyle = i % 2 ? '#6a6ae0' : '#9a90ff';
          ctx.fillRect(R(u * d.w), R(d.top + 10 + v * (d.bot - d.top - 20)), 1, 1);
        }
      } },
  ];
  SPR.bloodWall = SPR.wall; SPR.bloodPlasmo = SPR.plasmoHidden;
  const sceneCache = {};
  cos.scene = id => sceneCache[id] ??= (() => {
    const s = V.SCENES.find(k => k.id === id) || V.SCENES[0];
    const fl = s.floaters.map(([f, w]) => [f(), w]), total = fl.reduce((a, [, w]) => a + w, 0);
    // Plasmodium disguises itself as this place's most common cell — same shape, plus a telltale purple speck
    const base = fl[0][0], cx = base.width >> 1, cy = base.height >> 1;
    const disguise = s.id === 'blood' ? SPR.bloodPlasmo : [0, 1].map(f => mk(base.width, base.height, (p, g) => { g.drawImage(base, 0, 0); p(cx + (f ? 1 : 0), cy, '#c040a0'); }));
    return Object.assign({}, s, { wallImg: s.wall(), fl, total, disguise, disguiseW: disguise.map(V.kit.whiteOf) });
  })();

  // ---------- drawing (shared by the game, the attract screen and the Wardrobe preview) ----------
  const FULL = { w: W, h: H, top: TOP, bot: BOT };
  cos.background = (ctx, sc, cells, flecks, clock, d = FULL) => {
    ctx.fillStyle = sc.bg; ctx.fillRect(-4, -4, d.w + 8, d.h + 8);
    ctx.fillStyle = sc.band; ctx.fillRect(-4, d.top, d.w + 8, 10); ctx.fillRect(-4, d.bot - 10, d.w + 8, 10);
    sc.deco?.(ctx, clock, d);
    ctx.fillStyle = sc.fleck;
    for (const f of flecks) ctx.fillRect(R(f.x), R(f.y), 1, 1);
    ctx.globalAlpha = sc.alpha;
    for (const c of cells) {
      c.k ??= Math.random();
      let pick = c.k * sc.total, img = sc.fl[0][0];
      for (const [f, w] of sc.fl) { if (pick < w) { img = f; break; } pick -= w; }
      ctx.drawImage(img, R(c.x - img.width / 2), R(c.y - img.height / 2));
    }
    ctx.globalAlpha = 1;
  };
  cos.walls = (ctx, sc, clock, d = FULL) => {
    const off = Math.floor(clock * 10 * sc.flow) % 64;
    for (let x = -off - 64; x < d.w + 64; x += 64) {
      ctx.drawImage(sc.wallImg, x, 0);
      ctx.save(); ctx.translate(x, d.h); ctx.scale(1, -1); ctx.drawImage(sc.wallImg, 0, 0); ctx.restore();
    }
  };
  // how fast the background drifts right now (the lungs breathe in and out)
  cos.flow = (clock, sc = cos.current) => sc.flow * (sc.breath ? 1 + .8 * Math.sin(clock * 1.3) : 1);

  // ---------- ownership (stored with the rest of the meta progression) ----------
  const data = () => {
    const d = V.meta.data;
    d.cos ??= { skins: ['classic'], scenes: ['blood'], skin: 'classic', scene: 'blood' };
    return d.cos;
  };
  const list = kind => kind === 'skin' ? V.SKINS : V.SCENES;
  cos.owned = (kind, id) => data()[kind + 's'].includes(id);
  cos.equipped = kind => data()[kind];
  cos.cost = (kind, id) => list(kind).find(k => k.id === id).cost;
  cos.equip = (kind, id) => {
    if (!cos.owned(kind, id)) return false;
    data()[kind] = id; V.meta.save(); cos.apply();
    if (kind === 'scene') V.i18n.set(V.i18n.lang);   // repaint lines that mention the setting
    return true;
  };
  cos.buy = (kind, id) => {
    const c = cos.cost(kind, id), m = V.meta.data;
    if (c == null || cos.owned(kind, id) || m.dna < c) return false;
    m.dna -= c; data()[kind + 's'].push(id);
    return cos.equip(kind, id);
  };
  // swap the live sprites for whatever is equipped
  cos.apply = () => {
    SPR.player = cos.skinSprite(cos.equipped('skin'));
    cos.current = cos.scene(cos.equipped('scene'));
    SPR.wall = cos.current.wallImg;
    SPR.plasmoHidden = cos.current.disguise; SPR.plasmoHiddenW = cos.current.disguiseW;
    delete V.imgURL.player;
    const logo = document.getElementById('logoVax'); if (logo) logo.src = V.urlOf('player');
  };
  cos.apply();
})();
