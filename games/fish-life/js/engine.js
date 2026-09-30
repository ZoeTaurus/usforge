'use strict';
/* =====================================================================
   FISH LIFE  -  engine.js
   ---------------------------------------------------------------------
   A tiny pixel engine. The whole game is drawn onto a 320x180 canvas
   that the browser scales up with nearest-neighbour filtering. There is
   no smoothing, no anti-aliasing and no vector text anywhere: every
   shape, letter and even the mouse cursor is made of real, chunky pixels.
   ===================================================================== */

const W = 320, H = 180;
const REDUCED_MOTION = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const canvasEl = document.getElementById('game');
canvasEl.width = W;
canvasEl.height = H;
const ctx = canvasEl.getContext('2d');
ctx.imageSmoothingEnabled = false;

// Current draw target. Painting helpers draw into `gfx`, which is the
// screen by default but can be pointed at an offscreen canvas.
let gfx = ctx;
function setTarget(g) {
  const prev = gfx;
  gfx = g || ctx;
  gfx.imageSmoothingEnabled = false;
  return prev;
}

/* ------------------------------------------------------------- math */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const rndi = (a, b) => Math.floor(rnd(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
const easeOut = t => 1 - (1 - t) * (1 - t);
const easeIn = t => t * t;
const easeInOut = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const approach = (v, to, step) => (v < to ? Math.min(v + step, to) : Math.max(v - step, to));

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 1234 -> "1234", 12345 -> "12.3K", 4560000 -> "4.56M"
function fmt(n) {
  n = Math.floor(n);
  if (n < 10000) return String(n);
  const units = ['K', 'M', 'B', 'T', 'QA', 'QI'];
  let u = -1, v = n;
  while (v >= 1000 && u < units.length - 1) { v /= 1000; u++; }
  const s = v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : String(Math.floor(v));
  return s + units[u];
}

/* ---------------------------------------------------------- colours */
function hexRgb(hex) {
  const n = parseInt(hex.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbHex(r, g, b) {
  const c = v => clamp(Math.round(v), 0, 255);
  return '#' + ((1 << 24) | (c(r) << 16) | (c(g) << 8) | c(b)).toString(16).slice(1);
}
function mix(c1, c2, t) {
  const a = hexRgb(c1), b = hexRgb(c2);
  return rgbHex(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t));
}

/* ------------------------------------------------------- canvases */
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  c.getContext('2d').imageSmoothingEnabled = false;
  return c;
}
function flipCanvas(src) {
  const c = makeCanvas(src.width, src.height), g = c.getContext('2d');
  g.translate(src.width, 0);
  g.scale(-1, 1);
  g.drawImage(src, 0, 0);
  return c;
}
// Solid-colour silhouette of a canvas (used for hit flashes).
function silhouette(src, color) {
  const c = makeCanvas(src.width, src.height), g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}
// Adds a 1px outline (4-neighbour) around everything opaque in `src`.
function outlineCanvas(src, color, diag = false) {
  const w = src.width + 2, h = src.height + 2;
  const c = makeCanvas(w, h), g = c.getContext('2d');
  const s = src.getContext('2d').getImageData(0, 0, src.width, src.height).data;
  const on = (x, y) => x >= 0 && y >= 0 && x < src.width && y < src.height && s[(y * src.width + x) * 4 + 3] > 0;
  g.fillStyle = color;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = x - 1, sy = y - 1;
      if (on(sx, sy)) continue;
      let n = on(sx - 1, sy) || on(sx + 1, sy) || on(sx, sy - 1) || on(sx, sy + 1);
      if (!n && diag) n = on(sx - 1, sy - 1) || on(sx + 1, sy - 1) || on(sx - 1, sy + 1) || on(sx + 1, sy + 1);
      if (n) g.fillRect(x, y, 1, 1);
    }
  }
  g.drawImage(src, 1, 1);
  return c;
}

/* --------------------------------------------------------- dithering */
const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
const bayer = (x, y) => (BAYER4[y & 3][x & 3] + 0.5) / 16;

const _patterns = new Map();
function ditherPattern(color, level) {
  const key = color + level;
  let p = _patterns.get(key);
  if (!p) {
    const c = makeCanvas(4, 4), g = c.getContext('2d');
    g.fillStyle = color;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (BAYER4[y][x] < level) g.fillRect(x, y, 1, 1);
    p = ctx.createPattern(c, 'repeat');
    _patterns.set(key, p);
  }
  return p;
}
// Fills a rectangle with an ordered-dither of `color` at coverage 0..1.
function ditherRect(x, y, w, h, color, amount) {
  const level = Math.round(clamp(amount, 0, 1) * 16);
  if (level <= 0) return;
  if (level >= 16) { rect(x, y, w, h, color); return; }
  const x0 = Math.round(x), y0 = Math.round(y);
  gfx.fillStyle = ditherPattern(color, level);
  gfx.fillRect(x0, y0, Math.round(x + w) - x0, Math.round(y + h) - y0);
}

// Paints a dithered vertical gradient straight into pixels.
// stops: [[pos 0..1, '#hex'], ...]. `band` > 1 keeps bands solid and only
// dithers the seams between them (the classic pixel-art sky look).
function paintGradient(g, x, y, w, h, stops, band = 3) {
  const img = g.getImageData(x, y, w, h), d = img.data;
  const cols = stops.map(s => hexRgb(s[1]));
  for (let j = 0; j < h; j++) {
    const t = h > 1 ? j / (h - 1) : 0;
    let i = 0;
    while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
    const t0 = stops[i][0], t1 = stops[i + 1][0];
    let f = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
    f = clamp((f - 0.5) * band + 0.5, 0, 1);
    for (let k = 0; k < w; k++) {
      const c = bayer(x + k, y + j) < f ? cols[i + 1] : cols[i];
      const o = (j * w + k) * 4;
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    }
  }
  g.putImageData(img, x, y);
}
function gradientCanvas(w, h, stops, band) {
  const c = makeCanvas(w, h);
  paintGradient(c.getContext('2d'), 0, 0, w, h, stops, band);
  return c;
}

/* -------------------------------------------------- pixel primitives */
function rect(x, y, w, h, c) {
  const x0 = Math.round(x), y0 = Math.round(y);
  const x1 = Math.round(x + w), y1 = Math.round(y + h);
  if (x1 <= x0 || y1 <= y0) return;
  gfx.fillStyle = c;
  gfx.fillRect(x0, y0, x1 - x0, y1 - y0);
}
function px(x, y, c) {
  gfx.fillStyle = c;
  gfx.fillRect(Math.round(x), Math.round(y), 1, 1);
}
// Filled pixel disc. The +0.8r fudge gives rounder small circles.
function disc(cx, cy, r, c) {
  cx = Math.round(cx); cy = Math.round(cy);
  gfx.fillStyle = c;
  if (r < 0.75) { gfx.fillRect(cx, cy, 1, 1); return; }
  const rr = r * r + r * 0.8, ri = Math.ceil(r);
  for (let dy = -ri; dy <= ri; dy++) {
    const q = rr - dy * dy;
    if (q < 0) continue;
    const hw = Math.floor(Math.sqrt(q));
    gfx.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1);
  }
}
// Pixel circle outline. Rows above `minY` are skipped.
function ring(cx, cy, r, c, minY = -Infinity) {
  cx = Math.round(cx); cy = Math.round(cy);
  gfx.fillStyle = c;
  const ro = r * r + r * 0.8, ri2 = (r - 1) * (r - 1) + (r - 1) * 0.8, R = Math.ceil(r);
  for (let dy = -R; dy <= R; dy++) {
    const qo = ro - dy * dy;
    if (qo < 0 || cy + dy < minY) continue;
    const wo = Math.floor(Math.sqrt(qo));
    const qi = ri2 - dy * dy;
    if (qi < 0 || r < 1.5) { gfx.fillRect(cx - wo, cy + dy, wo * 2 + 1, 1); continue; }
    const wi = Math.floor(Math.sqrt(qi));
    gfx.fillRect(cx - wo, cy + dy, wo - wi, 1);
    gfx.fillRect(cx + wi + 1, cy + dy, wo - wi, 1);
  }
}
function ellipse(cx, cy, rx, ry, c) {
  cx = Math.round(cx); cy = Math.round(cy);
  gfx.fillStyle = c;
  const R = Math.ceil(ry);
  for (let dy = -R; dy <= R; dy++) {
    const q = 1 - (dy * dy) / ((ry + 0.4) * (ry + 0.4));
    if (q < 0) continue;
    const hw = Math.floor(rx * Math.sqrt(q) + 0.2);
    gfx.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1);
  }
}
// Bresenham line.
function line(x0, y0, x1, y1, c) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  gfx.fillStyle = c;
  for (let i = 0; i < 2000; i++) {
    gfx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
// Thick line made of stamped pixel discs.
function thickLine(x0, y0, x1, y1, r, c) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= n; i++) disc(lerp(x0, x1, i / n), lerp(y0, y1, i / n), r, c);
}
// Draws a canvas/sprite at whole-pixel coordinates.
function blit(img, x, y) {
  gfx.drawImage(img, Math.round(x), Math.round(y));
}

/* ------------------------------------------------------ bitmap fonts */
// Glyph rows are separated by spaces, '#' = pixel on.
const FONT5_DATA = {
  A: '.###. #...# #...# ##### #...# #...# #...#', B: '####. #...# #...# ####. #...# #...# ####.',
  C: '.###. #...# #.... #.... #.... #...# .###.', D: '####. #...# #...# #...# #...# #...# ####.',
  E: '##### #.... #.... ####. #.... #.... #####', F: '##### #.... #.... ####. #.... #.... #....',
  G: '.###. #...# #.... #.### #...# #...# .####', H: '#...# #...# #...# ##### #...# #...# #...#',
  I: '### .#. .#. .#. .#. .#. ###', J: '....# ....# ....# ....# #...# #...# .###.',
  K: '#...# #..#. #.#.. ##... #.#.. #..#. #...#', L: '#.... #.... #.... #.... #.... #.... #####',
  M: '#...# ##.## #.#.# #.#.# #...# #...# #...#', N: '#...# ##..# #.#.# #..## #...# #...# #...#',
  O: '.###. #...# #...# #...# #...# #...# .###.', P: '####. #...# #...# ####. #.... #.... #....',
  Q: '.###. #...# #...# #...# #.#.# #..#. .##.#', R: '####. #...# #...# ####. #.#.. #..#. #...#',
  S: '.#### #.... #.... .###. ....# ....# ####.', T: '##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..',
  U: '#...# #...# #...# #...# #...# #...# .###.', V: '#...# #...# #...# #...# #...# .#.#. ..#..',
  W: '#...# #...# #...# #.#.# #.#.# #.#.# .#.#.', X: '#...# #...# .#.#. ..#.. .#.#. #...# #...#',
  Y: '#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..', Z: '##### ....# ...#. ..#.. .#... #.... #####',
  0: '.###. #...# #..## #.#.# ##..# #...# .###.', 1: '.#. ##. .#. .#. .#. .#. ###',
  2: '.###. #...# ....# ...#. ..#.. .#... #####', 3: '##### ...#. ..#.. ...#. ....# #...# .###.',
  4: '...#. ..##. .#.#. #..#. ##### ...#. ...#.', 5: '##### #.... ####. ....# ....# #...# .###.',
  6: '..##. .#... #.... ####. #...# #...# .###.', 7: '##### ....# ...#. ..#.. .#... .#... .#...',
  8: '.###. #...# #...# .###. #...# #...# .###.', 9: '.###. #...# #...# .#### ....# ...#. .##..',
  '.': '. . . . . . #', ',': '.. .. .. .. .. .# #.', '!': '# # # # # . #',
  '?': '.###. #...# ....# ...#. ..#.. ..... ..#..', ':': '. . # . . # .', ';': '.. .. .# .. .. .# #.',
  "'": '# # . . . . .', '"': '#.# #.# ... ... ... ... ...', '-': '.... .... .... #### .... .... ....',
  '+': '..... ..#.. ..#.. ##### ..#.. ..#.. .....', '=': '..... ..... ##### ..... ##### ..... .....',
  '/': '....# ....# ...#. ..#.. .#... #.... #....', '(': '..# .#. #.. #.. #.. .#. ..#',
  ')': '#.. .#. ..# ..# ..# .#. #..', '%': '##..# ##..# ...#. ..#.. .#... #..## #..##',
  '$': '..#.. .#### #.#.. .###. ..#.# ####. ..#..', '&': '.##.. #..#. #.#.. .#... #.#.# #..#. .##.#',
  '#': '.#.#. .#.#. ##### .#.#. ##### .#.#. .#.#.', '*': '..... #.#.# .###. ##### .###. #.#.# .....',
  '<': '...# ..#. .#.. #... .#.. ..#. ...#', '>': '#... .#.. ..#. ...# ..#. .#.. #...',
  '_': '..... ..... ..... ..... ..... ..... #####', '~': '..... ..... .#... #.#.# ...#. ..... .....',
  '[': '## #. #. #. #. #. ##', ']': '## .# .# .# .# .# ##',
  '@': '.###. #...# #.### #.#.# #.### #.... .####',
  '←': '..... ..#.. .#... ##### .#... ..#.. .....', '→': '..... ..#.. ...#. ##### ...#. ..#.. .....',
  '↑': '..#.. .###. #.#.# ..#.. ..#.. ..#.. .....', '↓': '..... ..#.. ..#.. ..#.. #.#.# .###. ..#..',
  '♥': '..... .#.#. ##### ##### .###. ..#.. .....', '▶': '#... ##.. ###. #### ###. ##.. #...',
  '✓': '..... ....# ...## #.##. ###.. .#... .....', '•': '.. .. ## ## .. .. ..',
  '▼': '..... ..... ##### .###. ..#.. ..... .....', '×': '..... ..... #...# .#.#. ..#.. .#.#. #...#',
};
const FONT3_DATA = {
  A: '.#. #.# ### #.# #.#', B: '##. #.# ##. #.# ##.', C: '.## #.. #.. #.. .##', D: '##. #.# #.# #.# ##.',
  E: '### #.. ##. #.. ###', F: '### #.. ##. #.. #..', G: '.## #.. #.# #.# .##', H: '#.# #.# ### #.# #.#',
  I: '### .#. .#. .#. ###', J: '..# ..# ..# #.# .#.', K: '#.# #.# ##. #.# #.#', L: '#.. #.. #.. #.. ###',
  M: '#...# ##.## #.#.# #...# #...#', N: '#..# ##.# #.## #..# #..#', O: '.#. #.# #.# #.# .#.',
  P: '##. #.# ##. #.. #..', Q: '.#. #.# #.# ##. .##', R: '##. #.# ##. #.# #.#', S: '.## #.. .#. ..# ##.',
  T: '### .#. .#. .#. .#.', U: '#.# #.# #.# #.# ###', V: '#.# #.# #.# .#. .#.',
  W: '#...# #...# #.#.# ##.## #...#', X: '#.# #.# .#. #.# #.#', Y: '#.# #.# .#. .#. .#.',
  Z: '### ..# .#. #.. ###', 0: '### #.# #.# #.# ###', 1: '.#. ##. .#. .#. ###', 2: '##. ..# .#. #.. ###',
  3: '##. ..# .#. ..# ##.', 4: '#.# #.# ### ..# ..#', 5: '### #.. ##. ..# ##.', 6: '.## #.. ### #.# ###',
  7: '### ..# .#. .#. .#.', 8: '### #.# ### #.# ###', 9: '### #.# ### ..# ##.',
  '.': '. . . . #', ',': '. . . # #', '!': '# # # . #', '?': '##. ..# .#. ... .#.', ':': '. # . # .',
  ';': '. # . # #', "'": '# # . . .', '"': '#.# #.# ... ... ...', '-': '... ... ### ... ...',
  '+': '... .#. ### .#. ...', '=': '... ### ... ### ...', '/': '..# ..# .#. #.. #..', '(': '.# #. #. #. .#',
  ')': '#. .# .# .# #.', '%': '#.# ..# .#. #.. #.#', '$': '.## ##. .#. .## ##.', '&': '.#. #.# .#. #.# .##',
  '#': '#.# ### #.# ### #.#', '*': '... #.# .#. #.# ...', '<': '..# .#. #.. .#. ..#', '>': '#.. .#. ..# .#. #..',
  '_': '... ... ... ... ###', '[': '## #. #. #. ##', ']': '## .# .# .# ##', '~': '.... .#.# #.#. .... ....',
  '←': '..... .#... ##### .#... .....', '→': '..... ...#. ##### ...#. .....', '↑': '.#. ### .#. .#. .#.',
  '↓': '.#. .#. .#. ### .#.', '♥': '.#.#. ##### ##### .###. ..#..', '▶': '#.. ##. ### ##. #..',
  '✓': '..... ....# ...#. #.#.. .#...', '•': '. . # . .', '×': '... #.# .#. #.# ...', '@': '### #.# #.# #.. .##',
  '▼': '..... ##### .###. ..#.. .....',
};

class PixelFont {
  constructor(data, h, space) {
    this.h = h;
    this.space = space;
    this.glyphs = {};
    const list = [];
    let x = 0;
    for (const ch in data) {
      const rows = data[ch].split(' ');
      const w = Math.max(...rows.map(r => r.length));
      list.push({ ch, rows, w, x });
      x += w + 1;
    }
    this.atlas = makeCanvas(x, h);
    const g = this.atlas.getContext('2d');
    g.fillStyle = '#fff';
    for (const gl of list) {
      for (let r = 0; r < h; r++) {
        const row = gl.rows[r] || '';
        for (let c = 0; c < row.length; c++) if (row[c] === '#') g.fillRect(gl.x + c, r, 1, 1);
      }
      this.glyphs[gl.ch] = { x: gl.x, w: gl.w };
    }
    this.tints = new Map();
  }
  tint(color) {
    let c = this.tints.get(color);
    if (!c) { c = silhouette(this.atlas, color); this.tints.set(color, c); }
    return c;
  }
  glyph(ch) {
    return this.glyphs[ch] || this.glyphs[ch.toUpperCase()] || this.glyphs['?'];
  }
  charW(ch) { return ch === ' ' ? this.space : this.glyph(ch).w; }
  width(str) {
    let w = 0;
    for (const ch of str) w += this.charW(ch) + 1;
    return Math.max(0, w - 1);
  }
  draw(str, x, y, color) {
    const img = this.tint(color);
    let cx = Math.round(x);
    y = Math.round(y);
    for (const ch of str) {
      if (ch === ' ') { cx += this.space + 1; continue; }
      const g = this.glyph(ch);
      gfx.drawImage(img, g.x, 0, g.w, this.h, cx, y, g.w, this.h);
      cx += g.w + 1;
    }
  }
}
const F5 = new PixelFont(FONT5_DATA, 7, 3);
const F3 = new PixelFont(FONT3_DATA, 5, 2);

const OUT4 = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const OUT8 = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];

// Rendered strings are cached as little canvases, so drawing a line of text
// costs one blit instead of one draw per letter (and per outline pass).
const _textCache = new Map();
function renderText(f, str, plain, color, opt) {
  const key = (f === F5 ? '5' : '3') + color + '|' + (opt.outline || '') + (opt.outline8 ? '8' : '') + '|' + (opt.shadow || '') + '|' + (opt.accent || '') + '|' + str;
  let c = _textCache.get(key);
  if (c) return c;
  if (_textCache.size > 800) _textCache.clear();
  const w = f.width(plain);
  c = makeCanvas(w + 3, f.h + 3);
  const prev = setTarget(c.getContext('2d'));
  const x = 1, y = 1;
  if (opt.outline) for (const [dx, dy] of opt.outline8 ? OUT8 : OUT4) f.draw(plain, x + dx, y + dy, opt.outline);
  if (opt.shadow) f.draw(plain, x + 1, y + 1, opt.shadow);
  if (opt.accent && str.includes('{')) {
    let cx = x, on = false, buf = '';
    const flush = () => {
      if (!buf) return;
      f.draw(buf, cx, y, on ? opt.accent : color);
      cx += f.width(buf) + 1;
      buf = '';
    };
    for (const ch of str) {
      if (ch === '{') { flush(); on = true; } else if (ch === '}') { flush(); on = false; } else buf += ch;
    }
    flush();
  } else f.draw(plain, x, y, color);
  setTarget(prev);
  _textCache.set(key, c);
  return c;
}

// text(str, x, y, color, {font, align, outline, outline8, shadow, accent})
// `{braces}` in the string are drawn in the accent colour.
function text(str, x, y, color = '#ffffff', opt = {}) {
  const f = opt.font || F5;
  str = String(str);
  const plain = str.replace(/[{}]/g, '');
  const w = f.width(plain);
  if (!plain) return 0;
  if (opt.align === 'center') x -= Math.floor(w / 2);
  else if (opt.align === 'right') x -= w;
  gfx.drawImage(renderText(f, str, plain, color, opt), Math.round(x) - 1, Math.round(y) - 1);
  return w;
}
function textW(str, font = F5) { return font.width(String(str).replace(/[{}]/g, '')); }

// Word wrap to a pixel width. Keeps `{accent}` markers intact.
function wrap(str, maxW, font = F5) {
  const out = [];
  for (const para of String(str).split('\n')) {
    const words = para.split(' ');
    let lineStr = '';
    for (const word of words) {
      const test = lineStr ? lineStr + ' ' + word : word;
      if (textW(test, font) > maxW && lineStr) { out.push(lineStr); lineStr = word; } else lineStr = test;
    }
    out.push(lineStr);
  }
  // keep {accent} spans balanced across line breaks
  for (let i = 0; i < out.length; i++) {
    const open = (out[i].match(/{/g) || []).length - (out[i].match(/}/g) || []).length;
    if (open > 0) { out[i] += '}'; if (i + 1 < out.length) out[i + 1] = '{' + out[i + 1]; }
  }
  return out;
}

/* -------------------------------------------- big stylised arcade text */
// Scales a mask up, rounds its corners, then adds a gradient fill,
// bevel, outline and a chunky 3D extrusion - all pixel by pixel.
const BIG_STYLES = {
  gold: { fill: ['#fff6c9', '#fee761', '#feae34', '#f77622'], hi: '#ffffff', shade: '#be4a2f', out: '#3e2731', ex: ['#2d1b4e', '#1b1238'] },
  aqua: { fill: ['#effeff', '#a4f4fb', '#2ce8f5', '#0099db'], hi: '#ffffff', shade: '#124e89', out: '#0b1330', ex: ['#0d2754', '#081530'] },
  red: { fill: ['#ffe3d6', '#ff8f7a', '#e43b44', '#a22633'], hi: '#ffffff', shade: '#6e1522', out: '#2a0a14', ex: ['#3e2731', '#1a0a12'] },
  silver: { fill: ['#ffffff', '#e8eef7', '#c0cbdc', '#8b9bb4'], hi: '#ffffff', shade: '#5a6988', out: '#181425', ex: ['#262b44', '#181425'] },
  green: { fill: ['#f0ffe0', '#b4f08c', '#63c74d', '#3e8948'], hi: '#ffffff', shade: '#265c42', out: '#0f2419', ex: ['#193c3e', '#0f2419'] },
  pink: { fill: ['#fff0f4', '#ffb0c8', '#f6757a', '#b55088'], hi: '#ffffff', shade: '#68386c', out: '#2a1030', ex: ['#3e2731', '#1b0f1f'] },
};

function scaleMask(src, s) {
  const c = makeCanvas(src.width * s, src.height * s), g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0, c.width, c.height);
  return c;
}
// Chamfers convex corners and fills concave ones so 2x-scaled pixels
// read as smooth, hand-drawn curves.
function roundMask(src) {
  const w = src.width, h = src.height;
  const g0 = src.getContext('2d');
  const d = g0.getImageData(0, 0, w, h).data;
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0;
  const c = makeCanvas(w, h), g = c.getContext('2d');
  g.fillStyle = '#fff';
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = on(x, y - 1), dn = on(x, y + 1), l = on(x - 1, y), r = on(x + 1, y);
      if (on(x, y)) {
        const convex = (!u && !l) || (!u && !r) || (!dn && !l) || (!dn && !r);
        const lonely = [u, dn, l, r].filter(Boolean).length <= 1;
        if (convex && !lonely) continue;
        g.fillRect(x, y, 1, 1);
      } else if ((u && l && on(x - 1, y - 1)) || (u && r && on(x + 1, y - 1)) || (dn && l && on(x - 1, y + 1)) || (dn && r && on(x + 1, y + 1))) {
        g.fillRect(x, y, 1, 1);
      }
    }
  }
  return c;
}
function stylize(mask, st, depth = 3) {
  const w = mask.width, h = mask.height;
  const md = mask.getContext('2d').getImageData(0, 0, w, h).data;
  const M = (x, y) => x >= 0 && y >= 0 && x < w && y < h && md[(y * w + x) * 4 + 3] > 0;
  const D = (x, y) => M(x, y) || M(x - 1, y) || M(x + 1, y) || M(x, y - 1) || M(x, y + 1);
  const OW = w + 2, OH = h + 2 + depth;
  const out = makeCanvas(OW, OH), g = out.getContext('2d');
  const img = g.createImageData(OW, OH), d = img.data;
  const put = (x, y, rgb) => { const o = (y * OW + x) * 4; d[o] = rgb[0]; d[o + 1] = rgb[1]; d[o + 2] = rgb[2]; d[o + 3] = 255; };
  const ex = st.ex.map(hexRgb), outc = hexRgb(st.out), hi = hexRgb(st.hi), sh = hexRgb(st.shade);
  const fill = st.fill.map(hexRgb);
  for (let k = depth; k >= 1; k--) {
    const col = k >= depth ? ex[1] : ex[0];
    for (let y = 0; y < OH; y++) for (let x = 0; x < OW; x++) if (D(x - 1, y - 1 - k)) put(x, y, col);
  }
  for (let y = 0; y < OH; y++) for (let x = 0; x < OW; x++) if (D(x - 1, y - 1)) put(x, y, outc);
  for (let y = 0; y < h; y++) {
    const t = h > 1 ? y / (h - 1) : 0;
    const seg = t * (fill.length - 1), i = Math.min(fill.length - 2, Math.floor(seg));
    const f = clamp((seg - i - 0.5) * 2.5 + 0.5, 0, 1);
    for (let x = 0; x < w; x++) {
      if (!M(x, y)) continue;
      let c = bayer(x, y) < f ? fill[i + 1] : fill[i];
      if (!M(x, y - 1)) c = hi;
      else if (!M(x, y + 1)) c = sh;
      put(x + 1, y + 1, c);
    }
  }
  g.putImageData(img, 0, 0);
  return out;
}
function textMask(str, font = F5) {
  const c = makeCanvas(font.width(str), font.h);
  const prev = setTarget(c.getContext('2d'));
  font.draw(str, 0, 0, '#ffffff');
  setTarget(prev);
  return c;
}
// Scale2x (EPX) upscaling: doubles a pixel mask while smoothing
// diagonals and corners the way a pixel artist would.
function scale2xMask(src) {
  const w = src.width, h = src.height;
  const d = src.getContext('2d').getImageData(0, 0, w, h).data;
  const on = (x, y) => (x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0 ? 1 : 0);
  const c = makeCanvas(w * 2, h * 2), g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const P = on(x, y), A = on(x, y - 1), B = on(x + 1, y), C = on(x - 1, y), D = on(x, y + 1);
      let e0 = P, e1 = P, e2 = P, e3 = P;
      if (C === A && C !== D && A !== B) e0 = A;
      if (A === B && A !== C && B !== D) e1 = B;
      if (D === C && D !== B && C !== A) e2 = C;
      if (B === D && B !== A && D !== C) e3 = D;
      if (e0) g.fillRect(x * 2, y * 2, 1, 1);
      if (e1) g.fillRect(x * 2 + 1, y * 2, 1, 1);
      if (e2) g.fillRect(x * 2, y * 2 + 1, 1, 1);
      if (e3) g.fillRect(x * 2 + 1, y * 2 + 1, 1, 1);
    }
  }
  return c;
}
const _bigCache = new Map();
function bigText(str, style = 'gold', scale = 2) {
  const key = str + '|' + style + '|' + scale;
  let c = _bigCache.get(key);
  if (!c) {
    let m = scale2xMask(textMask(str));
    if (scale >= 4) m = scale2xMask(m);
    c = stylize(m, BIG_STYLES[style] || BIG_STYLES.gold, scale >= 4 ? 4 : 3);
    _bigCache.set(key, c);
  }
  return c;
}
function drawBig(str, x, y, style = 'gold', align = 'center', scale = 2) {
  const c = bigText(str, style, scale);
  const dx = align === 'center' ? x - Math.floor(c.width / 2) : align === 'right' ? x - c.width : x;
  blit(c, dx, y);
  return c;
}

/* ------------------------------------------------------------ sprites */
// Sprites are authored as rows of characters mapped through a legend.
function spriteFromRows(rows, legend) {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const c = makeCanvas(w, h), g = c.getContext('2d');
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      const col = legend[rows[y][x]];
      if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
    }
  }
  return c;
}
const SPR = {};
// Registers a sprite from ready-made canvases (one per animation frame).
function addSprite(name, frames) {
  SPR[name] = {
    w: frames[0].width,
    h: frames[0].height,
    r: frames,
    l: frames.map(flipCanvas),
    white: frames.map(f => silhouette(f, '#ffffff')),
  };
  return SPR[name];
}
function defSprite(name, legend, ...frames) {
  return addSprite(name, frames.map(rows => spriteFromRows(rows, legend)));
}
// Draws sprite frame at (x,y) = top-left. flip=true mirrors horizontally.
function spr(name, frame, x, y, flip = false, white = false) {
  const s = SPR[name];
  if (!s) return;
  const arr = white ? s.white : flip ? s.l : s.r;
  gfx.drawImage(arr[((frame % arr.length) + arr.length) % arr.length], Math.round(x), Math.round(y));
}
// Draws a sprite centred on (x,y).
function sprC(name, frame, x, y, flip = false, white = false) {
  const s = SPR[name];
  if (!s) return;
  spr(name, frame, Math.round(x - s.w / 2), Math.round(y - s.h / 2), flip, white);
}

/* ------------------------------------------------------------- input */
const Input = {
  keys: new Set(),
  hits: new Set(),
  typed: [],
  mx: -100, my: -100,
  mdown: false, mhit: false, mup: false,
  hitX: 0, hitY: 0,
  wheel: 0,
  lastMove: -99,
  pointerType: 'mouse',
  touchSeen: false,
  pointers: new Map(),
  any: false,
};
const KEYMAP = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  ok: ['Enter', 'Space', 'NumpadEnter'],
  back: ['Escape', 'Backspace'],
  pause: ['Escape', 'KeyP'],
  dash: ['Space', 'ShiftLeft', 'ShiftRight'],
  menu: ['Tab', 'KeyU', 'KeyE'],
  mute: ['KeyM'],
  full: ['KeyF'],
};
const held = a => KEYMAP[a].some(k => Input.keys.has(k));
const hit = a => KEYMAP[a].some(k => Input.hits.has(k));
const keyHit = code => Input.hits.has(code);

window.addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'Backspace'].includes(e.code)) e.preventDefault();
  Sound.unlock();
  if (!e.repeat) Input.hits.add(e.code);
  Input.keys.add(e.code);
  if (e.key === 'Backspace') Input.typed.push('\b');
  else if (e.key.length === 1) Input.typed.push(e.key);
  Input.any = true;
});
window.addEventListener('keyup', e => Input.keys.delete(e.code));
window.addEventListener('blur', () => { Input.keys.clear(); Input.mdown = false; Input.pointers.clear(); });

function toGame(e) {
  const r = canvasEl.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
}
canvasEl.addEventListener('pointerdown', e => {
  Sound.unlock();
  try { canvasEl.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  const [x, y] = toGame(e);
  Input.pointers.set(e.pointerId, { x, y });
  Input.mx = x; Input.my = y; Input.hitX = x; Input.hitY = y;
  Input.mdown = true; Input.mhit = true; Input.any = true;
  Input.pointerType = e.pointerType;
  if (e.pointerType === 'touch') Input.touchSeen = true;
  canvasEl.focus();
  e.preventDefault();
});
canvasEl.addEventListener('pointermove', e => {
  const [x, y] = toGame(e);
  if (Input.pointers.has(e.pointerId)) Input.pointers.set(e.pointerId, { x, y });
  Input.mx = x; Input.my = y;
  Input.pointerType = e.pointerType;
  Input.lastMove = performance.now();
});
const endPointer = e => {
  Input.pointers.delete(e.pointerId);
  if (Input.pointers.size === 0) { if (Input.mdown) Input.mup = true; Input.mdown = false; }
};
canvasEl.addEventListener('pointerup', endPointer);
canvasEl.addEventListener('pointercancel', endPointer);
canvasEl.addEventListener('wheel', e => { Input.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
canvasEl.addEventListener('contextmenu', e => e.preventDefault());

function clearInputFrame() {
  Input.hits.clear();
  Input.typed.length = 0;
  Input.mhit = false;
  Input.mup = false;
  Input.wheel = 0;
  Input.any = false;
}
const clicked = (x, y, w, h) => Input.mhit && Input.hitX >= x && Input.hitX < x + w && Input.hitY >= y && Input.hitY < y + h;
const hover = (x, y, w, h) => Input.mx >= x && Input.mx < x + w && Input.my >= y && Input.my < y + h;
const mouseActive = () => Input.pointerType === 'mouse' && performance.now() - Input.lastMove < 2500;

/* -------------------------------------------------------- save/load */
const Save = {
  KEY: 'fishlife-save-v1',
  OPT: 'fishlife-options-v1',
  load() {
    try { const s = localStorage.getItem(this.KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; }
  },
  write(data) {
    try { localStorage.setItem(this.KEY, JSON.stringify(data)); } catch (e) { /* storage unavailable */ }
  },
  clear() {
    try { localStorage.removeItem(this.KEY); } catch (e) { /* storage unavailable */ }
  },
  options() {
    try { return JSON.parse(localStorage.getItem(this.OPT)) || {}; } catch (e) { return {}; }
  },
  setOptions(o) {
    try { localStorage.setItem(this.OPT, JSON.stringify(o)); } catch (e) { /* storage unavailable */ }
  },
};

function newGameState() {
  return {
    v: 1,
    chapter: 'sea',
    fishName: 'BUBBLES',
    sea: { stage: 0, food: 0, pearls: [] },
    bowl: null,
    stats: { eaten: 0, deaths: 0, flakes: 0, ideas: 0, time: 0, days: 1 },
    won: false,
  };
}
let GS = newGameState();
function saveGame() { Save.write(GS); }

/* ------------------------------------------------------- particles */
class Particles {
  constructor() { this.list = []; }
  add(p) {
    const q = Object.assign({ x: 0, y: 0, vx: 0, vy: 0, life: 1, g: 0, drag: 0, c: '#ffffff', type: 'px', size: 1, seed: Math.random() * 9 }, p);
    q.max = q.life;
    this.list.push(q);
    return q;
  }
  update(dt) {
    for (const p of this.list) {
      p.life -= dt;
      p.vy += p.g * dt;
      if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.type === 'bubble') p.x += Math.sin(p.life * 7 + p.seed) * 0.12;
      if (p.minY !== undefined && p.y < p.minY) p.life = 0;
    }
    this.list = this.list.filter(p => p.life > 0);
  }
  draw(ox = 0, oy = 0) {
    for (const p of this.list) {
      const x = Math.round(p.x - ox), y = Math.round(p.y - oy);
      if (x < -8 || y < -8 || x > W + 8 || y > H + 8) continue;
      const k = p.life / p.max;
      switch (p.type) {
        case 'bubble':
          if (p.size <= 1) px(x, y, p.c);
          else if (p.size === 2) { px(x, y - 1, p.c); px(x - 1, y, p.c); px(x + 1, y, p.c); px(x, y + 1, p.c); }
          else { ring(x, y, p.size - 1, p.c); px(x - 1, y - 1, '#ffffff'); }
          break;
        case 'spark':
          if (k > 0.5) { px(x, y, '#ffffff'); px(x - 1, y, p.c); px(x + 1, y, p.c); px(x, y - 1, p.c); px(x, y + 1, p.c); } else px(x, y, p.c);
          break;
        case 'ringfx':
          ring(x, y, p.size + (1 - k) * p.grow, p.c);
          break;
        case 'bone':
          spr('fishbone', 0, x - 6, y - 2);
          break;
        default:
          rect(x, y, p.size, p.size, p.c);
      }
    }
  }
}

// Little rising text popups ("+1", "OUCH!").
class Floaters {
  constructor() { this.list = []; }
  add(str, x, y, color = '#ffffff', opt = {}) {
    this.list.push({ str, x, y, color, life: opt.life || 1, max: opt.life || 1, vy: opt.vy || -14, font: opt.font || F3 });
  }
  update(dt) {
    for (const f of this.list) { f.life -= dt; f.y += f.vy * dt; }
    this.list = this.list.filter(f => f.life > 0);
  }
  draw(ox = 0, oy = 0) {
    for (const f of this.list) {
      if (f.life < 0.25 && Math.floor(f.life * 20) % 2) continue;
      text(f.str, f.x - ox, f.y - oy, f.color, { font: f.font, align: 'center', outline: '#07060f' });
    }
  }
}

/* ------------------------------------------------------ UI widgets */
// Chunky pixel panel with rounded corners and a double border.
function panel(x, y, w, h, opt = {}) {
  x = Math.round(x); y = Math.round(y);
  const dark = opt.dark || '#07060f', border = opt.border || '#c0cbdc', fill = opt.fill || '#1b1a33';
  rect(x + 2, y, w - 4, h, dark);
  rect(x, y + 2, w, h - 4, dark);
  rect(x + 1, y + 1, w - 2, h - 2, dark);
  rect(x + 2, y + 1, w - 4, h - 2, border);
  rect(x + 1, y + 2, w - 2, h - 4, border);
  if (opt.alpha !== undefined) {
    gfx.globalAlpha = opt.alpha;
    rect(x + 2, y + 2, w - 4, h - 4, fill);
    gfx.globalAlpha = 1;
  } else rect(x + 2, y + 2, w - 4, h - 4, fill);
  if (opt.shine !== false) rect(x + 3, y + 2, w - 6, 1, opt.shineColor || 'rgba(255,255,255,0.12)');
}

// Typewriter dialogue box used by cutscenes and tutorials.
const VOICES = {
  SAM: { f: 620, type: 'square' },
  SHOPKEEPER: { f: 220, type: 'square' },
  YOU: { f: 900, type: 'triangle' },
  FISHERMAN: { f: 180, type: 'square' },
  NEWS: { f: 400, type: 'square' },
};
class DialogBox {
  constructor() {
    this.who = '';
    this.lines = [];
    this.total = 0;
    this.shown = 0;
    this.done = true;
    this.t = 0;
    this.lastBlip = 0;
  }
  say(who, str) {
    this.who = who || '';
    this.lines = wrap(str, 282, F5);
    this.total = this.lines.reduce((a, l) => a + l.replace(/[{}]/g, '').length, 0);
    this.shown = 0;
    this.done = false;
    this.t = 0;
    this.lastBlip = 0;
  }
  skip() { this.shown = this.total; this.done = true; }
  update(dt) {
    this.t += dt;
    if (this.done) return;
    this.shown = Math.min(this.total, this.shown + dt * 55);
    if (Math.floor(this.shown / 2) !== this.lastBlip) {
      this.lastBlip = Math.floor(this.shown / 2);
      const v = VOICES[this.who];
      if (v) Sound.talk(v.f, v.type);
    }
    if (this.shown >= this.total) this.done = true;
  }
  // pos: 'top' | 'bottom'. The box grows with the number of lines.
  draw(pos = 'bottom') {
    const x = 6, w = 308, h = Math.max(26, 16 + this.lines.length * 10);
    const y = pos === 'top' ? 11 : H - 5 - h;
    panel(x, y, w, h, { fill: '#141330', border: '#8b9bb4' });
    if (this.who) {
      const tw = textW(this.who) + 10;
      panel(x + 6, y - 9, tw, 13, { fill: this.who === 'YOU' ? '#be4a2f' : this.who === 'SAM' ? '#124e89' : '#3a4466', border: '#c0cbdc' });
      text(this.who, x + 11, y - 5, '#ffffff');
    }
    let left = Math.floor(this.shown);
    let ly = y + 8;
    for (const l of this.lines) {
      const plain = l.replace(/[{}]/g, '');
      if (left <= 0) break;
      const part = plain.length <= left ? l : cutMarked(l, left);
      text(part, x + 10, ly, this.who ? '#ffffff' : '#9fe8f5', { accent: '#fee761' });
      left -= plain.length;
      ly += 10;
    }
    if (this.done && Math.floor(this.t * 3) % 2 === 0) text('▼', x + w - 13, y + h - 10, '#fee761');
  }
}
// Cuts a string with {accent} markup after n visible characters.
function cutMarked(str, n) {
  let out = '', count = 0;
  for (const ch of str) {
    if (ch === '{' || ch === '}') { out += ch; continue; }
    if (count >= n) break;
    out += ch;
    count++;
  }
  if ((out.match(/{/g) || []).length > (out.match(/}/g) || []).length) out += '}';
  return out;
}

// Simple vertical menu with keyboard + mouse support.
class Menu {
  constructor(items, opt = {}) {
    this.items = items;          // [{label, disabled?, action}]
    this.sel = 0;
    this.x = opt.x ?? W / 2;
    this.y = opt.y ?? 100;
    this.gap = opt.gap ?? 12;
    this.t = 0;
    while (this.items[this.sel] && this.items[this.sel].disabled) this.sel++;
  }
  rowRect(i) {
    const w = textW(this.items[i].label) + 16;
    return [this.x - w / 2, this.y + i * this.gap - 3, w, this.gap];
  }
  move(d) {
    const n = this.items.length;
    for (let k = 0; k < n; k++) {
      this.sel = (this.sel + d + n) % n;
      if (!this.items[this.sel].disabled) break;
    }
    Sound.sfx('move');
  }
  update(dt) {
    this.t += dt;
    if (hit('up')) this.move(-1);
    if (hit('down')) this.move(1);
    for (let i = 0; i < this.items.length; i++) {
      const [rx, ry, rw, rh] = this.rowRect(i);
      if (mouseActive() && hover(rx, ry, rw, rh) && !this.items[i].disabled && this.sel !== i) { this.sel = i; Sound.sfx('move'); }
      if (clicked(rx, ry, rw, rh) && !this.items[i].disabled) { this.sel = i; return this.activate(); }
    }
    if (hit('ok')) return this.activate();
    return null;
  }
  activate() {
    const it = this.items[this.sel];
    if (!it || it.disabled) { Sound.sfx('no'); return null; }
    Sound.sfx('ok');
    if (it.action) it.action();
    return it;
  }
  draw(outline = '#07060f') {
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      const y = this.y + i * this.gap;
      const sel = i === this.sel;
      const col = it.disabled ? '#5a6988' : sel ? '#fee761' : '#e8eef7';
      const bob = sel ? Math.round(Math.sin(this.t * 6) * 1) : 0;
      text(it.label, this.x, y, col, { align: 'center', outline });
      if (sel) {
        const w = textW(it.label);
        spr('cursorFish', Math.floor(this.t * 6) % 2, this.x - w / 2 - 14 + bob, y - 1, false);
        spr('cursorFish', Math.floor(this.t * 6) % 2, this.x + w / 2 + 4 - bob, y - 1, true);
      }
    }
  }
}

// Pause overlay shared by the gameplay scenes.
class PauseMenu {
  constructor(onQuit) {
    this.open = false;
    this.onQuit = onQuit;
    this.build();
  }
  build() {
    this.menu = new Menu([
      { label: 'RESUME', action: () => { this.open = false; } },
      { label: 'SOUND: ' + (Sound.muted ? 'OFF' : 'ON'), action: () => { Sound.toggleMute(); this.build(); this.menu.sel = 1; } },
      { label: 'FULLSCREEN', action: () => toggleFullscreen() },
      { label: 'SAVE & QUIT', action: () => { this.open = false; this.onQuit && this.onQuit(); } },
    ], { y: 72, gap: 13 });
  }
  toggle() {
    this.open = !this.open;
    if (this.open) { this.build(); Sound.sfx('ok'); }
  }
  update(dt) {
    if (hit('back') || keyHit('KeyP')) { this.open = false; Sound.sfx('back'); return; }
    this.menu.update(dt);
  }
  draw() {
    gfx.globalAlpha = 0.6;
    rect(0, 0, W, H, '#07060f');
    gfx.globalAlpha = 1;
    panel(92, 62, 136, 62, { fill: '#141330' });
    drawBig('PAUSED', W / 2, 32, 'aqua');
    this.menu.draw();
  }
}

// Small on-screen pause button for touch screens (no Esc key there).
function touchPauseButton(x, y) {
  if (!Input.touchSeen) return false;
  panel(x, y, 14, 14, { fill: '#141330', alpha: 0.85 });
  rect(x + 4, y + 4, 2, 6, '#ffffff');
  rect(x + 8, y + 4, 2, 6, '#ffffff');
  return false;
}
const touchPauseHit = (x, y) => Input.touchSeen && clicked(x - 2, y - 2, 18, 18);

// Fullscreen is optional: some browsers and embedded views refuse it.
function toggleFullscreen() {
  try {
    const p = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    if (p && p.catch) p.catch(() => {});
  } catch (e) { /* not supported */ }
}

/* ---------------------------------------------------- scene manager */
const Game = {
  scene: null,
  pending: null,
  trans: 0,
  transDir: 0,
  transSpeed: 2.2,
  transColor: '#07060f',
  time: 0,
  frame: 0,
  shakeT: 0,
  shakeAmt: 0,
  typing: false,
  set(scene) {
    if (this.scene && this.scene.exit) this.scene.exit();
    this.scene = scene;
    if (scene.enter) scene.enter();
  },
  go(next, opt = {}) {
    if (this.transDir === 1) return;
    this.pending = next;
    this.transDir = 1;
    this.transColor = opt.color || '#07060f';
    this.transSpeed = opt.speed || 2.2;
  },
  shake(amount, time) {
    if (REDUCED_MOTION) return;
    this.shakeAmt = Math.max(this.shakeAmt, amount);
    this.shakeT = Math.max(this.shakeT, time);
  },
  shakeOffset() {
    if (this.shakeT <= 0) return [0, 0];
    const a = Math.ceil(this.shakeAmt * Math.min(1, this.shakeT * 4));
    return [rndi(-a, a), rndi(-a, a)];
  },
  update(dt) {
    this.time += dt;
    this.frame++;
    if (this.shakeT > 0) { this.shakeT -= dt; if (this.shakeT <= 0) this.shakeAmt = 0; }
    if (this.transDir === 1) {
      this.trans += dt * this.transSpeed;
      if (this.trans >= 1) {
        this.trans = 1;
        const next = typeof this.pending === 'function' ? this.pending() : this.pending;
        this.pending = null;
        this.set(next);
        this.transDir = -1;
      }
    } else if (this.transDir === -1) {
      this.trans -= dt * this.transSpeed;
      if (this.trans <= 0) { this.trans = 0; this.transDir = 0; }
    }
    if (!this.typing) {
      if (hit('mute')) Sound.toggleMute();
      if (hit('full')) toggleFullscreen();
    }
    if (this.scene) this.scene.update(dt, this.transDir === 0);
    Sound.update();
  },
  draw() {
    gfx = ctx;
    ctx.globalAlpha = 1;
    if (this.scene) this.scene.draw();
    if (this.trans > 0) drawTransition(this.trans, this.transColor);
    if (Sound.toastT > 0) {
      const msg = Sound.muted ? 'SOUND OFF' : 'SOUND ON';
      panel(W - textW(msg) - 18, 4, textW(msg) + 14, 13, { fill: '#141330' });
      text(msg, W - 11, 8, '#ffffff', { align: 'right' });
    }
    if (mouseActive()) spr('cursor', 0, Math.floor(Input.mx), Math.floor(Input.my));
  },
};

// Dithered diagonal wipe. p: 0 = clear, 1 = fully covered.
function drawTransition(p, color) {
  const band = 8;
  for (let bx = 0; bx < W; bx += band) {
    const k = clamp(p * 1.7 - (bx / W) * 0.7, 0, 1);
    ditherRect(bx, 0, band, H, color, k);
  }
}

/* ---------------------------------------------- pre-rendered effects */
// Animated water-surface line, baked into a looping set of strips.
// The wave repeats every 144px and every 32 frames, so drawing it is one
// blit per frame instead of hundreds of single pixels.
const WAVE_PERIOD = 144, WAVE_FRAMES = 32;
function makeWaveStrips(width, above, below, line, line2) {
  const frames = [];
  for (let f = 0; f < WAVE_FRAMES; f++) {
    const c = makeCanvas(width + WAVE_PERIOD, 7), prev = setTarget(c.getContext('2d'));
    const p1 = (f / WAVE_FRAMES) * Math.PI * 2 * 2, p2 = (f / WAVE_FRAMES) * Math.PI * 2;
    for (let x = 0; x < c.width; x++) {
      const o = Math.round(Math.sin((x / WAVE_PERIOD) * Math.PI * 6 + p1) * 0.8 + Math.sin((x / WAVE_PERIOD) * Math.PI * 2 - p2) * 0.7);
      if (o > 0) rect(x, 3, 1, o, above);
      if (o < 0) rect(x, 3 + o, 1, -o, below);
      px(x, 3 + o, line);
      if (line2) px(x, 4 + o, line2);
    }
    setTarget(prev);
    frames.push(c);
  }
  return frames;
}
// Draws the strip so the waves stay fixed in the world while the camera pans.
function drawWaves(frames, worldX, y, t) {
  const f = frames[Math.floor(t * 6) % WAVE_FRAMES];
  const off = ((Math.round(worldX) % WAVE_PERIOD) + WAVE_PERIOD) % WAVE_PERIOD;
  gfx.drawImage(f, -off, Math.round(y) - 3);
}
// A soft, slanted shaft of light, baked once. slant = x shift per pixel down.
function makeRay(w0, len, slant, color, peak) {
  const span = Math.ceil(Math.abs(slant) * len);
  const c = makeCanvas(span + w0 * 2 + 4, len), g = c.getContext('2d');
  g.fillStyle = color;
  for (let y = 0; y < len; y += 2) {
    const k = y / len;
    g.globalAlpha = Math.round(peak * Math.pow(1 - k, 1.3) * 64) / 64;
    const x = (slant < 0 ? span : 0) + y * slant;
    g.fillRect(Math.round(x), y, Math.round(w0 * (1 + k * 0.9)), 2);
  }
  c.anchor = slant < 0 ? span : 0;
  return c;
}
