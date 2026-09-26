// Shared namespace + all tunable game data. Everything balance-related lives here.
window.VAX = {};
(() => {
  const V = window.VAX;
  Object.assign(V, { W: 256, H: 160, TOP: 12, BOT: 148, TAU: Math.PI * 2 });
  V.rnd = (a, b) => a + Math.random() * (b - a);
  V.clamp = (v, a, b) => Math.min(Math.max(v, a), b);

  // Difficulty presets.
  //  hp: starting immunity · enemyHp/enemySpd/count: pathogen toughness, speed and numbers · ramp: HP growth per wave
  //  fire: enemy fire interval (lower = more shooting) · toxinSpd: projectile speed · spawnGap: seconds between packs
  //  pack: pathogens per pack [min, max] · both: chance a pack also comes from the other side · elite: base elite chance
  //  bossHp: boss HP multiplier · bossFloor: bosses always have at least (your sustained DPS × this many seconds) of HP
  //  enrage: seconds before a boss enrages · inv: invulnerability after a hit · dna: DNA reward multiplier
  V.DIFFICULTY = {
    chill:     { hp: 8, enemyHp: 0.84, enemySpd: 0.853, count: 0.689, fire: 1.242, toxinSpd: 0.819, drop: .15, ramp: .06, spawnGap: 1.7, pack: [1, 2], both: .05, elite: 0.012, bossHp: 1.21, bossFloor: 9, enrage: 70, inv: 1.8, dna: .6, smart: 0.2, bossMinT: 20 },
    normal:    { hp: 7, enemyHp: 1.176, enemySpd: 0.988, count: 0.901, fire: 1.03, toxinSpd: 0.945, drop: .12, ramp: .09, spawnGap: 1.45, pack: [1, 3], both: .1, elite: 0.03, bossHp: 1.595, bossFloor: 11, enrage: 60, inv: 1.5, dna: 1, smart: 0.36, bossMinT: 30 },
    hard:      { hp: 4, enemyHp: 2.016, enemySpd: 1.269, count: 1.537, fire: 0.699, toxinSpd: 1.239, drop: .085, ramp: .14, spawnGap: 1.0, pack: [2, 5], both: .3, elite: 0.12, bossHp: 2.64, bossFloor: 18, enrage: 38, inv: 1.1, dna: 1.6, smart: 0.8, bossMinT: 40 },
    nightmare: { hp: 4, enemyHp: 2.352, enemySpd: 1.352, count: 1.643, fire: 0.607, toxinSpd: 1.344, drop: .08, ramp: .17, spawnGap: .9, pack: [3, 5], both: .4, elite: 0.18, bossHp: 2.86, bossFloor: 18, enrage: 32, inv: 1.0, dna: 2.4, smart: 0.93, bossMinT: 46 },
  };
  V.DIFF_ORDER = ['chill', 'normal', 'hard', 'nightmare'];

  // Player power tuning — keeps upgrades feeling good without multiplying into absurd damage.
  V.TUNE = {
    rapid: .55,      // Interferon fire-interval factor (was .42)
    il2: 1.5,        // Interleukin-2 damage multiplier (was 2)
    spreadSide: .45, // Adjuvant side shots deal this fraction of damage
    laneDmg: .7,     // each extra Bivalent lane deals this fraction of damage
    bossPowerAvg: 2, // bosses assume you'll have some power-ups up: floor uses sustained DPS × this
  };
  // boss HP floor multipliers for bosses with defensive phases (shells, shields, teleports)
  V.FLOOR_MUL = { tb: .8, measles: 1.15, phantom: 1, rabies: .85, mycelia: .9, plague: .8, quorum: .75, shifter: .85 };
  // Smart AI: which pathogens flank (spread around you) and how well each type dodges incoming antibodies (0 = never)
  V.FLANKERS = new Set(['virus', 'mini', 'hiv', 'prion', 'giardia', 'trypan', 'salmo']);
  V.DODGE = { virus: .5, hiv: .7, salmo: .4, noro: .6, bug: .5, trypan: 1.25, prion: .3, tetanus: .6, corona: .5, drone: .35, shifter: 1, klebs: .2 };
  // Mutants: rare, overpowered variants of every virus and bacterium, each with its own attack pattern
  V.MUTANT = {
    from: 4, base: .012, perWave: .003, diffMul: { chill: .25, normal: .55, hard: 1.25, nightmare: 1.5 },
    hp: 6, spd: 1.15, score: 6, atp: 6,
    // [pattern, shots, speed, interval]
    pattern: {
      virus: ['ring', 6, 48, 2.4], hiv: ['ring', 6, 50, 2.2], noro: ['ring', 8, 44, 2.6], corona: ['ring', 8, 46, 2.4], adeno: ['fan', 5, 56, 1.6],
      bact: ['fan', 3, 54, 2], mini: ['aim', 1, 60, 1.6], salmo: ['fan', 3, 60, 1.8], bug: ['fan', 5, 56, 1.8], pseudo: ['ring', 8, 42, 2.8],
      strep: ['aim', 1, 58, 2.6], tetanus: ['fan', 3, 150, 2.8], klebs: ['fan', 3, 56, 2], borrelia: ['trail', 1, 0, .25],
      prion: ['aim', 1, 64, .9], plasmo: ['ring', 6, 50, 2.4], candida: ['ring', 8, 40, 2.8], giardia: ['aim', 1, 58, 1.8], trypan: ['fan', 3, 62, 1.8],
    },
  };
  // Elites: tougher, faster, glowing variants that also shoot at you
  V.ELITE = { hp: 3, spd: 1.12, score: 3, atp: 3, fire: [2, 3.2], perWave: .008 };

  // Pathogens. hp/spd are base values before difficulty and wave scaling; `grow` is speed gained per wave.
  V.ENEMIES = {
    virus:   { r: 4,   hp: 2,  spd: 28, grow: 1,   score: 10 },
    bact:    { r: 5,   hp: 4,  spd: 16, grow: .5,  score: 15 },
    mini:    { r: 3,   hp: 1,  spd: 26, grow: .5,  score: 5 },
    bug:     { r: 6,   hp: 5,  spd: 22, grow: 0,   score: 25, init: e => { e.fire = V.rnd(1.5, 2.8); } },
    prion:   { r: 2.5, hp: 1,  spd: 44, grow: .8,  score: 8,  init: e => { e.turn = 0; } },
    salmo:   { r: 4,   hp: 3,  spd: 20, grow: 0,   score: 20, init: e => { e.cd = V.rnd(1.5, 3); e.state = 'move'; e.st = 0; } },
    hiv:     { r: 4,   hp: 3,  spd: 24, grow: .4,  score: 20 },
    candida: { r: 6,   hp: 8,  spd: 9,  grow: 0,   score: 30, init: e => { e.brood = V.rnd(2, 3.5); } },
    spore:   { r: 2,   hp: 1,  spd: 20, grow: .4,  score: 2,  init: e => { e.life = 8; } },
    plasmo:  { r: 3,   hp: 2,  spd: 46, grow: .5,  score: 15, init: e => { e.state = 'hidden'; e.hideT = 9; } },
    noro:    { r: 3.5, hp: 2,  spd: 16, grow: .3,  score: 18, init: e => { e.state = 'move'; e.cd = V.rnd(1.5, 2.5); e.st = 0; } },
    strep:   { r: 3,   hp: 1.5, spd: 26, grow: .5, score: 6 },
    pseudo:  { r: 5,   hp: 3,  spd: 13, grow: .3,  score: 25, init: e => { e.shell = e.shellMax = 5; } },
    boss:    { r: 11,  hp: 60, spd: 13, grow: 0,   score: 500, boss: true, bossHp: 12, init: e => { e.fire = 2.8; e.brood = 5; } },
    plague:  { r: 7,   hp: 80, spd: 30, grow: 0,   score: 800, boss: true, bossHp: 10,
               init: e => { e.fire = 2.4; e.cd = 4.5; e.state = 'move'; e.st = 0; e.split = [.66, .33]; } },
    tb:      { r: 7,   hp: 95, spd: 16, grow: 0,   score: 900, boss: true, bossHp: 12,
               init: e => { e.shell = e.shellMax = 26; e.expT = 0; e.fire = 2; e.aim = 1.2; e.brood = 7; e.calm = 0; } },
    rabies:  { r: 6,   hp: 100, spd: 78, grow: 0,  score: 900, boss: true, bossHp: 12,
               init: e => { e.state = 'bounce'; e.cd = 3.5; e.st = 0; e.trail = 0; e.dx = -1; e.dy = .35; e.chain = 0; } },
    phantom: { r: 9,   hp: 125, spd: 20, grow: 0,  score: 1000, boss: true, bossHp: 15,
               init: e => { e.state = 'move'; e.cd = 2.4; e.st = 0; e.fire = 1.6; } },
    decoy:   { r: 7,   hp: 1,  spd: 16, grow: 0,   score: 5,  init: e => { e.life = 9; e.fire = V.rnd(1.2, 2.4); } },
    colossus:{ r: 12,  hp: 90, spd: 12, grow: 0,   score: 900, boss: true, bossHp: 11,
               init: e => { e.stage = 0; e.fire = 2.5; e.split = [.75, .5, .25]; } },
    ebola:   { r: 5,   hp: 85, spd: 38, grow: 0,   score: 1000, boss: true, bossHp: 10,
               init: e => { e.dir = Math.PI; e.pts = []; e.segPts = []; e.state = 'move'; e.cd = 4; e.st = 0; } },
    mycelia: { r: 10,  hp: 150, spd: 10, grow: 0,  score: 1000, boss: true, bossHp: 16,
               init: e => { e.fire = 1.2; e.brood = 3; e.spin = 0; e.spinDir = 1; e.flip = 5; e.bloom = 6; e.aim = 2; } },
    // new bosses
    measles: { r: 9,   hp: 120, spd: 16, grow: 0,  score: 1100, boss: true, bossHp: 14,
               init: e => { e.fire = 1.6; e.pulse = 4; e.spin = 0; e.regrow = 2.4; e.guards = Array.from({ length: 10 }, (_, i) => ({ a: i * Math.PI / 5, hp: 5, alive: true, x: 0, y: 0 })); } },
    botulist:{ r: 7,   hp: 125, spd: 40, grow: 0,  score: 1100, boss: true, bossHp: 15,
               init: e => { e.mine = 1; e.gas = 2.5; e.spit = 1.5; e.wx = 180; e.wy = 80; } },
    hydra:   { r: 10,  hp: 56, spd: 28, grow: 0,   score: 400, boss: true, bossHp: 7,
               init: e => { e.gen = 0; e.fire = 2; e.turn = 0; } },
    // smarter pathogens
    tetanus: { r: 4,   hp: 3,  spd: 26, grow: .3,  score: 25, init: e => { e.state = 'move'; e.cd = V.rnd(1.5, 2.5); e.st = 0; } },
    klebs:   { r: 5,   hp: 6,  spd: 20, grow: .4,  score: 30, init: e => { e.faceA = Math.PI; e.cd = 2; e.state = 'move'; e.st = 0; } },
    corona:  { r: 5,   hp: 5,  spd: 16, grow: .2,  score: 35 },
    trypan:  { r: 3,   hp: 3,  spd: 58, grow: .8,  score: 22 },
    drone:   { r: 3,   hp: 3,  spd: 70, grow: .5,  score: 5 },
    quorum:  { r: 8,   hp: 90, spd: 14, grow: 0,   score: 1100, boss: true, bossHp: 11, init: e => { e.mode = 'ring'; e.modeT = 5; e.brood = .5; e.fire = 2; e.cT = 0; e.cIdx = 0; } },
    shifter: { r: 7,   hp: 105, spd: 36, grow: 0,  score: 1200, boss: true, bossHp: 12, init: e => { e.phase = 0; e.fire = 1.5; e.cd = 3; e.state = 'move'; e.st = 0; e.invT = 0; } },
    // new pathogens
    adeno:   { r: 4,   hp: 4,  spd: 34, grow: .3,  score: 20, init: e => { e.anchored = false; e.fire = V.rnd(1.5, 2.5); } },
    giardia: { r: 4,   hp: 3,  spd: 32, grow: .6,  score: 18, init: e => { e.latched = false; } },
    borrelia:{ r: 3,   hp: 3,  spd: 70, grow: 1,   score: 16 },
  };

  V.GUIDE = [
    ['virus', 'Rhinovirus', 'Fast. Swarms you.', '#b27cf0'],
    ['bact', 'E. coli', 'Tough. Splits in two.', '#cfd84e'],
    ['bug', 'MRSA cluster', 'Keeps distance, spits toxin. Wave 2+.', '#f08a3c'],
    ['plasmo', 'Plasmodium', 'Hides inside a red cell, then pounces. Wave 3+.', '#ff8ad0'],
    ['prion', 'Prion', 'Tiny, twitchy, erratic. Wave 4+.', '#e8c0d0'],
    ['salmo', 'Salmonella', 'Flashes, then charges. Wave 4+.', '#ff9a8a'],
    ['hiv', 'HIV', 'Cloaks — only hittable when solid. Wave 6+.', '#8fb0ff'],
    ['noro', 'Norovirus', 'Teleports — watch for the gold ring. Wave 6+.', '#f0c860'],
    ['candida', 'Candida', 'Slow fungus that sheds spores. Wave 7+.', '#e8dcc0'],
    ['adeno', 'Adenovirus', 'Anchors to the vessel wall and fires volleys. Wave 3+.', '#80e0c0'],
    ['giardia', 'Giardia', 'Latches on, slows you, drains ATP. Dash to shake it off. Wave 7+.', '#c8e080'],
    ['strepHead', 'Strep chain', 'A slithering chain; each link is a new head. Wave 8+.', '#6ad89a'],
    ['borrelia', 'Borrelia', 'A corkscrew that sweeps across the vessel. Wave 10+.', '#ffc890'],
    ['tetanus', 'Tetanus sniper', 'Paints you with a laser, then fires a fast bolt where you’re heading. Wave 8+.', '#c8d0e8'],
    ['klebs', 'Klebsiella', 'Its capsule blocks shots from the front. Flank it or pierce it. Wave 9+.', '#ff9080'],
    ['trypan', 'Trypanosoma', 'A darting flagellate that dodges most shots. Wave 11+.', '#d8d0ff'],
    ['corona', 'Coronavirus', 'Hangs behind its pack and makes nearby pathogens faster. Kill it first. Wave 12+.', '#f0b050'],
    ['pseudo', 'Pseudomonas', 'Biofilm shell soaks hits. mRNA pierces it. Wave 9+.', '#6ac8e0'],
    ['boss', 'Influenza Prime', 'Rings of toxin, breeds viruses. Beat it to unlock stronger upgrades.', '#e0506a'],
    ['plague', 'Plague Mother', 'Charges, sprays toxin, splits.', '#e8c890'],
    ['colossus', 'MRSA Colossus', 'Sheds MRSA clusters as it breaks apart.', '#ff9a50'],
    ['quorum', 'Quorum Hive', 'Conducts a drone squad: surround, charge, guard.', '#60b0ff'],
    ['tb', 'Mycobacterium Rex', 'Wax shell regrows and heals — pierce or break it.', '#e0d4bc'],
    ['hydra', 'Prion Hydra', 'Splits in two when killed — twice.', '#e0b8d0'],
    ['shifter', 'The Shifter', 'Changes strategy at each third of its health: hunt, mirror, blink.', '#ff7080'],
    ['ebola', 'The Filament', 'A long Ebola strand — hit any part of it.', '#f0b878'],
    ['rabies', 'Lyssa the Rabid', 'Chained charges, wall sprays, toxin trails.', '#c8c8d8'],
    ['botulist', 'The Botulist', 'Plants toxin mines and gas clouds.', '#c0d090'],
    ['mycelia', 'Mycelia Queen', 'A reversing spore spiral and blooms.', '#e8d0f0'],
    ['measles', 'Measles Monarch', 'Orbiting shield-virions block your shots.', '#80e8e8'],
    ['phantom', 'The Phantom', 'Teleports; its decoys shoot back.', '#a898ff'],
  ];

  // Build one wave's spawn list. Gated types always show at least one once unlocked.
  V.waveList = (n, D) => {
    const q = [];
    const add = (type, count, min = 0) => { const k = Math.max(min, Math.round(count * D.count)); for (let i = 0; i < k; i++) q.push(type); };
    const every = D.bossEvery || 5, bossWave = n % every === 0;
    // boss waves are just the boss — any minions come from bosses that spawn their own
    if (bossWave) return [V.bossFor(n / every)];
    const scale = 1;
    add('virus', (3 + n * .7) * scale, 2);
    if (n >= 2) add('bact', n / 1.8 * scale, 1);
    if (n >= 2) add('bug', n / 2.5 * scale, 1);
    if (n >= 4) add('prion', Math.min(8, n - 2) * scale, 1);
    if (n >= 4) add('salmo', (n - 2) / 2.5 * scale, 1);
    if (n >= 6) add('hiv', (n - 4) / 2 * scale, 1);
    if (n >= 7) add('candida', (n - 4) / 3.5 * scale, 1);
    if (n >= 3) add('plasmo', (n - 1) / 2.5 * scale, 1);
    if (n >= 6) add('noro', (n - 3) / 2.5 * scale, 1);
    if (n >= 8) add('strep', (n - 6) / 4 * scale, 1);   // each entry is a whole 6-link chain
    if (n >= 9) add('pseudo', (n - 7) / 2.5 * scale, 1);
    if (n >= 3) add('adeno', (n - 1) / 3 * scale, 1);
    if (n >= 7) add('giardia', (n - 5) / 3 * scale, 1);
    if (n >= 10) add('borrelia', (n - 8) / 2.5 * scale, 1);
    if (n >= 8) add('tetanus', (n - 6) / 3 * scale, 1);
    if (n >= 9) add('klebs', (n - 7) / 3 * scale, 1);
    if (n >= 11) add('trypan', (n - 9) / 2.5 * scale, 1);
    if (n >= 12) add('corona', (n - 10) / 4 * scale, 1);
    V.expandWave?.(n, add, scale, q, D);   // expansion.js
    q.sort(() => Math.random() - .5);
    if (bossWave) q.unshift(V.bossFor(n / every));
    return q;
  };

  // Bosses take turns; the rotation repeats (and gets tougher) after the fifth.
  V.BOSS_ORDER = ['boss', 'plague', 'colossus', 'quorum', 'tb', 'shifter', 'hydra', 'ebola', 'rabies', 'botulist', 'mycelia', 'measles', 'phantom'];
  V.bossFor = k => V.BOSS_ORDER[(k - 1) % V.BOSS_ORDER.length];
  V.BOSSES = {
    boss:    { name: 'Influenza Prime',   sub: 'Influenza Prime is replicating' },
    plague:  { name: 'The Plague Mother', sub: 'The Plague Mother awakens' },
    tb:      { name: 'Mycobacterium Rex', sub: 'Break its wax shell — it grows back' },
    rabies:  { name: 'Lyssa the Rabid',   sub: 'It ricochets off the vessel walls' },
    phantom: { name: 'The Phantom',       sub: 'Only one of them is real' },
    colossus:{ name: 'MRSA Colossus',     sub: 'Every chunk you break off fights back' },
    ebola:   { name: 'The Filament',      sub: 'An Ebola strand — hit any part of it' },
    mycelia: { name: 'Mycelia Queen',     sub: 'Weave through the spore spiral' },
    measles: { name: 'Measles Monarch',   sub: 'Break its orbiting guard to reach the core' },
    botulist:{ name: 'The Botulist',      sub: 'Watch your step — it plants mines' },
    hydra:   { name: 'Prion Hydra',       sub: 'Cut it down and it splits in two' },
    quorum:  { name: 'Quorum Hive',       sub: 'Its drones move as one' },
    shifter: { name: 'The Shifter',       sub: 'It learns — every third of its health, a new strategy' },
  };
  // Boss Rush: one boss per round. Round n fights at level baseLevel + (n - 1) * levelPerRound,
  // so the first two bosses stay gentle while you're still on basic upgrades.
  V.RUSH = { levelPerRound: 3, baseLevel: 2, healBetween: 2 };
  V.WAVE_SUBS = {
    1: 'Rhinovirus in the bloodstream', 2: 'E. coli detected — they split', 3: 'Some red cells aren’t what they seem',
    4: 'Prions and Salmonella incoming', 5: 'Adenovirus anchors to the walls',
    7: 'Candida sheds spores · Giardia latches on — dash!', 8: 'Strep chains slither in · Tetanus snipers take aim', 9: 'Pseudomonas hides in biofilm · Klebsiella blocks frontal shots',
    11: 'Trypanosomes dodge your shots', 12: 'Coronavirus empowers the swarm — kill it first',
    10: 'Borrelia sweeps the vessel', 6: 'HIV cloaks · Norovirus teleports · Adenovirus anchors',
  };

  // Timed/instant pickups dropped by pathogens.
  // tier 2 = strong; only drops once Influenza Prime has been defeated.
  V.POW = {
    heal:   { name: 'Booster',        color: '#ff5a6e', desc: 'Restores 1 immunity.', weight: 22 },
    spread: { name: 'Adjuvant',       color: '#ffe066', desc: 'Two extra side antibodies (45% damage).', weight: 15, time: 10 },
    rapid:  { name: 'Interferon',     color: '#8fd0ff', desc: 'Fires 80% faster.', weight: 15, time: 9 },
    pierce: { name: 'mRNA Strand',    color: '#ff7ac8', desc: 'Shots punch through enemies.', weight: 13, time: 10 , tier: 2 },
    shield: { name: 'Memory B-cell',  color: '#7fe0d4', desc: 'Blocks the next hit (stacks to 2).', weight: 14 },
    speed:  { name: 'Plasma Rush',    color: '#9cf04a', desc: 'Move 50% faster.', weight: 10, time: 9 },
    nova:   { name: 'Cytokine Storm', color: '#ff8a3c', desc: 'Damages everything on screen.', weight: 8 , tier: 2 },
    homing: { name: 'Monoclonal Ab',  color: '#d0b0ff', desc: 'Antibodies seek out targets.', weight: 12, time: 10 , tier: 2, minWave: 20 },
    neutro: { name: 'Neutrophils',    color: '#f0f0ff', desc: 'Two white cells orbit you, hitting pathogens and eating toxin.', weight: 10, time: 12 , tier: 2 },
    macro:  { name: 'Macrophage',     color: '#b8a8ff', desc: 'A white-cell ally hunts pathogens for you.', weight: 8, time: 14 , tier: 2 },
    freeze: { name: 'Cold Chain',     color: '#bfe8ff', desc: 'Everything else slows to 40% speed.', weight: 9, time: 6 , tier: 2 },
    vitc:   { name: 'Vitamin C',      color: '#ffb040', desc: 'Move 30% faster and fire 30% faster.', weight: 13, time: 9 },
    atp:    { name: 'ATP Surge',      color: '#ffd23a', desc: '+25 ATP now, and double ATP for 10s.', weight: 10, time: 10 },
    il2:    { name: 'Interleukin-2',  color: '#ff6a3c', desc: 'Antibodies deal 50% more damage.', weight: 10, time: 9, tier: 2 },
    complement: { name: 'Complement', color: '#4affc0', desc: 'Shots burst on impact, splashing nearby pathogens.', weight: 10, time: 10, tier: 2 },
    fever:  { name: 'Fever',          color: '#ff4a2a', desc: 'Pathogens close to you burn.', weight: 9, time: 9, tier: 2 },
    phage:  { name: 'Phage Swarm',    color: '#d8d8f0', desc: 'Releases 6 seeking phages — double damage to bacteria.', weight: 9, tier: 2 },
  };
  V.POW_KEYS = Object.keys(V.POW);
  V.randomPower = (primed) => {
    const lv = V.G?.S?.level || 0;   // some power-ups (Monoclonal Ab) only show up from wave 20
    const keys = V.POW_KEYS.filter(k => (primed || V.POW[k].tier !== 2) && lv >= (V.POW[k].minWave || 0));
    let r = Math.random() * keys.reduce((s, k) => s + V.POW[k].weight, 0);
    for (const k of keys) { r -= V.POW[k].weight; if (r <= 0) return k; }
    return 'heal';
  };

  // ---------- economy ----------
  // ATP is the cell's energy currency: pathogens drop it, the Pharmacy between waves spends it.
  V.atpFor = e => e.boss ? 30 + Math.round(e.level * 1.5) : Math.max(1, Math.round(e.score / 5));
  V.atpClear = (wave, rush) => rush ? 20 + wave * 4 : 10 + wave * 2;   // bonus for clearing a wave / beating a rush boss
  V.SHOP = {
    heal:   { name: 'Booster Shot',        desc: '+1 immunity now.',              icon: 'heal',    base: 25, step: 10 },
    shield: { name: 'Memory B-cell',       desc: '+1 shield now (max 2).',        icon: 'shield',  base: 35, step: 10 },
    maxhp:  { name: 'Glass Reinforcement', desc: '+1 max immunity (3 in stock).', icon: 'maxhp',   base: 90, step: 45, limit: 3 },
    reroll: { name: 'Reroll',              desc: 'Swap the adaptation choices.',  icon: 'reroll',  base: 15, step: 10 },
    extra:  { name: 'Double Dose',         desc: 'Pick one more adaptation.',     icon: 'extra',   base: 80, step: 40 },
    stock:  { tier1: 30, tier2: 55, boost: 1.5 },   // stocked power-ups start the next wave, lasting 1.5× as long
  };
  // power-ups that make sense to stock (timed ones — instant ones would fire into an empty wave)
  V.STOCKABLE = ['spread', 'rapid', 'pierce', 'speed', 'homing', 'neutro', 'macro', 'freeze', 'vitc', 'il2', 'complement', 'fever'];

  // Dash: a quick burst with a moment of invulnerability.
  V.DASH = { cd: 2.2, time: .16, speed: 250, inv: .35 };

  // ---------- meta progression: DNA, the Research Lab, missions, daily challenge ----------
  // DNA earned at the end of every run (before the difficulty multiplier)
  V.DNA = { perWave: 2, perBoss: 12, perKills: 15 };
  // Research Lab: permanent upgrades bought with DNA. cost[i] is the price of level i+1.
  V.LAB = [
    { id: 'potency', cost: [25, 50, 80, 120, 170] },   // +6% damage per level
    { id: 'kit',     cost: [30, 60, 100] },            // +25 starting ATP per level
    { id: 'vial',    cost: [45, 100] },                // +1 starting immunity per level
    { id: 'reflex',  cost: [35, 70, 120] },            // dash recharges 12% faster per level
    { id: 'salvage', cost: [30, 65, 110] },            // +12% ATP per level
    { id: 'shield',  cost: [80] },                     // start every run with a shield
    { id: 'insight', cost: [150] },                    // 4 adaptation choices instead of 3
    { id: 'revive',  cost: [220] },                    // Second Wind: survive one fatal hit per run
  ];
  // Difficulty unlocks
  V.UNLOCK = { hard: { diff: 'normal', wave: 10 }, nightmare: { diff: 'hard', wave: 15 } };
  // Mission templates. kind decides how progress is tracked; 'run' missions must be done within one run.
  V.MISSIONS = [
    { kind: 'reach',   params: [8, 12, 16, 20], reward: n => 10 + n * 2 },
    { kind: 'boss',    params: ['boss', 'plague', 'colossus', 'tb', 'hydra', 'ebola'], reward: (k, i) => 25 + i * 8 },
    { kind: 'kill',    params: [['virus', 150], ['bact', 60], ['bug', 40], ['prion', 60], ['salmo', 40], ['adeno', 30]], reward: () => 22 },
    { kind: 'flawless',params: [4, 6, 8], reward: n => 15 + n * 3 },   // clear a wave at/after wave n without being hit
    { kind: 'combo',   params: [20, 30], reward: n => n },             // reach a combo of n kills
    { kind: 'shop',    params: [8, 15], reward: n => 10 + n },         // buy n Pharmacy items (across runs)
    { kind: 'nodash',  params: [1], reward: () => 35 },                // defeat a boss without dashing
    { kind: 'elite',   params: [10, 25], reward: n => 12 + n },        // neutralize n elites (across runs)
    { kind: 'mutant',  params: [2, 5], reward: n => 15 + n * 6 },       // neutralize n mutants (across runs)
  ];
  // Daily challenge rule changes (two are drawn each day)
  V.MUTATORS = {
    swarm:   { count: 1.6 },
    glass:   { maxHp: 1, atp: 3, drop: 2 },
    frenzy:  { bossEvery: 3 },
    haste:   { speed: 1.3 },
    toxic:   { toxicDeath: true },
    nopharm: { noShop: true, choices: 1 },
    elite:   { elite: 3 },
    brittle: { dmg: 1.5, hpDelta: -2 },
  };

  // Permanent adaptations offered after each cleared wave.
  V.UPGRADES = [
    { id: 'hp',     name: 'Thicker Glass',  desc: '+1 max immunity, and heal 1.', max: 4, earlyMax: 2, apply: P => { P.max++; P.hp = Math.min(P.max, P.hp + 1); } },
    { id: 'rate',   name: 'Faster Plunger', desc: 'Fire 10% faster.', max: 4, earlyMax: 2, apply: P => { P.rate *= .9; } },
    { id: 'dmg',    name: 'Potent Dose',    desc: 'Antibodies deal 25% more damage.', max: 4, earlyMax: 1, apply: P => { P.dmg += .25; } },
    { id: 'multi',  name: 'Bivalent',       desc: 'Fire one extra parallel antibody (70% damage).', max: 2, tier: 2, apply: P => { P.multi++; } },
    { id: 'speed',  name: 'Streamlined',    desc: 'Move 12% faster.', max: 3, apply: P => { P.spd *= 1.12; } },
    { id: 'magnet', name: 'Chemotaxis',     desc: 'Pull power-ups in from farther away.', max: 3, apply: P => { P.magnet += 16; } },
    { id: 'dur',    name: 'Long-lasting',   desc: 'Power-ups last 35% longer.', max: 3, apply: P => { P.dur *= 1.35; } },
    { id: 'memory', name: 'Immune Memory',  desc: 'Start every wave with a shield.', max: 1, tier: 2, apply: P => { P.waveShield = true; } },
    { id: 'regen',  name: 'Recovery',       desc: 'Heal 1 at the start of every wave.', max: 1, tier: 2, apply: P => { P.waveHeal = true; } },
    // "forever" versions of power-ups (tier 2)
    { id: 'permMacro',  name: 'Resident Macrophage', desc: 'A macrophage ally follows you for the rest of the run.', max: 2, tier: 2, perm: 'macro',
      apply: P => { P.perm.macro = (P.perm.macro || 0) + 1; } },
    { id: 'permNeutro', name: 'Neutrophil Guard',    desc: 'White cells orbit you for the rest of the run.', max: 2, tier: 2, perm: 'neutro',
      apply: P => { P.perm.neutro = (P.perm.neutro || 0) + 1; } },
    { id: 'permHoming', name: 'Monoclonal Memory',   desc: 'Your antibodies always seek targets.', max: 1, tier: 2, perm: 'homing', minWave: 20,
      apply: P => { P.perm.homing = 1; } },
  ];
})();
