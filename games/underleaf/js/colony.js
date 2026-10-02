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
  get foodCap() { return FOOD_CAP[this.chambers.granary] + this.chambers.honeypot * 100; }
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
      const season = g.season;
      const winterK = season === 3 ? 1.6 * (1 - this.chambers.winter * 0.3) : 1;
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
