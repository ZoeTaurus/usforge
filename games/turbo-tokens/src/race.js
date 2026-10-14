// A single race: builds the world, spawns the cars, runs physics, AI,
// camera, effects and HUD, and reports results when the player finishes.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/+esm';
import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/postprocessing/EffectComposer.js/+esm';
import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/postprocessing/RenderPass.js/+esm';
import { UnrealBloomPass } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/postprocessing/UnrealBloomPass.js/+esm';
import { OutputPass } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/postprocessing/OutputPass.js/+esm';
import { TrackPath } from './tracks.js';
import { buildWorld, gridSlot } from './world.js';
import { carBubble } from './underwater.js';
import { CarModel } from './carModel.js';
import { Vehicle, AIDriver, speedProfile } from './vehicle.js';
import { computeStats, difficultyDef, bestParts, WHEELS, SPOILERS, FINISHES, BUBBLES, HORNS } from './state.js';
import { Trail } from './style.js';
import { GhostRecorder, GhostCar, loadGhost } from './ghost.js';
import { dailyLive } from './daily.js';
import { Particles, SkidMarks } from './effects.js';
import { HUD } from './hud.js';
import { audio } from './audio.js';
import { mulberry32, clamp, damp, wrapAngle, lerp, smoothstep, ordinal, shuffle, formatTime } from './utils.js';

const _v = new THREE.Vector3();
const AI_NAMES = ['Blaze', 'Viper', 'Nova', 'Rocket', 'Shadow', 'Comet', 'Ziggy', 'Dash', 'Maverick', 'Luna', 'Bolt', 'Pixel'];
const COUNTDOWN = 3.6;
const SUBSTEP = 1 / 120;
const REC_STEP = 1 / 20; // highlight recording rate
const REC_VALS = 9; // x, z, heading, speed, steer, flags, yaw, y, slope
const F_BOOST = 1;
const F_DRIFT = 2;
const F_BRAKE = 4;
const F_OFFROAD = 8;
const F_SLIDE = 16;

function aiCarConfig(rand, color, night) {
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const bodies = ['street', 'street', 'muscle', 'muscle', 'buggy', 'formula'];
  return {
    body: pick(bodies),
    color,
    accent: pick(['#f5f5f5', '#111214', '#ffc400', '#f5f5f5']),
    finish: pick(FINISHES).id,
    wheels: pick(WHEELS).id,
    rimColor: pick(['#c9ced6', '#111214', '#c9a227', '#f5f5f5']),
    spoiler: pick(SPOILERS).id,
    stripes: pick(['none', 'racing', 'side']),
    underglow: night && rand() < 0.6 ? pick(['#22e4ff', '#ff2fa8', '#7cff4a', '#ffd23f']) : null,
    number: 2 + Math.floor(rand() * 97),
  };
}

export class Race {
  constructor({ renderer, track, laps, playerCar, quality, input, hudRoot, onFinish, difficulty = 'medium', playerName = 'YOU', ghost = false, dailyOpen = true, onDailyToggle = null }) {
    this.renderer = renderer;
    this.def = track;
    this.laps = laps;
    this.quality = quality;
    this.input = input;
    this.onFinish = onFinish;
    const T = track.theme;
    this.theme = T;
    const hi = quality === 'high';
    const rand = mulberry32((Date.now() & 0xffff) ^ track.seed);

    this.path = new TrackPath(track);
    this.world = buildWorld(track, this.path, { quality, renderer });
    this.scene = this.world.scene;
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 6000);
    this.grip = T.grip;

    // --- Cars ------------------------------------------------------------
    const n = 5;
    const diff = difficultyDef(difficulty);
    this.difficulty = diff;
    const [lo, hiSkill] = track.aiSkill;
    const skills = Array.from({ length: n }, (_, k) => clamp(hiSkill - ((hiSkill - lo) * k) / (n - 1) + diff.skill, 0.6, diff.maxSkill || 1.02));
    const names = shuffle(AI_NAMES.slice(), rand).slice(0, n);
    const vivid = ['#e3242b', '#ff6a13', '#ffc400', '#7ed321', '#13b26b', '#19c3d6', '#2f6bff', '#8a2be2', '#ff3ea5', '#f5f5f5', '#111214'];
    const colors = shuffle(vivid.filter((c) => c.toLowerCase() !== String(playerCar.color).toLowerCase()), rand);
    this.cars = [];
    this.drivers = new Map();
    const profiles = {};
    for (let k = 0; k < n; k++) {
      const cfg = aiCarConfig(rand, colors[k], T.night);
      // On Hard the rivals get the same performance parts as the player.
      if (diff.matchParts) for (const slot of ['engine', 'turbo', 'tyres', 'exhaust', 'nitro']) cfg[slot] = playerCar[slot];
      // On Insane every rival has the best parts in the shop.
      if (diff.maxParts) Object.assign(cfg, bestParts(T.grip));
      const stats = computeStats(cfg, 1);
      stats.maxSpeed *= diff.speed;
      stats.accel *= diff.speed;
      stats.nitroRecharge *= diff.nitroRegen || 1;
      // Hard and Insane rivals also steer sharper and grip harder, so they corner faster.
      stats.steer *= diff.handling || 1;
      stats.grip *= diff.handling || 1;
      const model = new CarModel(cfg, { shadows: hi });
      const car = new Vehicle({ name: names[k], stats, model, color: cfg.color });
      if (!profiles[cfg.body]) profiles[cfg.body] = speedProfile(this.path, stats, this.grip);
      this.drivers.set(car, new AIDriver(car, this.path, profiles[cfg.body], skills[k], rand, diff));
      this.cars.push(car);
    }
    const pstats = computeStats(playerCar, 1);
    const pmodel = new CarModel(playerCar, { shadows: hi });
    this.player = new Vehicle({ name: playerName, stats: pstats, model: pmodel, isPlayer: true, color: playerCar.color });
    this.cars.push(this.player);
    this.playerProfile = speedProfile(this.path, pstats, this.grip);

    // Bubble Reef: every car drives inside a bubble while it is underwater.
    this.uw = T.underwater || null;
    if (T.bubble) {
      this.bubbleTime = { value: 0 };
      const tint = BUBBLES.find((b) => b.id === playerCar.bubble)?.color || null;
      for (const car of this.cars) {
        car.bubble = carBubble(car.model, this.bubbleTime, car.isPlayer ? tint : null);
        car.model.root.add(car.bubble);
        car.bubbleK = 1;
      }
    }

    // Grid: strongest AI on pole, player starts at the back.
    this.cars.forEach((car, k) => {
      const slot = gridSlot(this.path, k);
      car.place(this.path, slot.along, k % 2 === 0 ? 3.4 : -3.4);
      car.progress = car.along - this.path.length;
      car.prevAlong = car.along;
      this.scene.add(car.model.root);
      this.syncModel(car, 0);
    });

    if (T.night) {
      const spot = new THREE.SpotLight(0xfff0d0, T.nightMode ? 130 : T.bloom ? 240 : 420, 120, 0.45, 0.6, 1.6);
      spot.position.set(0, 0.9, 2.2);
      spot.target.position.set(0, 0, 40);
      pmodel.root.add(spot, spot.target);
    }

    // Style: the player's light trail and horn.
    this.playerCar = playerCar;
    if (playerCar.trail && playerCar.trail !== 'none') {
      const pm = this.player.model;
      this.trail = new Trail(playerCar.trail, playerCar.accent, pm.width * 0.36, -pm.length * 0.5);
      this.scene.add(this.trail.mesh);
    }
    this.honkBack = null;

    // Ghost: every lap is recorded; the best one can race along as a see-through car.
    this.ghostRec = new GhostRecorder(track.id, { ...playerCar });
    const ghostData = ghost ? loadGhost(track.id) : null;
    this.ghost = ghostData ? new GhostCar(ghostData, this.scene) : null;
    this.ghostOn = ghost;
    this.ghostLap = null;

    // --- Effects ---------------------------------------------------------
    this.smoke = new Particles(hi ? 900 : 400);
    this.sparks = new Particles(hi ? 1000 : 450, { additive: true });
    this.scene.add(this.smoke.points, this.sparks.points);
    if (this.uw) {
      this.bubbles = new Particles(hi ? 700 : 300);
      this.scene.add(this.bubbles.points);
      this.bubbleColor = new THREE.Color('#e8fbff');
      this.splashColor = new THREE.Color('#ffffff');
    }
    this.skids = new SkidMarks(hi ? 1600 : 700, T.ground === 'snow' ? 0x6d7f96 : 0x111111, T.ground === 'snow' ? 0.4 : 0.55);
    this.scene.add(this.skids.mesh);
    const dust = { grass: '#8b7d5a', sand: '#d9b98a', snow: '#ffffff', city: '#9a9aa8', beach: '#ead6a8', autumn: '#9a7a4a', lava: '#4a3a34', moon: '#b8bac0', seabed: '#dff6ff' }[T.ground];
    this.dustColor = new THREE.Color(dust);
    this.smokeColor = new THREE.Color({ snow: '#f2f6ff', seabed: '#e8fbff' }[T.ground] || '#d9d9d9');
    this.sparkColor = new THREE.Color('#ffb347');
    // Rain: road spray, the sound of rain and the odd lightning strike.
    this.rain = T.weather === 'rain';
    if (this.rain) {
      this.sprayColor = new THREE.Color(T.night ? '#5a6370' : '#d4dbe2');
      this.lightningT = 5 + Math.random() * 8;
      audio.startRain();
    }
    this.nitroSmoke = new THREE.Color(T.night ? '#4a5568' : '#9fb4d0');
    // Blue light from the player's nitro flickering on the road behind the car.
    if (hi) {
      const pm = this.player.model;
      this.nitroLight = new THREE.PointLight(pm.nitroColors[1], 0, 9, 2);
      this.nitroLight.position.set(0, 0.35, -pm.length * 0.5 - 1.8);
      pm.root.add(this.nitroLight);
    }

    // --- Post-processing (bloom for neon maps) -----------------------------
    renderer.toneMappingExposure = T.exposure;
    if (T.bloom && hi) {
      this.composer = new EffectComposer(renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), T.bloom.strength, T.bloom.radius, T.bloom.threshold);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    }

    // --- HUD -------------------------------------------------------------
    this.hud = new HUD(hudRoot, { laps, path: this.path, isTouch: input.isTouch, cars: this.cars });
    input.bindTouch(hudRoot);
    this.hud.onDailyToggle = (open) => this.setDailyOpen(open);
    this.setDailyOpen(dailyOpen);
    this.onDailyToggle = onDailyToggle;
    const cond = track.conditions || {};
    const extras = [track.theme.nightMode && 'NIGHT', cond.rain === 'rain' && 'RAIN', cond.rain === 'blizzard' && 'BLIZZARD'].filter(Boolean);
    this.hud.message([track.name.toUpperCase(), ...extras, diff.name.toUpperCase()].join(' · '), 'title', 2.6);

    this.state = 'countdown';
    this.t = 0;
    this.raceTime = 0;
    this.lastCount = -1;
    this.camMode = 0;
    this.camHeading = this.player.heading;
    this.fov = 62;
    this.shake = 0;
    this.crashCooldown = 0;
    this.paused = false;
    this.finishedT = 0;
    this.reported = false;
    this.ranking = this.cars.slice();
    // Drift combos, performance stats and highlight recording.
    this.drift = { chain: 0, mult: 1, chainTime: 0, grace: 0, active: false, total: 0, best: 0, bestStart: 0, startT: 0 };
    this.perf = { overtakes: 0, topSpeed: 0, topSpeedT: 0, lapsLed: 0, perfectStart: false, earlyThrottle: false, launched: false };
    this.events = [];
    this.rel = new Map(this.cars.filter((c) => !c.isPlayer).map((c) => [c, { ahead: false, since: null }]));
    this.rec = { frames: [], acc: 0 };
    this.hl = null;
    this.hlPlayed = false;
    this.hud.onSkip = () => this.endHighlights();
    this.world.setStartLights(0);
    this.resize(window.innerWidth, window.innerHeight);
    audio.startEngine();
  }

  setCameraMode(m) {
    this.camMode = m % 3;
  }

  syncModel(car, dt) {
    const m = car.model;
    m.root.position.set(car.x, car.y, car.z);
    m.root.rotation.order = 'YXZ';
    m.root.rotation.y = car.heading;
    m.root.rotation.x = -Math.atan(car.slopeAlong);
    m.animate(dt, car.speed, car.steer * 0.5, car.yawRate, car.accelLong, car.offroad);
    m.setBrake((car.ctrl.brake > 0 && car.speed > 1) || (car.ctrl.handbrake && !car.drifting));
    m.setNitro(car.boosting);
    // Fade ghosted (just respawned) cars.
    m.root.visible = car.ghost > 0 ? Math.floor(car.ghost * 10) % 2 === 0 : true;
    if (car.bubble) this.updateBubble(car, car.y, dt);
  }

  // The bubble pops when a car leaves the water and grows back when it dives in.
  updateBubble(car, y, dt) {
    const under = y + 0.9 < this.uw.level;
    const k = car.bubbleK;
    car.bubbleK = under ? Math.min(1, k + dt * 2.2) : Math.max(0, k - dt * 5);
    const b = car.bubble;
    b.visible = car.bubbleK > 0.01;
    const s = under ? 0.55 + 0.45 * car.bubbleK + Math.sin(car.bubbleK * 9) * 0.08 * (1 - car.bubbleK) : 1 + (1 - car.bubbleK) * 0.3;
    b.scale.copy(b.userData.base).multiplyScalar(s);
    b.material.uniforms.uFade.value = car.bubbleK;
  }

  updateStorm(dt) {
    if (!this.rain) return;
    this.lightningT -= dt;
    if (this.lightningT <= 0) {
      this.lightningT = 9 + Math.random() * 14;
      this.hud.flash(this.world.isUnderwater() ? 0.2 : this.theme.night ? 0.75 : 0.45);
      audio.thunder(0.8 + Math.random() * 1.6);
    }
  }

  // Daily challenges panel in the HUD.
  setDailyOpen(open) {
    this.dailyOpen = open;
    this.hud.setDailyOpen(open);
    if (this.onDailyToggle) this.onDailyToggle(open);
  }

  updateDailyHud(dt) {
    this.dailyT = (this.dailyT || 0) - dt;
    if (this.dailyT > 0) return;
    this.dailyT = 0.25;
    const p = this.player;
    const list = dailyLive({
      place: this.ranking.indexOf(p) + 1,
      track: this.def.id,
      difficulty: this.difficulty.id,
      laps: this.laps,
      perf: {
        driftScore: this.drift.total,
        overtakes: this.perf.overtakes,
        topSpeedKmh: Math.round(this.perf.topSpeed * 3.6),
        perfectStart: this.perf.perfectStart,
        lapsLed: this.perf.lapsLed,
      },
      wallHits: p.wallHits,
      launched: this.perf.launched,
      night: !!this.theme.night,
      rain: (this.def.conditions || {}).rain || null,
      newGhost: !!this.newGhost,
      honks: this.honks || 0,
    });
    // Cheer when a challenge gets done during the race.
    if (!this.dailyWas) this.dailyWas = new Map(list.map((c) => [c.type, c.status]));
    for (const c of list) {
      if (c.status === 'ok' && this.dailyWas.get(c.type) !== 'ok') {
        this.hud.popup(`📅 ${c.icon} CHALLENGE DONE!`, 'daily');
        audio.coin();
      }
      this.dailyWas.set(c.type, c.status);
    }
    this.hud.updateDaily(list);
  }

  // Ghost laps run from start line to start line.
  updateGhost(dt) {
    const p = this.player;
    const L = this.path.length;
    const k = Math.floor(p.progress / L);
    if (this.ghostLap == null) this.ghostLap = k;
    if (k > this.ghostLap) {
      this.ghostLap = k;
      if (this.ghostRec.finish(this.raceTime, p, p.progress - (k - 1) * L)) {
        this.newGhost = true;
        if (this.ghostOn && !p.finished) this.hud.popup('👻 NEW GHOST LAP', 'ghost');
      }
      if (!p.finished) {
        this.ghostRec.start(this.raceTime, p.respawns);
        if (this.ghost) this.ghost.start(this.raceTime);
      } else if (this.ghost) {
        this.ghost.stop();
      }
    }
    if (!p.finished) this.ghostRec.sample(this.raceTime, p, p.progress - k * L);
    if (this.ghost) {
      this.ghost.update(this.raceTime, dt);
      this.hud.ghost(p.finished ? null : this.ghost.gap(this.raceTime, p.progress - k * L));
    }
  }

  // Beep! Sometimes a rival close by honks back.
  honk() {
    audio.horn(this.playerCar.horn);
    this.honks = (this.honks || 0) + 1;
    if (this.honkBack || this.state === 'highlights') return;
    const p = this.player;
    const near = this.cars.filter((c) => !c.isPlayer && Math.hypot(c.x - p.x, c.z - p.z) < 30);
    if (near.length && Math.random() < 0.5) {
      const kinds = HORNS.map((h) => h.id);
      this.honkBack = { t: 0.45 + Math.random() * 0.4, kind: kinds[Math.floor(Math.random() * kinds.length)] };
    }
  }

  updateHonk(dt) {
    if (!this.honkBack) return;
    this.honkBack.t -= dt;
    if (this.honkBack.t <= 0) {
      audio.horn(this.honkBack.kind, 0.5);
      this.honkBack = null;
    }
  }

  // Splash, spray and a ring of foam where a car breaks the surface.
  splash(car, entering) {
    const lv = this.uw.level;
    for (let i = 0; i < 46; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 2;
      this.smoke.emit(car.x + Math.cos(a) * r, lv + 0.2, car.z + Math.sin(a) * r,
        car.vx * 0.35 + Math.cos(a) * (2 + Math.random() * 4), 3 + Math.random() * 7, car.vz * 0.35 + Math.sin(a) * (2 + Math.random() * 4),
        0.5 + Math.random() * 0.5, 0.5 + Math.random() * 0.6, this.splashColor, 0.8, 1.4);
    }
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      this.smoke.emit(car.x + Math.cos(a) * 1.5, lv + 0.15, car.z + Math.sin(a) * 1.5, Math.cos(a) * 5 + car.vx * 0.2, 0.1, Math.sin(a) * 5 + car.vz * 0.2,
        1.2, 1.2, this.splashColor, 0.5, 2.5);
    }
    if (this.bubbles && entering) {
      for (let i = 0; i < 40; i++) {
        this.bubbles.emit(car.x + (Math.random() - 0.5) * 3, lv - 0.5 - Math.random() * 2, car.z + (Math.random() - 0.5) * 3,
          (Math.random() - 0.5) * 2, 1 + Math.random() * 3, (Math.random() - 0.5) * 2, 0.2 + Math.random() * 0.3, 1 + Math.random(), this.bubbleColor, 0.7, 0.1);
      }
    }
  }

  update(dt) {
    for (const p of this.input.consume()) {
      if (this.state === 'highlights') {
        if (p === 'pause' || p === 'skip') this.endHighlights();
        continue;
      }
      if (p === 'camera') this.camMode = (this.camMode + 1) % 3;
      if (p === 'horn') this.honk();
      if (p === 'daily') this.setDailyOpen(!this.dailyOpen);
      if (p === 'pause' && this.onPause && this.state !== 'done') this.onPause();
      if (p === 'reset' && this.state === 'racing' && !this.player.finished) this.player.respawn(this.path);
    }
    if (this.paused) return;
    if (this.state === 'highlights') {
      this.updateHighlights(dt);
      return;
    }
    this.t += dt;

    if (this.state === 'countdown') this.updateCountdown();
    else this.raceTime += dt;

    const racing = this.state !== 'countdown';
    if (racing) {
      // Controls.
      const pc = this.player.ctrl;
      if (this.player.finished) Object.assign(pc, this.autopilot.think(dt, this.cars, 0));
      else Object.assign(pc, this.input.read());
      // Perfect start: hit the gas right as the lights turn green.
      if (!this.perf.launched && pc.throttle > 0) {
        this.perf.launched = true;
        if (!this.perf.earlyThrottle && this.raceTime < 0.5) {
          this.perf.perfectStart = true;
          this.player.launchBoost = 1.4;
          this.hud.message('PERFECT START!', 'best', 1.6);
          audio.whoosh();
        }
      }
      for (const [car, drv] of this.drivers) drv.think(dt, this.cars, car.progress - this.player.progress);

      const steps = Math.min(8, Math.ceil(dt / SUBSTEP));
      const h = dt / steps;
      for (let s = 0; s < steps; s++) {
        for (const car of this.cars) car.step(h, car.ctrl, this.path, this.grip);
        this.collideCars();
      }
      for (const car of this.cars) this.trackProgress(car, dt);
      this.updateGhost(dt);
      if (!this.player.finished) {
        this.updateDrift(dt);
        this.updatePerf();
      }
      this.record(dt);
    } else {
      // Rev the engine on the grid. Holding the gas too early spoils a perfect start.
      const c = this.input.read();
      this.player.ctrl.throttle = c.throttle;
      if (c.throttle && this.t > COUNTDOWN - 0.6) this.perf.earlyThrottle = true;
      if (this.t > 1.4 && !this.startTip) {
        this.startTip = true;
        this.hud.tip('Hit the GAS right when the lights turn GREEN for a perfect start!', 2.4);
      }
    }

    for (const car of this.cars) {
      this.syncModel(car, dt);
      this.carEffects(car, dt);
    }
    this.smoke.update(dt);
    this.sparks.update(dt);
    this.updateWater(dt);
    this.updateStorm(dt);

    this.ranking = this.cars.slice().sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      return b.progress - a.progress;
    });

    this.updateCamera(dt);
    this.updateNitroLight();
    if (this.trail) this.trail.update(dt, this.player.model.root, this.camera, Math.abs(this.player.speed));
    this.updateHonk(dt);
    this.world.update(dt, this.camera, this.player);

    const p = this.player;
    const fwdDot = Math.sin(p.heading) * this.path.tx[p.trackIdx] + Math.cos(p.heading) * this.path.tz[p.trackIdx];
    p.wrongWay = racing && !p.finished && fwdDot < -0.3 && Math.abs(p.speed) > 2 ? p.wrongWay + dt : 0;
    this.hud.update({ player: p, ranking: this.ranking, raceTime: this.raceTime, cars: this.cars, dt, wrongWay: p.wrongWay > 1, drift: this.drift });
    if (racing && this.raceTime > 3 && !this.driftTip) {
      this.driftTip = true;
      this.hud.tip(this.input.isTouch ? 'Hold DRIFT while turning to drift and score points!' : 'Hold E while turning to DRIFT and score points!', 4);
    }
    this.hud.updateTags(this.camera, this.cars, this.width, this.height);
    this.updateDailyHud(dt);

    audio.updateEngine(
      p.speed / p.stats.maxSpeed,
      p.ctrl.throttle,
      clamp((Math.abs(p.slip) - 3) / 6, 0, 1) + (p.drifting ? 0.4 : p.ctrl.handbrake && Math.abs(p.speed) > 8 ? 0.3 : 0),
      p.boosting,
      p.offroad && Math.abs(p.speed) > 5,
    );
    if (p.boosting && !this.wasBoosting) audio.whoosh();
    this.wasBoosting = p.boosting;

    if (this.state === 'finished') {
      this.finishedT += dt;
      if (this.finishedT > 2.6 && !this.hlPlayed) this.startHighlights();
    }
  }

  // ---------------------------------------------------------------------------
  // Drift combos
  // ---------------------------------------------------------------------------
  updateDrift(dt) {
    const d = this.drift;
    const p = this.player;
    if (p.drifting && p.driftAngle > 0.15 && Math.abs(p.speed) > 8) {
      if (!d.active && d.grace <= 0) {
        d.chain = 0;
        d.mult = 1;
        d.chainTime = 0;
        d.startT = this.raceTime;
      }
      d.active = true;
      d.grace = 1.2;
      d.chain += Math.hypot(p.vx, p.vz) * p.driftAngle * dt * 12;
      d.chainTime += dt;
      const mult = Math.min(5, 1 + Math.floor(d.chainTime / 2));
      if (mult > d.mult) audio.tone(600 + mult * 120, 0.12, { type: 'triangle', vol: 0.08 });
      d.mult = mult;
    } else if (d.active || d.grace > 0) {
      d.active = false;
      d.grace -= dt;
      if (d.grace <= 0) this.bankDrift();
    }
  }

  bankDrift() {
    const d = this.drift;
    const pts = Math.round(d.chain * d.mult);
    if (pts >= 50) {
      d.total += pts;
      this.hud.popup(`+${pts.toLocaleString()} DRIFT${d.mult > 1 ? ` ×${d.mult}` : ''}`, 'drift');
      audio.coin();
      if (pts > d.best) {
        d.best = pts;
        d.bestStart = d.startT;
      }
    }
    d.chain = 0;
    d.mult = 1;
    d.chainTime = 0;
    d.grace = 0;
    d.active = false;
  }

  failDrift() {
    const d = this.drift;
    if (d.chain > 20) this.hud.popup('DRIFT LOST!', 'lost');
    d.chain = 0;
    d.mult = 1;
    d.chainTime = 0;
    d.grace = 0;
    d.active = false;
  }

  // Overtakes, top speed and other things that earn bonus tokens.
  updatePerf() {
    const p = this.player;
    const t = this.raceTime;
    if (p.speed > this.perf.topSpeed) {
      this.perf.topSpeed = p.speed;
      this.perf.topSpeedT = t;
    }
    for (const [c, r] of this.rel) {
      const ahead = p.progress > c.progress + 0.5;
      if (ahead && !r.ahead) {
        if (r.since === null) r.since = t;
        if (t - r.since >= 1.2) {
          r.ahead = true;
          this.perf.overtakes++;
          const rank = this.ranking.indexOf(p) + 1;
          this.events.push({ type: 'overtake', t: r.since, score: 7 - rank + (rank === 1 ? 4 : 0), name: c.name, rank });
          this.hud.popup(rank === 1 ? 'TAKING THE LEAD!' : 'OVERTAKE!', 'overtake');
          r.since = null;
        }
      } else if (!ahead) {
        r.since = null;
        if (r.ahead && p.progress < c.progress - 0.5) r.ahead = false;
      }
    }
  }

  updateCountdown() {
    const t = this.t;
    const step = Math.floor(t - 0.6);
    if (step !== this.lastCount && step >= 0 && step <= 3) {
      this.lastCount = step;
      if (step < 3) {
        this.hud.countdown(String(3 - step));
        this.world.setStartLights([2, 4, 5][step]);
        audio.beep(false);
      }
    }
    if (t >= COUNTDOWN) {
      this.state = 'racing';
      if (this.difficulty.launch) for (const c of this.cars) if (!c.isPlayer) c.launchBoost = 0.9 + Math.random() * 0.5;
      this.hud.countdown('GO!', 'go');
      this.world.setStartLights(0, true);
      audio.beep(true);
      setTimeout(() => this.hud && this.hud.countdown(''), 900);
    }
  }

  collideCars() {
    const cars = this.cars;
    const R = 1.0;
    for (let a = 0; a < cars.length; a++) {
      const A = cars[a];
      if (A.ghost > 0) continue;
      for (let b = a + 1; b < cars.length; b++) {
        const Bc = cars[b];
        if (Bc.ghost > 0) continue;
        const dx0 = A.x - Bc.x;
        const dz0 = A.z - Bc.z;
        if (dx0 * dx0 + dz0 * dz0 > 49) continue;
        const ha = A.model.length * 0.27;
        const hb = Bc.model.length * 0.27;
        for (const sa of [-1, 1]) {
          for (const sb of [-1, 1]) {
            const ax = A.x + Math.sin(A.heading) * ha * sa;
            const az = A.z + Math.cos(A.heading) * ha * sa;
            const bx = Bc.x + Math.sin(Bc.heading) * hb * sb;
            const bz = Bc.z + Math.cos(Bc.heading) * hb * sb;
            const dx = ax - bx;
            const dz = az - bz;
            const d = Math.hypot(dx, dz);
            const min = R * 2;
            if (d >= min || d < 1e-4) continue;
            const nx = dx / d;
            const nz = dz / d;
            const pen = (min - d) / 2;
            A.x += nx * pen;
            A.z += nz * pen;
            Bc.x -= nx * pen;
            Bc.z -= nz * pen;
            const vrel = (A.vx - Bc.vx) * nx + (A.vz - Bc.vz) * nz;
            if (vrel < 0) {
              const j = (-(1 + 0.25) * vrel) / 2;
              A.vx += nx * j;
              A.vz += nz * j;
              Bc.vx -= nx * j;
              Bc.vz -= nz * j;
              if ((A.isPlayer || Bc.isPlayer) && -vrel > 2.5) {
                A.impact = Math.max(A.impact, -vrel * 0.7);
                Bc.impact = Math.max(Bc.impact, -vrel * 0.7);
                this.bumpAt = [(ax + bx) / 2, (az + bz) / 2];
              }
            }
          }
        }
      }
    }
  }

  trackProgress(car, dt) {
    const L = this.path.length;
    let d = car.along - car.prevAlong;
    if (d > L / 2) d -= L;
    if (d < -L / 2) d += L;
    car.progress += d;
    car.prevAlong = car.along;

    if (!car.finished) {
      const done = Math.floor(car.progress / L);
      if (done > car.lapsCompleted) {
        car.lapsCompleted = done;
        const lap = this.raceTime - car.lapStart;
        const prevBest = car.bestLap;
        car.lapTimes.push(lap);
        car.bestLap = Math.min(car.bestLap, lap);
        car.lapStart = this.raceTime;
        if (car.isPlayer && this.ranking[0] === car) this.perf.lapsLed++;
        if (done >= this.laps) {
          car.finished = true;
          car.finishTime = this.raceTime;
          if (car.isPlayer) this.playerFinished();
        } else if (car.isPlayer) {
          if (done === this.laps - 1) this.hud.message('FINAL LAP!', 'final', 2.2);
          else if (lap < prevBest) this.hud.message('NEW BEST LAP', 'best', 1.8);
          else this.hud.message(`LAP ${done + 1}`, '', 1.4);
          audio.coin();
        }
      }
    }

    // Stuck detection.
    if (this.state !== 'countdown' && Math.abs(car.speed) < 1.5) car.stuck += dt;
    else car.stuck = 0;
    if (!car.isPlayer && car.stuck > 3) car.respawn(this.path);
    if (car.isPlayer && car.stuck > 4 && !car.finished && Math.abs(car.lateral) > this.path.halfWidth) {
      this.hud.message('Press R to reset', '', 1.5);
      car.stuck = 0;
    }
  }

  playerFinished() {
    if (this.drift.chain > 0) this.bankDrift();
    const place = this.cars.filter((c) => c.finished).length;
    this.playerPlace = place;
    this.state = 'finished';
    this.finishedT = 0;
    this.autopilot = new AIDriver(this.player, this.path, this.playerProfile, 0.85, Math.random);
    this.hud.message(place === 1 ? 'YOU WIN!' : `${ordinal(place)} PLACE`, place === 1 ? 'win' : 'final', 4);
    audio.fanfare(place <= 3);
  }

  report() {
    this.reported = true;
    const L = this.path.length;
    const total = this.laps * L;
    for (const c of this.cars) {
      if (c.finished) continue;
      const avg = Math.max(8, c.progress / Math.max(1, this.raceTime));
      c.finishTime = this.raceTime + Math.max(0, total - c.progress) / avg;
      c.estimated = true;
    }
    const standings = this.cars
      .slice()
      .sort((a, b) => a.finishTime - b.finishTime)
      .map((c) => ({ name: c.name, color: c.color, time: c.finishTime, best: c.bestLap, isPlayer: c.isPlayer, estimated: !!c.estimated }));
    const aiBest = Math.min(...this.cars.filter((c) => !c.isPlayer).map((c) => c.bestLap));
    this.onFinish({
      place: this.playerPlace,
      standings,
      fastestLap: this.player.bestLap < aiBest,
      clean: this.player.wallHits === 0,
      bestLap: this.player.bestLap,
      totalTime: this.player.finishTime,
      perf: {
        overtakes: this.perf.overtakes,
        driftScore: this.drift.total,
        bestDrift: this.drift.best,
        topSpeedKmh: Math.round(this.perf.topSpeed * 3.6),
        perfectStart: this.perf.perfectStart,
        lapsLed: this.perf.lapsLed,
      },
    });
  }

  carEffects(car, dt) {
    const m = car.model;
    const sinH = Math.sin(car.heading);
    const cosH = Math.cos(car.heading);
    const spd = Math.abs(car.speed);
    const camD = Math.hypot(car.x - this.camera.position.x, car.z - this.camera.position.z);
    const near = camD < 110;

    // Wall impacts.
    if (car.impact > 0) {
      if (car.impact > 3) {
        if (car.isPlayer && this.state !== 'countdown' && !car.finished) car.wallHits++;
        if (near) {
          const [bx, bz] = this.bumpAt && car.impact < 20 ? this.bumpAt : [car.x, car.z];
          for (let i = 0; i < Math.min(24, car.impact * 2); i++) {
            this.sparks.emit(bx + (Math.random() - 0.5), car.y + 0.5 + Math.random() * 0.5, bz + (Math.random() - 0.5),
              (Math.random() - 0.5) * 10, 2 + Math.random() * 5, (Math.random() - 0.5) * 10, 0.35, 0.4 + Math.random() * 0.3, this.sparkColor, 1, -0.3);
          }
        }
        if (car.isPlayer) {
          if (this.drift.active || this.drift.grace > 0) this.failDrift();
          if (car.impact > 6 && this.state === 'racing' && !car.finished) this.events.push({ type: 'crash', t: this.raceTime, score: car.impact });
          this.shake = Math.min(0.5, car.impact * 0.04);
          if (this.crashCooldown <= 0) {
            audio.crash(car.impact / 8);
            this.crashCooldown = 0.3;
          }
        }
      }
      car.impact = 0;
      this.bumpAt = null;
    }
    if (car.isPlayer) this.crashCooldown -= dt;

    if (this.uw) {
      const under = car.y + 0.6 < this.uw.level;
      if (car.wasUnder !== undefined && under !== car.wasUnder) {
        if (near) this.splash(car, under);
        if (car.isPlayer) {
          audio.splash(under);
          if (!under) audio.pop();
        }
      }
      car.wasUnder = under;
      // A stream of little bubbles behind each car underwater.
      if (under && near && spd > 4 && Math.random() < (car.isPlayer ? 0.9 : 0.5)) {
        const n = car.boosting ? 3 : 1;
        for (let i = 0; i < n; i++) {
          const back = m.length * 0.55;
          this.bubbles.emit(car.x - sinH * back + (Math.random() - 0.5) * 1.6, car.y + 0.3 + Math.random() * 1.0, car.z - cosH * back + (Math.random() - 0.5) * 1.6,
            (Math.random() - 0.5) * 0.8 - sinH * 1.5, 1.2 + Math.random() * 1.8, (Math.random() - 0.5) * 0.8 - cosH * 1.5,
            0.16 + Math.random() * 0.22, 1.4 + Math.random(), this.bubbleColor, 0.55, 0.05);
        }
      }
    }

    // Nitro ignition (burst, FWOOMP, a little shake) and the backfire pops after it.
    if (car.boosting !== !!car.wasBoostFx) {
      car.wasBoostFx = car.boosting;
      if (car.boosting) {
        if (near) this.nitroBurst(car);
        if (car.isPlayer) {
          audio.nitroIgnite();
          this.shake = Math.max(this.shake, 0.22);
        }
      } else if (car.isPlayer) {
        audio.backfire();
      }
    }

    if (!near || this.state === 'countdown') {
      for (let w = 0; w < 4; w++) this.skids.lift(`${car.name}${w}`);
      return;
    }
    const sliding = Math.abs(car.slip) > 4 || (car.ctrl.handbrake && spd > 8) || (car.ctrl.brake && car.speed > 20);
    // In open water there is nothing to leave marks on: drifting blows bubbles instead.
    const underwater = this.uw && car.wasUnder;
    const wheels = m.def.wheels;
    for (let w = 0; w < wheels.length; w++) {
      const wd = wheels[w];
      if (wd.front) continue;
      const wx = car.x + cosH * wd.x + sinH * wd.z;
      const wz = car.z - sinH * wd.x + cosH * wd.z;
      const key = `${car.name}${w}`;
      if (sliding && underwater) {
        if (Math.random() < (car.drifting ? 0.9 : 0.4)) {
          this.bubbles.emit(wx, car.y + Math.random() * 0.6, wz, car.vx * 0.1 + (Math.random() - 0.5) * 2, 0.8 + Math.random() * 2, car.vz * 0.1 + (Math.random() - 0.5) * 2,
            0.25 + Math.random() * 0.3, 1.2 + Math.random(), this.bubbleColor, 0.6, 0.15);
        }
      }
      if (sliding && !car.offroad && !underwater) {
        this.skids.add(key, wx, wz, cosH, -sinH, 0.32, clamp((Math.abs(car.slip) - 2) / 6, 0.4, 1), car.y);
        if (Math.random() < (car.drifting ? 0.85 : car.isPlayer ? 0.5 : 0.25)) {
          const big = car.drifting ? 1.5 : 1;
          this.smoke.emit(wx, car.y + 0.3, wz, car.vx * 0.15 + (Math.random() - 0.5), 0.5 + Math.random() * 0.8, car.vz * 0.15 + (Math.random() - 0.5),
            0.7 * big, 0.7 + Math.random() * 0.5 * big, this.smokeColor, 0.22, 1.8 * big);
        }
      } else {
        this.skids.lift(key);
      }
      if (car.offroad && spd > 6 && Math.random() < (car.isPlayer ? 0.5 : 0.3)) {
        this.smoke.emit(wx, car.y + 0.3, wz, car.vx * 0.2 + (Math.random() - 0.5) * 2, 0.6 + Math.random(), car.vz * 0.2 + (Math.random() - 0.5) * 2,
          0.9, 0.7 + Math.random() * 0.5, this.dustColor, 0.35, 2.4);
      }
    }
    // Spray off the wet road.
    if (this.rain && !underwater && spd > 12 && Math.random() < (car.isPlayer ? 0.7 : 0.45)) {
      for (const wd of wheels) {
        if (wd.front) continue;
        this.smoke.emit(car.x + cosH * wd.x + sinH * (wd.z - 0.3), car.y + 0.25, car.z - sinH * wd.x + cosH * (wd.z - 0.3),
          car.vx * 0.2 + (Math.random() - 0.5) * 1.5, 0.5 + Math.random() * 0.8, car.vz * 0.2 + (Math.random() - 0.5) * 1.5,
          0.6, 0.55 + Math.random() * 0.3, this.sprayColor, 0.2, 2.6);
      }
    }
    if (car.boosting) this.nitroParticles(m, car.x, car.y, car.z, car.heading, car.vx, car.vz, car.isPlayer ? 3 : 1.5);
  }

  updateNitroLight() {
    if (!this.nitroLight) return;
    const n = this.player.model.nitroFx;
    const k = Math.max(n.k, n.fire * 0.6);
    this.nitroLight.intensity = k > 0.01 ? k * (4 + Math.random() * 2.5) + n.burst * 6 : 0;
    if (n.fire > n.k) this.nitroLight.color.set('#ff8a2a');
    else this.nitroLight.color.copy(this.player.model.nitroColors[1]);
  }

  // Sparks, glowing embers and a heat puff blasting out of each exhaust.
  nitroParticles(m, x, y, z, heading, vx, vz, rate) {
    const sinH = Math.sin(heading);
    const cosH = Math.cos(heading);
    const cols = m.nitroColors;
    for (const [ex, ey, ez] of m.def.exhaust) {
      const px = x + cosH * ex + sinH * (ez - 0.45);
      const pz = z - sinH * ex + cosH * (ez - 0.45);
      const py = y + ey;
      const n = Math.floor(rate) + (Math.random() < rate % 1 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const sp = 6 + Math.random() * 11;
        this.sparks.emit(px, py + (Math.random() - 0.5) * 0.12, pz,
          vx * 0.55 - sinH * sp + (Math.random() - 0.5) * 2.6, (Math.random() - 0.25) * 2.2, vz * 0.55 - cosH * sp + (Math.random() - 0.5) * 2.6,
          0.16 + Math.random() * 0.3, 0.14 + Math.random() * 0.34, cols[Math.floor(Math.random() * 3)], 0.95, -0.25);
      }
      if (Math.random() < 0.3 * rate) {
        this.sparks.emit(px, py, pz, vx * 0.25 - sinH * 2 + (Math.random() - 0.5), 0.4 + Math.random(), vz * 0.25 - cosH * 2 + (Math.random() - 0.5),
          0.11, 0.6 + Math.random() * 0.5, cols[1], 0.75, 0);
      }
      if (Math.random() < 0.22 * rate) {
        this.smoke.emit(px - sinH * 1.4, py, pz - cosH * 1.4, vx * 0.3, 0.5, vz * 0.3, 0.45, 0.55, this.nitroSmoke, 0.06, 2.2);
      }
    }
  }

  // The moment the nitro lights: a ring of sparks out of every pipe.
  nitroBurst(car) {
    const m = car.model;
    const sinH = Math.sin(car.heading);
    const cosH = Math.cos(car.heading);
    for (const [ex, ey, ez] of m.def.exhaust) {
      const px = car.x + cosH * ex + sinH * (ez - 0.4);
      const pz = car.z - sinH * ex + cosH * (ez - 0.4);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const r = 3 + Math.random() * 3;
        const side = Math.cos(a) * r;
        this.sparks.emit(px, car.y + ey, pz,
          car.vx * 0.6 + cosH * side - sinH * 4, Math.sin(a) * r, car.vz * 0.6 - sinH * side - cosH * 4,
          0.3, 0.25 + Math.random() * 0.2, m.nitroColors[i % 3], 1, -0.4);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Highlights: record every car 20 times a second, then replay the best bits.
  // ---------------------------------------------------------------------------
  record(dt) {
    if (this.hlPlayed) return;
    const rec = this.rec;
    rec.acc += dt;
    if (rec.acc < REC_STEP) return;
    rec.acc = 0;
    const d = new Float32Array(this.cars.length * REC_VALS);
    this.cars.forEach((c, k) => {
      const o = k * REC_VALS;
      const flags = (c.boosting ? F_BOOST : 0) | (c.drifting ? F_DRIFT : 0) | ((c.ctrl.brake > 0 && c.speed > 1) ? F_BRAKE : 0) |
        (c.offroad ? F_OFFROAD : 0) | (Math.abs(c.slip) > 4 ? F_SLIDE : 0);
      d[o] = c.x;
      d[o + 1] = c.z;
      d[o + 2] = c.heading;
      d[o + 3] = c.speed;
      d[o + 4] = c.steer;
      d[o + 5] = flags;
      d[o + 6] = c.yawRate;
      d[o + 7] = c.y;
      d[o + 8] = c.slopeAlong;
    });
    rec.frames.push({ t: this.raceTime, d });
  }

  // Interpolated recorded state of every car at race time t.
  sample(t) {
    const f = this.rec.frames;
    let lo = 0;
    let hi = f.length - 1;
    if (t <= f[0].t) return f[0].d;
    if (t >= f[hi].t) return f[hi].d;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (f[mid].t <= t) lo = mid;
      else hi = mid;
    }
    const a = f[lo];
    const b = f[hi];
    const k = (t - a.t) / Math.max(1e-6, b.t - a.t);
    const out = this._sample || (this._sample = new Float32Array(a.d.length));
    for (let i = 0; i < a.d.length; i++) {
      const j = i % REC_VALS;
      if (j === 2) out[i] = a.d[i] + wrapAngle(b.d[i] - a.d[i]) * k;
      else if (j === 5) out[i] = k < 0.5 ? a.d[i] : b.d[i];
      else out[i] = a.d[i] + (b.d[i] - a.d[i]) * k;
    }
    return out;
  }

  buildHighlights() {
    const frames = this.rec.frames;
    if (frames.length < 40) return [];
    const end = this.player.finishTime;
    const last = frames[frames.length - 1].t;
    const place = this.playerPlace;
    const cands = [];
    const ov = this.events.filter((e) => e.type === 'overtake').sort((a, b) => b.score - a.score);
    ov.slice(0, 2).forEach((e, i) => {
      const lead = e.rank === 1;
      cands.push({ type: lead ? 'lead' : 'overtake', t: e.t + 0.6, prio: lead ? 10 : 7 - i, title: lead ? 'TAKING THE LEAD!' : 'OVERTAKE!', sub: `You passed ${e.name} for ${ordinal(e.rank)} place` });
    });
    if (this.drift.best >= 300) cands.push({ type: 'drift', t: this.drift.bestStart + 1.6, prio: 8, title: 'BEST DRIFT', sub: `${this.drift.best.toLocaleString()} points` });
    const crash = this.events.filter((e) => e.type === 'crash').sort((a, b) => b.score - a.score)[0];
    if (crash) cands.push({ type: 'crash', t: crash.t, prio: 6, title: 'OUCH!', sub: 'The biggest hit of the race' });
    if (this.perf.topSpeed > 40) cands.push({ type: 'speed', t: this.perf.topSpeedT, prio: 5, title: 'TOP SPEED', sub: `${Math.round(this.perf.topSpeed * 3.6)} km/h` });
    cands.push({ type: 'start', t: 1.6, prio: this.perf.perfectStart ? 9 : 4, title: this.perf.perfectStart ? 'PERFECT START!' : 'LIGHTS OUT!', sub: this.def.name });
    cands.sort((a, b) => b.prio - a.prio);
    const chosen = [];
    for (const c of cands) {
      if (chosen.length >= 4) break;
      if (c.t > end - 4) continue;
      if (chosen.some((o) => Math.abs(o.t - c.t) < 4.4)) continue;
      chosen.push(c);
    }
    chosen.sort((a, b) => a.t - b.t);
    chosen.push({ type: 'finish', t: end, title: place === 1 ? 'VICTORY!' : 'THE FINISH', sub: `${ordinal(place)} place · ${formatTime(end)}` });
    for (const c of chosen) {
      if (c.type === 'start') {
        c.t0 = 0;
        c.t1 = 4.2;
      } else if (c.type === 'finish') {
        c.t0 = Math.max(0, end - 3.4);
        c.t1 = Math.min(last, end + 1.4);
      } else {
        c.t0 = Math.max(0, c.t - 2.6);
        c.t1 = Math.min(last, c.t + 1.6);
      }
      c.rate = c.type === 'crash' ? 0.5 : c.type === 'finish' ? 0.75 : 1;
    }
    return chosen.filter((c) => c.t1 - c.t0 > 1);
  }

  startHighlights(onDone = null) {
    if (!this.hlClips) this.hlClips = this.buildHighlights();
    this.hlPlayed = true;
    this.hlDone = onDone;
    if (!this.hlClips.length) {
      this.endHighlights();
      return;
    }
    this.state = 'highlights';
    if (this.ghost) this.ghost.stop();
    this.hud.ghost(null);
    this.hl = { i: -1, t: 0 };
    this.nextClip();
    this.hud.replay(true, this.hlClips.length);
    audio.stopEngine();
  }

  // Watch the highlights again from the results screen.
  playHighlights(onDone) {
    this.startHighlights(onDone);
  }

  nextClip() {
    const hl = this.hl;
    hl.i++;
    hl.t = 0;
    const clip = this.hlClips[hl.i];
    if (!clip) {
      this.endHighlights();
      return;
    }
    // Pick a trackside spot ahead of where the action happens.
    const mid = this.sample((clip.t0 + clip.t1) / 2);
    const k = this.cars.indexOf(this.player) * REC_VALS;
    const pr = this.path.projectGlobal(mid[k], mid[k + 1]);
    const fin = clip.type === 'finish';
    const idx = fin ? this.path.indexAt(16) : this.path.wrapIndex(pr.index + Math.round(18 / this.path.step));
    const side = pr.lateral >= 0 ? -1 : 1;
    // On Bubble Reef the finish camera floats out past the marker stones.
    const finOff = this.uw ? 11 : 6;
    const off = side * (this.path.halfWidth + (fin ? finOff : 3.5));
    clip.anchor = new THREE.Vector3(this.path.px[idx] + this.path.nx[idx] * off, this.path.py[idx] + (fin ? (this.uw ? 4.2 : 2.8) : 2.1), this.path.pz[idx] + this.path.nz[idx] * off);
    clip.orbit = Math.random() * Math.PI * 2;
    this.hud.replayClip(hl.i, this.hlClips.length, clip);
    audio.whoosh();
  }

  updateHighlights(dt) {
    const hl = this.hl;
    const clip = this.hlClips[hl.i];
    hl.t += dt;
    const rt = clip.t0 + hl.t * clip.rate;
    if (rt >= clip.t1) {
      this.nextClip();
      if (this.state !== 'highlights') return;
    }
    const d = this.sample(Math.min(rt, clip.t1));
    const rdt = dt * clip.rate;
    this.cars.forEach((c, k) => {
      const o = k * REC_VALS;
      const m = c.model;
      const flags = d[o + 5];
      m.root.visible = true;
      m.root.position.set(d[o], d[o + 7], d[o + 1]);
      m.root.rotation.order = 'YXZ';
      m.root.rotation.y = d[o + 2];
      m.root.rotation.x = -Math.atan(d[o + 8]);
      m.animate(rdt, d[o + 3], d[o + 4] * 0.5, d[o + 6], 0, !!(flags & F_OFFROAD));
      m.setNitro(!!(flags & F_BOOST));
      m.setBrake(!!(flags & F_BRAKE));
      if (flags & (F_DRIFT | F_SLIDE) && !(flags & F_OFFROAD) && Math.random() < (flags & F_DRIFT ? 0.9 : 0.4) * clip.rate + 0.1) {
        const sinH = Math.sin(d[o + 2]);
        const cosH = Math.cos(d[o + 2]);
        for (const wd of m.def.wheels) {
          if (wd.front) continue;
          this.smoke.emit(d[o] + cosH * wd.x + sinH * wd.z, d[o + 7] + 0.3, d[o + 1] - sinH * wd.x + cosH * wd.z,
            (Math.random() - 0.5), 0.5 + Math.random() * 0.8, (Math.random() - 0.5), 1.0, 0.9, this.smokeColor, 0.24, 2.2);
        }
      }
      if (flags & F_BOOST) {
        const h = d[o + 2];
        const v = d[o + 3];
        this.nitroParticles(m, d[o], d[o + 7], d[o + 1], h, Math.sin(h) * v, Math.cos(h) * v, (c.isPlayer ? 3 : 1.5) * Math.min(1, clip.rate + 0.3));
      }
    });
    if (this.bubbleTime) this.cars.forEach((c, k) => this.updateBubble(c, d[k * REC_VALS + 7], rdt));
    this.smoke.update(rdt);
    this.sparks.update(rdt);
    this.updateWater(rdt);
    const k = this.cars.indexOf(this.player) * REC_VALS;
    const focus = { x: d[k], y: d[k + 7], z: d[k + 1] };
    this.highlightCamera(clip, d[k], d[k + 1], d[k + 2], (rt - clip.t0) / (clip.t1 - clip.t0), d[k + 7]);
    if (this.trail) this.trail.update(rdt, this.player.model.root, this.camera, Math.abs(d[k + 3]));
    this.updateNitroLight();
    this.world.update(rdt, this.camera, focus);
    this.hud.replayProgress((rt - clip.t0) / (clip.t1 - clip.t0));
  }

  updateWater(dt) {
    if (!this.uw) return;
    if (this.bubbleTime) this.bubbleTime.value += dt;
    this.bubbles.update(dt);
    // Muffle the sound while the camera is underwater.
    const under = this.world.isUnderwater();
    if (under !== this.muffled) {
      this.muffled = under;
      audio.setMuffled(under);
    }
  }

  highlightCamera(clip, x, z, h, u, y = 0) {
    const cam = this.camera;
    const fx = Math.sin(h);
    const fz = Math.cos(h);
    const sx = Math.cos(h);
    const sz = -Math.sin(h);
    let fov = 58;
    switch (clip.type) {
      case 'start':
        cam.position.set(x - fx * (24 - u * 8) + sx * 7, y + 13 - u * 5, z - fz * (24 - u * 8) + sz * 7);
        cam.lookAt(x + fx * 18, y, z + fz * 18);
        break;
      case 'overtake':
        cam.position.set(x + fx * 11 + sx * 3.5, y + 2.4, z + fz * 11 + sz * 3.5);
        cam.lookAt(x - fx * 4, y + 0.9, z - fz * 4);
        break;
      case 'drift': {
        const a = clip.orbit + u * 1.6;
        cam.position.set(x + Math.sin(a) * 8.5, y + 2.6, z + Math.cos(a) * 8.5);
        cam.lookAt(x, y + 0.8, z);
        break;
      }
      case 'speed':
        cam.position.set(x + sx * 3.2 - fx * 1.2, y + 0.7, z + sz * 3.2 - fz * 1.2);
        cam.lookAt(x + fx * 3, y + 0.7, z + fz * 3);
        fov = 70;
        break;
      default:
        // TV camera at the side of the track, panning to follow.
        cam.position.copy(clip.anchor);
        cam.lookAt(x, y + 0.9, z);
        fov = Math.max(28, Math.min(55, 18 + cam.position.distanceTo(_v.set(x, y + 0.9, z)) * 0.9));
    }
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
  }

  endHighlights() {
    if (this.state === 'highlights') this.state = 'finished';
    this.hud.replay(false);
    this.fov = this.camera.fov;
    audio.startEngine();
    const done = this.hlDone;
    this.hlDone = null;
    if (!this.reported) this.report();
    else if (done) done();
  }

  updateCamera(dt) {
    const p = this.player;
    const cam = this.camera;
    const fx = Math.sin(p.heading);
    const fz = Math.cos(p.heading);
    const spd = Math.max(0, p.speed);

    if (this.state === 'countdown') {
      const t = smoothstep(0, COUNTDOWN, this.t);
      const ang = (1 - t) * 2.6;
      const r = lerp(16, 6.8, t);
      const hgt = lerp(6, 2.6, t);
      const bx = -fx;
      const bz = -fz;
      const rx = bx * Math.cos(ang) - bz * Math.sin(ang);
      const rz = bx * Math.sin(ang) + bz * Math.cos(ang);
      cam.position.set(p.x + rx * r, p.y + hgt, p.z + rz * r);
      cam.lookAt(p.x + fx * 4 * t, p.y + 1.2, p.z + fz * 4 * t);
      this.camHeading = p.heading;
    } else if (this.state === 'finished' && this.finishedT > 1.2) {
      this.orbit = (this.orbit ?? p.heading + Math.PI) + dt * 0.35;
      cam.position.set(p.x + Math.sin(this.orbit) * 10, p.y + 3.4, p.z + Math.cos(this.orbit) * 10);
      cam.lookAt(p.x, p.y + 1, p.z);
    } else if (this.camMode === 2) {
      const hy = p.model.cfg.body === 'formula' ? 1.15 : p.model.cfg.body === 'buggy' ? 2.15 : 1.5;
      const up = p.slopeAlong * 14;
      cam.position.set(p.x + fx * 0.3, p.y + hy, p.z + fz * 0.3);
      cam.lookAt(p.x + fx * 14, p.y + hy - 0.4 + up, p.z + fz * 14);
    } else {
      this.camHeading += wrapAngle(p.heading - this.camHeading) * damp(5, dt);
      const cx = Math.sin(this.camHeading);
      const cz = Math.cos(this.camHeading);
      const far = this.camMode === 1;
      const dist = far ? 11 + spd * 0.04 : 6.8 + spd * 0.035;
      const hgt = far ? 4.6 : 2.6 + spd * 0.008;
      // On downhill stretches the road behind is higher, so lift the camera.
      const lift = Math.max(0, -p.slopeAlong) * dist;
      cam.position.set(p.x - cx * dist, p.y + hgt + lift, p.z - cz * dist);
      cam.lookAt(p.x + cx * 4, p.y + 1.2 + p.slopeAlong * 4, p.z + cz * 4);
    }
    if (this.shake > 0.001) {
      cam.position.x += (Math.random() - 0.5) * this.shake;
      cam.position.y += (Math.random() - 0.5) * this.shake;
      this.shake *= Math.exp(-8 * dt);
    }
    const targetFov = 62 + Math.min(16, spd * 0.24) + (p.boosting ? 10 : 0);
    this.fov += (targetFov - this.fov) * damp(3, dt);
    if (Math.abs(cam.fov - this.fov) > 0.01) {
      cam.fov = this.fov;
      cam.updateProjectionMatrix();
    }
  }

  render() {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  resize(w, h) {
    this.width = w;
    this.height = h;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.composer) {
      this.composer.setSize(w, h);
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
    }
    this.smoke.setViewportHeight(h * this.renderer.getPixelRatio());
    this.sparks.setViewportHeight(h * this.renderer.getPixelRatio());
    if (this.bubbles) this.bubbles.setViewportHeight(h * this.renderer.getPixelRatio());
  }

  setPaused(p) {
    this.paused = p;
    if (p) audio.stopEngine();
    else audio.startEngine();
    if (this.rain) {
      if (p) audio.stopRain();
      else audio.startRain();
    }
  }

  dispose() {
    audio.stopEngine();
    audio.stopRain();
    for (const c of this.cars) {
      c.model.dispose();
      if (c.bubble) {
        c.bubble.geometry.dispose();
        c.bubble.material.dispose();
      }
    }
    this.smoke.dispose();
    this.sparks.dispose();
    if (this.trail) this.trail.dispose();
    if (this.ghost) this.ghost.dispose();
    if (this.bubbles) {
      this.bubbles.dispose();
      audio.setMuffled(false);
    }
    this.skids.dispose();
    this.world.dispose();
    if (this.composer) {
      this.composer.dispose();
      this.bloom.dispose();
    }
    this.hud.dispose();
    this.hud = null;
  }
}
