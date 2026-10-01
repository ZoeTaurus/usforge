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
  { id: 'king', name: 'Boss Survivor', desc: 'Survive a boss fight', reward: 300, check: st => st.bosses >= 1 },
  { id: 'regicide', name: 'Regicide', desc: 'Defeat a boss before it escapes', reward: 400, check: st => st.bossKills >= 1 },
  { id: 'slayer', name: 'Boss Slayer', desc: 'Defeat all four bosses (over any runs)', reward: 1000, check: (st, d) => Object.keys(d.bossesBeaten || {}).length >= 4 },
  { id: 'fever', name: 'Pure Madness', desc: 'Trigger Madness Mode', reward: 200, check: st => st.fevers >= 1 },
  { id: 'rail', name: 'Rail Rat', desc: 'Grind 10 seconds in one run', reward: 200, check: st => st.grind >= 10 },
  { id: 'bowl', name: 'Bowling Champion', desc: 'Bowl over 25 things in one run', reward: 200, check: st => st.bowled + st.demolished >= 25 },
  { id: 'abduct', name: 'Frequent Flyer', desc: 'Get abducted by aliens', reward: 150, check: st => st.abducted >= 1 },
  { id: 'cannon', name: 'Human Cannonball', desc: 'Get fired out of a cannon', reward: 150, check: st => st.cannon >= 1 },
  { id: 'eagle', name: 'The Eagle Has Landed', desc: 'Fly 120 m off a ski jump', reward: 300, check: st => st.jump >= 120 },
  { id: 'speller', name: 'Spelling Bee', desc: 'Spell M-A-D-N-E-S-S in one run', reward: 400, check: st => st.words >= 1 },
  { id: 'tourist', name: 'World Tourist', desc: 'Reach the Haunted Woods', reward: 300, check: st => st.zones >= 3 },
  { id: 'ten', name: 'Judges Love You', desc: 'Get a perfect 10 from a judge', reward: 200, check: st => st.judge10 >= 1 },
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
