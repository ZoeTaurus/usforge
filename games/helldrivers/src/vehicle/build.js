// The vehicle build: which parts sit in which grid cells, which body
// sections are still attached, your stock of spare parts, the rules for
// where things may go, and the numbers they add up to (weight, balance...).
//
// Grid: cells are 0.5 m cubes in the car's own space (x = right/left,
// y = up, z = forward). Cell (i, j, k) has its center at
//   x = (i + 0.5) * 0.5,  y = 0.15 + j * 0.5,  z = (k + 0.5) * 0.5
// The car body fills some cells; parts must touch the body or another
// part (face to face). No building underneath the car (j < 0) or inside
// the wheels.
//
// Most parts fill one cell. A loose body section (a nose, a door...) that
// you picked up as scrap keeps its real size and fills several cells.
import { SETTINGS } from '../settings.js';
import { PART_TYPES } from './parts.js';

export const CELL = 0.5;
export const cellCenter = (i, j, k) => ({ x: (i + 0.5) * CELL, y: 0.15 + j * CELL, z: (k + 0.5) * CELL });
export const key = (i, j, k) => `${i},${j},${k}`;

// ---- The car's body sections and the cells each one fills ----
export const SECTION_NAMES = { cabin: 'Cabin', nose: 'Nose', tail: 'Tail', doorL: 'Left Door', doorR: 'Right Door', bumper: 'Ram Bumper' };
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
const avg = (arr, f) => arr.reduce((s, o) => s + o[f], 0) / arr.length;
const centerOf = (cells) => { const cs = cells.map((c) => cellCenter(...c)); return { x: avg(cs, 'x'), y: avg(cs, 'y'), z: avg(cs, 'z') }; };
export const sectionCenter = (id) => centerOf(SECTION_CELLS[id]);

// ---- Loose body sections as bolt-on pieces ----
export const SECTION_PIECES = ['nose', 'tail', 'doorL', 'doorR', 'bumper'];
export const isSectionPiece = (type) => SECTION_PIECES.includes(type);
// Each section's "anchor" is its cell closest to its middle. When you bolt
// a loose section on, the anchor goes in the cell you click.
export const SECTION_ANCHOR = {};
for (const id of SECTION_PIECES) {
  const c = sectionCenter(id);
  SECTION_ANCHOR[id] = SECTION_CELLS[id].reduce((best, cell) => {
    const p = cellCenter(...cell), b = cellCenter(...best);
    return (p.x - c.x) ** 2 + (p.z - c.z) ** 2 < (b.x - c.x) ** 2 + (b.z - c.z) ** 2 ? cell : best;
  });
}

// Display info for anything that can sit in your stock.
export function pieceInfo(type) {
  if (isSectionPiece(type)) return { name: SECTION_NAMES[type], icon: '🚘', desc: 'A real piece of your car. Put it back, or bolt it on anywhere!' };
  return PART_TYPES[type];
}
export const pieceStats = (type) => (isSectionPiece(type) ? SETTINGS.chassis[type] : SETTINGS.parts[type]);

// Which cells a piece fills when its anchor sits in cell (i,j,k), turned
// `rot` quarter-turns around the vertical axis.
export function footprint(type, i, j, k, rot = 0) {
  if (!isSectionPiece(type)) return [[i, j, k]];
  const a = SECTION_ANCHOR[type];
  return SECTION_CELLS[type].map(([ci, cj, ck]) => {
    let di = ci - a[0], dk = ck - a[2];
    for (let r = 0; r < ((rot % 4) + 4) % 4; r++) [di, dk] = [dk, -di];
    return [i + di, j + (cj - a[1]), k + dk];
  });
}

// Cells where the wheels are (can't build there).
const WHEEL_CELLS = new Set();
for (const i of [-3, 2]) for (const k of [-4, -3, 2, 3]) WHEEL_CELLS.add(key(i, 0, k));

const NEIGHBORS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const LIMIT = { i: 8, j: 8, k: 10 }; // how far from the car you can build

export class Build {
  constructor() {
    // cell key -> part record. A record that fills several cells is stored
    // under each of them. Record: { type, i, j, k, normal, rot, cells, hp }
    this.parts = new Map();
    this.missing = new Set();    // body sections that have fallen off
    this.sectionHp = {};         // section id -> hp
    this.inventory = { ...SETTINGS.build.startingKit }; // spare parts in stock
    this.tier = SETTINGS.chassisTiers[0];  // car / armored / half-track / tank
    this.repairAll();
  }

  // Every bolted-on part once (even ones that fill several cells).
  list() { return [...new Set(this.parts.values())]; }
  get count() { return this.list().length; }

  // Is this cell filled by an attached body section or a part?
  isFilled(i, j, k) {
    const kk = key(i, j, k);
    if (BODY_CELLS.has(kk) && !this.missing.has(CELL_SECTION.get(kk))) return true;
    return this.parts.has(kk);
  }

  // Can this piece go here? Returns a reason string if not.
  whyNot(type, i, j, k, rot = 0) {
    const cells = footprint(type, i, j, k, rot);
    const mine = new Set(cells.map((c) => key(...c)));
    for (const [ci, cj, ck] of cells) {
      if (cj < 0) return 'Not under the car (the wheels need the ground)';
      if (Math.abs(ci) > LIMIT.i || cj > LIMIT.j || Math.abs(ck) > LIMIT.k) return 'Too far from the car';
      if (this.isFilled(ci, cj, ck)) return cells.length > 1 ? "Doesn't fit there (try R to turn it)" : 'Something is already there';
      if (WHEEL_CELLS.has(key(ci, cj, ck))) return 'That is where the wheel is';
    }
    if (this.count >= SETTINGS.build.maxParts) return `Part limit reached (${SETTINGS.build.maxParts})`;
    const touches = cells.some(([ci, cj, ck]) => NEIGHBORS.some(([a, b, c]) =>
      !mine.has(key(ci + a, cj + b, ck + c)) && this.isFilled(ci + a, cj + b, ck + c)));
    if (!touches) return 'Must touch the car or another part';
    return null;
  }

  // How tough a body section is with the current chassis tier.
  sectionMaxHp(id) { return SETTINGS.chassis[id].hp * this.tier.hp; }

  // ---- Stock of spare parts ----
  has(type, n = 1) { return SETTINGS.build.unlimitedParts || (this.inventory[type] || 0) >= n; }
  give(type, n = 1) { this.inventory[type] = (this.inventory[type] || 0) + n; }
  take(type, n = 1) { if (!SETTINGS.build.unlimitedParts) this.inventory[type] = (this.inventory[type] || 0) - n; }

  add(type, i, j, k, normal, rot = 0) {
    if (this.whyNot(type, i, j, k, rot) || !this.has(type)) return false;
    this.take(type);
    this.#put({ type, i, j, k, normal: [...normal], rot, hp: pieceStats(type).hp });
    return true;
  }

  #put(rec) {
    rec.cells = footprint(rec.type, rec.i, rec.j, rec.k, rec.rot || 0);
    rec.key = key(rec.i, rec.j, rec.k);
    for (const c of rec.cells) this.parts.set(key(...c), rec);
  }

  #delete(rec) { for (const c of rec.cells) this.parts.delete(key(...c)); }

  // Unbolt a part in the garage (back into stock, plus anything left floating).
  remove(i, j, k) {
    const rec = this.parts.get(key(i, j, k));
    if (!rec) return [];
    this.#delete(rec);
    const dropped = [rec, ...this.dropFloating()];
    for (const d of dropped) this.give(d.section || d.type);
    return dropped;
  }

  // Take whatever no longer touches the car off it. Returns what fell.
  dropFloating() {
    const connected = new Set(); // records still attached
    const queue = [];
    for (const s of BODY_CELLS) if (!this.missing.has(CELL_SECTION.get(s))) queue.push(s.split(',').map(Number));
    while (queue.length) {
      const [i, j, k] = queue.pop();
      for (const [a, b, c] of NEIGHBORS) {
        const rec = this.parts.get(key(i + a, j + b, k + c));
        if (rec && !connected.has(rec)) { connected.add(rec); queue.push(...rec.cells); }
      }
    }
    const dropped = [];
    for (const rec of this.list()) if (!connected.has(rec)) { dropped.push(rec); this.#delete(rec); }
    // The bumper hangs off the nose: no nose, no bumper.
    if (this.missing.has('nose') && !this.missing.has('bumper')) {
      this.missing.add('bumper');
      dropped.push({ section: 'bumper' }, ...this.dropFloating());
    }
    return dropped;
  }

  // A piece was destroyed in battle. Returns everything that fell off.
  breakPart(cellKey) {
    const rec = this.parts.get(cellKey);
    if (!rec) return [];
    this.#delete(rec);
    return [rec, ...this.dropFloating()];
  }
  breakSection(id) {
    if (id === 'cabin' || this.missing.has(id)) return [];
    this.missing.add(id);
    return [{ section: id }, ...this.dropFloating()];
  }

  // Put a missing body section back in its proper place (needs that piece
  // in stock). Parts in the way go back into stock.
  restoreSection(id) {
    if (!this.missing.has(id)) return 'Not missing';
    if (id === 'bumper' && this.missing.has('nose')) return 'Put the nose back first';
    if (!this.has(id)) return `You don't have the ${SECTION_NAMES[id]}. Find it out there (E)!`;
    for (const c of SECTION_CELLS[id]) {
      const rec = this.parts.get(key(...c));
      if (rec) { this.#delete(rec); this.give(rec.type); }
    }
    this.take(id);
    this.missing.delete(id);
    this.sectionHp[id] = this.sectionMaxHp(id);
    this.dropFloating(); // (nothing should fall, but keep things tidy)
    return null;
  }

  // The garage mechanics patch up everything still attached.
  repairAll() {
    for (const id of Object.keys(SECTION_CELLS)) if (!this.missing.has(id)) this.sectionHp[id] = this.sectionMaxHp(id);
    for (const rec of this.list()) rec.hp = pieceStats(rec.type).hp;
  }

  clear() {
    for (const rec of this.list()) this.give(rec.type);
    this.parts.clear();
  }

  // ---- What the build adds up to ----
  stats() {
    let mass = SETTINGS.car.mass + this.tier.massAdd, momentZ = 0, momentX = 0, power = 0, topSpeed = 0, guns = 0, fans = 0;
    // Missing body sections make the car lighter (and shift its balance).
    for (const id of this.missing) {
      const m = SETTINGS.chassis[id].mass, c = sectionCenter(id);
      mass -= m; momentZ -= m * c.z; momentX -= m * c.x;
    }
    const ramBonus = { '1,0': 0, '-1,0': 0, '0,1': 0, '0,-1': 0 }; // by side: x,z direction
    const parts = this.list();
    for (const rec of parts) {
      const s = pieceStats(rec.type);
      const c = centerOf(rec.cells);
      mass += s.mass;
      momentZ += s.mass * c.z;
      momentX += s.mass * c.x;
      if (s.power) power += s.power;
      if (s.topSpeed) topSpeed += s.topSpeed;
      if (PART_TYPES[rec.type]?.isGun) guns++;
      if (rec.type === 'hoverFan') fans++;
      if (s.ramBonus) {
        const side = `${rec.normal[0]},${rec.normal[2]}`;
        if (side in ramBonus) ramBonus[side] += s.ramBonus;
      }
    }
    return {
      count: parts.length,
      mass,
      comZ: momentZ / mass, // + = nose heavy
      comX: momentX / mass,
      // -1 (very tail heavy) .. +1 (very nose heavy)
      balance: Math.max(-1, Math.min(1, (momentZ / mass) / 1.0)),
      enginePower: SETTINGS.car.enginePower * this.tier.power + power,
      topSpeed: SETTINGS.car.topSpeed * this.tier.topSpeed + topSpeed,
      guns: guns + (this.missing.has('cabin') ? 0 : 1), // + the built-in roof gun
      ramBonus,
      fans,
    };
  }

  // ---- Save / load (kept in the browser between visits) ----
  snapshot() {
    const parts = this.list().map(({ type, i, j, k, normal, rot }) => ({ type, i, j, k, normal, rot: rot || 0 }));
    return JSON.parse(JSON.stringify({ parts, missing: [...this.missing], inventory: this.inventory }));
  }
  load(data) {
    this.parts.clear();
    this.missing.clear();
    const list = Array.isArray(data) ? data : data?.parts || []; // (old saves were just a list)
    for (const p of list) {
      if (!pieceStats(p.type)) continue;
      this.#put({ type: p.type, i: p.i, j: p.j, k: p.k, normal: p.normal, rot: p.rot || 0, hp: pieceStats(p.type).hp });
    }
    for (const id of data?.missing || []) if (id in SECTION_CELLS && id !== 'cabin') this.missing.add(id);
    if (data?.inventory) {
      this.inventory = { ...SETTINGS.build.startingKit };
      for (const [t, n] of Object.entries(data.inventory)) if (pieceStats(t)) this.inventory[t] = n; // skip retired types
    }
    this.dropFloating();
    this.repairAll();
  }
  save() {
    if (SETTINGS.dev.creative) return; // creative builds never touch your real save
    try { localStorage.setItem('helldrive.build', JSON.stringify(this.snapshot())); } catch { /* storage blocked: fine */ }
  }
  restore() {
    try { this.load(JSON.parse(localStorage.getItem('helldrive.build') || '[]')); } catch { /* ignore */ }
  }
}
