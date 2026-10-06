// Save progress at the start of each day (per-browser convenience only).
HS.Save = {
  KEY: 'housesitting-save-v1',
  MUSIC_KEY: 'housesitting-music',
  MEMORY_KEY: 'housesitting-memory',

  // The house remembers previous playthroughs.
  memory() {
    const blank = { runs: 0, last: null, endings: [] };
    try { return Object.assign(blank, JSON.parse(localStorage.getItem(this.MEMORY_KEY))); } catch (e) { return blank; }
  },

  remember(ending) {
    const m = this.memory();
    const endings = m.endings.includes(ending) ? m.endings : m.endings.concat(ending);
    try { localStorage.setItem(this.MEMORY_KEY, JSON.stringify({ runs: m.runs + 1, last: ending, endings })); } catch (e) { /* storage unavailable */ }
  },

  forget() {
    try { localStorage.removeItem(this.MEMORY_KEY); } catch (e) { /* storage unavailable */ }
  },

  load() {
    try {
      const s = localStorage.getItem(this.KEY);
      return s ? JSON.parse(s) : null;
    } catch (e) {
      return null;
    }
  },

  store(data) {
    try { localStorage.setItem(this.KEY, JSON.stringify(data)); } catch (e) { /* storage unavailable */ }
  },

  clear() {
    try { localStorage.removeItem(this.KEY); } catch (e) { /* storage unavailable */ }
  },

  musicOn() {
    try { return localStorage.getItem(this.MUSIC_KEY) !== 'off'; } catch (e) { return true; }
  },

  setMusic(on) {
    try { localStorage.setItem(this.MUSIC_KEY, on ? 'on' : 'off'); } catch (e) { /* storage unavailable */ }
  },
};
