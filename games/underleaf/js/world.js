'use strict';
/* The infinite meadow: biomes from layered noise, water, chunked scenery
   generated from the seed, collision, and sparse scent-trail grids. */

const CHUNK = 512, PAD = 4, WSTEP = 4, PC = 16, PN = CHUNK / PC;
const BIOME_NAMES = { meadow: 'Meadow', wood: 'Woodland floor', beach: 'Sandy shore', marsh: 'Marsh', dry: 'Dry heath', sea: 'Open water' };
const GROUND = {
  meadow: hexRgb('#71803d'), wood: hexRgb('#4e4529'), beach: hexRgb('#d6c294'),
  wet: hexRgb('#a8946e'), marsh: hexRgb('#4a5a30'), dry: hexRgb('#9e8c5a'),
};
const BLOBS = {
  meadow: ['#7f8d45', '#66783a', '#8c8c4e', '#7a6844', '#5c7133', '#959159', '#6b5b3c', '#88994d'],
  wood: ['#3e3620', '#5a4a2c', '#4a4a26', '#6a5434', '#33301a', '#57502e'],
  beach: ['#e2d0a2', '#c8b484', '#efe0b8', '#bca878', '#d8c08c'],
  marsh: ['#3e5028', '#566a34', '#4a4a2a', '#5e6e3a', '#33441e'],
  dry: ['#a89660', '#8c7a4a', '#b8a874', '#9a9060', '#7e7048'],
};
const PROP_TABLE = {
  meadow: [['tuft', 45], ['flower', 14], ['pebble', 10], ['leaf', 4], ['twig', 3], ['mush', 2], ['moss', 4]],
  wood: [['leaf', 34], ['twig', 10], ['mush', 8], ['moss', 10], ['cone', 6], ['acorn', 5], ['log', 1.3], ['fern', 8], ['tuftD', 5], ['pebble', 4]],
  beach: [['shell', 12], ['pebble', 12], ['weed', 6], ['drift', 1.2], ['ripple', 10], ['tuftB', 7], ['crabhole', 1.5]],
  marsh: [['reed', 20], ['tuftD', 16], ['moss', 8], ['mud', 8], ['iris', 4], ['pebble', 3]],
  dry: [['rock', 3], ['pebble', 14], ['tuftY', 18], ['thistle', 5], ['crack', 6], ['ripple', 2]],
};
const PROP_COUNT = { meadow: 80, wood: 90, beach: 46, marsh: 74, dry: 56, sea: 6 };
const MAP_COL = { meadow: '#6b7a3a', wood: '#46402a', beach: '#cdb88a', marsh: '#4a5a30', dry: '#9a8858', sea: '#3d6a76' };

function weighted(R, table) {
  let tot = 0;
  for (const [, w] of table) tot += w;
  let r = R() * tot;
  for (const [k, w] of table) { r -= w; if (r <= 0) return k; }
  return table[0][0];
}

class World {
  constructor(seed, playerSpecies) {
    this.seed = seed;
    this.playerSpecies = playerSpecies;
    this.home = { x: 0, y: 0 };
    this.data = new Map();
    this.chunks = new Map();
    this.maxChunks = 42;
    this.maxData = 700;
    this.bakeScale = 1;
    this.pher = new Map();
    this.pherAcc = 0; this.pherImgAcc = 0;
    this.activePits = [];
    this.extraProps = [{ type: 'nest', layer: 2, species: playerSpecies, x: 0, y: 0, r: 300, seed: 11 }];
    this.extraObstacles = playerSpecies === 'bullet' ? [{ x: -8, y: -96, r: 62 }] : [];
  }

  /* ------------------------------------------------------------- biomes */

  em(x, y) {
    let e = fbm(x / 2400, y / 2400, this.seed, 4);
    let m = fbm(x / 2000 + 50.3, y / 2000 - 70.7, this.seed + 7, 3);
    const keep = smoothstep(1500, 500, Math.hypot(x, y));
    if (keep > 0) { e = lerp(e, 0.62, keep); m = lerp(m, 0.44, keep); }
    return [e, m];
  }
  classify(e, m) {
    if (e < 0.34) return 'sea';
    if (e < 0.385) return 'beach';
    if (m > 0.6) return 'marsh';
    if (m > 0.5) return 'wood';
    if (m < 0.36) return 'dry';
    return 'meadow';
  }
  biome(x, y) { const [e, m] = this.em(x, y); return this.classify(e, m); }
  riverVal(x, y) { return fbm(x / 1500 + 3.3, y / 1500 + 7.1, this.seed + 31, 3); }
  waterFrom(x, y, e, m) {
    let v = (0.34 - e) * 30;
    if (e > 0.355) {
      const rk = smoothstep(1100, 1700, Math.hypot(x, y));
      if (rk > 0) v = Math.max(v, (0.013 - Math.abs(this.riverVal(x, y) - 0.5)) * 380 * rk);
    }
    if (m > 0.55 && e > 0.36) {
      const p = fbm(x / 420 + 9.1, y / 420 - 3.7, this.seed + 13, 3);
      v = Math.max(v, (p - 0.6) * 60 * smoothstep(0.55, 0.62, m) * smoothstep(1300, 1800, Math.hypot(x, y)));
    }
    return v;
  }
  waterVal(x, y) { const [e, m] = this.em(x, y); return this.waterFrom(x, y, e, m); }
  waterAt(x, y) { return this.waterVal(x, y) > 0; }
  /* Water a walker cannot cross: open water that is not spanned by a log bridge. */
  wetAt(x, y) {
    if (this.waterVal(x, y) <= 0) return false;
    const d = this.getData(Math.floor(x / CHUNK), Math.floor(y / CHUNK));
    for (const b of d.nearBridges || this.bridgeList(d)) if (segDist2(x, y, b) < (b.w / 2) ** 2) return false;
    return true;
  }
  bridgeList(d) {
    const list = [];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const n = this.getData(d.cx + dx, d.cy + dy);
      for (const b of n.bridges) list.push(b);
    }
    d.nearBridges = list;
    return list;
  }
  groundRGB(x, y) {
    const [e, m] = this.em(x, y);
    const c = GROUND.meadow.slice();
    const mix = (to, k) => { if (k > 0) for (let i = 0; i < 3; i++) c[i] += (to[i] - c[i]) * k; };
    mix(GROUND.wood, smoothstep(0.47, 0.53, m));
    mix(GROUND.marsh, smoothstep(0.57, 0.63, m));
    mix(GROUND.dry, 1 - smoothstep(0.33, 0.39, m));
    mix(GROUND.beach, 1 - smoothstep(0.38, 0.4, e));
    mix(GROUND.wet, 1 - smoothstep(0.34, 0.36, e));
    // patchiness: lush clumps and thin, bare soil in grassland; damp hollows in woods
    const grassy = smoothstep(0.4, 0.42, e) * (1 - smoothstep(0.5, 0.56, m)) * smoothstep(0.3, 0.38, m);
    if (grassy > 0) {
      const lush = vnoise(x / 230, y / 230, this.seed + 21), bare = vnoise(x / 120 + 9, y / 120, this.seed + 22);
      mix([88, 120, 46], grassy * smoothstep(0.55, 0.8, lush) * 0.55);
      mix([128, 104, 66], grassy * smoothstep(0.62, 0.85, bare) * 0.6);
    }
    const woody = smoothstep(0.47, 0.55, m);
    if (woody > 0) mix([60, 64, 34], woody * smoothstep(0.55, 0.85, vnoise(x / 200, y / 200, this.seed + 23)) * 0.5);
    const n = 0.9 + 0.2 * vnoise(x / 90, y / 90, this.seed + 5);
    return [c[0] * n, c[1] * n, c[2] * n];
  }

  /* Gentle relief for hillshading: the big elevation field plus little humps and dips. */
  relief(x, y) {
    return this.em(x, y)[0] * 260 + vnoise(x / 170, y / 170, this.seed + 31) * 14 + vnoise(x / 55, y / 55, this.seed + 32) * 4;
  }

  /* --------------------------------------------------------- chunk data */

  getData(cx, cy) {
    const k = cx * 100000 + cy;
    let d = this.data.get(k);
    if (d) {
      if (++d.hits > 40) { d.hits = 0; this.data.delete(k); this.data.set(k, d); }
      return d;
    }
    d = this.genData(cx, cy);
    d.hits = 0;
    this.data.set(k, d);
    if (this.data.size > this.maxData) this.data.delete(this.data.keys().next().value);
    return d;
  }

  genData(cx, cy) {
    const R = mulberry32(hashInt(cx, cy, this.seed));
    const x0 = cx * CHUNK, y0 = cy * CHUNK;
    const props = [], obstacles = [], features = [], flowers = [];
    const home = (x, y, r) => x * x + y * y < r * r;
    const featClear = (x, y, r) => features.every((f) => dist2(x, y, f.x, f.y) > (f.r + r) ** 2);

    for (let i = 0; i < 34; i++) {
      const x = x0 + R() * CHUNK, y = y0 + R() * CHUNK;
      const [e, m] = this.em(x, y);
      const b = this.classify(e, m);
      const pal = BLOBS[b === 'sea' ? 'beach' : b];
      props.push({ type: 'blob', layer: 0, x, y, r: 40 + R() * R() * 180, c: pal[(R() * pal.length) | 0], al: 0.22 + R() * 0.3 });
    }

    const [ce, cm] = this.em(x0 + 256, y0 + 256);
    const cb = this.classify(ce, cm);
    const place = (r) => {
      for (let t = 0; t < 6; t++) {
        const x = x0 + 90 + R() * (CHUNK - 180), y = y0 + 90 + R() * (CHUNK - 180);
        const [e, m] = this.em(x, y);
        if (this.waterFrom(x, y, e, m) > -0.4 || home(x, y, 260 + r) || !featClear(x, y, r + 40)) continue;
        return { x, y, b: this.classify(e, m) };
      }
      return null;
    };
    const patchChance = { meadow: 0.24, marsh: 0.12, wood: 0.08, dry: 0.03, beach: 0, sea: 0 }[cb];
    if (R() < patchChance) {
      const s = place(90);
      if (s) {
        const f = { type: 'patch', x: s.x, y: s.y, r: 80, id: `p${cx},${cy}`, aphids: [], breedT: 15 };
        features.push(f);
        props.push({ type: 'clover', layer: 2, x: s.x, y: s.y, pr: 80, r: 110, seed: (R() * 1e9) | 0 });
      }
    }
    const pitChance = { dry: 0.32, beach: 0.22, meadow: 0.06, wood: 0.02, marsh: 0, sea: 0 }[cb];
    if (R() < pitChance) {
      const s = place(60);
      if (s) {
        const r = 50 + R() * 10;
        features.push({ type: 'pit', kind: 'antlion', x: s.x, y: s.y, r, jawVis: 0, jawA: 0, busy: false, id: `a${cx},${cy}` });
        props.push({ type: 'pit', layer: 2, x: s.x, y: s.y, pr: r, r: r + 14, seed: (R() * 1e9) | 0 });
      }
    }
    const region = (size, salt, chance, okBiomes, minHome, fn) => {
      const rx = Math.floor(cx / size), ry = Math.floor(cy / size);
      const RR = mulberry32(hashInt(rx, ry, this.seed + salt));
      const ccx = rx * size + Math.floor(RR() * size), ccy = ry * size + Math.floor(RR() * size);
      const has = RR() < chance, extra = RR();
      if (!has || ccx !== cx || ccy !== cy) return;
      const s = place(140);
      if (!s || !okBiomes.includes(s.b) || home(s.x, s.y, minHome)) return;
      fn(s, extra);
    };
    region(3, 99, 0.62, ['meadow', 'wood', 'dry', 'marsh'], 1500, (s, extra) => {
      let sp = RIVALS[Math.floor(extra * RIVALS.length)];
      if (sp === this.playerSpecies) sp = this.playerSpecies === 'wood' ? 'fire' : 'wood';
      features.push({ type: 'nest', species: sp, x: s.x, y: s.y, r: 170, id: `n${cx},${cy}` });
      if (sp === 'bullet') obstacles.push({ x: s.x - 8, y: s.y - 96, r: 62 });
      props.push({ type: 'nest', layer: 2, species: sp, x: s.x, y: s.y, r: 300, seed: (R() * 1e9) | 0 });
    });
    // log bridges over rivers, so walkers can cross
    const bridges = [];
    if (cb !== 'sea' && R() < 0.8) {
      for (let t = 0; t < 8 && !bridges.length; t++) {
        const x = x0 + 60 + R() * (CHUNK - 120), y = y0 + 60 + R() * (CHUNK - 120);
        const [e, m] = this.em(x, y);
        if (e < 0.38 || this.waterFrom(x, y, e, m) <= 0) continue;
        const gx = this.riverVal(x + 6, y) - this.riverVal(x - 6, y), gy = this.riverVal(x, y + 6) - this.riverVal(x, y - 6);
        const gl = Math.hypot(gx, gy);
        if (gl < 1e-6) continue;
        const ux = gx / gl, uy = gy / gl;
        for (let L = 50; L <= 130; L += 16) {
          if (this.waterVal(x + ux * L, y + uy * L) < -0.3 && this.waterVal(x - ux * L, y - uy * L) < -0.3) {
            const b = { x1: x - ux * (L + 10), y1: y - uy * (L + 10), x2: x + ux * (L + 10), y2: y + uy * (L + 10), w: 26 };
            bridges.push(b);
            props.push({ type: 'log', layer: 3, x, y, len: L * 2 + 36, w: 30, r: L + 40, rot: Math.atan2(uy, ux), seed: (R() * 1e9) | 0, bridge: true });
            break;
          }
        }
      }
    }
    // trees: a trunk you walk around, and a canopy drawn above everything
    const trees = [], plants = [];
    const treeN = { wood: 2.2, meadow: 0.3, marsh: 0.35, dry: 0.15, beach: 0.05, sea: 0 }[cb];
    for (let t = 0; t < 3; t++) {
      if (R() > treeN / 3) continue;
      const s = place(70);
      if (!s) continue;
      const kind = s.b === 'dry' ? 'pine' : s.b === 'marsh' ? 'willow' : s.b === 'wood' ? (R() < 0.25 ? 'pine' : R() < 0.25 ? 'birch' : 'oak') : (R() < 0.3 ? 'birch' : 'oak');
      const tr = 24 + R() * 18, tree = { x: s.x, y: s.y, tr, cr: tr * (4.6 + R() * 1.6), kind, seed: (R() * 1e9) | 0 };
      trees.push(tree);
      features.push({ type: 'tree', x: s.x, y: s.y, r: tr + 30, id: `t${cx},${cy},${t}` });
      obstacles.push({ x: s.x, y: s.y, r: tr * 0.95 });
      props.push({ type: 'shade', layer: 1, x: s.x + tree.cr * 0.15, y: s.y + tree.cr * 0.2, r: tree.cr * 1.05 });
      props.push({ type: 'trunk', layer: 3, x: s.x, y: s.y, tr, kind, r: tr * 3.4, seed: tree.seed });
    }
    const plantRoll = (type, chance, r, okB) => {
      if (R() > chance) return;
      const s = place(r);
      if (!s || !okB.includes(s.b)) return;
      const f = { type, x: s.x, y: s.y, r, id: `${type}${cx},${cy}`, seed: (R() * 1e9) | 0 };
      features.push(f); plants.push(f);
    };
    plantRoll('bush', { meadow: 0.22, wood: 0.3, marsh: 0.1, dry: 0.05 }[cb] || 0, 46, ['meadow', 'wood', 'marsh', 'dry']);
    plantRoll('sunflower', cb === 'meadow' ? 0.22 : cb === 'dry' ? 0.08 : 0, 26, ['meadow', 'dry']);
    plantRoll('sundew', cb === 'marsh' ? 0.4 : cb === 'wood' ? 0.06 : 0, 20, ['marsh', 'wood']);
    if (cb === 'dry' && R() < 0.14) {
      const s = place(80);
      if (s && !home(s.x, s.y, 1200)) {
        features.push({ type: 'termites', x: s.x, y: s.y, r: 70, id: `m${cx},${cy}` });
        props.push({ type: 'termound', layer: 3, x: s.x, y: s.y, r: 90, seed: (R() * 1e9) | 0 });
        obstacles.push({ x: s.x, y: s.y, r: 34 });
      }
    }
    region(4, 77, 0.55, ['meadow', 'wood', 'dry'], 900, (s) => {
      features.push({ type: 'lair', x: s.x, y: s.y, r: 80, id: `l${cx},${cy}` });
      props.push({ type: 'lair', layer: 2, x: s.x, y: s.y, r: 95, seed: (R() * 1e9) | 0 });
    });

    const n = PROP_COUNT[cb];
    for (let i = 0; i < n; i++) {
      const x = x0 + R() * CHUNK, y = y0 + R() * CHUNK;
      const [e, m] = this.em(x, y);
      const b = this.classify(e, m);
      const wv = this.waterFrom(x, y, e, m);
      if (wv > 0) {
        if (e > 0.36 && (b === 'marsh' || cm > 0.55)) {
          if (R() < 0.35) props.push({ type: 'lily', layer: 2, x, y, lr: 12 + R() * 14, r: 30, rot: R() * TAU, seed: (R() * 1e9) | 0 });
        }
        continue;
      }
      if (b === 'sea' || home(x, y, 190) || !featClear(x, y, 6)) continue;
      const type = weighted(R, PROP_TABLE[b]);
      const seed = (R() * 1e9) | 0;
      const solidOk = wv < -0.25 && featClear(x, y, 50);
      switch (type) {
        case 'tuft': case 'tuftD': case 'tuftY': case 'tuftB':
          if (!featClear(x, y, 10)) break;
          props.push({ type: 'tuft', layer: 4, x, y, r: 12 + R() * 22, seed, pal: { tuft: 'green', tuftD: 'dark', tuftY: 'dry', tuftB: 'dune' }[type] });
          break;
        case 'flower': case 'iris': {
          if (!featClear(x, y, 10)) break;
          const fr = 7 + R() * 8;
          const kind = type === 'iris' ? 'iris' : ['daisy', 'daisy', 'buttercup', 'violet', 'dandelion'][(R() * 5) | 0];
          const f = { type: 'flower', layer: 4, x, y, fr, r: fr * 2.2, kind, seed };
          props.push(f); flowers.push(f);
          break;
        }
        case 'pebble': {
          const pr = 5 + Math.pow(R(), 2.2) * 30;
          if (!solidOk || !featClear(x, y, pr + 20)) break;
          props.push({ type: 'pebble', layer: 3, x, y, pr, r: pr * 1.5, col: (R() * PEB_COLS.length) | 0, seed });
          if (pr >= 8) obstacles.push({ x, y, r: pr * 0.92 });
          break;
        }
        case 'rock': {
          const pr = 28 + R() * 30;
          if (!solidOk || !featClear(x, y, pr + 30)) break;
          props.push({ type: 'rock', layer: 3, x, y, pr, r: pr * 1.6, seed });
          obstacles.push({ x, y, r: pr * 0.95 });
          break;
        }
        case 'leaf': {
          const len = 34 + R() * 60;
          const col = b === 'wood' ? 1 + ((R() * 4) | 0) : (R() * LEAF_COLS.length) | 0;
          props.push({ type: 'leaf', layer: 2, x, y, len, r: len * 0.6 + 6, rot: R() * TAU, col, seed });
          break;
        }
        case 'twig': { const len = 40 + R() * 90; props.push({ type: 'twig', layer: 2, x, y, len, r: len * 0.55 + 10, rot: R() * TAU, seed }); break; }
        case 'mush': {
          const variant = (R() * 3) | 0, k = 1 + ((R() * 4) | 0);
          for (let j = 0; j < k; j++) {
            const cr = 7 + R() * 12, mx = x + (R() - 0.5) * 50, my = y + (R() - 0.5) * 50;
            if (!solidOk || !featClear(mx, my, cr + 20)) continue;
            props.push({ type: 'mush', layer: 3, x: mx, y: my, cr, r: cr * 1.6, variant, seed: seed + j });
            if (cr >= 9) obstacles.push({ x: mx, y: my, r: cr * 0.85 });
          }
          break;
        }
        case 'moss': props.push({ type: 'moss', layer: 1, x, y, r: 20 + R() * 40, seed }); break;
        case 'cone': {
          const len = 22 + R() * 10;
          props.push({ type: 'cone', layer: 3, x, y, len, r: len, rot: R() * TAU, seed });
          if (solidOk) obstacles.push({ x, y, r: len * 0.32 });
          break;
        }
        case 'acorn': props.push({ type: 'acorn', layer: 3, x, y, r: 10, rot: R() * TAU, seed }); break;
        case 'fern': props.push({ type: 'fern', layer: 4, x, y, r: 30 + R() * 30, seed }); break;
        case 'log': case 'drift': {
          if (!solidOk || !featClear(x, y, 160)) break;
          const len = type === 'log' ? 160 + R() * 140 : 90 + R() * 90, w = type === 'log' ? 24 + R() * 16 : 14 + R() * 10, rot = R() * TAU;
          props.push({ type, layer: 3, x, y, len, w, r: len / 2 + 14, rot, seed });
          const c = Math.cos(rot), s = Math.sin(rot);
          for (let d = -len / 2 + w / 2; d <= len / 2 - w / 2 + 1; d += w * 0.6) obstacles.push({ x: x + c * d, y: y + s * d, r: w * 0.5 });
          break;
        }
        case 'shell': props.push({ type: 'shell', layer: 3, x, y, sr: 4 + R() * 7, r: 14, rot: R() * TAU, kind: R() < 0.3 ? 'spiral' : 'cockle', seed }); break;
        case 'weed': props.push({ type: 'weed', layer: 2, x, y, r: 26 + R() * 30, rot: R() * TAU, seed }); break;
        case 'ripple': props.push({ type: 'ripple', layer: 1, x, y, r: 50 + R() * 40, rot: R() * TAU, seed }); break;
        case 'crabhole': props.push({ type: 'crabhole', layer: 1, x, y, r: 36, seed }); break;
        case 'reed': props.push({ type: 'reed', layer: 4, x, y, r: 30 + R() * 26, seed }); break;
        case 'mud': props.push({ type: 'mud', layer: 1, x, y, r: 40 + R() * 50, seed }); break;
        case 'thistle': props.push({ type: 'thistle', layer: 4, x, y, r: 16 + R() * 10, seed }); break;
        case 'crack': props.push({ type: 'crack', layer: 1, x, y, r: 40 + R() * 40, seed }); break;
      }
    }
    props.sort((a, b) => a.layer - b.layer);
    return { cx, cy, props, obstacles, features, flowers, trees, plants, bridges, biome: cb, coll: null };
  }

  collList(cx, cy) {
    const d = this.getData(cx, cy);
    if (d.coll) return d.coll;
    const list = [];
    const x0 = cx * CHUNK - 80, y0 = cy * CHUNK - 80, x1 = x0 + CHUNK + 160, y1 = y0 + CHUNK + 160;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const o of this.getData(cx + dx, cy + dy).obstacles) if (o.x > x0 && o.x < x1 && o.y > y0 && o.y < y1) list.push(o);
    }
    for (const o of this.extraObstacles) if (o.x > x0 && o.x < x1 && o.y > y0 && o.y < y1) list.push(o);
    d.coll = list;
    return list;
  }

  featuresNear(x, y, radius, type) {
    const out = [];
    const c0x = Math.floor((x - radius) / CHUNK), c1x = Math.floor((x + radius) / CHUNK);
    const c0y = Math.floor((y - radius) / CHUNK), c1y = Math.floor((y + radius) / CHUNK);
    for (let cx = c0x; cx <= c1x; cx++) for (let cy = c0y; cy <= c1y; cy++) {
      for (const f of this.getData(cx, cy).features) {
        if ((!type || f.type === type) && dist2(x, y, f.x, f.y) < radius * radius) out.push(f);
      }
    }
    return out;
  }

  near(x, y, radius, key) {
    const out = [];
    for (let cx = Math.floor((x - radius) / CHUNK); cx <= Math.floor((x + radius) / CHUNK); cx++) {
      for (let cy = Math.floor((y - radius) / CHUNK); cy <= Math.floor((y + radius) / CHUNK); cy++) {
        for (const t of this.getData(cx, cy)[key]) if (dist2(x, y, t.x, t.y) < radius * radius) out.push(t);
      }
    }
    return out;
  }

  flowersNear(x, y) {
    return this.getData(Math.floor(x / CHUNK), Math.floor(y / CHUNK)).flowers;
  }

  /* ---------------------------------------------------------- collision */

  blocker(x, y, r, pits) {
    for (const o of this.collList(Math.floor(x / CHUNK), Math.floor(y / CHUNK))) {
      if (dist2(x, y, o.x, o.y) < (o.r + r) ** 2) return o;
    }
    if (pits) for (const p of this.activePits) if (dist2(x, y, p.x, p.y) < (p.r + 10 + r) ** 2) return p;
    return null;
  }

  collide(w) {
    if (w.gnawT > 0) return;
    const r = w.r * 0.7;
    for (const o of this.collList(Math.floor(w.x / CHUNK), Math.floor(w.y / CHUNK))) {
      const dx = w.x - o.x, dy = w.y - o.y, d2 = dx * dx + dy * dy, m = o.r + r;
      if (d2 < m * m && d2 > 1e-6) { const d = Math.sqrt(d2); w.x = o.x + (dx / d) * m; w.y = o.y + (dy / d) * m; }
    }
  }

  /* Move to (nx, ny) unless that is water the walker cannot cross; slide along shores. */
  moveTo(e, nx, ny) {
    if (!e.swims && this.wetAt(nx, ny)) {
      if (!this.wetAt(nx, e.y)) ny = e.y;
      else if (!this.wetAt(e.x, ny)) nx = e.x;
      else { this.collide(e); return false; }
    }
    e.x = nx; e.y = ny;
    this.collide(e);
    return true;
  }

  /* -------------------------------------------------------------- baking */

  bakeChunk(cx, cy) {
    const s = this.bakeScale, size = CHUNK + PAD * 2;
    const c = document.createElement('canvas');
    c.width = c.height = Math.ceil(size * s);
    const g = c.getContext('2d');
    const x0 = cx * CHUNK, y0 = cy * CHUNK, ox = x0 - PAD, oy = y0 - PAD;
    g.setTransform(s, 0, 0, s, -ox * s, -oy * s);
    // smooth ground colour field, sampled every 16px on a world-aligned grid and hillshaded
    const ST = 16, N = (CHUNK + 64) / ST + 1, bx = x0 - 32, by = y0 - 32;
    const H = new Float32Array((N + 2) * (N + 2));
    for (let j = 0; j < N + 2; j++) for (let i = 0; i < N + 2; i++) H[j * (N + 2) + i] = this.relief(bx + (i - 1) * ST, by + (j - 1) * ST);
    const gc = document.createElement('canvas');
    gc.width = gc.height = N;
    const gctx = gc.getContext('2d');
    const gi = gctx.createImageData(N, N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const wx = bx + i * ST, wy = by + j * ST;
      const col = this.groundRGB(wx, wy), k = (j * N + i) * 4;
      const hi = (jj, ii) => H[(j + 1 + jj) * (N + 2) + i + 1 + ii];
      // light from the top left: slopes facing it brighten, the far sides darken
      const sx = (hi(0, 1) - hi(0, -1)) / (2 * ST), sy = (hi(1, 0) - hi(-1, 0)) / (2 * ST);
      const wet = this.wetAt(wx, wy);
      const shade = wet ? 1 : clamp(1 - (sx + sy) * 0.9, 0.82, 1.16);
      gi.data[k] = col[0] * shade; gi.data[k + 1] = col[1] * shade; gi.data[k + 2] = col[2] * shade; gi.data[k + 3] = 255;
    }
    gctx.putImageData(gi, 0, 0);
    g.imageSmoothingEnabled = true;
    g.drawImage(gc, bx - ST / 2, by - ST / 2, N * ST, N * ST);

    const list = [];
    const inside = (p) => p.x + p.r > ox && p.x - p.r < ox + size && p.y + p.r > oy && p.y - p.r < oy + size;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const p of this.getData(cx + dx, cy + dy).props) if (inside(p)) list.push(p);
    }
    for (const p of this.extraProps) if (inside(p)) list.push(p);
    list.sort((a, b) => a.layer - b.layer);
    let i = 0;
    for (; i < list.length && list[i].layer === 0; i++) drawProp(g, list[i]);
    this.drawSpecks(g, cx, cy);
    this.drawDetail(g, cx, cy);
    for (; i < list.length && list[i].layer <= 1; i++) drawProp(g, list[i]);
    this.drawWater(g, cx, cy);
    for (; i < list.length; i++) drawProp(g, list[i]);
    return c;
  }

  /* Fine ground texture: grass stubble in meadows, leaf crumbs in woods, sand ripples on shores. */
  drawDetail(g, cx, cy) {
    const R = mulberry32(hashInt(cx, cy, this.seed + 9));
    const x0 = cx * CHUNK, y0 = cy * CHUNK;
    if (!this.grainTile) {
      const t = document.createElement('canvas'); t.width = t.height = 128;
      const tc = t.getContext('2d'), img = tc.createImageData(128, 128), TR = mulberry32(this.seed + 4);
      for (let i = 0; i < 128 * 128; i++) {
        const v = TR();
        img.data[i * 4] = v < 0.5 ? 30 : 230; img.data[i * 4 + 1] = v < 0.5 ? 22 : 220; img.data[i * 4 + 2] = v < 0.5 ? 10 : 180;
        img.data[i * 4 + 3] = TR() < 0.5 ? 0 : 26;
      }
      tc.putImageData(img, 0, 0);
      this.grainTile = t;
    }
    g.save();
    g.fillStyle = g.createPattern(this.grainTile, 'repeat');
    g.fillRect(x0 - PAD, y0 - PAD, CHUNK + PAD * 2, CHUNK + PAD * 2);
    g.restore();
    g.lineCap = 'round';
    for (let i = 0; i < 520; i++) {
      const x = x0 + R() * CHUNK, y = y0 + R() * CHUNK;
      const b = this.biome(x, y);
      if (b === 'meadow' || b === 'marsh') {
        const a = -Math.PI / 2 + (R() - 0.5) * 2.2, l = 3 + R() * 5;
        g.strokeStyle = R() < 0.5 ? 'rgba(130,170,70,0.35)' : 'rgba(50,80,25,0.35)'; g.lineWidth = 0.9;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
      } else if (b === 'wood') {
        if (R() < 0.5) continue;
        g.fillStyle = ['rgba(120,70,30,0.4)', 'rgba(160,110,50,0.35)', 'rgba(70,50,25,0.4)'][(R() * 3) | 0];
        g.beginPath(); g.ellipse(x, y, 1.5 + R() * 2.5, 0.8 + R(), R() * 3, 0, TAU); g.fill();
      } else if (b === 'dry') {
        if (R() < 0.7) continue;
        g.strokeStyle = 'rgba(80,60,30,0.25)'; g.lineWidth = 0.7;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 10, y + (R() - 0.5) * 10); g.stroke();
      } else if (b === 'beach') {
        if (R() < 0.6) continue;
        g.fillStyle = R() < 0.5 ? 'rgba(255,250,235,0.5)' : 'rgba(150,120,80,0.35)';
        g.beginPath(); g.arc(x, y, 0.6 + R() * 0.8, 0, TAU); g.fill();
      }
    }
  }

  drawSpecks(g, cx, cy) {
    const R = mulberry32(hashInt(cx, cy, this.seed + 3));
    const cols = ['rgba(60,45,25,0.35)', 'rgba(205,195,145,0.25)', 'rgba(40,60,20,0.3)', 'rgba(120,95,60,0.3)'];
    for (let i = 0; i < 650; i++) {
      g.fillStyle = cols[(R() * cols.length) | 0];
      g.beginPath(); g.arc(cx * CHUNK + R() * CHUNK, cy * CHUNK + R() * CHUNK, 0.5 + R() * 1.3, 0, TAU); g.fill();
    }
  }

  drawWater(g, cx, cy) {
    const x0 = cx * CHUNK - PAD, y0 = cy * CHUNK - PAD;
    let any = false;
    for (let j = 0; j <= 8 && !any; j++) for (let i = 0; i <= 8 && !any; i++) {
      if (this.waterVal(x0 + i * 65, y0 + j * 65) > -1.2) any = true;
    }
    if (!any) return;
    const N = (CHUNK + PAD * 2) / WSTEP + 1;
    const wc = document.createElement('canvas');
    wc.width = wc.height = N;
    const wctx = wc.getContext('2d');
    const img = wctx.createImageData(N, N), d = img.data;
    let wet = false;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = x0 + i * WSTEP, y = y0 + j * WSTEP;
      const [e, m] = this.em(x, y);
      const v = this.waterFrom(x, y, e, m), k = (j * N + i) * 4;
      if (v <= -0.4) continue;
      wet = true;
      if (v <= 0) {
        d[k] = 60; d[k + 1] = 46; d[k + 2] = 26; d[k + 3] = 100 * smoothstep(-0.4, 0, v);
        continue;
      }
      const sea = e < 0.36 ? 1 : 0;
      const river = !sea && m <= 0.55 ? 1 : 0;
      const depth = clamp(v / 3, 0, 1);
      const sh = sea ? [104, 162, 168] : river ? [96, 150, 156] : [92, 122, 88], dp = sea ? [24, 70, 88] : river ? [36, 84, 96] : [34, 60, 46];
      let r = lerp(sh[0], dp[0], depth), gg = lerp(sh[1], dp[1], depth), b = lerp(sh[2], dp[2], depth);
      const foam = (1 - smoothstep(0.03, 0.16, v)) * (sea ? 0.65 : 0.25);
      r = lerp(r, 236, foam); gg = lerp(gg, 244, foam); b = lerp(b, 238, foam);
      d[k] = r; d[k + 1] = gg; d[k + 2] = b; d[k + 3] = 255 * smoothstep(0, 0.05, v);
    }
    if (!wet) return;
    wctx.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true;
    g.drawImage(wc, x0 - WSTEP / 2, y0 - WSTEP / 2, N * WSTEP, N * WSTEP);
    const R = mulberry32(hashInt(cx, cy, this.seed + 21));
    g.lineCap = 'round';
    for (let i = 0; i < 40; i++) {
      const x = x0 + R() * CHUNK, y = y0 + R() * CHUNK;
      if (this.waterVal(x, y) < 0.4) continue;
      g.strokeStyle = `rgba(230,245,250,${0.1 + R() * 0.12})`; g.lineWidth = 1 + R() * 1.5;
      const l = 14 + R() * 30;
      g.beginPath(); g.moveTo(x - l, y); g.quadraticCurveTo(x, y - 5, x + l, y); g.stroke();
    }
  }

  getChunk(cx, cy, allowBake) {
    const k = cx * 100000 + cy;
    let c = this.chunks.get(k);
    if (c) { this.chunks.delete(k); this.chunks.set(k, c); return c; }
    if (!allowBake) return null;
    c = this.bakeChunk(cx, cy);
    this.chunks.set(k, c);
    while (this.chunks.size > this.maxChunks) this.chunks.delete(this.chunks.keys().next().value);
    return c;
  }

  drawChunks(ctx, x0, y0, x1, y1) {
    let budget = 2;
    const cx0 = Math.floor(x0 / CHUNK), cx1 = Math.floor(x1 / CHUNK);
    const cy0 = Math.floor(y0 / CHUNK), cy1 = Math.floor(y1 / CHUNK);
    const cxm = (cx0 + cx1) / 2, cym = (cy0 + cy1) / 2;
    const order = [];
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) order.push([cx, cy, (cx - cxm) ** 2 + (cy - cym) ** 2]);
    order.sort((a, b) => a[2] - b[2]);
    for (const [cx, cy] of order) {
      const cached = this.chunks.has(cx * 100000 + cy);
      if (!cached && budget <= 0) {
        const col = this.groundRGB(cx * CHUNK + 256, cy * CHUNK + 256);
        ctx.fillStyle = `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`;
        ctx.fillRect(cx * CHUNK, cy * CHUNK, CHUNK, CHUNK);
        continue;
      }
      if (!cached) budget--;
      const c = this.getChunk(cx, cy, true);
      ctx.drawImage(c, cx * CHUNK - PAD, cy * CHUNK - PAD, CHUNK + PAD * 2, CHUNK + PAD * 2);
    }
  }

  prebake(x, y, radius) {
    for (let cx = Math.floor((x - radius) / CHUNK); cx <= Math.floor((x + radius) / CHUNK); cx++) {
      for (let cy = Math.floor((y - radius) / CHUNK); cy <= Math.floor((y + radius) / CHUNK); cy++) this.getChunk(cx, cy, true);
    }
  }

  /* ------------------------------------------------------ season layers */

  /* Fallen leaves for autumn and lying snow for winter, baked per chunk and faded in by season. */
  bakeSeason(cx, cy, kind) {
    const s = Math.min(this.bakeScale, 1.25), size = CHUNK + PAD * 2;
    const c = document.createElement('canvas');
    c.width = c.height = Math.ceil(size * s);
    const g = c.getContext('2d');
    const ox = cx * CHUNK - PAD, oy = cy * CHUNK - PAD;
    g.setTransform(s, 0, 0, s, -ox * s, -oy * s);
    // draw this chunk's pieces and its neighbours', so drifts and leaves run across chunk edges
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) this.seasonPieces(g, cx + dx, cy + dy, kind, ox, oy, size);
    return c;
  }

  seasonPieces(g, cx, cy, kind, ox, oy, size) {
    const R = mulberry32(hashInt(cx, cy, this.seed + (kind === 'snow' ? 61 : 62)));
    const x0 = cx * CHUNK, y0 = cy * CHUNK;
    const near = (x, y, r) => x + r > ox && x - r < ox + size && y + r > oy && y - r < oy + size;
    if (kind === 'leaves') {
      const cols = [['#c86a24', '#f0a050', '#6a2e08'], ['#d8a02a', '#f8d060', '#7a5008'], ['#a8401c', '#e07848', '#4a1406'], ['#8a5a2a', '#c08a50', '#4a2a0e']];
      for (let i = 0; i < 150; i++) {
        const x = x0 + R() * CHUNK, y = y0 + R() * CHUNK;
        const l = 9 + R() * 14, w = l * (0.28 + R() * 0.14), rot = R() * TAU, col = cols[(R() * cols.length) | 0];
        if (!near(x, y, l) || this.waterVal(x, y) > -0.2) continue;
        g.save(); g.translate(x, y); g.rotate(rot);
        g.save(); g.translate(1.5, 2); leafPath(g, l, w); g.fillStyle = 'rgba(20,12,4,0.25)'; g.fill(); g.restore();
        leafPath(g, l, w);
        const gr = g.createLinearGradient(0, -w, 0, w);
        gr.addColorStop(0, col[1]); gr.addColorStop(0.5, col[0]); gr.addColorStop(1, col[2]);
        g.fillStyle = gr; g.fill();
        g.strokeStyle = 'rgba(255,230,190,0.35)'; g.lineWidth = 0.5;
        g.beginPath(); g.moveTo(-l / 2, 0); g.lineTo(l / 2, 0); g.stroke();
        g.restore();
      }
      return;
    }
    // patchy drifts: thicker where the noise says so, with bare ground showing between
    for (let i = 0; i < 150; i++) {
      const x = x0 + R() * CHUNK, y = y0 + R() * CHUNK, rr = R();
      const depth = fbm(x / 260, y / 260, this.seed + 71, 2);
      const r = 14 + rr * 36 * (0.4 + depth);
      if (!near(x, y, r) || depth < 0.38 || this.waterVal(x, y) > -0.1) continue;
      const a = clamp((depth - 0.38) * 2.2, 0.12, 0.62);
      radialFill(g, x + 2, y + 3, r, [[0, `rgba(140,160,190,${a * 0.35})`], [1, 'rgba(140,160,190,0)']]);
      radialFill(g, x, y, r, [[0, `rgba(248,251,255,${a})`], [0.55, `rgba(240,246,252,${a * 0.7})`], [1, 'rgba(240,246,252,0)']]);
    }
    for (let i = 0; i < 160; i++) {
      const x = x0 + R() * CHUNK, y = y0 + R() * CHUNK;
      if (!near(x, y, 1)) continue;
      g.fillStyle = R() < 0.5 ? 'rgba(255,255,255,0.8)' : 'rgba(200,220,255,0.5)';
      g.fillRect(x, y, 1, 1);
    }
  }

  drawSeasonLayer(ctx, v, kind, alpha) {
    if (!this.sChunks) this.sChunks = new Map();
    let budget = 1;
    ctx.save();
    ctx.globalAlpha = Math.min(1, alpha * (kind === 'snow' ? 1 : 1.1));
    for (let cx = Math.floor(v.x0 / CHUNK); cx <= Math.floor(v.x1 / CHUNK); cx++) {
      for (let cy = Math.floor(v.y0 / CHUNK); cy <= Math.floor(v.y1 / CHUNK); cy++) {
        const k = kind + 'v2' + cx * 100000 + ',' + cy;
        let c = this.sChunks.get(k);
        if (!c) {
          if (budget-- <= 0) continue;
          c = this.bakeSeason(cx, cy, kind);
          this.sChunks.set(k, c);
          if (this.sChunks.size > 40) this.sChunks.delete(this.sChunks.keys().next().value);
        }
        ctx.drawImage(c, cx * CHUNK - PAD, cy * CHUNK - PAD, CHUNK + PAD * 2, CHUNK + PAD * 2);
      }
    }
    ctx.restore();
  }

  /* -------------------------------------------------------------- scent */

  pkey(col, cx, cy) { return col.idx * 1e10 + (cx + 50000) * 1e5 + (cy + 50000); }
  deposit(col, x, y, amt) {
    const cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK);
    const k = this.pkey(col, cx, cy);
    let e = this.pher.get(k);
    if (!e) { e = { col, cx, cy, a: new Float32Array(PN * PN), c: null, dirty: true }; this.pher.set(k, e); }
    const i = Math.floor((y - cy * CHUNK) / PC) * PN + Math.floor((x - cx * CHUNK) / PC);
    e.a[i] = Math.min(8, e.a[i] + amt);
  }
  sample(col, x, y) {
    const cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK);
    const e = this.pher.get(this.pkey(col, cx, cy));
    if (!e) return 0;
    return e.a[Math.floor((y - cy * CHUNK) / PC) * PN + Math.floor((x - cx * CHUNK) / PC)];
  }
  updatePher(dt, rain, view, show) {
    this.pherAcc += dt;
    if (this.pherAcc > 0.25) {
      const f = Math.pow(rain ? 0.9 : 0.958, this.pherAcc);
      this.pherAcc = 0;
      for (const [k, e] of this.pher) {
        let max = 0;
        const a = e.a;
        for (let i = 0; i < a.length; i++) { const v = a[i] * f; a[i] = v < 0.01 ? 0 : v; if (v > max) max = v; }
        if (max < 0.01) this.pher.delete(k);
      }
    }
    this.pherImgAcc += dt;
    if (this.pherImgAcc < 0.2) return;
    this.pherImgAcc = 0;
    const amax = show ? 235 : 150;
    for (const e of this.pher.values()) {
      const ex = e.cx * CHUNK, ey = e.cy * CHUNK;
      if (ex > view.x1 || ey > view.y1 || ex + CHUNK < view.x0 || ey + CHUNK < view.y0) continue;
      if (!e.c) {
        e.c = document.createElement('canvas'); e.c.width = e.c.height = PN;
        e.ctx = e.c.getContext('2d'); e.img = e.ctx.createImageData(PN, PN);
      }
      const d = e.img.data, col = e.col.trail;
      for (let i = 0, j = 0; i < e.a.length; i++, j += 4) {
        d[j] = col[0]; d[j + 1] = col[1]; d[j + 2] = col[2];
        d[j + 3] = Math.min(1, e.a[i] / 2.6) * amax;
      }
      e.ctx.putImageData(e.img, 0, 0);
    }
  }
  drawPher(ctx, view, show) {
    ctx.save();
    ctx.globalAlpha = show ? 0.9 : 0.35;
    ctx.imageSmoothingEnabled = true;
    for (const e of this.pher.values()) {
      if (!e.c) continue;
      const ex = e.cx * CHUNK, ey = e.cy * CHUNK;
      if (ex > view.x1 || ey > view.y1 || ex + CHUNK < view.x0 || ey + CHUNK < view.y0) continue;
      ctx.drawImage(e.c, ex, ey, CHUNK, CHUNK);
    }
    ctx.restore();
  }
}
