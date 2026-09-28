'use strict';
// ============================================================
//  Player: movement & collision, mining, building, hazards
// ============================================================
let P = null;
function makePlayer(){
  return { x: 15*TS+3, y: (SURF-1)*TS+2, vx:0, vy:0, w:10, h:14, face:1, onGround:false, onLadder:false,
           hp:100, walk:0, swing:0, mining:null, mineT:0, hurtT:0, gasT:0, lavaT:0, stepT:0, idleT:0,
           iframes:0, kbx:0, attackT:0, fuel:0, airT:0, jetting:false };
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
function collideY(){
  const l = Math.floor(P.x/TS), r = Math.floor((P.x+P.w-.01)/TS);
  if (P.vy > 0){ const ty = Math.floor((P.y+P.h-.01)/TS); for (let tx=l;tx<=r;tx++) if (isSolid(tx,ty)){ P.y = ty*TS - P.h; landed(P.vy); P.vy = 0; P.onGround = true; return; } }
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
  const dir = (right?1:0) - (left?1:0);
  if (dir && !input.mining) P.face = dir;
  P.vx = dir * 74 + P.kbx;
  P.kbx -= P.kbx * Math.min(1, dt*7);
  if (P.onLadder){
    P.vy = up ? -66 : down ? 66 : 0;
    if (input.jumpOnly && !up) P.vy = -190;
    // centre on the ladder while climbing
    if ((up || down) && !dir) P.x += ((cx*TS + 3) - P.x) * Math.min(1, dt*10);
  } else {
    P.vy = Math.min(P.vy + 640*dt, 720);
    if (jump && P.onGround){ P.vy = -BOOTS[game.bootsLv||0].jump; P.onGround = false; SFX.jump(); }
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
  for (let s=0;s<steps;s++){ P.x += P.vx*dt/steps; collideX(); P.y += P.vy*dt/steps; collideY(); }
  if (!P.onGround && P.vy >= 0){
    const l = Math.floor(P.x/TS), r = Math.floor((P.x+P.w-.01)/TS), ty = Math.floor((P.y+P.h+.5)/TS);
    for (let tx=l;tx<=r;tx++) if (isSolid(tx,ty)) P.onGround = true;
  }
  P.walk = (P.vx && P.onGround) ? P.walk + dt*10 : 0;
  if (P.vx && P.onGround){ P.stepT -= dt; if (P.stepT <= 0){ SFX.step(); P.stepT = .28; } }
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
    if (!dc){ P.mining = null; return; }
    if (!same){ P.mining = { x:tx, y:ty }; P.mineT = 0; }
    P.swing += dt*14; P.mineT += dt;
    if (P.mineT > .3){ deco[I(tx,ty)] = 0; if (!game.opts.infinite) game[DECO_KEY[dc]]++; SFX.pickup(); P.mining = null; P.mineT = 0; }
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
  if (!game.opts.infinite && game[k] <= 0){ SFX.deny(); msg(`No ${k === 'dynamite' ? 'dynamite' : k+'s'} left! Buy more at the shop.`, '#e0533d'); return false; }
  if (!game.opts.infinite) game[k]--;
  if (k === 'dynamite'){ placeBomb(tx,ty); SFX.place(); msg('Fuse lit - RUN!', '#ff8a1e', 1.5); return true; }
  deco[I(tx,ty)] = game.sel + 1; track('place', k);
  SFX.place(); burst(tx*TS+8, ty*TS+14, '#a0703c', 5, 30);
  if (k === 'support'){
    const before = caveins.length;
    caveins = caveins.filter(c => !supported(c.x,c.y));
    if (caveins.length < before) msg('Tunnel secured.', '#6fd26a', 1.5);
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
  if (P.y < SURF*TS && P.hp < maxHp()) P.hp = Math.min(maxHp(), P.hp + 4*dt);
  P.hurtT -= dt; P.iframes -= dt;
}
