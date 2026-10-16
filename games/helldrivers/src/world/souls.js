// Souls: glowing orbs that burst out of dead demons and fly into your car.
// Each orb carries some of the demon's soul value; it counts when it arrives.
import * as THREE from 'three';

const MAX = 300;
const _dummy = new THREE.Object3D();

export class Souls {
  constructor(scene, onCollect) {
    this.onCollect = onCollect; // called with the value when an orb arrives
    this.mesh = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(0.22, 0),
      new THREE.MeshBasicMaterial({ color: 0x9fe0ff, transparent: true, opacity: 0.9 }),
      MAX
    );
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.orbs = Array.from({ length: MAX }, () => ({ active: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), value: 0, age: 0 }));
    this.next = 0;
    for (let i = 0; i < MAX; i++) this.#hide(i);
  }

  // A demon died at `pos` and was worth `value` souls.
  burst(pos, value) {
    const n = Math.max(1, Math.min(12, Math.round(value)));
    for (let k = 0; k < n; k++) {
      const o = this.orbs[this.next];
      this.next = (this.next + 1) % MAX;
      if (o.active) this.onCollect(o.value); // pool full: just pay out the oldest
      o.active = true;
      o.age = 0;
      o.value = value / n;
      o.pos.copy(pos).setY(pos.y + 1);
      const a = Math.random() * Math.PI * 2;
      o.vel.set(Math.cos(a) * 4, 5 + Math.random() * 4, Math.sin(a) * 4);
    }
  }

  update(dt, carPos) {
    const target = _dummy.position;
    for (let i = 0; i < MAX; i++) {
      const o = this.orbs[i];
      if (!o.active) continue;
      o.age += dt;
      target.set(carPos.x, carPos.y + 0.8, carPos.z);
      const to = target.sub(o.pos);
      const dist = to.length();
      if (o.age > 0.35) {
        // Home in on the car, faster and faster
        const pull = 30 + o.age * 60;
        o.vel.lerp(to.normalize().multiplyScalar(pull), Math.min(1, dt * 6));
      } else {
        o.vel.y -= 12 * dt;
        o.vel.multiplyScalar(1 - dt * 2);
      }
      o.pos.addScaledVector(o.vel, dt);
      if (dist < 1.2 || o.age > 4) {
        o.active = false;
        this.#hide(i);
        this.onCollect(o.value);
        continue;
      }
      _dummy.position.copy(o.pos);
      _dummy.rotation.set(o.age * 5, o.age * 7, 0);
      _dummy.scale.setScalar(0.8 + Math.sin(o.age * 20) * 0.2);
      _dummy.updateMatrix();
      this.mesh.setMatrixAt(i, _dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() { for (let i = 0; i < MAX; i++) { this.orbs[i].active = false; this.#hide(i); } }

  #hide(i) {
    _dummy.position.set(0, -1000, 0);
    _dummy.scale.setScalar(0);
    _dummy.updateMatrix();
    this.mesh.setMatrixAt(i, _dummy.matrix);
  }
}
