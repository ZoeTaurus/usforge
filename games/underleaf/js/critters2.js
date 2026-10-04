'use strict';
/* Behaviour for the larger and newer animals. */

function followSegs(segs, x, y, spacing) {
  segs[0].x = x; segs[0].y = y;
  for (let i = 1; i < segs.length; i++) {
    const p = segs[i], q = segs[i - 1];
    const d = dist(p.x, p.y, q.x, q.y);
    if (d > spacing) { p.x = q.x + ((p.x - q.x) / d) * spacing; p.y = q.y + ((p.y - q.y) / d) * spacing; }
  }
}

function makeSegs(x, y, a, n, spacing) {
  const segs = [];
  for (let i = 0; i < n; i++) segs.push({ x: x - Math.cos(a) * i * spacing, y: y - Math.sin(a) * i * spacing });
  return segs;
}

function nearestAnt(game, x, y, range, filter) {
  let best = null, bd = range * range;
  game.hash.query(x, y, range, (o) => {
    if (o.kind !== 'ant' || o.dead || (filter && !filter(o))) return;
    const d2 = dist2(x, y, o.x, o.y);
    if (d2 < bd) { bd = d2; best = o; }
  });
  return best;
}

/* How many ants (of any colony) are crowding a point, soldiers counting more. */
function antMob(game, x, y, r) {
  let s = 0;
  game.hash.query(x, y, r, (o) => {
    if (o.kind === 'ant' && !o.dead && dist2(x, y, o.x, o.y) < r * r) s += o.isPlayer ? 3 : o.role === 'soldier' ? 2.5 : 1;
  });
  return s;
}

/* Predators pick on ants that have strayed from their sisters, and prefer easy meals:
   a forager weighed down with food, or one that's already hurt. They avoid the nest itself. */
function isolatedAnt(game, x, y, range, ignore) {
  let best = null, bs = Infinity;
  game.hash.query(x, y, range, (o) => {
    if (o.kind !== 'ant' || o.dead || o.inNest || o === ignore) return;
    const d = dist(x, y, o.x, o.y);
    if (d > range) return;
    let s = d + game.countAllies(o, 60) * 35;
    if (o.carry || o.big) s -= 30;
    s -= (1 - o.hp / o.maxHp) * 50;
    if (dist2(o.x, o.y, o.nest.x, o.nest.y) < 170 * 170) s += 140;
    if (s < bs) { bs = s; best = o; }
  });
  return best;
}

/* A generic hunter that stalks ants and bites at close range. */
class Hunter extends Critter {
  constructor(game, x, y) {
    super(game, x, y);
    this.predator = true; this.think = 0; this.home = { x, y };
  }
  /* prowl along ant scent trails -> creep up on a lone ant -> pounce -> bite;
     back off to recover when hurt or when too many ants gang up. */
  hunt(dt, opts) {
    const g = this.game;
    this.hurtT -= dt; this.biteCd -= dt; this.biteT -= dt; this.think -= dt;
    this.fullT = (this.fullT || 0) - dt; this.ignoreT = (this.ignoreT || 0) - dt;
    if (this.ignoreT <= 0) this.ignore = null;
    const thinkNow = this.think <= 0;
    if (thinkNow) {
      this.think = 0.4;
      this.mob = antMob(g, this.x, this.y, this.r + 90);
      const courage = opts.courage ?? (this.fear || 5) * 1.6;
      if (this.mode !== 'retreat' && (this.hp < this.maxHp * 0.3 || this.mob > courage)) {
        this.mode = 'retreat'; this.retreatT = rand(5, 8); this.target = null;
        // remember where the ants were too many for us, and stay away for a while
        this.badSpot = { x: this.x, y: this.y, t: g.time };
      } else if (this.mode !== 'retreat') {
        const tg = this.target;
        const hungry = !(this.fullT > 0) || (tg && this.lastHurt && g.time - this.lastHurt < 4);
        if (!hungry) this.target = null;
        else if (!tg || tg.dead || tg.inNest || tg === this.ignore || dist2(this.x, this.y, tg.x, tg.y) > (opts.range * 1.6) ** 2) {
          this.target = isolatedAnt(g, this.x, this.y, opts.range, this.ignore);
          this.chaseT = 0;
        }
        if (!this.target) this.mode = 'prowl';
        else if (this.mode !== 'pounce') this.mode = 'stalk';
      }
    }
    if (this.mode === 'retreat') {
      this.retreatT -= dt;
      this.hp = Math.min(this.maxHp, this.hp + dt * 4);
      const threat = nearestAnt(g, this.x, this.y, 220);
      const ang = threat ? Math.atan2(this.y - threat.y, this.x - threat.x) : Math.atan2(this.home.y - this.y, this.home.x - this.x);
      this.move(ang, opts.speed * 1.05, dt, 5);
      if (this.retreatT <= 0 && this.hp > this.maxHp * 0.5) this.mode = 'prowl';
      return;
    }
    const t2 = this.target;
    if ((this.mode === 'stalk' || this.mode === 'pounce') && t2 && !t2.dead) {
      const d = dist(this.x, this.y, t2.x, t2.y), ang = Math.atan2(t2.y - this.y, t2.x - this.x);
      this.chaseT = (this.chaseT || 0) + dt;
      if (d <= this.r + t2.r + (opts.reach || 2)) {
        this.a += clamp(angDiff(this.a, ang), -6 * dt, 6 * dt); this.speedNow = 0;
        if (this.biteCd <= 0) {
          this.biteCd = opts.cd; this.biteT = 0.3; this.chaseT = 0;
          t2.damage(opts.dmg, this);
          // a meal: rest and digest for a while before hunting again
          if (t2.dead) { this.fullT = rand(18, 35); this.target = null; this.mode = 'prowl'; }
        }
        return;
      }
      // a long fruitless chase is tiring: give up on this one and pick another later
      if (this.chaseT > 8) { this.ignore = t2; this.ignoreT = 10; this.target = null; this.mode = 'prowl'; this.idleT = rand(1, 2.5); return; }
      const pounceR = opts.pounce ?? this.r + 60;
      if (this.mode === 'stalk' && d < pounceR) { this.mode = 'pounce'; this.pounceT = 0.9; }
      if (this.mode === 'pounce') {
        this.pounceT -= dt;
        if (this.pounceT <= 0) this.mode = 'stalk';
        // lead the target a little: aim where it's going
        const lead = Math.min(0.5, d / (opts.speed * 1.5 + 1));
        const px = t2.x + Math.cos(t2.a) * (t2.speedNow || 0) * lead, py = t2.y + Math.sin(t2.a) * (t2.speedNow || 0) * lead;
        this.move(Math.atan2(py - this.y, px - this.x), opts.speed * 1.5, dt, 8);
      } else {
        // creep round behind the ant, where it can't see us coming
        let sa = ang;
        if (d > pounceR + 20) {
          const bx = t2.x - Math.cos(t2.a) * (pounceR * 0.8), by = t2.y - Math.sin(t2.a) * (pounceR * 0.8);
          sa = Math.atan2(by - this.y, bx - this.x);
        }
        this.move(sa, opts.speed * 0.45, dt, 4);
      }
      return;
    }
    // stay clear of the spot where the ants mobbed us
    const bs = this.badSpot;
    if (bs && g.time - bs.t < 60 && dist2(this.x, this.y, bs.x, bs.y) < 260 * 260) {
      this.move(Math.atan2(this.y - bs.y, this.x - bs.x), opts.wander * 1.2, dt, 3);
      return;
    }
    // full: doze near home instead of prowling
    if (this.fullT > 0) { this.wanderStep(dt, opts.wander * 0.5, this.home, Math.min(200, opts.leash || 500)); return; }
    // the nest mound is swarming with ants: prowl the trails, not the doorstep
    for (const col of g.activeColonies) {
      if (col.dead) continue;
      const n = col.nest;
      if (dist2(this.x, this.y, n.x, n.y) < 230 * 230) { this.move(Math.atan2(this.y - n.y, this.x - n.x), opts.wander * 1.1, dt, 3); return; }
    }
    // prowl: ant scent trails lead to ants, so follow the strongest one nearby
    if (thinkNow) {
      let best = 0, bestA = 0;
      for (let k = -1; k <= 1; k++) {
        const sa = this.a + k * 0.7, sx = this.x + Math.cos(sa) * 45, sy = this.y + Math.sin(sa) * 45;
        let v = 0;
        for (const col of g.activeColonies) v += g.world.sample(col, sx, sy);
        if (v > best) { best = v; bestA = sa; }
      }
      this.trailA = best > 0.4 ? bestA : null;
    }
    const leash = opts.leash || 500;
    if (this.trailA != null && dist2(this.x, this.y, this.home.x, this.home.y) < (leash * 1.8) ** 2) this.move(this.trailA, opts.wander * 1.3, dt, 3);
    else this.wanderStep(dt, opts.wander, this.home, leash);
  }
  damage(amt, src) {
    if (this.dead || this.invuln) return;
    this.hp -= amt; this.hurtT = 0.15; this.hitFx();
    if (src && src.kind === 'ant') { this.target = src; this.chaseT = 0; }
    if (this.hp <= 0) { this.dead = true; this.game.onCritterDeath(this, src); }
  }
}

/* -------------------------------------------------------------------- crab */

class Crab extends Hunter {
  constructor(game, x, y) {
    super(game, x, y);
    this.kind = 'crab'; this.r = 28; this.size = 1.15; this.gaitK = 0.32; this.fear = 8;
    this.maxHp = this.hp = 320; this.variant = Math.random() < 0.7 ? 'green' : 'red';
    this.moveOffset = Math.PI / 2; this.swims = true; this.flipT = rand(3, 7);
  }
  move(desired, speed, dt, turn) { super.move(desired - this.moveOffset, speed, dt, turn); }
  update(dt) {
    this.flipT -= dt;
    if (this.flipT <= 0) { this.flipT = rand(3, 7); this.moveOffset = -this.moveOffset; }
    this.hunt(dt, { range: 110, speed: 62, dmg: 18, cd: 1.0, wander: 28, reach: 8, turn: 3, leash: 400 });
  }
  draw(ctx, t) { drawCrab(ctx, this, t); }
}

/* -------------------------------------------------------------------- frog */

class Frog extends Critter {
  constructor(game, x, y) {
    super(game, x, y);
    this.kind = 'frog'; this.r = 30; this.size = 1.35; this.predator = true; this.fear = 9; this.swims = true;
    this.maxHp = this.hp = 260; this.hop = 0; this.hopP = -1; this.hopA = 0;
    this.tongueT = 0; this.tongueK = 0; this.tongueCd = 1; this.think = 0; this.idleT = rand(2, 6); this.fleeing = 0;
  }
  startHop(a, dist) { this.hopP = 0; this.hopA = a; this.hopDist = dist; this.a = a; }
  update(dt) {
    this.hurtT -= dt; this.tongueCd -= dt; this.think -= dt;
    if (this.hopP >= 0) {
      this.hopP += dt * 2.4;
      this.hop = Math.sin(clamp(this.hopP, 0, 1) * Math.PI);
      const sp = this.hopDist * 2.4;
      this.game.world.moveTo(this, this.x + Math.cos(this.hopA) * sp * dt, this.y + Math.sin(this.hopA) * sp * dt);
      if (this.hopP >= 1) {
        this.hopP = -1; this.hop = 0;
        if (this.fleeing > 0) {
          this.fleeing--;
          if (this.game.world.waterAt(this.x, this.y)) { this.game.fx.ring(this.x, this.y, 30, 'rgba(220,240,250,', 0.8); this.dead = true; }
          else if (this.fleeing <= 0) this.dead = true;
          else this.startHop(this.diveA ?? this.hopA + rand(-0.4, 0.4), 140);
        }
      }
      return;
    }
    if (this.tongueT > 0) {
      const tg = this.target;
      this.tongueT -= dt;
      const ph = 1 - this.tongueT / 0.4;
      this.tongueK = ph < 0.4 ? ph / 0.4 : 1 - (ph - 0.4) / 0.6;
      if (tg && !tg.dead) { this.tx = tg.x; this.ty = tg.y; }
      if (!this.struck && ph >= 0.4) {
        this.struck = true;
        if (tg && !tg.dead && dist2(this.x, this.y, tg.x, tg.y) < 170 * 170) {
          tg.damage(tg.isPlayer ? 22 : 40, this);
          this.game.fx.text(tg.x, tg.y - 14, 'thwip!', '#f2a8c0');
        }
      }
      return;
    }
    if (this.think <= 0) {
      this.think = 0.25;
      if (!this.fleeing && antMob(this.game, this.x, this.y, 100) > 10) { this.escape(null); return; }
      const tg = nearestAnt(this.game, this.x, this.y, 150);
      if (tg) {
        this.target = tg;
        const ang = Math.atan2(tg.y - this.y, tg.x - this.x);
        this.a += clamp(angDiff(this.a, ang), -1.2, 1.2);
        if (Math.abs(angDiff(this.a, ang)) < 0.35 && this.tongueCd <= 0) {
          this.tongueT = 0.4; this.tongueCd = 1.6; this.struck = false; if (this.game.mode === 'play') SFX.world(this.game, 'croak', this.x, this.y); this.tx = tg.x; this.ty = tg.y;
        }
      }
    }
    this.idleT -= dt;
    if (this.idleT <= 0) { this.idleT = rand(3, 8); this.startHop(this.a + rand(-1.5, 1.5), rand(60, 120)); }
  }
  get invuln() { return this.hop > 0.3; }
  damage(amt, src) {
    if (this.dead || this.invuln) return;
    this.hp -= amt; this.hurtT = 0.15; this.hitFx();
    if (this.hp <= 0) { this.dead = true; this.game.onCritterDeath(this, src); return; }
    if ((this.hp < this.maxHp * 0.45 || antMob(this.game, this.x, this.y, 100) > 10) && !this.fleeing) this.escape(src);
  }
  /* Head for the nearest water and dive in; if there is none, just hop away. */
  escape(src) {
    this.fleeing = 4;
    let best = null, bd = Infinity;
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU;
      for (const r of [80, 160, 260]) {
        const x = this.x + Math.cos(a) * r, y = this.y + Math.sin(a) * r;
        if (this.game.world.waterAt(x, y) && r < bd) { bd = r; best = a; break; }
      }
    }
    this.diveA = best;
    this.startHop(best ?? (src ? Math.atan2(this.y - src.y, this.x - src.x) : rand(TAU)), 140);
    this.game.fx.text(this.x, this.y - 30, 'ribbit!', '#d8f0a8');
  }
  draw(ctx, t) { drawFrog(ctx, this, t); }
}

/* ------------------------------------------------------------------ lizard */

class Lizard extends Hunter {
  constructor(game, x, y) {
    super(game, x, y);
    this.kind = 'lizard'; this.r = 20; this.size = 1.3; this.gaitK = 0.07; this.fear = 7;
    this.maxHp = this.hp = 200; this.sway = 0.15; this.restT = rand(1, 4); this.dashT = 0; this.tongueT = 0;
  }
  update(dt) {
    this.tongueT -= dt;
    if (Math.random() < dt * 0.4) this.tongueT = 0.3;
    if (this.restT > 0) {
      this.restT -= dt; this.speedNow = 0; this.hurtT -= dt; this.biteCd -= dt; this.biteT -= dt;
      this.sway = lerp(this.sway, 0.15, dt * 3);
      if (this.restT <= 0) this.dashT = rand(0.6, 1.4);
      const tg = nearestAnt(this.game, this.x, this.y, 170);
      if (tg && Math.random() < dt * 2) { this.restT = 0; this.dashT = 1.2; this.target = tg; }
      return;
    }
    this.dashT -= dt;
    this.sway = lerp(this.sway, 1, dt * 4);
    this.hunt(dt, { range: 200, speed: 150, dmg: 20, cd: 0.9, wander: 110, reach: 18, turn: 6, leash: 600 });
    if (this.dashT <= 0 && this.biteT <= 0) this.restT = rand(1, 3.5);
  }
  draw(ctx, t) { drawLizard(ctx, this, t); }
}

/* -------------------------------------------------------------------- bird */

class Bird extends Critter {
  constructor(game, tx, ty) {
    const a = rand(TAU);
    super(game, tx - Math.cos(a) * 1100, ty - Math.sin(a) * 1100);
    this.kind = 'bird'; this.r = 22; this.size = 1.2; this.fear = 12;
    this.lx = tx; this.ly = ty; this.a = a; this.z = 240; this.flying = true;
    this.state = 'arrive'; this.timer = 0; this.patience = 10; this.peckCd = 1; this.peckT = 0; this.hopT = 1;
  }
  get invuln() { return this.flying; }
  get predator() { return !this.flying; }
  update(dt) {
    const g = this.game;
    this.hurtT -= dt; this.peckT -= dt; this.peckCd -= dt;
    switch (this.state) {
      case 'arrive': {
        const ang = Math.atan2(this.ly - this.y, this.lx - this.x);
        this.a += clamp(angDiff(this.a, ang), -2 * dt, 2 * dt);
        this.x += Math.cos(this.a) * 300 * dt; this.y += Math.sin(this.a) * 300 * dt;
        if (dist2(this.x, this.y, this.lx, this.ly) < 260 * 260) { this.state = 'descend'; this.timer = 1.4; if (this.game.mode === 'play') SFX.world(this.game, 'robin', this.lx, this.ly); }
        break;
      }
      case 'descend': {
        this.timer -= dt;
        const k = 1 - Math.pow(0.02, dt);
        this.x = lerp(this.x, this.lx, k); this.y = lerp(this.y, this.ly, k);
        const f = Math.max(0, this.timer / 1.4);
        this.z = 240 * f * f;
        if (this.timer <= 0) {
          this.state = 'ground'; this.flying = false; this.z = 0; this.timer = 0;
          g.fx.dust(this.x, this.y, 10);
          g.hash.query(this.x, this.y, 40, (o) => { if (o.kind === 'ant' && !o.dead && dist2(o.x, o.y, this.x, this.y) < 40 * 40) o.damage(25, this); });
        }
        break;
      }
      case 'ground': {
        // robins move in bursts: a few quick hops, a pause to look and listen, then a strike
        this.patience -= dt;
        this.hopT -= dt;
        if (this.hop) {
          const h = this.hop;
          h.p = Math.min(1, h.p + dt / h.dur);
          const e = h.p * h.p * (3 - 2 * h.p);
          g.world.moveTo(this, lerp(h.fx, h.tx, e), lerp(h.fy, h.ty, e));
          this.z = Math.sin(h.p * Math.PI) * 5;
          if (h.p >= 1) {
            this.hop = null; this.z = 0;
            this.burst--;
            this.hopT = this.burst > 0 ? rand(0.05, 0.12) : rand(0.6, 1.3);
          }
          break;
        }
        const tg = nearestAnt(g, this.x, this.y, 160);
        let want = null;
        if (tg) {
          const ang = Math.atan2(tg.y - this.y, tg.x - this.x);
          this.a += clamp(angDiff(this.a, ang), -4 * dt, 4 * dt);
          const d = dist(this.x, this.y, tg.x, tg.y);
          if (d < 52 && this.peckCd <= 0 && Math.abs(angDiff(this.a, ang)) < 0.5) {
            this.peckCd = 1.1; this.peckT = 0.22; tg.damage(tg.isPlayer ? 18 : 30, this); g.fx.dust(tg.x, tg.y, 3);
          } else if (d > 46) want = ang;
        } else if (this.hopT <= 0) {
          this.wanderA = (this.wanderA ?? this.a) + rand(-1.2, 1.2);
          want = this.wanderA;
          this.a += clamp(angDiff(this.a, want), -3 * dt, 3 * dt);
        }
        if (want !== null && this.hopT <= 0 && Math.abs(angDiff(this.a, want)) < 0.6) {
          if (!this.burst || this.burst <= 0) this.burst = randi(2, 4);
          const len = rand(16, 24);
          this.hop = { fx: this.x, fy: this.y, tx: this.x + Math.cos(this.a) * len, ty: this.y + Math.sin(this.a) * len, p: 0, dur: rand(0.16, 0.22) };
        }
        if (this.patience <= 0) { this.state = 'leave'; this.flying = true; this.hop = null; this.leaveV = 40; }
        break;
      }
      case 'leave':
        // take off: speed and height build up over the first second
        this.leaveV = Math.min(280, (this.leaveV || 40) + 320 * dt);
        this.z += this.leaveV * 0.65 * dt;
        this.x += Math.cos(this.a) * this.leaveV * dt; this.y += Math.sin(this.a) * this.leaveV * dt;
        if (this.z > 400) this.dead = true;
        break;
    }
  }
  damage(amt, src) {
    if (this.flying) return;
    this.hurtT = 0.15; this.hitFx();
    this.patience -= amt * 0.07;
    if (this.patience <= 0 && this.state === 'ground') {
      this.state = 'leave'; this.flying = true; this.hop = null; this.leaveV = 60;
      if (src) this.a = Math.atan2(this.y - src.y, this.x - src.x);
      this.game.onBirdRepelled(this, src);
    }
  }
  draw(ctx, t) { drawBird(ctx, this, t); }
}

/* ------------------------------------------------------------------- mouse */

class Mouse extends Critter {
  constructor(game, x, y) {
    super(game, x, y);
    this.kind = 'mouse'; this.r = 22; this.size = 1; this.gaitK = 0.28; this.fear = 9;
    this.maxHp = this.hp = 240; this.burstT = 0; this.restT = rand(1, 3); this.home = { x, y };
  }
  update(dt) {
    const g = this.game;
    this.hurtT -= dt; this.biteCd -= dt; this.biteT -= dt; this.angryT -= dt;
    if (this.angryT > 0 && this.target && !this.target.dead) {
      const tg = this.target, d = dist(this.x, this.y, tg.x, tg.y), ang = Math.atan2(tg.y - this.y, tg.x - this.x);
      if (d > this.r + tg.r + 6) this.move(ang, 90, dt, 6);
      else if (this.biteCd <= 0) { this.biteCd = 1; this.biteT = 0.3; tg.damage(14, this); }
      return;
    }
    if (this.restT > 0) {
      this.restT -= dt; this.speedNow = 0;
      if (this.restT <= 0) this.burstT = rand(0.5, 1.4);
      let f = null;
      g.foodHash.query(this.x, this.y, 40, (o) => { if (!f && !o.taken && dist2(this.x, this.y, o.x, o.y) < 1600) f = o; });
      if (f) { g.takeFood(f); g.fx.text(f.x, f.y - 10, 'nibble', '#e8dccc'); }
      return;
    }
    this.burstT -= dt;
    this.wanderStep(dt, 120, this.home, 700);
    if (this.burstT <= 0) this.restT = rand(0.8, 3);
  }
  get predator() { return this.angryT > 0; }
  damage(amt, src) {
    if (this.dead) return;
    this.hp -= amt; this.hurtT = 0.15; this.hitFx();
    if (src && src.team) { this.angryT = 4; this.angryTeam = src.team; this.target = src; }
    if (this.hp <= 0) { this.dead = true; this.game.onCritterDeath(this, src); }
  }
  draw(ctx, t) { drawMouse(ctx, this, t); }
}

/* --------------------------------------------------------- segmented prey */

class Worm extends Critter {
  constructor(game, x, y) {
    super(game, x, y);
    this.kind = 'worm'; this.r = 6; this.prey = true; this.maxHp = this.hp = 70; this.thrash = 0;
    this.segs = makeSegs(x, y, this.a, 12, 4.2);
  }
  update(dt) {
    this.hurtT -= dt; this.angryT -= dt;
    this.wander = Math.sin(this.game.time * 2 + this.id) * 1.2;
    this.move(this.a + this.wander * dt * 0.8, this.angryT > 0 ? 26 : 11, dt, 2);
    followSegs(this.segs, this.x, this.y, 4.2);
    for (let i = 1; i < this.segs.length; i++) {
      const w = Math.sin(this.game.time * (this.angryT > 0 ? 14 : 4) - i * 0.8) * (this.angryT > 0 ? 0.9 : 0.25);
      this.segs[i].x += -Math.sin(this.a) * w; this.segs[i].y += Math.cos(this.a) * w;
    }
  }
  damage(amt, src) {
    if (this.dead) return;
    this.hp -= amt; this.hurtT = 0.15; this.hitFx();
    if (src && src.team) { this.angryT = 6; this.angryTeam = src.team; }
    if (this.hp <= 0) { this.dead = true; this.game.onCritterDeath(this, src); }
  }
  draw(ctx, t) { drawWorm(ctx, this, t); }
}

class Centipede extends Hunter {
  constructor(game, x, y) {
    super(game, x, y);
    this.kind = 'centipede'; this.r = 8; this.fear = 6; this.maxHp = this.hp = 130;
    this.segs = makeSegs(x, y, this.a, 16, 6);
  }
  update(dt) {
    this.hunt(dt, { range: 150, speed: 72, dmg: 14, cd: 0.8, wander: 34, leash: 500 });
    followSegs(this.segs, this.x, this.y, 6);
  }
  draw(ctx, t) { drawCentipede(ctx, this, t); }
}

class Millipede extends Critter {
  constructor(game, x, y) {
    super(game, x, y);
    this.kind = 'millipede'; this.r = 6; this.curl = 0; this.curlT = 0; this.roll = 0;
    this.segs = makeSegs(x, y, this.a, 20, 4.4);
  }
  get invuln() { return this.curl > 0.3; }
  update(dt) {
    if (this.curlT > 0) { this.curlT -= dt; this.curl = Math.min(1, this.curl + dt * 5); this.speedNow = 0; return; }
    this.curl = Math.max(0, this.curl - dt * 2);
    if (this.curl > 0) return;
    this.wanderStep(dt, 14);
    followSegs(this.segs, this.x, this.y, 4.4);
  }
  damage(amt, src) {
    if (this.curlT <= 0) this.game.fx.text(this.x, this.y - 14, 'coil', '#e0d4c4');
    this.curlT = 5;
  }
  draw(ctx, t) { drawMillipede(ctx, this, t); }
}

class Scorpion extends Hunter {
  constructor(game, x, y) {
    super(game, x, y);
    this.kind = 'scorpion'; this.r = 16; this.size = 1.05; this.fear = 7; this.gaitK = 0.25;
    this.maxHp = this.hp = 220; this.tailSide = Math.random() < 0.5 ? -1 : 1;
  }
  update(dt) {
    const night = this.game.darkness() > 0.2;
    this.hunt(dt, { range: night ? 200 : 120, speed: night ? 70 : 45, dmg: 26, cd: 1.2, wander: 22, reach: 6, leash: 450 });
  }
  draw(ctx, t) { drawScorpion(ctx, this, t); }
}

class Mantis extends Hunter {
  constructor(game, x, y) {
    super(game, x, y);
    this.kind = 'mantis'; this.r = 10; this.size = 1.05; this.fear = 6; this.gaitK = 0.2;
    this.maxHp = this.hp = 150; this.walkT = 0;
  }
  update(dt) {
    this.hurtT -= dt; this.biteCd -= dt; this.biteT -= dt;
    const tg = nearestAnt(this.game, this.x, this.y, 90);
    if (tg) {
      const ang = Math.atan2(tg.y - this.y, tg.x - this.x), d = dist(this.x, this.y, tg.x, tg.y);
      this.a += clamp(angDiff(this.a, ang), -1.5 * dt, 1.5 * dt);
      this.speedNow = 0;
      if (d < 48 && Math.abs(angDiff(this.a, ang)) < 0.5 && this.biteCd <= 0) { this.biteCd = 1.4; this.biteT = 0.3; tg.damage(24, this); }
      return;
    }
    this.walkT -= dt;
    if (this.walkT < -6) this.walkT = rand(1, 3);
    if (this.walkT > 0) this.wanderStep(dt, 12, this.home, 300);
    else this.speedNow = 0;
  }
  draw(ctx, t) { drawMantis(ctx, this, t); }
}

/* ------------------------------------------------------------- hoppers */

class Grasshopper extends Critter {
  constructor(game, x, y) {
    super(game, x, y);
    this.kind = 'grasshopper'; this.r = 8; this.prey = true; this.maxHp = this.hp = 30;
    this.z = 0; this.jumpP = -1; this.restT = rand(2, 6);
  }
  get invuln() { return this.z > 2; }
  jump(away) {
    this.jumpP = 0; this.jumpA = away ?? rand(TAU); this.a = this.jumpA;
  }
  update(dt) {
    this.hurtT -= dt; this.angryT -= dt;
    if (this.jumpP >= 0) {
      this.jumpP += dt / 0.7;
      this.z = Math.sin(clamp(this.jumpP, 0, 1) * Math.PI) * 34;
      this.game.world.moveTo(this, this.x + Math.cos(this.jumpA) * 230 * dt, this.y + Math.sin(this.jumpA) * 230 * dt);
      if (this.jumpP >= 1) { this.jumpP = -1; this.z = 0; this.restT = rand(2, 7); }
      return;
    }
    const near = nearestAnt(this.game, this.x, this.y, 60);
    if (near && Math.random() < dt * 3) { this.jump(Math.atan2(this.y - near.y, this.x - near.x) + rand(-0.6, 0.6)); return; }
    this.restT -= dt;
    if (this.restT <= 0) this.jump();
  }
  damage(amt, src) {
    if (this.dead || this.invuln) return;
    this.hp -= amt; this.hurtT = 0.15; this.hitFx();
    if (src && src.team) { this.angryT = 6; this.angryTeam = src.team; }
    if (this.hp <= 0) { this.dead = true; this.game.onCritterDeath(this, src); return; }
    if (Math.random() < 0.5) this.jump(src ? Math.atan2(this.y - src.y, this.x - src.x) : undefined);
  }
  draw(ctx, t) { drawGrasshopper(ctx, this, t); }
}

class Bee extends Critter {
  constructor(game, x, y) {
    super(game, x, y);
    this.kind = 'bee'; this.r = 7; this.size = 1.05; this.z = 30; this.flying = true;
    this.state = 'fly'; this.tx = null; this.restT = 0; this.home = { x, y };
  }
  get invuln() { return this.z > 2; }
  update(dt) {
    const g = this.game, t = g.time;
    this.hurtT -= dt;
    if (this.state === 'fly') {
      if (this.tx === null || dist2(this.x, this.y, this.tx, this.ty) < 100) {
        if (this.flower) { this.state = 'land'; return; }
        const fl = g.world.flowersNear(this.x + rand(-300, 300), this.y + rand(-300, 300));
        this.flower = fl.length && Math.random() < 0.7 ? pick(fl) : null;
        if (this.flower) { this.tx = this.flower.x; this.ty = this.flower.y; }
        else { this.tx = this.home.x + rand(-500, 500); this.ty = this.home.y + rand(-500, 500); }
      }
      const ang = Math.atan2(this.ty - this.y, this.tx - this.x) + Math.sin(t * 6 + this.id) * 0.4;
      this.a += clamp(angDiff(this.a, ang), -5 * dt, 5 * dt);
      this.x += Math.cos(this.a) * 110 * dt; this.y += Math.sin(this.a) * 110 * dt;
      this.z = lerp(this.z, 26 + Math.sin(t * 3 + this.id) * 8, dt * 3);
    } else if (this.state === 'land') {
      this.z = Math.max(0, this.z - 50 * dt);
      if (this.z <= 0) { this.state = 'rest'; this.restT = rand(3, 7); this.flying = false; }
    } else {
      this.restT -= dt;
      if (this.restT <= 0) { this.state = 'fly'; this.flying = true; this.flower = null; this.tx = null; this.z = 3; }
    }
  }
  damage(amt, src) {
    if (this.dead || this.invuln) return;
    if (src && !src.dead) { src.damage(22, this); this.game.fx.text(this.x, this.y - 12, 'sting!', '#ffd36b'); }
    this.dead = true;
    this.game.onCritterDeath(this, src);
  }
  draw(ctx, t) { drawBee(ctx, this, t); }
}

const CRITTER_CLASSES = {
  spider: Spider, beetle: Beetle, pillbug: Pillbug, caterpillar: Caterpillar, snail: Snail,
  crab: Crab, frog: Frog, lizard: Lizard, mouse: Mouse, worm: Worm, centipede: Centipede,
  millipede: Millipede, scorpion: Scorpion, mantis: Mantis, grasshopper: Grasshopper, bee: Bee,
};

/* Which ground animals live where, and how common they are. */
const SPAWN_TABLE = {
  meadow: [['grasshopper', 6], ['beetle', 2], ['pillbug', 3], ['caterpillar', 3], ['snail', 2], ['lizard', 1], ['mantis', 1.5], ['mouse', 1], ['worm', 1]],
  wood: [['beetle', 3], ['pillbug', 4], ['millipede', 4], ['centipede', 2], ['snail', 3], ['mouse', 1.5], ['worm', 2], ['spider', 0.8]],
  beach: [['crab', 4], ['pillbug', 1], ['beetle', 1], ['grasshopper', 1]],
  marsh: [['frog', 3], ['snail', 4], ['worm', 2], ['caterpillar', 1], ['millipede', 1]],
  dry: [['scorpion', 3], ['lizard', 3], ['grasshopper', 3], ['beetle', 2], ['mantis', 1]],
};
