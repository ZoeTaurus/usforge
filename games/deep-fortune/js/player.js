'use strict';
// ============================================================
//  Player: movement & collision, mining, building, hazards
// ============================================================
let P = null;
function makePlayer(){
  return { x: 15*TS+3, y: (SURF-1)*TS+2, vx:0, vy:0, w:10, h:14, face:1, onGround:false, onLadder:false,
           hp:100, walk:0, swing:0, mining:null, mineT:0, hurtT:0, gasT:0, lavaT:0, stepT:0, idleT:0,
           iframes:0, kbx:0, attackT:0, fuel:0, airT:0, jetting:false, dropT:0, inWater:false, breath:8, drownT:0 };
}
const pcx = () => P.x + P.w/2, pcy = () => P.y + P.h/2;
const maxHp = () => ARMOR[game.armorLv].hp;
const bagCap = () => BAGS[game.bagLv].cap;
const bagCount = () => Object.values(game.bag).reduce((a,b) => a+b, 0);
function inReach(tx,ty){ return Math.hypot(tx*TS+8 - pcx(), ty*TS+8 - pcy()) <= TS*2.6; }

// ---------- collision ----------
function collideX(){
  const top = Math.floor(P.y/TS), bot = Math.floor((P.y+P.h-.01)/TS);
  if (P.vx > 0){ const tx = Math.floor((P.x+P.w-.01)/TS); for (let ty=top;ty<=bot;ty++) if (isSolid(tx,ty)){ P.x = tx*TS - P.w; P.vx = 0; return; } }
  else if (P.vx < 0){ const tx = Math.floor(P.x/TS); for (let ty=top;ty<=bot;ty++) if (isSolid(tx,ty)){ P.x = (tx+1)*TS; P.vx = 0; return; } }
}
const isPlatform = (x,y) => inb(x,y) && deco[I(x,y)] === D.PLATFORM;
// one-way platforms: only solid when you come down onto them from above (and aren't dropping through)
function platformUnder(prevBottom, bottom){
  if (P.dropT > 0) return -1;
  const l = Math.floor(P.x/TS), r = Math.floor((P.x+P.w-.01)/TS), ty = Math.floor((bottom-.01)/TS);
  if (prevBottom > ty*TS + .01) return -1;
  for (let tx=l;tx<=r;tx++) if (isPlatform(tx,ty)) return ty;
  return -1;
}
function collideY(prevBottom){
  const l = Math.floor(P.x/TS), r = Math.floor((P.x+P.w-.01)/TS);
  if (P.vy > 0){ const ty = Math.floor((P.y+P.h-.01)/TS); for (let tx=l;tx<=r;tx++) if (isSolid(tx,ty)){ P.y = ty*TS - P.h; landed(P.vy); P.vy = 0; P.onGround = true; return; }
    const pt = platformUnder(prevBottom, P.y+P.h); if (pt >= 0){ P.y = pt*TS - P.h; landed(P.vy); P.vy = 0; P.onGround = true; return; } }
  else if (P.vy < 0){ const ty = Math.floor(P.y/TS); for (let tx=l;tx<=r;tx++) if (isSolid(tx,ty)){ P.y = (ty+1)*TS; P.vy = 0; return; } }
}
function landed(v){
  if (v > 330){
    const dmg = Math.round((v-330)*.28 * BOOTS[game.bootsLv||0].fall);
    burst(pcx(), P.y+P.h, '#aaa', 10, 50); shake(Math.min(6, dmg/6));
    if (dmg > 0){ hurt(dmg, 'You fell to your death.'); if (!game.over && !game.opts.invincible) floater(pcx(), P.y-4, `-${dmg}`, '#ff5a4a'); }
  } else if (v > 150){ SFX.land(); burst(pcx(), P.y+P.h, '#9a8f86', 4, 25); }
}

// ---------- per-frame ----------
function stepPlayer(dt){
  const { left, right, up, down, jump } = input;
  const cx = Math.floor(pcx()/TS), cy = Math.floor(pcy()/TS);
  const fy = Math.floor((P.y+P.h+1)/TS);
  const ladderHere = inb(cx,cy) && deco[I(cx,cy)]===D.LADDER;
  const ladderBelow = inb(cx,fy) && deco[I(cx,fy)]===D.LADDER;
  P.onLadder = ladderHere || (ladderBelow && down);
  // hold S while standing on a platform to drop through it
  if (down && !P.onLadder && P.onGround && P.dropT <= 0){ const fl = Math.floor(P.x/TS), fr = Math.floor((P.x+P.w-.01)/TS), fty = Math.floor((P.y+P.h+1)/TS); for (let tx=fl;tx<=fr;tx++) if (isPlatform(tx,fty) && !isSolid(tx,fty)){ P.dropT = .22; P.onGround = false; P.y += 1; break; } }
  const dir = (right?1:0) - (left?1:0);
  if (dir && !input.mining) P.face = dir;
  // are we swimming?
  const wasWet = P.inWater;
  P.inWater = get(cx, cy) === T.WATER || get(cx, Math.floor((P.y+P.h-2)/TS)) === T.WATER;
  if (P.inWater !== wasWet && Math.abs(P.vy) > 40){ SFX.splash(); burst(pcx(), P.y + (P.inWater ? P.h : 0), '#9ad0ff', 12, 60, 300, .6); }
  P.vx = dir * (P.inWater ? 52 : 74) + P.kbx;
  P.kbx -= P.kbx * Math.min(1, dt*7);
  if (P.onLadder){
    P.vy = up ? -66 : down ? 66 : 0;
    if (input.jumpOnly && !up) P.vy = -190;
    // centre on the ladder while climbing
    if ((up || down) && !dir) P.x += ((cx*TS + 3) - P.x) * Math.min(1, dt*10);
  } else if (P.inWater){
    // gentle sinking; hold jump/up to swim up, down to dive
    P.vy += (jump ? -520 : down ? 260 : 170) * dt;
    // a waterfall pouring down on you pushes you under
    const hx = Math.floor(pcx()/TS), hy = Math.floor((P.y-2)/TS);
    if (get(hx, hy) === T.WATER && !isSolid(hx-1, hy) && get(hx-1, hy) !== T.WATER && !isSolid(hx+1, hy) && get(hx+1, hy) !== T.WATER) P.vy += 420*dt;
    P.vy = clamp(P.vy, -95, down ? 110 : 70);
    if (jump && get(cx, Math.floor((P.y-2)/TS)) !== T.WATER && P.vy < 0) P.vy = -210;   // hop out at the surface
    if (Math.random() < dt*3) particles.push({ x:pcx() + P.face*3, y:P.y + 2, vx:0, vy:-20, g:-30, life:.8, col:'#bfe6ff', sz:1 });
    // ripples when swimming at the surface
    if ((P.vx || P.vy) && get(cx, Math.floor((P.y-4)/TS)) !== T.WATER && Math.random() < dt*10){ const ry = Math.floor(P.y/TS)*TS + 2; for (const s of [-1, 1]) particles.push({ x:pcx() + s*4, y:ry, vx:s*25, vy:0, g:0, life:.4, col:'rgba(220,240,255,.8)', sz:1 }); }
  } else {
    P.vy = Math.min(P.vy + 640*dt, 720);
    // coyote time: you can still jump for a moment after running off a ledge
    P.coyoteT = P.onGround ? .1 : (P.coyoteT || 0) - dt;
    if (jump && P.coyoteT > 0 && P.vy >= -20){ P.vy = -BOOTS[game.bootsLv||0].jump; P.onGround = false; P.coyoteT = 0; P.jumpCut = true; SFX.jump(); burst(pcx(), P.y + P.h, '#9a8f86', 4, 30, 200, .3); }
    // let go early for a shorter hop
    if (!jump && P.jumpCut && P.vy < -60){ P.vy *= .5; P.jumpCut = false; }
    if (P.vy >= 0) P.jumpCut = false;
    // jetpack: hold jump while airborne
    const jet = JETPACKS[game.jetLv||0];
    P.jetting = false;
    if (jet.fuel && jump && !P.onGround && P.airT > .18 && P.fuel > 0){
      P.jetting = true; P.fuel -= dt;
      P.vy = Math.max(P.vy - 1500*dt, -150);
      if (Math.random() < dt*50) particles.push({ x:pcx() - P.face*4 + (Math.random()-.5)*2, y:P.y+P.h-2, vx:(Math.random()-.5)*20, vy:60+Math.random()*50, g:0, life:.25, col: Math.random()<.5 ? '#ffd35a' : '#ff7a1a', sz:1, glow:true });
      if (Math.random() < dt*14) SFX.jet();
    }
  }
  const jmax = JETPACKS[game.jetLv||0].fuel;
  if (P.onGround || P.onLadder){ P.airT = 0; P.fuel = Math.min(jmax, P.fuel + dt*1.6); } else P.airT += dt;
  const steps = Math.ceil(Math.max(Math.abs(P.vx*dt), Math.abs(P.vy*dt)) / 6) || 1;
  P.onGround = false;
  for (let s=0;s<steps;s++){ P.x += P.vx*dt/steps; collideX(); const pb = P.y + P.h; P.y += P.vy*dt/steps; collideY(pb); }
  if (!P.onGround && P.vy >= 0){
    const l = Math.floor(P.x/TS), r = Math.floor((P.x+P.w-.01)/TS), ty = Math.floor((P.y+P.h+.5)/TS);
    for (let tx=l;tx<=r;tx++) if (isSolid(tx,ty) || (P.dropT <= 0 && isPlatform(tx,ty) && Math.abs(P.y+P.h - ty*TS) < .6)) P.onGround = true;
  }
  P.dropT -= dt;
  P.walk = (P.vx && P.onGround) ? P.walk + dt*10 : 0;
  if (P.vx && P.onGround){ P.stepT -= dt; if (P.stepT <= 0){ SFX.step(); P.stepT = .28; burst(pcx() - Math.sign(P.vx)*4, P.y + P.h - 1, '#9a8f86', 2, 14, 60, .35); } }
  P.idleT = (P.vx || P.vy) ? 0 : P.idleT + dt;
  if (isSolid(Math.floor(pcx()/TS), Math.floor(pcy()/TS))) P.y -= 40*dt;   // squeezed by rubble
}

// ---------- mining ----------
function mineTarget(){
  if (input.mining && input.aim) return input.aim;
  if (input.digKey){                       // keyboard digging
    const cx = Math.floor(pcx()/TS), cy = Math.floor(pcy()/TS);
    if (input.down) return { x:cx, y:cy+1 };
    if (input.up) return { x:cx, y:cy-1 };
    return { x: cx + P.face, y: cy };
  }
  return null;
}
function stepMining(dt){
  if (stepAttack(dt)) return;
  const tgt = mineTarget();
  const active = input.mining || input.digKey;
  if (!active || !tgt){ P.mining = null; P.mineT = 0; return; }
  const { x:tx, y:ty } = tgt;
  if (input.mining && input.aim){ const wx = tx*TS+8; P.face = wx < pcx() ? -1 : 1; }
  if (!inReach(tx,ty)){ P.mining = null; P.mineT = 0; return; }
  const t = get(tx,ty), d = DEF[t];
  const same = P.mining && P.mining.x===tx && P.mining.y===ty;
  if (!d.solid){
    const dc = inb(tx,ty) ? deco[I(tx,ty)] : 0;
    if (!dc){
      if (inb(tx,ty) && decor[I(tx,ty)] && DECOR_NAMES[decor[I(tx,ty)]]){ if (!same){ P.mining = { x:tx, y:ty }; P.mineT = 0; } P.swing += dt*14; P.mineT += dt; if (P.mineT > .35){ harvestDecor(tx,ty); P.mining = null; P.mineT = 0; } return; }
      P.mining = null; return;
    }
    if (!same){ P.mining = { x:tx, y:ty }; P.mineT = 0; }
    P.swing += dt*14; P.mineT += dt;
    if (P.mineT > .3){ deco[I(tx,ty)] = 0; if (!game.opts.infinite) game[DECO_KEY[dc]]++; SFX.pickup(); P.mining = null; P.mineT = 0; checkStructures(tx,ty); }
    return;
  }
  const pick = PICKS[game.pick];
  if (d.hard > pick.hard){
    if (!same){ P.mining = { x:tx, y:ty, deny:true }; SFX.deny(); msg(t===T.BEDROCK ? 'Bedrock. Nothing gets through that.' : `Too hard! Upgrade your pick to break ${d.name}.`, '#e0533d', 2); }
    return;
  }
  if (!same || P.mining.deny){ P.mining = { x:tx, y:ty }; P.mineT = 0; }
  P.swing += dt*14;
  const before = P.mineT; P.mineT += dt;
  if (Math.floor(before*6) !== Math.floor(P.mineT*6)){ SFX.hit(); burst(tx*TS+8, ty*TS+8, rgb(d.col), 3, 45, 300, .35); }
  if (P.mineT >= d.time/pick.speed){ breakTile(tx,ty); P.mining = null; P.mineT = 0; }
}

// ---------- building ----------
function placeItem(tx,ty){
  const k = ITEMS[game.sel];
  if (!inb(tx,ty) || ty < 0) return false;
  if (isSolid(tx,ty) || get(tx,ty)===T.LAVA || deco[I(tx,ty)] || bombs.some(b => b.x===tx && b.y===ty)){ SFX.deny(); return false; }
  if (k === 'torch' && get(tx,ty) === T.WATER){ SFX.deny(); msg("Torches won't burn underwater.", '#9ad0ff', 1.5); return false; }
  if (!game.opts.infinite && game[k] <= 0){ SFX.deny(); msg(`No ${k === 'dynamite' ? 'dynamite' : k+'s'} left! Buy more at the shop.`, '#e0533d'); return false; }
  if (k === 'platform' && bridgeDist(tx,ty) > BRIDGE_REACH){ SFX.deny(); msg(`Too far! Bridges reach ${BRIDGE_REACH} tiles from a wall or a bridge post (6).`, '#e0533d', 2.5); return false; }
  if (k === 'support'){
    if (!supportStands(tx,ty)){ SFX.deny(); msg('Supports must stand on the ground or on another support.', '#e0533d', 2.5); return false; }
    let h = 0; for (let yy=ty+1; isSupport(tx,yy); yy++) h++;
    if (h >= 8){ SFX.deny(); msg('Supports can only be stacked 8 high.', '#e0533d', 2); return false; }
  }
  if (k === 'post'){
    if (!postStands(tx,ty)){ SFX.deny(); msg('Bridge posts must stand on the ground or on another post.', '#e0533d', 2.5); return false; }
    if (postHeight(tx,ty) >= 8){ SFX.deny(); msg('Posts can only be stacked 8 high.', '#e0533d', 2); return false; }
  }
  if (!game.opts.infinite) game[k]--;
  if (k === 'dynamite'){ placeBomb(tx,ty); SFX.place(); msg('Fuse lit - RUN!', '#ff8a1e', 1.5); return true; }
  deco[I(tx,ty)] = game.sel + 1; track('place', k);
  if (k === 'platform'){ let n = 1, xx = tx-1; while (isPlatform(xx,ty)){ n++; xx--; } xx = tx+1; while (isPlatform(xx,ty)){ n++; xx++; } if (n >= 12) track('bridge'); }
  SFX.place(); burst(tx*TS+8, ty*TS+14, '#a0703c', 5, 30);
  if (k === 'support'){
    const col = supportColumn(tx,ty), before = caveins.length;
    caveins = caveins.filter(c => !supported(c.x,c.y));
    if (!col.braced) msg(`Stack ${col.gap} more support${col.gap > 1 ? 's' : ''} to reach the roof!`, '#ffb040', 2.2);
    else if (caveins.length < before) msg('Tunnel secured.', '#6fd26a', 1.5);
    else if (col.bot - col.top >= 1) msg(`Support column braced (${col.bot - col.top + 1} tall).`, '#6fd26a', 1.5);
    if (col.braced && col.bot - col.top >= 3) track('tallSupport');
  }
  return true;
}
function placeAtFeet(){ placeItem(Math.floor(pcx()/TS), Math.floor(pcy()/TS)); }
function useMedkit(){
  if (!game.opts.infinite && game.medkit <= 0){ msg('No medkits!', '#e0533d'); SFX.deny(); return; }
  if (P.hp >= maxHp()){ msg('Already at full health.'); return; }
  if (!game.opts.infinite) game.medkit--;
  P.hp = Math.min(maxHp(), P.hp + 60); floater(pcx(), P.y-4, '+60 HP', '#6fd26a'); SFX.heal();
}

// ---------- damage ----------
function hurt(amount, cause){
  if (game.over) return;
  if (game.opts.invincible){ if (P.hurtT <= 0){ P.hurtT = .2; } return; }
  P.hp -= amount * diff().dmg;
  if (game.recall && amount >= 1){ game.recall = null; if (!game.opts.infinite) game.beacon++; msg('Recall interrupted!', '#e0533d'); }
  if (P.hurtT <= 0){ SFX.hurt(); P.hurtT = .35; shake(3); }
  if (P.hp <= 0) die(cause);
}
function stepHazards(dt){
  let lava = false, gas = false;
  const l = Math.floor(P.x/TS), r = Math.floor((P.x+P.w-.01)/TS), t = Math.floor(P.y/TS), b = Math.floor((P.y+P.h-.01)/TS);
  for (let y=t;y<=b;y++) for (let x=l;x<=r;x++){ const tt = get(x,y); if (tt===T.LAVA) lava = true; if (tt===T.GAS) gas = true; }
  if (lava){ hurt(55*dt, 'Melted in lava.'); P.lavaT -= dt; if (P.lavaT <= 0){ SFX.sizzle(); P.lavaT = .2; burst(pcx(), P.y+P.h, '#ffb030', 6, 50, 200, .6, true); } }
  if (gas){ hurt(14*dt, 'Choked on poison gas.'); P.gasT -= dt; if (P.gasT <= 0){ SFX.cough(); P.gasT = .6; msg('Poison gas! Get out!', '#8fe36b', .8); } }
  // breath: your head underwater uses it up
  const headWet = get(Math.floor(pcx()/TS), Math.floor((P.y+2)/TS)) === T.WATER;
  if (headWet){
    P.breath = Math.max(0, P.breath - dt);
    if (P.breath <= 0){ P.drownT -= dt; hurt(12*dt, 'Drowned in an underground pool.'); if (P.drownT <= 0){ P.drownT = .7; SFX.cough(); msg('Out of air! Swim up!', '#9ad0ff', .8); } }
  } else P.breath = Math.min(8, P.breath + dt*3);
  if (P.y < SURF*TS && P.hp < maxHp()) P.hp = Math.min(maxHp(), P.hp + 4*dt);
  P.hurtT -= dt; P.iframes -= dt;
}
