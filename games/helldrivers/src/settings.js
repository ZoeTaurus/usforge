// =====================================================================
//  HELLDRIVE — FEEL SETTINGS
// =====================================================================
//  Every number that changes how the game *feels* lives here.
//  Change a number, save the file, and the game reloads by itself.
//
//  Tip: press  T  in the game to open the live Tuning panel. You can drag
//  sliders while driving. Those changes are NOT saved, so when you find
//  values you like, copy them back into this file (or tell Claude).
//
//  Units: distances are in meters, speeds in meters per second
//  (1 m/s is about 2.24 mph), weights in kilograms.
// =====================================================================

export const SETTINGS = {
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

    // Top speed going forward (m/s). 40 m/s is about 90 mph.
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
    // Hitting a demon at this speed (mph) with a normal-weight car does
    // exactly enough damage to splat an imp. Faster = more damage.
    // Heavier cars hit harder, so they splat at lower speeds.
    splatSpeedMph: 25,
    // How much the car slows down per demon it plows through
    // (fraction of demon weight vs car weight). 0 = none.
    momentumLoss: 1.0,
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
    startingKit: { armor: 8, spike: 8, plow: 2, gun: 4, booster: 2, weight: 2, panel: 0 },
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
    panel:   { mass: 50,  hp: 80 },                 // a bent piece of your car's body. Bolt it anywhere!
  },

  // The car's own body sections: hit points, weight (kg), and how many
  // Body Panels they break into (also the cost to rebuild them in the garage).
  // The cabin is where you sit: if it's destroyed, you're wrecked.
  chassis: {
    cabin:  { hp: 220, mass: 450, panels: 0 },
    nose:   { hp: 110, mass: 200, panels: 2 },
    tail:   { hp: 110, mass: 200, panels: 2 },
    doorL:  { hp: 90,  mass: 90,  panels: 1 },
    doorR:  { hp: 90,  mass: 90,  panels: 1 },
    bumper: { hp: 80,  mass: 90,  panels: 1 },
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
  //  IMPS (the small demons)
  // ---------------------------------------------------------------
  imp: {
    // Most imps alive at once (performance cap).
    maxActive: 100,
    health: 40,
    // Weight in kg (affects how much they slow you down when rammed).
    mass: 60,
    // Running speed when chasing you (m/s). 8 m/s is about 18 mph,
    // slower than the splat speed, so they can't hurt you while you're fast.
    chaseSpeed: 8,
    // Strolling speed when they haven't noticed you.
    wanderSpeed: 2.2,
    // How close you get before they notice and chase you (m).
    noticeRange: 75,
    // Damage per claw swipe, and seconds between swipes (per imp).
    attackDamage: 3,
    attackInterval: 1.0,
    // Imps spawn in packs of this many.
    packMin: 6,
    packMax: 14,
    // Imps farther than this from you vanish and new packs appear (m).
    despawnDistance: 260,
  },
};
