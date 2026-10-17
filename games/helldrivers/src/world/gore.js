// Cartoon gore: chunks that fly and bounce, goo splats left on the ground,
// and a red mist puff. Fixed-size pools so it never slows the game down.
import * as THREE from 'three';
import { litMaterial } from '../core/graphics.js';
import { Dust } from './effects.js';

const GRAVITY = 22;

export class Gore {
  constructor(scene, maxChunks = 320, maxSplats = 90) {
    // ---- Flying chunks ----
    this.chunks = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 0),
      litMaterial({ flatShading: true, roughness: 0.5 }),
      maxChunks
    );
    this.chunks.frustumCulled = false;
    this.chunks.castShadow = true;
    this.chunkData = Array.from({ length: maxChunks }, () => ({
      life: 0, maxLife: 1, size: 0.1,
      pos: new THREE.Vector3(), vel: new THREE.Vector3(), rot: new THREE.Euler(), spin: new THREE.Vector3(),
    }));
    this.nextChunk = 0;
    const white = new THREE.Color(1, 1, 1);
    for (let i = 0; i < maxChunks; i++) this.chunks.setColorAt(i, white);
    scene.add(this.chunks);

    // ---- Goo splats on the ground ----
    const splatGeo = new THREE.CircleGeometry(1, 9);
    splatGeo.rotateX(-Math.PI / 2);
    this.splats = new THREE.InstancedMesh(
      splatGeo,
      litMaterial({ color: 0x8a0c08, roughness: 0.3, polygonOffset: true, polygonOffsetFactor: -2 }),
      maxSplats
    );
    this.splats.frustumCulled = false;
    this.splats.receiveShadow = true;
    this.splatData = Array.from({ length: maxSplats }, () => ({ life: 0, pos: new THREE.Vector3(), sx: 1, sz: 1, ry: 0 }));
    this.nextSplat = 0;
    scene.add(this.splats);

    // ---- Red mist ----
    this.mist = new Dust(scene, 160, 0xb01810, 0.6);

    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color();
    this.hideAll();
  }

  // Wipe all chunks and splats (fresh start).
  clear() {
    for (const c of this.chunkData) c.life = 0;
    for (const s of this.splatData) s.life = 0;
    this.hideAll();
    this.chunks.instanceMatrix.needsUpdate = true;
    this.splats.instanceMatrix.needsUpdate = true;
  }

  hideAll() {
    this.dummy.scale.setScalar(0);
    this.dummy.updateMatrix();
    for (let i = 0; i < this.chunkData.length; i++) this.chunks.setMatrixAt(i, this.dummy.matrix);
    for (let i = 0; i < this.splatData.length; i++) this.splats.setMatrixAt(i, this.dummy.matrix);
  }

  // A demon goes splat at `pos`, pushed along by `push` (e.g. the car's velocity).
  explode(pos, push, colors, amount = 1) {
    const n = Math.round(14 * amount);
    for (let i = 0; i < n; i++) {
      const c = this.chunkData[this.nextChunk];
      const idx = this.nextChunk;
      this.nextChunk = (this.nextChunk + 1) % this.chunkData.length;
      c.pos.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.4 + Math.random() * 0.8, (Math.random() - 0.5) * 0.6));
      c.vel.set((Math.random() - 0.5) * 9, 4 + Math.random() * 9, (Math.random() - 0.5) * 9).addScaledVector(push, 0.55);
      c.spin.set(Math.random() * 12, Math.random() * 12, Math.random() * 12);
      c.size = 0.08 + Math.random() * 0.17;
      c.life = c.maxLife = 3 + Math.random() * 3;
      this.chunks.setColorAt(idx, this.color.set(colors[Math.floor(Math.random() * colors.length)]));
    }
    this.chunks.instanceColor.needsUpdate = true;

    // Goo on the ground, smeared in the direction of the hit.
    const pushFlat = new THREE.Vector3(push.x, 0, push.z);
    for (let i = 0; i < 2; i++) {
      this.addSplat(pos.clone().addScaledVector(pushFlat, 0.05 + i * 0.06), 0.8 + Math.random() * 1.2, Math.atan2(pushFlat.x, pushFlat.z));
    }
    for (let i = 0; i < 8; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 6, 1 + Math.random() * 3, (Math.random() - 0.5) * 6).addScaledVector(push, 0.3);
      this.mist.spawn(pos.clone().setY(0.9), v, 0.35 + Math.random() * 0.3, 0.5 + Math.random() * 0.4);
    }
  }

  // A smaller spray when a demon gets shot.
  spray(pos, dir) {
    for (let i = 0; i < 2; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3).addScaledVector(dir, 3);
      this.mist.spawn(pos, v, 0.18 + Math.random() * 0.12, 0.35);
    }
  }

  addSplat(pos, size, angle) {
    const s = this.splatData[this.nextSplat];
    this.nextSplat = (this.nextSplat + 1) % this.splatData.length;
    s.pos.set(pos.x, 0.08, pos.z);
    s.sx = size * (0.7 + Math.random() * 0.4);
    s.sz = size * (1.2 + Math.random() * 0.8);
    s.ry = angle + (Math.random() - 0.5) * 0.6;
    s.life = 20;
  }

  update(dt) {
    const d = this.dummy;
    for (let i = 0; i < this.chunkData.length; i++) {
      const c = this.chunkData[i];
      if (c.life <= 0) continue;
      c.life -= dt;
      c.vel.y -= GRAVITY * dt;
      c.pos.addScaledVector(c.vel, dt);
      if (c.pos.y < c.size * 0.5) {
        // Bounce + skid on the ground, then come to rest.
        c.pos.y = c.size * 0.5;
        if (c.vel.y < -3 && Math.random() < 0.25) this.addSplat(c.pos, 0.25 + Math.random() * 0.3, Math.random() * 6);
        c.vel.y = Math.abs(c.vel.y) * 0.3;
        c.vel.x *= 0.6; c.vel.z *= 0.6;
        c.spin.multiplyScalar(0.6);
      }
      c.rot.x += c.spin.x * dt; c.rot.y += c.spin.y * dt; c.rot.z += c.spin.z * dt;
      const shrink = Math.min(1, c.life / 0.8);
      d.position.copy(c.pos);
      d.rotation.copy(c.rot);
      d.scale.setScalar(c.life > 0 ? c.size * shrink : 0);
      d.updateMatrix();
      this.chunks.setMatrixAt(i, d.matrix);
    }
    this.chunks.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < this.splatData.length; i++) {
      const s = this.splatData[i];
      if (s.life <= 0) continue;
      s.life -= dt;
      const k = s.life > 0 ? Math.min(1, s.life / 3) : 0;
      d.position.copy(s.pos);
      d.position.y += i * 0.0004; // avoid flicker where splats overlap
      d.rotation.set(0, s.ry, 0);
      d.scale.set(s.sx * k, 1, s.sz * k);
      d.updateMatrix();
      this.splats.setMatrixAt(i, d.matrix);
    }
    this.splats.instanceMatrix.needsUpdate = true;
    this.mist.update(dt);
  }
}
