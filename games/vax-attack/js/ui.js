// Everything outside the canvas: HUD, overlays, the between-wave break, field guide, saved settings.
(() => {
  const V = window.VAX;
  const { t, tx } = V;
  const $ = id => document.getElementById(id);
  const ui = V.ui = {};

  // ---------- saved settings & records ----------
  // settings are shared by everyone on this browser; records and saved runs belong to the signed-in profile
  const SCOPED = new Set(['best', 'stats', 'run', 'history']);
  const skey = k => SCOPED.has(k) ? V.profile.key('vax-attack-' + k) : 'vax-attack-' + k;
  const load = (k, d) => { try { const v = localStorage.getItem(skey(k)); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(skey(k), JSON.stringify(v)); } catch (e) {} };
  ui.load = load; ui.save = save;
  ui.best = load('best', 0);
  ui.diff = V.DIFFICULTY[load('diff', 'normal')] && V.meta.isUnlocked(load('diff', 'normal')) ? load('diff', 'normal') : 'normal';
  ui.saveBest = () => save('best', ui.best);
  ui.stats = Object.assign({ bestWave: 0, bestRush: 0, kills: 0, runs: 0 }, load('stats', {}));
  ui.gameMode = ['rush', 'daily'].includes(load('mode', 'waves')) ? load('mode', 'waves') : 'waves';
  ui.setMode = m => { ui.gameMode = m; save('mode', m); };

  // gameplay + audio preferences
  ui.shake = load('shake', true) !== false;
  ui.popups = load('popups', true) !== false;
  ui.hpbars = load('hpbars', true) !== false;
  ui.glow = load('glow', true) !== false;   // soft lighting, shadows and vignette (turn off on slow machines)
  ui.autofire = load('autofire', true) !== false;   // on by default — no sore fingers
  ui.aimAssist = load('aimAssist', false) === true;  // shots bend gently toward what you're aiming at (off unless you turn it on)
  V.audio.muted = !!load('muted', false);
  V.audio.sfxOn = load('sfxOn', true) !== false;
  V.music.on = load('music', true) !== false;
  Object.assign(V.audio.vol, load('vol', {}));
  ui.track = load('track', 'auto');   // Soundtrack setting: 'auto' or a pinned track id
  ui.set = (key, val) => {
    if (key === 'music') V.music.on = val;
    else if (key === 'sfxOn') V.audio.sfxOn = val;
    else ui[key] = val;
    save(key, val); V.audio.apply();
  };
  ui.setVolume = (bus, v) => { V.audio.vol[bus] = v; save('vol', V.audio.vol); V.audio.apply(); };

  // called when a run ends (death or quitting from the pause menu)
  ui.recordRun = S => {
    if (!S || S.wave < 1 || S.bot || S.cheated) return;
    // run history: the last 20 runs, newest first
    const P = V.G.P, died = P && P.hp <= 0;
    const h = load('history', []);
    h.unshift({ at: Date.now(), mode: S.mode, diff: S.diff, wave: S.mode === 'rush' ? bossesBeaten(S) : S.wave, score: S.score, kills: S.kills,
      bosses: S.bossKills, time: Math.round(S.time || 0), end: S.won ? 'won' : died ? (S.lastHit || 'toxin') : 'quit' });
    save('history', h.slice(0, 20));
    ui.stats.runs++; ui.stats.kills += S.kills;
    if (S.mode === 'rush') ui.stats.bestRush = Math.max(ui.stats.bestRush, bossesBeaten(S));
    else ui.stats.bestWave = Math.max(ui.stats.bestWave, S.wave);
    save('stats', ui.stats);
  };
  // in Boss Rush, dying mid-fight means the current boss doesn't count
  const bossesBeaten = S => S.phase === 'fight' ? S.wave - 1 : S.wave;
  ui.bossesBeaten = bossesBeaten;
  ui.resetRecords = () => { ui.best = 0; ui.stats = { bestWave: 0, bestRush: 0, kills: 0, runs: 0 }; save('best', 0); save('stats', ui.stats); };

  // ---------- overlays ----------
  // Menus take focus themselves (not a button) and ignore clicks for a moment after opening,
  // so a held Space / mouse button from gameplay can't pick something by accident.
  const OVERLAYS = ['upgrade', 'pause', 'over', 'victory'];
  let shownAt = 0;
  ui.show = name => {
    for (const o of OVERLAYS) $(o).hidden = o !== name;
    shownAt = performance.now();
    if (name) $(name).focus({ preventScroll: true });
    else if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  };
  ui.ready = (ms = 450) => performance.now() - shownAt >= ms;
  const guard = fn => () => { if (ui.ready()) fn(); };

  // ---------- difficulty ----------
  // Hard and Nightmare unlock by reaching a wave on the tier below; the note under the buttons says how
  ui.paintDiff = () => {
    const daily = ui.gameMode === 'daily';
    for (const b of document.querySelectorAll('[data-diff]')) {
      const d = b.dataset.diff, locked = !V.meta.isUnlocked(d);
      b.classList.toggle('locked', locked); b.disabled = daily;
      b.setAttribute('aria-pressed', String(daily ? d === 'normal' : d === ui.diff));
    }
    const note = document.getElementById('diffNote');
    if (!note) return;
    const lockedTier = V.DIFF_ORDER.find(d => !V.meta.isUnlocked(d));
    note.classList.remove('warn');
    if (daily) note.textContent = t('diff.dailyNote');
    else if (lockedTier) { const u = V.UNLOCK[lockedTier]; note.textContent = t('diff.unlockHint', { name: t('diff.' + lockedTier), wave: u.wave, base: t('diff.' + u.diff) }); }
    else note.textContent = t('diff.allUnlocked');
  };
  for (const b of document.querySelectorAll('[data-diff]')) b.onclick = () => {
    const d = b.dataset.diff;
    if (!V.meta.isUnlocked(d)) { const u = V.UNLOCK[d], note = document.getElementById('diffNote'); note.textContent = t('diff.unlockHint', { name: t('diff.' + d), wave: u.wave, base: t('diff.' + u.diff) }); note.classList.add('warn'); V.SND.nope(); return; }
    ui.diff = d; save('diff', d); ui.paintDiff();
  };
  ui.paintDiff();

  // ---------- quick mute (HUD button / M key) ----------
  function paintMute() { $('mute').textContent = t(V.audio.muted ? 'hud.soundOff' : 'hud.soundOn'); $('mute').setAttribute('aria-pressed', String(V.audio.muted)); }
  ui.toggleMute = () => { V.audio.muted = !V.audio.muted; save('muted', V.audio.muted); V.audio.apply(); paintMute(); };
  $('mute').onclick = ui.toggleMute;

  // ---------- buttons ----------
  $('againBtn').onclick = guard(() => V.game.start(V.G.bot));
  $('restartBtn').onclick = guard(() => V.game.start(V.G.bot));
  $('resumeBtn').onclick = guard(() => V.game.resume());
  $('quitBtn').onclick = guard(() => V.game.toTitle());
  $('titleBtn').onclick = guard(() => V.game.toTitle());
  $('labBtn').onclick = guard(() => { V.game.toTitle(); V.home.showView('lab'); });
  $('pauseBtn').onclick = () => { if (V.G.mode === 'play') V.game.pause(); else if (V.G.mode === 'pause') V.game.resume(); };

  // called every frame from the loop: small bits of chrome that follow the game mode
  let lastMode = '';
  ui.frame = () => {
    const m = V.G.mode;
    $('game').classList.toggle('playing', m === 'play' && !V.input.touchMode);
    $('gameView').classList.toggle('watching', !!V.G.bot);
    // boss name under its health bar
    const boss = V.G.S?.enemies.find(e => e.boss && e.x < 256), name = boss ? tx.bossName(boss.type) : '';
    if ($('bossName').textContent !== name) { $('bossName').textContent = name; $('bossName').hidden = !name; }
    // touch dash button, dimmed while recharging
    const showDash = m === 'play' && V.input.touchMode && !V.G.bot;
    if ($('dashBtn').hidden === showDash) $('dashBtn').hidden = !showDash;
    if (showDash) $('dashBtn').classList.toggle('cooling', V.G.P.dashT > 0);
    if (m === lastMode) return;
    lastMode = m;
    $('pauseBtn').hidden = !(m === 'play' || m === 'pause');
    $('pauseBtn').textContent = t(m === 'pause' ? 'hud.resume' : 'hud.pause');
  };

  // ---------- HUD ----------
  let lastHp = '', lastScore = -1, lastWave = -1, lastPow = '';
  ui.hud = force => {
    const { S, P } = V.G;
    if (!P) return;
    const hpSig = P.hp + '/' + P.max;
    if (force || hpSig !== lastHp) {
      lastHp = hpSig;
      $('hearts').innerHTML = Array.from({ length: P.max }, (_, i) => `<img alt="" src="${V.urlOf(i < P.hp ? 'heal' : 'heartEmpty')}">`).join('');
      $('hearts').setAttribute('aria-label', `${t('hud.immunity')} ${P.hp}/${P.max}`);
    }
    if (force || S.score !== lastScore) { lastScore = S.score; $('score').textContent = S.score.toLocaleString(); }
    if ($('atp').textContent !== String(S.atp)) $('atp').textContent = S.atp;
    if (force || S.wave !== lastWave) { lastWave = S.wave; $('wave').textContent = S.wave; $('waveLbl').textContent = t(S.mode === 'rush' ? 'hud.boss' : 'hud.wave'); }
    $('best').textContent = (S.cheated ? ui.best : Math.max(ui.best, S.score)).toLocaleString();
    const left = S.phase === 'fight' ? S.queue.length + S.enemies.length : 0;
    const leftText = left ? t('hud.left', { n: left }) : '';
    if ($('left').textContent !== leftText) $('left').textContent = leftText;

    const chips = [];
    if (P.shield > 0) chips.push(['shield', P.shield > 1 ? `×${P.shield}` : t('hud.ready'), false]);
    for (const k in P.fx) {
      const perm = P.perm[k], tm = P.fx[k];
      if (perm) chips.push([k, tm > 0 ? `∞ +${Math.ceil(tm)}s` : '∞', false, true]);
      else if (tm > 0) chips.push([k, `${Math.ceil(tm)}s`, tm < 2.5]);
    }
    const sig = V.i18n.lang + chips.map(c => c.join()).join('|');
    if (force || sig !== lastPow) {
      lastPow = sig;
      $('powers').innerHTML = chips.length
        ? chips.map(([k, tm, low, perm]) => `<div class="chip${low ? ' low' : ''}${perm ? ' upg' : ''}"><img alt="" src="${V.urlOf(k)}"><b>${tx.pow(k)}</b><span>${tm}</span></div>`).join('')
        : `<span class="hint">${t('hud.noPowers')}</span>`;
    }
  };
  ui.resetHud = () => {
    $('left').textContent = ''; $('atp').textContent = '0'; $('bossName').hidden = true; $('bossName').textContent = '';
    $('banner').classList.remove('show'); $('toast').classList.remove('show');
    $('hearts').innerHTML = Array.from({ length: V.DIFFICULTY[ui.diff].hp }, () => `<img alt="" src="${V.urlOf('heal')}">`).join('');
    $('best').textContent = ui.best.toLocaleString();
    $('powers').innerHTML = `<span class="hint">${t('hud.noPowers')}</span>`;
  };

  // ---------- banners ----------
  const retrigger = el => { el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); };
  ui.banner = (big, sub) => { $('bannerBig').textContent = big; $('bannerSub').textContent = sub || ''; retrigger($('banner')); };
  ui.toast = (text, color) => { const el = $('toast'); el.textContent = text; el.style.color = color; retrigger(el); };

  // ---------- between-wave break: adaptations + Pharmacy ----------
  let brkPrimed = false, brkTitle = ['brk.waveCleared', {}], brkNote = 'brk.notePrimed';
  ui.openBreak = (titleKey, vars, primed, justPrimed) => {
    brkPrimed = primed; brkTitle = [titleKey, vars];
    brkNote = justPrimed ? 'brk.noteJust' : primed ? 'brk.notePrimed' : 'brk.noteEarly';
    $('upgradeNote').classList.toggle('primed', !!justPrimed);
    ui.renderBreak();
    ui.show('upgrade');
    $('choices').classList.add('locked');
    setTimeout(() => $('choices').classList.remove('locked'), 600);
  };
  ui.renderBreak = () => {
    const { S, P } = V.G, b = S?.brk;
    if (!b) return;
    $('upgradeTitle').textContent = t(brkTitle[0], brkTitle[1]);
    $('upgradeNote').textContent = t(brkNote);
    $('choices').innerHTML = b.choices.map((u, i) => {
      const lv = P.upg[u.id] || 0, max = brkPrimed ? u.max : (u.earlyMax ?? u.max);
      const picked = b.pickedId === u.id, shownLv = picked ? lv - 1 : lv;
      return `<button class="choice${u.perm ? ' perm' : ''}${picked ? ' picked' : ''}" type="button" data-i="${i}"${b.picked ? ' disabled' : ''}>` +
        `<span class="k">${picked ? t('brk.adapted') : `[${i + 1}]`}${u.perm ? ' · ' + t('brk.permanent') : ''}</span><b>${tx.upg(u.id)}</b><small>${tx.upgDesc(u.id)}</small>` +
        (u.max > 1 ? `<span class="lv">${t('brk.level', { a: shownLv, b: shownLv + 1, max })}${max < u.max ? t('brk.forNow') : ''}</span>` : '') + '</button>';
    }).join('') || `<p class="hint">${t('brk.full')}</p>`;
    for (const btn of $('choices').querySelectorAll('.choice')) btn.onclick = () => ui.pickUpgrade(+btn.dataset.i);
    $('shopAtp').textContent = S.atp;
    $('shopItems').innerHTML = V.shop.items().map(it =>
      `<button class="shop-item" type="button" data-id="${it.id}"${it.ok ? '' : ' disabled'} title="${it.desc}">` +
      `<img alt="" src="${V.urlOf(it.icon)}"><b>${it.name}</b><span>${it.why || t('shop.price', { n: it.price })}</span></button>`).join('');
    for (const btn of $('shopItems').children) btn.onclick = () => V.shop.buy(btn.dataset.id);
    const done = b.picked || !b.choices.length;   // fully adapted: nothing left to choose
    $('continueBtn').disabled = !done;
    $('continueBtn').textContent = t(done ? 'brk.continue' : 'brk.pickFirst');
  };
  ui.pickUpgrade = i => {
    const b = V.G.S?.brk;
    if (!b || b.picked || !b.choices[i] || !ui.ready(600)) return;
    V.game.applyUpgrade(b.choices[i]);
  };
  ui.continueWave = () => { if (ui.ready(600)) V.game.continueWave(); };
  $('continueBtn').onclick = () => ui.continueWave();

  // pause screen shows your build so far
  // quick settings in the pause menu, so you don't have to quit a run to change them
  const QUICK = [
    ['set.music', () => V.music.on, v => ui.set('music', v)],
    ['set.sfx', () => V.audio.sfxOn, v => ui.set('sfxOn', v)],
    ['set.autofire', () => ui.autofire, v => ui.set('autofire', v)],
    ['set.aimAssist', () => ui.aimAssist, v => ui.set('aimAssist', v)],
  ];
  function paintQuick() {
    $('pauseQuick').innerHTML = QUICK.map(([k, get], i) => `<button type="button" class="quick-btn" data-q="${i}" aria-pressed="${get()}">${t(k)}: <b>${t(get() ? 'set.on' : 'set.off')}</b></button>`).join('');
    for (const b of $('pauseQuick').children) b.onclick = () => { V.audio.init(); const [, get, set] = QUICK[b.dataset.q]; set(!get()); paintQuick(); };
  }
  ui.showPause = () => {
    const P = V.G.P, parts = V.UPGRADES.filter(u => P.upg[u.id]).map(u => `<b>${tx.upg(u.id)}</b>${P.upg[u.id] > 1 ? ' ×' + P.upg[u.id] : ''}`);
    $('pauseBuild').innerHTML = parts.length ? t('pause.build') + parts.join(' · ') : t('pause.none');
    paintQuick();
    ui.show('pause');
  };

  // ---------- game over ----------
  let overState = null, overSummary = null;
  // the "one more run" screen: what you earned, what you finished, and how close the next goal is
  function paintSummary() {
    const s = overSummary, el = $('runSummary');
    if (!s) { el.innerHTML = ''; return; }
    const lines = [];
    if (s.unlocked.length) for (const d of s.unlocked) lines.push(`<div class="unlock">${t('over.unlocked', { name: t('diff.' + d) })}</div>`);
    lines.push(`<div class="dna">+${s.dna} DNA${s.firstDaily ? ' · ' + t('over.dailyBonus') : ''}${s.missionDNA ? ' · ' + t('over.missionDna', { n: s.missionDNA }) : ''}</div>`);
    if (s.xp) {
      const pct = Math.round(s.lv.into / s.lv.need * 100);
      lines.push(`<div class="xp">${t('xp.gain', { n: s.xp })} · ${s.lv.L > s.lvFrom ? t('xp.up', { a: s.lvFrom, b: s.lv.L, n: s.lvDna }) : t('xp.lv', { n: s.lv.L })}<span class="bar"><i style="width:${pct}%"></i></span></div>`);
    }
    if (s.vlUp) lines.push(`<div class="unlock">${t('vl.unlocked', { n: s.vlUp })}</div>`);
    for (const c of s.completed) lines.push(`<div class="mdone">✓ ${V.meta.missionText(c.mission)} · +${c.reward}</div>`);
    if (s.nudge) lines.push(`<div class="nudge">${t(...s.nudge)}</div>`);
    if (s.next) lines.push(`<div class="next">${s.total >= s.next.cost ? t('over.canBuy', { name: t('lab.' + s.next.id + '.name') }) : t('over.nextLab', { n: s.next.cost - s.total, name: t('lab.' + s.next.id + '.name') })}</div>`);
    el.innerHTML = lines.join('');
  }
  // ---------- final-five boss entrance ----------
  ui.bossIntro = I => {
    const el = $('bossIntro');
    if (!I) { el.hidden = true; el.classList.remove('show', 'last'); return; }
    $('biCount').textContent = I.type === 'zero' ? t('intro.last') : t('intro.final', { n: I.n });
    $('biName').textContent = tx.bossName(I.type).toLocaleUpperCase(V.i18n.lang);
    $('biSub').textContent = tx.bossSub(I.type);
    el.style.setProperty('--dur', I.dur + 's');
    el.classList.toggle('last', I.type === 'zero');
    el.hidden = false; retrigger(el);
  };
  // ---------- victory ----------
  let vicState = null;
  const clock = s => { s = Math.floor(s); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
  function paintVictory() {
    if (!vicState) return;
    const [S, r] = vicState;
    $('vScore').textContent = S.score.toLocaleString(); $('vWave').textContent = S.wave; $('vKills').textContent = S.kills.toLocaleString();
    $('vBosses').textContent = S.bossKills; $('vTime').textContent = clock(S.time || 0);
    $('vReward').textContent = !r ? t('vic.noReward') : r.first ? t('vic.first', { n: r.dna }) : t('vic.again', { n: r.dna, times: r.times, diff: t('diff.' + S.diff) });
  }
  ui.showVictory = (S, reward) => { vicState = [S, reward]; paintVictory(); ui.show('victory'); $('victory').scrollTop = 0; V.SND.upgrade(); };
  $('keepBtn').onclick = guard(() => V.game.keepGoing());
  $('vicHomeBtn').onclick = guard(() => V.game.victoryHome());
  V.i18n.onChange(() => { if (V.G.mode === 'victory') paintVictory(); });

  ui.showOver = (S, isBest, summary) => {
    overState = S; overSummary = summary || null; paintSummary();
    $('labBtn').hidden = !summary;
    $('oWaveLbl').textContent = t(S.mode === 'rush' ? 'over.bosses' : 'over.wave');
    $('oScore').textContent = S.score.toLocaleString(); $('oWave').textContent = S.mode === 'rush' ? bossesBeaten(S) : S.wave;
    $('oKills').textContent = S.kills; $('oCombo').textContent = S.bestCombo;
    $('newBest').hidden = !isBest;
    $('againBtn').textContent = t(S.bot ? 'over.watchAgain' : 'over.oneMore');
    ui.show('over');
  };

  // ---------- field guide ----------
  const card = (src, n, d, col) => `<div class="card">${src ? `<img alt="" src="${src}">` : ''}<div><b style="color:${col}">${n}</b><small>${d}</small></div></div>`;
  function paintGuide() {
    $('rosterEnemies').innerHTML = V.GUIDE.map(([k, , , c]) => card(V.urlOf(k), tx.enemy(k), (V.BOSS_ORDER.includes(k) ? t('guide.bossWave', { n: (V.BOSS_ORDER.indexOf(k) + 1) * 5 }) + ' ' : '') + tx.enemyDesc(k), c)).join('');
    const late = ` <em class="late">${t('guide.late')}</em>`;
    $('rosterPowers').innerHTML = V.POW_KEYS.map(k => card(V.urlOf(k), tx.pow(k), tx.powDesc(k) + (V.POW[k].tier === 2 ? late : ''), V.POW[k].color)).join('');
    $('rosterUpgrades').innerHTML = V.UPGRADES.map(u => card(null, tx.upg(u.id),
      tx.upgDesc(u.id) + (u.max > 1 ? ' ' + t('guide.upTo', { n: u.max }) + (u.earlyMax ? ' ' + t('guide.early', { n: u.earlyMax }) : '') : '') + (u.tier === 2 ? late : ''), '#7fe0d4')).join('');
  }

  // ---------- language changes repaint everything that isn't a static data-i18n node ----------
  V.i18n.onChange(() => {
    paintMute(); paintGuide();
    lastMode = ''; lastPow = '';
    if (V.G.P) ui.hud(true);
    if (V.G.mode === 'upgrade') ui.renderBreak();
    if (V.G.mode === 'pause') ui.showPause();
    if (V.G.mode === 'over' && overState) {
      $('oWaveLbl').textContent = t(overState.mode === 'rush' ? 'over.bosses' : 'over.wave');
      $('againBtn').textContent = t(overState.bot ? 'over.watchAgain' : 'over.oneMore');
      paintSummary();
    }
    ui.paintDiff();
  });
})();
