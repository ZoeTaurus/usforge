// Expansion 5 (behaviour): the new adaptations, synergies, the daily streak, lifetime stats and the new trophies.
(() => {
  const V = window.VAX;
  const TAU = Math.PI * 2;
  const up = s => s.toLocaleUpperCase(V.i18n.lang);
  const floater = (S, x, y, text, col) => S.floaters.push({ x, y, text, t: 0, col });

  // ---------- synergies ----------
  const has = (P, needs) => Object.entries(needs).every(([k, n]) => (P.upg[k] || 0) >= n);
  function checkSynergies(P, quiet) {
    P.syn ??= {};
    for (const s of V.SYNERGIES) {
      if (P.syn[s.id] || !has(P, s.needs)) continue;
      P.syn[s.id] = true;
      if (s.id === 'jackpot') P.dur *= 1.25;
      if (quiet) continue;
      V.ui.banner(up(V.t('syn.banner')), V.t('syn.sub', { name: V.t(`syn.${s.id}.name`), desc: V.t(`syn.${s.id}.desc`) }));
      V.SND.boss?.();
      const d = V.meta.data;
      if (V.meta.runActive() && !(d.syn ??= []).includes(s.id)) { d.syn.push(s.id); V.meta.event('synergy', { id: s.id }); }
    }
  }
  // which synergy (if any) picking this adaptation would complete — shown on the choice card
  const completes = (P, u) => V.SYNERGIES.find(s => !P.syn?.[s.id] && u.id in s.needs && has({ upg: { ...P.upg, [u.id]: (P.upg[u.id] || 0) + 1 } }, s.needs));

  V.MOD = {
    upgraded: (u, quiet) => checkSynergies(V.G.P, quiet),
    hint: u => { const s = completes(V.G.P, u); return s ? `<span class="syn-hint">★ ${V.t('syn.completes', { name: V.t(`syn.${s.id}.name`) })}</span>` : ''; },
    // extra damage from adaptations, for the player's own antibodies
    hitMul(e, b, P) {
      let m = 1;
      if (P.execute && e.hp < e.maxHp / 3) m *= P.execute;
      if (e.boss) m *= (P.bossMul || 1) * (P.syn?.hunter && b.homing ? 1.25 : 1);
      return m;
    },
    dodge(P) {
      if (!P.mucus || Math.random() >= P.mucus) return false;
      const S = V.G.S; P.inv = .5;
      floater(S, P.x, P.y - 10, V.t('fl.dodge'), '#c0f0a0'); V.SND.block();
      return true;
    },
    hit(S, P) {
      if (!P.thorns) return;
      const n = P.syn?.bulwark ? 32 : 16;
      for (let i = 0; i < n; i++) { const a = i * TAU / n; S.bullets.push({ x: P.x, y: P.y, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, life: 1, dmg: P.dmg * 1.5, pierce: true, hit: new Set() }); }
      if (P.syn?.bulwark) P.inv += .5;
    },
    kill(e, S, P) {
      if (P.leech) {
        const wounded = e.hp <= 0 && e.maxHp > 0 && P.syn?.bloodbath && e.execHit;
        P.leechN = (P.leechN || 0) + (wounded ? 2 : 1);
        const need = P.leech > 1 ? 30 : 45;
        if (P.leechN >= need) { P.leechN -= need; if (P.hp < P.max) { P.hp++; floater(S, P.x, P.y - 10, '+1', '#ff80a0'); V.SND.pick(); V.ui.hud(); } }
      }
      if (S.novaKill && P.syn?.blitz) P.dashT = 0;
    },
    shot(S, P, dmg) {
      if (!P.overdrive) return;
      P.odN = (P.odN || 0) + 1;
      if (P.odN < (P.overdrive > 1 ? 5 : 8)) return;
      P.odN = 0;
      const rail = P.syn?.railgun, sp = rail ? 360 : 200;
      S.bullets.push({ x: P.x, y: P.y, vx: Math.cos(P.aim) * sp, vy: Math.sin(P.aim) * sp, life: 1.3, dmg: dmg * (rail ? 8 : 5), pierce: true, big: true, crit: true, hit: new Set() });
      V.SND.bossShot?.();
    },
    tick(S, P, dt, X) {
      // Shockwave Dash fires as the dash ends
      if (P.dashNova && P.wasDashing && P.dashing <= 0) {
        const r = (18 + 8 * P.dashNova) * (P.syn?.blitz ? 1.5 : 1);
        S.novaKill = true;
        for (const e of S.enemies) if (e.hp > 0 && Math.hypot(e.x - P.x, e.y - P.y) < r + e.r) V.game.strikeAt(e, P.dmg * (2 + P.dashNova) * (e.boss ? (P.bossMul || 1) : 1));
        S.novaKill = false;
        for (const t of S.toxins) if (Math.hypot(t.x - P.x, t.y - P.y) < r) t.life = 0;
        (S.shock ??= []).push({ x: P.x, y: P.y, r, t: 0 });
        X.burst(P.x, P.y, 14, ['#7fe0d4', '#ffffff'], 80); X.shake(.12);
      }
      P.wasDashing = P.dashing > 0;
      if (S.shock) { for (const w of S.shock) w.t += dt; S.shock = S.shock.filter(w => w.t < .25); }
      // Complement Tag: remember that a pathogen was finished off while wounded (for Bloodbath)
      if (P.execute) for (const e of S.enemies) if (e.hp > 0 && e.hp < e.maxHp / 3) e.execHit = true;
    },
  };

  // shockwave rings, drawn with the other expansion extras
  const drawExtras = V.drawExtras;
  V.drawExtras = (ctx, S, P, h) => {
    drawExtras?.(ctx, S, P, h);
    for (const w of S.shock || []) { ctx.globalAlpha = 1 - w.t / .25; h.ring(w.x, w.y, w.r * (.4 + w.t / .25 * .6), 24, '#bff5ec', 0); ctx.globalAlpha = 1; }
  };

  // ---------- choice cards + pause screen show synergies ----------
  const render = V.ui.renderBreak;
  V.ui.renderBreak = () => {
    render();
    const b = V.G.S?.brk;
    if (!b) return;
    document.querySelectorAll('#choices .choice').forEach(btn => { const u = b.choices[+btn.dataset.i]; const h = u && V.MOD.hint(u); if (h) { btn.insertAdjacentHTML('beforeend', h); btn.classList.add('syn'); } });
  };
  const pause = V.ui.showPause;
  V.ui.showPause = () => {
    pause();
    const P = V.G.P, on = V.SYNERGIES.filter(s => P.syn?.[s.id]);
    if (on.length) document.getElementById('pauseBuild').insertAdjacentHTML('beforeend', `<br><span class="syn-hint">★ ${V.t('syn.active')} ${on.map(s => `<b>${V.t(`syn.${s.id}.name`)}</b>`).join(' · ')}</span>`);
  };

  // ---------- daily streak ----------
  const meta = V.meta, data = meta.data;
  const day = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  // a week of check-ins builds up to a big day-7 payout; after that every day pays 80
  meta.streakReward = n => n > 7 ? 80 : [20, 30, 40, 50, 60, 80, 150][n - 1];
  // called when the home screen shows: the first visit each day pays out
  meta.checkIn = () => {
    const today = day(), y = new Date(); y.setDate(y.getDate() - 1);
    const s = data.streak ??= { last: '', n: 0, best: 0 };
    if (s.last === today) return null;
    s.n = s.last === day(y) ? s.n + 1 : 1;
    s.last = today; s.best = Math.max(s.best, s.n);
    const dna = meta.streakReward(s.n);
    data.dna += dna; data.earned += dna; meta.save(); V.trophies.check();
    return { n: s.n, dna, next: meta.streakReward(s.n + 1) };
  };

  // ---------- lifetime stats ----------
  const endRun = meta.endRun;
  meta.endRun = S => {
    const out = endRun(S);
    if (out) {
      const L = data.life ??= { runs: 0, time: 0, combo: 0, dashes: 0, kt: {} };
      L.runs++; L.combo = Math.max(L.combo, S.bestCombo || 0);
      for (const [k, n] of Object.entries(S.kt || {})) L.kt[k] = (L.kt[k] || 0) + n;
      meta.save();
    }
    return out;
  };
  const ev = meta.event;
  meta.event = (type, p = {}) => {
    ev(type, p);
    if (type === 'kill' && meta.runActive() && p.type) { const S = V.G.S; (S.kt ??= {})[p.type] = (S.kt[p.type] || 0) + 1; }
  };
  meta.lifeStats = () => {
    const L = data.life || { runs: 0, combo: 0, kt: {} }, C = data.counters || {};
    const fav = Object.entries(L.kt || {}).sort((a, b) => b[1] - a[1])[0];
    return { runs: Math.max(L.runs, V.ui.load('history', []).length), kills: C.kills || 0, bosses: C.bosses || 0, combo: L.combo || '—', fav, syn: (data.syn || []).length, level: meta.lvl().L, streak: data.streak?.best || 0 };
  };

  // ---------- more trophies (progress read from the save) ----------
  for (const a of V.TROPHIES_MORE) V.TROPHIES.push({ id: a.id, dna: a.dna, prog: () => a.prog(data) });
})();
