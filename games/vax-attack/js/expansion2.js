// Expansion 2 (data): five more bosses and six more power-ups. Art and behaviour are in expansion2-ai.js.
(() => {
  const V = window.VAX;

  Object.assign(V.ENEMIES, {
    twins:    { r: 7,  hp: 70,  spd: 34, grow: 0, score: 900,  boss: true, bossHp: 7,  init: e => { e.spin = 0; e.fire = 1.5; e.role = 0; } },
    twins2:   { r: 7,  hp: 70,  spd: 34, grow: 0, score: 900,  boss: true, bossHp: 7,  init: e => { e.spin = Math.PI; e.fire = 2; e.role = 1; } },
    anthrax:  { r: 9,  hp: 120, spd: 18, grow: 0, score: 1600, boss: true, bossHp: 13, init: e => { e.lineT = 2.5; e.fire = 2; e.brood = 4; e.lines = []; } },
    cholera:  { r: 9,  hp: 120, spd: 24, grow: 0, score: 1700, boss: true, bossHp: 13, init: e => { e.flowT = 2; e.flowDir = 1; e.flowWarn = 0; e.wallT = 3; e.fire = 2; } },
    superbug: { r: 9,  hp: 110, spd: 28, grow: 0, score: 1900, boss: true, bossHp: 12, init: e => { e.shieldUp = true; e.shieldT = 0; e.fire = 1.5; e.state = 'move'; e.cd = 4; } },
    sepsis:   { r: 10, hp: 130, spd: 16, grow: 0, score: 2000, boss: true, bossHp: 14, init: e => { e.fire = 2; e.spin = 0; e.relax = [.75, .5, .25]; e.aim = 1.5; } },
  });
  // the Twins are one fight with two bodies
  V.LINKED = { twins: ['twins2'], twins2: ['twins'] };

  V.GUIDE.push(
    ['twins', 'Staph Twins', 'Two linked bosses. Kill one and the other revives it — unless you finish it within 8 seconds.', '#ffc040'],
    ['anthrax', 'Anthrax Sovereign', 'Marks lines across the vessel, then fills them with toxin. Step off the red lines.', '#e05050'],
    ['cholera', 'Cholera Tide', 'A current drags you around while toxin walls sweep across — find the gap.', '#60c0e0'],
    ['superbug', 'The Superbug', 'Its shield blocks every antibody. Dash straight through it to break the shield.', '#a0ff60'],
    ['sepsis', 'Sepsis', 'The vessel closes in around you. Each quarter of its health you take opens it back up.', '#c02040'],
  );
  Object.assign(V.BOSSES, {
    twins:    { name: 'Staph Twins',       sub: 'Two bodies, one fight — take them down together' },
    anthrax:  { name: 'Anthrax Sovereign', sub: 'Stay off the red lines' },
    cholera:  { name: 'Cholera Tide',      sub: 'Swim against the current' },
    superbug: { name: 'The Superbug',      sub: 'Resistant to everything — except a dash' },
    sepsis:   { name: 'Sepsis',            sub: 'The walls are closing in' },
  });
  Object.assign(V.FLOOR_MUL, { twins: .5, twins2: .5, anthrax: .85, cholera: .85, superbug: .6, sepsis: .9 });

  // slot them into the rotation; Patient Zero stays last (now wave 140)
  const order = V.BOSS_ORDER.filter(k => k !== 'zero');
  [['twins', 5], ['anthrax', 9], ['cholera', 13], ['superbug', 17], ['sepsis', 21]].forEach(([k, i]) => order.splice(i, 0, k));
  order.push('zero');
  V.BOSS_ORDER.length = 0; V.BOSS_ORDER.push(...order);

  Object.assign(V.POW, {
    bounce:  { name: 'Opsonin',        color: '#ffb0e0', desc: 'Antibodies ricochet off the vessel walls twice.', weight: 11, time: 10 },
    mega:    { name: 'Mega Dose',      color: '#ff9a40', desc: 'Bigger antibodies that deal 60% more damage.', weight: 10, time: 9 },
    halo:    { name: 'Antibody Halo',  color: '#a0fff0', desc: 'Six antibodies circle you, blocking toxins and hitting pathogens.', weight: 10, time: 12 },
    antitox: { name: 'Antitoxin',      color: '#80ffa0', desc: 'Wipes every toxin, and toxins can’t hurt you for 5s.', weight: 8, time: 5 },
    nk:      { name: 'NK Cell',        color: '#ff6a9a', desc: 'A natural killer cell dashes from pathogen to pathogen, hitting hard.', weight: 9, time: 12, tier: 2 },
    clone:   { name: 'Booster Clone',  color: '#9ad0ff', desc: 'A second vaccine flies beside you and fires too.', weight: 9, time: 10, tier: 2 },
  });
  for (const k of ['bounce', 'mega', 'halo', 'antitox', 'nk', 'clone']) { V.POW_KEYS.push(k); V.STOCKABLE.push(k); }
})();
