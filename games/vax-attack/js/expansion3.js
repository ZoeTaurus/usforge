// Expansion 3 (data): ten more viruses (waves 39–51), five more bosses, five more power-ups. Art + AI in expansion3-ai.js.
(() => {
  const V = window.VAX;
  const rnd = (a, b) => a + Math.random() * (b - a);

  Object.assign(V.ENEMIES, {
    reo:       { r: 4,   hp: 5,  spd: 16, grow: .3, score: 28 },
    hcv:       { r: 4,   hp: 5,  spd: 15, grow: .3, score: 30, init: e => { e.heal = rnd(1, 2); } },
    coxsackie: { r: 3.5, hp: 3,  spd: 26, grow: .5, score: 24, init: e => { e.hopT = 0; } },
    vzv:       { r: 4,   hp: 4,  spd: 22, grow: .4, score: 24, init: e => { e.spot = rnd(1, 2); } },
    ebv:       { r: 3.5, hp: 3,  spd: 40, grow: .5, score: 24, init: e => { e.orbit = rnd(0, 6.28); e.rad = 95; e.fire = rnd(1, 2); } },
    cmv:       { r: 4,   hp: 6,  spd: 18, grow: .3, score: 34, init: e => { e.size = 0; } },
    influb:    { r: 4,   hp: 4,  spd: 24, grow: .5, score: 22 },
    flufrag:   { r: 2,   hp: 1,  spd: 0,  grow: 0,  score: 2,  init: e => { e.life = 2.5; } },
    polyoma:   { r: 4,   hp: 5,  spd: 18, grow: .4, score: 30, init: e => { e.glowT = rnd(1, 3); } },
    mpox:      { r: 5,   hp: 6,  spd: 18, grow: .3, score: 32, init: e => { e.cd = rnd(1.5, 3); e.state = 'move'; } },
    parvo:     { r: 2,   hp: 1,  spd: 48, grow: .6, score: 6 },

    replicator: { r: 10, hp: 95,  spd: 20, grow: 0, score: 1800, boss: true, bossHp: 10, init: e => { e.copyT = 4; e.fire = 2; e.spin = 0; } },
    replica:    { r: 7,  hp: 20,  spd: 26, grow: 0, score: 60,  init: e => { e.fire = 1.5; e.spin = 0; } },
    storm:      { r: 10, hp: 125, spd: 22, grow: 0, score: 1900, boss: true, bossHp: 13, init: e => { e.strikeT = 1.5; e.bolt = 2; e.strikes = []; } },
    retro:      { r: 9,  hp: 120, spd: 26, grow: 0, score: 1900, boss: true, bossHp: 13, init: e => { e.hist = []; e.histT = 0; e.rewT = 8; e.state = 'move'; e.fire = 1.5; } },
    amoeba:     { r: 13, hp: 150, spd: 12, grow: 0, score: 2000, boss: true, bossHp: 14, init: e => { e.podT = 3; e.pods = []; e.biteT = 0; e.cd = 5; } },
    toxo:       { r: 9,  hp: 125, spd: 20, grow: 0, score: 2000, boss: true, bossHp: 13, init: e => { e.pulse = 3; e.fire = 1.8; e.blinkT = 6; e.state = 'move'; } },
  });
  V.MINIONS.add('flufrag'); V.MINIONS.add('replica');

  V.GUIDE.push(
    ['reo', 'Reovirus', 'Wraps a nearby pathogen in a shield that halves your damage. Wave 39+.', '#80c0ff'],
    ['hcv', 'Hepatitis C', 'Pulses green, healing pathogens around it. Kill it first. Wave 41+.', '#60e0a0'],
    ['coxsackie', 'Coxsackie', 'Blinks aside just before your shots land. Wave 42+.', '#ff90c0'],
    ['vzv', 'Varicella', 'Leaves itchy spots behind that burst into small rings. Wave 43+.', '#ffb070'],
    ['ebv', 'Epstein–Barr', 'Circles you in a tightening spiral, sniping as it closes in. Wave 44+.', '#b0a0ff'],
    ['cmv', 'Cytomegalovirus', 'Eats smaller viruses to grow bigger and tougher. Wave 46+.', '#e0e060'],
    ['influb', 'Influenza B', 'Bursts into three fast fragments when it dies. Wave 47+.', '#90c0e0'],
    ['polyoma', 'Polyomavirus', 'While it glows, its capsid reflects your shots back at you. Wave 48+.', '#e0e0ff'],
    ['mpox', 'Mpox', 'Latches a tractor beam on you and drags you in. Wave 49+.', '#d09070'],
    ['parvo', 'Parvovirus', 'Tiny and fast — they come in swarms. Wave 51+.', '#ff7070'],
    ['replicator', 'The Replicator', 'Copies itself. While its copies live, it heals.', '#70f0d0'],
    ['storm', 'Cytokine Storm', 'Calls down strikes on marked circles — keep moving.', '#ffe060'],
    ['retro', 'The Retrovirus', 'Rewinds time to undo your damage. Dash through it to stop the rewind.', '#c080ff'],
    ['amoeba', 'Naegleria', 'A brain-eating amoeba. If it swallows you, dash to break free.', '#f0a0b0'],
    ['toxo', 'Toxoplasma', 'Its purple pulses scramble your controls.', '#b060e0'],
  );

  // new bosses slot in before the final five (Patient Zero stays last, now at wave 165)
  const final5 = V.BOSS_ORDER.slice(-5), rest = V.BOSS_ORDER.slice(0, -5);
  [['replicator', 7], ['storm', 11], ['retro', 15], ['amoeba', 19], ['toxo', 23]].forEach(([k, i]) => rest.splice(i, 0, k));
  V.BOSS_ORDER.length = 0; V.BOSS_ORDER.push(...rest, ...final5);
  Object.assign(V.BOSSES, {
    replicator: { name: 'The Replicator',  sub: 'Every copy makes it stronger' },
    storm:      { name: 'Cytokine Storm',  sub: 'The immune system turned against you' },
    retro:      { name: 'The Retrovirus',  sub: 'It writes itself back into the past' },
    amoeba:     { name: 'Naegleria',       sub: 'It swallows whatever it catches' },
    toxo:       { name: 'Toxoplasma',      sub: 'It gets inside your head' },
  });
  Object.assign(V.FLOOR_MUL, { replicator: .8, storm: .85, retro: .7, amoeba: .9, toxo: .85 });

  const START = { reo: 39, hcv: 41, coxsackie: 42, vzv: 43, ebv: 44, cmv: 46, influb: 47, polyoma: 48, mpox: 49, parvo: 51 };
  Object.assign(V.EXP_START, START);
  Object.assign(V.WAVE_SUBS, {
    39: 'Reovirus shields its friends', 41: 'Hepatitis C heals the swarm — kill it first', 42: 'Coxsackie blinks away from your shots', 43: 'Varicella leaves itchy spots',
    44: 'Epstein–Barr spirals in', 46: 'Cytomegalovirus eats its own kind', 47: 'Influenza B shatters when it dies', 48: 'Polyomavirus reflects your shots while it glows',
    49: 'Mpox reels you in', 51: 'Parvovirus swarms',
  });
  V.MUTANT.pattern = Object.assign(V.MUTANT.pattern, {
    reo: ['ring', 6, 44, 2.4], hcv: ['ring', 8, 42, 2.6], coxsackie: ['aim', 1, 66, 1.4], vzv: ['ring', 6, 46, 2.2], ebv: ['fan', 3, 64, 1.8],
    cmv: ['ring', 10, 40, 2.6], influb: ['fan', 3, 58, 2], polyoma: ['ring', 8, 46, 2.4], mpox: ['fan', 5, 54, 2.2], parvo: ['aim', 1, 60, 2.2],
  });
  V.FLANKERS.add('parvo'); V.FLANKERS.add('influb');
  Object.assign(V.DODGE, { parvo: .5, influb: .4 });

  // more parvovirus per wave (they're tiny), fewer of the tough supports
  const expand = V.expandWave;
  V.expandWave = (n, add, scale, q, D) => { expand(n, add, scale, q, D); if (n >= START.parvo) add('parvo', Math.min(8, 3 + (n - START.parvo) / 4) * scale); };

  Object.assign(V.POW, {
    lyso:    { name: 'Lysozyme',       color: '#c0ffe0', desc: 'Your antibodies dissolve any toxin they pass through.', weight: 10, time: 10 },
    chain:   { name: 'Chain Antibody', color: '#80c0ff', desc: 'Every hit zaps the two nearest pathogens for half damage.', weight: 9, time: 10, tier: 2 },
    stasis:  { name: 'Stasis',         color: '#a0e0ff', desc: 'Freezes every pathogen and toxin completely for 3 seconds.', weight: 6, time: 3, tier: 2 },
    plasma:  { name: 'Plasma Cells',   color: '#ff80a0', desc: 'Kills sometimes heal you for 15s (once every 3s at most).', weight: 8, time: 15 },
    stealth: { name: 'Stealth Coat',   color: '#9090b0', desc: 'Pathogens lose track of you — their aim and chase go wide for 8s.', weight: 9, time: 8 },
  });
  for (const k of ['lyso', 'chain', 'stasis', 'plasma', 'stealth']) { V.POW_KEYS.push(k); if (k !== 'stasis') V.STOCKABLE.push(k); }
})();
