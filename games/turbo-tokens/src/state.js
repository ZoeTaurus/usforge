// Save data, shop catalogue, car stats and token rewards.

const SAVE_KEY = 'turbo-tokens-save-v1';

export const PAINT_COLORS = [
  '#e3242b', '#ff6a13', '#ffc400', '#7ed321', '#13b26b', '#19c3d6',
  '#2f6bff', '#1c2f8f', '#8a2be2', '#ff3ea5', '#f5f5f5', '#9aa3ad',
  '#3a3f47', '#111214', '#7a4b2a', '#c9a227',
];

export const BODIES = [
  {
    id: 'street', name: 'Street GT', price: 0,
    desc: 'Balanced all-rounder.',
    mods: { speed: 1.0, accel: 1.0, handling: 1.0, grip: 1.0, offroad: 0.55 },
  },
  {
    id: 'muscle', name: 'Muscle', price: 0,
    desc: 'Big engine, punchy launch, heavy steering.',
    mods: { speed: 1.03, accel: 1.08, handling: 0.9, grip: 0.92, offroad: 0.55 },
  },
  {
    id: 'buggy', name: 'Dune Buggy', price: 200,
    desc: 'Barely slows down off the road.',
    mods: { speed: 0.97, accel: 1.06, handling: 1.04, grip: 1.0, offroad: 0.85 },
  },
  {
    id: 'formula', name: 'Formula', price: 500,
    desc: 'Open-wheel racer. Fast and sharp.',
    mods: { speed: 1.08, accel: 1.1, handling: 1.1, grip: 1.12, offroad: 0.45 },
  },
];

export const WHEELS = [
  { id: 'classic', name: 'Classic 5-Spoke', price: 0 },
  { id: 'turbine', name: 'Turbine', price: 80 },
  { id: 'star', name: 'Star Mesh', price: 120 },
  { id: 'offroad', name: 'Off-Road', price: 150 },
];

export const SPOILERS = [
  { id: 'none', name: 'None', price: 0, desc: 'Clean look' },
  { id: 'lip', name: 'Ducktail', price: 0, desc: '+2% grip' },
  { id: 'wing', name: 'GT Wing', price: 120, desc: '+5% grip' },
];

export const FINISHES = [
  { id: 'gloss', name: 'Gloss', price: 0 },
  { id: 'metallic', name: 'Metallic', price: 60 },
  { id: 'matte', name: 'Matte', price: 80 },
  { id: 'chrome', name: 'Chrome', price: 300 },
];

export const STRIPES = [
  { id: 'none', name: 'None', price: 0 },
  { id: 'racing', name: 'Racing Stripes', price: 0 },
  { id: 'side', name: 'Side Stripe', price: 0 },
];

export const UNDERGLOW_PRICE = 150;

// Fun style extras (the Style tab in the garage).
export const STICKERS = [
  { id: 'none', name: 'No Sticker', price: 0 },
  { id: 'flame', name: 'Flames', price: 40 },
  { id: 'bolt', name: 'Lightning', price: 40 },
  { id: 'star', name: 'Star', price: 40 },
  { id: 'heart', name: 'Heart', price: 40 },
  { id: 'smiley', name: 'Smiley', price: 50 },
  { id: 'eyes', name: 'Googly Eyes', price: 60 },
  { id: 'paw', name: 'Paw Print', price: 50 },
  { id: 'checker', name: 'Race Flag', price: 50 },
  { id: 'skull', name: 'Skull', price: 70 },
  { id: 'crown', name: 'Crown', price: 80 },
  { id: 'turbo', name: 'TURBO Badge', price: 90 },
];

export const TRAILS = [
  { id: 'none', name: 'No Trail', price: 0, desc: 'Just the taillights' },
  { id: 'neon', name: 'Neon', price: 100, desc: 'Glows in your stripe colour' },
  { id: 'fire', name: 'Fire', price: 140, desc: 'Burning hot streaks' },
  { id: 'ice', name: 'Ice', price: 140, desc: 'Frosty blue light' },
  { id: 'gold', name: 'Gold Rush', price: 180, desc: 'Shiny golden streaks' },
  { id: 'galaxy', name: 'Galaxy', price: 220, desc: 'Pink, purple and space blue' },
  { id: 'rainbow', name: 'Rainbow', price: 250, desc: 'Every colour at once!' },
];

export const HORNS = [
  { id: 'classic', name: 'Classic', price: 0, desc: 'Beep beep!' },
  { id: 'truck', name: 'Big Truck', price: 60, desc: 'Deep and loud' },
  { id: 'clown', name: 'Clown', price: 80, desc: 'Honk honk!' },
  { id: 'duck', name: 'Duck', price: 80, desc: 'Quack quack!' },
  { id: 'airhorn', name: 'Air Horn', price: 100, desc: 'BWAAA BWAAA' },
  { id: 'train', name: 'Steam Train', price: 120, desc: 'Choo choo!' },
  { id: 'tune', name: 'La Cucaracha', price: 150, desc: 'Plays a little song' },
];

export const BUBBLES = [
  { id: 'rainbow', name: 'Rainbow', price: 0, color: null },
  { id: 'ocean', name: 'Ocean Blue', price: 60, color: '#3fb8ff' },
  { id: 'pink', name: 'Bubblegum', price: 60, color: '#ff6fd0' },
  { id: 'mint', name: 'Mint', price: 60, color: '#5dffb0' },
  { id: 'gold', name: 'Gold', price: 80, color: '#ffd23f' },
  { id: 'purple', name: 'Purple', price: 80, color: '#a66bff' },
  { id: 'fire', name: 'Fire', price: 80, color: '#ff6a2a' },
];

// Performance parts. Each slot holds one part; better parts cost tokens,
// change the driving stats and show up on the 3D car.
export const PARTS = [
  {
    slot: 'engine', name: 'Engine', blurb: 'Raises your top speed.',
    items: [
      { id: 'i4', name: 'Stock 4-Cylinder', price: 0, tier: 0, desc: 'Comes with your car' },
      { id: 'v6', name: 'V6', price: 120, tier: 1, desc: '+6% top speed' },
      { id: 'v8', name: 'Supercharged V8', price: 280, tier: 2, desc: '+12% top speed · hood scoop' },
      { id: 'v12', name: 'V12 Race Engine', price: 520, tier: 3, desc: '+18% top speed · chrome blower' },
    ],
  },
  {
    slot: 'turbo', name: 'Turbo', blurb: 'Faster acceleration out of corners.',
    items: [
      { id: 'none', name: 'No Turbo', price: 0, tier: 0, desc: 'Comes with your car' },
      { id: 'street', name: 'Street Turbo', price: 90, tier: 1, desc: '+11% acceleration' },
      { id: 'twin', name: 'Twin Turbo', price: 220, tier: 2, desc: '+22% acceleration' },
      { id: 'race', name: 'Race Turbo', price: 400, tier: 3, desc: '+33% acceleration' },
    ],
  },
  {
    slot: 'tyres', name: 'Tyres', blurb: 'Grip in the corners and sharper steering.',
    items: [
      { id: 'street', name: 'Street Tyres', price: 0, tier: 0, desc: 'Comes with your car' },
      { id: 'sport', name: 'Sport Tyres', price: 80, tier: 1, desc: '+10% grip · yellow stripe' },
      { id: 'slicks', name: 'Racing Slicks', price: 220, tier: 2, desc: '+20% grip · extra wide' },
      { id: 'rally', name: 'Rally Tyres', price: 150, tier: 1, desc: 'Grips on snow and off the road' },
    ],
  },
  {
    slot: 'exhaust', name: 'Exhaust', blurb: 'A little more speed and a lot more style.',
    items: [
      { id: 'stock', name: 'Stock Exhaust', price: 0, tier: 0, desc: 'Comes with your car' },
      { id: 'sport', name: 'Sport Exhaust', price: 60, tier: 1, desc: '+2% speed · chrome pipes' },
      { id: 'race', name: 'Quad Race Exhaust', price: 160, tier: 2, desc: '+4% speed · four pipes' },
    ],
  },
  {
    slot: 'nitro', name: 'Nitro', blurb: 'How long and how hard your boost pushes.',
    items: [
      { id: 'small', name: 'Small Bottle', price: 0, tier: 0, desc: 'Comes with your car' },
      { id: 'double', name: 'Double Bottles', price: 110, tier: 1, desc: 'Longer, stronger boost' },
      { id: 'mega', name: 'Mega Tank', price: 260, tier: 2, desc: 'Huge boost · purple flames' },
    ],
  },
];

export function partItem(slot, id) {
  const p = PARTS.find((x) => x.slot === slot);
  return p.items.find((i) => i.id === id) || p.items[0];
}

// How hard the rival drivers race. `skill` shifts each track's AI skill,
// `speed` scales their top speed, `corner` is how close to the limit they
// take corners, `slowDown`/`catchUp` cap the rubber-banding when they are
// ahead of/behind you, and `reward` multiplies the place tokens. On Hard the
// rivals also copy the player's parts and get a perfect start.
export const DIFFICULTIES = [
  { id: 'easy', name: 'Easy', desc: 'Slower rivals that wait for you', skill: -0.09, speed: 0.95, corner: 0.82, slowDown: 0.15, catchUp: 0.01, nitro: 0.5, reward: 0.75 },
  { id: 'medium', name: 'Medium', desc: 'A fair fight', skill: 0, speed: 1, corner: 0.86, slowDown: 0.1, catchUp: 0.06, nitro: 1, reward: 1 },
  { id: 'hard', name: 'Hard', desc: 'Rivals copy your parts, then get extra power and grip', skill: 0.09, maxSkill: 1.06, speed: 1.045, handling: 1.03, corner: 0.97, slowDown: 0, catchUp: 0.15, nitro: 3, nitroRegen: 1.25, reward: 1.8, matchParts: true, launch: true },
  // Rivals get every best part plus extra power and grip, nail every corner and refill nitro twice as fast.
  { id: 'insane', name: 'Insane', desc: 'Maxed-out super-rivals with turbo-charged nitro. Good luck!', skill: 0.16, maxSkill: 1.12, speed: 1.08, handling: 1.06, corner: 1, slowDown: 0, catchUp: 0.3, nitro: 6, nitroRegen: 2.2, reward: 3, maxParts: true, launch: true },
];

// The best part for every slot (rally tyres on slippery tracks).
export function bestParts(grip = 1) {
  return { engine: 'v12', turbo: 'race', tyres: grip < 0.9 ? 'rally' : 'slicks', exhaust: 'race', nitro: 'mega' };
}

export function difficultyDef(id) {
  return DIFFICULTIES.find((d) => d.id === id) || DIFFICULTIES[1];
}

export const PLACE_TOKENS = [120, 80, 55, 35, 20, 10];
export const LAP_OPTIONS = [1, 3, 5];
export const LAP_FACTOR = { 1: 0.5, 3: 1, 5: 1.6 };

export function defaultCar() {
  return {
    body: 'street',
    color: '#e3242b',
    accent: '#f5f5f5',
    finish: 'gloss',
    wheels: 'classic',
    rimColor: '#c9ced6',
    spoiler: 'lip',
    stripes: 'racing',
    underglow: null,
    number: 7,
    engine: 'i4',
    turbo: 'none',
    tyres: 'street',
    exhaust: 'stock',
    nitro: 'small',
    sticker: 'none',
    trail: 'none',
    horn: 'classic',
    bubble: 'rainbow',
  };
}

function defaultSave() {
  return {
    tokens: 150,
    car: defaultCar(),
    owned: [],
    visitedGarage: false,
    tutorialDone: false,
    best: {},
    stats: { races: 0, wins: 0, podiums: 0, tokensEarned: 0 },
    settings: { sound: true, quality: 'high', camera: 0, ghost: false, night: false, rain: false },
    lastTrack: 'valley',
    laps: 3,
    difficulty: 'medium',
  };
}

export const save = load();

function load() {
  const d = defaultSave();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      const out = {
        ...d,
        ...s,
        car: { ...d.car, ...(s.car || {}) },
        stats: { ...d.stats, ...(s.stats || {}) },
        settings: { ...d.settings, ...(s.settings || {}) },
        best: s.best || {},
        owned: Array.isArray(s.owned) ? s.owned : [],
      };
      if (s.upgrades) migrateUpgrades(out, s.upgrades);
      return out;
    }
  } catch {
    /* storage unavailable — play without saving */
  }
  return d;
}

// Older saves had upgrade levels instead of parts: give the matching parts.
function migrateUpgrades(out, up) {
  const grant = (slot, ids, equip) => {
    for (const id of ids) if (!out.owned.includes(`${slot}:${id}`)) out.owned.push(`${slot}:${id}`);
    if (equip) out.car[slot] = equip;
  };
  const tiers = { engine: ['v6', 'v8', 'v12'], turbo: ['street', 'twin', 'race'], nitro: ['double', 'mega'] };
  for (const slot of ['engine', 'turbo', 'nitro']) {
    const n = Math.min(up[slot] || 0, tiers[slot].length);
    if (n > 0) grant(slot, tiers[slot].slice(0, n), tiers[slot][n - 1]);
  }
  const t = up.tires || 0;
  if (t > 0) grant('tyres', ['sport', 'slicks', 'rally'].slice(0, t), t >= 2 ? 'slicks' : 'sport');
  delete out.upgrades;
  out.visitedGarage = true;
}

export function persist() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    /* ignore */
  }
}

export function resetSave() {
  const d = defaultSave();
  for (const k of Object.keys(save)) delete save[k];
  Object.assign(save, d);
  persist();
}

export function owns(kind, id, price) {
  return price === 0 || save.owned.includes(`${kind}:${id}`);
}

export function buy(kind, id, price) {
  if (owns(kind, id, price)) return true;
  if (save.tokens < price) return false;
  save.tokens -= price;
  save.owned.push(`${kind}:${id}`);
  persist();
  return true;
}

export function bodyDef(id) {
  return BODIES.find((b) => b.id === id) || BODIES[0];
}

// Physical driving numbers for a car config (body + installed parts).
export function computeStats(car, skill = 1) {
  const m = bodyDef(car.body).mods;
  const e = partItem('engine', car.engine).tier;
  const t = partItem('turbo', car.turbo).tier;
  const x = partItem('exhaust', car.exhaust).tier;
  const n = partItem('nitro', car.nitro).tier;
  const tyre = partItem('tyres', car.tyres).id;
  const tyreGrip = { street: 0, sport: 0.1, slicks: 0.2, rally: 0.06 }[tyre] || 0;
  const aero = car.body === 'formula' ? 0.05 : { none: 0, lip: 0.02, wing: 0.05 }[car.spoiler] || 0;
  return {
    maxSpeed: 50 * m.speed * (1 + 0.06 * e + 0.02 * x) * skill, // m/s
    accel: 15 * m.accel * (1 + 0.11 * t + 0.03 * x + 0.03 * e) * (0.6 + 0.4 * skill),
    steer: 1.85 * m.handling * (1 + 0.5 * (tyreGrip + aero)),
    grip: 6.0 * m.grip * (1 + tyreGrip + aero),
    offroad: tyre === 'rally' ? Math.max(m.offroad, 0.8) : m.offroad,
    iceGrip: tyre === 'rally' ? 1.35 : 1, // multiplier on slippery surfaces
    nitroPower: 1.28 + 0.06 * n,
    nitroDrain: 1 / (2.6 + 1.3 * n), // full tank lasts this long
    nitroRecharge: 0.045 + 0.012 * n,
  };
}

// 0..100 ratings for the garage stat bars.
export function statRatings(car) {
  const s = computeStats(car);
  const pct = (v, lo, hi) => Math.round(Math.max(0, Math.min(1, (v - lo) / (hi - lo))) * 100);
  return {
    speed: pct(s.maxSpeed, 44, 66),
    accel: pct(s.accel, 13, 25),
    handling: pct(s.steer * 0.5 + s.grip * 0.15, 1.5, 2.45),
    nitro: pct((s.nitroPower - 1) / s.nitroDrain, 0.6, 2.1),
  };
}

// Tokens for a finished race: place × map/laps, plus performance bonuses.
export function computeReward({ place, track, laps, fastestLap, clean, perf = {}, difficulty = 'medium', conditions = {} }) {
  const lines = [];
  const base = PLACE_TOKENS[place - 1] || 5;
  lines.push({ label: `Finished ${place}${['st', 'nd', 'rd'][place - 1] || 'th'}`, value: base });
  const lapF = LAP_FACTOR[laps] || 1;
  let total = base;
  const scaled = Math.round(base * track.reward * lapF);
  if (scaled !== base) {
    lines.push({ label: `${track.name} ×${track.reward} · ${laps} lap${laps > 1 ? 's' : ''}`, value: scaled - base });
    total = scaled;
  }
  const diff = difficultyDef(difficulty);
  if (diff.reward !== 1) {
    const withDiff = Math.round(total * diff.reward);
    lines.push({ label: `${diff.name} difficulty ×${diff.reward}`, value: withDiff - total });
    total = withDiff;
  }
  // Racing at night or in bad weather pays a little extra.
  const extra = (label, f) => {
    const v = Math.round(total * f);
    lines.push({ label, value: v - total });
    total = v;
  };
  if (conditions.night) extra('Night race ×1.1', 1.1);
  if (conditions.rain) extra(`${conditions.rain === 'blizzard' ? 'Blizzard' : 'Rain'} ×1.15`, 1.15);
  const bonus = [];
  const add = (label, value) => {
    if (value > 0) bonus.push({ label, value });
  };
  const ov = perf.overtakes || 0;
  add(`Overtakes ×${ov}`, Math.min(40, ov * 4));
  const drift = perf.driftScore || 0;
  add(`Drift score ${drift.toLocaleString()}`, Math.min(60, Math.floor(drift / 150)));
  const kmh = perf.topSpeedKmh || 0;
  add(`Top speed ${kmh} km/h`, Math.min(25, Math.max(0, Math.round((kmh - 170) / 3))));
  if (perf.perfectStart) add('Perfect start', 10);
  const led = perf.lapsLed || 0;
  add(`Laps in the lead ×${led}`, led * 5);
  if (fastestLap) add('Fastest lap', 25);
  if (clean) add('Clean race (no wall hits)', 15);
  const bonusTotal = bonus.reduce((a, b) => a + b.value, 0);
  total += bonusTotal;
  return { lines, bonus, bonusTotal, total, grade: gradeFor(place, bonusTotal) };
}

// S/A/B/C/D rating from finishing place and performance bonus.
export function gradeFor(place, bonus) {
  if (place === 1 && bonus >= 60) return 'S';
  if (place === 1 || (place <= 2 && bonus >= 40)) return 'A';
  if (place <= 3) return 'B';
  if (place <= 5) return 'C';
  return 'D';
}
