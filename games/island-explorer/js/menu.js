'use strict';
// Title screen menus, difficulty, settings and records.

const DIFFICULTY = {
  relaxed:  { name: 'Relaxed',  desc: 'Slow hunger, gentle creatures. You keep most of your stuff when you fall.', hunger: 0.7,  dmg: 0.6, loss: 0.25 },
  normal:   { name: 'Normal',   desc: 'The intended adventure.',                                                  hunger: 1,    dmg: 1,   loss: 0.5 },
  survivor: { name: 'Survivor', desc: 'Ravenous hunger, brutal creatures. Falling costs you most of your stuff.',   hunger: 1.35, dmg: 1.4, loss: 0.75 },
};

const Settings = {
  KEY: 'castaway-settings',
  v: { music: 0.6, sfx: 0.8, shake: true },
  load() { try { Object.assign(this.v, JSON.parse(localStorage.getItem(this.KEY)) || {}); } catch (e) { /* defaults */ } },
  save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.v)); } catch (e) { /* ignore */ } },
  apply() { Sound.setVolumes(this.v.music, this.v.sfx); FX.shakeOn = this.v.shake; },
};

const Records = {
  KEY: 'castaway-records',
  get() {
    let r = null;
    try { r = JSON.parse(localStorage.getItem(this.KEY)); } catch (e) { /* none */ }
    return Object.assign({ wins: 0, best: {}, idols: 0, bosses: 0, islands: 0, shells: 0 }, r || {});
  },
  // returns true if this run set a new best time for its difficulty
  record(run) {
    const r = this.get();
    r.wins++;
    const prev = r.best[run.diff];
    const newBest = prev === undefined || run.time < prev;
    if (newBest) r.best[run.diff] = run.time;
    r.idols = Math.max(r.idols, run.idols);
    r.bosses = Math.max(r.bosses, run.bosses);
    r.islands = Math.max(r.islands, run.islands);
    r.shells = Math.max(r.shells, run.shells);
    try { localStorage.setItem(this.KEY, JSON.stringify(r)); } catch (e) { /* ignore */ }
    return newBest;
  },
};

const fmtSecs = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const Menu = {
  panel: 'main', sel: 0, items: [], settingsBack: null,

  init() {
    const $ = id => document.getElementById(id);
    this.el = { main: $('menuMain'), diff: $('menuDiff'), controls: $('menuControls'), records: $('menuRecords'),
      diffList: $('diffList'), recordsBody: $('recordsBody'), saveInfo: $('saveInfo'), settings: $('settings'), settingsList: $('settingsList'),
      logo: $('logoText') };
    // wavy logo letters
    this.el.logo.innerHTML = [...'CASTAWAY'].map((ch, i) => `<span style="animation-delay:${i * 0.09}s">${ch}</span>`).join('');
    this.save = this.readSave();
    this.show('main');
  },

  readSave() {
    try {
      const d = JSON.parse(localStorage.getItem(Save.KEY));
      if (!d || d.v !== 3) return null;
      return d;
    } catch (e) { return null; }
  },

  mainItems() {
    const s = this.save, out = [];
    if (s) {
      const isl = Object.keys((s.flags && s.flags.visited) || {}).length;
      const diff = DIFFICULTY[s.diff || 'normal'].name;
      out.push({ id: 'continue', label: 'Continue', sub: `Day ${s.day || 1} · ${isl}/9 islands · ${(s.stats && s.stats.relics) || 0}/6 idols · ${diff}${s.flags && s.flags.won ? ' · ✓ Rescued' : ''}` });
    }
    out.push({ id: 'new', label: 'New Game', sub: s ? 'Starts over (replaces your save)' : 'Wash up on Driftwood Isle' });
    out.push({ id: 'settings', label: 'Settings', sub: 'Volume and screen shake' });
    out.push({ id: 'controls', label: 'How to Play', sub: 'Controls, fighting and building' });
    out.push({ id: 'records', label: 'Records', sub: 'Best times and trophies' });
    return out;
  },

  renderList(el, items) {
    el.innerHTML = '';
    items.forEach((it, i) => {
      const d = document.createElement('div');
      d.className = 'mitem' + (i === this.sel ? ' sel' : '');
      d.innerHTML = `<div class="ml">${it.label}</div>${it.sub ? `<div class="ms">${it.sub}</div>` : ''}`;
      d.onmouseenter = () => { if (this.sel !== i) { this.sel = i; this.refresh(); Sound.hover(); } };
      d.onclick = () => { Sound.init(); this.sel = i; this.activate(); };
      el.appendChild(d);
    });
  },

  show(panel) {
    this.panel = panel;
    this.sel = 0;
    for (const k of ['main', 'diff', 'controls', 'records']) this.el[k].classList.toggle('hidden', k !== panel);
    if (panel === 'records') this.renderRecords();
    this.refresh();
  },

  refresh() {
    if (this.panel === 'main') { this.items = this.mainItems(); this.renderList(this.el.main, this.items); }
    else if (this.panel === 'diff') {
      this.items = [...Object.entries(DIFFICULTY).map(([k, d]) => ({ id: 'diff:' + k, label: d.name, sub: d.desc })), { id: 'back', label: '← Back' }];
      this.renderList(this.el.diffList, this.items);
    } else {
      this.items = [{ id: 'back', label: '← Back' }];
      this.renderList(this.el[this.panel].querySelector('.menu-list'), this.items);
    }
  },

  renderRecords() {
    const r = Records.get();
    const best = k => r.best[k] !== undefined ? fmtSecs(r.best[k]) : '—';
    this.el.recordsBody.innerHTML = `
      <div class="rec"><span>Times rescued</span><b>${r.wins}</b></div>
      <div class="rec"><span>Best time · Relaxed</span><b>${best('relaxed')}</b></div>
      <div class="rec"><span>Best time · Normal</span><b>${best('normal')}</b></div>
      <div class="rec"><span>Best time · Survivor</span><b>${best('survivor')}</b></div>
      <div class="rec"><span>Most golden idols</span><b>${r.idols}/6</b></div>
      <div class="rec"><span>Most bosses defeated</span><b>${r.bosses}/3</b></div>
      <div class="rec"><span>Most islands visited</span><b>${r.islands}/9</b></div>`;
  },

  onAction(a) {
    Sound.init();
    Music.setTrack('title');
    if (a === 'up' || a === 'down') {
      const n = this.items.length;
      this.sel = (this.sel + (a === 'up' ? -1 : 1) + n) % n;
      Sound.hover();
      this.refresh();
    } else if (a === 'interact' || a === 'attack') this.activate();
    else if (a === 'pause' && this.panel !== 'main') { Sound.back(); this.show('main'); }
  },

  activate() {
    const it = this.items[this.sel];
    if (!it) return;
    if (it.id === 'back') { Sound.back(); return this.show('main'); }
    Sound.select();
    if (it.id === 'continue') return this.begin(() => Game.continueGame());
    if (it.id === 'new') return this.show('diff');
    if (it.id.startsWith('diff:')) return this.begin(() => Game.newGame(it.id.slice(5)));
    if (it.id === 'settings') return this.openSettings(() => {});
    this.show(it.id);
  },

  // fade to black, start the game, fade back in
  begin(fn) {
    if (this.starting) return;
    this.starting = true;
    UI.setFade(true, '');
    setTimeout(() => { fn(); setTimeout(() => UI.setFade(false), 120); this.starting = false; }, 600);
  },

  // ---------- settings (shared by title and pause) ----------
  openSettings(onClose) {
    this.settingsBack = onClose;
    this.settingsOpen = true;
    this.setSel = 0;
    this.el.settings.classList.remove('hidden');
    this.renderSettings();
  },
  closeSettings() {
    this.settingsOpen = false;
    this.el.settings.classList.add('hidden');
    Settings.save();
    Sound.back();
    const cb = this.settingsBack; this.settingsBack = null;
    if (cb) cb();
  },
  renderSettings() {
    const v = Settings.v;
    const bar = x => '■'.repeat(Math.round(x * 10)) + '□'.repeat(10 - Math.round(x * 10));
    const rows = [
      { k: 'music', label: 'Music', val: bar(v.music) },
      { k: 'sfx', label: 'Sound', val: bar(v.sfx) },
      { k: 'shake', label: 'Screen shake', val: v.shake ? 'On' : 'Off' },
      { k: 'back', label: '← Back', val: '' },
    ];
    this.setRows = rows;
    this.el.settingsList.innerHTML = '';
    rows.forEach((r, i) => {
      const d = document.createElement('div');
      d.className = 'mitem srow' + (i === this.setSel ? ' sel' : '');
      d.innerHTML = `<div class="ml">${r.label}</div><div class="sv">${r.k === 'music' || r.k === 'sfx' ? '◀ ' : ''}${r.val}${r.k === 'music' || r.k === 'sfx' ? ' ▶' : ''}</div>`;
      d.onmouseenter = () => { if (this.setSel !== i) { this.setSel = i; this.renderSettings(); } };
      d.onclick = e => {
        this.setSel = i;
        if (r.k === 'back') return this.closeSettings();
        const rect = d.getBoundingClientRect();
        this.adjust(r.k, e.clientX < rect.left + rect.width * 0.6 && r.k !== 'shake' ? -1 : 1);
      };
      this.el.settingsList.appendChild(d);
    });
  },
  adjust(k, dir) {
    const v = Settings.v;
    if (k === 'music' || k === 'sfx') v[k] = Math.max(0, Math.min(1, Math.round((v[k] + dir * 0.1) * 10) / 10));
    else if (k === 'shake') v.shake = !v.shake;
    Settings.apply();
    Sound.select();
    if (k === 'shake' && v.shake) FX.shake(3, 0.3);
    this.renderSettings();
  },
  settingsAction(a) {
    const n = this.setRows.length, row = this.setRows[this.setSel].k;
    if (a === 'up' || a === 'down') { this.setSel = (this.setSel + (a === 'up' ? -1 : 1) + n) % n; Sound.hover(); this.renderSettings(); }
    else if (a === 'left' || a === 'right') { if (row !== 'back') this.adjust(row, a === 'left' ? -1 : 1); }
    else if (a === 'interact' || a === 'attack') { if (row === 'back') this.closeSettings(); else this.adjust(row, 1); }
    else if (a === 'pause') this.closeSettings();
  },
};
