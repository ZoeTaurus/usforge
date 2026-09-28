'use strict';
// ============================================================
//  World: generation, tile queries, cave-ins, falling rock,
//  lava & gas simulation
// ============================================================
let tiles, layer, deco, seen, stamp;
let caveins = [], rocks = [], tickId = 0, worldSeed = 0;
let surfaceDecor = { trees:[], rocks:[] };

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
  tiles = new Uint8Array(N); layer = new Uint8Array(N); deco = new Uint8Array(N); seen = new Uint8Array(N); stamp = new Uint32Array(N);
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
  // winding caves
  for (let i=0;i<24;i++){
    let x = R()*WW, y = SURF+28+R()*(WH-SURF-40), a = R()*Math.PI*2;
    const len = 30+R()*70, rad = R()<.3 ? 2 : 1;
    for (let s=0;s<len;s++){
      a += (R()-.5)*.7; x += Math.cos(a); y += Math.sin(a)*.6;
      for (let dy=-rad+1;dy<rad;dy++) for (let dx=-rad+1;dx<rad+1;dx++){
        const cx = x+dx|0, cy = y+dy|0;
        if (inb(cx,cy) && cy>SURF+20 && cy<WH-4 && tiles[I(cx,cy)]!==T.BEDROCK) tiles[I(cx,cy)] = T.AIR;
      }
    }
  }
  const d2y = d => SURF + d;
  for (let i=0;i<55;i++) blob(ri(0,WW-1), d2y(ri(6,150)), ri(5,14), T.GRAVEL, isRock);
  if (opts.gas !== false)  for (let i=0;i<26;i++) blob(ri(0,WW-1), d2y(ri(45,WH-SURF-6)), ri(4,10), T.GAS, isRock);
  if (opts.lava !== false) for (let i=0;i<34;i++) blob(ri(0,WW-1), d2y(ri(105,WH-SURF-6)), ri(6,16), T.LAVA, isRock);
  //            ore        min  max count size
  const table = [ [T.COAL,     2, 100, 95, 3,8], [T.COPPER,   8, 120, 72, 3,7], [T.QUARTZ,  10, 110, 60, 2,6],
                  [T.IRON,    25, 170, 66, 2,6], [T.SILVER,  55, 210, 52, 2,5], [T.AMETHYST,60, 200, 42, 2,5],
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
  // solid shop foundation
  for (let x=SHOP_X0-1;x<=SHOP_X1+1;x++) for (let y=SURF+1;y<=SURF+2;y++) tiles[I(x,y)] = T.DIRT;
  // surface decoration
  surfaceDecor = { trees:[], rocks:[] };
  for (let x=24; x<WW-2; x+= 4 + (R()*7|0)) surfaceDecor.trees.push({ x, h: 3 + (R()*3|0), kind: R()<.3 ? 1 : 0 });
  for (let i=0;i<10;i++) surfaceDecor.rocks.push({ x: 12 + R()*(WW-14)*TS|0, s: 3 + (R()*4|0) });
}

// ---------- supports & cave-ins ----------
function supported(x,y){
  for (let dy=-2;dy<=3;dy++) for (let dx=-3;dx<=3;dx++){
    const cx=x+dx, cy=y+dy;
    if (inb(cx,cy) && deco[I(cx,cy)]===D.SUPPORT) return true;
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
  burst(x*TS+8, y*TS+8, rgb(d.col), 12, 70);
  if (d.chest){ openChest(x,y); return; }
  if (d.ore){
    if (game.opts.infinite || bagCount() < bagCap()){
      game.bag[t] = (game.bag[t]||0) + 1; game.stats.ores++; track('ore', t);
      d.value >= 70 ? SFX.gem() : SFX.ore();
      floater(x*TS+8, y*TS, `+${d.name} $${d.value}`, rgb(d.c2));
      if (d.value >= 140) burst(x*TS+8, y*TS+8, rgb(d.c2), 16, 90, 0, .9, true);
    } else { SFX.deny(); msg('Backpack full! Ore lost - sell at the surface.', '#e0533d', 2.5); }
  } else SFX.break();
  maybeScheduleCavein(x,y);
}
function spawnRock(x,y,type){ tiles[I(x,y)] = T.AIR; rocks.push({ x:x*TS, y:y*TS, vy:0, type, hit:false }); }
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
      r.hit = true; const dmg = r.type==='gravel' ? 14 : 24;
      hurt(dmg, r.type==='gravel' ? 'Crushed by falling gravel.' : 'Buried in a cave-in. Should have built supports...');
      burst(r.x+8, r.y+8, r.type==='gravel' ? '#8c8478' : '#60584f', 16, 70);
      rocks.splice(i,1); continue;
    }
    if (isSolid(tx,tyBelow) || get(tx,tyBelow)===T.LAVA || tyBelow>=WH-1){
      const ty = tyBelow-1;
      const onPlayer = tx*TS < P.x+P.w && tx*TS+TS > P.x && ty*TS < P.y+P.h && ty*TS+TS > P.y;
      if (get(tx,tyBelow)===T.LAVA){ burst(r.x+8, r.y+8, '#ff9a2a', 10, 50); SFX.sizzle(); }
      else if (!onPlayer && inb(tx,ty) && isEmpty(get(tx,ty))){ tiles[I(tx,ty)] = r.type==='gravel' ? T.GRAVEL : T.RUBBLE; deco[I(tx,ty)] = 0; }
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
        if (isEmpty(tiles[I(x,y+1)])){
          moveLiquid(x,y,x,y+1);
          if (!sizzled && Math.abs(x*TS-pcx())<220 && Math.abs(y*TS-pcy())<160 && R()<.05){ SFX.sizzle(); sizzled = true; }
          continue;
        }
        if (R()<.5){ const sd = R()<.5 ? 1 : -1; for (const s of [sd,-sd]){ const nx=x+s; if (nx>=0 && nx<WW && isEmpty(tiles[I(nx,y)])){ moveLiquid(x,y,nx,y); break; } } }
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
  if (deco[b]){ burst(nx*TS+8, ny*TS+8, '#ff9a2a', 10, 50, 200, .6, true); deco[b] = 0; }
}
function swapGas(x,y,nx,ny){ const a=I(x,y), b=I(nx,ny); tiles[a]=T.AIR; tiles[b]=T.GAS; stamp[b]=tickId; }

// ---------- treasure chests ----------
function openChest(x,y){
  const dep = depthOf(y);
  game.stats.chests++; track('chest');
  SFX.chest(); shake(2);
  burst(x*TS+8, y*TS+8, '#ffd24a', 24, 90, 150, 1, true);
  const cash = Math.round((25 + Math.random()*40) * (1 + dep/45));
  for (let k=0;k<5;k++) dropCoin(x*TS+8, y*TS+6, Math.round(cash/5));
  const loot = [['ladder',8],['torch',4],['support',3],['dynamite',2],['medkit',1],['beacon',1]][Math.random()*6|0];
  if (!game.opts.infinite) game[loot[0]] += loot[1];
  msg(`Treasure chest! ${fmtMoney(cash)} + ${loot[0]} x${loot[1]}`, '#ffd24a', 3);
  // a deep chest may hold a gem
  if (dep > 60 && Math.random() < .6){ const pool = ORES.filter(o => o[2] >= 35 && o[2] <= 30 + dep*2.2); if (pool.length) dropOre(x*TS+8, y*TS+6, pool[Math.random()*pool.length|0][0]); }
}
