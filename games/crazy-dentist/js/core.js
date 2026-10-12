'use strict';
// ============================================================
//  CRAZY DENTIST — core: canvas, palette, pixel drawing,
//  bitmap font, input, UI buttons, particles, transitions
// ============================================================

const W = 320, H = 180;

// Endesga 32 palette, named for readability
const P = {
  rust: '#be4a2f', clay: '#d77643', cream: '#ead4aa', tan: '#e4a672',
  brown: '#b86f50', dbrown: '#733e39', ddbrown: '#3e2731', dred: '#a22633',
  red: '#e43b44', orange: '#f77622', gold: '#feae34', yellow: '#fee761',
  green: '#63c74d', dgreen: '#3e8948', ddgreen: '#265c42', teal: '#193c3e',
  blue: '#124e89', sky: '#0099db', cyan: '#2ce8f5', white: '#ffffff',
  lgray: '#c0cbdc', gray: '#8b9bb4', dgray: '#5a6988', slate: '#3a4466',
  navy: '#262b44', black: '#181425', hot: '#ff0044', plum: '#68386c',
  pink: '#b55088', salmon: '#f6757a', skin: '#e8b796', skin2: '#c28569',
};

const cv = document.getElementById('game');
cv.width = W; cv.height = H;
const ctx = cv.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = false;
let G = ctx; // current drawing target

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  c.g = g;
  return c;
}
function withCtx(g, fn) { const o = G; G = g; try { fn(); } finally { G = o; } }

// ---------- math helpers ----------
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const chance = (p) => Math.random() < p;
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const easeOutBounce = (t) => {
  const n1 = 7.5625, d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
};
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ---------- pixel primitives ----------
function rect(x, y, w, h, c) {
  G.fillStyle = c;
  G.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
function px(x, y, c) { G.fillStyle = c; G.fillRect(Math.round(x), Math.round(y), 1, 1); }
function orect(x, y, w, h, fill, ol = P.black) { rect(x - 1, y - 1, w + 2, h + 2, ol); rect(x, y, w, h, fill); }

function ellHW(rx, ry, dy) {
  const t = dy / (ry + 0.5);
  if (t * t > 1) return -1;
  return Math.round(rx * Math.sqrt(1 - t * t));
}
function ellipse(cx, cy, rx, ry, c) {
  if (rx <= 0 || ry <= 0) return;
  cx = Math.round(cx); cy = Math.round(cy);
  G.fillStyle = c;
  const r = Math.ceil(ry);
  for (let dy = -r; dy <= r; dy++) {
    const hw = ellHW(rx, ry, dy);
    if (hw < 0) continue;
    G.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1);
  }
}
const circle = (cx, cy, r, c) => ellipse(cx, cy, r, r, c);

// 2x2 checker patterns for dithering
const _pat = new Map();
function checker(c) {
  const key = c;
  if (!_pat.has(key)) {
    const t = makeCanvas(2, 2);
    t.g.fillStyle = c; t.g.fillRect(0, 0, 1, 1); t.g.fillRect(1, 1, 1, 1);
    _pat.set(key, t);
  }
  return G.createPattern(_pat.get(key), 'repeat');
}
function drect(x, y, w, h, c) { G.fillStyle = checker(c); G.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
function dellipse(cx, cy, rx, ry, c) {
  cx = Math.round(cx); cy = Math.round(cy);
  G.fillStyle = checker(c);
  const r = Math.ceil(ry);
  for (let dy = -r; dy <= r; dy++) {
    const hw = ellHW(rx, ry, dy);
    if (hw < 0) continue;
    G.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1);
  }
}

function line(x0, y0, x1, y1, c, th = 1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  G.fillStyle = c;
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, o = Math.floor(th / 2);
  for (let n = 0; n < 2000; n++) {
    G.fillRect(x0 - o, y0 - o, th, th);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

function tri(x0, y0, x1, y1, x2, y2, c) {
  G.fillStyle = c;
  const minY = Math.max(0, Math.ceil(Math.min(y0, y1, y2))), maxY = Math.min(G.canvas.height - 1, Math.floor(Math.max(y0, y1, y2)));
  const e = [[x0, y0, x1, y1], [x1, y1, x2, y2], [x2, y2, x0, y0]];
  for (let y = minY; y <= maxY; y++) {
    const yc = y + 0.5;
    let lo = Infinity, hi = -Infinity;
    for (const [ax, ay, bx, by] of e) {
      if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) {
        const x = ax + (yc - ay) / (by - ay) * (bx - ax);
        if (x < lo) lo = x; if (x > hi) hi = x;
      }
    }
    if (lo <= hi) G.fillRect(Math.round(lo), y, Math.max(1, Math.round(hi) - Math.round(lo)), 1);
  }
}

// String-art sprites: rows of chars, map char -> color, '.' = transparent
const _sprCache = new Map();
function spr(rows, x, y, flip = false, map = TOOTH_MAP) {
  const key = rows.join('/') + JSON.stringify(map);
  let c = _sprCache.get(key);
  if (!c) {
    c = makeCanvas(rows[0].length, rows.length);
    for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) {
      const col = map[rows[j][i]];
      if (col) { c.g.fillStyle = col; c.g.fillRect(i, j, 1, 1); }
    }
    _sprCache.set(key, c);
  }
  x = Math.round(x); y = Math.round(y);
  if (flip) { G.save(); G.translate(x + c.width, y); G.scale(-1, 1); G.drawImage(c, 0, 0); G.restore(); }
  else G.drawImage(c, x, y);
  return c;
}

// ---------- bitmap font (variable width, 5px tall) ----------
const FONT = {};
(function buildFont() {
  const d = {
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
    E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
    I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
    M: '10001|11011|10101|10001|10001', N: '1001|1101|1011|1001|1001', O: '0110|1001|1001|1001|0110',
    P: '110101110100100', Q: '0110|1001|1001|1011|0111', R: '110101110101101', S: '011100010001110',
    T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '10001|10001|10101|11011|10001',
    X: '101101010101101', Y: '101101010010010', Z: '111001010100111',
    0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
    4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010',
    8: '111101111101111', 9: '111101111001110',
    '!': '1|1|1|0|1', '?': '110001010000010', '.': '0|0|0|0|1', ',': '00|00|00|01|10',
    ':': '0|1|0|1|0', ';': '00|01|00|01|10', '-': '000000111000000', '+': '000010111010000',
    '$': '011110010011110', "'": '1|1|0|0|0', '"': '101101000000000', '/': '001001010100100',
    '(': '01|10|10|10|01', ')': '10|01|01|01|10', '%': '101001010100101', '*': '000101010101000',
    '=': '000111000111000', '<': '001010100010001', '>': '100010001010100', '#': '101111101111101',
    '&': '010101010101011', '_': '000000000000111', ' ': '00|00|00|00|00',
    '@': '01010|11111|11111|01110|00100', // heart
    '^': '00100|01110|11111|01110|01010', // star
    '~': '00000|01010|10101|00000|00000',
    '`': '00001|00011|10110|11100|01000', // check mark
  };
  for (const k in d) {
    const s = d[k];
    let rows;
    if (s.includes('|')) rows = s.split('|');
    else { const w = s.length / 5; rows = []; for (let r = 0; r < 5; r++) rows.push(s.substr(r * w, w)); }
    FONT[k] = { w: rows[0].length, rows };
  }
})();
const glyph = (ch) => FONT[ch] || FONT['?'];
function textW(s, sc = 1) {
  s = String(s).toUpperCase();
  let w = 0;
  for (const ch of s) w += (glyph(ch).w + 1) * sc;
  return Math.max(0, w - sc);
}
function _drawText(s, x, y, c, sc, fn, dy) {
  let cx = x, i = 0;
  G.fillStyle = c;
  for (const ch of s) {
    const g = glyph(ch), oy = dy ? Math.round(dy(i)) : 0;
    for (let r = 0; r < 5; r++) {
      const row = g.rows[r];
      for (let k = 0; k < g.w; k++) if (row.charCodeAt(k) === 49) {
        if (fn) G.fillStyle = fn(r, k, i);
        G.fillRect(cx + k * sc, y + oy + r * sc, sc, sc);
      }
    }
    cx += (g.w + 1) * sc; i++;
  }
}
// o: align 'c'|'r', ol: outline color, olw: outline width, sh: shadow color, fn: per-pixel color fn, dy: per-char y offset fn
function text(s, x, y, c, sc = 1, o = {}) {
  s = String(s).toUpperCase();
  const w = textW(s, sc);
  if (o.align === 'c') x -= Math.floor(w / 2); else if (o.align === 'r') x -= w;
  x = Math.round(x); y = Math.round(y);
  if (o.sh) _drawText(s, x, y + (o.shd || Math.max(1, sc >> 1) || 1), o.sh, sc, null, o.dy);
  if (o.ol) {
    const t = o.olw || 1;
    for (let ox = -t; ox <= t; ox += t) for (let oy = -t; oy <= t; oy += t)
      if (ox || oy) _drawText(s, x + ox, y + oy, o.ol, sc, null, o.dy);
  }
  _drawText(s, x, y, c, sc, o.fn, o.dy);
  return w;
}
function wrap(s, maxW, sc = 1) {
  const out = [];
  for (const para of String(s).toUpperCase().split('\n')) {
    let cur = '';
    for (const word of para.split(' ')) {
      const t = cur ? cur + ' ' + word : word;
      if (textW(t, sc) > maxW && cur) { out.push(cur); cur = word; } else cur = t;
    }
    out.push(cur);
  }
  return out;
}
function textBlock(s, x, y, maxW, c, sc = 1, o = {}) {
  const lines = wrap(s, maxW, sc), lh = o.lh || 7 * sc;
  lines.forEach((l, i) => text(l, x, y + i * lh, c, sc, o));
  return lines.length * lh;
}

// ---------- storage ----------
const Store = {
  get(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* storage unavailable */ } },
};
const settings = Object.assign({ music: true, sfx: true, shake: true, crt: true }, Store.get('cd_settings', {}));
const saveSettings = () => Store.set('cd_settings', settings);

// ---------- input ----------
const input = {
  x: -99, y: -99, px: -99, py: -99, down: false, pressed: false, released: false,
  keys: {}, hit: {}, touch: false, moved: false,
  inside(x, y, w, h) { return this.x >= x && this.x < x + w && this.y >= y && this.y < y + h; },
  key(k) { return !!this.hit[k]; },
  consume() { this.pressed = false; this.released = false; this.hit = {}; },
  endFrame() { this.pressed = false; this.released = false; this.hit = {}; this.px = this.x; this.py = this.y; this.moved = false; },
};
function _ptr(e) {
  const r = cv.getBoundingClientRect();
  input.x = (e.clientX - r.left) / r.width * W;
  input.y = (e.clientY - r.top) / r.height * H;
  input.moved = true;
}
cv.addEventListener('pointerdown', (e) => {
  input.touch = e.pointerType === 'touch';
  _ptr(e);
  if (!input.down) { input.px = input.x; input.py = input.y; }
  input.down = true; input.pressed = true;
  try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  e.preventDefault();
});
cv.addEventListener('pointermove', (e) => { input.touch = e.pointerType === 'touch'; _ptr(e); });
const _up = (e) => { _ptr(e); if (input.down) input.released = true; input.down = false; };
cv.addEventListener('pointerup', _up);
cv.addEventListener('pointercancel', _up);
cv.addEventListener('pointerleave', () => { if (!input.down && !input.touch) { input.x = -99; input.y = -99; } });
cv.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('keydown', (e) => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (!input.keys[k]) input.hit[k] = true;
  input.keys[k] = true;
  if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
});
window.addEventListener('keyup', (e) => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; input.keys[k] = false; });
window.addEventListener('blur', () => { input.keys = {}; input.down = false; });

// ---------- UI ----------
let cursor = 'arrow';
const UI = {
  hot: false,
  block: false,
  button(x, y, w, h, label, o = {}) {
    const dis = !!o.disabled;
    const over = !dis && !UI.block && input.inside(x, y, w, h);
    if (over) UI.hot = true;
    const isDown = over && input.down;
    const base = dis ? P.dgray : (o.color || P.sky);
    const light = dis ? P.dgray : (o.light || P.cyan);
    const dark = o.dark || (dis ? P.slate : P.blue);
    const sel = over || o.selected;
    const yo = isDown ? 1 : sel ? -1 : 0;
    rect(x, y + 1, w, h, P.black);
    rect(x, y + yo, w, h, P.black);
    rect(x + 1, y + yo + 1, w - 2, h - 2, sel ? light : base);
    rect(x + 1, y + yo + h - 3, w - 2, 2, dark);
    rect(x + 2, y + yo + 1, w - 4, 1, 'rgba(255,255,255,0.45)');
    const sc = o.sc || 1;
    text(label, x + w / 2, y + yo + Math.floor((h - 2 - 5 * sc) / 2), dis ? P.gray : (o.tc || P.white), sc, { align: 'c', sh: dis || o.tc ? null : P.black });
    if (over && input.pressed) { input.consume(); SND.sfx('click'); return true; }
    return false;
  },
  panel(x, y, w, h, fill = P.navy, ol = P.black, hi = P.slate) {
    rect(x, y, w, h, ol);
    rect(x + 1, y + 1, w - 2, h - 2, hi);
    rect(x + 2, y + 2, w - 4, h - 4, fill);
  },
};

// ---------- effects ----------
const FX = { parts: [], texts: [], shake: 0, flash: 0, flashC: '#fff', ox: 0, oy: 0 };
function burst(x, y, n, colors, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = o.ang != null ? o.ang + rand(-(o.spread || 3.2), o.spread || 3.2) / 2 : rand(0, Math.PI * 2);
    const s = rand(0.3, 1) * (o.spd || 60);
    const life = rand(0.4, 1) * (o.life || 0.7);
    FX.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (o.up || 0), g: o.g ?? 160, life, max: life, c: pick(colors), s: o.s || 1, star: !!o.star });
  }
}
function floatText(s, x, y, c, o = {}) {
  FX.texts.push({ s, x, y, c, t: 0, dur: o.dur || 1, sc: o.sc || 1, vy: o.vy ?? -18, ol: o.ol || P.black });
}
function addShake(a) { if (settings.shake) FX.shake = Math.max(FX.shake, a); }
function flash(c, a = 0.5) { FX.flash = a; FX.flashC = c; }
function clearFX() { FX.parts.length = 0; FX.texts.length = 0; }
function updateFX(dt) {
  for (const p of FX.parts) { p.life -= dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  FX.parts = FX.parts.filter((p) => p.life > 0);
  for (const t of FX.texts) { t.t += dt; t.y += t.vy * dt; t.vy *= 0.94; }
  FX.texts = FX.texts.filter((t) => t.t < t.dur);
  FX.shake = Math.max(0, FX.shake - dt * 18);
  FX.ox = FX.shake > 0.3 ? Math.round(rand(-FX.shake, FX.shake)) : 0;
  FX.oy = FX.shake > 0.3 ? Math.round(rand(-FX.shake, FX.shake)) : 0;
  FX.flash = Math.max(0, FX.flash - dt * 2.5);
}
function drawFX() {
  for (const p of FX.parts) {
    if (p.star) {
      rect(p.x - 1, p.y, 3, 1, p.c); rect(p.x, p.y - 1, 1, 3, p.c);
    } else rect(p.x, p.y, p.s, p.s, p.c);
  }
  for (const t of FX.texts) {
    const k = t.t / t.dur;
    if (k > 0.8 && Math.floor(t.t * 20) % 2) continue;
    const pop = t.t < 0.12 ? 1 : 0;
    text(t.s, t.x, t.y - pop, t.c, t.sc, { align: 'c', ol: t.ol, olw: 1 });
  }
}

// ---------- pixelated transitions ----------
const _tmp = makeCanvas(W, H);
function pixelate(b) {
  const sw = Math.ceil(W / b), sh = Math.ceil(H / b);
  _tmp.g.clearRect(0, 0, W, H);
  _tmp.g.drawImage(cv, 0, 0, W, H, 0, 0, sw, sh);
  ctx.drawImage(_tmp, 0, 0, sw, sh, 0, 0, sw * b, sh * b);
}
const Trans = {
  phase: 0, t: 0, dur: 0.22, next: null,
  go(fn, dur = 0.22) { if (this.phase === 1) return; this.phase = 1; this.t = 0; this.dur = dur; this.next = fn; },
  busy() { return this.phase !== 0; },
  update(dt) {
    if (!this.phase) return;
    this.t += dt;
    if (this.t >= this.dur) {
      if (this.phase === 1) { const f = this.next; this.next = null; this.phase = 2; this.t = 0; if (f) f(); input.consume(); }
      else this.phase = 0;
    }
  },
  apply() {
    if (!this.phase) return;
    const k = clamp(this.phase === 1 ? this.t / this.dur : 1 - this.t / this.dur, 0, 1);
    const b = Math.max(1, Math.round(1 + k * k * 15));
    if (b > 1) pixelate(b);
    ctx.fillStyle = `rgba(24,20,37,${(k * 0.7).toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
  },
};
