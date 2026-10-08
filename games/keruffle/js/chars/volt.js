'use strict';
// ---------------------------------------------------------------------------
// VOLT — tin can with a plan. A retro robot with a TV for a head, stretchy
// noodle arms and a lot of electricity. Zoner: chargeable Volt Balls, a
// returning Rocket Fist, hover lasers and the MEGA BEAM.
// ---------------------------------------------------------------------------
(() => {
  // ---- hand-drawn detail helpers ---------------------------------------------------
  // The mechanical detail (seams, screws, vents, scratches...) is built into
  // Path2D objects: those are drawn as they are, so the sketch pass never takes
  // a detail line for an outline, and many lines share one stroke.
  // Colors derived from a palette, cached per palette object (hit flashes and
  // the darker back-limb palettes are separate objects, so they stay in tune).
  const TONES = new WeakMap();
  function tones(p) {
    let t = TONES.get(p);
    if (!t) {
      t = {
        rust: U.rgba(U.mix(p.body, p.ink, 0.55), 0.85),
        bodyD: U.mix(p.body, p.ink, 0.32),
        bodyHi: U.rgba(U.mix(p.body, '#ffffff', 0.72), 0.9),
        metalD: U.mix(p.metal, p.ink, 0.42),
        metalHi: U.rgba(U.mix(p.metal, '#ffffff', 0.72), 0.85),
        handD: U.mix(p.hand, p.ink, 0.3),
        footHi: U.mix(p.foot, '#ffffff', 0.3),
        glowT: U.rgba(p.glow, 0.85),
        glowDim: U.mix(p.screen, p.glow, 0.25),
      };
      TONES.set(p, t);
    }
    return t;
  }
  // device pixels per local unit right now
  function devPx(ctx) {
    const m = ctx.getTransform();
    return Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
  }
  function inkStroke(ctx, path, w, col) {
    ctx.lineWidth = w;
    ctx.strokeStyle = col;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(path);
  }
  function dots(path, list, r) {
    for (let i = 0; i < list.length; i += 2) {
      path.moveTo(list[i] + r, list[i + 1]);
      path.arc(list[i], list[i + 1], r, 0, TAU);
    }
  }
  // a slot-head screw: head color filled by the caller, ring + slot added to ink
  function screw(heads, ink, x, y, r, a) {
    heads.moveTo(x + r, y);
    heads.arc(x, y, r, 0, TAU);
    ink.moveTo(x + r, y);
    ink.arc(x, y, r, 0, TAU);
    const c = Math.cos(a) * r * 0.75, s = Math.sin(a) * r * 0.75;
    ink.moveTo(x - c, y - s);
    ink.lineTo(x + c, y + s);
  }

  // ---- projectile art ---------------------------------------------------------
  function orb(ctx, x, y, r, pal, t) {
    ctx.save();
    const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r * 1.6);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.35, U.rgba(pal.glow, 0.85));
    g.addColorStop(1, U.rgba(pal.glow, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.6, 0, TAU);
    ctx.fill();
    Draw.circle(ctx, x, y, r, pal.glow, 4, pal.ink);
    Draw.circle(ctx, x - r * 0.15, y - r * 0.15, r * 0.6, '#ffffff', 0);
    // crackling arcs
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    for (let i = 0; i < 3; i++) {
      const a = t * 0.4 + i * 2.1;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      ctx.lineTo(x + Math.cos(a + 0.3) * r * 1.5, y + Math.sin(a + 0.3) * r * 1.5);
      ctx.lineTo(x + Math.cos(a + 0.1) * r * 1.9, y + Math.sin(a + 0.1) * r * 1.9);
      ctx.stroke();
    }
    ctx.restore();
  }

  function mitten(ctx, x, y, r, ang, col, pal, lw, open) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    if (open) {
      Draw.ellipse(ctx, r * 0.3, 0, r * 1.2, r * 0.95, 0, col, lw, pal.ink);
      Draw.ellipse(ctx, r * 0.1, -r * 0.95, r * 0.45, r * 0.32, -0.5, col, lw * 0.7, pal.ink);
    } else {
      Draw.circle(ctx, r * 0.2, 0, r, col, lw, pal.ink);
      Draw.ellipse(ctx, r * 0.1, -r * 0.82, r * 0.42, r * 0.3, -0.3, col, lw * 0.7, pal.ink);
      ctx.strokeStyle = pal.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r * 0.2, 0, r * 0.55, -0.8, 0.8);
      ctx.stroke();
    }
    // cuff ring
    const cuff = U.shade(col, -0.12);
    Draw.roundRect(ctx, -r * 1.05, -r * 0.6, r * 0.5, r * 1.2, 3, cuff, lw * 0.7, pal.ink);
    // ---- detail: finger seams, stitching, the cuff's ribs and bolts, a shine
    const ink = new Path2D(), hi = new Path2D();
    if (open) {
      for (const y of [-0.34, 0.06, 0.44]) {
        ink.moveTo(r * 0.95, y * r);
        ink.quadraticCurveTo(r * 1.25, y * r * 1.05 - r * 0.05, r * 1.45, y * r * 1.1);
      }
      // palm crease
      ink.moveTo(r * -0.1, r * 0.25);
      ink.quadraticCurveTo(r * 0.3, r * 0.5, r * 0.75, r * 0.3);
      dots(hi, [r * 0.1, -r * 0.35], r * 0.2);
    } else {
      for (const a of [-0.32, 0.32]) {
        ink.moveTo(r * 0.2 + Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6);
        ink.lineTo(r * 0.2 + Math.cos(a) * r * 0.97, Math.sin(a) * r * 0.97);
      }
      // stitching round the back of the glove
      for (let i = 0; i < 4; i++) {
        const a = 1.9 + i * 0.42;
        ink.moveTo(r * 0.2 + Math.cos(a) * r * 0.74, Math.sin(a) * r * 0.74);
        ink.lineTo(r * 0.2 + Math.cos(a + 0.2) * r * 0.74, Math.sin(a + 0.2) * r * 0.74);
      }
      dots(hi, [-r * 0.05, -r * 0.42], r * 0.2);
    }
    // cuff ribs
    ink.moveTo(-r * 0.8, -r * 0.55);
    ink.lineTo(-r * 0.8, r * 0.55);
    ink.moveTo(-r * 0.66, -r * 0.55);
    ink.lineTo(-r * 0.66, r * 0.55);
    inkStroke(ctx, ink, Math.max(1, r * 0.11), pal.ink);
    const bolts = new Path2D();
    dots(bolts, [-r * 0.93, -r * 0.36, -r * 0.93, r * 0.36], r * 0.08);
    ctx.fillStyle = pal.ink;
    ctx.fill(bolts);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fill(hi);
    ctx.restore();
  }

  function fireBall(f, level) {
    const b = f.battle;
    if (!b) return;
    const pal = f.pal;
    const L = [
      { dmg: 38, r: 15, vx: 9, hits: 1, str: 1, kb: [5, 0] },
      { dmg: 36, r: 22, vx: 9, hits: 2, str: 2, kb: [3, 0] },
      { dmg: 36, r: 30, vx: 9.5, hits: 3, str: 3, kb: [5, 10], launch: true, kd: true },
    ][level];
    const hand = f.jointWorld('hF');
    b.spawn(f, {
      ball: true,
      x: hand[0] + f.facing * (14 + L.r), y: -hand[1] + 2, vx: L.vx * f.facing, r: L.r, life: 120, hits: L.hits, rehit: 7, strength: L.str,
      hit: normHit({ dmg: L.dmg, hs: 19, bs: 13, kb: L.kb, launch: L.launch, kd: L.kd, spark: 'S', sfx: 'zap', stop: 8, chip: Math.round(L.dmg * 0.18) }, 'S', 'special'),
      hitStopOwner: true,
      tick(p) {
        if (p.hits === 1 && L.hits > 1) {
          p.hit = normHit({ dmg: L.dmg + 10, hs: 22, bs: 14, kb: [6, L.kd ? 10 : 0], launch: L.launch, kd: L.kd, spark: 'S', sfx: 'zap', stop: 10, chip: 8 }, 'S', 'special');
        }
        if (p.age % 4 === 0) FX.add({ type: 'dot', x: p.x - p.vx, y: -p.y + (Math.random() - 0.5) * p.r, vx: -p.vx * 0.1, vy: 0, size: 3, life: 12, color: pal.glow, lw: 0 });
      },
      onEnd(p, why) {
        if (why !== 'offscreen') FX.zap(p.x, -p.y, 3, pal.glow);
      },
      draw(ctx, sx, sy, p) {
        orb(ctx, sx, sy, p.r, pal, p.age);
      },
    });
    Sound.sfx('laser', { pitch: 1.2 - level * 0.15 });
  }

  function rocketFist(f) {
    const b = f.battle;
    if (!b) return;
    const pal = f.pal;
    f.data.fistOut = true;
    const hand = f.jointWorld('hF');
    const dir = f.facing;
    b.spawn(f, {
      x: hand[0] + dir * 10, y: -hand[1], vx: 11 * dir, r: 17, life: 200, hits: 2, strength: 1, back: false, noReflect: true,
      hit: normHit({ dmg: 48, hs: 20, bs: 14, kb: [6, 0], spark: 'H', sfx: 'hitH', stop: 9, chip: 9 }, 'S', 'special'),
      returning: false, dist: 0, facing: dir,
      tick(p) {
        p.dist += Math.abs(p.vx);
        if (!p.returning && (p.dist > 560 || p.age > 60)) {
          p.returning = true;
          p.hit = null;
        }
        if (p.returning) {
          const tx = f.x + f.facing * 30, ty = f.y + 120;
          const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy) || 1;
          p.vx = (dx / d) * 15;
          p.vy = (dy / d) * 15;
          if (d < 24) p.kill('caught');
        }
        if (p.age % 2 === 0) FX.add({ type: 'dust', x: p.x - Math.sign(p.vx) * 20, y: -p.y, vx: -p.vx * 0.15, vy: 0, size: 8, life: 14, color: '#ffb84d', alpha: 0.8 });
      },
      onHit(p) {
        p.returning = true;
        p.hit = null;
      },
      onBlock(p) {
        p.returning = true;
        p.hit = null;
      },
      onEnd() {
        f.data.fistOut = false;
        f.data.fistBack = b.frame;
        Sound.sfx('menuMove', { pitch: 0.6 });
      },
      draw(ctx, sx, sy, p) {
        const ang = Math.atan2(-p.vy, p.vx);
        ctx.save();
        ctx.translate(sx, sy);
        // flame
        const fl = 18 + Math.sin(p.age * 0.9) * 5;
        ctx.save();
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.moveTo(-14, -8);
        ctx.quadraticCurveTo(-14 - fl, 0, -14, 8);
        ctx.closePath();
        Draw.fillStroke(ctx, '#ffb84d', 3, pal.ink);
        ctx.beginPath();
        ctx.moveTo(-14, -4);
        ctx.quadraticCurveTo(-14 - fl * 0.6, 0, -14, 4);
        ctx.closePath();
        ctx.fillStyle = '#fff3b0';
        ctx.fill();
        // speed lines trailing the fist and the nozzle ring on the cuff
        const sp = new Path2D();
        for (let i = 0; i < 4; i++) {
          const y = -13 + i * 8.7, x0 = -18 - U.hash(i + Math.floor(p.age / 3)) * 10;
          sp.moveTo(x0 - 16 - (i % 2) * 10, y);
          sp.lineTo(x0, y);
        }
        sp.moveTo(-14, -9);
        sp.lineTo(-14, 9);
        inkStroke(ctx, sp, 2, pal.ink);
        ctx.restore();
        mitten(ctx, 0, 0, 15, ang, pal.hand, pal, 4, false);
        ctx.restore();
      },
    });
    Sound.sfx('rocket');
  }

  function hoverLaser(f) {
    const b = f.battle;
    if (!b) return;
    const pal = f.pal;
    const head = f.jointWorld('head');
    b.spawn(f, {
      x: head[0] + f.facing * 20, y: -head[1], vx: 11 * f.facing, vy: -8, r: 12, life: 50, hits: 1, floor: 4,
      hit: normHit({ dmg: 46, hs: 18, bs: 12, kb: [4, 0], level: 'high', spark: 'S', sfx: 'zap', stop: 8, chip: 7 }, 'S', 'special'),
      onFloor(p) {
        FX.zap(p.x, 0, 2, pal.glow);
        p.kill('floor');
      },
      capFn(p) {
        return [p.x - p.vx * 2.2, -(p.y - p.vy * 2.2), p.x, -p.y, p.r];
      },
      draw(ctx, sx, sy, p) {
        ctx.save();
        ctx.lineCap = 'round';
        const x0 = sx - p.vx * 2.2, y0 = sy + p.vy * 2.2;
        for (const [w, c] of [[22, pal.ink], [16, pal.glow], [6, '#ffffff']]) {
          ctx.strokeStyle = c;
          ctx.lineWidth = w;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(sx, sy);
          ctx.stroke();
        }
        ctx.restore();
      },
    });
    Sound.sfx('laser');
  }

  function megaBeam(f) {
    const b = f.battle;
    if (!b) return;
    const pal = f.pal;
    const NORMAL = { dmg: 24, hs: 22, bs: 10, kb: [2, 0], spark: 'S', sfx: 'zap', stop: 5, chip: 5, minScale: 0.75 };
    const FINAL = { dmg: 52, hs: 30, bs: 16, kb: [9, 11], launch: true, kd: true, spark: 'X', sfx: 'hitX', stop: 16, chip: 10, minScale: 0.8 };
    b.spawn(f, {
      x: f.x, y: 120, vx: 0, r: 40, life: 64, hits: 8, rehit: 6, strength: 99, noClash: false, super: true,
      hit: normHit(Object.assign({}, NORMAL), 'S', 'super'),
      capFn(p) {
        const h = f.jointWorld('head');
        return [h[0] + f.facing * 40, h[1], h[0] + f.facing * 1500, h[1], p.r];
      },
      tick(p) {
        if (p.hits === 1 && !p.final) {
          p.final = true;
          p.hit = normHit(Object.assign({}, FINAL), 'S', 'super');
        }
        if (p.age % 3 === 0) {
          const h = f.jointWorld('head');
          FX.add({ type: 'dot', x: h[0] + f.facing * (60 + Math.random() * 900), y: h[1] + (Math.random() - 0.5) * 60, vx: f.facing * 6, vy: (Math.random() - 0.5) * 2, size: 4, life: 16, color: '#ffffff', lw: 0 });
        }
        if (p.age % 10 === 0 && f.battle) f.battle.shake(4);
      },
      draw(ctx, sx, sy, p) {
        const h = f.jointWorld('head');
        const ox = sx - p.x, oy = sy + p.y;
        const x0 = ox + h[0] + f.facing * 62, y = oy + h[1];
        const x1 = x0 + f.facing * 1700;
        const grow = Math.min(1, p.age / 6) * (p.age > p.life - 10 ? (p.life - p.age) / 10 : 1);
        const wob = Math.sin(p.age * 1.3) * 4;
        ctx.save();
        ctx.lineCap = 'round';
        for (const [w, c, a] of [[110, pal.glow, 0.25], [80, pal.ink, 1], [70, pal.glow, 1], [40, '#ffffff', 1]]) {
          ctx.globalAlpha = a;
          ctx.strokeStyle = c;
          ctx.lineWidth = (w + wob) * grow;
          ctx.beginPath();
          ctx.moveTo(x0, y);
          ctx.lineTo(x1, y);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        Draw.circle(ctx, x0, y, 26 * grow + wob, '#ffffff', 4, pal.ink);
        ctx.restore();
      },
      onEnd() {
        f.data.beaming = false;
      },
    });
    f.data.beaming = true;
    Sound.sfx('beam');
  }

  // ---- face on the screen ------------------------------------------------------
  function screenFace(ctx, pal, face, blink) {
    const c = pal.glow;
    const draw = (fn) => {
      ctx.save();
      ctx.strokeStyle = U.rgba(c, 0.35);
      ctx.fillStyle = U.rgba(c, 0.35);
      ctx.lineWidth = 7;
      fn();
      ctx.restore();
      ctx.strokeStyle = c;
      ctx.fillStyle = c;
      ctx.lineWidth = 3.2;
      // the glowing face is light, not paint: no brush shadow across an eye
      const ga = ctx.globalAlpha;
      ctx.globalAlpha = ga * 0.97;
      fn();
      ctx.globalAlpha = ga;
    };
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const EX = [-4, 15], EY = -3;
    draw(() => {
      ctx.beginPath();
      if (face === 'happy') {
        for (const x of EX) {
          ctx.moveTo(x - 5, EY + 3);
          ctx.lineTo(x, EY - 3);
          ctx.lineTo(x + 5, EY + 3);
        }
        ctx.stroke();
      } else if (face === 'hurt') {
        ctx.moveTo(EX[0] - 4, EY - 5);
        ctx.lineTo(EX[0] + 4, EY);
        ctx.lineTo(EX[0] - 4, EY + 5);
        ctx.moveTo(EX[1] + 4, EY - 5);
        ctx.lineTo(EX[1] - 4, EY);
        ctx.lineTo(EX[1] + 4, EY + 5);
        ctx.stroke();
      } else if (face === 'ko') {
        for (const x of EX) {
          ctx.moveTo(x - 4, EY - 4);
          ctx.lineTo(x + 4, EY + 4);
          ctx.moveTo(x + 4, EY - 4);
          ctx.lineTo(x - 4, EY + 4);
        }
        ctx.stroke();
      } else if (blink) {
        for (const x of EX) {
          ctx.moveTo(x - 4, EY);
          ctx.lineTo(x + 4, EY);
        }
        ctx.stroke();
      } else {
        // rounded rectangle eyes; angry/block get slanted lids
        for (let i = 0; i < 2; i++) {
          const x = EX[i];
          const h = face === 'block' ? 6 : face === 'sad' ? 9 : 11;
          ctx.moveTo(x - 3.5 + 3, EY - h / 2);
          Draw.roundRectPath(ctx, x - 3.5, EY - h / 2, 7, h, 3);
        }
        ctx.fill();
        if (face === 'angry') {
          ctx.beginPath();
          ctx.moveTo(EX[0] - 6, EY - 10);
          ctx.lineTo(EX[0] + 5, EY - 6);
          ctx.moveTo(EX[1] + 6, EY - 10);
          ctx.lineTo(EX[1] - 5, EY - 6);
          ctx.stroke();
        }
      }
      // mouth
      ctx.beginPath();
      if (face === 'happy') {
        ctx.moveTo(-2, 9);
        ctx.quadraticCurveTo(6, 16, 14, 9);
      } else if (face === 'hurt' || face === 'ko') {
        ctx.moveTo(-1, 11);
        ctx.lineTo(3, 8);
        ctx.lineTo(7, 11);
        ctx.lineTo(11, 8);
        ctx.lineTo(14, 11);
      } else if (face === 'angry') {
        ctx.moveTo(0, 11);
        ctx.lineTo(13, 11);
      } else if (face === 'sad') {
        ctx.moveTo(0, 13);
        ctx.quadraticCurveTo(6, 7, 12, 13);
      } else {
        ctx.moveTo(1, 10);
        ctx.quadraticCurveTo(6, 13, 11, 10);
      }
      ctx.stroke();
    });
  }

  defineChar({
    id: 'volt',
    name: 'VOLT',
    title: 'Tin Can With a Plan',
    style: 'ZONER',
    desc: 'A retro robot with a TV for a head. Keeps you at arm\'s length (a very long arm) with charged energy balls, a rocket fist and the MEGA BEAM.',
    color: '#ffc72e',
    sparkColor: '#5ef3ff',
    trailColor: '#5ef3ff',
    words: ['ZAP!', 'BZZT!', 'BEEP!', 'KZZT!'],
    wordColor: '#5ef3ff',
    ui: { power: 3, speed: 2, range: 5, difficulty: 3 },
    quotes: ['BEEP BOOP. VICTORY.EXE COMPLETE.', 'Calculating... yep, you lost!', 'Have you tried turning it off and on again?', 'Error 404: your win not found.'],
    stats: {
      hp: 950, walkF: 3.2, walkB: 3.0, jumpV: 15.5, jumpVx: 4.5, grav: 0.8, jsq: 4,
      dash: { f: 20, v: 8.5, cancel: 8 }, bdash: { v: 7.5, vy: 5.5, inv: 4, lag: 7 },
      width: 62, height: 200, throwRange: 55, landLag: 4, downTime: 32, swingPitch: 1.1, voicePitch: 1.1,
    },
    body: {
      torso: 54, neck: 9, headR: 30, shoulderDrop: 12, shoulderOfs: 4, hipOfs: 7,
      uArm: 26, fArm: 26, handR: 13,
      thigh: 26, shin: 26, footL: 18, footR: 9,
      armR: [6.5, 6.5, 6.5], legR: [9.5, 8.5, 8.5], torsoW: [62, 66],
    },
    armCols: ['metal', 'metal', 'hand'],
    legCols: ['metal', 'metal', 'foot'],
    drawOrder: ['behind', 'armB', 'legB', 'legF', 'torso', 'head', 'armF', 'front'],
    mono: [
      { main: '#ffc72e', accent: '#5ef3ff' },
      { main: '#e9e6f5', accent: '#ff7ad9' },
      { main: '#7d8597', accent: '#ff6a3d' },
    ],
    monoKeys: { main: 'body', accentMain: 'glow', accent: ['glow', 'bolt', 'accent'], keep: ['screen', 'screenL'] },
    palettes: [
      { body: '#ffc72e', bodyL: '#ffe58a', screen: '#18233a', screenL: '#24324d', glow: '#5ef3ff', metal: '#aab4c9', hand: '#ffffff', foot: '#4a5168', accent: '#ff4d6d', bolt: '#ffc72e' },
      { body: '#f4f1fa', bodyL: '#ffffff', screen: '#2a1d3a', screenL: '#3a2a50', glow: '#ff7ad9', metal: '#c8c0e0', hand: '#ffe3f5', foot: '#7a5cff', accent: '#7a5cff', bolt: '#ff7ad9' },
      { body: '#5a6070', bodyL: '#7a8194', screen: '#1a0f12', screenL: '#2a171c', glow: '#ff5a3d', metal: '#8a8f9c', hand: '#d9d9d9', foot: '#2b2b33', accent: '#ffc72e', bolt: '#ff5a3d' },
    ],
    walk: { A: 8, H: 7, bob: 3, sway: 2, arm: 10 },
    idlePeriod: 72,
    ai: {
      pref: [220, 420], aggression: 0.4, jumpiness: 0.18, zoning: 0.75,
      combos: [['5L', '5S'], ['2L', '5L', '5S'], ['5H', '6S'], ['jH', '5L', '5S'], ['2L', '2S']],
      antiAir: ['2H'], punish: ['5H', '6S'], enders: ['5S', '6S'],
    },

    poses: {
      stance: { t: 2, hd: -2, fs: 25, fe: 70, bs: 15, be: 80, lf: [18, 0], lb: [-18, 0], d: 6 },
      stance2: { $: 'stance', d: 10, hd: 2, fe: 76, be: 86 },
      crouch: { t: 14, hd: -6, fs: 40, fe: 70, bs: 30, be: 80, lf: [20, 0], lb: [-20, 0], d: 36 },
      crouch2: { $: 'crouch', d: 38 },
      squat: { t: 10, hd: -6, fs: 20, fe: 50, bs: 5, be: 60, lf: [18, 0], lb: [-18, 0], d: 30 },
      jump: { t: 2, hd: -6, fs: 130, fe: 30, bs: 140, be: 30, fh: 40, fk: 70, bh: 10, bk: 70, fx: 'jet' },
      fall: { t: 4, hd: 0, fs: 110, fe: 40, bs: 120, be: 40, fh: 20, fk: 30, bh: -6, bk: 30 },
      dash1: { t: 12, hd: -6, fs: -40, fe: 40, bs: -50, be: 40, lf: [12, 10], lb: [-12, 10], d: 6, y: -10, fx: 'jet' },
      dash2: { $: 'dash1', y: -14 },
      bdash: { t: -10, hd: 6, fs: 60, fe: 60, bs: 50, be: 60, fh: 30, fk: 40, bh: -6, bk: 30, fx: 'jet' },
      block: { t: -4, hd: 8, fs: 75, fe: 110, bs: 60, be: 115, lf: [14, 0], lb: [-22, 0], d: 10, face: 'block' },
      cblock: { t: 8, hd: 6, fs: 75, fe: 110, bs: 60, be: 115, lf: [20, 0], lb: [-20, 0], d: 36, face: 'block' },
      // normals
      '5L_a': { t: -2, hd: 0, fs: 70, fe: 60, bs: 15, be: 80, lf: [18, 0], lb: [-18, 0], d: 6 },
      '5L_b': { t: 6, hd: -2, x: 4, fs: 88, fe: 0, ext: 1.9, bs: 10, be: 70, lf: [20, 0], lb: [-18, 0], d: 8 },
      '2L_a': { t: 14, hd: -6, fs: 60, fe: 40, bs: 30, be: 80, lf: [20, 0], lb: [-20, 0], d: 36 },
      '2L_b': { t: 16, hd: -8, x: 4, fs: 72, fe: 0, ext: 1.9, bs: 30, be: 80, lf: [22, 0], lb: [-20, 0], d: 38 },
      '5H_a': { t: -12, hd: 6, fs: -110, fe: -40, ext: 1.5, bs: 10, be: 80, lf: [16, 0], lb: [-20, 0], d: 4 },
      '5H_b': { t: 10, hd: -4, x: 6, fs: 105, fe: 0, ext: 2.3, bs: -10, be: 70, lf: [22, 0], lb: [-18, 0], d: 10 },
      '5H_c': { t: 14, hd: -6, x: 8, fs: 80, fe: 0, ext: 2.35, bs: -15, be: 70, lf: [22, 0], lb: [-18, 0], d: 12 },
      '2H_a': { t: 18, hd: 10, fs: 30, fe: 60, bs: 20, be: 60, lf: [20, 0], lb: [-20, 0], d: 36 },
      '2H_b': { t: -6, hd: -16, fs: 100, fe: 70, ext: 1.3, bs: 110, be: 65, extB: 1.3, hand: 'fist', handB: 'fist', lf: [18, 0], lb: [-18, 0], d: 4, face: 'angry', fx: 'zap' },
      '6H_a': { t: -20, hd: -10, fs: -20, fe: 40, bs: -30, be: 40, lf: [16, 0], lb: [-20, 0], d: 4 },
      '6H_b': { t: 40, hd: 26, x: 14, fs: -40, fe: 20, bs: -50, be: 20, lf: [28, 0], lb: [-14, 0], d: 16 },
      jL_a: { t: 4, hd: -2, fs: 60, fe: 60, bs: 130, be: 30, fh: 50, fk: 80, bh: 20, bk: 80 },
      jL_b: { t: 8, hd: 4, fs: 55, fe: 0, ext: 1.7, bs: 130, be: 30, fh: 50, fk: 80, bh: 20, bk: 80 },
      jH_a: { t: -14, hd: -6, fs: -120, fe: -30, ext: 1.3, bs: -110, be: -30, extB: 1.3, hand: 'fist', fh: 40, fk: 70, bh: 20, bk: 70 },
      jH_b: { t: 14, hd: 10, fs: 30, fe: 0, ext: 1.9, bs: 40, be: 0, extB: 1.8, fh: 40, fk: 70, bh: 20, bk: 70 },
      // specials
      chargeA: { t: 8, hd: -4, fs: 60, fe: 50, bs: 60, be: 60, hand: 'open', handB: 'open', lf: [20, 0], lb: [-20, 0], d: 14, fx: 'charge' },
      chargeB: { $: 'chargeA', d: 18, t: 10 },
      fireA: { t: 14, hd: -6, x: 6, fs: 88, fe: 0, ext: 1.3, bs: 86, be: 0, extB: 1.3, hand: 'open', handB: 'open', lf: [22, 0], lb: [-20, 0], d: 12 },
      rocketA: { t: -10, hd: 4, fs: -20, fe: 90, bs: 30, be: 60, lf: [16, 0], lb: [-22, 0], d: 8 },
      rocketB: { t: 14, hd: -4, x: 6, fs: 90, fe: 0, bs: -20, be: 60, lf: [22, 0], lb: [-20, 0], d: 12 },
      fieldA: { t: 4, hd: -10, fs: 95, fe: 25, ext: 1.4, bs: -95, be: -25, extB: 1.4, hand: 'open', handB: 'open', lf: [22, 0], lb: [-22, 0], d: 18, face: 'angry', fx: 'zap' },
      hoverA: { t: 6, hd: 4, fs: 100, fe: 30, bs: 110, be: 30, fh: 20, fk: 40, bh: 0, bk: 40, fx: 'jet' },
      hoverB: { t: 26, hd: 20, fs: 60, fe: 20, bs: 70, be: 20, fh: 20, fk: 40, bh: 0, bk: 40, fx: 'jet', face: 'angry' },
      beamA: { t: -6, hd: -10, fs: -30, fe: 60, bs: -40, be: 60, lf: [24, 0], lb: [-26, 0], d: 18, face: 'angry' },
      beamB: { t: -16, hd: -6, x: -6, fs: -50, fe: 40, bs: -60, be: 40, lf: [24, 0], lb: [-30, 0], d: 24, face: 'angry', fx: 'beam' },
      // throw
      grabA: { t: 14, hd: -4, fs: 85, fe: 10, ext: 1.2, bs: 80, be: 15, extB: 1.2, hand: 'open', handB: 'open', lf: [20, 0], lb: [-20, 0], d: 10, fx: 'zap', face: 'angry' },
      grabB: { $: 'grabA', t: 18, d: 14 },
      shove: { t: 16, hd: -4, x: 8, fs: 90, fe: 0, ext: 1.6, bs: 85, be: 0, extB: 1.6, hand: 'open', handB: 'open', lf: [24, 0], lb: [-20, 0], d: 12 },
      // personality
      win: { t: -4, hd: -10, fs: 115, fe: 60, ext: 1.5, hand: 'fist', bs: 20, be: 90, lf: [16, 0], lb: [-18, 0], d: 2, face: 'happy', fx: 'jet' },
      win2: { t: 2, hd: 8, fs: 130, fe: 20, ext: 1.5, bs: -130, be: -20, extB: 1.5, hand: 'open', handB: 'open', lf: [16, 0], lb: [-18, 0], d: 8, face: 'happy' },
      intro1: { t: 0, hd: 14, fs: 100, fe: 70, ext: 1.6, hand: 'open', bs: 15, be: 80, lf: [18, 0], lb: [-18, 0], d: 4, face: 'happy' },
      intro2: { $: 'intro1', fe: 35, hd: 6 },
      lose: { t: 20, hd: 30, fs: -5, fe: 5, bs: -10, be: 5, lf: [14, 0], lb: [-14, 0], d: 6, face: 'sad' },
    },

    anims: {
      intro: { keys: [[0, 'squat'], [10, 'intro1', 'out'], [20, 'intro2'], [30, 'intro1'], [40, 'intro2'], [56, 'stance'], [96, 'stance']] },
      win: { keys: [[0, 'stance'], [10, 'win', 'out'], [40, 'win2'], [60, 'win'], [90, 'win']] },
    },

    moves: {
      '5L': {
        name: 'Boing Jab',
        anim: { keys: [[0, 'stance'], [4, '5L_a', 'out'], [6, '5L_b', 'snap'], [9, '5L_b'], [20, 'stance']] },
        hits: [{ at: [6, 9], limb: 'handF', r: 17, dmg: 28, hs: 14, bs: 10, kb: [3, 0] }],
        ai: { range: [0, 155], kind: 'poke' },
      },
      '2L': {
        name: 'Low Poke',
        anim: { keys: [[0, 'crouch'], [4, '2L_a', 'out'], [7, '2L_b', 'snap'], [10, '2L_b'], [21, 'crouch']] },
        hits: [{ at: [7, 10], limb: 'handF', r: 15, dmg: 24, level: 'low', hs: 13, bs: 10, kb: [3, 0] }],
        ai: { range: [0, 145], kind: 'low' },
      },
      '5H': {
        name: 'Hammer Arm',
        anim: { keys: [[0, 'stance'], [8, '5H_a', 'out'], [12, '5H_b', 'snap'], [16, '5H_c'], [24, '5H_c'], [36, 'stance']] },
        hits: [{ at: [12, 16], limb: 'handF', r: 23, dmg: 72, hs: 20, bs: 15, kb: [6, 0], stop: 10, sfx: 'hitH' }],
        ai: { range: [80, 195], kind: 'poke' },
      },
      '2H': {
        name: 'Antenna Zap',
        anim: { keys: [[0, 'crouch'], [5, '2H_a', 'out'], [8, '2H_b', 'snap'], [18, '2H_b'], [32, 'crouch']] },
        airInv: [3, 16],
        hits: [{
          at: [8, 16], r: 34, dmg: 70, hs: 26, launch: true, kd: true, kb: [2, 12], spark: 'S', sfx: 'zap', stop: 10,
          capFn: (f) => {
            const h = f.J.head;
            return [h[0] + 6, h[1] - 50, h[0] + 16, h[1] - 90];
          },
        }],
        ev: { 8: (f) => {
          Sound.sfx('zap');
          if (f.battle) {
            const h = f.jointWorld('head');
            FX.zap(h[0], h[1] - 60, 4, f.pal.glow);
          }
        } },
        ai: { range: [0, 105], kind: 'aa' },
      },
      '6H': {
        name: 'TV Bonk',
        anim: { keys: [[0, 'stance'], [10, '6H_a', 'out'], [18, '6H_b', 'snap'], [22, '6H_b'], [36, 'stance']] },
        vel: [[16, 3], [22, 0]],
        hits: [{ at: [18, 21], limb: 'head', r: 34, dmg: 66, level: 'high', hs: 19, bs: 13, kb: [5, 0], stop: 11, sfx: 'hitH' }],
        ai: { range: [30, 145], kind: 'over' },
      },
      jL: {
        name: 'Air Jab',
        anim: { keys: [[0, 'jump'], [3, 'jL_a', 'out'], [5, 'jL_b', 'snap'], [12, 'jL_b'], [18, 'fall']] },
        hits: [{ at: [5, 11], limb: 'handF', r: 16, dmg: 32, hs: 14, bs: 10 }],
        ai: { kind: 'air' },
      },
      jH: {
        name: 'Double Slam',
        anim: { keys: [[0, 'jump'], [5, 'jH_a', 'out'], [8, 'jH_b', 'snap'], [15, 'jH_b'], [22, 'fall']] },
        hits: [{ at: [8, 14], limb: 'handF', r: 22, dmg: 64, hs: 18, bs: 14, kb: [5, 0], sfx: 'hitH' }],
        ai: { kind: 'air' },
      },
      '5S': {
        name: 'Volt Ball',
        // one ball on screen at a time, and a slower recovery: no spamming
        cond: (f) => !f.battle || !f.battle.projs.some((p) => p.owner === f && p.ball && p.active),
        anim: { keys: [[0, 'stance'], [6, 'chargeA', 'out'], [9, 'chargeB'], [10, 'fireA', 'snap'], [30, 'fireA'], [40, 'stance']] },
        tick(f, mf) {
          if (mf === 1) {
            f.md.charge = 0;
            Sound.sfx('charge');
          }
          if (mf === 9 && f.held(BTN.SPECIAL) && f.md.charge < 56) {
            f.md.charge += 2;
            f.mf = 7;
            if (f.md.charge === 24 || f.md.charge === 48) {
              Sound.sfx('bell', { pitch: f.md.charge === 24 ? 1.2 : 1.6 });
              if (f.battle) {
                const h = f.jointWorld('hF');
                FX.ring(h[0], h[1], 50, f.pal.glow, 12);
              }
            }
          }
          if (mf === 10) fireBall(f, f.md.charge >= 48 ? 2 : f.md.charge >= 24 ? 1 : 0);
        },
        ai: { range: [220, 900], kind: 'proj' },
        desc: 'Hold to charge. One at a time',
      },
      '6S': {
        name: 'Rocket Fist',
        // the fist has to be back (and screwed on) before it can fly again
        cond: (f) => !f.data.fistOut && (!f.battle || f.battle.frame - (f.data.fistBack || -999) > 30),
        anim: { keys: [[0, 'stance'], [8, 'rocketA', 'out'], [12, 'rocketB', 'snap'], [28, 'rocketB'], [38, 'stance']] },
        ev: { 12: (f) => rocketFist(f) },
        ai: { range: [200, 600], kind: 'proj' },
      },
      '2S': {
        name: 'Static Field',
        anim: { keys: [[0, 'crouch'], [6, 'squat'], [10, 'fieldA', 'snap'], [30, 'fieldA'], [44, 'stance']] },
        hits: [{ at: [10, 29], cap: [0, -100, 0, -100], r: 82, dmg: 26, rehit: 7, maxHits: 3, hs: 18, bs: 12, kb: [4, 0], spark: 'S', sfx: 'zap', stop: 5, chip: 4 }],
        tick(f, mf) {
          if (mf >= 10 && mf <= 29 && mf % 3 === 0 && f.battle) FX.zap(f.x, -f.y - 100, 2, f.pal.glow);
          if (mf === 10) Sound.sfx('zap');
        },
        ai: { range: [0, 120], kind: 'reversal' },
      },
      jS: {
        name: 'Hover Laser',
        anim: { keys: [[0, 'jump'], [6, 'hoverA', 'out'], [12, 'hoverB', 'snap'], [26, 'hoverB'], [32, 'fall']] },
        vel: [[0, null, 0.5]],
        grav: 0.04, gravAt: [0, 26],
        ev: { 12: (f) => hoverLaser(f) },
        ai: { kind: 'airS' },
      },
      SUP: {
        name: 'MEGA BEAM',
        inv: [0, 14],
        anim: { keys: [[0, 'squat'], [8, 'beamA', 'out'], [14, 'beamB', 'snap'], [74, 'beamB'], [86, 'stance']] },
        ev: { 14: (f) => megaBeam(f) },
        tick(f, mf) {
          if (mf > 14 && mf < 74) f.vx = -0.4 * f.facing;
        },
        ai: { kind: 'super', range: [0, 900] },
      },
      THROW: {
        name: 'Bzzzt!',
        throw: true,
        throwAt: 3,
        anim: { keys: [[0, 'stance'], [3, 'throwReach'], [9, 'throwWhiff'], [24, 'stance']] },
        seq: {
          len: 40,
          tech: true,
          anim: { keys: [[0, 'grabA'], [6, 'grabB'], [10, 'grabA'], [14, 'grabB'], [18, 'grabA'], [22, 'grabB'], [28, 'shove', 'snap'], [40, 'stance']] },
          vic: [[0, 'grabbed', 58, 0], [8, 'hurt', 56, 0], [12, 'hurt2', 56, 0], [16, 'hurt', 56, 0], [20, 'hurt2', 56, 0], [28, 'hurtAir', 80, 24]],
          hits: { 10: { dmg: 25, sfx: 'zap', stop: 3 }, 18: { dmg: 25, sfx: 'zap', stop: 3 }, 28: { dmg: 45, sfx: 'hitH', shake: 6, stop: 6, word: 'BZZZT!' } },
          ev: {
            8: (a, v) => {
              FX.zap(v.x, -v.y - 100, 4, a.pal.glow);
              v.flash = 6;
              v.flashColor = '#ffffff';
            },
            16: (a, v) => {
              FX.zap(v.x, -v.y - 100, 4, a.pal.glow);
              v.flash = 6;
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
        // back thruster
        ctx.save();
        ctx.translate(J.hip[0], J.hip[1]);
        ctx.rotate(J.ta);
        const K = tones(pal);
        // two cables looping from the thruster into the chassis
        const cab = new Path2D(), wire = new Path2D();
        cab.moveTo(-35, -39);
        cab.quadraticCurveTo(-45, -49, -27, -50);
        wire.moveTo(-30, -39);
        wire.quadraticCurveTo(-37, -57, -24, -55);
        inkStroke(ctx, cab, 3.4, K.metalD);
        inkStroke(ctx, wire, 1.6, pal.ink);
        Draw.roundRect(ctx, -40, -40, 14, 26, 5, pal.metal, f.C.lw, pal.ink);
        // nozzle bell (a plain fill: the sketch pass's marks stay where they were)
        const nz = new Path2D();
        nz.moveTo(-38, -15.5);
        nz.lineTo(-28, -15.5);
        nz.lineTo(-25.2, -8);
        nz.lineTo(-40.8, -8);
        nz.closePath();
        ctx.fillStyle = K.metalD;
        ctx.fill(nz);
        // hazard band
        ctx.save();
        const band = new Path2D();
        band.rect(-40, -33.5, 14, 6);
        ctx.fillStyle = pal.body;
        ctx.fill(band);
        ctx.clip(band);
        const hz = new Path2D();
        for (let x = -46; x < -24; x += 5) {
          hz.moveTo(x, -27.5);
          hz.lineTo(x + 2.5, -27.5);
          hz.lineTo(x + 6.5, -33.5);
          hz.lineTo(x + 4, -33.5);
          hz.closePath();
        }
        ctx.fillStyle = pal.ink;
        ctx.fill(hz);
        ctx.restore();
        // ribs, the nozzle's rings, rivets and the dark mouth
        const rb = new Path2D();
        rb.moveTo(-39.5, -36.4);
        rb.lineTo(-26.5, -36.4);
        rb.moveTo(-40, -24);
        rb.lineTo(-26, -24);
        rb.moveTo(-39.3, -12);
        rb.lineTo(-26.7, -12);
        rb.moveTo(-36, -20.5);
        rb.lineTo(-30, -20.5);
        inkStroke(ctx, rb, 1.4, pal.ink);
        const dk = new Path2D();
        dots(dk, [-37.5, -38.2, -28.5, -38.2, -37.6, -18.2, -28.4, -18.2], 0.95);
        dk.ellipse(-33, -8, 7.6, 1.5, 0, 0, TAU);
        ctx.fillStyle = pal.ink;
        ctx.fill(dk);
        const fx = J.P.fx;
        if (fx === 'jet' || (f.state === 'air' && f.vy < 2) || f.state === 'dash') {
          const fl = 16 + Math.sin((f.t || 0) * 1.3) * 6;
          ctx.beginPath();
          ctx.moveTo(-40, -8);
          ctx.quadraticCurveTo(-33, -8 + fl * 1.6, -26, -8);
          ctx.closePath();
          Draw.fillStroke(ctx, '#ffb84d', 3, pal.ink);
          ctx.beginPath();
          ctx.moveTo(-37, -8);
          ctx.quadraticCurveTo(-33, -8 + fl, -29, -8);
          ctx.closePath();
          ctx.fillStyle = '#fff3b0';
          ctx.fill();
        }
        ctx.restore();
      },
      torso(ctx, f, J, pal) {
        const T = f.C.body.torso, lw = f.C.lw;
        const K = tones(pal);
        const t = f.t || 0;
        const fine = Sketch.quality >= 2;
        // hips / waist joint
        Draw.roundRect(ctx, -20, -8, 42, 18, 8, pal.metal, lw, pal.ink);
        // chassis
        Draw.roundRect(ctx, -32, -T - 2, 66, T - 4, 14, pal.body, lw, pal.ink);
        ctx.save();
        ctx.beginPath();
        Draw.roundRectPath(ctx, -32, -T - 2, 66, T - 4, 14);
        ctx.clip();
        ctx.fillStyle = pal.dark.body;
        ctx.fillRect(-34, -T - 4, 14, T + 4);
        ctx.fillStyle = pal.bodyL;
        ctx.fillRect(-14, -T + 2, 40, 5);
        ctx.restore();
        // neck (mostly hidden under the TV)
        const nk = new Path2D();
        Draw.roundRectPath(nk, -10, -64, 22, 8.4, 2.5);
        ctx.fillStyle = pal.metal;
        ctx.fill(nk);
        // ---- panel seams, the neck ridge and the waist bellows
        const S = new Path2D();
        S.moveTo(-14, -46.2);
        S.quadraticCurveTo(9, -45.2, 32.5, -46.6);
        S.moveTo(-14.6, -52.5);
        S.quadraticCurveTo(-15.6, -37, -14.4, -21);
        S.moveTo(-8, -57.6);
        S.lineTo(10, -57.6);
        for (const y of [-1.6, 3.4]) {
          S.moveTo(-17, y);
          S.quadraticCurveTo(1, y + 2.2, 19, y);
        }
        // the grille's frame round the vents
        S.moveTo(-22, -19.6);
        S.lineTo(-6, -19.6);
        inkStroke(ctx, S, 1.45, pal.ink);
        // ---- a barcode sticker with a peeling corner (tucked under the dial)
        {
          const ca = Math.cos(-0.12), sa = Math.sin(-0.12), ox = 16, oy = -15.5;
          const R = (x, y) => [ox + x * ca - y * sa, oy + x * sa + y * ca];
          const st = new Path2D(), fl = new Path2D(), bc = new Path2D();
          let q = R(0, 0);
          st.moveTo(q[0], q[1]);
          for (const [x, y] of [[9, 0], [12, 3], [12, 7], [0, 7]]) {
            q = R(x, y);
            st.lineTo(q[0], q[1]);
          }
          st.closePath();
          ctx.fillStyle = pal.hand;
          ctx.fill(st);
          q = R(9, 0);
          fl.moveTo(q[0], q[1]);
          q = R(12, 3);
          fl.lineTo(q[0], q[1]);
          q = R(9.6, 3.4);
          fl.lineTo(q[0], q[1]);
          fl.closePath();
          ctx.fillStyle = K.handD;
          ctx.fill(fl);
          for (const [x, w] of [[1.6, 0.9], [3, 0.5], [4, 1.2], [5.6, 0.5], [6.6, 0.9], [8, 0.5], [9.1, 1]]) {
            q = R(x, 4.2);
            bc.moveTo(q[0], q[1]);
            q = R(x, 5.8 - w * 0.3);
            bc.lineTo(q[0], q[1]);
          }
          q = R(1.4, 2);
          bc.moveTo(q[0], q[1]);
          q = R(6.5, 2);
          bc.lineTo(q[0], q[1]);
          inkStroke(ctx, bc, 0.9, pal.ink);
        }
        // chest dial with lightning bolt, in a bezel ring with gauge ticks
        const pulse = 0.6 + 0.4 * Math.sin(t * 0.12);
        const DY = -T * 0.52;
        const bzl = new Path2D();
        dots(bzl, [8, DY], 17.5);
        ctx.fillStyle = pal.metal;
        ctx.fill(bzl);
        const bsh = new Path2D();
        bsh.arc(8, DY, 16.2, 1.75, 3.7);
        inkStroke(ctx, bsh, 2.6, pal.ink);
        Draw.circle(ctx, 8, DY, 15, pal.screen, lw * 0.8, pal.ink);
        ctx.save();
        ctx.globalAlpha = pulse;
        Draw.circle(ctx, 8, DY, 11, U.rgba(pal.glow, 0.5), 0);
        ctx.restore();
        const G = new Path2D();
        for (let i = 0; i <= 10; i++) {
          const a = 2.25 + i * 0.49, r0 = i % 5 ? 12.4 : 11.4;
          G.moveTo(8 + Math.cos(a) * r0, DY + Math.sin(a) * r0);
          G.lineTo(8 + Math.cos(a) * 14, DY + Math.sin(a) * 14);
        }
        inkStroke(ctx, G, 1.2, K.glowT);
        Draw.poly(ctx, [10, DY - 11, 2, DY + 2, 8, DY + 1, 5, DY + 11, 14, DY - 3, 8, DY - 2], pal.bolt, 2, pal.ink);
        const gl = new Path2D();
        gl.arc(8, DY, 12.8, 3.55, 4.45);
        inkStroke(ctx, gl, 1.7, 'rgba(255,255,255,0.6)');
        // ---- screws (the old corner rivets), seam rivets, bezel screws
        const heads = new Path2D(), ring = new Path2D(), dk = new Path2D();
        screw(heads, ring, -24, -T + 6, 2.6, 0.6);
        screw(heads, ring, 26, -T + 6, 2.6, -0.4);
        screw(heads, ring, -24, -12, 2.6, 1.9);
        screw(heads, ring, 26, -12, 2.6, 0.2);
        ctx.fillStyle = pal.bodyL;
        ctx.fill(heads);
        dots(dk, [-11.8, -41.5, -11.8, -32.5, -11.8, -23.5], 1.05);
        for (let i = 0; i < 4; i++) {
          const a = 0.785 + i * 1.571;
          dots(dk, [8 + Math.cos(a) * 16.25, DY + Math.sin(a) * 16.25], 0.85);
        }
        // LED strip
        Draw.roundRectPath(dk, 14.5, -53, 13, 4.6, 2.3);
        ctx.fillStyle = pal.ink;
        ctx.fill(dk);
        inkStroke(ctx, ring, 1.2, pal.ink);
        // vents
        ctx.fillStyle = pal.ink;
        for (let i = 0; i < 3; i++) ctx.fillRect(-20, -T * 0.32 + i * 6, 12, 2.5);
        // battery LEDs filling up
        const lv = Math.floor(t / 16) % 4;
        const on = new Path2D(), off = new Path2D();
        for (let i = 0; i < 3; i++) dots(i < lv ? on : off, [17.2 + i * 3.8, -50.7], 1.25);
        ctx.fillStyle = pal.glow;
        ctx.fill(on);
        ctx.fillStyle = K.glowDim;
        ctx.fill(off);
        if (!fine) return;
        // ---- wear: scratches, a dent, chipped paint and rust specks
        const sc = new Path2D();
        sc.moveTo(22.5, -42.5);
        sc.lineTo(28.5, -38.6);
        sc.moveTo(23.6, -40.4);
        sc.lineTo(29.2, -36.8);
        sc.moveTo(22.2, -37.4);
        sc.lineTo(24.8, -35.8);
        sc.moveTo(24.8, -18.4);
        sc.quadraticCurveTo(27.6, -15.6, 30.6, -18.2);
        sc.moveTo(-6.5, -50.2);
        sc.lineTo(-1.5, -50.8);
        inkStroke(ctx, sc, 0.95, pal.ink);
        const lt = new Path2D();
        lt.moveTo(-30.2, -30.5);
        lt.lineTo(-24.8, -34);
        lt.moveTo(-29.6, -27.4);
        lt.lineTo(-25.4, -30.2);
        lt.moveTo(25.2, -20.4);
        lt.quadraticCurveTo(27.8, -22.6, 30.2, -20.2);
        inkStroke(ctx, lt, 1, K.bodyHi);
        const ru = new Path2D();
        dots(ru, [29.8, -11, 31.2, -14.6, 22.6, -8.8, -9.8, -8.4, -6.6, -9.4, 28.2, -45.2, 13.6, -9.2], 0.8);
        dots(ru, [31, -9.6, -8.2, -10.4], 0.5);
        ctx.fillStyle = K.rust;
        ctx.fill(ru);
      },
      head(ctx, f, J, pal, face) {
        const lw = f.C.lw;
        const c = f.cos || {};
        const K = tones(pal);
        const t = f.t || 0;
        const fine = Sketch.quality >= 2 && devPx(ctx) > 0.5;
        // antenna on a spring, in a socket on the lid
        const aa = (c.ant ? c.ant.a : 0) * D2R;
        const ax = -2, ay = -27;
        const tx = ax + Math.sin(aa) * 26, ty = ay - Math.cos(aa) * 26;
        const mx = (ax + tx) / 2 + 3, my = (ay + ty) / 2;
        const sk = new Path2D();
        Draw.roundRectPath(sk, -9, -33, 14, 7, 3);
        ctx.fillStyle = pal.metal;
        ctx.fill(sk);
        Draw.line(ctx, ax, ay, mx, my, 3, pal.metal, 2, pal.ink);
        Draw.line(ctx, mx, my, tx, ty, 3, pal.metal, 2, pal.ink);
        {
          // coil round the lower rod, a collar at the kink and one under the bulb
          const sp = new Path2D();
          let dx = mx - ax, dy = my - ay;
          const L1 = Math.hypot(dx, dy) || 1;
          dx /= L1;
          dy /= L1;
          sp.moveTo(ax + dx * 1.5, ay + dy * 1.5);
          for (let i = 0; i <= 7; i++) {
            const s = 2.5 + (i * (L1 - 5)) / 7, o = i % 2 ? 2.5 : -2.5;
            sp.lineTo(ax + dx * s - dy * o, ay + dy * s + dx * o);
          }
          sp.moveTo(mx - dy * 2.8, my + dx * 2.8);
          sp.lineTo(mx + dy * 2.8, my - dx * 2.8);
          let ex = tx - mx, ey = ty - my;
          const L2 = Math.hypot(ex, ey) || 1;
          ex /= L2;
          ey /= L2;
          const bx = tx - ex * 8, by = ty - ey * 8;
          sp.moveTo(bx - ey * 2.4, by + ex * 2.4);
          sp.lineTo(bx + ey * 2.4, by - ex * 2.4);
          inkStroke(ctx, sp, 1.35, pal.ink);
        }
        const on = (t % 60) < 40 || face === 'angry';
        if (on) {
          ctx.save();
          ctx.globalAlpha = 0.35;
          Draw.circle(ctx, tx, ty, 11, pal.accent, 0);
          ctx.restore();
        }
        Draw.circle(ctx, tx, ty, 6, on ? pal.accent : U.shade(pal.accent, -0.4), 3, pal.ink);
        // TV casing
        Draw.roundRect(ctx, -32, -28, 66, 58, 12, pal.body, lw, pal.ink);
        ctx.save();
        ctx.beginPath();
        Draw.roundRectPath(ctx, -32, -28, 66, 58, 12);
        ctx.clip();
        ctx.fillStyle = pal.dark.body;
        ctx.fillRect(-34, -30, 10, 62);
        ctx.restore();
        // knobs on the side
        Draw.circle(ctx, -26, -6, 3.5, pal.metal, 2, pal.ink);
        Draw.circle(ctx, -26, 6, 3.5, pal.metal, 2, pal.ink);
        // ---- casing detail: lid vents, socket seam, speaker grille, knob
        // pointers, corner screws, buttons, a little bolt logo, power light
        {
          const A = new Path2D();
          for (let i = 0; i < 5; i++) {
            const x = 6 + i * 3.6;
            A.moveTo(x, -25.4);
            A.lineTo(x, -21.6);
          }
          A.moveTo(-7, -30.6);
          A.lineTo(3, -30.6);
          for (let i = 0; i < 4; i++) {
            const y = 12.2 + i * 3.7;
            A.moveTo(-29, y);
            A.lineTo(-22.6, y);
          }
          A.moveTo(-26, -6);
          A.lineTo(-24, -8.6);
          A.moveTo(-26, 6);
          A.lineTo(-27.8, 3.4);
          inkStroke(ctx, A, 1.7, pal.ink);
          const heads = new Path2D(), B = new Path2D(), bt = new Path2D();
          screw(heads, B, -27.6, -23.4, 2.2, 0.7);
          screw(heads, B, 29.8, -23.6, 2.2, -0.3);
          screw(heads, B, -27.6, 25.4, 2.2, 1.6);
          screw(heads, B, 29.8, 25.6, 2.2, 0.4);
          for (let i = 0; i < 3; i++) {
            Draw.roundRectPath(bt, 3 + i * 5.4, 25, 4, 2.8, 1.2);
            Draw.roundRectPath(B, 3 + i * 5.4, 25, 4, 2.8, 1.2);
          }
          ctx.fillStyle = pal.bodyL;
          ctx.fill(heads);
          ctx.fillStyle = pal.metal;
          ctx.fill(bt);
          const lg = new Path2D();
          lg.moveTo(-10.5, 23.6);
          lg.lineTo(-14, 27.4);
          lg.lineTo(-11.6, 27.2);
          lg.lineTo(-13, 30);
          lg.lineTo(-8.8, 25.8);
          lg.lineTo(-11.2, 26);
          lg.closePath();
          ctx.fillStyle = pal.bolt;
          ctx.fill(lg);
          if (fine) {
            // scratches on the lid and a dent by the front corner
            B.moveTo(-19.5, -21.8);
            B.lineTo(-14.2, -25.4);
            B.moveTo(-17.4, -21.2);
            B.lineTo(-13.4, -23.8);
            B.moveTo(23.2, -22.2);
            B.quadraticCurveTo(25.6, -19.8, 28.2, -22);
            B.moveTo(31.8, 4);
            B.lineTo(31.2, 9);
          }
          inkStroke(ctx, B, 1.15, pal.ink);
          // power light
          const led = new Path2D();
          dots(led, [-25.6, -15.6], 1.7);
          ctx.fillStyle = on ? pal.accent : K.glowDim;
          ctx.fill(led);
          if (fine) {
            const hl = new Path2D();
            hl.moveTo(23.6, -24.2);
            hl.quadraticCurveTo(25.8, -26.2, 27.8, -24);
            inkStroke(ctx, hl, 1.1, K.bodyHi);
            const ru = new Path2D();
            dots(ru, [-17, 28.2, -14.6, 27.4, 22.6, 28.4, 31.6, 13.6, -30, 4, -18.6, -25.8, 32, -14], 0.85);
            dots(ru, [25.2, 27.6, 31.4, 16.4, -19.6, 28.8], 0.55);
            ctx.fillStyle = K.rust;
            ctx.fill(ru);
          }
          // shine on the bulb and the knobs
          const wh = new Path2D();
          dots(wh, [tx - 2, ty - 2.2], 1.6);
          dots(wh, [-27, -7.2, -27, 4.8], 0.9);
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          ctx.fill(wh);
        }
        // screen in a recessed bezel
        const bz = new Path2D();
        Draw.roundRectPath(bz, -20.6, -21.6, 51.2, 45.2, 11);
        ctx.fillStyle = K.bodyD;
        ctx.fill(bz);
        inkStroke(ctx, bz, 1.4, pal.ink);
        Draw.roundRect(ctx, -18, -19, 46, 40, 9, pal.screen, lw * 0.8, pal.ink);
        ctx.save();
        ctx.beginPath();
        Draw.roundRectPath(ctx, -18, -19, 46, 40, 9);
        ctx.clip();
        const g = ctx.createRadialGradient(5, 0, 2, 5, 0, 34);
        g.addColorStop(0, U.rgba(pal.glow, 0.22));
        g.addColorStop(1, U.rgba(pal.glow, 0));
        ctx.fillStyle = g;
        ctx.fillRect(-20, -22, 50, 46);
        const jitter = (face === 'hurt' || face === 'ko') && f.t ? ((f.t * 7) % 5) - 2 : 0;
        ctx.translate(jitter, 0);
        screenFace(ctx, pal, face, f.blinking);
        ctx.translate(-jitter, 0);
        // scanlines + glare
        const sl = new Path2D();
        for (let y = -19; y < 22; y += 4) sl.rect(-20, y, 50, 1.5);
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fill(sl);
        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        ctx.beginPath();
        ctx.ellipse(-6, -12, 14, 5, -0.3, 0, TAU);
        ctx.fill();
        // glass reflections: a slanted streak and the curve of the tube's edge
        const rf = new Path2D();
        rf.moveTo(16.5, -19);
        rf.lineTo(27, -8.5);
        rf.moveTo(21.5, -19);
        rf.lineTo(28, -12.5);
        rf.moveTo(-15.2, 4);
        rf.quadraticCurveTo(-15.6, -15.4, -4, -16.2);
        inkStroke(ctx, rf, 1.6, 'rgba(255,255,255,0.22)');
        ctx.restore();
      },
      arm(ctx, f, J, side, pc, pal) {
        const back = side === 'B';
        const s = back ? J.sB : J.sF, e = back ? J.eB : J.eF, h = back ? J.hB : J.hF;
        const cx = 2 * e[0] - (s[0] + h[0]) / 2, cy = 2 * e[1] - (s[1] + h[1]) / 2;
        const lw = f.C.lw, w = 11;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = pal.ink;
        ctx.lineWidth = w + lw * 2;
        ctx.beginPath();
        ctx.moveTo(s[0], s[1]);
        ctx.quadraticCurveTo(cx, cy, h[0], h[1]);
        ctx.stroke();
        ctx.strokeStyle = pc.metal;
        ctx.lineWidth = w;
        ctx.stroke();
        // ---- hose detail: a shadow along its far side, a pale line along its
        // lit side, corrugation rings and a clamp by the shoulder
        const K = tones(pc);
        const qp = (t) => [(1 - t) * (1 - t) * s[0] + 2 * (1 - t) * t * cx + t * t * h[0], (1 - t) * (1 - t) * s[1] + 2 * (1 - t) * t * cy + t * t * h[1]];
        const qd = (t) => {
          const dx = 2 * (1 - t) * (cx - s[0]) + 2 * t * (h[0] - cx), dy = 2 * (1 - t) * (cy - s[1]) + 2 * t * (h[1] - cy);
          const d = Math.hypot(dx, dy) || 1;
          return [dx / d, dy / d];
        };
        // the side away from the light (front and above), the same all along
        let nx = -(h[1] - s[1]), ny = h[0] - s[0];
        if (nx * 0.5 - ny * 0.86 > 0) {
          nx = -nx;
          ny = -ny;
        }
        const off = (t, d) => {
          const u = qd(t);
          let px = -u[1], py = u[0];
          if (px * nx + py * ny < 0) {
            px = -px;
            py = -py;
          }
          return [px * d, py * d];
        };
        const o0 = off(0, 1), o1 = off(0.5, 1), o2 = off(1, 1);
        const along = (d) => {
          const p = new Path2D();
          p.moveTo(s[0] + o0[0] * d, s[1] + o0[1] * d);
          p.quadraticCurveTo(cx + o1[0] * d, cy + o1[1] * d, h[0] + o2[0] * d, h[1] + o2[1] * d);
          return p;
        };
        inkStroke(ctx, along(3.4), 3.4, pal.ink);
        inkStroke(ctx, along(-2.6), 1.6, K.metalHi);
        const len = Math.hypot(cx - s[0], cy - s[1]) + Math.hypot(h[0] - cx, h[1] - cy);
        const n = U.clamp(Math.round(len / 6), 5, 20);
        const rg = new Path2D();
        for (let i = 1; i < n; i++) {
          const t = i / n, p = qp(t), u = qd(t), o = off(t, 1);
          rg.moveTo(p[0] + o[0] * 5.2, p[1] + o[1] * 5.2);
          rg.quadraticCurveTo(p[0] + u[0] * 1.5, p[1] + u[1] * 1.5, p[0] - o[0] * 3.2, p[1] - o[1] * 3.2);
        }
        inkStroke(ctx, rg, 1, pal.ink);
        {
          const t = U.clamp(12.5 / (len || 1), 0.05, 0.4), p = qp(t), o = off(t, 1);
          const cl = new Path2D();
          cl.moveTo(p[0] - o[0] * 7, p[1] - o[1] * 7);
          cl.lineTo(p[0] + o[0] * 7, p[1] + o[1] * 7);
          inkStroke(ctx, cl, 3.6, K.metalD);
          const sd = new Path2D();
          dots(sd, [p[0] - o[0] * 5.6, p[1] - o[1] * 5.6], 1.2);
          ctx.fillStyle = pal.ink;
          ctx.fill(sd);
        }
        // shoulder bolt: a ring and a cross-head screw
        Draw.circle(ctx, s[0], s[1], 8, pc.body, lw * 0.8, pal.ink);
        {
          const hd = new Path2D(), bi = new Path2D();
          bi.moveTo(s[0] + 5.4, s[1]);
          bi.arc(s[0], s[1], 5.4, 0, TAU);
          dots(hd, [s[0], s[1]], 2.7);
          ctx.fillStyle = pc.metal;
          ctx.fill(hd);
          bi.moveTo(s[0] + 2.7, s[1]);
          bi.arc(s[0], s[1], 2.7, 0, TAU);
          bi.moveTo(s[0] - 1.6, s[1] - 1.6);
          bi.lineTo(s[0] + 1.6, s[1] + 1.6);
          bi.moveTo(s[0] + 1.6, s[1] - 1.6);
          bi.lineTo(s[0] - 1.6, s[1] + 1.6);
          inkStroke(ctx, bi, 1.2, pal.ink);
        }
        if (!back && f.data && f.data.fistOut) {
          Draw.circle(ctx, h[0], h[1], 7, pc.metal, lw * 0.8, pal.ink);
          Draw.circle(ctx, h[0], h[1], 3, pal.ink, 0);
          // the empty socket's screw thread
          const th = new Path2D();
          th.arc(h[0], h[1], 5.2, -2.4, 0.4);
          th.moveTo(h[0] + 5.2 * Math.cos(1.2), h[1] + 5.2 * Math.sin(1.2));
          th.arc(h[0], h[1], 5.2, 1.2, 2.6);
          inkStroke(ctx, th, 1.1, pal.ink);
          return;
        }
        const ang = Math.atan2(h[1] - cy, h[0] - cx);
        const style = back ? J.P.handB : J.P.hand;
        mitten(ctx, h[0], h[1], f.C.body.handR, ang, pc.hand, pal, lw, style === 'open');
        // charge orb between the hands
        if (!back && J.P.fx === 'charge' && f.md && f.battle) {
          const lvl = f.md.charge || 0;
          orb(ctx, h[0] + 10, h[1] - 4, 10 + lvl * 0.3, pal, f.t || 0);
        }
      },
      front(ctx, f, J, pal) {
        const fx = J.P.fx;
        if (fx === 'zap' || fx === 'beam') {
          ctx.save();
          ctx.strokeStyle = pal.glow;
          ctx.lineWidth = 3;
          const t = f.t || 0;
          for (let i = 0; i < 4; i++) {
            const a = t * 0.7 + i * 1.6;
            const x0 = J.head[0] + Math.cos(a) * 40, y0 = J.head[1] - 40 + Math.sin(a) * 30;
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.lineTo(x0 + Math.cos(a + 1) * 14, y0 + Math.sin(a + 2) * 14);
            ctx.lineTo(x0 + Math.cos(a) * 24, y0 + Math.sin(a + 1) * 20);
            ctx.stroke();
          }
          ctx.restore();
        }
        if (f.state === 'attack' && f.moveId === '2S' && f.mf >= 10 && f.mf <= 29) {
          // static field bubble
          ctx.save();
          const r = 84 + Math.sin((f.t || 0) * 0.8) * 4;
          ctx.globalAlpha = 0.25;
          Draw.circle(ctx, 0, -100, r, pal.glow, 0);
          ctx.globalAlpha = 0.9;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;
          ctx.beginPath();
          for (let i = 0; i <= 24; i++) {
            const a = (i / 24) * TAU;
            const rr = r + (U.hash(i + Math.floor((f.t || 0) / 2)) - 0.5) * 16;
            const px = Math.cos(a) * rr, py = -100 + Math.sin(a) * rr;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.stroke();
          ctx.restore();
        }
      },
      // the rig's own leg (same shapes and colors), with a robot's hardware on it
      leg(ctx, f, J, side, pc, pal) {
        const C = f.C, b = C.body, back = side === 'B';
        const hp = back ? J.hipB : J.hipF, k = back ? J.kB : J.kF, a = back ? J.aB : J.aF, t = back ? J.tB : J.tF;
        Rig.limb(ctx, hp, k, a, b.legR[0], b.legR[1], b.legR[2], pc.metal, pc.metal, C.lw, pal.ink);
        // segment frames: u along, n toward the front
        const seg = (p, q) => {
          let ux = q[0] - p[0], uy = q[1] - p[1];
          const L = Math.hypot(ux, uy) || 1;
          ux /= L;
          uy /= L;
          const nx = uy, ny = -ux;
          return (al, ac) => [p[0] + ux * L * al + nx * ac, p[1] + uy * L * al + ny * ac];
        };
        const th = seg(hp, k), sh = seg(k, a);
        const r0 = b.legR[0], r1 = b.legR[1];
        const ink = new Path2D(), dk = new Path2D();
        // thigh: two armour rings
        for (const al of [0.52, 0.64]) {
          const r = r0 + (r1 - r0) * al;
          let q = th(al, -r);
          ink.moveTo(q[0], q[1]);
          const m = th(al + 0.05, 0);
          q = th(al, r);
          ink.quadraticCurveTo(m[0], m[1], q[0], q[1]);
        }
        // shin: a guard plate seam down its front, its rivets and vent slots
        let q = sh(0.3, r1 * 0.2);
        ink.moveTo(q[0], q[1]);
        let m = sh(0.55, r1 * 0.05);
        q = sh(0.86, r1 * 0.25);
        ink.quadraticCurveTo(m[0], m[1], q[0], q[1]);
        if (!back) {
          for (const al of [0.48, 0.58, 0.68]) {
            q = sh(al, -r1 * 0.75);
            ink.moveTo(q[0], q[1]);
            q = sh(al, -r1 * 0.3);
            ink.lineTo(q[0], q[1]);
          }
        }
        inkStroke(ctx, ink, 1.1, pal.ink);
        q = sh(0.42, r1 * 0.55);
        m = sh(0.74, r1 * 0.6);
        dots(dk, [q[0], q[1], m[0], m[1]], 0.95);
        ctx.fillStyle = pal.ink;
        ctx.fill(dk);
        // knee bolt
        const kd = new Path2D(), kb = new Path2D(), kh = new Path2D();
        dots(kd, [k[0], k[1]], 5.4);
        ctx.fillStyle = pc.body;
        ctx.fill(kd);
        dots(kh, [k[0], k[1]], 2.4);
        ctx.fillStyle = pc.metal;
        ctx.fill(kh);
        kb.moveTo(k[0] + 4.6 * Math.cos(1.25), k[1] + 4.6 * Math.sin(1.25));
        kb.arc(k[0], k[1], 4.6, 1.25, 3.05);
        kb.moveTo(k[0] + 2.4, k[1]);
        kb.arc(k[0], k[1], 2.4, 0, TAU);
        kb.moveTo(k[0] - 1.5, k[1] - 0.9);
        kb.lineTo(k[0] + 1.5, k[1] + 0.9);
        inkStroke(ctx, kb, 1.1, pal.ink);
        Rig.drawFoot(ctx, f, J, a, t, pc.foot, pal, back);
      },
      foot(ctx, f, J, a, t, col, pal, back) {
        const ang = Math.atan2(t[1] - a[1], t[0] - a[0]);
        const L = Math.hypot(t[0] - a[0], t[1] - a[1]);
        const K = tones(back ? pal.dark : pal);
        ctx.save();
        ctx.translate(a[0], a[1]);
        ctx.rotate(ang);
        Draw.roundRect(ctx, -11, -10, L + 20, 20, 10, col, f.C.lw, pal.ink);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(-4, -7, L, 4);
        // ---- a rubber sole with treads, the toe cap's seam, a strap, an ankle
        // bolt and rivets
        const shape = new Path2D();
        Draw.roundRectPath(shape, -11, -10, L + 20, 20, 10);
        ctx.save();
        ctx.clip(shape);
        const sole = new Path2D();
        sole.rect(-12, 5.4, L + 22, 6);
        ctx.fillStyle = pal.ink;
        ctx.fill(sole);
        const tr = new Path2D();
        for (let x = -7; x < L + 9; x += 3.7) {
          tr.moveTo(x, 10.5);
          tr.lineTo(x + 0.9, 7.6);
        }
        inkStroke(ctx, tr, 1.4, K.footHi);
        ctx.restore();
        const sm = new Path2D(), dk = new Path2D(), hd = new Path2D();
        sm.moveTo(L - 1.5, -9.6);
        sm.quadraticCurveTo(L - 5.5, -2, L - 1.5, 5.4);
        sm.moveTo(4.6, -9.8);
        sm.lineTo(4.6, 5.4);
        sm.moveTo(8, -9.8);
        sm.lineTo(8, 5.4);
        dots(hd, [-2.6, -1.4], 3.3);
        ctx.fillStyle = K.footHi;
        ctx.fill(hd);
        sm.moveTo(-2.6 + 3.3, -1.4);
        sm.arc(-2.6, -1.4, 3.3, 0, TAU);
        inkStroke(ctx, sm, 1.3, pal.ink);
        dots(dk, [-2.6, -1.4, 6.3, -6.6, 6.3, 2, L + 4.5, -3.5], 1.05);
        ctx.fillStyle = pal.ink;
        ctx.fill(dk);
        ctx.restore();
      },
    },

    post(f) {
      const c = f.cos;
      if (!c.ant) c.ant = { a: 0, v: 0, px: null, py: 0 };
      const A = c.ant;
      const hx = (f.x || 0) + f.J.head[0] * f.facing, hy = -(f.y || 0) + f.J.head[1];
      if (A.px !== null) {
        const vx = hx - A.px, vy = hy - A.py;
        A.v += -vx * f.facing * 1.6 + vy * 0.6;
      }
      A.px = hx;
      A.py = hy;
      A.v += -A.a * 0.12;
      A.v *= 0.86;
      A.a = U.clamp(A.a + A.v, -50, 50);
    },

    onReset(f) {
      f.data.fistOut = false;
      f.data.beaming = false;
    },
  });
})();
