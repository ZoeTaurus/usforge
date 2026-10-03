'use strict';
/* More small life: harvestmen, ground beetles, jumping spiders, toads, shrews,
   water striders and hoverflies. Each has its own art and behaviour. */

/* ------------------------------------------------------------ harvestman */

/* Not a spider: one round body, no venom, and eight absurdly long legs.
   Its body bobs up and down as it stilts along. Harmless and nervous. */
class Harvestman extends Critter {
  constructor(game, x, y) {
    super(game, x, y);
    this.kind = 'harvestman'; this.r = 7; this.size = 1; this.prey = true; this.gaitK = 0.16;
    this.maxHp = this.hp = 35; this.bobT = 0;
  }
  update(dt) {
    this.hurtT -= dt; this.angryT -= dt;
    // shy: stilts away from any ant that comes close
    const th = nearestAnt(this.game, this.x, this.y, 70);
    if (th) this.move(Math.atan2(this.y - th.y, this.x - th.x), 58, dt, 6);
    else this.wanderStep(dt, 24);
    this.bobT += dt * (2 + this.speedNow * 0.08);
  }
  damage(amt, src) {
    if (this.dead) return;
    this.hp -= amt; this.hurtT = 0.15; this.hitFx();
    // harvestmen shed a leg to escape
    if (this.hp > 0 && Math.random() < 0.3) this.game.fx.text(this.x, this.y - 14, 'drops a leg!', '#e8dcc0');
    if (this.hp <= 0) { this.dead = true; this.game.onCritterDeath(this, src); }
  }
  draw(ctx, t) { drawHarvestman(ctx, this, t); }
}

function drawHarvestman(ctx, e, t) {
  const s = e.size, L = localLight(e.a), bob = e.dead ? 0 : Math.sin(e.bobT || 0) * 1.5;
  softShadow(ctx, e.x + 3 * s, e.y + 4 * s, e.a, 9 * s, 7 * s, 0.25);
  ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.a); ctx.scale(s, s);
  ctx.lineCap = 'round';
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 4; i++) {
      const grp = (i + (side > 0 ? 1 : 0)) % 2, sw = e.dead ? 0 : Math.sin(e.gait + grp * Math.PI) * 0.25;
      const a = side * (0.5 + i * 0.62 + sw), len = i === 1 ? 34 : 26 + i * 2;
      const kx = Math.cos(a) * len * 0.42, ky = Math.sin(a) * len * 0.42;
      const fx = Math.cos(a + side * 0.12) * len, fy = Math.sin(a + side * 0.12) * len;
      // the "knee" sits high above the body, so its shadow falls far from the foot
      ctx.strokeStyle = 'rgba(20,15,5,0.16)'; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(3, 4); ctx.lineTo(kx + 6, ky + 8); ctx.lineTo(fx + 1, fy + 1.5); ctx.stroke();
      ctx.strokeStyle = '#5a4030'; ctx.lineWidth = 0.75;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(kx * 1.1, ky * 1.1 - 3, fx, fy); ctx.stroke();
      ctx.fillStyle = '#c8a888'; ctx.beginPath(); ctx.arc(kx, ky - 1.5, 0.6, 0, TAU); ctx.fill();
    }
  }
  ctx.translate(0, -bob);
  shadedEllipse(ctx, -0.5, 0, 4.8, 4, ['#8a6444', '#d4aa80', '#3a2414'], L);
  ctx.fillStyle = 'rgba(60,35,15,0.5)'; ctx.beginPath(); ctx.ellipse(-0.5, 0, 3.2, 1, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#1a1008'; ctx.beginPath(); ctx.arc(2.2, -0.9, 0.7, 0, TAU); ctx.arc(2.2, 0.9, 0.7, 0, TAU); ctx.fill();
  gloss(ctx, -0.5, 0, 4.8, 4, L, 0.4);
  ctx.restore();
}

/* ---------------------------------------------------------- ground beetle */

/* A long-jawed, iridescent night hunter. It hides under litter by day. */
class GroundBeetle extends Hunter {
  constructor(game, x, y) {
    super(game, x, y);
    this.kind = 'groundbeetle'; this.r = 11; this.size = 1.1; this.gaitK = 0.45; this.fear = 5;
    this.maxHp = this.hp = 140; this.hue = Math.random() < 0.5 ? 0 : 1;
  }
  update(dt) {
    const night = this.game.darkness() > 0.2;
    if (!night && !this.target) { this.hurtT -= dt; this.biteCd -= dt; this.biteT -= dt; this.wanderStep(dt, 10, this.home, 140); return; }
    this.hunt(dt, { range: night ? 170 : 70, speed: 78, dmg: 12, cd: 0.75, wander: 34, reach: 4, leash: 500 });
  }
  draw(ctx, t) { drawGroundBeetle(ctx, this, t); }
}
const GBEETLE_LEGS = [
  { bx: 4, by: 2, base: 0.8, bend: -0.5, l1: 6, l2: 7, w1: 1.2, w2: 0.8 },
  { bx: 1, by: 2.4, base: 1.6, bend: 0.1, l1: 6.5, l2: 7.5, w1: 1.2, w2: 0.8 },
  { bx: -2, by: 2.4, base: 2.3, bend: 0.5, l1: 7.5, l2: 9, w1: 1.2, w2: 0.8 },
];
function drawGroundBeetle(ctx, e, t) {
  const s = e.size, L = localLight(e.a);
  softShadow(ctx, e.x + 3 * s, e.y + 4 * s, e.a, 16 * s, 7 * s, 0.32);
  ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.a); ctx.scale(s, s);
  drawLegs(ctx, GBEETLE_LEGS, e.gait, '#140c14', 0.35, e.dead);
  const pal = e.hue ? ['#1c2a40', '#5a86c8', '#06080e'] : ['#2a1a34', '#9a5ac8', '#0a060e'];
  // the wing cases, ridged and shimmering
  shadedEllipse(ctx, -5, 0, 9, 6, pal, L);
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.moveTo(1, 0); ctx.lineTo(-13.5, 0); ctx.stroke();
  for (let k = -2; k <= 2; k++) { if (!k) continue; ctx.beginPath(); ctx.ellipse(-5, 0, 8, Math.abs(k) * 1.6, 0, k > 0 ? 0 : Math.PI, k > 0 ? Math.PI : TAU); ctx.stroke(); }
  const sh = 0.5 + 0.5 * Math.sin(t * 1.5 + e.id);
  ctx.fillStyle = e.hue ? `rgba(120,230,200,${0.12 + 0.12 * sh})` : `rgba(230,120,200,${0.12 + 0.12 * sh})`;
  ctx.beginPath(); ctx.ellipse(-5 + L.x * 3, L.y * 2, 6, 3.5, 0, 0, TAU); ctx.fill();
  shadedEllipse(ctx, 5.5, 0, 3.6, 4.2, ['#1a1420', '#5a4a6a', '#050307'], L);
  shadedEllipse(ctx, 10, 0, 2.6, 2.6, ['#1a1420', '#5a4a6a', '#050307'], L);
  ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
  const open = e.biteT > 0 ? 0.5 : 0.15;
  for (let side = -1; side <= 1; side += 2) {
    ctx.beginPath(); ctx.moveTo(12, side * 1.2); ctx.quadraticCurveTo(15.5, side * (2.5 + open * 3), 17, side * (0.2 - open)); ctx.stroke();
  }
  ctx.strokeStyle = '#3a2a30'; ctx.lineWidth = 0.5;
  for (let side = -1; side <= 1; side += 2) { ctx.beginPath(); ctx.moveTo(11.5, side * 1.6); ctx.quadraticCurveTo(16, side * 6, 20, side * 9); ctx.stroke(); }
  gloss(ctx, -5, 0, 9, 6, L, 0.45);
  ctx.restore();
}

/* --------------------------------------------------------- jumping spider */

/* Tiny, fuzzy and very sharp-eyed: it watches, creeps, then leaps onto a lone ant. */
class JumpingSpider extends Hunter {
  constructor(game, x, y) {
    super(game, x, y);
    this.kind = 'jumper'; this.r = 9; this.size = 1; this.gaitK = 0.4; this.fear = 4;
    this.maxHp = this.hp = 80; this.z = 0; this.leapT = 0; this.peek = 0;
  }
  update(dt) {
    const g = this.game;
    // swivel to watch the player when nearby: jumping spiders track movement
    const p = g.player;
    if (p && !p.dead && dist2(p.x, p.y, this.x, this.y) < 160 * 160 && !this.target) this.peek = Math.atan2(p.y - this.y, p.x - this.x);
    else this.peek = null;
    if (this.leapT > 0) {
      this.leapT -= dt;
      const k = 1 - this.leapT / 0.4;
      this.z = Math.sin(k * Math.PI) * 14;
      g.world.moveTo(this, this.x + Math.cos(this.leapA) * 260 * dt, this.y + Math.sin(this.leapA) * 260 * dt);
      const tg = this.target;
      if (tg && !tg.dead && dist2(this.x, this.y, tg.x, tg.y) < (this.r + tg.r + 3) ** 2 && !this.leapHit) { this.leapHit = true; tg.damage(16, this); this.biteT = 0.3; }
      return;
    }
    this.z = 0;
    const tg = this.target;
    if (tg && !tg.dead && this.mode === 'stalk' && this.biteCd <= 0) {
      const d = dist(this.x, this.y, tg.x, tg.y);
      if (d < 85 && d > 25) { this.leapT = 0.4; this.leapA = Math.atan2(tg.y - this.y, tg.x - this.x); this.a = this.leapA; this.leapHit = false; this.biteCd = 1.6; if (g.mode === 'play') SFX.world(g, 'leap', this.x, this.y); return; }
    }
    this.hunt(dt, { range: 140, speed: 46, dmg: 8, cd: 0.9, wander: 26, reach: 3, pounce: 0, leash: 350 });
    if (this.peek != null && this.mode === 'prowl') { this.a += clamp(angDiff(this.a, this.peek), -4 * dt, 4 * dt); this.speedNow = Math.min(this.speedNow, 6); }
  }
  draw(ctx, t) { drawJumper(ctx, this, t); }
}
const JUMPER_LEGS = [
  { bx: 3, by: 1.8, base: 0.7, bend: -0.4, l1: 4.5, l2: 5, w1: 1.6, w2: 1.1 },
  { bx: 1.5, by: 2.2, base: 1.3, bend: 0.1, l1: 4, l2: 4.5, w1: 1.3, w2: 0.9 },
  { bx: 0, by: 2.2, base: 1.9, bend: 0.4, l1: 4, l2: 4.5, w1: 1.3, w2: 0.9 },
  { bx: -1.5, by: 1.8, base: 2.5, bend: 0.5, l1: 4.5, l2: 5.5, w1: 1.4, w2: 1 },
];
function drawJumper(ctx, e, t) {
  const s = e.size, L = localLight(e.a), z = e.z || 0;
  softShadow(ctx, e.x + (2.5 + z * 0.5) * s, e.y + (3.5 + z * 0.8) * s, e.a, 11 * s, 7 * s, 0.3);
  ctx.save(); ctx.translate(e.x, e.y - z * 0.3); ctx.rotate(e.a); ctx.scale(s * (1 + z * 0.01), s * (1 + z * 0.01));
  drawLegs(ctx, JUMPER_LEGS, e.gait, '#2a201a', z > 0 ? 0 : 0.3, e.dead);
  shadedEllipse(ctx, -6, 0, 5.5, 4.6, ['#2a221c', '#6a5a4a', '#0a0806'], L);
  // pale chevrons on the abdomen and a fuzzy fringe
  ctx.fillStyle = 'rgba(240,230,210,0.75)';
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-3.5 - k * 2.5, 0); ctx.lineTo(-5 - k * 2.5, -2.2 + k * 0.4); ctx.lineTo(-5.6 - k * 2.5, -1.6); ctx.lineTo(-4.4 - k * 2.5, 0); ctx.lineTo(-5.6 - k * 2.5, 1.6); ctx.lineTo(-5 - k * 2.5, 2.2 - k * 0.4); ctx.closePath(); ctx.fill(); }
  shadedEllipse(ctx, 2.2, 0, 4.4, 4.2, ['#3a2e24', '#8a7058', '#120c08'], L);
  ctx.strokeStyle = 'rgba(200,180,150,0.35)'; ctx.lineWidth = 0.4;
  for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; ctx.beginPath(); ctx.moveTo(2.2 + Math.cos(a) * 3.6, Math.sin(a) * 3.4); ctx.lineTo(2.2 + Math.cos(a) * 5, Math.sin(a) * 4.8); ctx.stroke(); }
  // the two huge front eyes, which shine like headlamps
  for (let side = -1; side <= 1; side += 2) {
    ctx.fillStyle = '#050403'; ctx.beginPath(); ctx.arc(5.6, side * 1.5, 1.5, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(140,200,230,0.8)'; ctx.beginPath(); ctx.arc(5.2, side * 1.5 - 0.5, 0.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#050403'; ctx.beginPath(); ctx.arc(4.2, side * 3.2, 0.6, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = '#e0c060'; ctx.beginPath(); ctx.ellipse(6.6, -0.8, 0.8, 0.5, 0, 0, TAU); ctx.ellipse(6.6, 0.8, 0.8, 0.5, 0, 0, TAU); ctx.fill();
  ctx.restore();
}

/* ------------------------------------------------------------------ toad */

/* Slower and drier than a frog, it sits in the damp woods and flicks ants up with its tongue. */
class Toad extends Frog {
  constructor(game, x, y) {
    super(game, x, y);
    this.kind = 'toad'; this.r = 26; this.size = 1.15; this.fear = 8; this.swims = false;
    this.maxHp = this.hp = 230; this.warty = true; this.pal = ['#7a5a34', '#c49a64', '#3a2410'];
  }
}

/* ----------------------------------------------------------------- shrew */

/* A tiny mammal with a racing heart: it must eat almost constantly, so it hunts all day.
   Fast, twitchy, and it bolts if the ants hurt it. */
class Shrew extends Hunter {
  constructor(game, x, y) {
    super(game, x, y);
    this.kind = 'shrew'; this.r = 18; this.size = 1; this.gaitK = 0.2; this.fear = 10;
    this.maxHp = this.hp = 300; this.sniffT = 0; this.pauseT = 0;
  }
  update(dt) {
    this.sniffT += dt * 18;
    // stop-start foraging, nose twitching between dashes
    if (this.mode !== 'pounce' && this.mode !== 'retreat') {
      this.pauseT -= dt;
      if (this.pauseT < -rand(0.6, 1.4)) this.pauseT = rand(0.2, 0.6);
      if (this.pauseT > 0) { this.speedNow = 0; this.hurtT -= dt; this.biteCd -= dt; this.biteT -= dt; this.think -= dt; return; }
    }
    if (this.mode === 'pounce' && this.game.mode === 'play') SFX.world(this.game, 'squeak', this.x, this.y);
    this.hunt(dt, { range: 180, speed: 92, dmg: 15, cd: 0.6, wander: 55, reach: 6, leash: 600 });
  }
  draw(ctx, t) { drawShrew(ctx, this, t); }
}
function drawShrew(ctx, e, t) {
  const s = e.size, L = localLight(e.a), run = e.dead ? 0 : Math.min(1, (e.speedNow || 0) / 60);
  const bounce = Math.sin(e.gait * 2) * 1.2 * run;
  softShadow(ctx, e.x + 4 * s, e.y + 6 * s, e.a, 26 * s, 12 * s, 0.3);
  ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.a); ctx.scale(s, s);
  // tail
  ctx.strokeStyle = '#5a4434'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-18, 0); ctx.quadraticCurveTo(-28, Math.sin(t * 3 + e.id) * 4, -36, Math.sin(t * 3 + e.id + 1) * 6); ctx.stroke();
  // feet
  ctx.fillStyle = '#c8a090';
  for (let side = -1; side <= 1; side += 2) for (const fx of [8, -10]) {
    const sw = e.dead ? 0 : Math.sin(e.gait + (fx > 0 ? 0 : Math.PI) + (side > 0 ? Math.PI : 0)) * 3 * run;
    ctx.beginPath(); ctx.ellipse(fx + sw, side * 10, 2.4, 1.6, 0, 0, TAU); ctx.fill();
  }
  // velvet body
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.bezierCurveTo(12, -10, -6, -12 - bounce, -16, -8);
  ctx.quadraticCurveTo(-22, 0, -16, 8);
  ctx.bezierCurveTo(-6, 12 + bounce, 12, 10, 14, 0);
  const g = ctx.createRadialGradient(L.x * 6, L.y * 6, 1, 0, 0, 20);
  g.addColorStop(0, e.dead ? '#8a7a70' : '#8a6a58'); g.addColorStop(0.55, e.dead ? '#5a4a40' : '#4a3428'); g.addColorStop(1, '#1e1410');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(200,170,150,0.18)'; ctx.lineWidth = 0.5;
  const R = mulberry32(e.id || 3);
  for (let i = 0; i < 40; i++) { const x = -14 + R() * 26, y = (R() - 0.5) * 16; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2.5, y + (R() - 0.5)); ctx.stroke(); }
  // long, wiggling snout and tiny eyes
  const tw = Math.sin(e.sniffT || 0) * 0.15;
  ctx.save(); ctx.translate(13, 0); ctx.rotate(tw);
  ctx.fillStyle = '#5a4034'; ctx.beginPath(); ctx.moveTo(0, -4); ctx.quadraticCurveTo(9, -1.5, 11, 0); ctx.quadraticCurveTo(9, 1.5, 0, 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#d88a90'; ctx.beginPath(); ctx.arc(11, 0, 1.4, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(240,230,220,0.5)'; ctx.lineWidth = 0.35;
  for (let side = -1; side <= 1; side += 2) for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(8, side); ctx.lineTo(14 + k, side * (4 + k * 2)); ctx.stroke(); }
  ctx.restore();
  ctx.fillStyle = '#050302';
  for (let side = -1; side <= 1; side += 2) { ctx.beginPath(); ctx.arc(10, side * 4.5, 1.1, 0, TAU); ctx.fill(); }
  ctx.fillStyle = 'rgba(180,140,130,0.8)';
  for (let side = -1; side <= 1; side += 2) { ctx.beginPath(); ctx.ellipse(5, side * 8, 2, 2.6, 0, 0, TAU); ctx.fill(); }
  if (e.hurtT > 0) { ctx.fillStyle = 'rgba(255,240,220,0.3)'; ctx.beginPath(); ctx.ellipse(0, 0, 18, 12, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
}

/* --------------------------------------------------------- water strider */

/* Skates on the surface film of ponds and rivers, dimpling the water with its feet. */
class WaterStrider extends Critter {
  constructor(game, x, y) {
    super(game, x, y);
    this.kind = 'strider'; this.r = 6; this.size = 1; this.z = 0;
    this.maxHp = this.hp = 20; this.glideT = 0; this.vx = 0; this.vy = 0;
  }
  get invuln() { return true; }
  update(dt) {
    const w = this.game.world;
    this.glideT -= dt;
    if (this.glideT <= 0) {
      // a quick rowing stroke, then a long glide
      this.glideT = rand(0.5, 1.6);
      let a = this.a + rand(-1.2, 1.2);
      for (let k = 0; k < 6 && !w.waterAt(this.x + Math.cos(a) * 40, this.y + Math.sin(a) * 40); k++) a += 1.1;
      this.a = a; this.vx = Math.cos(a) * 110; this.vy = Math.sin(a) * 110; this.gait += 2;
    }
    this.vx *= 1 - dt * 2.2; this.vy *= 1 - dt * 2.2;
    const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
    if (w.waterAt(nx, ny)) { this.x = nx; this.y = ny; } else { this.vx = -this.vx; this.vy = -this.vy; this.a += Math.PI; }
    this.speedNow = Math.hypot(this.vx, this.vy);
    if (!w.waterAt(this.x, this.y)) this.dead = true;
  }
  damage() {}
  draw(ctx, t) { drawStrider(ctx, this, t); }
}
function drawStrider(ctx, e, t) {
  ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.a);
  const feet = [[9, 7], [9, -7], [-12, 13], [-12, -13], [-2, 15], [-2, -15]];
  // dimples in the surface film around each foot
  for (const [fx, fy] of feet) {
    const g = ctx.createRadialGradient(fx - 0.6, fy - 0.6, 0, fx, fy, 3.6);
    g.addColorStop(0, 'rgba(10,30,40,0.35)'); g.addColorStop(0.7, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(fx, fy, 3.6, 0, TAU); ctx.fill();
  }
  ctx.strokeStyle = '#2a241c'; ctx.lineWidth = 0.6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(3, 0); ctx.lineTo(9, 7); ctx.moveTo(3, 0); ctx.lineTo(9, -7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-3, 9, -2, 15); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-3, -9, -2, -15); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-1, 0); ctx.quadraticCurveTo(-6, 8, -12, 13); ctx.moveTo(-1, 0); ctx.quadraticCurveTo(-6, -8, -12, -13); ctx.stroke();
  ctx.fillStyle = 'rgba(10,20,30,0.18)'; ctx.beginPath(); ctx.ellipse(1, 2, 7, 1.6, 0, 0, TAU); ctx.fill();
  shadedEllipse(ctx, -1, 0, 7, 1.4, ['#3a3228', '#8a7a64', '#100c08'], localLight(e.a));
  shadedEllipse(ctx, 6.5, 0, 1.6, 1.1, ['#3a3228', '#8a7a64', '#100c08'], localLight(e.a));
  ctx.restore();
}

/* --------------------------------------------------------------- hoverfly */

/* Dressed like a wasp but harmless: it hangs perfectly still in the air, then darts away. */
class Hoverfly extends Bee {
  constructor(game, x, y) {
    super(game, x, y);
    this.kind = 'hoverfly'; this.r = 6; this.hoverT = rand(1, 3); this.tx = x; this.ty = y; this.z = 24;
  }
  update(dt) {
    const g = this.game, t = g.time;
    this.hurtT -= dt; this.hoverT -= dt;
    if (this.hoverT <= 0) {
      this.hoverT = rand(1.2, 3.5);
      const fl = Math.random() < 0.5 ? g.world.flowersNear(this.x + rand(-200, 200), this.y + rand(-200, 200)) : [];
      if (fl.length) { const f = pick(fl); this.tx = f.x; this.ty = f.y; }
      else { this.tx = this.home.x + rand(-400, 400); this.ty = this.home.y + rand(-400, 400); }
    }
    const dx = this.tx - this.x, dy = this.ty - this.y, d = Math.hypot(dx, dy);
    if (d > 6) {
      const sp = Math.min(260, d * 6);
      this.x += (dx / d) * sp * dt; this.y += (dy / d) * sp * dt;
      this.a += clamp(angDiff(this.a, Math.atan2(dy, dx)), -10 * dt, 10 * dt);
    } else this.x += Math.sin(t * 13 + this.id) * 0.15;
    this.z = 24 + Math.sin(t * 2 + this.id) * 3;
  }
  draw(ctx, t) { drawHoverfly(ctx, this, t); }
}
function drawHoverfly(ctx, e, t) {
  const z = e.z || 0, L = localLight(e.a);
  ctx.save(); ctx.translate(e.x + z * 0.6, e.y + z * 0.9); ctx.rotate(e.a);
  ctx.fillStyle = 'rgba(15,15,5,0.14)'; ctx.beginPath(); ctx.ellipse(-1, 0, 8, 4, 0, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.a);
  // a blur of wings beating too fast to see
  const flick = Math.sin(t * 90 + e.id) * 0.2;
  for (let side = -1; side <= 1; side += 2) {
    ctx.save(); ctx.rotate(side * (1.25 + flick));
    ctx.fillStyle = 'rgba(220,235,255,0.35)'; ctx.strokeStyle = 'rgba(120,130,150,0.4)'; ctx.lineWidth = 0.4;
    ctx.beginPath(); ctx.ellipse(5, 0, 6, 2.2, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  shadedEllipse(ctx, -3.5, 0, 5, 3, ['#d8a018', '#ffe070', '#5a3a04'], L);
  ctx.fillStyle = '#1a1206';
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.ellipse(-1.6 - k * 2.2, 0, 0.6, 2.8 - k * 0.4, 0, 0, TAU); ctx.fill(); }
  shadedEllipse(ctx, 1.6, 0, 2.4, 2.2, ['#3a3010', '#8a7a30', '#100c02'], L);
  shadedEllipse(ctx, 4, 0, 1.8, 2.3, ['#6a2010', '#c86040', '#200602'], L);
  gloss(ctx, -3.5, 0, 5, 3, L, 0.4);
  ctx.restore();
}

/* ------------------------------------------------------------ registration */

Object.assign(CRITTER_CLASSES, { harvestman: Harvestman, groundbeetle: GroundBeetle, jumper: JumpingSpider, toad: Toad, shrew: Shrew });
SPAWN_TABLE.meadow.push(['harvestman', 2], ['jumper', 1.2], ['groundbeetle', 1]);
SPAWN_TABLE.wood.push(['harvestman', 3], ['groundbeetle', 2.5], ['shrew', 0.6], ['toad', 0.8]);
SPAWN_TABLE.marsh.push(['toad', 2], ['harvestman', 1]);
SPAWN_TABLE.dry.push(['jumper', 2], ['groundbeetle', 1]);

Object.assign(BIG_KINDS, {
  harvestman: { needs: 2, value: 8, r: 14, name: 'harvestman' },
  groundbeetle: { needs: 3, value: 16, r: 15, name: 'ground beetle' },
  jumper: { needs: 2, value: 10, r: 11, name: 'jumping spider' },
  toad: { needs: 8, value: 45, r: 26, name: 'toad' },
  shrew: { needs: 12, value: 70, r: 26, name: 'shrew' },
});

Object.assign(CORPSE_DRAW, {
  harvestman: (c, t) => drawHarvestman(c, { x: 0, y: 0, a: 0, size: 1, gait: 0, dead: true, id: 1 }, t),
  groundbeetle: (c, t) => drawGroundBeetle(c, { x: 0, y: 0, a: 0, size: 1.1, gait: 0, dead: true, id: 1 }, t),
  jumper: (c, t) => drawJumper(c, { x: 0, y: 0, a: 0, size: 1, gait: 0, dead: true }, t),
  toad: (c, t) => drawFrog(c, { x: 0, y: 0, a: 0, size: 0.9, dead: true, warty: true, id: 2 }, t),
  shrew: (c, t) => drawShrew(c, { x: 0, y: 0, a: 0, size: 1, gait: 0, dead: true, id: 2 }, t),
});
