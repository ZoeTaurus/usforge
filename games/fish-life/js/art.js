'use strict';
/* =====================================================================
   FISH LIFE  -  art.js
   All the pixel art: sprites authored as character grids, fish that
   are generated pixel-by-pixel, and painters for bigger scenery.
   ===================================================================== */

/* ---------------------------------------------------------------- fish
   A small procedural fish generator. Every species is described by a
   handful of numbers; the body, tail, fins, eye and shading are then
   plotted pixel by pixel and finished with an automatic outline.      */
function genFish(o, frame) {
  const L = o.L, BH = o.H, T = o.tail, TH = o.tailH;
  const top = o.dorsal ? o.dorsal.h : 0;
  const bot = o.ventral ? o.ventral.h : 0;
  const w = T + L, h = Math.max(BH, TH) + top + bot;
  const cy = top + Math.max(BH, TH) / 2;           // body centre line (pixel edges)
  const grid = new Array(w * h).fill(null);
  const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < w && y < h) grid[y * w + x] = c; };
  const get = (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? grid[y * w + x] : null);
  const C = o.colors;
  const bx0 = T, rx = L / 2, ry = BH / 2, bcx = bx0 + rx;
  // tail (drawn first so the body overlaps it)
  const skew = frame === 1 ? 1 : 0;
  for (let x = 0; x <= T; x++) {
    const t = (T - x) / T;                            // 0 at body, 1 at tip
    const half = lerp(o.tailRoot || 1, TH / 2, t);
    const off = skew * t * (o.tailWag || 1.2);
    for (let y = 0; y < h; y++) {
      const dy = y + 0.5 - cy + off;
      if (Math.abs(dy) > half) continue;
      if (o.fork && t > 0.45 && Math.abs(dy) < o.fork * (t - 0.45) * TH) continue;
      set(x, y, Math.abs(dy) > half - 1 && t > 0.3 ? C.finD : C.fin);
    }
  }
  // dorsal fin
  if (o.dorsal) {
    const d = o.dorsal, dx0 = Math.round(bx0 + L * d.pos), dw = d.w;
    for (let i = 0; i < dw; i++) {
      const k = d.shape === 'shark' ? 1 - Math.abs(i - dw * 0.35) / (dw * 0.65) : 1 - Math.abs(i - (dw - 1) / 2) / (dw / 2 + 0.5);
      const hh = Math.max(1, Math.round(d.h * clamp(k, 0.15, 1) + (d.shape === 'spiky' && i % 2 ? -1 : 0)));
      for (let j = 0; j < hh + 1; j++) set(dx0 + i, Math.floor(cy - ry) - j, j >= hh - 1 ? C.finD : C.fin);
    }
  }
  if (o.ventral) {
    const v = o.ventral, vx0 = Math.round(bx0 + L * v.pos);
    for (let i = 0; i < v.w; i++) for (let j = 0; j < v.h - (i > 0 ? 1 : 0) + 1; j++) set(vx0 + i - (frame ? 1 : 0), Math.ceil(cy + ry) - 1 + j, j >= v.h - 1 ? C.finD : C.fin);
  }
  // body
  for (let y = 0; y < h; y++) {
    for (let x = bx0; x < w; x++) {
      const nx = (x + 0.5 - bcx) / rx, ny = (y + 0.5 - cy) / ry;
      const sx = nx > 0 ? Math.pow(Math.abs(nx), o.nose || 2) : nx * nx;
      if (sx + ny * ny > 1.02) continue;
      let c = ny < -0.35 ? C.top : ny > 0.4 ? C.belly : C.mid;
      if (o.stripes) for (const s of o.stripes) if (Math.abs(x - (bx0 + L * s)) < 0.8 && ny < 0.55) c = C.stripe;
      if (o.lateral && Math.abs(ny) < 0.18 && nx < 0.6) c = C.stripe;
      if (o.spots && ((x * 7 + y * 13) % 11 === 0) && ny < 0.3) c = C.stripe;
      set(x, y, c);
    }
  }
  // highlight along the back
  for (let x = bx0 + 1; x < w - 2; x++) {
    for (let y = 0; y < h; y++) {
      if (get(x, y) === C.top || get(x, y) === C.mid) {
        if (o.shine !== false && get(x, y - 1) === null && x > bx0 + rx * 0.4 && x < bx0 + L * 0.8) set(x, y, C.shine || C.mid);
        break;
      }
    }
  }
  // gills
  if (o.gills) for (let g = 0; g < o.gills; g++) {
    const gx = Math.round(bx0 + L * (0.62 - g * 0.05));
    for (let y = Math.round(cy - ry * 0.3); y <= Math.round(cy + ry * 0.2); y++) if (get(gx, y)) set(gx, y, C.stripe);
  }
  // eye
  const ex = Math.round(bx0 + L * (o.eyeX || 0.78)), ey = Math.floor(cy - ry * (o.eyeY || 0.3));
  if (o.eye === 'big') { set(ex - 1, ey - 1, C.eyeW); set(ex, ey - 1, C.eyeW); set(ex - 1, ey, C.eyeW); set(ex, ey, C.eyeK); }
  else if (o.eye === 'mean') { set(ex, ey, C.eyeK); set(ex - 1, ey - 1, C.eyeK); set(ex - 1, ey, C.eyeW); }
  else if (o.eye === 'white') { set(ex, ey, C.eyeW); set(ex + 1, ey, C.eyeK); }
  else set(ex, ey, C.eyeK);
  // mouth / teeth
  const my = Math.round(cy + (o.mouthY || 0.5));
  if (o.teeth) for (let i = 2; i < o.teeth + 2; i += 2) set(w - 1 - i, my, '#ffffff');
  else if (o.mouth !== false) set(w - 2, my, C.finD);
  // render + outline
  const c = makeCanvas(w, h), g = c.getContext('2d');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (grid[y * w + x]) { g.fillStyle = grid[y * w + x]; g.fillRect(x, y, 1, 1); }
  return outlineCanvas(c, C.out);
}

const FISH_DEFS = {
  hero0: { L: 6, H: 4, tail: 3, tailH: 4, eye: 'big', eyeX: 0.72, eyeY: 0.1, mouthY: 0.5, shine: false,
    colors: { top: '#f77622', mid: '#feae34', belly: '#fee761', fin: '#feae34', finD: '#f77622', eyeW: '#ffffff', eyeK: '#181425', stripe: '#be4a2f', out: '#3e2731' } },
  hero1: { L: 9, H: 6, tail: 4, tailH: 6, fork: 0.35, eye: 'big', eyeX: 0.74, dorsal: { pos: 0.25, w: 4, h: 2 },
    colors: { top: '#f77622', mid: '#f99034', belly: '#fee761', shine: '#feae34', fin: '#feae34', finD: '#f77622', eyeW: '#ffffff', eyeK: '#181425', stripe: '#be4a2f', out: '#3e2731' } },
  hero2: { L: 12, H: 8, tail: 5, tailH: 9, fork: 0.4, eye: 'big', eyeX: 0.76, eyeY: 0.28, dorsal: { pos: 0.22, w: 6, h: 3 }, ventral: { pos: 0.45, w: 2, h: 2 },
    colors: { top: '#e8641c', mid: '#f77622', belly: '#fee761', shine: '#feae34', fin: '#feae34', finD: '#e8641c', eyeW: '#ffffff', eyeK: '#181425', stripe: '#be4a2f', out: '#3e2731' } },
  guppy: { L: 4, H: 3, tail: 3, tailH: 6, tailRoot: 0.5, fork: 0.3, shine: false,
    colors: { top: '#8b9bb4', mid: '#c0cbdc', belly: '#ffffff', fin: '#f6757a', finD: '#b55088', eyeW: '#fff', eyeK: '#181425', stripe: '#5a6988', out: '#262b44' } },
  minnow: { L: 8, H: 4, tail: 3, tailH: 5, fork: 0.3, lateral: true, dorsal: { pos: 0.3, w: 2, h: 1 },
    colors: { top: '#3e8948', mid: '#9fb88f', belly: '#e8eef7', shine: '#b8d0a8', fin: '#8b9bb4', finD: '#5a6988', eyeW: '#fff', eyeK: '#181425', stripe: '#265c42', out: '#193c3e' } },
  perch: { L: 12, H: 8, tail: 4, tailH: 8, fork: 0.25, stripes: [0.3, 0.45, 0.6], eye: 'mean', dorsal: { pos: 0.15, w: 7, h: 3, shape: 'spiky' }, ventral: { pos: 0.4, w: 2, h: 2 },
    colors: { top: '#7a9a2a', mid: '#c8c040', belly: '#f0e6a0', shine: '#dcd46a', fin: '#f77622', finD: '#be4a2f', eyeW: '#fee761', eyeK: '#181425', stripe: '#3e5a1a', out: '#1f2a10' } },
  barracuda: { L: 20, H: 4, tail: 4, tailH: 7, fork: 0.5, nose: 1.3, spots: true, eye: 'mean', eyeX: 0.8, teeth: 5, mouthY: 0.5, dorsal: { pos: 0.3, w: 2, h: 2 },
    colors: { top: '#5a6988', mid: '#a9b6c9', belly: '#e8eef7', shine: '#c0cbdc', fin: '#8b9bb4', finD: '#3a4466', eyeW: '#fee761', eyeK: '#181425', stripe: '#3a4466', out: '#181425' } },
  shark: { L: 34, H: 11, tail: 9, tailH: 16, fork: 0.7, nose: 1.5, gills: 3, eye: 'mean', eyeX: 0.84, eyeY: 0.2, teeth: 8, mouthY: 2.5, dorsal: { pos: 0.35, w: 8, h: 7, shape: 'shark' }, ventral: { pos: 0.45, w: 4, h: 3 },
    colors: { top: '#5a6988', mid: '#6f7fa0', belly: '#e8eef7', shine: '#8b9bb4', fin: '#5a6988', finD: '#3a4466', eyeW: '#e8eef7', eyeK: '#181425', stripe: '#3a4466', out: '#181425' } },
  goldfish: { L: 6, H: 4, tail: 4, tailH: 7, tailRoot: 0.5, fork: 0.35, shine: false,
    colors: { top: '#f77622', mid: '#feae34', belly: '#fee761', fin: '#feae34', finD: '#f77622', eyeW: '#fff', eyeK: '#181425', stripe: '#be4a2f', out: '#3e2731' } },
  bluefish: { L: 6, H: 4, tail: 4, tailH: 7, tailRoot: 0.5, fork: 0.35, shine: false,
    colors: { top: '#124e89', mid: '#0099db', belly: '#2ce8f5', fin: '#2ce8f5', finD: '#0099db', eyeW: '#fff', eyeK: '#181425', stripe: '#124e89', out: '#0b1330' } },
};

/* ---------------------------------------------------- small sprites */
function buildSprites() {
  for (const k in FISH_DEFS) addSprite(k, [genFish(FISH_DEFS[k], 0), genFish(FISH_DEFS[k], 1)]);

  defSprite('cursor', { k: '#07060f', w: '#ffffff', g: '#c0cbdc' }, [
    'k.......', 'kk......', 'kwk.....', 'kwwk....', 'kwwwk...', 'kwwwwk..', 'kwwwwwk.', 'kwwwkkkk', 'kwkwk...', 'kk.kwk..', 'k..kwk..', '....k...',
  ]);
  defSprite('cursorFish', { o: '#3e2731', a: '#f77622', y: '#fee761', w: '#ffffff', k: '#181425' },
    ['..ooo..', 'o.oaaao', 'oaaawko', 'o.oyyyo', '..ooo..'],
    ['o.ooo..', '.oaaaao', '.aaawko', '.ooyyyo', 'o.ooo..']);
  defSprite('heart', { k: '#3e2731', r: '#e43b44', p: '#ff8f8f', d: '#a22633' },
    ['.kk.kk.', 'kprkrrk', 'krrrrrk', 'kdrrrdk', '.kdrdk.', '..kdk..', '...k...']);
  defSprite('heartEmpty', { k: '#3e2731', r: '#3a4466', d: '#262b44' },
    ['.kk.kk.', 'krrkrrk', 'krdddrk', 'kdddddk', '.kdddk.', '..kdk..', '...k...']);
  defSprite('crab', { k: '#3e2731', r: '#e43b44', o: '#f77622', w: '#ffffff', d: '#a22633' },
    ['.k.....k..', 'krk...krk.', 'krrk.krrk.', '.kk.w.w.k.', '..krrrrrk.', '.krorrrork', 'kkrrrrrrrk', '.k.k.k.k..'],
    ['krk.....krk', 'krrk...krrk', '.kk..w.w.k.', '..kkrrrrk..', '.krrorrrork', 'kkrrrrrrrk.', '.k.k..k.k..', '...........']);
  defSprite('krill', { k: '#68386c', p: '#f6757a', w: '#ffe0e8', e: '#181425' },
    ['..kkk.', 'kppppe', '.kwwk.'], ['k.kkk.', '.ppppe', 'k.wwk.']);
  defSprite('gull', { k: '#262b44', w: '#ffffff', g: '#c0cbdc', o: '#feae34' },
    ['k.........k', 'wk.......kw', '.gw.www.wg.', '..gwwwwwgo.', '....www....'],
    ['...........', '...........', '.kgwwwwwgko', 'kgw.www.wgk', 'k...www...k']);
  defSprite('gullDive', { k: '#262b44', w: '#ffffff', g: '#c0cbdc', o: '#feae34' },
    ['.k.k.', 'kwkwk', 'kwwwk', '.gwg.', '.www.', '.www.', '..w..', '..o..', '..o..']);
  defSprite('bulb', { k: '#3e2731', y: '#fee761', w: '#ffffff', o: '#feae34', g: '#8b9bb4', d: '#5a6988' },
    ['.kkk.', 'kwyyk', 'kyyyk', 'kyyok', '.kok.', '.kgk.', '.kdk.', '..k..']);
  defSprite('bulbGold', { k: '#3e2731', y: '#ffffff', w: '#ffffff', o: '#fee761', g: '#feae34', d: '#be4a2f' },
    ['.kkk.', 'kwyyk', 'kyyyk', 'kyyok', '.kok.', '.kgk.', '.kdk.', '..k..']);
  defSprite('brain', { k: '#3e2731', p: '#f6757a', l: '#ffb0c8', d: '#b55088' },
    ['.kkkkk.', 'klplppk', 'kpdpdlk', 'kplpdpk', 'kpdplpk', '.kkdkk.', '...kk..']);
  defSprite('flakeIcon', { k: '#3e2731', r: '#e43b44', y: '#fee761', o: '#f77622' },
    ['.kk.', 'kryk', 'koyk', '.kk.']);
  defSprite('flakeIconEmpty', { k: '#5a6988' }, ['.kk.', 'k..k', 'k..k', '.kk.']);
  defSprite('bolt', { k: '#3e2731', y: '#fee761', o: '#feae34' },
    ['..kkk', '.kyyk', '.kyk.', 'kyyyk', '.kyk.', '.kok.', '.kk..']);
  defSprite('fishbone', { w: '#e8eef7', g: '#8b9bb4', k: '#3e2731' },
    ['kk.......kkk.', 'kgk.k.k.kwwwk', '.kgwgwgwgwkwk', 'kgk.k.k.kwwwk', 'kk.......kkk.']);
  defSprite('star', { o: '#f77622', y: '#feae34', k: '#3e2731' },
    ['..k..', '.kyk.', 'kyoyk', '.kyk.', 'k.k.k']);
  defSprite('shell', { p: '#f6757a', w: '#ffe0e8', k: '#68386c' },
    ['.kkk.', 'kwpwk', 'kpwpk', '.kkk.']);
  defSprite('glasses', { k: '#181425', w: '#c8f4ff' }, ['kkk.kkk', 'kwk.kwk', 'kkkkkkk']);
  defSprite('tie', { k: '#181425', r: '#e43b44', d: '#a22633' }, ['.k.', 'krk', '.r.', 'krk', 'kdk', '.k.']);
  defSprite('helmet', { k: '#181425', s: '#c0cbdc', d: '#8b9bb4', r: '#e43b44', w: '#ffffff' },
    ['...r...', '...k...', '...k...', '.kkkkk.', 'kswsssk', 'ksssddk', 'kkkkkkk']);
  defSprite('crown', { k: '#3e2731', y: '#fee761', o: '#feae34', r: '#e43b44', b: '#0099db' },
    ['k..k..k', 'yk.y.ky', 'yyyyyyy', 'yrybyry', 'ooooooo']);
  defSprite('partyhat', { k: '#3e2731', p: '#f6757a', y: '#fee761', w: '#ffffff' }, ['...w...', '...k...', '..kpk..', '..kyk..', '.kpppk.', '.kyyyk.', 'kpppppk']);
  defSprite('shades', { k: '#181425', s: '#3a4466', w: '#8b9bb4' }, ['kkkkkkk', 'kwkkwkk', '.kk.kk.']);
  defSprite('stache', { k: '#3e2731', b: '#733e39' }, ['.kk.kk.', 'kbbkbbk', 'k..k..k']);
  defSprite('monocle', { k: '#feae34', w: '#c8f4ff' }, ['.kk.', 'kwwk', 'kwwk', '.kk.', '...k', '...k']);
}

/* ------------------------------------------------ scenery painters */
// Kelp stalk that sways with time.
// Kelp stalk that sways with time. The swaying loop is baked into a small
// set of frames per stalk height, so each stalk costs a single blit.
const KELP_FRAMES = 32, KELP_PERIOD = (Math.PI * 2) / 1.3;
function paintKelp(x, baseY, height, a, dark, light) {
  const segs = Math.floor(height / 3);
  let prevX = x;
  for (let i = 0; i <= segs; i++) {
    const k = i / segs;
    const sx = x + Math.sin(a + i * 0.28) * k * k * 6 + Math.sin(a + 1) * k * 1.5;
    const sy = baseY - i * 3;
    rect(Math.round(sx), sy - 3, 2, 4, dark);
    if (i % 2 === 0 && i > 1) {
      const side = (i / 2) % 2 ? 1 : -1;
      const lx = Math.round(sx) + (side > 0 ? 2 : -3);
      rect(lx, sy - 2, 3, 2, light);
      px(lx + (side > 0 ? 3 : -1), sy - 3, light);
    }
    prevX = sx;
  }
  px(Math.round(prevX), baseY - segs * 3 - 4, light);
}
const _kelpCache = new Map();
function drawKelp(x, baseY, height, t, phase, dark, light) {
  const hb = Math.max(20, Math.round(height / 10) * 10);
  const f = (Math.floor((t / KELP_PERIOD) * KELP_FRAMES) + Math.round((phase / (Math.PI * 2)) * KELP_FRAMES)) % KELP_FRAMES;
  const key = hb + dark + light + '|' + f;
  let c = _kelpCache.get(key);
  if (!c) {
    c = makeCanvas(26, hb + 8);
    const prev = setTarget(c.getContext('2d'));
    paintKelp(13, hb + 6, hb, (f / KELP_FRAMES) * Math.PI * 2, dark, light);
    setTarget(prev);
    _kelpCache.set(key, c);
  }
  gfx.drawImage(c, Math.round(x) - 13, Math.round(baseY) - hb - 6);
}

// Fishing trawler floating on the surface line `sy`.
function drawBoat(x, sy, t, dark) {
  x = Math.round(x);
  const bob = Math.round(Math.sin(t * 1.6) * 1);
  const y = sy + bob;
  if (dark) {
    const c = dark;
    rect(x - 26, y - 6, 52, 6, c); rect(x - 22, y, 44, 3, c);
    rect(x - 10, y - 14, 18, 8, c); rect(x + 12, y - 30, 2, 24, c);
    line(x + 13, y - 29, x - 16, y - 12, c);
    return;
  }
  // hull
  rect(x - 30, y - 8, 60, 2, '#e8eef7');
  rect(x - 29, y - 6, 58, 4, '#a22633');
  rect(x - 27, y - 2, 54, 3, '#6e1522');
  rect(x - 24, y + 1, 48, 3, '#3e1a24');
  rect(x + 26, y - 10, 5, 3, '#e8eef7');
  // cabin
  rect(x - 14, y - 20, 22, 12, '#e8eef7');
  rect(x - 14, y - 22, 22, 2, '#3a4466');
  for (let i = 0; i < 3; i++) rect(x - 11 + i * 7, y - 17, 4, 4, '#0099db');
  rect(x - 12, y - 10, 18, 2, '#c0cbdc');
  // mast & crane
  rect(x + 14, y - 38, 2, 30, '#5a6988');
  line(x + 15, y - 37, x - 24, y - 26, '#5a6988');
  line(x - 24, y - 26, x - 24, y - 12, '#c0cbdc');
  rect(x + 12, y - 40, 6, 2, '#e43b44');
  // floats
  for (let i = 0; i < 4; i++) disc(x - 22 + i * 6, y - 9, 1, '#f77622');
}

// A tall fishing net panel. top = surface y, bottom = floor y.
function drawNet(x, top, bottom, w) {
  x = Math.round(x); top = Math.round(top); bottom = Math.round(bottom);
  const hgt = bottom - top;
  if (hgt <= 0) return;
  gfx.globalAlpha = 0.85;
  const col = '#e8dcc0';
  for (let k = -hgt; k < w; k += 6) {
    const x0 = x + k, x1 = x + k + hgt;
    const a0 = Math.max(0, -k), a1 = Math.min(hgt, w - k);
    if (a1 > a0) line(x0 + a0, top + a0, x0 + a1, top + a1, col);
    const b0 = Math.max(0, k + hgt - w), b1 = Math.min(hgt, k + hgt);
    if (b1 > b0) line(x1 - b0, top + b0, x1 - b1, top + b1, col);
  }
  gfx.globalAlpha = 1;
  rect(x, top, 1, hgt, '#b8a888');
  rect(x + w - 1, top, 1, hgt, '#b8a888');
  rect(x, top, w, 1, '#b8a888');
  for (let i = 3; i < w; i += 8) disc(x + i, top, 1.5, '#f77622');
  for (let i = 3; i < w; i += 8) disc(x + i, bottom, 1, '#3a4466');
}

// Sam: a kid in a red t-shirt. pose: 'stand' | 'walk' | 'point' | 'hold' | 'kneel' | 'bow'
function drawSam(x, y, pose = 'stand', frame = 0, flip = false, outfit = 'kid') {
  // (x,y) = feet centre. Sprite is ~14x30.
  const c = SAM_CACHE.get(pose + frame + outfit) || buildSam(pose, frame, outfit);
  const img = flip ? c.l : c.r;
  blit(img, x - Math.floor(img.width / 2), y - img.height);
}
const SAM_CACHE = new Map();
function buildSam(pose, frame, outfit) {
  const cw = 20, ch = 32;
  const cv = makeCanvas(cw, ch), g = cv.getContext('2d');
  const prev = setTarget(g);
  const skin = '#e8b796', skinD = '#c28569', hair = '#733e39', hairL = '#b86f50';
  const shirt = outfit === 'butler' ? '#262b44' : '#e43b44', shirtD = outfit === 'butler' ? '#181425' : '#a22633';
  const pants = outfit === 'butler' ? '#181425' : '#124e89', pantsD = outfit === 'butler' ? '#07060f' : '#0b3a6b', shoe = '#3e2731';
  const ox = 3;
  const kneel = pose === 'kneel' || pose === 'bow';
  const top = kneel ? 7 : 0;
  // legs
  if (kneel) {
    rect(ox + 3, 25, 8, 4, pants); rect(ox + 1, 29, 6, 2, pants); rect(ox + 9, 27, 4, 4, pantsD);
    rect(ox, 30, 4, 2, shoe);
  } else {
    const step = pose === 'walk' ? (frame % 2 ? 1 : -1) : 0;
    rect(ox + 4 + Math.min(0, step), 20, 3, 9 - Math.max(0, step), pants);
    rect(ox + 8 - Math.min(0, step), 20, 3, 9 + Math.min(0, step), pantsD);
    rect(ox + 3 + Math.min(0, step) * 2, 29 - Math.max(0, step), 5, 2, shoe);
    rect(ox + 7 - Math.min(0, step) * 2, 29 + Math.min(0, step), 5, 2, shoe);
    rect(ox + 4, 19, 7, 3, pants);
  }
  // body
  const by = 11 + top;
  rect(ox + 3, by, 9, 9, shirt);
  rect(ox + 3, by + 7, 9, 2, shirtD);
  if (outfit === 'butler') { rect(ox + 6, by, 3, 6, '#ffffff'); px(ox + 7, by + 1, '#e43b44'); px(ox + 7, by + 3, '#181425'); }
  else { rect(ox + 6, by + 3, 3, 2, '#fee761'); px(ox + 9, by + 3, '#fee761'); }
  // arms
  if (pose === 'point') {
    rect(ox + 12, by + 1, 5, 2, shirt); rect(ox + 17, by + 1, 2, 2, skin);
    rect(ox + 1, by + 1, 2, 6, shirt); rect(ox + 1, by + 7, 2, 2, skin);
  } else if (pose === 'hold') {
    rect(ox + 1, by + 1, 2, 4, shirt); rect(ox + 12, by + 1, 2, 4, shirt);
    rect(ox + 2, by + 5, 11, 2, skin);
  } else if (pose === 'bow') {
    rect(ox + 1, by + 1, 2, 5, shirt); rect(ox + 12, by + 1, 2, 5, shirt);
    rect(ox + 1, by + 6, 2, 2, skin); rect(ox + 12, by + 6, 2, 2, skin);
  } else {
    const sw = pose === 'walk' ? (frame % 2 ? 1 : 0) : 0;
    rect(ox + 1, by + 1 + sw, 2, 6, shirt); rect(ox + 1, by + 7 + sw, 2, 2, skin);
    rect(ox + 12, by + 1 + (1 - sw), 2, 6, shirt); rect(ox + 12, by + 7 + (1 - sw), 2, 2, skin);
  }
  // head
  const hy = top + (pose === 'bow' ? 3 : 0);
  rect(ox + 3, hy + 2, 9, 9, skin);
  rect(ox + 3, hy + 9, 9, 1, skinD);
  rect(ox + 2, hy + 1, 11, 4, hair);
  rect(ox + 3, hy, 9, 1, hair);
  rect(ox + 2, hy + 5, 2, 4, hair);
  rect(ox + 11, hy + 5, 2, 3, hair);
  rect(ox + 5, hy + 1, 4, 1, hairL);
  if (pose !== 'bow') {
    rect(ox + 5, hy + 6, 1, 2, '#181425');
    rect(ox + 9, hy + 6, 1, 2, '#181425');
    px(ox + 4, hy + 8, '#f6757a'); px(ox + 10, hy + 8, '#f6757a');
    rect(ox + 6, hy + 9, 3, 1, '#a22633');
  }
  setTarget(prev);
  const o = outlineCanvas(cv, '#3e2731');
  const res = { r: o, l: flipCanvas(o) };
  SAM_CACHE.set(pose + frame + outfit, res);
  return res;
}

// Shopkeeper seen behind a counter (upper body only).
function drawShopkeeper(x, y, t) {
  const blink = Math.floor(t * 2) % 7 === 0;
  const bob = Math.round(Math.sin(t * 2) * 0.6);
  y += bob;
  rect(x - 9, y + 12, 18, 12, '#3e8948');
  rect(x - 9, y + 12, 18, 2, '#265c42');
  rect(x - 4, y + 14, 8, 6, '#63c74d');
  rect(x - 11, y + 13, 2, 9, '#e8eef7');
  rect(x + 9, y + 13, 2, 9, '#e8eef7');
  rect(x - 6, y, 12, 12, '#e8b796');
  rect(x - 6, y + 10, 12, 2, '#c28569');
  rect(x - 7, y + 4, 1, 4, '#e8b796'); rect(x + 6, y + 4, 1, 4, '#e8b796');
  rect(x - 5, y, 10, 1, '#f5cdb0');
  if (!blink) { rect(x - 4, y + 5, 2, 2, '#181425'); rect(x + 2, y + 5, 2, 2, '#181425'); }
  else { rect(x - 4, y + 6, 2, 1, '#181425'); rect(x + 2, y + 6, 2, 1, '#181425'); }
  rect(x - 5, y + 4, 4, 1, '#3e2731'); rect(x + 1, y + 4, 4, 1, '#3e2731');
  rect(x - 4, y + 8, 8, 2, '#733e39');
  px(x - 5, y + 9, '#733e39'); px(x + 4, y + 9, '#733e39');
}

/* ---------------------------------------------------------- the logo
   Hand-designed chunky letters, scaled 2x, rounded, then run through
   the same pixel stylizer as the big arcade text.                    */
const LOGO_LETTERS = {
  F: ['#########', '#########', '#########', '###......', '###......', '#######..', '#######..', '#######..', '###......', '###......', '###......', '###......', '###......'],
  I: ['#######', '#######', '..###..', '..###..', '..###..', '..###..', '..###..', '..###..', '..###..', '..###..', '..###..', '#######', '#######'],
  S: ['.########', '#########', '###......', '###......', '###......', '########.', '#########', '.########', '......###', '......###', '......###', '#########', '########.'],
  H: ['###...###', '###...###', '###...###', '###...###', '###...###', '#########', '#########', '#########', '###...###', '###...###', '###...###', '###...###', '###...###'],
  L: ['###.....', '###.....', '###.....', '###.....', '###.....', '###.....', '###.....', '###.....', '###.....', '###.....', '########', '########', '########'],
  E: ['#########', '#########', '#########', '###......', '###......', '#######..', '#######..', '#######..', '###......', '###......', '#########', '#########', '#########'],
};
const LOGO_STYLE = {
  fill: ['#fff6c9', '#fee761', '#feae34', '#f77622', '#e8641c'], hi: '#ffffff', shade: '#be4a2f', out: '#3e2731', ex: ['#1b3a6b', '#0e1a3a'],
};
function buildLogoLetter(ch) {
  const rows = LOGO_LETTERS[ch];
  const m = spriteFromRows(rows, { '#': '#ffffff' });
  return stylize(roundMask(scaleMask(m, 2)), LOGO_STYLE, 4);
}

/* ---------------------------------------------------- world map (globe)
   48x24 equirectangular map, '#' = land.                            */
const WORLD_MAP = [
  '................................................',
  '..........#####......####......#####.#####......',
  '...#################.####..#####################',
  '..###################.##..######################',
  '....#################....#######################',
  '......##############.....####.##################',
  '.......############.....######.###############..',
  '........#########.......##########.##########...',
  '.........#######........###########.#######.....',
  '..........####...........#########....######....',
  '...........##.#..........##########....###.#....',
  '.............####.........#########.....#..##...',
  '.............#######.......#######.......#.###..',
  '..............#######......######..........#....',
  '..............######........#####......######...',
  '...............#####........####......########..',
  '...............####..........##.......########..',
  '...............###..........................#...',
  '...............##...............................',
  '...............#................................',
  '................................................',
  '................................................',
  '..######################################......##',
  '################################################',
];
