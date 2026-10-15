// Real bullets: they fly from the guns and hit demons or the ground.
// All bullets are drawn in one go (instanced), so 40 guns stay smooth.
import * as THREE from 'three';
import { SETTINGS } from '../settings.js';

const MAX = 500;
const _dummy = new THREE.Object3D();
const _tmp = new THREE.Vector3();

export class Bullets {
  constructor(scene, { demons, dust, gore, audio }) {
    this.demons = demons;
    this.dust = dust;
    this.gore = gore;
    this.audio = audio;
    const geo = new THREE.BoxGeometry(0.09, 0.09, 2.0);
    geo.translate(0, 0, -1.0); // the tail trails behind the tip
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffe080 }), MAX);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.pool = Array.from({ length: MAX }, () => ({ pos: new THREE.Vector3(), dir: new THREE.Vector3(), traveled: 0, active: false }));
    this.next = 0;
    for (let i = 0; i < MAX; i++) this.#hide(i);
  }

  fire(from, target) {
    const T = SETTINGS.turret;
    const b = this.pool[this.next];
    this.next = (this.next + 1) % MAX;
    b.pos.copy(from);
    b.dir.subVectors(target, from).normalize();
    // A bit of random spread
    const s = THREE.MathUtils.degToRad(T.spread);
    b.dir.x += (Math.random() - 0.5) * s * 2;
    b.dir.y += (Math.random() - 0.5) * s * 2;
    b.dir.z += (Math.random() - 0.5) * s * 2;
    b.dir.normalize();
    b.traveled = 0;
    b.active = true;
  }

  update(dt) {
    const T = SETTINGS.turret;
    for (let i = 0; i < MAX; i++) {
      const b = this.pool[i];
      if (!b.active) continue;
      let step = T.bulletSpeed * dt;
      // Hit a demon?
      const hit = this.demons.segmentHit(b.pos, b.dir, step);
      if (hit) {
        b.pos.addScaledVector(b.dir, hit.t);
        this.gore.spray(b.pos, b.dir);
        this.audio.hit();
        this.demons.damage(hit.demon, T.damage, 'gun', b.dir.clone().multiplyScalar(14));
        this.#stop(i);
        continue;
      }
      // Hit the ground?
      if (b.dir.y < 0 && b.pos.y + b.dir.y * step <= 0) {
        step = -b.pos.y / b.dir.y;
        b.pos.addScaledVector(b.dir, step);
        if (Math.random() < 0.5) {
          this.dust.spawn(b.pos, new THREE.Vector3((Math.random() - 0.5) * 3, 2 + Math.random() * 2, (Math.random() - 0.5) * 3), 0.25, 0.5);
        }
        this.#stop(i);
        continue;
      }
      b.pos.addScaledVector(b.dir, step);
      b.traveled += step;
      if (b.traveled > T.range) { this.#stop(i); continue; }
      _dummy.position.copy(b.pos);
      _dummy.lookAt(_tmp.copy(b.pos).add(b.dir)); // point the tracer where it's going
      _dummy.scale.setScalar(1);
      _dummy.updateMatrix();
      this.mesh.setMatrixAt(i, _dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  #stop(i) {
    this.pool[i].active = false;
    this.#hide(i);
  }

  #hide(i) {
    _dummy.position.set(0, -1000, 0);
    _dummy.scale.setScalar(0);
    _dummy.updateMatrix();
    this.mesh.setMatrixAt(i, _dummy.matrix);
  }
}
