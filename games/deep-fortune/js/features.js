'use strict';
// ============================================================
//  Progression & polish: contracts and market prices,
//  tutorial hints, day/night, world map, gamepad, ambience
// ============================================================

// ---------- contracts & market ----------
const ORE_MIN_DEPTH = { [T.COAL]:2, [T.COPPER]:8, [T.QUARTZ]:10, [T.IRON]:25, [T.SILVER]:55, [T.AMETHYST]:60, [T.GOLD]:85,
  [T.EMERALD]:100, [T.RUBY]:130, [T.SAPPHIRE]:150, [T.DIAMOND]:170, [T.PLATINUM]:190, [T.MYTHRIL]:205, [T.VOIDSTONE]:226 };
const oreValue = id => Math.round(DEF[id].value * (game.hot && game.hot.id === id ? game.hot.mult : 1));

function makeContract(){
  const reach = Math.max(20, game.maxDepth + 25);
  const pool = ORES.map(o => o[0]).filter(id => ORE_MIN_DEPTH[id] <= reach && !game.contracts.some(c => c.id === id));
  if (!pool.length) pool.push(T.COAL);
  const id = pool[Math.floor(Math.sqrt(Math.random()) * pool.length)];      // lean towards the richer ores you can reach
  const v = DEF[id].value;
  const need = clamp(Math.round(40 / Math.sqrt(v)) + (Math.random()*3|0), 2, 14);
  return { id, need, reward: Math.round(need*v*1.6 + 25) };
}
function ensureContracts(){ if (!game.contracts) game.contracts = []; while (game.contracts.length < 3) game.contracts.push(makeContract()); }
function deliverContract(i){
  const c = game.contracts[i];
  if (!c || (game.bag[c.id]||0) < c.need) return;
  game.bag[c.id] -= c.need; if (!game.bag[c.id]) delete game.bag[c.id];
  game.money += c.reward; game.earned += c.reward; game.stats.contracts = (game.stats.contracts||0) + 1; track('contract'); track('earn', c.reward);
  game.contracts.splice(i, 1, makeContract());
  SFX.cash(); msg(`Contract complete! +${fmtMoney(c.reward)}`, '#ffd24a');
  checkWin();
}
function rollMarket(announce){
  const pool = ORES.map(o => o[0]).filter(id => ORE_MIN_DEPTH[id] <= Math.max(15, game.maxDepth + 10));
  let id = pool[Math.random()*pool.length|0];
  if (game.hot && pool.length > 1) while (id === game.hot.id) id = pool[Math.random()*pool.length|0];
  game.hot = { id, mult:1.5, until: game.time + 300 };
  if (announce) msg(`Market news: ${DEF[id].name} sells for +50% right now!`, '#6fd26a', 4);
}
const contractReady = () => game.contracts && game.contracts.some(c => (game.bag[c.id]||0) >= c.need);

// ---------- tutorial hints ----------
if (settings.hints === undefined) settings.hints = true;
let shownHints = new Set(store.get('deepfortune.hints', []));
function hint(key, textStr){
  if (!settings.hints || shownHints.has(key) || game.hint) return;
  shownHints.add(key); store.set('deepfortune.hints', [...shownHints]);
  game.hint = { text: textStr, t: 8 };
  tone(880, .08, 'triangle', .04); tone(1320, .1, 'triangle', .04, 0, .08);
}
function resetHints(){ shownHints = new Set(); store.del('deepfortune.hints'); }
function stepHints(dt){
  if (game.hint){ game.hint.t -= dt; if (game.hint.t <= 0) game.hint = null; }
  if (game.mode === 'free' && game.time < 1) return;
  const dep = depthOf(Math.floor((P.y+P.h)/TS));
  if (game.time > 1.5) hint('move', isTouch ? 'Use the arrows to move and climb. HOLD on the ground to dig down.' : 'A / D to walk, W to jump. HOLD LEFT CLICK on the ground to dig.');
  if (dep >= 3) hint('ladder', isTouch ? 'Leave LADDERS behind you (pick 1, turn on BUILD, tap) so you can climb back out!' : 'Leave LADDERS behind you so you can climb back out! Pick them with 1, then press B.');
  if (bagCount() > 0) hint('ore', 'Ore goes into your backpack. Sell it at the SHOP on the surface for cash.');
  if (caveins.some(c => c.t < 2.6)) hint('cavein', 'The ceiling is cracking! Build a SUPPORT (2) nearby or get out of the way.');
  if (enemies.some(e => Math.hypot(e.x - P.x, e.y - P.y) < 8*TS)) hint('monster', 'A monster! Click it to hit it with your pick. Torches (3) keep monsters away.');
  if (!game.opts.infinite && bagCount() >= bagCap()) hint('full', 'Backpack full! Head back up to sell, or buy a bigger backpack.');
  if (P.mining && P.mining.deny) hint('hard', 'Too hard for your pick. Earn money and upgrade it at the shop.');
  if (!game.opts.invincible && P.hp < maxHp()*.5) hint('heal', 'Hurt! Press H to use a medkit, or rest on the surface to heal.');
  if (dep >= 215 && !game.bossDefeated) hint('boss', 'The ground trembles... Something enormous lives at the very bottom of the mine.');
  if (enemies.some(e => e.type === 'beetle' && Math.hypot(e.x - P.x, e.y - P.y) < 8*TS)) hint('beetle', 'A BLAST BEETLE! It explodes when it gets close. Hit it from range or back off fast.');
  if (game.sel === 4 && dep > 3) hint('bridge', 'Bridges can only reach 5 tiles from a wall. Stack BRIDGE POSTS (6) up from the floor to support longer ones.');
  if (dep >= 45) hint('beacon', 'Deep down and in trouble? A RECALL BEACON (R) warps you home.');
  if (nearShop() && game.time > 20 && game.mode === 'career') hint('contracts', 'The shop has CONTRACTS: deliver the ore they ask for to earn bonus cash.');
  if (dayPhase().night && dep < 2 && game.time > 30) hint('night', 'Night has fallen. Your helmet lamp still works, and monsters live underground anyway.');
}

// ---------- day / night ----------
const DAY_LEN = 480;                           // seconds for a full day
function dayPhase(){
  if (scene === 'home'){ var p = (homeCam.t/150 + .3) % 1; }                // the title screen has its own quicker day
  else if (scene !== 'game' || !game) return { p:.3, light:1, night:false, dusk:0 };
  else var p = (game.time/DAY_LEN + .3) % 1;
  const s = Math.sin(p*Math.PI*2);
  const light = clamp(.5 + s*1.3, 0, 1);
  return { p, light, night: light < .25, dusk: clamp(1 - Math.abs(light - .5)*2.2, 0, 1) };
}
const farHill = x => { const wx = x + cam.x*.15; return 70 + Math.sin(wx*.009)*38 + Math.sin(wx*.009*2.3+1)*38*.35; };
const STARS = Array.from({ length:70 }, (_, i) => { const r = mulberry32(900+i); return { x:r(), y:r(), s: r() < .15 ? 2 : 1, tw: r()*6 }; });
function drawNightSky(now){
  const dp = dayPhase(); if (dp.light >= .75) return;
  const horizon = SURF*TS - cam.y; if (horizon < 0) return;
  const a = clamp((.75 - dp.light)/.6, 0, 1);
  for (const st of STARS){
    const x = (st.x*VW*1.3 - cam.x*.02) % VW, y = st.y*(horizon - 20);
    if (y > horizon - farHill(x) - 3) continue;            // hidden behind the mountains
    ctx.globalAlpha = a * (.55 + Math.sin(now*2 + st.tw)*.45);
    ctx.fillStyle = '#fff'; ctx.fillRect(x|0, y|0, st.s, st.s);
  }
  // moon rides opposite the sun
  const th = dp.p*Math.PI*2 + Math.PI, mx = VW/2 + Math.cos(th)*VW*.38, my = horizon - 90 - Math.sin(th)*140;
  if (my + 10 < horizon - farHill(mx) && my > -20){
    ctx.globalAlpha = a;
    ctx.fillStyle = '#f4f1dc'; ctx.fillRect(mx-8|0, my-10|0, 16, 20); ctx.fillRect(mx-10|0, my-8|0, 20, 16);
    ctx.fillStyle = '#cfcab0'; ctx.fillRect(mx-4|0, my-5|0, 4, 4); ctx.fillRect(mx+3|0, my+2|0, 3, 3); ctx.fillRect(mx-6|0, my+4|0, 2, 2);
  }
  ctx.globalAlpha = 1;
}

// ---------- full-screen world map ----------
let mapOpen = false, mapScroll = 0;
const MAPC = mkCanvas(WW, WH);
function toggleMap(){
  if (scene !== 'game' || game.over) return;
  if (!mapOpen && game.paused) return;
  mapOpen = !mapOpen; game.paused = mapOpen; SFX.click();
  if (mapOpen){ buildMap(); mapScroll = null; }
}
function buildMap(){
  const [, mx] = MAPC, img = mx.createImageData(WW, WH), d = img.data;
  for (let y=0;y<WH;y++) for (let x=0;x<WW;x++){
    const i = I(x,y), o = i*4;
    let c = y < SURF ? [70,110,170] : (seen[i] || y <= SURF+1) ? MINI_COL[tiles[i]] : [14,11,18];
    if (seen[i] && deco[i] === D.LADDER) c = [190,140,70]; else if (seen[i] && deco[i] === D.SUPPORT) c = [220,170,90]; else if (seen[i] && deco[i] === D.TORCH) c = [255,220,100]; else if (seen[i] && (deco[i] === D.PLATFORM || deco[i] === D.POST)) c = [196,140,76];
    d[o] = c[0]; d[o+1] = c[1]; d[o+2] = c[2]; d[o+3] = 255;
  }
  mx.putImageData(img, 0, 0);
}
function drawMap(now){
  ctx.fillStyle = 'rgba(6,4,10,.92)'; ctx.fillRect(0, 0, VW, VH);
  const sc = Math.max(1, Math.min(4, Math.floor((VW - 60) / WW))), mw = WW*sc, mh = WH*sc;
  const top = 26, avail = VH - top - 18, x0 = (VW - mw)/2 | 0;
  if (mapScroll === null) mapScroll = clamp(pcy()/TS*sc - avail/2, 0, Math.max(0, mh - avail));
  if (input.up) mapScroll -= 240/60; if (input.down) mapScroll += 240/60;
  mapScroll = clamp(mapScroll, 0, Math.max(0, mh - avail));
  text('WORLD MAP', VW/2, 16, '#ffd24a', 8, 'center');
  ctx.save(); ctx.beginPath(); ctx.rect(x0, top, mw, avail); ctx.clip();
  ctx.drawImage(MAPC[0], x0, top - mapScroll, mw, mh);
  // depth ruler
  for (let d=0; d<WH-SURF; d+=25){ const y = top + (SURF+d)*sc - mapScroll; ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x0, y|0, mw, 1); text(`${d}m`, x0 + 2, (y - 2)|0, '#9a8fa8', 6); }
  // shop & player
  const sy = top + SURF*sc - mapScroll; ctx.fillStyle = '#ffd24a'; ctx.fillRect(x0 + SHOP_X0*sc, (sy - 3*sc)|0, (SHOP_X1-SHOP_X0+1)*sc, 3*sc);
  const px = x0 + pcx()/TS*sc, py = top + pcy()/TS*sc - mapScroll;
  if ((now*3|0) % 2){ ctx.fillStyle = '#fff'; ctx.fillRect(px-2|0, py-2|0, 5, 5); ctx.fillStyle = '#e0533d'; ctx.fillRect(px-1|0, py-1|0, 3, 3); }
  ctx.restore();
  ctx.strokeStyle = '#4a3f5c'; ctx.lineWidth = 1; ctx.strokeRect(x0 - .5, top - .5, mw + 1, avail + 1);
  text(isTouch ? 'Tap MAP to close  -  up/down to scroll' : 'TAB to close  -  W/S or wheel to scroll', VW/2, VH - 6, '#9a8fa8', 6, 'center');
}

// ---------- gamepad ----------
const pad = { state:null, prev:[], navHeld:false, active:false };
function pollGamepad(){
  const gps = navigator.getGamepads ? navigator.getGamepads() : [];
  let gp = null; for (const g of gps) if (g && g.connected){ gp = g; break; }
  if (!gp){ pad.state = null; return; }
  const b = i => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > .5));
  const pressed = i => b(i) && !pad.prev[i];
  const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0, dz = .35;
  pad.state = { left: ax < -dz || b(14), right: ax > dz || b(15), up: ay < -dz || b(12), down: ay > dz || b(13),
                jump: b(0), dig: b(2) || b(7), build: b(1) || b(6) };
  if (gp.buttons.some((_, i) => b(i)) || Math.abs(ax) > dz || Math.abs(ay) > dz) pad.active = true;
  if (currentScreen){
    const stick = Math.abs(ay) > .6 ? Math.sign(ay) : 0;
    const dir = pressed(12) ? -1 : pressed(13) ? 1 : (stick && !pad.navHeld) ? stick : 0;
    pad.navHeld = !!stick;
    menuNav(dir, pressed(0), pressed(1) || pressed(9));
  } else if (mapOpen){
    if (pressed(8) || pressed(1) || pressed(9)) toggleMap();
  } else if (scene === 'game' && !game.over){
    if (pressed(4)) { game.sel = (game.sel + ITEMS.length - 1) % ITEMS.length; SFX.click(); }
    if (pressed(5)) { game.sel = (game.sel + 1) % ITEMS.length; SFX.click(); }
    if (pressed(3)){ if (nearShop()) openShop(); else useMedkit(); }
    if (pressed(9)) handleBack();
    if (pressed(8)) toggleMap();
    if (pressed(10) || pressed(11)) startRecall();
  }
  pad.prev = gp.buttons.map((_, i) => b(i));
}
function menuNav(dir, ok, back){
  const scr = $(currentScreen);
  const els = [...scr.querySelectorAll('button:not([disabled]), input[type=checkbox]')].filter(el => el.offsetParent !== null || el.type === 'checkbox');
  if (!els.length) return;
  const cur = els.indexOf(document.activeElement);
  if (dir){ els[cur < 0 ? 0 : (cur + dir + els.length) % els.length].focus(); SFX.click(); }
  if (ok){ if (cur >= 0) els[cur].click(); else els[0].focus(); }
  if (back) handleBack();
}
window.addEventListener('gamepadconnected', () => { if (scene === 'game') msg('Controller connected!', '#6fd26a'); });

// ---------- ambience ----------
let dripT = 2, heartT = 0;
function stepAmbience(dt){
  if (depthOf(Math.floor(pcy()/TS)) > 4){
    dripT -= dt;
    if (dripT <= 0){
      dripT = 1 + Math.random()*3;
      for (let k=0;k<12;k++){
        const x = Math.floor((cam.x + Math.random()*VW)/TS), y = Math.floor((cam.y + Math.random()*VH)/TS);
        if (inb(x,y) && y > SURF+2 && DEF[tiles[I(x,y)]].solid && get(x,y+1) === T.AIR && seen[I(x,y+1)]){
          particles.push({ x:x*TS + 3 + Math.random()*10, y:(y+1)*TS, vx:0, vy:0, g:420, life:1.1, col:'#8cc8f0', sz:1 });
          if (Math.abs(x*TS - pcx()) < 200) SFX.drip();
          break;
        }
      }
    }
  }
  if (!game.opts.invincible && !game.over && P.hp/maxHp() < .3){ heartT -= dt; if (heartT <= 0){ heartT = .85; SFX.heart(); } }
}
