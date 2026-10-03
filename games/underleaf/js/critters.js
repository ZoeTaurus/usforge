'use strict';
/* Everything that lives in the meadow besides the ants, plus food and effects. */

class Critter {
  constructor(game, x, y) {
    this.game = game; this.id = UID++;
    this.x = x; this.y = y; this.a = rand(TAU);
    this.gait = rand(TAU); this.gaitK = 0.35;
    this.dead = false; this.hurtT = 0; this.biteT = 0; this.biteCd = 0;
    this.team = 'wild'; this.speedNow = 0; this.wander = 0;
    this.angryT = 0; this.angryTeam = null; this.target = null; this.size = 1;
    this.idleT = 0;
  }
  get invuln() { return false; }
  move(desired, speed, dt, turn = 3) {
    const off = this.moveOffset || 0;
    this.navA = this.a + off;
    desired = navigate(this.game.world, this, desired + off, this.r + 16, true, dt, speed) - off;
    this.a += clamp(angDiff(this.a, desired), -turn * dt, turn * dt);
    const ma = this.a + (this.moveOffset || 0);
    this.game.world.moveTo(this, this.x + Math.cos(ma) * speed * dt, this.y + Math.sin(ma) * speed * dt);
    this.speedNow = speed;
    this.gait += speed * dt * this.gaitK;
  }
  wanderStep(dt, speed, home, leash) {
    if (this.idleT > 0) { this.idleT -= dt; this.speedNow = 0; return; }
    if (Math.random() < dt * 0.08) { this.idleT = rand(1, 4); return; }
    this.wander = clamp(this.wander * (1 - dt * 0.6) + (Math.random() - 0.5) * 5 * dt, -1, 1);
    let desired = this.a + this.wander * dt * 1.2;
    if (home && dist2(this.x, this.y, home.x, home.y) > leash * leash) desired = Math.atan2(home.y - this.y, home.x - this.x);
    // a honey lure draws small wanderers in from a distance
    const lu = this.game.lure;
    if (lu && !this.predator && this.r < 26) {
      const d2 = dist2(this.x, this.y, lu.x, lu.y);
      if (d2 < 22 * 22) { this.speedNow = 0; this.a += angDiff(this.a, Math.atan2(lu.y - this.y, lu.x - this.x)) * dt * 3; return; }
      if (d2 < 480 * 480) desired = Math.atan2(lu.y - this.y, lu.x - this.x);
    }
    this.move(desired, speed, dt);
  }
  hitFx() { this.game.fx.hit(this.x, this.y, '#fff0d0'); }
}

/* ----------------------------------------------------------- wolf spider */

class Spider extends Critter {
  constructor(game, x, y) {
    super(game, x, y);
    this.kind = 'spider'; this.r = 21; this.size = 1.05; this.gaitK = 0.11; this.predator = true; this.fear = 5;
    this.maxHp = this.hp = 190; this.state = 'ambush'; this.home = { x, y }; this.think = 0; this.eatT = 0;
    this.hidden = 0; this.rushT = 0;
  }
  get invuln() { return this.state === 'hide'; }
  /* A wolf spider: waits at its burrow mouth and rushes passing ants; prowls further at night;
     dives into the burrow to recover when a crowd of ants gangs up on it. */
  update(dt) {
    const g = this.game;
    this.hurtT -= dt; this.biteCd -= dt; this.biteT -= dt; this.think -= dt;
    const atHome = dist2(this.x, this.y, this.home.x, this.home.y) < 40 * 40;
    const night = g.darkness() > 0.3;
    if (this.think <= 0 && this.state !== 'hide') {
      this.think = 0.35;
      const mob = antMob(g, this.x, this.y, 110);
      if (this.hp < this.maxHp * 0.35 || mob > 9) { this.state = 'flee'; this.target = null; }
    }
    this.hidden = lerp(this.hidden, this.state === 'ambush' ? 0.6 : this.state === 'hide' ? 1 : 0, Math.min(1, dt * 4));
    switch (this.state) {
      case 'ambush':
        if (!atHome) { this.move(Math.atan2(this.home.y - this.y, this.home.x - this.x), 50, dt, 4); break; }
        this.speedNow = 0;
        this.hp = Math.min(this.maxHp, this.hp + 3 * dt);
        if (this.think <= 0.05) {
          const tg = isolatedAnt(g, this.x, this.y, night ? 260 : 160);
          if (tg) { this.target = tg; this.state = 'rush'; this.rushT = 1.1; }
          else if (night && Math.random() < 0.08) this.state = 'prowl';
        }
        break;
      case 'prowl':
        this.wanderStep(dt, 34, this.home, 420);
        if (this.think <= 0.05) {
          const tg = isolatedAnt(g, this.x, this.y, 220);
          if (tg) { this.target = tg; this.state = 'rush'; this.rushT = 1.1; }
          else if (!night && Math.random() < 0.2) this.state = 'ambush';
        }
        break;
      case 'rush': {
        const tg = this.target;
        if (!tg || tg.dead || tg.inNest) { this.state = tg && tg.dead ? 'drag' : 'ambush'; this.eatT = 3; break; }
        const d = dist(this.x, this.y, tg.x, tg.y), ang = Math.atan2(tg.y - this.y, tg.x - this.x);
        this.rushT -= dt;
        if (d > this.r + tg.r + 1) {
          // a short explosive sprint, then a slower chase if the prey keeps running
          this.move(ang, this.rushT > 0 ? 165 : 78, dt, 7);
          if (d > 320 || dist2(this.x, this.y, this.home.x, this.home.y) > 700 * 700) { this.state = 'ambush'; this.target = null; }
        } else {
          this.a += clamp(angDiff(this.a, ang), -6 * dt, 6 * dt); this.speedNow = 0;
          if (this.biteCd <= 0) { this.biteCd = 0.8; this.biteT = 0.3; tg.damage(15, this); }
        }
        break;
      }
      case 'drag':
        // carry the catch back to the burrow before eating it
        if (!atHome) this.move(Math.atan2(this.home.y - this.y, this.home.x - this.x), 55, dt, 4);
        else { this.speedNow = 0; this.eatT -= dt; if (this.eatT <= 0) this.state = 'ambush'; }
        break;
      case 'flee':
        this.move(Math.atan2(this.home.y - this.y, this.home.x - this.x), 120, dt, 7);
        if (atHome) { this.state = 'hide'; this.eatT = 10; }
        break;
      case 'hide':
        this.speedNow = 0; this.eatT -= dt;
        this.hp = Math.min(this.maxHp, this.hp + 8 * dt);
        if (this.eatT <= 0 && this.hp > this.maxHp * 0.6) this.state = 'ambush';
        break;
    }
  }
  damage(amt, src) {
    if (this.dead || this.invuln) return;
    this.hp -= amt; this.hurtT = 0.15; this.hitFx();
    if (this.hp <= 0) { this.dead = true; this.game.onCritterDeath(this, src); return; }
    if (src && src.kind === 'ant' && (this.state === 'ambush' || this.state === 'prowl' || this.state === 'drag') && this.hp > this.maxHp * 0.35) { this.target = src; this.state = 'rush'; this.rushT = 0.5; }
  }
  draw(ctx, t) {
    if (this.hidden > 0.98) { drawSpiderEyes(ctx, this, t); return; }
    ctx.globalAlpha = 1 - this.hidden * 0.55;
    drawSpider(ctx, this, t);
    ctx.globalAlpha = 1;
    if (this.hidden > 0.3) drawSpiderEyes(ctx, this, t);
  }
}

/* ----------------------------------------------------------- stag beetle */

class Beetle extends Critter {
  constructor(game, x, y) {
    super(game, x, y);
    this.kind = 'beetle'; this.r = 16; this.size = 0.95; this.gaitK = 0.22;
    this.maxHp = this.hp = 120;
  }
  update(dt) {
    this.hurtT -= dt; this.biteCd -= dt; this.biteT -= dt; this.angryT -= dt;
    const tg = this.target;
    if (this.angryT > 0 && tg && !tg.dead && dist2(this.x, this.y, tg.x, tg.y) < 300 * 300) {
      const d = dist(this.x, this.y, tg.x, tg.y), ang = Math.atan2(tg.y - this.y, tg.x - this.x);
      if (d > this.r + tg.r + 6) this.move(ang, 42, dt, 3);
      else {
        this.a += clamp(angDiff(this.a, ang), -3 * dt, 3 * dt); this.speedNow = 0;
        if (this.biteCd <= 0) { this.biteCd = 1.1; this.biteT = 0.3; tg.damage(11, this); }
      }
    } else {
      this.target = null;
      this.wanderStep(dt, 20);
    }
  }
  damage(amt, src) {
    if (this.dead) return;
    this.hp -= amt; this.hurtT = 0.15; this.hitFx();
    if (src && src.team) { this.angryT = 9; this.angryTeam = src.team; if (src.kind === 'ant') this.target = src; }
    if (this.hp <= 0) { this.dead = true; this.game.onCritterDeath(this, src); }
  }
  draw(ctx, t) { drawBeetle(ctx, this, t); }
}

/* -------------------------------------------------------------- pill bug */

class Pillbug extends Critter {
  constructor(game, x, y) {
    super(game, x, y);
    this.kind = 'pillbug'; this.r = 8; this.size = 1; this.gaitK = 0.9;
    this.curl = 0; this.curlT = 0; this.roll = 0; this.vx = 0; this.vy = 0; this.hp = 1;
  }
  get invuln() { return this.curl > 0.3; }
  update(dt) {
    if (this.curlT > 0) {
      this.curlT -= dt;
      this.curl = Math.min(1, this.curl + dt * 6);
      this.game.world.moveTo(this, this.x + this.vx * dt, this.y + this.vy * dt);
      const sp = Math.hypot(this.vx, this.vy);
      this.roll += (sp * dt) / 6;
      const f = Math.pow(0.08, dt);
      this.vx *= f; this.vy *= f;
      this.speedNow = 0;
    } else {
      this.curl = Math.max(0, this.curl - dt * 2);
      if (this.curl <= 0) this.wanderStep(dt, 22);
    }
  }
  damage(amt, src) {
    if (this.curlT <= 0) this.game.fx.text(this.x, this.y - 14, 'boing', '#e8ecf4');
    this.curlT = 4.5;
    const ang = src ? Math.atan2(this.y - src.y, this.x - src.x) : rand(TAU);
    this.vx = Math.cos(ang) * 110; this.vy = Math.sin(ang) * 110;
    this.game.fx.dust(this.x, this.y, 3);
  }
  draw(ctx, t) { drawPillbug(ctx, this, t); }
}

/* ----------------------------------------------------------- caterpillar */

class Caterpillar extends Critter {
  constructor(game, x, y) {
    super(game, x, y);
    this.kind = 'caterpillar'; this.r = 8; this.size = 1; this.gaitK = 0.3; this.prey = true;
    this.maxHp = this.hp = 60; this.thrash = 0.6; this.fleeFrom = null;
    this.segs = [];
    for (let i = 0; i < 10; i++) this.segs.push({ x: x - Math.cos(this.a) * i * 5.6, y: y - Math.sin(this.a) * i * 5.6 });
  }
  update(dt) {
    this.hurtT -= dt; this.angryT -= dt;
    if (this.angryT > 0 && this.fleeFrom && !this.fleeFrom.dead) {
      this.thrash = Math.min(2.6, this.thrash + dt * 6);
      this.move(Math.atan2(this.y - this.fleeFrom.y, this.x - this.fleeFrom.x), 30, dt, 2.5);
    } else {
      this.thrash = Math.max(0.6, this.thrash - dt * 2);
      const pulse = 0.55 + 0.45 * Math.sin(this.game.time * 3 + this.id);
      this.wanderStep(dt, 15 * pulse);
    }
    this.segs[0].x = this.x; this.segs[0].y = this.y;
    for (let i = 1; i < this.segs.length; i++) {
      const p = this.segs[i], q = this.segs[i - 1];
      const d = dist(p.x, p.y, q.x, q.y);
      if (d > 5.6) { p.x = q.x + ((p.x - q.x) / d) * 5.6; p.y = q.y + ((p.y - q.y) / d) * 5.6; }
    }
  }
  damage(amt, src) {
    if (this.dead) return;
    this.hp -= amt; this.hurtT = 0.15; this.hitFx();
    if (src && src.team) { this.angryT = 10; this.angryTeam = src.team; this.fleeFrom = src; }
    if (this.hp <= 0) { this.dead = true; this.game.onCritterDeath(this, src); }
  }
  draw(ctx, t) { drawCaterpillar(ctx, this, t); }
}

/* ----------------------------------------------------------------- snail */

class Snail extends Critter {
  constructor(game, x, y) {
    super(game, x, y);
    this.kind = 'snail'; this.r = 12; this.size = 1; this.gaitK = 0.2;
    this.ext = 1; this.hideT = 0; this.trail = []; this.lastT = { x, y };
  }
  get invuln() { return true; }
  update(dt) {
    const now = this.game.time;
    if (this.hideT > 0) { this.hideT -= dt; this.ext = Math.max(0, this.ext - dt * 4); this.speedNow = 0; }
    else {
      this.ext = Math.min(1, this.ext + dt * 0.8);
      if (this.ext > 0.9) this.wanderStep(dt, 9);
    }
    if (dist2(this.x, this.y, this.lastT.x, this.lastT.y) > 36) {
      this.trail.push({ x: this.x, y: this.y, t: now });
      this.lastT = { x: this.x, y: this.y };
    }
    while (this.trail.length && now - this.trail[0].t > 45) this.trail.shift();
  }
  damage(amt, src) {
    if (this.hideT <= 0) this.game.fx.text(this.x, this.y - 16, 'tuck', '#e8dccc');
    this.hideT = 6;
  }
  drawTrail(ctx) {
    const tr = this.trail;
    if (tr.length < 2) return;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(215,228,236,0.22)'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(tr[0].x, tr[0].y);
    for (let i = 1; i < tr.length; i++) ctx.lineTo(tr[i].x, tr[i].y);
    ctx.lineTo(this.x, this.y);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1.6;
    ctx.stroke();
  }
  draw(ctx, t) { drawSnail(ctx, this, t); }
}

/* -------------------------------------------------------------- ladybird */

class Ladybug extends Critter {
  constructor(game, patch) {
    const sa = rand(TAU);
    const x = patch.x + Math.cos(sa) * 1000, y = patch.y + Math.sin(sa) * 1000;
    super(game, x, y);
    this.kind = 'ladybug'; this.r = 8; this.size = 1.05; this.gaitK = 0.6;
    this.maxHp = this.hp = 26; this.patch = patch;
    this.z = 70; this.open = 1; this.flying = true; this.state = 'arrive';
    this.eatT = 0; this.idle = 0; this.nearPatch = false; this.leaveA = 0;
    this.a = Math.atan2(patch.y - y, patch.x - x);
  }
  get invuln() { return this.flying || this.state === 'leave'; }
  update(dt) {
    const p = this.patch, g = this.game;
    this.hurtT -= dt;
    this.nearPatch = !this.flying && dist2(this.x, this.y, p.x, p.y) < (p.r + 70) ** 2;
    switch (this.state) {
      case 'arrive': {
        const ang = Math.atan2(p.y - this.y, p.x - this.x);
        this.a += clamp(angDiff(this.a, ang), -2 * dt, 2 * dt);
        this.x += Math.cos(this.a) * 130 * dt; this.y += Math.sin(this.a) * 130 * dt;
        if (dist2(this.x, this.y, p.x, p.y) < (p.r * 0.8) ** 2) this.state = 'land';
        break;
      }
      case 'land':
        this.z = Math.max(0, this.z - 50 * dt);
        this.x += Math.cos(this.a) * 25 * dt; this.y += Math.sin(this.a) * 25 * dt;
        if (this.z <= 0) {
          this.open = Math.max(0, this.open - dt * 3);
          if (this.open <= 0) { this.flying = false; this.state = 'hunt'; }
        }
        break;
      case 'hunt': {
        let ap = null, bd = Infinity;
        for (const a of p.aphids) { if (a.dead) continue; const d2 = dist2(this.x, this.y, a.x, a.y); if (d2 < bd) { bd = d2; ap = a; } }
        if (!ap) {
          this.idle += dt; this.wanderStep(dt, 18, p, p.r);
          if (this.idle > 6) this.leave(null);
          break;
        }
        if (Math.sqrt(bd) > this.r + ap.r) { this.move(Math.atan2(ap.y - this.y, ap.x - this.x), 30, dt, 4); this.eatT = 0; }
        else {
          this.speedNow = 0; this.eatT += dt; this.biteT = 0.2;
          if (this.eatT > 2.6) {
            ap.dead = true; this.eatT = 0;
            g.fx.sparkle(ap.x, ap.y, '#b7e07a', 4);
            g.onAphidEaten(p, this);
          }
        }
        break;
      }
      case 'leave':
        this.open = Math.min(1, this.open + dt * 4);
        if (this.open >= 1) {
          this.flying = true; this.z += 50 * dt;
          this.a += clamp(angDiff(this.a, this.leaveA), -3 * dt, 3 * dt);
          this.x += Math.cos(this.a) * 140 * dt; this.y += Math.sin(this.a) * 140 * dt;
          if (dist2(this.x, this.y, p.x, p.y) > 1400 * 1400) this.dead = true;
        }
        break;
    }
    if (this.flying) this.gait += dt * 20;
  }
  leave(src) {
    if (this.state === 'leave') return;
    this.state = 'leave';
    this.leaveA = src ? Math.atan2(this.y - src.y, this.x - src.x) : rand(TAU);
  }
  damage(amt, src) {
    if (this.invuln) return;
    this.hp -= amt; this.hurtT = 0.15; this.hitFx();
    if (this.hp <= 12) { this.leave(src); this.game.onLadybugRepelled(this, src); }
  }
  draw(ctx, t) { drawLadybug(ctx, this, t); }
}

/* ----------------------------------------------------------------- aphid */

class Aphid {
  constructor(patch, x, y) {
    this.kind = 'aphid'; this.id = UID++; this.patch = patch;
    this.x = x; this.y = y; this.hx = x; this.hy = y;
    this.a = rand(TAU); this.size = rand(1.25, 1.6); this.r = 3.6 * this.size;
    this.ready = Math.random() < 0.5; this.readyT = rand(3, 10);
    this.dead = false; this.gait = 0; this.claimed = null; this.moveT = rand(2, 8); this.tx = x; this.ty = y;
  }
  update(dt) {
    if (!this.ready) { this.readyT -= dt; if (this.readyT <= 0) this.ready = true; }
    this.moveT -= dt;
    if (this.moveT <= 0) {
      this.moveT = rand(4, 12);
      this.tx = this.hx + rand(-10, 10); this.ty = this.hy + rand(-10, 10);
    }
    const d = dist(this.x, this.y, this.tx, this.ty);
    if (d > 0.5) {
      const ang = Math.atan2(this.ty - this.y, this.tx - this.x);
      this.a += clamp(angDiff(this.a, ang), -3 * dt, 3 * dt);
      this.x += Math.cos(this.a) * 5 * dt; this.y += Math.sin(this.a) * 5 * dt;
      this.gait += dt * 5;
    }
  }
  draw(ctx, t) { drawAphid(ctx, this, t); }
}

/* ------------------------------------------------------------- butterfly */

class Butterfly {
  constructor(game, x, y) {
    this.game = game; this.kind = 'butterfly'; this.id = UID++;
    this.x = x; this.y = y;
    this.a = rand(TAU); this.z = rand(30, 70); this.size = rand(0.72, 0.9);
    this.variant = pick(['peacock', 'peacock', 'brimstone', 'blue']);
    this.state = 'fly'; this.tx = null; this.flower = null; this.landed = false; this.restT = 0; this.dead = false;
  }
  update(dt) {
    const g = this.game, t = g.time;
    if (this.state === 'fly') {
      if (this.tx === null || dist2(this.x, this.y, this.tx, this.ty) < 30 * 30) {
        if (this.flower && dist2(this.x, this.y, this.flower.x, this.flower.y) < 900) { this.state = 'land'; return; }
        const fl = g.world.flowersNear(this.x + rand(-400, 400), this.y + rand(-400, 400));
        if (Math.random() < 0.4 && fl.length) {
          const f = pick(fl);
          this.flower = f;
          if (f) { this.tx = f.x; this.ty = f.y; }
        } else this.flower = null;
        if (!this.flower) {
          this.tx = this.x + rand(-600, 600);
          this.ty = this.y + rand(-600, 600);
        }
      }
      const ang = Math.atan2(this.ty - this.y, this.tx - this.x) + Math.sin(t * 2.3 + this.id) * 0.6;
      this.a += clamp(angDiff(this.a, ang), -3 * dt, 3 * dt);
      this.x += Math.cos(this.a) * 70 * dt; this.y += Math.sin(this.a) * 70 * dt;
      this.z = lerp(this.z, 45 + Math.sin(t * 1.3 + this.id) * 18, dt * 2);
    } else if (this.state === 'land') {
      const f = this.flower;
      this.x = lerp(this.x, f.x, dt * 3); this.y = lerp(this.y, f.y, dt * 3);
      this.z = Math.max(1, this.z - 40 * dt);
      if (this.z <= 1) { this.landed = true; this.state = 'rest'; this.restT = rand(3, 8); }
    } else if (this.state === 'rest') {
      this.restT -= dt;
      let scared = false;
      g.hash.query(this.x, this.y, 36, (o) => { if (o.kind === 'ant' && dist2(this.x, this.y, o.x, o.y) < 36 * 36) scared = true; });
      if (scared || this.restT <= 0) { this.state = 'fly'; this.landed = false; this.flower = null; this.tx = null; }
    }
  }
  draw(ctx, t) { drawButterfly(ctx, this, t); }
}

/* ------------------------------------------------------------- dragonfly */

class Dragonfly {
  constructor(game, x, y) {
    this.game = game; this.kind = 'dragonfly'; this.id = UID++;
    this.home = { x, y };
    this.x = x + rand(-200, 200); this.y = y + rand(-200, 200);
    this.a = rand(TAU); this.z = 55; this.size = 0.95;
    this.state = 'hover'; this.timer = 1; this.tx = this.x; this.ty = this.y; this.dead = false;
  }
  update(dt) {
    const c = this.home;
    this.timer -= dt;
    if (this.state === 'hover') {
      this.x += Math.sin(this.game.time * 3 + this.id) * 6 * dt;
      if (this.timer <= 0) {
        this.state = 'dash';
        this.tx = c.x + rand(-520, 520);
        this.ty = c.y + rand(-520, 520);
        this.a = Math.atan2(this.ty - this.y, this.tx - this.x);
      }
    } else {
      const d = dist(this.x, this.y, this.tx, this.ty);
      const sp = Math.min(380, d * 4 + 40);
      this.x += Math.cos(this.a) * sp * dt; this.y += Math.sin(this.a) * sp * dt;
      if (d < 8) { this.state = 'hover'; this.timer = rand(0.6, 2.2); }
    }
  }
  draw(ctx, t) { drawDragonfly(ctx, this, t); }
}

/* --------------------------------------------------------------- firefly */

class Firefly {
  constructor(game, x, y) {
    this.game = game; this.kind = 'firefly'; this.id = UID++;
    this.x = x; this.y = y; this.a = rand(TAU); this.z = rand(8, 26);
    this.freq = rand(1.8, 3.6); this.ph = rand(TAU); this.fade = 0; this.dead = false; this.leaving = false;
  }
  update(dt) {
    this.a += (Math.random() - 0.5) * dt * 4;
    this.x += Math.cos(this.a) * 14 * dt; this.y += Math.sin(this.a) * 14 * dt;
    this.fade = this.leaving ? Math.max(0, this.fade - dt * 0.5) : Math.min(1, this.fade + dt * 0.5);
    if (this.leaving && this.fade <= 0) this.dead = true;
  }
}

/* ------------------------------------------------------------------ food */

const FOOD_KINDS = {
  crumb: { v: 1, r: 4.5, name: 'bread crumb' },
  seed: { v: 1, r: 4, name: 'sunflower seed' },
  berry: { v: 2, r: 4.8, name: 'berry' },
  honey: { v: 2, r: 3.2, name: 'honeydew drop' },
  husk: { v: 1, r: 6, name: 'fallen ant' },
  leafbit: { v: 1, r: 6, name: 'leaf fragment' },
};

class Food {
  constructor(kind, x, y) {
    const k = FOOD_KINDS[kind];
    this.kind = kind; this.x = x; this.y = y; this.a = rand(TAU);
    this.value = k.v; this.r = k.r; this.name = k.name;
    this.seed = (Math.random() * 1e9) | 0; this.id = UID++;
    this.taken = false; this.pal = 'black';
    if (kind === 'crumb') this.shape = makeCrumbShape(this.seed, this.r);
  }
}

const BIG_KINDS = {
  sugar: { needs: 2, value: 8, r: 10, name: 'sugar cube' },
  apple: { needs: 5, value: 26, r: 19, name: 'apple slice' },
  caterpillar: { needs: 3, value: 14, r: 13, name: 'caterpillar' },
  beetle: { needs: 4, value: 22, r: 18, name: 'stag beetle' },
  spider: { needs: 6, value: 36, r: 25, name: 'wolf spider' },
  crab: { needs: 10, value: 60, r: 30, name: 'shore crab' },
  frog: { needs: 9, value: 50, r: 26, name: 'frog' },
  lizard: { needs: 8, value: 45, r: 30, name: 'lizard' },
  mouse: { needs: 9, value: 55, r: 26, name: 'mouse' },
  worm: { needs: 4, value: 18, r: 20, name: 'earthworm' },
  centipede: { needs: 5, value: 24, r: 18, name: 'centipede' },
  scorpion: { needs: 6, value: 32, r: 22, name: 'scorpion' },
  grasshopper: { needs: 2, value: 10, r: 14, name: 'grasshopper' },
  bee: { needs: 2, value: 9, r: 10, name: 'honeybee' },
  mantis: { needs: 4, value: 20, r: 18, name: 'praying mantis' },
};

class BigFood {
  constructor(game, kind, x, y, a) {
    const k = BIG_KINDS[kind];
    this.game = game; this.kind = kind; this.x = x; this.y = y; this.a = a ?? rand(TAU);
    this.needs = k.needs; this.value = k.value; this.r = k.r; this.name = k.name;
    this.big = true; this.carriers = []; this.done = false; this.taken = false;
    this.id = UID++; this.seed = (Math.random() * 1e9) | 0; this.moving = 0;
  }
  addCarrier(ant) {
    if (!this.carriers.includes(ant)) this.carriers.push(ant);
    ant.big = this;
    if (!ant.isPlayer) ant.state = 'carry';
  }
  removeCarrier(ant) {
    const i = this.carriers.indexOf(ant);
    if (i >= 0) this.carriers.splice(i, 1);
  }
  update(dt) {
    const g = this.game;
    this.carriers = this.carriers.filter((c) => !c.dead && c.big === this);
    const n = this.carriers.length;
    let px = 0, py = 0;
    for (const c of this.carriers) {
      if (c.isPlayer) {
        const m = g.input.move;
        const pull = 1.4 + 1.6 * g.perk('lifter');
        px += m.x * pull; py += m.y * pull;
        continue;
      }
      const nest = c.colony.dropPoint(this.x, this.y);
      const d = dist(this.x, this.y, nest.x, nest.y) || 1;
      px += (nest.x - this.x) / d; py += (nest.y - this.y) / d;
    }
    const mag = Math.hypot(px, py);
    let speed = 0;
    if (n >= Math.ceil(this.needs / 2) && mag > 0.05) speed = 30 * clamp(mag / this.needs, 0, 1.35);
    if (speed > 0) {
      this.swims = this.carriers.some((c) => c.swims);
      // the team steers the load around rocks and water instead of shoving into them
      const lead = this.carriers.find((c) => !c.isPlayer);
      const goal = lead ? lead.colony.dropPoint(this.x, this.y) : null;
      const dir = navigate(g.world, this, Math.atan2(py, px), this.r + 18, false, dt, speed, goal);
      this.navA = dir;
      g.world.moveTo(this, this.x + Math.cos(dir) * speed * dt, this.y + Math.sin(dir) * speed * dt);
      this.a += angDiff(this.a, dir) * 0.4 * dt;
    }
    this.moving = speed;
    const R = this.r + 3;
    for (let i = 0; i < n; i++) {
      const c = this.carriers[i];
      const sa = this.a + (i / n) * TAU + 0.3;
      const tx = this.x + Math.cos(sa) * (R + c.r * 0.6), ty = this.y + Math.sin(sa) * (R + c.r * 0.6);
      const k = Math.min(1, dt * 8);
      c.x = lerp(c.x, tx, k); c.y = lerp(c.y, ty, k);
      c.a += clamp(angDiff(c.a, Math.atan2(this.y - c.y, this.x - c.x)), -6 * dt, 6 * dt);
      c.gait += (speed * 0.6 + 4) * dt; c.speedNow = speed;
    }
    for (const col of g.activeColonies) {
      if (col.dead) continue;
      for (const pt of col.dropPoints()) {
        if (dist2(this.x, this.y, pt.x, pt.y) < (pt.r * 0.6) ** 2) { g.deliverBig(this, col); return; }
      }
    }
  }
  draw(ctx, t) {
    drawFood(ctx, this, t);
    if (this.carriers.length && this.carriers.length < Math.ceil(this.needs / 2)) {
      ctx.fillStyle = 'rgba(255,240,200,0.8)';
      ctx.font = '600 9px "Atkinson Hyperlegible", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${this.carriers.length}/${this.needs}`, this.x, this.y - this.r - 8);
    }
  }
}

/* --------------------------------------------------------------- effects */

class FX {
  constructor() { this.parts = []; this.rings = []; this.texts = []; }
  dust(x, y, n = 3) {
    for (let i = 0; i < n; i++) {
      const a = rand(TAU), s = rand(10, 30);
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.7, max: 0.7, r: rand(1.5, 3.5), c: 'rgba(180,150,105,', kind: 'dust' });
    }
  }
  hit(x, y, color = '#fff0d0') {
    for (let i = 0; i < 4; i++) {
      const a = rand(TAU), s = rand(30, 70);
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.25, max: 0.25, r: 1.2, c: color, kind: 'spark', a });
    }
  }
  sparkle(x, y, color, n = 5) {
    for (let i = 0; i < n; i++) {
      const a = rand(TAU), s = rand(8, 24);
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 10, life: 0.9, max: 0.9, r: rand(0.8, 1.6), c: color, kind: 'star' });
    }
  }
  ring(x, y, r, rgbaPrefix, dur = 0.8) { this.rings.push({ x, y, r, c: rgbaPrefix, life: dur, max: dur }); }
  text(x, y, s, color) { this.texts.push({ x, y, s, c: color, life: 1.4, max: 1.4 }); }
  twinkle(x, y) { this.parts.push({ x, y, vx: 0, vy: 0, life: 0.9, max: 0.9, r: 3, c: '#ffffff', kind: 'tw' }); }
  update(dt) {
    for (const p of this.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; }
    for (const r of this.rings) r.life -= dt;
    for (const t of this.texts) { t.life -= dt; t.y -= 16 * dt; }
    this.parts = this.parts.filter((p) => p.life > 0);
    this.rings = this.rings.filter((r) => r.life > 0);
    this.texts = this.texts.filter((t) => t.life > 0);
  }
  draw(ctx) {
    for (const p of this.parts) {
      const k = p.life / p.max;
      if (p.kind === 'dust') {
        ctx.fillStyle = p.c + (0.5 * k) + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1.6 - k * 0.6), 0, TAU); ctx.fill();
      } else if (p.kind === 'tw') {
        const a = Math.sin((1 - k) * Math.PI) * 0.8, r = p.r;
        ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(p.x - r, p.y); ctx.lineTo(p.x + r, p.y); ctx.moveTo(p.x, p.y - r); ctx.lineTo(p.x, p.y + r); ctx.stroke();
      } else if (p.kind === 'spark') {
        ctx.strokeStyle = p.c; ctx.globalAlpha = k; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05); ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = k; ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    for (const r of this.rings) {
      const k = 1 - r.life / r.max;
      ctx.strokeStyle = r.c + (0.55 * (1 - k)) + ')';
      ctx.lineWidth = 2.5 * (1 - k) + 0.5;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r * (0.15 + 0.85 * k), 0, TAU); ctx.stroke();
    }
    ctx.textAlign = 'center';
    ctx.font = '800 12px Sniglet, "Trebuchet MS", sans-serif';
    for (const t of this.texts) {
      const k = t.life / t.max;
      ctx.globalAlpha = Math.min(1, k * 2);
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(25,22,10,0.7)';
      ctx.strokeText(t.s, t.x, t.y);
      ctx.fillStyle = t.c; ctx.fillText(t.s, t.x, t.y);
      ctx.globalAlpha = 1;
    }
  }
}
