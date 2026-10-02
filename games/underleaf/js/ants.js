'use strict';
/* Ants. Every colony shares one brain: forage by scent, carry food home,
   greet and share news, herd aphids, gang up on prey, answer alarms,
   and pull nestmates out of antlion pits. */

const ANT_STATS = {
  worker: { size: 1, hp: 26, speed: 66, dmg: 4, bite: 0.55, sense: 95 },
  soldier: { size: 1.32, hp: 64, speed: 58, dmg: 9, bite: 0.6, sense: 170 },
  player: { size: 1.14, hp: 55, speed: 108, dmg: 8, bite: 0.32, sense: 0 },
};
const HERDERS = new Set(['garden', 'fire', 'weaver', 'wood']);

class Ant {
  constructor(game, colony, x, y, role = 'worker') {
    this.game = game; this.id = UID++; this.kind = 'ant';
    this.colony = colony; this.team = colony.id; this.sp = colony.species; this.role = role;
    this.isPlayer = false;
    this.x = x; this.y = y; this.a = rand(TAU);
    this.applyStats(role, true);
    this.hp = this.maxHp;
    this.state = role === 'soldier' ? 'guard' : 'forage'; this.prevState = null;
    this.carry = null; this.big = null; this.memory = null; this.pickSpot = null; this.target = null; this.partner = null;
    this.think = rand(0.3); this.biteCd = 0; this.biteT = 0; this.greetCd = rand(1, 4); this.greetT = 0; this.hurtT = 0;
    this.gait = rand(TAU); this.wander = 0; this.followT = 0; this.slot = rand(TAU); this.timer = 0;
    this.trapped = null; this.escape = 0; this.pitImmune = 0; this.rescueCall = 0;
    this.speedNow = 0; this.slow = 1; this.travel = 0; this.alarmCd = 0;
    this.careless = Math.random() < 0.2; this.raider = false; this.dead = false;
    this.lastTarget = null; this.lastTargetT = 0; this.fleeFrom = null;
    this.swims = false; this.swimming = false; this.inNest = false;
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

  makePlayer(level = 1) {
    this.leaveBig(); this.releaseClaim();
    this.isPlayer = true; this.role = 'worker';
    this.applyStats('player', false);
    const k = 1 + (level - 1) * 0.08;
    this.maxHp *= k; this.dmg *= k;
    this.hp = this.maxHp; this.state = 'player'; this.target = null; this.followT = 0; this.raider = false;
    this.swims = !!ANT_SPECIES[this.sp].swims;
  }

  get nest() { return this.colony.nest; }
  get invuln() { return this.inNest; }

  hostileTo(o) {
    if (o === this || o.dead) return false;
    if (o.kind === 'ant') return o.colony !== this.colony && !o.inNest;
    if (o.kind === 'nest') return o !== this.colony && !o.dead;
    if (o.invuln || o.flying) return false;
    if (o.predator) return true;
    if (o.kind === 'ladybug') return HERDERS.has(this.sp) && o.nearPatch;
    if (o.prey || o.kind === 'caterpillar') return this.role === 'soldier' || (o.angryT > 0 && o.angryTeam === this.team);
    return o.angryT > 0 && o.angryTeam === this.team;
  }

  /* ------------------------------------------------------------- loop */

  update(dt) {
    if (this.dead) return;
    this.biteCd -= dt; this.biteT -= dt; this.hurtT -= dt; this.greetCd -= dt; this.greetT -= dt;
    this.alarmCd -= dt; this.pitImmune -= dt;
    if (this.followT > 0) this.followT -= dt;
    if (this.isPlayer) return;
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
      if (this.state !== 'carry' && this.state !== 'greet' && this.state !== 'milk') this.spaceOut();
    }
    switch (this.state) {
      case 'forage': this.forage(dt, think); break;
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
      default: this.state = this.defaultState();
    }
  }

  defaultState() {
    if (this.followT > 0) return 'follow';
    if (this.carry) return 'return';
    if (this.raider) return 'raid';
    return this.role === 'soldier' ? 'guard' : 'forage';
  }

  steer(desired, speed, dt, turn = 5, goal = null) {
    if (!this.isPlayer) desired = navigate(this.game.world, this, desired, this.r + 14, !this.careless && this.state !== 'rescue', dt, speed, goal);
    const d = angDiff(this.a, desired);
    this.a += clamp(d, -turn * dt, turn * dt);
    let sp = speed * this.slow * (1 - Math.min(0.55, (Math.abs(d) / Math.PI) * 0.55)) * this.game.weatherSlow;
    if (this.swimming) sp *= 0.45;
    this.game.world.moveTo(this, this.x + Math.cos(this.a) * sp * dt, this.y + Math.sin(this.a) * sp * dt);
    this.speedNow = sp;
    this.gait += (sp * dt * 0.45) / this.size;
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
    if (think) {
      if (this.scanThreats()) return;
      if (this.scanFood()) return;
      if (this.tryGreet()) return;
    }
    const n = this.nest, w = this.game.world;
    let desired;
    if (this.memory) {
      desired = Math.atan2(this.memory.y - this.y, this.memory.x - this.x);
      if (dist2(this.x, this.y, this.memory.x, this.memory.y) < 30 * 30) this.memory = null;
    } else {
      const awayA = Math.atan2(this.y - n.y, this.x - n.x);
      let best = 0, bestA = 0;
      for (let k = -1; k <= 1; k++) {
        const sa = this.a + k * 0.6;
        const v = w.sample(this.colony, this.x + Math.cos(sa) * 26, this.y + Math.sin(sa) * 26);
        if (v > 0.05) {
          const score = v * (1 + 0.7 * Math.cos(angDiff(sa, awayA)));
          if (score > best) { best = score; bestA = sa; }
        }
      }
      if (best > 0.06) desired = bestA + (Math.random() - 0.5) * 0.3;
      else {
        this.wander = clamp(this.wander * (1 - dt * 0.6) + (Math.random() - 0.5) * 6 * dt, -1.2, 1.2);
        desired = this.a + this.wander * dt * 0.9;
      }
    }
    const dn = dist(this.x, this.y, n.x, n.y);
    if (dn > 1400) desired = Math.atan2(n.y - this.y, n.x - this.x);
    else if (dn < n.r * 0.6) desired = Math.atan2(this.y - n.y, this.x - n.x) + this.wander * 0.3;
    this.steer(desired, this.baseSpeed, dt, 4, this.memory);
  }

  /* Skip food on the far side of water: check a few points along the way. */
  reachable(f) {
    if (this.swims) return true;
    const w = this.game.world;
    for (const k of [0.33, 0.66]) if (w.waterAt(lerp(this.x, f.x, k), lerp(this.y, f.y, k))) return false;
    return true;
  }

  wants(f) {
    if (f.kind === 'leafbit') return this.sp === 'leafcutter';
    return true;
  }

  scanFood() {
    const g = this.game;
    let best = null, bd = 105 * 105;
    g.foodHash.query(this.x, this.y, 105, (f) => {
      if (f.taken || !this.wants(f) || !this.reachable(f)) return;
      const d2 = dist2(this.x, this.y, f.x, f.y) * (f.kind === 'leafbit' ? 0.5 : 1);
      if (d2 < bd) { bd = d2; best = f; }
    });
    for (const b of g.bigs) {
      if (b.done || b.carriers.length >= b.needs + 1 || !this.reachable(b)) continue;
      const d = dist(this.x, this.y, b.x, b.y) - b.r;
      if (d < 85 && d * d < bd + 2500) { best = b; bd = Math.max(0, d) ** 2; }
    }
    if (best) { this.target = best; this.state = 'fetch'; return true; }
    if (HERDERS.has(this.sp) && Math.random() < 0.3) {
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
    if (!f || f.taken || f.done) { this.target = null; this.state = 'forage'; return; }
    if (think && this.scanThreats()) return;
    const d = dist(this.x, this.y, f.x, f.y);
    const reach = f.big ? f.r + this.r * 0.6 : this.r + 4;
    if (d < reach) {
      if (f.big) {
        if (f.carriers.length < f.needs + 2) f.addCarrier(this);
        else { this.target = null; this.state = 'forage'; }
      } else this.pickUp(f);
      return;
    }
    this.steer(Math.atan2(f.y - this.y, f.x - this.x), this.baseSpeed * 1.05, dt, 6, f);
  }

  pickUp(f) {
    this.game.takeFood(f);
    this.carry = f; this.pickSpot = { x: f.x, y: f.y }; this.travel = 0;
    this.target = null; this.memory = null; this.state = 'return';
  }

  returnHome(dt, think) {
    if (think) {
      if (this.scanThreats(true)) return;
      this.tryGreet();
      if (this.state !== 'return') return;
    }
    const n = this.colony.dropPoint(this.x, this.y);
    if (this.carry) {
      this.game.world.deposit(this.colony, this.x, this.y, dt * 3.4 * Math.max(0.2, 1 - this.travel / 2600));
      this.travel += this.speedNow * dt;
    }
    if (dist2(this.x, this.y, n.x, n.y) < (n.r * 0.42) ** 2) {
      if (this.carry) { this.game.deliver(this.colony, this.carry, this); this.carry = null; }
      this.memory = this.pickSpot && this.game.foodNear(this.pickSpot.x, this.pickSpot.y, 90) ? this.pickSpot : null;
      this.a += Math.PI + rand(-0.4, 0.4);
      this.state = this.role === 'soldier' ? 'guard' : 'forage';
      return;
    }
    this.steer(Math.atan2(n.y - this.y, n.x - this.x), this.baseSpeed * 0.95, dt, 4.5, n);
  }

  carryBig(think) {
    const b = this.big;
    if (!b || b.done) { this.big = null; this.state = this.defaultState(); return; }
    if (think && this.role === 'soldier') this.scanThreats();
  }

  dropCarry() {
    const f = this.carry;
    if (!f) return;
    this.carry = null;
    f.x = this.x + Math.cos(this.a) * 7; f.y = this.y + Math.sin(this.a) * 7;
    this.game.addFood(f);
  }

  leaveBig() {
    if (this.big) { this.big.removeCarrier(this); this.big = null; }
  }

  releaseClaim() {
    const t = this.target;
    if (t && t.kind === 'aphid' && t.claimed === this) t.claimed = null;
  }

  /* --------------------------------------------------------- aphid herding */

  milk(dt, think) {
    const ap = this.target;
    if (!ap || ap.dead) { this.releaseClaim(); this.target = null; this.state = 'forage'; return; }
    if (think && this.scanThreats()) return;
    const d = dist(this.x, this.y, ap.x, ap.y);
    if (d > this.r + ap.r + 1.5) { this.steer(Math.atan2(ap.y - this.y, ap.x - this.x), this.baseSpeed * 0.8, dt, 6, ap); return; }
    this.face(Math.atan2(ap.y - this.y, ap.x - this.x), dt);
    this.greetT = 0.2;
    this.timer += dt;
    if (ap.ready && this.timer > 1.2) {
      ap.ready = false; ap.readyT = rand(9, 16); ap.claimed = null;
      this.carry = new Food('honey', ap.x, ap.y);
      if (this.sp === 'garden') this.carry.value = 3;
      this.pickSpot = { x: ap.x, y: ap.y }; this.travel = 0; this.target = null; this.state = 'return';
      this.game.fx.sparkle(ap.x, ap.y, '#ffd36b', 4);
    } else if (this.timer > 5) { this.releaseClaim(); this.target = null; this.state = 'forage'; }
  }

  /* ---------------------------------------------------------- fighting */

  scanThreats(carrying = false) {
    const g = this.game, range = this.sense;
    let best = null, bd = range * range;
    g.hash.query(this.x, this.y, range, (o) => {
      if (!this.hostileTo(o)) return;
      const d2 = dist2(this.x, this.y, o.x, o.y);
      if (d2 < bd) { bd = d2; best = o; }
    });
    if (!best) return false;
    if (best.predator && this.role !== 'soldier' && g.countAllies(this, 110) < (best.fear || 5)) { this.startFlee(best); return true; }
    if (carrying && this.role !== 'soldier') {
      if (bd < 50 * 50) { this.startFlee(best); return true; }
      return false;
    }
    this.startFight(best);
    return true;
  }

  startFight(o) {
    if (this.carry) this.dropCarry();
    this.leaveBig(); this.releaseClaim();
    this.target = o; this.state = 'fight';
  }

  startFlee(o) {
    this.releaseClaim(); this.leaveBig();
    this.fleeFrom = o; this.timer = 1.3; this.state = 'flee';
  }

  fight(dt, think) {
    const o = this.target;
    if (!o || o.dead || o.flying || o.invuln || dist2(this.x, this.y, o.x, o.y) > 340 * 340) {
      this.target = null; this.state = this.defaultState(); return;
    }
    const d = dist(this.x, this.y, o.x, o.y), ang = Math.atan2(o.y - this.y, o.x - this.x);
    const reach = this.r + o.r + 2;
    if (d > reach) {
      // close in on a spot around the target, so a group surrounds big prey instead of queueing
      let goal = ang;
      if (d < 90 && o.r > 10) {
        const sa = Math.atan2(this.y - o.y, this.x - o.x) + angDiff(Math.atan2(this.y - o.y, this.x - o.x), this.slot) * 0.5;
        goal = Math.atan2(o.y + Math.sin(sa) * reach - this.y, o.x + Math.cos(sa) * reach - this.x);
      }
      this.steer(goal, this.baseSpeed * 1.2, dt, 7, o);
    } else { this.face(ang, dt); if (this.biteCd <= 0) this.bite(o); }
    if (think && this.role !== 'soldier' && o.predator && this.game.countAllies(this, 110) < (o.fear || 5) - 2) this.startFlee(o);
  }

  bite(o) {
    this.biteCd = this.biteRate * rand(0.9, 1.15);
    this.biteT = 0.25;
    o.damage(this.dmg, this);
    if (ANT_SPECIES[this.sp].venom && o.kind !== 'nest') this.game.poison(o, this, 3, 2.5);
    if (o.kind !== 'ant' && o.kind !== 'nest') this.game.recruit(this.colony, o, this);
  }

  flee(dt) {
    this.timer -= dt;
    const o = this.fleeFrom;
    const ang = o && !o.dead ? Math.atan2(this.y - o.y, this.x - o.x) : this.a;
    this.steer(ang, this.baseSpeed * 1.3, dt, 7);
    if (this.timer <= 0) { this.fleeFrom = null; this.state = this.defaultState(); }
  }

  guard(dt, think) {
    if (think) {
      if (this.scanThreats()) return;
      if (Math.random() < 0.05 && this.tryGreet()) return;
    }
    const n = this.nest, rad = 112 + (this.id % 5) * 14;
    const gx = n.x + Math.cos(this.slot) * rad, gy = n.y + Math.sin(this.slot) * rad;
    if (dist2(this.x, this.y, gx, gy) < 14 * 14) this.slot += 0.5 + Math.random() * 0.5;
    this.steer(Math.atan2(gy - this.y, gx - this.x), this.baseSpeed * 0.55, dt, 3, { x: gx, y: gy });
  }

  raid(dt, think) {
    const target = this.game.home;
    if (think && this.scanThreats()) return;
    const n = target.nest;
    const d = dist(this.x, this.y, n.x, n.y);
    if (d > 40) { this.steer(Math.atan2(n.y - this.y, n.x - this.x), this.baseSpeed, dt, 4, n); return; }
    this.timer += dt;
    this.face(this.a + 0.6, dt, 3);
    if (this.timer > 2.5) {
      this.timer = 0; this.raider = false;
      if (target.food - target.safeFood >= 2) {
        target.food -= 2;
        this.carry = new Food('crumb', this.x, this.y); this.carry.value = 2;
        this.pickSpot = null; this.travel = 0;
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
      if (lt && !lt.dead && !lt.invuln && p.lastTargetT > 0 && dist2(this.x, this.y, lt.x, lt.y) < 260 * 260) { this.startFight(lt); return; }
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
      if (o.greetCd > 0 || (o.state !== 'forage' && o.state !== 'return' && o.state !== 'guard')) return;
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

  /* Antennal contact passes on where food is: a returning forager "tells" a searching one. */
  learnFrom(o) {
    if (this.prevState !== 'forage' || this.memory) return;
    if (o.carry && o.pickSpot) this.memory = { x: o.pickSpot.x, y: o.pickSpot.y };
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
    this.hp -= amt; this.hurtT = 0.2;
    this.game.fx.hit(this.x, this.y, '#ffe0b0');
    if (this.hp <= 0) { this.die(src); return; }
    if (!this.isPlayer && src && !src.dead && src.kind !== 'antlion' && !this.trapped) {
      if (!(this.state === 'fight' && this.target === src)) {
        if (src.predator && this.role !== 'soldier' && this.game.countAllies(this, 110) < (src.fear || 5)) this.startFlee(src);
        else if (this.state !== 'carry' || this.role === 'soldier') this.startFight(src);
      }
    }
    this.game.alarm(this, src);
  }

  die(src) {
    this.dead = true;
    if (this.carry) this.dropCarry();
    this.leaveBig(); this.releaseClaim();
    const eaten = src && (src.predator || src.kind === 'antlion' || src.kind === 'frog' || src.kind === 'bird');
    if (!eaten) {
      const h = new Food('husk', this.x, this.y);
      h.sp = this.sp; h.a = this.a;
      this.game.addFood(h);
    }
    this.game.onAntDeath(this, src);
  }

  draw(ctx, t) { drawAnt(ctx, this, t); }
}
