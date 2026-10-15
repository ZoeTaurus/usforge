// Scrap: pieces that broke off your car. They fly off, tumble, land, and
// glow with a beacon until you drive close and press E to grab them.
import * as THREE from 'three';

const GRAVITY = 22;
const MAX_SCRAP = 60;
const _m = new THREE.Matrix4();
const _inv = new THREE.Matrix4();

export class Scrap {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.beamGeo = new THREE.CylinderGeometry(0.12, 0.35, 7, 6, 1, true);
    this.beamGeo.translate(0, 3.5, 0);
    this.beamMat = new THREE.MeshBasicMaterial({ color: 0x40ffd0, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
    const ring = new THREE.RingGeometry(0.9, 1.15, 20);
    ring.rotateX(-Math.PI / 2);
    this.ringGeo = ring;
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0x40ffd0, transparent: true, opacity: 0.7, depthWrite: false });
    this.time = 0;
  }

  // objects: things on the car to copy (they're about to be removed).
  // item: { type, count, label }. push: velocity to fling it with.
  spawn(objects, item, push) {
    if (!objects.length) return;
    const pivot = objects[0].getWorldPosition(new THREE.Vector3());
    const group = new THREE.Group();
    group.position.copy(pivot);
    group.updateMatrixWorld(true);
    _inv.copy(group.matrixWorld).invert();
    for (const o of objects) {
      const c = o.clone(true);
      c.traverse((m) => { if (m.isMesh) m.castShadow = true; });
      _m.multiplyMatrices(_inv, o.matrixWorld);
      _m.decompose(c.position, c.quaternion, c.scale);
      group.add(c);
    }
    // Glow so you can find it
    const beam = new THREE.Mesh(this.beamGeo, this.beamMat);
    const ring = new THREE.Mesh(this.ringGeo, this.ringMat);
    beam.visible = ring.visible = false;
    this.scene.add(group, beam, ring);

    this.items.push({
      group, beam, ring, item,
      vel: push.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, 5 + Math.random() * 5, (Math.random() - 0.5) * 6)),
      spin: new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12),
      landed: false, collecting: 0, target: null,
    });
    while (this.items.length > MAX_SCRAP) this.#delete(this.items[0]);
  }

  update(dt) {
    this.time += dt;
    for (const s of [...this.items]) {
      const g = s.group;
      if (s.collecting > 0) {
        // Being sucked into the car
        s.collecting += dt * 3.5;
        g.position.lerp(s.target, Math.min(1, s.collecting * 0.6));
        g.scale.setScalar(Math.max(0.01, 1.4 - s.collecting));
        if (s.collecting >= 1.35) this.#delete(s);
        continue;
      }
      if (!s.landed) {
        s.vel.y -= GRAVITY * dt;
        g.position.addScaledVector(s.vel, dt);
        g.rotation.x += s.spin.x * dt; g.rotation.y += s.spin.y * dt; g.rotation.z += s.spin.z * dt;
        if (g.position.y < 0.3) {
          g.position.y = 0.3;
          s.vel.y = Math.abs(s.vel.y) * 0.35;
          s.vel.x *= 0.5; s.vel.z *= 0.5;
          s.spin.multiplyScalar(0.5);
          if (s.vel.length() < 1.5) {
            s.landed = true;
            s.beam.visible = s.ring.visible = true;
            s.beam.position.copy(g.position).setY(0);
            s.ring.position.copy(g.position).setY(0.1);
          }
        }
      } else {
        // Gentle pulse so it catches your eye
        const p = 1 + Math.sin(this.time * 4 + g.id) * 0.15;
        s.ring.scale.setScalar(p);
        g.position.y = 0.3 + Math.sin(this.time * 2 + g.id) * 0.08;
        g.rotation.y += dt * 0.8;
      }
    }
  }

  // Scrap that can be grabbed from this spot.
  inReach(pos, radius) {
    return this.items.filter((s) => s.collecting === 0 && s.group.position.distanceTo(pos) < radius);
  }

  // Start the "suck into the car" animation for these. Returns their items.
  collect(list, carPos) {
    for (const s of list) {
      s.collecting = 0.01;
      s.target = carPos.clone().setY(1.2);
      s.beam.visible = s.ring.visible = false;
    }
    return list.map((s) => s.item);
  }

  clear() { for (const s of [...this.items]) this.#delete(s); }

  #delete(s) {
    this.scene.remove(s.group, s.beam, s.ring);
    this.items.splice(this.items.indexOf(s), 1);
  }
}
