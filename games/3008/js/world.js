'use strict';
// ============================================================ the endless store
// The store is an infinite grid of cells, B x B tiles each: a walkway along the top (3 tiles), a walkway down the
// left (3 tiles) and an 11 x 11 showroom in the rest, walls included. (In the code, walkways are "halls" and
// showrooms are "rooms", and the room kinds keep their old names: see ROOM_NAMES.) Everything is derived from SEED, so only what the
// player changes (furniture, doors, pickups) has to be remembered.

let cells, furn, doors, pickups, deltas, faceCache, floorCache, boardCache;
function resetWorld() {
  cells = new Map(); furn = new Map(); doors = new Map(); pickups = new Map(); deltas = new Map();
  faceCache = new Map(); floorCache = new Map(); boardCache = new Map();
}
resetWorld();

const ROOM_WEIGHTS = [30, 7, 7, 7, 6, 7, 4, 7, 5, 6, 4, 5, 3];
const ROOM_TOTAL = ROOM_WEIGHTS.reduce((a, b) => a + b, 0);
function pickRoom(r) { let acc = 0; for (let i = 0; i < NRT; i++) { acc += ROOM_WEIGHTS[i] / ROOM_TOTAL; if (r < acc) return i; } return 0; }

function cell(cx, cy) {
  const k = CK(cx, cy);
  let c = cells.get(k);
  if (c) return c;
  const start = cx === 0 && cy === 0;
  const door = s => hash(cx, cy, s) < .62 ? 5 + Math.floor(hash(cx, cy, s + 10) * 7) : -1;
  c = {
    cx, cy, type: start ? RT.CLASS : pickRoom(hash(cx, cy, 1)),
    dt: door(2), db: door(3), dl: door(4), dr: door(5),
    blockTop: !start && hash(cx, cy, 6) < .09, blockLeft: !start && hash(cx, cy, 7) < .09,
    wing: Math.floor(hash(Math.floor(cx / 3), Math.floor(cy / 3), 77) * 4),
    num: String((1 + Math.floor(hash(cx, cy, 8) * 3)) * 100 + 1 + Math.floor(hash(cx, cy, 9) * 48)),
    gen: false, seen: false
  };
  if (start) { c.dl = 8; c.dt = 8; }
  if (c.dt < 0 && c.db < 0 && c.dl < 0 && c.dr < 0) c.dt = 8;
  cells.set(k, c);
  return c;
}
function tileAt(x, y) {
  const cx = Math.floor(x / B), cy = Math.floor(y / B), lx = x - cx * B, ly = y - cy * B, c = cell(cx, cy);
  if (lx < 3 || ly < 3) {
    if (ly < 3 && lx >= 3 && c.blockTop && lx === 8) return WALL;
    if (lx < 3 && ly >= 3 && c.blockLeft && ly === 8) return WALL;
    return HALL;
  }
  const f = FLOOR0 + c.type;
  if (c.type === RT.COMMONS) return f;
  if (ly === 3) return lx === c.dt ? f : WALL;
  if (ly === 13) return lx === c.db ? f : WALL;
  if (lx === 3) return ly === c.dl ? f : WALL;
  if (lx === 13) return ly === c.dr ? f : WALL;
  return f;
}
function local(x, y) { const cx = Math.floor(x / B), cy = Math.floor(y / B); return { cx, cy, lx: x - cx * B, ly: y - cy * B, c: cell(cx, cy) }; }
function doorKind(x, y) {
  const { lx, ly, c } = local(x, y);
  if (c.type === RT.COMMONS || lx < 3 || ly < 3) return 0;
  if ((ly === 3 && lx === c.dt) || (ly === 13 && lx === c.db)) return 'h';
  if ((lx === 3 && ly === c.dl) || (lx === 13 && ly === c.dr)) return 'v';
  return 0;
}
const isWall = (x, y) => tileAt(x, y) === WALL;
function doorClosed(x, y) { const d = doors.get(K(x, y)); return !!(d && d.closed); }
function solid(x, y) { const k = K(x, y); return tileAt(x, y) === WALL || furn.has(k) || (doors.has(k) && doors.get(k).closed); }
function opaque(x, y) { return tileAt(x, y) === WALL || doorClosed(x, y); }
function blocksSight(x, y) { if (opaque(x, y)) return true; const f = furn.get(K(x, y)); return !!(f && FURN[f.type].tall); }
const isFloor = (x, y) => !solid(x, y);

// ---------------------------------------------------------------- remembering what the player changed
function deltaFor(x, y) {
  const ck = CK(Math.floor(x / B), Math.floor(y / B));
  let m = deltas.get(ck);
  if (!m) deltas.set(ck, m = new Map());
  const k = K(x, y);
  let e = m.get(k);
  if (!e) m.set(k, e = {});
  return e;
}
function noteFurn(x, y) { const f = furn.get(K(x, y)); deltaFor(x, y).f = f ? { type: f.type, v: f.v, hp: f.hp, placed: f.placed } : null; }
function noteDoor(d) { deltaFor(d.x, d.y).d = d.closed; }
function notePickup(x, y) { deltaFor(x, y).p = 0; }
function setFurn(x, y, f) { if (f) furn.set(K(x, y), f); else furn.delete(K(x, y)); noteFurn(x, y); }

// ---------------------------------------------------------------- filling a room
function mkFurn(type, v, placed) { return { type, v: v % FURN[type].nv, hp: FURN[type].hp, placed: !!placed, shake: 0, hit: -9 }; }
function genRoom(cx, cy) {
  const c = cell(cx, cy);
  if (c.gen) return;
  c.gen = true;
  const ox = cx * B, oy = cy * B;
  let n = 0;
  const R = () => hash(cx, cy, 100 + n++);
  const free = (lx, ly) => !furn.has(K(ox + lx, oy + ly)) && tileAt(ox + lx, oy + ly) !== WALL;
  const put = (lx, ly, type, v) => {
    if (lx < 4 || lx > 12 || ly < 4 || ly > 12 || !free(lx, ly)) return false;
    furn.set(K(ox + lx, oy + ly), mkFurn(type, v === undefined ? (R() * 8) | 0 : v));
    return true;
  };
  const item = (lx, ly, type) => { if (free(lx, ly) && !pickups.has(K(ox + lx, oy + ly))) pickups.set(K(ox + lx, oy + ly), { type, x: ox + lx, y: oy + ly }); };
  const somewhere = (type, tries = 8) => { for (let i = 0; i < tries; i++) { const lx = 4 + ((R() * 9) | 0), ly = 4 + ((R() * 9) | 0); if (free(lx, ly)) { item(lx, ly, type); return; } } };
  const staff = [];
  switch (c.type) {
    case RT.CLASS: {   // living rooms: a few little room sets, each a sofa, a coffee table, an armchair, a lamp
      for (const [ox2, oy2] of [[5, 5], [9, 5], [5, 9], [9, 9]]) {
        if (R() < .15) continue;
        put(ox2, oy2, 'couch', (R() * 3) | 0); put(ox2 + 1, oy2, R() < .5 ? 'stand' : 'plant');
        put(ox2, oy2 + 1, 'desk', (R() * 4) | 0);
        if (R() < .7) put(ox2 + 1, oy2 + 1, 'chair', (R() * 4) | 0);
      }
      if (R() < .6) put(12, 4, 'shelf', (R() * 3) | 0);
      if (R() < .4) put(4, 4, 'tdesk', (R() * 3) | 0);
      if (R() < .35) put(12, 12, 'mat', (R() * 2) | 0);
      if (R() < .3) put(4, 12, 'trash');
      if (R() < .25) item(4 + ((R() * 9) | 0), 8, 'apple');
      staff.push(R() < .5 ? [8, 4, 'board'] : [8, 8, 'wander']);
      break;
    }
    case RT.LIB:       // bookcases, in rows
      for (const ry of [5, 7, 9]) for (let rx = 5; rx <= 11; rx++) if (rx !== 8 && R() < .9) put(rx, ry, 'shelf', (R() * 3) | 0);
      for (const rx of [5, 11]) put(rx, 11, 'cabinet', (R() * 2) | 0);
      put(12, 12, 'cart', 0);
      if (R() < .5) put(4, 12, 'plant');
      staff.push([8, 11, 'stand']);
      break;
    case RT.CAFE:      // the restaurant
      for (const ry of [6, 10]) for (let rx = 5; rx <= 11; rx++) if (rx !== 8) { put(rx, ry, 'table', (R() * 4) | 0); if (R() < .5) put(rx, ry - 1, 'chair', (R() * 4) | 0); if (R() < .5) put(rx, ry + 1, 'chair', (R() * 4) | 0); }
      put(4, 4, 'trash', 1); put(12, 4, 'trash', 2);
      if (R() < .7) put(12, 12, 'vending', (R() * 2) | 0);
      for (let i = 0; i < 3; i++) if (R() < .6) somewhere(R() < .5 ? 'milk' : 'chips');
      if (R() < .4) somewhere('apple');
      staff.push([8, 8, 'wander']);
      break;
    case RT.STORE:     // the self-serve warehouse: rows of flat-pack boxes on pallets
      for (const rx of [5, 6, 9, 10]) for (let ly = 4; ly <= 12; ly++) if (ly !== 8 && R() < .78) {
        const q = R();
        put(rx, ly, q < .62 ? 'box' : q < .72 ? 'locker' : q < .8 ? 'shelf' : q < .88 ? 'mat' : q < .94 ? 'cabinet' : 'cart', (R() * 4) | 0);
      }
      if (R() < .6) put(12, 12, 'cart', 0);
      if (R() < .6) somewhere('battery', 14);
      if (R() < .25) somewhere('bandage', 14);
      staff.push([8, 8, 'wander']);
      break;
    case RT.COMMONS:   // the marketplace: bins of cheap things, trolleys, plants
      for (let i = 0; i < 4; i++) {
        const lx = 5 + ((R() * 7) | 0), ly = 5 + ((R() * 7) | 0);
        if (R() < .5) { put(lx, ly, 'box', (R() * 3) | 0); put(lx + 1, ly, 'box', (R() * 3) | 0); put(lx, ly + 1, 'cart', 1); }
        else { put(lx, ly, 'plant', (R() * 2) | 0); put(lx + 1, ly, 'plant', (R() * 2) | 0); put(lx, ly + 1, 'mat', (R() * 2) | 0); }
      }
      if (R() < .5) put(4, 4, 'vending', (R() * 2) | 0);
      if (R() < .4) somewhere('chips');
      staff.push([8, 8, 'wander']);
      break;
    case RT.BATH:      // bathroom sets
      for (const lx of [5, 8, 11]) if (R() < .6) put(lx, 5, 'cabinet', R() < .5 ? 0 : 1);
      if (R() < .5) put(4, 12, 'trash', 0);
      if (R() < .5) put(12, 12, 'shelf', 0);
      if (R() < .4) put(8, 10, 'plant', 1);
      break;
    case RT.GYM:       // children's: beds, toy boxes, rugs to play on
      for (const [lx, ly] of [[5, 5], [11, 5]]) if (R() < .8) put(lx, ly, 'cot', (R() * 2) | 0);
      for (const [lx, ly] of [[4, 12], [12, 12], [6, 11], [10, 11]]) if (R() < .6) put(lx, ly, R() < .5 ? 'box' : 'mat', (R() * 4) | 0);
      if (R() < .6) put(8, 5, 'shelf', 2);
      if (R() < .4) somewhere('apple');
      staff.push([8, 9, 'wander']);
      break;
    case RT.SCIENCE:   // kitchens: islands, bar stools, a fridge-tall cabinet and a mannequin "cooking"
      for (const ry of [7, 10]) for (const rx of [5, 6, 10, 11]) if (R() < .9) { put(rx, ry, 'labtable', (R() * 3) | 0); if (R() < .7) put(rx, ry + 1, 'stool'); }
      put(4, 4, 'locker', 0); put(12, 4, 'locker', 0);
      if (R() < .5) put(8, 7, 'skeleton');
      if (R() < .35) somewhere('milk');
      staff.push([8, 4, 'board']);
      break;
    case RT.MUSIC:     // bedrooms: a bed, wardrobes, bedside lamps
      put(6, 6, 'cot', (R() * 2) | 0); put(10, 6, 'cot', (R() * 2) | 0);
      for (const lx of [5, 7, 9, 11]) if (R() < .6) put(lx, 5, 'stand');
      put(4, 10, 'locker', (R() * 4) | 0); put(12, 10, 'locker', (R() * 4) | 0);
      put(8, 10, 'cabinet', (R() * 2) | 0);
      if (R() < .5) put(8, 12, 'mat', (R() * 2) | 0);
      if (R() < .3) put(5, 12, 'skeleton');
      staff.push([8, 8, 'stand']);
      break;
    case RT.ART:       // decoration: prints, frames, lamps, vases
      for (const [lx, ly] of [[5, 5], [8, 5], [11, 5]]) if (R() < .8) put(lx, ly, 'easel', (R() * 4) | 0);
      for (const rx of [5, 6, 10, 11]) put(rx, 9, R() < .5 ? 'tdesk' : 'desk', (R() * 3) | 0);
      for (const rx of [5, 11]) if (R() < .6) put(rx, 11, 'stand');
      if (R() < .6) put(12, 12, 'plant'); if (R() < .6) put(4, 12, 'piano');
      staff.push([8, 7, 'wander']);
      break;
    case RT.NURSE:     // first aid
      for (const [lx, ly] of [[5, 6], [5, 9], [11, 6], [11, 9]]) if (R() < .85) put(lx, ly, 'cot', 1);
      put(8, 5, 'tdesk', 1); put(12, 4, 'cabinet', 2); put(4, 12, 'trash', 0);
      if (R() < .5) put(12, 12, 'plant');
      item(8, 8, 'bandage'); if (R() < .6) somewhere('bandage');
      staff.push([8, 4, 'stand']);
      break;
    case RT.LOUNGE:    // the staff room
      put(5, 6, 'couch', 0); put(6, 6, 'couch', 0); put(5, 8, 'table', 0); put(6, 8, 'table', 2);
      put(11, 4, 'vending', 0); if (R() < .6) put(12, 4, 'vending', 1);
      put(12, 10, 'plant'); put(4, 12, 'trash');
      for (let i = 0; i < 2; i++) if (R() < .7) somewhere(R() < .5 ? 'chips' : 'apple');
      staff.push([9, 7, 'wander'], [5, 7, 'stand']);
      break;
    case RT.OFFICE:    // the manager's office
      put(8, 7, 'desk', 1); put(8, 6, 'chair', 2);
      for (const lx of [4, 5, 11, 12]) put(lx, 4, 'cabinet', R() < .5 ? 0 : 3);
      put(4, 10, 'shelf', 2); put(12, 10, 'plant'); put(5, 12, 'couch', 2);
      if (R() < .7) somewhere('battery'); if (R() < .3) somewhere('bandage');
      staff.push([8, 5, 'stand']);
      break;
  }
  // keep every doorway clear on the inside
  if (c.dt >= 0) furn.delete(K(ox + c.dt, oy + 4));
  if (c.db >= 0) furn.delete(K(ox + c.db, oy + 12));
  if (c.dl >= 0) furn.delete(K(ox + 4, oy + c.dl));
  if (c.dr >= 0) furn.delete(K(ox + 12, oy + c.dr));
  // real doors, some of them closed
  const start = cx === 0 && cy === 0;
  for (const [x, y] of [[c.dt, 3], [c.db, 13], [3, c.dl], [13, c.dr]]) {
    if (c.type === RT.COMMONS || x < 0 || y < 0) continue;
    const wx = ox + x, wy = oy + y;
    doors.set(K(wx, wy), { x: wx, y: wy, kind: doorKind(wx, wy), closed: !start && hash(wx, wy, 31) < .2, anim: 0, rattle: 0 });
  }
  // the halls collect a little clutter
  if (!start && R() < .35) {
    const hx = ox + ((R() * 3) | 0), hy = oy + 4 + ((R() * 8) | 0);
    if (!solid(hx, hy)) furn.set(K(hx, hy), mkFurn(pick(['chair', 'box', 'box', 'trash', 'cart', 'plant']), (R() * 4) | 0));
  }
  if (!start && R() < .05) { const hx = ox + 4 + ((R() * 8) | 0), hy = oy + ((R() * 3) | 0); if (!solid(hx, hy)) pickups.set(K(hx, hy), { type: 'battery', x: hx, y: hy }); }
  // whatever the player changed here before
  const m = deltas.get(CK(cx, cy));
  if (m) for (const [k, e] of m) {
    if ('f' in e) { if (e.f) furn.set(k, { ...e.f, shake: 0, hit: -9 }); else furn.delete(k); }
    if ('d' in e) { const d = doors.get(k); if (d) d.closed = e.d; }
    if ('p' in e) pickups.delete(k);
  }
  // the staff stand around during the day
  if (!start && typeof spawnStaff === 'function' && !isNight()) {
    const chance = { [RT.CLASS]: .5, [RT.LIB]: .35, [RT.CAFE]: .4, [RT.STORE]: .3, [RT.OFFICE]: .55, [RT.LOUNGE]: .5, [RT.NURSE]: .4, [RT.SCIENCE]: .4, [RT.MUSIC]: .35 }[c.type] || .15;
    for (const [lx, ly, act] of staff) if (R() < chance && free(lx, ly)) spawnStaff(ox + lx, oy + ly, act);
    if (R() < .1) spawnStaff(ox + 1, oy + 6, 'janitor');
  }
}

// ---------------------------------------------------------------- what the walls look like
const ROOM_WALL = {
  [RT.CLASS]: { style: 'drywall', upper: '#efece4', lower: '#d8d0c0', stripe: '#c8bca4' },
  [RT.LIB]: { style: 'drywall', upper: '#e8e8e4', lower: '#c8c8c4', stripe: '#a8a8a4' },
  [RT.CAFE]: { style: 'panel', upper: '#efe8d8' },
  [RT.STORE]: { style: 'plain' },
  [RT.BATH]: { style: 'tiles', stripe: '#2c5fa8' },
  [RT.GYM]: { style: 'drywall', upper: '#f2ecd8', lower: '#7ab8d8', stripe: '#e8c33a' },
  [RT.SCIENCE]: { style: 'drywall', upper: '#eeeeea', lower: '#d8d8d4', stripe: '#b8b8b4' },
  [RT.MUSIC]: { style: 'drywall', upper: '#d8dce8', lower: '#b8bccb', stripe: '#9a9eb0' },
  [RT.ART]: { style: 'drywall', upper: '#f4f2ec', lower: '#e0dcd0', stripe: '#d84a3a' },
  [RT.NURSE]: { style: 'block', upper: '#d8ebe2', lower: '#a8c8b8', stripe: '#4cae5b' },
  [RT.LOUNGE]: { style: 'block', upper: '#d8c8b0', lower: '#8a6a4a', stripe: '#5a3a2a' },
  [RT.OFFICE]: { style: 'panel', upper: '#c8b898' }
};
function roomDecor(c, lx, x, y) {
  const r = hash(x, y, 14);
  switch (c.type) {
    case RT.CLASS: if (lx >= 6 && lx <= 10) return 'board:chalk'; if (lx === 12) return r < .5 ? 'clock' : 'flag'; if (lx === 4) return r < .4 ? 'flag' : 'poster'; return r < .5 ? 'print' : 'hooks';
    case RT.LIB: if (lx === 8) return 'clock'; return r < .4 ? 'poster' : r < .6 ? 'print' : '';
    case RT.CAFE: if (lx >= 6 && lx <= 10) return 'board:menu'; return lx === 4 || lx === 12 ? 'window' : 'poster';
    case RT.SCIENCE: return 'wallcab';
    case RT.NURSE: if (lx === 5) return 'eyechart'; if (lx === 8) return 'poster'; if (lx === 11) return 'bulletin'; return '';
    case RT.BATH: return lx % 2 === 1 && lx >= 5 && lx <= 11 ? 'mirror' : '';
    case RT.GYM: if (lx === 5 || lx === 11) return 'pennant'; if (lx >= 7 && lx <= 9) return 'drawing'; return '';
    case RT.MUSIC: if (lx === 8) return 'flag'; return r < .4 ? 'print' : '';
    case RT.ART: return lx % 2 === 0 ? 'print' : r < .5 ? 'print' : 'trophy';
    case RT.LOUNGE: if (lx === 5 || lx === 11) return 'window'; if (lx === 8) return 'bulletin'; if (lx === 9) return 'clock'; if (lx === 6) return 'diploma'; return '';
    case RT.OFFICE: if (lx === 6 || lx === 10) return 'diploma'; if (lx === 8) return 'flag'; if (lx === 4 || lx === 12) return 'window'; if (lx === 7) return 'clock'; return '';
    case RT.STORE: return r < .2 ? 'alarm' : '';
  }
  return '';
}
function faceDesc(x, y, night) {
  const { lx, ly, c } = local(x, y);
  const below = tileAt(x, y + 1);
  const d = { seed: ((x * 7919) ^ (y * 104729)) >>> 0, night, k: Math.floor(hash(x, y, 13) * POSTERS.length) };
  if (doorKind(x - 1, y) === 'h') d.jambL = true;
  if (doorKind(x + 1, y) === 'h') d.jambR = true;
  let decor = '';
  if (below === HALL || ly === 13) {
    const wing = WINGS[c.wing];
    if (hash(x, y, 15) < .72 && !d.jambL) {
      d.style = 'lockers'; d.locker = wing.locker;
      const n = 100 + ((((x * 2) % 800) + 800 + y * 13) % 800);
      d.nums = [String(n), String(n + 1)];
      d.ajar = [hash(x, y, 16) < (night ? .14 : .05), hash(x, y, 17) < (night ? .14 : .05)];
      d.eyes = [night && hash(x, y, 18) < .25, night && hash(x, y, 19) < .25];
      d.lock = [hash(x, y, 20) < .2, hash(x, y, 21) < .2];
    } else {
      Object.assign(d, { style: 'drywall', upper: '#eeece6', lower: '#2c4f8f', stripe: wing.stripe });
      const r = hash(x, y, 14);
      decor = r < .18 ? 'trophy' : r < .26 ? 'fountain' : r < .4 ? 'bulletin' : r < .7 ? 'poster' : r < .78 ? 'alarm' : r < .88 ? 'clock' : 'speaker';
    }
    if (d.jambL && ly === 13) { d.plate = true; d.plateX = 6; d.num = c.num; if (c.type === RT.BATH) d.icon = 'wc'; }
  } else {
    Object.assign(d, ROOM_WALL[c.type] || { style: 'block', upper: '#cfd3c3', lower: '#9aa58f', stripe: '#3a5c86' });
    if (ly === 3) decor = roomDecor(c, lx, x, y);
    if (decor === 'wallcab') { d.v = c.cx & 1; d.rail = hash(x, y, 24) < .4; }
  }
  if (decor.startsWith('board:')) {
    const kind = decor.slice(6), bk = CK(c.cx, c.cy) * 2 + (night ? 1 : 0);
    let b = boardCache.get(bk);
    if (!b) { b = boardCanvas(kind, (c.cx * 73856093) ^ (c.cy * 19349663), night); boardCache.set(bk, b); }
    d.decor = 'board'; d.board = b; d.seg = lx - 6;
  } else d.decor = decor;
  d.exit = !d.jambL && !d.jambR && hash(x, y, 11) < .035;
  d.ghost = night && hash(x, y, 23) < .3;
  return d;
}
function faceTile(x, y, night) {
  const k = K(x, y) * 2 + (night ? 1 : 0);
  let c = faceCache.get(k);
  if (c) return c;
  if (faceCache.size > 2400) faceCache.clear();
  const d = faceDesc(x, y, night);
  c = composeFace(d);
  c.decor = d.decor; c.exit = d.exit; c.style = d.style; c.eyes = d.eyes; c.ghost = d.ghost;
  faceCache.set(k, c);
  return c;
}
// ---------------------------------------------------------------- what the floors look like
const DECAL_SETS = {
  hall: ['paper', 'crumple', 'chalk', 'scuff', 'pencil', 'backpack', 'shoe', 'marble', 'stain', 'papers'],
  class: ['paper', 'papers', 'pencil', 'crumple', 'chalk', 'marble'],
  bath: ['puddle', 'puddle', 'paper', 'stain'],
  cafe: ['crumple', 'stain', 'paper', 'gum'],
  store: ['stain', 'papers', 'scuff', 'crumple'],
  other: ['paper', 'crumple', 'scuff', 'pencil']
};
function floorTile(x, y, t) {
  const k = K(x, y);
  let c = floorCache.get(k);
  if (c) return c;
  if (floorCache.size > 2600) floorCache.clear();
  const { lx, ly, c: cl } = local(x, y);
  const v = (hash(x, y, 3) * 3) | 0;
  let base = FLOORS[t][v];
  if (t === HALL && ((lx === 1 && ly >= 3) || (ly === 1 && lx >= 3) || (lx === 1 && ly === 1))) base = HALL_ACCENT[cl.wing][v];
  const set = t === HALL ? 'hall' : t === FLOOR0 + RT.CLASS ? 'class' : t === FLOOR0 + RT.BATH ? 'bath' : t === FLOOR0 + RT.CAFE ? 'cafe' : t === FLOOR0 + RT.STORE ? 'store' : 'other';
  const chance = { hall: .06, class: .09, bath: .14, cafe: .08, store: .1, other: .04 }[set];
  const decal = hash(x, y, 21) < chance ? DECAL_SETS[set][(hash(x, y, 22) * DECAL_SETS[set].length) | 0] : null;
  // the arrows on the walkway path: down the left-hand walkways, rightwards along the top ones
  const arrow = t === HALL && !(lx === 1 && ly === 1) && ((lx === 1 && ly >= 3 && ly % 3 === 0) || (ly === 1 && lx >= 3 && lx % 3 === 0)) ? (lx === 1 ? 2 : 1) : -1;
  const dk = doorKind(x, y);
  if (!decal && arrow < 0 && !dk) { floorCache.set(k, base); return base; }
  c = canvas(T, T, g => {
    g.drawImage(base, 0, 0);
    if (arrow >= 0) g.drawImage(ARROW[arrow], 0, 0);
    if (decal && arrow < 0) g.drawImage(DECAL[decal], 0, 0);
    if (dk === 'h') { rect(g, 0, T - 3, T, 3, '#8a8f8c'); rect(g, 0, T - 3, T, 1, '#b8bdb9'); }
    if (dk === 'v') { rect(g, T - 3, 0, 3, T, '#8a8f8c'); }
  });
  floorCache.set(k, c);
  return c;
}

// ---------------------------------------------------------------- ceiling lights (you only see the light they cast)
function fixtureAt(x, y) {
  const { lx, ly, c } = local(x, y);
  let on = false;
  if (lx < 3 || ly < 3) on = (lx === 1 && ly >= 3 && ly % 4 === 1) || (ly === 1 && lx >= 3 && lx % 4 === 1) || (lx === 1 && ly === 1);
  else on = (lx === 6 || lx === 10) && (ly === 6 || ly === 10);
  if (!on) return null;
  return { x, y, broken: hash(x, y, 51) < .14, phase: hash(x, y, 52) * 100, room: c.type };
}

// ---------------------------------------------------------------- questions the rest of the game asks
function roomAt(px, py) {
  const tx = Math.floor(px / T), ty = Math.floor(py / T), { lx, ly, c } = local(tx, ty);
  const hall = lx < 3 || ly < 3 || (c.type !== RT.COMMONS && (lx === 3 || lx === 13 || ly === 3 || ly === 13));
  return hall ? { hall: true, name: 'WALKWAY  ' + WINGS[c.wing].name, c } : { hall: false, name: ROOM_NAMES[c.type], num: c.num, c };
}
function nearestRoom(px, py, type, radius) {
  const pcx = Math.floor(px / T / B), pcy = Math.floor(py / T / B);
  let best = 1e9;
  for (let cy = pcy - radius; cy <= pcy + radius; cy++) for (let cx = pcx - radius; cx <= pcx + radius; cx++) {
    if (cell(cx, cy).type !== type) continue;
    const d = Math.hypot((cx * B + 8.5) * T - px, (cy * B + 8.5) * T - py);
    if (d < best) best = d;
  }
  return best;
}
function mapColor(x, y) {
  const t = tileAt(x, y);
  if (t === WALL) return doorKind(x, y) ? '#8a6a4a' : '#151618';
  const f = furn.get(K(x, y));
  if (f) return f.placed ? '#f2d24a' : '#6a5a48';
  if (doors.has(K(x, y))) return doors.get(K(x, y)).closed ? '#8a5a2e' : '#c8b898';
  if (t === HALL) return '#c4c2bb';
  return ['#c8a878', '#8d9196', '#d6cdbb', '#8a8a84', '#c2b9a5', '#cfd6d8', '#c86a5a', '#8a8c90', '#b8a88c', '#e0ccaa', '#a8c8b8', '#7a6250', '#7a5a3a'][t - FLOOR0];
}

// ---------------------------------------------------------------- saving and loading the changes
function serializeWorld() {
  const out = [];
  for (const [ck, m] of deltas) { const rows = []; for (const [k, e] of m) rows.push([k, e]); if (rows.length) out.push([ck, rows]); }
  return out;
}
function loadWorld(data) {
  resetWorld();
  for (const [ck, rows] of data || []) { const m = new Map(); for (const [k, e] of rows) m.set(k, e); deltas.set(ck, m); }
}
