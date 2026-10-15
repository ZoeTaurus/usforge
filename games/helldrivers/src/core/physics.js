// Sets up the Rapier physics world.
import RAPIER from '@dimforge/rapier3d-compat';
import { SETTINGS } from '../settings.js';

export const PHYSICS_STEP = 1 / 60; // physics runs at a fixed 60 steps/second

export async function createPhysics() {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: -SETTINGS.car.gravity, z: 0 });
  world.timestep = PHYSICS_STEP;
  return { RAPIER, world };
}
