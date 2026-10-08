'use strict';
// ---------------------------------------------------------------------------
// BRUNO — the gentle mountain. A huge, friendly wrestler with a magnificent
// mustache. Grappler: command grabs, super armor, ground shockwaves, a
// piledriver super from the sky.
// ---------------------------------------------------------------------------
(() => {
  const T_LEN = 88;

  function shockwave(f) {
    const b = f.battle;
    if (!b) return;
    const pal = f.pal;
    b.spawn(f, {
      x: f.x + f.facing * 70, y: 14, vx: 9 * f.facing, r: 26, life: 38, hits: 1, strength: 2, noReflect: true,
      hit: normHit({ dmg: 70, hs: 26, bs: 16, kb: [4, 9], kd: true, launch: true, level: 'low', groundOnly: true, spark: 'H', sfx: 'hitH', stop: 10, chip: 9 }, 'S', 'special'),
      capFn(p) {
        return [p.x - 18 * p.facing, -10, p.x + 10 * p.facing, -10, p.r];
      },
      tick(p) {
        if (p.age % 3 === 0) FX.dust(p.x, 0, 1, -p.facing * 0.5, 1.1);
      },
      draw(ctx, sx, sy, p) {
        const k = p.age / p.life;
        ctx.save();
        ctx.globalAlpha = 1 - k * 0.6;
        ctx.translate(sx, sy + 12);
        ctx.scale(p.facing, 1);
        for (let i = 0; i < 3; i++) {
          const x = -i * 18, h = 34 - i * 9 + Math.sin(p.age * 0.8 + i) * 4;
          ctx.beginPath();
          ctx.moveTo(x - 20, 0);
          ctx.quadraticCurveTo(x - 6, -h, x + 10, -h * 0.4);
          ctx.quadraticCurveTo(x + 16, -h * 0.1, x + 18, 0);
          ctx.closePath();
          Draw.fillStroke(ctx, i === 0 ? '#f0d9b5' : '#c9a77e', 3.5, pal.ink);
        }
        for (let i = 0; i < 3; i++) Draw.circle(ctx, -40 - i * 12, -6 - (p.age * 2 + i * 9) % 26, 4, '#b08a63', 2, pal.ink);
        ctx.restore();
      },
    });
  }

  function brow(ctx, x, y, ang, w, col, ink) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    Draw.roundRect(ctx, -w / 2, -3.5, w, 7.5, 3.5, col, 2.4, ink);
    ctx.restore();
  }

  // ---- detail ink -------------------------------------------------------------
  // The hand-drawn detail (muscle lines, seams, stitching, laces, hair strands)
  // is built into Path2Ds and stroked as they are, a few batched strokes per
  // body part, so sketch.js never mistakes it for an outline.
  const NODASH = [], STITCH = [2.6, 2.4];

  // device pixels per local unit (to skip details too small to see)
  function devScale(ctx) {
    const m = ctx.getTransform();
    return Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
  }

  function stroke(ctx, p, w, col, dash) {
    ctx.lineWidth = w;
    ctx.strokeStyle = col;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (dash) ctx.setLineDash(dash);
    ctx.stroke(p);
    if (dash) ctx.setLineDash(NODASH);
  }
  function fill(ctx, p, col) {
    ctx.fillStyle = col;
    ctx.fill(p);
  }

  // Detail colors made from a palette (cached per palette object, so hit-flash
  // tints and the darker back-limb palette get their own).
  const TONES = new WeakMap();
  function tones(pal) {
    let t = TONES.get(pal);
    if (t) return t;
    const ink = pal.ink || INK, L = (c) => Sketch.lum(c);
    const near = (a, b) => Math.abs(L(a) - L(b)) < 0.15;
    t = {
      vein: U.mix(pal.skin, ink, 0.3),
      hair: near(pal.hair, pal.skin) ? U.mix(pal.skin, ink, 0.5) : pal.hair,
      stub: U.mix(pal.skin, ink, 0.36),
      beltD: U.mix(pal.belt, ink, 0.42),
      lace: !near(pal.bootTrim, pal.boot) ? pal.bootTrim : L(pal.boot) < 0.5 ? U.mix(pal.boot, '#ffffff', 0.7) : U.mix(pal.boot, ink, 0.72),
      tread: U.mix(pal.boot, ink, 0.15),
    };
    TONES.set(pal, t);
    return t;
  }

  // A frame along the segment a-b (radii ra..rb): t runs along it (0..1), k
  // across it in radii, k > 0 on the side the joint folds toward (the inside
  // of an arm, the front of a leg).
  const F = { ax: 0, ay: 0, dx: 0, dy: 0, nx: 0, ny: 0, ra: 0, rb: 0 };
  function frame(a, b, ra, rb) {
    F.ax = a[0];
    F.ay = a[1];
    F.dx = b[0] - a[0];
    F.dy = b[1] - a[1];
    const L = Math.hypot(F.dx, F.dy) || 1;
    F.nx = F.dy / L;
    F.ny = -F.dx / L;
    F.ra = ra;
    F.rb = rb;
  }
  const fx = (t, k) => F.ax + F.dx * t + F.nx * k * (F.ra + (F.rb - F.ra) * t);
  const fy = (t, k) => F.ay + F.dy * t + F.ny * k * (F.ra + (F.rb - F.ra) * t);
  const M = (p, t, k) => p.moveTo(fx(t, k), fy(t, k));
  const Ln = (p, t, k) => p.lineTo(fx(t, k), fy(t, k));
  const Q = (p, ct, ck, t, k) => p.quadraticCurveTo(fx(ct, ck), fy(ct, ck), fx(t, k), fy(t, k));

  // A rotated frame (foot, knee pad): u along, v across, around (ox, oy).
  const R = { ox: 0, oy: 0, c: 1, s: 0 };
  function rframe(ox, oy, ang) {
    R.ox = ox;
    R.oy = oy;
    R.c = Math.cos(ang);
    R.s = Math.sin(ang);
  }
  const rx = (u, v) => R.ox + u * R.c - v * R.s;
  const ry = (u, v) => R.oy + u * R.s + v * R.c;
  const rM = (p, u, v) => p.moveTo(rx(u, v), ry(u, v));
  const rL = (p, u, v) => p.lineTo(rx(u, v), ry(u, v));
  const rQ = (p, cu, cv, u, v) => p.quadraticCurveTo(rx(cu, cv), ry(cu, cv), rx(u, v), ry(u, v));

  // Muscles, a vein and the tape wraps over an arm already drawn by Rig.limb.
  function armDetail(ctx, s, e, h, r0, r1, r2, back, pc, pal) {
    const p = new Path2D();
    // how far the elbow is bent (0 straight .. PI folded): a folded forearm
    // covers the inside of the upper arm, so the lines there stop short
    const ux = e[0] - s[0], uy = e[1] - s[1], vx = h[0] - e[0], vy = h[1] - e[1];
    const bend = Math.acos(U.clamp((ux * vx + uy * vy) / ((Math.hypot(ux, uy) * Math.hypot(vx, vy)) || 1), -1, 1));
    const tEnd = U.clamp(0.86 - Math.max(0, bend - 1.2) * 0.45, 0.48, 0.86);
    // upper arm: the deltoid's V, the biceps / triceps split, the biceps' curve
    frame(s, e, r0, r1);
    M(p, 0.1, 0.92);
    Q(p, 0.32, 0.45, 0.47, -0.02);
    Q(p, 0.36, -0.5, 0.14, -0.92);
    M(p, 0.5, 0.08);
    Q(p, 0.5 + (tEnd - 0.5) * 0.55, -0.12, tEnd, 0.32);
    if (!back) {
      M(p, 0.62, -0.62);
      Q(p, 0.72, -0.4, 0.84, -0.6);
    }
    const v = back ? null : new Path2D();
    if (v) {
      M(v, 0.54, 0.52);
      Q(v, 0.6 + (tEnd - 0.5) * 0.3, 0.75, tEnd - 0.04, 0.5);
    }
    // forearm: the muscle sweeping in from the elbow, the edge of the tape and
    // its wraps
    frame(e, h, r1, r2);
    M(p, 0.04, -0.62);
    Q(p, 0.2, -0.08, 0.5, 0.26);
    M(p, 0.1, 0.78);
    Q(p, 0.22, 0.48, 0.36, 0.66);
    M(p, 0.685, -1.02);
    Q(p, 0.71, 0, 0.685, 1.02);
    for (let i = 0; i < 3; i++) {
      const t = 0.77 + i * 0.085;
      M(p, t - 0.035, -1.0);
      Q(p, t + 0.01, 0, t + 0.04, 1.0);
    }
    if (v) {
      M(v, 0.12, 0.32);
      Q(v, 0.24, 0.66, 0.37, 0.44);
      Q(v, 0.49, 0.24, 0.63, 0.46);
      M(v, 0.37, 0.44);
      Q(v, 0.47, 0.7, 0.62, 0.8);
      stroke(ctx, v, 1.5, tones(pc).vein);
    }
    stroke(ctx, p, back ? 1.1 : 1.25, pal.ink);
  }

  // Chest hair curls round the breastbone: [x, y, start angle, radius]
  const CHEST_HAIR = [
    [-10, -80, 0.5, 2.6], [-3, -76, 1.2, 2.3], [5, -81, 0.2, 2.5], [12, -75, 0.8, 2.4], [-13, -71, 0.3, 2.2],
    [-5, -68, 0.9, 2.6], [6, -70, 0.1, 2.3], [15, -66, 0.6, 2.1], [-1, -86, 0.4, 2.2], [-9, -62.5, 1.4, 2],
  ];

  // Stubble on the jaw and chin, in full-size head units.
  const STUBBLE = [
    [-13, 17.5], [-12.2, 20.6], [-10.6, 23.3], [-8.2, 25.2], [-5, 26.6], [-1.5, 27.4], [2.4, 27.8], [6.4, 28.1], [10.4, 28.1], [14.4, 27.4], [18.3, 26], [21.6, 24],
    [-9.6, 18], [-8.3, 21.3], [-5.6, 23.6], [-2.2, 24.6], [1.6, 25], [5.4, 25.6], [9.3, 25.7], [13, 25.4], [17, 24.4],
    [-3.6, 6.4], [-1.2, 9], [-4.6, 9.8],
  ];

  defineChar({
    id: 'bruno',
    name: 'BRUNO',
    title: 'The Gentle Mountain',
    style: 'GRAPPLER',
    desc: 'A big friendly champ who loves his fans. Shrugs off hits with super armor and turns any hug into a body slam.',
    color: '#ff6a3d',
    sparkColor: '#ffcf3f',
    trailColor: '#ffb36b',
    words: ['WHAM!', 'SLAM!', 'OOF!', 'BOOM!'],
    wordColor: '#ffcf3f',
    ui: { power: 5, speed: 1, range: 2, difficulty: 2 },
    quotes: ['Ha-HA! Good match, little friend!', 'That one was for the fans!', "Don't worry, I caught you. Mostly.", 'Bruno hugs are free!'],
    vsScale: 0.95,
    selectScale: 0.95,
    stats: {
      hp: 1250, walkF: 2.7, walkB: 2.3, jumpV: 15.2, jumpVx: 4.2, grav: 1.0, jsq: 5,
      dash: { f: 22, v: 6.8, hop: 4, cancel: 10 }, bdash: { v: 5.6, vy: 5, inv: 3, lag: 8 },
      width: 84, height: 228, throwRange: 62, landLag: 5, downTime: 34, swingPitch: 0.8, voicePitch: 0.7,
    },
    body: {
      torso: T_LEN, neck: 4, headR: 27, shoulderDrop: 16, shoulderOfs: 8, hipOfs: 10,
      uArm: 36, fArm: 33, handR: 15,
      thigh: 34, shin: 32, footL: 20, footR: 10,
      armR: [17, 15.5, 13], legR: [17, 14.5, 12.5], torsoW: [96, 104],
    },
    armCols: ['skin', 'skin', 'skin'],
    legCols: ['skin', 'skin', 'boot'],
    cuff: [0.68, 1.0, 'tape'],
    drawOrder: ['behind', 'armB', 'legB', 'legF', 'torso', 'armF', 'head', 'front'],
    mono: [
      { main: '#ee4d43', accent: '#ffcf3f' },
      { main: '#3f7ce0', accent: '#e3e8f2' },
      { main: '#4cb35e', accent: '#ffe14d' },
    ],
    monoKeys: { main: 'singlet', accentMain: 'belt', range: 0.42, accent: ['trim', 'belt', 'gem', 'bootTrim'] },
    palettes: [
      { skin: '#e8a46e', skinD: '#c98552', singlet: '#d83b3b', trim: '#ffcf3f', hair: '#2b1d1d', brow: '#2b1d1d', stache: '#2b1d1d',
        tape: '#f4f1e8', boot: '#2c2738', bootTrim: '#d83b3b', belt: '#ffcf3f', gem: '#3fb8ff', pad: '#d83b3b' },
      { skin: '#c98a5a', skinD: '#a96b3f', singlet: '#2f6fd6', trim: '#e3e8f2', hair: '#3a2a20', brow: '#3a2a20', stache: '#3a2a20',
        tape: '#ffffff', boot: '#e3e8f2', bootTrim: '#2f6fd6', belt: '#c9d2e3', gem: '#ff4d6d', pad: '#2f6fd6' },
      { skin: '#f0c09a', skinD: '#d39b72', singlet: '#2b2b33', trim: '#8cff5a', hair: '#d9d9d9', brow: '#d9d9d9', stache: '#e8e8e8',
        tape: '#8cff5a', boot: '#2b2b33', bootTrim: '#8cff5a', belt: '#8cff5a', gem: '#ff4dc4', pad: '#2b2b33' },
    ],
    walk: { A: 10, H: 10, bob: 4.5, sway: 2.5, arm: 8 },
    idlePeriod: 80,
    ai: {
      pref: [60, 170], aggression: 0.75, jumpiness: 0.22, zoning: 0,
      combos: [['5L', '6S'], ['2L', '2S'], ['2L', '5L', '6S'], ['jH', '5L', '6S'], ['jH', '2L', '2S'], ['5H', '6S']],
      antiAir: ['2H'], punish: ['5H', '6S'], enders: ['6S', '2S'],
    },

    poses: {
      stance: { t: 6, hd: -2, fs: 30, fe: 80, bs: 18, be: 88, lf: [26, 0], lb: [-24, 0], d: 8 },
      stance2: { $: 'stance', d: 12, t: 8, fe: 84, hd: 0 },
      walkBase: { $: 'stance', t: 8 },
      crouch: { t: 22, hd: -12, fs: 50, fe: 70, bs: 35, be: 80, lf: [28, 0], lb: [-26, 0], d: 34 },
      crouch2: { $: 'crouch', d: 36 },
      squat: { t: 18, hd: -10, fs: 20, fe: 60, bs: 5, be: 70, lf: [26, 0], lb: [-24, 0], d: 28 },
      jump: { t: 4, hd: -8, fs: 120, fe: 40, bs: 140, be: 30, fh: 60, fk: 90, bh: 20, bk: 80 },
      fall: { t: 6, hd: 0, fs: 100, fe: 40, bs: 120, be: 40, fh: 30, fk: 40, bh: -5, bk: 30 },
      tuck: { t: 24, hd: 10, fs: 70, fe: 90, bs: 50, be: 90, fh: 100, fk: 130, bh: 80, bk: 130 },
      dash1: { t: 16, hd: -10, fs: -20, fe: 70, bs: 50, be: 60, fh: 50, fk: 70, bh: -20, bk: 40 },
      dash2: { t: 10, hd: -6, fs: 30, fe: 70, bs: 10, be: 70, fh: 10, fk: 20, bh: -10, bk: 20 },
      block: { t: -6, hd: 10, fs: 72, fe: 115, bs: 58, be: 120, lf: [20, 0], lb: [-28, 0], d: 12, face: 'block' },
      cblock: { t: 12, hd: 6, fs: 75, fe: 110, bs: 60, be: 115, lf: [28, 0], lb: [-26, 0], d: 36, face: 'block' },
      // normals
      '5L_a': { t: 4, hd: -2, fs: 40, fe: 100, bs: 20, be: 90, lf: [26, 0], lb: [-24, 0], d: 8 },
      '5L_b': { t: 14, hd: -6, x: 8, fs: 88, fe: 4, bs: 10, be: 100, lf: [30, 0], lb: [-22, 0], d: 10 },
      '2L_a': { t: 26, hd: -10, fs: 100, fe: 70, bs: 35, be: 80, lf: [28, 0], lb: [-26, 0], d: 36 },
      '2L_b': { t: 34, hd: -14, x: 8, fs: 60, fe: 10, bs: 35, be: 80, lf: [32, 0], lb: [-24, 0], d: 38, hand: 'open' },
      '5H_a': { t: -12, hd: 8, fs: 175, fe: 30, bs: 170, be: 40, lf: [24, 0], lb: [-26, 0], d: 4 },
      '5H_b': { t: -16, hd: 10, fs: 195, fe: 20, bs: 190, be: 30, lf: [24, 0], lb: [-26, 0], d: 2 },
      '5H_c': { t: 30, hd: -6, x: 14, fs: 70, fe: 5, bs: 65, be: 10, lf: [36, 0], lb: [-22, 0], d: 18 },
      '5H_d': { t: 26, hd: -4, x: 12, fs: 55, fe: 15, bs: 50, be: 20, lf: [36, 0], lb: [-22, 0], d: 20 },
      '2H_a': { t: 26, hd: -24, fs: 40, fe: 60, bs: 20, be: 60, lf: [26, 0], lb: [-24, 0], d: 38 },
      '2H_b': { t: 8, hd: -34, x: 22, fs: -10, fe: 40, bs: -30, be: 40, lf: [36, 0], lb: [-18, 0], d: 0, y: -10 },
      '6H_a': { t: -18, hd: 6, fs: -20, fe: 60, bs: -30, be: 60, lf: [24, 0], lb: [-26, 0], d: 8 },
      '6H_b': { t: -24, hd: 0, x: 26, fs: -40, fe: 40, bs: -50, be: 40, lf: [50, 0], lb: [-10, 0], d: 10 },
      jL_a: { t: 10, hd: -4, fs: 150, fe: 120, bs: 80, be: 80, fh: 60, fk: 90, bh: 20, bk: 80 },
      jL_b: { t: 24, hd: -10, fs: 40, fe: 150, bs: 80, be: 80, fh: 40, fk: 70, bh: 10, bk: 60 },
      jH_a: { t: -14, hd: -6, fs: 160, fe: 20, bs: 170, be: 20, fh: 50, fk: 80, bh: 30, bk: 80 },
      jH_b: { t: 40, hd: -16, fs: 100, fe: 0, bs: 110, be: 0, fh: 20, fk: 10, bh: -10, bk: 10 },
      // specials
      hugReach: { t: 18, hd: -6, x: 10, fs: 85, fe: 40, bs: 80, be: 50, hand: 'open', handB: 'open', lf: [34, 0], lb: [-22, 0], d: 14 },
      hugMiss: { t: 10, hd: 6, fs: 60, fe: 110, bs: 60, be: 110, hand: 'open', handB: 'open', lf: [30, 0], lb: [-24, 0], d: 12, face: 'sad' },
      hugHold: { t: -14, hd: -6, fs: 70, fe: 100, bs: 75, be: 95, hand: 'open', handB: 'open', lf: [22, 0], lb: [-28, 0], d: 4, face: 'happy' },
      hugSqueeze: { t: -20, hd: -10, fs: 60, fe: 125, bs: 65, be: 120, hand: 'open', handB: 'open', lf: [22, 0], lb: [-28, 0], d: 8, face: 'angry' },
      hugToss: { t: 16, hd: -4, x: 10, fs: 100, fe: 20, bs: 95, be: 20, hand: 'open', handB: 'open', lf: [32, 0], lb: [-24, 0], d: 12 },
      bullA: { t: 30, hd: -16, fs: -30, fe: 80, bs: 60, be: 70, lf: [24, 0], lb: [-30, 0], d: 22 },
      bullB: { t: 34, hd: -20, fs: 20, fe: 100, bs: -20, be: 60, lf: [36, 0], lb: [-30, 8], d: 18 },
      bullC: { t: 34, hd: -20, fs: 30, fe: 100, bs: -10, be: 60, lf: [10, 8], lb: [-14, 0], d: 18 },
      stompA: { t: -10, hd: 6, fs: 60, fe: 60, bs: 40, be: 60, fh: 95, fk: 110, lb: [-24, 0], d: 4 },
      stompB: { t: -14, hd: 10, fs: 80, fe: 50, bs: 60, be: 50, fh: 105, fk: 100, lb: [-24, 0], d: 0 },
      stompC: { t: 22, hd: -8, fs: 40, fe: 40, bs: 25, be: 40, lf: [40, 0], lb: [-24, 0], d: 26 },
      pressA: { t: 30, hd: -6, fs: 150, fe: 10, bs: 160, be: 10, hand: 'open', handB: 'open', fh: 20, fk: 40, bh: -10, bk: 40 },
      pressB: { t: 70, hd: -24, fs: 110, fe: 0, bs: 120, be: 0, hand: 'open', handB: 'open', fh: 10, fk: 10, bh: -15, bk: 10 },
      // throws & super
      grabA: { t: 14, hd: -4, fs: 75, fe: 70, bs: 70, be: 75, hand: 'open', handB: 'open', lf: [28, 0], lb: [-24, 0], d: 14 },
      suplexA: { t: -10, hd: -4, fs: 150, fe: 50, bs: 150, be: 50, hand: 'open', handB: 'open', lf: [24, 0], lb: [-26, 0], d: 18 },
      suplexB: { t: -55, hd: -20, x: -10, fs: 200, fe: 30, bs: 200, be: 30, hand: 'open', handB: 'open', lf: [20, 0], lb: [-30, 0], d: 30 },
      suplexC: { t: -80, hd: -30, x: -20, fs: 230, fe: 20, bs: 230, be: 20, hand: 'open', handB: 'open', lf: [22, 0], lb: [-26, 0], d: 34 },
      leap: { t: -4, hd: -10, fs: 170, fe: 30, bs: 170, be: 30, hand: 'open', handB: 'open', fh: 40, fk: 70, bh: 10, bk: 60 },
      drop: { t: 8, hd: 10, fs: 150, fe: 60, bs: 150, be: 60, hand: 'open', handB: 'open', fh: 10, fk: 20, bh: -10, bk: 20 },
      sit: { r: -10, t: -10, hd: 6, fs: 30, fe: 60, bs: -10, be: 50, fh: 90, fk: 30, bh: 80, bk: 50, face: 'hurt' },
      // personality
      flex: { t: -4, hd: -8, fs: 95, fe: 110, bs: 95, be: 110, lf: [24, 0], lb: [-26, 0], d: 6, face: 'happy' },
      flex2: { t: -2, hd: -4, fs: 100, fe: 120, bs: 100, be: 120, lf: [24, 0], lb: [-26, 0], d: 10, face: 'happy' },
      wave: { t: 0, hd: -6, fs: 160, fe: 20, hand: 'open', bs: 30, be: 70, lf: [24, 0], lb: [-26, 0], d: 6, face: 'happy' },
      wave2: { $: 'wave', fs: 150, fe: 40 },
      win: { t: -6, hd: -12, fs: 175, fe: 5, bs: 95, be: 115, lf: [24, 0], lb: [-26, 0], d: 4, face: 'happy' },
      win2: { $: 'flex2' },
      lose: { t: 26, hd: 24, fs: 10, fe: 20, bs: 0, be: 20, lf: [20, 0], lb: [-20, 0], d: 8, face: 'sad' },
    },

    anims: {
      intro: { keys: [[0, 'wave'], [10, 'wave2'], [20, 'wave'], [30, 'wave2'], [44, 'flex', 'out'], [60, 'flex2'], [74, 'flex'], [96, 'stance']] },
      win: { keys: [[0, 'stance'], [12, 'flex', 'out'], [26, 'flex2'], [40, 'flex'], [54, 'win', 'out'], [80, 'win']] },
      land: { keys: [[0, { $: 'squat', sq: 0.9 }], [7, 'stance']] },
    },

    moves: {
      '5L': {
        name: 'Big Jab',
        anim: { keys: [[0, 'stance'], [4, '5L_a', 'out'], [6, '5L_b', 'snap'], [9, '5L_b'], [18, 'stance']] },
        hits: [{ at: [6, 9], limb: 'handF', r: 18, dmg: 34, hs: 15, bs: 11, kb: [3.5, 0] }],
        ai: { range: [0, 145], kind: 'poke' },
      },
      '2L': {
        name: 'Low Chop',
        anim: { keys: [[0, 'crouch'], [4, '2L_a', 'out'], [6, '2L_b', 'snap'], [9, '2L_b'], [19, 'crouch']] },
        hits: [{ at: [6, 9], limb: 'handF', r: 18, dmg: 30, level: 'low', hs: 14, bs: 10, kb: [3, 0] }],
        ai: { range: [0, 155], kind: 'low' },
      },
      '5H': {
        name: 'Double Axe Handle',
        anim: { keys: [[0, 'stance'], [7, '5H_a', 'out'], [13, '5H_b'], [15, '5H_c', 'snap'], [18, '5H_c'], [28, '5H_d'], [38, 'stance']] },
        armor: [3, 14, 1],
        hits: [{ at: [15, 18], limb: 'handF', r: 26, dmg: 96, hs: 22, bs: 17, kb: [7, 0], stop: 13, sfx: 'hitH' }],
        ev: { 15: (f) => f.battle && f.battle.shake(5) },
        ai: { range: [20, 175], kind: 'poke' },
      },
      '2H': {
        name: 'Rising Headbutt',
        anim: { keys: [[0, 'crouch'], [5, '2H_a', 'out'], [9, '2H_b', 'snap'], [14, '2H_b'], [26, '2H_a'], [34, 'crouch']] },
        airInv: [4, 14],
        hits: [{
          at: [7, 14], r: 40, dmg: 80, hs: 26, launch: true, kd: true, kb: [2.5, 12.5], stop: 11, sfx: 'hitH',
          // head and shoulders, so it also catches short opponents
          capFn: (f) => [f.J.neck[0] + 12, f.J.neck[1] + 40, f.J.head[0], f.J.head[1]],
        }],
        ai: { range: [0, 125], kind: 'aa' },
      },
      '6H': {
        name: 'Belly Bump',
        anim: { keys: [[0, 'stance'], [8, '6H_a', 'out'], [12, '6H_b', 'snap'], [18, '6H_b'], [34, 'stance']] },
        armor: [3, 12, 1],
        vel: [[11, 6], [18, 0]],
        hits: [{ at: [12, 17], limb: 'body', r: 58, dmg: 72, hs: 20, bs: 16, kb: [12, 0], stop: 10, sfx: 'boing', sfx2: 'hitM' }],
        ai: { range: [20, 135], kind: 'poke' },
      },
      jL: {
        name: 'Elbow Drop',
        anim: { keys: [[0, 'jump'], [3, 'jL_a', 'out'], [5, 'jL_b', 'snap'], [13, 'jL_b'], [20, 'fall']] },
        hits: [{ at: [5, 12], limb: 'armF', r: 18, dmg: 42, hs: 15, bs: 11 }],
        ai: { kind: 'air' },
      },
      jH: {
        name: 'Big Splash',
        anim: { keys: [[0, 'jump'], [5, 'jH_a', 'out'], [8, 'jH_b', 'snap'], [17, 'jH_b'], [24, 'fall']] },
        hits: [{ at: [8, 16], limb: 'body', r: 56, dmg: 78, hs: 19, bs: 15, kb: [5, 0], sfx: 'hitH' }],
        ai: { kind: 'air' },
      },
      '5S': {
        name: 'Bear Hug',
        throw: true,
        cmdGrab: true,
        throwAt: 5,
        range: 46,
        anim: { keys: [[0, 'stance'], [5, 'hugReach', 'snap'], [12, 'hugMiss'], [40, 'hugMiss'], [48, 'stance']] },
        seq: {
          len: 66,
          tech: false,
          anim: { keys: [[0, 'grabA'], [6, 'hugHold'], [16, 'hugSqueeze'], [22, 'hugHold'], [30, 'hugSqueeze'], [36, 'hugHold'], [44, 'hugSqueeze'], [52, 'hugHold'], [58, 'hugToss', 'snap'], [66, 'stance']] },
          vic: [[0, 'grabbed', 64, 0], [6, 'hurtAir', 42, 30], [16, 'launch', 40, 34, 0], [22, 'hurtAir', 42, 30], [30, 'launch', 40, 34], [36, 'hurtAir', 42, 30], [44, 'launch', 40, 34], [52, 'hurtAir', 42, 30], [58, 'hurtAir', 76, 40]],
          hits: {
            16: { dmg: 35, sfx: 'hitM', stop: 4, word: 'SQUEEZE!' },
            30: { dmg: 35, sfx: 'hitM', stop: 4 },
            44: { dmg: 40, sfx: 'hitH', stop: 6, shake: 5 },
            58: { dmg: 20, sfx: 'hitM' },
          },
          ev: { 6: (a) => a.battle && FX.hearts(a.x + a.facing * 40, -a.y - 200, 3) },
          release: { vx: 8, vy: 9 },
          recover: 14,
        },
        ai: { range: [0, 120], kind: 'grab' },
      },
      '6S': {
        name: 'Charging Bull',
        anim: { keys: [[0, 'stance'], [10, 'bullA', 'out'], [14, 'bullB', 'snap'], [18, 'bullC'], [22, 'bullB'], [26, 'bullC'], [30, 'bullB'], [34, 'bullC'], [42, 'squat'], [52, 'stance']] },
        armor: [6, 30, 2],
        vel: [[13, 12], [34, 3], [40, 0]],
        keepVel: true,
        trail: [13, 34],
        hits: [{
          at: [14, 34], limb: 'body', r: 46, dmg: 92, hs: 30, kd: true, launch: true, kb: [9, 8], bs: 14, stop: 12, spark: 'S', sfx: 'slam',
          onBlock: (f) => {
            f.vx = -4 * f.facing;
            f.mf = Math.max(f.mf, 35);
          },
        }],
        ev: { 13: () => Sound.sfx('dash', { pitch: 0.7 }), 20: (f) => f.battle && FX.dust(f.x, 0, 2, -f.facing), 28: (f) => f.battle && FX.dust(f.x, 0, 2, -f.facing) },
        onHit: (f) => {
          f.vx = 1.5 * f.facing;
          f.mf = Math.max(f.mf, 34);
        },
        ai: { range: [80, 320], kind: 'approach', unsafe: true },
      },
      '2S': {
        name: 'Earthquake Stomp',
        anim: { keys: [[0, 'stance'], [8, 'stompA', 'out'], [16, 'stompB'], [19, 'stompC', 'snap'], [34, 'stompC'], [44, 'stance']] },
        hits: [{ at: [19, 21], cap: [10, -10, 110, -10], r: 26, dmg: 50, level: 'low', groundOnly: true, kd: true, kb: [3, 8], launch: true, hs: 24, sfx: 'stomp' }],
        ev: { 19: (f) => {
          Sound.sfx('stomp');
          if (f.battle) {
            f.battle.shake(10);
            FX.dust(f.x + f.facing * 50, 0, 10, 0, 1.5);
            shockwave(f);
          }
        } },
        ai: { range: [60, 360], kind: 'low' },
      },
      jS: {
        name: 'Flying Body Press',
        anim: { keys: [[0, 'jump'], [5, 'pressA', 'out'], [10, 'pressB', 'snap'], [60, 'pressB']] },
        vel: [[9, 6.5, -9]],
        grav: 0.25, gravAt: [9, 60],
        landEnd: true,
        landLag: 16,
        hits: [{ at: [10, 60], limb: 'body', r: 54, dmg: 82, hs: 22, kd: true, kb: [5, 6], maxHits: 1, sfx: 'slam', stop: 11 }],
        onLand: (f) => {
          Sound.sfx('slam');
          if (f.battle) {
            f.battle.shake(8);
            FX.dust(f.x, 0, 10, 0, 1.4);
          }
        },
        ai: { kind: 'airS' },
      },
      SUP: {
        name: 'MOUNTAIN DROP',
        throw: true,
        cmdGrab: true,
        throwAt: 6,
        range: 80,
        inv: [0, 8],
        anim: { keys: [[0, 'squat'], [6, 'hugReach', 'snap'], [14, 'hugMiss'], [44, 'hugMiss'], [54, 'stance']] },
        seq: {
          len: 104,
          tech: false,
          anim: { keys: [[0, 'grabA'], [10, 'squat'], [18, 'leap', 'out'], [60, 'leap'], [70, 'drop', 'in'], [84, 'drop'], [92, 'squat'], [104, 'stance']] },
          self: [[0, 0, 0], [10, 0, 0], [40, 10, 620, 'out'], [62, 10, 640], [84, 20, 0, 'in'], [104, 20, 0]],
          vic: [[0, 'grabbed', 64, 0], [10, 'hurtAir', 50, 90, 180], [40, 'launch', 40, 150, 180], [62, 'launch', 40, 160, 180], [84, 'fallen', 50, 0, 90, 'in'], [104, 'fallen', 70, 0]],
          hits: {
            12: { dmg: 30, sfx: 'grab', stop: 4 },
            84: { dmg: 260, sfx: 'hitX', stop: 18, shake: 24, word: 'MOUNTAIN DROP!', minScale: 0.8, spark: 'X' },
          },
          ev: {
            18: () => Sound.sfx('whoosh'),
            84: (a) => {
              Sound.sfx('stomp');
              Sound.sfx('cheer');
              if (a.battle) {
                FX.dust(a.x + a.facing * 40, 0, 18, 0, 2);
                FX.ring(a.x + a.facing * 40, -20, 200, '#ffcf3f', 22);
              }
            },
          },
          release: { vx: 3, vy: 6 },
          recover: 20,
        },
        ai: { kind: 'super', range: [0, 130] },
      },
      THROW: {
        name: 'Suplex',
        throw: true,
        throwAt: 3,
        anim: { keys: [[0, 'stance'], [3, 'throwReach'], [9, 'throwWhiff'], [26, 'stance']] },
        seq: {
          len: 44,
          tech: true,
          anim: { keys: [[0, 'grabA'], [10, 'suplexA'], [20, 'suplexB', 'out'], [26, 'suplexC', 'snap'], [36, 'suplexC'], [44, 'stance']] },
          vic: [[0, 'grabbed', 60, 0], [10, 'grabbed', 40, 30], [20, 'hurtAir', 10, 150, -150], [26, 'fallen', -70, 0, -90, 'snap'], [44, 'fallen', -76, 0]],
          hits: { 26: { dmg: 100, sfx: 'slam', shake: 12, stop: 8, word: 'SLAM!' } },
          ev: { 26: (a) => a.battle && FX.dust(a.x - a.facing * 70, 0, 10, 0, 1.4) },
          release: { vx: -3, vy: 4 },
          recover: 18,
        },
      },
    },

    // ---- drawing --------------------------------------------------------------
    draw: {
      torso(ctx, f, J, pal) {
        const T = T_LEN, lw = f.C.lw, tn = tones(pal), ds = devScale(ctx);
        // barrel body outline
        const barrel = () => {
          ctx.beginPath();
          ctx.moveTo(-40, 14);
          ctx.quadraticCurveTo(-58, -26, -46, -T + 20);
          ctx.quadraticCurveTo(-34, -T - 4, 0, -T - 4);
          ctx.quadraticCurveTo(40, -T - 4, 50, -T + 22);
          ctx.quadraticCurveTo(68, -40, 46, 14);
          ctx.closePath();
        };
        barrel();
        Draw.fillStroke(ctx, pal.skin, lw, pal.ink);
        ctx.save();
        barrel();
        ctx.clip();
        // singlet: everything below the chest line + straps
        ctx.fillStyle = pal.singlet;
        ctx.beginPath();
        ctx.moveTo(-70, 20);
        ctx.lineTo(-70, -T * 0.55);
        ctx.quadraticCurveTo(-30, -T * 0.68, 2, -T * 0.6);
        ctx.quadraticCurveTo(36, -T * 0.68, 80, -T * 0.52);
        ctx.lineTo(80, 20);
        ctx.closePath();
        ctx.fill();
        ctx.fillRect(-36, -T - 10, 16, T * 0.5);
        ctx.fillRect(22, -T - 10, 16, T * 0.5);
        // trim
        ctx.strokeStyle = pal.trim;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-70, -T * 0.55 + 3);
        ctx.quadraticCurveTo(-30, -T * 0.68 + 3, 2, -T * 0.6 + 3);
        ctx.quadraticCurveTo(36, -T * 0.68 + 3, 80, -T * 0.52 + 3);
        ctx.stroke();
        ctx.strokeStyle = pal.ink;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-70, -T * 0.55);
        ctx.quadraticCurveTo(-30, -T * 0.68, 2, -T * 0.6);
        ctx.quadraticCurveTo(36, -T * 0.68, 80, -T * 0.52);
        ctx.moveTo(-36, -T - 10);
        ctx.lineTo(-36, -T * 0.6);
        ctx.moveTo(-20, -T - 10);
        ctx.lineTo(-20, -T * 0.64);
        ctx.moveTo(22, -T - 10);
        ctx.lineTo(22, -T * 0.64);
        ctx.moveTo(38, -T - 10);
        ctx.lineTo(38, -T * 0.6);
        ctx.stroke();
        // pecs, breastbone and collarbones; the singlet's side seam and the
        // folds where it stretches over the belly
        const p = new Path2D();
        p.moveTo(-19, -67.5);
        p.quadraticCurveTo(-10, -59.5, -0.5, -64);
        p.moveTo(3, -64);
        p.quadraticCurveTo(13, -59.5, 21, -67.5);
        p.moveTo(1.5, -83);
        p.quadraticCurveTo(0.4, -75, 1.3, -67.5);
        p.moveTo(-17, -86);
        p.quadraticCurveTo(-9, -88.5, -3, -85.5);
        p.moveTo(6, -85.5);
        p.quadraticCurveTo(12, -88.5, 19, -86.5);
        p.moveTo(-20.5, -54);
        p.quadraticCurveTo(-31, -30, -26, -6);
        p.moveTo(58, -46);
        p.quadraticCurveTo(52, -42, 45, -43.5);
        p.moveTo(59.5, -34);
        p.quadraticCurveTo(53, -31, 46.5, -32.5);
        p.moveTo(58, -22);
        p.quadraticCurveTo(52, -19.5, 46, -21.5);
        stroke(ctx, p, 1.3, pal.ink);
        // stitching under the trim and down both edges of the straps
        const st = new Path2D();
        st.moveTo(-70, -T * 0.55 + 9);
        st.quadraticCurveTo(-30, -T * 0.68 + 9, 2, -T * 0.6 + 9);
        st.quadraticCurveTo(36, -T * 0.68 + 9, 80, -T * 0.52 + 9);
        for (const x of [-33, -23, 25, 35]) {
          st.moveTo(x, -T - 2);
          st.lineTo(x, -T * 0.66);
        }
        stroke(ctx, st, 1.1, pal.ink, STITCH);
        // back shading
        ctx.fillStyle = 'rgba(40,10,30,0.22)';
        ctx.beginPath();
        ctx.ellipse(-56, -T * 0.4, 22, T * 0.8, 0, 0, TAU);
        ctx.fill();
        // belly highlight
        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        ctx.beginPath();
        ctx.ellipse(26, -T * 0.4, 16, 22, -0.3, 0, TAU);
        ctx.fill();
        ctx.restore();
        // chest hair curls
        const hp = new Path2D();
        for (const [cx, cy, a, r] of CHEST_HAIR) {
          hp.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
          hp.arc(cx, cy, r, a, a + 4.3);
        }
        stroke(ctx, hp, 1.8, tn.hair);
        // star emblem
        const sy = -T * 0.32, rot = -Math.PI / 2 + 0.1;
        Draw.star(ctx, 16, sy, 15, 7, 5, pal.trim, 3, pal.ink, rot);
        // championship belt
        Draw.roundRect(ctx, -44, -6, 98, 16, 6, pal.belt, lw * 0.8, pal.ink);
        Draw.roundRect(ctx, 6, -13, 40, 30, 10, pal.belt, lw * 0.8, pal.ink);
        Draw.circle(ctx, 26, 2, 7.5, pal.gem, 2.5, pal.ink);
        Draw.circle(ctx, 24, 0, 2.5, '#ffffff', 0);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(-40, -4, 40, 3);
        // the star's facets, the plate's engraved border and the rays round the
        // gem, and (big enough to see) the gem's cut
        const bp = new Path2D();
        for (let i = 0; i < 5; i++) {
          const a = rot + (i * TAU) / 5;
          bp.moveTo(16, sy);
          bp.lineTo(16 + Math.cos(a) * 11.5, sy + Math.sin(a) * 11.5);
        }
        Draw.roundRectPath(bp, 9.6, -9.4, 32.8, 22.8, 7);
        for (let i = 0; i < 6; i++) {
          const a = (i * TAU) / 6, c = Math.cos(a), s = Math.sin(a);
          bp.moveTo(26 + c * 9.6, 2 + s * 9.6);
          bp.lineTo(26 + c * (i % 3 ? 11.2 : 12.6), 2 + s * (i % 3 ? 11.2 : 12.6));
        }
        if (ds > 1.4) {
          for (let i = 0; i < 6; i++) {
            const a = 0.52 + (i * TAU) / 6;
            if (i === 0) bp.moveTo(26 + Math.cos(a) * 3.6, 2 + Math.sin(a) * 3.6);
            else bp.lineTo(26 + Math.cos(a) * 3.6, 2 + Math.sin(a) * 3.6);
          }
          bp.closePath();
          for (let i = 1; i < 6; i += 2) {
            const a = 0.52 + (i * TAU) / 6, c = Math.cos(a), s = Math.sin(a);
            bp.moveTo(26 + c * 3.6, 2 + s * 3.6);
            bp.lineTo(26 + c * 7.4, 2 + s * 7.4);
          }
        }
        stroke(ctx, bp, 1.1, pal.ink);
        // stitching along the strap
        const sp = new Path2D();
        sp.moveTo(-41, -3.6);
        sp.lineTo(5, -3.6);
        sp.moveTo(-41, 7.6);
        sp.lineTo(5, 7.6);
        sp.moveTo(47, -3.6);
        sp.lineTo(52, -3.6);
        sp.moveTo(47, 7.6);
        sp.lineTo(52, 7.6);
        stroke(ctx, sp, 1, pal.ink, STITCH);
        // studs, their shine and a second glint in the gem
        const sd = new Path2D(), sh = new Path2D();
        for (const x of [-35, -25, -15, -5, 50]) {
          sd.moveTo(x + 2.5, 2);
          sd.arc(x, 2, 2.5, 0, TAU);
          sh.moveTo(x - 0.1, 1.1);
          sh.arc(x - 0.8, 1.1, 0.8, 0, TAU);
        }
        sh.moveTo(30.6, 5);
        sh.arc(29.6, 5, 1, 0, TAU);
        fill(ctx, sd, tn.beltD);
        fill(ctx, sh, '#ffffff');
      },
      head(ctx, f, J, pal, face) {
        const lw = f.C.lw, ink = pal.ink, tn = tones(pal), ds = devScale(ctx);
        // face
        ctx.beginPath();
        ctx.moveTo(-20, -14);
        ctx.quadraticCurveTo(-22, 20, -8, 27);
        ctx.quadraticCurveTo(12, 34, 26, 22);
        ctx.quadraticCurveTo(32, 4, 26, -16);
        ctx.quadraticCurveTo(4, -30, -20, -14);
        ctx.closePath();
        Draw.fillStroke(ctx, pal.skin, lw, pal.ink);
        // slicked hair with a curl
        ctx.beginPath();
        ctx.moveTo(-22, 4);
        ctx.quadraticCurveTo(-30, -20, -6, -27);
        ctx.quadraticCurveTo(16, -32, 28, -16);
        ctx.quadraticCurveTo(14, -20, 4, -16);
        ctx.quadraticCurveTo(-10, -12, -14, 2);
        ctx.closePath();
        Draw.fillStroke(ctx, pal.hair, lw * 0.85, pal.ink);
        ctx.strokeStyle = pal.hair;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(22, -18, 5, Math.PI, Math.PI * 2.6);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.beginPath();
        ctx.ellipse(-2, -22, 9, 2.5, -0.2, 0, TAU);
        ctx.fill();
        // comb lines through the slicked hair and into the curl
        const hs = new Path2D();
        hs.moveTo(25, -19.5);
        hs.quadraticCurveTo(8, -28.5, -10, -23);
        hs.moveTo(15, -19.6);
        hs.quadraticCurveTo(-2, -23, -14, -14);
        hs.moveTo(5, -16.6);
        hs.quadraticCurveTo(-9, -16, -17, -4);
        hs.moveTo(-4, -26.5);
        hs.quadraticCurveTo(-20, -24, -24, -6);
        hs.moveTo(20.5, -22.6);
        hs.quadraticCurveTo(25, -25, 26.4, -19.5);
        stroke(ctx, hs, 1.7, ink);
        // ear, with its rim and the bump in front of the opening
        Draw.ellipse(ctx, -12, 4, 6.5, 8.5, 0.12, pal.skin, lw * 0.8, ink);
        // eyes
        const blink = f.blinking;
        const eyeY = -2;
        const happy = face === 'happy';
        const fp = new Path2D(); // face lines drawn over the eyes and brows
        fp.moveTo(-9, -2.5);
        fp.quadraticCurveTo(-16.5, -1.5, -15.4, 5.5);
        fp.quadraticCurveTo(-14.4, 10.6, -10.4, 10);
        fp.moveTo(-8.4, 2.6);
        fp.quadraticCurveTo(-11, 4.4, -8.8, 7.2);
        if (face === 'hurt' || face === 'ko') {
          ctx.strokeStyle = pal.ink;
          ctx.lineWidth = 3;
          ctx.beginPath();
          if (face === 'ko') {
            for (const ex of [4, 18]) {
              ctx.moveTo(ex - 4, eyeY - 4);
              ctx.lineTo(ex + 4, eyeY + 4);
              ctx.moveTo(ex + 4, eyeY - 4);
              ctx.lineTo(ex - 4, eyeY + 4);
            }
          } else {
            ctx.moveTo(0, eyeY - 4);
            ctx.lineTo(6, eyeY);
            ctx.lineTo(0, eyeY + 4);
            ctx.moveTo(22, eyeY - 4);
            ctx.lineTo(16, eyeY);
            ctx.lineTo(22, eyeY + 4);
          }
          ctx.stroke();
        } else if (face === 'happy' || blink) {
          ctx.strokeStyle = pal.ink;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(4, eyeY + 2, 4, Math.PI * 1.1, Math.PI * 1.9);
          ctx.moveTo(22, eyeY + 1);
          ctx.arc(18, eyeY + 2, 4, Math.PI * 1.1, Math.PI * 1.9);
          ctx.stroke();
        } else {
          for (const [ex, rx] of [[4, 4.5], [18, 4]]) {
            Draw.ellipse(ctx, ex, eyeY, rx, 5.2, 0, '#ffffff', 2.2, pal.ink);
            Draw.circle(ctx, ex + 1.2, eyeY + 0.6, 2.4, pal.ink, 0);
            Draw.circle(ctx, ex + 1.8, eyeY - 0.6, 0.9, '#ffffff', 0);
          }
        }
        const open = !(face === 'hurt' || face === 'ko' || face === 'happy' || blink);
        if (open) {
          // heavy upper lids and the bags under the eyes
          for (const [ex, erx] of [[4, 4.5], [18, 4]]) {
            fp.moveTo(ex - erx - 0.4, eyeY - 1.2);
            fp.quadraticCurveTo(ex - 0.6, eyeY - 8.4, ex + erx + 0.6, eyeY - 1.8);
            fp.moveTo(ex - erx + 0.8, eyeY + 6.6);
            fp.quadraticCurveTo(ex, eyeY + 8.8, ex + erx - 0.4, eyeY + 6.4);
          }
        } else if (happy) {
          // cheeks pushed up by the grin, and crow's feet
          fp.moveTo(0.4, eyeY + 5.4);
          fp.quadraticCurveTo(4, eyeY + 8.2, 8, eyeY + 5.2);
          fp.moveTo(14.6, eyeY + 5.2);
          fp.quadraticCurveTo(18, eyeY + 7.8, 21, eyeY + 5);
          fp.moveTo(23.4, eyeY - 2.4);
          fp.lineTo(27.6, eyeY - 4.6);
          fp.moveTo(23.8, eyeY + 0.2);
          fp.lineTo(28.4, eyeY - 0.2);
        }
        // bushy brows: hairs flicking up off the top, a few strokes inside
        const angry = face === 'angry' || face === 'block';
        const sad = face === 'sad';
        const bh = new Path2D();
        for (const [bx, w, ang, dir] of [[3, 15, angry ? 0.35 : sad ? -0.3 : -0.1, -1], [19, 13, angry ? -0.35 : sad ? 0.3 : 0.1, 1]]) {
          brow(ctx, bx, eyeY - 9, ang, w, pal.brow, ink);
          rframe(bx, eyeY - 9, ang);
          for (let i = 0; i < 4; i++) {
            const u = -w / 2 + 2.4 + (i * (w - 4.8)) / 3;
            rM(bh, u, -2.4);
            rL(bh, u + dir * 2, -5.8);
          }
          for (let i = 0; i < 3; i++) {
            const u = -w / 2 + 3.4 + (i * (w - 6.8)) / 2;
            rM(fp, u - dir * 1.2, 2);
            rL(fp, u + dir * 1.4, -1.4);
          }
        }
        stroke(ctx, bh, 2, pal.brow);
        if (angry) {
          // a furrow between the brows
          fp.moveTo(11.4, -13.5);
          fp.quadraticCurveTo(12, -10.5, 11.3, -7);
        }
        stroke(ctx, fp, 1.7, ink);
        // big nose
        Draw.ellipse(ctx, 25, 7, 7.5, 6.5, 0, U.shade(pal.skin, -0.06), lw * 0.7, pal.ink);
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath();
        ctx.ellipse(23, 5, 2.5, 1.6, 0, 0, TAU);
        ctx.fill();
        // stubble (when the dots are big enough to see)
        if (ds > 0.75) {
          const sb = new Path2D(), sr = ds > 1.6 ? 0.7 : 0.85;
          for (let i = 0; i < STUBBLE.length; i++) {
            const x = STUBBLE[i][0], y = STUBBLE[i][1];
            sb.moveTo(x + sr, y);
            sb.arc(x, y, sr, 0, TAU);
          }
          fill(ctx, sb, tn.stub);
        }
        // mouth under the mustache
        if (face === 'happy' || face === 'normal' || face === 'block') {
          ctx.beginPath();
          ctx.moveTo(4, 17);
          ctx.quadraticCurveTo(16, 30, 28, 16);
          ctx.closePath();
          Draw.fillStroke(ctx, '#8c2f45', 2.6, pal.ink);
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(6, 18);
          ctx.lineTo(26, 17.5);
          ctx.lineTo(24, 21);
          ctx.lineTo(8, 21);
          ctx.closePath();
          ctx.fill();
        } else if (face === 'angry') {
          Draw.roundRect(ctx, 6, 16, 20, 8, 3, '#ffffff', 2.6, pal.ink);
          ctx.strokeStyle = pal.ink;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          for (const x of [11, 16, 21]) {
            ctx.moveTo(x, 16);
            ctx.lineTo(x, 24);
          }
          ctx.stroke();
        } else {
          Draw.ellipse(ctx, 16, 21, 6, 5, 0, '#8c2f45', 2.6, pal.ink);
        }
        // the nose's wing, and the gaps between the front teeth
        const np = new Path2D();
        np.moveTo(22.2, 2.6);
        np.quadraticCurveTo(18.6, 6.4, 21, 10.2);
        if (ds > 1.2 && (face === 'happy' || face === 'normal' || face === 'block')) {
          for (const x of [11.5, 16, 20.5]) {
            np.moveTo(x, 18.6);
            np.lineTo(x - 0.2, 20.8);
          }
        }
        stroke(ctx, np, 1.6, ink);
        // magnificent handlebar mustache
        ctx.beginPath();
        ctx.moveTo(16, 10);
        ctx.quadraticCurveTo(6, 8, 0, 14);
        ctx.quadraticCurveTo(-6, 18, -8, 10);
        ctx.quadraticCurveTo(-9, 18, -2, 19);
        ctx.quadraticCurveTo(8, 19, 16, 14);
        ctx.quadraticCurveTo(26, 19, 34, 18);
        ctx.quadraticCurveTo(41, 16, 39, 8);
        ctx.quadraticCurveTo(38, 15, 32, 14);
        ctx.quadraticCurveTo(26, 8, 16, 10);
        ctx.closePath();
        Draw.fillStroke(ctx, pal.stache, lw * 0.75, pal.ink);
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.beginPath();
        ctx.ellipse(24, 12, 5, 1.5, 0.1, 0, TAU);
        ctx.fill();
        // strands combed out along both wings and into the curls, the fold of
        // the cheek behind it and a cleft chin
        const mp = new Path2D();
        mp.moveTo(16, 10.8);
        mp.lineTo(16.2, 13.4);
        mp.moveTo(14.6, 11.6);
        mp.quadraticCurveTo(7, 10.6, 1, 15);
        mp.moveTo(14.2, 13.8);
        mp.quadraticCurveTo(6, 16.6, -3.4, 17.4);
        mp.moveTo(9.4, 12.4);
        mp.quadraticCurveTo(4.4, 13.6, 1.4, 16.8);
        mp.moveTo(-3.8, 16.4);
        mp.quadraticCurveTo(-7.4, 16, -7.6, 12.2);
        mp.moveTo(17.6, 11.4);
        mp.quadraticCurveTo(26, 10.8, 32, 14.6);
        mp.moveTo(18, 14.4);
        mp.quadraticCurveTo(26, 17.6, 35, 16.6);
        mp.moveTo(23, 13.2);
        mp.quadraticCurveTo(28.4, 14.4, 31.4, 16.6);
        mp.moveTo(35.2, 15.4);
        mp.quadraticCurveTo(38.6, 14.6, 38.6, 10.6);
        if (face !== 'ko') {
          mp.moveTo(-10, 13.6);
          mp.quadraticCurveTo(face === 'happy' ? -14.5 : -12.8, 19, -10.2, 24.6);
        }
        mp.moveTo(13.2, 26.2);
        mp.quadraticCurveTo(14.2, 27.6, 13.6, 29.4);
        stroke(ctx, mp, 1.4, ink);
        if (face === 'hurt') {
          // sweat drop
          Draw.ellipse(ctx, -16, -10, 3, 5, 0.3, '#9fe0ff', 2, pal.ink);
        }
      },
      hand(ctx, f, J, e, h, style, col, pal, back) {
        const r = f.C.body.handR, pc = back ? pal.dark : pal;
        const ang = Math.atan2(h[1] - e[1], h[0] - e[0]);
        ctx.save();
        ctx.translate(h[0], h[1]);
        ctx.rotate(ang);
        // (palm and thumb on -y, the fingers' ends at +x)
        const p = new Path2D();
        if (style === 'open') {
          const cx = r * 0.3, ex = r * 1.15, ey = r * 0.95;
          Draw.ellipse(ctx, cx, 0, ex, ey, 0, col, f.C.lw, pal.ink);
          // tape wound round the palm
          const a0 = Math.acos((-r * 0.42 - cx) / ex), a1 = Math.acos((r * 0.12 - cx) / ex);
          ctx.beginPath();
          ctx.ellipse(cx, 0, ex + 0.6, ey + 0.6, 0, -a0, -a1);
          ctx.ellipse(cx, 0, ex + 0.6, ey + 0.6, 0, a1, a0);
          ctx.closePath();
          ctx.fillStyle = pc.tape;
          ctx.fill();
          Draw.ellipse(ctx, r * 0.1, -r * 0.85, r * 0.45, r * 0.32, -0.5, col, f.C.lw * 0.7, pal.ink);
          // fingers, their knuckles, a palm crease and the tape's wraps
          for (const y of [-0.42, 0.02, 0.44]) {
            p.moveTo(r * 0.9, y * r);
            p.lineTo(r * 1.4, y * r * 1.06);
          }
          p.moveTo(r * 0.6, -r * 0.78);
          p.quadraticCurveTo(r * 0.78, 0, r * 0.6, r * 0.8);
          p.moveTo(r * 0.24, -r * 0.3);
          p.quadraticCurveTo(r * 0.44, r * 0.1, r * 0.3, r * 0.5);
          p.moveTo(-r * 0.3, -r * 0.72);
          p.lineTo(-r * 0.1, r * 0.78);
          p.moveTo(-r * 0.06, -r * 0.8);
          p.lineTo(r * 0.1, r * 0.82);
        } else {
          Draw.roundRect(ctx, -r * 0.7, -r * 0.95, r * 1.9, r * 1.9, r * 0.6, col, f.C.lw, pal.ink);
          // a strip of tape round the middle of the fist
          ctx.beginPath();
          ctx.rect(-r * 0.12, -r * 0.95 - 0.6, r * 0.52, r * 1.9 + 1.2);
          ctx.fillStyle = pc.tape;
          ctx.fill();
          // the fingers curled in front of the knuckles, the thumb over them,
          // and the tape's wraps
          p.moveTo(r * 0.6, -r * 0.92);
          p.quadraticCurveTo(r * 0.8, 0, r * 0.6, r * 0.92);
          for (const y of [-0.46, 0, 0.46]) {
            p.moveTo(r * 0.76, y * r);
            p.lineTo(r * 1.17, y * r);
          }
          p.moveTo(-r * 0.62, -r * 0.5);
          p.quadraticCurveTo(r * 0.1, -r * 0.34, r * 0.82, -r * 0.6);
          p.moveTo(r * 0.82, -r * 0.6);
          p.quadraticCurveTo(r * 0.92, -r * 0.78, r * 0.86, -r * 0.94);
          p.moveTo(-r * 0.02, -r * 0.94);
          p.lineTo(r * 0.12, r * 0.94);
          p.moveTo(r * 0.16, -r * 0.94);
          p.lineTo(r * 0.3, r * 0.94);
          p.moveTo(-r * 0.5, r * 0.3);
          p.quadraticCurveTo(-r * 0.36, r * 0.55, -r * 0.42, r * 0.8);
        }
        stroke(ctx, p, back ? 1.2 : 1.35, pal.ink);
        ctx.restore();
      },
      arm(ctx, f, J, side, pc, pal) {
        const C = f.C, b = C.body, back = side === 'B', P = J.P;
        const s = back ? J.sB : J.sF, e = back ? J.eB : J.eF, h = back ? J.hB : J.hF;
        const r0 = b.armR[0], r1 = b.armR[1], r2 = b.armR[2];
        Rig.limb(ctx, s, e, h, r0, r1, r2, pc.skin, pc.skin, C.lw, pal.ink);
        Rig.band(ctx, e, h, r1, r2, C.cuff[0], C.cuff[1], pc[C.cuff[2]], C.lw, pal.ink);
        armDetail(ctx, s, e, h, r0, r1, r2, back, pc, pal);
        const hs = back ? P.handB || C.handDef : P.hand || C.handDef;
        if (hs !== 'none') Rig.drawHand(ctx, f, J, e, h, hs, pc.skin, pal, back);
      },
      leg(ctx, f, J, side, pc, pal) {
        const b = f.C.body;
        const back = side === 'B';
        const hp = back ? J.hipB : J.hipF, k = back ? J.kB : J.kF, a = back ? J.aB : J.aF, t = back ? J.tB : J.tF;
        Rig.limb(ctx, hp, k, a, b.legR[0], b.legR[1], b.legR[2], pc.singlet, pc.skin, f.C.lw, pal.ink);
        // tall boots
        Rig.band(ctx, k, a, b.legR[1], b.legR[2], 0.38, 1.0, pc.boot, f.C.lw, pal.ink);
        Rig.band(ctx, k, a, b.legR[1], b.legR[2], 0.38, 0.5, pc.bootTrim, f.C.lw * 0.7, pal.ink);
        // knee pad
        const pa = Math.atan2(a[1] - k[1], a[0] - k[0]);
        Draw.ellipse(ctx, k[0], k[1], 13, 11, pa, pc.pad, f.C.lw * 0.8, pal.ink);
        Rig.drawFoot(ctx, f, J, a, t, pc.boot, pal, back);
        // ---- detail: everything here is clear of the pad and the boot's foot
        const tn = tones(pc), p = new Path2D(), d = new Path2D(), lc = new Path2D();
        // the singlet's hem above the knee, and its stitching
        frame(hp, k, b.legR[0], b.legR[1]);
        M(p, 0.6, -1.0);
        Q(p, 0.635, 0, 0.6, 1.0);
        M(d, 0.53, -0.92);
        Q(d, 0.565, 0, 0.53, 0.92);
        // stitching round the boot's trim, laces up the front of the shaft
        frame(k, a, b.legR[1], b.legR[2]);
        M(d, 0.448, -0.98);
        Q(d, 0.462, 0, 0.448, 0.98);
        for (let i = 0; i < 2; i++) {
          const t0 = 0.5 + i * 0.08;
          M(lc, t0, 0.4);
          Ln(lc, t0 + 0.08, 0.95);
          M(lc, t0, 0.95);
          Ln(lc, t0 + 0.08, 0.4);
        }
        // knee pad: a stitched ring and a seam across
        rframe(k[0], k[1], pa);
        d.moveTo(rx(8.8, 0), ry(8.8, 0));
        d.ellipse(k[0], k[1], 8.8, 7, pa, 0, TAU);
        rM(p, 1.2, -6.8);
        rQ(p, 3.2, 0, 1.2, 6.8);
        // the boot's foot: laces over the instep, toe cap, heel, welt
        // stitching and tread notches in the sole
        const L = Math.hypot(t[0] - a[0], t[1] - a[1]);
        rframe(a[0], a[1], Math.atan2(t[1] - a[1], t[0] - a[0]));
        for (const u of [2, 8.5]) {
          rM(lc, u, -10.4);
          rL(lc, u + 6, -5);
          rM(lc, u + 6, -10.4);
          rL(lc, u, -5);
        }
        rM(p, L - 0.5, -10.8);
        rQ(p, L - 7, -2.5, L - 0.5, 5.6);
        rM(p, -4.5, -10.8);
        rQ(p, -1, -2.5, -6, 5.6);
        rM(d, -9, 3.4);
        rL(d, L + 7.5, 3.4);
        const tr = new Path2D();
        for (let u = -8.5; u < L + 9; u += 4.6) {
          rM(tr, u, 10.4);
          rL(tr, u - 1.2, 13.2);
        }
        stroke(ctx, lc, back ? 1.3 : 1.5, tn.lace);
        stroke(ctx, p, back ? 1.1 : 1.3, pal.ink);
        stroke(ctx, d, 1, pal.ink, STITCH);
        stroke(ctx, tr, 1.5, tn.tread);
      },
      foot(ctx, f, J, a, t, col, pal) {
        const ang = Math.atan2(t[1] - a[1], t[0] - a[0]);
        const L = Math.hypot(t[0] - a[0], t[1] - a[1]);
        ctx.save();
        ctx.translate(a[0], a[1]);
        ctx.rotate(ang);
        Draw.roundRect(ctx, -12, -11, L + 22, 22, 10, col, f.C.lw, pal.ink);
        Draw.roundRect(ctx, -13, 6, L + 24, 7, 3, pal.ink, 0);
        ctx.restore();
      },
    },
  });
})();
