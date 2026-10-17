// ATTRACT MODE: the movie that plays behind the title screen and the menu.
// The car drives itself (invincible) through the demons with its guns
// blazing, filmed like a trailer: camera cuts between low chase shots,
// fly-bys and crane shots. (The moody lighting is in world/lighting.js.)
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const ROAM = 320; // stay this close to the start (well away from the boss)

// ------------------------------------------------------------------ autopilot
export class Autopilot {
  constructor(car, demons) {
    this.car = car;
    this.demons = demons;
    this.input = { throttle: 1, steer: 0, handbrake: false };
    this.fire = false;
    this.aim = new THREE.Vector3();
    this.wander = new THREE.Vector3(60, 0, 60);
    this.stuck = 0;
    this.reverse = 0;
  }

  update(dt) {
    const car = this.car, p = car.currPos;
    // Target: the nearest demon (not too far), else roam around.
    let best = null, bestD = 160;
    for (const d of this.demons.all) {
      if (!d.alive) continue;
      const dist = Math.hypot(d.pos.x - p.x, d.pos.z - p.z);
      if (dist < bestD && Math.hypot(d.pos.x, d.pos.z) < ROAM) { bestD = dist; best = d; }
    }
    if (Math.hypot(this.wander.x - p.x, this.wander.z - p.z) < 25 || Math.hypot(this.wander.x, this.wander.z) > ROAM) {
      const a = Math.random() * Math.PI * 2, r = 80 + Math.random() * 180;
      this.wander.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    }
    const goal = best && Math.hypot(p.x, p.z) < ROAM ? best.pos : this.wander;

    // Steer toward it; pull the handbrake on sharp turns (drifts look great).
    const h = car.heading;
    const diff = wrap(Math.atan2(goal.x - p.x, goal.z - p.z) - Math.atan2(h.x, h.z));
    this.input.steer = THREE.MathUtils.clamp(-diff * 2.2, -1, 1);
    this.input.handbrake = Math.abs(diff) > 1.0 && car.speed > 14;
    this.input.throttle = 1;

    // Stuck on a rock? Back up for a moment.
    this.stuck = car.speed < 2 ? this.stuck + dt : 0;
    if (this.stuck > 1.2) { this.reverse = 1.2; this.stuck = 0; }
    if (this.reverse > 0) {
      this.reverse -= dt;
      this.input.throttle = -1;
      this.input.steer = 1;
      this.input.handbrake = false;
    }

    // Shoot whatever is close.
    this.fire = !!best && bestD < 70;
    if (best) this.aim.copy(best.pos).setY(best.pos.y + best.def.height * 0.5);
  }
}

// ------------------------------------------------------------------ camera
// Each shot: where the camera goes (relative to the car: h = facing,
// r = right) and what it looks at. "fixed" shots stay put in the world and
// let the car tear past.
const SHOTS = [
  { dur: 6.5, fov: 52, pos: (c, h, r) => c.clone().addScaledVector(h, -8.5).addScaledVector(UP, 2.2), look: (c, h) => c.clone().addScaledVector(h, 9).addScaledVector(UP, 2.2) },
  { dur: 4.5, fov: 42, fixed: true, pos: (c, h, r) => c.clone().addScaledVector(h, 30).addScaledVector(r, 3.5).addScaledVector(UP, 0.7), look: (c) => c.clone().addScaledVector(UP, 0.9) },
  { dur: 5, fov: 38, pos: (c, h, r) => c.clone().addScaledVector(r, 8).addScaledVector(h, -1).addScaledVector(UP, 1.5), look: (c, h) => c.clone().addScaledVector(h, 2.5).addScaledVector(UP, 0.9) },
  { dur: 6, fov: 50, crane: true, pos: (c, h, r, t) => c.clone().add(new THREE.Vector3(Math.sin(t * 0.25) * 15, 5 + t * 0.5, Math.cos(t * 0.25) * 15)), look: (c) => c.clone().addScaledVector(UP, 1) },
  { dur: 4, fov: 62, pos: (c, h, r) => c.clone().addScaledVector(r, 1.9).addScaledVector(h, -2.4).addScaledVector(UP, 0.5), look: (c, h) => c.clone().addScaledVector(h, 25).addScaledVector(UP, 0.8) },
  { dur: 4.5, fov: 45, fixed: true, pos: (c, h, r) => c.clone().addScaledVector(h, 22).addScaledVector(r, -9).addScaledVector(UP, 2.2), look: (c) => c.clone().addScaledVector(UP, 1) },
];

export class Director {
  constructor(camera, car, onCut) {
    this.camera = camera;
    this.car = car;
    this.onCut = onCut;
    this.index = 0;
    this.t = 0;
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.cut(0);
  }

  cut(index) {
    this.index = index % SHOTS.length;
    this.t = 0;
    const s = SHOTS[this.index];
    const { c, h, r } = this.#frame();
    this.pos.copy(s.pos(c, h, r, 0));
    this.look.copy(s.look(c, h, r, 0));
    this.camera.fov = s.fov;
    this.camera.updateProjectionMatrix();
    this.onCut?.();
  }

  #frame() {
    const c = this.car.position.clone();
    const h = this.car.heading.clone();
    const r = new THREE.Vector3(h.z, 0, -h.x);
    return { c, h, r };
  }

  update(dt) {
    this.t += dt;
    const s = SHOTS[this.index];
    if (this.t > s.dur) this.cut(this.index + 1);
    const { c, h, r } = this.#frame();
    const k = 1 - Math.exp(-4 * dt);
    if (!s.fixed) this.pos.lerp(s.pos(c, h, r, this.t), s.crane ? 1 : k);
    else this.pos.y += dt * 0.15; // slow rise
    this.look.lerp(s.look(c, h, r, this.t), 1 - Math.exp(-8 * dt));
    this.pos.y = Math.max(this.pos.y, 0.35);
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
    // If a fixed camera has lost the car, move on.
    if (s.fixed && this.t > 1.5 && this.pos.distanceTo(c) > 60) this.cut(this.index + 1);
  }
}

function wrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }
