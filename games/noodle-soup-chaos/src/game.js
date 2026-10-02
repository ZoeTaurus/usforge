'use strict';
// =====================================================================
//  Engine glue
// =====================================================================
const cvs = document.getElementById('game');
ctx = cvs.getContext('2d');
ctx.imageSmoothingEnabled = false;
const mouse = { x: -50, y: -50 };
let UI = [];
let scene = 'title';
let fadeT = 0;
let G = null;

const BEST_KEY = 'noodle-shop-chaos-best';
function getBest() { try { return +localStorage.getItem(BEST_KEY) || 0; } catch (e) { return 0; } }
function setBest(v) { try { if (v > getBest()) localStorage.setItem(BEST_KEY, v); } catch (e) { /* storage unavailable */ } }

// Immediate-mode button: drawn every frame, clickable until the next frame.
function btn(x, y, w, h, label, cb, o = {}) {
  const hov = inside(mouse, x, y, w, h);
  R(x + 1, y + h, w - 2, 1, '#00000080');
  panel(x, y - (hov ? 1 : 0), w, h, hov ? (o.hov || '#5a8ae0') : (o.col || '#3d6dc8'), OUT);
  R(x + 2, y + 1 - (hov ? 1 : 0), w - 4, 1, '#ffffff40');
  txtC(label, x + w / 2, y + fl((h - 5) / 2) - (hov ? 1 : 0), o.ink || '#ffffff');
  UI.push({ x, y, w, h, cb });
}

function tooltip(lines, ax, ay) {
  const w = Math.max(...lines.map(l => tw(l[0]))) + 6, h = lines.length * 7 + 3;
  let x = fl(mouse.x + 8), y = fl(mouse.y + 8);
  if (ax !== undefined) { x = clamp(fl(ax - w / 2), 1, W - w - 1); y = fl(ay - h); }
  if (x + w > W - 1) x = fl(mouse.x - w - 4);
  if (y + h > H - 1) y = fl(mouse.y - h - 4);
  x = Math.max(1, x); y = Math.max(1, y);
  panel(x, y, w, h, '#1b1226', '#f3e3c3');
  lines.forEach((l, i) => txt(l[0], x + 3, y + 3 + i * 7, l[1] || '#ffffff'));
}
const wrapLines = (s, w, col) => wrap(s, w).map(l => [l, col]);

// =====================================================================
//  Layout
// =====================================================================
const SLOT_X = [44, 104, 164, 224], SEAT_TOP = 58, WALK_Y = 74;
const POT_X = [20, 52, 84], POT_Y = 106;
const BOWL_X = [112, 137, 162], BOWL_Y = 110;
const TRASH = { x: 164, y: 127, w: 20, h: 20 };
const MAX_STAFF = 8, DAY_LEN = 100, DAYS = 7, COOK_T = 4.5, BURN_T = 8;
function binRect(i) { return { x: 195 + (i % 3) * 40, y: 92 + fl(i / 3) * 19, w: 39, h: 18 }; }
const staffX = i => 20 + i * 40;

// =====================================================================
//  Prerendered shop layers
// =====================================================================
let BACK = null, FRONT = null;
const BACK_WINDOWS = [];
function buildPlayLayers() {
  BACK = mkCanvas(W, H);
  withCtx(BACK, () => {
    srand(99);
    const fac = [[0, 58, 26, '#a8553a', '#8a4028', '#e74c3c'], [58, 124, 32, '#3f7f7a', '#2f625e', '#f1c40f'],
      [124, 190, 22, '#d8c39a', '#b8a37a', '#2e86de'], [190, 256, 30, '#6b4c8a', '#523a6b', '#2ecc71'], [256, 320, 24, '#c9773a', '#a85f2a', '#9b59b6']];
    for (const [x0, x1, top, c, d, aw] of fac) {
      R(x0, top, x1 - x0, 60 - top, c);
      R(x0, top, x1 - x0, 2, d); R(x0, top + 2, x1 - x0, 1, '#ffffff30');
      for (let wx = x0 + 5; wx < x1 - 8; wx += 12) {
        R(wx, top + 5, 7, 7, OUT); R(wx + 1, top + 6, 5, 5, '#9fd3e6'); R(wx + 1, top + 6, 5, 1, '#d9f1f8');
        if (srnd() < 0.4) R(wx + 1, top + 6, 2, 5, '#f5b7c5');
        if (srnd() < 0.3) { R(wx, top + 12, 7, 2, '#5a3a22'); R(wx + 1, top + 11, 1, 1, '#e84393'); R(wx + 4, top + 11, 1, 1, '#f1c40f'); }
        BACK_WINDOWS.push([wx + 1, top + 6]);
      }
      // striped awning over the ground-floor shops
      for (let ax = x0; ax < x1; ax += 4) { R(ax, 44, 2, 5, aw); R(ax + 2, 44, 2, 5, '#fffaf0'); }
      for (let ax = x0; ax < x1; ax += 4) R(ax + 1, 49, 2, 1, aw);
      R(x0, 43, x1 - x0, 1, d);
      R(x0 + 4, 51, x1 - x0 - 8, 9, '#3a2a2a'); R(x0 + 5, 52, x1 - x0 - 10, 2, '#5f8fa0');
    }
    // sidewalk
    R(0, 60, W, 16, '#bdb5aa'); R(0, 60, W, 2, '#8d867c');
    for (let x = 0; x < W; x += 10) R(x, 62, 1, 14, '#aaa196');
    R(0, 68, W, 1, '#aaa196');
    // street lamp & a little tree
    R(300, 26, 2, 42, '#2c2c3a'); R(296, 24, 10, 3, '#2c2c3a'); R(298, 27, 6, 2, '#fff4c2');
    R(12, 48, 3, 20, '#6b4423'); circ(13, 42, 7, '#2f8a4a'); circ(11, 40, 4, '#3fb05e');
  });

  FRONT = mkCanvas(W, H);
  withCtx(FRONT, () => {
    // shop window frame and noren curtain
    R(0, 11, W, 2, '#3d2016'); R(0, 11, 4, 66, '#5a3322'); R(316, 11, 4, 66, '#5a3322'); R(3, 11, 1, 66, '#3d2016'); R(316, 11, 1, 66, '#3d2016');
    for (let i = 0; i < 8; i++) { const x = 4 + i * 39; R(x, 13, 38, 7, '#b8322a'); R(x, 19, 38, 1, '#8e1f14'); R(x, 13, 1, 7, '#8e1f14'); }
    txtC('NOODLE  SHOP  CHAOS', 160, 14, '#fff5e6');
    // counter
    R(0, 76, W, 3, '#d79a5c'); R(0, 76, W, 1, '#f0b878'); R(0, 79, W, 9, '#9c5f30');
    for (let x = 8; x < W; x += 16) R(x, 79, 1, 9, '#7f4a22');
    R(0, 87, W, 1, '#5a3418');
    // kitchen floor tiles
    for (let y = 88; y < 150; y += 6) for (let x = 0; x < W; x += 6) R(x, y, 6, 6, ((x + y) / 6) & 1 ? '#e9dcc0' : '#dccdab');
    // stove
    R(3, 119, 100, 30, OUT); R(4, 120, 98, 4, '#2e2f38');
    for (let i = 0; i < 12; i++) R(8 + i * 8, 120, 1, 4, '#55576a');
    R(4, 124, 98, 24, '#4a4d5a'); R(4, 124, 98, 1, '#6a6d7a');
    R(14, 131, 78, 14, '#3a3c47'); R(15, 132, 76, 1, '#5a5d6a'); R(22, 134, 62, 7, '#1b1c22'); R(23, 135, 60, 1, '#2e3040');
    R(30, 128, 46, 2, '#c7c9d1');
    for (const kx of [8, 16, 88, 96]) { R(kx - 1, 126, 5, 5, OUT); R(kx, 127, 3, 3, '#c7c9d1'); R(kx + 1, 127, 1, 2, '#555'); }
    // the pass + trash
    R(105, 119, 84, 30, OUT); R(106, 120, 82, 4, '#c9ced6'); R(106, 120, 82, 1, '#eef1f5'); R(106, 124, 82, 24, '#8f96a3');
    R(140, 125, 1, 22, '#6a7180'); txt('PASS', 115, 130, '#3a3f4a'); R(113, 137, 22, 1, '#6a7180');
    for (const bx of BOWL_X) {
      const cx = bx + 9;
      R(cx, 88, 1, 4, '#333'); R(cx - 4, 91, 9, 4, OUT); R(cx - 3, 92, 7, 2, '#c0392b');
      dith(cx - 5, 96, 11, 16, '#ffb36b55');
    }
    const T = TRASH;
    R(T.x + 1, T.y + 3, 18, 17, OUT); R(T.x + 2, T.y + 4, 16, 15, '#5d6470');
    for (let i = 0; i < 3; i++) R(T.x + 5 + i * 5, T.y + 6, 1, 11, '#4a505a');
    R(T.x - 1, T.y, 22, 4, OUT); R(T.x, T.y + 1, 20, 2, '#7a828e'); R(T.x + 7, T.y - 2, 6, 2, OUT);
    // ingredient bins
    BIN_ORDER.forEach((k, i) => {
      const r = binRect(i);
      R(r.x - 1, r.y - 1, r.w + 2, r.h + 2, OUT); R(r.x, r.y, r.w, r.h, '#8b5a2b'); R(r.x, r.y, r.w, 2, '#b07a40');
      R(r.x + 1, r.y + r.h - 2, r.w - 2, 1, '#6b4423');
      panel(r.x + 2, r.y + 3, 12, 12, '#f3e3c3', '#5a3418'); drawIcon(k, r.x + 3, r.y + 4);
      txt(ING[k].name, r.x + 16, r.y + 4, '#fff1d6');
    });
    // staff floor
    R(0, 150, W, 30, '#6b4428');
    for (let y = 155; y < 180; y += 5) R(0, y, W, 1, '#5a3820');
    for (let y = 150, o = 0; y < 180; y += 5, o += 13) for (let x = o % 37; x < W; x += 37) R(x, y, 1, 5, '#5a3820');
    R(0, 150, W, 2, '#3e2616');
  });
}

// =====================================================================
//  Game state
// =====================================================================
function newGame() {
  G = { day: 1, coins: 10, rep: 60, staff: [], hired: {}, friends: [], bonus: 0, served: 0, earned: 0 };
  startDay();
}
const mkPot = () => ({ n: null, b: null, st: 'empty', t: 0 });

function startDay() {
  Object.assign(G, {
    t: 0, closing: false, closeT: 0, customers: [], boxes: [], coinsC: [], parts: [], pops: [], banners: [], timers: [], flyers: [],
    spawnT: 3, boxT: 2, emerT: 0, chaos: 0, eventCool: 15, chatT: 5, darkT: 0, danceT: 0, shake: 0, paused: false,
    pots: [mkPot(), mkPot(), mkPot()], bowls: [null, null, null], held: null, stock: {},
    ds: { served: 0, earned: 0, angry: 0, wrong: 0, hired: [] }, sched: buildSched(G.day),
  });
  BIN_ORDER.forEach(k => G.stock[k] = 6);
  G.staff.forEach(s => { s.cd = rand(1, 3); s.pause = 0; s.bubT = 0; s.jump = 0; });
  banner('DAY ' + G.day, DAY_SUBS[G.day - 1]);
}

// Which special characters show up today, and when.
function buildSched(d) {
  const s = [];
  const intro = CAST.filter(c => c.day === d && !G.hired[c.id]);
  const times = [0.06, 0.3, 0.55, 0.75];
  intro.forEach((c, i) => s.push({ id: c.id, at: times[i % 4] * DAY_LEN + rand(0, 4), done: false }));
  const back = shuffle(CAST.filter(c => c.day < d && !G.hired[c.id])).slice(0, d >= 7 ? 6 : 3);
  back.forEach(c => s.push({ id: c.id, at: rand(0.15, 0.85) * DAY_LEN, done: false }));
  return s;
}

// ---------- small helpers ----------
const hasAb = ab => G.staff.some(s => s.ch.ability === ab);
const staffOf = ab => G.staff.find(s => s.ch.ability === ab && s.pause <= 0 && G.danceT <= 0);
const staffById = id => G.staff.find(s => s.ch.id === id);
const hasId = id => !!G.hired[id];
function pop(x, y, text, c = '#ffffff') { G.pops.push({ x, y, text, c, t: 0 }); }
function banner(title, sub) { G.banners.push({ title, sub, t: 0 }); }
function later(d, fn) { G.timers.push({ t: d, fn }); }
function addRep(v) { if (v > 0 && hasAb('hype')) v *= 2; G.rep = clamp(G.rep + v, 0, 100); }
function charm() { let c = G.bonus; for (const s of G.staff) c += s.ch.charm; for (const f of G.friends) c += f.charm; return c; }
function burst(x, y, n, cols, sp = 40, g = 60, life = 0.8) {
  for (let i = 0; i < n; i++) G.parts.push({ x, y, vx: rand(-sp, sp), vy: rand(-sp * 1.2, sp * 0.3), g, life: rand(life * 0.6, life), t: 0, c: pick(cols), s: pick([1, 1, 2]) });
}
function zap(s, tx, ty, c) {
  const i = G.staff.indexOf(s); if (i < 0) return;
  const sx = staffX(i), sy = 160;
  for (let k = 0; k <= 10; k++) { const u = k / 10; G.parts.push({ x: lerp(sx, tx, u), y: lerp(sy, ty, u) - Math.sin(u * Math.PI) * 10, vx: 0, vy: -4, g: 0, life: 0.25 + u * 0.25, t: 0, c, s: 1 }); }
  s.jump = 0.3;
}
function staffSay(s, text, d = 2.4) { s.bub = text; s.bubT = d; }
function say(c, text, d = 2.2) { c.bub = text; c.bubT = d; }
function pool() { const d = G.day; return { n: d >= 2 ? CATS.n : ['ramen', 'udon'], b: d >= 3 ? CATS.b : ['shoyu', 'miso'], t: d >= 2 ? CATS.t : ['egg', 'pork'] }; }
function inPool(k) { return pool()[ING[k].cat].includes(k); }
function makeOrder() { const p = pool(); return { n: pick(p.n), b: pick(p.b), t: pick(p.t) }; }
const orderText = o => ING[o.n].name + ' + ' + ING[o.b].name + ' + ' + ING[o.t].name;
const sameOrder = (a, b) => a.n === b.n && a.b === b.b && a.t === b.t;

// ---------- customers ----------
const activeCust = c => c.state !== 'leaving' && c.state !== 'abducted';
function freeSlots() { return [0, 1, 2, 3].filter(i => !G.customers.some(c => c.slot === i && activeCust(c))); }
function spawnInterval() { let b = Math.max(3.4, 9 - G.day * 0.8); if (hasAb('mascot')) b *= 0.85; if (hasAb('hype')) b *= 0.85; return b * rand(0.8, 1.2); }

function spawnCustomer(ch) {
  const fs = freeSlots(); if (!fs.length) return false;
  const slot = pick(fs);
  const fromLeft = SLOT_X[slot] < 140 ? Math.random() < 0.8 : Math.random() < 0.2;
  let pm = Math.max(24, 46 - G.day * 3);
  if (hasAb('noburn')) pm *= 1.15;
  if (ch.id === 'snoot') pm *= 0.8; if (ch.id === 'nana') pm *= 1.4; if (ch.id === 'gary') pm *= 1.6;
  G.customers.push({ ch, slot, x: fromLeft ? -12 : W + 12, y: WALK_Y, tx: SLOT_X[slot], dir: fromLeft ? 1 : -1, state: 'walkin',
    order: makeOrder(), pat: 1, patMax: pm, t: rand(0, 2), bub: null, bubT: 0, frog: false, mood: 'ok', offer: false, ti: 0,
    seatY: SEAT_TOP + charHeight(ch, false) });
  return true;
}
function leave(c) { c.state = 'leaving'; c.dir = c.x < 160 ? -1 : 1; }
function angryLeave(c) {
  c.mood = 'angry'; say(c, c.frog ? 'RIBBIT!!' : pick(c.ch.say.angry), 2); leave(c);
  G.ds.angry++; G.chaos += 8; sfx.angry();
  const ken = staffOf('bouncer');
  if (ken) { addRep(-4); pop(c.x, 46, 'KEN HUGGED THEM', '#ffd36b'); zap(ken, c.x, 62, '#ffd36b'); }
  else { addRep(-10); pop(c.x, 46, '-10 REP', '#ff4d6d'); }
}

function serve(c, bowl) {
  const ok = sameOrder(bowl, c.order);
  c.state = 'eating'; c.ti = 1.6;
  let coins;
  if (ok) {
    coins = 8 + Math.round(c.pat * 8);
    if (hasAb('cashier')) coins += 2;
    if (hasAb('mascot')) coins += 1;
    if (c.frog) coins *= 2;
    addRep(c.pat > 0.6 ? 3 : 2); G.ds.served++; G.served++;
    c.mood = 'happy'; say(c, c.frog ? 'RIBBIT! (YUM)' : pick(c.ch.say.happy), 1.6);
    sfx.good(); burst(c.x, 60, 10, ['#ffd36b', '#ff9ad5', '#ffffff'], 30, 40, 0.7);
    if (c.ch.unique && !G.hired[c.ch.id]) {
      if (c.ch.picky && c.pat < 0.5) { say(c, 'ONE STAR. TOO SLOW.', 2.2); }
      else c.offer = true;
    }
  } else {
    coins = 3; addRep(-4); G.ds.wrong++; G.chaos += 5;
    c.mood = 'sad'; say(c, c.ch.unique ? pick(['THIS IS NOT MINE.', 'WRONG BOWL!']) : pick(GEN_SAY.wrong), 1.8); sfx.bad();
    if (c.ch.anyBowl && !G.hired[c.ch.id]) { c.offer = true; c.mood = 'happy'; say(c, 'COO! (ANY BOWL IS FINE)', 1.8); }
  }
  dropCoins(c.x, coins);
}

function hire(c) {
  const ch = c.ch;
  if (c.state !== 'hire') return;
  if (G.coins < ch.cost) { pop(c.x, 30, 'NEED $' + ch.cost, '#ff6b6b'); sfx.error(); return; }
  if (G.staff.length >= MAX_STAFF) { pop(c.x, 24, 'CREW FULL! SAY BYE TO SOMEONE', '#ff9ad5'); sfx.error(); return; }
  G.coins -= ch.cost; G.hired[ch.id] = true;
  G.staff.push({ ch, cd: 2, pause: 0, bub: ch.say.hire, bubT: 3.2, jump: 0.6 });
  G.ds.hired.push(ch.id);
  c.dead = true;
  burst(c.x, 60, 28, ['#ffd36b', '#ff9ad5', '#7dff9a', '#7fd1ff'], 60, 80, 1.2);
  const si = G.staff.length - 1; burst(staffX(si), 160, 18, ['#ffd36b', '#ff9ad5', '#ffffff'], 40, 60, 1);
  sfx.hire();
  banner(ch.name + ' JOINED THE CREW!', 'NEW ' + ch.role + ': ' + ch.desc);
  for (const f of SYNERGIES) if (!G.friends.includes(f) && G.hired[f.a] && G.hired[f.b]) { G.friends.push(f); banner('FRIENDSHIP!', f.text + '. CHARM +' + f.charm); }
}

function letGo(s) {
  const i = G.staff.indexOf(s); if (i < 0) return;
  G.staff.splice(i, 1); delete G.hired[s.ch.id];
  G.friends = G.friends.filter(f => f.a !== s.ch.id && f.b !== s.ch.id);
  burst(staffX(i), 164, 16, ['#ffffff', '#7fd1ff', '#ff9ad5'], 30, -10, 1);
  banner(s.ch.name + ' MOVED ON', pick(['OFF TO FOLLOW THEIR DREAMS. THEY MIGHT VISIT.', 'THEY LEFT A THANK-YOU NOTE. AND A NAPKIN.', 'THE CREW WILL MISS THEM. A LOT.']));
  sfx.bad();
}

// ---------- coins ----------
function dropCoins(x, amt) { G.coinsC.push({ x: clamp(x + rand(-5, 5), 8, W - 8), y: 68, vy: -40, amt, t: 0 }); }
function collect(c) {
  if (c.dead) return;
  c.dead = true; G.coins += c.amt; G.ds.earned += c.amt; G.earned += c.amt;
  pop(c.x, c.y - 8, '+$' + c.amt, '#ffd36b'); sfx.coin();
}

// ---------- supply crates ----------
function spawnBox(kind) { G.boxes.push({ x: W + 8, y: rand(20, 34), vx: -rand(55, 85), vy: -rand(8, 22), kind, t: 0 }); }
function boxKind() {
  const ks = BIN_ORDER.filter(inPool); let tot = 0;
  const w = ks.map(k => { const v = Math.pow(Math.max(0, 10 - G.stock[k]), 2) + 1; tot += v; return v; });
  let r = Math.random() * tot;
  for (let i = 0; i < ks.length; i++) { r -= w[i]; if (r <= 0) return ks[i]; }
  return ks[0];
}
function catchBox(b, s) {
  if (b.dead) return;
  b.dead = true;
  const add = 3 + (hasAb('supply') ? 1 : 0);
  const r = binRect(BIN_ORDER.indexOf(b.kind));
  G.flyers.push({ kind: b.kind, x0: b.x, y0: b.y, x1: r.x + 3, y1: r.y + 4, t: 0, dur: 0.35, done: () => {
    G.stock[b.kind] = Math.min(9, G.stock[b.kind] + add);
    pop(r.x + 20, r.y + 2, '+' + add, '#7dff9a');
  } });
  sfx.catch(); burst(b.x + 6, b.y + 6, 8, ['#ffffff', '#ffd36b'], 25, 20, 0.4);
  if (s) zap(s, b.x + 6, b.y + 6, '#44ffff');
}
function drawCrate(x, y, kind) {
  x = fl(x); y = fl(y);
  R(x, y, 12, 12, OUT); R(x + 1, y + 1, 10, 10, '#b07a40'); R(x + 1, y + 1, 10, 1, '#d49a5a');
  R(x + 1, y + 6, 10, 1, '#8b5a2b');
  drawIcon(kind, x + 1, y + 1);
}

// ---------- cooking ----------
function useBin(i) {
  const k = BIN_ORDER[i], r = binRect(i);
  if (!inPool(k)) { pop(r.x + 20, r.y, 'NOT ON THE MENU YET', '#cccccc'); sfx.error(); return; }
  if (G.stock[k] <= 0) { pop(r.x + 20, r.y, 'OUT OF ' + ING[k].name + '!', '#ff6b6b'); sfx.error(); return; }
  const cat = ING[k].cat;
  if (cat === 't') {
    let target = null, tx = 0, ty = 0;
    if (G.held && !G.held.bowl.t) { target = G.held.bowl; tx = mouse.x; ty = mouse.y; }
    else { const bi = G.bowls.findIndex(b => b && !b.t); if (bi >= 0) { target = G.bowls[bi]; tx = BOWL_X[bi] + 4; ty = BOWL_Y - 4; } }
    if (!target) { pop(r.x + 20, r.y, 'NO BOWL TO TOP!', '#ffb3b3'); sfx.error(); return; }
    target.t = k; G.stock[k]--; sfx.add();
    G.flyers.push({ kind: k, x0: r.x + 3, y0: r.y + 4, x1: tx, y1: ty, t: 0, dur: 0.2 });
    return;
  }
  let idx = G.pots.findIndex(p => p.st === 'fill' && !p[cat]);
  if (idx < 0) idx = G.pots.findIndex(p => p.st === 'empty');
  if (idx < 0) { pop(r.x + 20, r.y, 'ALL POTS BUSY!', '#ffb3b3'); sfx.error(); return; }
  const p = G.pots[idx];
  p[cat] = k; p.st = 'fill'; G.stock[k]--; sfx.add();
  G.flyers.push({ kind: k, x0: r.x + 3, y0: r.y + 4, x1: POT_X[idx] - 5, y1: POT_Y - 8, t: 0, dur: 0.25 });
  if (p.n && p.b) { p.st = 'cook'; p.t = 0; }
}
function pourPot(i, manual) {
  const p = G.pots[i];
  const bi = G.bowls.findIndex(b => !b);
  if (bi < 0) { if (manual) { pop(POT_X[i], POT_Y - 14, 'PASS IS FULL!', '#ffb3b3'); sfx.error(); } return false; }
  G.bowls[bi] = { n: p.n, b: p.b, t: null };
  G.pots[i] = mkPot(); sfx.pour();
  burst(BOWL_X[bi] + 9, BOWL_Y, 6, ['#ffffff', '#fff4e6'], 15, -20, 0.6);
  return true;
}
function clickPot(i) {
  const p = G.pots[i];
  if (p.st === 'ready') pourPot(i, true);
  else if (p.st === 'burnt' || p.st === 'fill') { G.pots[i] = mkPot(); sfx.trash(); pop(POT_X[i], POT_Y - 14, p.st === 'burnt' ? 'DUMPED' : 'EMPTIED', '#dddddd'); }
  else if (p.st === 'cook') pop(POT_X[i], POT_Y - 14, 'STILL COOKING...', '#ffffff');
  else pop(POT_X[i], POT_Y - 14, 'ADD NOODLES + BROTH', '#ffffff');
}
function returnHeld() {
  if (!G.held) return;
  let bi = G.bowls[G.held.from] ? -1 : G.held.from;
  if (bi < 0) bi = G.bowls.findIndex(b => !b);
  if (bi >= 0) G.bowls[bi] = G.held.bowl; else { pop(mouse.x, mouse.y, 'NO ROOM. TOSSED.', '#cccccc'); sfx.trash(); }
  G.held = null;
}
function clickBowlSlot(bi) {
  if (G.held) {
    if (!G.bowls[bi]) { G.bowls[bi] = G.held.bowl; G.held = null; }
    else { const tmp = G.bowls[bi]; G.bowls[bi] = G.held.bowl; G.held = { bowl: tmp, from: bi }; }
    sfx.click(); return;
  }
  if (G.bowls[bi]) { G.held = { bowl: G.bowls[bi], from: bi }; G.bowls[bi] = null; sfx.click(); }
}
function serveSlot(slot) {
  const c = G.customers.find(c => c.slot === slot && c.state === 'waiting');
  if (c && G.held) { serve(c, G.held.bowl); G.held = null; }
}

// ---------- hit tests ----------
const potAt = m => [0, 1, 2].find(i => inside(m, POT_X[i] - 15, POT_Y - 12, 30, 30)) ?? -1;
const bowlAt = m => [0, 1, 2].find(i => inside(m, BOWL_X[i] - 3, BOWL_Y - 7, 24, 18)) ?? -1;
const binAt = m => { for (let i = 0; i < 9; i++) { const r = binRect(i); if (inside(m, r.x, r.y, r.w, r.h)) return i; } return -1; };
const custAt = m => G.customers.find(c => activeCust(c) && c.state !== 'walkin' && inside(m, c.x - 12, 33, 24, 43));
const staffAt = m => { for (let i = 0; i < G.staff.length; i++) if (inside(m, staffX(i) - 12, 150, 24, 30)) return G.staff[i]; return null; };

// =====================================================================
//  Staff behaviour
// =====================================================================
const potKey = o => o.n + '|' + o.b;
function chefAct(s) {
  const waiting = G.customers.filter(c => c.state === 'waiting' || c.state === 'walkin').sort((a, b) => a.pat - b.pat);
  const supply = {}, need = {};
  const add = k => supply[k] = (supply[k] || 0) + 1;
  for (const p of G.pots) if (p.n && p.b && p.st !== 'burnt') add(potKey(p));
  for (const b of G.bowls) if (b) add(potKey(b));
  if (G.held) add(potKey(G.held.bowl));
  for (const c of waiting) {
    const k = potKey(c.order);
    need[k] = (need[k] || 0) + 1;
    if (need[k] <= (supply[k] || 0)) continue;
    const pi = G.pots.findIndex(p => p.st === 'empty');
    if (pi < 0) return;
    if (G.stock[c.order.n] <= 0 || G.stock[c.order.b] <= 0) continue;
    if (Math.random() < 0.12) { staffSay(s, pick(["I'M ON BREAK.", '*SIGH*', 'MUST I?']), 1.6); s.cd = 2; return; }
    G.stock[c.order.n]--; G.stock[c.order.b]--;
    Object.assign(G.pots[pi], { n: c.order.n, b: c.order.b, st: 'cook', t: 0 });
    zap(s, POT_X[pi], POT_Y, '#ffd36b');
    if (Math.random() < 0.3) staffSay(s, pick(['...FINE.', 'BEHOLD. NOODLES.', 'ADEQUATE.']), 1.5);
    return;
  }
}
function topperAct(s) {
  for (let i = 0; i < 3; i++) {
    const b = G.bowls[i]; if (!b || b.t) continue;
    const cands = G.customers.filter(c => (c.state === 'waiting' || c.state === 'walkin') && c.order.n === b.n && c.order.b === b.b).sort((a, z) => a.pat - z.pat);
    let target = null;
    for (const c of cands) {
      const k = c.order;
      const have = G.bowls.filter(x => x && sameOrder(x, k)).length + (G.held && sameOrder(G.held.bowl, k) ? 1 : 0);
      const want = cands.filter(d => d.order.t === k.t).length;
      if (have < want) { target = c; break; }
    }
    if (!target) continue;
    let k = target.order.t, oops = false;
    if (Math.random() < 0.1) { k = pick(CATS.t.filter(x => x !== k)); oops = true; }
    if (G.stock[k] <= 0) continue;
    G.stock[k]--; b.t = k; zap(s, BOWL_X[i] + 9, BOWL_Y, '#7dff9a');
    if (oops) staffSay(s, 'OOPS. SURPRISE TOPPING!', 1.8);
    return;
  }
}
function runnerAct(s) {
  for (let i = 0; i < 3; i++) {
    const b = G.bowls[i]; if (!b || !b.t) continue;
    const c = G.customers.filter(c => c.state === 'waiting' && sameOrder(c.order, b)).sort((a, z) => a.pat - z.pat)[0];
    if (!c) continue;
    G.bowls[i] = null; zap(s, c.x, 62, '#ffd36b'); serve(c, b);
    if (Math.random() < 0.1 && G.coins > 0) { G.coins--; staffSay(s, '(POCKETS $1. FOR THE BIKE.)', 2); }
    return;
  }
}
function pourerAct(s) {
  const i = G.pots.findIndex(p => p.st === 'ready');
  if (i >= 0 && pourPot(i, false)) zap(s, POT_X[i], POT_Y, '#7bed9f');
}
function magicAct(s) {
  const ks = BIN_ORDER.filter(inPool).sort((a, b) => G.stock[a] - G.stock[b]);
  const k = ks[0], r = binRect(BIN_ORDER.indexOf(k));
  G.stock[k] = Math.min(9, G.stock[k] + 3);
  zap(s, r.x + 20, r.y + 9, '#c9a0ff'); pop(r.x + 20, r.y + 2, 'POOF! +3', '#c9a0ff'); sfx.magic();
  burst(r.x + 8, r.y + 9, 12, ['#c9a0ff', '#ffe066', '#ffffff'], 30, 0, 0.8);
  if (Math.random() < 0.25) {
    const cs = G.customers.filter(c => c.state === 'waiting' && !c.frog && !c.ch.unique);
    if (cs.length) {
      const c = pick(cs); c.frog = true; c.seatY = SEAT_TOP + 9;
      burst(c.x, 62, 16, ['#c9a0ff', '#5cb85c', '#ffffff'], 40, 20, 0.8);
      say(c, 'RIBBIT?!', 2); staffSay(s, 'OOPS. WRONG SPELL.', 2);
    }
  }
}

function updateStaff(dt) {
  for (const s of G.staff) {
    if (s.jump > 0) s.jump -= dt;
    if (s.bubT > 0) s.bubT -= dt;
    if (s.pause > 0) { s.pause -= dt; continue; }
    s.cd -= dt;
    if (G.danceT > 0 || G.closing || s.cd > 0) continue;
    switch (s.ch.ability) {
      case 'chef': s.cd = 3.4; chefAct(s); break;
      case 'topper': s.cd = 1.8; topperAct(s); break;
      case 'pourer': s.cd = 0.9; pourerAct(s); break;
      case 'runner': s.cd = 1.6; runnerAct(s); break;
      case 'magic': s.cd = 14; magicAct(s); break;
      default: s.cd = 999;
    }
  }
  G.chatT -= dt;
  if (G.chatT <= 0 && G.staff.length) {
    G.chatT = rand(4, 9);
    const s = pick(G.staff);
    if (s.bubT <= 0) {
      const f = G.friends.filter(f => f.a === s.ch.id || f.b === s.ch.id);
      if (f.length && Math.random() < 0.25) {
        const fr = pick(f), other = CAST_BY_ID[fr.a === s.ch.id ? fr.b : fr.a];
        staffSay(s, pick(['I LOVE YOU, ', 'HI ', 'NICE WORK, ', 'HIGH FIVE, ']) + other.name.split(' ').pop() + '!', 2.4);
      } else staffSay(s, pick(s.ch.say.staff), 2.6);
    }
  }
}

// =====================================================================
//  Chaos events
// =====================================================================
const waitingCust = () => G.customers.filter(c => c.state === 'waiting');
const cheer = v => waitingCust().forEach(c => c.pat = Math.min(1, c.pat + v));
function confetti(n = 40) { for (let i = 0; i < n; i++) G.parts.push({ x: rand(0, W), y: rand(-10, 20), vx: rand(-10, 10), vy: rand(10, 40), g: 20, life: rand(1.5, 2.5), t: 0, c: pick(['#ffd36b', '#ff9ad5', '#7dff9a', '#7fd1ff', '#ffffff', '#ff6b6b']), s: 2 }); }
const EVENTS = [
  { w: 3, ok: () => true, run() { banner('RUSH HOUR!', 'EVERYONE IS HUNGRY AT ONCE!'); for (let i = 0; i < 4; i++) later(i * 0.5, () => spawnCustomer(genericChar())); } },
  { w: 3, ok: () => true, run() { banner('SUPPLY AVALANCHE!', 'CATCH THE CRATES!'); for (let i = 0; i < 6; i++) later(i * 0.4, () => spawnBox(boxKind())); } },
  { w: 2, ok: () => G.staff.length >= 2, run() { banner('DANCE PARTY!', "THE CREW CAN'T STOP GROOVING. CUSTOMERS LOVE IT."); G.danceT = 5; cheer(0.3); confetti(50); } },
  { w: 2, ok: () => true, run() { banner('POWER OUTAGE!', 'THE STOVES ARE OFF. FIND YOUR WAY IN THE DARK!'); G.darkT = 6; } },
  { w: 4, ok: () => hasId('grumble') && hasId('snoot'), run() {
    banner('THE GREAT BROTH DEBATE', 'GRUMBLE VS SNOOT. NOBODY WINS.');
    const a = staffById('grumble'), b = staffById('snoot'); a.pause = 6; b.pause = 6;
    staffSay(a, 'MISO IS FOR AMATEURS!', 2.5); later(1.5, () => staffSay(b, 'HOW DARE YOU.', 2.5));
    later(6.3, () => { banner('THEY HUGGED IT OUT', 'CHARM +2'); G.bonus += 2; });
  } },
  { w: 4, ok: () => hasId('whiskers'), run() {
    const i = G.bowls.findIndex(b => b);
    if (i >= 0) { G.bowls[i] = null; burst(BOWL_X[i] + 9, BOWL_Y + 4, 14, ['#efe8da', '#c0392b', '#f6d55c'], 40, 120, 0.8); sfx.splat(); }
    banner('SIR WHISKERS STRIKES', i >= 0 ? 'HE KNOCKED A BOWL OFF THE PASS. CUSTOMERS: AWWW.' : 'HE IS JUDGING YOU FROM THE COUNTER. AWWW.'); cheer(0.2);
  } },
  { w: 4, ok: () => hasId('gary'), run() { G.stock.pork = Math.max(0, G.stock.pork - 2); G.bonus += 1; banner('PIGEON HEIST!', 'GARY STOLE 2 PORK. HE IS SO PROUD. CHARM +1'); } },
  { w: 4, ok: () => hasId('grimble'), run() {
    BIN_ORDER.forEach(k => G.stock[k] = Math.min(9, G.stock[k] + 2)); sfx.magic();
    banner('GRIMBLE SNEEZED!', 'EVERY BIN MAGICALLY REFILLED. ALSO: GLITTER.');
    for (let i = 0; i < 9; i++) { const r = binRect(i); burst(r.x + 20, r.y + 9, 6, ['#c9a0ff', '#ffe066', '#ffffff'], 30, 10, 1); }
  } },
  { w: 4, ok: () => hasId('boris') && G.pots.some(p => p.st === 'cook'), run() {
    G.pots.forEach(p => { if (p.st === 'cook') { p.st = 'ready'; p.t = 0; } }); sfx.ding();
    banner('BOO-RIS POSSESSED THE POTS', 'EVERYTHING IS INSTANTLY COOKED. SPOOKY.');
  } },
  { w: 3, ok: () => hasId('timmy'), run() { G.bonus += 1; confetti(40); banner('NAPKIN FORT!', 'TIMMY BUILT A FORT OUT OF 400 NAPKINS. CHARM +1'); } },
  { w: 3, ok: () => hasId('marcel'), run() { staffById('marcel').pause = 8; cheer(0.25); banner('INVISIBLE BOX', 'MARCEL IS TRAPPED. CUSTOMERS ARE ENTRANCED.'); } },
  { w: 3, ok: () => hasId('zorp') && waitingCust().some(c => !c.ch.unique), run() {
    const c = pick(waitingCust().filter(c => !c.ch.unique)); c.state = 'abducted'; G.coins += 15; G.ds.earned += 15;
    banner('ABDUCTION!', 'ZORP BEAMED UP A CUSTOMER. THEY PAID FIRST. +$15');
  } },
  { w: 3, ok: () => hasId('kaylee'), run() { addRep(3); banner('KAYLEE WENT LIVE!', 'FANS INCOMING! REP UP!'); for (let i = 0; i < 3; i++) later(i * 0.6, () => spawnCustomer(genericChar())); } },
  { w: 3, ok: () => hasId('beard'), run() { cheer(1); staffSay(staffById('beard'), 'YO HO HOOOO!', 3); banner('SEA SHANTY!', 'EVERYONE SINGS ALONG. PATIENCE RESTORED.'); } },
  { w: 3, ok: () => hasId('ken'), run() { G.shake = 0.6; G.boxes.forEach(b => catchBox(b, null)); banner('BIG KEN STOMPED', 'EVERY FLYING CRATE FELL RIGHT INTO PLACE.'); } },
  { w: 3, ok: () => hasId('nana'), run() { addRep(5); cheer(1); banner('NANA BROUGHT SNACKS', 'FOR EVERYONE. REP +5'); } },
  { w: 3, ok: () => hasId('beep'), run() { staffById('beep').pause = 7; banner('B33P-0 IS UPDATING', 'INSTALLING UPDATE 1 OF 847...'); } },
  { w: 3, ok: () => hasId('zoomie'), run() { G.bonus += 1; banner('SICK KICKFLIP!', 'ZOOMIE JUMPED THE COUNTER. CHARM +1'); confetti(20); } },
  { w: 3, ok: () => hasId('whiskers') && hasId('gary'), run() { G.shake = 0.5; G.bonus += 1; banner('CHASE SCENE!', 'WHISKERS CHASED GARY AROUND THE KITCHEN. CHARM +1'); } },
  { w: 2, ok: () => !hasId('nana') && G.pots.some(p => p.st === 'cook' || p.st === 'ready'), run() {
    G.pots.forEach(p => { if (p.st === 'cook' || p.st === 'ready') { p.st = 'burnt'; p.t = 0; } });
    G.shake = 0.4; sfx.burn(); banner('GREASE FIRE!', 'THE POTS ARE TOAST. CLICK THEM TO DUMP.');
  } },
];
function chaosEvent() {
  const ok = EVENTS.filter(e => e.ok());
  let tot = ok.reduce((a, e) => a + e.w, 0), r = Math.random() * tot;
  for (const e of ok) { r -= e.w; if (r <= 0) { sfx.event(); G.shake = Math.max(G.shake, 0.25); e.run(); return; } }
}

// =====================================================================
//  Update
// =====================================================================
function updatePlay(dt) {
  if (!G.closing) G.t += dt;
  if (G.darkT > 0) G.darkT -= dt;
  if (G.danceT > 0) G.danceT -= dt;
  if (G.shake > 0) G.shake -= dt;
  if (G.eventCool > 0) G.eventCool -= dt;

  for (const tm of G.timers) { tm.t -= dt; if (tm.t <= 0 && !tm.fired) { tm.fired = true; tm.fn(); } }
  G.timers = G.timers.filter(t => !t.fired);

  // arrivals
  if (!G.closing) {
    for (const s of G.sched) {
      if (s.done || G.t < s.at) continue;
      if (G.hired[s.id]) { s.done = true; continue; }
      if (G.customers.some(c => c.ch.id === s.id)) continue;
      if (spawnCustomer(CAST_BY_ID[s.id])) s.done = true;
    }
    G.spawnT -= dt;
    if (G.spawnT <= 0) { G.spawnT = spawnInterval(); spawnCustomer(genericChar()); }
    G.boxT -= dt;
    if (G.boxT <= 0) { G.boxT = spawnInterval() * 0.8 * (hasAb('supply') ? 0.7 : 1); spawnBox(boxKind()); }
    G.emerT -= dt;
    if (G.emerT <= 0) {
      const empty = BIN_ORDER.filter(k => inPool(k) && G.stock[k] === 0 && !G.boxes.some(b => b.kind === k));
      if (empty.length) { spawnBox(empty[0]); G.emerT = 3; }
    }
  }

  // customers
  let drain = hasAb('entertain') ? 0.65 : 1;
  if (G.danceT > 0 || G.closing) drain = 0;
  for (const c of G.customers) {
    c.t += dt; if (c.bubT > 0) c.bubT -= dt;
    switch (c.state) {
      case 'walkin': {
        const d = c.tx - c.x, sp = 45 * dt;
        if (Math.abs(d) <= sp) { c.x = c.tx; c.state = 'waiting'; say(c, c.frog ? 'RIBBIT.' : pick(c.ch.say.order), 2.2); sfx.bell(); }
        else { c.x += Math.sign(d) * sp; c.dir = Math.sign(d); }
        break;
      }
      case 'waiting':
        c.y += (c.seatY - c.y) * Math.min(1, dt * 10);
        c.pat -= dt / c.patMax * drain;
        if (c.pat <= 0) angryLeave(c);
        break;
      case 'eating':
        c.ti -= dt;
        if (c.ti <= 0) {
          if (c.offer) { c.state = 'hire'; c.ti = 7; say(c, c.ch.say.hire, 3); sfx.bell(); }
          else leave(c);
        }
        break;
      case 'hire':
        c.ti -= dt;
        if (c.ti <= 0) { say(c, c.ch.id === 'snoot' ? 'YOUR LOSS.' : 'MAYBE NEXT TIME.', 2); leave(c); }
        break;
      case 'leaving':
        c.y += (WALK_Y - c.y) * Math.min(1, dt * 10);
        c.x += c.dir * 55 * dt;
        if (c.x < -24 || c.x > W + 24) c.dead = true;
        break;
      case 'abducted':
        c.y -= 30 * dt; if (c.y < -30) c.dead = true;
        break;
    }
  }
  G.customers = G.customers.filter(c => !c.dead);

  // pots
  G.pots.forEach((p, i) => {
    const px = POT_X[i];
    if (p.st === 'cook') {
      if (G.darkT <= 0) p.t += dt * (hasAb('haste') ? 1.6 : 1);
      if (p.t >= COOK_T) { p.st = 'ready'; p.t = 0; sfx.ding(); }
      if (Math.random() < dt * 4) G.parts.push({ x: px + rand(-8, 8), y: POT_Y - 3, vx: rand(-3, 3), vy: -14, g: 0, life: 1, t: 0, c: '#ffffff', s: 1 });
    } else if (p.st === 'ready') {
      if (!hasAb('noburn')) {
        p.t += dt;
        if (p.t >= BURN_T) { p.st = 'burnt'; p.t = 0; G.chaos += 10; sfx.burn(); pop(px, POT_Y - 14, 'BURNT!', '#ff4d4d'); }
      }
      if (Math.random() < dt * 8) G.parts.push({ x: px + rand(-8, 8), y: POT_Y - 3, vx: rand(-3, 3), vy: -18, g: 0, life: 1.2, t: 0, c: '#fff4e6', s: 2 });
    } else if (p.st === 'burnt') {
      if (Math.random() < dt * 10) G.parts.push({ x: px + rand(-7, 7), y: POT_Y - 3, vx: rand(-4, 4), vy: -16, g: -2, life: 1.4, t: 0, c: pick(['#3a3a40', '#55555f', '#222228']), s: 2 });
    }
  });

  // crates
  const bot = staffOf('catcher');
  for (const b of G.boxes) {
    b.t += dt; b.vy += 34 * dt; b.x += b.vx * dt; b.y += b.vy * dt;
    if (bot && !b.dead && b.x < 262) catchBox(b, bot);
    if (!b.dead && b.y >= 64) {
      b.dead = true; burst(b.x + 6, 70, 12, ['#b07a40', '#d49a5a', '#8b5a2b', ING[b.kind].col || '#ffffff'], 30, 80, 0.6);
      pop(b.x + 6, 58, 'SPLAT!', '#ff8a3d'); sfx.splat(); G.chaos += 3;
    }
  }
  G.boxes = G.boxes.filter(b => !b.dead);

  // flying ingredients
  for (const f of G.flyers) { f.t += dt; if (f.t >= f.dur && !f.fin) { f.fin = true; if (f.done) f.done(); } }
  G.flyers = G.flyers.filter(f => !f.fin);

  // coins
  const cashier = staffOf('cashier');
  for (const c of G.coinsC) {
    c.t += dt; c.vy += 200 * dt; c.y += c.vy * dt;
    if (c.y >= 83) { c.y = 83; c.vy = Math.abs(c.vy) > 20 ? -Math.abs(c.vy) * 0.35 : 0; }
    if (cashier && c.t > 0.6 && !c.dead) { zap(cashier, c.x, c.y, '#ffd36b'); collect(c); }
    if (c.t > 10 && !c.dead) { c.dead = true; pop(c.x, 76, 'A PIGEON TOOK IT', '#bbbbbb'); }
  }
  G.coinsC = G.coinsC.filter(c => !c.dead);

  updateStaff(dt);

  // particles, popups, banners
  for (const p of G.parts) { p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  G.parts = G.parts.filter(p => p.t < p.life);
  for (const p of G.pops) { p.t += dt; p.y -= 14 * dt; }
  G.pops = G.pops.filter(p => p.t < 1.2);
  if (G.banners.length) { G.banners[0].t += dt; if (G.banners[0].t > 2.8) G.banners.shift(); }

  // chaos meter
  const weird = G.staff.reduce((a, s) => a + s.ch.weird, 0);
  if (!G.closing) G.chaos += dt * (0.35 + weird * 0.12);
  if (G.chaos >= 100 && G.eventCool <= 0 && !G.closing) { G.chaos = 0; G.eventCool = 12; chaosEvent(); }
  G.chaos = Math.min(G.chaos, 100);

  if (G.rep <= 0) { go('end', 'lose'); return; }

  // closing time
  if (!G.closing && G.t >= DAY_LEN) {
    G.closing = true; G.closeT = 0; G.held && returnHeld();
    banner('CLOSING TIME!', 'GREAT SHIFT, CREW!'); sfx.bell();
    G.customers.forEach(c => { if (c.state === 'walkin' || c.state === 'waiting') { say(c, 'AW, CLOSED?', 1.5); leave(c); } });
  }
  if (G.closing) {
    G.closeT += dt;
    if (G.closeT > 3.5 && !G.customers.some(c => c.state === 'hire' || c.state === 'eating')) finishDay();
  }
}

function pickReview() {
  const p = [], d = G.ds;
  if (d.angry >= 4) p.push("'I WAITED SO LONG I GREW A BEARD.'");
  if (d.wrong >= 3) p.push("'I ORDERED RAMEN. I GOT A MYSTERY.'");
  if (d.served >= 12) p.push("'FAST, WEIRD, DELICIOUS.' - THE DAILY SLURP");
  if (d.served < 4) p.push("'QUIET LITTLE PLACE. MAYBE TOO QUIET.'");
  for (const s of G.staff) if (STAFF_REVIEWS[s.ch.id]) p.push(STAFF_REVIEWS[s.ch.id]);
  if (!p.length) p.push("'SOLID NOODLES. NOTHING WEIRD... YET.'");
  return pick(p);
}
function finishDay() {
  G.coinsC.forEach(collect);
  const wages = G.staff.reduce((a, s) => a + Math.ceil(s.ch.cost / 6), 0);
  let paid = true;
  if (G.coins >= wages) G.coins -= wages; else { paid = false; G.bonus += 1; }
  G.lastDay = Object.assign({}, G.ds, { wages, paid, review: pickReview() });
  go('dayend');
}

// =====================================================================
//  Drawing the shop
// =====================================================================
const SKY_STOPS = [[0, '#8fd3ff'], [0.45, '#a8e0ff'], [0.72, '#ffb37a'], [0.88, '#7a4a9a'], [1, '#2b1e4a']];
function skyColor(p) {
  for (let i = 0; i < SKY_STOPS.length - 1; i++) {
    const [a, ca] = SKY_STOPS[i], [b, cb] = SKY_STOPS[i + 1];
    if (p <= b) return mixCol(ca, cb, (p - a) / (b - a));
  }
  return SKY_STOPS[SKY_STOPS.length - 1][1];
}

function drawPot(cx, y, p, t, mini) {
  cx = fl(cx); y = fl(y);
  const burnt = p.st === 'burnt';
  if (!mini && p.st === 'cook' && G && G.darkT <= 0) {
    for (let i = 0; i < 6; i++) {
      const fx = cx - 13 + i * 5, fh = 2 + ((fl(t * 12) + i) % 3);
      R(fx, y + 14 - fh, 2, fh + 1, '#ff8a3d'); R(fx, y + 14 - fh, 1, 1, '#ffe066');
    }
  }
  if (p.n || p.b) {
    R(cx - 10, y - 4, 20, 4, OUT);
    const c = burnt ? '#1a1a1a' : p.b ? ING[p.b].col : '#5a6070';
    R(cx - 9, y - 3, 18, 2, c);
    if (p.n && !burnt) for (let i = 0; i < 4; i++) R(cx - 7 + i * 4, y - 3 + (i & 1), 2, 1, ING[p.n].col);
    if (p.st === 'ready' && !burnt) { const b = fl(t * 6) % 4; R(cx - 6 + b * 3, y - 4, 2, 1, '#ffffff'); }
  }
  R(cx - 15, y + 3, 4, 3, OUT); R(cx + 11, y + 3, 4, 3, OUT);
  R(cx - 13, y - 1, 26, 16, OUT);
  R(cx - 12, y, 24, 14, burnt ? '#3a3a40' : '#8a94a6');
  R(cx - 12, y, 24, 2, burnt ? '#4a4a50' : '#c4ccd8');
  R(cx + 6, y + 2, 4, 12, burnt ? '#2a2a30' : '#6a7386');
  R(cx - 10, y + 3, 1, 9, burnt ? '#4a4a50' : '#b8c2d0');
  if (mini) return;
  // status bar
  const by = y - 11;
  if (p.st === 'cook') {
    R(cx - 12, by, 24, 4, OUT); R(cx - 11, by + 1, 22, 2, '#3a2a3a'); R(cx - 11, by + 1, fl(22 * clamp(p.t / COOK_T, 0, 1)), 2, '#7dff9a');
  } else if (p.st === 'ready') {
    const k = hasAb('noburn') ? 1 : 1 - p.t / BURN_T;
    R(cx - 12, by, 24, 4, OUT); R(cx - 11, by + 1, fl(22 * k), 2, k < 0.35 && (fl(t * 8) & 1) ? '#ff4d4d' : '#ffd36b');
    txtOC('READY!', cx, by - 7 - (fl(t * 4) & 1), '#7dff9a', OUT);
  } else if (burnt) {
    if (fl(t * 4) & 1) txtOC('BURNT!', cx, by - 3, '#ff4d4d', OUT);
  } else if (p.st === 'fill') {
    txtOC(p.n ? '+BROTH' : '+NOODLE', cx, by - 2, '#ffffff', OUT);
  }
}

function drawCoin(x, y, amt) {
  x = fl(x); y = fl(y);
  const n = amt >= 14 ? 3 : amt >= 8 ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const cy = y - i * 2;
    R(x - 3, cy - 3, 7, 4, OUT); R(x - 2, cy - 4, 5, 6, OUT);
    R(x - 2, cy - 3, 5, 3, '#f5c542'); R(x - 1, cy - 3, 1, 1, '#fff6b0'); R(x - 2, cy - 1, 5, 1, '#c99a1e');
  }
}

function drawOrderBubble(c) {
  const bx = fl(c.x) - 17, by = 38;
  panel(bx, by, 35, 13, '#fffaf0', '#2a1a2e');
  R(fl(c.x) - 1, by + 13, 3, 1, '#2a1a2e'); R(fl(c.x), by + 14, 1, 1, '#2a1a2e'); R(fl(c.x) - 1, by + 12, 3, 1, '#fffaf0');
  drawIcon(c.order.n, bx + 2, by + 2); drawIcon(c.order.b, bx + 12, by + 2); drawIcon(c.order.t, bx + 23, by + 2);
  // patience
  R(bx, by - 4, 35, 3, '#2a1a2e');
  const col = c.pat > 0.5 ? '#7dff9a' : c.pat > 0.25 ? '#ffd36b' : ((fl(G.t * 8) & 1) ? '#ff4d4d' : '#ff9a9a');
  R(bx + 1, by - 3, Math.max(0, fl(33 * c.pat)), 1, col);
  if (c.ch.unique && !G.hired[c.ch.id]) star(bx + 31, by - 6);
}

function drawPlay() {
  const t = G.t, p = clamp(G.t / DAY_LEN, 0, 1);
  ctx.save();
  if (G.shake > 0) ctx.translate(fl(rand(-2, 3)), fl(rand(-2, 3)));
  // street
  R(0, 11, W, 50, skyColor(p));
  if (p < 0.85) { const sx = 20 + p * 280, sy = 30 - Math.sin(p * Math.PI) * 10; circ(sx, sy, 4, p > 0.65 ? '#ffb36b' : '#fff3a8'); }
  else { circ(260, 24, 3, '#f5f0d0'); R(259, 23, 1, 1, '#d8d0b0'); }
  ctx.drawImage(BACK, 0, 0);
  if (p > 0.75) for (const w of BACK_WINDOWS) R(w[0], w[1], 5, 5, '#ffd27a');

  // customers: walkers first, seated on top
  const order = G.customers.slice().sort((a, b) => (a.state === 'waiting' || a.state === 'hire' || a.state === 'eating' ? 1 : 0) - (b.state === 'waiting' || b.state === 'hire' || b.state === 'eating' ? 1 : 0));
  for (const c of order) {
    if (c.state === 'abducted') { dith(c.x - 7, 0, 15, c.y + 4, '#7bed9f88', fl(t * 8) & 1); }
    const walking = c.state === 'walkin' || c.state === 'leaving';
    let mood = c.mood;
    if (c.state === 'waiting') mood = c.pat < 0.3 ? 'angry' : 'ok';
    if (c.state === 'hire') mood = 'happy';
    drawChar(c.ch, c.x, c.y, { t: c.t, walk: walking, dir: c.dir, mood, frog: c.frog });
  }
  // evening tint over the street
  if (p > 0.55) { ctx.fillStyle = p < 0.8 ? `rgba(255,120,60,${(p - 0.55) / 0.25 * 0.15})` : `rgba(60,30,110,${0.15 + (p - 0.8) / 0.2 * 0.2})`; ctx.fillRect(0, 11, W, 65); }

  ctx.drawImage(FRONT, 0, 0);

  // bins: stock & locks
  BIN_ORDER.forEach((k, i) => {
    const r = binRect(i), s = G.stock[k];
    if (!inPool(k)) { dith(r.x, r.y, r.w, r.h, '#1a1020', 0); txtOC('SOON', r.x + 20, r.y + 7, '#cccccc', OUT); return; }
    txt(s > 0 ? 'X' + s : 'OUT!', r.x + 16, r.y + 11, s === 0 ? ((fl(t * 4) & 1) ? '#ff4d4d' : '#ffb3b3') : s <= 2 ? '#ffd36b' : '#c8f7c5');
    txt(String(i + 1), r.x + r.w - 5, r.y + 11, '#d49a5a');
  });
  // pots, bowls
  G.pots.forEach((pt, i) => drawPot(POT_X[i], POT_Y, pt, t, false));
  G.bowls.forEach((b, i) => { if (b) drawBowl(BOWL_X[i], BOWL_Y, b); else if (G.held) dith(BOWL_X[i] + 2, BOWL_Y + 4, 14, 4, '#00000040'); });
  for (const f of G.flyers) { const u = clamp(f.t / f.dur, 0, 1); drawIcon(f.kind, lerp(f.x0, f.x1, u), lerp(f.y0, f.y1, u) - Math.sin(u * Math.PI) * 14); }
  for (const c of G.coinsC) drawCoin(c.x, c.y, c.amt);

  // hover highlight
  if (!G.paused) {
    let hr = null;
    const bi = binAt(mouse), pi = potAt(mouse), wi = bowlAt(mouse);
    if (bi >= 0) { const r = binRect(bi); hr = [r.x - 1, r.y - 1, r.w + 2, r.h + 2]; }
    else if (pi >= 0) hr = [POT_X[pi] - 15, POT_Y - 5, 30, 21];
    else if (wi >= 0 && (G.bowls[wi] || G.held)) hr = [BOWL_X[wi] - 2, BOWL_Y - 6, 22, 18];
    else if (G.held && inside(mouse, TRASH.x - 2, TRASH.y - 2, TRASH.w + 4, TRASH.h + 4)) hr = [TRASH.x - 2, TRASH.y - 3, TRASH.w + 4, TRASH.h + 5];
    if (hr) { const c = (fl(t * 6) & 1) ? '#ffe066' : '#ffffff'; R(hr[0], hr[1], hr[2], 1, c); R(hr[0], hr[1] + hr[3] - 1, hr[2], 1, c); R(hr[0], hr[1], 1, hr[3], c); R(hr[0] + hr[2] - 1, hr[1], 1, hr[3], c); }
    const cu = custAt(mouse);
    if (cu && G.held && cu.state === 'waiting') { const c = '#ffe066'; R(cu.x - 12, 34, 24, 1, c); R(cu.x - 12, 75, 24, 1, c); R(cu.x - 12, 34, 1, 42, c); R(cu.x + 11, 34, 1, 42, c); }
  }

  // customer UI
  for (const c of G.customers) {
    if (c.state === 'waiting') drawOrderBubble(c);
    if (c.state === 'hire') {
      const x = fl(c.x);
      panel(x - 22, 30, 44, 22, '#fffaf0', '#2a1a2e');
      txtC('JOIN CREW?', x, 33, '#2a1a2e');
      btn(x - 19, 40, 38, 9, 'HIRE $' + c.ch.cost, () => hire(c), { col: G.coins >= c.ch.cost ? '#2f9e44' : '#8a7a8a', hov: G.coins >= c.ch.cost ? '#40c057' : '#a090a0' });
      R(x - 20, 53, 40, 2, '#2a1a2e'); R(x - 20, 53, fl(40 * c.ti / 7), 2, '#ffd36b');
    }
  }
  for (const c of G.customers) if (c.bubT > 0 && c.bub) speech(c.bub, c.x, c.state === 'waiting' ? 33 : c.state === 'hire' ? 29 : 50, 56);

  // crew
  for (let i = 0; i < MAX_STAFF; i++) {
    const x = staffX(i), s = G.staff[i];
    if (!s) {
      if (i === G.staff.length) {
        R(x, 168, 1, 10, '#3e2616');
        panel(x - 15, 155, 30, 15, '#f3e3c3', '#5a3418');
        txtC('HELP', x, 157, '#8e1f14'); txtC('WANTED', x, 163, '#8e1f14');
      } else { R(x - 6, 176, 12, 2, '#5a3820'); }
      continue;
    }
    let mood = 'ok';
    if (G.danceT > 0) mood = 'happy'; if (s.pause > 0) mood = 'sad';
    R(x - 7, 176, 14, 2, '#4a2e1a');
    drawChar(s.ch, x, 176, { t: t + i * 0.37, dance: G.danceT > 0, jump: s.jump > 0, mood, staff: true, dir: 1 });
    if (s.pause > 0) txtO('Z', x + 6, 150 - (fl(t * 2) % 3), '#ffffff', OUT);
    if (!G.held && !G.paused && staffAt(mouse) === s) btn(x + 5, 170, 15, 8, 'BYE', () => letGo(s), { col: '#8a3a4a', hov: '#c04a5a' });
  }
  for (let i = 0; i < G.staff.length; i++) { const s = G.staff[i]; if (s.bubT > 0 && s.bub) speech(s.bub, staffX(i), 150, 64); }

  // crates in flight
  for (const b of G.boxes) {
    R(b.x + 12, b.y + 5, 2, 1, '#ffffff80'); R(b.x + 15, b.y + 7, 3, 1, '#ffffff60');
    drawCrate(b.x, b.y, b.kind);
  }
  // particles
  for (const q of G.parts) { R(q.x, q.y, q.s, q.s, q.c); }
  for (const q of G.pops) txtOC(q.text, q.x, q.y, q.c, OUT);

  if (G.darkT > 0) drawDark();
  ctx.restore();

  // banner
  if (G.banners.length) {
    const b = G.banners[0], k = Math.min(1, b.t * 5, (2.8 - b.t) * 5);
    const lines = wrap(b.sub || '', 296);
    const h = 16 + lines.length * 7;
    const y = fl(lerp(-h, 22, k));
    R(0, y, W, h, '#1b1226e6'); R(0, y, W, 1, '#ffd36b'); R(0, y + h - 1, W, 1, '#ffd36b');
    txtOC(b.title, 160, y + 3, '#ffd36b', OUT, 2);
    lines.forEach((l, i) => txtC(l, 160, y + 15 + i * 7, '#ffffff'));
  }

  drawHUD();

  // tooltips
  if (!G.paused && !G.banners.length || (!G.paused && mouse.y > 60)) {
    const s = staffAt(mouse);
    const cu = custAt(mouse);
    const bi = binAt(mouse);
    if (s) tooltip([[s.ch.name, '#ffd36b'], [s.ch.role, '#ff9ad5'], ...wrapLines(s.ch.desc, 150, '#ffffff'), ...wrapLines('QUIRK: ' + s.ch.quirk, 150, '#b8a8d0'), ['BYE = LET THEM GO', '#8a7a9a']], staffX(G.staff.indexOf(s)), 149);
    else if (cu && !G.held && cu.state !== 'hire') {
      const L = [[cu.frog ? 'A FROG (FORMERLY ' + cu.ch.name + ')' : cu.ch.name, '#ffd36b']];
      if (cu.ch.unique) L.push([cu.ch.title, '#b8a8d0']);
      if (cu.state === 'waiting') L.push(['WANTS: ' + orderText(cu.order), '#ffffff']);
      if (cu.ch.unique && !G.hired[cu.ch.id]) L.push(['HIREABLE AS ' + cu.ch.role + ' ($' + cu.ch.cost + ')', '#7dff9a']);
      if (cu.ch.picky && !G.hired[cu.ch.id]) L.push(['SERVE HIM FAST TO IMPRESS HIM', '#ff9ad5']);
      tooltip(L);
    } else if (cu && cu.state === 'hire' && !inside(mouse, cu.x - 19, 40, 38, 9)) {
      tooltip([[cu.ch.name, '#ffd36b'], ['WOULD BE YOUR ' + cu.ch.role, '#ff9ad5'], ...wrapLines(cu.ch.desc, 150, '#ffffff')]);
    } else if (bi >= 0 && !G.held) {
      const k = BIN_ORDER[bi];
      tooltip([[ING[k].name + '  X' + G.stock[k], '#ffd36b'], [ING[k].cat === 't' ? 'ADDS TOPPING TO A BOWL' : 'GOES INTO A POT', '#ffffff'], ['KEY ' + (bi + 1), '#b8a8d0']]);
    }
  }

  if (G.paused) drawPause();
}

const DARK = mkCanvas(W, H);
function drawDark() {
  const d = DARK.getContext('2d');
  d.globalCompositeOperation = 'source-over'; d.clearRect(0, 0, W, H);
  d.fillStyle = 'rgba(6,4,14,0.94)'; d.fillRect(0, 0, W, H);
  d.globalCompositeOperation = 'destination-out';
  const hole = (cx, cy, r, a) => { d.fillStyle = `rgba(0,0,0,${a})`; for (let dy = -r; dy <= r; dy++) { const dx = fl(Math.sqrt(r * r - dy * dy)); d.fillRect(fl(cx) - dx, fl(cy) + dy, dx * 2 + 1, 1); } };
  hole(mouse.x, mouse.y, 30, 0.5); hole(mouse.x, mouse.y, 24, 1);
  G.staff.forEach((s, i) => { if (s.ch.id === 'beep') hole(staffX(i), 165, 14, 0.8); if (s.ch.id === 'boris') hole(staffX(i), 165, 12, 0.6); });
  d.globalCompositeOperation = 'source-over';
  ctx.drawImage(DARK, 0, 0);
  if (fl(G.t * 2) & 1) txtOC('POWER OUTAGE!', 160, 2 + 11, '#ffd36b', OUT);
}

function drawHUD() {
  R(0, 0, W, 11, '#1b1226'); R(0, 10, W, 1, '#3b2a4a');
  txt('DAY ' + G.day, 3, 3, '#ffd36b');
  const hr = 11 + fl(clamp(G.t / DAY_LEN, 0, 1) * 10);
  const h12 = ((hr + 11) % 12) + 1;
  txt(h12 + (hr >= 12 ? 'PM' : 'AM'), 27, 3, G.t > DAY_LEN * 0.85 ? '#ff9a5a' : '#ffffff');
  txt('$' + G.coins, 49, 3, '#ffd36b');
  heart(76, 3);
  R(83, 3, 32, 5, OUT); R(84, 4, fl(30 * G.rep / 100), 3, G.rep > 40 ? '#ff6b8a' : (fl(G.t * 6) & 1) ? '#ff2020' : '#ff9a9a');
  txt('CHAOS', 121, 3, '#ff8a3d');
  R(142, 3, 42, 5, OUT); R(143, 4, fl(40 * G.chaos / 100), 3, G.chaos > 80 ? ((fl(G.t * 8) & 1) ? '#ff3d3d' : '#ffd36b') : '#ff8a3d');
  txt('CHARM ' + charm(), 190, 3, '#ff9ad5');
  txt('CREW ' + G.staff.length + '/' + MAX_STAFF, 234, 3, '#7fd1ff');
  btn(276, 1, 21, 9, 'II', () => { G.paused = true; sfx.click(); }, { col: '#3b2a4a', hov: '#5a3a7a' });
  btn(299, 1, 19, 9, SND.muted ? 'M-' : 'M+', () => { toggleMute(); }, { col: '#3b2a4a', hov: '#5a3a7a' });
}

function drawPause() {
  ctx.fillStyle = 'rgba(14,6,26,0.75)'; ctx.fillRect(0, 0, W, H);
  panel(90, 40, 140, 96, '#2a1b3d', '#f3e3c3');
  txtOC('PAUSED', 160, 48, '#ffd36b', OUT, 2);
  txtC('THE NOODLES WILL WAIT.', 160, 64, '#d9cde8');
  btn(110, 76, 100, 12, 'RESUME', () => { G.paused = false; sfx.click(); }, { col: '#2f9e44', hov: '#40c057' });
  btn(110, 94, 100, 12, SND.muted ? 'SOUND: OFF' : 'SOUND: ON', () => toggleMute(), { col: '#5a3a7a', hov: '#7a52a3' });
  btn(110, 112, 100, 12, 'QUIT TO TITLE', () => { sfx.click(); go('title'); }, { col: '#d6402f', hov: '#ff5a44' });
}

// =====================================================================
//  Scenes
// =====================================================================
const Play = {
  enter() { playMusic('game'); },
  update(dt) { if (!G.paused) updatePlay(dt); },
  draw() { drawPlay(); },
  click() {
    if (G.paused) return;
    const m = mouse;
    for (const b of G.boxes) if (!b.dead && Math.abs(m.x - (b.x + 6)) < 11 && Math.abs(m.y - (b.y + 6)) < 11) { catchBox(b, null); return; }
    for (const c of G.coinsC) if (!c.dead && Math.abs(m.x - c.x) < 8 && Math.abs(m.y - (c.y - 2)) < 8) { collect(c); return; }
    const cu = custAt(m), ki = binAt(m), pi = potAt(m), bi = bowlAt(m);
    if (G.held) {
      if (cu && cu.state === 'waiting') { serve(cu, G.held.bowl); G.held = null; return; }
      if (inside(m, TRASH.x - 2, TRASH.y - 2, TRASH.w + 4, TRASH.h + 4)) { G.held = null; sfx.trash(); pop(TRASH.x + 10, TRASH.y - 6, 'TOSSED', '#cccccc'); return; }
      if (bi >= 0) { clickBowlSlot(bi); return; }
      if (ki >= 0) { useBin(ki); return; }
      if (pi >= 0) { clickPot(pi); return; }
      returnHeld(); sfx.click(); return;
    }
    if (ki >= 0) { useBin(ki); return; }
    if (pi >= 0) { clickPot(pi); return; }
    if (bi >= 0) { clickBowlSlot(bi); return; }
    if (cu && cu.state === 'waiting') pop(cu.x, 30, 'PICK UP A BOWL FIRST', '#ffffff');
  },
  rclick() { if (G.held) { returnHeld(); sfx.click(); } },
  key(k) {
    if (k === 'Escape' || k === 'p' || k === 'P') { if (G.held && !G.paused && k === 'Escape') { returnHeld(); return; } G.paused = !G.paused; return; }
    if (G.paused) return;
    const n = parseInt(k, 10);
    if (n >= 1 && n <= 9) { useBin(n - 1); return; }
    const lk = k.toLowerCase();
    const pots = 'qwe'.indexOf(lk); if (pots >= 0 && lk) { clickPot(pots); return; }
    const bowls = 'asd'.indexOf(lk); if (bowls >= 0 && lk) { clickBowlSlot(bowls); return; }
    const seats = 'zxcv'.indexOf(lk); if (seats >= 0 && lk) { serveSlot(seats); return; }
  },
};

const DayEnd = {
  t: 0,
  enter() {
    this.t = 0; playMusic('end');
    this.speaker = G.staff.length ? fl(Math.random() * G.staff.length) : -1;
    this.line = this.speaker >= 0 ? pick(G.staff[this.speaker].ch.say.staff) : '';
  },
  update(dt) { this.t += dt; updateSteam(dt); },
  next() { sfx.start(); if (G.day >= DAYS) go('end', 'win'); else { G.day++; startDay(); go('play'); } },
  draw() {
    const t = this.t, L = G.lastDay;
    ctx.drawImage(CITY, 0, 0); drawStars(t); drawShopLive(t); drawSteam(); drawWires(t);
    // the crew poses on the sidewalk
    const n = G.staff.length;
    G.staff.forEach((s, i) => {
      const x = 160 - (n - 1) * 17 + i * 34;
      drawChar(s.ch, x, 158, { t: t + i * 0.4, mood: 'happy', staff: true, jump: (fl(t * 2 + i) % 4) === 0 });
    });
    ctx.fillStyle = 'rgba(14,6,26,0.55)'; ctx.fillRect(0, 0, W, 126);
    panel(30, 3, 260, 121, '#2a1b3d', '#f3e3c3');
    txtOC('DAY ' + G.day + ' COMPLETE!', 160, 7, '#ffd36b', OUT, 2);
    const rows = [
      ['BOWLS SERVED', L.served, '#7dff9a'], ['WRONG BOWLS', L.wrong, '#ffb36b'], ['ANGRY WALKOUTS', L.angry, '#ff6b6b'],
      ['EARNED TODAY', '$' + L.earned, '#ffd36b'], ['CREW WAGES', L.paid ? '-$' + L.wages : "UNPAID (THEY DON'T MIND)", '#ff9ad5'],
      ['REPUTATION', G.rep + '/100', '#7fd1ff'], ['TEAM CHARM', charm(), '#ff9ad5'],
    ];
    rows.forEach((r, i) => {
      const y = 22 + i * 7, v = String(r[1]);
      txt(r[0], 44, y, '#d9cde8');
      for (let x = 44 + tw(r[0]) + 3; x < 274 - tw(v); x += 3) R(x, y + 4, 1, 1, '#5a4a6a');
      txt(v, 276 - tw(v), y, r[2]);
    });
    panel(40, 73, 240, 24, '#f3e3c3', '#5a3418');
    txt('THE NOODLE TIMES SAYS:', 44, 76, '#8e1f14');
    wrap(L.review, 230).slice(0, 2).forEach((l, i) => txt(l, 44, 83 + i * 7, '#3a2414'));
    if (L.hired.length) txtC('NEW TODAY: ' + L.hired.map(id => CAST_BY_ID[id].name).join(', '), 160, 100, '#7dff9a');
    btn(112, 109, 96, 11, G.day >= DAYS ? 'SEE THE CREW!' : 'OPEN DAY ' + (G.day + 1), () => this.next(), { col: '#d6402f', hov: '#ff5a44' });
    if (this.speaker >= 0 && fl(t / 4) % 2 === 0) speech(this.line, 160 - (n - 1) * 17 + this.speaker * 34, 137, 70);
    if (!n) txtOC('(NO CREW YET. SERVE STARRED CUSTOMERS TO HIRE!)', 160, 146, '#ffffff', OUT);
  },
  click() {},
  key(k) { if (k === 'Enter' || k === ' ') this.next(); },
};

const Ending = {
  t: 0, kind: 'win',
  enter(kind) {
    this.kind = kind; this.t = 0; this.flashed = false; this.ch = charm(); setBest(this.ch); playMusic('end');
  },
  update(dt) {
    this.t += dt; updateSteam(dt);
    if (!this.flashed && this.t > 0.8) { this.flashed = true; sfx.flash(); }
  },
  draw() {
    const t = this.t;
    ctx.drawImage(CITY, 0, 0); drawStars(t); drawShopLive(t); drawSteam(); drawWires(t);
    const n = G.staff.length;
    G.staff.forEach((s, i) => {
      const x = 160 - (n - 1) * 17 + i * 34;
      drawChar(s.ch, x, 158, { t: t + i * 0.3, mood: 'happy', dance: t > 1.6, staff: true });
    });
    if (!n) { Title.drawBigBowl(160, 146, t); }
    if (t > 0.8 && t < 1.5) { ctx.fillStyle = `rgba(255,255,255,${1 - (t - 0.8) / 0.7})`; ctx.fillRect(0, 0, W, H); }

    panel(20, 4, 280, 80, 'rgba(42,27,61,0.92)', '#f3e3c3');
    const win = this.kind === 'win';
    txtOC(win ? 'THE CREW PHOTO' : 'THE SHOP CLOSED...', 160, 9, win ? '#ffd36b' : '#ff9a9a', OUT, 2);
    txtC(win ? 'SEVEN DAYS OF NOODLE CHAOS. SAY CHEESE!' : (n ? 'BUT THE CREW STAYED FRIENDS FOREVER.' : 'AND NOBODY WAS AROUND TO HUG.'), 160, 23, '#ffffff');
    txtC('TEAM CHARM ' + this.ch, 160, 31, '#ff9ad5');
    const st = starsFor(this.ch);
    for (let i = 0; i < 5; i++) star(136 + i * 10, 39, i < st ? '#ffd36b' : '#4a3a5a');
    txtOC(rankFor(this.ch), 160, 48, '#7dff9a', OUT);
    txtC('BOWLS SERVED ' + G.served + '   COINS EARNED $' + G.earned + '   DAYS ' + G.day, 160, 57, '#d9cde8');
    const fr = G.friends.slice(0, 2);
    if (fr.length) fr.forEach((f, i) => txtC('# ' + f.text, 160, 65 + i * 7, '#ffb3e0'));
    else txtC(n ? 'NO FRIENDSHIPS YET. TRY HIRING PAIRS!' : 'TIP: SERVE STARRED CUSTOMERS, THEN HIRE THEM.', 160, 68, '#b8a8d0');
    if (t > 1.6) btn(122, 166, 76, 11, 'PLAY AGAIN', () => { sfx.click(); go('title'); }, { col: '#d6402f', hov: '#ff5a44' });
  },
  click() {},
  key(k) { if ((k === 'Enter' || k === ' ') && this.t > 1.6) go('title'); },
};

// =====================================================================
//  Main loop & input
// =====================================================================
const SCENES = { title: Title, howto: HowTo, play: Play, dayend: DayEnd, end: Ending };
function go(name, arg) { scene = name; fadeT = 0.35; UI = []; SCENES[name].enter(arg); }

function toCanvas(e) {
  const r = cvs.getBoundingClientRect();
  mouse.x = (e.clientX - r.left) / r.width * W;
  mouse.y = (e.clientY - r.top) / r.height * H;
}
cvs.addEventListener('pointermove', toCanvas);
cvs.addEventListener('pointerdown', e => {
  e.preventDefault(); toCanvas(e); audioInit();
  if (e.button === 2) { SCENES[scene].rclick && SCENES[scene].rclick(); return; }
  for (let i = UI.length - 1; i >= 0; i--) { const b = UI[i]; if (inside(mouse, b.x, b.y, b.w, b.h)) { b.cb(); return; } }
  SCENES[scene].click();
});
cvs.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('keydown', e => {
  audioInit();
  if (e.key === 'm' || e.key === 'M') { toggleMute(); return; }
  if (SCENES[scene].key) SCENES[scene].key(e.key);
  if (e.key === ' ') e.preventDefault();
});

function resize() {
  const s = Math.min(innerWidth / W, innerHeight / H);
  const sc = s >= 1 ? Math.floor(s) : s;
  cvs.style.width = (W * sc) + 'px'; cvs.style.height = (H * sc) + 'px';
}
addEventListener('resize', resize);

function drawCursor() {
  const x = fl(mouse.x), y = fl(mouse.y);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  if (scene === 'play' && G && G.held && !G.paused) drawBowl(x - 9, y - 4, G.held.bowl);
  const art = ['X......', 'XX.....', 'XwX....', 'XwwX...', 'XwwwX..', 'XwwwwX.', 'XwwXXX.', 'XXX....'];
  art.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] !== '.') R(x + i, y + j, 1, 1, row[i] === 'X' ? OUT : '#ffffff'); });
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  SCENES[scene].update(dt);
  UI = [];
  SCENES[scene].draw();
  if (fadeT > 0) { fadeT -= dt; ctx.fillStyle = `rgba(10,5,20,${clamp(fadeT / 0.35, 0, 1)})`; ctx.fillRect(0, 0, W, H); }
  drawCursor();
  requestAnimationFrame(frame);
}

buildIcons();
buildCity();
buildPlayLayers();
resize();
go('title');
requestAnimationFrame(frame);
