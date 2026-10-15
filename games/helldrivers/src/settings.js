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
    // How heavy the car is (kg). Heavier = slower to speed up, slower to
    // turn, harder to stop, and (later) hits harder when ramming.
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
  //  GUN TURRET (visual only in Milestone 1)
  // ---------------------------------------------------------------
  turret: {
    // How fast the turret swings toward your mouse (bigger = snappier).
    turnSpeed: 12,
    // Shots per second when holding the mouse button.
    fireRate: 8,
  },
};
