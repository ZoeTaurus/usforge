'use strict';
// The title-screen demo rider. It scores lanes ahead (dodge hazards, chase ramps,
// coins and power-ups), hops crevasses, and plans a trick that fits each jump.
const Pilot = {
  reset() {
    this.targetX = 0;
    this.think = 0;
    this.trick = null;
    this.wasAir = false;
  },

  laneScore(G, x, look) {
    const P = G.player;
    let s = -Math.abs(x - P.x) * 8 - (Math.abs(x) > 0.9 ? 40 : 0);
    for (const e of G.entities) {
      const dz = e.z - P.z;
      if (dz < -50 || dz > look || e.hit || e.knock) continue;
      const def = ET[e.type];
      if (def.kind === 'none' || def.kind === 'marker' || def.kind === 'crevasse') continue;
      if (def.kind === 'rail' && dz > 900) continue; // only aim for a rail's start
      const t = dz / Math.max(P.speed, 1500);
      const ex = e.x + (e.vx || 0) * t; // where a crosser will be when we arrive
      const reach = (def.w * (e.s || 1) + CFG.PLAYER_HW + 140) / CFG.ROAD_W;
      if (Math.abs(ex - x) > reach) continue;
      const k = 1.3 - dz / look;
      switch (def.kind) {
        case 'crash': if (e.y < CFG.PLAYER_H) s -= 160 * k; break;
        case 'ghost': if (e.y < CFG.PLAYER_H) s -= 90 * k; break;
        case 'warn': s -= 120 * k; break; // a tentacle is about to burst out here
        case 'ramp': s += (e.type === 'megaramp' ? 45 : 30) * k; break;
        case 'power': s += 28 * k; break;
        case 'beam': s += 26 * k; break;
        case 'gate': s += 20 * k; break;
        case 'boost': s += 16 * k; break;
        case 'smash': s += 8 * k; break;
        case 'coin': s += 5 * k; break;
        case 'rival': s += 4 * k; break;
        case 'letter': s += 26 * k; break;
        case 'rail': if (dz > 0) s += 30 * k; break;
        case 'tramp': case 'cannon': s += 35 * k; break;
        case 'nado': s += 18 * k; break;
      }
    }
    return s;
  },

  input(G, dt) {
    const P = G.player, inp = {};
    if (P.crash > 0) return inp;
    if (P.grind) { this.trick = null; return inp; } // ride rails to the end

    if (!P.airborne) {
      this.trick = null;
      this.think -= dt;
      if (this.think <= 0) {
        this.think = 0.1;
        const look = P.speed * 1.2 + 1500;
        let best = P.x, bestS = -Infinity;
        for (let x = -0.95; x <= 0.951; x += 0.095) {
          const sc = this.laneScore(G, x, look);
          if (sc > bestS) { bestS = sc; best = x; }
        }
        this.targetX = best;
      }
      const dx = this.targetX - P.x;
      if (dx > 0.03) inp.right = true;
      else if (dx < -0.03) inp.left = true;
      inp.up = true; // always tucked: it's a demo, it wants to look cool

      // Hop a crevasse if we're about to roll into it.
      for (const e of G.entities) {
        const dz = e.z - P.z;
        if (e.type === 'crevasse' && dz > 0 && dz < P.speed * 0.12 + 150) inp.jumpPressed = true;
        if (e.type === 'laser' && e.on && dz > 0 && dz < P.speed * 0.1 + 120) inp.jumpPressed = true;
      }
      return inp;
    }

    // In the air: plan once, then hold keys until the rotation is nearly done.
    if (!this.trick) {
      const g = CFG.GRAVITY;
      const T = (P.vy + Math.sqrt(Math.max(0, P.vy * P.vy + 2 * g * P.air))) / g;
      const usable = T - 0.3;
      const flips = Math.floor((usable * FLIP_RATE) / TAU);
      const spins = Math.floor((usable * SPIN_RATE) / TAU);
      const style = U.pick(['back', 'back', 'front', 'spin', 'combo', 'grab']);
      this.trick = { flip: 0, spin: 0, dirF: style === 'front' ? 1 : -1, dirS: U.pick([-1, 1]), grab: false };
      if (style === 'spin') this.trick.spin = spins;
      else if (style === 'combo') { this.trick.flip = Math.max(0, flips - 1); this.trick.spin = Math.max(1, Math.min(spins, 2)); }
      else if (style === 'grab') { this.trick.grab = usable > 0.5; this.trick.flip = Math.min(1, flips); }
      else this.trick.flip = flips;
      if (!this.trick.flip && !this.trick.spin && usable > 0.45) this.trick.spin = 1;
    }
    const tr = this.trick;
    if (tr.flip && Math.abs(P.flip) < tr.flip * TAU - 0.6) { if (tr.dirF < 0) inp.up = true; else inp.down = true; }
    if (tr.spin && Math.abs(P.spin) < tr.spin * TAU - 0.6) { if (tr.dirS > 0) inp.right = true; else inp.left = true; }
    if (tr.grab && P.vy > -800) inp.jump = true;
    return inp;
  },
};
