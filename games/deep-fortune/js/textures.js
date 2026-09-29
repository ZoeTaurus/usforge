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
  const wood = [134,90,46], dk = [70,44,20], lt = [178,126,70], rope = [214,196,150];
  px(x,[0,0,0],5,0,1,TS); x.clearRect(5,0,1,TS);
  x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(4, 0, 1, TS); x.fillRect(14, 0, 1, TS);        // shadow on the wall behind
  for (const X of [2, 11]){ px(x,dk,X,0,3,TS); px(x,wood,X+1,0,1,TS); px(x,lt,X,0,1,TS); px(x,dk,X+1,5,1,2); px(x,dk,X+1,12,1,1); }
  for (let k=2;k<TS;k+=5){
    px(x,dk,3,k+2,10,1); px(x,wood,3,k,10,2); px(x,lt,3,k,10,1);                           // rung
    px(x,rope,2,k,1,2); px(x,rope,4,k+1,1,1); px(x,rope,11,k+1,1,1); px(x,rope,13,k,1,2);  // lashings
  }
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
// support pieces that join into a heavy timber frame:
//   top    = header beam + knee braces against the roof
//   middle = X cross-brace + tie beam where sections meet
//   bottom = stone footings under the posts
function supportPiece(top, bottom){
  const [c, x] = mkCanvas(TS, TS);
  const wood = [150,98,48], dk = [84,52,22], lt = [198,144,80], ol = [40,24,10], iron = [70,70,82], ironLt = [140,140,152];
  // a 2px-thick diagonal timber with a dark edge underneath
  const brace = (x0, y0, x1, y1) => {
    const n = Math.max(Math.abs(x1-x0), Math.abs(y1-y0));
    for (let k=0;k<=n;k++){ const X = Math.round(x0 + (x1-x0)*k/n), Y = Math.round(y0 + (y1-y0)*k/n); px(x,ol,X,Y+1,2,1); px(x,wood,X,Y,2,1); px(x,lt,X,Y,1,1); }
  };
  const bolt = (X, Y) => { px(x,iron,X,Y,2,2); px(x,ironLt,X,Y,1,1); };
  // cross-bracing first so the posts sit on top of it
  if (!top){
    px(x,ol,3,0,10,3); px(x,wood,3,0,10,2); px(x,lt,3,0,10,1);          // tie beam where this section meets the one above
    brace(4, 3, 10, bottom ? 10 : 13); brace(10, 3, 4, bottom ? 10 : 13);
    bolt(7, bottom ? 6 : 7);
  } else {
    brace(4, 11, 7, 6); brace(10, 11, 7, 6);                              // knee braces up into the header
  }
  // two stout posts with grain and bolts
  for (const X of [0, 12]){
    px(x,ol,X,0,4,TS); px(x,wood,X+1,0,2,TS); px(x,lt,X+1,0,1,TS); px(x,dk,X+3,0,1,TS);
    px(x,dk,X+2,4,1,2); px(x,dk,X+1,10,1,2);
    bolt(X+1, top ? 6 : 3);
  }
  if (top){
    px(x,ol,0,0,TS,6); px(x,wood,0,1,TS,4); px(x,lt,0,1,TS,1); px(x,dk,0,4,TS,1);   // header beam
    px(x,dk,5,2,1,2); px(x,dk,10,2,1,2);
    for (const X of [0, 12]){ px(x,iron,X,1,4,4); px(x,ironLt,X,1,4,1); px(x,[30,30,36],X+1,2,1,1); px(x,[30,30,36],X+2,3,1,1); }   // iron corner plates
  }
  if (bottom){
    px(x,ol,3,10,10,3); px(x,wood,3,10,10,2); px(x,lt,3,10,10,1);         // sill beam
    for (const X of [0, 11]){ px(x,[34,32,38],X,12,5,4); px(x,[104,100,110],X,12,5,3); px(x,[140,136,146],X,12,5,1); px(x,[80,76,86],X+2,13,1,2); }   // stone footings
  }
  return c;
}
function torchTex(){
  const [c, x] = mkCanvas(TS, TS);
  px(x,[46,46,54],5,9,6,3); px(x,[86,86,98],5,9,6,1);                     // wall bracket
  px(x,[70,44,20],7,7,2,8); px(x,[134,90,46],7,7,1,8);                    // handle
  px(x,[46,46,54],5,5,6,3); px(x,[110,110,124],5,5,6,1); px(x,[30,30,36],6,7,4,1);   // iron cup
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
  const rock = [T.DIRT, T.GRASS, T.STONE, T.GRANITE, T.BASALT, T.BEDROCK, T.GRAVEL, T.RUBBLE, T.OBSIDIAN];
  for (const id of rock){ TEX[id] = [0,1,2,3].map(() => rockTex(id)); DARK[id] = TEX[id].map(darkWall); }
  // grass: dirt with a green cap
  TEX[T.GRASS] = TEX[T.GRASS].map(t => {
    const [c, x] = mkCanvas(TS, TS); x.drawImage(t, 0, 0);
    for (let X=0;X<TS;X++){ const h = 3 + (texR()*3|0); x.fillStyle = '#4a9a32'; x.fillRect(X, 0, 1, h); x.fillStyle = '#5fb83e'; x.fillRect(X, 0, 1, h-1); x.fillStyle = '#2f6e22'; x.fillRect(X, h, 1, 1); }
    x.fillStyle = '#8ee05e'; for (let i=0;i<5;i++) x.fillRect(texR()*TS|0, 0, 1, 1);
    return c;
  });
  for (const [id] of ORES) ORE_TEX[id] = [0,1,2].map(() => oreTex(id));
  ORE_TEX[T.FOSSIL] = [0,1,2].map(fossilTex);
  buildDecorArt();
  CRACK = [0,1,2,3].map(crackTex);
  TUFTS = [0,1,2,3,4,5].map(tuftTex);
  PROP.ladder = ladderTex(); PROP.support = supportTex(); PROP.torch = torchTex(); PROP.platform = platformTex(); PROP.supTop = supportPiece(true, false); PROP.supMid = supportPiece(false, false); PROP.supBase = supportPiece(false, true); PROP.supSingle = supportPiece(true, true); PROP.post = postTex(); ICON.post = PROP.post;
  ICON.ladder = PROP.ladder; ICON.support = PROP.support; ICON.medkit = medkitTex();
  { const [c, x] = mkCanvas(TS, TS); x.drawImage(PROP.platform, 0, 5); ICON.platform = c; }
  { const [c, x] = mkCanvas(TS, TS); x.drawImage(PROP.torch, 0, 0); px(x,[255,122,26],6,2,4,4); px(x,[255,224,102],7,3,2,2); ICON.torch = c; }
  const frames = ['stand','a','stand','b','jump'].map(k => spriteFrom([...M_TOP, ...M_LEGS[k]]));
  MINER = frames.map(f => [f, flipped(f)]);
  PICK_SPR = PICKS.map((_, i) => makePick(i));
  buildEnemyArt();
  buildSheets();
  buildScenery();
  buildBackdrop();
  PROP.chest = chestTex(0); PROP.chests = [0,1,2].map(chestTex); ICON.dynamite = dynamiteTex(); ICON.beacon = beaconTex(); PROP.dynamite = ICON.dynamite;
  ICON.scanner = (() => { const [c, x] = mkCanvas(TS, TS); px(x,[40,40,52],3,3,10,11); px(x,[70,70,86],3,3,10,1); px(x,[20,60,40],5,5,6,5); px(x,[120,255,180],7,7,2,1); px(x,[120,255,180],6,8,1,1); px(x,[120,255,180],9,6,1,1); px(x,[220,60,60],11,12,1,1); px(x,[90,90,104],7,1,1,2); return c; })();
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
// treasure chests: 0 = wood, 1 = iron-banded, 2 = gold
function chestTex(tier = 0){
  const [c, x] = mkCanvas(TS, TS);
  const body = [[150,98,48],[96,86,90],[196,150,40]][tier], dk = shade(body, .6), lt = shade(body, 1.3);
  const band = [[246,196,40],[60,58,66],[255,238,150]][tier], bandDk = shade(band, .65);
  px(x,[20,12,8],1,3,14,13);                                   // outline
  px(x,body,2,4,12,11); px(x,lt,2,4,12,1);
  px(x,dk,2,4,12,1); px(x,lt,3,4,10,1);                        // curved lid top
  px(x,dk,2,8,12,1);                                           // lid seam
  for (let X=4; X<13; X+=3) px(x,dk,X,10,1,4);                 // planks
  for (const X of [2, 13]){ px(x,band,X,4,1,11); }
  px(x,band,2,8,12,1); px(x,bandDk,2,9,12,1);
  px(x,band,6,7,4,5); px(x,bandDk,6,11,4,1); px(x,[30,20,10],7,9,2,2); px(x,[255,255,230],6,7,1,1);   // lock
  if (tier === 2){ px(x,[255,255,255],4,5,1,1); px(x,[255,255,255],11,12,1,1); }
  return c;
}
function dynamiteTex(){
  const [c, x] = mkCanvas(TS, TS);
  for (let k=0;k<3;k++){
    const X = 3 + k*3;
    px(x,[110,20,20],X,6,3,9); px(x,[196,48,40],X,6,2,9); px(x,[236,98,86],X,6,1,9);   // paper-wrapped sticks
    px(x,[80,14,14],X,6,3,1);
  }
  px(x,[230,220,190],3,9,9,3); px(x,[250,244,220],3,9,9,1); px(x,[40,30,30],4,10,1,1); px(x,[40,30,30],6,10,1,1); px(x,[40,30,30],8,10,1,1);   // tape band + "TNT"
  px(x,[60,44,30],7,3,1,3); px(x,[60,44,30],8,2,2,1); px(x,[60,44,30],10,1,1,2);        // coiled fuse
  px(x,[255,220,120],11,0,1,1);
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
    case T.OBSIDIAN:                                            // glassy volcanic rock with sharp purple glints
      for (let i=0;i<500;i++){ let X = R(), Y = R(); const len = 3 + (r()*6|0); for (let k=0;k<len;k++){ wrap(X, Y, 1, 1, (a, b) => px(x, k === 0 ? [190,150,255] : [110,80,160], a, b)); X++; Y += r() < .5 ? 1 : 0; } }
      for (let i=0;i<900;i++) px(x, [20,12,30], R(), R());
      break;
    case T.GRAVEL: case T.RUBBLE:
      for (let i=0;i<4200;i++) peb(pal5(shade(col, .8 + r()*.5)), 3 + (r()*2|0), 3);
      break;
  }
  return c;
}
function buildSheets(){
  for (const id of [T.DIRT, T.STONE, T.GRANITE, T.BASALT, T.BEDROCK, T.GRAVEL, T.RUBBLE, T.OBSIDIAN]){
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

// ============================================================
//  Surface scenery: shaded pixel trees, bushes and clouds
// ============================================================
const TREES = { oak:[], pine:[], birch:[], bush:[] }, TREES_BACK = { oak:[], pine:[], birch:[] };
let CLOUD_ART = [], CLOUD_DARK = [];
// a copy of an image tinted by a translucent colour (only where it has pixels)
function tinted(src, col){ const [c, x] = mkCanvas(src.width, src.height); x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height); return c; }
// fill a round leafy blob, lit from the upper left, with leaf-cluster dithering
function leafBlob(x, pal, cx, cy, rx, ry, r){
  for (let y=Math.floor(cy-ry); y<=cy+ry; y++) for (let X=Math.floor(cx-rx); X<=cx+rx; X++){
    const nx = (X - cx)/rx, ny = (y - cy)/ry, d = nx*nx + ny*ny;
    if (d > 1 - r()*.18) continue;
    let light = (-nx*.55 - ny*.85)*.5 + .5 - d*.25 + (r() - .5)*.35;
    const k = clamp(Math.floor(light * pal.length), 0, pal.length - 1);
    px(x, pal[k], X, y);
  }
}
function makeOak(seed){
  const r = mulberry32(seed), W = 46, H = 60, [c, x] = mkCanvas(W, H), cx = W/2;
  const bark = [[58,36,20],[82,52,28],[112,74,40]];
  // trunk with a flared base, roots and bark
  for (let y=26; y<H; y++){ const w = 5 + (y > H-6 ? (y - (H-6)) : 0); for (let i=0;i<w;i++){ const X = Math.round(cx - w/2 + i); px(x, bark[i === 0 ? 0 : i === w-1 ? 0 : (r() < .25 ? 2 : 1)], X, y); } }
  px(x, bark[0], cx - 7, H-2, 3, 2); px(x, bark[0], cx + 4, H-2, 3, 2);
  // a couple of branches
  for (let k=0;k<6;k++){ px(x, bark[1], cx - 3 - k, 30 - k, 2, 1); px(x, bark[1], cx + 2 + k, 28 - k, 2, 1); }
  const pal = [[26,66,32],[36,92,40],[52,120,50],[78,150,62],[124,190,92]];
  const blobs = 5 + (r()*3|0);
  leafBlob(x, pal, cx, 18, 17, 13, r);
  for (let i=0;i<blobs;i++) leafBlob(x, pal, cx + (r() - .5)*26, 10 + r()*18, 7 + r()*5, 6 + r()*4, r);
  if (r() < .5) for (let i=0;i<6;i++) px(x, [196,54,48], (cx - 14 + r()*28)|0, (8 + r()*20)|0, 2, 2);   // apples
  return c;
}
function makePine(seed){
  const r = mulberry32(seed), W = 34, H = 66, [c, x] = mkCanvas(W, H), cx = W/2;
  px(x, [58,36,20], cx - 2, H - 14, 4, 14); px(x, [90,58,30], cx - 1, H - 14, 1, 14);
  const pal = [[16,52,36],[24,78,46],[34,100,56],[52,126,70]];
  const tiers = 5 + (r()*2|0);
  for (let t=0; t<tiers; t++){
    const top = 2 + t*9, h = 16, half = 5 + t*2.2;
    for (let y=0;y<h;y++){
      const w = (y/h)*half + (r() - .5)*1.5;
      for (let X=Math.floor(cx - w); X<=cx + w; X++){
        const side = (X - cx)/Math.max(1, w), k = clamp(Math.floor((.55 - side*.45 - y/h*.25 + (r() - .5)*.3) * pal.length), 0, pal.length - 1);
        px(x, pal[k], X, top + y);
      }
    }
  }
  return c;
}
function makeBirch(seed){
  const r = mulberry32(seed), W = 34, H = 58, [c, x] = mkCanvas(W, H), cx = W/2;
  for (let y=20; y<H; y++){ px(x, [226,222,210], cx - 2, y, 4, 1); px(x, [178,174,166], cx + 1, y, 1, 1); if (r() < .18) px(x, [40,36,34], cx - 2 + (r()*3|0), y, 2, 1); }
  const pal = [[58,104,34],[86,140,48],[118,176,62],[160,210,96]];
  leafBlob(x, pal, cx, 16, 12, 14, r);
  for (let i=0;i<4;i++) leafBlob(x, pal, cx + (r() - .5)*16, 8 + r()*18, 5 + r()*3, 5 + r()*3, r);
  return c;
}
function makeBush(seed){
  const r = mulberry32(seed), [c, x] = mkCanvas(26, 14);
  const pal = [[30,76,34],[44,104,42],[66,134,54],[104,170,76]];
  leafBlob(x, pal, 13, 9, 12, 6, r); leafBlob(x, pal, 8, 8, 6, 5, r); leafBlob(x, pal, 18, 7, 6, 5, r);
  if (r() < .6) for (let i=0;i<4;i++) px(x, [[255,120,150],[255,220,90],[240,240,255]][seed % 3], (3 + r()*20)|0, (4 + r()*6)|0, 1, 1);
  return c;
}
// puffy clouds with a lit top and a shaded belly
function makeCloud(seed){
  const r = mulberry32(seed), W = 70 + (r()*40|0), H = 30, [c, x] = mkCanvas(W, H);
  const puffs = [];
  for (let i=0;i<6;i++) puffs.push([10 + r()*(W-20), 14 + r()*6, 7 + r()*9]);
  for (let y=0;y<H;y++) for (let X=0;X<W;X++){
    let inside = false, top = 1;
    for (const [pxX, pyY, pr] of puffs){ const d = Math.hypot(X - pxX, (y - pyY)*1.2); if (d < pr){ inside = true; top = Math.min(top, (y - (pyY - pr))/(pr*2)); } }
    if (!inside || y > 24) continue;
    const shadeK = y > 20 ? 0 : top < .25 ? 3 : top < .6 ? 2 : 1;
    px(x, [[196,208,226],[226,234,244],[244,248,252],[255,255,255]][shadeK], X, y);
  }
  return c;
}
function buildScenery(){
  for (let i=0;i<4;i++){ TREES.oak.push(makeOak(100+i)); TREES.pine.push(makePine(200+i)); TREES.birch.push(makeBirch(300+i)); TREES.bush.push(makeBush(400+i)); }
  CLOUD_ART = [0,1,2,3,4,5].map(i => makeCloud(500 + i));
  CLOUD_DARK = CLOUD_ART.map(c => tinted(c, 'rgba(60,70,90,.6)'));
  for (const k of ['oak','pine','birch']) TREES_BACK[k] = TREES[k].map(c => tinted(c, 'rgba(90,130,150,.28)'));
}

// ============================================================
//  Parallax backdrop: seamless pixel-art panoramas
// ============================================================
const BG_W = 1536;                                   // every layer wraps seamlessly at this width
const BACKDROP = { sky:null, layers:[] };
// a seamless height profile: sums of whole-number sine waves, some "ridged" for sharp peaks
function profile(seed, base, amps){
  const r = mulberry32(seed), waves = amps.map(([k, a, ridged]) => ({ k, a, ridged, ph: r()*Math.PI*2 }));
  const h = new Float32Array(BG_W);
  for (let x=0;x<BG_W;x++){
    let v = base;
    for (const w of waves){ const s = Math.sin(x/BG_W*Math.PI*2*w.k + w.ph); v += w.ridged ? (1 - Math.abs(s))*w.a : s*w.a; }
    h[x] = v;
  }
  return h;
}
const mix3 = (a, b, t) => [a[0] + (b[0]-a[0])*t, a[1] + (b[1]-a[1])*t, a[2] + (b[2]-a[2])*t];
function buildBackdrop(){
  // ----- sky: banded, dithered gradient (1 px wide, stretched) -----
  { const H = 320, W = 8, [c, x] = mkCanvas(W, H);             // an 8px-wide tile, repeated across the screen
    const stops = [[0,[34,74,172]],[.45,[70,130,214]],[.75,[128,186,236]],[1,[200,232,246]]];
    const B4 = [0,8,2,10, 12,4,14,6, 3,11,1,9, 15,7,13,5];      // 4x4 ordered dither
    for (let y=0;y<H;y++) for (let X=0;X<W;X++){
      const t = y/(H-1); let i = 0; while (i < stops.length-2 && t > stops[i+1][0]) i++;
      const lt = (t - stops[i][0])/(stops[i+1][0] - stops[i][0]), bands = 5, q = lt*bands, lo = Math.floor(q), fr = q - lo;
      const pick = fr*16 > B4[(y % 4)*4 + (X % 4)] ? lo + 1 : lo;
      px(x, mix3(stops[i][1], stops[i+1][1], Math.min(1, pick/bands)).map(Math.round), X, y);
    }
    BACKDROP.sky = c; }

  // ----- far mountains: jagged peaks, lit/shaded faces, snowcaps -----
  const mk = (H, fn) => { const [c, x] = mkCanvas(BG_W, H); const img = x.createImageData(BG_W, H); fn(img.data, H); x.putImageData(img, 0, 0); return c; };
  const put = (d, X, Y, col, H) => { if (Y < 0 || Y >= H) return; const o = (Y*BG_W + X)*4; d[o] = col[0]; d[o+1] = col[1]; d[o+2] = col[2]; d[o+3] = 255; };
  const haze = [196,222,240];
  { const H = 170, h = profile(11, 70, [[2,24],[3,18,true],[5,16,true],[9,9,true],[17,5,true],[31,2.5],[61,1.2]]), r = mulberry32(12);
    BACKDROP.layers.push({ par:.07, c: mk(H, (d) => {
      for (let X=0;X<BG_W;X++){
        const top = H - h[X], slope = h[(X+1)%BG_W] - h[(X+BG_W-1)%BG_W], lit = slope > .15, peak = h[X] - 70;
        const snowLine = top + Math.max(0, peak*.35 + Math.sin(X*.7)*2 + (r()-.5)*3);
        for (let Y=Math.max(0, Math.floor(top)); Y<H; Y++){
          const depthT = (Y - top)/(H - top + 1);
          let col = lit ? [150,176,206] : [118,144,180];
          if (((Y + Math.floor(X*.35)) % 11) === 0 && r() < .6) col = lit ? [136,162,196] : [104,128,166];   // rock strata
          if (Y < snowLine && peak > 18) col = lit ? [240,246,252] : [198,212,232];
          col = mix3(col, haze, Math.min(1, depthT*1.4)*.75);
          put(d, X, Y, col.map(Math.round), H);
        }
      }
    }) }); }

  // ----- foothills: closer, bluer-green, rounded with little tree specks -----
  { const H = 120, h = profile(21, 48, [[3,14],[5,10,true],[11,6],[23,3],[47,1.5]]), r = mulberry32(22);
    BACKDROP.layers.push({ par:.16, c: mk(H, (d) => {
      for (let X=0;X<BG_W;X++){
        const top = H - h[X], slope = h[(X+1)%BG_W] - h[(X+BG_W-1)%BG_W];
        for (let Y=Math.max(0, Math.floor(top)); Y<H; Y++){
          const depthT = (Y - top)/(H - top + 1);
          let col = slope > 0 ? [104,146,150] : [86,126,136];
          if (Y - top < 1.5) col = [130,170,166];
          if (r() < .05) col = [74,112,120];                                            // distant tree specks
          put(d, X, Y, mix3(col, haze, depthT*.55).map(Math.round), H);
        }
      }
    }) }); }

  // ----- forest hills: a dense pine canopy -----
  { const H = 96, h = profile(31, 34, [[4,10],[7,6],[13,4],[29,2]]), r = mulberry32(32);
    const [c, x] = mkCanvas(BG_W, H);
    // hill body
    for (let X=0;X<BG_W;X++){ const top = Math.floor(H - h[X]); px(x, [58,98,74], X, top, 1, H - top); }
    // pines packed along the ridge, back to front
    for (let pass=0; pass<2; pass++) for (let X=0; X<BG_W; X += 3 + (r()*3|0)){
      const base = H - h[X] + 4 + pass*6 + r()*4, th = 10 + r()*12 - pass*2, dark = pass ? [44,82,58] : [52,92,66], light = pass ? [70,118,82] : [78,124,88];
      for (let j=0;j<th;j++){
        const w = Math.max(1, Math.round((j/th)*4.5 + (j % 3 === 0 ? 1 : 0)));
        for (let i=-w;i<=w;i++){ const XX = (X + i + BG_W) % BG_W; px(x, i < 0 ? light : dark, XX, Math.floor(base - th + j), 1, 1); }
      }
    }
    // soft haze toward the bottom
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(196,222,240,0)'); g.addColorStop(1, 'rgba(196,222,240,.25)');
    x.globalCompositeOperation = 'source-atop'; x.fillStyle = g; x.fillRect(0, 0, BG_W, H);
    BACKDROP.layers.push({ par:.3, c }); }

  // ----- near meadow: rolling grass with round trees and bushes -----
  { const H = 64, h = profile(41, 20, [[3,6],[8,4],[17,2],[37,1]]), r = mulberry32(42);
    const [c, x] = mkCanvas(BG_W, H);
    const leaf = [[40,96,44],[56,122,54],[80,150,66],[118,182,88]];
    for (let X=0; X<BG_W; X += 26 + (r()*60|0)){               // round trees on the ridge
      const top = H - h[X], rr = 5 + r()*5;
      px(x, [70,50,32], X, Math.floor(top - rr*.6), 2, Math.ceil(rr*.8));
      for (let yy=-rr; yy<=rr; yy++) for (let xx=-rr; xx<=rr; xx++){
        if (xx*xx + yy*yy*1.2 > rr*rr) continue;
        const k = clamp(Math.floor(((-xx - yy)/(rr*2) + .5 + (r()-.5)*.3) * 4), 0, 3);
        px(x, leaf[k], (X + xx + BG_W) % BG_W, Math.floor(top - rr*1.3 + yy), 1, 1);
      }
    }
    for (let X=0;X<BG_W;X++){
      const top = Math.floor(H - h[X]);
      px(x, [74,132,64], X, top, 1, H - top); px(x, [104,164,80], X, top, 1, 2);
      if (r() < .25) px(x, [118,180,90], X, top - 1, 1, 1);
      if (r() < .02) px(x, [[255,230,120],[250,250,255],[255,150,170]][r()*3|0], X, top + 1, 1, 1);
    }
    BACKDROP.layers.push({ par:.5, c }); }
}


// ---------- fossils: an ammonite spiral, a fish skeleton, a bone ----------
function fossilTex(v){
  const [c, x] = mkCanvas(TS, TS), bone = [228,214,184], dk = [150,134,104], lt = [252,246,228];
  if (v === 0){
    for (let a=0; a<Math.PI*5; a+=.18){ const r = 1 + a*.55, X = 8 + Math.cos(a)*r, Y = 8 + Math.sin(a)*r*.9; px(x, dk, X+1|0, Y+1|0); px(x, a > 3 ? bone : lt, X|0, Y|0); }
    for (let k=0;k<8;k++){ const a = k*.8 + 2, r = 1 + a*.55; px(x, dk, 8 + Math.cos(a)*r*.6|0, 8 + Math.sin(a)*r*.55|0); }
  } else if (v === 1){
    px(x, bone, 3, 8, 10, 1); px(x, dk, 3, 9, 10, 1);                       // spine
    for (let k=0;k<4;k++){ px(x, bone, 5 + k*2, 5, 1, 3); px(x, bone, 5 + k*2, 9, 1, 3); }
    px(x, bone, 12, 6, 3, 5); px(x, lt, 12, 6, 2, 1); px(x, dk, 13, 8, 1, 1);   // skull
    px(x, bone, 1, 6, 2, 2); px(x, bone, 1, 9, 2, 2);                          // tail
  } else {
    px(x, bone, 5, 6, 7, 3); px(x, lt, 5, 6, 7, 1); px(x, dk, 5, 9, 7, 1);
    px(x, bone, 3, 4, 3, 3); px(x, bone, 3, 8, 3, 3); px(x, bone, 11, 4, 3, 3); px(x, bone, 11, 8, 3, 3);
    px(x, lt, 3, 4, 1, 1); px(x, lt, 11, 4, 1, 1);
  }
  return c;
}

// ---------- cave decorations ----------
const DECOR_SPR = {};
function buildDecorArt(){
  const r = mulberry32(8080);
  const rocks = [T.DIRT, T.STONE, T.GRANITE, T.BASALT];
  // stalactites & stalagmites in each layer's rock colours
  DECOR_SPR.stalac = {}; DECOR_SPR.stalag = {};
  for (const L of rocks){
    const pal = pal5(DEF[L].col);
    DECOR_SPR.stalac[L] = []; DECOR_SPR.stalag[L] = [];
    for (let v=0; v<3; v++){
      const [c, x] = mkCanvas(TS, TS), len = 7 + (r()*8|0), w = 4 + (r()*4|0), cx = 4 + (r()*8|0);
      for (let y=0; y<len; y++){ const half = Math.max(0, (w/2)*(1 - y/len)); for (let X=Math.round(cx - half); X<=Math.round(cx + half); X++) px(x, X < cx - half/3 ? pal[3] : X > cx + half/3 ? pal[0] : pal[2], X, y); }
      px(x, [170,210,240], cx, len, 1, 1);                                           // a drip on the tip
      if (r() < .6){ const c2 = cx + (r() < .5 ? -3 : 3), l2 = 3 + (r()*4|0); for (let y=0;y<l2;y++) px(x, y < l2/2 ? pal[2] : pal[1], c2, y); }
      DECOR_SPR.stalac[L].push(c);
      const [c3, x3] = mkCanvas(TS, TS);
      x3.translate(0, TS); x3.scale(1, -1); x3.drawImage(c, 0, 0); x3.setTransform(1,0,0,1,0,0);
      x3.clearRect(0, 0, TS, TS - len - 1); x3.drawImage(c, 0, 0, TS, len, 0, TS - len, TS, len);   // point upward
      const [c4, x4] = mkCanvas(TS, TS); x4.translate(0, TS); x4.scale(1, -1); x4.drawImage(c, 0, 0);
      DECOR_SPR.stalag[L].push(c4);
    }
  }
  // hanging roots (shallow dirt only)
  DECOR_SPR.roots = [0,1,2].map(() => { const [c, x] = mkCanvas(TS, TS);
    for (let k=0;k<3 + (r()*3|0);k++){ let X = 2 + (r()*12|0); const len = 4 + (r()*9|0); for (let y=0;y<len;y++){ px(x, y > len - 2 ? [110,78,44] : [84,58,32], X, y); if (r() < .25) X += r() < .5 ? 1 : -1; } }
    return c; });
  // cobweb tucked into a top-left corner (flipped at draw time for the right)
  DECOR_SPR.web = (() => { const [c, x] = mkCanvas(TS, TS); x.fillStyle = 'rgba(230,230,240,.55)';
    for (let a=0; a<=4; a++){ const ang = a/4*Math.PI/2; for (let d=0; d<14; d++) x.fillRect(Math.cos(ang)*d|0, Math.sin(ang)*d|0, 1, 1); }
    for (const R of [4, 8, 12]) for (let a=0; a<=12; a++){ const ang = a/12*Math.PI/2; x.fillRect(Math.cos(ang)*R|0, Math.sin(ang)*R*.95|0, 1, 1); }
    return c; })();
  // glowing mushrooms: cyan and magenta
  DECOR_SPR.mush = [[90,230,255],[255,110,220],[140,255,150]].map(cap => { const [c, x] = mkCanvas(TS, TS);
    const shrooms = [[5, 5, 3], [10, 4, 2], [12, 3, 1]];
    for (const [X, h, s] of shrooms){
      px(x, [220,214,200], X, TS - h, 1, h);                                           // stem
      px(x, shade(cap, .55), X - s, TS - h - 2, s*2 + 1, 2); px(x, cap, X - s + 1, TS - h - 3, s*2 - 1, 2); px(x, [255,255,255], X - s + 1, TS - h - 3, 1, 1);
    }
    return c; });
  // crystal clusters, growing up from the floor (and down from the ceiling)
  const shards = (cols, up) => { const [c, x] = mkCanvas(TS, TS);
    for (const [X, h, w] of [[4, 8, 2], [8, 12, 3], [12, 6, 2], [6, 5, 1]]){
      for (let y=0;y<h;y++){ const ww = Math.max(0, Math.round(w*(1 - Math.max(0, y - h + 3)/3))); for (let i=-ww; i<=ww; i++){ const Y = up ? TS - 1 - y : y; px(x, i < 0 ? cols[2] : i > 0 ? cols[0] : cols[1], X + i, Y); } }
      px(x, [255,255,255], X, up ? TS - h : h - 1, 1, 1);
    }
    return c; };
  DECOR_SPR.crystalUp = [shards([[110,50,170],[190,120,255],[235,200,255]], true), shards([[30,120,150],[90,220,240],[210,255,255]], true)];
  DECOR_SPR.crystalDown = [shards([[110,50,170],[190,120,255],[235,200,255]], false), shards([[30,120,150],[90,220,240],[210,255,255]], false)];
  // a long-lost miner
  DECOR_SPR.bones = (() => { const [c, x] = mkCanvas(TS, TS), b = [226,220,206], d = [150,144,130];
    px(x, b, 2, TS-6, 4, 4); px(x, d, 3, TS-4, 1, 1); px(x, d, 5, TS-4, 1, 1); px(x, b, 3, TS-2, 2, 1);        // skull
    px(x, b, 7, TS-3, 6, 1); px(x, d, 7, TS-2, 6, 1); px(x, b, 12, TS-5, 1, 3); px(x, b, 9, TS-4, 1, 1);
    px(x, [184,135,26], 1, TS-7, 5, 2); px(x, [242,194,49], 1, TS-8, 4, 1);                                      // their old hardhat
    return c; })();
  // an abandoned minecart on a short run of rail
  DECOR_SPR.cart = (() => { const [c, x] = mkCanvas(TS, TS);
    px(x, [60,50,40], 0, TS-2, TS, 1); px(x, [120,110,100], 0, TS-3, TS, 1);                                     // rail
    px(x, [40,30,26], 1, TS-12, 14, 8); px(x, [120,70,40], 2, TS-11, 12, 6); px(x, [160,96,54], 2, TS-11, 12, 1); px(x, [90,52,30], 2, TS-7, 12, 1);
    px(x, [70,70,80], 1, TS-12, 14, 1); px(x, [70,70,80], 1, TS-9, 14, 1);
    px(x, [110,110,120], 3, TS-13, 3, 2); px(x, [246,196,40], 7, TS-14, 2, 2); px(x, [200,160,130], 10, TS-13, 3, 2);   // leftover ore
    for (const X of [3, 10]){ px(x, [30,30,34], X, TS-5, 3, 3); px(x, [90,90,100], X+1, TS-4, 1, 1); }
    return c; })();
}


// ============================================================
//  Item icons: drawn as icons (not in-world tiles), outlined
//  so they read clearly on the hotbar, in the shop and menus
// ============================================================
function outlined(src, col = '#120a14'){
  const w = src.width, h = src.height, [c, x] = mkCanvas(w, h);
  const d = src.getContext('2d').getImageData(0, 0, w, h).data, on = (X, Y) => X >= 0 && Y >= 0 && X < w && Y < h && d[(Y*w + X)*4 + 3] > 40;
  x.fillStyle = col;
  for (let Y=0; Y<h; Y++) for (let X=0; X<w; X++) if (!on(X, Y) && (on(X-1,Y) || on(X+1,Y) || on(X,Y-1) || on(X,Y+1))) x.fillRect(X, Y, 1, 1);
  x.drawImage(src, 0, 0);
  return c;
}
function icon(fn){ const [c, x] = mkCanvas(TS, TS); fn(x); return outlined(c); }
function buildIcons(){
  const wood = [150,98,48], woodLt = [200,146,82], woodDk = [92,58,26], iron = [96,96,110], ironLt = [168,168,184];
  // ladder, leaning slightly
  ICON.ladder = icon(x => {
    for (let y=1; y<15; y++){ const o = Math.round((15 - y)*.18); px(x, woodDk, 3 + o, y, 2, 1); px(x, woodLt, 3 + o, y, 1, 1); px(x, woodDk, 10 + o, y, 2, 1); px(x, woodLt, 10 + o, y, 1, 1); }
    for (const y of [3, 7, 11]){ const o = Math.round((15 - y)*.18); px(x, wood, 5 + o, y, 5, 2); px(x, woodLt, 5 + o, y, 5, 1); }
  });
  // support: a little timber frame with an X brace
  ICON.support = icon(x => {
    px(x, wood, 1, 2, 14, 3); px(x, woodLt, 1, 2, 14, 1); px(x, woodDk, 1, 4, 14, 1);
    for (const X of [2, 11]){ px(x, wood, X, 5, 3, 10); px(x, woodLt, X, 5, 1, 10); }
    for (let k=0;k<6;k++){ px(x, woodDk, 5 + k, 6 + k, 1, 1); px(x, woodDk, 10 - k, 6 + k, 1, 1); }
    px(x, ironLt, 3, 3, 1, 1); px(x, ironLt, 12, 3, 1, 1); px(x, [110,106,118], 1, 14, 5, 1); px(x, [110,106,118], 10, 14, 5, 1);
  });
  // torch with a big bright flame
  ICON.torch = icon(x => {
    px(x, woodDk, 7, 7, 3, 8); px(x, woodLt, 7, 7, 1, 8); px(x, iron, 6, 6, 5, 2); px(x, ironLt, 6, 6, 5, 1);
    px(x, [216,64,26], 6, 1, 5, 5); px(x, [216,64,26], 7, 0, 3, 1);
    px(x, [255,138,30], 7, 2, 3, 4); px(x, [255,214,90], 8, 3, 1, 3); px(x, [255,250,220], 8, 4, 1, 1);
  });
  // a dynamite bundle with a lit fuse
  ICON.dynamite = icon(x => {
    for (let k=0;k<3;k++){ const X = 2 + k*4; px(x, [168,32,28], X, 5, 4, 10); px(x, [220,70,60], X, 5, 2, 10); px(x, [245,120,108], X, 5, 1, 10); }
    px(x, [236,226,196], 2, 9, 12, 3); px(x, [255,250,230], 2, 9, 12, 1);
    px(x, [70,50,34], 8, 2, 1, 3); px(x, [70,50,34], 9, 1, 2, 1); px(x, [255,230,120], 11, 0, 2, 2); px(x, [255,140,40], 12, 1, 1, 1);
  });
  // a plank platform with brackets
  ICON.platform = icon(x => {
    px(x, wood, 0, 5, 16, 4); px(x, woodLt, 0, 5, 16, 1); px(x, woodDk, 0, 8, 16, 1);
    px(x, woodDk, 5, 5, 1, 4); px(x, woodDk, 11, 5, 1, 4); px(x, ironLt, 2, 6, 1, 1); px(x, ironLt, 8, 6, 1, 1); px(x, ironLt, 14, 6, 1, 1);
    for (let k=0;k<4;k++){ px(x, woodDk, 2 + k, 9 + k, 2, 1); px(x, woodDk, 12 - k, 9 + k, 2, 1); }
  });
  // a bridge post standing on a stone footing
  ICON.post = icon(x => {
    px(x, wood, 6, 1, 4, 12); px(x, woodLt, 6, 1, 1, 12); px(x, woodDk, 9, 1, 1, 12); px(x, woodDk, 7, 5, 1, 2);
    px(x, iron, 5, 3, 6, 2); px(x, ironLt, 5, 3, 6, 1); px(x, iron, 5, 9, 6, 2); px(x, ironLt, 5, 9, 6, 1);
    px(x, [104,100,110], 3, 13, 10, 3); px(x, [150,146,156], 3, 13, 10, 1);
  });
  // a first-aid kit
  ICON.medkit = icon(x => {
    px(x, [110,110,122], 6, 1, 4, 2); px(x, [236,236,240], 1, 3, 14, 12); px(x, [255,255,255], 1, 3, 14, 2); px(x, [196,196,208], 1, 13, 14, 2);
    px(x, [216,52,48], 7, 5, 2, 8); px(x, [216,52,48], 4, 8, 8, 2); px(x, [255,120,110], 7, 5, 1, 2);
  });
  // a recall beacon: glowing crystal on a base, with signal waves
  ICON.beacon = icon(x => {
    px(x, [60,60,72], 4, 12, 8, 3); px(x, [110,110,124], 4, 12, 8, 1);
    px(x, [40,120,210], 6, 5, 4, 7); px(x, [110,210,255], 6, 5, 2, 7); px(x, [230,250,255], 6, 5, 1, 3); px(x, [40,120,210], 7, 3, 2, 2);
    px(x, [140,220,255], 2, 4, 1, 3); px(x, [140,220,255], 13, 4, 1, 3); px(x, [140,220,255], 1, 2, 1, 1); px(x, [140,220,255], 14, 2, 1, 1);
  });
  // an ore scanner: handheld radar with a sweep and blips
  ICON.scanner = icon(x => {
    px(x, [52,52,64], 2, 3, 12, 11); px(x, [86,86,100], 2, 3, 12, 1); px(x, [36,36,46], 2, 13, 12, 1);
    px(x, [16,48,32], 4, 5, 8, 6); px(x, [60,200,120], 4, 8, 8, 1); px(x, [60,200,120], 8, 5, 1, 6);
    px(x, [160,255,190], 8, 8, 3, 1); px(x, [160,255,190], 9, 7, 1, 1); px(x, [255,220,90], 5, 6, 1, 1); px(x, [255,120,200], 10, 9, 1, 1);
    px(x, [220,60,60], 11, 12, 1, 1); px(x, [110,110,124], 7, 1, 1, 2);
  });
}
