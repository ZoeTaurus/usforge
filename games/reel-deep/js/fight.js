'use strict';
// ============================================================
//  Underwater boss fight: you got pulled in!
// ============================================================

const AR = { x0: 8, x1: 312, y0: 20, y1: 160 }; // arena bounds for the players
const FLOOR_Y = 166;

const FIGHT_THEMES = {
  gnarly: { top: '#2f8ac0', deep: '#0e3560', rock: '#16466e', floor: '#b09a70', coral: ['#3e9a5a', '#2f7a4a'] },
  pointy: { top: '#2a74cc', deep: '#0a2a60', rock: '#123a78', floor: '#a8a080', coral: ['#e0607a', '#f0a050'] },
  lanterna: { top: '#141e44', deep: '#04060f', rock: '#0a1028', floor: '#3a3450', coral: ['#3a2a5a', '#2a2040'] },
  chomp: { top: '#22a0b0', deep: '#0a3e52', rock: '#0f5566', floor: '#d8c090', coral: ['#ff7a8a', '#ffb050', '#b080ff'] },
  kraken: { top: '#2c1c50', deep: '#07030e', rock: '#1a0e2e', floor: '#40304a', coral: ['#5a2a4a', '#3a1a3a'] },
  whale: { top: '#3a7a6a', deep: '#0a2420', rock: '#18382e', floor: '#6a6a58', coral: ['#3a6a3a', '#5a7a4a'] },
  crab: { top: '#8ad0e8', deep: '#1a4a6a', rock: '#4a7a98', floor: '#e0ecf4', coral: ['#3a7a8a', '#6ab0c8'] },
  serpent: { top: '#6a2a1a', deep: '#1a0806', rock: '#2a1210', floor: '#2a2026', coral: ['#6a3a2a', '#8a2a1a'] },
};
const PIRANHA = { id: 'piranha', shape: 'fish', hr: 0.6, body: '#c0443a', top: '#6a2a3a', belly: '#ff9a6a', fin: '#8a2a2a', angry: true };
const GHOSTFISH = { id: 'ghostminion', shape: 'fish', hr: 0.5, body: '#c8fff0', top: '#88d0c0', belly: '#f0fffa', fin: '#a8f0e0', angry: true };

function buildFightBg(id) {
  const th = FIGHT_THEMES[id], c = makeCanvas(W, H);
  withTarget(c.getContext('2d'), () => {
    for (let y = 0; y < H; y += 3) R(0, y, W, 3, mix(th.top, th.deep, Math.pow(y / H, 0.8)));
    for (let x = 0; x < W; x++) {
      const h1 = 40 + Math.sin(x * 0.03) * 14 + Math.sin(x * 0.11 + 2) * 6;
      R(x, FLOOR_Y - h1, 1, h1, mix(th.rock, th.deep, 0.35));
      const h2 = 18 + Math.sin(x * 0.05 + 1) * 8 + Math.sin(x * 0.17) * 4;
      R(x, FLOOR_Y - h2, 1, h2, th.rock);
    }
    if (id === 'whale') {
      // a big sunken galleon in the gloom
      for (let i = 0; i < 150; i++) { const h = Math.round(40 - Math.abs(i - 75) * 0.35 + (hash(i, 9) < 0.15 ? -8 : 0)); R(90 + i, FLOOR_Y - h, 1, h, i % 8 === 0 ? '#12241e' : '#1c3a30'); }
      R(150, 40, 4, 90, '#1c3a30'); R(130, 52, 44, 2, '#1c3a30');
      for (const x of [110, 140, 170, 200]) R(x, FLOOR_Y - 26, 6, 5, '#0a1814');
    }
    for (let x = 0; x < W; x++) {
      const top = FLOOR_Y + Math.round(Math.sin(x * 0.07) * 1.5);
      for (let y = top; y < H; y++) P(x, y, hash(x, y) < 0.15 ? darken(th.floor, 0.18) : y === top ? lighten(th.floor, 0.15) : th.floor);
    }
    if (id === 'crab') for (let x = 0; x < W; x += 9) { const h = 4 + Math.round(hash(x, 1) * 12); for (let k = 0; k < h; k++) R(x + Math.floor(k / 3), 8 + k, Math.max(1, 4 - Math.floor(k / 3)), 1, k < 2 ? '#ffffff' : '#bfe8f8'); }
    if (id === 'serpent') for (let i = 0; i < 14; i++) { const x = hash(i, 4) * W; for (let k = 0; k < 10; k++) P(x + k + Math.round(Math.sin(k) * 2), FLOOR_Y + 2 + (k % 3), '#ff6a1a'); }
    for (let i = 0; i < 9; i++) {
      const x = 16 + i * 36 + Math.floor(hash(i, 5) * 14), col = th.coral[i % th.coral.length];
      if (i % 3 === 0) { pcircle(x, FLOOR_Y, 6, darken(th.rock, 0.1)); pcircle(x - 1, FLOOR_Y - 1, 4, lighten(th.rock, 0.12)); continue; }
      for (let b = 0; b < 3; b++) {
        let bx = x + (b - 1) * 3, by = FLOOR_Y;
        for (let k = 0; k < 7 + b * 2; k++) { by--; if (k % 3 === 2) bx += b - 1; R(bx, by, 2, 1, col); }
        pcircle(bx, by, 1, lighten(col, 0.2));
      }
    }
  });
  return c;
}

function makeBoss(bi, dmg) {
  const d = BOSSES[bi];
  const hp = Math.round(d.hp * (bi < PIER_BOSSES ? Math.max(1, dmg / (bi + 1)) : Math.max(1, dmg / 2)));
  const b = { id: d.id, def: d, x: 380, y: 92, vx: 0, vy: 0, dir: -1, hp, maxHp: hp, state: 'intro', t: 0, flash: 0, dmgMul: 1, shake: 0, anim: 0, count: 0, summonT: 7, rx: 24, ry: 12, hox: 0, hoy: 0, drawOy: 0, startX: 230, startY: 92, tents: [], atkT: 2, alpha: 1 };
  if (d.id === 'gnarly') { b.rx = 24; b.ry = 13; }
  if (d.id === 'pointy') { b.rx = 22; b.ry = 8; b.hox = -10; }
  if (d.id === 'lanterna') {
    b.rx = 18; b.ry = 16;
    const img = fishSprite(d, d.len, 0), ry = Math.round(d.len * 0.33);
    b.drawOy = img.height / 2 - (img.height - ry - 3);
  }
  if (d.id === 'chomp') { b.rx = 32; b.ry = 10; }
  if (d.id === 'kraken') { b.rx = 20; b.ry = 20; b.startX = 266; b.x = 300; b.y = 240; }
  if (d.id === 'whale') { b.rx = 36; b.ry = 13; b.hoy = 2; }
  if (d.id === 'crab') { b.rx = 18; b.ry = 10; b.startY = FLOOR_Y - 16; b.y = FLOOR_Y - 16; }
  if (d.id === 'serpent') {
    b.rx = 8; b.ry = 8; b.y = 120;
    b.segs = Array.from({ length: 18 }, (_, i) => ({ x: 380 + i * 6, y: 120 }));
  }
  return b;
}

const FightScene = {
  enter(arg) {
    const s = Game.save;
    this.bi = arg.boss;
    this.def = BOSSES[this.bi];
    this.rematch = s.bosses.includes(this.def.id);
    this.rod = RODS[s.rod];
    this.dmg = this.rod.dmg + (s.charms[2] ? 2 : 0);
    this.cozy = s.diff === 'cozy';
    this.sf = this.cozy ? 0.85 : 1;
    this.t = 0;
    this.parts = new Particles();
    this.proj = []; this.minions = []; this.air = [];
    this.vents = [44, 160, 276];
    this.ventT = [1, 2.5, 4];
    this.usedItems = [];
    const snack = s.snack > 0, tank = s.airtank > 0;
    if (snack) { s.snack--; this.usedItems.push('FISH TACO'); }
    if (tank) { s.airtank--; this.usedItems.push('AIR TANK'); }
    writeSave();
    const hp = 3 + (snack ? 1 : 0) + (s.charms[0] ? 1 : 0) + (this.cozy ? 2 : 0);
    const o2 = 100 * (tank ? 1.5 : 1) * (s.charms[1] ? 1.5 : 1);
    this.players = [];
    for (let i = 0; i < (Game.players || 1); i++) this.players.push({ i, x: 70 - i * 16, y: -12 - i * 14, vx: 0, vy: 50, dir: 1, inv: 0, dashT: 0, dashCd: 0, anim: 0, aimX: 1, aimY: 0, dashHit: false, hp, maxHp: hp, o2, maxO2: o2, noAirT: 0, down: false, hooks: [], pal: i ? P2_PAL : PAL });
    this.state = 'intro';
    this.stT = 0;
    this.boss = makeBoss(this.bi, this.dmg);
    this.ink = 0;
    this.loot = null;
    this.dark = this.def.id === 'lanterna';
    this.darkC = this.dark ? makeCanvas(W, H) : null;
    this.bg = buildFightBg(this.def.id);
    this.school = Array.from({ length: 7 }, (_, i) => ({ x: rand(0, W), y: 40 + i * 6 + rand(-3, 3), v: rand(6, 10) }));
    this.kelp = [22, 96, 134, 206, 238, 300].map(x => ({ x, h: randi(22, 46) }));
    this.joy = null;
    Sound.music(this.def.id === 'kraken' || this.bi >= PIER_BOSSES ? 'final' : 'fight');
    Sound.ambience('under');
    for (let i = 0; i < 30; i++) this.parts.add({ type: 'bubble', x: 70 + rand(-10, 10), y: rand(0, 40), vx: rand(-10, 10), vy: -rand(20, 50), life: rand(0.8, 1.6), c: '#d8f4ff', s: randi(1, 2) });
  },

  // ---------- helpers ----------
  alive() { return this.players.filter(p => !p.down); },
  target(x, y) {
    let best = null, bd = 1e9;
    for (const p of this.alive()) { const d = dist(x, y, p.x, p.y); if (d < bd) { bd = d; best = p; } }
    return best || this.players[0];
  },
  bossHit(x, y, r = 2) {
    const b = this.boss;
    if (b.dead || b.alpha < 0.5) return false;
    if (b.id === 'serpent') return dist(x, y, b.x, b.y) < 9 + r;
    const cx = b.x + b.hox * b.dir, cy = b.y + b.hoy;
    const nx = (x - cx) / (b.rx + r), ny = (y - cy) / (b.ry + r);
    return nx * nx + ny * ny <= 1;
  },
  damageBoss(dmg, x, y) {
    const b = this.boss;
    if (b.dead || this.state !== 'fight') return;
    const d = dmg * b.dmgMul;
    b.hp -= d;
    b.flash = 0.12;
    Sound.play('hit');
    this.parts.burst(8, { x, y, c: '#ffffff', life: 0.4, drag: 3 }, 60);
    this.parts.add({ type: 'text', text: (b.dmgMul > 1 ? 'CRIT ' : '') + d, x, y: y - 6, vy: -18, life: 0.8, c: b.dmgMul > 1 ? '#ffe14a' : '#ffffff' });
    if (Game.save.rod >= 2) for (const p of this.alive()) p.o2 = Math.min(p.maxO2, p.o2 + 6);
    if (b.hp <= 0) { b.hp = 0; b.dead = true; this.state = 'win'; this.stT = 0; this.proj = []; this.minions = []; b.tents = []; b.alpha = 1; Sound.play('roar'); Toasts.add(this.def.name + ' IS DEFEATED!', '#ffe14a', 3, 40); }
  },
  hurt(p, n = 1, fromX) {
    if (!p || p.down || p.inv > 0 || this.state !== 'fight') return;
    p.hp -= n;
    p.inv = 1.3;
    Fx.shake = 4; Fx.flash = 0.35; Fx.flashColor = '#ff3a3a';
    Sound.play('hurt');
    const dx = fromX !== undefined ? Math.sign(p.x - fromX) || 1 : -p.dir;
    p.vx = dx * 140; p.vy = -40;
    this.parts.burst(10, { type: 'bubble', x: p.x, y: p.y, c: '#d8f4ff', life: 0.7 }, 50);
    if (p.hp <= 0) {
      p.hp = 0; p.down = true; p.hooks = [];
      if (this.alive().length === 0) {
        this.state = 'lose'; this.stT = 0;
        Sound.play('lose');
        Toasts.add(this.players.length > 1 ? 'YOU BOTH BLACKED OUT...' : 'YOU BLACKED OUT...', '#ff9a9a', 3, 60);
      } else Toasts.add('P' + (p.i + 1) + ' IS KNOCKED OUT! SWIM TO THEM TO REVIVE!', '#ffb0a0', 3, 150);
    }
  },
  steer(o, tx, ty, spd, dt, k = 2.5) {
    const dx = tx - o.x, dy = ty - o.y, d = Math.hypot(dx, dy) || 1;
    o.vx = lerp(o.vx, (dx / d) * spd, Math.min(1, dt * k));
    o.vy = lerp(o.vy, (dy / d) * spd, Math.min(1, dt * k));
  },
  clampBoss(b) {
    const x0 = AR.x0 + b.rx - 4, x1 = AR.x1 - b.rx + 4, y0 = AR.y0 + b.ry - 4, y1 = FLOOR_Y - b.ry - 2;
    let hit = false;
    if (b.x < x0) { b.x = x0; hit = true; } if (b.x > x1) { b.x = x1; hit = true; }
    if (b.y < y0) { b.y = y0; hit = true; } if (b.y > y1) { b.y = y1; hit = true; }
    return hit;
  },
  shoot(x, y, ang, spd, type = 'bubble', g = 0) {
    const r = type === 'ink' ? 5 : type === 'cannon' ? 4 : 3;
    this.proj.push({ x, y, vx: Math.cos(ang) * spd * this.sf, vy: Math.sin(ang) * spd * this.sf, r, type, g, life: 7 });
  },
  lurePos() {
    const b = this.boss, img = fishSprite(b.def, b.def.len, 0), L = img.meta.lure;
    const left = b.x - img.width / 2, top = b.y + b.drawOy - img.height / 2;
    return [left + (b.dir > 0 ? L[0] : img.width - 1 - L[0]), top + L[1]];
  },

  // ---------- controls ----------
  controls(p) {
    const two = this.players.length === 2, m = Input.mouse;
    let ax = 0, ay = 0, thr = false, dash = false, aim = null;
    if (!two || p.i === 0) {
      if (two) { ax = (Input.key('d') ? 1 : 0) - (Input.key('a') ? 1 : 0); ay = (Input.key('s') ? 1 : 0) - (Input.key('w') ? 1 : 0); thr = Input.hit('space', 'f'); dash = Input.chit('ShiftLeft') || Input.hit('g'); }
      else { ax = (Input.key('d', 'arrowright') ? 1 : 0) - (Input.key('a', 'arrowleft') ? 1 : 0); ay = (Input.key('s', 'arrowdown') ? 1 : 0) - (Input.key('w', 'arrowup') ? 1 : 0); thr = Input.hit('j', 'space'); dash = Input.hit('k', 'shift'); }
      if (Input.isTouch) {
        // virtual joystick (left half) + buttons (right)
        this.joy = null;
        for (const t of Input.touches.values()) {
          if (t.sx < W * 0.45) { const dx = t.x - t.sx, dy = t.y - t.sy, d = Math.hypot(dx, dy); this.joy = { sx: t.sx, sy: t.sy, dx, dy }; if (d > 3) { const k = Math.min(1, d / 18); ax = (dx / d) * k; ay = (dy / d) * k; } }
          else if (dist(t.x, t.y, 288, 146) < 20) thr = thr || t.fresh || p.hooks.length === 0;
          else if (dist(t.x, t.y, 252, 160) < 14 && t.fresh) dash = true;
        }
        const b = this.boss;
        if (!b.dead) aim = [b.x + b.hox * b.dir - p.x, b.y - p.y];
      } else if (m.pressed) { thr = true; }
    } else {
      ax = (Input.key('arrowright') ? 1 : 0) - (Input.key('arrowleft') ? 1 : 0);
      ay = (Input.key('arrowdown') ? 1 : 0) - (Input.key('arrowup') ? 1 : 0);
      thr = Input.hit('enter') || Input.chit('Slash');
      dash = Input.chit('ShiftRight') || Input.chit('Period');
    }
    const mouseAim = !Input.isTouch && p.i === 0 && m.lastMove > performance.now() / 1000 - 2;
    if (mouseAim && !aim) aim = [m.x - p.x, m.y - p.y];
    return { ax, ay, thr, dash, aim };
  },

  // ---------- update ----------
  update(dt) {
    this.t += dt;
    this.stT += dt;
    this.parts.update(dt);
    const b = this.boss;
    for (const f of this.school) { f.x -= f.v * dt; if (f.x < -10) f.x = W + 10; }
    if (Math.random() < dt * 6) this.parts.add({ type: 'bubble', x: rand(0, W), y: FLOOR_Y, vy: -rand(10, 25), life: rand(3, 6), c: 'rgba(216,244,255,0.5)', s: 1, wob: 4, minY: 12 });
    if (this.def.id === 'serpent' && Math.random() < dt * 5) this.parts.add({ x: rand(0, W), y: FLOOR_Y, vy: -rand(15, 30), life: 2, c: choice(['#ff7a2a', '#ffb03a']) });
    if (this.def.id === 'crab' && Math.random() < dt * 5) this.parts.add({ x: rand(0, W), y: 12, vx: -3, vy: rand(6, 12), life: 6, c: '#ffffff' });

    if (this.state === 'intro') {
      for (const p of this.players) { p.y = lerp(p.y, 80 + p.i * 20, dt * 2.2); p.x = lerp(p.x, 70 - p.i * 16, dt * 2); p.anim += dt * 6; }
      b.anim += dt;
      b.x = lerp(b.x, b.startX, dt * 1.6); b.y = lerp(b.y, b.startY, dt * 1.6);
      b.dir = -1;
      if (b.segs) this.moveSegs(b);
      if (this.stT > 2.6) {
        this.state = 'fight'; this.stT = 0;
        b.state = 'start'; b.t = 0.5;
        if (this.usedItems.length) Toasts.add('USED: ' + this.usedItems.join(' + '), '#b8ffb0', 3, 150);
        else if (!Game.save.tips.fight) { Game.save.tips.fight = 1; Toasts.add(Input.isTouch ? 'JOYSTICK TO SWIM - HOOK AND DASH BUTTONS' : 'WASD SWIM - J/CLICK HOOK - K/SHIFT DASH', '#ffffff', 5, 150); }
      }
      return;
    }
    for (const p of this.players) if (this.state === 'fight' || this.state === 'win' || this.state === 'loot') this.updatePlayer(p, dt);
    for (const p of this.players) this.updateHooks(p, dt);
    this.updateAir(dt);
    if (this.state === 'fight') {
      this.updateBoss(dt);
      this.updateProj(dt);
      this.updateMinions(dt);
      for (const p of this.alive()) {
        p.o2 -= dt * (100 / 45) * (this.cozy ? 0.7 : 1);
        if (p.o2 <= 0) { p.o2 = 0; p.noAirT += dt; if (p.noAirT > 1.6) { p.noAirT = 0; p.inv = 0; this.hurt(p, 1); } }
        else p.noAirT = 0;
      }
      if (this.alive().some(p => p.o2 < 25) && Math.floor(this.t * 2) !== Math.floor((this.t - dt) * 2)) Sound.play('warn');
      // revive a knocked-out friend by swimming into them
      for (const p of this.players) if (p.down) for (const q of this.alive()) if (dist(p.x, p.y, q.x, q.y) < 14) {
        p.down = false; p.hp = 1; p.inv = 2; p.o2 = Math.max(p.o2, p.maxO2 * 0.5);
        Sound.play('revive'); Toasts.add('P' + (p.i + 1) + ' IS BACK!', '#b8ffb0', 2, 150);
      }
    } else if (this.state === 'win') {
      b.anim += dt;
      b.vx *= 0.9; b.vy *= 0.9;
      b.flash = Math.sin(this.stT * 30) > 0 ? 0.05 : 0;
      Fx.shake = Math.max(Fx.shake, 1.5);
      if (Math.random() < dt * 20) this.parts.burst(3, { type: 'bubble', x: b.x + rand(-b.rx, b.rx), y: b.y + rand(-b.ry, b.ry), c: '#ffffff', life: 0.6, s: 2 }, 40);
      if (this.stT > 1.5) {
        this.state = 'loot'; this.stT = 0;
        Fx.flash = 0.8; Fx.flashColor = '#ffffff'; Fx.shake = 6;
        Sound.play('bigsplash');
        this.parts.burst(40, { type: 'bubble', x: b.x, y: b.y, c: '#e8f8ff', life: 1.2, s: 2 }, 90);
        const s = Game.save;
        let kind = 'treasure';
        if (this.bi < PIER_BOSSES && !this.rematch) kind = 'rod';
        if (this.def.charm !== undefined && !s.charms[this.def.charm]) kind = 'charm';
        for (const p of this.players) if (p.down) { p.down = false; p.hp = 1; }
        this.loot = { x: clamp(b.x, 30, 290), y: clamp(b.y, 30, 140), vy: -10, kind, rod: this.bi + 1, charm: this.def.charm };
        Toasts.add(kind === 'rod' ? 'IT DROPPED A ROD! GRAB IT!' : kind === 'charm' ? 'IT DROPPED A CHARM! GRAB IT!' : 'IT DROPPED TREASURE! GRAB IT!', '#ffe14a', 4, 150);
      }
    } else if (this.state === 'loot') {
      const L = this.loot;
      L.vy = Math.min(L.vy + dt * 20, 14);
      L.y = Math.min(L.y + L.vy * dt, 140);
      if (Math.random() < dt * 8) this.parts.add({ x: L.x + rand(-6, 6), y: L.y + rand(-6, 6), vy: -10, life: 0.6, c: '#ffe98a' });
      if (!L.got && this.players.some(p => dist(p.x, p.y, L.x, L.y) < 14)) this.collectLoot();
    } else if (this.state === 'lose') {
      for (const p of this.players) { p.vy = lerp(p.vy, -18, dt); p.vx *= 0.95; p.x += p.vx * dt; p.y += p.vy * dt; }
      if (this.stT > 2.2 && !Fx.busy()) {
        const s = Game.save, lost = Math.floor(s.coins * 0.1);
        s.coins -= lost;
        s.bigChance = 0.4;
        writeSave();
        Fx.transition(() => Game.setScene(BeachScene, { msg: 'YOU WASHED ASHORE...' + (lost ? ' LOST ' + lost + ' COINS' : ''), msgColor: '#ffb0a0' }), 1.6);
      }
    }
    this.ink = Math.max(0, this.ink - dt);
  },

  collectLoot() {
    const L = this.loot, s = Game.save;
    L.got = true;
    Sound.play('rod');
    Fx.flash = 0.5; Fx.flashColor = '#fff6c8';
    if (!s.bosses.includes(this.def.id)) s.bosses.push(this.def.id);
    let arg;
    if (L.kind === 'rod') { s.rod = Math.max(s.rod, L.rod); arg = { newRod: L.rod, msg: 'YOU SWAM BACK UP!' }; }
    else if (L.kind === 'charm') { s.charms[L.charm] = true; arg = { newCharm: L.charm, msg: 'YOU SWAM BACK UP!' }; }
    else { const coins = 120 * (this.bi + 1); s.coins += coins; arg = { msg: 'TREASURE! +' + coins + ' COINS', msgColor: '#ffe98a' }; }
    arg.beast = true;
    writeSave();
    Fx.transition(() => Game.setScene(BeachScene, arg), 1.2);
  },

  updatePlayer(p, dt) {
    const s = Game.save;
    p.inv -= dt;
    if (p.down) {
      // knocked out: float gently in a bubble
      p.vx *= 0.95; p.vy = lerp(p.vy, -6, dt);
      p.x += p.vx * dt; p.y = Math.max(AR.y0 + 10, p.y + p.vy * dt);
      return;
    }
    const c = this.controls(p);
    let { ax, ay } = c;
    const al = Math.hypot(ax, ay);
    if (al > 1) { ax /= al; ay /= al; }
    p.dashT -= dt; p.dashCd -= dt;
    if (p.dashT <= 0) {
      p.vx += ax * 540 * dt; p.vy += ay * 540 * dt;
      p.vx *= Math.max(0, 1 - 3.4 * dt); p.vy *= Math.max(0, 1 - 3.4 * dt);
      p.vy -= 5 * dt;
      const sp = Math.hypot(p.vx, p.vy);
      if (sp > 95) { p.vx *= 95 / sp; p.vy *= 95 / sp; }
    } else if (Math.random() < 0.6) this.parts.add({ type: 'bubble', x: p.x - p.vx * 0.03, y: p.y, vy: -15, life: 0.5, c: '#d8f4ff', s: 1 });
    if (Math.abs(ax) > 0.2) p.dir = ax > 0 ? 1 : -1;
    if (c.aim) { const d = Math.hypot(c.aim[0], c.aim[1]) || 1; p.aimX = c.aim[0] / d; p.aimY = c.aim[1] / d; if (Math.abs(p.aimX) > 0.2) p.dir = p.aimX > 0 ? 1 : -1; }
    else if (al > 0.2) { const d = Math.hypot(ax, ay); p.aimX = ax / d; p.aimY = ay / d; }
    else { p.aimX = p.dir; p.aimY = 0; }
    if (this.state === 'fight') {
      if (c.dash && p.dashCd <= 0) {
        const dx = al > 0.2 ? ax / Math.hypot(ax, ay) : p.dir, dy = al > 0.2 ? ay / Math.hypot(ax, ay) : 0;
        p.vx = dx * 250; p.vy = dy * 250; p.dashT = 0.18; p.dashCd = 0.7; p.inv = Math.max(p.inv, 0.28); p.dashHit = false;
        Sound.play('dash');
      }
      if (c.thr && p.hooks.length === 0) this.throwHook(p);
      if (p.dashT > 0 && s.rod >= 4 && !p.dashHit && this.bossHit(p.x, p.y, 6)) { p.dashHit = true; this.damageBoss(this.dmg, p.x, p.y); }
    }
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.x < AR.x0) { p.x = AR.x0; p.vx = 0; } if (p.x > AR.x1) { p.x = AR.x1; p.vx = 0; }
    if (p.y < AR.y0) { p.y = AR.y0; p.vy = 0; } if (p.y > AR.y1) { p.y = AR.y1; p.vy = 0; }
    p.anim += dt * (3 + Math.hypot(p.vx, p.vy) * 0.08);
    if (Math.random() < dt * 1.5) this.parts.add({ type: 'bubble', x: p.x + p.dir * 10, y: p.y - 2, vy: -rand(15, 25), life: 1.5, c: '#d8f4ff', s: 1, wob: 5, minY: 12 });
  },
  throwHook(p) {
    const s = Game.save, n = s.rod >= 5 ? 3 : 1, base = Math.atan2(p.aimY, p.aimX);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.28;
      p.hooks.push({ x: p.x + p.aimX * 6, y: p.y + p.aimY * 6, vx: Math.cos(a) * 270, vy: Math.sin(a) * 270, out: true, trav: 0, hit: false });
    }
    Sound.play('throw', s.rod);
  },
  updateHooks(p, dt) {
    const b = this.boss, s = Game.save;
    for (const h of p.hooks) {
      if (h.out) {
        if (s.rod >= 3 && !b.dead) {
          const tx = b.x + b.hox * b.dir, ty = b.y, d = dist(h.x, h.y, tx, ty) || 1, sp = Math.hypot(h.vx, h.vy);
          h.vx = lerp(h.vx, ((tx - h.x) / d) * sp, dt * 3); h.vy = lerp(h.vy, ((ty - h.y) / d) * sp, dt * 3);
        }
        h.x += h.vx * dt; h.y += h.vy * dt; h.trav += 270 * dt;
        if (h.trav >= this.rod.range || h.x < 0 || h.x > W || h.y < 8 || h.y > FLOOR_Y) h.out = false;
        if (!h.hit && this.state === 'fight') {
          if (this.bossHit(h.x, h.y, 2)) { h.hit = true; h.out = false; this.damageBoss(this.dmg, h.x, h.y); }
          for (const mn of this.minions) if (!h.hit && dist(h.x, h.y, mn.x, mn.y) < 7) { h.hit = true; h.out = false; mn.hp = 0; this.parts.burst(8, { x: mn.x, y: mn.y, c: mn.ghost ? '#c8fff0' : '#ff7a6a', life: 0.4 }, 40); Sound.play('hit'); }
        }
      } else {
        const d = dist(h.x, h.y, p.x, p.y) || 1;
        h.x += ((p.x - h.x) / d) * 330 * dt; h.y += ((p.y - h.y) / d) * 330 * dt;
        if (d < 7) h.done = true;
      }
    }
    p.hooks = p.hooks.filter(h => !h.done);
  },
  updateAir(dt) {
    if (this.state === 'fight') {
      for (let i = 0; i < this.vents.length; i++) {
        this.ventT[i] -= dt;
        if (this.ventT[i] <= 0) { this.ventT[i] = rand(2.8, 4.5) * (this.players.length > 1 ? 0.75 : 1); this.air.push({ x: this.vents[i], y: FLOOR_Y - 2, r: 5, vy: -rand(16, 24), ph: rand(0, 6) }); }
      }
    }
    for (const a of this.air) {
      a.y += a.vy * dt; a.ph += dt * 3;
      a.x += Math.sin(a.ph) * 0.3;
      if (a.y < 14) a.pop = true;
      if (a.pop || this.state !== 'fight') continue;
      for (const p of this.alive()) if (dist(a.x, a.y, p.x, p.y) < a.r + 7) {
        a.pop = true;
        p.o2 = Math.min(p.maxO2, p.o2 + 24);
        Sound.play('bubble');
        this.parts.burst(8, { type: 'bubble', x: a.x, y: a.y, c: '#e8f8ff', life: 0.4, s: 1 }, 40);
        this.parts.add({ type: 'text', text: '+AIR', x: a.x, y: a.y - 8, vy: -15, life: 0.8, c: '#9fe8ff' });
        break;
      }
    }
    this.air = this.air.filter(a => !a.pop);
  },
  updateProj(dt) {
    for (const q of this.proj) {
      q.vy += q.g * dt;
      q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt;
      if (q.type === 'ink') { q.vx *= 1 - dt * 0.3; q.vy *= 1 - dt * 0.3; }
      if (q.type === 'wave') q.y = FLOOR_Y - 4;
      if ((q.type === 'icicle' || q.type === 'shard') && q.y > FLOOR_Y) { q.life = 0; this.parts.burst(5, { x: q.x, y: FLOOR_Y - 2, c: '#e8f8ff', life: 0.4, g: 100 }, 40); }
      for (const p of this.alive()) if (p.inv <= 0 && Math.abs(q.x - p.x) < q.r + (q.type === 'wave' ? 3 : 5) && Math.abs(q.y - p.y) < q.r + (q.type === 'wave' ? 8 : 5)) {
        q.life = 0;
        if (q.type === 'ink') this.ink = 2.5;
        this.hurt(p, 1, q.x);
      }
      if (q.x < -10 || q.x > W + 10 || q.y < -20 || q.y > H) q.life = 0;
    }
    this.proj = this.proj.filter(q => q.life > 0);
  },
  updateMinions(dt) {
    for (const m of this.minions) {
      const p = this.target(m.x, m.y);
      m.t += dt; m.cd -= dt;
      if (m.cd <= 0) this.steer(m, p.x, p.y + Math.sin(m.t * 5) * 8, 58 * this.sf, dt, 2);
      m.x += m.vx * dt; m.y += m.vy * dt;
      m.y = clamp(m.y, AR.y0, AR.y1);
      if (Math.abs(m.vx) > 3) m.dir = m.vx > 0 ? 1 : -1;
      for (const q of this.alive()) if (dist(m.x, m.y, q.x, q.y) < 8 && m.cd <= 0) {
        if (q.dashT > 0 && Game.save.rod >= 4) { m.hp = 0; this.parts.burst(8, { x: m.x, y: m.y, c: '#ff7a6a', life: 0.4 }, 40); break; }
        this.hurt(q, 1, m.x); m.cd = 1.2; m.vx = -m.vx * 2; m.vy = -60;
      }
    }
    this.minions = this.minions.filter(m => m.hp > 0);
  },
  spawnMinions(n, ghost) {
    for (let i = 0; i < n; i++) {
      const b = this.boss;
      this.minions.push(ghost ? { x: b.x + rand(-20, 20), y: b.y + rand(-15, 15), vx: rand(-40, 40), vy: rand(-40, 40), hp: 1, t: rand(0, 3), cd: 0.6, dir: 1, ghost: true } : { x: i % 2 ? -8 : W + 8, y: rand(40, 140), vx: 0, vy: 0, hp: 1, t: rand(0, 3), cd: 0, dir: 1 });
    }
  },

  // ---------- boss brains ----------
  updateBoss(dt) {
    const b = this.boss;
    const p = this.target(b.x, b.y);
    b.anim += dt;
    b.flash -= dt;
    b.t -= dt;
    const p2 = b.hp < b.maxHp / 2;
    if (p2 && !b.p2) { b.p2 = true; Toasts.add(this.def.name + ' IS ENRAGED!', '#ff7a7a', 2.5, 40); Sound.play('roar'); Fx.shake = 4; }
    if (b.state === 'start') {
      if (b.t <= 0) { b.state = { pointy: 'swim', chomp: 'circle', lanterna: 'stalk', whale: 'drift', crab: 'walk', serpent: 'swim' }[b.id] || 'roam'; b.t = 1.5; }
    } else this['ai_' + b.id](b, p, dt, p2, this.sf);
    if (b.id !== 'kraken') {
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (!['exit', 'warn', 'lunge', 'hidden'].includes(b.state) || b.id === 'lanterna' || b.id === 'serpent') this.clampBoss(b);
      if ((b.id !== 'pointy' || b.state !== 'lunge') && b.id !== 'crab') { if (Math.abs(b.vx) > 4) b.dir = b.vx > 0 ? 1 : -1; }
    }
    if (b.segs) this.moveSegs(b);
    this.updateTents(b, dt);
    // contact damage
    for (const q of this.alive()) {
      if (!b.dead && b.dmgMul === 1 && b.alpha > 0.9 && b.state !== 'warn' && this.bossHit(q.x, q.y, 3)) this.hurt(q, 1, b.x);
      if (b.segs && !b.dead) for (let i = 2; i < b.segs.length; i += 2) if (dist(q.x, q.y, b.segs[i].x, b.segs[i].y) < 7) { this.hurt(q, 1, b.segs[i].x); break; }
    }
  },
  moveSegs(b) {
    let px = b.x, py = b.y;
    for (const sg of b.segs) {
      const d = dist(px, py, sg.x, sg.y);
      if (d > 5) { sg.x = px + ((sg.x - px) / d) * 5; sg.y = py + ((sg.y - py) / d) * 5; }
      px = sg.x; py = sg.y;
    }
  },
  updateTents(b, dt) {
    const tentHit = (tn, ext) => {
      for (const q of this.alive()) {
        if (tn.type === 'slam' || tn.type === 'lava') { const tipY = lerp(H + 4, tn.type === 'lava' ? 40 : 18, ext); if (Math.abs(q.x - tn.x) < 7 && q.y > tipY) this.hurt(q, 1, tn.x); }
        else if (tn.type === 'sweep') { const tipX = lerp(245, -4, ext); if (Math.abs(q.y - tn.y) < 7 && q.x > tipX && q.x < 245) this.hurt(q, 1, q.x + 10); }
      }
    };
    for (const tn of b.tents) {
      tn.t += dt;
      const T = tn.t - tn.warn;
      if (T < 0) { if ((tn.type === 'slam' || tn.type === 'lava') && Math.random() < 0.4) this.parts.add({ type: 'bubble', x: tn.x + rand(-5, 5), y: FLOOR_Y, vy: -rand(20, 40), life: 0.6, c: tn.type === 'lava' ? '#ffb08a' : '#ffd0e0', s: 1 }); continue; }
      if (tn.type === 'icicle') { this.proj.push({ x: tn.x, y: 10, vx: 0, vy: 60, g: 260, r: 3, type: 'icicle', life: 3 }); tn.done = true; continue; }
      if (!tn.fx) { tn.fx = true; Sound.play('slam'); Fx.shake = 3; }
      tn.ext = T < 0.25 ? T / 0.25 : T < 0.7 ? 1 : Math.max(0, 1 - (T - 0.7) / 0.4);
      if (T > 1.1) tn.done = true;
      if (tn.ext > 0.3) tentHit(tn, tn.ext);
    }
    b.tents = b.tents.filter(tn => !tn.done);
  },
  ai_gnarly(b, p, dt, p2, sf) {
    switch (b.state) {
      case 'roam':
        this.steer(b, p.x, p.y, (p2 ? 55 : 40) * sf, dt, 1.5);
        if (p2 && Math.random() < dt * 0.35) { const a = Math.atan2(p.y - b.y, p.x - b.x); for (let i = -1; i <= 1; i++) this.shoot(b.x + b.dir * 20, b.y, a + i * 0.3, 60); Sound.play('shoot'); }
        if (b.t <= 0) { b.state = 'windup'; b.t = (p2 ? 0.5 : 0.85) / sf; Sound.play('warn'); }
        break;
      case 'windup':
        b.vx *= 0.85; b.vy *= 0.85; b.dir = p.x > b.x ? 1 : -1; b.shake = 1;
        if (b.t <= 0) { const a = Math.atan2(p.y - b.y, p.x - b.x), sp = (p2 ? 250 : 210) * sf; b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp; b.state = 'charge'; b.t = 1.3; b.shake = 0; Sound.play('dash'); }
        break;
      case 'charge':
        if (this.clampBoss(b)) {
          b.state = 'stunned'; b.t = 1.8; b.vx = -b.vx * 0.2; b.vy = -b.vy * 0.2; b.dmgMul = 2;
          Fx.shake = 5; Sound.play('slam');
          this.parts.burst(14, { x: b.x + b.dir * b.rx, y: b.y, c: '#8e8890', life: 0.7, g: 60 }, 60);
          if (p2) for (let i = 0; i < 8; i++) this.shoot(b.x, b.y, (i / 8) * Math.PI * 2, 55);
          if (!Game.save.tips.stun) { Game.save.tips.stun = 1; Toasts.add('IT BONKED THE WALL - HIT IT FOR DOUBLE!', '#ffe14a', 3, 150); }
        } else if (b.t <= 0) { b.state = 'roam'; b.t = rand(1.5, 2.5); }
        break;
      case 'stunned':
        b.vx *= 0.9; b.vy *= 0.9;
        if (b.t <= 0) { b.state = 'roam'; b.t = rand(1.2, 2.2); b.dmgMul = 1; }
        break;
    }
  },
  ai_pointy(b, p, dt, p2, sf) {
    switch (b.state) {
      case 'swim': {
        const a = this.t * 0.9;
        this.steer(b, 160 + Math.cos(a) * 90, 90 + Math.sin(a * 1.3) * 40, 70 * sf, dt, 2);
        if (Math.random() < dt * (p2 ? 0.6 : 0.3)) { this.shoot(b.x + b.dir * 30, b.y, Math.atan2(p.y - b.y, p.x - b.x), 75); Sound.play('shoot'); }
        if (b.t <= 0) { b.state = 'exit'; b.side = b.x < 160 ? -1 : 1; }
        break;
      }
      case 'exit':
        b.vx = lerp(b.vx, b.side * 200, dt * 3); b.vy *= 0.9;
        if (b.x < -60 || b.x > W + 60) { b.state = 'warn'; b.t = (p2 ? 0.6 : 0.85) / sf; b.laneY = clamp(p.y, AR.y0 + 6, AR.y1 - 6); b.y = b.laneY; b.vx = 0; b.vy = 0; Sound.play('warn'); }
        break;
      case 'warn':
        b.y = b.laneY;
        if (b.t <= 0) { b.state = 'lunge'; b.dir = b.x < 0 ? 1 : -1; b.vx = b.dir * (p2 ? 360 : 310) * sf; Sound.play('dash'); }
        break;
      case 'lunge':
        if (Math.random() < 0.5) this.parts.add({ type: 'bubble', x: b.x - b.dir * 30, y: b.y + rand(-4, 4), vy: -10, life: 0.6, c: '#d8f4ff', s: 1 });
        if ((b.dir > 0 && b.x > W + 60) || (b.dir < 0 && b.x < -60)) {
          b.count++;
          if (b.count >= (p2 ? 4 : 3)) { b.count = 0; b.state = 'enter'; b.y = 80; b.vx = 0; }
          else { b.state = 'warn'; b.t = (p2 ? 0.55 : 0.8) / sf; b.laneY = clamp(p.y, AR.y0 + 6, AR.y1 - 6); b.y = b.laneY; b.vx = 0; Sound.play('warn'); }
        }
        break;
      case 'enter':
        this.steer(b, 160, 80, 120, dt, 3);
        if (dist(b.x, b.y, 160, 80) < 12) { b.state = 'tired'; b.t = 2.6; b.dmgMul = 2; Toasts.add('HE IS EXHAUSTED - STRIKE!', '#ffe14a', 2, 150); }
        break;
      case 'tired':
        b.vx *= 0.9; b.vy = 8;
        if (b.t <= 0) { b.state = 'swim'; b.t = rand(2, 3); b.dmgMul = 1; }
        break;
    }
  },
  ai_lanterna(b, p, dt, p2, sf) {
    switch (b.state) {
      case 'stalk':
        this.steer(b, p.x, p.y, (p2 ? 38 : 28) * sf, dt, 1);
        if (b.t <= 0) { if (Math.random() < 0.55) { b.state = 'orbs'; b.t = 0.7; } else { b.state = 'lure'; b.t = 1.0 / sf; Sound.play('warn'); } }
        break;
      case 'orbs':
        b.vx *= 0.9; b.vy *= 0.9;
        if (b.t <= 0) {
          const n = p2 ? 10 : 7, off = rand(0, 1), [lx, ly] = this.lurePos();
          for (let i = 0; i < n; i++) this.shoot(lx, ly, ((i + off) / n) * Math.PI * 2, p2 ? 62 : 50, 'orb');
          Sound.play('shoot');
          b.state = 'stalk'; b.t = rand(1.6, 2.4);
        }
        break;
      case 'lure':
        b.vx *= 0.9; b.vy *= 0.9; b.dir = p.x > b.x ? 1 : -1;
        if (b.t <= 0) { const a = Math.atan2(p.y - b.y, p.x - b.x); b.vx = Math.cos(a) * 175 * sf; b.vy = Math.sin(a) * 175 * sf; b.state = 'lunge'; b.t = 0.7; Sound.play('dash'); }
        break;
      case 'lunge':
        if (b.t <= 0 || this.clampBoss(b)) { b.state = 'tired'; b.t = 1.4; b.dmgMul = 2; }
        break;
      case 'tired':
        b.vx *= 0.9; b.vy *= 0.9;
        if (b.t <= 0) { b.state = 'stalk'; b.t = 2; b.dmgMul = 1; }
        break;
    }
  },
  ai_chomp(b, p, dt, p2, sf) {
    b.summonT -= dt;
    if (b.summonT <= 0 && b.state === 'circle') {
      b.summonT = p2 ? 6 : 9;
      this.spawnMinions(p2 ? 4 : 3, false);
      Toasts.add('PIRANHAS!', '#ff7a6a', 1.5, 150);
      Sound.play('warn');
    }
    switch (b.state) {
      case 'circle':
        b.orb = (b.orb || 0) + dt * (p2 ? 1.1 : 0.8);
        this.steer(b, 160 + Math.cos(b.orb) * 110, 90 + Math.sin(b.orb) * 45, (p2 ? 110 : 90) * sf, dt, 2);
        if (b.t <= 0) { b.state = 'aim'; b.t = (p2 ? 0.4 : 0.6) / sf; b.bites = p2 ? 2 : 1; Sound.play('warn'); }
        break;
      case 'aim':
        b.vx *= 0.85; b.vy *= 0.85; b.dir = p.x > b.x ? 1 : -1; b.shake = 1;
        if (b.t <= 0) { const a = Math.atan2(p.y - b.y, p.x - b.x); b.vx = Math.cos(a) * 270 * sf; b.vy = Math.sin(a) * 270 * sf; b.state = 'bite'; b.t = 0.6; b.shake = 0; Sound.play('roar'); }
        break;
      case 'bite':
        if (this.clampBoss(b)) Fx.shake = 3;
        if (b.t <= 0) { b.bites--; if (b.bites > 0) { b.state = 'aim'; b.t = 0.3; } else { b.state = 'dazed'; b.t = 1.1; b.dmgMul = 2; } }
        break;
      case 'dazed':
        b.vx *= 0.9; b.vy *= 0.9;
        if (b.t <= 0) { b.state = 'circle'; b.t = rand(2.2, 3.2); b.dmgMul = 1; }
        break;
    }
  },
  ai_kraken(b, p, dt, p2, sf) {
    b.x = lerp(b.x, b.startX, dt);
    b.y = 86 + Math.sin(this.t * 0.6) * 26;
    b.dir = -1;
    b.atkT -= dt;
    if (b.atkT <= 0) {
      b.atkT = (p2 ? 1.5 : 2.1) / sf;
      const r = Math.random(), wn = (p2 ? 0.7 : 0.9) / sf;
      if (r < 0.45) {
        b.tents.push({ type: 'slam', x: clamp(p.x, 14, 225), t: 0, warn: wn });
        if (p2) b.tents.push({ type: 'slam', x: clamp(p.x + choice([-50, 50]), 14, 225), t: 0, warn: 1.1 / sf });
      } else if (r < 0.75) b.tents.push({ type: 'sweep', y: clamp(p.y, AR.y0 + 4, AR.y1 - 4), t: 0, warn: wn });
      else { const a = Math.atan2(p.y - b.y, p.x - b.x); for (let i = -1; i <= 1; i++) this.shoot(b.x - 20, b.y + 8, a + i * 0.25, 70, 'ink'); Sound.play('shoot'); }
      Sound.play('warn');
    }
  },
  ai_whale(b, p, dt, p2, sf) {
    switch (b.state) {
      case 'drift':
        b.alpha = Math.min(1, b.alpha + dt * 2);
        this.steer(b, p.x, p.y, 34 * sf, dt, 1);
        if (b.t <= 0) {
          const r = Math.random();
          if (r < 0.38) { b.state = 'cannons'; b.t = 0.6 / sf; Sound.play('warn'); }
          else if (r < 0.75) { b.state = 'fade'; }
          else { b.state = 'summon'; b.t = 0.5; }
        }
        break;
      case 'cannons':
        b.vx *= 0.9; b.vy *= 0.9; b.shake = 1;
        if (b.t <= 0) {
          b.shake = 0;
          const n = p2 ? 5 : 3, a = Math.atan2(p.y - b.y, p.x - b.x);
          for (let i = 0; i < n; i++) this.shoot(b.x + b.dir * 34, b.y + 4, a + (i - (n - 1) / 2) * 0.22, 85, 'cannon');
          Sound.play('slam'); Fx.shake = 2;
          b.state = 'drift'; b.t = rand(1.8, 2.6);
        }
        break;
      case 'fade':
        b.alpha -= dt * 1.6; b.vx *= 0.95; b.vy *= 0.95;
        if (b.alpha <= 0) { b.alpha = 0; b.state = 'hidden'; b.t = 0.9; }
        break;
      case 'hidden':
        if (b.t <= 0) { b.x = p.x < 160 ? 272 : 48; b.y = clamp(p.y, 40, 140); b.dir = p.x > b.x ? 1 : -1; b.vx = 0; b.vy = 0; b.state = 'appear'; b.t = 0.8 / sf; b.laneY = b.y; Sound.play('warn'); }
        break;
      case 'appear':
        b.alpha = Math.min(0.6, b.alpha + dt);
        if (b.t <= 0) { b.alpha = 1; b.vx = b.dir * 230 * sf; b.state = 'charge'; b.t = 1.6; Sound.play('roar'); }
        break;
      case 'charge':
        b.vy = 0;
        if (this.clampBoss(b)) { b.state = 'stunned'; b.t = 1.7; b.vx = -b.vx * 0.15; b.dmgMul = 2; Fx.shake = 5; Sound.play('slam'); if (p2) this.spawnMinions(2, true); }
        else if (b.t <= 0) { b.state = 'drift'; b.t = 2; }
        break;
      case 'stunned':
        b.vx *= 0.9; b.vy *= 0.9;
        if (b.t <= 0) { b.state = 'drift'; b.t = rand(1.5, 2.2); b.dmgMul = 1; }
        break;
      case 'summon':
        b.vx *= 0.9; b.vy *= 0.9;
        if (b.t <= 0) { this.spawnMinions(p2 ? 4 : 3, true); Toasts.add('GHOST FISH! ARRR!', '#c8fff0', 1.5, 150); Sound.play('warn'); b.state = 'drift'; b.t = 2.5; }
        break;
    }
  },
  ai_crab(b, p, dt, p2, sf) {
    const floorY = FLOOR_Y - 16;
    switch (b.state) {
      case 'walk':
        b.vx = lerp(b.vx, Math.sign(p.x - b.x) * (p2 ? 55 : 40) * sf, dt * 3);
        b.vy = (floorY - b.y) * 4;
        if (b.t <= 0) {
          const r = Math.random();
          if (r < 0.4) { b.state = 'crouch'; b.t = 0.55 / sf; Sound.play('warn'); }
          else if (r < 0.7) { b.state = 'shards'; b.t = 0.6 / sf; }
          else {
            b.state = 'walk'; b.t = rand(1.8, 2.6);
            const xs = p2 ? [-60, -30, 0, 30, 60] : [-40, 0, 40];
            for (const dx of xs) b.tents.push({ type: 'icicle', x: clamp(p.x + dx, 12, 308), t: 0, warn: 0.85 / sf });
            Sound.play('warn');
          }
        }
        break;
      case 'crouch':
        b.vx *= 0.8; b.shake = 1;
        if (b.t <= 0) { b.shake = 0; b.state = 'leap'; b.vy = -230; b.vx = (p.x - b.x) / 1.5; Sound.play('dash'); }
        break;
      case 'leap':
        b.vy += 300 * dt;
        if (b.vy > 0 && b.y >= floorY) {
          b.y = floorY; b.vy = 0; b.vx = 0;
          Fx.shake = 5; Sound.play('slam');
          this.proj.push({ x: b.x - 16, y: FLOOR_Y - 4, vx: -120 * sf, vy: 0, g: 0, r: 4, type: 'wave', life: 4 }, { x: b.x + 16, y: FLOOR_Y - 4, vx: 120 * sf, vy: 0, g: 0, r: 4, type: 'wave', life: 4 });
          this.parts.burst(16, { x: b.x, y: FLOOR_Y - 2, c: '#e8f8ff', life: 0.6, g: 100 }, 60);
          b.leaps = (b.leaps || 0) + 1;
          if (p2 && b.leaps % 2 === 1) { b.state = 'crouch'; b.t = 0.35; }
          else { b.state = 'stuck'; b.t = 1.4; b.dmgMul = 2; Toasts.add('CLAWS STUCK IN THE ICE!', '#ffe14a', 1.5, 150); }
        }
        break;
      case 'stuck':
        b.vx = 0;
        if (b.t <= 0) { b.state = 'walk'; b.t = rand(1.5, 2.3); b.dmgMul = 1; }
        break;
      case 'shards':
        b.vx *= 0.8; b.shake = 1;
        if (b.t <= 0) {
          b.shake = 0;
          const n = p2 ? 7 : 5;
          for (let i = 0; i < n; i++) this.shoot(b.x, b.y - 10, -Math.PI / 2 + (i - (n - 1) / 2) * 0.28, 130, 'shard', 120);
          Sound.play('shoot');
          b.state = 'walk'; b.t = rand(1.5, 2.3);
        }
        break;
    }
    b.dir = 1;
  },
  ai_serpent(b, p, dt, p2, sf) {
    switch (b.state) {
      case 'swim': {
        const a = Math.atan2(p.y - b.y, p.x - b.x), wig = Math.sin(this.t * 3) * 30;
        this.steer(b, p.x - Math.sin(a) * wig, p.y + Math.cos(a) * wig, (p2 ? 90 : 72) * sf, dt, 2);
        if (b.t <= 0) {
          const r = Math.random();
          if (r < 0.35) { b.state = 'fire'; b.t = 0.5 / sf; }
          else if (r < 0.65) {
            b.state = 'swim'; b.t = rand(2, 3);
            const xs = p2 ? [-60, -20, 20, 60] : [-40, 0, 40];
            for (const dx of xs) b.tents.push({ type: 'lava', x: clamp(p.x + dx, 14, 306), t: 0, warn: 0.9 / sf });
            Sound.play('warn');
          } else { b.state = 'coil'; b.t = 0.55 / sf; Sound.play('warn'); }
        }
        break;
      }
      case 'fire':
        b.vx *= 0.9; b.vy *= 0.9;
        if (b.t <= 0) {
          const n = p2 ? 5 : 3, a = Math.atan2(p.y - b.y, p.x - b.x);
          for (let i = 0; i < n; i++) this.shoot(b.x, b.y, a + (i - (n - 1) / 2) * 0.25, 95, 'fire');
          Sound.play('shoot');
          b.state = 'swim'; b.t = rand(1.8, 2.6);
        }
        break;
      case 'coil':
        b.vx *= 0.85; b.vy *= 0.85; b.shake = 1;
        if (b.t <= 0) { const a = Math.atan2(p.y - b.y, p.x - b.x); b.vx = Math.cos(a) * 240 * sf; b.vy = Math.sin(a) * 240 * sf; b.state = 'lunge'; b.t = 0.7; b.shake = 0; Sound.play('roar'); }
        break;
      case 'lunge':
        if (b.t <= 0 || this.clampBoss(b)) { b.state = 'tired'; b.t = 1.4; b.dmgMul = 2; }
        break;
      case 'tired':
        b.vx *= 0.9; b.vy = 10;
        if (b.t <= 0) { b.state = 'swim'; b.t = rand(2, 3); b.dmgMul = 1; }
        break;
    }
  },

  // ---------- drawing ----------
  draw() {
    const t = this.t, b = this.boss, th = FIGHT_THEMES[this.def.id];
    G.drawImage(this.bg, 0, 0);
    G.globalAlpha = 0.25;
    for (const f of this.school) drawFish(FISH[0], 8, f.x, f.y, -1, Math.floor(t * 4 + f.y) % 2, 's');
    G.globalAlpha = 1;
    if (!this.dark) {
      G.globalAlpha = this.def.id === 'whale' ? 0.04 : 0.07;
      for (let i = 0; i < 5; i++) { const x0 = 20 + i * 70 + Math.sin(t * 0.4 + i * 2) * 10; for (let y = 10; y < FLOOR_Y; y += 2) R(x0 + y * 0.4, y, 10 - y * 0.03, 2, '#ffffff'); }
      G.globalAlpha = 1;
    }
    for (let x = 0; x < W; x++) { const y = 10 + Math.round(Math.sin(x * 0.1 + t * 2) * 1.2); R(x, 0, 1, y, mix(th.top, '#ffffff', 0.25)); P(x, y, mix(th.top, '#ffffff', 0.6)); }
    for (const k of this.kelp) for (let i = 0; i < k.h; i++) {
      const sw = Math.round(Math.sin(t * 1.4 + i * 0.2 + k.x) * (i / k.h) * 5);
      P(k.x + sw, FLOOR_Y - i, i % 3 ? darken(th.coral[0], 0.15) : th.coral[0]);
      if (i % 4 === 1) P(k.x + sw + 1, FLOOR_Y - i, lighten(th.coral[0], 0.2));
    }
    for (const v of this.vents) { R(v - 4, FLOOR_Y - 2, 9, 3, '#5a5260'); R(v - 2, FLOOR_Y - 3, 5, 1, '#3a3440'); }
    for (const a of this.air) { pring(a.x, a.y, a.r, '#e8f8ff'); P(a.x - 2, a.y - 2, '#ffffff'); P(a.x - 1, a.y - 3, '#ffffff'); G.globalAlpha = 0.18; pcircle(a.x, a.y, a.r - 1, '#bfefff'); G.globalAlpha = 1; }
    if (this.loot && !this.loot.got) {
      const L = this.loot, by = L.y + Math.round(Math.sin(t * 3) * 2);
      glow(L.x, by, 18, '#ffe98a', 0.14);
      if (L.kind === 'rod') { G.save(); G.translate(Math.round(L.x - 14), Math.round(by - 14)); G.scale(2, 2); iconRod(0, 0, RODS[L.rod], true); G.restore(); }
      else if (L.kind === 'charm') { G.save(); G.translate(Math.round(L.x), Math.round(by)); G.scale(2, 2); drawCharm(L.charm, 0, 0); G.restore(); }
      else blit(fishSprite(FISH_BY_ID.chest, 11, 0), L.x - 13, by - 11, false, 2);
    }
    this.drawTents();
    this.drawBoss();
    for (const m of this.minions) { if (m.ghost) G.globalAlpha = 0.7; drawFish(m.ghost ? GHOSTFISH : PIRANHA, 9, m.x, m.y, m.dir, Math.floor(t * 8) % 2); G.globalAlpha = 1; }
    for (const p of this.players) {
      for (const h of p.hooks) {
        drawLine(p.x + p.dir * 5, p.y - 4, h.x, h.y, 0, 'rgba(240,240,255,0.7)');
        P(h.x, h.y, '#cfd6e0'); P(h.x + 1, h.y + 1, '#cfd6e0'); P(h.x, h.y + 2, '#cfd6e0'); P(h.x - 1, h.y + 1, '#9aa3ad');
      }
      if (p.down) {
        G.globalAlpha = 0.6; drawSwimmer(p.x, p.y, p.dir, 0, false, 0.4, p.pal); G.globalAlpha = 1;
        pring(p.x, p.y, 14, '#e8f8ff'); P(p.x - 6, p.y - 9, '#ffffff');
        if (this.state === 'fight') drawText('HELP!', p.x, p.y - 22, '#ffe14a', { align: 'center', outline: '#1a0a0a' });
        continue;
      }
      if (this.state === 'lose' && Math.sin(t * 10) < -0.5) continue;
      if (p.inv <= 0 || Math.floor(t * 16) % 2 === 0 || this.state === 'intro') drawSwimmer(p.x, p.y, p.dir, Math.floor(p.anim) % 2, p.dashT > 0 && Game.save.rod >= 4, 0, p.pal);
      if (this.state === 'fight' || this.state === 'loot') drawRod(p.x + p.dir * 4, p.y - 4, Math.atan2(p.aimY, p.aimX), 11, this.rod, 0);
      if (this.players.length > 1) drawText('P' + (p.i + 1), p.x, p.y - 20, p.i ? '#9aff8a' : '#9ad8ff', { align: 'center', outline: '#1a0f14' });
    }
    for (const q of this.proj) {
      if (q.type === 'orb') { glow(q.x, q.y, 6, '#fff6a0', 0.2); pcircle(q.x, q.y, 2, '#fff6a0'); P(q.x, q.y, '#ffffff'); }
      else if (q.type === 'ink') { pcircle(q.x, q.y, q.r, '#1a0a20'); P(q.x - 2, q.y - 2, '#5a3a6a'); }
      else if (q.type === 'cannon') { pcircle(q.x, q.y, q.r, '#2a2a30'); P(q.x - 1, q.y - 2, '#8a8a98'); if (Math.random() < 0.3) this.parts.add({ type: 'bubble', x: q.x, y: q.y, vy: -10, life: 0.5, c: '#d8f4ff', s: 1 }); }
      else if (q.type === 'fire') { glow(q.x, q.y, 7, '#ff7a2a', 0.25); pcircle(q.x, q.y, 3, '#ff6a1a'); pcircle(q.x, q.y, 1, '#ffe14a'); }
      else if (q.type === 'shard' || q.type === 'icicle') { const a = Math.atan2(q.vy, q.vx); pline(q.x - Math.cos(a) * 4, q.y - Math.sin(a) * 4, q.x, q.y, '#bfefff'); P(q.x, q.y, '#ffffff'); }
      else if (q.type === 'wave') { for (let k = 0; k < 4; k++) R(q.x - 3 + k * 2, q.y - k * 2 + 4, 2, k * 2 + 2, k % 2 ? '#e8f8ff' : '#9fd8ff'); }
      else { pring(q.x, q.y, q.r, '#e8f8ff'); P(q.x - 1, q.y - 1, '#ffffff'); }
    }
    this.parts.draw();
    if (this.dark) this.drawDark();
    if (this.ink > 0) {
      G.globalAlpha = Math.min(1, this.ink) * 0.85;
      for (let i = 0; i < 9; i++) pcircle(hash(i, 1) * W, hash(i, 2) * H, 18 + hash(i, 3) * 20, '#120818');
      G.globalAlpha = 1;
    }
    if (this.alive().some(p => p.o2 < 25) && this.state === 'fight') { G.globalAlpha = 0.12 + Math.sin(t * 8) * 0.08; R(0, 0, W, H, '#ff2a2a'); G.globalAlpha = 1; }
    this.drawHUD();
  },
  drawBoss() {
    const b = this.boss, t = this.t;
    if (this.state === 'loot') return;
    const sx = b.shake ? rand(-1, 1) : 0, white = b.flash > 0;
    if (b.id === 'kraken') drawKraken(b.x + sx, b.y, t, { white, angry: b.p2 });
    else if (b.id === 'serpent') this.drawSerpent(b, white);
    else {
      if (b.state === 'warn') {
        const fromLeft = b.x < 0, blink = Math.floor(t * 10) % 2;
        G.globalAlpha = 0.5;
        for (let x = 0; x < W; x += 6) R(x, b.laneY, 3, 1, blink ? '#ff4a4a' : '#ffb0b0');
        G.globalAlpha = 1;
        drawText('!', fromLeft ? 6 : W - 9, b.laneY - 3, '#ff4a4a', { scale: 2, outline: '#1a0a0a' });
        return;
      }
      if (b.id === 'whale' && b.state === 'appear') { G.globalAlpha = 0.4; for (let x = 0; x < W; x += 6) R(x, b.laneY, 3, 1, Math.floor(t * 10) % 2 ? '#c8fff0' : '#ffffff'); G.globalAlpha = 1; }
      const fast = ['charge', 'lunge', 'bite', 'leap'].includes(b.state) || (b.id === 'crab' && Math.abs(b.vx) > 5);
      const fr = Math.floor(b.anim * (fast ? 12 : 5)) % 2;
      G.globalAlpha = b.id === 'whale' ? 0.85 * b.alpha + (b.state === 'appear' ? Math.sin(t * 30) * 0.15 : 0) : 1;
      if (G.globalAlpha > 0.02) {
        const img = drawFish(b.def, b.def.len, b.x + sx, b.y + b.drawOy, b.dir, b.id === 'crab' ? (b.state === 'shards' || b.state === 'crouch' ? 1 : fr) : fr, white ? 'w' : 'c');
        if (b.id === 'whale') this.drawPirateHat(b, img);
      }
      G.globalAlpha = 1;
      if (b.id === 'lanterna') {
        const [lx, ly] = this.lurePos();
        const pulse = b.state === 'lure' ? (Math.floor(t * 12) % 2 ? 1.8 : 0.6) : 1 + Math.sin(t * 3) * 0.2;
        glow(lx, ly, 10 * pulse, '#fff6a0', 0.2);
      }
    }
    if (b.dmgMul > 1 && !b.dead) for (let i = 0; i < 3; i++) { const a = t * 4 + (i * Math.PI * 2) / 3; iconStar(b.x + Math.cos(a) * 12 - 2, b.y - b.ry - 8 + Math.sin(a) * 3); }
  },
  drawPirateHat(b, img) {
    const [hx, top, ex, ey] = img.meta.head, left = b.x - img.width / 2, tp = b.y - img.height / 2;
    const mx = x => Math.round(left + (b.dir > 0 ? x : img.width - 1 - x));
    const X = mx(hx), Y = Math.round(tp + top);
    R(X - 10, Y - 3, 21, 3, '#1a1420'); R(X - 7, Y - 7, 15, 4, '#1a1420'); R(X - 12, Y - 2, 3, 2, '#1a1420'); R(X + 10, Y - 2, 3, 2, '#1a1420');
    R(X - 7, Y - 4, 15, 1, '#d8b040');
    R(X - 1, Y - 7, 3, 2, '#f0f0e8'); P(X - 1, Y - 5, '#f0f0e8'); P(X + 1, Y - 5, '#f0f0e8');
    const EX = mx(ex), EY = Math.round(tp + ey);
    R(EX - 1, EY - 1, 3, 3, '#1a1420');
    pline(EX - 2, EY - 2, EX - 8 * b.dir, EY - 6, '#1a1420');
  },
  drawSerpent(b, white) {
    const t = this.t, segs = b.segs;
    for (let i = segs.length - 1; i >= 0; i--) {
      const sg = segs[i], r = Math.max(2, 7 - i * 0.28);
      pcircle(sg.x, sg.y, r, white ? '#ffffff' : i % 2 ? '#c0301a' : '#8a1a10');
      if (!white && i % 3 === 0) P(sg.x, sg.y + r - 1, '#ffb03a');
      if (!white && i % 2 === 0) P(sg.x, sg.y - r - 1, '#ff7a1a');
    }
    glow(b.x, b.y, 14, '#ff6a2a', 0.1);
    pcircle(b.x, b.y, 8, white ? '#ffffff' : '#c0301a');
    if (white) return;
    const ang = Math.atan2(b.y - segs[0].y, b.x - segs[0].x), c = Math.cos(ang), s = Math.sin(ang);
    const fx = (a, d) => b.x + c * a - s * d, fy = (a, d) => b.y + s * a + c * d;
    pcircle(fx(5, 0), fy(5, 0), 5, '#a82818');
    for (const sd of [-1, 1]) { P(fx(2, sd * 4), fy(2, sd * 4), '#ffe14a'); P(fx(3, sd * 4), fy(3, sd * 4), '#1a0a0a'); pline(fx(-3, sd * 5), fy(-3, sd * 5), fx(-8, sd * 9), fy(-8, sd * 9), '#f0e0c8'); }
    if (b.state === 'fire' || b.state === 'coil') glow(fx(9, 0), fy(9, 0), 6, '#ffe14a', 0.3);
  },
  drawTents() {
    const b = this.boss, t = this.t;
    for (const tn of b.tents) {
      const T = tn.t - tn.warn, blink = Math.floor(tn.t * 10) % 2;
      if (T < 0) {
        if (tn.type === 'slam' || tn.type === 'lava') {
          const c = tn.type === 'lava' ? '#ff8a2a' : '#ff4a6a';
          G.globalAlpha = 0.45; R(tn.x - 7, 18, 14, FLOOR_Y - 18, blink ? c : '#ffd0b0'); G.globalAlpha = 1;
          drawText('!', tn.x - 2, FLOOR_Y - 12, '#ff4a4a', { scale: 2, outline: '#1a0a0a' });
        } else if (tn.type === 'icicle') {
          G.globalAlpha = 0.5; R(tn.x - 3, 10, 7, FLOOR_Y - 10, blink ? '#bfefff' : '#ffffff'); G.globalAlpha = 1;
          for (let k = 0; k < 6; k++) R(tn.x - 2 + Math.floor(k / 2), 8 + k, Math.max(1, 5 - k), 1, '#e8f8ff');
        } else { G.globalAlpha = 0.35; R(0, tn.y - 6, 245, 13, blink ? '#ff4a6a' : '#ff9ab0'); G.globalAlpha = 1; drawText('!', 6, tn.y - 4, '#ff4a4a', { scale: 2, outline: '#1a0a0a' }); }
        continue;
      }
      const ext = tn.ext || 0;
      if (tn.type === 'slam' || tn.type === 'lava') {
        const lava = tn.type === 'lava', tipY = lerp(H + 4, lava ? 40 : 18, ext);
        if (lava) glow(tn.x, tipY, 12, '#ff7a2a', 0.2);
        for (let y = H + 4, i = 0; y > tipY; y -= 3, i++) {
          const k = (y - tipY) / (H - tipY + 4);
          const r = Math.max(1, 2 + k * 5), x = tn.x + Math.sin(y * 0.1 + t * 6) * 2;
          pcircle(x, y, r, lava ? (i % 2 ? '#ff6a1a' : '#ffb03a') : i % 2 ? '#a3375a' : '#6b1f3d');
          if (!lava && i % 3 === 0 && r > 2) P(x - r + 1, y, '#f2b4c4');
        }
      } else if (tn.type === 'sweep') {
        const tipX = lerp(245, -4, ext);
        for (let x = 245, i = 0; x > tipX; x -= 3, i++) {
          const k = (x - tipX) / (245 - tipX + 1);
          const r = Math.max(1, 2 + k * 5), y = tn.y + Math.sin(x * 0.1 + t * 6) * 2;
          pcircle(x, y, r, i % 2 ? '#a3375a' : '#6b1f3d');
          if (i % 3 === 0 && r > 2) P(x, y + r - 1, '#f2b4c4');
        }
      }
    }
  },
  drawDark() {
    const c = this.darkC, x = c.getContext('2d'), b = this.boss;
    x.globalCompositeOperation = 'source-over';
    x.clearRect(0, 0, W, H);
    x.fillStyle = 'rgba(3,2,10,0.94)';
    x.fillRect(0, 0, W, H);
    x.globalCompositeOperation = 'destination-out';
    withTarget(x, () => {
      const hole = (hx, hy, r) => { G.globalAlpha = 0.35; pcircle(hx, hy, r, '#000'); G.globalAlpha = 0.5; pcircle(hx, hy, r * 0.7, '#000'); G.globalAlpha = 1; pcircle(hx, hy, r * 0.45, '#000'); };
      for (const p of this.players) { hole(p.x, p.y, Game.save.rod >= 3 || Game.save.charms[0] ? 58 : 36); for (const h of p.hooks) hole(h.x, h.y, 5); }
      if (!b.dead && this.state !== 'loot') { const [lx, ly] = this.lurePos(); hole(lx, ly, b.state === 'lure' ? 44 : 24 + Math.sin(this.t * 3) * 3); }
      for (const q of this.proj) hole(q.x, q.y, 10);
      for (const a of this.air) hole(a.x, a.y, 9);
      if (this.loot) hole(this.loot.x, this.loot.y, 24);
      G.globalAlpha = 1;
    });
    x.globalCompositeOperation = 'source-over';
    G.drawImage(c, 0, 0);
  },
  drawHUD() {
    const b = this.boss, t = this.t;
    this.players.forEach((p, k) => {
      const ox = k === 0 ? 4 : W - 4 - Math.max(p.maxHp * 9, 70), oy = 4;
      if (this.players.length > 1) drawText('P' + (k + 1), ox, oy + 26, k ? '#9aff8a' : '#9ad8ff', { outline: '#1a0f14' });
      for (let i = 0; i < p.maxHp; i++) iconHeart(ox + i * 9, oy, i < p.hp);
      iconBubble(ox + 3, oy + 12);
      const low = p.o2 < 25;
      bar(ox + 8, oy + 10, Math.min(60, 50 * (p.maxO2 / 100)), 4, p.o2 / p.maxO2, low && Math.floor(t * 6) % 2 ? '#ff6a6a' : '#7fd7ff');
      if (!p.down && this.state === 'fight') {
        if (p.o2 <= 0) drawText('NO AIR!', ox + 8, oy + 17, '#ff6a6a', { outline: '#1a0a0a' });
        else if (low) drawText('LOW AIR!', ox + 8, oy + 17, '#ffb0b0', { outline: '#1a0a0a' });
      }
    });
    iconRod(4, 162, this.rod); drawText(this.rod.name, 15, 166, 'rgba(255,255,255,0.7)');
    if (this.state !== 'intro' && !b.dead) {
      drawText(this.def.name, W / 2, 4, '#ffe9d0', { align: 'center', outline: '#1a0a0a' });
      bar(100, 12, 120, 4, b.hp / b.maxHp, b.p2 ? '#ff4a6a' : '#ff9a4a');
    }
    if (this.state === 'intro') {
      const k = Math.min(1, this.stT / 0.5), out = this.stT > 2.2 ? (this.stT - 2.2) / 0.4 : 0;
      const y = Math.round(lerp(-30, 56, easeOut(k)) - out * 90);
      G.globalAlpha = 0.7; R(0, y - 4, W, 34, '#0d0a14'); G.globalAlpha = 1;
      drawText(this.def.name, W / 2, y, '#ffe14a', { scale: 3, align: 'center', outline: '#3a1a1a' });
      drawText(this.def.title, W / 2, y + 20, '#ffd0c0', { align: 'center' });
    }
    if (this.state === 'loot') drawText('GRAB THE ' + (this.loot.kind === 'rod' ? 'ROD' : this.loot.kind === 'charm' ? 'CHARM' : 'TREASURE') + '!', W / 2, 30, '#ffe14a', { align: 'center', outline: '#1a0a0a' });
    // touch controls
    if (Input.isTouch && (this.state === 'fight' || this.state === 'loot')) {
      G.globalAlpha = 0.35;
      const j = this.joy, bx = j ? j.sx : 44, by = j ? j.sy : 138;
      pring(bx, by, 18, '#ffffff');
      const k = j ? Math.min(1, Math.hypot(j.dx, j.dy) / 18) : 0, d = j ? Math.hypot(j.dx, j.dy) || 1 : 1;
      pcircle(bx + (j ? (j.dx / d) * k * 18 : 0), by + (j ? (j.dy / d) * k * 18 : 0), 7, '#ffffff');
      pcircle(288, 146, 16, '#ffd27a'); pcircle(252, 160, 11, '#7fd7ff');
      G.globalAlpha = 0.9;
      drawText('HOOK', 288, 144, '#3a1a1a', { align: 'center' });
      drawText('DASH', 252, 158, '#1a2a3a', { align: 'center' });
      G.globalAlpha = 1;
    }
  },
};
