// Tracks damage per minute (DPM) and kills for the gun vs ramming, so we
// can check they're balanced. Shown in the top-right corner.
const WINDOW = 60; // seconds

export class Stats {
  constructor() {
    this.events = []; // { t, source, dmg }
    this.kills = { gun: 0, ram: 0 };
    this.time = 0;
  }

  tick(dt) {
    this.time += dt;
    while (this.events.length && this.events[0].t < this.time - WINDOW) this.events.shift();
  }

  record(source, dmg) { if (dmg > 0) this.events.push({ t: this.time, source, dmg }); }
  kill(source) { this.kills[source]++; }

  // Damage per minute for each source over the last minute.
  dpm() {
    const span = Math.max(10, Math.min(WINDOW, this.time)); // avoid silly numbers at the start
    const out = { gun: 0, ram: 0 };
    for (const e of this.events) out[e.source] += e.dmg;
    out.gun = Math.round((out.gun / span) * 60);
    out.ram = Math.round((out.ram / span) * 60);
    return out;
  }
}
