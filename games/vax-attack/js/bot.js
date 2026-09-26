// Bot mode: an AI that plays the game through the normal input system, and coaches the viewer as it goes.
(() => {
  const V = window.VAX;
  const { W, H, TOP, BOT, clamp } = V;
  const $ = id => document.getElementById(id);
  const G = V.G;
  const bot = V.bot = { speed: 1 };

  // ---------- names, tips and reasons (all translated; English text lives in i18n.js) ----------
  const { t, tx } = V;
  const OTHER = { mini: 'name.mini', spore: 'name.spore', decoy: 'name.decoy' };
  const nameOf = k => OTHER[k] ? t(OTHER[k]) : tx.enemy(k);
  // the order the bot ranks adaptations in (best first); the reason for each is 'pickR.<id>'
  const PICKS = ['permNeutro', 'permMacro', 'multi', 'rate', 'dmg', 'hp', 'memory', 'regen', 'permHoming', 'speed', 'dur', 'magnet'];
  const RANK = Object.fromEntries(PICKS.map((id, i) => [id, i]));
  const reasonOf = u => PICKS.includes(u.id) ? t('pickR.' + u.id) : tx.upgDesc(u.id);

  // ---------- coach panel ----------
  let seen = new Set(), tipsShown = new Set(), intent = '', intentT = 0, pickT = 0, pickIdx = -1;
  function tip(text, icon) {
    const li = document.createElement('li');
    li.innerHTML = (icon ? `<img alt="" src="${V.urlOf(icon)}">` : '<span class="dot"></span>') + `<span></span>`;
    li.lastChild.textContent = text;
    $('coachTips').prepend(li);
    while ($('coachTips').children.length > 5) $('coachTips').lastChild.remove();
  }
  function once(key, text, icon) { if (tipsShown.has(key)) return; tipsShown.add(key); tip(text, icon); }
  function say(text) { if (text !== intent) { intent = text; $('coachIntent').textContent = text; } }

  bot.onStart = on => {
    $('coach').hidden = !on;
    seen = new Set(); tipsShown = new Set(); pickT = 0; pickIdx = -1;
    $('coachTips').innerHTML = '';
    say(on ? t('bot.warm') : '');
    paintSpeed();
    V.input.botMove = null; brk = { step: 'pick', t: 0, buys: 0 };
  };
  bot.takeOver = () => {
    if (!G.bot) return;
    G.bot = false; V.input.release(); V.input.botMove = null;
    $('coach').hidden = true;
    V.ui.toast(t('toast.takeover').toLocaleUpperCase(V.i18n.lang), '#7fe0d4');
  };
  function paintSpeed() { $('botSpeed').textContent = t('coach.speed', { n: bot.speed }); }
  V.i18n.onChange(paintSpeed);
  $('botSpeed').onclick = () => { bot.speed = bot.speed >= 4 ? 1 : bot.speed * 2; paintSpeed(); };
  $('botTakeover').onclick = () => bot.takeOver();
  $('botStop').onclick = () => V.game.toTitle();

  // ---------- the between-wave break: pick, shop, continue ----------
  // what the bot likes to buy, in order, with the reason it gives you
  const STOCK_PREF = ['neutro', 'macro', 'nk', 'clone', 'il2', 'mega', 'complement', 'halo', 'fever', 'rapid', 'spread', 'bounce', 'homing', 'vitc', 'pierce', 'antitox', 'freeze', 'speed'];
  function shopPlan() {
    const { S, P } = G, items = V.shop.items().filter(i => i.ok);
    const has = id => items.find(i => i.id === id);
    if (has('heal') && (P.hp <= 2 || P.hp <= P.max - 2)) return [has('heal'), t('bs.heal')];
    if (has('shield') && P.shield === 0) return [has('shield'), t('bs.shield')];
    if (has('maxhp') && S.atp >= has('maxhp').price + 20) return [has('maxhp'), t('bs.maxhp')];
    if (has('extra') && S.atp >= has('extra').price + 30) return [has('extra'), t('bs.extra')];
    for (const k of STOCK_PREF) { const it = has('stock:' + k); if (it) return [it, t('bs.stock', { name: tx.pow(k) })]; }
    return null;
  }
  let brk = { step: 'pick', t: 0, buys: 0 };
  function handleBreak(dt) {
    const b = G.S.brk;
    if (!b) return;
    brk.t -= dt;
    if (brk.t > 0) return;
    if (!b.picked && b.choices.length) {
      if (brk.step !== 'picking') {
        // choose, highlight, and click it after a beat so the viewer can read the options
        const P = G.P, score = u => (u.id === 'hp' && P.hp <= 2 ? -1 : RANK[u.id] ?? 99);
        let best = 0; b.choices.forEach((u, i) => { if (score(u) < score(b.choices[best])) best = i; });
        pickIdx = best; brk.step = 'picking'; brk.t = 1.3;
        $('choices').children[best]?.classList.add('bot-pick');
        const u = b.choices[best];
        tip(t('bot.picked', { name: tx.upg(u.id), why: u.id === 'hp' && P.hp <= 2 ? t('bot.lowPick') : reasonOf(u) }), null);
        say(t('bot.choosing'));
        return;
      }
      V.ui.pickUpgrade(pickIdx);           // ui ignores it until the menu's click-guard has passed
      if (b.picked) { brk.step = 'shop'; brk.t = .7; }
      return;
    }
    // shop: up to 3 purchases, each highlighted before buying
    const plan = brk.buys < 3 && shopPlan();
    if (plan) {
      const [item, why] = plan;
      if (brk.step !== 'buying:' + item.id) {
        brk.step = 'buying:' + item.id; brk.t = .8;
        $('shopItems').querySelector(`[data-id="${item.id}"]`)?.classList.add('bot-pick');
        say(t('bot.shopping', { name: item.name, n: item.price }));
        return;
      }
      if (V.shop.buy(item.id)) { tip(why, item.icon); brk.buys++; }
      brk.step = 'shop'; brk.t = .5;
      if (!b.picked) brk.step = 'pick';     // Double Dose re-opens the choices
      return;
    }
    if (brk.step !== 'leaving') { brk.step = 'leaving'; brk.t = .6; say(G.S.atp ? t('bot.saving', { n: G.S.atp }) : t('bot.back')); return; }
    V.ui.continueWave();
  }

  // ---------- the brain ----------
  let vicT = 0;
  const CHARGERS = new Set(['salmo', 'plague', 'rabies', 'ebola', 'drone', 'zero', 'bphage', 'westnile']);
  bot.think = dt => {
    if (!G.bot) return;
    if (G.mode === 'upgrade') { handleBreak(dt); return; }
    if (G.mode === 'victory') { vicT += dt; if (vicT > 4) { vicT = 0; V.game.keepGoing(); } return; }
    pickIdx = -1; brk = { step: 'pick', t: 0, buys: 0 };
    if (G.mode !== 'play') return;
    const S = G.S, P = G.P, I = V.input;
    let fx = 0, fy = 0, near = 0, why = null;

    // meet new pathogens → teach
    for (const e of S.enemies) {
      if (e.x < 0 || e.x > W || seen.has(e.type)) continue;
      seen.add(e.type);
      const key = e.type === 'decoy' ? 'phantom' : e.type;
      if (V.L.en['tipE.' + key]) once(key, t('tipE.' + key), key === 'strep' ? 'strepHead' : key);
    }

    // 1) run from pathogens (predicting where they'll be), harder from bosses and chargers
    for (const e of S.enemies) {
      if (e.hp <= 0 || e.x < -12 || e.x > W + 12 || e.state === 'hidden') continue;
      const pts = [[e.x, e.y, e.r]];
      if (e.segPts) for (const p of e.segPts) pts.push([p[0], p[1], 3.5]);
      const rushing = ['dash', 'lunge', 'leap', 'dart', 'swoop'].includes(e.state);
      for (const [x, y, r] of pts) {
        const px = x + (e.vx || 0) * .3, py = y + (e.vy || 0) * .3;
        const dx = P.x - px, dy = P.y - py, d = Math.hypot(dx, dy) || 1;
        const reach = (r + 22 + (e.boss ? 20 : 0) + (rushing ? 30 : 0)) * 1.8;
        if (d < reach) { const w = ((reach - d) / reach) ** 2 * (e.boss ? 3 : 2); fx += dx / d * w; fy += dy / d * w; near++; }
      }
      // a Tetanus laser is on us → step off the line before it locks
      if ((e.type === 'tetanus' || e.type === 'carrier') && e.state === 'aim') {
        const cx = Math.cos(e.la), cy = Math.sin(e.la), rx = P.x - e.x, ry = P.y - e.y, side = rx * cy - ry * cx >= 0 ? 1 : -1;
        let sx = cy * side, sy = -cx * side;
        if (P.y + sy * 24 < TOP + 16 || P.y + sy * 24 > BOT - 16) { sx = -sx; sy = -sy; }
        fx += sx * 4; fy += sy * 4;
        why = t('bot.sidestep', { name: nameOf(e.type) });
      }
      // about to charge → sidestep perpendicular to its line, toward open space
      if (e.state === 'tele' && CHARGERS.has(e.type)) {
        const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1;
        let sx = -dy / d, sy = dx / d;
        if (P.y + sy * 24 < TOP + 16 || P.y + sy * 24 > BOT - 16) { sx = -sx; sy = -sy; }
        fx += sx * 3.5; fy += sy * 3.5;
        why = t('bot.sidestep', { name: nameOf(e.type) });
        if (d < 70 && e.st < .35) { I.dash = true; why = t('bot.dashCharge', { name: nameOf(e.type) }); once('dash', t('bt.dash'), 'speed'); }
      }
      // teleport landing spot → keep clear
      if (e.state === 'tele' && e.tx !== undefined && (e.type === 'noro' || e.type === 'phantom' || e.type === 'shifter' || e.type === 'zero')) {
        const dx = P.x - e.tx, dy = P.y - e.ty, d = Math.hypot(dx, dy) || 1;
        if (d < 45) { fx += dx / d * 2.5; fy += dy / d * 2.5; why = why || t('bot.ring'); }
      }
    }

    // mines: stay out of the blast once the fuse is short
    for (const m of S.mines) {
      const dx = P.x - m.x, dy = P.y - m.y, d = Math.hypot(dx, dy) || 1;
      if (d < 34) { const w = ((34 - d) / 34) ** 2 * (m.fuse - m.t < .8 ? 4 : 1.5); fx += dx / d * w; fy += dy / d * w; }
    }
    // Giardia latched on → dash it off
    if (S.enemies.some(e => e.latched)) { I.dash = true; why = t('bot.giardia'); }

    // 2) dodge toxin, both where it is and where it's heading
    let toxNear = 0;
    for (const t of S.toxins) {
      for (const [x, y] of [[t.x, t.y], [t.x + t.vx * .35, t.y + t.vy * .35]]) {
        const dx = P.x - x, dy = P.y - y, d = Math.hypot(dx, dy) || 1;
        const reach = 24 + (t.r || 0) * 2;
        if (d < reach) { const w = ((reach - d) / reach) ** 2 * 3.2; fx += dx / d * w; fy += dy / d * w; toxNear++; }
      }
    }

    // 3) stay off the walls, drift back toward the left-centre "home" spot
    const wall = (v, lo, hi) => (v < lo + 22 ? (lo + 22 - v) / 22 * 2 : 0) - (v > hi - 22 ? (v - (hi - 22)) / 22 * 2 : 0);
    fx += wall(P.x, 6, W - 6); fy += wall(P.y, TOP + 8, BOT - 8);
    fx += (70 - P.x) * .008; fy += (H / 2 - P.y) * .006;

    // 4) go get power-ups when it's reasonably safe
    let goal = null, goalScore = 0;
    for (const k of S.pickups) {
      const d = Math.hypot(k.x - P.x, k.y - P.y);
      const value = k.kind === 'heal' ? (P.hp < P.max ? 3 + (P.max - P.hp) : .2) : 1.6;
      const sc = value / (d + 20);
      if (sc > goalScore) { goalScore = sc; goal = k; }
    }
    if (goal && (near < 3 || goal.kind === 'heal' && P.hp <= 2)) {
      const dx = goal.x - P.x, dy = goal.y - P.y, d = Math.hypot(dx, dy) || 1;
      fx += dx / d * 1.5; fy += dy / d * 1.5;
      if (!why) why = t('bot.grab', { name: tx.pow(goal.kind) });
      once('pickups', t('bt.pickups'), goal.kind);
    }

    if (toxNear >= 6 && P.dashT <= 0) { I.dash = true; why = why || t('bot.toxinWall'); }
    // Anthrax: step off any marked line before it fills with toxin
    for (const e of S.enemies) if (e.type === 'anthrax') for (const L of e.lines) {
      if (L.fired) continue;
      const off = L.horiz ? P.y - L.pos : P.x - L.pos;
      if (Math.abs(off) < 12) { const s = off >= 0 ? 1 : -1; if (L.horiz) fy += s * 4; else fx += s * 4; why = t('bot.lines'); }
    }
    // Naegleria: step off its pseudopod lines, and keep clear of its body
    for (const e of S.enemies) if (e.type === 'amoeba') {
      for (const p of e.pods) {
        if (p.fired) continue;
        const cx = Math.cos(p.a), cy = Math.sin(p.a), rx = P.x - e.x, ry = P.y - e.y, along = rx * cx + ry * cy, side = rx * cy - ry * cx;
        if (along > 0 && along < 95 && Math.abs(side) < 12) { const s = side >= 0 ? 1 : -1; fx += cy * s * 4; fy += -cx * s * 4; why = t('bot.lines'); }
      }
    }
    // later expansions teach the bot their own tricks (expansion7-ai.js)
    const ext = V.botExtra?.(S, P);
    if (ext) { fx += ext.fx; fy += ext.fy; if (ext.dash && P.dashT <= 0) I.dash = true; if (ext.why) why = why || ext.why; }
    // the Superbug's shield only breaks if you dash through it
    const bug = S.enemies.find(e => e.type === 'superbug' && e.shieldUp && e.x < W - 10 && e.state === 'move');
    if (bug && P.dashT <= 0) {
      const dx = bug.x - P.x, dy = bug.y - P.y, d = Math.hypot(dx, dy) || 1;
      fx = dx / d * 3; fy = dy / d * 3; why = t('bot.dashShield');
      if (d < 34) I.dash = true;
    }
    if (S.orbs.length) once('atp', t('bt.atp'), 'atp');
    // swallowed by the amoeba: dash out; scrambled by Toxoplasma: steer the other way so it cancels out
    if (P.engulfedBy) { I.dash = true; why = t('bot.engulfed'); }
    if (P.confT > 0) { fx = -fx; fy = -fy; }
    const l = Math.hypot(fx, fy);
    I.botMove = l < .15 ? { x: 0, y: 0 } : { x: fx / Math.max(1, l), y: fy / Math.max(1, l) };

    // 5) aim: prefer close threats and bosses, lead moving targets, skip cloaked HIV
    let tgt = null, tScore = -1e9;
    for (const e of S.enemies) {
      if (e.hp <= 0 || e.x < 2 || e.x > W - 2 || V.game.cloaked(e)) continue;
      const d = Math.hypot(e.x - P.x, e.y - P.y);
      // same threat sense the allies use: wind-ups, shooters, elites and anything right on top of you come first
      let sc = 120 - d + V.game.threat(e) * .9 + (e.boss ? 25 : 0) + ({ candida: 15, noro: 8 }[e.type] || 0);
      if (e.type === 'klebs' && Math.abs(((Math.atan2(P.y - e.y, P.x - e.x) - e.faceA + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 1.2) sc -= 40;   // its capsule faces us
      if (e.state === 'hidden') sc -= 60; // disguised Plasmodium: shoot when nothing else is pressing
      if (sc > tScore) { tScore = sc; tgt = e; }
    }
    I.touchMode = false; I.mouse.seen = true;
    if (tgt) {
      const t = Math.hypot(tgt.x - P.x, tgt.y - P.y) / 180;
      I.mouse.x = tgt.x + (tgt.vx || 0) * t; I.mouse.y = tgt.y + (tgt.vy || 0) * t; I.mouse.down = true;
    } else I.mouse.down = false;

    // 6) narrate
    if (S.combo >= 5) once('combo', t('bt.combo'), 'spread');
    if (P.hp <= 1) once('lowhp', t('bt.lowhp'), 'heal');
    const boss = S.enemies.find(e => e.boss);
    intentT -= dt;
    if (intentT <= 0 || why) {
      intentT = .6;
      say(why
        || (toxNear > 2 ? t('bot.weave') : null)
        || (P.hp <= 1 ? t('bot.lowhp') : null)
        || (boss ? t('bot.fight', { name: nameOf(boss.type) }) : null)
        || (near && tgt ? t('bot.kite', { name: nameOf(tgt.type) }) : null)
        || (tgt ? t('bot.pick', { name: nameOf(tgt.type) }) : null)
        || t(S.phase === 'fight' ? 'bot.wait' : 'bot.cleared'));
    }
  };
})();
