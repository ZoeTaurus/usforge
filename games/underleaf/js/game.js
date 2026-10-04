'use strict';
/* Underleaf: game loop, world streaming, colonies, weather, camera and rendering. */

const SAVE_KEY = 'underleaf-save-v2';

/* Each level-up offers three of these; picking one again stacks it, up to its max. */
const PERKS = [
  { id: 'jaws', name: 'Strong jaws', desc: 'Your bites hit 20% harder.', max: 5 },
  { id: 'armour', name: 'Thick armour', desc: 'You have 20% more health.', max: 5 },
  { id: 'legs', name: 'Long legs', desc: 'You walk 10% faster.', max: 3 },
  { id: 'lifter', name: 'Heavy lifter', desc: 'You pull big food like two more sisters, and walk faster with a load.', max: 2 },
  { id: 'horn', name: 'Rallying call', desc: 'Rally reaches 40% further and sisters follow you 50% longer.', max: 2 },
  { id: 'wind', name: 'Second wind', desc: 'Stamina refills 40% faster and dashing costs less.', max: 3 },
  { id: 'focus', name: 'Focus', desc: 'Your special ability recharges 25% faster.', max: 2 },
  { id: 'leader', name: 'Leader', desc: 'Sisters following you bite 25% harder.', max: 2 },
  { id: 'reach', name: 'Keen antennae', desc: 'Pick things up from further away, and heal 50% faster outside the nest.', max: 2 },
  { id: 'venom', name: 'Venom glands', desc: 'Your bites poison whatever you hit.', max: 1 },
];

/* UsForge leaderboard: report a finished run's score to the page hosting the game.
   Does nothing when the game is opened on its own. */
function sendScoreToUsForge(score) {
  if (window.parent === window) return;
  if (!Number.isFinite(score) || score < 0 || score >= 1e12) return;
  try {
    // unit 'time' makes UsForge show the score as a clock, e.g. 5:12
    window.parent.postMessage({ usforge: 'score', score: Math.round(score), unit: 'time' }, '*');
  } catch (e) { /* ignore */ }
}
const XP_FOR = { mole: 70, vole: 30, newt: 20, assassin: 14, rove: 8, shrew: 45, toad: 35, groundbeetle: 14, jumper: 12, harvestman: 5, hedgehog: 200, wasp: 15, slug: 8, earwig: 6, dungbeetle: 10, termite: 1, spider: 30, crab: 40, frog: 40, lizard: 35, mouse: 35, scorpion: 30, centipede: 20, mantis: 20, beetle: 15, caterpillar: 8, worm: 8, grasshopper: 6, bee: 4 };
const BIG_PREDATORS = new Set(['mole', 'shrew', 'toad', 'hedgehog', 'wasp', 'spider', 'crab', 'frog', 'lizard', 'scorpion', 'centipede', 'mantis', 'mouse']);

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
    SFX.init();
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
    this.time = 0; this.dayT = 0.05; this.dayLen = 300; this.days = 0.25; this.lastSeason = 0;
    this.sw = [1, 0, 0, 0]; this.seasonA = 0; this.seasonB = 0; this.seasonK = 0; this.leafFall = [];
    this.activeTrees = []; this.activePlants = []; this.activeMounds = []; this.flakes = []; this.landings = [];
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
    this.level = 1; this.xp = 0; this.perks = {}; this.perkQueue = 0; this.perkOpen = false;
    this.stamina = 100; this.events = [];
    this.timers = { manage: 0, discover: 0, bird: rand(70, 120), save: 30, ladybug: 30, hedgehog: rand(40, 90), plants: 0 };
    this.discovered = new Set(['ant:' + species]);
    this.toldOnce = new Set();
    this.activePatches = [];
    this.followerCount = 0;
    this.rallyCd = 0; this.abilityCd = 0; this.respawnT = 0; this.lure = null;
    this.lifeTime = 0; this.lifeSent = false;
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
      if (this.mode === 'play') META.add('antsRaised');
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
    w.activePits = [...new Set([...w.featuresNear(px, py, 1600, 'pit'), ...w.featuresNear(0, 0, 1600, 'pit'), ...w.featuresNear(px, py, 1400, 'sundew')])];
    for (const pit of w.activePits) if (pit.type === 'sundew') { pit.kind = 'sundew'; pit.jawVis = pit.jawVis || 0; pit.jawA = 0; }
    this.activeTrees = w.near(px, py, 1500, 'trees');
    this.activePlants = [...new Set([...w.near(px, py, 1500, 'plants'), ...w.near(0, 0, 1300, 'plants')])];
    for (const f of this.activePlants) if (f.berries === undefined) { f.berries = randi(2, 6); f.seeds = 10; f.growT = rand(5, 15); f.dropT = rand(4, 10); }
    this.activeMounds = w.featuresNear(px, py, 1500, 'termites');
    for (const m of this.activeMounds) {
      m.termites = (m.termites || []).filter((t) => !t.dead);
      if (m.termites.length < 12 && Math.random() < 0.5) {
        const tm = new Termite(this, m, Math.random() < 0.25 ? 'soldier' : 'worker');
        m.termites.push(tm); this.critters.push(tm);
      }
    }
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
    const want = Math.round((15 + (this.weather.rain ? 5 : 0)) * [1, 1.2, 1, 0.45][this.season]);
    for (let k = 0; k < (initial ? 16 : 3) && n < want; k++) {
      const a = rand(TAU), d = initial ? rand(350, 1400) : rand(950, 1500);
      const x = px + Math.cos(a) * d, y = py + Math.sin(a) * d;
      if (w.waterAt(x, y) || dist2(x, y, 0, 0) < 300 * 300) continue;
      const bb = w.biome(x, y);
      if (bb === 'sea') continue;
      const kind = this.weather.rain && this.season !== 3 && Math.random() < 0.4 ? 'worm' : weighted(Math.random, SPAWN_TABLE[bb]);
      if (kind === 'spider' || kind === 'hedgehog') continue;
      if (this.season === 3 && ['wasp', 'grasshopper', 'cricket', 'bee', 'mantis', 'caterpillar', 'toad', 'jumper', 'harvestman', 'newt', 'assassin'].includes(kind)) continue;
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
    let hov = 0, strid = 0;
    for (const c of this.critters) { if (c.kind === 'bee') bees++; else if (c.kind === 'hoverfly') hov++; else if (c.kind === 'strider') strid++; }
    const sx = () => px + rand(-900, 900), sy = () => py + rand(-700, 700);
    const night = this.darkness() > 0.3;
    if (bf < 5 && b !== 'sea' && !night && this.season !== 3) this.flyers.push(new Butterfly(this, sx(), sy()));
    if (night && this.flyers.filter((f) => f.kind === 'moth').length < 4) this.flyers.push(new Moth(this, sx(), sy()));
    if (bees < 3 && (b === 'meadow' || b === 'marsh')) this.critters.push(new Bee(this, sx(), sy()));
    if (hov < 3 && !night && this.season !== 3 && (b === 'meadow' || b === 'wood' || b === 'marsh')) this.critters.push(new Hoverfly(this, sx(), sy()));
    if (strid < 6 && this.season !== 3 && Math.random() < 0.4) {
      for (let i = 0; i < 8; i++) {
        const x = px + rand(-900, 900), y = py + rand(-900, 900);
        if (w.waterVal(x, y) > 0.3 && w.waterAt(x, y) && w.biome(x, y) !== 'sea') { for (let k = 0; k < 3; k++) this.critters.push(new WaterStrider(this, x + rand(-30, 30), y + rand(-30, 30))); break; }
      }
    }
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
    const foodWant = [34, 34, 40, 14][this.season];
    if (nearP < foodWant) this.spawnFoodCluster(this.spotNear(px, py, 300, 1400), leafy());
    if (this.season === 2 && Math.random() < 0.3) {
      for (const tr of this.activeTrees) if (tr.kind === 'oak' && Math.random() < 0.2) {
        const a = rand(TAU), d = tr.tr + rand(10, tr.cr * 0.8);
        const x = tr.x + Math.cos(a) * d, y = tr.y + Math.sin(a) * d;
        if (!w.wetAt(x, y) && !w.blocker(x, y, 5, false)) this.addFood(new Food('acorn', x, y));
      }
    }
    if (nearH < foodWant) this.spawnFoodCluster(this.spotNear(0, 0, 200, 1300), leafy());
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
    if (species) {
      this.newGame(species, (Math.random() * 1e9) | 0);
      META.played.add(species); META.add('colonies');
    }
    for (const id of this.discovered) META.guide.add(id);
    this.mode = 'play';
    this.lifeTime = 0; this.lifeSent = false;
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
    this.time = data.time || 0; this.dayT = data.dayT || 0.1; this.days = data.days || this.dayT; this.lastSeason = this.season;
    this.level = data.level || 1; this.xp = data.xp || 0; this.perks = data.perks || {};
    Object.assign(this.stats, data.stats, { biomes: new Set(data.stats.biomes || ['meadow']) });
    this.discovered = new Set(data.discovered || []);
    this.toldOnce = new Set(data.told || []);
    this.destroyed = new Set(data.destroyed || []);
    const p = this.player;
    p.x = data.player.x; p.y = data.player.y;
    p.makePlayer(this.level, this.perks);
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
      v: 2, seed: this.seed, species: this.species, time: this.time, dayT: this.dayT, days: this.days, level: this.level, xp: this.xp, perks: this.perks,
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
    if (this.perkOpen) {
      const i = { Digit1: 0, Digit2: 1, Digit3: 2 }[code];
      if (i !== undefined) this.ui.pickPerk(i);
      return;
    }
    if (this.view === 'nest') {
      if (code === 'KeyN' || code === 'Escape') this.exitNest();
      if (code === 'Digit1') this.layEgg('worker');
      if (code === 'Digit2') this.layEgg('soldier');
      return;
    }
    if (code === 'KeyG') { this.ui.toggleGuide(); return; }
    if (code === 'KeyM') { this.toggleSound(); return; }
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

  toggleSound() {
    SFX.start();
    const m = SFX.toggleMute();
    if (this.player) this.fx.text(this.player.x, this.player.y - 26, m ? 'Sound off' : 'Sound on', '#e8dcc0');
    this.ui.soundIcon && this.ui.soundIcon();
  }

  enterNest() {
    const p = this.player;
    if (!p || p.dead || p.trapped || p.big) return;
    if (dist2(p.x, p.y, 0, 0) > 160 * 160) { this.ui.toast('Walk back to your nest entrance to go inside.'); return; }
    if (p.carry) { this.deliver(this.home, p.carry, p); p.carry = null; }
    this.view = 'nest';
    SFX.nestDoor();
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
    SFX.nestDoor();
    if (p) { p.inNest = false; p.x = 24; p.y = 18; p.a = 0.6; }
    this.ui.showNest(false);
    this.save();
  }

  frame(now) {
    const dt = Math.min(0.033, (now - this.last) / 1000);
    this.last = now;
    if (!this.paused && !this.guideOpen && !this.perkOpen) this.update(dt);
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
    SFX.update(dt, this);
    this.dayT = (this.dayT + dt / this.dayLen) % 1;
    this.days += dt / this.dayLen;
    this.updateSeasonBlend();
    if (this.season !== this.lastSeason) {
      this.lastSeason = this.season;
      if (this.mode === 'play') { this.ui.toast(SEASON_NEWS[this.season], this.season === 3 ? 'bad' : 'good'); SFX.season(); }
    }
    this.rallyCd -= dt; this.abilityCd -= dt;
    if (this.lure) { this.lure.t -= dt; if (this.lure.t <= 0) this.lure = null; }
    // leaderboard clock: time survived in the current ant's body, out in the world
    if (this.mode === 'play' && this.player && !this.player.dead && !this.player.inNest) this.lifeTime += dt;
    this.updateWeather(dt);

    this.landings = [];
    for (const c of this.critters) if (c.kind === 'bird' && c.state === 'descend') this.landings.push(c);
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
    this.updatePlants(dt);
    if (this.home.beacon && this.time - this.home.beacon.t > 45) this.home.beacon = null;

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
      this.timers.meta = (this.timers.meta || 0) - dt;
      if (this.timers.meta <= 0) { this.timers.meta = 1; this.checkMeta(); }
      this.timers.save -= dt;
      if (this.timers.save <= 0) { this.timers.save = 30; this.save(); }
      this.followCamera(dt);
      if (this.view === 'nest') this.nestView.update(dt);
      this.ui.update(dt);
    }
  }

  checkMeta() {
    const p = this.player;
    META.best('biggestColony', this.stats.peak);
    META.best('biomes', this.stats.biomes.size);
    META.best('mostDays', Math.floor(this.days));
    META.best('highestLevel', this.level);
    META.best('longestLife', Math.floor(this.lifeTime));
    if (p && !p.dead) META.best('farthest', Math.round(Math.hypot(p.x, p.y)));
    for (const a of META.check()) this.ui.achievement(a);
  }

  countColony(col) { return this.colCounts.get(col) || 0; }

  updateWeather(dt) {
    const w = this.weather;
    w.t -= dt;
    if (w.t <= 0) {
      w.rain = !w.rain;
      w.t = w.rain ? rand(40, 70) : rand(170, 280);
      if (this.mode === 'play') {
        if (this.sw[3] > 0.5) this.ui.toast(w.rain ? 'Snow is falling. Everyone moves slowly in the cold.' : 'The snow has stopped.');
        else this.ui.toast(w.rain ? 'Rain is falling. Scent trails wash away faster, and earthworms come up.' : 'The rain has stopped.');
      }
    }
    w.k = clamp(w.k + (w.rain ? dt : -dt) * 0.25, 0, 1);
    const sw = this.sw, snowy = sw[3] > 0.5;
    this.weatherSlow = (1 - 0.12 * w.k) * (1 - 0.18 * sw[3]);
    // deep winter freezes the streams: ants can walk straight across the ice
    const frozen = sw[3] > 0.8;
    if (frozen !== this.world.frozen) {
      this.world.frozen = frozen;
      if (frozen && this.mode === 'play' && !this.toldOnce.has('ice')) { this.toldOnce.add('ice'); this.ui.toast('The streams have frozen. You can walk across the ice until spring.'); }
      if (!frozen) for (const c of this.critters) if (c.kind === 'strider') c.dead = true;
    }
    this.updateTracks(dt);
    // snowflakes in winter (light flurries even between storms), falling leaves in autumn
    const wantSnow = Math.round(sw[3] * (snowy ? 50 + 160 * w.k : 0) + sw[3] * 20);
    while (this.flakes.length < wantSnow) { const z = Math.pow(Math.random(), 1.6) * 1.3 + 0.3; this.flakes.push({ x: rand(this.vw), y: rand(-this.vh, this.vh), v: rand(26, 44) * z, p: rand(TAU), r: z * 1.9, z }); }
    if (this.flakes.length > wantSnow) this.flakes.length = wantSnow;
    const wantLeaves = Math.round(sw[2] * 22 + sw[1] * 2);
    while (this.leafFall.length < wantLeaves) this.leafFall.push({ x: rand(this.vw), y: rand(-this.vh, this.vh), v: rand(25, 55), p: rand(TAU), c: pick(['#c8642a', '#e09a3a', '#a85a20', '#d8b040', '#b83a1e']) });
    if (this.leafFall.length > wantLeaves) this.leafFall.length = wantLeaves;
    const gust = Math.sin(this.time * 0.13) * 30 + Math.sin(this.time * 0.41) * 12;
    for (const f of this.flakes) {
      f.y += f.v * dt; f.x += (Math.sin(this.time * 0.8 + f.p) * 20 + gust) * f.z * dt;
      if (f.x < -20) f.x += this.vw + 40; else if (f.x > this.vw + 20) f.x -= this.vw + 40;
      if (f.y > this.vh + 10) { f.y = -10; f.x = rand(this.vw); }
    }
    for (const f of this.leafFall) {
      f.y += f.v * dt; f.x += Math.sin(this.time * 1.1 + f.p) * 34 * dt;
      if (f.y > this.vh + 10) { f.y = -10; f.x = rand(this.vw); }
    }
    if (w.k > 0.02 && !snowy) {
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
    p.hp = Math.min(p.maxHp, p.hp + dt * (dn < 170 ? 6 * (1 + inf) : nearOutpost ? 4 : 0.7 * (1 + 0.5 * this.perk('reach'))));
    p.dodgeT -= dt;
    p.frenzyT -= dt;
    if (p.gnawT > 0) { p.gnawT -= dt; if (Math.random() < dt * 8) this.fx.dust(p.x, p.y, 1); }
    if (!(p.dashT > 0)) this.stamina = Math.min(100, this.stamina + dt * 22 * (1 + 0.4 * this.perk('wind')));
    if (this.perkQueue > 0 && !this.perkOpen && !p.trapped) { this.perkQueue--; this.perkOpen = true; this.ui.openPerks(this.perkChoices()); return; }

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
    if (inp.pressed('KeyC')) this.dash();
    if (p.dashT > 0) {
      p.dashT -= dt;
      this.world.moveTo(p, p.x + Math.cos(p.dashA) * p.baseSpeed * 3.4 * dt, p.y + Math.sin(p.dashA) * p.baseSpeed * 3.4 * dt);
      p.gait += dt * 40; p.speedNow = p.baseSpeed * 3;
      if (Math.random() < dt * 30) this.fx.dust(p.x - Math.cos(p.dashA) * 8, p.y - Math.sin(p.dashA) * 8, 1);
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
      p.steer(Math.atan2(m.y, m.x), p.baseSpeed * (p.carry ? 0.85 + 0.08 * this.perk('lifter') : 1), dt, 11);
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
      SFX.bite(!!tg);
      if (tg) {
        tg.damage(p.dmg * (p.frenzyT > 0 ? 1.3 : 1), p);
        if (ANT_SPECIES[this.species].venom || this.perk('venom')) this.poison(tg, p, 3, 3);
        p.lastTarget = tg; p.lastTargetT = 6;
        if (tg.kind !== 'ant' && tg.kind !== 'nest' && !tg.invuln) this.recruit(this.home, tg, p);
      }
    }
    if (inp.pressed('KeyE')) { const c = this.contextAction(); if (c && c.act) c.act(); }
    if (inp.pressed('KeyQ')) this.rally();
    if (inp.pressed('KeyX')) this.dismiss();
    if (inp.pressed('KeyF')) this.useAbility();
    if (inp.pressed('KeyN')) this.enterNest();
    if (inp.pressed('KeyR')) this.placeBeacon();
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
      case 'swarm': {
        // every sister in earshot charges the nearest prey and bites harder for a while
        let prey = null, bd = 260 * 260;
        this.hash.query(p.x, p.y, 260, (o) => {
          if (o.dead || o.invuln || o.flying || o.kind === 'nest' || o.kind === 'ant' || o.kind === 'aphid') return;
          const d2 = dist2(p.x, p.y, o.x, o.y); if (d2 < bd) { bd = d2; prey = o; }
        });
        if (!prey) this.hash.query(p.x, p.y, 260, (o) => {
          if (o.kind !== 'ant' || o.colony === p.colony || o.dead) return;
          const d2 = dist2(p.x, p.y, o.x, o.y); if (d2 < bd) { bd = d2; prey = o; }
        });
        let n = 0;
        p.frenzyT = 8;
        this.hash.query(p.x, p.y, 220, (o) => {
          if (o.kind !== 'ant' || o.colony !== p.colony || o === p || o.dead || o.inNest || o.big) return;
          o.frenzyT = 8; n++;
          if (prey) o.startFight(prey);
        });
        this.fx.ring(p.x, p.y, 220, 'rgba(255,160,70,', 0.7);
        this.fx.text(p.x, p.y - 22, prey ? `${n} sisters swarm the ${prey.name || prey.kind}!` : `${n} sisters whipped into a frenzy`, '#ffc890');
        break;
      }
      case 'lure': {
        if (this.world.waterAt(p.x, p.y)) { ok = false; break; }
        this.lure = { x: p.x + Math.cos(p.a) * 14, y: p.y + Math.sin(p.a) * 14, t: 12 };
        this.fx.sparkle(this.lure.x, this.lure.y, '#ffd36b', 10);
        this.fx.text(p.x, p.y - 22, 'Honey lure dropped', '#ffd36b');
        // sisters gather around the bead, ready to pounce
        this.hash.query(p.x, p.y, 240, (o) => {
          if (o.kind === 'ant' && o.colony === p.colony && !o.isPlayer && !o.carry && !o.big && !o.inNest && o.state !== 'fight') { o.state = 'guard'; o.target = null; o.timer = 12; o.guardAt = { x: this.lure.x, y: this.lure.y }; }
        });
        break;
      }
      case 'gnaw':
        p.gnawT = 6;
        this.fx.dust(p.x, p.y, 6);
        this.fx.text(p.x, p.y - 22, 'Chewing through anything!', '#e8d0a0');
        break;
      case 'potent': {
        const tg = this.playerBiteTarget(18);
        if (!tg || tg.invuln) { ok = false; this.fx.text(p.x, p.y - 22, 'Nothing to sting', '#e8dcc0'); break; }
        tg.damage(14 * lk, p); this.poison(tg, p, 9 * lk, 6); p.biteT = 0.3;
        if (!tg.predator) tg.stunT = Math.max(tg.stunT || 0, 1.5);
        p.lastTarget = tg; p.lastTargetT = 6;
        this.fx.sparkle(tg.x, tg.y, '#ff9060', 10);
        this.fx.text(tg.x, tg.y - 18, 'Venom!', '#ffb090');
        break;
      }
    }
    if (ok) SFX.ability();
    if (ok) { this.abilityCd = ab.cd * (1 - 0.25 * this.perk('focus')); this.stats.abilityUsed = true; }
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
    for (const f of this.activePlants) {
      if (f.type === 'bush' && dist2(p.x, p.y, f.x, f.y) < (f.r + 10) ** 2 && f.berries > 0) {
        return { label: 'Shake the bramble to drop a blackberry', act: () => { f.berries--; this.dropFrom(f, 'berry'); p.biteT = 0.3; } };
      }
    }
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
    const pr = 22 + 10 * this.perk('reach');
    let f = null, fd = pr * pr;
    this.foodHash.query(p.x, p.y, pr + 2, (o) => { const d2 = dist2(p.x, p.y, o.x, o.y); if (!o.taken && d2 < fd) { fd = d2; f = o; } });
    if (f) return { label: `Pick up the ${f.name}`, act: () => { this.takeFood(f); p.carry = f; p.pickSpot = { x: f.x, y: f.y }; SFX.pickup(); } };
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
    if (this.species === 'garden' || this.species === 'honeypot') p.carry.value = 3;
    p.pickSpot = { x: ap.x, y: ap.y };
    p.greetT = 0.6;
    this.stats.honey = (this.stats.honey || 0) + 1;
    SFX.pickup();
    META.add('honey');
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

  /* A quick dodge: a burst of speed you cannot be hit during. Costs stamina. */
  dash() {
    const p = this.player;
    if (!p || p.dead || p.inNest || p.trapped || p.big) return;
    const cost = 35 * (1 - 0.15 * this.perk('wind'));
    if (this.stamina < cost) { this.fx.text(p.x, p.y - 22, 'Too tired to dash', '#e8dcc0'); return; }
    this.stamina -= cost;
    const m = this.input.move;
    p.dashA = m.x || m.y ? Math.atan2(m.y, m.x) : p.a;
    p.a = p.dashA; p.dashT = 0.22; p.dodgeT = 0.32;
    SFX.dash();
    this.fx.dust(p.x, p.y, 4);
  }

  rally() {
    const p = this.player;
    if (!p || p.dead || this.rallyCd > 0) return;
    this.rallyCd = 1.5;
    let n = 0;
    const R = 280 * (1 + 0.4 * this.perk('horn'));
    this.hash.query(p.x, p.y, R, (o) => {
      if (o.kind !== 'ant' || o.colony !== p.colony || o.isPlayer || o.dead || o.trapped) return;
      if (dist2(p.x, p.y, o.x, o.y) > R * R) return;
      if (o.state === 'carry' || o.state === 'rescue') return;
      o.followT = 30 * (1 + 0.5 * this.perk('horn')); o.slot = rand(TAU);
      if (o.state !== 'fight') { if (o.carry) o.dropCarry(); o.releaseClaim(); o.state = 'follow'; }
      n++;
    });
    this.fx.ring(p.x, p.y, R, 'rgba(255,215,120,', 0.9);
    SFX.rally();
    this.fx.ring(p.x, p.y, R * 0.6, 'rgba(255,235,170,', 0.7);
    p.greetT = 0.8;
    this.fx.text(p.x, p.y - 22, n ? `${n} sister${n === 1 ? '' : 's'} follow you` : 'No sisters close enough', n ? '#ffe2a0' : '#e8dcc0');
    if (n) {
      META.best('bestRally', n);
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
        p.refreshPlayer(this.level, this.perks); p.hp = p.maxHp;
        this.fx.sparkle(p.x, p.y, '#ffe08a', 16);
        this.fx.text(p.x, p.y - 30, `Level ${this.level}!`, '#ffe08a');
        if (this.mode === 'play') SFX.levelUp();
      }
      if (this.mode === 'play') this.perkQueue++;
    }
  }

  perk(id) { return this.perks[id] || 0; }

  /* Offer three perks the player can still take. */
  perkChoices() {
    const pool = PERKS.filter((k) => this.perk(k.id) < k.max && !(k.id === 'venom' && ANT_SPECIES[this.species].venom));
    for (let i = pool.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [pool[i], pool[j]] = [pool[j], pool[i]]; }
    return pool.slice(0, 3);
  }
  choosePerk(id) {
    this.perks[id] = this.perk(id) + 1;
    const p = this.player;
    if (p && !p.dead) { const f = p.hp / p.maxHp; p.refreshPlayer(this.level, this.perks); p.hp = p.maxHp * f; }
    this.perkOpen = false;
    this.ui.toast(`${PERKS.find((k) => k.id === id).name}${this.perks[id] > 1 ? ` ${this.perks[id]}` : ''} learned.`, 'good');
    this.save();
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
    best.makePlayer(this.level, this.perks);
    this.lifeTime = 0; this.lifeSent = false;
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
      if (['forage', 'scout', 'herd', 'guard', 'follow'].includes(o.state) || (o.state === 'return' && !o.carry)) { o.startFight(target); n++; }
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
      const v = col.species === 'harvester' && (food.kind === 'seed' || food.kind === 'sunseed') ? food.value * 2 : food.value;
      const got = col.addFood(v);
      shown = got;
      if (col.isPlayer && got < v && !this.toldOnce.has('full')) {
        this.toldOnce.add('full');
        this.ui.toast('The granary is full. Dig a bigger granary inside the nest (N).', 'bad');
      }
    }
    if (!col.isPlayer) return;
    this.stats.delivered++;
    if (this.mode === 'play') { META.add('colonyLoads'); if (ant.isPlayer) META.add('playerLoads'); }
    if (this.view === 'nest' && Math.random() < 0.5) this.nestView.sendCourier('E', 'granary', 'crumb');
    if (ant.isPlayer) {
      this.stats.playerDelivered++;
      SFX.deliver();
      this.gainXp(2);
      const whole = Math.round(shown);
      this.fx.text(ant.x, ant.y - 30, food.kind === 'leafbit' ? '+1 leaf for the fungus' : whole > 0 ? `+${whole} food` : 'Granary full', '#ffd36b');
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
      if (this.mode === 'play') { META.add('bigHauls'); META.best('biggestHaul', b.value); }
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
    if (ant.isPlayer && this.mode === 'play') { META.best('longestLife', Math.floor(this.lifeTime)); META.add('lives'); }
    // A run is one ant's life: report how long it lasted, whatever the species.
    // Lives shorter than 3 seconds are skipped so an instant death doesn't pop up the score box.
    if (ant.isPlayer && this.mode === 'play' && !this.lifeSent) {
      this.lifeSent = true;
      if (this.lifeTime >= 3) sendScoreToUsForge(Math.floor(this.lifeTime));
    }
    if (ant.colony === this.home) this.stats.lost++;
    else if (src && src.colony === this.home && src.isPlayer) this.gainXp(1);
    if (ant.isPlayer) {
      if (this.mode === 'play') SFX.death();
      this.respawnT = Math.max(0.8, 2.5 - this.home.chambers.infirmary);
      const nm = src && src.kind === 'ant' ? `A ${src.colony.sp.name.toLowerCase()}` : src && src.kind === 'antlion' ? 'The antlion' : src && src.kind ? `The ${BIG_KINDS[src.kind]?.name || src.kind}` : 'Something';
      this.ui.toast(`${nm} got you.`, 'bad');
    }
  }

  onCritterDeath(c, src) {
    if (this.mode === 'play' && c.r > 9) SFX.world(this, 'kill', c.x, c.y);
    if (BIG_KINDS[c.kind]) this.bigs.push(new BigFood(this, c.kind, c.x, c.y, c.a));
    if (c.lair) c.lair.respawnAt = this.time + 150;
    if (src && src.colony === this.home) {
      if (this.mode === 'play') META.kill(c.kind);
      if (c.kind === 'termite') this.stats.termites = (this.stats.termites || 0) + 1;
      if (BIG_PREDATORS.has(c.kind) || c.kind === 'hedgehog' || c.kind === 'wasp') {
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
    if (src && src.colony === this.home) { this.ui.toast('Your sisters drove the robin away!', 'good'); this.gainXp(15); META.add('robins'); }
  }

  onNestDestroyed(col, src) {
    this.destroyed.add(col.id);
    for (let i = 0; i < 3; i++) this.spawnFoodCluster(this.spotNear(col.x, col.y, 20, 120));
    this.bigs.push(new BigFood(this, 'sugar', col.x + 20, col.y));
    if (src && src.colony === this.home) {
      this.stats.nestsDown++;
      META.add('nests');
      this.gainXp(60);
      this.ui.toast(`You toppled the ${col.name}! Its stores are spilling out.`, 'good');
    }
    this.fx.sparkle(col.x, col.y, '#ffd36b', 24);
    for (const a of this.ants) if (a.colony === col) a.raider = false;
  }

  /* -------------------------------------------------------- events */

  /* Rival colonies size each other up. A colony that clearly outnumbers a neighbour
     sends a war party: against you they steal from your stores, against another rival
     they fight their way into its mound. */
  updateRaids(dt) {
    if (this.mode !== 'play') return;
    for (const col of this.activeColonies) {
      if (col.isPlayer) continue;
      col.raidT -= dt;
      if (col.raidT > 0) continue;
      col.raidT = rand(150, 230);
      const mine = this.countColony(col);
      let target = null, bestScore = 0;
      for (const other of this.activeColonies) {
        if (other === col || other.dead) continue;
        const d = dist(col.x, col.y, other.x, other.y);
        const range = other.isPlayer ? 2600 : 1800;
        if (d > range) continue;
        const theirs = this.countColony(other);
        const ratio = mine / Math.max(1, theirs);
        if (!other.isPlayer && ratio < 1.3) continue;
        const score = ratio / (d + 400) * (other.isPlayer ? 1.4 : 1);
        if (score > bestScore) { bestScore = score; target = other; }
      }
      if (!target) continue;
      const pool = this.ants.filter((a) => a.colony === col && !a.inNest && !a.carry && !a.big && ['guard', 'forage', 'scout'].includes(a.state));
      if (pool.length < 10) continue;
      pool.sort((a, b) => (b.role === 'soldier') - (a.role === 'soldier'));
      const raiders = pool.slice(0, target.isPlayer ? 7 : 12);
      for (const a of raiders) { a.raider = true; a.raidTarget = target; a.state = 'raid'; a.timer = 0; }
      if (target.isPlayer) this.ui.toast(`${raiders.length} ${col.sp.name.toLowerCase()}s are marching on your nest!`, 'bad');
      else if (dist2(this.player.x, this.player.y, col.x, col.y) < 1500 * 1500) this.ui.toast(`The ${col.sp.name.toLowerCase()}s are going to war with the ${target.sp.name.toLowerCase()}s nearby.`);
    }
  }

  /* World events: a picnic left behind, or a swarm of winged termites at dusk. */
  updateWorldEvents(dt) {
    const t = this.timers, p = this.player;
    t.event = (t.event ?? rand(90, 150)) - dt;
    for (const ev of this.events) {
      ev.age += dt;
      if (ev.kind === 'picnic') {
        let left = 0;
        this.foodHash.query(ev.x, ev.y, 150, (f) => { if (!f.taken) left++; });
        for (const b of this.bigs) if (!b.done && dist2(b.x, b.y, ev.x, ev.y) < 150 * 150) left += 3;
        if ((left === 0 && ev.age > 10) || ev.age > 300) ev.fading = true;
      } else if (ev.kind === 'swarm') {
        this.updateSwarm(ev, dt);
        if (ev.age > 120) ev.fading = true;
      } else if (ev.age > 70) ev.fading = true;
      if (ev.fading) ev.fade = Math.max(0, (ev.fade ?? 1) - dt * 0.4);
    }
    this.events = this.events.filter((ev) => !ev.fading || ev.fade > 0);
    if (t.event > 0 || this.mode !== 'play' || !p || p.dead || p.inNest) return;
    t.event = rand(150, 240);
    const dusk = this.dayT > 0.5 && this.dayT < 0.7;
    if ((dusk || this.weather.k > 0.4) && this.sw[3] < 0.3 && Math.random() < 0.6) this.startTermiteFlight();
    else if (this.sw[3] < 0.5) this.startPicnic();
  }

  startPicnic() {
    const p = this.player;
    const s = this.spotNear(p.x, p.y, 650, 1150);
    if (!s) return;
    const ev = { kind: 'picnic', x: s.x, y: s.y, rot: rand(-0.4, 0.4), age: 0, seed: (Math.random() * 1e9) | 0 };
    this.events.push(ev);
    for (let i = 0; i < 46; i++) {
      const a = rand(TAU), d = Math.sqrt(Math.random()) * 95;
      const x = s.x + Math.cos(a) * d, y = s.y + Math.sin(a) * d;
      if (!this.world.wetAt(x, y)) this.addFood(new Food(pick(['crumb', 'crumb', 'crumb', 'seed', 'berry']), x, y));
    }
    this.bigs.push(new BigFood(this, 'crust', s.x - 40, s.y + 10));
    this.bigs.push(new BigFood(this, 'crust', s.x + 35, s.y - 25));
    this.bigs.push(new BigFood(this, Math.random() < 0.5 ? 'sugar' : 'apple', s.x + 10, s.y + 45));
    this.ui.toast('Someone left a picnic behind! Crumbs everywhere. Follow the gold arrow.', 'good');
  }

  /* Winged termites pour out of exit holes for a few seconds, rise into a drifting cloud,
     then come down, shed their wings and pair off. It builds up gradually, near a mound if there is one. */
  startTermiteFlight() {
    const p = this.player;
    let src = null, bd = 1100 * 1100;
    for (const m of this.activeMounds || []) { const d2 = dist2(p.x, p.y, m.x, m.y); if (d2 < bd) { bd = d2; src = m; } }
    let x, y;
    if (src) { x = src.x; y = src.y; }
    else { const sp = this.spotNear(p.x, p.y, 260, 480); if (!sp) return; x = sp.x; y = sp.y; }
    const holes = [];
    const hr = src ? 70 : 22;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + rand(-0.4, 0.4), d = hr * rand(0.7, 1.1);
      const hx = x + Math.cos(a) * d, hy = y + Math.sin(a) * d;
      if (!this.world.wetAt(hx, hy)) holes.push({ x: hx, y: hy, a });
    }
    if (!holes.length) return;
    const ev = { kind: 'swarm', x, y, cx: x, cy: y, age: 0, left: 36, emitT: 2.5, holes, wind: rand(TAU), seed: (Math.random() * 1e9) | 0 };
    this.events.push(ev);
    // soldiers come up first to guard the exits
    for (const h of holes.slice(0, 3)) {
      const so = new Termite(this, { x: h.x, y: h.y }, 'soldier');
      so.x = h.x + Math.cos(h.a) * 8; so.y = h.y + Math.sin(h.a) * 8;
      so.mound = { x: h.x, y: h.y };
      this.critters.push(so);
    }
    const dir = Math.atan2(y - p.y, x - p.x), compass = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'][Math.round((((dir % TAU) + TAU) % TAU) / (TAU / 8)) % 8];
    this.ui.toast(`Termites are about to swarm, just to the ${compass}! Winged termites make easy, rich food once they land.`, 'good');
  }

  updateSwarm(ev, dt) {
    // the cloud drifts slowly downwind
    ev.cx += Math.cos(ev.wind) * 9 * dt; ev.cy += Math.sin(ev.wind) * 9 * dt;
    ev.emitT -= dt;
    while (ev.emitT <= 0 && ev.left > 0) {
      const h = pick(ev.holes);
      const al = new Alate(this, h.x, h.y, ev);
      al.a = h.a + rand(-0.8, 0.8);
      this.critters.push(al);
      ev.left--;
      // a trickle that builds to a rush, then tails off
      const k = 1 - ev.left / 36;
      ev.emitT += k < 0.2 ? rand(0.4, 0.8) : k < 0.8 ? rand(0.08, 0.25) : rand(0.3, 0.7);
    }
  }

  updateEvents(dt) {
    this.updateWorldEvents(dt);
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

  updatePlants(dt) {
    const s = this.season;
    for (const f of this.activePlants) {
      if (f.type === 'bush') {
        f.growT -= dt * (s === 2 ? 1.8 : s === 3 ? 0 : 1);
        if (f.growT <= 0) { f.growT = rand(10, 18); if (f.berries < 10) f.berries++; }
        f.dropT -= dt;
        if (f.dropT <= 0) { f.dropT = rand(7, 14); if (f.berries > 3) { f.berries--; this.dropFrom(f, 'berry'); } }
      } else if (f.type === 'sunflower') {
        f.dropT -= dt * (s === 1 || s === 2 ? 1 : 0.2);
        if (f.dropT <= 0) { f.dropT = rand(6, 12); this.dropFrom(f, 'seed'); }
      }
    }
    if (this.timers.hedgehog !== undefined) {
      this.timers.hedgehog -= dt;
      const p = this.player;
      if (this.timers.hedgehog <= 0) {
        this.timers.hedgehog = rand(120, 220);
        if (this.mode === 'play' && p && !p.dead && this.darkness() > 0.35 && !this.critters.some((c) => c.kind === 'hedgehog') && ['meadow', 'wood'].includes(this.biomeHere)) {
          const a = rand(TAU), x = p.x + Math.cos(a) * 800, y = p.y + Math.sin(a) * 800;
          if (!this.world.wetAt(x, y)) {
            this.critters.push(new Hedgehog(this, x, y));
            this.ui.toast('Something huge is snuffling through the dark. A hedgehog! Keep your distance.', 'bad');
          }
        }
      }
    }
  }

  dropFrom(f, kind) {
    const a = rand(TAU), d = rand(10, f.r);
    const x = f.x + Math.cos(a) * d, y = f.y + Math.sin(a) * d;
    if (this.world.wetAt(x, y) || this.world.blocker(x, y, 4, false)) return;
    this.addFood(new Food(kind, x, y));
  }

  placeBeacon() {
    const p = this.player;
    if (!p || p.dead || p.inNest) return;
    this.home.beacon = { x: p.x, y: p.y, t: this.time };
    this.world.deposit(this.home, p.x, p.y, 6);
    this.fx.ring(p.x, p.y, 120, 'rgba(255,214,120,', 0.8);
    this.fx.text(p.x, p.y - 26, 'Sisters will search here', '#ffe2a0');
    if (!this.toldOnce.has('beacon')) { this.toldOnce.add('beacon'); this.ui.toast('Beacon placed. Foragers will come and search around it for 45 seconds.'); }
  }

  onStarve() {
    const victims = this.ants.filter((a) => a.colony === this.home && !a.isPlayer && !a.dead);
    if (!victims.length) return;
    const v = pick(victims);
    v.dead = true;
    this.stats.lost++;
    this.ui.toast('The stores are empty and the colony is starving. A sister has died.', 'bad');
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
          if (a.isPlayer) { this.fx.text(a.x, a.y - 20, 'Free!', '#ffe2a0'); META.add('escapes'); }
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
            this.discover(pit.kind === 'sundew' ? 'plant:sundew' : 'antlion');
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
      if (!['forage', 'scout', 'herd', 'return', 'guard', 'follow', 'greet', 'fetch'].includes(o.state)) return;
      if (o.carry) o.dropCarry();
      o.releaseClaim();
      o.state = 'rescue'; o.target = v; n++;
    });
    if (n && v.isPlayer && !this.toldOnce.has('rescue')) {
      this.toldOnce.add('rescue');
      this.ui.toast('Your sisters are coming to pull you out!', 'good');
    }
  }

  get season() { return Math.floor(this.days) % 4; }

  /* Seasons fade into each other over the last and first fifth of each one (about two minutes).
     sw[i] is how much of season i is showing right now. */
  updateSeasonBlend() {
    const pos = ((this.days % 4) + 4) % 4, s = Math.floor(pos), f = pos - s;
    let a = s, b = s, k = 0;
    if (f > 0.8) { b = (s + 1) % 4; k = smoothstep(0.8, 1.2, f); }
    else if (f < 0.2) { a = (s + 3) % 4; k = smoothstep(0.8, 1.2, f + 1); }
    const w = [0, 0, 0, 0];
    w[a] += 1 - k; w[b] += k;
    this.sw = w; this.seasonA = a; this.seasonB = b; this.seasonK = k;
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
    for (const pit of this.world.activePits) if (dist2(p.x, p.y, pit.x, pit.y) < 150 * 150) this.discover(pit.kind === 'sundew' ? 'plant:sundew' : 'antlion');
    for (const tr of this.activeTrees) if (dist2(p.x, p.y, tr.x, tr.y) < (tr.cr + 60) ** 2) this.discover('plant:' + tr.kind);
    for (const f of this.activePlants) if (dist2(p.x, p.y, f.x, f.y) < 180 * 180) this.discover('plant:' + f.type);
    for (const f of this.flyers) if (dist2(p.x, p.y, f.x, f.y) < R2) this.discover(f.kind);
    for (const f of this.fireflies) if (f.fade > 0.5 && dist2(p.x, p.y, f.x, f.y) < R2) { this.discover('firefly'); break; }
  }

  discover(id) {
    if (this.discovered.has(id) || this.mode !== 'play') return;
    const sp = guideEntry(id);
    if (!sp) return;
    this.discovered.add(id);
    META.guide.add(id); META.dirty = true;
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
    if (!this.vw || !this.vh) return;
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
    if (this.sw[2] > 0.01) this.world.drawSeasonLayer(ctx, v, 'leaves', this.sw[2]);
    if (this.sw[3] > 0.01) { this.world.drawSeasonLayer(ctx, v, 'snow', this.sw[3]); this.renderTracks(ctx); }
    this.world.drawPher(ctx, v, this.scentView);

    for (const c of this.critters) if (c.drawTrail && (c.kind === 'snail' || c.kind === 'mole') && this.inView(c, 600)) c.drawTrail(ctx);
    for (const pit of this.world.activePits) {
      if (!this.inView(pit)) continue;
      if (pit.kind === 'sundew') { pit.curl = pit.jawVis; drawSundew(ctx, pit, t); }
      else drawAntlionJaws(ctx, pit, t);
    }
    const bc = this.home.beacon;
    if (bc && this.inView(bc)) {
      const k = 0.5 + 0.5 * Math.sin(t * 4);
      ctx.strokeStyle = `rgba(255,214,120,${0.35 + 0.35 * k})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(bc.x, bc.y, 18 + k * 8, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(255,214,120,0.85)';
      ctx.beginPath(); ctx.moveTo(bc.x, bc.y - 22); ctx.lineTo(bc.x + 12, bc.y - 16); ctx.lineTo(bc.x, bc.y - 10); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#6a4a20'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(bc.x, bc.y); ctx.lineTo(bc.x, bc.y - 22); ctx.stroke();
    }
    const lu = this.lure;
    if (lu && this.inView(lu)) {
      const k = Math.min(1, lu.t / 2), wob = 1 + Math.sin(t * 5) * 0.08;
      ctx.fillStyle = `rgba(255,200,80,${0.12 * k})`; ctx.beginPath(); ctx.arc(lu.x, lu.y, 40 * wob, 0, TAU); ctx.fill();
      shadedEllipse(ctx, lu.x, lu.y, 6 * wob * k + 1, 5 * wob * k + 1, ['#ffe090', '#e8a020', '#8a5008'], LIGHT);
      ctx.fillStyle = 'rgba(255,255,240,0.8)'; ctx.beginPath(); ctx.arc(lu.x - 2, lu.y - 2, 1.5, 0, TAU); ctx.fill();
    }
    for (const o of this.home.outposts) if (this.inView(o)) drawOutpost(ctx, o, t);
    for (const col of this.activeColonies) {
      if (col.isPlayer || !this.inView(col) || col.hp >= col.maxHp) continue;
      const k = 1 - col.hp / col.maxHp;
      ctx.fillStyle = `rgba(30,15,5,${0.5 * k})`;
      ctx.beginPath(); ctx.arc(col.x, col.y, 30 + 50 * k, 0, TAU); ctx.fill();
    }

    for (const ev of this.events) {
      if (ev.kind === 'picnic' && this.inView(ev, 200)) drawPicnic(ctx, ev, t);
      else if (ev.kind === 'swarm' && this.inView(ev, 200)) {
        // the exit holes the workers opened for the flight, with a ring of fresh soil
        const a = ev.fade ?? 1;
        ctx.globalAlpha = a;
        for (const h of ev.holes) {
          const R = mulberry32((h.x * 13 + h.y) | 0);
          for (let i = 0; i < 26; i++) { const aa = R() * TAU, d = 5 + R() * 7; soilGrain(ctx, h.x + Math.cos(aa) * d, h.y + Math.sin(aa) * d, 0.8 + R() * 1.2, ['#8a6a48', '#6a4a2a', '#a88458'][(R() * 3) | 0], R() * 3); }
          antHole(ctx, h.x, h.y, 4);
        }
        ctx.globalAlpha = 1;
      }
    }
    if (this.wingLitter && this.wingLitter.length) {
      const v = this.view4;
      this.wingLitter = this.wingLitter.filter((w) => this.time - w.t < 60);
      for (const w of this.wingLitter) if (w.x > v.x0 - 30 && w.x < v.x1 + 30 && w.y > v.y0 - 30 && w.y < v.y1 + 30) drawShedWing(ctx, w, Math.min(1, (60 - (this.time - w.t)) / 10));
    }
    for (const f of this.foods) if (this.inView(f)) drawFood(ctx, f, t);
    for (const p of this.activePatches) if (this.inView(p, 120)) for (const a of p.aphids) a.draw(ctx, t);
    for (const b of this.bigs) if (this.inView(b)) b.draw(ctx, t);

    const ground = this.critters.filter((c) => !c.flying && c.kind !== 'bird' && !(c.z > 2) && this.inView(c, 140));
    ground.sort((a, b) => a.r - b.r);
    let gi = 0;
    for (; gi < ground.length && ground[gi].r < 14; gi++) ground[gi].draw(ctx, t);
    for (const a of this.ants) if (!a.isPlayer && !a.inNest && this.inView(a)) a.draw(ctx, t);
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
    drawCanopies(ctx, this, t);
    this.renderCloudShadows(ctx, v, t);
    const pl = this.player;
    if (pl && !pl.dead && !pl.inNest) {
      for (const ev of this.events) {
        if (ev.kind !== 'picnic' || ev.fading) continue;
        const d = dist(pl.x, pl.y, ev.x, ev.y);
        if (d < 260) continue;
        const a = Math.atan2(ev.y - pl.y, ev.x - pl.x), bob = Math.sin(t * 4) * 3;
        ctx.save(); ctx.translate(pl.x + Math.cos(a) * (46 + bob), pl.y + Math.sin(a) * (46 + bob)); ctx.rotate(a);
        ctx.fillStyle = 'rgba(255,214,110,0.9)'; ctx.strokeStyle = 'rgba(60,40,10,0.6)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -7); ctx.lineTo(-2, 0); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
    }
    this.fx.draw(ctx);
    for (const f of this.flyers) if (this.inView(f, 160)) f.draw(ctx, t);
    for (const c of this.critters) if ((c.flying || c.z > 2) && c.kind !== 'bird' && this.inView(c, 160)) c.draw(ctx, t);
    for (const c of this.critters) if (c.kind === 'bird' && this.inView(c, 400)) c.draw(ctx, t);
    for (const f of this.fireflies) if (this.inView(f)) drawFireflyBody(ctx, f, t);

    this.gradeSeason();
    this.renderNight();
    this.renderRain();
    this.renderSeason();
  }

  /* Footprints in the snow: anything walking leaves a trail that slowly fills in. */
  updateTracks(dt) {
    const tr = this.tracks || (this.tracks = []);
    const snow = this.sw[3];
    if (snow < 0.3) { tr.length = 0; return; }
    this.trackAcc = (this.trackAcc || 0) + dt;
    while (tr.length && this.time - tr[0].t > 30) tr.shift();
    if (this.trackAcc < 0.12) return;
    this.trackAcc = 0;
    const cam = this.camera, R = 900 * 900;
    const add = (e, size, kind) => {
      if (e.dead || e.inNest || e.flying || (e.z || 0) > 2 || !(e.speedNow > 4) || dist2(e.x, e.y, cam.x, cam.y) > R) return;
      if (this.world.snowDepth(e.x, e.y) < 0.35 || this.world.waterAt(e.x, e.y)) return;
      tr.push({ x: e.x, y: e.y, a: e.a, t: this.time, s: size, k: kind, f: (e.trackF = !e.trackF) });
    };
    for (const a of this.ants) add(a, a.size, 'ant');
    for (const c of this.critters) add(c, c.size * (c.r > 20 ? 2.2 : c.r > 10 ? 1.4 : 1), c.r > 20 ? 'paw' : c.kind === 'snail' || c.kind === 'slug' || c.kind === 'worm' ? 'slide' : 'ant');
    if (tr.length > 3500) tr.splice(0, tr.length - 3500);
  }

  renderTracks(ctx) {
    const tr = this.tracks;
    if (!tr || !tr.length) return;
    const v = this.view4, snow = this.sw[3];
    for (const p of tr) {
      if (p.x < v.x0 || p.x > v.x1 || p.y < v.y0 || p.y > v.y1) continue;
      const age = (this.time - p.t) / 30, al = (1 - age) * snow;
      const c = Math.cos(p.a), s2 = Math.sin(p.a), side = p.f ? 1 : -1;
      if (p.k === 'slide') {
        ctx.fillStyle = `rgba(110,130,165,${0.22 * al})`;
        ctx.beginPath(); ctx.ellipse(p.x, p.y, 5 * p.s, 2.5 * p.s, p.a, 0, TAU); ctx.fill();
      } else if (p.k === 'paw') {
        const px = p.x - s2 * side * 6 * p.s, py = p.y + c * side * 6 * p.s;
        ctx.fillStyle = `rgba(100,120,160,${0.35 * al})`;
        ctx.beginPath(); ctx.ellipse(px, py, 3 * p.s, 2.4 * p.s, p.a, 0, TAU); ctx.fill();
        for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.arc(px + c * 4 * p.s - s2 * k * 2 * p.s, py + s2 * 4 * p.s + c * k * 2 * p.s, 1 * p.s, 0, TAU); ctx.fill(); }
      } else {
        // tiny paired dots from six little feet
        ctx.fillStyle = `rgba(95,115,155,${0.3 * al})`;
        for (let k = -1; k <= 1; k++) {
          const ox = c * k * 3 * p.s, oy = s2 * k * 3 * p.s;
          const lx = -s2 * side * 3.4 * p.s, ly = c * side * 3.4 * p.s;
          ctx.fillRect(p.x + ox + lx - 0.6, p.y + oy + ly - 0.6, 1.2, 1.2);
        }
      }
    }
  }

  /* Big soft cloud shadows drifting across the ground on sunny days. */
  renderCloudShadows(ctx, v, t) {
    const sun = 1 - Math.min(1, this.darkness() * 2.5) - this.weather.k * 0.8;
    if (sun <= 0.05) return;
    const S = 1400, ox = t * 22, oy = t * 9;
    const gx0 = Math.floor((v.x0 - ox - 500) / S), gx1 = Math.floor((v.x1 - ox + 500) / S);
    const gy0 = Math.floor((v.y0 - oy - 500) / S), gy1 = Math.floor((v.y1 - oy + 500) / S);
    for (let gx = gx0; gx <= gx1; gx++) for (let gy = gy0; gy <= gy1; gy++) {
      const R = mulberry32(hashInt(gx, gy, 777));
      if (R() < 0.35) continue;
      const cx = gx * S + R() * S + ox, cy = gy * S + R() * S + oy;
      for (let k = 0; k < 4; k++) {
        const px = cx + (R() - 0.5) * 380, py = cy + (R() - 0.5) * 220, r = 160 + R() * 200;
        if (px + r < v.x0 || px - r > v.x1 || py + r < v.y0 || py - r > v.y1) continue;
        const gr = ctx.createRadialGradient(px, py, 0, px, py, r);
        gr.addColorStop(0, `rgba(20,30,50,${0.13 * sun})`); gr.addColorStop(0.6, `rgba(20,30,50,${0.09 * sun})`); gr.addColorStop(1, 'rgba(20,30,50,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fill();
      }
    }
  }

  /* Colour grading per season, blended by how much of each season is showing. */
  gradeSeason() {
    const ctx = this.ctx, w = this.sw;
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const pass = (op, col, a) => { if (a < 0.005) return; ctx.globalCompositeOperation = op; ctx.globalAlpha = a; ctx.fillStyle = col; ctx.fillRect(0, 0, this.vw, this.vh); };
    pass('soft-light', '#b4ff8c', 0.22 * w[0]);
    pass('soft-light', '#ffd270', 0.3 * w[1]);
    pass('saturation', '#808080', 0.18 * w[2]);
    pass('soft-light', '#ff7a1e', 0.42 * w[2]);
    pass('multiply', '#ffe2c0', 0.25 * w[2]);
    pass('saturation', '#808080', 0.45 * w[3]);
    pass('screen', '#b4c8e4', 0.12 * w[3]);
    pass('soft-light', '#dce8ff', 0.22 * w[3]);
    ctx.restore();
  }

  renderSeason() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    for (const fl of this.leafFall) {
      ctx.save(); ctx.translate(fl.x, fl.y); ctx.rotate(this.time * 2 + fl.p);
      ctx.scale(1, 0.4 + 0.6 * Math.abs(Math.sin(this.time * 3 + fl.p)));
      ctx.fillStyle = fl.c; ctx.beginPath(); ctx.ellipse(0, 0, 5, 2.4, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
    if (this.flakes.length) {
      // soft round flakes: near ones big and blurred, far ones small and sharp
      if (!this.flakeSpr) {
        const c = document.createElement('canvas'); c.width = c.height = 32;
        const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
        gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(235,242,255,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
        this.flakeSpr = c;
      }
      for (const fl of this.flakes) {
        const r = fl.r * 2.2 * (0.85 + 0.15 * Math.sin(this.time * 3 + fl.p));
        ctx.globalAlpha = fl.z > 1.1 ? 0.6 : 0.9;
        ctx.drawImage(this.flakeSpr, fl.x - r, fl.y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
    }
  }

  renderRain() {
    const k = this.weather.k;
    if (k < 0.02) return;
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = `rgba(40,60,80,${0.16 * k})`;
    ctx.fillRect(0, 0, this.vw, this.vh);
    if (this.sw[3] > 0.5) return;
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
    if (!w || !h || !this.vw || !this.vh) return;
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
