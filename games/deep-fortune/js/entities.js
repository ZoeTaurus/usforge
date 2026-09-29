'use strict';
// ============================================================
//  Entities: underground monsters, loot pickups, dynamite,
//  recall beacon
// ============================================================
let enemies = [], pickups = [], bombs = [], flashes = [];
let spawnT = 8;

//                name            hp  dmg  speed  fly    minDepth  size    loot  spawn weight by depth
const ENEMY = {
  bat:     { name:'Bat',          hp:12, dmg:8,  speed:62, fly:true,  minD:12,  w:10, h:7,  loot:4,  weight:d => d < 120 ? 5 : 2 },
  slime:   { name:'Slime',        hp:24, dmg:10, speed:46, fly:false, minD:30,  w:12, h:10, loot:8,  weight:d => 4 },
  crawler: { name:'Cave Crawler', hp:48, dmg:16, speed:52, fly:false, minD:95,  w:14, h:7,  loot:22, weight:d => 3 },
  wisp:    { name:'Fire Wisp',    hp:34, dmg:14, speed:48, fly:true,  minD:150, w:10, h:10, loot:40, weight:d => d > 200 ? 4 : 2, fireproof:true },
  golem:   { name:'Rock Golem',   hp:160,dmg:24, speed:30, fly:false, minD:185, w:14, h:18, loot:95, weight:d => 1.3, heavy:true, tall:true },
  spider:  { name:'Cave Spider',  hp:26, dmg:11, speed:72, fly:false, minD:55,  w:12, h:8,  loot:14, weight:d => 3, ceiling:true },
  ghost:   { name:'Lost Miner',   hp:40, dmg:14, speed:30, fly:true,  minD:110, w:12, h:14, loot:32, weight:d => 1.6, ghost:true },
  beetle:  { name:'Blast Beetle', hp:30, dmg:0,  speed:44, fly:false, minD:140, w:12, h:7,  loot:28, weight:d => 2 },
};

// ---------- shared tile collision for small entities ----------
function entMove(e, dt, w, h){
  const steps = Math.ceil(Math.max(Math.abs(e.vx*dt), Math.abs(e.vy*dt)) / 6) || 1;
  e.onGround = false; e.hitWall = false;
  for (let s=0;s<steps;s++){
    e.x += e.vx*dt/steps;
    const top = Math.floor(e.y/TS), bot = Math.floor((e.y+h-.01)/TS);
    if (e.vx > 0){ const tx = Math.floor((e.x+w-.01)/TS); for (let ty=top;ty<=bot;ty++) if (isSolid(tx,ty)){ e.x = tx*TS - w; e.vx = 0; e.hitWall = true; break; } }
    else if (e.vx < 0){ const tx = Math.floor(e.x/TS); for (let ty=top;ty<=bot;ty++) if (isSolid(tx,ty)){ e.x = (tx+1)*TS; e.vx = 0; e.hitWall = true; break; } }
    const pb = e.y + h;
    e.y += e.vy*dt/steps;
    const l = Math.floor(e.x/TS), r = Math.floor((e.x+w-.01)/TS);
    if (e.vy > 0){ const ty = Math.floor((e.y+h-.01)/TS); for (let tx=l;tx<=r;tx++) if (isSolid(tx,ty) || (!e.def?.fly && pb <= ty*TS + .01 && isPlatform(tx,ty))){ e.y = ty*TS - h; e.vy = 0; e.onGround = true; break; } }
    else if (e.vy < 0){ const ty = Math.floor(e.y/TS); for (let tx=l;tx<=r;tx++) if (isSolid(tx,ty)){ e.y = (ty+1)*TS; e.vy = 0; break; } }
  }
}
const overlapsPlayer = (x, y, w, h) => x < P.x+P.w && x+w > P.x && y < P.y+P.h && y+h > P.y;

// ---------- spawning ----------
function torchNear(x, y, r){
  for (let dy=-r;dy<=r;dy++) for (let dx=-r;dx<=r;dx++)
    if (dx*dx+dy*dy <= r*r && inb(x+dx,y+dy) && deco[I(x+dx,y+dy)] === D.TORCH) return true;
  return false;
}
function trySpawn(){
  if (game.opts.enemies === false) return;
  const px = Math.floor(pcx()/TS), py = Math.floor(pcy()/TS), dep = depthOf(py);
  if (dep < 14) return;
  if (enemies.length >= Math.max(1, Math.round(Math.min(4, 1 + Math.floor(dep/70)) * diff().mobs))) return;
  if (Math.random() < .45) return;                            // most spawn checks come up empty
  for (let tries=0; tries<14; tries++){
    const a = Math.random()*Math.PI*2, r = 14 + Math.random()*10;       // well out of sight
    const x = Math.round(px + Math.cos(a)*r), y = Math.round(py + Math.sin(a)*r*.7);
    if (!inb(x,y) || y < SURF+10 || tiles[I(x,y)] !== T.AIR || inArena(x,y)) continue;
    const d = depthOf(y), pool = Object.keys(ENEMY).filter(k => d >= ENEMY[k].minD);
    if (!pool.length) continue;
    let roll = Math.random() * pool.reduce((s,k) => s + ENEMY[k].weight(d), 0), type = pool[0];
    for (const k of pool){ roll -= ENEMY[k].weight(d); if (roll <= 0){ type = k; break; } }
    const def = ENEMY[type];
    if (def.ceiling){ if (!isSolid(x,y-1)) continue; }
    else if (!def.fly && !isSolid(x,y+1)) continue;
    if (def.tall && get(x,y-1) !== T.AIR) continue;
    if (torchNear(x, y, 7)) continue;                       // light keeps monsters away
    if (seen[I(x,y)] && Math.random() < .7) continue;       // they prefer places you haven't lit up
    const hp = Math.round(def.hp * (1 + d/250));
    enemies.push({ type, def, x: x*TS + (TS-def.w)/2, y: def.fly ? y*TS+4 : (y+1)*TS - def.h, vx:0, vy:0,
                   hp, maxHp:hp, face: Math.random()<.5 ? 1 : -1, t: Math.random()*5, ai:0, tvx:0, tvy:0,
                   flash:0, cool:0, squash:0, depth:d, variant: d > 170 ? 2 : d > 90 ? 1 : 0,
                   state: def.ceiling ? 'hang' : null, anchorY: y*TS });
    if (def.ceiling) enemies[enemies.length-1].y = y*TS + 2;
    return;
  }
}

// ---------- AI ----------
function stepEnemies(dt){
  spawnT -= dt; if (spawnT <= 0){ spawnT = 4 + Math.random()*3; trySpawn(); }
  const px = pcx(), py = pcy();
  for (let i=enemies.length-1;i>=0;i--){
    const e = enemies[i], d = e.def;
    e.t += dt; e.flash -= dt; e.cool -= dt; e.squash = Math.max(0, e.squash - dt);
    const ex = e.x + d.w/2, ey = e.y + d.h/2, dx = px - ex, dy = py - ey, dist = Math.hypot(dx, dy) || 1;
    if (dist > 42*TS){ enemies.splice(i,1); continue; }
    const aggro = !game.over && dist < (d.fly ? 6.5 : 7.5)*TS;
    if (e.type === 'bat' || e.type === 'wisp'){
      const k = Math.min(1, dt*(e.type === 'bat' ? 3 : 1.6));
      if (e.cool > 0){ /* retreating after a bite */ }
      else if (aggro){
        const sp = d.speed * (e.type === 'bat' ? 1.35 : 1);
        e.vx += (dx/dist*sp - e.vx)*k;
        e.vy += (dy/dist*sp + Math.sin(e.t*(e.type === 'bat' ? 9 : 3))*35 - e.vy)*k;
        if (e.type === 'bat' && Math.random() < dt*.8 && dist < 8*TS) SFX.squeak();
      } else {
        if (e.t > e.ai){ e.ai = e.t + .6 + Math.random(); e.tvx = (Math.random()-.5)*2*d.speed; e.tvy = (Math.random()-.5)*d.speed; }
        e.vx += (e.tvx - e.vx)*k; e.vy += (e.tvy - e.vy)*k;
      }
      entMove(e, dt, d.w, d.h);
      if (e.hitWall){ e.tvx = -e.tvx; }
      if (Math.abs(e.vx) > 2) e.face = Math.sign(e.vx);
      if (e.type === 'wisp' && Math.random() < dt*12) particles.push({ x:ex + (Math.random()-.5)*6, y:ey + 3, vx:0, vy:-20, g:-20, life:.5, col: Math.random()<.5 ? '#ff9a2a' : '#ffd35a', sz:1, glow:true });
    } else if (e.type === 'slime'){
      e.vy = Math.min(e.vy + 640*dt, 600);
      const wasAir = !e.onGround;
      if (e.onGround){
        e.vx *= Math.max(0, 1 - dt*10);
        if (e.t > e.ai){
          e.ai = e.t + .8 + Math.random()*.9;
          const dir = aggro ? (Math.sign(dx) || 1) : (Math.random() < .5 ? -1 : 1);
          e.face = dir; e.vx = dir * d.speed * (aggro ? 1.35 : 1); e.vy = aggro && dy < -8 ? -250 : -170; e.squash = .12;
        }
      }
      entMove(e, dt, d.w, d.h);
      if (wasAir && e.onGround){ e.squash = .15; if (dist < 12*TS) SFX.splat(); }
    } else if (e.type === 'spider'){
      if (e.state === 'hang'){
        e.vx = e.vy = 0; e.y = e.anchorY + 2 + Math.sin(e.t*2)*1.5;
        if (!game.over && Math.abs(dx) < 2.5*TS && dy > 0 && dy < 9*TS){ e.state = 'fall'; SFX.squeak(); }
      } else {
        e.vy = Math.min(e.vy + 640*dt, 600);
        const grounded = e.onGround;
        if (grounded){
          if (aggro) e.face = Math.sign(dx) || e.face;
          e.vx = e.face * d.speed * (aggro ? 1 : .35);
          if (aggro && e.t > e.ai && Math.abs(dx) < 3*TS){ e.ai = e.t + 1.1; e.vy = -210; e.vx = Math.sign(dx)*d.speed*1.5; }
        }
        entMove(e, dt, d.w, d.h);
        if (e.hitWall && grounded) e.vy = -200;
      }
    } else if (e.type === 'ghost'){
      const sp = d.speed * (aggro ? 1 : .5), k = Math.min(1, dt*1.2);
      const tvx = aggro ? dx/dist*sp : Math.cos(e.t*.7)*sp, tvy = aggro ? dy/dist*sp : Math.sin(e.t*.9)*sp*.5;
      e.vx += (tvx - e.vx)*k; e.vy += (tvy + Math.sin(e.t*3)*12 - e.vy)*k;
      e.x += e.vx*dt; e.y += e.vy*dt;                              // drifts straight through rock
      if (Math.abs(e.vx) > 2) e.face = Math.sign(e.vx);
      if (Math.random() < dt*6) particles.push({ x:ex + (Math.random()-.5)*8, y:e.y + d.h, vx:0, vy:8, g:0, life:.6, col:'#b8d8ff', sz:1, glow:true });
      if (aggro && Math.random() < dt*.3) SFX.moan();
    } else if (e.type === 'beetle'){
      e.vy = Math.min(e.vy + 640*dt, 600);
      const chase = aggro && Math.abs(dy) < 3*TS;
      if (e.fuse !== undefined){
        e.fuse -= dt; e.vx = 0;
        if (Math.random() < dt*30) particles.push({ x:ex, y:e.y - 2, vx:(Math.random()-.5)*40, vy:-40, g:200, life:.3, col:'#ffe066', sz:1, glow:true });
        if ((e.fuse*8|0) !== ((e.fuse+dt)*8|0)) SFX.fuse();
        if (e.fuse <= 0){ e.hp = 0; e.blew = true; }
      } else {
        if (chase) e.face = Math.sign(dx) || e.face;
        else if (e.t > e.ai){ e.ai = e.t + 2 + Math.random()*3; if (Math.random() < .4) e.face *= -1; }
        e.vx = e.face * d.speed * (chase ? 1.35 : .5);
        if (!chase && e.onGround){ const fx = Math.floor((ex + e.face*(d.w/2 + 2))/TS), fy = Math.floor((e.y + d.h + 2)/TS); if (!isSolid(fx,fy)){ e.face *= -1; e.vx = -e.vx; } }
        if (dist < 1.8*TS && !game.over){ e.fuse = .9; msg('Blast beetle! Get back!', '#ff8a1e', 1.2); }
      }
      const grounded = e.onGround;
      entMove(e, dt, d.w, d.h);
      if (e.hitWall && grounded){ if (chase) e.vy = -200; else e.face *= -1; }
    } else if (e.type === 'crawler' || e.type === 'golem'){
      e.vy = Math.min(e.vy + 640*dt, 600);
      const chase = aggro && Math.abs(dy) < 3*TS;
      if (chase) e.face = Math.sign(dx) || e.face;
      else if (e.t > e.ai){ e.ai = e.t + 2 + Math.random()*3; if (Math.random() < .4) e.face *= -1; }
      e.vx = e.face * d.speed * (chase ? 1.25 : .55);
      if (!chase && e.onGround){
        const fx = Math.floor((ex + e.face*(d.w/2 + 2))/TS), fy = Math.floor((e.y + d.h + 2)/TS);
        if (!isSolid(fx,fy)){ e.face *= -1; e.vx = -e.vx; }
      }
      const grounded = e.onGround;
      entMove(e, dt, d.w, d.h);
      if (e.hitWall && grounded){ if (chase) e.vy = -210; else e.face *= -1; }
      if (e.type === 'golem' && grounded && Math.abs(e.vx) > 5 && (e.t*2.5|0) !== ((e.t-dt)*2.5|0) && dist < 12*TS){ SFX.stomp(); shake(1.5); }
    }
    // hazards
    const cx = Math.floor((e.x + d.w/2)/TS), cy = Math.floor((e.y + d.h/2)/TS);
    if (!d.fireproof && !d.ghost && get(cx,cy) === T.LAVA) damageEnemy(e, 40*dt, 0, true);
    if (e.type === 'wisp' && get(cx,cy) === T.WATER){ damageEnemy(e, 60*dt, 0, true); if (Math.random() < dt*20) burst(cx*TS+8, cy*TS+8, '#dfe8f0', 2, 30, -40, .6); }
    if (!d.ghost && e.state !== 'hang' && isSolid(cx,cy)) e.y -= 30*dt;   // buried by rubble
    // contact damage
    if (!game.over && e.hp > 0 && d.dmg > 0 && overlapsPlayer(e.x, e.y, d.w, d.h) && P.iframes <= 0){
      hitPlayer(d.dmg, `Killed by a ${d.name.toLowerCase()}.`, Math.sign(dx) || 1);
      if (d.fly){ e.cool = .9; e.vx = -Math.sign(dx)*d.speed; e.vy = -50; }
      else e.vx = -Math.sign(dx)*60;
    }
    if (e.hp <= 0){ enemies.splice(i,1); if (e.blew) explode(Math.floor(ex/TS), Math.floor(ey/TS), { rad:1.7, pdmg:34, cause:'Blown up by a blast beetle.' }); else killEnemy(e); }
  }
}
function hitPlayer(dmg, cause, dir){
  P.iframes = .8; P.kbx = dir*170; P.vy = Math.min(P.vy, -120);
  if (!game.opts.invincible) floater(pcx(), P.y-4, `-${dmg}`, '#ff5a4a');
  hurt(dmg, cause);
}
function damageEnemy(e, dmg, kx, silent){
  e.hp -= dmg;
  if (silent) return;
  e.flash = .14; e.vx += kx * (e.def.heavy ? .2 : 1); if (!e.def.fly && !e.def.heavy && e.state !== 'hang') e.vy = Math.min(e.vy, -90);
  if (e.state === 'hang') e.state = 'fall';
  floater(e.x + e.def.w/2, e.y - 2, `${Math.round(dmg)}`, '#ffffff');
  burst(e.x + e.def.w/2, e.y + e.def.h/2, enemyColor(e), 5, 50);
  SFX.enemyHit();
}
function enemyColor(e){
  return e.type === 'spider' ? '#4a3a5a' : e.type === 'ghost' ? '#b8d8ff' : e.type === 'beetle' ? '#c0392b' : e.type === 'golem' ? '#8a8480' : e.type === 'bat' ? '#6a4a88' : e.type === 'crawler' ? '#5a6088' : e.type === 'wisp' ? '#ffb030' : ['#56c846','#4a8ae6','#dc4646'][e.variant];
}
function killEnemy(e){
  const d = e.def, cx = e.x + d.w/2, cy = e.y + d.h/2;
  game.stats.kills++; track('kill', e.type);
  SFX.enemyDie(); burst(cx, cy, enemyColor(e), 18, 80, 250, .8, e.type === 'wisp');
  const total = Math.round(d.loot * (1 + e.depth/60));
  const n = clamp(Math.ceil(total/8), 1, 5);
  for (let k=0;k<n;k++) dropCoin(cx, cy, Math.max(1, Math.round(total/n)));
  if (Math.random() < .22){
    const pool = ORES.filter(o => o[2] <= 20 + e.depth*1.6);
    if (pool.length) dropOre(cx, cy, pool[Math.random()*pool.length|0][0]);
  }
}

// ---------- player attacks ----------
function enemyAt(wx, wy, pad = 5){
  const hit = e => wx >= e.x-pad && wx <= e.x+e.def.w+pad && wy >= e.y-pad && wy <= e.y+e.def.h+pad;
  return enemies.find(hit) || bossTargets().find(hit);
}
function attackTarget(){
  let foe = null;
  if (input.mining && input.aimPx) foe = enemyAt(input.aimPx.x, input.aimPx.y);
  else if (input.digKey){
    let best = 1e9;
    for (const e of [...enemies, ...bossTargets()]){
      const dx = e.x + e.def.w/2 - pcx(), dy = e.y + e.def.h/2 - pcy();
      if (Math.abs(dy) < 22 && dx*P.face > -6 && Math.abs(dx) < 34 && Math.abs(dx) < best){ best = Math.abs(dx); foe = e; }
    }
  }
  if (!foe) return null;
  const reach = Math.hypot(foe.x + foe.def.w/2 - pcx(), foe.y + foe.def.h/2 - pcy());
  return reach <= TS*2.8 + (foe.boss ? foe.def.w/2 : 0) ? foe : null;
}
function stepAttack(dt){
  P.attackT -= dt;
  const foe = attackTarget();
  if (!foe) return false;
  P.face = foe.x + foe.def.w/2 < pcx() ? -1 : 1;
  P.swing += dt*18;
  P.mining = null; P.mineT = 0;
  if (P.attackT <= 0){
    P.attackT = .42 / Math.sqrt(PICKS[game.pick].speed);
    const dmg = 7 + game.pick*5 + (Math.random()*3|0);
    SFX.swing();
    if (foe.boss) damageBoss(dmg, foe.head); else damageEnemy(foe, dmg, P.face*170);
  }
  return true;
}

// ---------- pickups ----------
function dropCoin(x, y, value){ pickups.push({ kind:'coin', x:x-3, y:y-3, vx:(Math.random()-.5)*110, vy:-110-Math.random()*90, value, t:0, onGround:false }); }
function dropOre(x, y, id){ pickups.push({ kind:'ore', id, x:x-4, y:y-4, vx:(Math.random()-.5)*80, vy:-140, t:0, onGround:false }); }
function stepPickups(dt){
  for (let i=pickups.length-1;i>=0;i--){
    const p = pickups[i]; p.t += dt;
    const dx = pcx() - (p.x+3), dy = pcy() - (p.y+3), d = Math.hypot(dx, dy);
    if (p.t > .35 && d < 2.4*TS && !game.over){
      p.x += dx*Math.min(1, dt*7); p.y += dy*Math.min(1, dt*7);
    } else {
      const wet = get(Math.floor((p.x+3)/TS), Math.floor((p.y+3)/TS)) === T.WATER;
      p.vy = wet ? Math.min(p.vy + 120*dt, 28) : Math.min(p.vy + 520*dt, 500);   // coins and gems drift down through water
      if (wet) p.vx *= Math.max(0, 1 - dt*3);
      entMove(p, dt, 6, 6);
      if (p.onGround) p.vx *= Math.max(0, 1 - dt*8);
    }
    if (d < 9 && p.t > .2){
      if (p.kind === 'coin'){
        game.money += p.value; game.earned += p.value; SFX.coin(); track('earn', p.value);
        floater(pcx(), P.y - 6, `+$${p.value}`, '#ffd24a');
        pickups.splice(i,1); checkWin(); continue;
      }
      if (game.opts.infinite || bagCount() < bagCap()){
        const od = DEF[p.id]; game.bag[p.id] = (game.bag[p.id]||0) + 1; game.stats.ores++; track('ore', p.id);
        SFX.gem(); floater(pcx(), P.y - 6, `+${od.name}`, rgb(od.c2));
        pickups.splice(i,1); continue;
      } else if (p.t > 1 && !p.warned){ p.warned = true; msg('Backpack full!', '#e0533d', 1.5); }
    }
    if (p.t > 90 || get(Math.floor((p.x+3)/TS), Math.floor((p.y+3)/TS)) === T.LAVA) pickups.splice(i,1);
  }
}

// ---------- dynamite ----------
function placeBomb(tx, ty){ bombs.push({ x:tx, y:ty, t:2.6, beep:0 }); }
function stepBombs(dt){
  for (let i=bombs.length-1;i>=0;i--){
    const b = bombs[i];
    b.t -= dt; b.beep -= dt;
    if (b.beep <= 0){ SFX.fuse(); b.beep = b.t > 1 ? .45 : .15; }
    if (Math.random() < dt*30) particles.push({ x:b.x*TS+8, y:b.y*TS+3, vx:(Math.random()-.5)*50, vy:-30-Math.random()*40, g:200, life:.35, col: Math.random()<.5 ? '#ffe066' : '#ff8a1e', sz:1, glow:true });
    if (b.t <= 0){ bombs.splice(i,1); explode(b.x, b.y); }
  }
}
function explode(bx, by, o = {}){
  const RAD = o.rad || 2.3, cx = bx*TS+8, cy = by*TS+8, mine = !o.cause;
  SFX.boom(); shake(mine ? 11 : 8); if (mine) track('boom');
  flashes.push({ x:bx+.5, y:by+.5, t:.35 });
  burst(cx, cy, '#ffd35a', 40, 160, 100, .7, true);
  burst(cx, cy, '#6a625c', 30, 120, 300, 1.1);
  const cleared = [];
  const Rn = Math.ceil(RAD);
  for (let dy=-Rn;dy<=Rn;dy++) for (let dx=-Rn;dx<=Rn;dx++){
    if (dx*dx + dy*dy > RAD*RAD) continue;
    const x = bx+dx, y = by+dy;
    if (!inb(x,y) || y <= SURF) continue;
    const t = tiles[I(x,y)], d = DEF[t];
    if (t === T.BEDROCK) continue;
    if (d.solid){
      if (d.chest){ tiles[I(x,y)] = T.AIR; openChest(x,y); }
      else {
        if (d.ore && (game.opts.infinite || bagCount() < bagCap())){ game.bag[t] = (game.bag[t]||0) + 1; game.stats.ores++; track('ore', t); floater(x*TS+8, y*TS, `+${d.name}`, rgb(d.c2)); }
        tiles[I(x,y)] = T.AIR; burst(x*TS+8, y*TS+8, rgb(d.col), 4, 60);
      }
      cleared.push([x,y]);
    }
    deco[I(x,y)] = 0;
  }
  for (const [x,y] of cleared) maybeScheduleCavein(x,y);
  checkStructures(bx, by);
  // damage
  const pd = Math.hypot(pcx() - cx, pcy() - cy) / TS;
  const pr = RAD + 1;
  if (pd < pr && !game.over){ const dmg = Math.round((o.pdmg || 60)*(1 - pd/pr)) + 5; hitPlayer(dmg, o.cause || 'Blown up by your own dynamite.', Math.sign(pcx()-cx) || 1); if (mine) track('selfblast'); }
  for (const e of enemies){ const ed = Math.hypot(e.x + e.def.w/2 - cx, e.y + e.def.h/2 - cy) / TS; if (ed < RAD + 1.3) damageEnemy(e, Math.round(90*(1 - ed/(RAD + 1.3))) + 10, Math.sign(e.x - cx)*200); }
  bossBlast(cx, cy, RAD);
  for (const b of bombs) if (Math.hypot(b.x - bx, b.y - by) < 3.2) b.t = Math.min(b.t, .15);   // chain reaction
}

// ---------- recall beacon ----------
function startRecall(){
  if (game.recall) return;
  if (P.y < SURF*TS){ msg('You are already on the surface.'); return; }
  if (!game.opts.infinite && game.beacon <= 0){ SFX.deny(); msg('No recall beacons! Buy one at the shop.', '#e0533d'); return; }
  if (!game.opts.infinite) game.beacon--;
  game.recall = { t:0, dur:2.2 };
  msg('Recall beacon charging... stay alive!', '#5aa2ff', 2.2);
}
function stepRecall(dt){
  const r = game.recall; if (!r) return;
  r.t += dt;
  if (Math.random() < dt*40){ const a = Math.random()*Math.PI*2, d = 14 + Math.random()*10; particles.push({ x:pcx() + Math.cos(a)*d, y:pcy() + Math.sin(a)*d, vx:-Math.cos(a)*d*2, vy:-Math.sin(a)*d*2, g:0, life:.45, col:'#8fd0ff', sz:1, glow:true }); }
  if (Math.random() < dt*8) SFX.charge();
  if (r.t >= r.dur){
    game.recall = null;
    burst(pcx(), pcy(), '#8fd0ff', 30, 90, 0, .8, true);
    P.x = 15*TS+3; P.y = (SURF-1)*TS+2; P.vx = P.vy = 0; P.kbx = 0;
    snapCamera(); SFX.teleport(); track('recall');
    burst(pcx(), pcy(), '#8fd0ff', 30, 90, 0, .8, true);
    msg('Beamed back to the surface!', '#5aa2ff');
  }
}
