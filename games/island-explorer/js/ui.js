'use strict';
// DOM HUD: bars, inventory, objective, minimap, clock, dialog, toasts, menus, map, screens.
const UI = {
  init() {
    const $ = id => document.getElementById(id);
    Object.assign(this, {
      hud: $('hud'), hp: $('hp'), food: $('food'), inv: $('inv'), objMain: $('objMain'), objSide: $('objSide'),
      mini: $('minimap'), clockEl: $('clock'), islandName: $('islandName'), toasts: $('toasts'), savedNote: $('savedNote'),
      dlg: $('dialog'), dname: $('dname'), dtext: $('dtext'),
      craftEl: $('craft'), recipesEl: $('recipes'), pauseEl: $('pause'),
      bigmap: $('bigmap'), bigc: $('bigmapc'), mapinfo: $('mapinfo'),
      fade: $('fade'), fadeText: $('fadeText'), title: $('title'), win: $('win'), winStats: $('winStats'),
    });
    this.bigc.width = World.W * 2; this.bigc.height = World.H * 2;
    this.bossBar = $('bossBar'); this.bossName = $('bossName'); this.bossFill = $('bossFill');
    this.roseCtx = document.getElementById('rose').getContext('2d');
    this.miniCtx = this.mini.getContext('2d');
    this.bigCtx = this.bigc.getContext('2d');

    this.mapCanvas = document.createElement('canvas');
    this.mapCanvas.width = World.W; this.mapCanvas.height = World.H;
    this.mapCtx = this.mapCanvas.getContext('2d');
    this.mapCtx.fillStyle = '#0b1422';
    this.mapCtx.fillRect(0, 0, World.W, World.H);

    this.icons = {};
    for (const k in Sprites.items) this.icons[k] = Sprites.items[k].toDataURL();

    $('againBtn').onclick = () => { Save.write(); location.reload(); };
    $('keepBtn').onclick = () => Game.keepExploring();
    $('settingsBtn').onclick = () => {
      this.closePause(); Game.state = 'settings';
      Menu.openSettings(() => { Game.state = 'pause'; this.openPause(); });
    };
    $('saveBtn').onclick = () => { Save.write(); };
    $('quitBtn').onclick = () => { Save.write(); location.reload(); };
    this.hpGhost = $('hpGhost');
    this.portrait = $('portrait'); this.portraitCtx = this.portrait.getContext('2d');

    this.cache = {}; this.lastCounts = {};
    this.lines = []; this.full = ''; this.shown = 0; this.miniT = 0;
  },

  paintTile(x, y) {
    const t = World.tiles[y * World.W + x];
    this.mapCtx.fillStyle = TILE[t].map;
    this.mapCtx.fillRect(x, y, 1, 1);
  },

  // ---------- dialog ----------
  // who's talking: a sprite to show beside the dialog
  portraitFor(name) {
    const g = Game;
    if (name === 'You') return g.player.sprites[0][0];
    const npc = g.npcs.find(n => n.name === name);
    if (npc) return npc.sprites[0][0];
    const part = Object.values(STORY.parts).find(pt => pt.name === name);
    if (part) return Sprites.items[part.icon];
    const I = Sprites.items, O = Sprites.over;
    return {
      'Biscuit': Sprites.mobs.cat.r[0], 'Sign': O[T.SIGN][0][0], 'Chest': O[T.CHEST][0][0], 'Shipwreck': O[T.WRECK][0][0],
      'Remains': O[T.SKELETON][0][0], 'Golden Idol': I.relic, 'Treasure!': I.gold, 'A message in a bottle!': I.bottle,
      'Door': I.wgate, 'Fountain': O[T.FOUNTAIN][0][0], 'Victory!': I.blade,
    }[name] || null;
  },
  say(name, lines, cb) {
    this.dname.textContent = name;
    const img = this.portraitFor(name);
    this.dlg.classList.toggle('noportrait', !img);
    this.portrait.classList.toggle('none', !img);
    if (img) {
      const g = this.portraitCtx;
      g.clearRect(0, 0, 16, 16); g.imageSmoothingEnabled = false;
      g.drawImage(img, 0, 0, img.width, img.height, 0, 0, 16, 16);
    }
    this.lines = lines.slice();
    this.cb = cb || null;
    this.dlg.classList.remove('hidden');
    Game.state = 'dialog';
    this.nextLine();
  },
  nextLine() {
    if (!this.lines.length) {
      this.dlg.classList.add('hidden');
      Game.state = 'play';
      const cb = this.cb; this.cb = null;
      if (cb) cb();
      return;
    }
    this.full = this.lines.shift();
    this.shown = 0;
    this.dtext.textContent = '';
  },
  advance() {
    if (this.shown < this.full.length) { this.shown = this.full.length; this.dtext.textContent = this.full; }
    else { Sound.click(); this.nextLine(); }
  },
  update(dt) {
    if (Game.state === 'dialog' && this.shown < this.full.length) {
      const before = Math.floor(this.shown);
      this.shown = Math.min(this.full.length, this.shown + dt * 60);
      if (Math.floor(this.shown) !== before) {
        this.dtext.textContent = this.full.slice(0, Math.floor(this.shown));
        if (Math.floor(this.shown) % 3 === 0) Sound.blip();
      }
    }
    this.miniT -= dt;
    if (this.miniT <= 0 && Game.state !== 'title') { this.miniT = 0.1; this.drawMini(); }
  },

  toast(text) {
    const d = document.createElement('div');
    d.className = 'toast panel';
    d.textContent = text;
    this.toasts.appendChild(d);
    while (this.toasts.children.length > 3) this.toasts.firstChild.remove();
    setTimeout(() => d.remove(), 3200);
  },
  saved() {
    const el = this.savedNote;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  },

  banner(title, sub) {
    const el = this.islandName;
    el.textContent = title;
    if (sub) { const s = document.createElement('small'); s.textContent = sub; el.append(s); }
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  },

  setFade(on, text = '') {
    this.fadeText.textContent = text;
    this.fade.classList.toggle('on', on);
  },

  // ---------- HUD ----------
  hudUpdate() {
    const g = Game, p = g.player, c = this.cache;
    const hp = Math.max(0, Math.round(p.hp / p.maxHp * 100)), food = Math.max(0, Math.round(p.food));
    if (c.hp !== hp) { c.hp = hp; this.hp.style.width = hp + '%'; this.hpGhost.style.width = hp + '%'; this.hp.classList.toggle('low', hp < 30); }
    if (c.food !== food) { c.food = food; this.food.style.width = food + '%'; this.food.classList.toggle('low', food < 20); }

    const I = g.inv, F = g.flags;
    const slots = [['wood', I.wood], ['vine', I.vine]];
    for (const k of ['wwall', 'swall', 'wgate', 'fire', 'rope', 'stone', 'iron', 'hide', 'gold', 'fish', 'meat', 'cooked', 'bandage', 'key', 'sailcloth']) if (I[k]) slots.push([k, I[k]]);
    if (F.sailboat) slots.push(['sailboat', '']); else if (F.raft) slots.push(['raft', '']);
    if (F.axe) slots.push([F.axe === 2 ? 'iaxe' : 'axe', '']);
    if (F.pick) slots.push([F.pick === 2 ? 'ipick' : 'pick', '']);
    if (F.weapon) slots.push([['', 'spear', 'sword', 'blade'][F.weapon], '']);
    if (F.armor) slots.push([F.armor === 2 ? 'cloak' : 'armor', '']);
    if (F.boots) slots.push(['boots', '']);
    for (const k of ['rod', 'shovel', 'torch', 'spyglass', 'compass']) if (F[k]) slots.push([k, '']);
    if (g.stats.relics) slots.push(['relic', g.stats.relics + '/6']);
    slots.push(['shell', g.stats.shells + '/' + World.totalShells]);
    const invKey = JSON.stringify(slots);
    if (c.inv !== invKey) {
      c.inv = invKey;
      this.inv.innerHTML = slots.map(([k, n]) => {
        const pop = typeof n === 'number' && this.lastCounts[k] !== undefined && n > this.lastCounts[k] ? ' pop' : '';
        return `<div class="slot${pop}" title="${k}"><img src="${this.icons[k]}" alt="${k}"><b>${n}</b></div>`;
      }).join('');
      for (const [k, n] of slots) this.lastCounts[k] = n;
    }
    const obj = g.objectiveText();
    if (c.obj !== obj) {
      const first = c.obj === undefined;
      c.obj = obj; this.objMain.textContent = obj;
      if (!first) { this.objMain.classList.remove('flash'); void this.objMain.offsetWidth; this.objMain.classList.add('flash'); }
    }
    const side = g.sideText();
    if (c.side !== side) { c.side = side; this.objSide.textContent = side; }
    if (g.activeBoss) {
      const b = g.activeBoss, pct = Math.max(0, Math.round(b.hp / b.maxHp * 100));
      if (c.boss !== pct) { c.boss = pct; this.bossFill.style.width = pct + '%'; this.bossBar.classList.toggle('enraged', b.phase2); }
    }
    const p2 = g.player, moving = Math.hypot(p2.vx, p2.vy) > 10;
    const heading = moving ? Math.atan2(p2.vy, p2.vx) : Math.atan2(DIRV[p2.dir][1], DIRV[p2.dir][0]);
    const hk = Math.round(heading * 16);
    if (c.rose !== hk) { c.rose = hk; this.drawRose(heading); }
    const clock = [`Day ${FX.day}`, FX.clock(), FX.isNight() ? 'Night' : '', FX.rain > 0.3 ? 'Rain' : ''].filter(Boolean).join(' · ');
    if (c.clock !== clock) { c.clock = clock; this.clockEl.textContent = clock; }
  },

  // Compass rose: north is always up on these islands; the gold needle shows your heading.
  drawRose(heading) {
    const g = this.roseCtx, S = 76, c = S / 2;
    g.clearRect(0, 0, S, S);
    g.imageSmoothingEnabled = false;
    // ring
    g.fillStyle = '#1a2238'; g.beginPath(); g.arc(c, c, 36, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#6b4a26'; g.lineWidth = 2; g.beginPath(); g.arc(c, c, 34, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = '#3d4b6e'; g.lineWidth = 1; g.beginPath(); g.arc(c, c, 24, 0, Math.PI * 2); g.stroke();
    // 8-point star
    const point = (a, len, w, col) => {
      g.fillStyle = col; g.beginPath();
      g.moveTo(c + Math.cos(a) * len, c + Math.sin(a) * len);
      g.lineTo(c + Math.cos(a + Math.PI / 2) * w, c + Math.sin(a + Math.PI / 2) * w);
      g.lineTo(c, c);
      g.lineTo(c + Math.cos(a - Math.PI / 2) * w, c + Math.sin(a - Math.PI / 2) * w);
      g.closePath(); g.fill();
    };
    for (let i = 0; i < 4; i++) point(-Math.PI / 4 + i * Math.PI / 2, 17, 3, '#7a8aa8');
    for (let i = 0; i < 4; i++) point(-Math.PI / 2 + i * Math.PI / 2, 25, 4, i === 0 ? '#d94f3d' : '#d8d0c0');
    // heading needle
    if (heading !== null) {
      g.strokeStyle = '#ffd84a'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.cos(heading) * 21, c + Math.sin(heading) * 21); g.stroke();
      g.fillStyle = '#ffd84a'; g.fillRect(Math.round(c + Math.cos(heading) * 21) - 2, Math.round(c + Math.sin(heading) * 21) - 2, 4, 4);
    }
    g.fillStyle = '#ffd84a'; g.fillRect(c - 2, c - 2, 4, 4);
    // letters
    g.font = '8px "Press Start 2P", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const lab = [['N', 0, -30, '#ff7a6a'], ['E', 30, 0, '#f4ecd8'], ['S', 0, 30, '#f4ecd8'], ['W', -30, 0, '#f4ecd8']];
    for (const [t, x, y, col] of lab) { g.fillStyle = '#000'; g.fillText(t, c + x + 1, c + y + 1); g.fillStyle = col; g.fillText(t, c + x, c + y); }
    g.font = '5px "Press Start 2P", monospace';
    for (const [t, x, y] of [['NE', 22, -22], ['SE', 22, 22], ['SW', -22, 22], ['NW', -22, -22]]) { g.fillStyle = '#9fb0d0'; g.fillText(t, c + x, c + y); }
  },

  drawMini() {
    const p = Game.player, g = this.miniCtx;
    const vw = 72, vh = 48;
    const tx = p.x / 16, ty = (p.y + 4) / 16;
    const sx = Math.max(0, Math.min(World.W - vw, Math.floor(tx - vw / 2)));
    const sy = Math.max(0, Math.min(World.H - vh, Math.floor(ty - vh / 2)));
    g.imageSmoothingEnabled = false;
    g.drawImage(this.mapCanvas, sx, sy, vw, vh, 0, 0, vw * 2, vh * 2);
    if (Game.cat && Game.cat.state !== 'lost') {
      g.fillStyle = '#ffa040';
      g.fillRect(Math.floor((Game.cat.x / 16 - sx) * 2) - 1, Math.floor(((Game.cat.y + 4) / 16 - sy) * 2) - 1, 3, 3);
    }
    g.fillStyle = Math.floor(Game.time * 4) % 2 ? '#ffffff' : '#ff3b3b';
    g.fillRect(Math.floor((tx - sx) * 2) - 2, Math.floor((ty - sy) * 2) - 2, 4, 4);
  },

  showBoss(b) { this.bossName.textContent = b.def.name; this.cache.boss = -1; this.bossBar.classList.remove('hidden'); },
  hideBoss() { this.bossBar.classList.add('hidden'); },

  // ---------- menus ----------
  openCraft() {
    this.renderRecipes();
    this.craftEl.classList.remove('hidden');
  },
  renderRecipes() {
    const I = Game.inv;
    this.recipesEl.innerHTML = '';
    Game.recipes().forEach((r, i) => {
      const done = r.once && r.have();
      const can = !done && Object.entries(r.cost).every(([k, n]) => (I[k] || 0) >= n);
      const row = document.createElement('div');
      row.className = 'recipe' + (done ? ' done' : can ? '' : ' no') + (i === Game.craftSel ? ' sel' : '');
      const cost = Object.entries(r.cost).map(([k, n]) => `<div class="${(I[k] || 0) >= n ? '' : 'miss'}">${k} ${I[k] || 0}/${n}</div>`).join('');
      row.innerHTML = `<span class="k">${i < 9 ? i + 1 : ''}</span><img src="${this.icons[r.icon]}" alt=""><div>${r.name}${done ? ' ✓' : ''}<div class="d">${r.desc}</div></div><div class="cost">${done ? '' : cost}</div>`;
      row.onclick = () => Game.craft(i);
      this.recipesEl.appendChild(row);
      if (i === Game.craftSel) row.scrollIntoView({ block: 'nearest' });
    });
  },
  closeCraft() { this.craftEl.classList.add('hidden'); },

  // ---------- journal ----------
  openJournal() {
    const g = Game, F = g.flags, P = g.parts(), st = g.stats;
    const isl = id => F.visited[id] ? STORY.islands[id][0] : 'an island you haven\'t found';
    let html = `<div class="jgoal"><span>Current goal</span>${g.objectiveText().replace(' · [J] journal', '')}</div>`;
    if (!F.metHermit && !F.sailboat) {
      html += `<p class="jnote">${!F.raft ? 'I\'m stranded. There\'s wood, vines and stone around... maybe I can put something together. (C to craft)' : 'The raft floats! Land lies to the northeast. Maybe someone out there can help.'}</p>`;
    } else {
      html += '<div class="jhead">Ship parts for Tobias</div>';
      for (const [k, pt] of Object.entries(STORY.parts)) {
        const s = F.sailboat ? 'given' : P[k];
        const mark = s === 'given' ? '<b class="ok">✓ delivered</b>' : s === 'have' ? '<b class="got">● in your pack</b>' : '<b class="no">○ missing</b>';
        html += `<div class="jpart${s ? ' done' : ''}"><img src="${this.icons[pt.icon]}" alt=""><div><div class="jn">${pt.name} · <i>${isl(pt.island)}</i></div>${s ? '' : `<div class="jh">${pt.hint}</div>`}</div>${mark}</div>`;
      }
    }
    const visited = Object.keys(F.visited).length;
    html += `<div class="jhead">Explorer's notes</div><div class="jstats">
      <span>Islands visited <b>${visited}/9</b></span><span>Golden idols <b>${st.relics}/6</b></span>
      <span>Bosses defeated <b>${st.bosses || 0}/3</b></span><span>Bottles <b>${st.bottles}/${World.bottles.length}</b></span>
      <span>Biscuit the cat <b>${F.catHome ? 'home ♥' : F.catFound ? 'following you' : F.catKnown ? 'lost' : '?'}</b></span></div>`;
    document.getElementById('journalBody').innerHTML = html;
    document.getElementById('journal').classList.remove('hidden');
  },
  closeJournal() { document.getElementById('journal').classList.add('hidden'); },

  openPause() { this.pauseEl.classList.remove('hidden'); },
  closePause() { this.pauseEl.classList.add('hidden'); },

  openMap() {
    this.bigmap.classList.remove('hidden');
    const g = this.bigCtx, s = 2;
    g.imageSmoothingEnabled = false;
    g.drawImage(this.mapCanvas, 0, 0, World.W * s, World.H * s);
    const colors = { boss: '#ff2a2a', fire: '#ff8a2a', wreck: '#c49a62', ruins: '#b0b8a0', hut: '#e0c070', bridge: '#c49a62', town: '#ffd84a' };
    for (const poi of World.pois) {
      if (!World.explored[World.idx(poi.x, poi.y)]) continue;
      g.fillStyle = '#000'; g.fillRect(poi.x * s - 3, poi.y * s - 3, 7, 7);
      g.fillStyle = colors[poi.kind] || '#fff'; g.fillRect(poi.x * s - 2, poi.y * s - 2, 5, 5);
    }
    const p = Game.player;
    const px = p.x / 16 * s, py = (p.y + 4) / 16 * s;
    g.fillStyle = '#fff'; g.fillRect(px - 4, py - 4, 9, 9);
    g.fillStyle = '#ff3b3b'; g.fillRect(px - 3, py - 3, 7, 7);
    const pct = Math.round(World.landExplored / World.landTotal * 100);
    const st = Game.stats;
    this.mapinfo.innerHTML = `Land explored: ${pct}% · Islands: ${Object.keys(Game.flags.visited).length}/9 · Idols: ${st.relics}/6 · Bottles: ${st.bottles}/${World.bottles.length} · Shells: ${st.shells}/${World.totalShells}<br>Day ${FX.day} · Time played ${Game.fmtTime()}`;
  },
  closeMap() { this.bigmap.classList.add('hidden'); },

  showWin(newBest) {
    const g = Game, st = g.stats;
    document.getElementById('newBest').classList.toggle('hidden', !newBest);
    this.animateShip();
    const pct = Math.round(World.landExplored / World.landTotal * 100);
    this.winStats.innerHTML = `
      Time: <b>${g.fmtTime()}</b> over <b>${FX.day}</b> day${FX.day > 1 ? 's' : ''}<br>
      Land explored: <b>${pct}%</b><br>
      Islands visited: <b>${Object.keys(g.flags.visited).length}/9</b> · Golden idols: <b>${st.relics}/6</b><br>
      Bottles: <b>${st.bottles}/${World.bottles.length}</b> · Shells: <b>${st.shells}/${World.totalShells}</b> · Crates: <b>${st.crates}</b> · Gold found: <b>${st.gold}</b><br>
      Biscuit the cat: <b>${g.flags.catHome ? 'home safe ♥' : 'still lost...'}</b><br>
      Trees chopped: <b>${st.chopped}</b> · Fish caught: <b>${st.fish}</b> · Creatures defeated: <b>${st.kills}</b><br>
      Bosses defeated: <b>${st.bosses || 0}/3</b> · Times collapsed: <b>${st.deaths}</b><br>
      Difficulty: <b>${g.diff.name}</b>`;
    // count the numbers up
    const bs = [...this.winStats.querySelectorAll('b')];
    bs.forEach((b, i) => {
      const txt = b.textContent, m = txt.match(/^(\d+)(.*)$/);
      if (!m) return;
      const target = +m[1], rest = m[2];
      b.textContent = '0' + rest;
      const t0 = performance.now() + i * 90;
      const tick = now => {
        const k = Math.min(1, Math.max(0, (now - t0) / 700));
        b.textContent = Math.round(target * k) + rest;
        if (k < 1) requestAnimationFrame(tick); else if (target) Sound.blip();
      };
      requestAnimationFrame(tick);
    });
    this.hud.classList.add('hidden');
    this.win.classList.remove('hidden');
  },
  // a little ship sailing home across the win screen
  animateShip() {
    const cv = document.getElementById('winShip'), g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    const t0 = performance.now();
    const frame = now => {
      if (this.win.classList.contains('hidden')) return;
      const t = (now - t0) / 1000;
      g.clearRect(0, 0, 160, 60);
      g.fillStyle = '#1f4f8c'; g.fillRect(0, 40, 160, 20);
      g.fillStyle = '#3a8bc9';
      for (let x = 0; x < 160; x += 8) g.fillRect((x + t * 12) % 168 - 8, 40 + Math.round(Math.sin(x * 0.4 + t * 2)), 5, 1);
      g.fillStyle = '#ffd84a'; g.beginPath(); g.arc(130, 22, 9, 0, Math.PI * 2); g.fill();
      const sx = ((t * 14) % 200) - 30, sy = 20 + Math.round(Math.sin(t * 2.2) * 1.5);
      g.drawImage(Sprites.boats.sailboat, Math.round(sx), sy);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  },
};
