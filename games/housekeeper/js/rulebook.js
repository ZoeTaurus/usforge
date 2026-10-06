// Registry for house rules + chores. Each rule lives in js/rules/*.js and calls HS.Rulebook.define().
//
// A rule definition can have:
//   id, from (first day), days (explicit day list), chore (bool)
//   short(day), text(day)        – sidebar label / fridge-note text
//   changed(day)                 – true on the day Robin changes this rule
//   setup(st, day)               – reset per-day state (st is a fresh object each day)
//   update(st, minutes, dt, day) – timed checks
//   prompt(obj, st, day)         – interaction prompt override (return a string)
//   interact(obj, st, day)       – return true if the rule handled the interaction
//   onSit(obj, st) / onStand(obj, st)
//   finalize(st)                 – status for a still-pending rule at 6 AM ('missed' by default)
// Statuses: pending | done | broken | missed | quiet (the event never happened today)
HS.Rulebook = {
  defs: {},
  order: [],
  active: [],
  status: {},
  st: {},
  locks: [],

  define(def) {
    this.defs[def.id] = def;
    this.order.push(def.id);
  },

  activeOn(id, day) {
    const r = this.defs[id];
    if (r.pool) return HS.Chores.today(day).includes(id);
    return r.days ? r.days.includes(day) : day >= (r.from || 1);
  },

  setupDay(day) {
    this.active = this.order.filter(id => this.activeOn(id, day));
    this.status = {};
    this.st = {};
    this.locks = [];
    for (const id of this.active) {
      this.st[id] = {};
      this.status[id] = 'pending';
      const r = this.defs[id];
      if (r.setup) r.setup(this.st[id], day);
    }
  },

  rules() { return this.active.filter(id => !this.defs[id].chore); },
  chores() { return this.active.filter(id => this.defs[id].chore); },
  on(id) { return this.active.includes(id); },
  get(id) { return this.st[id] || {}; },

  each(fn) {
    for (const id of this.active) {
      const v = fn(this.defs[id], this.st[id]);
      if (v) return v;
    }
    return null;
  },

  update(m, dt, day) { this.each((r, st) => { if (r.update) r.update(st, m, dt, day); }); },
  prompt(o, day) { return this.each((r, st) => r.prompt && r.prompt(o, st, day)); },
  interact(o, day) { return !!this.each((r, st) => r.interact && r.interact(o, st, day)); },
  onSit(o) { this.each((r, st) => { if (r.onSit) r.onSit(o, st); }); },
  onStand(o) { this.each((r, st) => { if (r.onStand) r.onStand(o, st); }); },

  set(id, s) {
    if (!(id in this.status)) return;
    if (this.status[id] === 'broken' && s !== 'broken') return;
    this.status[id] = s;
    HS.UI.renderRules();
  },

  finalize() {
    for (const id of this.active) {
      if (this.status[id] !== 'pending') continue;
      const r = this.defs[id];
      this.status[id] = r.finalize ? r.finalize(this.st[id]) : 'missed';
    }
  },

  // Time windows when the player is stuck somewhere (e.g. watching TV), so other events avoid them.
  lock(a, b) { this.locks.push([a, b]); },

  pickTime(minH, maxH, dur) {
    const lo = minH * 60, hi = maxH * 60;
    let t = lo;
    for (let i = 0; i < 60; i++) {
      t = lo + Math.random() * (hi - lo);
      if (!this.locks.some(([a, b]) => t < b && t + dur > a)) break;
    }
    return Math.round(t);
  },

  // Conditional events always happen on the day they're introduced, then only sometimes.
  happens(day, from, chance) {
    return day === from || Math.random() < chance;
  },
};
