'use strict';
// Permanent achievements. Each pays its coin reward once, the first time it's earned.
const TROPHIES = [
  { id: 'first', name: 'First Descent', desc: 'Finish your first run', reward: 50, check: (st, d) => (d.totals.runs || 0) >= 1 },
  { id: 'km', name: 'Kilometre Club', desc: 'Sled 1,000 m in one run', reward: 100, check: st => st.dist >= 1000 },
  { id: 'km3', name: 'Mountain Goat', desc: 'Sled 3,000 m in one run', reward: 300, check: st => st.dist >= 3000 },
  { id: 'mach', name: 'Sonic Sled', desc: 'Break the sound barrier (343 km/h)', reward: 250, check: st => st.kmh >= 343 },
  { id: 'triple', name: 'Triple Threat', desc: 'Land a 3-rotation trick', reward: 150, check: st => st.rotations >= 3 },
  { id: 'five', name: 'Physics, Who?', desc: 'Land a 5-rotation trick', reward: 400, check: st => st.rotations >= 5 },
  { id: 'perfect5', name: 'Sticky Landings', desc: 'Stick 5 perfect landings in one run', reward: 200, check: st => st.perfects >= 5 },
  { id: 'king', name: 'Regicide', desc: 'Survive the Yeti King', reward: 300, check: st => st.bosses >= 1 },
  { id: 'fever', name: 'Pure Madness', desc: 'Trigger Madness Mode', reward: 200, check: st => st.fevers >= 1 },
  { id: 'rail', name: 'Rail Rat', desc: 'Grind 10 seconds in one run', reward: 200, check: st => st.grind >= 10 },
  { id: 'bowl', name: 'Bowling Champion', desc: 'Bowl over 25 things in one run', reward: 200, check: st => st.bowled + st.demolished >= 25 },
  { id: 'abduct', name: 'Frequent Flyer', desc: 'Get abducted by aliens', reward: 150, check: st => st.abducted >= 1 },
  { id: 'cannon', name: 'Human Cannonball', desc: 'Get fired out of a cannon', reward: 150, check: st => st.cannon >= 1 },
  { id: 'cosmic', name: 'Cosmic Traveller', desc: 'Reach madness level 8', reward: 300, check: st => st.level >= 8 },
  { id: 'rich', name: 'Snow Tycoon', desc: 'Have 5,000 coins in the bank', reward: 300, check: (st, d) => d.bank >= 5000 },
  { id: 'hoard', name: 'Garage Hoarder', desc: 'Own 6 sleds', reward: 400, check: (st, d) => SLEDS.filter(s => d.owned[s.id]).length >= 6 },
];

const Trophies = {
  count() { const tr = Save.data.trophies || {}; return TROPHIES.filter(t => tr[t.id]).length; },

  check(stats) {
    const d = Save.data, st = stats || {};
    d.trophies = d.trophies || {};
    for (const t of TROPHIES) {
      if (d.trophies[t.id]) continue;
      let ok = false;
      try { ok = t.check(st, d); } catch (e) { ok = false; }
      if (!ok) continue;
      d.trophies[t.id] = true;
      d.bank += t.reward;
      if (typeof G !== 'undefined') G.missionCoins = (G.missionCoins || 0) + t.reward;
      HUD.pop(`TROPHY: ${t.name.toUpperCase()}`, '#ffd23f', 0.9, `${t.desc}  ·  +${t.reward} coins`);
      Sfx.record();
      Save.write();
    }
  },

  render() {
    const d = Save.data;
    d.trophies = d.trophies || {};
    document.getElementById('trophy-count').textContent = `${this.count()} / ${TROPHIES.length}`;
    document.getElementById('trophy-grid').innerHTML = TROPHIES.map(t => {
      const got = !!d.trophies[t.id];
      return `<article class="trophy ${got ? 'got' : ''}">
        <span class="medal" aria-hidden="true">${got ? '★' : '?'}</span>
        <div><h3>${t.name}</h3><p>${t.desc}</p><p class="reward">${got ? 'Earned' : `${t.reward} coins`}</p></div>
      </article>`;
    }).join('');
  },
};
