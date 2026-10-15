// HELLDRIVE — game start-up and main loop.
import * as THREE from 'three';
import { SETTINGS } from './settings.js';
import { STARTING_REGION } from './regions/index.js';
import { createPhysics, PHYSICS_STEP } from './core/physics.js';
import { Input } from './core/input.js';
import { Audio } from './core/audio.js';
import { createScene } from './world/scene.js';
import { createGround } from './world/ground.js';
import { Dust, Tracers, Embers, AimMarker } from './world/effects.js';
import { Car } from './vehicle/car.js';
import { ChaseCamera } from './camera/chaseCamera.js';
import { Hud, showStartScreen } from './ui/hud.js';
import { createTuningPanel } from './ui/tuning.js';

async function main() {
  const region = STARTING_REGION;
  const physics = await createPhysics();
  const { renderer, scene, camera, followPlayer } = createScene(region);
  createGround(scene, physics, region);

  const car = new Car(scene, physics, new THREE.Vector3(0, 1, 0));
  const chase = new ChaseCamera(camera);
  const input = new Input(renderer.domElement);
  const audio = new Audio();
  const hud = new Hud();
  const tuning = createTuningPanel();
  const dust = new Dust(scene);
  const tracers = new Tracers(scene, dust);
  const embers = new Embers(scene);
  const aim = new AimMarker(scene);

  // Draw one frame behind the start screen so it isn't empty.
  car.capture(); car.capture();
  car.render(1, 0, null);
  chase.update(car, 1 / 60, 0);
  renderer.render(scene, camera);

  await showStartScreen(region.name);
  audio.start();

  const timer = new THREE.Timer();
  let accumulator = 0;
  let fireCooldown = 0;
  let dustTimer = 0;
  let elapsed = 0;
  const tmp = new THREE.Vector3();

  function frame() {
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.1);
    elapsed += dt;

    // --- One-shot keys ---
    if (input.wasPressed('KeyT')) tuning.toggle();
    if (input.wasPressed('KeyH')) hud.toggleHelp();
    if (input.wasPressed('KeyM')) audio.toggleMute();
    if (input.wasPressed('KeyR')) car.reset(false);
    if (input.wasPressed('Backspace')) car.reset(true);

    // --- Physics at a fixed rate ---
    accumulator += dt;
    while (accumulator >= PHYSICS_STEP) {
      car.fixedUpdate(input, PHYSICS_STEP);
      physics.world.step();
      car.capture();
      accumulator -= PHYSICS_STEP;
    }
    const alpha = accumulator / PHYSICS_STEP;

    // --- Aim + car visuals + camera ---
    const aimPoint = aim.update(camera, input.mouse.ndcX, input.mouse.ndcY, elapsed);
    car.render(alpha, dt, aimPoint);
    chase.update(car, dt, input.wheel);

    // --- Shooting (visual only this milestone) ---
    fireCooldown -= dt;
    if (input.mouse.down && fireCooldown <= 0) {
      fireCooldown = 1 / SETTINGS.turret.fireRate;
      car.model.root.updateMatrixWorld(true);
      car.fireVisual();
      tracers.fire(car.muzzleWorld, aimPoint);
      audio.gunshot();
    }

    // --- Dust from the rear tires when drifting, braking or flooring it ---
    const hardLaunch = car.throttle > 0 && car.forwardSpeed < 12 && car.forwardSpeed > 0.5;
    const hardBrake = car.throttle < 0 && car.forwardSpeed > 8;
    dustTimer -= dt;
    if (dustTimer <= 0 && car.grounded && (car.drifting || hardLaunch || hardBrake || (car.handbrake && car.speed > 4))) {
      dustTimer = 1 / 45; // puffs per second, per tire
      for (const w of car.model.wheels) {
        if (w.front) continue;
        w.steer.getWorldPosition(tmp);
        tmp.y = 0.2;
        const vel = new THREE.Vector3((Math.random() - 0.5) * 2, 0.5 + Math.random(), (Math.random() - 0.5) * 2);
        dust.spawn(tmp, vel, 0.3 + Math.random() * 0.3, 0.6 + Math.random() * 0.5);
      }
    }

    dust.update(dt);
    tracers.update(dt);
    embers.update(dt, car.position);
    followPlayer(car.position);

    const driftAmount = car.grounded ? THREE.MathUtils.clamp((Math.abs(car.sidewaysSpeed) - 2) / 10, 0, 1) : 0;
    audio.update(Math.min(Math.abs(car.forwardSpeed) / SETTINGS.car.topSpeed, 1), car.throttle, driftAmount);
    hud.update(car, SETTINGS.car.topSpeed, dt, input.mouse);

    renderer.render(scene, camera);
    input.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Handy for debugging in the browser console.
  window.HELLDRIVE = { car, SETTINGS, physics, scene };
}

main().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML('beforeend', `<pre style="color:#f88;position:fixed;top:0;left:0;z-index:99">Failed to start: ${err.message}</pre>`);
});
