'use strict';
// ============================================================
//  Game data: rods, fish, bosses, shop
// ============================================================

// Rods are only ever obtained by beating the boss of the previous tier.
const RODS = [
  { name: 'TWIG ROD', color: '#9b6a3c', tip: '#e8d5b0', reel: 1.0, line: 1.0, luck: 0, dmg: 1, range: 78, special: 'NONE. IT IS A STICK.' },
  { name: 'BAMBOO ROD', color: '#cdb85a', tip: '#6e8b3d', reel: 1.2, line: 1.35, luck: 0.1, dmg: 2, range: 100, special: 'LONG HOOK THROW' },
  { name: 'CORAL ROD', color: '#ff7a7a', tip: '#ffd0c8', reel: 1.35, line: 1.7, luck: 0.2, dmg: 3, range: 104, special: 'HOOK HITS RESTORE AIR' },
  { name: 'GLOWLIGHT ROD', color: '#9b7bff', tip: '#e6fffb', reel: 1.55, line: 2.1, luck: 0.3, dmg: 4, range: 112, special: 'HOMING HOOK + LIGHT' },
  { name: 'SHARKTOOTH ROD', color: '#cfd8e3', tip: '#ffffff', reel: 1.75, line: 2.5, luck: 0.4, dmg: 5, range: 120, special: 'YOUR DASH BITES FOES' },
  { name: "KRAKEN'S TRIDENT", color: '#ffcf4a', tip: '#7ff0ff', reel: 2.0, line: 3.0, luck: 0.55, dmg: 6, range: 130, special: 'THROWS 3 HOOKS AT ONCE' },
];

// shape: fish | eel | puffer | squid | boot | chest | sword | shark | angler
// tier = minimum rod tier for it to appear, w = spawn weight, str = fight strength
const FISH = [
  { id: 'minnow', name: 'SANDY MINNOW', shape: 'fish', len: 8, hr: 0.42, body: '#c9b98f', top: '#8f8163', belly: '#f1ead6', fin: '#b3a377', cm: [4, 9], value: 2, w: 30, tier: 0, str: 0.5, hint: 'EVERYWHERE. ALWAYS HUNGRY.' },
  { id: 'perch', name: 'SUNNY PERCH', shape: 'fish', len: 11, hr: 0.52, body: '#f4b63c', top: '#c07a1e', belly: '#fbe7a2', fin: '#e0662c', pattern: 'vstripes', pc: '#a86a1a', cm: [12, 24], value: 5, w: 26, tier: 0, str: 0.7, hint: 'LOVES WARM SHALLOW WATER.' },
  { id: 'boot', name: 'OLD BOOT', shape: 'boot', len: 9, cm: [25, 30], value: 1, w: 7, tier: 0, str: 0.4, junk: true, outline: '#1e120a', hint: 'SOMEONE LOST THEIR SHOE...' },
  { id: 'tang', name: 'BLUE TANG', shape: 'fish', len: 11, hr: 0.62, body: '#3d7fe0', top: '#23428f', belly: '#6fb0ff', fin: '#f5d142', pattern: 'hstripe', pc: '#1a2e66', cm: [15, 28], value: 9, w: 16, tier: 0, str: 0.8, hint: 'JUST KEEPS SWIMMING.' },
  { id: 'clown', name: 'CLOWNFISH', shape: 'fish', len: 10, hr: 0.52, body: '#ff7a1f', top: '#d9580f', belly: '#ffa04d', fin: '#2a1a1a', pattern: 'vstripes', pc: '#ffffff', cm: [8, 14], value: 12, w: 14, tier: 1, str: 0.8, hint: 'NEEDS A BAMBOO ROD OR BETTER.' },
  { id: 'puffer', name: 'PUFFERFISH', shape: 'puffer', len: 11, body: '#e8c65a', top: '#a3843a', belly: '#fff3c4', fin: '#b89536', pc: '#6b5320', cm: [10, 30], value: 15, w: 11, tier: 1, str: 0.9, hint: 'DO NOT HUG. BAMBOO ROD+.' },
  { id: 'snapper', name: 'RED SNAPPER', shape: 'fish', len: 14, hr: 0.45, body: '#e0473a', top: '#a52a25', belly: '#ff9d86', fin: '#c0302a', cm: [30, 60], value: 18, w: 12, tier: 1, str: 1.1, hint: 'FEISTY. BAMBOO ROD+.' },
  { id: 'moon', name: 'MOONFISH', shape: 'fish', len: 12, hr: 0.78, body: '#c9c5e8', top: '#8f89c2', belly: '#f1efff', fin: '#e8e3ff', cm: [20, 40], value: 30, w: 10, tier: 0, night: true, str: 1.0, hint: 'ONLY BITES AT NIGHT.' },
  { id: 'mackerel', name: 'MACKEREL', shape: 'fish', len: 15, hr: 0.32, body: '#5fa39a', top: '#2e5f6d', belly: '#e3f1ee', fin: '#3f7b7a', pattern: 'waves', pc: '#1d3f4a', cm: [30, 50], value: 20, w: 12, tier: 2, str: 1.2, hint: 'FAST SWIMMER. CORAL ROD+.' },
  { id: 'trout', name: 'RAINBOW TROUT', shape: 'fish', len: 15, hr: 0.36, body: '#9cb86a', top: '#5d7a3a', belly: '#f3e9d0', fin: '#7c9a4f', pattern: 'hstripe', pc: '#ff7aa8', cm: [35, 70], value: 35, w: 8, tier: 2, str: 1.3, hint: 'SHIMMERS. CORAL ROD+.' },
  { id: 'squid', name: 'GLOW SQUID', shape: 'squid', len: 12, body: '#5de0d0', top: '#2aa89c', belly: '#b8fff5', fin: '#7ffff0', pc: '#e6fffb', cm: [20, 45], value: 45, w: 8, tier: 2, night: true, str: 1.4, glowy: true, hint: 'NIGHT ONLY. CORAL ROD+.' },
  { id: 'chest', name: 'TREASURE CHEST', shape: 'chest', len: 11, cm: [40, 50], value: 150, w: 2, tier: 2, str: 1.5, junk: true, rare: true, outline: '#2a1608', hint: 'ARR! VERY RARE. CORAL ROD+.' },
  { id: 'koi', name: 'GOLDEN KOI', shape: 'fish', len: 14, hr: 0.42, body: '#ffd24a', top: '#e8a317', belly: '#fff4c4', fin: '#fff0d0', pattern: 'spots', pc: '#ffffff', cm: [40, 80], value: 80, w: 4, tier: 3, str: 1.6, rare: true, hint: 'LUCKY! GLOWLIGHT ROD+.' },
  { id: 'ghost', name: 'GHOST FISH', shape: 'fish', len: 14, hr: 0.46, body: '#dff6ff', top: '#a9d8ec', belly: '#ffffff', fin: '#c9f0ff', cm: [30, 60], value: 120, w: 4, tier: 3, night: true, str: 1.8, rare: true, ghost: true, hint: 'BOO. NIGHT, GLOWLIGHT ROD+.' },
  { id: 'eel', name: 'CRYSTAL EEL', shape: 'eel', len: 20, hr: 0.18, body: '#8ef0ff', top: '#4fb6d6', belly: '#e6fdff', fin: '#c6f7ff', cm: [80, 150], value: 250, w: 3, tier: 4, str: 2.2, rare: true, glowy: true, hint: 'LEGENDARY. SHARKTOOTH ROD+.' },
];
FISH.forEach(f => { f.spot = 'pier'; });

// fish from the faraway spots you can row to
FISH.push(
  // Shipwreck Cove
  { id: 'pirateperch', spot: 'wreck', name: 'PIRATE PERCH', shape: 'fish', len: 11, hr: 0.5, body: '#8a6a9a', top: '#4a3a5a', belly: '#d8c8e0', fin: '#2a1a2a', pattern: 'vstripes', pc: '#3a2a3a', cm: [12, 26], value: 14, w: 26, tier: 0, str: 0.8, hint: 'ARR. LURKS IN THE OLD WRECK.' },
  { id: 'barnacle', spot: 'wreck', name: 'BARNACLE BASS', shape: 'fish', len: 14, hr: 0.5, body: '#6a7a5a', top: '#3a4a2a', belly: '#c8c8a0', fin: '#4a5a3a', pattern: 'spots', pc: '#e8e0c8', cm: [30, 60], value: 22, w: 18, tier: 0, str: 1.1, hint: 'COVERED IN CRUSTY BARNACLES.' },
  { id: 'anchor', spot: 'wreck', name: 'RUSTY ANCHOR', shape: 'anchor', len: 9, cm: [60, 80], value: 6, w: 6, tier: 0, str: 1.0, junk: true, outline: '#1a1410', hint: 'HEAVY. VERY HEAVY.' },
  { id: 'spookfin', spot: 'wreck', name: 'SPOOKFIN', shape: 'fish', len: 13, hr: 0.5, body: '#b8f0d8', top: '#78c0a8', belly: '#e8fff4', fin: '#a0ffe0', cm: [25, 50], value: 60, w: 6, tier: 0, night: true, str: 1.5, rare: true, ghost: true, glowy: true, hint: 'A GHOST FISH. NIGHT ONLY.' },
  { id: 'doubloon', spot: 'wreck', name: 'GOLD DOUBLOON', shape: 'coin', len: 7, cm: [5, 6], value: 200, w: 2, tier: 0, str: 1.4, junk: true, rare: true, outline: '#5a3a08', hint: 'PIRATE GOLD! SUPER RARE.' },
  // Frostbite Lake
  { id: 'char', spot: 'ice', name: 'ARCTIC CHAR', shape: 'fish', len: 13, hr: 0.4, body: '#e07a6a', top: '#5a6a8a', belly: '#ffe0d0', fin: '#c05a4a', pattern: 'spots', pc: '#ffffff', cm: [30, 60], value: 16, w: 26, tier: 0, str: 0.9, hint: 'LOVES ICY WATER.' },
  { id: 'icecod', spot: 'ice', name: 'ICE COD', shape: 'fish', len: 14, hr: 0.42, body: '#a8c0d0', top: '#6a8098', belly: '#eef6ff', fin: '#8aa0b8', cm: [35, 70], value: 20, w: 20, tier: 0, str: 1.0, hint: 'CHILL. VERY CHILL.' },
  { id: 'snowcrab', spot: 'ice', name: 'SNOW CRAB', shape: 'crab', len: 12, body: '#e8a07a', top: '#c07050', belly: '#ffe0c8', fin: '#a05030', cm: [10, 25], value: 30, w: 12, tier: 0, str: 1.2, hint: 'SNIP SNAP.' },
  { id: 'pike', spot: 'ice', name: 'FROST PIKE', shape: 'eel', len: 18, hr: 0.2, body: '#8ad0e8', top: '#4a90b0', belly: '#e8f8ff', fin: '#b8e8ff', cm: [60, 110], value: 45, w: 8, tier: 0, str: 1.6, hint: 'LONG AND SNAPPY.' },
  { id: 'aurora', spot: 'ice', name: 'AURORA TROUT', shape: 'fish', len: 15, hr: 0.36, body: '#8a7aff', top: '#3a8aa0', belly: '#e0ffe8', fin: '#a0ffc8', pattern: 'hstripe', pc: '#ff8ae0', cm: [40, 75], value: 110, w: 4, tier: 0, night: true, str: 1.8, rare: true, glowy: true, hint: 'GLOWS LIKE THE NORTHERN LIGHTS.' },
  // Magma Lagoon
  { id: 'ember', spot: 'volcano', name: 'EMBER GUPPY', shape: 'fish', len: 8, hr: 0.5, body: '#ff7a3a', top: '#c0401a', belly: '#ffd08a', fin: '#ffb03a', cm: [4, 10], value: 12, w: 28, tier: 0, str: 0.7, hint: 'WARM TO THE TOUCH.' },
  { id: 'cinder', spot: 'volcano', name: 'CINDER SNAPPER', shape: 'fish', len: 14, hr: 0.45, body: '#5a4a4a', top: '#2a2020', belly: '#8a6a5a', fin: '#ff5a1a', pattern: 'hstripe', pc: '#ff7a2a', cm: [30, 60], value: 28, w: 18, tier: 0, str: 1.2, hint: 'SMOKY FLAVOUR.' },
  { id: 'magmapuff', spot: 'volcano', name: 'MAGMA PUFFER', shape: 'puffer', len: 11, body: '#d83a2a', top: '#8a1a1a', belly: '#ffb07a', fin: '#ffd23a', pc: '#ffd23a', cm: [15, 35], value: 40, w: 12, tier: 0, str: 1.3, hint: 'PUFFS UP. GETS HOT.' },
  { id: 'lobster', spot: 'volcano', name: 'LAVA LOBSTER', shape: 'crab', len: 13, body: '#ff4a2a', top: '#a81a10', belly: '#ffc08a', fin: '#7a1008', cm: [20, 45], value: 55, w: 8, tier: 0, str: 1.5, hint: 'ALREADY COOKED?' },
  { id: 'phoenix', spot: 'volcano', name: 'PHOENIX KOI', shape: 'fish', len: 15, hr: 0.42, body: '#ffb030', top: '#ff4a1a', belly: '#fff0a0', fin: '#ff7a2a', pattern: 'spots', pc: '#fff6c8', cm: [50, 90], value: 180, w: 3, tier: 0, str: 2.0, rare: true, glowy: true, hint: 'REBORN FROM THE FLAMES.' },
);
const FISH_BY_ID = Object.fromEntries(FISH.map(f => [f.id, f]));

const SPOTS = [
  { id: 'pier', name: 'SUNNY PIER', desc: 'HOME SWEET HOME.' },
  { id: 'wreck', name: 'SHIPWRECK COVE', desc: 'SPOOKY, FOGGY WATER. A GHOST WHALE HAUNTS IT.', need: 'boat', boss: 5 },
  { id: 'ice', name: 'FROSTBITE LAKE', desc: 'BRRR! A GIANT CRAB RULES THE ICE.', need: 'whale', boss: 6 },
  { id: 'volcano', name: 'MAGMA LAGOON', desc: 'HOT HOT HOT. SOMETHING SLITHERS IN THE LAVA.', need: 'crab', boss: 7 },
];
const SPOT_BY_ID = Object.fromEntries(SPOTS.map(s => [s.id, s]));

// charms: dropped by the faraway beasts, always active
const CHARMS = [
  { name: 'GHOST LANTERN', desc: '+1 HEART IN EVERY FIGHT', color: '#9ad8d0' },
  { name: 'FROST CHARM', desc: '+50% AIR IN EVERY FIGHT', color: '#bfefff' },
  { name: 'MAGMA HOOK', desc: '+2 HOOK DAMAGE', color: '#ff7a3a' },
];

const HATS = [
  { id: 'straw', name: 'STRAW HAT', hat: '#f2d27a', hatS: '#d6b057', hatD: '#a88434', band: '#c0392b', cost: 0 },
  { id: 'sunset', name: 'SUNSET HAT', hat: '#ff8a5a', hatS: '#d8603a', hatD: '#a0402a', band: '#ffe14a', cost: 40 },
  { id: 'ocean', name: 'OCEAN HAT', hat: '#5aa8e8', hatS: '#3a80c0', hatD: '#2a5a90', band: '#ffffff', cost: 40 },
  { id: 'bubblegum', name: 'BUBBLEGUM HAT', hat: '#ffa0d0', hatS: '#e078b0', hatD: '#b05088', band: '#7ae0ff', cost: 40 },
  { id: 'pirate', name: 'PIRATE HAT', hat: '#3a3040', hatS: '#2a2030', hatD: '#1a1020', band: '#f0e0c0', cost: 80 },
  { id: 'gold', name: 'GOLDEN HAT', hat: '#ffe14a', hatS: '#f0b020', hatD: '#b07a10', band: '#ff4a6a', cost: 250 },
];
const BOBBERS = [
  { id: 'red', name: 'RED BOBBER', c: '#e8433a', cost: 0 },
  { id: 'lime', name: 'LIME BOBBER', c: '#7ae05a', cost: 20 },
  { id: 'violet', name: 'VIOLET BOBBER', c: '#a07aff', cost: 20 },
  { id: 'gold', name: 'GOLD BOBBER', c: '#ffd24a', cost: 60 },
];
const DECOR = [
  { id: 'duck', name: 'RUBBER DUCK', cost: 25 },
  { id: 'plants', name: 'KELP GARDEN', cost: 40 },
  { id: 'castle', name: 'SAND CASTLE', cost: 60 },
  { id: 'diver', name: 'DIVER HELMET', cost: 70 },
  { id: 'treasure', name: 'TREASURE PILE', cost: 90 },
];
const UPGRADES = [
  { id: 'reel', name: 'FASTER REEL', desc: '+15% REEL SPEED PER LEVEL.', base: 50 },
  { id: 'line', name: 'STRONGER LINE', desc: '+15% LINE STRENGTH PER LEVEL.', base: 50 },
  { id: 'cooler', name: 'BIGGER COOLER', desc: '+6 FISH OF COOLER SPACE.', base: 40 },
];
const BOAT_COST = 200;
const upgradeCost = (u, lvl) => u.base * (lvl + 1) * (lvl + 1);
const coolerCap = s => 8 + s.up.cooler * 6;

const BOSSES = [
  { id: 'gnarly', name: 'OLD GNARLY', title: 'THE BASS THAT ATE A BOAT', spot: 'pier', hp: 12, shape: 'fish', len: 58, hr: 0.52, body: '#6d8f3a', top: '#3e5a22', belly: '#d8d99a', fin: '#556f2a', pattern: 'hstripe', pc: '#2e4418', scars: true, angry: true, shadowLen: 34 },
  { id: 'pointy', spot: 'pier', name: 'CAPTAIN POINTY', title: 'SWORDFISH OF THE SEVEN SEAS', hp: 30, shape: 'sword', len: 70, hr: 0.28, body: '#3f6fb8', top: '#1f3a73', belly: '#d6e6f5', fin: '#274a8c', angry: true, shadowLen: 40 },
  { id: 'lanterna', spot: 'pier', name: 'LANTERNA', title: 'LIGHT OF THE ABYSS', hp: 48, shape: 'angler', len: 54, body: '#4a3560', top: '#2b1d3a', belly: '#6d5285', fin: '#3a2850', shadowLen: 32 },
  { id: 'chomp', spot: 'pier', name: 'BIG CHOMP', title: 'KING OF THE REEF', hp: 72, shape: 'shark', len: 80, hr: 0.3, body: '#7d8ea3', top: '#55657a', belly: '#e8eef2', fin: '#65758a', angry: true, shadowLen: 44 },
  { id: 'kraken', spot: 'pier', name: 'THE KRAKEN', title: 'TERROR OF THE DEEP', hp: 110, shape: 'squid', len: 44, body: '#a3375a', top: '#6b1f3d', belly: '#d9577e', fin: '#6b1f3d', shadowLen: 46 },
  // faraway beasts: they drop charms instead of rods
  { id: 'whale', spot: 'wreck', name: 'BLUBBERBEARD', title: 'THE GHOST PIRATE WHALE', hp: 30, shape: 'whale', len: 86, hr: 0.36, body: '#9ad8d0', top: '#5a9a98', belly: '#e8fff8', fin: '#6ab0a8', shadowLen: 52, charm: 0 },
  { id: 'crab', spot: 'ice', name: 'KING PINCH', title: 'EMPEROR OF THE FROZEN DEEP', hp: 40, shape: 'crab', len: 48, body: '#e0584a', top: '#a0302a', belly: '#ffc0a8', fin: '#7a1a18', shadowLen: 30, charm: 1 },
  { id: 'serpent', spot: 'volcano', name: 'SCORCHSCALE', title: 'THE MAGMA SERPENT', hp: 50, shape: 'eel', len: 50, hr: 0.16, body: '#c0301a', top: '#6a1008', belly: '#ffb03a', fin: '#ff7a1a', shadowLen: 50, charm: 2 },
];
const PIER_BOSSES = 5;

const SHOP_BAIT = [
  { id: 'shrimp', name: 'SHRIMP BAIT X5', desc: 'FISH BITE TWICE AS FAST.', cost: 20 },
  { id: 'glow', name: 'GLOW BAIT X5', desc: 'RARE FISH AND HUGE SHADOWS LOVE IT.', cost: 50 },
  { id: 'airtank', name: 'AIR TANK', desc: '+50% AIR IN YOUR NEXT BIG FIGHT.', cost: 40 },
  { id: 'snack', name: 'FISH TACO', desc: '+1 HEART IN YOUR NEXT BIG FIGHT.', cost: 35 },
];

const BAITS = [
  { id: 'worm', name: 'WORM', color: '#e0788a' },
  { id: 'shrimp', name: 'SHRIMP', color: '#ff9a5a' },
  { id: 'glow', name: 'GLOW BAIT', color: '#7ffff0' },
];
