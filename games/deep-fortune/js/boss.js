'use strict';
// ============================================================
//  THE DEEP WYRM - boss of the arena at the bottom of the mine
// ============================================================
let boss = null, fireballs = [];
const WYRM = { hp:3200, segs:16, gap:9, headR:13 };
const segR = i => i === 0 ? WYRM.headR : Math.max(5, 11 - i*.4);    // 0 = head, 1.. = body
const inArena = (tx, ty) => ARENA && tx >= ARENA.x0 && tx <= ARENA.x1 && ty >= ARENA.y0 && ty <= ARENA.y1;

function spawnBoss(){
  const cx = (ARENA.x0 + ARENA.x1 + 1)/2*TS, fy = (ARENA.y1 + 1)*TS;
  const mult = game.mode === 'career' ? ({ relaxed:.7, normal:1, hardcore:1.4 }[game.diff] || 1) : 1;
  const hp = Math.round(WYRM.hp * mult);
  boss = { x:cx, y:fy + 30, vx:0, vy:-70, hp, maxHp:hp, state:'intro', t:0, stateT:2.6, flash:0,
           segs:[], spitN:0, spitT:0, alpha:1, dying:0, popT:0, mouth:0, emergeX:cx };
  for (let i=0;i<WYRM.segs;i++) boss.segs.push({ x:cx, y:fy + 30 + (i+1)*WYRM.gap, alive:true });
  game.banner = { text:'THE DEEP WYRM', sub:'has awoken beneath the mine!', t:3.5 };
  SFX.roar(); shake(12);
  hint('bossfight', 'Hit the Wyrm’s HEAD for extra damage. Dodge its fireballs, and watch the floor when it burrows!');
}

// ---------- update ----------
function stepBoss(dt){
  if (!ARENA || !game) return;
  stepFireballs(dt);
  const ptx = Math.floor(pcx()/TS), pty = Math.floor(pcy()/TS);
  if (!boss){
    if (!game.bossDefeated && !game.over && inArena(ptx, pty) && game.opts.enemies !== false) spawnBoss();
    return;
  }
  const b = boss;
  b.t += dt; b.stateT -= dt; b.flash -= dt; b.mouth = Math.max(0, b.mouth - dt);
  if (b.dying > 0){ stepBossDeath(dt); return; }
  // walk away far enough and it gives up (and heals)
  if (!inArena(ptx, pty) && Math.hypot(pcx() - b.x, pcy() - b.y) > 30*TS){ boss = null; fireballs = []; msg('The Deep Wyrm sinks back into the dark...', '#e0533d'); return; }

  const px = pcx(), py = pcy(), dx = px - b.x, dy = py - b.y, dist = Math.hypot(dx, dy) || 1;
  const enraged = b.hp < b.maxHp*.5;
  const minX = (ARENA.x0 + 1)*TS, maxX = ARENA.x1*TS, minY = (ARENA.y0 + 1)*TS, maxY = ARENA.y1*TS;
  let sx = 0, sy = 0, speed = 0;
  switch (b.state){
    case 'intro':
      b.vy = -75; b.vx = Math.sin(b.t*3)*40;
      if (Math.random() < dt*25) burst(b.x + (Math.random()-.5)*30, maxY + TS, '#5a4a52', 3, 80, 300, .8);
      if (b.stateT <= 0){ b.state = 'chase'; b.stateT = 4; }
      break;
    case 'chase':
      speed = enraged ? 128 : 96; sx = dx/dist; sy = dy/dist + Math.sin(b.t*2.2)*.55;
      if (b.stateT <= 0){
        if (Math.random() < .55){ b.state = 'spit'; b.stateT = 1.9; b.spitN = enraged ? 5 : 3; b.spitT = .45; }
        else { b.state = 'burrow'; b.stateT = 1.1; }
      }
      break;
    case 'spit':
      speed = 28; sx = dx/dist; sy = dy/dist;
      b.spitT -= dt;
      if (b.spitT <= 0 && b.spitN > 0){ b.spitN--; b.spitT = enraged ? .22 : .32; spitFireball(); }
      if (b.stateT <= 0){ b.state = 'chase'; b.stateT = 4.5 + Math.random()*2; }
      break;
    case 'burrow':
      speed = 170; sx = 0; sy = 1; b.alpha = Math.max(0, b.stateT/1.1);
      if (Math.random() < dt*30) burst(b.x, Math.min(b.y + 12, maxY + TS), '#5a4a52', 2, 70, 300, .7);
      if (b.stateT <= 0){ b.state = 'hidden'; b.stateT = enraged ? 1 : 1.4; b.alpha = 0; b.emergeX = clamp(px + (Math.random()-.5)*50, minX + 20, maxX - 20); SFX.rumble(); }
      break;
    case 'hidden':
      b.alpha = 0; b.vx = b.vy = 0; b.x = b.emergeX; b.y = maxY + 50;
      b.segs.forEach((s, i) => { s.x = b.x; s.y = b.y + (i+1)*WYRM.gap; });
      if (Math.random() < dt*40) burst(b.emergeX + (Math.random()-.5)*26, maxY + TS - 2, '#8a7a70', 2, 60, 300, .6);   // telegraph
      shake(1.2);
      if (b.stateT <= 0){ b.state = 'erupt'; b.stateT = .9; b.vy = -340; b.alpha = 1; SFX.roar(); shake(9); burst(b.x, maxY + TS, '#6a5a5a', 30, 160, 350, 1.2); }
      break;
    case 'erupt':
      b.vy += 260*dt;
      if (b.stateT <= 0){ b.state = 'chase'; b.stateT = 4.5; }
      break;
  }
  if (speed){ const k = Math.min(1, dt*2.2); b.vx += (sx*speed - b.vx)*k; b.vy += (sy*speed - b.vy)*k; }
  b.x += b.vx*dt; b.y += b.vy*dt;
  if (b.state === 'chase' || b.state === 'spit'){
    if (b.x < minX + 12){ b.x = minX + 12; b.vx = Math.abs(b.vx); }
    if (b.x > maxX - 12){ b.x = maxX - 12; b.vx = -Math.abs(b.vx); }
    if (b.y < minY + 12){ b.y = minY + 12; b.vy = Math.abs(b.vy); }
    if (b.y > maxY - 10){ b.y = maxY - 10; b.vy = -Math.abs(b.vy); }
  }
  // the body follows the head like a chain
  let prev = b;
  for (const s of b.segs){
    const ddx = s.x - prev.x, ddy = s.y - prev.y, d = Math.hypot(ddx, ddy) || 1;
    if (d > WYRM.gap){ s.x = prev.x + ddx/d*WYRM.gap; s.y = prev.y + ddy/d*WYRM.gap; }
    prev = s;
  }
  if (Math.random() < dt*10){ const s = b.segs[Math.random()*b.segs.length|0]; particles.push({ x:s.x, y:s.y, vx:(Math.random()-.5)*10, vy:-15, g:-10, life:.6, col:'#ff8a2a', sz:1, glow:true }); }
  // contact damage
  if (b.alpha > .5 && !game.over && P.iframes <= 0){
    if (Math.hypot(px - b.x, py - b.y) < WYRM.headR + 7) hitPlayer(26, 'Devoured by the Deep Wyrm.', Math.sign(dx) || 1);
    else for (let i=0;i<b.segs.length;i++){ const s = b.segs[i]; if (Math.hypot(px - s.x, py - s.y) < segR(i+1) + 6){ hitPlayer(14, 'Crushed by the Deep Wyrm.', Math.sign(px - s.x) || 1); break; } }
  }
}
function spitFireball(){
  const b = boss, a = Math.atan2(pcy() - b.y, pcx() - b.x) + (Math.random()-.5)*.35, sp = 150;
  fireballs.push({ x:b.x + Math.cos(a)*14, y:b.y + Math.sin(a)*14, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, life:5 });
  b.mouth = .25; SFX.fireball();
}
function stepFireballs(dt){
  for (let i=fireballs.length-1;i>=0;i--){
    const f = fireballs[i];
    f.x += f.vx*dt; f.y += f.vy*dt; f.life -= dt;
    if (Math.random() < dt*40) particles.push({ x:f.x, y:f.y, vx:(Math.random()-.5)*20, vy:(Math.random()-.5)*20, g:0, life:.35, col: Math.random() < .5 ? '#ffd35a' : '#ff6a1a', sz:1, glow:true });
    let dead = f.life <= 0;
    if (isSolid(Math.floor(f.x/TS), Math.floor(f.y/TS))) dead = true;
    if (!dead && !game.over && Math.hypot(pcx() - f.x, pcy() - f.y) < 9){ hitPlayer(16, 'Burned by the Deep Wyrm.', Math.sign(f.vx) || 1); dead = true; }
    if (dead){ burst(f.x, f.y, '#ff8a2a', 10, 60, 100, .5, true); fireballs.splice(i,1); }
  }
}

// ---------- taking damage ----------
function bossTargets(){
  const b = boss;
  if (!b || b.alpha < .5 || b.dying || b.state === 'intro') return [];
  const out = [{ boss:true, head:true, x:b.x - WYRM.headR, y:b.y - WYRM.headR, def:{ w:WYRM.headR*2, h:WYRM.headR*2 } }];
  b.segs.forEach((s, i) => { const r = segR(i+1); out.push({ boss:true, x:s.x - r, y:s.y - r, def:{ w:r*2, h:r*2 } }); });
  return out;
}
function damageBoss(dmg, head){
  const b = boss; if (!b || b.dying) return;
  const amount = Math.round(dmg * (head ? 1.5 : 1));
  b.hp -= amount; b.flash = .12;
  floater(b.x, b.y - 18, head ? `${amount}!` : `${amount}`, head ? '#ffd24a' : '#ffffff');
  SFX.enemyHit(); tone(70, .15, 'sawtooth', .05, -20);
  if (b.hp <= 0){ b.hp = 0; b.dying = 3; b.popT = 0; SFX.roar(); shake(14); fireballs = []; }
}
function bossBlast(cx, cy, rad){
  if (!boss) return;
  let best = 1e9, head = false;
  for (const t of bossTargets()){ const d = Math.hypot(t.x + t.def.w/2 - cx, t.y + t.def.h/2 - cy); if (d < best){ best = d; head = !!t.head; } }
  if (best < (rad + 1.8)*TS) damageBoss(Math.round(110*(1 - best/((rad + 1.8)*TS))) + 20, head);
}

// ---------- death ----------
function stepBossDeath(dt){
  const b = boss;
  b.dying -= dt; b.popT -= dt; b.vy = 20; b.y += b.vy*dt;
  if (b.popT <= 0){
    b.popT = .16;
    const s = [...b.segs].reverse().find(s => s.alive);
    if (s){ s.alive = false; burst(s.x, s.y, '#ff8a2a', 16, 120, 200, .8, true); burst(s.x, s.y, '#4a2e3e', 10, 90, 300, 1); SFX.enemyDie(); shake(4); flashes.push({ x:s.x/TS, y:s.y/TS, t:.25 }); }
  }
  if (b.dying <= 0){
    SFX.boom(); shake(16); flashes.push({ x:b.x/TS, y:b.y/TS, t:.5 });
    burst(b.x, b.y, '#ffd35a', 60, 200, 100, 1, true);
    const cash = game.mode === 'career' ? Math.round(5000 * ({ relaxed:.8, normal:1, hardcore:1.6 }[game.diff] || 1)) : 5000;
    for (let k=0;k<25;k++) dropCoin(b.x, b.y, Math.round(cash/25));
    for (let k=0;k<6;k++) dropOre(b.x, b.y, [T.DIAMOND, T.PLATINUM, T.MYTHRIL, T.VOIDSTONE][Math.random()*4|0]);
    game.bossDefeated = true; game.stats.boss = 1;
    game.banner = { text:'WYRM SLAIN!', sub:`The mine is yours. +${fmtMoney(cash)} in treasure`, t:3.5 };
    SFX.win(); track('boss');
    boss = null;
  }
}

// ---------- drawing ----------
function octo(x, y, r, col){
  ctx.fillStyle = col;
  ctx.fillRect(x - r|0, y - r*.55|0, r*2|0, r*1.1|0);
  ctx.fillRect(x - r*.55|0, y - r|0, r*1.1|0, r*2|0);
  ctx.fillRect(x - r*.82|0, y - r*.82|0, r*1.64|0, r*1.64|0);
}
function drawBoss(now){
  const b = boss; if (!b || b.alpha <= 0) return;
  ctx.globalAlpha = b.alpha;
  const hit = b.flash > 0;
  for (let i=b.segs.length-1;i>=0;i--){
    const s = b.segs[i]; if (!s.alive) continue;
    const r = segR(i+1), x = s.x - cam.x, y = s.y - cam.y;
    if (x < -30 || x > VW+30 || y < -30 || y > VH+30) continue;
    octo(x, y, r+1.5, '#120a10');
    octo(x, y, r, hit ? '#ffffff' : '#4a2e3e');
    octo(x, y - 1, r*.72, hit ? '#ffffff' : '#6e4250');
    const glow = (Math.sin(now*4 + i*.6) + 1)/2;
    ctx.fillStyle = `rgba(255,${120 + glow*80|0},40,${.6 + glow*.4})`; ctx.fillRect(x - r*.25|0, y - 1|0, r*.5|0 || 1, 2);
    ctx.fillStyle = '#c9a36a'; ctx.fillRect(x - 1|0, y - r - 3|0, 2, 3);
  }
  // head
  const x = b.x - cam.x, y = b.y - cam.y, r = WYRM.headR;
  const a = Math.atan2(pcy() - b.y, pcx() - b.x), fx = Math.cos(a), fy = Math.sin(a);
  octo(x, y, r+2, '#120a10');
  octo(x, y, r, hit ? '#ffffff' : '#5a3448');
  octo(x - fx*2, y - fy*2 - 1, r*.7, hit ? '#ffffff' : '#74465a');
  // horns
  ctx.fillStyle = '#d8c090';
  ctx.fillRect(x - 10|0, y - r - 5|0, 3, 7); ctx.fillRect(x + 7|0, y - r - 5|0, 3, 7);
  ctx.fillRect(x - 12|0, y - r - 7|0, 2, 3); ctx.fillRect(x + 10|0, y - r - 7|0, 2, 3);
  // mouth
  const mx = x + fx*9, my = y + fy*9, open = b.mouth > 0 || b.state === 'spit' ? 5 : 2;
  ctx.fillStyle = '#1a0608'; ctx.fillRect(mx - 5|0, my - open/2|0, 10, open);
  if (open > 2){ ctx.fillStyle = '#ff8a2a'; ctx.fillRect(mx - 3|0, my - 1|0, 6, 2); }
  ctx.fillStyle = '#f1e9d2'; ctx.fillRect(mx - 4|0, my - open/2|0, 1, 2); ctx.fillRect(mx + 3|0, my - open/2|0, 1, 2);
  ctx.globalAlpha = 1;
}
function drawBossGlow(now){
  const b = boss;
  if (b && b.alpha > 0){
    const x = b.x - cam.x, y = b.y - cam.y, a = Math.atan2(pcy() - b.y, pcx() - b.x);
    const px = -Math.sin(a), py = Math.cos(a), ex = x + Math.cos(a)*3, ey = y + Math.sin(a)*3 - 3;
    ctx.globalAlpha = b.alpha;
    ctx.fillStyle = b.hp < b.maxHp*.5 ? '#ff3a2a' : '#ffd24a';
    ctx.fillRect(ex + px*5 - 1|0, ey + py*5 - 1|0, 3, 2); ctx.fillRect(ex - px*5 - 1|0, ey - py*5 - 1|0, 3, 2);
    ctx.globalAlpha = 1;
  }
  for (const f of fireballs){
    const x = f.x - cam.x|0, y = f.y - cam.y|0;
    ctx.fillStyle = '#ff5a1a'; ctx.fillRect(x-3, y-3, 7, 7);
    ctx.fillStyle = '#ffb030'; ctx.fillRect(x-2, y-2, 5, 5);
    ctx.fillStyle = '#fff3b0'; ctx.fillRect(x-1, y-1, 2, 2);
  }
}
function drawBossBar(){
  const b = boss; if (!b || b.state === 'intro' && b.t < 1) return;
  const w = Math.min(220, VW - 20), x = (VW - w)/2|0, y = VW >= 520 ? 8 : 70;
  panel(x - 4, y - 4, w + 8, 22);
  text('THE DEEP WYRM', VW/2, y + 5, '#ff8a5a', 6, 'center');
  bar(x, y + 9, w, 5, b.hp/b.maxHp, b.hp < b.maxHp*.5 ? '#ff3a2a' : '#c0392b', '#2a0a10');
}
function bossLights(src){
  if (boss && boss.alpha > 0) src.push({ x:boss.x/TS, y:boss.y/TS, r:6.5, c:[255,100,50], k:.9 });
  for (const f of fireballs) src.push({ x:f.x/TS, y:f.y/TS, r:3.5, c:[255,140,50], k:1.2 });
}
