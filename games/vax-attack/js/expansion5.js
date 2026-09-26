// Expansion 5 (data): twelve new adaptations and the synergies that combine them. Behaviour in expansion5-ai.js.
(() => {
  const V = window.VAX;

  V.UPGRADES.push(
    { id: 'enzyme',     name: 'Enzyme Tips',       desc: 'Antibodies punch through one more pathogen per level.', max: 2, apply: P => { P.pierceN = (P.pierceN || 0) + 1; } },
    { id: 'execute',    name: 'Complement Tag',    desc: 'Deal 60% more damage to pathogens below a third of their health.', max: 1, apply: P => { P.execute = 1.6; } },
    { id: 'bossbane',   name: 'Targeted Therapy',  desc: 'Deal 20% more damage to bosses.', max: 3, apply: P => { P.bossMul = (P.bossMul || 1) + .2; } },
    { id: 'thorns',     name: 'Spiked Capsid',     desc: 'Getting hit (even on a shield) fires a ring of piercing antibodies.', max: 1, tier: 2, apply: P => { P.thorns = 1; } },
    { id: 'dashnova',   name: 'Shockwave Dash',    desc: 'Dashes end in a shockwave that hurts pathogens and pops toxins nearby.', max: 2, apply: P => { P.dashNova = (P.dashNova || 0) + 1; } },
    { id: 'overdrive',  name: 'Overdrive',         desc: 'Every 8th shot is a huge piercing antibody for 5× damage (every 5th at level 2).', max: 2, tier: 2, apply: P => { P.overdrive = (P.overdrive || 0) + 1; } },
    { id: 'leech',      name: 'Plasma Memory',     desc: 'Heal 1 every 45 kills (every 30 at level 2).', max: 2, apply: P => { P.leech = (P.leech || 0) + 1; } },
    { id: 'luck',       name: 'Lucky Mutation',    desc: 'Pathogens drop power-ups 35% more often.', max: 2, apply: P => { P.luck = (P.luck || 1) + .35; } },
    { id: 'metab',      name: 'Metabolism',        desc: 'Collect 25% more ATP.', max: 3, apply: (P, S) => { S.atpMul *= 1.25; } },
    { id: 'mucus',      name: 'Mucus Layer',       desc: 'Each hit has a 15% chance to slide right off you.', max: 2, tier: 2, apply: P => { P.mucus = (P.mucus || 0) + .15; } },
    { id: 'laststand',  name: 'Last Stand',        desc: 'An extra life: the first hit that would knock you out leaves you on 1 immunity instead, with 2.5s of invulnerability. Works once per run (on top of the Lab’s Second Wind).', max: 1, tier: 2, apply: P => { P.lastStand = 1; } },
    { id: 'twitch',     name: 'Quick Reflexes',    desc: 'Your dash recharges 20% faster.', max: 2, apply: P => { P.dashMul *= .8; } },
  );

  // Two adaptations together unlock a bonus. needs: { upgradeId: level }
  V.SYNERGIES = [
    { id: 'bloodbath', needs: { execute: 1, leech: 1 },     name: 'Bloodbath',     desc: 'Kills on wounded pathogens count double toward Plasma Memory.' },
    { id: 'railgun',   needs: { overdrive: 1, enzyme: 1 },  name: 'Railgun',       desc: 'Overdrive shots hit for 8× and fly twice as fast.' },
    { id: 'bulwark',   needs: { thorns: 1, memory: 1 },     name: 'Bulwark',       desc: 'Spiked Capsid fires twice as many antibodies and you stay safe a moment longer.' },
    { id: 'blitz',     needs: { dashnova: 1, twitch: 1 },   name: 'Blitz',         desc: 'Bigger shockwaves, and every shockwave kill recharges your dash.' },
    { id: 'jackpot',   needs: { luck: 1, metab: 1 },        name: 'Jackpot',       desc: 'Power-ups last 25% longer, and elites always drop one.' },
    { id: 'hunter',    needs: { permHoming: 1, bossbane: 1 }, name: 'Hunter-Killer', desc: 'Your homing antibodies deal 25% more damage to bosses.' },
    { id: 'fortress',  needs: { hp: 2, regen: 1 },          name: 'Fortress',      desc: 'Heal 2 at the start of every wave instead of 1.' },
    { id: 'twinfang',  needs: { multi: 1, dmg: 2 },         name: 'Twin Fang',     desc: 'Your extra Bivalent antibodies hit as hard as the main one.' },
  ];

  V.TROPHIES_MORE = [
    { id: 'syn1', dna: 30, prog: d => [(d.syn || []).length, 1] },
    { id: 'synAll', dna: 200, prog: d => [(d.syn || []).length, V.SYNERGIES.length] },
    { id: 'streak7', dna: 100, prog: d => [d.streak?.best || 0, 7] },
    { id: 'level10', dna: 60, prog: () => [V.meta.lvl().L, 10] },
    { id: 'level25', dna: 150, prog: () => [V.meta.lvl().L, 25] },
    { id: 'viral5', dna: 120, prog: d => [d.vlMax || 0, 5] },
  ];
})();
