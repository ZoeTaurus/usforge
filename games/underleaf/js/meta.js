'use strict';
/* Progress that lasts across colonies: achievements, records, lifetime totals
   and every creature you have ever found. Stored in this browser only. */

const META_KEY = 'underleaf-meta-v1';

const ACHIEVEMENTS = [
  { id: 'firstCrumb', name: 'First crumb', desc: 'Carry your first bit of food home.', icon: 'ant:garden', test: (m) => m.t.playerLoads >= 1 },
  { id: 'forager', name: 'Forager', desc: 'Carry 50 loads home yourself, across all colonies.', icon: 'ant:garden', test: (m) => m.t.playerLoads >= 50, prog: (m) => [m.t.playerLoads, 50] },
  { id: 'granary', name: 'Full granary', desc: 'Your colonies store 1,000 loads of food in total.', icon: 'plant:sunflower', test: (m) => m.t.colonyLoads >= 1000, prog: (m) => [m.t.colonyLoads, 1000] },
  { id: 'teamwork', name: 'Teamwork', desc: 'Haul a big prize home as a team.', icon: 'caterpillar', test: (m) => m.t.bigHauls >= 1 },
  { id: 'feast', name: 'Giant feast', desc: 'Haul home a prize worth 50 food or more.', icon: 'crab', test: (m) => m.r.biggestHaul >= 50 },
  { id: 'rally', name: 'Rally cry', desc: 'Rally 10 sisters at once.', icon: 'ant:wood', test: (m) => m.r.bestRally >= 10 },
  { id: 'herder', name: 'Aphid herder', desc: 'Milk 10 aphids for honeydew.', icon: 'aphid', test: (m) => m.t.honey >= 10, prog: (m) => [m.t.honey, 10] },
  { id: 'digger', name: 'Digger', desc: 'Dig or enlarge 3 chambers in one colony.', icon: 'worm', test: (m) => m.r.chambersDug >= 3 },
  { id: 'architect', name: 'Architect', desc: 'Dig or enlarge 12 chambers in one colony.', icon: 'worm', test: (m) => m.r.chambersDug >= 12 },
  { id: 'growing', name: 'Growing family', desc: 'Raise a colony of 40 ants.', icon: 'ant:fire', test: (m) => m.r.biggestColony >= 40 },
  { id: 'metropolis', name: 'Metropolis', desc: 'Raise a colony of 100 ants.', icon: 'ant:leafcutter', test: (m) => m.r.biggestColony >= 100 },
  { id: 'explorer', name: 'Explorer', desc: 'Visit all five kinds of land in one colony.', icon: 'butterfly', test: (m) => m.r.biomes >= 5 },
  { id: 'longWalk', name: 'Long walk', desc: 'Travel 10,000 steps away from home.', icon: 'dragonfly', test: (m) => m.r.farthest >= 10000 },
  { id: 'winter', name: 'Survivor', desc: 'Get a colony through its first winter.', icon: 'plant:pine', test: (m) => m.r.mostDays >= 4 },
  { id: 'oldTimer', name: 'Old timer', desc: 'Keep a colony going for three years.', icon: 'plant:oak', test: (m) => m.r.mostDays >= 12 },
  { id: 'longLife', name: 'Long life', desc: 'Survive 10 minutes as a single ant.', icon: 'ant:bullet', test: (m) => m.r.longestLife >= 600 },
  { id: 'veteran', name: 'Veteran', desc: 'Reach level 10.', icon: 'ant:trapjaw', test: (m) => m.r.highestLevel >= 10 },
  { id: 'spider', name: 'Spider slayer', desc: 'Bring down a wolf spider.', icon: 'spider', test: (m) => (m.kills.spider || 0) >= 1 },
  { id: 'crab', name: 'Crab cracker', desc: 'Bring down a shore crab.', icon: 'crab', test: (m) => (m.kills.crab || 0) >= 1 },
  { id: 'hedgehog', name: 'Giant killer', desc: 'Bring down a hedgehog.', icon: 'hedgehog', test: (m) => (m.kills.hedgehog || 0) >= 1 },
  { id: 'termites', name: 'Termite raider', desc: 'Your colonies catch 50 termites.', icon: 'termite', test: (m) => (m.kills.termite || 0) >= 50, prog: (m) => [m.kills.termite || 0, 50] },
  { id: 'conqueror', name: 'Conqueror', desc: 'Topple 3 rival ant nests.', icon: 'ant:wood', test: (m) => m.t.nests >= 3, prog: (m) => [m.t.nests, 3] },
  { id: 'robin', name: 'Bird scarer', desc: 'Drive a diving robin away.', icon: 'bird', test: (m) => m.t.robins >= 1 },
  { id: 'escape', name: 'Escape artist', desc: 'Climb out of an antlion pit or sundew.', icon: 'antlion', test: (m) => m.t.escapes >= 1 },
  { id: 'naturalist', name: 'Naturalist', desc: 'Find 25 creatures and plants for the field guide.', icon: 'ladybug', test: (m) => m.guide.size >= 25, prog: (m) => [m.guide.size, 25] },
  { id: 'encyclopedia', name: 'Encyclopedia', desc: 'Fill every page of the field guide.', icon: 'firefly', test: (m) => m.guide.size >= GUIDE.length, prog: (m) => [m.guide.size, GUIDE.length] },
  { id: 'allSpecies', name: 'Six legs, six lives', desc: 'Found a colony with every playable species.', icon: 'ant:weaver', test: (m) => PLAYABLE.every((k) => m.played.has(k)), prog: (m) => [PLAYABLE.filter((k) => m.played.has(k)).length, PLAYABLE.length] },
];

class Meta {
  constructor() {
    this.t = { playerLoads: 0, colonyLoads: 0, bigHauls: 0, honey: 0, nests: 0, robins: 0, escapes: 0, colonies: 0, antsRaised: 0, lives: 0 };
    this.r = { biggestHaul: 0, bestRally: 0, chambersDug: 0, biggestColony: 0, biomes: 0, farthest: 0, mostDays: 0, longestLife: 0, highestLevel: 1 };
    this.kills = {};
    this.unlocked = {};
    this.guide = new Set();
    this.played = new Set();
    this.load();
  }
  load() {
    try {
      const d = JSON.parse(localStorage.getItem(META_KEY) || 'null');
      if (!d) return;
      Object.assign(this.t, d.t); Object.assign(this.r, d.r); Object.assign(this.kills, d.kills);
      this.unlocked = d.unlocked || {};
      this.guide = new Set(d.guide || []); this.played = new Set(d.played || []);
    } catch (e) { /* storage may be unavailable */ }
  }
  save() {
    try {
      localStorage.setItem(META_KEY, JSON.stringify({ t: this.t, r: this.r, kills: this.kills, unlocked: this.unlocked, guide: [...this.guide], played: [...this.played] }));
    } catch (e) { /* ignore */ }
  }
  add(key, n = 1) { this.t[key] = (this.t[key] || 0) + n; this.dirty = true; }
  best(key, v) { if (v > (this.r[key] || 0)) { this.r[key] = v; this.dirty = true; } }
  kill(kind) { this.kills[kind] = (this.kills[kind] || 0) + 1; this.dirty = true; }
  /* Returns achievements that were just earned. */
  check() {
    const fresh = [];
    for (const a of ACHIEVEMENTS) {
      if (this.unlocked[a.id] || !a.test(this)) continue;
      this.unlocked[a.id] = Date.now();
      fresh.push(a);
    }
    if (fresh.length || this.dirty) { this.dirty = false; this.save(); }
    return fresh;
  }
}

const META = new Meta();
