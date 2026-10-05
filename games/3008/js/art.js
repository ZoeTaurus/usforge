'use strict';
// All of the pixel art is drawn here, by code, once at load time.

function line(g, x0, y0, x1, y1, col, w = 1) {
  g.fillStyle = col;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    g.fillRect(x0, y0, w, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
function ellipse(g, cx, cy, rx, ry, col) {
  g.fillStyle = col;
  for (let y = -ry; y <= ry; y++) {
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry + .01))));
    g.fillRect(cx - w, cy + y, w * 2 + 1, 1);
  }
}
function mirrored(c) { return canvas(c.width, c.height, g => { g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(c, 0, 0); }); }

// ============================================================ palettes
// the store is split into sections; each has its own colour of storage bins on the walkway shelves
const WINGS = [
  { name: 'SECTION A', locker: '#2f5fa8', stripe: '#f2c230', accent: '#e9e6dc' },
  { name: 'SECTION B', locker: '#4f8a5a', stripe: '#f2c230', accent: '#e4e8de' },
  { name: 'SECTION C', locker: '#b84a3a', stripe: '#f2c230', accent: '#ece2dc' },
  { name: 'SECTION D', locker: '#d8a82a', stripe: '#f2c230', accent: '#ebe6d6' }
];
const BOOKS = ['#8a2a2a', '#2a4a8a', '#2a6a3a', '#8a6a1a', '#5a2a6a', '#1a5a6a', '#a04a1a', '#3a3a3a', '#c8b48a', '#6a1a2a'];
const PAINT = ['#d9483b', '#3b7dd9', '#e8c33a', '#4cae5b', '#9b59b6', '#ef8a3a'];
const BIRCH = { L: '#f0dcb8', M: '#e2c89c', D: '#c8a878', X: '#9a7a4e' };
const WHITE = { L: '#ffffff', M: '#eeece6', D: '#cfccc2', X: '#9c988c' };

// ============================================================ floors
function vct(g, R, a, b, grout, size, specks) {
  for (let y = 0; y < T; y += size) for (let x = 0; x < T; x += size) {
    const c = ((x + y) / size) % 2 ? b : a;
    rect(g, x, y, size, size, c);
    speckle(g, R, x + 1, y + 1, size - 1, size - 1, (size * size) / 9, specks);
    rect(g, x, y, size, 1, grout); rect(g, x, y, 1, size, grout);
    rect(g, x + 1, y + 1, size - 2, 1, shade(c, 1.04));
  }
}
function carpet(g, R, base, cols, pattern) {
  rect(g, 0, 0, T, T, base);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    if (pattern && pattern(x, y)) px(g, x, y, shade(base, 1.14));
    else if (R() < .28) px(g, x, y, cols[(R() * cols.length) | 0]);
  }
}
function planks(g, R, cols, line, h = 8) {
  for (let y = 0; y < T; y += h) {
    const off = ((y / h) * 13 + ((R() * 6) | 0)) % T;
    const c = cols[(R() * cols.length) | 0];
    rect(g, 0, y, T, h, c); rect(g, 0, y + h - 1, T, 1, line);
    rect(g, off, y, 1, h - 1, line);
    for (let i = 0; i < 3; i++) rect(g, (R() * 28) | 0, y + 1 + ((R() * (h - 3)) | 0), 3 + ((R() * 6) | 0), 1, shade(c, R() < .5 ? .95 : 1.04));
  }
}
function floorTex(code, v, accent) {
  const R = rng(4100 + code * 131 + v * 17 + (accent ? 999 : 0));
  return canvas(T, T, g => {
    switch (code) {
      case HALL:   // the walkway: big polished tiles, with the painted path down the middle
        if (accent) { rect(g, 0, 0, T, T, accent); speckle(g, R, 0, 0, T, T, 50, [shade(accent, .95), shade(accent, 1.03)]); rect(g, 0, 0, T, 1, shade(accent, .9)); rect(g, 0, 0, 1, T, shade(accent, .9)); }
        else vct(g, R, '#cbc9c2', '#c4c2bb', '#b0aea7', 32, ['#bdbbb4', '#d6d4cd', '#b5b3ac', '#d0cec7']);
        if (v === 2 && !accent) { rect(g, 4 + ((R() * 18) | 0), 6 + ((R() * 18) | 0), 6, 1, 'rgba(60,50,40,.14)'); }
        break;
      case FLOOR0 + RT.CLASS:      // living rooms: light oak
        planks(g, R, ['#d8b585', '#d2ae7d', '#dcbb8c', '#cfaa78'], '#b38f60');
        break;
      case FLOOR0 + RT.LIB:        // bookcases: grey carpet tiles
        carpet(g, R, '#8d9196', ['#83878c', '#979ba0', '#7d8186'], (x, y) => x === 0 || y === 0);
        break;
      case FLOOR0 + RT.CAFE:       // restaurant
        vct(g, R, '#e6e1d6', '#d6cdbb', '#c2b9a6', 16, ['#d8d2c4', '#f0ece2', '#c8bfab']);
        break;
      case FLOOR0 + RT.STORE:      // warehouse: bare concrete with a yellow safety line
        rect(g, 0, 0, T, T, '#8b8b84');
        speckle(g, R, 0, 0, T, T, 240, ['#7d7d76', '#97978f', '#727269', '#a19f97']);
        rect(g, 0, 0, T, 1, '#76766f');
        if (v === 1) { let x = 6, y = 2; for (let i = 0; i < 40 && y < 31; i++) { px(g, x, y, '#5e5e57'); x += R() < .5 ? 1 : R() < .5 ? -1 : 0; y += R() < .7 ? 1 : 0; x = clamp(x, 1, 30); } }
        if (v === 2) { ellipse(g, 16, 18, 7, 4, '#6f6d64'); ellipse(g, 14, 17, 4, 2, '#65635a'); }
        break;
      case FLOOR0 + RT.COMMONS:    // marketplace
        rect(g, 0, 0, T, T, '#d2cab7');
        speckle(g, R, 0, 0, T, T, 120, ['#9c8f78', '#ece6d8', '#7d8b8f', '#b06e5a', '#5d6b5a', '#c9b48e']);
        rect(g, 0, 0, T, 1, '#b9b09c'); rect(g, 0, 0, 1, T, '#b9b09c');
        break;
      case FLOOR0 + RT.BATH:
        for (let y = 0; y < T; y += 8) for (let x = 0; x < T; x += 8) {
          rect(g, x, y, 8, 8, (v === 2 && x === 16 && y === 8) ? '#8fb3c8' : '#e7ebec');
          rect(g, x, y, 8, 1, '#b9c2c6'); rect(g, x, y, 1, 8, '#b9c2c6'); px(g, x + 2, y + 2, '#f6f8f8');
        }
        break;
      case FLOOR0 + RT.GYM: {      // children's: soft foam play tiles
        const cols = ['#d88a7e', '#8ab0d8', '#e8d48a', '#94c89a'];
        for (let y = 0; y < T; y += 16) for (let x = 0; x < T; x += 16) {
          const c = (x + y) % 32 ? '#e8e0cc' : cols[(v + (x >> 4)) % 4];
          rect(g, x, y, 16, 16, c); rect(g, x, y, 16, 1, shade(c, 1.15)); rect(g, x, y + 15, 16, 1, shade(c, .8));
          for (let i = 0; i < 16; i += 4) { px(g, x + i, y + 15, shade(c, 1.1)); px(g, x + 15, y + i, shade(c, .8)); }
        }
        break;
      }
      case FLOOR0 + RT.SCIENCE:    // kitchens: black and white tiles
        vct(g, R, '#e4e4e0', '#9a9ca0', '#b8b8b4', 16, ['#d8d8d4', '#8a8c90']);
        break;
      case FLOOR0 + RT.MUSIC:      // bedrooms: soft beige carpet
        carpet(g, R, '#cbbba0', ['#c2b296', '#d5c6ac', '#bba98c'], (x, y) => y % 8 === 0 && x % 2 === 0);
        break;
      case FLOOR0 + RT.ART:        // decoration: pale birch
        planks(g, R, ['#ecd9b8', '#e6d2ae', '#f0dfc0'], '#cdb48c', 16);
        break;
      case FLOOR0 + RT.NURSE:
        vct(g, R, '#bfd9cc', '#bfd9cc', '#a3bfb2', 32, ['#a9c6b8', '#d3e8de', '#98b5a7']);
        break;
      case FLOOR0 + RT.LOUNGE:
        carpet(g, R, '#715843', ['#664f3c', '#7d6350', '#5e4836'], (x, y) => (x % 8 === 0 && y % 8 === 0));
        break;
      case FLOOR0 + RT.OFFICE:
        for (let y = 0; y < T; y += 8) for (let x = 0; x < T; x += 8) {
          const hor = ((x + y) / 8) % 2 === 0, c = ['#8b5a34', '#7a4e2c', '#986640'][((x * 3 + y * 5 + v) / 8 | 0) % 3];
          rect(g, x, y, 8, 8, c);
          if (hor) { rect(g, x, y + 3, 8, 1, shade(c, .8)); rect(g, x, y + 7, 8, 1, shade(c, .7)); }
          else { rect(g, x + 3, y, 1, 8, shade(c, .8)); rect(g, x + 7, y, 1, 8, shade(c, .7)); }
        }
        break;
    }
  });
}
// the arrows painted on the walkway: follow them and you will see everything (you will not find the way out)
const ARROW = [0, 1, 2, 3].map(dir => canvas(T, T, g => {
  const c = '#2c4f8f';
  g.translate(16, 16); g.rotate(dir * Math.PI / 2);
  for (let y = -5; y <= 4; y++) for (let x = -4; x <= 4; x++) {
    const inHead = y <= -1 && Math.abs(x) <= y + 5, inTail = y > -1 && Math.abs(x) <= 2;
    if (inHead || inTail) { g.fillStyle = c; g.fillRect(x * 2, y * 2, 2, 2); }
  }
}));
const FLOORS = {}, HALL_ACCENT = [];
for (let code = 0; code < FLOOR0 + NRT; code++) if (code !== WALL) FLOORS[code] = [0, 1, 2].map(v => floorTex(code, v));
WINGS.forEach((w, i) => { HALL_ACCENT[i] = [0, 1, 2].map(v => floorTex(HALL, v, w.accent)); });

// floor decals: litter and the things people left behind
const DECALS = {
  paper: g => { rect(g, 12, 9, 7, 14, '#f6f4ee'); for (const y of [11, 13, 15, 17]) rect(g, 13, y, 5, 1, '#a0a4aa'); rect(g, 13, 20, 3, 1, '#2a2a2a'); for (let x = 12; x < 19; x += 2) px(g, x, 23, '#f6f4ee'); },   // a receipt
  papers: g => { rect(g, 6, 9, 13, 10, '#f2efe6'); rect(g, 6, 9, 13, 3, '#2c5fa8'); rect(g, 8, 13, 4, 4, '#d8b585'); rect(g, 13, 13, 4, 1, '#9aa3ad'); rect(g, 13, 15, 3, 1, '#9aa3ad'); rect(g, 17, 15, 9, 7, '#f6f4ee'); rect(g, 18, 17, 6, 1, '#9aa3ad'); rect(g, 18, 19, 5, 1, '#9aa3ad'); },   // catalogue pages, a shopping list
  crumple: g => { ellipse(g, 15, 18, 3, 2, '#e6e2d6'); px(g, 14, 17, '#bdb8aa'); px(g, 16, 19, '#bdb8aa'); px(g, 17, 17, '#f6f4ee'); },
  pencil: g => { rect(g, 12, 20, 6, 2, '#d8b585'); rect(g, 12, 21, 6, 1, '#b8956a'); px(g, 18, 20, '#e8c8a0'); px(g, 19, 20, '#2a2a2a'); },   // one of the little pencils
  gum: g => { ellipse(g, 16, 20, 2, 1, '#d87a9a'); px(g, 15, 19, '#f0a8c0'); },
  stain: g => { ellipse(g, 16, 18, 7, 4, 'rgba(70,52,30,.32)'); ellipse(g, 19, 20, 3, 2, 'rgba(70,52,30,.25)'); },
  puddle: g => { ellipse(g, 15, 19, 8, 4, 'rgba(120,160,190,.45)'); ellipse(g, 12, 18, 3, 1, 'rgba(230,240,250,.55)'); },
  backpack: g => { rect(g, 8, 12, 16, 12, '#2c5fa8'); rect(g, 8, 12, 16, 1, '#4a7ac8'); rect(g, 8, 23, 16, 1, '#1e4380'); line(g, 10, 12, 12, 7, '#2c5fa8'); line(g, 21, 12, 19, 7, '#2c5fa8'); rect(g, 12, 7, 8, 1, '#2c5fa8'); rect(g, 11, 15, 10, 1, '#1e4380'); },   // someone's big blue shopping bag
  shoe: g => { rect(g, 11, 18, 10, 4, '#e8e8e8'); rect(g, 11, 21, 11, 1, '#b8443c'); rect(g, 12, 17, 5, 2, '#e8e8e8'); rect(g, 13, 18, 3, 1, '#7a8a9a'); },
  chalk: g => { rect(g, 11, 14, 10, 6, '#f2c230'); rect(g, 11, 14, 10, 1, '#f8dc70'); tiny(g, '$9', 12, 15, '#1f3f7a'); px(g, 11, 20, '#c89a20'); },   // a fallen price tag
  scuff: g => { rect(g, 6, 14, 12, 1, 'rgba(30,30,30,.25)'); rect(g, 14, 19, 10, 1, 'rgba(30,30,30,.2)'); },
  marble: g => { rect(g, 11, 13, 2, 9, '#6a7480'); rect(g, 11, 21, 8, 2, '#6a7480'); px(g, 11, 13, '#9aa6b2'); px(g, 18, 21, '#9aa6b2'); }   // an allen key
};
const DECAL = {};
for (const k in DECALS) DECAL[k] = canvas(T, T, DECALS[k]);

// ============================================================ walls
function faceBase(g, d) {
  switch (d.style) {
    case 'tiles': {
      for (let y = 0; y < 24; y += 6) for (let x = 0; x < T; x += 8) {
        const off = (y / 6) % 2 ? 4 : 0;
        rect(g, (x + off) % T, y, 8, 6, '#e9edee'); rect(g, (x + off) % T, y, 8, 1, '#c1cacd'); rect(g, (x + off) % T, y, 1, 6, '#c1cacd');
      }
      rect(g, 0, 18, T, 2, d.stripe); rect(g, 0, 24, T, 4, '#d4dadc'); break;
    }
    case 'panel':
      rect(g, 0, 0, T, 16, d.upper); rect(g, 0, 0, T, 2, shade(d.upper, 1.08));
      rect(g, 0, 16, T, 12, '#6e4528'); rect(g, 0, 16, T, 2, '#8a5a34');
      for (let x = 0; x < T; x += 8) { rect(g, x, 18, 1, 10, '#5a3820'); rect(g, x + 1, 18, 1, 10, '#7a5030'); }
      break;
    case 'acoustic':
      rect(g, 0, 0, T, 28, d.upper);
      for (let y = 2; y < 26; y += 12) { rect(g, 2, y, 28, 10, shade(d.upper, .9)); for (let yy = y + 1; yy < y + 10; yy += 2) for (let xx = 3 + (yy % 4 === 1 ? 1 : 0); xx < 30; xx += 2) px(g, xx, yy, shade(d.upper, .78)); }
      break;
    case 'plain':
      rect(g, 0, 0, T, 28, '#9a9a94');
      for (let r = 0; r < 4; r++) { rect(g, 0, r * 7 + 6, T, 1, '#83837d'); for (let x = r % 2 ? 8 : 0; x < T; x += 16) rect(g, x, r * 7, 1, 6, '#83837d'); }
      break;
    case 'drywall':   // flat paint, two-tone with a stripe
      rect(g, 0, 0, T, 19, d.upper); rect(g, 0, 19, T, 2, d.stripe); rect(g, 0, 21, T, 7, d.lower);
      rect(g, 0, 0, T, 1, shade(d.upper, 1.04)); rect(g, 0, 21, T, 1, shade(d.lower, 1.12));
      break;
    default: {   // painted cinder block, two-tone with a stripe
      rect(g, 0, 0, T, 19, d.upper); rect(g, 0, 19, T, 2, d.stripe); rect(g, 0, 21, T, 7, d.lower);
      rect(g, 0, 0, T, 2, shade(d.upper, 1.1));
      const mu = shade(d.upper, .9), ml = shade(d.lower, .88);
      for (let r = 0; r < 4; r++) {
        const y = r * 7 + 2, c = y > 18 ? ml : mu;
        rect(g, 0, y + 6, T, 1, c);
        for (let x = r % 2 ? 8 : 0; x < T; x += 16) rect(g, x, y, 1, 6, c);
      }
      const R = rng(d.seed || 1);
      if (R() < .4) rect(g, (R() * 24) | 0, 22 + ((R() * 4) | 0), 4 + ((R() * 5) | 0), 1, shade(d.lower, .75));
    }
  }
  rect(g, 0, 28, T, 4, '#3b403c'); rect(g, 0, 28, T, 1, '#5a615c');
}
// the walkway walls are shelving: birch cubes full of storage bins (and, at night, things looking out of the empty ones)
function lockerFace(g, d) {
  const c = d.locker, cL = shade(c, 1.2), cD = shade(c, .72);
  rect(g, 0, 0, T, 28, BIRCH.D); rect(g, 0, 0, T, 2, BIRCH.L);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    const x = 1 + i * 16, y = 2 + j * 13, w = 14, h = 11, empty = j === 0 && d.ajar && d.ajar[i];
    rect(g, x, y, w, h, '#1c1610'); rect(g, x, y, w, 1, '#0e0a06');
    if (empty) { if (d.eyes && d.eyes[i]) { px(g, x + 3, y + 5, '#ff2a20'); px(g, x + 6, y + 5, '#ff2a20'); } continue; }
    if ((i + j + (d.seed & 1)) % 3 === 2) {   // a stack of folded towels instead of a bin
      const tc = ['#e8e4d8', '#c8d8e8', '#e8c8c0'][(d.seed >>> 2) % 3];
      for (let k = 0; k < 3; k++) { rect(g, x + 2, y + 3 + k * 3, w - 4, 3, tc); rect(g, x + 2, y + 5 + k * 3, w - 4, 1, shade(tc, .82)); }
      continue;
    }
    rect(g, x + 1, y + 2, w - 2, h - 2, c); rect(g, x + 1, y + 2, w - 2, 1, cL); rect(g, x + w - 2, y + 3, 1, h - 3, cD);
    rect(g, x + 5, y + 4, 4, 1, cD);
  }
  for (const x of [0, 15, 31]) rect(g, x, 0, x === 15 ? 2 : 1, 28, BIRCH.M);
  rect(g, 0, 13, T, 2, BIRCH.M); rect(g, 0, 13, T, 1, BIRCH.L);
  // the little yellow price tags along the shelf edge
  for (let i = 0; i < 2; i++) { rect(g, 3 + i * 16, 15, 9, 4, d.lock && d.lock[i] ? '#d83a2a' : '#f2c230'); tiny(g, d.nums ? d.nums[i].slice(-2) : '00', 4 + i * 16, 15, d.lock && d.lock[i] ? '#ffffff' : '#1f3f7a', 1); }
  rect(g, 0, 28, T, 4, '#202428'); rect(g, 0, 28, T, 1, '#3a4046');
}
const POSTERS = [
  { a: ['NEW', 'LOW'], n: ['STAY', 'HERE'], bg: '#f2c230', ink: '#1f3f7a', icon: 'star' },
  { a: ['COZY', 'HOME'], n: ['NO', 'EXIT'], bg: '#2c5fa8', ink: '#f2c230', icon: 'heart' },
  { a: ['SALE', '50%'], n: ['DONT', 'RUN'], bg: '#d84a3a', ink: '#ffffff', icon: 'star' },
  { a: ['FLAT', 'PACK'], n: ['WE', 'SEE'], bg: '#e8e4d8', ink: '#2c4f8f', icon: 'book' },
  { a: ['HOT', 'DOGS'], n: ['GO', 'HOME'], bg: '#f2c230', ink: '#b8282a', icon: 'smile' },
  { a: ['HOME', 'SWEET'], n: ['BE', 'GONE'], bg: '#4cae5b', ink: '#ffffff', icon: 'heart' },
  { a: ['STAY', 'COZY'], n: ['STAY', 'STAY'], bg: '#2c5fa8', ink: '#ffffff', icon: 'sun' },
  { a: ['SHOP', 'LATE'], n: ['TOO', 'LATE'], bg: '#e8e4d8', ink: '#c83232', icon: 'smile' }
];
function icon(g, kind, x, y, col, night) {
  if (night) { ellipse(g, x + 4, y + 3, 4, 2, '#f2efe6'); rect(g, x + 3, y + 2, 3, 3, '#1a1a1a'); px(g, x + 4, y + 3, '#c81c1c'); return; }
  switch (kind) {
    case 'book': rect(g, x, y + 1, 4, 5, col); rect(g, x + 5, y + 1, 4, 5, col); rect(g, x + 4, y + 1, 1, 6, shade(col, .6)); break;
    case 'heart': rect(g, x + 1, y + 1, 3, 2, col); rect(g, x + 5, y + 1, 3, 2, col); rect(g, x + 1, y + 3, 7, 1, col); rect(g, x + 2, y + 4, 5, 1, col); rect(g, x + 3, y + 5, 3, 1, col); px(g, x + 4, y + 6, col); break;
    case 'shoe': rect(g, x + 1, y + 2, 4, 3, col); rect(g, x + 1, y + 4, 8, 2, col); break;
    case 'drop': px(g, x + 4, y, col); rect(g, x + 3, y + 1, 3, 2, col); rect(g, x + 2, y + 3, 5, 3, col); break;
    case 'star': px(g, x + 4, y, col); rect(g, x + 3, y + 1, 3, 2, col); rect(g, x, y + 3, 9, 1, col); rect(g, x + 2, y + 4, 5, 1, col); rect(g, x + 1, y + 5, 2, 2, col); rect(g, x + 6, y + 5, 2, 2, col); break;
    case 'smile': ellipse(g, x + 4, y + 3, 3, 3, col); px(g, x + 3, y + 2, '#1a1a1a'); px(g, x + 5, y + 2, '#1a1a1a'); rect(g, x + 3, y + 4, 3, 1, '#1a1a1a'); break;
    case 'sun': ellipse(g, x + 4, y + 3, 2, 2, col); for (const [a, b] of [[0, 3], [8, 3], [4, 0], [4, 6], [1, 0], [7, 0], [1, 6], [7, 6]]) px(g, x + a, y + b, col); break;
    case 'shh': rect(g, x + 4, y, 1, 7, col); ellipse(g, x + 4, y + 4, 3, 2, shade(col, .8)); break;
  }
}
const DECOR = {
  poster(g, d) {
    const p = POSTERS[d.k % POSTERS.length], lines = d.night ? p.n : p.a;
    rect(g, 7, 1, 18, 23, '#1d1d1f'); rect(g, 8, 2, 16, 21, p.bg); rect(g, 8, 2, 16, 1, shade(p.bg, 1.15));
    icon(g, p.icon, 12, 3, p.ink, d.night && d.k % 2 === 0);
    tiny(g, lines[0], 16 - (tinyW(lines[0]) >> 1), 11, p.ink); if (lines[1]) tiny(g, lines[1], 16 - (tinyW(lines[1]) >> 1), 17, p.ink);
    px(g, 8, 2, '#c9c9c9'); px(g, 23, 2, '#c9c9c9');
  },
  bulletin(g, d) {
    const R = rng(d.seed);
    rect(g, 2, 2, 28, 19, '#6e4a2a'); rect(g, 3, 3, 26, 17, '#b98b55');
    speckle(g, R, 3, 3, 26, 17, 40, ['#a87c48', '#c89a62']);
    for (let i = 0; i < 5; i++) {
      const w = 5 + ((R() * 4) | 0), h = 6 + ((R() * 3) | 0), x = 4 + ((R() * (24 - w)) | 0), y = 4 + ((R() * (15 - h)) | 0);
      const c = ['#f2efe6', '#f7e98a', '#a8d8f0', '#f8b8c8', '#c8f0b0'][(R() * 5) | 0];
      rect(g, x, y, w, h, c); for (let yy = y + 2; yy < y + h - 1; yy += 2) rect(g, x + 1, yy, w - 2, 1, d.night && R() < .3 ? '#8a1a1a' : '#8a8f96');
      px(g, x + (w >> 1), y, ['#d83a3a', '#3a8ad8', '#e8c33a'][(R() * 3) | 0]);
    }
  },
  window(g, d) {
    rect(g, 3, 1, 26, 22, '#e8e6df'); rect(g, 3, 22, 26, 2, '#b8b4aa');
    const glass = d.night ? '#05070a' : '#e7eef1';
    rect(g, 5, 3, 10, 18, glass); rect(g, 17, 3, 10, 18, glass);
    if (d.night) { line(g, 6, 18, 12, 4, '#11161c'); line(g, 18, 19, 25, 5, '#11161c'); }
    else { rect(g, 5, 3, 10, 18, '#f4f8fa'); line(g, 6, 16, 12, 6, '#ffffff'); line(g, 18, 18, 24, 8, '#ffffff'); rect(g, 5, 18, 22, 3, '#dbe4e8'); }
    for (let y = 3; y < 9; y += 2) { rect(g, 5, y, 10, 1, '#d6d2c6'); rect(g, 17, y, 10, 1, '#d6d2c6'); }
    rect(g, 5, 9, 10, 1, '#b8b4aa'); rect(g, 17, 9, 10, 1, '#b8b4aa');
  },
  clock(g) {
    ellipse(g, 16, 9, 7, 7, '#2a2a2a'); ellipse(g, 16, 9, 6, 6, '#f4f2ea');
    for (const [a, b] of [[16, 4], [16, 14], [11, 9], [21, 9]]) px(g, a, b, '#2a2a2a');
    px(g, 19, 5, '#6a6a6a'); px(g, 13, 5, '#6a6a6a'); px(g, 19, 13, '#6a6a6a'); px(g, 13, 13, '#6a6a6a');
    px(g, 15, 4, '#c8c8c8');
  },
  flag(g, d) {   // a big framed print: a lake, some pines
    rect(g, 5, 2, 22, 17, '#1d1d1f'); rect(g, 6, 3, 20, 15, '#f4f2ea');
    if (d.night) { rect(g, 7, 4, 18, 13, '#14181c'); rect(g, 15, 8, 2, 7, '#050505'); px(g, 15, 9, '#d81c1c'); px(g, 16, 9, '#d81c1c'); return; }
    rect(g, 7, 4, 18, 7, '#bcd4e0'); rect(g, 7, 11, 18, 3, '#5a8ab0'); rect(g, 7, 14, 18, 3, '#4a7a4a');
    for (const x of [9, 12, 21]) { px(g, x, 7, '#2a4a2a'); rect(g, x - 1, 8, 3, 3, '#2a4a2a'); }
  },
  alarm(g) { rect(g, 12, 9, 8, 10, '#c82c2c'); rect(g, 12, 9, 8, 1, '#e85a5a'); rect(g, 14, 13, 4, 2, '#f2f2f2'); rect(g, 13, 17, 6, 1, '#8a1a1a'); },
  speaker(g) { ellipse(g, 16, 7, 5, 5, '#b8b4a8'); for (let y = 3; y < 12; y += 2) for (let x = 12; x < 21; x += 2) if (Math.hypot(x - 16, y - 7) < 4.5) px(g, x, y, '#5a5850'); px(g, 13, 3, '#d8d4c8'); },
  fountain(g) {
    rect(g, 9, 6, 14, 9, '#a8b2bb'); rect(g, 9, 6, 14, 1, '#c8d0d6');
    rect(g, 7, 14, 18, 7, '#c3ccd4'); rect(g, 8, 15, 16, 3, '#8d99a5'); px(g, 16, 16, '#3a4048'); rect(g, 7, 20, 18, 1, '#6b7682');
    rect(g, 20, 13, 2, 2, '#5b6570'); rect(g, 13, 13, 2, 1, '#e0e6ea');
  },
  trophy(g, d) {   // a lit display niche of vases and bowls
    const R = rng(d.seed);
    rect(g, 1, 1, 30, 25, BIRCH.D); rect(g, 3, 3, 26, 20, '#ece8de'); rect(g, 3, 12, 26, 1, BIRCH.M);
    for (let i = 0; i < 4; i++) {
      const x = 5 + i * 6, c = ['#2c5fa8', '#e8e4d8', '#4cae5b', '#d84a3a', '#2a2a2a'][(R() * 5) | 0];
      if (i % 2) { rect(g, x, 7, 4, 5, c); rect(g, x + 1, 5, 2, 2, c); } else { ellipse(g, x + 2, 10, 2, 2, c); }
      const c2 = ['#f2c230', '#c8ccd0', '#8a5a3a'][(R() * 3) | 0];
      rect(g, x, 18, 4, 4, c2); px(g, x, 17, c2); px(g, x + 3, 17, c2);
    }
    if (d.night) for (let i = 0; i < 3; i++) px(g, 6 + i * 8, 20, '#ff2018');
  },
  hooks(g, d) {
    const R = rng(d.seed);
    rect(g, 2, 5, 28, 2, '#8a6a4a');
    for (const x of [5, 15, 25]) {
      px(g, x, 7, '#c8ccd0');
      if (R() < .75) { const c = ['#c84a3a', '#3a6ab8', '#4a9a4a', '#e8c33a', '#7a4ab8'][(R() * 5) | 0]; rect(g, x - 3, 8, 7, 10, c); rect(g, x - 3, 8, 7, 1, shade(c, 1.2)); rect(g, x - 1, 8, 3, 3, shade(c, .7)); }
    }
  },
  exit(g) { rect(g, 8, 0, 17, 7, '#4a0c0c'); rect(g, 9, 1, 15, 5, '#b01818'); tiny(g, 'EXIT', 9, 1, '#ffd8d0'); },
  plate(g, d) {
    const x = d.plateX;
    rect(g, x, 4, 13, 7, '#2a2a2a'); rect(g, x + 1, 5, 11, 5, '#dcd6c4'); tiny(g, d.num, x + 1, 5, '#2a2a2a');
    if (d.icon === 'wc') { rect(g, x + 3, 12, 2, 2, '#3a6ab8'); rect(g, x + 2, 14, 4, 4, '#3a6ab8'); rect(g, x + 8, 12, 2, 2, '#c83a6a'); rect(g, x + 7, 14, 4, 4, '#c83a6a'); }
  },
  mirror(g, d) {
    rect(g, 4, 1, 24, 15, '#8a949a'); rect(g, 5, 2, 22, 13, d.night ? '#1c2328' : '#b8c6cc');
    if (!d.night) { line(g, 7, 12, 14, 3, '#dbe6ea'); line(g, 10, 13, 17, 4, '#dbe6ea'); }
    else if (d.ghost) { rect(g, 13, 5, 6, 7, '#0e1216'); rect(g, 11, 10, 10, 5, '#0e1216'); }
    rect(g, 8, 17, 16, 6, '#f2f2f0'); rect(g, 9, 18, 14, 2, '#c9d0d4'); rect(g, 15, 15, 2, 3, '#c3ccd4'); px(g, 16, 19, '#5b6570');
  },
  hoop(g) {
    rect(g, 6, 0, 20, 14, '#f2f2f2'); rect(g, 6, 0, 20, 1, '#c8ccd0'); rect(g, 12, 4, 8, 7, '#d84a3a'); rect(g, 13, 5, 6, 5, '#f2f2f2');
    rect(g, 11, 14, 10, 2, '#e86a1a'); for (let y = 16; y < 22; y++) for (let x = 12 + ((y - 16) >> 2); x < 20 - ((y - 16) >> 2); x += 2) px(g, x + (y % 2), y, '#f2f2f2');
  },
  score(g, d) {
    rect(g, 2, 2, 28, 14, '#1a1a1a'); rect(g, 2, 2, 28, 1, '#3a3a3a');
    tiny(g, d.night ? '00' : '12', 5, 6, '#ff3a2a'); tiny(g, d.night ? '00' : '07', 20, 6, '#ff3a2a'); tiny(g, ':', 15, 6, '#ff3a2a');
    rect(g, 5, 12, 7, 1, '#e8c33a'); rect(g, 20, 12, 7, 1, '#e8c33a');
  },
  pennant(g, d) {
    const R = rng(d.seed); line(g, 1, 3, 31, 5, '#5a5a5a');
    for (let x = 2; x < 30; x += 7) { const c = PAINT[(R() * PAINT.length) | 0]; for (let i = 0; i < 6; i++) rect(g, x + (i >> 1), 4 + i, 6 - i, 1, c); }
  },
  periodic(g, d) {
    const R = rng(d.seed); rect(g, 2, 2, 28, 18, '#f2efe6');
    for (let y = 0; y < 5; y++) for (let x = 0; x < 9; x++) { if (y < 2 && x > 0 && x < 8) continue; rect(g, 3 + x * 3, 3 + y * 3, 2, 2, ['#e8a0a0', '#a0c8e8', '#a8e0a0', '#f0d890', '#d0b0e8'][(R() * 5) | 0]); }
  },
  eyechart(g, d) {
    rect(g, 8, 1, 16, 22, '#f6f4ee'); rect(g, 8, 1, 16, 1, '#c8c4b8');
    const rows = d.night ? ['WHY', 'ARE', 'YOU'] : ['E', 'FP', 'TOZ'];
    rows.forEach((r, i) => tiny(g, r, 16 - (tinyW(r) >> 1), 3 + i * 6, d.night ? '#8a0a0a' : '#1a1a1a'));
    rect(g, 10, 20, 12, 1, '#c83232');
  },
  drawing(g, d) {
    const R = rng(d.seed); rect(g, 6, 2, 20, 17, '#f6f4ee'); px(g, 16, 2, '#d83a3a');
    if (!d.night) {
      ellipse(g, 21, 6, 2, 2, '#e8c33a'); rect(g, 7, 15, 18, 3, '#5aa84a');
      rect(g, 9, 9, 7, 6, PAINT[(R() * PAINT.length) | 0]); line(g, 9, 9, 12, 6, '#8a3a2a'); line(g, 12, 6, 15, 9, '#8a3a2a');
      line(g, 19, 10, 19, 14, '#1a1a1a'); px(g, 19, 9, '#1a1a1a'); line(g, 18, 15, 19, 14, '#1a1a1a'); line(g, 20, 15, 19, 14, '#1a1a1a');
    } else {
      rect(g, 6, 2, 20, 17, '#e6e0d0');
      line(g, 10, 11, 10, 15, '#1a1a1a'); px(g, 10, 10, '#1a1a1a');
      rect(g, 17, 4, 4, 12, '#101010'); rect(g, 18, 3, 2, 2, '#101010'); px(g, 18, 3, '#d81c1c'); px(g, 19, 3, '#d81c1c');
      line(g, 17, 8, 13, 11, '#101010'); tiny(g, 'HELP', 8, 3 + 1, '#8a0a0a');
    }
  },
  diploma(g, d) {   // EMPLOYEE OF THE MONTH (no face, every month)
    rect(g, 8, 1, 16, 18, '#3a2414'); rect(g, 9, 2, 14, 16, '#f2c230'); rect(g, 10, 3, 12, 10, '#c8d0d8');
    ellipse(g, 16, 7, 3, 3, d.night ? '#9aa39a' : '#e0b48f'); rect(g, 12, 11, 8, 2, '#f2c230');
    if (d.night) { px(g, 15, 6, '#000'); px(g, 17, 6, '#000'); rect(g, 15, 8, 3, 1, '#200'); }
    rect(g, 11, 14, 10, 1, '#1f3f7a'); rect(g, 12, 16, 8, 1, '#1f3f7a');
  },
  wallcab(g, d) {   // kitchen wall cabinets
    rect(g, 0, 1, T, 13, '#cfccc2'); rect(g, 1, 1, 14, 12, d.v ? '#eeece6' : '#3a4a5a'); rect(g, 17, 1, 14, 12, d.v ? '#eeece6' : '#3a4a5a');
    rect(g, 13, 9, 1, 3, '#9c988c'); rect(g, 18, 9, 1, 3, '#9c988c');
    rect(g, 0, 14, T, 8, '#e8e8e4'); for (let x = 0; x < T; x += 8) rect(g, x, 14, 1, 8, '#c8c8c4'); rect(g, 0, 18, T, 1, '#c8c8c4');
    if (d.rail) { rect(g, 4, 16, 24, 1, '#9aa6b2'); for (const x of [7, 13, 19, 25]) { rect(g, x, 17, 1, 4, '#5a6068'); } ellipse(g, 13, 21, 1, 1, '#5a6068'); }
    if (d.night && d.ghost) { rect(g, 1, 1, 14, 12, '#07090c'); px(g, 6, 6, '#ff2018'); px(g, 9, 6, '#ff2018'); }
  },
  print(g, d) {   // framed prints in the decoration department
    const R = rng(d.seed), c = PAINT[(R() * PAINT.length) | 0], c2 = PAINT[(R() * PAINT.length) | 0];
    rect(g, 8, 2, 16, 20, R() < .5 ? '#1d1d1f' : BIRCH.D); rect(g, 9, 3, 14, 18, '#f6f4ee');
    if (d.night) { rect(g, 10, 4, 12, 16, '#e6e0d0'); rect(g, 14, 6, 4, 12, '#101010'); px(g, 15, 7, '#d81c1c'); px(g, 16, 7, '#d81c1c'); return; }
    const k = (R() * 3) | 0;
    if (k === 0) { ellipse(g, 16, 10, 4, 4, c); rect(g, 11, 15, 10, 4, c2); }
    else if (k === 1) { for (let i = 0; i < 4; i++) rect(g, 11 + i * 3, 6 + ((R() * 6) | 0), 2, 12 - ((R() * 6) | 0), i % 2 ? c : c2); }
    else { line(g, 10, 18, 16, 6, c); line(g, 16, 6, 22, 18, c); rect(g, 11, 17, 11, 2, c2); }
  },
  safety(g) { rect(g, 8, 2, 16, 18, '#e8c33a'); rect(g, 9, 3, 14, 16, '#1a1a1a'); rect(g, 11, 7, 4, 3, '#a8d8f0'); rect(g, 17, 7, 4, 3, '#a8d8f0'); rect(g, 15, 8, 2, 1, '#6a6a6a'); tiny(g, 'EYE', 11, 12, '#e8c33a'); },
  board(g, d) { g.drawImage(d.board, d.seg * T, 0, T, T, 0, 0, T, T); }
};
// door frame strips on the faces either side of a doorway
function doorJamb(g, side) { const x = side < 0 ? 0 : T - 4; rect(g, x, 0, 4, 28, '#7a5232'); rect(g, side < 0 ? 3 : T - 4, 0, 1, 28, '#5a3a20'); rect(g, side < 0 ? 0 : T - 1, 0, 1, 28, '#9a6a42'); }
function composeFace(d) {
  return canvas(T, T, g => {
    if (d.style === 'lockers') lockerFace(g, d); else faceBase(g, d);
    if (d.decor && DECOR[d.decor]) DECOR[d.decor](g, d);
    if (d.plate) DECOR.plate(g, d);
    if (d.exit) DECOR.exit(g, d);
    if (d.jambL) doorJamb(g, -1);
    if (d.jambR) doorJamb(g, 1);
  });
}
// chalkboards, whiteboards and menu boards span five tiles; each tile draws its own slice
const BOARD_TEXT = {
  chalk: { day: [['NEW LOWER PRICE', '3-SEAT SOFA $299'], ['MAKE YOURSELF', 'AT HOME'], ['ARMCHAIR $79', 'COFFEE TABLE $49'], ['ROOM FOR EVERYONE', 'FOLLOW THE ARROWS']],
    night: [['I WILL NOT LEAVE THE STORE', 'I WILL NOT LEAVE THE STORE', 'I WILL NOT LEAVE THE STORE'], ['WHY ARE YOU HERE', 'WHY ARE YOU HERE'], ['THE STORE IS CLOSED'], ['STAY'], ['MAKE YOURSELF', 'AT HOME', 'FOREVER']] },
  white: { day: [['KITCHEN PLANNER', 'ASK OUR STAFF'], ['FREE ASSEMBLY', 'NOT INCLUDED']], night: [['HELP'], ['NO EXIT', 'NO EXIT'], ['ASK OUR STAFF']] },
  menu: { day: [["TODAY'S SPECIAL", 'MEATBALLS  $5'], ['RESTAURANT', 'HOT DOG  COFFEE']], night: [["TODAY'S SPECIAL", 'YOU'], ['THE KITCHEN', 'NEVER CLOSES']] }
};
function boardCanvas(kind, seed, night) {
  const R = rng(seed), w = T * 5;
  const pool = BOARD_TEXT[kind][night ? 'night' : 'day'], lines = pool[(R() * pool.length) | 0];
  return canvas(w, T, g => {
    const bg = kind === 'white' ? '#eef2f4' : kind === 'menu' ? '#1d1f22' : night ? '#b89a2a' : '#f2c230';
    rect(g, 0, 1, w, 23, kind === 'chalk' ? '#2c4f8f' : kind === 'white' ? '#9aa4ac' : '#a8b0b8'); rect(g, 2, 3, w - 4, 19, bg);
    if (kind === 'chalk' && night) for (let i = 0; i < 9; i++) ellipse(g, 10 + ((R() * (w - 20)) | 0), 8 + ((R() * 10) | 0), 6, 2, '#a88a20');
    const ink = kind === 'white' ? (night ? '#c81c1c' : '#2a4ab8') : kind === 'menu' ? '#f2d24a' : (night ? '#5a0a0a' : '#1f3f7a');
    const big = night && lines.length === 1;
    lines.forEach((s, i) => {
      const many = lines.length > 2, sc = big ? 2 : 1, y = big ? 7 : many ? 4 + i * 6 : 6 + i * 7;
      tiny(g, s, Math.max(4, (w >> 1) - (tinyW(s, sc) >> 1) + (night ? ((R() * 9) | 0) - 4 : 0)), y, ink, sc, night ? (many ? 1 : 2) : 0, R);
    });
    rect(g, 0, 23, w, 2, kind === 'chalk' ? '#1e3a6a' : '#8a929a');
  });
}
// a wall seen from above (the top of a wall run)
const CAPS = [];
for (let m = 0; m < 16; m++) CAPS[m] = canvas(T, T, g => {
  rect(g, 0, 0, T, T, '#2b2f2c'); rect(g, 3, 3, T - 6, T - 6, '#323733');
  if (m & 1) rect(g, 0, 0, T, 2, '#4f5651');     // open above
  if (m & 2) rect(g, 0, 0, 2, T, '#464c48');     // open left
  if (m & 4) rect(g, T - 2, 0, 2, T, '#202321'); // open right
  if (m & 8) rect(g, 0, T - 2, T, 2, '#202321'); // open below
});
// doors: in a wall you see the face of (top / bottom wall) and in a wall you see from above (side walls)
function doorFaceTex(open, night, ghost) {
  return canvas(T, T, g => {
    rect(g, 0, 0, 4, T, '#7a5232'); rect(g, T - 4, 0, 4, T, '#7a5232'); rect(g, 0, 0, T, 4, '#6a4428'); rect(g, 3, 4, 1, 28, '#5a3a20'); rect(g, T - 4, 4, 1, 28, '#5a3a20');
    if (open) { g.clearRect(4, 4, T - 8, T - 4); rect(g, 4, 4, T - 8, 2, 'rgba(0,0,0,.35)'); return; }
    rect(g, 4, 4, T - 8, T - 4, '#9b6a3e'); rect(g, 4, 4, T - 8, 1, '#b8854f');
    rect(g, 17, 8, 6, 11, '#59656e'); rect(g, 18, 9, 4, 9, night ? '#07090c' : '#a9c6d4');
    if (!night) { line(g, 18, 17, 21, 10, '#d6e8f0'); }
    else if (ghost) { rect(g, 19, 11, 2, 4, '#c4c8bd'); px(g, 19, 12, '#ff2018'); px(g, 20, 12, '#ff2018'); }
    for (let y = 10; y < 18; y += 3) rect(g, 18, y, 4, 1, 'rgba(60,60,60,.35)');
    rect(g, 7, 18, 3, 2, '#d8dde2'); rect(g, 7, 18, 1, 3, '#d8dde2');
    rect(g, 5, 27, T - 10, 4, '#b8bec4'); rect(g, 5, 27, T - 10, 1, '#d8dde2');
    for (let i = 0; i < 6; i++) rect(g, 6 + i * 3, 6 + ((i * 7) % 19), 2, 1, '#8f6036');
  });
}
const DOOR_FACE = { open: doorFaceTex(true, false), closed: doorFaceTex(false, false), closedNight: doorFaceTex(false, true), ghost: doorFaceTex(false, true, true) };
const DOOR_SIDE = {
  open: canvas(T, T, g => { rect(g, 0, 0, T, 3, '#5a3a20'); rect(g, 0, T - 3, T, 3, '#5a3a20'); }),
  closed: canvas(T, T, g => { rect(g, 12, 0, 8, T, '#8b5e36'); rect(g, 12, 0, 2, T, '#a8744a'); rect(g, 19, 0, 1, T, '#5a3a20'); rect(g, 10, 14, 2, 3, '#d8dde2'); rect(g, 20, 14, 2, 3, '#d8dde2'); rect(g, 0, 0, T, 3, '#5a3a20'); rect(g, 0, T - 3, T, 3, '#5a3a20'); })
};

// ============================================================ furniture
const WOOD = { L: '#e0a96f', M: '#cf9a62', D: '#a8743f', E: '#8a5a2e', X: '#5e3b1c' };
const METAL = { L: '#c3ccd4', M: '#9aa6b2', D: '#6b7682', X: '#3a4048' };
// (the keys are the old names; the names shown in game are what each piece is now)
const FURN = {
  desk: { name: 'DESK', hp: 5, wt: 2, mat: 'wood', h: 32, nv: 4, draw(g, v, R) {
    const top = v % 2 ? BIRCH : WHITE;
    rect(g, 2, 9, 28, 11, top.M); rect(g, 2, 9, 28, 1, top.L); rect(g, 2, 9, 1, 11, top.L); rect(g, 29, 10, 1, 10, top.D);
    if (top === BIRCH) for (let i = 0; i < 5; i++) rect(g, 4 + ((R() * 18) | 0), 11 + ((R() * 8) | 0), 3 + ((R() * 6) | 0), 1, BIRCH.D);
    rect(g, 2, 20, 28, 2, top.D); rect(g, 2, 22, 28, 1, top.X);
    for (const lx of [3, 27]) { rect(g, lx, 22, 2, 8, '#2a2d33'); rect(g, lx - 1, 30, 4, 1, '#1a1a1a'); }
    if (v === 1) { rect(g, 18, 6, 7, 6, '#2a2a2a'); rect(g, 19, 7, 5, 4, '#5a7a9a'); rect(g, 21, 12, 1, 2, '#2a2a2a'); rect(g, 6, 14, 8, 3, '#e8e4d8'); }
    if (v === 2) { line(g, 22, 4, 24, 11, '#2a2a2a'); line(g, 22, 4, 18, 7, '#2a2a2a'); ellipse(g, 18, 8, 3, 2, '#d84a3a'); rect(g, 21, 12, 5, 2, '#2a2a2a'); rect(g, 6, 12, 9, 6, '#efece2'); }
    if (v === 3) { rect(g, 7, 12, 3, 5, '#e8e4d8'); rect(g, 6, 11, 5, 1, '#c8c4b8'); px(g, 8, 10, '#4cae5b'); px(g, 9, 9, '#4cae5b'); rect(g, 16, 13, 9, 4, '#2c5fa8'); }
  } },
  chair: { name: 'CHAIR', hp: 3, wt: 1, mat: 'wood', h: 32, nv: 4, draw(g, v) {
    const w = [BIRCH, WHITE, { L: '#5a5048', M: '#3e3630', D: '#2a2420', X: '#1a1614' }, BIRCH][v], cush = ['#2c5fa8', '#d8d4c8', '#b84a3a', '#4cae5b'][v];
    rect(g, 9, 2, 2, 20, w.D); rect(g, 21, 2, 2, 20, w.D); rect(g, 9, 2, 14, 2, w.M); rect(g, 9, 6, 14, 2, w.M); rect(g, 9, 2, 14, 1, w.L);
    for (const x of [12, 15, 18]) rect(g, x, 8, 2, 6, w.M);
    rect(g, 7, 15, 18, 5, w.M); rect(g, 7, 15, 18, 1, w.L); rect(g, 8, 13, 16, 3, cush); rect(g, 8, 13, 16, 1, shade(cush, 1.2));
    rect(g, 7, 20, 18, 2, w.D);
    for (const lx of [8, 22]) { rect(g, lx, 22, 2, 8, w.M); rect(g, lx + 1, 22, 1, 8, w.D); }
  } },
  table: { name: 'DINING TABLE', hp: 8, wt: 3, mat: 'wood', h: 32, nv: 4, draw(g, v, R) {
    rect(g, 0, 8, 32, 12, BIRCH.M); rect(g, 0, 8, 32, 1, BIRCH.L); for (let i = 0; i < 5; i++) rect(g, 2 + ((R() * 22) | 0), 10 + ((R() * 8) | 0), 4 + ((R() * 5) | 0), 1, BIRCH.D);
    rect(g, 0, 20, 32, 2, BIRCH.D); rect(g, 0, 22, 32, 1, BIRCH.X);
    for (const lx of [2, 28]) { rect(g, lx, 23, 2, 8, BIRCH.M); rect(g, lx + 1, 23, 1, 8, BIRCH.D); }
    if (v === 1) { ellipse(g, 15, 14, 6, 3, '#f6f4ee'); for (const [x, y] of [[12, 13], [15, 12], [18, 13], [14, 15], [17, 15]]) { ellipse(g, x, y, 1, 1, '#7a4a2a'); } rect(g, 11, 15, 3, 1, '#c8323a'); rect(g, 22, 12, 1, 5, '#9aa6b2'); }
    if (v === 2) { rect(g, 20, 10, 4, 7, '#f6f4ee'); rect(g, 20, 11, 4, 4, '#b8323a'); ellipse(g, 11, 15, 4, 2, '#f6f4ee'); rect(g, 8, 14, 7, 1, '#d8a85a'); }
    if (v === 3) { rect(g, 4, 10, 10, 8, '#f2efe6'); rect(g, 4, 10, 10, 2, '#2c5fa8'); rect(g, 5, 13, 4, 3, '#d8b585'); rect(g, 17, 14, 6, 1, '#d8b585'); px(g, 23, 14, '#2a2a2a'); }
  } },
  shelf: { name: 'BOOKCASE', hp: 10, wt: 4, mat: 'wood', h: 46, nv: 3, tall: true, draw(g, v, R) {
    const w = v === 1 ? BIRCH : WHITE, fr = w.M, frL = w.L, frD = w.D;
    rect(g, 1, 0, 30, 46, fr); rect(g, 1, 0, 30, 3, frL); rect(g, 3, 4, 26, 36, shade(w.D, .55));
    for (const [y0, y1] of [[4, 13], [16, 25], [28, 37]]) {
      if (y0 === 16 && v !== 0) {   // a display shelf: a vase, a box, a little plant
        rect(g, 6, y1 - 6, 5, 7, '#2c5fa8'); rect(g, 7, y1 - 8, 3, 2, '#2c5fa8'); rect(g, 14, y1 - 4, 7, 5, '#e8e4d8'); rect(g, 14, y1 - 4, 7, 1, '#ffffff');
        ellipse(g, 25, y1 - 5, 2, 2, '#4cae5b'); rect(g, 24, y1 - 2, 3, 3, '#c8763a'); continue;
      }
      let x = 4;
      while (x < 28) {
        const bw = Math.min(28 - x, 2 + ((R() * 3) | 0)), h = Math.min(y1 - y0 + 1, 6 + ((R() * 4) | 0)), c = BOOKS[(R() * BOOKS.length) | 0];
        if (R() < .15) { x += 3; continue; }
        rect(g, x, y1 - h + 1, bw, h, c); rect(g, x, y1 - h + 1, 1, h, shade(c, 1.3)); rect(g, x, y1 - h + 3, bw, 1, shade(c, .65));
        x += bw;
      }
    }
    for (const sy of [14, 26, 38]) { rect(g, 3, sy, 26, 2, fr); rect(g, 3, sy, 26, 1, frL); }
    rect(g, 3, 40, 26, 4, frD); rect(g, 1, 44, 30, 2, w.X); rect(g, 30, 0, 1, 46, frD); rect(g, 1, 3, 1, 41, frL);
  } },
  locker: { name: 'WARDROBE', hp: 14, wt: 4, mat: 'wood', h: 48, nv: 4, tall: true, draw(g, v, R) {
    const w = [WHITE, BIRCH, { L: '#6a5a4c', M: '#4a3e34', D: '#2e2620', X: '#1a1612' }, { L: '#b8c8d8', M: '#8aa0b8', D: '#647a92', X: '#3e4e60' }][v];
    rect(g, 1, 0, 30, 48, w.D); rect(g, 1, 0, 30, 3, w.L);
    for (const dx of [2, 16]) { rect(g, dx, 3, 14, 40, w.M); rect(g, dx, 3, 1, 40, w.L); rect(g, dx + 13, 3, 1, 40, w.D); }
    if (v === 0) rect(g, 17, 5, 11, 34, '#c8d4dc');   // a mirror door
    if (v === 0) line(g, 19, 30, 26, 8, '#e8f0f4');
    rect(g, 14, 18, 1, 8, '#2a2a2a'); rect(g, 18, 18, 1, 8, '#2a2a2a');
    rect(g, 1, 43, 30, 3, w.X); rect(g, 2, 46, 3, 2, '#1a1a1a'); rect(g, 27, 46, 3, 2, '#1a1a1a');
  } },
  box: { name: 'FLAT-PACK BOX', hp: 3, wt: 1, mat: 'box', h: 32, nv: 4, draw(g, v, R) {
    const c = '#c79a5c', cL = '#ddb373', cD = '#9c7440', cDD = '#74542c';
    if (v === 2) { rect(g, 3, 5, 12, 5, cL); rect(g, 17, 5, 12, 5, cL); rect(g, 5, 9, 22, 7, '#efece2'); rect(g, 7, 10, 6, 5, '#ffffff'); line(g, 8, 14, 11, 11, '#2a2a2a'); px(g, 9, 12, '#2a2a2a'); rect(g, 15, 12, 8, 1, '#9aa3ad'); }
    else { rect(g, 3, 9, 26, 7, cL); rect(g, 3, 9, 26, 1, '#e8c487'); rect(g, 14, 9, 4, 7, '#e2cf95'); }
    rect(g, 3, 16, 26, 14, c); rect(g, 3, 16, 26, 1, cD); rect(g, 28, 10, 1, 20, cD); rect(g, 3, 29, 26, 1, cDD);
    if (v !== 2) rect(g, 14, 16, 4, 5, '#e2cf95');
    const label = ['KLAN', 'BORK', 'SKRU', 'LOST'][v];
    rect(g, 6, 21, 17, 7, '#efe9da'); tiny(g, label, 7, 22, v === 3 ? '#a82a2a' : '#1f3f7a');
    rect(g, 24, 19, 3, 1, cDD); px(g, 25, 22, '#2a2a2a'); rect(g, 24, 24, 3, 3, '#2a2a2a'); px(g, 25, 25, '#efe9da');
    if (v === 3) { rect(g, 3, 16, 26, 1, cD); speckle(g, R, 4, 17, 24, 3, 6, [cD]); }
  } },
  tdesk: { name: 'SIDEBOARD', hp: 10, wt: 4, mat: 'wood', h: 32, nv: 3, draw(g, v, R) {
    const w = [BIRCH, WHITE, { L: '#6a5a4c', M: '#4a3e34', D: '#2e2620', X: '#1a1612' }][v];
    rect(g, 0, 8, 32, 10, w.M); rect(g, 0, 8, 32, 1, w.L); rect(g, 0, 8, 1, 10, w.L);
    if (w === BIRCH) for (let i = 0; i < 4; i++) rect(g, 2 + ((R() * 24) | 0), 10 + ((R() * 7) | 0), 4 + ((R() * 6) | 0), 1, w.D);
    rect(g, 0, 18, 32, 12, w.D);
    for (const dx of [1, 11, 21]) { rect(g, dx, 19, 10, 10, w.M); rect(g, dx, 19, 10, 1, w.L); rect(g, dx + 4, 23, 2, 1, '#2a2a2a'); }
    rect(g, 0, 29, 32, 1, w.X); for (const x of [2, 28]) rect(g, x, 30, 2, 2, '#1a1a1a');
    if (v === 0) { rect(g, 5, 4, 4, 6, '#e8e4d8'); ellipse(g, 7, 3, 4, 2, '#f2efe6'); rect(g, 6, 9, 2, 1, '#2a2a2a'); ellipse(g, 23, 10, 4, 2, '#2c5fa8'); }
    if (v === 1) { rect(g, 4, 9, 9, 6, '#f2efe6'); rect(g, 4, 9, 9, 2, '#2c5fa8'); ellipse(g, 24, 9, 3, 3, '#4cae5b'); rect(g, 23, 11, 3, 4, '#c8763a'); }
    if (v === 2) { for (let i = 0; i < 3; i++) rect(g, 5 + i * 2, 6 - i, 2, 9 + i, ['#f2efe6', '#e8c33a', '#c83a3a'][i]); rect(g, 20, 8, 7, 7, '#1d1d1f'); rect(g, 21, 9, 5, 5, '#c8d0d8'); }
  } },
  labtable: { name: 'KITCHEN ISLAND', hp: 10, wt: 4, mat: 'wood', h: 32, nv: 3, draw(g, v, R) {
    rect(g, 0, 6, 32, 13, BIRCH.M); rect(g, 0, 6, 32, 1, BIRCH.L); for (let i = 0; i < 5; i++) rect(g, 2 + ((R() * 22) | 0), 8 + ((R() * 10) | 0), 5, 1, BIRCH.D);
    rect(g, 0, 19, 32, 12, WHITE.M); rect(g, 0, 19, 32, 1, BIRCH.X);
    for (const dx of [1, 16]) { rect(g, dx, 20, 15, 10, WHITE.L); rect(g, dx + 14, 20, 1, 10, WHITE.D); rect(g, dx + (dx === 1 ? 12 : 1), 22, 1, 5, '#5a6068'); }
    rect(g, 0, 30, 32, 2, '#2a2d33');
    if (v === 0) { ellipse(g, 9, 12, 5, 3, '#f6f4ee'); for (const [x, c] of [[7, '#c8322c'], [10, '#e8c33a'], [12, '#4a9a3a']]) ellipse(g, x, 11, 1, 1, c); rect(g, 22, 8, 4, 8, '#f2efe6'); rect(g, 22, 8, 4, 2, '#4cae5b'); }
    if (v === 1) { rect(g, 9, 9, 14, 7, '#b8c0c8'); rect(g, 10, 10, 12, 5, '#8a949e'); rect(g, 15, 3, 2, 7, METAL.L); rect(g, 15, 3, 5, 2, METAL.L); rect(g, 19, 3, 1, 3, METAL.L); }
    if (v === 2) { ellipse(g, 12, 12, 5, 3, '#2a2d33'); ellipse(g, 12, 11, 4, 2, '#4a5058'); rect(g, 17, 11, 6, 1, '#2a2d33'); rect(g, 24, 9, 3, 7, '#d8b585'); }
  } },
  stool: { name: 'BAR STOOL', hp: 2, wt: 1, mat: 'wood', h: 32, nv: 1, draw(g) {
    line(g, 11, 16, 8, 30, BIRCH.D); line(g, 20, 16, 23, 30, BIRCH.D); rect(g, 15, 16, 2, 13, BIRCH.M);
    rect(g, 10, 24, 12, 1, BIRCH.D);
    ellipse(g, 16, 13, 7, 3, BIRCH.D); ellipse(g, 16, 12, 6, 2, BIRCH.M); rect(g, 13, 11, 4, 1, BIRCH.L);
  } },
  piano: { name: 'GLASS CABINET', hp: 16, wt: 6, mat: 'wood', h: 44, nv: 1, tall: true, draw(g) {
    const w = { L: '#6a5a4c', M: '#4a3e34', D: '#2e2620', X: '#1a1612' };
    rect(g, 1, 0, 30, 44, w.M); rect(g, 1, 0, 30, 3, w.L); rect(g, 30, 0, 1, 44, w.D);
    rect(g, 3, 4, 26, 26, '#c8d4dc'); rect(g, 15, 4, 2, 26, w.D);
    for (const y of [12, 21]) rect(g, 3, y, 26, 1, w.L);
    for (const [x, y, c] of [[5, 8, '#f6f4ee'], [9, 7, '#2c5fa8'], [19, 8, '#f6f4ee'], [24, 8, '#e8c33a'], [6, 17, '#f6f4ee'], [10, 17, '#f6f4ee'], [20, 16, '#4cae5b'], [24, 17, '#f6f4ee'], [7, 26, '#d84a3a'], [21, 26, '#f6f4ee']]) rect(g, x, y, 3, (y < 12 ? 12 : y < 21 ? 21 : 30) - y, c);
    line(g, 5, 28, 13, 5, 'rgba(255,255,255,.35)'); line(g, 18, 28, 26, 5, 'rgba(255,255,255,.35)');
    rect(g, 3, 31, 26, 10, w.D); rect(g, 4, 32, 11, 8, w.M); rect(g, 17, 32, 11, 8, w.M); rect(g, 13, 35, 1, 3, '#c8ccd0'); rect(g, 18, 35, 1, 3, '#c8ccd0');
    rect(g, 1, 41, 30, 3, w.X);
  } },
  easel: { name: 'FRAMED PRINT', hp: 2, wt: 1, mat: 'wood', h: 36, nv: 4, draw(g, v, R) {
    line(g, 10, 22, 7, 35, BIRCH.D, 2); line(g, 21, 22, 24, 35, BIRCH.D, 2);
    const fr = [ '#1d1d1f', BIRCH.D, '#f6f4ee', '#1d1d1f'][v];
    rect(g, 4, 2, 24, 26, fr); rect(g, 6, 4, 20, 22, '#f6f4ee');
    if (v === 0) { rect(g, 7, 5, 18, 10, '#bcd4e0'); rect(g, 7, 15, 18, 3, '#5a8ab0'); rect(g, 7, 18, 18, 7, '#4a7a4a'); for (const x of [10, 14, 21]) { px(g, x, 11, '#2a4a2a'); rect(g, x - 1, 12, 3, 4, '#2a4a2a'); } }
    if (v === 1) { line(g, 16, 14, 16, 24, '#3a8a3a'); ellipse(g, 16, 11, 4, 4, '#e86a9a'); ellipse(g, 16, 11, 1, 1, '#f2d24a'); }
    if (v === 2) { rect(g, 7, 5, 18, 20, '#8a8478'); rect(g, 10, 18, 12, 7, '#2a2a32'); ellipse(g, 16, 13, 4, 5, '#d8b894'); rect(g, 12, 8, 8, 2, '#3a2a1a'); }
    if (v === 3) for (let i = 0; i < 5; i++) rect(g, 8 + ((R() * 12) | 0), 6 + ((R() * 16) | 0), 4, 3, PAINT[(R() * PAINT.length) | 0]);
  } },
  cot: { name: 'BED', hp: 5, wt: 3, mat: 'soft', h: 32, nv: 2, draw(g, v) {
    const bl = ['#2c5fa8', '#e8e4d8'][v], fr = v ? BIRCH : WHITE;
    rect(g, 1, 2, 30, 8, fr.M); rect(g, 1, 2, 30, 1, fr.L);
    rect(g, 2, 8, 28, 17, fr.D); rect(g, 3, 8, 26, 15, '#f6f6f2');
    rect(g, 4, 9, 11, 5, '#ffffff'); rect(g, 17, 9, 11, 5, '#ffffff'); rect(g, 4, 13, 11, 1, '#c8ccd0'); rect(g, 17, 13, 11, 1, '#c8ccd0');
    rect(g, 3, 15, 26, 9, bl); rect(g, 3, 15, 26, 1, shade(bl, 1.15)); for (const x of [10, 17, 24]) rect(g, x, 16, 1, 8, shade(bl, .85));
    rect(g, 2, 24, 28, 3, fr.M); for (const x of [3, 27]) rect(g, x, 27, 2, 4, fr.D);
  } },
  couch: { name: 'SOFA', hp: 8, wt: 4, mat: 'soft', h: 32, nv: 3, draw(g, v) {
    const c = ['#8a939b', '#d8cdb8', '#2c4f8f'][v], cL = shade(c, 1.15), cD = shade(c, .74);
    rect(g, 2, 4, 28, 11, cD); rect(g, 2, 4, 28, 2, c); rect(g, 3, 4, 26, 1, cL);
    rect(g, 1, 10, 5, 17, c); rect(g, 26, 10, 5, 17, c); rect(g, 1, 10, 5, 2, cL); rect(g, 26, 10, 5, 2, cL);
    rect(g, 6, 14, 10, 8, cL); rect(g, 16, 14, 10, 8, cL); rect(g, 15, 14, 2, 8, c); rect(g, 6, 14, 20, 1, shade(c, 1.3));
    rect(g, 7, 7, 6, 6, v === 2 ? '#f2c230' : '#2c5fa8'); rect(g, 7, 7, 6, 1, shade(v === 2 ? '#f2c230' : '#2c5fa8', 1.2));
    rect(g, 1, 22, 30, 6, cD); rect(g, 1, 22, 30, 1, c);
    for (const x of [3, 27]) rect(g, x, 28, 2, 3, BIRCH.D);
  } },
  vending: { name: 'VENDING MACHINE', hp: 18, wt: 6, mat: 'metal', h: 50, nv: 2, tall: true, light: [.45, .6, 1], draw(g, v, R) {
    const c = ['#2c5fa8', '#d8a82a'][v], cL = shade(c, 1.25), cD = shade(c, .7);
    rect(g, 1, 0, 30, 50, c); rect(g, 1, 0, 30, 3, cL); rect(g, 30, 0, 1, 50, cD);
    rect(g, 3, 5, 18, 31, '#162130');
    for (let r = 0; r < 5; r++) {
      const y = 7 + r * 6;
      for (let i = 0; i < 4; i++) { const sc = ['#e8c33a', '#d84a3a', '#4aa8d8', '#7ac84a', '#e88a3a', '#c86ab8'][(R() * 6) | 0]; rect(g, 5 + i * 4, y, 3, 4, sc); px(g, 5 + i * 4, y, shade(sc, 1.3)); }
      rect(g, 4, y + 4, 16, 1, '#5b6570');
    }
    line(g, 5, 32, 17, 8, 'rgba(255,255,255,.12)');
    rect(g, 22, 5, 7, 31, cD); rect(g, 23, 6, 5, 3, '#1a3a1a'); px(g, 24, 7, '#7af87a'); px(g, 26, 7, '#7af87a');
    for (let y = 11; y < 20; y += 2) for (let x = 23; x < 28; x += 2) px(g, x, y, '#e8e4d8');
    rect(g, 24, 22, 2, 3, '#2a2d33'); rect(g, 23, 27, 5, 1, '#2a2d33');
    rect(g, 3, 37, 18, 4, cD); tiny(g, 'SNAX', 4, 37, '#ffffff');
    rect(g, 4, 42, 16, 4, '#0e1218'); rect(g, 4, 42, 16, 1, '#2a2d33'); rect(g, 1, 47, 30, 3, '#2a2d33');
  } },
  cabinet: { name: 'CHEST OF DRAWERS', hp: 12, wt: 3, mat: 'wood', h: 40, nv: 4, tall: true, draw(g, v) {
    const w = [WHITE, BIRCH, WHITE, { L: '#6a5a4c', M: '#4a3e34', D: '#2e2620', X: '#1a1612' }][v];
    rect(g, 4, 0, 24, 40, w.D); rect(g, 4, 0, 24, 3, w.L);
    if (v === 2) {   // the first aid cabinet
      rect(g, 5, 4, 22, 22, '#d8e4e8'); rect(g, 6, 5, 9, 20, '#b8cdd4'); rect(g, 17, 5, 9, 20, '#b8cdd4');
      for (const y of [10, 17]) { rect(g, 6, y, 20, 1, w.D); for (let x = 7; x < 25; x += 3) rect(g, x, y - 4, 2, 4, ['#c84a3a', '#e8e8e8', '#4a8ad8'][x % 3]); }
      rect(g, 14, 27, 4, 10, '#4cae5b'); rect(g, 11, 30, 10, 4, '#4cae5b'); rect(g, 5, 26, 22, 1, w.D);
    } else {
      for (let i = 0; i < 4; i++) {
        const y = 4 + i * 9, open = v === 3 && i === 1;
        rect(g, 5, y, 22, 8, open ? shade(w.M, 1.1) : w.M); rect(g, 5, y, 22, 1, w.L);
        rect(g, 13, y + 3, 6, 1, w === WHITE ? '#9c988c' : '#c8ccd0');
        if (open) { rect(g, 6, y - 2, 20, 3, '#e8e4d8'); rect(g, 7, y - 3, 6, 2, '#c8d8e8'); }
      }
    }
    rect(g, 4, 38, 24, 2, '#2a2d33');
  } },
  trash: { name: 'BIN', hp: 3, wt: 1, mat: 'plastic', h: 32, nv: 3, draw(g, v) {
    const c = ['#eeece6', '#4cae5b', '#2c5fa8'][v], cL = shade(c, 1.1), cD = shade(c, .75);
    rect(g, 10, 13, 12, 16, c); for (let x = 12; x < 22; x += 3) rect(g, x, 14, 1, 14, cD); rect(g, 21, 13, 1, 16, cD);
    ellipse(g, 16, 12, 7, 2, cL); ellipse(g, 16, 12, 5, 1, '#1e2226');
    rect(g, 12, 7, 4, 4, '#efece2'); px(g, 13, 8, '#bdb8aa'); rect(g, 17, 9, 3, 2, '#c79a5c'); px(g, 18, 8, '#9c7440');
    rect(g, 10, 29, 12, 2, cD);
  } },
  mat: { name: 'ROLLED RUG', hp: 4, wt: 2, mat: 'soft', h: 32, nv: 2, draw(g, v) {
    const c = ['#c8b48a', '#2c4f8f'][v], c2 = ['#8a3a2a', '#f2c230'][v], cL = shade(c, 1.15), cD = shade(c, .72);
    rect(g, 2, 14, 28, 13, c); rect(g, 2, 14, 28, 1, cL); rect(g, 2, 26, 28, 1, cD);
    for (let x = 5; x < 28; x += 6) { rect(g, x, 15, 2, 11, c2); }
    ellipse(g, 3, 20, 2, 6, cD); ellipse(g, 3, 20, 1, 4, shade(c, .5)); ellipse(g, 29, 20, 2, 6, cL); ellipse(g, 29, 20, 1, 3, c2);
    rect(g, 4, 27, 24, 2, 'rgba(0,0,0,.25)');
  } },
  skeleton: { name: 'MANNEQUIN', hp: 3, wt: 1, mat: 'plastic', h: 50, nv: 1, tall: true, draw(g) {
    const sk = '#ece6da', skD = '#cfc6b4';
    rect(g, 15, 40, 2, 6, METAL.M); rect(g, 9, 46, 14, 3, METAL.X);
    ellipse(g, 16, 6, 4, 5, sk); rect(g, 15, 11, 2, 2, skD);
    rect(g, 11, 13, 10, 14, '#f2c230'); rect(g, 11, 13, 10, 1, '#f8dc70'); rect(g, 14, 13, 4, 1, sk);
    rect(g, 9, 14, 2, 12, '#f2c230'); rect(g, 21, 14, 2, 12, '#f2c230'); rect(g, 9, 26, 2, 3, sk); rect(g, 21, 26, 2, 3, sk);
    rect(g, 11, 27, 10, 13, '#2c4f8f'); rect(g, 15, 30, 1, 10, '#1e3a6a');
    ellipse(g, 14, 5, 1, 1, skD);
  } },
  plant: { name: 'POTTED PLANT', hp: 2, wt: 1, mat: 'soft', h: 40, nv: 2, draw(g, v, R) {
    const leaves = [['#3f8a3e', '#2f6a2e', '#5aa84a'], ['#4a7a3a', '#365a2a', '#6a9a4a']][v];
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI / 2 + (i - 4) * .36 + (R() - .5) * .2, len = 9 + R() * 8;
      const x1 = 16 + Math.cos(a) * len, y1 = 26 + Math.sin(a) * len * 1.3;
      line(g, 16, 26, Math.round(x1), Math.round(y1), leaves[1]);
      ellipse(g, Math.round(x1), Math.round(y1), 3, 2, leaves[i % 2 ? 0 : 2]); px(g, Math.round(x1), Math.round(y1), leaves[1]);
    }
    const pot = v ? '#eeece6' : '#2a2d33';
    rect(g, 9, 26, 14, 3, shade(pot, 1.1)); rect(g, 10, 29, 12, 10, pot); rect(g, 21, 29, 1, 10, shade(pot, .7)); rect(g, 10, 26, 12, 1, '#3a2a1a');
  } },
  stand: { name: 'FLOOR LAMP', hp: 2, wt: 1, mat: 'metal', h: 44, nv: 1, draw(g) {
    rect(g, 15, 14, 2, 26, '#2a2d33'); ellipse(g, 16, 41, 6, 2, '#2a2d33'); ellipse(g, 16, 40, 5, 1, '#3a4048');
    for (let y = 0; y < 13; y++) rect(g, 10 - (y >> 2), 1 + y, 12 + 2 * (y >> 2), 1, y === 0 ? '#ffffff' : '#f4ecd8');
    rect(g, 7, 13, 18, 1, '#d8ccb0'); rect(g, 22, 4, 1, 9, '#e0d6c0');
  } },
  cart: { name: 'TROLLEY', hp: 6, wt: 3, mat: 'metal', h: 32, nv: 2, draw(g, v, R) {
    if (v === 0) {   // a warehouse flatbed, stacked with boxes
      rect(g, 28, 2, 2, 24, METAL.D); rect(g, 26, 2, 4, 2, METAL.M);
      for (const [x, y, w, h] of [[3, 10, 12, 14], [15, 13, 12, 11], [6, 3, 16, 7]]) { rect(g, x, y, w, h, '#c79a5c'); rect(g, x, y, w, 1, '#ddb373'); rect(g, x + w - 1, y, 1, h, '#9c7440'); rect(g, x + 2, y + 3, 5, 3, '#efe9da'); }
      rect(g, 1, 24, 30, 3, '#3a4048'); rect(g, 1, 24, 30, 1, METAL.L);
    } else {   // a shopping trolley
      rect(g, 26, 4, 4, 2, '#d83a2a'); line(g, 28, 6, 26, 22, METAL.D);
      for (let y = 8; y < 22; y += 3) rect(g, 3, y, 24, 1, METAL.M);
      for (let x = 3; x < 27; x += 3) rect(g, x, 8, 1, 14, METAL.D);
      rect(g, 3, 8, 24, 1, METAL.L); rect(g, 6, 11, 8, 6, '#2c5fa8'); rect(g, 15, 13, 6, 5, '#c79a5c');
      rect(g, 4, 23, 22, 2, METAL.D);
    }
    for (const x of [5, 26]) { ellipse(g, x, 29, 2, 2, '#1a1a1a'); px(g, x, 29, METAL.M); }
  } }
};
const FTYPES = Object.keys(FURN);
const FSPR = {};
for (const k of FTYPES) {
  const f = FURN[k];
  FSPR[k] = [];
  for (let v = 0; v < f.nv; v++) FSPR[k].push(outlined(canvas(T, f.h, g => f.draw(g, v, rng(777 + v * 31 + k.length * 7)))));
}

// ============================================================ things you can pick up and eat
const PICKUPS = {
  apple: { name: 'HOT DOG', heal: 2, draw: g => { rect(g, 2, 7, 13, 4, '#e8c88a'); rect(g, 2, 7, 13, 1, '#f4dca8'); rect(g, 3, 6, 11, 2, '#b8442a'); rect(g, 4, 6, 9, 1, '#d8642a'); line(g, 4, 7, 12, 6, '#e8c33a'); rect(g, 2, 11, 13, 1, '#c8a46a'); } },
  milk: { name: 'LINGONBERRY DRINK', heal: 2, draw: g => { rect(g, 5, 4, 7, 10, '#b8202a'); rect(g, 5, 4, 7, 1, '#d84a4a'); rect(g, 6, 2, 5, 2, '#f2f2f2'); rect(g, 5, 8, 7, 3, '#f2f2f2'); rect(g, 6, 9, 5, 1, '#b8202a'); rect(g, 11, 5, 1, 9, '#8a1a1a'); } },
  chips: { name: 'MEATBALLS', heal: 3, draw: g => { ellipse(g, 8, 9, 7, 4, '#f6f4ee'); ellipse(g, 8, 9, 6, 3, '#e8e4d8'); for (const [x, y] of [[5, 8], [8, 7], [11, 8], [7, 10], [10, 10]]) { ellipse(g, x, y, 1, 1, '#7a4a2a'); px(g, x - 1, y - 1, '#a8704a'); } rect(g, 12, 9, 2, 2, '#c8323a'); } },
  bandage: { name: 'BANDAGES', heal: 5, draw: g => { rect(g, 3, 5, 11, 8, '#f2f2f0'); rect(g, 3, 12, 11, 1, '#c8ccd0'); rect(g, 7, 6, 3, 6, '#4cae5b'); rect(g, 5, 8, 7, 2, '#4cae5b'); } },
  battery: { name: 'BATTERY', heal: 0, draw: g => { rect(g, 5, 4, 7, 10, '#2a2a2a'); rect(g, 5, 4, 7, 4, '#c88a3a'); rect(g, 7, 2, 3, 2, '#c8ccd0'); rect(g, 6, 10, 1, 3, '#e8c33a'); px(g, 8, 11, '#f2f2f2'); } }
};
const PSPR = {};
for (const k in PICKUPS) PSPR[k] = outlined(canvas(16, 16, PICKUPS[k].draw));

// ============================================================ people
const SKINS = ['#f1c9a5', '#e0b48f', '#c99470', '#9c6b4a', '#6e4a33'];
const HAIRC = ['#2b1d16', '#5a3a22', '#8a6a42', '#b8b2a8', '#1a1a1a', '#7a2e1c', '#d8c8a0'];
const NIGHT_SKIN = s => shade(mixc(s, '#a9b2a6', .7), .92);

// one adult, drawn front (0), back (1) and side (2: facing right); frames: 0 stand, 1-4 walk, 5 reach, 6-7 writing on the board
function drawAdult(sp, dir, fr, night) {
  const bw = 28 + (sp.wide ? 4 : 0), bh = 54 + (sp.tall || 0);
  const cx = bw >> 1;
  const skin = night ? NIGHT_SKIN(sp.skin) : sp.skin, skinD = shade(skin, .82);
  const dark = c => night ? shade(c, .78) : c;
  const top = dark(sp.top), topD = shade(top, .74), topL = shade(top, 1.15), shirt = dark(sp.shirt), bot = dark(sp.bottom), shoe = '#1c1a1a', hair = dark(sp.hair);
  const neck = night ? 6 : 2;
  const feetY = bh - 3;                                   // shoes occupy feetY..feetY+2
  const legTop = feetY - 12, waist = legTop - 1, sh = waist - 14 - (sp.tall || 0);
  const walk = fr >= 1 && fr <= 4 ? fr : 0, bob = walk === 1 || walk === 3 ? -1 : 0;
  const hy = sh - neck - 12 + bob;                          // head top
  const tw = 12 + (sp.wide ? 4 : 0), tx = cx - (tw >> 1);
  const eyes = [];
  const c = canvas(bw, bh, g => {
    const legUpL = dir !== 2 && walk === 1 ? 2 : 0, legUpR = dir !== 2 && walk === 3 ? 2 : 0;
    // ---- legs and shoes
    if (dir === 2) {
      const f = walk === 1 ? 3 : walk === 3 ? -3 : 0;
      const legs = sp.bottomStyle === 'skirt' ? shade(skin, night ? .7 : .85) : bot;
      line(g, cx - 1, legTop, cx - 1 + f, feetY - 1, legs, 4); line(g, cx - 1, legTop, cx - 1 - f, feetY - 1, shade(legs, .8), 4);
      rect(g, cx - 2 + f, feetY, 6, 3, shoe); rect(g, cx - 2 - f, feetY - (f ? 1 : 0), 6, 3, shoe);
      if (sp.bottomStyle === 'skirt') { rect(g, cx - 5, waist, 10, 9, bot); rect(g, cx - 6, waist + 5, 12, 4, bot); rect(g, cx - 6, waist + 8, 12, 1, shade(bot, .7)); }
    } else {
      if (sp.bottomStyle === 'skirt') {
        const sk = night ? '#2a2a30' : '#3a3a40';
        rect(g, cx - 4, feetY - 3 - legUpL, 3, 3, sk); rect(g, cx + 1, feetY - 3 - legUpR, 3, 3, sk);
        for (let i = 0; i < 9; i++) rect(g, cx - 5 - (i >> 2), waist + 1 + i, 10 + 2 * (i >> 2), 1, i === 8 ? shade(bot, .7) : bot);
        rect(g, cx - 1, waist + 3, 1, 5, shade(bot, .8));
      } else {
        rect(g, cx - 5, legTop, 5, 12 - legUpL, bot); rect(g, cx, legTop, 5, 12 - legUpR, bot);
        rect(g, cx - 1, legTop + 4, 1, 8 - legUpL, shade(bot, .7)); rect(g, cx + 4, legTop, 1, 12 - legUpR, shade(bot, .8));
      }
      const hl = sp.heels ? 3 : 4;
      rect(g, cx - 5, feetY - legUpL, hl, 3, shoe); rect(g, cx + 5 - hl, feetY - legUpR, hl, 3, shoe);
      rect(g, cx - 5, feetY - legUpL, hl, 1, '#3a3636'); rect(g, cx + 5 - hl, feetY - legUpR, hl, 1, '#3a3636');
    }
    // ---- torso
    const ty = sh + bob, th = waist - sh + 1;
    if (dir === 2) {
      rect(g, cx - 4, ty, 9, th, sp.topStyle === 'vest' || sp.topStyle === 'overalls' ? shirt : top);
      if (sp.topStyle === 'vest') rect(g, cx - 4, ty + 3, 9, th - 3, top);
      if (sp.topStyle === 'overalls') { rect(g, cx - 4, ty + 4, 9, th - 4, top); rect(g, cx - 2, ty, 2, 4, top); }
      rect(g, cx + 4, ty, 1, th, topD); rect(g, cx + 3, ty, 2, 2, shirt);
      if (sp.necklace) px(g, cx + 3, ty + 2, '#f2f2f2');
    } else {
      rect(g, tx, ty, tw, th, top); rect(g, tx, ty, 1, 1, 'rgba(0,0,0,0)');
      g.clearRect(tx, ty, 1, 1); g.clearRect(tx + tw - 1, ty, 1, 1);
      rect(g, tx + 1, ty, tw - 2, 1, topL); rect(g, tx + tw - 1, ty + 1, 1, th - 1, topD);
      if (dir === 0) {
        if (sp.topStyle === 'suit') {
          rect(g, cx - 2, ty, 4, 6, shirt); rect(g, cx - 1, ty + 6, 2, 1, shirt);
          rect(g, cx - 1, ty + 1, 2, 9, dark(sp.tie)); px(g, cx - 1, ty + 1, shade(dark(sp.tie), 1.3));
          line(g, cx - 3, ty, cx - 2, ty + 6, topD); line(g, cx + 2, ty, cx + 1, ty + 6, topD);
          px(g, cx, ty + 9, '#1a1a1a'); px(g, cx, ty + 12, '#1a1a1a');
        } else if (sp.topStyle === 'cardigan') {
          rect(g, cx - 2, ty, 4, th, shirt); rect(g, cx - 3, ty, 1, th, topD); rect(g, cx + 2, ty, 1, th, topD);
          for (let y = ty + 3; y < ty + th - 1; y += 3) { px(g, cx - 3, y, '#e8e4d8'); }
          if (sp.necklace) for (let x = cx - 2; x < cx + 2; x++) px(g, x, ty + 2 + (x === cx - 2 || x === cx + 1 ? 0 : 1), '#f6f6f2');
        } else if (sp.topStyle === 'vest') {
          for (let i = 0; i < 4; i++) rect(g, cx - 3 + i, ty + i, 6 - 2 * i, 1, shirt);
          rect(g, cx - 1, ty + 1, 2, 4, dark(sp.tie));
          for (let x = tx + 1; x < tx + tw - 1; x += 2) px(g, x, ty + 6 + (x % 4 === 1 ? 1 : 0), shade(top, 1.2));
        } else if (sp.topStyle === 'overalls') {
          rect(g, tx, ty, tw, 4, shirt); rect(g, cx - 4, ty + 3, 8, th - 3, top); rect(g, cx - 4, ty, 1, 4, top); rect(g, cx + 3, ty, 1, 4, top);
          rect(g, cx - 2, ty + 6, 4, 3, topD); px(g, cx - 4, ty + 3, '#c9a43a'); px(g, cx + 3, ty + 3, '#c9a43a');
        } else if (sp.topStyle === 'polo') {
          rect(g, cx - 3, ty, 6, 2, topL); px(g, cx - 1, ty + 1, topD); px(g, cx, ty + 2, topD); px(g, cx, ty + 4, topD);
          rect(g, tx + 1, ty + th - 2, tw - 2, 1, topD);
        } else {
          rect(g, cx - 2, ty, 4, 1, shirt); rect(g, tx + 1, ty + th - 2, tw - 2, 1, topD);
        }
        // the name badge: there is never a name on it
        if (sp.badge) { rect(g, tx + 2, ty + 4, 4, 2, night ? '#b8b4aa' : '#f6f4ee'); px(g, tx + 2, ty + 4, '#2c5fa8'); }
      } else if (dir === 1) {
        if (sp.topStyle === 'suit') rect(g, cx - 1, ty + th - 5, 1, 5, topD);
        if (sp.topStyle === 'overalls') { rect(g, tx, ty, tw, 4, shirt); rect(g, cx - 4, ty + 4, 8, th - 4, top); line(g, cx - 4, ty + 4, cx - 1, ty, top); line(g, cx + 3, ty + 4, cx, ty, top); }
      }
      if (sp.bottomStyle !== 'skirt' && sp.topStyle !== 'overalls') { rect(g, tx + 1, waist, tw - 2, 1, '#1e1a18'); if (dir === 0) px(g, cx, waist, '#c9a43a'); }
    }
    // ---- what marks out the special staff
    const ext = sp.arms || 0;
    if (sp.apron && dir !== 1) { const ax = dir === 2 ? cx + 1 : cx - 4, aw2 = dir === 2 ? 4 : 8; rect(g, ax, ty + 4, aw2, th + 6, night ? '#a8a49a' : '#eeeae0'); rect(g, ax, ty + 4, aw2, 1, night ? '#c8c4ba' : '#ffffff'); if (dir === 0) { line(g, cx - 4, ty + 4, cx - 3, ty, '#eeeae0'); line(g, cx + 3, ty + 4, cx + 2, ty, '#eeeae0'); px(g, cx, ty + 9, night ? '#6a1010' : '#c84a3a'); } }
    if (sp.sash) { if (dir === 2) rect(g, cx - 3, ty + 2, 7, 2, '#e87a1a'); else line(g, tx + 1, ty + 1, tx + tw - 2, waist - 1, night ? '#a8561a' : '#ff8a1a', 2); if (dir === 0) rect(g, cx + 1, ty + 6, 3, 3, '#e8c33a'); }
    if (sp.whistle && dir !== 1) { line(g, cx - 2, ty, cx, ty + 6, '#d8d8d8'); line(g, cx + 2, ty, cx, ty + 6, '#d8d8d8'); rect(g, cx - 1, ty + 6, 3, 2, '#c8ccd0'); px(g, cx - 1, ty + 6, '#ffffff'); }
    if (sp.lanyard && dir === 0 && !sp.badge) { line(g, cx - 3, ty, cx - 1, ty + 7, '#2c5fa8'); line(g, cx + 2, ty, cx, ty + 7, '#2c5fa8'); rect(g, cx - 2, ty + 7, 4, 3, '#f6f4ee'); }
    if (sp.stripe && dir !== 1) { rect(g, tx + 1, ty + 3, 1, th - 4, '#f2f2f2'); rect(g, tx + tw - 2, ty + 3, 1, th - 4, '#f2f2f2'); }
    // ---- arms
    const sleeve = sp.topStyle === 'vest' || sp.topStyle === 'overalls' ? shirt : top;
    if (dir === 2) {
      const swing = walk === 1 ? 3 : walk === 3 ? -3 : 0;
      if (fr === 5) { rect(g, cx, ty + 2, 10, 3, sleeve); rect(g, cx + 10, ty + 2, 3, 3, skin); }
      else { line(g, cx, ty + 1, cx + swing, ty + 11 + ext, sleeve, 3); rect(g, cx + swing, ty + 12 + ext, 3, 2, skin); }
    } else {
      const aw = 3, ax0 = tx - aw, ax1 = tx + tw;
      if (fr === 5) {
        rect(g, ax0, ty + 1, aw, 5, sleeve); rect(g, ax1, ty + 1, aw, 5, sleeve);
        rect(g, ax0 - 1, ty + 5, aw + 1, 3, skin); rect(g, ax1, ty + 5, aw + 1, 3, skin);
      } else if ((fr === 6 || fr === 7) && dir === 1) {
        rect(g, ax0, ty + 1, aw, 12, sleeve); rect(g, ax0, ty + 13, aw, 2, skin);
        const up = fr === 6 ? 0 : 2;
        rect(g, ax1, ty - 8 + up, aw, 10, sleeve); rect(g, ax1, ty - 11 + up, aw, 3, skin); px(g, ax1 + 1, ty - 12 + up, '#f2f2ee');
      } else {
        const sl = walk === 1 ? 1 : walk === 3 ? -1 : 0;
        rect(g, ax0, ty + 1, aw, 12 + sl + ext, sleeve); rect(g, ax1, ty + 1, aw, 12 - sl + ext, sleeve);
        rect(g, ax0, ty + 1, 1, 12 + sl + ext, shade(sleeve, 1.12)); rect(g, ax1 + aw - 1, ty + 1, 1, 12 - sl + ext, shade(sleeve, .8));
        rect(g, ax0, ty + 13 + sl + ext, aw, 2 + (ext ? 2 : 0), skin); rect(g, ax1, ty + 13 - sl + ext, aw, 2 + (ext ? 2 : 0), skin);
        if (night) { px(g, ax0, ty + 15 + sl + ext + (ext ? 2 : 0), skinD); px(g, ax1 + 2, ty + 15 - sl + ext + (ext ? 2 : 0), skinD); }
      }
    }
    // ---- neck and head
    const tilt = night ? (sp.tilt || 0) : 0;
    const hx = cx - 5 + tilt, hw = 10, hh = 12;
    rect(g, cx - 2, hy + hh, 4, neck + 1, skinD);
    if (dir === 2) {
      rect(g, hx, hy, hw - 1, hh, skin); rect(g, hx + hw - 1, hy + 4, 1, 4, skin); px(g, hx + hw - 1, hy + 6, skinD);
      rect(g, hx, hy + hh - 1, hw - 1, 1, skinD); g.clearRect(hx, hy, 1, 1); g.clearRect(hx + hw - 2, hy, 1, 1);
    } else {
      rect(g, hx, hy, hw, hh, skin); g.clearRect(hx, hy, 1, 1); g.clearRect(hx + hw - 1, hy, 1, 1); g.clearRect(hx, hy + hh - 1, 1, 1); g.clearRect(hx + hw - 1, hy + hh - 1, 1, 1);
      rect(g, hx + 1, hy + hh - 2, hw - 2, 1, skinD);
      rect(g, hx - 1, hy + 4, 1, 3, skinD); rect(g, hx + hw, hy + 4, 1, 3, skinD);
    }
    // ---- face (none at all during the day)
    if (dir === 0 && night) {
      const ex1 = hx + 2, ex2 = hx + hw - 4, ey = hy + 4;
      rect(g, ex1 - 1, ey + 2, 3, 1, shade(skin, .7)); rect(g, ex2 - 1 + 1, ey + 2, 3, 1, shade(skin, .7));
      rect(g, ex1, ey, 2, 2, '#050505'); rect(g, ex2, ey, 2, 2, '#050505');
      eyes.push([ex1, ey], [ex2 + 1, ey]);
      const my = hy + 8;
      rect(g, hx + 2, my, hw - 4, 2, '#140202'); px(g, hx + 1, my - 1, '#140202'); px(g, hx + hw - 2, my - 1, '#140202');
      for (let x = hx + 3; x < hx + hw - 3; x += 2) px(g, x, my, '#d8d0b8');
      if (fr === 5) rect(g, hx + 3, my + 2, hw - 6, 1, '#140202');
    } else if (dir === 2 && night) {
      rect(g, hx + 6, hy + 4, 2, 2, '#050505'); eyes.push([hx + 7, hy + 4]);
      rect(g, hx + 5, hy + 8, 4, 2, '#140202'); px(g, hx + 6, hy + 8, '#d8d0b8');
    }
    if (sp.glasses && dir !== 1) {
      const gc = '#2a2a2a';
      if (dir === 0) { rect(g, hx + 1, hy + 4, 3, 1, gc); rect(g, hx + hw - 4, hy + 4, 3, 1, gc); rect(g, hx + 1, hy + 6, 3, 1, gc); rect(g, hx + hw - 4, hy + 6, 3, 1, gc); px(g, hx + 1, hy + 5, gc); px(g, hx + 3, hy + 5, gc); px(g, hx + hw - 4, hy + 5, gc); px(g, hx + hw - 2, hy + 5, gc); rect(g, hx + 4, hy + 4, 2, 1, gc); if (!night) { px(g, hx + 2, hy + 5, '#c8d8e0'); px(g, hx + hw - 3, hy + 5, '#c8d8e0'); } }
      else { rect(g, hx + 5, hy + 4, 4, 1, gc); rect(g, hx + 5, hy + 6, 4, 1, gc); px(g, hx + 5, hy + 5, gc); px(g, hx + 8, hy + 5, gc); rect(g, hx + 1, hy + 5, 4, 1, gc); }
    }
    if (sp.mustache && dir !== 1) { if (dir === 0) rect(g, hx + 3, hy + 7, 4, 1, hair); else rect(g, hx + 6, hy + 7, 3, 1, hair); }
    // ---- hair
    const st = sp.hairStyle;
    const hairTop = () => { rect(g, hx, hy, hw, 3, hair); rect(g, hx + 1, hy - 1, hw - 2, 1, hair); };
    if (dir === 1) {
      if (st === 'bald') { rect(g, hx, hy + 5, hw, 4, hair); px(g, hx + 3, hy + 1, shade(skin, 1.15)); }
      else { rect(g, hx, hy - 1, hw, hh - 2, hair); rect(g, hx - 1, hy + 1, hw + 2, hh - 5, hair); }
      if (st === 'long') rect(g, hx - 1, hy + hh - 4, hw + 2, 10, hair);
      if (st === 'bob') rect(g, hx - 1, hy + hh - 4, hw + 2, 3, hair);
      if (st === 'bun') { rect(g, cx - 2 + tilt, hy - 4, 4, 4, hair); rect(g, cx - 1 + tilt, hy - 5, 2, 1, hair); }
      if (st === 'cap') { rect(g, hx - 1, hy - 1, hw + 2, 4, sp.capc); }
    } else if (dir === 0) {
      if (st === 'bald') { rect(g, hx - 1, hy + 3, 2, 4, hair); rect(g, hx + hw - 1, hy + 3, 2, 4, hair); px(g, hx + 3, hy + 1, shade(skin, 1.18)); px(g, hx + 4, hy + 1, shade(skin, 1.1)); }
      else if (st === 'combover') { rect(g, hx, hy, hw, 1, hair); for (let x = hx; x < hx + hw; x += 2) px(g, x, hy + 1, hair); rect(g, hx - 1, hy + 2, 1, 4, hair); rect(g, hx + hw, hy + 2, 1, 4, hair); }
      else if (st === 'cap') { rect(g, hx - 1, hy - 1, hw + 2, 4, sp.capc); rect(g, hx - 2, hy + 3, hw + 4, 1, shade(sp.capc, .7)); rect(g, hx - 1, hy + 4, 1, 2, hair); rect(g, hx + hw, hy + 4, 1, 2, hair); }
      else {
        hairTop(); rect(g, hx - 1, hy + 1, 1, st === 'long' ? 16 : st === 'bob' ? 10 : 5, hair); rect(g, hx + hw, hy + 1, 1, st === 'long' ? 16 : st === 'bob' ? 10 : 5, hair);
        if (st === 'long') { rect(g, hx - 2, hy + 6, 1, 11, hair); rect(g, hx + hw + 1, hy + 6, 1, 11, hair); }
        if (st === 'bun') { rect(g, cx - 2 + tilt, hy - 4, 4, 4, hair); rect(g, cx - 1 + tilt, hy - 5, 2, 1, hair); }
        rect(g, hx + 2, hy, 3, 1, shade(hair, 1.3));
      }
    } else {
      if (st === 'bald') { rect(g, hx, hy + 4, 3, 5, hair); px(g, hx + 4, hy, shade(skin, 1.15)); }
      else if (st === 'cap') { rect(g, hx - 1, hy - 1, hw + 1, 4, sp.capc); rect(g, hx + 4, hy + 3, hw - 1, 1, shade(sp.capc, .7)); }
      else {
        rect(g, hx, hy - 1, hw - 1, 3, hair); rect(g, hx - 1, hy, 4, st === 'long' ? 18 : st === 'bob' ? 11 : 8, hair);
        if (st === 'bun') { rect(g, hx - 3, hy, 4, 4, hair); }
        if (st === 'combover') { g.clearRect(hx + 3, hy - 1, 5, 1); }
      }
    }
  });
  return { c, eyes };
}
function drawKid(dir, fr) {
  const bw = 22, bh = 36, cx = 11;
  const skin = '#f0c49c', skinD = '#d8a47a', hair = '#5a3a1e', hoodie = '#c4452f', hoodD = '#922f1f', jeans = '#3c5a8a', jeansD = '#2c4468', shoe = '#ececec', pack = '#e0a63a';
  const walk = fr >= 1 && fr <= 4 ? fr : 0, bob = walk === 1 || walk === 3 ? -1 : 0;
  return canvas(bw, bh, g => {
    const feetY = 33, legTop = 26, ty = 16 + bob, hy = 4 + bob;
    if (dir === 2) {
      const f = walk === 1 ? 2 : walk === 3 ? -2 : 0;
      line(g, cx - 1, legTop, cx - 1 + f, feetY - 1, jeans, 3); line(g, cx - 1, legTop, cx - 1 - f, feetY - 1, jeansD, 3);
      rect(g, cx - 2 + f, feetY, 5, 2, shoe); rect(g, cx - 2 - f, feetY, 5, 2, '#cfcfcf'); px(g, cx + 2 + f, feetY + 1, '#c4452f');
      rect(g, cx - 6, ty + 1, 4, 8, pack); rect(g, cx - 6, ty + 1, 4, 1, shade(pack, 1.2));
      rect(g, cx - 3, ty, 8, 10, hoodie); rect(g, cx + 4, ty, 1, 10, hoodD);
      const sw = walk === 1 ? 2 : walk === 3 ? -2 : 0;
      line(g, cx, ty + 1, cx + sw, ty + 7, hoodD, 2); rect(g, cx + sw, ty + 8, 2, 2, skin);
    } else {
      const upL = walk === 1 ? 2 : 0, upR = walk === 3 ? 2 : 0;
      rect(g, cx - 5, legTop, 5, 7 - upL, jeans); rect(g, cx, legTop, 5, 7 - upR, jeans); rect(g, cx - 1, legTop + 2, 1, 5, jeansD);
      rect(g, cx - 5, feetY - upL, 4, 2, shoe); rect(g, cx + 1, feetY - upR, 4, 2, shoe); px(g, cx - 5, feetY + 1 - upL, '#c4452f'); px(g, cx + 4, feetY + 1 - upR, '#c4452f');
      rect(g, cx - 5, ty, 10, 10, hoodie); rect(g, cx - 5, ty, 10, 1, shade(hoodie, 1.15)); rect(g, cx + 4, ty + 1, 1, 9, hoodD);
      const sl = walk === 1 ? 1 : walk === 3 ? -1 : 0;
      rect(g, cx - 7, ty + 1, 2, 7 + sl, hoodie); rect(g, cx + 5, ty + 1, 2, 7 - sl, hoodD);
      rect(g, cx - 7, ty + 8 + sl, 2, 2, skin); rect(g, cx + 5, ty + 8 - sl, 2, 2, skin);
      if (dir === 0) { rect(g, cx - 3, ty + 6, 6, 3, hoodD); px(g, cx - 2, ty + 1, '#f2f2f2'); px(g, cx + 1, ty + 1, '#f2f2f2'); px(g, cx - 2, ty + 2, '#f2f2f2'); px(g, cx + 1, ty + 2, '#f2f2f2'); }
      else { rect(g, cx - 4, ty + 1, 8, 8, pack); rect(g, cx - 4, ty + 1, 8, 1, shade(pack, 1.2)); rect(g, cx - 3, ty + 5, 6, 3, shade(pack, .8)); rect(g, cx - 1, ty + 4, 2, 1, '#8a5a1a'); }
    }
    // head: big, like a kid's
    const hx = cx - 6, hw = 12, hh = 11;
    if (dir === 2) {
      rect(g, hx + 1, hy, hw - 2, hh, skin); rect(g, hx + hw - 1, hy + 5, 1, 2, skin);
      rect(g, hx, hy - 1, hw - 2, 4, hair); rect(g, hx, hy, 5, 8, hair); px(g, hx + 8, hy - 1, shade(hair, 1.3));
      rect(g, hx + 8, hy + 5, 1, 2, '#1d1d1d'); px(g, hx + 9, hy + 9, skinD);
    } else {
      rect(g, hx, hy, hw, hh, skin); g.clearRect(hx, hy + hh - 1, 1, 1); g.clearRect(hx + hw - 1, hy + hh - 1, 1, 1);
      rect(g, hx + 1, hy + hh - 1, hw - 2, 1, skinD);
      if (dir === 0) {
        rect(g, hx, hy - 1, hw, 4, hair); px(g, hx + 3, hy + 3, hair); px(g, hx + 7, hy + 3, hair); rect(g, hx - 1, hy, 1, 5, hair); rect(g, hx + hw, hy, 1, 5, hair);
        rect(g, hx + 3, hy + 5, 2, 2, '#1d1d1d'); rect(g, hx + 7, hy + 5, 2, 2, '#1d1d1d'); px(g, hx + 3, hy + 5, '#ffffff'); px(g, hx + 7, hy + 5, '#ffffff');
        rect(g, hx + 5, hy + 8, 2, 1, '#a8584a'); px(g, hx + 2, hy + 7, '#f0a890'); px(g, hx + 9, hy + 7, '#f0a890');
        px(g, hx + 5, hy - 2, hair); px(g, hx + 8, hy - 2, hair);
      } else {
        rect(g, hx - 1, hy - 1, hw + 2, hh - 1, hair); px(g, hx + 4, hy - 2, hair); px(g, hx + 8, hy - 2, hair); px(g, hx + 3, hy, shade(hair, 1.3));
        rect(g, hx + 2, hy + hh - 2, hw - 4, 2, hoodD);
      }
    }
  });
}

// the people of the store: the employees in their yellow shirts, the cleaner and the manager
// (internally they are still "teachers", "janitor" and "principal")
function makeCast() {
  const R = rng(3008);
  const cast = [];
  const shirts = ['#f2c230', '#eabb2a', '#f4c83c', '#e8b828'];
  const pants = ['#1f2f52', '#26365a', '#2a2e36', '#1c2a48'];
  for (let i = 0; i < 10; i++) {
    const female = i % 2 === 1;
    const sp = {
      skin: SKINS[(R() * SKINS.length) | 0], hair: HAIRC[(R() * HAIRC.length) | 0],
      glasses: R() < .35, mustache: !female && R() < .3, heels: false, tilt: R() < .5 ? 1 : 0,
      female, voice: female ? (R() < .5 ? 'clb' : 'slt') : 'bdl', rate: female ? rand(.92, 1.04) : rand(.88, 1.02),
      topStyle: 'polo', top: shirts[(R() * shirts.length) | 0], shirt: '#f2f2ee', bottomStyle: 'pants', bottom: pants[(R() * pants.length) | 0]
    };
    if (R() < .5) sp.badge = true; else sp.lanyard = true;
    sp.hairStyle = female ? ['bun', 'long', 'bob', 'bun', 'long'][(R() * 5) | 0] : ['short', 'bald', 'combover', 'short'][(R() * 4) | 0];
    cast.push(sp);
  }
  const principal = { skin: '#e0b48f', hair: '#7a7a76', hairStyle: 'bald', topStyle: 'suit', top: '#1c2438', shirt: '#f2f2ee', tie: '#d8a82a', bottomStyle: 'pants', bottom: '#1c2438',
    glasses: true, mustache: true, wide: true, tall: 4, tilt: 1, voice: 'bdl', rate: .8, principal: true };
  const janitor = { skin: '#c99470', hair: '#3a2a1a', hairStyle: 'cap', capc: '#5a6068', topStyle: 'overalls', top: '#5a6068', shirt: '#2c5fa8', bottomStyle: 'pants', bottom: '#5a6068',
    voice: 'bdl', rate: .95, janitor: true };
  const kinds = {
    substitute: { skin: '#d8c8b0', hair: '#141414', hairStyle: 'short', topStyle: 'polo', top: '#f2c230', shirt: '#f2f2ee', badge: true, bottomStyle: 'pants', bottom: '#1f2f52', tall: 9, arms: 7, tilt: 1, voice: 'bdl', rate: 1.08 },
    monitor: { skin: '#e0b48f', hair: '#8a6a42', hairStyle: 'cap', capc: '#1a2238', topStyle: 'sweater', top: '#1f2a44', shirt: '#ece8dc', bottomStyle: 'pants', bottom: '#1a2238', whistle: true, glasses: true, female: true, voice: 'slt', rate: .95 },
    lunch: { skin: '#c99470', hair: '#e8e4dc', hairStyle: 'bun', topStyle: 'sweater', top: '#eeeae2', shirt: '#ece8dc', bottomStyle: 'pants', bottom: '#2a2e36', apron: true, wide: true, female: true, voice: 'clb', rate: .86 },
    coach: { skin: '#9c6b4a', hair: '#1a1a1a', hairStyle: 'cap', capc: '#f2c230', topStyle: 'sweater', top: '#e8781a', shirt: '#f2f2f2', bottomStyle: 'pants', bottom: '#1f2f52', stripe: true, mustache: true, voice: 'bdl', rate: .94 },
    librarian: { skin: '#f1c9a5', hair: '#8a8a84', hairStyle: 'long', topStyle: 'polo', top: '#f2c230', shirt: '#f2f2ee', badge: true, bottomStyle: 'pants', bottom: '#1f2f52', glasses: true, tilt: 1, female: true, voice: 'clb', rate: .9 }
  };
  return { teachers: cast, principal, janitor, kinds };
}
const CAST = makeCast();
function buildSprites(sp) {
  const out = { day: [], night: [] };
  for (const mode of ['day', 'night']) for (let dir = 0; dir < 4; dir++) {
    out[mode][dir] = [];
    for (let fr = 0; fr < 8; fr++) {
      const { c, eyes } = drawAdult(sp, dir === 3 ? 2 : dir, fr, mode === 'night');
      let o = outlined(c);
      let e = eyes.map(([x, y]) => [x + 1, y + 1]);
      if (dir === 3) { o = mirrored(o); e = e.map(([x, y]) => [o.width - 1 - x, y]); }
      out[mode][dir][fr] = { c: o, eyes: e };
    }
  }
  return out;
}
const TEACHER_SPR = CAST.teachers.map(buildSprites);
const PRINCIPAL_SPR = buildSprites(CAST.principal);
const JANITOR_SPR = buildSprites(CAST.janitor);
const KIND_SPR = {};
for (const k in CAST.kinds) KIND_SPR[k] = buildSprites(CAST.kinds[k]);

// the face you see when one of them catches you: 48 x 40 pixels, blown up to fill the screen
const SCARE_CACHE = new Map();
function scareFace(sp, open) {
  const key = (sp.top || '') + (sp.hair || '') + open;
  if (SCARE_CACHE.has(key)) return SCARE_CACHE.get(key);
  const skin = NIGHT_SKIN(sp.skin), skinD = shade(skin, .7), hair = shade(sp.hair, .7);
  const c = canvas(48, 40, g => {
    rect(g, 0, 0, 48, 40, '#000000');
    ellipse(g, 24, 22, 17, 20, skin);
    for (let y = 30; y < 42; y++) rect(g, 7, y, 34, 1, y > 34 ? skinD : skin);
    if (sp.hairStyle === 'cap') { rect(g, 6, 0, 36, 8, shade(sp.capc, .6)); rect(g, 2, 8, 44, 2, shade(sp.capc, .4)); }
    else if (sp.hairStyle !== 'bald') { ellipse(g, 24, 4, 19, 6, hair); if (sp.hairStyle === 'long' || sp.hairStyle === 'bob') { rect(g, 4, 4, 5, 36, hair); rect(g, 39, 4, 5, 36, hair); } }
    // hollow eyes, sunk deep, with a point of red at the bottom of each
    for (const ex of [15, 33]) { ellipse(g, ex, 16, 6, 5, skinD); ellipse(g, ex, 16, 5, 4, '#030303'); rect(g, ex - 1, 17, 2, 2, '#ff1a10'); px(g, ex, 17, '#ffd0c0'); }
    if (sp.glasses) for (const ex of [15, 33]) { g.strokeStyle = '#1a1a1a'; g.strokeRect(ex - 6.5, 10.5, 13, 11); }
    rect(g, 22, 22, 4, 3, skinD);
    // the mouth: far too wide, and full of teeth
    const mh = open ? 11 : 4, my = 28;
    ellipse(g, 24, my + (mh >> 1), 15, mh >> 1, '#100000');
    for (let x = 11; x < 38; x += 3) { rect(g, x, my, 2, open ? 3 : 2, '#e8e0c8'); if (open) rect(g, x + 1, my + mh - 2, 2, 3, '#d8d0b8'); }
    line(g, 8, my - 2, 10, my + 2, '#100000'); line(g, 40, my - 2, 38, my + 2, '#100000');
    for (let i = 0; i < 18; i++) px(g, 8 + ((i * 37) % 32), 4 + ((i * 53) % 30), skinD);
  });
  SCARE_CACHE.set(key, c);
  return c;
}
const KID_SPR = [];
for (let dir = 0; dir < 4; dir++) { KID_SPR[dir] = []; for (let fr = 0; fr < 5; fr++) { const o = outlined(drawKid(dir === 3 ? 2 : dir, fr)); KID_SPR[dir][fr] = dir === 3 ? mirrored(o) : o; } }

// ============================================================ small sprites for the HUD and effects
const SHADOW = ditherBlob(26, 9, '#000000', 3);
const SHADOW_BIG = ditherBlob(34, 11, '#000000', 3);
const LIGHT_POOL = ditherBlob(88, 60, '#fff4d6', 6);
const HEART = (fill) => canvas(9, 8, g => {
  const sh = ['.##.##...', '#######..', '#######..', '.#####...', '..###....', '...#.....'];
  const s = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
  s.forEach((r, y) => { for (let x = 0; x < 7; x++) if (r[x] === '#') px(g, x + 1, y + 1, fill === 2 || (fill === 1 && x < 4) ? (y < 2 && x > 0 && x < 3 ? '#ff8a8a' : '#d42a2a') : '#3a1414'); });
  sh.length; rect(g, 0, 2, 1, 2, '#000'); rect(g, 8, 2, 1, 2, '#000'); rect(g, 1, 0, 2, 1, '#000'); rect(g, 4, 0, 2, 1, '#000');
});
const HEARTS = [HEART(0), HEART(1), HEART(2)];
