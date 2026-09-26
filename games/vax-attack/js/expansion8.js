// Expansion 8 (data): five viruses that study you (waves 76–81) and five bosses — the Hunter, Sniper, Nemesis, Leviathan
// and the Mimic. Art + AI in expansion8-ai.js.
(() => {
  const V = window.VAX;
  const rnd = (a, b) => a + Math.random() * (b - a);

  Object.assign(V.ENEMIES, {
    cchf:  { r: 4,   hp: 7, spd: 30, grow: .3, score: 32, init: e => { e.fire = rnd(1.5, 2.5); } },
    rvf:   { r: 3.5, hp: 4, spd: 36, grow: .4, score: 30, init: e => { e.fire = rnd(1, 2); e.side = Math.random() < .5 ? -1 : 1; } },
    powv:  { r: 4,   hp: 5, spd: 20, grow: .3, score: 32, init: e => { e.state = 'up'; e.dig = rnd(2, 3.5); } },
    oro:   { r: 4,   hp: 5, spd: 16, grow: .3, score: 32, init: e => { e.web = rnd(2, 3); } },
    sabia: { r: 3.5, hp: 4, spd: 28, grow: .4, score: 30, init: e => { e.fire = rnd(1.5, 2.5); } },

    hunter:    { r: 8,  hp: 110, spd: 40, grow: 0, score: 2400, boss: true, bossHp: 12, init: e => { e.state = 'stalk'; e.st = 2.5; e.latent = true; e.harmless = true; } },
    sniper:    { r: 8,  hp: 120, spd: 30, grow: 0, score: 2400, boss: true, bossHp: 12, init: e => { e.lock = 0; e.lockT = 2; e.mortar = 3; e.fire = 1.5; e.lx = e.x; } },
    nemesis:   { r: 9,  hp: 140, spd: 26, grow: 0, score: 2600, boss: true, bossHp: 14, init: e => { e.read = 2.5; e.fire = 1.6; } },
    leviathan: { r: 8,  hp: 150, spd: 52, grow: 0, score: 2700, boss: true, bossHp: 14, init: e => { e.dir = Math.PI; e.trail = []; e.broad = 3; } },
    mimic:     { r: 9,  hp: 160, spd: 22, grow: 0, score: 3000, boss: true, bossHp: 15, init: e => { e.form = null; e.formN = 0; } },
  });

  V.GUIDE.push(
    ['cchf', 'Crimean-Congo', 'A bodyguard: it puts itself between you and the toughest pathogen nearby. Wave 76+.', '#c08060'],
    ['rvf', 'Rift Valley', 'Circles to wherever you aren’t aiming, then fires from the side. Wave 77+.', '#80c0ff'],
    ['powv', 'Powassan', 'Burrows, marks where you’re heading, and bursts out right there. Wave 78+.', '#a07050'],
    ['oro', 'Oropouche', 'Learns where you like to fight and fills that spot with toxin webs. Wave 79+.', '#b0e080'],
    ['sabia', 'Sabiá', 'Waits for you to dash, then fires where you land. Wave 81+.', '#ff80a0'],
    ['hunter', 'The Hunter', 'Stalks you unseen, then pounces from behind. Hit it while it’s exposed.', '#909090'],
    ['sniper', 'The Sniper', 'Tracks you with a laser sight before every shot, and shells where you stand.', '#ff4040'],
    ['nemesis', 'The Nemesis', 'Studies your habits: your favourite spot, your dodge, your range — and uses them.', '#6040a0'],
    ['leviathan', 'The Leviathan', 'A huge serpent whose body blocks your shots. Only its head can be hurt.', '#40a0a0'],
    ['mimic', 'The Mimic', 'Becomes the bosses you’ve already beaten, one after another.', '#e0e0e0'],
  );

  const final5 = V.BOSS_ORDER.slice(-5), rest = V.BOSS_ORDER.slice(0, -5);
  [['hunter', 8], ['sniper', 14], ['nemesis', 20], ['leviathan', 27], ['mimic', 45]].forEach(([k, i]) => rest.splice(i, 0, k));
  V.BOSS_ORDER.length = 0; V.BOSS_ORDER.push(...rest, ...final5);
  Object.assign(V.BOSSES, {
    hunter:    { name: 'The Hunter',    sub: 'You won’t see it coming' },
    sniper:    { name: 'The Sniper',    sub: 'Stay out of the red line' },
    nemesis:   { name: 'The Nemesis',   sub: 'It has been watching you' },
    leviathan: { name: 'The Leviathan', sub: 'Aim for the head' },
    mimic:     { name: 'The Mimic',     sub: 'Every boss you’ve beaten, at once' },
  });
  Object.assign(V.FLOOR_MUL, { hunter: .6, sniper: .8, nemesis: .9, leviathan: .7, mimic: 1 });

  const START = { cchf: 76, rvf: 77, powv: 78, oro: 79, sabia: 81 };
  Object.assign(V.EXP_START, START);
  Object.assign(V.WAVE_SUBS, {
    76: 'Crimean-Congo guards the others', 77: 'Rift Valley comes from where you aren’t looking', 78: 'Powassan burrows under your path',
    79: 'Oropouche learns your favourite spot', 81: 'Sabiá punishes every dash',
  });
  const expand = V.expandWave, NEW = Object.keys(START);
  V.expandWave = (n, add, scale, q, D) => {
    expand(n, add, scale, q, D);
    const size = q.length;
    for (const [type, s] of Object.entries(START)) if (n >= s) add(type, Math.min(6, 2 + (n - s) / 3) * (n === s ? 1.5 : 1) * scale, 2);
    while (q.length > size) { const i = Math.floor(Math.random() * q.length); if (!NEW.includes(q[i])) q.splice(i, 1); else if (q.every(k => NEW.includes(k))) break; }
  };
  V.MUTANT.pattern = Object.assign(V.MUTANT.pattern, {
    cchf: ['ring', 8, 42, 2.4], rvf: ['fan', 3, 64, 1.8], powv: ['ring', 10, 44, 2.6], oro: ['ring', 8, 40, 2.6], sabia: ['aim', 1, 70, 1.4],
  });
})();
