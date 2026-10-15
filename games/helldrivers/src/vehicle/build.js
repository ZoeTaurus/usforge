// The vehicle build: which parts sit in which grid cells, which body
// sections are still attached, your stock of spare parts, the rules for
// where parts may go, and the numbers they add up to (weight, balance...).
//
// Grid: cells are 0.5 m cubes in the car's own space (x = right/left,
// y = up, z = forward). Cell (i, j, k) has its center at
//   x = (i + 0.5) * 0.5,  y = 0.15 + j * 0.5,  z = (k + 0.5) * 0.5
// The car body fills some cells; parts must touch the body or another
// part (face to face). No building underneath the car (j < 0) or inside
// the wheels.
import { SETTINGS } from '../settings.js';
import { PART_TYPES } from './parts.js';

export const CELL = 0.5;
export const cellCenter = (i, j, k) => ({ x: (i + 0.5) * CELL, y: 0.15 + j * CELL, z: (k + 0.5) * CELL });
export const key = (i, j, k) => `${i},${j},${k}`;

// ---- The car's body sections and the cells each one fills ----
export const SECTION_NAMES = { cabin: 'Cabin', nose: 'Nose', tail: 'Tail', doorL: 'Left door', doorR: 'Right door', bumper: 'Ram bumper' };
export const SECTION_CELLS = { cabin: [], nose: [], tail: [], doorL: [], doorR: [], bumper: [] };
for (let i = -2; i <= 1; i++) {
  SECTION_CELLS.bumper.push([i, 0, 4]);
  for (const k of [2, 3]) SECTION_CELLS.nose.push([i, 0, k]);
  for (const k of [-4, -3]) SECTION_CELLS.tail.push([i, 0, k]);
  for (let k = -3; k <= 1; k++) SECTION_CELLS.cabin.push([i, 1, k]);       // cabin glass + roof
}
for (let k = -2; k <= 1; k++) {
  SECTION_CELLS.doorL.push([1, 0, k]);
  SECTION_CELLS.doorR.push([-2, 0, k]);
  for (const i of [-1, 0]) SECTION_CELLS.cabin.push([i, 0, k]);           // middle of the chassis
}
for (let i = -1; i <= 0; i++) for (let k = -2; k <= -1; k++) SECTION_CELLS.cabin.push([i, 2, k]); // roof gun

export const BODY_CELLS = new Set();
const CELL_SECTION = new Map(); // cell key -> section id
for (const [id, cells] of Object.entries(SECTION_CELLS)) {
  for (const c of cells) { BODY_CELLS.add(key(...c)); CELL_SECTION.set(key(...c), id); }
}
export const sectionOfCell = (k) => CELL_SECTION.get(k);
export const sectionCenter = (id) => {
  const cs = SECTION_CELLS[id].map((c) => cellCenter(...c));
  return { x: avg(cs, 'x'), y: avg(cs, 'y'), z: avg(cs, 'z') };
};
const avg = (arr, f) => arr.reduce((s, o) => s + o[f], 0) / arr.length;

// Cells where the wheels are (can't build there).
const WHEEL_CELLS = new Set();
for (const i of [-3, 2]) for (const k of [-4, -3, 2, 3]) WHEEL_CELLS.add(key(i, 0, k));

const NEIGHBORS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const LIMIT = { i: 8, j: 8, k: 10 }; // how far from the car you can build

export class Build {
  constructor() {
    this.parts = new Map();      // key -> { type, i, j, k, normal: [x,y,z], hp }
    this.missing = new Set();    // body sections that have fallen off
    this.sectionHp = {};         // section id -> hp
    this.inventory = { ...SETTINGS.build.startingKit }; // spare parts in stock
    this.repairAll();
  }

  get count() { return this.parts.size; }

  // Is this cell filled by an attached body section or a part?
  isFilled(i, j, k) {
    const kk = key(i, j, k);
    if (BODY_CELLS.has(kk) && !this.missing.has(CELL_SECTION.get(kk))) return true;
    return this.parts.has(kk);
  }

  // Can a part go in this cell? Returns a reason string if not.
  whyNot(i, j, k) {
    if (j < 0) return 'Not under the car (the wheels need the ground)';
    if (Math.abs(i) > LIMIT.i || j > LIMIT.j || Math.abs(k) > LIMIT.k) return 'Too far from the car';
    if (this.isFilled(i, j, k)) return 'Something is already there';
    if (WHEEL_CELLS.has(key(i, j, k))) return 'That is where the wheel is';
    if (this.count >= SETTINGS.build.maxParts) return `Part limit reached (${SETTINGS.build.maxParts})`;
    if (!NEIGHBORS.some(([a, b, c]) => this.isFilled(i + a, j + b, k + c))) return 'Must touch the car or another part';
    return null;
  }

  // ---- Stock of spare parts ----
  has(type, n = 1) { return SETTINGS.build.unlimitedParts || (this.inventory[type] || 0) >= n; }
  give(type, n = 1) { this.inventory[type] = (this.inventory[type] || 0) + n; }
  take(type, n = 1) { if (!SETTINGS.build.unlimitedParts) this.inventory[type] = (this.inventory[type] || 0) - n; }

  add(type, i, j, k, normal) {
    if (this.whyNot(i, j, k) || !this.has(type)) return false;
    this.take(type);
    this.parts.set(key(i, j, k), { type, i, j, k, normal: [...normal], hp: SETTINGS.parts[type].hp });
    return true;
  }

  // Unbolt a part in the garage (back into stock, plus anything left floating).
  remove(i, j, k) {
    const p = this.parts.get(key(i, j, k));
    if (!p) return [];
    this.parts.delete(key(i, j, k));
    const dropped = [p, ...this.dropFloating()];
    for (const d of dropped) this.give(d.type);
    return dropped;
  }

  // Take parts that no longer touch the car off it. Returns them.
  dropFloating() {
    const connected = new Set();
    const queue = [];
    for (const s of BODY_CELLS) if (!this.missing.has(CELL_SECTION.get(s))) queue.push(s.split(',').map(Number));
    while (queue.length) {
      const [i, j, k] = queue.pop();
      for (const [a, b, c] of NEIGHBORS) {
        const kk = key(i + a, j + b, k + c);
        if (this.parts.has(kk) && !connected.has(kk)) { connected.add(kk); queue.push([i + a, j + b, k + c]); }
      }
    }
    // Body sections that lost their connection to the cabin fall off too.
    const lostSections = [];
    for (const id of Object.keys(SECTION_CELLS)) {
      if (id === 'cabin' || this.missing.has(id)) continue;
      if (!this.#sectionTouchesCabin(id, connected)) lostSections.push(id);
    }
    const dropped = [];
    for (const kk of [...this.parts.keys()]) if (!connected.has(kk)) { dropped.push(this.parts.get(kk)); this.parts.delete(kk); }
    for (const id of lostSections) { this.missing.add(id); dropped.push({ section: id }); }
    if (lostSections.length) dropped.push(...this.dropFloating());
    return dropped;
  }

  #sectionTouchesCabin(id) {
    // The bumper hangs off the nose; everything else bolts straight to the cabin.
    if (id === 'bumper') return !this.missing.has('nose');
    return true;
  }

  // A piece was destroyed in battle. Returns everything that fell off.
  breakPart(k) {
    const p = this.parts.get(k);
    if (!p) return [];
    this.parts.delete(k);
    return [p, ...this.dropFloating()];
  }
  breakSection(id) {
    if (id === 'cabin' || this.missing.has(id)) return [];
    this.missing.add(id);
    return [{ section: id }, ...this.dropFloating()];
  }

  // Rebuild a missing body section from Body Panels. Parts sitting in its
  // spot go back into stock. Returns a reason string if it can't.
  restoreSection(id) {
    const cost = SETTINGS.chassis[id].panels;
    if (!this.missing.has(id)) return 'Not missing';
    if (id === 'bumper' && this.missing.has('nose')) return 'Rebuild the nose first';
    if (!this.has('panel', cost)) return `Needs ${cost} Body Panel${cost > 1 ? 's' : ''}`;
    for (const c of SECTION_CELLS[id]) {
      const p = this.parts.get(key(...c));
      if (p) { this.parts.delete(key(...c)); this.give(p.type); }
    }
    this.take('panel', cost);
    this.missing.delete(id);
    this.sectionHp[id] = SETTINGS.chassis[id].hp;
    return null;
  }

  // The garage mechanics patch up everything still attached.
  repairAll() {
    for (const id of Object.keys(SECTION_CELLS)) if (!this.missing.has(id)) this.sectionHp[id] = SETTINGS.chassis[id].hp;
    for (const p of this.parts.values()) p.hp = SETTINGS.parts[p.type].hp;
  }

  clear() {
    for (const p of this.parts.values()) this.give(p.type);
    this.parts.clear();
  }

  // ---- What the build adds up to ----
  stats() {
    const P = SETTINGS.parts;
    let mass = SETTINGS.car.mass, momentZ = 0, momentX = 0, power = 0, topSpeed = 0, guns = 0;
    // Missing body sections make the car lighter (and shift its balance).
    for (const id of this.missing) {
      const m = SETTINGS.chassis[id].mass, c = sectionCenter(id);
      mass -= m; momentZ -= m * c.z; momentX -= m * c.x;
    }
    const ramBonus = { '1,0': 0, '-1,0': 0, '0,1': 0, '0,-1': 0 }; // by side: x,z direction
    for (const p of this.parts.values()) {
      const s = P[p.type];
      const c = cellCenter(p.i, p.j, p.k);
      mass += s.mass;
      momentZ += s.mass * c.z;
      momentX += s.mass * c.x;
      if (s.power) power += s.power;
      if (s.topSpeed) topSpeed += s.topSpeed;
      if (PART_TYPES[p.type].isGun) guns++;
      if (s.ramBonus) {
        const side = `${p.normal[0]},${p.normal[2]}`;
        if (side in ramBonus) ramBonus[side] += s.ramBonus;
      }
    }
    return {
      count: this.parts.size,
      mass,
      comZ: momentZ / mass, // + = nose heavy
      comX: momentX / mass,
      // -1 (very tail heavy) .. +1 (very nose heavy)
      balance: Math.max(-1, Math.min(1, (momentZ / mass) / 1.0)),
      enginePower: SETTINGS.car.enginePower + power,
      topSpeed: SETTINGS.car.topSpeed + topSpeed,
      guns: guns + 1, // + the built-in roof gun
      ramBonus,
    };
  }

  // ---- Save / load (kept in the browser between visits) ----
  snapshot() {
    return JSON.parse(JSON.stringify({ parts: [...this.parts.values()], missing: [...this.missing], inventory: this.inventory }));
  }
  load(data) {
    this.parts.clear();
    this.missing.clear();
    const list = Array.isArray(data) ? data : data?.parts || []; // (old saves were just a list)
    for (const p of list) {
      if (!PART_TYPES[p.type]) continue;
      this.parts.set(key(p.i, p.j, p.k), { type: p.type, i: p.i, j: p.j, k: p.k, normal: p.normal, hp: SETTINGS.parts[p.type].hp });
    }
    for (const id of data?.missing || []) if (id in SECTION_CELLS && id !== 'cabin') this.missing.add(id);
    if (data?.inventory) this.inventory = { ...SETTINGS.build.startingKit, ...data.inventory };
    this.dropFloating();
    this.repairAll();
  }
  save() { try { localStorage.setItem('helldrive.build', JSON.stringify(this.snapshot())); } catch { /* storage blocked: fine */ } }
  restore() {
    try { this.load(JSON.parse(localStorage.getItem('helldrive.build') || '[]')); } catch { /* ignore */ }
  }
}
