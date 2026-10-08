'use strict';
// ---------------------------------------------------------------------------
// Drawing helpers: outlined cartoon shapes, chunky text, bursts, etc.
// ---------------------------------------------------------------------------

const INK = '#1d1428'; // default outline color
const FONT_DISPLAY = "'Luckiest Guy', 'Arial Black', Impact, sans-serif";
const FONT_UI = "'Fredoka', 'Trebuchet MS', 'Arial Rounded MT Bold', sans-serif";

const Draw = {
  // Path of a capsule whose radius tapers from ra (at a) to rb (at b).
  taper(ctx, ax, ay, ra, bx, by, rb) {
    const dx = bx - ax, dy = by - ay;
    const d = Math.hypot(dx, dy);
    if (d <= Math.abs(ra - rb) + 0.001) {
      const r = Math.max(ra, rb);
      const cx = ra > rb ? ax : bx, cy = ra > rb ? ay : by;
      ctx.moveTo(cx + r, cy);
      ctx.arc(cx, cy, r, 0, TAU);
      return;
    }
    const th = Math.atan2(dy, dx);
    const ph = Math.acos(U.clamp((ra - rb) / d, -1, 1));
    ctx.moveTo(ax + ra * Math.cos(th + ph), ay + ra * Math.sin(th + ph));
    ctx.arc(ax, ay, ra, th + ph, th - ph + TAU);
    ctx.arc(bx, by, rb, th - ph, th + ph);
    ctx.closePath();
  },

  circlePath(ctx, x, y, r) {
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, TAU);
  },

  roundRectPath(ctx, x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  },

  // Fill + outline helpers -------------------------------------------------
  fillStroke(ctx, fill, lw = 4, stroke = INK) {
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (lw > 0) {
      ctx.lineWidth = lw;
      ctx.strokeStyle = stroke;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  },

  circle(ctx, x, y, r, fill, lw = 4, stroke = INK) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    Draw.fillStroke(ctx, fill, lw, stroke);
  },

  ellipse(ctx, x, y, rx, ry, rot, fill, lw = 4, stroke = INK) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot || 0, 0, TAU);
    Draw.fillStroke(ctx, fill, lw, stroke);
  },

  roundRect(ctx, x, y, w, h, r, fill, lw = 4, stroke = INK) {
    ctx.beginPath();
    Draw.roundRectPath(ctx, x, y, w, h, r);
    Draw.fillStroke(ctx, fill, lw, stroke);
  },

  // A polygon from a flat array [x0,y0,x1,y1,...]; optional rounded corners.
  poly(ctx, pts, fill, lw = 4, stroke = INK, close = true) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    if (close) ctx.closePath();
    Draw.fillStroke(ctx, fill, lw, stroke);
  },

  // Smooth closed blob through points using quadratic curves between midpoints.
  blobPath(ctx, pts) {
    const n = pts.length / 2;
    const mx = (i) => (pts[(i % n) * 2] + pts[((i + 1) % n) * 2]) / 2;
    const my = (i) => (pts[(i % n) * 2 + 1] + pts[((i + 1) % n) * 2 + 1]) / 2;
    ctx.moveTo(mx(0), my(0));
    for (let i = 1; i <= n; i++) {
      ctx.quadraticCurveTo(pts[(i % n) * 2], pts[(i % n) * 2 + 1], mx(i), my(i));
    }
    ctx.closePath();
  },
  blob(ctx, pts, fill, lw = 4, stroke = INK) {
    ctx.beginPath();
    Draw.blobPath(ctx, pts);
    Draw.fillStroke(ctx, fill, lw, stroke);
  },

  // Thick outlined line (outline pass + fill pass)
  line(ctx, x1, y1, x2, y2, w, color, lw = 4, stroke = INK) {
    ctx.lineCap = 'round';
    if (lw > 0 && !(typeof Sketch !== 'undefined' && Sketch.active)) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = w + lw * 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  },

  // Star polygon path
  starPath(ctx, x, y, r1, r2, n, rot = -Math.PI / 2) {
    for (let i = 0; i < n * 2; i++) {
      const r = i % 2 === 0 ? r1 : r2;
      const a = rot + (i * Math.PI) / n;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  },
  star(ctx, x, y, r1, r2, n, fill, lw = 3, stroke = INK, rot) {
    ctx.beginPath();
    Draw.starPath(ctx, x, y, r1, r2, n, rot);
    Draw.fillStroke(ctx, fill, lw, stroke);
  },

  heartPath(ctx, x, y, s) {
    ctx.moveTo(x, y + s * 0.35);
    ctx.bezierCurveTo(x - s * 0.1, y + s * 0.2, x - s * 0.55, y + s * 0.05, x - s * 0.5, y - s * 0.25);
    ctx.bezierCurveTo(x - s * 0.45, y - s * 0.55, x - s * 0.05, y - s * 0.55, x, y - s * 0.25);
    ctx.bezierCurveTo(x + s * 0.05, y - s * 0.55, x + s * 0.45, y - s * 0.55, x + s * 0.5, y - s * 0.25);
    ctx.bezierCurveTo(x + s * 0.55, y + s * 0.05, x + s * 0.1, y + s * 0.2, x, y + s * 0.35);
    ctx.closePath();
  },
  heart(ctx, x, y, s, fill, lw = 3, stroke = INK) {
    ctx.beginPath();
    Draw.heartPath(ctx, x, y, s);
    Draw.fillStroke(ctx, fill, lw, stroke);
  },

  // Spiky comic burst (irregular)
  burstPath(ctx, x, y, r1, r2, n, seed = 1, rot = 0) {
    for (let i = 0; i < n * 2; i++) {
      const jitter = 0.75 + U.hash(seed * 31 + i) * 0.5;
      const r = (i % 2 === 0 ? r1 : r2) * jitter;
      const a = rot + (i * Math.PI) / n;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  },

  // Chunky outlined text. opts: size, font, fill, stroke, lw, align, baseline,
  // shadow (color), sh (shadow offset), alpha, extrude (3D depth), extrudeColor
  text(ctx, str, x, y, opts = {}) {
    const size = opts.size || 32;
    const font = opts.font || FONT_DISPLAY;
    const weight = opts.weight || (font === FONT_UI ? 700 : 400);
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.textAlign = opts.align || 'center';
    ctx.textBaseline = opts.baseline || 'middle';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    const lw = opts.lw !== undefined ? opts.lw : Math.max(2, size * 0.14);
    const stroke = opts.stroke || INK;
    if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
    if (opts.extrude) {
      ctx.fillStyle = opts.extrudeColor || stroke;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      for (let i = opts.extrude; i > 0; i--) {
        if (lw > 0) ctx.strokeText(str, x, y + i);
        ctx.fillText(str, x, y + i);
      }
    }
    if (opts.shadow) {
      const sh = opts.sh || Math.max(2, size * 0.08);
      ctx.fillStyle = opts.shadow;
      ctx.strokeStyle = opts.shadow;
      ctx.lineWidth = lw;
      if (lw > 0) ctx.strokeText(str, x + sh, y + sh);
      ctx.fillText(str, x + sh, y + sh);
    }
    if (lw > 0) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = opts.fill || '#fff';
    ctx.fillText(str, x, y);
    if (opts.alpha !== undefined) ctx.globalAlpha = 1;
  },

  measure(ctx, str, size, font = FONT_DISPLAY, weight) {
    ctx.font = `${weight || (font === FONT_UI ? 700 : 400)} ${size}px ${font}`;
    return ctx.measureText(str).width;
  },

  // Word-wrap text into lines that fit maxW
  wrap(ctx, str, maxW, size, font = FONT_UI, weight = 600) {
    ctx.font = `${weight} ${size}px ${font}`;
    const words = str.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && cur) {
        lines.push(cur);
        cur = w;
      } else cur = t;
    }
    if (cur) lines.push(cur);
    return lines;
  },

  // Rotating sunburst rays
  sunburst(ctx, x, y, r, n, rot, c1, c2) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = c1;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.fillStyle = c2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, a, a + (TAU / n) * 0.5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  },

  // Puffy cartoon cloud
  cloud(ctx, x, y, s, fill = '#fff', lw = 0, stroke = INK, shadeCol) {
    const puffs = [
      [-0.55, 0.1, 0.38],
      [-0.2, -0.18, 0.48],
      [0.25, -0.12, 0.42],
      [0.6, 0.1, 0.33],
      [0.05, 0.15, 0.4],
    ];
    ctx.beginPath();
    for (const [px, py, pr] of puffs) Draw.circlePath(ctx, x + px * s, y + py * s, pr * s);
    if (lw > 0) {
      ctx.lineWidth = lw * 2;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
    ctx.fillStyle = fill;
    ctx.fill();
    if (shadeCol) {
      ctx.save();
      ctx.clip();
      ctx.fillStyle = shadeCol;
      ctx.beginPath();
      ctx.ellipse(x, y + s * 0.42, s * 1.1, s * 0.28, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  },

  // Keycap graphic for control screens
  keycap(ctx, label, x, y, w = 44, h = 44, accent = '#ffd23f') {
    Draw.roundRect(ctx, x - w / 2, y - h / 2 + 4, w, h, 9, U.shade(accent, -0.45), 3);
    Draw.roundRect(ctx, x - w / 2, y - h / 2, w, h - 2, 9, accent, 3);
    const size = label.length > 3 ? 14 : label.length > 1 ? 18 : 22;
    Draw.text(ctx, label, x, y - 1, { size, font: FONT_UI, fill: INK, lw: 0 });
  },
};
