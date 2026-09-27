'use strict';
// Save / continue via localStorage. The world itself is regenerated from its seed,
// so only the player's progress and the tiles they changed are stored.
const Save = {
  KEY: 'castaway-three-isles-v3',

  exists() {
    try { return !!localStorage.getItem(this.KEY); } catch (e) { return false; }
  },

  clear() { try { localStorage.removeItem(this.KEY); } catch (e) { /* ignore */ } },

  write() {
    const G = Game, p = G.player;
    if (G.state === 'title') return;
    const changes = [];
    for (const [i, t] of World.changes) changes.push(i, t === T.BUSH ? T.BERRY : t);
    // explored map: run-length encoded
    const ex = World.explored, runs = [];
    let cur = ex[0], n = 0;
    for (let i = 0; i < ex.length; i++) { if (ex[i] === cur) n++; else { runs.push(n); cur = ex[i]; n = 1; } }
    runs.push(n);
    const data = {
      v: 3, first: ex[0],
      p: { x: G.checkpoint.x, y: G.checkpoint.y, hp: p.hp, maxHp: p.maxHp, food: p.food },
      diff: G.diffKey, inv: G.inv, flags: G.flags, stats: G.stats, playTime: G.playTime, cpIndex: G.cpIndex,
      tod: FX.tod, day: FX.day,
      cat: G.cat ? { state: G.cat.state, x: G.cat.x, y: G.cat.y } : null,
      bottles: G.bottles.filter(b => b.taken).map(b => b.id),
      changes, runs,
    };
    try {
      localStorage.setItem(this.KEY, JSON.stringify(data));
      UI.saved();
    } catch (e) { /* storage full or blocked: play on without saving */ }
  },

  load() {
    let data;
    try { data = JSON.parse(localStorage.getItem(this.KEY)); } catch (e) { return false; }
    if (!data || data.v !== 3) return false;
    const G = Game, p = G.player;
    for (let k = 0; k < data.changes.length; k += 2) {
      const i = data.changes[k], t = data.changes[k + 1];
      World.set0(i % World.W, (i / World.W) | 0, t);
      World.changes.set(i, t);
      if (t === T.CAMPFIRE && !World.campfires.some(c => World.idx(c.x, c.y) === i)) World.campfires.push({ x: i % World.W, y: (i / World.W) | 0 });
    }
    let pos = 0, val = data.first;
    for (const n of data.runs) {
      if (val) World.explored.fill(1, pos, pos + n);
      pos += n; val = val ? 0 : 1;
    }
    World.landExplored = 0;
    for (let i = 0; i < World.explored.length; i++) {
      if (!World.explored[i]) continue;
      if (World.dmap[i] < 1) World.landExplored++;
      UI.paintTile(i % World.W, (i / World.W) | 0);
    }
    Object.assign(p, { x: data.p.x, y: data.p.y, hp: data.p.hp, maxHp: data.p.maxHp, food: data.p.food, mode: 'walk' });
    G.checkpoint = { x: data.p.x, y: data.p.y };
    G.diffKey = data.diff || 'normal';
    Object.assign(G.inv, data.inv);
    Object.assign(G.flags, data.flags);
    Object.assign(G.stats, data.stats);
    G.playTime = data.playTime || 0;
    G.cpIndex = data.cpIndex ?? -1;
    FX.tod = data.tod ?? 0.3; FX.day = data.day ?? 1;
    if (data.cat && G.cat) Object.assign(G.cat, data.cat);
    for (const id of data.bottles || []) { const b = G.bottles.find(x => x.id === id); if (b) b.taken = true; }
    return true;
  },
};
