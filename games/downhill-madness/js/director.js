'use strict';
// The Director drops a set piece ahead of you every few seconds.
// Gaps shrink as speed and madness climb, and sillier events unlock with each level.

// Obstacle trees match the zone's scenery (candy canes, dead trees, crystals...).
function treeProps(z) { return { v: U.randInt(0, 4), s: U.rand(0.8, 1.1), set: zoneAtZ(z).id }; }

function estSpeed(G) { return Math.max(G.player.speed, G.maxSpeed * 0.85, 3000); }

// Place a lateral crosser so it is on the piste around when the player arrives.
function crosser(G, type, z, speedX, extra) {
  const dir = U.pick([-1, 1]);
  const vx = dir * speedX;
  const tArrive = (z - G.player.z) / estSpeed(G);
  const target = U.rand(-0.7, 0.7);
  const x = U.clamp(target - vx * tArrive, -3.5, 3.5);
  return G.add(type, x, z, Object.assign({ vx }, extra));
}

function coinArc(G, x, z0, power) {
  const v = estSpeed(G), vy = (900 + v * 0.26) * power, T = (2 * vy) / CFG.GRAVITY, n = 7;
  for (let i = 1; i <= n; i++) {
    const t = (T * i) / (n + 1);
    G.add('coin', x, z0 + v * t, { y: Math.max(0, vy * t - 0.5 * CFG.GRAVITY * t * t - 40) });
  }
  return v * T;
}

const EVENTS = [
  { id: 'ramp', lvl: 1, w: 6, spawn(G, z) {
    const triple = G.level >= 3 && U.chance(0.4);
    const xs = triple ? [-0.65, 0, 0.65] : [U.rand(-0.6, 0.6)];
    for (const x of xs) G.add('ramp', x, z);
    const arcX = U.pick(xs);
    let len = 2000;
    if (U.chance(0.75)) len = Math.max(len, coinArc(G, arcX, z, 1));
    return len;
  } },
  { id: 'slalom', lvl: 1, w: 4, spawn(G, z) {
    const rows = U.randInt(4, 6), step = Math.max(1800, estSpeed(G) * 0.42);
    const pool = G.level >= 2 ? ['tree', 'rock', 'tree', 'snowman'] : ['tree', 'rock', 'tree'];
    for (let r = 0; r < rows; r++) {
      const gap = U.rand(-0.7, 0.7);
      for (const x of [-0.92, -0.55, -0.18, 0.18, 0.55, 0.92]) {
        if (Math.abs(x - gap) < 0.3 || !U.chance(0.6)) continue;
        const t = U.pick(pool);
        G.add(t, x + U.rand(-0.05, 0.05), z + r * step, t === 'tree' ? treeProps(z + r * step) : {});
      }
    }
    return rows * step;
  } },
  { id: 'rocks', lvl: 1, w: 3, spawn(G, z) {
    const n = U.randInt(6, 10);
    for (let i = 0; i < n; i++) {
      const t = U.chance(0.7) ? 'rock' : 'tree';
      G.add(t, U.rand(-0.95, 0.95), z + U.rand(0, 7000), t === 'tree' ? treeProps(z) : {});
    }
    return 7000;
  } },
  { id: 'coins', lvl: 1, w: 3, spawn(G, z) {
    const x0 = U.rand(-0.5, 0.5), n = 12;
    for (let i = 0; i < n; i++) G.add('coin', x0 + Math.sin(i * 0.55) * 0.4, z + i * 500);
    if (U.chance(0.5)) G.add('rock', x0 + U.pick([-0.5, 0.5]), z + 3000);
    return n * 500;
  } },
  { id: 'moguls', lvl: 1, w: 2, spawn(G, z) {
    for (let r = 0; r < 4; r++) for (let i = 0; i < 4; i++) G.add('mogul', -0.75 + i * 0.5 + (r % 2) * 0.25, z + r * 1000);
    return 4000;
  } },
  { id: 'snowmen', lvl: 1, w: 2, spawn(G, z) {
    const n = U.randInt(5, 9);
    for (let i = 0; i < n; i++) G.add('snowman', U.rand(-0.9, 0.9), z + U.rand(0, 5000));
    return 5000;
  } },
  { id: 'boost', lvl: 2, w: 3, spawn(G, z) {
    const x = U.rand(-0.6, 0.6), n = U.randInt(1, 2);
    for (let i = 0; i < n; i++) G.add('boost', x, z + i * 2200);
    for (let i = 0; i < 6; i++) G.add('coin', x, z + n * 2200 + i * 600);
    return n * 2200 + 3600;
  } },
  { id: 'yeti', lvl: 2, w: 2, spawn(G, z) {
    const n = G.level >= 5 ? 2 : 1;
    for (let i = 0; i < n; i++) crosser(G, 'yeti', z + i * 2500, U.rand(0.3, 0.45));
    G.banner('YETI CROSSING', '#7b93b8');
    return n * 2500;
  } },
  { id: 'surge', lvl: 2, w: 1.6, spawn(G) { G.startSurge(); return 1500; } },
  { id: 'penguins', lvl: 3, w: 3, spawn(G, z) {
    const n = U.randInt(8, 14), dir = U.pick([-1, 1]);
    const tArrive = (z - G.player.z) / estSpeed(G);
    for (let i = 0; i < n; i++) {
      const vx = dir * U.rand(0.35, 0.55);
      const x = U.clamp(U.rand(-0.9, 0.9) - vx * tArrive, -4, 4);
      G.add('penguin', x, z + U.rand(0, 3000), { vx });
    }
    G.banner('PENGUIN STAMPEDE', '#ffa51f');
    return 3000;
  } },
  { id: 'snowball', lvl: 3, w: 2, spawn(G, z) {
    crosser(G, 'snowball', z, U.rand(0.45, 0.6));
    return 1500;
  } },
  { id: 'lift', lvl: 3, w: 2, spawn(G, z) {
    const x = U.pick([-0.45, 0.45]), step = 3200;
    for (let i = 0; i < 4; i++) {
      G.add('pylon', x, z + i * step);
      if (U.chance(0.5)) G.add('rock', -x + U.rand(-0.2, 0.2), z + i * step + 1600);
    }
    return 4 * step;
  } },
  { id: 'megaramp', lvl: 4, w: 2.5, spawn(G, z) {
    const x = U.rand(-0.3, 0.3);
    G.add('megaramp', x, z);
    G.add('rock', x - 0.62, z + 200); G.add('rock', x + 0.62, z + 200);
    G.banner('MEGA RAMP AHEAD', '#ffd23f');
    return Math.max(2500, coinArc(G, x, z, 1.75));
  } },
  { id: 'pianos', lvl: 4, w: 2, spawn(G, z) {
    const n = U.randInt(3, 6);
    for (let i = 0; i < n; i++) {
      const y0 = 3800;
      G.add('piano', U.rand(-0.85, 0.85), z + i * U.rand(1200, 2000), { y: y0, fallT: Math.sqrt((2 * y0) / CFG.GRAVITY) });
    }
    G.banner('PIANOS INCOMING', '#d8b25a');
    return n * 1800;
  } },
  { id: 'cows', lvl: 4, w: 2, spawn(G, z) {
    const n = U.randInt(3, 5);
    for (let i = 0; i < n; i++) crosser(G, 'cow', z + i * 1600, U.rand(0.5, 0.75), { y: U.rand(120, 900) });
    G.banner('COWS. FLYING. WHY.', '#fafafa');
    return n * 1600;
  } },
  { id: 'ufo', lvl: 5, w: 2, spawn(G, z) {
    const x = U.rand(-0.55, 0.55);
    G.add('ufo', x, z, { bx: x, y: 1400 });
    const v = estSpeed(G);
    for (let i = 0; i < 8; i++) G.add('coin', x, z + 1200 + i * v * 0.3, { y: 1300 + Math.sin((i / 7) * Math.PI) * 1500 });
    return 3000 + v * 2.4;
  } },
  { id: 'meteors', lvl: 6, w: 2, spawn(G, z) {
    const n = U.randInt(3, 6);
    for (let i = 0; i < n; i++) {
      const y0 = 7000, tx = U.rand(-0.85, 0.85);
      G.add('meteor', tx + 1.4, z + i * U.rand(1500, 2400), { y: y0, y0, tx, dir: U.pick([-1, 1]), fallT: Math.sqrt((2 * y0) / CFG.GRAVITY) });
    }
    G.banner('METEOR SHOWER', '#ff7a1f');
    return n * 2000;
  } },
  { id: 'duck', lvl: 6, w: 1.5, spawn(G, z) {
    const n = U.randInt(1, 3);
    for (let i = 0; i < n; i++) G.add('duck', U.rand(-0.7, 0.7), z + i * 2600);
    return n * 2600;
  } },
  { id: 'dino', lvl: 7, w: 1.6, spawn(G, z) {
    crosser(G, 'dino', z, U.rand(0.3, 0.42));
    G.banner('IS THAT A T-REX?', '#46b556');
    return 2000;
  } },
  { id: 'power', lvl: 1, w: 2.2, spawn(G, z) {
    const pool = [{ p: 'shield', w: 3 }, { p: 'magnet', w: 3 }, { p: 'double', w: 2 }];
    if (G.level >= 2) pool.push({ p: 'rocket', w: 2 }, { p: 'wings', w: 2 });
    if (G.level >= 3) pool.push({ p: 'giant', w: 1.6 });
    const x = U.rand(-0.7, 0.7);
    for (let i = 0; i < 5; i++) G.add('coin', x, z - 2500 + i * 500);
    G.add('power', x, z, { p: U.weighted(pool).p });
    return 1000;
  } },
  { id: 'rivals', lvl: 1, w: 1.8, spawn(G) {
    const n = U.randInt(2, 4), names = RIVAL_NAMES.slice().sort(() => Math.random() - 0.5);
    for (let i = 0; i < n; i++) {
      const bx = U.rand(-0.6, 0.6);
      G.add('rival', bx, G.player.z + 11000 + i * 1800, {
        bx, vz: G.maxSpeed * U.rand(0.55, 0.72), name: names[i],
        sled: U.pick(SLEDS).id, outfit: U.pick(OUTFITS).id,
      });
    }
    return 1500;
  } },
  { id: 'gates', lvl: 2, w: 2.2, spawn(G, z) {
    const step = Math.max(2600, estSpeed(G) * 0.6), n = 5, series = Math.random();
    const side = U.pick([-1, 1]);
    for (let i = 0; i < n; i++) {
      G.add('gate', side * (i % 2 ? 0.45 : -0.45) + U.rand(-0.1, 0.1), z + i * step, { series, idx: i, total: n, col: i % 2 ? '#3d6fd6' : '#e63946' });
    }
    G.gateSeries[series] = 0;
    return n * step;
  } },
  { id: 'crevasse', lvl: 2, w: 1.6, spawn(G, z) {
    for (const x of [-0.8, -0.4, 0, 0.4, 0.8]) G.add('ramp', x, z);
    G.add('crevasse', 0, z + 800);
    return 2400 + estSpeed(G) * 0.8;
  } },
  { id: 'snowcat', lvl: 3, w: 1.8, spawn(G, z) {
    const n = G.level >= 6 ? 2 : 1;
    for (let i = 0; i < n; i++) G.add('snowcat', U.rand(-0.55, 0.55), z + i * 4000, { vz: -1800 });
    return n * 4000;
  } },
  { id: 'logs', lvl: 1, w: 3, spawn(G, z) {
    const n = U.randInt(2, 4), step = Math.max(1800, estSpeed(G) * 0.45);
    for (let i = 0; i < n; i++) G.add('log', U.rand(-0.6, 0.6), z + i * step);
    G.banner('HOP THE LOGS!', '#c9955a');
    return n * step;
  } },
  { id: 'fences', lvl: 2, w: 2.5, spawn(G, z) {
    const rows = U.randInt(2, 3), step = Math.max(2400, estSpeed(G) * 0.55);
    for (let r = 0; r < rows; r++) {
      const gap = U.rand(-0.65, 0.65);
      for (let x = -0.95; x <= 0.96; x += 0.32) if (Math.abs(x - gap) > 0.3) G.add('fence', x, z + r * step);
    }
    return rows * step;
  } },
  { id: 'skiers', lvl: 1, w: 2, spawn(G, z) {
    const n = U.randInt(3, 5);
    for (let i = 0; i < n; i++) G.add('skier', U.rand(-0.85, 0.85), z + U.rand(0, 5000));
    return 5000;
  } },
  { id: 'village', lvl: 2, w: 2, spawn(G, z) {
    const n = U.randInt(3, 5);
    for (let i = 0; i < n; i++) G.add('igloo', U.pick([-0.75, -0.25, 0.25, 0.75]) + U.rand(-0.08, 0.08), z + i * 1800);
    G.add('cabin', U.pick([-0.55, 0.55]), z + n * 1800 + 1200);
    return n * 1800 + 2400;
  } },
  { id: 'moose', lvl: 2, w: 2, spawn(G, z) {
    const n = G.level >= 4 ? 2 : 1;
    for (let i = 0; i < n; i++) crosser(G, 'moose', z + i * 2200, U.rand(0.3, 0.45));
    G.banner('MOOSE ON THE LOOSE', '#c9955a');
    return n * 2200;
  } },
  { id: 'unibear', lvl: 5, w: 1.6, spawn(G, z) {
    crosser(G, 'unibear', z, U.rand(0.35, 0.5));
    G.banner('IS THAT BEAR ON A UNICYCLE?', '#5ee27a');
    return 1500;
  } },
  { id: 'hottub', lvl: 6, w: 1.4, spawn(G, z) {
    G.add('hottub', U.rand(-0.5, 0.5), z);
    return 1500;
  } },
  { id: 'rails', lvl: 1, w: 2.6, spawn(G, z) {
    const len = Math.round(estSpeed(G) * U.rand(1.2, 2) / 200) * 200; // ~1.2–2 seconds of grinding
    const xs = G.level >= 3 && U.chance(0.5) ? [-0.45, 0.45] : [U.rand(-0.5, 0.5)];
    for (const x of xs) {
      G.add('rail', x, z, { len, h: 130 });
      for (let i = 1; i < 6; i++) G.add('coin', x, z + (i * len) / 6, { y: 300 });
    }
    if (G.level >= 2 && U.chance(0.5)) G.add('ramp', xs[0], z - 1400); // launch onto it from above
    return len + 1500;
  } },
  { id: 'cave', lvl: 3, w: 1.8, spawn(G, z) {
    const n = U.randInt(9, 14), step = 650;
    for (let i = 0; i < n; i++) G.add('arch', 0, z + i * step);
    const x0 = U.rand(-0.4, 0.4);
    for (let i = 0; i < n; i++) G.add('coin', x0 + Math.sin(i * 0.7) * 0.35, z + 300 + i * step);
    for (let i = 0; i < U.randInt(2, 4); i++) G.add('rock', U.rand(-0.85, 0.85), z + U.rand(1000, n * step - 500));
    G.banner('ICE CAVE', '#7fbfe8');
    return n * step + 600;
  } },
  { id: 'tramps', lvl: 2, w: 2, spawn(G, z) {
    const n = U.randInt(2, 3), step = Math.max(3000, estSpeed(G) * 0.9);
    for (let i = 0; i < n; i++) {
      const x = U.rand(-0.6, 0.6);
      G.add('tramp', x, z + i * step);
      const v = estSpeed(G), vy = 2600 + v * 0.16;
      coinArc(G, x, z + i * step, vy / (900 + v * 0.26));
    }
    return n * step;
  } },
  { id: 'cannon', lvl: 4, w: 1.4, spawn(G, z) {
    const x = U.rand(-0.3, 0.3);
    G.add('cannon', x, z);
    for (const s of [-1, 1]) G.add('rock', x + s * 0.5, z + 300);
    G.banner('HUMAN CANNON AHEAD', '#e63946');
    return 3000 + estSpeed(G) * 1.5;
  } },
  { id: 'nado', lvl: 4, w: 1.4, spawn(G, z) {
    crosser(G, 'nado', z, U.rand(0.3, 0.45));
    G.banner('SNOWNADO!', '#dff3ff');
    return 2000;
  } },
  { id: 'ice', lvl: 2, w: 1.8, spawn(G, z) {
    const x = U.rand(-0.4, 0.4), len = 2600;
    G.add('ice', x, z, { len });
    G.add('rock', x + U.pick([-0.6, 0.6]), z + len * 0.5);
    for (let i = 0; i < 5; i++) G.add('coin', x + U.rand(-0.3, 0.3), z + 300 + i * 450);
    return len + 600;
  } },
  { id: 'train', lvl: 2, w: 1.6, spawn(G, z) {
    // A train crosses the slope: slip through a gap between carriages, or hit a ramp and jump it.
    const dir = U.pick([-1, 1]), vx = dir * U.rand(0.32, 0.42);
    const cars = U.randInt(3, 5), spacing = 0.62;
    const tArrive = (z - G.player.z) / estSpeed(G);
    const headX = U.rand(-0.2, 0.2) + (dir * cars * spacing) / 2 - vx * tArrive;
    G.add('traintrack', 0, z);
    G.add('loco', headX, z, { vx });
    for (let i = 1; i <= cars; i++) G.add('traincar', headX - dir * i * spacing, z, { vx, style: i % 4 });
    for (const x of [-0.5, 0.5]) G.add('ramp', x, z - 3000);
    G.banner('TRAIN CROSSING!', '#e63946');
    return 2500;
  } },
  { id: 'skijump', lvl: 3, w: 1.3, spawn(G, z) {
    G.add('skijump', 0, z);
    G.banner('SKI JUMP! HOW FAR CAN YOU FLY?', '#3d6fd6');
    return Math.max(3000, coinArc(G, 0, z, 2.3));
  } },
  { id: 'letter', lvl: 1, w: 2.4, spawn(G, z) {
    // The next letter of M-A-D-N-E-S-S, usually guarded by something.
    const x = U.rand(-0.7, 0.7);
    G.add('letter', x, z, { idx: G.letterIdx });
    if (U.chance(0.6)) for (const s of [-1, 1]) G.add('rock', x + s * 0.32, z + U.rand(-300, 300));
    else for (let i = 1; i <= 5; i++) G.add('coin', x, z - i * 450);
    return 1500;
  } },
  // ---- zone-only events: they only happen in their zone, and often
  { id: 'gummies', zone: 'candy', lvl: 1, w: 4, spawn(G, z) {
    const n = U.randInt(8, 14), dir = U.pick([-1, 1]), tArrive = (z - G.player.z) / estSpeed(G);
    for (let i = 0; i < n; i++) {
      const vx = dir * U.rand(0.3, 0.5);
      G.add('gummy', U.clamp(U.rand(-0.9, 0.9) - vx * tArrive, -4, 4), z + U.rand(0, 3000), { vx, style: i % 4 });
    }
    G.banner('GUMMY BEAR STAMPEDE', '#ff4f7b');
    return 3000;
  } },
  { id: 'choco', zone: 'candy', lvl: 1, w: 3, spawn(G, z) {
    G.add('choco', 0, z, { len: 1800 });
    for (const x of [-0.6, 0, 0.6]) if (U.chance(0.6)) G.add('ramp', x, z - 2200);
    G.banner('CHOCOLATE RIVER!', '#a0673a');
    return 2600;
  } },
  { id: 'ghosts', zone: 'haunted', lvl: 1, w: 4, spawn(G, z) {
    const n = U.randInt(4, 7), dir = U.pick([-1, 1]), tArrive = (z - G.player.z) / estSpeed(G);
    for (let i = 0; i < n; i++) {
      const vx = dir * U.rand(0.25, 0.45);
      G.add('spook', U.clamp(U.rand(-0.8, 0.8) - vx * tArrive, -4, 4), z + i * 700, { vx, by: U.rand(0, 500) });
    }
    G.banner('GHOSTS! DON\'T GET SPOOKED', '#b36bff');
    return n * 700;
  } },
  { id: 'skeletons', zone: 'haunted', lvl: 1, w: 3, spawn(G) {
    const names = ['BONES', 'SKULLY', 'MR. RATTLES', 'SPINE'];
    for (let i = 0; i < U.randInt(2, 3); i++) {
      const bx = U.rand(-0.6, 0.6);
      G.add('rival', bx, G.player.z + 11000 + i * 1800, { bx, vz: G.maxSpeed * U.rand(0.55, 0.7), name: names[i], sled: U.pick(['toboggan', 'door', 'piano']), outfit: 'skeleton' });
    }
    return 1500;
  } },
  { id: 'lasers', zone: 'crystal', lvl: 1, w: 4, spawn(G, z) {
    const n = U.randInt(2, 4), step = Math.max(2600, estSpeed(G) * 0.7);
    for (let i = 0; i < n; i++) G.add('laser', 0, z + i * step, { seed: i * 1.7 });
    G.banner('LASER GRID: HOP OR TIME IT', '#ff4f7b');
    return n * step;
  } },
  { id: 'shards', zone: 'crystal', lvl: 1, w: 3, spawn(G, z) {
    const n = U.randInt(4, 7), y0 = 4200;
    for (let i = 0; i < n; i++) G.add('shard', U.rand(-0.85, 0.85), z + i * U.rand(900, 1500), { y: y0, fallT: Math.sqrt((2 * y0) / CFG.GRAVITY) });
    G.banner('CRYSTAL SHARDS FALLING', '#7fe7ff');
    return n * 1300;
  } },
  { id: 'blizzard', lvl: 3, w: 1.1, spawn(G) { G.startBlizzard(); return 800; } },
  { id: 'chaos', lvl: 8, w: 2.5, spawn(G, z) {
    const pool = EVENTS.filter(e => e.lvl <= G.level && !e.zone && !['chaos', 'surge', 'crevasse', 'rivals', 'power', 'blizzard'].includes(e.id));
    const a = U.pick(pool).spawn(G, z) || 0;
    const b = U.pick(pool).spawn(G, z + 800) || 0;
    return Math.max(a, b + 800);
  } },
];

const Director = {
  cursor: 0,
  lastSurgeZ: -1e9,
  reset(G, firstGap = 9000) { this.cursor = G.player.z + firstGap; this.lastSurgeZ = -1e9; },
  // Scatter a few loose obstacles between set pieces so the slope is never empty.
  filler(G, z0, span) {
    if (span < 600) return;
    const pool = G.mod === 'penguins' ? ['penguin', 'penguin', 'penguin', 'rock'] : ['rock', 'rock', 'tree', 'log', 'skier'];
    if (G.level >= 2) pool.push('igloo', 'snowman', 'fence');
    if (G.level >= 4) pool.push('penguin', 'mogul');
    const n = U.randInt(1, 2 + Math.min(3, Math.floor(G.level / 2)));
    for (let i = 0; i < n; i++) {
      const t = U.pick(pool);
      G.add(t, U.rand(-0.9, 0.9), z0 + U.rand(0, span), t === 'tree' ? treeProps(z0) : t === 'penguin' ? { vx: G.mod === 'penguins' ? U.rand(-0.3, 0.3) : 0 } : {});
    }
  },
  update(G) {
    const P = G.player, horizon = P.z + 36000;
    let guard = 0;
    while (this.cursor < horizon && guard++ < 6) {
      const zone = zoneAtZ(this.cursor).id;
      // Daily twists unlock and boost certain events.
      const boosted = G.mod === 'penguins' ? ['penguins'] : G.mod === 'rampage' ? ['ramp', 'megaramp', 'tramps', 'cannon', 'skijump'] : G.mod === 'coinrain' ? ['coins', 'ramp'] : [];
      const pool = EVENTS.filter(e => (e.lvl <= G.level || boosted.includes(e.id)) && (!e.zone || e.zone === zone) && !(e.id === 'surge' && (G.attract || this.cursor - this.lastSurgeZ < 60000)))
        .map(e => ({ ev: e, w: e.w * (boosted.includes(e.id) ? 4 : 1) }));
      const pick = pool.length ? U.weighted(pool).ev : U.pick(EVENTS.filter(e => e.lvl <= 1));
      const ev = pick;
      if (ev.id === 'surge') this.lastSurgeZ = this.cursor;
      const len = ev.spawn(G, this.cursor) || 0;
      const gap = Math.max(2500, estSpeed(G) * U.rand(0.8, 1.4) * Math.max(0.5, 1 - G.level * 0.045));
      this.filler(G, this.cursor + len + 900, gap - 1800);
      this.cursor += len + gap;
    }
  },
};
