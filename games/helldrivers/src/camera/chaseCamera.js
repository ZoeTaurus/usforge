// Third-person camera that sits behind the car and swings around lazily.
import * as THREE from 'three';
import { SETTINGS } from '../settings.js';

export class ChaseCamera {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0;         // which way the camera is facing (smoothed)
    this.zoom = 1;
    this.lookAt = new THREE.Vector3();
    this.initialized = false;
    this.kick = 0;
  }

  addShake(amount) { this.kick = Math.min(1.2, this.kick + amount); }

  update(car, dt, wheel) {
    const C = SETTINGS.camera;
    if (wheel) this.zoom = THREE.MathUtils.clamp(this.zoom * (1 + wheel * 0.1), C.minZoom, C.maxZoom);

    const heading = car.heading;
    const carYaw = Math.atan2(heading.x, heading.z);
    if (!this.initialized) { this.yaw = carYaw; this.initialized = true; }

    // Swing toward the car's facing direction.
    const k = 1 - Math.exp(-C.followSpeed * dt);
    this.yaw += Math.atan2(Math.sin(carYaw - this.yaw), Math.cos(carYaw - this.yaw)) * k;

    const speedRatio = THREE.MathUtils.clamp(Math.abs(car.forwardSpeed) / SETTINGS.car.topSpeed, 0, 1);
    const dist = (C.distance + C.speedPullback * speedRatio) * this.zoom;
    const height = C.height * this.zoom;
    const dir = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));

    const target = car.position;
    this.camera.position.copy(target).addScaledVector(dir, -dist);
    this.camera.position.y = target.y + height;

    // Look a little ahead of the car so you can see where you're going.
    this.lookAt.copy(target).addScaledVector(dir, 5).setY(target.y + 1.2);

    // Shake: a little at high speed, plus a jolt on hits (decays quickly).
    this.kick = Math.max(0, this.kick - dt * 2.5);
    const shake = (speedRatio > 0.7 ? (speedRatio - 0.7) * 0.12 : 0) + this.kick * this.kick;
    if (shake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * shake;
      this.camera.position.y += (Math.random() - 0.5) * shake;
      this.lookAt.x += (Math.random() - 0.5) * shake * 0.5;
      this.lookAt.y += (Math.random() - 0.5) * shake * 0.5;
    }
    this.camera.lookAt(this.lookAt);

    const fov = THREE.MathUtils.lerp(C.fov, C.fovAtTopSpeed, speedRatio);
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 4);
      this.camera.updateProjectionMatrix();
    }
  }
}
