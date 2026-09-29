'use strict';
// ============================================================
//  Menus & overlays: home, free play setup, pause, settings,
//  how-to, shop, end screens
// ============================================================
const SCREENS = ['home', 'freeSetup', 'howto', 'settingsScreen', 'pause', 'shopScreen', 'endScreen', 'confirm', 'achScreen', 'diffScreen'];
let currentScreen = null, returnTo = null;

function showScreen(id){
  for (const s of SCREENS) $(s).classList.toggle('show', s === id);
  currentScreen = id;
  document.body.classList.toggle('menu', !!id);
  // keyboard/gamepad friendly: put focus on the first button of the new screen
  if (id && !isTouch) requestAnimationFrame(() => { const b = $(id).querySelector('button:not([disabled])'); if (b && b.offsetParent !== null) b.focus({ preventScroll:true }); else { const n = [...$(id).querySelectorAll('button:not([disabled])')].find(x => x.offsetParent !== null); n && n.focus({ preventScroll:true }); } });
}
function hideScreens(){ showScreen(null); }

function handleBack(){
  if (mapOpen){ toggleMap(); return; }
  if (currentScreen === 'confirm') { showScreen(returnTo || 'home'); return; }
  if (currentScreen === 'shopScreen'){ closeShop(); return; }
  if (currentScreen === 'howto' || currentScreen === 'settingsScreen' || currentScreen === 'achScreen'){ SFX.click(); showScreen(returnTo); return; }
  if (currentScreen === 'freeSetup' || currentScreen === 'diffScreen'){ SFX.click(); showScreen('home'); return; }
  if (currentScreen === 'pause'){ resumeGame(); return; }
  if (scene === 'game' && !game.over && !currentScreen) pauseGame();
}

// ---------- home ----------
function homeArt(){
  if (homeArt.done) return; homeArt.done = true;
  const gear = (() => { const [c, x] = mkCanvas(16, 16); const P = (col,X,Y,w=1,h=1) => { x.fillStyle = col; x.fillRect(X,Y,w,h); };
    P('#6a6a78',6,1,4,14); P('#6a6a78',1,6,14,4); P('#6a6a78',3,3,10,10); P('#9a9aa8',4,4,8,8); P('#6a6a78',6,6,4,4); P('#1a1020',7,7,2,2); P('#c8c8d4',4,4,3,1); return c; })();
  const art = { career: PICK_SPR[1], free: ICON.dynamite, how: achIcon('scroll'), settings: gear };
  document.querySelectorAll('[data-ico]').forEach(img => { const a = art[img.dataset.ico]; if (a) img.src = a.toDataURL(); });
  const big = mkCanvas(30, 30); big[1].drawImage(PICK_SPR[3], 0, 0, 30, 30); $('logoPick').src = big[0].toDataURL();
}
function refreshHome(){
  homeArt();
  const save = store.get(SAVE_KEY, null), best = store.get(BEST_KEY, {});
  $('btnContinue').style.display = save ? '' : 'none';
  if (save) $('btnContinue').innerHTML = `CONTINUE <small>${fmtMoney(save.game.money)} &bull; ${save.game.maxDepth}m &bull; ${DIFFICULTY[save.game.diff || 'normal'].name}</small>`;
  $('btnAch').innerHTML = `<img class="ico" src="${achIcon('trophy').toDataURL()}" alt="">ACHIEVEMENTS <small>${achCount()}/${ACHIEVEMENTS.length}</small>`;
  const bits = [];
  if (best.earned) bits.push(`Best earnings ${fmtMoney(best.earned)}`);
  if (best.depth) bits.push(`Deepest ${best.depth}m`);
  if (best.retired) bits.push(`Fastest retirement ${fmtTime(best.retired)}`);
  if (LIFE.ores) bits.push(`${LIFE.ores.toLocaleString()} ore mined`);
  $('homeStats').textContent = bits.join('  •  ') || 'No records yet - go make some!';
  $('homeTip').textContent = 'TIP: ' + TIPS[Math.random()*TIPS.length|0];
}
const TIPS = [
  'Digging straight down is safe from cave-ins. Tunnels sideways need supports.',
  'Supports only work when they reach the roof. Stack them in tall rooms!',
  'Water poured onto lava turns it into obsidian. Flood a lava lake to make it safe!',
  'Underwater? Watch the bubbles above your head - hold jump to swim up for air.',
  'Press Q to fire an ore scanner pulse and reveal gems hidden in the dark.',
  'Cracks and falling dust mean the ceiling is about to go. Move or build a support!',
  'Place a ladder behind you as you dig down so you can climb back up.',
  'Falls of more than 5 tiles hurt. Ladders cancel your fall.',
  'Poison gas rises. Lava flows down and burns ladders.',
  'Gold, rubies and diamonds glow faintly in the dark.',
  'Your health slowly refills while you stand on the surface.',
  'Torches light up your tunnels permanently.',
  'Hold J to dig with the keyboard: add W or S to dig up or down.',
  'Press B to build at your cursor. Hold B and sweep to build a whole row.',
  'Hold B while climbing down to lay ladders as you go.',
  'Platforms (5) make bridges across caves. Jump up through them, hold S to drop down.',
  'Monsters never spawn near torches. Light up your base!',
  'Click a monster to whack it with your pick. Better picks hit harder.',
  'Treasure chests hide in natural caves. Crack them open for loot.',
  'Dynamite (4) blasts a big hole and collects the ore inside. Stand back!',
  'In trouble? Press R to use a recall beacon and warp to the surface.',
  'Voidstone, the rarest ore, only appears near the very bottom.',
];
$('btnContinue').onclick = () => { SFX.click(); if (!loadGame()) { refreshHome(); } };
$('btnCareer').onclick = () => {
  SFX.click();
  if (store.get(SAVE_KEY, null)) askConfirm('Start a new career? Your saved career will be overwritten.', openDifficulty, 'home');
  else openDifficulty();
};
function openDifficulty(){
  $('diffList').innerHTML = Object.entries(DIFFICULTY).map(([k, d]) =>
    `<button class="diff-card ${k === 'normal' ? 'rec' : ''}" data-diff="${k}" style="--c:${d.col}"><b>${d.name.toUpperCase()}</b>${k === 'normal' ? ' <span class="tag">RECOMMENDED</span>' : ''}<br><small>${d.desc}</small></button>`).join('');
  document.querySelectorAll('[data-diff]').forEach(b => b.onclick = () => { SFX.click(); startGame('career', null, b.dataset.diff); });
  showScreen('diffScreen');
}
$('diffBack').onclick = () => { SFX.click(); showScreen('home'); };
$('btnAch').onclick = () => { SFX.click(); openAchievements('home'); };
$('achBack').onclick = () => { SFX.click(); showScreen(returnTo); };
$('btnFree').onclick = () => { SFX.click(); showScreen('freeSetup'); };
$('btnHow').onclick = () => { SFX.click(); returnTo = 'home'; showScreen('howto'); };
$('btnSettings').onclick = () => { SFX.click(); returnTo = 'home'; openSettings(); };

// ---------- confirm ----------
let confirmYes = null;
function askConfirm(textStr, yes, back){ confirmYes = yes; returnTo = back; $('confirmText').textContent = textStr; showScreen('confirm'); }
$('confirmYes').onclick = () => { SFX.click(); const f = confirmYes; confirmYes = null; f && f(); };
$('confirmNo').onclick = () => { SFX.click(); showScreen(returnTo || 'home'); };

// ---------- free play ----------
const FREE_OPTS = [
  ['optInv',   'invincible', 'Invincible',             'No damage from anything'],
  ['optInf',   'infinite',   'Unlimited everything',   'Free shop, endless items, bottomless backpack'],
  ['optGear',  'maxGear',    'Start fully upgraded',   'Plasma drill, big lamp, best armour'],
  ['optCave',  'caveins',    'Cave-ins & falling rock', 'Unsupported tunnels collapse'],
  ['optLava',  'hazards',    'Lava & poison gas',      'Generate hazard pockets underground'],
  ['optMob',   'enemies',    'Monsters',               'Bats, slimes, crawlers and fire wisps'],
];
const freeDefaults = { invincible:true, infinite:true, maxGear:true, caveins:true, hazards:true, enemies:true };
function buildFreeSetup(){
  const saved = Object.assign({}, freeDefaults, store.get('deepfortune.freeopts', {}));
  $('freeOpts').innerHTML = FREE_OPTS.map(([id, key, label, desc]) =>
    `<label class="toggle"><input type="checkbox" id="${id}" ${saved[key] ? 'checked' : ''}><span class="box"></span><span><b>${label}</b><br><small>${desc}</small></span></label>`).join('');
}
$('freeStart').onclick = () => {
  SFX.click();
  const o = {}; for (const [id, key] of FREE_OPTS) o[key] = $(id).checked;
  store.set('deepfortune.freeopts', o);
  startGame('free', o);
};
$('freeBack').onclick = () => { SFX.click(); showScreen('home'); };

// ---------- settings ----------
function openSettings(){
  $('setVolume').value = Math.round(settings.volume*100);
  $('volLabel').textContent = Math.round(settings.volume*100) + '%';
  $('setMusicVol').value = Math.round(settings.musicVol*100); $('musLabel').textContent = Math.round(settings.musicVol*100) + '%';
  for (const k of ['music','shake','softLight','minimap','hints','rewind']) $('set_'+k).checked = !!settings[k];
  document.querySelectorAll('[data-zoom]').forEach(b => b.classList.toggle('on', +b.dataset.zoom === settings.zoom));
  showScreen('settingsScreen');
}
$('setVolume').oninput = e => { settings.volume = e.target.value/100; $('volLabel').textContent = e.target.value + '%'; audio(); if (master) master.gain.value = muted ? 0 : settings.volume; saveSettings(); };
$('setVolume').onchange = () => SFX.ore();
$('setMusicVol').oninput = e => { settings.musicVol = e.target.value/100; $('musLabel').textContent = e.target.value + '%'; audio(); saveSettings(); };
$('resetHints').onclick = () => { resetHints(); SFX.hint(); $('resetHints').textContent = 'TIPS RESET!'; setTimeout(() => $('resetHints').textContent = 'SHOW ALL TIPS AGAIN', 1200); };
document.querySelectorAll('[data-zoom]').forEach(b => b.onclick = () => { settings.zoom = +b.dataset.zoom; saveSettings(); resize(); SFX.click(); document.querySelectorAll('[data-zoom]').forEach(x => x.classList.toggle('on', x === b)); });
for (const k of ['music','shake','softLight','minimap','hints','rewind']) $('set_'+k).onchange = e => { settings[k] = e.target.checked; saveSettings(); SFX.click(); };
$('settingsBack').onclick = () => { SFX.click(); showScreen(returnTo); };
$('howBack').onclick = () => { SFX.click(); showScreen(returnTo); };

// ---------- pause ----------
function pauseGame(){ if (game.over) return; game.paused = true; showScreen('pause'); $('pauseInfo').innerHTML = (game.mode === 'free' ? 'Free play - progress is not saved.' : 'Your career is saved automatically.') + `<br><br>Ore mined: ${game.stats.ores} &bull; Monsters: ${game.stats.kills} &bull; Chests: ${game.stats.chests} &bull; Contracts: ${game.stats.contracts||0}`; $('pauseQuit').textContent = game.mode === 'free' ? 'QUIT TO MENU' : 'SAVE & QUIT'; $('pauseRewind').style.display = canRewind() ? '' : 'none'; }
function resumeGame(){ SFX.click(); hideScreens(); game.paused = false; }
$('pauseResume').onclick = resumeGame;
$('pauseHow').onclick = () => { SFX.click(); returnTo = 'pause'; showScreen('howto'); };
$('pauseSettings').onclick = () => { SFX.click(); returnTo = 'pause'; openSettings(); };
$('pauseAch').onclick = () => { SFX.click(); openAchievements('pause'); };
$('pauseQuit').onclick = () => { SFX.click(); if (game.mode === 'career') saveGame(); goHome(); };

// ---------- shop ----------
function nearShop(){ const cx = pcx()/TS; return cx >= SHOP_X0-1 && cx <= SHOP_X1+1 && P.y < SURF*TS; }
function openShop(){ game.shopOpen = true; game.paused = true; renderShop(); showScreen('shopScreen'); SFX.click(); }
function closeShop(){ game.shopOpen = false; game.paused = false; hideScreens(); if (game.mode === 'career') saveGame(); }
$('closeShop').onclick = closeShop;
const price = n => game.opts.infinite ? 0 : n;
const canAfford = n => game.opts.infinite || game.money >= n;
function spend(n){ if (!game.opts.infinite) game.money -= n; }
function renderShop(){
  $('shopCash').textContent = game.opts.infinite ? '$ ∞' : fmtMoney(game.money);
  let total = 0, html = '';
  for (const [id] of ORES){
    const n = game.bag[id] || 0; if (!n) continue;
    const d = DEF[id], hot = game.hot && game.hot.id === id; total += n*oreValue(id);
    html += `<div class="row"><span><i class="swatch" style="background:${rgb(d.c1)};box-shadow:inset -2px -2px 0 ${rgb(d.c1,.6)},inset 2px 2px 0 ${rgb(d.c2)}"></i>${d.name} ×${n}${hot ? ' <span class="hot">HOT</span>' : ''}</span><span class="money">${fmtMoney(n*oreValue(id))}</span></div>`;
  }
  if (!html) html = `<p class="muted">Your backpack is empty. Go dig!</p>`;
  html += `<div class="row total"><span>Bag ${bagCount()}${game.opts.infinite ? '' : '/'+bagCap()}</span><button class="btn gold" id="sellAll" ${total ? '' : 'disabled'}>SELL ALL ${fmtMoney(total)}</button></div>`;
  if (game.hot) html += `<p class="small-note"><span class="hot">HOT</span> ${DEF[game.hot.id].name} sells for +50% for ${Math.max(1, Math.ceil((game.hot.until - game.time)/60))} more min.</p>`;
  html += `<details><summary>Price list</summary><div class="prices">${ORES.map(o => `<span><i class="swatch" style="background:${rgb(o[5])}"></i>${o[1]} $${oreValue(o[0])}</span>`).join('')}</div></details>`;
  if (game.mode === 'career' || !game.opts.infinite){
    ensureContracts();
    html += `<h2 class="sub">CONTRACTS</h2>` + game.contracts.map((c, i) => {
      const have = game.bag[c.id] || 0, d = DEF[c.id], ok = have >= c.need;
      return `<div class="row"><span><i class="swatch" style="background:${rgb(d.c1)}"></i>${c.need} ${d.name}<br><small class="muted">have ${have}/${c.need} &bull; pays <span class="money">${fmtMoney(c.reward)}</span></small></span><button class="btn gold" data-con="${i}" ${ok ? '' : 'disabled'}>DELIVER</button></div>`;
    }).join('');
  }
  $('sellList').innerHTML = html;
  document.querySelectorAll('[data-con]').forEach(b => b.onclick = () => { deliverContract(+b.dataset.con); renderShop(); });
  if (total) $('sellAll').onclick = () => {
    game.money += total; game.earned += total; game.bag = {}; SFX.cash();
    msg(`Sold ore for ${fmtMoney(total)}!`, '#ffd24a'); track('sell', total); renderShop(); checkWin();
  };
  $('supplyList').innerHTML = SUPPLIES.map((s, i) => {
    const cost = price(s.cost*s.pack);
    return `<div class="row"><span><img class="icon" src="${ICON[s.key].toDataURL()}">${s.name} ×${s.pack}<br><small class="muted">${s.desc} • have ${game.opts.infinite ? '∞' : game[s.key]}</small></span><button class="btn" data-sup="${i}" ${canAfford(cost) && !game.opts.infinite ? '' : 'disabled'}>${game.opts.infinite ? '\u221e' : '$'+cost}</button></div>`;
  }).join('') + `<div class="row"><span>Patch up<br><small class="muted">HP ${Math.ceil(P.hp)}/${maxHp()}</small></span><button class="btn" id="heal" ${canAfford(10) && P.hp < maxHp() ? '' : 'disabled'}>${game.opts.infinite ? 'FREE' : '$10'}</button></div>`;
  document.querySelectorAll('[data-sup]').forEach(b => b.onclick = () => {
    const s = SUPPLIES[+b.dataset.sup], cost = price(s.cost*s.pack);
    if (!canAfford(cost)) return; spend(cost); game[s.key] += s.pack; SFX.buy(); renderShop();
  });
  $('heal').onclick = () => { if (!canAfford(10)) return; spend(price(10)); P.hp = maxHp(); SFX.heal(); renderShop(); };
  const ups = [
    ['pick',    PICKS, l => `${l.name}<br><small class="muted">breaks ${HARD_NAMES[l.hard]}, speed ×${l.speed}</small>`],
    ['bagLv',   BAGS,  l => `Backpack<br><small class="muted">holds ${l.cap} ore</small>`],
    ['lampLv',  LAMPS, l => `Helmet lamp<br><small class="muted">light radius ${l.r}</small>`],
    ['armorLv', ARMOR, l => `Armour<br><small class="muted">${l.hp} max HP</small>`],
    ['bootsLv', BOOTS, l => `${l.name}<br><small class="muted">higher jump, ${Math.round((1-l.fall)*100)}% less fall damage</small>`],
    ['jetLv',   JETPACKS, l => `${l.name}<br><small class="muted">hold jump in mid-air to fly (${l.fuel}s of fuel)</small>`],
  ];
  $('upgradeList').innerHTML = ups.map(([key, list, desc], i) => {
    const lv = game[key], next = list[lv+1];
    const pips = list.map((_, k) => `<i class="pip ${k <= lv ? 'on' : ''}"></i>`).join('');
    if (!next) return `<div class="row"><span>${desc(list[lv])}<br>${pips}</span><span class="muted">MAX</span></div>`;
    const cost = price(next.cost);
    return `<div class="row"><span>${desc(next)}<br>${pips}</span><button class="btn" data-up="${i}" ${canAfford(cost) ? '' : 'disabled'}>${game.opts.infinite ? 'FREE' : '$'+cost.toLocaleString()}</button></div>`;
  }).join('');
  document.querySelectorAll('[data-up]').forEach(b => b.onclick = () => {
    const [key, list] = ups[+b.dataset.up], next = list[game[key]+1];
    if (!next || !canAfford(price(next.cost))) return;
    spend(price(next.cost)); game[key]++;
    if (key === 'armorLv') P.hp += next.hp - list[game[key]-1].hp;
    SFX.cash(); renderShop();
  });
}

// ---------- end states ----------
function recordBest(extra = {}){
  if (game.mode !== 'career') return;
  const best = store.get(BEST_KEY, {});
  best.earned = Math.max(best.earned || 0, game.earned);
  best.depth = Math.max(best.depth || 0, game.maxDepth);
  if (extra.retired) best.retired = best.retired ? Math.min(best.retired, extra.retired) : extra.retired;
  store.set(BEST_KEY, best);
}
function checkWin(){
  if (game.mode !== 'career' || game.won || game.money < goalOf()) return;
  game.won = true; game.paused = true; game.shopOpen = false;
  track('win'); saveLife(); recordBest({ retired: game.time }); saveGame();
  SFX.win();
  $('endTitle').textContent = 'RETIRED RICH!'; $('endTitle').className = 'win';
  $('endText').innerHTML = `You made <span class="money">${fmtMoney(game.money)}</span> and lived to spend it.<br><br>Deepest dig: ${game.maxDepth}m<br>Time: ${fmtTime(game.time)}` + `<br>Ore mined: ${game.stats.ores} &nbsp; Monsters: ${game.stats.kills}<br>Chests: ${game.stats.chests} &nbsp; Contracts: ${game.stats.contracts||0}` + runAchHTML();
  $('continueBtn').style.display = '';
  showScreen('endScreen');
}
function die(cause){
  if (game.over) return;
  game.over = true; game.paused = true; P.hp = 0;
  SFX.die(); shake(8);
  burst(pcx(), pcy(), '#c0392b', 36, 90);
  track('death'); saveLife();
  // with rewind on, keep the save until the player decides not to rewind
  if (game.mode === 'career'){ recordBest(); if (!settings.rewind) store.del(SAVE_KEY); }
  setTimeout(() => {
    $('endTitle').textContent = 'YOU DIED'; $('endTitle').className = 'lose';
    $('endText').innerHTML = `${cause}<br><br>Cash: <span class="money">${fmtMoney(game.money)}</span><br>Total earned: ${fmtMoney(game.earned)}<br>Deepest dig: ${game.maxDepth}m &nbsp; Time: ${fmtTime(game.time)}` + `<br>Ore mined: ${game.stats.ores} &nbsp; Monsters: ${game.stats.kills}<br>Chests: ${game.stats.chests} &nbsp; Contracts: ${game.stats.contracts||0}` + runAchHTML();
    $('continueBtn').style.display = 'none';
    $('rewindBtn').style.display = canRewind() ? '' : 'none';
    showScreen('endScreen');
    if (canRewind()) $('rewindBtn').focus();
  }, 1100);
}
$('continueBtn').onclick = () => { SFX.click(); hideScreens(); game.paused = false; };
$('rewindBtn').onclick = () => { doRewind(); };
$('pauseRewind').onclick = () => { if (doRewind()) SFX.click(); };
const giveUp = () => { if (game.over && game.mode === 'career') store.del(SAVE_KEY); };
$('restartBtn').onclick = () => { SFX.click(); giveUp(); startGame(game.mode, game.mode === 'free' ? game.opts : undefined); };
$('homeBtn').onclick = () => { SFX.click(); giveUp(); goHome(); };

function runAchHTML(){
  if (!game.runAch || !game.runAch.length) return '';
  return `<br><br><span class="money">Achievements this run:</span><br>` + game.runAch.map(id => ACH_BY_ID[id][1]).join(' &bull; ');
}
