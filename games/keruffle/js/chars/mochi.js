'use strict';
// ---------------------------------------------------------------------------
// MOCHI — the sweetest little menace. A tiny girl in a bunny hoodie with a
// giant lollipop and her floating puffball pet, Puff. Trickster: Puff shots,
// candy traps, floaty jumps.
// ---------------------------------------------------------------------------
(() => {
  const R = 36; // head radius the art is drawn for

  // ---- hand-drawn detail helpers ----------------------------------------------
  // Detail lines are stroked on their own paths (never right after filling the
  // same path, which would read as an outline and be dropped), batched into as
  // few strokes as possible, and skipped where they would be under a pixel.

  // device pixels per local unit for the current transform
  function pxOf(ctx) {
    const m = ctx.getTransform();
    return Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
  }
  // a round pen for ink / color detail lines
  function pen(ctx, col, w) {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }
  // a four-point twinkle (eye and candy sparkles)
  function twinklePath(ctx, x, y, r) {
    const k = r * 0.22;
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x + k, y - k, x + r, y);
    ctx.quadraticCurveTo(x + k, y + k, x, y + r);
    ctx.quadraticCurveTo(x - k, y + k, x - r, y);
    ctx.quadraticCurveTo(x - k, y - k, x, y - r);
    ctx.closePath();
  }
  // a dotted lace / pom-pom edge: round dots of color strung along the current path
  function dots(ctx, col, size, gap) {
    ctx.strokeStyle = col;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.setLineDash([0.01, gap]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // stitches: a dashed ink line along the current path
  function stitch(ctx, col, w, on, off) {
    pen(ctx, col, w);
    ctx.lineCap = 'butt';
    ctx.setLineDash([on, off]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ---- shared art -----------------------------------------------------------
  // Puff: a round fluffy bunny-cloud. (x, y) = centre, s = scale, dir = facing
  const PUFF_N = 9;
  function puffBody(ctx, ox, oy, k) {
    for (let i = 0; i < PUFF_N; i++) {
      const a = (i / PUFF_N) * TAU;
      Draw.circlePath(ctx, Math.cos(a) * 12 * k + ox, Math.sin(a) * 10 * k + 1 + oy, 8.5 * k);
    }
    Draw.circlePath(ctx, ox, 1 + oy, 14 * k);
  }
  function drawPuff(ctx, x, y, s, pal, t, dir = 1, mood = 'happy') {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s * dir, s);
    const sq = 1 + Math.sin(t * 0.18) * 0.05;
    ctx.scale(1 / sq, sq);
    const px = pxOf(ctx), fine = px > 0.55;
    const inked = Sketch.active;
    const ink = pal.ink;
    const shade = U.mix(pal.puff, pal.puffIn, 0.55);
    // ears
    for (const [ex, ang] of [[-7, -0.35], [7, 0.3]]) {
      ctx.save();
      ctx.translate(ex, -14);
      ctx.rotate(ang + Math.sin(t * 0.12 + ex) * 0.08);
      Draw.ellipse(ctx, 0, -8, 4.5, 9, 0, pal.puff, inked ? 0 : 3, pal.ink);
      Draw.ellipse(ctx, 0, -7, 2, 5.5, 0, pal.puffIn, 0);
      if (inked && fine) {
        // a thin ink edge down the back of the ear, fuzz in the pink
        ctx.beginPath();
        ctx.moveTo(-1.5, -16.6);
        ctx.quadraticCurveTo(-5.6, -12, -3.6, -1.5);
        ctx.moveTo(-0.6, -9.5);
        ctx.lineTo(0.5, -7.6);
        ctx.moveTo(-0.4, -5.6);
        ctx.lineTo(0.6, -3.8);
        pen(ctx, ink, 1.3);
        ctx.stroke();
      }
      ctx.restore();
    }
    // fluffy body: a pastel shade along the bottom-back, the white puff over it
    ctx.beginPath();
    puffBody(ctx, 0, 0, 1);
    if (!inked) {
      ctx.lineWidth = 6;
      ctx.strokeStyle = pal.ink;
      ctx.stroke();
      ctx.fillStyle = pal.puff;
      ctx.fill();
    } else {
      // (just under full alpha: Puff keeps its own soft shading, no brush marks)
      ctx.globalAlpha = 0.97;
      ctx.fillStyle = shade;
      ctx.fill();
      ctx.beginPath();
      puffBody(ctx, 1.6, -1.8, 0.93);
      ctx.fillStyle = pal.puff;
      ctx.fill();
      ctx.globalAlpha = 1;
      // a broken ink contour under the bottom-back bumps, fluff curls and tufts
      ctx.beginPath();
      for (let i = 2; i <= 6; i++) {
        const a = (i / PUFF_N) * TAU, cx = Math.cos(a) * 12, cy = Math.sin(a) * 10 + 1;
        const a0 = a - 0.9 + (i === 2 ? 0.5 : 0), a1 = a + 0.75 - (i === 6 ? 0.45 : 0);
        ctx.moveTo(cx + Math.cos(a0) * 8.6, cy + Math.sin(a0) * 8.6);
        ctx.arc(cx, cy, 8.6, a0, a1);
      }
      if (fine) {
        // little fluff curls inside the edge
        for (const [cx, cy, r, a0] of [[-13, 4, 3.2, 0.2], [-8, 13, 3, -0.6], [3, 15.5, 2.8, -1.2], [15, 11, 2.6, -1.9], [-14, -5, 2.4, 0.9]]) {
          ctx.moveTo(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r);
          ctx.arc(cx, cy, r, a0, a0 + 1.9);
        }
        // a fluff tuft between the ears
        ctx.moveTo(-2.5, -15.5);
        ctx.quadraticCurveTo(-1, -21, 2.5, -19.5);
        ctx.moveTo(0.5, -15.8);
        ctx.quadraticCurveTo(2.5, -19, 5, -17.5);
      }
      pen(ctx, ink, 1.3);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.ellipse(-6, -6, 6, 3.5, -0.4, 0, TAU);
    ctx.fill();
    // face
    if (mood === 'angry') {
      ctx.strokeStyle = pal.ink;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-1, -2);
      ctx.lineTo(4, 0);
      ctx.moveTo(13, -2);
      ctx.lineTo(8, 0);
      ctx.stroke();
    }
    Draw.circle(ctx, 2.5, 3, 2.3, pal.ink, 0);
    Draw.circle(ctx, 10, 3, 2.3, pal.ink, 0);
    Draw.circle(ctx, 3, 2.2, 0.8, '#ffffff', 0);
    Draw.circle(ctx, 10.5, 2.2, 0.8, '#ffffff', 0);
    ctx.globalAlpha = 0.8;
    Draw.ellipse(ctx, -1, 7, 3, 1.8, 0, pal.puffIn, 0);
    Draw.ellipse(ctx, 13.5, 7, 3, 1.8, 0, pal.puffIn, 0);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(5, 6.5, 1.6, 0.2, Math.PI - 0.2);
    ctx.arc(8, 6.5, 1.6, 0.2, Math.PI - 0.2);
    ctx.stroke();
    if (inked && fine) {
      ctx.beginPath();
      for (const bx of [-2.6, -0.2, 12, 14.4]) {
        ctx.moveTo(bx, 8.3);
        ctx.lineTo(bx + 1.1, 5.9);
      }
      pen(ctx, U.mix(pal.puffIn, ink, 0.45), 0.9);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawLolly(ctx, base, tip, pal, lw) {
    // stick
    Draw.line(ctx, base[0], base[1], tip[0], tip[1], 5, pal.stick, lw * 0.6, pal.ink);
    const r = 24;
    const dx = tip[0] - base[0], dy = tip[1] - base[1], sl = Math.hypot(dx, dy) || 1;
    const ux = dx / sl, uy = dy / sl;
    const px = pxOf(ctx), fine = px > 0.5;
    if (Sketch.active && px > 0.3) {
      // candy-stripe twirl on the stick, an ink line down its shadow side
      ctx.beginPath();
      ctx.moveTo(base[0] + ux * 3, base[1] + uy * 3);
      ctx.lineTo(tip[0] - ux * (r + 2), tip[1] - uy * (r + 2));
      ctx.strokeStyle = pal.candyA;
      ctx.lineWidth = 4.2;
      ctx.lineCap = 'butt';
      ctx.setLineDash([2, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
      const s = uy > 0 ? 1 : -1; // the side away from the light (below / behind)
      const nx = -uy * s * 2.3, ny = ux * s * 2.3;
      ctx.beginPath();
      ctx.moveTo(base[0] + nx + ux * 2, base[1] + ny + uy * 2);
      ctx.lineTo(tip[0] + nx - ux * (r + 4), tip[1] + ny - uy * (r + 4));
      pen(ctx, pal.ink, 1.1);
      ctx.stroke();
      // a ribbon bow tied under the candy
      const bx = tip[0] - ux * (r + 2), by = tip[1] - uy * (r + 2);
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(Math.atan2(uy, ux) + Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-4, -6, -11, -5, -10, 0);
      ctx.bezierCurveTo(-10, 4, -4, 4, 0, 0);
      ctx.bezierCurveTo(4, 4, 10, 4, 10, 0);
      ctx.bezierCurveTo(11, -5, 4, -6, 0, 0);
      ctx.moveTo(-1, 1);
      ctx.lineTo(-6, 9);
      ctx.lineTo(-3.6, 8.2);
      ctx.lineTo(-2.6, 10.4);
      ctx.lineTo(1.4, 1.4);
      ctx.closePath();
      ctx.moveTo(1, 1);
      ctx.lineTo(5, 8.6);
      ctx.lineTo(2.8, 8);
      ctx.lineTo(1.6, 10);
      ctx.lineTo(-1.2, 1.6);
      ctx.closePath();
      ctx.fillStyle = pal.hood;
      ctx.fill();
      Draw.circle(ctx, 0, 0, 2.3, pal.hoodL, 0);
      if (fine) {
        ctx.beginPath();
        ctx.moveTo(-2, -0.6);
        ctx.quadraticCurveTo(-5, -2.6, -7.5, -1.4);
        ctx.moveTo(-2, 1);
        ctx.quadraticCurveTo(-5, 2, -7, 1.2);
        ctx.moveTo(2, -0.6);
        ctx.quadraticCurveTo(5, -2.6, 7.5, -1.4);
        ctx.moveTo(2, 1);
        ctx.quadraticCurveTo(5, 2, 7, 1.2);
        ctx.moveTo(-0.8, -2);
        ctx.lineTo(-0.8, 2);
        pen(ctx, pal.ink, 1);
        ctx.stroke();
      }
      ctx.restore();
    }
    // swirl candy
    ctx.save();
    ctx.translate(tip[0], tip[1]);
    Draw.circle(ctx, 0, 0, r, pal.candyA, lw, pal.ink);
    ctx.beginPath();
    ctx.arc(0, 0, r - 1.5, 0, TAU);
    ctx.clip();
    ctx.strokeStyle = pal.candyB;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let a = 0; a < TAU * 2.6; a += 0.25) {
      const rr = 2 + a * 3;
      const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.strokeStyle = pal.candyC;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let a = 0.9; a < TAU * 2.6; a += 0.25) {
      const rr = 2 + a * 3;
      const px = Math.cos(a + 1.6) * rr, py = Math.sin(a + 1.6) * rr;
      if (a === 0.9) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    if (Sketch.active && px > 0.3) {
      // ink shading along the lower edge of each swirl band, and a hatch of
      // short strokes where the candy turns away from the light
      ctx.beginPath();
      for (let a = 1.2; a < TAU * 2.55; a += 0.25) {
        const k = (a % TAU) / TAU; // only the lower half of each turn
        const ang = a % TAU;
        if (ang < 0.15 || ang > Math.PI + 0.35) continue;
        const rr = 2 + a * 3 + 2.7;
        const qx = Math.cos(a) * rr, qy = Math.sin(a) * rr;
        if (ang < 0.4 || k === 0) ctx.moveTo(qx, qy);
        else ctx.lineTo(qx, qy);
      }
      if (fine) {
        for (let i = 0; i < 5; i++) {
          const a = 1.75 + i * 0.3, r0 = r - 7 + (i % 2) * 2;
          ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
          ctx.lineTo(Math.cos(a + 0.12) * (r - 1.5), Math.sin(a + 0.12) * (r - 1.5));
        }
      }
      pen(ctx, pal.ink, 1.3);
      ctx.stroke();
      // glassy shine: a bright arc along the top and a twinkle
      ctx.beginPath();
      ctx.arc(0, 0, r - 4.5, -2.75, -1.75);
      pen(ctx, 'rgba(255,255,255,0.75)', 2.2);
      ctx.stroke();
      ctx.beginPath();
      twinklePath(ctx, 10, -12, 4.6);
      if (fine) twinklePath(ctx, -12.5, 5, 2.4);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(-7, -9, 7, 4, -0.6, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function lollyOverHead(J) {
    const dx = J.wTip[0] - J.head[0], dy = J.wTip[1] - J.head[1];
    return dx * dx + dy * dy < (R + 14) * (R + 14);
  }

  function drawCandy(ctx, x, y, pal, t, armed, s = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    const wob = armed ? Math.sin(t * 0.5) * 0.12 : 0;
    ctx.rotate(wob);
    const px = pxOf(ctx), inked = Sketch.active && px > 0.4;
    for (const d of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(d * 12, 0);
      ctx.lineTo(d * 26, -10);
      ctx.lineTo(d * 23, 0);
      ctx.lineTo(d * 26, 10);
      ctx.closePath();
      Draw.fillStroke(ctx, pal.candyB, 3, pal.ink);
    }
    if (inked) {
      // crinkles in the wrapper fanning out of the twists, and the twists' ties
      ctx.beginPath();
      for (const d of [-1, 1]) {
        for (const [ex, ey] of [[24.5, -6], [23.5, -1.5], [24, 5.5]]) {
          ctx.moveTo(d * 14.5, ey * 0.12);
          ctx.lineTo(d * ex, ey);
        }
        ctx.moveTo(d * 14, -3.6);
        ctx.lineTo(d * 14, 3.6);
        ctx.moveTo(d * 16, -3);
        ctx.lineTo(d * 16, 3);
      }
      pen(ctx, pal.ink, 1.2);
      ctx.stroke();
    }
    Draw.circle(ctx, 0, 0, 14, pal.candyA, 3.5, pal.ink);
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, 12.5, 0, TAU);
    ctx.clip();
    ctx.fillStyle = pal.candyB;
    for (let i = -3; i <= 3; i++) {
      ctx.save();
      ctx.rotate(0.6);
      ctx.fillRect(i * 9 - 2, -20, 4.5, 40);
      ctx.restore();
    }
    if (inked) {
      // a shadow edge on each stripe and a shiny arc
      ctx.rotate(0.6);
      ctx.beginPath();
      for (let i = -2; i <= 2; i++) {
        ctx.moveTo(i * 9 + 2.9, -6 + i * 2);
        ctx.lineTo(i * 9 + 2.9, 14);
      }
      pen(ctx, pal.ink, 1);
      ctx.stroke();
      ctx.rotate(-0.6);
    }
    ctx.restore();
    Draw.circle(ctx, -4, -5, 3.5, 'rgba(255,255,255,0.7)', 0);
    if (inked) {
      ctx.beginPath();
      ctx.arc(0, 0, 10.5, -2.9, -1.9);
      pen(ctx, 'rgba(255,255,255,0.8)', 1.8);
      ctx.stroke();
      ctx.beginPath();
      twinklePath(ctx, 6, -7, 3.2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
    if (armed && t % 20 < 10) Draw.circle(ctx, 0, -22, 3, '#ff4d6d', 2, pal.ink);
    ctx.restore();
  }

  function eye(ctx, pal, x, y, rx, ry, face, blink, far, fine) {
    const ink = pal.ink;
    ctx.lineCap = 'round';
    const d = far ? 1 : -1; // toward the outer corner
    if (fine && (face === 'happy' || blink)) {
      // lashes flicking out of the outer end of a closed eye
      const ex = x + d * rx * (face === 'happy' ? 0.88 : 1), ey = face === 'happy' ? y + 3 - rx * 0.95 * 0.37 : y + 2;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex + d * 3.6, ey - 2.6);
      ctx.moveTo(ex - d * 1.4, ey - (face === 'happy' ? 1.8 : 0.6));
      ctx.lineTo(ex + d * 2, ey - 5);
      pen(ctx, ink, 1.9);
      ctx.stroke();
    }
    if (face === 'hurt') {
      ctx.lineWidth = 3.4;
      ctx.strokeStyle = ink;
      ctx.beginPath();
      const d = far ? -1 : 1;
      ctx.moveTo(x - rx * d, y - ry * 0.55);
      ctx.lineTo(x + rx * 0.7 * d, y);
      ctx.lineTo(x - rx * d, y + ry * 0.55);
      ctx.stroke();
      return;
    }
    if (face === 'ko') {
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = ink;
      ctx.beginPath();
      for (let a = 0; a < TAU * 2.2; a += 0.3) {
        const rr = 1 + a * 1.1;
        const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
        if (a === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      return;
    }
    if (face === 'happy' || blink) {
      ctx.lineWidth = 3.4;
      ctx.strokeStyle = ink;
      ctx.beginPath();
      if (face === 'happy') ctx.arc(x, y + 3, rx * 0.95, Math.PI * 1.12, Math.PI * 1.88);
      else {
        ctx.moveTo(x - rx, y + 2);
        ctx.quadraticCurveTo(x, y + 6, x + rx, y + 2);
      }
      ctx.stroke();
      return;
    }
    // big sparkly anime eyes
    const sy = face === 'angry' || face === 'block' ? 0.82 : 1;
    Draw.ellipse(ctx, x, y, rx, ry * sy, 0, '#ffffff', 2.8, ink);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, y, rx - 0.5, ry * sy - 0.5, 0, 0, TAU);
    ctx.clip();
    const ix = x + rx * 0.18;
    Draw.ellipse(ctx, ix, y + 1, rx * 0.86, ry * 0.92, 0, pal.eye, 0);
    Draw.ellipse(ctx, ix, y + ry * 0.38, rx * 0.66, ry * 0.42, 0, pal.eyeL, 0);
    Draw.ellipse(ctx, ix, y + 0.5, rx * 0.36, ry * 0.4, 0, pal.ink, 0);
    ctx.restore();
    // highlights
    Draw.circle(ctx, ix - rx * 0.32, y - ry * 0.38, rx * 0.36, '#ffffff', 0);
    Draw.circle(ctx, ix + rx * 0.38, y + ry * 0.3, rx * 0.16, '#ffffff', 0);
    if (fine) {
      // a twinkle low in the iris
      ctx.beginPath();
      twinklePath(ctx, ix - rx * 0.22, y + ry * 0.46 * sy, rx * 0.3);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
    if (face === 'sad') {
      ctx.fillStyle = 'rgba(160,220,255,0.9)';
      ctx.beginPath();
      ctx.ellipse(x - rx * 0.2, y + ry * 0.9, rx * 0.9, ry * 0.3, 0, 0, TAU);
      ctx.fill();
    }
    // lashes / upper lid
    ctx.strokeStyle = ink;
    ctx.lineWidth = 3.6;
    ctx.beginPath();
    const tilt = face === 'angry' ? (far ? 2.5 : -2.5) : 0;
    const l0 = [x - rx - 1, y - ry * sy * 0.55 + tilt], lc = [x, y - ry * sy * 1.12], l1 = [x + rx + 1, y - ry * sy * 0.55 - tilt];
    ctx.moveTo(l0[0], l0[1]);
    ctx.quadraticCurveTo(lc[0], lc[1], l1[0], l1[1]);
    ctx.stroke();
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    const ox = far ? x + rx + 1 : x - rx - 1;
    ctx.moveTo(ox, y - ry * sy * 0.55);
    ctx.lineTo(ox + d * 4, y - ry * sy * 0.85);
    if (fine) {
      // two more lashes fanning from the outer end of the lid
      for (const [t, lx, ly] of [[0.13, 3.2, -4.4], [0.27, 1.6, -4.6]]) {
        const u = far ? 1 - t : t, v = 1 - u;
        const qx = v * v * l0[0] + 2 * u * v * lc[0] + u * u * l1[0];
        const qy = v * v * l0[1] + 2 * u * v * lc[1] + u * u * l1[1];
        ctx.moveTo(qx, qy - 0.6);
        ctx.lineTo(qx + d * lx, qy + ly);
      }
    }
    ctx.stroke();
    if (fine) {
      // a soft lower lash line at the outer corner, and a tick at the inner one
      ctx.beginPath();
      const a0 = far ? 0.2 : Math.PI - 0.95, a1 = far ? 0.95 : Math.PI - 0.2;
      ctx.ellipse(x, y + 0.6, rx + 1.4, ry * sy + 1.2, 0, a0, a1);
      const ix0 = x - d * (rx + 1.6);
      ctx.moveTo(ix0, y - 0.5);
      ctx.lineTo(ix0 - d * 1.6, y + 1.6);
      pen(ctx, ink, 1.6);
      ctx.stroke();
    }
  }

  // ear: base at (bx, by) in head space, angle a (deg, 0 = up, - = back), bend
  function ear(ctx, pal, bx, by, a, bend, len, lw, inner, px = 1) {
    const ar = a * D2R, br = (a + bend) * D2R;
    const m = [bx + Math.sin(ar) * len * 0.5, by - Math.cos(ar) * len * 0.5];
    const tp = [m[0] + Math.sin(br) * len * 0.5, m[1] - Math.cos(br) * len * 0.5];
    if (!Sketch.active) {
      ctx.fillStyle = pal.ink;
      ctx.beginPath();
      Draw.taper(ctx, bx, by, 8.5 + lw, m[0], m[1], 9.5 + lw);
      Draw.taper(ctx, m[0], m[1], 9.5 + lw, tp[0], tp[1], 7 + lw);
      ctx.fill();
    }
    ctx.fillStyle = pal.hood;
    ctx.beginPath();
    Draw.taper(ctx, bx, by, 8.5, m[0], m[1], 9.5);
    Draw.taper(ctx, m[0], m[1], 9.5, tp[0], tp[1], 7);
    ctx.fill();
    if (inner) {
      const m2 = [bx + (m[0] - bx) * 1.0, by + (m[1] - by) * 1.0];
      const t2 = [m[0] + (tp[0] - m[0]) * 0.75, m[1] + (tp[1] - m[1]) * 0.75];
      ctx.fillStyle = pal.earIn;
      ctx.beginPath();
      Draw.taper(ctx, bx + (m[0] - bx) * 0.3, by + (m[1] - by) * 0.3, 3.5, m2[0], m2[1], 5);
      Draw.taper(ctx, m2[0], m2[1], 5, t2[0], t2[1], 3);
      ctx.fill();
    }
    if (!Sketch.active || px < 0.3) return;
    // ink detail: fuzz ticks round the pink, a crease down its middle, a fold
    // where the ear bends and a seam along its front edge
    const d1 = [Math.sin(ar), -Math.cos(ar)], d2 = [Math.sin(br), -Math.cos(br)];
    const n1 = [-d1[1], d1[0]], n2 = [-d2[1], d2[0]];
    const at = (seg, f, across, along = 0) => {
      const o = seg ? m : [bx, by], d = seg ? d2 : d1, n = seg ? n2 : n1;
      const l = len * 0.5 * f + along;
      return [o[0] + d[0] * l + n[0] * across, o[1] + d[1] * l + n[1] * across];
    };
    ctx.beginPath();
    if (inner) {
      // soft fuzz along the back edge of the pink
      for (const [seg, f, rr] of [[0, 0.5, 4], [0, 0.85, 4.8], [1, 0.25, 4.5], [1, 0.55, 3.6]]) {
        let q = at(seg, f, -rr - 0.4);
        ctx.moveTo(q[0], q[1]);
        q = at(seg, f, -rr + 1.6, 2.4);
        ctx.lineTo(q[0], q[1]);
      }
    }
    if (bend < -10) {
      let q = at(1, 0, -9.4, -2);
      ctx.moveTo(q[0], q[1]);
      q = at(1, 0, -5.6, 1.5);
      ctx.lineTo(q[0], q[1]);
    }
    pen(ctx, pal.ink, 1.5);
    ctx.stroke();
    if (px > 0.5) {
      ctx.beginPath();
      let q = at(0, 0.32, 7);
      ctx.moveTo(q[0], q[1]);
      const c = at(1, 0, 7.6);
      q = at(1, 0.78, 5.2);
      ctx.quadraticCurveTo(c[0], c[1], q[0], q[1]);
      stitch(ctx, U.mix(pal.hood, pal.ink, 0.55), 1.3, 2.6, 2.6);
    }
  }

  // projectiles -----------------------------------------------------------------
  function spawnPuff(f, big) {
    const b = f.battle;
    if (!b) return;
    f.data.puffOut = true;
    const pal = f.pal;
    const startX = f.x + f.facing * (big ? 40 : 56), startY = big ? 120 : 112;
    const NORMAL = { dmg: big ? 42 : 42, hs: big ? 24 : 19, bs: 14, kb: big ? [1.5, 0] : [5, 0], spark: 'S', sfx: 'puff', stop: big ? 7 : 9, chip: big ? 6 : 8, minScale: big ? 0.75 : undefined };
    const FINAL = { dmg: 85, hs: 30, bs: 18, kb: [9, 12], launch: true, kd: true, spark: 'X', sfx: 'hitX', stop: 16, chip: 10, minScale: 0.75 };
    const p = b.spawn(f, {
      x: startX, y: startY, vx: (big ? 8.5 : 5.2) * f.facing, r: big ? 62 : 20, life: big ? 120 : 96,
      hits: big ? 6 : 1, rehit: big ? 7 : 12, strength: big ? 99 : 1, super: !!big,
      hit: normHit(Object.assign({}, NORMAL), 'S', big ? 'super' : 'special'),
      big, born: 0, hitDelay: 0, noClash: false,
      tick(p) {
        p.born++;
        if (!big) p.vy = Math.cos(p.age * 0.16) * 2.6;
        else {
          p.vy = Math.sin(p.age * 0.12) * 0.6;
          if (p.hits === 1 && !p.final) {
            p.final = true;
            p.hit = normHit(Object.assign({}, FINAL), 'S', 'super');
          }
          if (p.age % 5 === 0) FX.hearts(p.x - p.vx * 3, -p.y - 20, 1);
        }
      },
      onHit(p) {
        if (!big) {
          p.vx *= -0.3;
          FX.hearts(p.x, -p.y, 4);
        }
      },
      onEnd(p) {
        f.data.puffOut = false;
        if (b) f.data.puffBack = b.frame;
        f.cos.puffPoof = 18;
        FX.add({ type: 'smoke', x: p.x, y: -p.y, vx: 0, vy: -0.5, size: big ? 40 : 16, life: 20, color: '#ffffff' });
        if (big) FX.hearts(p.x, -p.y, 10);
        Sound.sfx('pop', { vol: 0.7 });
      },
      draw(ctx, sx, sy, p) {
        const s = big ? 3.4 : 1.15;
        const grow = big ? U.ease.back(Math.min(1, p.age / 14)) : 1;
        drawPuff(ctx, sx, sy, s * grow, pal, p.age * 1.5, p.vx >= 0 ? 1 : -1, big ? 'angry' : 'happy');
      },
    });
    return p;
  }

  function spawnTrap(f) {
    const b = f.battle;
    if (!b) return;
    f.data.trapOut = true;
    const pal = f.pal;
    const x = U.clamp(f.x + f.facing * 150, WALL + 20, STAGE_W - WALL - 20);
    const BOOM = { dmg: 72, hs: 30, bs: 16, kb: [3, 11], launch: true, kd: true, spark: 'S', sfx: 'candy', stop: 10, chip: 9 };
    b.spawn(f, {
      x, y: 14, vx: 0, vy: 0, r: 16, life: 240, hits: 1, noClash: true, noReflect: true, hit: null, armed: false, boom: 0, back: true,
      tick(p) {
        if (p.boom > 0) {
          p.boom++;
          if (p.boom > 7) p.kill('boom');
          return;
        }
        if (p.age === 22) {
          p.armed = true;
          Sound.sfx('bell', { vol: 0.4, pitch: 1.6 });
        }
        const o = f.opp;
        const near = p.armed && Math.abs(o.x - p.x) < 64 && o.y < 70;
        if (near || p.age >= 232) {
          p.boom = 1;
          p.r = 58;
          p.y = 40;
          p.hit = normHit(Object.assign({}, BOOM), 'S', 'special');
          Sound.sfx('pop');
          Sound.sfx('candy');
          FX.ring(p.x, -40, 90, pal.candyA, 18);
          for (let i = 0; i < 26; i++) {
            const a = -Math.PI / 2 + (Math.random() - 0.5) * 3;
            const sp = 3 + Math.random() * 7;
            FX.add({ type: 'shard', x: p.x, y: -30, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, grav: 0.3, drag: 0.98, size: 6 + Math.random() * 4, life: 40 + Math.random() * 20, color: U.choose([pal.candyA, pal.candyB, pal.candyC, '#7fe3ff', '#ffd23f']), rot: Math.random() * TAU, vr: 0.3 });
          }
        }
      },
      onEnd() {
        f.data.trapOut = false;
      },
      draw(ctx, sx, sy, p) {
        if (p.boom > 0) {
          const k = p.boom / 7;
          ctx.save();
          ctx.globalAlpha = 1 - k;
          Draw.star(ctx, sx, sy, 50 + k * 30, 22 + k * 14, 9, pal.candyA, 4, pal.ink, k);
          Draw.star(ctx, sx, sy, 28 + k * 20, 12 + k * 8, 9, '#ffffff', 0, pal.ink, k + 0.3);
          ctx.restore();
          return;
        }
        const pop = U.ease.back(Math.min(1, p.age / 10));
        drawCandy(ctx, sx, sy + 2, pal, p.age, p.armed, pop);
      },
    });
  }

  function spawnHeart(f) {
    const b = f.battle;
    if (!b) return;
    const pal = f.pal;
    b.spawn(f, {
      x: f.x + f.facing * 30, y: f.y + 60, vx: 5.5 * f.facing, vy: -6.5, r: 17, life: 60, hits: 1, floor: 6,
      hit: normHit({ dmg: 50, hs: 18, bs: 12, kb: [4, 0], level: 'high', spark: 'S', sfx: 'heart', stop: 8, chip: 7 }, 'S', 'special'),
      onFloor(p) {
        p.kill('floor');
      },
      onEnd(p) {
        FX.hearts(p.x, -p.y, 5);
        Sound.sfx('pop', { vol: 0.5 });
      },
      tick(p) {
        if (p.age % 3 === 0) FX.add({ type: 'heart', x: p.x, y: -p.y, vx: 0, vy: 0, size: 7, life: 14, color: pal.candyA });
      },
      draw(ctx, sx, sy, p) {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(Math.sin(p.age * 0.3) * 0.25 + (p.vx > 0 ? 0.5 : -0.5));
        const s = 1 + Math.sin(p.age * 0.5) * 0.08;
        ctx.scale(s, s);
        Draw.heart(ctx, 0, 0, 34, pal.candyA, 4, pal.ink);
        if (Sketch.active) {
          // a stitched seam round the plush heart and a glossy streak
          ctx.beginPath();
          Draw.heartPath(ctx, 0, 0.6, 26);
          stitch(ctx, pal.ink, 1.3, 2.6, 2.4);
          ctx.beginPath();
          ctx.moveTo(-12.5, -5);
          ctx.quadraticCurveTo(-12, -11, -6.5, -12.2);
          pen(ctx, 'rgba(255,255,255,0.85)', 2.4);
          ctx.stroke();
        }
        Draw.circle(ctx, -6, -6, 3.5, 'rgba(255,255,255,0.8)', 0);
        ctx.restore();
      },
    });
    Sound.sfx('heart');
  }

  // ---------------------------------------------------------------------------
  defineChar({
    id: 'mochi',
    name: 'MOCHI',
    title: 'The Sweetest Little Menace',
    style: 'TRICKSTER',
    desc: 'Tiny, adorable and armed with a giant lollipop. Sends her puffball pal Puff flying, sets candy traps and floats through the air.',
    color: '#ff7eb6',
    sparkColor: '#ff9cc8',
    trailColor: '#ffc4dc',
    words: ['POMF!', 'BONK!', 'BOOP!', 'NYA!'],
    wordColor: '#ff9cc8',
    ui: { power: 2, speed: 3, range: 4, difficulty: 4 },
    quotes: ['Yay! Puff, we did it!', 'Hehe~ that was fun! Again, again!', "Don't cry! Want a lollipop?", "Bonk! You're it!"],
    selectScale: 1.18,
    vsScale: 1.15,
    stats: {
      hp: 900, walkF: 3.6, walkB: 3.0, jumpV: 15.2, jumpVx: 4.8, grav: 0.7, jsq: 3, maxFall: 15,
      airAttacks: 2, flip: false,
      dash: { f: 18, v: 9.5, cancel: 7 }, bdash: { v: 7.5, vy: 6.5, inv: 5, lag: 6 },
      width: 44, height: 150, throwRange: 46, landLag: 3, downTime: 30, swingPitch: 1.25, voicePitch: 1.3,
    },
    body: {
      torso: 34, neck: 2, headR: R, shoulderDrop: 7, shoulderOfs: 2, hipOfs: 2,
      uArm: 17, fArm: 16, handR: 7.5,
      thigh: 21, shin: 20, footL: 12, footR: 7.2,
      armR: [7.6, 7, 6.6], legR: [8.4, 7.6, 6.8], torsoW: [42, 40],
    },
    weapon: { len: 80, w: 80, back: 9 },
    armCols: ['hood', 'hood', 'skin'],
    legCols: ['skin', 'skin', 'boot'],
    cuff: [0.72, 1.0, 'cuff'],
    sock: [0.62, 1.0, 'sock'],
    drawOrder: ['behind', 'armB', 'legB', 'legF', 'torso', 'weaponBack', 'head', 'weapon', 'armF', 'front'],
    mono: [
      { main: '#ff7eb6', accent: '#ffe066' },
      { main: '#4fd6a8', accent: '#ff9fce' },
      { main: '#8a6fd6', accent: '#ff8fbe' },
    ],
    monoKeys: { main: 'hood', accentMain: 'candyC', accent: ['candyA', 'candyC', 'heart', 'earIn'], keep: ['puff', 'puffIn', 'candyB', 'stick'] },
    palettes: [
      { hood: '#ff9ec7', hoodL: '#ffc8de', cuff: '#ffffff', earIn: '#ffe0ec', skin: '#ffe5d4', blush: '#ff8fb0', hair: '#7a4430', hairL: '#a8664a',
        eye: '#4a2a5e', eyeL: '#a36ad0', skirt: '#fff8fb', skirtL: '#ffd6e6', sock: '#ffffff', boot: '#ff6fa3', sole: '#ffffff',
        stick: '#ffffff', candyA: '#ff5a8a', candyB: '#ffffff', candyC: '#ffd23f', puff: '#ffffff', puffIn: '#ffc4da', heart: '#ff4d7d' },
      { hood: '#8de6c6', hoodL: '#c4f5e3', cuff: '#ffffff', earIn: '#ffeaf3', skin: '#ffe5d4', blush: '#ff9fb8', hair: '#5a3a70', hairL: '#7f5a99',
        eye: '#1f4a63', eyeL: '#4fb3d9', skirt: '#ffffff', skirtL: '#d5f7ea', sock: '#ffffff', boot: '#4cc9a4', sole: '#ffffff',
        stick: '#ffffff', candyA: '#4cc9f0', candyB: '#ffffff', candyC: '#ff9fce', puff: '#ffffff', puffIn: '#b8f0dd', heart: '#4cc9f0' },
      { hood: '#4f4466', hoodL: '#706289', cuff: '#2b2236', earIn: '#ff8fbe', skin: '#f6e3ea', blush: '#e07aa8', hair: '#26202f', hairL: '#4a3d5c',
        eye: '#b8205e', eyeL: '#ff6fa8', skirt: '#2b2236', skirtL: '#4a3d5c', sock: '#ff8fbe', boot: '#2b2236', sole: '#ff8fbe',
        stick: '#d9c7f5', candyA: '#7a3cc9', candyB: '#2b2236', candyC: '#ff8fbe', puff: '#e6dcff', puffIn: '#ffb3d6', heart: '#c94c8f' },
    ],
    walk: { A: 7, H: 7, bob: 3.4, sway: 3.5, arm: 12 },
    idlePeriod: 64,
    ai: {
      pref: [140, 280], aggression: 0.5, jumpiness: 0.35, zoning: 0.55,
      combos: [['2L', '5L', '5H', '5S'], ['5L', '5H', '6S'], ['5H', '5S'], ['jH', '5H', '5S'], ['2L', '2H'], ['5L', '2L', '2H']],
      antiAir: ['5H'], punish: ['5H', '6S'], enders: ['5S', '6S'],
    },

    poses: {
      stance: { t: 4, hd: 8, fs: 26, fe: 108, w: 85, bs: 12, be: 112, lf: [10, 0], lb: [-13, 0], d: 6 },
      stance2: { $: 'stance', d: 11, hd: 2, t: 2, fe: 112, w: 81 },
      walkBase: { $: 'stance', t: 6 },
      crouch: { t: 14, hd: 2, fs: 34, fe: 104, w: 80, bs: 24, be: 110, lf: [12, 0], lb: [-14, 0], d: 34 },
      crouch2: { $: 'crouch', d: 37, hd: 5 },
      squat: { t: 14, hd: 0, fs: 20, fe: 90, w: 105, bs: 6, be: 96, lf: [11, 0], lb: [-12, 0], d: 30 },
      jump: { t: -2, hd: -6, fs: 120, fe: 30, w: 50, bs: 140, be: 30, fh: 50, fk: 90, bh: 20, bk: 90 },
      fall: { t: 2, hd: 4, fs: 100, fe: 40, w: 60, bs: 110, be: 40, fh: 20, fk: 50, bh: -10, bk: 40 },
      tuck: { t: 20, hd: 12, fs: 60, fe: 100, w: 70, bs: 40, be: 100, fh: 100, fk: 140, bh: 85, bk: 135 },
      dash1: { t: 20, hd: -8, fs: -30, fe: 70, w: 160, bs: -60, be: 40, lf: [24, 0], lb: [-20, 8], d: 12 },
      dash2: { t: 16, hd: -6, fs: 20, fe: 80, w: 100, bs: -10, be: 60, lf: [6, 8], lb: [-14, 0], d: 10 },
      bdash: { t: -14, hd: 10, fs: 60, fe: 80, w: 70, bs: 40, be: 90, fh: 40, fk: 60, bh: -8, bk: 30 },
      block: { t: -6, hd: 14, fs: 70, fe: 110, w: 4, bs: 60, be: 120, lf: [8, 0], lb: [-16, 0], d: 10, face: 'block' },
      cblock: { t: 8, hd: 12, fs: 70, fe: 110, w: 4, bs: 60, be: 120, lf: [11, 0], lb: [-13, 0], d: 34, face: 'block' },
      // normals
      '5L_a': { t: -4, hd: 4, fs: 150, fe: 20, w: 30, bs: 30, be: 100, lf: [11, 0], lb: [-14, 0], d: 6 },
      '5L_b': { t: 14, hd: -4, x: 6, fs: 92, fe: 0, w: 48, bs: -10, be: 70, lf: [14, 0], lb: [-14, 0], d: 9, prop: 'lfront' },
      '2L_a': { t: 10, hd: 0, fs: 34, fe: 104, w: 80, bs: 20, be: 100, fh: 50, fk: 80, lb: [-14, 0], d: 34 },
      '2L_b': { t: 4, hd: 2, fs: 34, fe: 104, w: 80, bs: 20, be: 100, fh: 84, fk: 0, fa: -10, lb: [-16, 0], d: 36 },
      '5H_a': { t: 10, hd: 4, fs: -50, fe: 30, w: -80, bs: 30, be: 90, lf: [12, 0], lb: [-16, 0], d: 14 },
      '5H_b': { t: -6, hd: -2, x: 4, fs: 60, fe: 10, w: 20, bs: -20, be: 80, lf: [14, 0], lb: [-16, 0], d: 8, prop: 'lfront' },
      '5H_c': { t: -14, hd: -8, x: 6, fs: 130, fe: 10, w: 10, bs: -30, be: 70, lf: [14, 0], lb: [-14, 0], d: 4, prop: 'lfront' },
      '5H_d': { t: -10, hd: -6, fs: 160, fe: 20, w: 20, bs: -20, be: 80, lf: [12, 0], lb: [-14, 0], d: 6 },
      '2H_a': { t: 20, hd: 4, fs: -30, fe: 40, w: -95, bs: 30, be: 90, lf: [12, 0], lb: [-16, 0], d: 38 },
      '2H_b': { t: 26, hd: 2, x: 6, fs: 70, fe: 0, w: 10, bs: -20, be: 70, lf: [16, 0], lb: [-16, 0], d: 40, prop: 'lfront' },
      '6H_a': { t: -6, hd: -10, fs: 175, fe: 0, w: 25, bs: 140, be: 30, lf: [10, 0], lb: [-12, 0], d: 18 },
      '6H_b': { t: -8, hd: -8, fs: 175, fe: 0, w: 35, bs: 150, be: 20, fh: 30, fk: 60, bh: -10, bk: 60 },
      '6H_c': { t: 20, hd: 6, fs: 80, fe: 10, w: 30, bs: 40, be: 60, fh: 20, fk: 40, bh: -10, bk: 50, prop: 'lfront' },
      '6H_d': { t: 18, hd: 4, fs: 70, fe: 20, w: 30, bs: 30, be: 70, lf: [14, 0], lb: [-14, 0], d: 24, prop: 'lfront' },
      jL_a: { t: -10, hd: -4, fs: 120, fe: 40, w: 50, bs: 140, be: 40, fh: 70, fk: 100, bh: 60, bk: 100 },
      jL_b: { t: -22, hd: 2, fs: 130, fe: 30, w: 50, bs: 150, be: 30, fh: 70, fk: 4, fa: 10, bh: 60, bk: 10, ba: 10 },
      jH_a: { t: -14, hd: -8, fs: 190, fe: 0, w: 10, bs: 120, be: 40, fh: 40, fk: 80, bh: 10, bk: 80 },
      jH_b: { t: 18, hd: 6, fs: 70, fe: 0, w: -10, bs: 60, be: 60, fh: 50, fk: 80, bh: 10, bk: 70, prop: 'lfront' },
      // specials
      cheer: { t: -6, hd: -10, fs: 150, fe: 20, w: 15, bs: 160, be: 10, handB: 'open', lf: [12, 0], lb: [-12, 0], d: 4, face: 'happy' },
      point: { t: 6, hd: -2, x: 4, fs: 90, fe: 0, w: 10, bs: 20, be: 100, lf: [14, 0], lb: [-14, 0], d: 8, face: 'angry', prop: 'lfront' },
      hopA: { t: 16, hd: 0, fs: 40, fe: 90, w: 85, bs: 20, be: 90, lf: [10, 0], lb: [-12, 0], d: 36 },
      hopB: { t: -4, hd: -8, fs: 160, fe: 20, w: 20, bs: 150, be: 20, fh: 70, fk: 120, bh: 60, bk: 120 },
      hopC: { t: 4, hd: 4, fs: 120, fe: 30, w: 50, bs: 130, be: 30, fh: 10, fk: 10, bh: -6, bk: 10, fa: 0 },
      plantA: { t: 30, hd: 10, fs: 60, fe: 40, w: 120, bs: 50, be: 40, handB: 'open', lf: [14, 0], lb: [-14, 0], d: 38 },
      plantB: { t: 36, hd: 14, fs: 60, fe: 40, w: 120, bs: 75, be: 10, handB: 'open', lf: [14, 0], lb: [-16, 0], d: 40, face: 'happy' },
      floatA: { t: 4, hd: -4, fs: 170, fe: 10, w: 0, bs: 150, be: 20, handB: 'open', fh: 30, fk: 70, bh: 10, bk: 70 },
      floatB: { t: 10, hd: 6, fs: 170, fe: 10, w: 0, bs: 70, be: 10, handB: 'open', fh: 40, fk: 80, bh: 20, bk: 80 },
      // throw
      hugA: { t: 16, hd: 4, fs: 80, fe: 50, bs: 80, be: 50, hand: 'open', handB: 'open', lf: [14, 0], lb: [-14, 0], d: 10, face: 'happy', prop: 'stow' },
      hugB: { t: 10, hd: 12, fs: 70, fe: 80, bs: 70, be: 80, hand: 'open', handB: 'open', lf: [12, 0], lb: [-14, 0], d: 12, face: 'happy', prop: 'stow' },
      hugC: { t: -6, hd: -6, fs: 120, fe: 30, bs: 140, be: 20, hand: 'open', handB: 'open', lf: [12, 0], lb: [-14, 0], d: 4, face: 'happy', prop: 'stow' },
      // misc
      win: { t: -6, hd: -12, fs: 165, fe: 10, w: 15, bs: 150, be: 30, handB: 'open', fh: 30, fk: 60, bh: -10, bk: 60, y: -18, face: 'happy' },
      win2: { t: 2, hd: 8, fs: 150, fe: 30, w: 10, bs: 140, be: 40, handB: 'open', lf: [10, 0], lb: [-12, 0], d: 10, face: 'happy' },
      intro1: { t: 2, hd: 14, fs: 26, fe: 108, w: 85, bs: 150, be: 30, handB: 'open', lf: [10, 0], lb: [-12, 0], d: 4, face: 'happy' },
      intro2: { $: 'intro1', bs: 165, be: 10, hd: 4 },
      lose: { t: 22, hd: 20, fs: 120, fe: 120, bs: 120, be: 120, hand: 'fist', handB: 'fist', lf: [9, 0], lb: [-10, 0], d: 10, face: 'sad', prop: 'stow' },
      grabbed: { t: -14, hd: 20, fs: 60, fe: 50, w: 40, bs: 40, be: 50, lf: [8, 4], lb: [-14, 0], d: 6, face: 'hurt' },
    },

    anims: {
      intro: { keys: [[0, 'intro1'], [12, 'intro2'], [24, 'intro1'], [36, 'intro2'], [48, 'intro1'], [70, 'stance'], [96, 'stance']] },
      win: { keys: [[0, 'squat'], [8, 'win', 'out'], [22, 'win2', 'in'], [30, 'squat'], [38, 'win', 'out'], [52, 'win2', 'in'], [60, 'win2']] },
      lose: { keys: [[0, 'stance'], [20, 'lose']] },
    },

    moves: {
      '5L': {
        name: 'Bonk',
        anim: { keys: [[0, 'stance'], [3, '5L_a', 'out'], [5, '5L_b', 'snap'], [8, '5L_b'], [17, 'stance']] },
        hits: [{ at: [5, 8], limb: 'weaponTip', r: 22, dmg: 30, hs: 14, bs: 10, kb: [3, 0], sfx: 'hitL' }],
        ai: { range: [0, 145], kind: 'poke' },
      },
      '2L': {
        name: 'Tiny Kick',
        anim: { keys: [[0, 'crouch'], [3, '2L_a', 'out'], [5, '2L_b', 'snap'], [8, '2L_b'], [16, 'crouch']] },
        hits: [{ at: [5, 8], limb: 'footF', r: 13, dmg: 24, level: 'low', hs: 13, bs: 10, kb: [3, 0] }],
        ai: { range: [0, 75], kind: 'low' },
      },
      '5H': {
        name: 'Sugar Swing',
        anim: { keys: [[0, 'stance'], [6, '5H_a', 'out'], [10, '5H_b', 'snap'], [12, '5H_c', 'snap'], [14, '5H_d'], [24, '5H_d'], [31, 'stance']] },
        airInv: [9, 14],
        hits: [{ at: [10, 14], limb: 'weaponTip', r: 24, dmg: 70, hs: 20, bs: 15, kb: [6.5, 0], stop: 10, sfx: 'hitH' }],
        ai: { range: [30, 165], kind: 'poke' },
      },
      '2H': {
        name: 'Sweet Sweep',
        anim: { keys: [[0, 'crouch'], [5, '2H_a', 'out'], [9, '2H_b', 'snap'], [13, '2H_b'], [24, '2H_a'], [32, 'crouch']] },
        hits: [{ at: [9, 12], limb: 'weaponTip', r: 22, dmg: 64, level: 'low', kd: true, kb: [2, 5], hs: 20, bs: 14 }],
        ai: { range: [30, 175], kind: 'low' },
      },
      '6H': {
        name: 'Hop Bonk',
        anim: { keys: [[0, 'stance'], [6, '6H_a', 'out'], [10, '6H_b'], [18, '6H_b'], [20, '6H_c', 'snap'], [24, '6H_c'], [34, '6H_d'], [40, 'stance']] },
        vel: [[9, 2.5, 7.5], [20, 0]],
        hits: [{ at: [19, 23], limb: 'weaponTip', r: 24, dmg: 66, level: 'high', hs: 19, bs: 13, kb: [5, 0], stop: 11, sfx: 'hitH' }],
        ai: { range: [30, 195], kind: 'over' },
      },
      jL: {
        name: 'Bunny Kick',
        anim: { keys: [[0, 'jump'], [3, 'jL_a', 'out'], [5, 'jL_b', 'snap'], [12, 'jL_b'], [18, 'fall']] },
        hits: [{ at: [5, 11], limb: 'footF', r: 15, dmg: 32, hs: 14, bs: 10 }],
        ai: { kind: 'air' },
      },
      jH: {
        name: 'Lolly Smash',
        anim: { keys: [[0, 'jump'], [5, 'jH_a', 'out'], [8, 'jH_b', 'snap'], [14, 'jH_b'], [22, 'fall']] },
        hits: [{ at: [7, 13], limb: 'weaponTip', r: 24, dmg: 64, hs: 18, bs: 14, kb: [5, 0], sfx: 'hitH' }],
        ai: { kind: 'air' },
      },
      '5S': {
        name: 'Puff, Go!',
        // Puff needs a little rest between trips
        cond: (f) => !f.data.puffOut && (!f.battle || f.battle.frame - (f.data.puffBack || -999) > 36),
        anim: { keys: [[0, 'stance'], [6, 'cheer', 'out'], [10, 'point', 'snap'], [22, 'point'], [28, 'stance']] },
        ev: { 10: (f) => {
          spawnPuff(f, false);
          Sound.sfx('puff');
        } },
        ai: { range: [120, 900], kind: 'proj' },
      },
      '6S': {
        name: 'Bunny Hop',
        anim: { keys: [[0, 'stance'], [4, 'hopA', 'out'], [9, 'hopB', 'out'], [20, 'hopB'], [28, 'hopC'], [60, 'hopC']] },
        vel: [[8, 6, 11]],
        landEnd: true,
        landLag: 9,
        hits: [{ at: [16, 60], limb: 'legF', r: 17, dmg: 60, level: 'high', hs: 18, bs: 12, kb: [4, 0], maxHits: 1, sfx: 'boing', sfx2: 'hitM' }],
        ev: { 8: () => Sound.sfx('boing') },
        onHit: (f) => {
          f.vx = -2 * f.facing;
          f.vy = 9;
          FX.hearts(f.x, -f.y, 3);
          f.endMove();
        },
        ai: { range: [120, 260], kind: 'approach' },
      },
      '2S': {
        name: 'Candy Trap',
        cond: (f) => !f.data.trapOut,
        anim: { keys: [[0, 'crouch'], [6, 'plantA', 'out'], [12, 'plantB'], [26, 'plantB'], [34, 'crouch']] },
        ev: { 12: (f) => {
          spawnTrap(f);
          Sound.sfx('candy', { vol: 0.6 });
        } },
        ai: { range: [80, 420], kind: 'trap' },
      },
      jS: {
        name: 'Heart Drop',
        anim: { keys: [[0, 'jump'], [6, 'floatA', 'out'], [14, 'floatB', 'snap'], [28, 'floatB'], [34, 'fall']] },
        vel: [[0, null, 1.5]],
        grav: 0.12, gravAt: [0, 22],
        ev: { 14: (f) => spawnHeart(f) },
        ai: { kind: 'airS' },
      },
      SUP: {
        name: 'PUFF MAX!',
        inv: [0, 22],
        anim: { keys: [[0, 'squat'], [8, 'cheer', 'out'], [16, 'point', 'snap'], [50, 'point'], [60, 'stance']] },
        ev: { 16: (f) => {
          f.data.puffOut = false;
          spawnPuff(f, true);
          Sound.sfx('puff');
          Sound.sfx('boing');
        } },
        ai: { kind: 'super', range: [0, 700] },
      },
      THROW: {
        name: 'Big Hug',
        throw: true,
        throwAt: 3,
        anim: { keys: [[0, 'stance'], [3, 'throwReach'], [9, 'throwWhiff'], [24, 'stance']] },
        seq: {
          len: 44,
          tech: true,
          anim: { keys: [[0, 'hugA'], [8, 'hugB'], [12, 'hugA'], [16, 'hugB'], [20, 'hugA'], [26, 'hugC', 'snap'], [44, 'stance']] },
          vic: [[0, 'grabbed', 40, 0], [12, 'grabbed', 36, 0], [16, 'hurt2', 36, 0], [26, 'hurt', 38, 0], [32, 'hurtAir', 60, 18]],
          hits: { 15: { dmg: 25, sfx: 'hitM', word: 'SQUEEZE!' }, 30: { dmg: 65, sfx: 'hitH', shake: 6, stop: 6, word: 'POMF!' } },
          ev: {
            4: (a) => FX.hearts(a.x + a.facing * 30, -a.y - 130, 4),
            14: (a) => FX.hearts(a.x + a.facing * 30, -a.y - 130, 6),
            26: (a) => {
              a.cos.puffBonk = 14;
              Sound.sfx('boing');
            },
          },
          release: { vx: 9, vy: 9 },
          recover: 12,
        },
      },
    },

    // ---- drawing ------------------------------------------------------------
    draw: {
      behind(ctx, f, J, pal) {
        if (J.P.prop === 'stow') {
          ctx.save();
          ctx.translate(J.hip[0], J.hip[1]);
          ctx.rotate(J.ta);
          drawLolly(ctx, [10, -8], [-34, -70], pal, f.C.lw);
          ctx.restore();
        }
        // bunny tail: a fluffy pom of bumps with ink fluff curls
        ctx.save();
        ctx.translate(J.hip[0], J.hip[1]);
        ctx.rotate(J.ta);
        if (Sketch.active) {
          ctx.beginPath();
          for (let i = 0; i < 7; i++) {
            const a = (i / 7) * TAU + 0.3;
            Draw.circlePath(ctx, -21 + Math.cos(a) * 5.4, -8 + Math.sin(a) * 5.4, 4);
          }
          Draw.circlePath(ctx, -21, -8, 6.4);
          ctx.fillStyle = pal.puff;
          ctx.fill();
          if (pxOf(ctx) > 0.45) {
            ctx.beginPath();
            for (const [a, r] of [[2.3, 3.2], [3.3, 3], [4.3, 2.8]]) {
              const cx = -21 + Math.cos(a) * 6.2, cy = -8 + Math.sin(a) * 6.2;
              ctx.moveTo(cx + Math.cos(a - 1.2) * r, cy + Math.sin(a - 1.2) * r);
              ctx.arc(cx, cy, r, a - 1.2, a + 0.9);
            }
            ctx.moveTo(-23.5, -5.5);
            ctx.quadraticCurveTo(-22, -3.6, -19.6, -4.6);
            pen(ctx, pal.ink, 1.2);
            ctx.stroke();
          }
        } else Draw.circle(ctx, -21, -8, 8.5, pal.puff === '#ffffff' ? '#ffffff' : pal.puff, f.C.lw, pal.ink);
        ctx.restore();
        // Puff floats behind her shoulder
        const c = f.cos;
        if (f.data && f.data.puffOut) return;
        const pp = c.puffLocal || [-50, -98];
        let s = 1;
        if (c.puffPoof > 0) s = U.ease.back(1 - c.puffPoof / 18);
        if (c.puffBonk > 0) {
          drawPuff(ctx, 34 + (14 - c.puffBonk) * 3, -96, 1.1, pal, f.t || 0, 1, 'angry');
          return;
        }
        if (s > 0.01) drawPuff(ctx, pp[0], pp[1], s, pal, f.t || 0, 1, f.face === 'hurt' || f.face === 'ko' ? 'angry' : 'happy');
      },
      // the lollipop goes behind the big head whenever it overlaps it
      weaponBack(ctx, f, J, pal) {
        if (!J.wTip || J.P.prop === 'stow' || J.P.prop === 'lfront') return;
        if (lollyOverHead(J)) drawLolly(ctx, J.wEnd, J.wTip, pal, f.C.lw);
      },
      weapon(ctx, f, J, pal) {
        if (!J.wTip || J.P.prop === 'stow') return;
        if (J.P.prop === 'lfront' || !lollyOverHead(J)) drawLolly(ctx, J.wEnd, J.wTip, pal, f.C.lw);
      },
      torso(ctx, f, J, pal) {
        const T = f.C.body.torso, lw = f.C.lw, ink = pal.ink;
        const px = Sketch.active ? pxOf(ctx) : 0, fine = px > 0.6, some = px > 0.35;
        // puffy tutu skirt, with a frill of lace peeking out under its scallops
        const skirtPath = (dy) => {
          for (let i = 0; i <= 6; i++) {
            const x = -24 + i * 8.4;
            ctx.quadraticCurveTo(x + 4.2, 15 + dy, x + 8.4, 7 + dy);
          }
        };
        if (some) {
          ctx.beginPath();
          ctx.moveTo(-23, -2.6);
          skirtPath(1.6);
          dots(ctx, pal.skirtL, 4, 3.1);
        }
        ctx.beginPath();
        ctx.moveTo(-23, -4);
        skirtPath(0);
        ctx.lineTo(27, -4);
        ctx.closePath();
        Draw.fillStroke(ctx, pal.skirt, lw, pal.ink);
        ctx.fillStyle = pal.skirtL;
        ctx.beginPath();
        ctx.ellipse(2, 4, 20, 3, 0, 0, TAU);
        ctx.fill();
        if (some) {
          // ruffle lines inside each scallop and pleats up from the dips
          ctx.beginPath();
          for (let i = 0; i <= 6; i++) {
            const x = -24 + i * 8.4;
            ctx.moveTo(x + 2, 8.6);
            ctx.quadraticCurveTo(x + 4.2, 12.4, x + 6.6, 8.8);
            if (i) {
              ctx.moveTo(x, 6.6);
              ctx.lineTo(x - 0.6, 2.5);
            }
          }
          pen(ctx, ink, 1.1);
          ctx.stroke();
        }
        // hoodie body (round and puffy)
        ctx.beginPath();
        ctx.moveTo(-20, 2);
        ctx.quadraticCurveTo(-27, -T * 0.5, -17, -T - 2);
        ctx.quadraticCurveTo(0, -T - 9, 17, -T - 2);
        ctx.quadraticCurveTo(28, -T * 0.5, 22, 2);
        ctx.quadraticCurveTo(1, 7, -20, 2);
        ctx.closePath();
        Draw.fillStroke(ctx, pal.hood, lw, pal.ink);
        ctx.save();
        ctx.clip();
        ctx.fillStyle = pal.dark.hood;
        ctx.beginPath();
        ctx.ellipse(-24, -T * 0.4, 9, T, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
        if (some) {
          // a stitched side seam, and the fabric bunching above the hem
          ctx.beginPath();
          ctx.moveTo(-6, -T + 4);
          ctx.quadraticCurveTo(-10, -T * 0.5, -7.5, 1.5);
          stitch(ctx, ink, 1, 2.4, 2.2);
          ctx.beginPath();
          ctx.moveTo(13, -5.5);
          ctx.quadraticCurveTo(16.5, -4.4, 18.5, -7.6);
          ctx.moveTo(-1, -4.5);
          ctx.quadraticCurveTo(2.5, -3.2, 4.6, -6);
          ctx.moveTo(19.5, -T * 0.62);
          ctx.quadraticCurveTo(22.5, -T * 0.55, 23.4, -T * 0.42);
          pen(ctx, ink, 1.2);
          ctx.stroke();
        }
        // hem
        ctx.beginPath();
        ctx.moveTo(-20, 1);
        ctx.quadraticCurveTo(1, 7, 22, 1);
        ctx.lineWidth = 6;
        ctx.strokeStyle = pal.ink;
        ctx.stroke();
        ctx.lineWidth = 3;
        ctx.strokeStyle = pal.hoodL;
        ctx.stroke();
        if (some) {
          // knit ribbing on the hem band
          ctx.beginPath();
          for (let t = 0.08; t < 0.95; t += 0.07) {
            const v = 1 - t;
            const x = v * v * -20 + 2 * t * v * 1 + t * t * 22, y = v * v * 1 + 2 * t * v * 7 + t * t * 1;
            ctx.moveTo(x, y - 1.3);
            ctx.lineTo(x + 0.2, y + 1.3);
          }
          pen(ctx, U.mix(pal.hoodL, ink, 0.5), 0.9);
          ctx.stroke();
        }
        // heart patch, stitched on
        Draw.heart(ctx, 8, -T * 0.45, 15, pal.heart, 3, pal.ink);
        if (some) {
          ctx.beginPath();
          Draw.heartPath(ctx, 8, -T * 0.45 + 0.3, 11.2);
          stitch(ctx, ink, 0.9, 1.5, 1.4);
        }
        Draw.circle(ctx, 5, -T * 0.5, 1.6, '#ffffff', 0);
        // drawstrings with pom-poms
        for (const [x0, x1] of [[4, 2], [14, 15]]) {
          Draw.line(ctx, x0, -T + 1, x1, -T + 12, 1.8, pal.cuff, 1.3, pal.ink);
          Draw.circle(ctx, x1, -T + 14, 3.2, pal.cuff, 2, pal.ink);
        }
        if (fine) {
          // fluff on the pom-poms and the strings' little knots
          ctx.beginPath();
          for (const x1 of [2, 15]) {
            ctx.moveTo(x1 - 2.2, -T + 15.2);
            ctx.quadraticCurveTo(x1 - 0.6, -T + 17.6, x1 + 1.6, -T + 16);
            ctx.moveTo(x1 - 1.2, -T + 11.2);
            ctx.lineTo(x1 + 1.2, -T + 11.2);
          }
          pen(ctx, ink, 0.9);
          ctx.stroke();
        }
      },
      head(ctx, f, J, pal, face) {
        const lw = f.C.lw;
        const c = f.cos || {};
        const E = c.ears || { a: [-4, -22], b: [-10, -16] };
        const ink = pal.ink;
        // device px per head unit: the finest lines are left out when tiny
        const px = Sketch.active ? pxOf(ctx) : 0, fine = px > 0.5, some = px > 0.3;
        // ears behind the hood
        ear(ctx, pal, -13, -30, E.a[1], E.b[1], 50, lw, true, px);
        ear(ctx, pal, 7, -33, E.a[0], E.b[0], 50, lw, true, px);
        // hood shell
        ctx.beginPath();
        Draw.blobPath(ctx, [16, -34, -6, -41, -31, -30, -40, -4, -36, 22, -18, 37, 8, 38, 30, 22, 38, -6]);
        Draw.fillStroke(ctx, pal.hood, lw, pal.ink);
        ctx.save();
        ctx.clip();
        ctx.fillStyle = pal.dark.hood;
        ctx.beginPath();
        ctx.ellipse(-38, 2, 14, 40, 0.1, 0, TAU);
        ctx.fill();
        ctx.restore();
        if (some) {
          // the hood's seam, stitched round the crown, with a little fold at the back
          ctx.beginPath();
          ctx.ellipse(3, 4, 38, 37, 0, -1.12, 2.22, true);
          stitch(ctx, ink, 1.5, 3.4, 2.8);
          ctx.beginPath();
          ctx.moveTo(-34, 14);
          ctx.quadraticCurveTo(-37, 20, -33, 26);
          ctx.moveTo(-30, -24);
          ctx.quadraticCurveTo(-34, -21, -35, -15);
          pen(ctx, ink, 1.7);
          ctx.stroke();
        }
        // face
        Draw.ellipse(ctx, 5, 7, 29, 27, 0, pal.skin, lw, pal.ink);
        // hood rim
        ctx.beginPath();
        ctx.ellipse(4, 5, 31.5, 30, 0, -1.25, 2.3, true);
        ctx.lineCap = 'round';
        ctx.lineWidth = 14;
        ctx.strokeStyle = pal.ink;
        ctx.stroke();
        ctx.lineWidth = 9;
        ctx.strokeStyle = pal.hoodL;
        ctx.stroke();
        if (some) {
          // knit ribbing across the rim and a line where it meets the hood
          ctx.beginPath();
          for (let a = -1.32; a > -3.98; a -= 0.24) {
            const cs = Math.cos(a), sn = Math.sin(a);
            ctx.moveTo(4 + cs * 28.8, 5 + sn * 27.3);
            ctx.lineTo(4 + cs * 33.6, 5 + sn * 32.1);
          }
          pen(ctx, U.mix(pal.hoodL, ink, 0.32), 1.2);
          ctx.stroke();
          ctx.beginPath();
          ctx.ellipse(4, 5, 36.2, 34.6, 0, -1.3, 2.25, true);
          pen(ctx, ink, 1.5);
          ctx.stroke();
        }
        // a cowlick sprouting from the crown (its root hides under the bangs)
        ctx.beginPath();
        ctx.moveTo(-11, -24);
        ctx.quadraticCurveTo(-12.5, -36.5, -4, -39.5);
        ctx.quadraticCurveTo(2.5, -41, 3, -35.5);
        ctx.quadraticCurveTo(0.8, -37.8, -3.5, -36.4);
        ctx.quadraticCurveTo(-7.5, -34.5, -5, -24);
        ctx.closePath();
        ctx.fillStyle = pal.hair;
        ctx.fill();
        // locks of hair framing the face
        ctx.beginPath();
        ctx.moveTo(21, -7);
        ctx.quadraticCurveTo(32, -3, 31, 12);
        ctx.quadraticCurveTo(30.6, 17, 26.5, 18);
        ctx.quadraticCurveTo(28.6, 13, 27.4, 6);
        ctx.quadraticCurveTo(26, -1, 19, -4);
        ctx.closePath();
        ctx.moveTo(-19, -11);
        ctx.quadraticCurveTo(-26.5, 0, -24.5, 13);
        ctx.quadraticCurveTo(-24, 18, -19.5, 19);
        ctx.quadraticCurveTo(-21.8, 14, -20.8, 6);
        ctx.quadraticCurveTo(-20, -2, -15, -6);
        ctx.closePath();
        ctx.fillStyle = pal.hair;
        ctx.fill();
        // blunt bangs
        ctx.beginPath();
        ctx.moveTo(-22, -12);
        ctx.quadraticCurveTo(-20, -3, -14, -4);
        ctx.quadraticCurveTo(-11, 3, -4, -3);
        ctx.quadraticCurveTo(1, 3, 7, -3);
        ctx.quadraticCurveTo(12, 2, 18, -4);
        ctx.quadraticCurveTo(24, 0, 30, -7);
        ctx.quadraticCurveTo(31, -24, 10, -27);
        ctx.quadraticCurveTo(-14, -28, -22, -12);
        ctx.closePath();
        Draw.fillStroke(ctx, pal.hair, lw * 0.85, pal.ink);
        ctx.fillStyle = pal.hairL;
        ctx.beginPath();
        ctx.ellipse(4, -19, 10, 3, -0.15, 0, TAU);
        ctx.fill();
        if (some) {
          // light strands down each lock, ink partings between them
          ctx.beginPath();
          ctx.moveTo(-10, -17);
          ctx.quadraticCurveTo(-11.5, -8, -9.5, -1.5);
          ctx.moveTo(1, -14);
          ctx.quadraticCurveTo(0.5, -6, 1.5, -0.5);
          ctx.moveTo(12, -14);
          ctx.quadraticCurveTo(12.8, -6, 12, -1.5);
          ctx.moveTo(23, -14);
          ctx.quadraticCurveTo(25, -7, 23.6, -3.5);
          ctx.moveTo(29.5, -1);
          ctx.quadraticCurveTo(29.6, 8, 28.2, 14);
          ctx.moveTo(-22.5, 0);
          ctx.quadraticCurveTo(-23.2, 8, -21.5, 15);
          ctx.moveTo(-8, -27.5);
          ctx.quadraticCurveTo(-9, -35, -3.5, -38.2);
          pen(ctx, pal.hairL, 1.6);
          ctx.stroke();
          ctx.beginPath();
          for (const [x0, y0, x1, y1] of [[-14, -4, -13, -13], [-4, -3, -4.5, -12], [7, -3, 6.5, -11], [18, -4, 17, -12]]) {
            ctx.moveTo(x0, y0);
            ctx.quadraticCurveTo(x0 + 0.4, (y0 + y1) / 2, x1, y1);
          }
          ctx.moveTo(-15, -6);
          ctx.quadraticCurveTo(-20, -1, -20.6, 7);
          ctx.moveTo(20, -4.5);
          ctx.quadraticCurveTo(26, -2, 27, 5);
          pen(ctx, ink, 1.5);
          ctx.stroke();
          if (fine) {
            // shine ticks on the hair's highlight band
            ctx.beginPath();
            for (const sx of [0, 3.4, 9]) {
              ctx.moveTo(sx, -21.6);
              ctx.lineTo(sx - 0.8, -17.2);
            }
            pen(ctx, '#ffffff', 1.3);
            ctx.stroke();
          }
        }
        // a bow on the front ear
        ctx.save();
        ctx.translate(15, -31.5);
        ctx.rotate(0.42);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-3, -8, -11, -8, -10.5, -1);
        ctx.bezierCurveTo(-10.5, 4, -4, 4, 0, 0);
        ctx.bezierCurveTo(4, 4, 10.5, 4, 10.5, -1);
        ctx.bezierCurveTo(11, -8, 3, -8, 0, 0);
        ctx.moveTo(-1.2, 1);
        ctx.lineTo(-5.5, 9.5);
        ctx.lineTo(-3.4, 8.6);
        ctx.lineTo(-2.4, 10.6);
        ctx.lineTo(1.6, 1.6);
        ctx.closePath();
        ctx.moveTo(1, 1.2);
        ctx.lineTo(4.6, 9.4);
        ctx.lineTo(2.6, 8.8);
        ctx.lineTo(1.4, 10.6);
        ctx.lineTo(-1.2, 1.8);
        ctx.closePath();
        ctx.fillStyle = pal.heart;
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(0, -0.6, 2.8, 3.2, 0, 0, TAU);
        ctx.fillStyle = U.shade(pal.heart, -0.12);
        ctx.fill();
        if (some) {
          ctx.beginPath();
          ctx.moveTo(-2.6, -1.6);
          ctx.quadraticCurveTo(-5.5, -4.6, -8.6, -3.4);
          ctx.moveTo(-2.6, 0.6);
          ctx.quadraticCurveTo(-5.6, 1.2, -7.6, 0.4);
          ctx.moveTo(2.6, -1.6);
          ctx.quadraticCurveTo(5.5, -4.6, 8.6, -3.4);
          ctx.moveTo(2.6, 0.6);
          ctx.quadraticCurveTo(5.6, 1.2, 7.6, 0.4);
          ctx.moveTo(-0.9, -3);
          ctx.quadraticCurveTo(-1.6, -0.6, -0.9, 2);
          pen(ctx, ink, 1.4);
          ctx.stroke();
        }
        ctx.restore();
        // eyes
        eye(ctx, pal, -5, 11, 7.8, 10, face, f.blinking, false, some);
        eye(ctx, pal, 19, 11, 6.8, 9.4, face, f.blinking, true, some);
        if (face === 'angry' || face === 'block') {
          ctx.strokeStyle = pal.ink;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(-12, -1);
          ctx.lineTo(0, 2);
          ctx.moveTo(14, 2);
          ctx.lineTo(25, -1);
          ctx.stroke();
        }
        // blush
        ctx.globalAlpha = face === 'hurt' || face === 'ko' ? 0.4 : 0.75;
        Draw.ellipse(ctx, -12, 23, 6.5, 3.6, 0, pal.blush, 0);
        Draw.ellipse(ctx, 26, 23, 5, 3.2, 0, pal.blush, 0);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = some ? U.mix(pal.blush, ink, 0.4) : U.shade(pal.blush, -0.15);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (const bx of some ? [-16, -12.5, -9, 23.5, 26.8] : [-15, -11, -7]) {
          ctx.moveTo(bx, 25);
          ctx.lineTo(bx + 2, 21);
        }
        if (some) {
          // a tiny nose
          ctx.moveTo(9.4, 17.6);
          ctx.quadraticCurveTo(10.6, 18.8, 9.2, 19.4);
        }
        ctx.stroke();
        // mouth
        ctx.strokeStyle = pal.ink;
        ctx.lineWidth = 2.6;
        ctx.lineCap = 'round';
        if (face === 'happy') {
          ctx.beginPath();
          ctx.moveTo(1, 22);
          ctx.quadraticCurveTo(8, 33, 15, 22);
          ctx.closePath();
          Draw.fillStroke(ctx, '#c2415f', 2.6, pal.ink);
          Draw.ellipse(ctx, 8, 27, 3.5, 2, 0, '#ff8fa8', 0);
        } else if (face === 'hurt' || face === 'ko') {
          ctx.beginPath();
          ctx.moveTo(1, 26);
          ctx.quadraticCurveTo(4, 22, 7, 26);
          ctx.quadraticCurveTo(10, 30, 13, 26);
          ctx.stroke();
        } else if (face === 'angry') {
          Draw.ellipse(ctx, 8, 25, 4.5, 3.6, 0, '#c2415f', 2.6, pal.ink);
        } else if (face === 'sad') {
          ctx.beginPath();
          ctx.moveTo(2, 27);
          ctx.quadraticCurveTo(8, 21, 14, 27);
          ctx.stroke();
        } else {
          // cat mouth with a tiny fang
          ctx.beginPath();
          ctx.arc(5, 23, 3.2, 0.2, Math.PI - 0.4);
          ctx.arc(11, 23, 3.2, 0.4, Math.PI - 0.2);
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(10.5, 25.5);
          ctx.lineTo(12.5, 25.5);
          ctx.lineTo(11.6, 28.5);
          ctx.closePath();
          ctx.fill();
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      },
      // the default arm (Rig.drawArm) plus ribbing on the sleeve cuff
      arm(ctx, f, J, side, pc, pal) {
        const C = f.C, b = C.body, back = side === 'B', P = J.P;
        const s = back ? J.sB : J.sF, e = back ? J.eB : J.eF, h = back ? J.hB : J.hF;
        const r1 = b.armR[1], r2 = b.armR[2];
        Rig.limb(ctx, s, e, h, b.armR[0], r1, r2, pc.hood, pc.hood, C.lw, pal.ink);
        Rig.band(ctx, e, h, r1, r2, 0.72, 1.0, pc.cuff, C.lw, pal.ink);
        if (Sketch.active && pxOf(ctx) > 0.5) {
          const dx = h[0] - e[0], dy = h[1] - e[1], L = Math.hypot(dx, dy) || 1;
          const tx = dx / L, ty = dy / L, nx = -ty, ny = tx;
          ctx.beginPath();
          // the cuff's top edge, ribs along it, and a crease on the sleeve
          const at = (t, k) => [e[0] + dx * t + nx * k, e[1] + dy * t + ny * k];
          for (const k of [-0.5, 0, 0.5]) {
            const r = r1 + (r2 - r1) * 0.8;
            let q = at(0.75, k * r);
            ctx.moveTo(q[0], q[1]);
            q = at(0.92, k * r);
            ctx.lineTo(q[0], q[1]);
          }
          let q = at(0.7, -r1 - 0.4);
          ctx.moveTo(q[0], q[1]);
          q = at(0.73, r1 + 0.4);
          ctx.lineTo(q[0], q[1]);
          pen(ctx, pal.ink, 0.9);
          ctx.stroke();
        }
        const hs = back ? P.handB || C.handDef : P.hand || C.handDef;
        if (hs !== 'none') Rig.drawHand(ctx, f, J, e, h, hs, pc.skin, pal, back);
      },
      // the default leg (Rig.drawLeg) with a lace frill on the socks and a
      // plaster on the front knee
      leg(ctx, f, J, side, pc, pal) {
        const C = f.C, b = C.body, back = side === 'B';
        const hp = back ? J.hipB : J.hipF, k = back ? J.kB : J.kF, a = back ? J.aB : J.aF, t = back ? J.tB : J.tF;
        const [r0, r1, r2] = b.legR;
        Rig.limb(ctx, hp, k, a, r0, r1, r2, pc.skin, pc.skin, C.lw, pal.ink);
        Rig.band(ctx, k, a, r1, r2, 0.62, 1.0, pc.sock, C.lw, pal.ink);
        const px = Sketch.active ? pxOf(ctx) : 0;
        if (px > 0.35) {
          const dx = a[0] - k[0], dy = a[1] - k[1], L = Math.hypot(dx, dy) || 1;
          const tx = dx / L, ty = dy / L, nx = -ty, ny = tx;
          const at = (tt, kk) => [k[0] + dx * tt + nx * kk, k[1] + dy * tt + ny * kk];
          // the frill round the top of the sock
          const rr = r1 + (r2 - r1) * 0.56 + 1.4;
          let q = at(0.56, -rr);
          ctx.beginPath();
          ctx.moveTo(q[0], q[1]);
          q = at(0.56, rr);
          ctx.lineTo(q[0], q[1]);
          dots(ctx, pc.sock, 3.6, 2.6);
          if (px > 0.5) {
            ctx.beginPath();
            q = at(0.6, -rr + 1.2);
            ctx.moveTo(q[0], q[1]);
            q = at(0.6, rr - 1.2);
            ctx.lineTo(q[0], q[1]);
            // ribs down the sock
            for (const kk of [-0.45, 0, 0.45]) {
              q = at(0.66, kk * r2);
              ctx.moveTo(q[0], q[1]);
              q = at(0.8, kk * r2);
              ctx.lineTo(q[0], q[1]);
            }
            pen(ctx, pal.ink, 0.9);
            ctx.stroke();
          }
          if (!back && px > 0.5) {
            // a plaster on the knee: Mochi falls over a lot
            const kx = k[0] + tx * 1.5, ky = k[1] + ty * 1.5;
            ctx.save();
            ctx.translate(kx, ky);
            ctx.rotate(Math.atan2(ty, tx) + 0.9);
            ctx.beginPath();
            Draw.roundRectPath(ctx, -5.4, -2.2, 10.8, 4.4, 2.2);
            ctx.fillStyle = U.mix(pal.skin, pal.boot, 0.18);
            ctx.fill();
            ctx.beginPath();
            ctx.rect(-1.8, -2.2, 3.6, 4.4);
            ctx.fillStyle = U.mix(pal.skin, pal.boot, 0.38);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(-1.8, -2.2);
            ctx.lineTo(-1.8, 2.2);
            ctx.moveTo(1.8, -2.2);
            ctx.lineTo(1.8, 2.2);
            pen(ctx, pal.ink, 0.7);
            ctx.stroke();
            ctx.restore();
          }
        }
        Rig.drawFoot(ctx, f, J, a, t, pc.boot, pal, back);
      },
      hand(ctx, f, J, e, h, style, col, pal) {
        const r = f.C.body.handR;
        const ang = Math.atan2(h[1] - e[1], h[0] - e[0]);
        const detail = Sketch.active && pxOf(ctx) * r > 5;
        if (style === 'open') {
          ctx.save();
          ctx.translate(h[0], h[1]);
          ctx.rotate(ang);
          Draw.ellipse(ctx, r * 0.3, 0, r * 1.1, r * 0.9, 0, col, f.C.lw * 0.9, pal.ink);
          if (detail) {
            // little splits between the fingers and the thumb's edge
            ctx.beginPath();
            for (const y of [-0.36, 0.06, 0.46]) {
              ctx.moveTo(r * 1.36, y * r);
              ctx.lineTo(r * 0.92, y * r * 0.85);
            }
            ctx.moveTo(-r * 0.1, -r * 0.82);
            ctx.quadraticCurveTo(r * 0.45, -r * 0.62, r * 0.62, -r * 0.2);
            pen(ctx, pal.ink, 0.9);
            ctx.stroke();
          }
          ctx.restore();
          return;
        }
        Draw.circle(ctx, h[0], h[1], r, col, f.C.lw * 0.9, pal.ink);
        if (detail) {
          // knuckles, curled fingers and a thumb
          ctx.save();
          ctx.translate(h[0], h[1]);
          ctx.rotate(ang);
          ctx.beginPath();
          ctx.moveTo(r * 0.5 * Math.cos(-0.9), r * 0.5 * Math.sin(-0.9));
          ctx.arc(0, 0, r * 0.5, -0.9, 0.9);
          for (const y of [-0.36, 0.36]) {
            ctx.moveTo(r * 0.55, y * r);
            ctx.lineTo(r * 0.94, y * r * 1.1);
          }
          ctx.moveTo(-r * 0.5, -r * 0.5);
          ctx.quadraticCurveTo(r * 0.05, -r * 0.9, r * 0.5, -r * 0.45);
          pen(ctx, pal.ink, 0.9);
          ctx.stroke();
          ctx.restore();
        }
      },
      foot(ctx, f, J, a, t, col, pal) {
        const ang = Math.atan2(t[1] - a[1], t[0] - a[0]);
        const L = Math.hypot(t[0] - a[0], t[1] - a[1]);
        ctx.save();
        ctx.translate(a[0], a[1]);
        ctx.rotate(ang);
        Draw.roundRect(ctx, -8, -8, L + 15, 16, 8, col, f.C.lw, pal.ink);
        Draw.roundRect(ctx, -9, 4, L + 17, 5, 2.5, pal.sole, f.C.lw * 0.5, pal.ink);
        const px = Sketch.active ? pxOf(ctx) : 0;
        if (px > 0.35) {
          // a strap over the instep
          ctx.beginPath();
          ctx.moveTo(L * 0.4 - 4.5, -8.4);
          ctx.lineTo(L * 0.4 + 0.6, -1);
          ctx.strokeStyle = U.shade(col, -0.16);
          ctx.lineWidth = 3.8;
          ctx.lineCap = 'butt';
          ctx.stroke();
        }
        Draw.circle(ctx, L * 0.4, -3, 2.6, pal.sole, 0);
        if (px > 0.5) {
          // the button's thread, a toe cap seam, stitches above the sole and tread
          ctx.beginPath();
          ctx.moveTo(L * 0.4 - 0.9, -3.8);
          ctx.lineTo(L * 0.4 + 0.9, -2.2);
          ctx.moveTo(L * 0.4 + 0.9, -3.8);
          ctx.lineTo(L * 0.4 - 0.9, -2.2);
          ctx.moveTo(L + 1.5, -7.2);
          ctx.quadraticCurveTo(L - 1.6, -1.5, L + 0.5, 3.6);
          for (let x = -5; x < L + 6; x += 4) {
            ctx.moveTo(x, 6.6);
            ctx.lineTo(x + 1.2, 8.6);
          }
          pen(ctx, pal.ink, 0.9);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-6.5, 2.6);
          ctx.lineTo(L + 4.5, 2.6);
          stitch(ctx, pal.ink, 0.8, 1.6, 1.5);
        }
        ctx.restore();
      },
    },

    // ears + Puff cosmetic physics
    post(f) {
      const c = f.cos;
      const J = f.J;
      if (!c.ears) c.ears = { a: [-4, -22], b: [-10, -16], v: [0, 0], vb: [0, 0], hx: null, hy: 0, hvx: 0, hvy: 0 };
      const E = c.ears;
      const hx = (f.x || 0) + J.head[0] * f.facing, hy = -(f.y || 0) + J.head[1];
      let ax = 0, ay = 0;
      if (E.hx !== null) {
        const vx = hx - E.hx, vy = hy - E.hy;
        ax = U.clamp(vx - E.hvx, -12, 12);
        ay = U.clamp(vy - E.hvy, -12, 12);
        E.hvx = vx;
        E.hvy = vy;
      }
      E.hx = hx;
      E.hy = hy;
      const face = f.face;
      let tF = -4, tB = -22, bend = -12;
      if (face === 'hurt' || face === 'ko' || face === 'sad') {
        tF = -62;
        tB = -78;
        bend = -40;
      } else if (face === 'happy') {
        tF = 6;
        tB = -12;
        bend = -6;
      } else if (face === 'angry') {
        tF = -16;
        tB = -32;
        bend = -18;
      }
      const tt = f.t || 0;
      tF += Math.sin(tt * 0.05) * 3;
      tB += Math.sin(tt * 0.05 + 1.3) * 3;
      const local = -ax * f.facing;
      for (let i = 0; i < 2; i++) {
        const target = i ? tB : tF;
        E.v[i] += (target - E.a[i]) * 0.1 + local * 2.4 + ay * 3.2;
        E.v[i] *= 0.8;
        E.a[i] = U.clamp(E.a[i] + E.v[i], -120, 50);
        const bt = bend + E.v[i] * 1.5 + (E.a[i] < -50 ? -20 : 0);
        E.vb[i] += (bt - E.b[i]) * 0.2;
        E.vb[i] *= 0.7;
        E.b[i] = U.clamp(E.b[i] + E.vb[i], -80, 30);
      }
      // Puff follows with a lag (simulated in world space)
      const bob = Math.sin(tt * 0.07) * 6;
      const tx = (f.x || 0) - f.facing * 50, ty = -(f.y || 0) - 98 + bob;
      if (!c.puff) c.puff = { x: tx, y: ty, vx: 0, vy: 0 };
      const P = c.puff;
      P.vx += (tx - P.x) * 0.06;
      P.vy += (ty - P.y) * 0.06;
      P.vx *= 0.84;
      P.vy *= 0.84;
      P.x += P.vx;
      P.y += P.vy;
      if (Math.abs(P.x - tx) > 200 || Math.abs(P.y - ty) > 200) {
        P.x = tx;
        P.y = ty;
      }
      c.puffLocal = [(P.x - (f.x || 0)) * f.facing, P.y + (f.y || 0)];
      if (c.puffPoof > 0) c.puffPoof--;
      if (c.puffBonk > 0) c.puffBonk--;
    },

    onReset(f) {
      f.data.puffOut = false;
      f.data.trapOut = false;
    },
  });
})();
