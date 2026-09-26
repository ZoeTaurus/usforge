// Expansion 7 (data): five bosses (Juggernaut, Siphon, Tempest, Thief, Pulsar) and five power-ups. Art + AI in expansion7-ai.js.
(() => {
  const V = window.VAX;

  Object.assign(V.ENEMIES, {
    juggernaut: { r: 10, hp: 125, spd: 18, grow: 0, score: 2400, boss: true, bossHp: 14, init: e => { e.face = Math.PI; e.state = 'move'; e.cd = 3; e.fire = 1.8; } },
    siphon:     { r: 9,  hp: 135, spd: 26, grow: 0, score: 2400, boss: true, bossHp: 13, init: e => { e.teth = 0; e.tcd = 1.5; e.fire = 2; e.held = 0; } },
    tempest:    { r: 9,  hp: 135, spd: 20, grow: 0, score: 2400, boss: true, bossHp: 13, init: e => { e.gust = 1; e.fire = 2; e.wx = 0; e.wy = 0; } },
    thief:      { r: 8,  hp: 125, spd: 34, grow: 0, score: 2500, boss: true, bossHp: 13, init: e => { e.steal = 4; e.bait = 2; e.fire = 1.6; e.loot = {}; } },
    pulsar:     { r: 10, hp: 150, spd: 12, grow: 0, score: 2600, boss: true, bossHp: 14, init: e => { e.pulse = 1.5; e.beamT = 4; e.spin = 0; } },
  });

  V.GUIDE.push(
    ['juggernaut', 'The Juggernaut', 'Its armoured front blocks every shot. Get around it and hit it from behind.', '#b0b0c0'],
    ['siphon', 'The Siphon', 'Latches a draining tether onto you that heals it. Break it by moving away or dashing.', '#c060ff'],
    ['tempest', 'The Tempest', 'Whips up winds that push you and bend your antibodies.', '#a0e0ff'],
    ['thief', 'The Thief', 'Steals your power-ups and uses them against you. Kill it to get them back.', '#ffd040'],
    ['pulsar', 'The Pulsar', 'Sends out shockwave rings with gaps and spins deadly beams.', '#ff80c0'],
  );

  const final5 = V.BOSS_ORDER.slice(-5), rest = V.BOSS_ORDER.slice(0, -5);
  [['juggernaut', 10], ['siphon', 16], ['tempest', 22], ['thief', 28], ['pulsar', 34]].forEach(([k, i]) => rest.splice(i, 0, k));
  V.BOSS_ORDER.length = 0; V.BOSS_ORDER.push(...rest, ...final5);
  Object.assign(V.BOSSES, {
    juggernaut: { name: 'The Juggernaut', sub: 'Nothing gets through the front' },
    siphon:     { name: 'The Siphon',     sub: 'It feeds on you' },
    tempest:    { name: 'The Tempest',    sub: 'The current turns against you' },
    thief:      { name: 'The Thief',      sub: 'What’s yours is its' },
    pulsar:     { name: 'The Pulsar',     sub: 'Find the gap in every wave' },
  });
  Object.assign(V.FLOOR_MUL, { juggernaut: .6, siphon: .85, tempest: .9, thief: .85, pulsar: .9 });

  Object.assign(V.POW, {
    lance:    { name: 'T-Cell Lance',     color: '#80ffff', desc: 'While you fire, a piercing beam burns everything along your aim. 5s.', weight: 7, time: 5, tier: 2 },
    fission:  { name: 'Fission Shots',    color: '#ffb060', desc: 'Antibodies split into three shards when they hit. 10s.', weight: 9, time: 10 },
    sentinel: { name: 'Sentinel Cells',   color: '#a0ff80', desc: 'Drops four sentinel mines around you that blow up when pathogens come near.', weight: 8, tier: 2 },
    kinase:   { name: 'Kinase Rush',      color: '#ff7070', desc: 'Every kill makes you fire faster, up to double speed. 10s.', weight: 9, time: 10 },
    barrage:  { name: 'Antibody Barrage', color: '#ffe0a0', desc: 'Launches a volley of homing missiles every second. 6s.', weight: 7, time: 6, tier: 2 },
  });
  for (const k of ['lance', 'fission', 'sentinel', 'kinase', 'barrage']) { V.POW_KEYS.push(k); if (k !== 'sentinel') V.STOCKABLE.push(k); }
})();
