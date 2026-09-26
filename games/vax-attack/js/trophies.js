// Trophies: long-term goals that pay DNA. They listen to the same gameplay events as missions,
// so bot runs and admin-console runs never earn them. Progress is saved per profile with the rest of the meta data.
(() => {
  const V = window.VAX;
  const { t } = V;
  const meta = V.meta, data = meta.data;
  data.ach ??= {};
  data.counters ??= {};
  const C = data.counters;
  const bump = (k, n = 1) => { C[k] = (C[k] || 0) + n; return C[k]; };

  // id, reward (DNA), and a progress reader for counted goals: () => [have, need]
  V.TROPHIES = [
    { id: 'firstBlood', dna: 10 },
    { id: 'wave10', dna: 25 },
    { id: 'wave25', dna: 50 },
    { id: 'wave50', dna: 100 },
    { id: 'wave100', dna: 200 },
    { id: 'prime', dna: 25 },
    { id: 'bosses10', dna: 40, prog: () => [C.bosses || 0, 10] },
    { id: 'bosses50', dna: 120, prog: () => [C.bosses || 0, 50] },
    { id: 'kills1k', dna: 40, prog: () => [C.kills || 0, 1000] },
    { id: 'kills10k', dna: 150, prog: () => [C.kills || 0, 10000] },
    { id: 'combo', dna: 30 },
    { id: 'flawlessBoss', dna: 60 },
    { id: 'untouched10', dna: 80 },
    { id: 'mutant', dna: 20 },
    { id: 'mutants25', dna: 80, prog: () => [C.mutants || 0, 25] },
    { id: 'elites50', dna: 60, prog: () => [C.elites || 0, 50] },
    { id: 'shield', dna: 40 },
    { id: 'twins', dna: 50 },
    { id: 'victory', dna: 150 },
    { id: 'victoryHard', dna: 300 },
    { id: 'rush10', dna: 100 },
    { id: 'shopper', dna: 60, prog: () => [C.atpSpent || 0, 5000] },
  ];
  const find = id => V.TROPHIES.find(a => a.id === id);   // (later files add trophies to the list)
  const T = V.trophies = {
    has: id => !!data.ach[id],
    count: () => Object.keys(data.ach).length,
  };
  function award(id) {
    if (data.ach[id] || !find(id)) return;
    data.ach[id] = Date.now();
    const dna = find(id).dna;
    data.dna += dna; data.earned += dna;
    meta.save();
    V.ui.toast(t('ach.unlocked', { name: t('ach.' + id + '.name'), n: dna }).toLocaleUpperCase(V.i18n.lang), '#ffd23a');
    V.SND.upgrade();
  }
  const checkCounts = () => { for (const a of V.TROPHIES) if (a.prog) { const [h, n] = a.prog(); if (h >= n) award(a.id); } };
  T.check = checkCounts;

  // listen to gameplay events (meta.event does nothing for bot and admin runs, and neither do we)
  const orig = meta.event;
  meta.event = (type, p = {}) => {
    orig(type, p);
    if (!meta.runActive()) return;
    const S = V.G.S, D = S?.diff;
    if (type === 'kill') {
      bump('kills'); award('firstBlood');
      if (p.mutant) { bump('mutants'); award('mutant'); }
      if (p.elite) bump('elites');
    }
    if (type === 'combo' && p.n >= 20) award('combo');
    if (type === 'boss') {
      bump('bosses');
      if (p.type === 'boss') award('prime');
      if (p.type === 'twins' || p.type === 'twins2') award('twins');
      if (!p.hurt) award('flawlessBoss');
      if (S?.mode === 'rush' && S.bossKills >= 10) award('rush10');
    }
    if (type === 'wave' && S?.mode !== 'rush') {
      for (const n of [10, 25, 50, 100]) if (p.wave >= n) award('wave' + n);
      if (p.wave >= 10 && !S.everHit) award('untouched10');
    }
    if (type === 'buy') bump('atpSpent', p.price || 0);
    if (type === 'shield') award('shield');
    if (type === 'victory') { award('victory'); if (D === 'hard' || D === 'nightmare') award('victoryHard'); }
    checkCounts();
    meta.save();
  };

  T.paint = el => {
    const got = T.count(), total = V.TROPHIES.length;
    el.innerHTML = `<p class="set-note">${t('ach.progress', { n: got, total })}</p><div class="trophy-list">` + V.TROPHIES.map(a => {
      const on = T.has(a.id), pr = !on && a.prog ? a.prog() : null;
      const bar = pr ? `<span class="bar"><i style="width:${Math.min(100, Math.round(pr[0] / pr[1] * 100))}%"></i></span><small class="tp-num">${Math.min(pr[0], pr[1]).toLocaleString()} / ${pr[1].toLocaleString()}</small>` : '';
      return `<div class="trophy${on ? ' on' : ''}"><span class="tp-icon" aria-hidden="true">${on ? '🏆' : '🔒'}</span><div><b>${t('ach.' + a.id + '.name')}</b><small>${t('ach.' + a.id + '.desc')}</small>${bar}</div><span class="tp-dna">+${a.dna}</span></div>`;
    }).join('') + '</div>';
  };
})();
