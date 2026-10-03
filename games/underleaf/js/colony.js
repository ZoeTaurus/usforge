'use strict';
/* A colony: its nest, stores, brood and chambers. The player's colony raises
   brood through egg, larva and pupa; rival colonies hatch directly. */

const QUEEN_RATE = [99, 4, 2.6, 1.6];
const BROOD_CAP = [0, 4, 8, 14];
const BROOD_SPEED = [1, 1, 1.4, 1.8];
const FOOD_CAP = [0, 60, 150, 320];
const FUNGUS_RATE = [0, 1, 1.6, 2.4];

const CHAMBERS = {
  royal: { name: 'Royal chamber', max: 3, cost: [0, 45, 100], desc: (l) => `The queen can lay an egg every ${QUEEN_RATE[l]} seconds.` },
  nursery: { name: 'Nursery', max: 3, cost: [0, 30, 75], desc: (l) => `Holds ${BROOD_CAP[l]} eggs, larvae and pupae, growing ${['', 'at the normal rate', '40% faster', '80% faster'][l]}.` },
  granary: { name: 'Granary', max: 3, cost: [0, 25, 70], desc: (l) => `Stores up to ${FOOD_CAP[l]} food.` },
  barracks: { name: 'Barracks', max: 3, cost: [35, 70, 120], desc: (l) => (l ? `New soldiers hatch ${l * 25}% stronger.` : 'Dig it to raise stronger soldiers.') },
  infirmary: { name: 'Infirmary', max: 2, cost: [30, 80], desc: (l) => (l ? `You heal ${l + 1}× faster near home and wake ${l}s sooner after falling.` : 'Dig it to heal faster near home.') },
  fungus: { name: 'Fungus garden', max: 3, cost: [0, 40, 90], desc: (l) => `Turns ${FUNGUS_RATE[l]} leaf fragments into food every 3 seconds.` },
  midden: { name: 'Midden', max: 2, cost: [30, 70], desc: (l) => (l ? `Waste is cleared away, so the colony eats ${l * 15}% less to stay healthy.` : 'Dig a refuse chamber so the colony eats less to stay healthy.') },
  winter: { name: 'Overwintering hall', max: 2, cost: [50, 110], desc: (l) => (l ? `Sisters huddle together in winter, cutting winter food use by ${l * 30}%.` : 'Dig a deep hall where the colony huddles through winter.') },
  honeypot: { name: 'Honeypot gallery', max: 2, cost: [40, 90], desc: (l) => (l ? `Living honeypot ants hold an extra ${l * 100} food that raiders cannot steal.` : 'Dig it to store more food, safe from raiders.') },
};

let COLONY_IDX = 0;

class Colony {
  constructor(game, id, species, x, y, isPlayer) {
    this.game = game; this.id = id; this.idx = COLONY_IDX++;
    this.species = species; this.sp = ANT_SPECIES[species]; this.isPlayer = isPlayer;
    this.kind = 'nest'; this.team = id; this.x = x; this.y = y; this.r = 36;
    this.nest = { x, y, r: 72 };
    this.trail = this.sp.trail;
    this.food = isPlayer ? 16 : 10; this.leaves = 0; this.brood = []; this.queenCd = 0; this.fungusT = 0; this.autoT = 0;
    this.chambers = { royal: 1, nursery: 1, granary: 1, barracks: 0, infirmary: 0, fungus: species === 'leafcutter' ? 1 : 0, honeypot: 0, midden: 0, winter: 0 };
    this.autoHatch = true;
    this.maxHp = this.hp = 420 + Math.random() * 200;
    this.dead = false; this.hurtT = 0; this.alarmCd = 0;
    this.active = isPlayer;
    this.pop = { worker: randi(12, 20), soldier: randi(3, 6) };
    this.raidT = rand(140, 220); this.hatchCd = 0; this.growT = 0; this.born = 0;
    this.outposts = [];
    this.dangers = []; this.beacon = null; this.starveT = 0;
    // the colony's shared knowledge: where food is, which directions have been explored, who needs help
    this.sites = []; this.sectors = new Array(16).fill(-999); this.calls = []; this.refuse = [];
    this.brainT = rand(1); this.tasks = { forage: 0, scout: 0, herd: 0, rest: 0 };
    this.midden = this.findMidden(x, y);
  }

  findMidden(x, y) {
    const base = hash01(Math.round(x), Math.round(y), 5) * TAU;
    for (let k = 0; k < 8; k++) {
      const a = base + k * 0.8, mx = x + Math.cos(a) * 190, my = y + Math.sin(a) * 190;
      if (!this.game.world || !this.game.world.wetAt(mx, my)) return { x: mx, y: my, r: 40 };
    }
    return { x: x + 190, y, r: 40 };
  }

  /* ---------------------------------------------------- shared knowledge */

  /* A forager back from a find tells the colony: merge it with a known site or add a new one. */
  report(x, y, n, big = false, value = 1) {
    const now = this.game.time;
    for (const st of this.sites) {
      if (dist2(x, y, st.x, st.y) < 70 * 70) { st.n = Math.max(st.n * 0.5, n); st.t = now; st.big = st.big || big; st.v = Math.max(st.v || 1, value); return st; }
    }
    const st = { x, y, n, t: now, big, v: value, id: UID++ };
    this.sites.push(st);
    if (this.sites.length > 18) this.sites.sort((a, b) => b.t - a.t).length = 18;
    return st;
  }
  depleted(st) { st.n = 0; this.sites = this.sites.filter((x) => x !== st); }
  siteAt(x, y) {
    for (const st of this.sites) if (dist2(x, y, st.x, st.y) < 80 * 80) return st;
    return null;
  }

  /* Pick a food site worth walking to: rich, close, safe and not already crowded. */
  siteFor(ant) {
    let best = null, bs = 0;
    for (const st of this.sites) {
      if (this.dangerNear(st.x, st.y, 120)) continue;
      const d = dist(this.nest.x, this.nest.y, st.x, st.y);
      const crowd = st.assigned || 0;
      if (crowd >= (st.big ? st.n + 4 : st.n)) continue;
      const score = ((st.n + 1) * (st.v || 1) * (st.big ? 3 : 1)) / (d + 250) / (1 + crowd * 0.35) * (0.7 + Math.random() * 0.6);
      if (score > bs) { bs = score; best = st; }
    }
    if (best) best.assigned = (best.assigned || 0) + 1;
    return best;
  }

  /* The least recently explored direction around the nest. */
  pickSector() {
    const now = this.game.time;
    let best = 0, bs = -1;
    for (let i = 0; i < 16; i++) {
      const s = (now - this.sectors[i]) * (0.6 + Math.random() * 0.8);
      if (s > bs) { bs = s; best = i; }
    }
    this.sectors[best] = now;
    return best;
  }

  callHelp(target) {
    if (!target || target.dead) return;
    const now = this.game.time;
    for (const c of this.calls) if (c.target === target) { c.t = now; c.x = target.x; c.y = target.y; return; }
    this.calls.push({ target, x: target.x, y: target.y, t: now });
  }
  callFor(ant) {
    let best = null, bd = 800 * 800;
    for (const c of this.calls) {
      if (c.target.dead || c.target.invuln) continue;
      const d = dist2(ant.x, ant.y, c.target.x, c.target.y);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  /* Fighting strength of this colony's ants around a point (soldiers count more). */
  strengthNear(x, y, r) {
    let s = 0;
    this.game.hash.query(x, y, r, (o) => {
      if (o.kind !== 'ant' || o.colony !== this || o.dead || dist2(x, y, o.x, o.y) > r * r) return;
      s += o.isPlayer ? 3 : o.role === 'soldier' ? 2.5 : 1;
    });
    return s;
  }
  attackersOn(t) {
    let n = 0;
    this.game.hash.query(t.x, t.y, (t.r || 10) + 30, (o) => { if (o.kind === 'ant' && o.colony === this && o.target === t && o.state === 'fight') n++; });
    return n;
  }

  patchFor(ant) {
    let best = null, bd = 900 * 900;
    for (const p of this.game.activePatches) {
      const d = dist2(this.nest.x, this.nest.y, p.x, p.y);
      if (d < bd && p.aphids.length && !this.dangerNear(p.x, p.y, 100)) { bd = d; best = p; }
    }
    return best;
  }

  addRefuse(f, x, y) {
    f.x = x; f.y = y; f.refuse = true; f.colony = this;
    this.game.addFood(f);
    this.refuse.push(f);
    if (this.refuse.length > 20) this.refuse.shift().taken = true;
  }

  /* --------------------------------------------------------- the brain */

  /* Every second or so, decide how many workers should forage, scout, herd aphids or rest,
     and nudge a few idle ants into the jobs that are short-handed. Real colonies do this
     without a boss: each ant reacts to what it meets. This is a simplified stand-in. */
  brain(dt) {
    this.brainT -= dt;
    if (this.brainT > 0) return;
    this.brainT = 1.2;
    const g = this.game, now = g.time;
    this.sites = this.sites.filter((st) => now - st.t < 120 && st.n > 0);
    this.calls = this.calls.filter((c) => !c.target.dead && now - c.t < 14);
    for (const st of this.sites) st.assigned = 0;
    const workers = [];
    for (const a of g.ants) {
      if (a.colony !== this || a.dead || a.isPlayer || a.role !== 'worker') continue;
      workers.push(a);
      if (a.site && a.site.assigned !== undefined) a.site.assigned++;
    }
    if (!workers.length) return;
    const n = workers.length;
    const winter = g.sw ? g.sw[3] : 0, night = g.darkness() > 0.35;
    const hungry = this.isPlayer && this.food < (this.upkeep || 1) * 2 && winter < 0.6;
    // sleep at night and through winter; shelter from heavy rain, as real foragers do
    const rain = winter < 0.5 ? g.weather.k : 0;
    let restF = clamp(winter * 0.75 + (night ? 0.35 : 0) + rain * 0.3, 0, 0.85);
    // raise the alarm if enemies are close to the nest
    this.alertT = Math.max(0, (this.alertT || 0) - 1.2);
    let threats = 0;
    g.hash.query(this.nest.x, this.nest.y, 320, (o) => {
      if (o.dead || o.invuln || o.flying) return;
      if ((o.kind === 'ant' && o.colony !== this) || o.predator) {
        if (dist2(o.x, o.y, this.nest.x, this.nest.y) > 320 * 320) return;
        threats++;
        if (threats <= 3) this.callHelp(o);
      }
    });
    if (threats) this.alertT = 8;
    if (this.alertT > 0) restF *= 0.2;
    if (hungry) restF *= 0.3;
    const want = {
      rest: Math.round(n * restF),
      scout: Math.max(1, Math.round(n * (this.sites.length ? 0.1 : 0.22) * (1 - restF))),
      herd: HERDERS.has(this.species) && winter < 0.5 && !night ? Math.min(6, (this.patchFor(null) ? 2 : 0) + (this.patchFor(null) && n > 20 ? 2 : 0)) : 0,
    };
    const have = { forage: [], scout: [], herd: [], rest: [] };
    for (const a of workers) (have[a.task] || have.forage).push(a);
    this.tasks = { forage: have.forage.length, scout: have.scout.length, herd: have.herd.length, rest: have.rest.length };
    const free = (a) => a.followT <= 0 && !a.carry && !a.big && !a.trapped && (a.state === 'forage' || a.state === 'scout' || a.state === 'herd' || a.state === 'rest' || a.state === 'greet');
    const assign = (a, task) => {
      if (a.task === 'rest' && a.inNest) { a.inNest = false; a.x = this.nest.x + rand(-12, 12); a.y = this.nest.y + rand(-12, 12); a.a = rand(TAU); }
      a.task = task; a.site = null; a.scoutGoal = null; a.patch = null;
      if (free(a) || a.inNest) a.state = a.defaultState();
    };
    // wake sleepers first if fewer should be resting, then fill the other jobs from foragers
    let moves = Math.max(2, Math.round(n * 0.15));
    while (have.rest.length > want.rest && moves-- > 0) assign(have.rest.pop(), 'forage');
    for (const task of ['rest', 'scout', 'herd']) {
      while (have[task].length > want[task] && moves-- > 0) { const a = have[task].pop(); assign(a, 'forage'); have.forage.push(a); }
      while (have[task].length < want[task] && moves-- > 0) {
        const i = have.forage.findIndex(free);
        if (i < 0) break;
        const a = have.forage.splice(i, 1)[0];
        assign(a, task); have[task].push(a);
      }
    }
  }

  addDanger(x, y) {
    const now = this.game.time;
    for (const d of this.dangers) if (dist2(x, y, d.x, d.y) < 90 * 90) { d.t = now; d.x = lerp(d.x, x, 0.3); d.y = lerp(d.y, y, 0.3); return; }
    this.dangers.push({ x, y, t: now });
    if (this.dangers.length > 12) this.dangers.shift();
  }
  dangerNear(x, y, r) {
    const now = this.game.time;
    for (const d of this.dangers) if (now - d.t < 40 && dist2(x, y, d.x, d.y) < r * r) return d;
    return null;
  }

  get special() { return this.species === 'leafcutter' ? 'fungus' : 'honeypot'; }
  get foodCap() { return FOOD_CAP[this.chambers.granary] + this.chambers.honeypot * 100 + (this.species === 'honeypot' ? 80 : 0); }
  get safeFood() { return this.chambers.honeypot * 100; }
  get invuln() { return this.isPlayer || this.dead; }
  get name() { return `${this.sp.name} ${this.sp.nest === 'leafball' ? 'nest' : 'mound'}`; }

  dropPoints() { return this.outposts.length ? [this.nest, ...this.outposts] : [this.nest]; }
  dropPoint(x, y) {
    if (!this.outposts.length) return this.nest;
    let best = this.nest, bd = dist2(x, y, this.nest.x, this.nest.y);
    for (const o of this.outposts) { const d = dist2(x, y, o.x, o.y); if (d < bd) { bd = d; best = o; } }
    return best;
  }
  costOf(role) { return role === 'soldier' ? this.sp.costS : this.sp.costW; }

  addFood(v) {
    const before = this.food;
    this.food = Math.min(this.isPlayer ? this.foodCap : 999, this.food + v);
    return this.food - before;
  }

  layBlocker(role) {
    if (this.food < this.costOf(role)) return `Not enough food. A ${role} egg costs ${this.costOf(role)}.`;
    if (this.brood.length >= BROOD_CAP[this.chambers.nursery]) return 'The nursery is full. Wait for brood to hatch, or enlarge the nursery.';
    if (this.queenCd > 0) return 'The queen is resting between eggs.';
    if (this.game.counts.home >= 160) return 'The nest is crowded. It cannot hold more ants.';
    return null;
  }
  lay(role) {
    if (this.layBlocker(role)) return false;
    this.food -= this.costOf(role);
    this.brood.push({ role, t: 0, stage: 'egg', id: UID++ });
    this.queenCd = QUEEN_RATE[this.chambers.royal];
    if (this.isPlayer && this.game.view === 'nest') SFX.egg();
    return true;
  }

  upgradeCost(key) {
    const l = this.chambers[key], c = CHAMBERS[key];
    return l >= c.max ? null : c.cost[l];
  }
  upgrade(key) {
    const cost = this.upgradeCost(key);
    if (cost === null || this.food < cost) return false;
    this.food -= cost;
    this.chambers[key]++;
    return true;
  }

  update(dt) {
    if (this.dead) return;
    this.hurtT -= dt; this.alarmCd -= dt;
    const g = this.game;
    if (this.isPlayer || this.active) this.brain(dt);
    if (this.isPlayer) {
      this.queenCd -= dt;
      const speed = BROOD_SPEED[this.chambers.nursery];
      for (const b of this.brood) {
        b.t += dt * speed;
        b.stage = b.t < 5 ? 'egg' : b.t < 12 ? 'larva' : 'pupa';
      }
      const ready = this.brood.filter((b) => b.t >= 18);
      if (ready.length) {
        this.brood = this.brood.filter((b) => b.t < 18);
        for (const b of ready) g.hatchAnt(this, b.role);
      }
      // The queen only lays on her own when the stores are well stocked, and not too often,
      // so food can build up for digging chambers. Never while the player is planning inside the nest.
      this.autoT -= dt;
      const reserve = Math.max(this.costOf('worker') + 15, Math.round(this.foodCap * 0.6));
      if (this.autoHatch && this.autoT <= 0 && g.view !== 'nest' && this.food >= reserve && !this.layBlocker('worker')) {
        this.lay('worker');
        this.autoT = 12;
      }
      // the colony eats from its stores: more ants, more food; winter is hungrier
      const ww = g.sw ? g.sw[3] : 0;
      const winterK = 1 + ww * (1.6 * (1 - this.chambers.winter * 0.3) - 1);
      const eat = g.counts.home * 0.0028 * winterK * (1 - this.chambers.midden * 0.15);
      this.upkeep = eat * 60;
      this.food = Math.max(0, this.food - eat * dt);
      if (this.food <= 0 && g.counts.home > 1) {
        this.starveT += dt;
        if (this.starveT > 12) { this.starveT = 0; g.onStarve(); }
      } else this.starveT = 0;
      if (this.chambers.fungus && this.leaves > 0) {
        this.fungusT += dt;
        if (this.fungusT >= 3) {
          this.fungusT = 0;
          const n = Math.min(this.leaves, FUNGUS_RATE[this.chambers.fungus]);
          this.leaves -= n;
          this.addFood(n * 2);
        }
      }
    } else if (this.active) {
      this.hatchCd -= dt;
      this.hp = Math.min(this.maxHp, this.hp + 1.2 * dt);
      const cost = 8;
      if (this.food >= cost && this.hatchCd <= 0 && g.countColony(this) < 55) {
        this.food -= cost; this.born++;
        g.hatchAnt(this, this.born % 4 === 3 ? 'soldier' : 'worker');
        this.hatchCd = 3;
      }
    } else {
      this.growT += dt;
      if (this.growT > 50) { this.growT = 0; if (this.pop.worker < 28) this.pop.worker++; }
    }
  }

  damage(amt, src) {
    if (this.invuln) return;
    this.hp -= amt; this.hurtT = 0.15;
    this.game.fx.dust(this.x + rand(-24, 24), this.y + rand(-24, 24), 2);
    if (this.alarmCd <= 0) { this.alarmCd = 1; this.game.alarm(this, src, 420); }
    if (this.hp <= 0) { this.hp = 0; this.dead = true; this.game.onNestDestroyed(this, src); }
  }
}

const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'];
const SEASON_NEWS = [
  'Spring. Flowers open and the meadow wakes up.',
  'Summer. Insects everywhere: the best time to grow the colony.',
  'Autumn. Berries ripen and oaks drop acorns. Store food for winter.',
  'Winter. Food is scarce and the colony eats more. Live off your stores.',
];
