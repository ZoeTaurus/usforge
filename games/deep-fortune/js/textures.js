'use strict';
// ============================================================
//  Procedural pixel-art: tiles, ores, props, miner sprites
// ============================================================
const texR = mulberry32(90210);
const TEX = {}, DARK = {}, ORE_TEX = {}, ICON = {}, PROP = {};
let CRACK = [], TUFTS = [], MINER = [], PICK_SPR = [];
const ESPR = {};

function vnoise(w, h, cell){
  const gw = Math.ceil(w/cell)+2, gh = Math.ceil(h/cell)+2, g = [];
  for (let i=0;i<gw*gh;i++) g.push(texR());
  return (x,y) => {
    const fx=x/cell, fy=y/cell, ix=fx|0, iy=fy|0, tx=fx-ix, ty=fy-iy;
    const sx=tx*tx*(3-2*tx), sy=ty*ty*(3-2*ty);
    const a=g[iy*gw+ix], b=g[iy*gw+ix+1], c=g[(iy+1)*gw+ix], d=g[(iy+1)*gw+ix+1];
    return lerp(lerp(a,b,sx), lerp(c,d,sx), sy);
  };
}
const pal5 = col => [shade(col,.6), shade(col,.78), col, shade(col,1.14), shade(col,1.3)];
const px = (x, c, X, Y, w=1, h=1) => { x.fillStyle = rgb(c); x.fillRect(X, Y, w, h); };

function pebble(x, pal, X, Y, w, h){
  for (let j=0;j<h;j++) for (let i=0;i<w;i++){
    if ((i===0||i===w-1) && (j===0||j===h-1)) continue;       // rounded corners
    const c = j===0 ? pal[4] : (j===h-1 || i===w-1) ? pal[1] : pal[3];
    px(x, c, X+i, Y+j);
  }
  px(x, pal[0], X+1, Y+h, w-2, 1);                               // drop shadow
}

function rockTex(id){
  const col = DEF[id].col, pal = pal5(col);
  const [c, x] = mkCanvas(TS, TS);
  const img = x.createImageData(TS, TS), n1 = vnoise(TS,TS,8), n2 = vnoise(TS,TS,3);
  for (let y=0;y<TS;y++) for (let X=0;X<TS;X++){
    const n = n1(X,y)*.55 + n2(X,y)*.45 + (texR()-.5)*.14;
    const k = n<.3?0 : n<.45?1 : n<.62?2 : n<.8?3 : 4;
    const cc = pal[clamp(k,0,3)], o = (y*TS+X)*4;
    img.data[o]=cc[0]; img.data[o+1]=cc[1]; img.data[o+2]=cc[2]; img.data[o+3]=255;
  }
  x.putImageData(img, 0, 0);
  const R2 = () => texR()*TS|0;
  switch (id){
    case T.DIRT: case T.GRASS:
      for (let i=0;i<3;i++) pebble(x, pal5([140,120,100]), R2()%13, R2()%13, 3, 2);
      for (let i=0;i<4;i++) px(x, pal[0], R2(), R2(), 1+(texR()*2|0), 1);
      if (texR()<.5){ const rx=R2(), ry=R2()%10; for (let k=0;k<5;k++) px(x, [90,60,36], rx+(k%2), ry+k); }
      break;
    case T.STONE:
      for (let i=0;i<2;i++) pebble(x, pal, R2()%11, R2()%11, 4+(texR()*2|0), 3);
      { let cx=R2(), cy=R2(); for (let k=0;k<5;k++){ px(x, pal[0], cx, cy); cx += texR()<.5?1:0; cy += 1; } }
      break;
    case T.GRANITE:
      for (let i=0;i<14;i++) px(x, [[236,214,204],[58,40,40],[196,140,130],[250,236,230]][i%4], R2(), R2());
      pebble(x, pal, R2()%11, R2()%12, 4, 3);
      break;
    case T.BASALT:
      for (const sx of [0, 8]) for (let y=0;y<TS;y++){ if (texR()<.85){ px(x, pal[0], sx, y); px(x, pal[3], sx+1, y); } }
      for (let i=0;i<3;i++) px(x, [120,110,160], R2(), R2());
      break;
    case T.BEDROCK:
      for (let i=0;i<4;i++){ let sx=R2(), sy=R2(); for (let k=0;k<4;k++){ px(x, pal[4], sx, sy, 2, 1); sx+=2; sy+= texR()<.5?1:-1; } }
      break;
    case T.GRAVEL: case T.RUBBLE:
      for (let i=0;i<9;i++) pebble(x, pal5(shade(col, .8+texR()*.5)), R2()%13, R2()%13, 3+(texR()*2|0), 3);
      break;
  }
  return c;
}

function darkWall(src){
  const [c, x] = mkCanvas(TS, TS);
  x.drawImage(src, 0, 0);
  x.fillStyle = 'rgba(10,7,18,.74)'; x.fillRect(0, 0, TS, TS);
  return c;
}

const GEMS = [
  ['.x.','xxx','.x.'],
  ['xx','xx'],
  ['.xx','xxx','xx.'],
  ['.xx.','xxxx','.xx.'],
  ['x.','xx','.x'],
];
function oreTex(id){
  const d = DEF[id], hi = d.c2, mid = d.c1, lo = shade(d.c1, .55);
  const [c, x] = mkCanvas(TS, TS);
  const n = 3 + (texR()*3|0), taken = [];
  for (let i=0;i<n;i++){
    const g = GEMS[texR()*GEMS.length|0], gw = g[0].length, gh = g.length;
    let X, Y, tries = 0;
    do { X = 1 + (texR()*(TS-gw-2)|0); Y = 1 + (texR()*(TS-gh-2)|0); tries++; }
    while (tries < 12 && taken.some(t => Math.abs(t[0]-X) < 4 && Math.abs(t[1]-Y) < 4));
    taken.push([X, Y]);
    const on = (i,j) => j>=0 && j<gh && i>=0 && i<gw && g[j][i]==='x';
    // outline shadow
    for (let j=-1;j<=gh;j++) for (let i=-1;i<=gw;i++){
      if (on(i,j)) continue;
      if (on(i-1,j)||on(i+1,j)||on(i,j-1)||on(i,j+1)){ x.fillStyle = 'rgba(10,6,14,.55)'; x.fillRect(X+i, Y+j, 1, 1); }
    }
    for (let j=0;j<gh;j++) for (let i=0;i<gw;i++){
      if (!on(i,j)) continue;
      const top = !on(i,j-1) || !on(i-1,j), bot = !on(i,j+1) || !on(i+1,j);
      px(x, top ? hi : bot ? lo : mid, X+i, Y+j);
    }
  }
  return c;
}

function crackTex(stage){
  const [c, x] = mkCanvas(TS, TS);
  const r = mulberry32(777 + stage);
  x.fillStyle = 'rgba(8,4,10,.8)';
  const arms = 2 + stage;
  for (let a=0;a<arms;a++){
    let X = 8, Y = 8; const ang = a/arms*Math.PI*2 + r()*.6;
    for (let k=0;k<2+stage*2;k++){
      X += Math.round(Math.cos(ang) + (r()-.5)); Y += Math.round(Math.sin(ang) + (r()-.5));
      x.fillRect(clamp(X,0,15), clamp(Y,0,15), 1, 1);
    }
  }
  return c;
}

function tuftTex(){
  const [c, x] = mkCanvas(TS, 6);
  for (let X=0;X<TS;X++){
    if (texR() < .35) continue;
    const h = 1 + (texR()*4|0);
    x.fillStyle = texR()<.5 ? '#5fb83e' : '#4a9a32'; x.fillRect(X, 6-h, 1, h);
    if (h>2 && texR()<.3){ x.fillStyle = '#8ee05e'; x.fillRect(X, 6-h, 1, 1); }
  }
  if (texR() < .35){ const X = 2 + (texR()*12|0); x.fillStyle = '#3d8a2c'; x.fillRect(X, 2, 1, 4); x.fillStyle = ['#ff6b8a','#ffe066','#ffffff','#9ad0ff'][texR()*4|0]; x.fillRect(X-1, 1, 3, 1); x.fillRect(X, 0, 1, 3); x.fillStyle = '#ffd24a'; x.fillRect(X, 1, 1, 1); }
  return c;
}

// ---------- props & icons ----------
function ladderTex(){
  const [c, x] = mkCanvas(TS, TS);
  px(x,[74,46,22],3,0,2,TS); px(x,[74,46,22],11,0,2,TS);
  px(x,[130,88,46],3,0,1,TS); px(x,[130,88,46],11,0,1,TS);
  for (let k=2;k<TS;k+=5){ px(x,[160,112,60],3,k,10,1); px(x,[96,62,30],3,k+1,10,1); }
  return c;
}
function supportTex(){
  const [c, x] = mkCanvas(TS, TS);
  const wood = [150,98,48], dk = [84,52,22], lt = [192,136,74];
  for (const X of [1, 12]){ px(x,wood,X,0,3,TS); px(x,lt,X,0,1,TS); px(x,dk,X+2,0,1,TS); }
  px(x,wood,0,0,TS,3); px(x,lt,0,0,TS,1); px(x,dk,0,3,TS,1);
  // braces
  for (let k=0;k<4;k++){ px(x,dk,4+k,4+k); px(x,dk,11-k,4+k); }
  px(x,[60,60,66],2,1); px(x,[60,60,66],13,1);
  return c;
}
function platformTex(){
  const [c, x] = mkCanvas(TS, TS);
  px(x,[46,28,12],0,0,TS,6);                                   // outline
  px(x,[150,98,48],0,1,TS,4); px(x,[196,140,76],0,1,TS,1); px(x,[104,66,30],0,4,TS,1);
  px(x,[84,52,22],5,1,1,4); px(x,[84,52,22],11,1,1,4);          // plank joints
  px(x,[70,70,78],2,2); px(x,[70,70,78],13,2); px(x,[70,70,78],8,2);   // nails
  // little diagonal brackets underneath
  for (let k=0;k<4;k++){ px(x,[84,52,22],1+k*0,6+k,2,1); px(x,[84,52,22],13,6+k,2,1); }
  px(x,[84,52,22],1,6,1,4); px(x,[84,52,22],14,6,1,4);
  return c;
}
function postTex(){
  const [c, x] = mkCanvas(TS, TS);
  px(x,[46,28,12],5,0,6,TS);
  px(x,[150,98,48],6,0,4,TS); px(x,[196,140,76],6,0,1,TS); px(x,[104,66,30],9,0,1,TS);
  px(x,[84,52,22],6,4,4,1); px(x,[84,52,22],6,11,4,1);           // grain bands
  px(x,[70,70,78],7,1); px(x,[70,70,78],7,14);                    // bolts
  return c;
}
function torchTex(){
  const [c, x] = mkCanvas(TS, TS);
  px(x,[90,58,28],7,7,2,7); px(x,[130,88,46],7,7,1,7); px(x,[60,60,66],6,6,4,2);
  return c;
}
function medkitTex(){
  const [c, x] = mkCanvas(TS, TS);
  px(x,[40,30,30],2,3,12,11); px(x,[236,236,236],3,4,10,9); px(x,[200,200,210],3,11,10,2);
  px(x,[216,64,58],7,5,2,7); px(x,[216,64,58],5,7,6,3); px(x,[120,120,130],6,2,4,2);
  return c;
}
function makePick(level){
  const [c, x] = mkCanvas(15, 15);
  const head = PICKS[level].head;
  // handle: from grip (2,12) to (10,4)
  for (let k=0;k<9;k++){ px(x,[122,78,38],2+k,12-k); px(x,[80,50,24],3+k,12-k); }
  // head perpendicular through (10,4)
  const hp = [[6,0],[7,1],[8,2],[9,3],[10,4],[11,5],[12,6],[13,7],[14,9]];
  for (const [X,Y] of hp){ px(x,head,X,Y); px(x,shade(head,.6),X-1,Y+1); }
  px(x,shade(head,1.3),9,3); px(x,shade(head,1.3),10,4);
  px(x,[60,60,70],5,0);
  if (level === 4){ px(x,[255,200,255],14,8); px(x,[255,200,255],5,0); }
  return c;
}

// ---------- miner sprite (auto-outlined) ----------
const MPAL = { Y:[242,194,49], y:[184,135,26], L:[255,251,208], s:[240,180,138], S:[200,138,102], e:[26,16,32], m:[107,58,28],
  r:[192,57,43], R:[142,42,32], b:[58,95,168], B:[39,66,122], k:[92,60,34], K:[58,36,20], w:[210,210,220] };
const M_TOP = [
  "....YYYY....",
  "...YYYYYYY..",
  "..YYYYYYYYL.",
  ".yyyyyyyyyy.",
  "...ssssesS..",
  "...ssmmmmS..",
  "....sssss...",
  "...rbrrrbr..",
  "..rrbbbbbrr.",
  "..sRbbwbbRs.",
  "...bbBbbb...",
  "...bbbbbb...",
];
const M_LEGS = {
  stand: ["...bb..bb...","...bb..bb...","...kk..kk...","...KKk.KKk.."],
  a:     ["..bb....bb..","..bb....bb..",".kk......kk.",".KKk.....KKk"],
  b:     ["....bbbb....","....bbb.....","....kkk.....","....KKkk...."],
  jump:  ["..bbb..bbb..",".bb.....bb..",".kk.....kk..",".KKk....KKk."],
};
function spriteFrom(rows, pal = MPAL, outline = '#140c1a'){
  const w = rows[0].length + 2, h = rows.length + 2;
  const [c, x] = mkCanvas(w, h);
  const on = (i,j) => j>=0 && j<rows.length && i>=0 && i<rows[0].length && rows[j][i] !== '.';
  x.fillStyle = outline;
  for (let j=-1;j<=rows.length;j++) for (let i=-1;i<=rows[0].length;i++)
    if (!on(i,j) && (on(i-1,j)||on(i+1,j)||on(i,j-1)||on(i,j+1))) x.fillRect(i+1, j+1, 1, 1);
  for (let j=0;j<rows.length;j++) for (let i=0;i<rows[0].length;i++){ const ch = rows[j][i]; if (ch !== '.') px(x, pal[ch], i+1, j+1); }
  return c;
}
function flipped(src){ const [c, x] = mkCanvas(src.width, src.height); x.translate(src.width, 0); x.scale(-1, 1); x.drawImage(src, 0, 0); return c; }

function buildArt(){
  const rock = [T.DIRT, T.GRASS, T.STONE, T.GRANITE, T.BASALT, T.BEDROCK, T.GRAVEL, T.RUBBLE];
  for (const id of rock){ TEX[id] = [0,1,2,3].map(() => rockTex(id)); DARK[id] = TEX[id].map(darkWall); }
  // grass: dirt with a green cap
  TEX[T.GRASS] = TEX[T.GRASS].map(t => {
    const [c, x] = mkCanvas(TS, TS); x.drawImage(t, 0, 0);
    for (let X=0;X<TS;X++){ const h = 3 + (texR()*3|0); x.fillStyle = '#4a9a32'; x.fillRect(X, 0, 1, h); x.fillStyle = '#5fb83e'; x.fillRect(X, 0, 1, h-1); x.fillStyle = '#2f6e22'; x.fillRect(X, h, 1, 1); }
    x.fillStyle = '#8ee05e'; for (let i=0;i<5;i++) x.fillRect(texR()*TS|0, 0, 1, 1);
    return c;
  });
  for (const [id] of ORES) ORE_TEX[id] = [0,1,2].map(() => oreTex(id));
  CRACK = [0,1,2,3].map(crackTex);
  TUFTS = [0,1,2,3,4,5].map(tuftTex);
  PROP.ladder = ladderTex(); PROP.support = supportTex(); PROP.torch = torchTex(); PROP.platform = platformTex(); PROP.post = postTex(); ICON.post = PROP.post;
  ICON.ladder = PROP.ladder; ICON.support = PROP.support; ICON.medkit = medkitTex();
  { const [c, x] = mkCanvas(TS, TS); x.drawImage(PROP.platform, 0, 5); ICON.platform = c; }
  { const [c, x] = mkCanvas(TS, TS); x.drawImage(PROP.torch, 0, 0); px(x,[255,122,26],6,2,4,4); px(x,[255,224,102],7,3,2,2); ICON.torch = c; }
  const frames = ['stand','a','stand','b','jump'].map(k => spriteFrom([...M_TOP, ...M_LEGS[k]]));
  MINER = frames.map(f => [f, flipped(f)]);
  PICK_SPR = PICKS.map((_, i) => makePick(i));
  buildEnemyArt();
  buildSheets();
  PROP.chest = chestTex(); ICON.dynamite = dynamiteTex(); ICON.beacon = beaconTex(); PROP.dynamite = ICON.dynamite;
}

// ---------- enemies ----------
function silhouette(src, col = '#ffffff'){
  const [c, x] = mkCanvas(src.width, src.height);
  x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
  return c;
}
function withFx(src){ return { r:src, l:flipped(src), w:silhouette(src) }; }
const BAT = [[
  "k..........k",
  "kk........kk",
  "kkK.kkkk.Kkk",
  ".kkKkkkkKkk.",
  "..kkrkkrkk..",
  "...kkffkk...",
  "....k..k....",
],[
  "............",
  "....kkkk....",
  "...kkkkkk...",
  ".kkKrkkrKkk.",
  "kkkkkffkkkkk",
  "kK..kkkk..Kk",
  "k....kk....k",
]];
const SLIME = [
  "....gggg....",
  "..gggggggg..",
  ".ggHHgggggg.",
  "ggHggggggggg",
  "gggweggwegg.",
  "gggggggggggg",
  "ggggdddggggg",
  "gggggggggggg",
  ".dggggggggd.",
  "..dddddddd..",
];
const CRAWLER = [[
  "....bbbbbb....",
  "..bbHHbbbbbb..",
  ".bHHbbbbbbbbbb",
  "bbbbbbbbbbbrbb",
  "bbbbbbbbbbbbbb",
  ".dddddddddddd.",
  ".l.l..l.l..l.l",
],[
  "....bbbbbb....",
  "..bbHHbbbbbb..",
  ".bHHbbbbbbbbbb",
  "bbbbbbbbbbbrbb",
  "bbbbbbbbbbbbbb",
  ".dddddddddddd.",
  "l.l..l.l..l.l.",
]];
const GOLEM_TOP = [
  "....dddddddd....",
  "...dgGGGggggd...",
  "..dgGggggggggd..",
  "..dggeggggeggd..",
  "..dgggggggggmd..",
  "...dgddddddgd...",
  ".ddgGGgggggggdd.",
  "dgGGgggmgggggggd",
  "dgGgggggggggggmd",
  "dggggggggggggggd",
  "dgd.dggggggd.dgd",
  "dgd.dggggggd.dgd",
  "ddd.dgggmggd.ddd",
  "....dggggggd....",
  "....dggddggd....",
];
const GOLEM_LEGS = [
  ["....dgd..dgd....", "...ddgd..dgdd...", "...dddd..dddd..."],
  ["...dgd....dgd...", "..ddgd....dgdd..", "..dddd....dddd.."],
];
const SPIDER = [[
  "l.l......l.l",
  ".l.l.kk.l.l.",
  "..lkkKKkkl..",
  "llkkKkkkkkll",
  "..kkrkkrkk..",
  ".lkkkkkkkkl.",
  "l.l.kkkk.l.l",
  "l..l....l..l",
],[
  "..l......l..",
  ".l.l.kk.l.l.",
  "..lkkKKkkl..",
  "llkkKkkkkkll",
  "..kkrkkrkk..",
  ".lkkkkkkkkl.",
  ".l.l.kkkk.l.",
  ".l...ll...l.",
]];
const GHOST_TOP = [
  "....YYYY....",
  "...YYYYYY...",
  "..yyyyyyyy..",
  "..gggggggg..",
  ".ggeggggegg.",
  ".gggggggggg.",
  ".ggggmmgggg.",
  ".gggggggggg.",
  "gggggggggggg",
  "gggggggggggg",
  "ggGggggggGgg",
  "gggggggggggg",
];
const GHOST_TAIL = [["g.gg.gg.gg.g", "...g..g..g.."], ["gg.gg.gg.gg.", "..g..g..g..."]];
const BEETLE = [[
  "...rrrrrr...",
  "..rRRrrrrr..",
  ".rRrrrrrrrr.",
  "rrrrrrrrrryr",
  "rrrrrrrrrrrr",
  ".dddddddddd.",
  ".l.l.l..l.l.",
],[
  "...rrrrrr...",
  "..rRRrrrrr..",
  ".rRrrrrrrrr.",
  "rrrrrrrrrryr",
  "rrrrrrrrrrrr",
  ".dddddddddd.",
  "l.l.l..l.l..",
]];
function buildEnemyArt(){
  ESPR.spider = SPIDER.map(f => withFx(spriteFrom(f, { k:[40,30,52], K:[96,76,120], r:[255,60,60], l:[70,56,84] })));
  ESPR.ghost = GHOST_TAIL.map(t => withFx(spriteFrom([...GHOST_TOP, ...t], { Y:[200,220,255], y:[150,170,215], g:[190,220,255], G:[140,170,225], e:[20,20,60], m:[60,70,120] }, '#3a4a78')));
  ESPR.beetle = BEETLE.map(f => withFx(spriteFrom(f, { r:[190,50,40], R:[245,130,100], d:[60,20,20], y:[255,220,80], l:[50,30,30] })));
  const gPal = { d:[58,54,52], g:[118,112,106], G:[160,154,146], e:[255,150,50], m:[86,140,64] };
  ESPR.golem = GOLEM_LEGS.map(l => withFx(spriteFrom([...GOLEM_TOP, ...l], gPal, '#100c0c')));
  const batPal = { k:[74,52,96], K:[120,92,150], r:[255,70,60], f:[240,240,240] };
  ESPR.bat = BAT.map(f => withFx(spriteFrom(f, batPal)));
  const slimeCols = [ [[86,200,70],[190,255,150],[40,110,40]], [[70,140,230],[180,220,255],[30,60,130]], [[220,70,70],[255,180,170],[120,30,30]] ];
  ESPR.slime = slimeCols.map(([g,H,d]) => withFx(spriteFrom(SLIME, { g, H, d, w:[255,255,255], e:[20,10,20] })));
  const crPal = { b:[70,78,118], H:[140,156,210], d:[34,32,52], r:[255,200,60], l:[40,40,60] };
  ESPR.crawler = CRAWLER.map(f => withFx(spriteFrom(f, crPal)));
}
function chestTex(){
  const [c, x] = mkCanvas(TS, TS);
  const w = [150,98,48], dk = [92,56,24], lt = [196,140,76], gold = [246,196,40], gd = [170,120,20];
  px(x,[20,12,8],1,4,14,12);
  px(x,w,2,5,12,10); px(x,lt,2,5,12,1); px(x,dk,2,9,12,1); px(x,dk,2,14,12,1);
  px(x,lt,2,10,12,1);
  px(x,gold,2,5,1,10); px(x,gold,13,5,1,10); px(x,gd,2,9,12,1);
  px(x,gold,7,8,2,3); px(x,[40,24,8],7,10,2,1); px(x,[255,250,200],7,8,1,1);
  return c;
}
function dynamiteTex(){
  const [c, x] = mkCanvas(TS, TS);
  for (let k=0;k<3;k++){ px(x,[190,40,34],3+k*3,6,3,9); px(x,[230,80,70],3+k*3,6,1,9); }
  px(x,[240,220,180],3,9,9,2); px(x,[60,40,30],7,3,1,3); px(x,[255,200,80],8,2,1,1);
  return c;
}
function beaconTex(){
  const [c, x] = mkCanvas(TS, TS);
  px(x,[60,60,70],5,11,6,4); px(x,[100,100,116],5,11,6,1);
  px(x,[80,200,255],6,4,4,7); px(x,[200,245,255],6,4,1,7); px(x,[40,120,200],9,4,1,7);
  px(x,[255,255,255],7,2,2,2);
  return c;
}

// ============================================================
//  World-space texture sheets: one big seamless texture per
//  material, sampled by world position, so rock flows across
//  tile edges instead of repeating 16x16 stamps.
// ============================================================
const SHEET_SIZE = 384;                         // 24 x 24 tiles before anything repeats
const SHEET = {}, DSHEET = {};
let GRASS_STRIP = null;

function tileNoise(size, cell, rng){
  const g = Math.round(size/cell), grid = new Float32Array(g*g);
  for (let i=0;i<grid.length;i++) grid[i] = rng();
  return (x, y) => {
    const fx = x/cell, fy = y/cell, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
    const sx = tx*tx*(3-2*tx), sy = ty*ty*(3-2*ty);
    const x0 = ((ix % g) + g) % g, x1 = (x0 + 1) % g, y0 = ((iy % g) + g) % g, y1 = (y0 + 1) % g;
    return lerp(lerp(grid[y0*g+x0], grid[y0*g+x1], sx), lerp(grid[y1*g+x0], grid[y1*g+x1], sx), sy);
  };
}
function makeSheet(id){
  const S = SHEET_SIZE, col = DEF[id].col, pal = pal5(col), r = mulberry32(4000 + id*17);
  const [c, x] = mkCanvas(S, S);
  const n1 = tileNoise(S, 48, r), n2 = tileNoise(S, 16, r), n3 = tileNoise(S, 4, r);
  const img = x.createImageData(S, S), d = img.data;
  for (let y=0;y<S;y++) for (let X=0;X<S;X++){
    const n = n1(X,y)*.42 + n2(X,y)*.36 + n3(X,y)*.22 + (r()-.5)*.08;
    const k = n < .33 ? 0 : n < .47 ? 1 : n < .63 ? 2 : 3, cc = pal[k], o = (y*S + X)*4;
    d[o] = cc[0]; d[o+1] = cc[1]; d[o+2] = cc[2]; d[o+3] = 255;
  }
  x.putImageData(img, 0, 0);
  // draw a feature and its wrapped copies so the sheet stays seamless
  const wrap = (X, Y, w, h, fn) => { for (const ox of [0, -S, S]) for (const oy of [0, -S, S]){ const a = X+ox, b = Y+oy; if (a+w > 0 && b+h > 0 && a < S && b < S) fn(a, b); } };
  const R = () => r()*S|0;
  const peb = (p, w, h) => { const X = R(), Y = R(); wrap(X, Y, w, h+1, (a, b) => pebble(x, p, a, b, w, h)); };
  const crack = (len, cpal) => { let X = R(), Y = R(), dx = r() < .5 ? 1 : -1; for (let k=0;k<len;k++){ wrap(X, Y, 1, 1, (a, b) => px(x, cpal, a, b)); if (r() < .6) Y++; else X += dx; if (r() < .1) dx = -dx; } };
  switch (id){
    case T.DIRT:
      for (let i=0;i<700;i++) peb(pal5([140,120,100]), 3, 2);
      for (let i=0;i<1400;i++){ const X = R(), Y = R(); wrap(X, Y, 2, 1, (a, b) => px(x, pal[0], a, b, 1 + (r()*2|0), 1)); }
      for (let i=0;i<160;i++){ let X = R(), Y = R(); const len = 4 + (r()*8|0); for (let k=0;k<len;k++){ wrap(X, Y, 1, 1, (a, b) => px(x, [90,60,36], a, b)); Y++; if (r() < .4) X += r() < .5 ? 1 : -1; } }
      break;
    case T.STONE:
      for (let i=0;i<900;i++) peb(pal, 4 + (r()*3|0), 3 + (r()*2|0));
      for (let i=0;i<260;i++) crack(6 + (r()*14|0), pal[0]);
      break;
    case T.GRANITE:
      for (let i=0;i<7000;i++){ const X = R(), Y = R(); px(x, [[236,214,204],[58,40,40],[196,140,130],[250,236,230]][i%4], X, Y); }
      for (let i=0;i<450;i++) peb(pal, 4, 3);
      for (let i=0;i<120;i++) crack(8 + (r()*10|0), pal[0]);
      break;
    case T.BASALT: {
      // irregular vertical columns instead of a grid of seams
      let X = 0;
      while (X < S){
        const w = 6 + (r()*8|0);
        let Y = r()*S|0;
        for (let k=0;k<S;k++){ if (r() < .9){ px(x, pal[0], (X + S) % S, (Y + k) % S); px(x, pal[3], (X + 1) % S, (Y + k) % S); } }
        for (let j=0;j<S/20;j++){ const yy = r()*S|0; px(x, pal[0], X % S, yy, w, 1); px(x, pal[3], X % S, (yy+1) % S, w, 1); }   // horizontal joints
        X += w;
      }
      for (let i=0;i<1600;i++) px(x, [120,110,160], R(), R());
      break;
    }
    case T.BEDROCK:
      for (let i=0;i<900;i++){ let X = R(), Y = R(); for (let k=0;k<4;k++){ wrap(X, Y, 2, 1, (a, b) => px(x, pal[4], a, b, 2, 1)); X += 2; Y += r() < .5 ? 1 : -1; } }
      break;
    case T.GRAVEL: case T.RUBBLE:
      for (let i=0;i<4200;i++) peb(pal5(shade(col, .8 + r()*.5)), 3 + (r()*2|0), 3);
      break;
  }
  return c;
}
function buildSheets(){
  for (const id of [T.DIRT, T.STONE, T.GRANITE, T.BASALT, T.BEDROCK, T.GRAVEL, T.RUBBLE]){
    SHEET[id] = makeSheet(id);
    const [c, x] = mkCanvas(SHEET_SIZE, SHEET_SIZE);
    x.drawImage(SHEET[id], 0, 0); x.fillStyle = 'rgba(10,7,18,.74)'; x.fillRect(0, 0, SHEET_SIZE, SHEET_SIZE);
    DSHEET[id] = c;
  }
  SHEET[T.GRASS] = SHEET[T.DIRT]; DSHEET[T.GRASS] = DSHEET[T.DIRT];
  // one continuous grass cap along the whole surface
  const [g, gx] = mkCanvas(SHEET_SIZE, 8), r = mulberry32(777);
  for (let X=0;X<SHEET_SIZE;X++){
    const h = clamp(Math.round(4 + Math.sin(X*.21)*1.2 + Math.sin(X*.047 + 1)*1 + (r()-.5)*1.6), 2, 7);
    gx.fillStyle = '#4a9a32'; gx.fillRect(X, 0, 1, h);
    gx.fillStyle = '#5fb83e'; gx.fillRect(X, 0, 1, h-1);
    gx.fillStyle = '#2f6e22'; gx.fillRect(X, h, 1, 1);
    if (r() < .15){ gx.fillStyle = '#8ee05e'; gx.fillRect(X, 0, 1, 1); }
    if (r() < .06){ gx.fillStyle = '#3d7a2a'; gx.fillRect(X, h, 1, 2); }             // roots poking into the dirt
  }
  GRASS_STRIP = g;
}
