'use strict';
// ---------------------------------------------------------------------------
// KIRI — quick as a whisper. A ninja with a fox mask, a kunai and a scarf
// that never stops fluttering. Speed: shuriken, Shadow Step teleports behind
// you, Fox Fang slashes straight through you.
// ---------------------------------------------------------------------------
(() => {
  // ---- cloth: verlet chains simulated in world space ------------------------
  function simChain(ch, ax, ay, n, seg, o) {
    let P = ch.p;
    if (!P || P.length !== n || Math.abs(P[0].x - ax) + Math.abs(P[0].y - ay) > 160) {
      P = ch.p = [];
      const dir = o.windX < 0 ? -1 : 1;
      for (let i = 0; i < n; i++) {
        const x = ax + dir * i * seg * 0.9, y = ay + i * seg * 0.35;
        P.push({ x, y, px: x, py: y });
      }
    }
    P[0].x = P[0].px = ax;
    P[0].y = P[0].py = ay;
    for (let i = 1; i < n; i++) {
      const p = P[i];
      const vx = (p.x - p.px) * o.damp, vy = (p.y - p.py) * o.damp;
      p.px = p.x;
      p.py = p.y;
      const k = i / (n - 1);
      p.x += vx + o.windX * k + Math.sin(o.t * 0.23 + i * 0.8 + o.phase) * o.flutter * k;
      p.y += vy + o.grav + Math.cos(o.t * 0.19 + i * 0.9 + o.phase) * o.flutter * 0.6 * k;
    }
    for (let it = 0; it < 4; it++) {
      for (let i = 1; i < n; i++) {
        const a = P[i - 1], b = P[i];
        let dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.001;
        const diff = (d - seg) / d;
        if (i === 1) {
          b.x -= dx * diff;
          b.y -= dy * diff;
        } else {
          dx *= diff * 0.5;
          dy *= diff * 0.5;
          a.x += dx;
          a.y += dy;
          b.x -= dx;
          b.y -= dy;
        }
      }
      // the floor is at world y = 0 (screen direction, up = negative)
      for (let i = 1; i < n; i++) if (P[i].y > -3) P[i].y = -3;
    }
  }

  // chain points in character space; procedural fallback for afterimages,
  // menus and dev views (anything that isn't the live pose)
  function chainLocal(f, J, ch, ax, ay, n, seg, droop) {
    const out = [];
    if (J === f.J && ch && ch.p && ch.p.length === n) {
      const fx = f.x || 0, fy = f.y || 0, fc = f.facing || 1;
      for (const p of ch.p) out.push([(p.x - fx) * fc, p.y + fy]);
      out[0] = [ax, ay];
      return out;
    }
    for (let i = 0; i < n; i++) out.push([ax - i * seg * 0.92, ay + i * seg * droop + Math.sin(i * 1.1) * 3]);
    return out;
  }

  function smoothThrough(ctx, pts, move) {
    if (move) ctx.moveTo(pts[0][0], pts[0][1]);
    else ctx.lineTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    const l = pts[pts.length - 1];
    ctx.lineTo(l[0], l[1]);
  }

  // ---- hand-drawn detail --------------------------------------------------------
  // Detail lines are built on a Path2D and stroked straight onto the canvas (never
  // right after filling that same path), so the sketch pass keeps them as ink;
  // one path carries many lines. See-through afterimages get none, slow devices
  // only the main ones, and lines that would come out under about a device pixel
  // are left off.
  const TONES = new WeakMap();
  // tints derived from a palette (or its .dark half), made once per palette
  function tones(pc) {
    let t = TONES.get(pc);
    if (!t) {
      const ink = pc.ink || INK;
      t = {
        soft: U.rgba(ink, 0.62),
        faint: U.rgba(ink, 0.34),
        plate: U.mix(pc.gi, ink, 0.4),
        plateL: U.mix(pc.gi, '#ffffff', 0.3),
        pouch: U.mix(pc.glove, ink, 0.22),
        flap: U.mix(pc.glove, ink, 0.4),
        rivet: U.mix(pc.steel, '#ffffff', 0.35),
        steelD: U.mix(pc.steel, ink, 0.26),
        sole: U.mix(pc.tabi, ink, 0.55),
        scarfD: U.mix(pc.scarf, ink, 0.3),
        white: 'rgba(255,255,255,0.7)',
      };
      TONES.set(pc, t);
    }
    return t;
  }
  // 0: none (see-through afterimages), 1: the main lines, 2: everything
  function lod(ctx) {
    return ctx.globalAlpha < 0.97 ? 0 : Sketch.quality >= 2 ? 2 : 1;
  }
  // device pixels per local unit
  function pxScale(ctx) {
    const m = ctx.getTransform();
    return Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
  }
  function inkLines(ctx, p, w, col) {
    const sb = ctx.shadowBlur;
    if (sb) ctx.shadowBlur = 0;
    ctx.lineWidth = w;
    ctx.strokeStyle = col;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(p);
    if (sb) ctx.shadowBlur = sb;
  }
  function flat(ctx, p, col) {
    const sb = ctx.shadowBlur;
    if (sb) ctx.shadowBlur = 0;
    ctx.fillStyle = col;
    ctx.fill(p);
    if (sb) ctx.shadowBlur = sb;
  }
  const MIX = new Map();
  function mixC(a, b, t) {
    const k = a + b + t;
    let v = MIX.get(k);
    if (v === undefined) {
      v = U.mix(a, b, t);
      MIX.set(k, v);
    }
    return v;
  }
  function dot(p, x, y, r) {
    p.moveTo(x + r, y);
    p.arc(x, y, r, 0, TAU);
  }
  // a point at fraction t along a->b, pushed off by o along its normal
  function along(a, b, t, o) {
    const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
    return [a[0] + dx * t - (dy / d) * o, a[1] + dy * t + (dx / d) * o];
  }

  // a twisting ribbon with a notched end (scarf tails): woven stripes near the
  // end, a fold crease, a hem and a frayed fringe
  function ribbon(ctx, pts, w0, w1, col, colL, ink, lw, t, phase, lv) {
    const n = pts.length;
    const L = [], R = [];
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[Math.min(n - 1, i + 1)], o = pts[Math.max(0, i - 1)];
      let dx = q[0] - o[0], dy = q[1] - o[1];
      const d = Math.hypot(dx, dy) || 1;
      dx /= d;
      dy /= d;
      const tw = 0.55 + 0.45 * Math.abs(Math.cos(i * 0.7 + t * 0.12 + phase));
      const w = ((w0 + (w1 - w0) * (i / (n - 1))) / 2) * tw;
      L.push([p[0] - dy * w, p[1] + dx * w]);
      R.push([p[0] + dy * w, p[1] - dx * w]);
    }
    const e = pts[n - 1], e2 = pts[n - 2];
    const ex = e[0] - e2[0], ey = e[1] - e2[1], ed = Math.hypot(ex, ey) || 1;
    const ux = ex / ed, uy = ey / ed;
    const apex = [e[0] - ux * w1 * 0.7, e[1] - uy * w1 * 0.7];
    ctx.beginPath();
    smoothThrough(ctx, L, true);
    ctx.lineTo(apex[0], apex[1]);
    smoothThrough(ctx, R.slice().reverse(), false);
    ctx.closePath();
    Draw.fillStroke(ctx, col, lw, ink);
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = colL;
    ctx.lineWidth = Math.max(2, w0 * 0.22);
    ctx.lineCap = 'round';
    ctx.beginPath();
    smoothThrough(ctx, L.map((p, i) => [p[0] * 0.65 + pts[i][0] * 0.35, p[1] * 0.65 + pts[i][1] * 0.35]), true);
    ctx.stroke();
    const lerpAt = (A, q) => {
      const i = Math.min(n - 2, Math.floor(q)), k = q - i;
      return [A[i][0] + (A[i + 1][0] - A[i][0]) * k, A[i][1] + (A[i + 1][1] - A[i][1]) * k];
    };
    if (lv) {
      // woven stripes across the tail near its end
      const sp = new Path2D();
      for (const q of [n - 2.7, n - 2.2]) {
        const a = lerpAt(L, q), b = lerpAt(R, q);
        sp.moveTo(a[0] + (a[0] - b[0]) * 0.3, a[1] + (a[1] - b[1]) * 0.3);
        sp.lineTo(b[0] + (b[0] - a[0]) * 0.3, b[1] + (b[1] - a[1]) * 0.3);
      }
      inkLines(ctx, sp, 2.4, colL);
      // a fold crease down the shadow side, and the hem stitched above the fringe
      const cp = new Path2D();
      smoothThrough(cp, R.slice(1, n - 1).map((p, i) => [p[0] * 0.55 + pts[i + 1][0] * 0.45, p[1] * 0.55 + pts[i + 1][1] * 0.45]), true);
      const h0 = L[n - 1], h1 = R[n - 1];
      cp.moveTo(h0[0] - ux * 3, h0[1] - uy * 3);
      cp.lineTo(apex[0] - ux * 3, apex[1] - uy * 3);
      cp.lineTo(h1[0] - ux * 3, h1[1] - uy * 3);
      inkLines(ctx, cp, 1.2, ink);
    }
    ctx.restore();
    if (lv) {
      // frayed fringe off the notched end
      const fp = new Path2D();
      const h0 = L[n - 1], h1 = R[n - 1];
      for (let k = 0; k < 8; k++) {
        const s = (k + 0.5) / 8;
        const a = s < 0.5 ? h0 : apex, b = s < 0.5 ? apex : h1, m = s < 0.5 ? s * 2 : (s - 0.5) * 2;
        const x = a[0] + (b[0] - a[0]) * m, y = a[1] + (b[1] - a[1]) * m;
        const len = 3.5 + 3 * U.hash(k * 3.7 + phase), wob = Math.sin(t * 0.3 + k * 1.9 + phase) * 1.4;
        fp.moveTo(x - ux, y - uy);
        fp.quadraticCurveTo(x + ux * len * 0.5 - uy * wob, y + uy * len * 0.5 + ux * wob, x + ux * len, y + uy * len);
      }
      inkLines(ctx, fp, 1.1, col);
    }
  }

  // ---- props & effects ----------------------------------------------------------
  function shurikenShape(ctx, x, y, r, rot, pal) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU;
      const b = a + TAU / 8;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      ctx.lineTo(Math.cos(b) * r * 0.36, Math.sin(b) * r * 0.36);
    }
    ctx.closePath();
    Draw.fillStroke(ctx, pal.steel, 3, pal.ink);
    const solid = ctx.globalAlpha > 0.97;
    if (solid) {
      // one bevel of each blade in shadow, a ridge down every blade
      const tn = tones(pal);
      const bv = new Path2D(), rp = new Path2D();
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU, b = a + TAU / 8;
        bv.moveTo(0, 0);
        bv.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        bv.lineTo(Math.cos(b) * r * 0.36, Math.sin(b) * r * 0.36);
        bv.closePath();
        rp.moveTo(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3);
        rp.lineTo(Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86);
      }
      flat(ctx, bv, tn.steelD);
      dot(rp, 0, 0, r * 0.34);
      inkLines(ctx, rp, 1.2, pal.ink);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(r * 0.9, 0);
    ctx.lineTo(r * 0.3, -r * 0.2);
    ctx.closePath();
    ctx.fill();
    Draw.circle(ctx, 0, 0, r * 0.18, pal.ink, 0);
    ctx.restore();
  }

  function shuriken(f, x, y, vx, vy, dmg) {
    const b = f.battle;
    if (!b) return;
    const pal = f.pal;
    b.spawn(f, {
      x, y, vx, vy, r: 12, life: 90, hits: 1, strength: 1, floor: 6, rot: 0,
      hit: normHit({ dmg, hs: 16, bs: 10, kb: [3, 0], spark: 'L', sfx: 'hitM', stop: 6, chip: Math.round(dmg * 0.15) }, 'S', 'special'),
      tick(p) {
        if (!p.stuck) p.rot += 0.55 * (p.vx >= 0 ? 1 : -1);
      },
      onFloor(p) {
        // stick into the ground for a moment
        p.vx = p.vy = 0;
        p.hit = null;
        p.stuck = true;
        p.life = p.age + 26;
        FX.add({ type: 'dot', x: p.x, y: -4, vx: 0, vy: -1, size: 4, life: 10, color: '#ffffff', lw: 0 });
      },
      onEnd(p, why) {
        if (why === 'hit' || why === 'clash') FX.add({ type: 'shard', x: p.x, y: -p.y, vx: -p.vx * 0.2, vy: -3, grav: 0.4, size: 9, life: 18, color: pal.steel, vr: 0.4 });
      },
      draw(ctx, sx, sy, p) {
        if (!p.stuck) {
          ctx.save();
          ctx.globalAlpha = 0.35;
          shurikenShape(ctx, sx - p.vx * 1.4, sy + p.vy * 1.4, p.r, p.rot - 0.5, pal);
          ctx.restore();
        }
        shurikenShape(ctx, sx, sy, p.r, p.rot, pal);
      },
    });
  }

  function slashFX(x, y, ang, len, color) {
    FX.add({
      type: 'custom', x, y, vx: 0, vy: 0, life: 12, layer: 1,
      draw(ctx, p, sx, sy, t) {
        const L = len * (0.55 + 0.45 * U.ease.out(Math.min(1, t * 4)));
        const w = 16 * (1 - t);
        ctx.globalAlpha = 1 - t * t;
        ctx.translate(sx, sy);
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.moveTo(-L / 2, 0);
        ctx.quadraticCurveTo(0, -w * 1.6, L / 2, 0);
        ctx.quadraticCurveTo(0, -w * 0.4, -L / 2, 0);
        ctx.closePath();
        Draw.fillStroke(ctx, '#ffffff', 3, INK);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-L * 0.4, -w * 0.25);
        ctx.quadraticCurveTo(0, -w * 1.15, L * 0.4, -w * 0.25);
        ctx.stroke();
      },
    });
  }

  function smokePuff(x, y, n, pal) {
    FX.smoke(x, y, n, U.mix(pal.gi, '#ffffff', 0.35));
    for (let i = 0; i < 3; i++) {
      FX.add({ type: 'petal', x: x + U.rand(-30, 30), y: y + U.rand(-40, 20), vx: U.rand(-2, 2), vy: U.rand(-2.5, -0.5), size: 7, life: 30, color: pal.scarf, vr: U.rand(-0.2, 0.2) });
    }
  }

  function teleportBehind(f) {
    const o = f.opp;
    const side = Math.sign(o.x - f.x) || f.facing;
    let tx = o.x + side * 82;
    // a cornered opponent can't be passed: reappear in front instead
    if (tx < WALL + 6 || tx > STAGE_W - WALL - 6) tx = o.x - side * 82;
    f.x = U.clamp(tx, WALL, STAGE_W - WALL);
    f.y = 0;
    f.vx = 0;
    f.vy = 0;
    f.faceOpp();
  }

  // ---- face -----------------------------------------------------------------------
  function eye(ctx, pal, x, y, w, h, face, blink, far, lv) {
    const ink = pal.ink;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (face === 'hurt') {
      ctx.lineWidth = 3.2;
      ctx.strokeStyle = ink;
      ctx.beginPath();
      if (far) {
        ctx.moveTo(x + w * 0.8, y - h * 0.6);
        ctx.lineTo(x - w * 0.8, y);
        ctx.lineTo(x + w * 0.8, y + h * 0.6);
      } else {
        ctx.moveTo(x - w * 0.8, y - h * 0.6);
        ctx.lineTo(x + w * 0.8, y);
        ctx.lineTo(x - w * 0.8, y + h * 0.6);
      }
      ctx.stroke();
      return;
    }
    if (face === 'ko') {
      ctx.lineWidth = 3.2;
      ctx.strokeStyle = ink;
      ctx.beginPath();
      ctx.moveTo(x - w * 0.7, y - w * 0.7);
      ctx.lineTo(x + w * 0.7, y + w * 0.7);
      ctx.moveTo(x + w * 0.7, y - w * 0.7);
      ctx.lineTo(x - w * 0.7, y + w * 0.7);
      ctx.stroke();
      return;
    }
    if (face === 'happy' || face === 'cool' || blink) {
      ctx.lineWidth = 3.4;
      ctx.strokeStyle = ink;
      ctx.beginPath();
      if (face === 'happy') ctx.arc(x, y + 3, w * 0.85, Math.PI * 1.15, Math.PI * 1.85);
      else {
        // calm closed eye: a sharp downward lash
        ctx.moveTo(x - w, y + (far ? 0 : -1));
        ctx.quadraticCurveTo(x, y + 3.5, x + w, y + (far ? -1 : 0));
      }
      ctx.stroke();
      return;
    }
    // sharp almond eye
    const tilt = far ? 1.5 : -1.5;
    ctx.beginPath();
    ctx.moveTo(x - w, y + tilt * 0.3);
    ctx.quadraticCurveTo(x - w * 0.1, y - h * 1.25, x + w, y - h * 0.35 - tilt);
    ctx.quadraticCurveTo(x + w * 0.2, y + h * 1.05, x - w, y + tilt * 0.3);
    ctx.closePath();
    Draw.fillStroke(ctx, '#ffffff', 2.4, ink);
    ctx.save();
    ctx.clip();
    const px = x + w * 0.22;
    Draw.circle(ctx, px, y + 0.5, h * 0.78, pal.eye, 0);
    Draw.circle(ctx, px + 0.6, y + 0.8, h * 0.42, ink, 0);
    Draw.circle(ctx, px + h * 0.3, y - h * 0.32, h * 0.24, '#ffffff', 0);
    if (lv > 1) Draw.circle(ctx, px - h * 0.3, y + h * 0.42, h * 0.11, '#ffffff', 0);
    ctx.restore();
    // heavy upper lash
    ctx.lineWidth = face === 'angry' ? 4.6 : 4;
    ctx.strokeStyle = ink;
    ctx.beginPath();
    const lid = face === 'angry' ? h * 0.25 : face === 'block' ? h * 0.15 : 0;
    const y0 = y + tilt * 0.3 + (far ? lid * 0.3 : lid), y1 = y - h * 0.35 - tilt + (far ? lid : lid * 0.3);
    ctx.moveTo(x - w - 1.5, y0);
    ctx.quadraticCurveTo(x - w * 0.1, y - h * 1.25 + lid * 1.6, x + w + 1.5, y1);
    ctx.stroke();
    if (lv) {
      // a flicked lash at the outer corner, the lower lid and a crease above
      const p = new Path2D();
      if (far) {
        p.moveTo(x + w + 1, y1 + 0.3);
        p.quadraticCurveTo(x + w + 3.5, y1 - 0.6, x + w + 4.6, y1 - 3.4);
      } else {
        p.moveTo(x - w - 1, y0 - 0.2);
        p.quadraticCurveTo(x - w - 3.6, y0 - 0.8, x - w - 5.2, y0 - 3.6);
      }
      if (far) {
        p.moveTo(x + w * 0.05, y + h * 0.98);
        p.quadraticCurveTo(x + w * 0.5, y + h * 1.02, x + w * 0.85, y + h * 0.6);
      } else {
        p.moveTo(x - w * 0.85, y + h * 0.62);
        p.quadraticCurveTo(x - w * 0.5, y + h * 1.06, x - w * 0.05, y + h * 1.0);
      }
      inkLines(ctx, p, 1.6, ink);
    }
  }

  // The fox mask, in its own little frame: painted markings, eye slits, a
  // flame on the brow, a muzzle, whisker dots and a crack across one cheek.
  function foxMask(ctx, pal, lw, lv, mpx) {
    ctx.beginPath();
    ctx.moveTo(-12, -6);
    ctx.lineTo(-15, -22);
    ctx.lineTo(-5, -11);
    ctx.quadraticCurveTo(0, -12.5, 5, -11);
    ctx.lineTo(15, -22);
    ctx.lineTo(12, -6);
    ctx.quadraticCurveTo(15, 6, 2, 17);
    ctx.quadraticCurveTo(0, 18.5, -2, 17);
    ctx.quadraticCurveTo(-15, 6, -12, -6);
    ctx.closePath();
    Draw.fillStroke(ctx, pal.mask, lw * 0.8, pal.ink);
    // ears
    ctx.fillStyle = pal.maskMark;
    ctx.beginPath();
    ctx.moveTo(-12, -10);
    ctx.lineTo(-13.5, -18);
    ctx.lineTo(-8, -12);
    ctx.closePath();
    ctx.moveTo(12, -10);
    ctx.lineTo(13.5, -18);
    ctx.lineTo(8, -12);
    ctx.closePath();
    ctx.fill();
    // markings
    ctx.strokeStyle = pal.maskMark;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-9, 0);
    ctx.quadraticCurveTo(-5, -4, -2, 0);
    ctx.moveTo(9, 0);
    ctx.quadraticCurveTo(5, -4, 2, 0);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, 6);
    ctx.lineTo(-5, 7);
    ctx.moveTo(10, 6);
    ctx.lineTo(5, 7);
    ctx.stroke();
    // a flame painted on the brow
    const fl = new Path2D();
    fl.moveTo(0, -11);
    fl.quadraticCurveTo(3.2, -6.4, 0, -3.4);
    fl.quadraticCurveTo(-3.2, -6.4, 0, -11);
    flat(ctx, fl, pal.maskMark);
    Draw.circle(ctx, 0, 13, 2.4, pal.ink, 0);
    if (!lv || mpx < 0.45) return;
    // eye slits (and whisker dots, close up)
    const sl = new Path2D();
    for (const s of [-1, 1]) {
      sl.moveTo(s * 9, 2.4);
      sl.quadraticCurveTo(s * 5.6, -0.6, s * 2.4, 2.8);
      sl.quadraticCurveTo(s * 5.8, 4.6, s * 9, 2.4);
      if (lv > 1 && mpx > 0.9) {
        dot(sl, s * 7.6, 10.2, 0.85);
        dot(sl, s * 5.4, 11.2, 0.85);
        dot(sl, s * 8.2, 12.6, 0.85);
      }
    }
    flat(ctx, sl, pal.ink);
    // inner ear edges, the muzzle, a mouth and a crack
    const p = new Path2D();
    p.moveTo(-8.6, -12.2);
    p.lineTo(-13, -17.4);
    p.moveTo(8.6, -12.2);
    p.lineTo(13, -17.4);
    p.moveTo(0, 5.2);
    p.quadraticCurveTo(0.6, 8, 0, 10.4);
    p.moveTo(-3.6, 15);
    p.quadraticCurveTo(-1.4, 17.2, 0, 15.2);
    p.quadraticCurveTo(1.4, 17.2, 3.6, 15);
    if (lv > 1) {
      p.moveTo(12.7, -5.5);
      p.lineTo(9.8, -3.4);
      p.lineTo(11, -1);
      p.lineTo(8, 1.6);
      p.moveTo(9.8, -3.4);
      p.lineTo(7.6, -4.4);
    }
    inkLines(ctx, p, 1.9, pal.ink);
  }

  // ---- super cinematic: five passes through the victim -------------------------
  // [frame, kiriX, kiriY, vicX, vicY, vicPose, vicRot]
  const SHADOW = [
    [0, 0, 0, 72, 0, 'hurt', 0],
    [6, 250, 14, 72, 16, 'hurt2', 0],
    [10, 250, 14, 72, 22, 'hurt', 0],
    [16, -110, 40, 72, 46, 'hurtAir', 0],
    [20, -110, 40, 72, 54, 'hurtAir', 10],
    [26, 250, 66, 72, 80, 'launch', -10],
    [30, 250, 66, 72, 88, 'hurtAir', 0],
    [36, -110, 92, 72, 108, 'launch', 10],
    [40, -110, 92, 72, 116, 'hurtAir', 0],
    [46, 262, 50, 72, 134, 'launch', -10],
    [54, 280, 0, 72, 140, 'hurtAir', 0],
    [70, 280, 0, 72, 146, 'hurtAir', 6],
    [74, 280, 0, 72, 150, 'launch', -24],
    [86, 280, 0, 72, 150, 'launch', -24],
  ];
  const PASSES = [3, 13, 23, 33, 43];
  const passEv = {};
  for (const fr of PASSES) {
    passEv[fr] = (a, v) => {
      Sound.sfx('slash', { pitch: 1 + PASSES.indexOf(fr) * 0.06 });
      slashFX(v.x, -v.y - 110, (fr % 20 === 3 ? -0.5 : 0.5) + U.rand(-0.15, 0.15), 260, a.pal.scarf);
    };
  }
  for (const [fr, dir] of [[8, -1], [18, 1], [28, -1], [38, 1]]) {
    passEv[fr] = (a) => {
      a.facing = a.seqFacing * dir;
      Sound.sfx('whoosh', { pitch: 1.3 });
    };
  }
  passEv[0] = (a) => {
    a.trail = 48;
  };
  passEv[54] = (a) => {
    a.facing = a.seqFacing;
  };
  passEv[66] = (a) => Sound.sfx('tick', { pitch: 0.7 });

  defineChar({
    id: 'kiri',
    name: 'KIRI',
    title: 'Quick as a Whisper',
    style: 'SPEED',
    desc: 'A ninja who is always one step ahead and one step behind you. Throws shuriken, teleports behind you and slashes straight through you.',
    color: '#e8384f',
    sparkColor: '#ff8a9a',
    trailColor: '#ff5a6e',
    words: ['SHING!', 'SLASH!', 'HYAH!', 'SWISH!'],
    wordColor: '#ff5a6e',
    ui: { power: 2, speed: 5, range: 3, difficulty: 4 },
    quotes: ['You never even saw me.', 'Blink and you lose. You blinked.', 'The wind remembers your defeat.', 'Was that your best? I barely moved.'],
    stats: {
      hp: 900, walkF: 5, walkB: 4, jumpV: 17.5, jumpVx: 6, grav: 0.95, jsq: 3,
      airJumps: 1, airJumpMult: 0.8, flip: true, airAttacks: 2,
      dash: { f: 15, v: 13, cancel: 5, trail: true }, bdash: { v: 10, vy: 6, inv: 6, lag: 5 },
      width: 50, height: 194, throwRange: 50, landLag: 3, downTime: 28, swingPitch: 1.15, voicePitch: 1.1,
    },
    body: {
      torso: 50, neck: 6, headR: 29, shoulderDrop: 10, shoulderOfs: 3, hipOfs: 3,
      uArm: 26, fArm: 25, handR: 8.5,
      thigh: 36, shin: 35, footL: 16, footR: 7.5,
      armR: [8.8, 7.6, 6.8], legR: [11.5, 9.4, 7.4], torsoW: [40, 50],
    },
    armCols: ['gi', 'skin', 'glove'],
    legCols: ['pants', 'pants', 'tabi'],
    cuff: [0.2, 0.95, 'wrap'],
    sock: [0.42, 1.0, 'wrap'],
    weapon: { len: 34, w: -115, back: 11 },
    poseDefaults: { w: -115 },
    drawOrder: ['behind', 'armB', 'legB', 'legF', 'torso', 'head', 'collar', 'kunai', 'armF', 'front'],
    mono: [
      { main: '#33c08a', accent: '#ff5a6e' },
      { main: '#8b5cf6', accent: '#ffc23d' },
      { main: '#e9eef3', accent: '#ff7ab6' },
    ],
    monoKeys: { main: 'gi', accentMain: 'scarf', accent: ['scarf', 'scarfL', 'maskMark', 'belt', 'eye'], keep: ['mask', 'steel'] },
    palettes: [
      { gi: '#2c3a6b', giL: '#46589a', under: '#1b1830', pants: '#262a40', wrap: '#ece4d2', glove: '#2a2438', tabi: '#2a2438', skin: '#f3c7a1', hair: '#221c33', hairL: '#43386a', eye: '#b0303d',
        scarf: '#e8384f', scarfL: '#ff7d8c', belt: '#f2c14e', mask: '#fbf7f0', maskMark: '#e8384f', steel: '#cfd8ea' },
      { gi: '#26222f', giL: '#3d374a', under: '#120f18', pants: '#1d1a25', wrap: '#c9b8f0', glove: '#16131c', tabi: '#16131c', skin: '#e8b48c', hair: '#eeeaf7', hairL: '#ffffff', eye: '#6a3fb5',
        scarf: '#ffc23d', scarfL: '#ffe28f', belt: '#8b5cf6', mask: '#fbf7f0', maskMark: '#8b5cf6', steel: '#e0d6ff' },
      { gi: '#eef2f6', giL: '#ffffff', under: '#2f6f6a', pants: '#3fa7a0', wrap: '#ffffff', glove: '#2f6f6a', tabi: '#2f6f6a', skin: '#ffd9bb', hair: '#2bb3a7', hairL: '#7fe8dc', eye: '#1f6f68',
        scarf: '#ff7ab6', scarfL: '#ffb8d8', belt: '#ff7ab6', mask: '#fbf7f0', maskMark: '#ff5f9e', steel: '#cfe9ff' },
    ],
    walk: { A: 11, H: 8, bob: 2, sway: 1.5, arm: 6 },
    idlePeriod: 64,
    ai: {
      pref: [110, 260], aggression: 0.75, jumpiness: 0.4, zoning: 0.3,
      combos: [['2L', '5L', '5H', '2S'], ['5L', '5H', '2S'], ['5H', '2S'], ['2L', '2H'], ['jH', '5L', '5H', '2S'], ['jL', '5L', '2S'],
        ['6S', '5L', '5H', '2S'], ['6S', '2L', '2H'], ['6S', 'THROW']],
      antiAir: ['2H'], punish: ['5H', '2S'], enders: ['2S', '5S'],
    },

    poses: {
      stance: { t: 12, hd: -10, fs: 30, fe: 75, bs: 15, be: 115, lf: [30, 0], lb: [-30, 0], d: 18 },
      stance2: { $: 'stance', d: 21, t: 14, fe: 70, be: 120, hd: -12 },
      walkBase: { $: 'stance', d: 16 },
      crouch: { t: 26, hd: -18, fs: 40, fe: 70, bs: 20, be: 110, lf: [32, 0], lb: [-28, 0], d: 46 },
      crouch2: { $: 'crouch', d: 48 },
      squat: { t: 20, hd: -12, fs: 20, fe: 60, bs: 10, be: 90, lf: [26, 0], lb: [-26, 0], d: 32 },
      jump: { t: 8, hd: -6, fs: -40, fe: 70, bs: -60, be: 50, fh: 85, fk: 120, bh: 20, bk: 90 },
      fall: { t: 6, hd: 0, fs: 20, fe: 60, bs: -10, be: 50, fh: 40, fk: 60, bh: -6, bk: 40 },
      tuck: { t: 30, hd: 10, fs: 60, fe: 80, bs: 50, be: 90, fh: 120, fk: 150, bh: 110, bk: 150 },
      dash1: { t: 40, hd: -30, fs: -80, fe: 10, bs: -90, be: 10, lf: [46, 0], lb: [-40, 14], d: 30 },
      dash2: { t: 36, hd: -26, fs: -86, fe: 10, bs: -96, be: 10, lf: [8, 14], lb: [-34, 0], d: 26 },
      bdash: { t: -12, hd: 8, fs: 50, fe: 60, bs: 30, be: 80, fh: 60, fk: 100, bh: 10, bk: 60 },
      block: { t: 4, hd: 6, fs: 75, fe: 100, bs: 60, be: 110, lf: [22, 0], lb: [-28, 0], d: 16, face: 'block' },
      cblock: { t: 18, hd: 4, fs: 75, fe: 100, bs: 60, be: 110, lf: [30, 0], lb: [-28, 0], d: 46, face: 'block' },
      // normals
      '5L_a': { t: 8, hd: -8, fs: 10, fe: 50, w: -20, bs: 20, be: 110, lf: [30, 0], lb: [-30, 0], d: 18 },
      '5L_b': { t: 18, hd: -12, x: 8, fs: 82, fe: 6, w: 0, bs: 0, be: 100, lf: [38, 0], lb: [-30, 0], d: 20 },
      '2L_a': { t: 24, hd: -16, fs: 40, fe: 70, bs: 20, be: 110, fh: 60, fk: 100, lb: [-28, 0], d: 46 },
      '2L_b': { t: 16, hd: -10, fs: 40, fe: 70, bs: 20, be: 110, fh: 82, fk: 0, fa: -10, lb: [-30, 0], d: 50 },
      '5H_a': { t: -6, hd: 4, fs: -70, fe: 40, w: 0, bs: 60, be: 60, lf: [26, 0], lb: [-32, 0], d: 16 },
      '5H_b': { t: 16, hd: -10, x: 8, fs: 95, fe: 10, w: 10, bs: -30, be: 30, lf: [36, 0], lb: [-30, 0], d: 18 },
      '5H_c': { t: -22, hd: 12, x: 22, fs: 40, fe: 60, bs: -40, be: 60, lf: [10, 0], bh: 100, bk: 0, ba: 10, d: 8 },
      '2H_a': { t: 30, hd: -14, fs: -20, fe: 30, w: 0, bs: 30, be: 90, lf: [26, 0], lb: [-28, 0], d: 46 },
      '2H_m': { t: 14, hd: -16, x: 8, fs: 100, fe: 10, w: 0, bs: 20, be: 80, lf: [28, 0], lb: [-26, 0], d: 24 },
      '2H_b': { t: -10, hd: -20, x: 6, fs: 165, fe: 5, w: 0, bs: 20, be: 80, lf: [22, 4], lb: [-24, 0], d: 2 },
      '2H_c': { t: 0, hd: -10, fs: 120, fe: 20, w: 0, bs: 20, be: 90, lf: [22, 0], lb: [-24, 0], d: 10 },
      '6H_a': { t: 20, hd: -10, fs: -30, fe: 40, bs: -40, be: 40, lf: [24, 0], lb: [-26, 0], d: 34 },
      '6H_b': { $: 'tuck', r: 140 },
      '6H_c': { $: 'tuck', r: 270 },
      '6H_d': { t: 10, hd: -10, fs: 60, fe: 40, bs: 40, be: 40, fh: 115, fk: 0, bh: -10, bk: 40, r: 360 },
      jL_a: { t: 6, hd: -4, fs: 20, fe: 40, w: -20, bs: -40, be: 60, fh: 80, fk: 110, bh: 20, bk: 90 },
      jL_b: { t: 14, hd: -6, fs: 70, fe: 10, w: 0, bs: -50, be: 50, fh: 80, fk: 110, bh: 20, bk: 90 },
      jH_a: { t: -6, hd: 4, fs: 40, fe: 60, bs: 0, be: 80, fh: 100, fk: 120, bh: 10, bk: 90 },
      jH_b: { t: -20, hd: 8, fs: 50, fe: 60, bs: -10, be: 70, fh: 60, fk: 0, fa: 10, bh: 0, bk: 110 },
      // specials
      shurA: { t: -6, hd: 2, fs: 30, fe: 75, bs: -80, be: 120, lf: [24, 0], lb: [-30, 0], d: 16 },
      shurB: { t: 18, hd: -10, x: 6, fs: 20, fe: 70, bs: 85, be: 0, handB: 'open', lf: [36, 0], lb: [-30, 0], d: 20 },
      sealA: { t: 6, hd: -6, fs: 60, fe: 95, bs: 50, be: 105, hand: 'open', handB: 'open', lf: [24, 0], lb: [-24, 0], d: 14 },
      sealB: { $: 'sealA', fs: 50, fe: 110, bs: 45, be: 115, d: 18 },
      appear: { t: 24, hd: -14, fs: 20, fe: 60, bs: 0, be: 90, lf: [32, 0], lb: [-30, 0], d: 40 },
      fangA: { t: 30, hd: -20, fs: -40, fe: 30, w: 0, bs: -60, be: 30, lf: [30, 0], lb: [-36, 0], d: 38 },
      fangB: { t: 50, hd: -30, x: 10, fs: 90, fe: 0, w: 0, bs: -90, be: 10, lf: [50, 0], lb: [-44, 10], d: 40 },
      fangC: { t: 20, hd: -10, fs: 40, fe: 60, bs: 10, be: 90, lf: [34, 0], lb: [-30, 0], d: 30 },
      airThrowA: { t: -10, hd: 6, fs: -60, fe: 120, bs: -70, be: 110, fh: 70, fk: 100, bh: 20, bk: 80 },
      airThrowB: { t: 30, hd: -10, fs: 60, fe: 0, hand: 'open', bs: 50, be: 0, handB: 'open', fh: 50, fk: 70, bh: 0, bk: 60 },
      // throw
      grabK: { t: 16, hd: -8, fs: 80, fe: 15, bs: 70, be: 20, hand: 'open', handB: 'open', lf: [30, 0], lb: [-28, 0], d: 16 },
      vaultA: { $: 'tuck', r: 90, hand: 'open', handB: 'open' },
      vaultB: { $: 'tuck', r: 200 },
      vaultC: { $: 'tuck', r: 320 },
      landK: { $: 'squat', r: 360 },
      kickA: { t: -10, hd: 6, fs: 30, fe: 60, bs: 20, be: 90, fh: 100, fk: 120, lb: [-24, 0], d: 16 },
      kickB: { t: -24, hd: 12, x: 10, fs: 40, fe: 60, bs: -20, be: 80, fh: 95, fk: 0, fa: 0, lb: [-28, 0], d: 14 },
      // super
      shadowDash: { t: 55, hd: -32, fs: -100, fe: 10, w: 0, bs: -110, be: 10, fh: 20, fk: 50, bh: -50, bk: 30 },
      shadowSlash: { t: 40, hd: -20, fs: 100, fe: 0, w: 0, bs: -80, be: 20, fh: 60, fk: 90, bh: -30, bk: 40 },
      shadowTurn: { t: 20, hd: -10, fs: 40, fe: 60, bs: 10, be: 90, fh: 70, fk: 120, bh: 20, bk: 100 },
      sheatheA: { t: 6, hd: -4, fs: 20, fe: 130, bs: 10, be: 120, lf: [18, 0], lb: [-22, 0], d: 8, face: 'cool' },
      sheatheB: { t: 2, hd: -8, fs: -10, fe: 40, w: -170, bs: 5, be: 100, lf: [18, 0], lb: [-22, 0], d: 6, face: 'cool' },
      // personality
      introKneel: { t: 30, hd: -20, fs: 60, fe: 40, bs: 20, be: 100, lf: [30, 0], bh: -30, bk: 60, d: 50, face: 'cool' },
      win: { t: -4, hd: -8, fs: 25, fe: 120, bs: 20, be: 125, lf: [16, 0], lb: [-20, 0], d: 6, face: 'cool' },
      win2: { t: 0, hd: -4, fs: 50, fe: 120, hand: 'open', bs: 30, be: 110, lf: [16, 0], lb: [-20, 0], d: 6, face: 'happy' },
    },

    anims: {
      intro: { keys: [[0, 'introKneel'], [26, 'introKneel'], [40, 'stance', 'out'], [96, 'stance']] },
      win: { keys: [[0, 'stance'], [10, 'win', 'out'], [44, 'win'], [54, 'win2', 'out'], [80, 'win2']] },
    },

    moves: {
      '5L': {
        name: 'Kunai Jab',
        anim: { keys: [[0, 'stance'], [2, '5L_a', 'out'], [4, '5L_b', 'snap'], [7, '5L_b'], [15, 'stance']] },
        hits: [{ at: [4, 6], limb: 'weapon', r: 10, dmg: 28, hs: 13, bs: 9, kb: [3, 0] }],
        ai: { range: [0, 145], kind: 'poke' },
      },
      '2L': {
        name: 'Ankle Cut',
        anim: { keys: [[0, 'crouch'], [3, '2L_a', 'out'], [5, '2L_b', 'snap'], [8, '2L_b'], [16, 'crouch']] },
        hits: [{ at: [5, 7], limb: 'footF', r: 12, dmg: 22, level: 'low', hs: 13, bs: 9, kb: [3, 0] }],
        ai: { range: [0, 105], kind: 'low' },
      },
      '5H': {
        name: 'Whirlwind',
        anim: { keys: [[0, 'stance'], [6, '5H_a', 'out'], [9, '5H_b', 'snap'], [12, '5H_b'], [15, '5H_c', 'snap'], [19, '5H_c'], [32, 'stance']] },
        vel: [[10, 3.5], [18, 0]],
        hits: [
          { at: [9, 11], limb: 'weapon', r: 14, dmg: 36, hs: 18, bs: 12, kb: [0.5, 0], stop: 6, sfx: 'slash', spark: 'H' },
          { at: [15, 18], limb: 'shinB', ext: 12, r: 16, dmg: 48, hs: 20, bs: 14, kb: [6, 0], stop: 9 },
        ],
        ai: { range: [40, 155], kind: 'poke' },
      },
      '2H': {
        name: 'Rising Crescent',
        anim: { keys: [[0, 'crouch'], [4, '2H_a', 'out'], [6, '2H_m', 'snap'], [8, '2H_b'], [11, '2H_b'], [18, '2H_c'], [30, 'crouch']] },
        airInv: [2, 12],
        hits: [{ at: [6, 11], limb: 'weapon', r: 20, dmg: 64, hs: 26, launch: true, kb: [2, 12.5], spark: 'S', sfx: 'slash', stop: 10 }],
        ev: { 7: (f) => f.battle && slashFX(f.x + f.facing * 40, -f.y - 150, -1.2 * f.facing, 150, f.pal.scarf) },
        ai: { range: [0, 145], kind: 'aa' },
      },
      '6H': {
        name: 'Crescent Flip',
        anim: { keys: [[0, 'stance'], [6, '6H_a', 'out'], [10, '6H_b'], [15, '6H_c'], [19, '6H_d', 'snap'], [60, '6H_d']] },
        vel: [[8, 4.2, 8.5]],
        landEnd: true,
        landLag: 10,
        hits: [{ at: [17, 60], limb: 'footF', r: 16, dmg: 62, level: 'high', hs: 19, bs: 13, kb: [4, 0], maxHits: 1, stop: 10 }],
        ev: { 8: () => Sound.sfx('whoosh', { pitch: 1.2 }) },
        ai: { range: [60, 165], kind: 'over' },
      },
      jL: {
        name: 'Air Slash',
        anim: { keys: [[0, 'jump'], [3, 'jL_a', 'out'], [5, 'jL_b', 'snap'], [11, 'jL_b'], [17, 'fall']] },
        hits: [{ at: [5, 10], limb: 'weapon', r: 13, dmg: 32, hs: 14, bs: 10, sfx: 'slash' }],
        ai: { kind: 'air' },
      },
      jH: {
        name: 'Falcon Kick',
        anim: { keys: [[0, 'jump'], [5, 'jH_a', 'out'], [7, 'jH_b', 'snap'], [15, 'jH_b'], [22, 'fall']] },
        hits: [{ at: [7, 14], limb: 'footF', r: 14, dmg: 64, hs: 18, bs: 14, kb: [5, 0] }],
        ai: { kind: 'air' },
      },
      '5S': {
        name: 'Shuriken',
        anim: { keys: [[0, 'stance'], [5, 'shurA', 'out'], [9, 'shurB', 'snap'], [18, 'shurB'], [28, 'stance']] },
        ev: { 9: (f) => {
          if (!f.battle) return;
          const h = f.jointWorld('hB');
          shuriken(f, h[0] + f.facing * 16, -h[1], 14 * f.facing, 0, 40);
          Sound.sfx('shuriken');
        } },
        ai: { range: [170, 900], kind: 'proj' },
      },
      '6S': {
        name: 'Shadow Step',
        anim: { keys: [[0, 'stance'], [4, 'sealA', 'out'], [9, 'sealB'], [13, 'sealB'], [18, 'appear', 'snap'], [24, 'appear'], [34, 'stance']] },
        inv: [8, 20],
        hide: [12, 17],
        cancelTo: ['5L', '2L', '5H', '2H', 'THROW'],
        cancelWhiff: true,
        cancelFrom: 24,
        ev: {
          11: (f) => {
            Sound.sfx('teleport');
            if (f.battle) smokePuff(f.x, -90, 7, f.pal);
          },
          16: (f) => {
            if (!f.battle) return;
            teleportBehind(f);
            smokePuff(f.x, -90, 6, f.pal);
            Sound.sfx('puff', { pitch: 0.8 });
          },
        },
        desc: 'Reappears behind you',
        ai: { range: [90, 520], kind: 'teleport' },
      },
      '2S': {
        name: 'Fox Fang',
        anim: { keys: [[0, 'crouch'], [8, 'fangA', 'out'], [12, 'fangB', 'snap'], [24, 'fangB'], [29, 'fangC'], [40, 'stance']] },
        vel: [[12, 19], [24, 2], [29, 0]],
        keepVel: true,
        trail: [12, 25],
        noPush: [12, 27],
        hits: [{
          at: [13, 23], cap: [14, -70, 70, -112], r: 30, dmg: 64, hs: 26, kd: true, kb: [-2, 8], spark: 'S', sfx: 'slash', stop: 9, bs: 12,
          onBlock: (f) => {
            f.vx = -5 * f.facing;
            f.mf = Math.max(f.mf, 24);
          },
        }],
        onHit: (f, v) => f.battle && slashFX(v.x, -v.y - 100, -0.25 * f.facing, 240, f.pal.scarf),
        ev: { 11: () => Sound.sfx('whoosh', { pitch: 1.3 }) },
        ai: { range: [80, 320], kind: 'approach', unsafe: true },
      },
      jS: {
        name: 'Shuriken Rain',
        anim: { keys: [[0, 'jump'], [4, 'airThrowA', 'out'], [8, 'airThrowB', 'snap'], [18, 'airThrowB'], [24, 'fall']] },
        vel: [[0, null, 2.5]],
        grav: 0.35, gravAt: [0, 14],
        landLag: 4,
        ev: { 8: (f) => {
          if (!f.battle) return;
          const h = f.jointWorld('hF');
          for (const deg of [25, 45, 65]) {
            const a = deg * D2R;
            shuriken(f, h[0] + f.facing * 10, -h[1], Math.cos(a) * 12 * f.facing, -Math.sin(a) * 12, 26);
          }
          Sound.sfx('shuriken', { pitch: 1.1 });
        } },
        ai: { kind: 'airS' },
      },
      SUP: {
        name: 'THOUSAND SHADOWS',
        inv: [0, 16],
        anim: { keys: [[0, 'squat'], [6, 'fangA', 'out'], [8, 'fangB', 'snap'], [24, 'fangB'], [30, 'fangC'], [44, 'stance']] },
        vel: [[8, 22], [24, 2], [30, 0]],
        keepVel: true,
        trail: [8, 26],
        noPush: [8, 26],
        hits: [{
          at: [9, 23], cap: [0, -60, 64, -122], r: 34, dmg: 20, seq: true, super: true, spark: 'S', sfx: 'slash',
          onBlock: (f) => {
            f.vx = -4 * f.facing;
            f.mf = Math.max(f.mf, 24);
          },
        }],
        seqHit: {
          len: 86,
          anim: { keys: [[0, 'shadowSlash'], [2, 'shadowDash', 'snap'], [6, 'shadowDash'], [8, 'shadowTurn'], [10, 'shadowDash', 'snap'], [16, 'shadowDash'], [18, 'shadowTurn'],
            [20, 'shadowDash', 'snap'], [26, 'shadowDash'], [28, 'shadowTurn'], [30, 'shadowDash', 'snap'], [36, 'shadowDash'], [38, 'shadowTurn'],
            [40, 'shadowDash', 'snap'], [46, 'shadowDash'], [54, 'sheatheA', 'out'], [66, 'sheatheA'], [72, 'sheatheB', 'snap'], [86, 'sheatheB']] },
          self: SHADOW.map((k) => [k[0], k[1], k[2], 'linear']),
          vic: SHADOW.map((k) => [k[0], k[5], k[3] - k[1], k[4] - k[2], k[6], 'linear']),
          hits: {
            3: { dmg: 32, sfx: 'hitM', stop: 3 },
            13: { dmg: 32, sfx: 'hitM', stop: 3 },
            23: { dmg: 32, sfx: 'hitM', stop: 3 },
            33: { dmg: 32, sfx: 'hitM', stop: 3 },
            43: { dmg: 36, sfx: 'hitH', stop: 5, shake: 5 },
            72: { dmg: 140, sfx: 'hitX', stop: 16, shake: 16, word: 'SHING!', minScale: 0.75 },
          },
          // keep the victim where it was hit; Kiri's dash hides the snap
          onStart: (a, v) => {
            a.seqX = v.x - a.seqFacing * 72;
          },
          ev: passEv,
          release: { vx: -3, vy: 5, kd: true },
          recover: 12,
        },
        ai: { kind: 'super', range: [0, 420] },
      },
      THROW: {
        name: 'Vault Kick',
        throw: true,
        throwAt: 3,
        anim: { keys: [[0, 'stance'], [3, 'throwReach'], [9, 'throwWhiff'], [22, 'stance']] },
        seq: {
          len: 36,
          tech: true,
          anim: { keys: [[0, 'grabK'], [6, 'vaultA'], [12, 'vaultB'], [17, 'vaultC'], [20, 'landK'], [21, 'squat', 'step'], [24, 'kickA'], [27, 'kickB', 'snap'], [32, 'kickB'], [36, 'stance']] },
          self: [[0, 0, 0], [6, 20, 50], [12, 62, 132, 'out'], [17, 106, 64, 'in'], [20, 116, 0, 'in'], [36, 116, 0]],
          vic: [[0, 'grabbed', 50, 0], [6, 'hurt', 30, -50], [12, 'hurt2', -12, -132], [17, 'hurt', -56, -64], [20, 'hurt', -66, 0], [24, 'hurt2', -66, 0], [27, 'hurtAir', -86, 22], [36, 'hurtAir', -96, 30]],
          hits: { 6: { dmg: 14, sfx: 'hitL', stop: 2 }, 27: { dmg: 72, sfx: 'hitH', shake: 7, stop: 7, word: 'HYAH!' } },
          ev: {
            8: () => Sound.sfx('whoosh', { pitch: 1.2 }),
            21: (a) => {
              a.facing = -a.seqFacing;
              if (a.battle) FX.dust(a.x, 0, 4, 0);
            },
          },
          release: { vx: -9, vy: 8 },
          recover: 8,
        },
      },
    },

    // ---- drawing --------------------------------------------------------------------
    draw: {
      behind(ctx, f, J, pal) {
        const lw = f.C.lw, c = f.cos || {}, t = f.t || 0;
        const T = f.C.body.torso;
        const ta = J.ta, ca = Math.cos(ta), sa = Math.sin(ta);
        const kx = J.hip[0] + (-14 * f.C.look.torso * ca + (T - 4) * sa), ky = J.hip[1] + (-14 * f.C.look.torso * sa - (T - 4) * ca);
        // ponytail
        const [px, py] = Rig.headPoint(f.C, J, -22, -20);
        const tail = chainLocal(f, J, c.tail, px, py, 5, 11, 1.1);
        const L = [], R = [];
        for (let i = 0; i < tail.length; i++) {
          const p = tail[i], q = tail[Math.min(tail.length - 1, i + 1)], o = tail[Math.max(0, i - 1)];
          let dx = q[0] - o[0], dy = q[1] - o[1];
          const d = Math.hypot(dx, dy) || 1;
          dx /= d;
          dy /= d;
          const w = 9 * (1 - i / (tail.length - 0.6)) + 1.5;
          L.push([p[0] - dy * w, p[1] + dx * w]);
          R.push([p[0] + dy * w, p[1] - dx * w]);
        }
        const tip = tail[tail.length - 1];
        ctx.beginPath();
        smoothThrough(ctx, L, true);
        ctx.lineTo(tip[0] + (tip[0] - tail[tail.length - 2][0]) * 0.5, tip[1] + (tip[1] - tail[tail.length - 2][1]) * 0.5);
        smoothThrough(ctx, R.slice().reverse(), false);
        ctx.closePath();
        Draw.fillStroke(ctx, pal.hair, lw, pal.ink);
        ctx.strokeStyle = pal.hairL;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        smoothThrough(ctx, tail.slice(1, -1).map((p, i) => [p[0], p[1] - 3 + i * 0.5]), true);
        ctx.stroke();
        const lv = lod(ctx);
        if (lv) {
          // strands down the tail, split at the tip, and two cords binding it
          const n = tail.length;
          const at = (A, q) => {
            const i = Math.min(n - 2, Math.floor(q)), k = q - i;
            return [A[i][0] + (A[i + 1][0] - A[i][0]) * k, A[i][1] + (A[i + 1][1] - A[i][1]) * k];
          };
          const off = (o, i0, i1) => {
            const out = [];
            for (let i = i0; i <= i1; i++) out.push([tail[i][0] + (L[i][0] - tail[i][0]) * o, tail[i][1] + (L[i][1] - tail[i][1]) * o]);
            return out;
          };
          const sp = new Path2D();
          smoothThrough(sp, off(0.5, 1, n - 1), true);
          smoothThrough(sp, off(-0.45, 1, n - 2), true);
          const q = at(tail, n - 1.6), q2 = at(tail, n - 1.05);
          sp.moveTo(q[0], q[1]);
          sp.quadraticCurveTo(q2[0], q2[1], tip[0] + (tip[0] - q[0]) * 0.25 + 2, tip[1] + (tip[1] - q[1]) * 0.25 + 3);
          inkLines(ctx, sp, 1.4, pal.ink);
          const bp = new Path2D(), ep = new Path2D();
          for (const s of [1.85, 2.85]) {
            const a = at(L, s), b = at(R, s), c = at(tail, s + 0.12), a2 = at(L, s + 0.16), b2 = at(R, s + 0.16), c2 = at(tail, s + 0.28);
            bp.moveTo(a[0], a[1]);
            bp.quadraticCurveTo(c[0], c[1], b[0], b[1]);
            ep.moveTo(a2[0], a2[1]);
            ep.quadraticCurveTo(c2[0], c2[1], b2[0], b2[1]);
          }
          inkLines(ctx, bp, 3, pal.scarf);
          inkLines(ctx, ep, 1.1, pal.ink);
        }
        // scarf tails
        const A = chainLocal(f, J, c.scarfA, kx, ky, 9, 13, 0.3);
        const B = chainLocal(f, J, c.scarfB, kx, ky + 3, 7, 13, 0.45);
        ribbon(ctx, B, 13, 10, pal.dark.scarf, pal.scarf, pal.ink, lw, t, 1.7, lv);
        ribbon(ctx, A, 15, 11, pal.scarf, pal.scarfL, pal.ink, lw, t, 0, lv);
        Draw.circle(ctx, kx, ky, 9, pal.scarf, lw, pal.ink);
        Draw.circle(ctx, kx - 2, ky - 2, 3, pal.scarfL, 0);
      },
      torso(ctx, f, J, pal) {
        const T = f.C.body.torso, lw = f.C.lw;
        const shape = () => {
          ctx.beginPath();
          ctx.moveTo(-20, 10);
          ctx.quadraticCurveTo(-25, -20, -21, -T + 6);
          ctx.quadraticCurveTo(-14, -T - 4, 0, -T - 2);
          ctx.lineTo(8, -T - 2);
          ctx.quadraticCurveTo(24, -T - 1, 25, -T + 10);
          ctx.quadraticCurveTo(28, -22, 23, 10);
          ctx.closePath();
        };
        shape();
        Draw.fillStroke(ctx, pal.gi, lw, pal.ink);
        ctx.save();
        shape();
        ctx.clip();
        ctx.fillStyle = pal.dark.gi;
        ctx.beginPath();
        ctx.moveTo(-40, -T - 10);
        ctx.lineTo(-10, -T - 10);
        ctx.quadraticCurveTo(-18, -24, -10, 14);
        ctx.lineTo(-40, 14);
        ctx.fill();
        // undershirt in the V of the collar: chain mesh
        ctx.beginPath();
        ctx.moveTo(1, -T - 4);
        ctx.lineTo(22, -T - 4);
        ctx.lineTo(12, -T + 22);
        ctx.closePath();
        Draw.fillStroke(ctx, pal.under, lw * 0.7, pal.ink);
        const lv = lod(ctx), px = lv ? pxScale(ctx) : 0, tn = tones(pal);
        if (lv > 1 && px > 0.8) {
          const mp = new Path2D();
          for (let i = 0; i < 6; i++) {
            const x0 = -2 + i * 4.4;
            mp.moveTo(x0, -T + 6);
            mp.lineTo(x0 + 16, -T + 24);
            mp.moveTo(x0 + 4, -T + 24);
            mp.lineTo(x0 + 22, -T + 6);
          }
          inkLines(ctx, mp, 0.9, tn.faint);
        }
        // lapels
        ctx.lineCap = 'round';
        ctx.strokeStyle = pal.ink;
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(0, -T - 3);
        ctx.quadraticCurveTo(10, -T + 14, 22, -14);
        ctx.stroke();
        ctx.strokeStyle = pal.giL;
        ctx.lineWidth = 5;
        ctx.stroke();
        if (lv) {
          // the crossed-over collar's edges, the under-lapel, folds bunching
          // at the belt, under the arm and down the back
          const p = new Path2D();
          p.moveTo(-3.4, -T - 1.4);
          p.quadraticCurveTo(6.8, -T + 16.4, 19.2, -11.6);
          p.lineTo(19.6, -6);
          p.moveTo(20.6, -T - 2);
          p.lineTo(12.8, -T + 21);
          p.moveTo(-5, -7);
          p.quadraticCurveTo(-8.5, -13, -5.5, -19.5);
          p.moveTo(5.5, -7);
          p.quadraticCurveTo(3.4, -12, 6.6, -17);
          p.moveTo(-14, -7);
          p.quadraticCurveTo(-17, -11.5, -15.2, -15.5);
          p.moveTo(23, -33);
          p.quadraticCurveTo(16, -29.5, 12, -22.5);
          p.moveTo(-18.5, -38);
          p.quadraticCurveTo(-12.5, -30, -14.5, -21);
          p.moveTo(-9, -T + 1);
          p.quadraticCurveTo(-13.5, -T + 6, -14.5, -T + 12);
          inkLines(ctx, p, 1.2, pal.ink);
          if (lv > 1 && px > 0.7) {
            // stitching down the collar band
            const st = new Path2D();
            st.moveTo(1.6, -T - 0.6);
            st.quadraticCurveTo(11.2, -T + 15.4, 21.6, -16.4);
            ctx.setLineDash([2.2, 2.4]);
            inkLines(ctx, st, 0.95, tn.soft);
            ctx.setLineDash([]);
          }
        }
        ctx.restore();
        // a pouch on the back of the belt
        Draw.roundRect(ctx, -24.5, -3, 11.5, 13, 3.5, tn.pouch, lw * 0.6, pal.ink);
        // obi
        Draw.roundRect(ctx, -23, -6, 50, 13, 5, pal.belt, lw * 0.8, pal.ink);
        ctx.fillStyle = U.rgba('#ffffff', 0.25);
        ctx.fillRect(-18, -4, 40, 3);
        if (lv) {
          const fp = new Path2D();
          fp.moveTo(-25, -4.2);
          fp.lineTo(-12.4, -4.2);
          fp.lineTo(-12.4, 1.6);
          fp.quadraticCurveTo(-18.7, 5.4, -25, 1.6);
          fp.closePath();
          flat(ctx, fp, tn.flap);
          // the obi's two wraps, a tuck, the flap's edge and its toggle
          const p = new Path2D();
          p.moveTo(-21, 0.6);
          p.quadraticCurveTo(-4, 1.6, 12, 0.4);
          p.moveTo(-1, -5.4);
          p.quadraticCurveTo(1.6, -1.6, 0.4, 0.8);
          p.moveTo(-24.6, 1.6);
          p.quadraticCurveTo(-18.7, 5.4, -12.6, 1.6);
          inkLines(ctx, p, 1.3, pal.ink);
          const bt = new Path2D();
          dot(bt, -18.7, 2.6, 1.6);
          flat(ctx, bt, tn.rivet);
          if (lv > 1 && px > 0.7) {
            const st = new Path2D();
            st.moveTo(-19, -3.8);
            st.lineTo(11, -3.8);
            st.moveTo(-19, 4.6);
            st.lineTo(11, 4.6);
            ctx.setLineDash([2, 2.2]);
            inkLines(ctx, st, 0.9, tn.soft);
            ctx.setLineDash([]);
          }
        }
        // the knot and its two tails
        Draw.roundRect(ctx, 13, -8, 11, 16, 4, pal.belt, lw * 0.7, pal.ink);
        ctx.beginPath();
        ctx.moveTo(19, 7);
        ctx.lineTo(23.5, 18.5);
        ctx.lineTo(18.5, 20);
        ctx.lineTo(16.5, 8);
        ctx.closePath();
        Draw.fillStroke(ctx, pal.dark.belt, lw * 0.6, pal.ink);
        ctx.beginPath();
        ctx.moveTo(15, 7);
        ctx.lineTo(11, 20);
        ctx.lineTo(17, 18);
        ctx.lineTo(19, 8);
        ctx.closePath();
        Draw.fillStroke(ctx, pal.belt, lw * 0.6, pal.ink);
        if (lv) {
          // wrinkles pinched into the knot, hems and fringe on the tails
          const p = new Path2D();
          p.moveTo(15, -5.6);
          p.quadraticCurveTo(17.8, -3.2, 17.6, -0.6);
          p.moveTo(15, 5.6);
          p.quadraticCurveTo(17.8, 3.2, 17.6, 0.6);
          p.moveTo(22.4, -4.6);
          p.quadraticCurveTo(20.4, -1.8, 21.8, 1.6);
          p.moveTo(11.9, 17.2);
          p.lineTo(17.4, 15.5);
          p.moveTo(18.2, 17.4);
          p.lineTo(22.6, 16.1);
          inkLines(ctx, p, 1.2, pal.ink);
          const fr = new Path2D();
          for (let i = 0; i < 4; i++) {
            const k = (i + 0.5) / 4;
            const x = 11 + 6 * k, y = 20 - 2 * k;
            fr.moveTo(x, y - 0.5);
            fr.lineTo(x - 0.6, y + 2.8);
            const x2 = 18.5 + 5 * k, y2 = 20 - 1.5 * k;
            fr.moveTo(x2, y2 - 0.5);
            fr.lineTo(x2 + 0.4, y2 + 2.6);
          }
          inkLines(ctx, fr, 1.3, pal.belt);
        }
      },
      head(ctx, f, J, pal, face) {
        const lw = f.C.lw;
        // back hair mass
        ctx.beginPath();
        ctx.moveTo(-29, 8);
        ctx.quadraticCurveTo(-36, -8, -30, -22);
        ctx.lineTo(-38, -30);
        ctx.lineTo(-24, -31);
        ctx.quadraticCurveTo(-14, -42, 0, -40);
        ctx.lineTo(4, -48);
        ctx.lineTo(12, -38);
        ctx.quadraticCurveTo(26, -32, 30, -16);
        ctx.lineTo(28, 2);
        ctx.quadraticCurveTo(0, 16, -29, 8);
        ctx.closePath();
        Draw.fillStroke(ctx, pal.hair, lw, pal.ink);
        const lv = lod(ctx), px = lv ? pxScale(ctx) : 0;
        if (lv) {
          // locks combed back over the crown and down the back
          const p = new Path2D();
          p.moveTo(-16, -35.5);
          p.quadraticCurveTo(-5, -40.5, 7, -38.6);
          p.moveTo(15, -35);
          p.quadraticCurveTo(22, -30.5, 24.5, -23);
          p.moveTo(1.8, -40.2);
          p.lineTo(3.6, -44.6);
          p.moveTo(-31.8, -19);
          p.quadraticCurveTo(-34, -7, -30, 2.5);
          p.moveTo(-28.5, -27.2);
          p.lineTo(-33.6, -28.8);
          inkLines(ctx, p, 1.5, pal.ink);
        }
        // hair tie
        ctx.save();
        ctx.translate(-24, -20);
        ctx.rotate(-0.9);
        Draw.roundRect(ctx, -6, -4, 12, 8, 3, pal.scarf, lw * 0.6, pal.ink);
        ctx.restore();
        // fox mask worn on the side of the head
        ctx.save();
        ctx.translate(-17, -20);
        ctx.rotate(-0.55);
        ctx.scale(0.85, 0.85);
        foxMask(ctx, pal, lw, lv, px * 0.85);
        ctx.restore();
        if (lv) {
          // its cord: over the crown (under the bangs) and, behind, a knot
          // with a bead and a tassel swinging below
          const c = Math.cos(-0.55) * 0.85, s = Math.sin(-0.55) * 0.85;
          const ax = -17 - 12.4 * c + 3 * s, ay = -20 - 12.4 * s - 3 * c;
          const bx = -17 + 12.4 * c + 3 * s, by = -20 + 12.4 * s - 3 * c;
          const sw = Math.sin((f.t || 0) * 0.07) * 1.4;
          const kx = ax - 3.4, ky = ay + 7.5;
          const cp = new Path2D();
          cp.moveTo(bx, by);
          cp.quadraticCurveTo(-1, -33, 9.5, -28.5);
          cp.moveTo(ax, ay);
          cp.quadraticCurveTo(ax - 4, ay + 2.5, kx, ky);
          inkLines(ctx, cp, 1.8, pal.scarf);
          const tp = new Path2D();
          tp.moveTo(kx - 1.3, ky + 1.5);
          tp.quadraticCurveTo(kx - 3.4 + sw * 0.5, ky + 7, kx - 2.6 + sw, ky + 11.5);
          tp.lineTo(kx + 2.2 + sw, ky + 11.5);
          tp.quadraticCurveTo(kx + 2.6 + sw * 0.5, ky + 6.5, kx + 1.3, ky + 1.5);
          tp.closePath();
          flat(ctx, tp, pal.scarf);
          const bead = new Path2D();
          dot(bead, kx, ky, 2.4);
          flat(ctx, bead, pal.belt);
          const tl = new Path2D();
          tl.moveTo(kx - 0.8, ky + 4.5);
          tl.lineTo(kx - 1.2 + sw, ky + 11);
          tl.moveTo(kx + 1, ky + 4.5);
          tl.lineTo(kx + 1 + sw, ky + 11);
          tl.moveTo(kx - 2, ky + 3.6);
          tl.lineTo(kx + 2, ky + 3.6);
          inkLines(ctx, tl, 1.3, pal.ink);
        }
        // face
        Draw.ellipse(ctx, 7, 6, 21.5, 23.5, 0, pal.skin, lw, pal.ink);
        // ear
        Draw.ellipse(ctx, -12, 8, 5, 7, 0.2, pal.skin, lw * 0.8, pal.ink);
        // bangs
        ctx.beginPath();
        ctx.moveTo(-16, -18);
        ctx.lineTo(-10, -2);
        ctx.lineTo(-4, -12);
        ctx.lineTo(3, 0);
        ctx.lineTo(8, -11);
        ctx.lineTo(15, -1);
        ctx.lineTo(19, -12);
        ctx.lineTo(27, -4);
        ctx.quadraticCurveTo(28, -20, 18, -26);
        ctx.quadraticCurveTo(0, -32, -16, -18);
        ctx.closePath();
        Draw.fillStroke(ctx, pal.hair, lw * 0.85, pal.ink);
        ctx.fillStyle = pal.hairL;
        ctx.beginPath();
        ctx.ellipse(6, -22, 9, 2.6, -0.15, 0, TAU);
        ctx.fill();
        if (lv) {
          // strands falling into the bangs' points, the inside of the ear
          const p = new Path2D();
          p.moveTo(-9.2, -19.5);
          p.quadraticCurveTo(-10.2, -13, -9.6, -7.5);
          p.moveTo(-0.6, -23.5);
          p.quadraticCurveTo(-0.8, -15, 2, -6);
          p.moveTo(11.2, -23.5);
          p.quadraticCurveTo(12.6, -15, 14.2, -6.5);
          p.moveTo(21, -19.5);
          p.quadraticCurveTo(23.6, -14, 24.8, -9);
          p.moveTo(-11.2, 3.6);
          p.quadraticCurveTo(-8.6, 7.4, -11.4, 12.6);
          inkLines(ctx, p, 1.5, pal.ink);
          if (lv > 1 && px > 0.7) {
            const hp = new Path2D();
            hp.moveTo(-3, -24.5);
            hp.quadraticCurveTo(2, -26.5, 7, -25.5);
            hp.moveTo(12, -23.8);
            hp.lineTo(15.5, -22.6);
            inkLines(ctx, hp, 1.6, pal.hairL);
          }
        }
        // eyes
        const blink = f.blinking;
        eye(ctx, pal, 3, 8, 7, 6.8, face, blink, false, lv);
        eye(ctx, pal, 21, 8, 5.6, 6, face, blink, true, lv);
        // brows
        ctx.lineCap = 'round';
        ctx.strokeStyle = pal.ink;
        ctx.lineWidth = 3.4;
        ctx.beginPath();
        if (face === 'sad') {
          ctx.moveTo(-4, 0);
          ctx.lineTo(8, -3);
          ctx.moveTo(15, -3);
          ctx.lineTo(25, 0);
        } else if (face === 'angry' || face === 'block') {
          ctx.moveTo(-5, -3);
          ctx.lineTo(9, 2);
          ctx.moveTo(15, 2);
          ctx.lineTo(26, -3);
        } else if (face !== 'hurt' && face !== 'ko') {
          ctx.moveTo(-5, -1);
          ctx.lineTo(9, 1);
          ctx.moveTo(15, 1);
          ctx.lineTo(26, -2);
        }
        ctx.stroke();
        // nose
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(27, 11);
        ctx.lineTo(29, 15);
        ctx.lineTo(26, 16);
        ctx.stroke();
        // mouth
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        if (face === 'angry') {
          ctx.moveTo(10, 18);
          ctx.quadraticCurveTo(17, 16, 23, 17);
          ctx.quadraticCurveTo(18, 26, 12, 22);
          ctx.closePath();
          Draw.fillStroke(ctx, '#8c2f45', 2.6, pal.ink);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(13, 17.5, 8, 2.6);
        } else if (face === 'hurt' || face === 'ko') {
          ctx.moveTo(10, 21);
          ctx.lineTo(13, 18);
          ctx.lineTo(16, 21);
          ctx.lineTo(19, 18);
          ctx.lineTo(22, 21);
          ctx.stroke();
        } else if (face === 'happy') {
          ctx.moveTo(11, 18);
          ctx.quadraticCurveTo(17, 25, 23, 17);
          ctx.closePath();
          Draw.fillStroke(ctx, '#8c2f45', 2.4, pal.ink);
        } else if (face === 'sad') {
          ctx.moveTo(12, 21);
          ctx.quadraticCurveTo(17, 17, 22, 21);
          ctx.stroke();
        } else {
          // tiny confident smirk
          ctx.moveTo(12, 20);
          ctx.quadraticCurveTo(18, 21, 23, 17);
          ctx.stroke();
        }
      },
      collar(ctx, f, J, pal) {
        // the scarf wrapped around the neck, in front of the chin
        const lw = f.C.lw;
        ctx.save();
        ctx.translate(J.neck[0], J.neck[1]);
        ctx.rotate(J.ta);
        ctx.beginPath();
        ctx.moveTo(-17, 8);
        ctx.quadraticCurveTo(-21, -3, -11, -7);
        ctx.quadraticCurveTo(5, -11, 18, -6);
        ctx.quadraticCurveTo(26, 1, 18, 9);
        ctx.quadraticCurveTo(1, 15, -17, 8);
        ctx.closePath();
        Draw.fillStroke(ctx, pal.scarf, lw, pal.ink);
        ctx.strokeStyle = pal.dark.scarf;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-13, 2);
        ctx.quadraticCurveTo(3, -1, 19, 2);
        ctx.stroke();
        ctx.strokeStyle = pal.scarfL;
        ctx.beginPath();
        ctx.moveTo(-8, -5);
        ctx.quadraticCurveTo(4, -8, 13, -6);
        ctx.stroke();
        const lv = lod(ctx);
        if (lv) {
          // the lower turn's edge, folds where it wraps round, a crease
          const p = new Path2D();
          p.moveTo(-12.5, 3.8);
          p.quadraticCurveTo(3, 1, 18.5, 3.8);
          p.moveTo(21.8, -3.6);
          p.quadraticCurveTo(18.6, 0, 20.8, 5);
          p.moveTo(-15.6, -2);
          p.quadraticCurveTo(-12, 1.4, -14.6, 5.6);
          p.moveTo(2, 7.6);
          p.quadraticCurveTo(7, 9.6, 11.5, 7.4);
          p.moveTo(-3, -8.2);
          p.quadraticCurveTo(-1, -5.6, 2.5, -5);
          inkLines(ctx, p, 1.3, pal.ink);
          if (lv > 1) {
            const st = new Path2D();
            st.moveTo(-13, 9.4);
            st.quadraticCurveTo(1, 14, 15.5, 9.8);
            ctx.setLineDash([2, 2.2]);
            inkLines(ctx, st, 0.9, tones(pal).soft);
            ctx.setLineDash([]);
          }
        }
        ctx.restore();
      },
      arm(ctx, f, J, side, pc, pal) {
        const C = f.C, b = C.body, back = side === 'B', P = J.P;
        const s = back ? J.sB : J.sF, e = back ? J.eB : J.eF, h = back ? J.hB : J.hF;
        const r0 = b.armR[0], r1 = b.armR[1], r2 = b.armR[2];
        Rig.limb(ctx, s, e, h, r0, r1, r2, pc.gi, pc.skin, C.lw, pal.ink);
        Rig.band(ctx, e, h, r1, r2, 0.2, 0.95, pc.wrap, C.lw, pal.ink);
        const lv = lod(ctx), tn = tones(pc);
        if (lv) {
          // the sleeve's hem, the wrap's edges and its strips crossing round
          // the forearm
          const p = new Path2D(), q = new Path2D();
          const R = (t) => r1 + (r2 - r1) * t + 0.6;
          for (const t of [0.2, 0.95]) {
            const a = along(e, h, t, R(t)), z = along(e, h, t, -R(t));
            p.moveTo(a[0], a[1]);
            p.lineTo(z[0], z[1]);
          }
          const ua = r0 + (r1 - r0) * 0.86;
          const m0 = along(s, e, 0.86, ua), m1 = along(s, e, 0.86, -ua), mc = along(s, e, 0.93, 0);
          p.moveTo(m0[0], m0[1]);
          p.quadraticCurveTo(mc[0], mc[1], m1[0], m1[1]);
          for (let k = 0; k < 4; k++) {
            const t0 = 0.27 + k * 0.16, t1 = t0 + 0.12;
            const a = along(e, h, t0, R(t0)), z = along(e, h, t1, -R(t1));
            p.moveTo(a[0], a[1]);
            p.lineTo(z[0], z[1]);
            if (k < 3) {
              const a2 = along(e, h, t0 + 0.08, -R(t0)), z2 = along(e, h, t1 + 0.08, R(t1));
              q.moveTo(a2[0], a2[1]);
              q.lineTo(z2[0], z2[1]);
            }
          }
          inkLines(ctx, p, 1.3, tn.soft);
          if (lv > 1) inkLines(ctx, q, 1, tn.faint);
        }
        // a lacquered guard over the shoulder, laced in two rows, riveted
        const ang = Math.atan2(e[1] - s[1], e[0] - s[0]);
        const g = Math.hypot(e[0] - s[0], e[1] - s[1]) * 0.46, w = r0 + 1.7;
        ctx.save();
        ctx.translate(s[0], s[1]);
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.moveTo(-4.5, -w);
        ctx.lineTo(g, -w - 0.8);
        ctx.quadraticCurveTo(g + 3.4, 0, g, w + 0.8);
        ctx.lineTo(-4.5, w);
        ctx.quadraticCurveTo(-9, 0, -4.5, -w);
        ctx.closePath();
        Draw.fillStroke(ctx, tn.plate, C.lw * 0.7, pal.ink);
        if (lv) {
          const p = new Path2D();
          for (const x of [g * 0.3, g * 0.68]) {
            p.moveTo(x, -w - 0.4);
            p.quadraticCurveTo(x + 2, 0, x, w + 0.4);
          }
          inkLines(ctx, p, 1.3, pal.ink);
          const hl = new Path2D();
          hl.moveTo(-5.2, -w * 0.55);
          hl.quadraticCurveTo(-6.4, 0, -5.2, w * 0.55);
          inkLines(ctx, hl, 1.3, tn.plateL);
          if (lv > 1) {
            const rv = new Path2D(), lc = new Path2D();
            for (const y of [-w + 2, w - 2]) {
              dot(rv, -2.2, y, 1.1);
              dot(rv, g - 1.5, y * 1.05, 1.1);
            }
            for (const x of [g * 0.3, g * 0.68]) {
              lc.moveTo(x - 1.4, -1.6);
              lc.lineTo(x + 1.6, 1.6);
              lc.moveTo(x - 1.4, 1.6);
              lc.lineTo(x + 1.6, -1.6);
            }
            flat(ctx, rv, tn.rivet);
            inkLines(ctx, lc, 1.2, pc.scarf);
          }
        }
        ctx.restore();
        const hs = back ? P.handB || C.handDef : P.hand || C.handDef;
        if (hs !== 'none') Rig.drawHand(ctx, f, J, e, h, hs, pc.glove, pal, back);
      },
      kunai(ctx, f, J, pal) {
        if (J.P.hand === 'open' || !J.wTip) return;
        const h = J.hF, tip = J.wTip, end = J.wEnd;
        const ang = Math.atan2(tip[1] - h[1], tip[0] - h[0]);
        const lw = f.C.lw;
        const lv = lod(ctx);
        // grip + ring pommel
        Draw.line(ctx, end[0], end[1], h[0], h[1], 4, pal.wrap, 2.5, pal.ink);
        ctx.beginPath();
        ctx.arc(end[0], end[1], 4.5, 0, TAU);
        ctx.lineWidth = 5.5;
        ctx.strokeStyle = pal.ink;
        ctx.stroke();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = pal.steel;
        ctx.stroke();
        if (lv) {
          // cord bound round the grip, and a tassel swinging from the ring
          const gx = h[0] - end[0], gy = h[1] - end[1], gl = Math.hypot(gx, gy) || 1;
          const ux = gx / gl, uy = gy / gl;
          const p = new Path2D();
          for (const k of [0.3, 0.55, 0.8]) {
            const mx = end[0] + gx * k, my = end[1] + gy * k;
            p.moveTo(mx - uy * 2.3 - ux * 1.2, my + ux * 2.3 - uy * 1.2);
            p.lineTo(mx + uy * 2.3 + ux * 1.2, my - ux * 2.3 + uy * 1.2);
          }
          inkLines(ctx, p, 1, pal.ink);
          // the ribbon's knot sits on the back of the ring, its ends stream behind
          const rx = end[0] - 4.4, ry = end[1] + 0.6;
          const sw = Math.sin((f.t || 0) * 0.13);
          const tp = new Path2D();
          tp.moveTo(rx, ry);
          tp.quadraticCurveTo(rx - 4, ry - 2.6 + sw * 1.6, rx - 9, ry - 0.6 + sw * 2.4);
          tp.moveTo(rx, ry);
          tp.quadraticCurveTo(rx - 3.4, ry + 2 - sw, rx - 7, ry + 4.6 - sw * 1.6);
          inkLines(ctx, tp, 1.8, pal.scarf);
          const kn = new Path2D();
          dot(kn, rx, ry, 1.5);
          flat(ctx, kn, pal.ink);
        }
        // blade
        const len = Math.hypot(tip[0] - h[0], tip[1] - h[1]);
        ctx.save();
        ctx.translate(h[0], h[1]);
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.moveTo(3, -2.5);
        ctx.quadraticCurveTo(len * 0.35, -8, len, 0);
        ctx.quadraticCurveTo(len * 0.35, 8, 3, 2.5);
        ctx.closePath();
        Draw.fillStroke(ctx, pal.steel, lw * 0.75, pal.ink);
        if (lv) {
          // the far bevel in shadow, the ridge and the collar at the base
          const bv = new Path2D();
          bv.moveTo(3, 0);
          bv.lineTo(len, 0);
          bv.quadraticCurveTo(len * 0.35, 8, 3, 2.5);
          bv.closePath();
          flat(ctx, bv, tones(pal).steelD);
          const p = new Path2D();
          p.moveTo(5, 0);
          p.lineTo(len - 5, 0);
          p.moveTo(3.6, -2.6);
          p.lineTo(3.6, 2.6);
          inkLines(ctx, p, 1, pal.ink);
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(8, -2);
        ctx.lineTo(len - 6, -0.6);
        ctx.stroke();
        ctx.restore();
      },
      foot(ctx, f, J, a, t, col, pal) {
        const ang = Math.atan2(t[1] - a[1], t[0] - a[0]);
        const L = Math.hypot(t[0] - a[0], t[1] - a[1]);
        const lw = f.C.lw;
        ctx.save();
        ctx.translate(a[0], a[1]);
        ctx.rotate(ang);
        // split-toe tabi
        ctx.beginPath();
        ctx.moveTo(-8, -7);
        ctx.lineTo(L - 4, -6);
        ctx.quadraticCurveTo(L + 2, -7, L + 4, -3);
        ctx.lineTo(L + 1, -1);
        ctx.lineTo(L + 7, 0);
        ctx.quadraticCurveTo(L + 9, 6, L + 3, 7);
        ctx.lineTo(-8, 7);
        ctx.quadraticCurveTo(-11, 0, -8, -7);
        ctx.closePath();
        Draw.fillStroke(ctx, col, lw, pal.ink);
        const lv = lod(ctx);
        if (lv) {
          // a rubber sole, the split between the toes, the cuff and the
          // clasps up the heel
          ctx.save();
          ctx.clip();
          ctx.fillStyle = mixC(col, pal.ink, 0.55);
          ctx.fillRect(-12, 3.4, L + 24, 6);
          const p = new Path2D();
          p.moveTo(L + 1.4, -1);
          p.quadraticCurveTo(L - 2.4, -0.6, L - 5.6, 0.8);
          p.moveTo(-1.6, -7.4);
          p.quadraticCurveTo(-3.4, -2, -2.2, 3.4);
          inkLines(ctx, p, 1.5, pal.ink);
          if (lv > 1) {
            const k = new Path2D();
            for (const y of [-4.8, -2, 0.8]) {
              k.moveTo(-10.5, y);
              k.lineTo(-6.6, y);
            }
            inkLines(ctx, k, 1.4, mixC(pal.steel, pal.ink, 0.15));
          }
          ctx.restore();
        }
        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        ctx.fillRect(-4, -4, L, 3);
        ctx.restore();
      },
      leg(ctx, f, J, side, pc, pal) {
        const b = f.C.body;
        const back = side === 'B';
        const hp = back ? J.hipB : J.hipF, k = back ? J.kB : J.kF, a = back ? J.aB : J.aF, t = back ? J.tB : J.tF;
        const r1 = b.legR[1], r2 = b.legR[2];
        Rig.limb(ctx, hp, k, a, b.legR[0], r1, r2, pc.pants, pc.pants, f.C.lw, pal.ink);
        Rig.band(ctx, k, a, r1, r2, 0.42, 1.0, pc.wrap, f.C.lw, pal.ink);
        const lv = lod(ctx), tn = tones(pc);
        // a guard strapped over the knee cap (the side away from the bend)
        const sx = a[0] - k[0], sy = a[1] - k[1], sl = Math.hypot(sx, sy) || 1;
        const ux = sx / sl, uy = sy / sl;
        let fx = hp[0] - k[0] + ux * Math.hypot(hp[0] - k[0], hp[1] - k[1]), fy = hp[1] - k[1] + uy * Math.hypot(hp[0] - k[0], hp[1] - k[1]);
        const fl = Math.hypot(fx, fy);
        if (fl < 6) {
          fx = -uy;
          fy = ux;
          if (fx * (t[0] - a[0]) + fy * (t[1] - a[1]) < 0) {
            fx = -fx;
            fy = -fy;
          }
        } else {
          fx = -fx / fl;
          fy = -fy / fl;
        }
        const cx = k[0] + fx * r1 * 0.34 + ux * 0.6, cy = k[1] + fy * r1 * 0.34 + uy * 0.6;
        const ang = Math.atan2(uy, ux);
        Draw.ellipse(ctx, cx, cy, 6.6, 5.4, ang, tn.plate, f.C.lw * 0.7, pal.ink);
        if (lv) {
          // the wrap's top edge, the strips spiralling down the shin and
          // crossing back, the guard's hinge
          const R = (q) => r1 + (r2 - r1) * q + 0.6;
          const p = new Path2D(), d = new Path2D(), x = new Path2D();
          const a0 = along(k, a, 0.42, R(0.42)), z0 = along(k, a, 0.42, -R(0.42));
          p.moveTo(a0[0], a0[1]);
          p.lineTo(z0[0], z0[1]);
          const nx = -uy, ny = ux;
          const hx = cx - ux * 1.6, hy = cy - uy * 1.6;
          p.moveTo(hx + nx * 4.6, hy + ny * 4.6);
          p.quadraticCurveTo(hx + ux * 1.6, hy + uy * 1.6, hx - nx * 4.6, hy - ny * 4.6);
          for (let i = 0; i < 4; i++) {
            const t0 = 0.47 + i * 0.13, t1 = t0 + 0.1;
            const m = along(k, a, t0, R(t0)), n = along(k, a, t1, -R(t1));
            d.moveTo(m[0], m[1]);
            d.lineTo(n[0], n[1]);
            if (i < 3) {
              const m2 = along(k, a, t0 + 0.065, -R(t0)), n2 = along(k, a, t1 + 0.065, R(t1));
              x.moveTo(m2[0], m2[1]);
              x.lineTo(n2[0], n2[1]);
            }
          }
          inkLines(ctx, p, 1.4, pal.ink);
          inkLines(ctx, d, 1.3, tn.soft);
          if (lv > 1) {
            inkLines(ctx, x, 1, tn.faint);
            const rv = new Path2D();
            dot(rv, cx + ux * 2.6, cy + uy * 2.6, 1.2);
            flat(ctx, rv, tn.rivet);
          }
        }
        Rig.drawFoot(ctx, f, J, a, t, pc.tabi, pal, back);
      },
    },

    post(f) {
      const J = f.J, c = f.cos;
      if (!J) return;
      const fx = f.x || 0, fy = f.y || 0, fc = f.facing || 1, t = f.t || 0;
      const T = f.C.body.torso;
      const ta = J.ta, ca = Math.cos(ta), sa = Math.sin(ta);
      const kx = J.hip[0] + (-14 * f.C.look.torso * ca + (T - 4) * sa), ky = J.hip[1] + (-14 * f.C.look.torso * sa - (T - 4) * ca);
      const wx = fx + kx * fc, wy = -fy + ky;
      if (!c.scarfA) c.scarfA = {};
      if (!c.scarfB) c.scarfB = {};
      if (!c.tail) c.tail = {};
      simChain(c.scarfA, wx, wy, 9, 13, { damp: 0.93, grav: 0.32, windX: -0.75 * fc, flutter: 0.9, phase: 0, t });
      simChain(c.scarfB, wx, wy + 3, 7, 13, { damp: 0.92, grav: 0.38, windX: -0.6 * fc, flutter: 0.8, phase: 2.1, t });
      const [px, py] = Rig.headPoint(f.C, J, -22, -20);
      simChain(c.tail, fx + px * fc, -fy + py, 5, 11, { damp: 0.86, grav: 0.55, windX: -0.25 * fc, flutter: 0.3, phase: 0.7, t });
    },

    update(f) {
      if (f.state === 'intro' && f.sf === 2 && f.battle) {
        smokePuff(f.x, -60, 8, f.pal);
        Sound.sfx('teleport', { vol: 0.7 });
      }
    },
  });
})();
