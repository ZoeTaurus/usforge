'use strict';
// ---------------------------------------------------------------------------
// The fighters' hand-drawn look: flat color shapes with no black outlines,
// and jagged black brush marks for shadows on the side away from the light.
//
// While a character is drawn, every path it builds is mirrored into a
// Path2D, so the characters' own drawing code needs no changes:
//   - a dark stroke around a shape that was just filled (its outline) is
//     dropped, and so is a dark stroke that only outlines a colored line
//     drawn over it,
//   - after a colored shape is filled, the far side of that same shape gets
//     a black mark with a spiky edge, hatching and ink specks, and its lit
//     edge a pale rim line, redrawn a little differently every few frames
//     like hand-drawn animation; limbs also get cloth folds and creases.
// Light comes from the fighter's front and above, so it mirrors with them.
// ---------------------------------------------------------------------------

const Sketch = {
  on: true,
  // 3: full ink, 2: marks and rims on bigger shapes only, 1: flat shapes
  // only. Lowered by Game.loop when a device can't keep up.
  quality: 3,
  depth: 0, // > 0 while a character is being drawn
  p: null, // the mirrored current path
  n: 0, // path operations since beginPath
  ok: false, // the mirror is usable (no transform change since beginPath)
  fillN: -1, // n when the current path was last filled with a solid color
  u0: 0, u1: 0, v0: 0, v1: 0, // extent of the path along / across the light
  lx: 0, ly: -1, // light direction in device space
  ink: '#000',
  seed: 0,
  boil: 0, // changes every 5 frames: the marks wobble like hand-drawn frames
  shapes: 0, // shadowed shapes so far in this character
  deferred: null, // a dark stroke that may turn out to be an outline
  part: null, // the body part being drawn (rig.js): sets how strongly it is inked
  dir: null, // a fixed local shading direction for the current part
  stack: [],
  epoch: 0, // bumped by every transform change
  lightEpoch: -1,
  light: [0, -1], // light in the current local frame (cached per epoch)
  scale: 1, // device pixels per local unit in that frame
  minPx: 12, // shapes thinner than this (device px) get no mark
  rims: false, // pale rim lines on every shape (costly: strokes whole outlines)
  m: [1, 0, 0, 1], // the linear part of the current transform, tracked here
  ms: [], // ... and its save() stack (getTransform is slow)
  _lum: new Map(),

  lum(c) {
    let v = this._lum.get(c);
    if (v === undefined) {
      const r = U.rgb(c);
      v = (0.299 * r[0] + 0.587 * r[1] + 0.114 * r[2]) / 255;
      this._lum.set(c, v);
    }
    return v;
  },
  // '#rrggbb' for an rgba() color at least `min` opaque, else null
  opaque(c, min) {
    const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?/.exec(c);
    if (!m || (m[4] !== undefined && +m[4] < min)) return null;
    return U.hex(+m[1], +m[2], +m[3]);
  },
  dark(c) {
    return typeof c === 'string' && c[0] === '#' && this.lum(c) < 0.2;
  },
  // drawing a character right now (outline passes in rig.js / draw.js skip)
  get active() {
    return this.depth > 0;
  },

  // ---- begin / end ----------------------------------------------------------
  // pal: the palette being drawn (its ink colors the shadows). seed varies the
  // brush marks between fighters. facing: for things drawn in world space
  // (projectiles), the side their owner faces.
  begin(ctx, pal, seed = 0, facing = 1) {
    if (!this.on) return;
    this.install(ctx);
    this.flush(ctx);
    this.stack.push([this.lx, this.ly, this.ink, this.seed, this.shapes, this.p, this.n, this.ok, this.fillN, this.u0, this.u1, this.v0, this.v1]);
    const m = ctx.getTransform();
    this.stack.push(this.m, this.ms);
    this.m = [m.a, m.b, m.c, m.d];
    this.ms = [];
    // light from the front and above, in the character's own space
    const cx = 0.5 * facing, cy = -0.86;
    const dx = m.a * cx + m.c * cy, dy = m.b * cx + m.d * cy;
    const d = Math.hypot(dx, dy) || 1;
    this.lx = dx / d;
    this.ly = dy / d;
    this.ink = U.rgba(pal && pal.ink ? pal.ink : INK, 0.92);
    this.seed = seed * 3.1;
    this.boil = Math.floor((typeof Game !== 'undefined' ? Game.frame : 0) / 5);
    this.shapes = 0;
    this.lightEpoch = -1;
    this.reset();
    this.depth++;
  },
  end(ctx) {
    if (!this.depth || !this.stack.length) return;
    if (ctx) this.flush(ctx);
    this.deferred = null;
    this.part = this.dir = null;
    this.epoch++;
    this.depth--;
    this.ms = this.stack.pop();
    this.m = this.stack.pop();
    [this.lx, this.ly, this.ink, this.seed, this.shapes, this.p, this.n, this.ok, this.fillN, this.u0, this.u1, this.v0, this.v1] = this.stack.pop();
  },

  reset() {
    this.p = new Path2D();
    this.n = 0;
    this.ok = true;
    this.fillN = -1;
    this.u0 = this.v0 = 1e9;
    this.u1 = this.v1 = -1e9;
  },
  // grow the path's extent by a point (with a radius) given in local units
  pt(ctx, x, y, r = 0) {
    const l = this.lightEpoch === this.epoch && !this.dir ? this.light : this.localLight();
    if (!l) return;
    const u = x * l[0] + y * l[1], v = y * l[0] - x * l[1];
    if (u - r < this.u0) this.u0 = u - r;
    if (u + r > this.u1) this.u1 = u + r;
    if (v - r < this.v0) this.v0 = v - r;
    if (v + r > this.v1) this.v1 = v + r;
  },

  // The light direction in the current local frame, as a unit vector
  // (getTransform is slow, so only when the transform changed).
  localLight() {
    if (this.dir) {
      this.lightEpoch = -1;
      const m = this.m;
      this.scale = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
      return (this.light = this.dir);
    }
    if (this.lightEpoch === this.epoch) return this.light;
    this.lightEpoch = this.epoch;
    const [a, b, c, d] = this.m;
    const det = a * d - b * c;
    if (Math.abs(det) < 1e-9) return (this.light = null);
    const x = (d * this.lx - c * this.ly) / det, y = (-b * this.lx + a * this.ly) / det;
    const l = Math.hypot(x, y) || 1;
    this.scale = Math.sqrt(Math.abs(det));
    return (this.light = [x / l, y / l]);
  },
  // keep the tracked matrix in step with the real one
  track(name, a) {
    const m = this.m;
    if (name === 'save') this.ms.push(m.slice());
    else if (name === 'restore') {
      if (this.ms.length) this.m = this.ms.pop();
    } else if (name === 'rotate') {
      const c = Math.cos(a[0]), s = Math.sin(a[0]);
      this.m = [m[0] * c + m[2] * s, m[1] * c + m[3] * s, m[2] * c - m[0] * s, m[3] * c - m[1] * s];
    } else if (name === 'scale') {
      const sy = a[1] === undefined ? a[0] : a[1];
      this.m = [m[0] * a[0], m[1] * a[0], m[2] * sy, m[3] * sy];
    } else if (name === 'transform') {
      this.m = [m[0] * a[0] + m[2] * a[1], m[1] * a[0] + m[3] * a[1], m[0] * a[2] + m[2] * a[3], m[1] * a[2] + m[3] * a[3]];
    } else if (name === 'setTransform') {
      const o = a.length === 1 && a[0] ? a[0] : null;
      this.m = o ? [o.a, o.b, o.c, o.d] : [a[0], a[1], a[2], a[3]];
    } else if (name === 'resetTransform') this.m = [1, 0, 0, 1];
  },

  // the mirror matches what the drawing code just filled / will stroke
  usable(ctx) {
    return this.ok && this.n > 0 && ctx.globalCompositeOperation === 'source-over';
  },

  // ---- fills ------------------------------------------------------------------
  // How strongly each part is inked (1 = full marks, hatching and specks).
  STRENGTH: { torso: 1, head: 0.6, armF: 0.75, legF: 0.75, armB: 0.55, legB: 0.55, stage: 0.85, button: 1.05 },

  afterFill(ctx, rule) {
    if (!this.usable(ctx)) return;
    let fs = ctx.fillStyle;
    const stage = this.part === 'stage' || this.part === 'button';
    // scenery also inks fairly opaque rgba() fills
    if (stage && typeof fs === 'string' && fs.startsWith('rgba')) fs = this.opaque(fs, 0.5);
    if (typeof fs !== 'string' || fs[0] !== '#') return;
    this.fillN = this.n; // its dark outline will be dropped
    // marks only on solid drawing (not on see-through afterimages)
    if (this.quality < 2 || ctx.globalAlpha < (stage ? 0.5 : 0.98) || !this.light) return;
    const L = this.lum(fs);
    if (L < (stage ? 0.1 : 0.2)) return;
    const ext = this.u1 - this.u0, wid = this.v1 - this.v0;
    const px = Math.min(ext, wid) * this.scale;
    if (px < (this.quality > 2 ? this.minPx : 22)) return;
    const st = this.STRENGTH[this.part] !== undefined ? this.STRENGTH[this.part] : 0.8;
    this.decorate(ctx, rule, this.shapes++, ext, wid, L > 0.95 ? 0 : st, fs, px);
  },

  // Inside the current path: a black mark over its far side whose edge is a
  // row of uneven spikes pointing toward the light, hatching and ink specks
  // running out of it, and a pale rim line along the lit edge.
  decorate(ctx, rule, k, ext, wid, st, fs, px) {
    const P = CanvasRenderingContext2D.prototype;
    const [ux, uy] = this.light;
    const vx = -uy, vy = ux;
    const h = (i) => U.hash(this.seed + k * 13.7 + i * 1.91) * 0.85 + U.hash(this.boil * 7.31 + k * 3.3 + i) * 0.15;
    const at = (u, v) => [u * ux + v * vx, u * uy + v * vy];
    const px1 = 1 / this.scale; // one device pixel in local units
    P.save.call(ctx);
    ctx.shadowColor = 'rgba(0,0,0,0)';
    P.clip.call(ctx, this.p, rule || 'nonzero');
    // pale rim along the lit edge (the outline moved toward the shadow side)
    const full = this.quality > 2;
    if (this.rims && this.lum(fs) < 0.86 && px >= 18) {
      const dd = Math.min(2.6 * px1, ext * 0.1);
      P.save.call(ctx);
      P.translate.call(ctx, -ux * dd, -uy * dd);
      ctx.lineWidth = 1.7 * px1;
      ctx.strokeStyle = U.rgba(U.mix(fs, '#ffffff', 0.5), 0.85);
      ctx.lineJoin = 'round';
      P.stroke.call(ctx, this.p);
      P.restore.call(ctx);
    }
    if (st > 0) {
      // big shapes (scenery) keep marks of a hand-drawn size: a fringe of many
      // teeth along the far side rather than one giant cut
      const E = Math.min(ext, 120 * px1);
      const m = 4 + E * 0.1;
      const base = this.u0 + E * (0.17 + 0.1 * h(0)) * (0.6 + 0.4 * st);
      const gap = Math.max(7, E * 0.34);
      const teeth = U.clamp(Math.round(wid / gap), 2, 48);
      const step = (wid + m * 2) / (teeth * 2);
      const path = new Path2D();
      let q = at(this.u0 - m, this.v1 + m);
      path.moveTo(q[0], q[1]);
      q = at(this.u0 - m, this.v0 - m);
      path.lineTo(q[0], q[1]);
      for (let i = 0; i <= teeth * 2; i++) {
        const v = this.v0 - m + i * step;
        const u = i % 2 ? base + E * (0.1 + 0.34 * h(i + 3)) * st : base - E * 0.05 * h(i + 7);
        q = at(u, v + (i % 2 ? (h(i + 11) - 0.5) * step * 0.8 : 0));
        path.lineTo(q[0], q[1]);
      }
      path.closePath();
      ctx.fillStyle = this.ink;
      P.fill.call(ctx, path);
      // hatching out of the mark into the light
      if (full && px >= 22) {
        const n = Math.min(60, Math.max(Math.round(2 + 4 * st * Math.min(1, px / 50)), Math.round((wid / gap) * 1.2)));
        const hp = new Path2D();
        for (let j = 0; j < n; j++) {
          const v = this.v0 + wid * (0.08 + (0.84 * (j + h(j + 20) * 0.6)) / n);
          const u0 = base - E * 0.02, u1 = base + E * (0.16 + 0.26 * h(j + 30)) * st;
          q = at(u0, v);
          hp.moveTo(q[0], q[1]);
          q = at(u1, v + (u1 - u0) * 0.45);
          hp.lineTo(q[0], q[1]);
        }
        ctx.lineWidth = 1.15 * px1;
        ctx.lineCap = 'round';
        ctx.strokeStyle = this.ink;
        P.stroke.call(ctx, hp);
      }
      // ink specks just past the mark
      if (full && px >= 30) {
        const sp = new Path2D();
        const ns = U.clamp(Math.round((wid / gap) * 0.6), 2, 30);
        for (let j = 0; j < ns; j++) {
          q = at(base + E * (0.32 + 0.22 * h(j + 40)) * st, this.v0 + wid * (0.05 + 0.9 * h(j + 50)));
          const r = (0.8 + 1.1 * h(j + 60)) * px1;
          sp.moveTo(q[0] + r, q[1]);
          sp.arc(q[0], q[1], r, 0, TAU);
        }
        P.fill.call(ctx, sp);
      }
    }
    P.restore.call(ctx);
  },

  // ---- limbs (called by Rig.limb in character space) --------------------------
  // A mark along the shadow side of the segment a-b (radii ra, rb), hatching,
  // a couple of cloth folds and a pale rim on the lit side.
  limbMark(ctx, a, b, ra, rb, k, fill) {
    if (!this.depth || this.quality < 2 || ctx.globalAlpha < 0.98) return;
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    if (L < 4) return;
    this.localLight();
    const px1 = 1 / this.scale;
    const back = this.part === 'armB' || this.part === 'legB';
    const st = back ? 0.6 : 1;
    const tx = dx / L, ty = dy / L;
    let nx = -ty, ny = tx;
    const lx = 0.5, ly = -0.86; // front and above, as in begin()
    let s = nx * lx + ny * ly;
    if (s < 0) {
      nx = -nx;
      ny = -ny;
      s = -s;
    }
    s = 0.35 + 0.65 * s;
    const r = Math.max(ra, rb), m = 3;
    const h = (i) => U.hash(this.seed + k * 7.3 + i * 2.17) * 0.85 + U.hash(this.boil * 7.31 + k * 3.3 + i) * 0.15;
    const at = (along, across) => [a[0] + tx * along + nx * across, a[1] + ty * along + ny * across];
    const P = CanvasRenderingContext2D.prototype;
    const clip = new Path2D();
    Draw.taper(clip, a[0], a[1], ra, b[0], b[1], rb);
    P.save.call(ctx);
    ctx.shadowColor = 'rgba(0,0,0,0)';
    P.clip.call(ctx, clip);
    // rim light
    if (fill && this.lum(fill) < 0.86) {
      const rp = new Path2D();
      let q = at(L * 0.12, r * 0.62);
      rp.moveTo(q[0], q[1]);
      const c = at(L * 0.45, r * 0.78);
      q = at(L * 0.8, r * 0.58);
      rp.quadraticCurveTo(c[0], c[1], q[0], q[1]);
      ctx.lineWidth = 1.7 * px1;
      ctx.lineCap = 'round';
      ctx.strokeStyle = U.rgba(U.mix(fill, '#ffffff', 0.5), 0.85);
      P.stroke.call(ctx, rp);
    }
    // the mark
    const path = new Path2D();
    let q = at(-r - m, -r - m);
    path.moveTo(q[0], q[1]);
    q = at(L + r + m, -r - m);
    path.lineTo(q[0], q[1]);
    const teeth = U.clamp(Math.round(L / 12), 2, 4);
    const step = (L + 2 * r + 2 * m) / (teeth * 2);
    const c0 = -r + 2 * r * (0.2 + 0.14 * h(0)) * s * st;
    const tips = [];
    for (let i = teeth * 2; i >= 0; i--) {
      const along = -r - m + i * step;
      if (i % 2) {
        const tip = c0 + 2 * r * (0.28 + 0.36 * h(i)) * s * st;
        tips.push([along, tip]);
        q = at(along + (h(i + 5) - 0.3) * step * 0.9, tip);
      } else q = at(along, c0 - r * 0.12 * h(i + 9));
      path.lineTo(q[0], q[1]);
    }
    path.closePath();
    ctx.fillStyle = this.ink;
    P.fill.call(ctx, path);
    // folds: thin curves from the shadow edge part-way across, and hatching
    const fp = new Path2D();
    const nf = back ? 1 : 2;
    for (let j = 0; j < nf; j++) {
      const al = L * (0.25 + 0.45 * ((j + h(j + 20)) / nf));
      q = at(al, c0);
      fp.moveTo(q[0], q[1]);
      const c = at(al + r * 0.5, c0 + r * 0.55);
      q = at(al + r * (0.2 + 0.5 * h(j + 25)), c0 + r * (0.8 + 0.5 * h(j + 27)));
      fp.quadraticCurveTo(c[0], c[1], q[0], q[1]);
    }
    for (let j = 0; j < (back || this.quality < 3 ? 1 : 3); j++) {
      const al = L * (0.1 + 0.8 * h(j + 33));
      q = at(al, c0 - r * 0.1);
      fp.moveTo(q[0], q[1]);
      q = at(al + r * 0.35, c0 + r * (0.35 + 0.35 * h(j + 37)));
      fp.lineTo(q[0], q[1]);
    }
    ctx.lineWidth = 1.2 * px1;
    ctx.lineCap = 'round';
    ctx.strokeStyle = this.ink;
    P.stroke.call(ctx, fp);
    P.restore.call(ctx);
  },

  // Creases on the inner side of a bent elbow or knee (b), between a and c.
  joint(ctx, a, b, c, rb) {
    if (!this.depth || this.quality < 3 || ctx.globalAlpha < 0.98) return;
    const ax = a[0] - b[0], ay = a[1] - b[1], cx = c[0] - b[0], cy = c[1] - b[1];
    const la = Math.hypot(ax, ay), lc = Math.hypot(cx, cy);
    if (la < 3 || lc < 3) return;
    const cos = (ax * cx + ay * cy) / (la * lc);
    if (cos < -0.93) return; // nearly straight
    let bx = ax / la + cx / lc, by = ay / la + cy / lc;
    const bl = Math.hypot(bx, by) || 1;
    bx /= bl;
    by /= bl;
    const px1 = 1 / this.scale;
    const ox = b[0] + bx * rb * 0.5, oy = b[1] + by * rb * 0.5;
    const P = CanvasRenderingContext2D.prototype;
    const cp = new Path2D();
    const w = rb * 0.75;
    for (let i = 0; i < 2; i++) {
      const d = i * rb * 0.32;
      cp.moveTo(ox - by * w + bx * d, oy + bx * w + by * d);
      cp.quadraticCurveTo(ox + bx * (d + rb * 0.25), oy + by * (d + rb * 0.25), ox + by * w * 0.8 + bx * d, oy - bx * w * 0.8 + by * d);
    }
    P.save.call(ctx);
    ctx.shadowColor = 'rgba(0,0,0,0)';
    ctx.lineWidth = 1.3 * px1;
    ctx.lineCap = 'round';
    ctx.strokeStyle = this.ink;
    P.stroke.call(ctx, cp);
    P.restore.call(ctx);
  },

  // ---- strokes ---------------------------------------------------------------
  // Returns true when the stroke should not be drawn now.
  beforeStroke(ctx) {
    const d = this.deferred;
    if (d) {
      // a colored line over a dark one on the same path: the dark one was its outline
      if (d.p === this.p && d.n === this.n && !this.dark(ctx.strokeStyle) && ctx.lineWidth < d.w) this.deferred = null;
      else this.flush(ctx);
    }
    if (!this.usable(ctx) || !this.dark(ctx.strokeStyle)) return false;
    // the outline of a filled shape (small ones like eyes keep theirs)
    if (this.fillN === this.n) return Math.min(this.u1 - this.u0, this.v1 - this.v0) * this.scale >= 12;
    // only a wide dark line can be the outline of a colored line drawn over it;
    // thin ones are details. On the lowest quality the finest details go.
    if (ctx.lineWidth < 2.6) return this.quality < 2 && ctx.lineWidth * this.scale < 1.6;
    this.deferred = { p: this.p, n: this.n, w: ctx.lineWidth, s: ctx.strokeStyle, cap: ctx.lineCap, join: ctx.lineJoin, dash: ctx.getLineDash(), off: ctx.lineDashOffset, a: ctx.globalAlpha, epoch: this.epoch };
    return true;
  },
  // draw a dark stroke that turned out not to be an outline
  flush(ctx) {
    const d = this.deferred;
    if (!d) return;
    this.deferred = null;
    if (d.epoch !== this.epoch) return;
    const P = CanvasRenderingContext2D.prototype;
    P.save.call(ctx);
    ctx.lineWidth = d.w;
    ctx.strokeStyle = d.s;
    ctx.lineCap = d.cap;
    ctx.lineJoin = d.join;
    ctx.setLineDash(d.dash);
    ctx.lineDashOffset = d.off;
    ctx.globalAlpha = d.a;
    P.stroke.call(ctx, d.p);
    P.restore.call(ctx);
  },

  // ---- mirroring ------------------------------------------------------------
  install(ctx) {
    if (ctx.__sketch) return;
    ctx.__sketch = true;
    const P = CanvasRenderingContext2D.prototype, S = this;
    ctx.beginPath = function () {
      if (S.depth) {
        if (S.deferred) S.flush(this);
        S.reset();
      }
      P.beginPath.call(this);
    };
    ctx.moveTo = function (x, y) {
      if (S.depth) {
        S.p.moveTo(x, y);
        S.n++;
        S.pt(this, x, y);
      }
      P.moveTo.call(this, x, y);
    };
    ctx.lineTo = function (x, y) {
      if (S.depth) {
        S.p.lineTo(x, y);
        S.n++;
        S.pt(this, x, y);
      }
      P.lineTo.call(this, x, y);
    };
    ctx.quadraticCurveTo = function (cx, cy, x, y) {
      if (S.depth) {
        S.p.quadraticCurveTo(cx, cy, x, y);
        S.n++;
        S.pt(this, cx, cy);
        S.pt(this, x, y);
      }
      P.quadraticCurveTo.call(this, cx, cy, x, y);
    };
    ctx.bezierCurveTo = function (ax, ay, bx, by, x, y) {
      if (S.depth) {
        S.p.bezierCurveTo(ax, ay, bx, by, x, y);
        S.n++;
        S.pt(this, ax, ay);
        S.pt(this, bx, by);
        S.pt(this, x, y);
      }
      P.bezierCurveTo.call(this, ax, ay, bx, by, x, y);
    };
    ctx.arc = function (x, y, r, a0, a1, ccw) {
      if (S.depth) {
        S.p.arc(x, y, r, a0, a1, ccw);
        S.n++;
        S.pt(this, x, y, Math.abs(r));
      }
      P.arc.call(this, x, y, r, a0, a1, ccw);
    };
    ctx.arcTo = function (x1, y1, x2, y2, r) {
      if (S.depth) {
        S.p.arcTo(x1, y1, x2, y2, r);
        S.n++;
        S.pt(this, x1, y1);
        S.pt(this, x2, y2);
      }
      P.arcTo.call(this, x1, y1, x2, y2, r);
    };
    ctx.ellipse = function (x, y, rx, ry, rot, a0, a1, ccw) {
      if (S.depth) {
        S.p.ellipse(x, y, rx, ry, rot, a0, a1, ccw);
        S.n++;
        S.pt(this, x, y, Math.max(Math.abs(rx), Math.abs(ry)));
      }
      P.ellipse.call(this, x, y, rx, ry, rot, a0, a1, ccw);
    };
    ctx.rect = function (x, y, w, h) {
      if (S.depth) {
        S.p.rect(x, y, w, h);
        S.n++;
        S.pt(this, x, y);
        S.pt(this, x + w, y);
        S.pt(this, x, y + h);
        S.pt(this, x + w, y + h);
      }
      P.rect.call(this, x, y, w, h);
    };
    ctx.closePath = function () {
      if (S.depth) S.p.closePath();
      P.closePath.call(this);
    };
    // a transform change in the middle of a path makes the mirror unusable
    for (const name of ['translate', 'rotate', 'scale', 'transform', 'setTransform', 'resetTransform', 'restore']) {
      const fn = P[name];
      if (!fn) continue;
      ctx[name] = function (...a) {
        if (S.depth) {
          if (S.deferred) S.flush(this);
          if (S.n) S.ok = false;
          if (name !== 'translate') {
            S.epoch++;
            S.track(name, a);
          }
        }
        return fn.apply(this, a);
      };
    }
    ctx.save = function () {
      if (S.depth) S.track('save');
      P.save.call(this);
    };
    // scenery is full of plain rectangles: ink those too (as a one-off path)
    ctx.fillRect = function (x, y, w, h) {
      P.fillRect.call(this, x, y, w, h);
      if (S.depth && S.part === 'stage' && S.quality > 1 && Math.abs(w) * Math.abs(h) > 60) {
        const keep = [S.p, S.n, S.ok, S.fillN, S.u0, S.u1, S.v0, S.v1];
        S.reset();
        S.p.rect(x, y, w, h);
        S.n = 1;
        S.pt(this, x, y);
        S.pt(this, x + w, y);
        S.pt(this, x, y + h);
        S.pt(this, x + w, y + h);
        S.afterFill(this);
        [S.p, S.n, S.ok, S.fillN, S.u0, S.u1, S.v0, S.v1] = keep;
      }
    };
    ctx.fill = function (a, b) {
      if (a !== undefined && typeof a !== 'string') {
        // an explicit Path2D: drawn as is
        if (b !== undefined) P.fill.call(this, a, b);
        else P.fill.call(this, a);
        return;
      }
      if (S.depth && S.deferred) S.flush(this);
      if (a !== undefined) P.fill.call(this, a);
      else P.fill.call(this);
      if (S.depth) S.afterFill(this, a);
    };
    ctx.stroke = function (a) {
      if (a !== undefined) {
        P.stroke.call(this, a);
        return;
      }
      if (S.depth && S.beforeStroke(this)) return;
      P.stroke.call(this);
    };
  },
};
