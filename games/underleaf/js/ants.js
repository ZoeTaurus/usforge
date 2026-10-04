'use strict';
/* Ants. Each colony runs a small brain (colony.js) that splits its workers between
   foraging, scouting, herding aphids and resting, and keeps a shared memory of food
   sites, dangers and calls for help. Each ant acts on that knowledge:
   - foragers walk to known food sites and report how much is left when they get home;
   - scouts explore the least-visited directions and report new finds;
   - herders tend the nearest aphid patch and guard it;
   - resters sleep inside the nest at night and through winter;
   - everyone sizes up a fight before joining it, spreads out around big prey,
     calls soldiers for help, and carries dead nestmates to the refuse pile. */

const ANT_STATS = {
  worker: { size: 1, hp: 26, speed: 66, dmg: 4, bite: 0.55, sense: 95 },
  soldier: { size: 1.32, hp: 64, speed: 58, dmg: 9, bite: 0.6, sense: 170 },
  player: { size: 1.14, hp: 55, speed: 108, dmg: 8, bite: 0.32, sense: 0 },
};
const HERDERS = new Set(['garden', 'fire', 'weaver', 'wood', 'honeypot', 'carpenter']);

/* How many sisters may pile onto one target before the rest pick another. */
function attackCap(o) {
  if (o.kind === 'ant') return 3;
  if (o.kind === 'nest') return 16;
  return o.r > 18 ? 10 : o.r > 9 ? 5 : 2;
}

class Ant {
  constructor(game, colony, x, y, role = 'worker') {
    this.game = game; this.id = UID++; this.kind = 'ant';
    this.colony = colony; this.team = colony.id; this.sp = colony.species; this.role = role;
    this.isPlayer = false;
    this.x = x; this.y = y; this.a = rand(TAU);
    this.applyStats(role, true);
    this.hp = this.maxHp;
    this.task = role === 'soldier' ? 'guard' : 'forage';
    this.state = role === 'soldier' ? 'guard' : 'forage'; this.prevState = null;
    this.carry = null; this.big = null; this.memory = null; this.pickSpot = null; this.target = null; this.partner = null;
    this.site = null; this.scoutGoal = null; this.legs = 0; this.patch = null; this.toMidden = false; this.reportN = 0;
    this.answering = false; this.raidTarget = null; this.escort = null;
    this.think = rand(0.3); this.biteCd = 0; this.biteT = 0; this.greetCd = rand(1, 4); this.greetT = 0; this.hurtT = 0;
    this.gait = rand(TAU); this.wander = 0; this.followT = 0; this.slot = rand(TAU); this.timer = 0;
    this.trapped = null; this.escape = 0; this.pitImmune = 0; this.rescueCall = 0;
    this.speedNow = 0; this.slow = 1; this.travel = 0; this.alarmCd = 0;
    this.careless = Math.random() < 0.12; this.raider = false; this.dead = false;
    this.lastTarget = null; this.lastTargetT = 0; this.fleeFrom = null;
    this.swims = false; this.swimming = false; this.inNest = false; this.frenzyT = 0; this.gnawT = 0;
  }

  applyStats(role, jitter) {
    const sp = ANT_SPECIES[this.sp], st = ANT_STATS[role];
    const barracks = role === 'soldier' && this.colony.isPlayer ? 1 + this.colony.chambers.barracks * 0.25 : 1;
    this.size = st.size * sp.shape.size;
    this.r = 6 * this.size;
    this.maxHp = st.hp * sp.stats.hp * barracks;
    this.baseSpeed = st.speed * sp.stats.speed * (jitter ? rand(0.92, 1.08) : 1);
    this.dmg = st.dmg * sp.stats.dmg * barracks;
    this.biteRate = st.bite; this.sense = st.sense;
  }

  makePlayer(level = 1, perks = {}) {
    this.leaveBig(); this.releaseClaim();
    if (this.inNest) { this.inNest = false; this.x = this.colony.nest.x + 24; this.y = this.colony.nest.y + 18; }
    this.isPlayer = true; this.role = 'worker'; this.task = 'forage';
    this.refreshPlayer(level, perks);
    this.hp = this.maxHp; this.state = 'player'; this.target = null; this.followT = 0; this.raider = false;
    this.swims = !!ANT_SPECIES[this.sp].swims;
    this.dodgeT = 0; this.dashT = 0;
  }

  /* The player's stats come from species, level and chosen perks. */
  refreshPlayer(level, perks = {}) {
    this.applyStats('player', false);
    const k = 1 + (level - 1) * 0.08;
    this.maxHp *= k * (1 + 0.2 * (perks.armour || 0));
    this.dmg *= k * (1 + 0.2 * (perks.jaws || 0));
    this.baseSpeed *= 1 + 0.1 * (perks.legs || 0);
  }

  get nest() { return this.colony.nest; }
  get invuln() { return this.inNest; }

  hostileTo(o) {
    if (o === this || o.dead) return false;
    if (o.kind === 'ant') return o.colony !== this.colony && !o.inNest;
    if (o.kind === 'nest') return o !== this.colony && !o.dead;
    if (o.invuln || o.flying) return false;
    if (o.predator) return true;
    if (o.kind === 'termite' || o.kind === 'alate') return true;
    if (o.kind === 'ladybug') return HERDERS.has(this.sp) && o.nearPatch;
    if (o.prey || o.kind === 'caterpillar') return this.role === 'soldier' || (o.angryT > 0 && o.angryTeam === this.team);
    return o.angryT > 0 && o.angryTeam === this.team;
  }

  /* ------------------------------------------------------------- loop */

  update(dt) {
    if (this.dead) return;
    this.biteCd -= dt; this.biteT -= dt; this.hurtT -= dt; this.greetCd -= dt; this.greetT -= dt; this.frenzyT -= dt;
    this.alarmCd -= dt; this.pitImmune -= dt;
    if (this.followT > 0) this.followT -= dt;
    if (this.isPlayer) return;
    if (this.inNest) { this.hp = Math.min(this.maxHp, this.hp + dt * 3); return; }
    if (this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + dt * 0.4);
    if (this.trapped) {
      this.a += (Math.random() - 0.5) * dt * 14;
      this.gait += dt * 18; this.speedNow = 0;
      this.escape += dt * 0.06;
      return;
    }
    this.think -= dt;
    const think = this.think <= 0;
    if (think) {
      this.think = 0.2 + Math.random() * 0.15;
      this.slow = this.game.slimeAt(this.x, this.y) ? 0.55 : 1;
      if (!['carry', 'greet', 'milk', 'carried', 'medic', 'allogroom'].includes(this.state)) this.spaceOut();
      // idle ants pause to clean their antennae
      this.groomT = (this.groomT || 0) - 0.3;
      if (this.speedNow < 3 && this.groomT <= 0 && Math.random() < 0.12) { this.groomT = rand(1.2, 2.2); this.groomSide = Math.random() < 0.5 ? -1 : 1; }
      if (this.threat && (this.threat.dead || this.threat.invuln || dist2(this.x, this.y, this.threat.x, this.threat.y) > 260 * 260)) this.threat = null;
      // scatter from where a robin is about to land
      if (this.state !== 'carry' && this.state !== 'flee' && this.state !== 'carried') {
        for (const b of this.game.landings) {
          if (dist2(this.x, this.y, b.lx, b.ly) < 95 * 95) { this.startFlee({ x: b.lx, y: b.ly, predator: true }); break; }
        }
      }
      // badly hurt sisters go home to recover instead of fighting on
      if (this.hp < this.maxHp * 0.35 && ['forage', 'scout', 'herd', 'guard', 'fetch', 'flee', 'fight'].includes(this.state) && !(this.state === 'fight' && this.role === 'soldier' && this.hp > this.maxHp * 0.2)) {
        this.releaseClaim(); this.target = null; this.answering = false; this.state = 'heal';
      }
      // a free forager that finds a crippled sister picks her up and carries her home
      if ((this.state === 'forage' || this.state === 'scout') && !this.carry && !this.big && this.hp > this.maxHp * 0.6 && Math.random() < 0.25) {
        let pt = null;
        this.game.hash.query(this.x, this.y, 70, (o) => {
          if (!pt && o.kind === 'ant' && o !== this && o.colony === this.colony && !o.isPlayer && !o.dead && o.state === 'heal' && !o.carriedBy
            && o.hp < o.maxHp * 0.25 && o.size <= this.size * 1.3 && dist2(o.x, o.y, o.nest.x, o.nest.y) > 220 * 220) pt = o;
        });
        if (pt) { this.releaseClaim(); this.patient = pt; pt.carriedBy = this; pt.state = 'carried'; this.state = 'medic'; this.greetT = 0.6; }
      }
    }
    switch (this.state) {
      case 'forage': this.forage(dt, think); break;
      case 'scout': this.scout(dt, think); break;
      case 'herd': this.herd(dt, think); break;
      case 'rest': this.goRest(dt, think); break;
      case 'fetch': this.fetch(dt, think); break;
      case 'return': this.returnHome(dt, think); break;
      case 'carry': this.carryBig(think); break;
      case 'fight': this.fight(dt, think); break;
      case 'flee': this.flee(dt); break;
      case 'guard': this.guard(dt, think); break;
      case 'follow': this.follow(dt, think); break;
      case 'milk': this.milk(dt, think); break;
      case 'rescue': this.rescue(dt); break;
      case 'greet': this.greet(dt); break;
      case 'raid': this.raid(dt, think); break;
      case 'heal': this.healHome(dt); break;
      case 'tandem': this.tandem(dt, think); break;
      case 'medic': this.medic(dt); break;
      case 'carried': this.beCarried(dt); break;
      case 'allogroom': this.allogroom(dt); break;
      default: this.state = this.defaultState();
    }
  }

  defaultState() {
    if (this.followT > 0) return 'follow';
    if (this.carry) return 'return';
    if (this.raider) return 'raid';
    if (this.role === 'soldier') return 'guard';
    return { scout: 'scout', herd: 'herd', rest: 'rest' }[this.task] || 'forage';
  }

  steer(desired, speed, dt, turn = 5, goal = null) {
    if (!this.isPlayer) {
      desired = navigate(this.game.world, this, desired, this.r + 14, !this.careless && this.state !== 'rescue', dt, speed, goal);
      if (goal && this.nav.unreach) this.giveUp(goal);
    }
    const d = angDiff(this.a, desired);
    this.a += clamp(d, -turn * dt, turn * dt);
    let sp = speed * this.slow * (1 - Math.min(0.55, (Math.abs(d) / Math.PI) * 0.55)) * this.game.weatherSlow;
    if (this.swimming) sp *= 0.45;
    this.game.world.moveTo(this, this.x + Math.cos(this.a) * sp * dt, this.y + Math.sin(this.a) * sp * dt);
    this.speedNow = sp;
    this.gait += (sp * dt * 0.45) / this.size;
  }

  /* Head for a point, swinging wide of any remembered danger on the way. */
  /* How far a predator can reach: keep outside it while going about our business. */
  static reachOf(o) {
    return o.r + ({ frog: 175, hedgehog: 120, lizard: 120, mantis: 70, spider: 60, scorpion: 60, crab: 70, bird: 70, centipede: 50, wasp: 40 }[o.kind] || 50);
  }
  avoidLive(desired) {
    const o = this.threat;
    if (!o || this.role === 'soldier') return desired;
    const reach = Ant.reachOf(o) + 20, d = dist(this.x, this.y, o.x, o.y);
    if (d > reach) return desired;
    const away = Math.atan2(this.y - o.y, this.x - o.x);
    const k = clamp((reach - d) / 60, 0, 1);
    // slide around the danger rather than straight away from it, to keep making progress
    const side = angDiff(away, desired) >= 0 ? 1 : -1;
    return desired + angDiff(desired, away + side * 0.9) * k;
  }

  steerTo(gx, gy, speed, dt, turn = 5) {
    let desired = this.avoidLive(Math.atan2(gy - this.y, gx - this.x));
    const lookX = this.x + Math.cos(desired) * 90, lookY = this.y + Math.sin(desired) * 90;
    const danger = this.colony.dangerNear(lookX, lookY, 110);
    if (danger && dist2(gx, gy, danger.x, danger.y) > 110 * 110) {
      const toD = Math.atan2(danger.y - this.y, danger.x - this.x);
      desired = toD + (angDiff(toD, desired) >= 0 ? 1 : -1) * 1.3;
    }
    this.steer(desired, speed, dt, turn, { x: gx, y: gy });
  }

  /* Nudge away from ants standing on top of us, so crowds spread into a natural jostle. */
  spaceOut() {
    let px = 0, py = 0;
    const R = this.r * 1.5;
    this.game.hash.query(this.x, this.y, R + 8, (o) => {
      if (o === this || o.kind !== 'ant' || o.dead) return;
      const dx = this.x - o.x, dy = this.y - o.y, d2 = dx * dx + dy * dy, m = R + o.r * 0.5;
      if (d2 < m * m && d2 > 0.01) { const d = Math.sqrt(d2); px += (dx / d) * (m - d); py += (dy / d) * (m - d); }
    });
    if (px || py) this.game.world.moveTo(this, this.x + clamp(px, -3, 3), this.y + clamp(py, -3, 3));
  }

  face(ang, dt, turn = 8) {
    this.a += clamp(angDiff(this.a, ang), -turn * dt, turn * dt);
    this.speedNow = 0;
  }

  /* --------------------------------------------------------- foraging */

  forage(dt, think) {
    const n = this.nest, w = this.game.world, col = this.colony;
    if (think) {
      if (this.scanThreats()) return;
      const nearSite = this.site && dist2(this.x, this.y, this.site.x, this.site.y) < 140 * 140;
      if (this.scanFood(nearSite ? 120 : this.site ? 80 : 105)) return;
      if (this.tryGreet()) return;
      if (!this.site && !this.memory) {
        if (col.beacon && dist2(this.x, this.y, col.beacon.x, col.beacon.y) < 1100 * 1100 && Math.random() < 0.5) this.memory = { x: col.beacon.x + rand(-40, 40), y: col.beacon.y + rand(-40, 40) };
        else if (Math.random() < 0.6) this.site = col.siteFor(this);
      }
    }
    if (this.site && this.site.n === 0) this.site = null;
    const goal = this.site || this.memory;
    if (goal) {
      if (dist2(this.x, this.y, goal.x, goal.y) < 36 * 36) {
        // arrived: look around properly before giving up on the spot
        if (think && !this.scanFood(140)) {
          if (this.site) col.depleted(this.site);
          this.site = null; this.memory = null;
        }
        this.face(this.a + 1.5, dt, 2);
        return;
      }
      this.steerTo(goal.x, goal.y, this.baseSpeed, dt, 4);
      return;
    }
    // no lead: follow fresh scent outward, otherwise wander, staying within reach of home
    const awayA = Math.atan2(this.y - n.y, this.x - n.x);
    let best = 0, bestA = 0, desired;
    const now = this.game.time;
    // ant-mill guard: count how much we've turned while trail-following; a full loop means
    // the scent is leading us in circles, so ignore it for a while and strike out from home
    const turned = angDiff(this.millA ?? this.a, this.a);
    this.millA = this.a;
    this.millTurn = (this.millTurn || 0) * (1 - dt * 0.08);
    if (!(this.scentOff > now)) for (let k = -1; k <= 1; k++) {
      const sa = this.a + k * 0.6;
      const v = w.sample(col, this.x + Math.cos(sa) * 26, this.y + Math.sin(sa) * 26);
      if (v > 0.05) {
        const score = v * (1 + 0.7 * Math.cos(angDiff(sa, awayA)));
        if (score > best) { best = score; bestA = sa; }
      }
    }
    if (best > 0.06) {
      this.millTurn += turned;
      if (Math.abs(this.millTurn) > TAU * 1.1) { this.scentOff = now + rand(6, 10); this.millTurn = 0; this.a = awayA + rand(-0.8, 0.8); this.wander = 0; }
      desired = bestA + (Math.random() - 0.5) * 0.3;
    } else {
      this.wander = clamp(this.wander * (1 - dt * 0.6) + (Math.random() - 0.5) * 6 * dt, -1.2, 1.2);
      desired = this.a + this.wander * dt * 0.9;
    }
    const danger = col.dangerNear(this.x, this.y, 170);
    if (danger) {
      const away = Math.atan2(this.y - danger.y, this.x - danger.x);
      desired = away + angDiff(away, desired) * 0.3;
    }
    desired = this.avoidLive(desired);
    const dn = dist(this.x, this.y, n.x, n.y);
    if (dn > 900) desired = Math.atan2(n.y - this.y, n.x - this.x) + (Math.random() - 0.5) * 0.8;
    else if (dn < n.r * 0.6) desired = Math.atan2(this.y - n.y, this.x - n.x) + this.wander * 0.3;
    this.steer(desired, this.baseSpeed, dt, 4);
  }

  /* Scouts explore the directions the colony knows least about and bring back news. */
  scout(dt, think) {
    const n = this.nest, col = this.colony;
    if (think) {
      if (this.scanThreats()) return;
      if (this.scanFood(160, true)) return;
    }
    if (!this.scoutGoal) {
      if (this.legs >= 2) this.scoutGoal = { x: n.x, y: n.y, home: true };
      else {
        const s = col.pickSector(), a = ((s + Math.random()) / 16) * TAU, d = rand(450, 1250);
        this.scoutGoal = { x: n.x + Math.cos(a) * d, y: n.y + Math.sin(a) * d, s };
      }
      this.scoutT = 0;
    }
    const gl = this.scoutGoal;
    this.scoutT = (this.scoutT || 0) + dt;
    if (dist2(this.x, this.y, gl.x, gl.y) < 60 * 60 || this.scoutT > 40) {
      if (gl.home) this.legs = 0; else { this.legs++; col.sectors[gl.s] = this.game.time; }
      this.scoutGoal = null;
      return;
    }
    this.steerTo(gl.x, gl.y, this.baseSpeed * 1.1, dt, 4);
  }

  /* Herders live at an aphid patch: milking, guarding, and carrying honeydew home. */
  herd(dt, think) {
    if (!this.patch || !this.game.activePatches.includes(this.patch) || !this.patch.aphids.length) {
      this.patch = this.colony.patchFor(this);
      if (!this.patch) { this.task = 'forage'; this.state = 'forage'; return; }
    }
    const p = this.patch;
    if (think) {
      if (this.scanThreats()) return;
      if (dist2(this.x, this.y, p.x, p.y) < (p.r + 40) ** 2) {
        const ap = p.aphids.find((a) => a.ready && !a.claimed && !a.dead);
        if (ap) { ap.claimed = this; this.target = ap; this.state = 'milk'; this.timer = 0; return; }
      }
    }
    const gx = p.x + Math.cos(this.slot) * p.r * 0.75, gy = p.y + Math.sin(this.slot) * p.r * 0.75;
    if (dist2(this.x, this.y, gx, gy) < 12 * 12) { this.slot += 0.3 + Math.random() * 0.6; this.greetT = 0.2; }
    this.steerTo(gx, gy, this.baseSpeed * 0.6, dt, 4);
  }

  /* Off duty: walk home and go inside until the colony needs you again. */
  goRest(dt) {
    const n = this.nest;
    if (dist2(this.x, this.y, n.x, n.y) < (n.r * 0.35) ** 2) { this.inNest = true; this.speedNow = 0; return; }
    this.steerTo(n.x, n.y, this.baseSpeed * 0.85, dt, 5);
  }

  /* Skip food on the far side of water: check a few points along the way. */
  /* The planner found no way to the goal: drop it, and tell sisters not to bother for a while. */
  giveUp(goal) {
    this.nav.unreach = false; this.nav.fails = 0;
    if (this.scoutGoal) { if (this.scoutGoal.s !== undefined) this.colony.sectors[this.scoutGoal.s] = this.game.time; this.scoutGoal = null; }
    this.slot += 1.5 + Math.random();
    if (goal.kind !== 'nest' && goal !== this.nest && !(goal.r && this.colony.dropPoints().includes(goal))) goal.unreachT = this.game.time + 45;
    if (this.target === goal || ['fetch', 'milk', 'fight', 'guard', 'tandem', 'follow'].includes(this.state)) {
      if (this.target && this.target.claimed === this) this.target.claimed = null;
      this.releaseClaim(); this.target = null; this.answering = false;
      if (this.state === 'fight' || this.state === 'fetch' || this.state === 'milk') this.state = this.defaultState();
      if (this.site && dist2(this.site.x, this.site.y, goal.x, goal.y) < 120 * 120) { this.colony.depleted(this.site); this.site = null; }
    }
  }

  reachable(f) {
    if (f.unreachT > this.game.time) return false;
    if (this.swims) return true;
    const w = this.game.world;
    for (const k of [0.33, 0.66]) if (w.wetAt(lerp(this.x, f.x, k), lerp(this.y, f.y, k))) return false;
    return true;
  }

  wants(f) {
    if (f.refuse) return false;
    if (f.kind === 'leafbit') return this.sp === 'leafcutter';
    return true;
  }

  /* Look for food nearby. Skips crumbs a sister has already claimed, and tells the colony about big finds. */
  scanFood(radius = 90, scouting = false) {
    const g = this.game, col = this.colony;
    let best = null, bd = radius * radius;
    g.foodHash.query(this.x, this.y, radius, (f) => {
      if (f.taken || !this.wants(f) || !this.reachable(f) || col.dangerNear(f.x, f.y, 110)) return;
      if (f.claim && f.claim !== this && !f.claim.dead && f.claim.target === f) return;
      let d2 = dist2(this.x, this.y, f.x, f.y);
      if (f.kind === 'leafbit') d2 *= 0.5;
      if (f.kind === 'husk' && f.sp === this.sp) d2 *= 1.6;
      if (d2 < bd) { bd = d2; best = f; }
    });
    for (const b of g.bigs) {
      if (b.done || !this.reachable(b)) continue;
      const d = dist(this.x, this.y, b.x, b.y) - b.r;
      if (d > radius + 20) continue;
      if (scouting || d > 90) { col.report(b.x, b.y, b.needs, true, b.value / b.needs); continue; }
      if (b.carriers.filter((c) => c.colony === col).length >= b.needs + 1) continue;
      if (d * d < bd + 2500) { best = b; bd = Math.max(0, d) ** 2; }
    }
    if (best) {
      this.target = best; this.state = 'fetch';
      if (!best.big) best.claim = this;
      return true;
    }
    if (!scouting && HERDERS.has(this.sp) && Math.random() < 0.15) {
      for (const p of g.activePatches) {
        if (dist2(this.x, this.y, p.x, p.y) > (p.r + 90) ** 2) continue;
        const ap = p.aphids.find((a) => a.ready && !a.claimed && !a.dead);
        if (ap) { ap.claimed = this; this.target = ap; this.state = 'milk'; this.timer = 0; return true; }
      }
    }
    return false;
  }

  fetch(dt, think) {
    const f = this.target;
    if (!f || f.taken || f.done) { this.target = null; this.state = this.defaultState(); return; }
    if (think && this.scanThreats()) return;
    const d = dist(this.x, this.y, f.x, f.y);
    const reach = f.big ? f.r + this.r * 0.6 : this.r + 4;
    if (d < reach) {
      if (f.big) {
        if (f.carriers.filter((c) => c.colony === this.colony).length < f.needs + 2) f.addCarrier(this);
        else { this.target = null; this.state = this.defaultState(); }
      } else this.pickUp(f);
      return;
    }
    this.steer(Math.atan2(f.y - this.y, f.x - this.x), this.baseSpeed * 1.05, dt, 6, f);
  }

  pickUp(f) {
    const g = this.game;
    g.takeFood(f);
    f.claim = null;
    let n = 0;
    g.foodHash.query(f.x, f.y, 90, (o) => { if (!o.taken && o !== f && this.wants(o) && dist2(f.x, f.y, o.x, o.y) < 8100) n++; });
    this.reportN = n;
    this.reportV = f.value || 1;
    // keep the colony's map honest: update (or drop) the site this crumb came from
    const st = this.colony.siteAt(f.x, f.y);
    if (st) { st.n = n; st.t = g.time; if (n === 0) { this.colony.depleted(st); if (this.site === st) this.site = null; } }
    this.toMidden = f.kind === 'husk' && f.sp === this.sp;
    this.carry = f; this.pickSpot = { x: f.x, y: f.y }; this.travel = 0;
    this.target = null; this.memory = null; this.state = 'return';
  }

  returnHome(dt, think) {
    if (think) {
      if (this.scanThreats(true)) return;
      this.tryGreet();
      if (this.state !== 'return') return;
    }
    const col = this.colony;
    const n = this.toMidden ? col.midden : col.dropPoint(this.x, this.y);
    if (this.carry && !this.toMidden) {
      this.game.world.deposit(col, this.x, this.y, dt * 3.4 * Math.max(0.2, 1 - this.travel / 2600));
      this.travel += this.speedNow * dt;
    }
    if (dist2(this.x, this.y, n.x, n.y) < (n.r * 0.42) ** 2) {
      if (this.carry) {
        if (this.toMidden) col.addRefuse(this.carry, n.x + rand(-14, 14), n.y + rand(-14, 14));
        else this.game.deliver(col, this.carry, this);
        this.carry = null;
      }
      // tell the colony what is left out there, and go straight back for more
      if (!this.toMidden && this.pickSpot && this.reportN > 0) {
        this.site = col.report(this.pickSpot.x, this.pickSpot.y, this.reportN, false, this.reportV || 1);
        // tandem running: lead idle sisters waiting at the nest back to a rich find
        if (this.reportN >= 3) this.recruitTandem();
      }
      else if (this.site && this.reportN === 0) { col.depleted(this.site); this.site = null; }
      this.toMidden = false;
      this.a += Math.PI + rand(-0.4, 0.4);
      this.state = this.defaultState();
      return;
    }
    this.steerTo(n.x, n.y, this.baseSpeed * 0.95, dt, 4.5);
  }

  recruitTandem() {
    let n = 0;
    this.game.hash.query(this.x, this.y, 150, (o) => {
      if (n >= 2 || o === this || o.kind !== 'ant' || o.colony !== this.colony || o.isPlayer || o.dead || o.role !== 'worker') return;
      if (o.state !== 'forage' || o.site || o.memory || o.carry) return;
      o.site = this.site; o.leader = this; o.state = 'tandem';
      n++;
    });
  }

  /* Follow a nestmate who knows the way, keeping antennae on her as real tandem runners do. */
  tandem(dt, think) {
    const L = this.leader, st = this.site;
    if (!st || !L || L.dead || L.inNest || dist2(this.x, this.y, st.x, st.y) < 60 * 60 || (L.state !== 'forage' && L.state !== 'fetch')) {
      this.leader = null; this.state = this.defaultState(); return;
    }
    if (think && this.scanThreats()) return;
    const bx = L.x - Math.cos(L.a) * 13, by = L.y - Math.sin(L.a) * 13;
    const d = dist(this.x, this.y, bx, by);
    this.greetT = 0.2;
    if (d > 6) this.steer(Math.atan2(by - this.y, bx - this.x), this.baseSpeed * clamp(d / 25, 0.5, 1.25), dt, 7, { x: bx, y: by });
    else this.face(L.a, dt, 5);
  }

  carryBig(think) {
    const b = this.big;
    if (!b || b.done) { this.big = null; this.state = this.defaultState(); return; }
    if (think && this.role === 'soldier') this.scanThreats();
  }

  dropCarry() {
    const f = this.carry;
    if (!f) return;
    this.carry = null; this.toMidden = false;
    f.x = this.x + Math.cos(this.a) * 7; f.y = this.y + Math.sin(this.a) * 7;
    this.game.addFood(f);
  }

  leaveBig() {
    if (this.big) { this.big.removeCarrier(this); this.big = null; }
  }

  releaseClaim() {
    const t = this.target;
    if (t && t.kind === 'aphid' && t.claimed === this) t.claimed = null;
    if (t && t.claim === this) t.claim = null;
  }

  /* --------------------------------------------------------- aphid herding */

  milk(dt, think) {
    const ap = this.target;
    if (!ap || ap.dead) { this.releaseClaim(); this.target = null; this.state = this.defaultState(); return; }
    if (think && this.scanThreats()) return;
    const d = dist(this.x, this.y, ap.x, ap.y);
    if (d > this.r + ap.r + 1.5) { this.steer(Math.atan2(ap.y - this.y, ap.x - this.x), this.baseSpeed * 0.8, dt, 6, ap); return; }
    this.face(Math.atan2(ap.y - this.y, ap.x - this.x), dt);
    this.greetT = 0.2;
    this.timer += dt;
    if (ap.ready && this.timer > 1.2) {
      ap.ready = false; ap.readyT = rand(9, 16); ap.claimed = null;
      this.carry = new Food('honey', ap.x, ap.y);
      if (this.sp === 'garden' || this.sp === 'honeypot') this.carry.value = 3;
      this.pickSpot = null; this.reportN = 0; this.travel = 0; this.target = null; this.state = 'return';
      this.game.fx.sparkle(ap.x, ap.y, '#ffd36b', 4);
    } else if (this.timer > 5) { this.releaseClaim(); this.target = null; this.state = this.defaultState(); }
  }

  /* ---------------------------------------------------------- fighting */

  /* Size up what is around before reacting: flee what we can't beat, call soldiers,
     and pick a target that isn't already swarmed. */
  scanThreats(carrying = false) {
    const g = this.game, col = this.colony;
    const nearHome = col.alertT > 0 && dist2(this.x, this.y, col.nest.x, col.nest.y) < 400 * 400;
    const range = this.sense * (nearHome ? 1.8 : 1);
    const foes = [];
    g.hash.query(this.x, this.y, range, (o) => { if (this.hostileTo(o) && dist2(this.x, this.y, o.x, o.y) < range * range) foes.push(o); });
    if (!foes.length) return false;
    let near = foes[0], nd = Infinity;
    for (const o of foes) { const d2 = dist2(this.x, this.y, o.x, o.y); if (d2 < nd) { nd = d2; near = o; } }
    if (near.predator) this.threat = near;
    if (this.role !== 'soldier') {
      if (near.predator) {
        const ours = col.strengthNear(this.x, this.y, 130);
        if (ours < (near.fear || 5)) {
          col.addDanger(near.x, near.y); col.callHelp(near);
          if (nd < (Ant.reachOf(near) * 0.7) ** 2 || (carrying && nd < Ant.reachOf(near) ** 2)) { this.startFlee(near); return true; }
          return false;
        }
      } else if (near.kind === 'ant') {
        const ours = col.strengthNear(this.x, this.y, 130), theirs = near.colony.strengthNear(near.x, near.y, 130);
        if (theirs > ours * 1.2) { col.callHelp(near); col.addDanger(near.x, near.y); this.startFlee(near); return true; }
      }
      if (carrying) {
        if (nd < 50 * 50) { this.startFlee(near); return true; }
        return false;
      }
    } else if (near.kind === 'ant' || near.predator) col.callHelp(near);
    const tg = this.pickTarget(foes);
    if (!tg) return false;
    this.startFight(tg);
    return true;
  }

  pickTarget(foes) {
    let best = null, bs = Infinity;
    for (const o of foes) {
      if (o.unreachT > this.game.time && dist2(this.x, this.y, o.x, o.y) > 40 * 40) continue;
      const atk = this.colony.attackersOn(o);
      if (atk >= attackCap(o)) continue;
      const d = dist(this.x, this.y, o.x, o.y);
      const hp = o.hp !== undefined ? o.hp : 50;
      const s = d + hp * 0.35 - Math.min(atk, 3) * 14 + (o.kind === 'nest' ? 140 : 0) + (o.predator && this.role !== 'soldier' ? 60 : 0);
      if (s < bs) { bs = s; best = o; }
    }
    return best;
  }

  startFight(o) {
    if (this.carry) this.dropCarry();
    this.leaveBig(); this.releaseClaim();
    this.target = o; this.state = 'fight';
  }

  startFlee(o) {
    this.releaseClaim(); this.leaveBig();
    if (o && (o.predator || o.kind === 'ant')) this.colony.addDanger(o.x, o.y);
    this.fleeFrom = o; this.timer = 1.3; this.state = 'flee'; this.answering = false;
  }

  fight(dt, think) {
    const o = this.target;
    const chase = this.answering ? 900 : this.raider ? 500 : 340;
    if (!o || o.dead || o.flying || o.invuln || dist2(this.x, this.y, o.x, o.y) > chase * chase) {
      this.target = null; this.answering = false; this.state = this.defaultState(); return;
    }
    const d = dist(this.x, this.y, o.x, o.y), ang = Math.atan2(o.y - this.y, o.x - this.x);
    const reach = this.r + o.r + 2;
    // big prey: hold back just out of reach and call sisters, then attack together
    if (o.kind !== 'ant' && o.kind !== 'nest' && o.r > 16 && this.role !== 'soldier' && !this.answering) {
      const gathered = this.colony.strengthNear(o.x, o.y, o.r + 80);
      this.waitT = (this.waitT || 0) + dt;
      if (gathered < 4 && this.colony.attackersOn(o) === 0 && this.waitT < 7) {
        const hold = Math.atan2(this.y - o.y, this.x - o.x);
        const hx = o.x + Math.cos(hold) * (o.r + 50), hy = o.y + Math.sin(hold) * (o.r + 50);
        if (dist2(this.x, this.y, hx, hy) > 100) this.steer(Math.atan2(hy - this.y, hx - this.x), this.baseSpeed, dt, 6, { x: hx, y: hy });
        else { this.face(ang, dt); this.greetT = 0.2; }
        if (think) { this.colony.callHelp(o); this.game.recruit(this.colony, o, this); }
        return;
      }
    }
    this.waitT = 0;
    if (d > reach) {
      // close in on a spot around the target, so a group surrounds big prey instead of queueing
      let goal = ang;
      if (d < 90 && o.r > 10) {
        const sa = Math.atan2(this.y - o.y, this.x - o.x) + angDiff(Math.atan2(this.y - o.y, this.x - o.x), this.slot) * 0.5;
        goal = Math.atan2(o.y + Math.sin(sa) * reach - this.y, o.x + Math.cos(sa) * reach - this.x);
      }
      this.steer(goal, this.baseSpeed * 1.2, dt, 7, o);
    } else { this.face(ang, dt); if (this.biteCd <= 0) this.bite(o); }
    if (think && this.role !== 'soldier') {
      // break off if the fight has turned against us
      if (o.predator && this.colony.strengthNear(this.x, this.y, 130) < (o.fear || 5) - 2) this.startFlee(o);
      else if (o.kind === 'ant' && o.colony.strengthNear(o.x, o.y, 130) > this.colony.strengthNear(this.x, this.y, 130) * 1.6) this.startFlee(o);
    }
  }

  bite(o) {
    this.biteCd = this.biteRate * rand(0.9, 1.15);
    this.biteT = 0.25;
    const lead = this.followT > 0 && this.colony.isPlayer ? 1 + 0.25 * this.game.perk('leader') : 1;
    o.damage(this.dmg * lead * (this.frenzyT > 0 ? 1.3 : 1), this);
    if (ANT_SPECIES[this.sp].venom && o.kind !== 'nest') this.game.poison(o, this, 3, 2.5);
    if (o.kind !== 'ant' && o.kind !== 'nest') this.game.recruit(this.colony, o, this);
  }

  flee(dt) {
    this.timer -= dt;
    const o = this.fleeFrom, n = this.nest;
    let ang = o && !o.dead ? Math.atan2(this.y - o.y, this.x - o.x) : this.a;
    // run towards home if that is roughly away from the threat
    const home = Math.atan2(n.y - this.y, n.x - this.x);
    if (this.think <= 0 || this.fleeTo === undefined) {
      this.fleeTo = null;
      let bd = 320 * 320;
      this.game.hash.query(this.x, this.y, 320, (s2) => {
        if (s2.kind !== 'ant' || s2.colony !== this.colony || s2.role !== 'soldier' || s2.dead) return;
        const d2 = dist2(this.x, this.y, s2.x, s2.y);
        if (d2 < bd) { bd = d2; this.fleeTo = s2; }
      });
    }
    const sol = this.fleeTo;
    const toSol = sol ? Math.atan2(sol.y - this.y, sol.x - this.x) : null;
    if (toSol !== null && Math.abs(angDiff(ang, toSol)) < 1.5) ang = toSol;
    else if (Math.abs(angDiff(ang, home)) < 1.3) ang = home;
    this.steer(ang, this.baseSpeed * 1.3, dt, 7);
    if (this.timer <= 0) { this.fleeFrom = null; this.state = this.defaultState(); }
  }

  guard(dt, think) {
    const col = this.colony;
    if (think) {
      if (this.scanThreats()) return;
      // answer the nearest call for help
      const call = col.callFor(this);
      if (call) { this.answering = true; this.startFight(call.target); return; }
      if (Math.random() < 0.05 && this.tryGreet()) return;
      if ((!this.escort || this.escort.done) && Math.random() < 0.2) {
        this.escort = null;
        for (const b of this.game.bigs) {
          if (!b.done && b.carriers.some((c) => c.colony === col) && dist2(b.x, b.y, this.x, this.y) < 600 * 600 && dist2(b.x, b.y, this.nest.x, this.nest.y) > 160 * 160) { this.escort = b; break; }
        }
        // otherwise guard the aphid herd now and then
        if (!this.escort && Math.random() < 0.25) this.guardPatch = col.patchFor(this);
      }
    }
    if (this.escort && !this.escort.done && this.escort.carriers.length) {
      const b = this.escort, ex = b.x + Math.cos(this.slot) * (b.r + 34), ey = b.y + Math.sin(this.slot) * (b.r + 34);
      if (dist2(this.x, this.y, ex, ey) < 12 * 12) this.slot += 0.4;
      this.steer(Math.atan2(ey - this.y, ex - this.x), this.baseSpeed * 0.9, dt, 5, { x: ex, y: ey });
      return;
    }
    this.escort = null;
    if (this.guardAt) {
      // ring a honey lure, ready to pounce on whatever comes to drink
      if (!this.game.lure) { this.guardAt = null; this.state = this.defaultState(); return; }
      const gx = this.guardAt.x + Math.cos(this.slot) * 34, gy = this.guardAt.y + Math.sin(this.slot) * 34;
      if (dist2(this.x, this.y, gx, gy) < 10 * 10) { this.speedNow = 0; this.face(Math.atan2(this.guardAt.y - this.y, this.guardAt.x - this.x), dt); return; }
      this.steer(Math.atan2(gy - this.y, gx - this.x), this.baseSpeed, dt, 5, { x: gx, y: gy });
      return;
    }
    const c = this.guardPatch && this.game.activePatches.includes(this.guardPatch) ? this.guardPatch : this.nest;
    const rad = c === this.nest ? 112 + (this.id % 5) * 14 : c.r + 30;
    const gx = c.x + Math.cos(this.slot) * rad, gy = c.y + Math.sin(this.slot) * rad;
    if (dist2(this.x, this.y, gx, gy) < 14 * 14) this.slot += 0.5 + Math.random() * 0.5;
    this.steer(Math.atan2(gy - this.y, gx - this.x), this.baseSpeed * 0.55, dt, 3, { x: gx, y: gy });
  }

  /* Carry a wounded sister home in our jaws, like Matabele ants do after a raid. */
  medic(dt) {
    const pt = this.patient;
    if (!pt || pt.dead || pt.state !== 'carried' || pt.carriedBy !== this) { if (pt && pt.carriedBy === this) { pt.carriedBy = null; if (!pt.dead) pt.state = 'heal'; } this.patient = null; this.state = this.defaultState(); return; }
    const n = this.colony.dropPoint(this.x, this.y);
    if (dist2(this.x, this.y, n.x, n.y) > (n.r * 0.5) ** 2) this.steerTo(n.x, n.y, this.baseSpeed * 0.75, dt, 5);
    else {
      pt.carriedBy = null; pt.state = 'heal'; this.patient = null; this.state = this.defaultState();
      if (this.colony.isPlayer) {
        const g = this.game;
        g.stats.rescued = (g.stats.rescued || 0) + 1;
        if (g.player && dist2(g.player.x, g.player.y, this.x, this.y) < 500 * 500) g.fx.text(this.x, this.y - 20, 'Carried a wounded sister home', '#c8f0b0');
      }
      return;
    }
    const d = this.r + pt.r * 0.9;
    pt.x = this.x + Math.cos(this.a) * d; pt.y = this.y + Math.sin(this.a) * d;
    pt.a = this.a + Math.PI * 0.85;
  }

  /* Hang limp in a sister's jaws, legs tucked in. */
  beCarried(dt) {
    this.speedNow = 0;
    if (!this.carriedBy || this.carriedBy.dead || this.carriedBy.patient !== this || this.carriedBy.state !== 'medic') { this.carriedBy = null; this.state = 'heal'; }
  }

  /* Lick and clean a resting sister. Grooming spreads the colony scent and clears off fungus spores. */
  allogroom(dt) {
    const pt = this.patient;
    this.timer -= dt;
    if (!pt || pt.dead || pt.state !== 'heal' || this.timer <= 0) { if (pt && pt.groomer === this) pt.groomer = null; this.patient = null; this.state = this.defaultState(); return; }
    const sa = this.slot, gx = pt.x + Math.cos(sa) * (pt.r + this.r), gy = pt.y + Math.sin(sa) * (pt.r + this.r);
    if (dist2(this.x, this.y, gx, gy) > 6 * 6) { this.steerTo(gx, gy, this.baseSpeed * 0.6, dt, 6); return; }
    this.speedNow = 0;
    this.face(Math.atan2(pt.y - this.y, pt.x - this.x), dt);
    this.greetT = 0.3; this.biteT = Math.sin(this.game.time * 9 + this.id) > 0.6 ? 0.1 : 0;
    pt.hp = Math.min(pt.maxHp, pt.hp + dt * 5);
  }

  healHome(dt) {
    const n = this.colony.dropPoint(this.x, this.y);
    if (dist2(this.x, this.y, n.x, n.y) > (n.r * 0.5) ** 2) {
      this.steerTo(n.x, n.y, this.baseSpeed * 0.8, dt, 5);
      return;
    }
    this.speedNow = 0; this.greetT = 0.2;
    // a sister nearby comes over to groom the patient
    if (!this.groomer && Math.random() < dt * 0.8) {
      let gr = null;
      this.game.hash.query(this.x, this.y, 110, (o) => {
        if (!gr && o.kind === 'ant' && o !== this && o.colony === this.colony && !o.isPlayer && !o.dead && !o.carry && !o.big && (o.state === 'guard' || o.state === 'forage') && o.hp > o.maxHp * 0.6) gr = o;
      });
      if (gr) { gr.releaseClaim(); gr.patient = this; gr.timer = rand(3, 6); gr.state = 'allogroom'; this.groomer = gr; }
    }
    if (this.groomer && (this.groomer.dead || this.groomer.patient !== this)) this.groomer = null;
    this.hp = Math.min(this.maxHp, this.hp + dt * 9);
    if (this.hp >= this.maxHp * 0.95) { this.state = this.defaultState(); this.a += Math.PI; }
  }

  /* Raiders march on another colony: they steal from the player's stores,
     and fight their way into a rival's mound. */
  raid(dt, think) {
    const target = this.raidTarget && !this.raidTarget.dead ? this.raidTarget : this.game.home;
    if (target.dead || target === this.colony) { this.raider = false; this.state = this.defaultState(); return; }
    if (think && this.scanThreats()) return;
    const n = target.nest;
    const d = dist(this.x, this.y, n.x, n.y);
    if (d > 40) { this.steer(Math.atan2(n.y - this.y, n.x - this.x), this.baseSpeed, dt, 4, n); return; }
    if (!target.isPlayer) { this.startFight(target); return; }
    this.timer += dt;
    this.face(this.a + 0.6, dt, 3);
    if (this.timer > 2.5) {
      this.timer = 0; this.raider = false;
      if (target.food - target.safeFood >= 2) {
        target.food -= 2;
        this.carry = new Food('crumb', this.x, this.y); this.carry.value = 2;
        this.pickSpot = null; this.reportN = 0; this.travel = 0;
        this.game.onRaidSteal();
      }
      this.state = this.carry ? 'return' : this.defaultState();
    }
  }

  /* ------------------------------------------------------ social life */

  follow(dt, think) {
    const p = this.game.player;
    if (this.followT <= 0 || !p || p.dead || p.colony !== this.colony || p.inNest) { this.followT = 0; this.state = this.defaultState(); return; }
    if (think) {
      if (p.big && !p.big.done && p.big.carriers.length < p.big.needs + 3) { p.big.addCarrier(this); return; }
      const lt = p.lastTarget;
      if (lt && !lt.dead && !lt.invuln && p.lastTargetT > 0 && dist2(this.x, this.y, lt.x, lt.y) < 260 * 260) {
        // join the player's fight, but spread out if it is already covered
        const near = [];
        this.game.hash.query(lt.x, lt.y, 120, (o) => { if (this.hostileTo(o)) near.push(o); });
        const tg = this.pickTarget(near.length ? near : [lt]) || lt;
        this.startFight(tg); return;
      }
      if (this.scanThreats()) return;
    }
    const rad = 26 + (this.id % 3) * 13;
    const tx = p.x + Math.cos(this.slot) * rad - Math.cos(p.a) * 10;
    const ty = p.y + Math.sin(this.slot) * rad - Math.sin(p.a) * 10;
    const d = dist(this.x, this.y, tx, ty);
    if (d > 10) this.steer(Math.atan2(ty - this.y, tx - this.x), d > 60 ? this.baseSpeed * 1.6 : this.baseSpeed * clamp(d / 30, 0.4, 1.3), dt, 7, { x: tx, y: ty });
    else this.face(p.a, dt, 4);
  }

  rescue(dt) {
    const v = this.target;
    if (!v || v.dead || !v.trapped) { this.target = null; this.state = this.defaultState(); return; }
    this.pitImmune = 0.4;
    const d = dist(this.x, this.y, v.x, v.y), ang = Math.atan2(v.y - this.y, v.x - this.x);
    if (d > this.r + v.r + 3) this.steer(ang, this.baseSpeed * 1.25, dt, 7, v);
    else {
      this.face(ang, dt);
      this.biteT = 0.2; this.greetT = 0.2;
      v.escape += dt * 0.3;
    }
  }

  tryGreet() {
    if (this.greetCd > 0) return false;
    const g = this.game;
    let mate = null;
    g.hash.query(this.x, this.y, 20, (o) => {
      if (mate || o === this || o.kind !== 'ant' || o.colony !== this.colony || o.dead) return;
      if (dist2(this.x, this.y, o.x, o.y) > 18 * 18) return;
      if (o.isPlayer) { if (o.speedNow < 5 && !o.big) mate = o; return; }
      if (o.greetCd > 0 || !['forage', 'return', 'guard', 'scout', 'herd'].includes(o.state)) return;
      mate = o;
    });
    if (!mate) return false;
    this.beginGreet(mate);
    this.learnFrom(mate);
    if (mate.isPlayer) g.onPlayerGreeted(this);
    else { mate.beginGreet(this); mate.learnFrom(this); }
    if (this.colony.isPlayer) g.fx.sparkle((this.x + mate.x) / 2, (this.y + mate.y) / 2, 'rgba(255,240,200,0.9)', 2);
    return true;
  }

  beginGreet(o) {
    this.prevState = this.state; this.state = 'greet'; this.partner = o;
    this.timer = 0.65 + Math.random() * 0.3; this.greetCd = rand(4, 8); this.greetT = 0.3;
  }

  /* Antennal contact passes on news: a returning forager tells a searching one where the food is. */
  learnFrom(o) {
    if (this.prevState !== 'forage' || this.site || this.memory) return;
    if (o.site) this.site = o.site;
    else if (o.carry && o.pickSpot && o.reportN > 0) this.site = this.colony.report(o.pickSpot.x, o.pickSpot.y, o.reportN);
    else if (o.memory) this.memory = { x: o.memory.x, y: o.memory.y };
  }

  greet(dt) {
    this.timer -= dt; this.greetT = 0.2;
    const o = this.partner;
    if (o && !o.dead) this.face(Math.atan2(o.y - this.y, o.x - this.x), dt, 8);
    if (this.timer <= 0) { this.partner = null; this.state = this.prevState || this.defaultState(); }
  }

  /* ------------------------------------------------------- damage */

  damage(amt, src) {
    if (this.dead || this.inNest) return;
    if (this.isPlayer && this.dodgeT > 0) { this.game.fx.text(this.x, this.y - 18, 'dodged', '#c8f0ff'); return; }
    this.hp -= amt; this.hurtT = 0.2;
    this.game.fx.hit(this.x, this.y, '#ffe0b0');
    if (this.isPlayer && this.game.mode === 'play') SFX.hurt();
    if (this.hp <= 0) { this.die(src); return; }
    if (!this.isPlayer && src && !src.dead && src.kind !== 'antlion' && !this.trapped) {
      if (src.predator || src.kind === 'ant') this.colony.callHelp(src);
      if (!(this.state === 'fight' && this.target === src)) {
        if (src.predator && this.role !== 'soldier' && this.colony.strengthNear(this.x, this.y, 130) < (src.fear || 5)) this.startFlee(src);
        else if (this.state !== 'carry' || this.role === 'soldier') this.startFight(src);
      }
    }
    this.game.alarm(this, src);
  }

  die(src) {
    this.dead = true;
    if (this.carry) this.dropCarry();
    this.leaveBig(); this.releaseClaim();
    const eaten = src && (src.predator || src.kind === 'antlion' || src.kind === 'frog' || src.kind === 'bird' || src.kind === 'wasp' || src.kind === 'sundew');
    if (src && (src.predator || src.kind === 'antlion' || src.kind === 'sundew' || src.kind === 'ant')) this.colony.addDanger(this.x, this.y);
    if (!eaten) {
      const h = new Food('husk', this.x, this.y);
      h.sp = this.sp; h.a = this.a;
      this.game.addFood(h);
    }
    this.game.onAntDeath(this, src);
  }

  draw(ctx, t) { drawAnt(ctx, this, t); }
}
