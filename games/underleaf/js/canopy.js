'use strict';
/* Plants that stand above the ground: tree canopies, bramble bushes and sunflowers,
   drawn over the ants as a semi-transparent layer that fades when you walk under it.
   Sundews sit on the ground and catch insects. */

const SPRITES = new Map();
function cachedSprite(key, w, h, scale, fn) {
  let s = SPRITES.get(key);
  if (s) return s;
  s = makeSprite(w, h, w / 2, h / 2, scale, fn);
  SPRITES.set(key, s);
  if (SPRITES.size > 100) SPRITES.delete(SPRITES.keys().next().value);
  return s;
}

const LEAF_GREENS = {
  oak: [['#3e6e24', '#8cbc50', '#16300a'], ['#4a7a2a', '#a0cc60', '#1c380c'], ['#355f1e', '#7aac44', '#122808']],
  birch: [['#6a9a34', '#c8e47a', '#2a4410'], ['#7aa83e', '#d8ee8a', '#30500e']],
  willow: [['#6a9a48', '#c0e090', '#2a4a1a'], ['#78a852', '#cceaa0', '#30561e']],
};

/* Leaf colours through the year. Pines stay green. */
const SEASON_LEAVES = {
  oak: [
    [['#5c8e2c', '#b8e474', '#284a10'], ['#6a9a34', '#c4ec80', '#2e5212']],
    null,
    [['#b8641e', '#f0a040', '#5a2a08'], ['#c88a20', '#f8c850', '#6a4008'], ['#9a3a14', '#e07a3a', '#4a1606'], ['#8a8a2a', '#c8c060', '#40400a']],
  ],
  birch: [
    [['#7aaa3a', '#d8f08a', '#34500e']],
    null,
    [['#d4a820', '#fae070', '#6a5008'], ['#c89018', '#f0d060', '#604008'], ['#b8a830', '#e8e080', '#5a5010']],
  ],
  willow: [
    [['#80b050', '#d8f0a8', '#36561e']],
    null,
    [['#b0a03a', '#e8d878', '#5a5014'], ['#c8a840', '#f0dc80', '#6a5418']],
  ],
};
function seasonPals(kind, season) {
  const set = SEASON_LEAVES[kind];
  return (set && set[season]) || LEAF_GREENS[kind] || LEAF_GREENS.oak;
}

/* Winter: a deciduous tree seen from above is a fan of bare branches, dusted with snow. */
function bareTreeSprite(tree) {
  const size = tree.cr * 2.3;
  return cachedSprite('w5' + tree.seed, size, size, 0.75, (g) => {
    const R = mulberry32(tree.seed + 3), cr = tree.cr;
    const wood = tree.kind === 'birch' ? ['#9a948a', '#e4e0d6'] : ['#2e2219', '#6a5440'];
    g.lineCap = 'round';
    const branch = (x, y, a, len, w, depth) => {
      const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
      g.strokeStyle = 'rgba(10,8,4,0.25)'; g.lineWidth = w + 1;
      g.beginPath(); g.moveTo(x + 2, y + 3); g.lineTo(x2 + 2, y2 + 3); g.stroke();
      g.strokeStyle = wood[0]; g.lineWidth = w;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo((x + x2) / 2 + (R() - 0.5) * len * 0.3, (y + y2) / 2 + (R() - 0.5) * len * 0.3, x2, y2); g.stroke();
      // a thin line of snow along the top-left of the thicker branches
      if (tree.kind === 'birch' && w > 1.6) {
        // the black diamond marks of birch bark
        g.strokeStyle = 'rgba(30,24,20,0.75)'; g.lineWidth = Math.max(0.6, w * 0.22);
        const n = Math.ceil(len / 9);
        for (let k = 1; k < n; k++) {
          if (R() < 0.4) continue;
          const f = k / n, px = x + (x2 - x) * f, py = y + (y2 - y) * f, nx = -Math.sin(a), ny = Math.cos(a), h = w * (0.2 + R() * 0.25);
          g.beginPath(); g.moveTo(px - nx * h, py - ny * h); g.lineTo(px + nx * h, py + ny * h); g.stroke();
        }
      }
      if (w > 1.1) {
        // snow lying along the top of the branch, thickest on the big limbs
        const sw = Math.max(0.7, w * 0.3), ox = -w * 0.38, oy = -w * 0.44;
        g.strokeStyle = 'rgba(150,170,205,0.5)'; g.lineWidth = sw + 0.8;
        g.beginPath(); g.moveTo(x + ox + 0.4, y + oy + 0.5); g.lineTo(x2 + ox + 0.4, y2 + oy + 0.5); g.stroke();
        g.strokeStyle = 'rgba(252,253,255,0.95)'; g.lineWidth = sw;
        g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x2 + ox, y2 + oy); g.stroke();
        if (w > 3 && R() < 0.5) {
          const gr = g.createRadialGradient(x2 - 1, y2 - 1.5, 0, x2, y2, w * 0.9);
          gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.75, '#e8eef8'); gr.addColorStop(1, 'rgba(200,215,235,0)');
          g.fillStyle = gr; g.beginPath(); g.arc(x2, y2, w * 0.9, 0, TAU); g.fill();
        }
      }
      if (depth > 0) {
        const n = R() < 0.55 ? 2 : 1;
        for (let i = 0; i < n; i++) branch(x2, y2, a + (R() - 0.5) * 1.1, len * (0.62 + R() * 0.2), w * 0.66, depth - 1);
      }
    };
    const limbs = 6 + ((R() * 3) | 0);
    for (let i = 0; i < limbs; i++) branch(0, 0, (i / limbs) * TAU + R() * 0.5, cr * 0.34, tree.tr * 0.34, 4);
    g.fillStyle = 'rgba(120,80,40,0.7)';
    for (let i = 0; i < 14; i++) {
      const a = R() * TAU, d = cr * (0.3 + R() * 0.6);
      g.beginPath(); g.ellipse(Math.cos(a) * d, Math.sin(a) * d, 3, 1.6, R() * 3, 0, TAU); g.fill();
    }
  });
}

function canopySprite(tree, season = 1) {
  if (season === 3 && tree.kind !== 'pine') return bareTreeSprite(tree);
  const pals = seasonPals(tree.kind, season);
  const size = tree.cr * 2.3;
  return cachedSprite('c2' + tree.seed + '_' + season, size, size, 0.75, (g) => {
    const R = mulberry32(tree.seed), cr = tree.cr;
    const L = { x: -0.5, y: -0.6 };
    if (tree.kind === 'pine') {
      for (let layer = 4; layer >= 0; layer--) {
        const rr = cr * (0.35 + layer * 0.17);
        const n = 26 + layer * 6;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + R() * 0.2;
          const tipx = Math.cos(a) * rr, tipy = Math.sin(a) * rr;
          const gr = g.createLinearGradient(0, 0, tipx, tipy);
          gr.addColorStop(0, '#1a3418'); gr.addColorStop(1, layer % 2 ? '#3e6a3a' : '#4a7a44');
          g.fillStyle = gr;
          g.beginPath();
          g.moveTo(Math.cos(a - 0.12) * rr * 0.3, Math.sin(a - 0.12) * rr * 0.3);
          g.lineTo(tipx, tipy);
          g.lineTo(Math.cos(a + 0.12) * rr * 0.3, Math.sin(a + 0.12) * rr * 0.3);
          g.closePath(); g.fill();
        }
        g.strokeStyle = 'rgba(160,210,140,0.18)'; g.lineWidth = 0.8;
        for (let i = 0; i < n * 2; i++) {
          const a = R() * TAU, d = rr * (0.4 + R() * 0.6);
          g.beginPath(); g.moveTo(Math.cos(a) * d, Math.sin(a) * d); g.lineTo(Math.cos(a) * d + Math.cos(a + 0.5) * 6, Math.sin(a) * d + Math.sin(a + 0.5) * 6); g.stroke();
        }
      }
      radialFill(g, -cr * 0.2, -cr * 0.25, cr * 0.9, [[0, 'rgba(255,250,200,0.14)'], [1, 'rgba(255,250,200,0)']]);
      if (season === 3) {
        // snow caught on the upper-left of each needle tier
        g.globalCompositeOperation = 'source-atop';
        for (let i = 0; i < 120; i++) {
          const a = R() * TAU, d = cr * (0.15 + R() * 0.85), x = Math.cos(a) * d, y = Math.sin(a) * d, r = 4 + R() * 8;
          // clumps settle on the sunlit, upper-left side of each tier
          if (Math.cos(a - Math.PI * 1.25) < -0.3 && R() < 0.6) continue;
          g.fillStyle = 'rgba(90,110,150,0.35)'; g.beginPath(); g.ellipse(x + 1.5, y + 2, r, r * 0.7, a, 0, TAU); g.fill();
          const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.35, 0, x, y, r);
          gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.7, '#eef3fb'); gr.addColorStop(1, '#c8d6ea');
          g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r, r * 0.7, a, 0, TAU); g.fill();
        }
        g.globalCompositeOperation = 'source-over';
      }
      return;
    }
    if (tree.kind === 'willow') {
      for (let i = 0; i < 520; i++) {
        const a = R() * TAU, d = cr * (0.15 + R() * 0.85);
        const pal = pals[(R() * pals.length) | 0];
        g.strokeStyle = R() < 0.5 ? pal[0] : pal[1]; g.lineWidth = 1.4; g.lineCap = 'round';
        g.beginPath(); g.moveTo(Math.cos(a) * d * 0.5, Math.sin(a) * d * 0.5);
        g.quadraticCurveTo(Math.cos(a + 0.2) * d * 0.8, Math.sin(a + 0.2) * d * 0.8, Math.cos(a + 0.1) * d, Math.sin(a + 0.1) * d);
        g.stroke();
      }
      return;
    }
    const birch = tree.kind === 'birch';
    // silhouette made of many small lobes, so the edge reads as foliage, not a ball
    const lobes = [];
    for (let i = 0; i < 140; i++) {
      const a = R() * TAU, d = cr * 0.86 * Math.pow(R(), 0.55);
      lobes.push([Math.cos(a) * d, Math.sin(a) * d, cr * (0.09 + R() * 0.08)]);
    }
    g.fillStyle = birch ? '#3a5a1a' : '#1c3410';
    for (const [x, y, r] of lobes) { g.beginPath(); g.arc(x, y, r * 1.15, 0, TAU); g.fill(); }
    g.globalCompositeOperation = 'source-atop';
    for (const [x, y, r] of lobes) {
      const lit = clamp(0.5 - (x * 0.6 + y * 0.8) / (cr * 1.6), 0, 1);
      const pal = pals[(R() * pals.length) | 0];
      const gr = g.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.1, x, y, r * 1.1);
      gr.addColorStop(0, lit > 0.5 ? pal[1] : pal[0]); gr.addColorStop(0.7, pal[0]); gr.addColorStop(1, pal[2]);
      g.fillStyle = gr; g.globalAlpha = 0.85;
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    g.globalAlpha = 1;
    // individual leaves catching the light
    for (let i = 0; i < 900; i++) {
      const a = R() * TAU, d = cr * 0.9 * Math.sqrt(R());
      const x = Math.cos(a) * d, y = Math.sin(a) * d;
      const lit = clamp(0.55 - (x * 0.6 + y * 0.8) / (cr * 1.4), 0, 1);
      const pal = pals[(R() * pals.length) | 0];
      g.fillStyle = R() < lit ? rgba(pal[1], 0.55) : rgba(pal[2], 0.45);
      g.beginPath(); g.ellipse(x, y, birch ? 2.4 : 3.2, birch ? 1.6 : 1.8, R() * 3, 0, TAU); g.fill();
    }
    // overall light from the top left, shade to the bottom right
    const sh = g.createRadialGradient(-cr * 0.35, -cr * 0.4, cr * 0.1, 0, 0, cr * 1.1);
    sh.addColorStop(0, 'rgba(255,250,200,0.18)'); sh.addColorStop(0.55, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(5,15,0,0.45)');
    g.fillStyle = sh; g.fillRect(-cr * 1.2, -cr * 1.2, cr * 2.4, cr * 2.4);
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 26; i++) {
      const a = R() * TAU, d = cr * (0.15 + R() * 0.7);
      radialFill(g, Math.cos(a) * d, Math.sin(a) * d, 5 + R() * 11, [[0, 'rgba(0,0,0,0.85)'], [1, 'rgba(0,0,0,0)']]);
    }
    g.globalCompositeOperation = 'source-over';
  });
}

/* A bramble leaf: three to five toothed leaflets on a short stalk. */
function brambleLeaf(g, R, x, y, a, size, tint) {
  const n = R() < 0.5 ? 3 : 5;
  const leaflets = n === 3 ? [[0, 1], [-0.85, 0.8], [0.85, 0.8]] : [[0, 1], [-0.7, 0.85], [0.7, 0.85], [-1.6, 0.65], [1.6, 0.65]];
  g.save(); g.translate(x, y); g.rotate(a);
  for (const pass of [0, 1]) {
    for (const [la, ls] of leaflets) {
      g.save(); g.rotate(la); const L = size * ls;
      if (pass === 0) g.translate(1.5, 2);
      g.beginPath(); g.moveTo(0, 0);
      // toothed edge: small zig-zags along each side
      const teeth = 6;
      for (let i = 1; i <= teeth; i++) { const f = i / teeth, wv = Math.sin(f * Math.PI) * L * 0.36; g.lineTo(L * f - L * 0.04, -wv - (i % 2 ? 1 : 0)); }
      for (let i = teeth; i >= 1; i--) { const f = i / teeth, wv = Math.sin(f * Math.PI) * L * 0.36; g.lineTo(L * f - L * 0.04, wv + (i % 2 ? 1 : 0)); }
      g.closePath();
      if (pass === 0) { g.fillStyle = 'rgba(10,25,5,0.3)'; g.fill(); }
      else {
        const gr = g.createLinearGradient(0, -L * 0.4, 0, L * 0.4);
        gr.addColorStop(0, tint[1]); gr.addColorStop(0.5, tint[0]); gr.addColorStop(1, tint[2]);
        g.fillStyle = gr; g.fill();
        g.strokeStyle = 'rgba(220,240,190,0.4)'; g.lineWidth = 0.5;
        g.beginPath(); g.moveTo(0, 0); g.lineTo(L * 0.92, 0); g.stroke();
        for (let i = 1; i < 5; i++) { const f = i / 5; g.beginPath(); g.moveTo(L * f, 0); g.lineTo(L * f + L * 0.08, -L * 0.22 * Math.sin(f * Math.PI)); g.moveTo(L * f, 0); g.lineTo(L * f + L * 0.08, L * 0.22 * Math.sin(f * Math.PI)); g.stroke(); }
      }
      g.restore();
    }
  }
  g.restore();
}

const BRAMBLE_TINTS = [
  [['#4e8a2e', '#9cd060', '#22420e'], ['#5a9634', '#acdc6a', '#284a10'], ['#4a7a2c', '#8cc054', '#22420e'], ['#6a8a2a', '#b0c860', '#2e4010']],
  [['#3e6e26', '#7cb048', '#1c3a10'], ['#4a7a2c', '#8cc054', '#22420e'], ['#5a6a2a', '#a0a848', '#2e3a10'], ['#6a4a2a', '#b07a40', '#3a2410']],
  [['#9a3a22', '#e07a50', '#4a1408'], ['#b8641e', '#f0a040', '#5a2a08'], ['#7a2a3a', '#c05a70', '#3a0a16'], ['#6a4a2a', '#b07a40', '#3a2410']],
  [['#6a4a2a', '#a07a50', '#3a2410'], ['#5a4030', '#907060', '#2a1a10'], ['#6a4a2a', '#a07a50', '#3a2410'], ['#5a4030', '#907060', '#2a1a10']],
];
function bushSprite(f, season = 1) {
  return cachedSprite('b6' + f.seed + '_' + season, 150, 150, 1.5, (g) => {
    const R = mulberry32(f.seed);
    const tints = BRAMBLE_TINTS[season];
    const winter = season === 3;
    const canes = [];
    const nC = 11 + ((R() * 4) | 0);
    for (let i = 0; i < nC; i++) {
      const a = (i / nC) * TAU + R() * 0.5, len = 44 + R() * 18, bend = (R() - 0.5) * 1.1, w = 3 + R() * 1.4;
      const pts = [];
      for (let k = 0; k <= 12; k++) { const t = k / 12, aa = a + bend * t; pts.push({ x: Math.cos(aa) * len * t, y: Math.sin(aa) * len * t, aa, w: w * (1 - t * 0.6) }); }
      canes.push(pts);
    }
    // canes first: shadow, red-brown wood, a lit edge, and hooked thorns
    for (const pts of canes) {
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (const [col, k, o] of [['rgba(10,15,4,0.35)', 1.6, 2], ['#5a2a2a', 1, 0], ['rgba(230,150,140,0.45)', 0.35, -0.7]]) {
        for (let k2 = 0; k2 < pts.length - 1; k2++) {
          g.strokeStyle = col; g.lineWidth = pts[k2].w * k;
          g.beginPath(); g.moveTo(pts[k2].x + o, pts[k2].y + o); g.lineTo(pts[k2 + 1].x + o, pts[k2 + 1].y + o); g.stroke();
        }
      }
      for (let k2 = 1; k2 < pts.length - 1; k2++) {
        const q = pts[k2], side = k2 % 2 ? 1 : -1;
        const nx = -Math.sin(q.aa) * side, ny = Math.cos(q.aa) * side;
        g.fillStyle = '#e8b8a0';
        g.beginPath();
        g.moveTo(q.x + nx * q.w * 0.4 - Math.cos(q.aa) * 1.2, q.y + ny * q.w * 0.4 - Math.sin(q.aa) * 1.2);
        g.lineTo(q.x + nx * (q.w * 0.4 + 2.6) - Math.cos(q.aa) * 1.6, q.y + ny * (q.w * 0.4 + 2.6) - Math.sin(q.aa) * 1.6);
        g.lineTo(q.x + nx * q.w * 0.4 + Math.cos(q.aa) * 1, q.y + ny * q.w * 0.4 + Math.sin(q.aa) * 1);
        g.closePath(); g.fill();
      }
    }
    // leaves along the canes, outer ones younger and lighter; winter strips most of them
    for (const pts of canes) {
      for (let k2 = 1; k2 < pts.length; k2++) {
        const q = pts[k2], side = k2 % 2 ? 1 : -1;
        if (winter && R() < 0.85) continue;
        const tint = R() < 0.1 ? tints[3] : tints[(R() * 3) | 0];
        brambleLeaf(g, R, q.x, q.y, q.aa + side * (0.8 + R() * 0.5), 9 + R() * 4 + (k2 < 6 ? 3 : 0), tint);
      }
    }
    // a dense leafy heart where the canes crowd together
    for (let i = 0; i < (winter ? 4 : 26); i++) {
      const a = R() * TAU, d = 30 * Math.sqrt(R());
      brambleLeaf(g, R, Math.cos(a) * d, Math.sin(a) * d, R() * TAU, 10 + R() * 4, tints[(R() * 3) | 0]);
    }
    // give the shrub volume: lit from the top left, darker underneath and in the gaps
    g.globalCompositeOperation = 'source-atop';
    const vol = g.createRadialGradient(-22, -26, 4, 0, 0, 74);
    vol.addColorStop(0, 'rgba(255,250,210,0.28)'); vol.addColorStop(0.45, 'rgba(0,0,0,0)'); vol.addColorStop(1, 'rgba(5,15,0,0.55)');
    g.fillStyle = vol; g.fillRect(-75, -75, 150, 150);
    g.globalCompositeOperation = 'source-over';
    if (winter) {
      g.lineCap = 'round';
      for (const pts of canes) for (let k2 = 0; k2 < pts.length - 1; k2 += 1) {
        const w2 = Math.max(1, pts[k2].w * 0.6);
        g.strokeStyle = 'rgba(140,160,200,0.45)'; g.lineWidth = w2 + 0.8;
        g.beginPath(); g.moveTo(pts[k2].x - 0.6, pts[k2].y - 0.8); g.lineTo(pts[k2 + 1].x - 0.6, pts[k2 + 1].y - 0.8); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = w2;
        g.beginPath(); g.moveTo(pts[k2].x - 1, pts[k2].y - 1.5); g.lineTo(pts[k2 + 1].x - 1, pts[k2 + 1].y - 1.5); g.stroke();
      }
      // a mound of snow heaped in the middle of the bramble
      const gr = g.createRadialGradient(-6, -8, 2, 0, 0, 26);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.6, 'rgba(238,244,252,0.9)'); gr.addColorStop(1, 'rgba(210,222,240,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 26, 0, TAU); g.fill();
      return;
    }
    // a few white-pink flowers (spring and summer)
    for (let i = 0; i < (season < 2 ? 3 : 0); i++) {
      const pts = canes[(R() * canes.length) | 0], q = pts[8 + ((R() * 4) | 0)];
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * TAU;
        g.fillStyle = k % 2 ? '#fbeef0' : '#f4d8e0';
        g.beginPath(); g.ellipse(q.x + Math.cos(a) * 3.2, q.y + Math.sin(a) * 3.2, 3, 2.2, a, 0, TAU); g.fill();
      }
      radialFill(g, q.x, q.y, 1.8, [[0, '#f0d060'], [1, '#c8a030']]);
    }
  });
}

function sunflowerSprite(f, season = 1) {
  const autumn = season === 2;
  return cachedSprite('s' + f.seed + '_' + season, 110, 110, 1.6, (g) => {
    const R = mulberry32(f.seed);
    for (let i = 0; i < 4; i++) {
      const a = R() * TAU;
      g.save(); g.rotate(a);
      g.beginPath(); g.moveTo(10, 0); g.quadraticCurveTo(30, -18, 48, 0); g.quadraticCurveTo(30, 18, 10, 0);
      const gr = g.createLinearGradient(0, -14, 0, 14);
      gr.addColorStop(0, autumn ? '#a89040' : '#78a840'); gr.addColorStop(1, autumn ? '#5a4418' : '#2e5418');
      g.fillStyle = gr; g.fill();
      g.restore();
    }
    // in autumn the petals wither and droop and the head turns to seed
    const petals = autumn ? 15 : 26, tip = autumn ? 25 : 33;
    for (let i = 0; i < petals; i++) {
      const a = (i / petals) * TAU + (autumn ? R() * 0.3 : 0);
      g.save(); g.rotate(a);
      g.beginPath(); g.moveTo(14, -3); g.quadraticCurveTo(tip * 0.78, -5, tip, 0); g.quadraticCurveTo(tip * 0.78, 5, 14, 3); g.closePath();
      const gr = g.createLinearGradient(14, 0, tip, 0);
      if (autumn) { gr.addColorStop(0, '#8a5a18'); gr.addColorStop(1, i % 2 ? '#b07a28' : '#c89040'); }
      else { gr.addColorStop(0, '#e0a010'); gr.addColorStop(1, i % 2 ? '#ffd23a' : '#ffe060'); }
      g.fillStyle = gr; g.fill();
      g.restore();
    }
    radialFill(g, 0, 0, 17, [[0, '#4a2c10'], [0.8, '#3a200a'], [1, '#2a1406']]);
    for (let i = 0; i < 220; i++) {
      const a = i * 2.39996, r = Math.sqrt(i / 220) * 15.5;
      g.fillStyle = i % 3 ? '#6a4420' : '#8a6030';
      g.beginPath(); g.arc(Math.cos(a) * r, Math.sin(a) * r, 0.75, 0, TAU); g.fill();
    }
    radialFill(g, -5, -5, 10, [[0, 'rgba(255,240,200,0.18)'], [1, 'rgba(255,240,200,0)']]);
  });
}

function canopyAlpha(game, x, y, r) {
  const p = game.player;
  if (!p || p.dead) return 0.78;
  const d = dist(p.x, p.y, x, y);
  return d < r * 0.95 ? lerp(0.28, 0.78, smoothstep(r * 0.4, r * 0.95, d)) : 0.78;
}

/* Draw a plant's look for the current season, cross-fading into the next one while the seasons turn. */
function seasonal(game, makeSprite, draw) {
  const A = game.seasonA ?? 1, B = game.seasonB ?? 1, k = game.seasonK || 0;
  if (k < 0.02 || A === B) { draw(makeSprite(A), 1); return; }
  if (k > 0.98) { draw(makeSprite(B), 1); return; }
  draw(makeSprite(A), 1 - k);
  draw(makeSprite(B), k);
}

function drawCanopies(ctx, game, t) {
  const v = game.view4, sw = game.sw || [0, 1, 0, 0];
  for (const f of game.activePlants) {
    if (f.type === 'sundew' || !game.inView(f, 120)) continue;
    const isBush = f.type === 'bush';
    // sunflowers die back over winter and come up again in spring
    const presence = isBush ? 1 : 1 - sw[3];
    if (presence < 0.03) continue;
    const a = canopyAlpha(game, f.x, f.y, isBush ? 60 : 40) * presence;
    const sway = Math.sin(t * 0.8 + f.seed) * 1.5;
    seasonal(game, (s) => (isBush ? bushSprite(f, s) : sunflowerSprite(f, s === 3 ? 2 : s)), (spr, w) => {
      ctx.globalAlpha = a * w;
      if (w > 0.5) softShadow(ctx, f.x + 10, f.y + 14, 0, spr.w * 0.42, spr.h * 0.38, 0.25);
      ctx.drawImage(spr.c, f.x - spr.ox + sway, f.y - spr.oy, spr.w, spr.h);
    });
    const fruit = 1 - sw[3];
    if (isBush && fruit > 0.05) {
      ctx.globalAlpha = a * fruit;
      const R = mulberry32(f.seed + 1);
      for (let i = 0; i < 10; i++) {
        const ang = R() * TAU, d = 10 + R() * 30, ripe = i < f.berries;
        if (!ripe && i >= f.berries + 3) continue;
        const bx = f.x + Math.cos(ang) * d + sway, by = f.y + Math.sin(ang) * d;
        radialFill(ctx, bx, by, 4.5, ripe ? [[0, '#8a4a7a'], [0.5, '#3a1030'], [1, '#1a0614']] : [[0, '#ff8a7a'], [0.6, '#c8302a'], [1, '#6a1010']]);
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(bx - 1.4, by - 1.4, 1, 0, TAU); ctx.fill();
      }
    }
  }
  for (const tr of game.activeTrees) {
    if (tr.x + tr.cr < v.x0 || tr.x - tr.cr > v.x1 || tr.y + tr.cr < v.y0 || tr.y - tr.cr > v.y1) continue;
    const a = canopyAlpha(game, tr.x, tr.y, tr.cr);
    const sway = Math.sin(t * 0.5 + tr.seed) * 3, sy = Math.cos(t * 0.4 + tr.seed) * 2;
    seasonal(game, (s) => canopySprite(tr, s), (spr, w) => {
      ctx.globalAlpha = a * w;
      ctx.drawImage(spr.c, tr.x - spr.ox + sway, tr.y - spr.oy + sy, spr.w, spr.h);
    });
  }
  ctx.globalAlpha = 1;
}

/* A round-leaved sundew: sticky red tentacles with glistening drops. */
function drawSundew(ctx, f, t) {
  const R = mulberry32(f.seed);
  const curl = f.curl || 0;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + R() * 0.3, len = 13 + R() * 4;
    const lx = f.x + Math.cos(a) * len, ly = f.y + Math.sin(a) * len;
    ctx.strokeStyle = '#7a5a2a'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(lx, ly); ctx.stroke();
    radialFill(ctx, lx, ly, 6, [[0, '#9ab048'], [0.7, '#c86a3a'], [1, 'rgba(160,60,30,0)']]);
    for (let k = 0; k < 12; k++) {
      const ta = (k / 12) * TAU, tl = 6 * (1 - curl * 0.55);
      const ex = lx + Math.cos(ta + curl * 0.8) * tl, ey = ly + Math.sin(ta + curl * 0.8) * tl;
      ctx.strokeStyle = '#c8302a'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(ex, ey); ctx.stroke();
      const glint = 0.6 + 0.4 * Math.sin(t * 2 + k + i);
      ctx.fillStyle = `rgba(255,230,240,${0.55 * glint})`;
      ctx.beginPath(); ctx.arc(ex, ey, 0.9, 0, TAU); ctx.fill();
    }
  }
  ctx.fillStyle = '#c8302a';
  ctx.beginPath(); ctx.arc(f.x, f.y, 2.5, 0, TAU); ctx.fill();
}
