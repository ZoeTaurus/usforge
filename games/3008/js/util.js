'use strict';
// ============================================================ constants shared by every module
const T = 32;                     // one tile, in game pixels
const B = 14;                     // a cell is B x B tiles: a room plus the hallways above and left of it
const DAY_LEN = 210, NIGHT_LEN = 240;
const DUSK = 30;                  // seconds before closing when the store starts to wind down
let W = 640, H = 360;             // view size in game pixels, chosen by resize()

const cvs = document.getElementById('game');
const ctx = cvs.getContext('2d');

// ============================================================ math
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = a => a[(Math.random() * a.length) | 0];
const smooth = t => t * t * (3 - 2 * t);
const angDiff = (a, b) => { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

let SEED = 1;
function mix32(h) { h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15; h = Math.imul(h, 0x846ca68b); h ^= h >>> 16; return h; }
function hash(x, y, s) { return (mix32(mix32(mix32(SEED ^ (x | 0)) + (y | 0)) + (s | 0)) >>> 0) / 4294967296; }
function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }

// tile and cell coordinates packed into one number, so maps don't build strings
const KOFF = 1048576, KMUL = 2097152;
const K = (x, y) => (x + KOFF) * KMUL + (y + KOFF);
const KX = k => Math.floor(k / KMUL) - KOFF;
const KY = k => (k % KMUL) - KOFF;
const CK = (cx, cy) => (cx + 32768) * 65536 + (cy + 32768);

// ============================================================ colour + canvas helpers
function canvas(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); if (fn) fn(g, c); return c; }
function hexRgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbHex(r, g, b) { return '#' + ((1 << 24) | (clamp(r | 0, 0, 255) << 16) | (clamp(g | 0, 0, 255) << 8) | clamp(b | 0, 0, 255)).toString(16).slice(1); }
function shade(hex, f) { const [r, g, b] = hexRgb(hex); return rgbHex(r * f, g * f, b * f); }
function mixc(a, b, t) { const A = hexRgb(a), C = hexRgb(b); return rgbHex(lerp(A[0], C[0], t), lerp(A[1], C[1], t), lerp(A[2], C[2], t)); }
function rect(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
function px(g, x, y, c) { g.fillStyle = c; g.fillRect(x, y, 1, 1); }
function speckle(g, R, x, y, w, h, n, cols) { for (let i = 0; i < n; i++) px(g, x + ((R() * w) | 0), y + ((R() * h) | 0), cols[(R() * cols.length) | 0]); }

// 1px outline around every opaque pixel: keeps sprites readable on any floor
function outlined(src, col = '#16121a') {
  const w = src.width + 2, h = src.height + 2;
  const s = src.getContext('2d').getImageData(0, 0, src.width, src.height).data;
  const at = (x, y) => x >= 0 && y >= 0 && x < src.width && y < src.height && s[(y * src.width + x) * 4 + 3] > 0;
  return canvas(w, h, g => {
    g.fillStyle = col;
    for (let y = -1; y <= src.height; y++) for (let x = -1; x <= src.width; x++) {
      if (at(x, y)) continue;
      if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) g.fillRect(x + 1, y + 1, 1, 1);
    }
    g.drawImage(src, 1, 1);
  });
}

// ============================================================ the 3x5 font for writing inside the world
const TINY = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
  4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111',
  9: '111101111001110', '.': '000000000000010', ',': '000000000010100', '!': '010010010000010', '?': '110001010000010',
  "'": '010010000000000', '-': '000000111000000', ':': '000010000010000', '/': '001001010100100', '+': '000010111010000',
  '=': '000111000111000', ' ': '000000000000000', '(': '010100100100010', ')': '010001001001010', '#': '101111101111101',
  '%': '101001010100101', '&': '010101010101011', '"': '101101000000000', '*': '101010101000000'
};
function tiny(g, s, x, y, col, sc = 1, jitter = 0, R = Math.random) {
  g.fillStyle = col; s = String(s).toUpperCase();
  for (let i = 0; i < s.length; i++) {
    const gl = TINY[s[i]] || TINY['?'];
    const jy = jitter ? Math.round((R() - .5) * jitter) : 0;
    for (let k = 0; k < 15; k++) if (gl[k] === '1') g.fillRect(x + (k % 3) * sc, y + jy + ((k / 3) | 0) * sc, sc, sc);
    x += 4 * sc;
  }
}
const tinyW = (s, sc = 1) => Math.max(0, String(s).length * 4 * sc - sc);

// ============================================================ crisp HUD text: a 5x7 bitmap font, so every pixel lands exactly
const F57 = {
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14], D: [28, 18, 17, 17, 17, 18, 28],
  E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16], G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14], J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17], S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 17, 10, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
  0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14], 2: [14, 17, 1, 2, 4, 8, 31], 3: [31, 2, 4, 2, 1, 17, 14], 4: [2, 6, 10, 18, 31, 2, 2],
  5: [31, 16, 30, 1, 1, 17, 14], 6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8], 8: [14, 17, 17, 14, 17, 17, 14], 9: [14, 17, 17, 15, 1, 2, 12],
  '.': [0, 0, 0, 0, 0, 12, 12], ',': [0, 0, 0, 0, 12, 4, 8], ':': [0, 12, 12, 0, 12, 12, 0], ';': [0, 12, 12, 0, 12, 4, 8], '!': [4, 4, 4, 4, 4, 0, 4],
  '?': [14, 17, 1, 2, 4, 0, 4], "'": [12, 4, 8, 0, 0, 0, 0], '"': [10, 10, 10, 0, 0, 0, 0], '-': [0, 0, 0, 31, 0, 0, 0], '+': [0, 4, 4, 31, 4, 4, 0],
  '/': [0, 1, 2, 4, 8, 16, 0], '(': [2, 4, 8, 8, 8, 4, 2], ')': [8, 4, 2, 2, 2, 4, 8], '%': [24, 25, 2, 4, 8, 19, 3], '#': [10, 10, 31, 10, 31, 10, 10],
  '&': [12, 18, 20, 8, 21, 18, 13], '*': [0, 4, 21, 14, 21, 4, 0], '<': [2, 4, 8, 16, 8, 4, 2], '>': [8, 4, 2, 1, 2, 4, 8], '=': [0, 0, 31, 0, 31, 0, 0],
  '_': [0, 0, 0, 0, 0, 0, 31], '[': [14, 8, 8, 8, 8, 8, 14], ']': [14, 2, 2, 2, 2, 2, 14], '^': [4, 10, 17, 0, 0, 0, 0], ' ': [0, 0, 0, 0, 0, 0, 0]
};
const textCache = new Map();
const glyphScale = size => Math.max(1, Math.round(size / 8));
function textSprite(s, col, size, shadow) {
  const k = s + '\u0001' + col + '\u0001' + size + '\u0001' + shadow;
  let c = textCache.get(k);
  if (c) return c;
  if (textCache.size > 800) textCache.clear();
  const sc = glyphScale(size), str = String(s).toUpperCase(), w = Math.max(1, str.length * 6 * sc - sc), h = 7 * sc;
  const sh = shadow ? sc : 0;
  c = canvas(w + sh, h + sh, g => {
    const draw = (ox, oy, colr) => {
      g.fillStyle = colr;
      for (let i = 0; i < str.length; i++) {
        const gl = F57[str[i]] || F57['?'];
        for (let y = 0; y < 7; y++) { const row = gl[y]; if (!row) continue; for (let x = 0; x < 5; x++) if (row & (16 >> x)) g.fillRect(ox + (i * 6 + x) * sc, oy + y * sc, sc, sc); }
      }
    };
    if (shadow) draw(sc, sc, shadow);
    draw(0, 0, col);
  });
  c.tw = w;
  textCache.set(k, c);
  return c;
}
function txt(s, x, y, col = '#ffffff', size = 8, align = 'left', shadow = '#000000') {
  const c = textSprite(String(s), col, size, shadow);
  const dx = align === 'center' ? x - (c.tw >> 1) : align === 'right' ? x - c.tw : x;
  ctx.drawImage(c, Math.round(dx), Math.round(y));
  return c.tw;
}
const txtW = (s, size = 8) => Math.max(1, String(s).length * 6 * glyphScale(size) - glyphScale(size));

// ordered dither threshold (4x4 Bayer), used by the lighting and the gradients
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16);

// a soft blob made of hard pixels: stepped + dithered so it still looks like pixel art
function ditherBlob(w, h, col, steps = 5) {
  const [r, g, b] = hexRgb(col);
  return canvas(w, h, gg => {
    const img = gg.createImageData(w, h), o = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = (x + .5) / w * 2 - 1, dy = (y + .5) / h * 2 - 1, d = Math.sqrt(dx * dx + dy * dy);
      let v = clamp(1 - d, 0, 1); v = v * v;
      const q = Math.floor(v * steps + BAYER[(y & 3) * 4 + (x & 3)]) / steps;
      const i = (y * w + x) * 4; o[i] = r; o[i + 1] = g; o[i + 2] = b; o[i + 3] = q * 255;
    }
    gg.putImageData(img, 0, 0);
  });
}

// ============================================================ room kinds (shared by art, world and render)
const RT = { CLASS: 0, LIB: 1, CAFE: 2, STORE: 3, COMMONS: 4, BATH: 5, GYM: 6, SCIENCE: 7, MUSIC: 8, ART: 9, NURSE: 10, LOUNGE: 11, OFFICE: 12 };
const NRT = 13;
// the internal keys are old names; what each one is now: living rooms, bookcases, restaurant, warehouse, marketplace,
// bathrooms, children's, kitchens, bedrooms, decoration, first aid, staff room, manager's office
const ROOM_NAMES = ['LIVING ROOMS', 'BOOKCASES', 'RESTAURANT', 'WAREHOUSE', 'MARKETPLACE', 'BATHROOMS', "CHILDREN'S", 'KITCHENS', 'BEDROOMS', 'DECORATION', 'FIRST AID', 'STAFF ROOM', "MANAGER'S OFFICE"];
const HALL = 0, WALL = 1, FLOOR0 = 2;   // tile codes: room floors are FLOOR0 + room kind
