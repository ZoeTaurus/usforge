'use strict';
// ============================================================
//  Art: every sprite is drawn procedurally, pixel by pixel
// ============================================================

const PAL = {
  skin: '#f1c27d', skinS: '#d49a5e', skinL: '#fbd9a8',
  shirt: '#6fa8dc', shirtS: '#4f86bb',
  vest: '#b8995a', vestS: '#8d7240',
  pants: '#4f5d75', pantsS: '#3a455a', boot: '#4a2f1d',
  hat: '#f2d27a', hatS: '#d6b057', hatD: '#a88434', band: '#c0392b',
  eye: '#2b1d14', mouth: '#9c4a2e', blush: '#ef9f86', belt: '#5a3b24', buckle: '#f0c850',
};
// player two: a friend in a green bucket hat and a red jacket
const P2_PAL = Object.assign({}, PAL, {
  id: 'p2', skin: '#c68a5a', skinS: '#a06a40', skinL: '#dca070',
  shirt: '#e0705a', shirtS: '#b8503a', vest: '#4a7a5a', vestS: '#335a40',
  pants: '#5a4a6a', pantsS: '#403450', hat: '#6ab04a', hatS: '#4a8a34', hatD: '#326624', band: '#f0e0a0',
});
function applyHat(id) {
  const h = HATS.find(x => x.id === id) || HATS[0];
  Object.assign(PAL, { hat: h.hat, hatS: h.hatS, hatD: h.hatD, band: h.band });
  _swim = {};
}

// ---------- the fisher (blocky figure + straw hat) ----------
function fisherHead(r, hy, o) {
  const C = o.pal || PAL;
  r(-3, hy, 6, 6, C.skin);
  r(-3, hy + 1, 1, 4, C.skinL);
  r(2, hy, 1, 6, C.skinS);
  if (o.hatOnFace) {
    // hat pulled down over the eyes for a nap
    r(-3, hy - 2, 6, 3, C.hat); r(-2, hy - 3, 4, 1, C.hat);
    r(1, hy - 2, 1, 1, C.hatS); r(-2, hy - 1, 1, 1, C.hatS); r(0, hy - 3, 1, 1, C.hatS);
    r(-3, hy + 1, 6, 1, C.band);
    r(-6, hy + 2, 12, 2, C.hatS); r(-6, hy + 2, 12, 1, C.hat);
    r(-6, hy + 3, 1, 1, C.hatD); r(5, hy + 3, 1, 1, C.hatD);
    r(0, hy + 5, 1, 1, C.mouth);
    return;
  }
  if (!o.blink) { r(0, hy + 2, 1, 1, C.eye); r(2, hy + 2, 1, 1, C.eye); }
  else { r(0, hy + 2, 1, 1, C.skinS); r(2, hy + 2, 1, 1, C.skinS); }
  r(-1, hy + 3, 1, 1, C.blush);
  if (o.mouthOpen) r(1, hy + 4, 1, 1, C.mouth); else r(0, hy + 4, 2, 1, C.mouth);
  if (o.noHat) return;
  const hh = hy - (o.hatLift || 0), hx = o.hatX || 0;
  r(-6 + hx, hh, 12, 1, C.hat); r(-6 + hx, hh, 1, 1, C.hatD); r(5 + hx, hh, 1, 1, C.hatD);
  r(-3 + hx, hh - 1, 6, 1, C.band);
  r(-3 + hx, hh - 3, 6, 2, C.hat); r(-2 + hx, hh - 4, 4, 1, C.hat);
  r(2 + hx, hh - 3, 1, 2, C.hatS); r(-1 + hx, hh - 3, 1, 1, C.hatS); r(0 + hx, hh - 4, 1, 1, C.hatS);
}

// (x,y) = bottom-center (feet / seat). Returns hand position when holding things.
function drawFisher(x, y, dir, pose, o = {}) {
  x = Math.round(x); y = Math.round(y);
  const C = o.pal || PAL;
  const r = (dx, dy, w, h, c) => { G.fillStyle = c; G.fillRect(dir > 0 ? x + dx : x - dx - w, y + dy, w, h); };
  let hand = null;
  if (pose === 'sleep' || pose === 'sit') {
    const b = o.breath ? 1 : 0;
    r(-2, -3, 12, 3, C.pants); r(-2, -1, 12, 1, C.pantsS); r(3, -3, 1, 2, C.pantsS);
    r(10, -6, 3, 6, C.boot); r(10, -6, 3, 1, '#6b4630'); r(12, -1, 1, 1, '#2e1d12');
    const ty = -11 - b;
    r(-4, ty, 8, 8 + b, C.shirt);
    r(-4, ty, 2, 7 + b, C.vest); r(2, ty, 2, 7 + b, C.vest);
    r(-4, -4, 8, 1, C.belt);
    r(-6, ty + 1, 2, 5, C.shirtS);
    r(-5, ty + 3, 9, 2, C.shirtS); r(3, ty + 3, 2, 1, C.skin); r(-6, ty + 4, 2, 1, C.skin);
    fisherHead(r, ty - 6, o);
    return null;
  }
  const b = o.bob || 0;
  const swim = pose === 'swim';
  const la = swim && o.legFrame ? -2 : 0, lb = swim && !o.legFrame ? -2 : 0;
  r(-4, -7 + la, 4, 7, C.pants); r(0, -7 + lb, 4, 7, C.pants);
  r(-1, -7 + la, 1, 5, C.pantsS);
  r(-4, -2 + la, 4, 2, C.boot); r(0, -2 + lb, 4, 2, C.boot);
  const ty = -15 + b;
  r(-4, ty, 8, 8, C.shirt);
  r(-4, ty, 2, 7, C.vest); r(2, ty, 2, 7, C.vest);
  r(-4, ty + 3, 2, 1, C.vestS); r(2, ty + 3, 2, 1, C.vestS);
  r(-4, ty + 7, 8, 1, C.belt); r(-1, ty + 7, 2, 1, C.buckle);
  const upBoth = swim || pose === 'cheer';
  if (upBoth) { r(-7, ty - 6, 3, 7, C.shirt); r(-7, ty - 6, 1, 7, C.shirtS); r(-7, ty - 8, 3, 2, C.skin); }
  else { r(-7, ty, 3, 6, C.shirt); r(-7, ty, 1, 6, C.shirtS); r(-7, ty + 6, 3, 2, C.skin); }
  if (pose === 'hold') {
    r(4, ty, 3, 3, C.shirt); r(6, ty + 1, 3, 3, C.shirtS); r(9, ty + 2, 2, 2, C.skin);
    hand = [dir > 0 ? x + 10 : x - 10, y + ty + 3];
  } else if (pose === 'cast' || upBoth) {
    r(4, ty - 6, 3, 7, C.shirt); r(6, ty - 6, 1, 7, C.shirtS); r(4, ty - 8, 3, 2, C.skin);
    hand = [dir > 0 ? x + 5 : x - 5, y + ty - 7];
  } else {
    r(4, ty, 3, 6, C.shirt); r(6, ty, 1, 6, C.shirtS); r(4, ty + 6, 3, 2, C.skin);
    hand = [dir > 0 ? x + 5 : x - 5, y + ty + 7];
  }
  fisherHead(r, ty - 6, o);
  return hand;
}

// swimming sprite: pre-rendered upright, then rotated by exact 90 degrees
let _swim = {};
function swimSprite(frame, white, pal = PAL) {
  const k = frame + (white ? 'w' : '') + (pal.id || 'p1');
  if (_swim[k]) return _swim[k];
  const c = makeCanvas(16, 34);
  const x = c.getContext('2d');
  withTarget(x, () => drawFisher(8, 33, 1, 'swim', { legFrame: frame, pal }));
  if (white) { x.globalCompositeOperation = 'source-atop'; x.fillStyle = '#ffffff'; x.fillRect(0, 0, 16, 34); }
  return (_swim[k] = c);
}
function drawSwimmer(x, y, dir, frame, white, angle = 0, pal = PAL) {
  const img = swimSprite(frame, white, pal);
  G.save();
  G.translate(Math.round(x), Math.round(y));
  if (dir < 0) G.scale(-1, 1);
  G.rotate(Math.PI / 2 + angle);
  G.drawImage(img, -8, -20);
  G.restore();
}

// ---------- rod + line ----------
function drawRod(hx, hy, ang, len, rod, bend = 0) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  let px = hx, py = hy;
  for (let i = -2; i <= len; i++) {
    const k = Math.max(0, i) / len;
    px = hx + ca * i; py = hy + sa * i + bend * k * k;
    P(px, py, i < 2 ? '#3a2618' : i > len - 3 ? rod.tip : rod.color);
  }
  R(hx + ca * 2 - 1, hy + sa * 2 + 1, 2, 2, '#9aa3ad');
  return [Math.round(px), Math.round(py)];
}
function drawLine(x0, y0, x1, y1, sag, c) {
  const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.2));
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2 + sag;
  G.fillStyle = c;
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, d = t * t;
    G.fillRect(Math.round(a * x0 + b * mx + d * x1), Math.round(a * y0 + b * my + d * y1), 1, 1);
  }
}

// ---------- procedural fish sprites ----------
function mkGrid(w, h) {
  return {
    w, h, c: new Array(w * h).fill(null), meta: {},
    set(x, y, col) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.c[y * this.w + x] = col; },
    get(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.c[y * this.w + x] : null; },
  };
}
const BOOT_MAP = ['..BBB....', '..BbB....', '..BbB....', '..BbB....', '..BbBBBB.', '.BbbbbbbB', '.BBBBBBBB', '.SSSSSSSS'];
const BOOT_COLS = { B: '#5a3a22', b: '#7a5234', S: '#2e1d12' };
const CHEST_MAP = ['.WWWWWWWWW.', 'WwwwwwwwwwW', 'WwwwwwwwwwW', 'GGGGGGGGGGG', 'WwwwwGwwwwW', 'WwwwGYGwwwW', 'WwwwwGwwwwW', 'WwwwwwwwwwW', 'GGGGGGGGGGG'];
const CHEST_COLS = { W: '#6b3f1f', w: '#9a6232', G: '#e0b040', Y: '#fff1a8' };
function gridMap(map, cols) {
  const g = mkGrid(map[0].length + 2, map.length + 2);
  map.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') g.set(x + 1, y + 1, cols[ch]); }));
  return g;
}

function gridFish(s, len, frame) {
  const sh = s.shape;
  const bill = sh === 'sword' ? Math.round(len * 0.26) : 0;
  const bodyLen = len - bill;
  const maxH = Math.max(1.5, (bodyLen * (s.hr || 0.45)) / 2);
  const finH = sh === 'shark' ? maxH * 1.3 : sh === 'sword' ? maxH * 1.7 : maxH * 0.55;
  const padT = Math.ceil(finH) + 2, padB = Math.ceil(maxH * 0.7) + 2;
  const w = len + 3, h = Math.ceil(maxH * 2) + padT + padB + 1;
  const g = mkGrid(w, h);
  const cy = padT + Math.ceil(maxH);
  const tailLen = sh === 'eel' ? 0 : Math.max(2, Math.round(bodyLen * 0.23));
  const bl = bodyLen - tailLen, x0 = 1;
  const expo = sh === 'shark' ? 0.75 : sh === 'sword' ? 0.7 : 0.55;
  const hAt = u => {
    if (sh === 'eel') return maxH * Math.min(1, 0.3 + u * 2.2) * (u > 0.86 ? Math.sqrt(Math.max(0.05, (1 - u) / 0.14)) : 1);
    return maxH * Math.pow(Math.sin(Math.PI * (0.1 + 0.88 * u)), expo);
  };
  const eelOff = u => (sh === 'eel' ? Math.round(Math.sin(u * 9 + frame * Math.PI) * maxH * 0.6 * (1 - u)) : 0);
  for (let i = 0; i < bl; i++) {
    const u = bl > 1 ? i / (bl - 1) : 0.5;
    const hh = Math.max(0.6, hAt(u)), oy = eelOff(u);
    const cx = x0 + tailLen + i;
    const t0 = Math.round(cy - hh + oy), t1 = Math.round(cy + hh + oy);
    for (let y = t0; y <= t1; y++) {
      const d = (y - cy - oy) / hh;
      let col = d < -0.3 ? s.top : d > 0.38 ? s.belly : s.body;
      if (s.pattern === 'vstripes') { for (const st of [0.3, 0.55, 0.78]) if (Math.abs(u - st) * bl < (len > 24 ? 1.1 : 0.6)) col = s.pc; }
      else if (s.pattern === 'hstripe' && Math.abs(d) < 0.2 && u < 0.88) col = s.pc;
      else if (s.pattern === 'spots' && hash(i * 7 + len, y * 3) < 0.16 && Math.abs(d) < 0.85 && u < 0.85) col = s.pc;
      else if (s.pattern === 'waves' && d < 0 && (i + Math.round(d * 4) + 40) % 4 === 0) col = s.pc;
      g.set(cx, y, col);
    }
    let fh = 0;
    if (sh === 'shark') { if (u > 0.36 && u < 0.58) { const k = (u - 0.36) / 0.22; fh = finH * (k < 0.75 ? k / 0.75 : (1 - k) / 0.25); } }
    else if (sh === 'sword') { if (u > 0.2 && u < 0.6) { const k = (u - 0.2) / 0.4; fh = finH * (k < 0.25 ? k / 0.25 : 1 - ((k - 0.25) / 0.75) * 0.8); } }
    else if (sh === 'eel') { if (u > 0.08 && u < 0.85) fh = 1; }
    else if (u > 0.28 && u < 0.62) fh = finH * Math.sin((Math.PI * (u - 0.28)) / 0.34);
    for (let k = 1; k <= Math.round(fh); k++) g.set(cx, t0 - k, s.fin);
    if (sh === 'eel' && u > 0.1 && u < 0.7) g.set(cx, t1 + 1, s.fin);
    if (sh === 'shark' && u > 0.3 && u < 0.38) { g.set(cx, t1 + 1, s.fin); if (u > 0.33) g.set(cx, t1 + 2, s.fin); }
    if (sh === 'shark' && (Math.abs(u - 0.72) < 0.008 || Math.abs(u - 0.75) < 0.008 || Math.abs(u - 0.78) < 0.008)) {
      for (let y = Math.round(cy - hh * 0.35); y <= Math.round(cy + hh * 0.2); y++) g.set(cx, y, darken(s.body, 0.3));
    }
  }
  // tail
  for (let j = 0; j < tailLen; j++) {
    const v = tailLen > 1 ? (tailLen - 1 - j) / (tailLen - 1) : 1;
    const th = Math.max(1, maxH * (0.3 + 0.95 * v));
    const shift = Math.round((frame ? 1 : 0) * v * maxH * 0.35);
    for (let y = Math.round(cy - th); y <= Math.round(cy + th); y++) {
      const d = (y - cy) / th;
      if (v > 0.5 && Math.abs(d) < (v - 0.5) * 1.3) continue;
      g.set(x0 + j, y + shift, s.fin);
    }
  }
  // pectoral fin
  if (len >= 12 && sh !== 'eel') {
    const i = Math.round(0.62 * (bl - 1)), cx = x0 + tailLen + i, py = Math.round(cy + hAt(0.62) * 0.25);
    g.set(cx, py, s.fin); g.set(cx - 1, py + 1, s.fin); g.set(cx - 2, py + 1, s.fin);
    if (len > 30) { g.set(cx - 3, py + 2, s.fin); g.set(cx - 1, py + 2, s.fin); g.set(cx - 2, py + 2, s.fin); }
  }
  // scars (Old Gnarly)
  if (s.scars) {
    for (const [su, sd] of [[0.45, -0.4], [0.58, -0.1], [0.36, 0.1]]) {
      const cx = x0 + tailLen + Math.round(su * (bl - 1)), sy = Math.round(cy + sd * maxH);
      for (let k = 0; k < 4; k++) g.set(cx + k, sy + k - 2, '#2b3a17');
      g.set(cx + 1, sy + 1, '#c9c98a');
    }
  }
  // eye
  const ue = sh === 'shark' ? 0.84 : sh === 'eel' ? 0.9 : 0.83;
  const ex = x0 + tailLen + Math.round(ue * (bl - 1)), ey = Math.round(cy - hAt(ue) * 0.35 + eelOff(ue));
  if (len >= 36) {
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) g.set(ex + dx, ey + dy, '#ffffff');
    const pc = s.eye || '#140c0c';
    g.set(ex, ey, pc); g.set(ex + 1, ey, pc); g.set(ex, ey + 1, pc); g.set(ex + 1, ey + 1, pc);
    if (s.angry) for (let k = -2; k <= 2; k++) g.set(ex + k, ey - 2 - (k < 0 ? 1 : 0) + (k > 1 ? 1 : 0), darken(s.top, 0.4));
  } else {
    g.set(ex, ey, '#111111');
    if (len >= 12) g.set(ex - 1, ey, '#ffffff');
  }
  // mouth
  const noseX = x0 + tailLen + bl - 1;
  if (sh === 'shark') {
    const my = Math.round(cy + maxH * 0.45);
    for (let k = 1; k < Math.round(bl * 0.14); k++) {
      g.set(noseX - k - 1, my + (k > 3 ? 1 : 0), '#3a1a1a');
      if (k % 2 === 0) g.set(noseX - k - 1, my + 1 + (k > 3 ? 1 : 0), '#ffffff');
    }
  } else if (len >= 36) {
    for (let k = 0; k < Math.round(bl * 0.1); k++) g.set(noseX - k, Math.round(cy + 1 + k * 0.3), darken(s.body, 0.55));
  } else if (len >= 14) g.set(noseX, cy + 1, darken(s.body, 0.5));
  // swordfish bill
  if (bill) {
    const by = Math.round(cy - hAt(1) * 0.2);
    for (let k = 0; k < bill; k++) {
      g.set(noseX + 1 + k, by, '#d7dde6');
      if (k < bill * 0.4) g.set(noseX + 1 + k, by + 1, '#9aa6b8');
    }
  }
  return g;
}

function gridPuffer(s, len, frame) {
  const r = Math.max(3, Math.round(len * 0.42));
  const w = len + 6, h = r * 2 + 7;
  const g = mkGrid(w, h);
  const cx = w - r - 3, cy = Math.floor(h / 2);
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    if (x * x + y * y > r * r + r * 0.6) continue;
    const d = y / r;
    let col = d < -0.3 ? s.top : d > 0.4 ? s.belly : s.body;
    if (hash(x + 20, y + 20) < 0.14 && d < 0.4) col = s.pc;
    g.set(cx + x, cy + y, col);
  }
  for (let a = 0; a < 16; a++) {
    const an = (a / 16) * Math.PI * 2;
    if (Math.cos(an) < -0.8) continue;
    g.set(cx + Math.cos(an) * (r + 1.5), cy + Math.sin(an) * (r + 1.5), s.fin);
  }
  const tx = cx - r - 1, sh = frame ? 1 : 0;
  for (let k = 0; k < 3; k++) for (let y = -k; y <= k; y++) g.set(tx - k, cy + y + sh, s.fin);
  const ex = cx + Math.round(r * 0.45), ey = cy - Math.round(r * 0.3);
  g.set(ex, ey, '#111111'); g.set(ex - 1, ey, '#ffffff');
  g.set(cx + r, cy + 1, '#8a4a2a');
  return g;
}

function gridSquid(s, len, frame) {
  const mh = Math.max(3, Math.round(len * 0.26));
  const w = len + 4, h = mh * 2 + 8;
  const g = mkGrid(w, h);
  const cy = Math.floor(h / 2);
  const ms = Math.round(len * 0.42) + 1, me = len + 1;
  for (let x = ms; x <= me; x++) {
    const u = (x - ms) / (me - ms);
    const hh = mh * (u < 0.55 ? 1 : 1 - ((u - 0.55) / 0.45) * 0.85);
    for (let y = Math.round(cy - hh); y <= Math.round(cy + hh); y++) {
      const d = (y - cy) / Math.max(1, hh);
      let col = d < -0.3 ? s.top : d > 0.4 ? s.belly : s.body;
      if (s.pc && hash(x * 3, y * 5 + len) < 0.12) col = s.pc;
      g.set(x, y, col);
    }
  }
  // side fins near the tip
  for (let k = 0; k < 3; k++) { g.set(me - 2 - k, cy - Math.round(mh * 0.5) - 1 - (2 - k), s.fin); g.set(me - 2 - k, cy + Math.round(mh * 0.5) + 1 + (2 - k), s.fin); }
  // tentacles
  const rows = [-Math.round(mh * 0.7), -Math.round(mh * 0.25), Math.round(mh * 0.25), Math.round(mh * 0.7)];
  rows.forEach((ry, k) => {
    const L = Math.round((ms - 1) * (k % 2 ? 0.85 : 1));
    for (let x = ms - 1; x >= ms - L; x--) {
      const off = Math.round(Math.sin(x * 0.7 + frame * Math.PI + k) * (x < ms - 3 ? 1 : 0));
      g.set(x, cy + ry + off, k % 2 ? s.body : s.top);
    }
  });
  const ex = ms + 1, ey = cy - 1;
  g.set(ex, ey, '#111111'); g.set(ex + 1, ey, '#ffffff');
  if (len > 30) { g.set(ex, ey - 1, '#ffe14a'); g.set(ex + 1, ey - 1, '#ffe14a'); g.set(ex, ey, '#1a0a0a'); g.set(ex + 1, ey, '#ffe14a'); }
  return g;
}

function gridAngler(s, len, frame) {
  const rx = Math.round(len * 0.36), ry = Math.round(len * 0.33);
  const w = len + 8, top = Math.round(len * 0.36) + 3;
  const h = ry * 2 + top + 4;
  const g = mkGrid(w, h);
  const cx = Math.round(len * 0.55) + 2, cy = h - ry - 3;
  const mY = Math.round(ry * 0.2);
  for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx + 2; x++) {
    const nx = x / (rx + (x > 0 ? 2 : 0)), ny = y / ry;
    if (nx * nx + ny * ny > 1.02) continue;
    const d = ny;
    let col = d < -0.35 ? s.top : d > 0.45 ? s.belly : s.body;
    if (hash(x + 40, y + 40) < 0.07) col = darken(s.body, 0.25);
    const inMouth = x > rx * 0.25 && Math.abs(y - mY) < (x - rx * 0.25) * 0.5;
    if (inMouth) {
      const edge = Math.abs(y - mY) >= (x - rx * 0.25) * 0.5 - 1.2;
      col = edge && (x + y) % 2 === 0 ? '#f4f0e0' : '#1a0a14';
    }
    g.set(cx + x, cy + y, col);
  }
  // tail
  const tx = cx - rx, sh = frame ? 1 : 0;
  for (let k = 1; k <= Math.round(len * 0.16); k++) {
    const th = Math.round(1 + k * 0.6);
    for (let y = -th; y <= th; y++) g.set(tx - k, cy + y + sh, s.fin);
  }
  // spiky dorsal
  for (let k = 0; k < 4; k++) g.set(cx - 4 - k * 3, cy - ry - 1 - (k % 2), s.fin);
  // eye
  const ex = cx + Math.round(rx * 0.2), ey = cy - Math.round(ry * 0.45);
  g.set(ex, ey, '#e8f09a'); g.set(ex + 1, ey, '#e8f09a'); g.set(ex, ey + 1, '#e8f09a'); g.set(ex + 1, ey + 1, '#2a0a0a');
  // lure stalk
  const sx = cx - Math.round(rx * 0.1), sy = cy - ry;
  const lx = cx + rx + 3, ly = cy - ry - Math.round(len * 0.3);
  let px = sx, py = sy;
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    px = Math.round((1 - t) * (1 - t) * sx + 2 * (1 - t) * t * (sx + 2) + t * t * lx);
    py = Math.round((1 - t) * (1 - t) * sy + 2 * (1 - t) * t * (ly - 4) + t * t * ly);
    g.set(px, py, '#6a5a7a');
  }
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) g.set(lx + dx, ly + dy + 1, dx === 0 && dy === 0 ? '#ffffff' : '#fff6a0');
  g.meta.lure = [lx, ly + 1];
  return g;
}

function buildGrid(s, len, frame) {
  switch (s.shape) {
    case 'puffer': return gridPuffer(s, len, frame);
    case 'squid': return gridSquid(s, len, frame);
    case 'boot': return gridMap(BOOT_MAP, BOOT_COLS);
    case 'chest': return gridMap(CHEST_MAP, CHEST_COLS);
    case 'angler': return gridAngler(s, len, frame);
    case 'crab': return gridCrab(s, len, frame);
    case 'whale': return gridWhale(s, len, frame);
    case 'anchor': return gridMap(ANCHOR_MAP, ANCHOR_COLS);
    case 'coin': return gridMap(COIN_MAP, COIN_COLS);
    default: return gridFish(s, len, frame);
  }
}

// mode: 'c' colour, 's' shadow silhouette, 'w' white flash
const _spr = {};
function fishSprite(s, len, frame = 0, mode = 'c') {
  const key = s.id + '|' + len + '|' + frame + '|' + mode;
  let c = _spr[key];
  if (c) return c;
  const g = buildGrid(s, len, frame);
  const ol = s.outline || darken(s.top || '#333333', 0.55);
  const cells = g.c, w = g.w, h = g.h, out = cells.slice();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (cells[y * w + x]) continue;
    if ((x > 0 && cells[y * w + x - 1]) || (x < w - 1 && cells[y * w + x + 1]) || (y > 0 && cells[(y - 1) * w + x]) || (y < h - 1 && cells[(y + 1) * w + x])) out[y * w + x] = ol;
  }
  c = makeCanvas(w, h);
  const x2 = c.getContext('2d');
  for (let i = 0; i < out.length; i++) {
    if (!out[i]) continue;
    x2.fillStyle = mode === 's' ? '#04101f' : mode === 'w' ? '#ffffff' : out[i];
    x2.fillRect(i % w, (i / w) | 0, 1, 1);
  }
  c.meta = g.meta;
  return (_spr[key] = c);
}
// draw a fish centered at (x,y); dir = 1 faces right
function drawFish(s, len, x, y, dir, frame = 0, mode = 'c', scale = 1) {
  const img = fishSprite(s, len, frame, mode);
  blit(img, x - (img.width * scale) / 2, y - (img.height * scale) / 2, dir < 0, scale);
  return img;
}

// ---------- the Kraken (drawn live, it wiggles) ----------
function drawKraken(x, y, t, o = {}) {
  const sc = o.scale || 1;
  const body = o.white ? '#ffffff' : '#a3375a', dark = o.white ? '#ffffff' : '#6b1f3d', light = o.white ? '#ffffff' : '#d9577e', suck = o.white ? '#ffffff' : '#f2b4c4';
  // idle tentacles
  const n = 6;
  for (let k = 0; k < n; k++) {
    const baseA = Math.PI * 0.55 + (k / (n - 1)) * Math.PI * 0.75;
    let px = x + Math.cos(baseA) * 14 * sc, py = y + 12 * sc;
    for (let i = 0; i < 14; i++) {
      const a = baseA + Math.sin(t * 2 + k * 1.3 + i * 0.35) * 0.35 + i * 0.03;
      px += Math.cos(a) * 3.2 * sc; py += Math.sin(a) * 3.2 * sc;
      const r = Math.max(1, (5 - i * 0.3) * sc);
      pcircle(px, py, r, i % 2 ? body : dark);
      if (sc >= 1 && i % 2 === 0 && r > 2) P(px, py + r - 1, suck);
    }
  }
  // head
  pcircle(x, y + 2 * sc, 25 * sc, dark);
  pcircle(x, y, 24 * sc, body);
  pcircle(x - 7 * sc, y - 9 * sc, 9 * sc, light);
  pcircle(x - 9 * sc, y - 11 * sc, 3 * sc, lighten(light, 0.3));
  for (const [sx, sy] of [[8, -12], [14, -2], [-14, 4], [4, 6], [16, 10]]) pcircle(x + sx * sc, y + sy * sc, 2 * sc, dark);
  if (o.white) return;
  // eyes
  for (const ex of [-9, 7]) {
    pcircle(x + ex * sc, y + 8 * sc, 5 * sc, '#ffe14a');
    R(x + (ex - 4) * sc, y + 7 * sc, 9 * sc, 2 * sc, '#1a0a0a');
    R(x + (ex - 5) * sc, y + (2 - (o.angry ? 1 : 0)) * sc, 11 * sc, 2 * sc, dark);
  }
}

// ---------- icons ----------
function iconCoin(x, y) { R(x + 1, y, 3, 5, '#f5c542'); R(x, y + 1, 5, 3, '#f5c542'); R(x + 1, y + 1, 2, 2, '#ffe98a'); P(x + 3, y + 3, '#c98e12'); }
function iconHeart(x, y, full) {
  const c = full ? '#ff4d6d' : '#4a2a3a', hl = full ? '#ffc2cf' : '#6a3a4a';
  R(x + 1, y, 2, 1, c); R(x + 4, y, 2, 1, c); R(x, y + 1, 7, 2, c); R(x + 1, y + 3, 5, 1, c); R(x + 2, y + 4, 3, 1, c); P(x + 3, y + 5, c); P(x + 1, y + 1, hl);
}
function iconStar(x, y, c = '#ffd24a') { P(x + 2, y, c); R(x + 1, y + 1, 3, 1, c); R(x, y + 2, 5, 1, c); R(x + 1, y + 3, 3, 1, c); P(x + 1, y + 4, c); P(x + 3, y + 4, c); }
function iconBubble(x, y) { pring(x, y, 2, '#bfefff'); P(x - 1, y - 1, '#ffffff'); }
function iconRod(x, y, rod, big) {
  const L = big ? 14 : 8;
  pline(x, y + L, x + L, y, rod.color);
  P(x + L, y, rod.tip); P(x + L - 1, y + 1, rod.tip);
  R(x, y + L - 2, 2, 2, '#3a2618');
  R(x + 2, y + L - 3, 2, 2, '#9aa3ad');
  if (big) pline(x + L, y, x + L, y + 6, '#e8f4ff');
}
function iconSun(x, y) { pcircle(x, y, 2, '#ffd24a'); for (const [dx, dy] of [[0, -4], [0, 4], [-4, 0], [4, 0]]) P(x + dx, y + dy, '#ffd24a'); }
function iconMoon(x, y) { pcircle(x, y, 3, '#f4f1de'); pcircle(x + 2, y - 1, 2, '#2a2050'); }

// ---------- scenery props ----------
function drawBird(x, y, ph, s, c) {
  const wy = Math.round(-Math.sin(ph) * s * 0.7);
  const ey = Math.round(Math.min(0, -Math.sin(ph)) * s * 0.3) - 1;
  const h = s >> 1;
  pline(x - s, y + wy, x - h, y + ey, c); pline(x - h, y + ey, x, y, c);
  pline(x + s, y + wy, x + h, y + ey, c); pline(x + h, y + ey, x, y, c);
}
function makeCloud(x, y, w) {
  const parts = [], n = Math.max(3, Math.round(w / 7));
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1), r = Math.round(3 + Math.sin(k * Math.PI) * (w / 7));
    parts.push([Math.round(-w / 2 + k * w), -Math.round(r * 0.5), r]);
  }
  return { x, y, w, parts, vx: -rand(1.5, 4) };
}
function drawCloud(cl, col, shade) {
  for (const p of cl.parts) pcircle(cl.x + p[0], cl.y + p[1] + 2, p[2], shade);
  for (const p of cl.parts) pcircle(cl.x + p[0], cl.y + p[1], p[2], col);
  R(cl.x - cl.w / 2 - 2, cl.y + 1, cl.w + 4, 3, shade);
}
function drawPalm(bx, by, t, h = 78) {
  const topX = bx + 16, topY = by - h, segs = Math.round(h / 3);
  const sway = Math.sin(t * 0.9) * 1.2;
  for (let i = 0; i <= segs; i++) {
    const k = i / segs;
    const x = bx + (topX - bx) * k * k + sway * k * k, y = by - 3 - (by - 3 - topY) * k;
    const w = Math.round(lerp(6, 3, k));
    R(x - w / 2, y, w, 3, '#8a6038');
    R(x - w / 2, y, w, 1, '#6e4a2a');
    R(x + w / 2 - 1, y, 1, 3, '#6e4a2a');
  }
  const cx = topX + sway, cy = topY;
  const fronds = [-2.9, -2.35, -1.75, -1.1, -0.45, 0.1];
  fronds.forEach((a0, f) => {
    const a = a0 + Math.sin(t * 1.4 + f * 0.9) * 0.07 - 0.06;
    const L = 22 + (f % 2) * 5, droop = 12;
    for (let i = 0; i <= L; i++) {
      const k = i / L;
      const x = cx + Math.cos(a) * i, y = cy + Math.sin(a) * i + droop * k * k;
      P(x, y, '#2e6b30');
      if (i > 2) {
        const l = Math.round((1 - Math.abs(k - 0.45) * 1.6) * 4);
        for (let j = 1; j <= l; j++) P(x - Math.cos(a) * j * 0.5, y + j, j === 1 ? '#4caf50' : '#3d9142');
      }
    }
  });
  pcircle(cx - 2, cy + 3, 2, '#6b4423'); pcircle(cx + 2, cy + 4, 2, '#5a3a1e'); P(cx - 3, cy + 2, '#8a5a30');
}
function drawBarrel(x, y) {
  const top = y - 16;
  R(x + 1, top, 11, 16, '#8b5a2b'); R(x, top + 2, 13, 12, '#8b5a2b');
  for (let i = 3; i < 12; i += 3) R(x + i, top + 1, 1, 14, '#6f4520');
  R(x + 1, top + 2, 1, 12, '#a8743e');
  R(x, top + 3, 13, 1, '#4b4b52'); R(x, top + 12, 13, 1, '#4b4b52');
  R(x + 1, top, 11, 2, '#a8743e'); R(x + 2, top, 9, 1, '#c08a50');
}
function drawLantern(x, y, lit) {
  R(x + 1, y - 2, 3, 1, '#3a3a40'); P(x + 2, y - 3, '#3a3a40');
  R(x, y - 1, 5, 1, '#2a2a30'); R(x, y + 5, 5, 1, '#2a2a30');
  R(x, y, 5, 5, '#2a2a30');
  R(x + 1, y, 3, 5, lit ? '#ffd76a' : '#6a6a5a');
  if (lit) P(x + 2, y + 2, '#fff6c8');
}
function drawCampfire(x, y, t) {
  for (const [dx, c] of [[-8, '#7a7a86'], [-5, '#8e8e9a'], [3, '#7a7a86'], [6, '#8e8e9a']]) { R(x + dx, y - 2, 3, 2, c); P(x + dx, y - 2, '#a8a8b4'); }
  R(x - 5, y - 3, 10, 2, '#5b3a1f'); R(x - 3, y - 4, 6, 1, '#7a4f2a'); P(x - 5, y - 3, '#3a2210');
  const f = k => Math.sin(t * 12 + k * 1.7) + Math.sin(t * 7.3 + k * 3.1);
  for (let row = 0; row < 10; row++) {
    const wb = 4.6 - row * 0.5 + f(row) * 0.45;
    const lean = -Math.round(row * row * 0.035);
    const wx = Math.round(wb);
    if (wx <= 0) continue;
    const yy = y - 5 - row;
    R(x + lean - wx, yy, wx * 2, 1, row < 3 ? '#e8421c' : '#ff7b1c');
    if (wx > 1) R(x + lean - wx + 1, yy, wx * 2 - 2, 1, row < 5 ? '#ffa726' : '#ffd54a');
    if (wx > 2 && row < 5) R(x + lean - 1, yy, 2, 1, '#fff3b0');
  }
}
function drawBucket(x, y) {
  R(x, y - 7, 9, 7, '#6d8aa8'); R(x + 1, y - 1, 7, 1, '#4f6a86'); R(x, y - 5, 9, 1, '#4f6a86');
  R(x, y - 7, 9, 1, '#9ab4cc'); R(x + 1, y - 7, 1, 6, '#9ab4cc');
  pline(x, y - 7, x + 4, y - 11, '#8a8a92'); pline(x + 4, y - 11, x + 8, y - 7, '#8a8a92');
  P(x + 5, y - 9, '#f4a13c'); P(x + 4, y - 10, '#f4a13c'); P(x + 6, y - 10, '#f4a13c'); P(x + 5, y - 8, '#f4a13c');
}
function drawCat(x, y, t, awake) {
  const tail = Math.round(Math.sin(t * 2) * 1.2);
  R(x - 3, y - 2 + tail, 3, 1, '#e08a3a'); P(x - 3, y - 3 + tail, '#e08a3a');
  R(x, y - 4, 8, 4, '#f0a04b'); R(x, y - 1, 8, 1, '#d98a38');
  R(x + 2, y - 4, 1, 3, '#d98a38'); R(x + 4, y - 4, 1, 3, '#d98a38');
  R(x + 6, y - 7, 5, 4, '#f0a04b');
  P(x + 6, y - 8, '#f0a04b'); P(x + 10, y - 8, '#f0a04b');
  P(x + 7, y - 7, '#ffb0a0'); P(x + 9, y - 7, '#ffb0a0');
  if (awake) { P(x + 7, y - 6, '#2a4a1a'); P(x + 9, y - 6, '#2a4a1a'); }
  else { P(x + 7, y - 5, '#8a4a1a'); P(x + 9, y - 5, '#8a4a1a'); }
  P(x + 8, y - 4, '#ff8a8a');
}
function drawGrass(x, y, t, c = '#6aa84f') {
  for (let i = 0; i < 4; i++) {
    const hgt = 3 + ((i * 7) % 3);
    const sw = Math.round(Math.sin(t * 2.2 + x * 0.3 + i) * 0.8 - 0.5);
    for (let j = 0; j < hgt; j++) P(x + i * 2 - 3 + (j === hgt - 1 ? sw : 0), y - j - 1, j < 1 ? darken(c, 0.25) : c);
  }
}
function drawStall(x, y, t) {
  R(x + 2, y - 30, 2, 30, '#6b4428'); R(x + 36, y - 30, 2, 30, '#6b4428');
  R(x, y - 14, 40, 3, '#a8744a'); R(x, y - 14, 40, 1, '#c89060');
  R(x + 1, y - 11, 38, 11, '#8a5a35');
  for (let i = 0; i < 38; i += 6) R(x + 1 + i, y - 11, 1, 11, '#6b4428');
  for (let i = 0; i < 44; i += 4) {
    const c = (i / 4) % 2 ? '#fff4e0' : '#d8433a';
    R(x - 2 + i, y - 36, 4, 6, c);
    R(x - 2 + i + 1, y - 30, 2, 1, c);
  }
  R(x - 2, y - 37, 44, 1, '#8a2a24');
  const sw = Math.max(24, textWidth(tr('BAIT')) + 6);
  R(x + 20 - sw / 2, y - 45, sw, 8, '#8a5a35'); R(x + 20 - sw / 2, y - 45, sw, 1, '#b07a4c');
  R(x + 12, y - 38, 1, 1, '#6b4428'); R(x + 27, y - 38, 1, 1, '#6b4428');
  drawText('BAIT', x + 20, y - 43, '#fff1c8', { align: 'center' });
  R(x + 5, y - 18, 7, 4, '#5e7ea0'); R(x + 6, y - 19, 5, 1, '#8ab0d0');
  P(x + 7, y - 20, '#ff9a5a'); P(x + 9, y - 20, '#e0788a');
  drawCat(x + 22, y - 14, t, Math.sin(t * 0.7) > 0.93);
}

// ---------- extra shapes for the faraway spots ----------
const ANCHOR_MAP = ['...RR...', '..R..R..', '...RR...', '.RRRRRR.', '...RR...', '...RR...', 'R..RR..R', 'RR.RR.RR', '.RRRRRR.', '..RRRR..'];
const ANCHOR_COLS = { R: '#6a5a50' };
const COIN_MAP = ['.GGGGG.', 'GYYYYYG', 'GYGGGYG', 'GYGYYYG', 'GYGGGYG', 'GYYYGYG', 'GYGGGYG', 'GYYYYYG', '.GGGGG.'];
const COIN_COLS = { G: '#d8a020', Y: '#ffe07a' };

function gridCrab(s, len, frame) {
  const bw = Math.round(len * 0.32), bh = Math.round(len * 0.2);
  const w = len + 6, h = bh * 2 + Math.round(len * 0.5) + 6;
  const g = mkGrid(w, h);
  const cx = Math.floor(w / 2), cy = Math.round(h * 0.52);
  // legs
  for (let k = 0; k < 3; k++) for (const sd of [-1, 1]) {
    const lx = cx + sd * (bw - 2 - k * 3), ly = cy + bh - 2;
    const kick = frame && k === 1 ? 1 : 0;
    for (let j = 0; j < Math.round(len * 0.14); j++) g.set(lx + sd * (j + 1), ly + Math.min(j, 2) + (j > 2 ? j - 2 : 0) - kick, s.top);
  }
  // body
  for (let y = -bh; y <= bh; y++) for (let x = -bw; x <= bw; x++) {
    const nx = x / bw, ny = y / bh;
    if (nx * nx + ny * ny > 1) continue;
    let col = ny < -0.3 ? s.body : ny > 0.4 ? s.belly : s.body;
    if (ny < -0.5 && hash(x + 50, y + 50) < 0.2) col = lighten(s.body, 0.25);
    if (ny > -0.1 && ny < 0.2) col = darken(s.body, 0.12);
    g.set(cx + x, cy + y, col);
  }
  // eyes on stalks
  for (const sd of [-1, 1]) {
    const ex = cx + sd * Math.round(bw * 0.35);
    for (let j = 1; j <= Math.max(2, Math.round(len * 0.07)); j++) g.set(ex, cy - bh - j + 1, s.top);
    const ey = cy - bh - Math.max(2, Math.round(len * 0.07));
    g.set(ex, ey, '#111111'); g.set(ex + sd, ey, '#111111'); g.set(ex, ey - 1, '#ffffff');
  }
  // claws
  const open = frame ? 2 : 0;
  for (const sd of [-1, 1]) {
    const ax = cx + sd * bw, ay = cy - 1;
    const cl = Math.max(3, Math.round(len * 0.14)), cr = Math.max(2, Math.round(len * 0.1));
    for (let j = 1; j <= cl; j++) g.set(ax + sd * j, ay - Math.round(j * 0.7), s.top);
    const hx = ax + sd * (cl + cr), hy = ay - Math.round(cl * 0.7) - cr;
    for (let y = -cr; y <= cr; y++) for (let x = -cr; x <= cr; x++) if (x * x + y * y <= cr * cr + 1) g.set(hx + x, hy + y, s.body);
    for (let j = 0; j <= cr + 1; j++) { g.set(hx + sd * (cr - 1) + sd * Math.round(j * 0.3), hy - cr - j + 1 - open, s.fin); }
    for (let j = 0; j < cr; j++) g.set(hx + sd * j, hy - cr + 1, open ? null : s.fin);
  }
  return g;
}
function gridWhale(s, len, frame) {
  const maxH = Math.round(len * s.hr / 2);
  const w = len + 4, h = maxH * 2 + 14;
  const g = mkGrid(w, h);
  const cy = Math.round(h / 2) + 2;
  const tail = Math.round(len * 0.2), bl = len - tail, x0 = 1;
  for (let i = 0; i < bl; i++) {
    const u = i / (bl - 1);
    const hh = maxH * (u < 0.75 ? Math.pow(Math.sin(Math.PI * (0.08 + 0.6 * u / 0.75)), 0.5) : 1 - Math.pow((u - 0.75) / 0.25, 3) * 0.35);
    const cx = x0 + tail + i;
    for (let y = Math.round(cy - hh); y <= Math.round(cy + hh * 0.9); y++) {
      const d = (y - cy) / hh;
      let col = d < -0.25 ? s.top : d > 0.35 ? s.belly : s.body;
      if (d > 0.4 && u > 0.55 && (y % 2 === 0)) col = darken(s.belly, 0.12); // throat grooves
      g.set(cx, y, col);
    }
    if (u > 0.45 && u < 0.55) g.set(cx, Math.round(cy - hh) - 1, s.fin);
  }
  // flukes
  const fs = frame ? 2 : 0;
  for (let j = 0; j < tail; j++) {
    const v = (tail - 1 - j) / (tail - 1);
    const th = 2 + Math.round(v * maxH * 0.9);
    for (let y = -th; y <= th; y++) { if (v > 0.6 && Math.abs(y) < (v - 0.6) * maxH * 1.2) continue; g.set(x0 + j, cy + y + Math.round(v * fs), s.fin); }
  }
  // flipper
  const fx = x0 + tail + Math.round(bl * 0.62);
  for (let j = 0; j < Math.round(len * 0.1); j++) { g.set(fx - j, cy + Math.round(maxH * 0.4) + j, s.fin); g.set(fx - j + 1, cy + Math.round(maxH * 0.4) + j, s.fin); }
  // mouth + eye
  const nx = x0 + tail + bl - 1;
  for (let k = 0; k < Math.round(bl * 0.3); k++) g.set(nx - k, cy + Math.round(maxH * 0.25) + Math.round(k * 0.08), darken(s.top, 0.4));
  const ex = nx - Math.round(bl * 0.2), ey = cy - Math.round(maxH * 0.05);
  g.set(ex, ey, '#ffffff'); g.set(ex + 1, ey, '#102020'); g.set(ex, ey + 1, '#102020'); g.set(ex + 1, ey + 1, '#102020');
  g.meta.head = [nx - Math.round(bl * 0.22), cy - maxH, ex, ey];
  return g;
}

// ---------- faraway-spot props ----------
function drawBoat(x, y, t) {
  // x = centre, y = waterline
  R(x - 22, y - 5, 44, 2, '#b07a4c');
  R(x - 21, y - 3, 42, 3, '#8a5a35');
  R(x - 19, y, 38, 2, '#6b4428');
  R(x - 16, y + 2, 32, 2, '#5a3820');
  for (let i = -18; i < 18; i += 6) P(x + i, y - 2, '#5e3b22');
  R(x - 22, y - 6, 2, 2, '#c89060'); R(x + 20, y - 6, 2, 2, '#c89060');
  R(x - 21, y - 1, 42, 1, '#e8e0d0');
  const oar = Math.sin(t * 1.2) * 2;
  pline(x - 12, y - 4, x - 26, y + 4 + oar, '#a07040'); R(x - 28, y + 3 + oar, 3, 2, '#a07040');
}
function drawSailor(x, y, t, talk) {
  // old salt sitting on a crate, x = centre, y = ground
  R(x - 5, y - 6, 10, 6, '#8a5a35'); R(x - 5, y - 6, 10, 1, '#b07a4c'); pline(x - 5, y - 6, x + 4, y - 1, '#6b4428');
  const b = Math.sin(t * 1.5) > 0 ? 0 : 1;
  R(x - 4, y - 13 + b, 8, 7 - b, '#f0c030'); R(x - 4, y - 13 + b, 2, 6, '#d8a020'); // raincoat
  R(x + 2, y - 9, 6, 2, '#3a4a6a'); R(x + 7, y - 9, 2, 3, '#2a2a30'); // legs + boots
  R(x - 3, y - 19 + b, 6, 6, '#f1c27d'); R(x + 2, y - 19 + b, 1, 6, '#d49a5e');
  R(x - 3, y - 15 + b, 6, 3, '#f4f4f0'); R(x - 2, y - 13 + b, 4, 2, '#f4f4f0'); // beard
  P(x + 1, y - 17 + b, '#2b1d14');
  R(x - 4, y - 21 + b, 8, 2, '#2a3a6a'); R(x - 4, y - 20 + b, 9, 1, '#1a2a4a'); R(x - 1, y - 21 + b, 2, 1, '#f0c850'); // cap
  R(x + 3, y - 15 + b, 3, 1, '#6b4428'); R(x + 5, y - 16 + b, 2, 2, '#4a2a1a'); // pipe
  if (Math.random() < 0.05) Game.scene.parts && Game.scene.parts.add({ type: 'puff', x: x + 6, y: y - 18, vx: -4, vy: -8, life: 1.5, c: '#d8d0d8', s: 1, grow: 0.8, a: 0.5 });
  if (talk) { const j = Math.round(Math.abs(Math.sin(t * 5)) * 2); drawText('!', x - 1, y - 30 - j, '#ffe14a', { outline: '#3a1a1a' }); }
}
function drawCooler(x, y, full) {
  R(x, y - 6, 9, 6, '#e8f0f8'); R(x, y - 7, 9, 2, '#4a8ad0'); R(x + 3, y - 8, 3, 1, '#2a5a90');
  R(x, y - 1, 9, 1, '#a8b8c8'); R(x + 1, y - 4, 7, 1, '#c8d4e0');
  if (full > 0.99) drawText('!', x + 3, y - 15, '#ff6a6a', { outline: '#1a0a0a' });
}
function drawGull(x, y, t, carry) {
  const f = Math.sin(t * 14) > 0;
  R(x - 3, y, 7, 3, '#ffffff'); R(x + 3, y - 1, 3, 3, '#ffffff'); P(x + 4, y - 1, '#1a1a1a'); R(x + 6, y, 2, 1, '#f0a020');
  R(x - 5, y + 1, 2, 1, '#c8ccd8');
  if (f) { R(x - 2, y - 3, 5, 3, '#c8ccd8'); P(x - 2, y - 4, '#8a8e9a'); }
  else R(x - 2, y + 2, 5, 3, '#c8ccd8');
  if (carry) drawFish(carry, carry.len, x + 1, y + 7, 1, 0);
}
function drawBottle(x, y) {
  R(x - 3, y - 1, 6, 3, '#6ac08a'); R(x + 3, y, 2, 1, '#6ac08a'); R(x + 5, y, 1, 1, '#b08050');
  P(x - 2, y - 1, '#c8ffd8'); R(x - 1, y, 2, 1, '#f4e8c8');
}
function drawDecor(id, x, y, t) {
  if (id === 'castle') {
    R(x, y - 12, 20, 12, '#e8c890'); R(x + 3, y - 18, 5, 6, '#e8c890'); R(x + 12, y - 18, 5, 6, '#e8c890');
    for (let i = 0; i < 20; i += 3) R(x + i, y - 14, 2, 2, '#e8c890');
    R(x + 8, y - 6, 4, 6, '#6a4a2a'); P(x + 5, y - 15, '#6a4a2a'); P(x + 14, y - 15, '#6a4a2a'); R(x + 5, y - 22, 1, 4, '#8a5a35'); R(x + 6, y - 22, 3, 2, '#ff5a5a');
  } else if (id === 'plants') {
    for (let k = 0; k < 4; k++) for (let i = 0; i < 12 + k * 3; i++) P(x + k * 4 + Math.round(Math.sin(t * 1.5 + i * 0.3 + k) * (i / 10)), y - i, i % 3 ? '#2f8a4a' : '#4fb06a');
  } else if (id === 'treasure') {
    blit(fishSprite(FISH_BY_ID.chest, 11), x, y - 11);
    for (let i = 0; i < 8; i++) iconCoin(x + 12 + (i % 4) * 3, y - 5 - Math.floor(i / 4) * 3);
  } else if (id === 'diver') {
    pcircle(x + 7, y - 8, 7, '#b88a3a'); pcircle(x + 7, y - 8, 4, '#3a5a7a'); P(x + 5, y - 10, '#bfefff'); R(x, y - 2, 15, 2, '#8a6a2a');
    if (Math.sin(t * 2) > 0.8) Game.scene.parts && Game.scene.parts.add({ type: 'bubble', x: x + 7, y: y - 16, vy: -12, life: 1.5, c: '#d8f4ff', s: 1 });
  } else if (id === 'duck') {
    const b = Math.round(Math.sin(t * 2));
    R(x, y + b, 8, 4, '#ffe14a'); R(x + 5, y - 4 + b, 4, 4, '#ffe14a'); R(x + 9, y - 2 + b, 2, 1, '#ff8a2a'); P(x + 7, y - 3 + b, '#1a1a1a');
  }
}
function drawIcon(kind, x, y) {
  if (kind === 'shop') { R(x, y + 2, 7, 5, '#fff1c8'); R(x - 1, y, 9, 2, '#d8433a'); }
  else if (kind === 'journal') { R(x, y, 7, 7, '#e8d0a0'); R(x + 3, y, 1, 7, '#8a5a35'); }
  else if (kind === 'tank') { R(x, y, 8, 7, '#7fd7ff'); R(x, y, 8, 1, '#ffffff'); P(x + 3, y + 3, '#ff8a3a'); P(x + 4, y + 3, '#ff8a3a'); }
  else if (kind === 'map') { R(x, y, 8, 7, '#f0dca0'); pline(x + 1, y + 5, x + 6, y + 1, '#c04030'); P(x + 6, y + 1, '#c04030'); }
}
function drawCharm(i, x, y) {
  const c = CHARMS[i].color;
  pcircle(x, y, 4, darken(c, 0.4)); pcircle(x, y, 3, c); P(x - 1, y - 1, '#ffffff');
  R(x - 1, y - 7, 2, 3, '#c0a060');
}
