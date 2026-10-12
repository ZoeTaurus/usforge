'use strict';
// ============================================================
//  CRAZY DENTIST — game state, patients, clinic day, treatment
// ============================================================

let scene = null;
function setScene(s) { scene = s; clearFX(); if (s.enter) s.enter(); }
function goto(s, dur) { Trans.go(() => setScene(s), dur); }

const LAST_DAY = 7;
const Game = {
  day: 1, money: 0, rep: 3, up: {}, gadgets: {}, endless: false,
  stats: { treated: 0, earned: 0, chomps: 0, left: 0 },
  newRun() { Object.assign(this, { day: 1, money: 30, rep: 3, up: {}, gadgets: {}, endless: false, stats: { treated: 0, earned: 0, chomps: 0, left: 0 } }); this.save(); },
  save() { Store.set('cd_save', { day: this.day, money: this.money, rep: this.rep, up: this.up, gadgets: this.gadgets, endless: this.endless, stats: this.stats }); },
  load() { const s = Store.get('cd_save', null); if (!s) return false; Object.assign(this, { gadgets: {} }, s); return true; },
  hasSave: () => !!Store.get('cd_save', null),
  wipe() { Store.del('cd_save'); },
  best() { return Store.get('cd_best', { day: 0, money: 0 }); },
  recordBest() {
    const b = this.best();
    const done = this.day;
    if (done > b.day || (done === b.day && this.stats.earned > b.money)) Store.set('cd_best', { day: done, money: this.stats.earned });
  },
};

// ---------- patients ----------
const NAMES = ['BOB', 'SUE', 'GARY', 'PRIYA', 'MO', 'LENA', 'DMITRI', 'KEIKO', 'OMAR', 'GRETA', 'RAUL', 'ZOE', 'IVAN', 'AMARA', 'TED', 'NINA', 'FINN', 'YUKI', 'KOFI', 'ROSA'];
const SPECIAL = {
  pirate: { names: ['CAPT. GUMBEARD', 'ONE-TOOTH PETE'], pay: 1.6, lines: ['ARR! ME TOOTH BE ROTTEN AS A BARNACLE!', "YO HO HO! YANK IT OUT AND I'LL PAY YE IN GOLD!"], good: 'ARR! TAKE ME GOLD, YE FINE SAWBONES!' },
  vampire: { names: ['COUNT FANGULA', 'LADY NOCTURNA'], pay: 1.4, lines: ['I VANT MY FANGS SPARKLING. ZE STAINS... ZEY ARE EVERYWHERE.', 'I CANNOT SEE MYSELF IN ZE MIRROR, BUT I KNOW MY FANGS ARE DIRTY.'], good: 'MAGNIFICENT! I VILL TELL ZE OTHER VAMPIRES.' },
  shark: { names: ['BRUCE THE SHARK', 'JAWSY'], pay: 1.4, lines: ["CHOMP CHOMP. TOOTHACHE. DON'T MAKE ME BITE YOU.", 'I HAVE 300 TEETH AND SOME OF THEM HURT.'], good: 'CHOMP OF APPROVAL.' },
  grandma: { names: ['GRANNY MAE', 'NANA ROSE'], pay: 1.3, lines: ['OH DEARIE, MY TEETH HAVE ACHED SINCE 1962.', 'I DRINK 9 COFFEES A DAY. IS THAT BAD, SWEETIE?'], good: 'WHAT A NICE YOUNG DENTIST!' },
  kid: { names: ['LIL TIMMY', 'SUGAR SALLY'], pay: 1.2, lines: ['I ONLY ATE 400 LOLLIPOPS! *SLURP*', "MOM SAYS CANDY ISN'T BREAKFAST. MOM IS WRONG."], good: 'CAN I HAVE A LOLLIPOP NOW?' },
  alien: { names: ['ZORP', 'GLIX-9'], pay: 1.5, lines: ['GREETINGS, TOOTH-HUMAN. REPAIR MY MOUTH-BONES.', 'ON MY PLANET WE HAVE NO DENTISTS. ONLY SCREAMING.'], good: 'EARTH TOOTH-HUMAN IS... ADEQUATE.' },
};
const REG_LINES = {
  extract: ['THIS TOOTH IS KILLING ME!', 'MY TOOTH IS WOBBLY AND IT SMELLS. HELP.', 'I THINK SOMETHING IS GROWING IN MY MOUTH.'],
  clean: ['MY BREATH COULD KNOCK OUT A HORSE.', "I HAVEN'T BRUSHED SINCE LAST YEAR...", 'MY TEETH ARE KINDA... FURRY?'],
  cavity: ['I BIT A CANDY BAR AND SAW STARS.', 'THERE IS A HOLE IN MY TOOTH. I CAN WHISTLE THROUGH IT.'],
  canal: ['THE PAIN IS DEEP. LIKE, ROOT DEEP.', 'MY TOOTH THROBS LIKE A DRUM SOLO.'],
  braces: ['MY TEETH ARE CROOKED LIKE A PICKET FENCE.', 'I WANT A MOVIE STAR SMILE!'],
};
const unlockedProcs = (d) => ['extract', 'clean'].concat(d >= 2 ? ['cavity'] : [], d >= 3 ? ['canal'] : [], d >= 4 ? ['braces'] : []);
function typesFor(d) {
  const t = ['regular', 'regular', 'regular', 'kid', 'pirate'];
  if (d >= 2) t.push('grandma', 'vampire');
  if (d >= 3) t.push('shark');
  if (d >= 4) t.push('alien');
  if (d >= 5) t.push('shark', 'alien', 'vampire');
  return t;
}
let _pid = 0;
function makePatient(d) {
  const type = pick(typesFor(d)), L = genLook(type), un = unlockedProcs(d);
  const maxN = d === 1 ? 1 : d < 5 ? (chance(0.5) ? 2 : 1) : randi(1, 3);
  let probs = [];
  const add = (k, extra = {}) => { if (un.includes(k) && probs.length < maxN && !(k !== 'cavity' && probs.some((q) => q.k === k))) probs.push({ k, ...extra }); };
  switch (type) {
    case 'pirate': add('extract', { n: 1 }); add('cavity'); add('clean', { kind: 'plaque' }); break;
    case 'vampire': add('clean', { kind: 'blood' }); add('canal'); break;
    case 'shark': add('extract', { n: randi(2, 3) }); add('braces'); break;
    case 'grandma': add('clean', { kind: 'coffee' }); add(chance(0.5) ? 'canal' : 'cavity'); break;
    case 'kid': add(d >= 2 ? 'cavity' : 'clean', { kind: 'plaque' }); add('cavity'); add('clean', { kind: 'plaque' }); break;
    case 'alien': add('braces'); add('canal'); break;
    default: for (const k of shuffle(un.slice())) add(k, { n: 1, kind: 'plaque' });
  }
  if (!probs.length) probs.push({ k: pick(un), n: 1, kind: 'plaque' });
  probs.forEach((q) => { if (q.k === 'extract' && !q.n) q.n = 1; if (q.k === 'clean' && !q.kind) q.kind = 'plaque'; });
  const S = SPECIAL[type];
  const patience = Math.max(30, 62 - d * 4) * (Game.up.chairs ? 1.5 : 1);
  return {
    id: ++_pid, L, type, problems: probs,
    name: S ? pick(S.names) : pick(NAMES), line: S ? pick(S.lines) : pick(REG_LINES[probs[0].k]),
    fx: {}, pay: S ? S.pay : 1, patience, maxPatience: patience, state: 'in', x: DOOR_X, y: FLOOR_Y, seat: -1, walk: 0, mood: 'ok', braces: false,
  };
}

// ---------- HUD ----------
function drawHUD(extra) {
  rect(0, 0, W, 12, P.black); rect(0, 11, W, 1, P.slate);
  text(`DAY ${Game.day}${Game.endless ? '' : '/' + LAST_DAY}`, 4, 4, P.white, 1, { sh: P.slate });
  coin(56, 3); text(`$${Math.floor(Game.money)}`, 64, 4, P.gold, 1, { sh: P.dbrown });
  stars(110, 3, Game.rep);
  text(Game.rep.toFixed(1), 152, 4, P.yellow);
  if (extra) text(extra, W - 4, 4, P.lgray, 1, { align: 'r' });
}

// ---------- CLINIC ----------
const Clinic = {
  pausable: true,
  startDay() {
    const n = Math.min(3 + Game.day, 9);
    this.queue = Array.from({ length: n }, () => makePatient(Game.day));
    this.total = n; this.seen = 0; this.used = {}; this.closet = false; this.seats = [null, null, null, null]; this.people = [];
    this.chair = null; this.spawnT = 1; this.t = 0; this.door = 0; this.doorT = 0; this.endT = -1;
    this.dayStats = { treated: 0, earned: 0, chomps: 0, left: 0, rep0: Game.rep, money0: Game.money };
    this.intro = 2.2;
  },
  enter() { SND.playSong('clinic'); },
  tickWaiting(dt) {
    for (const p of this.people) {
      if (p.state !== 'wait') continue;
      p.patience -= dt;
      if (p.scared > 0) p.scared -= dt;
      if (p.patience <= 0) {
        p.state = 'out'; p.mood = 'angry'; this.seats[p.seat] = null; p.seat = -1;
        Game.rep = clamp(Game.rep - 0.25, 0, 5); this.dayStats.left++; this.seen++; Game.stats.left++;
        SND.sfx('hmph'); floatText('HMPH! TOO SLOW!', p.x, p.y - 30, P.red, { dur: 1.4 });
      }
    }
  },
  walkTo(p, tx, dt) {
    const d = tx - p.x, s = 46 * dt;
    if (Math.abs(d) <= s) { p.x = tx; return true; }
    p.x += Math.sign(d) * s; p.walk += dt; return false;
  },
  update(dt) {
    this.t += dt;
    this.intro = Math.max(0, this.intro - dt);
    this.doorT = Math.max(0, this.doorT - dt);
    this.door = lerp(this.door, this.doorT > 0 ? 1 : 0, Math.min(1, dt * 10));
    // spawn arrivals
    this.spawnT -= dt;
    const free = this.seats.indexOf(null);
    if (this.queue.length && free >= 0 && this.spawnT <= 0 && this.intro <= 1) {
      const p = this.queue.shift();
      p.seat = free; this.seats[free] = p; p.x = DOOR_X;
      this.people.push(p); this.doorT = 0.8; SND.sfx('ding');
      this.spawnT = Math.max(4, 9 - Game.day * 0.6) + rand(0, 2);
    }
    this.tickWaiting(dt);
    updateLobby(dt);
    for (const p of this.people) {
      if (p.state === 'in' && this.walkTo(p, SEATS[p.seat], dt)) p.state = 'wait';
      if (p.state === 'toChair' && this.walkTo(p, CHAIR_X, dt)) {
        p.state = 'chair'; this.closet = false;
        const T = makeTreat(p);
        goto(T, 0.3);
      }
      if (p.state === 'out') { if (Math.abs(p.x - DOOR_X) < 14) this.doorT = 0.4; if (this.walkTo(p, DOOR_X - 2, dt)) p.state = 'gone'; }
    }
    this.people = this.people.filter((p) => p.state !== 'gone');
    // pick a patient
    const busy = this.chair || this.people.some((p) => p.state === 'toChair' || p.state === 'chair');
    this.doorHover = !this.closet && input.inside(CLOSET.x - 3, CLOSET.y - 12, CLOSET.w + 6, CLOSET.h + 12);
    if (this.doorHover) { UI.hot = true; if (input.pressed) { this.closet = true; SND.sfx('creak'); SND.sfx('click'); input.consume(); } }
    if (input.key('c') && !this.closet) { this.closet = true; SND.sfx('click'); }
    if (this.closet) { this.hover = null; return this.endCheck(dt); }
    let hov = null, chosen = null;
    for (const p of this.people) if (p.state === 'wait' && input.inside(p.x - 9, 78, 18, 40)) hov = p;
    if (hov) { UI.hot = true; if (input.pressed) chosen = hov; }
    for (let i = 0; i < 4; i++) if (input.key(String(i + 1)) && this.seats[i] && this.seats[i].state === 'wait') chosen = this.seats[i];
    this.hover = hov;
    if (chosen) {
      if (busy) { SND.sfx('wrong'); floatText('ONE AT A TIME!', chosen.x, 70, P.yellow); }
      else { chosen.state = 'toChair'; this.seats[chosen.seat] = null; chosen.seat = -1; SND.sfx('click'); }
      input.consume();
    }
    this.endCheck(dt);
  },
  endCheck(dt) {
    if (!this.queue.length && !this.people.length && this.endT < 0) { this.endT = 0; this.closet = false; SND.sfx('fanfare'); }
    if (this.endT >= 0) { this.endT += dt; if (this.endT > 2 && !Trans.busy()) goto(DaySummary); }
  },
  draw() {
    const t = this.t;
    drawClinic(t, Game.up, { door: this.door, lit: false, closed: !this.queue.length });
    drawClosetDoor(t, this.doorHover);
    drawDentist(DENT_X, FLOOR_Y, t);
    for (const p of this.people) if (p.state === 'wait') drawPerson(p.L, p.x, 112 - (p.scared > 0 && Math.floor(t * 12) % 2 ? 2 : 0), { fx: p.fx, sit: true, t, mood: p.scared > 0 ? 'hurt' : p.cheer > 0 ? 'happy' : p.patience < p.maxPatience * 0.3 ? 'angry' : 'ok' });
    drawSeatFronts(Game.up);
    for (const p of this.people) if (p.state !== 'wait') drawPerson(p.L, p.x, p.y + (p.fx && p.fx.bump ? Math.round(Math.sin(t * 9 + p.id)) : 0), { walk: p.walk, t, mood: p.mood, braces: p.braces, fx: p.fx });
    drawLobby();
    // patience bars + needs
    for (const p of this.people) {
      if (p.state !== 'wait') continue;
      const k = p.patience / p.maxPatience, bx = p.x - 7, by = 80;
      bubble(bx - 1, by - 1, 16, 11, p.x);
      procIcon(p.problems[0].k, bx + 3, by);
      if (p.problems.length > 1) text('+' + (p.problems.length - 1), bx + 13, by + 3, P.red, 1);
      rect(bx, by + 13, 14, 3, P.black);
      rect(bx + 1, by + 14, Math.max(0, Math.round(12 * k)), 1, k > 0.5 ? P.green : k > 0.25 ? P.gold : (Math.floor(t * 8) % 2 ? P.red : P.hot));
      if (this.hover === p) outline(p.x - 9, 90, 18, 28, P.yellow);
      if (p.scared > 0) text('!!', p.x + 7, 92, P.red, 1, { ol: P.white });
    }
    drawHUD(`PATIENTS ${this.seen}/${this.total}`);
    // tooltip
    const h = this.hover;
    if (h) {
      const lines = [h.name, ...h.problems.map((q) => PROC[q.k].name + (q.n > 1 ? ' X' + q.n : ''))];
      const w = Math.max(...lines.map((l) => textW(l))) + 18, x = clamp(h.x - w / 2, 2, W - w - 2), y = 30;
      UI.panel(x, y, w, lines.length * 8 + 6, P.navy);
      text(lines[0], x + 4, y + 4, P.yellow);
      h.problems.forEach((q, i) => { procIcon(q.k, x + 3, y + 10 + i * 8); text(lines[i + 1], x + 14, y + 12 + i * 8, P.white); });
    }
    const waiting = this.people.some((p) => p.state === 'wait');
    const busy = this.people.some((p) => p.state === 'toChair' || p.state === 'chair');
    if (waiting && !busy && !this.closet && Math.floor(t * 2) % 2) text(input.touch ? 'TAP A WAITING PATIENT TO TREAT THEM' : 'CLICK A WAITING PATIENT (OR PRESS 1-4)', 160, 166, P.navy, 1, { align: 'c' });
    if (this.intro > 0) {
      const a = Math.min(1, this.intro);
      UI.panel(80, 62, 160, 34, P.navy, P.black, P.gold);
      text(`DAY ${Game.day}`, 160, 68, P.yellow, 2, { align: 'c', sh: P.black });
      text(Game.day === 1 ? 'THE CLINIC IS OPEN!' : dayTip(Game.day), 160, 84, P.white, 1, { align: 'c' });
      void a;
    }
    if (this.closet) Closet.draw(t);
    if (this.endT >= 0) {
      UI.panel(70, 64, 180, 30, P.navy, P.black, P.gold);
      text('CLOSING TIME!', 160, 70, P.yellow, 2, { align: 'c', sh: P.black });
      text('GREAT WORK, DOC.', 160, 85, P.white, 1, { align: 'c' });
    }
  },
};
function dayTip(d) {
  return ({ 2: 'NEW: CAVITY FILLINGS + NUMBING SHOTS', 3: 'NEW: ROOT CANALS. SHARKS SPOTTED!', 4: 'NEW: BRACES. ALIENS HAVE LANDED!', 5: 'PATIENTS GET CRAZIER...', 6: 'TINY CANALS. STEADY HANDS!', 7: 'FINAL DAY! GO FOR GOLD!' })[d] || 'ENDLESS MODE. HOW FAR CAN YOU GO?';
}

// ---------- TREATMENT ----------
const RATING = (q) => q >= 0.9 ? ['PERFECT!', P.green] : q >= 0.7 ? ['GREAT', P.cyan] : q >= 0.45 ? ['OK', P.gold] : ['YIKES', P.red];
function makeTreat(p) {
  const T = {
    pausable: true, p, patient: p, L: p.L, mouth: buildMouth(p.L), pain: 0, maxPain: 0, numb: false, up: Game.up, day: Game.day,
    flying: [], crown: null, phase: 'talk', pt: 0, t: 0, open: 0, view: 'mouth', lastHurt: 9, blinkT: 2, blink: false,
    bills: [], react: 0, queue: [], procs: [], mg: null, mgT: 0, cur: null, result: null, talk: 0,
  };
  for (const q of p.problems) {
    const pr = { k: q.k, qs: [], mgs: [] };
    if (q.k === 'extract') pr.mgs = [() => mgExtract(T, q.n || 1)];
    if (q.k === 'clean') pr.mgs = [() => mgClean(T, q.kind || 'plaque')];
    if (q.k === 'cavity') pr.mgs = [() => mgDrill(T), () => mgFill(T)];
    if (q.k === 'canal') pr.mgs = [() => mgCanal(T)];
    if (q.k === 'braces') pr.mgs = [() => mgBraces(T)];
    T.procs.push(pr);
    pr.mgs.forEach((f, i) => T.queue.push({ pr, f, last: i === pr.mgs.length - 1 }));
  }
  T.hurt = (a) => {
    if (T.phase !== 'play') return;
    if (T.hypno > 0) { if (a >= 3) floatText('TWEET TWEET', 170, 40, P.cyan); return; }
    const m = (T.numb ? 0.5 : 1) * (Game.up.gas ? 0.7 : 1);
    T.pain = Math.min(100, T.pain + a * m); T.maxPain = Math.max(T.maxPain, T.pain);
    T.lastHurt = 0;
    if (a * m >= 6) SND.sfx('ouch');
    if (T.pain >= 100) chomp();
  };
  function chomp() {
    if (T.mg && T.mg.end) T.mg.end();
    T.auto = null; T.mallet = null;
    SND.drillOff();
    T.phase = 'chomp'; T.pt = 0; T.view = 'mouth';
    SND.sfx('chomp'); addShake(9); flash(P.red, 0.8);
    Game.stats.chomps++; Clinic.dayStats.chomps++;
  }
  T.chomp = () => chomp();
  function nextMg() {
    const job = T.queue.shift();
    if (!job) { T.phase = 'close'; T.pt = 0; return; }
    T.cur = job; T.mg = job.f(); T.mgT = T.mg.time; T.phase = 'banner'; T.pt = 0;
    if (T.mg.view !== T.view) Trans.go(() => { T.view = T.mg.view; }, 0.18);
  }
  function startProcedures(numb) {
    T.phase = 'open'; T.pt = 0; SND.playSong('treat');
    if (numb) T.queue.unshift({ pr: null, f: () => mgNumb(T), last: false });
  }
  function finishResult(chomped) {
    let pay = 0, qs = [];
    const lines = [];
    for (const pr of T.procs) {
      const q = pr.qs.length ? pr.qs.reduce((a, b) => a + b, 0) / pr.qs.length : 0;
      const done = pr.qs.length === pr.mgs.length;
      const money = done && !chomped ? Math.round(PROC[pr.k].price * (0.3 + 0.7 * q) * p.pay) : 0;
      pay += money; qs.push(done ? q : 0);
      lines.push({ name: PROC[pr.k].name, q: done ? q : -1, money });
    }
    const avg = qs.reduce((a, b) => a + b, 0) / qs.length;
    let tip = 0, dRep;
    if (chomped) dRep = -0.5;
    else {
      if (T.maxPain < 40 && !T.bills.length) tip = Math.round(pay * 0.25);
      dRep = (avg - 0.55) * 0.7 + (tip ? 0.05 : 0);
    }
    const S = SPECIAL[p.type];
    let review = chomped ? 'THE PATIENT BIT YOU AND RAN OFF!'
      : avg >= 0.85 ? (S ? S.good : pick(['BEST DENTIST EVER!', "I DIDN'T FEEL A THING!", '10/10 WOULD GET DRILLED AGAIN.']))
        : avg >= 0.6 ? pick(['PRETTY GOOD. MY FACE IS STILL NUMB.', 'NOT BAD, DOC!', 'MY MOUTH FEELS BRAND NEW.'])
          : avg >= 0.4 ? pick(['IT WAS... AN EXPERIENCE.', 'I HAVE QUESTIONS.', 'I WILL BE BACK. SADLY.'])
            : pick(["I'M CALLING MY LAWYER.", 'MY MOUTH IS A CRIME SCENE.', 'ONE STAR. NEVER AGAIN.']);
    const bill = T.bills.reduce((a, b) => a + b.cost, 0);
    T.result = { lines, pay, tip, dRep, avg, review, chomped, given: false, bills: T.bills, total: pay + tip - bill };
    p.mood = chomped || avg < 0.4 ? 'angry' : 'happy';
    p.braces = T.mouth.teeth.some((t) => t.bracket);
    const fx = p.fx || {};
    const gag = fx.soot ? 'WHY IS MY FACE COVERED IN SOOT?!' : fx.bald ? 'WHERE DID MY HAIR GO?!' : fx.noBrows ? 'WHERE DID MY EYEBROWS GO?!'
      : fx.cement ? 'MY FACE IS 30% CEMENT NOW.' : fx.singed ? 'WHY DO I SMELL LIKE TOAST?' : fx.foam ? "I'M STILL FOAMING..." : fx.bump ? 'WHAT DAY IS IT? WHO AM I?' : null;
    if (gag && avg >= 0.4) T.result.review = gag;
  }
  function applyResult() {
    const r = T.result;
    if (r.given) return;
    r.given = true;
    Game.money = Math.max(0, Game.money + r.total); Game.rep = clamp(Game.rep + r.dRep, 0, 5);
    Game.stats.earned += r.total; Clinic.dayStats.earned += r.total;
    if (!r.chomped) { Game.stats.treated++; Clinic.dayStats.treated++; }
    if (r.total > 0) SND.sfx('coin');
  }
  function leave() {
    applyResult();
    Clinic.seen++;
    p.state = 'out'; p.x = CHAIR_X; p.walk = 0;
    if (!Clinic.people.includes(p)) Clinic.people.push(p);
    if (Game.rep <= 0) { goto(GameOver); return; }
    goto(Clinic, 0.3);
  }
  T.enter = () => { SND.playSong('clinic'); };
  T.cursor = () => {
    if (T.phase !== 'play' || !T.mg || T.view !== T.mg.view) return null;
    const c = T.mg.cursorPos ? T.mg.cursorPos() : input;
    return { type: T.mg.tool, x: c.x, y: c.y };
  };
  T.update = (dt) => {
    tickMallet(T, dt);
    if (T.react > 0) T.react -= dt;
    T.t += dt; T.pt += dt;
    Clinic.tickWaiting(dt * 0.5);
    T.lastHurt += dt;
    if (T.lastHurt > 1 && T.phase === 'play') T.pain = Math.max(0, T.pain - (Game.up.tank ? 7 : 3.5) * dt);
    T.blinkT -= dt; if (T.blinkT < 0) { T.blink = !T.blink; T.blinkT = T.blink ? 0.12 : rand(1.5, 4); }
    if (T.hypno > 0) T.hypno -= dt;
    for (const f of T.flying) { f.vy += (f.g ?? 380) * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.r += f.vr * dt; }
    T.flying = T.flying.filter((f) => f.y < H + 30 && f.y > -40);
    switch (T.phase) {
      case 'talk': T.talk = T.pt < 2 ? (Math.floor(T.pt * 8) % 2 ? 0.08 : 0) : 0; break;
      case 'open': T.open = clamp(T.pt / 0.5, 0, 1); if (T.pt > 0.6) nextMg(); break;
      case 'banner': if (T.pt > 1.5 || (T.pt > 0.4 && input.pressed)) { T.phase = 'play'; T.pt = 0; input.consume(); } break;
      case 'play': {
        const mg = T.mg;
        if (T.auto) tickAuto(T, dt);
        else {
          mg.update(dt);
          const gl = gadgetsFor(T);
          if (input.key('g') && gl.length) useGadget(T, gl[0]);
        }
        if (T.phase !== 'play') break;
        if (mg.time > 0 && !mg.done) {
          const before = Math.ceil(T.mgT);
          T.mgT -= dt;
          if (Math.ceil(T.mgT) !== before && T.mgT < 5 && T.mgT > 0) SND.sfx('tick');
          if (T.mgT <= 0 && !mg.done) { mg.timeout(); floatText("TIME'S UP!", 126, 70, P.red, { sc: 2 }); }
        }
        if (mg.done) {
          if (mg.end) mg.end();
          if (T.cur.pr) T.cur.pr.qs.push(mg.quality);
          T.phase = 'procDone'; T.pt = 0;
          if (!mg.noScore) { const [w, c] = RATING(mg.quality); floatText(w, 126, 60, c, { sc: 2, dur: 1.2, vy: -8 }); SND.sfx(mg.quality >= 0.7 ? 'great' : mg.quality >= 0.45 ? 'good' : 'bad'); }
        }
        break;
      }
      case 'procDone': if (T.pt > 1.1) nextMg(); break;
      case 'close':
        if (T.view !== 'mouth' && !Trans.busy()) Trans.go(() => { T.view = 'mouth'; }, 0.18);
        T.open = clamp(1 - T.pt / 0.5, 0, 1);
        if (T.pt > 0.7) { finishResult(false); T.phase = 'result'; T.pt = 0; SND.playSong('clinic'); applyResult(); }
        break;
      case 'chomp':
        T.open = clamp(T.open - dt * 9, 0, 1);
        if (T.pt > 1.6) { finishResult(true); T.phase = 'result'; T.pt = 0; SND.playSong('clinic'); applyResult(); }
        break;
    }
  };
  T.draw = () => {
    const st = { fx: T.p.fx || {}, react: T.react, hypno: T.hypno > 0, open: Math.max(T.open, T.talk), pain: T.pain, numb: T.numb, t: T.t, blink: T.blink, mood: T.phase === 'result' ? T.p.mood : (T.phase === 'chomp' ? 'angry' : 'ok') };
    if (T.view === 'mouth') {
      drawFaceBase(T.L, st);
      if (st.open > 0.02) drawMouth(T.mouth, st.open);
      drawFaceOver(T.L, st);
    } else {
      drawMacroBack(T.t);
      if (T.mg && T.mg.drawWorld) T.mg.drawWorld();
      if (T.mg && T.mg.title !== 'ROOT CANAL') drawMacroGum();
      drawLens();
    }
    for (const f of T.flying) {
      G.save(); G.translate(Math.round(f.x + f.spr.width / 2), Math.round(f.y + f.spr.height / 2)); G.rotate(f.r);
      G.drawImage(f.spr, -f.spr.width / 2, -f.spr.height / 2);
      if (f.rocket) { rect(-3, f.spr.height / 2, 6, 3, P.orange); rect(-2, f.spr.height / 2 + 3, 4, 2 + (Math.floor(T.t * 20) % 2) * 2, P.yellow); }
      G.restore();
    }
    drawGadgetFx(T);
    if (T.mg && (T.phase === 'play' || T.phase === 'procDone') && T.view === T.mg.view) T.mg.draw();
    drawTreatPanel(T);

    if (T.phase === 'talk') {
      const lines = wrap(`"${T.p.line}"`, 196);
      const bh = lines.length * 7 + 8;
      bubble(28, 4, 204, bh, null);
      lines.forEach((l, i) => text(l, 130, 9 + i * 7, P.black, 1, { align: 'c' }));
      UI.panel(40, 130, 180, 46, P.navy);
      text('NEEDS:', 48, 136, P.gold);
      T.p.problems.forEach((q, i) => { procIcon(q.k, 80 + i * 44, 134); text(PROC[q.k].short + (q.n > 1 ? 'X' + q.n : ''), 91 + i * 44, 136, P.white); });
      if (Game.day >= 2) {
        if (UI.button(46, 152, 82, 16, 'NUMB FIRST', { color: P.blue, light: P.sky })) startProcedures(true);
        if (UI.button(132, 152, 82, 16, 'JUST START', { color: P.dgreen, light: P.green, dark: P.ddgreen })) startProcedures(false);
        if (input.key('Enter') || input.key(' ')) startProcedures(false);
      } else if (UI.button(80, 152, 100, 16, 'START', { color: P.dgreen, light: P.green, dark: P.ddgreen }) || input.key('Enter') || input.key(' ')) startProcedures(false);
    }
    if (T.phase === 'banner' && T.mg) {
      const k = Math.min(1, T.pt / 0.15);
      const y = Math.round(lerp(-40, 54, easeOutBack(k)));
      UI.panel(14, y, 224, 46, P.navy, P.black, P.gold);
      procIcon(T.cur.pr ? T.cur.pr.k : 'numb', 22, y + 8);
      text(T.mg.title, 128, y + 8, P.yellow, 2, { align: 'c', sh: P.black });
      textBlock(T.mg.hint, 24, y + 24, 206, P.white, 1, { lh: 7 });
    }
    if (T.phase === 'chomp') {
      const s = T.pt < 0.15 ? 5 : 4;
      text('CHOMP!', 126, 60, P.red, s, { align: 'c', ol: P.black, olw: 2, sh: P.black });
      if (T.pt > 0.5) text('TOO MUCH PAIN! THEY BIT YOU!', 126, 98, P.white, 1, { align: 'c', ol: P.black });
    }
    if (T.phase === 'result') drawResult(T, leave);
  };
  return T;
}

function painFace(x, y, pain) {
  circle(x, y, 5, P.black);
  circle(x, y, 4, pain < 35 ? P.yellow : pain < 70 ? P.orange : P.red);
  px(x - 2, y - 1, P.black); px(x + 2, y - 1, P.black);
  if (pain < 35) { px(x - 2, y + 1, P.black); rect(x - 1, y + 2, 3, 1, P.black); px(x + 2, y + 1, P.black); }
  else if (pain < 70) rect(x - 2, y + 2, 5, 1, P.black);
  else { rect(x - 1, y + 1, 3, 3, P.black); px(x - 3, y - 3, P.cyan); }
}
function drawTreatPanel(T) {
  const x = 252;
  UI.panel(x, 0, 68, H, P.navy);
  const nm = wrap(T.p.name, 60);
  nm.forEach((l, i) => text(l, x + 34, 5 + i * 7, P.yellow, 1, { align: 'c' }));
  const by = 26;
  text('PAIN', x + 6, by, P.white);
  rect(x + 6, by + 8, 12, 92, P.black);
  rect(x + 7, by + 9, 10, 90, P.slate);
  const ph = Math.round(90 * T.pain / 100);
  const pc = T.pain < 35 ? P.green : T.pain < 70 ? P.gold : (Math.floor(T.t * 10) % 2 ? P.red : P.hot);
  rect(x + 7, by + 99 - ph, 10, ph, pc);
  for (let i = 1; i < 5; i++) rect(x + 7, by + 9 + i * 18, 3, 1, P.black);
  painFace(x + 12, by + 99 - ph - 2, T.pain);
  // checklist
  text('TO DO', x + 30, by, P.white);
  T.procs.forEach((pr, i) => {
    const iy = by + 9 + i * 13;
    procIcon(pr.k, x + 30, iy);
    const done = pr.qs.length === pr.mgs.length;
    const active = T.cur && T.cur.pr === pr && !done;
    if (done) { const [, c] = RATING(pr.qs.reduce((a, b) => a + b, 0) / pr.qs.length); text('`', x + 44, iy + 2, c); }
    else if (active && Math.floor(T.t * 4) % 2) text('<', x + 44, iy + 2, P.yellow);
  });
  // timer
  if (T.mg && T.mg.time > 0 && (T.phase === 'play' || T.phase === 'banner')) {
    const s = Math.max(0, Math.ceil(T.phase === 'banner' ? T.mg.time : T.mgT));
    text('TIME', x + 46, by + 62, P.lgray, 1, { align: 'c' });
    text(s, x + 46, by + 70, s <= 5 ? P.red : P.white, 2, { align: 'c', sh: P.black });
  }
  let sy = 136;
  if (T.numb) { UI.panel(x + 4, sy, 60, 10, P.blue); text('NUMB X0.5', x + 34, sy + 3, P.cyan, 1, { align: 'c' }); sy += 12; }
  if (Game.up.gas) { UI.panel(x + 4, sy, 60, 10, P.plum); text('GAS -30%', x + 34, sy + 3, P.salmon, 1, { align: 'c' }); sy += 12; }
  if (T.hypno > 0) { UI.panel(x + 4, sy, 60, 10, P.plum); text(`DAZED ${Math.ceil(T.hypno)}S`, x + 34, sy + 3, P.pink, 1, { align: 'c' }); sy += 12; }
  gadgetsFor(T).slice(0, 2).forEach((g, i) => {
    if (UI.button(x + 26, 110 + i * 13, 39, 12, g.short, { color: P.plum, light: P.pink, dark: P.black })) useGadget(T, g);
  });
  text(input.touch ? '' : 'ESC: PAUSE', x + 34, 172, P.dgray, 1, { align: 'c' });
}

function drawResult(T, onLeave) {
  const r = T.result;
  const k = Math.min(1, T.pt / 0.2);
  const rv = wrap(`"${r.review}"`, 188);
  const w = 208, h = 26 + (r.lines.length + r.bills.length) * 9 + (r.tip ? 9 : 0) + 26 + rv.length * 7 + 28;
  const x = 22, y = Math.round(lerp(190, Math.round((H - h) / 2), easeOutBack(k)));
  UI.panel(x, y, w, h, P.navy, P.black, r.chomped ? P.red : P.gold);
  text(r.chomped ? 'OUCH! FAILED' : 'TREATMENT DONE', x + w / 2, y + 7, r.chomped ? P.red : P.yellow, 2, { align: 'c', sh: P.black });
  let ly = y + 26;
  for (const l of r.lines) {
    text(l.name, x + 8, ly, P.white);
    if (l.q >= 0) { const [wd, c] = RATING(l.q); text(wd, x + 120, ly, c, 1, { align: 'c' }); }
    else text('---', x + 120, ly, P.dgray, 1, { align: 'c' });
    text(`$${l.money}`, x + w - 8, ly, P.gold, 1, { align: 'r' });
    ly += 9;
  }
  if (r.tip) { text('PAINLESS TIP!', x + 8, ly, P.cyan); text(`$${r.tip}`, x + w - 8, ly, P.gold, 1, { align: 'r' }); ly += 9; }
  for (const b of r.bills) { text(`THEY BILL YOU: ${b.name}`, x + 8, ly, P.salmon); text(`-$${b.cost}`, x + w - 8, ly, P.red, 1, { align: 'r' }); ly += 9; }
  rect(x + 8, ly, w - 16, 1, P.slate); ly += 4;
  text('TOTAL', x + 8, ly, P.white); text(`${r.total < 0 ? '-' : ''}$${Math.abs(r.total)}`, x + w - 8, ly, r.total < 0 ? P.red : P.yellow, 1, { align: 'r' }); ly += 10;
  stars(x + 8, ly, Game.rep);
  const d = r.dRep;
  text(`${d >= 0 ? '+' : ''}${d.toFixed(2)} REP`, x + w - 8, ly + 1, d >= 0 ? P.green : P.red, 1, { align: 'r' });
  ly += 12;
  rv.forEach((l, i) => text(l, x + w / 2, ly + i * 7, P.lgray, 1, { align: 'c' }));
  if (T.pt > 0.4 && (UI.button(x + w / 2 - 44, y + h - 22, 88, 16, 'NEXT', { color: P.dgreen, light: P.green, dark: P.ddgreen }) || input.key('Enter') || input.key(' '))) onLeave();
}
