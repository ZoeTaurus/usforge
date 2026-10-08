'use strict';
// ---------------------------------------------------------------------------
// Skeleton rig: poses, interpolation, forward kinematics, IK feet and the
// cartoon body renderer.
//
// Angle conventions (degrees, character facing right, screen y down):
//   limbs (fs/bs shoulders, fh/bh hips): direction measured from straight
//     DOWN, positive rotates toward FORWARD (+x). 0 = hanging, 90 = forward,
//     180 = straight up.
//   fe/be (elbows): bend added to the upper arm angle (+ = forearm curls up).
//   fk/bk (knees): bend subtracted from the thigh angle (+ = natural bend).
//   t (torso) / hd (head, relative to torso): 0 = upright, + = lean forward.
//   r: whole body rotation around the torso center, + = forward (flips).
//   lf / lb: IK feet [x from root, lift] — when given, the leg is solved so
//     the foot lands exactly there (feet stay planted). d = hip drop.
// ---------------------------------------------------------------------------

const POSE_NUM = ['x', 'y', 'r', 't', 'hd', 'fs', 'fe', 'bs', 'be', 'fh', 'fk', 'bh', 'bk', 'd', 'sq', 'w', 'wB', 'ext', 'extB', 'fa', 'ba', 'p1', 'p2', 'p3', 'p4'];
const POSE_DEF = { x: 0, y: 0, r: 0, t: 0, hd: 0, fs: 0, fe: 0, bs: 0, be: 0, fh: 0, fk: 0, bh: 0, bk: 0, d: 0, sq: 1, w: 0, wB: 0, ext: 1, extB: 1, fa: 0, ba: 0, p1: 0, p2: 0, p3: 0, p4: 0 };
const POSE_DISCRETE = ['face', 'hand', 'handB', 'prop', 'eyes', 'mouth', 'fx'];

const Rig = {
  // ---- pose math ----------------------------------------------------------
  // Leg angles (deg) for a pose, solving IK legs when necessary.
  legAngles(C, P) {
    const b = C.body, ls = C.legScale;
    const hx = P.x || 0;
    const hy = Rig._hipY(C, P);
    const res = [P.fh || 0, P.fk || 0, P.bh || 0, P.bk || 0];
    if (P.lf) {
      const s = Rig._ik(hx, hy, P.lf[0] * ls, -b.footR - P.lf[1] * ls, b.thigh, b.shin);
      res[0] = s[0] / D2R;
      res[1] = (s[0] - s[1]) / D2R;
    }
    if (P.lb) {
      const s = Rig._ik(hx, hy, P.lb[0] * ls, -b.footR - P.lb[1] * ls, b.thigh, b.shin);
      res[2] = s[0] / D2R;
      res[3] = (s[0] - s[1]) / D2R;
    }
    return res;
  },

  _hipY(C, P) {
    const b = C.body, ls = C.legScale;
    const L = b.thigh + b.shin;
    let hy = -(L + b.footR) + (P.d || 0) * ls;
    const hx = P.x || 0;
    const clampFoot = (ft) => {
      if (!ft || ft[1] > 0.01) return;
      const fx = ft[0] * ls, fy = -b.footR;
      const dx = fx - hx;
      const maxD = L - 0.6;
      const need = Math.sqrt(Math.max(0, maxD * maxD - dx * dx));
      if (fy - hy > need) hy = fy - need;
    };
    clampFoot(P.lf);
    clampFoot(P.lb);
    return hy;
  },

  // 2-bone IK, returns [thighAngle, shinAngle] in radians (from-down convention)
  _ik(hx, hy, tx, ty, a, b) {
    const dx = tx - hx, dy = ty - hy;
    let d = Math.hypot(dx, dy);
    const maxd = a + b - 0.01, mind = Math.abs(a - b) + 0.5;
    d = U.clamp(d, mind, maxd);
    const th = Math.atan2(dx, dy);
    const cosA = (a * a + d * d - b * b) / (2 * a * d);
    const al = Math.acos(U.clamp(cosA, -1, 1));
    const thigh = th + al;
    const kx = hx + a * Math.sin(thigh), ky = hy + a * Math.cos(thigh);
    const shin = Math.atan2(tx - kx, ty - ky);
    return [thigh, shin];
  },

  // Interpolate two poses. Handles IK/angle leg mixing.
  lerp(C, a, b, t) {
    const o = {};
    for (let i = 0; i < POSE_NUM.length; i++) {
      const k = POSE_NUM[i];
      const va = a[k] !== undefined ? a[k] : C.poseDef[k];
      const vb = b[k] !== undefined ? b[k] : C.poseDef[k];
      o[k] = va + (vb - va) * t;
    }
    const legsA = (a.lf && !b.lf) || (a.lb && !b.lb) ? Rig.legAngles(C, a) : null;
    const legsB = (b.lf && !a.lf) || (b.lb && !a.lb) ? Rig.legAngles(C, b) : null;
    // front leg
    if (a.lf && b.lf) {
      o.lf = [a.lf[0] + (b.lf[0] - a.lf[0]) * t, a.lf[1] + (b.lf[1] - a.lf[1]) * t];
    } else if (a.lf || b.lf) {
      const fa = a.lf ? legsA : [a.fh || 0, a.fk || 0];
      const fb = b.lf ? legsB : [b.fh || 0, b.fk || 0];
      o.fh = fa[0] + (fb[0] - fa[0]) * t;
      o.fk = fa[1] + (fb[1] - fa[1]) * t;
    }
    if (a.lb && b.lb) {
      o.lb = [a.lb[0] + (b.lb[0] - a.lb[0]) * t, a.lb[1] + (b.lb[1] - a.lb[1]) * t];
    } else if (a.lb || b.lb) {
      const fa = a.lb ? [legsA[2], legsA[3]] : [a.bh || 0, a.bk || 0];
      const fb = b.lb ? [legsB[2], legsB[3]] : [b.bh || 0, b.bk || 0];
      o.bh = fa[0] + (fb[0] - fa[0]) * t;
      o.bk = fa[1] + (fb[1] - fa[1]) * t;
    }
    for (let i = 0; i < POSE_DISCRETE.length; i++) {
      const k = POSE_DISCRETE[i];
      const v = t < 0.5 ? a[k] : b[k];
      if (v !== undefined) o[k] = v;
    }
    return o;
  },

  // ---- forward kinematics ----------------------------------------------------
  // Returns joints in the character's local space: origin at the ground point
  // under the fighter, facing right, y down.
  solve(C, P, grounded) {
    const b = C.body, ls = C.legScale;
    const J = {};
    const hx = P.x || 0;
    let hy = Rig._hipY(C, P);
    const sin = Math.sin, cos = Math.cos;

    // torso / head
    const ta = (P.t || 0) * D2R;
    const neck = [hx + sin(ta) * b.torso, hy - cos(ta) * b.torso];
    const sd = b.torso - b.shoulderDrop;
    const sh = [hx + sin(ta) * sd, hy - cos(ta) * sd];
    const ha = ((P.t || 0) + (P.hd || 0)) * D2R;
    // the head is drawn smaller than it is measured: headHurt keeps the full size
    const hs = C.headScale || 1;
    const hr = b.neck + b.headR * 0.82, hrD = b.neck + b.headR * 0.82 * hs;
    const headHurt = [neck[0] + sin(ha) * hr, neck[1] - cos(ha) * hr];
    const head = [neck[0] + sin(ha) * hrD, neck[1] - cos(ha) * hrD];

    // arms
    const ext = P.ext !== undefined ? P.ext : 1, extB = P.extB !== undefined ? P.extB : 1;
    const ofs = b.shoulderOfs || 0;
    const sF = [sh[0] + ofs * cos(ta), sh[1] + ofs * sin(ta)];
    const sB = [sh[0] - ofs * cos(ta), sh[1] - ofs * sin(ta)];
    const fs = (P.fs || 0) * D2R, fe = ((P.fs || 0) + (P.fe || 0)) * D2R;
    const bs = (P.bs || 0) * D2R, be = ((P.bs || 0) + (P.be || 0)) * D2R;
    const eF = [sF[0] + sin(fs) * b.uArm * ext, sF[1] + cos(fs) * b.uArm * ext];
    const hF = [eF[0] + sin(fe) * b.fArm * ext, eF[1] + cos(fe) * b.fArm * ext];
    const eB = [sB[0] + sin(bs) * b.uArm * extB, sB[1] + cos(bs) * b.uArm * extB];
    const hB = [eB[0] + sin(be) * b.fArm * extB, eB[1] + cos(be) * b.fArm * extB];

    // legs
    const hip = [hx, hy];
    const hipOfs = b.hipOfs || 0;
    const hipF = [hx + hipOfs, hy], hipB = [hx - hipOfs, hy];
    const leg = (ft, hAng, kAng, ank, hp) => {
      let th, shn, lift = 0;
      if (ft) {
        const s = Rig._ik(hp[0], hp[1], ft[0] * ls, -b.footR - ft[1] * ls, b.thigh, b.shin);
        th = s[0];
        shn = s[1];
        lift = ft[1];
      } else {
        th = hAng * D2R;
        shn = (hAng - kAng) * D2R;
        lift = 99;
      }
      const k = [hp[0] + sin(th) * b.thigh, hp[1] + cos(th) * b.thigh];
      const a = [k[0] + sin(shn) * b.shin, k[1] + cos(shn) * b.shin];
      // planted feet stay flat, lifted feet follow the shin
      const flatT = U.clamp(lift / 14, 0, 1);
      let fa = shn + Math.PI / 2 + ank * D2R;
      const flat = Math.PI / 2 + ank * D2R * 0.3;
      fa = flat + (fa - flat) * flatT;
      const toe = [a[0] + sin(fa) * b.footL, a[1] + cos(fa) * b.footL];
      return [k, a, toe];
    };
    const LF = leg(P.lf, P.fh || 0, P.fk || 0, P.fa || 0, hipF);
    const LB = leg(P.lb, P.bh || 0, P.bk || 0, P.ba || 0, hipB);

    J.hip = hip; J.neck = neck; J.head = head; J.headHurt = headHurt; J.sh = sh;
    J.sF = sF; J.eF = eF; J.hF = hF; J.sB = sB; J.eB = eB; J.hB = hB;
    J.hipF = hipF; J.hipB = hipB;
    J.kF = LF[0]; J.aF = LF[1]; J.tF = LF[2];
    J.kB = LB[0]; J.aB = LB[1]; J.tB = LB[2];
    J.ta = ta; J.ha = ha;
    J.fe = fe; J.be = be; J.fs = fs; J.bs = bs;

    // weapon (held in the front hand, angle relative to the forearm)
    if (C.weapon) {
      const wa = fe + (P.w !== undefined ? P.w : C.weapon.w) * D2R;
      const wl = C.weapon.len, wb = C.weapon.back || 0;
      J.wTip = [hF[0] + sin(wa) * wl, hF[1] + cos(wa) * wl];
      J.wEnd = [hF[0] - sin(wa) * wb, hF[1] - cos(wa) * wb];
      J.wa = wa;
    }
    if (C.weaponB) {
      const wa = be + (P.wB !== undefined ? P.wB : C.weaponB.w) * D2R;
      const wl = C.weaponB.len, wb = C.weaponB.back || 0;
      J.wbTip = [hB[0] + sin(wa) * wl, hB[1] + cos(wa) * wl];
      J.wbEnd = [hB[0] - sin(wa) * wb, hB[1] - cos(wa) * wb];
      J.wba = wa;
    }

    const PTS = Rig.PTS;
    // whole-body rotation around the torso center
    const r = (P.r || 0) * D2R;
    if (r !== 0) {
      const px = (hip[0] + neck[0]) / 2, py = (hip[1] + neck[1]) / 2;
      const cr = Math.cos(r), sr = Math.sin(r);
      for (let i = 0; i < PTS.length; i++) {
        const p = J[PTS[i]];
        if (!p) continue;
        const dx = p[0] - px, dy = p[1] - py;
        p[0] = px + dx * cr - dy * sr;
        p[1] = py + dx * sr + dy * cr;
      }
      J.ta += r;
      J.ha += r;
      J.fe -= r; J.be -= r; J.fs -= r; J.bs -= r;
      if (J.wa !== undefined) J.wa -= r;
      if (J.wba !== undefined) J.wba -= r;
    }

    // auto-ground: if no foot is planted by IK, drop the body so its lowest
    // point touches the floor.
    const planted = (P.lf && P.lf[1] < 0.5) || (P.lb && P.lb[1] < 0.5);
    let shift = 0;
    if (grounded && (!planted || r !== 0)) {
      let maxY = -1e9;
      const chk = (p, rad) => {
        if (p && p[1] + rad > maxY) maxY = p[1] + rad;
      };
      chk(J.aF, b.footR); chk(J.aB, b.footR); chk(J.tF, b.footR * 0.8); chk(J.tB, b.footR * 0.8);
      chk(J.kF, b.legR[1]); chk(J.kB, b.legR[1]);
      chk(J.hip, b.torsoW[0] * 0.45); chk(J.neck, b.torsoW[1] * 0.45);
      chk(J.head, b.headR * hs * 0.95);
      chk(J.hF, b.handR); chk(J.hB, b.handR);
      chk(J.eF, b.armR[1]); chk(J.eB, b.armR[1]);
      shift = -maxY;
    }
    shift += P.y || 0;
    if (shift !== 0) {
      for (let i = 0; i < PTS.length; i++) {
        const p = J[PTS[i]];
        if (p) p[1] += shift;
      }
    }
    J.P = P;
    return J;
  },

  PTS: ['hip', 'neck', 'head', 'headHurt', 'sh', 'sF', 'eF', 'hF', 'sB', 'eB', 'hB', 'hipF', 'hipB', 'kF', 'aF', 'tF', 'kB', 'aB', 'tB', 'wTip', 'wEnd', 'wbTip', 'wbEnd'],

  // Hurt capsules in local space: [ax, ay, bx, by, r]
  hurtCapsules(C, J) {
    const b = C.hurtBody || C.body;
    const s = 0.92;
    const caps = [
      [J.hip[0], J.hip[1], J.neck[0], J.neck[1], C.body.torsoW[1] * 0.5 * s],
      [J.headHurt[0], J.headHurt[1], J.headHurt[0], J.headHurt[1], b.headR * s],
      [J.sF[0], J.sF[1], J.eF[0], J.eF[1], b.armR[0] * s],
      [J.eF[0], J.eF[1], J.hF[0], J.hF[1], b.armR[1] * s],
      [J.sB[0], J.sB[1], J.hB[0], J.hB[1], b.armR[1] * s],
      [J.hipF[0], J.hipF[1], J.kF[0], J.kF[1], b.legR[0] * s],
      [J.kF[0], J.kF[1], J.aF[0], J.aF[1], b.legR[1] * s],
      [J.hipB[0], J.hipB[1], J.kB[0], J.kB[1], b.legR[0] * s],
      [J.kB[0], J.kB[1], J.aB[0], J.aB[1], b.legR[1] * s],
      [J.aF[0], J.aF[1], J.tF[0], J.tF[1], C.body.footR],
      [J.aB[0], J.aB[1], J.tB[0], J.tB[1], C.body.footR],
    ];
    if (C.extraHurt) C.extraHurt(J, caps);
    return caps;
  },

  // Capsule for a named limb (for hitboxes). Returns [ax, ay, bx, by].
  limbSeg(J, name) {
    switch (name) {
      case 'handF': return [J.eF[0], J.eF[1], J.hF[0], J.hF[1]];
      case 'handB': return [J.eB[0], J.eB[1], J.hB[0], J.hB[1]];
      case 'armF': return [J.sF[0], J.sF[1], J.hF[0], J.hF[1]];
      case 'armB': return [J.sB[0], J.sB[1], J.hB[0], J.hB[1]];
      case 'footF': return [J.kF[0], J.kF[1], J.tF[0], J.tF[1]];
      case 'footB': return [J.kB[0], J.kB[1], J.tB[0], J.tB[1]];
      case 'shinF': return [J.kF[0], J.kF[1], J.aF[0], J.aF[1]];
      case 'shinB': return [J.kB[0], J.kB[1], J.aB[0], J.aB[1]];
      case 'kneeF': return [J.hipF[0], J.hipF[1], J.kF[0], J.kF[1]];
      case 'kneeB': return [J.hipB[0], J.hipB[1], J.kB[0], J.kB[1]];
      case 'legF': return [J.hipF[0], J.hipF[1], J.tF[0], J.tF[1]];
      case 'head': return [J.head[0], J.head[1], J.head[0], J.head[1]];
      case 'body': return [J.hip[0], J.hip[1], J.neck[0], J.neck[1]];
      case 'weapon': return [J.hF[0], J.hF[1], J.wTip[0], J.wTip[1]];
      case 'weaponTip': {
        const mx = J.hF[0] + (J.wTip[0] - J.hF[0]) * 0.55, my = J.hF[1] + (J.wTip[1] - J.hF[1]) * 0.55;
        return [mx, my, J.wTip[0], J.wTip[1]];
      }
      case 'weaponB': return [J.hB[0], J.hB[1], J.wbTip[0], J.wbTip[1]];
      default: return [J.hip[0], J.hip[1], J.neck[0], J.neck[1]];
    }
  },

  // ---- rendering -------------------------------------------------------------
  // Draws a two-segment limb: outline pass then fill pass so joints look seamless.
  limb(ctx, a, b, c, ra, rb, rc, colA, colB, lw, ink = INK) {
    if (!Sketch.active) {
      ctx.fillStyle = ink;
      ctx.beginPath();
      Draw.taper(ctx, a[0], a[1], ra + lw, b[0], b[1], rb + lw);
      Draw.taper(ctx, b[0], b[1], rb + lw, c[0], c[1], rc + lw);
      ctx.fill();
    }
    ctx.fillStyle = colA;
    ctx.beginPath();
    Draw.taper(ctx, a[0], a[1], ra, b[0], b[1], rb);
    ctx.fill();
    ctx.fillStyle = colB;
    ctx.beginPath();
    Draw.taper(ctx, b[0], b[1], rb, c[0], c[1], rc);
    ctx.fill();
    if (Sketch.active) {
      Sketch.limbMark(ctx, a, b, ra, rb, Sketch.shapes++, colA);
      Sketch.limbMark(ctx, b, c, rb, rc, Sketch.shapes++, colB);
      Sketch.joint(ctx, a, b, c, rb);
    }
  },

  // A colored band along segment b->c between fractions t0..t1 (cuffs, socks)
  band(ctx, b, c, rb, rc, t0, t1, col, lw, ink = INK) {
    const p0 = [b[0] + (c[0] - b[0]) * t0, b[1] + (c[1] - b[1]) * t0];
    const p1 = [b[0] + (c[0] - b[0]) * t1, b[1] + (c[1] - b[1]) * t1];
    const r0 = rb + (rc - rb) * t0 + 0.6, r1 = rb + (rc - rb) * t1 + 0.6;
    ctx.beginPath();
    Draw.taper(ctx, p0[0], p0[1], r0, p1[0], p1[1], r1);
    ctx.fillStyle = col;
    ctx.fill();
    if (lw > 0) {
      ctx.lineWidth = lw * 0.6;
      ctx.strokeStyle = ink;
      ctx.stroke();
    }
  },

  drawArm(ctx, f, J, side, pal) {
    const C = f.C, b = C.body;
    const back = side === 'B';
    const P = J.P;
    const s = back ? J.sB : J.sF, e = back ? J.eB : J.eF, h = back ? J.hB : J.hF;
    const cols = C.armCols;
    const pc = back ? pal.dark : pal;
    const lw = C.lw;
    if (C.draw.arm) {
      C.draw.arm(ctx, f, J, side, pc, pal);
      return;
    }
    const r0 = b.armR[0], r1 = b.armR[1], r2 = b.armR[2];
    Rig.limb(ctx, s, e, h, r0, r1, r2, pc[cols[0]], pc[cols[1]], lw, pal.ink);
    if (C.cuff) Rig.band(ctx, e, h, r1, r2, C.cuff[0], C.cuff[1], pc[C.cuff[2]], lw, pal.ink);
    const hs = back ? P.handB || C.handDef : P.hand || C.handDef;
    if (hs !== 'none') Rig.drawHand(ctx, f, J, e, h, hs, pc[cols[2]], pal, back);
  },

  drawHand(ctx, f, J, e, h, style, col, pal, back) {
    const C = f.C, r = C.body.handR;
    if (C.draw.hand) {
      C.draw.hand(ctx, f, J, e, h, style, col, pal, back);
      return;
    }
    const ang = Math.atan2(h[1] - e[1], h[0] - e[0]);
    ctx.save();
    ctx.translate(h[0], h[1]);
    ctx.rotate(ang);
    if (style === 'open') {
      Draw.ellipse(ctx, r * 0.35, 0, r * 1.15, r * 0.85, 0, col, C.lw, pal.ink);
      Draw.ellipse(ctx, r * 0.2, -r * 0.85, r * 0.42, r * 0.3, -0.5, col, C.lw * 0.7, pal.ink);
    } else {
      Draw.circle(ctx, r * 0.15, 0, r, col, C.lw, pal.ink);
      // knuckles, the fingers curled under them and a thumb
      ctx.lineWidth = C.lw * 0.5;
      ctx.strokeStyle = pal.ink;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(r * 0.15, 0, r * 0.55, -0.9, 0.9);
      ctx.stroke();
      ctx.beginPath();
      for (const y of [-0.42, 0, 0.42]) {
        ctx.moveTo(r * 0.72, y * r);
        ctx.lineTo(r * 1.08, y * r * 1.12);
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.45, -r * 0.55);
      ctx.quadraticCurveTo(r * 0.2, -r * 0.95, r * 0.62, -r * 0.42);
      ctx.stroke();
    }
    ctx.restore();
  },

  drawLeg(ctx, f, J, side, pal) {
    const C = f.C, b = C.body;
    const back = side === 'B';
    const hp = back ? J.hipB : J.hipF, k = back ? J.kB : J.kF, a = back ? J.aB : J.aF, t = back ? J.tB : J.tF;
    const cols = C.legCols;
    const pc = back ? pal.dark : pal;
    if (C.draw.leg) {
      C.draw.leg(ctx, f, J, side, pc, pal);
      return;
    }
    Rig.limb(ctx, hp, k, a, b.legR[0], b.legR[1], b.legR[2], pc[cols[0]], pc[cols[1]], C.lw, pal.ink);
    if (C.sock) Rig.band(ctx, k, a, b.legR[1], b.legR[2], C.sock[0], C.sock[1], pc[C.sock[2]], C.lw, pal.ink);
    Rig.drawFoot(ctx, f, J, a, t, pc[cols[2]], pal, back);
  },

  drawFoot(ctx, f, J, a, t, col, pal, back) {
    const C = f.C, r = C.body.footR;
    if (C.draw.foot) {
      C.draw.foot(ctx, f, J, a, t, col, pal, back);
      return;
    }
    ctx.beginPath();
    Draw.taper(ctx, a[0], a[1], r, t[0], t[1], r * 0.95);
    Draw.fillStroke(ctx, col, C.lw, pal.ink);
  },

  DEFAULT_ORDER: ['behind', 'armB', 'legB', 'legF', 'torso', 'head', 'armF', 'front'],

  // Draw a full character. ctx must already be at the fighter's root with
  // x flipped for facing.
  drawCharacter(ctx, f, J, pal) {
    // see sketch.js: no outlines, brush-mark shadows
    Sketch.begin(ctx, pal, (f.side || 0) * 3.7 + (f.C.id.length || 0));
    try {
      Rig._drawCharacter(ctx, f, J, pal);
    } finally {
      Sketch.end(ctx);
    }
  },

  _drawCharacter(ctx, f, J, pal) {
    const C = f.C;
    const P = J.P;
    const sq = P.sq !== undefined ? P.sq : 1;
    ctx.save();
    if (sq !== 1) ctx.scale(1 + (1 - sq) * 0.6, sq);
    const order = C.drawOrder || Rig.DEFAULT_ORDER;
    for (let i = 0; i < order.length; i++) {
      const part = order[i];
      Sketch.part = part;
      switch (part) {
        case 'armB': Rig.drawArm(ctx, f, J, 'B', pal); break;
        case 'armF': Rig.drawArm(ctx, f, J, 'F', pal); break;
        case 'legB': Rig.drawLeg(ctx, f, J, 'B', pal); break;
        case 'legF': Rig.drawLeg(ctx, f, J, 'F', pal); break;
        case 'torso':
          ctx.save();
          ctx.translate(J.hip[0], J.hip[1]);
          ctx.rotate(J.ta);
          if (C.look.torso !== 1) ctx.scale(C.look.torso, 1);
          // the torso's marks run down its back
          Sketch.dir = Rig.TORSO_SHADE;
          C.draw.torso(ctx, f, J, pal);
          Sketch.dir = null;
          ctx.restore();
          break;
        case 'head':
          ctx.save();
          ctx.translate(J.head[0], J.head[1]);
          ctx.rotate(J.ha);
          Rig.drawHead(ctx, f, J, pal, Rig.faceOf(f, J));
          ctx.restore();
          break;
        default:
          if (C.draw[part]) C.draw[part](ctx, f, J, pal);
      }
    }
    Sketch.part = null;
    ctx.restore();
  },
  TORSO_SHADE: [0.96, -0.28],

  // The head art is drawn at its full measured size, scaled down to the house
  // proportions, with lines kept as thin as the body's.
  drawHead(ctx, f, J, pal, face) {
    const C = f.C, hs = C.headScale || 1;
    if (hs !== 1) ctx.scale(hs, hs);
    const lw = C.lw;
    C.lw = lw / hs;
    try {
      C.draw.head(ctx, f, J, pal, face);
    } finally {
      C.lw = lw;
    }
  },

  // A point given in full-size head units around the head center, in body space
  headPoint(C, J, x, y) {
    const hs = C.headScale || 1, c = Math.cos(J.ha), s = Math.sin(J.ha);
    return [J.head[0] + (x * c - y * s) * hs, J.head[1] + (x * s + y * c) * hs];
  },

  // Which facial expression to show
  faceOf(f, J) {
    if (J.P.face) return J.P.face;
    if (f.faceOverride) return f.faceOverride;
    return 'normal';
  },

  // ---- palettes -------------------------------------------------------------
  _tintCache: new Map(),
  preparePalette(pal) {
    if (pal.dark) return pal;
    pal.ink = pal.ink || INK;
    pal.dark = {};
    for (const k in pal) {
      if (typeof pal[k] === 'string' && pal[k][0] === '#') pal.dark[k] = U.shade(pal[k], -0.22);
    }
    pal.dark.ink = pal.ink;
    return pal;
  },
  tinted(pal, color, amt, inkToo) {
    const key = pal.__id + '|' + color + '|' + amt + '|' + (inkToo ? 1 : 0);
    let t = Rig._tintCache.get(key);
    if (t) return t;
    t = {};
    for (const k in pal) {
      if (typeof pal[k] === 'string' && pal[k][0] === '#') t[k] = U.mix(pal[k], color, amt);
    }
    t.ink = inkToo ? U.mix(pal.ink, color, amt * 0.8) : pal.ink;
    t.dark = {};
    for (const k in pal.dark) {
      if (typeof pal.dark[k] === 'string' && pal.dark[k][0] === '#') t.dark[k] = U.mix(pal.dark[k], color, amt);
    }
    t.dark.ink = t.ink;
    t.__id = key;
    Rig._tintCache.set(key, t);
    return t;
  },
};

let _palId = 0;
function makePalette(obj) {
  const p = Object.assign({}, obj);
  p.__id = 'p' + _palId++;
  return Rig.preparePalette(p);
}
