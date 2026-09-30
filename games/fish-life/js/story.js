'use strict';
/* =====================================================================
   FISH LIFE  -  story.js
   Chapter cards and cutscenes: the boat, the pet shop, the bag ride,
   your new home, and the night you decided to rule the world.
   ===================================================================== */

/* ------------------------------------------------------ chapter card */
class ChapterCard {
  constructor(num, title, sub, next) {
    this.num = num;
    this.title = title;
    this.sub = sub;
    this.nextFn = next;
    this.t = 0;
    this.done = false;
    this.parts = new Particles();
  }
  enter() { Sound.play(null); Sound.sfx('chapter'); }
  update(dt, active) {
    this.t += dt;
    if (Math.random() < dt * 10) this.parts.add({ type: 'bubble', x: rnd(0, W), y: H + 2, vy: -rnd(10, 30), life: 8, size: rndi(1, 3), c: '#1d73a0' });
    this.parts.update(dt);
    if (!this.done && (this.t > 4 || (active && this.t > 0.6 && (hit('ok') || Input.mhit)))) {
      this.done = true;
      Game.go(this.nextFn);
    }
  }
  draw() {
    rect(0, 0, W, H, '#07060f');
    drawChapterCard(this.num, this.title, this.sub, this.t, this.parts);
  }
}
function drawChapterCard(num, title, sub, t, parts) {
  rect(0, 0, W, H, '#07060f');
  if (parts) parts.draw();
  for (let x = 0; x < W; x++) {
    const y = 150 + Math.round(Math.sin(x * 0.07 + t * 2) * 2 + Math.sin(x * 0.03 - t) * 2);
    rect(x, y, 1, H - y, '#0e2a4a');
    px(x, y, '#2690c0');
    const y2 = 160 + Math.round(Math.sin(x * 0.05 - t * 1.6) * 2);
    rect(x, y2, 1, H - y2, '#0b1d38');
  }
  const k = easeOut(clamp(t / 0.6, 0, 1));
  text('CHAPTER ' + num, W / 2, Math.round(lerp(30, 48, k)), '#8b9bb4', { align: 'center' });
  if (t > 0.3) drawBig(title, W / 2, Math.round(lerp(90, 62, easeOut(clamp((t - 0.3) / 0.5, 0, 1)))), 'gold', 'center', 4);
  if (t > 1 && sub) {
    const n = Math.floor((t - 1) * 40);
    text(sub.slice(0, n), W / 2 - Math.floor(textW(sub) / 2), 112, '#9fe8f5');
  }
  const sw = Math.round(lerp(0, 140, k));
  rect(W / 2 - sw / 2, 58, sw, 1, '#3a4466');
}

/* ------------------------------------------------------------ scripts */
const STORIES = {
  caught: [
    { shot: 'card' },
    { wait: 3 },
    { shot: 'boat', music: null },
    { say: ['', 'THE NET DRAGGED YOU OUT OF THE SEA AND UP INTO THE BLINDING AIR.'] },
    { say: ['FISHERMAN', 'HAR HAR! LOOK AT THIS LITTLE ORANGE ONE. TOO SMALL TO EAT...'] },
    { say: ['FISHERMAN', '...BUT THE PET SHOP WILL PAY A FEW BUCKS FOR IT!'] },
    { shot: 'shopExt', music: 'shop' },
    { say: ['', 'THE NEXT MORNING YOU WOKE UP SOMEWHERE VERY STRANGE...'] },
    { shot: 'shop' },
    { say: ['', 'A PET SHOP. TANKS EVERYWHERE. A STICKER ON YOUR GLASS SAYS {$3}.'] },
    { say: ['YOU', '...THREE DOLLARS?! I AM WORTH AT LEAST FOUR.'] },
    { do: 'samEnters', wait: 2.6 },
    { say: ['SHOPKEEPER', 'WELCOME TO FINS & FRIENDS! LOOKING FOR A PET, KID?'] },
    { say: ['SAM', 'YEAH! I SAVED MY ALLOWANCE FOR A WHOLE MONTH!'] },
    { do: 'samLooks', wait: 1.8 },
    { do: 'samPoints', wait: 0.4 },
    { say: ['SAM', 'THAT ONE! THE ORANGE ONE! IT LOOKS SO... {SMART}.'] },
    { say: ['SHOPKEEPER', 'THAT ONE? IT IS JUST A REGULAR FISH, KID. $3.'] },
    { say: ['SAM', "I'LL TAKE IT!"] },
    { shot: 'bag' },
    { say: ['', 'YOU WERE SCOOPED INTO A PLASTIC BAG. HOW EMBARRASSING.'] },
    { say: ['YOU', 'I WILL REMEMBER THIS.'] },
    { shot: 'room', music: 'bowl' },
    { do: 'samWalksToDesk', wait: 2 },
    { do: 'pour', wait: 2.6 },
    { say: ['SAM', 'THIS IS YOUR NEW HOME! A REAL GLASS FISH BOWL!'] },
    { say: ['SAM', "I'M GOING TO NAME YOU..."] },
    { name: true },
    { say: ['SAM', '{NAME}! WELCOME HOME, {NAME}!'] },
    { say: ['SAM', 'I PROMISE TO FEED YOU {FIVE TIMES A DAY}. PINKY SWEAR!'] },
    { shot: 'night', music: 'night' },
    { say: ['', 'THAT NIGHT, WHILE SAM WAS FAST ASLEEP, YOU LOOKED AROUND.'] },
    { say: ['', 'A BOWL. A TABLE. A TV. A LAPTOP. A WHOLE WORLD FULL OF HUMANS.'] },
    { do: 'thunder', wait: 1.2 },
    { shot: 'closeup', music: null },
    { say: ['YOU', 'ONE DAY... I WILL RULE THIS WORLD.'] },
    { say: ['YOU', 'ALL OF IT. EVEN THE HUMANS.'] },
    { do: 'evil', wait: 1.6 },
    { end: 'bowl' },
  ],
};

// Shots where the action happens low on screen show dialogue at the top.
const DIALOG_TOP = { boat: true, shop: true, room: true, night: true, march: true, city: true, throne: true };

const FISH_NAMES = ['BUBBLES', 'FINN', 'GOLDIE', 'SPLASH', 'NUGGET', 'CAPTAIN', 'PICKLE', 'MR BLUB', 'SUNNY', 'NEMO JR', 'SQUISHY', 'BISCUIT', 'WALLY', 'TANGO'];

/* -------------------------------------------------------- story scene */
class StoryScene {
  constructor(id) {
    this.script = STORIES[id];
    this.i = -1;
    this.t = 0;
    this.shot = null;
    this.shotT = 0;
    this.dlg = new DialogBox();
    this.parts = new Particles();
    this.st = {};
    this.fade = null;
    this.waitT = 0;
    this.cache = {};
    this.naming = null;
    this.flash = 0;
    this.advance();
  }
  enter() { Sound.play(null); }

  advance() {
    this.i++;
    const s = this.script[this.i];
    this.cur = s;
    if (!s) return;
    if (s.shot) {
      if (!this.shot) { this.setShot(s); this.advance(); } else this.fade = { t: 0, shot: s };
    } else if (s.say) {
      this.dlg.say(s.say[0], s.say[1].split('{NAME}').join(GS.fishName));
    } else if (s.do) {
      this.action(s.do);
      this.waitT = s.wait || 0;
    } else if (s.wait) {
      this.waitT = s.wait;
    } else if (s.name) {
      this.naming = { name: '', t: 0, placeholder: pick(FISH_NAMES) };
      Game.typing = true;
    } else if (s.end) {
      this.finish();
    }
  }

  setShot(s) {
    this.shot = s.shot;
    this.shotT = 0;
    this.parts.list = [];
    if (s.music !== undefined) Sound.play(s.music);
    if (this.shot === 'shop') Object.assign(this.st, { samX: -20, samTarget: -20, samPose: 'stand', samFlip: false, walk: 0 });
    if (this.shot === 'room') Object.assign(this.st, { samX: 20, samTarget: 20, samPose: 'hold', water: 0, fishIn: false, pour: -1 });
    if (this.shot === 'boat') Sound.sfx('gull');
  }

  action(a) {
    const st = this.st;
    switch (a) {
      case 'samEnters': st.samTarget = 118; Sound.sfx('tick'); Sound.sfx('tick'); break;
      case 'samLooks': st.look = 0; break;
      case 'samPoints': st.look = -1; st.samPose = 'point'; st.samFlip = false; break;
      case 'samWalksToDesk': st.samTarget = 212; break;
      case 'pour': st.pour = 0; break;
      case 'thunder': this.flash = 0.5; Sound.sfx('thunder'); Game.shake(3, 0.6); break;
      case 'evil': st.evil = 0; Sound.sfx('sting'); break;
    }
  }

  finish() {
    GS.chapter = 'bowl';
    GS.bowl = null;
    saveGame();
    Game.go(() => new ChapterCard(3, 'THE BOWL', 'FIVE MEALS A DAY. UNLIMITED AMBITION.', () => new BowlScene()));
  }

  update(dt, active) {
    this.t += dt;
    this.shotT += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.dlg.update(dt);
    this.parts.update(dt);
    this.updateShot(dt);
    if (this.fade) {
      this.fade.t += dt;
      if (this.fade.t >= 0.4 && !this.fade.switched) { this.fade.switched = true; this.setShot(this.fade.shot); }
      if (this.fade.t >= 0.8) { this.fade = null; this.advance(); }
      return;
    }
    const s = this.cur;
    if (!s) return;
    // skip the whole cutscene
    if (active && hit('back') && !this.naming && !this.skipAsked) {
      this.skipAsked = true;
      this.finishSkip();
      return;
    }
    if (s.say) {
      if (active && (hit('ok') || Input.mhit)) {
        if (!this.dlg.done) this.dlg.skip();
        else { Sound.sfx('move'); this.advance(); }
      }
    } else if (s.do || s.wait) {
      this.waitT -= dt;
      if (this.waitT <= 0) this.advance();
    } else if (s.name && active) {
      this.updateNaming(dt);
    }
  }

  finishSkip() {
    if (!GS.fishName || GS.fishName === 'BUBBLES') GS.fishName = pick(FISH_NAMES);
    Game.typing = false;
    this.finish();
  }

  updateNaming(dt) {
    const n = this.naming;
    n.t += dt;
    for (const ch of Input.typed) {
      if (ch === '\b') n.name = n.name.slice(0, -1);
      else if (/^[a-zA-Z0-9 .!-]$/.test(ch) && n.name.length < 10) { n.name += ch.toUpperCase(); Sound.sfx('type'); }
    }
    if (keyHit('Tab')) { n.placeholder = pick(FISH_NAMES.filter(x => x !== n.placeholder)); n.name = ''; Sound.sfx('move'); }
    const okBtn = clicked(W / 2 + 6, 104, 56, 14), rndBtn = clicked(W / 2 - 62, 104, 56, 14);
    if (rndBtn) { n.placeholder = pick(FISH_NAMES.filter(x => x !== n.placeholder)); n.name = ''; Sound.sfx('move'); }
    if (keyHit('Enter') || keyHit('NumpadEnter') || okBtn) {
      GS.fishName = (n.name.trim() || n.placeholder).slice(0, 10);
      this.naming = null;
      Game.typing = false;
      Sound.sfx('ok');
      saveGame();
      this.advance();
    }
  }

  updateShot(dt) {
    const st = this.st;
    if (this.shot === 'shop' || this.shot === 'room') {
      if (Math.abs(st.samX - st.samTarget) > 0.5) {
        st.samX = approach(st.samX, st.samTarget, 42 * dt);
        st.walk += dt;
        st.samFlip = st.samTarget < st.samX;
      } else st.walk = 0;
      if (st.look !== undefined && st.look >= 0) { st.look += dt; st.samFlip = Math.floor(st.look * 2) % 2 === 1; }
    }
    if (this.shot === 'room' && st.pour >= 0) {
      const before = st.pour;
      st.pour += dt;
      if (st.pour > 0.6 && st.pour < 1.8 && Math.random() < 0.8) this.parts.add({ x: 236 + rnd(-1, 1), y: 92, vy: rnd(40, 70), g: 200, life: 0.3, c: pick(['#9ff3fa', '#4fb8dc', '#ffffff']) });
      st.water = clamp((st.pour - 0.6) / 1.2, 0, 1);
      if (before < 1.2 && st.pour >= 1.2) {
        st.fishIn = true;
        Sound.sfx('splash');
        for (let i = 0; i < 12; i++) this.parts.add({ x: 240 + rnd(-6, 6), y: 108, vx: rnd(-40, 40), vy: -rnd(30, 70), g: 250, life: 0.6, c: pick(['#9ff3fa', '#ffffff']) });
      }
      if (st.pour > 2) st.samPose = 'stand';
    }
    if (this.shot === 'boat') {
      if (Math.random() < dt * 8) this.parts.add({ x: 176 + rnd(-8, 8), y: 88 + rnd(0, 8), vy: rnd(10, 30), g: 200, life: 0.5, c: '#9fe8f5' });
    }
    if (this.shot === 'closeup' && st.evil !== undefined) st.evil += dt;
  }

  /* ----------------------------------------------------------- draw */
  draw() {
    const [sx, sy] = Game.shakeOffset();
    gfx.save();
    gfx.translate(sx, sy);
    this.drawShot();
    this.parts.draw();
    gfx.restore();
    if (this.flash > 0) ditherRect(0, 0, W, H, '#ffffff', this.flash * 2);
    if (this.cur && this.cur.say && !this.fade) this.dlg.draw(DIALOG_TOP[this.shot] ? 'top' : 'bottom');
    if (this.naming) this.drawNaming();
    if (this.fade) drawTransition(this.fade.t < 0.4 ? this.fade.t / 0.4 : 1 - (this.fade.t - 0.4) / 0.4, '#07060f');
    if (!this.naming && this.shot !== 'card') text('ESC: SKIP', W - 4, DIALOG_TOP[this.shot] ? H - 8 : 3, '#5a6988', { font: F3, align: 'right' });
  }

  drawShot() {
    switch (this.shot) {
      case 'card': drawChapterCard(2, 'CAUGHT!', 'EVERY FISH HAS A BAD DAY.', this.shotT, null); break;
      case 'boat': this.drawBoatShot(); break;
      case 'shopExt': this.drawShopExt(); break;
      case 'shop': this.drawShop(); break;
      case 'bag': this.drawBag(); break;
      case 'room': this.drawRoom(false); break;
      case 'night': this.drawRoom(true); break;
      case 'closeup': this.drawCloseup(); break;
    }
  }

  cached(key, w, h, paint) {
    if (!this.cache[key]) {
      const c = makeCanvas(w, h), prev = setTarget(c.getContext('2d'));
      paint();
      setTarget(prev);
      this.cache[key] = c;
    }
    return this.cache[key];
  }

  drawBoatShot() {
    const t = this.shotT;
    blit(this.cached('boatSky', W, 100, () => {
      paintGradient(gfx, 0, 0, W, 100, [[0, '#2d1b4e'], [0.35, '#74306f'], [0.6, '#d9586a'], [0.82, '#f9a857'], [1, '#fdeeb0']], 2.5);
    }), 0, 0);
    disc(70, 100, 22, '#fde69a');
    disc(70, 100, 17, '#fff1c1');
    blit(this.cached('boatSea', W, 80, () => {
      paintGradient(gfx, 0, 0, W, 80, [[0, '#2a4f8a'], [0.4, '#1b3a6b'], [1, '#0e1a3a']], 2.5);
    }), 0, 100);
    for (let i = 0; i < 18; i++) {
      const y = 102 + ((i * 7) % 76);
      const x = ((i * 53 + t * (8 + (i % 4) * 3)) % (W + 40)) - 20;
      rect(x, y, 6 + (i % 5) * 3, 1, i % 3 ? '#3a64a0' : '#5a82c0');
    }
    for (let i = 0; i < 10; i++) {
      const y = 102 + i * 3, w = 30 - i * 2 + Math.round(Math.sin(t * 3 + i) * 3);
      rect(70 - w / 2 + Math.sin(t * 2 + i * 1.3) * 3, y, w, 1, i % 2 ? '#f9a857' : '#fcd27a');
    }
    rect(0, 100, W, 1, '#fcd27a');
    // the boat, with the net full of fish hanging from its crane
    const bx = 200, by = 112;
    drawBoat(bx, by, t);
    const bob = Math.round(Math.sin(t * 1.6));
    const nx = bx - 24, ny = by - 12 + bob + 10;
    line(nx, by - 26 + bob, nx, ny - 12, '#c8b898');
    const fishes = [['minnow', -6, 2], ['guppy', 5, 6], ['hero2', 0, -2], ['minnow', 7, -4], ['guppy', -8, -5]];
    for (const [k, ox, oy] of fishes) sprC(k, Math.floor(t * 6 + ox) % 2, nx + ox + Math.sin(t * 7 + ox) * 1.5, ny + oy, Math.floor(t * 3 + oy) % 2 === 0);
    for (let y = -12; y <= 12; y++) for (let x = -14; x <= 14; x++) {
      const q = (x * x) / 196 + (y * y) / 144;
      if (q <= 1 && (q > 0.84 || (x + y + 40) % 4 === 0 || (x - y + 40) % 4 === 0)) px(nx + x, ny + y, '#e8dcc0');
    }
    // fisherman in a yellow raincoat
    const fx = bx + 6, fy = by - 8 + bob;
    rect(fx - 3, fy - 13, 7, 9, '#fee761'); rect(fx - 3, fy - 5, 7, 2, '#feae34');
    rect(fx - 2, fy - 18, 5, 5, '#e8b796'); rect(fx - 3, fy - 20, 7, 3, '#fee761'); rect(fx - 4, fy - 18, 9, 1, '#feae34');
    px(fx - 1, fy - 16, '#181425'); rect(fx - 2, fy - 14, 5, 1, '#8b9bb4');
    rect(fx - 6, fy - 12, 3, 2, '#fee761');
    // gulls
    for (let i = 0; i < 3; i++) spr('gull', Math.floor(t * 5 + i) % 2, 150 + Math.sin(t * 0.7 + i * 2) * 60, 30 + i * 12 + Math.sin(t + i) * 4, Math.cos(t * 0.7 + i * 2) < 0);
  }

  drawShopExt() {
    const t = this.shotT;
    blit(this.cached('street', W, H, () => {
      paintGradient(gfx, 0, 0, W, 120, [[0, '#6fbcef'], [0.6, '#a8dcf6'], [1, '#d4f1fb']], 2.5);
      const bld = [[0, 30, 64, '#8b9bb4'], [56, 52, 50, '#6d7fa0'], [236, 20, 50, '#8b9bb4'], [280, 44, 50, '#6d7fa0']];
      for (const [x, y, w, c] of bld) {
        rect(x, y, w, 130 - y, c);
        for (let wy = y + 6; wy < 124; wy += 10) for (let wx = x + 5; wx < x + w - 6; wx += 10) rect(wx, wy, 5, 6, (wx + wy) % 3 ? '#c8f4ff' : '#fee761');
      }
      // pet shop building
      rect(84, 40, 152, 112, '#a84a3a');
      for (let y = 40; y < 152; y += 4) for (let x = 84 + ((y / 4) % 2) * 4; x < 236; x += 8) rect(x, y, 7, 3, '#b85a48');
      rect(84, 40, 152, 3, '#733e39');
      // sign
      rect(96, 46, 128, 26, '#262b44'); rect(98, 48, 124, 22, '#124e89');
      // awning
      for (let x = 88; x < 232; x += 8) { rect(x, 80, 4, 10, '#e43b44'); rect(x + 4, 80, 4, 10, '#ffffff'); }
      for (let x = 88; x < 232; x += 8) { px(x + 1, 90, '#e43b44'); px(x + 5, 90, '#ffffff'); rect(x, 90, 4, 1, '#a22633'); }
      // window
      rect(94, 96, 82, 46, '#3a4466'); rect(96, 98, 78, 42, '#2690c0');
      for (let i = 0; i < 3; i++) { rect(100 + i * 25, 104, 20, 14, '#48c3dd'); rect(100 + i * 25, 114, 20, 4, '#b09468'); }
      for (let i = 0; i < 3; i++) { rect(100 + i * 25, 122, 20, 14, '#48c3dd'); rect(100 + i * 25, 132, 20, 4, '#b09468'); }
      rect(96, 98, 78, 2, '#c8f4ff');
      line(100, 100, 120, 120, 'rgba(255,255,255,0.3)');
      // door
      rect(186, 98, 38, 54, '#3e2731'); rect(189, 101, 32, 51, '#733e39'); rect(193, 105, 24, 18, '#9fe8f5'); disc(216, 128, 1.5, '#fee761');
      // sidewalk & street
      rect(0, 150, W, 6, '#c0cbdc'); rect(0, 156, W, 2, '#8b9bb4');
      rect(0, 158, W, 22, '#3a4466');
      for (let x = 0; x < W; x += 24) rect(x, 168, 12, 2, '#fee761');
      // lamp post
      rect(52, 96, 2, 54, '#262b44'); rect(47, 92, 12, 4, '#262b44'); rect(49, 96, 8, 2, '#fee761');
    }), 0, 0);
    drawBig('PET SHOP', 160, 49, 'aqua');
    // fish swimming in the window tanks
    for (let i = 0; i < 6; i++) {
      const tx = 100 + (i % 3) * 25, ty = 107 + Math.floor(i / 3) * 18;
      const fx = tx + 10 + Math.sin(t * 1.3 + i * 2) * 6;
      sprC(['goldfish', 'bluefish', 'guppy'][i % 3], Math.floor(t * 4 + i) % 2, fx, ty + 2, Math.cos(t * 1.3 + i * 2) < 0);
    }
    // clouds
    for (let i = 0; i < 3; i++) {
      const x = ((i * 120 + t * 6) % (W + 60)) - 40;
      disc(x + 10, 16 + i * 8, 5, '#ffffff'); disc(x + 18, 14 + i * 8, 6, '#ffffff'); rect(x + 4, 17 + i * 8, 26, 5, '#ffffff');
    }
    // a pigeon on the sidewalk
    const px0 = 130 + Math.round(Math.sin(t * 0.5) * 10);
    rect(px0, 146, 5, 3, '#8b9bb4'); rect(px0 + 4, 144, 2, 2, '#5a6988'); px(px0 + 6, 145, '#feae34'); px(px0 + 1, 149, '#feae34'); px(px0 + 3, 149, '#feae34');
  }

  drawShop() {
    const t = this.shotT, st = this.st;
    blit(this.cached('shop', W, H, () => {
      rect(0, 0, W, H, '#e8d8b0');
      for (let x = 0; x < W; x += 12) rect(x, 0, 6, 150, '#e0cca0');
      rect(0, 118, W, 32, '#b86f50'); rect(0, 118, W, 2, '#733e39');
      // floor tiles
      for (let y = 150; y < H; y += 6) for (let x = 0; x < W; x += 12) rect(x + ((y - 150) / 6 % 2) * 6, y, 6, 6, '#c0cbdc');
      rect(0, 150, W, 1, '#8b9bb4');
      for (let y = 150; y < H; y += 6) for (let x = 0; x < W; x += 12) rect(x + (1 - (y - 150) / 6 % 2) * 6, y, 6, 6, '#e8eef7');
      // shelves full of tanks
      for (const sy of [44, 86]) {
        rect(28, sy + 22, 190, 4, '#733e39'); rect(28, sy + 26, 190, 1, '#3e2731');
        for (let i = 0; i < 6; i++) {
          const x = 32 + i * 31;
          rect(x, sy, 28, 22, '#3a4466');
          rect(x + 1, sy + 1, 26, 20, '#48c3dd');
          rect(x + 1, sy + 1, 26, 3, '#9ff3fa');
          rect(x + 1, sy + 17, 26, 4, '#b09468');
          rect(x + 3 + (i % 3) * 6, sy + 10, 1, 7, '#3e8948'); rect(x + 2 + (i % 3) * 6, sy + 12, 3, 2, '#63c74d');
        }
      }
      // sign
      rect(232, 16, 76, 30, '#3e2731'); rect(234, 18, 72, 26, '#fee761');
      // counter
      rect(226, 116, 94, 44, '#733e39'); rect(226, 116, 94, 4, '#b86f50'); rect(226, 120, 94, 1, '#3e2731');
      for (let x = 232; x < 316; x += 14) rect(x, 124, 10, 30, '#8a4a38');
      // cash register
      rect(292, 100, 22, 16, '#5a6988'); rect(294, 102, 18, 6, '#63c74d'); rect(292, 96, 12, 4, '#3a4466');
      for (let i = 0; i < 3; i++) rect(295 + i * 6, 110, 4, 2, '#c0cbdc');
      // door
      rect(0, 70, 22, 80, '#3e2731'); rect(0, 72, 20, 78, '#733e39'); rect(3, 78, 14, 24, '#9fe8f5'); disc(16, 112, 1.5, '#fee761');
      // your tank on a little stand
      rect(118, 132, 44, 18, '#5a3a2e'); rect(120, 134, 40, 16, '#733e39');
      rect(114, 102, 52, 30, '#3a4466'); rect(116, 104, 48, 26, '#48c3dd'); rect(116, 104, 48, 4, '#9ff3fa'); rect(116, 125, 48, 5, '#c28569');
      for (let i = 0; i < 12; i++) px(118 + i * 4, 126 + (i % 2), '#feae34');
    }), 0, 0);
    text('FINS &', 270, 22, '#3e2731', { align: 'center' });
    text('FRIENDS', 270, 33, '#be4a2f', { align: 'center' });
    // little fish in the shelf tanks
    for (let s = 0; s < 2; s++) for (let i = 0; i < 6; i++) {
      const x = 32 + i * 31, y = [44, 86][s];
      const fx = x + 14 + Math.sin(t * (1 + i * 0.13) + i + s * 3) * 8;
      sprC(['goldfish', 'bluefish', 'guppy', 'minnow', 'bluefish', 'guppy'][(i + s * 2) % 6], Math.floor(t * 4 + i) % 2, fx, y + 11 + Math.sin(t + i) * 2, Math.cos(t * (1 + i * 0.13) + i + s * 3) < 0);
      if (Math.floor(t * 3 + i * 7 + s * 5) % 9 === 0) px(x + 22, y + 5 + Math.floor(t * 20) % 10, '#ffffff');
    }
    // YOU, in your tank
    const hx = 140 + Math.sin(t * 0.8) * 12;
    sprC('hero2', Math.floor(t * 4) % 2, hx, 114 + Math.round(Math.sin(t * 1.3) * 2), Math.cos(t * 0.8) < 0);
    // price tag
    const swing = Math.round(Math.sin(t * 2) * 1);
    line(158, 104, 161 + swing, 110, '#3e2731');
    rect(156 + swing, 110, 14, 9, '#fee761'); rect(156 + swing, 110, 14, 1, '#feae34');
    text('$3', 158 + swing, 111, '#a22633');
    drawShopkeeper(270, 86 + 8, t);
    rect(226, 116, 94, 4, '#b86f50');
    // Sam
    const walking = Math.abs(st.samX - st.samTarget) > 0.5;
    if (st.samX > -15) drawSam(Math.round(st.samX), 162, walking ? 'walk' : st.samPose, Math.floor(st.walk * 6), st.samFlip);
    if (st.samPose === 'point') { const k = Math.floor(t * 3) % 2; text('!', Math.round(st.samX) + 2, 124 - k, '#fee761', { outline: '#3e2731' }); }
  }

  drawBag() {
    const t = this.shotT;
    blit(this.cached('bagSky', W, H, () => paintGradient(gfx, 0, 0, W, H, [[0, '#6fbcef'], [1, '#d4f1fb']], 2.5)), 0, 0);
    for (let layer = 0; layer < 2; layer++) {
      const speed = layer ? 60 : 25, col = layer ? '#5a6988' : '#8b9bb4', base = layer ? 150 : 130;
      for (let i = 0; i < 10; i++) {
        const w = 26 + ((i * 37) % 30), h = 30 + ((i * 53) % 50) + layer * 10;
        const x = ((i * 60 - t * speed) % 600 + 600) % 600 - 60;
        rect(x, base - h, w, h + 40, col);
        for (let wy = base - h + 5; wy < base; wy += 9) for (let wx = x + 4; wx < x + w - 5; wx += 8) rect(wx, wy, 4, 5, layer ? '#3a4466' : '#a8b8d0');
      }
    }
    rect(0, 150, W, 30, '#3a4466');
    for (let x = 0; x < W + 30; x += 30) rect(((x - t * 90) % (W + 30) + W + 30) % (W + 30) - 30, 164, 16, 2, '#fee761');
    // arm from the top, holding the bag knot
    const swing = Math.sin(t * 2.4) * 6;
    const kx = 160 + Math.round(swing * 0.3), ky = 36;
    rect(kx - 4, 0, 9, ky - 6, '#e8b796'); rect(kx - 5, 0, 11, 10, '#e43b44');
    rect(kx - 6, ky - 8, 13, 7, '#e8b796'); rect(kx - 6, ky - 2, 13, 1, '#c28569');
    // bag
    const bx = 160 + Math.round(swing), by = 44;
    const bagTop = by, bagH = 60;
    for (let y = 0; y < bagH; y++) {
      const k = y / bagH;
      const hw = Math.round(8 + Math.sin(Math.min(1, k * 1.6) * Math.PI / 2) * 22);
      const cx = Math.round(lerp(kx, bx, Math.min(1, k * 2)));
      const surf = 22 + Math.round(Math.sin(t * 2.4 + 1) * 3 * ((y - 22) / 40));
      if (y > surf || y > 22 + (cx - bx) * 0) gfx.globalAlpha = y > 22 + Math.round(Math.sin(t * 2.4 + 1.2) * 2) ? 0.75 : 0.25;
      else gfx.globalAlpha = 0.25;
      rect(cx - hw, bagTop + y, hw * 2 + 1, 1, y > 22 ? '#4fb8dc' : '#d8f4ff');
      gfx.globalAlpha = 1;
      px(cx - hw, bagTop + y, '#e8fbff'); px(cx + hw, bagTop + y, '#c8e8f4');
    }
    rect(kx - 3, ky - 2, 7, 6, '#d8f4ff');
    rect(bx - 22, bagTop + bagH - 1, 45, 1, '#c8e8f4');
    line(bx - 14, bagTop + 26, bx - 18, bagTop + 44, '#ffffff');
    sprC('hero2', Math.floor(t * 3) % 2, bx + Math.sin(t * 1.5) * 6, bagTop + 42, Math.sin(t * 2.4) > 0);
    if (Math.floor(t * 2) % 2) text('...', bx + 18, bagTop + 26, '#ffffff', { outline: '#07060f' });
  }

  drawRoomBg(night) {
    return this.cached(night ? 'roomN' : 'room', W, H, () => {
      rect(0, 0, W, H, '#8fb8e0');
      for (let y = 6; y < 150; y += 16) for (let x = (y / 16) % 2 ? 8 : 0; x < W; x += 16) { px(x, y, '#a8cdf0'); px(x + 1, y, '#a8cdf0'); px(x, y + 1, '#a8cdf0'); }
      rect(0, 146, W, 4, '#e8eef7');
      for (let y = 150; y < H; y += 5) { rect(0, y, W, 5, y % 10 ? '#b86f50' : '#a8603f'); for (let x = (y * 7) % 40; x < W; x += 40) rect(x, y, 1, 5, '#733e39'); }
      // window
      rect(28, 24, 64, 60, '#e8eef7');
      if (night) paintGradient(gfx, 31, 27, 58, 54, [[0, '#0e0a24'], [1, '#2d1b4e']], 2);
      else paintGradient(gfx, 31, 27, 58, 54, [[0, '#74306f'], [0.5, '#f07d5a'], [1, '#fcd27a']], 2);
      rect(59, 27, 2, 54, '#e8eef7'); rect(31, 53, 58, 2, '#e8eef7');
      rect(22, 20, 10, 70, '#e43b44'); rect(88, 20, 10, 70, '#e43b44');
      for (let y = 20; y < 90; y += 4) { px(24, y, '#a22633'); px(94, y, '#a22633'); }
      rect(18, 18, 84, 3, '#733e39');
      // poster
      rect(120, 34, 36, 44, '#fee761'); rect(122, 36, 32, 40, '#0099db');
      // bed
      rect(0, 118, 84, 32, '#733e39'); rect(0, 112, 80, 14, '#e43b44'); rect(0, 112, 80, 3, '#ff7a7a');
      rect(56, 104, 22, 10, '#ffffff'); rect(0, 96, 6, 54, '#733e39');
      // desk
      rect(176, 124, 124, 6, '#b86f50'); rect(176, 130, 124, 3, '#733e39');
      rect(182, 133, 6, 17, '#733e39'); rect(288, 133, 6, 17, '#733e39');
      rect(262, 96, 26, 28, '#262b44'); rect(264, 98, 22, 16, night ? '#0b1330' : '#124e89');
      rect(270, 118, 10, 6, '#262b44');
      // lamp
      rect(186, 104, 2, 20, '#5a6988'); rect(180, 98, 14, 7, '#fee761'); rect(183, 122, 8, 2, '#5a6988');
      // wall clock and a shelf of toys
      disc(186, 44, 8, '#3e2731'); disc(186, 44, 7, '#ffffff'); line(186, 44, 186, 39, '#181425'); line(186, 44, 190, 45, '#e43b44');
      rect(208, 64, 64, 3, '#733e39'); rect(212, 67, 2, 4, '#733e39'); rect(266, 67, 2, 4, '#733e39');
      rect(212, 54, 8, 10, '#8b9bb4'); rect(213, 51, 6, 4, '#c0cbdc'); px(214, 52, '#e43b44'); px(217, 52, '#e43b44');
      disc(230, 60, 4, '#0099db'); ring(230, 60, 4, '#124e89'); rect(227, 59, 7, 1, '#63c74d');
      rect(242, 50, 6, 14, '#e43b44'); rect(248, 53, 5, 11, '#fee761'); rect(253, 48, 6, 16, '#3e8948'); rect(259, 55, 5, 9, '#b55088');
      // glow-in-the-dark stars
      for (const [sx, sy] of [[110, 12], [140, 20], [170, 8], [230, 24], [290, 14], [260, 36]]) { px(sx, sy, '#fee761'); px(sx - 1, sy, '#fee761'); px(sx + 1, sy, '#fee761'); px(sx, sy - 1, '#fee761'); px(sx, sy + 1, '#fee761'); }
      // desk chair
      rect(222, 108, 16, 4, '#e43b44'); rect(236, 96, 3, 16, '#a22633'); rect(228, 112, 2, 26, '#3a4466'); rect(222, 137, 14, 2, '#3a4466');
      // round rug, toy box and a bean bag on the floor
      ellipse(140, 164, 40, 7, '#b55088'); ellipse(140, 164, 32, 5, '#f6757a'); ellipse(140, 164, 18, 3, '#fee761');
      rect(94, 130, 26, 20, '#124e89'); rect(94, 130, 26, 3, '#0099db'); rect(104, 138, 6, 4, '#fee761');
      rect(116, 124, 3, 7, '#e43b44'); disc(99, 128, 3, '#63c74d');
      ellipse(158, 144, 13, 8, '#63c74d'); ellipse(156, 141, 9, 5, '#8fdc6a'); rect(146, 150, 25, 1, '#3e8948');
    });
  }

  drawRoom(night) {
    const t = this.shotT, st = this.st;
    blit(this.drawRoomBg(night), 0, 0);
    // poster fish
    sprC('hero1', Math.floor(t * 2) % 2, 138, 56);
    text('FISH', 138, 66, '#ffffff', { font: F3, align: 'center' });
    if (night) {
      for (let i = 0; i < 9; i++) if (Math.sin(t * 2 + i * 3) > -0.5) px(34 + ((i * 17) % 52), 30 + ((i * 11) % 20), '#ffffff');
      disc(76, 38, 5, '#fff6c9'); disc(78, 36, 4, '#2d1b4e');
    }
    // the bowl
    const water = night ? 1 : st.water || 0;
    this.drawBowl(240, 124, water, night || st.fishIn, t);
    // Sam
    if (!night) {
      const walking = Math.abs(st.samX - st.samTarget) > 0.5;
      const pose = walking ? 'walk' : st.samPose;
      drawSam(Math.round(st.samX), 162, pose, Math.floor(st.walk * 6), st.samFlip);
      if (st.samPose === 'hold' && st.pour < 2) {
        const pouring = st.pour >= 0 && st.pour < 2;
        const bx = pouring ? 232 : Math.round(st.samX) + 8, by = pouring ? 80 : 140;
        rect(bx, by, 9, 11, '#d8f4ff'); rect(bx + 1, by + 5, 7, 6, pouring && st.pour > 0.8 ? '#d8f4ff' : '#4fb8dc'); rect(bx + 3, by - 2, 3, 2, '#c8e8f4');
        if (!st.fishIn) px(bx + 4, by + 7, '#f77622');
        if (pouring) { rect(Math.round(st.samX) + 8, 150 - 30, 2, 2, '#e8b796'); }
      }
    } else {
      // Sam asleep in bed
      rect(58, 104, 14, 10, '#e8b796'); rect(56, 102, 18, 4, '#733e39');
      rect(8, 110, 60, 8, '#ff7a7a');
      const z = Math.floor(t * 1.5) % 3;
      text('Z', 76 + z * 3, 96 - z * 6, '#c0cbdc', { font: F3 });
      gfx.globalAlpha = 0.62;
      rect(0, 0, W, H, '#0b0a24');
      // moonlight falling through the window
      gfx.globalAlpha = 0.1;
      for (let y = 84; y < 150; y++) rect(30 + (y - 84) * 0.9, y, 60, 1, '#c8e0ff');
      gfx.globalAlpha = 1;
      // the fish, awake, eyes glowing a little
      this.drawBowl(240, 124, 1, true, t, true);
      if (this.flash > 0) {
        line(60, 27, 52, 40, '#ffffff'); line(52, 40, 58, 44, '#ffffff'); line(58, 44, 48, 62, '#ffffff');
      }
    }
  }

  drawBowl(cx, by, water, fish, t, glow) {
    const r = 18, cy = by - 16;
    if (water > 0) {
      const top = Math.round(lerp(by - 2, cy - 11, water));
      for (let y = top; y <= by - 1; y++) {
        const dy = y - cy, hw = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy))) - 1;
        rect(cx - hw, y, hw * 2 + 1, 1, y === top ? '#9ff3fa' : '#4fb8dc');
      }
    }
    rect(cx - 9, by - 4, 19, 3, '#c28569');
    for (let i = 0; i < 6; i++) px(cx - 8 + i * 3, by - 4, '#feae34');
    if (fish) {
      const fx = cx + Math.sin(t * 1.2) * 7, fy = cy + 1 + Math.sin(t * 2) * 2;
      sprC('hero1', Math.floor(t * 4) % 2, fx, fy, Math.cos(t * 1.2) < 0);
      if (glow && Math.sin(t * 3) > 0) px(fx + (Math.cos(t * 1.2) < 0 ? -3 : 3), fy - 2, '#fee761');
    }
    ring(cx, cy, r, '#c8f4ff');
    rect(cx - 12, cy - r + 3, 25, 2, '#e8fbff');
    rect(cx - 11, cy - r + 1, 23, 2, '#8fb8e0');
    px(cx - 11, cy - 7, '#ffffff'); px(cx - 12, cy - 5, '#ffffff'); px(cx - 12, cy - 4, '#ffffff');
  }

  drawCloseup() {
    const t = this.shotT, st = this.st;
    rect(0, 0, W, H, '#0b0a1f');
    for (let r = 120; r > 40; r -= 16) {
      for (let dy = -r; dy <= r; dy++) {
        const hw = Math.floor(Math.sqrt(r * r - dy * dy));
        ditherRect(160 - hw, 90 + dy, hw * 2, 1, '#1b1238', 0.2);
      }
    }
    // bowl glass curves
    for (let a = -1.2; a < 1.2; a += 0.01) px(160 + Math.sin(a) * 150, 90 - Math.cos(a) * 110 + 30, '#2d3a66');
    // a big close-up fish face, lit from below
    const bob = Math.round(Math.sin(t * 1.5) * 2);
    const fx = 150, fy = 80 + bob;
    for (let i = -6; i <= 6; i++) {
      const a = i * 0.13;
      thickLine(fx - 70, fy + 4, fx - 118, fy + 4 + Math.tan(a) * 60 + Math.sin(t * 3 + i * 0.5) * 2, 2.5, i % 2 ? '#e8641c' : '#be4a2f');
    }
    for (let i = 0; i < 9; i++) thickLine(fx - 30 + i * 8, fy - 40, fx - 44 + i * 9, fy - 62 + Math.abs(i - 4) * 3, 2, i % 2 ? '#be4a2f' : '#e8641c');
    ellipse(fx, fy, 82, 50, '#3e2731');
    ellipse(fx, fy, 80, 48, '#e8641c');
    ellipse(fx + 4, fy - 6, 72, 36, '#f77622');
    ellipse(fx + 10, fy + 24, 60, 18, '#feae34');
    ellipse(fx + 14, fy + 30, 46, 12, '#fee761');
    for (let i = 0; i < 3; i++) for (let a = -1; a < 1; a += 0.02) px(fx - 30 + i * 6 + Math.cos(a) * 20, fy + Math.sin(a) * 30, '#be4a2f');
    // the eye - narrowed, scheming
    const ex = fx + 40, ey = fy - 12;
    disc(ex, ey, 17, '#3e2731');
    disc(ex, ey, 16, '#ffffff');
    const lookX = Math.round(Math.sin(t * 0.8) * 3);
    disc(ex + 4 + lookX, ey + 3, 9, '#181425');
    disc(ex + 2 + lookX, ey, 3, '#ffffff');
    px(ex + 8 + lookX, ey + 7, '#8b9bb4');
    const lid = st.evil !== undefined ? clamp(st.evil * 2, 0, 1) : 0.35;
    const lidY = Math.round(ey - 16 + lid * 14);
    for (let y = ey - 18; y <= lidY; y++) {
      const dy = y - ey, hw = Math.floor(Math.sqrt(Math.max(0, 17 * 17 - dy * dy)));
      rect(ex - hw, y, hw * 2 + 1, 1, '#e8641c');
    }
    thickLine(ex - 17, lidY - 4, ex + 17, lidY + Math.round(1 - lid * 5), 1, '#3e2731');
    // smirk
    const mx = fx + 72, my = fy + 14;
    line(mx - 12, my + 2, mx, my - (st.evil !== undefined ? 3 : 0), '#3e2731');
    line(mx - 12, my + 3, mx, my - (st.evil !== undefined ? 2 : 1), '#3e2731');
    // tiny bubbles
    if (Math.random() < 0.08) this.parts.add({ type: 'bubble', x: mx + 4, y: my - 4, vy: -rnd(10, 20), life: 3, size: rndi(1, 3), c: '#9fe8f5' });
    if (st.evil !== undefined) {
      gfx.globalAlpha = clamp(st.evil, 0, 1) * 0.25;
      rect(0, 0, W, H, '#a22633');
      gfx.globalAlpha = 1;
    }
  }

  drawNaming() {
    const n = this.naming;
    gfx.globalAlpha = 0.5;
    rect(0, 0, W, H, '#07060f');
    gfx.globalAlpha = 1;
    panel(60, 44, 200, 80, { fill: '#141330' });
    text('WHAT DOES SAM NAME YOU?', W / 2, 52, '#fee761', { align: 'center' });
    rect(92, 66, 136, 17, '#07060f');
    rect(93, 67, 134, 15, '#262b44');
    const shown = n.name || n.placeholder;
    text(shown, W / 2, 71, n.name ? '#ffffff' : '#8b9bb4', { align: 'center' });
    if (Math.floor(n.t * 3) % 2 === 0) rect(W / 2 + Math.ceil(textW(shown) / 2) + 2, 70, 1, 8, '#fee761');
    text('TYPE A NAME, OR KEEP THE GREY ONE', W / 2, 89, '#8b9bb4', { align: 'center', font: F3 });
    panel(W / 2 - 62, 102, 56, 16, { fill: '#3a4466' });
    text('RANDOM', W / 2 - 34, 107, '#ffffff', { align: 'center' });
    panel(W / 2 + 6, 102, 56, 16, { fill: '#3e8948' });
    text('OK', W / 2 + 34, 107, '#ffffff', { align: 'center' });
    text('TAB = RANDOM   ENTER = OK', W / 2, 128, '#c0cbdc', { align: 'center', font: F3, outline: '#07060f' });
  }
}
