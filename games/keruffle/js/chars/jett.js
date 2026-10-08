'use strict';
// ---------------------------------------------------------------------------
// JETT — the coolest kid on the block. Hood up, hands in his pockets, fights
// almost entirely with kicks and his skateboard. Rushdown: double jump, dive
// kick, board rush.
// ---------------------------------------------------------------------------
(() => {
  const POCKET = { hand: 'none', handB: 'none', fs: -8, fe: 86, bs: -14, be: 92 };

  // ---- hand-drawn detail --------------------------------------------------
  // Seams, stitching, ribbing, folds, laces... Ink lines go on paths of their
  // own (sketch.js drops a dark stroke that only outlines a shape just filled)
  // and are batched into a few strokes per part; tiny fills use a Path2D so
  // they get no brush marks of their own.

  // How much detail to draw here: 0 none (see-through afterimages, tiny or
  // slow devices), 1 lines, 2 lines and fine textures (stitching, ribbing,
  // treads). `unit`: local units per body unit (the head art is drawn bigger).
  function lod(ctx, unit = 1) {
    if (ctx.globalAlpha < 0.98) return 0;
    const m = ctx.getTransform();
    const px = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) / unit;
    const q = typeof Sketch !== 'undefined' ? Sketch.quality : 2;
    if (q < 1 || px < 0.45) return 0;
    return q < 2 || px < 0.95 ? 1 : 2;
  }

  // The super-freeze glow (shadowBlur) would blur every detail line: it is
  // off while they are inked, and pending ink is drawn before it comes back.
  function hush(ctx) {
    if (!ctx.shadowBlur) return null;
    const c = ctx.shadowColor;
    ctx.shadowColor = 'rgba(0,0,0,0)';
    return c;
  }
  function unhush(ctx, c) {
    ctx.beginPath();
    if (c !== null) ctx.shadowColor = c;
  }

  const _tints = new Map();
  function tint(c, to, t) {
    const key = c + to + t;
    let v = _tints.get(key);
    if (v === undefined) {
      if (_tints.size > 600) _tints.clear();
      v = U.mix(c, to, t);
      _tints.set(key, v);
    }
    return v;
  }
  const lumOf = (c) => (typeof Sketch !== 'undefined' ? Sketch.lum(c) : 0.5);
  // stitching thread on a cloth color: lighter on dark cloth, darker on pale
  const thread = (c, pal) => (lumOf(c) > 0.7 ? tint(c, pal.ink, 0.42) : tint(c, '#ffffff', 0.42));

  function inkStroke(ctx, pal, w) {
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
  function colStroke(ctx, col, w) {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
  const DASH = [2, 2], NO_DASH = [];
  function stitchStroke(ctx, col, w, on, off) {
    DASH[0] = on;
    DASH[1] = off;
    ctx.setLineDash(DASH);
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.lineCap = 'butt';
    ctx.stroke();
    ctx.setLineDash(NO_DASH);
  }

  // A frame along the segment a->b: `al` units along it and `ac` across it,
  // toward the light (front and above, as the brush marks in sketch.js).
  function seg(a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    const tx = dx / L, ty = dy / L;
    let nx = -ty, ny = tx;
    if (nx * 0.5 - ny * 0.86 < 0) {
      nx = -nx;
      ny = -ny;
    }
    return { ax: a[0], ay: a[1], tx, ty, nx, ny, L };
  }
  const sx = (S, al, ac) => S.ax + S.tx * al + S.nx * ac;
  const sy = (S, al, ac) => S.ay + S.ty * al + S.ny * ac;
  function M(ctx, S, al, ac) {
    ctx.moveTo(sx(S, al, ac), sy(S, al, ac));
  }
  function Ln(ctx, S, al, ac) {
    ctx.lineTo(sx(S, al, ac), sy(S, al, ac));
  }
  function Q(ctx, S, cal, cac, al, ac) {
    ctx.quadraticCurveTo(sx(S, cal, cac), sy(S, cal, cac), sx(S, al, ac), sy(S, al, ac));
  }

  // grip tape grit: fixed spots so it doesn't crawl
  const GRIT = [];
  for (let i = 0; i < 26; i++) GRIT.push(-41 + 82 * U.hash(i * 3.7 + 1), -4.3 + 1.9 * U.hash(i * 5.3 + 2));

  // skateboard drawn in local character space
  function drawBoard(ctx, pal, x, y, ang, lw) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang * D2R);
    const metal = tint(pal.ink, '#ffffff', 0.78);
    // wheels
    for (const wx of [-26, 26]) {
      Draw.roundRect(ctx, wx - 6, 2, 12, 6, 2, metal, lw * 0.7);
      Draw.circle(ctx, wx - 5, 10, 5.5, pal.wheel, lw * 0.7);
      Draw.circle(ctx, wx + 5, 10, 5.5, pal.wheel, lw * 0.7);
    }
    // deck
    ctx.beginPath();
    ctx.moveTo(-44, -6);
    ctx.quadraticCurveTo(-52, -8, -50, -12);
    ctx.lineTo(-40, -3);
    ctx.lineTo(40, -3);
    ctx.lineTo(50, -12);
    ctx.quadraticCurveTo(52, -8, 44, 3);
    ctx.lineTo(-44, 3);
    ctx.closePath();
    Draw.fillStroke(ctx, pal.deck, lw);
    ctx.fillStyle = pal.deckArt;
    ctx.fillRect(-30, -1, 60, 3.5);
    ctx.fillStyle = INK;
    ctx.fillRect(-42, -4.5, 84, 2.5);
    const lv = lod(ctx);
    if (lv) boardDetail(ctx, pal, lv);
    ctx.restore();
  }

  function boardDetail(ctx, pal, lv) {
    const g = hush(ctx);
    // wheel hubs, then bearings and the deck bolts
    const hub = new Path2D(), dot = new Path2D(), bolt = new Path2D();
    for (const wx of [-31, -21, 21, 31]) {
      hub.moveTo(wx + 2.6, 10);
      hub.arc(wx, 10, 2.6, 0, TAU);
      dot.moveTo(wx + 1, 10);
      dot.arc(wx, 10, 1, 0, TAU);
    }
    for (const bx of [-29.5, -22.5, 22.5, 29.5]) {
      bolt.moveTo(bx + 0.8, -3.25);
      bolt.arc(bx, -3.25, 0.8, 0, TAU);
    }
    ctx.fillStyle = tint(pal.wheel, '#ffffff', 0.5);
    ctx.fill(hub);
    ctx.fillStyle = pal.ink;
    ctx.fill(dot);
    ctx.fillStyle = tint(pal.ink, '#ffffff', 0.62);
    ctx.fill(bolt);
    if (lv > 1) {
      const grit = new Path2D();
      for (let i = 0; i < GRIT.length; i += 2) grit.rect(GRIT[i], GRIT[i + 1], 0.6, 0.5);
      ctx.fillStyle = tint(pal.ink, '#ffffff', 0.32);
      ctx.fill(grit);
    }
    // grip tape up the kicks, wheel tread, the graphic and the baseplates
    ctx.beginPath();
    ctx.moveTo(-41, -3.6);
    ctx.lineTo(-48.6, -10.6);
    ctx.moveTo(41, -3.6);
    ctx.lineTo(48.6, -10.6);
    inkStroke(ctx, pal, 2);
    ctx.beginPath();
    for (const wx of [-31, -21, 21, 31]) {
      ctx.moveTo(wx - 3.2, 13.4);
      ctx.quadraticCurveTo(wx, 15, wx + 3.2, 13.4);
    }
    for (const wx of [-26, 26]) {
      ctx.moveTo(wx - 5, 3.4);
      ctx.lineTo(wx + 5, 3.4);
    }
    // a zigzag bolt on the deck's side
    ctx.moveTo(-9, 1.6);
    ctx.lineTo(-3, -0.2);
    ctx.lineTo(-1, 1.9);
    ctx.lineTo(4.5, -0.1);
    ctx.lineTo(2.6, 1.9);
    ctx.lineTo(9, 0.4);
    // ply line along the side
    ctx.moveTo(-43, 1.4);
    ctx.lineTo(-33, 1.4);
    ctx.moveTo(33, 1.4);
    ctx.lineTo(43, 1.4);
    inkStroke(ctx, pal, 0.9);
    unhush(ctx, g);
  }

  // the kangaroo pocket; `hands`: local points of fists inside it ([x, y, ...])
  const FIST = [0, 0];
  function pocket(ctx, pal, lw, lv = 0, hands = null) {
    ctx.beginPath();
    ctx.moveTo(-1, -5);
    ctx.lineTo(27, -5);
    ctx.quadraticCurveTo(24, -16, 25, -27);
    ctx.lineTo(6, -27);
    ctx.quadraticCurveTo(-2, -18, -1, -5);
    ctx.closePath();
    Draw.fillStroke(ctx, pal.hoodL, lw * 0.8, pal.ink);
    ctx.beginPath();
    ctx.moveTo(25, -26);
    ctx.quadraticCurveTo(22, -16, 26, -6);
    ctx.lineWidth = lw * 1.1;
    ctx.strokeStyle = pal.ink;
    ctx.stroke();
    if (!lv) return;
    const g = hush(ctx);
    ctx.beginPath();
    // bar tacks at the corners of the openings
    ctx.moveTo(22.6, -26.6);
    ctx.lineTo(26.2, -25.9);
    ctx.moveTo(23.8, -6.6);
    ctx.lineTo(27.4, -6);
    ctx.moveTo(5.4, -26.4);
    ctx.lineTo(8.6, -25.4);
    // the back opening's edge
    ctx.moveTo(6.4, -25.6);
    ctx.quadraticCurveTo(0.4, -17.5, 0.6, -8);
    // fists pushing the pocket out: knuckles and the strain folds around them
    if (hands) {
      for (let i = 0; i < hands.length; i += 2) {
        const hx = U.clamp(hands[i], 5, 19), hy = U.clamp(hands[i + 1], -21, -11);
        ctx.moveTo(hx + 3.4, hy - 5.4);
        ctx.quadraticCurveTo(hx + 7.4, hy - 3.2, hx + 6.2, hy + 1.2);
        ctx.quadraticCurveTo(hx + 7.2, hy + 4.4, hx + 3.6, hy + 6);
        ctx.moveTo(hx - 3.6, hy - 6.6);
        ctx.quadraticCurveTo(hx + 0.4, hy - 8.4, hx + 4.8, hy - 7.4);
        ctx.moveTo(hx + 8.6, hy - 1.4);
        ctx.lineTo(hx + 11.4, hy - 2.6);
      }
    } else {
      ctx.moveTo(4, -15);
      ctx.quadraticCurveTo(9, -13.4, 12.6, -16.6);
    }
    inkStroke(ctx, pal, 1.1);
    if (lv > 1) {
      ctx.beginPath();
      ctx.moveTo(7.8, -25.1);
      ctx.lineTo(23, -25.1);
      ctx.moveTo(1.4, -6.9);
      ctx.lineTo(24.6, -6.9);
      ctx.moveTo(22.9, -24.4);
      ctx.quadraticCurveTo(20, -16, 23.9, -7.8);
      ctx.moveTo(8.4, -24.6);
      ctx.quadraticCurveTo(2.6, -17.4, 2.8, -8);
      stitchStroke(ctx, thread(pal.hoodL, pal), 0.75, 1.5, 1.3);
    }
    unhush(ctx, g);
  }

  // The hoodie body: side seam, folds, a quarter zip, the hem's ribbing and
  // all the stitching (torso space, before the drawstrings and headphones).
  function hoodieDetail(ctx, pal, T, lv) {
    const g = hush(ctx);
    ctx.beginPath();
    // side seam running down behind the arm
    ctx.moveTo(-11.5, -T + 12);
    ctx.quadraticCurveTo(-16.5, -22, -13.6, 1);
    // folds under the arm
    ctx.moveTo(-8.4, -T + 17);
    ctx.quadraticCurveTo(-13.6, -T + 20.5, -19.5, -T + 19.4);
    ctx.moveTo(-9.6, -T + 23);
    ctx.quadraticCurveTo(-13.4, -T + 26, -17.6, -T + 26.4);
    // the body blousing over the hem
    for (const x of [-20, -8.5, 6.5, 18.5]) {
      ctx.moveTo(x, 1.6);
      ctx.quadraticCurveTo(x + 2.6, -1.4, x + 1.2, -4.6);
    }
    // the hood bunched at the back of the neck
    ctx.moveTo(-21.5, -T + 3.6);
    ctx.quadraticCurveTo(-14.5, -T + 0.4, -8.6, -T + 5.4);
    ctx.moveTo(-22.4, -T + 9.4);
    ctx.quadraticCurveTo(-18.4, -T + 7.4, -14.6, -T + 9.6);
    // quarter zip down the chest
    ctx.moveTo(17.3, -T - 1.6);
    ctx.lineTo(16.9, -T + 17.5);
    // chest folds pulled toward the pocket
    ctx.moveTo(25.6, -T + 21);
    ctx.quadraticCurveTo(22, -T + 23.5, 19.4, -T + 22);
    inkStroke(ctx, pal, 1.25);
    if (lv > 1) {
      // zip teeth and the hem's ribbing
      ctx.beginPath();
      for (let y = -T + 0.4; y < -T + 16.6; y += 1.65) {
        ctx.moveTo(15.9, y);
        ctx.lineTo(18.4, y + 0.5);
      }
      for (let x = -22.4; x < 27.5; x += 3.1) {
        ctx.moveTo(x, 4.2);
        ctx.lineTo(x + 0.3, 10.1);
      }
      inkStroke(ctx, pal, 0.7);
      // stitching
      ctx.beginPath();
      ctx.moveTo(-9.4, -T + 13);
      ctx.quadraticCurveTo(-14.2, -22, -11.4, 0.6);
      ctx.moveTo(-22.6, 0.4);
      ctx.lineTo(27.2, 0.4);
      ctx.moveTo(-23.4, -T + 6.6);
      ctx.quadraticCurveTo(-26.8, -24, -23.6, -1.6);
      stitchStroke(ctx, thread(pal.hood, pal), 0.75, 1.6, 1.4);
    }
    // the zip's pull tab
    const tab = new Path2D();
    Draw.roundRectPath(tab, 15.7, -T + 0.2, 3, 5.6, 1.3);
    ctx.fillStyle = pal.string;
    ctx.fill(tab);
    ctx.beginPath();
    ctx.moveTo(16.4, -T + 4);
    ctx.lineTo(17.9, -T + 4);
    ctx.moveTo(17.2, -T - 0.4);
    ctx.lineTo(17.2, -T + 0.9);
    inkStroke(ctx, pal, 0.9);
    unhush(ctx, g);
  }

  // headphones around the neck: the cable into the pocket, cushion, logo,
  // band shine; eyelets for the drawstrings
  function phonesDetail(ctx, pal, T, lv) {
    const g = hush(ctx);
    ctx.beginPath();
    ctx.moveTo(9 + 18 * Math.cos(0.62), -T + 1 + 7 * Math.sin(0.62) - 1.2);
    ctx.ellipse(9, -T + 1 - 1.2, 18, 7, 0, 0.62, Math.PI - 0.55);
    colStroke(ctx, tint(pal.phones, '#ffffff', 0.55), 1);
    ctx.beginPath();
    ctx.moveTo(29.4, -T + 10.6);
    ctx.bezierCurveTo(31.2, -T + 17, 25.2, -T + 20.5, 26.4, -T + 28);
    ctx.moveTo(22.9, -T - 2.4);
    ctx.lineTo(22.9, -T + 9.2);
    ctx.moveTo(28.4, -T + 3.5);
    ctx.arc(26.5, -T + 3.5, 1.9, 0, TAU);
    ctx.moveTo(25.6, -T + 4.4);
    ctx.lineTo(27.4, -T + 2.6);
    // drawstring eyelets
    for (const x of [13, 21]) {
      ctx.moveTo(x + 1.6, -T + 2);
      ctx.arc(x, -T + 2, 1.6, 0, TAU);
    }
    inkStroke(ctx, pal, lv > 1 ? 0.9 : 1.1);
    unhush(ctx, g);
  }

  // ---- head details (head art units) ----
  // the hood: its panel seam and stitching
  function hoodDetail(ctx, pal, lv) {
    const g = hush(ctx);
    ctx.beginPath();
    ctx.moveTo(12, -33.2);
    ctx.quadraticCurveTo(-11, -34.6, -23.6, -22.6);
    ctx.quadraticCurveTo(-31.6, -10, -31, 6);
    ctx.quadraticCurveTo(-30.4, 20, -21.6, 29.6);
    // gathers where the hood meets the neck
    ctx.moveTo(-17.4, 33.4);
    ctx.quadraticCurveTo(-13, 30.8, -11.6, 34.6);
    ctx.moveTo(-28.4, 18);
    ctx.quadraticCurveTo(-33, 21, -35, 16.6);
    inkStroke(ctx, pal, 1.9);
    if (lv > 1) {
      ctx.beginPath();
      ctx.moveTo(-12.6, -33.6);
      ctx.quadraticCurveTo(-24, -29.6, -29.8, -18);
      ctx.quadraticCurveTo(-35, -6, -34.2, 8);
      ctx.quadraticCurveTo(-33.4, 19.6, -26.4, 28.4);
      stitchStroke(ctx, thread(pal.hood, pal), 1.2, 2.4, 2);
    }
    unhush(ctx, g);
  }

  // the hood's rim: the lining edge, creases and the drawcord channel's stitching
  function rimDetail(ctx, pal, lv) {
    const g = hush(ctx);
    const E = (rx, ry, a0, a1) => {
      ctx.moveTo(6 + rx * Math.cos(a0), 4 + ry * Math.sin(a0));
      ctx.ellipse(6, 4, rx, ry, 0, a0, a1);
    };
    ctx.beginPath();
    E(23.1, 25.6, 2.42, 2.95);
    E(23.1, 25.6, 3.2, 3.9);
    for (const a of [2.5, 2.72, 3.05]) {
      const c = Math.cos(a), s = Math.sin(a);
      ctx.moveTo(6 + 23.6 * c, 4 + 26.1 * s);
      ctx.quadraticCurveTo(6 + 27.5 * Math.cos(a + 0.05), 4 + 30 * Math.sin(a + 0.05), 6 + 30.6 * c, 4 + 33 * s);
    }
    inkStroke(ctx, pal, 1.7);
    if (lv > 1) {
      ctx.beginPath();
      E(29.6, 32.1, 2.38, 5.05);
      stitchStroke(ctx, thread(pal.hoodL, pal), 1.15, 2.4, 2);
    }
    unhush(ctx, g);
  }

  // hair: strand lines in the bangs and a couple of loose strands
  function hairDetail(ctx, pal) {
    const g = hush(ctx);
    const s = new Path2D();
    s.moveTo(17.4, -21.4);
    s.quadraticCurveTo(25, -28.4, 31.4, -27.6);
    s.quadraticCurveTo(25.6, -24.6, 21.6, -17.6);
    s.closePath();
    s.moveTo(-0.6, -19.4);
    s.quadraticCurveTo(3.2, -12.6, 1, -5.4);
    s.quadraticCurveTo(5.8, -11.6, 3.6, -19.8);
    s.closePath();
    ctx.fillStyle = pal.hair;
    ctx.fill(s);
    ctx.beginPath();
    ctx.moveTo(-9.4, -24.6);
    ctx.quadraticCurveTo(-8.6, -17, -6.8, -11.4);
    ctx.moveTo(4.2, -28);
    ctx.quadraticCurveTo(6.6, -18, 8.4, -9.4);
    ctx.moveTo(16.8, -27.2);
    ctx.quadraticCurveTo(19.6, -18.4, 22, -11.8);
    ctx.moveTo(-3.2, -26.6);
    ctx.quadraticCurveTo(-2.2, -23.4, -0.8, -21.6);
    ctx.moveTo(10.4, -28.6);
    ctx.quadraticCurveTo(11.6, -25.2, 12.4, -22);
    ctx.moveTo(21.4, -19.6);
    ctx.quadraticCurveTo(25.6, -24.8, 30, -26.8);
    ctx.moveTo(2.6, -16.6);
    ctx.quadraticCurveTo(3.8, -11.8, 2.2, -7.6);
    inkStroke(ctx, pal, 1.5);
    unhush(ctx, g);
  }

  // brows, lashes, lower lids, lip and chin
  const LIDS = [];
  function faceDetail(ctx, pal, face, lv) {
    const g = hush(ctx);
    ctx.beginPath();
    for (let i = 0; i < LIDS.length; i += 3) {
      const x = LIDS[i], y = LIDS[i + 1], d = LIDS[i + 2];
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + d * 2.2, y - 0.3, x + d * 3.6, y - 2.8);
      ctx.moveTo(x - d * 0.6, y + 0.2);
      ctx.lineTo(x + d * 2.4, y + 1.6);
    }
    const open = LIDS.length > 0;
    if (open) {
      // the tired, cool under-eye lines
      ctx.moveTo(-3.2, 15.6);
      ctx.quadraticCurveTo(1.6, 17.4, 6.2, 15.4);
      ctx.moveTo(16.6, 14.6);
      ctx.quadraticCurveTo(19, 15.8, 21.4, 14.8);
    }
    if (face === 'normal' || face === 'happy') {
      const up = face === 'happy' ? 2.2 : 0;
      ctx.moveTo(-5.2, -1.4 - up);
      ctx.quadraticCurveTo(0.6, -4.6 - up, 6.8, -3.4 - up);
      ctx.moveTo(15.4, -3.2 - up);
      ctx.quadraticCurveTo(20.6, -4.6 - up, 25, -2 - up);
    } else if (face === 'sad') {
      ctx.moveTo(-5, -1.2);
      ctx.quadraticCurveTo(1.4, -2.6, 6.6, -5.6);
      ctx.moveTo(15.2, -5.4);
      ctx.quadraticCurveTo(20, -2.8, 25, -1.6);
    } else if (face === 'hurt' || face === 'ko') {
      ctx.moveTo(-5, -4.6);
      ctx.quadraticCurveTo(1, -2.6, 6.4, -1.2);
      ctx.moveTo(15.4, -1.2);
      ctx.quadraticCurveTo(20.4, -2.6, 25, -4.8);
    }
    // chin, and the nostril
    ctx.moveTo(11.4, 29.2);
    ctx.quadraticCurveTo(15.4, 30.6, 19, 28.6);
    ctx.moveTo(26.4, 12.4);
    ctx.quadraticCurveTo(25, 11.8, 24.6, 12.8);
    inkStroke(ctx, pal, 1.8);
    unhush(ctx, g);
  }

  // ---- limbs (character space) ----
  // hoodie sleeve: raglan seam, the sleeve bunched over the cuff, rib knit
  function sleeveDetail(ctx, pal, pc, s, e, h, R, back, lv) {
    const g = hush(ctx);
    const A = seg(s, e), B = seg(e, h);
    const rc = R[1] + (R[2] - R[1]) * 0.78 + 0.6;
    ctx.beginPath();
    M(ctx, A, -R[0] * 0.2, R[0] * 0.92);
    Q(ctx, A, A.L * 0.22, R[0] * 0.2, A.L * 0.44, -R[0] * 0.95);
    M(ctx, B, B.L * 0.7, R[2] * 1.02);
    Q(ctx, B, B.L * 0.63, R[2] * 0.4, B.L * 0.7, -R[2] * 0.15);
    M(ctx, B, B.L * 0.5, -R[1] * 0.9);
    Q(ctx, B, B.L * 0.56, -R[1] * 0.2, B.L * 0.5, R[1] * 0.35);
    // the cuff's seam
    M(ctx, B, B.L * 0.78, -rc * 0.95);
    Q(ctx, B, B.L * 0.78 + 1.6, 0, B.L * 0.78, rc * 0.95);
    if (lv > 1) {
      for (const k of [-0.62, -0.22, 0.2, 0.6]) {
        M(ctx, B, B.L * 0.82, rc * k);
        Ln(ctx, B, B.L * 0.97, rc * k * 0.95);
      }
    }
    inkStroke(ctx, pal, back ? 1 : 1.15);
    if (lv > 1 && !back) {
      ctx.beginPath();
      M(ctx, A, -R[0] * 0.2 + 2, R[0] * 0.92);
      Q(ctx, A, A.L * 0.22 + 2.2, R[0] * 0.2, A.L * 0.44 + 2.2, -R[0] * 0.95);
      stitchStroke(ctx, thread(pc.hood, pal), 0.75, 1.5, 1.3);
    }
    unhush(ctx, g);
  }

  // jeans: the outseam and its contrast double stitching, hem stacking over
  // the sneakers; the front leg is ripped at the knee and worn on the thigh
  function jeansDetail(ctx, pal, pc, hp, k, a, R, back, lv) {
    const g = hush(ctx);
    const A = seg(hp, k), B = seg(k, a);
    ctx.beginPath();
    M(ctx, A, A.L * 0.2, R[0] * 0.08);
    Ln(ctx, A, A.L * 0.86, R[1] * 0.08);
    M(ctx, B, B.L * 0.3, R[1] * 0.08);
    Ln(ctx, B, B.L * 0.56, R[2] * 0.08);
    // stacked hem above the shoe
    M(ctx, B, B.L * 0.58, -R[2] * 1.02);
    Q(ctx, B, B.L * 0.65, -R[2] * 0.2, B.L * 0.59, R[2] * 0.55);
    M(ctx, B, B.L * 0.7, R[2] * 1.02);
    Q(ctx, B, B.L * 0.77, R[2] * 0.25, B.L * 0.7, -R[2] * 0.5);
    inkStroke(ctx, pal, back ? 1 : 1.15);
    if (lv > 1) {
      ctx.beginPath();
      M(ctx, A, A.L * 0.2, R[0] * 0.08 + 2);
      Ln(ctx, A, A.L * 0.86, R[1] * 0.08 + 2);
      M(ctx, B, B.L * 0.3, R[1] * 0.08 + 2);
      Ln(ctx, B, B.L * 0.56, R[2] * 0.08 + 2);
      stitchStroke(ctx, pc.sole, 0.8, 1.6, 1.4);
    }
    if (!back) {
      // the knee rip: a hole with threads across it and frayed edges
      const al = B.L * 0.15, ac = R[1] * 0.2;
      const cx = sx(B, al, ac), cy = sy(B, al, ac);
      Draw.ellipse(ctx, cx, cy, 3.5, 5.4, Math.atan2(a[1] - k[1], a[0] - k[0]), pal.skin, 0);
      ctx.beginPath();
      for (const d of [-1.5, 0.4, 2]) {
        M(ctx, B, al + d, ac - 5.6);
        Q(ctx, B, al + d + 1.1, ac, al + d - 0.2, ac + 5.6);
      }
      // worn whiskers on the thigh
      for (const [t, w] of [[0.36, 0.9], [0.47, 0.7], [0.58, 0.5]]) {
        M(ctx, A, A.L * t, R[0] * 0.82);
        Q(ctx, A, A.L * (t + 0.03), R[0] * (0.82 - w * 0.4), A.L * (t + 0.1), R[0] * (0.8 - w));
      }
      colStroke(ctx, tint(pc.pantsL, '#ffffff', 0.6), 0.9);
      ctx.beginPath();
      for (const side of [-1, 1]) {
        M(ctx, B, al + side * 3.4, ac - 5.2);
        for (let i = 1; i <= 5; i++) Ln(ctx, B, al + side * (3.4 + (i % 2 ? 1.3 : -0.1)), ac - 5.2 + i * 2.08);
      }
      inkStroke(ctx, pal, 1);
    }
    unhush(ctx, g);
  }

  // sneaker (foot space): toe cap, heel counter, collar, midsole, tread,
  // laces, a pull tab and stitching
  function sneakerDetail(ctx, pal, col, L, lv) {
    const g = hush(ctx);
    ctx.beginPath();
    ctx.moveTo(L + 0.6, -5.4);
    ctx.quadraticCurveTo(L - 3.6, -0.8, L - 1.2, 4);
    ctx.moveTo(-9.8, -2.4);
    ctx.quadraticCurveTo(-4.4, -2.6, -3.4, 4);
    ctx.moveTo(-7.4, -5.6);
    ctx.quadraticCurveTo(-2, -3.6, 3.6, -5.6);
    ctx.moveTo(-8.6, 6.75);
    ctx.lineTo(L + 6.8, 6.75);
    if (lv > 1) {
      for (let x = -7; x < L + 6; x += 2.7) {
        ctx.moveTo(x, 7.7);
        ctx.lineTo(x - 0.7, 9.3);
      }
    }
    inkStroke(ctx, pal, 1);
    // laces and the bow
    ctx.beginPath();
    for (const x of [8.4, 11.4]) {
      ctx.moveTo(x, -6.6);
      ctx.lineTo(x + 2.6, -3.6);
      ctx.moveTo(x + 2.6, -6.8);
      ctx.lineTo(x, -3.8);
    }
    ctx.moveTo(9.4, -6.8);
    ctx.quadraticCurveTo(6, -10.6, 9.8, -10.2);
    ctx.quadraticCurveTo(11, -9.2, 9.6, -6.8);
    ctx.quadraticCurveTo(10.6, -10.8, 13.6, -9.4);
    const lc = Math.abs(lumOf(pal.string) - lumOf(col)) > 0.3 ? pal.string : pal.ink;
    if (lc === pal.ink) inkStroke(ctx, pal, 1);
    else colStroke(ctx, lc, 1.1);
    // heel pull tab
    ctx.beginPath();
    ctx.moveTo(-8.2, -6.6);
    ctx.lineTo(-10.2, -10.4);
    colStroke(ctx, pal.sole, 2.6);
    if (lv > 1) {
      ctx.beginPath();
      ctx.moveTo(-8.2, 2.5);
      ctx.lineTo(L + 5.8, 2.5);
      ctx.moveTo(L - 1, -5.7);
      ctx.quadraticCurveTo(L - 5.4, -0.8, L - 3.2, 3.4);
      stitchStroke(ctx, thread(col, pal), 0.7, 1.2, 1.1);
    }
    unhush(ctx, g);
  }

  function eye(ctx, pal, x, y, rx, ry, face, blink, far) {
    const ink = pal.ink;
    if (face === 'hurt') {
      ctx.lineWidth = 3.2;
      ctx.strokeStyle = ink;
      ctx.beginPath();
      ctx.moveTo(x - rx, y - ry * 0.6);
      ctx.lineTo(x + rx * 0.8, y);
      ctx.lineTo(x - rx, y + ry * 0.6);
      ctx.stroke();
      return;
    }
    if (face === 'ko') {
      ctx.lineWidth = 3.2;
      ctx.strokeStyle = ink;
      ctx.beginPath();
      ctx.moveTo(x - rx, y - rx);
      ctx.lineTo(x + rx, y + rx);
      ctx.moveTo(x + rx, y - rx);
      ctx.lineTo(x - rx, y + rx);
      ctx.stroke();
      return;
    }
    if (face === 'happy' || blink) {
      ctx.lineWidth = 3.2;
      ctx.strokeStyle = ink;
      ctx.beginPath();
      if (face === 'happy') ctx.arc(x, y + 2, rx, Math.PI * 1.1, Math.PI * 1.9);
      else {
        ctx.moveTo(x - rx, y + 1);
        ctx.quadraticCurveTo(x, y + 4, x + rx, y + 1);
      }
      ctx.stroke();
      return;
    }
    Draw.ellipse(ctx, x, y, rx, ry, 0, '#ffffff', 2.6, ink);
    const px = x + rx * 0.3;
    Draw.ellipse(ctx, px, y + ry * 0.15, rx * 0.58, ry * 0.66, 0, pal.eye, 0);
    Draw.circle(ctx, px + rx * 0.2, y - ry * 0.15, rx * 0.22, '#ffffff', 0);
    // heavy lids: the cool half-lidded look
    const lid = face === 'angry' ? 0.25 : face === 'block' ? 0.35 : 0.5;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, y, rx + 1, ry + 1, 0, 0, TAU);
    ctx.clip();
    ctx.fillStyle = pal.skin;
    const ly = y - ry + ry * 2 * lid;
    const tilt = face === 'angry' ? (far ? 3 : -3) : far ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(x - rx - 2, y - ry - 4);
    ctx.lineTo(x + rx + 2, y - ry - 4);
    ctx.lineTo(x + rx + 2, ly - tilt);
    ctx.lineTo(x - rx - 2, ly + tilt);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = 3.4;
    ctx.strokeStyle = ink;
    ctx.beginPath();
    ctx.moveTo(x - rx - 1.5, ly + tilt);
    ctx.lineTo(x + rx + 1.5, ly - tilt);
    ctx.stroke();
    // the lid's outer corner, for the lashes (faceDetail)
    if (far) LIDS.push(x + rx + 1.5, ly - tilt, 1);
    else LIDS.push(x - rx - 1.5, ly + tilt, -1);
  }

  defineChar({
    id: 'jett',
    name: 'JETT',
    title: 'The Coolest Kid on the Block',
    style: 'RUSHDOWN',
    desc: 'Hood up, hands in pockets, never breaks a sweat. Kicks fast, double jumps and dive-kicks in from the sky.',
    color: '#7a5cff',
    sparkColor: '#7ff0dc',
    trailColor: '#7ff0dc',
    words: ['SMACK!', 'WHAM!', 'BAM!', 'SICK!'],
    wordColor: '#7ff0dc',
    ui: { power: 3, speed: 5, range: 3, difficulty: 3 },
    quotes: ['Too slow. Like, way too slow.', 'Was that supposed to hurt?', 'Hands in pockets. Still won.', 'Later, loser!'],
    stats: {
      hp: 950, walkF: 4.5, walkB: 3.5, jumpV: 17, jumpVx: 5.6, grav: 0.92, jsq: 3,
      airJumps: 1, airJumpMult: 0.82, flip: true,
      dash: { f: 16, v: 11, cancel: 6 }, bdash: { v: 8.5, vy: 6, inv: 5, lag: 6 },
      width: 52, height: 196, throwRange: 50, landLag: 3, downTime: 30, voicePitch: 1,
    },
    body: {
      torso: 54, neck: 5, headR: 33, shoulderDrop: 9, shoulderOfs: 2, hipOfs: 2,
      uArm: 26, fArm: 25, handR: 9,
      thigh: 34, shin: 34, footL: 17, footR: 7.8,
      armR: [9.8, 8.8, 8], legR: [11.5, 10, 8.4], torsoW: [46, 52],
    },
    armCols: ['hood', 'hood', 'skin'],
    legCols: ['pants', 'pants', 'shoe'],
    cuff: [0.78, 1.0, 'hoodL'],
    mono: [
      { main: '#4a86f7', accent: '#6ff2d6' },
      { main: '#f2545b', accent: '#ffd23f' },
      { main: '#eceaf6', accent: '#ff7ab6' },
    ],
    monoKeys: { main: 'hood', accentMain: 'hair', accent: ['hair', 'string', 'sole', 'phones', 'wheel', 'gum', 'deck', 'deckArt'] },
    palettes: [
      { hood: '#3f3866', hoodL: '#5c5294', string: '#f3f1ff', skin: '#f7c9a3', hair: '#7ff0dc', eye: '#2a2340',
        pants: '#2f4f86', pantsL: '#4a6fae', shoe: '#f7f7fb', sole: '#ff4f6e', phones: '#ff5577', deck: '#ff8a3d', deckArt: '#ffd23f', wheel: '#7ff0dc', gum: '#ff8cc6' },
      { hood: '#c4313f', hoodL: '#e45562', string: '#ffe7a8', skin: '#e9b48e', hair: '#2b2236', eye: '#2a2340',
        pants: '#2b2b33', pantsL: '#444452', shoe: '#2a2a33', sole: '#ffcf3f', phones: '#ffcf3f', deck: '#2b2236', deckArt: '#ff5577', wheel: '#ffcf3f', gum: '#7fe3ff' },
      { hood: '#eef0f7', hoodL: '#ffffff', string: '#7ff0dc', skin: '#ffd9bb', hair: '#ffa3cf', eye: '#3a2a50',
        pants: '#7a8bb8', pantsL: '#95a5d0', shoe: '#3a3550', sole: '#7ff0dc', phones: '#7ff0dc', deck: '#7ff0dc', deckArt: '#ffffff', wheel: '#ff8cc6', gum: '#ffd23f' },
    ],
    walk: { A: 10, H: 9, bob: 2.5, sway: 1.5, arm: 0 },
    ai: {
      pref: [90, 200], aggression: 0.8, jumpiness: 0.45, zoning: 0,
      combos: [['2L', '5L', '5H', '6S'], ['5L', '5H', '6S'], ['5H', '6S'], ['2L', '2H'], ['jH', '5H', '6S'], ['jL', '5L', '5H'], ['5L', '2L', '2S']],
      antiAir: ['5S'], punish: ['5H', '6S'], enders: ['6S', '2S'],
    },
    idlePeriod: 80,

    poses: {
      stance: { t: -2, hd: 4, ...POCKET, lf: [22, 0], lb: [-20, 0], d: 5 },
      stance2: { $: 'stance', d: 7, hd: 6, t: -1 },
      walkBase: { $: 'stance', t: 2, hd: 2 },
      crouch: { t: 22, hd: -14, ...POCKET, fs: 4, fe: 80, bs: -2, be: 84, lf: [26, 0], lb: [-22, 0], d: 34 },
      crouch2: { $: 'crouch', d: 36 },
      squat: { t: 16, hd: -10, ...POCKET, lf: [22, 0], lb: [-20, 0], d: 24 },
      jump: { t: 2, hd: -4, ...POCKET, fh: 70, fk: 100, bh: 20, bk: 80 },
      fall: { t: 0, hd: 2, ...POCKET, fh: 30, fk: 40, bh: -8, bk: 30 },
      tuck: { t: 20, hd: 10, ...POCKET, fh: 110, fk: 145, bh: 95, bk: 140 },
      block: { t: -10, hd: 10, ...POCKET, fh: 72, fk: 112, lb: [-20, 0], d: 4, face: 'block' },
      cblock: { t: 10, hd: 6, fs: 70, fe: 120, bs: 55, be: 125, lf: [24, 0], lb: [-24, 0], d: 36, face: 'block' },
      dash1: { t: 24, hd: -16, ...POCKET, lf: [42, 0], lb: [-30, 10], d: 12 },
      dash2: { t: 18, hd: -12, ...POCKET, lf: [10, 8], lb: [-22, 0], d: 10 },
      bdash: { t: -16, hd: 10, ...POCKET, fh: 40, fk: 60, bh: -8, bk: 30 },
      // normals
      '5L_a': { t: -6, hd: 4, ...POCKET, fh: 78, fk: 100, lb: [-20, 0], d: 4 },
      '5L_b': { t: -14, hd: 8, x: 8, ...POCKET, fh: 88, fk: 3, fa: -10, lb: [-22, 0], d: 6 },
      '2L_a': { t: 18, hd: -12, ...POCKET, fh: 60, fk: 70, lb: [-22, 0], d: 36 },
      '2L_b': { t: 10, hd: -8, ...POCKET, fh: 80, fk: 0, fa: -15, lb: [-26, 0], d: 38 },
      '5H_a': { t: -8, hd: 6, ...POCKET, fh: 96, fk: 120, lb: [-16, 0], d: 4 },
      '5H_b': { t: -18, hd: 10, ...POCKET, fh: 120, fk: 70, lb: [-20, 0], d: 6 },
      '5H_c': { t: -32, hd: 14, x: 16, ...POCKET, fh: 116, fk: 4, fa: 10, lb: [-20, 0], d: 9 },
      '2H_a': { t: 28, hd: -10, ...POCKET, fh: 40, fk: 70, lb: [-14, 0], d: 42 },
      '2H_b': { t: 34, hd: -14, ...POCKET, fh: 86, fk: 0, fa: -10, lb: [-14, 0], d: 46 },
      '6H_a': { t: -12, hd: 6, ...POCKET, fh: 120, fk: 30, lb: [-16, 0], d: 0 },
      '6H_b': { t: -22, hd: 14, ...POCKET, fh: 168, fk: 0, lb: [-14, 0], d: 0 },
      '6H_c': { t: 24, hd: -10, ...POCKET, fh: 72, fk: 0, fa: -20, lb: [-18, 0], d: 18 },
      '6H_d': { t: 14, hd: -6, ...POCKET, lf: [44, 0], lb: [-18, 0], d: 18 },
      jL_a: { t: 6, hd: -2, ...POCKET, fh: 100, fk: 140, bh: 10, bk: 70 },
      jL_b: { t: 10, hd: -4, ...POCKET, fh: 108, fk: 150, bh: 0, bk: 60 },
      jH_a: { t: -2, hd: 4, ...POCKET, fh: 100, fk: 110, bh: 10, bk: 90 },
      jH_b: { t: -18, hd: 8, ...POCKET, fh: 58, fk: 0, fa: 10, bh: 0, bk: 110 },
      dive: { t: -24, hd: 12, ...POCKET, fh: 38, fk: 0, fa: 15, bh: -6, bk: 110 },
      // board specials
      flipA: { t: 14, hd: -8, ...POCKET, lf: [20, 0], lb: [-20, 0], d: 20, prop: 'board', p1: 0, p2: 30, p3: -8 },
      flipB: { t: -18, hd: 2, ...POCKET, fh: 112, fk: 10, lb: [-16, 0], d: 6, prop: 'board', p1: -60, p2: 58, p3: -70 },
      flipC: { t: -22, hd: -6, ...POCKET, fh: 60, fk: 40, lb: [-16, 0], d: 4, prop: 'board', p1: -400, p2: 62, p3: -190 },
      flipD: { t: -8, hd: -10, ...POCKET, lf: [18, 0], lb: [-20, 0], d: 8, prop: 'board', p1: -700, p2: 50, p3: -150 },
      flipE: { t: 10, hd: 2, fs: 70, fe: 30, ...{ hand: 'open', handB: 'none', bs: -14, be: 92 }, lf: [20, 0], lb: [-20, 0], d: 14, prop: 'board', p1: -720, p2: 36, p3: -60 },
      ride: { t: 12, hd: -6, ...POCKET, lf: [16, 13], lb: [-20, 13], d: 20, prop: 'board', p1: 0, p2: -2, p3: -8 },
      rideLean: { t: 22, hd: -12, ...POCKET, lf: [18, 13], lb: [-20, 13], d: 26, prop: 'board', p1: 0, p2: -2, p3: -8 },
      hopOff: { t: 6, hd: 0, ...POCKET, fh: 50, fk: 70, bh: 0, bk: 60, prop: 'board', p1: -10, p2: 10, p3: -2, y: -16 },
      slide: { r: -58, t: 0, hd: -24, ...POCKET, fh: 34, fk: 0, fa: -15, bh: 6, bk: 80 },
      // throw
      thrA: { t: 14, hd: -4, fs: 80, fe: 20, bs: -14, be: 92, hand: 'fist', handB: 'none', lf: [26, 0], lb: [-24, 0], d: 10 },
      thrB: { t: 4, hd: -2, fs: 70, fe: 30, bs: -14, be: 92, hand: 'fist', handB: 'none', fh: 95, fk: 120, lb: [-20, 0], d: 4 },
      thrC: { t: -6, hd: 0, fs: 60, fe: 40, bs: -14, be: 92, hand: 'fist', handB: 'none', fh: 100, fk: 40, lb: [-18, 0], d: 6 },
      thrD: { t: -26, hd: 10, ...POCKET, fh: 115, fk: 5, lb: [-24, 0], d: 8 },
      // victory / intro
      win: { t: -8, hd: -12, fs: 120, fe: 40, hand: 'point', bs: -14, be: 92, handB: 'none', lf: [16, 0], lb: [-18, 0], d: 2, face: 'happy' },
      win2: { $: 'win', fs: 112, fe: 50, hd: -8, d: 4, face: 'normal' },
      intro1: { $: 'stance', hd: 18, t: -6 },
      lose: { t: 20, hd: 26, ...POCKET, lf: [12, 0], lb: [-12, 0], d: 6, face: 'sad' },
      // super
      supKickA: { t: -20, hd: 10, ...POCKET, fh: 110, fk: 5, bh: 0, bk: 90 },
      supKickB: { t: 10, hd: 0, ...POCKET, fh: 60, fk: 120, bh: 100, bk: 0, fa: 0, ba: 10 },
      supSpin: { t: 10, hd: 10, ...POCKET, fh: 100, fk: 140, bh: 90, bk: 140, prop: 'board', p1: 0, p2: 0, p3: 6 },
      supSlam: { t: 10, hd: -10, ...POCKET, fh: 20, fk: 30, bh: -10, bk: 30, prop: 'board', p1: 0, p2: 0, p3: 6 },
    },

    anims: {
      intro: { keys: [[0, 'intro1'], [30, 'intro1'], [50, 'stance'], [96, 'stance']] },
      win: { keys: [[0, 'stance'], [10, 'win'], [40, 'win2'], [70, 'win']] },
    },

    moves: {
      '5L': {
        name: 'Snap Kick',
        anim: { keys: [[0, 'stance'], [3, '5L_a', 'out'], [5, '5L_b', 'snap'], [8, '5L_b'], [12, '5L_a'], [16, 'stance']] },
        hits: [{ at: [5, 8], limb: 'footF', r: 14, dmg: 32, hs: 14, bs: 10, kb: [3, 0] }],
        ai: { range: [0, 125], kind: 'poke' },
      },
      '2L': {
        name: 'Shin Tap',
        anim: { keys: [[0, 'crouch'], [3, '2L_a', 'out'], [5, '2L_b', 'snap'], [8, '2L_b'], [15, 'crouch']] },
        hits: [{ at: [5, 8], limb: 'footF', r: 13, dmg: 26, level: 'low', hs: 13, bs: 10, kb: [3, 0] }],
        ai: { range: [0, 105], kind: 'low' },
      },
      '5H': {
        name: 'Roundhouse',
        anim: { keys: [[0, 'stance'], [5, '5H_a', 'out'], [9, '5H_b'], [10, '5H_c', 'snap'], [14, '5H_c'], [22, '5H_a'], [30, 'stance']] },
        hits: [{ at: [10, 13], limb: 'footF', r: 15, dmg: 78, hs: 20, bs: 16, kb: [7, 0], stop: 10 }],
        ai: { range: [40, 110], kind: 'poke' },
      },
      '2H': {
        name: 'Sweep',
        anim: { keys: [[0, 'crouch'], [4, '2H_a', 'out'], [9, '2H_b', 'snap'], [12, '2H_b'], [24, '2H_a'], [32, 'crouch']] },
        hits: [{ at: [9, 12], limb: 'footF', r: 14, dmg: 70, level: 'low', kd: true, kb: [2, 5], hs: 20, bs: 14 }],
        ai: { range: [30, 105], kind: 'low' },
      },
      '6H': {
        name: 'Axe Kick',
        anim: { keys: [[0, 'stance'], [8, '6H_a', 'out'], [16, '6H_b'], [19, '6H_c', 'snap'], [22, '6H_c'], [30, '6H_d'], [36, 'stance']] },
        vel: [[16, 3], [20, 0]],
        hits: [{ at: [19, 22], limb: 'footF', r: 15, dmg: 70, level: 'high', hs: 19, bs: 13, kb: [5, 0], stop: 11 }],
        ai: { range: [40, 125], kind: 'over' },
      },
      jL: {
        name: 'Air Knee',
        anim: { keys: [[0, 'jump'], [3, 'jL_a', 'out'], [4, 'jL_b', 'snap'], [12, 'jL_b'], [18, 'fall']] },
        hits: [{ at: [4, 11], limb: 'kneeF', r: 15, dmg: 36, hs: 14, bs: 10 }],
        ai: { kind: 'air' },
      },
      jH: {
        name: 'Flying Kick',
        anim: { keys: [[0, 'jump'], [5, 'jH_a', 'out'], [7, 'jH_b', 'snap'], [15, 'jH_b'], [22, 'fall']] },
        hits: [{ at: [7, 14], limb: 'footF', r: 14, dmg: 68, hs: 18, bs: 14, kb: [5, 0] }],
        ai: { kind: 'air' },
      },
      '5S': {
        name: 'Kickflip',
        anim: { keys: [[0, 'stance'], [4, 'flipA', 'out'], [7, 'flipB', 'snap'], [15, 'flipC', 'out'], [26, 'flipD', 'in'], [32, 'flipE', 'in'], [40, 'stance']] },
        airInv: [1, 12],
        hits: [{
          at: [6, 15], r: 22, dmg: 90, hs: 28, kd: true, launch: true, kb: [2.5, 13.5], spark: 'S', stop: 11, sfx: 'hitH',
          capFn: (f) => {
            const P = f.pose, a = (P.p1 || 0) * D2R;
            const cx = P.p2, cy = P.p3, dx = Math.cos(a) * 34, dy = Math.sin(a) * 34;
            return [cx - dx, cy - dy, cx + dx, cy + dy];
          },
        }],
        ev: { 5: (f) => Sound.sfx('skate') },
        ai: { range: [0, 130], kind: 'aa' },
      },
      '6S': {
        name: 'Grind Rush',
        anim: { keys: [[0, 'stance'], [4, 'squat'], [7, 'ride', 'out'], [12, 'rideLean'], [26, 'rideLean'], [32, 'hopOff'], [40, 'stance']] },
        vel: [[7, 11.5], [26, 2], [32, 0]],
        keepVel: true,
        trail: [7, 26],
        hits: [{
          at: [8, 25], cap: [36, -14, 16, -88], r: 24, dmg: 80, hs: 30, kd: true, launch: true, kb: [8, 8], spark: 'S', stop: 10, bs: 12,
          onBlock: (f) => {
            f.vx = -3 * f.facing;
            f.mf = Math.max(f.mf, 24);
          },
        }],
        ev: { 6: (f) => Sound.sfx('skate') },
        onHit: (f) => {
          f.vx = 2 * f.facing;
          f.mf = Math.max(f.mf, 24);
        },
        ai: { range: [120, 420], kind: 'approach', unsafe: true },
      },
      '2S': {
        name: 'Power Slide',
        anim: { keys: [[0, 'crouch'], [7, 'slide', 'out'], [22, 'slide'], [32, 'crouch'], [42, 'crouch']] },
        vel: [[6, 10.5], [22, 1.5]],
        fric: 0.955,
        projInv: [5, 20],
        hits: [{
          at: [8, 20], limb: 'footF', r: 15, dmg: 58, level: 'low', hs: 22, bs: 10, kb: [5, 0], spark: 'H',
          // blocked: the slide stops dead and is punishable
          onBlock: (f) => {
            f.vx = 0;
            f.mf = Math.max(f.mf, 22);
          },
        }],
        ai: { range: [60, 300], kind: 'low', unsafe: true },
      },
      jS: {
        name: 'Dive Kick',
        anim: { keys: [[0, 'jump'], [3, 'dive', 'snap'], [60, 'dive']] },
        vel: [[3, 9, -12]],
        grav: 0, gravAt: [3, 60],
        landLag: 7,
        hits: [{ at: [4, 60], limb: 'footF', r: 15, dmg: 55, hs: 17, bs: 12, kb: [4, 0], maxHits: 1 }],
        onHit: (f) => {
          f.vx = -2.5 * f.facing;
          f.vy = 7.5;
          f.endMove();
        },
        ai: { kind: 'airS' },
      },
      SUP: {
        name: 'SICK TRICK',
        anim: { keys: [[0, 'squat'], [6, 'ride', 'out'], [10, 'rideLean'], [40, 'rideLean'], [48, 'hopOff'], [56, 'stance']] },
        vel: [[6, 13.5], [40, 2], [48, 0]],
        keepVel: true,
        inv: [0, 12],
        trail: [6, 40],
        hits: [{ at: [7, 39], cap: [36, -14, 16, -90], r: 28, dmg: 20, seq: true, super: true, spark: 'S' }],
        seqHit: {
          len: 76,
          anim: { keys: [[0, 'rideLean'], [8, 'supSpin'], [14, 'supKickA', 'snap'], [19, 'supKickB', 'snap'], [24, 'supKickA', 'snap'], [29, 'supKickB', 'snap'], [34, 'supKickA', 'snap'], [42, 'supSpin'], [50, 'supSlam', 'snap'], [64, 'supSlam'], [76, 'squat']] },
          self: [[0, 0, 0], [10, 20, 110], [16, 26, 150], [36, 40, 175], [46, 60, 260], [52, 80, 230, 'in'], [60, 80, 40, 'in'], [66, 80, 0, 'in']],
          vic: [[0, 'hurt2', 64, 0], [10, 'hurtAir', 90, 130], [16, 'hurtAir', 92, 160, 10], [24, 'launch', 96, 172, -10], [34, 'hurtAir', 100, 180, 20], [44, 'launch', 104, 190, 0], [52, 'launch', 108, 175, 30], [60, 'fallen', 112, 0, 0, 'in'], [76, 'fallen', 112, 0]],
          hits: {
            15: { dmg: 30, sfx: 'hitM', stop: 4 },
            20: { dmg: 30, sfx: 'hitM', stop: 4 },
            25: { dmg: 30, sfx: 'hitM', stop: 4 },
            30: { dmg: 30, sfx: 'hitM', stop: 4 },
            35: { dmg: 40, sfx: 'hitH', stop: 6, shake: 5 },
            60: { dmg: 110, sfx: 'hitX', stop: 14, shake: 18, word: 'SICK!', minScale: 0.6 },
          },
          ev: { 9: () => Sound.sfx('skate'), 47: () => Sound.sfx('whoosh') },
          release: { vx: 2, vy: 3, kd: true },
          recover: 16,
        },
        ai: { kind: 'super', range: [0, 500] },
      },
      THROW: {
        name: 'Shoulder Toss',
        throw: true,
        throwAt: 3,
        anim: { keys: [[0, 'stance'], [3, 'throwReach'], [9, 'throwWhiff'], [24, 'stance']] },
        seq: {
          len: 30,
          tech: true,
          anim: { keys: [[0, 'thrA'], [8, 'thrA'], [11, 'thrB', 'snap'], [17, 'thrC'], [21, 'thrD', 'snap'], [30, 'stance']] },
          vic: [[0, 'grabbed', 52, 0], [10, 'grabbed', 48, 0], [12, 'hurt2', 46, 0], [19, 'hurt2', 50, 0], [22, 'hurtAir', 72, 26]],
          hits: { 11: { dmg: 30, sfx: 'hitM' }, 21: { dmg: 60, sfx: 'hitH', shake: 6, stop: 6 } },
          release: { vx: 9, vy: 9 },
          recover: 10,
        },
      },
    },

    // ---- drawing ----------------------------------------------------------
    draw: {
      behind(ctx, f, J, pal) {
        const P = J.P;
        if (P.prop === 'board' && (P.p3 || 0) > -30) drawBoard(ctx, pal, P.p2 || 0, P.p3 || 0, P.p1 || 0, f.C.lw);
      },
      torso(ctx, f, J, pal) {
        const T = f.C.body.torso, lw = f.C.lw;
        ctx.beginPath();
        ctx.moveTo(-23, 10);
        ctx.quadraticCurveTo(-30, -20, -23, -T + 8);
        ctx.quadraticCurveTo(-17, -T - 4, 0, -T - 3);
        ctx.lineTo(10, -T - 3);
        ctx.quadraticCurveTo(27, -T - 2, 27, -T + 12);
        ctx.quadraticCurveTo(31, -22, 27, 10);
        ctx.closePath();
        Draw.fillStroke(ctx, pal.hood, lw, pal.ink);
        // shade the back half
        ctx.save();
        ctx.clip();
        ctx.fillStyle = pal.dark.hood;
        ctx.beginPath();
        ctx.moveTo(-40, -T - 10);
        ctx.lineTo(-12, -T - 10);
        ctx.quadraticCurveTo(-20, -24, -12, 14);
        ctx.lineTo(-40, 14);
        ctx.fill();
        ctx.restore();
        // hem
        Draw.roundRect(ctx, -25, 2, 54, 10, 5, pal.hoodL, lw * 0.8, pal.ink);
        // (hands in the pocket: the front pass draws it, over the arms)
        const lv = lod(ctx);
        if (J.P.hand !== 'none') pocket(ctx, pal, lw, lv);
        if (lv) hoodieDetail(ctx, pal, T, lv);
        // drawstrings
        ctx.lineCap = 'round';
        for (const [x0, x1, y1] of [[13, 12, -T + 24], [21, 22, -T + 21]]) {
          ctx.strokeStyle = pal.ink;
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(x0, -T + 2);
          ctx.lineTo(x1, y1);
          ctx.stroke();
          ctx.strokeStyle = pal.string;
          ctx.lineWidth = 2.4;
          ctx.stroke();
          Draw.circle(ctx, x1, y1 + 2, 2.6, pal.string, 2, pal.ink);
        }
        // headphones around the neck
        ctx.beginPath();
        ctx.ellipse(9, -T + 1, 18, 7, 0, 0.1, Math.PI - 0.1);
        ctx.lineWidth = 7.5;
        ctx.strokeStyle = pal.ink;
        ctx.stroke();
        ctx.lineWidth = 4;
        ctx.strokeStyle = pal.phones;
        ctx.stroke();
        Draw.roundRect(ctx, 21, -T - 4, 11, 15, 5, pal.phones, lw * 0.8, pal.ink);
        Draw.roundRect(ctx, 24, -T - 1, 5, 9, 2, tint(pal.phones, '#ffffff', 0.35), 0);
        if (lv) phonesDetail(ctx, pal, T, lv);
      },
      head(ctx, f, J, pal, face) {
        const lw = f.C.lw;
        const k = f.C.body.headR / 31;
        ctx.scale(k, k);
        const lv = lod(ctx, 0.77);
        // hood shell
        ctx.beginPath();
        Draw.blobPath(ctx, [18, -32, -4, -40, -31, -26, -39, 2, -31, 28, -10, 38, 12, 35, 30, 14, 32, -12]);
        Draw.fillStroke(ctx, pal.hood, lw, pal.ink);
        ctx.save();
        ctx.clip();
        ctx.fillStyle = pal.dark.hood;
        ctx.beginPath();
        ctx.ellipse(-34, 6, 18, 40, 0.15, 0, TAU);
        ctx.fill();
        ctx.restore();
        if (lv) hoodDetail(ctx, pal, lv);
        // face
        Draw.ellipse(ctx, 7, 5, 24.5, 27, 0, pal.skin, lw, pal.ink);
        // hood rim framing the face
        ctx.beginPath();
        ctx.ellipse(6, 4, 27.5, 30, 0, -1.15, 2.25, true);
        ctx.lineCap = 'round';
        ctx.lineWidth = 15;
        ctx.strokeStyle = pal.ink;
        ctx.stroke();
        ctx.lineWidth = 9.5;
        ctx.strokeStyle = pal.hoodL;
        ctx.stroke();
        if (lv) rimDetail(ctx, pal, lv);
        // bangs
        ctx.beginPath();
        ctx.moveTo(-14, -24);
        ctx.lineTo(-6, -8);
        ctx.lineTo(0, -19);
        ctx.lineTo(9, -5);
        ctx.lineTo(13, -18);
        ctx.lineTo(23, -8);
        ctx.lineTo(24, -22);
        ctx.quadraticCurveTo(8, -32, -14, -24);
        ctx.closePath();
        Draw.fillStroke(ctx, pal.hair, lw * 0.85, pal.ink);
        ctx.fillStyle = tint(pal.hair, '#ffffff', 0.4);
        ctx.beginPath();
        ctx.ellipse(4, -22, 8, 2.5, -0.2, 0, TAU);
        ctx.fill();
        if (lv) hairDetail(ctx, pal);
        // eyes
        const blink = f.blinking;
        LIDS.length = 0;
        eye(ctx, pal, 2, 6, 6, 7.5, face, blink, false);
        eye(ctx, pal, 20, 6, 5, 7, face, blink, true);
        // brows
        ctx.lineCap = 'round';
        ctx.strokeStyle = pal.ink;
        ctx.lineWidth = 3;
        if (face === 'angry' || face === 'block') {
          ctx.beginPath();
          ctx.moveTo(-4, -5);
          ctx.lineTo(7, -2);
          ctx.moveTo(15, -2);
          ctx.lineTo(25, -5);
          ctx.stroke();
        }
        // nose
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(27, 9);
        ctx.quadraticCurveTo(30, 14, 26, 15);
        ctx.stroke();
        // mouth
        ctx.lineWidth = 3;
        ctx.beginPath();
        if (face === 'hurt' || face === 'ko') {
          Draw.ellipse(ctx, 15, 21, 5, 4.5, 0, '#8c2f45', 2.6, pal.ink);
        } else if (face === 'angry') {
          Draw.roundRect(ctx, 8, 17, 14, 7, 3, '#ffffff', 2.6, pal.ink);
        } else if (face === 'happy') {
          ctx.moveTo(7, 17);
          ctx.quadraticCurveTo(15, 27, 23, 16);
          ctx.closePath();
          Draw.fillStroke(ctx, '#8c2f45', 2.6, pal.ink);
        } else if (face === 'sad') {
          ctx.moveTo(9, 22);
          ctx.quadraticCurveTo(15, 17, 21, 22);
          ctx.stroke();
        } else {
          // smirk
          ctx.moveTo(8, 20);
          ctx.quadraticCurveTo(15, 22, 21, 17);
          ctx.stroke();
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(21, 17);
          ctx.lineTo(23, 15);
          ctx.stroke();
        }
        if (lv) faceDetail(ctx, pal, face, lv);
        // bubble gum
        const g = f.data && f.data.gum;
        if (g && face === 'normal') {
          const t = g / 80;
          const r = t < 0.85 ? 3 + 15 * U.ease.out(t / 0.85) : 0;
          if (r > 0) {
            Draw.circle(ctx, 22, 21, r, pal.gum, 2.6, pal.ink);
            Draw.circle(ctx, 22 + r * 0.3, 21 - r * 0.35, r * 0.25, '#ffffff', 0);
          }
        }
      },
      front(ctx, f, J, pal) {
        const P = J.P;
        if (P.hand === 'none') {
          ctx.save();
          ctx.translate(J.hip[0], J.hip[1]);
          ctx.rotate(J.ta);
          // where the front fist sits in the pocket
          const c = Math.cos(J.ta), s = Math.sin(J.ta);
          const dx = J.hF[0] - J.hip[0], dy = J.hF[1] - J.hip[1];
          FIST[0] = dx * c + dy * s;
          FIST[1] = dy * c - dx * s;
          pocket(ctx, pal, f.C.lw, lod(ctx), FIST);
          ctx.restore();
        }
        if (P.prop === 'board' && (P.p3 || 0) <= -30) drawBoard(ctx, pal, P.p2 || 0, P.p3 || 0, P.p1 || 0, f.C.lw);
      },
      arm(ctx, f, J, side, pc, pal) {
        const C = f.C, R = C.body.armR, P = J.P;
        const back = side === 'B';
        const s = back ? J.sB : J.sF, e = back ? J.eB : J.eF, h = back ? J.hB : J.hF;
        Rig.limb(ctx, s, e, h, R[0], R[1], R[2], pc.hood, pc.hood, C.lw, pal.ink);
        Rig.band(ctx, e, h, R[1], R[2], 0.78, 1, pc.hoodL, C.lw, pal.ink);
        const lv = lod(ctx);
        if (lv) sleeveDetail(ctx, pal, pc, s, e, h, R, back, lv);
        const hs = back ? P.handB || C.handDef : P.hand || C.handDef;
        if (hs !== 'none') Rig.drawHand(ctx, f, J, e, h, hs, pc.skin, pal, back);
      },
      hand(ctx, f, J, e, h, style, col, pal) {
        const r = f.C.body.handR;
        const ang = Math.atan2(h[1] - e[1], h[0] - e[0]);
        ctx.save();
        ctx.translate(h[0], h[1]);
        ctx.rotate(ang);
        if (style === 'point') {
          Draw.roundRect(ctx, r * 0.4, -r * 0.55, r * 1.7, r * 0.75, r * 0.35, col, f.C.lw * 0.8, pal.ink);
          Draw.roundRect(ctx, -r * 0.2, -r * 1.5, r * 0.7, r * 1.3, r * 0.3, col, f.C.lw * 0.8, pal.ink);
          Draw.circle(ctx, 0, 0, r, col, f.C.lw, pal.ink);
        } else if (style === 'open') {
          Draw.ellipse(ctx, r * 0.35, 0, r * 1.15, r * 0.85, 0, col, f.C.lw, pal.ink);
          Draw.ellipse(ctx, r * 0.2, -r * 0.85, r * 0.42, r * 0.3, -0.5, col, f.C.lw * 0.7, pal.ink);
        } else Draw.circle(ctx, r * 0.15, 0, r, col, f.C.lw, pal.ink);
        if (lod(ctx)) {
          // knuckles, finger joints and creases
          const g = hush(ctx);
          ctx.beginPath();
          if (style === 'point') {
            ctx.moveTo(r * 1.32, -r * 0.5);
            ctx.lineTo(r * 1.32, -r * 0.24);
            ctx.moveTo(r * 0.5, r * 0.12);
            ctx.lineTo(r * 0.92, r * 0.2);
            ctx.moveTo(r * 0.36, r * 0.5);
            ctx.lineTo(r * 0.78, r * 0.6);
            ctx.moveTo(-r * 0.5, r * 0.1);
            ctx.quadraticCurveTo(-r * 0.1, r * 0.6, r * 0.3, r * 0.82);
          } else if (style === 'open') {
            for (const y of [-0.34, 0.06, 0.44]) {
              ctx.moveTo(r * 0.92, y * r);
              ctx.lineTo(r * 1.46, y * r * 1.1);
            }
            ctx.moveTo(-r * 0.4, -r * 0.2);
            ctx.quadraticCurveTo(0, r * 0.25, -r * 0.1, r * 0.6);
          } else {
            ctx.arc(r * 0.15, 0, r * 0.55, -0.9, 0.9);
            for (const y of [-0.42, 0, 0.42]) {
              ctx.moveTo(r * 0.72, y * r);
              ctx.lineTo(r * 1.08, y * r * 1.12);
            }
            ctx.moveTo(-r * 0.45, -r * 0.55);
            ctx.quadraticCurveTo(r * 0.2, -r * 0.95, r * 0.62, -r * 0.42);
          }
          inkStroke(ctx, pal, 0.9);
          unhush(ctx, g);
        }
        ctx.restore();
      },
      foot(ctx, f, J, a, t, col, pal) {
        const ang = Math.atan2(t[1] - a[1], t[0] - a[0]);
        const L = Math.hypot(t[0] - a[0], t[1] - a[1]);
        const lw = f.C.lw;
        ctx.save();
        ctx.translate(a[0], a[1]);
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.moveTo(-8, -8);
        ctx.lineTo(L - 2, -6);
        ctx.quadraticCurveTo(L + 9, -4, L + 8, 5);
        ctx.lineTo(L + 8, 8);
        ctx.lineTo(-9, 8);
        ctx.quadraticCurveTo(-11, -2, -8, -8);
        ctx.closePath();
        Draw.fillStroke(ctx, col, lw, pal.ink);
        Draw.roundRect(ctx, -10, 4, L + 19, 5.5, 2.5, pal.sole, lw * 0.6, pal.ink);
        ctx.strokeStyle = pal.sole;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(2, -6);
        ctx.lineTo(6, 1);
        ctx.moveTo(7, -6);
        ctx.lineTo(11, 1);
        ctx.stroke();
        const lv = lod(ctx);
        if (lv) sneakerDetail(ctx, pal, col, L, lv);
        ctx.restore();
      },
      leg(ctx, f, J, side, pc, pal) {
        const b = f.C.body;
        const back = side === 'B';
        const hp = back ? J.hipB : J.hipF, k = back ? J.kB : J.kF, a = back ? J.aB : J.aF, t = back ? J.tB : J.tF;
        Rig.limb(ctx, hp, k, a, b.legR[0], b.legR[1], b.legR[2], pc.pants, pc.pants, f.C.lw, pal.ink);
        const lv = lod(ctx);
        if (lv) jeansDetail(ctx, pal, pc, hp, k, a, b.legR, back, lv);
        else if (!back) {
          // knee rip on the front leg
          const mx = k[0] + (a[0] - k[0]) * 0.12, my = k[1] + (a[1] - k[1]) * 0.12;
          Draw.ellipse(ctx, mx, my, 5, 3.4, Math.atan2(a[1] - k[1], a[0] - k[0]), pal.skin, 1.8, pal.ink);
        }
        Rig.drawFoot(ctx, f, J, a, t, pc.shoe, pal, back);
      },
    },

    update(f) {
      // gum bubble while idling
      const d = f.data;
      if (d.gum) {
        d.gum++;
        if (d.gum === 68 && f.battle) FX.add({ type: 'dot', x: f.x + f.facing * 30, y: -f.y - 160, vx: 0, vy: -1, size: 4, life: 10, color: f.pal.gum });
        if (d.gum > 80 || !(f.state in NEUTRAL_STATES || f.state === 'intro' || f.state === 'win')) d.gum = 0;
      } else if ((f.state === 'idle' && f.idleT > 120 && Math.random() < 0.006) || (f.state === 'intro' && f.sf === 20)) d.gum = 1;
    },
  });
})();
