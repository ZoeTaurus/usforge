// Ghost racing: your best lap on each track is saved, and a see-through
// copy of your car can drive it again next to you.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/+esm';
import { CarModel } from './carModel.js';

const KEY = 'turbo-tokens-ghost-v1-';
const STEP = 1 / 15; // samples per second
const VALS = 7; // t, x, z, y, heading, slope, lap progress

export function loadGhost(trackId) {
  try {
    const raw = localStorage.getItem(KEY + trackId);
    if (!raw) return null;
    const g = JSON.parse(raw);
    if (!g || !Array.isArray(g.f) || g.f.length < VALS * 4) return null;
    return { duration: g.d, car: g.car, frames: Float32Array.from(g.f), n: g.f.length / VALS };
  } catch {
    return null;
  }
}

function saveGhost(trackId, duration, car, frames) {
  const round = (v, k) => Math.round(v * k) / k;
  const f = [];
  for (let i = 0; i < frames.length; i += VALS) {
    f.push(round(frames[i], 1000), round(frames[i + 1], 10), round(frames[i + 2], 10), round(frames[i + 3], 100), round(frames[i + 4], 1000), round(frames[i + 5], 1000), round(frames[i + 6], 10));
  }
  try {
    localStorage.setItem(KEY + trackId, JSON.stringify({ d: duration, car, f }));
    return true;
  } catch {
    return false;
  }
}

// Records the player's laps, line to line, and keeps the fastest one.
export class GhostRecorder {
  constructor(trackId, car) {
    this.trackId = trackId;
    this.car = car;
    const best = loadGhost(trackId);
    this.best = best ? best.duration : Infinity;
    this.cur = null;
  }

  start(raceTime, respawns) {
    this.cur = { t0: raceTime, next: 0, frames: [], respawns };
  }

  sample(raceTime, car, lapProgress) {
    const c = this.cur;
    if (!c) return;
    const t = raceTime - c.t0;
    if (t < c.next) return;
    c.next = t + STEP;
    c.frames.push(t, car.x, car.z, car.y, car.heading, car.slopeAlong, lapProgress);
  }

  // Ends the lap (lapProgress: how far the car got, about one lap). True if it was a new best ghost.
  finish(raceTime, car, lapProgress) {
    const c = this.cur;
    this.cur = null;
    if (!c || c.frames.length < VALS * 4) return false;
    const duration = raceTime - c.t0;
    // Laps where the car was reset do not count.
    if (car.respawns !== c.respawns || duration >= this.best) return false;
    c.frames.push(duration, car.x, car.z, car.y, car.heading, car.slopeAlong, lapProgress);
    this.best = duration;
    return saveGhost(this.trackId, duration, this.car, c.frames);
  }
}

// The see-through car that replays the saved lap.
export class GhostCar {
  constructor(data, scene) {
    this.data = data;
    this.model = new CarModel({ ...data.car, underglow: null }, { shadows: false });
    this.materials = [];
    this.model.root.traverse((o) => {
      if (!o.isMesh) return;
      const m = o.material.clone();
      m.transparent = true;
      m.opacity = 0.35;
      m.depthWrite = false;
      if (m.emissive) {
        m.emissive.set('#9fd8ff');
        m.emissiveIntensity = 0.35;
      }
      o.material = m;
      o.castShadow = false;
      o.renderOrder = 3;
      this.materials.push(m);
    });
    this.model.root.visible = false;
    scene.add(this.model.root);
    this.t0 = null;
  }

  // Start the ghost's lap (when the player crosses the line).
  start(raceTime) {
    this.t0 = raceTime;
  }

  stop() {
    this.t0 = null;
    this.model.root.visible = false;
  }

  update(raceTime, dt, hidden = false) {
    const d = this.data;
    if (this.t0 == null || hidden) {
      this.model.root.visible = false;
      return;
    }
    const t = raceTime - this.t0;
    if (t > d.duration) {
      this.model.root.visible = false;
      return;
    }
    const f = d.frames;
    // Find the two samples around t.
    let lo = 0;
    let hi = d.n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (f[mid * VALS] <= t) lo = mid;
      else hi = mid;
    }
    const a = lo * VALS;
    const b = hi * VALS;
    const u = Math.min(1, Math.max(0, (t - f[a]) / Math.max(1e-4, f[b] - f[a])));
    const lerp = (k) => f[a + k] + (f[b + k] - f[a + k]) * u;
    let dh = f[b + 4] - f[a + 4];
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    const root = this.model.root;
    root.visible = true;
    root.position.set(lerp(1), lerp(3), lerp(2));
    root.rotation.order = 'YXZ';
    root.rotation.y = f[a + 4] + dh * u;
    root.rotation.x = -Math.atan(lerp(5));
    const speed = Math.hypot(f[b + 1] - f[a + 1], f[b + 2] - f[a + 2]) / Math.max(1e-4, f[b] - f[a]);
    this.model.animate(dt, speed, 0, 0, 0, false);
  }

  // How far ahead (-) or behind (+) of the ghost the player is, in seconds.
  gap(raceTime, lapProgress) {
    if (this.t0 == null) return null;
    const d = this.data;
    const f = d.frames;
    if (lapProgress <= f[6] || lapProgress >= f[(d.n - 1) * VALS + 6]) return null;
    let lo = 0;
    let hi = d.n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (f[mid * VALS + 6] <= lapProgress) lo = mid;
      else hi = mid;
    }
    const a = lo * VALS;
    const b = hi * VALS;
    const u = (lapProgress - f[a + 6]) / Math.max(1e-4, f[b + 6] - f[a + 6]);
    const ghostT = f[a] + (f[b] - f[a]) * Math.min(1, Math.max(0, u));
    return raceTime - this.t0 - ghostT;
  }

  dispose() {
    this.model.dispose();
    for (const m of this.materials) m.dispose();
  }
}
