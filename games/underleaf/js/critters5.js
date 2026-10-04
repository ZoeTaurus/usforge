'use strict';
/* Newts, moles, assassin bugs, rove beetles and field voles. */

/* ------------------------------------------------------------------ newt */

/* A smooth newt: hunts small prey along the water's edge and slips into the pond when mobbed. */
class Newt extends Hunter {
  constructor(game, x, y) {
    super(game, x, y);
    this.kind = 'newt'; this.r = 12; this.size = 1; this.gaitK = 0.18; this.fear = 5; this.swims = true;
    this.maxHp = this.hp = 120; this.sway = 0;
  }
  update(dt) {
    const g = this.game;
    this.sway += dt * (1 + this.speedNow * 0.06);
    // when hurt, make for water: ants can't follow
    if (this.mode === 'retreat' && !g.world.waterAt(this.x, this.y)) {
      let best = null, bd = 400 * 400;
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * TAU, x = this.x + Math.cos(a) * 160, y = this.y + Math.sin(a) * 160;
        if (g.world.waterAt(x, y)) { const d2 = dist2(this.x, this.y, x, y); if (d2 < bd) { bd = d2; best = { x, y }; } }
      }
      if (best) { this.hurtT -= dt; this.retreatT -= dt; this.move(Math.atan2(best.y - this.y, best.x - this.x), 70, dt, 6); return; }
    }
    this.hunt(dt, { range: 120, speed: 52, dmg: 9, cd: 0.9, wander: 22, reach: 4, leash: 350 });
  }
  draw(ctx, t) { drawNewt(ctx, this, t); }
}
function drawNewt(ctx, e, t) {
  const s = e.size, L = localLight(e.a), sw = Math.sin(e.sway || 0) * 0.35 * (e.dead ? 0 : 1);
  const wet = e.game && e.game.world.waterAt(e.x, e.y);
  if (!wet) softShadow(ctx, e.x + 3 * s, e.y + 4 * s, e.a, 22 * s, 6 * s, 0.28);
  ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.a); ctx.scale(s, s);
  if (wet) ctx.globalAlpha = 0.75;
  // a body that bends in an S as it walks
  const pts = [];
  for (let i = 0; i <= 14; i++) { const f = i / 14; pts.push([10 - f * 34, Math.sin(f * 3.4 - 0.4 + (e.sway || 0) * 2) * sw * 8 * f]); }
  // legs
  ctx.strokeStyle = '#4a3a24'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  for (const [i, side] of [[3, 1], [3, -1], [7, 1], [7, -1]]) {
    const [px, py] = pts[i], ph = Math.sin((e.gait || 0) + (i > 4 ? Math.PI : 0) + (side > 0 ? 0 : Math.PI)) * 2.5;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 2 + ph, py + side * 7); ctx.lineTo(px + 4 + ph, py + side * 8); ctx.stroke();
  }
  // tail fin and body
  for (let i = 0; i < pts.length - 1; i++) {
    const f = i / (pts.length - 1), w = f < 0.25 ? 3.2 + f * 6 : 4.7 * (1 - (f - 0.25) / 0.75) + 0.4;
    ctx.strokeStyle = e.dead ? '#7a7060' : '#6a5a3a'; ctx.lineWidth = w * 2;
    ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[i + 1][0], pts[i + 1][1]); ctx.stroke();
  }
  // orange belly showing at the sides, dark spots on the back
  ctx.strokeStyle = 'rgba(230,140,40,0.7)'; ctx.lineWidth = 1.2;
  for (const side of [-1, 1]) { ctx.beginPath(); for (let i = 1; i < 9; i++) { const [px, py] = pts[i]; i === 1 ? ctx.moveTo(px, py + side * 3.6) : ctx.lineTo(px, py + side * 3.6); } ctx.stroke(); }
  ctx.fillStyle = '#2a2014';
  for (let i = 2; i < 12; i += 1.5) { const [px, py] = pts[Math.floor(i)]; ctx.beginPath(); ctx.arc(px, py + ((i * 7) % 3 - 1), 0.9, 0, TAU); ctx.fill(); }
  shadedEllipse(ctx, 11, pts[0][1], 5, 4, ['#6a5a3a', '#a89060', '#2a2010'], L);
  ctx.fillStyle = '#d8a030'; for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(12.5, pts[0][1] + side * 2.6, 1.2, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#0a0806'; for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(12.8, pts[0][1] + side * 2.6, 0.6, 0, TAU); ctx.fill(); }
  ctx.restore();
}

/* ------------------------------------------------------------------ mole */

/* A mole spends nearly all its life underground: you see a ridge of earth heaving along,
   and fresh molehills. Now and then it surfaces, and it will happily eat ants it finds there. */
class Mole extends Critter {
  constructor(game, x, y) {
    super(game, x, y);
    this.kind = 'mole'; this.r = 24; this.size = 1; this.gaitK = 0.12; this.fear = 14;
    this.maxHp = this.hp = 520; this.under = true; this.upT = 0; this.surfaceCd = rand(6, 14);
    this.home = { x, y }; this.ridge = []; this.hills = []; this.lastR = { x, y }; this.biteCd = 0;
  }
  get invuln() { return this.under; }
  get predator() { return !this.under; }
  update(dt) {
    const g = this.game, now = g.time;
    this.hurtT -= dt; this.biteCd -= dt; this.biteT -= dt;
    if (this.under) {
      this.surfaceCd -= dt;
      this.wanderStep(dt, 26, this.home, 500);
      if (dist2(this.x, this.y, this.lastR.x, this.lastR.y) > 10 * 10) { this.ridge.push({ x: this.x, y: this.y, t: now }); this.lastR = { x: this.x, y: this.y }; }
      // surface where there's something to eat: worms, or a lone ant
      if (this.surfaceCd <= 0) {
        const tg = isolatedAnt(g, this.x, this.y, 90);
        if (tg || Math.random() < 0.3) { this.under = false; this.upT = rand(5, 9); this.target = tg; this.hills.push({ x: this.x, y: this.y, t: now, r: rand(18, 26) }); g.fx.dust(this.x, this.y, 10); }
        else this.surfaceCd = rand(2, 5);
      }
    } else {
      this.upT -= dt;
      const mob = antMob(g, this.x, this.y, 90);
      const tg = this.target && !this.target.dead && !this.target.inNest ? this.target : nearestAnt(g, this.x, this.y, 80);
      if (tg) {
        const d = dist(this.x, this.y, tg.x, tg.y), ang = Math.atan2(tg.y - this.y, tg.x - this.x);
        if (d > this.r + tg.r + 4) this.move(ang, 40, dt, 3);
        else { this.a += clamp(angDiff(this.a, ang), -4 * dt, 4 * dt); this.speedNow = 0; if (this.biteCd <= 0) { this.biteCd = 0.8; this.biteT = 0.3; tg.damage(tg.isPlayer ? 18 : 30, this); } }
      } else this.speedNow = 0;
      // back down the hole when the time's up or the ants pile on
      if (this.upT <= 0 || mob > 12 || this.hp < this.maxHp * 0.4) { this.under = true; this.surfaceCd = rand(8, 16); this.target = null; g.fx.dust(this.x, this.y, 8); this.hp = Math.min(this.maxHp, this.hp + 60); }
    }
    while (this.ridge.length && now - this.ridge[0].t > 40) this.ridge.shift();
    while (this.hills.length && now - this.hills[0].t > 120) this.hills.shift();
  }
  damage(amt, src) {
    if (this.dead || this.under) return;
    this.hp -= amt; this.hurtT = 0.12; this.hitFx();
    if (src && src.kind === 'ant') this.target = src;
    if (this.hp <= 0) { this.dead = true; this.game.onCritterDeath(this, src); }
  }
  drawTrail(ctx) {
    const now = this.game.time;
    // the heaved-up ridge of soil over the tunnel
    for (const p of this.ridge) {
      const k = 1 - (now - p.t) / 40;
      radialFill(ctx, p.x + 1, p.y + 2, 11, [[0, `rgba(40,25,10,${0.25 * k})`], [1, 'rgba(40,25,10,0)']]);
      radialFill(ctx, p.x - 1, p.y - 1, 9, [[0, `rgba(120,90,60,${0.55 * k})`], [1, 'rgba(120,90,60,0)']]);
    }
    for (const h of this.hills) {
      const k = Math.min(1, (120 - (now - h.t)) / 20);
      ctx.globalAlpha = k;
      const R = mulberry32((h.x * 7 + h.y) | 0);
      radialFill(ctx, h.x + 3, h.y + 4, h.r * 1.2, [[0, 'rgba(30,20,8,0.35)'], [1, 'rgba(30,20,8,0)']]);
      for (let i = 0; i < 70; i++) {
        const a = R() * TAU, d = h.r * Math.sqrt(R()), s2 = 1.2 + R() * 2.2;
        soilGrain(ctx, h.x + Math.cos(a) * d, h.y + Math.sin(a) * d, s2, ['#5a3e26', '#7a5a3a', '#4a301c', '#8a6a48'][(R() * 4) | 0], R() * 3);
      }
      domeLight(ctx, h.x, h.y, h.r, 0.8);
      ctx.globalAlpha = 1;
    }
  }
  draw(ctx, t) {
    if (this.under) {
      // just the moving bulge of earth above its back
      radialFill(ctx, this.x + 2, this.y + 3, 18, [[0, 'rgba(30,20,8,0.35)'], [1, 'rgba(30,20,8,0)']]);
      radialFill(ctx, this.x - 2, this.y - 2, 15, [[0, 'rgba(150,115,80,0.9)'], [0.7, 'rgba(110,80,50,0.6)'], [1, 'rgba(110,80,50,0)']]);
      return;
    }
    drawMole(ctx, this, t);
  }
}
function drawMole(ctx, e, t) {
  const s = e.size, L = localLight(e.a);
  softShadow(ctx, e.x + 4 * s, e.y + 6 * s, e.a, 30 * s, 18 * s, 0.32);
  ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.a); ctx.scale(s, s);
  // huge pink spade hands for digging
  for (const side of [-1, 1]) {
    const sw = e.dead ? 0 : Math.sin((e.gait || 0) * 2 + (side > 0 ? 0 : Math.PI)) * 2;
    ctx.save(); ctx.translate(10 + sw, side * 15); ctx.rotate(side * 0.5);
    shadedEllipse(ctx, 0, 0, 6.5, 5, ['#d89a90', '#f8c8c0', '#8a5a50'], L);
    ctx.strokeStyle = '#f0e0d0'; ctx.lineWidth = 0.9;
    for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(4, k * 1.8); ctx.lineTo(8, k * 2.2); ctx.stroke(); }
    ctx.restore();
  }
  ctx.beginPath();
  ctx.moveTo(18, 0); ctx.bezierCurveTo(16, -16, -10, -18, -22, -10); ctx.quadraticCurveTo(-28, 0, -22, 10); ctx.bezierCurveTo(-10, 18, 16, 16, 18, 0);
  const g = ctx.createRadialGradient(L.x * 8, L.y * 8, 2, 0, 0, 24);
  g.addColorStop(0, e.dead ? '#5a5250' : '#3e3640'); g.addColorStop(0.6, e.dead ? '#3a3230' : '#1c1820'); g.addColorStop(1, '#08060a');
  ctx.fillStyle = g; ctx.fill();
  // velvety sheen
  ctx.strokeStyle = 'rgba(160,150,190,0.12)'; ctx.lineWidth = 0.6;
  const R = mulberry32(e.id || 9);
  for (let i = 0; i < 60; i++) { const x = -18 + R() * 32, y = (R() - 0.5) * 24; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y); ctx.stroke(); }
  gloss(ctx, 0, 0, 20, 14, L, 0.18);
  // pink snout, no visible eyes
  ctx.fillStyle = '#e8a0a0'; ctx.beginPath(); ctx.ellipse(20, 0, 4.5, 3, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#8a4a4a'; for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(23, side * 1.1, 0.6, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = '#e8a0a0'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(-28, Math.sin(t * 3) * 1.5); ctx.stroke();
  if (e.hurtT > 0) { ctx.fillStyle = 'rgba(255,240,220,0.3)'; ctx.beginPath(); ctx.ellipse(0, 0, 20, 15, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
}

/* ---------------------------------------------------------- assassin bug */

/* Waits motionless beside ant trails, then stabs a passing ant with its beak.
   It holds very still, so ants rarely notice it until it strikes. */
class AssassinBug extends Hunter {
  constructor(game, x, y) {
    super(game, x, y);
    this.kind = 'assassin'; this.r = 10; this.size = 1; this.gaitK = 0.3; this.fear = 4;
    this.maxHp = this.hp = 90; this.waitT = 0; this.stabT = 0;
  }
  update(dt) {
    const g = this.game;
    this.stabT -= dt;
    // find a busy trail and wait beside it
    if (!this.target && this.mode !== 'retreat') {
      let v = 0;
      for (const col of g.activeColonies) v += g.world.sample(col, this.x, this.y);
      if (v > 0.8 && !(this.fullT > 0)) {
        this.speedNow = 0; this.hurtT -= dt; this.biteCd -= dt; this.biteT -= dt; this.think -= dt;
        if (this.think <= 0) {
          this.think = 0.3;
          const tg = nearestAnt(g, this.x, this.y, this.r + 26);
          if (tg && this.biteCd <= 0) { this.a = Math.atan2(tg.y - this.y, tg.x - this.x); this.biteCd = 1.4; this.biteT = 0.35; this.stabT = 0.35; tg.damage(tg.isPlayer ? 12 : 22, this); g.poison(tg, this, 2, 3); }
        }
        return;
      }
    }
    this.hunt(dt, { range: 90, speed: 34, dmg: 14, cd: 1.2, wander: 26, reach: 8, pounce: 0, leash: 400 });
  }
  draw(ctx, t) { drawAssassin(ctx, this, t); }
}
const ASSASSIN_LEGS = [
  { bx: 4, by: 1.5, base: 0.7, bend: -0.5, l1: 7, l2: 8, w1: 1, w2: 0.7 },
  { bx: 0, by: 1.8, base: 1.6, bend: 0.2, l1: 8, l2: 9, w1: 0.9, w2: 0.6 },
  { bx: -3, by: 1.8, base: 2.3, bend: 0.5, l1: 9, l2: 11, w1: 0.9, w2: 0.6 },
];
function drawAssassin(ctx, e, t) {
  const s = e.size, L = localLight(e.a);
  softShadow(ctx, e.x + 3 * s, e.y + 4 * s, e.a, 16 * s, 6 * s, 0.28);
  ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.a); ctx.scale(s, s);
  drawLegs(ctx, ASSASSIN_LEGS, e.gait, '#3a1a10', 0.3, e.dead);
  // flat abdomen with a red-and-black striped rim
  ctx.beginPath(); ctx.ellipse(-6, 0, 9, 5.5, 0, 0, TAU);
  ctx.fillStyle = '#1a0c08'; ctx.fill();
  ctx.fillStyle = '#c03a18';
  for (let k = 0; k < 5; k++) for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(-12 + k * 3, side * 5, 1.1, 0.8, 0, 0, TAU); ctx.fill(); }
  shadedEllipse(ctx, -5, 0, 6.5, 4, ['#4a2414', '#8a5030', '#140804'], L);
  shadedEllipse(ctx, 3, 0, 3.4, 3.6, ['#5a2a16', '#9a5a34', '#180804'], L);
  // long narrow head and the curved stabbing beak
  shadedEllipse(ctx, 8, 0, 3.2, 1.6, ['#5a2a16', '#9a5a34', '#180804'], L);
  const stab = e.stabT > 0 ? 3 : 0;
  ctx.strokeStyle = '#2a120a'; ctx.lineWidth = 1; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(10.5, 0); ctx.quadraticCurveTo(13 + stab, 1.5, 15 + stab, 0.4); ctx.stroke();
  ctx.lineWidth = 0.5;
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(9.5, side); ctx.quadraticCurveTo(14, side * 5, 19, side * 6); ctx.stroke(); }
  ctx.fillStyle = '#e8c070'; for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(8.6, side * 1.6, 0.8, 0, TAU); ctx.fill(); }
  ctx.restore();
}

/* ----------------------------------------------------------- rove beetle */

/* Quick and slender, it raids ant trails. Threatened, it cocks its tail up like a scorpion
   and oozes a foul smell, and the ants hesitate. */
class RoveBeetle extends Hunter {
  constructor(game, x, y) {
    super(game, x, y);
    this.kind = 'rove'; this.r = 8; this.size = 1; this.gaitK = 0.55; this.fear = 4;
    this.maxHp = this.hp = 70; this.tail = 0;
  }
  update(dt) {
    const g = this.game;
    const mob = antMob(g, this.x, this.y, 60);
    this.tail = lerp(this.tail, mob >= 2 || this.mode === 'retreat' ? 1 : 0, Math.min(1, dt * 6));
    // the raised tail sends nearby ants reeling for a moment
    if (this.tail > 0.8 && Math.random() < dt * 1.5) {
      g.hash.query(this.x, this.y, 40, (o) => { if (o.kind === 'ant' && !o.isPlayer && !o.dead && o.role !== 'soldier' && o.state === 'fight' && o.target === this) o.startFlee(this); });
    }
    this.hunt(dt, { range: 140, speed: 85, dmg: 7, cd: 0.6, wander: 46, reach: 3, leash: 500 });
  }
  draw(ctx, t) { drawRove(ctx, this, t); }
}
const ROVE_LEGS = [
  { bx: 3, by: 1.4, base: 0.8, bend: -0.4, l1: 4, l2: 4.5, w1: 0.9, w2: 0.6 },
  { bx: 1, by: 1.6, base: 1.6, bend: 0.2, l1: 4.5, l2: 5, w1: 0.9, w2: 0.6 },
  { bx: -1, by: 1.6, base: 2.3, bend: 0.5, l1: 5, l2: 5.5, w1: 0.9, w2: 0.6 },
];
function drawRove(ctx, e, t) {
  const s = e.size, L = localLight(e.a), up = e.tail || 0;
  softShadow(ctx, e.x + 2 * s, e.y + 3 * s, e.a, 16 * s, 4 * s, 0.28);
  ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.a); ctx.scale(s, s);
  drawLegs(ctx, ROVE_LEGS, e.gait, '#1a1210', 0.35, e.dead);
  // a long bare abdomen that curls forward over the back when threatened
  const segs = 6;
  for (let i = segs; i >= 1; i--) {
    const f = i / segs, curl = up * f * f * 2.4;
    const x = -2 - Math.cos(curl) * f * 14, y = 0, z = Math.sin(curl) * f * 8;
    shadedEllipse(ctx, x + z * 0.4, y - z * 0.5, 2.6 - f * 0.6, 2.6 - f * 0.7, ['#1a1612', '#5a4a40', '#050403'], L);
  }
  // short wing cases, head and jaws
  shadedEllipse(ctx, 1, 0, 3.2, 3, ['#2a2018', '#6a5848', '#080604'], L);
  shadedEllipse(ctx, 5, 0, 2.3, 2.4, ['#1a1612', '#5a4a40', '#050403'], L);
  ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 0.8;
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(7, side * 0.8); ctx.quadraticCurveTo(9, side * 2, 9.5, 0); ctx.stroke(); }
  ctx.lineWidth = 0.4;
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(6.5, side); ctx.quadraticCurveTo(10, side * 4, 13, side * 5); ctx.stroke(); }
  gloss(ctx, 1, 0, 3.2, 3, L, 0.4);
  ctx.restore();
}

/* -------------------------------------------------------------- field vole */

/* A plump little grass-eater. It snaps up seeds and crumbs the ants were after,
   runs for the nearest bramble when they come for it, and tunnels through the grass. */
class Vole extends Critter {
  constructor(game, x, y) {
    super(game, x, y);
    this.kind = 'vole'; this.r = 17; this.size = 1; this.gaitK = 0.2; this.prey = true;
    this.maxHp = this.hp = 240; this.home = { x, y };
  }
  update(dt) {
    this.hurtT -= dt; this.angryT -= dt;
    this.wanderStep(dt, 55, this.home, 600);
  }
  damage(amt, src) {
    if (this.dead) return;
    this.hp -= amt; this.hurtT = 0.12; this.hitFx();
    if (src && src.team) { this.angryT = 6; this.angryTeam = src.team; }
    if (this.hp <= 0) { this.dead = true; this.game.onCritterDeath(this, src); }
  }
  draw(ctx, t) { drawVole(ctx, this, t); }
}
function drawVole(ctx, e, t) {
  const s = e.size, L = localLight(e.a), run = e.dead ? 0 : Math.min(1, (e.speedNow || 0) / 50);
  softShadow(ctx, e.x + 4 * s, e.y + 6 * s, e.a, 22 * s, 13 * s, 0.3);
  ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.a); ctx.scale(s, s);
  ctx.fillStyle = '#c8a088';
  for (const side of [-1, 1]) for (const fx of [7, -8]) {
    const sw = e.dead ? 0 : Math.sin((e.gait || 0) + (fx > 0 ? 0 : Math.PI) + (side > 0 ? Math.PI : 0)) * 2.5 * run;
    ctx.beginPath(); ctx.ellipse(fx + sw, side * 10, 2.2, 1.5, 0, 0, TAU); ctx.fill();
  }
  ctx.strokeStyle = '#6a5040'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(-21, Math.sin(t * 2 + (e.id || 0)) * 1.5); ctx.stroke();
  // round, chunky body: shorter snout and tail than a mouse
  ctx.beginPath();
  ctx.moveTo(14, 0); ctx.bezierCurveTo(13, -12, -6, -14, -15, -8); ctx.quadraticCurveTo(-20, 0, -15, 8); ctx.bezierCurveTo(-6, 14, 13, 12, 14, 0);
  const g = ctx.createRadialGradient(L.x * 6, L.y * 6, 1, 0, 0, 18);
  g.addColorStop(0, e.dead ? '#9a8a78' : '#a8805a'); g.addColorStop(0.55, e.dead ? '#6a5a48' : '#7a5636'); g.addColorStop(1, '#2e1e10');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(220,190,150,0.2)'; ctx.lineWidth = 0.5;
  const R = mulberry32(e.id || 4);
  for (let i = 0; i < 40; i++) { const x = -13 + R() * 24, y = (R() - 0.5) * 18; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2.5, y + (R() - 0.5)); ctx.stroke(); }
  ctx.fillStyle = '#6a4a30'; ctx.beginPath(); ctx.ellipse(14, 0, 4, 4, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2a1810'; ctx.beginPath(); ctx.arc(17.5, 0, 1.3, 0, TAU); ctx.fill();
  ctx.fillStyle = '#050302'; for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(10, side * 5, 1.4, 0, TAU); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(9.6, side * 5 - 0.5, 0.4, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#8a6a50'; for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(5, side * 8.5, 2.4, 2, 0, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = 'rgba(240,230,220,0.45)'; ctx.lineWidth = 0.35;
  for (const side of [-1, 1]) for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(16, side); ctx.lineTo(21 + k, side * (3 + k * 1.6)); ctx.stroke(); }
  if (e.hurtT > 0) { ctx.fillStyle = 'rgba(255,240,220,0.3)'; ctx.beginPath(); ctx.ellipse(0, 0, 16, 11, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
}

/* ------------------------------------------------------------ registration */

Object.assign(CRITTER_CLASSES, { newt: Newt, mole: Mole, assassin: AssassinBug, rove: RoveBeetle, vole: Vole });
SPAWN_TABLE.marsh.push(['newt', 2.5]);
SPAWN_TABLE.meadow.push(['mole', 0.5], ['vole', 1.5], ['assassin', 0.8]);
SPAWN_TABLE.wood.push(['rove', 2], ['mole', 0.4], ['newt', 0.4]);
SPAWN_TABLE.dry.push(['assassin', 1.6], ['vole', 0.6]);

Object.assign(BIG_KINDS, {
  newt: { needs: 4, value: 24, r: 18, name: 'newt' },
  mole: { needs: 16, value: 95, r: 30, name: 'mole' },
  assassin: { needs: 2, value: 12, r: 14, name: 'assassin bug' },
  rove: { needs: 2, value: 9, r: 12, name: 'rove beetle' },
  vole: { needs: 10, value: 60, r: 24, name: 'field vole' },
});

Object.assign(CORPSE_DRAW, {
  newt: (c, t) => drawNewt(c, { x: 0, y: 0, a: 0, size: 0.9, dead: true, sway: 0, gait: 0 }, t),
  mole: (c, t) => drawMole(c, { x: 0, y: 0, a: 0, size: 0.9, dead: true, gait: 0, id: 3 }, t),
  assassin: (c, t) => drawAssassin(c, { x: 0, y: 0, a: 0, size: 1, dead: true, gait: 0 }, t),
  rove: (c, t) => drawRove(c, { x: 0, y: 0, a: 0, size: 1, dead: true, gait: 0, tail: 0 }, t),
  vole: (c, t) => drawVole(c, { x: 0, y: 0, a: 0, size: 0.9, dead: true, gait: 0, id: 3 }, t),
});
