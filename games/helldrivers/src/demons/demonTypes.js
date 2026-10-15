// Every kind of demon, described as data. Regions list which of these live
// there (see regions/*.js). Their tweakable numbers live in settings.js.
import { SETTINGS } from '../settings.js';
import { createImpGeometry, IMP_GORE_COLORS } from './impModel.js';

export const DEMON_TYPES = {
  imp: {
    name: 'Imp',
    stats: () => SETTINGS.imp,      // health, speed, damage... (tweakable)
    createGeometry: createImpGeometry,
    radius: 0.55,                   // how "wide" it is for collisions (m)
    height: 1.5,                    // how tall (m)
    goreColors: IMP_GORE_COLORS,
    poolSize: 160,                  // hard limit on how many can exist
  },
};
