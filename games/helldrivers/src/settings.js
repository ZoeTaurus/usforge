// =====================================================================
//  HELLDRIVERS — FEEL SETTINGS
// =====================================================================
//  Every number that changes how the game *feels* lives here.
//  Change a number, save the file, and the game reloads by itself.
//
//  Tip: press  T  in the game to open the live Tuning panel. You can drag
//  sliders while driving. Those changes are NOT saved, so when you find
//  values you like, copy them back into this file (or tell Claude).
//
//  Units: distances are in meters, speeds in meters per second
//  (1 m/s = 3.6 km/h), weights in kilograms.
// =====================================================================

export const SETTINGS = {
  // ---------------------------------------------------------------
  //  DEV / CREATIVE MODE (press C in the game to switch these)
  // ---------------------------------------------------------------
  dev: {
    noEnemies: false, // no demons, no boss
    noDamage: false,  // your car can't be hurt
    creative: false,  // free building: unlimited parts, all unlocked, free upgrades
  },

  // ---------------------------------------------------------------
  //  CAR: power, speed and weight
  // ---------------------------------------------------------------
  car: {
    // How heavy the bare car is (kg), before any parts you bolt on.
    // Heavier = slower to speed up, slower to turn, harder to stop, and
    // hits harder when ramming.
    mass: 1200,

    // Engine push. Bigger = faster acceleration.
    // Acceleration is roughly enginePower / mass, so a heavier car with the
    // same engine feels slower. That's the weight tradeoff.
    enginePower: 15000,

    // Top speed going forward (m/s). 40 m/s = 144 km/h.
    topSpeed: 40,

    // Top speed in reverse (m/s).
    reverseSpeed: 13,

    // How hard the brakes bite (S while moving forward).
    brakePower: 26000,

    // How quickly the car slows down when you let go of the gas.
    // 0 = coasts forever, bigger = stops sooner.
    coastSlowdown: 0.5,

    // Extra drag from weight. Makes heavy builds lose a bit of top speed.
    rollingResistance: 0.03,

    // Gravity strength. Real Earth is 9.8. Games often use more so the car
    // feels planted and lands quickly. (This is Hell. Gravity is rude.)
    gravity: 22,
  },

  // ---------------------------------------------------------------
  //  STEERING
  // ---------------------------------------------------------------
  steering: {
    // How fast the car can spin around when steering.
    // Bigger = sharper, twitchier turning.
    turnRate: 2.3,

    // How quickly the steering wheel moves to full lock when you press A/D.
    // Bigger = more instant, smaller = smoother/lazier.
    steerSpeed: 6,

    // At top speed, steering is reduced by this fraction so you don't
    // spin out from a tiny tap. 0 = no reduction, 0.6 = 60% less at top speed.
    highSpeedReduction: 0.55,

    // Speed (m/s) needed before you get full steering. Below this you turn
    // less, like a real car that can't spin in place.
    fullSteerSpeed: 7,

    // How much weight slows down turning. 0 = weight doesn't matter,
    // 1 = double the weight means half the turn speed.
    weightTurnPenalty: 0.6,

    // The "normal" car weight that the penalty above is measured against.
    referenceMass: 1200,
  },

  // ---------------------------------------------------------------
  //  GRIP & DRIFTING
  // ---------------------------------------------------------------
  grip: {
    // How strongly the tires resist sliding sideways (m/s² of sideways
    // force the tires can hold). Bigger = more "on rails".
    // Smaller = slides and drifts more easily in fast turns.
    tireGrip: 30,

    // When holding SPACE (handbrake), grip is multiplied by this.
    // Smaller = big, loose drifts.
    handbrakeGrip: 0.4,

    // Handbrake also slows you down a bit (how much).
    handbrakeDrag: 0.6,

    // While sliding, a bit of the sideways speed is turned back into forward
    // speed so drifts keep momentum. 0 = none, 1 = lots.
    driftCarry: 0.35,

    // Sideways speed (m/s) above which we call it a drift (dust + sound).
    driftThreshold: 4,
  },

  // ---------------------------------------------------------------
  //  BODY WOBBLE (visual only, makes weight feel real)
  // ---------------------------------------------------------------
  body: {
    // How much the body leans in turns (degrees at max).
    roll: 6,
    // How much the nose dips when braking / lifts when accelerating.
    pitch: 3.5,
    // How springy the wobble is. Bigger = stiffer, settles faster.
    stiffness: 9,
  },

  // ---------------------------------------------------------------
  //  CAMERA
  // ---------------------------------------------------------------
  camera: {
    // How far behind the car the camera sits (m).
    distance: 11,
    // How high above the car the camera sits (m).
    height: 4.6,
    // Camera pulls back by this much extra at top speed (m).
    speedPullback: 3.5,
    // How quickly the camera swings around to follow the car's direction.
    // Smaller = lazier, more cinematic. Bigger = locked behind the car.
    followSpeed: 4.5,
    // Field of view (zoom) when stopped and at top speed. Widening at
    // speed makes going fast feel fast.
    fov: 62,
    fovAtTopSpeed: 76,
    // Mouse wheel zoom limits (multiplier on distance).
    minZoom: 0.6,
    maxZoom: 2.0,
  },

  // ---------------------------------------------------------------
  //  GUN TURRET
  // ---------------------------------------------------------------
  // The HELL TANK's main cannon (and the Hell Cannon part) fire these.
  cannonShell: { damage: 30, fireRate: 1.6, bulletSpeed: 110, range: 160, spread: 0.6, splash: 3.5 },

  turret: {
    // How fast the turret swings toward your mouse (bigger = snappier).
    turnSpeed: 12,
    // Shots per second when holding the mouse button.
    fireRate: 8,
    // Damage per bullet. An imp has 40 health, so 5 = 8 bullets (~1 s).
    // Started balanced with ramming (same "damage per minute"), then nudged
    // up a bit after play-testing. Watch the DPM meter (top right) to compare.
    damage: 5,
    // Bullet speed (m/s) and how far bullets fly (m).
    bulletSpeed: 160,
    range: 140,
    // Random inaccuracy in degrees. 0 = laser-perfect.
    spread: 1.2,
  },

  // ---------------------------------------------------------------
  //  RAMMING
  // ---------------------------------------------------------------
  ramming: {
    // Hitting a demon at this speed (km/h) with a normal-weight car does
    // exactly enough damage to splat an imp. Faster = more damage.
    // Heavier cars hit harder, so they splat at lower speeds.
    splatSpeedKmh: 40,
    // How much the car slows down per demon it plows through
    // (fraction of demon weight vs car weight). 0 = none.
    momentumLoss: 1.0,
    // Damage a normal-weight car does hitting a demon at the splat speed.
    ramPower: 40,
    // Camera shake on a splat. 0 = none.
    shake: 0.35,
    // Seconds between ram kills that still count toward a SPLAT combo.
    comboTime: 1.5,
  },

  // ---------------------------------------------------------------
  //  BUILDER (press G for the garage)
  // ---------------------------------------------------------------
  build: {
    // Most parts allowed on one vehicle (keeps the game smooth).
    maxParts: 40,
    // true = build with unlimited free parts (no stock counts).
    unlimitedParts: false,
    // The parts you start the game with in your stock.
    startingKit: { armor: 4, spike: 4, gun: 1 },
    // How strongly front/back weight changes handling. 0 = not at all.
    //  Nose-heavy  -> understeer (turns wider, more stable)
    //  Tail-heavy  -> oversteer (tail slides out more easily)
    balanceEffect: 1.0,
  },

  // Every part: weight (kg), hit points (hp) and what it does.
  parts: {
    armor:   { mass: 60,  hp: 140 },                // tough block that soaks up hits
    spike:   { mass: 25,  hp: 50,  ramBonus: 0.3 }, // +30% ram damage on the side it faces
    plow:    { mass: 120, hp: 160, ramBonus: 0.7 }, // +70% ram damage on the side it faces
    gun:     { mass: 80,  hp: 60 },                 // one more gun that fires with your main gun
    booster: { mass: 40,  hp: 50,  power: 3500, topSpeed: 2.5 }, // more engine push and top speed (m/s)
    weight:  { mass: 250, hp: 220 },                // just heavy. Hits harder, handles worse.
    heavyArmor: { mass: 140, hp: 380 },             // a slab of hell-forged steel
    saw:     { mass: 60,  hp: 90,  ramBonus: 1.2 }, // spinning blade: +120% ram damage on its side
    cannon:  { mass: 160, hp: 120 },                // big gun: slow, hard-hitting, explosive shells
    hoverFan: { mass: 50, hp: 70 },                 // blows lava away: less lava burn and drag (see "lava")
  },

  // ---------------------------------------------------------------
  //  PROGRESSION: souls, the shop, and the car-to-tank upgrades
  // ---------------------------------------------------------------
  progression: {
    // Souls each demon drops. Ram kills pay extra (ramBonus x).
    souls: { imp: 2, hound: 2, spiker: 5, spitter: 4, brute: 25, fireImp: 3, magmaBrute: 35 },
    // (boss souls are with each boss, under "bosses")
    ramBonus: 1.5,
    // Getting wrecked restarts the run. true = keep souls, unlocks and
    // chassis upgrades across wrecks anyway.
    keepOnWreck: false,
  },

  // What parts cost in the garage. "unlock" = one-time souls to unlock
  // the part (0 = available from the start), "price" = souls per part.
  shop: {
    armor:      { unlock: 0,   price: 20 },
    spike:      { unlock: 0,   price: 15 },
    gun:        { unlock: 0,   price: 60 },
    weight:     { unlock: 80,  price: 25 },
    plow:       { unlock: 150, price: 50 },
    booster:    { unlock: 200, price: 50 },
    saw:        { unlock: 300, price: 80 },
    heavyArmor: { unlock: 350, price: 60 },
    hoverFan:   { unlock: 250, price: 60 },
    cannon:     { unlock: 500, price: 150 },
  },

  // The car-to-tank upgrade path, in order. Each tier multiplies the base
  // car's numbers. cost = souls to upgrade to it.
  //   hp: body toughness   power/topSpeed: engine   grip: less sliding
  //   turn: steering       turnInPlace: can spin on the spot (treads)
  //   heatResist: how much less lava burns you (0.4 = 40% less)
  chassisTiers: [
    { id: 'car',      name: 'Muscle Car',   cost: 0,    massAdd: 0,    hp: 1.0, power: 1.0,  topSpeed: 1.0,  grip: 1.0, turn: 1.0,  turnInPlace: false, heatResist: 0 },
    { id: 'armored',  name: 'Armored Car',  cost: 400,  massAdd: 350,  hp: 1.6, power: 1.3,  topSpeed: 0.97, grip: 1.0, turn: 1.0,  turnInPlace: false, heatResist: 0.4 },
    { id: 'halftrack',name: 'Half-Track',   cost: 1200, massAdd: 900,  hp: 2.4, power: 1.8,  topSpeed: 0.9,  grip: 1.35, turn: 1.1,  turnInPlace: false, heatResist: 0.5 },
    { id: 'tank',     name: 'HELL TANK',    cost: 2800, massAdd: 2000, hp: 3.5, power: 2.6,  topSpeed: 0.75, grip: 1.8, turn: 1.25, turnInPlace: true,  heatResist: 0.6 },
  ],

  // ---------------------------------------------------------------
  //  LAVA (rivers in the Lava Rivers, and pools the Magma Colossus spits)
  // ---------------------------------------------------------------
  // Driving on lava sets the bottom of your car on fire and bogs you down.
  // Protection: a better chassis (heatResist above) and Hover Fan parts.
  lava: {
    burnDps: 16,      // damage per second to EACH piece touching the lava
    afterBurn: 1.5,   // pieces keep burning this long after you get out (s)
    speedFactor: 0.3, // top speed while on lava (0.3 = 30% of normal)
    fanShield: 0.25,  // each Hover Fan blocks this much burn AND drag (4 fans = immune)
  },

  // The car's own body sections: hit points and weight (kg). When one
  // breaks off it drops as that actual piece: pick it up (E) and put it
  // back in the garage, or bolt it on somewhere it doesn't belong.
  // The cabin is where you sit: if it's destroyed, you're wrecked.
  chassis: {
    cabin:  { hp: 220, mass: 450 },
    nose:   { hp: 110, mass: 200 },
    tail:   { hp: 110, mass: 200 },
    doorL:  { hp: 90,  mass: 90 },
    doorR:  { hp: 90,  mass: 90 },
    bumper: { hp: 80,  mass: 90 },
  },

  // ---------------------------------------------------------------
  //  DAMAGE, SCRAP & REPAIR
  // ---------------------------------------------------------------
  damage: {
    // Crashing into rocks: speed lost in one hit (m/s) before it hurts.
    crashMinSpeed: 7,
    // Damage per m/s of crash speed above that.
    crashDamage: 9,
    // Pieces below this fraction of their hp smoke and spark.
    smokeBelow: 0.4,
    // Press E to grab scrap within this distance (m).
    pickupRadius: 8,
    // You can't open the garage with demons this close (m).
    garageSafeRadius: 40,
    // Seconds before you respawn after being wrecked.
    respawnDelay: 2.5,
  },

  // ---------------------------------------------------------------
  //  DEMONS
  // ---------------------------------------------------------------
  // Each demon: health, weight (kg), chase speed (m/s; 11 m/s = 40 km/h),
  // how close you get before it notices you (m), claw/bite damage and
  // seconds between attacks, and how many come in a pack.
  // Ramming: hitting a demon at the splat speed with a normal car does
  // ramming.ramPower damage (40). Twice as fast = 4x the damage.
  //   imp 40 hp = splats at 40 km/h; brute 450 hp = needs a LOT more.
  demons: {
    // Most demons alive at once (performance cap).
    maxActive: 100,
    // Demons farther than this from you vanish and new packs appear (m).
    despawnDistance: 260,
    // Strolling speed when they haven't noticed you.
    wanderSpeed: 2.2,

    // Small swarmers. Run them over.
    imp:     { health: 40,  mass: 60,  chaseSpeed: 8,   noticeRange: 75, attackDamage: 3,  attackInterval: 1.0, packMin: 6, packMax: 14 },
    // Fast pack hunters: faster than the splat speed, but fragile.
    hound:   { health: 20,  mass: 45,  chaseSpeed: 15,  noticeRange: 110, attackDamage: 2, attackInterval: 0.6, packMin: 3, packMax: 6 },
    // Covered in bone spikes: ramming it hurts YOUR car (thornDamage).
    spiker:  { health: 70,  mass: 120, chaseSpeed: 5,   noticeRange: 60, attackDamage: 6,  attackInterval: 1.5, packMin: 2, packMax: 5, thornDamage: 18 },
    // Lobs fireballs from range and runs away if you get close.
    spitter: { health: 30,  mass: 50,  chaseSpeed: 6.5, noticeRange: 90, attackDamage: 11, attackInterval: 2.6, packMin: 2, packMax: 4,
               shootRange: 50, preferredRange: 30, fleeRange: 15, splash: 3 },
    // Huge and heavy: you bounce off unless you hit it very hard.
    brute:   { health: 450, mass: 700, chaseSpeed: 4.5, noticeRange: 60, attackDamage: 22, attackInterval: 2.2, packMin: 1, packMax: 2 },
    // LAVA RIVERS
    // Imps on fire: their claws set the piece they hit burning (burnDps for burnTime s).
    fireImp: { health: 35,  mass: 55,  chaseSpeed: 9,   noticeRange: 80, attackDamage: 2,  attackInterval: 1.0, packMin: 6, packMax: 12, burnDps: 6, burnTime: 3 },
    // A walking volcano: burning punches, and ramming it sets your front on fire.
    magmaBrute: { health: 600, mass: 900, chaseSpeed: 4.2, noticeRange: 60, attackDamage: 24, attackInterval: 2.4, packMin: 1, packMax: 2, burnDps: 10, burnTime: 4 },
  },

  // ---------------------------------------------------------------
  //  BOSSES (one per region)
  // ---------------------------------------------------------------
  bosses: {
    // Ash Plains: a 9 m giant asleep in a ring of bones.
    ashTitan: {
      health: 2500,
      walkSpeed: 4.5,
      enragedSpeed: 6.5,      // below half health it gets angry and faster
      slamDamage: 45,         // fist slam when you're close
      slamRadius: 5,
      slamBurn: 0,            // (sets the hit piece on fire: damage/s)
      stompDamage: 25,        // shockwave ring: get far away or get hit
      stompRadius: 32,
      throwDamage: 35,        // thrown boulders when you're far
      throwSplash: 4,
      // If you drive this far from the arena center it gives up and heals.
      leash: 150,
      souls: 600,
    },
    // Lava Rivers: a basalt giant on an island in a lake of lava.
    magmaColossus: {
      health: 4000,
      walkSpeed: 4.2,
      enragedSpeed: 6.2,
      slamDamage: 55,
      slamRadius: 6,
      slamBurn: 10,
      stompDamage: 30,
      stompRadius: 36,
      throwDamage: 30,        // lava bombs...
      throwSplash: 5,
      poolRadius: 7,          // ...that leave a pool of burning lava (m)
      poolTime: 10,           // for this many seconds
      leash: 170,
      souls: 1000,
    },
  },
};
