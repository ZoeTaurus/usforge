'use strict';
// ============================================================
//  Engine: canvas, math, colors, pixel primitives, font,
//  input, particles, toasts, transitions, save data
// ============================================================

const W = 320, H = 180;
// the game is drawn in 320x180 "game pixels", but the canvas has 2x2 real
// pixels per game pixel so Chinese/Japanese text can be drawn crisply
const RES = 2;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
canvas.width = W * RES; canvas.height = H * RES;
ctx.imageSmoothingEnabled = false;
let G = ctx; // current draw target

function fitCanvas() {
  const m = Math.min(innerWidth / W, innerHeight / H);
  const s = m >= 1 ? Math.floor(m) : m;
  canvas.style.width = (W * s) + 'px';
  canvas.style.height = (H * s) + 'px';
}
addEventListener('resize', fitCanvas);
fitCanvas();

// ---------- math ----------
const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const randi = (a, b) => Math.floor(rand(a, b + 1));
const choice = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const easeOut = t => 1 - Math.pow(1 - t, 3);
function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

// ---------- colors ----------
const _rgb = {};
function hexToRgb(h) {
  let c = _rgb[h];
  if (c) return c;
  const n = parseInt(h.slice(1), 16);
  return (_rgb[h] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]);
}
function rgbHex(r, g, b) {
  return '#' + ((1 << 24) | (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)).toString(16).slice(1);
}
function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  t = clamp(t, 0, 1);
  return rgbHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
const darken = (c, t) => mix(c, '#000000', t);
const lighten = (c, t) => mix(c, '#ffffff', t);
function rgba(hex, a) { const c = hexToRgb(hex); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }

// ---------- pixel primitives ----------
function R(x, y, w, h, c) { G.fillStyle = c; G.fillRect(Math.round(x), Math.round(y), w, h); }
function P(x, y, c) { G.fillStyle = c; G.fillRect(Math.round(x), Math.round(y), 1, 1); }
function pline(x0, y0, x1, y1, c) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  G.fillStyle = c;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, n = 0;
  for (;;) {
    G.fillRect(x0, y0, 1, 1);
    if ((x0 === x1 && y0 === y1) || n++ > 800) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
function pcircle(cx, cy, r, c) {
  cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
  G.fillStyle = c;
  if (r < 1) { G.fillRect(cx, cy, 1, 1); return; }
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.floor(Math.sqrt(r * r - dy * dy) + 0.35);
    G.fillRect(cx - w, cy + dy, w * 2 + 1, 1);
  }
}
function pring(cx, cy, r, c) {
  cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
  G.fillStyle = c;
  if (r <= 0) { G.fillRect(cx, cy, 1, 1); return; }
  let x = r, y = 0, err = 1 - r;
  while (x >= y) {
    G.fillRect(cx + x, cy + y, 1, 1); G.fillRect(cx - x, cy + y, 1, 1);
    G.fillRect(cx + x, cy - y, 1, 1); G.fillRect(cx - x, cy - y, 1, 1);
    G.fillRect(cx + y, cy + x, 1, 1); G.fillRect(cx - y, cy + x, 1, 1);
    G.fillRect(cx + y, cy - x, 1, 1); G.fillRect(cx - y, cy - x, 1, 1);
    y++;
    if (err < 0) err += 2 * y + 1; else { x--; err += 2 * (y - x) + 1; }
  }
}
function pellipseRing(cx, cy, rx, ry, c) {
  G.fillStyle = c;
  const n = Math.max(8, Math.ceil((rx + ry) * 3));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    G.fillRect(Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), 1, 1);
  }
}
// additive stepped glow (keeps the pixel look)
function glow(x, y, r, c, a = 0.12) {
  const op = G.globalCompositeOperation, ga = G.globalAlpha;
  G.globalCompositeOperation = 'lighter';
  G.globalAlpha = ga * a;
  pcircle(x, y, r, c);
  pcircle(x, y, r * 0.68, c);
  pcircle(x, y, r * 0.4, c);
  G.globalCompositeOperation = op;
  G.globalAlpha = ga;
}
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').imageSmoothingEnabled = false;
  return c;
}
function withTarget(target, fn) { const p = G; G = target; try { fn(); } finally { G = p; } }
function blit(img, x, y, flip = false, scale = 1) {
  x = Math.round(x); y = Math.round(y);
  if (!flip) { G.drawImage(img, x, y, img.width * scale, img.height * scale); return; }
  G.save();
  G.translate(x + img.width * scale, y);
  G.scale(-1, 1);
  G.drawImage(img, 0, 0, img.width * scale, img.height * scale);
  G.restore();
}
function inRect(x, y, w, h) {
  const m = Input.mouse;
  return m.x >= x && m.x < x + w && m.y >= y && m.y < y + h;
}

// ---------- 3x5 pixel font ----------
const FONT = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
  E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
  I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
  Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111',
  0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
  4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010',
  8: '111101111101111', 9: '111101111001110',
  '.': '000000000000010', ',': '000000000010100', '!': '010010010000010', '?': '110001010000010',
  ':': '000010000010000', '-': '000000111000000', '+': '000010111010000', "'": '010010000000000',
  '/': '001001010100100', '(': '001010010010001', ')': '100010010010100', '%': '101001010100101',
  '<': '001010100010001', '>': '100010001010100', '*': '000101010101000', '=': '000111000111000',
  '~': '000011110000000', '"': '101101000000000', '#': '101111101111101', '_': '000000000000111',
  '$': '011110010011110', '[': '011010010010011', ']': '110010010010110', '@': '101111111010000',
};
// Cyrillic capitals (letters shaped like Latin ones reuse those glyphs)
Object.assign(FONT, {
  'А': FONT.A, 'В': FONT.B, 'Е': FONT.E, 'К': FONT.K, 'М': FONT.M, 'Н': FONT.H, 'О': FONT.O, 'Р': FONT.P, 'С': FONT.C, 'Т': FONT.T, 'Х': FONT.X,
  'Б': '111100110101110', 'Г': '111100100100100', 'Д': '011101101101111', 'Ж': '101111010111101', 'З': '110001010001110',
  'И': '101101111111101', 'Л': '001011101101101', 'П': '111101101101101', 'У': '101101011001110', 'Ф': '010111101111010',
  'Ц': '101101101101111', 'Ч': '101101111001001', 'Ш': '101101101111111', 'Щ': '101101101111111', 'Ъ': '110010011011011',
  'Ы': '101101111101111', 'Ь': '100100110101110', 'Э': '110001011001110', 'Ю': '101111111111101', 'Я': '011101011101101',
  '¡': '010000010010010', '¿': '010000010100011',
});
// letters with a little tail below the line
const DESC = { 'Д': [[0, 5], [2, 5]], 'Ц': [[2, 5]], 'Щ': [[2, 5]] };
// accent marks drawn above (or below) a letter: [dx, dy] pixels
const MARKS = {
  0x0301: [[1, -2], [2, -3]],          // acute
  0x0300: [[0, -3], [1, -2]],          // grave
  0x0302: [[0, -2], [1, -3], [2, -2]], // circumflex
  0x0303: [[0, -2], [1, -3], [2, -3]], // tilde
  0x0308: [[0, -2], [2, -2]],          // diaeresis
  0x0306: [[0, -3], [1, -2], [2, -3]], // breve
  0x0327: [[1, 5], [0, 6]],            // cedilla
  0x030a: [[1, -3]],                   // ring
};
// split a string into letters + their accent marks
const _cells = new Map();
function textCells(s) {
  let c = _cells.get(s);
  if (c) return c;
  c = [];
  for (const ch0 of s) {
    // Chinese/Japanese characters stay whole (so ブ keeps its marks)
    if (isWide(ch0.codePointAt(0))) { c.push({ ch: ch0, m: [], w: 6 }); continue; }
    for (const ch of ch0.normalize('NFD')) {
      const cp = ch.codePointAt(0);
      if (cp >= 0x0300 && cp <= 0x036f) { if (c.length && MARKS[cp]) c[c.length - 1].m.push(MARKS[cp]); continue; }
      c.push({ ch, m: [], w: 4 });
    }
  }
  if (_cells.size > 4000) _cells.clear();
  _cells.set(s, c);
  return c;
}
// ---------- Chinese / Japanese characters ----------
// drawn with the system (or web) font at 12 real pixels, then snapped to
// hard pixels so they match the pixel-art look
function isWide(cp) { return cp >= 0x2e80 && !(cp >= 0xff61 && cp <= 0xff9f); }
const WIDE_FONTS = {
  zh: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", "WenQuanYi Zen Hei", sans-serif',
  ja: '"Noto Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", "IPAGothic", sans-serif',
};
const _wideMask = new Map(), _wideGlyph = new Map();
function wideFont() { return typeof LANG !== 'undefined' && LANGS[LANG].id === 'ja' ? WIDE_FONTS.ja : WIDE_FONTS.zh; }
function wideGlyph(ch, color) {
  const font = wideFont(), k = ch + '|' + color + '|' + font;
  let g = _wideGlyph.get(k);
  if (g) return g;
  let mask = _wideMask.get(ch + '|' + font);
  if (!mask) {
    const c = makeCanvas(12, 14), x = c.getContext('2d');
    x.font = '500 12px ' + font;
    x.textBaseline = 'alphabetic';
    x.fillStyle = '#000';
    x.fillText(ch, 0, 11);
    const d = x.getImageData(0, 0, 12, 14).data;
    mask = new Uint8Array(12 * 14);
    for (let i = 0; i < mask.length; i++) mask[i] = d[i * 4 + 3] >= 96 ? 1 : 0;
    _wideMask.set(ch + '|' + font, mask);
  }
  g = makeCanvas(12, 14);
  const x = g.getContext('2d');
  x.fillStyle = color;
  for (let i = 0; i < mask.length; i++) if (mask[i]) x.fillRect(i % 12, (i / 12) | 0, 1, 1);
  if (_wideGlyph.size > 6000) _wideGlyph.clear();
  _wideGlyph.set(k, g);
  return g;
}
// web fonts arrive late: re-draw glyphs once they have loaded
function loadWideFonts(text) {
  if (!document.fonts || !document.fonts.load) return;
  const fam = LANGS[LANG].id === 'ja' ? 'Noto Sans JP' : 'Noto Sans SC';
  document.fonts.load('500 12px "' + fam + '"', text || '钓魚')
    .then(() => { _wideMask.clear(); _wideGlyph.clear(); })
    .catch(() => { /* offline: the system font is used */ });
}
const _glyphs = {};
function glyph(ch, color) {
  const bits = FONT[ch];
  if (!bits) return null;
  const k = ch + color;
  let c = _glyphs[k];
  if (c) return c;
  c = makeCanvas(3, 5);
  const x = c.getContext('2d');
  x.fillStyle = color;
  for (let i = 0; i < 15; i++) if (bits[i] === '1') x.fillRect(i % 3, (i / 3) | 0, 1, 1);
  return (_glyphs[k] = c);
}
function cellsWidth(cells) { let w = 0; for (const c of cells) w += c.w; return w ? w - 1 : 0; }
function textWidth(s, sc = 1) { return cellsWidth(textCells(tr(String(s)).toUpperCase())) * sc; }
function rawText(s, x, y, c, sc) {
  const cells = textCells(s);
  let gx = x;
  for (let i = 0; i < cells.length; i++, gx += cells[i - 1].w * sc) {
    if (cells[i].w === 6) { G.drawImage(wideGlyph(cells[i].ch, c), gx, y - sc, 6 * sc, 7 * sc); continue; }
    const g = glyph(cells[i].ch, c);
    if (g) G.drawImage(g, gx, y, 3 * sc, 5 * sc);
    const d = DESC[cells[i].ch];
    if (d) { G.fillStyle = c; for (const [dx, dy] of d) G.fillRect(gx + dx * sc, y + dy * sc, sc, sc); }
    if (cells[i].m.length) { G.fillStyle = c; for (const mk of cells[i].m) for (const [dx, dy] of mk) G.fillRect(gx + dx * sc, y + dy * sc, sc, sc); }
  }
}
function drawText(s, x, y, color = '#ffffff', o = {}) {
  s = tr(String(s)).toUpperCase();
  const sc = o.scale || 1;
  const w = cellsWidth(textCells(s)) * sc;
  if (o.align === 'center') x -= Math.floor(w / 2);
  else if (o.align === 'right') x -= w;
  x = Math.round(x); y = Math.round(y);
  if (o.outline) {
    const d = o.ow || 1;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) rawText(s, x + dx * d, y + dy * d, o.outline, sc);
  }
  if (o.shadow) rawText(s, x + (o.sx || sc), y + (o.sy || sc), o.shadow, sc);
  rawText(s, x, y, color, sc);
  return w;
}
function wrapText(s, maxChars) {
  s = tr(String(s));
  if ([...s].some(ch => isWide(ch.codePointAt(0)))) {
    // Chinese/Japanese: break anywhere, by width
    const lines = [], maxW = maxChars * 4;
    let cur = '';
    for (const ch of s) {
      if (cur && cellsWidth(textCells((cur + ch).toUpperCase())) > maxW) { lines.push(cur.trim()); cur = ch.trim() ? ch : ''; }
      else cur += ch;
    }
    if (cur.trim()) lines.push(cur.trim());
    return lines;
  }
  const words = s.split(' '), lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars) { lines.push(cur); cur = w; }
    else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  return lines;
}

// cozy wooden panel with parchment inside
function panel(x, y, w, h, paper = '#f6e7c8') {
  x = Math.round(x); y = Math.round(y);
  R(x + 1, y, w - 2, h, '#2e1c12'); R(x, y + 1, w, h - 2, '#2e1c12');
  R(x + 1, y + 1, w - 2, h - 2, '#8a5a35');
  R(x + 2, y + 1, w - 4, 1, '#b07a4c');
  R(x + 1, y + h - 2, w - 2, 1, '#5e3b22');
  R(x + 3, y + 3, w - 6, h - 6, paper);
  R(x + 3, y + 3, w - 6, 1, lighten(paper, 0.4));
  for (const [nx, ny] of [[x + 2, y + 2], [x + w - 3, y + 2], [x + 2, y + h - 3], [x + w - 3, y + h - 3]]) P(nx, ny, '#e3c08a');
}
function bar(x, y, w, h, frac, fg, bg = '#2a1a22', border = '#1a0f14') {
  R(x - 1, y - 1, w + 2, h + 2, border);
  R(x, y, w, h, bg);
  const fw = Math.round(w * clamp(frac, 0, 1));
  if (fw > 0) { R(x, y, fw, h, fg); R(x, y, fw, 1, lighten(fg, 0.35)); }
}

// ---------- input ----------
const Input = {
  down: new Set(),
  pressed: new Set(),
  cdown: new Set(),     // physical key codes (tells left/right shift apart)
  cpressed: new Set(),
  touches: new Map(),   // every finger on the screen
  isTouch: false,
  mouse: { x: -99, y: -99, down: false, pressed: false, released: false, lastMove: -99, touch: false },
  key(...ks) { return ks.some(k => this.down.has(k)); },
  hit(...ks) { return ks.some(k => this.pressed.has(k)); },
  code(...cs) { return cs.some(c => this.cdown.has(c)); },
  chit(...cs) { return cs.some(c => this.cpressed.has(c)); },
  confirm() { return this.hit('space', 'enter', 'e'); },
  end() {
    this.pressed.clear(); this.cpressed.clear();
    this.mouse.pressed = false; this.mouse.released = false;
    for (const t of this.touches.values()) t.fresh = false;
  },
};
function normKey(e) { return e.key === ' ' ? 'space' : e.key.toLowerCase(); }
addEventListener('keydown', e => {
  const k = normKey(e);
  if (!Input.down.has(k)) Input.pressed.add(k);
  Input.down.add(k);
  if (!Input.cdown.has(e.code)) Input.cpressed.add(e.code);
  Input.cdown.add(e.code);
  if (['space', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'tab'].includes(k)) e.preventDefault();
  Sound.unlock();
});
addEventListener('keyup', e => { Input.down.delete(normKey(e)); Input.cdown.delete(e.code); });
addEventListener('blur', () => { Input.down.clear(); Input.cdown.clear(); Input.mouse.down = false; Input.touches.clear(); });
function setMouse(cx, cy) {
  const r = canvas.getBoundingClientRect();
  Input.mouse.x = ((cx - r.left) / r.width) * W;
  Input.mouse.y = ((cy - r.top) / r.height) * H;
  Input.mouse.lastMove = performance.now() / 1000;
}
canvas.addEventListener('mousedown', e => {
  setMouse(e.clientX, e.clientY);
  Input.mouse.down = true; Input.mouse.pressed = true; Input.mouse.touch = false;
  Sound.unlock();
});
addEventListener('mouseup', () => { if (Input.mouse.down) Input.mouse.released = true; Input.mouse.down = false; });
addEventListener('mousemove', e => setMouse(e.clientX, e.clientY));
canvas.addEventListener('contextmenu', e => e.preventDefault());
function touchPos(t) {
  const r = canvas.getBoundingClientRect();
  return [((t.clientX - r.left) / r.width) * W, ((t.clientY - r.top) / r.height) * H];
}
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  Input.isTouch = true;
  for (const t of e.changedTouches) {
    const [x, y] = touchPos(t);
    Input.touches.set(t.identifier, { x, y, sx: x, sy: y, fresh: true });
  }
  // the first finger also acts as the mouse
  if (!Input.mouse.down) {
    const t = e.changedTouches[0];
    setMouse(t.clientX, t.clientY);
    Input.mouse.down = true; Input.mouse.pressed = true; Input.mouse.touch = true; Input.mouse.tid = t.identifier;
  }
  Sound.unlock();
}, { passive: false });
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    const o = Input.touches.get(t.identifier);
    if (o) [o.x, o.y] = touchPos(t);
    if (t.identifier === Input.mouse.tid) setMouse(t.clientX, t.clientY);
  }
}, { passive: false });
function touchEnd(e) {
  e.preventDefault();
  for (const t of e.changedTouches) {
    Input.touches.delete(t.identifier);
    if (t.identifier === Input.mouse.tid) { Input.mouse.released = true; Input.mouse.down = false; Input.mouse.tid = null; }
  }
}
canvas.addEventListener('touchend', touchEnd, { passive: false });
canvas.addEventListener('touchcancel', touchEnd, { passive: false });

// ---------- particles ----------
class Particles {
  constructor() { this.list = []; }
  add(o) {
    const p = Object.assign({ x: 0, y: 0, vx: 0, vy: 0, life: 1, c: '#fff', s: 1, g: 0, drag: 0, type: 'px' }, o);
    p.max = p.life;
    this.list.push(p);
    return p;
  }
  burst(n, o, spread = 40) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(0.3, 1) * spread;
      this.add(Object.assign({}, o, { vx: (o.vx || 0) + Math.cos(a) * sp, vy: (o.vy || 0) + Math.sin(a) * sp, life: (o.life || 0.6) * rand(0.6, 1.2) }));
    }
  }
  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.life -= dt;
      if (p.life <= 0) { L.splice(i, 1); continue; }
      p.vy += p.g * dt;
      if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.wob) p.x += Math.sin(p.life * p.wob) * 0.25;
      if (p.grow) p.s += p.grow * dt;
      if (p.minY !== undefined && p.y < p.minY) p.life = 0;
    }
  }
  draw() {
    for (const p of this.list) {
      G.globalAlpha = p.noFade ? 1 : clamp((p.life / p.max) * 1.6, 0, 1) * (p.a || 1);
      if (p.type === 'bubble') { if (p.s < 1.5) R(p.x, p.y, 1, 1, p.c); else pring(p.x, p.y, p.s, p.c); }
      else if (p.type === 'puff') pcircle(p.x, p.y, p.s, p.c);
      else if (p.type === 'ring') pellipseRing(p.x, p.y, p.s, p.s * 0.35, p.c);
      else if (p.type === 'text') drawText(p.text, p.x, p.y, p.c, { align: 'center', shadow: '#1a0f14' });
      else R(p.x, p.y, Math.max(1, Math.round(p.s)), Math.max(1, Math.round(p.s)), p.c);
    }
    G.globalAlpha = 1;
  }
}

// ---------- floating messages ----------
const Toasts = {
  list: [],
  add(text, color = '#ffffff', time = 2.2, y = 58) {
    this.list = this.list.filter(t => t.y !== y);
    this.list.push({ text, color, t: time, max: time, y });
  },
  clear() { this.list = []; },
  update(dt) { for (const t of this.list) t.t -= dt; this.list = this.list.filter(t => t.t > 0); },
  draw() {
    const covered = Game.scene && Game.scene.overlay;
    for (const t of this.list) {
      if (covered && t.y === 150) continue;
      const k = 1 - t.t / t.max;
      G.globalAlpha = clamp(t.t * 3, 0, 1);
      const pop = k < 0.08 ? 1 : 0;
      drawText(t.text, W / 2, t.y - pop - Math.round(k * 4), t.color, { align: 'center', outline: '#1a0f14' });
    }
    G.globalAlpha = 1;
  },
};

// ---------- screen fx + pixel dissolve transitions ----------
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const Fx = {
  fade: 0, dir: 0, cb: null, speed: 2.4, shake: 0, flash: 0, flashColor: '#ffffff',
  transition(cb, speed = 2.4) {
    if (this.dir === 1) return;
    this.dir = 1; this.cb = cb; this.speed = speed;
  },
  busy() { return this.dir !== 0; },
  update(dt) {
    if (this.dir === 1) {
      this.fade += dt * this.speed;
      if (this.fade >= 1) { this.fade = 1; const cb = this.cb; this.cb = null; this.dir = -1; if (cb) cb(); }
    } else if (this.dir === -1) {
      this.fade -= dt * this.speed;
      if (this.fade <= 0) { this.fade = 0; this.dir = 0; }
    }
    this.shake = Math.max(0, this.shake - dt * 14);
    this.flash = Math.max(0, this.flash - dt * 3);
  },
  draw() {
    if (this.flash > 0) { G.globalAlpha = Math.min(1, this.flash); R(0, 0, W, H, this.flashColor); G.globalAlpha = 1; }
    if (this.fade <= 0) return;
    const th = this.fade * 17;
    G.fillStyle = '#0d0a14';
    for (let by = 0; by < H; by += 8) for (let bx = 0; bx < W; bx += 8) {
      const b = BAYER[((by >> 3) & 3) * 4 + ((bx >> 3) & 3)];
      if (b < th - 1) G.fillRect(bx, by, 8, 8);
      else if (b < th) G.fillRect(bx + 2, by + 2, 4, 4);
    }
  },
};

// ---------- save data ----------
const SAVE_KEY = 'reel-deep-save-v1';
function newSave() {
  return {
    coins: 0, rod: 0, caught: {}, bosses: [], bait: { shrimp: 0, glow: 0 }, baitSel: 'worm',
    airtank: 0, snack: 0, catches: 0, bigChance: 0.03, day: 1, dayTime: 0.3, started: false,
    won: false, tips: {},
    diff: 'cozy', cooler: [], wanted: null, wantedDay: 0, up: { reel: 0, line: 0, cooler: 0 },
    boat: false, spot: 'pier', charms: [false, false, false], hat: 'straw', hats: ['straw'],
    bobber: 'red', bobbers: ['red'], decor: [], quest: null, questsDone: 0,
    weather: { kind: 'clear', t: 90 }, rows: [], map: false,
  };
}
function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && typeof s === 'object') {
      const d = newSave();
      return Object.assign(d, s, { bait: Object.assign(d.bait, s.bait || {}), up: Object.assign(d.up, s.up || {}) });
    }
  } catch (e) { /* ignore */ }
  return null;
}
function writeSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(Game.save)); } catch (e) { /* ignore */ }
}
