// Spawns demons in packs around the player, moves them, and handles
// ramming, getting shot, and clawing at the car.
//
// Ramming (plain version): when a demon touches the car, we measure how fast
// that part of the car is moving INTO the demon (spinning counts too, so
// drift-swiping works). Damage works like crash energy:
//   damage = demon health × (impact speed ÷ splat speed)² × (car weight ÷ normal weight)
// So at the splat speed a normal car does exactly enough to splat an imp,
// going twice as fast does 4× the damage, and a heavier car hits harder.
// Not enough damage = the demon gets knocked flying and the car gets a jolt.
import * as THREE from 'three';
import { SETTINGS } from '../settings.js';
import { DEMON_TYPES } from './demonTypes.js';

const GRAVITY = 22;
const MPH = 0.44704; // 1 mph in m/s
const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _qi = new THREE.Quaternion();
const _local = new THREE.Vector3();
const _dummy = new THREE.Object3D();
const _col = new THREE.Color();

export class Demons {
  constructor(scene, region, { gore, audio, stats, hud, chase }) {
    this.region = region;
    this.fx = { gore, audio, stats, hud, chase };
    this.mapHalf = region.terrain.size / 2 - 40;
    this.combo = 0;
    this.comboTimer = 0;
    this.spawnTimer = 0;
    this.kills = 0;

    // One instanced mesh per demon type that lives in this region.
    this.types = {};
    this.all = [];
    this.weights = region.demons.map((d) => ({ ...d, def: DEMON_TYPES[d.type] }));
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
        };
        pool.push(d);
        this.all.push(d);
        mesh.setColorAt(i, _col.setRGB(1, 1, 1));
        this.#remove(d); // start hidden
      }
      this.types[type] = { def, mesh, pool };
    }
  }

  get aliveCount() {
    let n = 0;
    for (const d of this.all) if (d.alive) n++;
    return n;
  }

  // ---------------------------------------------------------------- spawning
  spawnPack(center, count) {
    const pick = this.#pickType();
    const t = this.types[pick];
    const stats = t.def.stats();
    const dir = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
    for (let i = 0; i < count; i++) {
      const d = t.pool.find((p) => !p.alive);
      if (!d) return;
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * (2 + count * 0.5);
      d.pos.set(center.x + Math.cos(a) * r, 0, center.z + Math.sin(a) * r);
      d.prev.copy(d.pos);
      d.vel.set(0, 0, 0);
      d.hp = stats.health;
      d.stun = d.attackCd = d.ramCd = d.flash = d.lunge = 0;
      d.yaw = Math.random() * 6;
      d.wander.copy(dir);
      d.alive = true;
    }
  }

  #pickType() {
    const total = this.weights.reduce((s, w) => s + w.weight, 0);
    let r = Math.random() * total;
    for (const w of this.weights) if ((r -= w.weight) <= 0) return w.type;
    return this.weights[0].type;
  }

  // Keep the world topped up with packs, out of sight-ish.
  #refill(carPos, dt, initial = false) {
    const S = SETTINGS.imp;
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
      const n = Math.min(max - this.aliveCount, Math.round(S.packMin + Math.random() * (S.packMax - S.packMin)));
      this.spawnPack(c, n);
      if (!initial) break; // one pack at a time during play
    }
  }

  populate(carPos) { this.#refill(carPos, 0, true); }

  // How far away is the closest living demon?
  nearestDistance(pos) {
    let best = Infinity;
    for (const d of this.all) if (d.alive) best = Math.min(best, Math.hypot(d.pos.x - pos.x, d.pos.z - pos.z));
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
  }

  // ---------------------------------------------------------------- damage
  // source: 'gun' or 'ram'. push: direction/velocity for gore.
  damage(d, amount, source, push) {
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
    this.fx.gore.explode(d.pos, push, d.def.goreColors, source === 'ram' ? 1 : 0.7);
    this.fx.audio.splat(source === 'ram' ? 1 : 0.6);
    if (source === 'ram') {
      this.combo = this.comboTimer > 0 ? this.combo + 1 : 1;
      this.comboTimer = SETTINGS.ramming.comboTime;
      this.fx.hud.splat(this.combo);
      this.fx.chase.addShake(SETTINGS.ramming.shake);
    }
    this.#remove(d);
  }

  // ---------------------------------------------------------------- update
  // Runs at the fixed physics rate (60/s), after the car has moved.
  fixedUpdate(dt, car) {
    const S = SETTINGS.imp;
    const carPos = car.currPos;
    this.comboTimer -= dt;
    this.#refill(carPos, dt);

    // Car info for collisions
    _q.copy(car.currRot);
    _qi.copy(_q).invert();
    const lv = car.body.linvel();
    const carVel = new THREE.Vector3(lv.x, 0, lv.z);
    const yawRate = car.body.angvel().y;
    const carMass = car.totalMass; // car + all bolted-on parts
    const massFactor = carMass / SETTINGS.steering.referenceMass;
    const B = car.localBounds;     // the car's footprint, grown by parts
    const splatSpeed = SETTINGS.ramming.splatSpeedMph * MPH;

    for (const d of this.all) {
      if (!d.alive) continue;
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
        if (d.stun <= 0) {
          if (!car.wrecked && dist < S.noticeRange) {
            const sp = S.chaseSpeed * d.speedJitter;
            tx = (toCar.x / dist) * sp; tz = (toCar.z / dist) * sp;
          } else {
            if (Math.random() < dt * 0.3) d.wander.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
            tx = d.wander.x * S.wanderSpeed; tz = d.wander.z * S.wanderSpeed;
            // Don't wander off the map
            if (Math.abs(d.pos.x) > this.mapHalf || Math.abs(d.pos.z) > this.mapHalf) { tx = -d.pos.x * 0.01; tz = -d.pos.z * 0.01; }
          }
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
        const accel = 25 * dt;
        d.vel.x += THREE.MathUtils.clamp(tx - d.vel.x, -accel, accel);
        d.vel.z += THREE.MathUtils.clamp(tz - d.vel.z, -accel, accel);
        d.pos.x += d.vel.x * dt;
        d.pos.z += d.vel.z * dt;
        if (Math.hypot(d.vel.x, d.vel.z) > 0.5) d.yaw = lerpAngle(d.yaw, Math.atan2(d.vel.x, d.vel.z), 1 - Math.exp(-10 * dt));
      }

      // ---- Touching the car? ----
      if (dist > 14 || d.pos.y > B.maxY + 0.3 || car.wrecked) continue;
      _local.subVectors(d.pos, carPos).setY(0).applyQuaternion(_qi);
      // How deep into the car's footprint is the demon, from the nearest side?
      const sideX = _local.x > 0 ? 1 : -1, sideZ = _local.z > 0 ? 1 : -1;
      const px = sideX > 0 ? B.maxX + r - _local.x : _local.x - (B.minX - r);
      const pz = sideZ > 0 ? B.maxZ + r - _local.z : _local.z - (B.minZ - r);
      const reach = 0.45; // claws reach a bit further than the body
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

        // Push the demon out so it's not inside the car.
        const push = px < pz ? px : pz;
        d.pos.addScaledVector(_n, push);

        if (impact > 2 && d.ramCd <= 0) {
          d.ramCd = 0.25;
          // Spikes / plows facing this side make it hurt more.
          const bonus = 1 + (car.stats.ramBonus[hitSide] || 0);
          const dmg = d.def.stats().health * (impact / splatSpeed) ** 2 * massFactor * bonus;
          const carPush = new THREE.Vector3(cvx, 0, cvz);
          const killed = this.damage(d, dmg, 'ram', carPush);
          // The car loses a little momentum (heavier demons = more).
          const loss = Math.min(impact, impact * (d.def.stats().mass / carMass) * SETTINGS.ramming.momentumLoss * (killed ? 1 : 2.5));
          car.nudge(_n.x * -loss, _n.z * -loss);
          if (!killed) {
            // Knocked flying!
            // Fly off to the side a bit so you don't just bulldoze it along.
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

      // ---- Claw attack ----
      if (d.stun <= 0 && d.attackCd <= 0) {
        d.attackCd = d.def.stats().attackInterval * (0.8 + Math.random() * 0.4);
        d.lunge = 1;
        d.yaw = Math.atan2(carPos.x - d.pos.x, carPos.z - d.pos.z);
        car.takeDamage(d.def.stats().attackDamage, _v.copy(d.pos).setY(d.pos.y + 0.8)); // hits the nearest piece
        this.fx.audio.claw();
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
        d.phase += dt * (2 + speed * 2.2);
        const airborne = d.pos.y > 0.01;
        _dummy.position.lerpVectors(d.prev, d.pos, alpha);
        _dummy.position.y += airborne ? 0 : Math.abs(Math.sin(d.phase)) * 0.12 * Math.min(speed / 3, 1);
        _dummy.rotation.set(
          airborne ? d.phase * 2 : d.lunge * 0.6,                 // tumble when flying, lunge when clawing
          d.yaw,
          airborne ? d.phase : Math.sin(d.phase) * 0.18 * Math.min(speed / 2, 1) // waddle
        );
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
    let best = null, bestT = maxDist;
    const c = new THREE.Vector3();
    for (const d of this.all) {
      if (!d.alive) continue;
      c.copy(d.pos).setY(d.pos.y + d.def.height * 0.5);
      const t = raySphere(ray.origin, ray.direction, c, d.def.radius + 0.35);
      if (t !== null && t < bestT) { bestT = t; best = d; }
    }
    return best ? { demon: best, point: best.pos.clone().setY(best.pos.y + best.def.height * 0.5) } : null;
  }

  // First demon touched by a moving bullet from a to b.
  segmentHit(a, dir, length) {
    let best = null, bestT = length;
    const c = new THREE.Vector3();
    for (const d of this.all) {
      if (!d.alive) continue;
      if (Math.abs(d.pos.x - a.x) > length + 2 || Math.abs(d.pos.z - a.z) > length + 2) continue;
      c.copy(d.pos).setY(d.pos.y + d.def.height * 0.5);
      const t = raySphere(a, dir, c, d.def.radius + 0.15);
      if (t !== null && t < bestT) { bestT = t; best = d; }
    }
    return best ? { demon: best, t: bestT } : null;
  }
}

function raySphere(o, dir, c, radius) {
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
