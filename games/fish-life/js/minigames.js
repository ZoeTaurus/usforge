'use strict';
/* =====================================================================
   FISH LIFE  -  minigames.js
   Challenges that unlock the big bowl upgrades, and can be replayed
   later for bonus IQ: a staring contest with the cat (rhythm game),
   hacking the WiFi (memory game) and a snack heist (runner).
   ===================================================================== */

const DIRS = ['up', 'right', 'down', 'left'];
const DIR_KEYS = { up: ['ArrowUp', 'KeyW'], right: ['ArrowRight', 'KeyD'], down: ['ArrowDown', 'KeyS'], left: ['ArrowLeft', 'KeyA'] };
const dirPressed = () => DIRS.find(d => DIR_KEYS[d].some(k => Input.hits.has(k)));

// A chunky pixel arrow centred on (x, y).
function drawArrow(x, y, dir, color, s = 4) {
  x = Math.round(x); y = Math.round(y);
  for (let i = 0; i <= s; i++) {
    const w = i * 2 + 1;
    if (dir === 'up') rect(x - i, y - s + i, w, 1, color);
    else if (dir === 'down') rect(x - i, y + s - i, w, 1, color);
    else if (dir === 'left') rect(x - s + i, y - i, 1, w, color);
    else rect(x + s - i, y - i, 1, w, color);
  }
  if (dir === 'up') rect(x - 1, y + 1, 3, s, color);
  else if (dir === 'down') rect(x - 1, y - s, 3, s, color);
  else if (dir === 'left') rect(x + 1, y - 1, s, 3, color);
  else rect(x - s, y - 1, s, 3, color);
}

// Four on-screen arrow buttons for touch screens.
const TOUCH_PAD = { up: [130, 146], left: [104, 160], down: [130, 160], right: [156, 160] };
function touchDir() {
  if (!Input.touchSeen) return null;
  for (const d of DIRS) { const [x, y] = TOUCH_PAD[d]; if (clicked(x - 11, y - 7, 22, 14)) return d; }
  return null;
}
function drawTouchPad(ox = 0) {
  if (!Input.touchSeen) return;
  for (const d of DIRS) {
    const [x, y] = TOUCH_PAD[d];
    panel(x - 11 + ox, y - 7, 22, 14, { fill: '#262b44', alpha: 0.85 });
    drawArrow(x + ox, y, d, '#ffffff', 3);
  }
}

class MiniGame {
  constructor(bowl, mode, upgrade) {
    this.bowl = bowl;           // the bowl scene we return to
    this.mode = mode;           // 'unlock' or 'replay'
    this.u = upgrade;
    this.t = 0;
    this.pt = 0;
    this.phase = 'intro';
    this.parts = new Particles();
    this.floaters = new Floaters();
  }
  enter() { Sound.play(this.music === undefined ? 'danger' : this.music); }
  update(dt, active) {
    this.t += dt;
    this.parts.update(dt);
    this.floaters.update(dt);
    if (this.phase === 'intro') {
      if (active && this.t > 0.4 && (hit('ok') || Input.mhit)) { this.phase = 'play'; this.pt = 0; Sound.sfx('ok'); this.start(); }
      else if (active && hit('back')) { this.won = false; this.score = 0; this.quit = true; this.exit(); }
      return;
    }
    if (this.phase === 'play') {
      if (active && hit('back')) { this.end(false, 0); return; }
      this.pt += dt;
      this.play(dt, active);
      return;
    }
    this.doneT += dt;
    if (active && this.doneT > 1 && (hit('ok') || Input.mhit)) this.exit();
  }
  end(won, score) {
    if (this.phase === 'done') return;
    this.phase = 'done';
    this.won = won;
    this.score = score;
    this.doneT = 0;
    Sound.play(null);
    Sound.sfx(won ? 'upgrade' : 'caught');
  }
  exit() {
    if (this.leaving) return;
    this.leaving = true;
    const b = this.bowl;
    b.onGameDone(this.id, this.mode, !!this.won, this.score || 0, this.u, !!this.quit);
    Game.go(() => b);
  }
  draw() {
    this.drawGame();
    this.parts.draw();
    this.floaters.draw();
    if (this.phase === 'intro') this.drawIntro();
    if (this.phase === 'done') this.drawDone();
  }
  drawIntro() {
    gfx.globalAlpha = 0.72;
    rect(0, 0, W, H, '#07060f');
    gfx.globalAlpha = 1;
    text(this.mode === 'unlock' ? 'CHALLENGE' : 'MINI-GAME', W / 2, 26, '#8b9bb4', { align: 'center' });
    drawBig(this.title, W / 2, 38, 'gold');
    let y = 76;
    for (const l of this.how) { text(l, W / 2, y, '#ffffff', { align: 'center', accent: '#fee761' }); y += 11; }
    if (this.mode === 'unlock') text('WIN TO UNLOCK {' + this.u.name + '}', W / 2, y + 6, '#9fe8f5', { align: 'center', accent: '#fee761' });
    if (Math.floor(this.t * 2) % 2 === 0) text(Input.touchSeen ? 'TAP TO START' : 'PRESS ENTER TO START', W / 2, 146, '#fee761', { align: 'center', outline: '#07060f' });
    text('ESC: BACK', W / 2, 162, '#5a6988', { font: F3, align: 'center' });
  }
  drawDone() {
    gfx.globalAlpha = 0.6;
    rect(0, 0, W, H, '#07060f');
    gfx.globalAlpha = 1;
    drawBig(this.won ? this.winText : 'TRY AGAIN!', W / 2, 50, this.won ? 'gold' : 'red');
    const sub = this.won ? this.winSub : this.loseSub;
    let y = 84;
    for (const l of wrap(sub, 260)) { text(l, W / 2, y, '#ffffff', { align: 'center', accent: '#fee761' }); y += 11; }
    if (this.doneT > 1 && Math.floor(this.t * 2) % 2 === 0) text(Input.touchSeen ? 'TAP TO GO BACK' : 'PRESS ENTER', W / 2, 140, '#fee761', { align: 'center', outline: '#07060f' });
  }
}

/* ------------------------------------------------ staring contest */
class StareGame extends MiniGame {
  constructor(bowl, mode, u) {
    super(bowl, mode, u);
    this.id = 'stare';
    this.title = 'STARING CONTEST';
    this.how = ['THE CAT IS STARING AT YOU. STARE BACK!', 'PRESS THE {ARROW} WHEN IT REACHES THE {CIRCLE}.', 'HIT {10} TO HYPNOTIZE THE CAT. {5 MISSES} AND IT WINS.'];
    this.winText = 'HYPNOTIZED!';
    this.winSub = 'THE CAT NOW OBEYS YOU. {NO MORE PAW ATTACKS}, AND FREE SNACKS!';
    this.loseSub = 'THE CAT WON THIS TIME. YOUR IQ IS SAFE, TRY AGAIN WHENEVER YOU LIKE.';
    this.music = 'danger';
    this.hits = 0;
    this.misses = 0;
    this.notes = [];
    this.swipe = 0;
    this.blink = 0;
  }
  start() {
    let at = 1.2;
    for (let i = 0; i < 18; i++) {
      this.notes.push({ at, dir: pick(DIRS), done: false });
      at += Math.max(0.5, 0.95 - i * 0.03) + rnd(0, 0.2);
    }
  }
  noteX(n) { return 56 + (n.at - this.pt) * 95; }
  play(dt, active) {
    this.swipe = Math.max(0, this.swipe - dt);
    this.blink = Math.max(0, this.blink - dt);
    const d = active ? dirPressed() || touchDir() : null;
    if (d) {
      const n = this.notes.find(q => !q.done && Math.abs(this.noteX(q) - 56) < 24);
      if (n) {
        n.done = true;
        if (n.dir === d && Math.abs(this.noteX(n) - 56) <= 13) this.hitNote(n);
        else this.missNote();
      }
    }
    for (const n of this.notes) if (!n.done && this.noteX(n) < 40) { n.done = true; this.missNote(); }
    if (this.hits >= 10) this.end(true, this.hits);
    else if (this.misses >= 5 || this.notes.every(n => n.done)) this.end(false, this.hits);
  }
  hitNote() {
    this.hits++;
    Sound.tone(440 * Math.pow(2, this.hits / 12), 0.12, { type: 'triangle', vol: 0.14 });
    this.floaters.add(pick(['STARE!', 'GOOD!', 'FOCUS!', 'NICE!']), 56, 100, '#fee761', { font: F5 });
    for (let i = 0; i < 8; i++) this.parts.add({ type: 'spark', x: 56, y: 120, vx: rnd(-50, 50), vy: rnd(-50, 30), drag: 3, life: 0.5, c: '#b55088' });
  }
  missNote() {
    this.misses++;
    this.swipe = 0.45;
    this.blink = 0.2;
    Sound.sfx('hiss');
    Game.shake(3, 0.2);
    this.floaters.add('SWIPE!', 80, 60, '#ff8f7a', { font: F5 });
  }
  drawGame() {
    const t = this.t, k = this.hits / 10;
    rect(0, 0, W, H, '#1b1238');
    // hypnotic rings, stronger as the cat falls under your spell
    for (let r = 10; r < 200; r += 14) {
      gfx.globalAlpha = 0.08 + k * 0.12;
      ring(230, 66, r + ((t * 20) % 14), r % 28 ? '#b55088' : '#68386c');
    }
    gfx.globalAlpha = 1;
    // the cat's big face
    const cx = 230, cy = 66 + Math.round(Math.sin(t * 1.5) * 2);
    for (const s of [-1, 1]) {
      for (let i = 0; i < 18; i++) rect(cx + s * 30 - (s > 0 ? 0 : 20 - i), cy - 40 - 18 + i, s > 0 ? 20 - i : 20 - i, 1, '#5a6988');
    }
    ellipse(cx, cy, 58, 42, '#5a6988');
    ellipse(cx, cy - 2, 55, 39, '#8b9bb4');
    ellipse(cx, cy + 16, 22, 14, '#c0cbdc');
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) line(cx + s * 12, cy + 12 + i * 3, cx + s * 52, cy + 6 + i * 6, '#e8eef7');
    rect(cx - 3, cy + 8, 7, 4, '#f6757a');
    line(cx - 8, cy + 18, cx, cy + 14, '#3e2731'); line(cx, cy + 14, cx + 8, cy + 18, '#3e2731');
    for (const s of [-1, 1]) {
      const ex = cx + s * 22, ey = cy - 8;
      if (this.blink > 0) { rect(ex - 11, ey, 22, 2, '#3e2731'); continue; }
      ellipse(ex, ey, 12, 10, '#3e2731');
      ellipse(ex, ey, 11, 9, k > 0.5 ? '#f6a0c8' : '#fee761');
      if (k < 0.3) rect(ex - 1, ey - 8, 3, 17, '#181425');
      else {
        // spiral eyes
        const turns = 3 + Math.floor(k * 3);
        for (let a = 0; a < turns * Math.PI * 2; a += 0.25) {
          const r = a / (turns * Math.PI * 2) * 9;
          px(ex + Math.cos(a + t * 6 * s) * r, ey + Math.sin(a + t * 6 * s) * r * 0.85, '#68386c');
        }
      }
    }
    // paw swipe when you slip up
    if (this.swipe > 0) {
      const px0 = lerp(40, 140, this.swipe / 0.45);
      thickLine(W, 40, px0, 70, 6, '#8b9bb4');
      disc(px0, 70, 8, '#c0cbdc');
      for (let i = -4; i <= 4; i += 4) line(px0 - 10, 70 + i, px0 - 14, 72 + i, '#ffffff');
    }
    // you, staring intensely
    spr('hero2', 0, 38, 56);
    spr('glasses', 0, 49, 61);
    for (let i = 0; i < 3; i++) if (Math.floor(t * 8 + i) % 3) line(62 + i * 6, 62 - i, 70 + i * 6, 62 - i * 2, '#fee761');
    // the note lane
    rect(0, 111, W, 18, '#07060f');
    rect(0, 111, W, 1, '#68386c'); rect(0, 128, W, 1, '#68386c');
    ring(56, 120, 9, Math.floor(t * 4) % 2 ? '#fee761' : '#ffffff');
    for (const n of this.notes) {
      if (n.done) continue;
      const x = this.noteX(n);
      if (x > W + 10) continue;
      disc(x, 120, 7, '#b55088');
      drawArrow(x, 120, n.dir, '#ffffff', 4);
    }
    // meters
    text('HYPNOSIS', 8, 136, '#f6a0c8', { font: F3 });
    rect(8, 143, 82, 6, '#07060f');
    rect(9, 144, Math.round(80 * Math.min(1, k)), 4, '#b55088');
    text('MISSES', 232, 136, '#ff8f7a', { font: F3 });
    for (let i = 0; i < 5; i++) spr(i < 5 - this.misses ? 'heart' : 'heartEmpty', 0, 232 + i * 9, 143);
    drawTouchPad(0);
  }
}

/* ---------------------------------------------------- wifi hacking */
class HackGame extends MiniGame {
  constructor(bowl, mode, u) {
    super(bowl, mode, u);
    this.id = 'hack';
    this.title = 'HACK THE WIFI';
    this.how = ['WATCH THE {LIGHTS}, THEN REPEAT THE PATTERN.', 'USE THE {ARROW KEYS} (OR TAP THE BUTTONS).', 'CRACK {4 PASSWORD LEVELS}. YOU HAVE {3 TRIES}.'];
    this.winText = 'ACCESS GRANTED';
    this.winSub = 'THE WIFI PASSWORD WAS {"PASSWORD123"}. HUMANS ARE SO EASY.';
    this.loseSub = 'ACCESS DENIED. EVEN A GENIUS FISH NEEDS PRACTICE. TRY AGAIN LATER!';
    this.music = null;
    this.pads = { up: [160, 50, '#e43b44', 523], right: [196, 84, '#0099db', 659], down: [160, 118, '#63c74d', 784], left: [124, 84, '#feae34', 440] };
    this.level = 0;
    this.lives = 3;
    this.seq = [];
    this.lit = null;
    this.code = [];
    for (let i = 0; i < 14; i++) this.code.push(this.codeLine());
  }
  codeLine() { let s = ''; for (let i = 0; i < 8; i++) s += '0123456789ABCDEF'[rndi(0, 15)] + (i % 2 ? ' ' : ''); return s; }
  start() {
    for (let i = 0; i < 3; i++) this.seq.push(pick(DIRS));
    this.show();
  }
  show() { this.state = 'show'; this.step = -1; this.stepT = 0.6; this.input = 0; }
  flash(d) { this.lit = { d, t: 0.3 }; Sound.tone(this.pads[d][3], 0.25, { type: 'p25', vol: 0.12 }); }
  play(dt, active) {
    if (this.lit) { this.lit.t -= dt; if (this.lit.t <= 0) this.lit = null; }
    if (Math.random() < dt * 6) { this.code.shift(); this.code.push(this.codeLine()); }
    if (this.state === 'show') {
      this.stepT -= dt;
      if (this.stepT <= 0) {
        this.step++;
        if (this.step >= this.seq.length) { this.state = 'input'; return; }
        this.flash(this.seq[this.step]);
        this.stepT = Math.max(0.35, 0.55 - this.level * 0.05);
      }
      return;
    }
    if (this.state === 'wait') { this.stepT -= dt; if (this.stepT <= 0) this.show(); return; }
    if (!active) return;
    let d = dirPressed();
    if (!d && Input.mhit) for (const k of DIRS) { const [x, y] = this.pads[k]; if (dist(Input.hitX, Input.hitY, x, y) < 16) d = k; }
    if (!d) return;
    this.flash(d);
    if (d !== this.seq[this.input]) {
      this.lives--;
      Sound.sfx('no');
      Game.shake(2, 0.2);
      this.floaters.add('WRONG!', 160, 84, '#ff8f7a', { font: F5 });
      if (this.lives <= 0) { this.end(false, this.level); return; }
      this.state = 'wait';
      this.stepT = 1;
      return;
    }
    this.input++;
    if (this.input >= this.seq.length) {
      this.level++;
      Sound.sfx('idea');
      this.floaters.add('LEVEL ' + this.level + ' CRACKED!', 160, 84, '#63c74d', { font: F5 });
      if (this.level >= 4) { this.end(true, this.level); return; }
      this.seq.push(pick(DIRS));
      this.state = 'wait';
      this.stepT = 1.1;
    }
  }
  drawGame() {
    const t = this.t;
    rect(0, 0, W, H, '#07130c');
    for (let y = 0; y < H; y += 2) rect(0, y, W, 1, '#0a1a10');
    let y = 8;
    for (const l of this.code) { text(l, 6, y, '#1f6a3a', { font: F3 }); y += 8; }
    for (let i = 0; i < this.code.length; i++) text(this.code[(i + 5) % this.code.length], 262, 8 + i * 8, '#1f6a3a', { font: F3 });
    // laptop screen
    panel(90, 20, 140, 132, { fill: '#0b1f14', border: '#63c74d' });
    text('WIFI: FISHNET_5G', 160, 26, '#63c74d', { align: 'center', font: F3 });
    let pw = '';
    for (let i = 0; i < 4; i++) pw += i < this.level ? '**' : '__';
    text('PASSWORD: ' + pw, 160, 130, '#b4f08c', { align: 'center' });
    for (const k of DIRS) {
      const [x, py, col] = this.pads[k];
      const on = this.lit && this.lit.d === k;
      disc(x, py, 15, '#07060f');
      disc(x, py, 14, on ? '#ffffff' : mix(col, '#07060f', 0.45));
      disc(x, py, 11, on ? col : mix(col, '#07060f', 0.25));
      drawArrow(x, py, k, on ? '#ffffff' : '#e8eef7', 4);
    }
    // the hacker fish in the middle
    sprC('hero1', Math.floor(t * 4) % 2, 160, 84);
    spr('glasses', 0, 161, 80);
    const msg = this.state === 'show' || this.state === 'wait' ? 'WATCH...' : 'YOUR TURN!';
    text(msg, 160, 141, this.state === 'input' ? '#fee761' : '#8b9bb4', { align: 'center', font: F3 });
    // tries and signal
    for (let i = 0; i < 3; i++) spr(i < this.lives ? 'heart' : 'heartEmpty', 0, 96 + i * 9, 36);
    for (let i = 0; i < 4; i++) rect(206 + i * 5, 44 - i * 3, 3, 4 + i * 3, i < this.level ? '#63c74d' : '#1f3a28');
  }
}

/* ------------------------------------------------------ snack heist */
class WalkGame extends MiniGame {
  constructor(bowl, mode, u) {
    super(bowl, mode, u);
    this.id = 'walk';
    this.title = 'SNACK HEIST';
    this.how = ['WALK YOUR BOWL ALL THE WAY TO THE {FRIDGE}!', 'PRESS {SPACE}, {UP} OR {TAP} TO JUMP OVER THE TOYS.', "GRAB THE {COOKIES}. DON'T SPILL ALL YOUR WATER!"];
    this.winText = 'SNACK HEIST!';
    this.winSub = 'YOU RAIDED THE FRIDGE. THE BOWL CAN WALK ANYWHERE NOW!';
    this.loseSub = 'YOU SPILLED YOUR WATER! SAM REFILLED THE BOWL. TRY AGAIN!';
    this.music = 'sea';
    this.goal = 1900;
    this.x = 0;
    this.vy = 0;
    this.y = 0;             // jump height (negative = up)
    this.water = 3;
    this.inv = 0;
    this.cookies = 0;
    this.things = [];
    let x = 320;
    const kinds = ['blocks', 'ball', 'car', 'shoe', 'cat', 'blocks2'];
    while (x < this.goal - 120) {
      const kind = pick(kinds);
      this.things.push({ kind, x, t: 0 });
      if (Math.random() < 0.7) this.things.push({ kind: 'cookie', x: x + rnd(40, 70), h: Math.random() < 0.5 ? 12 : 44 });
      x += rnd(115, 190);
    }
  }
  start() {}
  speed() { return 85 + (this.x / this.goal) * 40; }
  box(o) {
    switch (o.kind) {
      case 'blocks': return [0, 10, 11];
      case 'blocks2': return [0, 11, 20];
      case 'ball': return [0, 10, 10];
      case 'car': return [0, 16, 8];
      case 'shoe': return [0, 16, 7];
      case 'cat': return [0, 26, 11];
      default: return [0, 6, 6];
    }
  }
  play(dt, active) {
    const jumpHit = active && (hit('dash') || hit('up') || keyHit('KeyW') || Input.mhit);
    if (jumpHit && this.y >= 0) { this.vy = -255; Sound.tone(300, 0.12, { type: 'p25', vol: 0.1, slide: 2 }); }
    this.vy += 650 * dt;
    this.y = Math.min(0, this.y + this.vy * dt);
    if (this.y >= 0) this.vy = 0;
    this.inv = Math.max(0, this.inv - dt);
    const sp = this.speed();
    this.x += sp * dt;
    for (const o of this.things) {
      if (o.kind === 'car') o.x -= 25 * dt;
      o.t += dt;
      const sx = o.x - this.x + 70;
      if (o.gone || sx < 40 || sx > 110) continue;
      const feet = 150 + this.y;
      if (o.kind === 'cookie') {
        if (Math.abs(sx - 70) < 12 && Math.abs(feet - 20 - (150 - o.h)) < 16) {
          o.gone = true;
          this.cookies++;
          Sound.sfx('eat');
          this.floaters.add('+COOKIE', 70, feet - 40, '#fee761');
        }
        continue;
      }
      const [, w, h] = this.box(o);
      const bounce = o.kind === 'ball' ? Math.abs(Math.sin(o.t * 5)) * 6 : 0;
      const top = 150 - h - bounce;
      if (this.inv <= 0 && sx - w / 2 < 80 && sx + w / 2 > 60 && feet > top + 2) {
        this.water--;
        this.inv = 1.3;
        Sound.sfx('splash');
        Game.shake(3, 0.25);
        this.floaters.add('SPLASH!', 70, feet - 44, '#9fe8f5', { font: F5 });
        for (let i = 0; i < 14; i++) this.parts.add({ x: 70 + rnd(-8, 8), y: feet - 22, vx: rnd(-60, 60), vy: -rnd(40, 120), g: 400, life: 0.7, c: pick(['#9ff3fa', '#4fb8dc', '#ffffff']) });
        if (this.water <= 0) { this.end(false, this.cookies); return; }
      }
    }
    if (this.x >= this.goal) { this.x = this.goal; this.end(true, this.cookies); }
  }
  drawGame() {
    const t = this.t, cam = this.x;
    const k = cam / this.goal;
    // the house gets more kitchen-y as you go
    const wall = k < 0.4 ? '#6fa8c8' : k < 0.7 ? '#d8c89a' : '#e8eef7';
    rect(0, 0, W, 150, wall);
    for (let i = -1; i < 6; i++) {
      const wx = i * 80 - ((cam * 0.6) % 80);
      const zone = (cam * 0.6 + i * 80) / (this.goal * 0.6);
      if (zone < 0.4) { rect(wx + 20, 40, 30, 24, '#733e39'); rect(wx + 22, 42, 26, 20, '#2690c0'); rect(wx + 28, 52, 6, 3, '#f77622'); }
      else if (zone < 0.7) { rect(wx + 14, 50, 26, 100, '#b86f50'); rect(wx + 17, 54, 20, 40, '#a8603f'); disc(wx + 35, 100, 1.5, '#fee761'); }
      else { for (let y = 60; y < 110; y += 8) for (let x = 0; x < 80; x += 8) rect(wx + x, y, 7, 7, (x + y) % 16 ? '#c8e8f4' : '#9fd0e8'); }
    }
    rect(0, 128, W, 22, k < 0.7 ? '#5a8aa8' : '#c0cbdc');
    // floor
    rect(0, 150, W, 30, k < 0.7 ? '#b86f50' : '#8b9bb4');
    for (let x = -((cam) % 24); x < W; x += 24) rect(x, 150, 1, 30, k < 0.7 ? '#733e39' : '#5a6988');
    rect(0, 150, W, 2, k < 0.7 ? '#e4a672' : '#e8eef7');
    // the fridge at the end
    const fx = this.goal - cam + 110;
    if (fx < W + 40) {
      rect(fx, 40, 44, 110, '#e8eef7'); rect(fx, 40, 44, 2, '#ffffff'); rect(fx, 84, 44, 2, '#8b9bb4');
      rect(fx + 36, 54, 3, 20, '#8b9bb4'); rect(fx + 36, 94, 3, 30, '#8b9bb4');
      spr('hero0', 0, fx + 8, 50);
      if (this.phase === 'done' && this.won) { rect(fx - 30, 86, 30, 60, '#fff6c9'); disc(fx - 18, 110, 5, '#e43b44'); rect(fx - 26, 124, 16, 8, '#fee761'); }
    }
    // obstacles & cookies
    for (const o of this.things) {
      const sx = Math.round(o.x - cam + 70);
      if (o.gone || sx < -30 || sx > W + 30) continue;
      switch (o.kind) {
        case 'cookie': {
          const cy = 150 - o.h + Math.round(Math.sin(t * 4 + o.x) * 2);
          disc(sx, cy, 4, '#b86f50'); disc(sx, cy, 3, '#e4a672'); px(sx - 1, cy - 1, '#3e2731'); px(sx + 1, cy + 1, '#3e2731');
          break;
        }
        case 'blocks': rect(sx - 5, 139, 11, 11, '#e43b44'); rect(sx - 3, 141, 7, 7, '#ff8f7a'); text('A', sx - 2, 141, '#ffffff', { font: F3 }); break;
        case 'blocks2':
          rect(sx - 5, 139, 11, 11, '#0099db'); rect(sx - 5, 128, 11, 11, '#fee761'); rect(sx - 5, 139, 11, 1, '#124e89');
          text('B', sx - 2, 141, '#ffffff', { font: F3 }); text('C', sx - 2, 130, '#be4a2f', { font: F3 });
          break;
        case 'ball': { const by = 145 - Math.abs(Math.sin(o.t * 5)) * 6; disc(sx, by, 5, '#e43b44'); rect(sx - 5, by - 1, 11, 2, '#ffffff'); break; }
        case 'car': rect(sx - 8, 142, 16, 5, '#63c74d'); rect(sx - 4, 139, 8, 4, '#3e8948'); disc(sx - 5, 148, 2, '#181425'); disc(sx + 5, 148, 2, '#181425'); break;
        case 'shoe': rect(sx - 8, 144, 16, 6, '#3e2731'); rect(sx - 8, 143, 9, 2, '#733e39'); rect(sx - 8, 149, 16, 1, '#e8eef7'); break;
        case 'cat':
          ellipse(sx, 144, 13, 6, '#8b9bb4'); ellipse(sx - 10, 142, 5, 4, '#8b9bb4');
          rect(sx - 13, 137, 2, 3, '#8b9bb4'); rect(sx - 8, 137, 2, 3, '#8b9bb4');
          rect(sx - 12, 142, 2, 1, '#3e2731'); rect(sx - 8, 142, 2, 1, '#3e2731');
          text('Z', sx + 2, 128 - Math.floor(t * 2) % 3 * 2, '#c0cbdc', { font: F3 });
          break;
      }
    }
    // your walking bowl
    const feet = Math.round(150 + this.y);
    if (!(this.inv > 0 && Math.floor(this.inv * 10) % 2)) {
      const step = this.y < 0 ? 0 : Math.round(Math.sin(t * 16) * 2);
      for (const s of [-1, 1]) {
        const lx = 70 + s * 5, lift = Math.max(0, s * step);
        rect(lx - 1, feet - 10, 2, 10 - lift, '#5a6988');
        rect(lx - 3, feet - 2 - lift, 6, 2, '#3a4466');
      }
      const cy = feet - 20;
      const lvl = [cy + 11, cy + 2, cy - 3, cy - 6][this.water] || cy + 11;
      for (let y = lvl; y <= cy + 9; y++) { const hw = Math.floor(Math.sqrt(Math.max(0, 100 - (y - cy) * (y - cy)))); rect(70 - hw, y, hw * 2 + 1, 1, '#4fb8dc'); }
      sprC('hero1', Math.floor(t * 6) % 2, 71, cy + 1);
      ring(70, cy, 10, '#c8f4ff');
      rect(64, cy - 10, 13, 2, '#e8fbff');
    }
    // HUD
    panel(4, 4, 96, 24, { fill: '#141330', alpha: 0.9 });
    text('WATER', 9, 8, '#9fe8f5', { font: F3 });
    for (let i = 0; i < 3; i++) { disc(40 + i * 9, 10, 3, i < this.water ? '#2ce8f5' : '#3a4466'); px(39 + i * 9, 9, '#ffffff'); }
    text('COOKIES ' + this.cookies, 9, 18, '#fee761', { font: F3 });
    rect(110, 8, 200, 5, '#07060f');
    rect(111, 9, Math.round(198 * k), 3, '#f77622');
    text('FRIDGE', 306, 16, '#8b9bb4', { font: F3, align: 'right' });
    sprC('hero0', 0, 111 + Math.round(198 * k), 10);
  }
}

const MINI_GAMES = { stare: StareGame, hack: HackGame, walk: WalkGame };
const GAME_NAMES = { stare: 'STARING CONTEST', hack: 'HACK THE WIFI', walk: 'SNACK HEIST' };
