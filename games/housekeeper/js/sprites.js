// Pixel-art sprites, written as run-length rows: "3.k8ok3." = 3 clear, 1 k, 8 o, 1 k, 3 clear.
// Each letter is a palette color; "." is transparent. Sprites are baked into canvases at load.
(function () {
  const PAL = {
    k: '#2b1f35', e: '#1a1420', w: '#ffffff', W: '#dfe6ee', g: '#9aa5b5', G: '#5d6675',
    s: '#f2c29b', S: '#d99a6c', h: '#5a2e1f', o: '#ff9f68', O: '#d9733f', b: '#3d5a99', B: '#2b3f70',
    r: '#d64545', R: '#8f2a20', y: '#ffd257', Y: '#c99a1e', n: '#8a5a3b', N: '#6a3f22', l: '#c49a6c',
    L: '#e0bf8f', v: '#5cb85c', V: '#2e7d32', c: '#8fd3ff', C: '#3f7fb0', p: '#b06ab3', P: '#7a3f8a',
    m: '#f7a8c4',
  };

  // ---------- player (16x16) ----------
  const FRONT = [
    '16.', '5.6k5.', '4.k6hk4.', '3.k8hk3.', '3.k2h4s2hk3.', '3.kh6shk3.', '3.kse4sesk3.', '3.k8sk3.',
    '4.k2s2S2sk4.', '3.k8ok3.', '2.ks8osk2.', '2.ksoO4oOosk2.', '3.k8bk3.',
  ];
  const BACK = [
    '16.', '5.6k5.', '4.k6hk4.', '3.k8hk3.', '3.k8hk3.', '3.k8hk3.', '3.k8hk3.', '3.k8hk3.',
    '4.k6hk4.', '3.k8ok3.', '2.ks8osk2.', '2.ksoO4oOosk2.', '3.k8bk3.',
  ];
  const SIDE = [
    '16.', '5.6k5.', '4.k6hk4.', '3.k8hk3.', '3.k4h4sk3.', '3.k3h5sk3.', '3.k2h4sesk3.', '3.kh7sk3.',
    '4.k3sS2sk4.', '4.k6ok4.', '4.k2os3ok4.', '4.koOsO2ok4.', '4.k6bk4.',
  ];
  const LEGS = {
    stand: ['3.k3b2k3bk3.', '3.k2bk2.k2bk3.', '3.4k2.4k3.'],
    a: ['3.k3b2k3bk3.', '3.k2bk3.kbk3.', '3.4k3.3k3.'],
    b: ['3.k3b2k3bk3.', '3.kbk3.k2bk3.', '3.3k3.4k3.'],
    sstand: ['4.k2b2k2bk4.', '4.kbk2.kbk4.', '4.3k2.3k4.'],
    sa: ['4.k2b2k2bk4.', '3.kbk4.kbk3.', '3.3k4.3k3.'],
    sb: ['4.k2b2k2bk4.', '5.k4bk5.', '5.6k5.'],
  };

  const DEFS = {
    p_front: FRONT.concat(LEGS.stand), p_front_a: FRONT.concat(LEGS.a), p_front_b: FRONT.concat(LEGS.b),
    p_back: BACK.concat(LEGS.stand), p_back_a: BACK.concat(LEGS.a), p_back_b: BACK.concat(LEGS.b),
    p_side: SIDE.concat(LEGS.sstand), p_side_a: SIDE.concat(LEGS.sa), p_side_b: SIDE.concat(LEGS.sb),

    fern: [
      '7.v8.', '5.v.2v.v5.', '4.2v.vV.2v4.', '3.vVv.vV.vVv3.', '2.vVv.v2Vv.vVv2.', '3.2v.v2Vv.2v3.',
      '4.v.v2Vv.v4.', '5.2v2V2v5.', '6.v2Vv6.', '4.8N4.', '4.k6nk4.', '4.k6nk4.', '5.k4nk5.', '5.k4nk5.',
      '6.4k6.', '16.',
    ],
    bowl: ['16.', '16.', '16.', '16.', '16.', '16.', '16.', '16.', '16.', '16.', '16.',
      '3.10k3.', '2.k10ck2.', '3.k8ck3.', '4.8k4.', '16.'],
    bowl_full: ['16.', '16.', '16.', '16.', '16.', '16.', '16.', '16.', '16.', '16.', '4.n2.n.2n5.',
      '3.10k3.', '2.k10ck2.', '3.k8ck3.', '4.8k4.', '16.'],
    trash: ['16.', '4.8k4.', '3.k8Gk3.', '3.10k3.', '4.kgGgGgGk4.', '4.kgGgGgGk4.', '4.kgGgGgGk4.',
      '4.kgGgGgGk4.', '4.kgGgGgGk4.', '4.kgGgGgGk4.', '4.kgGgGgGk4.', '4.kgGgGgGk4.', '4.kgGgGgGk4.',
      '4.k6Gk4.', '5.6k5.', '16.'],
    chair: ['16.', '4.8k4.', '4.k6nk4.', '4.kn4Nnk4.', '4.k6nk4.', '4.kn4Nnk4.', '4.k6nk4.', '3.10k3.',
      '3.k8lk3.', '3.k8Lk3.', '3.10k3.', '3.kn6.nk3.', '3.kn6.nk3.', '3.kn6.nk3.', '3.2k6.2k3.', '16.'],
    clock: ['5.6k5.', '4.k6nk4.', '3.kn6Nnk3.', '3.knk4wknk3.', '3.knk2wkwknk3.', '3.knk2wkwknk3.',
      '3.knkw2kwknk3.', '3.knk4wknk3.', '3.knN4kNnk3.', '3.kn6Nnk3.', '4.k6nk4.', '4.kn4ynk4.',
      '4.knN2yNnk4.', '4.kn2NyNnk4.', '4.knNy2Nnk4.', '4.knN2yNnk4.', '4.kn4Nnk4.', '3.k8nk3.', '3.10k3.'],
    mail: ['16.', '16.', '16.', '16.', '16.', '3.10k3.', '3.k8wk3.', '3.kwk4wkwk3.', '3.k2wk2wk2wk3.',
      '3.k3w2k3wk3.', '3.k8wk3.', '3.10k3.', '16.', '16.', '16.', '16.'],
    note: ['16.', '16.', '16.', '16.', '4.8k4.', '4.k6wk4.', '4.kw3r2wk4.', '4.k6wk4.', '4.kwr2w2rk4.',
      '4.k6wk4.', '4.k2w3rwk4.', '4.k6wk4.', '4.8k4.', '16.', '16.', '16.'],
    page: ['16.', '16.', '16.', '16.', '4.3k.4k4.', '4.k6Lk4.', '4.kL4NLk4.', '4.k6Lk4.', '4.kL3N2Lk4.',
      '4.k6Lk4.', '4.kL4NLk4.', '4.k6Lk4.', '4.2k.k.3k4.', '16.', '16.', '16.'],
    lamp: ['16.', '16.', '16.', '5.6k5.', '4.k6yk4.', '4.k6yk4.', '3.k8yk3.', '3.10k3.', '7.2k7.', '7.2k7.',
      '7.2k7.', '4.8k4.', '4.k6nk4.', '4.k6Nk4.', '4.8k4.', '16.'],
    toilet: ['16.', '4.8k4.', '4.k6Wk4.', '4.k6Wk4.', '4.8k4.', '3.10k3.', '3.k8Wk3.', '3.kW6cWk3.',
      '3.kW6cWk3.', '3.kW6cWk3.', '3.k8Wk3.', '4.k6Wk4.', '5.k4Wk5.', '5.k4Wk5.', '5.6k5.', '16.'],
    bsink: ['16.', '16.', '16.', '16.', '7.2k7.', '7.kGk6.', '2.12k2.', '2.kW8cWk2.', '3.kW6cWk3.',
      '4.k6Wk4.', '4.8k4.', '6.4k6.', '6.k2Gk6.', '6.k2Gk6.', '5.6k5.', '16.'],
    towel: ['16.', '16.', '2.12G2.', '3.10k3.', '3.k8mk3.', '3.k8wk3.', '3.k8mk3.', '3.k8mk3.', '3.k8wk3.',
      '3.k8mk3.', '3.k8mk3.', '3.10k3.', '16.', '16.', '16.', '16.'],
    rack: ['16.', '16.', '2.12G2.', '2.G10.G2.', '2.G10.G2.', '16.', '16.', '16.', '16.', '16.', '16.',
      '16.', '16.', '16.', '16.', '16.'],
    phone: ['16.', '16.', '16.', '16.', '4.8k4.', '3.k8rk3.', '3.kR6rRk3.', '3.10k3.', '4.k6rk4.',
      '4.kr4wrk4.', '4.k6rk4.', '3.10k3.', '2.12N2.', '3.n8.n3.', '3.n8.n3.', '16.'],
    duck: ['1.3k3.', 'k3yk2.', 'kyeykr1.', '2k4yk', 'k5yk', '1.5k1.'],
    music: ['2.3k', '2.k.k', '2.k.k', '3k.k', '5k'],
    heart: ['1.2k1.2k1.', 'k2rk2rk', 'k5rk', '1.k3rk1.', '2.k1rk2.', '3.k3.'],
  };

  function parseRow(row) {
    let out = '';
    row.replace(/(\d*)(\D)/g, (_, n, ch) => { out += ch.repeat(n ? +n : 1); });
    return out;
  }

  function bake(name, rows) {
    const lines = rows.map(parseRow);
    const w = Math.max(...lines.map(l => l.length));
    lines.forEach((l, i) => {
      if (l.length !== w) console.warn(`sprite ${name} row ${i} is ${l.length}px wide, expected ${w}`);
    });
    const c = document.createElement('canvas');
    c.width = w;
    c.height = lines.length;
    const ctx = c.getContext('2d');
    lines.forEach((l, y) => {
      for (let x = 0; x < l.length; x++) {
        const col = PAL[l[x]];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(x, y, 1, 1);
      }
    });
    return c;
  }

  HS.Sprites = {
    PAL,
    baked: {},

    init() {
      for (const [name, rows] of Object.entries(DEFS)) this.baked[name] = bake(name, rows);
    },

    // Draw bottom-centered at (cx, bottom).
    draw(ctx, name, cx, bottom, flip = false, scale = 1) {
      const img = this.baked[name];
      if (!img) return;
      const w = img.width * scale, h = img.height * scale;
      const x = Math.round(cx - w / 2), y = Math.round(bottom - h);
      if (flip) {
        ctx.save();
        ctx.translate(x + w, y);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0, w, h);
        ctx.restore();
      } else {
        ctx.drawImage(img, x, y, w, h);
      }
    },
  };
})();
