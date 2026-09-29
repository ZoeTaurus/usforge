'use strict';
// ============================================================
//  Rendering: sky & surface, tiles, lighting, effects, HUD
// ============================================================
const canvas = $('game');
const ctx = canvas.getContext('2d');
let VW = 480, VH = 270, PXS = 1;               // view size in game pixels, CSS pixels per game pixel
const cam = { x:0, y:0 };
let particles = [], floaters = [], messages = [], shakeAmt = 0;
let hudRects = [];                               // clickable HUD areas (hotbar)
const LC = mkCanvas(1,1); let lightImg = null;   // light map (1 px per tile)
const MM = mkCanvas(64,48); let mmTimer = 0;     // minimap

// ---------- responsive sizing ----------
function resize(){
  const w = window.innerWidth, h = window.innerHeight;
  // ~480 game px across wide screens, never fewer than ~18 tiles on the short side
  let s = Math.max(1, Math.min(w, h*1.78) / 480, Math.min(w, h) / 300) * (settings.zoom || 1);
  s = Math.max(.75, s);
  if (s >= 2) s = Math.floor(s*2) / 2;            // crisp half-step scales on big screens
  PXS = s;
  VW = Math.ceil(w / s); VH = Math.ceil(h / s);
  canvas.width = VW; canvas.height = VH;
  canvas.style.width = (VW*s) + 'px'; canvas.style.height = (VH*s) + 'px';
  ctx.imageSmoothingEnabled = false;
}

// ---------- effects ----------
function burst(x, y, col, n, spd=60, g=300, life=.6, glow=false){
  for (let i=0;i<n;i++){
    const a = Math.random()*Math.PI*2, s = Math.random()*spd;
    particles.push({ x, y, vx:Math.cos(a)*s, vy:Math.sin(a)*s - spd*.3, g, life:life*(.5+Math.random()*.5), col, sz: Math.random()<.3 ? 2 : 1, glow });
  }
}
function floater(x, y, text, col){ floaters.push({ x, y, text, col, life:1.4 }); }
function msg(text, col='#f1e9d2', life=3){
  const last = messages[messages.length-1];
  if (last && last.text === text){ last.life = life; return; }
  messages.push({ text, col, life, max:life }); if (messages.length > 4) messages.shift();
}
function shake(a){ if (settings.shake) shakeAmt = Math.max(shakeAmt, a); }
function stepEffects(dt){
  for (const m of messages) m.life -= dt;
  messages = messages.filter(m => m.life > 0);
  for (const p of particles){ p.vy += p.g*dt; p.x += p.vx*dt; p.y += p.vy*dt; p.life -= dt; }
  particles = particles.filter(p => p.life > 0);
  if (particles.length > 700) particles.splice(0, particles.length-700);
  for (const f of floaters){ f.y -= 22*dt; f.life -= dt; }
  floaters = floaters.filter(f => f.life > 0);
  shakeAmt = Math.max(0, shakeAmt - dt*14);
  fadeA = Math.max(0, fadeA - dt*2.2);
}

// ---------- text ----------
function text(s, x, y, col='#f1e9d2', size=8, align='left'){
  ctx.font = `${size}px "Press Start 2P", monospace`; ctx.textAlign = align;
  ctx.fillStyle = 'rgba(0,0,0,.85)'; ctx.fillText(s, x+1, y+1);
  ctx.fillStyle = col; ctx.fillText(s, x, y); ctx.textAlign = 'left';
}

// ---------- sky & surface ----------
const CLOUDS = [0,1,2,3,4].map(i => {
  const r = mulberry32(50+i), w = 40 + (r()*30|0), [c, x] = mkCanvas(w, 18);
  for (let k=0;k<6;k++){ const bx = r()*(w-16)|0, bw = 12 + (r()*14|0), by = 4 + (r()*6|0); x.fillStyle = '#ffffff'; x.fillRect(bx, by, bw, 18-by-2); x.fillRect(bx+2, by-2, bw-4, 2); }
  x.fillStyle = '#d6e6f5'; x.fillRect(2, 14, w-4, 2);
  return c;
});
function drawSky(now){
  const horizon = SURF*TS - cam.y;
  const g = ctx.createLinearGradient(0, horizon - 260, 0, horizon);
  g.addColorStop(0, '#2c5cc4'); g.addColorStop(.7, '#78b8ec'); g.addColorStop(1, '#bfe6f7');
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, Math.max(0, horizon+2));
  if (horizon < -40) return;
  // sun
  const dp = dayPhase(), th = dp.p*Math.PI*2;
  const sx = (VW/2 + Math.cos(th)*VW*.38 - 12)|0, sy = (horizon - 82 - Math.sin(th)*140)|0;
  if (sy < horizon - 60){
    ctx.fillStyle = 'rgba(255,245,190,.18)'; ctx.fillRect(sx-10, sy-10, 44, 44);
    ctx.fillStyle = 'rgba(255,245,190,.25)'; ctx.fillRect(sx-5, sy-5, 34, 34);
    ctx.fillStyle = dp.dusk > .5 ? '#ffb070' : '#fff6b0'; ctx.fillRect(sx, sy, 24, 24); ctx.fillStyle = dp.dusk > .5 ? '#ff8a4a' : '#ffe36a'; ctx.fillRect(sx+3, sy+3, 18, 18);
  }
  // clouds
  for (let i=0;i<7;i++){
    const c = CLOUDS[i%5], span = VW + 200;
    const cx = (((i*173 + now*(4+i%3) - cam.x*.12) % span) + span) % span - 100;
    ctx.drawImage(c, cx|0, (horizon - 240 + (i*41)%120)|0);
  }
  // mountains & hills (parallax)
  const layers = [ { par:.15, base:70, amp:38, f:.009, col:'#8fb3cf', cap:'#dfeaf4' }, { par:.3, base:44, amp:22, f:.017, col:'#6d9e8c' }, { par:.55, base:22, amp:12, f:.03, col:'#4e8a52' } ];
  for (const L of layers){
    for (let x=0;x<VW;x+=2){
      const wx = x + cam.x*L.par;
      const h = L.base + Math.sin(wx*L.f)*L.amp + Math.sin(wx*L.f*2.3+1)*L.amp*.35;
      ctx.fillStyle = L.col; ctx.fillRect(x, (horizon - h)|0, 2, (h+2)|0);
      if (L.cap && h > L.base + L.amp*.6){ ctx.fillStyle = L.cap; ctx.fillRect(x, (horizon - h)|0, 2, 3); }
    }
  }
  if (dp.dusk > 0){
    const g2 = ctx.createLinearGradient(0, horizon - 160, 0, horizon);
    g2.addColorStop(0, 'rgba(255,120,60,0)'); g2.addColorStop(1, `rgba(255,120,60,${dp.dusk*.4})`);
    ctx.fillStyle = g2; ctx.fillRect(0, horizon - 160, VW, 160);
  }
}
function drawTree(t, base){
  const x = t.x*TS - cam.x|0;
  if (x < -40 || x > VW+40) return;
  const h = t.h*9 + 8;
  ctx.fillStyle = '#4a2e18'; ctx.fillRect(x+6, base-h, 5, h); ctx.fillStyle = '#6b4423'; ctx.fillRect(x+6, base-h, 2, h);
  if (t.kind){ // pine
    for (let k=0;k<4;k++){ const w = 26 - k*6, y = base - h + 8 - k*9; ctx.fillStyle = '#1f5a34'; ctx.fillRect(x+8-w/2, y, w, 10); ctx.fillStyle = '#2d7a44'; ctx.fillRect(x+8-w/2, y, w-4, 3); }
  } else {
    const blobs = [[-8,-10,26,18],[-4,-20,20,14],[4,-14,18,16],[-12,-4,34,12]];
    for (const [bx,by,bw,bh] of blobs){ ctx.fillStyle = '#2a6e2e'; ctx.fillRect(x+bx, base-h+by, bw, bh); }
    for (const [bx,by,bw] of blobs){ ctx.fillStyle = '#3f9443'; ctx.fillRect(x+bx+2, base-h+by, bw-6, 3); }
    ctx.fillStyle = '#c0392b'; ctx.fillRect(x+2, base-h-8, 2, 2); ctx.fillRect(x+14, base-h-2, 2, 2);
  }
}
// The storefront is drawn once into an offscreen canvas; only the sign text, lantern and smoke are live.
const SHOP_ART_W = 160, SHOP_ART_H = 104, SHOP_ART_L = 16, SHOP_ART_B = 100;
let SHOP_ART = null;
function buildShopArt(){
  const [c, x] = mkCanvas(SHOP_ART_W, SHOP_ART_H);
  const P = (col, X, Y, w=1, h=1) => { x.fillStyle = col; x.fillRect(X|0, Y|0, w, h); };
  const L = SHOP_ART_L, W = (SHOP_X1-SHOP_X0+1)*TS, B = SHOP_ART_B, CX = L + W/2;
  const wallTop = B-52, wallBot = B-8, roofTop = B-88, roofBot = wallTop-2;
  const half = y => { const t = (y-roofTop)/(roofBot-roofTop); return 30 + t*(W/2 + 8 - 30); };

  // chimney (behind the roof)
  const chx = L + W - 40;
  P('#5a5760', chx, roofTop-14, 13, 30);
  for (let y=roofTop-14; y<roofTop+16; y+=4){ P('#4a4750', chx, y+3, 13, 1); P('#4a4750', chx + ((y/4)%2 ? 6 : 3), y, 1, 3); }
  P('#7d7a84', chx, roofTop-14, 2, 30);
  P('#3a3840', chx-2, roofTop-17, 17, 3); P('#8c8990', chx-2, roofTop-17, 17, 1);

  // roof: pitched with staggered shingle rows
  for (let y=roofTop; y<roofBot; y++){
    const h = half(y), row = ((y-roofTop)/4)|0;
    P(row % 2 ? '#8e2a24' : '#9c3129', CX-h, y, h*2, 1);
    if ((y-roofTop) % 4 === 3) P('#6a1c17', CX-h, y, h*2, 1);
    else if ((y-roofTop) % 4 === 0){ const off = row % 2 ? 0 : 5; for (let xx=CX-h+off; xx<CX+h; xx+=10) P('#6a1c17', xx, y, 1, 3); }
  }
  for (let y=roofTop; y<roofBot; y++){ const h = half(y); P('#c9564a', CX-h, y, 2, 1); P('#58150f', CX+h-2, y, 2, 1); }
  P('#58150f', CX-32, roofTop-3, 64, 3); P('#c9564a', CX-32, roofTop-3, 64, 1);                 // ridge cap
  P('#4a120e', L-8, roofBot, W+16, 3); P('#c9564a', L-8, roofBot, W+16, 1);                   // eave board
  P('rgba(0,0,0,.35)', L+2, roofBot+3, W-4, 3);                                                // shadow on the wall

  // dormer window in the roof
  const dw = 22, dx = CX - dw/2, dy = roofTop + 10;
  P('#3a2210', dx-2, dy-2, dw+4, 17); P('#ffd98a', dx, dy, dw, 13); P('#fff0c0', dx, dy, dw, 3);
  P('#3a2210', CX-1, dy, 2, 13); P('#3a2210', dx, dy+6, dw, 1);
  for (let k=0;k<8;k++){ P('#58150f', dx-4+k, dy-3-k, dw+8-k*2, 1); }                        // little gable over it
  P('#c9564a', dx-4, dy-3, 1, 1);

  // walls: vertical planks between corner posts
  for (let px=L+4, k=0; px<L+W-4; px+=6, k++){
    P(k % 2 ? '#8a5530' : '#7d4b28', px, wallTop, 6, wallBot-wallTop);
    P('#9c6438', px, wallTop, 1, wallBot-wallTop); P('#5e3719', px+5, wallTop, 1, wallBot-wallTop);
  }
  for (let i=0;i<12;i++) P('#5e3719', L+9 + i*10, wallTop + 5 + (i*13) % 34, 1, 1);           // knots
  for (const px of [L+2, L+W-7]){ P('#4a2a12', px, wallTop-2, 5, wallBot-wallTop+2); P('#6b4423', px+1, wallTop-2, 1, wallBot-wallTop+2); }
  P('#4a2a12', L+2, wallTop-2, W-4, 3); P('#6b4423', L+2, wallTop-2, W-4, 1);

  // stone foundation
  P('#3e3a44', L, B-8, W, 8);
  for (let row=0; row<2; row++) for (let sx=L+1 + (row ? 5 : 0); sx < L+W-2; sx += 10){
    const w = Math.min(9, L+W-1-sx); P('#6d6872', sx, B-8+row*4, w, 3); P('#8a8590', sx, B-8+row*4, w, 1);
  }

  // display windows with awnings and flower boxes
  const gems = ['#5ae6f0', '#e0304a', '#f6c428', '#9c5aff', '#40c464'];
  for (const wx of [L+8, L+W-40]){
    const wy = B-38, ww = 32, wh = 22;
    P('#2a170a', wx-2, wy-2, ww+4, wh+4);
    P('#ffd98a', wx, wy, ww, wh); P('#fff0c0', wx, wy, ww, 4);
    P('#6b4423', wx, wy+14, ww, 2);                                                             // shelf
    [3, 9, 20, 26].forEach((gx, k) => { const g = gems[(k + (wx > CX ? 2 : 0)) % gems.length]; P(g, wx+gx, wy+10, 3, 4); P('#ffffff', wx+gx, wy+10, 1, 1); });
    P('#2a170a', wx+15, wy, 2, wh); P('#2a170a', wx, wy+7, ww, 1);                               // mullions
    P('#9c6438', wx-3, wy+wh+2, ww+6, 2);                                                        // sill
    P('#5e3719', wx-1, wy+wh+4, ww+2, 4); P('#6b4423', wx-1, wy+wh+4, ww+2, 1);                  // flower box
    for (let f=0; f<ww; f+=4){ P('#3d8a2c', wx+f+1, wy+wh+1, 2, 3); P(['#ff6b8a','#ffe066','#ffffff','#9ad0ff'][(f/4)%4], wx+f+1, wy+wh, 2, 2); }
    // striped awning with a scalloped edge
    const ax = wx-3, ay = wy-11, aw = ww+6;
    P('#6a1c17', ax, ay-1, aw, 1);
    for (let k=0; k<aw; k+=6){
      const col = (k/6) % 2 ? '#f1e9d2' : '#c0392b', shadeCol = (k/6) % 2 ? '#cfc6ae' : '#8e2a24';
      P(col, ax+k, ay, Math.min(6, aw-k), 6); P(shadeCol, ax+k, ay+4, Math.min(6, aw-k), 2);
      P(col, ax+k+1, ay+6, Math.min(4, aw-k-1), 2);
    }
    P('rgba(0,0,0,.28)', wx-2, wy-3, ww+4, 2);
  }

  // sign board over the door
  const sw = 42, sx = CX - sw/2, sy = wallTop + 3;
  P('#2a170a', sx-2, sy-2, sw+4, 16); P('#e8d19a', sx, sy, sw, 12); P('#fff3c8', sx, sy, sw, 1); P('#c9ae72', sx, sy+10, sw, 2);
  for (const nx of [sx+1, sx+sw-2]){ P('#6b4423', nx, sy+1, 1, 1); P('#6b4423', nx, sy+9, 1, 1); }

  // door with a little window
  const dox = CX - 9, doy = B-36;
  P('#2a170a', dox-2, doy-2, 22, 30);
  P('#5a3418', dox, doy, 18, 28);
  P('#4a2a12', dox+6, doy, 1, 28); P('#4a2a12', dox+12, doy, 1, 28); P('#6e4020', dox, doy, 1, 28);
  P('#2a170a', dox+3, doy+4, 12, 9); P('#ffd98a', dox+4, doy+5, 10, 7); P('#2a170a', dox+8, doy+5, 2, 7);
  P('#ffd24a', dox+14, doy+16, 2, 2);
  P('#8a8590', dox-4, B-8, 26, 2); P('#a8a4ae', dox-4, B-8, 26, 1);                                // front step
  P('#2a2a30', dox+20, doy+2, 6, 1); P('#2a2a30', dox+25, doy+2, 1, 3);                           // lantern bracket

  // barrel (left) and crates (right)
  const bx = L-13;
  P('#1a100a', bx-1, B-15, 12, 15); P('#7a4a26', bx, B-14, 10, 14); P('#9a6234', bx+1, B-14, 2, 14);
  P('#4a4a52', bx, B-12, 10, 2); P('#4a4a52', bx, B-5, 10, 2); P('#5e3719', bx, B-14, 10, 1);
  const cx0 = L+W+2;
  for (const [cx, cy, s] of [[cx0, B-13, 13], [cx0+2, B-23, 10]]){
    P('#2a170a', cx-1, cy-1, s+2, s+1); P('#a0703c', cx, cy, s, s); P('#c08a4a', cx, cy, s, 1);
    P('#6b4423', cx, cy, 1, s); P('#6b4423', cx+s-1, cy, 1, s); P('#6b4423', cx, cy+s-1, s, 1);
    for (let k=1;k<s-1;k++) P('#6b4423', cx+k, cy+k, 1, 1);
  }
  return c;
}
function drawShop(base, now = 0){
  const x0 = SHOP_X0*TS - cam.x|0, w = (SHOP_X1-SHOP_X0+1)*TS;
  if (x0 > VW + 20 || x0 + w < -40) return;
  if (!SHOP_ART) SHOP_ART = buildShopArt();
  const ox = x0 - SHOP_ART_L, oy = base - SHOP_ART_B;
  ctx.drawImage(SHOP_ART, ox, oy);
  // sign lettering (drawn live so the pixel font is loaded)
  text('SHOP', x0 + w/2, base - 52 + 3 + 10, '#6b2a10', 8, 'center');
  // lantern by the door
  const lx = x0 + w/2 + 14, ly = base - 31, fl = (now*8|0) % 3;
  ctx.fillStyle = '#2a2a30'; ctx.fillRect(lx, ly, 6, 1); ctx.fillRect(lx, ly+7, 6, 1); ctx.fillRect(lx, ly, 1, 8); ctx.fillRect(lx+5, ly, 1, 8);
  ctx.fillStyle = fl === 1 ? '#ffc04a' : '#ffe07a'; ctx.fillRect(lx+1, ly+1, 4, 6);
  ctx.fillStyle = '#fff6c0'; ctx.fillRect(lx+2, ly+3 + (fl === 2 ? 1 : 0), 2, 2);
  // chimney smoke
  if (Math.random() < .06){
    const wx = SHOP_X0*TS + w - 40 - SHOP_ART_L + 16 + 6, wy = SURF*TS - SHOP_ART_B + (SHOP_ART_B - 88) - 18;
    particles.push({ x: wx + Math.random()*4, y: wy, vx: 4 + Math.random()*4, vy: -10 - Math.random()*6, g: -3, life: 2.4, col: Math.random() < .5 ? '#c8c8d0' : '#a8a8b4', sz: 2 });
  }
}
function drawHeadframe(base, now){
  const x = HEADFRAME_X*TS - cam.x|0;
  if (x < -60 || x > VW+60) return;
  ctx.fillStyle = '#5a3616';
  for (let k=0;k<60;k++){ ctx.fillRect(x-4 + (k*10/60|0), base-k, 3, 1); ctx.fillRect(x+30 - (k*10/60|0), base-k, 3, 1); }
  for (const y of [18, 36, 52]) { ctx.fillRect(x-2 + (y*10/60|0), base-y, 34 - (y*20/60|0), 2); }
  ctx.fillStyle = '#8a5a2a'; ctx.fillRect(x+6, base-62, 18, 3);
  // wheel
  const wx = x+15, wy = base-66, a = now*1.2;
  ctx.fillStyle = '#3a3a42';
  for (let k=0;k<16;k++){ const t = k/16*Math.PI*2; ctx.fillRect(wx + Math.cos(t)*8|0, wy + Math.sin(t)*8|0, 2, 2); }
  for (let k=0;k<3;k++){ const t = a + k/3*Math.PI; for (let r=0;r<8;r++) ctx.fillRect(wx + Math.cos(t)*r|0, wy + Math.sin(t)*r|0, 1, 1); }
  ctx.fillStyle = '#c9a36a'; ctx.fillRect(x-2, base-30, 36, 10); ctx.fillStyle = '#8a6a3a'; ctx.fillRect(x-2, base-21, 36, 1);
  text('MINE', x+16, base-22, '#3a2210', 6, 'center');
  // rope
  ctx.fillStyle = '#b8a070'; ctx.fillRect(wx+7, wy+1, 1, 58);
}
function drawSurface(now){
  const base = SURF*TS - cam.y|0;
  if (base < -10 || base > VH + 120) return;
  for (const r of surfaceDecor.rocks){ const x = r.x - cam.x|0; if (x<-10||x>VW) continue; ctx.fillStyle = '#7d7a80'; ctx.fillRect(x, base-r.s, r.s*2, r.s); ctx.fillStyle = '#a3a0a8'; ctx.fillRect(x+1, base-r.s, r.s*2-3, 1); }
  for (const t of surfaceDecor.trees) drawTree(t, base);
  drawShop(base, now);
  drawHeadframe(base, now);
}

// ---------- tiles ----------
// ---------- world-space texturing helpers ----------
const LAYER_MATS = new Set([T.DIRT, T.STONE, T.GRANITE, T.BASALT, T.BEDROCK, T.GRAVEL, T.RUBBLE]);
// the rock "material" a solid tile is made of (ores and grass sit in their layer's rock)
function matOf(x, y){
  if (!inb(x,y)) return -1;
  const t = tiles[I(x,y)];
  if (t === T.GRASS) return T.DIRT;
  if (DEF[t].ore) return layer[I(x,y)];
  return LAYER_MATS.has(t) ? t : -1;
}
const hash2 = (a, b) => { const h = Math.sin(a*127.1 + b*311.7)*43758.5453; return h - Math.floor(h); };
// smooth-ish jagged edge height (0..5 px) along a world coordinate
const jag = (w, seed) => clamp(Math.round(2.4 + Math.sin(w*.41 + seed)*1.4 + Math.sin(w*.13 + seed*3)*1.2 + (hash2(w, seed) - .5)*1.6), 0, 5);
// draw part of a material sheet at the matching world position (keeps texture continuous)
function sheetPart(sheet, wx, wy, w, h, dx, dy){
  const S = SHEET_SIZE, sx = ((wx % S) + S) % S, sy = ((wy % S) + S) % S;
  ctx.drawImage(sheet, sx, sy, w, h, dx, dy, w, h);
}
function drawGround(x, y, t, sx, sy){
  const wx = x*TS, wy = y*TS, m = matOf(x,y);
  sheetPart(SHEET[m >= 0 ? m : t], wx, wy, TS, TS, sx, sy);
  if (m < 0) return;
  // blend jaggedly into neighbouring rock layers instead of hard tile seams
  const mb = matOf(x, y+1), mt = matOf(x, y-1), mr = matOf(x+1, y);
  if (mb >= 0 && mb !== m) for (let c=0;c<TS;c++){ const h = jag(wx + c, 1); if (h) sheetPart(SHEET[mb], wx + c, wy + TS - h, 1, h, sx + c, sy + TS - h); }
  if (mt >= 0 && mt !== m && y > SURF+1) for (let c=0;c<TS;c++){ const h = jag(wx + c, 7) >> 1; if (h) sheetPart(SHEET[mt], wx + c, wy, 1, h, sx + c, sy); }
  if (mr >= 0 && mr !== m) for (let r=0;r<TS;r++){ const w = jag(wy + r, 3); if (w) sheetPart(SHEET[mr], wx + TS - w, wy + r, w, 1, sx + TS - w, sy + r); }
}
// bevels, soft shadows and rounded corners where rock meets open space
function drawRockEdges(x, y, sx, sy){
  const oT = !isSolid(x,y-1), oB = !isSolid(x,y+1), oL = !isSolid(x-1,y), oR = !isSolid(x+1,y);
  if (!(oT || oB || oL || oR)) return;
  if (oT){ ctx.fillStyle = 'rgba(255,255,255,.17)'; ctx.fillRect(sx, sy, TS, 1); ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(sx, sy+1, TS, 1); }
  if (oB){ ctx.fillStyle = 'rgba(0,0,0,.42)'; ctx.fillRect(sx, sy+TS-2, TS, 2); ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(sx, sy+TS-3, TS, 1); }
  if (oL){ ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(sx, sy, 1, TS); ctx.fillStyle = 'rgba(0,0,0,.1)'; ctx.fillRect(sx+1, sy, 1, TS); }
  if (oR){ ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(sx+TS-1, sy, 1, TS); ctx.fillStyle = 'rgba(0,0,0,.1)'; ctx.fillRect(sx+TS-2, sy, 1, TS); }
  // round off outside corners by painting the cave wall back in
  if (y <= SURF) return;
  const bg = DSHEET[layer[I(x,y)]] || DSHEET[T.STONE], wx = x*TS, wy = y*TS;
  const corner = (cx, cy, dx, dy) => { sheetPart(bg, wx+cx, wy+cy, 2, 1, sx+cx, sy+cy); sheetPart(bg, wx+cx+(dx<0?1:0), wy+cy+dy, 1, 1, sx+cx+(dx<0?1:0), sy+cy+dy); };
  if (oT && oL) corner(0, 0, 1, 1);
  if (oT && oR) corner(TS-2, 0, -1, 1);
  if (oB && oL) corner(0, TS-1, 1, -1);
  if (oB && oR) corner(TS-2, TS-1, -1, -1);
}
// small bits of ore bridging into neighbouring ore tiles so veins read as one
function drawVeinLinks(x, y, t, sx, sy){
  const d = DEF[t], gem = (gx, gy) => { ctx.fillStyle = 'rgba(10,6,14,.5)'; ctx.fillRect(gx, gy+1, 4, 3); ctx.fillStyle = rgb(d.c1); ctx.fillRect(gx, gy, 3, 3); ctx.fillStyle = rgb(d.c2); ctx.fillRect(gx, gy, 1, 1); };
  if (get(x+1, y) === t) gem(sx + TS - 2, sy + 4 + (hash2(x, y)*8|0));
  if (get(x, y+1) === t) gem(sx + 4 + (hash2(y, x)*8|0), sy + TS - 2);
}

// ---------- tiles ----------
function drawTiles(tx0, ty0, tx1, ty1, now){
  const mining = scene === 'game' && P && P.mining && !P.mining.deny && P.mineT > 0 ? P.mining : null;
  for (let y=ty0;y<=ty1;y++) for (let x=tx0;x<=tx1;x++){
    if (!inb(x,y)) continue;
    const i = I(x,y), t = tiles[i];
    let sx = x*TS - cam.x|0, sy = y*TS - cam.y|0;
    const solid = DEF[t].solid;
    if (y >= SURF && !solid){
      sheetPart(DSHEET[layer[i]] || DSHEET[T.STONE], x*TS, y*TS, TS, TS, sx, sy);
      // soft ambient occlusion from neighbouring rock
      if (isSolid(x,y-1)){ ctx.fillStyle = 'rgba(0,0,0,.34)'; ctx.fillRect(sx, sy, TS, 2); ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(sx, sy+2, TS, 2); }
      if (isSolid(x-1,y)){ ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(sx, sy, 2, TS); ctx.fillStyle = 'rgba(0,0,0,.1)'; ctx.fillRect(sx+2, sy, 1, TS); }
      if (isSolid(x+1,y)){ ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(sx+TS-2, sy, 2, TS); ctx.fillStyle = 'rgba(0,0,0,.1)'; ctx.fillRect(sx+TS-3, sy, 1, TS); }
      if (isSolid(x,y+1)){ ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(sx, sy+TS-1, TS, 1); }
    }
    // the block you're digging trembles
    if (mining && mining.x === x && mining.y === y){ sx += (Math.random()*3|0) - 1; sy += (Math.random()*2|0); }
    if (t === T.LAVA){
      const top = !isSolid(x,y-1) && get(x,y-1) !== T.LAVA;
      ctx.fillStyle = '#c8321a'; ctx.fillRect(sx, sy, TS, TS);
      ctx.fillStyle = '#ee5a1c';
      for (let k=0;k<3;k++){ const ox = (x*5 + k*6 + (now*4|0)) % 14, oy = (y*3 + k*5 + (now*2|0)) % 13; ctx.fillRect(sx+ox, sy+oy, 4, 3); }
      ctx.fillStyle = '#ffb040'; ctx.fillRect(sx + ((x*3 + (now*5|0)) % 14), sy + ((y*7 + (now*3|0)) % 14), 2, 1);
      if (top){ const wave = Math.sin(now*3 + x) > 0 ? 1 : 0; ctx.fillStyle = '#ffd35a'; ctx.fillRect(sx, sy+wave, TS, 2); ctx.fillStyle = '#ff8a1e'; ctx.fillRect(sx, sy+2+wave, TS, 2); }
    } else if (DEF[t].ore){
      drawGround(x, y, t, sx, sy);
      ctx.drawImage(ORE_TEX[t][(hash2(x, y)*3)|0], sx, sy);
      drawVeinLinks(x, y, t, sx, sy);
      const ph = (now*1.5 + x*.73 + y*.37) % 3;
      if (ph < .15){ ctx.fillStyle = '#fff'; const gx = sx+3+(x*5%9), gy = sy+3+(y*3%9); ctx.fillRect(gx, gy-1, 1, 3); ctx.fillRect(gx-1, gy, 3, 1); }
    } else if (t === T.CHEST){
      sheetPart(DSHEET[layer[i]] || DSHEET[T.STONE], x*TS, y*TS, TS, TS, sx, sy); ctx.drawImage(PROP.chest, sx, sy);
      if (((now*1.2 + x) % 3) < .12){ ctx.fillStyle = '#fff'; ctx.fillRect(sx+4, sy+6, 1, 1); }
    } else if (solid){
      drawGround(x, y, t, sx, sy);
      if (t === T.GRASS) sheetPart(GRASS_STRIP, x*TS, 0, TS, 8, sx, sy);
    }
    if (solid && y > SURF && t !== T.CHEST) drawRockEdges(x, y, sx, sy);
    if (t === T.GRASS && !isSolid(x,y-1)) ctx.drawImage(TUFTS[(x*5+3)%6], sx, sy-6);
    if (solid && y === SURF){ ctx.fillStyle = 'rgba(0,0,0,.35)'; if (!isSolid(x-1,y)) ctx.fillRect(sx, sy+2, 2, TS-2); if (!isSolid(x+1,y)) ctx.fillRect(sx+TS-2, sy+2, 2, TS-2); }
    const dc = deco[i];
    if (dc === D.LADDER) ctx.drawImage(PROP.ladder, sx, sy);
    else if (dc === D.SUPPORT) ctx.drawImage(PROP.support, sx, sy);
    else if (dc === D.PLATFORM) ctx.drawImage(PROP.platform, sx, sy);
    else if (dc === D.POST) ctx.drawImage(PROP.post, sx, sy);
    else if (dc === D.TORCH){
      ctx.drawImage(PROP.torch, sx, sy);
      const f = (now*10 + x*3) % 3 | 0;
      ctx.fillStyle = '#ff5a1a'; ctx.fillRect(sx+6, sy+2+(f===1?1:0), 4, 5);
      ctx.fillStyle = '#ffb030'; ctx.fillRect(sx+7, sy+3+(f===2?1:0), 2, 3);
      ctx.fillStyle = '#fff3b0'; ctx.fillRect(sx+7, sy+5, 1, 1);
      if (Math.random() < .02) particles.push({ x:x*TS+8, y:y*TS+3, vx:(Math.random()-.5)*8, vy:-18, g:-10, life:.8, col:'#ffb030', sz:1, glow:true });
    }
    if (t === T.GAS){
      ctx.fillStyle = `rgba(120,220,80,${.26 + Math.sin(now*3+x+y)*.08})`; ctx.fillRect(sx, sy, TS, TS);
      ctx.fillStyle = 'rgba(190,255,130,.35)';
      ctx.fillRect(sx + ((x*5 + (now*6|0)) % 12), sy + ((y*3 + (now*4|0)) % 12), 3, 2);
      ctx.fillRect(sx + ((x*9 + (now*5|0)) % 13), sy + ((y*7 + (now*3|0)) % 13), 2, 2);
    }
  }
}

// ---------- player ----------
function drawPlayer(now){
  if (!P || game.over || scene !== 'game') return;
  let f = 0;
  if (P.onLadder && P.vy) f = (now*8|0) % 2 ? 1 : 3;
  else if (!P.onGround && !P.onLadder) f = 4;
  else if (P.vx) f = (P.walk|0) % 4;
  const spr = MINER[f][P.face > 0 ? 0 : 1];
  const sx = Math.round(pcx() - 7 - cam.x), sy = Math.round(P.y + P.h - 17 - cam.y);
  if ((P.hurtT > 0 || P.iframes > 0) && (now*20|0) % 2) ctx.globalAlpha = .45;
  // pickaxe behind body when idle, in front when swinging
  const swinging = (input.mining || input.digKey) && ((P.mining && !P.mining.deny) || P.attackT > -.1);
  const ang = swinging ? (-1.3 + (Math.sin(P.swing)+1)*1.15) : -.25 + Math.sin(now*2)*.04;
  const hx = sx + (P.face > 0 ? 10 : 4), hy = sy + 11;
  const drawPick = () => { ctx.save(); ctx.translate(hx, hy); ctx.scale(P.face, 1); ctx.rotate(ang); ctx.drawImage(PICK_SPR[game.pick], -2, -12); ctx.restore(); };
  if (!swinging) drawPick();
  if (game.jetLv){
    const jx = sx + (P.face > 0 ? 1 : 9), jy = sy + 8;
    ctx.fillStyle = '#140c1a'; ctx.fillRect(jx-1, jy-1, 6, 9);
    ctx.fillStyle = game.jetLv > 1 ? '#c04040' : '#8a8a96'; ctx.fillRect(jx, jy, 4, 7);
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(jx, jy, 1, 7);
    ctx.fillStyle = '#3a3a42'; ctx.fillRect(jx+1, jy+7, 2, 1);
  }
  ctx.drawImage(spr, sx, sy);
  if ((now % 3.7) < .13 && f !== 4){ ctx.fillStyle = '#f0b48a'; ctx.fillRect(sx + (P.face > 0 ? 8 : 5), sy + 5, 1, 1); }
  if (swinging) drawPick();
  ctx.globalAlpha = 1;
}

// ---------- enemies, loot, dynamite ----------
function drawEntities(now){
  for (const p of pickups){
    const x = p.x - cam.x|0, y = p.y - cam.y|0;
    if (p.kind === 'coin'){
      const w = [5,3,1,3][(now*10 + p.x)|0 & 3], ox = (5-w)/2|0;
      ctx.fillStyle = '#8a5a00'; ctx.fillRect(x+ox, y, w, 6); ctx.fillStyle = '#ffd24a'; ctx.fillRect(x+ox, y, w, 5);
      if (w > 1){ ctx.fillStyle = '#fff6b0'; ctx.fillRect(x+ox, y, 1, 2); }
    } else {
      const d = DEF[p.id];
      ctx.fillStyle = rgb(d.c1,.5); ctx.fillRect(x+1, y+2, 6, 5); ctx.fillStyle = rgb(d.c1); ctx.fillRect(x+1, y+1, 5, 5); ctx.fillRect(x, y+2, 7, 3);
      ctx.fillStyle = rgb(d.c2); ctx.fillRect(x+1, y+1, 2, 1); ctx.fillRect(x, y+2, 1, 1);
    }
  }
  for (const b of bombs){
    const x = b.x*TS - cam.x|0, y = b.y*TS - cam.y|0;
    ctx.drawImage(PROP.dynamite, x, y + ((b.t < 1 && (now*20|0)%2) ? 1 : 0));
    if ((now*(b.t < 1 ? 16 : 5)|0) % 2){ ctx.fillStyle = '#ff3a2a'; ctx.fillRect(x+7, y+2, 2, 2); }
  }
  for (const e of enemies){
    const d = e.def, cx = e.x + d.w/2 - cam.x, by = e.y + d.h - cam.y;
    if (cx < -30 || cx > VW+30 || by < -30 || by > VH+40) continue;
    if (e.type === 'wisp'){
      const f = Math.sin(e.t*14), X = cx|0, Y = (e.y - cam.y + 5)|0;
      ctx.fillStyle = e.flash > 0 ? '#fff' : '#e0441a'; ctx.fillRect(X-5, Y-4, 10, 9); ctx.fillRect(X-4, Y-6 - (f > 0 ? 1 : 0), 8, 3); ctx.fillRect(X-2, Y-8 - (f > 0 ? 1 : 0), 4, 3);
      ctx.fillStyle = e.flash > 0 ? '#fff' : '#ff9a2a'; ctx.fillRect(X-4, Y-3, 8, 7);
      ctx.fillStyle = '#ffe36a'; ctx.fillRect(X-2, Y-1, 4, 4);
      ctx.fillStyle = '#3a1000'; ctx.fillRect(X-3 + (e.face > 0 ? 1 : 0), Y-1, 1, 2); ctx.fillRect(X + (e.face > 0 ? 1 : 0), Y-1, 1, 2);
      continue;
    }
    if (e.type === 'spider' && e.state === 'hang'){ ctx.fillStyle = 'rgba(220,220,230,.6)'; ctx.fillRect(cx|0, e.anchorY - cam.y|0, 1, (e.y - e.anchorY + 1)|0); }
    let set;
    if (e.type === 'spider') set = ESPR.spider[e.state === 'hang' || Math.abs(e.vx) < 5 ? 0 : (e.t*12|0) % 2];
    else if (e.type === 'ghost') set = ESPR.ghost[(e.t*4|0) % 2];
    else if (e.type === 'beetle') set = ESPR.beetle[Math.abs(e.vx) > 5 ? (e.t*10|0) % 2 : 0];
    else if (e.type === 'bat') set = ESPR.bat[(e.t*10|0) % 2];
    else if (e.type === 'crawler') set = ESPR.crawler[Math.abs(e.vx) > 5 ? (e.t*9|0) % 2 : 0];
    else if (e.type === 'golem') set = ESPR.golem[Math.abs(e.vx) > 5 ? (e.t*5|0) % 2 : 0];
    else set = ESPR.slime[e.variant];
    const fuseFlash = e.fuse !== undefined && (e.fuse*12|0) % 2;
    const img = (e.flash > 0 || fuseFlash) ? set.w : (e.face > 0 ? set.r : set.l);
    if (e.type === 'ghost') ctx.globalAlpha = .55 + Math.sin(e.t*3)*.15;
    let sxs = 1, sys = 1;
    if (e.type === 'slime'){ if (e.squash > 0){ sxs = 1.25; sys = .75; } else if (!e.onGround){ sxs = .9; sys = 1.12; } }
    const w = img.width*sxs, h = img.height*sys;
    ctx.drawImage(img, Math.round(cx - w/2), Math.round(by - h + (e.type === 'bat' ? img.height - d.h - 1 : 1)), Math.round(w), Math.round(h));
    ctx.globalAlpha = 1;
  }
  drawBoss(performance.now()/1000);
}
function drawEnemyOverlay(now){
  for (const e of enemies){
    const d = e.def, cx = e.x + d.w/2 - cam.x|0, top = e.y - cam.y|0;
    if (cx < -20 || cx > VW+20 || top < -20 || top > VH+20) continue;
    // eyes glint in the dark
    ctx.fillStyle = e.type === 'crawler' ? '#ffd24a' : '#ff3a2a';
    if (e.type === 'bat'){ const fy = (e.t*10|0) % 2 ? top+2 : top+3; ctx.fillRect(cx-2, fy, 1, 1); ctx.fillRect(cx+1, fy, 1, 1); }
    else if (e.type === 'crawler'){ ctx.fillRect(cx + (e.face > 0 ? 4 : -5), top+3, 1, 1); }
    else if (e.type === 'golem'){ ctx.fillStyle = '#ffa040'; ctx.fillRect(cx-3, top+3, 1, 1); ctx.fillRect(cx+2, top+3, 1, 1); }
    else if (e.type === 'spider'){ ctx.fillRect(cx-2, top+4, 1, 1); ctx.fillRect(cx+1, top+4, 1, 1); }
    else if (e.type === 'ghost'){ ctx.fillStyle = '#9ad0ff'; ctx.fillRect(cx-3, top+5, 1, 1); ctx.fillRect(cx+2, top+5, 1, 1); }
    if (e.hp < e.maxHp){
      ctx.fillStyle = '#000'; ctx.fillRect(cx-7, top-6, 14, 3);
      ctx.fillStyle = '#e0533d'; ctx.fillRect(cx-6, top-5, Math.max(1, 12*e.hp/e.maxHp)|0, 1);
    }
  }
}

// ---------- lighting ----------
function lightSources(tx0, ty0, tx1, ty1, now){
  const src = [];
  if (P && scene === 'game' && !game.over){
    const lr = LAMPS[game.lampLv].r, hx = pcx()/TS, hy = (P.y+3)/TS;
    src.push({ x:hx, y:hy, r:lr + Math.sin(now*7)*.06, c:[255,240,210], k:1.3 });
    let dx = P.face, dy = 0;
    if (input.aim){ const ax = input.aim.x + .5 - hx, ay = input.aim.y + .5 - hy, l = Math.hypot(ax, ay) || 1; dx = ax/l; dy = ay/l; }
    src.push({ x:hx + dx*lr*.45, y:hy + dy*lr*.45, r:lr*.7, c:[255,240,200], k:.6 });
  }
  for (const f of flashes) src.push({ x:f.x, y:f.y, r:8, c:[255,220,150], k:f.t*7 });
  if (scene === 'game' && dayPhase().light < .8){
    src.push({ x:SHOP_X0+1.75, y:SURF-1.7, r:4.5, c:[255,200,120], k:.9 }, { x:SHOP_X1-.75, y:SURF-1.7, r:4.5, c:[255,200,120], k:.9 }, { x:(SHOP_X0+SHOP_X1+1)/2 + 1, y:SURF-1.8, r:3, c:[255,210,130], k:.8 });
  }
  for (const b of bombs) src.push({ x:b.x+.5, y:b.y+.2, r:2.2 + Math.random()*.4, c:[255,180,80], k:.8 });
  for (const e of enemies) if (e.type === 'wisp') src.push({ x:(e.x+5)/TS, y:(e.y+5)/TS, r:4 + Math.sin(e.t*12)*.3, c:[255,130,40], k:1 });
  bossLights(src);
  let lava = 0;
  for (let y=ty0-10;y<=ty1+10;y++) for (let x=tx0-10;x<=tx1+10;x++){
    if (!inb(x,y)) continue;
    const i = I(x,y), t = tiles[i];
    if (deco[i] === D.TORCH) src.push({ x:x+.5, y:y+.4, r:6.5 + Math.sin(now*9+x)*.25, c:[255,176,96], k:1.35 });
    else if (t === T.LAVA && lava < 90 && ((x+y)&1) && x>=tx0-4 && x<=tx1+4 && y>=ty0-4 && y<=ty1+4){ lava++; src.push({ x:x+.5, y:y+.5, r:3.8, c:[255,110,40], k:.9 }); }
    else if (DEF[t].glow && seen[i] && x>=tx0-2 && x<=tx1+2 && y>=ty0-2 && y<=ty1+2) src.push({ x:x+.5, y:y+.5, r:1.8, c:DEF[t].glow, k:.5 });
  }
  return src;
}
function drawLighting(tx0, ty0, tx1, ty1, now){
  const x0 = tx0-1, y0 = ty0-1, w = tx1-tx0+3, h = ty1-ty0+3;
  const [lc, lx] = LC;
  if (lc.width !== w || lc.height !== h){ lc.width = w; lc.height = h; lightImg = lx.createImageData(w, h); }
  const d = lightImg.data, src = lightSources(tx0, ty0, tx1, ty1, now);
  const dp = dayPhase(), L = dp.light;
  const skyC = [255*(.2 + .8*L) + 50*dp.dusk, 248*(.24 + .76*L) + 8*dp.dusk, 240*(.4 + .6*L)];
  for (let j=0;j<h;j++) for (let i=0;i<w;i++){
    const x = x0+i, y = y0+j;
    const sky = y <= SURF ? 1 : Math.max(0, 1 - (y-SURF)/(scene === 'home' ? 30 : 5.5));
    let r = sky*skyC[0], g = sky*skyC[1], b = sky*skyC[2];
    if (sky < 1 || L < .98) for (const s of src){
      const dx = x+.5-s.x, dy = y+.5-s.y, d2 = dx*dx + dy*dy;
      if (d2 >= s.r*s.r) continue;
      const v = (1 - Math.sqrt(d2)/s.r) * s.k;
      r += s.c[0]*v; g += s.c[1]*v; b += s.c[2]*v;
    }
    let lum = Math.max(r, g, b);
    if (inb(x,y)){
      const k = I(x,y);
      if (lum > 46) seen[k] = 1;
      else if (seen[k]){ r = Math.max(r, 30); g = Math.max(g, 27); b = Math.max(b, 44); }
    }
    const o = (j*w+i)*4;
    d[o] = r > 255 ? 255 : r; d[o+1] = g > 255 ? 255 : g; d[o+2] = b > 255 ? 255 : b; d[o+3] = 255;
  }
  lx.putImageData(lightImg, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.imageSmoothingEnabled = settings.softLight;
  ctx.drawImage(lc, x0*TS - cam.x + (settings.softLight ? 0 : 0), y0*TS - cam.y, w*TS, h*TS);
  ctx.restore();
  ctx.imageSmoothingEnabled = false;
  // additive glow
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const s of src){
    if (s.k < .8 || s.r < 3) continue;
    if (P && s.x === pcx()/TS) continue;
    const sx = s.x*TS - cam.x, sy = s.y*TS - cam.y, rad = s.r*TS*.45;
    if (sx < -rad || sx > VW+rad || sy < -rad || sy > VH+rad) continue;
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, rad);
    g.addColorStop(0, `rgba(${s.c[0]},${s.c[1]*.7|0},${s.c[2]*.4|0},.16)`); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(sx-rad, sy-rad, rad*2, rad*2);
  }
  for (const p of particles) if (p.glow){ ctx.fillStyle = p.col; ctx.globalAlpha = Math.min(1, p.life*2)*.5; ctx.fillRect(p.x - cam.x - 1|0, p.y - cam.y - 1|0, 3, 3); }
  ctx.restore();
}

// ---------- HUD ----------
function panel(x, y, w, h){
  ctx.fillStyle = 'rgba(14,11,20,.82)'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#4a3f5c'; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y+h-1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x+w-1, y, 1, h);
}
function bar(x, y, w, h, frac, col, back='#2a1a22'){
  ctx.fillStyle = '#000'; ctx.fillRect(x-1, y-1, w+2, h+2); ctx.fillStyle = back; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = col; ctx.fillRect(x, y, w*clamp(frac,0,1)|0, h); ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(x, y, w*clamp(frac,0,1)|0, 1);
}
function drawHUD(now){
  hudRects = [];
  const free = game.mode === 'free';
  panel(4, 4, 146, 58);
  text(free && game.opts.infinite ? '$ UNLIMITED' : fmtMoney(game.money), 10, 16, '#ffd24a', free && game.opts.infinite ? 6 : 8);
  if (free) text('FREE PLAY', 144, 16, '#6fd26a', 6, 'right');
  // hp
  const mh = maxHp(), low = P.hp/mh < .3;
  ctx.fillStyle = '#e0533d'; ctx.fillRect(10, 22, 3, 2); ctx.fillRect(14, 22, 3, 2); ctx.fillRect(9, 24, 9, 2); ctx.fillRect(10, 26, 7, 1); ctx.fillRect(11, 27, 5, 1); ctx.fillRect(12, 28, 3, 1);
  bar(22, 22, 90, 6, P.hp/mh, low ? ((now*6|0)%2 ? '#ff4040' : '#a02020') : '#d8403a');
  text(game.opts.invincible ? 'INV' : `${Math.ceil(Math.max(0,P.hp))}`, 117, 29, '#f1e9d2', 6);
  // depth & layer
  const ty = Math.floor((P.y+P.h)/TS), dep = depthOf(ty);
  text(`${dep}m`, 10, 41, '#9fd3f5');
  { const dp = dayPhase(); if (dp.night){ ctx.fillStyle = '#f4f1dc'; ctx.fillRect(138, 33, 3, 1); ctx.fillRect(137, 34, 2, 4); ctx.fillRect(138, 38, 3, 1); } else { ctx.fillStyle = dp.dusk > .5 ? '#ff9a4a' : '#ffe36a'; ctx.fillRect(137, 34, 5, 5); } }
  text(dep < 1 ? 'Surface' : (LAYER_NAMES[layer[I(clamp(Math.floor(pcx()/TS),0,WW-1), clamp(ty,0,WH-1))]] || ''), 48, 40, '#9a8fa8', 6);
  // bag
  const bc = bagCount(), cap = bagCap(), full = !game.opts.infinite && bc >= cap;
  text('BAG', 10, 54, '#9a8fa8', 6);
  bar(30, 49, 70, 4, game.opts.infinite ? 0 : bc/cap, full ? ((now*4|0)%2 ? '#ff5040' : '#a02020') : '#c9a36a');
  text(game.opts.infinite ? `${bc}` : `${bc}/${cap}`, 144, 54, full ? '#ff5040' : '#f1e9d2', 6, 'right');
  // goal / mode (top right)
  let ry = 4;
  if (!free){
    const tag = game.diff !== 'normal', ph = tag ? 32 : 24;
    panel(VW-116, ry, 112, ph);
    text(`RETIRE AT $${goalOf()/1000}K`, VW-110, ry+11, '#9a8fa8', 6);
    bar(VW-110, ry+15, 100, 4, game.money/goalOf(), '#ffd24a');
    if (tag) text(diff().name.toUpperCase(), VW-110, ry+28, diff().col, 6);
    ry += ph + 4;
  }
  if (settings.minimap) drawMinimap(VW-70, ry, now);
  drawBossBar();
  // hotbar
  const items = [['ladder','1'], ['support','2'], ['torch','3'], ['dynamite','4'], ['platform','5'], ['post','6'], ['medkit','H'], ['beacon','R']];
  const slot = VW < 320 ? 22 : VW < 400 ? 26 : 30, gap = VW < 400 ? 2 : 4, bw = items.length*(slot+gap) - gap + 6;
  const bx = (VW - bw)/2 | 0, by = VH - slot - 6 - (isTouch ? 64 : 0);
  items.forEach(([k, key], n) => {
    const x = bx + n*(slot+gap) + (n >= ITEMS.length ? 6 : 0), sel = n === game.sel;
    ctx.fillStyle = sel ? '#ffd24a' : '#000'; ctx.fillRect(x-1, by-1, slot+2, slot+2);
    ctx.fillStyle = sel ? 'rgba(60,48,20,.92)' : 'rgba(22,18,30,.9)'; ctx.fillRect(x, by, slot, slot);
    ctx.drawImage(ICON[k], x + (slot-16)/2|0, by + (slot > 26 ? 4 : 2));
    const count = game.opts.infinite ? 'INF' : String(game[k]);
    text(count, x+slot-2, by+slot-3, (game.opts.infinite || game[k]) ? '#f1e9d2' : '#e0533d', 6, 'right');
    if (!isTouch) text(key, x+2, by+8, '#9a8fa8', 6);
    hudRects.push({ x, y:by, w:slot, h:slot, action: n === ITEMS.length ? 'medkit' : n === ITEMS.length+1 ? 'beacon' : 'sel', n });
  });
  // jetpack fuel above the miner
  const jmax = JETPACKS[game.jetLv||0].fuel;
  if (jmax && P.fuel < jmax - .01){ const X = pcx() - cam.x - 8|0, Y = P.y - cam.y - 10|0; ctx.fillStyle = '#000'; ctx.fillRect(X-1, Y-1, 18, 4); ctx.fillStyle = P.fuel/jmax < .25 ? '#e0533d' : '#5aa2ff'; ctx.fillRect(X, Y, 16*clamp(P.fuel/jmax,0,1)|0, 2); }
  // contract ready marker over the shop
  if (game.mode === 'career' && contractReady()){
    const X = (SHOP_X0 + SHOP_X1 + 1)/2*TS - cam.x|0, Y = SURF*TS - 116 - cam.y + Math.sin(now*5)*3|0;
    if (Y > -10 && Y < VH){ ctx.fillStyle = '#000'; ctx.fillRect(X-4, Y-1, 8, 16); ctx.fillStyle = '#ffd24a'; ctx.fillRect(X-3, Y, 6, 9); ctx.fillRect(X-3, Y+11, 6, 3); }
  }
  // recall charge
  if (game.recall){
    const p = game.recall.t / game.recall.dur;
    text('RECALLING...', VW/2, by - 24, '#8fd0ff', 6, 'center'); bar(VW/2 - 40, by - 20, 80, 4, p, '#5aa2ff');
  }
  // mining progress crack
  if (P.mining && !P.mining.deny && P.mineT > 0 && DEF[get(P.mining.x,P.mining.y)].solid){
    const d = DEF[get(P.mining.x,P.mining.y)], p = clamp(P.mineT / (d.time/PICKS[game.pick].speed), 0, 1);
    ctx.drawImage(CRACK[clamp(Math.floor(p*4),0,3)], P.mining.x*TS - cam.x|0, P.mining.y*TS - cam.y|0);
  }
  // cursor
  const aim = input.aim || (input.digKey ? mineTarget() : null);
  if (aim && !game.paused && input.pointerType === 'mouse' && inReach(aim.x, aim.y) && !isSolid(aim.x, aim.y) && inb(aim.x, aim.y) && !deco[I(aim.x, aim.y)] && get(aim.x, aim.y) !== T.LAVA){
    const k = ITEMS[game.sel], X = aim.x*TS - cam.x|0, Y = aim.y*TS - cam.y|0;
    const bad = (k === 'platform' && bridgeDist(aim.x, aim.y) > BRIDGE_REACH) || (k === 'post' && (!postStands(aim.x, aim.y) || postHeight(aim.x, aim.y) >= 8));
    ctx.globalAlpha = .45; ctx.drawImage(k === 'platform' || k === 'post' ? PROP[k] : ICON[k], X, Y); ctx.globalAlpha = 1;
    if (bad){ ctx.fillStyle = 'rgba(224,83,61,.35)'; ctx.fillRect(X, Y, TS, TS); }
    else if (k === 'platform'){ const dist = bridgeDist(aim.x, aim.y); if (dist > 0) text(`${dist}/${BRIDGE_REACH}`, X + 8, Y - 3, dist >= BRIDGE_REACH ? '#ffb040' : '#9a8fa8', 6, 'center'); }
  }
  const foe = input.aimPx && input.pointerType === 'mouse' ? enemyAt(input.aimPx.x, input.aimPx.y) : null;
  if (foe && !game.paused){ const X = foe.x - cam.x - 3|0, Y = foe.y - cam.y - 3|0, W = foe.def.w + 6, H = foe.def.h + 6; ctx.strokeStyle = 'rgba(255,90,70,.9)'; ctx.lineWidth = 1; ctx.strokeRect(X+.5, Y+.5, W, H); }
  else if (aim && !game.paused && (input.pointerType === 'mouse' || input.mining || input.digKey)){
    const ok = inReach(aim.x, aim.y), X = aim.x*TS - cam.x|0, Y = aim.y*TS - cam.y|0;
    ctx.strokeStyle = ok ? ((input.buildMode || input.buildKey) ? 'rgba(111,210,106,.9)' : 'rgba(255,255,255,.75)') : 'rgba(255,80,60,.55)'; ctx.lineWidth = 1;
    ctx.strokeRect(X+.5, Y+.5, TS-1, TS-1);
    if (ok){ ctx.fillStyle = ctx.strokeStyle; ctx.fillRect(X-1, Y-1, 3, 1); ctx.fillRect(X-1, Y-1, 1, 3); ctx.fillRect(X+TS-2, Y+TS, 3, 1); ctx.fillRect(X+TS, Y+TS-2, 1, 3); }
  }
  if (nearShop() && !game.paused) text(isTouch ? 'Tap SHOP to trade' : 'Press E to open the shop', VW/2, by - 10, '#ffd24a', 8, 'center');
  // messages
  let my = Math.max(80, ry + 60);
  if (VW > 420) my = 76;
  for (const m of messages){ ctx.globalAlpha = clamp(m.life / Math.min(.6, m.max), 0, 1); text(m.text, VW/2, my, m.col, VW < 360 ? 6 : 8, 'center'); my += 12; }
  ctx.globalAlpha = 1;
  // banner (new layer)
  if (game.banner && game.banner.t > 0){
    const a = clamp(Math.min(game.banner.t, 3.5 - game.banner.t) * 2, 0, 1);
    ctx.globalAlpha = a; text(game.banner.text, VW/2, VH*.32, '#ffd24a', VW < 360 ? 10 : 16, 'center'); text(game.banner.sub, VW/2, VH*.32 + 16, '#f1e9d2', 6, 'center'); ctx.globalAlpha = 1;
  }
  // damage vignette & low hp pulse
  if (P.hurtT > 0 && !game.opts.invincible){ ctx.fillStyle = `rgba(200,20,20,${P.hurtT*.45})`; ctx.fillRect(0, 0, VW, VH); }
  if (low && !game.opts.invincible){
    const a = (Math.sin(now*6)+1)*.09, g = ctx.createRadialGradient(VW/2, VH/2, VH*.3, VW/2, VH/2, VW*.7);
    g.addColorStop(0, 'rgba(160,0,0,0)'); g.addColorStop(1, `rgba(160,0,0,${a+.1})`); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  }
  if (muted) text('MUTED', VW-6, VH-6, '#9a8fa8', 6, 'right');
  // autosave indicator
  if (savedFx > 0){
    savedFx -= 1/60; ctx.globalAlpha = clamp(savedFx, 0, 1);
    const X = VW - 44, Y = VH - (isTouch ? 110 : 16);
    ctx.fillStyle = '#5aa2ff'; ctx.fillRect(X, Y-7, 8, 8); ctx.fillStyle = '#e8e4dc'; ctx.fillRect(X+2, Y-7, 4, 3); ctx.fillStyle = '#1a1020'; ctx.fillRect(X+2, Y-2, 4, 2);
    text('SAVED', X + 11, Y, '#9fd3f5', 6); ctx.globalAlpha = 1;
  }
  // backpack full: point the way home
  if (full && dep > 2){
    const sx = (SHOP_X0 + SHOP_X1 + 1)/2*TS - cam.x, sy = SURF*TS - cam.y;
    const cx = VW/2, cy = VH/2, a = Math.atan2(sy - cy, sx - cx), r = Math.min(VW, VH)/2 - 34;
    const ax = cx + Math.cos(a)*r, ay = cy + Math.sin(a)*r, pulse = 1 + Math.sin(now*6)*.12;
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(a); ctx.scale(pulse, pulse);
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -8); ctx.lineTo(-2, 0); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-5, -6); ctx.lineTo(-2, 0); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
    text('SHOP', ax, ay + 18, '#ffd24a', 6, 'center');
  }
  // tutorial hint
  if (game.hint && !game.paused){
    const w = Math.min(VW - 16, 330), per = Math.floor((w - 16)/6), words = game.hint.text.split(' '), lines = [''];
    for (const wd of words){ if ((lines[lines.length-1] + ' ' + wd).trim().length > per) lines.push(wd); else lines[lines.length-1] = (lines[lines.length-1] + ' ' + wd).trim(); }
    const h = 18 + lines.length*10, x = (VW - w)/2|0, y = by - 22 - h - (nearShop() ? 10 : 0);
    const a = clamp(Math.min(game.hint.t, 8 - game.hint.t)*3, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(14,11,20,.9)'; ctx.fillRect(x, y, w, h); ctx.fillStyle = '#ffd24a'; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y+h-1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x+w-1, y, 1, h);
    text('TIP', x + 7, y + 11, '#ffd24a', 6);
    lines.forEach((ln, i) => text(ln, x + 8, y + 22 + i*10, '#f1e9d2', 6));
    ctx.globalAlpha = 1;
  }
}
function drawMinimap(x, y, now){
  const [mc, mx] = MM, w = 64, h = 48;
  mmTimer -= 1/60;
  if (mmTimer <= 0){
    mmTimer = .25;
    const img = mx.createImageData(w, h), d = img.data;
    const cx = Math.floor(pcx()/TS) - w/2, cy = Math.floor(pcy()/TS) - h/2;
    for (let j=0;j<h;j++) for (let i=0;i<w;i++){
      const tx = cx+i, ty = cy+j, o = (j*w+i)*4;
      let c = [8,6,12];
      if (ty < SURF && ty >= 0 && tx >= 0 && tx < WW) c = [110,170,230];
      else if (inb(tx,ty) && (seen[I(tx,ty)] || ty <= SURF+1)){ c = MINI_COL[tiles[I(tx,ty)]]; const dc = deco[I(tx,ty)]; if (dc === D.LADDER) c = [170,120,60]; else if (dc === D.SUPPORT) c = [200,150,80]; else if (dc === D.TORCH) c = [255,210,90]; else if (dc === D.PLATFORM || dc === D.POST) c = [196,140,76]; }
      d[o] = c[0]; d[o+1] = c[1]; d[o+2] = c[2]; d[o+3] = 255;
    }
    mx.putImageData(img, 0, 0);
  }
  ctx.fillStyle = '#000'; ctx.fillRect(x-2, y-2, w+4, h+4); ctx.fillStyle = '#4a3f5c'; ctx.fillRect(x-1, y-1, w+2, h+2);
  ctx.drawImage(mc, x, y);
  if ((now*3|0) % 2){ ctx.fillStyle = '#fff'; ctx.fillRect(x + w/2, y + h/2, 1, 1); ctx.fillStyle = '#ffd24a'; ctx.fillRect(x + w/2 - 1, y + h/2, 1, 1); ctx.fillRect(x + w/2 + 1, y + h/2, 1, 1); ctx.fillRect(x + w/2, y + h/2 - 1, 1, 1); }
}

// ---------- frame ----------
function render(now){
  const sx = shakeAmt ? (Math.random()-.5)*shakeAmt*2 : 0, sy = shakeAmt ? (Math.random()-.5)*shakeAmt*2 : 0;
  const saved = { x:cam.x, y:cam.y };
  cam.x = Math.round(cam.x + sx); cam.y = Math.round(cam.y + sy);
  ctx.fillStyle = '#07050b'; ctx.fillRect(0, 0, VW, VH);
  drawSky(now);
  drawSurface(now);
  const tx0 = Math.floor(cam.x/TS), ty0 = Math.floor(cam.y/TS), tx1 = tx0 + Math.ceil(VW/TS), ty1 = ty0 + Math.ceil(VH/TS);
  drawTiles(tx0, ty0, tx1, ty1, now);
  for (const c of caveins){ if (c.t > 2.5) continue; const st = clamp(3 - Math.floor(c.t/2.5*4), 0, 3); ctx.drawImage(CRACK[st], c.x*TS - cam.x + ((now*30|0)%2)|0, (c.y-1)*TS - cam.y|0); }
  for (const r of rocks) ctx.drawImage(r.type === 'plank' ? PROP[r.prop] : TEX[r.type==='gravel' ? T.GRAVEL : T.RUBBLE][0], r.x - cam.x|0, r.y - cam.y|0);
  if (scene === 'game') drawEntities(now);
  if (scene === 'home') drawHomeMiner(now); else drawPlayer(now);
  for (const p of particles){ if (p.glow) continue; ctx.fillStyle = p.col; ctx.fillRect(p.x - cam.x|0, p.y - cam.y|0, p.sz, p.sz); }
  drawLighting(tx0, ty0, tx1, ty1, now);
  drawNightSky(now);
  if (scene === 'game'){ drawEnemyOverlay(now); drawBossGlow(now); }
  for (const p of particles){ if (!p.glow) continue; ctx.fillStyle = p.col; ctx.fillRect(p.x - cam.x|0, p.y - cam.y|0, p.sz, p.sz); }
  for (const f of floaters){ ctx.globalAlpha = clamp(f.life*1.5, 0, 1); text(f.text, f.x - cam.x|0, f.y - cam.y|0, f.col, 6, 'center'); }
  ctx.globalAlpha = 1;
  if (scene === 'game' && P) drawHUD(now);
  if (scene === 'game'){ drawAchToasts(now); drawRewindFx(); }
  if (scene === 'game' && mapOpen) drawMap(now);
  if (fadeA > 0){ ctx.fillStyle = `rgba(7,5,11,${fadeA})`; ctx.fillRect(0, 0, VW, VH); }
  cam.x = saved.x; cam.y = saved.y;
}

// ---------- the miner who wanders around behind the home screen ----------
const homeMiner = { x: 26*TS, dir: 1, state: 'walk', stateT: 3, walk: 0 };
function stepHomeMiner(dt){
  const m = homeMiner; m.stateT -= dt;
  if (m.state === 'walk'){
    m.x += m.dir*30*dt; m.walk += dt*10;
    const lo = Math.max(20*TS, cam.x + 20), hi = Math.min(cam.x + VW - 20, (WW-4)*TS);   // stay on screen, clear of the shaft
    if (m.x < lo){ m.dir = 1; } if (m.x > hi){ m.dir = -1; }
    if (m.stateT <= 0){ m.state = 'dig'; m.stateT = 1.6 + Math.random()*1.6; }
  } else {
    if (Math.random() < dt*9){ burst(m.x + m.dir*12, SURF*TS + 1, Math.random() < .5 ? '#8a5a30' : '#5fb83e', 2, 45, 300, .5); if (Math.random() < .5) SFX.hit(); }
    if (m.stateT <= 0){ m.state = 'walk'; m.stateT = 3 + Math.random()*4; if (Math.random() < .45) m.dir *= -1; }
  }
}
function drawHomeMiner(now){
  const m = homeMiner, digging = m.state === 'dig';
  const spr = MINER[digging ? 0 : (m.walk|0) % 4][m.dir > 0 ? 0 : 1];
  const sx = Math.round(m.x - 7 - cam.x), sy = Math.round(SURF*TS - 17 - cam.y);
  const ang = digging ? (-1.3 + (Math.sin(now*14)+1)*1.15) : -.25;
  const hx = sx + (m.dir > 0 ? 10 : 4), hy = sy + 11;
  const pick = () => { ctx.save(); ctx.translate(hx, hy); ctx.scale(m.dir, 1); ctx.rotate(ang); ctx.drawImage(PICK_SPR[1], -2, -12); ctx.restore(); };
  if (!digging) pick();
  ctx.drawImage(spr, sx, sy);
  if (digging) pick();
}
