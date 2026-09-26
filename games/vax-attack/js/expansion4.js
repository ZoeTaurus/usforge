// Expansion 4 (data): ten viruses (waves 52–64), five bosses, five power-ups. Art + AI in expansion4-ai.js.
(() => {
  const V = window.VAX;
  const rnd = (a, b) => a + Math.random() * (b - a);

  Object.assign(V.ENEMIES, {
    hmpv:     { r: 3.5, hp: 4,  spd: 24, grow: .4, score: 26 },
    shigella: { r: 4,   hp: 6,  spd: 18, grow: .3, score: 28, init: e => { e.hits = 0; } },
    legion:   { r: 5,   hp: 6,  spd: 15, grow: .3, score: 34, init: e => { e.ate = 0; } },
    chapare:  { r: 3.5, hp: 3,  spd: 30, grow: .5, score: 26, init: e => { e.state = 'move'; } },
    borna:    { r: 4,   hp: 5,  spd: 16, grow: .3, score: 30 },
    echo:     { r: 4,   hp: 4,  spd: 60, grow: .3, score: 28 },
    aav:      { r: 3.5, hp: 5,  spd: 18, grow: .3, score: 30 },
    leish:    { r: 3.5, hp: 4,  spd: 28, grow: .4, score: 30 },
    rubella:  { r: 4,   hp: 5,  spd: 16, grow: .3, score: 30, init: e => { e.wave = rnd(1.5, 3); } },
    hendra:   { r: 4,   hp: 4,  spd: 22, grow: .4, score: 28, init: e => { e.fire = rnd(1, 2); } },
    egg:      { r: 4,   hp: 10, spd: 0,  grow: 0,  score: 15, init: e => { e.hatch = 5; } },
    shigmini: { r: 2.5, hp: 1,  spd: 30, grow: .5, score: 4 },

    hivemind:  { r: 6,  hp: 120, spd: 0,  grow: 0, score: 2000, boss: true, bossHp: 12, init: e => { e.latent = true; e.harmless = true; e.jumpT = 1; e.brood = 1; } },
    doppel:    { r: 7,  hp: 115, spd: 60, grow: 0, score: 2000, boss: true, bossHp: 12, init: e => { e.fire = 1; } },
    singular:  { r: 8,  hp: 125, spd: 14, grow: 0, score: 2100, boss: true, bossHp: 13, init: e => { e.fire = 2; e.fling = 4; e.spin = 0; } },
    architect: { r: 9,  hp: 125, spd: 18, grow: 0, score: 2100, boss: true, bossHp: 13, init: e => { e.build = 1.5; e.fire = 2; } },
    hatchery:  { r: 11, hp: 130, spd: 10, grow: 0, score: 2200, boss: true, bossHp: 13, init: e => { e.lay = 2; e.fire = 2.5; } },
  });
  for (const k of ['egg', 'shigmini']) V.MINIONS.add(k);

  V.GUIDE.push(
    ['hmpv', 'Metapneumovirus', 'Travels in pairs joined by a toxic tether. Kill one to cut it. Wave 52+.', '#a0e0ff'],
    ['shigella', 'Shigella', 'Every third hit splits off a small copy. Wave 53+.', '#e0b060'],
    ['legion', 'Legionella', 'Swallows your shots, then spits them back as toxins. Right after it spits (red box), it’s wide open — hit it then. Wave 54+.', '#c0a0e0'],
    ['chapare', 'Chapare', 'Rushes you and explodes — it flashes first. Wave 56+.', '#ff6040'],
    ['borna', 'Bornavirus', 'Its aura slows your antibodies to a crawl. Wave 57+.', '#90b0ff'],
    ['echo', 'Echovirus', 'Mirrors your movements across the vessel. Wave 58+.', '#ffe0a0'],
    ['aav', 'AAV', 'A magnet for your antibodies — it drags shots toward itself to protect others. Wave 59+.', '#d0d0d0'],
    ['leish', 'Leishmania', 'Drains your active power-ups while it’s near you. Wave 61+.', '#80e060'],
    ['rubella', 'Rubella', 'Sends out wide shockwave rings — dash through them. Wave 62+.', '#ff90a0'],
    ['hendra', 'Hendra', 'Fires two shots at once: one where you are, one where you’re going. Wave 64+.', '#b0c070'],
    ['hivemind', 'The Hivemind', 'Has no body — it possesses other pathogens. Find the glowing host and hit it.', '#d080ff'],
    ['doppel', 'The Doppelgänger', 'Fires your own weapon back at you. The stronger you are, the stronger it is.', '#7fe0d4'],
    ['singular', 'The Singularity', 'Pulls toxins into orbit, then flings them at you.', '#6040a0'],
    ['architect', 'The Architect', 'Builds biofilm walls that block your shots and your path.', '#a0c080'],
    ['hatchery', 'The Hatchery', 'Lays eggs that hatch into viruses. Break them before they open.', '#f0d0a0'],
  );

  const final5 = V.BOSS_ORDER.slice(-5), rest = V.BOSS_ORDER.slice(0, -5);
  [['doppel', 9], ['hivemind', 14], ['singular', 20], ['architect', 26], ['hatchery', 31]].forEach(([k, i]) => rest.splice(i, 0, k));
  V.BOSS_ORDER.length = 0; V.BOSS_ORDER.push(...rest, ...final5);
  Object.assign(V.BOSSES, {
    hivemind:  { name: 'The Hivemind',      sub: 'It could be any of them' },
    doppel:    { name: 'The Doppelgänger',  sub: 'It learned your weapon' },
    singular:  { name: 'The Singularity',   sub: 'Nothing escapes its pull' },
    architect: { name: 'The Architect',     sub: 'It walls you in' },
    hatchery:  { name: 'The Hatchery',      sub: 'Break the eggs before they open' },
  });
  Object.assign(V.FLOOR_MUL, { hivemind: .8, doppel: .9, singular: .9, architect: .85, hatchery: .9 });

  const START = { hmpv: 52, shigella: 53, legion: 54, chapare: 56, borna: 57, echo: 58, aav: 59, leish: 61, rubella: 62, hendra: 64 };
  Object.assign(V.EXP_START, START);
  Object.assign(V.WAVE_SUBS, {
    52: 'Metapneumovirus pairs share a toxic tether', 53: 'Shigella splits when hit', 54: 'Legionella eats your shots', 56: 'Chapare rushes in and explodes',
    57: 'Bornavirus slows your antibodies', 58: 'Echovirus mirrors your every move', 59: 'AAV drags your shots toward itself', 61: 'Leishmania drains your power-ups',
    62: 'Rubella sends out shockwaves — dash through', 64: 'Hendra shoots where you are and where you’re going',
  });
  // late waves are crowded with older viruses, so the new ones swap in for them instead of being lost in the shuffle
  const expand = V.expandWave, NEW = Object.keys(START);
  V.expandWave = (n, add, scale, q, D) => {
    expand(n, add, scale, q, D);
    const size = q.length;
    for (const [type, s] of Object.entries(START)) if (n >= s) add(type, Math.min(7, 2 + (n - s) / 3) * (n === s ? 1.5 : 1) * scale, 2);
    while (q.length > size) { const i = Math.floor(Math.random() * q.length); if (!NEW.includes(q[i])) q.splice(i, 1); else if (q.every(k => NEW.includes(k))) break; }
  };
  V.MUTANT.pattern = Object.assign(V.MUTANT.pattern, {
    hmpv: ['aim', 1, 60, 1.8], shigella: ['fan', 3, 54, 2.2], legion: ['ring', 10, 42, 2.6], chapare: ['aim', 1, 70, 1.6], borna: ['ring', 8, 40, 2.6],
    echo: ['aim', 1, 64, 1.6], aav: ['ring', 8, 44, 2.4], leish: ['fan', 3, 60, 2], rubella: ['ring', 12, 40, 2.8], hendra: ['fan', 5, 60, 2],
  });
  V.FLANKERS.add('chapare'); V.FLANKERS.add('leish');
  Object.assign(V.DODGE, { chapare: .5, leish: .6, hendra: .4 });

  Object.assign(V.POW, {
    mirror:   { name: 'Reflective Coat',     color: '#e0f0ff', desc: 'Toxins that hit you bounce back as antibodies for 6s.', weight: 8, time: 6, tier: 2 },
    turret:   { name: 'Antibody Drone',      color: '#7fe0d4', desc: 'A little drone orbits you and fires at the most dangerous pathogen.', weight: 9, time: 12 },
    vortex:   { name: 'Phagocyte Vortex',    color: '#b080ff', desc: 'Opens a vortex where you aim: it drags in pathogens and toxins and grinds them.', weight: 7, tier: 2 },
    adren:    { name: 'Adrenaline',          color: '#ff6040', desc: 'Move faster; dashes slice through pathogens and kills refresh your dash. 8s.', weight: 9, time: 8 },
    crit:     { name: 'Precision Antibodies', color: '#ffe080', desc: 'One shot in four lands a critical hit for triple damage. 10s.', weight: 10, time: 10 },
  });
  for (const k of ['mirror', 'turret', 'vortex', 'adren', 'crit']) { V.POW_KEYS.push(k); if (k !== 'vortex') V.STOCKABLE.push(k); }
})();
