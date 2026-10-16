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

  // Which demons live here.
  //   weight:      how common (bigger = more often)
  //   minDistance: they only show up this far (m) from the start, so the
  //                further out you roam, the nastier it gets.
  demons: [
    { type: 'imp',     weight: 10 },
    { type: 'hound',   weight: 4, minDistance: 150 },
    { type: 'spiker',  weight: 3, minDistance: 220 },
    { type: 'spitter', weight: 3, minDistance: 280 },
    { type: 'brute',   weight: 2, minDistance: 400 },
  ],

  // What kind of vehicle you need to cross or survive this region.
  gatingRule: { requires: 'none', description: 'The starter region: any car will do.' },

  // The boss, sleeping in a ring of bones out in the plains.
  boss: {
    type: 'ashTitan',
    name: 'The Ash Titan',
    arena: { x: 650, z: 820, radius: 70, style: 'bones' },
    look: { skin: 0x5a5450, dark: 0x2e2a28, glow: 0xff5a10, horn: 0xe0d6bc, eye: 0xffe040, vents: false },
    summons: [['imp', 8], ['imp', 8], ['hound', 4]],
    throwKind: 'boulder',
  },
};
