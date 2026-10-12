'use strict';
// ============================================================
//  CRAZY DENTIST — the gadget closet: slapstick power tools
//  bought with your earnings, each usable once per day
// ============================================================

const GADGETS = [
  { id: 'yanker', name: 'TNT TOOTH-POPPER', short: 'TNT!', mg: 'extract', price: 90, word: 'KA-BOOM!', desc: 'DYNAMITE IN EVERY ROTTEN TOOTH. BIG PAIN, SOOTY FACE, SCARED LOBBY. $15 CLEANUP BILL.' },
  { id: 'brush', name: 'CHAINSAW TOOTHBRUSH', short: 'BRRRR', mg: 'clean', price: 60, word: 'BRRRRRRRR!', desc: 'A TOOTHBRUSH WITH A CHAINSAW MOTOR. FOAM EVERYWHERE, SPOOKS THE LOBBY. $5 TOWEL BILL.' },
  { id: 'vacuum', name: 'TURBO SHOP-VAC', short: 'SLURP', mg: 'drill', price: 80, word: 'SHLUUUURP!', desc: 'SUCKS OUT ALL THE DECAY. ALSO THE EYEBROWS. AND THE HAIR ($20 WIG BILL).' },
  { id: 'squirter', name: 'CEMENT CANNON', short: 'THUNK', mg: 'fill', price: 70, word: 'KA-THUNK!', desc: 'ONE GLOB OF FILLING AT 300 MPH. SPLATTERS CEMENT EVERYWHERE: $10 DRY CLEANING.' },
  { id: 'laser', name: 'MEGA LASER', short: 'ZAP!', mg: 'canal', price: 100, word: 'BZZZZAP!', desc: 'BURNS BOTH CANALS CLEAN. THEIR HAIR SMOKES AND THEY SMELL LIKE TOAST. $5 BILL.' },
  { id: 'robo', name: 'BRACE STAPLER', short: 'CHUNK', mg: 'braces', price: 90, word: 'KA-CHUNK!', desc: 'STAPLES ON EVERY BRACE. EVERY KA-CHUNK MAKES THEM JUMP OUT OF THEIR SKIN (+PAIN).' },
  { id: 'hypno', name: 'RUBBER MALLET', short: 'BONK', mg: 'any', price: 120, word: 'SWING!', desc: 'BONK! DAZED WITH NO PAIN FOR 8 SECONDS. THEY LEAVE WITH A BUMP ($5 ICE PACK).' },
  { id: 'confetti', name: 'T-SHIRT CANNON', short: 'FIRE', mg: 'lobby', price: 50, word: 'FREE SHIRTS!', desc: 'USE IT HERE. FREE SHIRTS BONK EVERYONE WAITING: FULL PATIENCE AND A NEW SHIRT.' },
];
const gadgetOwned = (id) => !!(Game.gadgets && Game.gadgets[id]);
const gadgetReady = (id) => gadgetOwned(id) && !(Clinic.used && Clinic.used[id]);

function dynamite(x, y, t, lit = true) {
  orect(x, y, 4, 9, P.red); rect(x, y + 3, 4, 1, P.dred); rect(x + 1, y + 1, 1, 6, P.salmon);
  line(x + 2, y - 1, x + 3, y - 4, P.cream);
  if (lit) { const f = Math.floor(t * 20) % 3; px(x + 3 + (f === 1 ? 1 : 0), y - 5, P.yellow); px(x + 3, y - 5 - (f === 2 ? 1 : 0), P.white); px(x + 4, y - 4, P.orange); }
}
function shirt(x, y, c) { rect(x - 1, y, 7, 2, c); rect(x + 1, y + 2, 3, 3, c); px(x + 2, y, P.white); }

function gadgetIcon(id, x, y, t) {
  x = Math.round(x); y = Math.round(y);
  switch (id) {
    case 'yanker': dynamite(x + 2, y + 5, t); dynamite(x + 7, y + 4, t); dynamite(x + 12, y + 6, t, false); rect(x + 2, y + 9, 14, 1, P.gold); break;
    case 'brush':
      orect(x + 1, y + 7, 7, 7, P.orange); rect(x + 2, y + 8, 2, 2, P.yellow); rect(x + 3, y + 13, 3, 2, P.black);
      orect(x + 8, y + 9, 9, 3, P.lgray); for (let i = 0; i < 9; i += 2) px(x + 8 + ((i + Math.floor(t * 20)) % 9), y + 8, P.dgray);
      rect(x + 12, y + 5, 5, 4, P.white); rect(x + 12, y + 7, 5, 1, P.cyan); break;
    case 'vacuum':
      orect(x + 1, y + 6, 9, 9, P.gold); rect(x + 2, y + 7, 2, 7, P.yellow); rect(x + 2, y + 14, 2, 2, P.black); rect(x + 7, y + 14, 2, 2, P.black);
      line(x + 9, y + 7, x + 16, y + 1, P.black, 3); line(x + 9, y + 7, x + 16, y + 1, P.dgray, 1); break;
    case 'squirter':
      orect(x + 1, y + 6, 13, 5, P.gray); rect(x + 2, y + 7, 11, 1, P.lgray); rect(x + 13, y + 5, 3, 7, P.dgray);
      circle(x + 4, y + 13, 2, P.black); circle(x + 4, y + 13, 1, P.brown); circle(x + 11, y + 13, 2, P.black); circle(x + 11, y + 13, 1, P.brown); break;
    case 'laser':
      orect(x + 1, y + 7, 11, 6, P.dgray); rect(x + 2, y + 8, 9, 1, P.gray); orect(x + 11, y + 8, 3, 4, P.red);
      line(x + 14, y + 10, x + 17, y + 10, Math.floor(t * 8) % 2 ? P.hot : P.yellow); rect(x + 4, y + 13, 3, 3, P.slate); break;
    case 'robo':
      orect(x + 2, y + 5, 12, 5, P.red); rect(x + 3, y + 6, 10, 1, P.salmon); orect(x + 3, y + 10, 4, 6, P.red);
      rect(x + 12, y + 10, 4, 1, P.lgray); rect(x + 12, y + 12, 4, 1, P.lgray); break;
    case 'hypno': {
      const a = Math.sin(t * 6) * 0.4;
      const hx = x + 8 + Math.round(Math.sin(a) * 6), hy = y + 2;
      line(x + 8, y + 16, hx, hy + 4, P.black, 4); line(x + 8, y + 16, hx, hy + 4, P.brown, 2);
      orect(hx - 6, hy, 12, 6, P.red); rect(hx - 5, hy + 1, 10, 1, P.salmon); break;
    }
    case 'confetti':
      line(x + 1, y + 15, x + 11, y + 5, P.black, 6); line(x + 1, y + 15, x + 11, y + 5, P.sky, 4); line(x + 2, y + 13, x + 10, y + 5, P.cyan, 1);
      shirt(x + 11, y - 1 - (Math.floor(t * 4) % 2), P.red); break;
  }
}

// ---------- closet door in the clinic ----------
const CLOSET = { x: 205, y: 54, w: 24, h: 63 };
function drawClosetDoor(t, hover) {
  const { x, y, w, h } = CLOSET;
  rect(x - 2, y - 2, w + 4, h + 2, P.dbrown);
  rect(x, y, w, h, P.dgreen);
  rect(x + 3, y + 4, w - 6, 22, P.green); rect(x + 3, y + 32, w - 6, 26, P.green);
  rect(x + 4, y + 5, w - 8, 20, P.dgreen); rect(x + 4, y + 33, w - 8, 24, P.dgreen);
  px(x + w - 5, y + 32, P.gold); px(x + w - 5, y + 33, P.gold);
  // a warning sticker for flavor
  tri(x + 12, y + 37, x + 7, y + 46, x + 17, y + 46, P.yellow); rect(x + 12, y + 40, 1, 3, P.black); px(x + 12, y + 44, P.black);
  UI.panel(x - 3, y - 12, w + 6, 10, P.navy, P.black, P.gold);
  text('CLOSET', x + w / 2, y - 9, P.gold, 1, { align: 'c' });
  if (GADGETS.some((g) => gadgetReady(g.id))) twinkle(x + 6, y + 14, Math.abs(Math.sin(t * 3)), P.yellow);
  if (hover) outline(x - 3, y - 3, w + 6, h + 4, P.yellow);
}

// ---------- the closet overlay ----------
const Closet = {
  hover: null,
  draw(t) {
    G.globalAlpha = 0.55; rect(0, 12, W, H - 12, P.black); G.globalAlpha = 1;
    const X = 34, Y = 16, Wd = 252, Hd = 160;
    rect(X, Y, Wd, Hd, P.black); rect(X + 1, Y + 1, Wd - 2, Hd - 2, P.dbrown); rect(X + 4, Y + 14, Wd - 8, Hd - 18, P.ddbrown);
    text('GADGET CLOSET', X + Wd / 2, Y + 4, P.yellow, 1, { align: 'c', sh: P.black });
    coin(X + Wd - 44, Y + 3); text(`$${Math.floor(Game.money)}`, X + Wd - 36, Y + 4, P.gold);
    this.hover = null;
    const waiting = Clinic.people.some((p) => p.state === 'wait');
    GADGETS.forEach((g, i) => {
      const c = i % 4, r = Math.floor(i / 4), sx = X + 8 + c * 60, sy = Y + 18 + r * 58;
      rect(sx - 2, sy + 52, 58, 3, P.brown); rect(sx - 2, sy + 55, 58, 1, P.black);
      const owned = gadgetOwned(g.id), ready = gadgetReady(g.id);
      if (input.inside(sx, sy, 54, 52)) this.hover = g;
      if (this.hover === g) outline(sx - 1, sy - 1, 56, 53, P.yellow);
      gadgetIcon(g.id, sx + 19, sy + 2 + (this.hover === g ? Math.round(Math.sin(t * 8)) : 0), t);
      wrap(g.name, 52).forEach((l, j) => text(l, sx + 27, sy + 22 + j * 7, owned ? P.white : P.lgray, 1, { align: 'c' }));
      if (!owned) {
        if (UI.button(sx + 3, sy + 38, 48, 12, `$${g.price}`, { disabled: Game.money < g.price, color: P.gold, light: P.yellow, dark: P.orange, tc: P.black })) {
          Game.money -= g.price; Game.gadgets[g.id] = true; SND.sfx('buy');
          burst(sx + 27, sy + 10, 16, [P.yellow, P.white, P.gold], { star: true, spd: 60, g: 0 });
        }
      } else if (g.id === 'confetti' && ready) {
        if (UI.button(sx + 3, sy + 38, 48, 12, waiting ? 'FIRE!' : 'NOBODY', { disabled: !waiting, color: P.dgreen, light: P.green, dark: P.ddgreen })) fireShirts();
      } else text(ready ? 'READY' : 'USED TODAY', sx + 27, sy + 41, ready ? P.green : P.dgray, 1, { align: 'c' });
    });
    const desc = this.hover ? this.hover.desc : 'BUY A GADGET, THEN USE IT DURING A TREATMENT. EACH ONE WORKS ONCE A DAY.';
    wrap(desc, 176).forEach((l, j) => text(l, X + 8, Y + 135 + j * 7, P.cream));
    if (UI.button(X + Wd - 52, Y + 138, 44, 14, 'CLOSE', { color: P.dred, light: P.red, dark: P.ddbrown }) || input.key('Escape')) { Clinic.closet = false; SND.sfx('click'); }
  },
};

// ---------- T-shirt cannon (lobby) ----------
function fireShirts() {
  Clinic.used.confetti = true; Clinic.closet = false;
  const targets = Clinic.people.filter((p) => p.state === 'wait');
  Clinic.shirts = targets.map((p, i) => ({ p, x: CLOSET.x + 12, y: CLOSET.y + 20, t: -i * 0.22, c: pick([P.red, P.green, P.yellow, P.cyan, P.pink]), fired: false, hit: false }));
  floatText('FREE SHIRTS!', CLOSET.x + 12, CLOSET.y - 18, P.yellow, { sc: 2, dur: 1.4 });
}
function updateLobby(dt) {
  const C = Clinic;
  for (const p of C.people) if (p.cheer > 0) p.cheer -= dt;
  if (!C.shirts || !C.shirts.length) return;
  for (const s of C.shirts) {
    s.t += dt;
    if (s.t >= 0 && !s.fired) { s.fired = true; SND.sfx('cannon'); burst(s.x, s.y, 6, [P.white, P.lgray], { spd: 40, g: 0 }); }
    if (s.t >= 0.55 && !s.hit) {
      s.hit = true;
      if (s.p.state === 'wait') { s.p.patience = s.p.maxPatience; s.p.cheer = 3; s.p.L = { ...s.p.L, shirt: s.c }; (s.p.fx || (s.p.fx = {})).shirt = true; }
      SND.sfx('bonk'); addShake(2);
      burst(s.p.x, 92, 10, [P.yellow, P.white, s.c], { star: true, spd: 60 });
      floatText('BONK!', s.p.x, 74, P.yellow);
    }
  }
  C.shirts = C.shirts.filter((s) => s.t < 0.6);
}
function drawLobby() {
  if (!Clinic.shirts) return;
  for (const s of Clinic.shirts) {
    if (s.t < 0) continue;
    const k = Math.min(1, s.t / 0.55);
    const x = lerp(s.x, s.p.x, k), y = lerp(s.y, 92, k) - Math.sin(k * Math.PI) * 34;
    shirt(Math.round(x) - 2, Math.round(y), s.c);
  }
}

// ---------- what the gadgets do to the patient ----------
function affect(T, key, o = {}) {
  const fx = T.p.fx || (T.p.fx = {});
  if (key) fx[key] = true;
  if (o.bill) T.bills.push({ name: o.bill[0], cost: o.bill[1] });
  T.react = Math.max(T.react || 0, o.react ?? 0.7);
  if (o.scare) scareLobby(o.scare);
  if (o.pain && !(T.hypno > 0)) {
    T.pain = Math.min(100, T.pain + o.pain * (Game.up.gas ? 0.7 : 1)); T.maxPain = Math.max(T.maxPain, T.pain);
    if (o.pain >= 8) SND.sfx('ouch');
    if (T.pain >= 100) T.chomp();
  }
}
function scareLobby(k) {
  let n = 0;
  for (const p of Clinic.people) if (p.state === 'wait') { p.patience -= p.maxPatience * k; p.scared = 1.8; n++; }
  if (n) floatText(n > 1 ? 'THE WAITING ROOM HEARD THAT...' : 'SOMEONE IN THE LOBBY HEARD THAT...', 126, 156, P.salmon, { dur: 1.6 });
}

// ---------- gadgets during treatment ----------
function gadgetsFor(T) {
  if (T.phase !== 'play' || !T.mg || T.auto || T.mallet || !T.mg.kind) return [];
  const k = T.mg.kind;
  return GADGETS.filter((g) => gadgetReady(g.id) && (g.mg === k || (g.mg === 'any' && k !== 'numb' && !(T.hypno > 0))));
}
function useGadget(T, g) {
  Clinic.used[g.id] = true;
  if (g.id !== 'yanker') floatText(g.word, 126, 40, P.yellow, { sc: 2, dur: 1.3 });
  if (g.id === 'hypno') { T.mallet = { t: 0, hit: false }; SND.sfx('whoosh'); return; }
  const A = T.auto = { id: g.id, t: 0, max: 1, q: 0.85, ev: [] };
  const M = T.mouth;
  switch (g.id) {
    case 'yanker': {
      A.max = 1.5;
      A.spots = M.teeth.filter((t) => t.state === 'rotten').map((t) => ({ x: t.x + t.w / 2 - 2, y: t.row === 'up' ? t.y + t.h - 10 : t.y + 2 }));
      SND.sfx('fuse');
      A.ev.push({ at: 0.75, fn: () => {
        T.mg.gadget();
        SND.sfx('boom'); addShake(10); flash(P.white, 1);
        for (const s of A.spots) {
          burst(s.x, s.y, 22, [P.orange, P.yellow, P.red, P.white], { spd: 120 });
          burst(s.x, s.y, 14, [P.black, P.slate, P.dgray], { spd: 50, g: -60, s: 2, life: 1.2 });
        }
        if (chance(0.35)) {
          const healthy = M.teeth.filter((t) => t.state === 'ok');
          if (healthy.length) {
            const t = pick(healthy); t.state = 'missing';
            T.flying.push({ spr: toothSprite({ ...t, state: 'ok' }), x: t.x, y: t.y, vx: rand(-90, 90), vy: -220, r: 0, vr: rand(-12, 12) });
            floatText('OOPS! BONUS TOOTH!', 126, 64, P.salmon, { dur: 1.4 });
            A.q = 0.65;
          }
        }
        affect(T, 'soot', { pain: 30, bill: ['SOOT CLEANUP', 15], scare: 0.3, react: 1.2 });
      } });
      break;
    }
    case 'brush':
      SND.sfx('chainsaw');
      A.ev.push({ at: 0.45, fn: () => { T.mg.gadget(); affect(T, 'foam', { pain: 12, bill: ['NEW TOWEL', 5], scare: 0.15 }); } });
      break;
    case 'vacuum':
      SND.sfx('slurp');
      A.ev.push({ at: 0.25, fn: () => T.mg.gadget() });
      A.ev.push({ at: 0.65, fn: () => {
        affect(T, 'noBrows', { pain: 5 }); floatText('THERE GO THE EYEBROWS!', 126, 60, P.salmon, { dur: 1.4 }); SND.sfx('pop');
        if (!['bald', 'fin', 'antennae'].includes(T.L.hair)) {
          T.L = T.p.L = { ...T.L, hair: 'bald' };
          affect(T, 'bald', { bill: ['NEW WIG', 20] });
          floatText('...AND THE HAIR!', 126, 72, P.salmon, { dur: 1.4 });
        }
      } });
      break;
    case 'squirter':
      A.ev.push({ at: 0.35, fn: () => { T.mg.gadget(); affect(T, 'cement', { pain: 15, bill: ['DRY CLEANING', 10] }); SND.sfx('thunk'); addShake(7); burst(126, 44, 26, [P.lgray, P.white, P.gray], { spd: 110, up: 40, s: 2 }); } });
      SND.sfx('cannon');
      break;
    case 'laser':
      SND.sfx('zap'); flash(P.red, 0.5);
      A.ev.push({ at: 0.15, fn: () => { T.mg.gadget(); affect(T, 'singed', { pain: 10, bill: ['AIR FRESHENER', 5] }); } });
      break;
    case 'robo': {
      const todo = M.teeth.filter((t) => t.num && !t.bracket).sort((a, b) => a.num - b.num);
      todo.forEach((t, i) => A.ev.push({ at: 0.1 + i * 0.11, fn: () => {
        t.bracket = true; SND.sfx('kachunk'); addShake(3); affect(T, null, { pain: 4, react: 0.3 });
        burst(t.x + t.w / 2, t.y + t.h / 2, 5, [P.yellow, P.white], { star: true, spd: 50, g: 0 });
        A.at = t;
      } }));
      A.max = 0.4 + todo.length * 0.11;
      A.ev.push({ at: A.max - 0.15, fn: () => T.mg.gadget() });
      break;
    }
  }
}
// advance a running gadget; returns true when it has finished the minigame
function tickAuto(T, dt) {
  const A = T.auto;
  A.t += dt;
  for (const e of A.ev) if (!e.done && A.t >= e.at) { e.done = true; e.fn(); if (!T.auto) return true; }
  if (A.id === 'laser' && chance(0.6)) FX.parts.push({ x: rand(96, 156), y: rand(60, 160), vx: rand(-5, 5), vy: -30, g: -20, life: 0.8, max: 0.8, c: pick([P.dgray, P.slate, P.gray]), s: 2 });
  if (A.t >= A.max) { T.mg.done = true; T.mg.quality = A.q; T.auto = null; return true; }
  return false;
}
function tickMallet(T, dt) {
  const m = T.mallet;
  if (!m) return;
  m.t += dt;
  if (!m.hit && m.t >= 0.22) {
    m.hit = true; T.hypno = 8;
    affect(T, 'bump', { bill: ['ICE PACK', 5], scare: 0.1, react: 0.5 });
    SND.sfx('bonk'); addShake(7);
    burst(150, 8, 14, [P.yellow, P.white], { star: true, spd: 80, g: 40 });
    floatText('BONK!', 150, 20, P.yellow, { sc: 3, dur: 0.8 });
  }
  if (m.t > 0.6) T.mallet = null;
}

function drawDazed(T) {
  if (T.view !== 'mouth' || !(T.hypno > 0)) return;
  // cartoon bump and circling stars + birds
  for (let i = 0; i < 4; i++) {
    const a = T.t * 3 + i * Math.PI / 2, sx = 126 + Math.cos(a) * 56, sy = 12 + Math.sin(a) * 6;
    if (i % 2) spr(STAR7, sx - 3, sy - 3, false, { o: P.yellow });
    else { rect(sx - 2, sy, 4, 2, P.sky); px(sx + 2, sy - 1, P.sky); px(sx + 3, sy, P.gold); px(sx - 1, sy - 1 - (Math.floor(T.t * 8) % 2), P.blue); }
  }
}

function drawGadgetFx(T) {
  drawDazed(T);
  if (T.mallet) { // the swing
    const k = Math.min(1, T.mallet.t / 0.22), ang = lerp(0.9, -0.62, k * k);
    G.save(); G.translate(250, 160); G.rotate(ang);
    rect(-3, -150, 6, 150, P.black); rect(-2, -150, 4, 150, P.brown);
    rect(-20, -172, 40, 26, P.black); rect(-19, -171, 38, 24, P.red); rect(-19, -171, 38, 4, P.salmon); rect(-19, -151, 38, 3, P.dred);
    G.restore();
  }
  const a = T.auto;
  if (!a) return;
  const k = a.t / a.max;
  switch (a.id) {
    case 'yanker':
      if (a.t < 0.75) for (const s of a.spots) dynamite(s.x, s.y, T.t);
      else if (a.t < 1.1) {
        const r = Math.round((a.t - 0.75) * 140);
        for (const s of a.spots) { circle(s.x, s.y, r, P.orange); circle(s.x, s.y, Math.max(0, r - 6), P.yellow); circle(s.x, s.y, Math.max(0, r - 14), P.white); }
        text('KA-BOOM!', 126, 70, P.red, 4, { align: 'c', ol: P.black, olw: 2 });
      }
      break;
    case 'brush': {
      const x = Math.round(lerp(-80, 270, k)), y = MOUTH.cy + Math.round(Math.sin(T.t * 60) * 2);
      line(x - 90, y + 44, x - 40, y + 14, P.black, 8); line(x - 90, y + 44, x - 40, y + 14, P.dbrown, 6);
      rect(x - 52, y + 2, 26, 22, P.black); rect(x - 51, y + 3, 24, 20, P.orange); rect(x - 49, y + 5, 8, 6, P.yellow);
      rect(x - 28, y + 6, 40, 10, P.black); rect(x - 27, y + 7, 38, 8, P.lgray);
      for (let i = 0; i < 38; i += 4) rect(x - 27 + ((i + Math.floor(T.t * 60)) % 38), y + 6, 2, 1, P.dgray);
      rect(x - 6, y - 16, 22, 22, P.black); rect(x - 5, y - 15, 20, 20, P.white); for (let i = 0; i < 5; i++) rect(x - 4 + i * 4, y - 15, 2, 20, P.lgray);
      burst(x + 6, y, 3, [P.yellow, P.white, P.cyan], { spd: 90, life: 0.4 });
      break;
    }
    case 'vacuum': {
      const wob = Math.round(Math.sin(T.t * 40) * 2);
      line(250, 0, 126 + wob, 34, P.black, 9); line(250, 0, 126 + wob, 34, P.gold, 7);
      rect(112 + wob, 32, 28, 10, P.black); rect(114 + wob, 34, 24, 6, P.dgray);
      for (let i = 0; i < 4; i++) FX.parts.push({ x: rand(70, 180), y: rand(50, 120), vx: 0, vy: -140, g: -200, life: 0.3, max: 0.3, c: pick([P.dbrown, P.ddbrown, P.dgreen]), s: 2 });
      break;
    }
    case 'squirter':
      if (a.t < 0.35) {
        const y = Math.round(lerp(-20, 40, a.t / 0.35));
        rect(110, -10, 32, 18, P.black); rect(112, -10, 28, 16, P.gray);
        circle(126, y, 8, P.black); circle(126, y, 7, P.lgray); px(123, y - 3, P.white);
      }
      break;
    case 'laser':
      if (T.mg.paths) {
        const c = Math.floor(T.t * 20) % 2 ? P.hot : P.red;
        line(250, 0, 126, 70, P.black, 7); line(250, 0, 126, 70, c, 5); line(250, 0, 126, 70, P.white, 1);
        for (const p of T.mg.paths) for (let i = 0; i < p.pts.length; i += 2) rect(p.pts[i].x - 1, p.pts[i].y - 1, 3, 3, c);
      }
      break;
    case 'robo': {
      const t = a.at;
      const x = t ? t.x + t.w / 2 : 240, y = t ? t.y + t.h / 2 : 120;
      rect(x + 2, y - 14, 30, 10, P.black); rect(x + 3, y - 13, 28, 8, P.red); rect(x + 3, y - 13, 28, 2, P.salmon);
      rect(x + 18, y - 5, 10, 16, P.black); rect(x + 19, y - 4, 8, 14, P.red);
      rect(x - 2, y - 6, 6, 4, P.lgray);
      break;
    }
  }
}
