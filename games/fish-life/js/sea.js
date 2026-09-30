'use strict';
/* =====================================================================
   FISH LIFE  -  sea.js
   Chapter 1: THE SEA. Eat what fish eat, grow, survive predators...
   until the day the fishing net comes.
   ===================================================================== */

const SEA_W = 3200, SEA_H = 420, SEA_SURF = 52, TERR_Y = 290;

const STAGES = [
  { name: 'TINY FRY', size: 1, r: 3, speed: 54, spr: 'hero0', goal: 10, hp: 3 },
  { name: 'YOUNG FISH', size: 2, r: 5, speed: 60, spr: 'hero1', goal: 22, hp: 4 },
  { name: 'BIG FISH', size: 3, r: 7, speed: 66, spr: 'hero2', goal: 30, hp: 5 },
];
const SPECIES = {
  guppy: { size: 0.5, r: 3, speed: 34, sight: 40, food: 2, band: [70, 230], spr: 'guppy', name: 'TINY FISH' },
  minnow: { size: 1.5, r: 4, speed: 43, sight: 46, food: 4, band: [90, 290], spr: 'minnow', chase: 2.4, name: 'MINNOW' },
  perch: { size: 2.5, r: 6, speed: 49, sight: 56, food: 6, band: [140, 340], spr: 'perch', chase: 2.8, name: 'PERCH' },
  barracuda: { size: 4, r: 6, speed: 64, sight: 72, band: [190, 360], spr: 'barracuda', chase: 1.7, name: 'BARRACUDA' },
  shark: { size: 9, r: 11, speed: 55, sight: 96, band: [240, 360], spr: 'shark', chase: 3.4, name: 'SHARK' },
};
const POP = [
  { guppy: 16, minnow: 7, perch: 4, barracuda: 2, shark: 0, krill: 13, worm: 9, larva: 16, plankton: 90, egg: 9, jelly: 7, crab: 7 },
  { guppy: 13, minnow: 15, perch: 7, barracuda: 3, shark: 0, krill: 18, worm: 13, larva: 11, plankton: 70, egg: 9, jelly: 9, crab: 9 },
  { guppy: 9, minnow: 16, perch: 13, barracuda: 4, shark: 2, krill: 18, worm: 13, larva: 9, plankton: 56, egg: 7, jelly: 11, crab: 9 },
];
const FOODS = {
  plankton: { value: 1, min: 0, r: 2, name: 'PLANKTON' },
  larva: { value: 1, min: 0, r: 2, name: 'LARVA' },
  egg: { value: 2, min: 0, r: 3, name: 'FISH EGGS' },
  krill: { value: 2, min: 1, r: 3, name: 'KRILL' },
  worm: { value: 3, min: 1, r: 3, name: 'WORM' },
};

class SeaScene {
  constructor() {
    this.t = 0;
    this.stage = clamp(GS.sea.stage | 0, 0, 2);
    this.food = GS.sea.food || 0;
    this.parts = new Particles();
    this.floaters = new Floaters();
    this.pause = new PauseMenu(() => { saveGame(); Game.go(() => new TitleScene({ skipIntro: true })); });
    this.buildWorld();
    const st = STAGES[this.stage];
    this.p = { x: 640, y: 110, vx: 0, vy: 0, facing: 1, hp: st.hp, inv: 1.5, dashT: 0, dashCd: 0, anim: 0, hunger: 1, starveT: 0, dead: false, surfT: 0, flash: 0 };
    this.cam = { x: this.p.x - W / 2, y: 0 };
    this.fish = [];
    this.foods = [];
    this.jellies = [];
    this.crabs = [];
    this.gull = { state: 'none', x: 0, y: 0, t: 0, cd: 5, bx: 0 };
    this.state = 'play';
    this.banner = null;
    this.tut = this.stage === 0 && this.food === 0 ? 0 : -1;
    this.tutT = 0;
    this.moved = 0;
    this.spawnT = 0;
    this.saveT = 0;
    this.tooBigT = 0;
    this.deadT = 0;
    this.net = null;
    this.sharkWarned = false;
    this.populate();
  }

  enter() { Sound.play('sea'); }
  onBlur() { if (this.state === 'play' && !this.pause.open) this.pause.toggle(); }

  /* ------------------------------------------------------------ world */
  floorAt(x) { return this.floor[clamp(Math.round(x), 0, SEA_W - 1)]; }

  buildWorld() {
    const r = mulberry32(21);
    // --- sea floor heights
    const sand = new Float32Array(SEA_W);
    for (let x = 0; x < SEA_W; x++) sand[x] = 386 + Math.sin(x * 0.0042 + 1) * 12 + Math.sin(x * 0.013 + 2) * 5 + Math.sin(x * 0.041) * 1.5;
    this.rocks = [];
    let rx = 70;
    while (rx < SEA_W - 50) {
      const a = 14 + r() * 24, b = 10 + r() * 22;
      if (!(rx > 1110 && rx < 1290) && !(rx > 2400 && rx < 2580)) this.rocks.push({ x: rx, a, b, y: sand[Math.round(rx)] + 4 });
      rx += 100 + r() * 120;
    }
    this.floor = new Float32Array(SEA_W);
    for (let x = 0; x < SEA_W; x++) {
      let f = sand[x];
      for (const k of this.rocks) {
        const dx = (x - k.x) / k.a;
        if (Math.abs(dx) < 1) f = Math.min(f, k.y - k.b * Math.sqrt(1 - dx * dx) + 2);
      }
      this.floor[x] = f;
    }
    // --- water & sky backdrops
    this.waterBg = gradientCanvas(W, SEA_H, [
      [0, '#48c3dd'], [0.12, '#35aad0'], [0.26, '#2690c0'], [0.42, '#1f78ac'], [0.58, '#1a6296'], [0.74, '#154f80'], [0.88, '#113f6a'], [1, '#0e3258'],
    ], 2.5);
    this.rays = [];
    for (let x = 60; x < SEA_W; x += 170) {
      const i = this.rays.length;
      this.rays.push({ x, img: makeRay(8 + (i % 4) * 4, 170 + (i % 3) * 40, -0.3, '#e8fbff', 0.13) });
    }
    this.waves = makeWaveStrips(W, '#d4f1fb', '#48c3dd', '#e8fbff', '#8fe2f0');
    this.skyBg = gradientCanvas(W, SEA_SURF, [[0, '#5ab4ef'], [0.4, '#7cc8f4'], [0.8, '#a8def8'], [1, '#d4f1fb']], 2.5);
    this.waterAt = y => {
      const stops = ['#48c3dd', '#35aad0', '#2690c0', '#1f78ac', '#1a6296', '#154f80', '#113f6a', '#0e3258'];
      return stops[clamp(Math.floor((y / SEA_H) * stops.length), 0, stops.length - 1)];
    };
    // --- parallax silhouettes
    this.far = this.silhouettes(W + (SEA_W - W) * 0.3, H + (SEA_H - H) * 0.3, 7, 70, '#0a3050', 0.8);
    this.mid = this.silhouettes(W + (SEA_W - W) * 0.55, H + (SEA_H - H) * 0.55, 8, 90, '#082848', 0.9);
    // --- terrain canvas
    this.paintTerrain(sand, r);
    // --- kelp
    this.kelp = [];
    const clusters = [[330, 7], [520, 4], [930, 8], [1420, 6], [160, 3], [760, 3], [1750, 9], [2050, 5], [2300, 7], [2700, 6], [2950, 8], [3120, 4]];
    for (const [cx, n] of clusters) for (let i = 0; i < n; i++) this.kelp.push({ x: Math.round(cx + (r() - 0.5) * 70), h: 40 + r() * 90, ph: r() * 6 });
    this.fgGrass = [];
    for (let i = 0; i < 80; i++) this.fgGrass.push({ x: Math.round(r() * SEA_W), h: 5 + r() * 8, ph: r() * 6 });
    // --- bubble vents
    this.vents = [];
    for (let i = 0; i < 16; i++) this.vents.push({ x: Math.round(80 + r() * (SEA_W - 160)), t: r() * 3 });
    // --- eels hide in the bigger rocks
    this.eels = [];
    for (const k of this.rocks) {
      if (k.b > 18 && this.eels.length < 9 && r() < 0.8) {
        const side = r() < 0.5 ? -1 : 1;
        this.eels.push({ hx: Math.round(k.x + side * k.a * 0.3), hy: Math.round(k.y - k.b * 0.5), dir: side, ext: 0, state: 'hide', t: 0, cd: 1 + r() * 2 });
      }
    }
    // paint the eel holes
    const g = this.terrain.getContext('2d'), prev = setTarget(g);
    for (const e of this.eels) {
      ellipse(e.hx, e.hy - TERR_Y, 4, 3, '#0a1822');
      ellipse(e.hx, e.hy - TERR_Y + 1, 3, 2, '#050c12');
    }
    setTarget(prev);
    // giant clams hide 6 pearls around the sea
    this.clams = [480, 1020, 1560, 2130, 2760, 3090].map((x, i) => ({ x, i, t: i * 0.9, open: 0 }));
    this.eggSpots = [];
    for (const k of this.rocks) for (let i = 0; i < 2; i++) {
      const a = (r() - 0.5) * 1.6;
      this.eggSpots.push({ x: Math.round(k.x + Math.sin(a) * k.a * 0.8), y: Math.round(k.y - Math.cos(a) * k.b * 0.95) - 2 });
    }
  }

  silhouettes(w, h, seed, base, col, rough) {
    const c = makeCanvas(w, h), g = c.getContext('2d'), prev = setTarget(g);
    const r = mulberry32(seed);
    const peaks = [];
    for (let i = 0; i < w / 60; i++) peaks.push({ x: r() * w, h: 20 + r() * 60 * rough, w: 6 + r() * 12 });
    for (let x = 0; x < w; x++) {
      let top = h - base + Math.sin(x * 0.011 + seed) * 18 + Math.sin(x * 0.037 + seed * 2) * 8 * rough + Math.sin(x * 0.13) * 2;
      for (const p of peaks) {
        const d = Math.abs(x - p.x);
        if (d < p.w) top = Math.min(top, h - base - p.h * (1 - (d / p.w) * (d / p.w)) + 10);
      }
      rect(x, Math.round(top), 1, h, col);
    }
    setTarget(prev);
    return c;
  }

  paintTerrain(sand, r) {
    const TH = SEA_H - TERR_Y;
    this.terrain = makeCanvas(SEA_W, TH);
    const g = this.terrain.getContext('2d'), prev = setTarget(g);
    // sand
    for (let x = 0; x < SEA_W; x++) {
      const top = Math.round(sand[x]) - TERR_Y;
      rect(x, top, 1, TH - top, '#8f8a74');
      rect(x, top + 6, 1, TH - top, '#7a7864');
      px(x, top, '#b5ad8c');
      if (r() < 0.5) px(x, top + 1, '#a39c80');
      for (let y = top + 2; y < TH; y += 1) if (r() < 0.08) px(x, y, r() < 0.5 ? '#6a6a58' : '#a39c80');
    }
    // sunken ship
    this.paintShip(1130, sand[1180] - TERR_Y + 6);
    this.paintArch(2490, sand, r);
    // rocks with top-left lighting
    for (const k of this.rocks) {
      const cy = k.y - TERR_Y;
      for (let y = Math.floor(cy - k.b - 1); y <= cy + 2; y++) {
        for (let x = Math.floor(k.x - k.a - 1); x <= k.x + k.a + 1; x++) {
          const nx = (x - k.x) / k.a, ny = (y - cy) / k.b;
          const n = Math.sin(x * 0.9 + y * 0.4) * 0.05 + Math.sin(x * 0.3 - y * 0.7) * 0.05;
          const d = nx * nx + ny * ny + n;
          if (d > 1 || ny > 0.15) continue;
          const v = -nx * 0.45 - ny * 0.9 + n * 3;
          let c = v > 0.62 ? '#5d8aa0' : v > 0.25 ? '#436b82' : v > -0.1 ? '#325466' : '#243f50';
          if (d > 0.86) c = '#16283a';
          px(x, y, c);
        }
      }
      // moss & barnacles
      for (let i = 0; i < k.a / 3; i++) {
        const a = (r() - 0.5) * 2.2, mx = Math.round(k.x + Math.sin(a) * k.a * 0.85), my = Math.round(cy - Math.cos(a) * k.b * 0.9);
        px(mx, my, r() < 0.5 ? '#4f8a5a' : '#c0cbdc');
      }
    }
    // coral gardens
    const branch = (x, y, len, ang, col, depth) => {
      const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
      line(x, y, x2, y2, col);
      line(x + 1, y, x2 + 1, y2, col);
      if (depth > 0) {
        branch(x2, y2, len * 0.72, ang - 0.45 - r() * 0.3, col, depth - 1);
        branch(x2, y2, len * 0.72, ang + 0.45 + r() * 0.3, col, depth - 1);
      } else disc(x2, y2, 1, mix(col, '#ffffff', 0.3));
    };
    const corals = ['#d8707e', '#e07a3a', '#a0508f', '#d9a040', '#e05a5a'];
    for (let i = 0; i < 120; i++) {
      const x = Math.round(20 + r() * (SEA_W - 40));
      if ((x > 1110 && x < 1290) || (x > 2440 && x < 2540)) continue;
      const top = Math.round(this.floor[x]) - TERR_Y + 2;
      const col = corals[Math.floor(r() * corals.length)];
      const kind = r();
      if (kind < 0.4) branch(x, top, 5 + r() * 5, -Math.PI / 2 + (r() - 0.5) * 0.4, col, 2);
      else if (kind < 0.6) {
        for (let a = -2.7; a < -0.4; a += 0.2) line(x, top, x + Math.cos(a) * 9, top + Math.sin(a) * 9, col);
        ring(x, top, 9, mix(col, '#ffffff', 0.2));
      } else if (kind < 0.8) {
        for (let j = 0; j < 3; j++) { const th = 4 + Math.floor(r() * 8); rect(x + j * 3, top - th, 2, th, col); px(x + j * 3, top - th, mix(col, '#ffffff', 0.4)); px(x + j * 3 + 1, top - th, '#3a2030'); }
      } else {
        ellipse(x, top - 2, 5, 3, col);
        ellipse(x, top - 3, 4, 2, mix(col, '#ffffff', 0.25));
        for (let j = -3; j <= 3; j += 2) px(x + j, top - 3 + (j % 4 ? 1 : 0), mix(col, '#000000', 0.3));
      }
    }
    // sea grass tufts, shells and starfish on the sand
    for (let i = 0; i < 280; i++) {
      const x = Math.round(r() * SEA_W), top = Math.round(sand[clamp(x, 0, SEA_W - 1)]) - TERR_Y;
      const h = 2 + Math.floor(r() * 5);
      for (let j = 0; j < 3; j++) line(x + j * 2, top, x + j * 2 + (j - 1), top - h - (j === 1 ? 2 : 0), j === 1 ? '#3f7a52' : '#2f6044');
    }
    setTarget(prev);
    for (let i = 0; i < 60; i++) {
      const x = Math.round(r() * (SEA_W - 10)), top = Math.round(sand[x]) - TERR_Y;
      g.drawImage(r() < 0.5 ? SPR.shell.r[0] : SPR.star.r[0], x, top - 1);
    }
  }

  // A big natural rock arch covered in coral: a landmark in the far east.
  paintArch(cx, sand, r) {
    const base = Math.round(sand[cx]) - TERR_Y + 4;
    const rock = (x, y, c) => px(x, y, c);
    for (let y = 8; y <= base; y++) {
      for (let x = cx - 70; x <= cx + 70; x++) {
        const dx = x - cx, dy = base - y;
        const outer = (dx * dx) / (68 * 68) + (dy * dy) / (86 * 86);
        const inner = (dx * dx) / (40 * 40) + (dy * dy) / (62 * 62);
        if (outer > 1 || inner < 1) continue;
        const n = Math.sin(x * 0.7 + y * 0.3) * 0.04;
        const edge = outer > 0.92 - n || inner < 1.08 + n;
        const lit = dx < 0 ? (dy > 40 ? '#56809a' : '#436b82') : '#325466';
        rock(x, y, edge ? '#16283a' : (x + y) % 7 === 0 ? '#243f50' : lit);
      }
    }
    // coral crown on top of the arch
    const cols = ['#d8707e', '#e07a3a', '#a0508f', '#d9a040'];
    for (let i = 0; i < 26; i++) {
      const a = Math.PI * (0.12 + 0.76 * (i / 25)), x = Math.round(cx - Math.cos(a) * 66), y = Math.round(base - Math.sin(a) * 84);
      const c = cols[i % cols.length];
      rect(x - 1, y - 3 - (i % 3), 2, 4 + (i % 3), c);
      px(x, y - 4 - (i % 3), mix(c, '#ffffff', 0.4));
    }
    for (let i = 0; i < 40; i++) px(Math.round(cx - 60 + r() * 120), Math.round(base - r() * 80), '#4f8a5a');
  }

  paintShip(x0, base) {
    // a tilted, broken old wooden ship resting on the sand
    for (let x = 0; x < 120; x++) {
      const tilt = x * 0.1;
      const top = Math.round(base - 26 + tilt + (x < 12 ? (12 - x) * 0.9 : 0) - (x > 100 ? (x - 100) * -0.3 : 0));
      const bottom = Math.round(base + 4 + tilt * 0.3);
      for (let y = top; y < bottom; y++) {
        let c = (y - top) % 5 === 0 ? '#3a2a28' : '#5c4034';
        if (y === top) c = '#8a6450';
        if ((x * 7 + y * 3) % 37 === 0) c = '#2f5a4a';
        px(x0 + x, y, c);
      }
    }
    for (let i = 0; i < 4; i++) {
      const hx = x0 + 22 + i * 24, hy = Math.round(base - 14 + (22 + i * 24) * 0.1);
      disc(hx, hy, 3, '#8a6450');
      disc(hx, hy, 2, '#0a1620');
    }
    // hole in the hull
    ellipse(x0 + 86, base - 8 + 9, 7, 5, '#0a1620');
    // broken mast
    thickLine(x0 + 55, base - 22, x0 + 68, base - 70, 1.5, '#4a3428');
    thickLine(x0 + 66, base - 60, x0 + 48, base - 58, 1, '#4a3428');
    for (let i = 0; i < 9; i++) px(x0 + 50 + i * 2, base - 56 + (i % 3), '#9a8a70');
    // treasure chest!
    const cx = x0 + 132, cy = base - 2;
    rect(cx, cy - 6, 12, 7, '#6e4a2e');
    rect(cx, cy - 8, 12, 3, '#8a5a34');
    rect(cx, cy - 6, 12, 1, '#d9a040');
    rect(cx + 5, cy - 5, 2, 2, '#fee761');
    for (let i = 0; i < 5; i++) px(cx + 2 + i * 2, cy - 9, '#fee761');
  }

  /* -------------------------------------------------------- spawning */
  populate() {
    const pop = POP[this.stage];
    for (const k in SPECIES) for (let i = 0; i < pop[k]; i++) this.spawnFish(k, false);
    for (const k in FOODS) for (let i = 0; i < pop[k]; i++) this.spawnFood(k, false);
    for (let i = 0; i < pop.jelly; i++) this.spawnJelly(false);
    for (let i = 0; i < pop.crab; i++) this.spawnCrab();
  }
  onScreen(x, y, m = 30) {
    return x > this.cam.x - m && x < this.cam.x + W + m && y > this.cam.y - m && y < this.cam.y + H + m;
  }
  spawnFish(kind, off = true) {
    const sp = SPECIES[kind];
    for (let i = 0; i < 30; i++) {
      const x = rnd(30, SEA_W - 30), y = rnd(sp.band[0], sp.band[1]);
      if (y > this.floorAt(x) - sp.r - 8) continue;
      if (dist(x, y, this.p ? this.p.x : 640, this.p ? this.p.y : 110) < 120) continue;
      if (off && this.onScreen(x, y, 40)) continue;
      const f = { kind, x, y, vx: 0, vy: 0, facing: Math.random() < 0.5 ? 1 : -1, tx: x, ty: y, state: 'wander', chaseT: 0, cool: 2, anim: rnd(10), alert: 0 };
      this.pickTarget(f);
      this.fish.push(f);
      return;
    }
  }
  pickTarget(f) {
    const sp = SPECIES[f.kind];
    f.tx = clamp(f.x + rnd(-160, 160), 20, SEA_W - 20);
    f.ty = rnd(sp.band[0], sp.band[1]);
    f.ty = Math.min(f.ty, this.floorAt(f.tx) - sp.r - 10);
  }
  spawnFood(kind, off = true) {
    for (let i = 0; i < 30; i++) {
      let x = rnd(20, SEA_W - 20), y;
      if (kind === 'plankton') y = SEA_SURF + 8 + Math.pow(Math.random(), 1.6) * (this.floorAt(x) - SEA_SURF - 20);
      else if (kind === 'larva') y = rnd(SEA_SURF + 6, SEA_SURF + 60);
      else if (kind === 'krill') y = rnd(SEA_SURF + 40, 300);
      else if (kind === 'worm') y = this.floorAt(x) - 1;
      else { const s = pick(this.eggSpots); x = s.x; y = s.y; }
      if (off && this.onScreen(x, y, 20)) continue;
      if (kind !== 'worm' && kind !== 'egg' && y > this.floorAt(x) - 6) continue;
      this.foods.push({ kind, x, y, vx: 0, vy: 0, ph: rnd(10), t: 0, hop: 0 });
      return;
    }
  }
  spawnJelly(off = true) {
    for (let i = 0; i < 30; i++) {
      const x = rnd(40, SEA_W - 40), y = rnd(SEA_SURF + 60, 320);
      if (off && this.onScreen(x, y, 30)) continue;
      if (dist(x, y, this.p ? this.p.x : 640, this.p ? this.p.y : 110) < 90) continue;
      this.jellies.push({ x, y, vy: 0, ph: rnd(3), t: rnd(3) });
      return;
    }
  }
  spawnCrab() {
    const x = rnd(40, SEA_W - 40);
    this.crabs.push({ x, dir: Math.random() < 0.5 ? -1 : 1, t: rnd(5), turn: rnd(2, 6), snap: 0 });
  }
  maintain() {
    const pop = POP[this.stage];
    const count = {};
    for (const f of this.fish) count[f.kind] = (count[f.kind] || 0) + 1;
    for (const f of this.foods) count[f.kind] = (count[f.kind] || 0) + 1;
    if (this.state === 'play') for (const k in SPECIES) if ((count[k] || 0) < pop[k]) this.spawnFish(k);
    for (const k in FOODS) if ((count[k] || 0) < pop[k]) this.spawnFood(k);
    if (this.jellies.length < pop.jelly) this.spawnJelly();
    if (this.crabs.length < pop.crab) this.spawnCrab();
  }

  /* ---------------------------------------------------------- update */
  update(dt, active) {
    if (this.pause.open) { if (active) this.pause.update(dt); return; }
    if (active && (hit('pause') || touchPauseHit(W - 17, 23)) && this.state !== 'dead') { this.pause.toggle(); return; }
    this.t += dt;
    GS.stats.time += dt;
    const p = this.p;
    if (this.state === 'play' || this.state === 'net') this.updatePlayer(dt, active);
    if (this.state === 'dead') {
      this.deadT += dt;
      if (this.deadT > 1.2 && active && (hit('ok') || Input.mhit)) this.respawn();
    }
    if (this.state === 'net') this.updateNet(dt);
    this.updateFish(dt);
    this.updateFoods(dt);
    this.updateHazards(dt);
    // camera
    const tx = p.x - W / 2 + p.facing * 18, ty = p.y - H / 2 + 6;
    const k = 1 - Math.pow(0.02, dt);
    this.cam.x = clamp(lerp(this.cam.x, tx, k), 0, SEA_W - W);
    this.cam.y = clamp(lerp(this.cam.y, ty, k), 0, SEA_H - H);
    // ambient bubbles
    for (const v of this.vents) {
      v.t -= dt;
      if (v.t <= 0) {
        v.t = rnd(0.2, 2.2);
        this.parts.add({ type: 'bubble', x: v.x, y: this.floorAt(v.x) - 2, vy: -rnd(12, 22), life: 14, size: rndi(1, 3), c: '#b4ecf7', minY: SEA_SURF + 2 });
      }
    }
    this.spawnT -= dt;
    if (this.spawnT <= 0) { this.spawnT = 0.8; this.maintain(); }
    this.saveT -= dt;
    if (this.saveT <= 0 && this.state === 'play') { this.saveT = 5; GS.sea.stage = this.stage; GS.sea.food = this.food; saveGame(); }
    if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }
    this.tooBigT -= dt;
    this.parts.update(dt);
    this.floaters.update(dt);
    this.updateTutorial(dt);
  }

  steerInput() {
    let ix = 0, iy = 0;
    if (held('left')) ix -= 1;
    if (held('right')) ix += 1;
    if (held('up')) iy -= 1;
    if (held('down')) iy += 1;
    if (Input.mdown) {
      for (const pt of Input.pointers.values()) {
        if (Input.touchSeen && dist(pt.x, pt.y, W - 22, H - 22) < 16) continue;
        const wx = pt.x + this.cam.x, wy = pt.y + this.cam.y;
        const dx = wx - this.p.x, dy = wy - this.p.y, d = Math.hypot(dx, dy);
        if (d > 3) { const s = Math.min(1, d / 24); ix = (dx / d) * s; iy = (dy / d) * s; }
        break;
      }
    }
    const len = Math.hypot(ix, iy);
    if (len > 1) { ix /= len; iy /= len; }
    return [ix, iy];
  }

  updatePlayer(dt, active) {
    const p = this.p, st = STAGES[this.stage];
    const caught = this.net && this.net.phase === 'caught';
    let [ix, iy] = active && !caught ? this.steerInput() : [0, 0];
    // dash
    p.dashCd -= dt;
    p.dashT -= dt;
    const dashTap = active && (hit('dash') || (Input.touchSeen && clicked(W - 38, H - 38, 32, 32)));
    if (dashTap && p.dashCd <= 0 && !caught) {
      let dx = ix, dy = iy;
      if (!dx && !dy) dx = p.facing;
      const d = Math.hypot(dx, dy);
      p.vx = (dx / d) * st.speed * 2.5;
      p.vy = (dy / d) * st.speed * 2.5;
      p.dashT = 0.24;
      p.dashCd = 1.1;
      Sound.sfx('dash');
      for (let i = 0; i < 6; i++) this.parts.add({ type: 'bubble', x: p.x - p.facing * st.r, y: p.y + rnd(-2, 2), vx: -p.vx * 0.2 + rnd(-10, 10), vy: rnd(-20, -5), life: 1.2, size: rndi(1, 2), c: '#d8f8ff', minY: SEA_SURF + 2 });
    }
    if (p.dashT <= 0) {
      const acc = ix || iy ? 260 : 90;
      p.vx = approach(p.vx, ix * st.speed, acc * dt);
      p.vy = approach(p.vy, iy * st.speed, acc * dt);
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    this.moved += Math.hypot(p.vx, p.vy) * dt;
    // bounds
    const top = SEA_SURF + 2 + st.r * 0.5;
    if (p.y < top) { p.y = top; p.vy = Math.max(0, p.vy); }
    let fl = this.floorAt(p.x) - st.r;
    if (p.y > fl) { p.y = fl; p.vy = Math.min(0, p.vy); }
    if (p.x < 8) { p.x = 8; p.vx = Math.max(0, p.vx); }
    if (p.x > SEA_W - 8) { p.x = SEA_W - 8; p.vx = Math.min(0, p.vx); }
    if (this.net) {
      const n = this.net;
      if (n.left && p.x < n.left.x + n.left.w + st.r) { p.x = n.left.x + n.left.w + st.r; p.vx = Math.max(0, p.vx); }
      if (n.right && p.x > n.right.x - st.r) { p.x = n.right.x - st.r; p.vx = Math.min(0, p.vx); }
      if (caught) { p.x = n.bag.x + Math.sin(this.t * 9) * 3; p.y = n.bag.y + 2; if (Math.floor(this.t * 5) % 2) p.facing = -p.facing; }
    }
    if (Math.abs(p.vx) > 5 && !caught) p.facing = p.vx > 0 ? 1 : -1;
    p.anim += dt * (3 + Math.hypot(p.vx, p.vy) / 8);
    p.inv = Math.max(0, p.inv - dt);
    p.flash = Math.max(0, p.flash - dt);
    // hunger
    if (this.state === 'play') {
      p.hunger = Math.max(0, p.hunger - dt / 100);
      if (p.hunger <= 0) {
        p.starveT += dt;
        if (p.starveT > 7) { p.starveT = 0; this.hurt(p.x, p.y, 'STARVED'); }
      } else p.starveT = 0;
    }
    // near the surface for too long? seagulls notice.
    if (p.y < SEA_SURF + 24) p.surfT += dt; else p.surfT = Math.max(0, p.surfT - dt * 2);
    // occasional bubble
    if (Math.random() < dt * 0.7) this.parts.add({ type: 'bubble', x: p.x + p.facing * st.r, y: p.y - 1, vy: -rnd(8, 14), life: 5, size: 1, c: '#d8f8ff', minY: SEA_SURF + 2 });
  }

  mouth() {
    const p = this.p, st = STAGES[this.stage];
    return [p.x + p.facing * st.r * 0.6, p.y];
  }

  updateFoods(dt) {
    const p = this.p, [mx, my] = this.mouth(), st = STAGES[this.stage];
    const canEat = this.state === 'play' || this.state === 'net' && this.net.phase !== 'caught';
    for (const f of this.foods) {
      f.t += dt;
      if (f.kind === 'plankton') {
        f.x += Math.sin(f.t * 0.5 + f.ph) * 3 * dt;
        f.y += Math.cos(f.t * 0.7 + f.ph) * 2 * dt;
      } else if (f.kind === 'larva') {
        f.x += Math.sin(f.t * 0.8 + f.ph) * 5 * dt;
        f.y += Math.sin(f.t * 2.3 + f.ph) * 3 * dt;
      } else if (f.kind === 'krill') {
        const d = dist(f.x, f.y, p.x, p.y);
        f.hop -= dt;
        if (d < 34 && f.hop <= 0 && this.stage >= 1) {
          f.hop = rnd(0.6, 1.1);
          f.vx = ((f.x - p.x) / d) * rnd(50, 75);
          f.vy = ((f.y - p.y) / d) * rnd(40, 60) - 10;
          if (Math.abs(f.vx) > 1) f.face = f.vx > 0 ? 1 : -1;
        } else if (f.hop <= 0) {
          f.hop = rnd(1.2, 2.5);
          f.vx = rnd(-18, 18);
          f.vy = rnd(-10, 10);
          if (Math.abs(f.vx) > 1) f.face = f.vx > 0 ? 1 : -1;
        }
        f.vx *= Math.pow(0.1, dt);
        f.vy *= Math.pow(0.1, dt);
        f.x = clamp(f.x + f.vx * dt, 10, SEA_W - 10);
        f.y = clamp(f.y + f.vy * dt, SEA_SURF + 10, this.floorAt(f.x) - 6);
      }
      if (!canEat || p.dead) continue;
      const info = FOODS[f.kind];
      if (dist(mx, my, f.x, f.y) < st.r + info.r + 1 || dist(p.x, p.y, f.x, f.y) < st.r + info.r - 1) {
        if (this.stage >= info.min) {
          f.eaten = true;
          this.eat(info.value, f.x, f.y);
        } else if (this.tooBigT <= 0) {
          this.tooBigT = 2.5;
          this.floaters.add('TOO BIG FOR YOU!', f.x, f.y - 8, '#fee761', { life: 1.4 });
          Sound.sfx('toobig');
        }
      }
    }
    this.foods = this.foods.filter(f => !f.eaten);
  }

  eat(value, x, y, big) {
    const p = this.p;
    this.food += value;
    GS.stats.eaten++;
    p.hunger = Math.min(1, p.hunger + value * 0.07 + 0.03);
    this.floaters.add('+' + value, x, y - 6, big ? '#fee761' : '#b4f08c');
    Sound.sfx(big ? 'eatbig' : 'eat');
    for (let i = 0; i < (big ? 8 : 4); i++) this.parts.add({ type: 'spark', x, y, vx: rnd(-30, 30), vy: rnd(-30, 30), drag: 3, life: rnd(0.3, 0.6), c: big ? '#fee761' : '#b4f08c' });
    if (this.state !== 'play') return;
    if (this.food >= STAGES[this.stage].goal) {
      if (this.stage < STAGES.length - 1) this.grow();
      else this.startNet();
    }
  }

  grow() {
    this.stage++;
    this.food = 0;
    GS.sea.stage = this.stage;
    GS.sea.food = 0;
    saveGame();
    const st = STAGES[this.stage], p = this.p;
    p.hp = st.hp;
    p.inv = 1.5;
    p.hunger = 1;
    Sound.sfx('grow');
    const subs = [
      '',
      'NOW YOU CAN EAT {KRILL}, {WORMS} AND {MINNOWS}!',
      'EVEN {PERCH} ARE ON THE MENU NOW... BUT THE {SHARK} HAS NOTICED YOU.',
    ];
    this.banner = { title: 'YOU GREW!', sub: subs[this.stage], t: 4, style: 'gold' };
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      this.parts.add({ type: 'spark', x: p.x, y: p.y, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, drag: 2.5, life: 0.9, c: pick(['#fee761', '#feae34', '#ffffff']) });
    }
    // make sure a shark shows up for the big finale
    if (this.stage === 2) this.sharkWarned = false;
  }

  hurt(sx, sy, reason) {
    const p = this.p;
    if (p.inv > 0 || this.state !== 'play' || p.dead) return;
    p.hp--;
    p.inv = 1.6;
    p.flash = 0.15;
    const d = dist(p.x, p.y, sx, sy) || 1;
    p.vx += ((p.x - sx) / d) * 140;
    p.vy += ((p.y - sy) / d) * 140;
    p.dashT = 0.15;
    Game.shake(3, 0.3);
    Sound.sfx(reason === 'STARVED' ? 'hurt' : 'chomp');
    this.floaters.add(reason === 'STARVED' ? 'SO HUNGRY...' : 'OUCH!', p.x, p.y - 10, '#ff8f7a', { font: F5 });
    for (let i = 0; i < 8; i++) this.parts.add({ type: 'spark', x: p.x, y: p.y, vx: rnd(-50, 50), vy: rnd(-50, 50), drag: 3, life: 0.5, c: '#ffffff' });
    if (p.hp <= 0) this.die(reason);
  }

  die(reason) {
    const p = this.p;
    p.dead = true;
    this.state = 'dead';
    this.deadT = 0;
    this.deadReason = reason;
    GS.stats.deaths++;
    Sound.sfx('caught');
    this.parts.add({ type: 'bone', x: p.x, y: p.y, vy: -10, life: 99 });
  }

  respawn() {
    const p = this.p, st = STAGES[this.stage];
    p.dead = false;
    p.hp = st.hp;
    p.inv = 2.5;
    p.hunger = 0.85;
    p.vx = 0; p.vy = 0;
    p.y = Math.min(p.y, 200);
    this.food = Math.floor(this.food / 2);
    GS.sea.food = this.food;
    this.state = 'play';
    this.parts.list = this.parts.list.filter(q => q.type !== 'bone');
    for (const f of this.fish) if (SPECIES[f.kind].size > st.size && dist(f.x, f.y, p.x, p.y) < 150) { f.cool = 4; f.state = 'wander'; f.x += (f.x < p.x ? -120 : 120); f.x = clamp(f.x, 20, SEA_W - 20); }
    Sound.sfx('ok');
    saveGame();
  }

  updateFish(dt) {
    const p = this.p, st = STAGES[this.stage];
    const hunting = this.state === 'play' && !p.dead;
    for (const f of this.fish) {
      const sp = SPECIES[f.kind];
      f.anim += dt * (f.state === 'wander' ? 4 : 9);
      f.cool = Math.max(0, f.cool - dt);
      f.alert = Math.max(0, f.alert - dt);
      const dx = p.x - f.x, dy = p.y - f.y, d = Math.hypot(dx, dy) || 1;
      let tvx, tvy, spd = sp.speed * 0.38;
      const prey = sp.size < st.size, predator = sp.size > st.size;
      if (this.net && !prey) {
        // everything bigger swims away from the net
        tvx = f.x < p.x ? -1 : 1; tvy = 0.2; spd = sp.speed;
        f.state = 'wander';
      } else if (hunting && prey && d < sp.sight) {
        f.state = 'flee';
        spd = sp.speed * 1.05;
        tvx = -dx / d; tvy = -dy / d;
      } else if (hunting && predator && f.cool <= 0 && p.inv <= 0.6 && (d < sp.sight || (f.state === 'chase' && d < sp.sight * 1.7))) {
        if (f.state !== 'chase') {
          f.state = 'chase'; f.chaseT = 0; f.alert = 0.7;
          if (f.kind === 'shark') Sound.sfx('shark');
        }
        f.chaseT += dt;
        spd = sp.speed;
        tvx = (dx + p.vx * 0.25) / d; tvy = (dy + p.vy * 0.25) / d;
        if (f.chaseT > sp.chase) { f.state = 'wander'; f.cool = 2.5; this.pickTarget(f); }
      } else {
        if (f.state !== 'wander') { f.state = 'wander'; this.pickTarget(f); }
        const tdx = f.tx - f.x, tdy = f.ty - f.y, td = Math.hypot(tdx, tdy) || 1;
        if (td < 10) this.pickTarget(f);
        tvx = tdx / td; tvy = (tdy / td) * 0.7;
      }
      f.vx = approach(f.vx, tvx * spd, 100 * dt);
      f.vy = approach(f.vy, tvy * spd, 100 * dt);
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      const fl = this.floorAt(f.x) - sp.r - 3;
      if (f.y > fl) { f.y = fl; f.vy = Math.min(0, f.vy); }
      if (f.y < SEA_SURF + sp.r + 3) { f.y = SEA_SURF + sp.r + 3; f.vy = Math.max(0, f.vy); }
      if (f.x < 10 || f.x > SEA_W - 10) { f.x = clamp(f.x, 10, SEA_W - 10); this.pickTarget(f); }
      if (Math.abs(f.vx) > 4) f.facing = f.vx > 0 ? 1 : -1;
      // interactions with the player
      if (!hunting && !(this.state === 'net' && prey)) continue;
      if (p.dead) continue;
      if (prey) {
        const [mx, my] = this.mouth();
        if (dist(mx, my, f.x, f.y) < st.r + sp.r * 0.8) { f.eaten = true; this.eat(sp.food, f.x, f.y, true); }
      } else if (predator && f.cool <= 0) {
        const s = SPR[sp.spr];
        const hx = f.x + f.facing * (s.w / 2 - 4), hy = f.y + 1;
        if (dist(hx, hy, p.x, p.y) < st.r + sp.r * 0.6) {
          this.hurt(hx, hy, 'EATEN');
          f.cool = 3.5;
          f.state = 'wander';
          this.pickTarget(f);
        }
      }
    }
    this.fish = this.fish.filter(f => !f.eaten);
    // the shark announces itself once
    if (this.stage === 2 && !this.sharkWarned) {
      const sh = this.fish.find(f => f.kind === 'shark' && this.onScreen(f.x, f.y, -10));
      if (sh) { this.sharkWarned = true; Sound.sfx('sting'); this.floaters.add('A SHARK!!', sh.x, sh.y - 16, '#ff8f7a', { font: F5, life: 2 }); }
    }
  }

  updateHazards(dt) {
    const p = this.p, st = STAGES[this.stage];
    const live = this.state === 'play' && !p.dead;
    // jellyfish: pulse up, drift down
    for (const j of this.jellies) {
      j.t += dt;
      const cyc = (j.t + j.ph) % 2.4;
      j.vy = cyc < 0.35 ? -20 : approach(j.vy, 6, 20 * dt);
      j.y += j.vy * dt;
      j.x += Math.sin(j.t * 0.3 + j.ph) * 4 * dt;
      j.y = clamp(j.y, SEA_SURF + 30, this.floorAt(j.x) - 26);
      if (live && Math.abs(p.x - j.x) < 5 + st.r * 0.7 && p.y > j.y - 4 - st.r * 0.6 && p.y < j.y + 13 + st.r * 0.4) {
        if (p.inv <= 0) { Sound.sfx('zap'); this.floaters.add('ZAP!', j.x, j.y - 8, '#fee761', { font: F5 }); }
        this.hurt(j.x, j.y + 4, 'STUNG');
      }
    }
    // crabs scuttle along the sea floor
    for (const c of this.crabs) {
      c.t += dt;
      c.turn -= dt;
      if (c.turn <= 0) { c.turn = rnd(2, 6); c.dir = Math.random() < 0.5 ? -1 : 1; }
      c.x += c.dir * 9 * dt;
      if (c.x < 20 || c.x > SEA_W - 20) c.dir *= -1;
      c.x = clamp(c.x, 20, SEA_W - 20);
      c.snap = Math.max(0, c.snap - dt);
      const cy = this.floorAt(c.x) - 4;
      if (live && dist(p.x, p.y, c.x, cy) < st.r + 6) {
        if (p.inv <= 0) { Sound.sfx('pinch'); c.snap = 0.4; this.floaters.add('PINCH!', c.x, cy - 8, '#fee761', { font: F5 }); }
        this.hurt(c.x, cy + 3, 'PINCHED');
      }
    }
    // eels lunge out of their holes
    for (const e of this.eels) {
      e.cd -= dt;
      const dx = p.x - e.hx, dy = p.y - e.hy;
      if (e.state === 'hide') {
        if (live && e.cd <= 0 && Math.abs(dx) < 46 && Math.abs(dy) < 26 && Math.sign(dx) === e.dir) { e.state = 'out'; e.t = 0; Sound.sfx('hiss'); }
      } else if (e.state === 'out') {
        e.t += dt;
        e.ext = Math.min(1, e.ext + dt / 0.2);
        if (e.t > 0.9) e.state = 'back';
      } else {
        e.ext = Math.max(0, e.ext - dt / 0.6);
        if (e.ext <= 0) { e.state = 'hide'; e.cd = 2.2; }
      }
      if (live && e.ext > 0.3) {
        const [hx, hy] = this.eelHead(e);
        if (dist(hx, hy, p.x, p.y) < st.r + 4) this.hurt(hx, hy, 'BITTEN');
      }
    }
    // clams slowly open and close; grab the pearl while they are open
    const pearls = GS.sea.pearls || (GS.sea.pearls = []);
    for (const c of this.clams) {
      c.t += dt;
      const ph = c.t % 4.6;
      c.open = ph < 2.8 ? 0 : ph < 3.1 ? (ph - 2.8) / 0.3 : ph < 4.3 ? 1 : (4.6 - ph) / 0.3;
      if (!live || c.open < 0.6 || pearls.includes(c.i)) continue;
      const [mx, my] = this.mouth();
      if (dist(mx, my, c.x, this.floorAt(c.x) - 3) < st.r + 7) {
        pearls.push(c.i);
        p.hp = st.hp;
        Sound.sfx('gold');
        this.floaters.add('PEARL ' + pearls.length + '/6!', c.x, this.floorAt(c.x) - 16, '#ffffff', { font: F5, life: 1.8 });
        for (let k = 0; k < 20; k++) this.parts.add({ type: 'spark', x: c.x, y: this.floorAt(c.x) - 4, vx: rnd(-50, 50), vy: rnd(-70, 10), drag: 2, life: rnd(0.5, 1), c: pick(['#ffffff', '#fee761', '#c8f4ff']) });
        if (pearls.length === 6) this.banner = { title: 'PEARL MASTER!', sub: 'ALL 6 PEARLS! YOU WILL START YOUR BOWL LIFE {EXTRA SMART}.', t: 4, style: 'aqua' };
        this.eat(3, c.x, this.floorAt(c.x) - 6, true);
        saveGame();
      }
    }
    // seagulls dive when you hang around the surface
    const g = this.gull;
    g.cd -= dt;
    if (g.state === 'none') {
      if (live && g.cd <= 0 && p.surfT > 1.3) { g.state = 'circle'; g.t = 0; g.x = p.x - 60; g.y = SEA_SURF - 34; Sound.sfx('gull'); }
    } else if (g.state === 'circle') {
      g.t += dt;
      g.x = approach(g.x, p.x, 90 * dt);
      g.y = SEA_SURF - 34 + Math.sin(g.t * 5) * 2;
      if (g.t > 1.1) { g.state = 'dive'; g.t = 0; g.bx = g.x; }
    } else if (g.state === 'dive') {
      g.t += dt;
      const prevY = g.y;
      g.y += 190 * dt;
      g.x = g.bx;
      if (prevY < SEA_SURF && g.y >= SEA_SURF) this.splash(g.x);
      if (live && dist(g.x, g.y + 4, p.x, p.y) < st.r + 4) this.hurt(g.x, g.y, 'SNATCHED');
      if (g.y > SEA_SURF + 34) { g.state = 'up'; g.t = 0; }
    } else if (g.state === 'up') {
      g.t += dt;
      const prevY = g.y;
      g.y -= 120 * dt;
      g.x += 40 * dt;
      if (prevY >= SEA_SURF && g.y < SEA_SURF) this.splash(g.x);
      if (g.y < SEA_SURF - 60) { g.state = 'none'; g.cd = 7; p.surfT = 0; }
    }
  }

  eelHead(e) {
    return [e.hx + e.dir * e.ext * 34, e.hy - 2 + Math.sin(this.t * 10) * e.ext * 2];
  }

  splash(x) {
    Sound.sfx('splash');
    for (let i = 0; i < 16; i++) this.parts.add({ x: x + rnd(-6, 6), y: SEA_SURF - 1, vx: rnd(-40, 40), vy: -rnd(40, 100), g: 300, life: rnd(0.4, 0.9), c: pick(['#ffffff', '#c8f4ff', '#9fe8f5']) });
    for (let i = 0; i < 8; i++) this.parts.add({ type: 'bubble', x: x + rnd(-6, 6), y: SEA_SURF + rnd(3, 16), vy: -rnd(5, 12), life: 1.5, size: rndi(1, 3), c: '#e8fbff', minY: SEA_SURF + 1 });
  }

  updateTutorial(dt) {
    if (this.tut < 0) return;
    this.tutT += dt;
    if (this.tut === 0 && this.moved > 60) { this.tut = 1; this.tutT = 0; }
    else if (this.tut === 1 && this.food >= 3) { this.tut = 2; this.tutT = 0; }
    else if (this.tut === 2 && this.tutT > 6) { this.tut = 3; this.tutT = 0; }
    else if (this.tut === 3 && this.tutT > 6) { this.tut = -1; }
  }

  /* ------------------------------------------------------ net finale */
  startNet() {
    this.state = 'net';
    const p = this.p;
    this.net = { t: 0, phase: 'calm', boatX: p.x + 300, left: null, right: null, bag: null, ct: 0 };
    GS.sea.food = this.food;
    Sound.play(null);
    Sound.sfx('grow');
    this.banner = { title: 'BIGGEST FISH!', sub: 'YOU ARE THE BIGGEST FISH AROUND. NOTHING CAN STOP YOU NOW!', t: 3.4, style: 'gold' };
  }

  updateNet(dt) {
    const n = this.net, p = this.p;
    n.t += dt;
    n.boatX = approach(n.boatX, p.x + 20, 45 * dt);
    if (n.phase === 'calm' && n.t > 3.4) {
      n.phase = 'shadow';
      this.banner = { title: '...', sub: 'WAIT. WHAT IS THAT SHADOW UP THERE?', t: 2.6, style: 'silver' };
      Sound.sfx('rumble');
    }
    if (n.phase === 'shadow' && n.t > 5.6) {
      n.phase = 'nets';
      n.left = { x: clamp(p.x - 110, 10, SEA_W - 260), w: 36, drop: 0 };
      this.banner = { title: 'A NET!!', sub: 'SWIM FOR YOUR LIFE!', t: 2.6, style: 'red' };
      Sound.play('danger');
      Sound.sfx('splash');
      Game.shake(2, 0.4);
    }
    if (n.phase === 'nets' && n.t > 6.9 && !n.right) {
      n.right = { x: clamp(p.x + 100, n.left.x + n.left.w + 70, SEA_W - 40), w: 36, drop: 0 };
      Sound.sfx('splash');
      Game.shake(2, 0.4);
      this.floaters.add('ANOTHER ONE!', n.right.x, p.y - 20, '#ff8f7a', { font: F5, life: 1.5 });
    }
    for (const net of [n.left, n.right]) if (net) net.drop = Math.min(1, net.drop + dt / 1.1);
    if (n.phase === 'nets' && n.right && n.t > 8.2) {
      const sp = 12 + (n.t - 8.2) * 7;
      n.left.x += sp * dt;
      n.right.x -= sp * dt;
      if (n.right.x - (n.left.x + n.left.w) < STAGES[this.stage].r * 2 + 16) {
        n.phase = 'caught';
        n.ct = 0;
        n.bag = { x: (n.left.x + n.left.w + n.right.x) / 2, y: p.y };
        n.boatX = n.bag.x + 24;
        this.banner = { title: 'CAUGHT!', sub: '', t: 3, style: 'red', y: 120 };
        Sound.play(null);
        Sound.sfx('caught');
        Game.shake(4, 0.5);
        n.extra = [0, 1, 2].map(i => ({ kind: pick(['minnow', 'guppy', 'minnow']), ox: rnd(-12, 12), oy: rnd(-6, 8), f: i }));
      }
    }
    if (n.phase === 'caught') {
      n.ct += dt;
      if (n.ct > 1.2) n.bag.y = Math.max(SEA_SURF - 40, n.bag.y - (30 + n.ct * 25) * dt);
      if (n.ct > 1.2 && n.bag.y < SEA_SURF + 4 && !n.splashed) { n.splashed = true; this.splash(n.bag.x); }
      if (n.ct > 2.2 && n.bag.y <= SEA_SURF - 38 && !n.done) {
        n.done = true;
        GS.chapter = 'caught';
        GS.sea.stage = this.stage;
        saveGame();
        Game.go(() => new StoryScene('caught'), { color: '#ffffff', speed: 1.2 });
      }
    }
  }

  /* ------------------------------------------------------------- draw */
  draw() {
    const [sx, sy] = Game.shakeOffset();
    const cx = Math.round(this.cam.x) + sx, cy = Math.round(this.cam.y) + sy;
    const t = this.t;
    // water + sky
    gfx.drawImage(this.waterBg, 0, clamp(cy, 0, SEA_H - H), W, H, 0, clamp(cy, 0, SEA_H - H) - cy, W, H);
    if (cy < SEA_SURF) {
      blit(this.skyBg, 0, -cy);
      const sunX = Math.round(250 - cx * 0.04);
      disc(sunX, 14 - cy, 8, '#fff6c9');
      disc(sunX, 14 - cy, 6, '#ffffff');
      for (let i = 0; i < 6; i++) {
        const clx = ((i * 173 - cx * 0.25 + t * 3) % (W + 80) + W + 80) % (W + 80) - 40;
        this.cloud(clx, 8 + (i % 3) * 9 - cy, 24 + (i % 2) * 14);
      }
    }
    // parallax reefs
    gfx.globalAlpha = 0.28;
    blit(this.far, -Math.round(cx * 0.3), -Math.round(cy * 0.3));
    gfx.globalAlpha = 0.38;
    blit(this.mid, -Math.round(cx * 0.55), -Math.round(cy * 0.55));
    gfx.globalAlpha = 1;
    // sun rays (baked once, drawn as single blits)
    for (const r of this.rays) {
      const x = Math.round(r.x - r.img.anchor - cx + Math.sin(t * 0.5 + r.x) * 2);
      if (x > W || x + r.img.width < 0 || SEA_SURF - cy > H) continue;
      gfx.drawImage(r.img, x, SEA_SURF - cy);
    }
    // kelp
    for (const k of this.kelp) {
      if (k.x - cx < -20 || k.x - cx > W + 20) continue;
      drawKelp(k.x - cx, Math.round(this.floorAt(k.x)) - cy + 2, k.h, t, k.ph, '#1f5c4a', '#2e7d5c');
    }
    // terrain
    gfx.drawImage(this.terrain, cx < 0 ? 0 : cx, 0, W, SEA_H - TERR_Y, cx < 0 ? -cx : 0, TERR_Y - cy, W, SEA_H - TERR_Y);
    // pearl clams
    for (const c of this.clams) {
      const x = c.x - cx, y = Math.round(this.floorAt(c.x)) - cy - 2;
      if (x < -14 || x > W + 14 || y < -10 || y > H + 10) continue;
      const lift = Math.round(c.open * 5), has = !(GS.sea.pearls || []).includes(c.i);
      ellipse(x, y + 2, 9, 3, '#4a3a5a');
      rect(x - 9, y + 1, 19, 2, '#8a7a9a');
      if (c.open > 0.2) { rect(x - 7, y - 1, 15, 2, '#f6a0c8'); if (has) { disc(x, y - 1, 2, '#ffffff'); px(x - 1, y - 2, '#c8f4ff'); if (Math.floor(this.t * 6) % 3 === 0) px(x + 3, y - 4, '#ffffff'); } }
      rect(x - 9, y - lift, 19, 2, '#a898b8');
      rect(x - 8, y - 1 - lift, 17, 1, '#c8b8d8');
      for (let i = -7; i <= 7; i += 2) px(x + i, y - lift, '#7a6a8a');
    }
    // eels (behind other creatures)
    for (const e of this.eels) this.drawEel(e, cx, cy);
    // food
    for (const f of this.foods) this.drawFood(f, cx, cy);
    // crabs
    for (const c of this.crabs) {
      const x = Math.round(c.x) - cx, y = Math.round(this.floorAt(c.x)) - cy;
      if (x < -12 || x > W + 12 || y < -10 || y > H + 10) continue;
      spr('crab', c.snap > 0 ? 1 : Math.floor(c.t * 6) % 2, x - 5, y - 8, c.dir < 0);
    }
    // fish
    for (const f of this.fish) {
      const sp = SPECIES[f.kind], s = SPR[sp.spr];
      const x = Math.round(f.x) - cx, y = Math.round(f.y) - cy;
      if (x < -s.w || x > W + s.w || y < -s.h || y > H + s.h) continue;
      sprC(sp.spr, Math.floor(f.anim) % 2, x, y, f.facing < 0);
      if (f.state === 'chase' && (f.alert > 0 || Math.floor(t * 4) % 2)) text('!', x, y - s.h / 2 - 9, '#ff5a5a', { align: 'center', outline: '#2a0a14' });
    }
    // jellyfish
    for (const j of this.jellies) this.drawJelly(j, cx, cy);
    // the player
    this.drawPlayer(cx, cy);
    // seagull
    this.drawGull(cx, cy);
    // nets & boat
    if (this.net) this.drawNetEvent(cx, cy);
    // foreground grass
    for (const gr of this.fgGrass) {
      const x = gr.x - cx, base = Math.round(this.floorAt(gr.x)) - cy + 3;
      if (x < -6 || x > W + 6 || base < 0 || base > H + 12) continue;
      for (let j = 0; j < 3; j++) {
        const sway = Math.round(Math.sin(t * 1.5 + gr.ph + j) * 1.5);
        line(x + j * 2, base, x + j * 2 + sway, base - gr.h + (j === 1 ? -2 : 0), j === 1 ? '#3f8a58' : '#2f6a48');
      }
    }
    // surface line
    const wy = SEA_SURF - cy;
    if (wy > -4 && wy < H + 2) drawWaves(this.waves, cx, wy, t);
    this.parts.draw(cx, cy);
    this.floaters.draw(cx, cy);
    this.drawOffscreenArrows(cx, cy);
    this.drawHUD();
    if (this.state === 'dead') this.drawDead();
    if (this.pause.open) this.pause.draw();
  }

  cloud(x, y, w) {
    x = Math.round(x); y = Math.round(y);
    disc(x + w * 0.3, y + 2, 3, '#ffffff');
    disc(x + w * 0.55, y + 1, 4, '#ffffff');
    rect(x, y + 3, w, 3, '#ffffff');
    rect(x + 1, y + 6, w - 2, 1, '#d4ecf8');
  }

  drawFood(f, cx, cy) {
    const x = Math.round(f.x) - cx, y = Math.round(f.y) - cy;
    if (x < -6 || x > W + 6 || y < -6 || y > H + 6) return;
    const edible = this.stage >= FOODS[f.kind].min;
    switch (f.kind) {
      case 'plankton': {
        const tw = Math.sin(f.t * 4 + f.ph) > 0.3;
        const halo = tw ? '#8fdc6a' : '#4fa050';
        px(x - 1, y, halo); px(x + 1, y, halo); px(x, y - 1, halo); px(x, y + 1, halo);
        px(x, y, tw ? '#f4ffe0' : '#c8f4a0');
        break;
      }
      case 'larva': {
        const w = Math.floor(f.t * 6 + f.ph) % 2;
        px(x - 1, y + w, '#d8d0b0'); px(x, y, '#d8d0b0'); px(x + 1, y + 1 - w, '#d8d0b0'); px(x + 2, y, '#6a5a4a');
        break;
      }
      case 'egg':
        for (const [ox, oy] of [[0, 0], [2, 0], [1, -2], [-2, -1], [3, -2]]) { disc(x + ox, y + oy, 1, '#fee761'); px(x + ox, y + oy, '#f77622'); }
        break;
      case 'krill':
        spr('krill', Math.floor(f.t * 6) % 2, x - 3, y - 1, (f.face || 1) < 0);
        break;
      case 'worm':
        for (let i = 0; i < 6; i++) px(x - 3 + i, y - 1 - Math.round(Math.max(0, Math.sin(f.t * 5 + i * 0.9)) * 2) - (i > 3 ? 1 : 0), i === 5 ? '#b55088' : '#f6757a');
        break;
    }
    if (!edible && Math.floor(this.t * 2) % 4 === 0) px(x, y - 5, '#8b9bb4');
  }

  drawJelly(j, cx, cy) {
    const x = Math.round(j.x) - cx, y = Math.round(j.y) - cy;
    if (x < -10 || x > W + 10 || y < -10 || y > H + 20) return;
    const pulse = ((j.t + j.ph) % 2.4) < 0.35 ? 1 : 0;
    gfx.globalAlpha = 0.85;
    rect(x - 4 + pulse, y - 3, 9 - pulse * 2, 1, '#f6a0c8');
    rect(x - 5 + pulse, y - 2, 11 - pulse * 2, 4, '#d77aa8');
    rect(x - 4 + pulse, y - 2, 3, 1, '#ffd0e4');
    rect(x - 5 + pulse, y + 2, 11 - pulse * 2, 1, '#b55088');
    for (let i = 0; i < 4; i++) {
      for (let k = 0; k < 9; k++) px(x - 3 + i * 2 + Math.round(Math.sin(j.t * 4 + k * 0.7 + i) * 0.9), y + 3 + k, k < 3 ? '#d77aa8' : '#f6a0c8');
    }
    gfx.globalAlpha = 1;
    px(x - 2, y - 1, '#ffffff');
  }

  drawEel(e, cx, cy) {
    const hx0 = e.hx - cx, hy0 = e.hy - cy;
    if (hx0 < -50 || hx0 > W + 50 || hy0 < -20 || hy0 > H + 20) return;
    if (e.ext <= 0.02) {
      if (Math.floor(this.t * 1.5 + e.hx) % 5 !== 0) { px(hx0 - 1, hy0, '#fee761'); px(hx0 + 1, hy0, '#fee761'); }
      return;
    }
    const [hx, hy] = this.eelHead(e);
    const n = 12;
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const bx = lerp(e.hx, hx, k) - cx, by = lerp(e.hy, hy, k) + Math.sin(this.t * 12 - k * 6) * 2 * k * e.ext - cy;
      disc(bx, by, 2, '#2f6a3a');
      px(bx, by + 1, '#c8c040');
    }
    const x = Math.round(hx) - cx, y = Math.round(hy) - cy;
    disc(x, y, 3, '#3e8948');
    rect(x + e.dir * 2, y + 1, 3 * 1, 1, '#181425');
    px(x + e.dir * 3, y + 2, '#ffffff');
    px(x + e.dir * 1, y - 2, '#fee761');
    px(x + e.dir * 1, y - 1, '#181425');
  }

  drawPlayer(cx, cy) {
    const p = this.p, st = STAGES[this.stage];
    if (p.dead) return;
    if (p.inv > 0 && Math.floor(p.inv * 12) % 2 === 0 && !this.net) return;
    const x = Math.round(p.x) - cx, y = Math.round(p.y) - cy + (Math.sin(p.anim * 0.7) > 0.6 ? 1 : 0);
    sprC(st.spr, Math.floor(p.anim) % 2, x, y, p.facing < 0, p.flash > 0);
  }

  drawGull(cx, cy) {
    const g = this.gull;
    if (g.state === 'none') return;
    const x = Math.round(g.x) - cx, y = Math.round(g.y) - cy;
    if (g.state === 'circle') {
      spr('gull', Math.floor(this.t * 6) % 2, x - 5, y - 2);
      if (Math.floor(this.t * 6) % 2) text('!', x, SEA_SURF - cy + 4, '#ff5a5a', { align: 'center', outline: '#2a0a14' });
    } else if (g.state === 'dive') spr('gullDive', 0, x - 2, y - 4);
    else spr('gull', Math.floor(this.t * 8) % 2, x - 5, y - 2, true);
  }

  drawNetEvent(cx, cy) {
    const n = this.net, t = this.t;
    // the boat's shadow falls on the water
    if (n.phase !== 'calm') {
      for (let y = 0; y < 70; y += 2) {
        const k = y / 70, hw = Math.round(36 * (1 - k * 0.6));
        gfx.globalAlpha = Math.round(0.22 * (1 - k) * 32) / 32;
        rect(n.boatX - hw - cx, SEA_SURF + 2 + y - cy, hw * 2, 2, '#0a1a2a');
      }
      gfx.globalAlpha = 1;
    }
    drawBoat(n.boatX - cx, SEA_SURF - cy, t);
    for (const net of [n.left, n.right]) {
      if (!net || n.phase === 'caught') continue;
      const bottom = lerp(SEA_SURF, this.floorAt(net.x + net.w / 2) + 4, easeOut(net.drop));
      drawNet(net.x - cx, SEA_SURF - cy, bottom - cy, net.w);
      line(net.x + net.w / 2 - cx, SEA_SURF - cy, n.boatX - 24 - cx, SEA_SURF - 26 - cy, '#c8b898');
    }
    if (n.phase === 'caught') {
      const b = n.bag, bx = Math.round(b.x) - cx, by = Math.round(b.y) - cy;
      for (const e of n.extra) sprC(SPECIES[e.kind].spr, Math.floor(t * 8 + e.f) % 2, bx + e.ox + Math.sin(t * 9 + e.f) * 2, by + e.oy, Math.floor(t * 4 + e.f) % 2 === 0);
      line(bx, by - 16, n.boatX - 24 - cx, SEA_SURF - 26 - cy, '#c8b898');
      for (let y = -16; y <= 14; y++) {
        for (let x = -22; x <= 22; x++) {
          const q = (x * x) / (22 * 22) + (y * y) / (16 * 16);
          if (q > 1) continue;
          if (q > 0.86 || (x + y + 60) % 5 === 0 || (x - y + 60) % 5 === 0) px(bx + x, by + y, '#e8dcc0');
        }
      }
    }
  }

  drawOffscreenArrows(cx, cy) {
    if (this.state !== 'play') return;
    for (const f of this.fish) {
      if (f.state !== 'chase') continue;
      const x = f.x - cx, y = f.y - cy;
      if (x >= 0 && x < W && y >= 0 && y < H) continue;
      const ax = clamp(x, 6, W - 7), ay = clamp(y, 20, H - 7);
      const c = Math.floor(this.t * 6) % 2 ? '#ff5a5a' : '#fee761';
      if (x < 0) { px(ax - 2, ay, c); rect(ax - 1, ay - 1, 1, 3, c); rect(ax, ay - 2, 1, 5, c); }
      else if (x >= W) { px(ax + 2, ay, c); rect(ax + 1, ay - 1, 1, 3, c); rect(ax, ay - 2, 1, 5, c); }
      else if (y < 0) { px(ax, ay - 2, c); rect(ax - 1, ay - 1, 3, 1, c); rect(ax - 2, ay, 5, 1, c); }
      else { px(ax, ay + 2, c); rect(ax - 1, ay + 1, 3, 1, c); rect(ax - 2, ay, 5, 1, c); }
    }
  }

  drawHUD() {
    const p = this.p, st = STAGES[this.stage];
    // backing strip
    gfx.globalAlpha = 0.5;
    rect(0, 0, W, 20, '#07060f');
    gfx.globalAlpha = 0.25;
    rect(0, 20, W, 1, '#07060f');
    gfx.globalAlpha = 1;
    // hearts
    for (let i = 0; i < st.hp; i++) spr(i < p.hp ? 'heart' : 'heartEmpty', 0, 4 + i * 8, 3);
    // hunger
    text('FOOD', 4, 13, '#ead4aa', { font: F3 });
    const hw = 30;
    rect(22, 13, hw + 2, 5, '#07060f');
    const hc = p.hunger > 0.5 ? '#63c74d' : p.hunger > 0.25 ? '#fee761' : '#e43b44';
    if (!(p.hunger < 0.2 && Math.floor(this.t * 4) % 2)) rect(23, 14, Math.round(hw * p.hunger), 3, hc);
    // pearls
    const pc = (GS.sea.pearls || []).length;
    disc(62, 15, 2, '#ffffff'); px(61, 14, '#c8f4ff');
    text(pc + '/6', 66, 13, pc === 6 ? '#fee761' : '#ead4aa', { font: F3 });
    // growth
    text(st.name, W / 2, 3, '#ffffff', { align: 'center', outline: '#07060f' });
    const gw = 80, gx = W / 2 - gw / 2;
    rect(gx - 1, 12, gw + 2, 6, '#07060f');
    rect(gx, 13, gw, 4, '#3a4466');
    const k = clamp(this.food / st.goal, 0, 1);
    rect(gx, 13, Math.round(gw * k), 4, '#f77622');
    rect(gx, 13, Math.round(gw * k), 1, '#feae34');
    text(this.stage < 2 ? 'GROW' : 'MAX', gx + gw + 4, 13, '#ead4aa', { font: F3 });
    // dash
    const ready = p.dashCd <= 0;
    spr('bolt', 0, W - 12, 4);
    if (!ready) ditherRect(W - 12, 4, 7, 7, '#07060f', 0.6);
    rect(W - 32, 7, 18, 3, '#07060f');
    rect(W - 31, 8, Math.round(16 * clamp(1 - p.dashCd / 1.1, 0, 1)), 1, ready ? '#fee761' : '#8b9bb4');
    text('DASH', W - 31, 13, ready ? '#fee761' : '#8b9bb4', { font: F3 });
    touchPauseButton(W - 17, 23);
    // touch dash button
    if (Input.touchSeen && this.state === 'play') {
      disc(W - 22, H - 22, 14, ready ? 'rgba(254,231,97,0.35)' : 'rgba(139,155,180,0.25)');
      ring(W - 22, H - 22, 14, ready ? '#fee761' : '#8b9bb4');
      text('DASH', W - 22, H - 25, '#ffffff', { font: F3, align: 'center' });
    }
    // banner
    if (this.banner) {
      const b = this.banner;
      const k2 = clamp((4 - b.t) * 4, 0, 1);
      const y = Math.round(lerp(-30, b.y || 42, easeOut(k2)));
      if (b.title !== '...') drawBig(b.title, W / 2, y, b.style || 'gold');
      if (b.sub) {
        const lines = wrap(b.sub, 240);
        let ly = y + 26;
        for (const l of lines) { text(l, W / 2, ly, '#ffffff', { align: 'center', outline: '#07060f', accent: '#fee761' }); ly += 10; }
      }
    }
    // tutorial
    if (this.tut >= 0 && this.state === 'play' && !this.banner) {
      const tips = [
        Input.touchSeen ? 'TOUCH AND HOLD TO SWIM' : 'SWIM WITH THE {ARROW KEYS} OR {WASD}',
        'EAT THE GLOWING GREEN {PLANKTON}',
        Input.touchSeen ? 'BIGGER FISH EAT YOU! TAP {DASH} TO ESCAPE' : 'BIGGER FISH EAT YOU! PRESS {SPACE} TO DASH',
        'FILL THE {GROW} BAR TO BECOME BIGGER',
      ];
      const tip = tips[this.tut];
      const w = textW(tip) + 12;
      panel(W / 2 - w / 2, H - 22, w, 16, { fill: '#141330', alpha: 0.85 });
      text(tip, W / 2, H - 17, '#ffffff', { align: 'center', accent: '#fee761' });
    }
  }

  drawDead() {
    gfx.globalAlpha = clamp(this.deadT * 0.8, 0, 0.5);
    rect(0, 0, W, H, '#2a0a14');
    gfx.globalAlpha = 1;
    if (this.deadT < 0.6) return;
    const msg = { EATEN: 'YOU GOT EATEN!', STARVED: 'YOU STARVED!', STUNG: 'ZAPPED BY A JELLYFISH!', PINCHED: 'PINCHED BY A CRAB!', BITTEN: 'BITTEN BY AN EEL!', SNATCHED: 'GRABBED BY A SEAGULL!' }[this.deadReason] || 'OH NO!';
    drawBig('OH NO!', W / 2, 50, 'red');
    text(msg, W / 2, 84, '#ffffff', { align: 'center', outline: '#07060f' });
    text('YOU LOSE HALF OF YOUR GROWTH.', W / 2, 98, '#c0cbdc', { align: 'center', outline: '#07060f' });
    if (this.deadT > 1.2 && Math.floor(this.t * 2) % 2 === 0) text(Input.touchSeen ? 'TAP TO TRY AGAIN' : 'PRESS ENTER TO TRY AGAIN', W / 2, 118, '#fee761', { align: 'center', outline: '#07060f' });
  }
}
