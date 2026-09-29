'use strict';
// ============================================================
//  Game state, modes, save/load, camera and the main loop
// ============================================================
const DEMO_DEPTH = 30;          // how deep the showcase mineshaft behind the title screen goes
let scene = 'home';          // 'home' | 'game'
let game = null;
let autosaveT = 0, fadeA = 0, savedFx = 0, hitStop = 0;
const look = { x:0, y:0, downT:0 };

function makeGame(mode, opts){
  return { mode, opts, money:0, earned:0, maxDepth:0, bag:{}, pick:0, bagLv:0, lampLv:0, armorLv:0, bootsLv:0, jetLv:0,
           contracts:[], hot:null, hint:null, wasNight:false, diff:'normal', runAch:[],
           ladder:15, support:6, torch:6, medkit:1, dynamite:2, beacon:1, platform:12, post:6, scanner:2, scan:null, bossDefeated:false, sel:0, over:false, won:false, paused:false, shopOpen:false,
           time:0, lastLayer:T.DIRT, banner:null, recall:null, stats:{ ores:0, kills:0, chests:0, contracts:0 } };
}
function careerOpts(){ return { invincible:false, infinite:false, maxGear:false, caveins:true, hazards:true, enemies:true }; }
function clearEntities(){ particles = []; floaters = []; messages = []; enemies = []; pickups = []; bombs = []; flashes = []; boss = null; fireballs = []; spawnT = 3; mapOpen = false; fadeA = 1; look.x = look.y = 0; resetRewind(); rainLevel = 0; if (rainGain && actx) rainGain.gain.setTargetAtTime(0, actx.currentTime, .2); }

function startGame(mode, freeOpts, diffKey){
  const opts = mode === 'free' ? Object.assign({}, freeDefaults, freeOpts) : careerOpts();
  game = makeGame(mode, opts);
  if (mode === 'career') game.diff = diffKey || 'normal';
  genWorld((Math.random()*1e9)|0, { lava: opts.hazards, gas: opts.hazards });
  P = makePlayer();
  if (opts.maxGear){ game.pick = PICKS.length-1; game.bagLv = BAGS.length-1; game.lampLv = LAMPS.length-1; game.armorLv = ARMOR.length-1; game.bootsLv = BOOTS.length-1; game.jetLv = JETPACKS.length-1; }
  P.hp = maxHp();
  ensureContracts(); rollMarket(false);
  track('start');
  clearEntities();
  scene = 'game'; hideScreens(); snapCamera();
  if (mode === 'career'){ msg('Dig down and bring ore back to the shop!', '#ffd24a', 5); saveGame(); }
  else msg('Free play - dig wherever you like!', '#6fd26a', 4);
  audio(); startMusic();
}
function goHome(){
  scene = 'home'; if (game){ game.paused = true; }
  genWorld(12345, {});                  // pretty demo world behind the menu
  decorateDemo();
  clearEntities();
  homeCam.t = 0;
  refreshHome(); showScreen('home');
}

// ---------- save / load (career only) ----------
function saveGame(){
  if (!game || game.mode !== 'career' || game.over) return;
  const g = Object.assign({}, game); delete g.banner; delete g.recall; delete g.hint; delete g.runAch; delete g.scan;
  const ok = store.set(SAVE_KEY, {
    v:2, arena:1, seed:worldSeed, game:g, player:{ x:P.x, y:P.y, hp:P.hp, face:P.face },
    tiles:b64enc(tiles), deco:b64enc(deco), seen:b64enc(seen), decor:b64enc(decor),
  });
  if (!ok) msg('Could not save (storage full or blocked).', '#e0533d'); else savedFx = 1.6;
}
function loadGame(){
  const s = store.get(SAVE_KEY, null);
  if (!s || s.v !== 2) return false;
  try {
    genWorld(s.seed, {});
    tiles = b64dec(s.tiles, WW*WH); deco = b64dec(s.deco, WW*WH); seen = b64dec(s.seen, WW*WH);
    if (!s.arena) carveArena();
    if (s.decor) decor = b64dec(s.decor, WW*WH);                                  // saves from before the boss existed
    const base = makeGame('career', careerOpts());
    game = Object.assign(base, s.game, { opts:careerOpts(), paused:false, shopOpen:false, over:false, banner:null, recall:null, runAch:[], stats:Object.assign(base.stats, s.game.stats || {}) });
    P = Object.assign(makePlayer(), s.player);
  } catch(e){ store.del(SAVE_KEY); return false; }
  clearEntities(); ensureContracts(); if (!game.hot) rollMarket(false);
  scene = 'game'; hideScreens(); snapCamera();
  msg('Welcome back, miner!', '#ffd24a', 3);
  audio(); startMusic();
  return true;
}

// ---------- camera ----------
const homeCam = { t:0 };
function camTarget(){ return { x: clamp(pcx() - VW/2 + look.x, 0, WW*TS - VW), y: clamp(pcy() - VH/2 + 10 + look.y - (P.y < SURF*TS ? 30 : 0), 0, WH*TS - VH) }; }   // show more sky (and the whole shop) above ground
function snapCamera(){ const t = camTarget(); cam.x = t.x; cam.y = t.y; }

// ---------- update ----------
function update(dt){
  stepEffects(dt);
  if (scene === 'home'){
    homeCam.t += dt;
    stepHomeMiner(dt);
    cam.x = clamp((HEADFRAME_X + 8)*TS - VW/2 + Math.sin(homeCam.t*.05)*30, 0, WW*TS - VW);   // frame the mineshaft
    const pan = (1 - Math.cos(homeCam.t*.045))/2 * Math.max(0, (DEMO_DEPTH + 3)*TS - VH*.66);   // slowly look down the shaft and back
    cam.y = clamp(SURF*TS - Math.min(VH*.34, 130) + pan, 0, WH*TS - VH);
    pollGamepad();
    return;
  }
  refreshInput();
  document.body.classList.toggle('nearshop', !!(P && nearShop()));
  if (game.paused) return;
  if (hitStop > 0){ hitStop -= dt; dt *= .2; }          // a split-second of slow-mo when a block shatters
  game.time += dt;
  stepRewind(dt);
  stepPlayer(dt);
  stepMining(dt);
  stepHazards(dt);
  stepRocks(dt);
  stepCaveins(dt);
  stepBuildKey();
  stepEnemies(dt);
  stepBoss(dt);
  stepPickups(dt);
  stepBombs(dt);
  stepRecall(dt);
  stepScan(dt);
  stepWeather(dt);
  stepHints(dt);
  stepAchievements(dt);
  stepAmbience(dt);
  if (!game.hot || game.time > game.hot.until) rollMarket(true);
  const dp = dayPhase();
  if (dp.night !== game.wasNight){ game.wasNight = dp.night; msg(dp.night ? 'Night falls...' : 'The sun rises.', dp.night ? '#9ab0ff' : '#ffd24a'); }
  for (const f of flashes) f.t -= dt; flashes = flashes.filter(f => f.t > 0);
  simAcc += dt; while (simAcc > .1){ simAcc -= .1; simWorld(); }
  // depth records & layer banners
  const ty = Math.floor((P.y+P.h)/TS), dep = depthOf(ty);
  if (dep > game.maxDepth){ game.maxDepth = dep; if (dep % 50 === 0) msg(`New depth record: ${dep}m`, '#ffd24a'); }
  const L = layer[I(clamp(Math.floor(pcx()/TS),0,WW-1), clamp(ty,0,WH-1))];
  if (dep > 2 && L !== game.lastLayer){ game.lastLayer = L; game.banner = { text: LAYER_NAMES[L].toUpperCase(), sub: `${dep}m below the surface`, t: 3.5 }; }
  if (game.banner) game.banner.t -= dt;
  // camera: look ahead where you're walking, peek down when holding S
  look.x += ((P.vx ? Math.sign(P.vx) : 0)*30 - look.x) * Math.min(1, dt*2);
  look.downT = (input.down && P.onGround && !P.onLadder && !input.digKey) ? look.downT + dt : 0;
  look.y += ((look.downT > .35 ? 70 : 0) - look.y) * Math.min(1, dt*4);
  const t = camTarget(), kx = Math.min(1, dt*12), ky = Math.min(1, dt*10);
  cam.x += (t.x - cam.x) * kx; cam.y += (t.y - cam.y) * ky;
  // autosave
  autosaveT += dt; if (autosaveT > 20){ autosaveT = 0; saveGame(); }
}
let simAcc = 0;

// ---------- loop ----------
let last = performance.now();
function loop(t){
  const dt = Math.min(.033, (t - last)/1000); last = t;
  update(dt);
  render(t/1000);
  requestAnimationFrame(loop);
}

// ---------- boot ----------
buildArt();
resize();
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
document.addEventListener('visibilitychange', () => { if (document.hidden && scene === 'game' && game.mode === 'career') saveGame(); });
window.addEventListener('beforeunload', () => { if (scene === 'game' && game && game.mode === 'career') saveGame(); saveLife(); });
setupTouch();
buildFreeSetup();
game = makeGame('career', careerOpts()); game.paused = true;
P = makePlayer();
goHome();
requestAnimationFrame(loop);

// a deep mineshaft under the MINE tower so the title screen shows off the game
function decorateDemo(){
  const x = HEADFRAME_X + 1, top = SURF, bot = top + DEMO_DEPTH;
  const air = (a, b) => { if (inb(a,b)) { tiles[I(a,b)] = T.AIR; deco[I(a,b)] = 0; } };
  const put = (a, b, t) => { if (inb(a,b)) tiles[I(a,b)] = t; };
  const floor = (a0, a1, b) => { for (let a=a0; a<=a1; a++) if (inb(a,b) && !DEF[tiles[I(a,b)]].solid) tiles[I(a,b)] = T.STONE; };
  // main shaft, with torch niches every few metres
  for (let y=top; y<bot; y++){ air(x,y); deco[I(x,y)] = D.LADDER; }
  for (let y=top+4; y<bot-2; y+=6){ air(x-1,y); deco[I(x-1,y)] = D.TORCH; put(x-1, y+1, T.STONE); }

  // level 1: gem gallery (right)
  const g1 = top + 8;
  for (let a=x+1; a<x+16; a++){ air(a, g1); air(a, g1+1); }
  floor(x+1, x+15, g1+2);
  for (let a=x+3; a<x+16; a+=5){ deco[I(a, g1+1)] = D.SUPPORT; deco[I(a, g1)] = D.SUPPORT; }
  for (let a=x+1; a<x+16; a+=5) deco[I(a, g1)] = D.TORCH;
  [[x+5,g1-1,T.GOLD],[x+6,g1-1,T.GOLD],[x+9,g1+2,T.RUBY],[x+13,g1-1,T.DIAMOND],[x+2,g1+2,T.EMERALD],[x+15,g1+2,T.AMETHYST],[x+11,g1-1,T.SAPPHIRE]].forEach(([a,b,t]) => put(a,b,t));

  // level 2: chamber with a plank bridge on posts and a chest (right)
  const c2 = top + 15;
  for (let b=c2-2; b<=c2+1; b++) for (let a=x+1; a<x+14; a++) air(a, b);
  floor(x+1, x+13, c2+2);
  for (let a=x+1; a<x+14; a++) deco[I(a, c2-1)] = D.PLATFORM;
  deco[I(x+7, c2)] = D.POST; deco[I(x+7, c2+1)] = D.POST;
  put(x+11, c2+1, T.CHEST);
  deco[I(x+3, c2+1)] = D.TORCH; deco[I(x+12, c2-2)] = D.TORCH;

  // level 3: long timbered gallery into the stone (left), with ore veins
  const g3 = top + 21;
  for (let a=x-18; a<x; a++){ air(a, g3); air(a, g3+1); }
  floor(x-18, x-1, g3+2);
  for (let a=x-3; a>x-19; a-=4){ deco[I(a, g3+1)] = D.SUPPORT; deco[I(a, g3)] = D.SUPPORT; }
  for (let a=x-1; a>x-19; a-=4) deco[I(a, g3)] = D.TORCH;
  [[x-5,g3-1,T.IRON],[x-6,g3-1,T.IRON],[x-6,g3-2,T.IRON],[x-10,g3+2,T.SILVER],[x-11,g3+2,T.SILVER],[x-14,g3-1,T.GOLD],[x-15,g3-1,T.GOLD],[x-15,g3-2,T.GOLD],[x-17,g3+2,T.COPPER]].forEach(([a,b,t]) => put(a,b,t));

  // level 4: deep cavern with a lava pool, a bridge on posts, crystals and treasure
  const c4 = bot - 3;
  for (let b=c4-3; b<=c4+2; b++) for (let a=x-7; a<=x+14; a++){
    const nx = (a - (x+3.5))/11.5, ny = (b - (c4-0.5))/3.4;
    if (nx*nx + ny*ny <= 1.05) air(a, b);
  }
  floor(x-7, x+14, c4+3);
  for (let a=x+4; a<=x+10; a++){ put(a, c4+2, T.LAVA); put(a, c4+3, T.STONE); }          // lava pool in the floor
  put(x+3, c4+2, T.STONE); put(x+11, c4+2, T.STONE);
  for (let a=x+2; a<=x+12; a++) deco[I(a, c4)] = D.PLATFORM;                           // bridge over the lava
  deco[I(x+3, c4+1)] = D.POST; deco[I(x+11, c4+1)] = D.POST;
  put(x-5, c4+2, T.CHEST);
  deco[I(x-3, c4+2)] = D.TORCH; deco[I(x+13, c4)] = D.TORCH;
  [[x-7,c4-2,T.RUBY],[x-6,c4-3,T.DIAMOND],[x+13,c4-3,T.AMETHYST],[x+14,c4-1,T.EMERALD],[x+8,c4-4,T.DIAMOND],[x+1,c4-4,T.MYTHRIL],[x+12,c4+1,T.SAPPHIRE]].forEach(([a,b,t]) => put(a,b,t));
  for (let y=top; y<=c4+2; y++) if (inb(x,y) && !DEF[tiles[I(x,y)]].solid) deco[I(x,y)] = D.LADDER;   // the ladder runs all the way down
}
