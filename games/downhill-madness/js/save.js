'use strict';
// Persistent progress: coin bank, unlocks, missions, rank, records and settings.
const Save = {
  data: null,
  defaults() {
    return {
      bank: 0, best: 0, bestDist: 0, runs: [],
      sled: 'toboggan', outfit: 'classic',
      owned: { toboggan: true, classic: true },
      missions: [], rank: 1, missionsDone: 0,
      totals: {}, trophies: {},
      settings: { music: true, sfx: true, voice: false, shake: true, voiceStyle: 'hype' },
      settingsVersion: 2,
    };
  },
  load() {
    const d = U.store.get('dm-save', null);
    const base = this.defaults();
    this.data = Object.assign(base, d || {});
    this.data.settings = Object.assign(this.defaults().settings, (d && d.settings) || {});
    this.data.trophies = Object.assign({}, (d && d.trophies) || {});
    this.data.totals = Object.assign({}, (d && d.totals) || {});
    this.data.owned = Object.assign({ toboggan: true, classic: true }, (d && d.owned) || {});
    if (!d) this.data.best = U.store.get('dm-best', 0);
    // v2: the announcer became opt-in, so switch it off for existing saves once.
    if (d && (d.settingsVersion || 1) < 2) {
      this.data.settings.voice = false;
      this.data.settingsVersion = 2;
    }
    return this.data;
  },
  write() { U.store.set('dm-save', this.data); },
  addRun(run) {
    const r = this.data.runs;
    r.push(run);
    r.sort((a, b) => b.score - a.score);
    r.length = Math.min(r.length, 5);
  },
};
