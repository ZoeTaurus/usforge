// Spawns demons in packs around the player, moves them, and handles
// ramming, getting shot, and attacking the car.
//
// Ramming (plain version): when a demon touches the car, we measure how fast
// that part of the car was moving INTO the demon (spinning counts too, so
// drift-swiping works). Damage works like crash energy:
//   damage = ramPower × (impact speed ÷ splat speed)² × (car weight ÷ normal weight) × spikes/plows
// A normal car at the splat speed does 40: exactly an imp. Brutes have 450,
// so you need speed AND weight (or guns). Not enough damage = the demon gets
// knocked back (or, for heavy demons, YOU bounce off).
import * as THREE from 'three';
import { SETTINGS } from '../settings.js';
import { DEMON_TYPES } from './demonTypes.js';

const GRAVITY = 22;
const KMH = 1 / 3.6; // 1 km/h in m/s
const HEAVY_BODIES = 12; // physics bodies for heavy demons (brutes)
const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _qi = new THREE.Quaternion();
const _local = new THREE.Vector3();
const _dummy = new THREE.Object3D();
const _col = new THREE.Color();

export class Demons {
  constructor(scene, region, { gore, audio, stats, hud, chase, physics, projectiles }) {
    this.region = region;
    this.fx = { gore, audio, stats, hud, chase };
    this.projectiles = projectiles;
    this.mapHalf = region.terrain.size / 2 - 40;
    this.start = new THREE.Vector3(0, 0, 0);
    this.combo = 0;
    this.comboTimer = 0;
    this.spawnTimer = 0;
    this.kills = 0;
    this.boss = null; // set by main once the boss exists

    // One instanced mesh per demon type that lives in this region.
    this.types = {};
    this.all = [];
    this.weights = region.demons.map((d) => ({ minDistance: 0, ...d, def: DEMON_TYPES[d.type] }));
    for (const { type, def } of this.weights) {
      const mesh = new THREE.InstancedMesh(
        def.createGeometry(),
        new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.7 }),
        def.poolSize
      );
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      scene.add(mesh);
      const pool = [];
      for (let i = 0; i < def.poolSize; i++) {
        const d = {
          type, def, index: i, mesh, alive: false,
          pos: new THREE.Vector3(), prev: new THREE.Vector3(), vel: new THREE.Vector3(),
          yaw: 0, hp: 0, stun: 0, attackCd: 0, ramCd: 0, flash: 0, phase: Math.random() * 6,
          wander: new THREE.Vector3(), speedJitter: 0.85 + Math.random() * 0.3, lunge: 0,
          strafe: Math.random() < 0.5 ? -1 : 1, body: null,
        };
        pool.push(d);
        this.all.push(d);
        mesh.setColorAt(i, _col.setRGB(1, 1, 1));
        this.#remove(d); // start hidden
      }
      this.types[type] = { def, mesh, pool };
    }

    // Heavy demons are solid: real physics bodies the car bounces off.
    const { RAPIER, world } = physics;
    this.freeBodies = [];
    for (let i = 0; i < HEAVY_BODIES; i++) {
      const b = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -100 - i * 5, 0));
      world.createCollider(RAPIER.ColliderDesc.capsule(0.7, 1.05).setTranslation(0, 1.4, 0).setRestitution(0.4), b);
      this.freeBodies.push(b);
    }
  }

  get aliveCount() {
    let n = 0;
    for (const d of this.all) if (d.alive) n++;
    return n;
  }

  // ---------------------------------------------------------------- spawning
  // A pack of one type around `center`. Type is picked by the region's
  // weights (only types allowed this far from the start) unless given.
  spawnPack(center, count, forceType = null) {
    const type = forceType || this.#pickType(Math.hypot(center.x - this.start.x, center.z - this.start.z));
    const t = this.types[type];
    if (!t) return;
    const stats = t.def.stats();
    if (count == null) count = Math.round(stats.packMin + Math.random() * (stats.packMax - stats.packMin));
    const dir = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
    for (let i = 0; i < count; i++) {
      const d = t.pool.find((p) => !p.alive);
      if (!d) return;
      if (t.def.heavy) {
        d.body = this.freeBodies.pop();
        if (!d.body) return;
      }
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * (2 + count * 0.6 * t.def.radius);
      d.pos.set(center.x + Math.cos(a) * r, 0, center.z + Math.sin(a) * r);
      d.prev.copy(d.pos);
      d.vel.set(0, 0, 0);
      d.hp = stats.health;
      d.stun = d.ramCd = d.flash = d.lunge = 0;
      d.attackCd = Math.random() * stats.attackInterval;
      d.yaw = Math.random() * 6;
      d.wander.copy(dir);
      d.alive = true;
      if (d.body) d.body.setTranslation({ x: d.pos.x, y: 0, z: d.pos.z }, true);
    }
  }

  #pickType(distFromStart) {
    const ok = this.weights.filter((w) => distFromStart >= w.minDistance);
    const total = ok.reduce((s, w) => s + w.weight, 0);
    let r = Math.random() * total;
    for (const w of ok) if ((r -= w.weight) <= 0) return w.type;
    return ok[0]?.type || this.weights[0].type;
  }

  // Keep the world topped up with packs, out of sight-ish.
  #refill(carPos, dt, initial = false) {
    if (SETTINGS.dev.noEnemies) return; // dev mode: peace and quiet
    const S = SETTINGS.demons;
    const max = Math.min(S.maxActive, this.all.length);
    this.spawnTimer -= dt;
    if (!initial && this.spawnTimer > 0) return;
    this.spawnTimer = 1.2;
    let guard = 40;
    while (this.aliveCount < max && guard-- > 0) {
      const a = Math.random() * Math.PI * 2;
      const dist = initial ? 60 + Math.random() * 160 : 110 + Math.random() * 90;
      const c = new THREE.Vector3(carPos.x + Math.cos(a) * dist, 0, carPos.z + Math.sin(a) * dist);
      c.x = THREE.MathUtils.clamp(c.x, -this.mapHalf, this.mapHalf);
      c.z = THREE.MathUtils.clamp(c.z, -this.mapHalf, this.mapHalf);
      if (c.distanceTo(carPos) < 50) continue;
      if (this.boss && c.distanceTo(this.boss.arenaCenter) < this.boss.arenaRadius + 20) continue; // keep the arena clear
      const type = this.#pickType(Math.hypot(c.x - this.start.x, c.z - this.start.z));
      const st = this.types[type].def.stats();
      const n = Math.min(max - this.aliveCount, Math.round(st.packMin + Math.random() * (st.packMax - st.packMin)));
      this.spawnPack(c, n, type);
      if (!initial) break; // one pack at a time during play
    }
  }

  populate(carPos) { this.#refill(carPos, 0, true); }

  // How far away is the closest living demon (or an awake boss)?
  nearestDistance(pos) {
    let best = Infinity;
    for (const d of this.all) if (d.alive) best = Math.min(best, Math.hypot(d.pos.x - pos.x, d.pos.z - pos.z));
    if (this.boss?.awake) best = Math.min(best, this.boss.distanceTo(pos));
    return best;
  }

  // Remove every demon near a point (used when respawning the player).
  clearAround(pos, radius) {
    for (const d of this.all) if (d.alive && d.pos.distanceTo(pos) < radius) this.#remove(d);
  }

  #remove(d) {
    d.alive = false;
    _dummy.scale.setScalar(0);
    _dummy.updateMatrix();
    d.mesh.setMatrixAt(d.index, _dummy.matrix);
    if (d.body) {
      d.body.setNextKinematicTranslation({ x: 0, y: -100 - this.freeBodies.length * 5, z: 0 });
      this.freeBodies.push(d.body);
      d.body = null;
    }
  }

  // ---------------------------------------------------------------- damage
  // source: 'gun' or 'ram'. push: direction/velocity for gore.
  damage(d, amount, source, push) {
    if (d.isBoss) return d.takeHit(amount, source, push);
    if (!d.alive) return false;
    const dealt = Math.min(amount, d.hp);
    d.hp -= amount;
    d.flash = 1;
    this.fx.stats.record(source, dealt);
    if (d.hp <= 0) {
      this.#kill(d, source, push);
      return true;
    }
    return false;
  }

  #kill(d, source, push) {
    this.kills++;
    this.fx.stats.kill(source);
    this.onKill?.(d, source); // (souls!)
    const big = d.def.heavy ? 2.5 : 1;
    this.fx.gore.explode(d.pos, push, d.def.goreColors, (source === 'ram' ? 1 : 0.7) * big);
    this.fx.audio.splat(source === 'ram' || d.def.heavy ? 1 : 0.6);
    if (source === 'ram') {
      this.combo = this.comboTimer > 0 ? this.combo + 1 : 1;
      this.comboTimer = SETTINGS.ramming.comboTime;
      this.fx.hud.splat(this.combo);
      this.fx.chase.addShake(SETTINGS.ramming.shake * big);
    }
    this.#remove(d);
  }

  // Damage everything within `radius` of a point (explosions). Less at the edge.
  damageArea(point, radius, amount, source) {
    for (const d of this.all) {
      if (!d.alive) continue;
      const dist = Math.hypot(d.pos.x - point.x, d.pos.z - point.z);
      if (dist > radius + d.def.radius) continue;
      const push = new THREE.Vector3(d.pos.x - point.x, 4, d.pos.z - point.z).normalize().multiplyScalar(10);
      this.damage(d, amount * (1 - 0.5 * Math.min(1, dist / radius)), source, push);
    }
    if (this.boss?.awake && this.boss.distanceTo(point) < radius) this.boss.takeHit(amount, source, new THREE.Vector3());
  }

  // ---------------------------------------------------------------- update
  // Runs at the fixed physics rate (60/s), after the car has moved.
  fixedUpdate(dt, car) {
    const S = SETTINGS.demons;
    const carPos = car.currPos;
    this.comboTimer -= dt;
    this.#refill(carPos, dt);

    // Car info for collisions. We use the car's speed from just BEFORE the
    // physics step, so bouncing off a brute still counts as a hard hit.
    _q.copy(car.currRot);
    _qi.copy(_q).invert();
    const carVel = new THREE.Vector3(car.vBefore.x, 0, car.vBefore.z);
    const yawRate = car.body.angvel().y;
    const carMass = car.totalMass; // car + all bolted-on parts
    const massFactor = carMass / SETTINGS.steering.referenceMass;
    const B = car.localBounds;     // the car's footprint, grown by parts
    const splatSpeed = SETTINGS.ramming.splatSpeedKmh * KMH;

    for (const d of this.all) {
      if (!d.alive) continue;
      const st = d.def.stats();
      d.prev.copy(d.pos);
      const r = d.def.radius;
      const toCar = _v.subVectors(carPos, d.pos).setY(0);
      const dist = toCar.length();

      if (dist > S.despawnDistance) { this.#remove(d); continue; }
      d.stun -= dt; d.attackCd -= dt; d.ramCd -= dt; d.lunge = Math.max(0, d.lunge - dt * 4);
      d.flash = Math.max(0, d.flash - dt * 6);

      // ---- Flying through the air after a hit ----
      if (d.pos.y > 0 || d.vel.y > 0) {
        d.vel.y -= GRAVITY * dt;
        d.pos.addScaledVector(d.vel, dt);
        if (d.pos.y <= 0) {
          d.pos.y = 0;
          d.vel.y = 0;
          d.vel.x *= 0.4; d.vel.z *= 0.4;
        }
      } else {
        // ---- Decide where to go ----
        let tx = 0, tz = 0;
        const awake = !car.wrecked && dist < st.noticeRange;
        if (d.stun <= 0 && awake) {
          const sp = st.chaseSpeed * d.speedJitter;
          const ux = toCar.x / dist, uz = toCar.z / dist;
          if (d.def.behavior === 'ranged') {
            // Keep a comfortable distance: flee, close in, or circle.
            if (dist < st.fleeRange) { tx = -ux * sp; tz = -uz * sp; }
            else if (dist > st.preferredRange) { tx = ux * sp * 0.7; tz = uz * sp * 0.7; }
            else { tx = -uz * d.strafe * 2; tz = ux * d.strafe * 2; }
          } else {
            tx = ux * sp; tz = uz * sp;
          }
        } else if (d.stun <= 0) {
          if (Math.random() < dt * 0.3) d.wander.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
          tx = d.wander.x * S.wanderSpeed; tz = d.wander.z * S.wanderSpeed;
          // Don't wander off the map (or into the boss arena)
          if (Math.abs(d.pos.x) > this.mapHalf || Math.abs(d.pos.z) > this.mapHalf) { tx = -d.pos.x * 0.01; tz = -d.pos.z * 0.01; }
        }
        // ---- Don't stack on top of each other ----
        for (const o of this.all) {
          if (o === d || !o.alive) continue;
          const dx = d.pos.x - o.pos.x, dz = d.pos.z - o.pos.z;
          const dd = dx * dx + dz * dz;
          const min = r + o.def.radius;
          if (dd < min * min && dd > 1e-6) {
            const k = (min - Math.sqrt(dd)) * 8;
            const inv = 1 / Math.sqrt(dd);
            tx += dx * inv * k; tz += dz * inv * k;
          }
        }
        const accel = (d.def.heavy ? 10 : 25) * dt;
        d.vel.x += THREE.MathUtils.clamp(tx - d.vel.x, -accel, accel);
        d.vel.z += THREE.MathUtils.clamp(tz - d.vel.z, -accel, accel);
        d.pos.x += d.vel.x * dt;
        d.pos.z += d.vel.z * dt;
        const faceCar = awake && d.def.behavior === 'ranged';
        const wantYaw = faceCar ? Math.atan2(toCar.x, toCar.z) : Math.atan2(d.vel.x, d.vel.z);
        if (faceCar || Math.hypot(d.vel.x, d.vel.z) > 0.5) d.yaw = lerpAngle(d.yaw, wantYaw, 1 - Math.exp(-10 * dt));

        // ---- Ranged attack: lob a fireball ----
        if (d.def.behavior === 'ranged' && awake && d.stun <= 0 && d.attackCd <= 0 && dist < st.shootRange && dist > 6) {
          d.attackCd = st.attackInterval * (0.8 + Math.random() * 0.4);
          d.lunge = 1;
          const mouth = d.pos.clone().add(new THREE.Vector3(Math.sin(d.yaw) * 0.6, 2.1, Math.cos(d.yaw) * 0.6));
          this.projectiles.throwAt('fireball', mouth, st.attackDamage, st.splash, THREE.MathUtils.clamp(dist / 22, 0.7, 2));
        }
      }
      if (d.body) d.body.setNextKinematicTranslation({ x: d.pos.x, y: d.pos.y, z: d.pos.z });

      // ---- Touching the car? ----
      if (dist > 16 || d.pos.y > B.maxY + 0.3 || car.wrecked) continue;
      _local.subVectors(d.pos, carPos).setY(0).applyQuaternion(_qi);
      // How deep into the car's footprint is the demon, from the nearest side?
      // (Heavy demons are solid, so the car stops just short of them.)
      const rr = r + (d.def.heavy ? 0.3 : 0);
      const sideX = _local.x > 0 ? 1 : -1, sideZ = _local.z > 0 ? 1 : -1;
      const px = sideX > 0 ? B.maxX + rr - _local.x : _local.x - (B.minX - rr);
      const pz = sideZ > 0 ? B.maxZ + rr - _local.z : _local.z - (B.minZ - rr);
      const reach = d.def.heavy ? 0.9 : 0.45; // claws reach a bit further than the body
      if (px < -reach || pz < -reach) continue;
      const touching = px > 0 && pz > 0;

      if (touching) {
        // Which side of the car did we hit? (the side we're least deep into)
        const hitSide = px < pz ? `${sideX},0` : `0,${sideZ}`;
        if (px < pz) _n.set(sideX, 0, 0); else _n.set(0, 0, sideZ);
        _n.applyQuaternion(_q); // to world: points from car toward demon
        // Speed of that bit of car (moving + spinning), into the demon.
        const rx = d.pos.x - carPos.x, rz = d.pos.z - carPos.z;
        const cvx = carVel.x + yawRate * rz, cvz = carVel.z - yawRate * rx;
        // Only the CAR's motion counts (imps running into a parked car don't
        // splat themselves), minus anything the demon was doing to dodge.
        const impact = (cvx * _n.x + cvz * _n.z) - Math.max(0, d.vel.x * _n.x + d.vel.z * _n.z);

        // Push light demons out so they're not inside the car.
        if (!d.def.heavy) d.pos.addScaledVector(_n, px < pz ? px : pz);

        if (impact > 2 && d.ramCd <= 0) {
          d.ramCd = 0.3;
          // Spikes / plows facing this side make it hurt more.
          const bonus = 1 + (car.stats.ramBonus[hitSide] || 0);
          const dmg = SETTINGS.ramming.ramPower * (impact / splatSpeed) ** 2 * massFactor * bonus;
          const carPush = new THREE.Vector3(cvx, 0, cvz);
          // Pincushions: their spikes stab whatever hit them.
          if (d.def.thorns) {
            car.takeDamage(st.thornDamage * THREE.MathUtils.clamp(impact / splatSpeed, 0.5, 2), _v.copy(d.pos).setY(0.6));
            this.fx.audio.claw();
          }
          // Magma brutes: hitting molten rock sets that side of your car on fire.
          if (d.def.ramBurn) car.igniteAt(_v.copy(d.pos).setY(0.6), st.burnDps, st.burnTime);
          const killed = this.damage(d, dmg, 'ram', carPush);
          if (d.def.heavy) {
            if (killed) {
              // Smashed straight through it! (and it hurts the car much less)
              car.body.setLinvel({ x: car.vBefore.x * 0.75, y: car.vBefore.y, z: car.vBefore.z * 0.75 }, true);
              if (car.lastCrash) car.lastCrash.soften = 0.3;
            } else {
              // Bounced off. It staggers a little; you get thrown back.
              car.nudge(-_n.x * impact * 0.35, -_n.z * impact * 0.35);
              d.stun = 0.5;
              this.fx.audio.thump();
              this.fx.chase.addShake(0.5);
            }
            continue;
          }
          // The car loses a little momentum (heavier demons = more).
          const loss = Math.min(impact, impact * (st.mass / carMass) * SETTINGS.ramming.momentumLoss * (killed ? 1 : 2.5));
          car.nudge(_n.x * -loss, _n.z * -loss);
          if (!killed) {
            // Knocked flying! Off to the side a bit so you don't just bulldoze it along.
            const side = (Math.random() < 0.5 ? -1 : 1) * (2 + impact * 0.5);
            d.vel.set(_n.x * (impact * 1.2 + 3) - _n.z * side, 3 + impact * 0.35, _n.z * (impact * 1.2 + 3) + _n.x * side);
            d.pos.y = 0.01;
            d.stun = 0.9;
            this.fx.audio.thump();
          }
          continue;
        }
        // Slow touch: just keep it outside, stop it moving into the car.
        const into = d.vel.x * -_n.x + d.vel.z * -_n.z;
        if (into > 0) { d.vel.x += _n.x * into; d.vel.z += _n.z * into; }
      }

      // ---- Claw / bite / smash ----
      if (d.def.behavior === 'melee' && d.stun <= 0 && d.attackCd <= 0) {
        d.attackCd = st.attackInterval * (0.8 + Math.random() * 0.4);
        d.lunge = 1;
        d.yaw = Math.atan2(carPos.x - d.pos.x, carPos.z - d.pos.z);
        car.takeDamage(st.attackDamage, _v.copy(d.pos).setY(d.pos.y + 0.8)); // hits the nearest piece
        if (st.burnDps) car.igniteAt(_v, st.burnDps, st.burnTime);           // fire claws / magma fists
        if (d.def.heavy) {
          // A brute's punch shoves the whole car.
          const ux = (carPos.x - d.pos.x) / dist, uz = (carPos.z - d.pos.z) / dist;
          car.nudge(ux * 4, uz * 4);
          this.fx.chase.addShake(0.5);
          this.fx.audio.thump();
        } else this.fx.audio.claw();
      }
    }
  }

  // ---------------------------------------------------------------- drawing
  render(alpha, dt) {
    for (const t of Object.values(this.types)) {
      const { mesh } = t;
      for (const d of t.pool) {
        if (!d.alive) continue;
        const speed = Math.hypot(d.vel.x, d.vel.z);
        const anim = d.def.anim;
        d.phase += dt * (anim === 'stomp' ? 1 + speed * 1.2 : 2 + speed * 2.2);
        const airborne = d.pos.y > 0.01;
        const moving = Math.min(speed / 2, 1);
        _dummy.position.lerpVectors(d.prev, d.pos, alpha);
        let rx = d.lunge * 0.6, rz = 0, bob = 0;
        if (anim === 'waddle') { rz = Math.sin(d.phase) * 0.18 * moving; bob = Math.abs(Math.sin(d.phase)) * 0.12 * moving; }
        if (anim === 'gallop') { rx += Math.sin(d.phase) * 0.22 * moving; bob = Math.abs(Math.sin(d.phase)) * 0.25 * moving; }
        if (anim === 'stomp') { rz = Math.sin(d.phase) * 0.08 * moving; bob = Math.abs(Math.sin(d.phase)) * 0.12 * moving; }
        if (anim === 'sway') { rz = Math.sin(d.phase * 0.6) * 0.1; rx -= d.lunge * 0.9; }
        if (airborne) { rx = d.phase * 2; rz = d.phase; bob = 0; } // tumble when flying
        _dummy.position.y += bob;
        _dummy.rotation.set(rx, d.yaw, rz);
        _dummy.scale.setScalar(1 + d.flash * 0.15);
        _dummy.updateMatrix();
        mesh.setMatrixAt(d.index, _dummy.matrix);
        const f = 1 + d.flash * 3; // flash bright when hit
        mesh.setColorAt(d.index, _col.setRGB(f, f, f));
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
    }
  }

  // ---------------------------------------------------------------- queries
  // First demon hit by a ray (for aiming). Returns {demon, point} or null.
  raycast(ray, maxDist = 300) {
    let best = null, bestT = maxDist, bestPoint = null;
    const c = new THREE.Vector3();
    for (const d of this.all) {
      if (!d.alive) continue;
      c.copy(d.pos).setY(d.pos.y + d.def.height * 0.5);
      const t = raySphere(ray.origin, ray.direction, c, d.def.radius + 0.35);
      if (t !== null && t < bestT) { bestT = t; best = d; bestPoint = c.clone(); }
    }
    const bh = this.boss?.raycast(ray.origin, ray.direction);
    if (bh && bh.t < bestT) return { demon: this.boss, point: bh.point };
    return best ? { demon: best, point: bestPoint } : null;
  }

  // First demon touched by a moving bullet from a, going `length` along dir.
  segmentHit(a, dir, length) {
    let best = null, bestT = length;
    const c = new THREE.Vector3();
    for (const d of this.all) {
      if (!d.alive) continue;
      if (Math.abs(d.pos.x - a.x) > length + 3 || Math.abs(d.pos.z - a.z) > length + 3) continue;
      c.copy(d.pos).setY(d.pos.y + d.def.height * 0.5);
      const t = raySphere(a, dir, c, d.def.radius + 0.15 + (d.def.height > 2 ? 0.3 : 0));
      if (t !== null && t < bestT) { bestT = t; best = d; }
    }
    const bh = this.boss?.raycast(a, dir);
    if (bh && bh.t < bestT) return { demon: this.boss, t: bh.t };
    return best ? { demon: best, t: bestT } : null;
  }
}

export function raySphere(o, dir, c, radius) {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * dir.x + oy * dir.y + oz * dir.z;
  const cc = ox * ox + oy * oy + oz * oz - radius * radius;
  const disc = b * b - cc;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : (cc < 0 ? 0 : null);
}

function lerpAngle(a, b, k) {
  return a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
}
