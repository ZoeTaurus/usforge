'use strict';
// ============================================================
//  CRAZY DENTIST — pixel art: patients, dentist, clinic,
//  icons, tool cursors, title mascot, speech bubbles
// ============================================================

// [skin, shade, lip, lipShade]
const SKINS = [
  [P.skin, P.skin2, P.salmon, P.pink],
  [P.cream, P.tan, P.salmon, P.pink],
  [P.tan, P.brown, P.rust, P.dred],
  [P.brown, P.dbrown, P.rust, P.dred],
  [P.dbrown, P.ddbrown, P.brown, P.dred],
];
const HAIRC = [P.black, P.dbrown, P.brown, P.gold, P.rust, P.ddbrown, P.yellow];
const SHIRTS = [P.red, P.sky, P.green, P.orange, P.pink, P.plum, P.yellow, P.dgreen, P.cyan];
const PANTS = [P.blue, P.navy, P.dbrown, P.slate, P.ddgreen];
const EYES = [P.blue, P.dbrown, P.dgreen, P.ddbrown, P.sky];
const STYLES = ['short', 'spiky', 'bob', 'bald', 'afro', 'pony'];

function genLook(type) {
  const s = pick(SKINS);
  const L = {
    type, skin: s[0], shade: s[1], lip: s[2], lipD: s[3],
    hair: pick(STYLES), hc: pick(HAIRC), shirt: pick(SHIRTS), pants: pick(PANTS), eye: pick(EYES),
    glasses: chance(0.22), stache: false, freckles: false,
  };
  L.stache = !['bob', 'pony'].includes(L.hair) && chance(0.25);
  switch (type) {
    case 'pirate': Object.assign(L, { hair: 'bandana', shirt: P.white, pants: P.ddbrown, glasses: false, stache: false }); break;
    case 'vampire': Object.assign(L, { skin: P.lgray, shade: P.gray, lip: P.plum, lipD: P.black, hair: 'slick', hc: P.black, shirt: P.black, pants: P.black, eye: P.red, glasses: false, stache: false }); break;
    case 'shark': Object.assign(L, { skin: P.gray, shade: P.dgray, lip: P.dgray, lipD: P.slate, hair: 'fin', shirt: P.orange, pants: P.blue, eye: P.black, glasses: false, stache: false }); break;
    case 'grandma': Object.assign(L, { hair: 'bun', hc: P.white, shirt: P.plum, pants: P.pink, glasses: true, stache: false, lip: P.hot }); break;
    case 'kid': Object.assign(L, { hair: 'beanie', shirt: pick([P.green, P.sky, P.yellow]), glasses: false, stache: false, freckles: true }); break;
    case 'alien': Object.assign(L, { skin: P.green, shade: P.dgreen, lip: P.dgreen, lipD: P.ddgreen, hair: 'antennae', shirt: P.lgray, pants: P.gray, eye: P.black, glasses: false, stache: false }); break;
  }
  return L;
}

function outline(x, y, w, h, c) { rect(x, y, w, 1, c); rect(x, y + h - 1, w, 1, c); rect(x, y, 1, h, c); rect(x + w - 1, y, 1, h, c); }

// Small full-body character. (x, y) = point between the feet.
function drawPerson(L, x, y, o = {}) {
  x = Math.round(x); y = Math.round(y);
  const kid = L.type === 'kid';
  const legH = kid ? 3 : 4, torsoH = kid ? 5 : 7;
  const step = o.walk != null ? Math.floor(o.walk * 7) % 2 : -1;
  const lift = o.sit ? 2 : (step === 1 ? -1 : 0);
  const ty = y - legH - torsoH + lift, hy = ty - 10;
  const mood = o.mood || 'ok';
  const t = o.t || 0;

  if (L.type === 'vampire') { // cape behind
    rect(x - 8, ty - 1, 16, torsoH + legH + 1 - lift, P.black);
    rect(x - 7, ty, 1, torsoH + legH - 1 - lift, P.dred); rect(x + 6, ty, 1, torsoH + legH - 1 - lift, P.dred);
  }
  if (L.hair === 'afro') ellipse(x - 0.5, hy + 3, 8, 6, L.hc);

  // legs
  if (o.sit) {
    rect(x - 4, y - 4, 3, 4, L.pants); rect(x + 1, y - 4, 3, 4, L.pants);
    rect(x - 5, y - 1, 4, 1, P.black); rect(x + 1, y - 1, 4, 1, P.black);
  } else {
    const a = step === 0 ? 1 : 0, b = step === 1 ? 1 : 0;
    rect(x - 4, y - legH, 3, legH - a, L.pants); rect(x + 1, y - legH, 3, legH - b, L.pants);
    rect(x - 5, y - 1 - a, 4, 1, P.black); rect(x + 1, y - 1 - b, 4, 1, P.black);
  }
  // torso + arms
  orect(x - 5, ty, 10, torsoH, L.shirt);
  if (L.type === 'pirate') for (let r = 1; r < torsoH; r += 2) rect(x - 5, ty + r, 10, 1, P.red);
  if (L.type === 'vampire') { rect(x - 1, ty, 2, torsoH, P.white); px(x - 1, ty + 1, P.red); }
  if (L.type === 'shark') { px(x - 3, ty + 2, P.yellow); px(x + 2, ty + 4, P.yellow); px(x, ty + 1, P.yellow); }
  if (L.type === 'alien') rect(x - 5, ty + torsoH - 2, 10, 1, P.gold);
  const armUp = mood === 'angry' && step >= 0;
  orect(x - 7, ty + 1 - (armUp ? 3 : 0), 1, torsoH - 2, L.shirt);
  orect(x + 6, ty + 1, 1, torsoH - 2, L.shirt);
  px(x - 7, ty + torsoH - 2 - (armUp ? 3 : 0), L.skin); px(x + 6, ty + torsoH - 2, L.skin);

  // head
  orect(x - 5, hy, 10, 9, L.skin);
  rect(x + 3, hy + 1, 1, 7, L.shade);
  // eyes
  const ey = hy + 3;
  if (mood === 'happy') { rect(x - 4, ey, 2, 1, P.black); rect(x + 1, ey, 2, 1, P.black); }
  else if (L.type === 'alien') { rect(x - 4, ey, 2, 2, P.black); rect(x + 1, ey, 2, 2, P.black); px(x - 1, hy + 1, P.black); }
  else { rect(x - 3, ey, 1, 2, L.type === 'vampire' ? P.red : P.black); rect(x + 2, ey, 1, 2, L.type === 'vampire' ? P.red : P.black); }
  if (mood === 'angry') { px(x - 4, ey - 1, P.black); px(x - 3, ey - 1, P.black); px(x + 2, ey - 1, P.black); px(x + 3, ey - 1, P.black); px(x - 2, ey - 2, P.black); px(x + 1, ey - 2, P.black); }
  // mouth
  const my = hy + 6;
  if (mood === 'happy') { px(x - 2, my - 1, P.black); rect(x - 1, my, 2, 1, P.black); px(x + 1, my - 1, P.black); }
  else if (mood === 'hurt') rect(x - 1, my - 1, 2, 2, P.black);
  else if (mood === 'angry') { rect(x - 2, my, 4, 1, P.black); px(x - 2, my - 1, P.black); px(x + 1, my - 1, P.black); }
  else rect(x - 2, my, 4, 1, P.ddbrown);
  if (o.braces) rect(x - 2, my, 4, 1, P.lgray);
  const fx = o.fx || {};
  if (fx.soot) { drect(x - 5, hy, 10, 9, P.black); px(x - 4, hy - 1, P.black); px(x, hy - 2, P.black); px(x + 3, hy - 1, P.black); }
  if (fx.foam) { px(x - 4, my, P.white); px(x + 3, my - 1, P.white); px(x + 4, my + 1, P.white); px(x - 3, my + 2, P.white); }
  if (fx.cement) { rect(x - 4, hy + 1, 2, 2, P.gray); px(x + 2, hy + 6, P.gray); px(x + 3, hy + 2, P.lgray); }
  if (fx.soot || fx.singed) { const k = Math.floor(t * 3) % 3; px(x - 2 + k, hy - 3 - k, P.gray); px(x + 2 - k, hy - 5 + k, P.lgray); }
  if (fx.bump) { rect(x, hy - 2, 3, 2, L.skin); px(x, hy - 2, P.black); px(x + 2, hy - 2, P.black); const a = t * 6; px(x + Math.round(Math.cos(a) * 6), hy - 3 + Math.round(Math.sin(a) * 1.5), P.yellow); px(x - Math.round(Math.cos(a) * 6), hy - 3 - Math.round(Math.sin(a) * 1.5), P.yellow); }

  // hair & hats
  switch (L.hair) {
    case 'short': rect(x - 5, hy, 10, 2, L.hc); px(x - 5, hy + 2, L.hc); px(x + 4, hy + 2, L.hc); break;
    case 'spiky': rect(x - 5, hy, 10, 2, L.hc); for (let i = -4; i <= 3; i += 3) { px(x + i, hy - 1, L.hc); px(x + i + 1, hy - 2, L.hc); } break;
    case 'bob': rect(x - 5, hy, 10, 2, L.hc); rect(x - 6, hy, 2, 8, L.hc); rect(x + 4, hy, 2, 8, L.hc); break;
    case 'bald': rect(x - 5, hy + 2, 1, 3, L.hc); rect(x + 4, hy + 2, 1, 3, L.hc); px(x - 2, hy + 1, P.white); break;
    case 'afro': rect(x - 5, hy, 10, 2, L.hc); break;
    case 'pony': rect(x - 5, hy, 10, 2, L.hc); rect(x + 5, hy + 1, 2, 5, L.hc); px(x + 5, hy + 1, P.red); break;
    case 'bandana': rect(x - 5, hy, 10, 3, P.red); px(x - 3, hy + 1, P.white); px(x + 1, hy + 1, P.white); px(x + 5, hy + 1, P.red); px(x + 6, hy + 2, P.red); break;
    case 'slick': rect(x - 5, hy, 10, 2, P.black); px(x - 1, hy + 2, P.black); px(x, hy + 2, P.black); break;
    case 'fin': rect(x - 2, hy - 1, 3, 1, L.skin); rect(x - 1, hy - 2, 2, 1, L.skin); px(x, hy - 3, L.skin); px(x - 3, hy - 1, P.black); px(x - 2, hy - 2, P.black); px(x - 1, hy - 3, P.black); break;
    case 'bun': rect(x - 5, hy, 10, 2, P.white); orect(x - 2, hy - 3, 4, 2, P.white); break;
    case 'beanie': {
      rect(x - 5, hy, 10, 2, P.red); rect(x - 5, hy + 1, 10, 1, P.yellow); px(x, hy - 1, P.gray);
      const sp = Math.floor(t * 12) % 2;
      if (sp) rect(x - 3, hy - 2, 7, 1, P.sky); else rect(x - 1, hy - 2, 3, 1, P.sky);
      break;
    }
    case 'antennae':
      px(x - 3, hy - 1, P.black); px(x - 4, hy - 2, P.black); px(x - 4, hy - 3, P.yellow);
      px(x + 2, hy - 1, P.black); px(x + 3, hy - 2, P.black); px(x + 3, hy - 3, P.yellow); break;
  }
  // accessories
  if (L.type === 'pirate') { rect(x + 1, ey, 2, 2, P.black); rect(x - 5, ey - 1, 6, 1, P.black); rect(x - 4, my, 8, 2, P.dbrown); px(x - 1, my, P.gold); }
  if (L.type === 'vampire' && mood !== 'happy') { px(x - 2, my + 1, P.white); px(x + 1, my + 1, P.white); }
  if (L.type === 'shark') { rect(x - 4, hy + 5, 8, 3, P.white); for (let i = -3; i < 3; i += 2) px(x + i, hy + 5, P.dgray); }
  if (L.glasses) { outline(x - 5, ey - 1, 4, 4, L.type === 'grandma' ? P.gold : P.black); outline(x, ey - 1, 4, 4, L.type === 'grandma' ? P.gold : P.black); }
  if (L.stache) rect(x - 3, my - 1, 6, 1, L.hc === P.yellow ? P.gold : L.hc);
  if (L.freckles) { px(x - 4, ey + 2, P.brown); px(x + 3, ey + 2, P.brown); }
  if (L.type === 'kid') { line(x + 7, ty + torsoH - 2, x + 7, ty - 2, P.white); circle(x + 7, ty - 4, 2, P.hot); px(x + 7, ty - 4, P.white); }
}

function drawDentist(x, y, t, o = {}) {
  x = Math.round(x); y = Math.round(y);
  const bob = Math.floor(t * 2) % 2;
  const ty = y - 4 - 10 + (o.busy ? 0 : -bob * 0), hy = ty - 10;
  rect(x - 4, y - 4, 3, 4, P.blue); rect(x + 1, y - 4, 3, 4, P.blue);
  rect(x - 5, y - 1, 4, 1, P.black); rect(x + 1, y - 1, 4, 1, P.black);
  orect(x - 6, ty, 12, 11, P.white);
  rect(x + 3, ty + 1, 2, 10, P.lgray); rect(x - 1, ty, 2, 4, P.sky); px(x - 4, ty + 5, P.red);
  orect(x - 8, ty + 1, 1, 7, P.white); orect(x + 7, ty + 1, 1, 7, P.white);
  px(x - 8, ty + 8, P.cyan); px(x + 7, ty + 8, P.cyan);
  orect(x - 5, hy, 10, 9, P.skin);
  rect(x + 3, hy + 1, 1, 7, P.skin2);
  rect(x - 5, hy, 10, 2, P.dbrown); px(x - 5, hy + 2, P.dbrown); px(x + 4, hy + 2, P.dbrown);
  rect(x - 3, hy + 4, 1, 2, P.black); rect(x + 2, hy + 4, 1, 2, P.black);
  rect(x - 4, hy + 6, 8, 3, P.cyan); px(x - 5, hy + 5, P.cyan); px(x + 4, hy + 5, P.cyan); // mask
  circle(x - 1, hy + 1, 2, P.lgray); px(x - 1, hy + 1, P.white); // head mirror
}

// Clinic interior. seats: x positions for the waiting chairs.
const SEATS = [50, 68, 86, 104];
const CHAIR_X = 263, DENT_X = 238, DOOR_X = 19, FLOOR_Y = 118;
function drawClinic(t, up, o = {}) {
  // wall & wallpaper
  rect(0, 12, W, 108, P.lgray);
  for (let x = 4; x < W; x += 16) drect(x, 12, 6, 78, P.white);
  rect(0, 88, W, 2, P.white); rect(0, 90, W, 1, P.gray);
  rect(0, 91, W, 27, P.sky);
  for (let x = 10; x < W; x += 22) { rect(x, 94, 1, 21, P.blue); rect(x + 1, 94, 1, 21, P.cyan); }
  rect(0, 116, W, 2, P.slate);
  // floor
  for (let r = 0; r < 7; r++) for (let c = 0; c < 21; c++) {
    rect(c * 16 - (r % 2) * 8, 118 + r * 9, 16, 9, (c + r) % 2 ? P.white : P.lgray);
  }
  drect(0, 118, W, 2, P.gray);
  // rug under the waiting area + rolling stool + gumball machine
  ellipse(78, 132, 52, 9, P.dred); ellipse(78, 132, 48, 7, P.red); dellipse(78, 132, 40, 5, P.salmon);
  ellipse(CHAIR_X, 132, 34, 6, P.blue); dellipse(CHAIR_X, 132, 30, 4, P.sky);
  orect(150, 150, 10, 3, P.red); rect(154, 143, 2, 7, P.gray); circle(155, 138, 7, P.black); circle(155, 138, 6, P.cyan);
  for (const [gx, gy, gc] of [[152, 137, P.red], [156, 140, P.yellow], [158, 136, P.green], [154, 141, P.pink], [151, 140, P.white]]) px(gx, gy, gc);
  rect(150, 133, 3, 2, P.white);
  orect(214, 140, 14, 3, P.slate); rect(220, 143, 2, 7, P.gray); rect(215, 150, 12, 1, P.black);
  // ceiling lights
  for (const lx of [60, 160, 260]) { rect(lx - 10, 12, 20, 2, P.white); rect(lx - 8, 14, 16, 1, P.yellow); }

  // door
  const dopen = o.door || 0;
  rect(DOOR_X - 14, 60, 28, 58, P.dbrown);
  rect(DOOR_X - 12, 62, 24, 56, P.navy);
  const dw = Math.round(24 * (1 - dopen * 0.8));
  rect(DOOR_X - 12, 62, dw, 56, P.brown);
  if (dw > 12) {
    rect(DOOR_X - 9, 66, dw - 6, 16, P.cyan); drect(DOOR_X - 9, 66, dw - 6, 16, P.white);
    px(DOOR_X - 12 + dw - 4, 92, P.gold); px(DOOR_X - 12 + dw - 4, 93, P.gold);
    UI.panel(DOOR_X - 10, 85, 20, 9, o.closed ? P.dred : P.dgreen);
    text(o.closed ? 'SHUT' : 'OPEN', DOOR_X, 87, P.white, 1, { align: 'c' });
  }

  // window with drifting clouds
  rect(120, 26, 46, 42, P.white);
  rect(123, 29, 40, 36, P.sky);
  drect(123, 52, 40, 13, P.cyan);
  G.save(); G.beginPath(); G.rect(123, 29, 40, 36); G.clip();
  for (let i = 0; i < 3; i++) {
    const cx = 123 + ((t * 4 + i * 23) % 64) - 12, cy = 36 + i * 8;
    ellipse(cx, cy, 7, 2, P.white); ellipse(cx + 4, cy - 1, 4, 2, P.white);
  }
  G.restore();
  rect(142, 29, 2, 36, P.white); rect(123, 46, 40, 2, P.white);
  rect(118, 68, 50, 3, P.white); rect(118, 71, 50, 1, P.gray);

  // clock
  circle(96, 40, 7, P.black); circle(96, 40, 6, P.white);
  const ang = t * 0.5;
  line(96, 40, 96 + Math.round(Math.cos(ang) * 4), 40 + Math.round(Math.sin(ang) * 4), P.black);
  line(96, 40, 96, 36, P.red);
  // poster
  UI.panel(172, 28, 26, 32, P.yellow, P.black, P.gold);
  spr(TOOTH9, 180, 32, false);
  text('FLOSS', 185, 45, P.red, 1, { align: 'c' });
  text('!!!', 185, 52, P.red, 1, { align: 'c' });
  // sign
  const sw = textW('DR. CRAZY, DDS') + 12;
  UI.panel(259 - sw / 2, 18, sw, 13, P.navy, P.black, P.gold);
  text('DR. CRAZY, DDS', 259, 22, P.gold, 1, { align: 'c' });

  // plant
  rect(110, 106, 10, 12, P.rust); rect(110, 106, 10, 2, P.clay);
  for (let i = 0; i < 5; i++) { const lx = 115 + Math.round(Math.sin(t * 1.5 + i) * 0.6); ellipse(lx + (i - 2) * 3, 96 + Math.abs(i - 2) * 3, 2, 5, i % 2 ? P.green : P.dgreen); }

  // fish tank upgrade
  if (up && up.tank) {
    rect(128, 108, 34, 10, P.dbrown);
    rect(128, 88, 34, 20, P.black); rect(129, 89, 32, 18, P.blue); drect(129, 89, 32, 18, P.sky);
    rect(129, 104, 32, 3, P.tan);
    for (let i = 0; i < 3; i++) {
      const fx = 131 + ((t * (8 + i * 3) + i * 11) % 28), fy = 93 + i * 4;
      rect(fx, fy, 3, 2, i === 1 ? P.yellow : P.orange); px(fx - 1, fy, i === 1 ? P.gold : P.rust);
    }
    px(150, 89 + ((t * 10) % 15), P.white);
  }

  // waiting chairs (backs)
  for (const sx of SEATS) { orect(sx - 6, 97, 12, 9, up && up.chairs ? P.plum : P.orange); rect(sx - 5, 98, 10, 1, up && up.chairs ? P.pink : P.gold); }

  // dentist chair
  rect(286, 12, 2, 30, P.gray);
  line(287, 42, 276, 56, P.gray, 2);
  ellipse(274, 59, 7, 3, P.black); ellipse(274, 58, 6, 2, P.lgray); rect(269, 60, 10, 1, P.yellow);
  if (o.lit) { G.globalAlpha = 0.35; tri(268, 61, 280, 61, 290, 96, P.yellow); tri(268, 61, 240, 96, 290, 96, P.yellow); G.globalAlpha = 1; }
  orect(CHAIR_X - 7, 76, 14, 5, P.sky);
  orect(CHAIR_X - 9, 82, 18, 20, P.sky); rect(CHAIR_X - 8, 83, 2, 18, P.cyan);
  rect(CHAIR_X - 3, 107, 6, 8, P.gray); orect(CHAIR_X - 11, 115, 22, 2, P.dgray);
  // tool tray
  rect(301, 80, 2, 38, P.gray); orect(292, 78, 20, 2, P.lgray);
  px(295, 77, P.dgray); px(298, 77, P.red); px(301, 76, P.gray); px(305, 77, P.sky); px(308, 77, P.gold);
}
// Parts drawn in front of seated patients
function drawSeatFronts(up) {
  for (const sx of SEATS) { orect(sx - 7, 106, 14, 3, up && up.chairs ? P.plum : P.orange); rect(sx - 6, 110, 1, 7, P.dgray); rect(sx + 5, 110, 1, 7, P.dgray); }
  orect(CHAIR_X - 10, 103, 20, 4, P.sky);
  orect(CHAIR_X - 12, 99, 3, 2, P.sky); orect(CHAIR_X + 9, 99, 3, 2, P.sky);
}

// ---------- icons ----------
const TOOTH9 = [
  '.ooo.ooo.',
  'owwwowwwo',
  'owwwwwwlo',
  'owwwwwwlo',
  '.owwwwlo.',
  '.owwowlo.',
  '.owo.olo.',
  '.owo.olo.',
  '..o...o..',
];
const TOOTH_MAP = { o: P.black, w: P.white, l: P.lgray };
const STAR7 = ['...o...', '..ooo..', 'ooooooo', '.ooooo.', '..ooo..', '.oo.oo.', '.o...o.'];
function star(x, y, fill = 1) {
  spr(STAR7, x, y, false, { o: P.slate });
  if (fill > 0) {
    G.save(); G.beginPath(); G.rect(Math.round(x), Math.round(y), Math.round(7 * fill), 7); G.clip();
    spr(STAR7, x, y, false, { o: P.gold }); G.restore();
  }
}
function stars(x, y, rep) { for (let i = 0; i < 5; i++) star(x + i * 8, y, clamp(rep - i, 0, 1)); }
function coin(x, y) { circle(x + 2, y + 2, 3, P.black); circle(x + 2, y + 2, 2, P.gold); px(x + 1, y + 1, P.yellow); rect(x + 2, y + 1, 1, 3, P.orange); }

const PROC = {
  extract: { name: 'EXTRACTION', short: 'PULL', price: 25 },
  clean: { name: 'CLEANING', short: 'CLEAN', price: 20 },
  cavity: { name: 'CAVITY FILL', short: 'FILL', price: 35 },
  canal: { name: 'ROOT CANAL', short: 'CANAL', price: 50 },
  braces: { name: 'BRACES', short: 'BRACES', price: 60 },
  numb: { name: 'NUMBING SHOT', short: 'NUMB', price: 0 },
};
function procIcon(k, x, y) {
  x = Math.round(x); y = Math.round(y);
  if (k === 'numb') {
    line(x + 1, y + 8, x + 3, y + 6, P.lgray); line(x + 3, y + 6, x + 7, y + 2, P.black, 3); line(x + 3, y + 6, x + 7, y + 2, P.cyan);
    line(x + 7, y + 2, x + 8, y + 1, P.gray); return;
  }
  spr(TOOTH9, x, y, false);
  if (k === 'extract') { rect(x + 2, y + 2, 5, 3, P.dbrown); px(x + 3, y + 3, P.green); px(x + 4, y - 1, P.red); rect(x + 3, y - 2, 3, 1, P.red); }
  if (k === 'clean') { px(x + 2, y + 2, P.yellow); rect(x + 6, y - 1, 1, 3, P.yellow); rect(x + 5, y, 3, 1, P.yellow); }
  if (k === 'cavity') { rect(x + 3, y + 2, 3, 2, P.ddbrown); px(x + 4, y + 4, P.ddbrown); }
  if (k === 'canal') { rect(x + 2, y + 4, 1, 4, P.red); rect(x + 6, y + 4, 1, 4, P.red); rect(x + 3, y + 3, 3, 1, P.red); }
  if (k === 'braces') { rect(x + 1, y + 3, 7, 1, P.gray); rect(x + 3, y + 2, 3, 3, P.lgray); px(x + 4, y + 3, P.gray); }
}

function bubble(x, y, w, h, tailX, tailDown = true) {
  x = Math.round(x); y = Math.round(y);
  rect(x + 1, y, w - 2, h, P.black); rect(x, y + 1, w, h - 2, P.black);
  rect(x + 1, y + 1, w - 2, h - 2, P.white);
  if (tailX != null) {
    if (tailDown) { rect(tailX - 2, y + h - 1, 5, 1, P.white); rect(tailX - 1, y + h, 3, 1, P.white); px(tailX, y + h + 1, P.white); px(tailX - 2, y + h, P.black); px(tailX + 2, y + h, P.black); px(tailX - 1, y + h + 1, P.black); px(tailX + 1, y + h + 1, P.black); px(tailX, y + h + 2, P.black); }
  }
}

// ---------- cursors ----------
const ARROW = ['o.......', 'oo......', 'owo.....', 'owwo....', 'owwwo...', 'owwwwo..', 'owwwwwo.', 'owwwoooo', 'owoowo..', 'oo.owo..', '....oo..'];
function tl(x0, y0, x1, y1, c, th) { line(x0, y0, x1, y1, P.black, th + 2); }
function drawCursor(type, x, y, t, down) {
  x = Math.round(x); y = Math.round(y);
  switch (type) {
    case 'point': spr(ARROW, x, y, false, { o: P.black, w: P.yellow }); break;
    case 'pliers': {
      const o = down ? 1 : 4;
      tl(x, y, x + 6, y + 3, 0, 1); tl(x + 6, y + 3, x + 15, y + 4 - o, 0, 2); tl(x + 6, y + 3, x + 14, y + 9 + o, 0, 2);
      line(x, y - 1, x + 6, y + 2, P.lgray); line(x, y + 1, x + 6, y + 3, P.white);
      line(x + 6, y + 3, x + 15, y + 4 - o, P.red, 2); line(x + 6, y + 3, x + 14, y + 9 + o, P.red, 2);
      px(x + 6, y + 3, P.gold); break;
    }
    case 'brush':
      tl(x + 2, y + 2, x + 14, y + 10, 0, 2); line(x + 2, y + 2, x + 14, y + 10, P.sky, 2);
      rect(x - 4, y - 3, 8, 5, P.black); rect(x - 3, y - 2, 6, 3, P.white); rect(x - 3, y, 6, 1, P.cyan); break;
    case 'drill':
      tl(x + 1, y - 1, x + 6, y - 6, 0, 3); tl(x + 6, y - 6, x + 19, y - 3, 0, 3);
      line(x + 1, y - 1, x + 6, y - 6, P.gray, 3); line(x + 6, y - 6, x + 19, y - 3, P.lgray, 3); line(x + 12, y - 5, x + 19, y - 3, P.sky, 1);
      rect(x - 1, y - 1, 3, 3, P.black); px(x, y, Math.floor(t * 30) % 2 ? P.yellow : P.white); break;
    case 'syringe':
      tl(x + 4, y - 4, x + 12, y - 12, 0, 3);
      line(x, y, x + 4, y - 4, P.lgray); line(x + 4, y - 4, x + 12, y - 12, P.white, 3); line(x + 5, y - 5, x + 9, y - 9, P.cyan, 1);
      line(x + 12, y - 12, x + 15, y - 15, P.gray); rect(x + 13, y - 17, 4, 2, P.gray); break;
    case 'file':
      tl(x, y, x + 6, y - 8, 0, 1); line(x, y, x + 6, y - 8, P.lgray);
      rect(x + 5, y - 14, 5, 6, P.black); rect(x + 6, y - 13, 3, 4, P.yellow); break;
    case 'gun':
      tl(x, y, x + 3, y - 3, 0, 2); tl(x + 3, y - 3, x + 13, y - 9, 0, 4);
      line(x, y, x + 3, y - 3, P.white, 2); line(x + 3, y - 3, x + 13, y - 9, P.sky, 4); line(x + 5, y - 5, x + 12, y - 9, P.cyan, 1);
      rect(x + 9, y - 6, 2, 5, P.black); break;
    case 'tweezers':
      tl(x, y, x + 11, y - 10, 0, 1); line(x, y, x + 11, y - 10, P.lgray); line(x + 1, y + 1, x + 12, y - 8, P.white);
      rect(x - 2, y - 2, 4, 4, P.black); rect(x - 1, y - 1, 2, 2, P.lgray); break;
    default: spr(ARROW, x, y, false, { o: P.black, w: P.white });
  }
}

// ---------- title mascot: a big happy tooth ----------
const _mascot = {};
function mascotSprite(blink) {
  if (_mascot[blink]) return _mascot[blink];
  const w = 46, h = 54, c = makeCanvas(w, h);
  const inside = (x, y) => {
    const ax = x + 0.5, ay = y + 0.5;
    if (ay < 2 || ay > 52) return false;
    if (Math.hypot(ax - 13, ay - 14) < 12.5 || Math.hypot(ax - 33, ay - 14) < 12.5) return true;
    if (ay >= 14 && ay < 36) { const m = (ay - 14) * 0.08; return ax > 1 + m && ax < 45 - m; }
    if (ay >= 36) {
      const k = ay - 36;
      return Math.abs(ax - (12 - k * 0.15)) < 9.5 - k * 0.38 || Math.abs(ax - (34 + k * 0.15)) < 9.5 - k * 0.38;
    }
    return false;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let col = null;
    if (inside(x, y)) {
      col = P.white;
      if (!inside(x + 3, y) || !inside(x, y + 3)) col = P.lgray;
      if (!inside(x + 1, y + 1)) col = P.gray;
    } else if (inside(x + 1, y) || inside(x - 1, y) || inside(x, y + 1) || inside(x, y - 1)) col = P.black;
    if (col) { c.g.fillStyle = col; c.g.fillRect(x, y, 1, 1); }
  }
  withCtx(c.g, () => {
    rect(8, 8, 3, 5, P.white); rect(6, 10, 2, 2, P.white); // shine
    if (blink) { rect(14, 24, 5, 1, P.black); rect(27, 24, 5, 1, P.black); }
    else {
      rect(14, 20, 5, 7, P.black); rect(27, 20, 5, 7, P.black);
      rect(15, 21, 2, 2, P.white); rect(28, 21, 2, 2, P.white);
    }
    rect(9, 29, 5, 2, P.salmon); rect(32, 29, 5, 2, P.salmon);
    rect(19, 30, 8, 4, P.black); rect(20, 32, 6, 2, P.red); rect(20, 30, 6, 1, P.white);
    px(18, 29, P.black); px(27, 29, P.black);
  });
  _mascot[blink] = c;
  return c;
}
