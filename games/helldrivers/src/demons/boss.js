// REGION BOSSES. One giant per region, all built on the same body plan;
// each region's file says what it looks like (look), what it throws
// (throwKind) and who it calls for help (summons). Its numbers are in
// settings.js -> bosses.
//   Ash Plains:  THE ASH TITAN, asleep in a ring of bones. Throws boulders.
//   Lava Rivers: THE MAGMA COLOSSUS, on an island in a lake of lava. Its
//                lava bombs leave burning pools, and its fists set you on fire.
// Drive into the arena (or shoot it) and it wakes up.
//
//  - Walks toward you, turning slowly.
//  - Fist SLAM when you're close (big damage where the fist lands).
//  - STOMP: a shockwave ring rolls outward. Be far away or take a hit.
//  - Throws BOULDERS (or lava bombs) when you keep your distance.
//  - At 2/3 and 1/3 health it calls in demon reinforcements.
//  - Below half health it gets angry and faster.
//  - Drive too far from the arena and it gives up, goes back, and heals.
// It's a solid physics body: ram it and you'll bounce off (and hurt it).
import * as THREE from 'three';
import { litMaterial } from '../core/graphics.js';
import { SETTINGS } from '../settings.js';
import { raySphere } from './demons.js';

const KMH = 1 / 3.6;
const UP = new THREE.Vector3(0, 1, 0);

export class Boss {
  constructor(scene, physics, ctx) {
    this.isBoss = true;
    const cfg = ctx.region.boss;
    this.cfg = cfg;
    this.name = cfg.name;
    this.B = SETTINGS.bosses[cfg.type];
    this.ctx = ctx; // { car, demons, projectiles, gore, audio, hud, chase, dust, stats, hazards, onDefeated }
    const A = cfg.arena;
    this.arenaCenter = new THREE.Vector3(A.x, 0, A.z);
    this.arenaRadius = A.radius;
    this.radius = 2.6;

    this.#buildModel(scene);
    const { RAPIER, world } = physics;
    this.body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(A.x, 0, A.z));
    world.createCollider(RAPIER.ColliderDesc.capsule(2.2, this.radius).setTranslation(0, 4.6, 0).setRestitution(0.5), this.body);

    // The stomp shockwave ring
    const ringGeo = new THREE.RingGeometry(0.85, 1, 48);
    ringGeo.rotateX(-Math.PI / 2);
    this.ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xff8030, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    this.ring.visible = false;
    scene.add(this.ring);

    this.reset();
  }

  get awake() { return this.state !== 'dormant' && this.state !== 'dead'; }
  distanceTo(p) { return Math.max(0, Math.hypot(p.x - this.pos.x, p.z - this.pos.z) - this.radius); }

  // Back to sleep in the middle of the arena, fully healed.
  reset() {
    this.pos = this.arenaCenter.clone();
    this.prev = this.pos.clone();
    this.yaw = Math.atan2(-this.arenaCenter.x, -this.arenaCenter.z); // faces the way you'll come in
    this.hp = this.B.health;
    this.state = this.defeated ? 'dead' : 'dormant';
    this.action = null;
    this.cd = { slam: 0, stomp: 4, throw: 2 };
    this.summoned = { a: false, b: false };
    this.flash = 0;
    this.phase = 0;
    this.wave = null;
    this.ring.visible = false;
    this.root.visible = !this.defeated;
    this.root.rotation.set(0, 0, 0);
    this.body.setNextKinematicTranslation(this.defeated ? { x: 0, y: -200, z: 0 } : { x: this.pos.x, y: 0, z: this.pos.z });
    this.ctx.hud?.bossBar(null);
  }

  // ------------------------------------------------------------------ hits
  takeHit(amount, source, push) {
    if (this.state === 'dead' || this.state === 'dying') return false;
    if (this.state === 'dormant') this.#wake();
    const dealt = Math.min(amount, this.hp);
    this.hp -= amount;
    this.flash = 1;
    this.ctx.stats.record(source, dealt);
    if (this.hp <= 0) { this.#die(); return true; }
    return false;
  }

  // Ray against the Titan's body and head (for bullets and aiming).
  raycast(o, dir) {
    if (this.state === 'dead') return null;
    let best = null;
    for (const [y, r] of [[4.6, 2.9], [7.4, 1.4]]) {
      const c = new THREE.Vector3(this.pos.x, y, this.pos.z);
      const t = raySphere(o, dir, c, r);
      if (t !== null && (!best || t < best.t)) best = { t, point: o.clone().addScaledVector(dir, t) };
    }
    return best;
  }

  // ------------------------------------------------------------------ update
  fixedUpdate(dt, car) {
    const B = this.B;
    this.prev.copy(this.pos);
    this.flash = Math.max(0, this.flash - dt * 5);
    const carPos = car.currPos;
    const toCar = new THREE.Vector3(carPos.x - this.pos.x, 0, carPos.z - this.pos.z);
    const dist = toCar.length();
    const carFromArena = Math.hypot(carPos.x - this.arenaCenter.x, carPos.z - this.arenaCenter.z);

    if (this.state === 'dead') return;
    if (this.state === 'dormant') {
      if (carFromArena < this.arenaRadius && !car.wrecked) this.#wake();
      return;
    }
    if (this.state === 'dying') {
      this.dieTimer += dt;
      if (this.dieTimer > 2.2 && !this.exploded) this.#explode();
      return;
    }
    if (this.state === 'waking') {
      this.wakeTimer -= dt;
      this.yaw = turnToward(this.yaw, Math.atan2(toCar.x, toCar.z), 1.5 * dt);
      if (this.wakeTimer <= 0) this.state = 'fight';
      return;
    }

    // ---- Ramming: the car crashed into us this step ----
    if (car.lastCrash && dist < this.radius + 4.5) {
      const c = car.lastCrash;
      const side = Math.abs(c.localDir.x) > Math.abs(c.localDir.z) ? `${Math.sign(c.localDir.x)},0` : `0,${Math.sign(c.localDir.z)}`;
      const bonus = 1 + (car.stats.ramBonus[side] || 0);
      const massFactor = car.totalMass / SETTINGS.steering.referenceMass;
      const dmg = SETTINGS.ramming.ramPower * (c.lost / (SETTINGS.ramming.splatSpeedKmh * KMH)) ** 2 * massFactor * bonus;
      this.takeHit(dmg, 'ram', toCar.clone().normalize().multiplyScalar(-10));
      this.ctx.audio.thump();
      this.ctx.chase.addShake(0.6);
      if (this.state !== 'fight') return;
    }

    // ---- Wandered off? Give up and go heal ----
    if (car.wrecked || carFromArena > B.leash) {
      this.state = 'returning';
    }
    if (this.state === 'returning') {
      const home = new THREE.Vector3().subVectors(this.arenaCenter, this.pos).setY(0);
      this.hp = Math.min(B.health, this.hp + B.health * 0.04 * dt);
      if (home.length() > 1) {
        this.yaw = turnToward(this.yaw, Math.atan2(home.x, home.z), 1.5 * dt);
        this.pos.addScaledVector(home.normalize(), B.walkSpeed * dt);
        this.phase += dt * 3;
      } else if (!car.wrecked && carFromArena < this.arenaRadius) {
        this.state = 'fight';
      } else if (this.hp >= B.health) {
        this.state = 'dormant';
        this.ctx.hud.bossBar(null);
      }
      if (!car.wrecked && carFromArena < this.arenaRadius) this.state = 'fight';
      this.#syncBody();
      return;
    }

    // ---- Reinforcements ----
    const frac = this.hp / B.health;
    if (frac < 0.66 && !this.summoned.a) { this.summoned.a = true; this.#summon(); }
    if (frac < 0.33 && !this.summoned.b) { this.summoned.b = true; this.#summon(); }
    const enraged = frac < 0.5;
    const rate = enraged ? 1.4 : 1;
    for (const k in this.cd) this.cd[k] -= dt * rate;

    // ---- Doing an attack? ----
    if (this.action) {
      this.#runAction(dt, car, toCar, dist);
    } else {
      // Pick an attack, or keep walking at you.
      if (dist < 11 && this.cd.slam <= 0) this.#start('slam', 0.9);
      else if (dist < B.stompRadius * 0.75 && this.cd.stomp <= 0) this.#start('stomp', 1.0);
      else if (dist > 16 && this.cd.throw <= 0) this.#start('throw', 0.8);
      else {
        this.yaw = turnToward(this.yaw, Math.atan2(toCar.x, toCar.z), (enraged ? 1.3 : 0.9) * dt);
        if (dist > 8) {
          const sp = enraged ? B.enragedSpeed : B.walkSpeed;
          this.pos.x += Math.sin(this.yaw) * sp * dt;
          this.pos.z += Math.cos(this.yaw) * sp * dt;
          this.phase += dt * sp * 0.6;
        }
      }
    }

    // ---- Shockwave ring rolling outward ----
    if (this.wave) {
      this.wave.r += 22 * dt;
      if (!this.wave.hit && Math.abs(dist - this.wave.r) < 2 && car.grounded) {
        this.wave.hit = true;
        const toward = this.pos.clone().setY(0.3).sub(carPos).setY(0).normalize().multiplyScalar(1.5).add(carPos);
        car.takeDamage(B.stompDamage, toward);
        car.nudge((toCar.x / dist) * 7, (toCar.z / dist) * 7);
        this.ctx.chase.addShake(0.8);
      }
      if (this.wave.r > B.stompRadius) { this.wave = null; this.ring.visible = false; }
    }

    // Stay inside the arena-ish area
    const off = new THREE.Vector3().subVectors(this.pos, this.arenaCenter).setY(0);
    if (off.length() > B.leash * 0.8) this.pos.copy(this.arenaCenter).add(off.setLength(B.leash * 0.8));
    this.#syncBody();
    this.ctx.hud.bossBar(this.name, this.hp / B.health, enraged);
  }

  #start(type, windup) { this.action = { type, t: 0, windup, done: false }; }

  #runAction(dt, car, toCar, dist) {
    const B = this.B;
    const a = this.action;
    a.t += dt;
    if (a.t < a.windup) {
      // Keep facing the car during the wind-up (slowly)
      this.yaw = turnToward(this.yaw, Math.atan2(toCar.x, toCar.z), 0.8 * dt);
      return;
    }
    if (!a.done) {
      a.done = true;
      const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      if (a.type === 'slam') {
        this.cd.slam = 2.6;
        const at = this.pos.clone().addScaledVector(fwd, 6.5).setY(0.5);
        const d = Math.hypot(car.currPos.x - at.x, car.currPos.z - at.z);
        if (d < B.slamRadius + 2 && !car.wrecked) {
          car.takeDamage(B.slamDamage, at);
          if (B.slamBurn) car.igniteAt(at, B.slamBurn, 4);
          const away = car.currPos.clone().sub(at).setY(0).normalize();
          car.nudge(away.x * 9, away.z * 9);
        }
        this.#dustBurst(at, 22, 1.0);
        this.ctx.audio.wreck();
        this.ctx.chase.addShake(Math.max(0.3, 1.2 - dist / 40));
      } else if (a.type === 'stomp') {
        this.cd.stomp = 8;
        this.wave = { r: 3, hit: false };
        this.ring.position.set(this.pos.x, 0.15, this.pos.z);
        this.ring.visible = true;
        this.#dustBurst(this.pos.clone().setY(0.5), 16, 1.2);
        this.ctx.audio.wreck();
        this.ctx.chase.addShake(Math.max(0.3, 1.0 - dist / 50));
      } else if (a.type === 'throw') {
        this.cd.throw = 3.5;
        const hand = this.pos.clone().add(new THREE.Vector3(0, 8.5, 0)).addScaledVector(fwd, 1.5);
        const kind = this.cfg.throwKind || 'boulder';
        const flight = THREE.MathUtils.clamp(dist / 20, 1.1, 2.6);
        const onLand = kind === 'lavaBomb' && this.ctx.hazards
          ? (at) => this.ctx.hazards.addPool(at.x, at.z, B.poolRadius, B.poolTime) : null;
        this.ctx.projectiles.throwAt(kind, hand, B.throwDamage, B.throwSplash, flight, onLand);
        // Lava bombs come in threes, spread around you.
        if (kind === 'lavaBomb') {
          for (const side of [-1, 1]) {
            const h2 = hand.clone().addScaledVector(new THREE.Vector3(fwd.z, 0, -fwd.x), side * 2);
            this.ctx.projectiles.throwAt(kind, h2, B.throwDamage, B.throwSplash, flight * (0.75 + Math.random() * 0.5), onLand);
          }
        }
      }
    }
    if (a.t > a.windup + 0.6) this.action = null; // recover, then carry on
  }

  #summon() {
    const { demons, hud } = this.ctx;
    const list = this.cfg.summons || [['imp', 8], ['imp', 8], ['hound', 4]];
    list.forEach(([type, n], i) => {
      const ang = (i / list.length) * Math.PI * 2;
      const c = this.pos.clone().add(new THREE.Vector3(Math.cos(ang) * 14, 0, Math.sin(ang) * 14));
      demons.spawnPack(c, n, type);
    });
    hud.toast(`${this.name} calls for help!`, 'warn');
    this.ctx.audio.wreck();
  }

  #wake() {
    if (this.state !== 'dormant') return;
    this.state = 'waking';
    this.wakeTimer = 2.5;
    this.ctx.hud.toast(`${this.name.toUpperCase()} AWAKENS!`, 'warn');
    this.ctx.hud.bossBar(this.name, this.hp / this.B.health, false);
    this.ctx.audio.wreck();
    this.ctx.chase.addShake(1);
  }

  #die() {
    this.state = 'dying';
    this.dieTimer = 0;
    this.exploded = false;
    this.action = null;
    this.wave = null;
    this.ring.visible = false;
    this.ctx.stats.kill('gun');
    this.ctx.hud.bossBar(null);
    this.ctx.audio.wreck();
  }

  #explode() {
    this.exploded = true;
    this.defeated = true;
    this.state = 'dead';
    const L = this.cfg.look || {};
    const colors = [L.skin ?? 0x5a5450, L.dark ?? 0x3a3432, L.glow ?? 0xff6a20, 0x9a0a0a, L.horn ?? 0xe0d6bc];
    for (const y of [1, 4, 7]) {
      this.ctx.gore.explode(this.pos.clone().setY(y), new THREE.Vector3((Math.random() - 0.5) * 10, 6, (Math.random() - 0.5) * 10), colors, 4);
    }
    this.#dustBurst(this.pos.clone().setY(1), 40, 2);
    this.ctx.audio.wreck();
    this.ctx.chase.addShake(1.2);
    this.root.visible = false;
    this.body.setNextKinematicTranslation({ x: 0, y: -200, z: 0 });
    this.ctx.onDefeated?.();
  }

  #dustBurst(at, n, size) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 4 + Math.random() * 8;
      this.ctx.dust.spawn(at, new THREE.Vector3(Math.cos(a) * s, 1 + Math.random() * 3, Math.sin(a) * s), size * (0.6 + Math.random() * 0.6), 1.2);
    }
  }

  #syncBody() { this.body.setNextKinematicTranslation({ x: this.pos.x, y: 0, z: this.pos.z }); }

  // ------------------------------------------------------------------ drawing
  render(alpha, dt) {
    if (!this.root.visible) return;
    const m = this.parts;
    this.root.position.lerpVectors(this.prev, this.pos, alpha);
    this.root.rotation.y = this.yaw;
    this.matAsh.emissive.setRGB(this.flash * 0.8, this.flash * 0.15, 0);
    this.matLava.emissiveIntensity = 1.2 + Math.sin(performance.now() / 300) * 0.4 + (this.hp < this.B.health * 0.5 ? 0.8 : 0);

    // Default walking pose
    const swing = Math.sin(this.phase) * 0.35;
    let legL = swing, legR = -swing, armL = -swing * 0.6, armR = swing * 0.6, lower = 0, lean = 0;

    if (this.state === 'dormant') { lower = -1.6; lean = 0.35; armL = armR = -0.4; legL = legR = -1.2; }
    if (this.state === 'waking') { const k = Math.max(0, this.wakeTimer / 2.5); lower = -1.6 * k; lean = 0.35 * k; armL = armR = -2.6 * (1 - k) * (k > 0.3 ? 1 : k / 0.3); legL = legR = -1.2 * k; }
    if (this.state === 'dying') { this.root.rotation.x = -Math.min(1.45, this.dieTimer * 0.9); }
    const a = this.action;
    if (a) {
      const wind = Math.min(1, a.t / a.windup), after = a.t > a.windup;
      if (a.type === 'slam') { armR = after ? -0.3 : -2.8 * wind; armL = after ? -0.3 : -2.6 * wind; lean = after ? 0.4 : -0.15 * wind; }
      if (a.type === 'stomp') { legL = after ? 0 : -1.0 * wind; lean = after ? 0.1 : -0.1 * wind; }
      if (a.type === 'throw') { armR = after ? -1.2 : 2.2 * wind - 0.5; lean = after ? 0.2 : -0.2 * wind; }
    }
    const k = 1 - Math.exp(-12 * dt);
    m.legL.rotation.x += (legL - m.legL.rotation.x) * k;
    m.legR.rotation.x += (legR - m.legR.rotation.x) * k;
    m.armL.rotation.x += (armL - m.armL.rotation.x) * k;
    m.armR.rotation.x += (armR - m.armR.rotation.x) * k;
    m.upper.position.y += (lower - m.upper.position.y) * k;
    m.upper.rotation.x += (lean - m.upper.rotation.x) * k;
    m.upper.scale.y = 1 + Math.sin(performance.now() / 650) * 0.015; // breathing

    if (this.wave) {
      this.ring.scale.setScalar(this.wave.r);
      this.ring.material.opacity = 0.8 * (1 - this.wave.r / this.B.stompRadius);
    }
  }

  // ------------------------------------------------------------------ model
  #buildModel(scene) {
    const L = { skin: 0x5a5450, dark: 0x2e2a28, glow: 0xff5a10, horn: 0xe0d6bc, eye: 0xffe040, ...this.cfg.look };
    this.matAsh = litMaterial({ color: L.skin, flatShading: true, roughness: 0.9 });
    const dark = litMaterial({ color: L.dark, flatShading: true, roughness: 0.9 });
    this.matLava = litMaterial({ color: L.glow, emissive: L.glow, emissiveIntensity: 1.4, flatShading: true });
    const bone = litMaterial({ color: L.horn, flatShading: true });
    const eye = new THREE.MeshBasicMaterial({ color: L.eye });
    const add = (parent, geo, mat, x, y, z) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

    const root = new THREE.Group();
    const upper = new THREE.Group(); // everything above the hips (lowers when sitting)
    root.add(upper);

    // Legs (pivot at the hip)
    const legs = {};
    for (const [name, x] of [['legL', 1.2], ['legR', -1.2]]) {
      const hip = new THREE.Group();
      hip.position.set(x, 3.2, 0);
      add(hip, box(1.5, 3.2, 1.5), dark, 0, -1.6, 0);
      add(hip, box(1.8, 0.6, 2.2), dark, 0, -3.0, 0.3); // foot
      root.add(hip);
      legs[name] = hip;
    }
    // Torso with glowing cracks
    add(upper, box(4.4, 3.8, 2.8), this.matAsh, 0, 5.0, 0);
    add(upper, box(3.6, 0.15, 2.85), this.matLava, 0, 4.4, 0);
    add(upper, box(0.15, 3.0, 2.85), this.matLava, 0.6, 5.2, 0);
    add(upper, box(1.6, 0.15, 2.85), this.matLava, -1.0, 5.8, 0);
    for (let n = 0; n < 5; n++) { // bone spikes along the back
      const c = add(upper, new THREE.ConeGeometry(0.3, 1.6, 4), bone, -1.6 + n * 0.8, 6.9, -1.3);
      c.rotation.x = -0.6;
    }
    // Head
    add(upper, box(1.9, 1.6, 1.8), this.matAsh, 0, 7.6, 0.5);
    add(upper, box(1.5, 0.4, 0.3), this.matLava, 0, 7.1, 1.42); // glowing mouth
    add(upper, box(0.35, 0.2, 0.1), eye, 0.45, 7.95, 1.42);
    add(upper, box(0.35, 0.2, 0.1), eye, -0.45, 7.95, 1.42);
    for (const [x, rz] of [[0.8, -0.6], [-0.8, 0.6], [0.5, -0.2], [-0.5, 0.2]]) {
      const h = add(upper, new THREE.ConeGeometry(0.22, 1.6, 4), bone, x, 9.0, 0.3);
      h.rotation.z = rz;
    }
    // Arms (pivot at the shoulder)
    const arms = {};
    for (const [name, x] of [['armL', 2.8], ['armR', -2.8]]) {
      const sh = new THREE.Group();
      sh.position.set(x, 6.4, 0);
      add(sh, box(1.2, 3.4, 1.2), this.matAsh, 0, -1.7, 0);
      add(sh, box(1.9, 1.6, 1.9), dark, 0, -3.8, 0.2); // fist
      upper.add(sh);
      arms[name] = sh;
    }
    // Magma Colossus: volcanoes on its shoulders and molten fists.
    if (L.vents) {
      for (const x of [2.4, -2.4]) {
        add(upper, new THREE.CylinderGeometry(0.5, 1.3, 1.6, 7), dark, x, 7.3, -0.3);
        add(upper, new THREE.CylinderGeometry(0.45, 0.45, 0.1, 7), this.matLava, x, 8.12, -0.3);
      }
      for (const arm of Object.values(arms)) add(arm, box(2.0, 0.5, 2.0), this.matLava, 0, -4.4, 0.2);
    }
    this.parts = { upper, ...legs, ...arms };
    this.root = root;
    root.position.copy(this.arenaCenter || new THREE.Vector3());
    scene.add(root);
  }
}

function turnToward(a, target, maxStep) {
  const d = Math.atan2(Math.sin(target - a), Math.cos(target - a));
  return a + THREE.MathUtils.clamp(d, -maxStep, maxStep);
}
