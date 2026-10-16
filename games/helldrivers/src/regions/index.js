// Every region, in the order you travel through them. Beat a region's boss
// and a Hellgate opens to the next one.
import ashPlains from './ashPlains.js';
import lavaRivers from './lavaRivers.js';

export const REGIONS = [ashPlains, lavaRivers];
export const STARTING_REGION = REGIONS[0];
export const regionById = (id) => REGIONS.find((r) => r.id === id) || STARTING_REGION;
export const nextRegion = (r) => REGIONS[REGIONS.indexOf(r) + 1] || null;
// Not built yet, but named so the last gate can say where it leads.
export const PLANNED_REGIONS = ['Ash Plains', 'The Lava Rivers', 'Bone Mountains', 'Flooded City', 'Blood Swamp', 'Ice Hell', 'Iron Foundry', 'Screaming Canyon', 'Mirror Wastes', 'The Throne'];
