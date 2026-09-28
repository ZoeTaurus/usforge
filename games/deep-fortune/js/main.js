'use strict';
// ============================================================
//  Game state, modes, save/load, camera and the main loop
// ============================================================
let scene = 'home';          // 'home' | 'game'
let game = null;
let autosaveT = 0, fadeA = 0;
const look = { x:0, y:0, downT:0 };

function makeGame(mode, opts){
  return { mode, opts, money:0, earned:0, maxDepth:0, bag:{}, pick:0, bagLv:0, lampLv:0, armorLv:0, bootsLv:0, jetLv:0,
           contracts:[], hot:null, hint:null, wasNight:false, diff:'normal', runAch:[],
           ladder:15, support:6, torch:6, medkit:1, dynamite:2, beacon:1, sel:0, over:false, won:false, paused:false, shopOpen:false,
           time:0, lastLayer:T.DIRT, banner:null, recall:null, stats:{ ores:0, kills:0, chests:0, contracts:0 } };
}
function careerOpts(){ return { invincible:false, infinite:false, maxGear:false, caveins:true, hazards:true, enemies:true }; }
function clearEntities(){ particles = []; floaters = []; messages = []; enemies = []; pickups = []; bombs = []; flashes = []; spawnT = 3; mapOpen = false; fadeA = 1; look.x = look.y = 0; }

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
  clearEntities();
  homeCam.t = 0; cam.x = clamp(homeMiner.x - VW*.3, 0, WW*TS - VW);
  refreshHome(); showScreen('home');
}

// ---------- save / load (career only) ----------
function saveGame(){
  if (!game || game.mode !== 'career' || game.over) return;
  const g = Object.assign({}, game); delete g.banner; delete g.recall; delete g.hint; delete g.runAch;
  const ok = store.set(SAVE_KEY, {
    v:2, seed:worldSeed, game:g, player:{ x:P.x, y:P.y, hp:P.hp, face:P.face },
    tiles:b64enc(tiles), deco:b64enc(deco), seen:b64enc(seen),
  });
  if (!ok) msg('Could not save (storage full or blocked).', '#e0533d');
}
function loadGame(){
  const s = store.get(SAVE_KEY, null);
  if (!s || s.v !== 2) return false;
  try {
    genWorld(s.seed, {});
    tiles = b64dec(s.tiles, WW*WH); deco = b64dec(s.deco, WW*WH); seen = b64dec(s.seen, WW*WH);
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
    cam.x += (clamp(homeMiner.x - VW*.3, 0, WW*TS - VW) - cam.x) * Math.min(1, dt*1.2);
    cam.y = clamp(SURF*TS - Math.min(VH*.55, 190), 0, WH*TS - VH);
    pollGamepad();
    return;
  }
  refreshInput();
  document.body.classList.toggle('nearshop', !!(P && nearShop()));
  if (game.paused) return;
  game.time += dt;
  stepPlayer(dt);
  stepMining(dt);
  stepHazards(dt);
  stepRocks(dt);
  stepCaveins(dt);
  stepBuildKey();
  stepEnemies(dt);
  stepPickups(dt);
  stepBombs(dt);
  stepRecall(dt);
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
  const t = camTarget(), k = Math.min(1, dt*8);
  cam.x += (t.x - cam.x) * k; cam.y += (t.y - cam.y) * k;
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
