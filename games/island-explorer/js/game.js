'use strict';
// Core: game loop, player movement & sailing, interactions, crafting, rendering.
const TS = 16;
const DIRV = [[0, 1], [0, -1], [-1, 0], [1, 0]]; // down, up, left, right
const STEP = 1 / 60;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const mod = (a, n) => ((a % n) + n) % n;
// which neighbouring ground types spill a soft edge onto which ground
// things you can place in build mode [B]
const BUILDABLES = [
  { key: 'wwall', tile: T.WALL_WOOD, name: 'Wood Wall' },
  { key: 'swall', tile: T.WALL_STONE, name: 'Stone Wall' },
  { key: 'wgate', tile: T.WGATE, name: 'Gate' },
  { key: 'fire', tile: T.CAMPFIRE, name: 'Campfire' },
];
const WEAPON_DMG = [1, 2, 3, 5], WEAPON_REACH = [11, 15, 14, 16];
const SOFT_EDGES = { s: ['g', 'j', 'n', 'm'], p: ['g', 'j'], g: ['j', 'm'], j: ['m'] };
function tileHash(x, y) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

const Game = {
  state: 'title', vw: 384, vh: 224, time: 0, playTime: 0, acc: 0,
  mobs: [], npcs: [], bottles: [], sharks: [], bosses: [], activeBoss: null, building: null, cat: null, trail: [], craftSel: 0, nightSpawnT: 10, coldWarned: false,
  regrow: [], hits: new Map(), shake: new Map(),
  target: null, buffer: null, blockedT: 0, hintCD: 0, curIsland: 0, flash: 0, hitStop: 0,
  lastFoot: -1, cpIndex: -1, stepDist: 0, autosaveT: 60, envT: 0, seaFrac: 0,
  cam: { x: 0, y: 0 }, snapCam: true,
  stats: { kills: 0, shells: 0, chopped: 0, deaths: 0, relics: 0, bottles: 0, fish: 0, gold: 0, crates: 0 },
  flags: { raft: false, sailboat: false, axe: 0, pick: 0, weapon: 0, armor: false, rod: false, shovel: false,
           spyglass: false, compass: false, torch: false, bridge: false, bridgeSeen: false,
           metHermit: false, gotKey: false, chestSeen: false, won: false, hungerWarned: false,
           catFound: false, catHome: false, catKnown: false, relicHint: false, visited: {} },
  inv: { wwall: 0, swall: 0, wgate: 0, fire: 0, wood: 0, vine: 0, rope: 0, stone: 0, iron: 0, hide: 0, gold: 0, fish: 0, meat: 0, cooked: 0, bandage: 0, key: 0, sailcloth: 0 },

  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    Sprites.build();
    BossArt.build();
    World.generate();
    FX.init();
    Input.init(a => this.onAction(a));
    UI.init();
    Settings.load(); Settings.apply();
    Menu.init();

    const s = World.points.start;
    this.player = {
      x: s.x * TS + 8, y: s.y * TS + 4, vx: 0, vy: 0, dir: 1, anim: 0, mode: 'walk', boatFace: 1,
      hp: 100, maxHp: 100, food: 100, inv: 0, kx: 0, ky: 0, attackT: 0, actT: 0, rollT: 0, rollCD: 0,
      sprites: Sprites.charSet({ skin: '#f1c27d', hair: '#6b3e1f', shirt: '#d94f3d', pants: '#3a5a8c', torn: true }),
    };
    this.checkpoint = { x: this.player.x, y: this.player.y };
    for (const m of World.mobSpawns) this.mobs.push(new Mob(m.kind, m.x, m.y));
    for (const n of World.npcSpawns) this.npcs.push(new NPC(n));
    this.cat = new Cat(World.points.cat.x, World.points.cat.y);
    this.bosses = World.bossSpawns.map(b => new Boss(b.kind, b.x * TS + 8, b.y * TS + 8));
    this.bottles = World.bottles.map(b => ({ id: b.id, x: b.x * TS + 8, y: b.y * TS + 8, taken: false }));

    this.resize();
    addEventListener('resize', () => this.resize());
    this.last = performance.now();
    requestAnimationFrame(t => this.loop(t));
  },

  diffKey: 'normal', combo: 0, comboT: 0, heartT: 0, titleT: 0,
  get diff() { return DIFFICULTY[this.diffKey] || DIFFICULTY.normal; },
  newGame(diffKey = 'normal') { if (this.state !== 'title') return; Save.clear(); this.diffKey = diffKey; this.start(false); },
  continueGame() {
    if (this.state !== 'title') return;
    if (!Save.load()) return this.newGame();
    this.start(true);
  },

  start(cont) {
    Sound.init();
    UI.title.classList.add('hidden');
    UI.hud.classList.remove('hidden');
    this.state = 'play';
    this.snapCam = true;
    for (const b of this.bosses) b.defeated = !!this.flags['boss_' + b.kind];
    this.revealAround(true);
    const p = this.player;
    this.curIsland = World.islandAt(Math.floor(p.x / TS), Math.floor((p.y + 4) / TS));
    if (cont) {
      UI.toast(`Welcome back! Day ${FX.day}`);
      if (this.curIsland) UI.banner(STORY.islands[this.curIsland][0]);
    } else {
      UI.say('You', STORY.intro, () => this.enterIsland(1));
    }
  },

  resize() {
    // Fixed 224px-tall view that widens with the window; tall (portrait) screens get extra height instead.
    const iw = innerWidth || 1280, ih = innerHeight || 720; // hidden tabs can report 0
    let vh = 224;
    let vw = Math.round(iw / (ih / vh));
    if (vw < 256) { vw = 256; vh = clamp(Math.round(256 * ih / iw), 224, 460); }
    vw = clamp(vw, 256, 540);
    this.vw = vw; this.vh = vh;
    this.canvas.width = vw; this.canvas.height = vh;
    const s = Math.min(iw / vw, ih / vh);
    this.canvas.style.width = Math.floor(vw * s) + 'px';
    this.canvas.style.height = Math.floor(vh * s) + 'px';
    this.ctx.imageSmoothingEnabled = false;
    FX.resize(vw, vh);
    document.documentElement.style.setProperty('--ui', clamp(Math.min(iw / 1100, ih / 700), 0.7, 1.25).toFixed(3));
    this.vignette = document.createElement('canvas');
    this.vignette.width = vw; this.vignette.height = vh;
    const g = this.vignette.getContext('2d');
    const grad = g.createRadialGradient(vw / 2, vh / 2, vh * 0.45, vw / 2, vh / 2, vw * 0.7);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,20,0.4)');
    g.fillStyle = grad; g.fillRect(0, 0, vw, vh);
    this.snapCam = true;
  },

  // ---------------- input actions ----------------
  onAction(a) {
    switch (this.state) {
      case 'title':
        if (Menu.settingsOpen) Menu.settingsAction(a); else Menu.onAction(a);
        return;
      case 'settings': Menu.settingsAction(a); return;
      case 'dialog': if (a === 'interact' || a === 'attack') UI.advance(); return;
      case 'map': if (a === 'map' || a === 'pause' || a === 'interact') { UI.closeMap(); this.state = 'play'; } return;
      case 'craft':
        if (a === 'craft' || a === 'pause') { UI.closeCraft(); this.state = 'play'; }
        else if (a === 'up' || a === 'down') {
          const n = this.recipes().length;
          this.craftSel = (this.craftSel + (a === 'up' ? -1 : 1) + n) % n;
          UI.renderRecipes(); Sound.blip();
        }
        else if (a === 'interact' || a === 'attack') this.craft(this.craftSel);
        else if (/^r\d$/.test(a)) this.craft(+a[1] - 1);
        return;
      case 'pause': if (a === 'pause') { UI.closePause(); this.state = 'play'; } return;
      case 'play':
        if (this.building) {
          if (a === 'interact' || a === 'attack') return this.placeBuild();
          if (a === 'build' || a === 'pause') return this.toggleBuild(false);
          if (/^r\d$/.test(a)) { const i = +a[1] - 1; if (BUILDABLES[i] && this.inv[BUILDABLES[i].key]) { this.building.sel = i; Sound.blip(); } return; }
        }
        break;
      case 'win': return;
      default: return;
    }
    switch (a) {
      case 'interact': case 'attack': this.buffer = { a, t: 0.2 }; this.runBuffer(); break;
      case 'craft':
        if (this.player.mode !== 'walk') return UI.toast('You can\'t craft while sailing.');
        this.state = 'craft'; UI.openCraft(); Sound.click(); break;
      case 'map': UI.openMap(); this.state = 'map'; Sound.click(); break;
      case 'pause': UI.openPause(); this.state = 'pause'; Sound.click(); break;
      case 'eat': this.eat(); break;
      case 'roll': this.roll(); break;
      case 'build': this.toggleBuild(true); break;
      case 'heal': this.heal(); break;
    }
  },

  // Buffered presses: a press slightly too early (during a cooldown) still happens.
  runBuffer() {
    if (!this.buffer || this.state !== 'play') return;
    const ok = this.buffer.a === 'interact' ? this.interact() : this.attack();
    if (ok) this.buffer = null;
  },

  // ---------------- collision ----------------
  corners(x, y) { return [[x - 5, y + 1], [x + 4.99, y + 1], [x - 5, y + 7.99], [x + 4.99, y + 7.99]]; },
  canWalk(x, y, mob = false) {
    for (const [cx, cy] of this.corners(x, y)) {
      const tx = Math.floor(cx / TS), ty = Math.floor(cy / TS);
      if (!World.inb(tx, ty)) return false;
      const t = World.tiles[ty * World.W + tx];
      if (!TILE[t].walk) return false;
      if (mob && (t === T.GATE || t === T.WGATE || t === T.COBBLE || t === T.BRIDGE || t === T.PATH)) return false;
    }
    return true;
  },
  canSail(x, y, lvl) {
    for (const [cx, cy] of this.corners(x, y)) {
      const tx = Math.floor(cx / TS), ty = Math.floor(cy / TS);
      if (!World.inb(tx, ty)) return false;
      const s = TILE[World.tiles[ty * World.W + tx]].sea;
      if (!s || s > lvl) return false;
    }
    return true;
  },
  boatLevel() { return this.flags.sailboat ? 2 : this.flags.raft ? 1 : 0; },

  tryMove(dx, dy) {
    const p = this.player, nx = p.x + dx, ny = p.y + dy;
    const ok = p.mode === 'walk' ? this.canWalk(nx, ny) : this.canSail(nx, ny, this.boatLevel());
    if (ok) { p.x = nx; p.y = ny; }
    return ok;
  },

  // Nudge around corners so the player doesn't snag on tile edges.
  slide(axis, s, dt) {
    const p = this.player, step = 70 * dt;
    for (let off = 1; off <= 8; off++) {
      for (const d of [-1, 1]) {
        if (axis === 'x' ? this.canWalk(p.x + s * 2, p.y + d * off) : this.canWalk(p.x + d * off, p.y + s * 2)) {
          if (axis === 'x') this.tryMove(0, d * Math.min(step, off)); else this.tryMove(d * Math.min(step, off), 0);
          return;
        }
      }
    }
  },

  hint(text) {
    if (this.hintCD > 0) return;
    this.hintCD = 3;
    UI.toast(text);
    Sound.deny();
  },

  // Boarding / landing: when pushing against the shore, hop into the tile ahead.
  tryTransition() {
    const p = this.player, dv = DIRV[p.dir];
    const tx = Math.floor((p.x + dv[0] * 10) / TS), ty = Math.floor((p.y + 4 + dv[1] * 10) / TS);
    if (!World.inb(tx, ty)) return;
    const t = World.get(tx, ty), info = TILE[t], lvl = this.boatLevel();
    if (p.mode === 'walk') {
      if (!info.sea) return;
      if (lvl === 0) return this.hint(STORY.hints.noRaft);
      if (info.sea > lvl) return this.hint(STORY.hints.rough);
      p.mode = 'sail';
    } else {
      if (!info.walk) {
        if (info.sea > lvl) this.hint(STORY.hints.rough);
        else if (t === T.CLIFF) this.hint(STORY.hints.cliff);
        return;
      }
      p.mode = 'walk';
    }
    p.x = tx * TS + 8; p.y = ty * TS + 4; p.vx *= 0.3; p.vy *= 0.3;
    Sound.splash(); FX.burst(p.x, p.y + 6, '#cfe8ff', 10);
    this.blockedT = 0;
    this.lastFoot = -1;
  },

  // ---------------- main loop (fixed timestep) ----------------
  loop(now) {
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (!(dt > 0)) dt = 0;          // guards against negative / NaN timestamps
    this.acc = Math.min(this.acc + dt, 0.25);
    let n = 0;
    while (this.acc >= STEP && n < 8) { this.update(STEP); this.acc -= STEP; n++; }
    this.render();
    requestAnimationFrame(t => this.loop(t));
  },

  update(dt) {
    this.time += dt;
    UI.update(dt);
    if (this.state !== 'pause' && this.state !== 'settings') FX.update(dt, this.cam, this.vw, this.vh, this.player);
    if (this.state === 'title') this.titleCamera(dt); else this.updateCamera(dt);
    this.comboT -= dt;
    if (this.comboT <= 0) this.combo = 0;
    this.updateEnv(dt);
    for (const [k, v] of this.shake) { if (v - dt <= 0) this.shake.delete(k); else this.shake.set(k, v - dt); }

    if (this.state === 'dead' || this.state === 'sleep') {
      this.fadeT -= dt;
      if (this.fadeT <= 0) this.state === 'dead' ? this.respawn() : this.wake();
      return;
    }
    if (this.state !== 'play') return;
    if (this.hitStop > 0) { this.hitStop -= dt; return; }

    this.playTime += dt;
    this.hintCD = Math.max(0, this.hintCD - dt);
    this.flash = Math.max(0, this.flash - dt);
    const p = this.player, F = this.flags;
    p.inv = Math.max(0, p.inv - dt);
    p.attackT = Math.max(0, p.attackT - dt);
    p.rollCD = Math.max(0, p.rollCD - dt);
    p.actT = Math.max(0, p.actT - dt);
    if (this.buffer) { this.buffer.t -= dt; if (this.buffer.t <= 0) this.buffer = null; else this.runBuffer(); }

    this.updateMovement(dt);

    // survival
    const sprinting = p.mode === 'walk' && Input.sprint() && Math.hypot(p.vx, p.vy) > 75;
    let drain = sprinting ? 0.95 : p.mode === 'sail' ? 0.26 : 0.34;
    if (this.curIsland === 7 && p.mode === 'walk' && !this.nearFire(70) && F.armor !== 2) {
      drain *= F.armor === 2 ? 1 : F.armor ? 1.3 : 2;
      if (!this.coldWarned) { this.coldWarned = true; UI.toast(STORY.frostCold); }
    }
    p.food = Math.max(0, p.food - dt * drain * this.diff.hunger);
    // heartbeat when badly hurt
    if (p.hp / p.maxHp < 0.25) { this.heartT -= dt; if (this.heartT <= 0) { this.heartT = 0.9; Sound.heart(); } } else this.heartT = 0;
    if (p.food <= 0) {
      p.hp -= dt * 3;
      if (!F.hungerWarned) { F.hungerWarned = true; UI.toast('You are starving! Eat something (F) or pick berries.'); }
    } else if (p.food > 25) F.hungerWarned = false;
    if (p.food > 60 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + dt * 0.5);
    if (p.hp <= 0) return this.die();

    for (const m of this.mobs) m.update(dt, p);
    this.mobs = this.mobs.filter(m => !(m.temp && m.dead));
    this.updateSharks(dt);
    for (const b of this.bosses) b.update(dt, p);
    Bosses.update(dt, p);
    this.updateNightWolves(dt);
    for (const n of this.npcs) n.update(dt);
    this.cat.update(dt, p);

    for (const g of this.regrow) {
      g.t -= dt;
      if (g.t > 0) continue;
      if (g.vine) {
        // vines grow back on their empty spot (waits if you're standing on it)
        const ptx = Math.floor(p.x / TS), pty = Math.floor((p.y + 4) / TS);
        if (ptx === g.x && pty === g.y) { g.t = 5; continue; }
        if (World.get(g.x, g.y) === World.groundAt(g.x, g.y)) World.set(g.x, g.y, T.VINE);
      } else if (World.get(g.x, g.y) === T.BUSH) World.set(g.x, g.y, T.BERRY);
    }
    this.regrow = this.regrow.filter(g => g.t > 0);

    // message bottles are scooped up by sailing into them
    if (p.mode === 'sail') {
      for (const b of this.bottles) {
        if (b.taken || Math.hypot(b.x - p.x, b.y - (p.y + 4)) > 16) continue;
        b.taken = true;
        this.stats.bottles++;
        if (b.id === 1) F.relicHint = true;
        if (b.id === 2) F.catKnown = true;
        Sound.treasure();
        UI.say(STORY.bottles[b.id][0], [STORY.bottles[b.id][1]], () => Save.write());
        break;
      }
    }

    this.target = this.findTarget();
    this.checkSurroundings();

    this.autosaveT -= dt;
    if (this.autosaveT <= 0 && p.mode === 'walk') { this.autosaveT = 60; Save.write(); }
    UI.hudUpdate();
  },

  nearFire(r) {
    const p = this.player;
    return World.campfires.some(c => Math.hypot(c.x * TS + 8 - p.x, c.y * TS + 8 - p.y) < r);
  },

  updateSharks(dt) {
    const p = this.player;
    for (const s of this.sharks) s.update(dt, p);
    this.sharks = this.sharks.filter(s => !s.dead && Math.hypot(s.x - p.x, s.y - p.y) < 420);
    const tx = Math.floor(p.x / TS), ty = Math.floor((p.y + 4) / TS);
    if (p.mode === 'sail' && this.sharks.length < 2 && World.get(tx, ty) === T.DEEP && Math.random() < dt * 0.04) {
      const a = Math.random() * Math.PI * 2, x = p.x + Math.cos(a) * 170, y = p.y + Math.sin(a) * 170;
      if (World.get(Math.floor(x / TS), Math.floor(y / TS)) === T.DEEP) this.sharks.push(new Shark(x, y));
    }
  },

  sharkBite(s) {
    const p = this.player;
    const dmg = this.flags.sailboat ? 5 : 10;
    if (this.hurtPlayer(dmg, s.x, s.y, true)) { this.floater(p.x, p.y - 20, 'CHOMP!', '#ff7a6a'); FX.burst(p.x, p.y + 6, '#cfe8ff', 14); }
  },

  // Wolves come out at night on the wilder islands.
  updateNightWolves(dt) {
    const p = this.player;
    if (FX.darkness < 0.2) {
      for (const m of this.mobs) if (m.temp && Math.hypot(m.x - p.x, m.y - p.y) > 200) m.dead = true;
      return;
    }
    this.nightSpawnT -= dt;
    if (this.nightSpawnT > 0 || p.mode !== 'walk' || ![1, 2, 3, 6, 7].includes(this.curIsland)) return;
    this.nightSpawnT = 14 + Math.random() * 10;
    if (this.mobs.filter(m => m.temp && !m.dead).length >= 3) return;
    for (let k = 0; k < 12; k++) {
      const a = Math.random() * Math.PI * 2, d = 150 + Math.random() * 60;
      const tx = Math.floor((p.x + Math.cos(a) * d) / TS), ty = Math.floor((p.y + Math.sin(a) * d) / TS);
      const Tn = World.town;
      if (tx >= Tn.x0 - 3 && tx <= Tn.x1 + 1 && ty >= Tn.y0 - 1 && ty <= Tn.y1 + 1) continue;
      if (World.islandAt(tx, ty) !== this.curIsland || !this.canWalk(tx * TS + 8, ty * TS + 4, true)) continue;
      this.mobs.push(new Mob('wolf', tx, ty, true));
      if (Math.random() < 0.3) Sound.tone(300, 0.9, 'triangle', 0.04, 200);
      return;
    }
  },

  roll() {
    const p = this.player;
    if (p.mode !== 'walk' || p.rollCD > 0 || p.rollT > 0) return;
    let [ax, ay] = Input.axis();
    if (!ax && !ay) [ax, ay] = DIRV[p.dir];
    const m = Math.hypot(ax, ay);
    p.rollDX = ax / m; p.rollDY = ay / m;
    p.rollT = 0.3; p.rollCD = 0.65;
    p.food = Math.max(0, p.food - 1);
    Sound.swing();
    for (let i = 0; i < 4; i++) FX.dust(p.x, p.y + 7);
  },

  updateMovement(dt) {
    const p = this.player;
    if (p.rollT > 0) {
      p.rollT -= dt;
      const sp = 215 * (this.flags.boots ? 1.12 : 1);
      p.vx = p.rollDX * sp; p.vy = p.rollDY * sp;
      if (!this.tryMove(p.vx * dt, 0)) p.vx = 0;
      if (!this.tryMove(0, p.vy * dt)) p.vy = 0;
      if (Math.random() < 0.5) FX.dust(p.x, p.y + 7);
      p.anim += dt * 20;
      if (p.rollT <= 0) { p.vx *= 0.4; p.vy *= 0.4; }
      return;
    }
    let [ax, ay] = Input.axis();
    let mag = Math.hypot(ax, ay);
    if (mag > 1) { ax /= mag; ay /= mag; mag = 1; }
    if (mag > 0.1) {
      const adx = Math.abs(ax), ady = Math.abs(ay);
      const cur = p.dir;
      const keepH = (cur === 2 && ax < -0.3) || (cur === 3 && ax > 0.3);
      const keepV = (cur === 1 && ay < -0.3) || (cur === 0 && ay > 0.3);
      if (!(keepH || keepV) || Math.abs(adx - ady) > 0.5) {
        p.dir = adx > ady ? (ax < 0 ? 2 : 3) : (ay < 0 ? 1 : 0);
      }
    }
    const walking = p.mode === 'walk';
    const sprint = walking && Input.sprint() && p.food > 3;
    const max = walking ? (sprint ? 104 : 72) * (this.flags.boots ? 1.18 : 1) : (this.flags.sailboat ? 118 : 88);
    const accel = walking ? 20 : 3;
    p.vx += (ax * max - p.vx) * Math.min(1, dt * accel);
    p.vy += (ay * max - p.vy) * Math.min(1, dt * accel);
    if (walking && mag < 0.1 && Math.hypot(p.vx, p.vy) < 6) p.vx = p.vy = 0;
    if (Math.abs(p.vx) > 5) p.boatFace = p.vx > 0 ? 1 : -1;

    const mx = p.vx * dt, my = p.vy * dt;
    const okx = !mx || this.tryMove(mx, 0);
    if (!okx) {
      if (walking && Math.abs(ay) < 0.3 && ax) this.slide('x', Math.sign(mx), dt);
      p.vx *= walking ? 0 : -0.2;
    }
    const oky = !my || this.tryMove(0, my);
    if (!oky) {
      if (walking && Math.abs(ax) < 0.3 && ay) this.slide('y', Math.sign(my), dt);
      p.vy *= walking ? 0 : -0.2;
    }
    const facedBlocked = mag > 0.3 && (p.dir >= 2 ? !okx : !oky);
    this.blockedT = facedBlocked ? this.blockedT + dt : 0;
    if (this.blockedT > 0.1) this.tryTransition();

    // knockback
    if (p.kx || p.ky) {
      if (walking) { this.tryMove(p.kx * dt, 0); this.tryMove(0, p.ky * dt); }
      const f = Math.pow(0.002, dt);
      p.kx *= f; p.ky *= f;
      if (Math.abs(p.kx) + Math.abs(p.ky) < 2) p.kx = p.ky = 0;
    }

    const speed = Math.hypot(p.vx, p.vy);
    if (speed > 8) {
      p.anim += dt * (speed / 9);
      this.stepDist += speed * dt;
      if (walking && this.stepDist > 15) {
        this.stepDist = 0;
        const g = World.groundAt(Math.floor(p.x / TS), Math.floor((p.y + 7) / TS));
        Sound.step(g === T.SAND);
        if (g === T.SAND || g === T.SNOW || g === T.MUD) FX.print(p.x, p.y + 7, (this.stepSide = -(this.stepSide || 1)));
        if (sprint || g === T.SAND) FX.dust(p.x, p.y + 7, g === T.SAND ? '#e8d8a8' : '#b8a878');
      }
      if (!walking && Math.random() < dt * 20) FX.particles.push({ x: p.x - Math.sign(p.vx) * 10 + (Math.random() * 4 - 2), y: p.y + 8, vx: -p.vx * 0.1, vy: -p.vy * 0.1, g: 0, life: 0.6, col: 'rgba(235,248,255,0.7)', size: 1 });
    } else p.anim = 0;

    // footprint trail for the cat to follow
    const last = this.trail[this.trail.length - 1];
    if (!last || Math.hypot(last.x - p.x, last.y - p.y) > 6) {
      this.trail.push({ x: p.x, y: p.y });
      if (this.trail.length > 30) this.trail.shift();
    }
  },

  // loot that has flown into the player; pickup sounds climb in pitch during a streak
  collect(item, n) {
    const p = this.player;
    this.inv[item] = (this.inv[item] || 0) + n;
    if (item === 'gold') this.stats.gold += n;
    this.combo++; this.comboT = 1.2;
    Sound.collect(this.combo);
    this.floater(p.x, p.y - 14, `+${n} ${item}`, { wood: '#e0b070', stone: '#d0d0d0', iron: '#c8d8e8', gold: '#ffd84a', hide: '#e0b080', meat: '#ffb0b8', vine: '#8ee06a' }[item] || '#ffffff');
  },

  // On the title screen the camera drifts slowly between the islands.
  TITLE_PATH: [[36, 130], [60, 100], [100, 48], [150, 60], [212, 92], [233, 91], [290, 60], [346, 48], [342, 150], [342, 208], [270, 225], [202, 228], [130, 215], [78, 212], [40, 170]],
  titleCamera(dt) {
    this.titleT += dt * 0.022;
    const P = this.TITLE_PATH, n = P.length;
    const i = Math.floor(this.titleT) % n, f = this.titleT % 1;
    const a = P[i], b = P[(i + 1) % n];
    const e = f * f * (3 - 2 * f);
    this.cam.x = clamp((a[0] + (b[0] - a[0]) * e) * TS - this.vw / 2, 0, World.W * TS - this.vw);
    this.cam.y = clamp((a[1] + (b[1] - a[1]) * e) * TS - this.vh / 2, 0, World.H * TS - this.vh);
    if (Sound.ctx) { Music.setTrack('title'); Sound.setAmbient(0.6, FX.rain, this.time); }
  },

  updateCamera(dt) {
    const p = this.player, VW = this.vw, VH = this.vh;
    const tx = clamp(p.x + p.vx * 0.3 - VW / 2, 0, World.W * TS - VW);
    const ty = clamp(p.y + p.vy * 0.25 - VH / 2, 0, World.H * TS - VH);
    if (this.snapCam) { this.cam.x = tx; this.cam.y = ty; this.snapCam = false; return; }
    const k = Math.min(1, dt * 7);
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;
  },

  // Music & ambient sound follow where you are and what time it is.
  updateEnv(dt) {
    this.envT -= dt;
    if (this.envT > 0 || !Sound.ctx) return;
    this.envT = 0.5;
    const p = this.player;
    const cx = Math.floor(p.x / TS), cy = Math.floor((p.y + 4) / TS);
    let sea = 0, n = 0;
    for (let y = cy - 4; y <= cy + 4; y += 2) for (let x = cx - 7; x <= cx + 7; x += 2) { n++; if (TILE[World.get(x, y)].sea) sea++; }
    this.seaFrac = p.mode === 'sail' ? 1 : sea / n;
    Sound.setAmbient(this.state === 'title' ? 0.5 : this.seaFrac, FX.rain, this.time);
    const Tn = World.town;
    const inTown = cx >= Tn.x0 - 4 && cx <= Tn.x1 && cy >= Tn.y0 && cy <= Tn.y1;
    let track = 'island';
    if (this.activeBoss) track = 'boss';
    else if (this.state === 'win' || inTown) track = 'town';
    else if (FX.darkness > 0.45) track = 'night';
    else if (p.mode === 'sail') track = 'sea';
    else if (this.curIsland === 2) track = 'jungle';
    else if (this.curIsland === 6) track = 'swamp';
    else if (this.curIsland === 7) track = 'frost';
    else if (this.curIsland === 8) track = 'ember';
    else if (this.curIsland === 3) track = 'great';
    Music.setTrack(track);
  },

  revealAround(force) {
    const p = this.player;
    const tx = Math.floor(p.x / TS), ty = Math.floor((p.y + 4) / TS);
    const key = ty * World.W + tx;
    if (!force && key === this.lastFoot) return false;
    this.lastFoot = key;
    World.reveal(tx, ty, (p.mode === 'sail' ? 11 : 9) + (this.flags.spyglass ? 6 : 0));
    return true;
  },

  checkSurroundings() {
    const p = this.player;
    if (!this.revealAround(false)) return;
    const tx = Math.floor(p.x / TS), ty = Math.floor((p.y + 4) / TS);

    if (p.mode === 'walk') {
      const il = World.islandAt(tx, ty);
      if (il && il !== this.curIsland) this.enterIsland(il);
    }

    if (World.get(tx, ty) === T.PEBBLE) {
      World.set(tx, ty, World.groundAt(tx, ty));
      this.inv.stone++;
      Sound.pick();
      this.floater(p.x, p.y - 12, '+1 stone', '#d0d0d0');
    }
    if (World.get(tx, ty) === T.SHELL) {
      World.set(tx, ty, World.groundAt(tx, ty));
      this.stats.shells++;
      Sound.pick();
      this.floater(p.x, p.y - 12, 'Seashell!', '#f4c6d0');
      FX.burst(p.x, p.y + 4, '#f4c6d0', 6);
      if (this.stats.shells === World.totalShells) UI.toast('You found every seashell!');
    }

    World.campfires.forEach((cf, i) => {
      if (i === this.cpIndex) return;
      if (Math.hypot(cf.x * TS + 8 - p.x, cf.y * TS + 8 - (p.y + 4)) < 30) {
        this.cpIndex = i;
        this.checkpoint = { x: p.x, y: p.y };
        UI.toast('Checkpoint: campfire (game saved)');
        Sound.checkpoint();
        Save.write();
      }
    });

    const Tn = World.town;
    if (!this.flags.won && tx > Tn.x0 && tx < Tn.x1 && ty > Tn.y0 && ty < Tn.y1 && Math.hypot(tx - Tn.fx, ty - Tn.fy) < 3.5) {
      this.winSequence();
    }
  },

  enterIsland(il) {
    this.curIsland = il;
    const first = !this.flags.visited[il];
    this.flags.visited[il] = true;
    const [name, sub] = STORY.islands[il];
    UI.banner(name, first ? sub : '');
    if (first && il > 1) Save.write();
  },

  // ---------------- interactions ----------------
  findTarget() {
    const p = this.player;
    if (this.building) return null;
    if (p.mode === 'sail') {
      let best = null, bd = 30;
      for (const s of FX.fishSpots) {
        const d = Math.hypot(s.x - p.x, s.y - (p.y + 4));
        if (d < bd) { bd = d; best = { fish: s }; }
      }
      return best;
    }
    const dv = DIRV[p.dir];
    const fx = p.x + dv[0] * 12, fy = p.y + 4 + dv[1] * 12;
    for (const n of this.npcs) if (Math.abs(n.x - fx) < 12 && Math.abs(n.y + 4 - fy) < 12) return { npc: n };
    const cat = this.cat;
    if (cat.state !== 'home' && Math.abs(cat.x - fx) < 13 && Math.abs(cat.y + 4 - fy) < 13) return { cat };
    const ok = t => TILE[t].act || TILE[t].chop || TILE[t].mine;
    const tx = Math.floor(fx / TS), ty = Math.floor(fy / TS);
    let found = ok(World.get(tx, ty)) ? { x: tx, y: ty } : null;
    if (!found) {
      const cx = Math.floor(p.x / TS), cy = Math.floor((p.y + 4) / TS);
      let bd = 23;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!ok(World.get(cx + dx, cy + dy))) continue;
        const d = Math.hypot((cx + dx) * TS + 8 - p.x, (cy + dy) * TS + 8 - (p.y + 4));
        if (d < bd) { bd = d; found = { x: cx + dx, y: cy + dy }; }
      }
    }
    if (found && World.get(found.x, found.y) === T.BRIDGE_BROKEN) this.flags.bridgeSeen = true;
    return found;
  },

  // returns true if the press was consumed
  interact() {
    const p = this.player;
    if (p.actT > 0) return false;
    const tg = this.target;
    if (!tg) return p.mode === 'walk' ? this.attack() : true;
    if (tg.fish) return this.catchFish(tg.fish);
    if (tg.npc) { this.talkTo(tg.npc); return true; }
    if (tg.cat) { this.petCat(); return true; }
    const { x, y } = tg, t = World.get(x, y), info = TILE[t];
    if (info.chop || info.mine) return this.harvest(x, y, t);
    p.actT = 0.2;
    const F = this.flags, I = this.inv;
    switch (t) {
      case T.BERRY:
        World.set(x, y, T.BUSH);
        this.regrow.push({ x, y, t: 120 });
        p.food = Math.min(100, p.food + 22); p.hp = Math.min(p.maxHp, p.hp + 5);
        Sound.eat();
        this.floater(x * TS + 8, y * TS, '+22 food', '#ffd84a');
        FX.burst(x * TS + 8, y * TS + 8, '#e03a55', 6);
        break;
      case T.VINE:
        World.set(x, y, World.groundAt(x, y));
        this.regrow.push({ x, y, t: 90 + Math.random() * 60, vine: true });
        FX.drop(x * TS + 8, y * TS + 8, 'vine', 1);
        FX.burst(x * TS + 8, y * TS + 8, '#6fcf5a', 6);
        break;
      case T.RELIC:
        World.set(x, y, World.groundAt(x, y));
        this.stats.relics++;
        Sound.treasure();
        FX.burst(x * TS + 8, y * TS + 6, '#ffd84a', 20, 80);
        UI.say('Golden Idol', STORY.relic(this.stats.relics), () => Save.write());
        break;
      case T.MUSHROOMS:
        World.set(x, y, World.groundAt(x, y));
        p.food = Math.min(100, p.food + 12);
        Sound.eat();
        this.floater(x * TS + 8, y * TS, '+12 food', '#ffd84a');
        if (Math.random() < 0.25) { p.hp -= 8; UI.toast('Ugh... that mushroom tasted funny.'); }
        break;
      case T.CRATE: this.openCrate(x, y); break;
      case T.DIG: this.dig(x, y); break;
      case T.WRECK: UI.say('Shipwreck', STORY.wreck); break;
      case T.SIGN: UI.say('Sign', STORY.signs[World.signs[World.idx(x, y)]] || ['The writing has worn away.']); break;
      case T.CAMPFIRE: this.rest(x, y); break;
      case T.CHEST:
        if (!I.key) { F.chestSeen = true; UI.say('Chest', STORY.chestLocked); Sound.deny(); }
        else {
          I.key = 0; I.sailcloth = 1;
          World.set(x, y, T.CHEST_OPEN);
          Sound.treasure();
          FX.burst(x * TS + 8, y * TS + 4, '#ffd84a', 14);
          UI.say('Chest', STORY.chestOpen, () => Save.write());
        }
        break;
      case T.SKELETON:
        if (!F.gotKey) { F.gotKey = true; I.key = 1; Sound.pick(); UI.say('Remains', STORY.skeleton); }
        else UI.say('Remains', STORY.skeletonAfter);
        break;
      case T.BRIDGE_BROKEN:
        F.bridgeSeen = true;
        if (I.wood >= 8) {
          I.wood -= 8;
          for (let yy = 0; yy < World.H; yy++) for (let xx = 170; xx < 200; xx++) {
            if (World.get(xx, yy) === T.BRIDGE_BROKEN) { World.set(xx, yy, T.BRIDGE); FX.burst(xx * TS + 8, yy * TS + 8, '#c49a62', 8); }
          }
          F.bridge = true;
          Sound.craft(); FX.shake(2, 0.2);
          UI.toast('You repaired the bridge!');
          Save.write();
        } else {
          Sound.deny();
          UI.toast(`The bridge needs 8 wood to repair (${I.wood}/8)`);
        }
        break;
      case T.DOOR: UI.say('Door', STORY.door[tileHash(x, y) % STORY.door.length]); break;
      case T.FOUNTAIN: UI.say('Fountain', STORY.fountain); break;
    }
    return true;
  },

  // chop trees / mine rocks. Bare hands are slow; tools are much faster. Rock needs a pickaxe.
  toolPower(info) { const F = this.flags; return info.mine ? [0, 2, 3.5][F.pick] : [1, 2, 3.5][F.axe]; },
  hitsNeeded(t) { const info = TILE[t]; return Math.ceil((info.chop || info.mine) / this.toolPower(info)); },
  harvest(x, y, t) {
    const p = this.player, F = this.flags;
    if (p.actT > 0) return false;
    const info = TILE[t];
    if (info.mine && !F.pick) { p.actT = 0.3; this.hint(STORY.hints.noPick); return true; }
    const tool = info.mine ? F.pick : F.axe;
    p.actT = tool ? 0.26 : 0.5; p.attackT = 0.2;
    const idx = World.idx(x, y);
    const hits = (this.hits.get(idx) || 0) + 1;
    this.shake.set(idx, 0.18);
    if (info.mine) { Sound.mine(); FX.burst(x * TS + 8, y * TS + 9, t === T.ORE ? '#d88a50' : '#b0b0b0', 5); }
    else {
      Sound.chop();
      FX.burst(x * TS + 8, y * TS - 2, t === T.JTREE ? '#2f7a3a' : t === T.PALM ? '#4caf50' : t === T.PINE || t === T.SNOWPINE ? '#2f6b4a' : t === T.DEADTREE ? '#7a6a58' : '#57a843', 6);
      if (!tool && hits === 1) this.floater(x * TS + 8, y * TS - 6, 'ouch', '#ffb0a0');
    }
    if (hits >= this.hitsNeeded(t)) {
      this.hits.delete(idx);
      if (info.build) {
        World.set(x, y, World.groundAt(x, y));
        for (const [k, n] of Object.entries(info.build)) FX.drop(x * TS + 8, y * TS + 8, k, n);
        FX.burst(x * TS + 8, y * TS + 8, '#8a6236', 10);
      } else if (info.mine) {
        World.set(x, y, World.groundAt(x, y));
        if (t === T.ORE) FX.drop(x * TS + 8, y * TS + 8, 'iron', 1);
        else FX.drop(x * TS + 8, y * TS + 8, 'stone', Math.random() < 0.35 ? 2 : 1);
        FX.burst(x * TS + 8, y * TS + 9, '#8a8a8a', 12);
      } else {
        World.set(x, y, t === T.PALM || t === T.DEADTREE ? World.groundAt(x, y) : t === T.JTREE ? T.JSTUMP : T.STUMP);
        const n = F.axe === 2 && Math.random() < 0.4 ? 2 : 1;
        FX.drop(x * TS + 8, y * TS + 6, 'wood', n);
        this.stats.chopped++;
        FX.burst(x * TS + 8, y * TS + 10, '#8a6236', 8);
        FX.shake(1, 0.1);
      }
      Sound.pick();
    } else this.hits.set(idx, hits);
    return true;
  },

  openCrate(x, y) {
    const I = this.inv;
    World.set(x, y, World.groundAt(x, y));
    const loot = [['wood', 2, 4], ['rope', 1, 2], ['gold', 3, 10], ['bandage', 1, 1], ['cooked', 1, 2], ['iron', 1, 2], ['gold', 5, 12], ['hide', 1, 2]];
    const got = [];
    for (let k = 0; k < 2; k++) {
      const [item, a, b] = loot[Math.random() * loot.length | 0];
      const n = a + (Math.random() * (b - a + 1) | 0);
      FX.drop(x * TS + 8, y * TS + 8, item, n);
      got.push(`${n} ${item}`);
    }
    this.stats.crates++;
    Sound.treasure();
    FX.burst(x * TS + 8, y * TS + 8, '#c08a4a', 14);
    UI.toast('Crate: ' + got.join(', '));
  },

  dig(x, y) {
    if (!this.flags.shovel) return this.hint(STORY.hints.noShovel);
    const spot = World.digs.find(d => d.x === x && d.y === y);
    World.set(x, y, World.groundAt(x, y));
    Sound.chop(); Sound.treasure();
    FX.burst(x * TS + 8, y * TS + 8, '#a07848', 16);
    const id = spot ? spot.id : 4;
    if (id === 5) this.flags.spyglass = true;
    else if (id === 9) this.flags.compass = true;
    else { this.inv.gold += 40; this.stats.gold += 40; }
    this.lastFoot = -1;
    UI.say('Treasure!', STORY.dig[id] || STORY.dig[4], () => Save.write());
  },

  attack() {
    const p = this.player;
    // swinging at a tree/rock with no creature nearby is harvesting, on the harvest cooldown
    const tg = this.target;
    if (p.mode === 'walk' && tg && tg.x !== undefined) {
      const t = World.get(tg.x, tg.y);
      const dv0 = DIRV[p.dir], r0 = WEAPON_REACH[this.flags.weapon];
      const mobNear = this.mobs.some(m => !m.dead && Math.abs(m.x - (p.x + dv0[0] * r0)) < 14 && Math.abs(m.y - (p.y + 3 + dv0[1] * r0)) < 14);
      if ((TILE[t].chop || TILE[t].mine) && !mobNear) return this.harvest(tg.x, tg.y, t);
    }
    if (p.attackT > 0) return false;
    p.attackT = 0.26;
    Sound.swing();
    const dv = DIRV[p.dir];
    const W = this.flags.weapon, dmg = WEAPON_DMG[W];
    const reach = WEAPON_REACH[W];
    const hx = p.x + dv[0] * reach, hy = p.y + 3 + dv[1] * reach;
    if (p.mode === 'sail') {
      for (const s of this.sharks) {
        if (Math.hypot(s.x - p.x, s.y - (p.y + 4)) > 26) continue;
        s.hp -= dmg; s.hurt = 0.3; s.flee = 5;
        Sound.hit(); FX.burst(s.x, s.y, '#cfe8ff', 10); FX.shake(2, 0.12);
        if (s.hp <= 0) { s.dead = true; this.stats.kills++; this.collect('meat', 2); }
      }
      return true;
    }
    for (const b of this.bosses) {
      if (!b.active || b.defeated || b.z > 4 || Math.hypot(b.x - hx, b.y - 4 - hy) > b.def.r + 10) continue;
      if (!b.vulnerable()) { this.floater(b.x, b.y - 20, 'no effect!', '#aaaaaa'); Sound.deny(); continue; }
      const d = dmg * b.dmgMult();
      b.hp -= d; b.hurt = 0.2;
      this.floater(b.x, b.y - 24, '-' + Math.round(d), b.dmgMult() > 1 ? '#ffd84a' : '#ffffff');
      Sound.hit(); this.hitStop = 0.06; FX.shake(2, 0.12); FX.burst(b.x, b.y - 8, '#ffffff', 8);
      if (b.hp <= 0) this.defeatBoss(b);
    }
    let hitAny = false;
    for (const m of this.mobs) {
      if (m.dead || Math.abs(m.x - hx) > 13 || Math.abs(m.y - hy) > 13) continue;
      hitAny = true;
      m.hp -= dmg;
      m.hurt = 0.35;
      if (m.state === 'charge' || m.state === 'alert') { m.state = 'rest'; m.stateT = 0.8; }
      const dx = m.x - p.x, dy = m.y - p.y, d = Math.hypot(dx, dy) || 1;
      m.kx = dx / d * 240; m.ky = dy / d * 240;
      Sound.hit();
      this.hitStop = 0.05;
      FX.shake(2, 0.12);
      FX.burst(m.x, m.y, '#ffffff', 6);
      if (m.hp <= 0) {
        m.dead = true; m.respawnT = 180;
        this.stats.kills++;
        FX.burst(m.x, m.y, '#dddddd', 14);
        const drops = Object.entries(MOB_DEF[m.kind].drops || {});
        drops.forEach(([k, n]) => FX.drop(m.x, m.y, k, n));
      }
    }
    return true;
  },

  catchFish(s) {
    const p = this.player;
    p.actT = 0.3;
    if (!this.flags.rod) { this.hint('You need a fishing rod to catch fish. [C]'); return true; }
    FX.fishSpots.splice(FX.fishSpots.indexOf(s), 1);
    this.inv.fish++;
    this.stats.fish++;
    Sound.splash(); Sound.pick();
    FX.burst(s.x, s.y, '#cfe8ff', 12);
    this.floater(s.x, s.y - 8, '+1 fish', '#b8d8f0');
    return true;
  },

  petCat() {
    const c = this.cat;
    Sound.meow();
    FX.burst(c.x, c.y - 4, '#ff7aa0', 5, 20);
    if (c.state === 'lost') {
      c.state = 'follow';
      this.flags.catFound = true;
      UI.say('Biscuit', STORY.catFound, () => Save.write());
    } else {
      this.floater(c.x, c.y - 12, 'purr', '#ffd8a0');
      if (c.state === 'wait') c.state = 'follow';
    }
  },

  rest(x, y) {
    const p = this.player, I = this.inv;
    const n = I.fish + I.meat;
    if (n) { I.cooked += n; I.fish = 0; I.meat = 0; UI.toast(`You cooked ${n} meal${n > 1 ? 's' : ''}! Press F to eat.`); }
    this.checkpoint = { x: p.x, y: p.y };
    this.cpIndex = World.campfires.findIndex(c => c.x === x && c.y === y);
    p.hp = p.maxHp;
    Sound.checkpoint();
    if (FX.isNight()) {
      this.state = 'sleep';
      this.fadeT = 1.8;
      UI.setFade(true, 'Zzz...');
    } else {
      if (!n) UI.toast('You rest by the fire. Health restored. (Rest at night to sleep.)');
      Save.write();
    }
  },
  wake() {
    if (FX.tod > 0.26) FX.day++;
    FX.tod = 0.27;
    this.player.food = Math.max(10, this.player.food - 15);
    this.state = 'play';
    UI.setFade(false);
    UI.toast(`Good morning! Day ${FX.day}`);
    Save.write();
  },

  eat() {
    const p = this.player, I = this.inv;
    if (p.food >= 99) return UI.toast('You\'re full.');
    if (I.cooked) {
      I.cooked--; p.food = Math.min(100, p.food + 40); p.hp = Math.min(p.maxHp, p.hp + 10);
      this.floater(p.x, p.y - 12, '+40 food', '#ffd84a');
    } else if (I.fish || I.meat) {
      if (I.fish) I.fish--; else I.meat--;
      p.food = Math.min(100, p.food + 15);
      this.floater(p.x, p.y - 12, '+15 food', '#ffd84a');
      if (Math.random() < 0.3) { p.hp -= 6; UI.toast('Raw food... your tummy hurts. Cook it at a campfire!'); }
    } else return UI.toast('Nothing to eat. Pick berries, or catch fish and cook them.');
    Sound.eat();
  },

  heal() {
    const p = this.player;
    if (!this.inv.bandage) return UI.toast('No bandages. Craft them from vines [C].');
    if (p.hp >= p.maxHp) return UI.toast('You\'re not hurt.');
    this.inv.bandage--;
    p.hp = Math.min(p.maxHp, p.hp + 45);
    this.floater(p.x, p.y - 12, '+45 hp', '#ff8a7a');
    Sound.checkpoint();
  },

  // ---------------- bosses ----------------
  startBoss(b) {
    this.activeBoss = b;
    b.active = true;
    b.go('intro', 1.6);
    UI.banner(b.def.name, 'BOSS');
    UI.showBoss(b);
    FX.shake(4, 0.6);
    Sound.tone(80, 1.2, 'sawtooth', 0.12, -40); Sound.noise(1, 0.3, 150);
    if (b.kind === 'magmaw') this.sealArena(true);
    if (!this.flags.bossTip) { this.flags.bossTip = true; setTimeout(() => UI.toast('Red circles show where attacks land. Roll out with [Q]!'), 1800); }
  },
  endBoss(b, won) {
    if (this.activeBoss === b) this.activeBoss = null;
    b.active = false;
    Bosses.clear();
    for (const m of this.mobs) if (m.temp && m.minion) m.dead = true;
    if (b.kind === 'magmaw') this.sealArena(false);
    UI.hideBoss();
    if (won) b.defeated = true; else b.reset();
  },
  // Crossing into Magmaw's crater closes the lava bridge behind you until the fight ends.
  sealArena(on) {
    for (const g of World.points.emberGate || []) {
      World.set0(g.x, g.y, on ? T.LAVA : T.ASH);
      if (World.explored[World.idx(g.x, g.y)]) UI.paintTile(g.x, g.y);
    }
    if (on) FX.burst(World.points.emberGate[0].x * TS, World.points.emberGate[0].y * TS, '#ff8a2a', 20, 70);
  },
  defeatBoss(b) {
    const p = this.player, F = this.flags;
    FX.burst(b.x, b.y - 10, '#ffd84a', 40, 120); FX.burst(b.x, b.y - 10, '#ffffff', 20, 90); FX.shake(6, 0.6);
    Sound.win();
    this.endBoss(b, true);
    F['boss_' + b.kind] = true;
    this.stats.bosses = (this.stats.bosses || 0) + 1;
    if (b.kind === 'magmaw') { F.weapon = 3; p.maxHp += 25; }
    if (b.kind === 'frostfang') F.armor = 2;
    if (b.kind === 'bogking') F.boots = true;
    p.hp = p.maxHp;
    UI.say('Victory!', STORY.bossWin[b.kind], () => Save.write());
  },
  spawnMinion(kind, x, y) {
    for (let k = 0; k < 10; k++) {
      const a = Math.random() * Math.PI * 2, d = 24 + Math.random() * 30;
      const tx = Math.floor((x + Math.cos(a) * d) / TS), ty = Math.floor((y + Math.sin(a) * d) / TS);
      if (!this.canWalk(tx * TS + 8, ty * TS + 4, true)) continue;
      const m = new Mob(kind, tx, ty, true);
      m.minion = true;
      this.mobs.push(m);
      FX.burst(m.x, m.y, '#ff8a2a', 8);
      return;
    }
  },

  // ---------------- building ----------------
  toggleBuild(on) {
    if (!on) { this.building = null; UI.toast('Build mode off'); return; }
    if (this.building) return this.toggleBuild(false);
    if (this.player.mode !== 'walk') return;
    const i = BUILDABLES.findIndex(b => this.inv[b.key] > 0);
    if (i < 0) return this.hint('Nothing to build. Craft walls, gates or campfires first [C].');
    this.building = { sel: i };
    Sound.click();
    UI.toast('BUILD: [E]/[Space] place · [1-4] switch · [B] exit · Chop/mine walls to take them down');
  },
  buildSpot() {
    const p = this.player, dv = DIRV[p.dir];
    const tx = Math.floor((p.x + dv[0] * 14) / TS), ty = Math.floor((p.y + 4 + dv[1] * 14) / TS);
    if (!World.inb(tx, ty)) return { tx, ty, ok: false };
    const t = World.get(tx, ty);
    let ok = t === World.groundAt(tx, ty) && TILE[t].walk && ![T.COBBLE, T.GATE, T.BRIDGE, T.RUINFLOOR].includes(t);
    const Tn = World.town;
    if (tx >= Tn.x0 - 1 && tx <= Tn.x1 + 1 && ty >= Tn.y0 - 1 && ty <= Tn.y1 + 1) ok = false;
    const x0 = tx * TS, y0 = ty * TS;
    const inTile = (x, y) => x >= x0 - 5 && x < x0 + 21 && y + 7 >= y0 && y + 1 < y0 + 16;
    if (inTile(p.x, p.y)) ok = false;
    for (const e of [...this.mobs.filter(m => !m.dead), ...this.npcs, this.cat]) if (inTile(e.x, e.y)) ok = false;
    for (const b of this.bosses) if (!b.defeated && Math.hypot(b.x - (x0 + 8), b.y - (y0 + 8)) < b.def.r + 10) ok = false;
    return { tx, ty, ok };
  },
  placeBuild() {
    const b = BUILDABLES[this.building.sel];
    const spot = this.buildSpot();
    if (!spot.ok) { Sound.deny(); return; }
    World.set(spot.tx, spot.ty, b.tile);
    this.inv[b.key]--;
    if (b.tile === T.CAMPFIRE) { World.campfires.push({ x: spot.tx, y: spot.ty }); World.pois.push({ x: spot.tx, y: spot.ty, kind: 'fire' }); }
    Sound.chop();
    FX.burst(spot.tx * TS + 8, spot.ty * TS + 10, b.tile === T.WALL_STONE ? '#9a9aa4' : '#a07848', 8);
    if (!this.inv[b.key]) {
      const next = BUILDABLES.findIndex(x => this.inv[x.key] > 0);
      if (next < 0) { this.building = null; UI.toast('Out of building materials.'); }
      else this.building.sel = next;
    }
  },

  recipes() {
    const F = this.flags, I = this.inv;
    const list = [
      { name: 'Rope', icon: 'rope', desc: 'Twist vines into rope.', cost: { vine: 3 }, once: false, make: () => { I.rope++; } },
      { name: 'Stone Axe', icon: 'axe', desc: 'Chop trees 3x faster than punching.', cost: { wood: 3, stone: 2, rope: 1 }, once: true, have: () => F.axe >= 1, make: () => { F.axe = Math.max(F.axe, 1); } },
      { name: 'Stone Pickaxe', icon: 'pick', desc: 'Break rocks for stone, and ore for iron.', cost: { wood: 3, stone: 3, rope: 1 }, once: true, have: () => F.pick >= 1, make: () => { F.pick = Math.max(F.pick, 1); } },
    ];
    if (!F.sailboat) list.push({ name: 'Raft', icon: 'raft', desc: 'Sail the calm seas. Beware sharks.', cost: { wood: 12, rope: 3 }, once: true, have: () => F.raft, make: () => { F.raft = true; } });
    list.push(
      { name: 'Bandage', icon: 'bandage', desc: 'Press H to heal 45 HP.', cost: { vine: 2 }, once: false, make: () => { I.bandage++; } },
      { name: 'Wood Walls (x2)', icon: 'wwall', desc: 'Place with [B]. Animals can\'t get through.', cost: { wood: 4 }, once: false, make: () => { I.wwall += 2; } },
      { name: 'Stone Walls (x2)', icon: 'swall', desc: 'Sturdy walls. Place with [B].', cost: { stone: 4 }, once: false, make: () => { I.swall += 2; } },
      { name: 'Gate', icon: 'wgate', desc: 'You can walk through it, animals can\'t.', cost: { wood: 4, rope: 1 }, once: false, make: () => { I.wgate++; } },
      { name: 'Campfire', icon: 'fire', desc: 'Place anywhere: light, cooking, checkpoint.', cost: { wood: 5, stone: 3 }, once: false, make: () => { I.fire++; } },
      { name: 'Torch', icon: 'torch', desc: 'Lights up the night around you.', cost: { wood: 2, rope: 1 }, once: true, have: () => F.torch, make: () => { F.torch = true; } },
      { name: 'Stone Spear', icon: 'spear', desc: 'Double damage, longer reach.', cost: { wood: 3, stone: 3, rope: 1 }, once: true, have: () => F.weapon >= 1, make: () => { F.weapon = Math.max(F.weapon, 1); } },
      { name: 'Fishing Rod', icon: 'rod', desc: 'Catch fish where the sea sparkles.', cost: { wood: 3, rope: 2 }, once: true, have: () => F.rod, make: () => { F.rod = true; } },
      { name: 'Leather Armor', icon: 'armor', desc: 'Take 35% less damage. Keeps out the cold.', cost: { hide: 4, rope: 1 }, once: true, have: () => F.armor, make: () => { F.armor = true; } },
      { name: 'Iron Axe', icon: 'iaxe', desc: 'Fells trees in 2 hits, sometimes 2 wood.', cost: { wood: 2, iron: 3 }, once: true, have: () => F.axe >= 2, make: () => { F.axe = 2; } },
      { name: 'Iron Pickaxe', icon: 'ipick', desc: 'Smashes rock and ore quickly.', cost: { wood: 2, iron: 3 }, once: true, have: () => F.pick >= 2, make: () => { F.pick = 2; } },
      { name: 'Iron Sword', icon: 'sword', desc: 'Triple damage.', cost: { wood: 1, iron: 4 }, once: true, have: () => F.weapon >= 2, make: () => { F.weapon = 2; } },
      { name: 'Shovel', icon: 'shovel', desc: 'Dig up treasure where you see a red X.', cost: { wood: 3, iron: 2 }, once: true, have: () => F.shovel, make: () => { F.shovel = true; } },
    );
    return list;
  },

  craft(i) {
    const r = this.recipes()[i];
    if (!r) return;
    const I = this.inv;
    this.craftSel = i;
    if (r.once && r.have()) return;
    if (!Object.entries(r.cost).every(([k, n]) => (I[k] || 0) >= n)) { Sound.deny(); return; }
    for (const [k, n] of Object.entries(r.cost)) I[k] -= n;
    r.make();
    Sound.craft();
    FX.burst(this.player.x, this.player.y, '#ffd84a', 12);
    UI.renderRecipes();
    UI.hudUpdate();
    if (r.name === 'Raft') {
      UI.closeCraft();
      UI.say('You', ['There! Twelve logs lashed together with rope. It\'s not pretty, but it floats.',
        'Now I just walk into the sea to set sail. The jungle island is to the NORTHEAST.'], () => Save.write());
    } else {
      UI.toast(`Crafted: ${r.name}!`);
      Save.write();
    }
  },

  talkTo(n) {
    const p = this.player;
    const dx = p.x - n.x, dy = p.y - n.y;
    n.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : (dy < 0 ? 1 : 0);
    n.vx = n.vy = 0; n.talkT = 4;
    const F = this.flags, I = this.inv;
    if (n.role === 'hermit') {
      if (!F.metHermit) { F.metHermit = true; return UI.say(n.name, STORY.hermitFirst, () => Save.write()); }
      if (F.sailboat) return UI.say(n.name, n.nextLine.call({ lines: STORY.hermitAfter, lineIdx: n.lineIdx++ }));
      if (I.sailcloth && I.wood >= 10 && I.rope >= 2) {
        I.sailcloth = 0; I.wood -= 10; I.rope -= 2;
        return UI.say(n.name, STORY.hermitBuild, () => {
          F.sailboat = true;
          Sound.craft();
          UI.toast('You got a SAILBOAT! It can cross the rough reef.');
          Save.write();
        });
      }
      const need = [];
      if (!I.sailcloth) need.push(I.key ? 'that key should open the ruins chest up north' : 'SAILCLOTH from the ruins up north');
      if (I.wood < 10) need.push(`${10 - I.wood} more wood`);
      if (I.rope < 2) need.push(`${2 - I.rope} more rope`);
      return UI.say(n.name, [`Still need ${need.join(', and ')}. Off you go!`]);
    }
    if (n.role === 'trader') {
      if (!F.metTrader) { F.metTrader = true; return UI.say(n.name, STORY.trader.hello); }
      const deals = STORY.trader.deals, d = deals[n.lineIdx % deals.length];
      if (I.gold >= d.cost) {
        I.gold -= d.cost;
        for (const [k, v] of Object.entries(d.give)) I[k] += v;
        n.lineIdx++;
        Sound.treasure();
        return UI.say(n.name, [`Pleasure doin' business! ${d.text} for ${d.cost} gold. Come back for my next deal.`], () => Save.write());
      }
      n.lineIdx++;
      return UI.say(n.name, [`Today's deal: ${d.text} for ${d.cost} gold. You've only got ${I.gold}. Crates wash up on every beach, matey!`]);
    }
    if (n.role === 'guard') return UI.say(n.name, FX.isNight() ? ['Late to be wandering about, friend. Mind the boars.'] : STORY.guard);
    if (n.role === 'mayor') return this.winSequence();
    if (n.role === 'pip') {
      const cat = this.cat;
      if (cat.state === 'follow' || cat.state === 'wait') {
        if (Math.hypot(cat.x - n.x, cat.y - n.y) < 90) {
          return UI.say('Pip', STORY.catReturn, () => {
            cat.state = 'home'; cat.x = n.homeX + 14; cat.y = n.homeY + 4;
            F.catHome = true;
            p.maxHp += 25; p.hp = p.maxHp;
            Sound.treasure();
            FX.burst(cat.x, cat.y, '#ff7aa0', 14);
            Save.write();
          });
        }
        return UI.say('Pip', ['Is... is that BISCUIT I hear? Bring her closer!']);
      }
      if (F.catHome) return UI.say('Pip', ['Biscuit says thank you! Well, she said "meow", but I know what she meant.']);
      F.catKnown = true;
    }
    UI.say(n.name, [n.nextLine()]);
  },

  winSequence() {
    if (this.flags.won) return UI.say('Mayor Elin', ['Welcome home, traveler.']);
    this.flags.won = true;
    const mayor = this.npcs.find(n => n.role === 'mayor');
    if (mayor) { mayor.dir = this.player.y < mayor.y ? 1 : 0; }
    const lines = [...STORY.mayor.slice(0, 3), ...STORY.mayorRelics(this.stats.relics), ...(this.flags.catHome ? STORY.mayorCat : []), STORY.mayor[3]];
    UI.say('Mayor Elin', lines, () => this.win());
  },

  objectiveText() {
    const F = this.flags, I = this.inv;
    if (!F.raft && !F.sailboat) {
      if (!F.axe) return `Punch trees for wood, pick up pebbles, twist vines into rope, then craft a Stone Axe [C] · Wood ${Math.min(I.wood, 3)}/3 · Stone ${Math.min(I.stone, 2)}/2 · Rope ${Math.min(I.rope, 1)}/1`;
      return `Build a raft [C]: Wood ${Math.min(I.wood, 12)}/12 · Rope ${Math.min(I.rope, 3)}/3 (3 vines = 1 rope)`;
    }
    if (!F.visited[2]) return 'Sail NORTHEAST to the jungle island';
    if (!F.metHermit) return 'Explore Verdant Isle. Someone may live here...';
    if (!F.sailboat) {
      let s;
      if (I.sailcloth) s = 'Bring the sailcloth to Tobias';
      else if (I.key) s = 'Open the ruins chest in the NORTH';
      else if (F.chestSeen) s = 'Find the chest key (Tobias mentioned the EAST beach)';
      else s = 'Find sailcloth in the NORTHERN ruins';
      return `${s} · Wood ${Math.min(I.wood, 10)}/10 · Rope ${Math.min(I.rope, 2)}/2`;
    }
    if (!F.visited[3]) return 'Sail EAST across the reef and land on the Great Isle\'s WEST beach';
    if (!F.bridge) return F.bridgeSeen ? `Repair the bridge: Wood ${Math.min(I.wood, 8)}/8` : 'Follow the old road EAST';
    return 'Cross Aurum Pass and find Port Haven';
  },
  sideText() {
    const F = this.flags, out = [];
    if (F.catFound && !F.catHome) out.push('★ Bring Biscuit home to Pip in Port Haven');
    else if (F.catKnown && !F.catFound) out.push('★ Find Biscuit the cat (western forest of the Great Isle)');
    if ((F.relicHint || this.stats.relics) && this.stats.relics < 6) out.push(`★ Golden idols ${this.stats.relics}/6`);
    return out.join('  ');
  },

  // ---------------- damage / death / win ----------------
  hurtPlayer(dmg, sx, sy, noKnock) {
    const p = this.player;
    if (p.inv > 0 || this.state !== 'play') return false;
    if (p.rollT > 0) {
      if (!(p.dodgeFx > this.time)) { p.dodgeFx = this.time + 0.5; this.floater(p.x, p.y - 14, 'dodge!', '#9fd3ff'); }
      return false;
    }
    dmg = Math.max(1, Math.round(dmg * this.diff.dmg));
    if (this.flags.armor) dmg = Math.round(dmg * (this.flags.armor === 2 ? 0.45 : 0.65));
    if (!this.flags.combatTip) { this.flags.combatTip = true; UI.toast(STORY.combatTip); }
    p.hp -= dmg; p.inv = 0.8;
    const dx = p.x - sx, dy = p.y - sy, d = Math.hypot(dx, dy) || 1;
    if (!noKnock) { p.kx = dx / d * 180; p.ky = dy / d * 180; }
    Sound.hurt();
    this.flash = 0.15;
    this.hitStop = 0.07;
    FX.shake(3, 0.2);
    this.floater(p.x, p.y - 12, '-' + dmg, '#ff5a5a');
    if (p.hp <= 0) this.die();
    return true;
  },

  die() {
    this.player.hp = 0;
    this.state = 'dead';
    this.fadeT = 2.2;
    this.stats.deaths++;
    UI.setFade(true, 'You collapsed...');
  },

  respawn() {
    const p = this.player;
    if (this.activeBoss) this.endBoss(this.activeBoss, false);
    this.building = null;
    Object.assign(p, { x: this.checkpoint.x, y: this.checkpoint.y, vx: 0, vy: 0, mode: 'walk', hp: p.maxHp, rollT: 0, food: Math.max(p.food, 50), kx: 0, ky: 0, inv: 1.5 });
    // you drop half your materials when you collapse
    const lost = [];
    for (const k of ['wood', 'vine', 'rope', 'stone', 'iron', 'hide', 'gold', 'fish', 'meat', 'cooked']) {
      const n = Math.floor(this.inv[k] * this.diff.loss);
      if (n) { this.inv[k] -= n; lost.push(`${n} ${k}`); }
    }
    this.sharks = [];
    if (lost.length) setTimeout(() => UI.toast('Lost: ' + lost.join(', ')), 600);
    this.state = 'play';
    this.lastFoot = -1;
    this.snapCam = true;
    UI.setFade(false);
    UI.toast('You wake up by the campfire.');
  },

  win() {
    this.state = 'win';
    Sound.win();
    const st = this.stats;
    const newBest = Records.record({ diff: this.diffKey, time: this.playTime, idols: st.relics, bosses: st.bosses || 0,
      islands: Object.keys(this.flags.visited).length, shells: st.shells });
    Save.write();
    UI.showWin(newBest);
  },
  keepExploring() {
    UI.win.classList.add('hidden');
    UI.hud.classList.remove('hidden');
    this.state = 'play';
    UI.toast('The islands are yours to explore. The mayor will be here when you return.');
  },

  fmtTime() {
    const s = Math.floor(this.playTime);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  },
  floater(x, y, text, col) { FX.floater(x, y, text, col); },

  // ---------------- rendering ----------------
  render() {
    const c = this.ctx, p = this.player, VW = this.vw, VH = this.vh;
    const [ox, oy] = FX.shakeOffset();
    const camX = Math.round(this.cam.x) + ox, camY = Math.round(this.cam.y) + oy;
    const fi = Math.floor(this.time * 4);
    c.fillStyle = '#1f4f8c';
    c.fillRect(0, 0, VW, VH);

    const tx0 = Math.floor(camX / TS) - 1, ty0 = Math.floor(camY / TS);
    const tx1 = tx0 + Math.ceil(VW / TS) + 2, ty1 = ty0 + Math.ceil(VH / TS) + 2;
    const objs = [], windows = [];
    const night = FX.darkness > 0.15;
    for (let ty = ty0; ty < ty1; ty++) {
      for (let tx = tx0; tx < tx1; tx++) {
        this.drawTile(c, tx, ty, tx * TS - camX, ty * TS - camY, fi, objs);
        if (night) {
          const wt = World.get(tx, ty);
          if (wt === T.HOUSEWALL) windows.push(tx, ty, 22);
          else if (wt === T.LAVA && (tx + ty * 2) % 3 === 0) windows.push(tx, ty, 34);
        }
      }
    }

    FX.drawPrints(c, camX, camY);
    FX.drawCritters(c, camX, camY, this.time);
    for (const b of this.bottles) {
      if (b.taken) continue;
      const bx = Math.round(b.x - 6 - camX), by = Math.round(b.y - 6 - camY + Math.sin(this.time * 2 + b.id) * 1.5);
      if (bx < -16 || by < -16 || bx > VW || by > VH) continue;
      c.drawImage(Sprites.fx.bottle[Math.floor(this.time * 2) % 2], bx, by);
    }
    if (this.state === 'play' && this.target) this.drawTargetBox(c, camX, camY);
    for (const b of this.bosses) b.drawTelegraph(c, camX, camY, this.time);

    // characters and trees, depth sorted
    const inView = e => Math.abs(e.x - p.x) < VW && Math.abs(e.y - p.y) < VH;
    for (const m of this.mobs) if (!m.dead && inView(m)) objs.push({ key: m.y + 7, e: m });
    for (const n of this.npcs) if (inView(n)) objs.push({ key: n.y + 7, e: n });
    if (inView(this.cat)) objs.push({ key: this.cat.y + 7, e: this.cat });
    for (const s of this.sharks) if (inView(s)) objs.push({ key: s.y, e: s, noShadow: true });
    for (const b of this.bosses) if (!b.defeated && inView(b)) objs.push({ key: b.y + 4, e: b, noShadow: true });
    objs.push({ key: p.y + 7, e: p });
    objs.sort((a, b) => a.key - b.key);
    for (const o of objs) {
      if (o.tree) this.drawTree(c, o, camX, camY);
      else if (o.e === p) { if (this.state !== 'title') this.drawPlayer(c, camX, camY); }
      else {
        if (o.e !== this.cat && !o.noShadow) this.shadow(c, o.e.x - camX, o.e.y + 7 - camY);
        o.e.draw(c, camX, camY, this.time);
      }
    }

    FX.drawParticles(c, camX, camY);
    FX.drawItems(c, camX, camY, this.time);
    Bosses.draw(c, camX, camY, this.time);
    if (this.building && this.state === 'play') this.drawBuildGhost(c, camX, camY);
    FX.drawSky(c, camX, camY, VW, VH, this.time);
    FX.drawWeather(c, VW, VH, 1 / 60);

    // lights for the night
    if (FX.darkness > 0.03) {
      const lights = [{ x: p.x - camX, y: p.y - camY, r: this.flags.torch ? 96 : 44, warm: this.flags.torch, flicker: this.flags.torch }];
      const vis = (x, y) => x > -100 && y > -100 && x < VW + 100 && y < VH + 100;
      for (const f of World.campfires) { const x = f.x * TS + 8 - camX, y = f.y * TS + 8 - camY; if (vis(x, y)) lights.push({ x, y, r: 92, warm: true, flicker: true }); }
      for (const s of Bosses.shots) if (s.kind === 'fire') lights.push({ x: s.x - camX, y: s.y - camY, r: 26, warm: true });
      for (const b of this.bosses) if (b.kind === 'magmaw' && !b.defeated && vis(b.x - camX, b.y - camY)) lights.push({ x: b.x - camX, y: b.y - 12 - camY, r: 80, warm: true, flicker: true });
      for (const l of World.lamps) { const x = l.x * TS + 8 - camX, y = l.y * TS + 4 - camY; if (vis(x, y)) lights.push({ x, y, r: 62, warm: true }); }
      for (let i = 0; i < windows.length; i += 3) lights.push({ x: windows[i] * TS + 8 - camX, y: windows[i + 1] * TS + 8 - camY, r: windows[i + 2], warm: true });
      FX.drawLighting(c, VW, VH, lights, this.time);
    } else if (FX.dusk > 0.02) FX.drawLighting(c, VW, VH, [], this.time);
    FX.drawGlow(c, camX, camY, this.time);

    if (this.state === 'play' && this.target) this.drawTargetLabel(c, camX, camY);
    if (this.flags.compass) this.drawCompass(c, camX, camY);
    FX.drawFloaters(c, camX, camY);

    c.drawImage(this.vignette, 0, 0);
    if (this.flash > 0) { c.fillStyle = `rgba(255,40,40,${this.flash * 2})`; c.fillRect(0, 0, VW, VH); }
    if (p.hp / p.maxHp < 0.25 && this.state === 'play') {
      const beat = Math.max(0, Math.sin(this.time * 7)) ** 4;
      const g = c.createRadialGradient(VW / 2, VH / 2, VH * 0.3, VW / 2, VH / 2, VW * 0.65);
      g.addColorStop(0, 'rgba(160,0,0,0)'); g.addColorStop(1, `rgba(160,0,0,${0.25 + beat * 0.3})`);
      c.fillStyle = g; c.fillRect(0, 0, VW, VH);
    }
    if (p.food <= 0 && this.state === 'play') {
      c.fillStyle = `rgba(80,0,0,${0.12 + Math.sin(this.time * 4) * 0.08})`;
      c.fillRect(0, 0, VW, VH);
    }
  },

  drawTile(c, tx, ty, sx, sy, fi, objs) {
    if (!World.inb(tx, ty)) { c.drawImage(Sprites.tiles[T.DEEP][0][mod(fi, 8)], sx, sy); return; }
    const i = ty * World.W + tx, t = World.tiles[i], info = TILE[t];
    const h = tileHash(tx, ty);
    const shake = this.shake.has(i) ? Math.round(Math.sin(this.time * 70)) : 0;
    if (info.overlay || info.tall) {
      this.drawGround(c, World.ground[i], tx, ty, sx, sy, fi, h, false);
      if (info.tall) { objs.push({ tree: true, t, tx, ty, h, shake, key: ty * TS + 15 }); return; }
      if (t === T.WALL_WOOD) {
        c.fillStyle = '#9a6e3e';
        const conn = n => n === T.WALL_WOOD || n === T.WGATE || n === T.WALL_STONE;
        if (conn(World.get(tx - 1, ty))) { c.fillRect(sx, sy + 4, 7, 2); c.fillRect(sx, sy + 9, 7, 2); }
        if (conn(World.get(tx + 1, ty))) { c.fillRect(sx + 9, sy + 4, 7, 2); c.fillRect(sx + 9, sy + 9, 7, 2); }
      }
      const vs = Sprites.over[t], fr = vs[h % vs.length];
      c.drawImage(fr[mod(fi, fr.length)], sx + shake, sy);
    } else {
      this.drawGround(c, t, tx, ty, sx, sy, fi, h, t === World.ground[i]);
    }
  },

  drawGround(c, g, tx, ty, sx, sy, fi, h, decor) {
    const vs = Sprites.tiles[g], fr = vs[h % vs.length];
    c.drawImage(fr[mod(fi, fr.length)], sx, sy);
    const info = TILE[g];
    if (info.sea) {
      this.drawFoam(c, tx, ty, sx, sy, fi);
      if ((h + fi * 13) % 97 === 0) { c.fillStyle = 'rgba(255,255,255,0.8)'; c.fillRect(sx + (h % 13), sy + ((h >> 4) % 13), 2, 1); }
      return;
    }
    const k = groundKind(g);
    if (!k) return;
    const N = [[0, -1, 0], [0, 1, 1], [-1, 0, 2], [1, 0, 3]];
    for (const [dx, dy, dir] of N) {
      const nk = groundKind(World.groundAt(tx + dx, ty + dy));
      if (SOFT_EDGES[k] && SOFT_EDGES[k].includes(nk)) {
        c.drawImage(Sprites.fringe[nk][dir][(h >> dir) & 1], sx, sy);
      }
      if (k === 's' && nk === 'w') {
        c.fillStyle = 'rgba(160,130,70,0.28)';
        if (dir === 0) c.fillRect(sx, sy, 16, 2); else if (dir === 1) c.fillRect(sx, sy + 14, 16, 2);
        else if (dir === 2) c.fillRect(sx, sy, 2, 16); else c.fillRect(sx + 14, sy, 2, 16);
      }
    }
    if (!decor) return;
    const d = h % 223;
    const D = Sprites.decor;
    if (k === 'g') {
      if (d < 3) c.drawImage(D.mushroom, sx, sy);
      else if (d < 7) c.drawImage(D.pebbles, sx, sy);
      else if (d < 10) c.drawImage(D.stick, sx, sy);
      else if (d < 26) c.drawImage(D.smallflower, sx, sy);
      else if (d < 90 && (World.get(tx, ty - 1) === T.RIVER || World.get(tx, ty + 1) === T.RIVER || World.get(tx - 1, ty) === T.RIVER || World.get(tx + 1, ty) === T.RIVER)) c.drawImage(D.reeds, sx, sy);
    } else if (k === 's') {
      if (d < 4) c.drawImage(D.starfish, sx, sy);
      else if (d < 9) c.drawImage(D.pebbles, sx, sy);
      else if (d < 13) c.drawImage(D.driftwood, sx, sy);
    }
  },

  drawFoam(c, tx, ty, sx, sy, fi) {
    const land = (x, y) => { const t = World.get(x, y); return !TILE[t].sea && t !== T.RIVER && t !== T.BRIDGE && t !== T.BRIDGE_BROKEN; };
    const phase = mod(fi, 3);
    c.fillStyle = 'rgba(235,248,255,0.75)';
    if (land(tx, ty - 1)) { c.fillRect(sx, sy, 16, 1); for (let i = phase; i < 16; i += 3) c.fillRect(sx + i, sy + 2, 1, 1); }
    if (land(tx, ty + 1)) { c.fillRect(sx, sy + 15, 16, 1); for (let i = phase; i < 16; i += 3) c.fillRect(sx + i, sy + 13, 1, 1); }
    if (land(tx - 1, ty)) { c.fillRect(sx, sy, 1, 16); for (let i = phase; i < 16; i += 3) c.fillRect(sx + 2, sy + i, 1, 1); }
    if (land(tx + 1, ty)) { c.fillRect(sx + 15, sy, 1, 16); for (let i = phase; i < 16; i += 3) c.fillRect(sx + 13, sy + i, 1, 1); }
  },

  drawTree(c, o, camX, camY) {
    const vs = Sprites.tall[o.t], img = vs[o.h % vs.length];
    const w = img.width, hgt = img.height;
    const x = Math.round(o.tx * TS + 8 - w / 2 - camX) + o.shake;
    const y = Math.round(o.ty * TS + 16 - hgt + 1 - camY);
    const sway = Math.round(Math.sin(this.time * 1.4 + o.tx * 0.9 + o.ty * 0.4) * (0.3 + FX.wind * 0.7));
    // fade the canopy if the player is hidden behind it
    const p = this.player, psx = p.x - camX, psy = p.y - camY;
    const behind = psx > x - 2 && psx < x + w + 2 && psy > y - 4 && psy < y + hgt - 12 && p.y + 7 < o.key;
    if (behind) c.globalAlpha = 0.55;
    const split = hgt - 12;
    c.drawImage(img, 0, 0, w, split, x + sway, y, w, split);
    c.drawImage(img, 0, split, w, hgt - split, x, y + split, w, hgt - split);
    c.globalAlpha = 1;
  },

  shadow(c, x, y) {
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.beginPath();
    c.ellipse(Math.round(x), Math.round(y), 5, 2, 0, 0, Math.PI * 2);
    c.fill();
  },

  targetRect() {
    const tg = this.target;
    if (tg.fish) return { x: tg.fish.x - 8, y: tg.fish.y - 8, label: 'Fish', ref: tg.fish.y };
    if (tg.npc) return { x: tg.npc.x - 8, y: tg.npc.y - 8, label: 'Talk', ref: tg.npc.y };
    if (tg.cat) return { x: tg.cat.x - 8, y: tg.cat.y - 8, label: tg.cat.state === 'lost' ? 'Pet' : 'Pet', ref: tg.cat.y };
    const t = World.get(tg.x, tg.y);
    return { x: tg.x * TS, y: tg.y * TS, label: TILE[t].act, ref: tg.y * TS + 8, tile: true };
  },

  drawTargetBox(c, camX, camY) {
    const r = this.targetRect();
    const x = Math.round(r.x - camX), y = Math.round(r.y - camY);
    c.fillStyle = Math.floor(this.time * 3) % 2 ? '#ffffff' : '#ffd84a';
    const L = 4;
    const pulse = Math.floor(this.time * 3) % 2 ? 0 : 1;
    for (const [cx, cy, dx, dy] of [[x - pulse, y - pulse, 1, 1], [x + 15 + pulse, y - pulse, -1, 1], [x - pulse, y + 15 + pulse, 1, -1], [x + 15 + pulse, y + 15 + pulse, -1, -1]]) {
      c.fillRect(Math.min(cx, cx + dx * (L - 1)), cy, L, 1);
      c.fillRect(cx, Math.min(cy, cy + dy * (L - 1)), 1, L);
    }
  },

  drawBuildGhost(c, camX, camY) {
    const b = BUILDABLES[this.building.sel], spot = this.buildSpot();
    const x = spot.tx * TS - camX, y = spot.ty * TS - camY;
    c.globalAlpha = 0.6;
    const img = Sprites.over[b.tile][0];
    c.drawImage(img[Math.floor(this.time * 4) % img.length], x, y);
    c.globalAlpha = 1;
    c.strokeStyle = spot.ok ? '#6fe06a' : '#ff5a4a';
    c.strokeRect(x + 0.5, y + 0.5, 15, 15);
    const text = `${b.name} x${this.inv[b.key]}`;
    const w = PixelFont.width(text) + 6;
    c.fillStyle = 'rgba(10,14,26,0.85)'; c.fillRect(Math.round(x + 8 - w / 2), y - 11, w, 9);
    PixelFont.draw(c, text, Math.round(x + 8 - w / 2) + 3, y - 9, spot.ok ? '#ffffff' : '#ff9a8a', null);
  },

  drawCompass(c, camX, camY) {
    const p = this.player;
    let best = null, bd = 1e9;
    for (const id of [1, 2, 3, 6, 7, 8]) {
      const r = World.points['relic' + id];
      if (!r || World.get(r.x, r.y) !== T.RELIC) continue;
      const d = Math.hypot(r.x * TS + 8 - p.x, r.y * TS + 8 - p.y);
      if (d < bd) { bd = d; best = r; }
    }
    if (!best || bd < 40) return;
    const a = Math.atan2(best.y * TS + 8 - p.y, best.x * TS + 8 - p.x);
    const cx = p.x - camX + Math.cos(a) * 24, cy = p.y - camY + Math.sin(a) * 24;
    c.fillStyle = Math.floor(this.time * 3) % 2 ? '#ffd84a' : '#fff0a0';
    for (let k = 0; k < 4; k++) {
      const w = 3 - k;
      c.fillRect(Math.round(cx + Math.cos(a) * k * 1.5 - w / 2), Math.round(cy + Math.sin(a) * k * 1.5 - w / 2), Math.max(1, w), Math.max(1, w));
    }
  },

  drawTargetLabel(c, camX, camY) {
    const r = this.targetRect();
    const x = Math.round(r.x - camX), y = Math.round(r.y - camY);
    const key = Input.isTouch ? '' : '[E] ';
    let label = r.label;
    if (r.tile) {
      const t = World.get(this.target.x, this.target.y);
      if (TILE[t].chop && !this.flags.axe) label = 'Punch';
      if (TILE[t].mine && !this.flags.pick) label = 'Need pickaxe';
      const hits = this.hits.get(World.idx(this.target.x, this.target.y));
      if (hits && (TILE[t].chop || TILE[t].mine)) {
        const need = this.hitsNeeded(t);
        c.fillStyle = '#1a1420'; c.fillRect(x + 1, y + 16, 14, 3);
        c.fillStyle = '#ffd84a'; c.fillRect(x + 2, y + 17, Math.round(12 * hits / need), 1);
      }
    }
    const text = key + label;
    const w = PixelFont.width(text) + 6;
    const bx = Math.round(x + 8 - w / 2);
    const below = r.tile && r.ref > this.player.y + 4;
    const by = below ? y + 18 : y - (TILE[World.get(Math.floor((r.x + 8) / TS), Math.floor((r.y + 8) / TS))].tall && r.tile ? 26 : 11);
    c.fillStyle = 'rgba(10,14,26,0.85)'; c.fillRect(bx, by, w, 9);
    PixelFont.draw(c, text, bx + 3, by + 2, '#ffffff', null);
    if (key) PixelFont.draw(c, '[E]', bx + 3, by + 2, '#ffd84a', null);
  },

  drawPlayer(c, camX, camY) {
    const p = this.player;
    const px = Math.round(p.x - camX), py = Math.round(p.y - camY);
    if (p.mode === 'sail') {
      const bob = Math.round(Math.sin(this.time * 3) * 1);
      if (this.flags.sailboat) {
        c.drawImage(p.boatFace < 0 ? Sprites.boats.sailboatL : Sprites.boats.sailboat, px - 14, py - 12 + bob);
        c.drawImage(p.sprites[p.dir][0], px - 8 + (p.boatFace < 0 ? 4 : -4), py - 10 + bob);
      } else {
        c.drawImage(Sprites.boats.raft, px - 10, py - 2 + bob);
        c.drawImage(p.sprites[p.dir][0], px - 8, py - 11 + bob);
      }
      return;
    }
    this.shadow(c, px, py + 7);
    if (p.rollT > 0) {
      c.globalAlpha = 0.35;
      c.drawImage(p.sprites[p.dir][1], Math.round(px - 8 - p.vx * 0.04), Math.round(py - 8 - p.vy * 0.04));
      c.globalAlpha = 1;
      c.drawImage(p.sprites[p.dir][Math.floor(p.anim) % 2 ? 1 : 2], px - 8, py - 6);
      return;
    }
    if (p.inv > 0 && p.inv < 0.65 && Math.floor(this.time * 20) % 2) return;
    const frame = p.anim ? [1, 0, 2, 0][Math.floor(p.anim) % 4] : 0;
    const bob = frame ? -1 : 0;
    const dv0 = DIRV[p.dir], lunge = p.attackT > 0.13 ? 2 : p.attackT > 0.04 ? 1 : 0;
    const hurtFlash = p.inv > 0.65;
    const spr = p.sprites[p.dir][frame];
    c.drawImage(hurtFlash ? Sprites.white(spr) : spr, px - 8 + dv0[0] * lunge, py - 8 + bob + dv0[1] * lunge);
    if (p.attackT > 0.04) {
      const dv = DIRV[p.dir];
      const prog = 1 - p.attackT / 0.26;
      const base = Math.atan2(dv[1], dv[0]);
      const reach = [11, 14, 13, 15][this.flags.weapon];
      // crescent swing trail that sweeps across and fades
      const sweep = Math.min(1, prog * 1.8);
      for (let k = 0; k < 12; k++) {
        const f = k / 11;
        if (f > sweep) break;
        const a = base - 1.1 + f * 2.2;
        const fade = 0.25 + 0.75 * (f / Math.max(sweep, 0.01));
        c.fillStyle = `rgba(255,255,255,${(fade * (1 - prog * 0.6)).toFixed(2)})`;
        c.fillRect(Math.round(px + Math.cos(a) * reach), Math.round(py + 3 + Math.sin(a) * reach), 2, 2);
        c.fillStyle = `rgba(200,230,255,${(fade * 0.5 * (1 - prog)).toFixed(2)})`;
        c.fillRect(Math.round(px + Math.cos(a) * (reach - 3)), Math.round(py + 3 + Math.sin(a) * (reach - 3)), 1, 1);
      }
      if (this.flags.weapon) {
        c.fillStyle = ['#8a6236', '#8a6236', '#8aa0b8', '#ff8a2a'][this.flags.weapon];
        for (let k = 3; k < reach; k++) c.fillRect(Math.round(px + dv[0] * k), Math.round(py + 4 + dv[1] * k), 1, 1);
        c.fillStyle = '#c0c0c8';
        c.fillRect(Math.round(px + dv[0] * reach) - 1, Math.round(py + 4 + dv[1] * reach) - 1, 3, 3);
      } else {
        c.fillStyle = '#8a6236';
        c.fillRect(Math.round(px + dv[0] * 7), Math.round(py + 3 + dv[1] * 7), 2, 2);
      }
    }
    if (this.flags.torch && FX.darkness > 0.2) {
      const fx = px + (p.dir === 2 ? -6 : 6), fy = py - 2;
      c.fillStyle = '#8a6236'; c.fillRect(fx, fy + 2, 1, 4);
      c.fillStyle = Math.floor(this.time * 10) % 2 ? '#ffd060' : '#ff8a2a'; c.fillRect(fx - 1, fy, 2, 2);
    }
  },
};

window.addEventListener('load', () => Game.init());
