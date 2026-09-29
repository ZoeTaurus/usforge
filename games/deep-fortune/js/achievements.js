'use strict';
// ============================================================
//  Difficulty levels, lifetime stats and achievements
// ============================================================
const DIFFICULTY = {
  relaxed:  { name:'Relaxed',  goal:15000, dmg:.5,  cave:.5,  mobs:.6, col:'#6fd26a', desc:'Half damage, fewer cave-ins and monsters. Retire at $15,000.' },
  normal:   { name:'Normal',   goal:25000, dmg:1,   cave:1,   mobs:1,  col:'#ffd24a', desc:'The way the mine was meant to be dug. Retire at $25,000.' },
  hardcore: { name:'Hardcore', goal:40000, dmg:1.5, cave:1.4, mobs:1.5, col:'#e0533d', desc:'Everything hits harder and monsters swarm. Retire at $40,000.' },
};
const diff = () => DIFFICULTY[(game && game.mode === 'career' && game.diff) || 'normal'];
const goalOf = () => diff().goal;

// ---------- lifetime stats (fair runs only) ----------
const LIFE_KEY = 'deepfortune.lifetime', ACH_KEY = 'deepfortune.achievements';
const LIFE = Object.assign({ ores:0, kills:0, chests:0, contracts:0, earned:0, deaths:0, supports:0, torches:0, dynamite:0, runs:0, wins:0, playTime:0, deepest:0, oreTypes:{} }, store.get(LIFE_KEY, {}));
const UNLOCKED = store.get(ACH_KEY, {});
let lifeDirty = false, lifeSaveT = 0, achCheckT = 0;
const achToasts = [];
const fair = () => game && !game.devTest && (game.mode === 'career' || (!game.opts.invincible && !game.opts.infinite && !game.opts.maxGear));
function life(key, n = 1){ if (!fair()) return; LIFE[key] = (LIFE[key]||0) + n; lifeDirty = true; }
function saveLife(){ if (lifeDirty){ store.set(LIFE_KEY, LIFE); lifeDirty = false; } }

//   id             name                  description                                 icon            progress (counters)
const ACHIEVEMENTS = [
  ['first_ore',   'First Strike',        'Mine your first chunk of ore',             'ore:'+T.COAL],
  ['first_sale',  'Open for Business',   'Sell ore at the shop',                     'coin'],
  ['depth_25',    'Going Down',          'Reach 25m below the surface',              'depth'],
  ['depth_100',   'Deep Diver',          'Reach 100m below the surface',             'depth'],
  ['depth_175',   'Into the Abyss',      'Reach 175m below the surface',             'depth'],
  ['depth_240',   'Rock Bottom',         'Reach 240m, just above the bedrock',       'depth'],
  ['rich_1k',     'Pocket Money',        'Hold $1,000 at once',                      'coin'],
  ['rich_10k',    'High Roller',         'Hold $10,000 at once',                     'coin'],
  ['retire',      'Retired Rich',        'Win a career',                             'trophy'],
  ['retire_fast', 'Speed Miner',         'Retire in under 40 minutes',               'trophy'],
  ['retire_hard', 'Hardened',            'Retire on Hardcore',                       'trophy'],
  ['gem_diamond', 'Shine Bright',        'Mine a diamond',                           'ore:'+T.DIAMOND],
  ['gem_void',    'Void Touched',        'Mine the legendary voidstone',             'ore:'+T.VOIDSTONE],
  ['collector',   'Collector',           'Mine every type of ore (all runs)',        'ore:'+T.AMETHYST, () => [Object.keys(LIFE.oreTypes).length, ORES.length]],
  ['kill_1',      'Pest Control',        'Defeat a monster',                         'enemy:bat'],
  ['kill_50',     'Monster Hunter',      'Defeat 50 monsters (all runs)',            'enemy:slime', () => [LIFE.kills, 50]],
  ['golem',       'Giant Slayer',        'Defeat a Rock Golem',                      'enemy:golem'],
  ['chest_1',     'Treasure Hunter',     'Open a treasure chest',                    'chest'],
  ['chest_10',    "Pirate's Life",       'Open 10 treasure chests (all runs)',       'chest', () => [LIFE.chests, 10]],
  ['contract_1',  'Contractor',          'Complete a shop contract',                 'scroll'],
  ['contract_10', 'Reliable Supplier',   'Complete 10 contracts (all runs)',         'scroll', () => [LIFE.contracts, 10]],
  ['boom',        'Demolition Expert',   'Blow something up with dynamite',          'icon:dynamite'],
  ['oops',        'Oops',                'Get caught in your own blast',             'icon:dynamite'],
  ['supports_25', 'Safety First',        'Build 25 supports (all runs)',             'icon:support', () => [LIFE.supports, 25]],
  ['torches_50',  'Light It Up',         'Place 50 torches (all runs)',              'icon:torch', () => [LIFE.torches, 50]],
  ['plasma',      'Plasma Power',        'Buy the Plasma Drill',                     'pick'],
  ['rocket',      'Rocket Miner',        'Buy a jetpack',                            'jet'],
  ['beam',        'Beam Me Up',          'Warp home with a recall beacon',           'icon:beacon'],
  ['close_call',  'Close Call',          'Survive with less than 10 HP',             'heart'],
  ['night_shift', 'Night Shift',         'Sell ore in the middle of the night',      'moon'],
  ['packed',      'Packed Tight',        'Fill the biggest backpack to the brim',    'bag'],
  ['rip',         'Occupational Hazard', 'Die for the first time',                   'skull'],
  ['wyrm',        'Wyrm Slayer',         'Defeat the Deep Wyrm at the bottom of the mine', 'boss'],
  ['bridge',      'Bridge Builder',      'Build a 12-plank bridge',                  'icon:platform'],
  ['cathedral',   'Cathedral Ceilings',  'Brace a roof with a support column 4 tall', 'icon:support'],
  ['obsidian',    'Cooling Off',         'Let water pour onto lava and make obsidian', 'moon'],
  ['fossil',      'Paleontologist',      'Dig up a fossil',                          'ore:'+T.FOSSIL],
  ['scavenger',   'Scavenger',           'Search an abandoned minecart',             'chest'],
  ['crystal',     'Crystal Gardener',    'Harvest a glowing crystal cluster',        'ore:'+T.AMETHYST],
];
const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map(a => [a[0], a]));
const achCount = () => Object.keys(UNLOCKED).filter(id => ACH_BY_ID[id]).length;

function unlock(id){
  if (UNLOCKED[id] || !ACH_BY_ID[id] || !fair()) return;
  UNLOCKED[id] = Date.now(); store.set(ACH_KEY, UNLOCKED);
  achToasts.push({ id, t:0 });
  if (game.runAch) game.runAch.push(id);
  SFX.achievement();
}

// ---------- events from the rest of the game ----------
function track(ev, data){
  if (!game || !fair()) return;
  switch (ev){
    case 'ore':
      life('ores'); if (!LIFE.oreTypes[data]){ LIFE.oreTypes[data] = 1; lifeDirty = true; }
      unlock('first_ore'); if (data === T.DIAMOND) unlock('gem_diamond'); if (data === T.VOIDSTONE) unlock('gem_void'); if (data === T.FOSSIL) unlock('fossil');
      break;
    case 'sell': unlock('first_sale'); if (dayPhase().night) unlock('night_shift'); life('earned', data); break;
    case 'earn': life('earned', data); break;
    case 'kill': life('kills'); unlock('kill_1'); if (data === 'golem') unlock('golem'); break;
    case 'chest': life('chests'); unlock('chest_1'); break;
    case 'contract': life('contracts'); unlock('contract_1'); break;
    case 'boom': life('dynamite'); unlock('boom'); break;
    case 'selfblast': unlock('oops'); break;
    case 'place': if (data === 'support') life('supports'); if (data === 'torch') life('torches'); break;
    case 'recall': unlock('beam'); break;
    case 'win': life('wins'); unlock('retire'); if (game.time < 2400) unlock('retire_fast'); if (game.diff === 'hardcore') unlock('retire_hard'); break;
    case 'death': life('deaths'); unlock('rip'); break;
    case 'start': life('runs'); break;
    case 'boss': unlock('wyrm'); break;
    case 'rewind': life('rewinds'); break;
    case 'bridge': unlock('bridge'); break;
    case 'tallSupport': unlock('cathedral'); break;
    case 'obsidian': unlock('obsidian'); break;
    case 'cart': unlock('scavenger'); break;
    case 'crystal': unlock('crystal'); break;
  }
  checkAchievements();
}
function checkAchievements(){
  if (!game || !fair() || scene !== 'game') return;
  const d = game.maxDepth;
  if (d > (LIFE.deepest||0)){ LIFE.deepest = d; lifeDirty = true; }
  if (d >= 25) unlock('depth_25'); if (d >= 100) unlock('depth_100'); if (d >= 175) unlock('depth_175'); if (d >= 240) unlock('depth_240');
  if (game.money >= 1000) unlock('rich_1k'); if (game.money >= 10000) unlock('rich_10k');
  if (game.pick >= PICKS.length-1) unlock('plasma');
  if (game.jetLv > 0) unlock('rocket');
  if (!game.over && P.hp > 0 && P.hp < 10) unlock('close_call');
  if (game.bagLv >= BAGS.length-1 && bagCount() >= bagCap()) unlock('packed');
  for (const a of ACHIEVEMENTS){ if (a[4]){ const [cur, max] = a[4](); if (cur >= max) unlock(a[0]); } }
}
function stepAchievements(dt){
  achCheckT -= dt; if (achCheckT <= 0){ achCheckT = .5; checkAchievements(); }
  if (fair()){ LIFE.playTime = (LIFE.playTime||0) + dt; lifeDirty = true; }
  lifeSaveT -= dt; if (lifeSaveT <= 0){ lifeSaveT = 10; saveLife(); }
}

// ---------- icons (shared by toasts and the achievements screen) ----------
const ACH_ICON_CACHE = {};
function achIcon(kind){
  if (ACH_ICON_CACHE[kind]) return ACH_ICON_CACHE[kind];
  const [c, x] = mkCanvas(16, 16);
  const P = (col, X, Y, w=1, h=1) => { x.fillStyle = col; x.fillRect(X, Y, w, h); };
  const [type, arg] = kind.split(':');
  if (type === 'ore'){ x.drawImage(TEX[T.STONE][0], 0, 0); x.drawImage(ORE_TEX[+arg][0], 0, 0); }
  else if (type === 'icon') x.drawImage(ICON[arg], 0, 0);
  else if (type === 'enemy'){ const s = ESPR[arg]; const img = (Array.isArray(s) ? s[0] : s).r; const k = Math.min(1, 16/img.width, 16/img.height); x.drawImage(img, (16 - img.width*k)/2, (16 - img.height*k)/2, img.width*k, img.height*k); }
  else if (type === 'chest') x.drawImage(PROP.chest, 0, 0);
  else if (type === 'pick') x.drawImage(PICK_SPR[PICKS.length-1], 0, 0, 15, 15);
  else if (type === 'trophy'){ P('#b8871a',4,2,8,6); P('#ffd24a',4,2,7,5); P('#fff6b0',5,3,1,3); P('#b8871a',2,3,2,3); P('#b8871a',12,3,2,3); P('#ffd24a',7,8,2,3); P('#b8871a',5,11,6,2); P('#6b4423',4,13,8,2); }
  else if (type === 'coin'){ P('#8a5a00',4,3,9,11); P('#ffd24a',4,3,8,10); P('#fff6b0',5,4,2,4); P('#b8871a',7,5,2,6); }
  else if (type === 'depth'){ P('#9fd3f5',7,2,2,9); P('#9fd3f5',4,8,8,2); P('#9fd3f5',5,10,6,2); P('#9fd3f5',6,12,4,1); P('#5a8ab0',3,14,10,1); }
  else if (type === 'scroll'){ P('#c9ae72',3,3,10,11); P('#e8d19a',4,3,8,10); P('#8a6a3a',5,5,6,1); P('#8a6a3a',5,7,6,1); P('#8a6a3a',5,9,4,1); P('#c0392b',9,11,3,3); }
  else if (type === 'jet'){ P('#8a8a96',4,3,8,10); P('#c8c8d4',4,3,2,10); P('#3a3a42',5,13,2,1); P('#3a3a42',9,13,2,1); P('#ff9a2a',5,14,2,2); P('#ff9a2a',9,14,2,2); }
  else if (type === 'heart'){ P('#e0533d',3,4,4,3); P('#e0533d',9,4,4,3); P('#e0533d',2,6,12,3); P('#e0533d',4,9,8,2); P('#e0533d',6,11,4,2); P('#ff9a8a',4,5,2,1); }
  else if (type === 'moon'){ P('#f4f1dc',5,2,6,12); P('#f4f1dc',3,4,4,8); P('#0e0b14',8,3,5,9); P('#cfcab0',5,6,1,1); }
  else if (type === 'bag'){ P('#6b4423',3,5,10,9); P('#8a5a30',3,5,10,2); P('#4a2a12',6,2,4,3); P('#ffd24a',7,8,2,2); }
  else if (type === 'boss'){ P('#120a10',1,2,14,12); P('#5a3448',2,3,12,10); P('#74465a',3,4,9,6); P('#d8c090',3,0,2,3); P('#d8c090',11,0,2,3); P('#ffd24a',4,6,2,2); P('#ffd24a',10,6,2,2); P('#1a0608',5,10,6,2); P('#ff8a2a',6,10,4,1); }
  else if (type === 'skull'){ P('#e8e4dc',4,2,8,8); P('#e8e4dc',5,10,6,3); P('#1a1020',5,5,2,2); P('#1a1020',9,5,2,2); P('#1a1020',7,8,2,1); P('#1a1020',6,11,1,2); P('#1a1020',9,11,1,2); }
  ACH_ICON_CACHE[kind] = c;
  return c;
}

// ---------- toast (canvas, top of screen) ----------
function drawAchToasts(now){
  const a = achToasts[0]; if (!a) return;
  if (a.start === undefined) a.start = now;
  a.t = now - a.start;
  const dur = 4, def = ACH_BY_ID[a.id];
  const w = 170, h = 30, slide = Math.min(1, a.t*4, (dur - a.t)*4);
  const x = (VW - w)/2 | 0, y = (VW >= 470 ? 4 : 70) - (1 - slide)*40 | 0;
  ctx.fillStyle = 'rgba(14,11,20,.95)'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#ffd24a'; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y+h-1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x+w-1, y, 1, h);
  ctx.fillStyle = '#2a2040'; ctx.fillRect(x+5, y+5, 20, 20);
  ctx.drawImage(achIcon(def[3]), x+7, y+7);
  text('ACHIEVEMENT!', x+31, y+12, '#ffd24a', 6);
  text(def[1], x+31, y+24, '#f1e9d2', def[1].length > 16 ? 6 : 8);
  if (a.t > dur) achToasts.shift();
}

// ---------- achievements screen ----------
function openAchievements(back){
  returnTo = back;
  const n = achCount(), tot = ACHIEVEMENTS.length;
  $('achHeader').innerHTML = `<span class="money">${n}</span> / ${tot} unlocked <div class="achbar"><i style="width:${n/tot*100}%"></i></div>`;
  $('achGrid').innerHTML = ACHIEVEMENTS.map(([id, name, desc, icon, prog]) => {
    const got = !!UNLOCKED[id];
    let p = '';
    if (prog && !got){ const [cur, max] = prog(); p = `<div class="achbar small"><i style="width:${Math.min(100, cur/max*100)}%"></i></div><small class="muted">${Math.min(cur,max)}/${max}</small>`; }
    return `<div class="ach ${got ? 'got' : ''}"><img src="${achIcon(icon).toDataURL()}" alt=""><div><b>${got ? name : name}</b><br><small>${desc}</small>${p}</div></div>`;
  }).join('');
  const L = LIFE;
  const rows = [['Careers started', L.runs], ['Careers won', L.wins], ['Deaths', L.deaths], ['Deepest dig', (L.deepest||0) + 'm'], ['Money earned', fmtMoney(L.earned||0)],
    ['Ore mined', L.ores], ['Ore types found', `${Object.keys(L.oreTypes).length}/${ORES.length}`], ['Monsters defeated', L.kills], ['Chests opened', L.chests],
    ['Contracts done', L.contracts], ['Dynamite used', L.dynamite], ['Rewinds used', L.rewinds || 0], ['Time underground', fmtTime(L.playTime||0)]];
  $('lifeStats').innerHTML = rows.map(([k, v]) => `<div class="row"><span class="muted">${k}</span><span>${v}</span></div>`).join('');
  showScreen('achScreen');
}
