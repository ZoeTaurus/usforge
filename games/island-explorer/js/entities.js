'use strict';
// Creatures, townsfolk and Biscuit the cat.
const MOB_DEF = {
  crab:     { hp: 2, speed: 22, dmg: 8,  ai: 'wander', drops: { meat: 1 } },
  snake:    { hp: 2, speed: 18, chase: 36, range: 70, dmg: 12, ai: 'chase', lunge: true, drops: {} },
  boar:     { hp: 4, speed: 22, range: 92, dmg: 18, ai: 'charge', drops: { meat: 1, hide: 1 } },
  rabbit:   { hp: 1, speed: 20, flee: 92, range: 56, dmg: 0, ai: 'flee', drops: { meat: 1 } },
  deer:     { hp: 3, speed: 18, flee: 86, range: 80, dmg: 0, ai: 'flee', drops: { meat: 2, hide: 1 } },
  wolf:     { hp: 3, speed: 28, chase: 80, range: 115, dmg: 12, ai: 'chase', bite: true, drops: { hide: 1 } },
  bear:     { hp: 9, speed: 18, chase: 54, range: 84, dmg: 26, ai: 'chase', drops: { meat: 3, hide: 2 } },
  croc:     { hp: 5, speed: 8,  range: 46, dmg: 22, ai: 'ambush', drops: { meat: 1, hide: 1 } },
  scorpion: { hp: 3, speed: 24, chase: 46, range: 66, dmg: 12, ai: 'chase', drops: {} },
};

class Mob {
  constructor(kind, tx, ty, temp = false) {
    this.kind = kind; this.temp = temp;
    this.x = this.homeX = tx * 16 + 8;
    this.y = this.homeY = ty * 16 + 4;
    this.maxHp = this.hp = MOB_DEF[kind].hp;
    this.vx = 0; this.vy = 0; this.kx = 0; this.ky = 0;
    this.t = Math.random() * 2; this.face = 1; this.hurt = 0; this.anim = 0;
    this.dead = false; this.respawnT = 0;
    this.state = 'wander'; this.stateT = 0; this.lungeCD = 0;
  }

  setWander() {
    const D = MOB_DEF[this.kind];
    this.t = (D.ai === 'ambush' ? 3 : 1) + Math.random() * 2.5;
    if (Math.random() < (D.ai === 'ambush' ? 0.7 : 0.35)) { this.vx = 0; this.vy = 0; }
    else {
      const a = Math.random() * Math.PI * 2;
      this.vx = Math.cos(a); this.vy = Math.sin(a);
      if (this.kind === 'crab') this.vy *= 0.25; // crabs scuttle sideways
    }
    const hx = this.homeX - this.x, hy = this.homeY - this.y, hd = Math.hypot(hx, hy);
    if (hd > 110) { this.vx = hx / hd; this.vy = hy / hd; }
  }

  move(dx, dy) {
    let hitWall = false;
    if (Game.canWalk(this.x + dx, this.y, true)) this.x += dx; else hitWall = true;
    if (Game.canWalk(this.x, this.y + dy, true)) this.y += dy; else hitWall = true;
    return hitWall;
  }

  update(dt, p) {
    if (this.dead) {
      if (this.temp) return;
      this.respawnT -= dt;
      if (this.respawnT <= 0 && Math.hypot(p.x - this.homeX, p.y - this.homeY) > 260) {
        Object.assign(this, { dead: false, hp: this.maxHp, x: this.homeX, y: this.homeY, state: 'wander', kx: 0, ky: 0 });
      }
      return;
    }
    const D = MOB_DEF[this.kind];
    this.t -= dt; this.stateT -= dt; this.lungeCD -= dt;
    this.hurt = Math.max(0, this.hurt - dt);
    const dx = p.x - this.x, dy = p.y - this.y, dist = Math.hypot(dx, dy) || 1;
    if (dist > 480 && !this.temp) return; // far away: sleep
    const bold = FX.darkness > 0.35 ? 1.45 : 1;
    const canSee = p.mode === 'walk' && Game.state === 'play' && Math.hypot(this.x - this.homeX, this.y - this.homeY) < 240;
    let sp = D.speed, dangerous = D.dmg > 0;

    switch (D.ai) {
      case 'flee':
        if (dist < D.range && Game.state === 'play') {
          if (this.state !== 'flee') { this.state = 'flee'; this.t = 0; }
          if (this.t <= 0) {
            const a = Math.atan2(-dy, -dx) + (Math.random() - 0.5) * 1.2;
            this.vx = Math.cos(a); this.vy = Math.sin(a); this.t = 0.4;
          }
          sp = D.flee;
        } else { this.state = 'wander'; if (this.t <= 0) this.setWander(); }
        break;
      case 'charge':
        switch (this.state) {
          case 'wander':
            if (this.t <= 0) this.setWander();
            if (canSee && dist < D.range * bold) {
              this.state = 'alert'; this.stateT = 0.55; this.vx = this.vy = 0;
              this.face = dx > 0 ? 1 : -1; Sound.bang();
            }
            break;
          case 'alert':
            sp = 0; this.face = dx > 0 ? 1 : -1;
            if (this.stateT <= 0) { this.state = 'charge'; this.stateT = 0.9; this.vx = dx / dist; this.vy = dy / dist; }
            break;
          case 'charge': sp = 140; if (this.stateT <= 0) { this.state = 'rest'; this.stateT = 0.8; } break;
          case 'rest': sp = 0; dangerous = false; if (this.stateT <= 0) { this.state = 'wander'; this.t = 0.5; this.vx = this.vy = 0; } break;
        }
        break;
      case 'ambush':
        if (this.state === 'lunge') {
          sp = 170;
          if (this.stateT <= 0) { this.state = 'wander'; this.vx = this.vy = 0; this.t = 1.5; }
        } else if (canSee && dist < D.range * bold && this.lungeCD <= 0) {
          this.state = 'lunge'; this.stateT = 0.28; this.lungeCD = 2.4;
          this.vx = dx / dist; this.vy = dy / dist; Sound.bang();
        } else if (this.t <= 0) this.setWander();
        break;
      case 'chase':
        if (this.state === 'lunge') {
          sp = 150;
          if (this.stateT <= 0) { this.state = 'wander'; this.vx = this.vy = 0; this.t = 0.8; }
        } else if (this.state === 'retreat') {
          sp = 60; dangerous = false;
          if (this.stateT <= 0) this.state = 'wander';
        } else if (canSee && dist < D.range * bold) {
          this.vx = dx / dist; this.vy = dy / dist; sp = D.chase;
          if (D.lunge && dist < 30 && this.lungeCD <= 0) { this.state = 'lunge'; this.stateT = 0.16; this.lungeCD = 1.6; }
        } else if (this.t <= 0) this.setWander();
        break;
      default:
        if (this.t <= 0) this.setWander();
    }

    if (this.hurt > 0) sp *= 0.3;
    const mx = this.vx * sp * dt + this.kx * dt, my = this.vy * sp * dt + this.ky * dt;
    const damp = Math.pow(0.002, dt);
    this.kx *= damp; this.ky *= damp;
    const hitWall = this.move(mx, my);
    if (hitWall) {
      if (this.state === 'charge') { this.state = 'rest'; this.stateT = 1.4; this.stunned = true; FX.shake(2, 0.15); Sound.hit(); }
      else if (this.state === 'wander' || this.state === 'flee') { this.vx *= -1; this.vy *= -1; }
    }
    if (this.state !== 'rest') this.stunned = false;
    if (Math.abs(this.vx) > 0.1 && sp > 0) this.face = this.vx > 0 ? 1 : -1;
    if ((this.vx || this.vy) && sp > 0) this.anim += dt * (sp > 60 ? 14 : 6);
    if (dangerous && dist < 11 && Math.abs(dy) < 10 && p.mode === 'walk' && this.hurt <= 0) {
      if (Game.hurtPlayer(D.dmg, this.x, this.y) && D.bite) {
        this.state = 'retreat'; this.stateT = 0.8; this.vx = -dx / dist; this.vy = -dy / dist;
      }
    }
  }

  draw(c, camX, camY, time) {
    if (this.dead) return;
    const set = Sprites.mobs[this.kind];
    const shake = this.state === 'alert' ? Math.round(Math.sin(time * 60)) : 0;
    let img = (this.face > 0 ? set.r : set.l)[Math.floor(this.anim) % 2];
    if (this.hurt > 0.2) img = Sprites.white(img);
    const x = Math.round(this.x - 8 - camX) + shake, y = Math.round(this.y - 8 - camY);
    c.drawImage(img, x, y);
    if (this.state === 'alert') c.drawImage(Sprites.fx.bang, x + 6, y - 9);
    if (this.stunned) {
      c.fillStyle = '#ffe060';
      for (let i = 0; i < 3; i++) {
        const a = time * 6 + i * 2.1;
        c.fillRect(Math.round(x + 8 + Math.cos(a) * 5), Math.round(y + 2 + Math.sin(a) * 2), 1, 1);
      }
    }
    if (this.hp < this.maxHp) {
      c.fillStyle = '#1a1420'; c.fillRect(x + 3, y - 3, 10, 3);
      c.fillStyle = '#e04a3a'; c.fillRect(x + 4, y - 2, Math.round(8 * this.hp / this.maxHp), 1);
    }
  }
}

// Sharks stalk boats in open water. Hit them and they back off.
class Shark {
  constructor(x, y) {
    Object.assign(this, { x, y, hp: 4, maxHp: 4, flee: 0, face: 1, biteCD: 1, hurt: 0, dead: false, t: Math.random() * 9 });
  }
  update(dt, p) {
    this.t += dt; this.biteCD -= dt; this.flee -= dt; this.hurt = Math.max(0, this.hurt - dt);
    const dx = p.x - this.x, dy = p.y + 4 - this.y, d = Math.hypot(dx, dy) || 1;
    let vx, vy, sp;
    if (p.mode !== 'sail' || this.flee > 0) { vx = -dx / d; vy = -dy / d; sp = 75; }
    else if (d < 170) {
      const a = Math.sin(this.t * 1.3) * 0.7, c = Math.cos(a), s = Math.sin(a);
      vx = (dx / d) * c - (dy / d) * s; vy = (dx / d) * s + (dy / d) * c; sp = 64;
    } else { vx = Math.cos(this.t * 0.3); vy = Math.sin(this.t * 0.4); sp = 30; }
    const nx = this.x + vx * sp * dt, ny = this.y + vy * sp * dt;
    if (TILE[World.get(Math.floor(nx / 16), Math.floor(ny / 16))].sea) { this.x = nx; this.y = ny; }
    if (Math.abs(vx) > 0.1) this.face = vx > 0 ? 1 : -1;
    if (p.mode === 'sail' && d < 15 && this.biteCD <= 0 && this.flee <= 0) { this.biteCD = 2.2; Game.sharkBite(this); }
  }
  draw(c, camX, camY, time) {
    c.drawImage(this.hurt > 0.15 ? Sprites.white(Sprites.fx.shark[Math.floor(time * 3) % 2]) : Sprites.fx.shark[Math.floor(time * 3) % 2], Math.round(this.x - 10 - camX), Math.round(this.y - 8 - camY));
  }
}

class NPC {
  constructor(s) {
    Object.assign(this, { role: s.role, name: s.name, lines: s.lines || [], wander: !!s.wander, lineIdx: 0 });
    this.sprites = Sprites.charSet(s.look);
    this.x = this.homeX = s.x * 16 + 8;
    this.y = this.homeY = s.y * 16 + 4;
    this.dir = 0; this.anim = 0; this.t = Math.random() * 3; this.vx = 0; this.vy = 0; this.talkT = 0;
  }

  nextLine() { const l = this.lines[this.lineIdx % this.lines.length]; this.lineIdx++; return l; }

  update(dt) {
    this.talkT -= dt;
    if (!this.wander || this.talkT > 0) { this.anim = 0; return; }
    this.t -= dt;
    if (this.t <= 0) {
      this.t = 1.5 + Math.random() * 3;
      if (Math.random() < 0.45) { this.vx = this.vy = 0; }
      else { const d = Math.floor(Math.random() * 4); this.vx = DIRV[d][0]; this.vy = DIRV[d][1]; this.dir = d; }
    }
    if (!this.vx && !this.vy) { this.anim = 0; return; }
    const sp = 18 * dt, nx = this.x + this.vx * sp, ny = this.y + this.vy * sp;
    const onCobble = World.get(Math.floor(nx / 16), Math.floor((ny + 4) / 16)) === T.COBBLE;
    if (onCobble && Math.hypot(nx - this.homeX, ny - this.homeY) < 56 && Game.canWalk(nx, ny)) {
      this.x = nx; this.y = ny; this.anim += dt * 7;
    } else { this.vx = this.vy = 0; this.anim = 0; }
  }

  draw(c, camX, camY) {
    const f = this.anim ? [1, 0, 2, 0][Math.floor(this.anim) % 4] : 0;
    c.drawImage(this.sprites[this.dir][f], Math.round(this.x - 8 - camX), Math.round(this.y - 8 - camY));
  }
}

// Biscuit: waits in the forest, then follows the player's footsteps home.
class Cat {
  constructor(tx, ty) {
    this.x = tx * 16 + 8; this.y = ty * 16 + 4;
    this.state = 'lost'; this.face = 1; this.anim = 0; this.meowT = 3 + Math.random() * 4;
  }
  update(dt, p) {
    this.meowT -= dt;
    const dist = Math.hypot(p.x - this.x, p.y - this.y);
    if (this.meowT <= 0) {
      this.meowT = 6 + Math.random() * 8;
      if (dist < 140 && this.state !== 'home') { Sound.meow(); Game.floater(this.x, this.y - 12, 'meow', '#ffd8a0'); }
    }
    if (this.state === 'lost' || this.state === 'home') { this.anim = 0; return; }
    if (this.state === 'wait') {
      if (p.mode === 'walk' && dist < 70) this.state = 'follow';
      this.anim = 0; return;
    }
    // follow the player's trail
    if (p.mode !== 'walk' || dist > 260) { this.state = 'wait'; return; }
    const trail = Game.trail;
    const target = trail.length > 6 ? trail[trail.length - 6] : p;
    const tx = target.x - this.x, ty = target.y - this.y, td = Math.hypot(tx, ty);
    if (td > 4 && dist > 18) {
      const sp = Math.min(td, (dist > 60 ? 110 : 72) * dt);
      this.x += tx / td * sp; this.y += ty / td * sp;
      if (Math.abs(tx) > 1) this.face = tx > 0 ? 1 : -1;
      this.anim += dt * 10;
    } else this.anim = 0;
  }
  draw(c, camX, camY) {
    const set = Sprites.mobs.cat;
    c.drawImage((this.face > 0 ? set.r : set.l)[Math.floor(this.anim) % 2], Math.round(this.x - 8 - camX), Math.round(this.y - 8 - camY));
  }
}
