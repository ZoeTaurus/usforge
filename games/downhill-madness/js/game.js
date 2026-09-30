'use strict';
const CRASH_LINES = ['WIPEOUT!', 'YARD SALE!', 'BONK!', 'SPLAT!', 'OOF!', 'TOTAL CARNAGE', 'EXTREMELY OUCH', 'KABLOOEY!'];
const CLOSE_LINES = ['CLOSE CALL!', 'WHOOSH!', 'SHAVED IT!', 'TOO CLOSE!', 'NEAR MISS!'];
const DEMOLISH_LINES = ['DEMOLISHED!', 'OBLITERATED!', 'GET OUT OF THE WAY!', 'ROCKET SAYS NO', 'SMASHED IT!'];
const SPEED_QUIPS = [
  [150, 'WHEEE!'], [200, 'TOO FAST?'], [250, 'DEFINITELY TOO FAST'],
  [CFG.SOUND_BARRIER, 'SOUND BARRIER BROKEN!'], [420, 'LUDICROUS SPEED'], [520, 'LEAVING THE ATMOSPHERE'],
];

const G = {
  state: 'title',
  time: 0,
  entities: [],
  cam: { x: 0, y: 0, z: 0 },
  player: Player,
  shake: 0, flash: 0, slowmo: 0, gap: 0, surge: 0, caughtT: 0, roll: 0,
  gateSeries: {},

  init() {
    Save.load();
    Missions.ensure();
    Art.init();
    Theme.init();
    Render.init(document.getElementById('game'));
    Input.init();
    UI.init();
    Garage.init();
    Voice.init();
    Input.onBlur = () => { if (this.state === 'play') this.pause(true); };
    this.toTitle();
    let last = performance.now();
    const frame = now => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.tick(dt);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  },

  speedFor(l) { return 4800 + (l - 1) * 950; },

  newWorld(attract) {
    this.track = new Track();
    this.entities.length = 0;
    Player.reset();
    this.attract = attract;
    this.level = attract ? 3 : 1;
    this.maxSpeed = this.speedFor(this.level);
    this.gateSeries = {};
    Director.reset(this, attract ? 6000 : 9000);
    Theme.set(0, true);
    Theme.update(0);
    Particles.list.length = 0;
    HUD.reset();
    Object.assign(this, {
      points: 0, dist: 0, score: 0, combo: 1, comboT: 0,
      gap: CFG.AVA_START_M * CFG.METER, surge: 0, crashes: 0,
      bestTrick: null, bestTrickPts: 0, topSpeed: 0, shake: 0, flash: 0, slowmo: 0, roll: 0,
      quips: {}, warned: false, caughtT: 0, avaDelay: 2, intro: 0, overT: 0, lastCrashZ: 0,
      missionCoins: 0, lastReason: '',
    });
    this.stats = {
      dist: 0, backflips: 0, frontflips: 0, spins: 0, tricks: 0, perfects: 0, bowled: 0, coins: 0, close: 0,
      kmh: 0, level: 1, combo: 1, rotations: 0, powerups: 0, rivals: 0, air: 0, crevasses: 0, gates: 0,
      clean: 0, abducted: 0, demolished: 0,
    };
    this.cam.x = 0;
    this.cam.z = -CFG.PD;
  },

  toTitle() {
    this.newWorld(true);
    this.state = 'title';
    this.showPlayer = true;
    this.showAvalanche = false;
    Player.speed = 5200;
    UI.showTitle();
  },

  start() {
    Sfx.init();
    this.newWorld(false);
    this.state = 'play';
    this.intro = 3;
    this.showPlayer = true;
    this.showAvalanche = true;
    this.lastBeep = 4;
    const bd = Save.data.bestDist;
    if (bd > 150) this.add('bestflag', 0, bd * CFG.METER, { label: `YOUR BEST · ${U.fmt(bd)} m` });
    UI.only(null);
  },

  pause(on) {
    if (on && this.state === 'play') { this.state = 'paused'; UI.showPause(); }
    else if (!on && this.state === 'paused') { this.state = 'play'; UI.only(null); Sfx.init(); }
  },

  add(type, x, z, props) {
    const e = Object.assign({ type, x, z, zPrev: z, y: 0, vx: 0, vy: 0, vz: 0, t: 0, rot: 0, seed: Math.random() * 10 }, props);
    this.entities.push(e);
    return e;
  },

  spawnFx(type, x, z) { this.add(type, x, z); },

  banner(text, color) {
    if (this.attract) return;
    HUD.banner(text, color);
  },

  startSurge() {
    if (this.attract) return;
    this.surge = 4.5;
    HUD.banner('AVALANCHE SURGE!', '#ff3b30', 3);
    Sfx.warn();
  },

  // Everything that scores goes through here so combo and 2× apply consistently.
  award(base) {
    const pts = Math.round(base * this.combo * (this.player.pw.double > 0 ? 2 : 1));
    this.points += pts;
    return pts;
  },

  // ---------------------------------------------------------------- loop
  tick(dt) {
    this.time += dt;
    if (Input.pressed.mute) UI.setMute(Sfx.toggleMute());

    if (this.state === 'paused') {
      if (Input.pressed.pause) this.pause(false);
    } else {
      const sdt = this.slowmo > 0 ? dt * 0.35 : dt;
      this.slowmo -= dt;
      if (this.state === 'title') {
        this.updateAttract(sdt);
        if ((Input.pressed.enter || Input.pressed.jump) && UI.current === 'title') this.start();
      } else if (this.state === 'play') {
        if (Input.pressed.pause) this.pause(true);
        else this.updatePlay(sdt);
      } else if (this.state === 'caught') {
        this.updateCaught(sdt);
      } else if (this.state === 'over') {
        this.overT += dt;
        this.caughtT += dt;
        if (this.overT > 0.8 && (Input.pressed.enter || Input.pressed.jump) && UI.current === 'over') this.start();
      }
      Particles.update(sdt);
      HUD.update(sdt);
      Theme.update(dt);
      Render.updateFlakes(sdt, this.player.speed);
      this.shake = Math.max(0, this.shake - dt * 1.6);
      this.flash = Math.max(0, this.flash - dt * 2.5);
    }

    const playing = this.state === 'play' || this.state === 'paused';
    const gapM = this.gap / CFG.METER;
    Sfx.ambience(this.state === 'title' ? 0.3 : U.clamp(this.player.speed / 16000, 0, 1),
      playing ? U.clamp(1 - gapM / 150, 0, 1) + (this.surge > 0 ? 0.3 : 0) : this.state === 'caught' ? 1 : 0);
    Sfx.updateMusic(this.level, this.state === 'play');

    Render.draw(this);
    Input.endFrame();
  },

  updateAttract(dt) {
    const P = this.player;
    P.x = Math.sin(this.time * 0.45) * 0.55;
    P.lean = Math.cos(this.time * 0.45) * 0.6;
    P.z += P.speed * dt;
    this.updateEntities(dt);
    Director.update(this);
    this.updateCamera(dt);
  },

  updatePlay(dt) {
    const P = this.player;
    if (this.intro > 0) {
      this.intro -= dt;
      const n = Math.ceil(this.intro);
      if (n !== this.lastBeep) { this.lastBeep = n; if (n > 0) Sfx.beep(false); }
      if (this.intro <= 0) {
        Sfx.beep(true);
        HUD.pop('SLED!', '#ffd23f', 1.6);
        Voice.say("Sled! Let's go!", 1, true);
        P.speed = this.maxSpeed * 0.3;
      }
      this.updateCamera(dt);
      return;
    }

    const z0 = P.z;
    P.update(dt, this, true);
    P.z += P.speed * dt;
    this.updateEntities(dt);
    this.collide(z0, P.z);
    Director.update(this);

    // the avalanche
    if (this.avaDelay > 0) this.avaDelay -= dt;
    else {
      this.surge = Math.max(0, this.surge - dt);
      const r = 0.8 + Math.min(0.08, (this.level - 1) * 0.008) + (this.surge > 0 ? 0.5 : 0);
      this.gap = Math.min(CFG.AVA_MAX_M * CFG.METER, this.gap + (P.speed - this.maxSpeed * r) * dt);
    }
    const gapM = this.gap / CFG.METER;
    if (gapM < 45 && !this.warned) { this.warned = true; HUD.banner("IT'S RIGHT BEHIND YOU!", '#ff3b30', 2); Sfx.warn(); Voice.say(U.pick(["It's right behind you!", 'Behind you! Go go go!', 'Faster! Faster!']), 0.9, true); }
    if (gapM > 90) this.warned = false;
    if (gapM < 60) this.shake = Math.max(this.shake, (1 - gapM / 60) * 0.35);
    if (this.gap <= 0) { this.caught(); return; }

    // progress
    this.dist = P.z / CFG.METER;
    this.score = this.points + Math.floor(this.dist);
    this.topSpeed = Math.max(this.topSpeed, P.speed);
    const lvl = 1 + Math.floor(this.dist / CFG.LEVEL_METERS);
    if (lvl > this.level) this.levelUp(lvl);

    if (this.combo > 1) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 1;
    }

    const kmh = P.speed * CFG.KMH;
    for (const [v, txt] of SPEED_QUIPS) {
      if (kmh >= v && !this.quips[v]) {
        this.quips[v] = true;
        if (v === CFG.SOUND_BARRIER) this.sonicBoom();
        else HUD.pop(txt, '#7dfcff', 0.8);
      }
    }
    if (kmh < 300 && this.quips[CFG.SOUND_BARRIER]) this.quips[CFG.SOUND_BARRIER] = false;

    const st = this.stats;
    st.dist = this.dist;
    st.kmh = Math.max(st.kmh, kmh);
    st.level = this.level;
    st.combo = Math.max(st.combo, this.combo);
    st.clean = Math.max(st.clean, (P.z - this.lastCrashZ) / CFG.METER);
    Missions.check(st);

    this.effects(dt);
    this.updateCamera(dt);
  },

  updateCaught(dt) {
    this.caughtT += dt;
    const P = this.player;
    P.tumble += dt;
    P.speed = U.approach(P.speed, 0, P.speed * dt);
    P.z += P.speed * dt;
    this.shake = 0.8;
    this.updateCamera(dt);
    if (this.caughtT > 2.3) this.gameOver();
  },

  updateCamera(dt) {
    const P = this.player;
    this.cam.z = P.z - CFG.PD;
    this.cam.x += (Render.playerShift + P.x * CFG.ROAD_W - this.cam.x) * Math.min(1, dt * 8);
    this.cam.y = this.track.groundY(P.z) + CFG.CAM_H + P.air * 0.75;
    const seg = this.track.get(Math.floor(P.z / CFG.SEG_LEN));
    Render.bgX += seg.curve * (P.speed * dt / CFG.SEG_LEN) * 0.0025;
    // lean the whole world into turns
    const targetRoll = -P.lean * 0.035 - seg.curve * 0.007 * U.clamp(P.speed / 8000, 0, 1.5);
    this.roll += (targetRoll - this.roll) * Math.min(1, dt * 3);
    this.track.trim(Math.floor(this.cam.z / CFG.SEG_LEN));
  },

  updateEntities(dt) {
    const P = this.player, L = this.entities;
    const magnet = P.pw.magnet > 0 && this.state === 'play';
    for (const e of L) {
      e.zPrev = e.z;
      e.t += dt;
      if (e.knock) {
        e.x += e.knock.vx * dt;
        e.z += e.vz * dt;
        e.vy -= CFG.GRAVITY * dt;
        e.y += e.vy * dt;
        e.rot += e.knock.spin * dt;
        if (e.y < 0) { e.y = 0; e.vy = Math.abs(e.vy) * 0.35; e.vz *= 0.6; if (e.vy < 200) e.vy = 0; }
        if (e.t > 2.5) e.dead = true;
      } else {
        const def = ET[e.type];
        if (def.update) def.update(e, dt, this);
        if (magnet && e.type === 'coin') {
          const dz = e.z - P.z;
          if (dz > -100 && dz < 9000) {
            const k = dz < 1500 ? 1 : Math.min(1, dt * 10);
            e.x += (P.x - e.x) * k;
            e.y += (P.air + 60 - e.y) * k;
            e.z -= dz * Math.min(1, dt * 3);
          }
        }
      }
      if (e.z < P.z - CFG.PD - 400) e.dead = true;
    }
    let j = 0;
    for (let i = 0; i < L.length; i++) if (!L[i].dead) L[j++] = L[i];
    L.length = j;
  },

  // ---------------------------------------------------------------- collisions
  collide(z0, z1) {
    const P = this.player;
    for (const e of this.entities) {
      if (e.knock || e.dead) continue;
      const def = ET[e.type];
      if (def.kind === 'none') continue;

      if (def.kind === 'crevasse') { this.crevasse(e, def); continue; }

      const d = def.d || 60;
      const r0 = z0 - e.zPrev, r1 = z1 - e.z;
      if (!e.passed && r0 <= d && r1 > d) { e.passed = true; this.passed(e); }
      if (e.hit || r0 > d || r1 < -d) continue;

      const dx = Math.abs(P.x - e.x) * CFG.ROAD_W;
      if (def.kind === 'gate') {
        if (dx < def.w - 40) this.throughGate(e);
        continue;
      }
      const reach = def.w * (e.s || 1) + CFG.PLAYER_HW;
      const yOver = P.air < e.y + def.h && P.air + CFG.PLAYER_H > e.y;
      if (dx < reach) this.hit(e, def, yOver);
      else if (def.kind === 'crash' && yOver && !e.nm && dx < reach + 240 && P.crash <= 0 && P.speed > 3000) {
        e.nm = true;
        this.bumpCombo();
        this.stats.close++;
        const pts = this.award(100);
        HUD.pop(U.pick(CLOSE_LINES), '#7dfcff', 0.8, `+${pts}`);
        Sfx.close();
        if (e.type === 'duck') Sfx.squeak();
      }
    }
  },

  crevasse(e, def) {
    const P = this.player;
    const inside = P.z >= e.z && P.z <= e.z + def.len;
    if (inside && !P.airborne && !e.hit && P.crash <= 0) {
      e.hit = true;
      if (P.pw.rocket > 0) { P.launch(2000, 'hop'); HUD.pop('ROCKET JUMP!', '#ff7a1f', 1); return; }
      this.crash('Fell into a crevasse');
    }
    if (!e.cleared && P.z > e.z + def.len) {
      e.cleared = true;
      if (!e.hit) {
        this.stats.crevasses++;
        const pts = this.award(300);
        HUD.pop('CREVASSE CLEARED!', '#4db8ff', 1, `+${pts}`);
      }
    }
  },

  passed(e) {
    if (e.type === 'rival' && !e.hit) {
      this.stats.rivals++;
      const pts = this.award(100);
      HUD.pop(`OVERTOOK ${e.name}`, '#ffffff', 0.7, `+${pts}`);
    } else if (e.type === 'bestflag') {
      HUD.pop('NEW RECORD DISTANCE!', '#ffd23f', 1.2);
      HUD.banner('PERSONAL BEST!', '#ffd23f', 2.5);
      Sfx.record();
      Voice.say('New personal record!', 1, true);
      this.flash = 0.4;
    }
  },

  throughGate(e) {
    const P = this.player;
    e.hit = true;
    this.stats.gates++;
    this.bumpCombo();
    P.speed += this.maxSpeed * 0.06;
    const n = (this.gateSeries[e.series] = (this.gateSeries[e.series] || 0) + 1);
    Sfx.gate();
    if (n === e.total) {
      const pts = this.award(1000);
      HUD.pop('ALL GATES!', '#5ee27a', 1.2, `+${pts}`);
      Voice.say('All five gates! Clean sweep!', 0.8);
    } else {
      const pts = this.award(100);
      HUD.pop(`GATE ${n}/${e.total}`, '#ffffff', 0.7, `+${pts}`);
    }
  },

  knock(e, force = 1) {
    const P = this.player;
    e.knock = { vx: (e.x >= P.x ? 1 : -1) * U.rand(0.5, 1.2) * force, spin: U.rand(-12, 12) };
    e.vy = U.rand(1600, 2800) * force;
    e.vz = P.speed * U.rand(0.95, 1.15);
    e.t = 0;
  },

  snowBurst(n = 18) {
    const ps = Render.playerScreen;
    Particles.burst(ps.x, ps.y - 100 * ps.k, n, { speed: 700 * Render.dpr, size: 9 * Render.dpr, life: 0.7, color: '#f4f8ff', g: 900 * Render.dpr });
  },

  hit(e, def, yOver) {
    const P = this.player;
    switch (def.kind) {
      case 'crash':
        if (!yOver || P.crash > 0) return;
        if (P.pw.rocket > 0) {
          e.hit = true;
          this.knock(e, 1.4);
          this.stats.demolished++;
          const pts = this.award(200);
          HUD.pop(U.pick(DEMOLISH_LINES), '#ff7a1f', 0.9, `+${pts}`);
          Sfx.smash(); Sfx.boom(0.5);
          this.shake = Math.max(this.shake, 0.5);
          this.snowBurst(24);
          return;
        }
        if (P.invuln > 0) return;
        e.hit = true;
        if (e.type === 'duck') Sfx.squeak();
        this.crash(`Hit ${def.name}`);
        break;
      case 'smash': {
        if (!yOver || P.crash > 0) return;
        e.hit = true;
        this.knock(e);
        if (P.pw.rocket <= 0) P.speed *= 0.94;
        this.stats.bowled++;
        this.bumpCombo();
        const pts = this.award(150);
        HUD.pop(e.type === 'penguin' ? 'PENGUIN BOWLING!' : 'SNOWMAN SMASHED!', '#ffffff', 0.8, `+${pts}`);
        Sfx.smash();
        if (e.type === 'penguin') Sfx.squeak();
        this.snowBurst();
        break;
      }
      case 'rival': {
        if (!yOver || P.crash > 0) return;
        e.hit = true;
        this.knock(e, 1.2);
        this.stats.rivals++;
        this.bumpCombo();
        P.speed *= 0.95;
        const pts = this.award(300);
        HUD.pop(`SLAMMED ${e.name}!`, '#ff4f7b', 0.9, `+${pts}`);
        Sfx.smash();
        this.shake = Math.max(this.shake, 0.3);
        this.snowBurst();
        break;
      }
      case 'power': {
        if (Math.abs(e.y + 120 - (P.air + 190)) > 320 || P.crash > 0) return;
        e.hit = true; e.dead = true;
        const pw = POWERS[e.p];
        P.pw[e.p] = pw.dur;
        this.stats.powerups++;
        HUD.pop(pw.name, pw.color, 1.1, pw.sub);
        if (e.p === 'rocket') { Sfx.rocket(); Voice.say('Rocket mode! Smash everything!', 1, true); this.flash = 0.3; }
        else if (e.p === 'shield') Sfx.shield();
        else Sfx.magnet();
        const p = Render.toScreen(this, e.x, e.y + 120, e.z);
        if (p) Particles.add({ x: p.x, y: p.y, type: 'ring', color: pw.color, size: Render.H * 0.05, grow: 5, life: 0.5 });
        break;
      }
      case 'ramp':
        if (P.air > 40 || P.crash > 0) return;
        e.hit = true;
        P.launch((900 + P.speed * 0.26) * def.power, e.type);
        if (e.type === 'megaramp') { HUD.pop('MEGA RAMP!', '#ffd23f', 1.1); this.slowmo = 0.25; }
        break;
      case 'bump':
        if (P.air > 20 || P.crash > 0) return;
        e.hit = true;
        P.launch(500 + P.speed * 0.06, 'bump');
        break;
      case 'boost':
        if (P.air > 80 || P.crash > 0) return;
        e.hit = true;
        P.boost = 2.8;
        HUD.pop('BOOST!', '#35f0ff', 1);
        Sfx.boost();
        this.flash = 0.25;
        break;
      case 'coin': {
        if (Math.abs(e.y + 110 - (P.air + 190)) > 300) return;
        e.hit = true; e.dead = true;
        this.stats.coins++;
        this.award(50);
        Sfx.coin();
        const p = Render.toScreen(this, e.x, e.y + 110, e.z);
        if (p) Particles.burst(p.x, p.y, 10, { speed: 500 * Render.dpr, size: 10 * Render.dpr, life: 0.6, color: ['#ffd23f', '#fff3a8'], type: 'star' });
        break;
      }
      case 'beam':
        if (P.air > e.y - 200 || P.crash > 0) return;
        e.hit = true;
        P.launch(3600 + P.speed * 0.12, 'ufo');
        this.stats.abducted++;
        HUD.pop('ABDUCTED!', '#7dff9a', 1.3, 'by extremely polite aliens');
        Sfx.ufo();
        Voice.say('Abducted by aliens!', 0.9, true);
        break;
    }
  },

  bumpCombo() {
    this.combo = Math.min(10, this.combo + 1);
    this.comboT = 5;
  },

  crash(reason) {
    const P = this.player;
    if (P.crash > 0 || P.invuln > 0 || P.pw.rocket > 0) return;
    const ps = Render.playerScreen, d = Render.dpr;
    if (P.pw.shield > 0) {
      P.pw.shield = 0;
      P.invuln = 1.2;
      P.flip = 0; P.spin = 0;
      HUD.pop('SHIELD SAVED YOU!', '#4db8ff', 1, reason);
      Sfx.shieldPop();
      this.shake = 0.4;
      Particles.add({ x: ps.x, y: ps.y - 190 * ps.k, type: 'ring', color: '#9fe3ff', size: Render.H * 0.1, grow: 5, life: 0.5 });
      return;
    }
    P.crash = 1.6;
    P.tumble = 0;
    P.speed *= 0.35;
    P.vy = Math.max(P.vy, 700);
    P.air = Math.max(P.air, 1);
    P.flip = 0; P.spin = 0; P.grab = false;
    this.crashes++;
    this.lastCrashZ = P.z;
    this.combo = 1;
    this.shake = 0.9;
    this.slowmo = 0.3;
    this.lastReason = reason;
    Sfx.crash();
    HUD.pop(U.pick(CRASH_LINES), '#ff5a5f', 1.2, reason);
    Particles.burst(ps.x, ps.y - 80 * ps.k, 40, { speed: 1100 * d, size: 14 * d, life: 1, color: ['#ffffff', '#e4eefa', '#cfe0f1'], g: 1400 * d });
    Particles.burst(ps.x, ps.y - 200 * ps.k, 8, { speed: 600 * d, size: 16 * d, life: 0.9, color: '#ffd23f', type: 'star' });
  },

  landed(flips, spins, back, airTime, grabT, sketchy, perfect) {
    const P = this.player, st = this.stats;
    const ps = Render.playerScreen, d = Render.dpr;
    Particles.burst(ps.x, ps.gy, 16, { angle: -Math.PI / 2, spread: 1.4, speed: 700 * d, size: 10 * d, life: 0.6, color: '#f4f8ff', g: 1600 * d });
    st.air = Math.max(st.air, airTime);
    const parts = [];
    if (flips) {
      const mult = flips === 1 ? '' : ['', '', 'DOUBLE ', 'TRIPLE ', 'QUADRUPLE ', 'QUINTUPLE '][flips] || `${flips}× `;
      parts.push(mult + (back ? 'BACKFLIP' : 'FRONTFLIP'));
    }
    if (spins) parts.push(String(spins * 360));
    if (grabT > 0.3) parts.push('SUPERMAN');
    if (!parts.length) {
      if (airTime > 1.4) {
        const pts = this.award(airTime * 100);
        HUD.pop('BIG AIR', '#ffffff', 0.8, `+${pts}`);
      }
      return;
    }
    let name = parts.join(' + ');
    if (flips && spins && flips + spins >= 3) name = 'CORKSCREW ' + name;
    let base = flips * 600 + spins * 400 + grabT * 500 + airTime * 150;
    if (sketchy) base *= 0.5;
    if (perfect) base *= 1.5;
    this.bumpCombo();
    const pts = this.award(base);
    st.tricks++;
    if (back) st.backflips += flips; else st.frontflips += flips;
    st.spins += spins;
    st.rotations = Math.max(st.rotations, flips + spins);
    if (pts > this.bestTrickPts) { this.bestTrickPts = pts; this.bestTrick = name; }
    const n = flips + spins;
    let sub = `+${U.fmt(pts)}  ×${this.combo}`;
    if (sketchy) sub = `SKETCHY LANDING  +${U.fmt(pts)}`;
    else if (n >= 5) sub = `the mountain is concerned  +${U.fmt(pts)}`;
    HUD.pop(name, sketchy ? '#ffb02e' : '#7dfcff', n >= 3 ? 1.2 : 1, sub);
    Sfx.trick(n);
    if (perfect) {
      st.perfects++;
      P.speed += this.maxSpeed * 0.15;
      HUD.pop('PERFECT!', '#5ee27a', 1.3, 'speed boost');
      Sfx.perfect();
      Particles.add({ x: ps.x, y: ps.gy - 80 * ps.k, type: 'ring', color: '#5ee27a', size: Render.H * 0.08, grow: 6, life: 0.5 });
    }
    if (n >= 3) {
      this.flash = 0.3;
      Voice.say(perfect ? `Perfect ${name.toLowerCase()}!` : `${name.toLowerCase()}!`, Math.min(1, 0.55 + n * 0.12));
      Particles.burst(ps.x, ps.y - 150 * ps.k, 24, { speed: 900 * d, size: 14 * d, life: 0.9, color: ['#ffd23f', '#7dfcff', '#ff5a1f', '#ffffff'], type: 'star' });
    } else if (perfect) Voice.say(U.pick(['Perfect!', 'Stuck it!', 'Perfect landing!']), 0.75);
  },

  levelUp(lvl) {
    this.level = lvl;
    this.maxSpeed = this.speedFor(lvl);
    this.track.curveScale = 1 + (lvl - 1) * 0.12;
    const changed = Theme.set(Theme.indexFor(lvl));
    HUD.banner(`MADNESS ${lvl}: ${levelName(lvl).toUpperCase()}`, '#ffd23f', 2.6);
    if (changed) HUD.pop(THEMES[Theme.to].name.toUpperCase(), '#ffffff', 0.7);
    Sfx.level();
    Voice.say(`Madness level ${lvl}! ${levelName(lvl)}!`, Math.min(1, 0.6 + lvl * 0.05), true);
    this.flash = 0.3;
  },

  sonicBoom() {
    const ps = Render.playerScreen;
    const pts = this.award(1000);
    HUD.pop('SOUND BARRIER BROKEN!', '#ffffff', 1.1, `+${U.fmt(pts)}`);
    Sfx.sonic();
    Voice.say('You just broke the sound barrier!', 1, true);
    this.flash = 0.6;
    this.shake = 1;
    for (let i = 0; i < 3; i++) {
      Particles.add({ x: ps.x, y: ps.y - 150 * ps.k, type: 'ring', color: '#ffffff', size: Render.H * 0.15, grow: 6 + i * 3, life: 0.7 + i * 0.15 });
    }
  },

  effects(dt) {
    const P = this.player, ps = Render.playerScreen, d = Render.dpr, k = ps.k;
    if (P.crash > 0 || this.intro > 0) return;
    if (!P.airborne && P.speed > 1500) {
      const n = Math.abs(P.lean) > 0.3 || P.deep ? 3 : 1;
      for (let i = 0; i < n; i++) {
        const side = P.lean !== 0 ? -U.sign(P.lean) : U.pick([-1, 1]);
        Particles.add({
          x: ps.x + side * 150 * k, y: ps.gy - 10 * k, vx: side * U.rand(100, 500) * d, vy: -U.rand(150, 500) * d,
          g: 1500 * d, life: U.rand(0.3, 0.6), size: U.rand(4, 9) * d, color: '#ffffff',
        });
      }
    }
    const onFire = (this.level >= 5 && P.speed > this.maxSpeed * 0.92) || P.sled.fire || P.pw.rocket > 0;
    if (onFire || P.boost > 0) {
      const n = P.pw.rocket > 0 ? 4 : 2;
      for (let i = 0; i < n; i++) {
        Particles.add({
          x: ps.x + U.rand(-140, 140) * k, y: ps.y - U.rand(0, 30) * k, vx: U.rand(-80, 80) * d, vy: U.rand(300, 600) * d,
          life: U.rand(0.18, 0.35), size: U.rand(35, 60) * k * (P.pw.rocket > 0 ? 1.4 : 1), type: 'fire',
        });
      }
    }
    if (this.level >= 7 || P.sled.rainbow) {
      Particles.add({
        x: ps.x + U.rand(-60, 60) * k, y: ps.y - 60 * k, vx: 0, vy: 600 * d,
        life: 0.5, size: 14 * d, color: `hsl(${(this.time * 400) % 360},100%,60%)`,
      });
    }
  },

  caught() {
    this.state = 'caught';
    this.caughtT = 0;
    this.gap = 0;
    const P = this.player;
    P.crash = 99;
    P.tumble = 0;
    P.flip = 0; P.spin = 0;
    Sfx.caught();
    Voice.say(U.pick(['No! No! No! The avalanche got you!', 'Oh no! Buried alive!', 'No! Not like this!']), 1, true);
    HUD.pop('NOOOOOO', '#ff5a5f', 1.6);
    const kmh = Math.round(P.speed * CFG.KMH);
    this.overLine = U.pick([
      `The avalanche caught you at ${kmh} km/h after ${U.fmt(this.dist)} metres.`,
      `${U.fmt(this.dist)} metres down the mountain, the mountain came down on you.`,
      `You are now part of the avalanche. It says thanks for the ${this.stats.tricks} tricks.`,
    ]);
    if (this.lastReason && this.crashes) this.overLine += ` Last wipeout: ${this.lastReason.toLowerCase()}.`;
  },

  gameOver() {
    this.state = 'over';
    this.overT = 0;
    this.score = this.points + Math.floor(this.dist);
    const d = Save.data;
    const isBest = this.score > d.best;
    if (isBest) d.best = this.score;
    d.bestDist = Math.max(d.bestDist, Math.floor(this.dist));
    const distCoins = Math.floor(this.dist / 100);
    this.earned = { coins: this.stats.coins, dist: distCoins, missions: this.missionCoins };
    d.bank += this.stats.coins + distCoins;
    Save.addRun({ score: this.score, dist: Math.floor(this.dist), level: this.level, date: Date.now() });
    Save.write();
    UI.showOver(this, isBest);
    Missions.ensure();
  },
};

window.addEventListener('load', () => G.init());
