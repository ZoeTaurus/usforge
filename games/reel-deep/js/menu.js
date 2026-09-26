'use strict';
// ============================================================
//  Title menu: sunset beach, sleeping fisher, birds, breeze
// ============================================================

const MENU_DAYTIME = 0.735;
const HELP_PAGES = [[
  ['FISHING', '#ffd27a'],
  ['HOLD SPACE / MOUSE TO CHARGE, RELEASE TO CAST.', '#fff'],
  ['WHEN THE BOBBER DUNKS - PRESS FAST TO HOOK!', '#fff'],
  ['HOLD TO REEL. KEEP THE TENSION OUT OF THE RED.', '#fff'],
  ['FISH GO IN YOUR COOLER - SELL THEM AT THE SHOP.', '#fff'],
  ['HUGE SHADOWS ARE BIG FISH. THEY PULL YOU IN!', '#fff'],
  ['', '#fff'],
  ['B SHOP  J JOURNAL  A AQUARIUM  T TRAVEL', '#c8b8a0'],
  ['Q TALK TO OLD SALT  X SHOO GULLS  1-3 BAIT', '#c8b8a0'],
  ['M MUTE   ESC MENU', '#c8b8a0'],
], [
  ['UNDERWATER', '#7fd7ff'],
  ['WASD/ARROWS SWIM   J/SPACE/CLICK THROW HOOK', '#fff'],
  ['K/SHIFT DASH   GRAB BIG BUBBLES FOR AIR', '#fff'],
  ['BEAT THE BEAST AND IT DROPS A BETTER ROD!', '#fff'],
  ['ON A PHONE: JOYSTICK ON THE LEFT, BUTTONS RIGHT', '#fff'],
  ['', '#fff'],
  ['2 PLAYERS (ONE KEYBOARD)', '#ffb0d0'],
  ['P1: SPACE FISH - WASD + SPACE HOOK + L-SHIFT DASH', '#fff'],
  ['P2: ENTER FISH - ARROWS + ENTER HOOK + R-SHIFT DASH', '#fff'],
  ['SWIM INTO A KNOCKED-OUT FRIEND TO REVIVE THEM', '#fff'],
]];
function loadPlayers() { try { return localStorage.getItem('reel-deep-players') === '2' ? 2 : 1; } catch (e) { return 1; } }
function savePlayers(n) { try { localStorage.setItem('reel-deep-players', String(n)); } catch (e) { /* ignore */ } }

const MenuScene = {
  enter() {
    this.t = 0;
    this.sel = 0;
    this.state = 'idle';
    this.wakeT = 0;
    this.help = false;
    this.mode = 'main';
    this.parts = new Particles();
    this.amb = new Ambient(5, 160, 90);
    this.zs = [];
    this.zTimer = 0;
    const s = loadSave();
    this.hasSave = !!(s && s.started);
    Game.players = loadPlayers();
    this.setItems();
    Sound.music('cozy');
    Sound.ambience('waves');
  },
  setItems() {
    this.items = this.mode === 'diff' ? ['cozy', 'normal', 'back'] : this.hasSave ? ['continue', 'new', 'players', 'lang', 'help'] : ['start', 'players', 'lang', 'help'];
    this.sel = Math.min(this.sel, this.items.length - 1);
  },
  label(it) {
    return { continue: 'CONTINUE', new: 'NEW GAME', start: 'START', players: 'PLAYERS: ' + Game.players, lang: tr('LANGUAGE') + ': ' + LANGS[LANG].name, help: 'HOW TO PLAY', cozy: 'COZY (EASY)', normal: 'NORMAL', back: 'BACK' }[it];
  },
  choose(i) {
    const it = this.items[i];
    Sound.play('select');
    if (it === 'help') { this.help = 1; return; }
    if (it === 'lang') { setLang(LANG + 1); return; }
    if (it === 'players') { Game.players = Game.players === 1 ? 2 : 1; savePlayers(Game.players); Toasts.add(Game.players === 2 ? 'TWO PLAYERS! P2 USES ENTER + ARROWS' : 'ONE PLAYER', '#ffe9b0', 2.5, 100); return; }
    if (it === 'start' || it === 'new') {
      this.mode = 'diff'; this.sel = 0; this.setItems();
      Toasts.add(it === 'new' ? 'PICK A DIFFICULTY. YOUR OLD SAVE WILL BE REPLACED.' : 'PICK A DIFFICULTY', '#ffe9b0', 3, 100);
      return;
    }
    if (it === 'back') { this.mode = 'main'; this.sel = 0; this.setItems(); return; }
    if (it === 'continue') Game.save = loadSave();
    else { Game.save = newSave(); Game.save.diff = it; }
    Game.save.started = true;
    applyHat(Game.save.hat);
    writeSave();
    this.state = 'waking';
    this.wakeT = 0;
    Sound.play('wake');
  },
  // the wooden signpost grows to fit the longest (translated) label
  signW() { return Math.max(78, Math.max(...this.items.map(it => textWidth(this.label(it)))) + 20); },
  signX() { return Math.min(224, W - 6 - this.signW()); },
  signY() { return Math.min(112, H - 8 - (16 + this.items.length * 11)); },
  drawSleeper(cx, dir, w, pal, t) {
    const cy = 78;
    if (this.state === 'idle' || w < 0) {
      drawFisher(cx, cy, dir, 'sleep', { hatOnFace: true, breath: Math.sin(t * 1.7) > 0, pal });
    } else if (w < 1.6) {
      const lift = w < 0.35 ? Math.round(easeOut(w / 0.35) * 5) : Math.max(0, Math.round(5 - (w - 0.35) * 14));
      drawFisher(cx, cy, dir, 'sit', { hatLift: lift, blink: w > 0.5 && w < 0.62, mouthOpen: w > 0.85 && w < 1.4, pal });
      if (w < 0.7) drawText('!', cx - 1, cy - 30 - Math.round(Math.sin(w * 20)), '#ffe14a');
    } else {
      const jump = w < 1.8 ? -Math.round(Math.sin(((w - 1.6) / 0.2) * Math.PI) * 3) : 0;
      drawFisher(cx + (dir < 0 ? -4 : 4), cy + jump, 1, w < 1.9 ? 'cheer' : 'stand', { pal });
    }
  },
  update(dt) {
    this.t += dt;
    this.amb.update(dt);
    this.parts.update(dt);
    fireParticles(this.parts, 22, 78, dt);

    // snoring Zzz drifting off in the breeze
    if (this.state === 'idle') {
      this.zTimer -= dt;
      if (this.zTimer <= 0) { this.zTimer = 1.3; this.zs.push({ x: 46, y: 60, t: 0 }); if (Game.players === 2) this.zs.push({ x: 72, y: 62, t: -0.6 }); }
    }
    for (const z of this.zs) { z.t += dt; z.y -= 5 * dt; z.x -= 4 * dt + Math.sin(z.t * 3) * 0.1; }
    this.zs = this.zs.filter(z => z.t < 2.6);

    if (this.state === 'waking') {
      this.wakeT += dt;
      if (this.wakeT > 0.9 && !this.yawned) { this.yawned = true; Sound.play('yawn'); }
      if (this.wakeT > 2.6 && !Fx.busy()) Fx.transition(() => Game.setScene(BeachScene, { fresh: true }));
      return;
    }
    if (this.help) {
      if (Input.confirm() || Input.hit('escape') || Input.mouse.pressed) { this.help = this.help === 1 && !Input.hit('escape') ? 2 : 0; Sound.play('move'); }
      return;
    }
    if (Input.hit('escape') && this.mode === 'diff') { this.mode = 'main'; this.sel = 0; this.setItems(); return; }
    const n = this.items.length;
    if (Input.hit('arrowup', 'w')) { this.sel = (this.sel + n - 1) % n; Sound.play('move'); }
    if (Input.hit('arrowdown', 's')) { this.sel = (this.sel + 1) % n; Sound.play('move'); }
    for (let i = 0; i < n; i++) {
      if (inRect(this.signX() + 4, this.signY() + 5 + i * 11, this.signW() - 8, 10)) {
        if (Input.mouse.lastMove > performance.now() / 1000 - 0.05 && this.sel !== i) { this.sel = i; Sound.play('move'); }
        if (Input.mouse.pressed) this.choose(i);
      }
    }
    if (Input.confirm()) this.choose(this.sel);
  },
  draw() {
    // the world is painted at half resolution (160x90) and scaled up 2x
    // for extra-chunky pixels; the UI is drawn on top at full resolution
    const T = timeOfDay(MENU_DAYTIME), t = this.t, HY = 46, SW = 160, SH = 90;
    if (!this.small) this.small = makeCanvas(SW, SH);
    const sx = this.small.getContext('2d');
    withTarget(sx, () => {
      drawSky(T, HY, MENU_DAYTIME);
      this.amb.drawClouds(T);
      const lights = drawSunMoon(MENU_DAYTIME, HY, { x: 118, y: 44, col: '#ffb45e' });
      drawFarSea(HY, 62, T, t, lights);
      // lapping shoreline
      const edge = 61 + Math.round(Math.sin(t * 0.9) * 1.5);
      R(0, edge, SW, SH - edge, '#c9a878');
      R(0, 65, SW, SH - 65, '#e8c890');
      for (let x = 0; x < SW; x++) {
        const fy = edge + Math.round(Math.sin(x * 0.2 + t * 1.3) * 0.6);
        P(x, fy, '#fff4e0');
        if ((x + Math.floor(t * 6)) % 6 === 0) P(x, fy + 1, '#fff4e0');
      }
      for (let i = 0; i < 70; i++) { const x = Math.floor(hash(i, 7) * SW), y = 66 + Math.floor(hash(i, 8) * 24); P(x, y, hash(i, 9) > 0.5 ? '#d8b478' : '#f4d9a4'); }
      for (const [x, y] of [[90, 84], [76, 80], [98, 87]]) { R(x, y, 2, 1, '#fbe3d0'); P(x, y - 1, '#fbe3d0'); }
      R(146, 83, 1, 3, '#ff8a6a'); R(145, 84, 3, 1, '#ff8a6a');
      for (const [gx, gy] of [[8, 80], [74, 87], [104, 76], [154, 82], [118, 72]]) drawGrass(gx, gy, t);
      drawPalm(6, 84, t, 44);
      drawCampfire(22, 78, t);
      drawBarrel(53, 78);
      drawLantern(57, 57, true);
      const two = Game.players === 2;
      // with two players the bucket and rod shuffle over to make room
      const rx = two ? 90 : 67;
      pline(rx, 78, rx + 7, 50, '#9b6a3c'); P(rx + 7, 50, '#e8d5b0');
      drawLine(rx + 7, 50, rx + 9, 70, 2, 'rgba(255,255,255,0.35)');
      drawBucket(two ? 92 : 69, 79);
      // the fisher (and a friend on the other side of the barrel)
      this.drawSleeper(48, -1, this.wakeT, PAL, t);
      if (two) this.drawSleeper(71, 1, this.wakeT - 0.3, P2_PAL, t + 1.1);
      for (const z of this.zs) {
        G.globalAlpha = clamp(2.6 - z.t, 0, 1) * clamp(z.t * 3, 0, 1);
        drawText('Z', z.x, z.y, '#f4f0ff', { shadow: '#3a2a55' });
      }
      G.globalAlpha = 1;
      this.parts.draw();
      this.amb.drawBirds(T.bird);
      this.amb.drawBreeze();
      G.globalAlpha = 0.1; R(0, 0, SW, SH, '#ff8a3a'); G.globalAlpha = 1;
      glow(22, 74, 16, '#ff9a3a', 0.07);
      glow(59, 59, 8, '#ffd76a', 0.08);
    });
    G.drawImage(this.small, 0, 0, W, H);

    // title
    const ty = 12 + Math.round(Math.sin(t * 1.4));
    drawText('REEL DEEP', W / 2, ty + 2, '#6a2a3a', { scale: 4, align: 'center' });
    drawText('REEL DEEP', W / 2, ty, '#ffe9b0', { scale: 4, align: 'center', outline: '#3b2140' });
    drawText('~ A COZY FISHING ADVENTURE ~', W / 2, ty + 26, '#ffe9d0', { align: 'center', shadow: '#5a2a4a' });

    // wooden signpost menu
    if (this.state === 'idle') {
      const sx = this.signX(), sy = this.signY(), sw = this.signW();
      R(sx + sw / 2 - 1, sy + 6, 3, H - sy, '#6b4428'); R(sx + sw / 2 - 1, sy + 6, 1, H - sy, '#8a5a35');
      panel(sx, sy, sw, 16 + this.items.length * 11, '#e8cc98');
      this.items.forEach((it, i) => {
        const y = sy + 10 + i * 11, s = i === this.sel;
        const label = this.label(it);
        if (s) { drawText('>', sx + 7 + Math.round(Math.sin(t * 6)), y, '#a0301f'); }
        drawText(label, sx + 13, y, s ? '#a0301f' : '#5a3a22');
      });
      drawText('M: MUTE   L: LANGUAGE', 4, 172, 'rgba(255,240,220,0.6)');
    }
    if (this.help) {
      panel(18, 34, 284, 136);
      HELP_PAGES[this.help - 1].forEach(([l, c], i) => drawText(l, W / 2, 43 + i * 11, c === '#fff' ? '#4a2e1c' : darken(c, 0.35), { align: 'center' }));
      drawText(this.help === 1 ? 'SPACE: NEXT PAGE' : 'SPACE: CLOSE', W / 2, 160, '#a0301f', { align: 'center' });
    }
  },
};
