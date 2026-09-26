// The Outbreak expansion: 20 more viruses, 10 more bosses, and a campaign that runs to wave 115.
// Data only (loaded right after config.js so translations can be built from it); art + AI live in expansion-ai.js.
(() => {
  const V = window.VAX;
  const rnd = (a, b) => a + Math.random() * (b - a);

  Object.assign(V.ENEMIES, {
    zika:     { r: 3,   hp: 2,  spd: 30, grow: .6, score: 16, init: e => { e.state = 'rest'; e.cd = rnd(.6, 1.2); } },
    dengue:   { r: 4,   hp: 3,  spd: 24, grow: .5, score: 18 },
    rota:     { r: 4,   hp: 4,  spd: 40, grow: .5, score: 22, init: e => { e.state = 'roll'; e.cd = 1; } },
    polio:    { r: 3.5, hp: 3,  spd: 18, grow: .3, score: 22, init: e => { e.fire = rnd(1, 2); } },
    herpes:   { r: 4,   hp: 4,  spd: 22, grow: .4, score: 24, init: e => { e.cycle = rnd(1.5, 3); } },
    hepb:     { r: 5,   hp: 6,  spd: 14, grow: .3, score: 26, init: e => { e.shed = rnd(.5, 1); } },
    hbsag:    { r: 2,   hp: 1,  spd: 8,  grow: 0,  score: 1,  init: e => { e.life = 6; e.harmless = true; } },
    h5n1:     { r: 3.5, hp: 2,  spd: 34, grow: .6, score: 14 },
    marburg:  { r: 4,   hp: 3,  spd: 36, grow: .5, score: 24, init: e => { e.trail = .3; e.flank = Math.random() < .5 ? -1 : 1; } },
    variola:  { r: 5,   hp: 7,  spd: 15, grow: .3, score: 30, init: e => { e.counterT = 0; } },
    mumps:    { r: 4,   hp: 6,  spd: 18, grow: .3, score: 26, init: e => { e.swell = 0; } },
    rsv:      { r: 4,   hp: 3,  spd: 20, grow: .4, score: 18, init: e => { e.size = 0; } },
    bphage:   { r: 3,   hp: 3,  spd: 18, grow: .3, score: 22, init: e => { e.state = 'walk'; e.cd = rnd(1, 2); } },
    mers:     { r: 5,   hp: 6,  spd: 16, grow: .3, score: 32, init: e => { e.spin = 0; e.regrow = 4; e.guardSpr = 'mersSpike'; e.guards = [0, 1, 2].map(() => ({ x: e.x, y: e.y, hp: 3, alive: true })); } },
    yellow:   { r: 4,   hp: 4,  spd: 24, grow: .5, score: 24 },
    chikv:    { r: 3.5, hp: 3,  spd: 62, grow: .6, score: 22 },
    nipah:    { r: 4,   hp: 3,  spd: 30, grow: .5, score: 26, init: e => { e.state = 'perch'; e.cd = rnd(1, 2); } },
    lassa:    { r: 4,   hp: 4,  spd: 24, grow: .4, score: 28, init: e => { e.state = 'up'; e.cd = rnd(1.5, 2.5); } },
    hanta:    { r: 4,   hp: 4,  spd: 20, grow: .3, score: 26, init: e => { e.puff = rnd(1, 2); } },
    westnile: { r: 3,   hp: 2,  spd: 50, grow: .5, score: 20, init: e => { e.state = 'circle'; e.cd = rnd(1.5, 2.5); e.orbit = Math.random() * 6.28; } },
    mimi:     { r: 8,   hp: 30, spd: 9,  grow: .1, score: 90, init: e => { e.brood = 2; } },
    sputnik:  { r: 2,   hp: 1,  spd: 40, grow: .5, score: 2,  init: e => { e.life = 7; } },

    pandemic:  { r: 10, hp: 110, spd: 20, grow: 0, score: 1400, boss: true, bossHp: 12, init: e => { e.fire = 2; e.spin = 0; e.flock = 4; e.arm = 0; } },
    fevers:    { r: 6,  hp: 70,  spd: 26, grow: 0, score: 1500, boss: true, bossHp: 8,  init: e => { e.spin = 0; e.guardSpr = 'feverPart'; e.guardR = 6; e.guards = [0, 1, 2, 3].map(i => ({ x: e.x, y: e.y, hp: 1, alive: true, sero: i, fire: 1 + i * .4 })); } },
    wheel:     { r: 11, hp: 120, spd: 60, grow: 0, score: 1500, boss: true, bossHp: 12, init: e => { e.spin = 0; e.path = 0; e.stopT = 8; e.state = 'roll'; } },
    latency:   { r: 8,  hp: 100, spd: 30, grow: 0, score: 1600, boss: true, bossHp: 11, init: e => { e.state = 'active'; e.st = 4; e.fire = 1; } },
    megavirus: { r: 14, hp: 150, spd: 8,  grow: 0, score: 1700, boss: true, bossHp: 14, init: e => { e.shell = e.shellMax = 60; e.calm = 0; e.expT = 0; e.brood = 2; e.fire = 3; } },
    paralyzer: { r: 9,  hp: 120, spd: 14, grow: 0, score: 1700, boss: true, bossHp: 13, init: e => { e.fire = 1.5; e.zone = 3; e.aim = 2; } },
    smallpox:  { r: 10, hp: 130, spd: 16, grow: 0, score: 1800, boss: true, bossHp: 13, init: e => { e.counterT = 0; e.burstT = 5; e.split = [.66, .33]; e.fire = 2; } },
    carrier:   { r: 10, hp: 125, spd: 30, grow: 0, score: 1800, boss: true, bossHp: 13, init: e => { e.drop = 2; e.state = 'move'; e.cd = 3; e.shots = 0; } },
    empress:   { r: 10, hp: 130, spd: 16, grow: 0, score: 1900, boss: true, bossHp: 14, init: e => { e.spin = 0; e.beamT = 0; e.brood = 4; e.fire = 2.5; } },
    zero:      { r: 11, hp: 130, spd: 26, grow: 0, score: 3000, boss: true, bossHp: 22, init: e => { e.act = 0; e.actT = 6; e.fire = 1; e.state = 'move'; e.st = 0; e.brood = 5; } },
  });
  // minions never count as "new" pathogens in the guide, and never drop power-ups
  V.MINIONS = new Set(['hbsag', 'sputnik']);

  V.GUIDE.push(
    ['zika', 'Zika', 'Hops in short, sudden bursts. Wave 13+.', '#f0a0c0'],
    ['dengue', 'Dengue', 'Kill it and a stronger second infection takes its place. Wave 14+.', '#ff6060'],
    ['rota', 'Rotavirus', 'A wheel that rolls along the walls, then leaps across at you. Wave 16+.', '#e0c060'],
    ['polio', 'Poliovirus', 'Its blue shots don’t hurt — they paralyse, slowing you down. Wave 17+.', '#70a0ff'],
    ['herpes', 'Herpes', 'Goes latent — invisible and untouchable — then flares up near you. Wave 18+.', '#e070a0'],
    ['hepb', 'Hepatitis B', 'Sheds decoy antigen particles that soak up your shots. Wave 19+.', '#d0b040'],
    ['h5n1', 'Avian flu', 'Flies in V-formation flocks behind a leader. Wave 21+.', '#a0c8ff'],
    ['marburg', 'Marburg', 'Zigzags fast, leaving pools of toxin behind it. Wave 22+.', '#d06040'],
    ['variola', 'Variola', 'Hitting its pustules makes them fire back at you. Wave 23+.', '#e8d0a0'],
    ['mumps', 'Mumps', 'Swells up over time — kill it before it bursts. Wave 24+.', '#ffa070'],
    ['rsv', 'RSV', 'Merges with other RSVs into bigger, tougher syncytia. Wave 26+.', '#80e0c0'],
    ['bphage', 'Bacteriophage', 'Leaps at you on spider legs — shots pass under it mid-jump. Wave 27+.', '#c0c0d0'],
    ['mers', 'MERS', 'Guarded by three orbiting spike proteins. Wave 28+.', '#e0a080'],
    ['yellow', 'Yellow fever', 'Leaves a toxic puddle when it dies. Wave 29+.', '#f0e040'],
    ['chikv', 'Chikungunya', 'Pinballs off the walls, faster with every bounce. Wave 31+.', '#ff80ff'],
    ['nipah', 'Nipah', 'Perches by a wall like a bat, then swoops through you. Wave 32+.', '#9080c0'],
    ['lassa', 'Lassa', 'Burrows underground and erupts beneath you. Wave 33+.', '#c09060'],
    ['hanta', 'Hantavirus', 'Puffs clouds of dust that drift toward you. Wave 34+.', '#b0a090'],
    ['westnile', 'West Nile', 'Circles you like a mosquito, then darts straight through. Wave 36+.', '#80d0ff'],
    ['mimi', 'Mimivirus', 'A giant virus that releases swarms of Sputnik virophages. Wave 38+.', '#80e080'],
    ['pandemic', 'The 1918 Pandemic', 'Four-armed spirals and flocks of avian flu.', '#a0c8ff'],
    ['fevers', 'Four Fevers', 'Four dengue serotypes shield the core. Each one lost makes the rest angrier.', '#ff6060'],
    ['wheel', 'The Great Wheel', 'A giant rotavirus that rolls around the arena, spraying from its spokes.', '#e0c060'],
    ['latency', 'Latency', 'Hides for long stretches, then flares up right next to you.', '#e070a0'],
    ['megavirus', 'Megavirus', 'An armoured capsid that regrows, and endless virophages.', '#80e080'],
    ['paralyzer', 'The Paralyzer', 'Paralysing volleys and zones that slow you to a crawl.', '#70a0ff'],
    ['smallpox', 'Variola Major', 'Every hit fires back. Its pustules burst in huge rings.', '#e8d0a0'],
    ['carrier', 'Phage Carrier', 'Drops phage pods and fires sniper volleys.', '#c0c0d0'],
    ['empress', 'Crown Empress', 'Sweeping spike-protein beams, and it empowers every pathogen.', '#f0b050'],
    ['zero', 'Patient Zero', 'The source of every outbreak. It uses all of their tricks.', '#ffffff'],
  );

  // new bosses slot in between the old ones, so a normal run meets them from wave 25
  const NEW = ['pandemic', 'wheel', 'fevers', 'latency', 'megavirus', 'paralyzer', 'smallpox', 'carrier', 'empress', 'zero'];
  const old = V.BOSS_ORDER.slice(), order = old.slice(0, 4);
  for (let i = 0; i < NEW.length; i++) { order.push(NEW[i]); if (old[4 + i]) order.push(old[4 + i]); }
  V.BOSS_ORDER.length = 0; V.BOSS_ORDER.push(...order);
  Object.assign(V.BOSSES, {
    pandemic:  { name: 'The 1918 Pandemic', sub: 'The flu that circled the world' },
    fevers:    { name: 'Four Fevers',       sub: 'Four serotypes — break them all to reach the core' },
    wheel:     { name: 'The Great Wheel',   sub: 'It rolls the whole vessel' },
    latency:   { name: 'Latency',           sub: 'It hides inside you — watch for the flare' },
    megavirus: { name: 'Megavirus',         sub: 'Bigger than some bacteria' },
    paralyzer: { name: 'The Paralyzer',     sub: 'Don’t get caught standing still' },
    smallpox:  { name: 'Variola Major',     sub: 'Eradicated once. Back for revenge.' },
    carrier:   { name: 'Phage Carrier',     sub: 'It seeds the vessel with phages' },
    empress:   { name: 'Crown Empress',     sub: 'Her crown commands the swarm' },
    zero:      { name: 'Patient Zero',      sub: 'Where every outbreak began' },
  });
  Object.assign(V.FLOOR_MUL, { pandemic: .9, fevers: .55, wheel: .85, latency: .55, megavirus: .6, paralyzer: .85, smallpox: .85, carrier: 1.1, empress: .85, zero: 1.1 });

  // the new intros: one new virus on almost every non-boss wave from 13 to 38
  const START = { zika: 13, dengue: 14, rota: 16, polio: 17, herpes: 18, hepb: 19, h5n1: 21, marburg: 22, variola: 23, mumps: 24,
    rsv: 26, bphage: 27, mers: 28, yellow: 29, chikv: 31, nipah: 32, lassa: 33, hanta: 34, westnile: 36, mimi: 38 };
  V.EXP_START = START;
  Object.assign(V.WAVE_SUBS, {
    13: 'Zika hops in', 14: 'Dengue — the second infection is worse', 16: 'Rotavirus rolls along the walls', 17: 'Poliovirus — blue shots paralyse',
    18: 'Herpes lies latent, then flares', 19: 'Hepatitis B sheds decoys', 21: 'Avian flu flocks in formation', 22: 'Marburg leaves toxic pools',
    23: 'Variola fires back when hit', 24: 'Mumps swells — pop it early', 26: 'RSV cells merge together', 27: 'Bacteriophages leap — mid-air they’re untouchable',
    28: 'MERS hides behind spike guards', 29: 'Yellow fever leaves puddles', 31: 'Chikungunya pinballs off the walls', 32: 'Nipah swoops like a bat',
    33: 'Lassa burrows beneath you', 34: 'Hantavirus dust clouds', 36: 'West Nile circles, then strikes', 38: 'Mimivirus — a giant virus',
  });
  // how many of each new virus a wave brings (always a couple of the newest one)
  const perWave = { mimi: .35, mumps: .7, mers: .7, variola: .7, hepb: .7 };
  V.expandWave = (n, add, scale, q, D) => {
    const before = q.length;
    let newest = null;
    for (const [type, s] of Object.entries(START)) {
      if (n < s) continue;
      if (n === s) newest = type;
      add(type, Math.min(5, 1 + (n - s) / 5) * (perWave[type] || 1) * scale, 1);
    }
    // keep wave sizes on the curve the game was balanced for: the new viruses replace part of the crowd rather than piling on top
    const cap = Math.round(before * 1.12) + (newest ? 2 : 0);
    while (q.length > cap) {
      const i = Math.floor(Math.random() * q.length);
      if (q[i] === newest && q.filter(x => x === newest).length <= 2) continue;
      q.splice(i, 1);
    }
  };

  V.MUTANT.pattern = Object.assign(V.MUTANT.pattern, {
    zika: ['aim', 1, 64, 1.4], dengue: ['ring', 6, 48, 2.4], rota: ['fan', 3, 60, 1.8], polio: ['fan', 5, 56, 2], herpes: ['ring', 8, 44, 2.6],
    hepb: ['ring', 6, 42, 2.4], h5n1: ['aim', 1, 62, 1.6], marburg: ['trail', 1, 0, .2], variola: ['ring', 10, 42, 2.6], mumps: ['ring', 8, 44, 2.2],
    rsv: ['fan', 3, 54, 2], bphage: ['fan', 3, 60, 2], mers: ['fan', 5, 56, 2], yellow: ['ring', 6, 46, 2.2], chikv: ['trail', 1, 0, .15],
    nipah: ['fan', 3, 62, 1.8], lassa: ['ring', 8, 46, 2.4], hanta: ['fan', 3, 50, 2.2], westnile: ['aim', 1, 70, 1.4], mimi: ['ring', 12, 40, 2.4],
  });
  for (const k of ['zika', 'marburg', 'yellow', 'dengue']) V.FLANKERS.add(k);
  Object.assign(V.DODGE, { zika: .8, chikv: .3, westnile: .9, nipah: .6, h5n1: .5, dengue: .4 });
})();
