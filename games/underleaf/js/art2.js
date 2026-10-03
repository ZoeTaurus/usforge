'use strict';
/* Art for the larger and newer animals. Same conventions as art.js:
   creatures face +x in their own frame, light from the top left. */

function chainPath(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
  }
  const l = pts[pts.length - 1];
  ctx.lineTo(l.x, l.y);
}

/* -------------------------------------------------------------------- crab */

const CRAB_LEGS = [0, 1, 2, 3].map((i) => ({ bx: 5 - i * 4.2, by: 11, base: 1.25 + i * 0.28, bend: 0.5 + i * 0.1, l1: 13, l2: 14, w1: 3.4, w2: 2.2 }));
const CRAB_PALS = { green: ['#5c6c38', '#b8c07c', '#1e260e'], red: ['#a8401e', '#f29a66', '#3a1006'] };
const CRAB_SHELL = [[11, 0], [10.5, -5], [9, -10], [6, -14], [1, -15.5], [-5, -14], [-10, -10], [-12.5, -4], [-12.5, 4], [-10, 10], [-5, 14], [1, 15.5], [6, 14], [9, 10], [10.5, 5]];

function drawCrab(ctx, e, t) {
  const s = e.size, L = localLight(e.a), pal = CRAB_PALS[e.variant || 'green'];
  softShadow(ctx, e.x + 6 * s, e.y + 8 * s, e.a, 30 * s, 36 * s, 0.34);
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.a);
  ctx.scale(s, s);
  drawLegs(ctx, CRAB_LEGS, e.gait, pal[2], 0.3, e.dead);
  drawLegs(ctx, CRAB_LEGS, e.gait, pal[0], 0.3, e.dead, 0.55);
  const pinch = e.biteT > 0 ? Math.sin((e.biteT / 0.35) * Math.PI) : 0.1;
  for (let side = -1; side <= 1; side += 2) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = pal[2]; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(7, side * 9); ctx.quadraticCurveTo(13, side * 17, 18, side * 15); ctx.stroke();
    ctx.strokeStyle = pal[0]; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(7, side * 9); ctx.quadraticCurveTo(13, side * 17, 18, side * 15); ctx.stroke();
    ctx.save();
    ctx.translate(22, side * 14);
    ctx.rotate(side * -0.3);
    shadedEllipse(ctx, 0, 0, 8, 5.2, pal, L);
    ctx.fillStyle = pal[0];
    ctx.save(); ctx.rotate(-side * pinch * 0.5);
    ctx.beginPath(); ctx.moveTo(5, -side * 2); ctx.quadraticCurveTo(11, -side * 3, 13.5, -side * 0.6); ctx.quadraticCurveTo(10, -side * 0.6, 5, side * 0.3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1a1208'; ctx.beginPath(); ctx.arc(13, -side * 0.7, 0.9, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = pal[0];
    ctx.beginPath(); ctx.moveTo(5, side * 2.2); ctx.quadraticCurveTo(11, side * 3, 13, side * 0.8); ctx.quadraticCurveTo(10, side * 1, 5, side * 0.4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1a1208'; ctx.beginPath(); ctx.arc(12.6, side * 0.9, 0.9, 0, TAU); ctx.fill();
    gloss(ctx, 0, 0, 8, 5.2, L, 0.3);
    ctx.restore();
  }
  smoothPoly(ctx, CRAB_SHELL);
  const g = ctx.createRadialGradient(L.x * 5, L.y * 6, 1, 0, 0, 17);
  g.addColorStop(0, pal[1]); g.addColorStop(0.5, pal[0]); g.addColorStop(1, pal[2]);
  ctx.fillStyle = g; ctx.fill();
  ctx.fillStyle = pal[0];
  for (let side = -1; side <= 1; side += 2) {
    for (let k = 0; k < 4; k++) {
      const a = 0.35 + k * 0.28, x = Math.cos(a) * 12.2, y = side * Math.sin(a) * 15.2;
      ctx.beginPath(); ctx.moveTo(x - 1.2, y - side * 0.4); ctx.lineTo(x + 1.6, y + side * 1.4); ctx.lineTo(x - 2.2, y + side * 1.8); ctx.fill();
    }
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.moveTo(-6, -6); ctx.quadraticCurveTo(0, -2, -6, 0); ctx.quadraticCurveTo(0, 2, -6, 6); ctx.stroke();
  const R = mulberry32(e.id || 9);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let i = 0; i < 26; i++) { const a = R() * TAU, d = Math.sqrt(R()) * 12; ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d * 1.2, 0.5 + R() * 0.8, 0, TAU); ctx.fill(); }
  for (let side = -1; side <= 1; side += 2) {
    ctx.fillStyle = '#120c06'; ctx.beginPath(); ctx.arc(11.6, side * 3.6, 1.6, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(11.1, side * 3.6 - 0.5, 0.5, 0, TAU); ctx.fill();
  }
  gloss(ctx, 0, 0, 12, 15, L, 0.25);
  if (e.hurtT > 0) { ctx.fillStyle = 'rgba(255,240,220,0.3)'; ctx.beginPath(); ctx.arc(0, 0, 16, 0, TAU); ctx.fill(); }
  ctx.restore();
}

/* -------------------------------------------------------------------- frog */

const FROG_PAL = ['#5f8f3a', '#bce07c', '#1e3a10'];

function drawFrog(ctx, e, t) {
  const s = e.size, L = localLight(e.a), hop = e.hop || 0, z = hop * 16;
  softShadow(ctx, e.x + (6 + z * 0.5) * s, e.y + (8 + z * 0.8) * s, e.a, 34 * s, 26 * s, 0.32);
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.a);
  const k = s * (1 + hop * 0.14);
  ctx.scale(k, k);
  const pal = e.dead ? ['#7a8a5a', '#c0c8a0', '#3a4228'] : e.pal || FROG_PAL;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let side = -1; side <= 1; side += 2) {
    if (hop > 0.3) {
      ctx.strokeStyle = pal[0]; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(-14, side * 10); ctx.lineTo(-30, side * 15); ctx.lineTo(-46, side * 12); ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = pal[2];
      for (let f = -1; f <= 1; f++) { ctx.beginPath(); ctx.moveTo(-46, side * 12); ctx.lineTo(-54, side * (12 + f * 4)); ctx.stroke(); }
    } else {
      ctx.save(); ctx.translate(-11, side * 15); ctx.rotate(side * 0.35);
      shadedEllipse(ctx, 0, 0, 14, 6.5, pal, L);
      ctx.restore();
      ctx.strokeStyle = pal[0]; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-20, side * 20); ctx.lineTo(-4, side * 24); ctx.stroke();
      ctx.lineWidth = 1.6;
      for (let f = -1; f <= 2; f++) { ctx.beginPath(); ctx.moveTo(-4, side * 24); ctx.lineTo(3, side * (24 + f * 2.6)); ctx.stroke(); }
    }
    ctx.strokeStyle = pal[0]; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(8, side * 11); ctx.lineTo(13, side * 19); ctx.stroke();
    ctx.lineWidth = 1.3;
    for (let f = -1; f <= 1; f++) { ctx.beginPath(); ctx.moveTo(13, side * 19); ctx.lineTo(18, side * (19 + f * 2.5)); ctx.stroke(); }
  }
  ctx.beginPath();
  ctx.moveTo(25, 0);
  ctx.bezierCurveTo(23, -14, -4, -20, -18, -12);
  ctx.quadraticCurveTo(-25, 0, -18, 12);
  ctx.bezierCurveTo(-4, 20, 23, 14, 25, 0);
  const g = ctx.createRadialGradient(L.x * 8, L.y * 8, 2, 0, 0, 26);
  g.addColorStop(0, pal[1]); g.addColorStop(0.5, pal[0]); g.addColorStop(1, pal[2]);
  ctx.fillStyle = g; ctx.fill();
  const R = mulberry32(e.id || 4);
  ctx.fillStyle = 'rgba(30,50,15,0.45)';
  for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.ellipse(-14 + R() * 26, (R() - 0.5) * 18, 2 + R() * 2.6, 1.6 + R() * 1.8, R() * 3, 0, TAU); ctx.fill(); }
  if (e.warty) {
    // a toad's dry, warty skin and the big poison glands behind the eyes
    for (let i = 0; i < 26; i++) {
      const wx = -16 + R() * 32, wy = (R() - 0.5) * 22, wr = 0.9 + R() * 1.6;
      ctx.fillStyle = 'rgba(40,24,10,0.45)'; ctx.beginPath(); ctx.arc(wx + 0.5, wy + 0.6, wr, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(220,180,120,0.55)'; ctx.beginPath(); ctx.arc(wx - wr * 0.3, wy - wr * 0.3, wr * 0.55, 0, TAU); ctx.fill();
    }
    for (let side = -1; side <= 1; side += 2) shadedEllipse(ctx, 4, side * 10, 6, 3, ['#8a6436', '#c89a60', '#4a3016'], L);
  }
  ctx.strokeStyle = 'rgba(230,240,180,0.35)'; ctx.lineWidth = 1.2;
  for (let side = -1; side <= 1; side += 2) { ctx.beginPath(); ctx.moveTo(14, side * 8); ctx.quadraticCurveTo(0, side * 12, -15, side * 9); ctx.stroke(); }
  for (let side = -1; side <= 1; side += 2) {
    shadedEllipse(ctx, 13, side * 9, 5.4, 5.4, pal, L);
    ctx.fillStyle = '#d4a020'; ctx.beginPath(); ctx.arc(13.5, side * 9.4, 3.4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#0a0a06'; ctx.beginPath(); ctx.ellipse(13.5, side * 9.4, 2.4, 1.2, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(12.6, side * 9.4 - 1.2, 0.9, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1a2a0c'; ctx.beginPath(); ctx.arc(22.5, side * 2.6, 0.7, 0, TAU); ctx.fill();
  }
  gloss(ctx, 0, 0, 22, 15, L, e.warty ? 0.08 : 0.3);
  if (e.hurtT > 0) { ctx.fillStyle = 'rgba(255,240,220,0.3)'; ctx.beginPath(); ctx.ellipse(0, 0, 24, 18, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
  if (e.tongueT > 0 && e.tx !== undefined) {
    const mx = e.x + Math.cos(e.a) * 25 * s, my = e.y + Math.sin(e.a) * 25 * s;
    const k2 = e.tongueK;
    const ex = lerp(mx, e.tx, k2), ey = lerp(my, e.ty, k2);
    ctx.strokeStyle = '#d85a7a'; ctx.lineWidth = 3.2 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.fillStyle = '#f08aa8'; ctx.beginPath(); ctx.arc(ex, ey, 4.4 * s, 0, TAU); ctx.fill();
  }
}

/* ------------------------------------------------------------------ lizard */

const LIZ_PAL = { base: '#6e6034', light: '#b8a868', dark: '#2e2810', stripe: '#3a3016', dot: 'rgba(240,230,170,0.6)' };

function lizardSpine(e) {
  const pts = [];
  const amp = e.sway ?? 1;
  for (let i = 0; i <= 26; i++) {
    const x = 30 - i * 6.2;
    const y = Math.sin(e.gait - i * 0.32) * (1.2 + i * 0.45) * amp;
    let w;
    if (i < 2) w = 5 + i * 1.5;
    else if (i < 4) w = 6.5 - (i - 2) * 0.6;
    else if (i < 11) w = 8 + Math.sin(((i - 4) / 7) * Math.PI) * 2.6;
    else w = 7.4 * Math.pow(1 - (i - 11) / 16, 1.3) + 0.5;
    pts.push({ x, y, w });
  }
  return pts;
}

function drawLizard(ctx, e, t) {
  const s = e.size, L = localLight(e.a);
  const pts = lizardSpine(e);
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.a);
  ctx.scale(s, s);
  const outline = (ox, oy) => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x + 3 + ox, pts[0].y + oy);
    for (const p of pts) ctx.lineTo(p.x + ox, p.y - p.w + oy);
    for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i].x + ox, pts[i].y + pts[i].w + oy);
    ctx.closePath();
  };
  const so = rotV(5, 7, -e.a);
  outline(so[0], so[1]); ctx.fillStyle = 'rgba(18,16,4,0.25)'; ctx.fill();
  // legs at shoulder (i=5) and hip (i=10)
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = LIZ_PAL.base;
  const legPh = e.gait;
  for (const [idx, dir] of [[5, 1], [10, -1]]) {
    const p = pts[idx];
    for (let side = -1; side <= 1; side += 2) {
      const sw = e.dead ? 0 : Math.sin(legPh + (side * dir > 0 ? 0 : Math.PI)) * 0.5;
      const a1 = side * (Math.PI / 2 - dir * 0.4 + sw);
      const kx = p.x + Math.cos(a1) * 11, ky = p.y + side * p.w * 0.6 + Math.sin(a1) * 11;
      const a2 = a1 + side * dir * -0.9;
      const fx = kx + Math.cos(a2) * 8, fy = ky + Math.sin(a2) * 8;
      ctx.lineWidth = 3.6; ctx.beginPath(); ctx.moveTo(p.x, p.y + side * p.w * 0.5); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
      ctx.lineWidth = 1.1;
      for (let f = -2; f <= 2; f++) { const ta = a2 + f * 0.4; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + Math.cos(ta) * 4.5, fy + Math.sin(ta) * 4.5); ctx.stroke(); }
    }
  }
  outline(0, 0);
  const g = ctx.createLinearGradient(0, -10, 0, 10);
  g.addColorStop(0, LIZ_PAL.light); g.addColorStop(0.45, LIZ_PAL.base); g.addColorStop(1, LIZ_PAL.dark);
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = LIZ_PAL.stripe; ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.moveTo(pts[2].x, pts[2].y);
  for (let i = 3; i < 20; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
  ctx.fillStyle = LIZ_PAL.dot;
  for (let i = 4; i < 16; i++) {
    const p = pts[i];
    for (let side = -1; side <= 1; side += 2) { ctx.beginPath(); ctx.arc(p.x, p.y + side * p.w * 0.55, 0.9, 0, TAU); ctx.fill(); }
  }
  const h = pts[0];
  for (let side = -1; side <= 1; side += 2) {
    ctx.fillStyle = '#120c04'; ctx.beginPath(); ctx.arc(h.x - 3, h.y + side * 4.2, 1.5, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(h.x - 3.4, h.y + side * 4.2 - 0.5, 0.45, 0, TAU); ctx.fill();
  }
  if (e.tongueT > 0) {
    ctx.strokeStyle = '#c8405a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(h.x + 3, h.y); ctx.lineTo(h.x + 10, h.y); ctx.lineTo(h.x + 13, h.y - 2); ctx.moveTo(h.x + 10, h.y); ctx.lineTo(h.x + 13, h.y + 2); ctx.stroke();
  }
  if (e.hurtT > 0) { outline(0, 0); ctx.fillStyle = 'rgba(255,240,220,0.3)'; ctx.fill(); }
  ctx.restore();
}

/* -------------------------------------------------------------------- bird */

function birdShape(ctx, e, t, solid, L) {
  const fly = e.flying, flap = fly ? Math.sin(t * 13 + e.id) : 0;
  const fill = (pal, draw) => {
    draw();
    if (solid) { ctx.fill(); return; }
    ctx.fillStyle = pal; ctx.fill();
  };
  if (fly) {
    for (let side = -1; side <= 1; side += 2) {
      const span = 58 * (0.55 + 0.45 * Math.abs(flap)) + 8;
      fill('#5a4230', () => {
        ctx.beginPath();
        ctx.moveTo(8, side * 6);
        ctx.quadraticCurveTo(10, side * span * 0.6, -2, side * span);
        ctx.lineTo(-12, side * (span - 4));
        ctx.lineTo(-10, side * span * 0.6);
        ctx.quadraticCurveTo(-14, side * span * 0.3, -12, side * 6);
        ctx.closePath();
      });
      if (!solid) {
        ctx.strokeStyle = 'rgba(30,20,10,0.4)'; ctx.lineWidth = 0.8;
        for (let f = 0; f < 5; f++) { const yy = side * (span * 0.45 + f * span * 0.11); ctx.beginPath(); ctx.moveTo(-1 + f * 0.3, yy); ctx.lineTo(-12, yy + side * 3); ctx.stroke(); }
      }
    }
  }
  fill('#4a3424', () => { ctx.beginPath(); ctx.moveTo(-20, -6); ctx.lineTo(-44, -11); ctx.quadraticCurveTo(-48, 0, -44, 11); ctx.lineTo(-20, 6); ctx.closePath(); });
  if (solid) { ctx.beginPath(); ctx.ellipse(-3, 0, 24, 15, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(18, 0, 10, 0, TAU); ctx.fill(); return; }
  ctx.fillStyle = '#e06a28';
  ctx.beginPath(); ctx.ellipse(8, 0, 13, 13.5, 0, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(-6 + L.x * 8, L.y * 6, 2, -4, 0, 26);
  g.addColorStop(0, '#c8a07a'); g.addColorStop(0.5, '#7a5c40'); g.addColorStop(1, '#2e1e10');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(-5, 0, 23, 14, 0, 0, TAU); ctx.fill();
  if (!fly) {
    ctx.fillStyle = 'rgba(40,26,14,0.55)';
    for (let side = -1; side <= 1; side += 2) { ctx.beginPath(); ctx.ellipse(-9, side * 8, 18, 5.5, side * 0.08, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = 'rgba(220,190,150,0.35)'; ctx.lineWidth = 0.8;
    for (let side = -1; side <= 1; side += 2) for (let f = 0; f < 4; f++) { ctx.beginPath(); ctx.moveTo(-2 - f * 5, side * 11); ctx.lineTo(-10 - f * 5, side * 7); ctx.stroke(); }
  }
  shadedEllipse(ctx, 17, 0, 10, 10, ['#6e5644', '#b49478', '#2a1e14'], L);
  ctx.fillStyle = '#3a2a16';
  ctx.beginPath(); ctx.moveTo(25, -2.6); ctx.lineTo(36 + (e.peckT > 0 ? 4 : 0), 0); ctx.lineTo(25, 2.6); ctx.closePath(); ctx.fill();
  for (let side = -1; side <= 1; side += 2) {
    ctx.fillStyle = '#0a0806'; ctx.beginPath(); ctx.arc(21, side * 6.4, 1.9, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(20.4, side * 6.4 - 0.6, 0.6, 0, TAU); ctx.fill();
  }
}

function drawBird(ctx, e, t) {
  const s = e.size, z = e.z, L = localLight(e.a);
  ctx.save();
  ctx.translate(e.x + z * 0.6 + 4, e.y + z * 0.9 + 6);
  ctx.rotate(e.a);
  ctx.scale(s, s);
  ctx.fillStyle = `rgba(15,18,5,${0.3 * (1 - Math.min(0.55, z / 500))})`;
  birdShape(ctx, e, t, true, L);
  ctx.restore();
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.a);
  const zs = s * (1 + z * 0.0025);
  ctx.scale(zs, zs);
  // lunge forward when pecking, and bob slightly while standing
  if (e.peckT > 0) ctx.translate(Math.sin((e.peckT / 0.22) * Math.PI) * 7, 0);
  else if (!e.flying && !e.hop) ctx.translate(Math.sin(t * 6 + e.id) * 0.6, 0);
  birdShape(ctx, e, t, false, L);
  ctx.restore();
}

/* ------------------------------------------------------------------- mouse */

function drawMouse(ctx, e, t) {
  const s = e.size, L = localLight(e.a);
  softShadow(ctx, e.x + 5 * s, e.y + 7 * s, e.a, 32 * s, 19 * s, 0.32);
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.a);
  ctx.scale(s, s);
  const w = e.dead ? 0 : Math.sin(t * 3 + e.id) * 10;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#b8908a'; ctx.lineWidth = 3.2;
  ctx.beginPath(); ctx.moveTo(-24, 0); ctx.bezierCurveTo(-45, w, -60, -w, -72, w * 0.6); ctx.stroke();
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(-70, w * 0.55); ctx.lineTo(-84, w * 0.1 + 4); ctx.stroke();
  ctx.fillStyle = '#e0a8a0';
  const st = e.dead ? 0 : Math.sin(e.gait) * 3;
  for (let side = -1; side <= 1; side += 2) {
    ctx.beginPath(); ctx.ellipse(12 + st * side, side * 13, 3, 2, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-12 - st * side, side * 15, 4, 2.4, 0, 0, TAU); ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(31, 0);
  ctx.bezierCurveTo(27, -12, 4, -19, -14, -17);
  ctx.bezierCurveTo(-32, -14, -32, 14, -14, 17);
  ctx.bezierCurveTo(4, 19, 27, 12, 31, 0);
  const g = ctx.createRadialGradient(L.x * 8, L.y * 7, 2, 0, 0, 30);
  g.addColorStop(0, '#d8ccbc'); g.addColorStop(0.5, '#8c7c6c'); g.addColorStop(1, '#3a3028');
  ctx.fillStyle = g; ctx.fill();
  const R = mulberry32(e.id || 3);
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 70; i++) {
    const x = -24 + R() * 48, y = (R() - 0.5) * 26;
    ctx.strokeStyle = R() < 0.5 ? 'rgba(255,245,230,0.18)' : 'rgba(30,24,18,0.2)';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + (R() - 0.5)); ctx.stroke();
  }
  for (let side = -1; side <= 1; side += 2) {
    ctx.fillStyle = '#9a8678'; ctx.beginPath(); ctx.arc(11, side * 11, 6.8, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e8b0a8'; ctx.beginPath(); ctx.arc(11.5, side * 11.5, 4.3, 0, TAU); ctx.fill();
    ctx.fillStyle = '#0a0806'; ctx.beginPath(); ctx.arc(21, side * 6, 2.3, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(20.3, side * 6 - 0.8, 0.7, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(240,235,225,0.55)'; ctx.lineWidth = 0.4;
    for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(28, side * 2.5); ctx.lineTo(38, side * (5 + k * 4)); ctx.stroke(); }
  }
  ctx.fillStyle = '#e88a90'; ctx.beginPath(); ctx.arc(31.5, 0, 2, 0, TAU); ctx.fill();
  if (e.hurtT > 0) { ctx.fillStyle = 'rgba(255,240,220,0.3)'; ctx.beginPath(); ctx.ellipse(0, 0, 30, 18, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
}

/* --------------------------------------------------------------- earthworm */

function drawWorm(ctx, e, t) {
  const pts = e.segs;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.save(); ctx.translate(3, 4); chainPath(ctx, pts); ctx.strokeStyle = 'rgba(18,16,4,0.22)'; ctx.lineWidth = 9; ctx.stroke(); ctx.restore();
  chainPath(ctx, pts); ctx.strokeStyle = e.dead ? '#6a4a44' : '#7a3a34'; ctx.lineWidth = 9; ctx.stroke();
  chainPath(ctx, pts); ctx.strokeStyle = e.dead ? '#a88a84' : '#cc7a70'; ctx.lineWidth = 7; ctx.stroke();
  ctx.save(); ctx.translate(-1, -1.2); chainPath(ctx, pts); ctx.strokeStyle = 'rgba(255,220,210,0.45)'; ctx.lineWidth = 2.2; ctx.stroke(); ctx.restore();
  const n = pts.length;
  for (let i = 1; i < n - 1; i++) {
    const p = pts[i], q = pts[i + 1];
    const a = Math.atan2(q.y - p.y, q.x - p.x), nx = -Math.sin(a), ny = Math.cos(a);
    if (i >= 3 && i <= 5) {
      ctx.strokeStyle = 'rgba(230,150,130,0.9)'; ctx.lineWidth = 3.4;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(90,30,26,0.3)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(p.x + nx * 3.6, p.y + ny * 3.6); ctx.lineTo(p.x - nx * 3.6, p.y - ny * 3.6); ctx.stroke();
  }
}

/* --------------------------------------------------------------- centipede */

function drawCentipede(ctx, e, t) {
  const pts = e.segs, n = pts.length;
  for (let i = n - 1; i >= 0; i -= 3) softShadow(ctx, pts[i].x + 2.5, pts[i].y + 3.5, 0, 7, 6, 0.2);
  ctx.lineCap = 'round';
  for (let i = n - 1; i >= 0; i--) {
    const p = pts[i], q = pts[Math.max(0, i - 1)];
    const a = i === 0 ? Math.atan2(p.y - pts[1].y, p.x - pts[1].x) : Math.atan2(q.y - p.y, q.x - p.x);
    const L = localLight(a);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(a);
    const leg = i === n - 1 ? 13 : 9;
    ctx.strokeStyle = '#7a3c14'; ctx.lineWidth = 1;
    for (let side = -1; side <= 1; side += 2) {
      const w = e.dead ? 0.6 : Math.sin(t * 16 - i * 0.9 + (side > 0 ? Math.PI : 0)) * 0.45;
      const la = side * (i === n - 1 ? 2.7 : 1.9 + w);
      ctx.beginPath(); ctx.moveTo(0, side * 3.5); ctx.lineTo(Math.cos(la) * leg, side * 3.5 + Math.sin(la) * leg); ctx.stroke();
    }
    if (i === 0) {
      shadedEllipse(ctx, 0, 0, 4.4, 4.6, ['#8a3a10', '#e08a50', '#2a0e02'], L);
      ctx.strokeStyle = '#3a1806'; ctx.lineWidth = 1.2;
      for (let side = -1; side <= 1; side += 2) {
        ctx.beginPath(); ctx.moveTo(3, side * 2); ctx.quadraticCurveTo(6.5, side * 3, 6, side * 0.4); ctx.stroke();
        ctx.lineWidth = 0.7;
        const aw = Math.sin(t * 4 + side) * 0.2;
        ctx.beginPath(); ctx.moveTo(3.5, side * 2); ctx.quadraticCurveTo(12, side * (6 + aw * 10), 20, side * (5 + aw * 20)); ctx.stroke();
        ctx.lineWidth = 1.2;
      }
    } else {
      shadedEllipse(ctx, 0, 0, 3.3, 4.6, ['#9a5a24', '#e6aa66', '#3a1a06'], L);
      ctx.strokeStyle = 'rgba(40,15,0,0.4)'; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(-2.6, -3.6); ctx.quadraticCurveTo(-3.4, 0, -2.6, 3.6); ctx.stroke();
    }
    ctx.restore();
  }
}

/* -------------------------------------------------------------- millipede */

function drawMillipede(ctx, e, t) {
  const pts = e.segs, n = pts.length;
  if (e.curl > 0.5) {
    softShadow(ctx, e.x + 3, e.y + 4, 0, 14, 13, 0.3);
    for (let i = n - 1; i >= 0; i--) {
      const th = (i / n) * Math.PI * 3.4 + e.roll;
      const r = 3 + (i / n) * 10;
      const x = e.x + Math.cos(th) * r, y = e.y + Math.sin(th) * r;
      shadedEllipse(ctx, x, y, 3.4, 3.4, ['#3a2a24', '#8a7468', '#0e0806'], LIGHT);
    }
    return;
  }
  for (let i = n - 1; i >= 0; i -= 3) softShadow(ctx, pts[i].x + 2, pts[i].y + 3, 0, 5, 5, 0.2);
  for (let i = n - 1; i >= 0; i--) {
    const p = pts[i], q = pts[Math.max(0, i - 1)];
    const a = i === 0 ? Math.atan2(p.y - pts[1].y, p.x - pts[1].x) : Math.atan2(q.y - p.y, q.x - p.x);
    const L = localLight(a);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(a);
    ctx.strokeStyle = '#c8a888'; ctx.lineWidth = 0.5;
    for (let side = -1; side <= 1; side += 2) {
      for (let k = 0; k < 2; k++) {
        const w = Math.sin(t * 10 - i * 0.7 - k) * 0.4;
        ctx.beginPath(); ctx.moveTo(-k * 1.4, side * 2.8); ctx.lineTo(-k * 1.4 + Math.cos(side * (1.6 + w)) * 4, side * 2.8 + Math.sin(side * (1.6 + w)) * 4); ctx.stroke();
      }
    }
    shadedEllipse(ctx, 0, 0, 2.6, 3.5, ['#3a2a24', '#9a8070', '#0e0806'], L);
    ctx.strokeStyle = 'rgba(220,170,90,0.4)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(-1.8, -3); ctx.lineTo(-1.8, 3); ctx.stroke();
    ctx.restore();
  }
}

/* --------------------------------------------------------------- scorpion */

const SCORP_PAL = ['#c9a45e', '#f6e0a6', '#4a3410'];
const SCORP_LEGS = [0, 1, 2, 3].map((i) => ({ bx: 3 - i * 3, by: 5.5, base: 1.0 + i * 0.38, bend: 0.4 + i * 0.12, l1: 10, l2: 11, w1: 2, w2: 1.4 }));

function drawScorpion(ctx, e, t) {
  const s = e.size, L = localLight(e.a);
  softShadow(ctx, e.x + 4 * s, e.y + 6 * s, e.a, 26 * s, 18 * s, 0.32);
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.a);
  ctx.scale(s, s);
  drawLegs(ctx, SCORP_LEGS, e.gait, '#8a6a30', 0.3, e.dead);
  const pinch = e.biteT > 0 ? Math.sin((e.biteT / 0.35) * Math.PI) : 0.15;
  ctx.lineCap = 'round';
  for (let side = -1; side <= 1; side += 2) {
    ctx.strokeStyle = SCORP_PAL[0]; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(8, side * 4); ctx.lineTo(14, side * 12); ctx.lineTo(20, side * 11); ctx.stroke();
    ctx.save(); ctx.translate(25, side * 10); ctx.rotate(-side * 0.2);
    shadedEllipse(ctx, 0, 0, 6.5, 4, SCORP_PAL, L);
    ctx.fillStyle = SCORP_PAL[0];
    ctx.save(); ctx.rotate(-side * pinch * 0.5);
    ctx.beginPath(); ctx.moveTo(4, -side * 1.5); ctx.quadraticCurveTo(9, -side * 2, 11, -side * 0.3); ctx.lineTo(4, side * 0.4); ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.moveTo(4, side * 1.6); ctx.quadraticCurveTo(9, side * 2, 10.5, side * 0.5); ctx.lineTo(4, side * 0.3); ctx.fill();
    ctx.restore();
  }
  for (let i = 6; i >= 0; i--) {
    const x = -3 - i * 2.6, ry = 6.6 - Math.abs(i - 2) * 0.5;
    shadedEllipse(ctx, x, 0, 2.2, ry, SCORP_PAL, L);
  }
  shadedEllipse(ctx, 4, 0, 6.5, 6, SCORP_PAL, L);
  ctx.fillStyle = '#1a1208'; ctx.beginPath(); ctx.arc(6.5, -0.8, 0.8, 0, TAU); ctx.arc(6.5, 0.8, 0.8, 0, TAU); ctx.fill();
  let x = -21, y = 0, a = Math.PI;
  const curl = e.biteT > 0 ? 0.62 : 0.48;
  const side = e.tailSide || 1;
  const segs = [];
  for (let k = 0; k < 5; k++) { segs.push([x, y, a]); x += Math.cos(a) * 5; y += Math.sin(a) * 5; a += side * curl; }
  for (const [sx, sy] of segs) shadedEllipse(ctx, sx, sy, 2.7, 2.7, SCORP_PAL, L);
  shadedEllipse(ctx, x, y, 3.2, 2.6, ['#a8803a', '#f0d090', '#3a2808'], L);
  ctx.strokeStyle = '#2a1806'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 2, y + Math.sin(a) * 2); ctx.quadraticCurveTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5, x + Math.cos(a + side * 1.2) * 5.5, y + Math.sin(a + side * 1.2) * 5.5); ctx.stroke();
  if (e.hurtT > 0) { ctx.fillStyle = 'rgba(255,240,220,0.3)'; ctx.beginPath(); ctx.ellipse(-4, 0, 18, 10, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
}

/* ------------------------------------------------------------ grasshopper */

const HOPPER_PAL = ['#7aa040', '#cce88a', '#2a4010'];

function drawGrasshopper(ctx, e, t) {
  const s = e.size, z = e.z || 0, L = localLight(e.a);
  softShadow(ctx, e.x + (3 + z * 0.6) * s, e.y + (4 + z * 0.9) * s, e.a, 18 * s, 6 * s, 0.3 * (1 - Math.min(0.6, z / 80)));
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.a);
  const zs = s * (1 + z * 0.006);
  ctx.scale(zs, zs);
  const jump = z > 1;
  ctx.lineCap = 'round';
  for (let side = -1; side <= 1; side += 2) {
    ctx.strokeStyle = HOPPER_PAL[0]; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(6, side * 2.5); ctx.lineTo(9, side * 6); ctx.lineTo(12, side * 6.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(3, side * 2.5); ctx.lineTo(3, side * 7); ctx.lineTo(1, side * 9); ctx.stroke();
    ctx.save(); ctx.translate(-1, side * 3.5); ctx.rotate(side * (jump ? 2.9 : 2.75));
    shadedEllipse(ctx, 7, 0, 8, 2.4, HOPPER_PAL, L);
    ctx.strokeStyle = 'rgba(40,60,15,0.5)'; ctx.lineWidth = 0.4;
    for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(2 + k * 2.4, -1.6); ctx.lineTo(3 + k * 2.4, 1.6); ctx.stroke(); }
    ctx.strokeStyle = HOPPER_PAL[2]; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(15, 0);
    if (jump) ctx.lineTo(29, side * 0.5); else ctx.lineTo(3, side * 1.8);
    ctx.stroke();
    ctx.restore();
  }
  shadedEllipse(ctx, -9, 0, 12, 4.2, HOPPER_PAL, L);
  ctx.fillStyle = 'rgba(110,120,60,0.85)';
  ctx.beginPath(); ctx.ellipse(-9, 0, 14, 3.4, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(40,50,15,0.4)'; ctx.lineWidth = 0.4;
  ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(-22, 0); ctx.stroke();
  shadedEllipse(ctx, 4, 0, 6, 4.8, HOPPER_PAL, L);
  shadedEllipse(ctx, 11, 0, 4, 4, HOPPER_PAL, L);
  for (let side = -1; side <= 1; side += 2) {
    shadedEllipse(ctx, 12, side * 2.9, 1.6, 1.4, ['#7a5a2a', '#d8b080', '#2a1a08'], L);
    ctx.strokeStyle = HOPPER_PAL[2]; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(14, side * 1.4); ctx.quadraticCurveTo(22, side * 3, 30, side * 8); ctx.stroke();
  }
  ctx.restore();
}

/* --------------------------------------------------------------------- bee */

function drawBee(ctx, e, t) {
  const s = e.size, z = e.z || 0, L = localLight(e.a);
  softShadow(ctx, e.x + (2 + z * 0.6) * s, e.y + (3 + z * 0.9) * s, e.a, 9 * s, 6 * s, 0.28 * (1 - Math.min(0.6, z / 80)));
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.a);
  const zs = s * (1 + z * 0.006);
  ctx.scale(zs, zs);
  const flying = z > 1 && !e.dead;
  for (let side = -1; side <= 1; side += 2) {
    const f = flying ? 0.3 + 0.7 * Math.abs(Math.sin(t * 55 + e.id)) : 0.25;
    ctx.fillStyle = 'rgba(230,240,250,0.45)'; ctx.strokeStyle = 'rgba(120,130,140,0.5)'; ctx.lineWidth = 0.35;
    ctx.save(); ctx.translate(3, side * 2); ctx.rotate(side * (flying ? 1.3 : 2.7));
    ctx.beginPath(); ctx.ellipse(5.5 * f + 2, 0, 6 * (0.5 + f * 0.5), 2.6, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  ctx.beginPath(); ctx.ellipse(-5, 0, 7.5, 5.2, 0, 0, TAU);
  const g = ctx.createRadialGradient(-5 + L.x * 3, L.y * 2.5, 0.5, -5, 0, 8);
  g.addColorStop(0, '#ffe28a'); g.addColorStop(0.55, '#e0a232'); g.addColorStop(1, '#6a4008');
  ctx.fillStyle = g; ctx.fill();
  ctx.clip();
  ctx.fillStyle = 'rgba(30,18,6,0.85)';
  for (const bx of [-3, -7, -11]) ctx.fillRect(bx - 1, -6, 2, 12);
  ctx.restore();
  shadedEllipse(ctx, 3, 0, 4.6, 4.6, ['#6a4a22', '#c8a060', '#20140a'], L);
  ctx.strokeStyle = 'rgba(240,210,150,0.5)'; ctx.lineWidth = 0.4;
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; ctx.beginPath(); ctx.moveTo(3 + Math.cos(a) * 3.6, Math.sin(a) * 3.6); ctx.lineTo(3 + Math.cos(a) * 5, Math.sin(a) * 5); ctx.stroke(); }
  shadedEllipse(ctx, 8.6, 0, 2.6, 3.2, ['#2a1a0c', '#6a5030', '#0a0602'], L);
  ctx.strokeStyle = '#1a1006'; ctx.lineWidth = 0.5;
  for (let side = -1; side <= 1; side += 2) { ctx.beginPath(); ctx.moveTo(10, side * 1); ctx.lineTo(12, side * 2.4); ctx.lineTo(14, side * 2); ctx.stroke(); }
  ctx.restore();
}

/* ------------------------------------------------------------------ mantis */

const MANTIS_PAL = ['#6aa040', '#ccec8c', '#24400e'];
const MANTIS_LEGS = [
  { bx: 1, by: 1.5, base: 1.4, bend: 0.4, l1: 11, l2: 12, w1: 1, w2: 0.8 },
  { bx: -2, by: 1.5, base: 2.1, bend: 0.4, l1: 13, l2: 15, w1: 1, w2: 0.8 },
];

function drawMantis(ctx, e, t) {
  const s = e.size, L = localLight(e.a);
  softShadow(ctx, e.x + 3 * s, e.y + 5 * s, e.a, 26 * s, 6 * s, 0.3);
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.a);
  ctx.scale(s, s);
  drawLegs(ctx, MANTIS_LEGS, e.gait, MANTIS_PAL[0], 0.2, e.dead);
  shadedEllipse(ctx, -15, 0, 15, 4.6, MANTIS_PAL, L);
  ctx.fillStyle = 'rgba(170,215,120,0.55)'; ctx.strokeStyle = 'rgba(40,70,20,0.4)'; ctx.lineWidth = 0.4;
  ctx.beginPath(); ctx.ellipse(-14, 0, 15, 3.8, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-28, 0); ctx.stroke();
  shadedEllipse(ctx, 6, 0, 9, 2.2, MANTIS_PAL, L);
  const strike = e.biteT > 0 ? Math.sin((e.biteT / 0.3) * Math.PI) : 0;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let side = -1; side <= 1; side += 2) {
    ctx.strokeStyle = MANTIS_PAL[0]; ctx.lineWidth = 2.2;
    const fx = 18 + strike * 10, fy = side * (5 - strike * 2);
    ctx.beginPath(); ctx.moveTo(12, side * 1.6); ctx.lineTo(fx, fy); ctx.stroke();
    ctx.lineWidth = 1.4;
    const tx = strike > 0.2 ? fx + 9 : 13, ty = strike > 0.2 ? side * 2 : side * 2.6;
    ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.strokeStyle = MANTIS_PAL[2]; ctx.lineWidth = 0.4;
    for (let k = 1; k < 4; k++) { const px = lerp(12, fx, k / 4), py = lerp(side * 1.6, fy, k / 4); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - 0.5, py - side * 1.2); ctx.stroke(); }
  }
  ctx.fillStyle = MANTIS_PAL[0];
  ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(19, -5); ctx.lineTo(22, 0); ctx.lineTo(19, 5); ctx.closePath(); ctx.fill();
  for (let side = -1; side <= 1; side += 2) {
    shadedEllipse(ctx, 18.6, side * 4.6, 1.9, 1.9, ['#9ac860', '#f0ffc0', '#3a5a18'], L);
    ctx.fillStyle = '#1a2a0a'; ctx.beginPath(); ctx.arc(19, side * 4.6, 0.6, 0, TAU); ctx.fill();
    ctx.strokeStyle = MANTIS_PAL[2]; ctx.lineWidth = 0.4;
    ctx.beginPath(); ctx.moveTo(20, side * 1); ctx.quadraticCurveTo(30, side * 4, 38, side * 9); ctx.stroke();
  }
  if (e.hurtT > 0) { ctx.fillStyle = 'rgba(255,240,220,0.3)'; ctx.beginPath(); ctx.ellipse(-4, 0, 22, 6, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
}

/* -------------------------------------------------------- weaver outpost */

function drawOutpost(ctx, o, t) {
  const R = mulberry32(o.seed);
  softShadow(ctx, o.x + 6, o.y + 8, 0, 34, 30, 0.35);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + R() * 0.4, l = 26 + R() * 10;
    ctx.save();
    ctx.translate(o.x + Math.cos(a) * 10, o.y + Math.sin(a) * 10);
    ctx.rotate(a);
    leafPath(ctx, l, l * 0.3);
    const g = ctx.createLinearGradient(0, -8, 0, 8);
    g.addColorStop(0, '#9ad060'); g.addColorStop(0.5, '#5a9a34'); g.addColorStop(1, '#2e5a18');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(230,250,200,0.35)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(-l / 2, 0); ctx.lineTo(l / 2, 0); ctx.stroke();
    ctx.restore();
  }
  ctx.strokeStyle = 'rgba(250,250,245,0.55)'; ctx.lineWidth = 0.5;
  for (let i = 0; i < 14; i++) {
    const a = R() * TAU, b = a + 1 + R() * 2;
    ctx.beginPath(); ctx.moveTo(o.x + Math.cos(a) * 18, o.y + Math.sin(a) * 18); ctx.lineTo(o.x + Math.cos(b) * 18, o.y + Math.sin(b) * 18); ctx.stroke();
  }
  radialFill(ctx, o.x + 2, o.y + 2, 7, [[0, '#0a0804'], [1, 'rgba(10,8,4,0)']]);
}

/* -------------------------------------------------------------- corpses */

const CORPSE_DRAW = {
  crab: (c, t) => drawCrab(c, { x: 0, y: 0, a: 0, size: 0.8, gait: 0, dead: true, id: 3 }, t),
  frog: (c, t) => drawFrog(c, { x: 0, y: 0, a: 0, size: 0.6, dead: true, id: 2 }, t),
  lizard: (c, t) => drawLizard(c, { x: 0, y: 0, a: 0, size: 0.55, gait: 1, sway: 2, dead: true }, t),
  mouse: (c, t) => drawMouse(c, { x: 0, y: 0, a: 0, size: 0.6, gait: 0, dead: true, id: 2 }, t),
  worm: (c, t) => {
    const segs = []; for (let i = 0; i < 12; i++) segs.push({ x: 20 - i * 4, y: Math.sin(i * 0.8) * 5 });
    drawWorm(c, { segs, dead: true }, t);
  },
  centipede: (c, t) => {
    const segs = []; for (let i = 0; i < 14; i++) { const a = i * 0.42; segs.push({ x: Math.cos(a) * (14 - i * 0.5), y: Math.sin(a) * (14 - i * 0.5) }); }
    drawCentipede(c, { segs, dead: true }, t);
  },
  scorpion: (c, t) => drawScorpion(c, { x: 0, y: 0, a: 0, size: 0.8, gait: 0, dead: true, biteT: 0 }, t),
  grasshopper: (c, t) => drawGrasshopper(c, { x: 0, y: 0, a: 0, size: 1, z: 0 }, t),
  bee: (c, t) => drawBee(c, { x: 0, y: 0, a: 0, size: 1.1, z: 0, dead: true, id: 1 }, t),
  mantis: (c, t) => drawMantis(c, { x: 0, y: 0, a: 0, size: 0.85, gait: 0, dead: true, biteT: 0 }, t),
};
