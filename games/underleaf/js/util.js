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

/* ---------------------------------------------------------- path planning
   A* over a fine grid of the static obstacles (rocks, logs, trunks, water).
   Blocked cells are cached per world, so planning around a rock is cheap
   after the first look. Antlion pits are checked live, since they come and go. */

const NAV_CELL = 12;

function navCellBlocked(world, cx, cy, rc, swims, pits) {
  const cache = world.navCache || (world.navCache = new Map());
  const key = cx + ',' + cy + (swims ? 's' : '') + (world.frozen ? 'f' : '') + rc;
  let b = cache.get(key);
  if (b === undefined) {
    const x = (cx + 0.5) * NAV_CELL, y = (cy + 0.5) * NAV_CELL;
    b = !!world.blocker(x, y, rc, false);
    // keep a margin from the shore: a cell is wet if water is anywhere near its middle
    if (!b && !swims) {
      const m = rc;
      b = world.wetAt(x, y) || world.wetAt(x + m, y) || world.wetAt(x - m, y) || world.wetAt(x, y + m) || world.wetAt(x, y - m);
    }
    if (cache.size > 250000) cache.clear();
    cache.set(key, b);
  }
  if (b) return true;
  if (pits) {
    const x = (cx + 0.5) * NAV_CELL, y = (cy + 0.5) * NAV_CELL;
    for (const p of world.activePits) if (dist2(x, y, p.x, p.y) < (p.r + 10 + rc) ** 2) return true;
  }
  return false;
}

/* Find a path from e to (gx, gy). If the goal can't be reached, returns the path to the
   closest reachable point, with .reached = false. */
function planPath(world, e, gx, gy, pits) {
  const C = NAV_CELL, rc = Math.round(Math.max(3, e.r * 0.6) / 2) * 2 + 3, sw = !!e.swims;
  const sx = Math.floor(e.x / C), sy = Math.floor(e.y / C);
  // plan inside a window around start and goal; far goals are clamped to its edge
  const span = 50;
  let tx = Math.floor(gx / C), ty = Math.floor(gy / C);
  const ddx = tx - sx, ddy = ty - sy, dm = Math.max(Math.abs(ddx), Math.abs(ddy));
  const far = dm > span;
  if (far) { tx = sx + Math.round((ddx / dm) * span); ty = sy + Math.round((ddy / dm) * span); }
  const x0 = Math.min(sx, tx) - 16, y0 = Math.min(sy, ty) - 16;
  const W = Math.max(sx, tx) + 16 - x0 + 1, H = Math.max(sy, ty) + 16 - y0 + 1;
  const N = W * H, g = new Float32Array(N).fill(1e9), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const idx = (x, y) => (y - y0) * W + (x - x0);
  const blocked = (x, y) => (x === tx && y === ty) || (x === sx && y === sy) ? false : navCellBlocked(world, x, y, rc, sw, pits);
  const hf = (x, y) => { const ax = Math.abs(x - tx), ay = Math.abs(y - ty); return Math.max(ax, ay) + 0.414 * Math.min(ax, ay); };
  const heap = [];
  const push = (i, f) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = k * 2 + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  const si = idx(sx, sy);
  g[si] = 0; push(si, hf(sx, sy));
  let best = si, bestH = hf(sx, sy), found = false, expanded = 0;
  while (heap.length && expanded < 2600) {
    const [, i] = pop();
    if (closed[i]) continue;
    closed[i] = 1; expanded++;
    const x = (i % W) + x0, y = ((i / W) | 0) + y0, h = hf(x, y);
    if (h < bestH) { bestH = h; best = i; }
    if (x === tx && y === ty) { found = true; best = i; break; }
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < x0 || ny < y0 || nx >= x0 + W || ny >= y0 + H) continue;
      const ni = idx(nx, ny);
      if (closed[ni] || blocked(nx, ny)) continue;
      // no squeezing diagonally between two blocked cells
      if (dx && dy && (blocked(x + dx, y) || blocked(x, y + dy))) continue;
      const ng = g[i] + (dx && dy ? 1.414 : 1);
      if (ng < g[ni]) { g[ni] = ng; from[ni] = i; push(ni, ng + hf(nx, ny) * 1.05); }
    }
  }
  const pts = [];
  for (let i = best; i !== -1 && i !== si; i = from[i]) pts.push({ x: ((i % W) + x0 + 0.5) * C, y: (((i / W) | 0) + y0 + 0.5) * C });
  pts.reverse();
  if (found && !far && pts.length) pts[pts.length - 1] = { x: gx, y: gy };
  pts.reached = found;
  pts.partial = far;
  pts.gap = bestH * C;
  return pts;
}

/* Is the straight line between two points free of static obstacles? */
function navLine(world, e, x1, y1, x2, y2, pits) {
  const rc = Math.round(Math.max(3, e.r * 0.6) / 2) * 2 + 3, d = dist(x1, y1, x2, y2), n = Math.ceil(d / (NAV_CELL * 0.5));
  for (let k = 1; k <= n; k++) {
    const x = lerp(x1, x2, k / n), y = lerp(y1, y2, k / n);
    if (navCellBlocked(world, Math.floor(x / NAV_CELL), Math.floor(y / NAV_CELL), rc, !!e.swims, pits) && dist2(x, y, x2, y2) > NAV_CELL * NAV_CELL) return false;
  }
  return true;
}

/* Steer towards `desired`, routing around anything in the way.
   With a goal, a blocked walker plans an A* path to it and follows that, cutting corners
   where the way is clear. Without a goal (wandering), it plans to a point further along
   its heading, so it walks round a rock instead of orbiting it.
   e.nav.unreach is set when the goal truly can't be reached, so callers can give it up. */
function navigate(world, e, desired, look, pits, dt, speed, goal) {
  const nav = e.nav || (e.nav = { path: null, pi: 0, planT: 0, losT: 0, lx: e.x, ly: e.y, checkT: 1, stuck: 0, vgoal: null, vgoalT: 0, unreach: false, fails: 0, gx: 0, gy: 0 });
  nav.planT -= dt; nav.losT -= dt; nav.checkT -= dt; nav.vgoalT -= dt;
  // progress check: am I actually getting anywhere?
  let stuck = false;
  if (nav.checkT <= 0) {
    const moved = dist(e.x, e.y, nav.lx, nav.ly);
    nav.lx = e.x; nav.ly = e.y; nav.checkT = 0.8;
    if (speed > 5 && moved < speed * 0.8 * 0.25) { nav.stuck++; stuck = nav.stuck >= 2; nav.stuckN = (nav.stuckN || 0) + 1; }
    else { nav.stuck = 0; nav.stuckN = 0; }
    // replanning hasn't freed us (something the grid can't see is in the way): try a new heading
    if (nav.stuckN >= 4) {
      nav.stuckN = 0; nav.path = null;
      if (goal && !nav.vgoal) { nav.fails++; if (nav.fails >= 3) nav.unreach = true; }
      const a = (e.navA ?? e.a) + (Math.random() < 0.5 ? 1 : -1) * rand(1.6, 2.6);
      nav.vgoal = { x: e.x + Math.cos(a) * 90, y: e.y + Math.sin(a) * 90 }; nav.vgoalT = 2.5;
      return a;
    }
  }
  // slipped into water without being able to swim: head for the nearest dry ground
  if (!e.swims && world.wetAt(e.x, e.y)) {
    for (const r of [16, 32, 56, 90]) for (let k = 0; k < 16; k++) {
      const a = desired + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (TAU / 16);
      if (!world.wetAt(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r)) { nav.path = null; return a; }
    }
    return desired;
  }
  let tgt = goal;
  // a committed detour (or, when wandering, a point ahead) wins until we reach it or it expires
  if (nav.vgoal && nav.vgoalT > 0 && dist2(e.x, e.y, nav.vgoal.x, nav.vgoal.y) > 20 * 20) tgt = nav.vgoal;
  else nav.vgoal = null;
  const straight = navClear(world, e, desired, look, pits);
  // nothing in the way and no plan running: just go
  if (straight && !nav.path && !stuck) {
    if (tgt && tgt !== goal) return Math.atan2(tgt.y - e.y, tgt.x - e.x);
    nav.unreach = false; return desired;
  }
  if (!tgt) {
    nav.vgoal = tgt = { x: e.x + Math.cos(desired) * 220, y: e.y + Math.sin(desired) * 220 };
    nav.vgoalT = 6; nav.path = null;
  }
  // (re)plan when there's no path, the goal moved, we're stuck, or the plan is old
  const moved = dist2(tgt.x, tgt.y, nav.gx, nav.gy) > 40 * 40;
  if (!nav.path || moved || stuck || nav.planT <= 0) {
    if (nav.planT <= 0 || !nav.path || stuck || moved) {
      nav.path = planPath(world, e, tgt.x, tgt.y, pits);
      nav.pi = 0; nav.gx = tgt.x; nav.gy = tgt.y; nav.planT = nav.path.partial ? 1.5 : 3;
      nav.stuck = 0;
      if (tgt === goal && goal && !nav.path.reached && !nav.path.partial && nav.path.gap > 30) {
        nav.fails++;
        if (nav.fails >= 2) nav.unreach = true;
      } else { nav.fails = 0; nav.unreach = false; }
      if (!nav.path.length) {
        nav.path = null;
        if (goal && tgt === goal) { nav.fails++; if (nav.fails >= 2) nav.unreach = true; }
        // nothing gets us closer that way: pick a fresh open heading and commit to it for a while
        const side = Math.random() < 0.5 ? 1 : -1;
        for (let k = 1; k <= 8; k++) {
          const a = desired + side * (k % 2 ? 1 : -1) * (0.5 + Math.ceil(k / 2) * 0.55);
          const px = e.x + Math.cos(a) * 160, py = e.y + Math.sin(a) * 160;
          if (navLine(world, e, e.x, e.y, px, py, pits)) { nav.vgoal = { x: px, y: py }; nav.vgoalT = 4; nav.gx = px; nav.gy = py; return a; }
        }
        nav.vgoal = null;
        return (e.navA ?? e.a) + Math.PI * (0.6 + Math.random() * 0.8);
      }
    }
  }
  const P = nav.path;
  // advance past waypoints we've reached, and cut corners when the line ahead is clear
  while (nav.pi < P.length - 1 && dist2(e.x, e.y, P[nav.pi].x, P[nav.pi].y) < 14 * 14) nav.pi++;
  if (nav.losT <= 0) {
    nav.losT = 0.25;
    for (let k = Math.min(P.length - 1, nav.pi + 8); k > nav.pi; k--) {
      if (navLine(world, e, e.x, e.y, P[k].x, P[k].y, pits)) { nav.pi = k; break; }
    }
  }
  const wp = P[nav.pi];
  // done with the plan once we're at its end, or the goal itself is in plain sight
  if (dist2(e.x, e.y, wp.x, wp.y) < 10 * 10 && nav.pi >= P.length - 1) {
    nav.path = null;
    if (nav.vgoal) nav.vgoal = null;
    return desired;
  }
  if (goal && nav.losT === 0.25 && navLine(world, e, e.x, e.y, goal.x, goal.y, pits) && straight) { nav.path = null; return desired; }
  return Math.atan2(wp.y - e.y, wp.x - e.x);
}
