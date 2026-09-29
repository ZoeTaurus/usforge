'use strict';
// ============================================================
//  THE DEEP WYRM - boss of the arena at the bottom of the mine
// ============================================================
let boss = null, fireballs = [];
const WYRM = { hp:3200, segs:18, gap:9, headR:16 };
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
  boss.introFx = 1.2;
  SFX.roar(); shake(14); setTimeout(() => { if (boss) SFX.roar(); }, 700);
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
// ---------- the Wyrm's art: a big pixel-art head, a separate hinged jaw ----------
let WYRM_ART = null;
const HEAD_W = 56, HEAD_H = 36, NECK_X = 14, NECK_Y = 20, JAW_X = 24, JAW_Y = 24;   // pivots inside the head sprite
function buildWyrmArt(){
  const ell = (x, cx, cy, rx, ry, col) => { for (let y=Math.floor(cy-ry); y<=cy+ry; y++) for (let X=Math.floor(cx-rx); X<=cx+rx; X++){ const nx = (X-cx)/rx, ny = (y-cy)/ry; if (nx*nx + ny*ny <= 1) px(x, col, X, y); } };
  const r = mulberry32(666);
  const OUT = [14,6,8], BASE = [46,24,32], PLATE = [74,40,50], HI = [112,64,70], CRACK = [255,110,40], BONE = [226,206,166], BONE_DK = [150,126,92];
  // --- head, facing right ---
  const [h, x] = mkCanvas(HEAD_W, HEAD_H);
  // horns sweep back and up
  for (const [x0, y0, x1, y1, w] of [[26, 10, 4, 0, 4], [22, 13, 2, 8, 3]]){
    const n = 22;
    for (let k=0;k<=n;k++){ const t = k/n, X = x0 + (x1-x0)*t, Y = y0 + (y1-y0)*t - Math.sin(t*Math.PI)*4, ww = Math.max(1, Math.round(w*(1-t)));
      px(x, OUT, X-1|0, Y-1|0, ww+2, ww+2); }
    for (let k=0;k<=n;k++){ const t = k/n, X = x0 + (x1-x0)*t, Y = y0 + (y1-y0)*t - Math.sin(t*Math.PI)*4, ww = Math.max(1, Math.round(w*(1-t)));
      px(x, t > .75 ? BONE_DK : BONE, X|0, Y|0, ww, ww); if (ww > 1) px(x, [250,236,200], X|0, Y|0, ww, 1); }
  }
  // skull and long snout
  ell(x, 26, 19, 16, 12, OUT); ell(x, 42, 20, 13, 7.5, OUT);
  ell(x, 26, 19, 15, 11, BASE); ell(x, 42, 20, 12, 6.5, BASE);
  // armour plates with highlights
  for (let i=0;i<5;i++){ ell(x, 16 + i*6, 11 + (i%2), 4, 3, PLATE); px(x, HI, 14 + i*6, 9 + (i%2), 3, 1); }
  ell(x, 44, 16, 7, 2.5, PLATE); px(x, HI, 40, 15, 8, 1);
  // spiked frill along the back of the skull
  for (let i=0;i<4;i++){ const bx = 12 + i*4, by = 10 - i; for (let k=0;k<6;k++){ px(x, OUT, bx - 1 - k, by + k - 1, 2, 1); px(x, BONE_DK, bx - k, by + k - 1, 1, 1); } }
  // heavy brow ridge over the eyes
  px(x, OUT, 29, 13, 16, 2); px(x, [30,14,20], 29, 14, 16, 1);
  // four eyes: two big, two small, all glaring
  const eye = (ex, ey, w) => { px(x, OUT, ex-1, ey-1, w+2, 4); px(x, [255,190,50], ex, ey, w, 2); px(x, [255,245,160], ex, ey, 1, 1); px(x, [120,10,10], ex + (w>>1), ey, 1, 2); };
  eye(38, 15, 5); eye(31, 16, 4); eye(26, 17, 2); eye(22, 18, 2);
  // glowing magma cracks across the skull
  for (let c=0;c<5;c++){ let X = 12 + (r()*26|0), Y = 16 + (r()*10|0); for (let k=0;k<7;k++){ px(x, CRACK, X, Y); X += r() < .6 ? 1 : 0; Y += r() < .5 ? 1 : -1; } }
  // nostrils
  px(x, [10,4,6], 50, 17, 2, 1); px(x, [10,4,6], 47, 18, 2, 1);
  // upper fangs hanging from the snout
  for (let X=30; X<52; X+=3){ const len = X > 45 ? 3 : 5; px(x, OUT, X-1, 25, 3, len+1); px(x, BONE, X, 25, 1, len); px(x, [255,255,240], X, 25, 1, 1); }
  // --- lower jaw, hinged at its left end ---
  const [j, jx] = mkCanvas(34, 12);
  for (let X=0; X<32; X++){ const top = 2 + Math.floor(X/10), bot = 9 - Math.floor(X/9); if (bot <= top) continue; px(jx, OUT, X, top-1, 1, bot-top+2); px(jx, [40,20,26], X, top, 1, bot-top); px(jx, [66,34,42], X, bot-1, 1, 1); }
  for (let X=8; X<30; X+=3){ px(jx, OUT, X-1, 0, 3, 4); px(jx, BONE, X, 0, 1, 3); }
  WYRM_ART = { head:h, jaw:j };
}
// body segments: darker armour, dorsal bone spikes, pulsing magma veins
function drawSegment(s, i, prev, now, hit){
  const r = segR(i+1), x = s.x - cam.x, y = s.y - cam.y;
  if (x < -40 || x > VW+40 || y < -40 || y > VH+40) return;
  const dx = prev.x - s.x, dy = prev.y - s.y, d = Math.hypot(dx, dy) || 1, ux = dx/d, uy = dy/d;
  let nx = -uy, ny = ux; if (ny > 0){ nx = -nx; ny = -ny; }                      // the "back" of the body faces upward
  // dorsal spike
  const sl = r*.9 + 3, bx = x + nx*r*.8, by = y + ny*r*.8;
  ctx.fillStyle = '#0e0608'; ctx.beginPath(); ctx.moveTo(bx - ux*4, by - uy*4); ctx.lineTo(bx + nx*sl, by + ny*sl); ctx.lineTo(bx + ux*4, by + uy*4); ctx.fill();
  ctx.fillStyle = hit ? '#fff' : '#d8c090'; ctx.beginPath(); ctx.moveTo(bx - ux*2.5, by - uy*2.5); ctx.lineTo(bx + nx*(sl-1.5), by + ny*(sl-1.5)); ctx.lineTo(bx + ux*2.5, by + uy*2.5); ctx.fill();
  octo(x, y, r + 1.5, '#0e0608');
  octo(x, y, r, hit ? '#ffffff' : '#2e1a22');
  octo(x - ux*1.5, y - uy*1.5 - 1, r*.72, hit ? '#ffffff' : '#4a2a34');
  // magma veins that pulse down the body like a heartbeat
  const beat = (Math.sin(now*5 - i*.45) + 1)/2;
  ctx.fillStyle = `rgba(255,${90 + beat*110|0},30,${.45 + beat*.55})`;
  ctx.fillRect(x - r*.5|0, y|0, r|0 || 1, 1); ctx.fillRect(x - 1|0, y - r*.4|0, 1, r*.8|0 || 1);
  // spiked tail tip
  if (i === boss.segs.length - 1){
    ctx.fillStyle = '#d8c090'; ctx.beginPath(); ctx.moveTo(x + ny*3, y - nx*3); ctx.lineTo(x - ux*16, y - uy*16); ctx.lineTo(x - ny*3, y + nx*3); ctx.fill();
  }
}
function drawBoss(now){
  const b = boss; if (!b || b.alpha <= 0) return;
  if (!WYRM_ART) buildWyrmArt();
  ctx.globalAlpha = b.alpha;
  const hit = b.flash > 0;
  // body, tail first
  for (let i=b.segs.length-1;i>=0;i--){ const s = b.segs[i]; if (!s.alive) continue; drawSegment(s, i, i === 0 ? b : b.segs[i-1], now, hit); }
  // head: faces where it's going (or the player when it's slow), never upside down
  const sp = Math.hypot(b.vx, b.vy);
  const ang = sp > 30 ? Math.atan2(b.vy, b.vx) : Math.atan2(pcy() - b.y, pcx() - b.x);
  b.ang = b.ang === undefined ? ang : b.ang + Math.atan2(Math.sin(ang - b.ang), Math.cos(ang - b.ang))*.2;
  const jawOpen = b.mouth > 0 || b.state === 'spit' || b.state === 'intro' || b.state === 'erupt' ? .55 + Math.sin(now*20)*.08 : .12 + Math.sin(now*3)*.05;
  ctx.save();
  ctx.translate(b.x - cam.x, b.y - cam.y); ctx.rotate(b.ang);
  if (Math.cos(b.ang) < 0) ctx.scale(1, -1);
  ctx.translate(-NECK_X - 6, -NECK_Y);
  // fiery maw behind the jaw
  if (jawOpen > .2){
    ctx.fillStyle = '#ff5a1a'; ctx.beginPath(); ctx.moveTo(JAW_X, JAW_Y); ctx.lineTo(JAW_X + 30, JAW_Y); ctx.lineTo(JAW_X + 28, JAW_Y + 11); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd35a'; ctx.beginPath(); ctx.moveTo(JAW_X + 4, JAW_Y + 1); ctx.lineTo(JAW_X + 22, JAW_Y + 1); ctx.lineTo(JAW_X + 18, JAW_Y + 5); ctx.closePath(); ctx.fill();
  }
  ctx.save(); ctx.translate(JAW_X, JAW_Y); ctx.rotate(jawOpen*.7); ctx.drawImage(WYRM_ART.jaw, -2, -1); ctx.restore();
  if (hit){ ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'brightness(3)'; }
  ctx.drawImage(WYRM_ART.head, 0, 0);
  ctx.filter = 'none';
  ctx.restore();
  ctx.globalAlpha = 1;
  // lava drool and nostril smoke
  if (b.alpha > .5){
    const c = Math.cos(b.ang), sn = Math.sin(b.ang), flip = c < 0 ? -1 : 1;
    const wx = (lx, ly) => [b.x + (lx*c - ly*flip*sn), b.y + (lx*sn + ly*flip*c)];
    if (Math.random() < .35){ const [mx, my] = wx(24, 10); particles.push({ x:mx, y:my, vx:(Math.random()-.5)*10, vy:20, g:300, life:.8, col: Math.random() < .5 ? '#ff7a1a' : '#ffd35a', sz: Math.random() < .3 ? 2 : 1, glow:true }); }
    if (Math.random() < .15){ const [nx2, ny2] = wx(30, -3); particles.push({ x:nx2, y:ny2, vx:(Math.random()-.5)*8, vy:-14, g:-6, life:1.3, col:'rgba(70,64,72,.5)', sz:2 }); }
  }
}
function drawBossGlow(now){
  const b = boss;
  if (b && b.alpha > 0 && b.ang !== undefined){
    // the four eyes glow through the dark
    const c = Math.cos(b.ang), sn = Math.sin(b.ang), flip = c < 0 ? -1 : 1;
    const toScreen = (hx, hy) => { const lx = hx - NECK_X - 6, ly = hy - NECK_Y; return [b.x - cam.x + (lx*c - ly*flip*sn), b.y - cam.y + (lx*sn + ly*flip*c)]; };
    const rage = b.hp < b.maxHp*.5, pulse = .75 + Math.sin(now*8)*.25;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = b.alpha*pulse;
    for (const [ex, ey, w] of [[40, 15, 5], [33, 16, 4], [27, 17, 2], [23, 18, 2]]){
      const [X, Y] = toScreen(ex, ey + 1);
      ctx.fillStyle = rage ? 'rgba(255,40,30,.9)' : 'rgba(255,200,60,.9)'; ctx.fillRect(X - 1|0, Y - 1|0, w|0, 2);
      const g = ctx.createRadialGradient(X, Y, 0, X, Y, 7); g.addColorStop(0, rage ? 'rgba(255,40,30,.35)' : 'rgba(255,180,60,.3)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(X - 7, Y - 7, 14, 14);
    }
    ctx.restore();
  }
  for (const f of fireballs){
    const x = f.x - cam.x|0, y = f.y - cam.y|0;
    ctx.fillStyle = '#ff5a1a'; ctx.fillRect(x-3, y-3, 7, 7);
    ctx.fillStyle = '#ffb030'; ctx.fillRect(x-2, y-2, 5, 5);
    ctx.fillStyle = '#fff3b0'; ctx.fillRect(x-1, y-1, 2, 2);
  }
  // dread: a pulsing red vignette while the Wyrm is awake
  if (b && !b.dying){
    const a = .18 + Math.sin(now*2.2)*.08 + (b.introFx > 0 ? b.introFx*.5 : 0);
    const v = ctx.createRadialGradient(VW/2, VH/2, Math.min(VW, VH)*.3, VW/2, VH/2, Math.max(VW, VH)*.7);
    v.addColorStop(0, 'rgba(120,0,0,0)'); v.addColorStop(1, `rgba(120,0,0,${a})`); ctx.fillStyle = v; ctx.fillRect(0, 0, VW, VH);
    if (b.introFx > 0){ ctx.fillStyle = `rgba(255,40,20,${b.introFx*.25})`; ctx.fillRect(0, 0, VW, VH); b.introFx -= 1/60; }
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
