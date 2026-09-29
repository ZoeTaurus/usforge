'use strict';
// ============================================================
//  Game constants, tile definitions and upgrade tables
// ============================================================
const TS = 16;                 // tile size in game pixels
const WW = 96, WH = 262;       // world size in tiles
const SURF = 14;               // row index of the grass surface
const GOAL = 25000;            // career win condition
const SAVE_KEY = 'deepfortune.save.v2';
const BEST_KEY = 'deepfortune.best';
const SETTINGS_KEY = 'deepfortune.settings';

const T = { AIR:0, GRASS:1, DIRT:2, STONE:3, GRANITE:4, BASALT:5, BEDROCK:6, GRAVEL:7, RUBBLE:8,
  COAL:9, COPPER:10, IRON:11, SILVER:12, GOLD:13, RUBY:14, DIAMOND:15, MYTHRIL:16, LAVA:17, GAS:18,
  QUARTZ:19, AMETHYST:20, EMERALD:21, SAPPHIRE:22, PLATINUM:23, VOIDSTONE:24, CHEST:25 };
const D = { NONE:0, LADDER:1, SUPPORT:2, TORCH:3, PLATFORM:5, POST:6 };   // deco id = hotbar slot + 1 (slot 4 is dynamite, not a deco)
const DECO_KEY = ['', 'ladder', 'support', 'torch', '', 'platform', 'post'];

const DEF = [];
DEF[T.AIR]     = { name:'Air',     solid:false };
DEF[T.GRASS]   = { name:'Grass',   solid:true, hard:1,  time:.3,  col:[122,82,50] };
DEF[T.DIRT]    = { name:'Dirt',    solid:true, hard:1,  time:.25, col:[122,82,50] };
DEF[T.STONE]   = { name:'Stone',   solid:true, hard:2,  time:.55, col:[118,116,124] };
DEF[T.GRANITE] = { name:'Granite', solid:true, hard:3,  time:.8,  col:[150,100,92] };
DEF[T.BASALT]  = { name:'Basalt',  solid:true, hard:4,  time:1.0, col:[64,64,84] };
DEF[T.BEDROCK] = { name:'Bedrock', solid:true, hard:99, time:99,  col:[36,32,42] };
DEF[T.GRAVEL]  = { name:'Gravel',  solid:true, hard:1,  time:.22, col:[146,136,122] };
DEF[T.RUBBLE]  = { name:'Rubble',  solid:true, hard:1,  time:.3,  col:[104,96,92] };
DEF[T.LAVA]    = { name:'Lava',    solid:false, liquid:true, col:[240,90,20] };
DEF[T.GAS]     = { name:'Gas',     solid:false, col:[120,220,80] };
DEF[T.CHEST]   = { name:'Chest',   solid:true, hard:1,  time:.35, col:[170,120,56], chest:true, glow:[255,200,90] };

//          id         name       $    hard time  main color       highlight        glow
const ORES = [
  [T.COAL,     'Coal',      4,    2, .6,  [36,34,40],    [96,94,108],   null],
  [T.COPPER,   'Copper',    9,    2, .65, [214,120,58],  [255,190,120], null],
  [T.QUARTZ,   'Quartz',    12,   2, .6,  [226,226,236], [255,255,255], null],
  [T.IRON,     'Iron',      18,   2, .75, [200,160,130], [245,225,205], null],
  [T.SILVER,   'Silver',    35,   3, .9,  [196,208,222], [255,255,255], null],
  [T.AMETHYST, 'Amethyst',  55,   3, .9,  [160,86,214],  [226,180,255], [170,100,230]],
  [T.GOLD,     'Gold',      70,   3, .9,  [246,196,40],  [255,246,160], [255,210,80]],
  [T.EMERALD,  'Emerald',   110,  3, 1.0, [40,196,100],  [160,255,190], [60,230,120]],
  [T.RUBY,     'Ruby',      140,  4, 1.1, [214,30,64],   [255,140,160], [255,60,90]],
  [T.SAPPHIRE, 'Sapphire',  200,  4, 1.2, [44,92,232],   [150,190,255], [70,120,255]],
  [T.DIAMOND,  'Diamond',   300,  5, 1.3, [90,230,240],  [230,255,255], [120,255,255]],
  [T.PLATINUM, 'Platinum',  450,  5, 1.4, [214,222,232], [255,255,255], [220,230,255]],
  [T.MYTHRIL,  'Mythril',   650,  5, 1.5, [150,90,255],  [235,210,255], [180,110,255]],
  [T.VOIDSTONE,'Voidstone', 1200, 5, 1.8, [70,20,110],   [255,90,230],  [220,60,255]],
];
for (const [id,name,value,hard,time,c1,c2,glow] of ORES)
  DEF[id] = { name, solid:true, hard, time, value, ore:true, c1, c2, col:c1, glow };

const LAYER_NAMES = { [T.DIRT]:'The Topsoil', [T.STONE]:'Stone Layer', [T.GRANITE]:'Granite Depths', [T.BASALT]:'Basalt Abyss' };

const PICKS = [
  { name:'Iron Pick',     hard:2, speed:1.0, cost:0,    head:[150,156,166] },
  { name:'Steel Pick',    hard:3, speed:1.4, cost:250,  head:[200,214,230] },
  { name:'Titanium Pick', hard:4, speed:1.9, cost:900,  head:[232,224,255] },
  { name:'Diamond Pick',  hard:5, speed:2.6, cost:3000, head:[110,240,255] },
  { name:'Plasma Drill',  hard:5, speed:3.8, cost:8000, head:[255,80,216] },
];
const BAGS  = [ {cap:10,cost:0}, {cap:20,cost:150}, {cap:35,cost:600}, {cap:60,cost:2000}, {cap:100,cost:6000} ];
const LAMPS = [ {r:4.5,cost:0}, {r:6,cost:120}, {r:8,cost:500}, {r:11,cost:1600} ];
const ARMOR = [ {hp:100,cost:0}, {hp:130,cost:250}, {hp:170,cost:900}, {hp:230,cost:3000} ];
const SUPPLIES = [
  { key:'ladder',  name:'Ladders',  cost:1,  pack:10, desc:'Climb back out' },
  { key:'platform', name:'Platforms', cost:1, pack:10, desc:'Bridges reach 5 tiles from a wall or post (5)' },
  { key:'post',     name:'Bridge posts', cost:2, pack:5, desc:'Stack from the floor to hold up long bridges (6)' },
  { key:'support', name:'Supports', cost:4,  pack:5,  desc:'Stop cave-ins (3 tile radius)' },
  { key:'torch',   name:'Torches',  cost:2,  pack:5,  desc:'Light tunnels. Monsters avoid the light' },
  { key:'medkit',  name:'Medkit',   cost:30, pack:1,  desc:'Heals 60 HP (H)' },
  { key:'dynamite', name:'Dynamite', cost:25, pack:3, desc:'Blasts a big hole (4). RUN!' },
  { key:'beacon',   name:'Recall beacon', cost:60, pack:1, desc:'Warps you to the surface (R)' },
];
const HARD_NAMES = ['', 'dirt', 'stone', 'granite', 'basalt', 'anything'];

// minimap colours per tile
const MINI_COL = [];
MINI_COL[T.AIR]=[30,24,36]; MINI_COL[T.GRASS]=[80,170,60]; MINI_COL[T.DIRT]=[110,74,44]; MINI_COL[T.STONE]=[96,94,102];
MINI_COL[T.GRANITE]=[124,84,78]; MINI_COL[T.BASALT]=[54,54,72]; MINI_COL[T.BEDROCK]=[20,18,24]; MINI_COL[T.GRAVEL]=[130,122,110];
MINI_COL[T.RUBBLE]=[90,84,80]; MINI_COL[T.LAVA]=[255,110,20]; MINI_COL[T.GAS]=[110,210,70]; MINI_COL[T.CHEST]=[255,200,80];
for (const [id] of ORES) MINI_COL[id] = DEF[id].c1.map(v=>Math.min(255, v*1.15));

// hotbar items that can be placed (keys 1-4)
const ITEMS = ['ladder', 'support', 'torch', 'dynamite', 'platform', 'post'];

const BOOTS = [
  { name:'Work boots',    jump:205, fall:1,   cost:0 },
  { name:'Spring boots',  jump:232, fall:.6,  cost:350 },
  { name:'Feather boots', jump:258, fall:.25, cost:1400 },
];
const JETPACKS = [
  { name:'No jetpack',    fuel:0,   cost:0 },
  { name:'Jetpack',       fuel:1.3, cost:1200 },
  { name:'Turbo jetpack', fuel:3,   cost:4500 },
];
