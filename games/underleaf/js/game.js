'use strict';
/* Underleaf: game loop, world streaming, colonies, weather, camera and rendering. */

const SAVE_KEY = 'underleaf-save-v2';
const XP_FOR = { spider: 30, crab: 40, frog: 40, lizard: 35, mouse: 35, scorpion: 30, centipede: 20, mantis: 20, beetle: 15, caterpillar: 8, worm: 8, grasshopper: 6, bee: 4 };
const BIG_PREDATORS = new Set(['spider', 'crab', 'frog', 'lizard', 'scorpion', 'centipede', 'mantis', 'mouse']);

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.isTouch = matchMedia('(pointer: coarse)').matches;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.nightC = document.createElement('canvas');
    this.nightCtx = this.nightC.getContext('2d');
    this.input = new Input(this);
    this.resize();
    addEventListener('resize', () => this.resize());
    addEventListener('wheel', (e) => {
      if (this.mode !== 'play' || this.view !== 'world') return;
      e.preventDefault();
      this.zoomMul = clamp(this.zoomMul * (1 - e.deltaY * 0.0012), 0.5, 1.8);
    }, { passive: false });
    this.canvas.addEventListener('pointermove', (e) => { if (this.view === 'nest') this.nestView.hover = this.nestView.hit(e.clientX, e.clientY); });
    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.view !== 'nest') return;
      const k = this.nestView.hit(e.clientX, e.clientY);
      if (k) { this.nestView.selected = k; this.ui.renderNestPanel(); }
    });
    addEventListener('visibilitychange', () => { if (document.hidden) this.save(); });
    addEventListener('pagehide', () => this.save());
    this.nestView = new NestView(this);
    this.raindrops = [];
    this.newGame('garden', (Math.random() * 1e9) | 0);
    this.ui = new UI(this);
    this.mode = 'title';
    this.paused = false;
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  resize() {
    this.vw = innerWidth; this.vh = innerHeight;
    this.canvas.width = Math.round(this.vw * this.dpr);
    this.canvas.height = Math.round(this.vh * this.dpr);
    this.canvas.style.width = this.vw + 'px';
    this.canvas.style.height = this.vh + 'px';
    this.baseZoom = clamp(Math.min(this.vw, this.vh) / 760, 0.7, 1.25);
    this.nightC.width = Math.ceil(this.vw / 2);
    this.nightC.height = Math.ceil(this.vh / 2);
  }

  /* ---------------------------------------------------------------- setup */

  newGame(species, seed) {
    this.species = species; this.seed = seed;
    this.world = new World(seed, species);
    this.world.bakeScale = Math.min(this.dpr, this.isTouch ? 1.5 : 2);
    this.ants = []; this.critters = []; this.foods = []; this.bigs = []; this.flyers = []; this.fireflies = [];
    this.fx = new FX();
    this.hash = new SpatialHash(64);
    this.foodHash = new SpatialHash(64);
    this.time = 0; this.dayT = 0.05; this.dayLen = 300;
    this.weather = { rain: false, k: 0, t: rand(140, 220) };
    this.weatherSlow = 1;
    this.colonies = new Map();
    this.home = new Colony(this, 'home', species, 0, 0, true);
    this.colonies.set('home', this.home);
    this.activeColonies = [this.home];
    this.destroyed = new Set();
    this.stats = { playerDelivered: 0, abilityUsed: false, rallied: false, bigDelivered: 0, dug: 0, peak: 0, biomes: new Set(['meadow']), bigKills: 0, nestsDown: 0, delivered: 0, lost: 0, sisters: 1 };
    this.counts = { home: 0, homeSoldiers: 0 };
    this.colCounts = new Map();
    this.level = 1; this.xp = 0;
    this.timers = { manage: 0, discover: 0, bird: rand(70, 120), save: 30, ladybug: 30 };
    this.discovered = new Set(['ant:' + species]);
    this.toldOnce = new Set();
    this.activePatches = [];
    this.followerCount = 0;
    this.rallyCd = 0; this.abilityCd = 0; this.respawnT = 0;
    this.over = false; this.scentView = false; this.guideOpen = false; this.view = 'world';
    this.zoomMul = 1;
    this.biomeHere = 'meadow';
    this.camera = { x: 0, y: 0, zoom: this.baseZoom };
    this.view4 = { x0: -800, y0: -600, x1: 800, y1: 600 };

    this.player = this.spawnAnt(this.home, 'worker', 40, 20);
    this.player.makePlayer(1);
    this.player.a = -0.6;
    const nW = { bullet: 7, fire: 22 }[species] ?? 14, nS = species === 'bullet' ? 2 : 3;
    for (let i = 0; i < nW; i++) this.spawnAnt(this.home, 'worker', rand(-90, 90), rand(-90, 90));
    for (let i = 0; i < nS; i++) this.spawnAnt(this.home, 'soldier', rand(-110, 110), rand(-110, 110));

    for (let i = 0; i < 4; i++) this.spawnFoodCluster(this.spotNear(0, 0, 160, 520));
    for (let i = 0; i < 5; i++) this.spawnFoodCluster(this.spotNear(0, 0, 500, 1300));
    let s = this.spotNear(0, 0, 260, 480);
    this.bigs.push(new BigFood(this, 'sugar', s.x, s.y));
    s = this.spotNear(0, 0, 700, 1100);
    this.bigs.push(new BigFood(this, 'apple', s.x, s.y));
    this.world.prebake(0, 0, 900);
    this.manageWorld(true);
  }

  spawnAnt(colony, role, x, y) {
    const a = new Ant(this, colony, x, y, role);
    this.world.collide(a);
    this.ants.push(a);
    return a;
  }

  hatchAnt(colony, role) {
    const n = colony.nest;
    const a = this.spawnAnt(colony, role, n.x + rand(-6, 6), n.y + rand(-6, 6));
    a.a = rand(TAU);
    if (colony.isPlayer) {
      this.fx.sparkle(n.x, n.y, '#fff3c4', 8);
      this.fx.text(n.x, n.y - 18, role === 'soldier' ? 'A soldier hatched' : 'A new sister hatched', '#fff3c4');
    }
    return a;
  }

  spotNear(cx, cy, minD, maxD) {
    for (let i = 0; i < 40; i++) {
      const a = rand(TAU), d = rand(minD, maxD);
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
      if (this.world.waterVal(x, y) < -0.3 && !this.world.blocker(x, y, 24, true) && dist2(x, y, 0, 0) > 110 * 110) return { x, y };
    }
    return null;
  }

  spawnAphid(p) {
    const a = rand(TAU), d = Math.sqrt(Math.random()) * p.r * 0.8;
    p.aphids.push(new Aphid(p, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d));
  }

  spawnFoodCluster(s, leafy = false) {
    if (!s) return;
    const r = Math.random();
    const kind = leafy ? 'leafbit' : r < 0.55 ? 'crumb' : r < 0.85 ? 'seed' : 'berry';
    const n = leafy ? randi(6, 12) : randi(5, 11);
    for (let i = 0; i < n; i++) {
      const x = s.x + rand(-34, 34), y = s.y + rand(-34, 34);
      if (this.world.blocker(x, y, 5, true) || this.world.waterAt(x, y)) continue;
      this.addFood(new Food(!leafy && Math.random() < 0.2 ? pick(['crumb', 'seed']) : kind, x, y));
    }
  }

  addFood(f) { f.taken = false; this.foods.push(f); }
  takeFood(f) { f.taken = true; }
  foodNear(x, y, r) {
    let found = false;
    this.foodHash.query(x, y, r, (f) => { if (!found && !f.taken && dist2(x, y, f.x, f.y) < r * r) found = true; });
    return found;
  }

  /* ------------------------------------------------------- streaming */

  activate(col) {
    col.active = true;
    for (const role of ['worker', 'soldier']) {
      for (let i = 0; i < col.pop[role]; i++) this.spawnAnt(col, role, col.x + rand(-100, 100), col.y + rand(-100, 100));
    }
  }

  deactivate(col) {
    col.active = false;
    col.pop = { worker: 0, soldier: 0 };
    for (const a of this.ants) {
      if (a.colony !== col || a.dead) continue;
      col.pop[a.role]++;
      a.leaveBig();
      a.dead = true;
    }
  }

  manageWorld(initial = false) {
    const w = this.world;
    const p = this.player && !this.player.dead ? this.player : this.home.nest;
    const px = p.x, py = p.y;
    const b = w.biome(px, py);
    this.biomeHere = b;
    if (b !== 'sea' && !this.stats.biomes.has(b)) {
      this.stats.biomes.add(b);
      if (this.mode === 'play') this.ui.toast(`You found a new place: ${BIOME_NAMES[b]}.`);
    }
    // rival colonies
    for (const f of w.featuresNear(px, py, 2600, 'nest')) {
      if (this.destroyed.has(f.id) || this.colonies.has(f.id)) continue;
      this.colonies.set(f.id, new Colony(this, f.id, f.species, f.x, f.y, false));
    }
    for (const col of this.colonies.values()) {
      if (col.isPlayer) continue;
      const d = dist(px, py, col.x, col.y);
      if (!col.active && !col.dead && d < 2300) this.activate(col);
      else if (col.active && d > 3000) this.deactivate(col);
    }
    this.activeColonies = [...this.colonies.values()].filter((c) => c.active && !c.dead);
    // aphid patches, antlion pits, spider burrows
    const pats = new Set([...w.featuresNear(px, py, 1800, 'patch'), ...w.featuresNear(0, 0, 1700, 'patch')]);
    for (const pt of pats) if (!pt.seeded) { pt.seeded = true; for (let i = 0; i < 8; i++) this.spawnAphid(pt); }
    this.activePatches = [...pats];
    w.activePits = [...new Set([...w.featuresNear(px, py, 1600, 'pit'), ...w.featuresNear(0, 0, 1600, 'pit')])];
    for (const l of w.featuresNear(px, py, 1800, 'lair')) {
      if ((!l.spider || l.spider.dead) && this.time > (l.respawnAt || 0)) {
        const s = new Spider(this, l.x, l.y);
        l.spider = s; s.lair = l;
        this.critters.push(s);
      }
    }
    // ground animals around the player
    let n = 0;
    for (const c of this.critters) if (!c.dead && dist2(c.x, c.y, px, py) < 1700 * 1700) n++;
    const want = 15 + (this.weather.rain ? 5 : 0);
    for (let k = 0; k < (initial ? 16 : 3) && n < want; k++) {
      const a = rand(TAU), d = initial ? rand(350, 1400) : rand(950, 1500);
      const x = px + Math.cos(a) * d, y = py + Math.sin(a) * d;
      if (w.waterAt(x, y) || dist2(x, y, 0, 0) < 300 * 300) continue;
      const bb = w.biome(x, y);
      if (bb === 'sea') continue;
      const kind = this.weather.rain && Math.random() < 0.4 ? 'worm' : weighted(Math.random, SPAWN_TABLE[bb]);
      if (kind === 'spider') continue;
      this.critters.push(new CRITTER_CLASSES[kind](this, x, y));
      n++;
    }
    for (const c of this.critters) {
      if (dist2(c.x, c.y, px, py) > 2700 * 2700 && dist2(c.x, c.y, 0, 0) > 1500 * 1500) c.dead = true;
    }
    // flying visitors
    let bf = 0, bees = 0, dfly = 0;
    for (const f of this.flyers) {
      if (dist2(f.x, f.y, px, py) > 2400 * 2400) { f.dead = true; continue; }
      if (f.kind === 'butterfly') bf++; else if (f.kind === 'dragonfly') dfly++;
    }
    for (const c of this.critters) if (c.kind === 'bee') bees++;
    const sx = () => px + rand(-900, 900), sy = () => py + rand(-700, 700);
    if (bf < 5 && b !== 'sea') this.flyers.push(new Butterfly(this, sx(), sy()));
    if (bees < 3 && (b === 'meadow' || b === 'marsh')) this.critters.push(new Bee(this, sx(), sy()));
    if (dfly < 2 && Math.random() < 0.3) {
      for (let i = 0; i < 6; i++) {
        const x = px + rand(-800, 800), y = py + rand(-800, 800);
        if (w.waterVal(x, y) > 0.3) { this.flyers.push(new Dragonfly(this, x, y)); break; }
      }
    }
    // food
    let nearP = 0, nearH = 0;
    for (const f of this.foods) {
      const dp = dist2(f.x, f.y, px, py), dh = dist2(f.x, f.y, 0, 0);
      if (dp < 1500 * 1500) nearP++;
      if (dh < 1500 * 1500) nearH++;
      if (dp > 2800 * 2800 && dh > 2000 * 2000) f.taken = true;
    }
    const leafy = () => this.species === 'leafcutter' && Math.random() < 0.55;
    if (nearP < 34) this.spawnFoodCluster(this.spotNear(px, py, 300, 1400), leafy());
    if (nearH < 34) this.spawnFoodCluster(this.spotNear(0, 0, 200, 1300), leafy());
    let sweets = 0;
    for (const bg of this.bigs) {
      if (dist2(bg.x, bg.y, px, py) > 3000 * 3000 && dist2(bg.x, bg.y, 0, 0) > 2000 * 2000 && !bg.carriers.length) bg.done = true;
      if (bg.kind === 'sugar' || bg.kind === 'apple') sweets++;
    }
    if (sweets < 3 && Math.random() < 0.03) {
      const s = this.spotNear(px, py, 400, 1300);
      if (s) this.bigs.push(new BigFood(this, Math.random() < 0.6 ? 'sugar' : 'apple', s.x, s.y));
    }
  }

  /* ----------------------------------------------------------- flow */

  start(species) {
    if (species) this.newGame(species, (Math.random() * 1e9) | 0);
    this.mode = 'play';
    this.ui.onStart();
    const p = this.player;
    this.camera.x = p.x; this.camera.y = p.y;
    if (species) {
      const sp = ANT_SPECIES[species];
      this.ui.toast(`You are a ${sp.name.toLowerCase()}. Find food and carry it home.`);
      if (sp.ability) setTimeout(() => this.ui.toast(`Special ability: ${sp.ability.name} (${this.isTouch ? 'the star button' : 'F'}). ${sp.ability.desc}`), 2500);
    }
    this.save();
  }

  continueGame(data) {
    this.newGame(data.species, data.seed);
    for (const a of this.ants) if (a.colony === this.home && !a.isPlayer) a.dead = true;
    this.ants = this.ants.filter((a) => !a.dead);
    const h = this.home;
    Object.assign(h.chambers, data.home.chambers);
    h.food = data.home.food; h.leaves = data.home.leaves || 0; h.brood = data.home.brood || [];
    h.outposts = data.home.outposts || []; h.autoHatch = data.home.autoHatch !== false;
    for (const role of ['worker', 'soldier']) {
      for (let i = 0; i < (data.pop[role] || 0); i++) this.spawnAnt(h, role, rand(-150, 150), rand(-150, 150));
    }
    this.time = data.time || 0; this.dayT = data.dayT || 0.1;
    this.level = data.level || 1; this.xp = data.xp || 0;
    Object.assign(this.stats, data.stats, { biomes: new Set(data.stats.biomes || ['meadow']) });
    this.discovered = new Set(data.discovered || []);
    this.toldOnce = new Set(data.told || []);
    this.destroyed = new Set(data.destroyed || []);
    const p = this.player;
    p.x = data.player.x; p.y = data.player.y;
    p.makePlayer(this.level);
    this.world.prebake(p.x, p.y, 800);
    this.manageWorld(true);
    this.start();
    this.ui.toast('Welcome back. Your colony kept working while you were away.');
  }

  save() {
    if (this.mode !== 'play' || this.over) return;
    const h = this.home, p = this.player;
    const pop = { worker: 0, soldier: 0 };
    for (const a of this.ants) if (a.colony === h && !a.isPlayer && !a.dead) pop[a.role]++;
    const data = {
      v: 2, seed: this.seed, species: this.species, time: this.time, dayT: this.dayT, level: this.level, xp: this.xp,
      stats: { ...this.stats, biomes: [...this.stats.biomes] },
      discovered: [...this.discovered], told: [...this.toldOnce], destroyed: [...this.destroyed],
      home: { food: h.food, leaves: h.leaves, chambers: h.chambers, brood: h.brood, outposts: h.outposts, autoHatch: h.autoHatch },
      pop, player: p && !p.dead ? { x: p.x, y: p.y } : { x: 30, y: 20 }, savedAt: Date.now(),
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* storage may be unavailable */ }
  }

  static loadSave() {
    try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; }
  }

  setPaused(on) {
    if (this.mode !== 'play' || this.over) return;
    this.paused = on;
    this.ui.el.pause.hidden = !on;
    if (on) this.save();
  }

  toggleScent() {
    this.scentView = !this.scentView;
    this.ui.el.scent.classList.toggle('on', this.scentView);
    this.world.pherImgAcc = 1;
  }

  onKey(code) {
    if (this.mode === 'title') return;
    if (this.view === 'nest') {
      if (code === 'KeyN' || code === 'Escape') this.exitNest();
      if (code === 'Digit1') this.layEgg('worker');
      if (code === 'Digit2') this.layEgg('soldier');
      return;
    }
    if (code === 'KeyG') { this.ui.toggleGuide(); return; }
    if (code === 'Escape' && this.guideOpen) { this.ui.toggleGuide(false); return; }
    if (code === 'KeyP' || code === 'Escape') { this.setPaused(!this.paused); return; }
    if (code === 'KeyT') this.toggleScent();
    if (code === 'Digit1') this.layEgg('worker');
    if (code === 'Digit2') this.layEgg('soldier');
    if (this.over && code === 'Enter') location.reload();
  }

  layEgg(role) {
    const why = this.home.layBlocker(role);
    if (why) { this.ui.toast(why); return; }
    this.home.lay(role);
    this.fx.text(0, -30, `The queen laid a ${role} egg`, '#fff3c4');
    if (this.view === 'nest') this.ui.renderNestPanel();
  }

  enterNest() {
    const p = this.player;
    if (!p || p.dead || p.trapped || p.big) return;
    if (dist2(p.x, p.y, 0, 0) > 160 * 160) { this.ui.toast('Walk back to your nest entrance to go inside.'); return; }
    if (p.carry) { this.deliver(this.home, p.carry, p); p.carry = null; }
    this.view = 'nest';
    p.inNest = true; p.x = 0; p.y = 0; p.followT = 0;
    this.ui.showNest(true);
    if (!this.toldOnce.has('nest')) {
      this.toldOnce.add('nest');
      this.ui.toast('Inside the nest. Tap a chamber to dig or enlarge it. The queen turns food into eggs.');
    }
  }

  exitNest() {
    const p = this.player;
    this.view = 'world';
    if (p) { p.inNest = false; p.x = 24; p.y = 18; p.a = 0.6; }
    this.ui.showNest(false);
    this.save();
  }

  frame(now) {
    const dt = Math.min(0.033, (now - this.last) / 1000);
    this.last = now;
    if (!this.paused && !this.guideOpen) this.update(dt);
    this.render();
    this.input.endFrame();
    requestAnimationFrame((t) => this.frame(t));
  }

  /* ---------------------------------------------------------- update */

  tickStatus(e, dt) {
    if (e.poisonT > 0) {
      e.poisonT -= dt;
      e.poisonAcc = (e.poisonAcc || 0) + dt * e.poisonDps;
      if (e.poisonAcc >= 2) {
        e.poisonAcc -= 2;
        const s = e.poisonSrc && !e.poisonSrc.dead ? e.poisonSrc : null;
        e.damage(2, s);
        if (Math.random() < 0.5) this.fx.sparkle(e.x, e.y, '#ffb050', 2);
      }
    }
    if (e.stunT > 0) { e.stunT -= dt; e.speedNow = 0; return true; }
    return false;
  }

  poison(o, src, dps, dur) {
    if (!o.damage || o.invuln) return;
    o.poisonT = dur; o.poisonDps = dps; o.poisonSrc = src;
  }

  update(dt) {
    this.time += dt;
    this.dayT = (this.dayT + dt / this.dayLen) % 1;
    this.rallyCd -= dt; this.abilityCd -= dt;
    this.updateWeather(dt);

    this.hash.clear();
    for (const a of this.ants) if (!a.dead && !a.inNest) this.hash.insert(a);
    for (const c of this.critters) if (!c.dead) this.hash.insert(c);
    for (const col of this.activeColonies) if (!col.isPlayer && !col.dead) this.hash.insert(col);
    this.foodHash.clear();
    for (const f of this.foods) if (!f.taken) this.foodHash.insert(f);

    if (this.mode === 'play') this.updatePlayer(dt);
    else this.attractCamera();

    for (const a of this.ants) { if (!a.dead && !this.tickStatus(a, dt)) a.update(dt); }
    for (const c of this.critters) { if (!c.dead && !this.tickStatus(c, dt)) c.update(dt); }
    for (const b of this.bigs) b.update(dt);
    for (const f of this.flyers) f.update(dt);
    for (const f of this.fireflies) f.update(dt);
    for (const col of this.colonies.values()) col.update(dt);
    this.updatePatches(dt);
    this.updatePits(dt);
    this.updateRaids(dt);
    this.updateEvents(dt);
    this.updateNight(dt);

    this.timers.manage -= dt;
    if (this.timers.manage <= 0) { this.timers.manage = 1; this.manageWorld(); }

    this.ants = this.ants.filter((a) => !a.dead);
    this.critters = this.critters.filter((c) => !c.dead);
    this.foods = this.foods.filter((f) => !f.taken);
    this.bigs = this.bigs.filter((b) => !b.done);
    this.flyers = this.flyers.filter((f) => !f.dead);
    this.fireflies = this.fireflies.filter((f) => !f.dead);

    let ch = 0, sh = 0, fol = 0;
    this.colCounts.clear();
    for (const a of this.ants) {
      this.colCounts.set(a.colony, (this.colCounts.get(a.colony) || 0) + 1);
      if (a.colony === this.home) { ch++; if (a.role === 'soldier') sh++; if (a.followT > 0) fol++; }
    }
    this.counts = { home: ch, homeSoldiers: sh };
    this.followerCount = fol;
    this.stats.peak = Math.max(this.stats.peak, ch);

    this.world.updatePher(dt, this.weather.rain, this.view4, this.scentView);
    this.fx.update(dt);
    if (this.mode === 'play') {
      this.timers.discover -= dt;
      if (this.timers.discover <= 0) { this.timers.discover = 0.4; this.checkDiscoveries(); }
      this.timers.save -= dt;
      if (this.timers.save <= 0) { this.timers.save = 30; this.save(); }
      this.followCamera(dt);
      if (this.view === 'nest') this.nestView.update(dt);
      this.ui.update(dt);
    }
  }

  countColony(col) { return this.colCounts.get(col) || 0; }

  updateWeather(dt) {
    const w = this.weather;
    w.t -= dt;
    if (w.t <= 0) {
      w.rain = !w.rain;
      w.t = w.rain ? rand(40, 70) : rand(170, 280);
      if (this.mode === 'play') this.ui.toast(w.rain ? 'Rain is falling. Scent trails wash away faster, and earthworms come up.' : 'The rain has stopped.');
    }
    w.k = clamp(w.k + (w.rain ? dt : -dt) * 0.25, 0, 1);
    this.weatherSlow = 1 - 0.12 * w.k;
    if (w.k > 0.02) {
      const want = Math.round(220 * w.k);
      while (this.raindrops.length < want) this.raindrops.push({ x: rand(-50, this.vw + 50), y: rand(-this.vh, 0), v: rand(700, 1000), l: rand(10, 22) });
      if (this.raindrops.length > want) this.raindrops.length = want;
      for (const d of this.raindrops) {
        d.y += d.v * dt; d.x -= d.v * dt * 0.15;
        if (d.y > this.vh) { d.y = rand(-80, 0); d.x = rand(-50, this.vw + 120); }
      }
      if (this.view === 'world') {
        const v = this.view4;
        for (let i = 0; i < 40 * w.k * dt * 10; i++) {
          if (Math.random() > dt * 10) continue;
          this.fx.ring(rand(v.x0, v.x1), rand(v.y0, v.y1), 6, 'rgba(225,238,250,', 0.35);
        }
      }
    } else this.raindrops.length = 0;
  }

  /* ---------------------------------------------------------- player */

  updatePlayer(dt) {
    const p = this.player, inp = this.input;
    if (!p || p.dead) {
      if (!this.over) { this.respawnT -= dt; if (this.respawnT <= 0) this.respawnPlayer(); }
      return;
    }
    const inf = this.home.chambers.infirmary;
    if (p.inNest) { p.hp = Math.min(p.maxHp, p.hp + dt * 10 * (1 + inf)); return; }
    p.lastTargetT -= dt;
    p.swimming = p.swims && this.world.waterAt(p.x, p.y);
    const m = inp.move, moving = m.x !== 0 || m.y !== 0;
    const dn = dist(p.x, p.y, 0, 0);
    const nearOutpost = this.home.outposts.some((o) => dist2(p.x, p.y, o.x, o.y) < 90 * 90);
    p.hp = Math.min(p.maxHp, p.hp + dt * (dn < 170 ? 6 * (1 + inf) : nearOutpost ? 4 : 0.7));

    if (p.trapped) {
      if (moving) { p.a += clamp(angDiff(p.a, Math.atan2(m.y, m.x)), -10 * dt, 10 * dt); p.gait += dt * 22; p.escape += dt * 0.32; }
      if (inp.pressed('KeyQ')) this.rally();
      return;
    }
    if (p.big) {
      if (inp.pressed('KeyE')) p.leaveBig();
      if (inp.pressed('KeyQ')) this.rally();
      return;
    }
    if (p.leapT > 0) {
      p.leapT -= dt;
      this.world.moveTo(p, p.x + Math.cos(p.leapA) * 520 * dt, p.y + Math.sin(p.leapA) * 520 * dt);
      p.gait += dt * 30;
      this.hash.query(p.x, p.y, 40, (o) => {
        if (o === p || o.dead || p.leapHit.has(o) || (o.kind === 'ant' && o.colony === p.colony) || o.invuln) return;
        if (dist(p.x, p.y, o.x, o.y) > o.r + p.r + 4) return;
        p.leapHit.add(o);
        o.damage(30 * (1 + (this.level - 1) * 0.08), p);
        this.fx.text(o.x, o.y - 14, 'snap!', '#ffe2a0');
      });
      return;
    }
    if (moving) {
      p.slow = this.slimeAt(p.x, p.y) ? 0.55 : 1;
      p.steer(Math.atan2(m.y, m.x), p.baseSpeed * (p.carry ? 0.85 : 1), dt, 11);
    } else p.speedNow = 0;

    if (inp.trail) {
      this.world.deposit(this.home, p.x, p.y, dt * 7);
      if (Math.random() < dt * 12) this.fx.sparkle(p.x - Math.cos(p.a) * 8, p.y - Math.sin(p.a) * 8, 'rgba(255,214,120,0.9)', 1);
    }
    if (p.carry) {
      this.world.deposit(this.home, p.x, p.y, dt * 2.5);
      for (const pt of this.home.dropPoints()) {
        if (dist2(p.x, p.y, pt.x, pt.y) < (pt.r * 0.5) ** 2) { this.deliver(this.home, p.carry, p); p.carry = null; break; }
      }
    }
    if (inp.bite && p.biteCd <= 0) {
      p.biteCd = p.biteRate; p.biteT = 0.25;
      const tg = this.playerBiteTarget();
      if (tg) {
        tg.damage(p.dmg, p);
        if (ANT_SPECIES[this.species].venom) this.poison(tg, p, 3, 3);
        p.lastTarget = tg; p.lastTargetT = 6;
        if (tg.kind !== 'ant' && tg.kind !== 'nest' && !tg.invuln) this.recruit(this.home, tg, p);
      }
    }
    if (inp.pressed('KeyE')) { const c = this.contextAction(); if (c && c.act) c.act(); }
    if (inp.pressed('KeyQ')) this.rally();
    if (inp.pressed('KeyX')) this.dismiss();
    if (inp.pressed('KeyF')) this.useAbility();
    if (inp.pressed('KeyN')) this.enterNest();
  }

  playerBiteTarget(extra = 0) {
    const p = this.player;
    let best = null, bs = Infinity;
    this.hash.query(p.x, p.y, 90, (o) => {
      if (o === p || o.dead || o.flying || (o.kind === 'ant' && o.colony === p.colony)) return;
      const d = dist(p.x, p.y, o.x, o.y) - o.r - p.r;
      if (d > 9 + extra) return;
      const ad = Math.abs(angDiff(p.a, Math.atan2(o.y - p.y, o.x - p.x)));
      if (ad > 1.5 && d > 1) return;
      const s = d + ad * 6;
      if (s < bs) { bs = s; best = o; }
    });
    return best;
  }

  useAbility() {
    const p = this.player, sp = ANT_SPECIES[this.species], ab = sp.ability;
    if (!p || p.dead || p.inNest || p.trapped || !ab) return;
    if (this.abilityCd > 0) { this.fx.text(p.x, p.y - 22, `${ab.name} ready in ${Math.ceil(this.abilityCd)}s`, '#e8dcc0'); return; }
    const lk = 1 + (this.level - 1) * 0.08;
    let ok = true;
    switch (ab.id) {
      case 'share': {
        p.hp = Math.min(p.maxHp, p.hp + 20);
        let n = 0;
        this.hash.query(p.x, p.y, 130, (o) => { if (o.kind === 'ant' && o.colony === p.colony && o !== p) { o.hp = Math.min(o.maxHp, o.hp + 15); o.greetT = 0.6; n++; } });
        this.fx.ring(p.x, p.y, 130, 'rgba(180,255,170,', 0.7);
        this.fx.text(p.x, p.y - 22, n ? `Shared food with ${n} sisters` : 'Ate a little food', '#c8f0b0');
        p.greetT = 0.8;
        break;
      }
      case 'cut': {
        const b = this.world.biome(p.x, p.y);
        if (p.carry || p.big) { ok = false; this.fx.text(p.x, p.y - 22, 'Your jaws are full', '#e8dcc0'); }
        else if (b === 'beach' || b === 'sea' || p.swimming) { ok = false; this.fx.text(p.x, p.y - 22, 'Nothing leafy to cut here', '#e8dcc0'); }
        else {
          p.carry = new Food('leafbit', p.x, p.y); p.pickSpot = { x: p.x, y: p.y }; p.biteT = 0.3;
          this.fx.sparkle(p.x + Math.cos(p.a) * 12, p.y + Math.sin(p.a) * 12, '#a6d468', 6);
        }
        break;
      }
      case 'venom': {
        let n = 0;
        this.hash.query(p.x, p.y, 75, (o) => {
          if (o === p || o.dead || o.invuln || o.flying || (o.kind === 'ant' && o.colony === p.colony) || o.kind === 'nest') return;
          if (dist2(p.x, p.y, o.x, o.y) > 75 * 75) return;
          o.damage(12 * lk, p); this.poison(o, p, 4, 4); n++;
        });
        this.fx.ring(p.x, p.y, 75, 'rgba(255,150,70,', 0.6);
        this.fx.sparkle(p.x, p.y, '#ffb050', 14);
        if (!n) this.fx.text(p.x, p.y - 22, 'No one in range', '#e8dcc0');
        break;
      }
      case 'leap':
        p.leapT = 0.28; p.leapA = p.a; p.leapHit = new Set(); p.biteT = 0.3;
        this.fx.dust(p.x, p.y, 6);
        break;
      case 'sting': {
        const tg = this.playerBiteTarget(16);
        if (!tg || tg.invuln) { ok = false; this.fx.text(p.x, p.y - 22, 'Nothing to sting', '#e8dcc0'); break; }
        tg.damage(45 * lk, p); tg.stunT = 2.5; p.biteT = 0.3;
        p.lastTarget = tg; p.lastTargetT = 6;
        this.fx.text(tg.x, tg.y - 18, 'Stunned!', '#ffe2a0');
        break;
      }
      case 'weave': {
        const h = this.home;
        const far = [h.nest, ...h.outposts].every((o) => dist2(p.x, p.y, o.x, o.y) > 300 * 300);
        if (h.outposts.length >= 3) { ok = false; this.ui.toast('You already have three outposts.'); }
        else if (!far) { ok = false; this.ui.toast('Build outposts at least 300 steps from the nest and each other.'); }
        else if (h.food < 15) { ok = false; this.ui.toast('Building an outpost costs 15 stored food.'); }
        else if (this.world.waterAt(p.x, p.y)) ok = false;
        else {
          h.food -= 15;
          h.outposts.push({ x: p.x, y: p.y, r: 50, seed: (Math.random() * 1e9) | 0 });
          this.fx.sparkle(p.x, p.y, '#c8f0a0', 16);
          this.ui.toast('Outpost woven. Sisters can drop food here, and you heal nearby.', 'good');
        }
        break;
      }
    }
    if (ok) { this.abilityCd = ab.cd; this.stats.abilityUsed = true; }
  }

  contextAction() {
    const p = this.player;
    if (!p || p.dead || this.mode !== 'play' || p.inNest) return null;
    if (p.trapped) return { label: 'Antlion pit! Keep moving to climb out', act: null };
    if (p.big) {
      const b = p.big, need = Math.ceil(b.needs / 2);
      const label = b.carriers.length < need
        ? `Too heavy alone. ${b.carriers.length}/${need} ants needed. Rally sisters with ${this.isTouch ? 'Rally' : 'Q'}`
        : `Hauling the ${b.name}. Steer it toward the nest`;
      return { label, act: () => p.leaveBig() };
    }
    if (p.carry) return { label: `Carrying a ${p.carry.name}. Walk into the nest${this.home.outposts.length ? ' or an outpost' : ''} to store it`, act: () => p.dropCarry() };
    if (dist2(p.x, p.y, 0, 0) < 120 * 120) return { label: `Go inside the nest ${this.isTouch ? '(Nest button)' : '(N)'}`, act: () => this.enterNest(), key: 'N' };
    let v = null;
    this.hash.query(p.x, p.y, 40, (o) => { if (!v && o.kind === 'ant' && o.colony === p.colony && o.trapped && dist2(p.x, p.y, o.x, o.y) < 40 * 40) v = o; });
    if (v) return { label: 'Pull your sister out of the pit', act: () => { v.escape += 0.3; p.biteT = 0.25; this.fx.dust(v.x, v.y, 3); } };
    for (const patch of this.activePatches) {
      if (dist2(p.x, p.y, patch.x, patch.y) > (patch.r + 30) ** 2) continue;
      let ap = null, bd = 26 * 26;
      for (const a of patch.aphids) { const d2 = dist2(p.x, p.y, a.x, a.y); if (!a.dead && d2 < bd) { bd = d2; ap = a; } }
      if (ap) {
        if (!ap.ready) return { label: 'This aphid has no honeydew yet. Try one with a golden drop', act: null };
        return { label: 'Stroke the aphid to milk its honeydew', act: () => this.playerMilk(ap) };
      }
    }
    let f = null, fd = 22 * 22;
    this.foodHash.query(p.x, p.y, 24, (o) => { const d2 = dist2(p.x, p.y, o.x, o.y); if (!o.taken && d2 < fd) { fd = d2; f = o; } });
    if (f) return { label: `Pick up the ${f.name}`, act: () => { this.takeFood(f); p.carry = f; p.pickSpot = { x: f.x, y: f.y }; } };
    for (const b of this.bigs) {
      if (dist2(p.x, p.y, b.x, b.y) < (b.r + 18) ** 2) {
        return { label: `Grab the ${b.name} (needs ${Math.ceil(b.needs / 2)} ants to move)`, act: () => b.addCarrier(p) };
      }
    }
    return null;
  }

  playerMilk(ap) {
    const p = this.player;
    ap.ready = false; ap.readyT = rand(9, 16);
    p.carry = new Food('honey', ap.x, ap.y);
    if (this.species === 'garden') p.carry.value = 3;
    p.pickSpot = { x: ap.x, y: ap.y };
    p.greetT = 0.6;
    this.stats.honey = (this.stats.honey || 0) + 1;
    this.fx.sparkle(ap.x, ap.y, '#ffd36b', 6);
    if (!this.toldOnce.has('honey')) { this.toldOnce.add('honey'); this.ui.toast('Honeydew! Aphids trade this sugary drop for the ants’ protection.'); }
  }

  playerStatus() {
    const p = this.player;
    if (p.inNest) return 'Inside the nest';
    if (p.trapped) return 'Sliding into an antlion pit!';
    if (p.swimming) return 'Paddling across the water';
    if (p.big) return `Hauling a ${p.big.name} with ${p.big.carriers.length - 1} sisters`;
    if (p.carry) return `Carrying a ${p.carry.name}`;
    if (dist2(p.x, p.y, 0, 0) < 170 * 170) return 'Home. Resting here heals you';
    return `Exploring the ${BIOME_NAMES[this.biomeHere].toLowerCase()}`;
  }

  rally() {
    const p = this.player;
    if (!p || p.dead || this.rallyCd > 0) return;
    this.rallyCd = 1.5;
    let n = 0;
    const R = 280;
    this.hash.query(p.x, p.y, R, (o) => {
      if (o.kind !== 'ant' || o.colony !== p.colony || o.isPlayer || o.dead || o.trapped) return;
      if (dist2(p.x, p.y, o.x, o.y) > R * R) return;
      if (o.state === 'carry' || o.state === 'rescue') return;
      o.followT = 30; o.slot = rand(TAU);
      if (o.state !== 'fight') { if (o.carry) o.dropCarry(); o.releaseClaim(); o.state = 'follow'; }
      n++;
    });
    this.fx.ring(p.x, p.y, R, 'rgba(255,215,120,', 0.9);
    this.fx.ring(p.x, p.y, R * 0.6, 'rgba(255,235,170,', 0.7);
    p.greetT = 0.8;
    this.fx.text(p.x, p.y - 22, n ? `${n} sister${n === 1 ? '' : 's'} follow you` : 'No sisters close enough', n ? '#ffe2a0' : '#e8dcc0');
    if (n) {
      if (!this.stats.rallied && this.mode === 'play') this.ui.toast(`Rallied! Sisters follow you, join your fights and help haul big food. Press ${this.isTouch ? 'Rally' : 'Q'} again to refresh.`);
      this.stats.rallied = true;
    }
  }

  dismiss() {
    let n = 0;
    for (const a of this.ants) if (a.colony === this.home && a.followT > 0) { a.followT = 0; n++; }
    if (n) this.fx.text(this.player.x, this.player.y - 22, 'Back to work, sisters', '#e8dcc0');
  }

  gainXp(n) {
    this.xp += n;
    let need = Math.round(30 * Math.pow(this.level, 1.35));
    while (this.xp >= need) {
      this.xp -= need;
      this.level++;
      need = Math.round(30 * Math.pow(this.level, 1.35));
      const p = this.player;
      if (p && !p.dead) {
        p.maxHp *= 1.08; p.dmg *= 1.08; p.hp = p.maxHp;
        this.fx.sparkle(p.x, p.y, '#ffe08a', 16);
        this.fx.text(p.x, p.y - 30, `Level ${this.level}!`, '#ffe08a');
      }
      this.ui.toast(`Level ${this.level}! You are tougher and bite harder.`, 'good');
    }
  }

  xpNeed() { return Math.round(30 * Math.pow(this.level, 1.35)); }

  respawnPlayer() {
    let best = null, bd = Infinity;
    for (const a of this.ants) {
      if (a.colony !== this.home || a.dead || a.trapped) continue;
      const d = dist2(a.x, a.y, 0, 0) + (a.role === 'soldier' ? 1e6 : 0);
      if (d < bd) { bd = d; best = a; }
    }
    if (!best) { this.gameOver(); return; }
    best.makePlayer(this.level);
    this.player = best;
    this.stats.sisters++;
    this.camera.x = best.x; this.camera.y = best.y;
    this.ui.toast(`You wake as another sister. The colony lives on (${this.counts.home - 1} left).`);
  }

  gameOver() {
    this.over = true;
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
    const s = this.stats;
    this.ui.el.overTitle.textContent = 'The colony has fallen';
    this.ui.el.overText.textContent = `Your sisters stored ${s.delivered} loads of food and reached ${s.peak} ants at their peak. You reached level ${this.level} over ${s.sisters} lives.`;
    this.ui.el.over.hidden = false;
  }

  /* -------------------------------------------------------- social glue */

  countAllies(ant, r) {
    let n = 0;
    this.hash.query(ant.x, ant.y, r, (o) => { if (o.kind === 'ant' && o.colony === ant.colony && !o.dead && dist2(ant.x, ant.y, o.x, o.y) < r * r) n++; });
    return n;
  }

  alarm(victim, src, radius = 200) {
    if (!src || src.dead || src.kind === 'antlion' || !src.kind) return;
    const col = victim.kind === 'nest' ? victim : victim.colony;
    if (victim.kind === 'ant') { if (victim.alarmCd > 0) return; victim.alarmCd = 1.2; }
    if (col.isPlayer || dist2(victim.x, victim.y, this.camera.x, this.camera.y) < 900 * 900) {
      this.fx.ring(victim.x, victim.y, radius * 0.55, col.isPlayer ? 'rgba(255,180,90,' : 'rgba(255,120,80,', 0.6);
    }
    let responders = [];
    this.hash.query(victim.x, victim.y, radius, (o) => {
      if (o.kind !== 'ant' || o.colony !== col || o === victim || o.dead || o.isPlayer || o.trapped) return;
      if (o.state === 'carry' || o.state === 'fight' || o.state === 'rescue') return;
      if (dist2(o.x, o.y, victim.x, victim.y) > radius * radius) return;
      responders.push(o);
    });
    if (src.predator && responders.length < (src.fear || 5)) responders = responders.filter((o) => o.role === 'soldier');
    if (src.kind === 'ant' && src.colony === col) return;
    for (const o of responders.slice(0, 10)) o.startFight(src);
  }

  recruit(col, target, src) {
    if (target.recruitT && target.recruitT > this.time) return;
    target.recruitT = this.time + 1.5;
    let n = 0;
    this.hash.query(src.x, src.y, 170, (o) => {
      if (n >= 6 || o.kind !== 'ant' || o.colony !== col || o.isPlayer || o.dead || o.trapped) return;
      if (o.state === 'forage' || o.state === 'guard' || o.state === 'follow' || (o.state === 'return' && !o.carry)) { o.startFight(target); n++; }
    });
  }

  slimeAt(x, y) {
    for (const c of this.critters) {
      if (c.kind !== 'snail' || dist2(x, y, c.x, c.y) > 500 * 500) continue;
      const tr = c.trail;
      for (let i = 0; i < tr.length; i++) if (dist2(x, y, tr[i].x, tr[i].y) < 64) return true;
    }
    return false;
  }

  onPlayerGreeted() {
    const p = this.player;
    p.hp = Math.min(p.maxHp, p.hp + 4);
    p.greetT = 0.5;
    if (!this.toldOnce.has('greet')) {
      this.toldOnce.add('greet');
      this.ui.toast('A sister tapped antennae with you and shared a little food. Ants trade news and food this way.');
    }
  }

  /* -------------------------------------------------------- deliveries */

  deliver(col, food, ant) {
    let shown = food.value;
    if (food.kind === 'leafbit') {
      if (col.chambers.fungus) col.leaves += 1;
      else col.addFood(1);
    } else {
      const got = col.addFood(food.value);
      shown = got;
      if (col.isPlayer && got < food.value && !this.toldOnce.has('full')) {
        this.toldOnce.add('full');
        this.ui.toast('The granary is full. Dig a bigger granary inside the nest (N).', 'bad');
      }
    }
    if (!col.isPlayer) return;
    this.stats.delivered++;
    if (ant.isPlayer) {
      this.stats.playerDelivered++;
      this.gainXp(2);
      this.fx.text(ant.x, ant.y - 30, food.kind === 'leafbit' ? '+1 leaf for the fungus' : `+${shown} food`, '#ffd36b');
      if (this.stats.playerDelivered === 1) this.ui.toast('Stored! The queen turns food into eggs. Your scent trail now leads sisters to that spot.');
    }
  }

  deliverBig(b, col) {
    b.done = true;
    col.addFood(b.value);
    const playerHelped = b.carriers.some((c) => c.isPlayer);
    for (const c of b.carriers) { c.big = null; if (!c.isPlayer) c.state = c.defaultState(); }
    if (col.isPlayer) {
      this.stats.bigDelivered++;
      if (playerHelped) this.gainXp(10);
      this.fx.text(b.x, b.y - 40, `+${b.value} food`, '#ffd36b');
      this.fx.sparkle(b.x, b.y, '#fff0b0', 14);
      this.ui.toast(`Teamwork! Your sisters hauled a ${b.name} home.`, 'good');
    } else if (dist2(this.player.x, this.player.y, b.x, b.y) < 900 * 900) {
      this.ui.toast(`Rival ${col.sp.name.toLowerCase()}s dragged a ${b.name} into their nest.`, 'bad');
    }
  }

  onRaidSteal() {
    if (this.toldOnce.has('steal') && Math.random() < 0.7) return;
    this.toldOnce.add('steal');
    this.ui.toast('Raiders are stealing from your stores!', 'bad');
  }

  onAntDeath(ant, src) {
    if (ant.colony === this.home) this.stats.lost++;
    else if (src && src.colony === this.home && src.isPlayer) this.gainXp(1);
    if (ant.isPlayer) {
      this.respawnT = Math.max(0.8, 2.5 - this.home.chambers.infirmary);
      const nm = src && src.kind === 'ant' ? `A ${src.colony.sp.name.toLowerCase()}` : src && src.kind === 'antlion' ? 'The antlion' : src && src.kind ? `The ${BIG_KINDS[src.kind]?.name || src.kind}` : 'Something';
      this.ui.toast(`${nm} got you.`, 'bad');
    }
  }

  onCritterDeath(c, src) {
    if (BIG_KINDS[c.kind]) this.bigs.push(new BigFood(this, c.kind, c.x, c.y, c.a));
    if (c.lair) c.lair.respawnAt = this.time + 150;
    if (src && src.colony === this.home) {
      if (BIG_PREDATORS.has(c.kind)) {
        this.stats.bigKills++;
        this.ui.toast(`Your colony brought down a ${BIG_KINDS[c.kind].name}! Haul it home together.`, 'good');
      }
      const xp = XP_FOR[c.kind] || 4;
      this.gainXp(src.isPlayer ? xp : Math.ceil(xp / 3));
    }
  }

  onLadybugRepelled(lb, src) {
    if (src && src.colony === this.home && dist2(this.player.x, this.player.y, lb.x, lb.y) < 700 * 700) {
      this.ui.toast('Your sisters chased the ladybird away from the aphid herd.', 'good');
    }
  }

  onAphidEaten(patch) {
    if (!this.toldOnce.has('ladyeat') && HERDERS.has(this.species) && dist2(this.player.x, this.player.y, patch.x, patch.y) < 700 * 700) {
      this.toldOnce.add('ladyeat');
      this.ui.toast('A ladybird is eating the aphids! Bite it to drive it off.', 'bad');
    }
  }

  onBirdRepelled(bird, src) {
    if (src && src.colony === this.home) { this.ui.toast('Your sisters drove the robin away!', 'good'); this.gainXp(15); }
  }

  onNestDestroyed(col, src) {
    this.destroyed.add(col.id);
    for (let i = 0; i < 3; i++) this.spawnFoodCluster(this.spotNear(col.x, col.y, 20, 120));
    this.bigs.push(new BigFood(this, 'sugar', col.x + 20, col.y));
    if (src && src.colony === this.home) {
      this.stats.nestsDown++;
      this.gainXp(60);
      this.ui.toast(`You toppled the ${col.name}! Its stores are spilling out.`, 'good');
    }
    this.fx.sparkle(col.x, col.y, '#ffd36b', 24);
    for (const a of this.ants) if (a.colony === col) a.raider = false;
  }

  /* -------------------------------------------------------- events */

  updateRaids(dt) {
    if (this.mode !== 'play') return;
    for (const col of this.activeColonies) {
      if (col.isPlayer || dist2(col.x, col.y, 0, 0) > 2600 * 2600) continue;
      col.raidT -= dt;
      if (col.raidT > 0) continue;
      col.raidT = rand(160, 240);
      const pool = this.ants.filter((a) => a.colony === col && !a.carry && !a.big && (a.state === 'guard' || a.state === 'forage'));
      if (pool.length < 10) continue;
      pool.sort((a, b) => (b.role === 'soldier') - (a.role === 'soldier'));
      const raiders = pool.slice(0, 7);
      for (const a of raiders) { a.raider = true; a.state = 'raid'; a.timer = 0; }
      this.ui.toast(`${raiders.length} ${col.sp.name.toLowerCase()}s are marching on your nest!`, 'bad');
    }
  }

  updateEvents(dt) {
    const t = this.timers;
    t.ladybug -= dt;
    if (t.ladybug <= 0) {
      t.ladybug = rand(40, 70);
      const lbs = this.critters.filter((c) => c.kind === 'ladybug').length;
      const pats = this.activePatches.filter((p) => p.aphids.length > 2);
      if (lbs < 2 && pats.length) this.critters.push(new Ladybug(this, pick(pats)));
    }
    t.bird -= dt;
    if (t.bird <= 0) {
      t.bird = rand(80, 150);
      const p = this.player;
      if (this.mode === 'play' && p && !p.dead && !p.inNest && this.darkness() < 0.2 && ['meadow', 'beach', 'dry'].includes(this.biomeHere) && dist2(p.x, p.y, 0, 0) > 250 * 250) {
        this.critters.push(new Bird(this, p.x + rand(-60, 60), p.y + rand(-60, 60)));
        this.ui.toast('A robin is diving at you! Get out from under its shadow!', 'bad');
      }
    }
  }

  updatePatches(dt) {
    for (const p of this.activePatches) {
      for (const a of p.aphids) a.update(dt);
      p.aphids = p.aphids.filter((a) => !a.dead);
      p.breedT -= dt;
      if (p.breedT <= 0) {
        p.breedT = rand(14, 22);
        if (p.aphids.length < 10) this.spawnAphid(p);
      }
    }
  }

  updatePits(dt) {
    const pits = this.world.activePits;
    for (const pit of pits) pit.busy = false;
    for (const a of this.ants) {
      if (a.dead || a.big || a.inNest || a.leapT > 0) continue;
      if (a.trapped) {
        const pit = a.trapped;
        pit.busy = true;
        pit.jawA = Math.atan2(a.y - pit.y, a.x - pit.x);
        const d = dist(a.x, a.y, pit.x, pit.y);
        if (d > pit.r * 0.3) { a.x = lerp(a.x, pit.x, dt * 1.5); a.y = lerp(a.y, pit.y, dt * 1.5); }
        a.hp -= 4 * dt;
        if (Math.random() < dt * 2) { a.hurtT = 0.15; this.fx.dust(a.x, a.y, 1); }
        if (a.hp <= 0) { a.trapped = null; a.die(pit); continue; }
        if (this.time > a.rescueCall) { a.rescueCall = this.time + 1; this.recruitRescue(a); }
        if (a.escape >= 1) {
          const ang = Math.atan2(a.y - pit.y, a.x - pit.x) || rand(TAU);
          a.x = pit.x + Math.cos(ang) * (pit.r + 8); a.y = pit.y + Math.sin(ang) * (pit.r + 8);
          a.trapped = null; a.escape = 0; a.pitImmune = 2.5; a.a = ang;
          this.fx.dust(a.x, a.y, 5);
          if (a.isPlayer) this.fx.text(a.x, a.y - 20, 'Free!', '#ffe2a0');
          else a.state = a.defaultState();
        }
        continue;
      }
      if (a.pitImmune > 0) continue;
      for (const pit of pits) {
        const d2 = dist2(a.x, a.y, pit.x, pit.y);
        if (d2 > pit.r * pit.r) continue;
        const d = Math.sqrt(d2) || 1;
        const pull = (1 - d / pit.r) * 75 + 18;
        a.x -= ((a.x - pit.x) / d) * pull * dt;
        a.y -= ((a.y - pit.y) / d) * pull * dt;
        if (Math.random() < dt * 6) this.fx.dust(a.x, a.y, 1);
        if (d < pit.r * 0.38) {
          a.trapped = pit; a.escape = 0; a.rescueCall = 0;
          if (a.carry) a.dropCarry();
          a.releaseClaim();
          if (a.isPlayer) {
            this.discover('antlion');
            if (!this.toldOnce.has('pit')) { this.toldOnce.add('pit'); this.ui.toast('Antlion pit! Keep pushing to climb out. Nearby sisters will try to pull you free.', 'bad'); }
          }
        }
        break;
      }
    }
    for (const pit of pits) pit.jawVis = clamp(pit.jawVis + (pit.busy ? dt * 3 : -dt * 1.5), 0, 1);
  }

  recruitRescue(v) {
    let n = 0;
    this.hash.query(v.x, v.y, 220, (o) => {
      if (n >= 3 || o === v || o.kind !== 'ant' || o.colony !== v.colony || o.isPlayer || o.dead || o.trapped) return;
      if (o.state === 'rescue' && o.target === v) { n++; return; }
      if (!['forage', 'return', 'guard', 'follow', 'greet', 'fetch'].includes(o.state)) return;
      if (o.carry) o.dropCarry();
      o.releaseClaim();
      o.state = 'rescue'; o.target = v; n++;
    });
    if (n && v.isPlayer && !this.toldOnce.has('rescue')) {
      this.toldOnce.add('rescue');
      this.ui.toast('Your sisters are coming to pull you out!', 'good');
    }
  }

  darkness() {
    const p = this.dayT;
    return smoothstep(0.58, 0.68, p) * (1 - smoothstep(0.9, 0.98, p)) * 0.64;
  }

  updateNight(dt) {
    const dark = this.darkness();
    if (dark > 0.3 && this.fireflies.length < 28 && Math.random() < dt * 4) {
      const c = this.camera;
      const x = c.x + rand(-700, 700), y = c.y + rand(-500, 500);
      if (!this.world.waterAt(x, y)) this.fireflies.push(new Firefly(this, x, y));
    }
    if (dark < 0.15) for (const f of this.fireflies) f.leaving = true;
    if (this.view === 'world' && Math.random() < dt * 25) {
      const v = this.view4;
      const x = rand(v.x0, v.x1), y = rand(v.y0, v.y1);
      if (this.world.waterVal(x, y) > 0.25) this.fx.twinkle(x, y);
    }
  }

  checkDiscoveries() {
    const p = this.player;
    if (!p || p.dead || p.inNest) return;
    const R2 = 240 * 240;
    for (const c of this.critters) if (dist2(p.x, p.y, c.x, c.y) < R2) this.discover(c.kind);
    for (const a of this.ants) if (a.colony !== this.home && dist2(p.x, p.y, a.x, a.y) < R2) this.discover('ant:' + a.sp);
    for (const pt of this.activePatches) if (dist2(p.x, p.y, pt.x, pt.y) < (pt.r + 110) ** 2 && pt.aphids.length) this.discover('aphid');
    for (const pit of this.world.activePits) if (dist2(p.x, p.y, pit.x, pit.y) < 150 * 150) this.discover('antlion');
    for (const f of this.flyers) if (dist2(p.x, p.y, f.x, f.y) < R2) this.discover(f.kind);
    for (const f of this.fireflies) if (f.fade > 0.5 && dist2(p.x, p.y, f.x, f.y) < R2) { this.discover('firefly'); break; }
  }

  discover(id) {
    if (this.discovered.has(id) || this.mode !== 'play') return;
    const sp = guideEntry(id);
    if (!sp) return;
    this.discovered.add(id);
    this.gainXp(5);
    this.ui.showDiscovery(sp, this.discovered.size);
  }

  /* ---------------------------------------------------------- camera */

  followCamera(dt) {
    const p = this.player, c = this.camera;
    if (p && !p.dead) {
      const k = 1 - Math.pow(0.002, dt);
      c.x = lerp(c.x, p.x, k); c.y = lerp(c.y, p.y, k);
    }
    c.zoom = lerp(c.zoom, this.baseZoom * this.zoomMul, 1 - Math.pow(0.01, dt));
  }

  attractCamera() {
    const c = this.camera, a = this.time * 0.05;
    c.x = Math.cos(a) * 140; c.y = Math.sin(a) * 90;
    c.zoom = this.baseZoom * 1.15;
  }

  /* ---------------------------------------------------------- render */

  inView(e, pad = 60) {
    const v = this.view4;
    return e.x > v.x0 - pad && e.x < v.x1 + pad && e.y > v.y0 - pad && e.y < v.y1 + pad;
  }

  render() {
    if (this.view === 'nest' && this.mode === 'play') { this.nestView.render(this.ctx); this.renderRain(); return; }
    const ctx = this.ctx, cam = this.camera, z = cam.zoom, dpr = this.dpr, t = this.time;
    const vw = this.vw, vh = this.vh;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#2f3a1c';
    ctx.fillRect(0, 0, vw, vh);
    const sx = dpr * z;
    ctx.setTransform(sx, 0, 0, sx, dpr * (vw / 2 - cam.x * z), dpr * (vh / 2 - cam.y * z));
    this.view4 = { x0: cam.x - vw / 2 / z, y0: cam.y - vh / 2 / z, x1: cam.x + vw / 2 / z, y1: cam.y + vh / 2 / z };
    const v = this.view4;

    this.world.drawChunks(ctx, v.x0, v.y0, v.x1, v.y1);
    this.world.drawPher(ctx, v, this.scentView);

    for (const c of this.critters) if (c.kind === 'snail' && this.inView(c, 500)) c.drawTrail(ctx);
    for (const pit of this.world.activePits) if (this.inView(pit)) drawAntlionJaws(ctx, pit, t);
    for (const o of this.home.outposts) if (this.inView(o)) drawOutpost(ctx, o, t);
    for (const col of this.activeColonies) {
      if (col.isPlayer || !this.inView(col) || col.hp >= col.maxHp) continue;
      const k = 1 - col.hp / col.maxHp;
      ctx.fillStyle = `rgba(30,15,5,${0.5 * k})`;
      ctx.beginPath(); ctx.arc(col.x, col.y, 30 + 50 * k, 0, TAU); ctx.fill();
    }

    for (const f of this.foods) if (this.inView(f)) drawFood(ctx, f, t);
    for (const p of this.activePatches) if (this.inView(p, 120)) for (const a of p.aphids) a.draw(ctx, t);
    for (const b of this.bigs) if (this.inView(b)) b.draw(ctx, t);

    const ground = this.critters.filter((c) => !c.flying && c.kind !== 'bird' && !(c.z > 2) && this.inView(c, 140));
    ground.sort((a, b) => a.r - b.r);
    let gi = 0;
    for (; gi < ground.length && ground[gi].r < 14; gi++) ground[gi].draw(ctx, t);
    for (const a of this.ants) if (!a.isPlayer && this.inView(a)) a.draw(ctx, t);
    const p = this.player;
    if (p && !p.dead && !p.inNest) p.draw(ctx, t);
    for (; gi < ground.length; gi++) ground[gi].draw(ctx, t);

    for (const c of this.critters) {
      if (c.kind === 'bird' && c.state === 'descend') {
        const k = 1 - c.timer / 1.4;
        ctx.strokeStyle = `rgba(255,90,60,${0.4 + 0.4 * Math.sin(t * 20)})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(c.lx, c.ly, 44 + (1 - k) * 30, 0, TAU); ctx.stroke();
      }
    }
    this.fx.draw(ctx);
    for (const f of this.flyers) if (this.inView(f, 160)) f.draw(ctx, t);
    for (const c of this.critters) if ((c.flying || c.z > 2) && c.kind !== 'bird' && this.inView(c, 160)) c.draw(ctx, t);
    for (const c of this.critters) if (c.kind === 'bird' && this.inView(c, 400)) c.draw(ctx, t);
    for (const f of this.fireflies) if (this.inView(f)) drawFireflyBody(ctx, f, t);

    this.renderNight();
    this.renderRain();
  }

  renderRain() {
    const k = this.weather.k;
    if (k < 0.02) return;
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = `rgba(40,60,80,${0.16 * k})`;
    ctx.fillRect(0, 0, this.vw, this.vh);
    ctx.strokeStyle = `rgba(210,225,240,${0.35 * k})`; ctx.lineWidth = 1;
    ctx.beginPath();
    for (const d of this.raindrops) { ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + d.l * 0.15, d.y - d.l); }
    ctx.stroke();
  }

  renderNight() {
    const ctx = this.ctx, dark = this.darkness(), p = this.dayT;
    const dusk = Math.max(0, 1 - Math.abs(p - 0.6) / 0.06) + Math.max(0, 1 - Math.abs(p - 0.95) / 0.04) * 0.6;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (dusk > 0) {
      ctx.fillStyle = `rgba(255,130,60,${dusk * 0.13})`;
      ctx.fillRect(0, 0, this.vw, this.vh);
    }
    if (dark < 0.01) return;
    const nc = this.nightCtx, w = this.nightC.width, h = this.nightC.height;
    const sc = w / this.vw, cam = this.camera, z = cam.zoom, t = this.time;
    nc.globalCompositeOperation = 'source-over';
    nc.clearRect(0, 0, w, h);
    nc.fillStyle = `rgba(8,14,40,${dark})`;
    nc.fillRect(0, 0, w, h);
    nc.globalCompositeOperation = 'destination-out';
    const light = (wx, wy, r, a) => {
      const x = (this.vw / 2 + (wx - cam.x) * z) * sc, y = (this.vh / 2 + (wy - cam.y) * z) * sc, rr = r * z * sc;
      if (x < -rr || y < -rr || x > w + rr || y > h + rr) return;
      const g = nc.createRadialGradient(x, y, 0, x, y, rr);
      g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      nc.fillStyle = g;
      nc.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    };
    const pl = this.player;
    if (pl && !pl.dead) light(pl.x, pl.y, 250, 0.85);
    light(0, 0, 170, 0.6);
    for (const o of this.home.outposts) light(o.x, o.y, 110, 0.5);
    for (const f of this.fireflies) {
      const glow = Math.pow(0.5 + 0.5 * Math.sin(t * f.freq + f.ph), 3) * f.fade;
      if (glow > 0.05) light(f.x, f.y, 80, glow * 0.75);
    }
    nc.globalCompositeOperation = 'source-over';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.nightC, 0, 0, this.canvas.width, this.canvas.height);
    const sx = this.dpr * z;
    ctx.setTransform(sx, 0, 0, sx, this.dpr * (this.vw / 2 - cam.x * z), this.dpr * (this.vh / 2 - cam.y * z));
    ctx.globalCompositeOperation = 'lighter';
    for (const f of this.fireflies) if (this.inView(f)) drawFireflyGlow(ctx, f, t);
    ctx.globalCompositeOperation = 'source-over';
  }
}

window.addEventListener('DOMContentLoaded', () => { window.game = new Game(); });
