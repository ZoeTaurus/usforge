'use strict';
const W = 320, H = 180;
let ctx = null;
const fl = Math.floor;
const OUT = '#1a1020';

function R(x, y, w, h, c) { if (c) ctx.fillStyle = c; ctx.fillRect(fl(x), fl(y), fl(w), fl(h)); }
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function withCtx(canvas, fn) { const old = ctx; ctx = canvas.getContext('2d'); fn(); ctx = old; }
function circ(cx, cy, r, c) {
  ctx.fillStyle = c; cx = fl(cx); cy = fl(cy);
  for (let dy = -r; dy <= r; dy++) { const dx = fl(Math.sqrt(r * r - dy * dy) + 0.35); ctx.fillRect(cx - dx, cy + dy, dx * 2 + 1, 1); }
}
// Checkerboard-dithered disc, used for soft pixel glows.
function ditherCirc(cx, cy, r, c, ph = 0) {
  ctx.fillStyle = c; cx = fl(cx); cy = fl(cy);
  for (let dy = -r; dy <= r; dy++) {
    const dx = fl(Math.sqrt(r * r - dy * dy));
    for (let x = -dx; x <= dx; x++) if (((x + dy + ph) & 1) === 0) ctx.fillRect(cx + x, cy + dy, 1, 1);
  }
}
function dith(x, y, w, h, c, ph = 0) {
  ctx.fillStyle = c; x = fl(x); y = fl(y);
  for (let j = 0; j < h; j++) for (let i = (j + ph) & 1; i < w; i += 2) ctx.fillRect(x + i, y + j, 1, 1);
}
// Rounded (corner-cut) panel with a 1px border.
function panel(x, y, w, h, fill, border = OUT) {
  x = fl(x); y = fl(y);
  R(x + 1, y, w - 2, h, border); R(x, y + 1, w, h - 2, border);
  R(x + 1, y + 1, w - 2, h - 2, fill);
}
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

// Seeded RNG so prerendered scenery looks the same every time.
let _seed = 1;
function srand(s) { _seed = s >>> 0; }
function srnd() { _seed |= 0; _seed = _seed + 0x6D2B79F5 | 0; let t = Math.imul(_seed ^ _seed >>> 15, 1 | _seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[fl(Math.random() * a.length)];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = fl(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function hex2rgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function mixCol(a, b, t) { const A = hex2rgb(a), B = hex2rgb(b); return '#' + A.map((v, i) => Math.round(lerp(v, B[i], t)).toString(16).padStart(2, '0')).join(''); }
function inside(p, x, y, w, h) { return p.x >= x && p.x < x + w && p.y >= y && p.y < y + h; }

// ---------- ingredient icons (8x8, auto-outlined to 10x10) ----------
const ICON_ART = {
  ramen: ['........', '.yy..yy.', 'y..yy..y', '.YY..YY.', 'y..yy..y', '.yy..yy.', 'Y..YY..Y', '........'],
  udon: ['........', 'ws.ws.ws', 'ws.ws.ws', 'ws.ws.ws', 'ws.ws.ws', 'ws.ws.ws', 'ss.ss.ss', '........'],
  soba: ['........', '.b.b.b.b', '.b.B.b.B', '.B.b.B.b', '.b.b.b.b', '.b.B.b.B', '.B.b.B.b', '........'],
  drop: ['...oo...', '..oooo..', '..oooo..', '.ohoooo.', '.ohoooO.', '.oooooO.', '..oOOO..', '........'],
  fire: ['..f..f..', '..oooo..', '..oooo..', '.ohoooo.', '.ohoooO.', '.oooooO.', '..oOOO..', '........'],
  egg: ['..eeee..', '.eeeeee.', 'eeekkeee', 'eekKkkee', 'eekkkkee', 'eeekkeee', '.eeeeee.', '..eeee..'],
  pork: ['..pppp..', '.pPPPPp.', 'pPppppPp', 'pPpPPpPp', 'pPpPPpPp', 'pPppppPp', '.pPPPPp.', '..pppp..'],
  nori: ['.gggggg.', '.gGgggg.', '.ggggGg.', '.gggggg.', '.gGgggg.', '.ggggGg.', '.gggggg.', '........'],
};
const ICON_PAL = {
  y: '#f6d55c', Y: '#d1a325', w: '#fffaf0', s: '#d9c99e', b: '#a08a72', B: '#6f5c4a',
  e: '#ffffff', k: '#f7a21b', K: '#fff1a8', p: '#f6c1ab', P: '#b5543c', g: '#1f3b2a', G: '#4b8f62', f: '#ffd34d', h: '#ffffff',
};
const ING = {
  ramen: { name: 'RAMEN', cat: 'n', col: '#f6d55c' },
  udon: { name: 'UDON', cat: 'n', col: '#fffaf0' },
  soba: { name: 'SOBA', cat: 'n', col: '#a08a72' },
  shoyu: { name: 'SHOYU', cat: 'b', col: '#8a4a1c', lt: '#c07a43', dk: '#5a2c0c' },
  miso: { name: 'MISO', cat: 'b', col: '#e0a456', lt: '#f7d29a', dk: '#a8702e' },
  spicy: { name: 'SPICY', cat: 'b', col: '#e0392f', lt: '#ff8a7a', dk: '#9e1d16' },
  egg: { name: 'EGG', cat: 't' },
  pork: { name: 'PORK', cat: 't' },
  nori: { name: 'NORI', cat: 't' },
};
const BIN_ORDER = ['ramen', 'udon', 'soba', 'shoyu', 'miso', 'spicy', 'egg', 'pork', 'nori'];
const CATS = { n: ['ramen', 'udon', 'soba'], b: ['shoyu', 'miso', 'spicy'], t: ['egg', 'pork', 'nori'] };

const ICONS = {};
function buildIcons() {
  for (const k of BIN_ORDER) {
    let art = ICON_ART[k], pal = ICON_PAL;
    if (ING[k].cat === 'b') {
      art = k === 'spicy' ? ICON_ART.fire : ICON_ART.drop;
      pal = Object.assign({}, ICON_PAL, { o: ING[k].col, h: ING[k].lt, O: ING[k].dk });
    }
    const c = mkCanvas(10, 10), g = c.getContext('2d');
    const filled = (x, y) => x >= 0 && y >= 0 && x < 8 && y < 8 && art[y][x] !== '.';
    g.fillStyle = OUT;
    for (let y = -1; y < 9; y++) for (let x = -1; x < 9; x++) {
      if (filled(x, y)) continue;
      if (filled(x + 1, y) || filled(x - 1, y) || filled(x, y + 1) || filled(x, y - 1)) g.fillRect(x + 1, y + 1, 1, 1);
    }
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const ch = art[y][x]; if (ch === '.') continue;
      g.fillStyle = pal[ch]; g.fillRect(x + 1, y + 1, 1, 1);
    }
    ICONS[k] = c;
  }
}
function drawIcon(k, x, y) { ctx.drawImage(ICONS[k], fl(x), fl(y)); }

// ---------- bowls & pots ----------
// Bowl is 18x10, (x,y) = top-left.
function drawBowl(x, y, b) {
  x = fl(x); y = fl(y);
  R(x - 1, y + 2, 20, 6, OUT); R(x + 1, y + 8, 16, 2, OUT); R(x + 5, y + 9, 8, 2, OUT);
  // broth surface
  R(x + 1, y + 1, 16, 2, OUT);
  if (b && b.b) {
    R(x + 2, y + 1, 14, 2, ING[b.b].col); R(x + 3, y + 1, 3, 1, ING[b.b].lt);
  } else R(x + 2, y + 1, 14, 2, '#3a2a2a');
  if (b && b.n) { const c = ING[b.n].col; for (let i = 0; i < 4; i++) R(x + 3 + i * 3, y + 1 + (i & 1), 2, 1, c); }
  R(x, y + 3, 18, 1, '#ffffff');
  R(x, y + 4, 18, 3, '#efe8da'); R(x + 1, y + 5, 16, 1, '#c0392b'); R(x + 2, y + 7, 14, 1, '#d8cfbd');
  R(x + 6, y + 8, 6, 1, '#b9ae99');
  if (b && b.t) {
    if (b.t === 'egg') { R(x + 10, y - 2, 6, 4, OUT); R(x + 11, y - 1, 4, 2, '#fff'); R(x + 12, y - 1, 2, 2, '#f7a21b'); }
    if (b.t === 'pork') { R(x + 2, y - 2, 7, 4, OUT); R(x + 3, y - 1, 5, 2, '#f6c1ab'); R(x + 3, y - 1, 5, 1, '#b5543c'); }
    if (b.t === 'nori') { R(x + 12, y - 5, 5, 7, OUT); R(x + 13, y - 4, 3, 5, '#1f3b2a'); R(x + 14, y - 3, 1, 1, '#4b8f62'); }
  }
}

// ---------- characters ----------
// Characters are drawn from rectangles. "P" parts get a shared dark outline; "D" parts are details on top.
function flushParts(P, D) {
  ctx.fillStyle = OUT;
  for (const p of P) ctx.fillRect(p[0] - 1, p[1] - 1, p[2] + 2, p[3] + 2);
  for (const p of P) { ctx.fillStyle = p[4]; ctx.fillRect(p[0], p[1], p[2], p[3]); }
  for (const d of D) { ctx.fillStyle = d[4]; ctx.fillRect(d[0], d[1], d[2], d[3]); }
}

function charHeight(ch, frog) {
  if (frog) return 9;
  const L = ch.look;
  if (L.type === 'cat') return 15;
  if (L.type === 'pigeon') return 11;
  if (L.type === 'ghost') return 19;
  return (L.legH || 6) + (L.bodyH || 8) + 8;
}

// (x,y) = feet centre. o = {t, walk, dir, mood, dance, jump, staff, frog}
function drawChar(ch, x, y, o = {}) {
  x = fl(x); y = fl(y);
  if (o.frog) return drawFrog(x, y, o);
  const L = ch.look;
  if (L.type === 'cat') return drawCat(x, y, L, o);
  if (L.type === 'pigeon') return drawPigeon(x, y, L, o);
  if (L.type === 'ghost') return drawGhost(x, y, L, o);
  drawHuman(x, y, L, o);
}

function drawHuman(x, y, L, o) {
  const P = [], D = [];
  const p = (a, b, c, d, e) => P.push([a, b, c, d, e]);
  const q = (a, b, c, d, e) => D.push([a, b, c, d, e]);
  const t = o.t || 0, walk = !!o.walk, mood = o.mood || 'ok';
  const step = walk ? (fl(t * 8) & 1) : 0;
  let bob = walk ? step : (fl(t * 1.6) & 1);
  if (o.dance) bob = (fl(t * 6) & 1) ? 2 : 0;
  if (o.jump) bob += 2;
  const legH = L.legH || 6, bodyH = L.bodyH || 8, bw = L.bw || 10, legW = L.legW || 2;
  const half = bw >> 1;
  const by = y - legH - bodyH - bob, hy = by - 8;

  // skateboard
  if (has(L, 'skateboard') && walk) { p(x - 6, y, 12, 1, '#e67e22'); q(x - 5, y + 1, 2, 1, '#333'); q(x + 3, y + 1, 2, 1, '#333'); }
  // legs
  if (L.robe) {
    p(x - half, by + bodyH, bw, legH + bob - 1, L.shirt);
    q(x - 3, y - 1, 2, 1, L.shoe); q(x + 1, y - 1, 2, 1, L.shoe);
  } else {
    const l1 = walk && step ? 1 : 0, l2 = walk && !step ? 1 : 0;
    const lx = x - 1 - legW, rx = x + 1;
    p(lx, y - legH - bob, legW, legH + bob - l1, L.pants);
    p(rx, y - legH - bob, legW, legH + bob - l2, L.pants);
    q(lx, y - 1 - l1, legW, 1, L.shoe); q(rx, y - 1 - l2, legW, 1, L.shoe);
  }
  // arms
  const sl = L.sleeve || L.shirt, hand = L.hand || L.skin;
  if (o.dance) {
    const a = fl(t * 6) & 1;
    p(x - half - 2, by - 5 + a, 2, 6, sl); p(x + half, by - 5 + (1 - a), 2, 6, sl);
    q(x - half - 2, by - 5 + a, 2, 1, hand); q(x + half, by - 5 + (1 - a), 2, 1, hand);
  } else {
    const sw = walk ? (step ? 1 : -1) : 0;
    p(x - half - 2, by + 1 + sw, 2, bodyH - 2, sl); p(x + half, by + 1 - sw, 2, bodyH - 2, sl);
    q(x - half - 2, by + bodyH - 2 + sw, 2, 1, hand); q(x + half, by + bodyH - 2 - sw, 2, 1, hand);
  }
  // body & head
  p(x - half, by, bw, bodyH, L.shirt);
  p(x - 4, hy, 8, 8, L.skin);

  // hair / hats (outlined)
  const hc = L.hair;
  switch (L.hs) {
    case 'slick': p(x - 4, hy - 1, 8, 3, hc); p(x - 4, hy + 2, 1, 2, hc); p(x + 3, hy + 2, 1, 2, hc); q(x, hy - 1, 1, 2, L.skin); break;
    case 'short': p(x - 4, hy - 1, 8, 3, hc); p(x - 4, hy, 1, 4, hc); p(x + 3, hy, 1, 4, hc); break;
    case 'spiky': p(x - 4, hy - 1, 8, 3, hc); p(x - 3, hy - 3, 1, 2, hc); p(x - 1, hy - 4, 2, 3, hc); p(x + 2, hy - 3, 1, 2, hc); break;
    case 'long': p(x - 4, hy - 1, 8, 3, hc); p(x - 5, hy, 2, 10, hc); p(x + 3, hy, 2, 10, hc); break;
    case 'bun': p(x - 4, hy - 1, 8, 3, hc); p(x - 2, hy - 4, 4, 3, hc); p(x - 4, hy, 1, 3, hc); p(x + 3, hy, 1, 3, hc); break;
    case 'cap': p(x - 4, hy - 2, 8, 3, L.cap); p(x - 5, hy + 1, 10, 1, L.cap); q(x - 1, hy - 1, 2, 1, '#fff'); p(x - 4, hy + 2, 1, 2, hc); break;
    case 'beret': p(x - 5, hy - 2, 9, 3, L.hat); p(x - 1, hy - 3, 1, 1, L.hat); break;
    case 'helmet': p(x - 5, hy - 3, 10, 5, L.hat); q(x - 5, hy - 1, 10, 1, '#fff'); q(x - 1, hy - 3, 2, 2, '#fff'); break;
    case 'topknot': p(x - 4, hy - 1, 8, 2, hc); p(x - 1, hy - 4, 2, 3, hc); q(x - 2, hy - 2, 4, 1, '#fff'); break;
    case 'wizard':
      p(x - 6, hy, 12, 1, L.hat); p(x - 4, hy - 2, 8, 2, L.hat); p(x - 3, hy - 4, 6, 2, L.hat);
      p(x - 2, hy - 6, 4, 2, L.hat); p(x - 1, hy - 8, 3, 2, L.hat); p(x + 1, hy - 9, 2, 1, L.hat);
      q(x - 2, hy - 3, 1, 1, '#ffe066'); q(x + 1, hy - 5, 1, 1, '#ffe066'); q(x + 2, hy - 1, 1, 1, '#ffe066'); break;
    case 'pirate':
      p(x - 6, hy - 1, 12, 2, '#1a1a1a'); p(x - 4, hy - 4, 8, 3, '#1a1a1a'); q(x - 1, hy - 3, 2, 1, '#fff'); q(x - 6, hy, 12, 1, '#d4af37'); break;
    case 'antenna':
      p(x, hy - 4, 1, 4, '#8e9aaf'); q(x - 1, hy - 5, 3, 2, (fl(t * 3) & 1) ? '#ff4040' : '#ffb0b0'); break;
    case 'alien':
      p(x - 3, hy - 4, 1, 4, L.skin); p(x + 2, hy - 4, 1, 4, L.skin);
      q(x - 4, hy - 5, 2, 2, '#ffe066'); q(x + 2, hy - 5, 2, 2, '#ffe066'); break;
  }

  // accessories with outline
  if (has(L, 'briefcase')) { p(x + half + 1, by + bodyH - 2, 5, 4, '#6b4423'); q(x + half + 2, by + bodyH - 1, 3, 1, '#d4af37'); }
  if (has(L, 'napkins')) { p(x - half - 6, by + bodyH - 4, 4, 4, '#ffffff'); q(x - half - 5, by + bodyH - 3, 2, 1, '#d6d6d6'); }
  if (has(L, 'phone')) { p(x + half + 1, by + 1, 3, 5, '#222'); q(x + half + 2, by + 2, 1, 3, '#7fdbff'); }
  if (has(L, 'wand')) { p(x + half + 2, by - 3, 1, 8, '#7a4a2a'); q(x + half + 1, by - 5, 3, 1, '#ffe066'); q(x + half + 2, by - 6, 1, 3, '#ffe066'); }
  if (has(L, 'beard')) { p(x - 4, hy + 5, 8, 4, L.beard); p(x - 3, hy + 9, 6, L.robe ? 6 : 3, L.beard); }
  if (has(L, 'hook')) { q(x - half - 3, by + bodyH - 1, 1, 2, '#ccc'); q(x - half - 4, by + bodyH, 1, 1, '#ccc'); }

  // face
  const eye = L.eye || '#1a1020', mouth = has(L, 'redlips') ? '#e0392f' : '#7a2a2a';
  if (L.robotEyes) {
    q(x - 3, hy + 3, 2, 2, '#4ff'); q(x + 1, hy + 3, 2, 2, '#4ff');
    q(x - 2, hy + 6, 4, 1, mood === 'happy' ? '#4ff' : '#556070');
    if (mood === 'angry') { q(x - 3, hy + 3, 2, 2, '#f44'); q(x + 1, hy + 3, 2, 2, '#f44'); }
  } else if (L.alienEyes) {
    q(x - 3, hy + 2, 2, 4, '#111'); q(x + 1, hy + 2, 2, 4, '#111'); q(x - 3, hy + 2, 1, 1, '#fff'); q(x + 1, hy + 2, 1, 1, '#fff');
    if (mood === 'happy') q(x - 1, hy + 6, 2, 1, '#2d6a3e');
  } else {
    if (has(L, 'glasses')) { q(x - 3, hy + 2, 3, 3, '#cfe8ff'); q(x, hy + 2, 3, 3, '#cfe8ff'); q(x - 1, hy + 2, 2, 1, '#555'); }
    if (mood === 'happy') { q(x - 3, hy + 3, 2, 1, eye); q(x + 1, hy + 3, 2, 1, eye); }
    else if (L.smug) { q(x - 3, hy + 4, 2, 1, eye); q(x + 1, hy + 4, 2, 1, eye); }
    else { q(x - 2, hy + 3, 1, 2, eye); q(x + 1, hy + 3, 1, 2, eye); }
    if (mood === 'angry' || L.grumpy) { q(x - 3, hy + 1, 1, 1, eye); q(x - 2, hy + 2, 1, 1, eye); q(x + 2, hy + 1, 1, 1, eye); q(x + 1, hy + 2, 1, 1, eye); }
    if (mood === 'happy') { q(x - 2, hy + 5, 1, 1, mouth); q(x + 1, hy + 5, 1, 1, mouth); q(x - 1, hy + 6, 2, 1, mouth); }
    else if (mood === 'angry' || mood === 'sad' || L.grumpy) { q(x - 1, hy + 5, 2, 1, mouth); q(x - 2, hy + 6, 1, 1, mouth); q(x + 1, hy + 6, 1, 1, mouth); }
    else q(x - 1, hy + 6, 2, 1, mouth);
    if (mood === 'sad') q(x + 2, hy + 5, 1, 2, '#6ec6ff');
    if (!L.noBlush) { q(x - 3, hy + 5, 1, 1, mood === 'angry' ? '#e0392f' : '#f39a9a'); q(x + 2, hy + 5, 1, 1, mood === 'angry' ? '#e0392f' : '#f39a9a'); }
    if (has(L, 'monocle')) { q(x, hy + 2, 3, 1, '#f1c40f'); q(x, hy + 5, 3, 1, '#f1c40f'); q(x, hy + 3, 1, 2, '#f1c40f'); q(x + 2, hy + 3, 1, 2, '#f1c40f'); q(x + 2, hy + 6, 1, 3, '#f1c40f'); }
    if (has(L, 'mustache')) { q(x - 3, hy + 5, 6, 1, L.hair); q(x - 3, hy + 6, 1, 1, L.hair); q(x + 2, hy + 6, 1, 1, L.hair); }
    if (has(L, 'eyepatch')) { q(x - 4, hy + 2, 8, 1, '#111'); q(x + 1, hy + 2, 2, 3, '#111'); }
    if (has(L, 'sunglasses')) { q(x - 3, hy + 3, 3, 2, '#111'); q(x, hy + 3, 3, 2, '#111'); q(x - 3, hy + 3, 1, 1, '#9cf'); }
    if (has(L, 'freckles')) { q(x - 3, hy + 4, 1, 1, '#b5703a'); q(x + 2, hy + 4, 1, 1, '#b5703a'); }
  }
  // body details
  if (has(L, 'stripes')) for (let i = 1; i < bodyH; i += 2) q(x - half, by + i, bw, 1, L.stripe);
  if (has(L, 'collar')) q(x - 2, by, 4, 2, '#ffffff');
  if (has(L, 'tie')) { q(x - 1, by, 2, 1, L.tie); q(x - 1, by + 1, 2, 5, L.tie); }
  if (has(L, 'scarf')) { q(x - half, by, bw, 2, L.scarf); q(x + 1, by + 2, 2, 3, L.scarf); }
  if (has(L, 'apron')) { q(x - 3, by + 2, 6, bodyH - 2, '#ffffff'); q(x - 3, by + 2, 6, 1, '#f5b7c5'); }
  if (has(L, 'belt')) { q(x - half, by + bodyH - 3, bw, 3, L.belt); q(x - 1, by + bodyH - 3, 2, 3, '#4a6278'); }
  if (has(L, 'belly')) { q(x - 3, by + 2, 6, 3, '#f2c6a0'); q(x - 1, by + 4, 1, 1, '#c98f6a'); }
  if (has(L, 'bolts')) { q(x - half + 1, by + 1, 1, 1, '#556070'); q(x + half - 2, by + 1, 1, 1, '#556070'); q(x - 2, by + 3, 4, 2, '#4ff'); }
  if (has(L, 'zorpbelt')) { q(x - half, by + bodyH - 2, bw, 1, '#ffe066'); q(x - 1, by + 2, 2, 2, '#ff5ab4'); }
  if (has(L, 'bandaid')) q(x - 3, hy + 1, 2, 1, '#f5cba7');
  if (has(L, 'gloves')) { q(x - half - 2, by + bodyH - 3, 2, 2, '#fff'); q(x + half, by + bodyH - 3, 2, 2, '#fff'); }
  if (o.staff && L.apronStaff !== false && !has(L, 'apron') && !L.robe) q(x - 3, by + bodyH - 4, 6, 3, '#f3e3c3');
  flushParts(P, D);
}
function has(L, a) { return L.acc && L.acc.indexOf(a) >= 0; }

function drawCat(x, y, L, o) {
  const P = [], D = []; const p = (a, b, c, d, e) => P.push([a, b, c, d, e]); const q = (a, b, c, d, e) => D.push([a, b, c, d, e]);
  const t = o.t || 0, walk = !!o.walk, step = walk ? (fl(t * 8) & 1) : 0, c = L.col, dk = L.dark;
  let b = o.dance ? ((fl(t * 6) & 1) ? 2 : 0) : (o.jump ? 2 : 0);
  const wag = fl(t * 3) & 1;
  p(x - 4, y - 2, 2, 2 - (walk && step ? 1 : 0), c); p(x + 2, y - 2, 2, 2 - (walk && !step ? 1 : 0), c);
  p(x - 5, y - 7 - b, 10, 6, c);
  p(x + 5, y - 4 - b, 3, 2, c); p(x + 7, y - 8 - b + wag, 2, 5, c);
  p(x - 4, y - 13 - b, 8, 6, c);
  p(x - 4, y - 15 - b, 2, 2, c); p(x + 2, y - 15 - b, 2, 2, c);
  const hy = y - 13 - b;
  q(x - 3, hy - 1, 1, 1, '#ffb3c6'); q(x + 2, hy - 1, 1, 1, '#ffb3c6');
  q(x - 1, hy, 2, 1, dk); q(x - 5, y - 6 - b, 2, 1, dk); q(x - 5, y - 4 - b, 2, 1, dk); q(x + 7, y - 7 - b + wag, 2, 1, dk);
  if (o.mood === 'happy') { q(x - 3, hy + 2, 2, 1, OUT); q(x + 1, hy + 2, 2, 1, OUT); }
  else { q(x - 2, hy + 2, 1, 2, OUT); q(x + 1, hy + 2, 1, 2, OUT); }
  if (o.mood === 'angry') { q(x - 3, hy + 1, 2, 1, OUT); q(x + 1, hy + 1, 2, 1, OUT); }
  q(x - 1, hy + 4, 2, 1, '#ff8fa3');
  q(x - 7, hy + 3, 3, 1, '#fff'); q(x - 7, hy + 5, 3, 1, '#fff'); q(x + 4, hy + 3, 3, 1, '#fff'); q(x + 4, hy + 5, 3, 1, '#fff');
  q(x, hy + 1, 3, 1, '#f1c40f'); q(x, hy + 4, 3, 1, '#f1c40f'); q(x, hy + 2, 1, 2, '#f1c40f'); q(x + 2, hy + 2, 1, 2, '#f1c40f');
  q(x - 2, y - 7 - b, 4, 2, '#c0392b'); q(x - 1, y - 7 - b, 2, 2, '#8e1f14');
  flushParts(P, D);
}

function drawPigeon(x, y, L, o) {
  const P = [], D = []; const p = (a, b, c, d, e) => P.push([a, b, c, d, e]); const q = (a, b, c, d, e) => D.push([a, b, c, d, e]);
  const t = o.t || 0, walk = !!o.walk, step = walk ? (fl(t * 8) & 1) : 0;
  const dir = o.dir || 1;
  let b = o.dance ? ((fl(t * 6) & 1) ? 2 : 0) : (o.jump ? 2 : 0);
  const peck = walk ? step : ((fl(t * 1.3) % 3) === 0 ? 1 : 0);
  const pr = (a, yy, w, h, c) => p(dir > 0 ? x + a : x - a - w, yy, w, h, c);
  const dr = (a, yy, w, h, c) => q(dir > 0 ? x + a : x - a - w, yy, w, h, c);
  pr(-4, y - 7 - b, 8, 5, '#9aa5b8');
  pr(-7, y - 6 - b, 3, 2, '#7b8699');
  pr(1 + peck, y - 11 - b + peck, 4, 4, '#8592a8');
  dr(-1, y - 2, 1, 2, '#ff8fa3'); dr(1, y - 2, 1, 2 - (walk && step ? 1 : 0), '#ff8fa3');
  dr(1, y - 7 - b, 3, 1, '#57c4a0'); dr(1, y - 6 - b, 3, 1, '#a56cc1');
  dr(-3, y - 6 - b, 5, 2, '#77839a'); dr(-2, y - 5 - b, 1, 1, '#3b4252'); dr(0, y - 5 - b, 1, 1, '#3b4252');
  dr(5 + peck, y - 9 - b + peck, 2, 1, '#f5a623');
  dr(3 + peck, y - 10 - b + peck, 1, 1, o.mood === 'angry' ? '#ff2020' : '#ff6a1f');
  if (o.staff) { pr(1 + peck, y - 13 - b + peck, 4, 2, '#ffffff'); }
  flushParts(P, D);
}

function drawGhost(x, y, L, o) {
  const P = [], D = []; const p = (a, b, c, d, e) => P.push([a, b, c, d, e]); const q = (a, b, c, d, e) => D.push([a, b, c, d, e]);
  const t = o.t || 0, f = fl(Math.sin(t * 3) * 1.5) - 1 - (o.jump ? 2 : 0), wc = '#eef0ff';
  p(x - 5, y - 17 + f, 10, 14, wc); p(x - 4, y - 19 + f, 8, 2, wc);
  const ph = fl(t * 4) & 1;
  for (let i = 0; i < 5; i++) if ((i + ph) % 2 === 0) p(x - 5 + i * 2, y - 3 + f, 2, 2, wc);
  const arm = o.dance ? ((fl(t * 6) & 1) ? -3 : 0) : 0;
  p(x - 7, y - 12 + f + arm, 2, 3, wc); p(x + 5, y - 12 + f - arm, 2, 3, wc);
  if (o.staff) { p(x - 4, y - 22 + f, 8, 3, '#ffffff'); p(x - 5, y - 25 + f, 10, 3, '#ffffff'); }
  q(x - 5, y - 6 + f, 10, 1, '#cfd3f0');
  if (o.mood === 'happy') { q(x - 3, y - 13 + f, 2, 1, '#2a2a5a'); q(x + 1, y - 13 + f, 2, 1, '#2a2a5a'); }
  else { q(x - 3, y - 14 + f, 2, 3, '#2a2a5a'); q(x + 1, y - 14 + f, 2, 3, '#2a2a5a'); }
  q(x - 1, y - 9 + f, 2, 2, '#2a2a5a');
  q(x - 4, y - 10 + f, 1, 1, '#ffb3c6'); q(x + 3, y - 10 + f, 1, 1, '#ffb3c6');
  flushParts(P, D);
}

function drawFrog(x, y, o) {
  const P = [], D = []; const p = (a, b, c, d, e) => P.push([a, b, c, d, e]); const q = (a, b, c, d, e) => D.push([a, b, c, d, e]);
  const t = o.t || 0, hop = o.walk ? (fl(t * 6) & 1) * 2 : 0, g = '#5cb85c';
  p(x - 5, y - 6 - hop, 10, 6, g); p(x - 5, y - 9 - hop, 4, 3, g); p(x + 1, y - 9 - hop, 4, 3, g);
  q(x - 4, y - 9 - hop, 2, 2, '#fff'); q(x + 2, y - 9 - hop, 2, 2, '#fff');
  q(x - 3, y - 8 - hop, 1, 1, '#111'); q(x + 3, y - 8 - hop, 1, 1, '#111');
  q(x - 3, y - 4 - hop, 6, 1, '#2d6a27'); q(x - 3, y - 2 - hop, 6, 1, '#bfe6a0');
  q(x - 5, y - 1 - hop, 2, 1, '#3e8e3a'); q(x + 3, y - 1 - hop, 2, 1, '#3e8e3a');
  flushParts(P, D);
}

// Speech bubble with text, tail pointing down at (x, y). Returns nothing.
function speech(text, x, y, maxw = 60, fill = '#fffaf0', ink = '#2a1a2e') {
  const lines = wrap(text, maxw);
  const w = Math.max(...lines.map(l => tw(l))) + 6, h = lines.length * 6 + 4;
  let bx = fl(x - w / 2); bx = clamp(bx, 1, W - w - 1);
  const by = fl(y - h - 2);
  panel(bx, by, w, h, fill, ink);
  const tx = clamp(fl(x), bx + 2, bx + w - 4);
  R(tx - 1, by + h - 1, 3, 1, fill); R(tx - 2, by + h - 1, 1, 1, ink); R(tx + 2, by + h - 1, 1, 1, ink);
  R(tx, by + h, 1, 2, ink); R(tx - 1, by + h, 1, 1, ink); R(tx + 1, by + h, 1, 1, ink); R(tx, by + h, 1, 1, fill);
  lines.forEach((l, i) => txt(l, bx + 3, by + 3 + i * 6, ink));
}

function star(x, y, c = '#ffd34d') {
  x = fl(x); y = fl(y);
  R(x + 1, y - 1, 3, 7, OUT); R(x - 1, y + 1, 7, 3, OUT);
  R(x + 2, y, 1, 5, c); R(x, y + 2, 5, 1, c); R(x + 1, y + 1, 3, 3, c);
}
function heart(x, y, c = '#ff4d6d') {
  x = fl(x); y = fl(y);
  R(x, y, 2, 1, c); R(x + 3, y, 2, 1, c); R(x - 0, y + 1, 5, 2, c); R(x + 1, y + 3, 3, 1, c); R(x + 2, y + 4, 1, 1, c);
}
