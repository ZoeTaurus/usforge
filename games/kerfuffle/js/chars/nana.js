'use strict';
// ---------------------------------------------------------------------------
// NANA — ninety-one years young and still the best fighter in the family.
// Tiny, hunched and terrifyingly patient: a long cane for footsies, a counter
// stance that swats your attacks back, yarn balls at your ankles and a tea
// break whenever she likes.
// ---------------------------------------------------------------------------
(() => {
  // ---- hand-drawn detail helpers --------------------------------------------------
  // Detail lines are stroked on their own paths so the sketch pass (sketch.js)
  // keeps them as ink instead of treating them as outlines.

  // mixed colors, cached (there are only a few palettes and tints)
  const _tones = new Map();
  function tone(c, to, t) {
    const key = c + to + t;
    let v = _tones.get(key);
    if (v === undefined) _tones.set(key, (v = U.mix(c, to, t)));
    return v;
  }
  // a nearly opaque copy of a color: print and pattern fills drawn with it are
  // left flat (the sketch pass only shades solid '#rrggbb' fills)
  const _flats = new Map();
  function flat(c) {
    let v = _flats.get(c);
    if (v === undefined) _flats.set(c, (v = U.rgba(c, 0.99)));
    return v;
  }
  // device pixels per character unit, measured once per drawn character in
  // draw.behind (portrait heads measure their own)
  let PX = 1;
  function pxPer(ctx) {
    const m = ctx.getTransform();
    return Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;
  }
  function stroke(ctx, col, w) {
    ctx.lineWidth = w;
    ctx.strokeStyle = col;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
  // add a dot to the current path
  function dot(ctx, x, y, r) {
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, TAU);
  }
  // four-petal flowers (petals only) at each [x, y]
  function petals(ctx, pts, r) {
    for (let i = 0; i < pts.length; i++) {
      const x = pts[i][0], y = pts[i][1], a0 = pts[i][2] || 0.4;
      for (let j = 0; j < 4; j++) {
        const a = a0 + j * 1.5708;
        dot(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.85);
      }
    }
  }

  // ---- props ------------------------------------------------------------------
  // simple: the ghost canes of the super skip the fine detail
  function drawCane(ctx, pal, end, hand, tip, lw, simple) {
    const ang = Math.atan2(tip[1] - hand[1], tip[0] - hand[0]);
    const len = Math.hypot(tip[0] - end[0], tip[1] - end[1]);
    const fine = !simple && PX > 1.3;
    ctx.save();
    ctx.translate(end[0], end[1]);
    ctx.rotate(ang);
    // shaft
    Draw.line(ctx, 0, 0, len, 0, 6.5, pal.cane, lw * 0.8, pal.ink);
    ctx.beginPath();
    ctx.moveTo(4, -1.6);
    ctx.lineTo(len - 12, -1.6);
    if (!simple) {
      // the crook's lit top
      ctx.moveTo(-6.4, -15.4);
      ctx.arc(0, -9, 10.4, Math.PI * 1.2, Math.PI * 1.62);
    }
    stroke(ctx, pal.caneL, 2);
    if (!simple) {
      // wood grain, a knot and the end grain of the crook
      ctx.beginPath();
      ctx.moveTo(10, 1.6);
      ctx.quadraticCurveTo(len * 0.24, 2.3, len * 0.38, 1.1);
      ctx.moveTo(len * 0.5, 1.9);
      ctx.quadraticCurveTo(len * 0.62, 0.7, len * 0.8, 1.7);
      ctx.moveTo(len * 0.28, -0.2);
      ctx.lineTo(len * 0.36, 0.2);
      ctx.moveTo(len * 0.66, -0.6);
      ctx.lineTo(len * 0.74, -0.2);
      ctx.moveTo(len * 0.44 + 1.8, 1);
      ctx.ellipse(len * 0.44, 1, 1.8, 1.1, 0, 0, TAU);
      ctx.moveTo(-3.5, -3.2);
      ctx.arc(0, -9, 6.8, Math.PI * 0.8, Math.PI * 1.45);
      stroke(ctx, pal.ink, 0.9);
      // metal ferrule above the rubber tip
      ctx.beginPath();
      ctx.rect(len - 11.5, -3.6, 4.6, 7.2);
      ctx.fillStyle = tone(pal.ink, '#ffffff', 0.72);
      ctx.fill();
    }
    // rubber tip
    Draw.roundRect(ctx, len - 7, -4.5, 10, 9, 3, pal.ink, 0);
    if (!simple) {
      ctx.beginPath();
      ctx.moveTo(len - 9.2, -3.4);
      ctx.lineTo(len - 9.2, 3.4);
      if (fine) {
        ctx.moveTo(len - 3, -3.6);
        ctx.lineTo(len - 3, 3.6);
        ctx.moveTo(len, -3.4);
        ctx.lineTo(len, 3.4);
      }
      stroke(ctx, tone(pal.ink, '#ffffff', 0.38), 1);
    }
    // the crook curls back over the hand
    ctx.beginPath();
    ctx.arc(0, -9, 9, Math.PI * 0.5, Math.PI * 1.75, false);
    ctx.lineCap = 'round';
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 6.5 + lw * 1.6;
    ctx.stroke();
    ctx.strokeStyle = pal.cane;
    ctx.lineWidth = 6.5;
    ctx.stroke();
    if (!simple) {
      // grain along the crook and a ring where it was bent
      ctx.beginPath();
      ctx.moveTo(-6.6, -3.6);
      ctx.arc(0, -9, 7.4, Math.PI * 0.82, Math.PI * 1.5);
      ctx.moveTo(-4, -16.6);
      ctx.quadraticCurveTo(-6.5, -14.4, -6.8, -11.6);
      stroke(ctx, pal.ink, 0.9);
    }
    ctx.restore();
  }

  function teacup(ctx, pal, x, y, lw, t) {
    const fine = PX > 1.3;
    ctx.save();
    ctx.translate(x, y);
    // steam curls rising off the tea
    ctx.beginPath();
    for (let i = 0; i < 2; i++) {
      const x0 = -3.5 + i * 7, ph = t * 0.14 + i * 2.1, s = Math.sin(ph) * 2.2;
      ctx.moveTo(x0, -9);
      ctx.bezierCurveTo(x0 + 4 + s, -13, x0 - 4 - s, -17, x0 + s * 0.6, -22 - i * 3);
    }
    stroke(ctx, 'rgba(255,255,255,0.8)', 2);
    // saucer
    Draw.ellipse(ctx, 0, 8, 15, 4, 0, pal.cupL, lw * 0.7, pal.ink);
    // tea bag tag hanging over the back of the cup
    ctx.beginPath();
    ctx.moveTo(-5, -6.6);
    ctx.quadraticCurveTo(-10.5, -8.5, -11.6, -1);
    stroke(ctx, pal.ink, 0.9);
    Draw.roundRect(ctx, -14, -1.2, 5, 5.5, 1, pal.glasses, 1, pal.ink);
    // cup
    ctx.beginPath();
    ctx.moveTo(-10, -6);
    ctx.lineTo(10, -6);
    ctx.quadraticCurveTo(10, 7, 0, 7);
    ctx.quadraticCurveTo(-10, 7, -10, -6);
    ctx.closePath();
    Draw.fillStroke(ctx, pal.cup, lw * 0.8, pal.ink);
    // handle, then the saucer rim and the foot of the cup
    ctx.beginPath();
    ctx.arc(11, 0, 4, -1.2, 1.2);
    stroke(ctx, pal.ink, 2.5);
    ctx.beginPath();
    ctx.moveTo(-11.5, 9.6);
    ctx.quadraticCurveTo(0, 12.6, 11.5, 9.6);
    ctx.moveTo(-4.5, 7.4);
    ctx.lineTo(4.5, 7.4);
    stroke(ctx, pal.ink, 1.1);
    Draw.ellipse(ctx, 0, -6, 10, 2.5, 0, '#c98a4b', 1.6, pal.ink);
    // gold rim, a band and a little rose
    ctx.beginPath();
    ctx.ellipse(0, -6, 10.2, 2.7, 0, 0, Math.PI);
    stroke(ctx, pal.glasses, 1.2);
    ctx.fillStyle = pal.trim;
    ctx.fillRect(-8, -2, 16, 2.4);
    ctx.beginPath();
    petals(ctx, [[1.5, 3, 0.2]], 1.3);
    ctx.fillStyle = flat(pal.pin);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-2.6, 3.8, 1.6, 0.8, 0.5, 0, TAU);
    ctx.ellipse(5.4, 2.6, 1.6, 0.8, -0.5, 0, TAU);
    ctx.fillStyle = flat(tone(pal.cane, pal.ink, 0.15));
    ctx.fill();
    if (fine) {
      // a glint on the tea
      ctx.beginPath();
      ctx.moveTo(-5.5, -6.6);
      ctx.lineTo(-2, -7.2);
      stroke(ctx, 'rgba(255,255,255,0.75)', 1);
    }
    ctx.restore();
  }

  function yarnBall(ctx, x, y, r, rot, pal) {
    ctx.save();
    ctx.translate(x, y);
    Draw.circle(ctx, 0, 0, r, pal.yarn, 3.2, pal.ink);
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r - 0.5, 0, TAU);
    ctx.clip();
    ctx.rotate(rot);
    // bands of wound strands crossing each other
    ctx.beginPath();
    for (let i = -3; i <= 3; i++) ctx.ellipse(i * 5, 0, 3.5, r * 1.1, 0.35, 0, TAU);
    stroke(ctx, pal.yarnL, 2.2);
    ctx.beginPath();
    for (let i = -2; i <= 2; i++) {
      const yy = i * 5.5;
      ctx.moveTo(-r, yy - 3);
      ctx.quadraticCurveTo(0, yy + 4, r, yy - 1);
    }
    for (let i = 0; i < 3; i++) {
      const xx = -6 + i * 4;
      ctx.moveTo(xx - 3, -r);
      ctx.quadraticCurveTo(xx + 4, 0, xx - 2, r);
    }
    stroke(ctx, pal.ink, 1.1);
    ctx.restore();
    // the loose end
    ctx.beginPath();
    ctx.moveTo(r * 0.55, r * 0.75);
    ctx.quadraticCurveTo(r * 1.1, r * 0.9, r * 1.15, r * 0.55);
    ctx.quadraticCurveTo(r * 1.2, r * 0.2, r * 1.45, r * 0.4);
    stroke(ctx, pal.yarn, 2.2);
    Draw.circle(ctx, -r * 0.35, -r * 0.35, r * 0.22, 'rgba(255,255,255,0.6)', 0);
    ctx.restore();
  }

  function spawnYarn(f) {
    const b = f.battle;
    if (!b) return;
    const pal = f.pal;
    f.data.yarnOut = true;
    b.spawn(f, {
      x: f.x + f.facing * 46, y: 17, vx: 7 * f.facing, vy: 0, r: 17, life: 150, hits: 1, strength: 1, rot: 0, thread: [],
      hit: normHit({ dmg: 44, level: 'low', hs: 22, bs: 13, kb: [1.5, 6], kd: true, spark: 'L', sfx: 'yarn', stop: 7, chip: 6 }, 'S', 'special'),
      tick(p) {
        p.rot += (p.vx / p.r) * 1.0;
        p.y = 17 + Math.abs(Math.sin(p.age * 0.22)) * 5;
        if (p.age % 3 === 0) {
          p.thread.push([p.x, p.y]);
          if (p.thread.length > 16) p.thread.shift();
        }
      },
      onEnd() {
        f.data.yarnOut = false;
      },
      draw(ctx, sx, sy, p) {
        // the trailing thread
        const ox = sx - p.x, oy = sy + p.y;
        if (p.thread.length > 1) {
          ctx.save();
          ctx.strokeStyle = pal.yarn;
          ctx.lineWidth = 2.4;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(ox + p.thread[0][0], oy - 2);
          for (let i = 1; i < p.thread.length; i++) {
            const q = p.thread[i];
            ctx.lineTo(ox + q[0], oy - 2 - Math.sin(i * 1.3 + p.age * 0.1) * 2);
          }
          ctx.lineTo(sx, sy + p.r * 0.7);
          ctx.stroke();
          ctx.restore();
        }
        yarnBall(ctx, sx, sy, p.r, p.rot, pal);
      },
    });
    Sound.sfx('yarn');
  }

  function steam(f) {
    if (!f.battle || f.t % 7 !== 0) return;
    const h = f.jointWorld('hF');
    FX.add({ type: 'dot', x: h[0] + U.rand(-4, 4), y: h[1] - 14, vx: U.rand(-0.3, 0.3), vy: -1.1, size: 5, life: 26, color: 'rgba(255,255,255,0.8)', lw: 0 });
  }

  // ---- face ---------------------------------------------------------------------
  // (paths only: the caller strokes both eyes at once)
  function closedEye(ctx, x, y, w, happy) {
    if (happy) {
      ctx.moveTo(x + Math.cos(Math.PI * 1.1) * w, y + 3 + Math.sin(Math.PI * 1.1) * w);
      ctx.arc(x, y + 3, w, Math.PI * 1.1, Math.PI * 1.9);
    } else {
      ctx.moveTo(x - w, y - 1);
      ctx.quadraticCurveTo(x, y + 4, x + w, y - 1);
    }
  }

  // soft white brows, drawn as a few ink hairs; lift raises their inner ends
  function brows(ctx, lift) {
    for (let s = 0; s < 2; s++) {
      const dir = s ? 1 : -1;
      const ix = s ? 13 : 6, iy = (s ? -4.4 : -5.4) - lift;
      const ox = s ? 24.5 : -3.2, oy = s ? -3.4 : -4;
      for (let i = 0; i < 5; i++) {
        const t = i / 4;
        const x = ix + (ox - ix) * t, y = iy + (oy - iy) * t - Math.sin(t * Math.PI) * 1.3;
        ctx.moveTo(x - dir * 1.3, y + 1);
        ctx.lineTo(x + dir * 1.2, y - 0.8);
      }
    }
  }

  // k: device pixels per head unit (hairline wrinkles are skipped when tiny)
  function face(ctx, f, pal, fc, lw, glint, k) {
    const ink = pal.ink;
    const fine = k > 1.1;
    const E = [[1, 7, 5.5], [18, 7, 4.6]];
    // eyes behind the glasses
    if (fc === 'angry') {
      // the eyes snap open!
      for (const [x, y, w] of E) {
        Draw.circle(ctx, x, y, w * 0.95, '#ffffff', 2.4, ink);
        Draw.circle(ctx, x + 1, y + 0.5, w * 0.5, pal.eye, 0);
        Draw.circle(ctx, x + 1, y + 0.5, w * 0.25, ink, 0);
      }
      ctx.lineWidth = 3.4;
      ctx.strokeStyle = ink;
      ctx.beginPath();
      ctx.moveTo(-6, -4);
      ctx.lineTo(7, 1);
      ctx.moveTo(13, 1);
      ctx.lineTo(24, -3);
      ctx.stroke();
    } else if (fc === 'hurt') {
      ctx.lineWidth = 3;
      ctx.strokeStyle = ink;
      ctx.beginPath();
      ctx.moveTo(-3, 3);
      ctx.lineTo(4, 7);
      ctx.lineTo(-3, 11);
      ctx.moveTo(21, 3);
      ctx.lineTo(15, 7);
      ctx.lineTo(21, 11);
      ctx.stroke();
    } else if (fc === 'ko') {
      ctx.beginPath();
      for (const [x, y] of E) {
        ctx.moveTo(x, y);
        for (let a = 0.4; a < 10; a += 0.4) {
          const rr = a * 0.55;
          ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
      }
      stroke(ctx, ink, 2.6);
    } else if (fc === 'sad') {
      ctx.beginPath();
      for (const [x, y, w] of E) {
        ctx.moveTo(x - w, y + 1);
        ctx.quadraticCurveTo(x, y - 2, x + w, y + 2);
      }
      stroke(ctx, ink, 3);
    } else {
      // the default: a happy granny squint ^ ^
      ctx.beginPath();
      for (const [x, y, w] of E) closedEye(ctx, x, y, w, fc !== 'block' && fc !== 'cool');
      stroke(ctx, ink, 3.2);
    }
    // rosy cheeks
    ctx.fillStyle = U.rgba(pal.blush, 0.55);
    ctx.beginPath();
    ctx.ellipse(-3, 17, 6, 3.6, 0, 0, TAU);
    ctx.ellipse(23, 16, 4.5, 3.2, 0, 0, TAU);
    ctx.fill();
    // ninety-one years of smiling: brows, bags under the eyes, crow's feet,
    // smile lines and a soft chin
    ctx.beginPath();
    if (fc !== 'angry') brows(ctx, fc === 'sad' || fc === 'hurt' ? 2.4 : fc === 'ko' ? 1.4 : 0);
    if (fc !== 'angry' && fc !== 'hurt') {
      for (const [x, y, w] of E) {
        ctx.moveTo(x - w * 0.8, y + 5.4);
        ctx.quadraticCurveTo(x, y + 8, x + w * 0.8, y + 5.4);
      }
    }
    ctx.moveTo(-8.4, 1.6);
    ctx.lineTo(-11.6, 0.6);
    ctx.moveTo(-7.8, -0.6);
    ctx.lineTo(-10.2, -2.8);
    ctx.moveTo(-8.8, 3.9);
    ctx.lineTo(-11.8, 4.6);
    ctx.moveTo(6.6, 18.2);
    ctx.quadraticCurveTo(4.8, 21.8, 7.4, 25.2);
    ctx.moveTo(25.8, 17.2);
    ctx.quadraticCurveTo(27.2, 20.8, 24.8, 24.6);
    ctx.moveTo(13, 28.8);
    ctx.quadraticCurveTo(16, 30.4, 19, 28.8);
    if (fine) {
      ctx.moveTo(-5, 22.6);
      ctx.quadraticCurveTo(-1.5, 27.8, 4.6, 28.6);
      ctx.moveTo(14, -8.4);
      ctx.quadraticCurveTo(19, -9.8, 24, -8.6);
    }
    stroke(ctx, ink, 1.5);
    if (fine) {
      // blush hatching
      ctx.beginPath();
      for (const x of [-6, -3, 0, 21.6, 24.2]) {
        ctx.moveTo(x - 0.8, 18.4);
        ctx.lineTo(x + 0.9, 15);
      }
      stroke(ctx, tone(pal.blush, ink, 0.4), 1.2);
    }
    // glasses
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.beginPath();
    for (const [x, y, w] of E) dot(ctx, x, y, w + 3.4);
    ctx.fillStyle = '#cfeaff';
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    for (const [x, y, w] of E) dot(ctx, x, y, w + 3.4);
    ctx.moveTo(7.5, 6);
    ctx.lineTo(11, 6);
    ctx.moveTo(-8.5, 5);
    ctx.lineTo(-14, 3);
    stroke(ctx, pal.glasses, 2.6);
    if (fine) {
      // the inner edge of the rims
      ctx.beginPath();
      for (const [x, y, w] of E) dot(ctx, x, y, w + 1.9);
      stroke(ctx, ink, 0.8);
    }
    // lens glints
    ctx.beginPath();
    for (const [x, y, w] of E) {
      const r = w + 3.4;
      ctx.moveTo(x - r * 0.45, y - r * 0.1);
      ctx.lineTo(x - r * 0.05, y - r * 0.55);
      ctx.moveTo(x - r * 0.56, y + r * 0.2);
      ctx.lineTo(x - r * 0.42, y + r * 0.04);
    }
    stroke(ctx, 'rgba(255,255,255,0.85)', 1.8);
    if (glint) {
      Draw.star(ctx, 22, 2, 11, 2.6, 4, '#ffffff', 2, ink, (f.t || 0) * 0.05);
      Draw.star(ctx, 22, 2, 5, 1.6, 4, '#fff6b0', 0, ink, 0.4);
    }
    // nose
    ctx.beginPath();
    ctx.moveTo(25, 10);
    ctx.quadraticCurveTo(30, 14, 25, 16);
    stroke(ctx, ink, 2.4);
    if (fine) {
      ctx.beginPath();
      ctx.moveTo(25.6, 14);
      ctx.quadraticCurveTo(26.6, 15.2, 27.6, 14.4);
      stroke(ctx, ink, 1.2);
    }
    // mouth
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    if (fc === 'angry') {
      ctx.moveTo(10, 21);
      ctx.quadraticCurveTo(16, 18, 22, 20);
      ctx.quadraticCurveTo(18, 30, 11, 25);
      ctx.closePath();
      Draw.fillStroke(ctx, '#8c2f45', 2.4, ink);
    } else if (fc === 'hurt' || fc === 'ko') {
      Draw.ellipse(ctx, 16, 23, 3.6, 3.2, 0, '#8c2f45', 2.2, ink);
    } else if (fc === 'sad') {
      ctx.moveTo(11, 24);
      ctx.quadraticCurveTo(16, 20, 21, 24);
      ctx.stroke();
    } else if (fc === 'happy') {
      ctx.moveTo(10, 20);
      ctx.quadraticCurveTo(16, 28, 22, 19);
      ctx.closePath();
      Draw.fillStroke(ctx, '#8c2f45', 2.2, ink);
    } else {
      ctx.moveTo(10, 21);
      ctx.quadraticCurveTo(16, 25, 22, 20);
      ctx.stroke();
    }
  }

  // the front hand is up around the head
  function raised(J) {
    return J.hF[1] < J.head[1] + 12;
  }

  // ---- super cinematic ------------------------------------------------------------
  const barrageKeys = [[0, 'wrathA'], [6, 'wrathB', 'snap']];
  for (let fr = 8; fr <= 48; fr += 2) barrageKeys.push([fr, (fr / 2) % 2 === 0 ? 'barrageA' : 'barrageB', 'snap']);
  barrageKeys.push([54, 'bigBonkA', 'out'], [60, 'bigBonkB', 'snap'], [70, 'bigBonkB']);
  const barrageHits = {};
  for (let fr = 9; fr <= 49; fr += 4) barrageHits[fr] = { dmg: 14, sfx: fr % 8 === 1 ? 'cane' : 'hitL', stop: 2 };
  barrageHits[60] = { dmg: 150, sfx: 'hitX', stop: 16, shake: 18, word: 'BONK!!', minScale: 0.75 };
  const barrageVic = [[0, 'hurt', 80, 0], [8, 'hurt2', 82, 0]];
  for (let fr = 12; fr <= 48; fr += 4) barrageVic.push([fr, fr % 8 === 4 ? 'hurt' : 'hurt2', 82 + (fr % 8 === 4 ? 4 : 0), 0]);
  barrageVic.push([56, 'hurt2', 86, 0], [60, 'launch', 100, 30, -20, 'snap'], [70, 'launch', 170, 110, -70]);

  defineChar({
    id: 'nana',
    name: 'NANA',
    title: 'Sweet Old Grandmaster',
    style: 'COUNTER',
    desc: 'Ninety-one years young and still the best fighter in the family. Pokes from far away with her cane, swats your attacks right back and stops for tea whenever she likes.',
    color: '#b69cf0',
    sparkColor: '#ffe08a',
    trailColor: '#d4c4ff',
    words: ['BONK!', 'WHACK!', 'TOK!', 'HMPH!'],
    wordColor: '#c9b2ff',
    ui: { power: 4, speed: 2, range: 4, difficulty: 5 },
    quotes: ['Eat your vegetables, dear.', 'In my day we fought uphill. Both ways.', 'Oh my, did I do that?', 'Sit up straight and call your mother.'],
    stats: {
      hp: 1100, walkF: 3.2, walkB: 2.7, jumpV: 15, jumpVx: 4, grav: 0.8, jsq: 5,
      dash: { f: 18, v: 7.5, hop: 3.5, cancel: 9 }, bdash: { v: 6.5, vy: 5, inv: 4, lag: 7 },
      width: 54, height: 156, throwRange: 52, landLag: 4, downTime: 34, swingPitch: 1.25, voicePitch: 1.3,
    },
    body: {
      torso: 40, neck: 2, headR: 30, shoulderDrop: 9, shoulderOfs: 3, hipOfs: 4,
      uArm: 20, fArm: 19, handR: 8,
      thigh: 22, shin: 22, footL: 14, footR: 7,
      armR: [8.5, 7.5, 6.6], legR: [10, 8.5, 7], torsoW: [48, 50],
    },
    armCols: ['cardigan', 'cardigan', 'skin'],
    legCols: ['pants', 'pants', 'shoe'],
    cuff: [0.62, 1.0, 'cardiganL'],
    sock: [0.6, 1.0, 'sock'],
    weapon: { len: 74, w: -50, back: 6 },
    poseDefaults: { w: -50 },
    // a raised cane arm goes behind the head so it never covers her face
    drawOrder: ['behind', 'armB', 'legB', 'legF', 'skirt', 'torso', 'caneUp', 'armUp', 'head', 'cane', 'armDown', 'front'],
    mono: [
      { main: '#a685f0', accent: '#ffd447' },
      { main: '#2bb3a7', accent: '#ff7aa8' },
      { main: '#ff7a6b', accent: '#7a5cff' },
    ],
    monoKeys: { main: 'cardigan', accentMain: 'glasses', accent: ['glasses', 'pin', 'yarn', 'yarnL', 'trim'], keep: ['cup', 'cupL'] },
    palettes: [
      { cardigan: '#b69cf0', cardiganL: '#d6c8ff', dress: '#ff7aa8', dressL: '#ffa9c8', trim: '#ffd447', pants: '#3b3350', sock: '#ffffff', shoe: '#2a2238',
        skin: '#f7d2b8', blush: '#ff8fa3', hair: '#eeeef6', hairS: '#c9c7d8', eye: '#4a3a6a', cane: '#b07a4a', caneL: '#dba373', glasses: '#7a5cff', pin: '#e8384f',
        cup: '#ffffff', cupL: '#f2ecff', yarn: '#ff7aa8', yarnL: '#ffc2d8' },
      { cardigan: '#d8344a', cardiganL: '#ff6f80', dress: '#ffd447', dressL: '#ffe78e', trim: '#2a2238', pants: '#2a2238', sock: '#ffffff', shoe: '#1c1626',
        skin: '#e9b48e', blush: '#ff7a7a', hair: '#f6f6f6', hairS: '#cfcfd6', eye: '#3a2a20', cane: '#6b4a33', caneL: '#93694b', glasses: '#ffd447', pin: '#2bb3a7',
        cup: '#ffe9a8', cupL: '#fff4d1', yarn: '#2bb3a7', yarnL: '#8ff0e4' },
      { cardigan: '#2bb3a7', cardiganL: '#7fe8dc', dress: '#f4f1fa', dressL: '#ffffff', trim: '#2bb3a7', pants: '#1f4f5a', sock: '#ffffff', shoe: '#173a42',
        skin: '#ffd9bb', blush: '#ff9ab8', hair: '#dcd6d0', hairS: '#b5ada6', eye: '#1f4f5a', cane: '#3f8f5a', caneL: '#6fc08a', glasses: '#ff7ab6', pin: '#ffd447',
        cup: '#d8f5ef', cupL: '#ffffff', yarn: '#ffd447', yarnL: '#fff1a8' },
    ],
    walk: { A: 6, H: 5, bob: 2.5, sway: 2.5, arm: 4 },
    idlePeriod: 90,
    ai: {
      pref: [130, 260], aggression: 0.45, jumpiness: 0.15, zoning: 0.45,
      combos: [['2L', '5L', '5H'], ['5L', '5H'], ['2L', '2H'], ['jH', '5L', '5H'], ['jL', '2L', '2H'], ['5L', '2H']],
      antiAir: ['5S'], punish: ['5H', '2H'], enders: ['2H', '5H'],
    },

    poses: {
      stance: { t: 28, hd: -18, fs: 30, fe: 60, w: -46, bs: -40, be: 120, lf: [14, 0], lb: [-12, 0], d: 8 },
      stance2: { $: 'stance', d: 10, t: 30, hd: -20, fe: 57, w: -40 },
      crouch: { t: 40, hd: -26, fs: 50, fe: 10, w: 5, bs: -30, be: 110, lf: [16, 0], lb: [-14, 0], d: 26 },
      crouch2: { $: 'crouch', d: 27 },
      squat: { t: 34, hd: -22, fs: 40, fe: 20, w: 0, bs: -30, be: 110, lf: [14, 0], lb: [-12, 0], d: 20 },
      jump: { t: 10, hd: -10, fs: 100, fe: 20, w: -100, bs: 120, be: 20, fh: 60, fk: 90, bh: 20, bk: 80 },
      fall: { t: 14, hd: -10, fs: 60, fe: 20, w: -60, bs: 70, be: 30, fh: 30, fk: 50, bh: -10, bk: 40 },
      tuck: { t: 30, hd: 0, fs: 50, fe: 60, w: -80, bs: 40, be: 80, fh: 100, fk: 130, bh: 90, bk: 130 },
      dash1: { t: 36, hd: -24, fs: 40, fe: 20, w: -60, bs: -60, be: 100, fh: 50, fk: 70, bh: -20, bk: 60 },
      dash2: { $: 'dash1', fh: 30, bh: -30, t: 32 },
      bdash: { t: 10, hd: -10, fs: 50, fe: 30, w: -60, bs: -30, be: 110, fh: 40, fk: 60, bh: -10, bk: 40 },
      block: { t: 14, hd: -6, fs: 70, fe: 50, w: -30, bs: 50, be: 80, handB: 'open', lf: [12, 0], lb: [-16, 0], d: 10, face: 'block' },
      cblock: { t: 30, hd: -14, fs: 70, fe: 50, w: -30, bs: 50, be: 80, handB: 'open', lf: [16, 0], lb: [-16, 0], d: 26, face: 'block' },
      // normals
      '5L_a': { t: 22, hd: -14, fs: -10, fe: 100, w: 0, lf: [14, 0], lb: [-14, 0], d: 10 },
      '5L_b': { t: 20, hd: -12, x: 6, fs: 85, fe: 5, w: 0, lf: [20, 0], lb: [-14, 0], d: 12, face: 'angry' },
      '2L_a': { t: 40, hd: -26, fs: 20, fe: 40, w: 20, lf: [16, 0], lb: [-14, 0], d: 26 },
      '2L_b': { t: 38, hd: -24, x: 4, fs: 60, fe: 0, w: 3, lf: [20, 0], lb: [-14, 0], d: 28, face: 'angry' },
      '5H_a': { t: 10, hd: -8, fs: -120, fe: 20, w: -60, bs: 30, be: 60, lf: [12, 0], lb: [-16, 0], d: 8 },
      '5H_b': { t: 30, hd: -14, x: 6, fs: 95, fe: 10, w: 15, bs: -30, be: 60, lf: [20, 0], lb: [-14, 0], d: 12, face: 'angry' },
      '5H_c': { t: 36, hd: -18, x: 8, fs: 70, fe: -5, w: -15, bs: -40, be: 60, lf: [20, 0], lb: [-14, 0], d: 14, face: 'angry' },
      '2H_a': { t: 44, hd: -26, fs: -40, fe: 60, w: -40, lf: [16, 0], lb: [-14, 0], d: 28 },
      '2H_b': { t: 40, hd: -24, x: 6, fs: 60, fe: 0, w: 5, lf: [22, 0], lb: [-14, 0], d: 30, face: 'angry' },
      '6H_a': { t: 16, hd: -10, fs: 160, fe: 10, w: 0, bs: -40, be: 120, lf: [12, 0], lb: [-14, 0], d: 18 },
      '6H_b': { t: 0, hd: -8, fs: -170, fe: 10, w: 0, bs: -40, be: 120, fh: 60, fk: 100, bh: 10, bk: 90 },
      '6H_c': { t: 30, hd: -16, fs: 70, fe: 0, w: 0, bs: -40, be: 120, fh: 30, fk: 60, bh: -10, bk: 60, face: 'angry' },
      jL_a: { t: 10, hd: -8, fs: 30, fe: 40, w: 0, bs: 60, be: 40, fh: 60, fk: 90, bh: 20, bk: 80 },
      jL_b: { t: 20, hd: -12, fs: 60, fe: 0, w: 0, bs: 50, be: 30, fh: 60, fk: 90, bh: 20, bk: 80, face: 'angry' },
      jH_a: { t: 0, hd: -6, fs: 90, fe: 30, w: -60, bs: 100, be: 30, fh: 100, fk: 120, bh: 10, bk: 80 },
      jH_b: { t: -14, hd: 4, fs: 110, fe: 20, w: -80, bs: 130, be: 20, fh: 70, fk: 0, fa: 10, bh: 0, bk: 100, face: 'angry' },
      // specials
      patience: { t: 16, hd: -8, fs: 50, fe: 60, w: -20, bs: 40, be: 70, handB: 'open', lf: [16, 0], lb: [-16, 0], d: 12, face: 'cool', fx: 'aura' },
      parry: { t: 6, hd: -6, fs: 110, fe: 10, w: -30, bs: 60, be: 60, handB: 'open', lf: [18, 0], lb: [-16, 0], d: 8, face: 'angry' },
      pokeA: { t: 22, hd: -12, x: 4, fs: 82, fe: 5, w: 0, bs: -30, be: 100, lf: [20, 0], lb: [-14, 0], d: 12, face: 'angry' },
      pokeB: { t: 26, hd: -14, x: 8, fs: 98, fe: 0, w: -8, bs: -30, be: 100, lf: [22, 0], lb: [-14, 0], d: 12, face: 'angry' },
      bonkA: { t: -6, hd: -6, fs: 175, fe: 0, w: 0, bs: -30, be: 110, lf: [14, 0], lb: [-14, 0], d: 6, face: 'angry' },
      bonkB: { t: 40, hd: -20, x: 8, fs: 70, fe: 0, w: 0, bs: -40, be: 110, lf: [22, 0], lb: [-14, 0], d: 14, face: 'angry' },
      yarnA: { t: 36, hd: -20, fs: 35, fe: 25, w: 3, bs: -70, be: 20, handB: 'open', lf: [16, 0], lb: [-14, 0], d: 20 },
      yarnB: { t: 44, hd: -24, x: 4, fs: 35, fe: 25, w: 8, bs: 60, be: 0, handB: 'open', lf: [20, 0], lb: [-14, 0], d: 24 },
      teaA: { t: 20, hd: -10, fs: 20, fe: 110, bs: 30, be: 100, handB: 'open', lf: [14, 0], lb: [-12, 0], d: 8, prop: 'cup', face: 'happy' },
      teaB: { t: 12, hd: -30, fs: 0, fe: 150, bs: 30, be: 110, handB: 'open', lf: [14, 0], lb: [-12, 0], d: 6, prop: 'cup', face: 'cool' },
      pogo: { t: 6, hd: -8, fs: 20, fe: -10, w: 0, bs: 30, be: -10, handB: 'open', fh: 70, fk: 110, bh: 50, bk: 110 },
      // throw
      pinchA: { t: 26, hd: -12, fs: 35, fe: 25, w: -5, bs: 80, be: 30, handB: 'open', lf: [16, 0], lb: [-14, 0], d: 10, face: 'happy' },
      pinchB: { $: 'pinchA', bs: 86, be: 18, t: 24, x: 3 },
      pushA: { t: 34, hd: -14, x: 8, fs: 35, fe: 25, bs: 90, be: 0, handB: 'open', lf: [22, 0], lb: [-14, 0], d: 12, face: 'angry' },
      // super
      rushA: { t: 44, hd: -24, fs: -30, fe: 60, w: 44, bs: -60, be: 100, lf: [18, 0], lb: [-16, 0], d: 24 },
      rushB: { t: 46, hd: -26, x: 10, fs: 88, fe: 0, w: 0, bs: -70, be: 80, lf: [28, 0], lb: [-20, 8], d: 22, face: 'angry' },
      wrathA: { t: 4, hd: -4, fs: 40, fe: 30, w: -28, bs: -40, be: 120, lf: [16, 0], lb: [-14, 0], d: 6, face: 'angry' },
      wrathB: { t: -6, hd: -2, fs: 165, fe: 5, w: 0, bs: -40, be: 120, lf: [16, 0], lb: [-14, 0], d: 4, face: 'angry', fx: 'glint' },
      barrageA: { t: 24, hd: -12, x: 6, fs: 80, fe: 5, w: 0, bs: -30, be: 100, lf: [22, 0], lb: [-14, 0], d: 12, face: 'angry', fx: 'barrage' },
      barrageB: { t: 30, hd: -14, x: 10, fs: 100, fe: -5, w: -6, bs: -30, be: 100, lf: [24, 0], lb: [-14, 0], d: 12, face: 'angry', fx: 'barrage' },
      bigBonkA: { t: -10, hd: -2, fs: 178, fe: 0, w: 0, bs: 150, be: 10, handB: 'open', lf: [14, 0], lb: [-16, 0], d: 4, face: 'angry' },
      bigBonkB: { t: 46, hd: -24, x: 14, fs: 66, fe: 0, w: 0, bs: 60, be: 10, lf: [26, 0], lb: [-14, 0], d: 18, face: 'angry' },
      glasses: { $: 'stance', hd: -12, d: 6, face: 'cool', fx: 'glint' },
      // personality
      win: { t: 16, hd: -10, fs: 150, fe: 10, w: 0, bs: -40, be: 120, lf: [12, 0], lb: [-12, 0], d: 4, face: 'happy' },
      win2: { t: 50, hd: 10, fs: 40, fe: 20, w: 10, bs: -30, be: 110, lf: [12, 0], lb: [-12, 0], d: 10, face: 'happy' },
      // reactions keep the cane out of the floor
      hurt: { t: -20, hd: 16, fs: -10, fe: 40, w: 60, bs: -40, be: 30, lf: [16, 0], lb: [-34, 0], d: 10, face: 'hurt' },
      hurt2: { t: 32, hd: 14, fs: 30, fe: 40, w: 30, bs: 10, be: 40, lf: [14, 0], lb: [-30, 0], d: 16, face: 'hurt' },
      churt: { t: -8, hd: 16, fs: 10, fe: 60, w: 40, bs: -10, be: 50, lf: [22, 0], lb: [-26, 0], d: 26, face: 'hurt' },
      lose: { t: 30, hd: 28, fs: 20, fe: 8, w: -10, bs: -5, be: 8, lf: [12, 0], lb: [-12, 0], d: 6, face: 'sad' },
    },

    anims: {
      intro: { keys: [[0, 'teaB'], [36, 'teaB'], [48, 'teaA'], [62, 'stance', 'out'], [96, 'stance']] },
      win: { keys: [[0, 'stance'], [12, 'win', 'out'], [40, 'win'], [52, 'win2', 'out'], [80, 'win2']] },
    },

    moves: {
      '5L': {
        name: 'Cane Poke',
        anim: { keys: [[0, 'stance'], [3, '5L_a', 'out'], [6, '5L_b', 'snap'], [9, '5L_b'], [18, 'stance']] },
        hits: [{ at: [6, 8], limb: 'weaponTip', r: 12, dmg: 28, hs: 13, bs: 9, kb: [3, 0], sfx: 'cane' }],
        ai: { range: [0, 165], kind: 'poke' },
      },
      '2L': {
        name: 'Shin Tap',
        anim: { keys: [[0, 'crouch'], [3, '2L_a', 'out'], [6, '2L_b', 'snap'], [9, '2L_b'], [18, 'crouch']] },
        hits: [{ at: [6, 8], limb: 'weaponTip', r: 13, dmg: 22, level: 'low', hs: 13, bs: 9, kb: [3, 0], sfx: 'cane' }],
        ai: { range: [0, 165], kind: 'low' },
      },
      '5H': {
        name: 'Cane Swing',
        anim: { keys: [[0, 'stance'], [6, '5H_a', 'out'], [10, '5H_b', 'snap'], [13, '5H_c'], [20, '5H_c'], [32, 'stance']] },
        hits: [{ at: [10, 13], limb: 'weapon', r: 15, dmg: 74, hs: 20, bs: 15, kb: [7, 0], stop: 10, sfx: 'cane', spark: 'H' }],
        ai: { range: [40, 185], kind: 'poke' },
      },
      '2H': {
        name: 'Hook Sweep',
        anim: { keys: [[0, 'crouch'], [5, '2H_a', 'out'], [10, '2H_b', 'snap'], [14, '2H_b'], [30, 'crouch']] },
        hits: [{ at: [10, 13], limb: 'weaponTip', r: 15, dmg: 68, level: 'low', kd: true, kb: [2, 5], hs: 20, bs: 14, sfx: 'cane' }],
        ai: { range: [30, 165], kind: 'low' },
      },
      '6H': {
        name: 'Hop Bonk',
        anim: { keys: [[0, 'stance'], [6, '6H_a', 'out'], [10, '6H_b'], [16, '6H_c', 'snap'], [60, '6H_c']] },
        vel: [[8, 3, 7]],
        landEnd: true,
        landLag: 9,
        hits: [{ at: [16, 60], limb: 'weapon', r: 16, dmg: 60, level: 'high', hs: 19, bs: 13, kb: [4, 0], maxHits: 1, stop: 10, sfx: 'cane' }],
        ai: { range: [40, 205], kind: 'over' },
      },
      jL: {
        name: 'Air Poke',
        anim: { keys: [[0, 'jump'], [3, 'jL_a', 'out'], [5, 'jL_b', 'snap'], [11, 'jL_b'], [17, 'fall']] },
        hits: [{ at: [5, 10], limb: 'weaponTip', r: 13, dmg: 30, hs: 14, bs: 10, sfx: 'cane' }],
        ai: { kind: 'air' },
      },
      jH: {
        name: 'Flying Slipper',
        anim: { keys: [[0, 'jump'], [5, 'jH_a', 'out'], [7, 'jH_b', 'snap'], [15, 'jH_b'], [22, 'fall']] },
        hits: [{ at: [7, 14], limb: 'footF', r: 15, dmg: 60, hs: 18, bs: 14, kb: [5, 0] }],
        ai: { kind: 'air' },
      },
      '5S': {
        name: 'Patience',
        anim: { keys: [[0, 'stance'], [4, 'patience', 'out'], [28, 'patience'], [32, 'stance'], [40, 'stance']] },
        counter: [3, 28],
        onCounter: (f, att, h, src) => {
          if (!f.battle || h.super) return false;
          Sound.sfx('counter');
          Sound.sfx('gong', { vol: 0.5, pitch: 1.4 });
          FX.word(f.x + f.facing * 30, -f.y - 170, 'HMPH!', f.C.wordColor, 1.1);
          FX.ring(f.x + f.facing * 40, -f.y - 90, 90, '#ffffff', 10);
          f.battle.shake(5);
          if (src !== att) {
            FX.hitSpark(src.x, -src.y, 'L', -f.facing, false, '#ffffff');
            if (!src.noReflect && src.vx !== 0) {
              // TOK! batted straight back at whoever threw it
              src.owner = f;
              src.vx = Math.abs(src.vx) * 1.25 * f.facing;
              src.vy = 0;
              src.grav = 0;
              src.facing = f.facing;
              src.hits += 1; // the hit that was just parried doesn't count
              src.lastHit = -999;
              src.life = Math.max(src.life, src.age + 90);
              FX.word(src.x, -src.y - 40, 'TOK!', '#ffe08a', 0.9);
            } else src.kill('parry');
            f.addMeter(8);
            f.mf = Math.max(f.mf, 29);
            return;
          }
          if (Math.abs(att.x - f.x) < 280 && att.y < 140) f.startSeq(f.C.moves['5S'].counterSeq, att);
          else f.mf = Math.max(f.mf, 29);
        },
        counterSeq: {
          len: 44,
          anim: { keys: [[0, 'parry'], [4, 'pokeA', 'snap'], [6, 'pokeB', 'snap'], [8, 'pokeA', 'snap'], [10, 'pokeB', 'snap'], [12, 'pokeA', 'snap'], [14, 'pokeB', 'snap'],
            [16, 'pokeA', 'snap'], [18, 'pokeB', 'snap'], [23, 'bonkA', 'out'], [27, 'bonkB', 'snap'], [36, 'bonkB'], [44, 'stance']] },
          vic: [[0, 'hurt', 84, 0], [6, 'hurt2', 86, 0], [10, 'hurt', 88, 0], [14, 'hurt2', 90, 0], [18, 'hurt', 92, 0], [27, 'hurtAir', 104, 20], [44, 'hurtAir', 116, 28]],
          hits: { 5: { dmg: 14, sfx: 'cane', stop: 2 }, 9: { dmg: 14, sfx: 'cane', stop: 2 }, 13: { dmg: 14, sfx: 'cane', stop: 2 }, 17: { dmg: 14, sfx: 'cane', stop: 2 },
            27: { dmg: 46, sfx: 'hitH', stop: 10, shake: 8, word: 'BONK!' } },
          onStart: (a, v) => {
            a.seqX = v.x - a.seqFacing * 84;
          },
          release: { vx: 7, vy: 9, kd: true },
          recover: 10,
        },
        ai: { kind: 'counter', range: [0, 260] },
        desc: 'Counter stance',
      },
      '6S': {
        name: 'Yarn Ball',
        cond: (f) => !f.data.yarnOut,
        anim: { keys: [[0, 'stance'], [6, 'yarnA', 'out'], [13, 'yarnB', 'snap'], [24, 'yarnB'], [36, 'stance']] },
        ev: { 13: (f) => spawnYarn(f) },
        ai: { range: [140, 700], kind: 'proj' },
        desc: 'Rolls low',
      },
      '2S': {
        name: 'Tea Time',
        anim: { keys: [[0, 'stance'], [8, 'teaA', 'out'], [14, 'teaB'], [44, 'teaB'], [52, 'teaA'], [62, 'stance']] },
        tick(f, mf) {
          if (mf === 10) Sound.sfx('sip');
          if (mf >= 14 && mf <= 44) {
            f.hp = Math.min(f.maxHp, f.hp + 2);
            f.redHp = Math.max(f.redHp, f.hp);
            f.addMeter(0.5);
            steam(f);
            if (mf % 10 === 4 && f.battle) FX.add({ type: 'heart', x: f.x + U.rand(-20, 20), y: -f.y - 140, vx: 0, vy: -1, size: 8, life: 30, color: '#ff8fb1' });
          }
          if (mf === 44) Sound.sfx('heal');
        },
        ai: { kind: 'heal', range: [380, 2000] },
        desc: 'Heals a little',
      },
      jS: {
        name: 'Cane Pogo',
        anim: { keys: [[0, 'jump'], [3, 'pogo', 'snap'], [60, 'pogo']] },
        vel: [[3, 5.5, -10]],
        grav: 0, gravAt: [3, 60],
        landLag: 9,
        hits: [{ at: [4, 60], limb: 'weaponTip', r: 16, dmg: 52, hs: 17, bs: 12, kb: [4, 0], maxHits: 1, sfx: 'cane' }],
        onHit: (f) => {
          f.vx = -2 * f.facing;
          f.vy = 10;
          Sound.sfx('boing', { pitch: 0.9 });
          f.endMove();
        },
        ai: { kind: 'airS' },
      },
      SUP: {
        name: "GRANDMA'S WRATH",
        inv: [0, 14],
        anim: { keys: [[0, 'squat'], [6, 'rushA', 'out'], [10, 'rushB', 'snap'], [26, 'rushB'], [32, 'stance'], [42, 'stance']] },
        vel: [[8, 15], [24, 2], [30, 0]],
        keepVel: true,
        trail: [8, 24],
        hits: [{ at: [10, 25], cap: [16, -50, 64, -96], r: 30, dmg: 20, seq: true, super: true, spark: 'S', sfx: 'cane',
          onBlock: (f) => {
            f.vx = -3 * f.facing;
            f.mf = Math.max(f.mf, 26);
          } }],
        seqHit: {
          len: 72,
          anim: { keys: barrageKeys },
          vic: barrageVic,
          hits: barrageHits,
          ev: {
            0: (a) => {
              Sound.sfx('gong');
              if (a.battle) a.battle.shake(6);
            },
            6: (a) => a.battle && FX.word(a.x + a.seqFacing * 20, -200, 'HYAAA!', a.C.wordColor, 1.2),
            55: () => Sound.sfx('whoosh', { pitch: 0.8 }),
          },
          onStart: (a, v) => {
            a.seqX = v.x - a.seqFacing * 80;
          },
          release: { vx: 10, vy: 7, kd: true, spin: -40 },
          recover: 28,
          recoverAnim: { keys: [[0, 'bigBonkB'], [8, 'stance', 'out'], [12, 'glasses'], [28, 'glasses']] },
        },
        ai: { kind: 'super', range: [0, 380] },
      },
      THROW: {
        name: 'Cheek Pinch',
        throw: true,
        throwAt: 3,
        anim: { keys: [[0, 'stance'], [3, 'throwReach'], [9, 'throwWhiff'], [24, 'stance']] },
        seq: {
          len: 46,
          tech: true,
          anim: { keys: [[0, 'pinchA'], [8, 'pinchB'], [12, 'pinchA'], [16, 'pinchB'], [20, 'pinchA'], [24, 'pinchB'], [32, 'pushA', 'snap'], [46, 'stance']] },
          vic: [[0, 'grabbed', 46, 0], [8, 'hurt', 48, 0], [12, 'hurt2', 46, 0], [16, 'hurt', 48, 0], [20, 'hurt2', 46, 0], [24, 'hurt', 48, 0], [32, 'hurtAir', 72, 22], [46, 'hurtAir', 84, 30]],
          hits: { 9: { dmg: 12, sfx: 'pop', stop: 2 }, 17: { dmg: 12, sfx: 'pop', stop: 2 }, 25: { dmg: 12, sfx: 'pop', stop: 2 }, 32: { dmg: 60, sfx: 'hitH', shake: 6, stop: 6, word: 'HMPH!' } },
          release: { vx: 8, vy: 7 },
          recover: 12,
        },
      },
    },

    // ---- drawing ----------------------------------------------------------------
    draw: {
      behind(ctx, f, J, pal) {
        // how big she is on screen decides how fine the detail goes
        PX = pxPer(ctx);
        // aura during the counter stance
        if (J.P.fx === 'aura') {
          const t = f.t || 0;
          ctx.save();
          ctx.globalAlpha = 0.18 + 0.08 * Math.sin(t * 0.3);
          Draw.ellipse(ctx, J.neck[0], J.neck[1] + 10, 64, 80, 0, '#fff6c8', 0);
          ctx.globalAlpha = 0.5;
          ctx.strokeStyle = '#ffe08a';
          ctx.lineWidth = 3;
          ctx.setLineDash([10, 12]);
          ctx.lineDashOffset = -t * 0.8;
          ctx.beginPath();
          ctx.ellipse(J.neck[0], J.neck[1] + 10, 70, 86, 0, 0, TAU);
          ctx.stroke();
          ctx.restore();
        }
      },
      skirt(ctx, f, J, pal) {
        const lw = f.C.lw;
        const P = J.P;
        const fine = PX > 1.3;
        const rot = (P.r || 0) * D2R + (P.t || 0) * D2R * 0.3;
        ctx.save();
        ctx.translate(J.hip[0], J.hip[1]);
        ctx.rotate(rot);
        // a lace petticoat peeking out under the hem
        const sc = 25 / 7;
        ctx.beginPath();
        ctx.moveTo(-25, 20);
        ctx.lineTo(25, 20);
        ctx.lineTo(25, 24.6);
        for (let i = 0; i < 7; i++) ctx.arc(25 - sc * (2 * i + 1), 24.6, sc, 0, Math.PI);
        ctx.closePath();
        ctx.fillStyle = pal.cupL;
        ctx.fill();
        if (fine) {
          ctx.beginPath();
          for (let i = 0; i < 7; i++) dot(ctx, 25 - sc * (i * 2 + 1), 25.8, 0.7);
          ctx.fillStyle = pal.ink;
          ctx.fill();
        }
        ctx.beginPath();
        ctx.moveTo(-18, -6);
        ctx.lineTo(18, -6);
        ctx.quadraticCurveTo(26, 10, 25, 24);
        ctx.lineTo(-25, 24);
        ctx.quadraticCurveTo(-26, 10, -18, -6);
        ctx.closePath();
        Draw.fillStroke(ctx, pal.dress, lw, pal.ink);
        ctx.save();
        ctx.clip();
        ctx.fillStyle = pal.dark.dress;
        ctx.fillRect(-30, -10, 12, 40);
        // a little floral print
        ctx.beginPath();
        petals(ctx, [[-10, 13, 0.2], [3, 8, 0.7], [14, 14, 0.4], [-3, 20, 1], [8, 20.5, 0.1], [-14, 6, 0.5], [20, 7, 0.9]], 1.5);
        ctx.fillStyle = flat(pal.glasses);
        ctx.fill();
        ctx.beginPath();
        for (const [x, y] of [[-10, 13], [3, 8], [14, 14], [-3, 20], [8, 20.5], [-14, 6], [20, 7]]) dot(ctx, x, y, 0.9);
        for (const [x, y] of [[-4, 10], [9, 13], [-15, 16], [17, 20], [-8, 5]]) dot(ctx, x, y, 0.8);
        ctx.fillStyle = flat(pal.cupL);
        ctx.fill();
        ctx.restore();
        // folds, the side slit and the hem ribbon
        ctx.beginPath();
        ctx.moveTo(-12, 23.6);
        ctx.quadraticCurveTo(-10.8, 18, -12.6, 12.5);
        ctx.moveTo(3, 23.6);
        ctx.quadraticCurveTo(4.2, 19.5, 2.6, 15.5);
        ctx.moveTo(14, 24);
        ctx.lineTo(12, 10);
        stroke(ctx, pal.ink, 1.4);
        ctx.beginPath();
        ctx.moveTo(-23, 21);
        ctx.lineTo(23, 21);
        stroke(ctx, pal.trim, 3);
        if (fine) {
          ctx.beginPath();
          ctx.moveTo(-22, 21);
          ctx.lineTo(22, 21);
          ctx.setLineDash([1.4, 1.6]);
          stroke(ctx, pal.ink, 0.7);
          ctx.setLineDash([]);
        }
        ctx.restore();
      },
      torso(ctx, f, J, pal) {
        const T = f.C.body.torso, lw = f.C.lw;
        const fine = PX > 1.3;
        // round, hunched body in a cable-knit cardigan
        const shape = () => {
          ctx.beginPath();
          ctx.moveTo(-22, 8);
          ctx.quadraticCurveTo(-30, -18, -20, -T + 2);
          ctx.quadraticCurveTo(-8, -T - 8, 8, -T - 4);
          ctx.quadraticCurveTo(26, -T + 2, 26, -14);
          ctx.quadraticCurveTo(27, 2, 22, 8);
          ctx.closePath();
        };
        shape();
        Draw.fillStroke(ctx, pal.cardigan, lw, pal.ink);
        ctx.save();
        shape();
        ctx.clip();
        ctx.fillStyle = pal.dark.cardigan;
        ctx.beginPath();
        ctx.ellipse(-26, -14, 14, 34, 0.1, 0, TAU);
        ctx.fill();
        // knit: purl ridges between two rope cables
        ctx.beginPath();
        for (const x of [-20, -10.5, -3.5, 6.5]) {
          ctx.moveTo(x, -T - 6);
          ctx.lineTo(x + 1.2, 4);
        }
        stroke(ctx, pal.dark.cardigan, 1.5);
        const cables = [-15.2, 1.5];
        ctx.beginPath();
        for (const xc of cables) {
          for (let y = -T - 4; y < 2; y += 5.5) {
            ctx.moveTo(xc - 2.6, y + 3.6);
            ctx.quadraticCurveTo(xc - 2.2, y - 0.6, xc + 2.6, y - 0.4);
          }
        }
        stroke(ctx, pal.cardiganL, 1.4);
        ctx.beginPath();
        for (const xc of cables) {
          for (let y = -T - 4; y < 2; y += 5.5) {
            ctx.moveTo(xc - 2.8, y + 5.4);
            ctx.quadraticCurveTo(xc + 2.4, y + 4.6, xc + 2.8, y + 0.6);
          }
        }
        stroke(ctx, pal.ink, 1.1);
        // ribbed hem
        ctx.beginPath();
        ctx.rect(-34, 1.6, 46, 9);
        ctx.fillStyle = pal.cardiganL;
        ctx.fill();
        ctx.beginPath();
        for (let x = -27; x < 11; x += 2.7) {
          ctx.moveTo(x, 2.9);
          ctx.lineTo(x + 0.2, 7.6);
        }
        stroke(ctx, tone(pal.cardiganL, pal.ink, 0.5), 1.1);
        // the qipao peeking out at the front, with its print and frog buttons
        ctx.beginPath();
        ctx.moveTo(6, -T - 6);
        ctx.quadraticCurveTo(22, -T, 24, -14);
        ctx.lineTo(24, 10);
        ctx.lineTo(10, 10);
        ctx.quadraticCurveTo(14, -16, 6, -T - 6);
        ctx.closePath();
        Draw.fillStroke(ctx, pal.dress, lw * 0.7, pal.ink);
        ctx.beginPath();
        petals(ctx, [[19.5, -37, 0.3], [16.5, -8, 0.9], [21, 2, 0.5]], 1.3);
        ctx.fillStyle = flat(pal.glasses);
        ctx.fill();
        ctx.beginPath();
        for (const y of [-T + 10, -T + 20]) {
          ctx.moveTo(10, y);
          ctx.lineTo(22, y);
        }
        stroke(ctx, pal.trim, 2);
        ctx.beginPath();
        for (const y of [-T + 10, -T + 20]) dot(ctx, 16, y, 2.6);
        Draw.fillStroke(ctx, pal.trim, 1.6, pal.ink);
        if (fine) {
          // the knotted loops of the frogs
          ctx.beginPath();
          for (const y of [-T + 10, -T + 20]) {
            ctx.moveTo(13.4, y);
            ctx.ellipse(11.8, y, 1.6, 1.3, 0, 0, TAU);
            ctx.moveTo(21.8, y);
            ctx.ellipse(20.2, y, 1.6, 1.3, 0, 0, TAU);
          }
          stroke(ctx, pal.ink, 0.8);
        }
        ctx.restore();
        // cardigan edge with pearly buttons
        ctx.strokeStyle = pal.cardiganL;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(6, -T - 4);
        ctx.quadraticCurveTo(14, -16, 10, 8);
        ctx.stroke();
        const B = [[9.7, -27.6], [11.2, -14.4], [11.1, -1.8]];
        ctx.beginPath();
        for (const [x, y] of B) dot(ctx, x, y, 2.3);
        Draw.fillStroke(ctx, pal.cupL, 1.2, pal.ink);
        if (fine) {
          ctx.beginPath();
          for (const [x, y] of B) {
            ctx.moveTo(x - 0.9, y - 0.6);
            ctx.lineTo(x + 0.9, y + 0.6);
            ctx.moveTo(x - 0.9, y + 0.6);
            ctx.lineTo(x + 0.9, y - 0.6);
          }
          stroke(ctx, pal.ink, 0.7);
        }
        // a hanky tucked into the pocket
        ctx.beginPath();
        ctx.moveTo(-12.6, -14);
        ctx.lineTo(-11.8, -20.8);
        ctx.lineTo(-8.6, -17.6);
        ctx.lineTo(-5.2, -22.4);
        ctx.lineTo(-3, -17.2);
        ctx.lineTo(-1.4, -14);
        ctx.closePath();
        Draw.fillStroke(ctx, pal.cupL, lw * 0.6, pal.ink);
        ctx.beginPath();
        dot(ctx, -9.4, -16, 0.9);
        dot(ctx, -5.4, -19.2, 0.9);
        dot(ctx, -3.6, -15.4, 0.7);
        ctx.fillStyle = flat(pal.pin);
        ctx.fill();
        Draw.roundRect(ctx, -14, -16, 14, 12, 3, pal.cardiganL, lw * 0.6, pal.ink);
        ctx.beginPath();
        for (let x = -12; x < -1; x += 2.2) {
          ctx.moveTo(x, -15);
          ctx.lineTo(x, -12.6);
        }
        stroke(ctx, tone(pal.cardiganL, pal.ink, 0.5), 1);
        if (fine) {
          ctx.beginPath();
          ctx.moveTo(-12.4, -11.6);
          ctx.lineTo(-12.4, -6.4);
          ctx.quadraticCurveTo(-12.4, -5.4, -11.4, -5.4);
          ctx.lineTo(-2.6, -5.4);
          ctx.quadraticCurveTo(-1.6, -5.4, -1.6, -6.4);
          ctx.lineTo(-1.6, -11.6);
          ctx.setLineDash([1.3, 1.3]);
          stroke(ctx, pal.ink, 0.7);
          ctx.setLineDash([]);
        }
        // mandarin collar and a cameo brooch
        Draw.roundRect(ctx, -2, -T - 8, 20, 7, 3, pal.trim, lw * 0.7, pal.ink);
        ctx.beginPath();
        ctx.ellipse(1.5, -T + 0.5, 3.4, 4.1, 0.2, 0, TAU);
        Draw.fillStroke(ctx, pal.glasses, 1.2, pal.ink);
        ctx.beginPath();
        ctx.ellipse(1.5, -T + 0.5, 2.1, 2.8, 0.2, 0, TAU);
        ctx.fillStyle = flat(pal.cupL);
        ctx.fill();
        ctx.beginPath();
        if (fine) {
          // the lady on the cameo
          ctx.moveTo(1.2, -T - 1.6);
          ctx.quadraticCurveTo(2.6, -T - 0.4, 1.8, -T + 0.6);
          ctx.quadraticCurveTo(1, -T + 1.8, 1.8, -T + 2.6);
        }
        ctx.moveTo(-0.4, -T - 1.8);
        ctx.lineTo(-0.2, -T - 2.2);
        stroke(ctx, fine ? pal.ink : '#ffffff', 0.8);
      },
      head(ctx, f, J, pal, fc) {
        const lw = f.C.lw;
        const k = f.isPortrait ? pxPer(ctx) : PX * (f.C.headScale || 1);
        const fine = k > 1.1;
        // bun stuck through with two knitting needles
        ctx.save();
        ctx.translate(-12, -30);
        ctx.rotate(-0.2);
        Draw.line(ctx, -14, 8, 16, -12, 3, pal.pin, 2, pal.ink);
        Draw.line(ctx, -10, -12, 14, 6, 3, pal.pin, 2, pal.ink);
        Draw.circle(ctx, 0, 0, 13, pal.hair, lw, pal.ink);
        ctx.beginPath();
        ctx.moveTo(7 * Math.cos(0.4), 7 * Math.sin(0.4));
        ctx.arc(0, 0, 7, 0.4, 2.6);
        ctx.moveTo(-9.6, -4.4);
        ctx.quadraticCurveTo(-4, -10.6, 4.6, -9);
        stroke(ctx, pal.hairS, 2.4);
        // the coil
        ctx.beginPath();
        ctx.moveTo(-11.2, -1.6);
        ctx.quadraticCurveTo(-8.8, -11.6, 1.6, -11.8);
        ctx.moveTo(-6.4, 1.6);
        ctx.quadraticCurveTo(-6, -6.8, 2, -6.8);
        ctx.quadraticCurveTo(8, -6.2, 8.4, 0.4);
        ctx.moveTo(5.6, -10.8);
        ctx.quadraticCurveTo(10.8, -7.6, 11.6, -1.4);
        if (fine) {
          ctx.moveTo(-2.4, -1.6);
          ctx.quadraticCurveTo(0.6, -4, 3, -1.4);
        }
        stroke(ctx, pal.ink, 1.6);
        // needle knobs
        ctx.beginPath();
        dot(ctx, 16, -12, 3.2);
        dot(ctx, -10, -12, 2.5);
        Draw.fillStroke(ctx, pal.pin, 1.8, pal.ink);
        if (fine) {
          ctx.beginPath();
          dot(ctx, 15, -13, 0.9);
          dot(ctx, -10.7, -12.8, 0.7);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
        }
        ctx.restore();
        // back hair
        ctx.beginPath();
        ctx.moveTo(-28, 12);
        ctx.quadraticCurveTo(-36, -12, -20, -26);
        ctx.quadraticCurveTo(0, -38, 20, -26);
        ctx.quadraticCurveTo(30, -16, 28, -2);
        ctx.lineTo(-28, 12);
        ctx.closePath();
        Draw.fillStroke(ctx, pal.hair, lw, pal.ink);
        // combed back toward the bun
        ctx.beginPath();
        ctx.moveTo(-31, -3);
        ctx.quadraticCurveTo(-31, -16, -19.5, -24.5);
        stroke(ctx, pal.hairS, 2.4);
        ctx.beginPath();
        ctx.moveTo(-26.6, 7);
        ctx.quadraticCurveTo(-30.4, -9, -19.6, -20.4);
        ctx.moveTo(18.6, -26.8);
        ctx.quadraticCurveTo(7, -34, -5, -32.6);
        if (fine) {
          // flyaways
          ctx.moveTo(9, -31.2);
          ctx.quadraticCurveTo(11.5, -36.6, 16.2, -34.4);
          ctx.moveTo(-31.6, 4);
          ctx.quadraticCurveTo(-37, 6, -34.6, 11);
        }
        stroke(ctx, pal.ink, 1.6);
        // a beaded chain for the glasses, hanging behind the ear
        ctx.beginPath();
        ctx.moveTo(-14.6, 3.6);
        ctx.bezierCurveTo(-23, 12, -22.4, 26, -11.5, 33);
        if (fine) stroke(ctx, pal.ink, 0.8);
        ctx.setLineDash([0.2, 3.1]);
        stroke(ctx, pal.glasses, 2.4);
        ctx.setLineDash([]);
        // face
        Draw.ellipse(ctx, 5, 7, 23, 23, 0, pal.skin, lw, pal.ink);
        // ear, and a pearl drop earring on a gold stud
        Draw.ellipse(ctx, -14, 10, 5, 7, 0.2, pal.skin, lw * 0.8, pal.ink);
        ctx.beginPath();
        ctx.moveTo(-12.4, 5.2);
        ctx.quadraticCurveTo(-17.6, 6, -15.8, 11.6);
        ctx.quadraticCurveTo(-15, 14, -12.8, 13.2);
        stroke(ctx, pal.ink, 1.5);
        Draw.circle(ctx, -14.8, 16.4, 1.7, pal.glasses, 1.2, pal.ink);
        Draw.circle(ctx, -15.2, 21, 3, pal.cupL, 1.8, pal.ink);
        if (fine) {
          ctx.beginPath();
          dot(ctx, -16.2, 20, 0.9);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
        }
        // hair framing the forehead (neat side part, set in waves)
        ctx.beginPath();
        ctx.moveTo(-20, 4);
        ctx.quadraticCurveTo(-22, -16, -6, -20);
        ctx.quadraticCurveTo(14, -24, 26, -10);
        ctx.quadraticCurveTo(16, -12, 6, -8);
        ctx.quadraticCurveTo(-8, -6, -14, 6);
        ctx.closePath();
        Draw.fillStroke(ctx, pal.hair, lw * 0.8, pal.ink);
        ctx.beginPath();
        ctx.moveTo(-12, -6);
        ctx.quadraticCurveTo(-4, -16, 12, -18);
        ctx.moveTo(8, -12.4);
        ctx.quadraticCurveTo(15, -15.4, 22, -13.4);
        stroke(ctx, pal.hairS, 2);
        ctx.beginPath();
        ctx.moveTo(-17.4, 1);
        ctx.quadraticCurveTo(-17, -9.4, -8.4, -13.4);
        ctx.moveTo(-3, -16.4);
        ctx.quadraticCurveTo(6, -20.6, 16, -17.6);
        ctx.moveTo(4, -10.2);
        ctx.quadraticCurveTo(12, -13.6, 21, -11.6);
        stroke(ctx, pal.ink, 1.6);
        face(ctx, f, pal, fc, lw, J.P && J.P.fx === 'glint', k);
      },
      caneUp(ctx, f, J, pal) {
        if (raised(J)) f.C.draw.cane(ctx, f, J, pal, true);
      },
      armUp(ctx, f, J, pal) {
        if (raised(J)) Rig.drawArm(ctx, f, J, 'F', pal);
      },
      armDown(ctx, f, J, pal) {
        if (!raised(J)) Rig.drawArm(ctx, f, J, 'F', pal);
      },
      // cardigan sleeves with darned elbow patches and ribbed cuffs
      arm(ctx, f, J, side, pc, pal) {
        const C = f.C, b = C.body, back = side === 'B', P = J.P;
        const s = back ? J.sB : J.sF, e = back ? J.eB : J.eF, h = back ? J.hB : J.hF;
        const r0 = b.armR[0], r1 = b.armR[1], r2 = b.armR[2];
        Rig.limb(ctx, s, e, h, r0, r1, r2, pc.cardigan, pc.cardigan, C.lw, pal.ink);
        const ux = s[0] - e[0], uy = s[1] - e[1], vx = h[0] - e[0], vy = h[1] - e[1];
        const lu = Math.hypot(ux, uy) || 1, lv = Math.hypot(vx, vy) || 1;
        let ox = -(ux / lu + vx / lv), oy = -(uy / lu + vy / lv);
        let ol = Math.hypot(ox, oy);
        if (ol < 0.25) {
          // nearly straight: the patch sits underneath
          ox = -vy / lv;
          oy = vx / lv;
          if (oy < 0) {
            ox = -ox;
            oy = -oy;
          }
          ol = 1;
        }
        const px = e[0] + (ox / ol) * r1 * 0.32, py = e[1] + (oy / ol) * r1 * 0.32;
        const pa = Math.atan2(h[1] - s[1], h[0] - s[0]);
        ctx.beginPath();
        ctx.ellipse(px, py, r1 * 0.95, r1 * 0.72, pa, 0, TAU);
        ctx.fillStyle = tone(pc.cardigan, pal.ink, 0.24);
        ctx.fill();
        if (PX > 1.3) {
          ctx.beginPath();
          ctx.ellipse(px, py, r1 * 0.68, r1 * 0.46, pa, 0, TAU);
          ctx.setLineDash([1.2, 1.3]);
          stroke(ctx, tone(pc.cardigan, '#ffffff', 0.45), 0.8);
          ctx.setLineDash([]);
        }
        Rig.band(ctx, e, h, r1, r2, 0.62, 1.0, pc.cardiganL, C.lw, pal.ink);
        // ribs along the cuff
        const nx = -vy / lv, ny = vx / lv, rc = r1 + (r2 - r1) * 0.8;
        ctx.beginPath();
        for (const o of [-0.62, -0.2, 0.22, 0.64]) {
          ctx.moveTo(e[0] + vx * 0.67 + nx * o * rc, e[1] + vy * 0.67 + ny * o * rc);
          ctx.lineTo(e[0] + vx * 0.9 + nx * o * rc, e[1] + vy * 0.9 + ny * o * rc);
        }
        stroke(ctx, tone(pc.cardiganL, pal.ink, 0.5), 1);
        const hs = back ? P.handB || C.handDef : P.hand || C.handDef;
        if (hs !== 'none') Rig.drawHand(ctx, f, J, e, h, hs, pc.skin, pal, back);
      },
      // old hands: knuckle wrinkles, tendons, an age spot and her wedding ring
      hand(ctx, f, J, e, h, style, col, pal, back) {
        const C = f.C, r = C.body.handR;
        const fine = PX > 1.3;
        const ang = Math.atan2(h[1] - e[1], h[0] - e[0]);
        ctx.save();
        ctx.translate(h[0], h[1]);
        ctx.rotate(ang);
        let ring;
        if (style === 'open') {
          Draw.ellipse(ctx, r * 0.35, 0, r * 1.15, r * 0.85, 0, col, C.lw, pal.ink);
          Draw.ellipse(ctx, r * 0.2, -r * 0.85, r * 0.42, r * 0.3, -0.5, col, C.lw * 0.7, pal.ink);
          ctx.beginPath();
          for (const y of [-0.3, 0.08, 0.44]) {
            ctx.moveTo(r * 0.98, y * r);
            ctx.lineTo(r * 1.42, y * r * 1.1);
          }
          if (fine) {
            ctx.moveTo(r * 0.72, -0.5 * r);
            ctx.quadraticCurveTo(r * 0.82, -0.32 * r, r * 0.74, -0.14 * r);
            ctx.moveTo(r * 0.74, 0.18 * r);
            ctx.quadraticCurveTo(r * 0.84, 0.32 * r, r * 0.76, 0.5 * r);
          }
          stroke(ctx, pal.ink, C.lw * 0.45);
          ring = [r * 0.86, 0.12 * r, r * 0.86, 0.42 * r];
        } else {
          Draw.circle(ctx, r * 0.15, 0, r, col, C.lw, pal.ink);
          // knuckles, the fingers curled under them and a thumb
          ctx.beginPath();
          ctx.moveTo(r * 0.15 + Math.cos(-0.9) * r * 0.55, Math.sin(-0.9) * r * 0.55);
          ctx.arc(r * 0.15, 0, r * 0.55, -0.9, 0.9);
          for (const y of [-0.42, 0, 0.42]) {
            ctx.moveTo(r * 0.72, y * r);
            ctx.lineTo(r * 1.08, y * r * 1.12);
          }
          ctx.moveTo(-r * 0.45, -r * 0.55);
          ctx.quadraticCurveTo(r * 0.2, -r * 0.95, r * 0.62, -r * 0.42);
          stroke(ctx, pal.ink, C.lw * 0.5);
          if (fine) {
            // knuckle wrinkles and tendons
            ctx.beginPath();
            for (const y of [-0.62, -0.21, 0.21, 0.62]) {
              ctx.moveTo(r * 0.86, (y - 0.09) * r);
              ctx.quadraticCurveTo(r * 0.94, y * r, r * 0.86, (y + 0.09) * r);
            }
            ctx.moveTo(-r * 0.55, -r * 0.12);
            ctx.quadraticCurveTo(-r * 0.1, -r * 0.24, r * 0.3, -r * 0.2);
            ctx.moveTo(-r * 0.5, r * 0.2);
            ctx.quadraticCurveTo(-r * 0.1, r * 0.14, r * 0.3, r * 0.2);
            stroke(ctx, pal.ink, 0.7);
            ctx.beginPath();
            dot(ctx, -r * 0.18, r * 0.5, r * 0.11);
            dot(ctx, r * 0.02, r * 0.62, r * 0.07);
            ctx.fillStyle = flat(tone(col, pal.ink, 0.2));
            ctx.fill();
          }
          ring = [r * 0.66, 0.04 * r, r * 0.62, 0.38 * r];
        }
        if (!back) {
          ctx.beginPath();
          ctx.moveTo(ring[0], ring[1]);
          ctx.lineTo(ring[2], ring[3]);
          stroke(ctx, pal.glasses, 1.8);
        }
        ctx.restore();
      },
      // stockings and knee-high socks rolled down to the ankle
      leg(ctx, f, J, side, pc, pal) {
        const C = f.C, b = C.body, back = side === 'B';
        const hp = back ? J.hipB : J.hipF, k = back ? J.kB : J.kF, a = back ? J.aB : J.aF, t = back ? J.tB : J.tF;
        const r1 = b.legR[1], r2 = b.legR[2];
        Rig.limb(ctx, hp, k, a, b.legR[0], r1, r2, pc.pants, pc.pants, C.lw, pal.ink);
        const dx = a[0] - k[0], dy = a[1] - k[1], L = Math.hypot(dx, dy) || 1;
        let nx = -dy / L, ny = dx / L;
        if (nx < 0) {
          nx = -nx;
          ny = -ny;
        }
        const at = (tt, o) => [k[0] + dx * tt + nx * o, k[1] + dy * tt + ny * o];
        const rad = (tt) => r1 + (r2 - r1) * tt;
        // a sheen down the front of the stocking
        ctx.beginPath();
        let q = at(0.12, rad(0.12) * 0.48);
        ctx.moveTo(q[0], q[1]);
        q = at(0.5, rad(0.5) * 0.44);
        ctx.lineTo(q[0], q[1]);
        stroke(ctx, tone(pc.pants, '#ffffff', 0.32), 1.5);
        Rig.band(ctx, k, a, r1, r2, 0.6, 1.0, pc.sock, C.lw, pal.ink);
        // the rolled top of the sock
        q = at(0.57, 0);
        const q2 = at(0.68, 0);
        ctx.beginPath();
        Draw.taper(ctx, q[0], q[1], rad(0.57) + 1.7, q2[0], q2[1], rad(0.68) + 1.5);
        ctx.fillStyle = pc.sock;
        ctx.fill();
        ctx.beginPath();
        for (const o of [-0.5, 0, 0.5]) {
          q = at(0.74, o * rad(0.8));
          ctx.moveTo(q[0], q[1]);
          q = at(0.94, o * rad(0.9));
          ctx.lineTo(q[0], q[1]);
        }
        stroke(ctx, tone(pc.sock, pal.ink, 0.35), 1);
        ctx.beginPath();
        q = at(0.68, -rad(0.68) - 1);
        ctx.moveTo(q[0], q[1]);
        let c = at(0.74, 0);
        q = at(0.68, rad(0.68) + 1);
        ctx.quadraticCurveTo(c[0], c[1], q[0], q[1]);
        q = at(0.6, -rad(0.6) * 0.6);
        ctx.moveTo(q[0], q[1]);
        c = at(0.64, -rad(0.6) * 0.2);
        q = at(0.62, rad(0.6) * 0.1);
        ctx.quadraticCurveTo(c[0], c[1], q[0], q[1]);
        stroke(ctx, pal.ink, 1.1);
        Rig.drawFoot(ctx, f, J, a, t, pc.shoe, pal, back);
      },
      cane(ctx, f, J, pal, up) {
        if (J.P.prop === 'cup' || !J.wTip || (!up && raised(J))) return;
        drawCane(ctx, pal, J.wEnd, J.hF, J.wTip, f.C.lw);
        if (J.P.fx === 'barrage') {
          // a flurry of ghost canes
          const t = f.t || 0;
          ctx.save();
          for (let i = 0; i < 3; i++) {
            const a = ((i - 1) * 0.35 + Math.sin(t * 1.7 + i) * 0.12);
            ctx.globalAlpha = 0.35;
            ctx.save();
            ctx.translate(J.sF[0], J.sF[1]);
            ctx.rotate(a);
            ctx.translate(-J.sF[0], -J.sF[1]);
            drawCane(ctx, pal, J.wEnd, J.hF, J.wTip, f.C.lw, true);
            ctx.restore();
          }
          ctx.restore();
        }
      },
      front(ctx, f, J, pal) {
        if (J.P.prop === 'cup') teacup(ctx, pal, J.hF[0] + 4, J.hF[1] - 6, f.C.lw, f.t || f.sf || 0);
      },
      // sensible shoes: a strap with a buckle, a stitched welt and a low heel
      foot(ctx, f, J, a, t, col, pal) {
        const ang = Math.atan2(t[1] - a[1], t[0] - a[0]);
        const L = Math.hypot(t[0] - a[0], t[1] - a[1]);
        const lw = f.C.lw;
        const fine = PX > 1.3;
        ctx.save();
        ctx.translate(a[0], a[1]);
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.rect(-8.4, 4.6, 7.4, 2.8);
        ctx.fillStyle = tone(col, pal.ink, 0.5);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-7, -5);
        ctx.quadraticCurveTo(L * 0.5, -8, L + 4, -2);
        ctx.quadraticCurveTo(L + 8, 4, L + 2, 6);
        ctx.lineTo(-8, 6);
        ctx.quadraticCurveTo(-10, 0, -7, -5);
        ctx.closePath();
        Draw.fillStroke(ctx, col, lw, pal.ink);
        ctx.fillStyle = tone(col, '#ffffff', 0.85);
        ctx.fillRect(-7, 3, L + 9, 2.6);
        // strap and buckle, toe cap
        ctx.beginPath();
        ctx.moveTo(L * 0.34, -6.2);
        ctx.lineTo(L * 0.48, 2.6);
        stroke(ctx, tone(col, pal.ink, 0.35), 2.8);
        ctx.beginPath();
        ctx.rect(L * 0.34 - 1.9, -5.4, 3.6, 3.4);
        stroke(ctx, pal.glasses, 1.1);
        ctx.beginPath();
        ctx.moveTo(L - 0.4, -5.4);
        ctx.quadraticCurveTo(L - 3.4, -1.2, L - 0.8, 2.8);
        if (fine) {
          // heel seam and tread
          ctx.moveTo(-1, 3.2);
          ctx.lineTo(-1, 5.4);
          for (let x = 2; x < L + 4; x += 3.2) {
            ctx.moveTo(x, 3.4);
            ctx.lineTo(x - 0.7, 5.4);
          }
        }
        stroke(ctx, pal.ink, 1);
        if (fine) {
          ctx.beginPath();
          ctx.moveTo(-6, 1.6);
          ctx.lineTo(L + 3.6, 1.4);
          ctx.setLineDash([1.4, 1.4]);
          stroke(ctx, tone(col, '#ffffff', 0.5), 0.8);
          ctx.setLineDash([]);
        }
        ctx.beginPath();
        ctx.moveTo(L - 3, -5.6);
        ctx.quadraticCurveTo(L + 1.6, -4.8, L + 3.6, -1.8);
        stroke(ctx, 'rgba(255,255,255,0.5)', 1.4);
        ctx.restore();
      },
    },

    update(f) {
      const P = f.pose;
      if (P && P.prop === 'cup' && (f.state === 'intro' || f.state === 'attack')) steam(f);
    },

    onReset(f) {
      f.data.yarnOut = false;
    },
  });
})();
