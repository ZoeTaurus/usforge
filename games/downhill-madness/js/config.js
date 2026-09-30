'use strict';
// Core constants for Downhill Madness. World units: the piste is 2 × ROAD_W wide.
const TAU = Math.PI * 2;

const CFG = {
  SEG_LEN: 200,        // length of one track segment
  ROAD_W: 1900,        // half-width of the groomed piste
  DRAW_DIST: 210,      // segments drawn ahead
  CAM_H: 1100,         // camera height above the snow
  HORIZON: 0.34,       // horizon line as a fraction of screen height
  PLAYER_Y: 0.82,      // where the sled sits on screen
  FOCAL: 0.95,         // focal length × screen height
  METER: 180,          // world units per metre
  GRAVITY: 3600,
  LEVEL_METERS: 700,   // metres per madness level
  SOUND_BARRIER: 343,  // km/h
  AVA_MAX_M: 320,      // max lead over the avalanche
  AVA_START_M: 170,
  PLAYER_HW: 140,      // sled half-width
  PLAYER_H: 380,       // rider height
};
CFG.PD = CFG.CAM_H * CFG.FOCAL / (CFG.PLAYER_Y - CFG.HORIZON); // camera → player distance
CFG.KMH = 3.6 / CFG.METER;                                    // units/s → km/h

const LEVEL_NAMES = ['Chill', 'Brisk', 'Spicy', 'Bonkers', 'Ridiculous', 'Absurd',
  'Unhinged', 'Cosmic', 'Beyond Science', 'Pure Madness'];

function levelName(l) {
  if (l <= LEVEL_NAMES.length) return LEVEL_NAMES[l - 1];
  return 'Pure Madness' + '!'.repeat(Math.min(5, l - LEVEL_NAMES.length));
}
