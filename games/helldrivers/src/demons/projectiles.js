// Things demons throw at you: fireballs (Cinder Spitters), boulders (the
// Ash Titan) and lava bombs (the Magma Colossus: they leave a lava pool). They fly in an arc and explode where they land; any piece of
// your car caught in the blast takes damage.
import * as THREE from 'three';
import { litMaterial } from '../core/graphics.js';

const GRAVITY = 22;

export class Projectiles {
  constructor(scene, { car, dust, sparks, audio, chase }) {
    this.car = car;
    this.fx = { dust, sparks, audio, chase };
    this.scene = scene;
    this.kinds = {
      fireball: {
        geo: new THREE.IcosahedronGeometry(0.35, 0),
        mat: new THREE.MeshBasicMaterial({ color: 0xffa030 }),
        trail: 0xff6010,
      },
      boulder: {
        geo: new THREE.IcosahedronGeometry(1.1, 0),
        mat: litMaterial({ color: 0x4a4440, flatShading: true }),
        trail: 0x6a6460,
      },
      lavaBomb: {
        geo: new THREE.IcosahedronGeometry(0.9, 0),
        mat: new THREE.MeshBasicMaterial({ color: 0xff8a20 }),
        trail: 0xff6010,
      },
    };
    this.list = [];
  }

  // Throw from `from` so it lands where the car will be in `flightTime` s.
  // onLand(point) is called where it lands (e.g. to leave a lava pool).
  throwAt(kind, from, damage, splash, flightTime = 1.3, onLand = null) {
    const car = this.car;
    const lv = car.body.linvel();
    const target = car.currPos.clone().add(new THREE.Vector3(lv.x, 0, lv.z).multiplyScalar(flightTime * 0.85));
    target.y = 0.4;
    const vel = target.clone().sub(from).divideScalar(flightTime);
    vel.y += 0.5 * GRAVITY * flightTime;
    const k = this.kinds[kind];
    const mesh = new THREE.Mesh(k.geo, k.mat);
    mesh.castShadow = true;
    mesh.position.copy(from);
    this.scene.add(mesh);
    this.list.push({ kind, mesh, vel, damage, splash, trailTimer: 0, onLand });
  }

  update(dt) {
    for (const p of [...this.list]) {
      p.vel.y -= GRAVITY * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += dt * 5;
      p.mesh.rotation.z += dt * 3;
      if ((p.trailTimer -= dt) <= 0) {
        p.trailTimer = 0.04;
        const fiery = p.kind !== 'boulder';
        const trail = fiery ? this.fx.sparks : this.fx.dust;
        trail.spawn(p.mesh.position, new THREE.Vector3((Math.random() - 0.5), 0.5, (Math.random() - 0.5)), p.kind === 'fireball' ? 0.15 : 0.35, 0.5);
      }
      // Direct hit on the car, or landed?
      const nearCar = p.mesh.position.distanceTo(this.car.position) < 2.4 && p.mesh.position.y < 2.5;
      if (nearCar || p.mesh.position.y <= 0.2) this.#explode(p);
    }
  }

  #explode(p) {
    const at = p.mesh.position.clone();
    this.scene.remove(p.mesh);
    this.list.splice(this.list.indexOf(p), 1);
    const car = this.car;
    // Damage the piece nearest the blast if the car is inside it.
    const d = at.distanceTo(car.position);
    if (d < p.splash + 2 && !car.wrecked) {
      const falloff = Math.max(0.3, 1 - Math.max(0, d - 2) / p.splash);
      car.takeDamage(p.damage * falloff, at);
      this.fx.chase.addShake(p.kind === 'fireball' ? 0.25 : 0.6);
    }
    const n = p.kind === 'fireball' ? 8 : 14;
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 8, 2 + Math.random() * 5, (Math.random() - 0.5) * 8);
      (p.kind === 'boulder' ? this.fx.dust : this.fx.sparks).spawn(at, v, p.kind === 'fireball' ? 0.2 : 0.6, 0.7);
    }
    p.onLand?.(at);
    this.fx.audio.thump();
  }

  clear() { for (const p of [...this.list]) { this.scene.remove(p.mesh); } this.list = []; }
}
