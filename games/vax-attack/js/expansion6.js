// Expansion 6 (data): eight smarter viruses (waves 66–74) and five bosses that read and predict the player. Art + AI in expansion6-ai.js.
(() => {
  const V = window.VAX;
  const rnd = (a, b) => a + Math.random() * (b - a);

  Object.assign(V.ENEMIES, {
    hpv:      { r: 4,   hp: 5,  spd: 15, grow: .3, score: 30, init: e => { e.shell = e.shellMax = 4; e.quiet = 0; } },
    lcmv:     { r: 3.5, hp: 4,  spd: 30, grow: .4, score: 30, init: e => { e.peek = rnd(1.5, 2.5); e.state = 'hide'; } },
    hev:      { r: 4,   hp: 6,  spd: 20, grow: .3, score: 30, init: e => { e.state = 'fight'; e.fire = rnd(1.5, 2.5); } },
    sapo:     { r: 3.5, hp: 4,  spd: 24, grow: .4, score: 30, init: e => { e.stam = 1.4; e.fire = rnd(1.5, 2.5); } },
    junin:    { r: 4,   hp: 4,  spd: 34, grow: .3, score: 28 },
    kfd:      { r: 4,   hp: 5,  spd: 18, grow: .3, score: 32, init: e => { e.howl = rnd(1, 2); } },
    astro:    { r: 4,   hp: 5,  spd: 16, grow: .3, score: 32, init: e => { e.spin = rnd(0, 6); e.burst = rnd(1, 2); e.on = 0; } },
    bunya:    { r: 4.5, hp: 6,  spd: 18, grow: .3, score: 32 },
    bunyaseg: { r: 2.5, hp: 2,  spd: 30, grow: .4, score: 6, init: e => { e.merge = 4; } },

    prism:     { r: 9,  hp: 130, spd: 16, grow: 0, score: 2200, boss: true, bossHp: 13, init: e => { e.spin = 0; e.fire = 2; e.refr = 0; } },
    oracle:    { r: 8,  hp: 120, spd: 22, grow: 0, score: 2200, boss: true, bossHp: 13, init: e => { e.fire = 1.5; e.omen = 2.5; e.blink = 0; e.volley = 0; } },
    puppeteer: { r: 9,  hp: 130, spd: 14, grow: 0, score: 2300, boss: true, bossHp: 13, init: e => { e.recruit = 1; e.fire = 2.2; e.form = 0; e.formT = 8; } },
    chimera:   { r: 10, hp: 145, spd: 22, grow: 0, score: 2400, boss: true, bossHp: 14, init: e => { e.phase = 0; e.state = 'move'; e.cd = 2.5; e.fire = 1.5; e.omen = 2; } },
    warden:    { r: 10, hp: 145, spd: 16, grow: 0, score: 2400, boss: true, bossHp: 14, init: e => { e.cage = 3; e.beam = 5; e.fire = 2; } },
  });
  V.MINIONS.add('bunyaseg');

  V.GUIDE.push(
    ['hpv', 'Papillomavirus', 'Grows a warty shell that soaks up shots. Leave it alone and the shell grows back. Wave 66+.', '#e0c0a0'],
    ['lcmv', 'LCMV', 'Hides behind other pathogens, then leans out to shoot. Wave 67+.', '#a0a0e0'],
    ['hev', 'Hepatitis E', 'Retreats when it’s hurt and heals itself. Finish it before it gets away. Wave 68+.', '#e0a060'],
    ['sapo', 'Sapovirus', 'Reads your shots and steps out of their path — until it runs out of breath. Wave 69+.', '#80e0e0'],
    ['junin', 'Junín', 'Hunts in packs: they spread out around you and fire all at once. Wave 71+.', '#e06080'],
    ['kfd', 'Kyasanur', 'Howls when it sees you, and every pathogen nearby rushes in. Wave 72+.', '#c0e060'],
    ['astro', 'Astrovirus', 'Fires spinning spirals of toxins. Look for the gaps. Wave 73+.', '#ffe0ff'],
    ['bunya', 'Bunyavirus', 'Splits into three segments when it dies. If they find each other, it comes back. Wave 74+.', '#60c0a0'],
    ['prism', 'The Prism', 'Its spinning facets split your shots into toxins. Shoot through the gaps.', '#c0f0ff'],
    ['oracle', 'The Oracle', 'Predicts where you’re going. It blinks away from your shots and marks the spot you’ll be.', '#ffe080'],
    ['puppeteer', 'The Puppeteer', 'Takes control of other pathogens and makes them fight in formation. Cut its strings.', '#d0a0ff'],
    ['chimera', 'The Chimera', 'Three beasts in one: it charges, then breeds, then calls down strikes.', '#ff9060'],
    ['warden', 'The Warden', 'Locks you in toxin cages and sweeps the vessel with a beam.', '#80a0c0'],
  );

  const final5 = V.BOSS_ORDER.slice(-5), rest = V.BOSS_ORDER.slice(0, -5);
  [['prism', 12], ['oracle', 18], ['puppeteer', 24], ['chimera', 30], ['warden', 36]].forEach(([k, i]) => rest.splice(i, 0, k));
  V.BOSS_ORDER.length = 0; V.BOSS_ORDER.push(...rest, ...final5);
  Object.assign(V.BOSSES, {
    prism:     { name: 'The Prism',     sub: 'It bends your own shots against you' },
    oracle:    { name: 'The Oracle',    sub: 'It already knows your next move' },
    puppeteer: { name: 'The Puppeteer', sub: 'Every pathogen is its puppet' },
    chimera:   { name: 'The Chimera',   sub: 'Three beasts, one body' },
    warden:    { name: 'The Warden',    sub: 'There is no way out' },
  });
  Object.assign(V.FLOOR_MUL, { prism: .85, oracle: .85, puppeteer: .6, chimera: .9, warden: .9 });

  const START = { hpv: 66, lcmv: 67, hev: 68, sapo: 69, junin: 71, kfd: 72, astro: 73, bunya: 74 };
  Object.assign(V.EXP_START, START);
  Object.assign(V.WAVE_SUBS, {
    66: 'Papillomavirus grows a shell', 67: 'LCMV takes cover', 68: 'Hepatitis E runs away to heal', 69: 'Sapovirus sidesteps your shots',
    71: 'Junín hunts in packs', 72: 'Kyasanur calls for help', 73: 'Astrovirus spins spirals', 74: 'Bunyavirus puts itself back together',
  });
  // like expansion 4: the newest viruses swap in for older ones instead of vanishing in the crowd
  const expand = V.expandWave, NEW = Object.keys(START);
  V.expandWave = (n, add, scale, q, D) => {
    expand(n, add, scale, q, D);
    const size = q.length;
    for (const [type, s] of Object.entries(START)) if (n >= s) add(type, Math.min(6, 2 + (n - s) / 3) * (n === s ? 1.5 : 1) * (type === 'junin' ? 1.5 : 1) * scale, 2);
    while (q.length > size) { const i = Math.floor(Math.random() * q.length); if (!NEW.includes(q[i])) q.splice(i, 1); else if (q.every(k => NEW.includes(k))) break; }
  };
  V.MUTANT.pattern = Object.assign(V.MUTANT.pattern, {
    hpv: ['ring', 8, 40, 2.6], lcmv: ['aim', 1, 66, 1.6], hev: ['fan', 3, 56, 2.2], sapo: ['aim', 1, 64, 1.6], junin: ['fan', 3, 60, 2],
    kfd: ['ring', 10, 42, 2.6], astro: ['ring', 12, 40, 2.4], bunya: ['fan', 5, 54, 2.2],
  });
  Object.assign(V.DODGE, { hev: .4, kfd: .3 });   // (Junín, LCMV and Sapovirus position themselves)
})();
