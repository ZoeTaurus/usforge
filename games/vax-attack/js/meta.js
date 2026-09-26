// Meta progression that persists between runs: DNA, the Research Lab, missions, difficulty unlocks and the Daily Challenge.
(() => {
  const V = window.VAX;
  const { t } = V;
  const meta = V.meta = {};
  const KEY = V.profile.key('vax-attack-meta');   // one save per signed-in profile

  const fresh = () => ({
    dna: 0, earned: 0, lab: {}, missions: [], missionsDone: 0,
    best: { chill: 0, normal: 0, hard: 0, nightmare: 0 },
    unlocked: { chill: true, normal: true, hard: false, nightmare: false },
    daily: { date: '', best: 0, played: false },
    counters: {}, xp: 0, vl: 0, vlMax: 0,
  });
  let data = fresh();
  try { data = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
  meta.data = data;
  // saves from before levels existed: past DNA counts as XP, and a wave-15 run already unlocks Viral Load 1
  if (!data.xpInit) { data.xpInit = 1; data.xp = Math.max(data.xp || 0, data.earned || 0); if (!data.vlMax && Math.max(0, ...Object.values(data.best)) >= 15) data.vlMax = 1; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} };
  meta.save = save;

  // ---------- Research Lab ----------
  meta.level = id => data.lab[id] || 0;
  meta.labDef = id => V.LAB.find(l => l.id === id);
  meta.cost = id => { const d = meta.labDef(id), lv = meta.level(id); return lv < d.cost.length ? d.cost[lv] : null; };
  meta.buy = id => {
    const c = meta.cost(id);
    if (c === null || data.dna < c) return false;
    data.dna -= c; data.lab[id] = meta.level(id) + 1; save();
    return true;
  };
  // what the Lab does to a fresh run
  meta.applyLab = (S, P) => {
    P.max += meta.level('vial'); P.hp = P.max;
    S.atp += meta.level('kit') * 25;
    P.dmg *= 1 + .06 * meta.level('potency');
    S.atpMul *= 1 + .12 * meta.level('salvage');
    P.dashMul *= Math.pow(.88, meta.level('reflex'));
    if (meta.level('shield')) P.shield = 1;
    if (meta.level('insight')) S.choices += 1;
    if (meta.level('revive')) P.revive = 1;
  };
  meta.cheapest = () => V.LAB.map(l => ({ id: l.id, cost: meta.cost(l.id) })).filter(l => l.cost !== null).sort((a, b) => a.cost - b.cost)[0] || null;

  // ---------- unlocks ----------
  meta.isUnlocked = diff => !!data.unlocked[diff];
  function checkUnlocks() {
    const newly = [];
    for (const [diff, req] of Object.entries(V.UNLOCK)) {
      if (!data.unlocked[diff] && data.best[req.diff] >= req.wave) { data.unlocked[diff] = true; newly.push(diff); }
    }
    return newly;
  }

  // ---------- daily challenge (same seed and rule changes for everyone on a given day) ----------
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const hash = str => { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const mulberry = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let x = Math.imul(seed ^ seed >>> 15, 1 | seed); x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; };
  meta.daily = () => {
    const date = today(), rng = mulberry(hash('vax' + date)), keys = Object.keys(V.MUTATORS);
    const a = keys[Math.floor(rng() * keys.length)];
    let b = a; while (b === a) b = keys[Math.floor(rng() * keys.length)];
    if (data.daily.date !== date) { data.daily = { date, best: 0, played: false }; save(); }
    return { date, seed: hash('run' + date), mutators: [a, b], best: data.daily.best, played: data.daily.played };
  };
  const realRandom = Math.random;
  meta.seed = seed => { Math.random = mulberry(seed); };
  meta.unseed = () => { Math.random = realRandom; };

  // ---------- missions ----------
  const missionKey = m => m.kind + ':' + JSON.stringify(m.param);
  function newMission() {
    const taken = new Set(data.missions.map(m => m.kind));
    const pool = V.MISSIONS.filter(tpl => !taken.has(tpl.kind));
    const tpl = pool[Math.floor(realRandom() * pool.length)] || V.MISSIONS[0];
    const i = Math.floor(realRandom() * tpl.params.length), param = tpl.params[i];
    const target = tpl.kind === 'kill' ? param[1] : ['reach', 'flawless', 'boss', 'nodash'].includes(tpl.kind) ? 1 : param;
    return { kind: tpl.kind, param, target, prog: 0, reward: Math.round(tpl.reward(Array.isArray(param) ? param[1] : param, i)) };
  }
  while (data.missions.length < 3) data.missions.push(newMission());
  save();

  meta.missionText = m => {
    const n = Array.isArray(m.param) ? m.param[1] : m.param;
    switch (m.kind) {
      case 'reach': return t('m.reach', { n });
      case 'boss': return t('m.boss', { name: V.tx.bossName(m.param) });
      case 'kill': return t('m.kill', { n, name: V.tx.enemy(m.param[0]) });
      case 'flawless': return t('m.flawless', { n });
      case 'combo': return t('m.combo', { n });
      case 'shop': return t('m.shop', { n });
      case 'nodash': return t('m.nodash');
      case 'elite': return t('m.elite', { n });
      case 'mutant': return t('m.mutant', { n });
    }
    return m.kind;
  };

  let run = null;   // per-run tracking (null for bot runs and admin-console runs)
  meta.cheat = () => { run = null; };
  meta.runActive = () => !!run;
  meta.startRun = S => {
    run = S.bot ? null : { S, completed: [], missionDNA: 0, prevBest: S.mode === 'rush' ? V.ui.stats.bestRush : data.best[S.diff] || 0 };
  };
  function complete(m) {
    data.dna += m.reward; data.earned += m.reward; data.missionsDone++;
    run.missionDNA += m.reward; run.completed.push({ mission: m, reward: m.reward });
    V.ui.toast(t('m.done', { text: meta.missionText(m), n: m.reward }).toLocaleUpperCase(V.i18n.lang), '#ffd23a');
    V.SND.clear();
    data.missions = data.missions.filter(x => x !== m);
    data.missions.push(newMission());
  }
  // gameplay reports what happened; missions listen
  meta.event = (type, p = {}) => {
    if (!run) return;
    for (const m of [...data.missions]) {
      let done = false;
      if (type === 'kill' && m.kind === 'kill' && p.type === m.param[0]) m.prog++;
      if (type === 'kill' && m.kind === 'elite' && p.elite) m.prog++;
      if (type === 'kill' && m.kind === 'mutant' && p.mutant) m.prog++;
      if (type === 'buy' && m.kind === 'shop') m.prog++;
      if (type === 'wave' && m.kind === 'reach' && p.wave >= m.param) done = true;
      if (type === 'wave' && m.kind === 'flawless' && p.wave >= m.param && !p.hit) done = true;
      if (type === 'boss' && m.kind === 'boss' && p.type === m.param) done = true;
      if (type === 'boss' && m.kind === 'nodash' && !p.dashed) done = true;
      if (type === 'combo' && m.kind === 'combo' && p.n >= m.param) done = true;
      if (done || m.prog >= m.target && ['kill', 'elite', 'mutant', 'shop', 'combo'].includes(m.kind) && m.prog > 0) complete(m);
    }
    save();
  };

  // ---------- account level (XP from every run) + Viral Load (opt-in extra difficulty for Waves) ----------
  const need = L => 120 + L * 45;   // XP from level L to L+1
  meta.lvl = (xp = data.xp) => { let L = 1; while (xp >= need(L)) { xp -= need(L); L++; } return { L, into: xp, need: need(L) }; };
  meta.VL_MAX = 10;
  meta.vl = () => Math.min(data.vl || 0, data.vlMax || 0);
  meta.setVl = n => { data.vl = Math.max(0, Math.min(data.vlMax || 0, n)); save(); };
  // what a Viral Load level does to the difficulty numbers
  meta.applyVl = (D, vl) => {
    if (!vl) return;
    D.enemyHp *= 1 + .1 * vl; D.bossHp *= 1 + .08 * vl; D.enemySpd *= 1 + .02 * vl; D.toxinSpd *= 1 + .03 * vl;
    D.fire *= Math.max(.6, 1 - .035 * vl); D.elite += .012 * vl; D.smart = Math.min(1, D.smart + .04 * vl);
  };

  // ---------- beating Patient Zero ----------
  meta.victory = S => {
    data.wins ??= {};
    const first = !Object.values(data.wins).some(n => n > 0);
    data.wins[S.diff] = (data.wins[S.diff] || 0) + 1;
    const dna = first ? 250 : 50;
    data.dna += dna; data.earned += dna;
    data.cos ??= { skins: ['classic'], scenes: ['blood'], skin: 'classic', scene: 'blood' };
    const skin = !data.cos.skins.includes('champion');
    if (skin) data.cos.skins.push('champion');
    save();
    return { first, dna, skin, times: data.wins[S.diff] };
  };

  // ---------- end of run: bank DNA, records, unlocks ----------
  meta.endRun = S => {
    if (!run || run.S !== S) return null;
    const D = V.DIFFICULTY[S.diff];
    const cleared = S.phase === 'fight' ? S.wave - 1 : S.wave;
    const base = cleared * V.DNA.perWave + S.bossKills * V.DNA.perBoss + Math.floor(S.kills / V.DNA.perKills);
    const daily = S.mode === 'daily';
    const firstDaily = daily && !data.daily.played;
    const vl = S.vl || 0, vlMul = 1 + .2 * vl;
    const dna = Math.round(base * D.dna * (firstDaily ? 2 : 1) * vlMul);
    data.dna += dna; data.earned += dna;
    // XP: every run moves the account bar, even a bad one
    const xp = Math.round((cleared * 12 + S.bossKills * 60 + Math.floor(S.kills / 8) + 10) * (.6 + .4 * D.dna) * vlMul);
    const lvFrom = meta.lvl().L;
    data.xp = (data.xp || 0) + xp;
    const lv = meta.lvl();
    let lvDna = 0;
    for (let L = lvFrom + 1; L <= lv.L; L++) lvDna += L % 5 === 0 ? 100 : 25;
    data.dna += lvDna; data.earned += lvDna;
    // Viral Load: reaching wave 15 at your highest load unlocks the next
    let vlUp = 0;
    if (S.mode === 'waves' && vl === (data.vlMax || 0) && vl < meta.VL_MAX && S.wave >= 15) { data.vlMax = vl + 1; vlUp = vl + 1; }
    // records
    let isNewBest = false;
    if (S.mode !== 'rush' && S.wave > (data.best[S.diff] || 0)) { data.best[S.diff] = S.wave; isNewBest = S.wave > run.prevBest; }
    if (daily) { data.daily.played = true; if (S.score > data.daily.best) data.daily.best = S.score; }
    const unlocked = checkUnlocks();
    save();
    // "so close" nudges
    const reached = S.mode === 'rush' ? V.ui.bossesBeaten(S) : S.wave, best = run.prevBest;
    let nudge = null;   // stored as a translation key so the summary re-renders in any language
    if (isNewBest) nudge = ['over.nudgeBest'];
    else if (best > 0 && best - reached <= 3) nudge = [S.mode === 'rush' ? 'over.nudgeRush' : 'over.nudgeWave', { n: best - reached, best }];
    const next = meta.cheapest();
    const out = { dna, xp, lvFrom, lv, lvDna, vl, vlUp, firstDaily, missionDNA: run.missionDNA, completed: run.completed, unlocked, nudge, next, total: data.dna };
    run = null;
    return out;
  };
})();
