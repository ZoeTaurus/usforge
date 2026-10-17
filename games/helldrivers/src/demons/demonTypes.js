// Every kind of demon, described as data. Regions list which of these live
// there (see regions/*.js). Their tweakable numbers live in settings.js
// under "demons".
//   behavior: 'melee'  = run at you and claw/bite
//             'ranged' = keep its distance and lob fireballs
//   heavy:    true = a solid obstacle: your car bounces off it
//   thorns:   true = ramming it hurts your car too
//   ramBurn:  true = ramming it sets the side you hit it with on fire
//   (stats with burnDps/burnTime = its attacks set your car on fire)
//   anim:     how it moves ('waddle', 'gallop', 'stomp', 'sway', 'roll'):
//             the demon shader swings its legs/arms/head/tail to match
import { SETTINGS } from '../settings.js';
import { STYLE } from './demonShader.js';
import { createImpGeometry, IMP_GORE_COLORS, createFireImpGeometry, FIRE_IMP_GORE } from './impModel.js';
import {
  createHoundGeometry, HOUND_GORE, createSpikerGeometry, SPIKER_GORE,
  createSpitterGeometry, SPITTER_GORE, createBruteGeometry, BRUTE_GORE,
  createMagmaBruteGeometry, MAGMA_BRUTE_GORE,
} from './demonModels.js';

export const DEMON_TYPES = {
  imp: {
    name: 'Imp', behavior: 'melee', anim: 'waddle',
    stats: () => SETTINGS.demons.imp,
    createGeometry: createImpGeometry, goreColors: IMP_GORE_COLORS,
    radius: 0.55, height: 1.5, poolSize: 160,
  },
  hound: {
    name: 'Hellhound', behavior: 'melee', anim: 'gallop',
    stats: () => SETTINGS.demons.hound,
    createGeometry: createHoundGeometry, goreColors: HOUND_GORE,
    radius: 0.6, height: 1.2, poolSize: 60,
  },
  spiker: {
    name: 'Pincushion', behavior: 'melee', anim: 'roll', thorns: true,
    stats: () => SETTINGS.demons.spiker,
    createGeometry: createSpikerGeometry, goreColors: SPIKER_GORE,
    radius: 1.0, height: 1.8, poolSize: 40,
  },
  spitter: {
    name: 'Cinder Spitter', behavior: 'ranged', anim: 'sway',
    stats: () => SETTINGS.demons.spitter,
    createGeometry: createSpitterGeometry, goreColors: SPITTER_GORE,
    radius: 0.5, height: 2.3, poolSize: 30,
  },
  brute: {
    name: 'Ash Brute', behavior: 'melee', anim: 'stomp', heavy: true,
    stats: () => SETTINGS.demons.brute,
    createGeometry: createBruteGeometry, goreColors: BRUTE_GORE,
    radius: 1.1, height: 3.0, poolSize: 10,
  },
  // ---- Lava Rivers ----
  fireImp: {
    name: 'Fire Imp', behavior: 'melee', anim: 'waddle',
    stats: () => SETTINGS.demons.fireImp,
    createGeometry: createFireImpGeometry, goreColors: FIRE_IMP_GORE,
    radius: 0.55, height: 1.6, poolSize: 160,
  },
  magmaBrute: {
    name: 'Magma Brute', behavior: 'melee', anim: 'stomp', heavy: true, ramBurn: true,
    stats: () => SETTINGS.demons.magmaBrute,
    createGeometry: createMagmaBruteGeometry, goreColors: MAGMA_BRUTE_GORE,
    radius: 1.1, height: 3.0, poolSize: 10,
  },
};
for (const t of Object.values(DEMON_TYPES)) t.style = STYLE[t.anim];
