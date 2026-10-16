// REGION 2 — THE LAVA RIVERS
// Black basalt plains cut by rivers of lava. Lava burns your car from below
// and bogs it down, so a stock car won't last long here. Protection comes
// from a tougher chassis (Armored Car and up) and Hover Fan parts.
// The boss sits on an island in a lake of lava.

export default {
  id: 'lava_rivers',
  name: 'The Lava Rivers',
  tagline: 'The floor is lava. Literally.',

  palette: {
    sky: 0x1a0806,
    fog: 0x3a1208,
    groundA: 0x2a2624, // basalt
    groundB: 0x1e1b1a, // darker basalt
    groundC: 0x3a2a22, // scorched brown
    rock: 0x262222,
    bone: 0xc8b8a0,
    deadTree: 0x1a1412,
    lava: 0xff6a10,
    obsidian: 0x15121c,
    sun: 0xff7a30,
    ambientSky: 0xff7a50,
    ambientGround: 0x401008,
  },

  terrain: { size: 3000, flatness: 1.0, patchSize: 14 },

  props: [
    { type: 'rock',         count: 650,  minScale: 0.8, maxScale: 3.0, solid: true },
    { type: 'basaltColumn', count: 380,  minScale: 0.8, maxScale: 2.2, solid: true },
    { type: 'obsidian',     count: 420,  minScale: 0.7, maxScale: 2.0, solid: true },
    { type: 'deadTree',     count: 120,  minScale: 0.8, maxScale: 1.4, solid: true },
    { type: 'pebble',       count: 6000, minScale: 0.15, maxScale: 0.45, solid: false },
  ],
  clearRadiusAtStart: 40,

  // Rivers of lava: a line of points (x, z), how wide (m), and where the
  // cooled-crust bridges are (0 = river start, 1 = river end). Bridges are
  // safe to drive over. Everything else burns.
  hazards: {
    lavaRivers: [
      { points: [[-1450, -300], [-600, -150], [-150, 140], [300, 120], [800, 400], [1450, 350]], width: 18, bridges: [0.2, 0.42, 0.62, 0.85] },
      { points: [[200, 1450], [-100, 1000], [-610, 880]], width: 24, bridges: [0.35] },
      { points: [[-1450, 700], [-790, 880]], width: 20, bridges: [0.45] },
      { points: [[600, -1450], [450, -700], [900, -200], [1450, -100]], width: 26, bridges: [0.2, 0.5, 0.8] },
      { points: [[-500, -1450], [-300, -800], [-900, -500], [-1450, -600]], width: 15, bridges: [0.3, 0.7] },
    ],
  },

  demons: [
    { type: 'fireImp',    weight: 10 },
    { type: 'hound',      weight: 4, minDistance: 120 },
    { type: 'spitter',    weight: 3, minDistance: 200 },
    { type: 'spiker',     weight: 2, minDistance: 260 },
    { type: 'magmaBrute', weight: 2, minDistance: 350 },
  ],

  gatingRule: {
    requires: 'heat',
    description: 'Lava burns your car from below. Upgrade to an Armored Car (or better) and bolt on Hover Fans. Cross rivers on the dark crust bridges.',
  },

  // The boss lives on an island ringed by a lava moat (no bridges!).
  boss: {
    type: 'magmaColossus',
    name: 'The Magma Colossus',
    arena: { x: -700, z: 900, radius: 55, style: 'island', moat: 50 },
    look: { skin: 0x221e1e, dark: 0x120f0f, glow: 0xff7a10, horn: 0x2a1418, eye: 0xfff070, vents: true },
    summons: [['fireImp', 8], ['fireImp', 8], ['magmaBrute', 1]],
    throwKind: 'lavaBomb',
  },
};
