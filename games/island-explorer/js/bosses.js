'use strict';
// Boss fights: Magmaw (Ember Isle), Old Frostfang (Frostpeak), The Bog King (Mossfen).
// Every big attack is telegraphed with a red circle; dodge-roll (Q) through it or step out.
const BOSS_DEF = {
  magmaw:    { name: 'MAGMAW, THE MOLTEN TITAN', hp: 70, r: 13, dmg: 20, trigger: 95,  leash: 420 },
  frostfang: { name: 'OLD FROSTFANG',            hp: 45, r: 10, dmg: 16, trigger: 120, leash: 360 },
  bogking:   { name: 'THE BOG KING',             hp: 55, r: 12, dmg: 22, trigger: 105, leash: 320 },
};
// states in which touching the boss hurts
const BOSS_DANGER = {
  magmaw: ['idle', 'volley', 'windup', 'charge', 'summon'],
  frostfang: ['prowl', 'crouch', 'howl'],
  bogking: ['exposed'],
};

// ---------------- art ----------------
const BossArt = {
  build() {
    const { make, outline, mirror } = Sprites;
    const both = fn => { const r = [0, 1].map(f => outline(fn(f), '#140a0a')); return { r, l: r.map(mirror) }; };
    Sprites.boss = {};

    Sprites.boss.magmaw = both(f => make(36, 36, P => {
      const r = RNG.mulberry32(900);
      P.ellipse(18, 33, 14, 3, 'rgba(0,0,0,0.35)');
      P.rect(10, 26, 6, 8, '#3a2a2a'); P.rect(20, 26, 6, 8, '#3a2a2a');
      P.ellipse(4.5, 19, 4.5, 7, (dx, dy) => dy < -2 ? '#6a5454' : '#3e2e2e');
      P.ellipse(31.5, 19, 4.5, 7, (dx, dy) => dy < -2 ? '#6a5454' : '#3e2e2e');
      P.ellipse(4.5, 26, 4, 3, '#2e2222'); P.ellipse(31.5, 26, 4, 3, '#2e2222');
      P.ellipse(18, 17, 12.5, 12, (dx, dy) => dx + dy < -8 ? '#6a5454' : dx + dy > 8 ? '#2e2222' : '#4a3a3a');
      const glow = f ? ['#ffd040', '#ff8a2a'] : ['#ff8a2a', '#e04a1a'];
      for (let k = 0; k < 7; k++) {
        let x = 8 + r() * 20, y = 8 + r() * 18;
        for (let s = 0; s < 6; s++) { P.px(x, y, s % 2 ? glow[1] : glow[0]); x += r() < 0.5 ? 1 : -1; y += r() < 0.6 ? 1 : 0; }
      }
      P.px(2, 18, glow[0]); P.px(33, 20, glow[0]);
      P.rect(11, 11, 5, 2, '#ffe060'); P.rect(20, 11, 5, 2, '#ffe060');
      P.rect(13, 18, 10, 3, '#1a0a0a'); P.rect(14, 19, 8, 1, glow[1]);
      for (let x = 14; x < 22; x += 2) P.px(x, 18, '#e8e0d0');
      P.px(8, 4, '#5a4848'); P.px(9, 5, '#5a4848'); P.px(9, 6, '#4a3a3a'); P.px(27, 4, '#5a4848'); P.px(26, 5, '#5a4848'); P.px(26, 6, '#4a3a3a');
    }));

    Sprites.boss.frostfang = both(f => make(30, 24, P => {
      const l = f ? 1 : 0;
      P.ellipse(14, 22, 11, 2, 'rgba(0,0,0,0.3)');
      for (const [x, up] of [[5, l], [8, 1 - l], [17, l], [20, 1 - l]]) P.rect(x, 16, 2, 6 - up, '#8a98a8');
      P.ellipse(13, 13, 10, 5.5, (dx, dy) => dy < -2 ? '#f4f8fc' : dy > 2 ? '#a8b4c4' : '#dfe6ee');
      for (let x = 5; x < 20; x += 2) { P.px(x, 7 - (x % 4 ? 1 : 0), '#f4f8fc'); P.px(x, 8, '#f4f8fc'); }
      P.disc(23, 9, 5, (dx, dy) => dy < -1 ? '#f4f8fc' : '#dfe6ee');
      P.rect(26, 10, 4, 3, '#c8d4e0'); P.px(29, 10, '#1a1a2a');
      P.px(20, 3, '#c8d4e0'); P.px(21, 4, '#c8d4e0'); P.px(24, 3, '#c8d4e0'); P.px(24, 4, '#c8d4e0');
      P.rect(23, 7, 2, 1, '#40c0ff'); P.px(22, 8, '#8a98a8');
      P.px(27, 13, '#ffffff'); P.px(29, 13, '#ffffff');
      P.px(2, 10 - l, '#dfe6ee'); P.px(1, 9 - l, '#dfe6ee'); P.px(0, 8 - l, '#f4f8fc');
    }));

    Sprites.boss.bogking = both(f => make(40, 26, P => {
      const l = f ? 1 : 0;
      P.ellipse(20, 23, 17, 2.5, 'rgba(0,0,0,0.3)');
      P.rect(9, 18 + l, 3, 4, '#1e3a1a'); P.rect(25, 18 + 1 - l, 3, 4, '#1e3a1a');
      for (let x = 0; x < 40; x++) {
        const th = x < 6 ? 1 + x * 0.4 : x > 30 ? 3.5 : 5.5;
        P.ellipse(x + 0.5, 16, 0.6, th, (dx, dy) => dy < -th * 0.4 ? '#4e7a3a' : x % 4 === 0 ? '#2e5a2a' : '#3e6a30');
      }
      for (let x = 4; x < 30; x += 3) { P.px(x, 10, '#1e3a1a'); P.px(x + 1, 9, '#1e3a1a'); }
      for (const [x, y] of [[12, 13], [20, 12], [16, 18]]) { P.px(x, y, '#7a9a4a'); P.px(x + 1, y, '#6a8a3a'); }
      P.px(31, 12, '#ffe040'); P.px(31, 13, '#1a1a1a');
      if (f) { for (let x = 32; x < 40; x += 2) P.px(x, 17, '#ffffff'); P.rect(32, 18, 8, 1, '#8a1a1a'); }
      else for (let x = 32; x < 40; x += 2) P.px(x, 16, '#ffffff');
      P.rect(28, 8, 6, 2, '#e0b040'); P.px(28, 7, '#e0b040'); P.px(31, 6, '#e0b040'); P.px(33, 7, '#e0b040'); P.px(31, 7, '#e03030');
    }));

    // reward icons
    const I = Sprites.items;
    I.blade = outline(make(16, 16, P => {
      for (let i = 0; i < 10; i++) { P.px(5 + i, 10 - i, '#ffd040'); P.px(6 + i, 10 - i, '#e04a1a'); }
      P.rect(3, 10, 5, 2, '#3a2a2a'); P.rect(4, 9, 2, 5, '#2e2222'); P.px(2, 13, '#ff8a2a');
    }));
    I.cloak = outline(make(16, 16, P => {
      P.rect(4, 2, 8, 3, '#f4f8fc'); P.ellipse(8, 10, 6, 6, (dx, dy) => dy < 0 ? '#dfe6ee' : '#a8b4c4');
      P.px(7, 4, '#40c0ff'); P.px(8, 4, '#40c0ff');
    }));
    I.boots = outline(make(16, 16, P => {
      P.rect(3, 4, 4, 8, '#3e6a30'); P.rect(3, 11, 6, 3, '#2e5a2a'); P.rect(9, 4, 4, 8, '#3e6a30'); P.rect(9, 11, 6, 3, '#2e5a2a');
      P.px(4, 6, '#e0b040'); P.px(10, 6, '#e0b040');
    }));
  },
};

// ---------------- projectiles ----------------
const Bosses = {
  shots: [],
  ring(x, y, n, speed, kind, dmg, rot = 0) {
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + rot;
      this.shots.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, kind, dmg, life: 3.2 });
    }
  },
  aim(x, y, tx, ty, n, spread, speed, kind, dmg) {
    const base = Math.atan2(ty - y, tx - x);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * spread;
      this.shots.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, kind, dmg, life: 3 });
    }
  },
  update(dt, p) {
    for (const s of this.shots) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      if (Math.random() < dt * 25) FX.particles.push({ x: s.x, y: s.y, vx: 0, vy: -10, g: 0, life: 0.3, col: s.kind === 'fire' ? '#ff8a2a' : '#6a5a3a', size: 1 });
      if (p.mode === 'walk' && Math.hypot(s.x - p.x, s.y - (p.y + 3)) < 7) {
        if (Game.hurtPlayer(s.dmg, s.x - s.vx, s.y - s.vy)) s.life = 0;
      }
      // walls and rocks stop projectiles
      const t = World.get(Math.floor(s.x / 16), Math.floor(s.y / 16));
      if (TILE[t].build || t === T.ROCK || t === T.ORE || TILE[t].tall) { s.life = 0; FX.burst(s.x, s.y, '#ff8a2a', 4, 20); }
    }
    this.shots = this.shots.filter(s => s.life > 0);
  },
  draw(c, camX, camY, time) {
    for (const s of this.shots) {
      const x = Math.round(s.x - camX), y = Math.round(s.y - camY);
      if (s.kind === 'fire') {
        c.fillStyle = 'rgba(255,120,40,0.35)'; c.fillRect(x - 4, y - 4, 8, 8);
        c.fillStyle = '#ff6a20'; c.fillRect(x - 3, y - 2, 6, 4); c.fillRect(x - 2, y - 3, 4, 6);
        c.fillStyle = Math.floor(time * 12) % 2 ? '#ffe060' : '#fff0a0'; c.fillRect(x - 1, y - 1, 2, 2);
      } else {
        c.fillStyle = '#3a2a1a'; c.fillRect(x - 3, y - 2, 6, 4); c.fillRect(x - 2, y - 3, 4, 6);
        c.fillStyle = '#6a5a3a'; c.fillRect(x - 2, y - 2, 2, 2);
      }
    }
  },
  clear() { this.shots = []; },
};

// ---------------- the bosses ----------------
class Boss {
  constructor(kind, x, y) {
    this.kind = kind; this.def = BOSS_DEF[kind];
    this.homeX = x; this.homeY = y;
    this.defeated = false;
    this.reset();
  }
  reset() {
    Object.assign(this, { x: this.homeX, y: this.homeY, hp: this.def.hp, state: 'sleep', t: 0, active: false,
      face: -1, anim: 0, hurt: 0, tele: null, cd: {}, phase2: false, z: 0, circleA: 0, from: null });
  }
  get maxHp() { return this.def.hp; }
  vulnerable() { return !(this.kind === 'bogking' && ['sleep', 'submerged', 'rise', 'dive'].includes(this.state)); }
  dmgMult() { return ['recover', 'stunned', 'exposed'].includes(this.state) ? 1.5 : 1; }
  canMove(x, y) {
    const r = this.def.r;
    for (const [dx, dy] of [[-r, 0], [r, 0], [0, -r * 0.4], [0, r * 0.5]]) {
      const t = World.get(Math.floor((x + dx) / 16), Math.floor((y + dy) / 16));
      if (!TILE[t].walk || t === T.WGATE) return false;
    }
    return true;
  }
  moveBy(dx, dy) {
    let blocked = false;
    if (this.canMove(this.x + dx, this.y)) this.x += dx; else blocked = true;
    if (this.canMove(this.x, this.y + dy)) this.y += dy; else blocked = true;
    return blocked;
  }
  go(state, t) { this.state = state; this.t = t; this.stateDur = t; }
  mark(x, y, r, dur) { this.tele = { x, y, r, dur }; }

  update(dt, p) {
    if (this.defeated) return;
    this.hurt = Math.max(0, this.hurt - dt);
    this.anim += dt * 4;
    for (const k in this.cd) this.cd[k] -= dt;
    const dx = p.x - this.x, dy = p.y + 4 - this.y, dist = Math.hypot(dx, dy) || 1;
    if (this.state === 'sleep') {
      if (p.mode === 'walk' && dist < this.def.trigger && Game.state === 'play' && !Game.activeBoss) Game.startBoss(this);
      return;
    }
    if (Math.hypot(p.x - this.homeX, p.y - this.homeY) > this.def.leash || p.mode !== 'walk') { Game.endBoss(this, false); return; }
    this.phase2 = this.hp <= this.maxHp / 2;
    this.t -= dt;
    this[this.kind](dt, p, dx, dy, dist);
    if (BOSS_DANGER[this.kind].includes(this.state) && this.z < 4 && dist < this.def.r + 5) {
      Game.hurtPlayer(Math.round(this.def.dmg * 0.6), this.x, this.y);
    }
  }

  // Magmaw: leaping slams, fireball volleys, charges into walls, summons scorpions below half health.
  magmaw(dt, p, dx, dy, dist) {
    const fast = this.phase2 ? 0.75 : 1;
    switch (this.state) {
      case 'intro': if (this.t <= 0) this.go('idle', 0.8); break;
      case 'idle': {
        this.moveBy(dx / dist * 22 * dt, dy / dist * 22 * dt);
        this.face = dx > 0 ? 1 : -1;
        if (this.t > 0) break;
        const opts = ['slam', 'volley', 'charge', 'slam'];
        if (this.phase2 && !(this.cd.summon > 0)) opts.push('summon');
        const pick = opts[Math.random() * opts.length | 0];
        if (pick === 'slam') { this.from = { x: this.x, y: this.y }; this.mark(p.x, p.y + 4, 34, 0.95 * fast); this.go('slam', 0.95 * fast); Sound.bang(); }
        else if (pick === 'volley') { this.shots = this.phase2 ? 3 : 2; this.go('volley', 0.45); }
        else if (pick === 'charge') { this.go('windup', 0.75 * fast); Sound.bang(); }
        else { this.cd.summon = 14; this.go('summon', 1.0); }
        break;
      }
      case 'slam': {
        const k = 1 - Math.max(0, this.t) / this.stateDur;
        this.x = this.from.x + (this.tele.x - this.from.x) * k;
        this.y = this.from.y + (this.tele.y - this.from.y) * k;
        this.z = Math.sin(k * Math.PI) * 34;
        if (this.t > 0) break;
        this.z = 0;
        FX.shake(5, 0.35); Sound.hit(); Sound.noise(0.4, 0.5, 200);
        FX.burst(this.x, this.y, '#ff8a2a', 30, 90);
        if (Math.hypot(p.x - this.x, p.y + 4 - this.y) < this.tele.r) Game.hurtPlayer(this.def.dmg + 6, this.x, this.y);
        if (this.phase2) Bosses.ring(this.x, this.y, 8, 70, 'fire', 10);
        if (!this.canMove(this.x, this.y)) { this.x = this.from.x; this.y = this.from.y; }
        this.tele = null;
        this.go('recover', 1.1);
        break;
      }
      case 'volley':
        if (this.t > 0) break;
        this.shots--;
        Bosses.ring(this.x, this.y - 6, this.phase2 ? 12 : 8, 80, 'fire', 12, this.shots * 0.3);
        Sound.tone(200, 0.3, 'sawtooth', 0.06, -120);
        if (this.shots > 0) this.go('volley', 0.6); else this.go('idle', 1.1);
        break;
      case 'windup':
        this.face = dx > 0 ? 1 : -1;
        if (this.t <= 0) { this.cdir = { x: dx / dist, y: dy / dist }; this.go('charge', 1.0); }
        break;
      case 'charge':
        if (Math.random() < 0.5) FX.dust(this.x, this.y + 8, '#5a504c');
        if (this.moveBy(this.cdir.x * 165 * dt, this.cdir.y * 165 * dt)) { FX.shake(4, 0.25); Sound.hit(); this.go('stunned', 1.7); }
        else if (this.t <= 0) this.go('idle', 0.9);
        break;
      case 'summon':
        if (this.t <= 0) { Game.spawnMinion('scorpion', this.x, this.y); Game.spawnMinion('scorpion', this.x, this.y); this.go('idle', 1); }
        break;
      case 'recover': case 'stunned':
        if (this.t <= 0) this.go('idle', 0.6);
        break;
    }
  }

  // Old Frostfang: circles you, pounces on a marked spot, howls for its pack.
  frostfang(dt, p, dx, dy, dist) {
    const sp = this.phase2 ? 1.3 : 1;
    switch (this.state) {
      case 'intro': if (this.t <= 0) this.go('prowl', 1.5); break;
      case 'prowl': {
        this.circleA += dt * 1.4 * sp;
        const tx = p.x + Math.cos(this.circleA) * 64, ty = p.y + 4 + Math.sin(this.circleA) * 48;
        const mx = tx - this.x, my = ty - this.y, md = Math.hypot(mx, my) || 1;
        const step = Math.min(md, 95 * sp * dt);
        this.moveBy(mx / md * step, my / md * step);
        this.face = mx > 0 ? 1 : -1;
        if (this.t > 0) break;
        if (!(this.cd.howl > 0) && Math.random() < 0.3) { this.cd.howl = 16; this.go('howl', 1.2); Sound.tone(300, 1.2, 'triangle', 0.08, 300); }
        else { this.pounces = this.phase2 ? 2 : 1; this.startPounce(p, 0.65); }
        break;
      }
      case 'crouch':
        this.face = dx > 0 ? 1 : -1;
        if (this.t <= 0) { this.from = { x: this.x, y: this.y }; this.go('pounce', 0.35); }
        break;
      case 'pounce': {
        const k = 1 - Math.max(0, this.t) / 0.35;
        this.x = this.from.x + (this.tele.x - this.from.x) * k;
        this.y = this.from.y + (this.tele.y - this.from.y) * k;
        this.z = Math.sin(k * Math.PI) * 14;
        if (this.t > 0) break;
        this.z = 0;
        FX.shake(3, 0.2); FX.burst(this.x, this.y, '#f4f8fc', 16, 60); Sound.hit();
        if (Math.hypot(p.x - this.x, p.y + 4 - this.y) < this.tele.r) Game.hurtPlayer(this.def.dmg, this.x, this.y);
        if (!this.canMove(this.x, this.y)) { this.x = this.from.x; this.y = this.from.y; }
        this.tele = null;
        if (--this.pounces > 0) this.startPounce(p, 0.4); else this.go('recover', 1.1);
        break;
      }
      case 'howl':
        if (this.t <= 0) { Game.spawnMinion('wolf', this.x, this.y); Game.spawnMinion('wolf', this.x, this.y); this.go('prowl', 2); }
        break;
      case 'recover': if (this.t <= 0) this.go('prowl', 1.2 + Math.random()); break;
    }
  }
  startPounce(p, tele) {
    const d = this.phase2 ? tele * 0.75 : tele;
    this.mark(p.x, p.y + 4, 22, d);
    this.go('crouch', d);
    Sound.bang();
  }

  // The Bog King: hides under the mud (can't be hurt), bursts up under you, then lies exposed.
  bogking(dt, p, dx, dy, dist) {
    switch (this.state) {
      case 'intro': if (this.t <= 0) this.go('submerged', 1.5); break;
      case 'submerged': {
        const sp = this.phase2 ? 75 : 58;
        this.x += dx / dist * Math.min(dist, sp * dt);
        this.y += dy / dist * Math.min(dist, sp * dt);
        const hx = this.x - this.homeX, hy = this.y - this.homeY, hd = Math.hypot(hx, hy);
        if (hd > 150) { this.x = this.homeX + hx / hd * 150; this.y = this.homeY + hy / hd * 150; }
        if (Math.random() < dt * 20) FX.particles.push({ x: this.x + (Math.random() * 16 - 8), y: this.y, vx: 0, vy: -12, g: 0, life: 0.4, col: '#8a9a6a', size: 2 });
        if (this.t <= 0) { this.mark(this.x, this.y, 26, this.phase2 ? 0.6 : 0.85); this.go('rise', this.tele.dur); Sound.tone(120, 0.6, 'sine', 0.1, 80); }
        break;
      }
      case 'rise':
        if (this.t > 0) break;
        FX.shake(4, 0.3); FX.burst(this.x, this.y, '#5a6a3a', 24, 80); Sound.splash();
        if (Math.hypot(p.x - this.x, p.y + 4 - this.y) < this.tele.r) Game.hurtPlayer(this.def.dmg, this.x, this.y);
        this.tele = null; this.spat = false;
        this.go('exposed', this.phase2 ? 2.4 : 3.2);
        break;
      case 'exposed':
        this.face = dx > 0 ? 1 : -1;
        if (this.phase2 && !this.spat && this.t < 1.6) { this.spat = true; Bosses.aim(this.x, this.y - 4, p.x, p.y + 3, 3, 0.35, 95, 'mud', 12); }
        if (dist < 42 && !(this.cd.tail > 0)) { this.cd.tail = 2.5; this.mark(this.x, this.y, 40, 0.5); this.go('tail', 0.5); Sound.bang(); break; }
        if (this.t <= 0) this.go('dive', 0.5);
        break;
      case 'tail':
        if (this.t > 0) break;
        FX.shake(3, 0.2); FX.burst(this.x, this.y, '#3e6a30', 16, 70);
        if (Math.hypot(p.x - this.x, p.y + 4 - this.y) < this.tele.r) Game.hurtPlayer(this.def.dmg - 4, this.x, this.y);
        this.tele = null;
        this.go('exposed', 1.2);
        break;
      case 'dive':
        if (this.t <= 0) { FX.burst(this.x, this.y, '#5a6a3a', 10, 50); Sound.splash(); this.go('submerged', 2 + Math.random()); }
        break;
    }
  }

  drawTelegraph(c, camX, camY, time) {
    if (this.defeated || !this.tele) return;
    const T0 = this.tele, k = 1 - Math.max(0, this.t) / (this.stateDur || 1);
    const x = T0.x - camX, y = T0.y - camY;
    c.fillStyle = `rgba(255,50,30,${0.14 + (Math.floor(time * 8) % 2) * 0.08})`;
    c.beginPath(); c.ellipse(x, y, T0.r, T0.r * 0.65, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(255,90,60,0.9)'; c.lineWidth = 1;
    c.beginPath(); c.ellipse(x, y, T0.r, T0.r * 0.65, 0, 0, Math.PI * 2); c.stroke();
    c.fillStyle = 'rgba(255,60,40,0.3)';
    c.beginPath(); c.ellipse(x, y, T0.r * k, T0.r * 0.65 * k, 0, 0, Math.PI * 2); c.fill();
  }

  draw(c, camX, camY, time) {
    if (this.defeated) return;
    const x0 = Math.round(this.x - camX), y0 = Math.round(this.y - camY);
    if (this.kind === 'bogking' && ['sleep', 'submerged', 'rise'].includes(this.state)) {
      c.fillStyle = 'rgba(10,30,10,0.35)';
      c.beginPath(); c.ellipse(x0, y0, 16, 6, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(200,230,180,0.7)';
      for (let i = 0; i < 3; i++) { const a = time * 2 + i * 2; c.fillRect(Math.round(x0 + Math.cos(a) * 9), Math.round(y0 + Math.sin(a * 1.3) * 3), 2, 2); }
      return;
    }
    // shadow
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.beginPath(); c.ellipse(x0, y0 + 4, this.def.r + 2, 4, 0, 0, Math.PI * 2); c.fill();
    const set = Sprites.boss[this.kind];
    let img = (this.face > 0 ? set.r : set.l)[Math.floor(this.anim) % 2];
    if (this.hurt > 0.08) img = Sprites.white(img);
    const shake = ['windup', 'crouch', 'howl', 'intro'].includes(this.state) ? Math.round(Math.sin(time * 60)) : 0;
    c.drawImage(img, x0 - (img.width >> 1) + shake, y0 - img.height + 6 - Math.round(this.z));
    if (this.state === 'recover' || this.state === 'stunned' || this.state === 'exposed') {
      c.fillStyle = '#ffe060';
      for (let i = 0; i < 3; i++) {
        const a = time * 6 + i * 2.1;
        c.fillRect(Math.round(x0 + Math.cos(a) * 8), Math.round(y0 - img.height + 4 + Math.sin(a) * 2), 1, 1);
      }
    }
  }
}
