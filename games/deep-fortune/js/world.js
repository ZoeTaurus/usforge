'use strict';
// ============================================================
//  World: generation, tile queries, cave-ins, falling rock,
//  lava & gas simulation
// ============================================================
let tiles, layer, deco, seen, stamp, decor;
let caveins = [], rocks = [], tickId = 0, worldSeed = 0;
let surfaceDecor = { trees:[], rocks:[] };
let ARENA = null;                    // the boss chamber at the bottom

const SHOP_X0 = 3, SHOP_X1 = 10;     // shop building footprint (tiles)
const HEADFRAME_X = 17;              // decorative mine headframe

function get(x,y){ return inb(x,y) ? tiles[I(x,y)] : T.BEDROCK; }
function isSolid(x,y){ if (x<0 || x>=WW || y>=WH) return true; if (y<0) return false; return !!DEF[tiles[I(x,y)]].solid; }
const isEmpty = t => t===T.AIR || t===T.GAS;
const isRock  = t => t===T.DIRT || t===T.STONE || t===T.GRANITE || t===T.BASALT;
const depthOf = ty => Math.max(0, ty - SURF);

function wavy(base, amp){
  const a = [], ph = R()*10, f = .06 + R()*.08;
  for (let x=0;x<WW;x++) a.push(Math.round(base + Math.sin(x*f+ph)*amp + Math.sin(x*f*2.7+ph)*amp*.4 + (R()-.5)*1.5));
  return a;
}
function blob(cx, cy, size, type, allow){
  let x = cx, y = cy;
  for (let i=0;i<size;i++){
    if (inb(x,y) && y>SURF+1 && y<WH-2 && allow(tiles[I(x,y)])) tiles[I(x,y)] = type;
    const d = R()*4|0; x += [1,-1,0,0][d]; y += [0,0,1,-1][d];
  }
}

function genWorld(seed, opts = {}){
  worldSeed = seed;
  R = mulberry32(seed);
  const N = WW*WH;
  tiles = new Uint8Array(N); layer = new Uint8Array(N); deco = new Uint8Array(N); seen = new Uint8Array(N); stamp = new Uint32Array(N); decor = new Uint8Array(N);
  caveins = []; rocks = [];
  const b1 = wavy(SURF+10, 2), b2 = wavy(SURF+62, 4), b3 = wavy(SURF+140, 5);
  for (let y=0;y<WH;y++) for (let x=0;x<WW;x++){
    let t;
    if (y < SURF) t = T.AIR;
    else if (y === SURF) t = T.GRASS;
    else t = y<b1[x] ? T.DIRT : y<b2[x] ? T.STONE : y<b3[x] ? T.GRANITE : T.BASALT;
    const L = (t===T.AIR || t===T.GRASS) ? T.DIRT : t;
    if (y >= WH-1 || (y >= WH-4 && R() < (y-(WH-5))/4)) t = T.BEDROCK;
    tiles[I(x,y)] = t; layer[I(x,y)] = L;
  }
  // winding caves: short, mostly one tile tall, plus a scattering of small pockets
  for (let i=0;i<16;i++){
    let x = R()*WW, y = SURF+28+R()*(WH-SURF-40), a = R()*Math.PI*2;
    const len = 10+R()*24, rad = R()<.12 ? 2 : 1;
    for (let s=0;s<len;s++){
      a += (R()-.5)*.7; x += Math.cos(a); y += Math.sin(a)*.6;
      for (let dy=-rad+1;dy<rad;dy++) for (let dx=-rad+1;dx<rad+1;dx++){
        const cx = x+dx|0, cy = y+dy|0;
        if (inb(cx,cy) && cy>SURF+20 && cy<WH-4 && tiles[I(cx,cy)]!==T.BEDROCK) tiles[I(cx,cy)] = T.AIR;
      }
    }
  }
  for (let i=0;i<34;i++){                                           // little air pockets
    const cx = ri(2, WW-3), cy = ri(SURF+22, WH-8), rx = 1 + R()*2, ry = 1 + R()*.8;
    for (let y=Math.floor(cy-ry); y<=cy+ry; y++) for (let x=Math.floor(cx-rx); x<=cx+rx; x++){
      const nx = (x-cx)/rx, ny = (y-cy)/ry;
      if (nx*nx + ny*ny <= 1 && inb(x,y) && tiles[I(x,y)] !== T.BEDROCK) tiles[I(x,y)] = T.AIR;
    }
  }
  const d2y = d => SURF + d;
  for (let i=0;i<55;i++) blob(ri(0,WW-1), d2y(ri(6,150)), ri(5,14), T.GRAVEL, isRock);
  if (opts.gas !== false)  for (let i=0;i<26;i++) blob(ri(0,WW-1), d2y(ri(45,WH-SURF-6)), ri(4,10), T.GAS, isRock);
  for (let i=0;i<30;i++) blob(ri(0,WW-1), d2y(ri(18,190)), ri(8,20), T.WATER, isRock);     // underground pools
  if (opts.lava !== false) for (let i=0;i<34;i++) blob(ri(0,WW-1), d2y(ri(105,WH-SURF-6)), ri(6,16), T.LAVA, isRock);
  //            ore        min  max count size
  const table = [ [T.COAL,     2, 100, 95, 3,8], [T.COPPER,   8, 120, 72, 3,7], [T.QUARTZ,  10, 110, 60, 2,6],
                  [T.IRON,    25, 170, 66, 2,6], [T.SILVER,  55, 210, 52, 2,5], [T.FOSSIL, 30, 170, 34, 1,2], [T.AMETHYST,60, 200, 42, 2,5],
                  [T.GOLD,    85, 260, 46, 2,5], [T.EMERALD, 100, 230, 32, 2,4], [T.RUBY,   130, 260, 32, 2,4],
                  [T.SAPPHIRE,150,260, 26, 1,4], [T.DIAMOND, 170, 260, 24, 1,3], [T.PLATINUM,190,260, 17, 1,3],
                  [T.MYTHRIL, 205,260, 14, 1,3], [T.VOIDSTONE,226,260, 9, 1,2] ];
  for (const [t,mn,mx,count,s0,s1] of table)
    for (let i=0;i<count;i++) blob(ri(0,WW-1), d2y(ri(mn, Math.min(mx, WH-SURF-4))), ri(s0,s1), t, isRock);
  // treasure chests on cave floors
  let chests = 0;
  for (let tries=0; tries<3000 && chests<24; tries++){
    const x = ri(1,WW-2), y = ri(SURF+22, WH-6);
    if (tiles[I(x,y)] === T.AIR && isRock(tiles[I(x,y+1)]) && tiles[I(x,y-1)] === T.AIR){ tiles[I(x,y)] = T.CHEST; chests++; }
  }
  carveArena();
  decorateCaves();
  // solid shop foundation
  for (let x=SHOP_X0-1;x<=SHOP_X1+1;x++) for (let y=SURF+1;y<=SURF+2;y++) tiles[I(x,y)] = T.DIRT;
  // surface decoration
  surfaceDecor = { trees:[], rocks:[], bushes:[] };
  for (let x=24; x<WW-2; x+= 3 + (R()*6|0)){
    const roll = R(), kind = roll < .45 ? 'oak' : roll < .75 ? 'pine' : 'birch';
    surfaceDecor.trees.push({ x: x*TS + (R()*10|0) - 5, kind, v: R()*4|0, flip: R() < .5, back: R() < .35 });
  }
  for (let i=0;i<10;i++) surfaceDecor.rocks.push({ x: 12 + R()*(WW-14)*TS|0, s: 3 + (R()*4|0) });
  for (let i=0;i<22;i++) surfaceDecor.bushes.push({ x: (12 + R()*(WW-14))*TS|0, v: R()*4|0, flip: R() < .5 });
}

// ---------- supports & cave-ins ----------
// ---------- support columns: stack supports from the floor up to the roof ----------
const isSupport = (x,y) => inb(x,y) && deco[I(x,y)] === D.SUPPORT;
function supportColumn(x,y){                         // the stack of supports containing (x,y)
  let top = y, bot = y;
  while (isSupport(x, top-1)) top--;
  while (isSupport(x, bot+1)) bot++;
  return { top, bot, braced: isSolid(x, top-1) && isSolid(x, bot+1), gap: gapAbove(x, top) };
}
function gapAbove(x, y){ let n = 0; while (n < 40 && !isSolid(x, y-1-n) && y-1-n > 0) n++; return n; }   // open tiles above a column
const supportStands = (x,y) => isSolid(x, y+1) || isSupport(x, y+1);
function supported(x,y){
  for (let dx=-3;dx<=3;dx++) for (let dy=-8;dy<=8;dy++){
    const cx = x+dx, cy = y+dy;
    if (!isSupport(cx,cy) || isSupport(cx,cy+1)) continue;          // look at each column once, from its bottom
    const c = supportColumn(cx,cy);
    if (c.braced && y >= c.top - 1 && y <= c.bot + 1) return true;  // a braced column holds up everything along its height
  }
  return false;
}
function maybeScheduleCavein(x,y){
  if (game.opts.caveins === false) return;
  const dep = depthOf(y);
  if (dep < 5) return;
  const above = get(x,y-1);
  if (!DEF[above].solid || above===T.BEDROCK) return;
  if (supported(x,y) || caveins.some(c => c.x===x && c.y===y)) return;
  if (R() < Math.min(.9, (.22 + dep/320) * diff().cave)) caveins.push({ x, y, t: 3 + Math.random()*6, creak:0 });
}
function breakTile(x,y){
  const t = get(x,y), d = DEF[t];
  tiles[I(x,y)] = T.AIR;
  debris(x*TS+8, y*TS+8, d.col, 10);
  hitStop = .05; shake(1.4);
  if (d.chest){ openChest(x,y); return; }
  if (d.ore){
    if (game.opts.infinite || bagCount() < bagCap()){
      game.bag[t] = (game.bag[t]||0) + 1; game.stats.ores++; track('ore', t);
      veinStreak(t, x, y);
      d.value >= 70 ? SFX.gem() : SFX.ore();
      floater(x*TS+8, y*TS, `+${d.name} $${d.value}`, rgb(d.c2));
      if (d.value >= 140) burst(x*TS+8, y*TS+8, rgb(d.c2), 16, 90, 0, .9, true);
    } else { SFX.deny(); msg('Backpack full! Ore lost - sell at the surface.', '#e0533d', 2.5); }
  } else SFX.break();
  maybeScheduleCavein(x,y);
  checkStructures(x,y);
}
function spawnRock(x,y,type){ tiles[I(x,y)] = T.AIR; rocks.push({ x:x*TS, y:y*TS, vy:0, type, hit:false }); checkStructures(x,y); }
function collapse(c){
  const { x, y } = c;
  if (supported(x,y)) return;
  SFX.crash(); shake(6);
  msg('CAVE-IN!', '#e0533d', 2);
  const cols = [x]; if (R()<.5) cols.push(x-1); if (R()<.5) cols.push(x+1);
  for (const cx of cols){
    if (isSolid(cx,y)) continue;
    let cy = y; while (cy>SURF && !isSolid(cx,cy)) cy--;
    if (cy <= SURF+2) continue;
    const t = get(cx,cy);
    if (!DEF[t].solid || t===T.BEDROCK) continue;
    const n = 1 + (R()<.45?1:0) + (R()<.2?1:0);
    for (let k=0;k<n;k++){
      const ty = cy-k, tt = get(cx,ty);
      if (!DEF[tt].solid || tt===T.BEDROCK || ty<=SURF+1) break;
      spawnRock(cx, ty, 'rubble');
    }
    burst(cx*TS+8, cy*TS+14, '#6a625c', 16, 40, 200, 1);
  }
}

// ---------- falling rocks ----------
function stepRocks(dt){
  for (let i=rocks.length-1;i>=0;i--){
    const r = rocks[i];
    r.vy = Math.min(r.vy + 700*dt, 600); r.y += r.vy*dt;
    const tx = Math.floor((r.x+8)/TS), tyBelow = Math.floor((r.y+TS)/TS);
    if (!r.hit && !game.over && r.x < P.x+P.w && r.x+TS > P.x && r.y < P.y+P.h && r.y+TS > P.y && r.vy > 60){
      r.hit = true; const plank = r.type === 'plank', dmg = plank ? 6 : r.type==='gravel' ? 14 : 24;
      hurt(dmg, plank ? 'Flattened by a collapsing bridge.' : r.type==='gravel' ? 'Crushed by falling gravel.' : 'Buried in a cave-in. Should have built supports...');
      burst(r.x+8, r.y+8, plank ? '#a0703c' : r.type==='gravel' ? '#8c8478' : '#60584f', 16, 70);
      rocks.splice(i,1); continue;
    }
    if (isSolid(tx,tyBelow) || get(tx,tyBelow)===T.LAVA || tyBelow>=WH-1){
      const ty = tyBelow-1;
      const onPlayer = tx*TS < P.x+P.w && tx*TS+TS > P.x && ty*TS < P.y+P.h && ty*TS+TS > P.y;
      if (get(tx,tyBelow)===T.LAVA){ burst(r.x+8, r.y+8, '#ff9a2a', 10, 50); SFX.sizzle(); }
      else if (r.type === 'plank'){ burst(r.x+8, ty*TS+12, '#a0703c', 10, 60); }
      else if (!onPlayer && inb(tx,ty) && isEmpty(get(tx,ty))){ tiles[I(tx,ty)] = r.type==='gravel' ? T.GRAVEL : T.RUBBLE; if (deco[I(tx,ty)]){ deco[I(tx,ty)] = 0; checkStructures(tx,ty); } }
      burst(r.x+8, ty*TS+14, r.type==='gravel' ? '#8c8478' : '#60584f', 8, 50);
      if (Math.abs(r.x-P.x) < 300 && Math.abs(r.y-P.y) < 200) SFX.land();
      rocks.splice(i,1);
    }
  }
}
function stepCaveins(dt){
  for (let i=caveins.length-1;i>=0;i--){
    const c = caveins[i];
    if (!isSolid(c.x,c.y-1) || supported(c.x,c.y)){ caveins.splice(i,1); continue; }
    const near = Math.abs(c.x*TS-pcx()) < 340 && Math.abs(c.y*TS-pcy()) < 240;
    if (!near) continue;                       // distant tunnels wait for you
    c.t -= dt;
    if (c.t < 2.5){
      if (Math.random() < dt*14) particles.push({ x:c.x*TS+2+Math.random()*12, y:c.y*TS, vx:0, vy:10, g:120, life:.7, col:'#8a817a', sz:1 });
      c.creak -= dt; if (c.creak <= 0){ SFX.creak(); c.creak = .45 + Math.random()*.5; }
    }
    if (c.t <= 0){ caveins.splice(i,1); collapse(c); }
  }
}

// ---------- liquids & gas (cellular automaton) ----------
function simWorld(){
  tickId++;
  const y0 = clamp(Math.floor(cam.y/TS)-18, SURF, WH-1), y1 = clamp(Math.floor((cam.y+VH)/TS)+18, 0, WH-2);
  let sizzled = false;
  for (let y=y1; y>=y0; y--){
    const dir = (tickId+y)&1 ? 1 : -1;
    for (let k=0;k<WW;k++){
      const x = dir>0 ? k : WW-1-k, i = I(x,y);
      if (stamp[i]===tickId) continue;
      const t = tiles[i];
      if (t===T.LAVA){
        // wooden things next to lava catch fire
        for (const [dx,dy] of [[1,0],[-1,0],[0,-1],[0,1]]){
          const nx = x+dx, ny = y+dy, ni = I(nx,ny);
          if (inb(nx,ny) && deco[ni] && deco[ni] !== D.TORCH && R() < .08){ deco[ni] = 0; burst(nx*TS+8, ny*TS+8, '#ff9a2a', 12, 50, -60, .8, true); checkStructures(nx,ny); }
        }
        // lava is thick: it falls a little slower than water and oozes sideways reluctantly
        if (isEmpty(tiles[I(x,y+1)])){
          if (R() < .7) moveLiquid(x,y,x,y+1);
          if (!sizzled && Math.abs(x*TS-pcx())<220 && Math.abs(y*TS-pcy())<160 && R()<.05){ SFX.sizzle(); sizzled = true; }
          continue;
        }
        // a lone blob spread thin on the floor slowly cools into rock
        const loneLava = get(x-1,y) !== T.LAVA && get(x+1,y) !== T.LAVA && get(x,y-1) !== T.LAVA && get(x,y+1) !== T.LAVA;
        if (loneLava && R() < .02){ tiles[i] = T.BASALT; burst(x*TS+8, y*TS+6, '#6a625c', 8, 30, -30, 1); continue; }
        if (R() < .25){ const sd = R()<.5 ? 1 : -1;
          for (const s of [sd,-sd]){ const nx = x+s; if (nx>=0 && nx<WW && isEmpty(tiles[I(nx,y)])){
            // it slumps diagonally over edges rather than stepping out into thin air
            if (isEmpty(tiles[I(nx,y+1)])) moveLiquid(x,y,nx,y+1); else moveLiquid(x,y,nx,y);
            break; } } }
      } else if (t===T.WATER){
        // water + lava = obsidian (and a puff of steam)
        let quenched = false;
        for (const [dx,dy] of [[0,1],[1,0],[-1,0],[0,-1]]){
          const nx = x+dx, ny = y+dy;
          if (get(nx,ny) === T.LAVA){ tiles[I(nx,ny)] = T.OBSIDIAN; tiles[i] = T.AIR; stamp[I(nx,ny)] = tickId; quenched = true;
            burst(nx*TS+8, ny*TS+4, '#dfe8f0', 14, 50, -40, 1.2); if (Math.abs(nx*TS-pcx()) < 260 && Math.abs(ny*TS-pcy()) < 200){ SFX.sizzle(); track('obsidian'); } break; }
        }
        if (quenched) continue;
        if (tiles[I(x,y+1)] === T.AIR || tiles[I(x,y+1)] === T.GAS){ moveWater(x,y,x,y+1); continue; }
        { const sd0 = R() < .5 ? 1 : -1; let slid = false;           // slide diagonally down slopes
          for (const s of [sd0, -sd0]){ const nx = x+s; if (nx>=0 && nx<WW && tiles[I(nx,y)] === T.AIR && tiles[I(nx,y+1)] === T.AIR){ moveWater(x,y,nx,y+1); slid = true; break; } }
          if (slid) continue; }
        // a lone droplet on a flat floor slowly dries up instead of jiggling forever
        const lone = get(x-1,y) !== T.WATER && get(x+1,y) !== T.WATER && get(x,y-1) !== T.WATER;
        // a stray bump sitting on top of a pool sinks back in quickly; a lone puddle on rock dries slowly
        if (lone && R() < (get(x, y+1) === T.WATER ? .07 : .02)){ tiles[i] = T.AIR; continue; }
        // spread sideways up to 4 tiles in one go so pools level out quickly (and pour off ledges)
        if (get(x, y-1) !== T.WATER || R() < .5){
          const sd = R()<.5 ? 1 : -1;
          for (const s of [sd,-sd]){
            let target = -1;
            for (let k=1;k<=4;k++){
              const nx = x + s*k; if (nx < 0 || nx >= WW) break;
              const nt = tiles[I(nx,y)]; if (nt !== T.AIR && nt !== T.GAS) break;
              target = nx;
              if (tiles[I(nx,y+1)] === T.AIR) break;                   // found a drop: pour over the edge
            }
            if (target >= 0 && !(get(x, y-1) === T.WATER && Math.abs(target - x) === 1 && tiles[I(target, y+1)] !== T.AIR && R() < .5)){ moveWater(x,y,target,y); break; }
          }
        }
      } else if (t===T.GRAVEL && game.opts.caveins !== false){
        const bi = I(x,y+1);
        if (isEmpty(tiles[bi]) && deco[bi]!==D.SUPPORT && R()<.35) spawnRock(x,y,'gravel');
      }
    }
  }
  for (let y=y0; y<=y1; y++){
    const dir = (tickId+y)&1 ? 1 : -1;
    for (let k=0;k<WW;k++){
      const x = dir>0 ? k : WW-1-k, i = I(x,y);
      if (tiles[i]!==T.GAS || stamp[i]===tickId) continue;
      if (y-1 >= SURF && tiles[I(x,y-1)]===T.AIR && R()<.7){ swapGas(x,y,x,y-1); continue; }
      if (y-1 < SURF){ tiles[i] = T.AIR; continue; }
      const nx = x + (R()<.5 ? 1 : -1);
      if (nx>=0 && nx<WW && tiles[I(nx,y)]===T.AIR && R()<.4){ swapGas(x,y,nx,y); continue; }
      let exposed = false; for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) if (get(x+dx,y+dy)===T.AIR) exposed = true;
      if (exposed && R()<.012) tiles[i] = T.AIR;
    }
  }
}
function moveLiquid(x,y,nx,ny){
  const a = I(x,y), b = I(nx,ny), other = tiles[b];
  tiles[b] = T.LAVA; tiles[a] = other===T.GAS ? T.GAS : T.AIR; stamp[b] = tickId;
  if (deco[b]){ burst(nx*TS+8, ny*TS+8, '#ff9a2a', 10, 50, 200, .6, true); deco[b] = 0; checkStructures(nx,ny); }
}
function moveWater(x,y,nx,ny){
  const a = I(x,y), b = I(nx,ny), other = tiles[b]; tiles[b] = T.WATER; tiles[a] = other === T.GAS ? T.GAS : T.AIR; stamp[b] = tickId;
  if (deco[b] === D.TORCH){ deco[b] = 0; burst(nx*TS+8, ny*TS+4, '#cfd8e0', 10, 30, -40, 1); }            // torches go out underwater
}
function swapGas(x,y,nx,ny){ const a=I(x,y), b=I(nx,ny); tiles[a]=T.AIR; tiles[b]=T.GAS; stamp[b]=tickId; }

// ---------- treasure chests ----------
const chestTier = y => { const d = depthOf(y); return d < 90 ? 0 : d < 180 ? 1 : 2; };
function openChest(x,y){
  const dep = depthOf(y), tier = chestTier(y);
  game.stats.chests++; track('chest');
  SFX.chest(); shake(2 + tier);
  burst(x*TS+8, y*TS+8, ['#ffd24a','#c8d4e0','#fff3a0'][tier], 24 + tier*12, 90, 150, 1, true);
  const cash = Math.round((25 + Math.random()*40) * (1 + dep/45) * [1, 1.6, 2.6][tier]);
  for (let k=0;k<5;k++) dropCoin(x*TS+8, y*TS+6, Math.round(cash/5));
  const loot = [['ladder',8],['torch',4],['support',3],['dynamite',2],['medkit',1],['beacon',1]][Math.random()*6|0];
  if (!game.opts.infinite) game[loot[0]] += loot[1];
  msg(`Treasure chest! ${fmtMoney(cash)} + ${loot[0]} x${loot[1]}`, '#ffd24a', 3);
  // a deep chest may hold a gem
  const gems = tier === 2 ? 3 : tier === 1 ? 2 : (dep > 60 && Math.random() < .6 ? 1 : 0);
  for (let k=0;k<gems;k++){ const pool = ORES.filter(o => o[2] >= 35 && o[2] <= 30 + dep*2.2); if (pool.length) dropOre(x*TS+8, y*TS+6, pool[Math.random()*pool.length|0][0]); }
}

// ---------- the boss arena ----------
function carveArena(){
  const acx = WW/2|0, acy = WH - 11, arx = 17, ary = 6;
  ARENA = { x0: acx - arx, x1: acx + arx, y0: acy - ary, y1: acy + ary - 1 };
  // keep lava and gas from flooding in
  for (let y=acy-ary-3; y<=acy+ary+2; y++) for (let x=acx-arx-3; x<=acx+arx+3; x++)
    if (inb(x,y) && (tiles[I(x,y)] === T.LAVA || tiles[I(x,y)] === T.GAS)) tiles[I(x,y)] = T.BASALT;
  for (let y=acy-ary; y<=acy+ary; y++) for (let x=acx-arx; x<=acx+arx; x++){
    const nx = (x - acx)/arx, ny = (y - acy)/ary;
    if (nx**4 + ny**4 <= 1 && inb(x,y)){ tiles[I(x,y)] = T.AIR; deco[I(x,y)] = 0; }
  }
  for (let x=acx-arx; x<=acx+arx; x++){                              // solid floor under the chamber
    let y = acy + ary; while (y > acy && tiles[I(x,y)] !== T.AIR) y--;
    if (inb(x,y+1) && !DEF[tiles[I(x,y+1)]].solid) tiles[I(x,y+1)] = T.BASALT;
  }
  for (let i=0;i<16;i++){                                           // a ring of treasure crystals in the walls
    const a = Math.random()*Math.PI*2, x = Math.round(acx + Math.cos(a)*(arx+1)), y = Math.round(acy + Math.sin(a)*(ary+1));
    if (inb(x,y) && isRock(tiles[I(x,y)])) tiles[I(x,y)] = Math.random() < .5 ? T.VOIDSTONE : T.MYTHRIL;
  }
}

// ---------- bridges: platforms need a wall, the ground or a bridge post within reach ----------
const BRIDGE_REACH = 5;
const isPost = (x,y) => inb(x,y) && deco[I(x,y)] === D.POST;
function postStands(x,y){ let yy = y+1, n = 0; while (isPost(x,yy) && n < 20){ yy++; n++; } return isSolid(x,yy); }
function postHeight(x,y){ let n = 0, yy = y+1; while (isPost(x,yy)){ yy++; n++; } return n; }
const platformAnchored = (x,y) => isSolid(x-1,y) || isSolid(x+1,y) || isSolid(x,y+1) || (isPost(x,y+1) && postStands(x,y+1));
// tiles along the bridge from (x,y) to the nearest anchored plank (0 = anchored itself); `extra` pretends a plank is at (x,y)
function bridgeDist(x,y){
  if (platformAnchored(x,y)) return 0;
  let best = Infinity;
  for (const dir of [-1,1]){
    let xx = x + dir, d = 1;
    while (isPlatform(xx,y) && d <= 30){ if (platformAnchored(xx,y)){ best = Math.min(best, d); break; } xx += dir; d++; }
  }
  return best;
}
function collapsePiece(x,y){
  const kind = deco[I(x,y)]; deco[I(x,y)] = 0;
  rocks.push({ x:x*TS, y:y*TS, vy:0, type:'plank', prop: kind === D.POST ? 'post' : kind === D.SUPPORT ? 'support' : 'platform', hit:false });
  burst(x*TS+8, y*TS+4, '#a0703c', 8, 50);
}
// re-check posts and bridges near a change; unsupported pieces fall
function checkStructures(cx, cy){
  let fell = 0;
  for (let pass=0; pass<12; pass++){                  // repeat until nothing else is left hanging
    const drop = [];
    for (let y=cy+12; y>=cy-12; y--) for (let x=cx-14; x<=cx+14; x++){
      if (!inb(x,y)) continue;
      const d = deco[I(x,y)];
      if (d === D.POST && !postStands(x,y)) drop.push([x,y]);
      else if (d === D.SUPPORT && !supportStands(x,y)) drop.push([x,y]);
      else if (d === D.PLATFORM && bridgeDist(x,y) > BRIDGE_REACH) drop.push([x,y]);
    }
    if (!drop.length) break;
    for (const [x,y] of drop) collapsePiece(x,y);
    fell += drop.length;
  }
  if (fell){ SFX.crash(); msg(fell > 1 ? 'The bridge collapsed!' : 'A plank fell - it had no support.', '#e0533d', 2); }
}

// chunks of rock that tumble and bounce off the floor
function debris(cx, cy, col, n){
  for (let i=0;i<n;i++){
    const a = Math.random()*Math.PI*2, s = 30 + Math.random()*80;
    particles.push({ x:cx + (Math.random()-.5)*8, y:cy + (Math.random()-.5)*8, vx:Math.cos(a)*s, vy:Math.sin(a)*s - 60, g:520, life:.7 + Math.random()*.5,
                     col: rgb(col, .7 + Math.random()*.6), sz: Math.random() < .5 ? 2 : 1, bounce:true });
  }
}

// ---------- natural cave decorations ----------
function decorateCaves(){
  for (let y=SURF+4; y<WH-5; y++) for (let x=1; x<WW-1; x++){
    const i = I(x,y);
    if (tiles[i] !== T.AIR) continue;
    const dep = y - SURF, L = layer[i], above = DEF[tiles[I(x,y-1)]].solid && tiles[I(x,y-1)] !== T.BEDROCK, below = DEF[tiles[I(x,y+1)]].solid;
    const r = R();
    if (above){
      if ((isSolid(x-1,y) || isSolid(x+1,y)) && r < .16) decor[i] = DECOR.WEB;
      else if (L === T.DIRT && dep < 30 && r < .45) decor[i] = DECOR.ROOTS;
      else if (dep > 140 && r < .12) decor[i] = DECOR.CRYSTAL;
      else if (r < .32) decor[i] = DECOR.STALACTITE;
    } else if (below){
      if (dep > 30 && dep < 170 && r < .1) decor[i] = DECOR.MUSHROOM;
      else if (dep > 130 && r < .2) decor[i] = DECOR.CRYSTAL_UP;
      else if (r < .23) decor[i] = DECOR.STALAGMITE;
      else if (r < .245) decor[i] = DECOR.BONES;
      else if (r < .252 && isSolid(x-1,y+1) && isSolid(x+1,y+1)) decor[i] = DECOR.CART;
    }
  }
}
const decorAnchored = (x, y, d) => (d === DECOR.STALACTITE || d === DECOR.ROOTS || d === DECOR.WEB || d === DECOR.CRYSTAL) ? isSolid(x, y-1) : isSolid(x, y+1);
const DECOR_NAMES = { [DECOR.MUSHROOM]:'Glowcap mushroom - pick to heal', [DECOR.CRYSTAL]:'Crystal cluster - harvest for gems', [DECOR.CRYSTAL_UP]:'Crystal cluster - harvest for gems',
                      [DECOR.BONES]:"A lost miner's bones - search them", [DECOR.CART]:'Abandoned minecart - search it' };
// pick / harvest / search a decoration (returns true if something happened)
function harvestDecor(x, y){
  const i = I(x,y), d = decor[i], cx = x*TS + 8, cy = y*TS + 8;
  if (!d || !DECOR_NAMES[d] || !decorAnchored(x, y, d)) return false;
  decor[i] = 0;
  if (d === DECOR.MUSHROOM){ const heal = 8; if (!game.opts.invincible) P.hp = Math.min(maxHp(), P.hp + heal); floater(cx, cy - 6, `+${heal} HP`, '#8fffa0'); SFX.heal(); burst(cx, cy, '#90f0ff', 10, 40, 0, .8, true); }
  else if (d === DECOR.CRYSTAL || d === DECOR.CRYSTAL_UP){ const n = 1 + (Math.random() < .4 ? 1 : 0); for (let k=0;k<n;k++) dropOre(cx, cy, Math.random() < .6 ? T.AMETHYST : T.SAPPHIRE); SFX.gem(); burst(cx, cy, '#d0a0ff', 14, 60, 200, .8, true); track('crystal'); }
  else if (d === DECOR.BONES){ for (let k=0;k<3;k++) dropCoin(cx, cy, 5 + Math.round(depthOf(y)/10)); SFX.coin(); msg('You find a few coins... rest in peace, miner.', '#c9c0ae', 2.5); track('bones'); }
  else if (d === DECOR.CART){
    for (let k=0;k<4;k++) dropCoin(cx, cy, 8 + Math.round(depthOf(y)/6));
    const loot = [['ladder',6],['torch',3],['support',2],['dynamite',1],['scanner',1]][Math.random()*5|0];
    if (!game.opts.infinite) game[loot[0]] += loot[1];
    { const pool = ORES.filter(o => ORE_MIN_DEPTH[o[0]] <= depthOf(y) + 10); dropOre(cx, cy, pool[Math.random()*pool.length|0][0]); }
    SFX.chest(); msg(`Abandoned minecart! Coins + ${loot[0]} x${loot[1]}`, '#ffd24a', 2.5); track('cart');
  }
  return true;
}

// mining the same ore again within a few seconds builds a streak that pays a bonus
function veinStreak(t, x, y){
  const c = game.combo;
  if (c && c.id === t && game.time - c.at < 4){ c.n++; c.at = game.time; }
  else game.combo = { id:t, n:1, at:game.time };
  const n = game.combo.n;
  if (n >= 2){
    const bonus = Math.max(1, Math.round(DEF[t].value * .15 * (n - 1)));
    game.money += bonus; game.earned += bonus; track('earn', bonus);
    floater(x*TS + 8, y*TS - 10, `VEIN x${n}  +$${bonus}`, '#ffd24a');
    tone(520 + n*90, .08, 'square', .04);
    if (n === 5) msg('Rich vein! Keep going!', '#ffd24a', 1.5);
  }
}
