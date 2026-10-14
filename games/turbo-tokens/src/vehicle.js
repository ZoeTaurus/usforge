// Arcade car physics and the AI drivers.
import { clamp, damp, wrapAngle } from './utils.js';

const BRAKE = 30;
const REVERSE_ACCEL = 9;
const REVERSE_MAX = 14;
const HIGH_SPEED_REF = 50; // steering gets lazier as speed approaches this

export class Vehicle {
  constructor({ name, stats, model, isPlayer = false, color = '#fff' }) {
    this.name = name;
    this.stats = stats;
    this.model = model;
    this.isPlayer = isPlayer;
    this.color = color;
    this.halfWidth = model ? model.width / 2 : 1;
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.heading = 0;
    this.slopeAlong = 0; // road gradient in the car's direction (+ = uphill)
    this.vx = 0;
    this.vz = 0;
    this.speed = 0;
    this.slip = 0;
    this.steer = 0;
    this.yawRate = 0;
    this.accelLong = 0;
    this.nitro = 1;
    this.boosting = false;
    this.offroad = false;
    this.trackIdx = 0;
    this.along = 0;
    this.lateral = 0;
    this.progress = 0;
    this.lapsCompleted = 0;
    this.lapStart = 0;
    this.lapTimes = [];
    this.bestLap = Infinity;
    this.finished = false;
    this.finishTime = Infinity;
    this.wallHits = 0;
    this.impact = 0;
    this.ghost = 0;
    this.stuck = 0;
    this.wrongWay = 0;
    this.drifting = false;
    this.driftDir = 0;
    this.driftAngle = 0;
    this.postDrift = 0;
    this.launchBoost = 0;
    this.ctrl = { throttle: 0, brake: 0, reverse: true, steer: 0, handbrake: false, nitro: false };
  }

  place(path, along, lateral) {
    const i = path.indexAt(along);
    this.x = path.px[i] + path.nx[i] * lateral;
    this.z = path.pz[i] + path.nz[i] * lateral;
    this.heading = Math.atan2(path.tx[i], path.tz[i]);
    this.vx = this.vz = 0;
    this.speed = 0;
    this.slip = 0;
    this.trackIdx = i;
    const p = path.project(this.x, this.z, i, 4);
    this.along = p.along;
    this.lateral = p.lateral;
    this.y = p.y;
  }

  // Put the car back on the racing line (used for respawns).
  respawn(path) {
    const i = path.wrapIndex(this.trackIdx - 4);
    const lat = clamp(this.lateral, -path.halfWidth + 2, path.halfWidth - 2) * 0.5;
    this.x = path.px[i] + path.nx[i] * lat;
    this.z = path.pz[i] + path.nz[i] * lat;
    this.heading = Math.atan2(path.tx[i], path.tz[i]);
    this.vx = this.vz = 0;
    this.speed = 0;
    this.ghost = 2;
    this.stuck = 0;
    this.trackIdx = i;
    this.respawns = (this.respawns || 0) + 1;
  }

  step(dt, c, path, surfaceGrip) {
    const s = this.stats;
    const sinH = Math.sin(this.heading);
    const cosH = Math.cos(this.heading);
    let vf = this.vx * sinH + this.vz * cosH;
    let vl = this.vx * cosH - this.vz * sinH;

    // Drift mode: hold the drift button while turning at speed.
    if (!this.drifting && c.handbrake && vf > 11 && Math.abs(c.steer) > 0.2 && !this.offroad) {
      this.drifting = true;
      this.driftDir = Math.sign(c.steer);
    }
    if (this.drifting && (!c.handbrake || vf < 7 || this.offroad)) this.endDrift();
    if (this.drifting) {
      this.driftStep(dt, c, path);
      return;
    }
    this.driftAngle = 0;
    if (this.postDrift > 0) this.postDrift -= dt;

    // Nitro (a perfect start gives a free boost).
    this.updateNitro(dt, c, vf > 3);

    const offMul = this.offroad ? s.offroad : 1;
    const vmax = s.maxSpeed * offMul * (this.boosting ? s.nitroPower : 1);
    let a = 0;
    if (c.throttle > 0 && !(c.brake > 0 && vf > 0.5)) {
      if (vf < -0.5) a = BRAKE;
      else if (vf < vmax) a = s.accel * (this.boosting ? 1.6 : 1) * Math.pow(1 - vf / vmax, 0.5) * c.throttle;
      else a = -(vf - vmax) * 1.4;
    } else if (c.brake > 0) {
      if (vf > 0.5) a = -BRAKE * c.brake;
      else if (c.reverse) a = vf > -REVERSE_MAX ? -REVERSE_ACCEL : 0;
      else a = -Math.sign(vf) * Math.min(Math.abs(vf) / dt, BRAKE); // hold the car still
    } else {
      const drag = 2.5 + 0.0025 * vf * vf + (this.offroad ? 5 : 0);
      a = -Math.sign(vf) * Math.min(Math.abs(vf) / dt, drag);
      if (vf > vmax) a = -(vf - vmax) * 1.4;
    }
    if (c.handbrake) a -= Math.sign(vf) * Math.min(Math.abs(vf) / dt, 6);
    if (this.launchBoost > 0 && c.throttle > 0) a += 8;
    a -= 5.4 * this.slopeAlong; // gravity on hills
    vf += a * dt;
    if (vf < -REVERSE_MAX) vf = -REVERSE_MAX;

    // Steering: smoothed input, limited at low speed, lazier at high speed.
    this.steer += (c.steer - this.steer) * damp(this.isPlayer ? 9 : 12, dt);
    const spd = Math.abs(vf);
    const low = Math.min(1, spd / 6);
    const high = 1 - 0.45 * Math.min(1.25, spd / HIGH_SPEED_REF);
    let yaw = this.steer * s.steer * low * high * (vf >= 0 ? 1 : -1);
    if (c.handbrake && spd > 8) yaw *= 1.45;

    // Lateral grip: bleeds off sideways velocity. Low grip = drifting.
    // Rally tyres cope better with slippery surfaces like snow.
    const surface = surfaceGrip < 1 ? Math.min(1, surfaceGrip * (s.iceGrip || 1)) : surfaceGrip;
    const grip = s.grip * surface * (c.handbrake ? 0.2 : 1) * (this.offroad ? 0.75 : 1) * (this.postDrift > 0 ? 0.45 : 1);
    vl *= Math.exp(-grip * dt);

    // Drifting refills the nitro tank.
    if (Math.abs(vl) > 3.5 && spd > 12) this.nitro = Math.min(1, this.nitro + 0.16 * dt);

    this.yawRate = yaw;
    this.heading += yaw * dt;
    this.vx = sinH * vf + cosH * vl;
    this.vz = cosH * vf - sinH * vl;
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.speed = vf;
    this.slip = vl;
    this.accelLong = a;
    if (this.ghost > 0) this.ghost -= dt;

    this.collideTrack(path);
  }

  updateNitro(dt, c, canBoost, extraRecharge = 0) {
    const s = this.stats;
    if (this.launchBoost > 0) {
      this.launchBoost -= dt;
      this.boosting = true;
      return;
    }
    this.boosting = c.nitro && this.nitro > 0.01 && canBoost;
    if (this.boosting) this.nitro = Math.max(0, this.nitro - s.nitroDrain * dt);
    else this.nitro = Math.min(1, this.nitro + (s.nitroRecharge + extraRecharge) * dt);
  }

  endDrift() {
    this.drifting = false;
    this.driftAngle = 0;
    this.postDrift = 0.35;
  }

  // Arcade drift: the path keeps its speed and curves with the steering,
  // while the nose swings out at an angle the player controls.
  driftStep(dt, c, path) {
    const s = this.stats;
    this.updateNitro(dt, c, true, 0.22);
    let v = Math.hypot(this.vx, this.vz);
    let th = Math.atan2(this.vx, this.vz);
    this.steer += (c.steer - this.steer) * damp(9, dt);
    const dir = this.driftDir;
    const into = clamp(dir * this.steer, -1, 1); // +1 = steering into the turn, -1 = counter-steer
    const rate = s.steer * (1 - 0.3 * Math.min(1.2, v / HIGH_SPEED_REF));
    th += dir * rate * (0.55 + 0.45 * into) * dt;

    const vmax = s.maxSpeed * (this.boosting ? s.nitroPower : 1) * 0.94;
    let a;
    if (c.brake > 0) a = -BRAKE * 0.6;
    else if (c.throttle > 0) a = v < vmax ? s.accel * 0.5 * (this.boosting ? 1.6 : 1) * (1 - v / vmax) : -(v - vmax);
    else a = -4;
    a -= 1.2 + 5.4 * this.slopeAlong; // tyre scrub + gravity
    v = Math.max(0, v + a * dt);

    const beta = dir * (0.42 + 0.26 * into);
    const prev = this.heading;
    this.heading += wrapAngle(th + beta - this.heading) * damp(6, dt);
    this.yawRate = wrapAngle(this.heading - prev) / dt;
    this.vx = Math.sin(th) * v;
    this.vz = Math.cos(th) * v;
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    const sinH = Math.sin(this.heading);
    const cosH = Math.cos(this.heading);
    this.speed = this.vx * sinH + this.vz * cosH;
    this.slip = this.vx * cosH - this.vz * sinH;
    this.driftAngle = Math.abs(wrapAngle(this.heading - th));
    this.accelLong = a;
    if (this.ghost > 0) this.ghost -= dt;
    this.collideTrack(path);
    if (this.impact > 4) this.endDrift();
  }

  collideTrack(path) {
    const pr = path.project(this.x, this.z, this.trackIdx, 30, _proj);
    this.trackIdx = pr.index;
    this.along = pr.along;
    this.lateral = pr.lateral;
    this.y = pr.y;
    const ti = pr.index;
    this.slopeAlong = path.slope[ti] * (Math.sin(this.heading) * path.tx[ti] + Math.cos(this.heading) * path.tz[ti]);
    const limit = path.wallDist - this.halfWidth;
    if (Math.abs(pr.lateral) > limit) {
      const i = pr.index;
      const sg = Math.sign(pr.lateral);
      const nx = path.nx[i] * sg;
      const nz = path.nz[i] * sg;
      const pen = Math.abs(pr.lateral) - limit;
      this.x -= nx * pen;
      this.z -= nz * pen;
      const vn = this.vx * nx + this.vz * nz;
      if (vn > 0) {
        this.vx -= nx * vn * 1.3;
        this.vz -= nz * vn * 1.3;
        this.vx *= 0.985;
        this.vz *= 0.985;
        this.impact = Math.max(this.impact, vn);
        // Gently steer the car's nose away from the wall.
        const along = Math.atan2(path.tx[i], path.tz[i]);
        const fwd = Math.cos(wrapAngle(this.heading - along)) >= 0 ? along : along + Math.PI;
        this.heading += wrapAngle(fwd - this.heading) * Math.min(1, vn * 0.02);
      }
      this.lateral = sg * limit;
    }
    this.offroad = Math.abs(this.lateral) > path.halfWidth + 0.6 && !path.open[ti];
  }
}
const _proj = {};

// Fastest comfortable speed at each point of the track for an AI car.
export function speedProfile(path, stats, surfaceGrip) {
  const N = path.count;
  const v = new Float32Array(N);
  const S = stats.steer * 0.9;
  const k = 0.45 / HIGH_SPEED_REF;
  const surface = surfaceGrip < 1 ? Math.min(1, surfaceGrip * (stats.iceGrip || 1)) : surfaceGrip;
  const gripF = 0.55 + 0.45 * surface;
  for (let i = 0; i < N; i++) {
    const R = 1 / Math.max(Math.abs(path.curv[i]), 1e-4);
    const vm = ((R * S) / (1 + k * R * S)) * gripF;
    v[i] = Math.min(vm, stats.maxSpeed);
  }
  const decel = 17 * (0.6 + 0.4 * surface);
  for (let pass = 0; pass < 2; pass++) {
    for (let i = N - 1; i >= 0; i--) {
      const j = (i + 1) % N;
      const lim = Math.sqrt(v[j] * v[j] + 2 * decel * path.step);
      if (v[i] > lim) v[i] = lim;
    }
  }
  return v;
}

const DEFAULT_STYLE = { corner: 0.86, slowDown: 0.1, catchUp: 0.06, nitro: 1 };

export class AIDriver {
  // `style` comes from the difficulty setting (see DIFFICULTIES in state.js).
  constructor(car, path, profile, skill, rand, style = DEFAULT_STYLE) {
    this.style = style;
    this.car = car;
    this.path = path;
    this.profile = profile;
    this.skill = skill;
    this.rand = rand;
    this.lane = (rand() * 2 - 1) * (path.halfWidth - 3);
    this.laneTarget = this.lane;
    this.laneTimer = 2 + rand() * 4;
    this.nitroHappy = (0.3 + rand() * 0.7) * style.nitro;
    this.reverseTimer = 0;
  }

  think(dt, cars, leaderGap = 0) {
    const car = this.car;
    const path = this.path;
    const hw = path.halfWidth;
    const v = car.speed;
    const ctrl = car.ctrl;

    // Wander between lanes now and then.
    this.laneTimer -= dt;
    if (this.laneTimer <= 0) {
      this.laneTimer = 3 + this.rand() * 5;
      this.laneTarget = (this.rand() * 2 - 1) * (hw - 3);
    }
    // Avoid the car directly ahead.
    for (const o of cars) {
      if (o === car) continue;
      const ahead = o.progress - car.progress;
      if (ahead > 0 && ahead < 16 + Math.max(0, v - o.speed) * 0.8) {
        const dl = car.lateral - o.lateral;
        if (Math.abs(dl) < 2.8) {
          const dir = dl === 0 ? (this.lane > 0 ? 1 : -1) : Math.sign(dl);
          let tgt = o.lateral + dir * 3.4;
          if (Math.abs(tgt) > hw - 1.8) tgt = o.lateral - dir * 3.4;
          this.laneTarget = clamp(tgt, -(hw - 1.8), hw - 1.8);
          this.laneTimer = 1.5;
        }
      }
    }
    this.lane += (this.laneTarget - this.lane) * damp(1.2, dt);

    const look = 7 + Math.abs(v) * 0.42;
    const ti = path.wrapIndex(car.trackIdx + Math.round(look / path.step));
    const inside = clamp(path.curv[ti] * 320, -4, 4);
    const off = clamp(this.lane + inside, -(hw - 1.6), hw - 1.6);
    const tx = path.px[ti] + path.nx[ti] * off;
    const tz = path.pz[ti] + path.nz[ti] * off;
    const desired = Math.atan2(tx - car.x, tz - car.z);
    const diff = wrapAngle(desired - car.heading);

    // Rubber-banding keeps the pack together.
    let skill = this.skill;
    const st = this.style;
    if (leaderGap > 60) skill *= 1 - Math.min(st.slowDown, (leaderGap - 60) / 1500);
    else if (leaderGap < -60) skill *= 1 + Math.min(st.catchUp, (-leaderGap - 60) / 1500);

    const pk = path.wrapIndex(car.trackIdx + Math.round((5 + Math.max(0, v) * 0.3) / path.step));
    // Skill mostly limits straight-line speed; corners are taken near the limit.
    const lim = Math.min(this.profile[pk], this.profile[car.trackIdx] * 1.05);
    const target = Math.min(lim * (st.corner + (1 - st.corner) * skill), car.stats.maxSpeed * skill);

    // Recover when facing the wrong way.
    if (Math.abs(diff) > 1.7 && Math.abs(v) < 6) this.reverseTimer = 1.2;
    if (this.reverseTimer > 0) {
      this.reverseTimer -= dt;
      ctrl.throttle = 0;
      ctrl.brake = 1;
      ctrl.steer = -Math.sign(diff);
      ctrl.nitro = false;
      ctrl.handbrake = false;
      ctrl.reverse = true;
      return ctrl;
    }

    ctrl.steer = clamp(diff * 2.4, -1, 1);
    ctrl.throttle = v < target ? 1 : 0;
    ctrl.brake = v > target + 2.5 ? 1 : 0;
    ctrl.handbrake = false;
    ctrl.reverse = true;
    const straight = this.profile[pk] >= car.stats.maxSpeed * 0.98 && Math.abs(diff) < 0.1;
    ctrl.nitro = straight && car.nitro > 0.25 && this.nitroHappy > 0.5 && skill > this.skill * 0.97;
    return ctrl;
  }
}
