'use strict';
// ============================================================ drawing one frame

const cam = { x: 0, y: 0, lx: 0, ly: 0 };
let light, lctx, lightImg, LR, LG, LB, vignette, minimap, mmTimer = 0, mmOn = true;
let opqGrid = new Uint8Array(1), visBuf = new Uint8Array(1);

function setupView() {
  ctx.imageSmoothingEnabled = false;
  const lw = Math.ceil(W / 2), lh = Math.ceil(H / 2);
  light = canvas(lw, lh); lctx = light.getContext('2d'); lightImg = lctx.createImageData(lw, lh);
  LR = new Float32Array(lw * lh); LG = new Float32Array(lw * lh); LB = new Float32Array(lw * lh);
  for (let i = 3; i < lightImg.data.length; i += 4) lightImg.data[i] = 255;
  // a dithered vignette: the corners of the screen sink into shadow
  vignette = canvas(lw, lh, g => {
    const img = g.createImageData(lw, lh), o = img.data;
    for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) {
      const dx = (x / lw - .5) * 2, dy = (y / lh - .5) * 2, r = Math.sqrt(dx * dx * .8 + dy * dy * 1.1);
      const v = clamp((r - .62) / .6, 0, 1), q = Math.floor(v * 4 + BAYER[(y & 3) * 4 + (x & 3)]) / 4;
      o[(y * lw + x) * 4 + 3] = q * 150;
    }
    g.putImageData(img, 0, 0);
  });
  minimap = canvas(61, 61);
}

// game time as a wall clock: 7:00 to 19:00 by day, back round to 7:00 by night
function clockMinutes() {
  if (!isNight()) return 7 * 60 + clock / DAY_LEN * 12 * 60;
  return (19 * 60 + (clock - DAY_LEN) / NIGHT_LEN * 12 * 60) % (24 * 60);
}
function clockText() { const m = Math.floor(clockMinutes() / 5) * 5; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
function drawHands(g, cx, cy, mins, r, col) {
  const h = (mins / 720) * Math.PI * 2 - Math.PI / 2, m = (mins % 60) / 60 * Math.PI * 2 - Math.PI / 2;
  line(g, cx, cy, Math.round(cx + Math.cos(h) * r * .55), Math.round(cy + Math.sin(h) * r * .55), col);
  line(g, cx, cy, Math.round(cx + Math.cos(m) * r * .85), Math.round(cy + Math.sin(m) * r * .85), col);
}

// ---------------------------------------------------------------- light
function buildOcclusion(gx0, gy0, gw, gh) {
  if (opqGrid.length < gw * gh) opqGrid = new Uint8Array(gw * gh);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) opqGrid[y * gw + x] = opaque(gx0 + x, gy0 + y) ? 1 : 0;
}
function gridClear(sx, sy, ex, ey, gx0, gy0, gw, gh) {
  let tx = Math.floor(sx / T), ty = Math.floor(sy / T);
  const etx = Math.floor(ex / T), ety = Math.floor(ey / T), dx = ex - sx, dy = ey - sy;
  const stx = dx > 0 ? 1 : -1, sty = dy > 0 ? 1 : -1, ddx = dx ? Math.abs(T / dx) : Infinity, ddy = dy ? Math.abs(T / dy) : Infinity;
  let mx = dx ? ((dx > 0 ? (tx + 1) * T - sx : sx - tx * T) / Math.abs(dx)) : Infinity, my = dy ? ((dy > 0 ? (ty + 1) * T - sy : sy - ty * T) / Math.abs(dy)) : Infinity;
  for (let n = 0; n < 64 && (tx !== etx || ty !== ety); n++) {
    if (mx < my) { mx += ddx; tx += stx; } else { my += ddy; ty += sty; }
    if (tx === etx && ty === ety) break;
    const ix = tx - gx0, iy = ty - gy0;
    if (ix < 0 || iy < 0 || ix >= gw || iy >= gh || opqGrid[iy * gw + ix]) return false;
  }
  return true;
}
function renderLight(camX, camY, amb, sources) {
  const lw = light.width, lh = light.height;
  LR.fill(amb[0]); LG.fill(amb[1]); LB.fill(amb[2]);
  const gx0 = Math.floor(camX / T) - 9, gy0 = Math.floor(camY / T) - 9, gw = Math.ceil(W / T) + 20, gh = Math.ceil(H / T) + 20;
  buildOcclusion(gx0, gy0, gw, gh);
  for (const s of sources) {
    const rt = Math.ceil(s.r / T) + 1, side = rt * 2 + 1, stx = Math.floor(s.x / T), sty = Math.floor(s.y / T);
    if (visBuf.length < side * side) visBuf = new Uint8Array(side * side);
    for (let j = 0; j < side; j++) for (let i = 0; i < side; i++) {
      const tx = stx - rt + i, ty = sty - rt + j;
      const cx = clamp(s.x, tx * T + 2, tx * T + T - 2), cy = clamp(s.y, ty * T + 2, ty * T + T - 2);
      visBuf[j * side + i] = (tx === stx && ty === sty) || gridClear(s.x, s.y, (cx + tx * T + 16) / 2, (cy + ty * T + 16) / 2, gx0, gy0, gw, gh) ? 1 : 0;
    }
    const x0 = Math.max(0, Math.floor((s.x - s.r - camX) / 2)), x1 = Math.min(lw - 1, Math.ceil((s.x + s.r - camX) / 2));
    const y0 = Math.max(0, Math.floor((s.y - s.r - camY) / 2)), y1 = Math.min(lh - 1, Math.ceil((s.y + s.r - camY) / 2));
    const r2 = s.r * s.r, [cr, cg, cb] = s.col;
    for (let ly = y0; ly <= y1; ly++) {
      const wy = camY + ly * 2 + 1, dy = wy - s.y, ty = Math.floor(wy / T) - sty + rt;
      if (ty < 0 || ty >= side) continue;
      for (let lx = x0; lx <= x1; lx++) {
        const wx = camX + lx * 2 + 1, dx = wx - s.x, d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        const tx = Math.floor(wx / T) - stx + rt;
        if (tx < 0 || tx >= side || !visBuf[ty * side + tx]) continue;
        const d = Math.sqrt(d2);
        let f = 1 - d / s.r; f *= f * s.i;
        if (s.cone) {
          const ca = d > 0 ? (dx * s.cx + dy * s.cy) / d : 1;
          if (ca < s.cosO) continue;
          if (ca < s.cosI) f *= (ca - s.cosO) / (s.cosI - s.cosO);
        }
        const k = ly * lw + lx;
        LR[k] += f * cr; LG[k] += f * cg; LB[k] += f * cb;
      }
    }
  }
  const o = lightImg.data;
  for (let y = 0, k = 0; y < lh; y++) for (let x = 0; x < lw; x++, k++) {
    const b = BAYER[(y & 3) * 4 + (x & 3)], i = k * 4;
    o[i] = Math.floor(Math.min(1, LR[k]) * 7 + b) * 36.43;
    o[i + 1] = Math.floor(Math.min(1, LG[k]) * 7 + b) * 36.43;
    o[i + 2] = Math.floor(Math.min(1, LB[k]) * 7 + b) * 36.43;
  }
  lctx.putImageData(lightImg, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(light, 0, 0, lw * 2, lh * 2);
  ctx.globalCompositeOperation = 'source-over';
}

// ---------------------------------------------------------------- the frame
function render(dt) {
  const t = performance.now() / 1000, night = isNight(), play = state === 'play' || state === 'paused' || state === 'dead';
  // camera: leads a little in the direction you're looking
  cam.lx = lerp(cam.lx, Math.cos(player.ang) * 22, Math.min(1, dt * 3)); cam.ly = lerp(cam.ly, Math.sin(player.ang) * 14, Math.min(1, dt * 3));
  const sx = shake > 0 ? randi(-3, 3) : 0, sy = shake > 0 ? randi(-3, 3) : 0;
  const camX = Math.round(player.x + cam.lx - W / 2) + sx, camY = Math.round(player.y - 14 + cam.ly - H / 2) + sy;
  cam.x = camX; cam.y = camY;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const x0 = Math.floor(camX / T) - 1, x1 = Math.floor((camX + W) / T) + 1, y0 = Math.floor(camY / T) - 1, y1 = Math.floor((camY + H) / T) + 2;
  const emissive = [], lights = [], fixtures = [];
  // ---- floors and walls
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const tl = tileAt(x, y), dx = x * T - camX, dy = y * T - camY;
    if (tl !== WALL) {
      ctx.drawImage(floorTile(x, y, tl), dx, dy);
      const d = doors.get(K(x, y));
      if (d) ctx.drawImage(d.kind === 'h' ? (d.closed ? (night ? (hash(x, y, 33) < .35 && Math.sin(t * .7 + x) > .6 ? DOOR_FACE.ghost : DOOR_FACE.closedNight) : DOOR_FACE.closed) : DOOR_FACE.open) : (d.closed ? DOOR_SIDE.closed : DOOR_SIDE.open), dx, dy);
      const fx = fixtureAt(x, y);
      if (fx) fixtures.push(fx);
      continue;
    }
    const below = tileAt(x, y + 1);
    if (below === WALL) {
      const m = (isWall(x, y - 1) ? 0 : 1) | (isWall(x - 1, y) ? 0 : 2) | (isWall(x + 1, y) ? 0 : 4);
      ctx.drawImage(CAPS[m], dx, dy);
      continue;
    }
    const f = faceTile(x, y, night);
    ctx.drawImage(f, dx, dy);
    if (f.decor === 'clock') {
      const mins = night ? 19 * 60 - (clock - DAY_LEN) * 22 : clockMinutes();
      drawHands(ctx, dx + 16, dy + 9, ((mins % 720) + 720) % 720, 6, '#1a1a1a');
    }
    if (f.exit) { emissive.push(['exit', dx, dy]); if (night) lights.push({ x: x * T + 16, y: y * T + 6, r: 1.8 * T, col: [1, .12, .08], i: .7 }); }
    if (night) {
      const blink = Math.sin(t * .9 + x * 1.7 + y) > .55;
      if (f.decor === 'window' && hash(x, y, 24) < .2 && blink) emissive.push(['eyes', dx + (hash(x, y, 25) < .5 ? 8 : 20), dy + 11]);
      if (f.decor === 'mirror' && f.ghost && blink) emissive.push(['eyes', dx + 15, dy + 7]);
      if (f.style === 'lockers' && f.eyes) f.eyes.forEach((e, i) => { if (e && blink) emissive.push(['eyes', dx + i * 16 + 4, dy + 7, 3]); });
    }
  }
  // ---- daylight from the ceiling
  if (!night) {
    ctx.globalCompositeOperation = 'lighter';
    for (const fx of fixtures) {
      if (fx.broken && Math.sin(t * 13 + fx.phase) * Math.sin(t * 3.1 + fx.phase) > .35) continue;
      ctx.globalAlpha = .085 * (1 - duskAmt * .8);
      ctx.drawImage(LIGHT_POOL, fx.x * T + 16 - 44 - camX, fx.y * T + 16 - 30 - camY);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  // ---- things on the floor
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const p = pickups.get(K(x, y));
    if (!p) continue;
    const bob = Math.round(Math.sin(t * 3 + x * 1.3 + y) * 1.5), dx = x * T - camX + 8, dy = y * T - camY + 10;
    ctx.globalAlpha = .35; ctx.drawImage(SHADOW, dx - 5, dy + 12); ctx.globalAlpha = 1;
    ctx.drawImage(PSPR[p.type], dx - 1, dy - 4 + bob);
    if ((t * 2 + x) % 3 < .15) { ctx.fillStyle = '#ffffff'; ctx.fillRect(dx + 4, dy - 2 + bob, 1, 1); }
  }
  // ---- furniture and people, back to front
  const list = [];
  for (let y = y0; y <= y1 + 1; y++) for (let x = x0; x <= x1; x++) { const f = furn.get(K(x, y)); if (f) list.push({ z: y * T + T - 1, f, x, y }); }
  for (const tch of teachers) if (tch.x > camX - 40 && tch.x < camX + W + 40 && tch.y > camY - 20 && tch.y < camY + H + 70) list.push({ z: tch.y + 5, tch });
  if (state !== 'title') list.push({ z: player.y + 5, me: true });
  list.sort((a, b) => a.z - b.z);
  ctx.globalAlpha = .28;
  for (const it of list) {
    if (it.f) ctx.drawImage(SHADOW_BIG, it.x * T - camX - 1, it.y * T + T - 8 - camY);
    else if (it.tch) ctx.drawImage(it.tch.kind === 'principal' ? SHADOW_BIG : SHADOW, Math.round(it.tch.x - camX) - (it.tch.kind === 'principal' ? 17 : 13), Math.round(it.tch.y - camY));
    else ctx.drawImage(SHADOW, Math.round(player.x - camX) - 13, Math.round(player.y - camY));
  }
  ctx.globalAlpha = 1;
  const eyesAt = [];
  for (const it of list) {
    if (it.f) {
      const f = it.f, def = FURN[f.type], spr = FSPR[f.type][f.v % def.nv];
      const j = f.shake > 0 ? randi(-1, 1) : 0, dx = it.x * T - camX - 1 + j, dy = it.y * T + T - def.h - camY - 1;
      ctx.drawImage(spr, dx, dy);
      if (f.hp < def.hp) {
        const dmg = 1 - f.hp / def.hp; ctx.fillStyle = 'rgba(25,12,6,.8)';
        for (let i = 0; i < dmg * 14; i++) ctx.fillRect(dx + 3 + ((hash(it.x, it.y, 40 + i) * 26) | 0), dy + 3 + ((hash(it.x, it.y, 60 + i) * (def.h - 6)) | 0), 1 + (i % 2), 1 + ((i >> 1) % 2));
      }
      if (t - f.hit < 2.5) { ctx.fillStyle = '#1a0a0a'; ctx.fillRect(dx + 4, dy - 5, 26, 4); ctx.fillStyle = f.hp / def.hp > .4 ? '#e8c33a' : '#d83232'; ctx.fillRect(dx + 5, dy - 4, Math.max(1, Math.round(24 * f.hp / def.hp)), 2); }
      if (def.light && night) lights.push({ x: it.x * T + 16, y: it.y * T + 12, r: 2.3 * T, col: def.light, i: .6 });
    } else if (it.tch) {
      const tc = it.tch, mode = tc.hostile ? 'night' : 'day', fr = tc.spr[mode][tc.dir][tc.frame] || tc.spr[mode][tc.dir][0];
      let dx = Math.round(tc.x - camX - fr.c.width / 2), dy = Math.round(tc.y + 6 - camY - fr.c.height);
      if (tc.hostile && !tc.dying && Math.random() < .03) dx += randi(-1, 1);
      if (tc.dying > 0) {
        // they come apart like a bad signal
        for (let yy = 0; yy < fr.c.height; yy += 3) { if (Math.random() > tc.alpha) continue; ctx.drawImage(fr.c, 0, yy, fr.c.width, 3, dx + randi(-6, 6) * (1 - tc.alpha), dy + yy, fr.c.width, 3); }
      } else {
        ctx.globalAlpha = tc.alpha;
        ctx.drawImage(fr.c, dx, dy);
        if (tc.stun > 0 && Math.floor(t * 20) % 2) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .5; ctx.drawImage(fr.c, dx, dy); ctx.globalCompositeOperation = 'source-over'; }
        ctx.globalAlpha = 1;
        if (tc.hostile && fr.eyes.length && tc.alpha > .5) for (const [ex, ey] of fr.eyes) eyesAt.push([dx + ex, dy + ey]);
      }
    } else {
      const p = player, fr = p.moving ? 1 + (Math.floor(p.walk) % 4) : 0, spr = KID_SPR[p.dir][fr];
      const dx = Math.round(p.x - camX - spr.width / 2), dy = Math.round(p.y + 6 - camY - spr.height);
      if (!(p.iframes > 0 && Math.floor(p.iframes * 18) % 2)) ctx.drawImage(spr, dx, dy);
      const hx = Math.round(p.x - camX + Math.cos(p.ang) * 7), hy = Math.round(p.y - camY - 12 + Math.sin(p.ang) * 5);
      if (p.swing > 0) {
        const k = 1 - p.swing / .18, a = p.ang + (k - .5) * 2.1;
        ctx.fillStyle = '#e8c860';
        for (let i = 3; i < 18; i++) ctx.fillRect(Math.round(hx + Math.cos(a) * i), Math.round(hy + Math.sin(a) * i), 2, 2);
        ctx.fillStyle = '#8a6a2a'; for (let i = 5; i < 18; i += 3) ctx.fillRect(Math.round(hx + Math.cos(a) * i), Math.round(hy + Math.sin(a) * i), 1, 1);
      } else if (night || duskAmt > .5) {
        ctx.fillStyle = '#3a3d42'; ctx.fillRect(hx - 1, hy - 1, 3, 3);
        if (p.flash && p.battery > 0) { ctx.fillStyle = '#fff6c8'; ctx.fillRect(Math.round(hx + Math.cos(p.ang) * 2), Math.round(hy + Math.sin(p.ang) * 2), 1, 1); }
      }
    }
  }
  // ---- particles
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life / p.max * 1.5, 0, 1); ctx.fillStyle = p.col;
    ctx.fillRect(Math.round(p.x - camX), Math.round(p.y - camY), p.size, p.size);
  }
  ctx.globalAlpha = 1;
  if (state === 'play') drawTarget(camX, camY, t);

  // ---- lighting
  const amb = ambientLight();
  if (amb[0] < .995) {
    const p = player, flick = (p.battery < .15 || nearestHostile < 4 * T) ? (Math.random() < .2 ? .25 : 1) : 1;
    lights.push({ x: p.x, y: p.y - 10, r: 2.1 * T, col: [.55, .55, .62], i: .7 });
    if (p.flash && p.battery > 0) {
      const hx = p.x + Math.cos(p.ang) * 6, hy = p.y - 12 + Math.sin(p.ang) * 6;
      lights.push({ x: hx, y: hy, r: 7.6 * T * (p.battery < .2 ? .75 : 1), col: [1, .93, .76], i: 1.3 * flick, cone: true, cx: Math.cos(p.ang), cy: Math.sin(p.ang), cosO: Math.cos(.43), cosI: Math.cos(.25) });
      lights.push({ x: hx, y: hy, r: 1.6 * T, col: [1, .93, .76], i: .55 * flick });
    }
    for (const fx of fixtures) if (fx.broken) {
      const on = Math.sin(t * 17 + fx.phase) * Math.sin(t * 2.3 + fx.phase * 2) > .1;
      if (on) lights.push({ x: fx.x * T + 16, y: fx.y * T + 16, r: 3.3 * T, col: [.78, .88, 1], i: .85 });
    }
    for (const [ex, ey] of eyesAt) lights.push({ x: ex + camX, y: ey + camY, r: .55 * T, col: [1, .05, .05], i: .3 });
    renderLight(camX, camY, amb, lights);
  }
  // ---- things that glow on their own
  for (const e of emissive) {
    if (e[0] === 'exit') { ctx.fillStyle = '#7a0a0a'; ctx.fillRect(e[1] + 8, e[2], 17, 7); ctx.fillStyle = night ? '#ff2a1a' : '#c81818'; ctx.fillRect(e[1] + 9, e[2] + 1, 15, 5); tiny(ctx, 'EXIT', e[1] + 9, e[2] + 1, night ? '#fff0e8' : '#ffd8d0'); }
    else { ctx.fillStyle = '#ff1a10'; ctx.fillRect(e[1], e[2], 1, 1); ctx.fillRect(e[1] + (e[3] || 4), e[2], 1, 1); }
  }
  if (night) for (const [ex, ey] of eyesAt) {
    ctx.fillStyle = 'rgba(255,20,10,.35)'; ctx.fillRect(ex - 1, ey - 1, 4, 3);
    ctx.fillStyle = Math.random() < .02 ? '#000' : '#ff2418'; ctx.fillRect(ex, ey, 1, 1); ctx.fillRect(ex, ey + 1, 1, 1);
  }
  // ---- what the dark does to your eyes
  if (night || amb[0] < .5) {
    ctx.fillStyle = 'rgba(255,255,255,.05)';
    for (let i = 0; i < W * H / 900; i++) ctx.fillRect((Math.random() * W) | 0, (Math.random() * H) | 0, 1, 1);
  }
  const fear = night ? clamp(1 - nearestHostile / (3.2 * T), 0, 1) : 0;
  if (fear > 0 && Math.random() < fear * .5) {
    for (let i = 0; i < 2 + fear * 5; i++) { const yy = randi(0, H - 8), hh = randi(1, 6), off = randi(-6, 6) * fear; ctx.drawImage(cvs, 0, yy, W, hh, off, yy, W, hh); }
    if (Math.random() < .2) { ctx.fillStyle = 'rgba(160,0,0,.12)'; ctx.fillRect(0, 0, W, H); }
  }
  ctx.globalAlpha = night ? 1 : .55; ctx.drawImage(vignette, 0, 0, W, H); ctx.globalAlpha = 1;
  if (hurtFlash > 0) { ctx.fillStyle = `rgba(170,0,0,${hurtFlash * .8})`; ctx.fillRect(0, 0, W, H); }
  if (play && player.hp <= 3 && state === 'play') { ctx.fillStyle = `rgba(120,0,0,${.12 + Math.sin(t * 5) * .08})`; ctx.fillRect(0, 0, W, H); }
  if (state === 'dead') { ctx.fillStyle = 'rgba(60,0,0,.45)'; ctx.fillRect(0, 0, W, H); }
  const scaring = jump && t - jump.t0 < JUMP_LEN;
  if (state !== 'title' && !scaring) drawHUD(t);
  if (scaring) drawJumpscare(t);
}

// ---------------------------------------------------------------- the jumpscare
const JUMP_LEN = 1.8;
let jump = null;
function drawJumpscare(t) {
  const e = t - jump.t0, face = scareFace(jump.sp, Math.floor(e * 14) % 3 !== 0);
  const lunge = e < .12 ? .55 + e * 3.75 : 1 + (e - .12) * .3, sc = Math.max(1, Math.floor(Math.min(W / 48, H / 40) * 1.08 * lunge)), fw = 48 * sc, fh = 40 * sc, j = () => randi(-3, 3) * Math.max(1, sc >> 2);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.drawImage(face, Math.round(W / 2 - fw / 2) + j(), Math.round(H / 2 - fh / 2 - sc * 2) + j(), fw, fh);
  for (let i = 0; i < 7; i++) { const yy = randi(0, H - 12), hh = randi(2, 16); ctx.drawImage(cvs, 0, yy, W, hh, randi(-20, 20), yy, W, hh); }
  if (Math.random() < .35) { ctx.fillStyle = `rgba(210,0,0,${rand(.15, .45)})`; ctx.fillRect(0, 0, W, H); }
  ctx.fillStyle = 'rgba(255,255,255,.14)';
  for (let i = 0; i < W * H / 140; i++) ctx.fillRect((Math.random() * W) | 0, (Math.random() * H) | 0, 1 + (Math.random() < .2 ? 1 : 0), 1);
  if (e < .07) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H); }
  if (e > 1.35) { ctx.fillStyle = `rgba(0,0,0,${clamp((e - 1.35) / .45, 0, 1)})`; ctx.fillRect(0, 0, W, H); }
}

function ambientLight() {
  const nightAmb = [.03, .036, .07];
  let a;
  if (!isNight()) { const k = clamp((clock - (DAY_LEN - DUSK)) / DUSK, 0, 1); a = [lerp(1, .5, k), lerp(1, .46, k), lerp(1, .42, k)]; }
  else a = nightAmb;
  if (lightsFlicker > 0 && Math.random() < .45) a = isNight() ? [.6, .6, .55] : nightAmb;
  return a;
}

// what you're about to grab or where your furniture will go
function drawTarget(camX, camY, t) {
  const [tx, ty] = targetTile(), dx = tx * T - camX, dy = ty * T - camY;
  const f = furn.get(K(tx, ty)), d = doors.get(K(tx, ty)), sel = selectedType();
  const blink = Math.floor(t * 3) % 2;
  let prompt = '', pcol = '#ffffff';
  if (f) {
    const def = FURN[f.type], top = dy + T - def.h - 1;
    ctx.strokeStyle = blink ? '#a8ffb0' : '#5ac86a'; ctx.lineWidth = 1; ctx.strokeRect(dx + .5, top + .5, T, def.h + 1);
    prompt = `${keyName('grab')} GRAB ${def.name} (${def.wt})`;
  } else if (d) {
    ctx.strokeStyle = blink ? '#ffe8a0' : '#c8a850'; ctx.strokeRect(dx + .5, dy + .5, T - 1, T - 1);
    prompt = `${keyName('grab')} ${d.closed ? 'OPEN' : 'CLOSE'} DOOR`;
    if (!d.closed && sel) prompt += `  ${keyName('place')} BLOCK IT`;
  } else if (sel) {
    const can = !solid(tx, ty);
    if (can) {
      const def = FURN[sel], spr = FSPR[sel][0];
      ctx.globalAlpha = .38 + (blink ? .12 : 0); ctx.drawImage(spr, dx - 1, dy + T - def.h - 1); ctx.globalAlpha = 1;
      ctx.strokeStyle = '#ffffff'; ctx.strokeRect(dx + .5, dy + .5, T - 1, T - 1);
      prompt = `${keyName('place')} PLACE ${def.name}`;
    } else { ctx.strokeStyle = '#ff5a4a'; ctx.strokeRect(dx + .5, dy + .5, T - 1, T - 1); line(ctx, dx + 8, dy + 8, dx + 23, dy + 23, '#ff5a4a'); line(ctx, dx + 23, dy + 8, dx + 8, dy + 23, '#ff5a4a'); }
  } else if (pickups.has(K(tx, ty))) prompt = `${keyName('grab')} PICK UP`;
  if (prompt) {
    const w = txtW(prompt), px0 = clamp(dx + 16 - (w >> 1), 4, W - w - 4), py0 = clamp(dy - 14 - (f ? FURN[f.type].h - T : 0), 4, H - 60);
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(px0 - 3, py0 - 2, w + 6, 12);
    txt(prompt, px0, py0, pcol);
  }
  if (mouse.active > 0 && !touchMode) {
    const mx = Math.round(mouse.sx), my = Math.round(mouse.sy);
    ctx.fillStyle = '#000'; ctx.fillRect(mx - 4, my - 1, 9, 3); ctx.fillRect(mx - 1, my - 4, 3, 9);
    ctx.fillStyle = '#fff'; ctx.fillRect(mx - 3, my, 7, 1); ctx.fillRect(mx, my - 3, 1, 7); ctx.fillStyle = '#000'; ctx.fillRect(mx, my, 1, 1);
  }
}

// ---------------------------------------------------------------- the HUD
function panel(x, y, w, h) { ctx.fillStyle = 'rgba(8,10,12,.72)'; ctx.fillRect(x, y, w, h); ctx.fillStyle = 'rgba(220,228,210,.25)'; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h); }
function drawHUD(t) {
  const night = isNight(), p = player;
  // ---- the hall pass: day, time, time left
  panel(5, 5, 132, 36);
  ctx.fillStyle = '#f2f0e6'; ellipse(ctx, 19, 19, 8, 8, '#2a2a2a'); ellipse(ctx, 19, 19, 7, 7, night ? '#1a1d28' : '#f4f2ea');
  drawHands(ctx, 19, 19, clockMinutes() % 720, 6, night ? '#d83a3a' : '#1a1a1a');
  txt('DAY ' + dayNum, 32, 10, night ? '#c8cbe0' : '#ffffff');
  txt(clockText(), 86, 10, night ? '#9aa0c0' : '#c8d0c0');
  const left = night ? DAY_LEN + NIGHT_LEN - clock : DAY_LEN - clock, frac = night ? (clock - DAY_LEN) / NIGHT_LEN : clock / DAY_LEN;
  const lbl = (night ? 'DAWN ' : 'CLOSING ') + Math.floor(left / 60) + ':' + String(Math.floor(left % 60)).padStart(2, '0');
  txt(lbl, 32, 22, night ? '#e05050' : left < DUSK ? (Math.floor(t * 3) % 2 ? '#ffb040' : '#ff7030') : '#a8b8a0');
  ctx.fillStyle = '#222'; ctx.fillRect(9, 35, 124, 3); ctx.fillStyle = night ? '#a02828' : '#d8b048'; ctx.fillRect(9, 35, Math.round(124 * frac), 3);
  const room = roomAt(p.x, p.y);
  txt(room.hall ? room.name : room.name + '  AISLE ' + room.num, 6, 46, '#d8dccf');
  // ---- health, stamina, flashlight, food
  const hx = W - 6 - 5 * 10;
  for (let i = 0; i < 5; i++) ctx.drawImage(HEARTS[p.hp >= (i + 1) * 2 ? 2 : p.hp === i * 2 + 1 ? 1 : 0], hx + i * 10, 6);
  const bar = (y, v, col, label) => { txt(label, hx - 4, y - 1, '#9aa39a', 8, 'right'); ctx.fillStyle = '#1a1c1e'; ctx.fillRect(hx, y, 49, 5); ctx.fillStyle = col; ctx.fillRect(hx + 1, y + 1, Math.round(47 * clamp(v, 0, 1)), 3); };
  bar(17, p.stam, p.tired ? '#e08a30' : '#7ac0e0', 'RUN');
  bar(26, p.battery, p.battery < .15 ? (Math.floor(t * 4) % 2 ? '#e03030' : '#601010') : p.flash ? '#f0e070' : '#8a8460', p.flash ? 'LIGHT' : 'OFF');
  let sx = W - 6;
  for (const k of ['bandage', 'chips', 'milk', 'apple']) {
    if (!p.snacks[k]) continue;
    const w = txtW(String(p.snacks[k]));
    sx -= w; txt(String(p.snacks[k]), sx, 38, '#ffffff'); sx -= 17; ctx.drawImage(PSPR[k], sx, 34); sx -= 4;
  }
  // ---- minimap
  if (mmOn && W >= 380) {
    mmTimer -= 1 / 60;
    if (mmTimer <= 0) { mmTimer = .25; drawMinimap(); }
    const mx = W - 6 - 63, my = 52;
    panel(mx - 1, my - 1, 65, 65); ctx.drawImage(minimap, mx + 1, my + 1);
    ctx.fillStyle = '#ff3a2a'; ctx.fillRect(mx + 31, my + 31, 3, 3);
    ctx.fillStyle = '#ffd0c8'; ctx.fillRect(mx + 32 + Math.round(Math.cos(p.ang) * 3), my + 32 + Math.round(Math.sin(p.ang) * 3), 1, 1);
  }
  // ---- what you're carrying
  const order = p.order.filter(k => p.inv[k] > 0), sel = selectedType();
  const slot = 36, maxSlots = Math.max(1, Math.floor((W - 150) / slot)), shown = order.slice(0, maxSlots);
  let bottom = H;   // keep clear of the touch buttons when they share the bottom of the screen with the hotbar
  if (touchMode && touchRect && W / 2 + 120 > touchRect.x) bottom = clamp(Math.round(touchRect.y) - 4, Math.round(H * .5), H);
  const bx = Math.round(W / 2 - shown.length * slot / 2), by = bottom - 44;
  shown.forEach((k, i) => {
    const x = bx + i * slot, on = k === sel;
    ctx.fillStyle = on ? 'rgba(255,236,170,.28)' : 'rgba(8,10,12,.7)'; ctx.fillRect(x, by, slot - 2, 40);
    if (on) { ctx.strokeStyle = '#ffe9a0'; ctx.strokeRect(x + .5, by + .5, slot - 3, 39); }
    const spr = FSPR[k][0];
    ctx.drawImage(spr, 0, 0, spr.width, Math.min(spr.height, 38), x, by + 1 + Math.max(0, 38 - spr.height), spr.width, Math.min(spr.height, 38));
    txt(String(p.inv[k]), x + slot - 4, by + 30, '#ffffff', 8, 'right');
    if (i < 9) txt(String(i + 1), x + 2, by + 2, '#8a8f84');
  });
  const load = carried();
  const lx = Math.max(4, order.length ? bx - 70 : W / 2 - 60);
  txt('LOAD', lx, by + 14, '#9aa39a'); ctx.fillStyle = '#1a1c1e'; ctx.fillRect(lx, by + 26, 60, 5); ctx.fillStyle = load / CARRY > .85 ? '#e08a30' : '#9ac870'; ctx.fillRect(lx + 1, by + 27, Math.round(58 * load / CARRY), 3);
  txt(load + '/' + CARRY, lx + 36, by + 14, '#c8d0c0');
  if (sel) txt(FURN[sel].name + ' x' + p.inv[sel], W / 2, by - 12, '#f2e8c8', 8, 'center');
  else if (order.length === 0 && clock < 60 && dayNum === 1) txt('FACE FURNITURE AND PRESS ' + keyName('grab') + ' TO PICK IT UP', W / 2, by + 16, '#c8d0c0', 8, 'center');
  if (toastT > 0) { const w = txtW(toastMsg); ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(W / 2 - w / 2 - 4, by - 30, w + 8, 12); txt(toastMsg, W / 2, by - 28, '#fff8d8', 8, 'center'); }
  // ---- subtitles
  const nowS = performance.now() / 1000;
  subtitles = subtitles.filter(s => nowS < s.end);
  let sy = by - 48;
  for (let i = subtitles.length - 1; i >= 0; i--) {
    const s = subtitles[i];
    if (nowS < s.start) continue;
    const who = s.kind === 'pa' ? 'PA SYSTEM' : s.kind === 'whisper' ? 'WHISPER' : s.who ? kindOf(s.who).name : 'EMPLOYEE';
    let arrow = '';
    if (s.who) { const ddx = s.who.x - player.x, ddy = s.who.y - player.y; if (Math.abs(ddx) > W / 2 - 20 || Math.abs(ddy) > H / 2 - 20) arrow = Math.abs(ddx) > Math.abs(ddy) ? (ddx > 0 ? ' >' : '< ') : (ddy > 0 ? ' v' : ' ^'); }
    const line1 = (arrow === '< ' ? arrow : '') + who + (arrow && arrow !== '< ' ? arrow : '') + ':';
    const col = s.kind === 'pa' ? '#f0c060' : s.kind === 'whisper' ? '#c8b8d8' : s.kind === 'hum' ? '#b8a0a0' : '#ff4a3a';
    const words = s.text.toUpperCase(), w = Math.min(W - 24, txtW(words) + txtW(line1) + 16);
    const jit = s.kind === 'speak' || s.kind === 'whisper' ? randi(-1, 1) : 0;
    ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(W / 2 - w / 2, sy - 3, w, 14);
    const lw = txtW(line1);
    txt(line1, W / 2 - w / 2 + 6, sy, col);
    txt(words, W / 2 - w / 2 + 12 + lw + jit, sy + jit, s.kind === 'pa' ? '#fff0d0' : '#ffd8d0');
    sy -= 16;
  }
  // ---- day / night banner
  if (banner) {
    ctx.globalAlpha = clamp(banner.t, 0, 1);
    const j = banner.creepy ? randi(-2, 2) : 0;
    txt(banner.text, W / 2 + j, Math.round(H * .28) + j, banner.col, 16, 'center');
    if (banner.sub) txt(banner.sub, W / 2, Math.round(H * .28) + 24, '#d8d0c0', 8, 'center');
    ctx.globalAlpha = 1;
  }
  if (hintT > 0 && !touchMode) {
    ctx.globalAlpha = clamp(hintT, 0, 1);
    txt('WASD MOVE  SHIFT RUN  E GRAB  Q PLACE  F LIGHT  C EAT  M MAP', 6, 58, '#c8d0c0');
    ctx.globalAlpha = 1;
  }
}
function drawMinimap() {
  const g = minimap.getContext('2d'), R = 30, tx = Math.floor(player.x / T), ty = Math.floor(player.y / T);
  g.fillStyle = '#050607'; g.fillRect(0, 0, 61, 61);
  for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
    const wx = tx + x, wy = ty + y, c = cell(Math.floor(wx / B), Math.floor(wy / B));
    if (!c.seen) continue;
    g.fillStyle = mapColor(wx, wy); g.fillRect(x + R, y + R, 1, 1);
  }
}
