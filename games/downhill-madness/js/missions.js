'use strict';
// Three missions at a time. All are "in one run". Every 3 completed missions = rank up.
const MISSION_TPL = [
  { id: 'dist', stat: 'dist', base: 800, step: 500, text: n => `Sled ${U.fmt(n)} m in one run` },
  { id: 'backflips', stat: 'backflips', base: 2, step: 2, text: n => `Land ${n} backflips` },
  { id: 'frontflips', stat: 'frontflips', base: 2, step: 2, text: n => `Land ${n} frontflips` },
  { id: 'spins', stat: 'spins', base: 3, step: 2, text: n => `Spin ${U.fmt(n * 360)}° in total` },
  { id: 'perfects', stat: 'perfects', base: 1, step: 1, text: n => `Stick ${n} perfect landing${n > 1 ? 's' : ''}` },
  { id: 'bowled', stat: 'bowled', base: 5, step: 4, text: n => `Bowl over ${n} snowmen or penguins` },
  { id: 'coins', stat: 'coins', base: 25, step: 15, text: n => `Grab ${n} coins` },
  { id: 'close', stat: 'close', base: 4, step: 3, text: n => `Pull off ${n} close calls` },
  { id: 'kmh', stat: 'kmh', base: 150, step: 30, max: 520, text: n => `Hit ${n} km/h` },
  { id: 'level', stat: 'level', base: 3, step: 1, text: n => `Reach madness level ${n}` },
  { id: 'combo', stat: 'combo', base: 3, step: 1, max: 10, text: n => `Build a ×${n} combo` },
  { id: 'rot', stat: 'rotations', base: 2, step: 1, max: 8, text: n => `Land a ${n}-rotation trick` },
  { id: 'power', stat: 'powerups', base: 1, step: 1, text: n => `Collect ${n} power-up${n > 1 ? 's' : ''}` },
  { id: 'rivals', stat: 'rivals', base: 3, step: 2, text: n => `Overtake or slam ${n} rival sledders` },
  { id: 'air', stat: 'air', base: 2, step: 0.5, max: 6, text: n => `Stay airborne ${n} seconds in one jump` },
  { id: 'crevasse', stat: 'crevasses', base: 1, step: 1, text: n => `Clear ${n} crevasse${n > 1 ? 's' : ''}` },
  { id: 'gates', stat: 'gates', base: 4, step: 3, text: n => `Shoot through ${n} speed gates` },
  { id: 'clean', stat: 'clean', base: 500, step: 300, text: n => `Go ${U.fmt(n)} m without a wipeout` },
  { id: 'abduct', stat: 'abducted', base: 1, step: 0, minRank: 3, text: () => 'Get abducted by aliens' },
  { id: 'demolish', stat: 'demolished', base: 3, step: 2, text: n => `Demolish ${n} obstacles with a rocket` },
];

const RANKS = ['Sled Rookie', 'Bunny Slope Menace', 'Powder Hound', 'Mogul Goblin', 'Gravity Enjoyer',
  'Avalanche Bait', 'Physics Violator', 'Yeti Whisperer', 'Legend of the Mountain', 'Snow Deity'];

function rankName(r) { return RANKS[Math.min(r, RANKS.length) - 1] + (r > RANKS.length ? ` ${r - RANKS.length + 1}` : ''); }

const Missions = {
  tpl(id) { return MISSION_TPL.find(t => t.id === id); },

  ensure() {
    const d = Save.data;
    d.missions = d.missions.filter(m => !m.done && this.tpl(m.id));
    while (d.missions.length < 3) {
      const active = d.missions.map(m => m.id);
      const pool = MISSION_TPL.filter(t => !active.includes(t.id) && (t.minRank || 1) <= d.rank);
      const t = U.pick(pool);
      let target = t.base + t.step * (d.rank - 1) * U.rand(0.8, 1.2);
      if (t.max) target = Math.min(t.max, target);
      target = t.step < 1 ? Math.round(target * 2) / 2 : Math.round(target);
      if (t.id === 'dist' || t.id === 'clean') target = Math.round(target / 50) * 50;
      d.missions.push({ id: t.id, target, done: false });
    }
    Save.write();
  },

  reward() { return 60 + Save.data.rank * 20; },

  check(stats) {
    const d = Save.data;
    for (const m of d.missions) {
      if (m.done) continue;
      const t = this.tpl(m.id);
      if ((stats[t.stat] || 0) >= m.target) {
        m.done = true;
        const coins = this.reward();
        d.bank += coins;
        d.missionsDone++;
        G.missionCoins += coins;
        HUD.pop('MISSION COMPLETE', '#5ee27a', 0.9, `${t.text(m.target)}  ·  +${coins} coins`);
        Sfx.level();
        Voice.say('Mission complete!', 0.65);
        if (d.missionsDone % 3 === 0) {
          d.rank++;
          HUD.banner(`RANK UP: ${rankName(d.rank).toUpperCase()}`, '#5ee27a', 3);
          Voice.say(`Rank up! You are now a ${rankName(d.rank)}!`, 0.9, true);
        }
        Save.write();
      }
    }
  },

  html(stats) {
    return Save.data.missions.map(m => {
      const t = this.tpl(m.id);
      const v = m.done ? m.target : Math.min(m.target, (stats && stats[t.stat]) || 0);
      const pct = Math.round((v / m.target) * 100);
      return `<li class="${m.done ? 'done' : ''}">
        <span class="m-text">${t.text(m.target)}</span>
        <span class="m-bar"><i style="width:${pct}%"></i></span>
        <span class="m-val">${m.done ? `+${this.reward()}` : stats ? `${Math.floor(v * 10) / 10}/${m.target}` : `${this.reward()} coins`}</span>
      </li>`;
    }).join('');
  },
};
