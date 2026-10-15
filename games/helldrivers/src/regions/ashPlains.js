// REGION 1 — ASH PLAINS
// Regions are pure data. The game reads this file to build the world.
// To make a new region, copy this file, change the values, and list it in
// regions/index.js. No game code needs to change.

export default {
  id: 'ash_plains',
  name: 'Ash Plains',
  tagline: 'Flat, fast, and full of things to run over.',

  // Colors (hex). Used for sky, fog, ground, props and lighting.
  palette: {
    sky: 0x3a1410,
    fog: 0x5a2a1c,
    groundA: 0x5b5450, // ash grey
    groundB: 0x4a4340, // darker ash
    groundC: 0x615248, // brownish patches
    rock: 0x3b3533,
    bone: 0xd8cfb8,
    deadTree: 0x2a211d,
    lava: 0xff5a1a,
    sun: 0xffa060,
    ambientSky: 0xff9a70,
    ambientGround: 0x302020,
  },

  // Terrain shape. Ash Plains is flat; later regions add hills/steepness.
  terrain: {
    size: 3000,         // width of the region in meters
    flatness: 1.0,      // 1 = perfectly flat (hills come in later milestones)
    patchSize: 14,      // size of the color patches on the ground (m)
  },

  // Scenery scattered around. "count" = how many. "solid" = you crash into it.
  props: [
    { type: 'rock',      count: 900, minScale: 0.8, maxScale: 3.2, solid: true },
    { type: 'boneSpike', count: 500, minScale: 1.0, maxScale: 2.6, solid: true },
    { type: 'deadTree',  count: 450, minScale: 0.8, maxScale: 1.6, solid: true },
    { type: 'lavaPool',  count: 220,  minScale: 2.0, maxScale: 7.0, solid: false },
    { type: 'pebble',    count: 7000, minScale: 0.15, maxScale: 0.45, solid: false },
  ],
  // Keep this area around the start empty so you can warm up (m).
  clearRadiusAtStart: 40,

  // --- Filled in during later milestones ---
  demons: [],          // e.g. [{ type: 'imp', weight: 10 }, ...]
  gatingRule: null,    // e.g. { requires: 'none' }  (starter region)
  boss: null,          // e.g. { type: 'ashTitan' }
};
