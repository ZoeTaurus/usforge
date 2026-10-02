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

/* A generic hunter that stalks ants and bites at close range. */
class Hunter extends Critter {
  constructor(game, x, y) {
    super(game, x, y);
    this.predator = true; this.think = 0; this.home = { x, y };
  }
  hunt(dt, opts) {
    this.hurtT -= dt; this.biteCd -= dt; this.biteT -= dt; this.think -= dt;
    const tg = this.target;
    if (this.think <= 0) {
      this.think = 0.4;
      if (!tg || tg.dead || dist2(this.x, this.y, tg.x, tg.y) > (opts.range * 1.6) ** 2) this.target = nearestAnt(this.game, this.x, this.y, opts.range);
    }
    const t2 = this.target;
    if (t2 && !t2.dead) {
      const d = dist(this.x, this.y, t2.x, t2.y), ang = Math.atan2(t2.y - this.y, t2.x - this.x);
      if (d > this.r + t2.r + (opts.reach || 2)) this.move(ang, opts.speed, dt, opts.turn || 5);
      else {
        this.a += clamp(angDiff(this.a, ang), -6 * dt, 6 * dt); this.speedNow = 0;
        if (this.biteCd <= 0) { this.biteCd = opts.cd; this.biteT = 0.3; t2.damage(opts.dmg, this); }
      }
    } else this.wanderStep(dt, opts.wander, this.home, opts.leash || 500);
  }
  damage(amt, src) {
    if (this.dead || this.invuln) return;
    this.hp -= amt; this.hurtT = 0.15; this.hitFx();
    if (src && src.kind === 'ant') this.target = src;
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
        if (this.fleeing > 0) { this.fleeing--; if (this.fleeing <= 0) this.dead = true; else this.startHop(this.hopA + rand(-0.4, 0.4), 140); }
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
      const tg = nearestAnt(this.game, this.x, this.y, 150);
      if (tg) {
        this.target = tg;
        const ang = Math.atan2(tg.y - this.y, tg.x - this.x);
        this.a += clamp(angDiff(this.a, ang), -1.2, 1.2);
        if (Math.abs(angDiff(this.a, ang)) < 0.35 && this.tongueCd <= 0) {
          this.tongueT = 0.4; this.tongueCd = 1.6; this.struck = false; this.tx = tg.x; this.ty = tg.y;
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
    if (this.hp < this.maxHp * 0.35 && !this.fleeing) {
      this.fleeing = 4;
      this.startHop(src ? Math.atan2(this.y - src.y, this.x - src.x) : rand(TAU), 140);
      this.game.fx.text(this.x, this.y - 30, 'ribbit!', '#d8f0a8');
    }
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
        if (dist2(this.x, this.y, this.lx, this.ly) < 260 * 260) { this.state = 'descend'; this.timer = 1.4; }
        break;
      }
      case 'descend': {
        this.timer -= dt;
        const k = 1 - Math.pow(0.02, dt);
        this.x = lerp(this.x, this.lx, k); this.y = lerp(this.y, this.ly, k);
        this.z = Math.max(0, 240 * (this.timer / 1.4));
        if (this.timer <= 0) {
          this.state = 'ground'; this.flying = false; this.z = 0; this.timer = 0;
          g.fx.dust(this.x, this.y, 10);
          g.hash.query(this.x, this.y, 40, (o) => { if (o.kind === 'ant' && !o.dead && dist2(o.x, o.y, this.x, this.y) < 40 * 40) o.damage(25, this); });
        }
        break;
      }
      case 'ground': {
        this.patience -= dt;
        this.hopT -= dt;
        const tg = nearestAnt(g, this.x, this.y, 140);
        if (tg) {
          const ang = Math.atan2(tg.y - this.y, tg.x - this.x);
          this.a += clamp(angDiff(this.a, ang), -5 * dt, 5 * dt);
          const d = dist(this.x, this.y, tg.x, tg.y);
          if (d < 52 && this.peckCd <= 0) { this.peckCd = 1.2; this.peckT = 0.18; tg.damage(tg.isPlayer ? 18 : 30, this); g.fx.dust(tg.x, tg.y, 3); }
          else if (d > 46 && this.hopT <= 0) { this.hopT = 0.7; g.world.moveTo(this, this.x + Math.cos(ang) * 26, this.y + Math.sin(ang) * 26); }
        } else if (this.hopT <= 0) {
          this.hopT = 1; this.a += rand(-1, 1);
          g.world.moveTo(this, this.x + Math.cos(this.a) * 24, this.y + Math.sin(this.a) * 24);
        }
        if (this.patience <= 0) { this.state = 'leave'; this.flying = true; }
        break;
      }
      case 'leave':
        this.z += 180 * dt;
        this.x += Math.cos(this.a) * 260 * dt; this.y += Math.sin(this.a) * 260 * dt;
        if (this.z > 400) this.dead = true;
        break;
    }
  }
  damage(amt, src) {
    if (this.flying) return;
    this.hurtT = 0.15; this.hitFx();
    this.patience -= amt * 0.07;
    if (this.patience <= 0 && this.state === 'ground') {
      this.state = 'leave'; this.flying = true;
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
