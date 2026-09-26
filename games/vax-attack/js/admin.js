// Admin console: only for the "admin" profile. Press ` (backquote) or the Console button, type a command, press Enter.
// Runs you touch with gameplay commands are marked as admin runs and never count toward records, missions or DNA.
(() => {
  const V = window.VAX;
  const G = V.G;
  const $ = id => document.getElementById(id);
  const A = V.admin = { open: false, frozen: false, speed: 1 };
  if (!V.profile.isAdmin) return;

  const box = $('console'), log = $('consoleLog'), input = $('consoleInput'), btn = $('consoleBtn');
  btn.hidden = false;
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  const out = (s, cls = '') => { log.insertAdjacentHTML('beforeend', `<div class="${cls}">${esc(s)}</div>`); log.scrollTop = log.scrollHeight; };
  const inGame = () => G.S && G.P && ['play', 'pause', 'upgrade'].includes(G.mode);
  const ensureGame = () => { if (!inGame()) { V.game.start(false); A.frozen = true; } };
  // any command that changes a run turns it into an admin run
  const cheat = () => {
    if (!G.S || G.S.cheated) return;
    G.S.cheated = true; V.meta.cheat(); V.ui.save('run', null);
    V.ui.toast(V.t('admin.badge'), '#ff9f43');
  };
  const num = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
  const types = () => Object.keys(V.ENEMIES);
  // match an id or a (translated or English) name, forgivingly
  function findType(q, bossOnly) {
    q = (q || '').toLowerCase().replace(/[\s_-]/g, '');
    const pool = types().filter(k => !bossOnly || V.ENEMIES[k].boss);
    return pool.find(k => k.toLowerCase() === q)
      || pool.find(k => V.tx.enemy(k).toLowerCase().replace(/[\s_-]/g, '') === q)
      || pool.find(k => k.startsWith(q) || V.tx.enemy(k).toLowerCase().replace(/[\s_-]/g, '').includes(q));
  }
  const killAll = () => {
    const S = G.S; let n = 0;
    for (const e of [...S.enemies]) if (e.hp > 0) { V.game.admin.kill(e); n++; }
    S.enemies = S.enemies.filter(e => e.hp > 0);
    for (const e of [...S.enemies]) if (e.hp > 0) { V.game.admin.kill(e); n++; }   // anything that split or spawned on death
    S.enemies = []; S.queue = []; S.toxins = []; S.mines = [];
    return n;
  };

  const CMDS = {
    help: { args: '', desc: 'list commands', run: () => { for (const [k, c] of Object.entries(CMDS)) out(`${k}${c.args ? ' ' + c.args : ''} — ${c.desc}`); } },
    kill: { args: '', desc: 'kill everything now (and the rest of the wave)', run: () => { ensureGame(); cheat(); out(`killed ${killAll()} pathogens`); } },
    wave: { args: '<n>', desc: 'jump straight to wave n (alias: level, goto)', run: ([n]) => {
      n = Math.round(num(n, NaN)); if (!(n >= 1 && n <= 999)) return out('usage: wave <1-999>', 'err');
      ensureGame(); cheat(); const S = G.S;
      S.enemies = []; S.queue = []; S.toxins = []; S.mines = []; S.pickups = []; S.orbs = [];
      if (n >= 6) S.primed = true;   // past Influenza Prime, as if you'd beaten it
      V.ui.show(null); G.mode = 'play'; V.game.admin.startWave(n); out(`now on wave ${n}${n % 5 === 0 ? ' (boss: ' + V.tx.bossName(V.bossFor(n / 5)) + ')' : ''}`);
    } },
    boss: { args: '[name]', desc: 'spawn a boss (default: the next one in order)', run: ([q]) => {
      ensureGame(); cheat();
      const k = q ? findType(q, true) : V.bossFor(Math.floor(G.S.wave / 5) + 1);
      if (!k) return out(`no boss matches "${q}" — try: ${V.BOSS_ORDER.join(', ')}`, 'err');
      V.game.admin.spawn(k); G.S.phase = 'fight'; out(`spawned ${V.tx.bossName(k)}`);
    } },
    spawn: { args: '<type> [count] [mutant|elite]', desc: 'spawn pathogens', run: ([q, c, flag]) => {
      if (!q) return out('usage: spawn <type> [count] [mutant|elite]', 'err');
      const k = findType(q); if (!k) return out(`unknown type "${q}"`, 'err');
      ensureGame(); cheat();
      const n = Math.min(60, Math.max(1, Math.round(num(c, 1))));
      for (let i = 0; i < n; i++) {
        const e = V.game.admin.spawn(k);
        if (flag === 'mutant' && V.MUTANT.pattern[k]) { e.mutant = true; e.hp = e.maxHp *= V.MUTANT.hp; e.mfire = 1; }
        if (flag === 'elite') { e.elite = true; e.hp = e.maxHp *= V.ELITE.hp; e.efire = 1; }
      }
      G.S.phase = 'fight'; out(`spawned ${n} × ${V.tx.enemy(k)}${flag ? ' (' + flag + ')' : ''}`);
    } },
    god: { args: '', desc: 'toggle invincibility', run: () => { ensureGame(); cheat(); G.P.god = !G.P.god; out(`god mode ${G.P.god ? 'ON' : 'off'}`); } },
    heal: { args: '', desc: 'full immunity', run: () => { ensureGame(); cheat(); G.P.hp = G.P.max; out(`immunity ${G.P.hp}/${G.P.max}`); } },
    hp: { args: '<n>', desc: 'set max immunity (and heal)', run: ([n]) => { ensureGame(); cheat(); G.P.max = G.P.hp = Math.min(30, Math.max(1, Math.round(num(n, G.P.max)))); out(`immunity ${G.P.hp}/${G.P.max}`); } },
    atp: { args: '<n>', desc: 'add ATP', run: ([n]) => { ensureGame(); cheat(); G.S.atp += Math.round(num(n, 500)); out(`ATP ${G.S.atp}`); } },
    dna: { args: '<n>', desc: 'add DNA to this profile', run: ([n]) => { V.meta.data.dna += Math.round(num(n, 500)); V.meta.save(); out(`DNA ${V.meta.data.dna}`); } },
    give: { args: '<power|all>', desc: 'grab a power-up', run: ([q]) => {
      ensureGame(); cheat();
      const keys = q === 'all' ? V.POW_KEYS.filter(k => V.POW[k].time) : [V.POW_KEYS.find(k => k === q || V.tx.pow(k).toLowerCase().includes((q || '').toLowerCase()))];
      if (!keys[0]) return out(`power-ups: ${V.POW_KEYS.join(', ')}`, 'err');
      for (const k of keys) V.game.admin.collect(k);
      out(`gave ${keys.join(', ')}`);
    } },
    upgrade: { args: '<id|all> [times]', desc: 'apply adaptations', run: ([q, c]) => {
      ensureGame(); cheat();
      const list = q === 'all' ? V.UPGRADES : V.UPGRADES.filter(u => u.id === q || V.tx.upg(u.id).toLowerCase().includes((q || '').toLowerCase())).slice(0, 1);
      if (!list.length) return out(`adaptations: ${V.UPGRADES.map(u => u.id).join(', ')}`, 'err');
      const times = Math.min(20, Math.max(1, Math.round(num(c, 1))));
      for (const u of list) for (let i = 0; i < times; i++) { u.apply(G.P, G.S); G.P.upg[u.id] = (G.P.upg[u.id] || 0) + 1; V.MOD?.upgraded?.(u, true); }
      out(`applied ${list.map(u => u.id).join(', ')} ×${times}`);
    } },
    prime: { args: '', desc: 'unlock strong power-ups/adaptations (as if Influenza Prime fell)', run: () => { ensureGame(); cheat(); G.S.primed = true; out('primed'); } },
    clear: { args: '', desc: 'remove all toxins and mines', run: () => { if (!inGame()) return out('not in a run', 'err'); G.S.toxins = []; G.S.mines = []; out('cleared'); } },
    speed: { args: '<0.25-4>', desc: 'game speed', run: ([n]) => { A.speed = Math.min(4, Math.max(.25, num(n, 1))); out(`speed ×${A.speed}`); } },
    unlock: { args: '', desc: 'unlock every difficulty, skin and battleground', run: () => {
      const d = V.meta.data; for (const k of Object.keys(d.unlocked)) d.unlocked[k] = true;
      V.meta.data.cos ??= { skins: ['classic'], scenes: ['blood'], skin: 'classic', scene: 'blood' };
      d.cos.skins = V.SKINS.map(s => s.id); d.cos.scenes = V.SCENES.map(s => s.id); V.meta.save(); V.ui.paintDiff(); out('everything unlocked');
    } },
    skin: { args: '<id>', desc: 'wear a skin', run: ([q]) => { const s = V.SKINS.find(k => k.id === q); if (!s) return out(`skins: ${V.SKINS.map(k => k.id).join(', ')}`, 'err'); CMDS.unlock.run([]); V.cos.equip('skin', s.id); out(`skin: ${s.id}`); } },
    scene: { args: '<id>', desc: 'change battleground', run: ([q]) => { const s = V.SCENES.find(k => k.id === q); if (!s) return out(`battlegrounds: ${V.SCENES.map(k => k.id).join(', ')}`, 'err'); CMDS.unlock.run([]); V.cos.equip('scene', s.id); out(`battleground: ${s.id}`); } },
    types: { args: '', desc: 'list pathogen ids', run: () => out(types().join(', ')) },
    stats: { args: '', desc: 'current run numbers', run: () => {
      if (!inGame()) return out('not in a run', 'err');
      const S = G.S, P = G.P;
      out(`wave ${S.wave} · level ${S.level} · ${S.enemies.length} on screen, ${S.queue.length} queued · score ${S.score} · ATP ${S.atp}`);
      out(`immunity ${P.hp}/${P.max} · dmg ${P.dmg.toFixed(2)} · fire every ${P.rate.toFixed(3)}s · lanes ${P.multi} · DPS ≈ ${V.game.playerDPS().toFixed(1)}${P.god ? ' · GOD' : ''}`);
    } },
    freeze: { args: '', desc: 'keep the game frozen while the console is open (toggle)', run: () => { A.keepFrozen = !A.keepFrozen; A.frozen = A.keepFrozen; out(`freeze while open: ${A.keepFrozen ? 'on' : 'off'}`); } },
    cls: { args: '', desc: 'clear this log', run: () => { log.innerHTML = ''; } },
  };
  Object.assign(CMDS, { level: CMDS.wave, goto: CMDS.wave, killall: CMDS.kill, nuke: CMDS.kill, '?': CMDS.help });

  const hist = []; let hi = 0;
  function run(line) {
    const [cmd, ...args] = line.trim().split(/\s+/);
    if (!cmd) return;
    out('> ' + line, 'cmd');
    const c = CMDS[cmd.toLowerCase()];
    if (!c) return out(`unknown command "${cmd}" — type help`, 'err');
    try { c.run(args); } catch (e) { out('error: ' + e.message, 'err'); }
    V.ui.hud(true);
  }

  A.toggle = (on = !A.open) => {
    A.open = on; box.hidden = !on;
    A.frozen = on && A.keepFrozen !== false;   // frozen by default while typing
    V.input.release();
    if (on) { input.focus(); if (!log.childElementCount) out('Vax Attack admin console — type help. ` or Esc closes.', 'dim'); }
    else input.blur();
  };
  A.keepFrozen = true;
  btn.onclick = () => A.toggle();
  $('consoleForm').onsubmit = e => { e.preventDefault(); const v = input.value; if (v.trim()) { hist.push(v); hi = hist.length; } input.value = ''; run(v); };
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape' || e.key === '`') { e.preventDefault(); A.toggle(false); }
    else if (e.key === 'ArrowUp' && hist.length) { e.preventDefault(); hi = Math.max(0, hi - 1); input.value = hist[hi]; }
    else if (e.key === 'ArrowDown' && hist.length) { e.preventDefault(); hi = Math.min(hist.length, hi + 1); input.value = hist[hi] || ''; }
    else if (e.key === 'Tab') {   // complete the command name
      e.preventDefault();
      const m = Object.keys(CMDS).filter(k => k.startsWith(input.value.toLowerCase()));
      if (m.length === 1) input.value = m[0] + ' '; else if (m.length) out(m.join('  '), 'dim');
    }
  });
  addEventListener('keydown', e => {
    if (e.key !== '`' || e.target.closest?.('input, textarea')) return;
    e.preventDefault(); A.toggle();
  }, true);
})();
