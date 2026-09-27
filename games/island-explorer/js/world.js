'use strict';
// Builds the archipelago: nine hand-shaped islands with procedural detail.
// tiles[]  = what's on each tile · ground[] = the floor drawn beneath objects
const World = {
  W: 400, H: 260,
  islands: [
    { id: 1, cx: 36,  cy: 122, rx: 18, ry: 16, seed: 11 }, // Driftwood Isle (start, small)
    { id: 2, cx: 100, cy: 55,  rx: 30, ry: 24, seed: 23 }, // Verdant Isle (jungle, medium)
    { id: 3, cx: 212, cy: 92,  rx: 50, ry: 60, seed: 37 }, // The Great Isle (largest, town)
    { id: 4, cx: 28,  cy: 32,  rx: 14, ry: 10, seed: 41 }, // Gull Rock (stone & iron)
    { id: 5, cx: 124, cy: 132, rx: 9,  ry: 6,  seed: 43 }, // Crab Key (sandbar)
    { id: 6, cx: 78,  cy: 212, rx: 30, ry: 19, seed: 47 }, // Mossfen (swamp)
    { id: 7, cx: 346, cy: 46,  rx: 27, ry: 22, seed: 53 }, // Frostpeak (snow)
    { id: 8, cx: 342, cy: 208, rx: 25, ry: 21, seed: 59 }, // Ember Isle (volcanic)
    { id: 9, cx: 202, cy: 228, rx: 18, ry: 12, seed: 61 }, // Palm Atoll (lagoon, trader)
  ],
  town: { x0: 220, x1: 246, y0: 78, y1: 106, fx: 233, fy: 91 },
  points: {}, signs: {}, campfires: [], lamps: [], mobSpawns: [], npcSpawns: [], pois: [], bottles: [], digs: [], bossSpawns: [],
  totalShells: 0, landTotal: 0, landExplored: 0,
  changes: new Map(),

  idx(x, y) { return y * this.W + x; },
  inb(x, y) { return x >= 0 && y >= 0 && x < this.W && y < this.H; },
  get(x, y) { return this.inb(x, y) ? this.tiles[y * this.W + x] : T.DEEP; },
  groundAt(x, y) { return this.inb(x, y) ? this.ground[y * this.W + x] : T.DEEP; },
  set0(x, y, t) {
    if (!this.inb(x, y)) return;
    const i = y * this.W + x;
    this.tiles[i] = t;
    if (TILE[t].ground) this.ground[i] = t;
  },
  // runtime change: recorded for saving, repainted on the map
  set(x, y, t) {
    if (!this.inb(x, y)) return;
    this.set0(x, y, t);
    const i = y * this.W + x;
    this.changes.set(i, t);
    if (this.explored[i]) UI.paintTile(x, y);
  },
  isLand(id, x, y) {
    if (!this.inb(x, y)) return false;
    const i = y * this.W + x;
    return this.isl[i] === id && this.dmap[i] < 1;
  },
  islandAt(x, y) { return this.inb(x, y) ? this.isl[y * this.W + x] : 0; },

  // Normalized distance from an island's centre (< 1 = land). The coast wobbles by angle only, so no holes.
  shapeD(I, x, y) {
    const dx = (x + 0.5 - I.cx) / I.rx, dy = (y + 0.5 - I.cy) / I.ry;
    const e = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    const n = RNG.fbm(Math.cos(a) * 1.6 + I.seed, Math.sin(a) * 1.6 + I.seed * 2, I.seed, 3);
    return e / (1 + (n - 0.5) * 0.34);
  },

  generate() {
    const { W, H } = this;
    this.tiles = new Uint8Array(W * H);
    this.ground = new Uint8Array(W * H);
    this.isl = new Uint8Array(W * H);
    this.dmap = new Float32Array(W * H);
    this.explored = new Uint8Array(W * H);
    const r = RNG.mulberry32(1337);
    const I3 = this.islands[2];

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let best = 99, bi = 0;
        for (const I of this.islands) {
          if (Math.abs(x - I.cx) > I.rx * 1.6 || Math.abs(y - I.cy) > I.ry * 1.6) continue;
          const d = this.shapeD(I, x, y);
          if (d < best) { best = d; bi = I.id; }
        }
        const i = y * W + x;
        this.dmap[i] = best;
        if (best < 1) { this.isl[i] = bi; this.set0(x, y, T.GRASS); continue; }
        // The reef: a ring of rough water around the Great Isle that rafts can't cross
        const e3 = Math.hypot((x + 0.5 - I3.cx) / I3.rx, (y + 0.5 - I3.cy) / I3.ry);
        if (e3 >= 1.18 && e3 <= 1.36) { this.set0(x, y, T.ROUGH); continue; }
        if (best < 1.12) { this.set0(x, y, T.SHALLOW); this.isl[i] = bi; }
        else this.set0(x, y, T.DEEP);
      }
    }

    this.gen1(r);
    this.gen2(r);
    this.gen3(r);
    this.gen4(r); this.gen5(r); this.gen6(r); this.gen7(r); this.gen8(r); this.gen9(r);
    this.placeBottles();

    for (let i = 0; i < W * H; i++) {
      if (this.dmap[i] < 1) this.landTotal++;
      if (this.tiles[i] === T.SHELL) this.totalShells++;
      if (this.tiles[i] === T.LAMP) this.lamps.push({ x: i % W, y: (i / W) | 0 });
    }
  },

  forLand(id, fn) {
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) {
      if (this.isLand(id, x, y)) fn(x, y, this.dmap[y * this.W + x]);
    }
  },

  // put an object on a tile, with the given floor underneath
  put(x, y, ground, obj) {
    this.set0(x, y, ground);
    if (obj !== undefined && obj !== ground) this.set0(x, y, obj);
  },

  // Reset land within a radius to its bare ground (removes trees etc.)
  clearArea(cx, cy, rad) {
    for (let y = cy - rad; y <= cy + rad; y++) for (let x = cx - rad; x <= cx + rad; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > rad * rad + 1 || !this.inb(x, y)) continue;
      const i = this.idx(x, y);
      if (this.dmap[i] >= 1) continue;
      const t = this.tiles[i];
      if (t === T.CLIFF || t === T.RIVER || t === T.MOUNTAIN) continue;
      this.tiles[i] = this.ground[i];
    }
  },

  findLand(id, x, y, pred, avoid = []) {
    for (let rad = 0; rad < 25; rad++) {
      for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
        const tx = x + dx, ty = y + dy;
        if (!this.isLand(id, tx, ty)) continue;
        if (avoid.some(p => p.x === tx && p.y === ty)) continue;
        if (pred(this.get(tx, ty), tx, ty)) return { x: tx, y: ty };
      }
    }
    return { x, y };
  },

  pickTiles(id, pred, n, r, avoid, minDist) {
    const cands = [];
    this.forLand(id, (x, y) => {
      if (!pred(this.get(x, y), x, y)) return;
      if (avoid && Math.hypot(x - avoid.x, y - avoid.y) < minDist) return;
      cands.push({ x, y });
    });
    const out = [];
    for (let k = 0; k < n && cands.length; k++) out.push(cands.splice(r() * cands.length | 0, 1)[0]);
    return out;
  },

  island(id) { return this.islands[id - 1]; },
  spawn(kind, id, n, r, pred, avoid, minDist) {
    for (const p of this.pickTiles(id, pred, n, r, avoid, minDist)) this.mobSpawns.push({ kind, ...p });
  },
  crates(id, n, r) {
    for (const p of this.pickTiles(id, t => t === T.SAND || t === T.SNOW || t === T.ASH, n, r)) this.set0(p.x, p.y, T.CRATE);
  },
  addDig(id, x, y) {
    const p = this.findLand(id, x, y, t => this.isPlain(t) || t === T.PALM || t === T.SNOW);
    this.clearArea(p.x, p.y, 1);
    this.set0(p.x, p.y, T.DIG);
    this.digs.push({ id, x: p.x, y: p.y });
  },
  isPlain(t) { return t === T.GRASS || t === T.SAND || t === T.JUNGLE || t === T.TALLGRASS || t === T.FLOWERS || t === T.SNOW || t === T.MUD || t === T.ASH; },
  addSign(x, y, key) { this.set0(x, y, T.SIGN); this.signs[this.idx(x, y)] = key; },
  addCampfire(x, y) { this.set0(x, y, T.CAMPFIRE); this.campfires.push({ x, y }); this.pois.push({ x, y, kind: 'fire' }); },

  // A hidden golden idol, walled in by trees or rocks you have to chop / mine through.
  addRelic(id, x, y, wall) {
    const p = this.findLand(id, x, y, t => this.isPlain(t) || TILE[t].tall);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const tx = p.x + dx, ty = p.y + dy, d = Math.max(Math.abs(dx), Math.abs(dy));
      if (!this.isLand(id, tx, ty)) continue;
      const t = this.get(tx, ty);
      if (t === T.RIVER || t === T.MOUNTAIN || t === T.CLIFF || t === T.PATH || t === T.LAVA) continue;
      if (d === 0) this.set0(tx, ty, T.RELIC);
      else if (d === 1) this.set0(tx, ty, this.ground[this.idx(tx, ty)]);
      else this.set0(tx, ty, wall);
    }
    this.points['relic' + id] = p;
  },

  // ---------------- Island 1: Driftwood Isle ----------------
  gen1(r) {
    const I = this.islands[0];
    this.forLand(1, (x, y, d) => {
      const q = r();
      if (d > 0.74) {
        let o = T.SAND;
        if (d < 0.86 && q < 0.09) o = T.PALM;
        else if (q > 0.985) o = T.SHELL;
        else if (q > 0.975) o = T.ROCK;
        else if (q > 0.955) o = T.PEBBLE;
        this.put(x, y, T.SAND, o);
      } else {
        const n = RNG.fbm(x * 0.15, y * 0.15, 5);
        let o = T.GRASS;
        if (n > 0.5 && q < 0.5) o = T.TREE;
        else if (q < 0.035) o = T.VINE;
        else if (q < 0.06) o = T.BERRY;
        else if (q < 0.11) o = T.FLOWERS;
        else if (q < 0.17) o = T.TALLGRASS;
        else if (q < 0.19) o = T.ROCK;
        else if (q < 0.2) o = T.PEBBLE;
        else if (n > 0.4 && q < 0.3) o = T.TREE;
        this.put(x, y, T.GRASS, o);
      }
    });

    this.addRelic(1, I.cx, I.cy - 5, T.TREE);

    let ys = I.cy + I.ry + 6;
    while (ys > I.cy && !this.isLand(1, I.cx, ys)) ys--;
    const sx = I.cx, sy = ys - 2;
    this.clearArea(sx, sy, 3);
    this.points.start = { x: sx, y: sy };
    const avoid = [{ x: sx, y: sy }];
    const w = this.findLand(1, sx - 3, sy + 1, t => t === T.SAND, avoid);
    this.set0(w.x, w.y, T.WRECK); avoid.push(w);
    this.pois.push({ x: w.x, y: w.y, kind: 'wreck' });
    const cf = this.findLand(1, sx + 2, sy - 1, t => t === T.SAND || t === T.GRASS, avoid);
    this.addCampfire(cf.x, cf.y); avoid.push(cf);
    const sg = this.findLand(1, sx - 1, sy - 2, t => t === T.SAND || t === T.GRASS, avoid);
    this.addSign(sg.x, sg.y, 'start');

    const count = t => { let n = 0; this.forLand(1, (x, y) => { if (this.get(x, y) === t) n++; }); return n; };
    for (const p of this.pickTiles(1, t => t === T.GRASS, Math.max(0, 32 - count(T.VINE)), r)) this.set0(p.x, p.y, T.VINE);
    for (const p of this.pickTiles(1, t => t === T.GRASS || t === T.SAND, Math.max(0, 10 - count(T.PEBBLE)), r)) this.set0(p.x, p.y, T.PEBBLE);
    this.crates(1, 2, r);

    this.spawn('crab', 1, 5, r, t => t === T.SAND, this.points.start, 8);
    this.spawn('rabbit', 1, 3, r, t => t === T.GRASS || t === T.TALLGRASS);
  },

  // ---------------- Island 2: Verdant Isle ----------------
  gen2(r) {
    const I = this.islands[1];
    this.forLand(2, (x, y, d) => {
      const q = r();
      if (d > 0.84) {
        let o = T.SAND;
        if (d < 0.92 && q < 0.07) o = T.PALM; else if (q > 0.988) o = T.SHELL;
        this.put(x, y, T.SAND, o);
        return;
      }
      const jungle = RNG.fbm(x * 0.12, y * 0.12, 9) > 0.45;
      if (jungle) {
        let o = T.JUNGLE;
        if (q < 0.34) o = T.JTREE; else if (q < 0.375) o = T.VINE; else if (q < 0.4) o = T.BERRY;
        else if (q < 0.5) o = T.TALLGRASS; else if (q < 0.515) o = T.ROCK;
        this.put(x, y, T.JUNGLE, o);
      } else {
        let o = T.GRASS;
        if (q < 0.1) o = T.TREE; else if (q < 0.13) o = T.BERRY; else if (q < 0.2) o = T.FLOWERS;
        else if (q < 0.28) o = T.TALLGRASS; else if (q < 0.3) o = T.ROCK;
        this.put(x, y, T.GRASS, o);
      }
    });

    // freshwater pond
    const px = I.cx + 13, py = I.cy - 3;
    for (let y = py - 4; y <= py + 4; y++) for (let x = px - 5; x <= px + 5; x++) {
      if (!this.isLand(2, x, y)) continue;
      const e = ((x - px) / 3.6) ** 2 + ((y - py) / 2.6) ** 2;
      if (e <= 1) this.set0(x, y, T.RIVER);
      else if (e <= 2.2) this.set0(x, y, T.GRASS);
    }
    this.addSign(px - 4, py + 3, 'pond');

    // Ruins of the tide-keepers (north)
    const rx0 = I.cx - 5, ry0 = I.cy - 17;
    const layout = [
      '#####.#####',
      '#.........#',
      '#.###.###.#',
      '#.#.....#.#',
      '#.#..C..#.#',
      '#.#.....#.#',
      '#.###.###.#',
      '#.........#',
      '##.#####.##',
    ];
    for (let y = ry0 - 2; y < ry0 + layout.length + 2; y++) for (let x = rx0 - 2; x < rx0 + 13; x++) {
      if (this.isLand(2, x, y)) this.set0(x, y, this.dmap[this.idx(x, y)] > 0.84 ? T.SAND : T.GRASS);
    }
    layout.forEach((row, j) => [...row].forEach((ch, i) => {
      const x = rx0 + i, y = ry0 + j;
      if (ch === '#') this.set0(x, y, T.RUINWALL);
      else { this.set0(x, y, T.RUINFLOOR); if (ch === 'C') { this.set0(x, y, T.CHEST); this.points.chest = { x, y }; } }
    }));
    this.addSign(rx0 + 4, ry0 + layout.length + 1, 'ruins');
    this.pois.push({ x: rx0 + 5, y: ry0 + 4, kind: 'ruins' });

    // Tobias's hut (south)
    const hx = I.cx + 3, hy = I.cy + 10;
    for (let y = hy - 1; y <= hy + 6; y++) for (let x = hx - 3; x <= hx + 8; x++) {
      if (this.isLand(2, x, y)) this.set0(x, y, this.dmap[this.idx(x, y)] > 0.84 ? T.SAND : T.GRASS);
    }
    for (let i = 0; i < 5; i++) {
      this.set0(hx + i, hy, T.HUTROOF);
      this.set0(hx + i, hy + 1, T.HUTROOF);
      this.set0(hx + i, hy + 2, T.HUTWALL);
    }
    this.npcSpawns.push({ role: 'hermit', name: 'Tobias', x: hx + 2, y: hy + 3,
      look: { skin: '#e0ac69', hair: '#e8e8e8', beard: '#e8e8e8', shirt: '#7a8a4a', pants: '#6b4a2a', hat: 'straw' } });
    this.addCampfire(hx - 1, hy + 4);
    this.addSign(hx + 6, hy + 3, 'hut');
    this.pois.push({ x: hx + 2, y: hy + 1, kind: 'hut' });

    this.addRelic(2, I.cx - 22, I.cy + 3, T.JTREE);

    // M.'s remains, holding the key, on the east beach
    let kx = I.cx + I.rx + 8;
    while (kx > I.cx && !this.isLand(2, kx, I.cy)) kx--;
    const sk = this.findLand(2, kx - 1, I.cy, t => TILE[t].walk || t === T.PALM);
    this.clearArea(sk.x, sk.y, 1);
    this.set0(sk.x, sk.y, T.SKELETON);
    this.points.skeleton = sk;

    this.spawn('snake', 2, 9, r, t => t === T.JUNGLE || t === T.TALLGRASS, { x: hx, y: hy }, 9);
    this.spawn('boar', 2, 2, r, t => t === T.GRASS, { x: hx, y: hy }, 12);
    for (const p of this.pickTiles(2, t => t === T.GRASS || t === T.SAND, 8, r)) this.set0(p.x, p.y, T.PEBBLE);
    this.crates(2, 3, r);
  },

  // ---------------- Island 3: The Great Isle ----------------
  gen3(r) {
    const I = this.islands[2];
    const riverX = y => 182 + Math.round(2.5 * Math.sin(y * 0.13));
    const mtnX = y => 197 + Math.round(2 * Math.sin(y * 0.21));
    const mtnW = y => 7 + (RNG.noise(y * 0.35, 3.3, 41) > 0.5 ? 1 : 0);
    const PASS0 = 88, PASS1 = 95, ROAD = [91, 92];

    this.forLand(3, (x, y, d) => {
      const a = Math.atan2((y + 0.5 - I.cy) / I.ry, (x + 0.5 - I.cx) / I.rx);
      const west = Math.abs(a) > Math.PI - 0.5; // the only landing beach
      const rx = riverX(y), mx = mtnX(y);
      const q = r();
      if (!west && d > 0.9) return this.put(x, y, T.GRASS, T.CLIFF);
      if (x >= rx && x < rx + 3) return this.put(x, y, T.RIVER);
      if (x >= mx && x < mx + mtnW(y)) return this.put(x, y, T.GRASS, (y >= PASS0 && y <= PASS1) ? T.GRASS : T.MOUNTAIN);
      if (west && d > 0.84) {
        let o = T.SAND;
        if (d < 0.9 && q < 0.08) o = T.PALM; else if (q > 0.985) o = T.SHELL;
        return this.put(x, y, T.SAND, o);
      }
      const nearMtn = Math.abs(x - mx) < 6 || Math.abs(x - (mx + 7)) < 5;
      let o = T.GRASS;
      if (x < rx) { // western forest
        const n = RNG.fbm(x * 0.13, y * 0.13, 77);
        if (n > 0.42 && q < 0.45) o = T.TREE; else if (q < 0.035) o = T.BERRY; else if (q < 0.09) o = T.FLOWERS;
        else if (q < 0.16) o = T.TALLGRASS; else if (q < 0.18) o = T.ROCK; else if (q < 0.25) o = T.TREE;
      } else if (x < mx) { // river valley, pines near the mountains
        if (q < 0.2) o = nearMtn ? T.PINE : T.TREE; else if (q < 0.23) o = T.BERRY; else if (q < 0.26) o = T.ROCK;
        else if (q < 0.33) o = T.TALLGRASS; else if (q < 0.37) o = T.FLOWERS;
      } else { // meadows east of the mountains
        if (q < 0.05) o = nearMtn ? T.PINE : T.TREE; else if (q < 0.14) o = T.FLOWERS; else if (q < 0.2) o = T.TALLGRASS; else if (q < 0.22) o = T.BERRY;
      }
      this.put(x, y, T.GRASS, o);
    });

    // foothill boulders (not in the pass)
    this.forLand(3, (x, y) => {
      if (this.get(x, y) !== T.GRASS || (y >= PASS0 - 2 && y <= PASS1 + 2)) return;
      const nearMtn = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => this.get(x + dx, y + dy) === T.MOUNTAIN);
      if (nearMtn && r() < 0.3) this.set0(x, y, r() < 0.25 ? T.ORE : T.ROCK);
    });

    // Mirror Lake in the northern meadow
    const lx = 215, ly = 66;
    for (let y = ly - 4; y <= ly + 4; y++) for (let x = lx - 6; x <= lx + 6; x++) {
      if (!this.isLand(3, x, y) || this.get(x, y) === T.CLIFF) continue;
      const e = ((x - lx) / 4.5) ** 2 + ((y - ly) / 2.8) ** 2;
      if (e <= 1) this.set0(x, y, T.RIVER);
      else if (e <= 2) this.set0(x, y, T.GRASS);
    }
    this.addSign(lx, ly + 4, 'lake');

    // Farm fields near town
    for (let y = 80; y <= 104; y++) {
      if (y >= 89 && y <= 94) continue;
      for (let x = 208; x <= 216; x++) {
        const t = this.get(x, y);
        if (!this.isLand(3, x, y) || t === T.CLIFF || t === T.MOUNTAIN || t === T.RIVER) continue;
        this.set0(x, y, y % 4 === 0 ? T.PATH : T.CROPS);
      }
    }

    // The old road from the beach to the town gate
    let beachX = 0;
    for (let x = 140; x < this.town.x0; x++) {
      for (const y of ROAD) {
        if (!this.isLand(3, x, y)) continue;
        if (!beachX) beachX = x;
        const t = this.get(x, y);
        if (t === T.RIVER) this.set0(x, y, T.BRIDGE_BROKEN);
        else if (t !== T.CLIFF) this.set0(x, y, T.PATH);
      }
    }
    this.pois.push({ x: riverX(91) + 1, y: 91, kind: 'bridge' });

    // Port Haven
    const Tn = this.town;
    for (let y = Tn.y0 - 1; y <= Tn.y1 + 1; y++) for (let x = Tn.x0 - 1; x <= Tn.x1 + 1; x++) {
      const i = this.idx(x, y);
      const inside = x >= Tn.x0 && x <= Tn.x1 && y >= Tn.y0 && y <= Tn.y1;
      if (inside) {
        this.isl[i] = 3; this.dmap[i] = Math.min(this.dmap[i], 0.5);
        const border = x === Tn.x0 || x === Tn.x1 || y === Tn.y0 || y === Tn.y1;
        this.set0(x, y, T.COBBLE);
        if (border) this.set0(x, y, T.TOWNWALL);
      } else if (this.isLand(3, x, y) && this.get(x, y) !== T.CLIFF) {
        this.set0(x, y, T.GRASS);
      }
    }
    for (let x = Tn.x0 - 3; x < Tn.x0; x++) for (const y of ROAD) if (this.isLand(3, x, y)) this.set0(x, y, T.PATH);
    for (const y of ROAD) this.set0(Tn.x0, y, T.GATE);
    const houses = [[223, 81], [230, 81], [238, 81], [223, 100], [230, 100], [238, 100], [239, 87]];
    for (const [hx, hy] of houses) {
      for (let i = 0; i < 5; i++) {
        this.set0(hx + i, hy, T.ROOF);
        this.set0(hx + i, hy + 1, T.ROOF);
        this.set0(hx + i, hy + 2, i === 2 ? T.DOOR : T.HOUSEWALL);
      }
    }
    this.set0(Tn.fx, Tn.fy, T.FOUNTAIN);
    for (const [lx2, ly2] of [[226, 89], [226, 95], [240, 94], [233, 87], [233, 97], [244, 84], [244, 99]]) this.set0(lx2, ly2, T.LAMP);
    this.pois.push({ x: Tn.fx, y: Tn.fy, kind: 'town' });

    this.addRelic(3, 216, 50, T.ROCK);

    // Signs & campfires
    const walkable = t => [T.GRASS, T.SAND, T.TALLGRASS, T.FLOWERS, T.TREE, T.PALM].includes(t);
    const b = this.findLand(3, beachX + 3, 89, walkable);
    this.addSign(b.x, b.y, 'beach3');
    const c1 = this.findLand(3, beachX + 4, 95, walkable);
    this.addCampfire(c1.x, c1.y);
    const bs = this.findLand(3, riverX(90) - 2, 90, walkable);
    this.addSign(bs.x, bs.y, 'bridge');
    const c2 = this.findLand(3, riverX(95) + 6, 95, walkable);
    this.addCampfire(c2.x, c2.y);
    const ps = this.findLand(3, mtnX(90) - 2, 89, walkable);
    this.addSign(ps.x, ps.y, 'pass');
    const c3 = this.findLand(3, 211, 95, walkable);
    this.addCampfire(c3.x, c3.y);
    this.addSign(Tn.x0 - 2, 89, 'town');
    this.points.beach3 = { x: beachX, y: 91 };

    // Biscuit the lost cat, deep in the western forest
    const cat = this.findLand(3, 170, 113, t => this.isPlain(t));
    this.clearArea(cat.x, cat.y, 1);
    this.points.cat = cat;

    // People of Port Haven
    this.npcSpawns.push({ role: 'guard', name: 'Guard', x: Tn.x0 + 2, y: 90,
      look: { skin: '#c68642', hair: '#2a1a0a', shirt: '#3a5aa8', pants: '#2a2a3a', hat: 'helmet' } });
    this.npcSpawns.push({ role: 'mayor', name: 'Mayor Elin', x: Tn.fx, y: Tn.fy + 2,
      look: { skin: '#f1c27d', hair: '#8a3a2a', shirt: '#7a3a9a', pants: '#3a2a4a', sash: '#e0b040' } });
    const vLooks = [
      { skin: '#8d5524', hair: '#1a1a1a', shirt: '#2a8a8a', pants: '#3a3a4a', hat: 'bandana', band: '#e8e0c8' },
      { skin: '#f1c27d', hair: '#d8a040', shirt: '#e8e0c8', pants: '#6b4a2a' },
      { skin: '#e0ac69', hair: '#aaaaaa', shirt: '#8a4a2a', pants: '#3a4a2a', beard: '#aaaaaa' },
      { skin: '#c68642', hair: '#3a2010', shirt: '#e0a030', pants: '#3a5a8c', hat: 'cap', band: '#d94f3d' },
      { skin: '#ffdbac', hair: '#5a2a0a', shirt: '#4a8a3a', pants: '#5a3a2a' },
    ];
    const vPos = [[227, 95], [236, 88], [242, 96], [228, 86], [237, 97]];
    STORY.villagers.forEach(([name, lines], i) => {
      this.npcSpawns.push({ role: name === 'Pip' ? 'pip' : 'villager', name, lines, x: vPos[i][0], y: vPos[i][1], look: vLooks[i], wander: true });
    });

    const wild = t => t === T.GRASS || t === T.TALLGRASS || t === T.FLOWERS;
    this.spawn('rabbit', 3, 5, r, wild);
    this.spawn('deer', 3, 5, r, (t, x) => wild(t) && x > 186);
    this.spawn('wolf', 3, 3, r, (t, x, y) => wild(t) && y < 66 && x > 186 && x < 218);
    this.spawn('bear', 3, 1, r, (t, x, y) => wild(t) && y < 62 && x < 180);
    for (const p of this.pickTiles(3, (t, x) => (t === T.GRASS || t === T.SAND) && x < 206, 10, r)) this.set0(p.x, p.y, T.PEBBLE);
    this.crates(3, 3, r);
    for (const p of this.pickTiles(3, (t, x) => wild(t) && x < riverX(0) - 3, 4, r, this.points.beach3, 10)) this.mobSpawns.push({ kind: 'boar', ...p });
    for (const p of this.pickTiles(3, (t, x) => wild(t) && x > riverX(0) + 4 && x < 196, 3, r)) this.mobSpawns.push({ kind: 'boar', ...p });
    for (const p of this.pickTiles(3, (t, x) => wild(t) && x > 208 && x < Tn.x0 - 2, 3, r)) this.mobSpawns.push({ kind: 'boar', ...p });
  },

  // ---------------- Island 4: Gull Rock ----------------
  gen4(r) {
    const I = this.island(4);
    this.forLand(4, (x, y, d) => {
      const q = r();
      if (d > 0.8) {
        let o = T.SAND;
        if (q < 0.08) o = T.ROCK; else if (q < 0.15) o = T.PEBBLE; else if (q > 0.99) o = T.SHELL;
        return this.put(x, y, T.SAND, o);
      }
      let o = T.GRASS;
      if (q < 0.2) o = T.ROCK; else if (q < 0.28) o = T.ORE; else if (q < 0.34) o = T.PEBBLE;
      else if (q < 0.46) o = T.TALLGRASS; else if (q < 0.51) o = T.TREE; else if (q < 0.54) o = T.BERRY;
      this.put(x, y, T.GRASS, o);
    });
    this.addDig(4, I.cx, I.cy);
    this.crates(4, 2, r);
    this.spawn('crab', 4, 3, r, t => t === T.SAND);
  },

  // ---------------- Island 5: Crab Key ----------------
  gen5(r) {
    const I = this.island(5);
    this.forLand(5, (x, y) => {
      const q = r();
      let o = T.SAND;
      if (q < 0.12) o = T.PALM; else if (q < 0.15) o = T.SHELL; else if (q < 0.17) o = T.PEBBLE;
      this.put(x, y, T.SAND, o);
    });
    this.addDig(5, I.cx, I.cy);
    this.crates(5, 1, r);
    this.spawn('crab', 5, 7, r, t => t === T.SAND);
  },

  // ---------------- Island 6: Mossfen ----------------
  gen6(r) {
    const I = this.island(6);
    this.forLand(6, (x, y, d) => {
      const q = r();
      if (d > 0.88) return this.put(x, y, T.SAND, q < 0.05 ? T.DEADTREE : q < 0.07 ? T.PEBBLE : T.SAND);
      if (d < 0.8 && RNG.fbm(x * 0.2, y * 0.2, 62) > 0.64) return this.put(x, y, T.RIVER);
      const g = RNG.fbm(x * 0.14, y * 0.14, 61) > 0.5 ? T.MUD : T.JUNGLE;
      let o = g;
      if (q < 0.14) o = T.JTREE; else if (q < 0.2) o = T.DEADTREE; else if (q < 0.24) o = T.MUSHROOMS;
      else if (q < 0.29) o = T.VINE; else if (q < 0.4) o = T.TALLGRASS; else if (q < 0.41) o = T.BERRY;
      this.put(x, y, g, o);
    });
    this.addRelic(6, I.cx + 10, I.cy - 3, T.JTREE);
    const bx = I.cx - 14, by = I.cy + 4;
    for (let y = by - 6; y <= by + 6; y++) for (let x = bx - 9; x <= bx + 9; x++) {
      if (!this.isLand(6, x, y)) continue;
      const e = ((x - bx) / 4.5) ** 2 + ((y - by) / 3) ** 2;
      if (e <= 1) this.put(x, y, T.RIVER);
      else if (e <= 3.2) this.put(x, y, T.MUD);
    }
    this.bossSpawns.push({ kind: 'bogking', x: bx, y: by });
    this.pois.push({ x: bx, y: by, kind: 'boss' });
    const bs = this.findLand(6, bx + 7, by - 4, t => t === T.MUD || t === T.JUNGLE);
    this.addSign(bs.x, bs.y, 'bog');
    const cf = this.findLand(6, I.cx - 4, I.cy - I.ry + 3, t => this.isPlain(t));
    this.addCampfire(cf.x, cf.y);
    this.crates(6, 3, r);
    const nearWater = (t, x, y) => this.isPlain(t) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => this.get(x + dx, y + dy) === T.RIVER);
    this.spawn('croc', 6, 5, r, nearWater, cf, 8);
    this.spawn('snake', 6, 5, r, t => t === T.JUNGLE || t === T.MUD || t === T.TALLGRASS, cf, 8);
    this.spawn('rabbit', 6, 2, r, t => this.isPlain(t));
  },

  // ---------------- Island 7: Frostpeak ----------------
  gen7(r) {
    const I = this.island(7);
    this.forLand(7, (x, y, d) => {
      const q = r();
      if (d < 0.2) return this.put(x, y, T.SNOW, T.MOUNTAIN);
      if (d > 0.9) return this.put(x, y, T.SNOW, q < 0.05 ? T.ROCK : T.SNOW);
      const n = RNG.fbm(x * 0.13, y * 0.13, 71);
      let o = T.SNOW;
      if (n > 0.48 && q < 0.4) o = T.SNOWPINE; else if (q < 0.05) o = T.ROCK; else if (q < 0.085) o = T.ORE; else if (q < 0.11) o = T.SNOWPINE;
      this.put(x, y, T.SNOW, o);
    });
    this.addRelic(7, I.cx - 12, I.cy + 5, T.SNOWPINE);
    const lx = I.cx + 2, ly = I.cy - 12;
    this.clearArea(lx, ly, 5);
    this.bossSpawns.push({ kind: 'frostfang', x: lx, y: ly });
    this.pois.push({ x: lx, y: ly, kind: 'boss' });
    const fs = this.findLand(7, lx - 6, ly + 5, t => t === T.SNOW);
    this.addSign(fs.x, fs.y, 'frost');
    const cf = this.findLand(7, I.cx, I.cy + I.ry - 3, t => t === T.SNOW);
    this.addCampfire(cf.x, cf.y);
    this.crates(7, 2, r);
    this.spawn('wolf', 7, 5, r, t => t === T.SNOW, cf, 10);
    this.spawn('bear', 7, 2, r, t => t === T.SNOW, cf, 12);
    this.spawn('deer', 7, 4, r, t => t === T.SNOW, cf, 6);
  },

  // ---------------- Island 8: Ember Isle ----------------
  gen8(r) {
    const I = this.island(8);
    const gate = [];
    this.forLand(8, (x, y, d) => {
      const q = r();
      const road = Math.abs(y - I.cy) <= 1 && x < I.cx;
      if (d < 0.3) return this.put(x, y, T.ASH, q < 0.03 ? T.PEBBLE : T.ASH);   // Magmaw's arena
      if (d < 0.42) {                                                          // ring of lava around it
        if (road) { gate.push({ x, y }); return this.put(x, y, T.ASH); }
        return this.put(x, y, T.LAVA);
      }
      if (road) return this.put(x, y, T.ASH);                                  // a clear road from the beach
      if (d < 0.75 && RNG.fbm(x * 0.25, y * 0.25, 81) > 0.7) return this.put(x, y, T.LAVA);
      let o = T.ASH;
      if (q < 0.09) o = T.ORE; else if (q < 0.17) o = T.ROCK; else if (q < 0.22) o = T.DEADTREE; else if (q < 0.25) o = T.PEBBLE;
      this.put(x, y, T.ASH, o);
    });
    this.addRelic(8, I.cx + 17, I.cy + 6, T.ROCK);
    const cf = this.findLand(8, I.cx - I.rx + 4, I.cy + 3, t => t === T.ASH);
    this.addCampfire(cf.x, cf.y);
    this.crates(8, 2, r);
    const outside = (t, x, y) => t === T.ASH && this.dmap[this.idx(x, y)] > 0.5;
    this.spawn('scorpion', 8, 7, r, outside, cf, 8);
    this.points.emberGate = gate;
    this.bossSpawns.push({ kind: 'magmaw', x: I.cx, y: I.cy });
    this.pois.push({ x: I.cx, y: I.cy, kind: 'boss' });
    const gx = Math.min(...gate.map(g => g.x));
    const sg = this.findLand(8, gx - 2, I.cy - 2, t => t === T.ASH);
    this.addSign(sg.x, sg.y, 'ember');
  },

  // ---------------- Island 9: Palm Atoll ----------------
  gen9(r) {
    const I = this.island(9);
    this.forLand(9, (x, y, d) => {
      if (d < 0.55) { this.dmap[this.idx(x, y)] = 1.05; return this.set0(x, y, T.SHALLOW); }
      const q = r();
      let o = T.SAND;
      if (q < 0.1) o = T.PALM; else if (q < 0.13) o = T.SHELL; else if (q < 0.15) o = T.PEBBLE;
      this.put(x, y, T.SAND, o);
    });
    const hx = I.cx - 1, hy = I.cy + Math.round(I.ry * 0.62);
    for (let y = hy - 1; y <= hy + 3; y++) for (let x = hx - 2; x <= hx + 4; x++) if (this.isLand(9, x, y)) this.set0(x, y, T.SAND);
    for (let i = 0; i < 3; i++) { this.set0(hx + i, hy, T.HUTROOF); this.set0(hx + i, hy + 1, T.HUTWALL); }
    this.npcSpawns.push({ role: 'trader', name: 'Salty Pete', x: hx + 1, y: hy + 2,
      look: { skin: '#c68642', hair: '#2a1a0a', beard: '#2a1a0a', shirt: '#2a4a8a', pants: '#e8e0c8', hat: 'bandana', band: '#d94f3d' } });
    this.addCampfire(hx - 2, hy + 2);
    this.pois.push({ x: hx + 1, y: hy, kind: 'hut' });
    this.addDig(9, I.cx, I.cy - Math.round(I.ry * 0.78));
    this.crates(9, 2, r);
    this.spawn('crab', 9, 3, r, t => t === T.SAND);
  },

  // Message bottles drifting in open water between the islands
  placeBottles() {
    const spots = [[62, 104], [78, 142], [128, 98], [134, 28], [66, 22], [130, 150], [16, 70], [150, 196], [300, 128], [262, 238]];
    spots.forEach(([x, y], id) => {
      for (let rad = 0; rad < 20; rad++) {
        const a = rad * 2.4;
        const tx = Math.round(x + Math.cos(a) * rad), ty = Math.round(y + Math.sin(a) * rad);
        if (this.get(tx, ty) === T.DEEP) { this.bottles.push({ id, x: tx, y: ty }); return; }
      }
    });
  },

  reveal(cx, cy, rad) {
    for (let y = cy - rad; y <= cy + rad; y++) for (let x = cx - rad; x <= cx + rad; x++) {
      if (!this.inb(x, y) || (x - cx) ** 2 + (y - cy) ** 2 > rad * rad) continue;
      const i = y * this.W + x;
      if (this.explored[i]) continue;
      this.explored[i] = 1;
      if (this.dmap[i] < 1) this.landExplored++;
      UI.paintTile(x, y);
    }
  },
};
