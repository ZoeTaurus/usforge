// Cheap visual effects. Everything uses fixed-size pools (no new objects
// created during play) so it stays fast.
import * as THREE from 'three';

// ---------------- Dust puffs kicked up by the tires ----------------
export class Dust {
  constructor(scene, max = 220) {
    this.max = max;
    this.mesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshBasicMaterial({ color: 0xb8aaa0, transparent: true, opacity: 0.45, depthWrite: false }),
      max
    );
    this.mesh.frustumCulled = false;
    this.parts = Array.from({ length: max }, () => ({ life: 0, maxLife: 1, pos: new THREE.Vector3(), vel: new THREE.Vector3(), size: 1 }));
    this.next = 0;
    this.dummy = new THREE.Object3D();
    this.mesh.count = max;
    for (let i = 0; i < max; i++) this.#write(i, 0);
    scene.add(this.mesh);
  }

  spawn(pos, vel, size = 0.5, life = 0.9) {
    const p = this.parts[this.next];
    this.next = (this.next + 1) % this.max;
    p.pos.copy(pos);
    p.vel.copy(vel);
    p.size = size;
    p.life = p.maxLife = life;
  }

  update(dt) {
    for (let i = 0; i < this.max; i++) {
      const p = this.parts[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      p.pos.addScaledVector(p.vel, dt);
      p.vel.multiplyScalar(1 - dt * 2.5);
      p.vel.y += dt * 1.5;
      const t = 1 - p.life / p.maxLife;
      this.#write(i, p.life > 0 ? p.size * (0.4 + t * 1.2) * (1 - t * t) : 0);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  #write(i, scale) {
    const p = this.parts[i];
    this.dummy.position.copy(p.pos);
    this.dummy.scale.setScalar(Math.max(scale, 0.0001));
    this.dummy.rotation.set(i, i * 2, 0);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(i, this.dummy.matrix);
  }
}

// ---------------- Tracer rounds (visual only for now) ----------------
export class Tracers {
  constructor(scene, dust, max = 40) {
    this.dust = dust;
    const geo = new THREE.BoxGeometry(0.08, 0.08, 2.2);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffe080 });
    this.pool = Array.from({ length: max }, () => {
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      scene.add(m);
      return { mesh: m, dir: new THREE.Vector3(), remaining: 0 };
    });
    this.next = 0;
    this.speed = 220;
  }

  fire(from, to) {
    const t = this.pool[this.next];
    this.next = (this.next + 1) % this.pool.length;
    t.mesh.position.copy(from);
    t.dir.subVectors(to, from);
    t.remaining = t.dir.length();
    t.dir.normalize();
    t.mesh.lookAt(to);
    t.mesh.visible = true;
  }

  update(dt) {
    for (const t of this.pool) {
      if (!t.mesh.visible) continue;
      const step = this.speed * dt;
      if (step >= t.remaining) {
        t.mesh.position.addScaledVector(t.dir, t.remaining);
        t.mesh.visible = false;
        // Little puff of ash where it lands.
        for (let i = 0; i < 3; i++) {
          this.dust.spawn(t.mesh.position, new THREE.Vector3((Math.random() - 0.5) * 4, 2 + Math.random() * 3, (Math.random() - 0.5) * 4), 0.35, 0.6);
        }
      } else {
        t.mesh.position.addScaledVector(t.dir, step);
        t.remaining -= step;
      }
    }
  }
}

// ---------------- Glowing embers floating around the player ----------------
export class Embers {
  constructor(scene, count = 500, radius = 70) {
    this.radius = radius;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * radius * 2;
      pos[i * 3 + 1] = Math.random() * 25;
      pos[i * 3 + 2] = (Math.random() - 0.5) * radius * 2;
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.points = new THREE.Points(this.geo, new THREE.PointsMaterial({ color: 0xff7a30, size: 0.25, fog: true }));
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  update(dt, center) {
    const p = this.geo.attributes.position;
    const R = this.radius;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i) + dt * (1 + (i % 5) * 0.4), z = p.getZ(i);
      x += Math.sin(y * 0.5 + i) * dt * 0.6;
      // Wrap around the player so embers are always nearby.
      if (x - center.x > R) x -= 2 * R; else if (x - center.x < -R) x += 2 * R;
      if (z - center.z > R) z -= 2 * R; else if (z - center.z < -R) z += 2 * R;
      if (y > 25) y = 0;
      p.setXYZ(i, x, y, z);
    }
    p.needsUpdate = true;
  }
}

// ---------------- Aim marker on the ground under the mouse ----------------
export class AimMarker {
  constructor(scene) {
    const ring = new THREE.RingGeometry(0.6, 0.85, 16);
    ring.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(ring, new THREE.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: 0.8, depthWrite: false }));
    const dot = new THREE.CircleGeometry(0.15, 8);
    dot.rotateX(-Math.PI / 2);
    this.mesh.add(new THREE.Mesh(dot, this.mesh.material));
    scene.add(this.mesh);
    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.point = new THREE.Vector3();
  }

  // Finds where the mouse points on the ground. Returns the aim point.
  update(camera, ndcX, ndcY, t) {
    this.raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);
    const hit = this.raycaster.ray.intersectPlane(this.plane, this.point);
    if (!hit || hit.distanceTo(camera.position) > 300) {
      // Aiming at the sky: pick a point far along the mouse ray.
      this.raycaster.ray.at(300, this.point);
      this.mesh.visible = false;
    } else {
      this.mesh.visible = true;
      this.mesh.position.copy(this.point).setY(0.08);
      this.mesh.rotation.y = t * 2;
    }
    return this.point;
  }
}
