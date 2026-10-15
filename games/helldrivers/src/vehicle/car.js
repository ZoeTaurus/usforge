// The player's car: physics body + driving model + model animation.
//
// How the driving works (plain version):
//  - The car is one solid box in the physics world. It can bump into rocks.
//  - It can't tip over (no flips, by design), it only spins left/right.
//  - Each physics step we split its speed into "forward" and "sideways".
//      * Gas/brake change the forward part. Force / weight = acceleration,
//        so heavier cars are slower to speed up and stop.
//      * Tires fight the sideways part, but only up to a limit (tireGrip).
//        Turn hard at speed (or pull the handbrake) and the tires lose the
//        fight: that's a drift.
//  - Steering spins the car directly; weight makes that spin lazier.
import * as THREE from 'three';
import { SETTINGS } from '../settings.js';
import { createCarModel, CAR_DIMENSIONS } from './carModel.js';
import { Build, cellCenter, key, SECTION_CELLS, SECTION_NAMES, sectionCenter } from './build.js';
import { PART_TYPES, createGunTurret } from './parts.js';

const UP = new THREE.Vector3(0, 1, 0);
const _aim = new THREE.Vector3();
const CHAR = new THREE.Color(0x1a1210);
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();

export class Car {
  constructor(scene, physics, spawn = new THREE.Vector3(0, 1, 0)) {
    const { RAPIER, world } = physics;
    this.RAPIER = RAPIER;
    this.world = world;
    this.spawn = spawn.clone();

    // --- Physics body ---
    const d = CAR_DIMENSIONS;
    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(spawn.x, spawn.y, spawn.z)
        .enabledRotations(false, true, false) // only spin around the vertical axis: no flipping
        .setCcdEnabled(true)                  // don't tunnel through things at high speed
        .setCanSleep(false)
    );
    this.collider = world.createCollider(
      RAPIER.ColliderDesc.roundCuboid(d.halfWidth - 0.1, d.halfHeight - 0.1, d.halfLength - 0.1, 0.1)
        .setMass(SETTINGS.car.mass)
        .setFriction(0)        // the driving model handles tire grip itself...
        .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min) // ...so never scrape the ground
        .setRestitution(0.15),
      this.body
    );
    this.appliedMass = SETTINGS.car.mass;
    this.groundRay = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });

    // --- Model ---
    this.model = createCarModel();
    scene.add(this.model.root);

    // --- State (read by camera, HUD, audio, effects) ---
    this.steer = 0;             // smoothed steering (-1..1)
    this.forwardSpeed = 0;      // m/s, negative when reversing
    this.sidewaysSpeed = 0;     // m/s of sliding
    this.speed = 0;             // overall m/s
    this.grounded = true;
    this.drifting = false;
    this.throttle = 0;
    this.handbrake = false;
    this.longAccel = 0;         // m/s² forward/back (for body pitch)
    this.yawRate = 0;

    // For smooth rendering between physics steps
    this.prevPos = new THREE.Vector3().copy(spawn);
    this.currPos = new THREE.Vector3().copy(spawn);
    this.prevRot = new THREE.Quaternion();
    this.currRot = new THREE.Quaternion();

    // Visual wobble springs
    this.roll = { x: 0, v: 0 };
    this.pitch = { x: 0, v: 0 };
    this.wheelSpin = 0;

    // Damage: there's no health bar. Every body section and part has its
    // own hit points; pieces break off when they run out. Lose the cabin
    // and you're wrecked.
    this.wrecked = false;
    this.hurtTimer = 0;      // > 0 right after taking damage (for screen flash)
    this.onDetach = null;    // called with the pieces that fall off (to spawn scrap)
    this.vBefore = new THREE.Vector3();

    // Guns: the built-in roof gun, plus any Machine Gun parts.
    this.mainTurret = { parts: this.model.turret, yaw: 0, pitch: 0, recoil: 0, recoilDist: 0.25 };
    this.turrets = [this.mainTurret];

    // Bolt-on parts (the builder). Restores your last build if there is one.
    this.build = new Build();
    this.build.restore();
    this.savedBuild = this.build.snapshot(); // what you respawn with
    this.partsGroup = new THREE.Group();
    this.model.body.add(this.partsGroup);
    this.partColliders = [];
    this.boosterFlames = [];
    this.partObjects = new Map(); // part cell key -> [3D objects]
    this.applyBuild();
  }

  // (Re)create part models + collision shapes from this.build.
  applyBuild() {
    const RAPIER = this.RAPIER;
    for (const c of this.partColliders) this.world.removeCollider(c, false);
    this.partColliders = [];
    this.partsGroup.clear();
    this.partObjects.clear();
    this.turrets = [];
    this.boosterFlames = [];
    const up = new THREE.Vector3(0, 1, 0);

    // Body sections: hide the ones that fell off
    for (const [id, g] of Object.entries(this.model.sections)) g.visible = !this.build.missing.has(id);
    if (!this.build.missing.has('cabin')) this.turrets.push(this.mainTurret);

    // The car's footprint for demon collisions: wheels + whatever is still attached.
    const bounds = { minX: -1.15, maxX: 1.15, minZ: -1.8, maxZ: 1.8, maxY: 1.5 };
    const grow = (x, y, z, n = null, reach = 0.25) => {
      bounds.minX = Math.min(bounds.minX, x - 0.25 + (n ? Math.min(0, n.x) * reach : 0));
      bounds.maxX = Math.max(bounds.maxX, x + 0.25 + (n ? Math.max(0, n.x) * reach : 0));
      bounds.minZ = Math.min(bounds.minZ, z - 0.25 + (n ? Math.min(0, n.z) * reach : 0));
      bounds.maxZ = Math.max(bounds.maxZ, z + 0.25 + (n ? Math.max(0, n.z) * reach : 0));
      bounds.maxY = Math.max(bounds.maxY, y + 0.75);
    };
    for (const [id, cells] of Object.entries(SECTION_CELLS)) {
      if (this.build.missing.has(id)) continue;
      for (const c of cells) { const p = cellCenter(...c); grow(p.x, p.y, p.z); }
    }
    if (!this.build.missing.has('bumper')) bounds.maxZ = Math.max(bounds.maxZ, 2.8); // bumper spikes

    for (const [k, p] of this.build.parts) {
      const def = PART_TYPES[p.type];
      const c = cellCenter(p.i, p.j, p.k);
      const n = new THREE.Vector3(...p.normal);
      const g = new THREE.Group();
      g.position.set(c.x, c.y, c.z);
      g.quaternion.setFromUnitVectors(up, n);
      def.build(g);
      this.partsGroup.add(g);
      const objs = [g];
      if (g.userData.flame) this.boosterFlames.push(g.userData.flame);
      if (def.isGun) {
        const t = createGunTurret();
        t.group.position.set(c.x + n.x * 0.12, c.y + n.y * 0.12 + 0.05, c.z + n.z * 0.12);
        this.partsGroup.add(t.group);
        this.turrets.push({ parts: t, yaw: 0, pitch: 0, recoil: 0, recoilDist: 0.15 });
        objs.push(t.group);
      }
      this.partObjects.set(k, objs);
      // Solid shape so parts bump into rocks too.
      this.partColliders.push(this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.24, 0.24, 0.24)
          .setTranslation(c.x, c.y, c.z)
          .setMass(SETTINGS.parts[p.type].mass)
          .setFriction(0)
          .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
          .setRestitution(0.15),
        this.body
      ));
      // Spikes and plows poke out further.
      grow(c.x, c.y, c.z, n, 0.25 + (SETTINGS.parts[p.type].ramBonus ? 0.3 : 0));
    }
    this.localBounds = bounds;
    this.stats = this.build.stats();
    this.#refreshAllTints();
  }

  // ------------------------------------------------------------ damage
  // Every damageable piece: { id, kind: 'part'|'section', key, hp, maxHp, center (car space) }
  pieces() {
    const list = [];
    for (const [id, cells] of Object.entries(SECTION_CELLS)) {
      if (this.build.missing.has(id)) continue;
      list.push({ id: 's:' + id, kind: 'section', key: id, hp: this.build.sectionHp[id], maxHp: SETTINGS.chassis[id].hp,
        center: sectionCenter(id), cells: cells.map((c) => cellCenter(...c)) });
    }
    for (const [k, p] of this.build.parts) {
      const c = cellCenter(p.i, p.j, p.k);
      list.push({ id: 'p:' + k, kind: 'part', key: k, hp: p.hp, maxHp: SETTINGS.parts[p.type].hp, center: c, cells: [c] });
    }
    return list;
  }

  // Something hit the car at this world position: the nearest piece takes it.
  takeDamage(amount, worldPoint) {
    if (this.wrecked) return;
    const local = this.model.body.worldToLocal(worldPoint.clone());
    let best = null, bestD = Infinity;
    for (const pc of this.pieces()) {
      for (const c of pc.cells) {
        const d = (c.x - local.x) ** 2 + (c.y - local.y) ** 2 * 0.5 + (c.z - local.z) ** 2;
        if (d < bestD) { bestD = d; best = pc; }
      }
    }
    if (best) this.damagePiece(best, amount);
  }

  // Hit from a direction (car space, pointing from the car toward what it hit):
  // the outermost pieces on that side share the damage.
  // Damage the front layer wipes out carries on to the layer behind it.
  takeSideDamage(amount, localDir) {
    let left = amount;
    for (let layer = 0; layer < 4 && left > 1 && !this.wrecked; layer++) {
      const ps = this.pieces();
      const reach = (pc) => Math.max(...pc.cells.map((c) => c.x * localDir.x + c.z * localDir.z));
      const top = Math.max(...ps.map(reach));
      const front = ps.filter((pc) => reach(pc) > top - 0.6);
      const share = left / front.length;
      left = 0;
      for (const pc of front) {
        left += Math.max(0, share - pc.hp);
        this.damagePiece(pc, share);
      }
    }
  }

  damagePiece(pc, amount) {
    this.hurtTimer = 0.25;
    if (pc.kind === 'part') {
      const p = this.build.parts.get(pc.key);
      if (!p) return;
      p.hp -= amount;
      if (p.hp <= 0) return this.#detach(this.build.breakPart(pc.key));
      this.#tint(this.partObjects.get(pc.key), p.hp / pc.maxHp);
    } else {
      this.build.sectionHp[pc.key] -= amount;
      const frac = this.build.sectionHp[pc.key] / pc.maxHp;
      if (frac <= 0) {
        if (pc.key === 'cabin') { this.wrecked = true; return; }
        return this.#detach(this.build.breakSection(pc.key));
      }
      this.#tint([this.model.sections[pc.key]], frac);
    }
  }

  // Pieces fell off: hand them to the scrap system, then rebuild the car.
  #detach(dropped) {
    if (!dropped.length) return;
    this.model.root.updateMatrixWorld(true);
    const lv = this.body.linvel();
    const out = [];
    for (const d of dropped) {
      if (d.section) {
        const n = SETTINGS.chassis[d.section].panels;
        out.push({ objects: [this.model.sections[d.section]], item: { type: 'panel', count: n, label: `${SECTION_NAMES[d.section]} (${n} Body Panel${n > 1 ? 's' : ''})` } });
      } else {
        const k = key(d.i, d.j, d.k);
        out.push({ objects: this.partObjects.get(k) || [], item: { type: d.type, count: 1, label: PART_TYPES[d.type].name } });
      }
    }
    // Fling them outward from the car
    for (const o of out) {
      const wp = o.objects[0]?.getWorldPosition(new THREE.Vector3()) || this.currPos.clone();
      const away = wp.sub(this.currPos).setY(0).normalize().multiplyScalar(4);
      o.push = new THREE.Vector3(lv.x * 0.6 + away.x, 0, lv.z * 0.6 + away.z);
    }
    this.onDetach?.(out);
    this.applyBuild();
  }

  // Charred look: lerp each piece's colors toward black as it gets hurt.
  #tint(objects, frac) {
    const dark = Math.min(1, Math.max(0, 1 - frac)) * 0.8;
    for (const o of objects || []) {
      o.traverse((m) => {
        if (!m.isMesh || !m.material.color || m.material.transparent) return;
        if (!m.userData.ownMat) { m.material = m.material.clone(); m.userData.ownMat = true; m.userData.base = m.material.color.clone(); }
        m.material.color.copy(m.userData.base).lerp(CHAR, dark);
      });
    }
  }

  #refreshAllTints() {
    for (const pc of this.pieces()) {
      const objs = pc.kind === 'part' ? this.partObjects.get(pc.key) : [this.model.sections[pc.key]];
      this.#tint(objs, pc.hp / pc.maxHp);
    }
  }

  // World positions of badly damaged pieces (for smoke + sparks).
  smokingPoints(below) {
    const out = [];
    for (const pc of this.pieces()) {
      if (pc.hp / pc.maxHp < below) out.push({ pos: this.model.body.localToWorld(new THREE.Vector3(pc.center.x, pc.center.y + 0.2, pc.center.z)), frac: pc.hp / pc.maxHp });
    }
    return out;
  }

  get cabinFrac() { return this.build.sectionHp.cabin / SETTINGS.chassis.cabin.hp; }

  // After each physics step: a big sudden loss of speed means we hit something.
  afterStep() {
    const v = this.body.linvel();
    const dx = this.vBefore.x - v.x, dz = this.vBefore.z - v.z;
    const lost = Math.hypot(dx, dz);
    const D = SETTINGS.damage;
    if (lost > D.crashMinSpeed && !this.wrecked) {
      const dir = new THREE.Vector3(dx, 0, dz).normalize().applyQuaternion(this.currRot.clone().invert());
      this.takeSideDamage((lost - D.crashMinSpeed) * D.crashDamage, dir);
      this.crashed = lost;
    }
  }

  get totalMass() { return this.stats.mass; }

  // Runs at a fixed 60 times per second, before the physics world steps.
  fixedUpdate(input, dt) {
    const S = SETTINGS;
    if (this.wrecked) input = WRECKED_INPUT;
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    if (this.appliedMass !== S.car.mass) {
      this.collider.setMass(S.car.mass);
      this.appliedMass = S.car.mass;
    }
    this.world.gravity = { x: 0, y: -S.car.gravity, z: 0 };

    // Weight, power and balance from the build (cheap to recompute).
    this.stats = this.build.stats();
    const mass = this.stats.mass;
    const topSpeed = this.stats.topSpeed;
    const power = this.stats.enginePower;
    // Nose-heavy = understeer (turns less); tail-heavy = oversteer (rear grip drops).
    const bal = this.stats.balance * S.build.balanceEffect;
    const balTurn = bal > 0 ? 1 - 0.3 * bal : 1 - 0.1 * bal;
    const balGrip = bal < 0 ? 1 + 0.35 * bal : 1;
    const t = this.body.translation();
    const r = this.body.rotation();
    const lv = this.body.linvel();
    _q.set(r.x, r.y, r.z, r.w);
    _fwd.set(0, 0, 1).applyQuaternion(_q).setY(0).normalize();
    _right.crossVectors(_fwd, UP); // points to the car's right
    _v.set(lv.x, lv.y, lv.z);

    let vf = _v.dot(_fwd);
    let vs = _v.dot(_right);

    // Are the wheels touching the ground?
    this.groundRay.origin = { x: t.x, y: t.y, z: t.z };
    const hit = this.world.castRay(this.groundRay, CAR_DIMENSIONS.halfHeight + 0.35, true, undefined, undefined, undefined, this.body);
    this.grounded = !!hit;

    // Smooth steering input (no instant full lock)
    const steerTarget = input.steer;
    const steerStep = S.steering.steerSpeed * dt;
    this.steer += THREE.MathUtils.clamp(steerTarget - this.steer, -steerStep, steerStep);

    this.throttle = input.throttle;
    this.handbrake = input.handbrake;
    const weightFactor = Math.pow(S.steering.referenceMass / mass, S.steering.weightTurnPenalty);
    const prevVf = vf;

    if (this.grounded) {
      // ---------- Forward / backward ----------
      const g = S.car.gravity;
      const th = this.throttle;
      const brakeDv = (S.car.brakePower / mass) * dt;
      if (th > 0) {
        if (vf < -0.5) vf = approach(vf, 0, brakeDv);
        else {
          const r = Math.min(Math.max(vf, 0) / topSpeed, 1);
          vf += (power * (1 - r * r) / mass) * dt;
        }
      } else if (th < 0) {
        if (vf > 0.5) vf = approach(vf, 0, brakeDv);
        else {
          const r = Math.min(Math.max(-vf, 0) / S.car.reverseSpeed, 1);
          vf -= (power * 0.7 * (1 - r * r) / mass) * dt;
        }
      } else {
        // Coasting: engine braking, plus a tiny constant so the car fully stops.
        vf = approach(vf, 0, (Math.abs(vf) * S.car.coastSlowdown + 0.6) * dt);
      }
      // Rolling resistance grows with weight (heavy builds lose top speed).
      vf = approach(vf, 0, S.car.rollingResistance * g * (mass / S.steering.referenceMass) * dt);
      if (this.handbrake) vf = approach(vf, 0, Math.abs(vf) * S.grip.handbrakeDrag * dt + 2 * dt);

      // ---------- Sideways grip ----------
      const grip = S.grip.tireGrip * balGrip * (this.handbrake ? S.grip.handbrakeGrip : 1);
      const maxDv = grip * dt;
      const correction = THREE.MathUtils.clamp(-vs, -maxDv, maxDv);
      vs += correction;
      // While sliding, turn some of the lost sideways speed into forward speed
      // so drifts keep their momentum instead of scrubbing to a halt.
      if (Math.abs(vs) > 0.5 && vf > 1 && vf < topSpeed) {
        vf += Math.abs(correction) * S.grip.driftCarry;
      }

      // ---------- Steering (spin) ----------
      const lowSpeed = Math.min(Math.hypot(vf, vs) / S.steering.fullSteerSpeed, 1);
      const highSpeed = 1 - S.steering.highSpeedReduction * Math.min(Math.hypot(vf, vs) / topSpeed, 1);
      const dir = vf >= -0.3 ? 1 : -1; // steering flips when reversing, like a real car
      const hbBoost = this.handbrake ? 1.3 : 1;
      // When the car is already sliding a lot, the tires can't turn it as hard.
      // This keeps drifts from turning into spin-outs.
      const slideLimit = this.handbrake ? 1 : 1 - Math.min(Math.abs(vs) / 25, 0.5);
      const targetYaw = -this.steer * S.steering.turnRate * lowSpeed * highSpeed * weightFactor * dir * hbBoost * slideLimit * balTurn;
      const av = this.body.angvel();
      const resp = 1 - Math.exp(-10 * weightFactor * dt);
      const yaw = av.y + (targetYaw - av.y) * resp;
      this.body.setAngvel({ x: 0, y: yaw, z: 0 }, true);

      _v.copy(_fwd).multiplyScalar(vf).addScaledVector(_right, vs);
      this.body.setLinvel({ x: _v.x, y: lv.y, z: _v.z }, true);
    }

    this.forwardSpeed = vf;
    this.sidewaysSpeed = vs;
    this.speed = Math.hypot(vf, vs);
    this.longAccel = (vf - prevVf) / dt;
    this.yawRate = this.body.angvel().y;
    this.drifting = this.grounded && Math.abs(vs) > S.grip.driftThreshold;
    const after = this.body.linvel();
    this.vBefore.set(after.x, after.y, after.z); // to spot crashes after the physics step
  }

  // After physics step: remember where we were and where we are now.
  capture() {
    this.prevPos.copy(this.currPos);
    this.prevRot.copy(this.currRot);
    const t = this.body.translation();
    const r = this.body.rotation();
    this.currPos.set(t.x, t.y, t.z);
    this.currRot.set(r.x, r.y, r.z, r.w);
  }

  // A sudden change in speed (e.g. plowing through a demon).
  nudge(dx, dz) {
    const v = this.body.linvel();
    this.body.setLinvel({ x: v.x + dx, y: v.y, z: v.z + dz }, true);
  }

  // Back in one piece with your last garage build. Spare parts you were
  // carrying stay in your stock.
  respawn() {
    const inventory = this.build.inventory;
    this.build.load(this.savedBuild);
    this.build.inventory = inventory;
    this.wrecked = false;
    this.applyBuild();
    this.reset(true);
  }

  // Put the car back upright at the start (or where it is), stopped.
  reset(toSpawn = false) {
    const p = toSpawn ? this.spawn : this.currPos;
    this.body.setTranslation({ x: p.x, y: this.spawn.y + 0.5, z: p.z }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    if (toSpawn) this.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    this.vBefore.set(0, 0, 0);
    this.capture();
    this.capture();
  }

  // Runs every rendered frame. alpha = how far we are between physics steps.
  render(alpha, dt, aimPoint) {
    const S = SETTINGS;
    const root = this.model.root;
    root.position.lerpVectors(this.prevPos, this.currPos, alpha);
    root.quaternion.slerpQuaternions(this.prevRot, this.currRot, alpha);

    // --- Body lean (spring) ---
    const corner = THREE.MathUtils.clamp(this.yawRate * this.forwardSpeed / 30, -1, 1);
    const rollTarget = corner * THREE.MathUtils.degToRad(S.body.roll);
    const pitchTarget = -THREE.MathUtils.clamp(this.longAccel / 25, -1, 1) * THREE.MathUtils.degToRad(S.body.pitch);
    spring(this.roll, this.grounded ? rollTarget : 0, S.body.stiffness, dt);
    spring(this.pitch, this.grounded ? pitchTarget : 0, S.body.stiffness, dt);
    this.model.body.rotation.set(this.pitch.x, 0, this.roll.x);

    // --- Wheels: spin with speed, front wheels turn with steering ---
    this.wheelSpin += (this.forwardSpeed / CAR_DIMENSIONS.wheelRadius) * dt;
    for (const w of this.model.wheels) {
      w.spin.rotation.x = this.wheelSpin;
      if (w.front) w.steer.rotation.y = -this.steer * 0.5;
    }

    // --- Every gun aims at the mouse point ---
    const k = 1 - Math.exp(-S.turret.turnSpeed * dt);
    for (const t of this.turrets) {
      const tp = t.parts;
      if (aimPoint) {
        const local = tp.yaw.parent.worldToLocal(_aim.copy(aimPoint));
        const targetYaw = Math.atan2(local.x, local.z);
        const targetPitch = THREE.MathUtils.clamp(Math.atan2(local.y + 0.4, Math.hypot(local.x, local.z)), -0.25, 0.6);
        t.yaw += wrapAngle(targetYaw - t.yaw) * k;
        t.pitch += (targetPitch - t.pitch) * k;
      }
      tp.yaw.rotation.y = t.yaw;
      tp.pitch.rotation.x = -t.pitch;
      t.recoil = Math.max(0, t.recoil - dt * 6);
      tp.barrels.position.z = -t.recoil * t.recoilDist;
      if (tp.flash.visible) {
        tp.flash.material.opacity -= dt * 20;
        if (tp.flash.material.opacity <= 0) tp.flash.visible = false;
      }
    }

    // --- Booster flames flicker when on the gas ---
    const on = this.throttle > 0 && !this.wrecked;
    for (const f of this.boosterFlames) {
      f.visible = on;
      f.scale.set(1, 0.7 + Math.random() * 0.6, 1);
    }
  }

  // Muzzle flash + recoil on one gun.
  fireVisual(t) {
    t.recoil = 1;
    const f = t.parts.flash;
    f.visible = true;
    f.material.opacity = 0.95;
    f.rotation.z = Math.random() * Math.PI;
  }

  get position() { return this.model.root.position; }
  get heading() { return _fwd.set(0, 0, 1).applyQuaternion(this.model.root.quaternion).setY(0).normalize(); }
  muzzleWorld(t) { return t.parts.muzzle.getWorldPosition(new THREE.Vector3()); }
}

const WRECKED_INPUT = { throttle: 0, steer: 0, handbrake: true };

function approach(v, target, step) {
  return v > target ? Math.max(v - step, target) : Math.min(v + step, target);
}

function wrapAngle(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

// A slightly bouncy spring for the body wobble.
function spring(s, target, stiffness, dt) {
  const k = stiffness * stiffness;
  const damping = 2 * stiffness * 0.45; // < 1 means it overshoots a little
  s.v += ((target - s.x) * k - s.v * damping) * dt;
  s.x += s.v * dt;
}
