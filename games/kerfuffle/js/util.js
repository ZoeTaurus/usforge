'use strict';
// ---------------------------------------------------------------------------
// Small math / color / random helpers shared by everything else.
// ---------------------------------------------------------------------------

const TAU = Math.PI * 2;
const D2R = Math.PI / 180;

// World constants (shared by stages, battle and fighters)
const STAGE_W = 2000;
const GROUND_Y = 632;
const WALL = 40;
const EDGE = 40;
const WORLD_ZOOM = 1.15; // fighters look bigger; the floor stays put
const VIEW_W = 1280 / WORLD_ZOOM;
const MAX_SEP = VIEW_W - EDGE * 2;

const U = {
  clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
  lerp: (a, b, t) => a + (b - a) * t,
  invLerp: (a, b, v) => (b === a ? 0 : (v - a) / (b - a)),
  sign: (v) => (v < 0 ? -1 : 1),
  approach(v, target, step) {
    if (v < target) return Math.min(target, v + step);
    return Math.max(target, v - step);
  },
  dist: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1),

  // --- easing -------------------------------------------------------------
  ease: {
    linear: (t) => t,
    in: (t) => t * t,
    out: (t) => 1 - (1 - t) * (1 - t),
    inout: (t) => t * t * (3 - 2 * t),
    in3: (t) => t * t * t,
    out3: (t) => 1 - Math.pow(1 - t, 3),
    snap: (t) => 1 - Math.pow(1 - t, 4),
    back: (t) => {
      const c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    elastic: (t) => {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1;
    },
    step: (t) => (t < 1 ? 0 : 1),
  },

  // --- random ---------------------------------------------------------------
  rand: (a = 0, b = 1) => a + Math.random() * (b - a),
  randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  choose: (arr) => arr[Math.floor(Math.random() * arr.length)],
  chance: (p) => Math.random() < p,
  // deterministic RNG (mulberry32) for simulations / reproducible AI
  rng(seed) {
    let s = seed >>> 0;
    const f = () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return f;
  },
  // cheap deterministic hash noise in [0,1)
  hash(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  },
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  // --- colors ---------------------------------------------------------------
  _rgbCache: new Map(),
  rgb(hex) {
    let c = U._rgbCache.get(hex);
    if (c) return c;
    let h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    U._rgbCache.set(hex, c);
    return c;
  },
  hex(r, g, b) {
    const t = (v) => U.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
    return '#' + t(r) + t(g) + t(b);
  },
  mix(c1, c2, t) {
    const a = U.rgb(c1), b = U.rgb(c2);
    return U.hex(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
  },
  shade(c, amt) {
    // amt < 0 darkens, > 0 lightens
    return amt < 0 ? U.mix(c, '#000000', -amt) : U.mix(c, '#ffffff', amt);
  },
  rgba(hex, a) {
    const c = U.rgb(hex);
    return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  },
  hsl: (h, s, l) => `hsl(${h},${s}%,${l}%)`,

  // --- geometry -------------------------------------------------------------
  // squared distance from point p to segment ab
  segPointDist2(ax, ay, bx, by, px, py) {
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = ax + dx * t - px, qy = ay + dy * t - py;
    return qx * qx + qy * qy;
  },
  // squared distance between segments p1q1 and p2q2 (+ closest points)
  segSegDist2(p1x, p1y, q1x, q1y, p2x, p2y, q2x, q2y, out) {
    const d1x = q1x - p1x, d1y = q1y - p1y;
    const d2x = q2x - p2x, d2y = q2y - p2y;
    const rx = p1x - p2x, ry = p1y - p2y;
    const a = d1x * d1x + d1y * d1y;
    const e = d2x * d2x + d2y * d2y;
    const f = d2x * rx + d2y * ry;
    let s, t;
    const EPS = 1e-6;
    if (a <= EPS && e <= EPS) {
      s = t = 0;
    } else if (a <= EPS) {
      s = 0;
      t = U.clamp(f / e, 0, 1);
    } else {
      const c = d1x * rx + d1y * ry;
      if (e <= EPS) {
        t = 0;
        s = U.clamp(-c / a, 0, 1);
      } else {
        const b = d1x * d2x + d1y * d2y;
        const denom = a * e - b * b;
        s = denom !== 0 ? U.clamp((b * f - c * e) / denom, 0, 1) : 0;
        t = (b * s + f) / e;
        if (t < 0) {
          t = 0;
          s = U.clamp(-c / a, 0, 1);
        } else if (t > 1) {
          t = 1;
          s = U.clamp((b - c) / a, 0, 1);
        }
      }
    }
    const c1x = p1x + d1x * s, c1y = p1y + d1y * s;
    const c2x = p2x + d2x * t, c2y = p2y + d2y * t;
    if (out) {
      out[0] = (c1x + c2x) / 2;
      out[1] = (c1y + c2y) / 2;
    }
    const dx = c1x - c2x, dy = c1y - c2y;
    return dx * dx + dy * dy;
  },
};

// Persistent settings (wrapped: storage may be unavailable)
const Store = {
  get(key, def) {
    try {
      const v = localStorage.getItem('kerfuffle.' + key);
      return v === null ? def : JSON.parse(v);
    } catch (e) {
      return def;
    }
  },
  set(key, val) {
    try {
      localStorage.setItem('kerfuffle.' + key, JSON.stringify(val));
    } catch (e) {
      /* ignore */
    }
  },
};
