// Home screen: menu, sub-pages (how to play / field guide / settings), records,
// and a looping "attract mode" scene drawn behind the menu.
(() => {
  const V = window.VAX;
  const { W, H, TOP, BOT, TAU, rnd, clamp, SPR } = V;
  const $ = id => document.getElementById(id);
  const home = V.home = {};
  const { t } = V;

  // ---------- views ----------
  const VIEWS = ['menu', 'howto', 'guide', 'settings', 'lab', 'wardrobe', 'account', 'trophies', 'history'];
  let view = 'menu';
  function showView(name) {
    view = name;
    for (const v of VIEWS) $('view-' + v).hidden = v !== name;
    // put focus somewhere sensible so keyboard users land in the right place
    const target = name === 'menu' ? $('playBtn') : $('view-' + name).querySelector('[data-view="menu"]');
    target?.focus({ preventScroll: true });
    if (name === 'menu') { paintStreak(); paintRecords(); paintMissions(); paintMode(); V.ui.paintDiff(); paintAccount(); }
    if (name === 'account') paintAccount();
    if (name === 'settings') paintToggles();
    if (name === 'lab') paintLab();
    if (name === 'wardrobe') paintWardrobe();
    if (name === 'trophies') V.trophies.paint($('trophyList'));
    if (name === 'history') paintHistory();
  }
  home.showView = showView;
  for (const b of document.querySelectorAll('[data-view]')) b.addEventListener('click', () => showView(b.dataset.view));
  $('playBtn').onclick = () => V.game.start(false);
  $('continueBtn2').onclick = () => V.game.continueRun();

  // ---------- profiles ----------
  function paintAccount() {
    const n = V.profile.name;
    $('acctBtn').textContent = (V.profile.isAdmin ? '🛠 ' : '👤 ') + (n || t('auth.guest')) + ' · ' + t(n ? 'auth.switch' : 'auth.signIn');
    $('acctNow').textContent = n ? t('auth.signedIn', { name: n }) : t('auth.asGuest');
    $('signOutBtn').hidden = !n;
    $('acctList').innerHTML = V.profile.list().map(p => `<button type="button" class="acct-pill${p === n ? ' on' : ''}" data-p="${p.replace(/"/g, '&quot;')}">${V.profile.isAdminName(p) ? '🛠' : '👤'} ${p.replace(/</g, '&lt;')}${V.profile.hasPass(p) ? ' 🔒' : ''}</button>`).join('') || `<p class="set-note">${t('auth.none')}</p>`;
    for (const b of $('acctList').children) if (b.dataset.p) b.onclick = () => { $('acctName').value = b.dataset.p; $('acctPass').focus(); };
    const r = V.game.savedRun();
    $('continueBtn2').hidden = !r;
    if (r) $('continueBtn2').textContent = t('run.continue', { n: r.n, diff: t('diff.' + r.S.diff) });
  }
  $('acctForm').onsubmit = async e => {
    e.preventDefault();
    const res = await V.profile.signIn($('acctName').value, $('acctPass').value);
    if (res.err) { $('acctErr').textContent = t(res.err); V.SND?.nope?.(); }
  };
  $('signOutBtn').onclick = () => V.profile.signOut();
  $('watchBtn').onclick = () => V.game.start(true);

  // ---------- mode ----------
  function paintMode() {
    for (const b of document.querySelectorAll('[data-mode]')) b.setAttribute('aria-pressed', String(b.dataset.mode === V.ui.gameMode));
    if (V.ui.gameMode === 'daily') {
      const d = V.meta.daily();
      $('modeNote').textContent = t('mode.note.daily', { rules: d.mutators.map(k => t('mut.' + k)).join(' + '), best: d.best.toLocaleString() })
        + (d.played ? '' : ' · ' + t('daily.bonus'));
    } else $('modeNote').textContent = t('mode.note.' + V.ui.gameMode);
  }
  for (const b of document.querySelectorAll('[data-mode]')) b.onclick = () => { V.ui.setMode(b.dataset.mode); paintMode(); V.ui.paintDiff(); home.paintLevel?.(); };
  paintMode();

  home.isOpen = () => !$('home').hidden;
  home.open = () => { $('home').hidden = false; $('gameView').hidden = true; showView('menu'); };
  home.close = () => { $('home').hidden = true; $('gameView').hidden = false; };

  addEventListener('keydown', e => {
    if (!home.isOpen() || e.repeat) return;
    if (e.key === 'Escape' && view !== 'menu') { e.preventDefault(); showView('menu'); }
    if (e.key === 'Enter' && view === 'menu' && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); V.game.start(false); }
  });

  // ---------- records ----------
  // ---------- missions + DNA ----------
  // ---------- daily streak ----------
  let checkedIn = null;   // today's payout, if this visit earned it (kept so a language switch can repaint it)
  function paintStreak() {
    const got = V.meta.checkIn(), s = V.meta.data.streak || { n: 1 }, el = $('streakNote');
    if (got) { checkedIn = got; V.SND?.clear?.(); }
    el.classList.toggle('fresh', !!checkedIn);
    el.textContent = (checkedIn ? t('streak.got', { n: s.n, dna: checkedIn.dna }) : t('streak.day', { n: s.n })) + ' · ' + t('streak.next', { n: V.meta.streakReward(s.n + 1) });
  }
  // ---------- account level + Viral Load ----------
  function paintLevel() {
    const lv = V.meta.lvl();
    $('lvNum').textContent = t('xp.lv', { n: lv.L });
    $('lvBar').style.width = Math.round(lv.into / lv.need * 100) + '%';
    $('lvXp').textContent = `${lv.into}/${lv.need} XP`;
    const max = V.meta.data.vlMax || 0, vl = V.meta.vl();
    $('vlRow').hidden = V.ui.gameMode !== 'waves';
    $('vlNum').textContent = vl;
    $('vlDown').disabled = vl <= 0; $('vlUp').disabled = vl >= max;
    $('vlNote').textContent = vl ? t('vl.on', { n: vl * 20 }) : max ? t('vl.off') : t('vl.locked');
  }
  $('vlDown').onclick = () => { V.audio.init(); V.meta.setVl(V.meta.vl() - 1); V.SND.nope?.(); paintLevel(); };
  $('vlUp').onclick = () => { V.audio.init(); V.meta.setVl(V.meta.vl() + 1); V.SND.upgrade?.(); paintLevel(); };
  home.paintLevel = paintLevel;
  function paintMissions() {
    paintLevel();
    $('dnaPill').textContent = V.meta.data.dna;
    $('trophyPill').textContent = `${V.trophies.count()}/${V.TROPHIES.length}`;
    $('missionList').innerHTML = V.meta.data.missions.map(m => {
      const pct = m.target > 1 ? Math.min(100, Math.round(m.prog / m.target * 100)) : 0;
      return `<li><span>${V.meta.missionText(m)}${m.target > 1 ? ` <small>(${Math.min(m.prog, m.target)}/${m.target})</small>` : ''}</span><b>+${m.reward} DNA</b>${m.target > 1 ? `<span class="bar"><i style="width:${pct}%"></i></span>` : ''}</li>`;
    }).join('');
  }
  // ---------- research lab ----------
  function paintLab() {
    $('labDna').textContent = V.meta.data.dna;
    $('labList').innerHTML = V.LAB.map(l => {
      const lv = V.meta.level(l.id), max = l.cost.length, cost = V.meta.cost(l.id);
      const pips = Array.from({ length: max }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('');
      const btn = cost === null ? `<button type="button" disabled>${t('lab.maxed')}</button>`
        : `<button type="button" data-lab="${l.id}"${V.meta.data.dna < cost ? ' disabled' : ''}>${t('lab.buy', { n: cost })}</button>`;
      return `<div class="lab-item${cost === null ? ' maxed' : ''}"><b>${t('lab.' + l.id + '.name')}</b><small>${t('lab.' + l.id + '.desc')}</small><span class="pips">${pips}</span>${btn}</div>`;
    }).join('');
    for (const b of $('labList').querySelectorAll('[data-lab]')) b.onclick = () => { V.audio.init(); if (V.meta.buy(b.dataset.lab)) { V.SND.upgrade(); paintLab(); paintMissions(); } else V.SND.nope(); };
  }

  // ---------- wardrobe: skins + backgrounds ----------
  const ward = { skin: null, scene: null };   // what's being previewed (may not be owned yet)
  function paintWardrobe() {
    ward.skin ??= V.cos.equipped('skin'); ward.scene ??= V.cos.equipped('scene');
    $('wardDna').textContent = V.meta.data.dna;
    const card = (kind, item, thumb) => {
      const owned = V.cos.owned(kind, item.id), on = V.cos.equipped(kind) === item.id, sel = ward[kind] === item.id;
      const act = on ? `<span class="ward-tag">${t('ward.equipped')}</span>`
        : owned ? `<button type="button" data-equip="${item.id}">${t('ward.equip')}</button>`
        : item.cost == null ? `<span class="ward-tag">🔒 ${t('ward.locked')}</span>`
        : `<button type="button" data-buy="${item.id}"${V.meta.data.dna < item.cost ? ' disabled' : ''}>${t('lab.buy', { n: item.cost })}</button>`;
      return `<div class="ward-item${sel ? ' sel' : ''}${on ? ' on' : ''}" data-kind="${kind}" data-id="${item.id}" role="button" tabindex="0" aria-pressed="${sel}">
        <img class="ward-thumb ${kind}" src="${thumb}" alt=""><b>${t(kind + '.' + item.id + '.name')}</b><small>${t(kind + '.' + item.id + '.desc')}</small>${act}</div>`;
    };
    $('wardSkins').innerHTML = V.SKINS.map(s => card('skin', s, V.cos.skinSprite(s.id).toDataURL())).join('');
    $('wardScenes').innerHTML = V.SCENES.map(s => card('scene', s, sceneThumb(s.id))).join('');
    for (const el of document.querySelectorAll('.ward-item')) {
      const kind = el.dataset.kind, id = el.dataset.id;
      el.onclick = e => {
        V.audio.init();
        const b = e.target.closest('button');
        if (b?.dataset.buy) { if (V.cos.buy(kind, id)) { V.SND.upgrade(); paintMissions(); } else V.SND.nope(); }
        else if (b?.dataset.equip) { V.cos.equip(kind, id); V.SND.pick(); }
        ward[kind] = id; paintWardrobe();
      };
      el.onkeydown = e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === el) { e.preventDefault(); el.click(); } };
    }
  }
  const thumbs = {};
  function sceneThumb(id) {
    if (thumbs[id]) return thumbs[id];
    const c = document.createElement('canvas'); c.width = 64; c.height = 40;
    const g = c.getContext('2d'), sc = V.cos.scene(id), cells = [[14, 16], [40, 22], [26, 28], [54, 14]].map(([x, y], i) => ({ x, y, k: i / 4 + .1 }));
    const d = { w: 64, h: 40, top: TOP, bot: 40 - TOP };
    V.cos.background(g, sc, cells, [], 0, d); V.cos.walls(g, sc, 0, d);
    return thumbs[id] = c.toDataURL();
  }
  // live preview strip at the top of the Wardrobe
  const pv = $('wardPreview').getContext('2d'); pv.imageSmoothingEnabled = false;
  const PD = { w: 160, h: 64, top: TOP, bot: 64 - TOP };
  const pvCells = Array.from({ length: 7 }, (_, i) => ({ x: i * 26 + 8, y: TOP + 8 + (i * 13) % 30, v: 8 + (i % 3) * 4 }));
  let pvT = 0;
  function drawPreview(dt) {
    pvT += dt;
    const sc = V.cos.scene(ward.scene), flow = V.cos.flow(pvT, sc);
    for (const c of pvCells) { c.x -= c.v * dt * flow; if (c.x < -8) c.x = PD.w + 8; }
    V.cos.background(pv, sc, pvCells, [], pvT, PD);
    const s = V.cos.skinSprite(ward.skin);
    pv.drawImage(s, 40 - (s.width >> 1), 26 + (Math.floor(pvT * 3) % 2));
    V.cos.walls(pv, sc, pvT, PD);
  }

  function paintRecords() {
    $('recScore').textContent = V.ui.best.toLocaleString();
    $('recWave').textContent = V.ui.stats.bestWave;
    $('recKills').textContent = V.ui.stats.kills.toLocaleString();
    $('recRush').textContent = V.ui.stats.bestRush;
  }

  // ---------- settings ----------
  // language picker: native names, with a small completeness badge for partial translations
  function paintLangs() {
    $('langGrid').innerHTML = V.LANGS.map(l => {
      const on = l.code === V.i18n.lang;
      return `<button type="button" class="lang" role="radio" aria-checked="${on}" data-lang="${l.code}" lang="${l.code}"${l.dir ? ` dir="${l.dir}"` : ''}>${l.name}</button>`;
    }).join('');
    for (const b of $('langGrid').children) b.onclick = () => { V.ui.save('lang', b.dataset.lang); V.i18n.set(b.dataset.lang); };
  }
  // on/off toggles
  const TOGGLES = [
    ['setMusic', () => V.music.on, v => V.ui.set('music', v)],
    ['setSound', () => V.audio.sfxOn, v => V.ui.set('sfxOn', v)],
    ['setShake', () => V.ui.shake, v => V.ui.set('shake', v)],
    ['setPopups', () => V.ui.popups, v => V.ui.set('popups', v)],
    ['setGlow', () => V.ui.glow, v => V.ui.set('glow', v)],
    ['setHpbars', () => V.ui.hpbars, v => V.ui.set('hpbars', v)],
    ['setAutofire', () => V.ui.autofire, v => V.ui.set('autofire', v)],
    ['setAimAssist', () => V.ui.aimAssist, v => V.ui.set('aimAssist', v)],
  ];
  function paintToggles() {
    for (const [id, get] of TOGGLES) { const on = get(); $(id).textContent = t(on ? 'set.on' : 'set.off'); $(id).setAttribute('aria-pressed', String(on)); }
    $('volMusic').disabled = !V.music.on; $('volSfx').disabled = !V.audio.sfxOn;
    for (const [id, bus] of [['volMaster', 'master'], ['volMusic', 'music'], ['volSfx', 'sfx']]) {
      $(id).value = Math.round(V.audio.vol[bus] * 100); $(id + 'Out').textContent = $(id).value + '%';
    }
  }
  for (const [id, get, setv] of TOGGLES) $(id).onclick = () => { V.audio.init(); setv(!get()); paintToggles(); };
  // volume sliders (0–100 on screen, 0–1 in the mixer)
  for (const [id, bus] of [['volMaster', 'master'], ['volMusic', 'music'], ['volSfx', 'sfx']]) {
    const el = $(id), out = $(id + 'Out');
    el.value = Math.round(V.audio.vol[bus] * 100); out.textContent = el.value + '%';
    el.oninput = () => { V.audio.init(); V.ui.setVolume(bus, el.value / 100); out.textContent = el.value + '%'; };
    el.onchange = () => V.audio.preview(bus);
  }
  $('replayTut').onclick = () => { V.tut.reset(); const b = $('replayTut'); b.textContent = t('set.tutorialQueued'); setTimeout(() => { b.textContent = t('set.tutorialBtn'); }, 2000); };
  // ---------- soundtrack picker ----------
  const trackName = id => id === 'auto' ? t('mus.auto') : ['blood', 'lymph', 'lungs', 'gut', 'marrow', 'brain'].includes(id) ? t('scene.' + id + '.name') : t('mus.' + id);
  function paintTracks() {
    const sel = $('trackPick');
    sel.innerHTML = ['auto', ...Object.keys(V.TRACKS)].map(id => `<option value="${id}"${id === V.ui.track ? ' selected' : ''}>${trackName(id)}</option>`).join('');
  }
  $('trackPick').onchange = e => { V.audio.init(); V.ui.track = e.target.value; V.ui.save('track', V.ui.track); };
  paintTracks();

  // ---------- run history ----------
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const dur = s => { const m = Math.floor(s / 60), x = s % 60; return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`; };
  function paintHistory() {
    const h = V.ui.load('history', []), el = $('historyList');
    const L = V.meta.lifeStats();
    const stat = (k, v) => `<div><dt>${t('stats.' + k)}</dt><dd>${v}</dd></div>`;
    const life = `<h3 class="set-h">${t('stats.title')}</h3><dl class="records life">` + stat('level', L.level) + stat('runs', L.runs) + stat('kills', L.kills.toLocaleString()) + stat('bosses', L.bosses)
      + stat('combo', L.combo) + stat('syn', `${L.syn}/${V.SYNERGIES.length}`) + stat('streak', L.streak) + stat('fav', L.fav ? esc(V.tx.enemy(L.fav[0])) : '—') + '</dl>';
    if (!h.length) { el.innerHTML = life + `<p class="set-note">${t('hist.none')}</p>`; return; }
    const waves = h.filter(r => r.mode !== 'rush'), avg = waves.length ? Math.round(waves.reduce((a, r) => a + r.wave, 0) / waves.length) : 0;
    const total = h.reduce((a, r) => a + (r.time || 0), 0), fmt = new Intl.DateTimeFormat(V.i18n.lang, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    const end = r => r.end === 'won' ? `<span class="won">${t('hist.won')}</span>` : r.end === 'quit' ? t('hist.quit') : t('hist.killedBy', { name: esc(r.end === 'toxin' ? t('hist.toxin') : V.tx.enemy(r.end)) });
    el.innerHTML = life + `<p class="set-note">${t('hist.summary', { n: h.length, avg, time: dur(total) })}</p><ol class="history">` + h.map(r => `
      <li class="${r.end === 'won' ? 'won' : ''}">
        <span class="h-when">${fmt.format(r.at)}</span>
        <span class="h-mode">${t('mode.' + r.mode)} · ${t('diff.' + r.diff)}</span>
        <b class="h-wave">${r.mode === 'rush' ? t('hist.bosses', { n: r.wave }) : t('hist.wave', { n: r.wave })}</b>
        <span class="h-score">${r.score.toLocaleString()}</span>
        <span class="h-time">${dur(r.time || 0)}</span>
        <span class="h-end">${end(r)}</span>
      </li>`).join('') + '</ol>';
  }

  // two-step reset: first press arms it, second press within 3s confirms
  let armT = 0;
  $('resetStats').onclick = () => {
    const b = $('resetStats');
    if (!b.classList.contains('armed')) {
      b.classList.add('armed'); b.textContent = t('set.confirm');
      clearTimeout(armT); armT = setTimeout(() => { b.classList.remove('armed'); b.textContent = t('set.resetBtn'); }, 3000);
      return;
    }
    clearTimeout(armT); V.ui.resetRecords();
    b.classList.remove('armed'); b.textContent = t('set.cleared');
    setTimeout(() => { b.textContent = t('set.resetBtn'); }, 1500);
    V.ui.resetHud(); paintRecords();
  };
  V.i18n.onChange(() => { paintStreak(); paintAccount(); paintMode(); paintLangs(); paintToggles(); paintMissions(); if (view === 'lab') paintLab(); if (view === 'wardrobe') paintWardrobe(); if (view === 'trophies') V.trophies.paint($('trophyList')); if (view === 'history') paintHistory(); paintTracks(); });

  $('logoVax').src = V.urlOf('player');

  // ---------- attract mode ----------
  const cvs = $('homeArt'), ctx = cvs.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const R = Math.round;
  const PARADE = ['virus', 'bact', 'bug', 'plasmo', 'prion', 'salmo', 'adeno', 'hiv', 'noro', 'giardia', 'candida', 'pseudo', 'borrelia', 'strepHead', 'mini', 'spore'];
  const A = { foes: [], shots: [], parts: [], spawnT: 0, fireT: .5, t: 0, px: 46, py: H / 2, aim: 0, next: 0 };
  const cells = Array.from({ length: 18 }, () => ({ x: rnd(0, W), y: rnd(TOP + 4, BOT - 4), v: rnd(6, 18) }));

  function burst(x, y, n, cols) {
    for (let i = 0; i < n; i++) { const a = rnd(0, TAU), v = rnd(15, 55); A.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(.25, .6), col: cols[i % cols.length] }); }
  }

  function update(dt) {
    A.t += dt;
    for (const c of cells) { c.x -= c.v * dt; if (c.x < -10) { c.x = W + 10; c.y = rnd(TOP + 4, BOT - 4); } }

    // pathogens parade in from the right, one of each kind in turn
    A.spawnT -= dt;
    if (A.spawnT <= 0) {
      A.spawnT = rnd(.7, 1.2);
      const type = PARADE[A.next++ % PARADE.length];
      A.foes.push({ type, x: W + 12, y: rnd(TOP + 14, BOT - 14), v: rnd(16, 28), t: rnd(0, 5), hp: 3, flash: 0 });
    }
    for (const f of A.foes) { f.t += dt; f.flash -= dt; f.x -= f.v * dt; f.y += Math.sin(f.t * 2) * 8 * dt; }

    // the vaccine drifts toward the nearest threat and fires at it
    let tgt = null, bd = 1e9;
    for (const f of A.foes) { if (f.x > W - 6) continue; const d = Math.hypot(f.x - A.px, f.y - A.py); if (d < bd) { bd = d; tgt = f; } }
    const wantY = tgt ? tgt.y : H / 2 + Math.sin(A.t) * 20;
    A.py += clamp(wantY - A.py, -40 * dt, 40 * dt);
    A.px = 46 + Math.sin(A.t * .7) * 10;
    if (tgt) A.aim = Math.atan2(tgt.y - A.py, tgt.x - A.px);
    A.fireT -= dt;
    if (tgt && A.fireT <= 0) { A.fireT = .3; A.shots.push({ x: A.px, y: A.py, vx: Math.cos(A.aim) * 170, vy: Math.sin(A.aim) * 170, life: 1.4 }); }

    for (const s of A.shots) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      for (const f of A.foes) {
        if (f.hp <= 0 || s.life <= 0 || Math.hypot(f.x - s.x, f.y - s.y) > 6) continue;
        s.life = 0; f.hp--; f.flash = .07;
        if (f.hp <= 0) burst(f.x, f.y, 10, V.PCOL[f.type === 'strepHead' ? 'strep' : f.type] || ['#fff']);
      }
    }
    A.shots = A.shots.filter(s => s.life > 0 && s.x < W + 6);
    A.foes = A.foes.filter(f => f.hp > 0 && f.x > -16);
    for (const p of A.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .92; p.vy *= .92; p.life -= dt; }
    A.parts = A.parts.filter(p => p.life > 0);
  }

  function draw() {
    const img = (s, x, y) => ctx.drawImage(s, R(x - s.width / 2), R(y - s.height / 2));
    V.cos.background(ctx, V.cos.current, cells, [], A.t);
    for (const f of A.foes) { const set = f.flash > 0 ? SPR[f.type + 'W'] : SPR[f.type]; img(set[Math.floor(f.t * 4) % 2], f.x, f.y); }
    img(SPR.player, A.px, A.py + (Math.floor(A.t * 3) % 2));
    for (const s of A.shots) img(SPR.shot, s.x, s.y);
    for (const p of A.parts) { ctx.fillStyle = p.col; ctx.fillRect(R(p.x), R(p.y), 1, 1); }
    V.cos.walls(ctx, V.cos.current, A.t);
  }

  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  home.frame = dt => {
    if (!home.isOpen()) return;
    update(calm.matches ? dt * .35 : dt);
    draw();
    if (view === 'wardrobe') drawPreview(calm.matches ? dt * .35 : dt);
  };

  // warm the scene up so the first frame already has pathogens on screen
  for (let i = 0; i < 60 * 6; i++) update(1 / 60);
  draw();
  showView('menu');
})();
