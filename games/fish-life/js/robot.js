/* =====================================================================
   Fish Life — the giant robot
   Your bowl turns into a walking robot with lasers and missiles,
   bursts out of the apartment and stomps across the world:
   the city, the countryside, the beach and the army base.
   ===================================================================== */
'use strict';

const ROBOT_W = 4300, ROBOT_GY = 160;
const ROBOT_ZONES = [
  { name: 'THE CITY', x: 0, sky: ['#4aa8ec', '#c8ecfb'] },
  { name: 'THE COUNTRYSIDE', x: 1150, sky: ['#5ec4f0', '#e0f8d8'] },
  { name: 'THE BEACH', x: 2250, sky: ['#2ce8f5', '#fff6c9'] },
  { name: 'THE ARMY BASE', x: 3100, sky: ['#f77622', '#3e2731'] },
];
const ROBOT_BOSS_X = 3950;
const DIVE_X = 2870;     // the end of the pier
const ENEMY_STATS = {
  tank: { hp: 6, w: 26, h: 14, iq: 20, name: 'TANK' },
  heli: { hp: 5, w: 26, h: 12, iq: 15, name: 'HELICOPTER' },
  drone: { hp: 2, w: 10, h: 6, iq: 6, name: 'DRONE' },
  boss: { hp: 140, w: 84, h: 40, iq: 120, name: 'MEGA TANK' },
  shark: { hp: 10, w: 30, h: 12, iq: 25, name: 'SHARK' },
  sub: { hp: 8, w: 30, h: 12, iq: 22, name: 'SUBMARINE' },
  jelly: { hp: 2, w: 10, h: 12, iq: 5, name: 'JELLYFISH' },
  boat: { hp: 60, w: 60, h: 30, iq: 150, name: 'FISHING BOAT' },
};

class RobotScene {
  constructor(bowl) {
    this.bowl = bowl;
    this.b = bowl.b;
    this.t = 0;
    this.elapsed = 0;
    this.p = { x: 110, y: 74, vx: 0, vy: 0, face: 1, ground: false, hp: 100, fuel: 100, anim: 0, inv: 0, stomp: false, aim: 0 };
    this.camX = 0;
    this.intro = { t: 0, broke: false };
    this.enemies = [];
    this.shots = [];
    this.crates = [];
    this.parts = new Particles();
    this.floaters = new Floaters();
    this.fireCD = 0;
    this.missileCD = 0;
    this.kills = 0;
    this.trickle = 4;
    this.zone = -1;
    this.banner = null;
    this.won = false;
    this.dead = null;
    this.army = this.bowl.owned('army') ? [[-26, -54], [-34, -36], [-22, -70], [-40, -60]].map(([ox, oy], i) => ({ ox, oy, x: 110 + ox, y: 74 + oy, cd: 0.5 + i * 0.3, i })) : [];
    this.bowing = this.bowl.owned('mind');
    this.worldW = ROBOT_W;
    this.phys = { grav: 520, jet: 900, up: -140, fuel: 40, walk: 85, top: 36, fall: 9999 };
    this.cars = [];
    this.setupWorld();
    Sound.sfx('rumble');
  }
  enter() { Sound.play('danger'); }
  setupWorld() {
    // things placed along the world
    const r = mulberry32(7);
    this.spawns = [];
    const add = (x, type, y) => this.spawns.push({ x, type, y });
    for (let x = 520; x < ROBOT_BOSS_X - 200; x += 120 + Math.floor(r() * 120)) {
      const z = this.zoneAt(x);
      const types = [['tank', 'drone', 'drone'], ['tank', 'heli', 'tank'], ['heli', 'drone', 'heli'], ['tank', 'heli', 'drone', 'tank']][z];
      add(x, types[Math.floor(r() * types.length)], 40 + Math.floor(r() * 50));
      if (z === 3 && r() < 0.6) add(x + 30, types[Math.floor(r() * types.length)], 40 + Math.floor(r() * 50));
    }
    add(ROBOT_BOSS_X, 'boss');
    this.spawns.sort((a, c) => a.x - c.x);
    this.people = [];
    for (let i = 0; i < 26; i++) {
      const x = 260 + r() * 2700;
      this.people.push({ x, home: x, c: pick(['#e43b44', '#0099db', '#63c74d', '#feae34', '#b55088', '#ffffff']), hair: pick(['#3e2731', '#733e39', '#feae34']), ph: r() * 9, flee: 0, sp: 40 + r() * 40 });
    }
    this.cars = [];
    for (let x = 300; x < 1050; x += 90 + Math.floor(r() * 80)) this.cars.push({ x, c: pick(['#e43b44', '#0099db', '#fee761', '#63c74d']), broken: false });
    this.cows = [1300, 1480, 1700, 1930].map(x => ({ x, face: r() < 0.5 ? 1 : -1 }));
    for (const x of [900, 1800, 2700, 3400]) this.crates.push({ x, y: ROBOT_GY, vy: 0 });
    this.far = this.paintFar();
    this.near = this.paintNear();
  }
  onBlur() {}
  zoneAt(x) { let z = 0; ROBOT_ZONES.forEach((zn, i) => { if (x >= zn.x) z = i; }); return z; }

  /* --------------------------------------------------- backgrounds */
  paintFar() {
    const fw = Math.ceil(ROBOT_W * 0.35) + W, c = makeCanvas(fw, H), prev = setTarget(c.getContext('2d'));
    const r = mulberry32(3);
    // clouds
    for (let i = 0; i < 30; i++) {
      const x = r() * fw, y = 12 + r() * 50, w = 14 + r() * 26;
      ellipse(x, y, w, 4, '#ffffff'); ellipse(x - w * 0.3, y - 3, w * 0.4, 3, '#ffffff');
    }
    // distant scenery
    for (let x = 0; x < fw; x += 2) {
      const wx = (x - W / 2) / 0.35 + W / 2, z = this.zoneAt(wx);
      if (z === 0) { /* skyline drawn below */ }
      else if (z === 1) { const h = 36 + Math.sin(x * 0.02) * 10 + Math.sin(x * 0.051) * 6; rect(x, 160 - h, 2, h, '#3e8948'); }
      else if (z === 2) { rect(x, 118, 2, 42, (x >> 2) % 5 ? '#0099db' : '#2ce8f5'); }
      else { const h = 50 + Math.abs(Math.sin(x * 0.013)) * 30; rect(x, 160 - h, 2, h, '#5a3a2e'); }
    }
    for (let x = 0; x < (1150 - W / 2) * 0.35 + W / 2; x += 12 + Math.floor(r() * 10)) {
      const h = 40 + r() * 60, w = 10 + r() * 14;
      rect(x, 160 - h, w, h, '#5a6988');
      for (let wy = 160 - h + 4; wy < 156; wy += 6) for (let wx = x + 2; wx < x + w - 2; wx += 4) if (r() < 0.6) px(wx, wy, '#c0cbdc');
    }
    setTarget(prev);
    return c;
  }
  paintNear() {
    const c = makeCanvas(ROBOT_W, H), prev = setTarget(c.getContext('2d'));
    const r = mulberry32(11), G = ROBOT_GY;
    // the apartment building (with Sam's window)
    rect(40, 30, 140, G - 30, '#b86f50');
    for (let y = 34; y < G; y += 6) rect(40, y, 140, 1, '#a05a40');
    rect(36, 26, 148, 6, '#733e39');
    for (let fy = 44; fy < G - 20; fy += 34) for (let fx = 56; fx < 170; fx += 30) { rect(fx, fy, 16, 18, '#262b44'); rect(fx + 1, fy + 1, 14, 16, '#9fe8f5'); rect(fx + 8, fy + 1, 1, 16, '#e8eef7'); }
    rect(98, G - 30, 24, 30, '#5a3a2e'); text('APTS', 110, G - 40, '#ffffff', { font: F3, align: 'center' });
    // city
    for (let x = 220; x < 1100; x += 70 + Math.floor(r() * 40)) {
      const h = 50 + r() * 70, w = 40 + r() * 20, col = pick(['#5a6988', '#3a4466', '#b55088', '#124e89']);
      rect(x, G - h, w, h, col);
      for (let wy = G - h + 6; wy < G - 10; wy += 10) for (let wx = x + 5; wx < x + w - 6; wx += 9) rect(wx, wy, 5, 6, r() < 0.4 ? '#fee761' : '#262b44');
      if (r() < 0.5) { rect(x + 4, G - h - 8, 2, 8, '#8b9bb4'); }
    }
    for (let x = 250; x < 1100; x += 110) { rect(x, G - 34, 2, 34, '#262b44'); rect(x - 4, G - 34, 8, 2, '#262b44'); px(x - 4, G - 32, '#fee761'); px(x + 3, G - 32, '#fee761'); }
    // countryside: fence, trees, barn
    for (let x = 1160; x < 2200; x += 8) { rect(x, G - 10, 2, 10, '#c28569'); if (x % 16 === 0) rect(x, G - 8, 8, 1, '#c28569'); }
    for (let x = 1200; x < 2200; x += 90 + Math.floor(r() * 60)) { rect(x, G - 24, 4, 24, '#733e39'); disc(x + 2, G - 30, 12, '#265c42'); disc(x - 2, G - 34, 8, '#3e8948'); }
    rect(1560, G - 44, 50, 44, '#a22633'); for (let i = 0; i < 26; i++) rect(1560 + 25 - i, G - 44 - i * 0.6, i * 2, 1, '#e43b44');
    rect(1578, G - 24, 14, 24, '#3e2731'); line(1578, G - 24, 1592, G, '#ffffff'); line(1592, G - 24, 1578, G, '#ffffff');
    text('FARM', 1585, G - 38, '#ffffff', { font: F3, align: 'center' });
    // beach: palm trees, umbrellas, a pier
    for (let x = 2300; x < 3000; x += 110 + Math.floor(r() * 40)) {
      for (let i = 0; i < 40; i++) rect(x + Math.round(Math.sin(i * 0.05) * 6), G - i, 3, 1, '#b86f50');
      const tx = x + Math.round(Math.sin(2) * 6);
      for (const a of [-2.6, -2, -1.2, -0.5]) for (let i = 0; i < 14; i++) px(tx + Math.cos(a) * i, G - 40 + Math.sin(a) * i * 0.5 + i * 0.3, '#3e8948');
    }
    for (let x = 2360; x < 3000; x += 150) { rect(x, G - 22, 1, 22, '#ffffff'); for (let i = -10; i <= 10; i++) rect(x + i, G - 24 + Math.abs(i) * 0.3, 1, 3, Math.floor((i + 10) / 4) % 2 ? '#e43b44' : '#ffffff'); }
    rect(2780, G - 4, 120, 3, '#733e39');
    // army base: walls, watchtowers, hangars
    rect(3120, G - 30, 8, 30, '#5a6988'); rect(3116, G - 34, 16, 4, '#3a4466');
    for (let x = 3140; x < ROBOT_W; x += 10) { rect(x, G - 18, 1, 18, '#8b9bb4'); }
    rect(3140, G - 18, ROBOT_W - 3140, 1, '#8b9bb4'); rect(3140, G - 10, ROBOT_W - 3140, 1, '#8b9bb4');
    for (const x of [3300, 3700, 4150]) { rect(x, G - 60, 4, 60, '#3a4466'); rect(x + 18, G - 60, 4, 60, '#3a4466'); rect(x - 4, G - 70, 30, 10, '#5a6988'); }
    for (const x of [3450, 3850]) { ellipse(x, G, 50, 34, '#3a4466'); ellipse(x, G, 46, 30, '#5a6988'); rect(x - 50, G, 100, 10, '#733e39'); text('HANGAR', x, G - 20, '#e8eef7', { font: F3, align: 'center' }); }
    text('KEEP OUT', 3180, G - 30, '#fee761', { font: F3 });
    // ground per zone
    for (let x = 0; x < ROBOT_W; x += 4) {
      const z = this.zoneAt(x);
      const top = ['#8b9bb4', '#63c74d', '#fee761', '#733e39'][z], mid = ['#3a4466', '#3e8948', '#e4a672', '#5a3a2e'][z];
      rect(x, G, 4, H - G, mid);
      rect(x, G, 4, 3, top);
      if (z === 0 && x % 24 < 12) rect(x, G + 10, 4, 2, '#fee761');
      if (z === 2 && x > 2300 && x < 3000 && (x % 40) < 4) rect(x, G + 6, 2, 1, '#feae34');
    }
    setTarget(prev);
    return c;
  }

  /* -------------------------------------------------------- update */
  update(dt, active) {
    this.t += dt;
    this.parts.update(dt);
    this.floaters.update(dt);
    if (this.banner) { this.banner.t -= dt; this.banner.age = (this.banner.age || 0) + dt; if (this.banner.t <= 0) this.banner = null; }
    if (this.intro) { this.updateIntro(dt, active); return; }
    this.elapsed += dt;
    if (this.dead) {
      this.dead.t += dt;
      if (this.dead.t > 0.3 && this.dead.t < 2 && Math.random() < 0.3) this.boom(this.p.x + rnd(-14, 14), this.p.y - rnd(0, 40), 10);
      if (this.dead.t > 3.2 || (this.dead.t > 1 && active && (hit('ok') || Input.mhit))) this.leave();
      return;
    }
    if (!active) return;
    if (hit('back') || touchPauseHit(W - 17, 4)) { this.leave(); return; }
    this.updatePlayer(dt);
    this.updateArmy(dt);
    this.updateEnemies(dt);
    this.updateShots(dt);
    this.updateCrates(dt);
    this.updateWorld(dt);
    if (this.leaving) return;
    this.camX = clamp(lerp(this.camX, this.p.x - W * 0.4 + this.p.face * 20, 1 - Math.pow(0.02, dt)), 0, this.worldW - W);
  }
  updateWorld(dt) {
    this.updatePeople(dt);
    // walk onto the end of the pier and press down to dive back into the sea
    const p = this.p;
    if (this.canDive() && (hit('down') || this.touchButtons().stomp)) { this.dive(); return; }
    // zone banners
    const z = this.zoneAt(this.p.x);
    if (z !== this.zone) {
      this.zone = z;
      this.banner = { title: ROBOT_ZONES[z].name, sub: ['STOMP STOMP STOMP.', 'MOO? (THE COWS ARE NOT IMPRESSED.)', 'THE SEA! WALK TO THE END OF THE PIER TO DIVE IN.', 'THE ARMY IS WAITING. THEY BROUGHT A MEGA TANK.'][z], t: 2.6, style: z === 3 ? 'red' : 'aqua' };
    }
  }
  canDive() { const p = this.p; return p.ground && !this.won && p.x > DIVE_X - 30 && p.x < DIVE_X + 40; }
  dive() {
    if (this.leaving) return;
    this.leaving = true;
    Sound.sfx('splash');
    Game.go(() => new RobotSeaScene(this), { color: '#0099db' });
  }
  // coming back up from the sea
  surface(sea) {
    const p = this.p;
    this.leaving = false;
    p.x = DIVE_X; p.y = ROBOT_GY; p.vx = 0; p.vy = 0; p.ground = true; p.face = -1;
    p.hp = sea.p.hp; p.fuel = 100;
    this.kills = sea.kills;
    this.elapsed += sea.elapsed;
    this.shots = [];
    this.camX = clamp(p.x - W * 0.6, 0, this.worldW - W);
    for (const s of this.army) { s.x = p.x; s.y = p.y - 40; }
    this.banner = { title: 'BACK ON LAND', sub: 'YOUR ROBOT IS DRIPPING EVERYWHERE.', t: 2.4, style: 'aqua' };
    Game.go(() => this, { color: '#0099db' });
  }
  updateIntro(dt, active) {
    const it = this.intro;
    it.t += dt;
    if (it.t > 1.4 && !it.broke) {
      it.broke = true;
      Sound.sfx('thunder');
      Game.shake(5, 0.6);
      for (let i = 0; i < 40; i++) this.parts.add({ x: 110 + rnd(-12, 12), y: 76 + rnd(-10, 10), vx: rnd(-40, 160), vy: rnd(-120, 10), g: 400, life: 1.6, size: 2, c: pick(['#b86f50', '#a05a40', '#9fe8f5', '#ffffff']) });
    }
    if (it.broke) {
      const p = this.p;
      p.vy += 500 * dt; p.y += p.vy * dt; p.x += 30 * dt;
      if (p.y >= ROBOT_GY) { if (!p.ground) { Sound.sfx('stomp'); Game.shake(4, 0.4); this.dust(p.x, 20); } p.y = ROBOT_GY; p.vy = 0; p.ground = true; }
    }
    if (it.t > 3.4 || (active && it.t > 0.5 && (hit('ok') || hit('back') || Input.mhit))) {
      if (!it.broke) it.broke = true;
      this.p.y = ROBOT_GY; this.p.vy = 0; this.p.ground = true; this.p.x = Math.max(this.p.x, 140);
      this.intro = null;
      this.banner = { title: 'ROBOT ONLINE!', sub: 'LASERS: CHARGED. MISSILES: READY. FISH: IN CHARGE.', t: 2.8, style: 'gold' };
      this.zone = 0;
      Input.hits.clear();
    }
  }

  updatePlayer(dt) {
    const p = this.p, tb = this.touchButtons();
    let ix = 0;
    if (held('left')) ix -= 1;
    if (held('right')) ix += 1;
    if (tb.left) ix = -1;
    if (tb.right) ix = 1;
    const ph = this.phys;
    p.net = Math.max(0, (p.net || 0) - dt);
    p.vx = approach(p.vx, ix * ph.walk * (p.net > 0 ? 0.35 : 1), 500 * dt);
    if (ix) p.face = ix;
    // jump jets: hold up to fly while there is fuel
    const jets = held('up') || tb.jets;
    p.jet = false;
    if (jets && p.fuel > 0) {
      if (p.ground) { p.vy = -150; p.ground = false; }
      p.vy = Math.max(ph.up, p.vy - ph.jet * dt);
      p.fuel = Math.max(0, p.fuel - ph.fuel * dt);
      p.jet = true;
      if (Math.random() < 0.7) this.parts.add(this.jetParticle(p));
      if (Math.floor(this.t * 20) % 3 === 0) Sound.noise(0.05, { vol: 0.04, freq: 700 });
    } else if (p.ground) p.fuel = Math.min(100, p.fuel + 45 * dt);
    // stomp: press down in the air
    if (!p.ground && !p.stomp && (hit('down') || tb.stomp) && p.y < ROBOT_GY - 24) { p.stomp = true; p.vy = 420; Sound.tone(300, 0.25, { type: 'square', vol: 0.08, slide: 0.3 }); }
    p.vy = Math.min(p.stomp ? 9999 : ph.fall, p.vy + ph.grav * dt);
    p.x = clamp(p.x + p.vx * dt, 20, this.worldW - 20);
    p.y += p.vy * dt;
    if (p.y < ph.top) { p.y = ph.top; p.vy = Math.max(0, p.vy); }
    if (p.y >= ROBOT_GY) {
      if (!p.ground) {
        const hard = p.stomp || p.vy > 260;
        Sound.sfx('stomp');
        this.dust(p.x, hard ? 24 : 8);
        if (hard) this.shockwave(p.x);
      }
      p.y = ROBOT_GY; p.vy = 0; p.ground = true; p.stomp = false;
    } else p.ground = false;
    p.anim += dt * (p.ground && Math.abs(p.vx) > 5 ? 7 : 0);
    if (p.ground && Math.abs(p.vx) > 5 && Math.floor(p.anim) !== Math.floor(p.anim - dt * 7) && Math.floor(p.anim) % 2 === 0) { Sound.tone(70, 0.08, { type: 'triangle', vol: 0.1 }); if (!REDUCED_MOTION) Game.shake(1, 0.08); }
    p.inv = Math.max(0, p.inv - dt);
    // weapons
    this.fireCD -= dt;
    this.missileCD = Math.max(0, this.missileCD - dt);
    const gun = this.gunPos();
    const mouseFire = Input.mdown && !Input.touchSeen && Input.my < H - 34;
    let target = null;
    if (mouseFire) target = { x: Input.mx + this.camX, y: Input.my };
    else { const e = this.nearestEnemy(gun.x, gun.y, 240); if (e) target = { x: e.x, y: e.y - e.h / 2 }; }
    if (target) p.aim = Math.atan2(target.y - gun.y, target.x - gun.x);
    else p.aim = p.face > 0 ? 0 : Math.PI;
    if (target && !mouseFire) p.face = target.x < p.x ? -1 : 1;
    if ((held('dash') || keyHit('KeyZ') || Input.keys.has('KeyZ') || Input.keys.has('KeyJ') || mouseFire || tb.fire) && this.fireCD <= 0) {
      this.fireCD = 0.11;
      const a = p.aim + rnd(-0.03, 0.03);
      this.shots.push({ x: gun.x, y: gun.y, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420, life: 0.7, dmg: 1, mine: true, kind: 'laser' });
      Sound.tone(1100, 0.05, { type: 'square', vol: 0.03, slide: 0.5 });
    }
    if ((keyHit('KeyX') || keyHit('KeyE') || keyHit('KeyK') || tb.missile) && this.missileCD <= 0) {
      this.missileCD = 2.2;
      for (let i = 0; i < 3; i++) this.shots.push({ x: p.x - p.face * 6, y: p.y - 46, vx: p.face * 30 + (i - 1) * 40, vy: -120 - i * 20, life: 3.5, dmg: 5, mine: true, kind: 'missile', target: null });
      Sound.noise(0.4, { vol: 0.15, freq: 1200, slide: 0.3 });
      this.floaters.add('MISSILES!', p.x, p.y - 60, '#fee761');
    }
  }
  jetParticle(p) { return { x: p.x + rnd(-8, 8), y: p.y - 4, vx: rnd(-10, 10), vy: rnd(60, 120), life: 0.35, size: 2, c: pick(['#fee761', '#f77622', '#e43b44']) }; }
  gunPos() { const p = this.p; return { x: p.x + p.face * 14, y: p.y - 30 }; }
  nearestEnemy(x, y, range) {
    let best = null, bd = range;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const d = dist(x, y, e.x, e.y - e.h / 2);
      if (d < bd && e.x > this.camX - 10 && e.x < this.camX + W + 10) { bd = d; best = e; }
    }
    return best;
  }
  shockwave(x) {
    Game.shake(6, 0.5);
    this.parts.add({ type: 'ringfx', x, y: ROBOT_GY - 2, size: 4, grow: 50, life: 0.4, c: '#fee761' });
    for (const e of this.enemies) if (e.hp > 0 && e.type !== 'heli' && Math.abs(e.x - x) < 56 && e.y > ROBOT_GY - 20) this.damage(e, e.type === 'boss' ? 6 : 4);
    for (const c of this.cars) if (!c.broken && Math.abs(c.x - x) < 40) this.smashCar(c);
  }
  smashCar(c) {
    c.broken = true;
    this.boom(c.x, ROBOT_GY - 6, 10);
    this.reward(4, c.x, ROBOT_GY - 20, 'CRUNCH!');
  }
  dust(x, n) {
    const col = ['#c0cbdc', '#c0cbdc', '#e4a672', '#8b9bb4'][this.zoneAt(x)];
    for (let i = 0; i < n; i++) this.parts.add({ x: x + rnd(-14, 14), y: ROBOT_GY - 1, vx: rnd(-70, 70), vy: rnd(-40, -5), drag: 3, life: 0.6, size: 2, c: col });
  }
  boom(x, y, n = 18) {
    for (let i = 0; i < n; i++) this.parts.add({ type: i % 3 ? 'px' : 'spark', x, y, vx: rnd(-90, 90), vy: rnd(-110, 30), g: 200, drag: 1.5, life: rnd(0.4, 0.9), size: 2, c: pick(['#fee761', '#f77622', '#e43b44', '#ffffff']) });
    this.parts.add({ type: 'ringfx', x, y, size: 2, grow: n, life: 0.3, c: '#fee761' });
    Sound.noise(0.35, { vol: 0.2, freq: 500, slide: 0.3 });
  }
  reward(mult, x, y, label) {
    const v = Math.max(10, this.bowl.passive() * mult);
    this.bowl.addIQ(v);
    this.floaters.add((label ? label + ' ' : '') + '+' + fmt(v) + ' IQ', x, y, '#b4f08c', { font: F5 });
  }
  hurt(n) {
    const p = this.p;
    if (p.inv > 0 || this.dead || this.won) return;
    p.hp -= n;
    p.inv = 0.5;
    Sound.sfx('hurt');
    Game.shake(3, 0.25);
    if (p.hp <= 0) {
      p.hp = 0;
      this.dead = { t: 0 };
      this.boom(p.x, p.y - 30, 30);
      this.banner = { title: 'SYSTEM FAILURE', sub: this.deathText(), t: 4, style: 'red' };
    }
  }

  updateArmy(dt) {
    const p = this.p;
    for (const s of this.army) {
      const tx = p.x + s.ox * p.face, ty = p.y + s.oy + Math.sin(this.t * 3 + s.i) * 3;
      s.x = lerp(s.x, tx, 1 - Math.pow(0.02, dt));
      s.y = lerp(s.y, ty, 1 - Math.pow(0.02, dt));
      s.cd -= dt;
      const e = this.nearestEnemy(s.x, s.y, 200);
      s.face = e ? (e.x < s.x ? -1 : 1) : p.face;
      if (e && s.cd <= 0) {
        s.cd = 0.9 + Math.random() * 0.4;
        const a = Math.atan2(e.y - e.h / 2 - s.y, e.x - s.x);
        this.shots.push({ x: s.x, y: s.y, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, life: 1, dmg: 1, mine: true, kind: 'bubble' });
      }
    }
  }

  updateEnemies(dt) {
    const p = this.p;
    // spawn the next enemies as they come into view
    while (this.spawns.length && this.spawns[0].x < this.camX + W + 40) {
      const s = this.spawns.shift();
      if (s.type === 'boss' && this.b.robotBoss) continue;
      this.spawnEnemy(s.type, s.x, s.y);
    }
    // a trickle of drones and helicopters chases you
    this.trickle -= dt;
    if (this.trickle <= 0 && !this.won) {
      this.trickle = rnd(4, 7) - this.zoneAt(p.x) * 0.8;
      if (this.enemies.filter(e => e.type !== 'boss').length < 4) {
        const side = Math.random() < 0.7 ? 1 : -1;
        this.spawnEnemy(pick(this.trickleTypes()), clamp(this.camX + (side > 0 ? W + 30 : -30), 0, this.worldW), rnd(this.skyTop || 40, 90));
      }
    }
    for (const e of this.enemies) {
      e.t += dt;
      e.flash = Math.max(0, e.flash - dt);
      if (e.hp <= 0) continue;
      const dx = p.x - e.x, ax = Math.abs(dx);
      e.face = dx < 0 ? -1 : 1;
      if (e.type === 'tank') {
        if (ax > 110) e.x += Math.sign(dx) * 26 * dt;
        e.cd -= dt;
        if (e.cd <= 0 && ax < 260) { e.cd = rnd(2.2, 3.2); this.shell(e.x + e.face * 14, e.y - 12, 9); }
      } else if (e.type === 'heli') {
        const tx = p.x - e.face * 90, ty = clamp(p.y - 80, 40, 90);
        e.x += clamp(tx - e.x, -60, 60) * dt; e.y += clamp(ty - e.y + Math.sin(e.t * 2) * 10, -40, 40) * dt;
        e.cd -= dt;
        if (e.cd <= 0 && ax < 220) {
          e.cd = rnd(1.6, 2.4);
          const a = Math.atan2(p.y - 30 - e.y, p.x - e.x);
          for (let i = 0; i < 2; i++) this.shots.push({ x: e.x, y: e.y + 3, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, life: 2.5 + i * 0.1, dmg: 5, delay: i * 0.15, kind: 'bullet' });
          Sound.tone(500, 0.05, { type: 'square', vol: 0.03 });
        }
      } else if (e.type === 'drone') {
        const a = Math.atan2(p.y - 30 - e.y, p.x - e.x), sp = e.t > 1 ? 85 : 30;
        e.x += Math.cos(a) * sp * dt; e.y += Math.sin(a) * sp * dt + Math.sin(e.t * 6) * 0.3;
        if (dist(e.x, e.y, p.x, p.y - 26) < 18) { e.hp = 0; this.boom(e.x, e.y, 14); this.hurt(10); }
      } else if (e.type === 'boss') {
        if (ax > 150) e.x += Math.sign(dx) * 14 * dt;
        e.cd -= dt;
        if (e.cd <= 0) {
          e.cd = e.hp < 70 ? 1.6 : 2.4;
          for (let i = 0; i < 3; i++) this.shell(e.x + e.face * 30, e.y - 36, 14, (i - 1) * 24, i * 0.18);
          Sound.sfx('thunder');
        }
        e.cd2 = (e.cd2 || 3) - dt;
        if (e.cd2 <= 0) { e.cd2 = 5; this.spawnEnemy('drone', e.x, e.y - 50); this.spawnEnemy('drone', e.x, e.y - 40); }
      }
    }
    this.enemies = this.enemies.filter(e => e.hp > 0 && e.x > this.camX - 400 && e.x < this.camX + W + 400 || e.big && e.hp > 0);
  }
  trickleTypes() { return ['drone', 'heli']; }
  spawnEnemy(type, x, y) {
    const st = ENEMY_STATS[type];
    const ground = type === 'tank' || type === 'boss';
    this.enemies.push({ type, x, y: ground ? ROBOT_GY : y, w: st.w, h: st.h, hp: st.hp, max: st.hp, t: rnd(0, 1), cd: rnd(1, 2.5), flash: 0, face: -1, big: type === 'boss' || type === 'boat' });
    if (type === 'boss') { this.banner = { title: 'MEGA TANK!', sub: 'THE ARMY\'S BIGGEST WEAPON. STOMP IT. LASER IT. MISSILE IT.', t: 3.2, style: 'red' }; Sound.sfx('shark'); }
  }
  // a lobbed tank shell that lands near the robot
  shell(x, y, dmg, spread = 0, delay = 0) {
    const p = this.p, T = 1.1, g = 220;
    const tx = p.x + spread + p.vx * 0.5, ty = p.y - 20;
    this.shots.push({ x, y, vx: (tx - x) / T, vy: (ty - y - 0.5 * g * T * T) / T, g, life: 3, dmg, kind: 'shell', delay });
    Sound.tone(120, 0.15, { type: 'square', vol: 0.08, slide: 0.5, delay });
  }
  damage(e, n) {
    if (e.hp <= 0) return;
    e.hp -= n;
    e.flash = 0.08;
    if (e.hp > 0) return;
    const st = ENEMY_STATS[e.type];
    this.kills++;
    this.boom(e.x, e.y - e.h / 2, e.type === 'boss' ? 40 : 20);
    this.reward(st.iq, e.x, e.y - e.h - 6, e.type === 'boss' ? null : st.name);
    if (e.type !== 'drone' && Math.random() < 0.25) this.crates.push({ x: e.x, y: e.y - e.h, vy: -60 });
    if (e.type === 'boss') this.winBoss(e);
  }
  winBoss(e) {
    this.won = true;
    this.b.robotBoss = true;
    saveGame();
    Game.shake(8, 1.2);
    for (let i = 0; i < 6; i++) setTimeout(() => this.boom(e.x + rnd(-40, 40), e.y - rnd(0, 40), 24), i * 180);
    Sound.sfx('fanfare');
    this.enemies.forEach(o => { if (o !== e) { o.hp = 0; this.boom(o.x, o.y - o.h / 2, 10); } });
    this.banner = { title: 'THE ARMY GIVES UP!', sub: 'GENERALS SALUTE YOUR BOWL. ESC TO STOMP HOME.', t: 6, style: 'gold' };
  }

  updateShots(dt) {
    const p = this.p;
    for (const s of this.shots) {
      if (s.delay > 0) { s.delay -= dt; continue; }
      s.life -= dt;
      if (s.kind === 'missile') {
        if (!s.target || s.target.hp <= 0) s.target = this.nearestEnemy(s.x, s.y, 400);
        if (s.target && s.life < 3.3) {
          const a = Math.atan2(s.target.y - s.target.h / 2 - s.y, s.target.x - s.x);
          s.vx = lerp(s.vx, Math.cos(a) * 260, 1 - Math.pow(0.02, dt));
          s.vy = lerp(s.vy, Math.sin(a) * 260, 1 - Math.pow(0.02, dt));
        } else s.vy += 80 * dt;
        if (Math.random() < 0.6) this.parts.add({ x: s.x, y: s.y, vx: rnd(-8, 8), vy: rnd(-8, 8), life: 0.4, c: pick(['#c0cbdc', '#8b9bb4', '#f77622']) });
      }
      if (s.kind === 'torpedo' && s.life > 1) {
        const a = Math.atan2(p.y - 28 - s.y, p.x - s.x), sp = Math.hypot(s.vx, s.vy);
        s.vx = lerp(s.vx, Math.cos(a) * sp, 1 - Math.pow(0.4, dt));
        s.vy = lerp(s.vy, Math.sin(a) * sp, 1 - Math.pow(0.4, dt));
        if (Math.random() < 0.4) this.parts.add({ type: 'bubble', x: s.x, y: s.y, vy: -15, life: 0.6, c: '#c8f4ff' });
      }
      if (s.g) s.vy += s.g * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.y >= ROBOT_GY) {
        s.life = 0;
        if (s.kind === 'shell' || s.kind === 'missile') this.boom(s.x, ROBOT_GY - 2, 10);
        if (s.kind === 'shell' && Math.abs(s.x - p.x) < 20 && p.y > ROBOT_GY - 20) this.hurt(s.dmg);
        continue;
      }
      if (s.mine) {
        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          if (Math.abs(s.x - e.x) < e.w / 2 + 2 && s.y > e.y - e.h - 2 && s.y < e.y + 2) {
            s.life = 0;
            if (s.kind === 'missile') {
              this.boom(s.x, s.y, 14);
              for (const o of this.enemies) if (dist(o.x, o.y - o.h / 2, s.x, s.y) < 26 + o.w / 2) this.damage(o, s.dmg);
            } else {
              this.damage(e, s.dmg);
              this.parts.add({ type: 'spark', x: s.x, y: s.y, vx: rnd(-30, 30), vy: rnd(-30, 30), life: 0.2, c: '#fee761' });
            }
            break;
          }
        }
      } else if (Math.abs(s.x - p.x) < 13 && s.y > p.y - 48 && s.y < p.y) {
        s.life = 0;
        this.hurt(s.dmg);
        if (s.kind === 'netshot') { p.net = 2.5; this.floaters.add('TANGLED IN A NET!', p.x, p.y - 60, '#ff8f7a', { font: F5 }); Sound.sfx('caught'); }
        else this.boom(s.x, s.y, 6);
      }
    }
    this.shots = this.shots.filter(s => s.life > 0 && s.x > this.camX - 60 && s.x < this.camX + W + 60);
  }

  updatePeople(dt) {
    const p = this.p;
    for (const h of this.people) {
      const d = h.x - p.x;
      if (this.bowing) { h.bow = Math.abs(d) < 120; continue; }
      if (Math.abs(d) < 110) { h.flee = 2; h.dir = d < 0 ? -1 : 1; }
      if (h.flee > 0) {
        h.flee -= dt;
        h.x += h.dir * h.sp * dt;
        if (Math.abs(d) > 190) h.gone = true;
        if (Math.random() < 0.003) this.floaters.add(pick(['AAAH!', 'A FISH ROBOT!', 'RUN!', 'MY CAR!']), h.x, ROBOT_GY - 16, '#ffffff');
      }
    }
    this.people = this.people.filter(h => !h.gone);
  }
  updateCrates(dt) {
    const p = this.p;
    for (const c of this.crates) {
      if (c.y < ROBOT_GY) { c.vy += 300 * dt; c.y = Math.min(ROBOT_GY, c.y + c.vy * dt); }
      if (!c.taken && Math.abs(c.x - p.x) < 16 && c.y > p.y - 50 && c.y <= p.y + 4) {
        c.taken = true;
        p.hp = Math.min(100, p.hp + 35);
        Sound.sfx('upgrade');
        this.floaters.add('REPAIRED! +35 HP', c.x, c.y - 20, '#63c74d', { font: F5 });
      }
    }
    this.crates = this.crates.filter(c => !c.taken);
  }

  leave() {
    if (this.leaving) return;
    this.leaving = true;
    this.bowl.onExploreDone(this.elapsed, 0);
    Game.go(() => this.bowl);
  }
  touchButtons() {
    if (!Input.touchSeen) return {};
    const out = {};
    for (const pt of Input.pointers.values()) {
      if (pt.y < H - 30) continue;
      if (pt.x < 30) out.left = true;
      else if (pt.x < 60) out.right = true;
      else if (pt.x > W - 32) out.fire = true;
      else if (pt.x > W - 64) out.jets = true;
    }
    out.missile = clicked(W - 96, H - 28, 30, 24);
    out.stomp = clicked(64, H - 28, 30, 24);
    return out;
  }

  /* ---------------------------------------------------------- draw */
  draw() {
    const [sx, sy] = Game.shakeOffset();
    gfx.save();
    gfx.translate(sx, sy);
    const cx = Math.round(this.camX), t = this.t, p = this.p;
    const fx = Math.round(cx * 0.35);
    this.drawSky(cx + W / 2);
    gfx.drawImage(this.far, fx, 0, W, H, 0, 0, W, H);
    gfx.drawImage(this.near, cx, 0, W, H, 0, 0, W, H);
    this.drawDecor(cx, t);
    for (const c of this.crates) this.drawCrate(c.x - cx, c.y);
    for (const e of this.enemies) this.drawEnemy(e, cx, t);
    this.drawShots(cx);
    // the robot and its fish army
    const hidden = this.intro && !this.intro.broke;
    if (hidden) { /* still a little bowl in the window */ }
    else if (!this.dead || this.dead.t < 0.6) {
      if (!(p.inv > 0 && Math.floor(t * 20) % 2)) this.drawRobot(Math.round(p.x - cx), Math.round(p.y), t);
    } else this.drawEject(t);
    if (!hidden) for (const s of this.army) this.drawSoldier(Math.round(s.x - cx), Math.round(s.y), s.face, t);
    this.parts.draw(cx, 0);
    this.floaters.draw(cx, 0);
    this.drawFront(cx, t);
    gfx.restore();
    if (this.intro) this.drawIntro(t);
    else this.drawHUD();
    if (this.banner) this.drawBanner();
  }
  drawFront() {}
  drawDecor(cx, t) {
    // sea waves at the beach
    if (cx + W > 2250 && cx < 3100) for (let x = 0; x < W; x += 3) { const wx = x + cx; if (wx > 2250 && wx < 3100) px(x, 118 + Math.round(Math.sin(wx * 0.1 + t * 3)), '#ffffff'); }
    // the hole Sam's window became
    if (!this.intro || this.intro.broke) { const hx = 110 - cx; if (hx > -40 && hx < W + 40) { ellipse(hx, 77, 16, 15, '#262b44'); ellipse(hx, 77, 12, 11, '#181425'); } }
    for (const c of this.cars) this.drawCar(c, c.x - cx, t);
    for (const c of this.cows) this.drawCow(c.x - cx, c.face, t);
    for (const h of this.people) if (h.x - cx > -10 && h.x - cx < W + 10) this.drawPerson(Math.round(h.x - cx), ROBOT_GY + 2, h, t);
    // dive sign at the end of the pier
    const dx = DIVE_X + 22 - cx;
    if (dx > -20 && dx < W + 20) {
      rect(dx, ROBOT_GY - 22, 2, 22, '#733e39'); rect(dx - 10, ROBOT_GY - 30, 22, 9, '#fee761'); text('DIVE', dx + 1, ROBOT_GY - 28, '#a22633', { font: F3, align: 'center' });
    }
  }
  drawShots(cx) {
    for (const s of this.shots) {
      if (s.delay > 0) continue;
      const x = Math.round(s.x - cx), y = Math.round(s.y);
      if (s.kind === 'laser') { line(x, y, Math.round(x - s.vx * 0.02), Math.round(y - s.vy * 0.02), '#2ce8f5'); px(x, y, '#ffffff'); }
      else if (s.kind === 'bubble') { ring(x, y, 2, '#9ff3fa'); px(x - 1, y - 1, '#ffffff'); }
      else if (s.kind === 'missile') { const a = Math.atan2(s.vy, s.vx); line(x, y, Math.round(x - Math.cos(a) * 5), Math.round(y - Math.sin(a) * 5), '#e8eef7'); px(x, y, '#e43b44'); }
      else if (s.kind === 'shell') { disc(x, y, 2, '#262b44'); px(x, y - 1, '#8b9bb4'); }
      else if (s.kind === 'torpedo') { const a = Math.atan2(s.vy, s.vx); thickLine(x, y, Math.round(x - Math.cos(a) * 6), Math.round(y - Math.sin(a) * 6), 1, '#3a4466'); px(x, y, '#e43b44'); if (Math.floor(this.t * 20) % 2) px(Math.round(x - Math.cos(a) * 8), Math.round(y - Math.sin(a) * 8), '#c8f4ff'); }
      else if (s.kind === 'netshot') { for (let i = -3; i <= 3; i += 2) { line(x + i, y - 3, x + i, y + 3, '#c0cbdc'); line(x - 3, y + i, x + 3, y + i, '#c0cbdc'); } }
      else { rect(x - 1, y - 1, 2, 2, '#fee761'); }
    }
  }

  deathText() { return 'THE BOWL EJECTS AND PARACHUTES HOME. (THE ROBOT WILL BE FIXED BY TOMORROW.)'; }
  // the sky blends from zone to zone around the middle of the screen
  drawSky(wx) {
    const z = this.zoneAt(wx), zn = ROBOT_ZONES[z], nx = ROBOT_ZONES[z + 1];
    let top = zn.sky[0], bot = zn.sky[1];
    if (nx && wx > nx.x - 300) { const k = Math.round(clamp((wx - (nx.x - 300)) / 300, 0, 1) * 8) / 8; top = mix(top, nx.sky[0], k); bot = mix(bot, nx.sky[1], k); }
    for (let y = 0; y < ROBOT_GY; y += 8) rect(0, y, W, 8, mix(top, bot, y / ROBOT_GY));
  }
  drawRobot(x, y, t) {
    const p = this.p;
    const step = p.ground && Math.abs(p.vx) > 5 ? Math.sin(p.anim * Math.PI) : 0;
    const l1 = Math.round(Math.max(0, step) * 3), l2 = Math.round(Math.max(0, -step) * 3);
    // legs
    for (const [s, l] of [[-1, l1], [1, l2]]) {
      const lx = x + s * 6;
      rect(lx - 3, y - 16, 6, 16 - l, '#3a4466');
      rect(lx - 2, y - 16, 4, 16 - l, '#5a6988');
      rect(lx - 2, y - 9 - l, 4, 2, '#8b9bb4');
      rect(lx - 5, y - 3 - l, 10, 3, '#262b44');
    }
    // jets
    if (p.jet) for (const s of [-1, 1]) { rect(x + s * 6 - 1, y - l1 + 1, 3, 3 + Math.floor(t * 30) % 3, Math.floor(t * 20) % 2 ? '#fee761' : '#f77622'); }
    // body
    const by = y - 36;
    rect(x - 12, by, 24, 21, '#3a4466');
    rect(x - 11, by + 1, 22, 19, '#5a6988');
    rect(x - 11, by + 1, 22, 2, '#8b9bb4');
    disc(x, by + 10, 4, '#be4a2f');
    disc(x, by + 10, 2, Math.floor(t * 4) % 2 ? '#fee761' : '#feae34');
    px(x - 9, by + 4, '#c0cbdc'); px(x + 9, by + 4, '#c0cbdc'); px(x - 9, by + 17, '#c0cbdc'); px(x + 9, by + 17, '#c0cbdc');
    // missile pod on the back
    const bx = x - p.face * 13;
    rect(bx - 3, by - 2, 6, 10, '#262b44'); for (let i = 0; i < 3; i++) px(bx - 2 + i * 2, by - 1, this.missileCD > 0 ? '#5a6988' : '#e43b44');
    // fish bowl head
    const hy = by - 9;
    rect(x - 5, by - 2, 10, 3, '#3a4466');
    for (let yy = hy - 6; yy <= hy + 8; yy++) { const dy = yy - hy, hw = Math.floor(Math.sqrt(Math.max(0, 100 - dy * dy))); if (hw > 0) rect(x - hw, yy, hw * 2 + 1, 1, yy < hy - 4 ? '#9ff3fa' : '#4fb8dc'); }
    sprC('hero1', Math.floor(t * 6) % 2, x + Math.round(Math.sin(t * 1.5) * 2), hy + 1, p.face < 0);
    if (this.bowl.owned('mind')) spr('helmet', 0, x - 4 + Math.round(Math.sin(t * 1.5) * 2), hy - 10);
    else if (this.b.items.crown) spr('crown', 0, x - 3, hy - 9);
    ring(x, hy, 10, '#c8f4ff');
    rect(x - 6, hy - 10, 13, 2, '#e8fbff');
    // laser arm: points where the robot aims
    const gun = this.gunPos(), gx = gun.x - Math.round(this.camX), gy = gun.y;
    const sxp = x + p.face * 11, syp = by + 4;
    thickLine(sxp, syp, gx, gy, 1, '#3a4466');
    const ex = gx + Math.round(Math.cos(p.aim) * 7), ey = gy + Math.round(Math.sin(p.aim) * 7);
    thickLine(gx, gy, ex, ey, 1, '#262b44');
    if (this.fireCD > 0.06) disc(ex, ey, 2, '#2ce8f5');
    // the other arm
    rect(x - p.face * 13 - 2, by + 4, 4, 12, '#3a4466'); rect(x - p.face * 13 - 3, by + 15, 6, 4, '#262b44');
  }
  drawEject(t) {
    const d = this.dead.t, x = Math.round(this.p.x - this.camX), y = Math.round(this.p.y - 50 - d * 40 + Math.max(0, d - 1) * 30);
    if (d > 0.9) { for (let i = -8; i <= 8; i++) rect(x + i, y - 18 + Math.abs(i) * 0.4, 1, 3, i % 4 < 2 ? '#e43b44' : '#ffffff'); line(x - 8, y - 15, x, y - 6, '#c0cbdc'); line(x + 8, y - 15, x, y - 6, '#c0cbdc'); }
    disc(x, y, 6, '#4fb8dc'); sprC('hero1', 0, x, y, false); ring(x, y, 6, '#c8f4ff');
  }
  drawSoldier(x, y, face, t) {
    for (let i = 0; i < 2; i++) px(x - face * 5, y + 3 + i + Math.floor(t * 10) % 2, Math.floor(t * 10) % 2 ? '#fee761' : '#f77622');
    disc(x, y, 5, '#4fb8dc'); ring(x, y, 5, '#c8f4ff');
    sprC('bluefish', Math.floor(t * 6) % 2, x, y, face < 0);
    rect(x - 3, y - 5, 6, 2, '#3e8948'); rect(x - 2, y - 6, 4, 1, '#265c42');
  }
  drawEnemy(e, cx, t) {
    const x = Math.round(e.x - cx), y = Math.round(e.y), f = e.face;
    if (x < -60 || x > W + 60) return;
    const fl = e.flash > 0;
    if (e.type === 'tank') {
      const body = fl ? '#ffffff' : '#3e8948', dark = fl ? '#ffffff' : '#265c42';
      rect(x - 13, y - 5, 26, 5, '#262b44');
      for (let i = 0; i < 5; i++) disc(x - 10 + i * 5, y - 3, 1, (i + Math.floor(t * 8)) % 2 ? '#5a6988' : '#8b9bb4');
      rect(x - 12, y - 10, 24, 5, body); rect(x - 12, y - 10, 24, 1, '#63c74d');
      rect(x - 6, y - 14, 12, 4, dark);
      const a = Math.atan2(this.p.y - 30 - (y - 12), this.p.x - e.x);
      thickLine(x, y - 12, x + Math.round(Math.cos(a) * 12), y - 12 + Math.round(Math.sin(a) * 12), 1, '#262b44');
      px(x + f * 3, y - 13, '#fee761');
    } else if (e.type === 'heli') {
      const body = fl ? '#ffffff' : '#5a6988';
      ellipse(x, y, 9, 5, body); rect(x - f * 9 - (f > 0 ? 12 : 0), y - 2, 12, 2, body);
      rect(x - f * 20 - 1, y - 5, 2, 5, body);
      ellipse(x + f * 4, y - 1, 3, 2, '#9fe8f5');
      rect(x - 6, y + 6, 12, 1, '#262b44'); px(x - 4, y + 5, '#262b44'); px(x + 4, y + 5, '#262b44');
      const rw = [14, 6, 14, 2][Math.floor(t * 30) % 4];
      rect(x - rw, y - 7, rw * 2, 1, '#262b44'); rect(x, y - 7, 1, 2, '#262b44');
      if (Math.floor(t * 4) % 2) px(x - f * 21, y - 5, '#e43b44');
    } else if (e.type === 'drone') {
      rect(x - 4, y - 1, 8, 3, fl ? '#ffffff' : '#3a4466');
      const rw = Math.floor(t * 30) % 2 ? 3 : 1;
      rect(x - 6 - rw, y - 3, rw * 2 + 1, 1, '#8b9bb4'); rect(x + 6 - rw, y - 3, rw * 2 + 1, 1, '#8b9bb4');
      px(x - 6, y - 2, '#262b44'); px(x + 6, y - 2, '#262b44');
      px(x, y + 2, Math.floor(t * 6) % 2 ? '#e43b44' : '#fee761');
    } else if (e.type === 'boss') {
      const body = fl ? '#ffffff' : '#265c42', light = fl ? '#ffffff' : '#3e8948';
      rect(x - 42, y - 12, 84, 12, '#262b44');
      for (let i = 0; i < 9; i++) disc(x - 36 + i * 9, y - 6, 3, (i + Math.floor(t * 6)) % 2 ? '#5a6988' : '#8b9bb4');
      rect(x - 40, y - 26, 80, 14, body); rect(x - 40, y - 26, 80, 2, light);
      rect(x - 22, y - 38, 44, 12, light); rect(x - 22, y - 38, 44, 2, '#63c74d');
      for (const o of [-3, 3]) thickLine(x + f * 18, y - 33 + o, x + f * 44, y - 36 + o, 1, '#262b44');
      text('MEGA', x - 12 - f * 4, y - 22, '#fee761', { font: F3 });
      rect(x - f * 10 - 1, y - 48, 2, 10, '#8b9bb4'); px(x - f * 10, y - 49, Math.floor(t * 3) % 2 ? '#e43b44' : '#fee761');
    }
    if (e.type !== 'boss' && e.hp < e.max) { rect(x - 8, y - e.h - 6, 16, 2, '#3e2731'); rect(x - 8, y - e.h - 6, Math.round(16 * e.hp / e.max), 2, '#e43b44'); }
  }
  drawCar(c, x, t) {
    if (x < -20 || x > W + 20) return;
    const y = ROBOT_GY;
    if (c.broken) { rect(x - 10, y - 3, 20, 3, '#3a4466'); rect(x - 8, y - 5, 14, 2, c.c); if (Math.floor(t * 3 + c.x) % 3 === 0) px(x + rndi(-4, 4), y - 7 - rndi(0, 4), '#8b9bb4'); return; }
    rect(x - 10, y - 7, 20, 5, c.c); rect(x - 6, y - 11, 12, 4, c.c); rect(x - 5, y - 10, 4, 3, '#9fe8f5'); rect(x + 1, y - 10, 4, 3, '#9fe8f5');
    disc(x - 6, y - 2, 2, '#181425'); disc(x + 6, y - 2, 2, '#181425');
  }
  drawCow(x, f, t) {
    if (x < -20 || x > W + 20) return;
    const y = ROBOT_GY;
    rect(x - 7, y - 10, 14, 6, '#ffffff'); rect(x - 4, y - 10, 4, 3, '#181425'); rect(x + 2, y - 7, 3, 3, '#181425');
    for (const o of [-6, -3, 3, 5]) rect(x + o, y - 4, 1, 4, '#ffffff');
    rect(x + f * 8 - 2, y - 13, 5, 5, '#ffffff'); px(x + f * 10, y - 10, '#f6a0c8'); px(x + f * 7, y - 14, '#c0cbdc');
    if (Math.floor(t * 0.5 + x * 0.01) % 5 === 0) text('MOO', x, y - 22, '#ffffff', { font: F3, align: 'center', outline: '#07060f' });
  }
  drawPerson(x, y, h, t) {
    if (h.bow) {
      rect(x - 2, y - 4, 4, 3, h.c); rect(x + 2, y - 3, 2, 2, '#e8b796'); rect(x + 2, y - 4, 2, 1, h.hair); rect(x - 3, y - 1, 3, 1, '#262b44');
      if (Math.floor(t + h.ph) % 6 === 0) text('ALL HAIL!', x, y - 14, '#fee761', { font: F3, align: 'center', outline: '#07060f' });
      return;
    }
    const f = Math.floor(t * (h.flee > 0 ? 12 : 3) + h.ph) % 2;
    rect(x - 1, y - 9, 3, 3, '#e8b796'); rect(x - 1, y - 10, 3, 1, h.hair);
    rect(x - 1, y - 6, 3, 4, h.c);
    rect(x - 1, y - 2, 1, 2 - f, '#262b44'); rect(x + 1, y - 2, 1, 1 + f, '#262b44');
    if (h.flee > 0) { px(x - 2, y - 9, '#e8b796'); px(x + 2, y - 9, '#e8b796'); }
  }
  drawCrate(x, y) {
    if (x < -10 || x > W + 10) return;
    rect(x - 6, y - 10, 12, 10, '#b86f50'); rect(x - 6, y - 10, 12, 1, '#e4a672');
    rect(x - 1, y - 8, 2, 6, '#e43b44'); rect(x - 3, y - 6, 6, 2, '#e43b44');
    if (Math.floor(this.t * 3) % 2) text('HP', x, y - 18, '#63c74d', { font: F3, align: 'center', outline: '#07060f' });
  }

  drawIntro(t) {
    const it = this.intro, cx = Math.round(this.camX);
    if (!it.broke) {
      // the bowl glows in Sam's window, then grows
      const x = 110 - cx, y = 77, k = clamp(it.t / 1.4, 0, 1);
      const r = Math.round(6 + k * 6);
      disc(x + rndi(-1, 1) * Math.round(k * 2), y, r, '#4fb8dc'); ring(x, y, r, Math.floor(t * 10) % 2 ? '#ffffff' : '#c8f4ff');
      sprC('hero1', 0, x, y, false);
      if (k > 0.5) for (let i = 0; i < 6; i++) { const a = t * 4 + i; px(x + Math.cos(a) * (r + 4), y + Math.sin(a) * (r + 4), '#fee761'); }
      text('TRANSFORMING...', W / 2, 150, '#fee761', { align: 'center', outline: '#07060f' });
    } else if (it.t < 1.6) { gfx.globalAlpha = 1 - (it.t - 1.4) * 5; rect(0, 0, W, H, '#ffffff'); gfx.globalAlpha = 1; }
    if (it.broke) drawBig('GIANT ROBOT!', W / 2, 18, 'gold');
    text(Input.touchSeen ? 'TAP TO SKIP' : 'ENTER: SKIP', W - 4, H - 10, '#c0cbdc', { font: F3, align: 'right', outline: '#07060f' });
  }
  drawBanner() {
    const bn = this.banner;
    const k = clamp(Math.min((bn.age || 0) * 4, bn.t * 3), 0, 1);
    const y = Math.round(lerp(-30, 40, easeOut(k)));
    drawBig(bn.title, W / 2, y, bn.style || 'gold');
    if (bn.sub) wrap(bn.sub, 290).forEach((l, i) => text(l, W / 2, y + 26 + i * 10, '#ffffff', { align: 'center', outline: '#07060f', accent: '#fee761' }));
  }
  drawHUD() {
    const p = this.p, b = this.b;
    panel(2, 2, 104, 30, { fill: '#141330', alpha: 0.9 });
    text('HP', 7, 7, '#ffffff', { font: F3 });
    rect(18, 7, 82, 5, '#3e2731'); rect(18, 7, Math.round(82 * p.hp / 100), 5, p.hp > 30 ? '#63c74d' : '#e43b44');
    text('JET', 7, 15, '#ffffff', { font: F3 });
    rect(22, 15, 78, 3, '#3e2731'); rect(22, 15, Math.round(78 * p.fuel / 100), 3, '#feae34');
    spr('brain', 0, 6, 21);
    text('IQ ' + fmt(b.iq), 16, 23, '#ffffff', { font: F3 });
    text(this.missileCD > 0 ? 'MSL ' + this.missileCD.toFixed(1) : 'MSL READY', 100, 23, this.missileCD > 0 ? '#8b9bb4' : '#e43b44', { font: F3, align: 'right' });
    text(Input.touchSeen ? '' : 'ESC: GO HOME', W - 4, 5, '#c0cbdc', { font: F3, align: 'right', outline: '#07060f' });
    touchPauseButton(W - 17, 4);
    text('KILLS ' + this.kills, W - 4, 13, '#fee761', { font: F3, align: 'right', outline: '#07060f' });
    this.drawProgress();
    const boss = this.enemies.find(e => e.type === 'boss' || e.type === 'boat');
    if (boss) {
      panel(70, 150, 180, 16, { fill: '#141330', alpha: 0.9 });
      text(ENEMY_STATS[boss.type].name, 76, 155, '#ff8f7a', { font: F3 });
      rect(132, 155, 112, 5, '#3e2731'); rect(132, 155, Math.round(112 * boss.hp / boss.max), 5, '#e43b44');
    } else if (this.canDive && this.canDive()) {
      const s = (Input.touchSeen ? 'STOMP: ' : '↓: ') + 'DIVE INTO THE SEA!';
      const w = textW(s) + 12;
      panel(W / 2 - w / 2, 150, w, 15, { fill: '#124e89', border: '#fee761' });
      text(s, W / 2, 154, '#ffffff', { align: 'center' });
    } else if (!Input.touchSeen && this.elapsed < 9 && !this.dead) {
      text(this.hint(), W / 2, 168, '#ffffff', { font: F3, align: 'center', outline: '#07060f' });
    }
    this.drawTouch();
  }
  hint() { return '← → WALK   ↑ JETS   ↓ STOMP   SPACE LASER   X MISSILES'; }
  drawProgress() {
    const p = this.p;
    // progress across the world
    const mx = 120, mw = 80;
    rect(mx, 8, mw, 1, '#c0cbdc');
    ROBOT_ZONES.forEach(z => rect(mx + Math.round(z.x / ROBOT_W * mw), 6, 1, 5, '#c0cbdc'));
    rect(mx + Math.round(ROBOT_BOSS_X / ROBOT_W * mw) - 1, 6, 3, 5, this.b.robotBoss ? '#63c74d' : '#e43b44');
    rect(mx + Math.round(DIVE_X / ROBOT_W * mw) - 1, 9, 3, 3, '#2ce8f5');
    rect(mx + Math.round(p.x / ROBOT_W * mw) - 1, 5, 3, 7, '#fee761');
  }
  drawTouch() {
    if (Input.touchSeen) {
      panel(2, H - 28, 26, 24, { fill: '#262b44', alpha: 0.8 }); drawArrow(15, H - 16, 'left', '#ffffff', 4);
      panel(32, H - 28, 26, 24, { fill: '#262b44', alpha: 0.8 }); drawArrow(45, H - 16, 'right', '#ffffff', 4);
      panel(64, H - 28, 30, 24, { fill: '#262b44', alpha: 0.8 }); text('STOMP', 79, H - 19, '#ffffff', { font: F3, align: 'center' });
      panel(W - 96, H - 28, 30, 24, { fill: '#a22633', alpha: 0.8 }); text('MSL', W - 81, H - 19, '#ffffff', { font: F3, align: 'center' });
      panel(W - 64, H - 28, 30, 24, { fill: '#262b44', alpha: 0.8 }); text('JETS', W - 49, H - 19, '#ffffff', { font: F3, align: 'center' });
      panel(W - 32, H - 28, 30, 24, { fill: '#124e89', alpha: 0.8 }); text('FIRE', W - 17, H - 19, '#ffffff', { font: F3, align: 'center' });
    }
  }
}

/* =====================================================================
   Back into the sea: the robot dives off the end of the pier and walks
   along the sea floor. Sharks, jellyfish, submarines... and the fishing
   boat that caught you all those years ago.
   ===================================================================== */
const RSEA_W = 2400, RSEA_SURF = 40, RSEA_HOME_X = 940, RSEA_SHIP_X = 1460, RSEA_BOAT_X = 1950;
const RSEA_CHESTS = [620, RSEA_SHIP_X + 6, 2290];

class RobotSeaScene extends RobotScene {
  constructor(land) {
    super(land.bowl);
    this.land = land;
    this.intro = null;
    this.worldW = RSEA_W;
    this.phys = { grav: 140, jet: 520, up: -90, fuel: 10, walk: 60, top: 98, fall: 80 };
    const p = this.p;
    Object.assign(p, { x: 70, y: 110, vx: 30, vy: 20, face: 1, ground: false, hp: land.p.hp, fuel: 100 });
    for (const s of this.army) { s.x = p.x; s.y = p.y - 40; }
    this.kills = land.kills;
    this.zone = 0;
    this.trickle = 6;
    this.skyTop = RSEA_SURF + 20;
    this.banner = { title: 'SPLASH!', sub: 'BACK IN THE SEA... AND THIS TIME YOU ARE THE BIGGEST FISH.', t: 3, style: 'aqua' };
    for (let i = 0; i < 30; i++) this.parts.add({ type: 'bubble', x: p.x + rnd(-20, 20), y: rnd(RSEA_SURF + 10, 120), vy: -rnd(20, 50), life: rnd(0.6, 1.4), size: rndi(1, 3), c: '#c8f4ff' });
  }
  enter() { Sound.play('sea'); Sound.sfx('splash'); }
  zoneAt() { return 2; }   // sandy floor
  setupWorld() {
    const r = mulberry32(21), b = this.b;
    this.spawns = [];
    for (let x = 360; x < RSEA_W - 120; x += 150 + Math.floor(r() * 130)) {
      this.spawns.push({ x, type: pick(['shark', 'jelly', 'jelly', 'sub']), y: 70 + Math.floor(r() * 70) });
    }
    if (!b.boatRevenge) this.spawns.push({ x: RSEA_BOAT_X, type: 'boat', y: RSEA_SURF + 4 });
    this.spawns.sort((a, c) => a.x - c.x);
    this.fish = [];
    for (let i = 0; i < 26; i++) {
      this.fish.push({ x: r() * RSEA_W, y: RSEA_SURF + 10 + r() * 100, kind: pick(['guppy', 'minnow', 'perch', 'bluefish', 'goldfish']), vx: (r() < 0.5 ? -1 : 1) * (14 + r() * 16), ph: r() * 9, scare: 0 });
    }
    if (b.seaChestDay !== b.day) { b.seaChestDay = b.day; b.seaChests = []; }
    this.chests = RSEA_CHESTS.map((x, i) => ({ x, open: (b.seaChests || []).includes(i), i }));
    this.kelp = [];
    for (let x = 100; x < RSEA_W; x += 30 + Math.floor(r() * 60)) this.kelp.push({ x, h: 20 + Math.floor(r() * 40), ph: r() * 6 });
    this.crates.push({ x: 1200, y: ROBOT_GY, vy: 0 }, { x: 2100, y: ROBOT_GY, vy: 0 });
    this.far = this.paintSeaFar();
    this.near = this.paintSeaNear();
  }
  paintSeaFar() {
    const fw = Math.ceil(RSEA_W * 0.35) + W, c = makeCanvas(fw, H), prev = setTarget(c.getContext('2d'));
    const r = mulberry32(5);
    // light rays from the surface
    for (let i = 0; i < 14; i++) {
      const x = r() * fw;
      gfx.globalAlpha = 0.12;
      for (let y = RSEA_SURF; y < 150; y += 2) rect(x + (y - RSEA_SURF) * 0.4, y, 6 + y * 0.05, 2, '#c8f4ff');
    }
    gfx.globalAlpha = 1;
    // distant rocks
    for (let x = 0; x < fw; x += 2) {
      const h = 30 + Math.abs(Math.sin(x * 0.017)) * 26 + Math.sin(x * 0.07) * 4;
      rect(x, 160 - h, 2, h, '#0e3258');
      const h2 = 14 + Math.abs(Math.sin(x * 0.031 + 2)) * 14;
      rect(x, 160 - h2, 2, h2, '#124e89');
    }
    setTarget(prev);
    return c;
  }
  paintSeaNear() {
    const c = makeCanvas(RSEA_W, H), prev = setTarget(c.getContext('2d'));
    const r = mulberry32(9), G = ROBOT_GY;
    // the beach slope you came down
    for (let x = 0; x < 110; x++) { const h = Math.round((110 - x) * 0.9); rect(x, G - h, 1, h, '#e4a672'); rect(x, G - h, 1, 2, '#fee761'); }
    rect(46, G - 70, 2, 24, '#733e39'); rect(30, G - 78, 34, 10, '#fee761'); text('← BEACH', 47, G - 76, '#a22633', { font: F3, align: 'center' });
    // your old home: the rock arch
    const ax = RSEA_HOME_X;
    rect(ax - 50, G - 70, 22, 70, '#3a4466'); rect(ax + 28, G - 70, 22, 70, '#3a4466');
    for (let i = 0; i <= 78; i++) { const yy = G - 70 - Math.round(Math.sin(i / 78 * Math.PI) * 26); rect(ax - 50 + i + 11, yy - 12, 1, 14, '#3a4466'); }
    rect(ax - 48, G - 68, 4, 66, '#5a6988'); rect(ax + 30, G - 68, 4, 66, '#5a6988');
    for (let i = 0; i < 12; i++) disc(ax - 60 + r() * 120, G - r() * 80, 2, pick(['#f6757a', '#feae34', '#b55088']));
    // the sunken ship
    const sx = RSEA_SHIP_X;
    for (let i = 0; i < 120; i++) { const yy = G - 26 + Math.round(i * 0.08); rect(sx - 60 + i, yy, 1, G - yy, i % 9 ? '#5a3a2e' : '#3e2731'); }
    rect(sx - 60, G - 32, 120, 4, '#733e39');
    rect(sx + 10, G - 90, 4, 60, '#5a3a2e'); line(sx + 12, G - 90, sx + 40, G - 60, '#5a3a2e'); rect(sx - 4, G - 80, 20, 14, '#c0cbdc'); rect(sx - 2, G - 78, 3, 3, '#3e2731');
    for (let i = 0; i < 6; i++) disc(sx - 50 + i * 18, G - 20, 3, '#262b44');
    // rocks and coral on the sea floor
    for (let x = 140; x < RSEA_W; x += 50 + Math.floor(r() * 90)) {
      if (Math.abs(x - RSEA_HOME_X) < 70 || Math.abs(x - RSEA_SHIP_X) < 70) continue;
      if (r() < 0.5) { ellipse(x, G - 4, 10 + r() * 10, 7, '#3a4466'); ellipse(x - 3, G - 7, 5, 3, '#5a6988'); }
      else { const col = pick(['#f6757a', '#feae34', '#b55088', '#2ce8f5']); for (let k = 0; k < 4; k++) rect(x + k * 3 - 5, G - 6 - k % 2 * 5 - r() * 6, 2, 16, col); }
    }
    // sand
    for (let x = 0; x < RSEA_W; x += 4) { rect(x, G, 4, H - G, '#c28569'); rect(x, G, 4, 2, '#e4a672'); if ((x * 7) % 23 < 3) px(x, G + 6, '#e4a672'); }
    setTarget(prev);
    return c;
  }

  // the sea floor: fish, treasure, your old home and the way back out
  updateWorld(dt) {
    const p = this.p, b = this.b, t = this.t;
    for (const f of this.fish) {
      const d = dist(f.x, f.y, p.x, p.y - 30);
      if (d < 70 && f.scare <= 0) { f.scare = 1.2; f.vx = (f.x < p.x ? -1 : 1) * 80; }
      f.scare -= dt;
      if (f.scare <= 0 && Math.abs(f.vx) > 30) f.vx = Math.sign(f.vx) * 20;
      f.x += f.vx * dt;
      f.y = clamp(f.y + Math.sin(t * 2 + f.ph) * 6 * dt, RSEA_SURF + 8, 150);
      if (f.x < -20) f.x = RSEA_W + 10; else if (f.x > RSEA_W + 20) f.x = -10;
    }
    for (const c of this.chests) {
      if (c.open || Math.abs(c.x - p.x) > 18 || p.y < ROBOT_GY - 12) continue;
      c.open = true;
      b.seaChests = (b.seaChests || []).concat(c.i);
      Sound.sfx('gold');
      for (let i = 0; i < 20; i++) this.parts.add({ type: 'spark', x: c.x, y: ROBOT_GY - 8, vx: rnd(-50, 50), vy: rnd(-90, -20), g: 120, life: 1, c: pick(['#fee761', '#feae34', '#ffffff']) });
      this.reward(40, c.x, ROBOT_GY - 30, 'TREASURE!');
      saveGame();
    }
    if (!this.homeSeen && Math.abs(p.x - RSEA_HOME_X) < 60) {
      this.homeSeen = true;
      this.banner = { title: 'YOUR OLD HOME', sub: 'THE CORAL ARCH WHERE IT ALL STARTED. THE LITTLE FISH HERE STARE AT YOU.', t: 3.2, style: 'aqua' };
    }
    if (Math.random() < dt * 2.5) this.parts.add({ type: 'bubble', x: p.x + rnd(-6, 6), y: p.y - 56, vy: -rnd(15, 35), life: 1.4, size: rndi(1, 2), c: '#c8f4ff', minY: RSEA_SURF });
    // walk back up the beach slope to leave the sea
    if (p.x < 34 && (held('left') || this.touchButtons().left)) { this.leaving = true; this.land.surface(this); }
  }
  trickleTypes() { return ['jelly', 'shark']; }
  jetParticle(p) { return { type: 'bubble', x: p.x + rnd(-8, 8), y: p.y - 4, vx: rnd(-10, 10), vy: -rnd(20, 50), life: 0.8, size: rndi(1, 2), c: '#c8f4ff', minY: RSEA_SURF }; }
  updateEnemies(dt) {
    super.updateEnemies(dt);
    const p = this.p;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const dx = p.x - e.x, bx = p.x, by = p.y - 28;
      const touching = Math.abs(dx) < 14 + e.w / 3 && e.y > p.y - 54 && e.y - e.h < p.y;
      if (e.type === 'shark') {
        e.mode = e.mode || 'stalk';
        e.cd -= dt;
        if (e.mode === 'stalk') {
          const a = Math.atan2(by - e.y, bx - e.x);
          e.x += Math.cos(a) * 45 * dt; e.y += Math.sin(a) * 45 * dt;
          if (dist(e.x, e.y, bx, by) < 100 && e.cd <= 0) { e.mode = 'charge'; e.mt = 0.9; e.vx = Math.cos(a) * 160; e.vy = Math.sin(a) * 160; Sound.sfx('shark'); }
        } else if (e.mode === 'charge') {
          e.x += e.vx * dt; e.y += e.vy * dt; e.mt -= dt;
          e.face = e.vx < 0 ? -1 : 1;
          if (touching) { this.hurt(12); this.floaters.add('CHOMP!', p.x, p.y - 60, '#ff8f7a', { font: F5 }); e.mode = 'retreat'; e.mt = 1.2; }
          else if (e.mt <= 0) { e.mode = 'stalk'; e.cd = rnd(1.5, 2.5); }
        } else {
          e.x -= Math.sign(dx) * 60 * dt; e.mt -= dt;
          if (e.mt <= 0) { e.mode = 'stalk'; e.cd = rnd(1.5, 2.5); }
        }
        e.y = clamp(e.y, RSEA_SURF + 14, ROBOT_GY - 6);
      } else if (e.type === 'sub') {
        const tx = p.x - e.face * 110, ty = clamp(p.y - 30, RSEA_SURF + 20, 140);
        e.x += clamp(tx - e.x, -40, 40) * dt; e.y += clamp(ty - e.y, -30, 30) * dt;
        e.cd -= dt;
        if (e.cd <= 0 && Math.abs(dx) < 230) {
          e.cd = rnd(2.6, 3.6);
          this.shots.push({ x: e.x + e.face * 14, y: e.y - 6, vx: e.face * 90, vy: 0, life: 4, dmg: 8, kind: 'torpedo' });
          Sound.tone(200, 0.2, { type: 'triangle', vol: 0.08, slide: 0.6 });
        }
      } else if (e.type === 'jelly') {
        e.x += Math.sign(dx) * 10 * dt;
        e.y += Math.sin(e.t * 2.4) * 18 * dt;
        e.y = clamp(e.y, RSEA_SURF + 14, ROBOT_GY - 4);
        if (touching) { this.hurt(6); this.floaters.add('ZAP!', p.x, p.y - 60, '#f6a0c8', { font: F5 }); }
      } else if (e.type === 'boat') {
        e.x += clamp(p.x + 70 + Math.sin(e.t * 0.7) * 40 - e.x, -30, 30) * dt;
        e.cd -= dt;
        if (e.cd <= 0 && Math.abs(dx) < 200) {
          e.cd = e.hp < 30 ? 1.6 : 2.4;
          this.shots.push({ x: e.x - 24, y: e.y, vx: clamp(dx * 0.35, -60, 60), vy: 40, g: 25, life: 5, dmg: 4, kind: 'netshot' });
          Sound.sfx('splash');
        }
        if (!this.boatSeen) { this.boatSeen = true; this.banner = { title: 'THE FISHING BOAT!', sub: 'THE BOAT THAT CAUGHT YOU AS A LITTLE FISH. REVENGE TIME!', t: 3.2, style: 'red' }; }
      }
    }
  }
  damage(e, n) {
    const alive = e.hp > 0;
    super.damage(e, n);
    if (alive && e.hp <= 0 && e.type === 'boat') {
      this.b.boatRevenge = true;
      saveGame();
      Sound.sfx('fanfare');
      Game.shake(6, 1);
      for (let i = 0; i < 5; i++) setTimeout(() => this.boom(e.x + rnd(-30, 30), e.y - rnd(0, 20), 18), i * 200);
      this.banner = { title: 'REVENGE!', sub: 'THE FISHING BOAT SINKS. THE FISHERMEN SWIM TO SHORE. NOBODY NETS THIS FISH AGAIN.', t: 4, style: 'gold' };
    }
  }
  leave() {
    if (this.leaving) return;
    this.leaving = true;
    this.land.leaving = true;
    this.bowl.onExploreDone(this.land.elapsed + this.elapsed, 0);
    Game.go(() => this.bowl);
  }
  deathText() { return 'THE BOWL POPS OFF AND FLOATS HOME ON THE TIDE. (THE ROBOT WILL BE FIXED BY TOMORROW.)'; }
  hint() { return '← → WALK   ↑ SWIM UP   SPACE LASER   X MISSILES   WALK LEFT TO LEAVE'; }

  drawSky() {
    rect(0, 0, W, RSEA_SURF, '#9fe8f5');
    if (!this.waterBg) this.waterBg = gradientCanvas(W, ROBOT_GY - RSEA_SURF, [[0, '#2690c0'], [1, '#0b1f3a']], 3);
    blit(this.waterBg, 0, RSEA_SURF);
  }
  drawDecor(cx, t) {
    for (const k of this.kelp) if (k.x - cx > -20 && k.x - cx < W + 20) drawKelp(k.x - cx, ROBOT_GY, k.h, t, k.ph, '#265c42', '#3e8948');
    for (const f of this.fish) {
      const x = f.x - cx;
      if (x > -12 && x < W + 12) sprC(f.kind, Math.floor(t * 6 + f.ph) % 2, x, f.y, f.vx < 0);
    }
    for (const c of this.chests) {
      const x = Math.round(c.x - cx), y = ROBOT_GY;
      if (x < -20 || x > W + 20) continue;
      rect(x - 8, y - 9, 16, 9, '#733e39'); rect(x - 8, y - 5, 16, 1, '#fee761'); rect(x - 1, y - 6, 2, 3, '#fee761');
      if (c.open) { rect(x - 8, y - 14, 16, 4, '#5a3a2e'); rect(x - 6, y - 10, 12, 2, '#fee761'); }
      else { rect(x - 8, y - 12, 16, 4, '#8a4a38'); if (Math.floor(t * 3 + c.i) % 3 === 0) px(x + rndi(-6, 6), y - 13, '#ffffff'); }
    }
    if (Math.abs(RSEA_HOME_X - cx - W / 2) < W) text('HOME SWEET HOME', RSEA_HOME_X - cx, ROBOT_GY - 108, '#c8f4ff', { font: F3, align: 'center', outline: '#0b1f3a' });
  }
  drawFront(cx, t) {
    // the surface of the sea
    for (let x = 0; x < W; x++) px(x, RSEA_SURF + Math.round(Math.sin((x + cx) * 0.08 + t * 2.5) * 1.2), '#e8fbff');
  }
  drawEnemy(e, cx, t) {
    const x = Math.round(e.x - cx), y = Math.round(e.y), f = e.face, fl = e.flash > 0;
    if (x < -60 || x > W + 60) return;
    if (e.type === 'shark') {
      sprC('shark', Math.floor(t * 8) % 2, x, y - 6, f < 0, fl);
      if (e.mode === 'charge') px(x + f * 10, y - 8, '#e43b44');
    } else if (e.type === 'sub') {
      const body = fl ? '#ffffff' : '#5a6988';
      ellipse(x, y - 6, 14, 5, body); rect(x - 3, y - 15, 7, 5, body); rect(x + f * 2, y - 19, 1, 4, '#3a4466');
      for (let i = -1; i <= 1; i++) disc(x + i * 6, y - 6, 1, '#fee761');
      rect(x - f * 15 - 1, y - 9, 2, 6, Math.floor(t * 20) % 2 ? '#8b9bb4' : '#3a4466');
    } else if (e.type === 'jelly') {
      const c = fl ? '#ffffff' : '#f6a0c8';
      ellipse(x, y - 9, 5, 3, c); rect(x - 5, y - 9, 11, 2, c);
      for (let i = -4; i <= 4; i += 2) for (let k = 0; k < 5; k++) px(x + i + Math.round(Math.sin(t * 5 + k + i) * 1), y - 7 + k, '#b55088');
    } else if (e.type === 'boat') {
      drawBoat(x, y - 4, t, fl ? '#ffffff' : null);
      line(x - 24, y - 12, x - 24, y + 6, '#c0cbdc');
      if (e.hp < e.max * 0.5 && Math.random() < 0.3) this.parts.add({ x: x + cx + rnd(-10, 10), y: y - 22, vy: -20, life: 0.8, size: 2, c: '#3a4466' });
    } else { super.drawEnemy(e, cx, t); return; }
    if (e.type !== 'boat' && e.hp < e.max) { rect(x - 8, y - e.h - 8, 16, 2, '#3e2731'); rect(x - 8, y - e.h - 8, Math.round(16 * e.hp / e.max), 2, '#e43b44'); }
  }
  drawProgress() {
    const p = this.p, mx = 120, mw = 80;
    rect(mx, 8, mw, 1, '#9fe8f5');
    rect(mx + Math.round(RSEA_HOME_X / RSEA_W * mw), 6, 1, 5, '#c0cbdc');
    rect(mx + Math.round(RSEA_BOAT_X / RSEA_W * mw) - 1, 6, 3, 5, this.b.boatRevenge ? '#63c74d' : '#e43b44');
    rect(mx + Math.round(p.x / RSEA_W * mw) - 1, 5, 3, 7, '#fee761');
  }
}
