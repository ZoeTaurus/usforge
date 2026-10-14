// Track (map) definitions and the centre-line path builder.
//
// Every track is a closed polygon whose corners are rounded with the given
// radius (metres). That gives us precise control over how tight each turn is.
// The race starts in the middle of the straight between corner 0 and 1.

import { clamp } from './utils.js';

export const TRACKS = [
  {
    id: 'valley',
    name: 'Green Valley',
    tagline: 'Sunny hills, wide sweeping bends',
    difficulty: 1,
    reward: 1.0,
    width: 18,
    runoff: 7,
    aiSkill: [0.76, 0.87],
    seed: 11,
    corners: [
      [-360, 210, 110],
      [350, 220, 110],
      [380, -120, 90],
      [150, -100, 60],
      [60, -260, 70],
      [-300, -250, 100],
    ],
    theme: {
      card: ['#5fb3ff', '#8fd36a'],
      sky: { top: '#2f7fd8', horizon: '#cfe8f7', bottom: '#cfe8f7', sun: [0.45, 0.55, -0.6], sunColor: '#fff4d8' },
      fog: { color: '#cfe8f7', near: 280, far: 1700 },
      hemi: { sky: '#d6ecff', ground: '#4d6b2e', intensity: 1.1 },
      sunLight: { color: '#fff1d6', intensity: 2.6 },
      exposure: 1.0,
      ground: 'grass',
      terrain: { style: 'hills', height: 75, scale: 0.0035 },
      barrier: 'tires',
      scenery: 'valley',
      grip: 1.0,
      night: false,
      bloom: null,
      clouds: true,
    },
  },
  {
    id: 'beach',
    name: 'Palm Beach',
    tagline: 'Palm trees, sea breeze and a long beach straight',
    difficulty: 1,
    reward: 1.15,
    width: 17,
    runoff: 7,
    aiSkill: [0.78, 0.88],
    seed: 63,
    corners: [
      [-420, 180, 90],
      [380, 200, 120],
      [460, -40, 70],
      [280, -120, 55],
      [300, -280, 60],
      [40, -300, 80],
      [-80, -140, 50],
      [-260, -230, 70],
      [-460, -60, 80],
    ],
    theme: {
      card: ['#2fd0e0', '#ffd27a'],
      sky: { top: '#1f8be0', horizon: '#c4ecf8', bottom: '#c4ecf8', sun: [0.35, 0.6, 0.65], sunColor: '#fff6dc' },
      fog: { color: '#c4ecf8', near: 320, far: 1900 },
      hemi: { sky: '#dff4ff', ground: '#c9a46a', intensity: 1.1 },
      sunLight: { color: '#fff3d6', intensity: 2.7 },
      exposure: 1.0,
      ground: 'beach',
      terrain: { style: 'coast', height: 55, scale: 0.0035, coast: { axis: 'z', dir: 1, at: 280 } },
      water: { level: -1.4, color: '#14a8c8' },
      barrier: 'beach',
      scenery: 'beach',
      grip: 1.0,
      night: false,
      bloom: null,
      clouds: true,
    },
  },
  {
    id: 'desert',
    name: 'Desert Canyon',
    tagline: 'Dusty mesas, a huge straight & a hairpin',
    difficulty: 2,
    reward: 1.25,
    width: 16,
    runoff: 6,
    aiSkill: [0.8, 0.91],
    seed: 23,
    corners: [
      [-400, 250, 80],
      [300, 250, 70],
      [420, 100, 50],
      [250, -20, 45],
      [380, -150, 60],
      [300, -330, 35],
      [60, -260, 50],
      [-50, -60, 40],
      [-200, -200, 60],
      [-420, -120, 70],
    ],
    theme: {
      card: ['#ffb36b', '#d9773d'],
      sky: { top: '#3a86d1', horizon: '#f6d9b0', bottom: '#f6d9b0', sun: [-0.5, 0.42, -0.55], sunColor: '#ffe2b0' },
      fog: { color: '#f2d6ae', near: 260, far: 1600 },
      hemi: { sky: '#ffe9cc', ground: '#a8693a', intensity: 1.05 },
      sunLight: { color: '#ffe0b5', intensity: 2.9 },
      exposure: 1.0,
      ground: 'sand',
      terrain: { style: 'mesa', height: 90, scale: 0.003 },
      barrier: 'concrete',
      scenery: 'desert',
      grip: 0.95,
      night: false,
      bloom: null,
      clouds: false,
    },
  },
  {
    id: 'autumn',
    name: 'Autumn Woods',
    tagline: 'A twisty forest road under falling leaves',
    difficulty: 2,
    reward: 1.35,
    width: 16,
    runoff: 6,
    aiSkill: [0.81, 0.92],
    seed: 71,
    corners: [
      [-380, 240, 80],
      [240, 260, 70],
      [380, 120, 60],
      [200, 20, 45],
      [360, -120, 50],
      [240, -280, 70],
      [0, -200, 45],
      [-120, -320, 50],
      [-360, -240, 75],
      [-260, -40, 45],
      [-420, 80, 55],
    ],
    theme: {
      card: ['#ff9a3c', '#9a3a22'],
      sky: { top: '#5d8fd0', horizon: '#f3d8b4', bottom: '#f3d8b4', sun: [-0.6, 0.3, 0.5], sunColor: '#ffd9a0' },
      fog: { color: '#ecd2b0', near: 220, far: 1400 },
      hemi: { sky: '#ffe2c0', ground: '#6b4a2a', intensity: 1.0 },
      sunLight: { color: '#ffcf8a', intensity: 2.6 },
      exposure: 1.0,
      ground: 'autumn',
      terrain: { style: 'hills', height: 85, scale: 0.004 },
      barrier: 'wood',
      scenery: 'autumn',
      grip: 0.95,
      night: false,
      bloom: null,
      clouds: true,
      weather: 'leaves',
    },
  },
  {
    id: 'reef',
    name: 'Bubble Reef',
    tagline: 'Race in a bubble over a coral reef — and across an island!',
    badge: 'NEW!',
    difficulty: 2,
    reward: 1.5,
    width: 17,
    runoff: 6,
    aiSkill: [0.82, 0.93],
    seed: 113,
    corners: [
      [-420, 240, 90],
      [360, 260, 80],
      [460, 80, 55],
      [300, -20, 45],
      [430, -180, 70],
      [300, -360, 90],
      [-380, -360, 100],
      [-470, -60, 70],
    ],
    // The road rises out of the sea and crosses a small island here.
    island: { x: -26, z: -360, height: 22, plateau: 70, ramp: 160 },
    theme: {
      card: ['#0a6fb8', '#36e0c8'],
      sky: { top: '#1f7fe0', horizon: '#a8e4f6', bottom: '#a8e4f6', sun: [0.3, 0.75, 0.45], sunColor: '#fff6dc' },
      fog: { color: '#a8e4f6', near: 420, far: 2600 },
      hemi: { sky: '#bfefff', ground: '#2a7a6a', intensity: 0.9 },
      sunLight: { color: '#fff3e0', intensity: 2.2 },
      exposure: 1.0,
      ground: 'seabed',
      terrain: { style: 'seabed', height: 14, scale: 0.006 },
      underwater: { level: 20, floor: -26 },
      barrier: 'none',
      scenery: 'reef',
      grip: 0.92,
      night: false,
      bloom: { strength: 0.5, radius: 0.55, threshold: 0.86 },
      clouds: true,
      bubble: true,
    },
  },
  {
    id: 'snow',
    name: 'Snowy Peaks',
    tagline: 'Slippery ice between giant mountains',
    difficulty: 2,
    reward: 1.5,
    width: 17,
    runoff: 7,
    aiSkill: [0.82, 0.93],
    seed: 37,
    corners: [
      [-350, 300, 120],
      [250, 320, 110],
      [450, 100, 100],
      [380, -250, 90],
      [100, -200, 80],
      [-60, -350, 80],
      [-380, -280, 110],
      [-250, 20, 80],
    ],
    theme: {
      card: ['#bfe3ff', '#7aa7d6'],
      sky: { top: '#6f98c6', horizon: '#e6eef6', bottom: '#e6eef6', sun: [0.3, 0.35, 0.7], sunColor: '#fff8ef' },
      fog: { color: '#e3ebf3', near: 160, far: 1100 },
      hemi: { sky: '#eef6ff', ground: '#8a9db3', intensity: 1.25 },
      sunLight: { color: '#fffaf0', intensity: 2.0 },
      exposure: 0.95,
      ground: 'snow',
      terrain: { style: 'mountains', height: 230, scale: 0.0028 },
      barrier: 'snow',
      scenery: 'snow',
      grip: 0.62,
      night: false,
      bloom: null,
      clouds: false,
      weather: 'snow',
    },
  },
  {
    id: 'volcano',
    name: 'Lava Volcano',
    tagline: 'Hairpins around an erupting volcano',
    difficulty: 3,
    reward: 1.65,
    width: 16,
    runoff: 6,
    aiSkill: [0.85, 0.95],
    seed: 89,
    corners: [
      [-300, 330, 70],
      [320, 330, 60],
      [440, 140, 40],
      [300, 60, 30],
      [440, -60, 45],
      [330, -320, 60],
      [-40, -360, 60],
      [-120, -230, 35],
      [-330, -280, 50],
      [-450, -20, 70],
      [-300, 120, 40],
      [-440, 230, 45],
    ],
    theme: {
      card: ['#ff5a1f', '#3a0d0d'],
      sky: { top: '#12060a', horizon: '#7a2a16', bottom: '#7a2a16', sun: [0.2, 0.2, -0.9], sunColor: '#ff7a3a', stars: true },
      fog: { color: '#4a1c12', near: 160, far: 1100 },
      hemi: { sky: '#ff9a6a', ground: '#2a1410', intensity: 0.8 },
      sunLight: { color: '#ffb080', intensity: 1.5 },
      exposure: 1.05,
      ground: 'lava',
      terrain: { style: 'volcano', height: 70, scale: 0.004, cone: { x: 0, z: 0, r: 230, h: 240 } },
      lava: { level: -3 },
      barrier: 'lava',
      scenery: 'volcano',
      grip: 1.0,
      night: true,
      bloom: { strength: 0.7, radius: 0.5, threshold: 0.72 },
      clouds: false,
      weather: 'embers',
    },
  },
  {
    id: 'city',
    name: 'Neon City',
    tagline: 'Tight 90° street corners at midnight',
    difficulty: 3,
    reward: 1.75,
    width: 15,
    runoff: 4,
    aiSkill: [0.84, 0.95],
    seed: 51,
    scale: 0.85,
    corners: [
      [-250, 200, 30],
      [300, 200, 30],
      [300, 0, 28],
      [150, 0, 28],
      [150, -150, 28],
      [350, -150, 30],
      [350, -300, 30],
      [-250, -300, 30],
      [-250, -80, 28],
      [-100, -80, 26],
      [-100, 80, 26],
      [-250, 80, 28],
    ],
    theme: {
      card: ['#3b1a6b', '#ff2fa8'],
      sky: { top: '#05030f', horizon: '#2a1048', bottom: '#2a1048', sun: [0.2, 0.5, 0.8], sunColor: '#b9c7ff', stars: true },
      fog: { color: '#1a0b30', near: 90, far: 750 },
      hemi: { sky: '#5a4aa8', ground: '#1a1030', intensity: 0.7 },
      sunLight: { color: '#9fb2ff', intensity: 0.7 },
      exposure: 1.1,
      ground: 'city',
      terrain: { style: 'flat', height: 0, scale: 0 },
      barrier: 'neon',
      scenery: 'city',
      grip: 1.0,
      night: true,
      bloom: { strength: 0.6, radius: 0.45, threshold: 0.72 },
      clouds: false,
    },
  },
  {
    id: 'moon',
    name: 'Moon Base',
    tagline: 'Low grip racing under a giant Earth',
    difficulty: 3,
    reward: 2.0,
    width: 17,
    runoff: 7,
    aiSkill: [0.86, 0.96],
    seed: 97,
    corners: [
      [-450, 250, 60],
      [450, 250, 60],
      [450, 50, 35],
      [150, 50, 35],
      [150, -100, 35],
      [450, -100, 40],
      [450, -300, 60],
      [-200, -300, 50],
      [-200, -100, 30],
      [-450, -100, 50],
    ],
    theme: {
      card: ['#1b2440', '#8fa3c7'],
      sky: { top: '#000004', horizon: '#0d1326', bottom: '#0d1326', sun: [0.6, 0.35, -0.7], sunColor: '#ffffff', stars: true, earth: true },
      fog: { color: '#0d1326', near: 500, far: 2600 },
      hemi: { sky: '#8aa0d0', ground: '#3a3a40', intensity: 0.55 },
      sunLight: { color: '#ffffff', intensity: 3.2 },
      exposure: 1.0,
      ground: 'moon',
      terrain: { style: 'craters', height: 40, scale: 0.004 },
      barrier: 'scifi',
      scenery: 'moon',
      grip: 0.8,
      night: false,
      bloom: { strength: 0.55, radius: 0.4, threshold: 0.82 },
      clouds: false,
    },
  },
];

export function getTrack(id) {
  return TRACKS.find((t) => t.id === id) || TRACKS[0];
}

// Rounded-polygon corners -> closed polyline (array of {x, z}).
export function cornerPolyline(def) {
  const sc = def.scale || 1;
  const C = def.corners.map(([x, z, r]) => ({ x: x * sc, z: z * sc, r }));
  const n = C.length;
  const arcs = [];
  for (let i = 0; i < n; i++) {
    const p = C[(i - 1 + n) % n];
    const c = C[i];
    const q = C[(i + 1) % n];
    let ix = c.x - p.x;
    let iz = c.z - p.z;
    const il = Math.hypot(ix, iz);
    ix /= il;
    iz /= il;
    let ox = q.x - c.x;
    let oz = q.z - c.z;
    const ol = Math.hypot(ox, oz);
    ox /= ol;
    oz /= ol;
    const cross = ix * oz - iz * ox;
    const theta = Math.acos(clamp(ix * ox + iz * oz, -1, 1));
    const t = c.r * Math.tan(theta / 2);
    const t1x = c.x - ix * t;
    const t1z = c.z - iz * t;
    const sg = Math.sign(cross) || 1;
    const cx = t1x + sg * -iz * c.r;
    const cz = t1z + sg * ix * c.r;
    const a0 = Math.atan2(t1z - cz, t1x - cx);
    const sweep = sg * theta;
    const m = Math.max(2, Math.ceil((theta * c.r) / 1.0));
    const pts = [];
    for (let k = 0; k <= m; k++) {
      const a = a0 + (sweep * k) / m;
      pts.push({ x: cx + Math.cos(a) * c.r, z: cz + Math.sin(a) * c.r });
    }
    arcs.push(pts);
  }
  const end0 = arcs[0][arcs[0].length - 1];
  const start1 = arcs[1][0];
  const mid = { x: (end0.x + start1.x) / 2, z: (end0.z + start1.z) / 2 };
  const line = [mid];
  for (let i = 1; i <= n; i++) for (const p of arcs[i % n]) line.push(p);
  line.push({ x: mid.x, z: mid.z });
  return line;
}

// A uniformly re-sampled centre line with tangents, normals and curvature.
export class TrackPath {
  constructor(def, spacing = 2) {
    this.def = def;
    this.halfWidth = def.width / 2;
    this.wallDist = def.width / 2 + def.runoff;

    const line = cornerPolyline(def);
    const cum = [0];
    for (let i = 1; i < line.length; i++) {
      cum.push(cum[i - 1] + Math.hypot(line[i].x - line[i - 1].x, line[i].z - line[i - 1].z));
    }
    const total = cum[cum.length - 1];
    const N = Math.round(total / spacing);
    const step = total / N;
    this.length = total;
    this.count = N;
    this.step = step;

    const px = new Float32Array(N);
    const pz = new Float32Array(N);
    let seg = 0;
    for (let i = 0; i < N; i++) {
      const s = i * step;
      while (seg < line.length - 2 && cum[seg + 1] < s) seg++;
      const t = (s - cum[seg]) / Math.max(1e-6, cum[seg + 1] - cum[seg]);
      px[i] = line[seg].x + (line[seg + 1].x - line[seg].x) * t;
      pz[i] = line[seg].z + (line[seg + 1].z - line[seg].z) * t;
    }

    const tx = new Float32Array(N);
    const tz = new Float32Array(N);
    const nx = new Float32Array(N);
    const nz = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const a = (i - 1 + N) % N;
      const b = (i + 1) % N;
      let dx = px[b] - px[a];
      let dz = pz[b] - pz[a];
      const l = Math.hypot(dx, dz) || 1;
      dx /= l;
      dz /= l;
      tx[i] = dx;
      tz[i] = dz;
      // Left-hand normal (car forward = +Z, left = +X).
      nx[i] = dz;
      nz[i] = -dx;
    }

    // Signed curvature (positive = turning left), smoothed.
    const raw = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const a = (i - 2 + N) % N;
      const b = (i + 2) % N;
      const cr = tx[a] * tz[b] - tz[a] * tx[b];
      const dt = tx[a] * tx[b] + tz[a] * tz[b];
      raw[i] = -Math.atan2(cr, dt) / (4 * step);
    }
    const curv = new Float32Array(N);
    const W = 4;
    for (let i = 0; i < N; i++) {
      let sum = 0;
      for (let k = -W; k <= W; k++) sum += raw[(i + k + N) % N];
      curv[i] = sum / (2 * W + 1);
    }

    // Height of the road (0 = flat). Islands lift a section of the track.
    const py = new Float32Array(N);
    const isl = def.island;
    if (isl) {
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < N; i++) {
        const d = Math.hypot(px[i] - isl.x, pz[i] - isl.z);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      const sc = best * step;
      for (let i = 0; i < N; i++) {
        let ds = Math.abs(i * step - sc);
        ds = Math.min(ds, total - ds);
        const t = clamp((ds - isl.plateau) / isl.ramp, 0, 1);
        py[i] = isl.height * (1 - t * t * (3 - 2 * t));
      }
      this.islandAlong = sc;
    }
    const slope = new Float32Array(N);
    for (let i = 0; i < N; i++) slope[i] = (py[(i + 1) % N] - py[(i - 1 + N) % N]) / (2 * step);
    // Open water: underwater there is no road edge, only the marker stones.
    const uw = def.theme.underwater;
    const open = new Uint8Array(N);
    if (uw) for (let i = 0; i < N; i++) open[i] = py[i] < uw.level - 1.5 ? 1 : 0;

    Object.assign(this, { px, pz, tx, tz, nx, nz, curv, py, slope, open });
  }

  wrapIndex(i) {
    const N = this.count;
    return ((i % N) + N) % N;
  }

  indexAt(along) {
    return this.wrapIndex(Math.round(along / this.step));
  }

  // Local nearest-sample search around a hint index. Returns projection data.
  project(x, z, hint, window = 24, out = {}) {
    const N = this.count;
    let best = hint;
    let bestD = Infinity;
    for (let k = -window; k <= window; k++) {
      const i = (hint + k + N) % N;
      const dx = x - this.px[i];
      const dz = z - this.pz[i];
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    const dx = x - this.px[best];
    const dz = z - this.pz[best];
    const ds = dx * this.tx[best] + dz * this.tz[best];
    let along = best * this.step + ds;
    if (along < 0) along += this.length;
    if (along >= this.length) along -= this.length;
    out.index = best;
    out.along = along;
    out.lateral = dx * this.nx[best] + dz * this.nz[best];
    out.y = this.py[best] + this.slope[best] * ds;
    return out;
  }

  // Full search (used for spawning / recovering a lost car).
  projectGlobal(x, z, out = {}) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < this.count; i += 2) {
      const dx = x - this.px[i];
      const dz = z - this.pz[i];
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return this.project(x, z, best, 4, out);
  }

  // Bounding box of the centre line.
  bounds() {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < this.count; i++) {
      minX = Math.min(minX, this.px[i]);
      maxX = Math.max(maxX, this.px[i]);
      minZ = Math.min(minZ, this.pz[i]);
      maxZ = Math.max(maxZ, this.pz[i]);
    }
    return { minX, maxX, minZ, maxZ };
  }
}
