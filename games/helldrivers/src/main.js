// HELLDRIVE — game start-up and main loop.
import * as THREE from 'three';
import { SETTINGS } from './settings.js';
import { STARTING_REGION } from './regions/index.js';
import { createPhysics, PHYSICS_STEP } from './core/physics.js';
import { Input } from './core/input.js';
import { Audio } from './core/audio.js';
import { createScene } from './world/scene.js';
import { createGround } from './world/ground.js';
import { Dust, Embers, AimMarker } from './world/effects.js';
import { Gore } from './world/gore.js';
import { Scrap } from './world/scrap.js';
import { Demons } from './demons/demons.js';
import { Bullets } from './combat/bullets.js';
import { Stats } from './combat/stats.js';
import { Car } from './vehicle/car.js';
import { ChaseCamera } from './camera/chaseCamera.js';
import { Hud, showStartScreen } from './ui/hud.js';
import { createTuningPanel } from './ui/tuning.js';
import { Garage } from './ui/garage.js';

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
  const embers = new Embers(scene);
  const aim = new AimMarker(scene);
  const smoke = new Dust(scene, 120, 0x1a1414, 0.7);
  const gore = new Gore(scene);
  const stats = new Stats();
  const demons = new Demons(scene, region, { gore, audio, stats, hud, chase });
  const bullets = new Bullets(scene, { demons, dust, gore, audio });
  demons.populate(car.currPos);
  const garage = new Garage({ camera, renderer, car, audio });
  const scrap = new Scrap(scene);
  const sparks = new Dust(scene, 120, 0xffd040, 0.95);

  // Pieces breaking off the car become scrap lying in the world.
  car.onDetach = (pieces) => {
    for (const p of pieces) {
      scrap.spawn(p.objects, p.item, p.push);
      hud.toast(`LOST: ${p.item.label}`, 'bad');
      for (let i = 0; i < 10; i++) sparks.spawn(p.objects[0].getWorldPosition(new THREE.Vector3()), new THREE.Vector3((Math.random() - 0.5) * 8, 2 + Math.random() * 5, (Math.random() - 0.5) * 8), 0.08, 0.4);
    }
    audio.thump();
    chase.addShake(0.4);
  };

  // Draw one frame behind the start screen so it isn't empty.
  car.capture(); car.capture();
  car.render(1, 0, null);
  demons.render(1, 0);
  chase.update(car, 1 / 60, 0);
  renderer.render(scene, camera);

  await showStartScreen(region.name);
  audio.start();

  const timer = new THREE.Timer();
  let accumulator = 0;
  let fireCooldown = 0;
  let dustTimer = 0;
  let elapsed = 0;
  let wreckTimer = 0;
  let damageFxTimer = 0;
  let smokeTimer = 0;
  const tmp = new THREE.Vector3();
  const tmpAim = new THREE.Vector3();

  function frame() {
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.1);
    elapsed += dt;

    // --- One-shot keys ---
    if (input.wasPressed('KeyT')) tuning.toggle();
    if (input.wasPressed('KeyH')) hud.toggleHelp();
    if (input.wasPressed('KeyM')) audio.toggleMute();
    if (input.wasPressed('KeyG') || (garage.open && input.wasPressed('Escape'))) {
      const near = demons.nearestDistance(car.currPos);
      if (garage.open) garage.close();
      else if (car.wrecked) { /* wait for respawn */ }
      else if (near < SETTINGS.damage.garageSafeRadius) hud.toast(`Demons too close! Get ${Math.ceil(SETTINGS.damage.garageSafeRadius - near)} m further away to open the garage.`, 'warn');
      else garage.openGarage();
      input.mouse.down = false;
    }
    if (garage.open) {
      // Paused: only the garage camera moves.
      aim.mesh.visible = false;
      garage.update(dt);
      renderer.render(scene, camera);
      input.endFrame();
      requestAnimationFrame(frame);
      return;
    }
    if (input.wasPressed('KeyR')) car.reset(false);
    if (input.wasPressed('Backspace')) { car.reset(true); demons.clearAround(car.currPos, 60); }

    // --- Physics at a fixed rate ---
    accumulator += dt;
    while (accumulator >= PHYSICS_STEP) {
      car.fixedUpdate(input, PHYSICS_STEP);
      physics.world.step();
      car.capture();
      car.afterStep(); // crash damage from hitting rocks
      demons.fixedUpdate(PHYSICS_STEP, car);
      accumulator -= PHYSICS_STEP;
    }
    const alpha = accumulator / PHYSICS_STEP;

    // --- Wrecked? Boom, smoke, then respawn ---
    if (car.wrecked) {
      if (wreckTimer === 0) {
        audio.wreck();
        chase.addShake(1);
        gore.explode(car.currPos, new THREE.Vector3(), [0x3a66d0, 0x1a1a1c, 0x5a5d63, 0xc8202a], 1.5);
      }
      wreckTimer += dt;
      if ((smokeTimer -= dt) <= 0) {
        smokeTimer = 0.05;
        smoke.spawn(tmp.copy(car.position).setY(1.2), new THREE.Vector3((Math.random() - 0.5) * 1.5, 3 + Math.random() * 2, (Math.random() - 0.5) * 1.5), 0.6 + Math.random() * 0.5, 1.6);
      }
      if (wreckTimer > SETTINGS.damage.respawnDelay) {
        wreckTimer = 0;
        car.respawn();
        scrap.clear(); // your build comes back whole, so its old scrap vanishes
        demons.clearAround(car.currPos, 60);
      }
    }

    // --- Aim + car visuals + camera ---
    let aimPoint = aim.update(camera, input.mouse.ndcX, input.mouse.ndcY, elapsed);
    // If the mouse is over a demon, aim at its body, not the ground behind it.
    // Otherwise aim at chest height above the ground spot, so shots skim
    // along at demon height instead of plunging into the dirt.
    const aimed = demons.raycast(aim.raycaster.ray);
    if (aimed) aimPoint = aimed.point;
    else if (aim.mesh.visible) aimPoint = tmpAim.copy(aimPoint).setY(0.8);
    car.render(alpha, dt, aimPoint);
    demons.render(alpha, dt);
    chase.update(car, dt, input.wheel);

    // --- Shooting ---
    fireCooldown -= dt;
    if (input.mouse.down && fireCooldown <= 0 && !car.wrecked) {
      fireCooldown = 1 / SETTINGS.turret.fireRate;
      car.model.root.updateMatrixWorld(true);
      for (const t of car.turrets) {
        car.fireVisual(t);
        bullets.fire(car.muzzleWorld(t), aimPoint);
      }
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

    // --- Crashes, smoke and sparks from damaged pieces ---
    if (car.crashed) {
      chase.addShake(Math.min(1, car.crashed / 20));
      audio.thump();
      car.crashed = 0;
    }
    if ((damageFxTimer -= dt) <= 0) {
      damageFxTimer = 0.09;
      for (const p of car.smokingPoints(SETTINGS.damage.smokeBelow)) {
        if (Math.random() < 0.6) smoke.spawn(p.pos, new THREE.Vector3((Math.random() - 0.5), 2 + Math.random() * 1.5, (Math.random() - 0.5)), 0.25 + (1 - p.frac) * 0.3, 1.2);
        if (p.frac < 0.25 && Math.random() < 0.5) sparks.spawn(p.pos, new THREE.Vector3((Math.random() - 0.5) * 6, 2 + Math.random() * 4, (Math.random() - 0.5) * 6), 0.06, 0.35);
      }
    }

    // --- Scrap: press E to grab what's in reach ---
    const reach = scrap.inReach(car.position, SETTINGS.damage.pickupRadius);
    if (reach.length && !car.wrecked) {
      const names = reach.map((s) => s.item.label);
      hud.setPrompt(`[E] Grab scrap: ${names.slice(0, 2).join(', ')}${names.length > 2 ? ` +${names.length - 2} more` : ''}`);
      if (input.wasPressed('KeyE')) {
        for (const item of scrap.collect(reach, car.position)) {
          car.build.give(item.type, item.count);
          hud.toast(`+${item.count} ${item.count > 1 ? 'Body Panels' : item.label}`);
        }
        car.build.save();
        audio.hit();
      }
    } else hud.setPrompt('');

    dust.update(dt);
    smoke.update(dt);
    sparks.update(dt);
    scrap.update(dt);
    bullets.update(dt);
    gore.update(dt);
    stats.tick(dt);
    embers.update(dt, car.position);
    followPlayer(car.position);

    const driftAmount = car.grounded ? THREE.MathUtils.clamp((Math.abs(car.sidewaysSpeed) - 2) / 10, 0, 1) : 0;
    audio.update(Math.min(Math.abs(car.forwardSpeed) / SETTINGS.car.topSpeed, 1), car.throttle, driftAmount);
    hud.update(car, SETTINGS.car.topSpeed, dt, input.mouse);
    hud.combat(car, stats);

    renderer.render(scene, camera);
    input.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Handy for debugging in the browser console.
  window.HELLDRIVE = { car, SETTINGS, physics, scene, camera, demons, stats, garage, scrap };
}

main().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML('beforeend', `<pre style="color:#f88;position:fixed;top:0;left:0;z-index:99">Failed to start: ${err.message}</pre>`);
});
