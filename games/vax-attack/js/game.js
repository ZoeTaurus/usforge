// Game state, waves, spawning, combat and pathogen behaviour.
(() => {
  const V = window.VAX;
  const { W, H, TOP, BOT, TAU, rnd, clamp } = V;
  const G = V.G = { mode: 'title', S: null, P: null, clock: 0, dieT: 0 };
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const shake = t => { if (!calm.matches && V.ui.shake) G.S.shake = Math.max(G.S.shake, t); };
  const game = V.game = {};
  const { t, tx } = V;
  const angDiff = (a, b) => ((a - b + Math.PI * 3) % TAU + TAU) % TAU - Math.PI;   // signed a − b, wrapped to ±π
  const up = s => s.toLocaleUpperCase(V.i18n.lang);

  // Ambient bloodstream — drifts on every screen, including the title.
  G.cells = Array.from({ length: 16 }, () => ({ x: rnd(0, W), y: rnd(TOP + 4, BOT - 4), v: rnd(6, 18) }));
  G.flecks = Array.from({ length: 40 }, () => ({ x: rnd(0, W), y: rnd(TOP, BOT), v: rnd(10, 30) }));

  function newGame(bot) {
    const mode = ['rush', 'daily'].includes(V.ui.gameMode) ? V.ui.gameMode : 'waves';
    const diff = mode === 'daily' ? 'normal' : V.ui.diff;   // everyone plays the daily on the same terms
    // the daily challenge's rule changes, merged into one modifier object
    const daily = mode === 'daily' ? V.meta.daily() : null;
    const M = {};
    for (const k of daily ? daily.mutators : []) for (const [f, v] of Object.entries(V.MUTATORS[k])) M[f] = typeof v === 'number' && M[f] ? M[f] * v : v;
    if (daily && !bot) V.meta.seed(daily.seed);
    const base = V.DIFFICULTY[diff];
    const D = Object.assign({}, base, { count: base.count * (M.count || 1), enemySpd: base.enemySpd * (M.speed || 1), drop: base.drop * (M.drop || 1),
      elite: base.elite * (M.elite || 1), bossEvery: M.bossEvery || 5 });
    G.S = { D, M, diff, mode, bot, daily, wave: 0, bossKills: 0, atpMul: M.atp || 1, choices: 3 + (M.choices || 0), waveHit: false, bossDash: false, level: 1, score: 0, kills: 0, shake: 0, queue: [], spawnT: 0, phase: 'next', waveT: 1.2,
      combo: 0, comboT: 0, bestCombo: 0, fired: false, hintT: 0, primed: false, justPrimed: false, atp: 0, buys: {}, stock: [], mines: [], brk: null, orbs: [], phages: [], ghosts: [], allies: [], enemies: [], bullets: [], toxins: [], parts: [], pickups: [], floaters: [] };
    G.P = { x: 40, y: H / 2, hp: D.hp, max: D.hp, inv: 1.5, fireT: 0, bob: 0, aim: 0, shield: 0,
      fx: { spread: 0, rapid: 0, pierce: 0, speed: 0, homing: 0, neutro: 0, macro: 0, freeze: 0, vitc: 0, atp: 0, il2: 0, complement: 0, fever: 0, bounce: 0, mega: 0, halo: 0, antitox: 0, nk: 0, clone: 0 },
      dashT: 0, dashing: 0, dashInv: 0, dvx: 0, dvy: 0, feverT: 0,
      rate: .2, dmg: 1, spd: 80, magnet: 18, dur: 1, multi: 1, waveShield: false, waveHeal: false, upg: {}, perm: {}, dashMul: 1, revive: 0 };
    if (!bot) V.meta.applyLab(G.S, G.P);
    if (!bot && mode === 'waves') { G.S.vl = V.meta.vl(); V.meta.applyVl(D, G.S.vl); }
    const P = G.P;
    if (M.maxHp) P.max = M.maxHp;
    if (M.hpDelta) P.max = Math.max(1, P.max + M.hpDelta);
    if (M.dmg) P.dmg *= M.dmg;
    P.hp = P.max;
    // Boss Rush opens straight onto a starting adaptation
    if (mode === 'rush') { G.S.phase = 'clear'; G.S.waveT = .5; }
    V.ui.hud(true);
  }

  // bot = true starts a watch-the-bot run
  game.start = (bot = false) => {
    if (G.mode === 'pause') { V.ui.recordRun(G.S); V.meta.endRun(G.S); V.ui.save('run', null); } // restarting from the pause menu still counts the run
    V.meta.unseed();
    V.audio.init(); V.home.close(); V.input.release();
    G.bot = !!bot; newGame(G.bot); V.bot.onStart(G.bot); V.meta.startRun(G.S);
    if (G.S.daily) V.ui.banner(V.t('daily.title'), G.S.daily.mutators.map(k => V.t('mut.' + k)).join(' · '));
    G.mode = 'play'; V.ui.show(null); V.loop.resetClock();
  };
  game.pause = () => { if (G.mode !== 'play') return; G.mode = 'pause'; V.input.release(); V.ui.showPause(); };
  game.resume = () => { G.mode = 'play'; V.ui.show(null); V.loop.resetClock(); };
  game.toTitle = () => {
    // quitting a saved Waves run keeps it for "Continue"; anything else counts as finished
    if (G.mode === 'pause' && !(G.S.saved && V.ui.load('run', null))) { V.ui.recordRun(G.S); V.meta.endRun(G.S); }
    V.meta.unseed();
    V.music.setIntense(false);
    G.mode = 'title'; G.S = null; G.P = null; G.bot = false; V.bot.onStart(false); V.input.release(); V.ui.resetHud(); V.ui.show(null); V.home.open();
  };
  function gameOver() {
    const { S } = G;
    G.mode = 'over';
    // the bot's runs never touch your records
    V.ui.save('run', null);   // this run is over — nothing to continue
    const isBest = !S.bot && !S.cheated && S.score > V.ui.best; if (isBest) { V.ui.best = S.score; V.ui.saveBest(); }
    if (!S.bot) V.ui.recordRun(S);
    const summary = V.meta.endRun(S);
    V.meta.unseed();
    V.ui.hud(true);
    V.ui.showOver(S, isBest, summary);
  }

  // ---------- waves & upgrades ----------
  // ---------- saved runs: a snapshot at the start of every wave, so closing the tab never loses a long run ----------
  const canSave = S => S.mode === 'waves' && !S.bot && !S.cheated;
  const SKIP = ['enemies', 'bullets', 'toxins', 'parts', 'pickups', 'floaters', 'orbs', 'mines', 'ghosts', 'phages', 'queue'];
  // effects that only live for a moment (and a heat map that's rebuilt as you play) aren't worth saving
  const FLEETING = ['rings', 'traps', 'omens', 'beams', 'webs', 'heat', 'wind', 'windWarn', 'howls', 'shock', 'zaps', 'lanceOn', 'slowT', 'stopT', 'kickX', 'kickY'];
  function snapshot(n) {
    const { S, P } = G, s = {};
    for (const [k, v] of Object.entries(S)) if (!SKIP.includes(k) && !FLEETING.includes(k)) s[k] = v;
    s.allies = S.allies.filter(a => a.perm).map(({ x, y, t, perm }) => ({ x, y, vx: 0, vy: 0, t, perm }));
    s.brk = null;
    try { V.ui.save('run', { v: 1, n, S: JSON.parse(JSON.stringify(s)), P: JSON.parse(JSON.stringify(P)), at: Date.now() }); S.saved = true; } catch (e) {}
  }
  game.savedRun = () => { const r = V.ui.load('run', null); return r && r.v === 1 ? r : null; };
  game.continueRun = () => {
    const r = game.savedRun(); if (!r) return;
    V.ui.gameMode = 'waves'; V.ui.diff = r.S.diff;
    game.start(false);
    const { S } = G;
    Object.assign(S, r.S, Object.fromEntries(SKIP.map(k => [k, []])), { phase: 'next', waveT: 1, wave: r.n - 1, saved: true });
    Object.assign(G.P, r.P, { inv: 2, x: 40, y: H / 2, px: undefined });
    V.meta.startRun(S);
    V.ui.banner(t('run.continued'), t('ban.wave', { n: r.n })); V.ui.hud(true);
  };

  function startWave(n) {
    const { S, P } = G;
    if (canSave(S) && n > 1) snapshot(n);
    S.wave = n; S.phase = 'fight'; S.flowX = 0; S.sq = 0; S.walls = [];
    S.waveHit = false;
    if (P.waveShield) P.shield = Math.max(P.shield, 1);
    if (P.waveHeal && n > 1) P.hp = Math.min(P.max, P.hp + (P.syn?.fortress ? 2 : 1));
    for (const k of S.stock) { collect(k, true); P.fx[k] *= V.SHOP.stock.boost; }
    S.stock = [];
    if (S.mode === 'rush') {
      // one boss per round, getting tougher each time; patch up a little between fights
      const type = V.bossFor(n);
      S.level = V.RUSH.baseLevel + (n - 1) * V.RUSH.levelPerRound;
      S.queue = [type]; S.spawnT = 1.2;
      if (n > 1) P.hp = Math.min(P.max, P.hp + V.RUSH.healBetween);
      V.ui.banner(t('ban.boss', { n }), t('ban.bossSub', { name: tx.bossName(type), sub: tx.bossSub(type) })); V.SND.boss();
    } else {
      S.level = n;
      S.queue = V.waveList(n, S.D);
      const bossWave = n % S.D.bossEvery === 0;
      S.spawnT = bossWave ? 1.8 : 1;
      const sub = bossWave ? t('ban.bossSub', { name: tx.bossName(S.queue[0]), sub: tx.bossSub(S.queue[0]) }) : (V.WAVE_SUBS[n] ? t('wave.' + n) : t('ban.rising'));
      V.ui.banner(bossWave ? t('ban.bossWave') : t('ban.wave', { n }), sub);
      bossWave ? V.SND.boss() : V.SND.wave();
    }
    // the final five bosses get a cinematic entrance before they arrive
    const bt = S.queue.length === 1 && V.ENEMIES[S.queue[0]]?.boss ? S.queue[0] : null, fi = bt ? V.BOSS_ORDER.slice(-5).indexOf(bt) : -1;
    if (fi >= 0) {
      S.intro = { t: 0, dur: bt === 'zero' ? 4.8 : 3.6, type: bt, n: fi + 1, beat: .2 };
      S.spawnT = S.intro.dur; S.toxins.length = 0;
      V.ui.bossIntro(S.intro); V.SND.drone(S.intro.dur);
    }
    V.ui.hud(true);
  }
  function stepIntro(S, dt) {
    const I = S.intro; if (!I) return;
    I.t += dt; I.beat -= dt;
    if (I.beat <= 0 && I.t < I.dur - .3) { I.beat = Math.max(.28, .8 - I.t * .14); V.SND.thump(); shake(.08 + I.t * .03); }   // the heartbeat speeds up
    if (I.t >= I.dur) { S.intro = null; V.ui.bossIntro(null); V.SND.boss(); shake(.55); V.ui.banner(tx.bossName(I.type), tx.bossSub(I.type)); }
  }

  // ---------- victory: Patient Zero is down ----------
  function victory() {
    const { S, P } = G;
    if (S.won) return;
    S.won = true; S.victoryT = 3.2; S.fwT = 0;
    for (const e of S.enemies) if (e.hp > 0) kill(e, true);   // the outbreak collapses with its source
    S.enemies = []; S.queue = []; S.toxins = []; S.mines = [];
    P.inv = 99; V.music.setIntense(false); V.SND.clear();
    V.ui.banner(t('vic.banner'), t('vic.bannerSub'));
  }
  function stepVictory(S, dt) {
    S.victoryT -= dt; S.fwT -= dt;
    if (S.fwT <= 0) {   // fireworks in antibody colours
      S.fwT = .16;
      const x = rnd(30, W - 30), y = rnd(TOP + 20, BOT - 20), cols = [['#7fe0d4', '#fff'], ['#ffd23a', '#fff'], ['#ff7ac8', '#fff'], ['#9cf04a', '#fff']][Math.floor(rnd(0, 4))];
      burst(x, y, 26, cols, 80); if (Math.random() < .5) V.SND.pop();
    }
    if (S.victoryT <= 0) {
      S.victoryDone = true;
      V.meta.event('victory');
      const reward = S.bot || S.cheated ? null : V.meta.victory(S);
      G.mode = 'victory'; G.P.inv = 1.5;
      V.ui.showVictory(S, reward);
    }
  }
  game.keepGoing = () => {   // endless mode after the credits
    if (G.mode !== 'victory') return;
    G.mode = 'play'; V.ui.show(null);
    G.S.phase = 'clear'; G.S.waveT = 1; V.loop.resetClock();
  };
  game.victoryHome = () => {
    if (G.mode !== 'victory') return;
    G.mode = 'pause'; G.S.saved = false; V.ui.save('run', null); game.toTitle();
  };

  // three adaptation choices; before Influenza Prime falls there are no tier-2 ones and stackables are capped low
  game.rollChoices = () => {
    const { P, S } = G;
    const cap = u => S.primed ? u.max : (u.earlyMax ?? u.max);
    const allowed = u => (S.primed || u.tier !== 2) && (P.upg[u.id] || 0) < cap(u) && S.level >= (u.minWave || 0);
    return V.UPGRADES.filter(allowed).sort(() => Math.random() - .5).slice(0, S.choices);
  };
  function offerUpgrades() {
    const { S } = G;
    G.mode = 'upgrade';
    V.input.release();
    const choices = game.rollChoices();
    const stockable = V.STOCKABLE.filter(k => (S.primed || V.POW[k].tier !== 2) && S.level >= (V.POW[k].minWave || 0)).sort(() => Math.random() - .5);
    S.brk = { choices, picked: !choices.length, pickedId: null, rerolls: 0, extraUsed: false, stockOffer: stockable.slice(0, 3), stocked: [] };
    const title = S.mode === 'rush' ? (S.wave ? 'brk.bossDefeated' : 'brk.opener') : 'brk.waveCleared';
    V.ui.openBreak(title, { n: S.wave }, S.primed, S.justPrimed);
    S.justPrimed = false;
  }
  game.applyUpgrade = u => {
    const { S, P } = G, b = S.brk;
    if (!b || b.picked) return;
    u.apply(P, S); P.upg[u.id] = (P.upg[u.id] || 0) + 1; V.MOD?.upgraded?.(u);
    b.picked = true; b.pickedId = u.id;
    V.SND.upgrade(); V.ui.toast(up(t('toast.adapted', { name: tx.upg(u.id) })), '#7fe0d4');
    V.ui.hud(true); V.ui.renderBreak();
  };
  game.continueWave = () => {
    const { S } = G;
    // (with every adaptation maxed there's nothing to pick — you can always move on then)
    if (G.mode !== 'upgrade' || (!S.brk.picked && S.brk.choices.length)) return;
    G.mode = 'play'; V.ui.show(null);
    S.phase = 'next'; S.waveT = 1.4; S.brk = null;
    V.loop.resetClock(); V.ui.hud(true);
  };

  // ---------- spawning ----------
  // Pathogens enter from the far side of the vessel, well away from the player.
  function edgePoint() {
    const { P } = G;
    let side = P.x < W / 2 ? 1 : -1;
    if (Math.random() < .2) side = -side;
    let x = side > 0 ? W + rnd(26, 46) : -rnd(26, 46);
    if (Math.abs(x - P.x) < 130) x = side > 0 ? -rnd(26, 46) : W + rnd(26, 46);
    let y = rnd(TOP + 14, BOT - 14);
    if (Math.abs(y - P.y) < 30) y = clamp(P.y + (y < P.y ? -40 : 40), TOP + 14, BOT - 14);
    return [x, y];
  }

  // The director: packs arrive a little slower while you're on your last hearts, a little faster while you're cruising untouched
  function pace(S, P) {
    if (P.hp <= Math.max(1, Math.floor(P.max * .34))) return 1.3;
    return (S.calm || 0) > 30 ? .82 : 1;
  }
  // How much a pathogen matters right now — allies, homing shots and the bot all pick targets by this
  const DANGER = new Set(['tetanus', 'bug', 'adeno', 'polio', 'hanta', 'corona', 'mumps', 'hepb', 'candida', 'mimi', 'variola', 'mers', 'klebs']);
  const ATTACKING = new Set(['tele', 'aim', 'dash', 'lunge', 'leap', 'dart', 'swoop', 'rise']);
  game.threat = e => {
    const P = G.P;
    let s = Math.max(0, 90 - Math.hypot(e.x - P.x, e.y - P.y)) * .5;   // close to you = urgent
    if (e.boss) s += 25;
    if (e.elite || e.mutant) s += 20;
    if (DANGER.has(e.type)) s += 15;
    if (ATTACKING.has(e.state)) s += 30;                               // winding up or mid-charge
    if (e.hp < e.maxHp * .3) s += 10;                                   // finish off the wounded
    if (e.invuln || e.invT > 0 || e.shell > 0) s -= 30;                 // shots would be wasted
    if (e.type === 'replica' || e.type === 'hcv' || e.type === 'egg') s += 45;   // healers and eggs first: they undo (or add to) your work
    if (e.possessedBy) s += 60;                                              // the Hivemind's host
    return s;
  };
  const bestTarget = (x, y, reach, distW, filter) => {
    let tgt = null, bs = -1e9;
    for (const e of G.S.enemies) {
      if (e.hp <= 0 || e.x < 0 || e.x > W || game.hiddenOrCloaked(e) || (filter && !filter(e))) continue;
      const d = Math.hypot(e.x - x, e.y - y); if (d > reach) continue;
      const sc = game.threat(e) - d * distW; if (sc > bs) { bs = sc; tgt = e; }
    }
    return tgt;
  };

  const SHOOTERS = new Set(['bug', 'polio', 'hanta', 'nipah', 'klebs', 'corona', 'variola', 'mers', 'hepb']);
  const FLEE = new Set(['virus', 'bact', 'bug', 'salmo', 'hiv', 'candida', 'noro', 'pseudo', 'klebs', 'corona', 'trypan', 'dengue', 'polio', 'herpes', 'hepb', 'variola', 'yellow', 'hanta', 'mers']);
  // Toxoplasma's pulses don't hurt either — they reverse your controls for a few seconds
  function confuse() {
    const { S, P } = G;
    if (P.inv > 0 || P.dashInv > 0 || P.god) return;
    if (!(P.confT > 0)) { V.SND.blink(); V.ui.toast(up(t('toast.confused')), '#c080ff'); }
    P.confT = 3;
  }
  // Polio's blue shots don't hurt — they slow you for a couple of seconds
  function paralyse() {
    const { S, P } = G;
    if (P.inv > 0 || P.dashInv > 0 || P.god) return;
    if (!(P.paraT > 0)) V.SND.hurt();
    P.paraT = 2.2;
    if (!S.seenPara) { S.seenPara = true; V.ui.toast(up(t('toast.para')), '#70a0ff'); }
  }
  // what expansion-ai.js sees: helpers, plus per-frame state filled in by update()
  const X = game.X = { spawn: (...a) => spawn(...a), kill: (...a) => kill(...a), burst: (...a) => burst(...a), shake: v => shake(v), drop: (...a) => drop(...a),
    rnd, clamp, TAU, W, H, TOP, BOT, V, t, up, get S() { return G.S; }, get P() { return G.P; }, get D() { return G.S.D; } };

  // fromEdge: part of an arriving pack (eligible to be elite) even though its position is given
  function spawn(type, x, y, link, fromEdge) {
    const { S } = G, D = S.D, def = V.ENEMIES[type], given = x !== undefined;
    const m = (1 + (S.level - 1) * D.ramp) * D.enemyHp;
    if (x === undefined) [x, y] = edgePoint();
    if (type === 'plasmo' && x < W) x = W + rnd(20, 40); // drifts in with the blood flow
    const e = { type, x, y, vx: 0, vy: 0, kx: 0, ky: 0, t: rnd(0, 10), flash: 0, r: def.r, score: def.score, boss: !!def.boss,
      // early bosses get a lighter multiplier while your build is still small (full strength from level 10)
      // (boss health stops growing past level 90 — your build tops out long before, and every boss should stay beatable)
      hp: def.boss ? (def.hp + Math.min(S.level, 90) * def.bossHp) * D.bossHp * Math.min(1, .6 + S.level * .04) : Math.max(1, def.hp * m),
      spd: (def.spd + S.level * def.grow) * D.enemySpd };
    def.init?.(e);
    // bosses can't be melted: at least (your sustained DPS × bossFloor seconds) of health
    // (bosses that spend time shelled, shielded or teleporting get a lower floor so fights don't drag)
    if (e.boss && type !== 'hydra' || type === 'hydra' && !given) e.hp = Math.max(e.hp, game.playerDPS() * V.TUNE.bossPowerAvg * D.bossFloor * (V.FLOOR_MUL[type] ?? 1) * (type === 'hydra' ? 1 / 3 : 1));
    // elites: glowing, tougher, faster, and they shoot
    // only pathogens arriving from the edge can be elite — never boss minions or split-offs
    if ((!given || fromEdge) && !e.boss && !['mini', 'spore', 'decoy', 'strep'].includes(type) && Math.random() < D.elite + S.wave * V.ELITE.perWave) {
      e.elite = true; e.hp *= V.ELITE.hp; e.spd *= V.ELITE.spd; e.score *= V.ELITE.score; e.efire = rnd(...V.ELITE.fire);
    }
    // mutants: rare crimson super-variants of any pathogen, with their own bullet pattern
    const MU = V.MUTANT;
    if (!e.elite && (!given || fromEdge) && !e.boss && MU.pattern[type] && S.mode !== 'rush' && S.wave >= MU.from
      && Math.random() < (MU.base + S.wave * MU.perWave) * (MU.diffMul[S.diff] || 1)) {
      e.mutant = true; e.hp *= MU.hp; e.spd *= MU.spd; e.score *= MU.score; e.mfire = rnd(1, 2);
      if (!S.seenMutant) { S.seenMutant = true; V.ui.toast(up(t('toast.mutant')), '#ff4060'); }
    }
    e.maxHp = e.hp; e.level = S.level; e.age = 0; e.born = G.clock;
    if (e.boss) { S.bossDash = false; S.bossHurt = false; }
    if (type === 'hydra' && !given) S.hydraMax = e.maxHp * 3;   // three generations share one health bar
    if (e.boss) {
      if (!given) { e.x = W + 20; e.y = H / 2; }
      e.maxHp = e.hp;
      if (e.shellMax) e.shell = e.shellMax = Math.round(Math.max(e.shellMax * (1 + S.level * .03) * D.enemyHp, game.playerDPS() * 3));   // (the wax keeps up with your build: ~3s of your sustained fire)
    }
    // late in the boss rotation, bosses attack faster (they were tuned for earlier waves)
    if (e.boss) { const late = Math.max(0, V.BOSS_ORDER.indexOf(type === 'twins2' ? 'twins' : type) - 8); e.fireMul = .9 / (1 + late * .03); e.toxMul = 1 + Math.min(.2, late * .01); }
    V.ON_SPAWN?.[type]?.(e, S);
    S.enemies.push(e);
    // a strep chain is a head plus five links, each following the one ahead
    if (type === 'strep' && !link) { let prev = e; for (let i = 0; i < 5; i++) { const s = spawn('strep', x, y, true); s.leader = prev; prev = s; } }
    return e;
  }

  // what you'd deal per second with your permanent build (power-ups and burst excluded)
  game.playerDPS = () => {
    const P = G.P;
    if (!P) return 5;
    const lanes = 1 + (P.multi - 1) * V.TUNE.laneDmg;
    return (1 / P.rate) * P.dmg * lanes + (P.perm.macro || 0) * 8 + (P.perm.neutro || 0) * 5;
  };
  // untargetable: HIV's fade, Herpes/Latency gone latent, Lassa underground, a phage mid-leap
  const cloaked = e => e.type === 'hiv' && (e.t % 3.8) > 2.5 || e.latent || e.under || e.air;
  game.cloaked = cloaked;
  // long bosses use a box instead of a circle for hits
  const RECTS = { plague: [13, 5], tb: [12, 5], rabies: [9, 4], botulist: [11, 5] };
  function touches(e, x, y, pad) {
    if (e.segPts) for (const [sx, sy] of e.segPts) if (Math.hypot(x - sx, y - sy) < 3.5 + pad) return true;
    const box = RECTS[e.type];
    if (box) return Math.abs(x - e.x) < box[0] + pad && Math.abs(y - e.y) < box[1] + pad;
    return Math.hypot(x - e.x, y - e.y) < e.r + pad;
  }

  // ---------- effects ----------
  const PCOL = V.PCOL = { virus: ['#b27cf0', '#dcb8ff', '#ff9ce8'], bact: ['#cfd84e', '#eef59a'], mini: ['#cfd84e', '#eef59a'],
    bug: ['#f08a3c', '#ffc48a'], prion: ['#8a6a7a', '#e8c0d0'], salmo: ['#d4524a', '#ff9a8a'], hiv: ['#5a8cff', '#b0c8ff', '#9cf04a'],
    candida: ['#e8dcc0', '#fffaf0', '#a89870'], spore: ['#e8dcc0', '#a89870'],
    boss: ['#e0506a', '#ff9cab', '#ffe066', '#fff'], plague: ['#b08a4a', '#e8c890', '#4a3010', '#fff'],
    plasmo: ['#e04ab0', '#ffb0e0'], noro: ['#e8b43a', '#fff0b0'], strep: ['#3fbf7f', '#a8f0c8'], pseudo: ['#3ab0c8', '#b0f0ff', '#8fe0a0'],
    tb: ['#c8b8a0', '#f0e8d8', '#4a3a2a', '#fff'], rabies: ['#9a9ab0', '#e0e0f0', '#ff6a6a', '#fff'],
    phantom: ['#7a5aff', '#c0b0ff', '#ff6ad0', '#fff'], decoy: ['#7a5aff', '#c0b0ff'],
    colossus: ['#e0702a', '#ffb070', '#5a2006', '#fff'], measles: ['#2a9aa0', '#90f0f0', '#ff8080', '#fff'],
    botulist: ['#8a9a5a', '#d0e0a0', '#2a3a10', '#fff'], hydra: ['#b08aa0', '#f0d0e0', '#4a2a3a', '#fff'],
    adeno: ['#60c0a0', '#c0f0e0', '#ffe0a0'], giardia: ['#c8e080', '#5a7a2a'], borrelia: ['#ffc890', '#7a4020'], ebola: ['#e0a060', '#ffd8a8', '#5a2a10', '#fff'], mycelia: ['#e8d0f0', '#fff6ff', '#5a3a6a', '#fff'],
    tetanus: ['#a0a8c0', '#e8f0ff', '#303848'], klebs: ['#ff9080', '#ffd0c8'], corona: ['#e0a040', '#ffe0a0', '#ff4040'], trypan: ['#d8d0ff', '#403070'],
    drone: ['#40a0ff', '#b0e0ff'], quorum: ['#40a0ff', '#b0e0ff', '#0a2860', '#fff'], shifter: ['#ff5060', '#50a0ff', '#60e070', '#fff'] };

  function burst(x, y, n, cols, sp = 50) {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, TAU), v = rnd(sp * .3, sp);
      G.S.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(.25, .6), col: cols[i % cols.length], big: Math.random() < .3 });
    }
  }
  const comboMult = () => 1 + Math.min(4, Math.floor(G.S.combo / 5)) * .5;
  function addScore(base, x, y) {
    const { S } = G;
    const pts = Math.round(base * comboMult());
    S.score += pts;
    if (x !== undefined) S.floaters.push({ x, y, text: '+' + pts, t: 0, col: comboMult() > 1 ? '#ffe066' : '#f6e7d0' });
  }

  // Every attack goes through here: biofilm shells soak non-piercing hits, disguised Plasmodium gets exposed.
  function strike(e, amount, pierce) {
    if (e.possessedBy?.hp > 0) { e.flash = .06; return strike(e.possessedBy, amount, pierce); }   // hits on the Hivemind's host land on the Hivemind
    if (e.hp <= 0 || e.invT > 0 || e.invuln) return;   // the Shifter is untouchable while it rewrites itself
    if (e.state === 'hidden') reveal(e);
    if (e.shell > 0) e.calm = 0;   // Rex only re-waxes when you stop hitting it
    if (e.shell > 0 && !pierce) {
      e.shell -= amount; e.flash = .05;
      if (e.shell <= 0) { e.expT = 6; burst(e.x, e.y, e.boss ? 30 : 14, e.boss ? ['#e0d4bc', '#fff'] : ['#8fe0a0', '#d8ffe0'], 60); V.SND.shell(); }
      return;
    }
    // safety net: a boss fight that drags past 4 minutes wears the boss down, faster and faster, so nothing can stall forever
    const fatigue = e.boss && e.age > 240 ? 1 + ((e.age - 240) / 60) ** 2 * 2 : 1;
    let dmg = amount * (e.dmgMul || 1) * fatigue * ((e.reoUntil || 0) > G.clock ? .5 : 1);   // (a Reovirus shield halves it)
    if (e.boss) dmg = bossArmor(e, dmg);
    damage(e, dmg);
  }
  // Bosses adapt to burst damage: each has a damage budget that refills at (max health ÷ minimum fight length) per second
  // and banks up to a few seconds' worth. Damage beyond the budget is mostly resisted, so stacked power-ups can't melt a
  // boss in seconds — but a build that's merely keeping pace never notices.
  function bossArmor(e, amount) {
    const S = G.S, D = S.D, order = V.BOSS_ORDER, i = order.indexOf(e.type === 'twins2' ? 'twins' : e.type);
    const minT = (D.bossMinT || 30) * Math.min(1.1, V.FLOOR_MUL[e.type] ?? 1) * (e.type === 'hydra' ? 1 / 3 : 1) * (i >= order.length - 5 ? 1.3 : 1);
    const rate = e.maxHp / minT, cap = rate * 5;   // (banking lets a well-timed opening pay off)
    e.budget = Math.min(cap, (e.budget ?? cap) + rate * Math.max(0, G.clock - (e.budgetT ?? G.clock))); e.budgetT = G.clock;
    if (amount <= e.budget) { e.budget -= amount; return amount; }
    const over = amount - e.budget, got = e.budget + over * .1;
    e.budget = 0;
    if (G.clock > (e.resistT || 0)) { e.resistT = G.clock + .7; S.floaters.push({ x: e.x, y: e.y - e.r - 6, text: t('fl.resist'), t: 0, col: '#a8a8c0' }); }
    return got;
  }
  function reveal(e) {
    e.state = 'hunt'; e.flash = .15;
    burst(e.x, e.y, 10, ['#6a1828', '#e04ab0', '#ffb0e0'], 50); V.SND.reveal();
  }
  game.hiddenOrCloaked = e => cloaked(e) || e.state === 'hidden';

  function damage(e, amount) {
    if (e.hp <= 0) return;
    e.hp -= amount; e.flash = .07; e.hitAt = G.clock;   // (the renderer squashes it for a moment)
    if (e.hp <= 0) kill(e);
  }
  function kill(e, expired) {
    const { S } = G;
    e.hp = 0;
    burst(e.x, e.y, e.boss ? 60 : 12, PCOL[e.type], e.boss ? 90 : 50);
    (S.rings ??= []).push({ x: e.x, y: e.y, r: e.r, at: G.clock, col: PCOL[e.type][0], big: e.boss });   // a pop of shockwave
    V.SND.pop();
    if (expired) return;
    if (e.elite || e.mutant) { S.stopT = Math.max(S.stopT || 0, .05); shake(.12); }
    // the last kill of a wave plays out in slow motion
    if (S.phase === 'fight' && !S.queue.length && S.enemies.every(o => o === e || o.hp <= 0)) S.slowT = .55;
    const before = comboMult();
    S.combo++; S.comboT = 2.5; S.bestCombo = Math.max(S.bestCombo, S.combo); S.kills++;
    V.meta.event('kill', { type: e.type, elite: e.elite, mutant: e.mutant }); V.meta.event('combo', { n: S.combo });
    const mateAlive = V.LINKED?.[e.type] && S.enemies.some(o => V.LINKED[e.type].includes(o.type) && o.hp > 0);
    if (e.boss && !(e.type === 'hydra' && e.gen < 2) && !mateAlive) { S.bossKills++; V.meta.event('boss', { type: e.type, dashed: S.bossDash, hurt: S.bossHurt }); }
    if (S.M.toxicDeath && !e.boss) for (let i = 0; i < 4; i++) S.toxins.push({ x: e.x, y: e.y, vx: Math.cos(i * TAU / 4 + .78) * 40, vy: Math.sin(i * TAU / 4 + .78) * 40, life: 1.4 });
    if (comboMult() > before) V.SND.combo();
    addScore(e.score, e.x, e.y - 6);
    if (e.type !== 'decoy') dropATP(e);
    if (G.P.fx.adren > 0) G.P.dashT = 0;
    const P0 = G.P;
    if (P0.fx.plasma > 0 && P0.hp < P0.max && G.clock > (P0.plasmaCd || 0) && Math.random() < .14) { P0.hp++; P0.plasmaCd = G.clock + 3; burst(P0.x, P0.y, 12, ['#ff80a0', '#fff'], 50); V.SND.pick(); }
    V.ON_KILL?.[e.type]?.(e, X);
    V.MOD?.kill?.(e, G.S, G.P);
    if (e.type === 'bact') { spawn('mini', e.x, e.y - 4); spawn('mini', e.x, e.y + 4); }
    if (e.type === 'hydra' && e.gen < 2) {
      shake(.3);
      for (const side of [-1, 1]) {
        const c = spawn('hydra', e.x, clamp(e.y + side * 8, TOP + 10, BOT - 10));
        c.gen = e.gen + 1; c.hp = c.maxHp = e.maxHp * .5; c.r = [10, 7, 4][c.gen]; c.score = [400, 250, 150][c.gen];
        c.dir = Math.atan2(side, -1); c.kx = -40; c.ky = side * 90; c.fire = 1 + c.gen * .3;
      }
      return;   // the fight goes on — no boss rewards yet
    }
    if (e.type === 'hydra' && S.enemies.some(o => o.type === 'hydra' && o.hp > 0)) return;
    if (mateAlive) { shake(.3); return; }
    if (e.type === 'phantom') for (const d of S.enemies) if (d.type === 'decoy' && d.hp > 0) kill(d, true);
    if (e.type === 'quorum') for (const d of S.enemies) if (d.type === 'drone' && d.hp > 0) kill(d, true);   // the swarm dies with its hive
    if (e.type === 'boss' && !S.primed) { S.primed = true; S.justPrimed = true; }
    if (e.type === 'zero') victory();
    if (e.boss) S.stopT = .45;
    if (e.boss) {
      shake(.5); addScore(Math.round(50 * S.level));
      drop('heal', e.x - 8, e.y); drop(V.randomPower(S.primed), e.x, e.y - 8); drop(V.randomPower(S.primed), e.x + 8, e.y);
    } else if (e.type !== 'decoy' && e.type !== 'drone' && !V.MINIONS?.has(e.type) && (e.mutant || (e.elite && G.P.syn?.jackpot) || Math.random() < S.D.drop * (e.elite ? 3 : 1) * (G.P.hp <= 1 ? 1.6 : 1) * (G.P.luck || 1))) drop(G.P.hp <= 1 && Math.random() < .5 ? 'heal' : V.randomPower(S.primed), e.x, e.y);
  }
  // ATP comes out as a little cluster of glowing orbs
  function dropATP(e) {
    const { S, P } = G;
    let total = Math.round(V.atpFor(e) * (P.fx.atp > 0 ? 2 : 1) * S.atpMul * (e.elite ? V.ELITE.atp : 1) * (e.mutant ? V.MUTANT.atp : 1));
    const n = Math.min(e.boss ? 12 : 4, total);
    for (let i = 0; i < n; i++) {
      const val = Math.ceil(total / (n - i)); total -= val;
      const a = rnd(0, TAU), v = rnd(20, e.boss ? 90 : 45);
      S.orbs.push({ x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, val, t: rnd(0, 1) });
    }
  }
  function drop(kind, x, y) {
    G.S.pickups.push({ kind, x: clamp(x, 6, W - 6), y: clamp(y, TOP + 6, BOT - 6), t: 0 });
  }

  function collect(kind, quiet) {
    const { S, P } = G, p = V.POW[kind];
    S.collected = (S.collected || 0) + 1;
    if (!quiet) (S.rings ??= []).push({ x: P.x, y: P.y, r: 4, at: G.clock, col: p.color });
    V.SND.pick(); V.ui.toast(quiet ? up(t('toast.stocked', { name: tx.pow(kind) })) : t('toast.pickup', { name: up(tx.pow(kind)), desc: tx.powDesc(kind) }), p.color);
    if (kind === 'heal') P.hp = Math.min(P.max, P.hp + 1);
    else if (kind === 'shield') P.shield = Math.min(2, P.shield + 1);
    else if (kind === 'nova') {
      V.SND.nova(); shake(.45);
      for (let i = 0; i < 28; i++) { const a = i * TAU / 28; S.bullets.push({ x: P.x, y: P.y, vx: Math.cos(a) * 190, vy: Math.sin(a) * 190, life: 1.2, dmg: P.dmg, pierce: true, hit: new Set() }); }
      for (const e of [...S.enemies]) if (e.x > -4 && e.x < W + 4) strike(e, e.boss ? 12 : 4, true);
      S.toxins.length = 0;
      burst(P.x, P.y, 40, ['#ff8a3c', '#ffc070', '#fffbe0'], 120);
    } else if (kind === 'vortex') {   // Phagocyte Vortex opens where you're aiming
      S.vortex = { x: clamp(P.x + Math.cos(P.aim) * 55, 14, W - 14), y: clamp(P.y + Math.sin(P.aim) * 55, TOP + 12, BOT - 12), t: 4, spin: 0 };
      burst(S.vortex.x, S.vortex.y, 20, ['#b080ff', '#fff'], 70); V.SND.nova();
    } else if (V.COLLECT?.[kind]) {   // one-shot power-ups from later expansions
      V.COLLECT[kind](S, P, X);
    } else if (kind === 'antitox') {
      S.toxins.length = 0; S.mines.length = 0; P.fx.antitox = p.time * P.dur;
      burst(P.x, P.y, 24, ['#80ffa0', '#e0ffe8'], 90);
    } else if (kind === 'phage') {
      for (let i = 0; i < 6; i++) { const a = i * TAU / 6; S.phages.push({ x: P.x, y: P.y, vx: Math.cos(a) * 80, vy: Math.sin(a) * 80, life: 5, t: rnd(0, 1) }); }
      burst(P.x, P.y, 16, ['#d8d8f0', '#ffffff'], 60);
    } else {
      if (kind === 'atp') S.atp += 25;
      P.fx[kind] = p.time * P.dur;
      if (kind === 'macro' && !S.allies.some(a => !a.perm)) addAlly(false);
    }
    V.ui.hud();
  }

  function hurt(fromX, fromY, src) {
    const { S, P } = G;
    if (P.inv > 0 || P.dashInv > 0 || P.god || G.mode !== 'play') return;
    if (V.MOD?.dodge?.(P)) return;   // Mucus Layer
    S.everHit = true; S.lastHit = src || 'toxin'; if (S.enemies.some(e => e.boss)) S.bossHurt = true;
    S.stopT = Math.max(S.stopT || 0, .07);
    if (P.shield > 0) {
      S.hurtFlash = .25; S.flashCol = '#7fe0d4';
      P.shield--; P.inv = 1; V.SND.block();
      burst(P.x, P.y, 18, ['#7fe0d4', '#e8fbf8'], 70); V.MOD?.hit?.(S, P); V.ui.hud(); return;
    }
    P.hp--; P.inv = S.D.inv; shake(.3); S.combo = 0; S.waveHit = true; S.calm = 0; V.SND.hurt(); S.hurtFlash = .45; S.flashCol = '#ff2040';
    if (P.hp <= 0 && (P.lastStand > 0 || P.revive)) {   // Last Stand (adaptation) first, then the Research Lab's Second Wind
      const own = P.lastStand > 0;
      if (own) P.lastStand--; else P.revive--;
      P.hp = 1; P.inv = 2.5;
      V.ui.banner(V.t(own ? 'upg.laststand.name' : 'lab.revive.name').toLocaleUpperCase(V.i18n.lang), V.t(own ? 'toast.lastStand' : 'toast.revive'));
      burst(P.x, P.y, 40, ['#ffd23a', '#fff'], 100); V.SND.upgrade();
    }
    burst(P.x, P.y, 16, ['#7fe0d4', '#e8fbf8', '#ff5a6e'], 60);
    // shove the player clear of whatever hit them
    if (fromX !== undefined) {
      const d = Math.hypot(P.x - fromX, P.y - fromY) || 1;
      P.x = clamp(P.x + (P.x - fromX) / d * 10, 6, W - 6); P.y = clamp(P.y + (P.y - fromY) / d * 10, TOP + 8, BOT - 8);
      S.kickX = (P.x - fromX) / d * 3; S.kickY = (P.y - fromY) / d * 3;   // the screen jolts the way you were hit
    }
    V.MOD?.hit?.(S, P);
    V.ui.hud();
    if (P.hp <= 0) {
      G.mode = 'dying'; G.dieT = 1.4; V.input.release(); shake(.6);
      burst(P.x, P.y, 50, ['#7fe0d4', '#e8fbf8', '#5d88d8', '#ff5a6e'], 110);
    }
  }

  // Where the player is aiming, and whether they're pulling the trigger.
  function readAim() {
    const { P } = G, I = V.input;
    if (I.aimJoy) {
      const j = I.aimJoy, d = Math.hypot(j.dx, j.dy);
      P.aim = d > 3 ? Math.atan2(j.dy, j.dx) : Math.atan2(j.y - P.y, j.x - P.x);
      return true;
    }
    let ax = 0, ay = 0;
    if (I.keys.has('arrowleft')) ax--; if (I.keys.has('arrowright')) ax++;
    if (I.keys.has('arrowup')) ay--; if (I.keys.has('arrowdown')) ay++;
    if (ax || ay) { P.aim = Math.atan2(ay, ax); return true; }
    if (!I.touchMode && I.mouse.seen) P.aim = Math.atan2(I.mouse.y - P.y, I.mouse.x - P.x);
    // auto-fire (a setting): shoot wherever you're aiming whenever pathogens are on screen
    if (V.ui.autofire && !G.bot && G.S.enemies.some(e => e.x > 0 && e.x < W)) return true;
    return I.mouse.down || I.keys.has(' ');
  }

  // ---------- per-frame update ----------
  game.update = dt => {
    if (!(dt > 0)) return;   // time never runs backwards (or stands still) inside the simulation
    const flow = V.cos.flow(G.clock);
    for (const c of G.cells) { c.x -= c.v * dt * flow; if (c.x < -10) { c.x = W + 10; c.y = rnd(TOP + 4, BOT - 4); } }
    for (const f of G.flecks) { f.x -= f.v * dt * flow; if (f.x < 0) { f.x = W; f.y = rnd(TOP, BOT); } }
    if (G.mode === 'dying') {
      stepFx(G.S, dt * .5); // slow-motion burst, then the results screen
      G.dieT -= dt;
      if (G.dieT <= 0) gameOver();
      return;
    }
    if (G.mode !== 'play') return;
    const { S, P } = G, D = S.D, I = V.input;

    // hit-stop: time crawls for a moment when you're hit or a boss dies
    if (S.stopT > 0) { S.stopT -= dt; dt *= .15; }
    else if (S.slowT > 0) { S.slowT -= dt; dt *= .35; }
    S.hurtFlash = Math.max(0, (S.hurtFlash || 0) - dt);
    if (S.zaps) { for (const z of S.zaps) z.t -= dt; S.zaps = S.zaps.filter(z => z.t > 0); }
    // last heart: you can hear it
    if (P.hp === 1 && P.max > 1) { S.hbT = (S.hbT || 0) - dt; if (S.hbT <= 0) { S.hbT = 1.15; V.SND.thump(); } }
    S.time = (S.time || 0) + dt;
    if (S.won && !S.victoryDone) { stepVictory(S, dt); stepFx(S, dt); V.ui.hud(); return; }
    stepIntro(S, dt);
    // wave flow: fight → clear (collect drops) → pick upgrade → next → fight
    if (S.phase === 'fight') {
      if (S.queue.length) {
        S.spawnT -= dt;
        if (S.spawnT <= 0) {
          const boss = V.ENEMIES[S.queue[0]].boss;
          const k = boss ? 1 : Math.min(S.queue.length, Math.floor(rnd(D.pack[0], D.pack[1] + 1)));
          const [x0, y0] = edgePoint(), twoSides = !boss && k > 1 && Math.random() < D.both;
          for (let i = 0; i < k; i++) {
            const type = S.queue.shift();
            if (V.ENEMIES[type].boss) { spawn(type); continue; }
            const other = twoSides && i % 2;   // alternate members come in from the opposite edge
            spawn(type, other ? W - x0 : x0 + rnd(-8, 8), clamp(y0 + (i - k / 2) * 14 + rnd(-4, 4), TOP + 12, BOT - 12), false, true);
          }
          S.spawnT = Math.max(.8, D.spawnGap * (.6 + k * .35) - S.wave * .03) * pace(S, G.P);
        }
      } else if (!S.enemies.length) {
        S.phase = 'clear'; S.waveT = 1.6; S.toxins.length = 0;
        const bonus = S.wave * (S.mode === 'rush' ? 100 : 20), atp = V.atpClear(S.wave, S.mode === 'rush');
        addScore(bonus); S.atp += atp;
        V.meta.event('wave', { wave: S.wave, hit: S.waveHit });
        V.ui.banner(t(S.mode === 'rush' ? 'ban.bossDown' : 'ban.clear'), S.justPrimed ? t('ban.primed') : t('ban.bonus', { score: bonus, atp }));
        V.SND.clear();
      }
    } else if (S.phase === 'clear') {
      S.waveT -= dt;
      if (S.waveT <= 0) offerUpgrades();
    } else {
      S.waveT -= dt;
      if (S.waveT <= 0) startWave(S.wave + 1);
    }
    if (G.mode !== 'play') return;

    if (S.phase === 'fight') S.calm = (S.calm || 0) + dt;
    // combo decays if you stop scoring
    if (S.comboT > 0) { S.comboT -= dt; if (S.comboT <= 0) S.combo = 0; }

    // player movement
    let mx = 0, my = 0;
    if (I.keys.has('a')) mx--; if (I.keys.has('d')) mx++;
    if (I.keys.has('w')) my--; if (I.keys.has('s')) my++;
    if (I.moveJoy) { mx = I.moveJoy.dx / 16; my = I.moveJoy.dy / 16; }
    if (G.bot && I.botMove) { mx = I.botMove.x; my = I.botMove.y; }
    P.confT = (P.confT || 0) - dt;
    if (P.confT > 0) { mx = -mx; my = -my; }   // Toxoplasma: scrambled controls
    const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
    // dash: a burst in your movement direction (or toward your aim if standing still), briefly untouchable
    P.dashT -= dt; P.dashInv -= dt;
    if (I.dash) {
      // pressed a moment before the dash was ready? it still fires when it comes back
      I.dashBuf = (I.dashBuf || 0) + dt;
      if (P.dashT > 0 && I.dashBuf < .2) {} else { I.dash = false; I.dashBuf = 0; }
      if (P.dashT <= 0) {
        I.dash = false; I.dashBuf = 0;
        (S.rings ??= []).push({ x: P.x, y: P.y, r: 3, at: G.clock, col: '#7fe0d4' });
        let dx = mx, dy = my;
        if (!dx && !dy) { dx = Math.cos(P.aim); dy = Math.sin(P.aim); }
        const l = Math.hypot(dx, dy) || 1;
        P.dvx = dx / l * V.DASH.speed; P.dvy = dy / l * V.DASH.speed;
        P.dashing = V.DASH.time; P.dashInv = V.DASH.inv; P.dashT = V.DASH.cd * (P.fx.vitc > 0 ? .7 : 1) * P.dashMul;
        if (S.enemies.some(e => e.boss)) S.bossDash = true;
        V.SND.dash();
      }
    }
    if (P.dashing > 0) {
      P.dashing -= dt;
      S.ghosts.push({ x: P.x, y: P.y, life: .22 });
      P.x = clamp(P.x + P.dvx * dt, 6, W - 6); P.y = clamp(P.y + P.dvy * dt, TOP + 8 + (S.sq || 0), BOT - 8 - (S.sq || 0));
    } else {
      const spd = P.spd * (P.fx.speed > 0 ? 1.5 : 1) * (P.fx.vitc > 0 ? 1.3 : 1) * (S.enemies.some(e => e.latched) ? .6 : 1) * (P.paraT > 0 ? .5 : 1);
      // (Cholera's current drags you; Sepsis squeezes the vessel)
      // (Mpox's tractor beam tugs you too; set by the pathogen each frame)
      P.x = clamp(P.x + (mx * spd + (S.flowX || 0) + (S.tugX || 0)) * dt, 6, W - 6);
      P.y = clamp(P.y + (my * spd + (S.tugY || 0)) * dt, TOP + 8 + (S.sq || 0), BOT - 8 - (S.sq || 0));
    }
    S.tugX = S.tugY = 0;
    for (const w of S.walls || []) {   // push out of any biofilm wall
      if (P.x > w.x - 5 && P.x < w.x + w.w + 5 && P.y > w.y - 5 && P.y < w.y + w.h + 5) {
        const l = P.x - (w.x - 5), r = (w.x + w.w + 5) - P.x, u = P.y - (w.y - 5), dn = (w.y + w.h + 5) - P.y, m = Math.min(l, r, u, dn);
        if (m === l) P.x = w.x - 5; else if (m === r) P.x = w.x + w.w + 5; else if (m === u) P.y = w.y - 5; else P.y = w.y + w.h + 5;
      }
    }
    // Adrenaline: dashes slice through pathogens
    if (P.fx.adren > 0 && P.dashing > 0) for (const e of S.enemies) if (e.hp > 0 && !cloaked(e) && (e.adrenCut || 0) < G.clock && touches(e, P.x, P.y, 6)) { e.adrenCut = G.clock + .4; strike(e, P.dmg * 8, true); burst(e.x, e.y, 8, ['#ff6040', '#fff'], 60); }
    P.inv -= dt; P.bob += dt; P.paraT = (P.paraT || 0) - dt;
    // smoothed player velocity — smarter pathogens lead their shots and cut you off
    if (P.px === undefined || !dt) { P.svx = P.svy = 0; }
    else { const k = Math.min(1, dt * 6); P.svx += (clamp((P.x - P.px) / dt, -110, 110) - P.svx) * k; P.svy += (clamp((P.y - P.py) / dt, -110, 110) - P.svy) * k; }
    P.px = P.x; P.py = P.y;
    for (const k in P.fx) P.fx[k] = Math.max(0, P.fx[k] - dt);

    // firing — only when the player pulls the trigger
    P.fireT -= dt;
    if (readAim() && P.fireT <= 0) {
      const pierce = P.fx.pierce > 0, homing = P.fx.homing > 0 || !!P.perm.homing, boom = P.fx.complement > 0;
      const crit = P.fx.crit > 0 && Math.random() < .25;
      const dmg = P.dmg * (P.fx.il2 > 0 ? V.TUNE.il2 : 1) * (P.fx.mega > 0 ? 1.6 : 1) * (crit ? 3 : 1), bounce = P.fx.bounce > 0 ? 2 : 0, big = P.fx.mega > 0 || crit;
      const lanes = P.multi === 1 ? [0] : P.multi === 2 ? [-2.5, 2.5] : [-3.5, 0, 3.5];
      const px = -Math.sin(P.aim), py = Math.cos(P.aim);
      for (const off of P.fx.spread > 0 ? [-.2, 0, .2] : [0]) {
        const a = P.aim + off;
        lanes.forEach((l, li) => {
          // extra Bivalent lanes and Adjuvant side shots hit softer, so stacking them doesn't explode
          const d = dmg * (li === (lanes.length >> 1) || P.syn?.twinfang ? 1 : V.TUNE.laneDmg) * (off ? V.TUNE.spreadSide : 1);
          S.bullets.push({ x: P.x + px * l, y: P.y + py * l, vx: Math.cos(a) * 180, vy: Math.sin(a) * 180, life: 1.3, dmg: d, pn: P.pierceN || 0, pierce, homing, boom, bounce, big, il2: P.fx.il2 > 0, crit, assist: V.ui.aimAssist && !G.bot, lyso: P.fx.lyso > 0, chain: P.fx.chain > 0, hit: pierce ? new Set() : null });
        });
      }
      // Booster Clone fires along the same line from beside you
      if (P.fx.clone > 0) { const c = game.clonePos(P); S.bullets.push({ x: c.x, y: c.y, vx: Math.cos(P.aim) * 180, vy: Math.sin(P.aim) * 180, life: 1.3, dmg: dmg * .7, pierce, homing, boom, bounce, big, il2: P.fx.il2 > 0, lyso: P.fx.lyso > 0, chain: P.fx.chain > 0, hit: pierce ? new Set() : null }); }
      V.MOD?.shot?.(S, P, dmg);   // Overdrive
      P.fireT = P.rate * (P.fx.rapid > 0 ? V.TUNE.rapid : 1) * (P.fx.vitc > 0 ? .77 : 1); V.SND.shoot(); P.shotAt = G.clock;
      S.fired = true;
    }
    // first-wave nudge for anyone who hasn't found the trigger yet
    if (S.wave === 1 && S.phase === 'fight' && !S.fired) {
      S.hintT += dt;
      if (S.hintT > 3) { S.hintT = -6; V.ui.toast(t(I.touchMode ? 'toast.hintTouch' : 'toast.hintMouse'), '#7fe0d4'); }
    }

    // antibodies
    for (const b of S.bullets) {
      if (b.homing) steer(b, S.enemies, dt);
      else if (b.assist) steer(b, S.enemies, dt, 2.4, 60, P.aim);
      let bs = 1;
      for (const m of S.fields || []) {
        const dx = m.x - b.x, dy = m.y - b.y, d = Math.hypot(dx, dy) || 1;
        if (d > m.r) continue;
        if (m.slow) bs = Math.min(bs, m.slow);
        if (m.pull) { const sp = Math.hypot(b.vx, b.vy), k = m.pull * dt; b.vx += dx / d * sp * k; b.vy += dy / d * sp * k; const n = Math.hypot(b.vx, b.vy) || 1; b.vx *= sp / n; b.vy *= sp / n; }
      }
      b.x += b.vx * dt * bs; b.y += b.vy * dt * bs; b.life -= dt;
      for (const w of S.walls || []) if (b.life > 0 && b.x > w.x && b.x < w.x + w.w && b.y > w.y && b.y < w.y + w.h) { b.life = 0; w.hp -= b.dmg; w.flash = .06; burst(b.x, b.y, 2, ['#c0e0a0']); if (w.hp <= 0) { w.gone = true; burst(w.x + w.w / 2, w.y + w.h / 2, 16, ['#a0c080', '#e0f0c0'], 60); V.SND.shell(); } }
      if (S.walls) S.walls = S.walls.filter(w => !w.gone);
      if (b.lyso) for (const t of S.toxins) if (t.life > 0 && Math.abs(t.x - b.x) < 4 + (t.r || 0) && Math.abs(t.y - b.y) < 4 + (t.r || 0)) { t.life = 0; burst(t.x, t.y, 2, ['#c0ffe0']); }
      if (b.bounce > 0 && (b.y < TOP + 1 || b.y > BOT - 1 || b.x < 1 || b.x > W - 1)) {   // Opsonin: ricochet
        if (b.y < TOP + 1 || b.y > BOT - 1) { b.vy = -b.vy; b.y = clamp(b.y, TOP + 1, BOT - 1); } else { b.vx = -b.vx; b.x = clamp(b.x, 1, W - 1); }
        b.bounce--; b.life = Math.max(b.life, .8); if (b.hit) b.hit.clear();
      } else if (b.y < TOP || b.y > BOT || b.x < -4 || b.x > W + 4) b.life = 0;
      for (const e of S.enemies) {
        if (b.life <= 0 || e.hp <= 0 || cloaked(e) || (b.hit && b.hit.has(e))) continue;
        if (e.guards) {
          const g = e.guards.find(g => g.alive && Math.hypot(g.x - b.x, g.y - b.y) < (e.guardR || 4));
          if (g) {
            if (!b.pierce) b.life = 0;
            g.hp -= b.dmg; g.flash = .07; V.SND.hit(); burst(b.x, b.y, 3, ['#80e8e8', '#fff']);
            if (g.hp <= 0) { g.alive = false; burst(g.x, g.y, 8, ['#80e8e8', '#2a9aa0'], 40); }
            if (!b.pierce) continue;
          }
        }
        if (touches(e, b.x, b.y, b.big ? 3.5 : 2)) {
          if (b.pierce) b.hit.add(e); else if (b.pn > 0) { b.pn--; (b.hit ??= new Set()).add(e); } else b.life = 0;   // (Enzyme Tips)
          if (V.PRE_HIT?.[e.type]?.(e, b, X)) continue;   // (Legionella swallows the shot)
          if (b.crit) burst(b.x, b.y, 6, ['#ffe080', '#fff'], 60);
          if (e.type === 'klebs' && !b.pierce && Math.abs(angDiff(Math.atan2(-b.vy, -b.vx), e.faceA)) < 1.25) {
            burst(b.x, b.y, 3, ['#ffd0c8', '#fff']); e.flash = .03; continue;   // bounced off the capsule
          }
          V.SND.hit();
          if (!e.boss && e.state !== 'dash') { e.kx += b.vx * .25; e.ky += b.vy * .25; }
          burst(b.x, b.y, 2, [b.pierce ? '#ffd0ec' : e.shell > 0 ? '#8fe0a0' : '#c8fff6']);
          strike(e, V.MOD ? b.dmg * V.MOD.hitMul(e, b, P) : b.dmg, b.pierce);
          V.MOD?.afterHit?.(e, b, P, S);   // Fission Shots (expansion7-ai.js)
          if (b.chain) {   // Chain Antibody: arc to the two nearest others
            const near = S.enemies.filter(o => o !== e && o.hp > 0 && !cloaked(o) && Math.hypot(o.x - e.x, o.y - e.y) < 55).sort((a, c) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(c.x - e.x, c.y - e.y)).slice(0, 2);
            for (const o of near) { strike(o, b.dmg * .5, true); (S.zaps ??= []).push({ x1: e.x, y1: e.y, x2: o.x, y2: o.y, t: .12 }); }
          }
          V.ON_HIT?.[e.type]?.(e, b, X);
          if (b.boom) splash(b.x, b.y, e, b.dmg * .6);
        }
      }
    }
    S.bullets = S.bullets.filter(b => b.life > 0);

    allies(S, P, dt);
    halo(S, P, dt);
    V.POWFX?.(S, P, dt, X);   // drone, vortex (expansion4-ai.js)
    V.MOD?.tick?.(S, P, dt, X);   // shockwave dash etc. (expansion5-ai.js)
    nkCell(S, P, dt);
    fever(S, P, dt);
    phages(S, dt);

    // pathogens (Cold Chain slows their clock)
    const stasis = P.fx.stasis > 0, edt0 = stasis ? 0 : dt * (P.fx.freeze > 0 ? .4 : 1), sm = D.smart;
    X.sm = sm;
    const toxin = (x, y, a, v) => S.toxins.push({ x, y, vx: Math.cos(a) * v * D.toxinSpd, vy: Math.sin(a) * v * D.toxinSpd, life: 5 });
    // lead the target: aim where you'll be when the shot arrives (how well depends on difficulty)
    const aimAt = (x, y, v = 58, k = 1) => {
      const tt = Math.min(1.2, Math.hypot(P.x - x, P.y - y) / (v * D.toxinSpd)), q = sm * k;
      return Math.atan2(P.y + P.svy * tt * q - y, P.x + P.svx * tt * q - x) + (P.fx.stealth > 0 ? rnd(-.55, .55) : 0) + (S.dodgeLearn || 0) * .14 * sm * k;   // (Stealth Coat: aim goes wide)
    };
    X.toxin = toxin; X.aimAt = aimAt;
    // Coronavirus crowns speed up every pathogen near them
    for (const e of S.enemies) e.buffed = false;
    for (const c of S.enemies) if (c.type === 'corona' && c.hp > 0) for (const o of S.enemies) if (o !== c && !o.boss && Math.hypot(o.x - c.x, o.y - c.y) < 36) o.buffed = true;
    // every toxin remembers which pathogen fired it (for "killed by …" in the run history)
    let tox0 = S.toxins.length, prevE = null;
    const baseFire = D.fire, baseTox = D.toxinSpd;
    const stamp = () => { for (let i = tox0; i < S.toxins.length; i++) S.toxins[i].src ??= prevE?.type; tox0 = S.toxins.length; };
    for (const e of [...S.enemies]) {
      stamp(); prevE = e;
      D.fire = baseFire * (e.fireMul || 1); D.toxinSpd = baseTox * (e.toxMul || 1);
      if (e.hp <= 0) continue;
      if (stasis) { if (!e.harmless && !game.hiddenOrCloaked(e) && touches(e, P.x, P.y, 3.5)) hurt(e.x, e.y, e.type); continue; }   // frozen solid (still hurts to touch)
      const edt = edt0 * (e.buffed ? 1.35 : 1);
      e.t += edt; e.flash -= edt;
      const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1;
      // chasers head for where you're going, not where you are
      if (P.fx.stealth > 0 && e.gox === undefined) { e.gox = rnd(-50, 50); e.goy = rnd(-40, 40); }
      const ghost = P.fx.stealth > 0 && !e.boss, look = Math.min(.7, d / 90) * sm, qx = dx + P.svx * look + (ghost ? e.gox : 0), qy = dy + P.svy * look + (ghost ? e.goy : 0), qd = Math.hypot(qx, qy) || 1, ux = qx / qd, uy = qy / qd;
      // bosses keep you guessing: some volleys lead you a lot, some barely, so no single dodge works every time
      if (e.boss) { e.leadRoll = (e.leadRoll || 0) - edt; if (e.leadRoll <= 0) { e.leadRoll = rnd(.8, 1.6); e.leadK = rnd(.25, 1.35); } }
      const aimA = aimAt(e.x, e.y, 58, e.boss ? e.leadK : 1);
      const inside = e.x > 8 && e.x < W - 8;
      let tx = ux * e.spd, ty = uy * e.spd, snap = false;

      switch (e.type) {
        case 'virus': case 'mini': case 'hiv': { const w = Math.sin(e.t * 6) * 14; tx += -uy * w; ty += ux * w; break; }
        case 'bact': { const w = Math.sin(e.t * 2.5) * 8; tx += -uy * w; ty += ux * w; break; }
        case 'prion': {
          e.turn -= edt;
          if (e.turn <= 0) { e.turn = rnd(.25, .5); e.dir = aimA + rnd(-1.3, 1.3); }
          tx = Math.cos(e.dir) * e.spd; ty = Math.sin(e.dir) * e.spd; break;
        }
        case 'spore': {
          e.life -= edt; if (e.life <= 0) { kill(e, true); continue; }
          const w = Math.sin(e.t * 3) * 10; tx += -uy * w; ty += ux * w; break;
        }
        case 'bug': {
          if (inside && d < 75) { const s = d < 55 ? -1 : 0; tx = ux * e.spd * s + -uy * e.spd * .9; ty = uy * e.spd * s + ux * e.spd * .9; }
          e.fire -= edt;
          if (e.fire <= 0 && inside) {
            e.fire = (rnd(1.8, 2.8) - Math.min(S.level * .04, .5)) * D.fire;
            toxin(e.x, e.y, aimA, 55); V.SND.spit();
          }
          break;
        }
        case 'candida': {
          e.brood -= edt;
          if (e.brood <= 0 && inside) { e.brood = rnd(3.5, 4.5) * D.fire; spawn('spore', e.x - 3, e.y - 3); spawn('spore', e.x + 3, e.y + 3); V.SND.spores(); }
          break;
        }
        case 'salmo': case 'plague': {
          const isBoss = e.type === 'plague';
          if (e.state === 'tele') {
            tx = ty = 0; e.st -= edt;
            if (e.st <= 0) { e.state = 'dash'; e.st = isBoss ? .9 : .45; e.dx = ux; e.dy = uy; }
          } else if (e.state === 'dash') {
            tx = e.dx * 145; ty = e.dy * 145; snap = true; e.st -= edt;
            if (e.st <= 0 || (isBoss && (e.x < 14 || e.x > W - 14))) { e.state = 'move'; e.cd = isBoss ? rnd(4.5, 6.5) : rnd(2, 3); }
          } else {
            if (isBoss) { tx = ((W - 40) - e.x) * 1.2; ty = clamp((P.y - e.y) * 1.4, -e.spd, e.spd); }
            e.cd -= edt;
            if (e.cd <= 0 && inside && (isBoss || d < 100)) { e.state = 'tele'; e.st = isBoss ? .9 : .65; V.SND.charge(); }
          }
          if (isBoss) {
            e.fire -= edt;
            const rage = e.hp < e.maxHp / 2;
            if (e.fire <= 0 && e.state === 'move' && inside) {
              e.fire = (rage ? 1.7 : 2.4) * D.fire;
              const base = aimA;
              for (let i = -2; i <= 2; i++) toxin(e.x, e.y, base + i * .24, 58);
              V.SND.bossShot();
            }
            while (e.hp > 0 && e.split.length && e.hp / e.maxHp < e.split[0]) {
              e.split.shift(); shake(.3);
              for (let i = 0; i < 2; i++) spawn('bact', e.x + rnd(-10, 10), e.y + rnd(-6, 6));
            }
          }
          break;
        }
        case 'plasmo': {
          if (e.state === 'hidden') {
            // drift with the flow like the cells around it (entering at a steady pace so slow scenes don't stall it offscreen)
            tx = -14 * (e.x > W - 12 ? 1 : V.cos.flow(G.clock)); ty = Math.sin(e.t * 1.5) * 6;
            if (inside) e.hideT -= edt;
            if ((inside && d < 55) || e.hideT <= 0) reveal(e);
          } else { const w = Math.sin(e.t * 8) * 10; tx += -uy * w; ty += ux * w; }
          break;
        }
        case 'noro': {
          if (e.state === 'tele') {
            tx = ty = 0; e.st -= edt;
            if (e.st <= 0) {
              burst(e.x, e.y, 8, PCOL.noro, 40);
              e.x = e.tx; e.y = e.ty; e.kx = e.ky = e.vx = e.vy = 0;
              burst(e.x, e.y, 8, PCOL.noro, 40);
              e.state = 'move'; e.cd = rnd(2.8, 3.8) * D.fire; V.SND.blink();
            }
          } else {
            e.cd -= edt;
            if (e.cd <= 0 && inside) {
              // pick a landing spot a fair distance from the player, never on top of them
              for (let k = 0; k < 8; k++) {
                const a = rnd(0, TAU), r = rnd(50, 66);
                e.tx = clamp(P.x + Math.cos(a) * r, 10, W - 10); e.ty = clamp(P.y + Math.sin(a) * r, TOP + 8, BOT - 8);
                if (Math.hypot(e.tx - P.x, e.ty - P.y) > 46) break;
              }
              e.state = 'tele'; e.st = .8;
            }
          }
          break;
        }
        case 'strep': {
          if (e.leader && e.leader.hp <= 0) e.leader = null;   // lost its leader: this link becomes a head
          if (e.leader) {
            const L = e.leader, lx = L.x - e.x, ly = L.y - e.y, ld = Math.hypot(lx, ly) || 1;
            if (ld > 5) { e.x += lx / ld * (ld - 5); e.y += ly / ld * (ld - 5); }
            tx = ty = 0; snap = true; e.face = lx < 0;
          } else { const w = Math.sin(e.t * 4) * 20; tx += -uy * w; ty += ux * w; }
          break;
        }
        case 'pseudo': { const w = Math.sin(e.t * 2) * 6; tx += -uy * w; ty += ux * w; break; }
        case 'tb': {
          // Mycobacterium Rex: shelled, it sprays spirals + aimed shots and slowly re-waxes; broken, it's slow but the wax
          // regrows in 4s with a ring blast. It also summons bacteria to screen for it.
          tx = ((W - 46) - e.x) * 1.1; ty = clamp((P.y - e.y) * .9, -e.spd, e.spd);
          const rage = e.hp < e.maxHp / 2;
          e.brood -= edt;
          if (e.brood <= 0 && inside) { e.brood = (rage ? 6 : 8) * D.fire; for (let i = 0; i < 2; i++) spawn('bact', e.x + rnd(-8, 8), e.y + rnd(-6, 6)); }
          if (e.shell > 0) {
            e.calm += edt;
            if (e.calm > 2 && e.shell < e.shellMax) e.shell = Math.min(e.shellMax, e.shell + 1.2 * edt);   // re-waxes when left alone
            e.fire -= edt; e.aim -= edt;
            if (e.fire <= 0 && inside) { e.fire = (rage ? 1.5 : 2) * D.fire; const n = rage ? 12 : 10; for (let i = 0; i < n; i++) toxin(e.x, e.y, e.t * 1.3 + i * TAU / n, 44); V.SND.bossShot(); }
            if (e.aim <= 0 && inside) { e.aim = 1.3 * D.fire; const b0 = aimA; for (let i = -1; i <= 1; i++) toxin(e.x, e.y, b0 + i * .16, 64); }
          } else {
            tx *= .35; ty *= .35;
            e.expT -= edt;
            if (e.expT <= 0) {
              e.shell = e.shellMax; burst(e.x, e.y, 24, ['#e0d4bc', '#fff'], 60); V.SND.shell();
              for (let i = 0; i < 16; i++) toxin(e.x, e.y, i * TAU / 16, 55);   // the regrowing wax bursts outward
            }
          }
          break;
        }
        case 'rabies': {
          // Lyssa: ricochets fast, sprays at every wall bounce, leaves a lasting trail, and chains 2–3 charges
          const rage = e.hp < e.maxHp / 2, sp = e.spd * (rage ? 1.25 : 1);
          snap = true;
          const spray = () => { const b0 = aimA; for (let i = -2; i <= 2; i++) toxin(e.x, e.y, b0 + i * .24, 60); };
          if (e.state === 'tele') {
            tx = ty = 0; e.st -= edt;
            if (e.st <= 0) { e.state = 'dash'; e.st = .55; e.dx = ux; e.dy = uy; }
          } else if (e.state === 'dash') {
            tx = e.dx * 185; ty = e.dy * 185; e.st -= edt;
            if (e.st <= 0 || e.x < 12 || e.x > W - 12) {
              if (e.chain > 0) { e.chain--; e.state = 'tele'; e.st = .35; V.SND.charge(); }   // line up the next charge right away
              else { e.state = 'bounce'; e.cd = rnd(2.6, 3.6) * D.fire; const a = rnd(0, TAU); e.dx = Math.cos(a); e.dy = Math.sin(a) * .7; }
            }
          } else {
            let bounced = false;
            if ((e.x < 14 && e.dx < 0) || (e.x > W - 14 && e.dx > 0 && inside)) { e.dx = -e.dx; bounced = true; }
            if ((e.y < TOP + 8 && e.dy < 0) || (e.y > BOT - 8 && e.dy > 0)) { e.dy = -e.dy; bounced = true; }
            if (bounced && inside) spray();
            const l = Math.hypot(e.dx, e.dy) || 1; tx = e.dx / l * sp; ty = e.dy / l * sp;
            e.cd -= edt;
            if (e.cd <= 0 && inside) { e.state = 'tele'; e.st = .6; e.chain = rage ? 3 : 2; V.SND.charge(); }
          }
          e.trail -= edt;
          if (e.trail <= 0 && inside && e.state !== 'tele') { e.trail = rage ? .14 : .2; S.toxins.push({ x: e.x, y: e.y, vx: 0, vy: 0, life: 3.2 }); }
          break;
        }
        case 'phantom': case 'decoy': {
          // The Phantom teleports often, fires aimed bursts, and surrounds itself with decoys that shoot back
          if (e.type === 'decoy') { e.life -= edt; if (e.life <= 0) { kill(e, true); continue; } }
          const rage = e.type === 'phantom' && e.hp < e.maxHp / 2;
          if (e.state === 'tele') {
            tx = ty = 0; e.st -= edt;
            if (e.st <= 0) {
              burst(e.x, e.y, 14, PCOL.phantom, 60);
              e.x = e.tx; e.y = e.ty; e.vx = e.vy = e.kx = e.ky = 0;
              burst(e.x, e.y, 14, PCOL.phantom, 60); V.SND.blink();
              e.state = 'move'; e.cd = (e.finalForm ? 1.3 : rage ? 2 : 2.8) * D.fire;
              for (let i = 0, n = e.finalForm ? 7 : rage ? 5 : 3; i < n; i++) {
                const a = i * TAU / n + rnd(-.3, .3);
                spawn('decoy', clamp(e.x + Math.cos(a) * 28, 12, W - 12), clamp(e.y + Math.sin(a) * 28, TOP + 10, BOT - 10));
              }
              for (let i = 0; i < 12; i++) toxin(e.x, e.y, e.t + i * TAU / 12, 42);
            }
          } else {
            const w = Math.sin(e.t * 1.5) * 12; tx += -uy * w; ty += ux * w;
            if (d < 40) { tx = -ux * e.spd; ty = -uy * e.spd; }   // hovers close, but not on top of you
            e.fire -= edt;
            if (e.fire <= 0 && inside) {
              if (e.type === 'decoy') { e.fire = rnd(1.5, 2.3) * D.fire; toxin(e.x, e.y, aimA, 52); }
              else {
                e.fire = (rage ? 1 : 1.3) * D.fire; const b0 = aimA, n = rage ? 5 : 3;
                for (let i = 0; i < n; i++) toxin(e.x, e.y, b0 + (i - (n - 1) / 2) * .14, 64);
                V.SND.bossShot();
              }
            }
            if (e.type === 'phantom') {
              e.cd -= edt;
              if (e.cd <= 0 && inside) {
                for (let k = 0; k < 8; k++) {
                  const a = rnd(0, TAU), r = rnd(48, 66);
                  e.tx = clamp(P.x + Math.cos(a) * r, 14, W - 14); e.ty = clamp(P.y + Math.sin(a) * r, TOP + 12, BOT - 12);
                  if (Math.hypot(e.tx - P.x, e.ty - P.y) > 44) break;
                }
                e.state = 'tele'; e.st = .8;
              }
            }
          }
          break;
        }
        case 'colossus': {
          // hangs back on the right lobbing volleys; each quarter of health lost, a chunk breaks off as a live MRSA cluster
          tx = ((W - 52) - e.x); ty = clamp((P.y - e.y) * .6, -e.spd, e.spd);
          const rage = e.hp < e.maxHp / 2;
          e.fire -= edt;
          if (e.fire <= 0 && inside) {
            e.fire = (rage ? 1.8 : 2.5) * D.fire;
            const base = aimA, n = rage ? 5 : 3;
            for (let i = 0; i < n; i++) toxin(e.x, e.y, base + (i - (n - 1) / 2) * .2, 52);
            V.SND.bossShot();
          }
          while (e.hp > 0 && e.split.length && e.hp / e.maxHp < e.split[0]) {
            e.split.shift(); e.stage++; e.r = Math.max(6, e.r - 2); shake(.35);
            burst(e.x, e.y, 20, PCOL.colossus, 70);
            for (let i = 0; i < 2; i++) spawn('bug', e.x + rnd(-8, 8), e.y + rnd(-8, 8));
          }
          break;
        }
        case 'ebola': {
          // the head steers with a limited turn rate; the body follows the path it traced
          const rage = e.hp < e.maxHp / 2;
          snap = true;
          if (e.state === 'tele') {
            e.st -= edt; tx = Math.cos(e.dir) * 8; ty = Math.sin(e.dir) * 8;
            if (e.st <= 0) { e.state = 'lunge'; e.st = .8; }
          } else {
            const want = aimA + Math.sin(e.t * 2.2) * .9;
            const diff = ((want - e.dir + Math.PI * 3) % TAU) - Math.PI;
            e.dir += clamp(diff, -2.4 * edt, 2.4 * edt);
            let sp = e.spd * (rage ? 1.2 : 1);
            if (e.state === 'lunge') {
              sp *= 2.6; e.st -= edt;
              if (e.st <= 0) {
                e.state = 'move'; e.cd = rnd(4, 5.5) * D.fire;
                for (let i = -2; i <= 2; i++) toxin(e.x, e.y, aimA + i * .25, 52);
                V.SND.bossShot();
              }
            } else {
              e.cd -= edt;
              if (e.cd <= 0 && inside) { e.state = 'tele'; e.st = .6; V.SND.charge(); }
            }
            tx = Math.cos(e.dir) * sp; ty = Math.sin(e.dir) * sp;
          }
          break;
        }
        case 'mycelia': {
          // Mycelia Queen: a 3-arm spiral (4 when angry) that reverses every few seconds, spore blooms, and Candida buds
          const homeX = clamp(P.x + 85 + Math.cos(e.t * .5) * 40, W * .45, W - 30);   // swings in toward you, then back
          tx = (homeX - e.x) * .9; ty = Math.sin(e.t * .6) * 26 + (P.y - e.y) * .35;
          const rage = e.hp < e.maxHp / 2;
          e.flip -= edt;
          if (e.flip <= 0) { e.flip = rnd(4, 6); e.spinDir = -e.spinDir; }
          e.spin += edt * 1.7 * e.spinDir; e.fire -= edt;
          if (e.fire <= 0 && inside) {
            e.fire = .3 * D.fire;
            const arms = rage ? 4 : 3;
            for (let i = 0; i < arms; i++) toxin(e.x, e.y, e.spin + i * TAU / arms, 50);
          }
          e.aim -= edt;
          if (e.aim <= 0 && inside) { e.aim = (rage ? 1.2 : 1.7) * D.fire; const b0 = aimA; for (let i = -1; i <= 1; i++) toxin(e.x, e.y, b0 + i * .18, 70); }
          e.bloom -= edt;
          if (e.bloom <= 0 && inside) { e.bloom = rnd(4.5, 6) * D.fire; for (let i = 0; i < 24; i++) toxin(e.x, e.y, i * TAU / 24 + e.spin, 32); V.SND.spores(); }
          e.brood -= edt;
          if (e.brood <= 0 && inside) {
            e.brood = (rage ? 4 : 5.5) * D.fire;
            for (let i = 0; i < 3; i++) spawn('spore', e.x + rnd(-6, 6), e.y + rnd(-6, 6));
            if (rage) spawn('candida', e.x - 12, e.y + rnd(-10, 10));
          }
          break;
        }
        case 'measles': {
          // Measles Monarch: ten orbiting shield-virions soak shots; they regrow one at a time
          const want = clamp(P.x + 80, W * .4, W - 24);
          tx = clamp((want - e.x) * 1.2, -e.spd * 2, e.spd * 2); ty = clamp((P.y - e.y) * .9 + Math.sin(e.t * .7) * 20, -e.spd * 2, e.spd * 2);
          const rage = e.hp < e.maxHp / 2;
          e.spin += edt * (rage ? 1.9 : 1.3);
          e.guards.forEach((g, i) => { const a = e.spin + i * TAU / e.guards.length; g.x = e.x + Math.cos(a) * 19; g.y = e.y + Math.sin(a) * 19; g.flash = (g.flash || 0) - edt; });
          e.regrow -= edt;
          if (e.regrow <= 0) { e.regrow = (e.finalForm ? .9 : rage ? 1.8 : 2.4) * D.fire; const g = e.guards.find(g => !g.alive); if (g) { g.alive = true; g.hp = e.finalForm ? 9 : 5; } }
          e.pulse -= edt;
          if (e.pulse <= 0 && inside) { e.pulse = (e.finalForm ? 2.6 : rage ? 3.5 : 4.5) * D.fire; const pn = e.finalForm ? 24 : 16; for (let i = 0; i < pn; i++) toxin(e.x, e.y, e.spin + i * TAU / pn, 40); }
          e.fire -= edt;
          if (e.fire <= 0 && inside) {
            e.fire = (rage ? 1.1 : 1.5) * D.fire;
            const b0 = aimA;
            for (let i = -2; i <= 2; i++) toxin(e.x, e.y, b0 + i * .16, 60);
            if (rage) for (const g of e.guards) if (g.alive) toxin(g.x, g.y, Math.atan2(g.y - e.y, g.x - e.x), 40);  // the crown fires outward
            V.SND.bossShot();
          }
          break;
        }
        case 'botulist': {
          // The Botulist wanders between waypoints planting mines, and puffs slow gas clouds at you
          const rage = e.hp < e.maxHp / 2;
          const wdx = e.wx - e.x, wdy = e.wy - e.y, wd = Math.hypot(wdx, wdy) || 1;
          if (wd < 10) { e.wx = rnd(W * .3, W - 20); e.wy = rnd(TOP + 16, BOT - 16); }
          tx = wdx / wd * e.spd; ty = wdy / wd * e.spd;
          e.mine -= edt;
          if (e.mine <= 0 && inside) { e.mine = (rage ? .8 : 1.1) * D.fire; S.mines.push({ x: e.x, y: e.y, t: 0, fuse: 1.7 }); }
          e.spit -= edt;
          if (e.spit <= 0 && inside) { e.spit = (rage ? 1.1 : 1.5) * D.fire; const b0 = aimA; for (let i = -1; i <= 1; i++) toxin(e.x, e.y, b0 + i * .2, 62); }
          e.gas -= edt;
          if (e.gas <= 0 && inside) {
            e.gas = (rage ? 2 : 2.8) * D.fire;
            const b0 = aimA;
            for (let i = rage ? -1 : 0; i <= (rage ? 1 : 0); i++) S.toxins.push({ x: e.x, y: e.y, vx: Math.cos(b0 + i * .35) * 24, vy: Math.sin(b0 + i * .35) * 24, life: 7, r: 6, gas: true });
            V.SND.spores();
          }
          break;
        }
        case 'hydra': {
          // Prion Hydra: twitchy like a prion, fires bursts; splits on death (handled in kill)
          e.turn -= edt;
          if (e.turn <= 0) { e.turn = rnd(.5, .9); e.dir = aimA + rnd(-.8, .8); }
          const sp = e.spd * (1 + e.gen * .35);
          tx = Math.cos(e.dir) * sp; ty = Math.sin(e.dir) * sp;
          if (d < 45 && e.gen < 2) { tx -= ux * sp; ty -= uy * sp; }   // the smallest pieces come right at you
          e.fire -= edt;
          if (e.fire <= 0 && inside) {
            e.fire = (1.5 + e.gen * .3) * D.fire;
            const n = [7, 4, 2][e.gen], b0 = aimA;
            for (let i = 0; i < n; i++) toxin(e.x, e.y, b0 + (i - (n - 1) / 2) * .22, 54);
          }
          break;
        }
        case 'adeno': {
          // Adenovirus: swims to a spot on the vessel wall, anchors, and fires 3-way volleys
          if (!e.anchored) {
            if (e.ax === undefined) { e.ax = rnd(40, W - 40); e.ay = Math.random() < .5 ? TOP + 6 : BOT - 6; }
            const ax = e.ax - e.x, ay = e.ay - e.y, ad = Math.hypot(ax, ay) || 1;
            tx = ax / ad * e.spd; ty = ay / ad * e.spd;
            if (ad < 4) e.anchored = true;
          } else {
            snap = true; tx = ty = 0; e.kx = e.ky = 0;
            e.fire -= edt;
            if (e.fire <= 0) { e.fire = rnd(2, 2.8) * D.fire; const b0 = aimA; for (let i = -1; i <= 1; i++) toxin(e.x, e.y, b0 + i * .25, 50); V.SND.spit(); }
          }
          break;
        }
        case 'giardia': {
          // Giardia: harmless to touch, but latches on — slowing you and draining ATP — until you dash
          if (e.latched) {
            if (P.dashing > 0) {
              e.latched = false; const a = Math.atan2(P.dvy, P.dvx);
              e.kx = -Math.cos(a) * 140; e.ky = -Math.sin(a) * 140; burst(e.x, e.y, 8, PCOL.giardia, 40); break;
            }
            snap = true; tx = ty = 0; e.kx = e.ky = 0; e.x = P.x + e.lx; e.y = P.y + e.ly;
            S.drain = (S.drain || 0) + 3 * edt;
            if (S.drain >= 1) { const n = Math.floor(S.drain); S.drain -= n; S.atp = Math.max(0, S.atp - n); }
          } else {
            const w = Math.sin(e.t * 5) * 12; tx += -uy * w; ty += ux * w;
            if (d < e.r + 5 && P.dashInv <= 0 && !S.enemies.some(o => o.latched)) {
              e.latched = true; e.lx = clamp(e.x - P.x, -5, 5); e.ly = clamp(e.y - P.y, -5, 5);
              V.ui.toast(up(t('toast.giardia')), '#c8e080'); V.SND.hurt();
            }
          }
          break;
        }
        case 'borrelia': {
          // Borrelia: sweeps across the whole vessel in a corkscrew, turning around off-screen
          snap = true;
          if (!e.dirX) { e.dirX = e.x < W / 2 ? 1 : -1; e.baseY = e.y; }
          if ((e.dirX > 0 && e.x > W + 20) || (e.dirX < 0 && e.x < -20)) { e.dirX = -e.dirX; e.baseY = clamp(P.y + rnd(-24, 24), TOP + 16, BOT - 16); }
          tx = e.dirX * e.spd; ty = ((e.baseY + Math.sin(e.t * 5) * 14) - e.y) * 8;
          break;
        }
        case 'tetanus': {
          // Clostridium tetani: a sniper. Keeps its distance, paints you with a laser, then fires one very fast shot
          if (e.state === 'aim') {
            tx = ty = 0; e.st -= edt;
            if (e.st > .3) e.la = aimAt(e.x, e.y, 170);   // tracks you until the last moment, then locks
            if (e.st <= 0) { toxin(e.x, e.y, e.la, 170); V.SND.snipe(); e.state = 'move'; e.cd = rnd(2.2, 3.2) * D.fire; }
          } else {
            if (e.strafe === undefined) e.strafe = Math.random() < .5 ? -1 : 1;
            if (Math.random() < edt * .4) e.strafe = -e.strafe;
            const s = d > 125 ? 1 : d < 95 ? -1 : 0;
            tx = ux * e.spd * s - uy * e.spd * e.strafe * .7; ty = uy * e.spd * s + ux * e.spd * e.strafe * .7;
            if (e.x < 16) tx = Math.max(tx, e.spd); if (e.x > W - 16 && inside) tx = Math.min(tx, -e.spd);
            e.cd -= edt;
            if (e.cd <= 0 && inside && d < 175) { e.state = 'aim'; e.st = 1.1; e.la = aimA; V.SND.charge(); }
          }
          break;
        }
        case 'klebs': {
          // Klebsiella: a thick capsule blocks shots from the front, so it keeps turning to face you — hit it from the side
          const df = angDiff(Math.atan2(dy, dx), e.faceA);
          e.faceA += clamp(df, -1.5 * edt, 1.5 * edt);
          if (e.state === 'lunge') {
            snap = true; tx = Math.cos(e.faceA) * 110; ty = Math.sin(e.faceA) * 110; e.st -= edt;
            if (e.st <= 0) { e.state = 'move'; e.cd = rnd(2.5, 3.5); }
          } else {
            tx = Math.cos(e.faceA) * e.spd; ty = Math.sin(e.faceA) * e.spd;
            e.cd -= edt;
            if (e.cd <= 0 && d < 60 && Math.abs(df) < .3) { e.state = 'lunge'; e.st = .35; V.SND.charge(); }
          }
          break;
        }
        case 'corona': {
          // Coronavirus: a support caster — hides just behind the pack, where its crown speeds everyone up
          let cx = 0, cy = 0, n = 0;
          for (const o of S.enemies) if (o !== e && !o.boss && o.hp > 0 && o.type !== 'corona') { cx += o.x; cy += o.y; n++; }
          if (n) {
            cx /= n; cy /= n;
            const bx = cx - P.x, by = cy - P.y, bl = Math.hypot(bx, by) || 1;
            const gx = clamp(cx + bx / bl * 22, 14, W - 14), gy = clamp(cy + by / bl * 22, TOP + 10, BOT - 10);
            const gdx = gx - e.x, gdy = gy - e.y, gl = Math.hypot(gdx, gdy) || 1, k = Math.min(1, gl / 10);
            tx = gdx / gl * e.spd * k; ty = gdy / gl * e.spd * k;
          }
          if (d < 50) { tx -= ux * e.spd; ty -= uy * e.spd; }
          break;
        }
        case 'trypan': { const w = Math.sin(e.t * 9) * 22; tx += -uy * w; ty += ux * w; break; }
        case 'quorum': {
          // Quorum: a hive that commands its drone swarm — they ring it, charge you one by one, or form a firing wall
          const rage = e.hp < e.maxHp / 2;
          tx = ((W - 50) - e.x) * 1.1; ty = clamp((P.y - e.y) * .7, -e.spd, e.spd);
          const drones = S.enemies.filter(o => o.type === 'drone' && o.hp > 0);
          e.brood -= edt;
          if (e.brood <= 0 && inside && drones.length < (rage ? 10 : 8)) {
            e.brood = (rage ? .7 : 1) * D.fire;
            const dr = spawn('drone', e.x, e.y); dr.hive = e; dr.slot = rnd(0, TAU); dr.idx = e.cIdx++;
          }
          e.modeT -= edt;
          if (e.modeT <= 0) { e.mode = { ring: 'charge', charge: 'guard', guard: 'ring' }[e.mode]; e.modeT = rnd(5, 5.5); e.cT = .4; V.SND.charge(); }
          if (e.mode === 'charge') {
            e.cT -= edt;
            if (e.cT <= 0) { e.cT = (rage ? .45 : .7) * D.fire; const dr = drones.find(o => o.state !== 'dash' && o.state !== 'tele'); if (dr) { dr.state = 'tele'; dr.st = .35; } }
          }
          e.fire -= edt;
          if (e.fire <= 0 && inside) {
            if (e.mode === 'guard') { e.fire = (rage ? 1.1 : 1.5) * D.fire; for (let i = -2; i <= 2; i++) toxin(e.x, e.y, aimA + i * .2, 56); }
            else { e.fire = (rage ? 1.8 : 2.4) * D.fire; for (let i = 0; i < 10; i++) toxin(e.x, e.y, e.t + i * TAU / 10, 42); }
            V.SND.bossShot();
          }
          break;
        }
        case 'drone': {
          const h = e.hive;
          if (!h || h.hp <= 0) { const w = Math.sin(e.t * 6) * 10; tx += -uy * w; ty += ux * w; break; }
          if (e.state === 'tele') { tx = ty = 0; e.st -= edt; if (e.st <= 0) { e.state = 'dash'; e.st = .7; e.dx = ux; e.dy = uy; } break; }
          if (e.state === 'dash') { snap = true; tx = e.dx * 150; ty = e.dy * 150; e.st -= edt; if (e.st <= 0) e.state = 'move'; break; }
          e.slot += edt * (h.mode === 'ring' ? 1.6 : .6);
          let gx, gy;
          if (h.mode === 'guard') {   // a wall between the hive and you
            const i = (e.idx % 8) - 3.5, bx = P.x - h.x, by = P.y - h.y, bl = Math.hypot(bx, by) || 1;
            gx = h.x + bx / bl * 28 - by / bl * i * 7; gy = h.y + by / bl * 28 + bx / bl * i * 7;
          } else { gx = h.x + Math.cos(e.slot) * 22; gy = h.y + Math.sin(e.slot) * 22; }
          tx = clamp((gx - e.x) * 4, -120, 120); ty = clamp((gy - e.y) * 4, -120, 120);
          if (h.mode === 'ring' && inside) { e.fire = (e.fire ?? rnd(1, 3)) - edt; if (e.fire <= 0) { e.fire = rnd(2.5, 3.5) * D.fire; toxin(e.x, e.y, aimA, 50); } }
          break;
        }
        case 'shifter': {
          // The Shifter rewrites its strategy at each third of its health: hunter → mirror → blinker
          const ph = e.hp < e.maxHp / 3 ? 2 : e.hp < e.maxHp * 2 / 3 ? 1 : 0;
          if (ph !== e.phase) {
            e.phase = ph; e.invT = 1; e.state = 'move'; e.cd = 1.2; burst(e.x, e.y, 24, PCOL.shifter, 70); shake(.3); V.SND.blink();
            V.ui.toast(up(t('toast.shift')), ['#ff5060', '#50a0ff', '#60e070'][ph]);
          }
          e.invT -= edt; e.fire -= edt;
          if (ph === 0) {
            // hunter: circles in close, firing lead-aimed triples
            const s = d > 55 ? 1 : -.6; tx = ux * e.spd * s - uy * e.spd * .8; ty = uy * e.spd * s + ux * e.spd * .8;
            if (e.fire <= 0 && inside) {
              e.fire = .9 * D.fire; e.vol = (e.vol || 0) + 1;
              for (let i = -1; i <= 1; i++) toxin(e.x, e.y, aimA + i * .15, 70);
              if (e.vol % 3 === 0) for (let i = 0; i < 10; i++) toxin(e.x, e.y, e.t + i * TAU / 10, 44);
              V.SND.bossShot();
            }
          } else if (ph === 1) {
            // mirror: stands where your reflection would be and fires back across the vessel
            const gx = clamp(W - P.x, 16, W - 16), gy = clamp(TOP + BOT - P.y, TOP + 10, BOT - 10);
            tx = clamp((gx - e.x) * 3, -e.spd * 2.5, e.spd * 2.5); ty = clamp((gy - e.y) * 3, -e.spd * 2.5, e.spd * 2.5);
            if (d < 40) { tx -= ux * e.spd * 2; ty -= uy * e.spd * 2; }
            if (e.fire <= 0 && inside) { e.fire = .75 * D.fire; for (let i = -2; i <= 2; i++) toxin(e.x, e.y, aimA + i * .12, 62); V.SND.bossShot(); }
          } else if (e.state === 'tele') {
            tx = ty = 0; e.st -= edt;
            if (e.st <= 0) {
              burst(e.x, e.y, 14, PCOL.shifter, 60);
              e.x = e.tx; e.y = e.ty; e.vx = e.vy = e.kx = e.ky = 0;
              burst(e.x, e.y, 14, PCOL.shifter, 60); V.SND.blink();
              e.state = 'move'; e.cd = rnd(1.5, 2.1) * D.fire;
              for (let i = 0; i < 14; i++) toxin(e.x, e.y, e.t + i * TAU / 14, 48);
              for (let i = -1; i <= 1; i++) toxin(e.x, e.y, aimAt(e.x, e.y, 64) + i * .18, 64);
            }
          } else {
            // blinker: teleports behind you — opposite where you're aiming — and bursts
            const w = Math.sin(e.t * 2) * 16; tx += -uy * w; ty += ux * w;
            if (d < 40) { tx = -ux * e.spd; ty = -uy * e.spd; }
            if (e.fire <= 0 && inside) { e.fire = .8 * D.fire; toxin(e.x, e.y, aimA, 74); }
            e.cd -= edt;
            if (e.cd <= 0 && inside) {
              const a = P.aim + Math.PI + rnd(-.5, .5);
              e.tx = clamp(P.x + Math.cos(a) * 58, 14, W - 14); e.ty = clamp(P.y + Math.sin(a) * 58, TOP + 12, BOT - 12);
              e.state = 'tele'; e.st = .55;
            }
          }
          break;
        }
        case 'boss': {
          e.fire -= edt; e.brood -= edt;
          const rage = e.hp < e.maxHp / 2;
          if (e.fire <= 0 && e.x < W - 10) {
            e.fire = (rage ? 1.8 : 2.6) * D.fire;
            const n = rage ? 14 : 10;
            for (let i = 0; i < n; i++) toxin(e.x, e.y, e.t + i * TAU / n, 42);
            V.SND.bossShot();
          }
          if (e.brood <= 0) { e.brood = rage ? 4.5 : 6; spawn('virus', e.x, e.y - 12); spawn('virus', e.x, e.y + 12); }
          break;
        }
        default: {
          // expansion pathogens (expansion-ai.js) get the same per-frame view of the world
          const h = V.AI?.[e.type];
          if (!h) break;
          Object.assign(X, { dt: edt, dx, dy, d, ux, uy, inside, aimA, tx, ty, snap });
          if (h(e, X) === 'gone') continue;
          ({ tx, ty, snap } = X);
        }
      }
      // flankers fan out and come at you from the sides instead of queueing up in your line of fire
      const ax = Math.cos(P.aim), ay = Math.sin(P.aim), side = ax * (e.y - P.y) - ay * (e.x - P.x), au = ax * ux + ay * uy;
      // (tangent step f·(−uy, ux) changes 'side' by f·au, so f = want·sign(au) pushes toward the wanted side of your aim line)
      const toward = want => want * (au >= 0 ? 1 : -1);
      if (V.FLANKERS.has(e.type) && !snap && inside && d > 30 && d < 110) {
        // pincer: split to whichever side of your aim line has fewer of them
        e.flankT = (e.flankT || 0) - edt;
        if (e.flankT <= 0) {
          e.flankT = rnd(1.2, 1.8);
          if (Math.random() < sm) {
            let l = 0, r = 0;
            for (const o of S.enemies) if (o !== e && o.hp > 0 && V.FLANKERS.has(o.type) && Math.hypot(o.x - P.x, o.y - P.y) < 120) (ax * (o.y - P.y) - ay * (o.x - P.x) > 0 ? r++ : l++);
            e.flank = toward(r > l ? -1 : 1);
          }
        }
        if (e.flank === undefined) e.flank = Math.random() < .5 ? -1 : 1;
        const f = sm * .55 * Math.min(1, (d - 30) / 40); tx += -uy * e.flank * e.spd * f; ty += ux * e.flank * e.spd * f;
      }
      // shooters step out of your line of fire while you're shooting at them
      if (!snap && inside && d < 150 && (SHOOTERS.has(e.type) || e.elite || e.mutant) && G.clock - (P.shotAt || -9) < .5) {
        const off = Math.abs(Math.atan2(side, ax * (e.x - P.x) + ay * (e.y - P.y)));
        if (off < .22) { const f = toward(side >= 0 ? 1 : -1) * e.spd * .9 * sm; tx += -uy * f; ty += ux * f; }
      }
      // badly hurt, some pathogens break off for a moment before coming back
      if (!e.boss && !e.fled && e.maxHp >= 4 && e.hp < e.maxHp * .35 && FLEE.has(e.type)) { e.fled = true; if (Math.random() < sm * .6) e.fleeT = 1.3; }
      if (e.fleeT > 0 && !snap) { e.fleeT -= edt; tx = -ux * e.spd * 1.2 - uy * e.spd * .5; ty = -uy * e.spd * 1.2 + ux * e.spd * .5; }
      // quick pathogens sidestep antibodies that are about to hit them
      const skill = V.DODGE[e.type];
      if (skill && inside && !snap && e.state !== 'aim') {
        e.dodgeT = (e.dodgeT || 0) - edt;
        if (e.dodgeT <= 0) for (const b of S.bullets) {
          const rx = e.x - b.x, ry = e.y - b.y, bv = Math.hypot(b.vx, b.vy) || 1, along = (rx * b.vx + ry * b.vy) / bv;
          if (along < 0 || along > 45) continue;
          const perp = (rx * b.vy - ry * b.vx) / bv;
          if (Math.abs(perp) > e.r + 3) continue;
          if (Math.random() < skill * sm * .6) { const sd = perp >= 0 ? 1 : -1, imp = 70 + e.spd; e.kx += b.vy / bv * sd * imp; e.ky -= b.vx / bv * sd * imp; }
          e.dodgeT = rnd(.6, 1.1) / skill; break;
        }
      }
      if (snap) { e.vx = tx; e.vy = ty; }
      else { e.vx += (tx - e.vx) * Math.min(1, edt * 3); e.vy += (ty - e.vy) * Math.min(1, edt * 3); }
      e.x += (e.vx + e.kx) * edt; e.y += (e.vy + e.ky) * edt;
      e.kx *= .85; e.ky *= .85;
      // anything that wanders off-screen for too long is nudged back in, so a wave can never stall on a straggler
      if (!inside && !e.boss && e.state !== 'hidden') { e.out = (e.out || 0) + edt; if (e.out > 7) { e.x = clamp(e.x, 14, W - 14); e.out = 0; e.bx = undefined; } } else e.out = 0;
      const ry = e.type === 'plague' ? 6 : e.r;
      e.y = clamp(e.y, TOP + ry, BOT - ry);
      if (e.type === 'ebola') traceBody(e);
      if (e.elite && inside) {
        e.efire -= edt;
        if (e.efire <= 0) { e.efire = rnd(...V.ELITE.fire) * D.fire; toxin(e.x, e.y, aimA, 56); }
      }
      if (e.mutant && inside) {
        e.mfire -= edt;
        if (e.mfire <= 0) {
          const [kind, n, v, iv] = V.MUTANT.pattern[e.type];
          e.mfire = iv * D.fire;
          if (kind === 'ring') for (let i = 0; i < n; i++) toxin(e.x, e.y, e.t * 1.7 + i * TAU / n, v);
          else if (kind === 'fan') { const b0 = aimAt(e.x, e.y, v); for (let i = 0; i < n; i++) toxin(e.x, e.y, b0 + (i - (n - 1) / 2) * .22, v); }
          else if (kind === 'aim') toxin(e.x, e.y, aimAt(e.x, e.y, v), v);
          else S.toxins.push({ x: e.x, y: e.y, vx: 0, vy: 0, life: 2.5 });
          if (kind !== 'trail') V.SND.spit();
        }
      }
      if (e.boss && !e.finalForm && e.hp < e.maxHp * .35 && V.BOSS_ORDER.slice(-5).includes(e.type)) {
        // FINAL FORM: every one of the final five changes up its fight at 35% health
        e.finalForm = true; e.fireMul = (e.fireMul || 1) * .75; e.invT = Math.max(e.invT || 0, .8);
        burst(e.x, e.y, 50, ['#ff3040', '#ffffff', ...(PCOL[e.type] || [])], 110); shake(.6); V.SND.boss();
        for (let i = 0; i < 20; i++) toxin(e.x, e.y, i * TAU / 20, 44);
        V.ui.banner(t('ff.title'), t('ff.sub', { name: V.tx.bossName(e.type) }));   // (V.tx: plain tx is the target-x variable in this loop)
      }
      if (e.boss) {
        e.age += edt;
        if (e.type !== 'shifter' && e.invT > 0) e.invT -= edt;   // (the Shifter runs its own timer)
        // enrage only after a boss outlasts a fair kill time for your build (huge late bosses would otherwise always enrage)
        e.enrageAt ??= Math.max(D.enrage, e.maxHp / Math.max(1, game.playerDPS()) * 1.25);
        if (e.age > e.enrageAt) {
          if (!e.enraged) { e.enraged = true; e.enrT = 0; V.ui.toast(V.t('toast.enraged', { name: V.tx.bossName(e.type) }).toLocaleUpperCase(V.i18n.lang), '#ff5a6e'); V.SND.boss(); }
          e.enrT -= edt;
          if (e.enrT <= 0) { e.enrT = 3 * D.fire; for (let i = 0; i < 14; i++) toxin(e.x, e.y, e.age + i * TAU / 14, 50); }
        }
      }
      if (e.type !== 'giardia' && !e.harmless && !game.hiddenOrCloaked(e) && touches(e, P.x, P.y, 3.5)) hurt(e.x, e.y, e.type);
      if (e.guards) for (const g of e.guards) if (g.alive && Math.hypot(g.x - P.x, g.y - P.y) < (e.guardR || 4) + 1) hurt(g.x, g.y, e.type);
    }
    stamp(); D.fire = baseFire; D.toxinSpd = baseTox;
    S.enemies = S.enemies.filter(e => e.hp > 0);
    separate(S.enemies);

    // toxins
    for (const t of S.toxins) {
      t.x += t.vx * edt0; t.y += t.vy * edt0; t.life -= edt0;
      if (t.y < TOP || t.y > BOT || t.x < -6 || t.x > W + 6) t.life = 0;
      if (t.life > 0 && !t.near && (t.vx || t.vy) && Math.hypot(t.x - P.x, t.y - P.y) < 11) {   // a near miss: learn which way you slipped past
        t.near = true; const c = t.vx * P.svy - t.vy * P.svx; if (Math.abs(c) > 200) S.dodgeLearn = (S.dodgeLearn || 0) * .8 + Math.sign(c) * .2;
      }
      if (t.life > 0 && P.fx.mirror > 0 && Math.hypot(t.x - P.x, t.y - P.y) < (t.r || 2) + 4) {   // Reflective Coat: send it back as an antibody
        t.life = 0; const a = Math.atan2(-t.vy, -t.vx) || P.aim;
        S.bullets.push({ x: t.x, y: t.y, vx: Math.cos(a) * 180, vy: Math.sin(a) * 180, life: 1.2, dmg: P.dmg * 1.5, pierce: false, homing: true, hit: null }); burst(t.x, t.y, 3, ['#e0f0ff']);
      }
      if (t.life > 0 && Math.hypot(t.x - P.x, t.y - P.y) < (t.r || 2) + 2) { t.life = 0; if (P.fx.antitox > 0) burst(t.x, t.y, 3, ['#80ffa0']); else if (t.confuse) confuse(); else t.para ? paralyse() : hurt(undefined, undefined, t.src); }
    }
    S.toxins = S.toxins.filter(t => t.life > 0);

    // Botulist mines: blink faster and faster, then burst into a ring
    for (const m of S.mines) {
      m.t += edt0;
      if (m.t >= m.fuse) { m.gone = true; const n = m.small ? 6 : 12; for (let i = 0; i < n; i++) toxin(m.x, m.y, i * TAU / n + .2, m.small ? 44 : 52); burst(m.x, m.y, 10, ['#ff4a2a', '#c0d090'], 50); V.SND.boom(); }
    }
    S.mines = S.mines.filter(m => !m.gone);

    // ATP orbs — drift to you within reach of your magnet (and all fly in at wave clear)
    for (const o of S.orbs) {
      o.t += dt; o.vx *= .9; o.vy *= .9;
      const dx = P.x - o.x, dy = P.y - o.y, d = Math.hypot(dx, dy) || 1;
      if (d < P.magnet + 34 || S.phase === 'clear') { const pull = S.phase === 'clear' ? 220 : 120; o.vx += dx / d * pull * dt * 6; o.vy += dy / d * pull * dt * 6; }
      o.x += o.vx * dt; o.y += o.vy * dt;
      if (d < 7) { S.atp += o.val; o.gone = true; if (G.clock - (S.coinT || 0) > .06) { V.SND.coin(); S.coinT = G.clock; } }
    }
    S.orbs = S.orbs.filter(o => !o.gone);

    // pickups — pulled in by the magnet, and all of them at wave clear
    for (const k of S.pickups) {
      k.t += dt;
      const dx = P.x - k.x, dy = P.y - k.y, d = Math.hypot(dx, dy) || 1;
      if (d < P.magnet || S.phase === 'clear') { const pull = S.phase === 'clear' ? 160 : 70; k.x += dx / d * pull * dt; k.y += dy / d * pull * dt; }
      if (d < 8) {
        k.t = 99; collect(k.kind);
        burst(k.x, k.y, 10, [V.POW[k.kind].color, '#fffbe0']);
      }
    }
    S.pickups = S.pickups.filter(k => k.t < 11);

    stepFx(S, dt);
    V.music.setIntense(S.enemies.some(e => e.boss));
    V.tut?.update(dt);
    V.ui.hud();
  };

  // ---------- expansion power-ups ----------
  game.clonePos = P => ({ x: P.x - 4, y: P.y + (P.y < (TOP + BOT) / 2 ? 14 : -14) });
  // Antibody Halo: six orbiting antibodies that eat toxins and grind anything they touch
  game.haloPts = P => Array.from({ length: 6 }, (_, i) => { const a = G.clock * 3 + i * TAU / 6; return [P.x + Math.cos(a) * 15, P.y + Math.sin(a) * 15]; });
  function halo(S, P, dt) {
    if (!(P.fx.halo > 0)) return;
    const pts = game.haloPts(P);
    for (const [x, y] of pts) {
      for (const t of S.toxins) if (t.life > 0 && Math.hypot(t.x - x, t.y - y) < 4 + (t.r || 0)) { t.life = 0; burst(t.x, t.y, 2, ['#a0fff0']); }
      for (const e of S.enemies) if (e.hp > 0 && !cloaked(e) && touches(e, x, y, 2)) strike(e, P.dmg * 6 * dt, true);
    }
  }
  // NK Cell: an ally that dashes from pathogen to pathogen
  function nkCell(S, P, dt) {
    if (!(P.fx.nk > 0)) { S.nk = null; return; }
    const N = S.nk ??= { x: P.x, y: P.y, cd: 0, t: 0 };
    N.t += dt; N.cd -= dt;
    let tgt = null, bd = 1e9;
    tgt = bestTarget(N.x, N.y, 400, .3, e => e !== S.allies[0]?.tgt) || bestTarget(N.x, N.y, 400, .3); bd = tgt ? Math.hypot(tgt.x - N.x, tgt.y - N.y) : 1e9;
    const gx = tgt ? tgt.x : P.x - 12, gy = tgt ? tgt.y : P.y - 10, dx = gx - N.x, dy = gy - N.y, d = Math.hypot(dx, dy) || 1;
    const sp = tgt ? (N.cd > 0 ? 60 : 190) : 90;
    N.x += dx / d * Math.min(d, sp * dt); N.y += dy / d * Math.min(d, sp * dt);
    if (tgt && N.cd <= 0 && d < tgt.r + 4) { strike(tgt, P.dmg * 7, true); N.cd = .4; burst(N.x, N.y, 6, ['#ff6a9a', '#ffd0e0'], 50); V.SND.hit(); }
  }

  function stepFx(S, dt) {
    for (const g of S.ghosts) g.life -= dt;
    S.ghosts = S.ghosts.filter(g => g.life > 0);
    for (const p of S.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .92; p.vy *= .92; p.life -= dt; }
    S.parts = S.parts.filter(p => p.life > 0);
    for (const f of S.floaters) f.t += dt;
    S.floaters = S.floaters.filter(f => f.t < .9);
    S.shake -= dt;
  }

  // Complement: the hit bursts, splashing everything close by
  function splash(x, y, hitEnemy, amount) {
    for (const e of [...G.S.enemies]) {
      if (e === hitEnemy || e.hp <= 0 || game.hiddenOrCloaked(e) || !touches(e, x, y, 12)) continue;
      strike(e, amount, false);
    }
    burst(x, y, 6, ['#4affc0', '#b0ffe8'], 45);
    if (G.clock - (G.S.boomT || 0) > .08) { V.SND.boom(); G.S.boomT = G.clock; }
  }
  // Fever: everything within 30px takes a little damage every 0.3s
  function fever(S, P, dt) {
    if (P.fx.fever <= 0) return;
    P.feverT -= dt;
    if (P.feverT > 0) return;
    P.feverT = .3;
    let hit = false;
    for (const e of [...S.enemies]) {
      if (e.hp <= 0 || game.hiddenOrCloaked(e) || !touches(e, P.x, P.y, 30)) continue;
      strike(e, P.dmg * .85, false); hit = true;
      burst(e.x, e.y, 2, ['#ff4a2a', '#ffe066'], 25);
    }
    if (hit) V.SND.fever();
  }
  // Phage Swarm: little seekers that prefer bacteria (and hit them twice as hard)
  const BACTERIA = new Set(['bact', 'mini', 'salmo', 'pseudo', 'strep', 'bug', 'plague', 'tb', 'colossus']);
  function phages(S, dt) {
    for (const f of S.phages) {
      f.t += dt; f.life -= dt;
      let tgt = null, bd = 1e9;
      for (const e of S.enemies) {
        if (e.hp <= 0 || e.x < 0 || e.x > W || game.hiddenOrCloaked(e)) continue;
        const d = Math.hypot(e.x - f.x, e.y - f.y) * (BACTERIA.has(e.type) ? .5 : 1);
        if (d < bd) { bd = d; tgt = e; }
      }
      if (tgt) {
        const want = Math.atan2(tgt.y - f.y, tgt.x - f.x), cur = Math.atan2(f.vy, f.vx);
        const diff = ((want - cur + Math.PI * 3) % TAU) - Math.PI, a = cur + clamp(diff, -6 * dt, 6 * dt);
        const sp = Math.min(140, Math.hypot(f.vx, f.vy) + 120 * dt);
        f.vx = Math.cos(a) * sp; f.vy = Math.sin(a) * sp;
      }
      f.x += f.vx * dt; f.y = clamp(f.y + f.vy * dt, TOP + 2, BOT - 2);
      if (tgt && touches(tgt, f.x, f.y, 2)) {
        strike(tgt, (BACTERIA.has(tgt.type) ? 8 : 4) * G.P.dmg, false);
        burst(f.x, f.y, 8, ['#d8d8f0', '#ffffff'], 50); V.SND.hit();
        f.life = 0;
      }
    }
    S.phages = S.phages.filter(f => f.life > 0 && f.x > -10 && f.x < W + 10);
  }

  // The Filament's body: 14 beads spaced along the path the head has travelled.
  function traceBody(e) {
    const last = e.pts[e.pts.length - 1];
    if (!last || Math.hypot(e.x - last[0], e.y - last[1]) >= 2) e.pts.push([e.x, e.y]);
    const SEGS = 14, GAP = 3;
    if (e.pts.length > SEGS * GAP + 1) e.pts.splice(0, e.pts.length - (SEGS * GAP + 1));
    e.segPts = [];
    for (let i = 1; i <= SEGS; i++) { const p = e.pts[e.pts.length - 1 - i * GAP]; if (p) e.segPts.push(p); }
  }

  // Monoclonal antibodies bend toward the nearest visible target.
  // rate/reach/cone: aim assist uses a gentle version that only bends toward targets near where you're aiming
  function steer(b, enemies, dt, rate = 7, reach = 90, cone) {
    // curve toward whichever target in reach matters most, not merely the nearest
    const t = bestTarget(b.x, b.y, reach, .9, cone === undefined ? null : e => Math.abs(((Math.atan2(e.y - b.y, e.x - b.x) - cone + Math.PI * 3) % TAU) - Math.PI) < .45);
    if (!t) return;
    const want = Math.atan2(t.y - b.y, t.x - b.x), cur = Math.atan2(b.vy, b.vx), sp = Math.hypot(b.vx, b.vy);
    const diff = ((want - cur + Math.PI * 3) % TAU) - Math.PI;
    const a = cur + clamp(diff, -rate * dt, rate * dt);
    b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
  }

  function addAlly(perm) {
    const { S, P } = G;
    S.allies.push({ x: P.x - 10, y: P.y, vx: 0, vy: 0, t: rnd(0, 3), perm });
    burst(P.x - 10, P.y, 12, ['#e8e0ff', '#6a5ac8'], 40);
  }

  // Neutrophil orbit + macrophage allies (permanent ones come from upgrades, temporary ones from pickups).
  function allies(S, P, dt) {
    const orbs = game.orbs(P);
    if (orbs.length) {
      for (const [ox, oy] of orbs) {
        for (const e of [...S.enemies]) {
          if (e.hp <= 0 || game.hiddenOrCloaked(e) || !touches(e, ox, oy, 2) || (e.orbT || 0) > G.clock) continue;
          e.orbT = G.clock + .25; V.SND.hit(); burst(ox, oy, 3, ['#f0f0ff', '#8a7ad8']);
          strike(e, P.dmg, false);
        }
        for (const t of S.toxins) if (Math.hypot(t.x - ox, t.y - oy) < 4) { t.life = 0; burst(t.x, t.y, 3, ['#c8ff7a']); }
      }
    }
    // keep the ally roster in sync with upgrades and the pickup timer
    while (S.allies.filter(a => a.perm).length < (P.perm.macro || 0)) addAlly(true);
    for (const a of S.allies) if (!a.perm && P.fx.macro <= 0) { burst(a.x, a.y, 16, ['#e8e0ff', '#6a5ac8'], 50); a.gone = true; }
    S.allies = S.allies.filter(a => !a.gone);
    S.allies.forEach((A, i) => macrophage(S, P, A, i, dt));
  }
  function macrophage(S, P, A, i, dt) {
    A.t += dt;
    // macrophages guard you: they go after whatever threatens you most (spread across different targets when there are several)
    const tgt = bestTarget(A.x, A.y, 400, .35, e => !S.allies.some((o, j) => j < i && o.tgt === e)) || bestTarget(A.x, A.y, 400, .35);
    A.tgt = tgt;
    const tx = tgt ? tgt.x : P.x - 14 - i * 6, ty = tgt ? tgt.y : P.y + (i % 2 ? 8 : -8) * Math.min(i, 1);
    const dx = tx - A.x, dy = ty - A.y, d = Math.hypot(dx, dy) || 1, sp = tgt ? 72 : Math.min(72, d * 3);
    A.vx += (dx / d * sp - A.vx) * Math.min(1, dt * 4); A.vy += (dy / d * sp - A.vy) * Math.min(1, dt * 4);
    A.x = clamp(A.x + A.vx * dt, 6, W - 6); A.y = clamp(A.y + A.vy * dt, TOP + 6, BOT - 6);
    for (const e of [...S.enemies]) {
      const key = 'macT' + i;   // each ally has its own bite cooldown
      if (e.hp <= 0 || game.hiddenOrCloaked(e) || !touches(e, A.x, A.y, 5) || (e[key] || 0) > G.clock) continue;
      e[key] = G.clock + .3; V.SND.hit(); burst(e.x, e.y, 4, ['#e8e0ff', '#6a5ac8']);
      strike(e, e.boss ? 2 : 3, true);
    }
  }
  // Orbiting white cells: an inner permanent ring (2 per Neutrophil Guard level) plus an outer ring while the pickup lasts.
  game.orbs = P => {
    const out = [], perm = (P.perm.neutro || 0) * 2, temp = P.fx.neutro > 0 ? 2 : 0;
    for (let k = 0; k < perm; k++) { const a = G.clock * 4 + k * TAU / perm; out.push([P.x + Math.cos(a) * 14, P.y + Math.sin(a) * 14, false]); }
    for (let k = 0; k < temp; k++) {
      const r = perm ? 21 : 14, a = (perm ? -3.2 : 4) * G.clock + k * Math.PI;
      out.push([P.x + Math.cos(a) * r, P.y + Math.sin(a) * r, true]);
    }
    return out;
  };

  // Nudge overlapping pathogens apart so swarms don't collapse into a single pixel-stack.
  function separate(es) {
    for (let i = 0; i < es.length; i++) {
      const a = es[i]; if (a.boss || a.type === 'strep') continue;
      for (let j = i + 1; j < es.length; j++) {
        const b = es[j]; if (b.boss || b.type === 'strep') continue;
        const dx = b.x - a.x, dy = b.y - a.y, min = a.r + b.r, d2 = dx * dx + dy * dy;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2) || .01, push = (min - d) / 2, ux = d2 ? dx / d : 1, uy = d2 ? dy / d : 0;
        a.x -= ux * push; a.y -= uy * push; b.x += ux * push; b.y += uy * push;
      }
    }
  }
  game.comboMult = comboMult;
  game.hurtAt = (x, y, src) => hurt(x, y, src);
  game.strikeAt = (e, amount) => strike(e, amount, true);
  // for the admin console (admin.js)
  game.admin = { kill: e => kill(e), spawn: (...a) => spawn(...a), startWave: n => startWave(n), collect: k => collect(k) };
})();
