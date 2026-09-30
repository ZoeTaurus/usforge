'use strict';
/* =====================================================================
   FISH LIFE  -  bowl.js
   Chapter 3: THE BOWL. Sam feeds you five times a day. Eat the flakes,
   catch ideas, buy brain upgrades... and slowly take over the world.
   ===================================================================== */

const BOWL = { cx: 150, cy: 96, R: 46 };
const FEED_TIMES = [450, 630, 810, 990, 1170];   // 7:30, 10:30, 13:30, 16:30, 19:30
const DAY_START = 390, BED_TIME = 1320;          // 6:30 wake up, 22:00 lights out
const MIN_PER_SEC = 8;
const SHOP_ROWS = 11;

const UPGRADES = [
  { id: 'memory', name: 'LONGER MEMORY', cost: 20, pas: 0, desc: 'REMEMBER THINGS FOR MORE THAN 3 SECONDS. IDEAS ARE WORTH DOUBLE.' },
  { id: 'lips', name: 'READ LIPS', cost: 80, pas: 2, desc: 'FINALLY UNDERSTAND WHAT SAM IS SAYING.' },
  { id: 'tv', name: 'WATCH TV', cost: 320, pas: 6, desc: 'LEARN ALL ABOUT THE HUMAN WORLD FROM THE TV.' },
  { id: 'glasses', name: 'TINY GLASSES', cost: 1300, pas: 16, desc: "READ SAM'S SCHOOL BOOKS. VERY STYLISH, TOO." },
  { id: 'math', name: 'LEARN MATH', cost: 4000, pas: 40, desc: '1 + 1 = FISH. FLAKES ARE WORTH DOUBLE.' },
  { id: 'cat', name: 'HYPNOTIZE CAT', cost: 13000, pas: 100, game: 'stare', desc: 'NO MORE CAT ATTACKS. THE CAT NOW BRINGS YOU SNACKS.' },
  { id: 'lab', name: 'SECRET LAB', cost: 36000, pas: 250, desc: 'TURN THE BOWL CASTLE INTO A BUBBLING SCIENCE LAB.' },
  { id: 'wifi', name: 'HACK THE WIFI', cost: 105000, pas: 650, game: 'hack', desc: 'PUT AN ANTENNA ON THE BOWL. HELLO, INTERNET!' },
  { id: 'laptop', name: 'BORROW LAPTOP', cost: 290000, pas: 1600, desc: 'SAM WILL NEVER NOTICE. PROBABLY.' },
  { id: 'legs', name: 'ROBOT LEGS', cost: 780000, pas: 4500, game: 'walk', desc: 'YOUR BOWL CAN WALK! THE FRIDGE IS NO LONGER SAFE.' },
  { id: 'stocks', name: 'STOCK MARKET', cost: 2.3e6, pas: 12000, desc: 'BUY LOW, SELL HIGH, SWIM FAST.' },
  { id: 'corp', name: 'FISHCORP', cost: 6.5e6, pas: 32000, desc: 'THE BIGGEST COMPANY ON EARTH. YOU ARE THE BOSS. NICE TIE.' },
  { id: 'army', name: 'FISH ARMY', cost: 18.5e6, pas: 90000, desc: 'EVERY FISH IN THE SEA JOINS YOUR CAUSE.' },
  { id: 'mind', name: 'MIND CONTROL', cost: 55e6, pas: 250000, desc: 'A SHINY HELMET THAT MAKES HUMANS OBEY FISH.' },
  { id: 'robot', name: 'GIANT ROBOT', cost: 160e6, pas: 700000, desc: 'A 100 METER ROBOT SUIT... WITH A FISH BOWL FOR A HEAD.' },
  { id: 'world', name: 'RULE THE WORLD', cost: 500e6, pas: 0, desc: 'THE FINAL STEP. EVERY HUMAN WILL BOW TO YOU.' },
];
const ERAS = ['PET FISH', 'SMART FISH', 'GENIUS FISH', 'MASTERMIND', 'OVERLORD'];
const ERA_AT = { glasses: 1, lab: 2, stocks: 3, army: 4 };

const SAM_LINES = [
  ['GOOD MORNING, {NAME}! BREAKFAST TIME!', 'SNACK TIME! WHO IS A GOOD FISH?', 'LUNCH! I SAVED YOU THE CRUNCHY FLAKES.', "AFTER-SCHOOL SNACK! DON'T TELL MOM.", 'DINNER TIME! SLEEP TIGHT LATER, BUDDY.'],
  ['MORNING! WAIT... ARE YOU WEARING GLASSES?', 'SOMEONE FINISHED MY MATH HOMEWORK. WEIRD.', 'THE CAT KEEPS STARING AT YOU...', 'SNACK! YOU LOOK SO... THOUGHTFUL TODAY.', 'DINNER! DID YOU JUST NOD AT ME?'],
  ['WHY IS THE WIFI SO SLOW LATELY?', 'IS THAT... AN ANTENNA ON YOUR BOWL?', 'DID MY LAPTOP JUST TYPE BY ITSELF?', 'MY SEARCH HISTORY SAYS "HOW TO RULE THE WORLD".', 'DINNER. I THINK YOU MIGHT BE A GENIUS.'],
  ['SOMETHING CALLED FISHCORP BOUGHT OUR WHOLE STREET!', 'MOM SAYS FISHCORP BOUGHT HER OFFICE TOO!', 'WHY DOES YOUR BOWL HAVE LEGS NOW?', 'THE NEWS SAYS FISHCORP IS BUYING THE MOON.', 'DINNER, SIR. I MEAN... DINNER, {NAME}.'],
  ['GOOD MORNING, GREAT {NAME}. YOUR BREAKFAST, MY LORD.', 'I LIVE TO SERVE THE FISH.', 'THE PRESIDENT CALLED. SHE WANTS TO TALK TO YOU.', 'YOUR ROBOT IS ALMOST READY, MASTER.', 'DINNER, MY LORD. FIVE TIMES A DAY, AS PROMISED.'],
];
const GIBBERISH = ['BLAH BLAH FISHY BLAH!', 'WUB WUB, WUB WUB WUB?', 'MMF MRRF BLUB BLUB!', 'BLAH... FOOD... BLAH BLAH!', 'WAH WAH WAAAH, {NAME}!', 'BLUB? BLAH BLAH BLUB.'];
const NEWS = {
  tv: ['LOCAL CAT FALLS OFF COUCH. AGAIN.', 'WEATHER: SUNNY WITH A CHANCE OF FISH.', 'SCIENTISTS SAY FISH HAVE A 3 SECOND MEMORY. HA!'],
  glasses: ['TINY GLASSES SELL OUT AT LOCAL OPTICIAN.'],
  math: ["MYSTERY: KID'S HOMEWORK SOLVED OVERNIGHT, IN BUBBLES."],
  cat: ['CATS ACROSS TOWN SEEN STARING INTO SPACE.'],
  lab: ['STRANGE GREEN BUBBLES REPORTED ON MAPLE STREET.'],
  wifi: ['INTERNET SLOWS DOWN IN ONE HOUSE. EXPERTS BAFFLED.'],
  laptop: ['USER "BLUB_GENIUS" TOPS EVERY VIDEO GAME LEADERBOARD.'],
  legs: ['FISH BOWL SEEN WALKING TO THE FRIDGE AT 3 AM.'],
  stocks: ['MYSTERY INVESTOR "{NAME}" BUYS HALF THE STOCK MARKET.'],
  corp: ['FISHCORP BUYS EVERY COMPANY. CEO NEVER SEEN OUT OF WATER.'],
  army: ['MILLIONS OF FISH SPOTTED SWIMMING IN PERFECT FORMATION.'],
  mind: ['WORLD LEADERS SUDDENLY LOVE FISH. "ALL HAIL", THEY SAY.'],
  robot: ['100 METER ROBOT SPOTTED. NEIGHBORS: "IT HAS A FISH BOWL HEAD."'],
};

function newBowlState() {
  return { iq: 0, total: 0, owned: {}, day: 1, min: 440, energy: 80, fed: [false, false, false, false, false], tut: false, catT: 55, treatT: 20 };
}

class BowlScene {
  constructor() {
    if (!GS.bowl) {
      GS.bowl = newBowlState();
      // pearls found in the sea make you a little smarter from the start
      const pearls = ((GS.sea && GS.sea.pearls) || []).length;
      GS.bowl.iq = pearls * 15 + (pearls === 6 ? 60 : 0);
    }
    this.b = GS.bowl;
    this.t = 0;
    this.parts = new Particles();
    this.floaters = new Floaters();
    this.pause = new PauseMenu(() => { saveGame(); Game.go(() => new TitleScene({ skipIntro: true })); });
    this.flakes = [];
    this.ideas = [];
    this.ideaT = 1.5;
    this.fish = { x: BOWL.cx, y: BOWL.cy + 6, vx: 0, vy: 0, facing: 1, anim: 0, dashT: 0, dashCd: 0, stun: 0 };
    this.feed = null;         // current feeding event
    this.cat = null;          // current cat attack
    this.sleep = null;        // night transition
    this.shop = null;         // upgrade panel
    this.banner = null;
    this.bubble = null;       // Sam's speech bubble
    this.saveT = 5;
    this.lift = this.owned('legs') ? 8 : 0;
    this.tvT = 0;
    this.tvCh = 0;
    this.newsX = W;
    this.news = this.pickNews();
    this.dlg = new DialogBox();
    this.tutorial = null;
    this.buildRoom();
    this.gravel = this.buildGravel();
    if (!this.b.tut) this.startTutorial();
  }

  enter() { Sound.play('bowl'); }
  onBlur() { if (!this.pause.open && !this.shop && !this.gamesMenu && !this.exploreMenu && !this.tutorial && Game.scene === this) this.pause.toggle(); }

  owned(id) { return !!this.b.owned[id]; }
  get era() {
    let e = 0;
    for (const id in ERA_AT) if (this.owned(id)) e = Math.max(e, ERA_AT[id]);
    return e;
  }
  passive() { return UPGRADES.reduce((a, u) => a + (this.b.owned[u.id] ? u.pas : 0), 0); }
  energyMult() { return 0.5 + this.b.energy / 100; }
  ideaValue(gold) { return Math.max(3, this.passive() * 2.2) * (this.owned('memory') ? 2 : 1) * (gold ? 10 : 1); }
  flakeValue() { return Math.max(2, this.passive() * 1.2) * (this.owned('math') ? 2 : 1) * (this.item('flakes') ? 1.5 : 1); }
  item(id) { return !!(this.b.items && this.b.items[id]); }
  nextUpgrade() { return UPGRADES.find(u => !this.b.owned[u.id]); }
  get cy() { return BOWL.cy - Math.round(this.lift); }
  waterTop() { return this.cy - 28; }
  gravelTop() { return this.cy + 30; }
  halfW(y, inset = 0) { const dy = y - this.cy, r = BOWL.R - inset; return dy * dy >= r * r ? 0 : Math.sqrt(r * r - dy * dy); }

  addIQ(v) {
    this.b.iq += v;
    this.b.total += v;
  }

  /* -------------------------------------------------------- tutorial */
  startTutorial() {
    this.tutorial = {
      i: 0,
      lines: [
        ['', 'WELCOME TO YOUR NEW HOME, {NAME}. SAM WILL FEED YOU {5 TIMES A DAY}.'],
        ['', 'EAT THE FOOD {FLAKES} TO KEEP YOUR {ENERGY} UP. A HUNGRY FISH THINKS SLOWLY.'],
        ['', 'CATCH THE GLOWING {IDEAS} THAT POP INTO YOUR HEAD TO RAISE YOUR {IQ}.'],
        ['', 'SPEND YOUR IQ ON {BRAIN UPGRADES}: PRESS {TAB} OR CLICK THE UPGRADE BUTTON.'],
        ['YOU', 'FIRST THE BOWL. THEN THE HOUSE. THEN... THE WORLD!'],
      ],
    };
    this.sayTut();
  }
  sayTut() {
    const [who, s] = this.tutorial.lines[this.tutorial.i];
    this.dlg.say(who, s.split('{NAME}').join(GS.fishName));
  }

  /* ---------------------------------------------------------- update */
  update(dt, active) {
    this.t += dt;
    this.dlg.update(dt);
    this.parts.update(dt);
    this.floaters.update(dt);
    if (this.pause.open) { if (active) this.pause.update(dt); return; }
    if (this.tutorial) {
      if (active && (hit('ok') || Input.mhit)) {
        if (!this.dlg.done) this.dlg.skip();
        else if (++this.tutorial.i >= this.tutorial.lines.length) { this.tutorial = null; this.b.tut = true; saveGame(); }
        else { this.sayTut(); Sound.sfx('move'); }
      }
      return;
    }
    if (this.shop) { if (active) this.updateShop(dt); return; }
    if (this.gamesMenu) { if (active) this.updateGames(); return; }
    if (this.exploreMenu) { if (active) this.updateExplore(); return; }
    if (active && (hit('pause') || touchPauseHit(W - 17, 35))) { this.pause.toggle(); return; }
    if (active && !this.sleep && (hit('menu') || this.clickedUpgradeButton())) { this.openShop(); return; }
    if (active && !this.sleep && !this.feed && this.hasGames()) {
      const [gx, gy, gw, gh] = this.gamesButtonRect();
      if (keyHit('KeyG') || clicked(gx, gy, gw, gh)) { this.openGames(); return; }
    }
    if (active && !this.sleep && !this.feed && this.canExplore()) {
      const [ex, ey, ew, eh] = this.exploreButtonRect();
      if (keyHit('KeyX') || clicked(ex, ey, ew, eh)) { this.openExplore(); return; }
    }
    if (this.ending) {
      this.endT = (this.endT || 0) + dt;
      if (this.endT > 2.2 && !this.endGo) { this.endGo = true; Game.go(() => new EndingScene(), { speed: 1 }); }
      return;
    }

    const b = this.b;
    GS.stats.time += dt;
    // time of day
    if (!this.sleep) {
      b.min += dt * MIN_PER_SEC;
      for (let i = 0; i < 5; i++) if (!b.fed[i] && b.min >= FEED_TIMES[i] && !this.feed) this.startFeeding(i);
      if (b.min >= BED_TIME && !this.feed) this.startSleep();
    } else this.updateSleep(dt);
    // energy and passive thinking
    if (!this.sleep) b.energy = Math.max(0, b.energy - dt * 1.35);
    this.addIQ(this.passive() * this.energyMult() * dt);
    // animate the legs growing in
    const targetLift = this.owned('legs') ? 8 : 0;
    if (this.lift !== targetLift) {
      const d = approach(this.lift, targetLift, dt * 6) - this.lift;
      this.lift += d;
      this.fish.y -= d;
      for (const f of this.flakes) f.y -= d;
      for (const i of this.ideas) i.y -= d;
    }
    this.updateFish(dt, active);
    this.updateFlakes(dt);
    this.updateIdeas(dt);
    if (this.feed) this.updateFeeding(dt);
    this.updateCat(dt);
    if (this.bubble) { this.bubble.t -= dt; if (this.bubble.t <= 0) this.bubble = null; }
    if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }
    // tv
    if (this.owned('tv')) {
      this.tvT += dt;
      if (this.tvT > 9) { this.tvT = 0; this.tvCh = (this.tvCh + 1) % 4; }
      this.newsX -= dt * 28;
      if (this.newsX < -textW(this.news) - 40) { this.newsX = W; this.news = this.pickNews(); }
    }
    // bubbles from the lab or the plant
    if (Math.random() < dt * (this.owned('lab') ? 4 : 1.2)) {
      const lab = this.owned('lab');
      this.parts.add({ type: 'bubble', x: lab ? BOWL.cx - 22 + rnd(-3, 3) : BOWL.cx + rnd(-30, 30), y: this.gravelTop() - (lab ? 16 : 2), vy: -rnd(10, 20), life: 6, size: rndi(1, 2), c: lab ? '#b4f08c' : '#d8f8ff', minY: this.waterTop() + 1 });
    }
    this.saveT -= dt;
    if (this.saveT <= 0) { this.saveT = 5; saveGame(); }
  }

  clickedUpgradeButton() {
    const [x, y, w, h] = this.upgradeButtonRect();
    return clicked(x, y, w, h);
  }
  upgradeButtonRect() { return [W - 110, H - 30, 106, 20]; }

  steer() {
    let ix = 0, iy = 0;
    if (held('left')) ix -= 1;
    if (held('right')) ix += 1;
    if (held('up')) iy -= 1;
    if (held('down')) iy += 1;
    if (Input.mdown) {
      const [bx, by, bw, bh] = this.upgradeButtonRect();
      for (const pt of Input.pointers.values()) {
        if (pt.x >= bx && pt.y >= by && pt.x < bx + bw && pt.y < by + bh) continue;
        if (this.hasGames() && pt.x < 140 && pt.y > H - 32) continue;
        const dx = pt.x - this.fish.x, dy = pt.y - this.fish.y, d = Math.hypot(dx, dy);
        if (d > 3) { const s = Math.min(1, d / 20); ix = (dx / d) * s; iy = (dy / d) * s; }
        break;
      }
    }
    const l = Math.hypot(ix, iy);
    if (l > 1) { ix /= l; iy /= l; }
    return [ix, iy];
  }

  updateFish(dt, active) {
    const f = this.fish;
    f.stun = Math.max(0, f.stun - dt);
    f.dashCd -= dt;
    f.dashT -= dt;
    const sleeping = this.sleep && this.sleep.t > 0.6;
    let [ix, iy] = active && !f.stun && !sleeping ? this.steer() : [0, 0];
    if (active && hit('dash') && f.dashCd <= 0 && !f.stun && !sleeping) {
      let dx = ix, dy = iy;
      if (!dx && !dy) dx = f.facing;
      const d = Math.hypot(dx, dy);
      f.vx = (dx / d) * 120; f.vy = (dy / d) * 120;
      f.dashT = 0.2; f.dashCd = 0.9;
      Sound.sfx('dash');
    }
    const speed = 52;
    if (f.dashT <= 0) {
      const acc = ix || iy ? 240 : 80;
      f.vx = approach(f.vx, ix * speed, acc * dt);
      f.vy = approach(f.vy, iy * speed, acc * dt);
    }
    if (f.stun) { f.vx *= 0.9; f.vy *= 0.9; }
    if (sleeping) { f.vx = approach(f.vx, 0, 40 * dt); f.vy = approach(f.vy, (this.gravelTop() - 12 - f.y) * 0.5, 40 * dt); }
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    // keep inside the water
    const top = this.waterTop() + 5, bot = this.gravelTop() - 6;
    if (f.y < top) { f.y = top; f.vy = Math.max(0, f.vy); }
    if (f.y > bot) { f.y = bot; f.vy = Math.min(0, f.vy); }
    const hw = this.halfW(f.y, 11);
    if (f.x < BOWL.cx - hw) { f.x = BOWL.cx - hw; f.vx = Math.max(0, f.vx); }
    if (f.x > BOWL.cx + hw) { f.x = BOWL.cx + hw; f.vx = Math.min(0, f.vx); }
    if (Math.abs(f.vx) > 4 && !f.stun) f.facing = f.vx > 0 ? 1 : -1;
    if (f.stun) f.facing = Math.floor(this.t * 10) % 2 ? 1 : -1;
    f.anim += dt * (3 + Math.hypot(f.vx, f.vy) / 8);
  }
  mouth() { return [this.fish.x + this.fish.facing * 6, this.fish.y + 1]; }

  updateFlakes(dt) {
    const wt = this.waterTop(), gt = this.gravelTop();
    const [mx, my] = this.mouth();
    for (const f of this.flakes) {
      f.t -= dt;
      if (f.state === 'fall') {
        f.vy += 220 * dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        if (f.y >= wt) { f.state = 'float'; f.y = wt + 1; f.t = rnd(0.6, 1.8); if (Math.random() < 0.3) Sound.sfx('bubble'); }
      } else if (f.state === 'float') {
        f.x += Math.sin(this.t * 2 + f.ph) * 4 * dt;
        f.y = wt + 1 + (Math.sin(this.t * 3 + f.ph) > 0 ? 1 : 0);
        if (f.t <= 0) f.state = 'sink';
      } else if (f.state === 'sink') {
        f.y += (f.treat ? 14 : 9) * dt;
        f.x += Math.sin(this.t * 2.5 + f.ph) * 8 * dt;
        if (f.y >= gt - 2) { f.state = 'rest'; f.y = gt - 1; f.t = 7; }
      } else if (f.state === 'rest' && f.t <= 0) f.gone = true;
      if (f.state !== 'fall') {
        const hw = this.halfW(f.y, 4);
        f.x = clamp(f.x, BOWL.cx - hw, BOWL.cx + hw);
        if (dist(mx, my, f.x, f.y) < (f.treat ? 7 : 5)) {
          f.gone = true;
          const v = this.flakeValue() * (f.treat ? 5 : 1);
          this.addIQ(v);
          this.b.energy = Math.min(100, this.b.energy + (f.treat ? 15 : 4));
          GS.stats.flakes++;
          Sound.sfx(f.treat ? 'eatbig' : 'eat');
          this.floaters.add('+' + fmt(v), f.x, f.y - 6, '#b4f08c');
          for (let i = 0; i < 4; i++) this.parts.add({ type: 'spark', x: f.x, y: f.y, vx: rnd(-25, 25), vy: rnd(-25, 25), drag: 3, life: 0.4, c: f.c });
        }
      }
    }
    this.flakes = this.flakes.filter(f => !f.gone);
  }

  updateIdeas(dt) {
    this.ideaT -= dt * (this.sleep ? 0 : 0.6 + this.b.energy / 100 * 0.8);
    if (this.ideaT <= 0 && this.ideas.length < 3) {
      this.ideaT = rnd(2, 3.6) / (this.item('bubbles') ? 1.4 : 1);
      const y = rnd(this.waterTop() + 8, this.gravelTop() - 8), hw = this.halfW(y, 12);
      this.ideas.push({ x: BOWL.cx + rnd(-hw, hw), y, life: 7, t: 0, gold: Math.random() < 0.06 });
    }
    const [mx, my] = this.mouth();
    for (const i of this.ideas) {
      i.t += dt;
      i.life -= dt;
      if (dist(mx, my, i.x, i.y + 1) < 8 || dist(this.fish.x, this.fish.y, i.x, i.y + 1) < 7) {
        i.gone = true;
        const v = this.ideaValue(i.gold);
        this.addIQ(v);
        GS.stats.ideas++;
        Sound.sfx(i.gold ? 'gold' : 'idea');
        this.floaters.add((i.gold ? 'GENIUS! +' : '+') + fmt(v) + ' IQ', i.x, i.y - 8, i.gold ? '#fee761' : '#ffffff', { font: i.gold ? F5 : F3, life: 1.2 });
        for (let k = 0; k < (i.gold ? 16 : 8); k++) this.parts.add({ type: 'spark', x: i.x, y: i.y, vx: rnd(-45, 45), vy: rnd(-45, 45), drag: 3, life: rnd(0.3, 0.7), c: i.gold ? '#fee761' : '#fff6c9' });
      }
      if (i.life <= 0) i.gone = true;
    }
    this.ideas = this.ideas.filter(i => !i.gone);
  }

  /* ------------------------------------------------------- feeding */
  startFeeding(i) {
    this.b.fed[i] = true;
    this.feed = { i, t: 0, phase: 'in', drops: 0 };
    Sound.sfx('knock');
  }
  updateFeeding(dt) {
    const f = this.feed;
    f.t += dt;
    if (f.phase === 'in' && f.t > 1.1) {
      f.phase = 'shake'; f.t = 0;
      this.say(this.samLine(f.i));
    } else if (f.phase === 'shake') {
      const n = Math.floor(f.t / 0.22);
      if (n > f.drops && f.drops < 14) {
        f.drops++;
        if (f.drops % 3 === 1) Sound.sfx('shake');
        const count = f.drops % 2 ? 1 : 2;
        for (let k = 0; k < count && this.flakes.length < 40; k++) {
          this.flakes.push({ x: BOWL.cx + 8 + rnd(-4, 4), y: this.waterTop() - 26, vx: rnd(-28, 18), vy: rnd(-10, 10), state: 'fall', t: 0, ph: rnd(6), c: this.item('flakes') ? pick(['#fee761', '#feae34', '#fff6c9']) : pick(['#e43b44', '#feae34', '#fee761', '#63c74d', '#f77622']) });
        }
      }
      if (f.t > 3.4) { f.phase = 'out'; f.t = 0; }
    } else if (f.phase === 'out' && f.t > 1.1) this.feed = null;
  }
  samLine(i) {
    const lips = this.owned('lips');
    let s = lips ? SAM_LINES[Math.min(this.era, SAM_LINES.length - 1)][i] : pick(GIBBERISH);
    const debt = this.b.debt || 0;
    if (lips && debt > 0 && Math.random() < 0.45) {
      const d = usd(debt);
      s = pick(debt < 500 ? [
        'WEIRD... MY CARD WAS CHARGED ' + d + ' BY SOMETHING CALLED FISHMART.',
        'DID SOMEONE ORDER A PIZZA? WITH MY MONEY?',
      ] : debt < 5000 ? [
        'MY CREDIT CARD BILL IS ' + d + '. I AM ELEVEN YEARS OLD.',
        'THE CAT KEEPS SITTING ON MY LAPTOP... AND NOW I OWE ' + d + '?!',
        'MOM IS GOING TO KILL ME. WHO KEEPS ORDERING STUFF?!',
      ] : [
        'THE BANK CALLED AGAIN. I OWE ' + d + '. I ONLY GET $5 A WEEK!',
        'I WILL BE PAYING OFF ' + d + ' UNTIL I AM 90 YEARS OLD.',
        'A JETPACK?! A GOLD BOWL?! I OWE ' + d + '! ...{NAME}, WAS THIS YOU?',
      ]);
    }
    return s.split('{NAME}').join(GS.fishName);
  }
  say(s, t = 3.6) { this.bubble = { text: s, t, lines: wrap(s, 190, F5) }; }

  /* ----------------------------------------------------------- night */
  startSleep() {
    this.sleep = { t: 0, gain: 0, stage: 0 };
    Sound.play('night');
  }
  updateSleep(dt) {
    const s = this.sleep;
    s.t += dt;
    if (Math.random() < dt * 1.2) this.floaters.add('Z', this.fish.x + 6, this.fish.y - 6, '#c0cbdc', { vy: -8, life: 1.4 });
    if (s.t > 3 && s.stage === 0) {
      s.stage = 1;
      const b = this.b;
      s.gain = this.passive() * this.energyMult() * 25 + 5;
      this.addIQ(s.gain);
      b.day++;
      GS.stats.days = b.day;
      b.min = DAY_START;
      b.fed = [false, false, false, false, false];
      this.flakes = [];
      saveGame();
    }
    if (s.t > 5.2) {
      this.sleep = null;
      Sound.play('bowl');
      this.banner = { title: 'DAY ' + this.b.day, sub: 'WHILE YOU SLEPT, YOU DREAMED UP {+' + fmt(this.sleepGain || 0) + ' IQ}', t: 3, style: 'aqua' };
    }
    this.sleepGain = s.gain;
  }

  /* ------------------------------------------------------------ cat */
  updateCat(dt) {
    const b = this.b;
    if (this.owned('cat')) {
      if (this.sleep) return;
      b.treatT -= dt;
      if (b.treatT <= 0) {
        b.treatT = 22;
        this.catFlick = 0.6;
        Sound.sfx('meow');
        this.flakes.push({ x: 208, y: this.cy - 26, vx: -46, vy: -70, state: 'fall', t: 0, ph: 0, c: '#b86f50', treat: true });
      }
      if (this.catFlick > 0) this.catFlick -= dt;
      return;
    }
    if (!this.cat) {
      if (this.feed || this.sleep || this.b.day === 1 && this.b.min < 520) return;
      b.catT -= dt;
      if (b.catT <= 0) { this.cat = { phase: 'peek', t: 0, px: 230, py: this.cy - 50, hit: false }; Sound.sfx('meow'); }
      return;
    }
    const c = this.cat, f = this.fish;
    c.t += dt;
    if (c.phase === 'peek' && c.t > 1.8) { c.phase = 'paw'; c.t = 0; c.px = BOWL.cx + 20; c.py = this.waterTop() - 14; }
    else if (c.phase === 'paw') {
      const tx = clamp(f.x, BOWL.cx - 30, BOWL.cx + 30), ty = clamp(f.y, this.waterTop() - 10, this.gravelTop() - 8);
      c.px = approach(c.px, tx, 42 * dt);
      c.py = approach(c.py, ty, 42 * dt);
      if (!c.hit && dist(c.px, c.py + 3, f.x, f.y) < 8 && f.stun <= 0) {
        c.hit = true;
        const lost = Math.floor(b.iq * 0.1);
        b.iq -= lost;
        f.stun = 1.2;
        f.vx = (f.x - c.px) * 4; f.vy = 60;
        Sound.sfx('hurt');
        Game.shake(3, 0.3);
        this.floaters.add('-' + fmt(lost) + ' IQ', f.x, f.y - 10, '#ff8f7a', { font: F5, life: 1.6 });
        this.floaters.add('YOU FORGOT STUFF!', f.x, f.y - 20, '#ffffff', { life: 1.8 });
        c.phase = 'leave'; c.t = 0;
      }
      if (c.t > 4.5) { c.phase = 'leave'; c.t = 0; Sound.sfx('hiss'); }
    } else if (c.phase === 'leave') {
      c.py -= 70 * dt;
      if (c.t > 1.2) { this.cat = null; b.catT = rnd(45, 70); }
    }
  }

  /* ------------------------------------------------------------ shop */
  openShop() {
    const next = this.nextUpgrade();
    this.shop = { sel: next ? UPGRADES.indexOf(next) : UPGRADES.length - 1, t: 0, scroll: 0 };
    Sound.sfx('ok');
  }
  updateShop(dt) {
    const s = this.shop;
    s.t += dt;
    const nextIdx = UPGRADES.indexOf(this.nextUpgrade());
    const maxSel = Math.min(UPGRADES.length - 1, nextIdx < 0 ? UPGRADES.length - 1 : nextIdx + 1);
    if (hit('up')) { s.sel = Math.max(0, s.sel - 1); Sound.sfx('move'); }
    if (hit('down')) { s.sel = Math.min(maxSel, s.sel + 1); Sound.sfx('move'); }
    if (Input.wheel) s.sel = clamp(s.sel + Input.wheel, 0, maxSel);
    const rows = SHOP_ROWS;
    if (s.sel < s.scroll) s.scroll = s.sel;
    if (s.sel >= s.scroll + rows) s.scroll = s.sel - rows + 1;
    for (let r = 0; r < rows; r++) {
      const i = s.scroll + r;
      if (i > maxSel) break;
      if (clicked(14, 36 + r * 11 - 2, 136, 11)) { s.sel = i; Sound.sfx('move'); }
    }
    const buy = hit('ok') || clicked(170, 136, 132, 16);
    if (buy) this.buy(UPGRADES[s.sel]);
    if (hit('menu') || hit('back') || clicked(W - 22, 14, 14, 14) || (Input.mhit && !hover(8, 12, 304, 158))) { this.shop = null; Sound.sfx('back'); }
  }
  buy(u) {
    if (!u || this.b.owned[u.id] || u !== this.nextUpgrade()) { Sound.sfx('no'); return; }
    if (this.b.iq < u.cost) { Sound.sfx('no'); this.floaters.add('NOT ENOUGH IQ!', 230, 130, '#ff8f7a', { font: F5 }); return; }
    if (u.game) { this.shop = null; this.launchGame(u.game, 'unlock', u); return; }
    this.grant(u);
  }
  grant(u) {
    this.b.iq -= u.cost;
    this.b.owned[u.id] = true;
    this.shop = null;
    Sound.sfx('upgrade');
    saveGame();
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * Math.PI * 2;
      this.parts.add({ type: 'spark', x: this.fish.x, y: this.fish.y, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, drag: 2.5, life: 1, c: pick(['#fee761', '#ffffff', '#f6757a', '#2ce8f5']) });
    }
    if (u.id === 'world') { this.startEnding(); return; }
    const eraUp = ERA_AT[u.id] !== undefined;
    this.banner = { title: eraUp ? ERAS[this.era] + '!' : 'UPGRADED!', sub: u.name + (u.pas ? ': {+' + fmt(u.pas) + ' IQ/SEC}' : ''), t: 3.2, style: eraUp ? 'gold' : 'green' };
    if (u.id === 'tv') { this.news = this.pickNews(); this.newsX = W; }
    if (u.id === 'lips') this.say(this.samLine(0).replace(/^GOOD MORNING/, 'HI'), 3);
    if (u.id === 'cat') { this.cat = null; this.say(this.owned('lips') ? 'WHY IS THE CAT SO... CALM?' : 'BLAH?', 3); }
  }
  launchGame(id, mode, u) {
    saveGame();
    Sound.sfx('ok');
    Game.go(() => new MINI_GAMES[id](this, mode, u));
  }
  // Rewards for replaying a mini-game: once per in-game day each.
  gameReward(id, score) {
    const p = Math.max(4, this.passive());
    return Math.round(p * (id === 'walk' ? 25 + score * 3 : 35));
  }
  onGameDone(id, mode, won, score, u, quit) {
    const b = this.b;
    b.gamesWon = b.gamesWon || {};
    b.played = b.played || {};
    if (quit) return;
    if (mode === 'unlock') {
      if (won && !b.owned[u.id] && b.iq >= u.cost) {
        b.gamesWon[id] = true;
        this.grant(u);
      } else if (!won) {
        this.banner = { title: 'NOT YET...', sub: 'WIN THE CHALLENGE TO UNLOCK {' + u.name + '}', t: 3.2, style: 'red' };
      }
    } else if (won) {
      if (b.played[id] === b.day) {
        this.banner = { title: 'NICE!', sub: 'COME BACK TOMORROW FOR ANOTHER {IQ BONUS}', t: 3, style: 'green' };
      } else {
        b.played[id] = b.day;
        const r = this.gameReward(id, score);
        this.addIQ(r);
        Sound.sfx('gold');
        this.banner = { title: 'BONUS!', sub: GAME_NAMES[id] + ': {+' + fmt(r) + ' IQ}', t: 3.2, style: 'gold' };
      }
    }
    saveGame();
  }
  hasGames() { return this.b.gamesWon && Object.keys(this.b.gamesWon).length > 0; }
  gamesButtonRect() { return [4, H - 30, 64, 20]; }
  canExplore() { return this.owned('cat') || this.owned('legs'); }
  exploreButtonRect() { return [72, H - 30, 64, 20]; }
  openExplore() {
    const opts = [];
    if (this.owned('cat')) opts.push('cat');
    if (this.owned('legs')) opts.push('bowl');
    if (opts.length === 1) { this.startExplore(opts[0]); return; }
    this.exploreMenu = { sel: 0, opts };
    Sound.sfx('ok');
  }
  startExplore(who) {
    this.exploreMenu = null;
    saveGame();
    Sound.sfx('ok');
    Game.go(() => new ApartmentScene(this, who));
  }
  updateExplore() {
    const m = this.exploreMenu, n = m.opts.length;
    if (hit('up') || hit('down')) { m.sel = (m.sel + 1) % n; Sound.sfx('move'); }
    for (let i = 0; i < n; i++) if (clicked(84, 70 + i * 16, 152, 14)) { this.startExplore(m.opts[i]); return; }
    if (hit('ok')) { this.startExplore(m.opts[m.sel]); return; }
    if (hit('back') || keyHit('KeyX') || (Input.mhit && !hover(76, 48, 168, 72))) { this.exploreMenu = null; Sound.sfx('back'); }
  }
  drawExplore() {
    const m = this.exploreMenu;
    gfx.globalAlpha = 0.6; rect(0, 0, W, H, '#07060f'); gfx.globalAlpha = 1;
    panel(76, 48, 168, 64, { fill: '#141330' });
    text('EXPLORE THE APARTMENT', W / 2, 54, '#fee761', { align: 'center' });
    m.opts.forEach((o, i) => {
      const y = 70 + i * 16, sel = i === m.sel;
      if (sel) rect(82, y - 3, 156, 14, '#262b44');
      text((sel ? '▶ ' : '  ') + (o === 'cat' ? 'AS THE HYPNOTIZED CAT' : 'AS YOUR WALKING BOWL'), 88, y, sel ? '#ffffff' : '#c0cbdc');
    });
  }
  // Fireworks and cake parties ordered from FishMart.
  drawCelebration() {
    if (this.fireworksT > 0) {
      this.fireworksT -= 1 / 60;
      if (Math.random() < 0.08) {
        const x = rnd(40, 280), y = rnd(20, 80), c = pick(['#fee761', '#f6757a', '#2ce8f5', '#63c74d', '#ffffff']);
        for (let i = 0; i < 22; i++) { const a = (i / 22) * Math.PI * 2, sp = rnd(30, 55); this.parts.add({ type: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 30, drag: 1.2, life: rnd(0.7, 1.2), c }); }
        Sound.sfx(Math.random() < 0.5 ? 'bubble' : 'pinch');
      }
    }
    if (this.partyT > 0) {
      this.partyT -= 1 / 60;
      if (Math.random() < 0.5) this.parts.add({ x: rnd(0, W), y: -2, vx: rnd(-10, 10), vy: rnd(20, 40), life: 4, size: 2, c: pick(['#fee761', '#f6757a', '#2ce8f5', '#63c74d']) });
      const k = this.partyT;
      if (k > 0) { rect(206, 128, 18, 12, '#f6a0c8'); rect(206, 128, 18, 3, '#ffffff'); for (let i = 0; i < 3; i++) { rect(209 + i * 5, 123, 1, 5, '#fee761'); if (Math.floor(this.t * 8 + i) % 2) px(209 + i * 5, 122, '#f77622'); } }
    }
  }

  // Coming back from the apartment: you kept thinking while you were out.
  onExploreDone(secs, delivered) {
    const gain = this.passive() * this.energyMult() * secs;
    this.addIQ(gain);
    const b = this.b;
    if (b.fireworks) { b.fireworks = 0; this.fireworksT = 8; this.banner = { title: 'FIREWORKS!', sub: 'SAM IS GOING TO HAVE SO MANY QUESTIONS.', t: 3.5, style: 'pink' }; saveGame(); return; }
    if (b.party) { b.party = 0; this.partyT = 10; Sound.sfx('fanfare'); this.banner = { title: 'PARTY TIME!', sub: 'CAKE IN THE BOWL! (IT IS NOT ANYONE\'S BIRTHDAY.)', t: 3.5, style: 'pink' }; saveGame(); return; }
    if (delivered) this.banner = { title: 'HOME AGAIN', sub: 'SAM FOUND YOUR PACKAGES AND PUT THEM BY THE BOWL.', t: 3, style: 'aqua' };
    else if (gain > 1) this.banner = { title: 'HOME AGAIN', sub: 'YOU KEPT THINKING WHILE YOU WERE OUT: {+' + fmt(gain) + ' IQ}', t: 3, style: 'aqua' };
    saveGame();
  }
  openGames() {
    this.gamesMenu = { sel: 0, list: Object.keys(MINI_GAMES).filter(id => this.b.gamesWon[id]) };
    Sound.sfx('ok');
  }
  updateGames() {
    const g = this.gamesMenu, n = g.list.length;
    if (hit('up')) { g.sel = (g.sel + n - 1) % n; Sound.sfx('move'); }
    if (hit('down')) { g.sel = (g.sel + 1) % n; Sound.sfx('move'); }
    for (let i = 0; i < n; i++) if (clicked(84, 62 + i * 16, 152, 14)) { g.sel = i; this.gamesMenu = null; this.launchGame(g.list[i], 'replay'); return; }
    if (hit('ok')) { this.gamesMenu = null; this.launchGame(g.list[g.sel], 'replay'); return; }
    if (hit('back') || keyHit('KeyG') || (Input.mhit && !hover(76, 40, 168, 100))) { this.gamesMenu = null; Sound.sfx('back'); }
  }
  drawGames() {
    const g = this.gamesMenu, b = this.b;
    gfx.globalAlpha = 0.6; rect(0, 0, W, H, '#07060f'); gfx.globalAlpha = 1;
    panel(76, 40, 168, 36 + g.list.length * 16, { fill: '#141330' });
    text('MINI-GAMES', W / 2, 46, '#fee761', { align: 'center' });
    for (let i = 0; i < g.list.length; i++) {
      const id = g.list[i], y = 62 + i * 16, sel = i === g.sel;
      if (sel) rect(82, y - 3, 156, 14, '#262b44');
      text((sel ? '▶ ' : '  ') + GAME_NAMES[id], 88, y, sel ? '#ffffff' : '#c0cbdc');
      const ready = (b.played || {})[id] !== b.day;
      text(ready ? 'BONUS!' : 'DONE', 234, y + 1, ready ? '#63c74d' : '#5a6988', { font: F3, align: 'right' });
    }
    text('WIN FOR BONUS IQ, ONCE A DAY EACH', W / 2, 44 + 16 + g.list.length * 16 + 2, '#8b9bb4', { font: F3, align: 'center' });
  }

  pickNews() {
    const pool = [];
    for (const id in NEWS) if (this.owned(id)) pool.push(...NEWS[id]);
    const latest = [...UPGRADES].reverse().find(u => this.owned(u.id) && NEWS[u.id]);
    let s = latest && Math.random() < 0.5 ? pick(NEWS[latest.id]) : pool.length ? pick(pool) : '';
    const debt = this.b.debt || 0;
    if (debt >= 1000 && Math.random() < 0.35) s = pick(['LOCAL KID OWES FISHMART ' + usd(debt) + '. "I NEVER ORDERED A JETPACK!"', 'FISHMART REPORTS RECORD SALES TO ONE (1) APARTMENT.', 'BANKS WARN: KEEP YOUR CREDIT CARD AWAY FROM CATS.']);
    return ('BREAKING NEWS: ' + s).split('{NAME}').join(GS.fishName);
  }

  startEnding() {
    this.ending = true;
    GS.chapter = 'ending';
    saveGame();
    Sound.play(null);
    Sound.sfx('fanfare');
    this.banner = { title: 'IT IS TIME.', sub: '', t: 3, style: 'red' };
  }

  /* ------------------------------------------------------------ draw */
  lightLevel() {
    const m = this.b.min;
    if (this.sleep) return 0.62;
    if (m < 480) return lerp(0.25, 0, (m - DAY_START) / 90);
    if (m < 1080) return 0;
    if (m < 1260) return lerp(0, 0.3, (m - 1080) / 180);
    return lerp(0.3, 0.45, clamp((m - 1260) / 60, 0, 1));
  }

  buildRoom() {
    const c = makeCanvas(W, H), prev = setTarget(c.getContext('2d'));
    // wallpaper
    rect(0, 0, W, 140, '#6fa8c8');
    for (let x = 0; x < W; x += 10) rect(x, 0, 5, 140, '#78b0cf');
    for (let y = 8; y < 136; y += 16) for (let x = (y / 16) % 2 ? 7 : 2; x < W; x += 10) { px(x, y, '#9fd0e8'); px(x + 1, y + 1, '#9fd0e8'); }
    rect(0, 128, W, 12, '#5a8aa8');
    rect(0, 128, W, 2, '#e8eef7');
    // window frame
    rect(8, 34, 64, 64, '#e8eef7');
    rect(11, 37, 58, 58, '#262b44');
    rect(4, 96, 72, 4, '#c0cbdc');
    // shelf
    rect(222, 50, 86, 3, '#733e39');
    rect(222, 53, 86, 1, '#3e2731');
    rect(228, 54, 2, 5, '#733e39'); rect(300, 54, 2, 5, '#733e39');
    const books = [['#e43b44', 16], ['#124e89', 13], ['#3e8948', 15], ['#feae34', 12], ['#b55088', 14]];
    let bx = 226;
    for (const [col, h] of books) { rect(bx, 50 - h, 5, h, col); rect(bx, 50 - h + 2, 5, 1, 'rgba(255,255,255,0.35)'); bx += 6; }
    // trophy
    rect(262, 42, 6, 1, '#fee761'); rect(263, 43, 4, 3, '#feae34'); rect(264, 46, 2, 2, '#feae34'); rect(262, 48, 6, 2, '#733e39');
    // tv cabinet + tv
    rect(236, 112, 66, 30, '#733e39'); rect(238, 115, 30, 12, '#8a4a38'); rect(270, 115, 30, 12, '#8a4a38');
    rect(236, 112, 66, 2, '#b86f50');
    rect(240, 76, 58, 36, '#181425'); rect(242, 78, 54, 30, '#262b44');
    rect(264, 108, 10, 4, '#262b44');
    px(292, 109, '#e43b44');
    // framed pictures: a sea painting and a photo of Sam
    rect(116, 6, 30, 24, '#733e39'); rect(118, 8, 26, 20, '#b86f50');
    paintGradient(gfx, 120, 10, 22, 16, [[0, '#8fd0f6'], [0.5, '#2690c0'], [1, '#124e89']], 2);
    for (let x = 120; x < 142; x++) px(x, 17 + Math.round(Math.sin(x * 0.7)), '#e8fbff');
    rect(128, 20, 5, 3, '#f77622'); px(127, 21, '#f77622'); px(132, 21, '#181425');
    rect(152, 10, 18, 20, '#fee761'); rect(154, 12, 14, 16, '#fff6c9');
    rect(157, 15, 8, 8, '#e8b796'); rect(156, 13, 10, 3, '#733e39'); px(159, 18, '#181425'); px(162, 18, '#181425');
    rect(155, 23, 12, 5, '#e43b44');
    // dartboard
    disc(212, 64, 7, '#3e2731'); disc(212, 64, 6, '#181425'); ring(212, 64, 5, '#e43b44'); disc(212, 64, 3, '#e8eef7'); disc(212, 64, 1, '#e43b44');
    line(213, 63, 218, 58, '#fee761'); px(219, 57, '#e43b44');
    // light switch
    rect(186, 76, 5, 8, '#e8eef7'); rect(188, 78, 1, 3, '#8b9bb4');
    // tall leafy plant standing behind the table
    rect(80, 126, 16, 14, '#b86f50'); rect(79, 126, 18, 2, '#c28569');
    const leaf = (x, y, dx, dy, c) => { for (let i = 0; i < 8; i++) rect(x + Math.round(dx * i), y + Math.round(dy * i), 3, 2, c); };
    leaf(88, 124, -1.4, -2.6, '#3e8948'); leaf(88, 124, 0.2, -3.4, '#63c74d'); leaf(88, 124, 1.5, -2.4, '#3e8948');
    leaf(88, 124, -2.2, -1.2, '#265c42'); leaf(88, 124, 2.2, -1.4, '#63c74d');
    // guitar leaning against the wall
    thickLine(222, 88, 230, 62, 1, '#5a3a2e');
    for (let i = 0; i < 4; i++) px(229 - i * 0.3, 60 + i, '#c0cbdc');
    ellipse(219, 112, 8, 10, '#be4a2f'); ellipse(221, 99, 6, 7, '#be4a2f');
    ellipse(219, 111, 6, 8, '#e4a672'); ellipse(221, 99, 4, 5, '#e4a672');
    disc(220, 106, 2, '#3e2731'); rect(216, 116, 7, 2, '#5a3a2e');
    line(221, 88, 219, 116, '#ffffff');
    // table
    rect(0, 140, W, 16, '#c28569');
    for (let x = 0; x < W; x += 1) if ((x * 7) % 23 === 0) rect(x, 141 + (x % 5), 14, 1, '#b86f50');
    rect(0, 140, W, 1, '#e4a672');
    rect(0, 156, W, 6, '#8a5a40');
    rect(0, 156, W, 1, '#733e39');
    rect(0, 162, W, 18, '#3e2731');
    rect(16, 162, 8, 18, '#5a3a2e'); rect(296, 162, 8, 18, '#5a3a2e');
    // stuff on the table: a cactus, a mug and a rubber duck
    rect(22, 132, 8, 8, '#b86f50'); rect(21, 131, 10, 2, '#c28569');
    rect(24, 120, 4, 11, '#3e8948'); rect(21, 123, 3, 2, '#3e8948'); rect(21, 121, 1, 3, '#3e8948'); rect(28, 125, 3, 2, '#3e8948'); rect(30, 122, 1, 4, '#3e8948');
    px(25, 119, '#f6757a'); px(26, 124, '#63c74d');
    rect(246, 131, 9, 9, '#e8eef7'); rect(255, 133, 2, 4, '#e8eef7'); rect(246, 131, 9, 2, '#8a5a40'); rect(248, 135, 5, 2, '#e43b44');
    rect(264, 135, 9, 5, '#fee761'); rect(266, 131, 5, 5, '#fee761'); px(271, 133, '#f77622'); px(272, 133, '#f77622'); px(268, 132, '#181425');
    // under the table: a striped rug, slippers and a ball
    for (let x = 30; x < 290; x++) rect(x, 170, 1, 10, ((x >> 3) % 3) === 0 ? '#a22633' : ((x >> 3) % 3) === 1 ? '#733e39' : '#be4a2f');
    rect(30, 170, 260, 1, '#e4a672');
    rect(70, 172, 10, 5, '#f6757a'); rect(82, 173, 10, 5, '#f6757a'); rect(70, 172, 4, 2, '#ffffff'); rect(82, 173, 4, 2, '#ffffff');
    disc(250, 173, 5, '#0099db'); rect(245, 172, 11, 2, '#fee761'); px(248, 170, '#ffffff');
    // lamp on the table (right)
    rect(290, 110, 2, 30, '#5a6988'); rect(284, 104, 14, 7, '#fee761'); rect(285, 103, 12, 1, '#feae34'); rect(286, 138, 10, 2, '#5a6988');
    setTarget(prev);
    this.room = c;
    // window skies for different times of day
    const sky = stops => gradientCanvas(58, 58, stops, 2);
    this.skies = {
      dawn: sky([[0, '#4a2667'], [0.5, '#f07d5a'], [1, '#fcd27a']]),
      day: sky([[0, '#4aa8ec'], [0.7, '#8fd0f6'], [1, '#c8ecfb']]),
      dusk: sky([[0, '#2d1b4e'], [0.5, '#a8406e'], [1, '#f9a857']]),
      night: sky([[0, '#07060f'], [1, '#1b1238']]),
    };
  }

  buildGravel() {
    const c = makeCanvas(BOWL.R * 2, 20), g = c.getContext('2d'), prev = setTarget(g);
    const r = mulberry32(3);
    const cols = ['#f6757a', '#fee761', '#2ce8f5', '#63c74d', '#ffffff', '#feae34', '#b55088', '#0099db'];
    for (let y = 0; y < 20; y++) for (let x = 0; x < BOWL.R * 2; x++) px(x, y, (x + y) % 3 ? '#c28569' : '#a8705a');
    for (let i = 0; i < 160; i++) {
      const x = Math.floor(r() * BOWL.R * 2), y = Math.floor(r() * 18);
      const col = cols[Math.floor(r() * cols.length)];
      rect(x, y, 2, 2, col);
      px(x, y, mix(col, '#ffffff', 0.4));
    }
    setTarget(prev);
    return c;
  }

  draw() {
    const [sx, sy] = Game.shakeOffset();
    gfx.save();
    gfx.translate(sx, sy);
    const t = this.t, b = this.b;
    blit(this.room, 0, 0);
    this.drawWindow();
    this.drawClock();
    this.drawCalendar();
    this.drawTV();
    this.drawShelfArmy();
    this.drawTableStuff();
    this.drawCatBack();
    this.drawBowl();
    this.drawCatFront();
    this.drawHand();
    // lava lamp on the table
    if (this.item('lava')) {
      const lx = 98;
      rect(lx - 3, 136, 7, 4, '#3a4466'); rect(lx - 2, 120, 5, 16, '#68386c'); rect(lx - 3, 118, 7, 2, '#3a4466');
      for (let i = 0; i < 3; i++) disc(lx, 122 + ((t * 5 + i * 5) % 13), 1.2, '#f77622');
    }
    // robot vacuum bumbling around under the table
    if (this.item('vacuum')) {
      const vx = 150 + Math.sin(t * 0.4) * 110;
      ellipse(vx, 176, 9, 3, '#3a4466'); ellipse(vx, 175, 8, 2, '#5a6988'); px(vx + 4, 174, Math.floor(t * 4) % 2 ? '#63c74d' : '#e43b44');
    }
    // lighting
    const L = this.lightLevel();
    if (L > 0) {
      gfx.globalAlpha = L;
      rect(0, 0, W, H, '#0b0a2a');
      gfx.globalAlpha = 1;
      if (L > 0.2) {
        if (!this.glow) {
          this.glow = makeCanvas(95, 95);
          const g = this.glow.getContext('2d'), prev = setTarget(g);
          for (const [r, a] of [[46, 0.08], [30, 0.1], [16, 0.12]]) { g.globalAlpha = a; disc(47, 47, r, '#fee761'); }
          setTarget(prev);
        }
        blit(this.glow, 291 - 47, 116 - 47);
        rect(284, 104, 14, 7, '#fff6c9');
      }
    }
    this.drawCelebration();
    this.parts.draw();
    this.floaters.draw();
    gfx.restore();
    this.drawSpeech();
    this.drawHUD();
    if (this.banner) this.drawBanner();
    if (this.sleep) this.drawSleep();
    if (this.shop) this.drawShop();
    if (this.gamesMenu) this.drawGames();
    if (this.exploreMenu) this.drawExplore();
    if (this.tutorial) this.dlg.draw('bottom');
    if (this.pause.open) this.pause.draw();
  }

  drawWindow() {
    const m = this.b.min;
    const x = 11, y = 37;
    let a = 'day', bb = 'day', k = 0;
    if (this.sleep) { a = 'night'; bb = 'night'; }
    else if (m < 480) { a = 'dawn'; bb = 'day'; k = (m - DAY_START) / 90; }
    else if (m < 1080) { a = 'day'; bb = 'day'; }
    else if (m < 1200) { a = 'day'; bb = 'dusk'; k = (m - 1080) / 120; }
    else { a = 'dusk'; bb = 'night'; k = clamp((m - 1200) / 120, 0, 1); }
    blit(this.skies[a], x, y);
    if (k > 0) { gfx.globalAlpha = k; blit(this.skies[bb], x, y); gfx.globalAlpha = 1; }
    const night = this.sleep || m > 1230;
    if (night) {
      for (let i = 0; i < 10; i++) if (Math.sin(this.t * 2 + i * 7) > -0.3) px(x + 4 + ((i * 23) % 50), y + 4 + ((i * 13) % 30), '#ffffff');
      disc(x + 44, y + 12, 5, '#fff6c9'); disc(x + 46, y + 10, 4, this.sleep ? '#07060f' : '#1b1238');
    } else {
      const sunY = y + 50 - Math.sin(clamp((m - DAY_START) / (BED_TIME - DAY_START), 0, 1) * Math.PI) * 40;
      disc(x + 40, sunY, 5, '#fff6c9');
      for (let i = 0; i < 2; i++) {
        const cx = x + ((i * 31 + this.t * 3) % 70) - 10;
        rect(cx, y + 10 + i * 12, 14, 3, '#ffffff'); rect(cx + 3, y + 8 + i * 12, 7, 2, '#ffffff');
      }
    }
    // distant rooftops
    rect(x, y + 46, 58, 12, '#3a4466');
    rect(x + 4, y + 40, 12, 18, '#3a4466'); rect(x + 30, y + 42, 16, 16, '#262b44');
    for (let i = 0; i < 4; i++) px(x + 7 + i * 3, y + 44, night ? '#fee761' : '#5a6988');
    // giant robot under construction
    if (this.owned('robot')) {
      const rx = x + 34, ry = y + 8 + Math.round(Math.sin(this.t) * 0.5);
      rect(rx, ry + 8, 12, 16, '#5a6988'); rect(rx + 1, ry + 9, 10, 2, '#8b9bb4');
      ring(rx + 6, ry + 4, 5, '#c8f4ff'); px(rx + 6, ry + 4, '#f77622'); px(rx + 5, ry + 4, '#f77622');
      rect(rx - 3, ry + 10, 3, 10, '#5a6988'); rect(rx + 12, ry + 10, 3, 10, '#5a6988');
      if (Math.floor(this.t * 2) % 2) px(rx + 6, ry - 2, '#e43b44');
    }
    // window cross + curtains
    rect(x + 28, y, 2, 58, '#e8eef7');
    rect(x, y + 28, 58, 2, '#e8eef7');
    rect(4, 30, 10, 70, '#b55088'); rect(66, 30, 10, 70, '#b55088');
    for (let yy = 30; yy < 100; yy += 3) { px(6, yy, '#68386c'); px(72, yy, '#68386c'); }
    rect(2, 28, 76, 3, '#733e39');
  }

  drawClock() {
    const cx = 100, cy = 44;
    disc(cx, cy, 9, '#3e2731');
    disc(cx, cy, 8, '#ffffff');
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; px(cx + Math.round(Math.sin(a) * 7), cy - Math.round(Math.cos(a) * 7), '#8b9bb4'); }
    const m = this.b.min % 720;
    const ha = (m / 720) * Math.PI * 2, ma = ((m % 60) / 60) * Math.PI * 2;
    line(cx, cy, cx + Math.sin(ha) * 4, cy - Math.cos(ha) * 4, '#181425');
    line(cx, cy, cx + Math.sin(ma) * 6, cy - Math.cos(ma) * 6, '#e43b44');
    px(cx, cy, '#181425');
  }

  drawCalendar() {
    const x = 196, y = 30;
    rect(x, y, 20, 22, '#ffffff'); rect(x, y, 20, 6, '#e43b44');
    rect(x + 4, y - 1, 1, 3, '#3e2731'); rect(x + 15, y - 1, 1, 3, '#3e2731');
    text('DAY', x + 10, y + 1, '#ffffff', { font: F3, align: 'center' });
    text(String(this.b.day), x + 10, y + 10, '#181425', { align: 'center' });
  }

  drawTV() {
    const x = 242, y = 78, w = 54, h = 30;
    if (!this.owned('tv')) {
      line(x + 4, y + 4, x + 14, y + 14, '#3a4466');
      return;
    }
    const t = this.t;
    if (this.tvT < 0.3) {
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx += 2) if (Math.random() < 0.5) rect(x + xx, y + yy, 2, 1, Math.random() < 0.5 ? '#c0cbdc' : '#5a6988');
      return;
    }
    const ch = this.tvCh;
    if (ch === 0 || ch === 2) {
      // news desk
      rect(x, y, w, h, '#124e89');
      for (let i = 0; i < 4; i++) rect(x + 2 + i * 14, y + 2, 10, 6, '#0b3a6b');
      rect(x + 20, y + 8, 12, 12, '#e8b796'); rect(x + 19, y + 7, 14, 4, '#3e2731');
      if (Math.floor(t * 6) % 2) rect(x + 24, y + 16, 4, 1, '#a22633');
      px(x + 23, y + 13, '#181425'); px(x + 28, y + 13, '#181425');
      rect(x + 16, y + 20, 20, 10, '#262b44');
      rect(x, y + h - 7, w, 7, '#e43b44');
      text('NEWS', x + 3, y + h - 6, '#ffffff', { font: F3 });
      if (this.owned('stocks')) { sprC('hero1', 0, x + 44, y + 10); }
    } else if (ch === 1) {
      // fish documentary
      paintGradient(gfx, x, y, w, h, [[0, '#2690c0'], [1, '#0e3258']], 2);
      for (let i = 0; i < 3; i++) sprC(['minnow', 'perch', 'guppy'][i], Math.floor(t * 4 + i) % 2, x + ((t * 10 + i * 20) % (w + 10)) - 5, y + 8 + i * 8);
    } else {
      // cartoon
      rect(x, y, w, h, '#fee761');
      rect(x, y + h - 6, w, 6, '#63c74d');
      const bx = x + 10 + ((t * 20) % (w - 20));
      disc(bx, y + h - 10 - Math.abs(Math.sin(t * 4)) * 12, 3, '#e43b44');
    }
    // screen shine
    rect(x + 2, y + 1, 10, 1, 'rgba(255,255,255,0.35)');
  }

  drawShelfArmy() {
    if (!this.owned('army')) return;
    for (let i = 0; i < 4; i++) {
      const x = 258 + i * 12, y = 49;
      ring(x, y - 5, 5, '#c8f4ff');
      rect(x - 4, y - 5, 9, 5, '#4fb8dc');
      rect(x - 3, y - 10, 7, 1, '#07060f');
      const sal = Math.floor(this.t * 2 + i) % 4 === 0;
      rect(x - 2, y - 4, 4, 2, ['#f77622', '#0099db', '#63c74d', '#f6757a'][i]);
      px(x + 1, y - 4, '#181425');
      if (sal) px(x, y - 6, '#fee761');
    }
  }

  drawTableStuff() {
    const t = this.t;
    // chalkboard
    if (this.owned('math')) {
      rect(16, 118, 34, 22, '#733e39'); rect(18, 120, 30, 18, '#265c42');
      text('1+1=', 20, 122, '#e8eef7', { font: F3 });
      sprC('hero0', 0, 41, 124);
      text('E=MC', 20, 130, '#e8eef7', { font: F3 });
      rect(50, 130, 2, 10, '#733e39');
    }
    // books
    if (this.owned('glasses')) {
      rect(196, 132, 18, 4, '#e43b44'); rect(197, 128, 16, 4, '#124e89'); rect(195, 124, 18, 4, '#3e8948');
      rect(196, 124, 1, 12, 'rgba(255,255,255,0.3)');
    }
    // laptop
    if (this.owned('laptop')) {
      const x = 44, y = 112;
      rect(x, y, 36, 24, '#3a4466'); rect(x + 2, y + 2, 32, 20, '#07060f');
      rect(x - 4, y + 24, 44, 4, '#8b9bb4'); rect(x - 4, y + 27, 44, 1, '#5a6988');
      if (this.owned('stocks')) {
        let prevY = y + 18;
        for (let i = 0; i < 28; i++) {
          const yy = y + 18 - Math.round(i * 0.5 + Math.sin(i * 0.9 + t * 2) * 2);
          line(x + 4 + i - 1, prevY, x + 4 + i, yy, '#63c74d');
          prevY = yy;
        }
        text('$', x + 28, y + 4, '#fee761', { font: F3 });
      } else {
        for (let i = 0; i < 5; i++) rect(x + 4 + ((i * 7) % 5), y + 4 + i * 3, 8 + ((i * 13 + Math.floor(t * 4)) % 16), 1, '#63c74d');
      }
      // cable into the bowl
      const bx = BOWL.cx - 34, by = this.cy - 20;
      for (let i = 0; i <= 20; i++) {
        const k = i / 20;
        px(lerp(x + 36, bx, k), lerp(y + 18, by, k) - Math.sin(k * Math.PI) * 10, '#181425');
      }
    }
  }

  drawBowl() {
    const cx = BOWL.cx, cy = this.cy, R = BOWL.R, t = this.t;
    const wt = this.waterTop(), gt = this.gravelTop(), bottom = cy + 42;
    // robot legs
    if (this.owned('legs')) {
      const k = this.lift / 8;
      for (const s of [-1, 1]) {
        const lx = cx + s * 14, step = Math.round(Math.sin(t * 3 + (s > 0 ? Math.PI : 0)) * 1);
        rect(lx - 2, bottom - 2, 5, Math.round(10 * k) + step, '#5a6988');
        rect(lx - 1, bottom - 1, 3, Math.round(10 * k), '#8b9bb4');
        rect(lx - 4 + s, bottom + Math.round(8 * k) + step, 9, 3, '#3a4466');
        disc(lx, bottom + Math.round(3 * k), 2, '#c0cbdc');
      }
    }
    // back rim of the opening
    const rimY = cy - 36, rimHW = Math.floor(Math.sqrt(R * R - 36 * 36));
    for (let x = -rimHW; x <= rimHW; x++) {
      const e = Math.sqrt(Math.max(0, 1 - (x * x) / (rimHW * rimHW)));
      px(cx + x, rimY - Math.round(e * 3), '#c8f4ff');
    }
    // water, gravel and the wobbling refraction of the room behind it,
    // baked into a few looping frames per bowl height
    blit(this.waterFrame(Math.floor(((t * 2) % (Math.PI * 2)) / (Math.PI * 2) * 8)), cx - R, wt);
    // castle or secret lab
    if (this.item('ship') && !this.owned('lab')) this.drawShip(cx - 22, gt + 2);
    else this.drawCastle(cx - 22, gt + 2);
    if (this.item('bubbles')) {
      rect(cx + 8, gt - 3, 10, 5, '#e43b44'); rect(cx + 11, gt - 6, 4, 3, '#8b9bb4');
      if (Math.random() < 0.3) this.parts.add({ type: 'bubble', x: cx + 13, y: gt - 7, vy: -rnd(15, 28), vx: rnd(-6, 6), life: 5, size: rndi(1, 3), c: '#e8fbff', minY: this.waterTop() + 1 });
    }
    // bought decorations
    if (this.item('plants')) {
      for (const [bx, hgt, c] of [[cx - 6, 18, '#3e8948'], [cx - 34, 12, '#63c74d'], [cx + 36, 10, '#265c42'], [cx + 2, 10, '#b55088']]) {
        for (let j = 0; j < hgt; j++) px(bx + Math.round(Math.sin(t * 1.4 + j * 0.35 + bx) * (j / 8)), gt + 2 - j, j % 3 ? c : mix(c, '#ffffff', 0.3));
        for (let j = 3; j < hgt; j += 4) px(bx + 1 + Math.round(Math.sin(t * 1.4 + j * 0.35 + bx) * (j / 8)), gt + 2 - j, c);
      }
    }
    if (this.item('treasure')) {
      const tx = cx + 24, open = Math.floor(t / 3) % 2 ? 3 : 0;
      rect(tx - 5, gt - 2, 11, 6, '#733e39'); rect(tx - 5, gt - 3, 11, 1, '#fee761'); px(tx, gt, '#fee761');
      rect(tx - 5, gt - 5 - open, 11, 3, '#8a5a40');
      if (open) { rect(tx - 3, gt - 3, 7, 1, '#fee761'); if (Math.random() < 0.25) this.parts.add({ type: 'bubble', x: tx + rnd(-3, 3), y: gt - 4, vy: -rnd(12, 22), life: 5, size: rndi(1, 2), c: '#fff6c9', minY: this.waterTop() + 1 }); }
    }
    // plant
    for (let i = 0; i < 3; i++) {
      const px0 = cx + 24 + i * 3;
      for (let j = 0; j < 14 + i * 3; j++) px(px0 + Math.round(Math.sin(t * 1.6 + j * 0.3 + i) * (j / 10)), gt + 2 - j, j % 3 ? '#3e8948' : '#63c74d');
    }
    // sticky note
    if (this.owned('memory')) {
      rect(cx + 30, cy - 12, 12, 11, '#fee761'); rect(cx + 30, cy - 12, 12, 2, '#feae34');
      rect(cx + 32, cy - 8, 8, 1, '#3e2731'); rect(cx + 32, cy - 5, 6, 1, '#3e2731');
    }
    // flakes, treats, ideas
    for (const f of this.flakes) {
      if (f.state === 'rest' && f.t < 1.5 && Math.floor(f.t * 8) % 2) continue;
      if (f.treat) { rect(f.x - 2, f.y - 1, 5, 3, '#b86f50'); px(f.x - 1, f.y - 1, '#e4a672'); px(f.x + 3, f.y, '#b86f50'); }
      else { rect(Math.round(f.x), Math.round(f.y), 2, 2, f.c); px(Math.round(f.x), Math.round(f.y), f.hi || (f.hi = mix(f.c, '#ffffff', 0.4))); }
    }
    for (const i of this.ideas) {
      if (i.life < 2 && Math.floor(i.life * 8) % 2) continue;
      const bob = Math.round(Math.sin(i.t * 4) * 1);
      const glow = Math.floor(i.t * 6) % 2;
      if (glow) { gfx.globalAlpha = 0.35; disc(i.x, i.y + bob, 6, i.gold ? '#fee761' : '#fff6c9'); gfx.globalAlpha = 1; }
      spr(i.gold ? 'bulbGold' : 'bulb', 0, Math.round(i.x - 2), Math.round(i.y - 4 + bob));
    }
    // the fish (you!)
    this.drawFish();
    // water surface line
    const shw = Math.floor(this.halfW(wt, 2));
    for (let x = -shw; x <= shw; x++) px(cx + x, wt + (Math.sin(x * 0.4 + t * 3) > 0.6 ? 1 : 0), '#bff4fb');
    // glass
    ring(cx, cy, R, '#c8f4ff', rimY);
    if (this.item('goldrim')) {
      ring(cx, cy, R, Math.floor(t * 3) % 4 ? '#feae34' : '#fee761', cy + 20);
      for (let x = -rimHW; x <= rimHW; x++) px(cx + x, rimY + Math.round(Math.sqrt(Math.max(0, 1 - (x * x) / (rimHW * rimHW))) * 2), '#fee761');
      for (let i = 0; i < 3; i++) if (Math.sin(t * 3 + i * 2) > 0.8) px(cx - 30 + i * 30, cy + 40 - i * 3, '#ffffff');
    }
    for (let x = -rimHW; x <= rimHW; x++) {
      const e = Math.sqrt(Math.max(0, 1 - (x * x) / (rimHW * rimHW)));
      px(cx + x, rimY + Math.round(e * 2), '#e8fbff');
    }
    px(cx - rimHW - 1, rimY, '#e8fbff'); px(cx + rimHW + 1, rimY, '#e8fbff');
    // highlights
    for (let a = -2.5; a < -1.7; a += 0.02) px(cx + Math.cos(a) * (R - 5), cy + Math.sin(a) * (R - 5) + 10, '#ffffff');
    for (let a = 0.5; a < 0.9; a += 0.03) px(cx + Math.cos(a) * (R - 4), cy + Math.sin(a) * (R - 4), 'rgba(255,255,255,0.6)');
    // antenna
    if (this.owned('wifi')) {
      const ax = cx + rimHW - 4, ay = rimY - 2;
      rect(ax, ay - 16, 1, 16, '#8b9bb4'); disc(ax, ay - 17, 1.5, '#e43b44');
      const k = (t * 1.5) % 1;
      for (let r = 0; r < 3; r++) {
        const rr = 3 + ((r + k) * 4);
        gfx.globalAlpha = 1 - (r + k) / 3;
        for (let a = -0.9; a <= 0.9; a += 0.15) { px(ax + Math.sin(a) * rr, ay - 17 - Math.cos(a) * rr, '#2ce8f5'); }
      }
      gfx.globalAlpha = 1;
    }
    // FishCorp flag
    if (this.owned('corp')) {
      const fx = cx - rimHW + 3, fy = rimY - 2;
      rect(fx, fy - 18, 1, 18, '#c0cbdc');
      const wave = Math.floor(t * 4) % 2;
      rect(fx + 1, fy - 18 + wave, 12, 7, '#f77622'); rect(fx + 1, fy - 18 + wave, 12, 1, '#feae34');
      text('FC', fx + 3, fy - 17 + wave, '#ffffff', { font: F3 });
    }
  }

  waterFrame(f) {
    const cy = this.cy;
    if (this._waterCy !== cy) { this._waterCy = cy; this._water = []; }
    if (this._water[f]) return this._water[f];
    const cx = BOWL.cx, R = BOWL.R, wt = this.waterTop(), gt = this.gravelTop(), bottom = cy + 42;
    const c = makeCanvas(R * 2 + 1, bottom - wt + 1), g = c.getContext('2d'), prev = setTarget(g);
    const ox = cx - R, oy = wt, phase = (f / 8) * Math.PI * 2;
    for (let y = wt; y <= bottom; y++) {
      const hw = Math.floor(this.halfW(y, 2));
      if (hw <= 0) continue;
      const wob = Math.round(Math.sin(y * 0.35 + phase));
      g.drawImage(this.room, cx - hw + wob, y, hw * 2 + 1, 1, cx - hw - ox, y - oy, hw * 2 + 1, 1);
    }
    g.globalAlpha = 0.5;
    for (let y = wt; y <= bottom; y++) {
      const hw = Math.floor(this.halfW(y, 2));
      if (hw <= 0) continue;
      rect(cx - hw - ox, y - oy, hw * 2 + 1, 1, y < wt + 20 ? '#3fb4dc' : y < wt + 45 ? '#2f9ccc' : '#2688bc');
    }
    g.globalAlpha = 1;
    for (let y = gt; y <= bottom - 1; y++) {
      const hw = Math.floor(this.halfW(y, 3));
      if (hw <= 0) continue;
      g.drawImage(this.gravel, R - hw, y - gt, hw * 2 + 1, 1, cx - hw - ox, y - oy, hw * 2 + 1, 1);
    }
    setTarget(prev);
    return (this._water[f] = c);
  }

  drawShip(x, gy) {
    rect(x - 12, gy - 8, 24, 7, '#733e39'); rect(x - 14, gy - 10, 5, 3, '#733e39'); rect(x + 10, gy - 11, 5, 4, '#733e39');
    for (let i = 0; i < 3; i++) disc(x - 6 + i * 6, gy - 5, 1, '#3e2731');
    rect(x - 1, gy - 26, 2, 18, '#5a3a2e'); rect(x - 8, gy - 24, 7, 8, '#e8eef7'); rect(x + 1, gy - 22, 6, 6, '#c0cbdc');
    rect(x - 1, gy - 29, 6, 3, '#181425'); px(x + 2, gy - 28, '#ffffff');
  }

  drawCastle(x, gy) {
    const lab = this.owned('lab'), t = this.t;
    if (!lab) {
      rect(x - 7, gy - 16, 14, 16, '#8b9bb4');
      rect(x - 9, gy - 20, 4, 6, '#8b9bb4'); rect(x + 5, gy - 20, 4, 6, '#8b9bb4');
      rect(x - 3, gy - 24, 6, 8, '#a8b4c8');
      for (let i = 0; i < 3; i++) px(x - 3 + i * 2, gy - 25, '#a8b4c8');
      rect(x - 2, gy - 7, 4, 7, '#262b44');
      rect(x - 1, gy - 20, 2, 3, '#262b44');
      rect(x - 7, gy - 16, 14, 1, '#c0cbdc');
    } else {
      ellipse(x, gy - 8, 10, 8, '#5a6988');
      ellipse(x, gy - 9, 9, 7, '#8b9bb4');
      ellipse(x, gy - 10, 7, 5, '#b4f08c');
      rect(x - 10, gy - 4, 20, 4, '#3a4466');
      for (let i = 0; i < 4; i++) px(x - 8 + i * 5, gy - 3, Math.floor(t * 4 + i) % 2 ? '#e43b44' : '#fee761');
      rect(x + 7, gy - 16, 3, 8, '#c8f4ff'); rect(x + 7, gy - 12, 3, 4, '#63c74d');
      px(x - 2, gy - 12, '#ffffff');
    }
  }

  drawFish() {
    const f = this.fish, t = this.t;
    const s = SPR.hero2;
    const x = Math.round(f.x - s.w / 2), y = Math.round(f.y - s.h / 2 + (Math.sin(f.anim * 0.7) > 0.6 ? 1 : 0));
    const flip = f.facing < 0;
    spr('hero2', Math.floor(f.anim) % 2, x, y, flip, f.stun > 0 && Math.floor(t * 12) % 2 === 0);
    // accessories (offsets are for a right-facing fish)
    const acc = (name, ax, ay) => {
      const a = SPR[name];
      const dx = flip ? s.w - ax - a.w : ax;
      spr(name, 0, x + dx, y + ay, flip);
    };
    if (this.owned('corp')) acc('tie', 12, 11);
    if (this.item('shades')) acc('shades', 11, 5);
    else if (this.owned('glasses')) acc('glasses', 11, 5);
    if (this.owned('mind')) acc('helmet', 9, -3);
    if (this.item('crown')) acc('crown', 8, this.owned('mind') ? -8 : -3);
    else if (this.item('hat')) acc('partyhat', 8, this.owned('mind') ? -10 : -5);
    if (this.item('stache')) acc('stache', 14, 9);
    // brain glow while thinking hard
    if (this.owned('mind') && Math.floor(t * 3) % 2) {
      gfx.globalAlpha = 0.5;
      ring(f.x, f.y - 4, 10 + ((t * 20) % 8), '#b55088');
      gfx.globalAlpha = 1;
    }
  }

  drawCatBack() {
    // the hypnotised cat sits on the table, right of the bowl
    if (this.owned('cat')) {
      const x = 226, y = 140, t = this.t;
      const flick = this.catFlick > 0;
      // body
      ellipse(x, y - 10, 11, 10, '#5a6988');
      ellipse(x, y - 9, 10, 9, '#8b9bb4');
      ellipse(x - 1, y - 6, 6, 5, '#c0cbdc');
      // tail
      for (let i = 0; i < 10; i++) px(x + 10 + i * 0.7, y - 4 - i + Math.round(Math.sin(t * 2 + i * 0.4) * 2), '#8b9bb4');
      // head
      const hy = y - 26;
      ellipse(x, hy, 9, 7, '#8b9bb4');
      rect(x - 8, hy - 9, 3, 5, '#8b9bb4'); rect(x + 6, hy - 9, 3, 5, '#8b9bb4');
      px(x - 7, hy - 7, '#f6757a'); px(x + 7, hy - 7, '#f6757a');
      rect(x - 7, hy - 5, 14, 1, '#5a6988');
      // hypno eyes
      for (const ex of [x - 4, x + 4]) {
        ring(ex, hy, 2.5, '#b55088');
        px(ex, hy, Math.floor(t * 6) % 2 ? '#fee761' : '#b55088');
      }
      px(x, hy + 3, '#f6757a');
      text(Math.floor(t) % 3 === 0 ? '~' : '', x + 10, hy - 12, '#b55088', { font: F3 });
      // paw
      const pawY = flick ? y - 18 : y - 2;
      ellipse(x - 8, pawY, 3, 2, '#c0cbdc');
      return;
    }
    if (!this.cat) return;
    const c = this.cat;
    // the cat creeps up from behind the table
    const rise = c.phase === 'peek' ? easeOut(clamp(c.t / 0.8, 0, 1)) : c.phase === 'leave' ? 1 - clamp(c.t / 1, 0, 1) : 1;
    const hx = 236, hy = Math.round(152 - rise * 34);
    ellipse(hx, hy + 12, 14, 10, '#5a6988');
    ellipse(hx, hy, 12, 9, '#5a6988');
    ellipse(hx, hy, 11, 8, '#8b9bb4');
    rect(hx - 10, hy - 12, 4, 6, '#8b9bb4'); rect(hx + 7, hy - 12, 4, 6, '#8b9bb4');
    px(hx - 9, hy - 10, '#f6757a'); px(hx + 8, hy - 10, '#f6757a');
    for (let i = -8; i <= 8; i += 4) px(hx + i, hy - 7, '#5a6988');
    // eyes follow the fish
    const look = clamp((this.fish.x - hx) / 40, -1, 1);
    for (const ex of [hx - 5, hx + 5]) {
      ellipse(ex, hy - 1, 2, 2, '#fee761');
      rect(ex + Math.round(look), hy - 3, 1, 4, '#181425');
    }
    px(hx, hy + 3, '#f6757a');
    line(hx - 3, hy + 5, hx, hy + 4, '#3e2731'); line(hx, hy + 4, hx + 3, hy + 5, '#3e2731');
    for (const s of [-1, 1]) { line(hx + s * 4, hy + 3, hx + s * 14, hy + 1, '#e8eef7'); line(hx + s * 4, hy + 4, hx + s * 14, hy + 5, '#e8eef7'); }
    if (c.phase === 'peek' && Math.floor(c.t * 6) % 2) text('!', hx, hy - 24, '#ff5a5a', { align: 'center', outline: '#2a0a14' });
  }

  drawCatFront() {
    if (!this.cat || this.owned('cat')) return;
    const c = this.cat;
    if (c.phase === 'peek') return;
    // arm: shoulder -> over the rim -> paw
    const sx = 226, sy = 128;
    const rimX = BOWL.cx + 26, rimY = this.cy - 40;
    const k = c.phase === 'leave' ? 1 - clamp(c.t / 0.6, 0, 1) : 1;
    const px0 = lerp(rimX, c.px, k), py0 = lerp(rimY, c.py, k);
    thickLine(sx, sy, rimX, rimY, 4, '#5a6988');
    thickLine(sx, sy, rimX, rimY, 3, '#8b9bb4');
    thickLine(rimX, rimY, px0, py0, 4, '#5a6988');
    thickLine(rimX, rimY, px0, py0, 3, '#8b9bb4');
    // tabby stripes
    for (let i = 1; i < 7; i++) {
      const a = lerp(sx, rimX, i / 7), bb = lerp(sy, rimY, i / 7);
      thickLine(a - 2, bb - 2, a + 2, bb + 2, 0.5, '#5a6988');
    }
    for (let i = 1; i < 4; i++) {
      const a = lerp(rimX, px0, i / 4), bb = lerp(rimY, py0, i / 4);
      thickLine(a - 3, bb, a + 3, bb, 0.5, '#5a6988');
    }
    disc(px0, py0 + 1, 5, '#8b9bb4');
    disc(px0, py0 + 1, 4, '#c0cbdc');
    for (let i = -2; i <= 2; i += 2) { px(px0 + i, py0 + 5, '#ffffff'); px(px0 + i, py0 + 4, '#f6757a'); }
  }

  drawHand() {
    if (!this.feed) return;
    const f = this.feed;
    let k = 1;
    if (f.phase === 'in') k = easeOut(clamp(f.t / 1.1, 0, 1));
    if (f.phase === 'out') k = 1 - easeIn(clamp(f.t / 1.1, 0, 1));
    const shake = f.phase === 'shake' ? Math.round(Math.sin(f.t * 28) * 2) : 0;
    const hx = Math.round(lerp(W + 40, BOWL.cx + 34, k)), hy = Math.round(lerp(-30, this.waterTop() - 44, k)) + shake;
    // arm from the top right corner
    thickLine(hx + 10, hy - 4, W + 30, -40, 7, '#c28569');
    thickLine(hx + 10, hy - 4, W + 30, -40, 6, '#e8b796');
    thickLine(hx + 44, hy - 34, W + 40, -60, 9, this.owned('mind') ? '#262b44' : '#e43b44');
    // food can, tipped over the bowl
    rect(hx - 20, hy - 4, 22, 11, '#124e89');
    rect(hx - 20, hy - 1, 22, 5, '#fee761');
    text('FOOD', hx - 17, hy, '#e43b44', { font: F3 });
    rect(hx - 23, hy - 3, 3, 9, '#8b9bb4');
    // fist
    rect(hx, hy - 6, 14, 14, '#c28569');
    rect(hx + 1, hy - 5, 12, 12, '#e8b796');
    for (let i = 0; i < 3; i++) rect(hx + 1, hy - 3 + i * 3, 3, 1, '#c28569');
  }

  drawSpeech() {
    const s = this.bubble;
    if (!s) return;
    const w = Math.max(...s.lines.map(l => textW(l))) + 14, h = s.lines.length * 10 + 8;
    const x = Math.round(clamp(BOWL.cx + 40 - w, 70, W - w - 6)), y = 34;
    panel(x, y, w, h, { fill: '#ffffff', border: '#ffffff', dark: '#3e2731', shine: false });
    for (let i = 0; i < 4; i++) rect(x + w - 16 + i, y + h - 1 + i, 4 - i, 1, '#ffffff');
    px(x + w - 17, y + h, '#3e2731');
    let ly = y + 5;
    for (const l of s.lines) { text(l, x + 7, ly, this.owned('lips') ? '#262b44' : '#8b9bb4'); ly += 10; }
    text('SAM', x + 4, y - 7, '#ffffff', { font: F3, outline: '#3e2731' });
  }

  drawHUD() {
    const b = this.b;
    // IQ panel
    panel(2, 2, 104, 30, { fill: '#141330', alpha: 0.9 });
    spr('brain', 0, 7, 7);
    text('IQ ' + fmt(b.iq), 17, 7, '#ffffff');
    const rate = this.passive() * this.energyMult();
    text('+' + fmt(rate) + '/S', 17, 17, '#b4f08c', { font: F3 });
    text(ERAS[this.era], 101, 17, '#fee761', { font: F3, align: 'right' });
    // energy
    text('ENERGY', 7, 24, '#ead4aa', { font: F3 });
    rect(33, 24, 52, 5, '#07060f');
    const ec = b.energy > 50 ? '#63c74d' : b.energy > 25 ? '#fee761' : '#e43b44';
    if (!(b.energy < 20 && Math.floor(this.t * 4) % 2)) rect(34, 25, Math.round(50 * b.energy / 100), 3, ec);
    text('X' + this.energyMult().toFixed(1), 101, 24, '#c0cbdc', { font: F3, align: 'right' });
    // day & time panel
    panel(W - 92, 2, 90, 30, { fill: '#141330', alpha: 0.9 });
    const m = Math.floor(b.min), hh = Math.floor(m / 60), mm = Math.floor(m % 60 / 10) * 10;
    const h12 = ((hh + 11) % 12) + 1;
    text('DAY ' + b.day, W - 86, 7, '#ffffff');
    text(h12 + ':' + String(mm).padStart(2, '0') + (hh < 12 ? 'AM' : 'PM'), W - 7, 7, '#9fe8f5', { align: 'right' });
    text('MEALS', W - 86, 18, '#ead4aa', { font: F3 });
    for (let i = 0; i < 5; i++) spr(b.fed[i] ? 'flakeIcon' : 'flakeIconEmpty', 0, W - 62 + i * 6, 17);
    const nextMeal = FEED_TIMES.find((ft, i) => !b.fed[i]);
    if (nextMeal !== undefined) {
      const nh = Math.floor(nextMeal / 60), nm = nextMeal % 60;
      text('NEXT ' + (((nh + 11) % 12) + 1) + ':' + String(nm).padStart(2, '0'), W - 7, 24, '#8b9bb4', { font: F3, align: 'right' });
    } else text('BEDTIME SOON', W - 7, 24, '#8b9bb4', { font: F3, align: 'right' });
    // upgrade button
    const [ux, uy, uw, uh] = this.upgradeButtonRect();
    const next = this.nextUpgrade();
    const can = next && b.iq >= next.cost;
    const pulse = can && Math.floor(this.t * 3) % 2 === 0;
    panel(ux, uy, uw, uh, { fill: can ? '#265c42' : '#141330', border: pulse ? '#fee761' : '#8b9bb4', alpha: 0.92 });
    if (next) {
      text((can ? '▶ ' : '') + next.name, ux + 6, uy + 4, can ? '#fee761' : '#ffffff', { font: F3 });
      text(fmt(next.cost) + ' IQ', ux + 6, uy + 11, can ? '#b4f08c' : '#8b9bb4', { font: F3 });
      text(Input.touchSeen ? 'TAP' : 'TAB', ux + uw - 5, uy + 11, '#8b9bb4', { font: F3, align: 'right' });
      // progress towards the next upgrade
      const k = clamp(b.iq / next.cost, 0, 1);
      rect(ux + 3, uy + uh - 3, Math.round((uw - 6) * k), 1, can ? '#fee761' : '#0099db');
    }
    touchPauseButton(W - 17, 35);
    // mini-games button
    if (this.hasGames()) {
      const [gx, gy, gw, gh] = this.gamesButtonRect();
      const bonus = Object.keys(this.b.gamesWon).some(id => (this.b.played || {})[id] !== this.b.day);
      panel(gx, gy, gw, gh, { fill: bonus ? '#68386c' : '#141330', border: bonus && Math.floor(this.t * 3) % 2 ? '#fee761' : '#8b9bb4', alpha: 0.92 });
      text('GAMES', gx + 6, gy + 4, '#ffffff', { font: F3 });
      text(Input.touchSeen ? 'TAP' : 'G KEY', gx + 6, gy + 11, bonus ? '#f6a0c8' : '#8b9bb4', { font: F3 });
    }
    // explore button
    if (this.canExplore()) {
      const [ex, ey, ew, eh] = this.exploreButtonRect();
      panel(ex, ey, ew, eh, { fill: '#265c42', border: Math.floor(this.t * 2) % 2 ? '#b4f08c' : '#8b9bb4', alpha: 0.92 });
      text('EXPLORE', ex + 6, ey + 4, '#ffffff', { font: F3 });
      text(Input.touchSeen ? 'TAP' : 'X KEY', ex + 6, ey + 11, '#b4f08c', { font: F3 });
    }
    // disco ball
    if (this.item('disco')) {
      line(190, 0, 190, 10, '#8b9bb4'); disc(190, 16, 6, '#c0cbdc');
      for (let i = 0; i < 5; i++) px(186 + ((i * 3 + Math.floor(this.t * 8)) % 9), 12 + (i * 5) % 9, '#ffffff');
    }
    // news ticker
    if (this.owned('tv')) {
      rect(0, H - 9, W, 9, '#a22633');
      rect(0, H - 9, W, 1, '#e43b44');
      text(this.news, Math.round(this.newsX), H - 7, '#ffffff', { font: F3 });
      rect(0, H - 9, 34, 9, '#fee761');
      text('LIVE', 6, H - 7, '#a22633', { font: F3 });
    }
  }

  drawBanner() {
    const bn = this.banner;
    const k = clamp((3.2 - bn.t) * 4, 0, 1);
    const y = Math.round(lerp(-30, 44, easeOut(k)));
    drawBig(bn.title, W / 2, y, bn.style || 'gold');
    if (bn.sub) text(bn.sub, W / 2, y + 26, '#ffffff', { align: 'center', outline: '#07060f', accent: '#fee761' });
  }

  drawSleep() {
    const s = this.sleep;
    if (s.t > 2.2 && s.t < 4.6) {
      const k = clamp(Math.min(s.t - 2.2, 4.6 - s.t) * 3, 0, 1);
      ditherRect(0, 0, W, H, '#07060f', k);
      if (k > 0.8) {
        drawBig('GOOD NIGHT', W / 2, 70, 'aqua');
        text('ZZZ...', W / 2, 100, '#8b9bb4', { align: 'center' });
      }
    }
  }

  drawShop() {
    const s = this.shop, b = this.b;
    gfx.globalAlpha = 0.6;
    rect(0, 0, W, H, '#07060f');
    gfx.globalAlpha = 1;
    panel(8, 12, 304, 158, { fill: '#141330' });
    text('BRAIN UPGRADES', 16, 19, '#fee761');
    text('IQ ' + fmt(b.iq), W - 30, 19, '#ffffff', { align: 'right' });
    // close button
    panel(W - 22, 14, 14, 14, { fill: '#a22633' });
    text('×', W - 15, 18, '#ffffff', { align: 'center' });
    rect(14, 30, 292, 1, '#3a4466');
    const nextIdx = UPGRADES.indexOf(this.nextUpgrade());
    const rows = SHOP_ROWS;
    for (let r = 0; r < rows; r++) {
      const i = s.scroll + r;
      if (i >= UPGRADES.length) break;
      const u = UPGRADES[i], y = 36 + r * 11;
      const own = !!b.owned[u.id], isNext = i === nextIdx, locked = !own && !isNext;
      const hidden = locked && i > nextIdx + 1;
      if (i === s.sel) { rect(13, y - 2, 140, 11, '#262b44'); rect(13, y - 2, 1, 11, '#fee761'); }
      let icon = own ? '✓' : isNext ? '▶' : '•', col = own ? '#63c74d' : isNext ? '#fee761' : '#5a6988';
      text(icon, 17, y, col);
      text(hidden ? '???' : u.name, 27, y, own ? '#8b9bb4' : isNext ? '#ffffff' : '#5a6988');
    }
    if (s.scroll > 0) text('↑', 150, 34, '#8b9bb4');
    if (s.scroll + rows < UPGRADES.length) text('↓', 150, 150, '#8b9bb4');
    // details
    rect(160, 34, 1, 128, '#3a4466');
    const u = UPGRADES[s.sel], own = !!b.owned[u.id], isNext = s.sel === nextIdx;
    const hidden = !own && s.sel > nextIdx + 1;
    text(hidden ? '???' : u.name, 168, 36, '#fee761');
    const desc = hidden ? 'KEEP GETTING SMARTER TO FIND OUT...' : u.desc;
    let y = 48;
    for (const l of wrap(desc, 136, F5)) { text(l, 168, y, '#c0cbdc'); y += 10; }
    y += 4;
    if (!hidden && u.pas) { text('+' + fmt(u.pas) + ' IQ PER SECOND', 168, y, '#b4f08c', { font: F3 }); y += 8; }
    if (!hidden) text('COST: ' + fmt(u.cost) + ' IQ', 168, y + 2, own ? '#5a6988' : b.iq >= u.cost ? '#ffffff' : '#ff8f7a', { font: F3 });
    if (!hidden && u.game && !own) text('WIN THE {' + GAME_NAMES[u.game] + '}!', 168, y + 12, '#f6a0c8', { font: F3, accent: '#fee761' });
    // buy button
    if (own) text('OWNED ✓', 236, 140, '#63c74d', { align: 'center' });
    else if (isNext) {
      const can = b.iq >= u.cost;
      panel(170, 134, 132, 18, { fill: can ? '#3e8948' : '#3a4466', border: can && Math.floor(s.t * 3) % 2 ? '#fee761' : '#c0cbdc' });
      text(can ? (u.game ? 'PLAY CHALLENGE!' : 'BUY IT!') : 'NEED ' + fmt(u.cost - b.iq) + ' MORE', 236, 140, can ? '#ffffff' : '#c0cbdc', { align: 'center' });
    } else if (!hidden) text('BUY THE ONES BEFORE IT', 236, 140, '#5a6988', { align: 'center', font: F3 });
    text('↑↓ CHOOSE   ENTER BUY   TAB CLOSE', W / 2, 162, '#5a6988', { font: F3, align: 'center' });
  }
}
