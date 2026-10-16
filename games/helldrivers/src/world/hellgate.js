// THE HELLGATE: opens next to a region's arena once its boss is dead.
// Drive through it to travel to the next region. If the next region isn't
// built yet, the gate stands there sealed (dark, no swirl).
import * as THREE from 'three';

export class Hellgate {
  constructor(scene, position, faceToward, leadsTo) {
    this.pos = position.clone().setY(0);
    this.leadsTo = leadsTo; // region data, or null = sealed
    this.open = false;
    this.t = 0;

    const g = new THREE.Group();
    g.position.copy(this.pos);
    g.rotation.y = Math.atan2(faceToward.x - this.pos.x, faceToward.z - this.pos.z);
    const stone = new THREE.MeshStandardMaterial({ color: 0x2a1a18, flatShading: true, roughness: 0.9 });
    const bone = new THREE.MeshStandardMaterial({ color: 0xd8cfb8, flatShading: true });
    this.glowMat = new THREE.MeshBasicMaterial({ color: leadsTo ? 0xff3010 : 0x40302c });
    this.swirlMat = new THREE.MeshBasicMaterial({ color: 0xff6020, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });

    // Two pillars with horns, an arch of bone, and the glowing ring.
    for (const x of [-6, 6]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 11, 1.6), stone);
      pillar.position.set(x, 5.5, 0);
      pillar.castShadow = true;
      g.add(pillar);
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.6, 3, 5), bone);
      horn.position.set(x * 1.05, 12.2, 0);
      horn.rotation.z = -Math.sign(x) * 0.4;
      g.add(horn);
    }
    const arch = new THREE.Mesh(new THREE.TorusGeometry(5.6, 0.6, 6, 20, Math.PI), stone);
    arch.position.y = 6;
    g.add(arch);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.35, 6, 32), this.glowMat);
    ring.position.y = 5.2;
    g.add(ring);
    // The swirling inside (only when open and leading somewhere)
    this.swirl = new THREE.Group();
    this.swirl.position.y = 5.2;
    for (let n = 0; n < 3; n++) {
      const disc = new THREE.Mesh(new THREE.RingGeometry(0.6 + n * 1.3, 1.4 + n * 1.3, 7, 1, 0, Math.PI * 1.4), this.swirlMat);
      disc.rotation.z = n * 2;
      this.swirl.add(disc);
    }
    g.add(this.swirl);
    this.label = leadsTo ? leadsTo.name : null;
    this.root = g;
    g.visible = false;
    scene.add(g);
  }

  setOpen(open) {
    this.open = open;
    this.root.visible = open;
    this.swirl.visible = open && !!this.leadsTo;
  }

  // Returns true when the car drives through it (only if it leads somewhere).
  update(dt, car, sparks) {
    if (!this.open) return false;
    this.t += dt;
    this.swirl.children.forEach((d, n) => { d.rotation.z += dt * (1.5 + n * 0.8) * (n % 2 ? -1 : 1); });
    this.swirlMat.opacity = 0.7 + Math.sin(this.t * 4) * 0.15;
    if (sparks && this.leadsTo && Math.random() < 0.5) {
      const a = Math.random() * Math.PI * 2;
      const p = new THREE.Vector3(Math.cos(a) * 4.6, 5.2 + Math.sin(a) * 4.6, 0).applyQuaternion(this.root.quaternion).add(this.pos);
      sparks.spawn(p, new THREE.Vector3((Math.random() - 0.5) * 2, 1 + Math.random() * 2, (Math.random() - 0.5) * 2), 0.15, 0.8);
    }
    const d = Math.hypot(car.currPos.x - this.pos.x, car.currPos.z - this.pos.z);
    this.near = d < 4.5 && !car.wrecked;
    return this.near;
  }

  distanceTo(p) { return Math.hypot(p.x - this.pos.x, p.z - this.pos.z); }
}
