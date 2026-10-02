'use strict';
/* Behaviour for the third wave of animals. */

/* A wasp hunts from the air: it picks off ants that stray from their sisters. */
class Wasp extends Critter {
  constructor(game, x, y) {
    super(game, x, y);
    this.kind = 'wasp'; this.r = 9; this.size = 1.15; this.fear = 4; this.gaitK = 0.4;
    this.maxHp = this.hp = 40; this.z = 40; this.state = 'patrol'; this.home = { x, y };
    this.think = 0; this.groundT = 0; this.carryAnt = null; this.huntCd = rand(2, 5);
  }
  get flying() { return this.z > 6; }
  get invuln() { return this.z > 6; }
  get predator() { return this.z <= 6; }
  update(dt) {
    const g = this.game, t = g.time;
    this.hurtT -= dt; this.think -= dt; this.huntCd -= dt;
    switch (this.state) {
      case 'patrol': {
        if (!this.tx || dist2(this.x, this.y, this.tx, this.ty) < 900) { this.tx = this.home.x + rand(-420, 420); this.ty = this.home.y + rand(-420, 420); }
        const ang = Math.atan2(this.ty - this.y, this.tx - this.x) + Math.sin(t * 3 + this.id) * 0.5;
        this.a += clamp(angDiff(this.a, ang), -3 * dt, 3 * dt);
        this.x += Math.cos(this.a) * 120 * dt; this.y += Math.sin(this.a) * 120 * dt;
        this.z = lerp(this.z, 40 + Math.sin(t * 2 + this.id) * 8, dt * 2);
        if (this.think <= 0 && this.huntCd <= 0) {
          this.think = 0.6;
          let best = null, bs = Infinity;
          g.hash.query(this.x, this.y, 280, (o) => {
            if (o.kind !== 'ant' || o.dead || o.inNest) return;
            const s = dist(this.x, this.y, o.x, o.y) + g.countAllies(o, 70) * 60;
            if (s < bs) { bs = s; best = o; }
          });
          if (best) { this.target = best; this.state = 'dive'; }
        }
        break;
      }
      case 'dive': {
        const tg = this.target;
        if (!tg || tg.dead || tg.inNest) { this.state = 'patrol'; break; }
        const d = dist(this.x, this.y, tg.x, tg.y), ang = Math.atan2(tg.y - this.y, tg.x - this.x);
        this.a += clamp(angDiff(this.a, ang), -6 * dt, 6 * dt);
        const sp = Math.min(220, d * 3 + 40);
        this.x += Math.cos(this.a) * sp * dt; this.y += Math.sin(this.a) * sp * dt;
        this.z = Math.max(0, Math.min(this.z, d * 0.25));
        if (d < 14) {
          this.state = 'ground'; this.groundT = 0.7; this.z = 0;
          if (tg.isPlayer || tg.role === 'soldier') { tg.damage(18, this); }
          else {
            this.carryAnt = { sp: tg.sp, role: tg.role, gait: 0, hurtT: 0, greetT: 0, biteT: 0, id: tg.id };
            tg.die(this);
            g.fx.text(this.x, this.y - 16, 'snatched!', '#ffd36b');
          }
        }
        break;
      }
      case 'ground':
        this.groundT -= dt; this.speedNow = 0;
        if (this.groundT <= 0) { this.state = this.carryAnt ? 'leave' : 'rise'; }
        break;
      case 'rise':
        this.z = Math.min(40, this.z + 60 * dt);
        if (this.z >= 30) { this.state = 'patrol'; this.huntCd = rand(4, 8); }
        break;
      case 'leave':
        this.z = Math.min(60, this.z + 50 * dt);
        this.x += Math.cos(this.a) * 160 * dt; this.y += Math.sin(this.a) * 160 * dt;
        if (dist2(this.x, this.y, this.home.x, this.home.y) > 1400 * 1400) this.dead = true;
        break;
    }
    this.gait += dt * 20;
  }
  damage(amt, src) {
    if (this.dead || this.invuln) return;
    this.hp -= amt; this.hurtT = 0.15; this.hitFx();
    if (this.hp <= 0) { this.dead = true; this.game.onCritterDeath(this, src); return; }
    if (this.state === 'ground') { this.state = 'rise'; if (src && this.carryAnt === null) src.damage(10, this); }
  }
  draw(ctx, t) { drawWasp(ctx, this, t); }
}

/* Earwigs are harmless until cornered, then they pinch. */
class Earwig extends Critter {
  constructor(game, x, y) {
    super(game, x, y);
    this.kind = 'earwig'; this.r = 8; this.size = 1.1; this.prey = true; this.gaitK = 0.5;
    this.maxHp = this.hp = 50;
  }
  update(dt) {
    this.hurtT -= dt; this.biteCd -= dt; this.biteT -= dt; this.angryT -= dt;
    const tg = this.target;
    if (this.angryT > 0 && tg && !tg.dead && dist2(this.x, this.y, tg.x, tg.y) < 200 * 200) {
      const d = dist(this.x, this.y, tg.x, tg.y), away = Math.atan2(this.y - tg.y, this.x - tg.x);
      if (d < 26) {
        this.a += clamp(angDiff(this.a, away), -6 * dt, 6 * dt); this.speedNow = 0;
        if (this.biteCd <= 0) { this.biteCd = 0.9; this.biteT = 0.3; tg.damage(8, this); }
      } else this.move(away + Math.PI, 40, dt, 5);
    } else this.wanderStep(dt, this.game.darkness() > 0.2 ? 40 : 22);
  }
  damage(amt, src) {
    if (this.dead) return;
    this.hp -= amt; this.hurtT = 0.15; this.hitFx();
    if (src && src.team) { this.angryT = 6; this.angryTeam = src.team; this.target = src; }
    if (this.hp <= 0) { this.dead = true; this.game.onCritterDeath(this, src); }
  }
  draw(ctx, t) { drawEarwig(ctx, this, t); }
}

class Slug extends Critter {
  constructor(game, x, y) {
    super(game, x, y);
    this.kind = 'slug'; this.r = 12; this.size = 1; this.prey = true; this.gaitK = 0.2;
    this.maxHp = this.hp = 90; this.trail = []; this.lastT = { x, y };
  }
  update(dt) {
    this.hurtT -= dt; this.angryT -= dt;
    this.wanderStep(dt, this.angryT > 0 ? 16 : 9);
    const now = this.game.time;
    if (dist2(this.x, this.y, this.lastT.x, this.lastT.y) > 36) { this.trail.push({ x: this.x, y: this.y, t: now }); this.lastT = { x: this.x, y: this.y }; }
    while (this.trail.length && now - this.trail[0].t > 45) this.trail.shift();
  }
  damage(amt, src) {
    if (this.dead) return;
    this.hp -= amt; this.hurtT = 0.15; this.hitFx();
    if (src && src.team) { this.angryT = 6; this.angryTeam = src.team; }
    if (this.hp <= 0) { this.dead = true; this.game.onCritterDeath(this, src); }
  }
  drawTrail(ctx) { Snail.prototype.drawTrail.call(this, ctx); }
  draw(ctx, t) { drawSlug(ctx, this, t); }
}

/* Dung beetles walk backwards, pushing their ball with their hind legs. */
class DungBeetle extends Critter {
  constructor(game, x, y) {
    super(game, x, y);
    this.kind = 'dungbeetle'; this.r = 9; this.size = 1.1; this.gaitK = 0.5;
    this.maxHp = this.hp = 70; this.ball = true; this.ballR = 13; this.roll = 0; this.moveOffset = Math.PI;
    this.bx = x; this.by = y;
  }
  update(dt) {
    this.hurtT -= dt; this.angryT -= dt;
    this.wanderStep(dt, 22);
    const back = this.a + Math.PI;
    this.bx = this.x + Math.cos(back) * (this.r + this.ballR); this.by = this.y + Math.sin(back) * (this.r + this.ballR);
    this.roll += (this.speedNow * dt) / this.ballR;
  }
  damage(amt, src) {
    if (this.dead) return;
    this.hp -= amt; this.hurtT = 0.15; this.hitFx();
    if (src && src.team) { this.angryT = 6; this.angryTeam = src.team; }
    if (this.hp <= 0) { this.dead = true; this.game.onCritterDeath(this, src); }
  }
  draw(ctx, t) { drawDungBeetle(ctx, this, t); }
}

class Cricket extends Grasshopper {
  constructor(game, x, y) {
    super(game, x, y);
    this.kind = 'cricket'; this.chirpT = 0; this.chirpCd = rand(2, 8);
  }
  update(dt) {
    super.update(dt);
    this.chirpT -= dt; this.chirpCd -= dt;
    if (this.chirpCd <= 0 && this.z <= 0) {
      this.chirpCd = rand(3, 9);
      if (this.game.darkness() > 0.2) { this.chirpT = 1; if (this.game.inView(this)) this.game.fx.text(this.x, this.y - 12, 'chirp', '#e8dcc0'); }
    }
  }
  draw(ctx, t) { drawCricket(ctx, this, t); }
}

class StickInsect extends Critter {
  constructor(game, x, y) {
    super(game, x, y);
    this.kind = 'stick'; this.r = 8; this.size = 1; this.prey = true; this.gaitK = 0.25;
    this.maxHp = this.hp = 40;
  }
  update(dt) {
    this.hurtT -= dt; this.angryT -= dt;
    this.wanderStep(dt, 7);
  }
  damage(amt, src) {
    if (this.dead) return;
    this.hp -= amt; this.hurtT = 0.15; this.hitFx();
    if (src && src.team) { this.angryT = 6; this.angryTeam = src.team; }
    if (this.hp <= 0) { this.dead = true; this.game.onCritterDeath(this, src); }
  }
  draw(ctx, t) { drawStickInsect(ctx, this, t); }
}

/* The hedgehog: a night-time giant that licks up ants. Biting it hurts. */
class Hedgehog extends Critter {
  constructor(game, x, y) {
    super(game, x, y);
    this.kind = 'hedgehog'; this.r = 44; this.size = 1; this.gaitK = 0.06; this.fear = 30;
    this.maxHp = this.hp = 900; this.curl = false; this.curlT = 0; this.lickT = 0; this.lickCd = 0; this.sniff = false;
    this.home = { x, y };
  }
  get predator() { return !this.curl; }
  get invuln() { return this.curl; }
  update(dt) {
    const g = this.game;
    this.hurtT -= dt; this.lickT -= dt; this.lickCd -= dt;
    if (this.curl) { this.curlT -= dt; this.speedNow = 0; if (this.curlT <= 0) this.curl = false; return; }
    const sx = this.x + Math.cos(this.a) * 66, sy = this.y + Math.sin(this.a) * 66;
    const tg = nearestAnt(g, sx, sy, 160);
    this.sniff = !!tg;
    if (tg) {
      const ang = Math.atan2(tg.y - this.y, tg.x - this.x);
      const d = dist(sx, sy, tg.x, tg.y);
      if (d > 24) this.move(ang, 34, dt, 1.6);
      else {
        this.a += clamp(angDiff(this.a, ang), -2 * dt, 2 * dt); this.speedNow = 0;
        if (this.lickCd <= 0) {
          this.lickCd = 0.9; this.lickT = 0.3;
          g.hash.query(sx, sy, 30, (o) => { if (o.kind === 'ant' && !o.dead && dist2(o.x, o.y, sx, sy) < 30 * 30) o.damage(o.isPlayer ? 22 : 40, this); });
        }
      }
    } else this.wanderStep(dt, 26, this.home, 600);
    if (g.darkness() < 0.1 && dist2(this.x, this.y, g.camera.x, g.camera.y) > 900 * 900) this.dead = true;
  }
  damage(amt, src) {
    if (this.dead || this.curl) return;
    this.hp -= amt; this.hurtT = 0.12;
    if (src && src.damage && src.kind === 'ant' && Math.random() < 0.5) src.damage(2, null);
    if (this.hp < this.maxHp * 0.5 && Math.random() < 0.05) { this.curl = true; this.curlT = 6; this.game.fx.text(this.x, this.y - 40, 'curls into a ball', '#e8dcc0'); }
    if (this.hp <= 0) { this.dead = true; this.game.onCritterDeath(this, src); }
  }
  draw(ctx, t) { drawHedgehog(ctx, this, t); }
}

/* Termites from a nearby mound: soft, slow prey that ants raid. Soldiers bite back. */
class Termite extends Critter {
  constructor(game, mound, role) {
    const a = rand(TAU);
    super(game, mound.x + Math.cos(a) * 50, mound.y + Math.sin(a) * 50);
    this.kind = 'termite'; this.role = role; this.mound = mound;
    this.size = role === 'soldier' ? 1.15 : 0.95; this.r = 5 * this.size; this.gaitK = 0.6;
    this.maxHp = this.hp = role === 'soldier' ? 30 : 14; this.prey = true;
  }
  update(dt) {
    this.hurtT -= dt; this.biteCd -= dt; this.biteT -= dt; this.angryT -= dt;
    const tg = this.target;
    if (this.role === 'soldier' && this.angryT > 0 && tg && !tg.dead && dist2(this.x, this.y, tg.x, tg.y) < 120 * 120) {
      const d = dist(this.x, this.y, tg.x, tg.y), ang = Math.atan2(tg.y - this.y, tg.x - this.x);
      if (d > this.r + tg.r + 2) this.move(ang, 36, dt, 5);
      else if (this.biteCd <= 0) { this.biteCd = 0.8; this.biteT = 0.25; tg.damage(5, this); }
      return;
    }
    this.wanderStep(dt, 24, this.mound, 170);
  }
  damage(amt, src) {
    if (this.dead) return;
    this.hp -= amt; this.hurtT = 0.15; this.hitFx();
    if (src && src.team) { this.angryT = 8; this.angryTeam = src.team; this.target = src; }
    if (this.hp <= 0) {
      this.dead = true;
      const f = new Food('termite', this.x, this.y);
      this.game.addFood(f);
      this.game.onCritterDeath(this, src);
    }
  }
  draw(ctx, t) { drawTermite(ctx, this, t); }
}

/* Moths come out at night and flutter around your light. */
class Moth {
  constructor(game, x, y) {
    this.game = game; this.kind = 'moth'; this.id = UID++;
    this.x = x; this.y = y; this.a = rand(TAU); this.z = rand(30, 60); this.size = rand(0.8, 1); this.dead = false;
    this.orbit = rand(TAU); this.orR = rand(60, 140);
  }
  update(dt) {
    const g = this.game, p = g.player, t = g.time;
    this.orbit += dt * (1.2 + Math.sin(t + this.id) * 0.4);
    const cx = p && !p.dead ? p.x : g.camera.x, cy = p && !p.dead ? p.y : g.camera.y;
    const tx = cx + Math.cos(this.orbit) * this.orR, ty = cy + Math.sin(this.orbit * 1.3) * this.orR;
    const ang = Math.atan2(ty - this.y, tx - this.x) + Math.sin(t * 5 + this.id) * 0.6;
    this.a += clamp(angDiff(this.a, ang), -4 * dt, 4 * dt);
    this.x += Math.cos(this.a) * 90 * dt; this.y += Math.sin(this.a) * 90 * dt;
    this.z = 30 + Math.sin(t * 2 + this.id) * 10;
    if (g.darkness() < 0.12) this.dead = true;
  }
  draw(ctx, t) { drawMoth(ctx, this, t); }
}

Object.assign(CRITTER_CLASSES, { wasp: Wasp, earwig: Earwig, slug: Slug, dungbeetle: DungBeetle, cricket: Cricket, stick: StickInsect, hedgehog: Hedgehog });
SPAWN_TABLE.meadow.push(['wasp', 0.8], ['cricket', 2], ['dungbeetle', 1.2], ['earwig', 1]);
SPAWN_TABLE.wood.push(['earwig', 2.5], ['slug', 2.5], ['stick', 2], ['wasp', 0.5]);
SPAWN_TABLE.marsh.push(['slug', 3], ['cricket', 1]);
SPAWN_TABLE.dry.push(['dungbeetle', 2.5], ['wasp', 0.8], ['cricket', 1.5]);
SPAWN_TABLE.beach.push(['earwig', 0.5]);

Object.assign(BIG_KINDS, {
  wasp: { needs: 2, value: 12, r: 12, name: 'wasp' },
  earwig: { needs: 2, value: 10, r: 12, name: 'earwig' },
  slug: { needs: 4, value: 22, r: 20, name: 'slug' },
  dungbeetle: { needs: 3, value: 16, r: 14, name: 'dung beetle' },
  cricket: { needs: 2, value: 10, r: 12, name: 'cricket' },
  hedgehog: { needs: 25, value: 150, r: 48, name: 'hedgehog' },
  stick: { needs: 2, value: 10, r: 16, name: 'stick insect' },
});
FOOD_KINDS.termite = { v: 2, r: 5, name: 'termite' };
FOOD_KINDS.acorn = { v: 2, r: 5, name: 'acorn' };
