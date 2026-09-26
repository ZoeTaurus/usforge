'use strict';
// ============================================================
//  Fishing scene: pier or rowboat, anglers, weather, events,
//  shop, journal, aquarium, quests and the travel map
// ============================================================

const HY = 88;          // horizon
const WY = 110;         // water surface
const PIER_X0 = 94, PIER_X1 = 214, DECK_Y = 100;
const DAY_LEN = 300;    // seconds per in-game day
const SEABED = [[0, 108], [106, 108], [116, 112], [140, 132], [170, 156], [196, 168], [220, 170], [320, 170], [400, 170]];
function seabedY(x) {
  for (let i = 0; i < SEABED.length - 1; i++) {
    const [x0, y0] = SEABED[i], [x1, y1] = SEABED[i + 1];
    if (x <= x1) return lerp(y0, y1, (x - x0) / (x1 - x0)) + (x > 200 ? Math.round(Math.sin(x * 0.21) * 1.2) : 0);
  }
  return 170;
}
const SHORE_X = 111;
const BOAT_X = 194;
const SHOP_TABS = ['BAIT', 'GEAR', 'STYLE', 'DECOR', 'SELL'];

const SPOT_LOOK = {
  pier: { sand: '#ecd29a', sandTop: '#f6e2b0', under: '#c8a878', underTop: '#d8bc88', kelp: '#2f7a4a' },
  wreck: { sand: '#b8a888', sandTop: '#cabb9a', under: '#6a6a58', underTop: '#7a7a66', kelp: '#3a6a3a', sea: '#2a5a4a', seaK: 0.45, sky: '#8aa89a', skyK: 0.22 },
  ice: { sand: '#e8f0f8', sandTop: '#ffffff', under: '#9aaabb', underTop: '#b0c0d0', kelp: '#3a7a8a', sea: '#7ac8d8', seaK: 0.35, sky: '#d8e8f8', skyK: 0.18 },
  volcano: { sand: '#3a3036', sandTop: '#4a3e44', under: '#2a2026', underTop: '#3a2e34', kelp: '#6a3a2a', sea: '#8a3a2a', seaK: 0.4, sky: '#ff6a3a', skyK: 0.2 },
};

function makeAngler(i) {
  return { i, state: 'idle', power: 0, pdir: 1, bob: null, engaged: null, reel: null, land: null, popup: null, showT: 0, baitUsed: 'worm', tip: null, mouseCast: false, x: 0, y: 0 };
}

const BeachScene = {
  enter(arg = {}) {
    const s = Game.save;
    if (s.spot !== 'pier' && !(s.boat && this.spotOpen(SPOT_BY_ID[s.spot]))) s.spot = 'pier';
    this.spot = s.spot;
    this.look = SPOT_LOOK[this.spot];
    this.t = 0;
    this.parts = new Particles();
    this.amb = new Ambient(this.spot === 'volcano' ? 1 : 4);
    this.wx = new WeatherFx();
    if (!WEATHER_BY_SPOT[this.spot].some(w => w[0] === s.weather.kind)) s.weather = { kind: pickWeather(this.spot), t: rand(70, 140) };
    this.fish = [];
    for (let i = 0; i < 4; i++) this.spawnFish(true);
    this.anglers = [makeAngler(0)];
    if (Game.players === 2) this.anglers.push(makeAngler(1));
    this.overlay = null;
    this.sel = 0; this.tab = 0; this.jpage = this.spot === 'pier' ? 0 : 1; this.jsel = 0; this.msel = 0;
    this.bossTimer = 4;
    this.yank = null;
    this.gull = null; this.gullT = rand(40, 80);
    this.bottle = null; this.bottleT = rand(25, 60);
    this.frenzy = 0;
    this.spotCatches = 0;
    this.buildGround();
    applyHat(s.hat);
    Sound.music('cozy');
    this.updateAmbience();
    this.ensureWanted();
    if (!s.quest) s.quest = this.genQuest();
    if (arg.newRod !== undefined) { this.overlay = 'rod'; this.rodShown = arg.newRod; }
    if (arg.newCharm !== undefined) { this.overlay = 'charm'; this.charmShown = arg.newCharm; }
    if (arg.beast) this.questEvent('beast');
    if (arg.msg) Toasts.add(arg.msg, arg.msgColor || '#ffffff', 4, 60);
    if (arg.travel) Toasts.add('WELCOME TO ' + SPOT_BY_ID[this.spot].name + '!', '#ffe9b0', 3.5, 40);
    if (!s.tips.cast) Toasts.add('HOLD SPACE (OR TAP) TO CHARGE A CAST', '#ffffff', 5, 150);
    writeSave();
  },

  // ---------- helpers ----------
  rod() { return RODS[Game.save.rod]; },
  stats() {
    const s = Game.save, r = this.rod();
    return { reel: r.reel * (1 + 0.15 * s.up.reel), line: r.line * (1 + 0.15 * s.up.line), luck: r.luck };
  },
  weather() { return WEATHER[Game.save.weather.kind]; },
  baitCount(id) { return id === 'worm' ? Infinity : Game.save.bait[id] || 0; },
  spotOpen(sp) {
    const s = Game.save;
    if (!sp.need) return true;
    if (!s.boat) return false;
    return sp.need === 'boat' || s.bosses.includes(sp.need);
  },
  layout() {
    const boat = this.spot !== 'pier';
    const b = boat ? Math.round(Math.sin(this.t * 1.6)) : 0;
    const two = this.anglers.length === 2;
    return { boat, fy: boat ? WY - 5 + b : DECK_Y, xs: boat ? [206, 180] : [203, 176], cooler: boat ? (two ? 187 : 184) : 187, b };
  },
  calm() { return !this.yank && this.anglers.every(a => a.state === 'idle' || a.state === 'wait'); },
  updateAmbience() { Sound.ambience(this.weather().precip === 'rain' ? 'rain' : 'waves'); },
  pierBeaten() { return BOSSES.slice(0, PIER_BOSSES).filter(b => Game.save.bosses.includes(b.id)).length; },
  bossIndexHere() {
    if (this.spot !== 'pier') return SPOT_BY_ID[this.spot].boss;
    const n = this.pierBeaten();
    return n < PIER_BOSSES ? n : randi(0, PIER_BOSSES - 1);
  },
  availableFish() {
    const s = Game.save, spots = SPOTS.filter(sp => this.spotOpen(sp)).map(sp => sp.id);
    return FISH.filter(f => spots.includes(f.spot) && f.tier <= s.rod);
  },
  ensureWanted() {
    const s = Game.save;
    if (s.wantedDay === s.day && s.wanted) return;
    s.wanted = choice(this.availableFish().filter(f => !f.junk)).id;
    s.wantedDay = s.day;
  },
  pickSpecies() {
    const s = Game.save, night = isNight(s.dayTime), w = this.weather();
    const luck = this.stats().luck + (s.baitSel === 'glow' ? 0.35 : 0);
    const pool = FISH.filter(f => f.spot === this.spot && f.tier <= s.rod && (!f.night || night));
    const ws = pool.map(f => f.w * (f.rare || f.value >= 30 ? (1 + luck * 2.5) * w.rare : 1) * (night && f.night ? 1.6 : 1));
    let r = Math.random() * ws.reduce((a, b) => a + b, 0);
    for (let i = 0; i < pool.length; i++) { r -= ws[i]; if (r <= 0) return pool[i]; }
    return pool[0];
  },
  spawnFish(init, boss = false) {
    let sp, len, bi = -1;
    if (boss) { bi = this.bossIndexHere(); sp = BOSSES[bi]; len = sp.shadowLen; }
    else { sp = this.pickSpecies(); len = sp.len; }
    const x = init ? rand(160, 310) : 336 + len / 2;
    const f = { sp, len, boss, bi, x, y: rand(WY + 10, seabedY(Math.min(x, 318)) - 6), tx: rand(160, 310), ty: rand(WY + 10, 160), spd: boss ? 9 : rand(8, 16), dir: -1, state: 'wander', t: rand(1, 4), scared: 0, anim: rand(0, 3), life: boss ? 55 : rand(40, 80), by: null };
    this.fish.push(f);
    return f;
  },
  buildGround() {
    const c = (this.ground = makeCanvas(W, H)), L = this.look;
    withTarget(c.getContext('2d'), () => {
      for (let x = 0; x < W; x++) {
        const top = Math.round(seabedY(x));
        for (let y = top; y < H; y++) {
          const under = y >= WY;
          let col = under ? L.under : L.sand;
          if (y === top) col = under ? L.underTop : L.sandTop;
          if (hash(x, y) < 0.12) col = darken(col, 0.12);
          else if (hash(x + 99, y) < 0.06) col = lighten(col, 0.2);
          if (this.spot === 'volcano' && hash(x * 3, y) < 0.012) col = '#ff7a2a';
          P(x, y, col);
        }
      }
      const rockA = this.spot === 'volcano' ? '#2a2228' : '#6f6a70', rockB = this.spot === 'volcano' ? '#4a3a40' : '#8e8890';
      for (const [x, r] of [[176, 4], [232, 3], [262, 5], [300, 3]]) { const y = seabedY(x); pcircle(x, y, r, rockA); pcircle(x - 1, y - 1, r - 1, rockB); }
      if (this.spot === 'pier') for (const [x, c] of [[208, '#ff8fa0'], [284, '#ffb070'], [248, '#f0e0ff']]) { const y = seabedY(x) - 1; R(x, y, 3, 1, c); P(x + 1, y - 1, c); }
      if (this.spot === 'wreck') {
        // the sunken ship
        const bx = 236, by = 170;
        for (let i = 0; i < 64; i++) { const h = Math.round(16 - Math.abs(i - 30) * 0.28 + (hash(i, 4) < 0.2 ? -4 : 0)); R(bx + i, by - h, 1, h, i % 6 === 0 ? '#3a2818' : '#5a3e28'); }
        R(bx + 4, by - 12, 56, 1, '#6a4a30'); R(bx + 18, by - 8, 5, 4, '#1a1410'); R(bx + 34, by - 9, 5, 4, '#1a1410');
      }
    });
  },

  // ---------- update ----------
  update(dt) {
    this.t += dt;
    const s = Game.save;
    this.amb.update(dt);
    this.parts.update(dt);
    if (this.spot === 'pier') fireParticles(this.parts, 90, 108, dt);
    if (this.spot === 'volcano' && Math.random() < dt * 6) this.parts.add({ x: rand(0, W), y: H, vx: rand(-8, 4), vy: -rand(15, 30), life: rand(2, 4), c: choice(['#ff7a2a', '#ffb03a', '#ff4a1a']) });
    this.wx.update(dt, s.weather.kind, () => { Fx.flash = 0.45; Fx.flashColor = '#ffffff'; Sound.play('thunder'); });

    if (this.overlay) { this.updateOverlay(dt); return; }

    // clock + weather
    const prevT = s.dayTime;
    s.dayTime += dt / DAY_LEN;
    if (s.dayTime >= 1) { s.dayTime -= 1; s.day++; this.ensureWanted(); Toasts.add('DAY ' + s.day + ' - GOOD MORNING!', '#ffe9b0', 3, 40); writeSave(); }
    if (prevT < 0.2 && s.dayTime >= 0.2 && Math.random() < 0.6) this.startFrenzy('SUNRISE FEEDING FRENZY!');
    const nowNight = isNight(s.dayTime);
    if (this._night !== undefined && this._night !== nowNight) Toasts.add(nowNight ? 'NIGHT FALLS... NIGHT FISH ARE OUT' : 'THE SUN IS UP', '#c8d0ff', 3, 40);
    this._night = nowNight;
    s.weather.t -= dt;
    if (s.weather.t <= 0) {
      s.weather = { kind: pickWeather(this.spot, s.weather.kind), t: rand(70, 150) };
      const w = this.weather();
      Toasts.add(w.name + ': ' + w.tip, '#d8e8ff', 4, 40);
      this.updateAmbience();
    }
    if (this.frenzy > 0) { this.frenzy -= dt; if (Math.random() < dt * 20) this.parts.add({ x: rand(150, 316), y: WY - 1, vy: -rand(10, 30), g: 80, life: 0.5, c: '#ffffff' }); }

    // mouse on UI
    let uiClick = false;
    const m = Input.mouse;
    if (m.pressed) {
      const btn = this.buttons().find(b => inRect(b.x, b.y, b.w, b.h));
      if (btn) { uiClick = true; if (this.calm()) btn.go(); }
      else if (inRect(3, 21, 90, 8)) { uiClick = true; if (this.anglers[0].state === 'idle') this.cycleBait(); }
      else if (this.spot === 'pier' && inRect(64, 84, 22, 26)) { uiClick = true; if (this.calm()) this.openOverlay('quest'); }
      else if (this.gull && this.gull.state === 'in' && dist(m.x, m.y, this.gull.x, this.gull.y) < 14) { uiClick = true; this.shooGull(); }
    }
    if (this.overlay) return;
    if (this.calm()) {
      if (Input.hit('b')) this.openOverlay('shop');
      if (Input.hit('j')) this.openOverlay('journal');
      if (Input.hit('a') && Game.players === 1) this.openOverlay('tank');
      if (Input.hit('t')) this.openTravel();
      if (Input.hit('q')) { if (this.spot === 'pier') this.openOverlay('quest'); else Toasts.add('OLD SALT IS BACK AT THE PIER', '#ffb0a0', 2, 150); }
      if (Input.hit('escape')) { writeSave(); Fx.transition(() => Game.setScene(MenuScene)); }
    }
    if (Input.hit('x') && this.gull && this.gull.state === 'in') this.shooGull();
    if (this.anglers[0].state === 'idle') {
      if (Input.hit('tab')) this.cycleBait();
      ['1', '2', '3'].forEach((k, i) => { if (Input.hit(k)) this.setBait(BAITS[i].id); });
    }

    this.updateFish(dt);
    this.updateEvents(dt);
    const two = this.anglers.length === 2;
    for (const a of this.anglers) {
      let pressed, held;
      if (a.i === 0) {
        if (m.pressed && !uiClick) a.mouseCast = true;
        if (!m.down) a.mouseCast = false;
        pressed = Input.hit('space') || (!two && Input.hit('enter')) || (m.pressed && !uiClick);
        held = Input.key('space') || (!two && Input.key('enter')) || (m.down && a.mouseCast);
      } else { pressed = Input.hit('enter'); held = Input.key('enter'); }
      this.updateAngler(a, dt, pressed, held);
    }
    if (this.yank) this.updateYank(dt);
  },

  buttons() {
    const s = Game.save, L = [
      { label: 'SHOP (B)', icon: 'shop', go: () => this.openOverlay('shop') },
      { label: 'JOURNAL (J)', icon: 'journal', go: () => this.openOverlay('journal') },
      { label: 'AQUARIUM' + (Game.players === 1 ? ' (A)' : ''), icon: 'tank', go: () => this.openOverlay('tank') },
    ];
    if (s.boat) L.push({ label: 'TRAVEL (T)', icon: 'map', go: () => this.openTravel() });
    return L.map((b, i) => Object.assign(b, { x: 252, y: 3 + i * 13, w: 65, h: 11 }));
  },
  cycleBait() {
    const ids = BAITS.map(b => b.id);
    let i = ids.indexOf(Game.save.baitSel);
    for (let k = 0; k < 3; k++) { i = (i + 1) % 3; if (this.baitCount(ids[i]) > 0) break; }
    this.setBait(ids[i]);
  },
  setBait(id) {
    if (this.baitCount(id) <= 0) { Toasts.add('NO ' + BAITS.find(b => b.id === id).name + ' LEFT - VISIT THE SHOP (B)', '#ffb0a0', 2, 150); Sound.play('nope'); return; }
    Game.save.baitSel = id; Sound.play('move');
  },
  openOverlay(o) {
    this.overlay = o; this.sel = 0;
    Sound.play('select');
    if (o === 'shop') { Sound.play('meow'); this.tab = 0; }
    if (o === 'tank') this.fillTank();
    if (o === 'quest') { const q = Game.save.quest; this.questLine = q && q.done ? 'WELL DONE! HERE, TAKE THIS.' : q ? q.greet : ''; }
  },
  openTravel() {
    if (!Game.save.boat) { Toasts.add('BUY A ROWBOAT AT THE SHOP FIRST (GEAR TAB)', '#ffb0a0', 2.5, 150); Sound.play('nope'); return; }
    this.overlay = 'travel'; this.msel = SPOTS.findIndex(s => s.id === this.spot); Sound.play('select');
  },
  startFrenzy(msg) {
    this.frenzy = 30;
    Toasts.add(msg + ' EVERYTHING BITES!', '#ffe14a', 3.5, 40);
    Sound.play('frenzy');
    for (let i = 0; i < 4; i++) this.spawnFish(false);
  },

  updateFish(dt) {
    const s = Game.save;
    const want = this.frenzy > 0 ? 8 : 5;
    if (this.fish.filter(f => !f.boss).length < want && Math.random() < dt * (this.frenzy > 0 ? 2 : 0.7)) this.spawnFish(false);
    this.bossTimer -= dt;
    if (this.bossTimer <= 0) {
      this.bossTimer = 5;
      const glowOut = this.anglers.some(a => a.bob && a.baitUsed === 'glow');
      let ch = s.bigChance * (glowOut ? 2.5 : 1) * this.weather().big;
      const bi = this.bossIndexHere(), beaten = s.bosses.includes(BOSSES[bi].id);
      if (this.spot === 'pier' && s.bosses.length === 0 && s.catches >= 4) ch = 1;
      if (this.spot !== 'pier' && !beaten && this.spotCatches >= 3) ch = Math.max(ch, 0.5);
      if (!this.fish.some(f => f.boss) && !this.yank && Math.random() < ch) {
        const f = this.spawnFish(false, true);
        s.bigChance = 0.03;
        Toasts.add(beaten ? 'A FAMILIAR GIANT RETURNS...' : 'A HUGE SHADOW LURKS IN THE WATER...', '#ff9a9a', 3.5, 40);
        if (!s.tips.boss) { s.tips.boss = 1; Toasts.add('CAST NEAR IT... IF YOU DARE!', '#ffd27a', 4, 150); }
        Sound.play('roar');
        Fx.shake = 2;
        f.x = 340;
      }
    }
    for (const f of this.fish) {
      f.anim += dt * (f.state === 'flee' ? 10 : 4);
      f.scared -= dt;
      f.life -= dt;
      const a = f.by;
      if (a && a.reel && a.reel.f === f) continue;
      const hx = a && a.bob ? a.bob.x : f.x, hy = a && a.bob ? a.bob.hy : f.y;
      let tx = f.tx, ty = f.ty, spd = f.spd;
      if (f.state === 'wander') {
        f.t -= dt;
        if (f.t <= 0 || dist(f.x, f.y, f.tx, f.ty) < 2) { f.tx = rand(152, 314); f.ty = rand(WY + 8, seabedY(f.tx) - 5); f.t = rand(2, 5); }
        if (f.life <= 0) f.state = 'leave';
      } else if (f.state === 'leave') { tx = 360; ty = f.y; spd = f.spd * 1.5; }
      else if (f.state === 'flee') { tx = f.x + (f.x < 230 ? -60 : 60); ty = f.y + 10; spd = 45; f.t -= dt; if (f.t <= 0) { f.state = 'wander'; f.t = 0; } }
      else if (a && (f.state === 'approach' || f.state === 'nibble' || f.state === 'bite')) {
        const d = hx >= f.x ? 1 : -1;
        tx = hx - d * (f.len / 2 + 1); ty = hy; spd = f.boss ? 10 : 13;
        if (f.state === 'nibble') { tx -= d * (Math.sin(this.t * 9) > 0.6 ? 2 : 0); spd = 20; }
        if (f.state === 'bite') { tx += d; spd = 30; }
      }
      const dx = tx - f.x, dy = ty - f.y, dd = Math.hypot(dx, dy);
      if (dd > 0.5) { const mv = Math.min(dd, spd * dt); f.x += (dx / dd) * mv; f.y += (dy / dd) * mv; if (Math.abs(dx) > 0.5) f.dir = dx > 0 ? 1 : -1; }
      if (a && (f.state === 'approach' || f.state === 'nibble' || f.state === 'bite')) f.dir = hx >= f.x ? 1 : -1;
      if (f.state !== 'leave') f.y = clamp(f.y, WY + 6, seabedY(clamp(f.x, 0, 319)) - 4);
    }
    this.fish = this.fish.filter(f => (f.x < 350 && f.x > 110) || f.by);
  },

  // ---------- events: seagull thief, message bottles ----------
  coolerPos() { const L = this.layout(); return [L.cooler + 4, L.fy - 6]; },
  updateEvents(dt) {
    const s = Game.save;
    if (!this.gull) {
      this.gullT -= dt;
      if (this.gullT <= 0 && s.cooler.length > 0) {
        this.gull = { x: W + 10, y: 24, state: 'in', t: 0, carry: null };
        Toasts.add('A SEAGULL WANTS YOUR FISH! CLICK IT OR PRESS X', '#ffe9b0', 3.5, 150);
        Sound.play('squawk');
      } else if (this.gullT <= 0) this.gullT = rand(20, 40);
    } else {
      const g = this.gull;
      g.t += dt;
      if (g.state === 'in') {
        const [cx, cy] = this.coolerPos();
        const d = dist(g.x, g.y, cx, cy) || 1, sp = 34;
        g.x += ((cx - g.x) / d) * sp * dt; g.y += ((cy - g.y) / d) * sp * dt + Math.sin(g.t * 5) * 0.3;
        if (d < 3) {
          const f = s.cooler.pop();
          if (f) { g.carry = FISH_BY_ID[f.id]; Toasts.add('THE GULL STOLE YOUR ' + g.carry.name + '!', '#ffb0a0', 3, 150); Sound.play('squawk'); writeSave(); }
          g.state = 'away';
        }
      } else { g.x += (g.state === 'shoo' ? 120 : 60) * dt; g.y -= (g.state === 'shoo' ? 70 : 30) * dt; if (g.y < -20 || g.x > W + 20) { this.gull = null; this.gullT = rand(60, 120); } }
    }
    if (!this.bottle) {
      this.bottleT -= dt;
      if (this.bottleT <= 0) { this.bottle = { x: 330 }; Toasts.add('A BOTTLE IS BOBBING BY... CAST AT IT!', '#c8ffd8', 3, 150); }
    } else {
      const b = this.bottle;
      b.x -= 5 * dt;
      if (b.x < 150) { this.bottle = null; this.bottleT = rand(50, 110); }
      else for (const a of this.anglers) if (a.state === 'wait' && a.bob && Math.abs(a.bob.x - b.x) < 7) { this.snagBottle(a); break; }
    }
  },
  shooGull() {
    const g = this.gull;
    g.state = 'shoo';
    Sound.play('shoo');
    Toasts.add('SHOO! SHOO!', '#ffffff', 1.5, 150);
    this.parts.burst(8, { x: g.x, y: g.y, c: '#ffffff', life: 0.6, g: 40 }, 30);
  },
  snagBottle(a) {
    const s = Game.save;
    this.bottle = null; this.bottleT = rand(60, 120);
    if (a.engaged) { a.engaged.state = 'wander'; a.engaged.by = null; a.engaged = null; }
    a.bob = null;
    Sound.play('rare');
    const r = Math.random();
    let lines;
    if (r < 0.3) { const c = randi(25, 90); s.coins += c; lines = ['A FEW COINS ROLL OUT!', '+' + c + ' COINS']; }
    else if (r < 0.55) { const k = Math.random() < 0.5 ? 'shrimp' : 'glow', n = k === 'shrimp' ? 4 : 2; s.bait[k] += n; lines = ['SOMEONE SENT YOU BAIT?!', '+' + n + ' ' + (k === 'shrimp' ? 'SHRIMP' : 'GLOW BAIT')]; }
    else if (r < 0.75) { s.map = true; lines = ['A TREASURE MAP!', 'X MARKS THE SPOT: YOUR NEXT', 'CATCH WILL BE TREASURE!']; }
    else lines = choice([
      ['"HELP! A KRAKEN ATE MY BOAT."', '- CAPTAIN P.'],
      ['"THE GHOST WHALE HATES LIGHT..."', '- A SCARED PIRATE'],
      ['"CRABS CANNOT JUMP FOREVER."', '- A WISE PENGUIN'],
      ['"THE CAT RUNS THIS BEACH."', '- EVERYONE'],
      ['"DEAR DIARY, CAUGHT A BOOT AGAIN."', '- OLD SALT'],
    ]);
    writeSave();
    a.popup = { kind: 'bottle', lines };
    a.state = 'show'; a.showT = 0;
  },

  // ---------- anglers ----------
  updateAngler(a, dt, pressed, held) {
    const s = Game.save, L = this.layout();
    a.x = L.xs[a.i]; a.y = L.fy;
    switch (a.state) {
      case 'idle':
        if (pressed) { if (this.baitCount(s.baitSel) <= 0) s.baitSel = 'worm'; a.state = 'charge'; a.power = 0; a.pdir = 1; }
        break;
      case 'charge':
        a.power += a.pdir * dt * 1.3;
        if (a.power > 1) { a.power = 1; a.pdir = -1; }
        if (a.power < 0) { a.power = 0; a.pdir = 1; }
        if (!held) this.cast(a);
        break;
      case 'fly': {
        const b = a.bob;
        b.t += dt;
        const k = Math.min(1, b.t / b.dur);
        b.x = lerp(b.sx, b.tx, k);
        b.y = lerp(b.sy, WY - 2, k) - Math.sin(k * Math.PI) * b.arc;
        if (k >= 1) {
          a.state = 'wait'; b.landed = true; b.y = WY - 2; b.hy = WY; b.dip = 0;
          Sound.play('splash');
          this.splash(b.x, 8);
          if (this.bottle && Math.abs(this.bottle.x - b.x) < 14) { this.snagBottle(a); break; }
          if (!s.tips.cast) { s.tips.cast = 1; Toasts.add('WAIT FOR THE BOBBER TO DUNK, THEN PRESS!', '#ffffff', 4, 150); }
        }
        break;
      }
      case 'wait': this.updateWait(a, dt, pressed); break;
      case 'reel': this.updateReel(a, dt, held); break;
      case 'land':
        a.land.t += dt;
        if (a.land.t >= 0.7) { a.state = 'show'; a.showT = 0; Sound.play(a.land.sp.rare ? 'rare' : 'catch'); }
        break;
      case 'show':
        a.showT += dt;
        if ((pressed && a.showT > 0.25) || (this.anglers.length === 2 && a.showT > 5)) { a.state = 'idle'; a.popup = null; Sound.play('coin'); }
        break;
    }
  },
  cast(a) {
    const s = Game.save;
    a.baitUsed = s.baitSel;
    if (s.baitSel !== 'worm') { s.bait[s.baitSel] = Math.max(0, s.bait[s.baitSel] - 1); if (s.bait[s.baitSel] === 0) s.baitSel = 'worm'; }
    const p = a.power, tip = a.tip || [a.x + 20, 70];
    const tx = 220 + p * 92 - (a.i === 1 ? 8 : 0);
    a.bob = { sx: tip[0], sy: tip[1], x: tip[0], y: tip[1], tx, t: 0, dur: 0.55 + p * 0.35, arc: 22 + p * 28, landed: false, hy: WY, hookTarget: Math.min(seabedY(tx) - 6, WY + 12 + p * 34), dip: 0, dipT: 0 };
    a.state = 'fly';
    Sound.play('cast', s.rod);
  },
  splash(x, n, big) {
    for (let i = 0; i < n; i++) this.parts.add({ x: x + rand(-2, 2), y: WY - 1, vx: rand(-25, 25) * (big ? 2 : 1), vy: -rand(20, 55) * (big ? 1.6 : 1), g: 160, life: rand(0.4, 0.8), c: choice(['#ffffff', '#cfefff', '#9fd8ff']) });
    this.parts.add({ type: 'ring', x, y: WY, s: 2, grow: 14, life: 0.8, c: '#e8f8ff' });
    if (big) this.parts.add({ type: 'ring', x, y: WY, s: 4, grow: 30, life: 1.1, c: '#ffffff' });
  },
  updateWait(a, dt, pressed) {
    const b = a.bob;
    b.hy = lerp(b.hy, b.hookTarget, dt * 2);
    b.dipT -= dt;
    if (b.dipT <= 0) b.dip = 0;
    const shrimp = a.baitUsed === 'shrimp', fr = this.frenzy > 0;
    const rate = (shrimp ? 2.2 : 1) * this.weather().bite * (fr ? 3 : 1);
    if (!a.engaged) {
      for (const f of this.fish) {
        if (f.state !== 'wander' || f.scared > 0 || f.by) continue;
        const notice = f.boss ? 80 : 34 + f.len;
        if (dist(f.x, f.y, b.x, b.hy) < notice && Math.random() < dt * (f.boss ? 0.6 : 0.55) * rate) { f.state = 'approach'; f.by = a; a.engaged = f; break; }
      }
    }
    const f = a.engaged;
    if (f) {
      if (f.state === 'approach') {
        const mouthX = f.x + f.dir * (f.len / 2 + 1);
        if (dist(mouthX, f.y, b.x, b.hy) < 3) { f.state = 'nibble'; f.nib = f.boss ? 3 : fr ? 0 : shrimp ? randi(0, 1) : randi(1, 3); f.t = rand(0.4, 0.9); }
      } else if (f.state === 'nibble') {
        f.t -= dt;
        if (f.t <= 0) {
          if (f.nib > 0) {
            f.nib--; f.t = rand(0.5, 1.1) / (shrimp ? 1.5 : 1);
            b.dip = f.boss ? 2 : 1; b.dipT = 0.15; Sound.play('plop');
            this.parts.add({ type: 'ring', x: b.x, y: WY, s: 1, grow: 8, life: 0.5, c: '#e8f8ff' });
          } else {
            f.state = 'bite'; f.t = f.boss ? 1.1 : f.sp.rare ? 0.6 : 0.85;
            if (Game.save.diff === 'cozy') f.t += 0.2;
            b.dip = 5; b.dipT = 99; Sound.play('bite');
            this.splash(b.x, f.boss ? 14 : 5, f.boss);
            if (f.boss) Fx.shake = 3;
          }
        }
      } else if (f.state === 'bite') {
        f.t -= dt;
        if (f.t <= 0) { this.scare(a, f, 'TOO SLOW... IT STOLE THE BAIT'); b.dip = 0; }
      }
    }
    if (pressed) {
      if (f && f.state === 'bite') { this.startReel(a, f); return; }
      if (f && f.state === 'nibble') { this.scare(a, f, 'TOO EARLY! YOU SPOOKED IT'); return; }
      a.state = 'idle'; a.bob = null;
      if (f) { f.state = 'wander'; f.by = null; a.engaged = null; }
      Sound.play('reel');
    }
  },
  scare(a, f, msg) {
    f.state = 'flee'; f.t = 1.4; f.scared = 7; f.by = null;
    a.engaged = null;
    Toasts.add((this.anglers.length === 2 ? 'P' + (a.i + 1) + ': ' : '') + msg, '#ffb0a0', 2, 150);
    Sound.play('nope');
  },
  startReel(a, f) {
    const b = a.bob;
    const startDist = 40 + ((b.x - 214) / 100) * 50;
    a.reel = { f, dist: startDist, start: startDist, tension: 15, thrash: false, tt: rand(0.6, 1.2), t: 0, boss: f.boss, hx: f.x, hy: f.y, tick: 0 };
    a.state = 'reel';
    Sound.play('hook');
    Fx.shake = f.boss ? 4 : 1;
    if (f.boss) { Toasts.add("IT'S ENORMOUS!!", '#ff7a7a', 2, 40); Sound.play('roar'); }
    else if (!Game.save.tips.reel) { Game.save.tips.reel = 1; Toasts.add('HOLD TO REEL - RELEASE WHEN IT THRASHES!', '#ffffff', 4, 150); }
  },
  updateReel(a, dt, held) {
    const r = a.reel, f = r.f, st = this.stats();
    r.t += dt;
    if (r.boss) {
      r.tension = Math.min(100, r.tension + dt * 55);
      r.dist += dt * 6;
      Fx.shake = Math.max(Fx.shake, 1.5 + r.t);
      if (Math.random() < dt * 10) this.splash(this.fishPos(a)[0], 3);
      if (r.t > 1.7 && !this.yank) this.startYank(a);
      return;
    }
    const eff = (f.sp.str / st.line) * (Game.save.diff === 'cozy' ? 0.85 : 1);
    r.tt -= dt;
    if (r.tt <= 0) {
      r.thrash = !r.thrash;
      r.tt = r.thrash ? rand(0.5, 1.1) * (0.7 + eff * 0.3) : rand(0.9, 2.0) / (0.6 + eff * 0.4);
      if (r.thrash) { Sound.play('splash'); this.splash(this.fishPos(a)[0], 6); }
    }
    if (held) {
      r.dist -= st.reel * (r.thrash ? 5 : 15) * dt;
      r.tension += (r.thrash ? 78 : 20) * eff * dt;
      r.tick -= dt;
      if (r.tick <= 0) { r.tick = 0.07; Sound.play('reel'); }
    } else {
      r.dist += (r.thrash ? 12 : 3) * eff * dt;
      r.tension -= (r.thrash ? 22 : 48) * dt;
    }
    r.tension = clamp(r.tension, 0, 100);
    if (r.thrash && Math.random() < dt * 8) this.splash(this.fishPos(a)[0], 2);
    if (r.tension >= 100) { Sound.play('snap'); Fx.shake = 3; Toasts.add('SNAP! THE LINE BROKE...', '#ff9a9a', 2.5, 60); this.loseFish(a); }
    else if (r.dist >= 100) { Toasts.add('IT GOT AWAY...', '#ffb0a0', 2.5, 60); Sound.play('nope'); this.loseFish(a); }
    else if (r.dist <= 0) this.landFish(a);
  },
  fishPos(a) {
    const r = a.reel;
    const ex = (this.spot === 'pier' ? PIER_X1 + 4 : BOAT_X + 26), ey = WY + 5;
    const k = r.dist / r.start;
    let x = ex + (r.hx - ex) * k, y = ey + (r.hy - ey) * k;
    if (r.thrash || r.boss) { x += Math.sin(r.t * 22) * 2.5; y += Math.cos(r.t * 17) * 1.5; }
    return [x, clamp(y, WY + 4, 170)];
  },
  loseFish(a) {
    const f = a.reel.f, [x, y] = this.fishPos(a);
    f.state = 'flee'; f.t = 2; f.scared = 10; f.x = x; f.y = y; f.by = null;
    a.reel = null; a.engaged = null; a.bob = null; a.state = 'idle';
  },
  landFish(a) {
    const s = Game.save, f = a.reel.f, st = this.stats();
    let sp = f.sp;
    if (s.map) { s.map = false; sp = FISH_BY_ID[this.spot === 'wreck' ? 'doubloon' : 'chest']; Toasts.add('X MARKS THE SPOT! TREASURE!', '#ffe14a', 3, 40); }
    const [fx, fy] = this.fishPos(a);
    this.fish = this.fish.filter(x => x !== f);
    a.reel = null; a.engaged = null; a.bob = null;
    this.splash(fx, 10);
    Sound.play('splash');
    const luck = st.luck + (a.baitUsed === 'glow' ? 0.3 : 0);
    const k = Math.pow(Math.random(), Math.max(0.4, 1.6 - luck));
    const cm = Math.round(lerp(sp.cm[0], sp.cm[1], k) * 10) / 10;
    const value = sp.junk ? sp.value : Math.max(1, Math.round(sp.value * (0.8 + 0.5 * k)));
    const rec = s.caught[sp.id] || { n: 0, best: 0 };
    const isNew = rec.n === 0, isRecord = !isNew && cm > rec.best;
    rec.n++; rec.best = Math.max(rec.best, cm);
    s.caught[sp.id] = rec;
    s.catches++;
    this.spotCatches++;
    s.bigChance = Math.min(0.5, s.bigChance + 0.05);
    const full = s.cooler.length >= coolerCap(s);
    if (!full) s.cooler.push({ id: sp.id, cm, value });
    this.questCatch(sp, cm);
    this.checkRows();
    writeSave();
    a.popup = { kind: 'catch', sp, cm, value, isNew, isRecord, full, wanted: s.wanted === sp.id };
    a.land = { sp, t: 0, sx: fx, sy: fy };
    a.state = 'land';
    if (full) Toasts.add('COOLER FULL! SELL FISH AT THE SHOP (B)', '#ffb0a0', 3, 150);
  },
  startYank(a) {
    this.yank = { t: 0, bi: a.reel.f.bi, tx: this.fishPos(a)[0], who: a.i, splashed: false };
    for (const o of this.anglers) { if (o.engaged && o !== a) { o.engaged.by = null; o.engaged.state = 'wander'; } o.state = 'yank'; o.bob = null; o.engaged = null; }
    a.reel = null;
    Toasts.add(this.anglers.length === 2 ? "WHOA!! IT'S PULLING US IN!" : "WHOA!! IT'S PULLING ME IN!", '#ffe14a', 2.5, 40);
    Sound.play('yank');
  },
  updateYank(dt) {
    const y = this.yank;
    y.t += dt;
    if (y.t < 0.5) Fx.shake = 3;
    if (y.t > 1.25 && !y.splashed) { y.splashed = true; Sound.play('bigsplash'); this.splash(y.tx, 30, true); Fx.shake = 5; }
    if (y.t > 1.7 && !Fx.busy()) { const bi = y.bi; writeSave(); Fx.transition(() => Game.setScene(FightScene, { boss: bi }), 2); }
  },

  // ---------- quests, journal rows ----------
  genQuest() {
    const s = Game.save;
    const spots = SPOTS.filter(sp => this.spotOpen(sp)).map(sp => sp.id);
    const pool = this.availableFish().filter(f => !f.junk);
    const greet = choice(['AHOY THERE, YOUNG ONE!', 'THE SEA PROVIDES, IF YOU ASK NICELY.', 'BACK IN MY DAY WE FISHED WITH OUR TEETH.', 'FANCY A LITTLE JOB?', 'ME KNEES SAY A STORM IS COMING...']);
    const r = Math.random();
    let q;
    if (r < 0.38) { const f = choice(pool.filter(f => !f.night)); const need = f.rare ? 1 : randi(2, 4); q = { type: 'catch', id: f.id, need, reward: 20 + Math.round(f.value * need * 1.5) }; }
    else if (r < 0.58) { const f = choice(pool.filter(f => !f.rare && !f.night)); q = { type: 'size', id: f.id, cm: Math.round(lerp(f.cm[0], f.cm[1], 0.6)), need: 1, reward: 40 + f.value * 3 }; }
    else if (r < 0.7) q = { type: 'night', need: 3, reward: 60, bait: 'glow' };
    else if (r < 0.82 && spots.length > 1) q = { type: 'spot', spot: choice(spots.filter(x => x !== 'pier')), need: 4, reward: 90 };
    else if (r < 0.9) q = { type: 'catch', id: 'boot', need: 1, reward: 45, boot: true };
    else q = { type: 'beast', need: 1, reward: 200 };
    return Object.assign(q, { n: 0, done: false, greet });
  },
  questDesc(q) {
    const nm = q.id && FISH_BY_ID[q.id].name;
    if (q.boot) return 'FIND ME AN OLD BOOT. I LOST MINE!';
    if (q.type === 'catch') return 'CATCH ' + q.need + ' ' + nm + (q.need > 1 ? ' (ANY SIZE)' : '');
    if (q.type === 'size') return 'CATCH A ' + nm + ' OVER ' + q.cm + ' CM';
    if (q.type === 'night') return 'CATCH 3 FISH AT NIGHT';
    if (q.type === 'spot') return 'CATCH 4 FISH AT ' + SPOT_BY_ID[q.spot].name;
    return 'DEFEAT ANY SEA BEAST';
  },
  questCatch(sp, cm) {
    const q = Game.save.quest;
    if (!q || q.done) return;
    let hit = false;
    if (q.type === 'catch') hit = sp.id === q.id;
    else if (q.type === 'size') hit = sp.id === q.id && cm >= q.cm;
    else if (q.type === 'night') hit = isNight(Game.save.dayTime);
    else if (q.type === 'spot') hit = this.spot === q.spot;
    if (hit) this.questEvent(q.type);
  },
  questEvent(type) {
    const q = Game.save.quest;
    if (!q || q.done || q.type !== type) return;
    q.n++;
    if (q.n >= q.need) { q.done = true; Sound.play('quest'); Toasts.add('QUEST DONE! TALK TO OLD SALT AT THE PIER (Q)', '#b8ffb0', 4, 150); }
  },
  journalRows() {
    const pier = FISH.filter(f => f.spot === 'pier'), far = FISH.filter(f => f.spot !== 'pier');
    return [0, 1, 2].map(i => ({ key: 'p' + i, ids: pier.slice(i * 5, i * 5 + 5).map(f => f.id) }))
      .concat(['wreck', 'ice', 'volcano'].map(sp => ({ key: sp, ids: far.filter(f => f.spot === sp).map(f => f.id) })));
  },
  checkRows() {
    const s = Game.save;
    for (const r of this.journalRows()) {
      if (s.rows.includes(r.key) || !r.ids.every(id => s.caught[id])) continue;
      s.rows.push(r.key);
      s.coins += 100;
      Sound.play('row');
      Toasts.add('JOURNAL ROW COMPLETE! +100 COINS', '#ffe14a', 4, 40);
      for (let i = 0; i < 30; i++) this.parts.add({ x: rand(0, W), y: -4, vx: rand(-20, 20), vy: rand(30, 70), life: 3, c: choice(['#ff5a7a', '#ffe14a', '#7ad0ff', '#8aff8a']), s: 2 });
    }
  },

  // ---------- overlays ----------
  shopItems() {
    const s = Game.save, tab = SHOP_TABS[this.tab], L = [];
    const buy = (cost, fn, name) => {
      if (s.coins < cost) { Sound.play('nope'); Toasts.add('NOT ENOUGH COINS', '#ffb0a0', 1.5, 160); return; }
      s.coins -= cost; fn(); writeSave(); Sound.play('coin'); Toasts.add('BOUGHT ' + name + '!', '#b8ffb0', 1.5, 160);
    };
    if (tab === 'BAIT') for (const it of SHOP_BAIT) {
      const bait = it.id === 'shrimp' || it.id === 'glow';
      L.push({ name: it.name, desc: it.desc, cost: it.cost, own: '(' + (bait ? s.bait[it.id] : s[it.id]) + ')', act: () => buy(it.cost, () => { if (bait) s.bait[it.id] += 5; else s[it.id]++; }, it.name) });
    }
    if (tab === 'GEAR') {
      for (const u of UPGRADES) {
        const lvl = s.up[u.id], max = lvl >= 3, cost = upgradeCost(u, lvl);
        L.push({ name: u.name + ' ' + '*'.repeat(lvl) + '-'.repeat(3 - lvl), desc: u.desc + (u.id === 'cooler' ? ' NOW: ' + coolerCap(s) : ''), cost: max ? null : cost, own: max ? 'MAX' : '', act: max ? null : () => buy(cost, () => s.up[u.id]++, u.name) });
      }
      L.push({ name: 'ROWBOAT', desc: s.boat ? 'ROW TO NEW SPOTS WITH T!' : s.rod < 1 ? 'BEAT OLD GNARLY TO UNLOCK.' : 'ROW TO FARAWAY FISHING SPOTS!', cost: s.boat ? null : BOAT_COST, own: s.boat ? 'OWNED' : '',
        act: s.boat ? null : () => { if (s.rod < 1) { Sound.play('nope'); Toasts.add('BEAT OLD GNARLY FIRST!', '#ffb0a0', 2, 160); return; } buy(BOAT_COST, () => { s.boat = true; Toasts.add('PRESS T TO TRAVEL!', '#ffe14a', 3, 40); }, 'A ROWBOAT'); } });
    }
    if (tab === 'STYLE') {
      for (const h of HATS) {
        const own = s.hats.includes(h.id);
        L.push({ name: h.name, desc: own ? (s.hat === h.id ? 'WEARING IT.' : 'PICK TO WEAR.') : 'LOOK SHARP ON THE PIER.', cost: own ? null : h.cost, own: s.hat === h.id ? 'WORN' : own ? 'OWNED' : '', swatch: h.hat,
          act: () => { const wear = () => { if (!s.hats.includes(h.id)) s.hats.push(h.id); s.hat = h.id; applyHat(h.id); writeSave(); }; if (own) { wear(); Sound.play('select'); } else buy(h.cost, wear, h.name); } });
      }
      for (const b of BOBBERS) {
        const own = s.bobbers.includes(b.id);
        L.push({ name: b.name, desc: own ? (s.bobber === b.id ? 'IN USE.' : 'PICK TO USE.') : 'A FRESH COAT OF PAINT.', cost: own ? null : b.cost, own: s.bobber === b.id ? 'IN USE' : own ? 'OWNED' : '', swatch: b.c,
          act: () => { const use = () => { if (!s.bobbers.includes(b.id)) s.bobbers.push(b.id); s.bobber = b.id; writeSave(); }; if (own) { use(); Sound.play('select'); } else buy(b.cost, use, b.name); } });
      }
    }
    if (tab === 'DECOR') for (const d of DECOR) {
      const own = s.decor.includes(d.id);
      L.push({ name: d.name, desc: own ? 'IN YOUR AQUARIUM (A).' : 'FOR YOUR AQUARIUM.', cost: own ? null : d.cost, own: own ? 'OWNED' : '', act: own ? null : () => buy(d.cost, () => s.decor.push(d.id), d.name) });
    }
    if (tab === 'SELL') {
      const total = s.cooler.reduce((a, f) => a + f.value * (f.id === s.wanted ? 2 : 1), 0);
      const w = FISH_BY_ID[s.wanted];
      L.push({ name: 'SELL ALL (' + s.cooler.length + '/' + coolerCap(s) + ')', desc: 'TODAY THE CAT WANTS ' + (w ? w.name : '?') + ': X2!', cost: null, own: '+' + total,
        act: s.cooler.length ? () => { s.coins += total; s.cooler = []; writeSave(); Sound.play('sell'); Toasts.add('SOLD! +' + total + ' COINS', '#ffe98a', 2, 160); } : null });
      const groups = {};
      for (const f of s.cooler) { const g = (groups[f.id] = groups[f.id] || { n: 0, v: 0 }); g.n++; g.v += f.value * (f.id === s.wanted ? 2 : 1); }
      for (const id in groups) L.push({ name: FISH_BY_ID[id].name + ' X' + groups[id].n, desc: id === s.wanted ? 'WANTED TODAY! DOUBLE PRICE.' : '', cost: null, own: '+' + groups[id].v, act: null, fish: id });
    }
    L.push({ name: 'LEAVE', desc: '', cost: null, own: '', act: () => { this.overlay = null; } });
    return L;
  },
  fillTank() {
    const s = Game.save;
    this.tank = FISH.filter(f => s.caught[f.id] && !f.junk).map(f => ({ sp: f, x: rand(40, 270), y: rand(40, 130), vx: rand(6, 14) * (Math.random() < 0.5 ? -1 : 1), ph: rand(0, 6) }));
  },
  updateOverlay(dt) {
    const s = Game.save, o = this.overlay, m = Input.mouse;
    const close = Input.hit('escape');
    if (o === 'shop') {
      const items = this.shopItems();
      if (Input.hit('arrowleft', 'a')) { this.tab = (this.tab + 4) % 5; this.sel = 0; Sound.play('move'); }
      if (Input.hit('arrowright', 'd')) { this.tab = (this.tab + 1) % 5; this.sel = 0; Sound.play('move'); }
      if (Input.hit('arrowup', 'w')) { this.sel = (this.sel + items.length - 1) % items.length; Sound.play('move'); }
      if (Input.hit('arrowdown', 's')) { this.sel = (this.sel + 1) % items.length; Sound.play('move'); }
      if (m.pressed) {
        SHOP_TABS.forEach((t, i) => { if (inRect(44 + i * 47, 30, 45, 10)) { this.tab = i; this.sel = 0; Sound.play('move'); } });
        const first = this.shopFirst(items.length);
        for (let i = 0; i < 7; i++) if (inRect(44, 44 + i * 15, 232, 14) && items[first + i]) { this.sel = first + i; if (items[this.sel].act) items[this.sel].act(); else Sound.play('nope'); }
        if (!inRect(36, 14, 248, 154)) this.overlay = null;
      }
      this.sel = Math.min(this.sel, items.length - 1);
      if (close || Input.hit('b')) { this.overlay = null; return; }
      if (Input.confirm()) { const it = items[this.sel]; if (it.act) it.act(); else Sound.play('nope'); }
    } else if (o === 'journal') {
      const cells = this.jpage === 2 ? 0 : 15;
      if (Input.hit('q', 'tab')) { this.jpage = (this.jpage + 1) % 3; Sound.play('move'); }
      if (cells) {
        if (Input.hit('arrowleft', 'a')) { this.jsel = (this.jsel + 14) % 15; Sound.play('move'); }
        if (Input.hit('arrowright', 'd')) { this.jsel = (this.jsel + 1) % 15; Sound.play('move'); }
        if (Input.hit('arrowup', 'w')) { this.jsel = (this.jsel + 10) % 15; Sound.play('move'); }
        if (Input.hit('arrowdown', 's')) { this.jsel = (this.jsel + 5) % 15; Sound.play('move'); }
        for (let i = 0; i < 15; i++) if (inRect(16 + (i % 5) * 32, 28 + Math.floor(i / 5) * 26, 30, 24) && (m.pressed || m.lastMove > performance.now() / 1000 - 0.05)) this.jsel = i;
      }
      if (m.pressed) ['PIER FISH', 'FARAWAY FISH', 'TROPHIES'].forEach((t, i) => { if (inRect(14 + i * 64, 12, 62, 10)) { this.jpage = i; Sound.play('move'); } });
      if (close || Input.hit('j', 'enter') || (m.pressed && !inRect(8, 8, 304, 164))) this.overlay = null;
    } else if (o === 'tank') {
      for (const f of this.tank) {
        f.x += f.vx * dt; f.ph += dt;
        f.y += Math.sin(f.ph * 1.3) * 4 * dt;
        if (f.x < 30 || f.x > 290) f.vx = -f.vx;
      }
      if (Math.random() < dt * 3) this.parts.add({ type: 'bubble', x: rand(30, 290), y: 150, vy: -rand(10, 20), life: 4, c: '#e8f8ff', s: 1, minY: 30 });
      if (close || Input.hit('a', 'enter', 'space') || m.pressed) this.overlay = null;
    } else if (o === 'travel') {
      if (Input.hit('arrowleft', 'a', 'arrowup', 'w')) { this.msel = (this.msel + 3) % 4; Sound.play('move'); }
      if (Input.hit('arrowright', 'd', 'arrowdown', 's')) { this.msel = (this.msel + 1) % 4; Sound.play('move'); }
      let go = Input.confirm();
      if (m.pressed) { let hit = false; this.mapPts().forEach(([x, y], i) => { if (dist(m.x, m.y, x, y) < 16) { hit = true; if (this.msel === i) go = true; this.msel = i; Sound.play('move'); } }); if (!hit && !inRect(24, 14, 272, 152)) this.overlay = null; }
      if (close || Input.hit('t')) { this.overlay = null; return; }
      if (go) {
        const sp = SPOTS[this.msel];
        if (!this.spotOpen(sp)) { Sound.play('nope'); Toasts.add(sp.need === 'boat' ? 'YOU NEED A ROWBOAT' : 'DEFEAT ' + BOSSES.find(b => b.id === sp.need).name + ' FIRST', '#ffb0a0', 2, 160); }
        else if (sp.id === this.spot) this.overlay = null;
        else { s.spot = sp.id; writeSave(); Sound.play('row2'); this.overlay = null; Fx.transition(() => Game.setScene(BeachScene, { travel: true }), 1.5); }
      }
    } else if (o === 'quest') {
      if (close || Input.confirm() || m.pressed) {
        const q = s.quest;
        if (q && q.done) {
          s.coins += q.reward;
          if (q.bait) s.bait[q.bait] += 3;
          s.questsDone++;
          Sound.play('coin');
          Toasts.add('REWARD: +' + q.reward + ' COINS' + (q.bait ? ' +3 GLOW BAIT' : ''), '#ffe98a', 3, 150);
          s.quest = this.genQuest();
          writeSave();
          this.questLine = 'AND ANOTHER THING...';
          return;
        }
        this.overlay = null;
      }
    } else if (o === 'rod' || o === 'charm') {
      if (Input.confirm() || m.pressed) {
        Sound.play('select');
        this.overlay = o === 'rod' && this.rodShown === RODS.length - 1 && !s.won ? 'ending' : null;
        if (this.overlay === 'ending') { s.won = true; writeSave(); Sound.play('win'); }
      }
    } else if (o === 'ending') {
      if (Input.confirm() || m.pressed) { this.overlay = null; Sound.play('select'); }
    }
  },

  // ---------- drawing ----------
  draw() {
    const s = Game.save, t = this.t, T = timeOfDay(s.dayTime), L = this.look, w = this.weather();
    if (L.sea) { T.sea = mix(T.sea, L.sea, L.seaK); T.seaD = mix(T.seaD, darken(L.sea, 0.5), L.seaK); }
    if (w.cloud) { T.cloud = mix(T.cloud, '#8a8a98', w.cloud * 0.6); T.cloudS = mix(T.cloudS, '#5a5a68', w.cloud * 0.6); }
    drawSky(T, HY, s.dayTime);
    if (L.sky) { G.globalAlpha = L.skyK; R(0, 0, W, HY, L.sky); G.globalAlpha = 1; }
    if (w.cloud > 0.5) { G.globalAlpha = (w.cloud - 0.5) * 0.6; R(0, 0, W, HY, '#4a4a58'); G.globalAlpha = 1; }
    const lights = drawSunMoon(s.dayTime, HY);
    this.amb.drawClouds(T);
    if (w.cloud > 0.4) for (const c of this.amb.clouds) drawCloud({ x: (c.x + 140) % (W + 60) - 30, y: c.y + 8, w: c.w, parts: c.parts }, T.cloud, T.cloudS);
    this.drawHorizon(T);
    drawFarSea(HY, WY, T, t, lights);
    if (this.spot !== 'volcano') this.amb.drawBirds(T.bird);

    // underwater cross-section
    for (let y = WY; y < H; y += 3) R(SHORE_X - 6, y, W, 3, mix(T.sea, T.seaD, (y - WY) / 60));
    G.drawImage(this.ground, 0, 0);
    this.drawKelp();
    if (this.spot === 'volcano') for (const x of [184, 258, 298]) { const y = seabedY(x); glow(x, y, 8, '#ff6a2a', 0.1 + Math.sin(t * 3 + x) * 0.04); if (Math.random() < 0.1) this.parts.add({ type: 'bubble', x, y: y - 2, vy: -20, life: 1.5, c: '#ffb08a', s: 1, minY: WY }); }
    const nightView = T.night > 0.5;
    for (const f of this.fish) {
      if (f.by && f.by.reel && f.by.reel.f === f) continue;
      const fr = Math.floor(f.anim) % 2;
      G.globalAlpha = nightView ? (f.boss ? 0.28 : 0.14) : f.boss ? 0.75 : 0.5;
      if (w.fog) G.globalAlpha *= 0.7;
      drawFish(f.sp, f.len, f.x, f.y, f.dir, fr, nightView ? 'w' : 's');
      if (f.boss && Math.sin(t * 3) > 0.3) { G.globalAlpha = 0.8; P(f.x + f.dir * f.len * 0.3, f.y - 2, '#ff5a5a'); }
      G.globalAlpha = 1;
      if (f.sp.glowy && nightView) glow(f.x, f.y, 6, f.sp.body, 0.12);
    }
    for (const a of this.anglers) if (a.reel) {
      const [fx, fy] = this.fishPos(a), f = a.reel.f;
      G.globalAlpha = 0.7; drawFish(f.sp, f.len, fx, fy, 1, Math.floor(t * 10) % 2, 's'); G.globalAlpha = 1;
    }
    G.globalAlpha = 0.45;
    for (let y = WY; y < H; y += 4) R(SHORE_X, y, W - SHORE_X, 4, mix(T.sea, T.seaD, (y - WY) / 60));
    G.globalAlpha = 0.06 * (1 - T.night) * (1 - w.cloud * 0.7);
    for (let i = 0; i < 4; i++) { const x0 = 150 + i * 45 + Math.sin(t * 0.5 + i) * 6; for (let y = WY; y < 170; y += 2) R(x0 + (y - WY) * 0.35, y, 8, 2, '#ffffff'); }
    G.globalAlpha = 1;
    const surf = mix(T.sea, '#ffffff', 0.45);
    for (let x = SHORE_X - 2; x < W; x++) P(x, WY + Math.round(Math.sin(x * 0.15 + t * 2) * (w.storm ? 1.4 : 0.6)), surf);
    for (let x = SHORE_X - 4; x < SHORE_X + 8; x++) if (Math.sin(x + t * 3) > 0) P(x + Math.round(Math.sin(t * 1.2) * 3), WY - 1, '#ffffff');
    if (this.spot === 'wreck') this.drawMast(t);
    if (this.spot === 'ice') for (const [x, wd] of [[236, 14], [290, 9], [160, 8]]) { const y = WY - 1 + Math.round(Math.sin(t + x) * 0.6); R(x, y, wd, 2, '#f4faff'); R(x + 1, y + 2, wd - 2, 2, '#b8d8e8'); }
    if (this.bottle) drawBottle(this.bottle.x, WY - 1 + Math.round(Math.sin(t * 2) * 0.8));

    const Ly = this.layout();
    if (Ly.boat) drawBoat(BOAT_X, WY + Ly.b, t); else this.drawPier(T);
    this.drawShore(T);
    drawCooler(Ly.cooler, Ly.fy, s.cooler.length / coolerCap(s));
    for (const a of this.anglers) this.drawAngler(a);
    if (Ly.boat && this.anglers.length === 1) drawCat(BOAT_X - 20, Ly.fy + 1, t, false);
    if (this.gull) drawGull(this.gull.x, this.gull.y, t, this.gull.carry);
    this.parts.draw();
    if (this.spot !== 'volcano') this.amb.drawBreeze();

    // time of day, weather, lights
    if (T.tintA > 0.01) { G.globalAlpha = T.tintA; R(0, HY, W, H - HY, T.tint); G.globalAlpha = 1; }
    if (w.storm) { G.globalAlpha = 0.18; R(0, 0, W, H, '#1a1a2a'); G.globalAlpha = 1; }
    if (this.spot === 'pier') { glow(90, 100, 26, '#ff9a3a', 0.05 + T.night * 0.08); if (T.night > 0.3 || T.tintA > 0.1) glow(102, DECK_Y - 16, 18, '#ffd76a', 0.06 + T.night * 0.08); }
    if (this.spot === 'volcano') { G.globalAlpha = 0.08; R(0, 0, W, H, '#ff4a1a'); G.globalAlpha = 1; }
    for (const a of this.anglers) if (a.bob && a.bob.landed && a.baitUsed === 'glow') glow(a.bob.x, a.bob.hy, 10, '#7ffff0', 0.15);
    this.wx.draw(s.weather.kind, t);

    this.drawHUD(T);
    for (const a of this.anglers) if (a.state === 'show' && a.popup) this.drawPopup(a);
    const ov = { shop: 'drawShop', journal: 'drawJournal', rod: 'drawRodBanner', charm: 'drawCharmBanner', ending: 'drawEnding', tank: 'drawTank', travel: 'drawTravel', quest: 'drawQuest' }[this.overlay];
    if (ov) this[ov]();
  },

  drawHorizon(T) {
    const t = this.t;
    if (this.spot === 'volcano') {
      for (let x = 190; x < 310; x++) { const h = Math.max(0, 46 - Math.abs(x - 250) * 0.85); R(x, HY - h, 1, h, mix('#3a2a30', T.top, 0.25)); }
      R(244, HY - 46, 12, 3, '#ff6a2a'); glow(250, HY - 46, 14, '#ff6a2a', 0.12);
      for (let i = 0; i < 3; i++) { const y = HY - 44 + i * 12, x = 248 - i * 3 + Math.round(Math.sin(t + i) * 1); R(x, y, 2, 10, '#ff5a1a'); }
      if (Math.random() < 0.15) this.parts.add({ type: 'puff', x: 250 + rand(-3, 3), y: HY - 48, vx: -rand(3, 8), vy: -rand(6, 12), life: 4, c: '#5a4a50', s: 2, grow: 1.5, a: 0.5 });
    } else if (this.spot === 'ice') {
      for (let x = 0; x < W; x++) { const h = 22 + Math.sin(x * 0.04) * 10 + Math.sin(x * 0.13 + 1) * 5; R(x, HY - h, 1, h, mix('#8aa0c0', T.top, 0.3)); if (h > 28) R(x, HY - h, 1, 3 + Math.round(Math.sin(x) * 1), '#ffffff'); }
    } else if (this.spot === 'wreck') {
      for (let x = 230; x < 300; x++) { const h = Math.max(0, 8 - Math.abs(x - 265) * 0.25); R(x, HY - h, 1, h, mix('#3a4a44', T.top, 0.3)); }
    }
  },
  drawMast(t) {
    const x = 266, sway = Math.round(Math.sin(t * 0.7) * 1);
    R(x, 60, 3, seabedY(x) - 60, '#4a3220');
    R(x - 14 + sway, 66, 30, 1, '#4a3220');
    for (let i = 0; i < 12; i++) { const wv = Math.round(Math.sin(t * 2 + i * 0.5) * 1.5); R(x - 12 + i * 2 + sway, 67, 2, 14 + wv - (i % 3), '#d8d0b8'); }
    R(x + 1, 52, 8, 5, '#2a2a2a'); P(x + 4, 54, '#ffffff'); P(x + 5, 55, '#ffffff');
  },
  drawKelp() {
    for (const [x, h] of [[152, 14], [226, 26], [240, 18], [296, 30]]) {
      const base = seabedY(x), c = this.look.kelp;
      for (let i = 0; i < h; i++) {
        const sw = Math.round(Math.sin(this.t * 1.5 + i * 0.25 + x) * (i / h) * 3);
        P(x + sw, base - i, i % 3 ? c : lighten(c, 0.2));
        if (i % 4 === 2) P(x + sw + 1, base - i, lighten(c, 0.35));
      }
    }
  },
  drawPier(T) {
    for (const px of [100, 130, 160, 190, 209]) {
      const bot = Math.round(seabedY(px));
      R(px, DECK_Y + 3, 3, bot - DECK_Y - 3, '#6b4428'); R(px, WY, 3, bot - WY, '#4a3020'); R(px, DECK_Y + 3, 1, WY - DECK_Y - 3, '#8a5a35');
    }
    R(PIER_X0, DECK_Y, PIER_X1 - PIER_X0, 3, '#8a5a35');
    R(PIER_X0, DECK_Y, PIER_X1 - PIER_X0, 1, '#b07a4c');
    R(PIER_X0, DECK_Y + 3, PIER_X1 - PIER_X0, 1, '#4a3020');
    for (let x = PIER_X0 + 4; x < PIER_X1; x += 6) P(x, DECK_Y + 1, '#5e3b22');
    R(PIER_X1 - 2, DECK_Y - 6, 2, 6, '#6b4428');
    R(97, DECK_Y - 20, 2, 20, '#5e3b22'); R(97, DECK_Y - 20, 6, 1, '#5e3b22');
    drawLantern(100, DECK_Y - 18, T.night > 0.3 || T.tintA > 0.1);
  },
  drawShore(T) {
    const t = this.t;
    if (this.spot === 'pier') {
      drawPalm(52, 108, t, 80);
      drawStall(4, 108, t);
      drawBarrel(56, 108);
      const q = Game.save.quest;
      drawSailor(75, 108, t, q && (q.done || q.n === 0));
      drawCampfire(90, 108, t);
      drawGrass(50, 108, t);
    } else if (this.spot === 'wreck') {
      drawPalm(20, 108, t, 60);
      drawBarrel(40, 108);
      R(60, 104, 22, 3, '#6a4a30'); R(64, 101, 3, 7, '#5a3a20'); pline(70, 107, 86, 100, '#6a4a30');
      R(88, 104, 7, 4, '#f0ead8'); P(89, 105, '#1a1a1a'); P(92, 105, '#1a1a1a'); R(89, 107, 5, 1, '#f0ead8');
    } else if (this.spot === 'ice') {
      for (const [x, h] of [[14, 30], [34, 40], [58, 26], [84, 20]]) {
        for (let i = 0; i < h; i++) { const wd = Math.round((i / h) * 8) + 1; R(x - wd, 108 - h + i, wd * 2, 1, i % 4 === 0 ? '#ffffff' : '#2a5a4a'); }
        R(x - 1, 108, 3, 2, '#4a3220');
      }
      pcircle(100, 108, 9, '#f4faff'); R(90, 108, 20, 3, T.bot); R(97, 102, 6, 6, '#8aa8c0'); pline(92, 104, 108, 104, '#c8dcea');
    } else if (this.spot === 'volcano') {
      for (const [x, r] of [[20, 10], [48, 7], [80, 8]]) { pcircle(x, 108, r, '#2a2228'); pcircle(x - 2, 106, r - 3, '#3a3036'); P(x + 2, 105, '#ff7a2a'); }
      for (let i = 0; i < 3; i++) { const x = 30 + i * 30; R(x, 108, 6, 1, Math.sin(t * 3 + i) > 0 ? '#ff7a2a' : '#ff4a1a'); }
    }
  },
  drawAngler(a) {
    const s = Game.save, rod = this.rod(), t = this.t, pal = a.i === 1 ? P2_PAL : PAL;
    if (this.yank) {
      const y = this.yank;
      const flyK = (y.t - 0.5 - (a.i !== y.who ? 0.25 : 0)) / 0.75;
      if (flyK < 0) {
        const lean = Math.round(Math.sin(y.t * 40));
        const hand = drawFisher(a.x + lean + Math.round(y.t * 6), a.y, 1, 'hold', { mouthOpen: true, pal });
        if (a.i === y.who) { const tip = drawRod(hand[0], hand[1], -0.2, 18, rod, 8); drawLine(tip[0], tip[1], y.tx, WY + 4, 0, '#e8e8f0'); }
      } else if (flyK < 1) {
        const x = lerp(a.x + 3, y.tx - a.i * 10, flyK), yy = lerp(a.y - 12, WY, flyK) - Math.sin(flyK * Math.PI) * 26;
        drawSwimmer(x, yy, 1, 0, false, flyK * 5, pal);
      }
      return;
    }
    const pose = a.state === 'charge' ? 'cast' : a.state === 'show' || a.state === 'land' ? 'cheer' : 'hold';
    const hand = drawFisher(a.x, a.y, 1, pose, { blink: Math.sin(t * 1.3 + a.i) > 0.97, mouthOpen: a.state === 'show', pal });
    if (pose === 'cheer') {
      if (a.state === 'land') {
        const Ld = a.land, k = Math.min(1, Ld.t / 0.7);
        drawFish(Ld.sp, Ld.sp.len, lerp(Ld.sx, a.x + 4, k), lerp(Ld.sy, a.y - 30, k) - Math.sin(k * Math.PI) * 30, 1, Math.floor(t * 10) % 2);
      } else if (a.popup && a.popup.kind === 'catch') drawFish(a.popup.sp, a.popup.sp.len, a.x, a.y - 32 + Math.round(Math.sin(t * 4)), 1, Math.floor(t * 6) % 2);
      else if (a.popup) drawBottle(a.x, a.y - 30);
      return;
    }
    let ang = -1.0, bend = 0;
    if (a.state === 'charge') ang = lerp(-1.3, -2.6, a.power);
    else if (a.state === 'fly') ang = -0.55;
    else if (a.state === 'wait') ang = -0.8 + (a.bob && a.bob.dip > 3 ? 0.25 : 0);
    else if (a.state === 'reel') { ang = -0.55; bend = (a.reel.tension / 100) * 9; }
    const tip = drawRod(hand[0], hand[1], ang, pose === 'cast' ? 16 : 20, rod, bend);
    a.tip = tip;
    const lineCol = 'rgba(240,240,255,0.75)', bc = (BOBBERS.find(b => b.id === s.bobber) || BOBBERS[0]).c;
    if (a.bob && a.state !== 'reel') {
      const b = a.bob;
      if (a.state === 'fly') { drawLine(tip[0], tip[1], b.x, b.y, 4, lineCol); R(b.x - 1, b.y, 3, 2, bc); R(b.x - 1, b.y + 2, 3, 1, '#ffffff'); }
      else {
        const by = WY - 2 + b.dip + (b.dip ? 0 : Math.round(Math.sin(t * 3 + a.i) * 0.6));
        drawLine(tip[0], tip[1], b.x, by, 7, lineCol);
        G.globalAlpha = 0.35; pline(b.x, by + 2, b.x, b.hy, '#ffffff'); G.globalAlpha = 1;
        const bait = BAITS.find(x => x.id === a.baitUsed) || BAITS[0];
        R(b.x - 1, b.hy, 2, 2, bait.color); P(b.x + 1, b.hy + 1, '#aab4c0');
        if (b.dip < 4) { R(b.x - 1, by, 3, 2, bc); R(b.x - 1, by + 2, 3, 1, '#ffffff'); P(b.x, by - 1, '#2a2a2a'); }
      }
    }
    if (a.reel) { const [fx, fy] = this.fishPos(a); drawLine(tip[0], tip[1], fx + 4, fy, 0, lineCol); }
    if (a.engaged && a.engaged.state === 'bite' && a.state === 'wait') drawText('!', a.x - 1, a.y - 36 - Math.round(Math.abs(Math.sin(t * 14)) * 2), '#ffe14a', { scale: 2, outline: '#3a1a1a' });
    if (a.state === 'charge') {
      const bx = a.x - 16, by = a.y - 42;
      bar(bx, by, 32, 4, a.power, mix('#7ae07a', '#ff5a3a', a.power));
      drawText('POWER', a.x, by - 7, '#ffffff', { align: 'center', outline: '#1a0f14' });
    }
    if (this.anglers.length === 2 && a.state !== 'charge') drawText('P' + (a.i + 1), a.x, a.y - 34, a.i ? '#9aff8a' : '#9ad8ff', { align: 'center', outline: '#1a0f14' });
  },

  drawHUD(T) {
    const s = Game.save, rod = this.rod(), q = s.quest;
    G.globalAlpha = 0.55; R(2, 2, 96, q ? 47 : 38, '#1a0f14'); G.globalAlpha = 1;
    iconCoin(5, 5); drawText(s.coins, 12, 5, '#ffe98a');
    drawCooler(62, 11, 0); drawText(s.cooler.length + '/' + coolerCap(s), 73, 5, s.cooler.length >= coolerCap(s) ? '#ff8a8a' : '#d8e8ff');
    iconRod(5, 13, rod); drawText(rod.name, 16, 14, '#ffffff');
    const bc = BAITS.find(b => b.id === s.baitSel);
    R(6, 23, 3, 3, bc.color);
    drawText(bc.name + (s.baitSel === 'worm' ? '' : ' X' + s.bait[s.baitSel]), 12, 22, '#d8e8ff');
    const wanted = FISH_BY_ID[s.wanted];
    drawText('WANTED:' + (wanted ? wanted.name : '-'), 5, 31, '#ffd0a0');
    if (q) {
      const txt = (q.done ? 'DONE! SEE OLD SALT' : this.questDesc(q) + ' ' + q.n + '/' + q.need);
      drawText(wrapText(txt, 23)[0] + (wrapText(txt, 23).length > 1 ? '..' : ''), 5, 40, q.done ? '#b8ffb0' : '#c8b8ff');
    }
    const night = isNight(s.dayTime);
    if (night) iconMoon(122, 8); else iconSun(122, 8);
    drawText('DAY ' + s.day, 130, 4, '#ffffff', { outline: '#1a0f14' });
    drawText(SPOT_BY_ID[this.spot].name, 130, 11, '#ffe9b0', { outline: '#1a0f14' });
    drawText(this.weather().name, 130, 18, '#c8dcff', { outline: '#1a0f14' });
    if (this.frenzy > 0) drawText('FRENZY ' + Math.ceil(this.frenzy), 130, 25, Math.sin(this.t * 10) > 0 ? '#ffe14a' : '#ff9a3a', { outline: '#1a0f14' });
    if (s.map) drawText('TREASURE MAP!', 130, 32, '#ffe14a', { outline: '#1a0f14' });
    for (const b of this.buttons()) {
      const hov = inRect(b.x, b.y, b.w, b.h);
      R(b.x, b.y, b.w, b.h, '#2e1c12'); R(b.x + 1, b.y + 1, b.w - 2, b.h - 2, hov ? '#b07a4c' : '#8a5a35'); R(b.x + 1, b.y + 1, b.w - 2, 1, '#c89060');
      drawIcon(b.icon, b.x + 3, b.y + 2);
      drawText(b.label, b.x + 13, b.y + 3, '#fff1c8');
    }
    const a0 = this.anglers[0], two = this.anglers.length === 2;
    const hints = {
      idle: two ? 'P1: HOLD SPACE   P2: HOLD ENTER   TO CAST' : 'HOLD SPACE TO CAST   1-3 BAIT   Q QUEST   ESC MENU',
      charge: 'RELEASE TO CAST!',
      wait: a0.engaged && a0.engaged.state === 'bite' ? 'PRESS NOW!!' : 'WAIT FOR A BITE...  (PRESS TO REEL IN)',
      reel: a0.reel && a0.reel.boss ? 'HOLD ON!!!' : 'HOLD TO REEL - LET GO IF TENSION GETS HIGH',
    };
    const h = two ? hints.idle : hints[a0.state];
    if (h && !this.overlay && !this.yank) drawText(h, W / 2, 172, h === 'PRESS NOW!!' ? '#ffe14a' : 'rgba(255,255,255,0.85)', { align: 'center', outline: '#1a0f14' });
    for (const a of this.anglers) if (a.state === 'reel') this.drawReelUI(a);
  },
  drawReelUI(a) {
    const r = a.reel, two = this.anglers.length === 2;
    const x = two ? (a.i === 0 ? 180 : 110) : 100, y = two ? 56 + a.i * 34 : 58;
    G.globalAlpha = 0.7; R(x - 6, y - 8, 132, 32, '#1a0f14'); G.globalAlpha = 1;
    drawText((two ? 'P' + (a.i + 1) + ' ' : '') + 'TENSION', x, y - 6, '#ffffff');
    R(x - 1, y - 1, 122, 7, '#1a0f14');
    for (let i = 0; i < 120; i++) R(x + i, y, 1, 5, i < 70 ? '#3a5a3a' : i < 100 ? '#6a5a2a' : '#6a2a2a');
    const danger = r.tension > 80;
    R(x, y, Math.round(r.tension * 1.2), 5, danger && Math.sin(this.t * 30) > 0 ? '#ffffff' : mix('#7ae07a', '#ff4a3a', r.tension / 100));
    drawText('LINE', x, y + 9, '#ffffff');
    R(x + 18, y + 11, 102, 1, '#8a8aa0');
    const fx = x + 18 + Math.round(clamp(r.dist, 0, 100));
    if (r.thrash) drawText('!', fx, y + 3, '#ffe14a');
    R(fx - 1, y + 10, 3, 3, r.thrash ? '#ff7a5a' : '#9fd8ff');
  },
  drawPopup(a) {
    const p = a.popup, two = this.anglers.length === 2;
    const x = two ? (a.i === 0 ? 150 : 10) : 70, y = 50, w = two ? 160 : 180, h = 100;
    panel(x, y, w, h);
    const cx = x + w / 2;
    if (p.kind === 'bottle') {
      drawText('MESSAGE IN A BOTTLE', cx, y + 8, '#8a5a35', { align: 'center' });
      drawBottle(cx, y + 26);
      p.lines.forEach((l, i) => drawText(l, cx, y + 40 + i * 10, '#4a2e1c', { align: 'center' }));
      drawText(two ? '' : 'SPACE', cx, y + h - 11, '#a08060', { align: 'center' });
      return;
    }
    drawText((two ? 'P' + (a.i + 1) + ' ' : '') + 'CAUGHT', cx, y + 7, '#8a5a35', { align: 'center' });
    drawText(p.sp.name, cx, y + 15, '#4a2e1c', { align: 'center', scale: p.sp.name.length > 11 || two ? 1 : 2 });
    const img = fishSprite(p.sp, p.sp.len, 0);
    const sc = Math.max(1, Math.min(4, Math.floor(60 / img.width)));
    blit(img, cx - (img.width * sc) / 2, y + 44 - (img.height * sc) / 2 + Math.round(Math.sin(this.t * 3)), false, sc);
    drawText(p.cm + ' CM', x + 12, y + 70, '#4a2e1c');
    iconCoin(x + 12, y + 79); drawText('WORTH ' + p.value * (p.wanted ? 2 : 1) + (p.wanted ? ' WANTED!' : ''), x + 19, y + 79, '#8a6a10');
    drawText(p.full ? 'COOLER FULL: RELEASED' : 'INTO THE COOLER', x + 12, y + 88, p.full ? '#b04030' : '#6a8aa0');
    const stars = p.sp.junk ? 0 : p.sp.rare ? 3 : p.sp.value >= 15 ? 2 : 1;
    for (let i = 0; i < stars; i++) iconStar(x + w - 18 - i * 7, y + 70);
    if (p.isNew) drawText('NEW!', x + w - 12, y + 80, Math.sin(this.t * 8) > 0 ? '#e0402a' : '#ff9a3a', { align: 'right' });
    else if (p.isRecord) drawText('RECORD!', x + w - 12, y + 80, '#2a8a3a', { align: 'right' });
  },
  shopFirst(n) { return clamp(this.sel - 3, 0, Math.max(0, n - 7)); },
  drawShop() {
    const s = Game.save, items = this.shopItems();
    G.globalAlpha = 0.5; R(0, 0, W, H, '#0d0a14'); G.globalAlpha = 1;
    panel(36, 14, 248, 154);
    drawText('THE CAT\'S SHOP', 46, 20, '#4a2e1c');
    drawCat(160, 28, this.t, true);
    iconCoin(236, 20); drawText(s.coins, 243, 20, '#8a6a10');
    SHOP_TABS.forEach((tb, i) => {
      const x = 44 + i * 47, on = i === this.tab;
      R(x, 30, 45, 10, on ? '#a0301f' : '#d8bc88');
      drawText(tb, x + 22, 32, on ? '#fff1c8' : '#6a4a2e', { align: 'center' });
    });
    const first = this.shopFirst(items.length);
    for (let i = 0; i < 7; i++) {
      const it = items[first + i];
      if (!it) break;
      const y = 44 + i * 15, sel = first + i === this.sel;
      if (sel) R(42, y - 2, 236, 14, '#e6cfa0');
      let nx = 46;
      if (it.swatch) { R(46, y, 5, 5, it.swatch); nx = 54; }
      if (it.fish) { drawFish(FISH_BY_ID[it.fish], FISH_BY_ID[it.fish].len, 50, y + 5, 1, 0); nx = 60; }
      drawText(it.name, nx, y, sel ? '#a0301f' : '#4a2e1c');
      drawText(it.desc, nx, y + 6, '#8a6a4a');
      if (it.cost != null) { iconCoin(250, y); drawText(it.cost, 257, y, s.coins >= it.cost ? '#6a5010' : '#b04030'); }
      else if (it.own) drawText(it.own, 274, y, it.own[0] === '+' ? '#6a8a10' : '#6a8aa0', { align: 'right' });
      if (it.cost != null && it.own) drawText(it.own, 246, y, '#8a7a60', { align: 'right' });
    }
    if (items.length > 7) drawText((first > 0 ? '^ ' : '') + (first + 7 < items.length ? 'V MORE' : ''), 274, 150, '#a08060', { align: 'right' });
    drawText('ARROWS: TAB / ITEM   SPACE: BUY   ESC: LEAVE', W / 2, 158, '#a08060', { align: 'center' });
  },
  drawJournal() {
    const s = Game.save;
    G.globalAlpha = 0.5; R(0, 0, W, H, '#0d0a14'); G.globalAlpha = 1;
    panel(8, 8, 304, 164);
    ['PIER FISH', 'FARAWAY FISH', 'TROPHIES'].forEach((tb, i) => {
      const on = i === this.jpage;
      R(14 + i * 64, 12, 62, 10, on ? '#a0301f' : '#d8bc88');
      drawText(tb, 45 + i * 64, 14, on ? '#fff1c8' : '#6a4a2e', { align: 'center' });
    });
    drawText(FISH.filter(f => s.caught[f.id]).length + '/' + FISH.length + ' FISH', 304, 14, '#8a6a4a', { align: 'right' });
    if (this.jpage === 2) return this.drawTrophies();
    const list = this.jpage === 0 ? FISH.filter(f => f.spot === 'pier') : FISH.filter(f => f.spot !== 'pier');
    const rows = this.journalRows().slice(this.jpage * 3, this.jpage * 3 + 3);
    list.forEach((f, i) => {
      const cx = 16 + (i % 5) * 32, cy = 28 + Math.floor(i / 5) * 26;
      const sel = i === this.jsel, c = s.caught[f.id];
      R(cx, cy, 30, 24, sel ? '#e6cfa0' : '#ecdab4');
      if (sel) { R(cx, cy, 30, 1, '#a0301f'); R(cx, cy + 23, 30, 1, '#a0301f'); R(cx, cy, 1, 24, '#a0301f'); R(cx + 29, cy, 1, 24, '#a0301f'); }
      if (!c) G.globalAlpha = 0.35;
      drawFish(f, f.len, cx + 15, cy + 12, 1, 0, c ? 'c' : 's');
      G.globalAlpha = 1;
      if (c && f.rare) iconStar(cx + 24, cy + 2);
      if (f.id === s.wanted) drawText('$', cx + 2, cy + 2, '#a0301f');
    });
    rows.forEach((r, i) => {
      const y = 36 + i * 26;
      if (this.jpage === 1) drawText(SPOT_BY_ID[r.key].name.split(' ')[0], 178, y, '#8a6a4a');
      if (s.rows.includes(r.key)) iconStar(this.jpage === 1 ? 222 : 180, y);
    });
    const f = list[this.jsel], c = s.caught[f.id];
    drawText(c ? f.name : '???', 16, 110, '#4a2e1c');
    drawText(f.hint, 16, 119, '#8a6a4a');
    if (c) { drawText('CAUGHT: ' + c.n + '   BEST: ' + c.best + ' CM', 16, 129, '#4a2e1c'); iconCoin(16, 138); drawText('~' + f.value + (f.id === s.wanted ? '  WANTED TODAY: X2!' : ''), 23, 138, '#8a6a10'); }
    else drawText(f.tier > s.rod ? 'NEEDS A BETTER ROD' : f.spot !== 'pier' && !this.spotOpen(SPOT_BY_ID[f.spot]) ? 'FOUND AT A FARAWAY SPOT' : 'NOT CAUGHT YET', 16, 129, '#b06040');
    drawText('A FULL ROW = +100 COINS', 16, 150, '#8a6a4a');
    drawText('TAB: PAGE   ESC: CLOSE', 304, 162, '#a08060', { align: 'right' });
  },
  drawTrophies() {
    const s = Game.save;
    drawText('RODS', 18, 28, '#4a2e1c');
    RODS.forEach((r, i) => {
      const y = 37 + i * 10, own = i <= s.rod;
      if (own) iconRod(18, y - 1, r); else drawText('?', 21, y, '#b0a080');
      drawText(own ? r.name : '???', 30, y + 1, i === s.rod ? '#a0301f' : own ? '#4a2e1c' : '#b0a080');
    });
    drawText('CHARMS', 18, 102, '#4a2e1c');
    CHARMS.forEach((c, i) => {
      const y = 113 + i * 15, own = s.charms[i];
      if (own) drawCharm(i, 22, y + 2); else drawText('?', 20, y, '#b0a080');
      drawText(own ? c.name : '???', 30, y - 2, own ? '#4a2e1c' : '#b0a080');
      if (own) drawText(c.desc, 30, y + 4, '#8a6a4a');
    });
    drawText('SEA BEASTS', 170, 28, '#4a2e1c');
    BOSSES.forEach((b, i) => {
      const y = 38 + i * 11, beat = s.bosses.includes(b.id);
      if (beat) iconStar(170, y - 1);
      drawText(beat ? b.name : '???', 178, y, beat ? '#2a6a3a' : '#8a6a4a');
      drawText(SPOT_BY_ID[b.spot].name.split(' ')[0], 300, y, '#b0a080', { align: 'right' });
    });
    drawText('DAYS: ' + s.day + '   CATCHES: ' + s.catches + '   QUESTS: ' + s.questsDone, 170, 134, '#4a2e1c');
    drawText('BEAST TROPHIES: ' + s.bosses.length + '/' + BOSSES.length, 170, 144, '#4a2e1c');
  },
  drawTank() {
    const s = Game.save, t = this.t;
    G.globalAlpha = 0.5; R(0, 0, W, H, '#0d0a14'); G.globalAlpha = 1;
    panel(8, 8, 304, 164);
    drawText('YOUR AQUARIUM', 18, 14, '#4a2e1c');
    drawText(this.tank.length + ' FISH', 302, 14, '#8a6a4a', { align: 'right' });
    R(18, 24, 284, 134, '#1a2a3a');
    for (let y = 25; y < 157; y += 3) R(19, y, 282, 3, mix('#5ac0e8', '#1a5a8a', (y - 25) / 132));
    for (let x = 19; x < 301; x++) { const h = 6 + Math.round(Math.sin(x * 0.3) * 1.5); R(x, 157 - h, 1, h, hash(x, 3) < 0.5 ? '#d8c090' : '#b8a070'); }
    const spots = { castle: 40, plants: 90, treasure: 150, diver: 210, duck: 260 };
    for (const d of s.decor) if (d === 'duck') drawDecor(d, 260, 30, t); else drawDecor(d, spots[d], 150, t);
    for (const f of this.tank) drawFish(f.sp, f.sp.len, f.x, f.y, f.vx > 0 ? 1 : -1, Math.floor(t * 4 + f.ph) % 2);
    this.parts.draw();
    G.globalAlpha = 0.15; R(22, 28, 6, 120, '#ffffff'); G.globalAlpha = 1;
    if (!this.tank.length) drawText('CATCH SOME FISH TO FILL IT!', W / 2, 80, '#ffffff', { align: 'center', outline: '#1a2a3a' });
    if (!s.decor.length) drawText('BUY DECORATIONS AT THE SHOP', W / 2, 30, '#d8f4ff', { align: 'center' });
  },
  mapPts() { return [[70, 120], [130, 64], [210, 50], [252, 118]]; },
  drawTravel() {
    const s = Game.save, t = this.t, pts = this.mapPts();
    G.globalAlpha = 0.5; R(0, 0, W, H, '#0d0a14'); G.globalAlpha = 1;
    panel(24, 14, 272, 152, '#f0dca0');
    R(30, 22, 260, 124, '#8ac8d8');
    for (let i = 0; i < 40; i++) R(30 + hash(i, 1) * 250, 22 + hash(i, 2) * 120, 4, 1, '#a8dce8');
    for (let i = 0; i < 3; i++) { const [a, b] = [pts[i], pts[i + 1]]; for (let k = 0; k < 1; k += 0.06) P(lerp(a[0], b[0], k), lerp(a[1], b[1], k), '#6a4a2e'); }
    SPOTS.forEach((sp, i) => {
      const [x, y] = pts[i], open = this.spotOpen(sp), sel = i === this.msel;
      pcircle(x, y + 3, 13, '#e8d098'); pcircle(x, y + 2, 11, open ? ['#7ab860', '#8a9a7a', '#f4faff', '#4a3a40'][i] : '#a0a0a0');
      if (open) {
        if (i === 0) { R(x - 1, y - 8, 2, 8, '#8a6038'); pcircle(x, y - 9, 3, '#3d9142'); }
        if (i === 1) { R(x, y - 10, 2, 12, '#4a3220'); R(x - 4, y - 8, 10, 5, '#d8d0b8'); }
        if (i === 2) { for (let k = 0; k < 8; k++) R(x - k, y - 6 + k, k * 2, 1, '#ffffff'); }
        if (i === 3) { for (let k = 0; k < 8; k++) R(x - k, y - 6 + k, k * 2, 1, '#3a2a30'); P(x, y - 7, '#ff6a2a'); glow(x, y - 7, 5, '#ff6a2a', 0.2); }
      } else drawText('?', x - 1, y - 1, '#ffffff', { scale: 2, outline: '#4a4a4a' });
      if (sp.id === this.spot) drawBoat(x + 12, y + 14, t);
      if (sel) pring(x, y + 2, 15 + Math.round(Math.sin(t * 6)), '#a0301f');
      drawText(open ? sp.name : '???', x, y + 18, sel ? '#a0301f' : '#4a2e1c', { align: 'center' });
    });
    const sp = SPOTS[this.msel];
    drawText(this.spotOpen(sp) ? sp.desc : sp.need === 'boat' ? 'BUY A ROWBOAT FIRST.' : 'DEFEAT ' + BOSSES.find(b => b.id === sp.need).name + ' TO FIND THIS PLACE.', W / 2, 150, '#4a2e1c', { align: 'center' });
    drawText('ARROWS + SPACE TO ROW THERE   ESC: CLOSE', W / 2, 158, '#8a6a4a', { align: 'center' });
  },
  drawQuest() {
    const s = Game.save, q = s.quest;
    G.globalAlpha = 0.5; R(0, 0, W, H, '#0d0a14'); G.globalAlpha = 1;
    panel(30, 40, 260, 96);
    G.save(); G.translate(40, 44); G.scale(2, 2); drawSailor(14, 38, this.t, false); G.restore();
    drawText('OLD SALT', 96, 48, '#a0301f');
    const lines = wrapText(this.questLine || '', 38);
    lines.forEach((l, i) => drawText(l, 96, 58 + i * 8, '#4a2e1c'));
    const y = 60 + lines.length * 8 + 4;
    if (q) {
      drawText('QUEST:', 96, y, '#8a5a35');
      wrapText(this.questDesc(q), 38).forEach((l, i) => drawText(l, 96, y + 8 + i * 8, '#4a2e1c'));
      drawText('PROGRESS: ' + Math.min(q.n, q.need) + '/' + q.need, 96, y + 26, q.done ? '#2a8a3a' : '#6a4a2e');
      iconCoin(190, y + 26); drawText(q.reward + (q.bait ? ' +GLOW BAIT' : ''), 197, y + 26, '#8a6a10');
    }
    drawText(q && q.done ? 'SPACE: CLAIM REWARD' : 'SPACE: OK', 280, 126, '#a0301f', { align: 'right' });
    drawText('QUESTS DONE: ' + s.questsDone, 40, 126, '#8a6a4a');
  },
  drawRodBanner() {
    const r = RODS[this.rodShown];
    G.globalAlpha = 0.55; R(0, 0, W, H, '#0d0a14'); G.globalAlpha = 1;
    panel(60, 26, 200, 128);
    drawText('NEW ROD!', W / 2, 34, '#a0301f', { align: 'center', scale: 2 });
    glow(W / 2, 65, 16, r.color, 0.18);
    G.save(); G.translate(W / 2 - 14, 51); G.scale(2, 2); iconRod(0, 0, r, true); G.restore();
    drawText(r.name, W / 2, 86, '#4a2e1c', { align: 'center' });
    const lines = ['REEL SPEED X' + r.reel, 'LINE STRENGTH X' + r.line, 'LUCK +' + Math.round(r.luck * 100) + '%', 'HOOK DAMAGE ' + r.dmg, 'SPECIAL: ' + r.special];
    lines.forEach((l, i) => drawText(l, W / 2, 96 + i * 8, i === 4 ? '#2a6a8a' : '#6a4a2e', { align: 'center' }));
    drawText('SPACE', W / 2, 143, '#a08060', { align: 'center' });
  },
  drawCharmBanner() {
    const c = CHARMS[this.charmShown];
    G.globalAlpha = 0.55; R(0, 0, W, H, '#0d0a14'); G.globalAlpha = 1;
    panel(60, 36, 200, 100);
    drawText('NEW CHARM!', W / 2, 44, '#a0301f', { align: 'center', scale: 2 });
    glow(W / 2, 74, 16, c.color, 0.2);
    G.save(); G.translate(W / 2, 74); G.scale(2, 2); drawCharm(this.charmShown, 0, 0); G.restore();
    drawText(c.name, W / 2, 94, '#4a2e1c', { align: 'center' });
    drawText(c.desc, W / 2, 104, '#2a6a8a', { align: 'center' });
    drawText('ALWAYS ACTIVE. SPACE', W / 2, 124, '#a08060', { align: 'center' });
  },
  drawEnding() {
    G.globalAlpha = 0.6; R(0, 0, W, H, '#0d0a14'); G.globalAlpha = 1;
    panel(40, 30, 240, 120, '#fff0d0');
    drawText('LEGEND OF THE SEA', W / 2, 40, '#a0301f', { align: 'center', scale: 2 });
    const lines = ['THE KRAKEN IS BEATEN AND THE TRIDENT IS YOURS.', 'BUT THE SEA IS BIG...', '', 'ROW TO FARAWAY SPOTS (T) TO FIND NEW', 'FISH AND THREE MORE SEA BEASTS.', 'OLD BEASTS MAY RETURN - WITH TREASURE!'];
    lines.forEach((l, i) => drawText(l, W / 2, 62 + i * 9, '#4a2e1c', { align: 'center' }));
    for (let i = 0; i < 5; i++) iconStar(W / 2 - 16 + i * 7, 122 + Math.round(Math.sin(this.t * 4 + i)));
    drawText('SPACE', W / 2, 138, '#a08060', { align: 'center' });
  },
};
