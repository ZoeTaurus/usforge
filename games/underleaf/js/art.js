'use strict';
/* Underleaf art. Every creature, food item and effect is drawn from canvas paths and
   gradients at device resolution, so nothing pixelates at any zoom.
   Creatures face +x in their own frame; light falls from the top left of the screen. */

const LIGHT = { x: -0.6, y: -0.8 };

function localLight(a) {
  const c = Math.cos(-a), s = Math.sin(-a);
  return { x: LIGHT.x * c - LIGHT.y * s, y: LIGHT.x * s + LIGHT.y * c };
}

function shadedEllipse(ctx, x, y, rx, ry, pal, L) {
  const r = Math.max(rx, ry);
  const g = ctx.createRadialGradient(x + L.x * rx * 0.45, y + L.y * ry * 0.45, r * 0.06, x, y, r * 1.08);
  g.addColorStop(0, pal[1]);
  g.addColorStop(0.5, pal[0]);
  g.addColorStop(1, pal[2]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fill();
}

function gloss(ctx, x, y, rx, ry, L, alpha) {
  ctx.fillStyle = `rgba(255,248,232,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x + L.x * rx * 0.5, y + L.y * ry * 0.5, rx * 0.3, ry * 0.15, Math.atan2(L.y, L.x) + Math.PI / 2, 0, TAU);
  ctx.fill();
}

function softShadow(ctx, x, y, a, len, wid, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.scale(len, wid);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, `rgba(18,16,4,${alpha})`);
  g.addColorStop(0.55, `rgba(18,16,4,${alpha * 0.75})`);
  g.addColorStop(1, 'rgba(18,16,4,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function makeSprite(w, h, ox, oy, scale, fn) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * scale);
  c.height = Math.ceil(h * scale);
  const g = c.getContext('2d');
  g.scale(scale, scale);
  g.translate(ox, oy);
  fn(g);
  return { c, w, h, ox, oy };
}

/* Jointed legs. spec: one entry per leg pair, mirrored on both sides.
   Alternate pairs swing in opposite phase, which gives ants their tripod gait. */
function drawLegs(ctx, spec, gait, color, swing, dead = false, wScale = 1) {
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < spec.length; i++) {
      const L = spec[i];
      const grp = (i + (side > 0 ? 1 : 0)) % 2;
      const sw = dead ? 0 : Math.sin(gait + grp * Math.PI) * swing;
      const base = dead ? L.base * 0.55 + 0.75 : L.base;
      const bend = dead ? 1.9 : L.bend;
      const a1 = side * (base + sw);
      const kx = L.bx + Math.cos(a1) * L.l1, ky = side * L.by + Math.sin(a1) * L.l1;
      const a2 = side * (base + bend + sw * 0.5);
      const k2 = dead ? 0.55 : 1;
      const fx = kx + Math.cos(a2) * L.l2 * k2, fy = ky + Math.sin(a2) * L.l2 * k2;
      ctx.lineWidth = L.w1 * wScale;
      ctx.beginPath(); ctx.moveTo(L.bx, side * L.by); ctx.lineTo(kx, ky); ctx.stroke();
      ctx.lineWidth = L.w2 * wScale;
      ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
    }
  }
}

/* ------------------------------------------------------------------ ants */

const HUSK_PAL = { g: ['#6b5d50', '#a89888', '#2e2721'], t: ['#6e6052', '#ab9b8a', '#302822'], h: ['#6b5d50', '#a89888', '#2e2721'], leg: '#4a4038', ant: '#4a4038' };
const HURT_PAL = { g: ['#d9b9a0', '#fff3e4', '#8a6a55'], t: ['#d9b9a0', '#fff3e4', '#8a6a55'], h: ['#d9b9a0', '#fff3e4', '#8a6a55'], leg: '#a07a60', ant: '#a07a60' };

const LEG_CACHE = {};
function antLegs(k) {
  if (LEG_CACHE[k]) return LEG_CACHE[k];
  return (LEG_CACHE[k] = [
    { bx: 3.2, by: 1.3, base: 0.75, bend: -0.75, l1: 5.2 * k, l2: 5.8 * k, w1: 1.3, w2: 0.85 },
    { bx: 1.6, by: 1.4, base: 1.5, bend: 0.05, l1: 5.4 * k, l2: 6.0 * k, w1: 1.3, w2: 0.85 },
    { bx: 0.1, by: 1.3, base: 2.3, bend: 0.55, l1: 6.4 * k, l2: 7.6 * k, w1: 1.3, w2: 0.85 },
  ]);
}

function drawAnt(ctx, e, t) {
  const sp = ANT_SPECIES[e.sp || 'garden'], sh = sp.shape;
  const s = e.size;
  const flash = e.hurtT > 0 && ((t * 28) | 0) % 2 === 0;
  const pal = flash ? HURT_PAL : e.husk ? HUSK_PAL : sp.pal;
  const L = localLight(e.a);
  const queen = !!e.queen, soldier = e.role === 'soldier';

  if (e.isPlayer && !e.husk) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 3.2);
    const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, 25 * s);
    g.addColorStop(0, 'rgba(255,210,120,0)');
    g.addColorStop(0.6, 'rgba(255,210,120,0)');
    g.addColorStop(0.8, `rgba(255,214,128,${0.3 + 0.2 * pulse})`);
    g.addColorStop(1, 'rgba(255,210,120,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(e.x, e.y, 25 * s, 0, TAU); ctx.fill();
  }
  if (e.swimming) {
    ctx.strokeStyle = 'rgba(230,245,255,0.5)'; ctx.lineWidth = 1;
    const r = 10 * s + Math.sin(t * 5) * 2;
    ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, TAU); ctx.stroke();
  } else softShadow(ctx, e.x + 2.2 * s, e.y + 3.2 * s, e.a, (queen ? 17 : 12.5) * s, (queen ? 6.5 : 4.6) * s, 0.3);

  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.a);
  ctx.scale(s, s);
  drawLegs(ctx, antLegs(sh.legs), e.gait, pal.leg, 0.34, !!e.husk);

  // gaster
  const gs = sh.gaster * (queen ? 1.75 : 1);
  const gx = -7.4 - (gs - 1) * 5 - (sh.nodes - 1) * 1.4;
  const grx = 6.1 * gs, gry = 4.6 * gs * sh.slim;
  shadedEllipse(ctx, gx, 0, grx, gry, pal.g, L);
  ctx.strokeStyle = 'rgba(255,240,220,0.12)';
  ctx.lineWidth = 0.6;
  for (const f of [0.5, 0.1, -0.3]) {
    const bx = gx + f * grx, h = gry * 0.95 * Math.sqrt(Math.max(0, 1 - f * f));
    ctx.beginPath(); ctx.ellipse(bx + grx * 0.25, 0, grx * 0.25, h, 0, Math.PI - 1.15, Math.PI + 1.15); ctx.stroke();
  }
  if (sh.hairs) {
    ctx.strokeStyle = 'rgba(200,170,140,0.35)'; ctx.lineWidth = 0.35;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      const x = gx + Math.cos(a) * grx, y = Math.sin(a) * gry;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 1.2, y + Math.sin(a) * 1.2); ctx.stroke();
    }
  }
  gloss(ctx, gx, 0, grx, gry, L, 0.3);
  // waist
  if (sh.nodes === 2) { shadedEllipse(ctx, -3.3, 0, 1.35, 1.25, pal.t, L); shadedEllipse(ctx, -1.5, 0, 1.2, 1.1, pal.t, L); }
  else shadedEllipse(ctx, -1.9, 0, 1.4, 1.2, pal.t, L);
  // thorax
  const tw = queen ? 2.8 : 1.95 * sh.slim;
  shadedEllipse(ctx, 1.7, 0, queen ? 4.7 : 3.9, tw, pal.t, L);
  if (queen) {
    ctx.fillStyle = 'rgba(20,10,5,0.45)';
    for (let side = -1; side <= 1; side += 2) { ctx.beginPath(); ctx.ellipse(1.4, side * tw * 0.75, 1.2, 0.6, 0, 0, TAU); ctx.fill(); }
  }
  if (sh.spines) {
    ctx.strokeStyle = pal.t[2]; ctx.lineWidth = 0.8; ctx.lineCap = 'round';
    for (let side = -1; side <= 1; side += 2) {
      ctx.beginPath(); ctx.moveTo(-0.4, side * 1.0); ctx.lineTo(-1.9, side * 2.7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(3.4, side * 1.3); ctx.lineTo(4.2, side * 2.8); ctx.stroke();
    }
  }
  gloss(ctx, 1.7, 0, 3.9, tw, L, 0.2);
  // head
  let hr = (soldier ? 3.8 : 3.0) * sh.head;
  if (queen) hr = 3.4;
  const trap = sh.mand === 'trap';
  const hrx = trap ? hr * 1.22 : hr * 1.02, hry = trap ? hr * 0.82 : hr * 0.94;
  const hx = 4.9 + hrx;
  shadedEllipse(ctx, hx, 0, hrx, hry, pal.h, L);
  if (soldier || sh.mand === 'leaf') {
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(hx - hrx, 0); ctx.lineTo(hx - hrx * 0.3, 0); ctx.stroke();
  }
  gloss(ctx, hx, 0, hrx, hry * 0.95, L, 0.25);
  for (let side = -1; side <= 1; side += 2) {
    ctx.fillStyle = '#050302';
    ctx.beginPath(); ctx.ellipse(hx + hrx * 0.15, side * hry * 0.74, 0.95, 0.65, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.arc(hx + hrx * 0.05, side * hry * 0.74 - 0.25, 0.28, 0, TAU); ctx.fill();
  }
  // mandibles
  const bite = e.biteT > 0 ? Math.sin((Math.min(e.biteT, 0.25) / 0.25) * Math.PI) : 0;
  ctx.fillStyle = pal.ant; ctx.strokeStyle = pal.ant;
  for (let side = -1; side <= 1; side += 2) {
    const mx = hx + hrx * 0.78;
    if (trap) {
      ctx.save();
      ctx.translate(hx + hrx * 0.85, side * 1.0);
      ctx.rotate(side * (e.biteT > 0 ? bite * 1.3 : 0.12));
      ctx.lineWidth = 0.95; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(6.8, 0); ctx.lineTo(7.4, -side * 1.1); ctx.stroke();
      ctx.restore();
    } else if (sh.mand === 'leaf') {
      const open = 0.2 + bite * 0.9;
      ctx.beginPath();
      ctx.moveTo(mx, side * hry * 0.62);
      ctx.lineTo(mx + 3.9, side * (hry * 0.45 + open * 1.8));
      ctx.lineTo(mx + 3.2, side * (0.6 + open * 0.5));
      ctx.lineTo(mx + 2.4, side * (0.9 + open * 0.6));
      ctx.lineTo(mx + 1.6, side * (0.5 + open * 0.5));
      ctx.lineTo(mx + 0.2, side * hry * 0.2);
      ctx.closePath(); ctx.fill();
    } else {
      const open = 0.15 + bite * 0.85;
      ctx.beginPath();
      ctx.moveTo(mx, side * hry * 0.58);
      ctx.quadraticCurveTo(mx + 2.4, side * (hry * 0.62 + open * 1.6), mx + 3.2, side * (0.25 + open * 0.6));
      ctx.quadraticCurveTo(mx + 1.6, side * (hry * 0.26 + open), mx + 0.2, side * hry * 0.23);
      ctx.closePath(); ctx.fill();
    }
  }
  // elbowed antennae
  const busy = e.greetT > 0;
  const wig = busy ? 0.5 : 0.13, spd = busy ? 17 : 6;
  const al = trap ? 1.2 : 1;
  ctx.lineWidth = 0.75;
  for (let side = -1; side <= 1; side += 2) {
    const ph = e.husk ? 0.4 : Math.sin(t * spd + (e.id || 1) * 1.7 + side) * wig;
    const sx = hx + hrx * 0.45, sy = side * hry * 0.5;
    // grooming: one antenna is drawn down and back through the mouthparts to clean it
    const groom = e.groomT > 0 && side === (e.groomSide || 1) ? Math.sin(t * 9) * 0.5 + 0.5 : 0;
    const a1 = side * (0.95 + ph * 0.4 + groom * 0.6);
    const ex = sx + Math.cos(a1) * 4.3 * al, ey = sy + Math.sin(a1) * 4.3 * al;
    const a2 = groom ? side * (2.1 + groom * 0.5) : side * (0.1 - ph * 0.7);
    const tx = ex + Math.cos(a2) * 5.4 * al, ty = ey + Math.sin(a2) * 5.4 * al;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(tx, ty, 0.9, 0.6, a2 * side, 0, TAU); ctx.fill();
  }
  if (e.carry) {
    ctx.save();
    ctx.translate(hx + hrx + 3.4, 0);
    ctx.scale(1 / s, 1 / s);
    drawFoodLocal(ctx, e.carry, t, true);
    ctx.restore();
  }
  ctx.restore();
}

/* ---------------------------------------------------------------- spider */

const SPIDER_PAL = ['#5e4a35', '#b39670', '#1e140b'];
const SPIDER_LEGS = [
  { bx: 6, by: 5, base: 0.55, bend: -0.5, l1: 16, l2: 21, w1: 3.2, w2: 2.2 },
  { bx: 3.5, by: 6, base: 1.2, bend: -0.15, l1: 15, l2: 18, w1: 3.0, w2: 2.0 },
  { bx: 0.5, by: 6, base: 1.85, bend: 0.25, l1: 14, l2: 17, w1: 3.0, w2: 2.0 },
  { bx: -2.5, by: 5, base: 2.45, bend: 0.5, l1: 17, l2: 22, w1: 3.2, w2: 2.2 },
];
let SPIDER_SPRITE = null;

function spiderEye(g, x, y, r) {
  g.fillStyle = '#060505';
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(160,140,110,0.4)'; g.lineWidth = 0.3; g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.beginPath(); g.arc(x - r * 0.35, y - r * 0.35, r * 0.33, 0, TAU); g.fill();
}

function spiderSprite() {
  if (SPIDER_SPRITE) return SPIDER_SPRITE;
  SPIDER_SPRITE = makeSprite(50, 28, 32, 14, 3, (g) => {
    const L = { x: -0.45, y: -0.7 };
    const R = mulberry32(77);
    // abdomen
    shadedEllipse(g, -15, 0, 13.5, 10.2, SPIDER_PAL, L);
    g.fillStyle = 'rgba(28,18,8,0.7)';
    g.beginPath(); g.moveTo(-3.5, 0); g.quadraticCurveTo(-8.5, -3.6, -14.5, 0); g.quadraticCurveTo(-8.5, 3.6, -3.5, 0); g.fill();
    for (let i = 0; i < 4; i++) {
      const x = -16.5 - i * 3;
      g.lineCap = 'round';
      g.strokeStyle = 'rgba(30,18,8,0.55)'; g.lineWidth = 1.7;
      g.beginPath(); g.moveTo(x + 2.4, -5.8 + i * 0.7); g.lineTo(x, 0); g.lineTo(x + 2.4, 5.8 - i * 0.7); g.stroke();
      g.strokeStyle = 'rgba(226,200,150,0.5)'; g.lineWidth = 0.9;
      g.beginPath(); g.moveTo(x + 1.2, -5.6 + i * 0.7); g.lineTo(x - 1.2, 0); g.lineTo(x + 1.2, 5.6 - i * 0.7); g.stroke();
    }
    for (let i = 0; i < 4; i++) {
      for (let side = -1; side <= 1; side += 2) {
        g.fillStyle = 'rgba(232,210,165,0.55)';
        g.beginPath(); g.arc(-8 - i * 4, side * (6.5 - i * 0.6), 0.9, 0, TAU); g.fill();
      }
    }
    // cephalothorax
    shadedEllipse(g, 1.6, 0, 9.8, 7.9, SPIDER_PAL, L);
    g.fillStyle = 'rgba(25,15,7,0.5)';
    for (let side = -1; side <= 1; side += 2) { g.beginPath(); g.ellipse(1, side * 4.3, 7.2, 2.2, 0, 0, TAU); g.fill(); }
    g.fillStyle = 'rgba(226,202,152,0.55)';
    g.beginPath(); g.ellipse(0, 0, 7.6, 1.7, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(20,12,5,0.3)'; g.lineWidth = 0.45;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU;
      g.beginPath(); g.moveTo(-1 + Math.cos(a) * 2, Math.sin(a) * 2); g.lineTo(-1 + Math.cos(a) * 7, Math.sin(a) * 5.6); g.stroke();
    }
    // hair
    for (let i = 0; i < 520; i++) {
      let x, y;
      if (i < 360) { const a = R() * TAU, r = Math.sqrt(R()); x = -15 + Math.cos(a) * r * 13; y = Math.sin(a) * r * 9.8; }
      else { const a = R() * TAU, r = Math.sqrt(R()); x = 1.6 + Math.cos(a) * r * 9.4; y = Math.sin(a) * r * 7.5; }
      const a = R() * TAU, l = 0.6 + R() * 0.9;
      g.strokeStyle = R() < 0.5 ? 'rgba(235,212,168,0.32)' : 'rgba(20,12,6,0.38)';
      g.lineWidth = 0.4;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    // spinnerets + chelicerae
    g.fillStyle = '#2a1d10';
    g.beginPath(); g.ellipse(-28.4, 0, 1.4, 1.1, 0, 0, TAU); g.fill();
    shadedEllipse(g, 10.6, -1.9, 2.6, 1.8, ['#2a1c10', '#7a6040', '#0a0603'], L);
    shadedEllipse(g, 10.6, 1.9, 2.6, 1.8, ['#2a1c10', '#7a6040', '#0a0603'], L);
    // eight eyes
    spiderEye(g, 6.2, -2.4, 1.55); spiderEye(g, 6.2, 2.4, 1.55);
    spiderEye(g, 3.4, -4.2, 1.05); spiderEye(g, 3.4, 4.2, 1.05);
    spiderEye(g, 8.6, -2.5, 0.55); spiderEye(g, 8.9, -0.85, 0.6);
    spiderEye(g, 8.9, 0.85, 0.6); spiderEye(g, 8.6, 2.5, 0.55);
  });
  return SPIDER_SPRITE;
}

function drawSpider(ctx, e, t) {
  const s = e.size;
  softShadow(ctx, e.x + 5 * s, e.y + 7 * s, e.a, 30 * s, 18 * s, 0.34);
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.a);
  ctx.scale(s, s);
  drawLegs(ctx, SPIDER_LEGS, e.gait, '#35271a', 0.24, e.dead);
  ctx.setLineDash([2.4, 3.2]);
  drawLegs(ctx, SPIDER_LEGS, e.gait, 'rgba(205,176,126,0.55)', 0.24, e.dead, 0.55);
  ctx.setLineDash([]);
  // pedipalps
  ctx.strokeStyle = '#35271a'; ctx.lineWidth = 1.6;
  const palp = e.biteT > 0 ? 0.6 : 0;
  for (let side = -1; side <= 1; side += 2) {
    ctx.beginPath(); ctx.moveTo(10, side * 2.8); ctx.lineTo(14, side * (5 + palp)); ctx.lineTo(17, side * (4 - palp)); ctx.stroke();
  }
  const spr = spiderSprite();
  ctx.drawImage(spr.c, -spr.ox, -spr.oy, spr.w, spr.h);
  if (e.hurtT > 0) {
    ctx.fillStyle = 'rgba(255,240,220,0.35)';
    ctx.beginPath(); ctx.ellipse(-6, 0, 22, 10, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

/* Eight eyes glinting from the dark of a burrow. */
function drawSpiderEyes(ctx, e, t) {
  const glint = 0.55 + 0.45 * Math.sin(t * 2 + (e.id || 1));
  ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.a); ctx.scale(e.size, e.size);
  for (const [x, y, r] of [[6.2, -2.4, 1.55], [6.2, 2.4, 1.55], [3.4, -4.2, 1.05], [3.4, 4.2, 1.05], [8.7, -1.6, 0.6], [8.7, 1.6, 0.6]]) {
    radialFill(ctx, x, y, r * 3, [[0, `rgba(180,230,140,${0.35 * glint})`], [1, 'rgba(180,230,140,0)']]);
    ctx.fillStyle = `rgba(230,255,200,${0.8 * glint})`; ctx.beginPath(); ctx.arc(x, y, r * 0.5, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

/* --------------------------------------------------------------- ladybird */

const LADY_LEGS = [
  { bx: 4, by: 2.5, base: 0.9, bend: -0.4, l1: 3.5, l2: 3.5, w1: 1.1, w2: 0.8 },
  { bx: 1, by: 3, base: 1.5, bend: 0.1, l1: 4.5, l2: 3.5, w1: 1.1, w2: 0.8 },
  { bx: -2, by: 3, base: 2.2, bend: 0.4, l1: 4.5, l2: 4, w1: 1.1, w2: 0.8 },
];
const LADY_SPOTS = [[1.6, 3.5, 1.55], [-2.8, 2.0, 1.65], [-4.9, 4.6, 1.3]];

function drawLadybug(ctx, e, t) {
  const s = e.size, z = e.z || 0, L = localLight(e.a);
  const zs = 1 + z * 0.006;
  softShadow(ctx, e.x + (3 + z * 0.55) * s, e.y + (4 + z * 0.8) * s, e.a, 9.5 * s, 8 * s, 0.32 * (1 - Math.min(0.6, z / 120)));
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.a);
  ctx.scale(s * zs, s * zs);
  const open = e.open || 0;
  if (open < 0.3) drawLegs(ctx, LADY_LEGS, e.gait, '#120808', 0.35);
  if (open > 0.05) {
    const flap = 0.35 + 0.65 * Math.abs(Math.sin(t * 38 + e.id));
    for (let side = -1; side <= 1; side += 2) {
      ctx.fillStyle = `rgba(236,226,212,${0.4 * open})`;
      ctx.strokeStyle = `rgba(120,90,70,${0.4 * open})`;
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      ctx.ellipse(-1, side * (4 + 7 * open * flap), 6, 3 + 6 * open * flap, side * 0.35, 0, TAU);
      ctx.fill(); ctx.stroke();
    }
  }
  shadedEllipse(ctx, 8.4, 0, 1.9, 2.6, ['#1a1212', '#6a5a5a', '#000000'], L);
  ctx.fillStyle = '#f2ece0';
  ctx.beginPath(); ctx.arc(9.3, -1.6, 0.45, 0, TAU); ctx.arc(9.3, 1.6, 0.45, 0, TAU); ctx.fill();
  shadedEllipse(ctx, 6, 0, 2.8, 4.9, ['#151010', '#6d6060', '#000000'], L);
  ctx.fillStyle = '#f4efe4';
  ctx.beginPath(); ctx.ellipse(6.6, -3.1, 1.2, 1.4, 0, 0, TAU); ctx.ellipse(6.6, 3.1, 1.2, 1.4, 0, 0, TAU); ctx.fill();
  for (let side = -1; side <= 1; side += 2) {
    ctx.save();
    ctx.translate(5.6, side * 0.3);
    ctx.rotate(side * open * 1.0);
    ctx.translate(-5.6, -side * 0.3);
    ctx.beginPath();
    if (side > 0) ctx.ellipse(-1, 0, 7.6, 7, 0, 0, Math.PI);
    else ctx.ellipse(-1, 0, 7.6, 7, 0, Math.PI, TAU);
    ctx.closePath();
    const g = ctx.createRadialGradient(-1 + L.x * 3.4, L.y * 3.4, 0.4, -1, 0, 8.4);
    g.addColorStop(0, '#ff9c80');
    g.addColorStop(0.45, '#d9271c');
    g.addColorStop(1, '#6a0b06');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.fillStyle = '#140a0a';
    for (const [x, y, r] of LADY_SPOTS) { ctx.beginPath(); ctx.arc(x, y * side, r, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  if (open < 0.2) {
    ctx.strokeStyle = 'rgba(40,0,0,0.6)'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(5.4, 0); ctx.lineTo(-8.4, 0); ctx.stroke();
    ctx.fillStyle = '#140a0a';
    ctx.beginPath(); ctx.arc(4.6, 0, 1.6, 0, TAU); ctx.fill();
  }
  gloss(ctx, -1, 0, 7.6, 7, L, 0.4);
  ctx.restore();
}

/* ------------------------------------------------------------------ aphid */

const APHID_LEGS = [
  { bx: 1.2, by: 1.2, base: 0.9, bend: -0.3, l1: 1.6, l2: 1.6, w1: 0.45, w2: 0.35 },
  { bx: 0, by: 1.4, base: 1.6, bend: 0.1, l1: 1.8, l2: 1.6, w1: 0.45, w2: 0.35 },
  { bx: -1.3, by: 1.3, base: 2.3, bend: 0.3, l1: 2, l2: 1.8, w1: 0.45, w2: 0.35 },
];

function drawAphid(ctx, e, t) {
  const s = e.size, L = localLight(e.a);
  softShadow(ctx, e.x + 1.2 * s, e.y + 1.8 * s, e.a, 4 * s, 2.6 * s, 0.28);
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.a);
  ctx.scale(s, s);
  drawLegs(ctx, APHID_LEGS, e.gait, 'rgba(60,92,34,0.85)', 0.25);
  ctx.strokeStyle = '#3e5f22'; ctx.lineWidth = 0.6; ctx.lineCap = 'round';
  for (let side = -1; side <= 1; side += 2) {
    ctx.beginPath(); ctx.moveTo(-2.6, side * 1.2); ctx.lineTo(-4.5, side * 1.9); ctx.stroke();
  }
  shadedEllipse(ctx, -0.6, 0, 3.3, 2.35, ['#9fd36a', '#e6f9b6', '#4f7d2a'], L);
  gloss(ctx, -0.6, 0, 3.3, 2.35, L, 0.4);
  shadedEllipse(ctx, 2.8, 0, 1.25, 1.15, ['#8cc35a', '#d4f0a0', '#3f6a22'], L);
  ctx.fillStyle = '#7a1f1f';
  ctx.beginPath(); ctx.arc(3.2, -0.75, 0.32, 0, TAU); ctx.arc(3.2, 0.75, 0.32, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(60,90,35,0.8)'; ctx.lineWidth = 0.32;
  const w = Math.sin(t * 3 + e.id) * 0.3;
  for (let side = -1; side <= 1; side += 2) {
    ctx.beginPath(); ctx.moveTo(3.5, side * 0.5); ctx.quadraticCurveTo(5, side * (2.6 + w), -0.8, side * (3.1 + w)); ctx.stroke();
  }
  if (e.ready) {
    const pulse = 1 + Math.sin(t * 4 + e.id) * 0.08;
    const g = ctx.createRadialGradient(-4.9, -0.4, 0.1, -4.6, 0, 1.6 * pulse);
    g.addColorStop(0, '#fff2b8'); g.addColorStop(0.5, '#ffc94a'); g.addColorStop(1, '#c47f0a');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(-4.6, 0, 1.45 * pulse, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

/* ----------------------------------------------------------- stag beetle */

const BEETLE_LEGS = [
  { bx: 7, by: 5, base: 0.8, bend: -0.6, l1: 9, l2: 10, w1: 2.6, w2: 1.8 },
  { bx: 2, by: 6, base: 1.5, bend: 0.1, l1: 9, l2: 10, w1: 2.6, w2: 1.8 },
  { bx: -3, by: 6, base: 2.2, bend: 0.5, l1: 10, l2: 12, w1: 2.6, w2: 1.8 },
];
const BEETLE_EL = ['#3e1d12', '#b0704a', '#0f0503'];
const BEETLE_PRO = ['#2e150c', '#8a5638', '#0a0402'];

function drawBeetle(ctx, e, t) {
  const s = e.size, L = localLight(e.a);
  softShadow(ctx, e.x + 4 * s, e.y + 6 * s, e.a, 27 * s, 14 * s, 0.34);
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.a);
  ctx.scale(s, s);
  drawLegs(ctx, BEETLE_LEGS, e.gait, '#1e0d07', 0.3, e.dead);
  // elytra
  shadedEllipse(ctx, -8, 0, 14, 10, BEETLE_EL, L);
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.moveTo(4.5, 0); ctx.lineTo(-21.5, 0); ctx.stroke();
  ctx.fillStyle = 'rgba(255,232,205,0.22)';
  for (let side = -1; side <= 1; side += 2) {
    ctx.beginPath(); ctx.ellipse(-8 + L.x * 3, side * 4.6 + L.y * 2, 9, 1.5, 0, 0, TAU); ctx.fill();
  }
  // pronotum + head
  shadedEllipse(ctx, 6.5, 0, 5, 8.6, BEETLE_PRO, L);
  gloss(ctx, 6.5, 0, 5, 8.6, L, 0.2);
  shadedEllipse(ctx, 12.5, 0, 3.8, 6.6, BEETLE_PRO, L);
  // antler mandibles
  const open = e.biteT > 0 ? Math.sin((e.biteT / 0.3) * Math.PI) : 0;
  for (let side = -1; side <= 1; side += 2) {
    ctx.save();
    ctx.translate(14.5, side * 3.2);
    ctx.rotate(side * (0.12 + open * 0.35));
    ctx.scale(1, side);
    ctx.beginPath();
    ctx.moveTo(0, 2.2);
    ctx.bezierCurveTo(4, 6.5, 10, 7.5, 13.5, 5.2);
    ctx.quadraticCurveTo(15.6, 3.6, 15.2, 1.6);
    ctx.quadraticCurveTo(13.6, 3.0, 11.2, 3.3);
    ctx.lineTo(9.6, 1.6);
    ctx.lineTo(8.6, 3.4);
    ctx.bezierCurveTo(6, 3.6, 3, 2.4, 0.6, -0.8);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 15, 4);
    g.addColorStop(0, '#2a1209'); g.addColorStop(0.6, '#8a4a28'); g.addColorStop(1, '#3a1a0c');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.4; ctx.stroke();
    ctx.restore();
  }
  // antennae
  ctx.strokeStyle = '#1e0d07'; ctx.lineWidth = 0.9;
  for (let side = -1; side <= 1; side += 2) {
    ctx.beginPath(); ctx.moveTo(13, side * 5); ctx.lineTo(15, side * 9); ctx.lineTo(18.5, side * 9.6); ctx.stroke();
    ctx.fillStyle = '#2a140a';
    ctx.beginPath(); ctx.ellipse(19.2, side * 9.7, 1.4, 0.9, 0, 0, TAU); ctx.fill();
  }
  if (e.hurtT > 0) {
    ctx.fillStyle = 'rgba(255,240,220,0.3)';
    ctx.beginPath(); ctx.ellipse(-2, 0, 20, 10, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

/* --------------------------------------------------------------- pill bug */

const PILL_PAL = ['#7f838c', '#d2d6de', '#2b2d33'];
const PILL_LEGS = [];
for (let i = 0; i < 7; i++) PILL_LEGS.push({ bx: 5 - i * 1.7, by: 4.4, base: 1.5, bend: 0.1, l1: 1.6, l2: 1.4, w1: 0.7, w2: 0.5 });

function drawPillbug(ctx, e, t) {
  const s = e.size;
  if (e.curl > 0.5) {
    const L = localLight(e.roll);
    softShadow(ctx, e.x + 2.5 * s, e.y + 3.5 * s, 0, 7.4 * s, 6.8 * s, 0.32);
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.roll);
    ctx.scale(s, s);
    shadedEllipse(ctx, 0, 0, 6.9, 6.9, PILL_PAL, L);
    for (let i = -3; i <= 3; i++) {
      const x = i * 1.75, h = Math.sqrt(Math.max(0, 6.8 * 6.8 - x * x)) * 0.97;
      ctx.strokeStyle = 'rgba(20,22,28,0.45)'; ctx.lineWidth = 0.55;
      ctx.beginPath(); ctx.moveTo(x, -h); ctx.quadraticCurveTo(x + 1.4, 0, x, h); ctx.stroke();
      ctx.strokeStyle = 'rgba(230,235,245,0.2)';
      ctx.beginPath(); ctx.moveTo(x - 0.5, -h); ctx.quadraticCurveTo(x + 0.9, 0, x - 0.5, h); ctx.stroke();
    }
    gloss(ctx, 0, 0, 6.9, 6.9, L, 0.35);
    ctx.restore();
    return;
  }
  const L = localLight(e.a);
  softShadow(ctx, e.x + 2.6 * s, e.y + 3.6 * s, e.a, 10 * s, 6.2 * s, 0.3);
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.a);
  ctx.scale(s, s);
  drawLegs(ctx, PILL_LEGS, e.gait * 1.6, '#2a2c32', 0.5);
  shadedEllipse(ctx, -0.5, 0, 9.3, 5.7, PILL_PAL, L);
  for (let i = 0; i < 8; i++) {
    const x = 5.8 - i * 1.9;
    const hw = 5.6 * Math.sqrt(Math.max(0, 1 - ((x + 0.5) / 9.3) ** 2));
    ctx.strokeStyle = 'rgba(20,22,28,0.5)'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(x - 0.6, -hw); ctx.quadraticCurveTo(x + 0.9, 0, x - 0.6, hw); ctx.stroke();
    ctx.strokeStyle = 'rgba(235,240,248,0.18)';
    ctx.beginPath(); ctx.moveTo(x - 1.1, -hw); ctx.quadraticCurveTo(x + 0.4, 0, x - 1.1, hw); ctx.stroke();
  }
  shadedEllipse(ctx, 8.4, 0, 1.8, 3.5, ['#5a5e66', '#a6aab4', '#1e2026'], L);
  ctx.strokeStyle = '#3a3c44'; ctx.lineWidth = 0.6;
  for (let side = -1; side <= 1; side += 2) {
    ctx.beginPath(); ctx.moveTo(9.6, side * 1.8); ctx.lineTo(11.6, side * 3.6); ctx.lineTo(12.6, side * 3.0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-9.4, side * 1.6); ctx.lineTo(-10.6, side * 2.2); ctx.stroke();
  }
  gloss(ctx, -0.5, 0, 9.3, 5.7, L, 0.3);
  ctx.restore();
}

/* ------------------------------------------------------------ caterpillar */

const CAT_PAL = ['#8ccf4e', '#daf7a0', '#34621a'];
const CAT_HEAD = ['#7fb348', '#cde895', '#2f5216'];
const CAT_DEAD = ['#8a9a5a', '#c4cc9a', '#3e4628'];

function drawCaterpillar(ctx, e, t, dead = false) {
  const segs = e.segs, n = segs.length;
  const pal = dead ? CAT_DEAD : CAT_PAL;
  for (let i = n - 1; i >= 0; i -= 2) softShadow(ctx, segs[i].x + 2.5, segs[i].y + 3.5, 0, 7, 6.2, 0.22);
  for (let i = n - 1; i >= 1; i--) {
    const p = segs[i], q = segs[i - 1];
    const ang = Math.atan2(q.y - p.y, q.x - p.x);
    const L = localLight(ang);
    const rr = 5.8 * (i > n - 3 ? 0.84 : 1);
    const w = dead ? 0 : Math.sin(t * 5 - i * 0.9) * (e.thrash || 0.5);
    ctx.save();
    ctx.translate(p.x - Math.sin(ang) * w, p.y + Math.cos(ang) * w);
    ctx.rotate(ang);
    shadedEllipse(ctx, 0, 0, rr * 1.05, rr, pal, L);
    ctx.lineCap = 'round';
    for (let side = -1; side <= 1; side += 2) {
      ctx.strokeStyle = 'rgba(252,252,232,0.75)'; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(-2.6, side * rr * 0.3); ctx.lineTo(1.6, side * rr * 0.86); ctx.stroke();
      ctx.fillStyle = '#2a3a1a';
      ctx.beginPath(); ctx.arc(-2.2, side * rr * 0.72, 0.55, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  // tail horn
  const tl = segs[n - 1], tp = segs[n - 2];
  const ta = Math.atan2(tl.y - tp.y, tl.x - tp.x);
  ctx.save();
  ctx.translate(tl.x, tl.y);
  ctx.rotate(ta);
  ctx.strokeStyle = '#5a7bd0'; ctx.lineWidth = 1.7; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(5, -1, 8.5, 1.8); ctx.stroke();
  ctx.fillStyle = '#25243a';
  ctx.beginPath(); ctx.arc(8.5, 1.8, 0.9, 0, TAU); ctx.fill();
  ctx.restore();
  // head
  const h = segs[0], h1 = segs[1];
  const ha = Math.atan2(h.y - h1.y, h.x - h1.x);
  const L = localLight(ha);
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(ha);
  shadedEllipse(ctx, 0, 0, 4.7, 4.5, dead ? CAT_DEAD : CAT_HEAD, L);
  ctx.fillStyle = '#3a2a14';
  ctx.beginPath(); ctx.ellipse(3.8, 0, 1.2, 1.8, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#111';
  for (let side = -1; side <= 1; side += 2) { ctx.beginPath(); ctx.arc(2.4, side * 2.4, 0.5, 0, TAU); ctx.fill(); }
  gloss(ctx, 0, 0, 4.7, 4.5, L, 0.3);
  ctx.restore();
}

function drawCaterpillarCurled(ctx, t) {
  const segs = [];
  for (let i = 0; i < 9; i++) {
    const a = 0.3 + (i / 8) * Math.PI * 1.5;
    segs.push({ x: Math.cos(a) * 9, y: Math.sin(a) * 9 });
  }
  drawCaterpillar(ctx, { segs, thrash: 0 }, t, true);
}

/* ------------------------------------------------------------------ snail */

const SNAIL_BODY = ['#9b8a76', '#d6c8b2', '#4b3d2f'];
const SHELL_PAL = ['#b07a3e', '#f0cf94', '#4a2c12'];

function drawSnail(ctx, e, t) {
  const s = e.size, L = localLight(e.a);
  softShadow(ctx, e.x + 3 * s, e.y + 4.5 * s, e.a, 17 * s, 10.5 * s, 0.3);
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.a);
  ctx.scale(s, s);
  const ext = e.ext;
  if (ext > 0.02) {
    const bl = 14 * ext;
    shadedEllipse(ctx, 2 + bl * 0.35, 0, 6 + bl * 0.6, 5.2, SNAIL_BODY, L);
    ctx.fillStyle = 'rgba(60,45,32,0.25)';
    for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(2 + i * bl * 0.1, ((i * 37) % 7 - 3) * 0.9, 0.6, 0, TAU); ctx.fill(); }
    const wv = Math.sin(t * 2 + e.id) * 0.14;
    ctx.lineCap = 'round';
    for (let side = -1; side <= 1; side += 2) {
      const bx = 6 + bl * 0.85, by = side * 1.6;
      const ang = side * 0.42 + wv * side;
      const len = 8 * ext;
      const ex = bx + Math.cos(ang) * len, ey = by + Math.sin(ang) * len;
      ctx.strokeStyle = '#8a7a66'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = '#3a2e24';
      ctx.beginPath(); ctx.arc(ex, ey, 1.2, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#9a8a76'; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(bx + 1, side * 1.0); ctx.lineTo(bx + 1 + Math.cos(side * 0.9) * 3 * ext, side * 1.0 + Math.sin(side * 0.9) * 3 * ext); ctx.stroke();
    }
  }
  shadedEllipse(ctx, -2, 0, 11, 10.2, SHELL_PAL, L);
  ctx.beginPath();
  for (let k = 0; k <= 70; k++) {
    const th = (k / 70) * 3.3 * Math.PI;
    const r = 9.6 * (1 - th / (3.7 * Math.PI));
    const x = -2 + Math.cos(th + 0.6) * r * 1.05, y = Math.sin(th + 0.6) * r;
    if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = 'rgba(60,32,12,0.55)'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.beginPath();
  for (let k = 0; k <= 60; k++) {
    const th = (k / 60) * 2.8 * Math.PI;
    const r = 8.1 * (1 - th / (3.7 * Math.PI));
    const x = -2 + Math.cos(th + 0.6) * r * 1.05, y = Math.sin(th + 0.6) * r;
    if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = 'rgba(255,226,170,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
  gloss(ctx, -2, 0, 11, 10.2, L, 0.35);
  ctx.restore();
}

/* -------------------------------------------------------------- butterfly */

const BFLY = {
  peacock: { wing: '#a5321e', hind: '#8f2a1a', edge: '#3a1a12' },
  brimstone: { wing: '#f2e272', hind: '#e9d966', edge: '#b8a640' },
  blue: { wing: '#7ea9f0', hind: '#6e98e4', edge: '#26365a' },
};

function wingFore(ctx) {
  ctx.beginPath(); ctx.moveTo(2, 0.5); ctx.bezierCurveTo(6, 6, 9, 16, 4, 19); ctx.bezierCurveTo(0, 20.5, -3, 14, -1, 1); ctx.closePath();
}
function wingHind(ctx) {
  ctx.beginPath(); ctx.moveTo(0, 1); ctx.bezierCurveTo(-1, 8, -4, 15, -9, 14); ctx.bezierCurveTo(-12.5, 12, -10, 4, -3, 0.5); ctx.closePath();
}

function drawButterfly(ctx, e, t) {
  const s = e.size, z = e.z;
  const flap = e.landed ? 0.55 + 0.45 * Math.sin(t * 1.6 + e.id) : Math.abs(Math.cos(t * 13 + e.id));
  const fs = 0.1 + 0.9 * flap;
  const c = BFLY[e.variant];
  // ground shadow
  ctx.save();
  ctx.translate(e.x + z * 0.55 + 2, e.y + z * 0.8 + 3);
  ctx.rotate(e.a);
  ctx.scale(s, s * fs);
  ctx.fillStyle = `rgba(20,25,5,${0.17 * (1 - Math.min(0.7, z / 150))})`;
  for (let side = -1; side <= 1; side += 2) {
    ctx.save(); ctx.scale(1, side); wingFore(ctx); ctx.fill(); wingHind(ctx); ctx.fill(); ctx.restore();
  }
  ctx.restore();

  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.a);
  const zs = 1 + z * 0.005;
  ctx.scale(s * zs, s * zs);
  ctx.save();
  ctx.scale(1, fs);
  for (let side = -1; side <= 1; side += 2) {
    ctx.save();
    ctx.scale(1, side);
    wingHind(ctx);
    ctx.fillStyle = c.hind; ctx.fill();
    ctx.strokeStyle = c.edge; ctx.lineWidth = 1.1; ctx.stroke();
    wingFore(ctx);
    const g = ctx.createLinearGradient(0, 0, 4, 19);
    g.addColorStop(0, shade(c.wing, -0.25)); g.addColorStop(0.5, c.wing); g.addColorStop(1, shade(c.wing, 0.15));
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = c.edge; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.strokeStyle = rgba(c.edge.length === 7 ? c.edge : '#000000', 0.35); ctx.lineWidth = 0.35;
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(0.5, 1); ctx.lineTo(1 + k * 1.6, 8 + k * 3); ctx.stroke(); }
    if (e.variant === 'peacock') {
      ctx.fillStyle = '#1b1b2a'; ctx.beginPath(); ctx.arc(3.6, 14.8, 3.3, 0, TAU); ctx.fill();
      ctx.fillStyle = '#5c7ed6'; ctx.beginPath(); ctx.arc(3.6, 14.8, 2.3, 0, TAU); ctx.fill();
      ctx.fillStyle = '#f2e6c0'; ctx.beginPath(); ctx.arc(3.9, 14.4, 1.1, 0, TAU); ctx.fill();
      ctx.fillStyle = '#17171f'; ctx.beginPath(); ctx.arc(-7.6, 11, 2.6, 0, TAU); ctx.fill();
      ctx.fillStyle = '#6a8ae0'; ctx.beginPath(); ctx.arc(-7.2, 10.6, 0.8, 0, TAU); ctx.arc(-8.3, 11.6, 0.6, 0, TAU); ctx.fill();
    } else if (e.variant === 'brimstone') {
      ctx.fillStyle = '#e07a1a';
      ctx.beginPath(); ctx.arc(2.6, 10, 0.9, 0, TAU); ctx.arc(-5, 8, 0.8, 0, TAU); ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 0.6;
      wingFore(ctx); ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
  ctx.fillStyle = '#231a14';
  ctx.beginPath(); ctx.ellipse(-1, 0, 7, 1.5, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(6.6, 0, 1.5, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#231a14'; ctx.lineWidth = 0.45;
  for (let side = -1; side <= 1; side += 2) {
    ctx.beginPath(); ctx.moveTo(7.5, side * 0.6); ctx.lineTo(11.5, side * 3.4); ctx.stroke();
    ctx.beginPath(); ctx.arc(11.6, side * 3.5, 0.6, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

/* -------------------------------------------------------------- dragonfly */

function dragonWings(ctx, t, e, alpha) {
  for (let side = -1; side <= 1; side += 2) {
    for (let k = 0; k < 2; k++) {
      ctx.save();
      ctx.translate(k ? 2 : 7, 0);
      ctx.rotate(side * (k ? 1.72 : 1.42) + side * Math.sin(t * 45 + k * 1.3 + e.id) * 0.13);
      ctx.beginPath();
      ctx.ellipse(12.5, 0, 12.5, k ? 3.7 : 3.0, 0, 0, TAU);
      if (alpha < 1) { ctx.fillStyle = `rgba(20,25,5,${0.13 * alpha})`; ctx.fill(); }
      else {
        ctx.fillStyle = 'rgba(225,242,255,0.24)'; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 0.45; ctx.stroke();
        ctx.strokeStyle = 'rgba(70,95,115,0.35)'; ctx.lineWidth = 0.4;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(24, -0.3); ctx.moveTo(2, 0.8); ctx.lineTo(20, 1.6); ctx.stroke();
        ctx.fillStyle = '#3a2a1a';
        ctx.beginPath(); ctx.ellipse(21, -0.7, 1.4, 0.7, 0, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
  }
}

function drawDragonfly(ctx, e, t) {
  const s = e.size, z = e.z, L = localLight(e.a);
  ctx.save();
  ctx.translate(e.x + z * 0.55 + 2, e.y + z * 0.8 + 3);
  ctx.rotate(e.a);
  ctx.scale(s, s);
  dragonWings(ctx, t, e, 0.99);
  ctx.fillStyle = 'rgba(20,25,5,0.14)';
  ctx.beginPath(); ctx.ellipse(-12, 0, 24, 2.2, 0, 0, TAU); ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.a);
  const zs = 1 + z * 0.004;
  ctx.scale(s * zs, s * zs);
  for (let i = 9; i >= 0; i--) {
    const x = 1 - i * 3.7;
    shadedEllipse(ctx, x, 0, 2.2, 1.65 - i * 0.05, ['#2f8fb0', '#a8e6f8', '#0d3346'], L);
    ctx.fillStyle = 'rgba(10,20,25,0.7)';
    ctx.fillRect(x - 1.6, -0.35, 3.2, 0.7);
  }
  dragonWings(ctx, t, e, 1);
  shadedEllipse(ctx, 6, 0, 5, 3.6, ['#3aa5a0', '#aef3e4', '#0e3a36'], L);
  for (let side = -1; side <= 1; side += 2) {
    shadedEllipse(ctx, 11.4, side * 2.2, 2.7, 2.7, ['#3d8fd0', '#d0f0ff', '#0b2a45'], L);
    gloss(ctx, 11.4, side * 2.2, 2.7, 2.7, L, 0.55);
  }
  ctx.restore();
}

/* --------------------------------------------------------------- firefly */

function drawFireflyGlow(ctx, e, t) {
  const glow = Math.pow(0.5 + 0.5 * Math.sin(t * e.freq + e.ph), 3) * e.fade;
  if (glow < 0.02) return;
  const r = 10 + 26 * glow;
  const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r);
  g.addColorStop(0, `rgba(235,255,150,${0.75 * glow})`);
  g.addColorStop(0.25, `rgba(200,255,110,${0.35 * glow})`);
  g.addColorStop(1, 'rgba(160,230,80,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, TAU); ctx.fill();
}

function drawFireflyBody(ctx, e, t) {
  const glow = Math.pow(0.5 + 0.5 * Math.sin(t * e.freq + e.ph), 3);
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.a);
  ctx.fillStyle = '#1e1a14';
  ctx.beginPath(); ctx.ellipse(0, 0, 3, 1.5, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#e07a3a';
  ctx.beginPath(); ctx.ellipse(2.4, 0, 1, 1.3, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = `rgba(240,255,150,${0.35 + 0.65 * glow})`;
  ctx.beginPath(); ctx.ellipse(-2, 0, 1.4, 1.2, 0, 0, TAU); ctx.fill();
  ctx.restore();
}

/* ------------------------------------------------------------ antlion jaws */

function drawAntlionJaws(ctx, pit, t) {
  if (pit.jawVis <= 0.02) return;
  const open = 0.4 + 0.4 * Math.sin(t * 7);
  ctx.save();
  ctx.translate(pit.x, pit.y);
  ctx.rotate(pit.jawA);
  ctx.globalAlpha = pit.jawVis;
  ctx.fillStyle = '#5a3e22';
  ctx.beginPath(); ctx.ellipse(-1, 0, 3.8, 3.2, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#3a2614';
  for (let side = -1; side <= 1; side += 2) {
    ctx.beginPath();
    ctx.moveTo(2, side * 1.5);
    ctx.quadraticCurveTo(9, side * (4 + open * 4), 12.5, side * (0.5 + open * 1.5));
    ctx.quadraticCurveTo(8, side * (2 + open * 2), 2.5, side * 0.4);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/* ------------------------------------------------------------------- food */

function makeCrumbShape(seed, r) {
  const R = mulberry32(seed);
  const n = 7 + ((R() * 3) | 0);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + R() * 0.4;
    const rr = r * (0.72 + R() * 0.45);
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  return pts;
}

function smoothPoly(ctx, pts) {
  const n = pts.length;
  ctx.beginPath();
  ctx.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
  }
  ctx.closePath();
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const FOOD_L = { x: -0.6, y: -0.8 };

function drawFoodLocal(ctx, f, t, carried = false) {
  if (!carried && !f.big) softShadow(ctx, 1.4, 2, 0, f.r * 1.15, f.r, 0.32);
  switch (f.kind) {
    case 'crumb': {
      const r = f.r;
      const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.2);
      g.addColorStop(0, '#f8e6bc'); g.addColorStop(0.55, '#dcb576'); g.addColorStop(1, '#9a6630');
      smoothPoly(ctx, f.shape);
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = 'rgba(130,78,28,0.65)'; ctx.lineWidth = 0.7; ctx.stroke();
      ctx.fillStyle = 'rgba(140,90,40,0.45)';
      ctx.beginPath(); ctx.arc(r * 0.2, r * 0.1, 0.55, 0, TAU); ctx.arc(-r * 0.25, r * 0.3, 0.45, 0, TAU); ctx.arc(r * 0.05, -r * 0.35, 0.4, 0, TAU); ctx.fill();
      break;
    }
    case 'seed': {
      ctx.beginPath();
      ctx.moveTo(-4.6, 0);
      ctx.quadraticCurveTo(-1, -2.7, 4, -0.9);
      ctx.quadraticCurveTo(5.1, 0, 4, 0.9);
      ctx.quadraticCurveTo(-1, 2.7, -4.6, 0);
      ctx.closePath();
      ctx.fillStyle = '#2a2420'; ctx.fill();
      ctx.save(); ctx.clip();
      ctx.strokeStyle = 'rgba(226,220,205,0.75)'; ctx.lineWidth = 0.55;
      for (const y of [-1.1, 0, 1.1]) { ctx.beginPath(); ctx.moveTo(-4.5, y * 0.6); ctx.lineTo(4.5, y); ctx.stroke(); }
      ctx.restore();
      gloss(ctx, 0, 0, 4.5, 2.4, FOOD_L, 0.35);
      break;
    }
    case 'berry': {
      shadedEllipse(ctx, 0, 0, 4.8, 4.8, ['#c4243a', '#ff94a2', '#5a0814'], FOOD_L);
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.beginPath(); ctx.ellipse(-1.6, -1.8, 1.3, 0.7, -0.6, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3a5a1e';
      ctx.beginPath(); ctx.arc(1.2, 1.6, 0.8, 0, TAU); ctx.fill();
      break;
    }
    case 'honey': {
      const g = ctx.createRadialGradient(-0.9, -1, 0.2, 0, 0, 3.4);
      g.addColorStop(0, '#fff3c0'); g.addColorStop(0.45, '#ffc444'); g.addColorStop(1, '#b8700a');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, 3.2, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath(); ctx.arc(-1, -1.1, 0.7, 0, TAU); ctx.fill();
      break;
    }
    case 'husk':
      drawAnt(ctx, { x: 0, y: 0, a: 0, size: 0.9 * (ANT_SPECIES[f.sp || 'garden'].shape.size), husk: true, sp: f.sp, gait: 0, hurtT: 0, greetT: 0, biteT: 0, role: 'worker', id: f.id }, t);
      break;
    case 'sugar': {
      softShadow(ctx, 3, 4, 0, 11, 11, 0.35);
      roundRectPath(ctx, -8, -8, 16, 16, 2.4);
      const g = ctx.createLinearGradient(-8, -8, 8, 8);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, '#f1ede4'); g.addColorStop(1, '#cfc7b8');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = 'rgba(150,140,120,0.55)'; ctx.lineWidth = 0.6; ctx.stroke();
      roundRectPath(ctx, -6, -6, 12, 12, 1.6);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 0.8; ctx.stroke();
      const R = mulberry32(f.seed);
      for (let i = 0; i < 26; i++) {
        ctx.fillStyle = R() < 0.5 ? 'rgba(180,170,155,0.5)' : 'rgba(255,255,255,1)';
        ctx.fillRect(-7 + R() * 14, -7 + R() * 14, 0.8, 0.8);
      }
      const tw = 0.5 + 0.5 * Math.sin(t * 3 + f.id);
      ctx.strokeStyle = `rgba(255,255,255,${tw})`; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(-4, -6.5); ctx.lineTo(-4, -2.5); ctx.moveTo(-6, -4.5); ctx.lineTo(-2, -4.5); ctx.stroke();
      break;
    }
    case 'apple': {
      softShadow(ctx, 4, 5, 0, 20, 14, 0.35);
      ctx.save();
      ctx.translate(0, 8);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 20, -Math.PI * 0.86, -Math.PI * 0.14);
      ctx.closePath();
      const g = ctx.createRadialGradient(0, -4, 2, 0, -6, 20);
      g.addColorStop(0, '#fff8de'); g.addColorStop(0.7, '#f3e3a8'); g.addColorStop(1, '#e0c578');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = '#c0302a'; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.arc(0, 0, 19, -Math.PI * 0.86, -Math.PI * 0.14); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,170,150,0.6)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(0, 0, 19.8, -Math.PI * 0.75, -Math.PI * 0.45); ctx.stroke();
      ctx.strokeStyle = 'rgba(190,160,90,0.5)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(0, 0, 8, -Math.PI * 0.8, -Math.PI * 0.2); ctx.stroke();
      ctx.fillStyle = '#4a2a14';
      for (const sx of [-2.2, 2.2]) {
        ctx.beginPath(); ctx.ellipse(sx, -7, 1.1, 2.1, sx * 0.25, 0, TAU); ctx.fill();
      }
      ctx.restore();
      break;
    }
    case 'beetle':
      drawBeetle(ctx, { x: 0, y: 0, a: 0, size: 0.95, dead: true, gait: 0, hurtT: 0, biteT: 0 }, t);
      break;
    case 'spider':
      drawSpider(ctx, { x: 0, y: 0, a: 0, size: 1.05, dead: true, gait: 0, hurtT: 0, biteT: 0 }, t);
      break;
    case 'caterpillar':
      drawCaterpillarCurled(ctx, t);
      break;
    case 'leafbit': {
      ctx.save();
      ctx.rotate(0.6);
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.quadraticCurveTo(-3, -6, 5, -4.5);
      ctx.lineTo(6.5, 0.5);
      ctx.quadraticCurveTo(1, 5, -6, 0);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, -5, 0, 5);
      g.addColorStop(0, '#a6d468'); g.addColorStop(0.6, '#5e9a36'); g.addColorStop(1, '#2e5a18');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = 'rgba(230,250,200,0.45)'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(4, -1.5); ctx.stroke();
      ctx.restore();
      break;
    }
    default:
      if (CORPSE_DRAW[f.kind]) CORPSE_DRAW[f.kind](ctx, t);
  }
}

function drawFood(ctx, f, t) {
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.rotate(f.a);
  drawFoodLocal(ctx, f, t);
  ctx.restore();
}
