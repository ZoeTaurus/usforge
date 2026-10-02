'use strict';
/* Small math helpers and noise shared by every other file. */

const TAU = Math.PI * 2;
const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const dist2 = (ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; };

function angDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU;
  return d;
}

function rotV(x, y, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [x * c - y * s, x * s + y * c];
}

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashInt(x, y, seed) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return h >>> 0;
}
const hash01 = (x, y, seed) => hashInt(x, y, seed) / 4294967296;

function vnoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash01(xi, yi, seed), b = hash01(xi + 1, yi, seed);
  const c = hash01(xi, yi + 1, seed), d = hash01(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x, y, seed, oct = 4) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, seed + i * 31); n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}

let UID = 1;

class SpatialHash {
  constructor(cell) { this.cell = cell; this.map = new Map(); }
  clear() { this.map.clear(); }
  key(i, j) { return (i + 32768) * 65536 + (j + 32768); }
  insert(e) {
    const k = this.key(Math.floor(e.x / this.cell), Math.floor(e.y / this.cell));
    let b = this.map.get(k);
    if (!b) { b = []; this.map.set(k, b); }
    b.push(e);
  }
  query(x, y, r, fn) {
    const c = this.cell;
    const x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
    const y0 = Math.floor((y - r) / c), y1 = Math.floor((y + r) / c);
    for (let i = x0; i <= x1; i++) {
      for (let j = y0; j <= y1; j++) {
        const b = this.map.get(this.key(i, j));
        if (b) for (let k = 0; k < b.length; k++) fn(b[k]);
      }
    }
  }
}

function segDist2(x, y, b) {
  const vx = b.x2 - b.x1, vy = b.y2 - b.y1;
  const t = clamp(((x - b.x1) * vx + (y - b.y1) * vy) / (vx * vx + vy * vy), 0, 1);
  return dist2(x, y, b.x1 + vx * t, b.y1 + vy * t);
}

const AVOID_TRIES = [0.6, -0.6, 1.2, -1.2, 1.9, -1.9, 2.7, -2.7];

/* Steer around rocks, water and (optionally) antlion pits by looking ahead. */
function avoidDir(world, e, desired, look, pits) {
  const px = e.x + Math.cos(desired) * look, py = e.y + Math.sin(desired) * look;
  if (!e.swims && world.waterAt(px, py)) {
    for (const d of AVOID_TRIES) {
      const a = desired + d;
      if (!world.waterAt(e.x + Math.cos(a) * look, e.y + Math.sin(a) * look)) return a;
    }
    return desired + Math.PI;
  }
  const b = world.blocker(px, py, e.r * 0.6, pits);
  if (!b) return desired;
  const toB = Math.atan2(b.y - e.y, b.x - e.x);
  const side = angDiff(toB, desired) >= 0 ? 1 : -1;
  return toB + side * (Math.PI / 2 + 0.35);
}

/* ------------------------------------------------------------ navigation
   Whisker steering with a committed side (so walkers go around an obstacle
   instead of dithering in front of it), plus stuck detection that flips the
   side or takes a short random detour when progress stalls. */

const NAV_OFFSETS = [0.35, 0.7, 1.05, 1.4, 1.8, 2.3, 2.8];

function navBlocked(world, e, x, y, pits) {
  if (!e.swims && world.wetAt(x, y)) return true;
  return !!world.blocker(x, y, e.r * 0.6, pits);
}

function navClear(world, e, a, look, pits) {
  const c = Math.cos(a), s = Math.sin(a);
  return !navBlocked(world, e, e.x + c * look * 0.5, e.y + s * look * 0.5, pits) &&
    !navBlocked(world, e, e.x + c * look, e.y + s * look, pits);
}

function navigate(world, e, desired, look, pits, dt, speed, goal) {
  const nav = e.nav || (e.nav = { side: 0, follow: false, followT: 0, hitD: 0, checkT: 1, lx: e.x, ly: e.y, stuck: 0, detourT: 0, detourA: 0 });
  nav.checkT -= dt;
  // progress check: am I actually getting anywhere?
  if (nav.checkT <= 0) {
    const moved = dist(e.x, e.y, nav.lx, nav.ly);
    nav.lx = e.x; nav.ly = e.y; nav.checkT = 0.8;
    if (speed > 5 && moved < speed * 0.8 * 0.25) {
      nav.stuck++;
      nav.side = nav.side ? -nav.side : (Math.random() < 0.5 ? 1 : -1);
      if (nav.stuck >= 3) { nav.detourT = rand(0.8, 1.6); nav.detourA = desired + Math.PI + rand(-1.2, 1.2); nav.stuck = 0; }
    } else if (moved > speed * 0.8 * 0.6) nav.stuck = 0;
  }
  if (nav.detourT > 0) {
    nav.detourT -= dt;
    if (navClear(world, e, nav.detourA, look, pits)) return nav.detourA;
  }
  const straight = navClear(world, e, desired, look, pits);
  const gd = goal ? dist(e.x, e.y, goal.x, goal.y) : 0;
  if (nav.follow) {
    nav.followT += dt;
    // leave the wall once the way ahead is open and we are closer than where we hit it
    const done = goal ? straight && gd < nav.hitD - 12 : straight && nav.followT > 2.5;
    if (done || (goal && gd < look)) nav.follow = false;
    else if (nav.followT > 14) { nav.side = -nav.side; nav.followT = 0; nav.hitD = gd; }
  }
  if (!nav.follow) {
    if (straight) return desired;
    // blocked: choose the side with the shorter turn, then hug that wall
    let best = 0;
    for (const o of NAV_OFFSETS) {
      const l = navClear(world, e, desired - o, look, pits), r = navClear(world, e, desired + o, look, pits);
      if (l || r) { best = l && r ? (Math.random() < 0.5 ? -1 : 1) : l ? -1 : 1; break; }
    }
    nav.side = best || nav.side || (Math.random() < 0.5 ? 1 : -1);
    nav.follow = true; nav.followT = 0; nav.hitD = gd;
  }
  // wall-following: sweep from "into the wall" towards open ground and take the first clear heading,
  // which keeps the obstacle on one side all the way round, even out of pockets
  const base = (e.navA ?? e.a) - nav.side * 1.1;
  for (let k = 0; k < 18; k++) {
    const a = base + nav.side * k * 0.35;
    if (navClear(world, e, a, look, pits)) return a;
  }
  return (e.navA ?? e.a) + Math.PI;
}
