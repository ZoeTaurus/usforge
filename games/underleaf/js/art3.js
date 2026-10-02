'use strict';
/* Art for the third wave of animals. Same conventions as art.js. */

/* ------------------------------------------------------------------- wasp */

const WASP_LEGS = [
  { bx: 4, by: 1.6, base: 1.0, bend: -0.3, l1: 5, l2: 5, w1: 0.9, w2: 0.7 },
  { bx: 2, by: 1.8, base: 1.6, bend: 0.2, l1: 5.5, l2: 5.5, w1: 0.9, w2: 0.7 },
  { bx: 0, by: 1.6, base: 2.2, bend: 0.4, l1: 6.5, l2: 6.5, w1: 0.9, w2: 0.7 },
];

function drawWasp(ctx, e, t) {
  const s = e.size, z = e.z || 0, L = localLight(e.a);
  softShadow(ctx, e.x + (3 + z * 0.6) * s, e.y + (4 + z * 0.9) * s, e.a, 13 * s, 5 * s, 0.26 * (1 - Math.min(0.6, z / 100)));
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.a);
  const zs = s * (1 + z * 0.005);
  ctx.scale(zs, zs);
  if (z < 3 || e.dead) drawLegs(ctx, WASP_LEGS, e.gait, '#c89a20', 0.3, e.dead);
  const flying = z > 2 && !e.dead;
  for (let side = -1; side <= 1; side += 2) {
    const f = flying ? 0.35 + 0.65 * Math.abs(Math.sin(t * 60 + e.id)) : 0.2;
    ctx.save(); ctx.translate(3, side * 1.6); ctx.rotate(side * (flying ? 1.25 : 2.75));
    ctx.fillStyle = 'rgba(200,190,170,0.4)'; ctx.strokeStyle = 'rgba(90,70,40,0.5)'; ctx.lineWidth = 0.35;
    ctx.beginPath(); ctx.ellipse(6 * f + 3, 0, 7 * (0.5 + f * 0.5), 2.3, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  ctx.beginPath(); ctx.ellipse(-8, 0, 8.5, 4.6, 0, 0, TAU);
  const g = ctx.createRadialGradient(-8 + L.x * 3, L.y * 2.5, 0.5, -8, 0, 9);
  g.addColorStop(0, '#fff07a'); g.addColorStop(0.5, '#f0c418'); g.addColorStop(1, '#7a5a04');
  ctx.fillStyle = g; ctx.fill(); ctx.clip();
  ctx.fillStyle = '#1a1206';
  for (const bx of [-3, -7, -11]) { ctx.beginPath(); ctx.moveTo(bx - 1.3, -6); ctx.lineTo(bx + 1.3, -6); ctx.lineTo(bx + 0.6, 0); ctx.lineTo(bx + 1.3, 6); ctx.lineTo(bx - 1.3, 6); ctx.fill(); }
  ctx.restore();
  ctx.fillStyle = '#1a1206';
  ctx.beginPath(); ctx.moveTo(-16.5, 0); ctx.lineTo(-19.5, -0.4); ctx.lineTo(-19.5, 0.4); ctx.fill();
  shadedEllipse(ctx, -0.5, 0, 1.4, 1.1, ['#1a1206', '#6a5020', '#000000'], L);
  shadedEllipse(ctx, 3, 0, 3.6, 3, ['#2a200a', '#8a6a20', '#0a0602'], L);
  ctx.fillStyle = '#f0c418';
  ctx.beginPath(); ctx.ellipse(3, -2, 1.2, 0.6, 0, 0, TAU); ctx.ellipse(3, 2, 1.2, 0.6, 0, 0, TAU); ctx.fill();
  shadedEllipse(ctx, 7.6, 0, 2.4, 3, ['#f0c418', '#fff07a', '#6a4a04'], L);
  ctx.fillStyle = '#1a1206';
  ctx.beginPath(); ctx.ellipse(7.4, -2, 1.3, 1.5, 0, 0, TAU); ctx.ellipse(7.4, 2, 1.3, 1.5, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#1a1206'; ctx.lineWidth = 0.6;
  for (let side = -1; side <= 1; side += 2) { ctx.beginPath(); ctx.moveTo(9.5, side); ctx.lineTo(12.5, side * 3); ctx.lineTo(15, side * 2.4); ctx.stroke(); }
  if (e.carryAnt) { ctx.save(); ctx.translate(10, 0); ctx.scale(0.75, 0.75); drawAnt(ctx, { ...e.carryAnt, x: 0, y: 0, a: 0, size: 1, husk: false, isPlayer: false, carry: null }, t); ctx.restore(); }
  if (e.hurtT > 0) { ctx.fillStyle = 'rgba(255,240,220,0.35)'; ctx.beginPath(); ctx.ellipse(-4, 0, 12, 5, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
}

/* ---------------------------------------------------------------- earwig */

function drawEarwig(ctx, e, t) {
  const s = e.size, L = localLight(e.a);
  softShadow(ctx, e.x + 2.5 * s, e.y + 3.5 * s, e.a, 14 * s, 4.5 * s, 0.3);
  ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.a); ctx.scale(s, s);
  drawLegs(ctx, ANT_LEGS_EARWIG, e.gait, '#c8a070', 0.3, e.dead);
  const pal = ['#6a3418', '#c07a48', '#240e04'];
  for (let i = 0; i < 7; i++) shadedEllipse(ctx, -3 - i * 2.2, 0, 1.8, 3.3 - i * 0.12, pal, L);
  ctx.strokeStyle = '#3a1a08'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
  const open = e.biteT > 0 ? 0.6 : 0.25;
  for (let side = -1; side <= 1; side += 2) {
    ctx.beginPath(); ctx.moveTo(-17, side * 1.2); ctx.quadraticCurveTo(-23, side * (2 + open * 4), -24.5, side * 0.3); ctx.stroke();
  }
  shadedEllipse(ctx, 0.5, 0, 3.2, 3, ['#8a6a40', '#d8b080', '#3a2810'], L);
  shadedEllipse(ctx, 4.6, 0, 2.4, 2.4, pal, L);
  ctx.strokeStyle = '#a07a50'; ctx.lineWidth = 0.4;
  for (let side = -1; side <= 1; side += 2) { ctx.beginPath(); ctx.moveTo(6.5, side); ctx.quadraticCurveTo(10, side * 3, 13, side * 5); ctx.stroke(); }
  ctx.restore();
}
const ANT_LEGS_EARWIG = [
  { bx: 1.5, by: 1.4, base: 1.0, bend: -0.3, l1: 3.5, l2: 3.5, w1: 0.7, w2: 0.5 },
  { bx: 0, by: 1.6, base: 1.6, bend: 0.2, l1: 4, l2: 3.5, w1: 0.7, w2: 0.5 },
  { bx: -1.5, by: 1.6, base: 2.1, bend: 0.4, l1: 4.5, l2: 4, w1: 0.7, w2: 0.5 },
];

/* ------------------------------------------------------------------ slug */

function drawSlug(ctx, e, t) {
  const s = e.size, L = localLight(e.a);
  const stretch = 1 + Math.sin(t * 2 + e.id) * 0.06 * (e.speedNow > 1 ? 1 : 0);
  softShadow(ctx, e.x + 3 * s, e.y + 4 * s, e.a, 22 * s, 7 * s, 0.3);
  ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.a); ctx.scale(s * stretch, s / stretch);
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.bezierCurveTo(19, -7, 4, -8.5, -6, -7);
  ctx.bezierCurveTo(-16, -5.5, -22, -2, -24, 0);
  ctx.bezierCurveTo(-22, 2, -16, 5.5, -6, 7);
  ctx.bezierCurveTo(4, 8.5, 19, 7, 20, 0);
  const g = ctx.createRadialGradient(L.x * 6, L.y * 4, 1, 0, 0, 24);
  g.addColorStop(0, e.dead ? '#a89070' : '#d89a5a'); g.addColorStop(0.5, e.dead ? '#6a5040' : '#a8602a'); g.addColorStop(1, '#3a1e0a');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(60,30,10,0.35)'; ctx.lineWidth = 0.6;
  for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(-20 + i * 4, -5); ctx.lineTo(-18 + i * 4, 5); ctx.stroke(); }
  shadedEllipse(ctx, 7, 0, 7, 5.6, ['#b86a32', '#e8aa6a', '#4a2408'], L);
  ctx.fillStyle = 'rgba(30,15,5,0.45)'; ctx.beginPath(); ctx.arc(5, 2.5, 1.3, 0, TAU); ctx.fill();
  if (!e.dead) {
    ctx.strokeStyle = '#7a4420'; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
    const w = Math.sin(t * 2.2 + e.id) * 0.15;
    for (let side = -1; side <= 1; side += 2) {
      const ex = 19 + Math.cos(side * 0.4 + w) * 7, ey = side * 1.5 + Math.sin(side * 0.4 + w) * 7;
      ctx.beginPath(); ctx.moveTo(17, side * 1.5); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = '#2a1408'; ctx.beginPath(); ctx.arc(ex, ey, 1.1, 0, TAU); ctx.fill();
    }
  }
  gloss(ctx, 0, 0, 20, 6, L, 0.4);
  ctx.restore();
}

/* ----------------------------------------------------------- dung beetle */

function drawDungBall(ctx, x, y, r, roll) {
  softShadow(ctx, x + r * 0.35, y + r * 0.45, 0, r * 1.1, r, 0.35);
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, '#8a6a44'); g.addColorStop(0.6, '#5a4228'); g.addColorStop(1, '#2a1e10');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  const R = mulberry32(5);
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
  for (let i = 0; i < 26; i++) {
    const a = R() * TAU + roll, d = r * Math.sqrt(R());
    ctx.strokeStyle = R() < 0.5 ? 'rgba(180,150,90,0.45)' : 'rgba(30,20,10,0.4)'; ctx.lineWidth = 0.8;
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.9;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 3, py + 1); ctx.stroke();
  }
  ctx.restore();
}

const DUNG_LEGS = [
  { bx: 4, by: 3.5, base: 0.6, bend: -0.5, l1: 6, l2: 6, w1: 1.8, w2: 1.3 },
  { bx: 0, by: 4.5, base: 1.6, bend: 0.2, l1: 6, l2: 6, w1: 1.6, w2: 1.2 },
  { bx: -3, by: 4.5, base: 2.3, bend: 0.5, l1: 7, l2: 7, w1: 1.6, w2: 1.2 },
];
function drawDungBeetle(ctx, e, t) {
  if (e.ball && !e.dead) drawDungBall(ctx, e.bx, e.by, e.ballR, e.roll || 0);
  const s = e.size, L = localLight(e.a);
  softShadow(ctx, e.x + 3 * s, e.y + 4 * s, e.a, 12 * s, 8 * s, 0.3);
  ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.a); ctx.scale(s, s);
  drawLegs(ctx, DUNG_LEGS, e.gait, '#14100a', 0.35, e.dead);
  const pal = ['#1e2418', '#6a8060', '#060804'];
  shadedEllipse(ctx, -3, 0, 8, 7, pal, L);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(-11, 0); ctx.stroke();
  gloss(ctx, -3, 0, 8, 7, L, 0.4);
  shadedEllipse(ctx, 5, 0, 3.6, 5.6, pal, L);
  ctx.fillStyle = '#1a1e14';
  ctx.beginPath(); ctx.moveTo(8, -4); ctx.lineTo(12, -3); ctx.lineTo(13, 0); ctx.lineTo(12, 3); ctx.lineTo(8, 4); ctx.closePath(); ctx.fill();
  ctx.restore();
}

/* ---------------------------------------------------------------- cricket */

function drawCricket(ctx, e, t) {
  const s = e.size, z = e.z || 0, L = localLight(e.a);
  softShadow(ctx, e.x + (3 + z * 0.6) * s, e.y + (4 + z * 0.9) * s, e.a, 14 * s, 6 * s, 0.3);
  ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.a); ctx.scale(s * (1 + z * 0.006), s * (1 + z * 0.006));
  const pal = ['#2a1e14', '#7a6048', '#0a0604'];
  for (let side = -1; side <= 1; side += 2) {
    ctx.save(); ctx.translate(-1, side * 3.5); ctx.rotate(side * (z > 1 ? 2.9 : 2.7));
    shadedEllipse(ctx, 6, 0, 7, 2.2, pal, L);
    ctx.strokeStyle = '#1a120a'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(z > 1 ? 25 : 3, side * 1.6); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = '#2a1e14'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(4, side * 2.5); ctx.lineTo(8, side * 6); ctx.stroke();
  }
  shadedEllipse(ctx, -6, 0, 9, 4.6, pal, L);
  const chirp = e.chirpT > 0 ? Math.sin(t * 60) * 0.3 : 0;
  ctx.fillStyle = 'rgba(90,70,50,0.8)';
  ctx.beginPath(); ctx.ellipse(-5, 0, 8.5, 4 + chirp, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(20,12,6,0.6)'; ctx.lineWidth = 0.4;
  for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(-12, k * 1.2); ctx.lineTo(2, k); ctx.stroke(); }
  shadedEllipse(ctx, 4, 0, 4, 4, pal, L);
  shadedEllipse(ctx, 9, 0, 3.4, 3.4, pal, L);
  ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 0.4;
  for (let side = -1; side <= 1; side += 2) { ctx.beginPath(); ctx.moveTo(11, side); ctx.quadraticCurveTo(-4, side * 14, -20, side * 12); ctx.stroke(); }
  ctx.restore();
}

/* ------------------------------------------------------------------- moth */

function drawMoth(ctx, e, t) {
  const s = e.size, z = e.z;
  const flap = Math.abs(Math.cos(t * 18 + e.id));
  const fs = 0.25 + 0.75 * flap;
  ctx.save(); ctx.translate(e.x + z * 0.55, e.y + z * 0.8); ctx.rotate(e.a); ctx.scale(s, s * fs);
  ctx.fillStyle = 'rgba(15,15,5,0.15)';
  for (let side = -1; side <= 1; side += 2) { ctx.beginPath(); ctx.ellipse(-2, side * 9, 9, 10, side * 0.4, 0, TAU); ctx.fill(); }
  ctx.restore();
  ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.a); ctx.scale(s, s);
  ctx.save(); ctx.scale(1, fs);
  for (let side = -1; side <= 1; side += 2) {
    ctx.save(); ctx.scale(1, side);
    ctx.beginPath(); ctx.moveTo(3, 1); ctx.bezierCurveTo(4, 8, 0, 16, -6, 17); ctx.bezierCurveTo(-10, 12, -10, 5, -4, 1); ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, 17);
    g.addColorStop(0, '#6a5a44'); g.addColorStop(0.7, '#b8a07a'); g.addColorStop(1, '#8a7656');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(40,30,20,0.45)'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(1, 4); ctx.quadraticCurveTo(-3, 9, -6, 14); ctx.stroke();
    ctx.fillStyle = 'rgba(40,30,20,0.6)'; ctx.beginPath(); ctx.arc(-3, 9, 1.6, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  ctx.fillStyle = '#5a4a36'; ctx.beginPath(); ctx.ellipse(-2, 0, 7, 2.2, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#8a7656'; ctx.lineWidth = 0.6;
  for (let side = -1; side <= 1; side += 2) {
    ctx.beginPath(); ctx.moveTo(4, side); ctx.quadraticCurveTo(7, side * 4, 9, side * 6); ctx.stroke();
    for (let k = 1; k < 5; k++) { const px = 4 + k * 1.2, py = side * (1 + k * 1.2); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 1.2, py - side * 0.8); ctx.stroke(); }
  }
  ctx.restore();
}

/* --------------------------------------------------------------- hedgehog */

let HEDGE_SPRITE = null;
function hedgehogSprite() {
  if (HEDGE_SPRITE) return HEDGE_SPRITE;
  HEDGE_SPRITE = makeSprite(120, 90, 66, 45, 2, (g) => {
    const R = mulberry32(31);
    g.beginPath(); g.ellipse(-6, 0, 50, 38, 0, 0, TAU);
    const base = g.createRadialGradient(-20, -16, 4, -6, 0, 52);
    base.addColorStop(0, '#8a7458'); base.addColorStop(0.7, '#4e3e2c'); base.addColorStop(1, '#241a10');
    g.fillStyle = base; g.fill();
    g.lineCap = 'round';
    for (let i = 0; i < 900; i++) {
      const a = R() * TAU, d = Math.sqrt(R());
      const x = -6 + Math.cos(a) * 48 * d, y = Math.sin(a) * 36 * d;
      const sa = Math.PI + (R() - 0.5) * 0.9 + (y / 36) * 0.4;
      const l = 7 + R() * 5;
      g.strokeStyle = 'rgba(15,10,5,0.5)'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(sa) * l, y + Math.sin(sa) * l); g.stroke();
      g.strokeStyle = R() < 0.5 ? '#e8dcc4' : '#7a6448'; g.lineWidth = 0.9;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(sa) * l * 0.85, y + Math.sin(sa) * l * 0.85); g.stroke();
      g.strokeStyle = '#2a1e12'; g.lineWidth = 0.9;
      g.beginPath(); g.moveTo(x + Math.cos(sa) * l * 0.5, y + Math.sin(sa) * l * 0.5); g.lineTo(x + Math.cos(sa) * l * 0.65, y + Math.sin(sa) * l * 0.65); g.stroke();
    }
  });
  return HEDGE_SPRITE;
}

function drawHedgehog(ctx, e, t) {
  const s = e.size, L = localLight(e.a);
  softShadow(ctx, e.x + 8 * s, e.y + 11 * s, e.a, 54 * s, 40 * s, 0.35);
  ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.a); ctx.scale(s, s);
  if (!e.curl) {
    const sniff = Math.sin(t * 9) * (e.sniff ? 1.5 : 0.3);
    ctx.beginPath(); ctx.moveTo(30, -20); ctx.quadraticCurveTo(64 + sniff, -6, 66 + sniff, 0); ctx.quadraticCurveTo(64 + sniff, 6, 30, 20); ctx.closePath();
    const g = ctx.createLinearGradient(30, -20, 30, 20);
    g.addColorStop(0, '#c8a888'); g.addColorStop(0.5, '#a88464'); g.addColorStop(1, '#5a4430');
    ctx.fillStyle = g; ctx.fill();
    ctx.fillStyle = '#1a1210'; ctx.beginPath(); ctx.arc(66 + sniff, 0, 3.2, 0, TAU); ctx.fill();
    for (let side = -1; side <= 1; side += 2) {
      ctx.fillStyle = '#0a0806'; ctx.beginPath(); ctx.arc(50, side * 8.5, 2.6, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(49.2, side * 8.5 - 0.9, 0.8, 0, TAU); ctx.fill();
      ctx.fillStyle = '#7a5a44'; ctx.beginPath(); ctx.ellipse(38, side * 17, 5, 3.5, 0, 0, TAU); ctx.fill();
    }
    if (e.lickT > 0) { ctx.fillStyle = '#e07a8a'; ctx.beginPath(); ctx.ellipse(71 + sniff, 0, 5, 2.4, 0, 0, TAU); ctx.fill(); }
  }
  const k = e.curl ? 0.82 : 1;
  ctx.scale(k, k);
  const spr = hedgehogSprite();
  ctx.drawImage(spr.c, -spr.ox, -spr.oy, spr.w, spr.h);
  if (e.hurtT > 0) { ctx.fillStyle = 'rgba(255,240,220,0.25)'; ctx.beginPath(); ctx.ellipse(-6, 0, 50, 38, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
}

/* ----------------------------------------------------------- stick insect */

function drawStickInsect(ctx, e, t) {
  const s = e.size, L = localLight(e.a);
  softShadow(ctx, e.x + 3 * s, e.y + 4 * s, e.a, 32 * s, 3 * s, 0.25);
  ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.a + Math.sin(t * 1.3 + e.id) * 0.03); ctx.scale(s, s);
  const col = e.dead ? '#8a7a5a' : '#7a6a3a';
  ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const legs = [[12, 0.5, -0.5], [2, 1.5, 0.1], [-6, 2.4, 0.5]];
  for (const [bx, base, bend] of legs) {
    for (let side = -1; side <= 1; side += 2) {
      const sw = Math.sin(e.gait + (side > 0 ? 0 : Math.PI) + bx) * 0.15;
      const kx = bx + Math.cos(side * (base + sw)) * 13, ky = Math.sin(side * (base + sw)) * 13;
      const fx = kx + Math.cos(side * (base + bend)) * 14, fy = ky + Math.sin(side * (base + bend)) * 14;
      ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
    }
  }
  const g = ctx.createLinearGradient(0, -2, 0, 2);
  g.addColorStop(0, '#b8a874'); g.addColorStop(0.5, col); g.addColorStop(1, '#3a3018');
  ctx.strokeStyle = g; ctx.lineWidth = 3.2;
  ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(16, 0); ctx.stroke();
  ctx.strokeStyle = 'rgba(40,30,15,0.5)'; ctx.lineWidth = 0.5;
  for (let i = -30; i < 14; i += 5) { ctx.beginPath(); ctx.moveTo(i, -1.5); ctx.lineTo(i, 1.5); ctx.stroke(); }
  ctx.strokeStyle = col; ctx.lineWidth = 0.6;
  for (let side = -1; side <= 1; side += 2) { ctx.beginPath(); ctx.moveTo(17, 0); ctx.lineTo(34, side * 3); ctx.stroke(); }
  ctx.restore();
}

/* --------------------------------------------------------------- termite */

function drawTermite(ctx, e, t) {
  const s = e.size, L = localLight(e.a);
  softShadow(ctx, e.x + 1.8 * s, e.y + 2.6 * s, e.a, 9 * s, 3.6 * s, 0.28);
  ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.a); ctx.scale(s, s);
  drawLegs(ctx, antLegs(0.8), e.gait, '#c8b090', 0.3, e.dead);
  shadedEllipse(ctx, -4.5, 0, 6, 3.4, ['#e8dcc4', '#fffaf0', '#9a8a70'], L);
  ctx.strokeStyle = 'rgba(140,120,90,0.4)'; ctx.lineWidth = 0.4;
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-8.5 + i * 2, -3); ctx.lineTo(-8.5 + i * 2, 3); ctx.stroke(); }
  shadedEllipse(ctx, 1.5, 0, 2.4, 2.2, ['#e0d0b0', '#fff6e0', '#8a7a5a'], L);
  const soldier = e.role === 'soldier';
  const hc = soldier ? ['#c8642a', '#f0a060', '#5a2408'] : ['#d8b080', '#f4dcb0', '#7a5a30'];
  shadedEllipse(ctx, 5.2, 0, soldier ? 3.8 : 2.4, soldier ? 2.8 : 2.2, hc, L);
  if (soldier) {
    ctx.strokeStyle = '#3a1806'; ctx.lineWidth = 0.9;
    for (let side = -1; side <= 1; side += 2) { ctx.beginPath(); ctx.moveTo(8.5, side * 1); ctx.quadraticCurveTo(12, side * 1.5, 12.5, side * -0.3); ctx.stroke(); }
  }
  ctx.strokeStyle = '#a08060'; ctx.lineWidth = 0.4;
  for (let side = -1; side <= 1; side += 2) { ctx.beginPath(); ctx.moveTo(6.5, side * 1.4); ctx.lineTo(11, side * 3.8); ctx.stroke(); }
  if (e.hurtT > 0) { ctx.fillStyle = 'rgba(255,240,220,0.35)'; ctx.beginPath(); ctx.ellipse(-2, 0, 9, 3.5, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
}

Object.assign(CORPSE_DRAW, {
  acorn: (c) => propAcorn(c, { x: 0, y: 0, rot: 0 }),
  wasp: (c, t) => drawWasp(c, { x: 0, y: 0, a: 0, size: 1.1, z: 0, dead: true, gait: 0, id: 1 }, t),
  earwig: (c, t) => drawEarwig(c, { x: 0, y: 0, a: 0, size: 1.1, gait: 0, dead: true }, t),
  slug: (c, t) => drawSlug(c, { x: 0, y: 0, a: 0, size: 0.9, dead: true, id: 1, speedNow: 0 }, t),
  dungbeetle: (c, t) => drawDungBeetle(c, { x: 0, y: 0, a: 0, size: 1.1, gait: 0, dead: true }, t),
  cricket: (c, t) => drawCricket(c, { x: 0, y: 0, a: 0, size: 1, z: 0 }, t),
  hedgehog: (c, t) => drawHedgehog(c, { x: 0, y: 0, a: 0, size: 0.5, curl: true }, t),
  stick: (c, t) => drawStickInsect(c, { x: 0, y: 0, a: 0, size: 0.8, gait: 0, dead: true }, t),
  termite: (c, t) => drawTermite(c, { x: 0, y: 0, a: 0, size: 1.2, gait: 0, dead: true, role: 'soldier' }, t),
});

/* ----------------------------------------------- winged termite (alate) */

function drawAlate(ctx, e, t) {
  const z = e.z || 0;
  if (e.wings > 0.02) {
    ctx.save(); ctx.translate(e.x + z * 0.6, e.y + z * 0.9); ctx.rotate(e.a);
    ctx.fillStyle = `rgba(15,15,5,${0.12 * e.wings})`;
    ctx.beginPath(); ctx.ellipse(-8, 0, 14, 7, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.save(); ctx.translate(e.x, e.y);
  const zs = 1 + z * 0.005; ctx.scale(zs, zs); ctx.translate(-e.x, -e.y);
  drawTermite(ctx, { ...e, role: 'worker', size: 1 }, t);
  if (e.wings > 0.02) {
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.a);
    const flap = z > 2 ? 0.5 + 0.5 * Math.abs(Math.sin(t * 40 + e.id)) : 0;
    for (let side = -1; side <= 1; side += 2) {
      for (let k = 0; k < 2; k++) {
        ctx.save(); ctx.translate(1, side * 1.2); ctx.rotate(side * (Math.PI - 0.18 - k * 0.12 - flap * 0.9));
        ctx.globalAlpha = e.wings;
        ctx.fillStyle = 'rgba(235,230,215,0.5)'; ctx.strokeStyle = 'rgba(120,100,80,0.55)'; ctx.lineWidth = 0.35;
        ctx.beginPath(); ctx.ellipse(10, 0, 11, 2.6, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(20, 0); ctx.stroke();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  ctx.restore();
}

/* ------------------------------------------------------- picnic cloth */

function drawPicnic(ctx, ev, t) {
  const a = ev.fade ?? 1;
  if (a <= 0) return;
  const R = mulberry32(ev.seed);
  const W = 300, H = 220;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(ev.x, ev.y); ctx.rotate(ev.rot);
  ctx.fillStyle = 'rgba(15,12,4,0.3)';
  roundRectPath(ctx, -W / 2 + 8, -H / 2 + 10, W, H, 10); ctx.fill();
  // a slightly wavy outline, as cloth lying on grass never sits perfectly flat
  const edge = () => {
    ctx.beginPath();
    const pts = [];
    for (let i = 0; i <= 12; i++) pts.push([-W / 2 + (W * i) / 12, -H / 2 + Math.sin(i * 1.7 + ev.seed) * 3]);
    for (let i = 0; i <= 9; i++) pts.push([W / 2 + Math.sin(i * 2.1) * 3, -H / 2 + (H * i) / 9]);
    for (let i = 12; i >= 0; i--) pts.push([-W / 2 + (W * i) / 12, H / 2 + Math.sin(i * 1.3) * 3]);
    for (let i = 9; i >= 0; i--) pts.push([-W / 2 + Math.sin(i * 1.9) * 3, -H / 2 + (H * i) / 9]);
    pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
    ctx.closePath();
  };
  edge(); ctx.fillStyle = '#f6f0e6'; ctx.fill();
  ctx.save(); edge(); ctx.clip();
  // gingham: red stripes both ways, darker where they cross
  const sq = 20;
  ctx.fillStyle = 'rgba(200,40,40,0.5)';
  for (let x = -W / 2; x < W / 2; x += sq * 2) ctx.fillRect(x, -H / 2, sq, H);
  for (let y = -H / 2; y < H / 2; y += sq * 2) ctx.fillRect(-W / 2, y, W, sq);
  // folds and creases catch the light on one side
  for (let i = 0; i < 4; i++) {
    const fx = -W / 2 + R() * W, fl = 60 + R() * 120, fa = R() * Math.PI;
    const gr = ctx.createLinearGradient(fx - 14, 0, fx + 14, 0);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(40,20,20,0.18)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save(); ctx.translate(fx, (R() - 0.5) * H * 0.6); ctx.rotate(fa);
    ctx.fillStyle = gr; ctx.fillRect(-14, -fl / 2, 28, fl);
    ctx.restore();
  }
  // fabric weave and a few grass blades poking through the edge
  ctx.strokeStyle = 'rgba(120,80,70,0.08)'; ctx.lineWidth = 0.5;
  for (let x = -W / 2; x < W / 2; x += 3) { ctx.beginPath(); ctx.moveTo(x, -H / 2); ctx.lineTo(x, H / 2); ctx.stroke(); }
  const lit = ctx.createLinearGradient(-W / 2, -H / 2, W / 2, H / 2);
  lit.addColorStop(0, 'rgba(255,250,230,0.15)'); lit.addColorStop(1, 'rgba(40,30,20,0.15)');
  ctx.fillStyle = lit; ctx.fillRect(-W / 2, -H / 2, W, H);
  ctx.restore();
  ctx.strokeStyle = 'rgba(160,40,40,0.6)'; ctx.lineWidth = 2;
  edge(); ctx.stroke();
  ctx.restore();
}

/* -------------------------------------------------------- bread crust */

CORPSE_DRAW.crust = (c) => {
  softShadow(c, 4, 5, 0, 20, 12, 0.35);
  c.beginPath();
  c.moveTo(-18, 6); c.quadraticCurveTo(-20, -10, 0, -12); c.quadraticCurveTo(20, -10, 18, 6);
  c.quadraticCurveTo(10, 0, 0, 0); c.quadraticCurveTo(-10, 0, -18, 6); c.closePath();
  const gr = c.createLinearGradient(0, -12, 0, 6);
  gr.addColorStop(0, '#b06a28'); gr.addColorStop(0.5, '#8a4a18'); gr.addColorStop(1, '#5a2a0c');
  c.fillStyle = gr; c.fill();
  c.beginPath();
  c.moveTo(-14, 4); c.quadraticCurveTo(-14, -6, 0, -7); c.quadraticCurveTo(14, -6, 14, 4);
  c.quadraticCurveTo(8, 1, 0, 1); c.quadraticCurveTo(-8, 1, -14, 4); c.closePath();
  const crumb = c.createLinearGradient(0, -7, 0, 4);
  crumb.addColorStop(0, '#f8e8c0'); crumb.addColorStop(1, '#e0c890');
  c.fillStyle = crumb; c.fill();
  const R = mulberry32(7);
  for (let i = 0; i < 18; i++) {
    c.fillStyle = 'rgba(180,140,80,0.5)';
    c.beginPath(); c.ellipse(-11 + R() * 22, -5 + R() * 7, 0.6 + R() * 1.2, 0.5 + R() * 0.8, R() * 3, 0, TAU); c.fill();
  }
  c.fillStyle = 'rgba(255,240,200,0.35)';
  c.beginPath(); c.ellipse(-6, -10, 6, 1.4, -0.2, 0, TAU); c.fill();
};
