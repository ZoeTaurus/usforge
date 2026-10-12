'use strict';
// ============================================================
//  CRAZY DENTIST — title screen, options, how to play,
//  day summary, upgrade shop, victory, game over, pause
// ============================================================

function startDay() { Clinic.startDay(); goto(Clinic, 0.35); }

function sunburst(t, c1, c2, cx = 160, cy = 64) {
  rect(0, 0, W, H, c1);
  const n = 16;
  for (let i = 0; i < n; i += 2) {
    const a0 = t * 0.12 + i * Math.PI * 2 / n, a1 = a0 + Math.PI * 2 / n;
    tri(cx, cy, cx + Math.cos(a0) * 420, cy + Math.sin(a0) * 420, cx + Math.cos(a1) * 420, cy + Math.sin(a1) * 420, c2);
  }
}
function twinkle(x, y, k, c = P.white) {
  const s = k > 0.66 ? 2 : k > 0.33 ? 1 : 0;
  px(x, y, c);
  if (s >= 1) { px(x - 1, y, c); px(x + 1, y, c); px(x, y - 1, c); px(x, y + 1, c); }
  if (s >= 2) { px(x - 2, y, c); px(x + 2, y, c); px(x, y - 2, c); px(x, y + 2, c); }
}
const PARADE = ['regular', 'pirate', 'vampire', 'shark', 'grandma', 'kid', 'alien', 'regular'].map((tp) => genLook(tp));

function drawLogo(t, x, y) {
  const crazy = 'CRAZY', dent = 'DENTIST';
  const wC = textW(crazy, 6);
  const drop = (i) => { const k = clamp((t - 0.15 - i * 0.07) / 0.45, 0, 1); return Math.round((1 - easeOutBack(k)) * -70); };
  text(crazy, x - wC / 2, y, P.red, 6, {
    ol: P.black, olw: 2, sh: P.navy, shd: 4,
    dy: (i) => drop(i) + Math.sin(t * 4 + i * 0.8) * 2,
    fn: (r) => r === 0 ? P.salmon : r === 4 ? P.dred : P.red,
  });
  const wD = textW(dent, 5);
  text(dent, x - wD / 2, y + 38, P.white, 5, {
    ol: P.black, olw: 2, sh: P.navy, shd: 4,
    dy: (i) => drop(i + 5),
    fn: (r) => r === 1 ? P.hot : r === 3 ? P.sky : P.white,
  });
  return { x0: x - wD / 2, x1: x + wD / 2, y: y + 38 + 25 };
}

// ---------- TITLE ----------
const Title = {
  enter() {
    this.t = 0; this.sel = 0; this.drips = []; this.started = this.started || false;
    SND.playSong('title');
  },
  items() {
    const a = [];
    if (Game.hasSave()) a.push(['CONTINUE', () => { Game.load(); startDay(); }]);
    a.push(['NEW GAME', () => { Game.newRun(); startDay(); }]);
    a.push(['HOW TO PLAY', () => { HowTo.page = 0; goto(HowTo); }]);
    a.push(['OPTIONS', () => { Options.back = Title; goto(Options); }]);
    return a;
  },
  update(dt) {
    this.t += dt;
    if (!this.started) {
      if (input.pressed || Object.keys(input.hit).length) { this.started = true; SND.unlock(); SND.sfx('start'); SND.playSong('title'); input.consume(); }
      return;
    }
    const n = this.items().length;
    if (input.key('ArrowDown') || input.key('s')) { this.sel = (this.sel + 1) % n; SND.sfx('blip'); }
    if (input.key('ArrowUp') || input.key('w')) { this.sel = (this.sel + n - 1) % n; SND.sfx('blip'); }
    if (input.key('Enter') || input.key(' ')) { SND.sfx('click'); this.items()[this.sel][1](); input.consume(); }
    // toothpaste drips from the logo
    if (this.t > 1 && chance(dt * 2.2)) this.drips.push({ x: randi(this.lx0 + 4, this.lx1 - 4), y: this.ly - 2, len: 0, vy: 0, falling: false });
    for (const d of this.drips) {
      if (!d.falling) { d.len += dt * 6; if (d.len > 6) d.falling = true; }
      else { d.vy += 200 * dt; d.y += d.vy * dt; }
    }
    this.drips = this.drips.filter((d) => d.y < 160);
  },
  draw() {
    const t = this.t;
    sunburst(t, P.blue, P.sky);
    // floor + parade
    for (let r = 0; r < 3; r++) for (let c = -1; c < 22; c++) rect(c * 16 - ((t * 18) % 16) + (r % 2) * 8, 156 + r * 9, 16, 9, (c + r) % 2 ? P.white : P.lgray);
    rect(0, 155, W, 2, P.navy);
    PARADE.forEach((L, i) => {
      const x = ((t * 22 + i * 46) % (W + 60)) - 30;
      drawPerson(L, x, 176, { walk: t + i * 0.3, t, mood: i % 3 === 0 ? 'happy' : 'ok' });
    });
    // mascot
    const k = clamp((t - 0.2) / 1.1, 0, 1);
    const baseY = 148;
    const fall = (1 - easeOutBounce(k)) * -160;
    const bob = k >= 1 ? Math.sin(t * 2.4) * 2 : 0;
    const sq = k >= 1 ? 1 + Math.sin(t * 4.8) * 0.04 : 1;
    const ms = mascotSprite(Math.floor(t * 10) % 37 === 0 ? 1 : 0);
    const mw = Math.round(ms.width * (2 - sq)), mh = Math.round(ms.height * sq);
    const mx = 56 - mw / 2, my = baseY - mh + fall + bob;
    ellipse(56, baseY + 2, 22 - bob, 3, P.navy);
    line(mx + mw - 6, my + 34, mx + mw + 10, my + 14, P.black, 4); line(mx + mw - 6, my + 34, mx + mw + 10, my + 14, P.sky, 2);
    rect(mx + mw + 6, my + 6, 8, 6, P.black); rect(mx + mw + 7, my + 7, 6, 4, P.white); rect(mx + mw + 7, my + 9, 6, 1, P.cyan);
    G.drawImage(ms, Math.round(mx), Math.round(my), mw, mh);
    for (let i = 0; i < 5; i++) {
      const ph = (t * 0.9 + i * 0.37) % 1, sx = 20 + ((i * 53) % 80), sy = 72 + ((i * 29) % 70);
      twinkle(sx, sy, Math.sin(ph * Math.PI), i % 2 ? P.yellow : P.white);
    }
    // logo
    const lg = drawLogo(t, 196, 8);
    this.lx0 = lg.x0; this.lx1 = lg.x1; this.ly = lg.y;
    for (const d of this.drips) {
      if (!d.falling) { rect(d.x - 1, d.y, 4, Math.round(d.len) + 1, P.black); rect(d.x, d.y, 2, Math.round(d.len), P.white); }
      else { rect(d.x - 1, d.y - 1, 4, 4, P.black); rect(d.x, d.y, 2, 2, P.white); }
    }
    for (let i = 0; i < 6; i++) { const ph = (t * 0.7 + i * 0.29) % 1; twinkle(130 + ((i * 41) % 130), 6 + ((i * 17) % 64), Math.sin(ph * Math.PI)); }

    if (!this.started) {
      if (Math.floor(t * 2.5) % 2) text(input.touch ? 'TAP TO START' : 'CLICK TO START', 196, 104, P.yellow, 2, { align: 'c', ol: P.black, sh: P.navy });
      text('SOUND ON', 196, 124, P.white, 1, { align: 'c', ol: P.navy });
    } else {
      const items = this.items();
      items.forEach(([label, fn], i) => {
        const bx = 140, by = 82 + i * 16;
        if (input.inside(bx, by, 112, 13) && input.moved && this.sel !== i) { this.sel = i; SND.sfx('blip'); }
        if (UI.button(bx, by, 112, 13, label, { selected: this.sel === i, color: i === 0 ? P.red : P.sky, light: i === 0 ? P.salmon : P.cyan, dark: i === 0 ? P.dred : P.blue })) fn();
      });
      if (this.sel < items.length) { const ty = 82 + this.sel * 16 + 3; spr(TOOTH9, 128 + Math.round(Math.sin(t * 8)), ty, false); }
    }
    const b = Game.best();
    if (b.day > 0) text(`BEST: DAY ${b.day}  $${b.money}`, 316, 146, P.yellow, 1, { align: 'r', ol: P.navy });
  },
};

// ---------- OPTIONS ----------
const Options = {
  back: null,
  enter() { this.t = 0; },
  update(dt) { this.t += dt; if (input.key('Escape')) goto(this.back || Title); },
  draw() {
    sunburst(this.t, P.navy, P.slate);
    text('OPTIONS', 160, 14, P.yellow, 3, { align: 'c', ol: P.black, sh: P.black });
    const rows = [
      ['MUSIC', settings.music, () => SND.setMusic(!settings.music)],
      ['SOUND FX', settings.sfx, () => SND.setSfx(!settings.sfx)],
      ['SCREEN SHAKE', settings.shake, () => { settings.shake = !settings.shake; saveSettings(); addShake(4); }],
      ['CRT SCANLINES', settings.crt, () => { settings.crt = !settings.crt; saveSettings(); applyCRT(); }],
    ];
    rows.forEach(([name, on, fn], i) => {
      const y = 48 + i * 22;
      UI.panel(70, y, 120, 16, P.navy);
      text(name, 78, y + 6, P.white);
      if (UI.button(196, y, 54, 16, on ? 'ON' : 'OFF', on ? { color: P.dgreen, light: P.green, dark: P.ddgreen } : { color: P.dred, light: P.red, dark: P.ddbrown })) fn();
    });
    if (UI.button(110, 148, 100, 16, 'BACK')) goto(this.back || Title);
  },
};

// ---------- HOW TO PLAY ----------
const HowTo = {
  page: 0,
  enter() { this.t = 0; },
  update(dt) { this.t += dt; if (input.key('Escape')) goto(Title); },
  draw() {
    sunburst(this.t, P.navy, P.slate);
    UI.panel(8, 6, 304, 140, P.navy, P.black, P.gold);
    if (this.page === 0) {
      text('RUNNING THE CLINIC', 160, 12, P.yellow, 2, { align: 'c', sh: P.black });
      const tips = [
        ['@', 'PATIENTS WAIT IN THE LOBBY. CLICK ONE TO SEAT THEM IN YOUR CHAIR.'],
        ['@', 'IF THEIR PATIENCE BAR RUNS OUT, THEY STORM OFF AND YOU LOSE STARS.'],
        ['@', 'EACH PATIENT NEEDS 1 TO 3 TREATMENTS. EACH ONE IS A MINIGAME.'],
        ['@', 'WATCH THE PAIN METER! AT 100% THE PATIENT CHOMPS YOU AND RUNS.'],
        ['@', 'FROM DAY 2 YOU CAN NUMB PATIENTS FIRST. A GOOD SHOT HALVES PAIN.'],
        ['@', 'OPEN THE GADGET CLOSET (OR PRESS C) TO BUY WACKY TOOLS. EACH ONE WORKS ONCE A DAY. PRESS G TO USE ONE.'],
        ['@', 'END EACH DAY WITH AT LEAST 1 STAR. SURVIVE 7 DAYS TO WIN!'],
      ];
      let y = 30;
      for (const [b, s] of tips) { text(b, 16, y, P.red); y += textBlock(s, 26, y, 278, P.white) + 4; }
    } else {
      text('TREATMENTS', 160, 12, P.yellow, 2, { align: 'c', sh: P.black });
      const rows = [
        ['extract', 'EXTRACTION', 'GRAB THE ROTTEN TOOTH, WIGGLE LEFT-RIGHT, THEN PULL. PULL TOO EARLY AND IT SNAPS.'],
        ['clean', 'CLEANING', 'SCRUB ALL THE GUNK OFF. SCRUBBING THE GUMS HURTS.'],
        ['cavity', 'CAVITY', 'DRILL OUT THE BROWN DECAY, THEN SQUIRT IN FILLING. IT KEEPS DRIPPING AFTER YOU LET GO!'],
        ['canal', 'ROOT CANAL', 'TRACE BOTH CANALS DOWN TO THE X WITHOUT TOUCHING THE WALLS.'],
        ['braces', 'BRACES', 'CLICK THE TEETH IN NUMBER ORDER, FAST.'],
        ['numb', 'NUMBING SHOT', 'CLICK WHEN THE NEEDLE IS IN THE GREEN ZONE.'],
      ];
      let y = 28;
      for (const [k, n, s] of rows) {
        procIcon(k, 14, y);
        text(n, 28, y + 1, P.gold);
        y += textBlock(s, 28, y + 8, 278, P.white) + 10;
      }
    }
    if (UI.button(20, 152, 90, 16, 'BACK')) { if (this.page) this.page--; else goto(Title); }
    text(`${this.page + 1}/2`, 160, 157, P.white, 1, { align: 'c' });
    if (this.page < 1 && UI.button(210, 152, 90, 16, 'NEXT')) this.page++;
    if (this.page === 1 && UI.button(210, 152, 90, 16, 'PLAY!', { color: P.dgreen, light: P.green, dark: P.ddgreen })) { Game.newRun(); startDay(); }
  },
};

// ---------- DAY SUMMARY ----------
const DaySummary = {
  enter() { this.t = 0; Game.recordBest(); SND.playSong('clinic'); },
  update(dt) { this.t += dt; },
  next() {
    if (Game.rep < 1) { GameOver.reason = 'YOU ENDED THE DAY WITH LESS THAN 1 STAR.'; goto(GameOver); }
    else if (Game.day === LAST_DAY && !Game.endless) goto(Victory);
    else goto(Shop);
  },
  draw() {
    drawClinic(this.t, Game.up, { closed: true });
    drawDentist(DENT_X, FLOOR_Y, this.t);
    G.globalAlpha = 0.6; rect(0, 0, W, H, P.black); G.globalAlpha = 1;
    const s = Clinic.dayStats;
    UI.panel(50, 12, 220, 150, P.navy, P.black, P.gold);
    text(`DAY ${Game.day} COMPLETE`, 160, 20, P.yellow, 2, { align: 'c', sh: P.black });
    const rows = [
      ['PATIENTS TREATED', s.treated, P.green],
      ['STORMED OFF', s.left, s.left ? P.red : P.white],
      ['CHOMPED YOU', s.chomps, s.chomps ? P.red : P.white],
      ['EARNED TODAY', `$${s.earned}`, P.gold],
      ['BANK', `$${Math.floor(Game.money)}`, P.gold],
    ];
    rows.forEach(([a, b, c], i) => {
      if (this.t < 0.25 + i * 0.18) return;
      text(a, 62, 44 + i * 12, P.white); text(b, 258, 44 + i * 12, c, 1, { align: 'r' });
    });
    if (this.t > 1.2) {
      text('REPUTATION', 62, 108, P.white);
      stars(158, 107, Game.rep);
      const d = Game.rep - s.rep0;
      text(`${d >= 0 ? '+' : ''}${d.toFixed(2)}`, 258, 108, d >= 0 ? P.green : P.red, 1, { align: 'r' });
      if (Game.rep < 1) text('WARNING: UNDER 1 STAR!', 160, 122, Math.floor(this.t * 4) % 2 ? P.red : P.hot, 1, { align: 'c' });
    }
    if (this.t > 1.4 && (UI.button(110, 138, 100, 16, 'CONTINUE', { color: P.dgreen, light: P.green, dark: P.ddgreen }) || input.key('Enter'))) this.next();
  },
};

// ---------- SHOP ----------
const UPGRADES = [
  { id: 'pliers', name: 'GOLDEN PLIERS', desc: 'TEETH LOOSEN 60% FASTER', price: 60 },
  { id: 'brush', name: 'TURBO SCRUBBER', desc: 'A MUCH BIGGER CLEANING BRUSH', price: 50 },
  { id: 'drill', name: 'STEADY DRILL', desc: 'WAY LESS DRILL WOBBLE', price: 80 },
  { id: 'gas', name: 'LAUGHING GAS', desc: 'ALL PAIN IS 30% LOWER', price: 110 },
  { id: 'chairs', name: 'COMFY CHAIRS', desc: 'PATIENTS WAIT 50% LONGER', price: 60 },
  { id: 'tank', name: 'FISH TANK', desc: 'CALM PATIENTS: PAIN FADES 2X FASTER', price: 70 },
];
function upgradeIcon(id, x, y, t) {
  switch (id) {
    case 'pliers': drawCursor('pliers', x + 2, y + 4, t, false); break;
    case 'brush': drawCursor('brush', x + 4, y + 4, t, false); break;
    case 'drill': drawCursor('drill', x + 2, y + 10, t, false); break;
    case 'gas': orect(x + 4, y + 2, 7, 12, P.sky); rect(x + 6, y, 3, 2, P.gray); text('N', x + 6, y + 6, P.white); break;
    case 'chairs': orect(x + 2, y + 2, 12, 8, P.plum); orect(x + 1, y + 10, 14, 3, P.plum); break;
    case 'tank': orect(x, y + 3, 16, 10, P.sky); rect(x + 4, y + 7, 3, 2, P.orange); rect(x + 9, y + 5, 3, 2, P.yellow); break;
  }
}
const Shop = {
  enter() { this.t = 0; SND.playSong('clinic'); },
  update(dt) { this.t += dt; },
  draw() {
    sunburst(this.t * 0.5, P.teal, P.ddgreen);
    text('UPGRADE SHOP', 160, 6, P.yellow, 2, { align: 'c', ol: P.black, sh: P.black });
    coin(250, 7); text(`$${Math.floor(Game.money)}`, 258, 8, P.gold, 1, { ol: P.black });
    UPGRADES.forEach((u, i) => {
      const c = i % 3, r = Math.floor(i / 3), x = 8 + c * 103, y = 24 + r * 60;
      const owned = !!Game.up[u.id], afford = Game.money >= u.price;
      UI.panel(x, y, 98, 56, owned ? P.ddgreen : P.navy, P.black, owned ? P.green : P.slate);
      upgradeIcon(u.id, x + 5, y + 5, this.t);
      textBlock(u.name, x + 26, y + 5, 70, P.yellow);
      textBlock(u.desc, x + 6, y + 22, 88, P.white);
      if (owned) text('OWNED', x + 49, y + 44, P.green, 1, { align: 'c' });
      else if (UI.button(x + 14, y + 39, 70, 13, `BUY $${u.price}`, { disabled: !afford, color: P.gold, light: P.yellow, dark: P.orange, tc: P.black })) {
        Game.money -= u.price; Game.up[u.id] = true; SND.sfx('buy');
        burst(x + 49, y + 28, 18, [P.yellow, P.white, P.gold], { star: true, spd: 70, g: 0 });
      }
    });
    if (UI.button(100, 150, 120, 18, `START DAY ${Game.day + 1}`, { color: P.red, light: P.salmon, dark: P.dred }) || input.key('Enter')) {
      Game.day++; Game.save(); startDay();
    }
  },
};

// ---------- VICTORY ----------
const Victory = {
  enter() { this.t = 0; Game.recordBest(); SND.stopMusic(); SND.sfx('victory'); setTimeout(() => SND.playSong('title'), 1700); },
  update(dt) {
    this.t += dt;
    if (chance(dt * 30)) FX.parts.push({ x: rand(0, W), y: -4, vx: rand(-20, 20), vy: rand(20, 50), g: 20, life: 6, max: 6, c: pick([P.red, P.yellow, P.cyan, P.green, P.pink, P.white]), s: 2 });
  },
  draw() {
    sunburst(this.t, P.gold, P.yellow, 160, 60);
    // trophy
    const tx = 160, ty = 30 + Math.round(Math.sin(this.t * 2) * 2);
    orect(tx - 16, ty, 32, 22, P.gold); rect(tx - 14, ty + 2, 4, 18, P.yellow);
    ringE(tx - 18, ty + 8, 6, 7, 2, P.black); ringE(tx + 18, ty + 8, 6, 7, 2, P.black);
    orect(tx - 3, ty + 22, 6, 8, P.gold); orect(tx - 12, ty + 30, 24, 5, P.dbrown);
    spr(TOOTH9, tx - 4, ty + 6, false);
    text('DENTIST OF THE YEAR!', 160, 72, P.white, 2, { align: 'c', ol: P.black, sh: P.dbrown });
    text(`YOU SURVIVED ${LAST_DAY} CRAZY DAYS`, 160, 90, P.navy, 1, { align: 'c' });
    UI.panel(70, 98, 180, 40, P.navy, P.black, P.gold);
    text(`PATIENTS TREATED  ${Game.stats.treated}`, 80, 104, P.white);
    text(`TOTAL EARNED  $${Game.stats.earned}`, 80, 113, P.gold);
    text(`TIMES CHOMPED  ${Game.stats.chomps}`, 80, 122, P.white);
    stars(194, 121, Game.rep);
    if (UI.button(52, 148, 104, 16, 'KEEP PLAYING', { color: P.dgreen, light: P.green, dark: P.ddgreen })) { Game.endless = true; Game.save(); goto(Shop); }
    if (UI.button(164, 148, 104, 16, 'TITLE')) { Game.endless = true; Game.save(); goto(Title); }
  },
};

// ---------- GAME OVER ----------
const GameOver = {
  reason: '',
  enter() { this.t = 0; Game.recordBest(); Game.wipe(); SND.stopMusic(); SND.sfx('bad'); if (!this.reason) this.reason = 'YOUR REPUTATION HIT ZERO STARS.'; },
  update(dt) { this.t += dt; },
  draw() {
    sunburst(this.t * 0.3, P.ddbrown, P.dred);
    const ms = mascotSprite(1);
    G.save(); G.translate(160, 54); G.rotate(Math.PI); G.drawImage(ms, -ms.width / 2, -ms.height / 2); G.restore();
    text('CLINIC CLOSED!', 160, 88, P.red, 3, { align: 'c', ol: P.black, olw: 2, sh: P.black });
    textBlock(this.reason + ' THE DENTAL BOARD SHUT YOU DOWN.', 160, 112, 200, P.white, 1, { align: 'c' });
    text(`DAYS: ${Game.day}   TREATED: ${Game.stats.treated}   EARNED: $${Game.stats.earned}`, 160, 132, P.gold, 1, { align: 'c' });
    if (this.t > 0.8) {
      if (UI.button(56, 148, 100, 16, 'TRY AGAIN', { color: P.dgreen, light: P.green, dark: P.ddgreen })) { this.reason = ''; Game.newRun(); startDay(); }
      if (UI.button(164, 148, 100, 16, 'TITLE')) { this.reason = ''; goto(Title); }
    }
  },
};

// ---------- PAUSE ----------
const Pause = {
  on: false,
  draw() {
    G.globalAlpha = 0.65; rect(0, 0, W, H, P.black); G.globalAlpha = 1;
    UI.panel(90, 26, 140, 128, P.navy, P.black, P.gold);
    text('PAUSED', 160, 34, P.yellow, 2, { align: 'c', sh: P.black });
    if (UI.button(106, 54, 108, 16, 'RESUME', { color: P.dgreen, light: P.green, dark: P.ddgreen })) this.on = false;
    if (UI.button(106, 74, 108, 16, `MUSIC: ${settings.music ? 'ON' : 'OFF'}`)) SND.setMusic(!settings.music);
    if (UI.button(106, 94, 108, 16, `SOUND: ${settings.sfx ? 'ON' : 'OFF'}`)) SND.setSfx(!settings.sfx);
    if (UI.button(106, 114, 108, 16, 'QUIT TO TITLE', { color: P.dred, light: P.red, dark: P.ddbrown })) { this.on = false; SND.drillOff(); goto(Title); }
    text('TODAY RESTARTS IF YOU QUIT', 160, 140, P.lgray, 1, { align: 'c' });
  },
};
