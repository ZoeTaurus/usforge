'use strict';
/* =====================================================================
   FISH LIFE  -  apartment.js
   Explore Sam's apartment! Play as the hypnotized cat (jump on the
   furniture, knock cups off the counter, raid the fridge, use Sam's
   computer to order things online) or walk around in your fish bowl
   on robot legs. Packages arrive at the front door.
   ===================================================================== */

const APT_W = 1120, APT_GROUND = 156;

// Everything is paid for with SAM'S credit card. No limit. What could go wrong?
const SHOP_ITEMS = [
  { id: 'pizza', name: 'PIZZA', usd: 18, consumable: true, desc: 'A WHOLE PIZZA. FOR A FISH. FILLS UP YOUR ENERGY.' },
  { id: 'drink', name: 'ENERGY DRINK', usd: 4, consumable: true, desc: 'FISH-SAFE. PROBABLY. ENERGY TO THE MAX!' },
  { id: 'cake', name: 'PARTY CAKE', usd: 35, consumable: true, desc: 'A CAKE THAT SAYS "HAPPY BIRTHDAY SAM". IT IS NOT HIS BIRTHDAY.' },
  { id: 'fireworks', name: 'FIREWORKS', usd: 250, consumable: true, desc: 'A FIREWORKS SHOW IN THE LIVING ROOM. WHAT COULD GO WRONG?' },
  { id: 'hat', name: 'PARTY HAT', usd: 12, desc: 'EVERY DAY IS A PARTY WHEN YOU ARE A GENIUS.' },
  { id: 'shades', name: 'SUNGLASSES', usd: 25, desc: 'SO COOL. WAY BETTER THAN READING GLASSES.' },
  { id: 'stache', name: 'FAKE MOUSTACHE', usd: 9, desc: 'A DISTINGUISHED MOUSTACHE FOR A DISTINGUISHED FISH.' },
  { id: 'crown', name: 'GOLDEN CROWN', usd: 5000, desc: 'REAL GOLD. PRACTICE FOR WHEN YOU RULE THE WORLD.' },
  { id: 'ship', name: 'PIRATE SHIP', usd: 40, desc: 'A SUNKEN PIRATE SHIP FOR YOUR BOWL. ARRR!' },
  { id: 'treasure', name: 'TREASURE CHEST', usd: 60, desc: 'IT OPENS AND LETS OUT BUBBLES. SO FANCY.' },
  { id: 'plants', name: 'WATER PLANTS', usd: 30, desc: 'A LITTLE UNDERWATER JUNGLE FOR YOUR BOWL.' },
  { id: 'goldrim', name: 'GOLD-PLATED BOWL', usd: 2500, desc: 'YOUR BOWL, BUT GOLD. YOU DESERVE IT.' },
  { id: 'flakes', name: 'DELUXE FLAKES', usd: 80, desc: 'GOLDEN GOURMET FLAKES. EVERY FLAKE IS WORTH 50% MORE IQ.' },
  { id: 'bubbles', name: 'BUBBLE MACHINE', usd: 300, desc: 'MORE BUBBLES, MORE BRAIN POWER. IDEAS POP UP 40% FASTER.' },
  { id: 'lava', name: 'LAVA LAMP', usd: 45, desc: 'GROOVY BLOBS OF LIGHT FOR THE TABLE.' },
  { id: 'disco', name: 'DISCO BALL', usd: 150, desc: 'SPARKLY LIGHTS FOR THE LIVING ROOM. FISH CAN DANCE!' },
  { id: 'trampoline', name: 'TRAMPOLINE', usd: 400, desc: 'FOR THE HALLWAY. JUMP ON IT TO FLY SUPER HIGH!' },
  { id: 'jetpack', name: 'JETPACK', usd: 9999, desc: 'LETS YOU JUMP AGAIN IN THE AIR. DEFINITELY NOT A TOY.' },
  { id: 'skateboard', name: 'SKATEBOARD', usd: 120, desc: 'YOUR BOWL AND THE CAT ZOOM AROUND MUCH FASTER.' },
  { id: 'vacuum', name: 'ROBOT VACUUM', usd: 700, desc: 'IT CLEANS THE LIVING ROOM. THE CAT CAN RIDE ON IT!' },
];
const STORE_ROWS = 8;
const usd = n => '$' + (n >= 10000 ? fmt(n) : Math.round(n).toLocaleString('en-US'));


// One-way platforms you can land on (x, width, top y).
const APT_PLATFORMS = [
  { x: 56, w: 44, y: 140 },            // shoe rack
  { x: 180, w: 90, y: 132 },           // couch seat
  { x: 186, w: 78, y: 116 },           // couch back
  { x: 290, w: 32, y: 126 },           // bookshelf
  { x: 290, w: 32, y: 100 },
  { x: 290, w: 32, y: 74 },
  { x: 360, w: 90, y: 128 },           // the fish-bowl table
  { x: 470, w: 60, y: 136 },           // tv stand
  { x: 560, w: 150, y: 118 },          // kitchen counter
  { x: 722, w: 44, y: 68 },            // fridge top
  { x: 850, w: 100, y: 130, bed: true },  // Sam's bed (bouncy!)
  { x: 990, w: 70, y: 120 },           // desk
  { x: 1070, w: 40, y: 90 },           // wall shelf
];
const APT_COINS = [[225, 150], [306, 68], [744, 62], [905, 150], [1090, 84]];

// What an item does once its package is opened.
function applyItem(b, id) {
  b.items = b.items || {};
  if (id === 'pizza' || id === 'drink') b.energy = 100;
  else if (id === 'cake') { b.energy = 100; b.party = (b.party || 0) + 1; }
  else if (id === 'fireworks') b.fireworks = (b.fireworks || 0) + 1;
  else b.items[id] = true;
}

class ApartmentScene {
  constructor(bowl, who) {
    this.bowl = bowl;
    this.b = bowl.b;
    this.who = who;                     // 'cat' | 'bowl' | 'sam'
    const b = this.b;
    b.items = b.items || {};
    b.debt = b.debt || 0;
    if (b.aptDay !== b.day) { b.aptDay = b.day; b.coins = []; b.cups = 0; b.fridge = false; b.tvDone = false; }
    this.t = 0;
    this.elapsed = 0;
    this.p = { x: who === 'cat' ? 470 : who === 'sam' ? 900 : 405, y: who === 'cat' ? 136 : who === 'sam' ? APT_GROUND : 128, vx: 0, vy: 0, face: 1, ground: true, anim: 0, drop: 0 };
    this.camX = clamp(this.p.x - W / 2, 0, APT_W - W);
    this.cups = [0, 1, 2, 3].map(i => ({ x: 580 + i * 34, y: 118, vy: 0, falling: false, broken: i < b.cups }));
    this.orders = [];
    this.vac = { x: 300, dir: 1 };
    this.packages = [];
    this.parts = new Particles();
    this.floaters = new Floaters();
    this.store = null;
    this.msg = { text: who === 'cat' ? 'SAM IS AT SCHOOL. THE APARTMENT IS YOURS, KITTY!' : who === 'sam' ? 'THE HELMET HUMS... SAM\'S EYES GO SWIRLY. {YOU ARE SAM NOW.}' : 'YOUR BOWL WALKS OFF THE TABLE. FREEDOM!', t: 3.5 };
    this.bg = this.paint();
  }
  enter() { Sound.play('shop'); }
  onBlur() {}
  get cat() { return this.who === 'cat'; }
  get sam() { return this.who === 'sam'; }

  /* ------------------------------------------------------- objects */
  interactables() {
    const b = this.b, list = [];
    if (this.cat) list.push({ x: 405, r: 26, label: 'BACK TO THE BOWL', act: () => this.leave() });
    else if (this.sam) {
      list.push({ x: 405, r: 30, label: b.samFed === b.day ? 'PET THE FISH (YOU)' : 'FEED THE FISH (YOURSELF!)', act: () => this.samFeed() });
      list.push({ x: 900, r: 26, label: 'DO HOMEWORK', act: () => this.homework() });
      list.push({ x: 30, r: 22, label: 'LEAVE THE APARTMENT', act: () => this.say(pick(['SAM WALKS INTO THE DOOR. THE HELMET HAS A RANGE OF 10 METRES.', 'OUTSIDE IS SCARY. AND THERE IS NO WATER.', 'THE GIANT ROBOT CAN GO OUTSIDE. SAM CANNOT.']), '#9fe8f5') });
      list.push({ x: 225, r: 30, label: 'SIT ON THE COUCH', act: () => this.say(pick(['THE CAT SCOOTS OVER. IT KNOWS WHO IS IN CHARGE.', 'SAM SITS. YOU MAKE HIM SAY "I LOVE MY FISH" OUT LOUD.', 'A COMFY COUCH. HUMANS HAVE IT SO EASY.']), '#f6a0c8') });
    }
    else list.push({ x: 405, r: 22, label: 'GO HOME TO THE TABLE', act: () => this.leave() });
    list.push({ x: 500, r: 24, label: 'WATCH TV', act: () => this.watchTV() });
    list.push({ x: 745, r: 24, label: b.fridge ? 'FRIDGE (EMPTY TODAY)' : 'RAID THE FRIDGE', act: () => this.raidFridge() });
    list.push({ x: 1024, r: 30, label: "USE SAM'S COMPUTER", act: () => this.openStore() });
    if (this.cat) list.push({ x: 792, r: 14, label: 'EAT CAT FOOD', act: () => this.say('YUCK. ...DELICIOUS.', '#f6a0c8') });
    for (const c of this.cups) if (this.cat && !c.broken && !c.falling) list.push({ x: c.x, r: 10, y: c.y, label: 'KNOCK IT OFF', act: () => this.knock(c) });
    for (const pk of this.packages) list.push({ x: pk.x, r: 12, label: 'OPEN THE PACKAGE', act: () => this.open(pk) });
    return list;
  }
  nearest() {
    const p = this.p;
    let best = null, bd = 1e9;
    for (const it of this.interactables()) {
      const d = Math.abs(p.x - it.x);
      if (d > it.r) continue;
      if (it.y !== undefined && Math.abs(p.y - it.y) > 10) continue;
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  }
  say(text, color = '#ffffff') { this.msg = { text, t: 3, color }; }

  watchTV() {
    const shows = ['A COOKING SHOW... THEY ARE COOKING FISH?! CHANNEL CHANGED.', 'CARTOONS! A MOUSE BEATS UP A CAT. VERY RELATABLE.', 'THE NEWS: "WHY IS EVERYONE\'S WIFI SO SLOW?"', 'A NATURE SHOW ABOUT THE SEA. YOU FEEL HOMESICK.'];
    this.say(pick(shows), '#9fe8f5');
    if (!this.b.tvDone) {
      this.b.tvDone = true;
      const v = Math.max(20, this.bowl.passive() * 15);
      this.bowl.addIQ(v);
      this.floaters.add('+' + fmt(v) + ' IQ', 500, 90, '#b4f08c', { font: F5 });
      Sound.sfx('idea');
    }
  }
  samFeed() {
    const b = this.b;
    if (b.samFed === b.day) { this.say('SAM PATS THE BOWL. YOU MAKE HIM SAY: "GOOD FISHY. SMARTEST FISH EVER."', '#f6a0c8'); return; }
    b.samFed = b.day;
    b.energy = 100;
    Sound.sfx('eatbig');
    for (let i = 0; i < 12; i++) this.parts.add({ x: 405 + rnd(-6, 6), y: 100, vx: rnd(-10, 10), vy: rnd(10, 40), life: 1, c: pick(['#feae34', '#f77622', '#e43b44']) });
    this.say('YOU MAKE SAM POUR A WHOLE PILE OF FLAKES INTO YOUR BOWL. {ENERGY FULL!}', '#ffffff');
    saveGame();
  }
  homework() {
    const b = this.b;
    if (b.homework === b.day) { this.say('HOMEWORK IS DONE FOR TODAY. SAM GOT AN A+. (YOU GOT THE A+.)', '#fee761'); return; }
    b.homework = b.day;
    const v = Math.max(50, this.bowl.passive() * 30);
    this.bowl.addIQ(v);
    Sound.sfx('idea');
    this.floaters.add('+' + fmt(v) + ' IQ', 900, 100, '#b4f08c', { font: F5 });
    this.say(pick(['YOU SOLVE SAM\'S MATH HOMEWORK WITH HIS OWN HANDS. 1 + 1 = FISH.', 'YOU MAKE SAM WRITE AN ESSAY: "WHY FISH SHOULD RULE THE WORLD".', 'SAM\'S SCIENCE PROJECT: A BIGGER BOWL. GENIUS.']), '#ffffff');
  }
  raidFridge() {
    if (this.b.fridge) { this.say('YOU ALREADY RAIDED IT TODAY. SAM MIGHT NOTICE...'); return; }
    this.b.fridge = true;
    this.b.energy = Math.min(100, this.b.energy + 40);
    Sound.sfx('eatbig');
    this.say(this.cat ? 'YOU STOLE A SARDINE AND DROPPED IT IN THE BOWL. {+40 ENERGY}' : this.sam ? 'SAM EATS A WHOLE CHEESE AND DROPS SHRIMP IN YOUR BOWL. {+40 ENERGY}' : 'YOU FOUND FISH FLAKES IN THE FRIDGE! {+40 ENERGY}', '#ffffff');
  }
  knock(c) {
    c.falling = true;
    c.vy = -40;
    c.vx = this.p.face * 40;
    Sound.sfx('tick');
    this.say(pick(['OOPS. (NOT OOPS.)', 'CAT INSTINCTS: ACTIVATED.', 'THE CUP HAD IT COMING.', 'GRAVITY TEST: SUCCESSFUL.']), '#fee761');
  }
  open(pk) {
    this.packages = this.packages.filter(q => q !== pk);
    this.apply(pk.id, pk.x);
  }
  apply(id, x = this.p.x) {
    const it = SHOP_ITEMS.find(i => i.id === id), b = this.b;
    applyItem(b, id);
    Sound.sfx('upgrade');
    for (let i = 0; i < 16; i++) this.parts.add({ type: 'spark', x, y: 140, vx: rnd(-60, 60), vy: rnd(-80, 0), drag: 2, life: 0.8, c: pick(['#fee761', '#f6757a', '#2ce8f5']) });
    const note = { pizza: 'ENERGY FULL!', drink: 'ENERGY FULL! BZZZ!', cake: 'PARTY IN THE BOWL!', fireworks: 'THE SHOW STARTS WHEN YOU GET HOME.', trampoline: 'IT IS IN THE HALLWAY!', jetpack: 'PRESS JUMP AGAIN IN THE AIR!', skateboard: 'ZOOM ZOOM!', vacuum: 'IT IS CLEANING THE LIVING ROOM.' }[id] || 'CHECK YOUR BOWL.';
    this.say('YOU GOT: {' + it.name + '}! ' + note, '#ffffff');
    saveGame();
  }
  leave() {
    if (this.leaving) return;
    this.leaving = true;
    // anything still in the mail gets delivered straight to the bowl
    const extra = this.orders.map(o => o.id).concat(this.packages.map(p => p.id));
    for (const id of extra) applyItem(this.b, id);
    this.bowl.onExploreDone(this.elapsed, extra.length);
    Game.go(() => this.bowl);
  }

  /* ---------------------------------------------------------- store */
  openStore() { this.store = { sel: 0, t: 0, scroll: 0, flash: 0 }; Sound.sfx('ok'); }
  updateStore() {
    const s = this.store, n = SHOP_ITEMS.length;
    if (hit('up')) { s.sel = (s.sel + n - 1) % n; Sound.sfx('move'); }
    if (hit('down')) { s.sel = (s.sel + 1) % n; Sound.sfx('move'); }
    if (Input.wheel) s.sel = clamp(s.sel + Input.wheel, 0, n - 1);
    if (s.sel < s.scroll) s.scroll = s.sel;
    if (s.sel >= s.scroll + STORE_ROWS) s.scroll = s.sel - STORE_ROWS + 1;
    for (let r = 0; r < STORE_ROWS; r++) {
      const i = s.scroll + r;
      if (clicked(22, 49 + r * 12, 158, 12)) { if (s.sel === i) this.order(SHOP_ITEMS[i]); s.sel = i; }
    }
    if (clicked(184, 132, 110, 16)) this.order(SHOP_ITEMS[s.sel]);
    else if (keyHit('Enter') || keyHit('KeyE')) this.order(SHOP_ITEMS[s.sel]);
    if (hit('back') || (Input.mhit && !hover(16, 22, 288, 140))) { this.store = null; Sound.sfx('back'); }
  }
  isOwned(it) {
    return !it.consumable && (this.b.items[it.id] || this.orders.some(o => o.id === it.id) || this.packages.some(p => p.id === it.id));
  }
  order(it) {
    if (this.isOwned(it)) { Sound.sfx('no'); return; }
    const b = this.b;
    b.debt += it.usd;
    b.orders = (b.orders || 0) + 1;
    this.orders.push({ id: it.id, t: 4 });
    Sound.sfx('buy');
    this.store.flash = 1;
    this.floaters.add('-' + usd(it.usd) + " (SAM'S CARD)", 240, 118, '#ff8f7a');
    saveGame();
  }

  /* --------------------------------------------------------- update */
  update(dt, active) {
    this.t += dt;
    this.elapsed += dt;
    this.parts.update(dt);
    this.floaters.update(dt);
    if (this.msg) { this.msg.t -= dt; if (this.msg.t <= 0) this.msg = null; }
    for (const o of this.orders) {
      o.t -= dt;
      if (o.t <= 0) {
        this.packages.push({ id: o.id, x: 84 + this.packages.length * 16 });
        Sound.sfx('knock');
        this.say('DING DONG! A PACKAGE ARRIVED AT THE {FRONT DOOR}.', '#ffffff');
      }
    }
    this.orders = this.orders.filter(o => o.t > 0);
    if (this.store) { this.store.flash = Math.max(0, this.store.flash - dt); if (active) this.updateStore(); return; }
    if (!active) return;
    if (hit('back') || touchPauseHit(W - 17, 4)) { this.leave(); return; }
    const p = this.p;
    // walking
    let ix = 0;
    if (held('left')) ix -= 1;
    if (held('right')) ix += 1;
    const tb = this.touchButtons();
    for (const pt of Input.pointers.values()) {
      if (pt.x < 34 && pt.y > H - 30) ix = -1;
      else if (pt.x >= 34 && pt.x < 64 && pt.y > H - 30) ix = 1;
    }
    const speed = (this.cat ? 95 : this.sam ? 72 : 60) * (this.b.items.skateboard ? (this.cat ? 1.3 : 1.8) : 1);
    p.vx = approach(p.vx, ix * speed, 700 * dt);
    if (ix) p.face = ix;
    // jumping and dropping through platforms
    const jump = hit('up') || hit('dash') || tb.jump;
    if (p.ground) p.air = 1;
    if (jump && p.ground) { p.vy = this.cat ? -300 : this.sam ? -245 : -215; p.ground = false; Sound.tone(this.cat ? 500 : 300, 0.1, { type: 'p25', vol: 0.08, slide: 1.8 }); }
    else if (jump && this.b.items.jetpack && p.air > 0) {
      p.air--; p.vy = this.cat ? -280 : -240;
      Sound.noise(0.3, { vol: 0.15, freq: 900, slide: 0.4 });
      for (let i = 0; i < 10; i++) this.parts.add({ x: p.x - p.face * 4, y: p.y - 6, vx: rnd(-15, 15), vy: rnd(40, 90), life: 0.4, c: pick(['#fee761', '#f77622', '#e43b44']) });
    }
    // the robot vacuum roams the living room
    if (this.b.items.vacuum) {
      const v = this.vac, before = v.x;
      v.x += v.dir * 22 * dt;
      if (v.x < 180 || v.x > 520) v.dir *= -1;
      v.dx = v.x - before;
      if (p.onVac) p.x += v.dx;
    }
    if (held('down') && p.ground && p.y < APT_GROUND) { p.drop = 0.25; p.ground = false; }
    p.drop = Math.max(0, p.drop - dt);
    p.vy += 700 * dt;
    let ny = p.y + p.vy * dt;
    const nx = clamp(p.x + p.vx * dt, 10, APT_W - 10);
    p.ground = false;
    p.onVac = false;
    if (p.vy >= 0) {
      if (ny >= APT_GROUND) { ny = APT_GROUND; p.vy = 0; p.ground = true; }
      else if (p.drop <= 0) {
        for (const pl of this.platforms()) {
          if (nx < pl.x || nx > pl.x + pl.w || p.y > pl.y || ny < pl.y) continue;
          if (pl.tramp) { ny = pl.y; p.vy = -520; Sound.tone(150, 0.25, { type: 'triangle', vol: 0.14, slide: 4 }); this.floaters.add('WHEEE!', nx, pl.y - 24, '#fee761', { font: F5 }); break; }
          if (pl.bed && p.vy > 160) { ny = pl.y; p.vy = -Math.min(430, p.vy * 1.08); Sound.tone(200, 0.15, { type: 'triangle', vol: 0.12, slide: 3 }); this.floaters.add('BOING!', nx, pl.y - 20, '#fee761'); break; }
          ny = pl.y; p.vy = 0; p.ground = true; p.onVac = !!pl.vac;
          break;
        }
      }
    }
    p.x = nx;
    p.y = ny;
    p.anim += dt * (Math.abs(p.vx) > 5 ? 10 : 2);
    // coins
    const b = this.b;
    APT_COINS.forEach(([cx, cy], i) => {
      if (b.coins.includes(i)) return;
      if (Math.abs(p.x - cx) < 10 && Math.abs(p.y - 6 - cy) < 14) {
        b.coins.push(i);
        const v = Math.max(15, this.bowl.passive() * 10);
        this.bowl.addIQ(v);
        Sound.sfx('gold');
        this.floaters.add('COIN! +' + fmt(v) + ' IQ', cx, cy - 12, '#fee761', { font: F5 });
        if (b.coins.length === APT_COINS.length) this.say('YOU FOUND ALL THE LOST COINS TODAY!', '#fee761');
      }
    });
    // falling cups
    for (const c of this.cups) {
      if (!c.falling) continue;
      c.vy += 600 * dt;
      c.y += c.vy * dt;
      c.x += c.vx * dt;
      if (c.y >= APT_GROUND) {
        c.falling = false;
        c.broken = true;
        b.cups++;
        Sound.sfx('pinch');
        Sound.noise(0.25, { vol: 0.2, freq: 3000 });
        this.floaters.add('CRASH!', c.x, APT_GROUND - 14, '#ffffff', { font: F5 });
        const v = Math.max(5, this.bowl.passive() * 3);
        this.bowl.addIQ(v);
        for (let i = 0; i < 10; i++) this.parts.add({ x: c.x, y: APT_GROUND - 2, vx: rnd(-50, 50), vy: -rnd(20, 70), g: 300, life: 0.6, c: pick(['#ffffff', '#c0cbdc', '#e43b44']) });
      }
    }
    // interact
    const it = this.nearest();
    if (it && (keyHit('KeyE') || keyHit('Enter') || tb.use)) it.act();
    this.camX = clamp(lerp(this.camX, p.x - W / 2, 1 - Math.pow(0.01, dt)), 0, APT_W - W);
  }
  platforms() {
    const list = APT_PLATFORMS.slice(), it = this.b.items;
    if (it.trampoline) list.push({ x: 128, w: 26, y: 146, tramp: true });
    if (it.vacuum) list.push({ x: this.vac.x - 9, w: 18, y: 148, vac: true });
    return list;
  }
  touchButtons() {
    if (!Input.touchSeen) return {};
    return { jump: clicked(W - 70, H - 28, 32, 24), use: clicked(W - 36, H - 28, 32, 24) };
  }

  /* ----------------------------------------------------------- draw */
  paint() {
    const c = makeCanvas(APT_W, H), prev = setTarget(c.getContext('2d'));
    const walls = [[0, 160, '#b8a888', '#c8b898'], [160, 540, '#6fa8c8', '#78b0cf'], [540, 820, '#e8eef7', '#d8e0ea'], [820, APT_W, '#b4a0d8', '#c0acdf']];
    for (const [a, z, c1, c2] of walls) {
      rect(a, 0, z - a, APT_GROUND, c1);
      for (let x = a; x < z; x += 10) rect(x, 0, 5, APT_GROUND, c2);
    }
    // kitchen tiles
    for (let y = 80; y < 118; y += 8) for (let x = 548; x < 716; x += 8) rect(x, y, 7, 7, (x + y) % 16 ? '#c8e8f4' : '#9fd0e8');
    // floors
    rect(0, APT_GROUND, 540, 24, '#b86f50');
    for (let x = 0; x < 540; x += 24) rect(x, APT_GROUND, 1, 24, '#733e39');
    for (let y = APT_GROUND; y < H; y += 6) for (let x = 540; x < 820; x += 12) rect(x + ((y / 6) % 2) * 6, y, 6, 6, '#c0cbdc');
    for (let y = APT_GROUND; y < H; y += 6) for (let x = 540; x < 820; x += 12) rect(x + (1 - (y / 6) % 2) * 6, y, 6, 6, '#e8eef7');
    rect(820, APT_GROUND, APT_W - 820, 24, '#733e39');
    ellipse(900, 166, 50, 7, '#b55088'); ellipse(900, 166, 36, 4, '#f6a0c8');
    rect(0, APT_GROUND, APT_W, 1, '#3e2731');
    // door frames between rooms
    for (const x of [160, 540, 820]) { rect(x - 3, 20, 6, APT_GROUND - 20, '#e8eef7'); rect(x - 3, 20, 6, 2, '#ffffff'); }
    // hallway: front door, coat rack, shoe rack
    rect(8, 60, 40, 96, '#733e39'); rect(12, 64, 32, 92, '#8a4a38'); disc(40, 110, 2, '#fee761'); rect(20, 72, 16, 10, '#9fe8f5');
    rect(26, 40, 4, 4, '#3e2731'); text('HOME', 28, 50, '#3e2731', { font: F3, align: 'center' });
    rect(120, 50, 3, 106, '#5a3a2e'); rect(112, 50, 19, 3, '#5a3a2e'); rect(106, 56, 10, 26, '#e43b44'); rect(126, 56, 8, 20, '#124e89');
    rect(56, 140, 44, 3, '#733e39'); rect(56, 143, 3, 13, '#733e39'); rect(97, 143, 3, 13, '#733e39');
    rect(60, 134, 12, 6, '#3e2731'); rect(78, 135, 14, 5, '#e43b44'); rect(64, 150, 14, 6, '#262b44');
    rect(52, 152, 56, 4, '#be4a2f');
    // living room: window, couch, bookshelf, fish table, tv
    rect(200, 30, 60, 50, '#e8eef7'); paintGradient(gfx, 203, 33, 54, 44, [[0, '#4aa8ec'], [1, '#c8ecfb']], 2); rect(229, 33, 2, 44, '#e8eef7');
    rect(180, 118, 90, 38, '#3e8948'); rect(186, 104, 78, 16, '#63c74d'); rect(176, 116, 10, 30, '#3e8948'); rect(264, 116, 10, 30, '#3e8948');
    rect(180, 132, 90, 3, '#8fdc6a'); rect(196, 106, 20, 10, '#fee761'); rect(236, 108, 18, 9, '#f6757a');
    rect(290, 62, 32, 94, '#733e39'); for (const y of [74, 100, 126]) rect(290, y, 32, 3, '#5a3a2e');
    const bc = ['#e43b44', '#124e89', '#3e8948', '#feae34', '#b55088'];
    for (let s = 0; s < 3; s++) for (let i = 0; i < 5; i++) rect(293 + i * 6, [100, 126, 152][s] - 14 + (i % 2) * 2, 5, 14 - (i % 2) * 2, bc[(i + s) % 5]);
    rect(360, 128, 90, 5, '#c28569'); rect(364, 133, 5, 23, '#8a5a40'); rect(441, 133, 5, 23, '#8a5a40');
    rect(470, 136, 60, 20, '#733e39'); rect(476, 96, 48, 38, '#181425'); rect(478, 98, 44, 32, '#262b44'); rect(496, 134, 8, 2, '#262b44');
    // kitchen: counter, sink, oven, fridge, cat bowl
    rect(560, 118, 150, 38, '#8a5a40'); rect(556, 114, 158, 5, '#e8eef7'); rect(566, 124, 40, 26, '#733e39'); rect(612, 124, 40, 26, '#733e39'); rect(658, 124, 46, 26, '#262b44');
    rect(662, 128, 38, 18, '#3a4466'); for (let i = 0; i < 4; i++) px(666 + i * 9, 127, '#e43b44');
    rect(620, 110, 30, 4, '#8b9bb4'); rect(640, 98, 2, 12, '#8b9bb4'); rect(640, 98, 8, 2, '#8b9bb4');
    rect(722, 68, 44, 88, '#e8eef7'); rect(722, 68, 44, 2, '#ffffff'); rect(722, 104, 44, 2, '#8b9bb4'); rect(758, 80, 3, 16, '#8b9bb4'); rect(758, 112, 3, 26, '#8b9bb4');
    rect(730, 76, 6, 6, '#e43b44'); rect(740, 118, 10, 8, '#fee761');
    ellipse(792, 153, 8, 3, '#e43b44'); ellipse(792, 152, 6, 2, '#b86f50');
    text('KITTY', 792, 145, '#a22633', { font: F3, align: 'center' });
    // bedroom: bed, desk with computer, shelf, poster
    rect(850, 110, 10, 46, '#733e39'); rect(850, 130, 100, 16, '#e43b44'); rect(850, 126, 100, 6, '#ff7a7a'); rect(862, 120, 22, 8, '#ffffff');
    rect(850, 146, 100, 10, '#733e39');
    rect(990, 120, 70, 5, '#b86f50'); rect(994, 125, 4, 31, '#733e39'); rect(1052, 125, 4, 31, '#733e39');
    rect(1008, 94, 32, 22, '#262b44'); rect(1022, 116, 4, 4, '#262b44'); rect(1004, 118, 40, 2, '#8b9bb4');
    rect(1070, 90, 40, 3, '#733e39'); rect(1074, 78, 8, 12, '#e43b44'); rect(1086, 82, 6, 8, '#fee761');
    rect(880, 40, 36, 44, '#fee761'); rect(882, 42, 32, 40, '#0099db');
    setTarget(prev);
    for (let x = 882; x < 914; x += 1) px(x, 60 + Math.round(Math.sin(x * 0.6) * 2), '#e8fbff');
    c.getContext('2d').drawImage(SPR.hero1.r[0], 890, 64);
    return c;
  }

  draw() {
    const cx = Math.round(this.camX), t = this.t, b = this.b, p = this.p;
    gfx.drawImage(this.bg, cx, 0, W, H, 0, 0, W, H);
    // tv picture
    const tvx = 478 - cx;
    if (tvx > -50 && tvx < W) {
      paintGradient(gfx, tvx, 98, 44, 32, [[0, '#2690c0'], [1, '#0e3258']], 2);
      sprC('minnow', Math.floor(t * 4) % 2, tvx + ((t * 12) % 50) - 3, 112);
    }
    // computer screen
    const sx = 1010 - cx;
    if (sx > -40 && sx < W) { rect(sx, 96, 28, 18, '#0b1f14'); text('FISH', sx + 3, 98, '#63c74d', { font: F3 }); text('MART', sx + 3, 105, '#fee761', { font: F3 }); }
    // disco ball
    if (b.items.disco) {
      const dx = 330 - cx;
      line(dx, 0, dx, 14, '#8b9bb4'); disc(dx, 20, 6, '#c0cbdc');
      for (let i = 0; i < 6; i++) px(dx - 4 + ((i * 3 + Math.floor(t * 8)) % 9), 16 + (i * 5) % 9, '#ffffff');
      for (let i = 0; i < 8; i++) { const a = t * 1.5 + i; px(dx + Math.cos(a) * (40 + i * 9), 70 + Math.sin(a * 1.3) * 40, pick(['#f6757a', '#2ce8f5', '#fee761'])); }
    }
    // the fish bowl on its table (when you are the cat or Sam)
    if (this.cat || this.sam) {
      const bx = 405 - cx, by = 128;
      for (let y = by - 20; y <= by - 2; y++) { const hw = Math.floor(Math.sqrt(Math.max(0, 144 - (y - by + 12) * (y - by + 12)))); if (hw > 0) rect(bx - hw, y, hw * 2 + 1, 1, y < by - 17 ? '#9ff3fa' : '#4fb8dc'); }
      sprC('hero1', Math.floor(t * 4) % 2, bx + Math.sin(t) * 3, by - 12, Math.cos(t) < 0);
      ring(bx, by - 12, 12, '#c8f4ff');
      if (this.sam) { spr('helmet', 0, Math.round(bx + Math.sin(t) * 3) - 4, by - 22); if (Math.floor(t * 3) % 2) for (let i = 0; i < 3; i++) px(bx - 10 + i * 10, by - 30 - i % 2 * 3, '#2ce8f5'); }
      if (Math.floor(t * 2) % 4 === 0) text(this.sam ? 'WALK, HUMAN!' : 'GO KITTY!', bx, by - 34, '#ffffff', { font: F3, align: 'center', outline: '#07060f' });
    }
    // coins
    APT_COINS.forEach(([x, y], i) => {
      if (b.coins.includes(i)) return;
      const bob = Math.round(Math.sin(t * 4 + i) * 1);
      const w = [3, 2, 1, 2][Math.floor(t * 6 + i) % 4];
      ellipse(x - cx, y + bob, w, 3, '#feae34'); if (w > 1) px(x - cx, y + bob - 1, '#fff6c9');
    });
    // cups
    for (const c of this.cups) {
      if (c.broken) continue;
      const x = Math.round(c.x) - cx, y = Math.round(c.y);
      rect(x - 4, y - 8, 8, 8, '#3a4466'); rect(x + 4, y - 6, 3, 4, '#3a4466');
      rect(x - 3, y - 7, 6, 7, '#e8eef7'); rect(x + 4, y - 5, 2, 2, '#e8eef7'); rect(x - 3, y - 4, 6, 2, '#e43b44');
    }
    // packages
    for (const pk of this.packages) {
      const x = pk.x - cx;
      rect(x - 6, APT_GROUND - 10, 12, 10, '#b86f50'); rect(x - 6, APT_GROUND - 10, 12, 2, '#e4a672'); rect(x - 1, APT_GROUND - 10, 2, 10, '#fee761');
      if (Math.floor(t * 3) % 2) text('!', x, APT_GROUND - 20, '#fee761', { align: 'center', outline: '#07060f' });
    }
    // bought gadgets
    if (b.items.trampoline) {
      const tx = 128 - cx;
      rect(tx, 146, 26, 3, '#181425'); rect(tx + 2, 145, 22, 1, '#0099db');
      rect(tx + 1, 149, 2, 7, '#8b9bb4'); rect(tx + 23, 149, 2, 7, '#8b9bb4');
    }
    if (b.items.vacuum) {
      const vx = Math.round(this.vac.x) - cx;
      ellipse(vx, 151, 9, 4, '#3a4466'); ellipse(vx, 150, 8, 3, '#5a6988'); px(vx + this.vac.dir * 5, 149, Math.floor(t * 4) % 2 ? '#63c74d' : '#e43b44');
    }
    // the cat lounges on the couch while you drive Sam around
    if (this.sam) this.drawCatSitting(232 - cx, 104, t);
    // the player
    if (this.cat) this.drawCat(p.x - cx, p.y, t);
    else if (this.sam) this.drawSamPlayer(p.x - cx, p.y, t);
    else this.drawBowl(p.x - cx, p.y, t);
    if (b.items.skateboard && !p.onVac) { const sx = Math.round(p.x) - cx; rect(sx - 9, Math.round(p.y) - 1, 18, 2, '#e43b44'); disc(sx - 6, Math.round(p.y) + 2, 1, '#181425'); disc(sx + 6, Math.round(p.y) + 2, 1, '#181425'); }
    if (b.items.jetpack) { const jx = Math.round(p.x - p.face * (this.cat ? 3 : this.sam ? 8 : 10)) - cx, jy = Math.round(p.y) - (this.cat ? 14 : this.sam ? 22 : 26); rect(jx - 2, jy, 4, 8, '#8b9bb4'); rect(jx - 2, jy, 4, 2, '#e43b44'); }
    this.parts.draw(cx, 0);
    this.floaters.draw(cx, 0);
    this.drawHUD();
    if (this.store) this.drawStore();
  }

  drawCat(x, y, t) {
    x = Math.round(x); y = Math.round(y);
    const f = this.p.face, air = !this.p.ground;
    const step = Math.floor(this.p.anim) % 2;
    const g = '#8b9bb4', d = '#5a6988', l = '#c0cbdc';
    // tail
    for (let i = 0; i < 9; i++) px(x - f * (8 + i * 0.6), y - 8 - i + Math.round(Math.sin(t * 4 + i * 0.5) * 1.5), i % 3 ? g : d);
    // legs
    const lg = air ? [1, 1, 1, 1] : step ? [0, 2, 2, 0] : [2, 0, 0, 2];
    [-6, -3, 3, 6].forEach((o, i) => rect(x + o * f - (f < 0 ? 1 : 0), y - 5 + (air ? -1 : 0), 2, 5 - lg[i] + (air ? 0 : 0), d));
    // body
    ellipse(x, y - 8, 9, 4, g);
    for (let i = -4; i <= 4; i += 3) rect(x + i, y - 12, 1, 3, d);
    ellipse(x - f * 1, y - 6, 6, 1, l);
    // head
    const hx = x + f * 9, hy = y - 12;
    disc(hx, hy, 4, g);
    rect(hx - 4, hy - 7, 2, 3, g); rect(hx + 3, hy - 7, 2, 3, g);
    px(hx - 3, hy - 6, '#f6757a'); px(hx + 3, hy - 6, '#f6757a');
    const eye = Math.floor(t * 6) % 2 ? '#fee761' : '#b55088';
    px(hx + f * 1, hy - 1, eye); px(hx + f * 3, hy - 1, eye);
    px(hx + f * 4, hy + 1, '#f6757a');
    line(hx + f * 3, hy + 1, hx + f * 8, hy, '#e8eef7');
  }
  drawCatSitting(x, y, t) {
    if (x < -20 || x > W + 20) return;
    const g = '#8b9bb4', d = '#5a6988';
    ellipse(x, y - 4, 7, 4, g);
    for (let i = 0; i < 6; i++) px(x - 8 - i, y - 2 - Math.round(Math.sin(t * 3 + i * 0.6)), d);
    disc(x + 5, y - 10, 4, g);
    rect(x + 1, y - 16, 2, 3, g); rect(x + 7, y - 16, 2, 3, g);
    const eye = Math.floor(t * 6) % 2 ? '#fee761' : '#b55088';
    px(x + 4, y - 11, eye); px(x + 7, y - 11, eye);
  }
  drawSamPlayer(x, y, t) {
    x = Math.round(x); y = Math.round(y);
    const p = this.p, walking = p.ground && Math.abs(p.vx) > 5;
    drawSam(x, y + 1, walking ? 'walk' : 'stand', Math.floor(p.anim), p.face < 0);
    // swirly hypnotized eyes
    for (const ex of [x - 2, x + 2]) {
      const a = t * 10 + ex;
      rect(ex - 1, y - 28, 3, 3, '#ffffff');
      px(ex + Math.round(Math.cos(a)), y - 27 + Math.round(Math.sin(a)), '#b55088');
    }
    // mind control waves from the bowl
    if (Math.floor(t * 4) % 2) { ring(x, y - 36, 3 + Math.floor(t * 8) % 4, '#2ce8f5', y - 40); }
  }
  drawBowl(x, y, t) {
    x = Math.round(x); y = Math.round(y);
    const step = this.p.ground && Math.abs(this.p.vx) > 5 ? Math.round(Math.sin(t * 14) * 2) : 0;
    for (const s of [-1, 1]) {
      const lx = x + s * 5, lift = Math.max(0, s * step);
      rect(lx - 1, y - 10, 2, 10 - lift, '#5a6988');
      rect(lx - 3, y - 2 - lift, 6, 2, '#3a4466');
    }
    const cy = y - 20;
    for (let yy = cy - 3; yy <= cy + 9; yy++) { const hw = Math.floor(Math.sqrt(Math.max(0, 100 - (yy - cy) * (yy - cy)))); rect(x - hw, yy, hw * 2 + 1, 1, '#4fb8dc'); }
    sprC('hero1', Math.floor(t * 6) % 2, x + 1, cy + 1, this.p.face < 0);
    if (this.b.items.hat) spr('partyhat', 0, x - 1, cy - 9);
    ring(x, cy, 10, '#c8f4ff');
    rect(x - 6, cy - 10, 13, 2, '#e8fbff');
  }

  drawHUD() {
    const b = this.b;
    panel(2, 2, 124, 24, { fill: '#141330', alpha: 0.9 });
    text(this.cat ? 'PLAYING AS: THE CAT' : this.sam ? 'PLAYING AS: SAM (MIND CTRL)' : 'PLAYING AS: THE BOWL', 8, 6, '#f6a0c8', { font: F3 });
    spr('brain', 0, 7, 13);
    text('IQ ' + fmt(b.iq), 17, 15, '#ffffff', { font: F3 });
    text('COINS ' + b.coins.length + '/' + APT_COINS.length, 120, 15, '#fee761', { font: F3, align: 'right' });
    if (this.orders.length) text('ORDER ARRIVING...', 120, 28, '#9fe8f5', { font: F3, align: 'right', outline: '#07060f' });
    if (b.debt) text("SAM'S DEBT: " + usd(b.debt), 8, 28, '#ff8f7a', { font: F3, outline: '#07060f' });
    // room name
    const room = this.p.x < 160 ? 'HALLWAY' : this.p.x < 540 ? 'LIVING ROOM' : this.p.x < 820 ? 'KITCHEN' : "SAM'S ROOM";
    text(room, W / 2, 5, '#ffffff', { align: 'center', outline: '#07060f' });
    text(Input.touchSeen ? '' : 'ESC: BACK TO BOWL', W - 4, 5, '#c0cbdc', { font: F3, align: 'right', outline: '#07060f' });
    touchPauseButton(W - 17, 4);
    // interaction prompt
    const it = this.store ? null : this.nearest();
    if (it) {
      const s = (Input.touchSeen ? 'USE: ' : 'E: ') + it.label;
      const w = textW(s) + 12;
      panel(W / 2 - w / 2, 150, w, 15, { fill: '#262b44', border: '#fee761' });
      text(s, W / 2, 154, '#ffffff', { align: 'center' });
    } else if (!Input.touchSeen && this.t < 8) {
      text(this.cat || this.sam ? '← → WALK   SPACE JUMP   ↓ DROP DOWN' : '← → WALK   SPACE HOP', W / 2, 168, '#ffffff', { font: F3, align: 'center', outline: '#07060f' });
    }
    // speech / event message
    if (this.msg) {
      const lines = wrap(this.msg.text, 250);
      const h = lines.length * 10 + 8;
      panel(W / 2 - 134, 30, 268, h, { fill: '#141330', alpha: 0.92 });
      lines.forEach((l, i) => text(l, W / 2, 35 + i * 10, this.msg.color || '#ffffff', { align: 'center', accent: '#fee761' }));
    }
    // touch controls
    if (Input.touchSeen) {
      panel(4, H - 28, 28, 24, { fill: '#262b44', alpha: 0.8 }); drawArrow(18, H - 16, 'left', '#ffffff', 4);
      panel(36, H - 28, 28, 24, { fill: '#262b44', alpha: 0.8 }); drawArrow(50, H - 16, 'right', '#ffffff', 4);
      panel(W - 70, H - 28, 32, 24, { fill: '#262b44', alpha: 0.8 }); text('JUMP', W - 54, H - 19, '#ffffff', { font: F3, align: 'center' });
      panel(W - 36, H - 28, 32, 24, { fill: '#3e8948', alpha: 0.8 }); text('USE', W - 20, H - 19, '#ffffff', { font: F3, align: 'center' });
    }
  }

  drawStore() {
    const s = this.store, b = this.b;
    gfx.globalAlpha = 0.6; rect(0, 0, W, H, '#07060f'); gfx.globalAlpha = 1;
    panel(16, 22, 288, 140, { fill: '#e8eef7', border: '#3a4466' });
    rect(18, 24, 284, 14, '#124e89');
    text('FISHMART.COM', 24, 28, '#ffffff');
    text('FREE SHIPPING ON EVERYTHING!', 296, 29, '#fee761', { font: F3, align: 'right' });
    // the credit card
    text("PAYING WITH SAM'S CARD", 24, 41, '#3a4466', { font: F3 });
    text('DEBT: ' + usd(b.debt), 180, 41, s.flash > 0 && Math.floor(s.flash * 10) % 2 ? '#e43b44' : '#a22633', { font: F3, align: 'right' });
    for (let r = 0; r < STORE_ROWS; r++) {
      const i = s.scroll + r, it = SHOP_ITEMS[i];
      if (!it) break;
      const y = 51 + r * 12, sel = i === s.sel, owned = this.isOwned(it);
      if (sel) rect(22, y - 2, 158, 11, '#fee761');
      text(it.name, 26, y, owned ? '#8b9bb4' : '#262b44', { font: F5 });
      text(owned ? '✓' : usd(it.usd), 176, y + 1, owned ? '#3e8948' : '#124e89', { font: owned ? F5 : F3, align: 'right' });
    }
    if (s.scroll > 0) text('↑', 170, 44, '#8b9bb4', { font: F3 });
    if (s.scroll + STORE_ROWS < SHOP_ITEMS.length) text('↓ ' + (SHOP_ITEMS.length - s.scroll - STORE_ROWS) + ' MORE', 26, 149, '#8b9bb4', { font: F3 });
    rect(184, 44, 1, 110, '#c0cbdc');
    const it = SHOP_ITEMS[s.sel], owned = this.isOwned(it);
    text(it.name, 190, 48, '#124e89');
    wrap(it.desc, 106, F5).forEach((l, i) => text(l, 190, 60 + i * 10, '#3a4466'));
    if (it.consumable) text('(ORDER AS MANY AS YOU LIKE)', 190, 122, '#3e8948', { font: F3 });
    panel(184, 132, 110, 16, { fill: owned ? '#8b9bb4' : '#3e8948', border: '#262b44' });
    text(owned ? 'ALREADY BOUGHT' : 'BUY: ' + usd(it.usd), 239, 137, '#ffffff', { align: 'center' });
    text('ENTER BUY   ESC CLOSE', 239, 152, '#5a6988', { font: F3, align: 'center' });
  }
}
