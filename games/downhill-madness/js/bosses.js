'use strict';
// Boss fights. Four bosses rotate at madness 4, 8, 12, 16… and come back at a
// higher tier. Bosses aim where you're *going* (your sideways speed plus the
// lanes you favour), but every wall leaves a gap you can actually reach.
// Land tricks, grind and smash minions to damage them; beat one before its
// timer runs out or it escapes.

const BOSSES = [
  { id: 'yeti', name: 'The Yeti King', ent: 'bossyeti', color: '#ffd23f', roar: 'Boss fight! The Yeti King approaches!',
    attacks: [['aimed', 3], ['spread', 2], ['wall', 1.4]] },
  { id: 'frosty', name: 'Frosty the Destroyer', ent: 'bosssnowman', color: '#7fe7ff', roar: 'Frosty the Destroyer wants a word!',
    attacks: [['rollers', 3], ['rollwall', 1.6], ['minions', 1.2]] },
  { id: 'mothership', name: 'The Mothership', ent: 'bossufo', color: '#7dff9a', roar: 'The mothership has arrived!',
    attacks: [['sweep', 2.4], ['mines', 2], ['plasma', 2.4]] },
  { id: 'kraken', name: 'The Ice Kraken', ent: 'bosskraken', color: '#b36bff', roar: 'Release the Ice Kraken!',
    attacks: [['tentacle', 3], ['corridor', 1.5], ['tentacle', 1]] },
];

const Boss = {
  // ---------------------------------------------------------------- lifecycle
  start(G, lvl) {
    if (G.boss) return;
    const n = Math.max(0, Math.floor(lvl / 4) - 1);
    const def = BOSSES[n % BOSSES.length], tier = 1 + Math.floor(n / BOSSES.length);
    const P = G.player;
    for (const e of G.entities) if (e.z > P.z + 9000 && e.type !== 'bestflag') e.dead = true;
    const e = G.add(def.ent, 0, P.z + 18000, { dist: 18000, throwT: 0, hurtT: 0, y: def.ent === 'bossufo' ? 1700 : 0 });
    const hp = 90 + tier * 30;
    G.boss = {
      def, tier, e, t: 0, dur: 24 + tier * 2, hp, maxHp: hp, next: 2.6, rampT: 1.5, queue: [],
      heat: new Array(9).fill(0), ease: 1, easeT: 0, cleanT: 0, done: null, doneT: 0,
    };
    HUD.banner(`BOSS: ${def.name.toUpperCase()}${tier > 1 ? ` (TIER ${tier})` : ''}`, def.color, 3);
    Sfx.roar();
    Voice.say(def.roar, 1, true);
  },

  update(G, dt) {
    const b = G.boss, e = b.e, P = G.player;
    b.t += dt;
    // remember which lanes the player likes
    const bin = U.clamp(Math.round((P.x + 0.9) / 0.225), 0, 8);
    for (let i = 0; i < 9; i++) b.heat[i] *= Math.pow(0.85, dt);
    b.heat[bin] += dt;
    // ease off after hitting you; push harder if you keep dodging
    b.cleanT += dt;
    if (b.easeT > 0) { b.easeT -= dt; b.ease = 1.4; } else b.ease = b.cleanT > 8 ? 0.82 : 1;

    const leaving = !!b.done;
    e.dist += ((leaving ? 42000 : 7500) - e.dist) * Math.min(1, dt * (leaving ? 0.7 : 1.1));
    e.z = e.zPrev = P.z + e.dist;
    // drift to stay roughly ahead of the player so attacks come from in front
    const tx = U.clamp(P.x * 0.6 + Math.sin(b.t * 0.8) * 0.35, -0.6, 0.6);
    e.x += (tx - e.x) * Math.min(1, dt * 0.9);
    e.throwT = Math.max(0, e.throwT - dt);
    e.hurtT = Math.max(0, e.hurtT - dt);
    if (b.def.ent === 'bossufo') e.y = 1700 + Math.sin(b.t * 2) * 120;

    if (!leaving) {
      // timed follow-ups from multi-part attacks
      for (let i = b.queue.length - 1; i >= 0; i--) if (b.queue[i].at <= b.t) { b.queue[i].fn(); b.queue.splice(i, 1); }
      if (b.t > 2) {
        b.next -= dt;
        if (b.next <= 0) {
          const phase = this.phase(b);
          b.next = (2.1 / (1 + 0.28 * (phase - 1) + 0.18 * (b.tier - 1))) * b.ease * U.rand(0.85, 1.15);
          this.attack(G, b, phase);
        }
        // the boss leaves ramps so you can trick it to death
        b.rampT -= dt;
        if (b.rampT <= 0) {
          b.rampT = U.rand(3, 4.2);
          const x = this.gap(G, 1.3, P.x);
          G.add(U.chance(0.35) ? 'tramp' : 'ramp', x, P.z + Math.max(6000, P.speed * 1.2));
        }
      }
      if (b.t > b.dur) this.finish(G, false);
    } else {
      b.doneT += dt;
      if (b.doneT > 3) { e.dead = true; G.boss = null; }
    }
  },

  phase(b) { return b.hp > b.maxHp * 0.66 ? 1 : b.hp > b.maxHp * 0.33 ? 2 : 3; },

  // ---------------------------------------------------------------- targeting
  // Where the player will be in T seconds: lead their sideways motion, lean toward their favourite lane.
  predict(G, T) {
    const P = G.player, b = G.boss;
    // Lead their sideways motion, but never further than they could actually get.
    const lead = U.clamp((G.pvx || 0) * T * 0.85, -this.reach(G, T), this.reach(G, T));
    let x = P.x + lead;
    // Hugging the deep snow at the edge doesn't hide you.
    if (Math.abs(P.x) > 1) return U.clamp(x, -1.3, 1.3);
    let bi = 4, best = -1;
    for (let i = 0; i < 9; i++) if (b.heat[i] > best) { best = b.heat[i]; bi = i; }
    x = U.lerp(x, -0.9 + bi * 0.225, 0.25);
    return U.clamp(x, -1.3, 1.3);
  },

  // How far sideways the player can get in T seconds (with a safety margin).
  reach(G, T) { const P = G.player; return (1.1 + P.speed / 6500) * T * 0.62; },

  // A safe x the player can reach, deliberately away from where they're heading.
  gap(G, T, aimX) {
    const P = G.player, r = this.reach(G, T);
    const opts = [];
    for (let x = -0.8; x <= 0.81; x += 0.1) {
      if (Math.abs(x - P.x) > r) continue;
      const away = Math.abs(x - aimX);
      opts.push({ x, w: away > 0.3 && away < 0.75 ? 3 : away >= 0.75 ? 1 : 0.4 });
    }
    // nothing reachable on the piste: leave the gap right where they are
    return opts.length ? U.weighted(opts).x : P.x;
  },

  // ---------------------------------------------------------------- attacks
  attack(G, b, phase) {
    const pool = b.def.attacks.map(([id, w], i) => ({ id, w: w * (i > 0 ? 0.6 + phase * 0.4 : 1) }));
    const id = U.weighted(pool).id;
    const P = G.player, e = b.e;
    const closing = Math.max(2600, P.speed * 0.45);
    const T = e.dist / closing;
    e.throwT = 0.4;
    switch (id) {
      case 'aimed': {
        const shots = 1 + Math.min(2, phase - 1 + (b.tier - 1));
        for (let i = 0; i < shots; i++) {
          b.queue.push({ at: b.t + i * 0.32, fn: () => this.lob(G, this.predict(G, T) + (i ? U.rand(-0.15, 0.15) : 0), 'snow') });
        }
        break;
      }
      case 'plasma': {
        const aim = this.predict(G, T);
        for (let i = 0; i < 1 + phase; i++) b.queue.push({ at: b.t + i * 0.25, fn: () => this.lob(G, aim + (i - phase / 2) * 0.18, 'plasma') });
        break;
      }
      case 'spread': {
        const aim = this.predict(G, T);
        for (const off of [-0.3, 0, 0.3]) this.lob(G, aim + off, 'snow');
        break;
      }
      case 'wall': {
        const g = this.gap(G, T, this.predict(G, T));
        for (let x = -1.2; x <= 1.21; x += 0.3) if (Math.abs(x - g) > 0.26) this.lob(G, x, 'snow');
        HUD.pop('SNOWBALL WALL!', b.def.color, 0.8);
        break;
      }
      case 'rollers': {
        const n = phase >= 2 ? 2 : 1;
        for (let i = 0; i < n; i++) b.queue.push({ at: b.t + i * 0.6, fn: () => this.roller(G, this.predict(G, this.rollT(G)) + (i ? U.rand(-0.3, 0.3) : 0)) });
        break;
      }
      case 'rollwall': {
        const g = this.gap(G, this.rollT(G), this.predict(G, this.rollT(G)));
        for (let x = -1.2; x <= 1.21; x += 0.3) if (Math.abs(x - g) > 0.26) this.roller(G, x);
        HUD.pop('ROLLING WALL!', b.def.color, 0.8);
        break;
      }
      case 'minions': {
        for (let i = 0; i < 4 + phase; i++) G.add('snowman', U.rand(-0.85, 0.85), P.z + 5000 + i * 700, { minion: true });
        HUD.pop('MINIONS! SMASH THEM', b.def.color, 0.8, 'each one hurts the boss');
        break;
      }
      case 'sweep': {
        // A tractor-beam pillar crosses the slope, timed to be where you'll be.
        const z = P.z + Math.max(6500, P.speed * 1.3), t2 = (z - P.z) / Math.max(P.speed, 2500);
        const aim = this.predict(G, t2), dir = aim > 0 ? 1 : -1, vx = dir * (0.45 + phase * 0.08);
        G.add('pillar', U.clamp(aim - vx * t2, -2.5, 2.5), z, { vx });
        if (phase >= 2) G.add('pillar', U.clamp(aim + vx * t2 * 0.6, -2.5, 2.5), z + 1600, { vx: -vx });
        break;
      }
      case 'mines': {
        const aim = this.predict(G, T), y0 = 2600;
        for (let i = 0; i < 3 + phase; i++) {
          G.add('mine', U.clamp(aim + U.rand(-0.45, 0.45), -1.3, 1.3), P.z + 5200 + i * 600, { y: y0, fallT: Math.sqrt((2 * y0) / CFG.GRAVITY) });
        }
        break;
      }
      case 'tentacle': {
        const n = phase;
        for (let i = 0; i < n; i++) {
          const ahead = Math.max(1.1, 1.5 - b.tier * 0.1) + i * 0.35;
          b.queue.push({ at: b.t + i * 0.2, fn: () => G.add('tentwarn', this.predict(G, ahead), P.z + P.speed * ahead) });
        }
        break;
      }
      case 'corridor': {
        // Rows of tentacles with a gap that snakes sideways; each gap is reachable from the last.
        let g = U.clamp(P.x, -0.7, 0.7);
        const rows = 4 + phase, step = Math.max(1200, P.speed * 0.32), dir = U.pick([-1, 1]);
        for (let r = 0; r < rows; r++) {
          const z = P.z + P.speed * 1.4 + r * step;
          g = U.clamp(g + dir * U.rand(0.06, 0.16), -0.75, 0.75);
          for (let x = -1.2; x <= 1.21; x += 0.3) if (Math.abs(x - g) > 0.24) G.add('tentwarn', x, z);
        }
        HUD.pop('TENTACLE CORRIDOR!', b.def.color, 0.8);
        break;
      }
    }
  },

  lob(G, tx, style) {
    const P = G.player, e = G.boss.e;
    const closing = Math.max(2600, P.speed * 0.45), T = e.dist / closing;
    const y0 = (e.y || 0) + 1100;
    tx = U.clamp(tx, -1.3, 1.3);
    G.add('snowbomb', e.x, e.z, { y: y0, vy: (1200 * T * T - y0) / T, vz: P.speed - closing, vx: (tx - e.x) / T, style, boss: true });
    Sfx.whoosh();
  },

  rollT(G) { const P = G.player; return 6500 / (P.speed + 1800); },
  roller(G, x) {
    const P = G.player;
    G.add('roller', U.clamp(x, -1.3, 1.3), P.z + 6500, { vz: -1800, boss: true });
  },

  // ---------------------------------------------------------------- damage
  damage(G, amount, label) {
    const b = G.boss;
    if (!b || b.done) return;
    amount = Math.round(amount);
    b.hp = Math.max(0, b.hp - amount);
    b.e.hurtT = 0.35;
    HUD.pop(`-${amount} ${label}`, '#ff5a5f', 0.7, `${b.def.name}: ${Math.ceil((b.hp / b.maxHp) * 100)}%`);
    Sfx.smash();
    if (b.hp <= 0) this.finish(G, true);
  },

  onPlayerHit(G) {
    const b = G.boss;
    if (!b) return;
    b.easeT = 4; b.cleanT = 0;
  },

  finish(G, defeated) {
    const b = G.boss;
    if (b.done) return;
    b.done = defeated ? 'defeated' : 'escaped';
    b.queue.length = 0;
    G.stats.bosses++;
    if (defeated) {
      G.stats.bossKills++;
      Save.data.bossesBeaten = Save.data.bossesBeaten || {};
      Save.data.bossesBeaten[b.def.id] = true;
      G.stats.coins += 40;
      const pts = G.award(5000 * b.tier);
      HUD.pop(`${b.def.name.toUpperCase()} DEFEATED!`, b.def.color, 1.3, `+${U.fmt(pts)}  ·  +40 coins`);
      HUD.banner('BOSS DEFEATED!', '#5ee27a', 3);
      Voice.say(`You defeated ${b.def.name}!`, 1, true);
      G.fireworks(10);
      Sfx.record();
    } else {
      G.stats.coins += 10;
      const pts = G.award(1500);
      HUD.pop(`${b.def.name.toUpperCase()} ESCAPED`, '#ffffff', 1.1, `you survived  ·  +${U.fmt(pts)}  ·  +10 coins`);
      HUD.banner('BOSS SURVIVED', '#7dfcff', 2.5);
      Voice.say(`${b.def.name} got away. You survived!`, 0.8, true);
      G.fireworks(4);
    }
  },
};

// ---------------------------------------------------------------- boss art and attack objects
Object.assign(ET, {
  bosssnowman: {
    kind: 'none', w: 0, h: 1800, d: 0,
    draw(c, e, t) {
      const shake = e.hurtT > 0 ? Math.sin(t * 60) * 20 : 0;
      c.translate(shake, 0);
      c.scale(3, 3);
      ET.snowman.draw(c, e, t);
      Art.line(c, [-40, -398, -16, -386], '#222', 8); Art.line(c, [40, -398, 16, -386], '#222', 8);
      c.strokeStyle = '#222'; c.lineWidth = 6; c.beginPath(); c.arc(0, -330, 22, Math.PI + 0.3, -0.3); c.stroke();
      c.scale(1 / 3, 1 / 3);
      if (e.hurtT > 0) Art.circ(c, 0, -800, 600, 'rgba(255,255,255,0.25)');
      Art.label(c, 'FROSTY THE DESTROYER', 0, -1650, 150, '#7fe7ff', '#101a3a');
    },
  },
  bossufo: {
    kind: 'none', w: 0, h: 600, d: 0, shadow: false,
    draw(c, e, t) {
      const shake = e.hurtT > 0 ? Math.sin(t * 60) * 20 : 0;
      c.translate(shake, 0);
      c.save(); c.scale(3.2, 3.2);
      c.fillStyle = 'rgba(170,230,255,0.7)';
      c.beginPath(); c.ellipse(0, -40, 120, 100, 0, Math.PI, TAU); c.fill();
      Art.ell(c, 0, -70, 40, 50, '#6fe36f'); Art.ell(c, -16, -78, 12, 18, '#111'); Art.ell(c, 16, -78, 12, 18, '#111');
      Art.ell(c, 0, 0, 300, 70, e.hurtT > 0 ? '#ffffff' : '#a9b3c7');
      Art.ell(c, 0, 20, 280, 40, '#7d879c');
      for (let i = 0; i < 10; i++) Art.circ(c, -250 + i * 55, 8, 14, (Math.floor(t * 10) + i) % 2 ? '#fff36b' : '#ff4fa3');
      c.restore();
      Art.label(c, 'THE MOTHERSHIP', 0, -560, 150, '#7dff9a', '#101a3a');
    },
  },
  bosskraken: {
    kind: 'none', w: 0, h: 1600, d: 0,
    draw(c, e, t) {
      const shake = e.hurtT > 0 ? Math.sin(t * 60) * 20 : 0;
      c.translate(shake, 0);
      Art.ell(c, 0, 0, 1100, 220, '#1d2c4a');
      for (let i = 0; i < 6; i++) {
        const x = -900 + i * 360, ph = t * 2 + i;
        c.strokeStyle = e.hurtT > 0 ? '#ffffff' : '#8f5be8'; c.lineWidth = 120; c.lineCap = 'round';
        c.beginPath(); c.moveTo(x, 0);
        c.quadraticCurveTo(x + Math.sin(ph) * 300, -700, x + Math.sin(ph + 1) * 400, -1300 - Math.sin(ph * 1.3) * 200);
        c.stroke();
      }
      Art.ell(c, 0, -260, 520, 300, '#6a3fb5');
      for (const s of [-1, 1]) { Art.circ(c, s * 200, -330, 110, '#fff36b'); Art.ell(c, s * 200, -330, 30, 90, '#101a3a'); }
      Art.label(c, 'THE ICE KRAKEN', 0, -1650, 150, '#b36bff', '#101a3a');
    },
  },
  roller: {
    kind: 'crash', w: 230, h: 460, d: 200, name: 'a giant rolling snowball',
    update(e, dt) { e.z += e.vz * dt; e.spin = (e.spin || 0) - dt * 6; },
    draw(c, e) {
      c.translate(0, -230); c.rotate(e.spin || 0);
      Art.circ(c, 0, 0, 230, '#f4f8ff');
      c.strokeStyle = '#c9d7ea'; c.lineWidth = 16;
      for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(0, 0, 70 + i * 40, i * 1.6, i * 1.6 + 2); c.stroke(); }
      Art.circ(c, -60, -40, 18, '#222'); Art.circ(c, 60, -40, 18, '#222');
      c.strokeStyle = '#222'; c.lineWidth = 10; c.beginPath(); c.arc(0, 40, 50, Math.PI + 0.4, -0.4); c.stroke();
    },
  },
  pillar: {
    kind: 'crash', w: 170, h: 320, d: 140, name: 'a tractor beam',
    update(e, dt) { e.x += e.vx * dt; },
    shadow: false,
    draw(c, e, t) {
      const g = c.createLinearGradient(0, -2400, 0, 0);
      g.addColorStop(0, 'rgba(125,255,154,0)'); g.addColorStop(1, 'rgba(125,255,154,0.7)');
      c.fillStyle = g; c.fillRect(-170, -2400, 340, 2400);
      Art.ell(c, 0, 0, 230, 60, `rgba(125,255,154,${0.5 + 0.3 * Math.sin(t * 12)})`);
      Art.rect(c, -30, -2400, 60, 2400, 'rgba(255,255,255,0.5)');
    },
  },
  mine: {
    kind: 'crash', w: 110, h: 120, d: 80, name: 'a plasma mine',
    update(e, dt, G) { if (e.y > 0 && Ent.faller(e, dt, G)) e.y = 0; },
    draw(c, e, t) {
      const on = Math.floor(t * 6 + e.seed) % 2;
      Art.ell(c, 0, -50, 110, 55, '#3a4050');
      Art.ell(c, 0, -70, 70, 40, on ? '#7dff9a' : '#2a6b3a');
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI; Art.line(c, [Math.cos(a) * 100, -50 - Math.sin(a) * 40, Math.cos(a) * 140, -50 - Math.sin(a) * 70], '#3a4050', 12); }
    },
  },
  tentwarn: {
    kind: 'warn', w: 150, h: 0, d: 0,
    update(e, dt, G) {
      if (e.z - G.player.z < Math.max(G.player.speed, 2500) * 0.45) {
        e.type = 'tentacle'; e.t = 0;
        if (e.z - G.player.z < 9000) Sfx.smash();
      }
    },
    draw(c, e, t) {
      const p = 0.5 + 0.5 * Math.sin(t * 16);
      c.strokeStyle = `rgba(255,60,90,${0.5 + p * 0.5})`; c.lineWidth = 26;
      c.beginPath(); c.ellipse(0, 0, 200, 50, 0, 0, TAU); c.stroke();
      Art.ell(c, 0, 0, 120, 28, 'rgba(60,40,90,0.5)');
    },
  },
  tentacle: {
    kind: 'crash', w: 130, h: 1000, d: 90, name: 'a kraken tentacle',
    draw(c, e, t) {
      const k = Math.min(1, e.t / 0.18);
      Art.ell(c, 0, 0, 200, 50, '#1d2c4a');
      c.strokeStyle = '#8f5be8'; c.lineWidth = 120; c.lineCap = 'round';
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(Math.sin(t * 4 + e.seed) * 120, -500 * k, Math.sin(t * 3 + e.seed) * 160, -950 * k); c.stroke();
      c.strokeStyle = '#c9a6ff'; c.lineWidth = 30;
      for (let i = 1; i < 5; i++) { const y = -i * 190 * k; c.beginPath(); c.arc(Math.sin(t * 4 + e.seed) * 60 * (i / 4), y, 14, 0, TAU); c.stroke(); }
    },
  },
});

// Boss snowballs can be green plasma instead.
const _bombDraw = ET.snowbomb.draw;
ET.snowbomb.draw = function (c, e, t) {
  if (e.style !== 'plasma') return _bombDraw.call(this, c, e, t);
  c.translate(0, -160);
  Art.circ(c, 0, 0, 220, 'rgba(125,255,154,0.3)');
  Art.circ(c, 0, 0, 150, '#7dff9a');
  Art.circ(c, 0, 0, 80, '#eaffef');
};
