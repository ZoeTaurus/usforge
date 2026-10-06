// Game flow: title → day card → play a day → report → … → Day 7 finale → ending.
(function () {
  const hr = HS.hr;

  const REVIEWS = [
    'I checked the house cam. Why is everything on the ceiling. Please call me.',
    'The neighbors say the house was screaming? Like, a lot? We should talk.',
    'Mostly okay! The painting looks a little stressed though. Hang in there.',
    'House seems happy! Tiny question: why is the cat bowl licked clean when I don\'t have a cat?',
    'The house seems really happy! The fridge texted me a heart. I didn\'t know it could text.',
    'PERFECT day!! The house sent me a thank-you card?? It\'s never done that. 💖',
  ];

  const ENDINGS = {
    true: {
      kicker: 'True ending', title: 'The house is home again.',
      body: '<p>You sit on the bottom step in the warm dark. Something big and old and lonely leans against you, like a cat. You stay until it falls asleep.</p><p>In the morning, the fifth chair is a person named Dana. The painting is empty, and a woman named Priya is stretching in the hallway. A very confused Housesitter #3 is making pancakes.</p><p>Robin walks in, sees everyone, and starts crying. The happy kind. Grandma June\'s house hums.</p>',
      msg: 'I don\'t know what you did. The house feels like HER again. Thank you. Seriously. …Is that pancakes?',
    },
    adopted: {
      kicker: 'Ending: Adopted', title: 'The house adopts you.',
      body: '<p>You did everything right. Every rule, every chore, every goodnight. The house noticed.</p><p>At 6 AM Robin comes home to find the locks changed and your name on the mailbox. The fridge has a drawing of you on it. Nobody drew it.</p>',
      msg: 'so… the house changed the locks and put your name on the mailbox. I think you live here now? I\'ll visit!! 💖',
    },
    good: {
      kicker: 'Ending: Good housesitter', title: 'A pretty good week.',
      body: '<p>Robin comes home at 6 AM on the dot. The house is mostly how they left it.</p><p>The fern is a little taller. The painting winks at Robin. The fridge hums a happy little tune.</p>',
      msg: 'everything\'s mostly fine!! the painting winked at me?? same time next year? 💖',
    },
    bad: {
      kicker: 'Ending: Never again', title: 'Robin won\'t ask you again.',
      body: '<p>Robin comes home at 6 AM and stands in the doorway for a long time.</p><p>There is a chair in the shower. The TV is crying. The fern has started a small religion.</p>',
      msg: 'why is there a chair in the shower. why is the TV crying. please return my key.',
    },
    replaced: {
      kicker: 'Ending: Replaced', title: 'Something else got in.',
      body: '<p>You open the door. Robin smiles at you with <i>your</i> smile.</p><p>"Thanks," it says, in your voice. And then there\'s only one of you in the hallway. You\'re not sure which one.</p><p>At 6 AM, the real Robin comes home to a housesitter who seems almost exactly like you.</p>',
      msg: 'you seem different today. good different? you never used to hum like the fridge.',
    },
    basement: {
      kicker: 'Game over', title: 'You went downstairs.', retry: true,
      body: '<p>The stairs go down further than the house is tall. At the bottom, something lonely is very, very happy to see you.</p><p>Housesitter #4 has joined the house.</p>',
      msg: 'I said I\'d never leave another note. …Hello? Are you there?',
    },
    evicted: {
      kicker: 'Game over', title: 'The house kicked you out.', retry: true,
      body: '<p>The lights go out. Every door in the house slams at once. When the noise stops, you\'re on the front lawn in your pajamas.</p><p>Your bags are next to you, neatly packed.</p>',
      msg: 'I just got a voicemail from my HOUSE. It was 40 minutes of slamming doors. What happened??',
    },
  };

  HS.Game = {
    phase: 'title',      // title | card | play | report | ending
    day: 1,
    chaos: 0,
    pages: [],
    stars: [],
    seen: {},
    seed: 1,             // picks each day's chores (saved, so a resumed day matches)
    otherYou: false,     // set once you open the door to something at night
    over: false,
    sleeping: false,
    paused: false,
    holding: null,
    effects: {},
    fired: {},
    shakeT: 0,
    basementOpen: false,
    heartOpen: false,
    noteRead: false,

    // ---------- flow ----------
    newGame() {
      HS.Save.clear();
      Object.assign(this, { day: 1, chaos: 0, pages: [], stars: [], seen: {}, otherYou: false, seed: Math.floor(Math.random() * 1e9) });
      this.showDayCard();
    },

    // Continue resumes mid-day if there's an autosave; `fromDayStart` (used by Retry) ignores it.
    continueGame(fromDayStart = false) {
      const s = HS.Save.load();
      if (!s) return this.newGame();
      if (s.mid && !fromDayStart) return this.resume(s.mid);
      Object.assign(this, { day: s.day, chaos: s.chaos, pages: s.pages, stars: s.stars, seen: s.seen, otherYou: !!s.otherYou, seed: s.seed || 1 });
      this.showDayCard();
    },

    // The start-of-day save (what Retry goes back to).
    dayStart() {
      return { day: this.day, chaos: this.chaos, pages: this.pages.slice(), stars: this.stars.slice(), seen: Object.assign({}, this.seen), otherYou: this.otherYou, seed: this.seed };
    },

    // ---------- mid-day autosave ----------
    // A full snapshot of the day in progress. Only taken while no dialog is open, so a choice
    // (like whether to open the door) can never be skipped by reloading.
    snapshot() {
      const P = HS.Player, RB = HS.Rulebook;
      return {
        day: this.day, chaos: this.chaos, pages: this.pages.slice(), stars: this.stars.slice(), seen: Object.assign({}, this.seen), otherYou: this.otherYou, seed: this.seed,
        minutes: HS.Clock.minutes,
        requests: HS.Requests.state(),
        player: { x: P.x, y: P.y, face: P.face, sitting: P.sitting ? P.sitting.id : null, prev: P.prev, hidden: P.hidden },
        holding: this.holding, effects: this.effects, fired: this.fired,
        basementOpen: this.basementOpen, heartOpen: this.heartOpen, noteRead: this.noteRead,
        status: RB.status, st: RB.st,
        objects: HS.Map.objects.map(o => ({ id: o.id, x: o.x, y: o.y, visible: o.visible, solid: o.solid, big: !!o.big })),
        phone: HS.UI.el['phone-msgs'].innerHTML,
      };
    },

    autosave(now) {
      if (this.phase !== 'play' || this.over || HS.UI.isBlocking()) return;
      // Keep a fresh copy in memory every couple of seconds; write it out every in-game hour.
      if (!this.lastSnapAt || now - this.lastSnapAt > 2000) {
        this.lastSnap = this.snapshot();
        this.lastSnapAt = now;
      }
      const hour = Math.floor(HS.Clock.minutes / 60);
      if (hour !== this.savedHour) {
        this.savedHour = hour;
        this.persist(true);
      }
    },

    // Write the latest snapshot to storage (also called on pause, quit, and closing the tab).
    persist(showIndicator = false) {
      if (this.phase !== 'play' || this.over) return;
      if (!HS.UI.isBlocking() || !this.lastSnap) this.lastSnap = this.snapshot();
      HS.Save.store(Object.assign({}, this.saveBase || this.dayStart(), { mid: this.lastSnap }));
      if (showIndicator) HS.UI.flashSaved();
    },

    resume(mid) {
      const RB = HS.Rulebook, P = HS.Player;
      Object.assign(this, {
        day: mid.day, chaos: mid.chaos, pages: mid.pages, stars: mid.stars, seen: mid.seen, otherYou: !!mid.otherYou, seed: mid.seed || 1,
        phase: 'play', over: false, sleeping: false, paused: false, shakeT: 0,
        holding: mid.holding, effects: mid.effects || {}, fired: mid.fired || {},
        basementOpen: mid.basementOpen, heartOpen: mid.heartOpen, noteRead: mid.noteRead,
      });
      this.saveBase = HS.Save.load() ? (({ mid: _, ...base }) => base)(HS.Save.load()) : this.dayStart();
      HS.Clock.minutes = mid.minutes;
      HS.Map.build();
      HS.Uncanny.rearrange(this.day);
      RB.setupDay(this.day);
      RB.status = mid.status;
      for (const id of Object.keys(mid.st)) if (RB.st[id]) RB.st[id] = mid.st[id];
      HS.Uncanny.setupDay(this.day);
      HS.Visitor.setupDay(this.day);
      for (const s of mid.objects) {
        const o = HS.Map.byId[s.id];
        if (o) Object.assign(o, { x: s.x, y: s.y, visible: s.visible, solid: s.solid, big: s.big });
      }
      P.reset(false);
      Object.assign(P, { x: mid.player.x, y: mid.player.y, face: mid.player.face, prev: mid.player.prev, hidden: !!mid.player.hidden });
      // Put you back in your seat without re-triggering anything (no "you sat down" events).
      if (mid.player.sitting) P.sitting = HS.Map.byId[mid.player.sitting] || null;
      HS.Requests.setupDay(this.day);
      HS.Requests.restore(mid.requests);
      HS.Daytime.setupDay(this.day);
      HS.UI.startDay();
      HS.UI.el['phone-msgs'].innerHTML = mid.phone || '';
      this.savedHour = Math.floor(mid.minutes / 60);
      this.lastSnap = mid;
      this.say(`<h3>Day ${this.day} · ${HS.Clock.format()}</h3><p>Everything is exactly where you left it.</p><p>The house kept it that way for you. It was waiting.</p>`);
    },

    showDayCard() {
      this.phase = 'card';
      this.lastSnap = null;
      this.saveBase = this.dayStart();
      HS.Save.store(this.saveBase);
      const RB = HS.Rulebook, d = this.day;
      const fresh = RB.order.filter(id => !RB.defs[id].chore && RB.activeOn(id, d) && (RB.defs[id].from || 1) === d);
      const changed = RB.order.filter(id => RB.defs[id].changed && RB.defs[id].changed(d));
      HS.UI.showDayCard({
        day: d,
        fresh: d === 1 ? [] : fresh.map(id => RB.defs[id].short(d)),
        changed: changed.map(id => RB.defs[id].short(d)),
        chaos: this.chaos,
        pages: this.pages.length,
      });
      HS.Audio.setTrack('evening');
    },

    startDay() {
      Object.assign(this, {
        phase: 'play', over: false, sleeping: false, paused: false, holding: null, effects: {}, fired: {},
        basementOpen: false, heartOpen: false, noteRead: false, shakeT: 0,
      });
      HS.Clock.minutes = hr(HS.START_HOUR);
      HS.Map.build();
      HS.Uncanny.rearrange(this.day);
      HS.Player.reset(this.day === 1);
      HS.Rulebook.setupDay(this.day);
      HS.Uncanny.setupDay(this.day);
      HS.Visitor.setupDay(this.day);
      HS.Requests.setupDay(this.day);
      HS.Daytime.setupDay(this.day);
      HS.UI.startDay();
      this.saveBase = this.dayStart();
      this.savedHour = HS.START_HOUR;
      this.lastSnap = null;
      HS.Story.intro(this.day);
    },

    update(dt) {
      const m = HS.Clock.minutes, h = m / 60;
      HS.Audio.setTrack(h < 17 ? 'day' : h < 21 ? 'evening' : 'night');
      HS.Rulebook.update(m, dt, this.day);
      HS.Story.update(m, this.day);
      HS.Uncanny.update(dt, m);
      HS.Visitor.update(dt, m);
      HS.Requests.update(m);
      HS.Daytime.update(dt, m);
      if (!this.over && m >= hr(HS.END_HOUR)) this.endDay();
    },

    endDay() {
      if (this.over) return;
      this.over = true;
      const RB = HS.Rulebook;
      RB.finalize();
      const ids = RB.active;
      const broken = ids.filter(id => RB.status[id] === 'broken').length;
      const missed = ids.filter(id => RB.status[id] === 'missed').length;
      const stars = Math.max(0, Math.min(5, Math.round(5 - broken - missed * 0.5)));
      this.stars.push(stars);
      const list = ids.map(id => [RB.status[id], RB.defs[id].short(this.day)]);

      if (this.day >= HS.DAYS) {
        HS.UI.clearDialogs();
        this.say('<p>6:00 AM. A key turns in the front door.</p><p>"I\'m HOME!" It\'s Robin. The real one. You can tell, because the house exhales.</p>', [
          { label: 'Welcome them home', action: () => this.finishWeek() },
        ], 'good');
        return;
      }

      this.day++;
      this.chaos = Math.round(this.chaos * 0.5);
      this.phase = 'report';
      // The day is done: the save now points at the start of tomorrow.
      this.lastSnap = null;
      this.saveBase = this.dayStart();
      HS.Save.store(this.saveBase);
      HS.UI.showReport({ day: this.day - 1, stars, msg: REVIEWS[stars], list, pages: this.pages.length, chaos: this.chaos });
    },

    finishWeek() {
      const avg = this.stars.reduce((a, b) => a + b, 0) / this.stars.length;
      this.finish(avg >= 4.5 ? 'adopted' : avg >= 3 ? 'good' : 'bad');
    },

    finish(kind) {
      if (this.phase === 'ending') return;
      this.phase = 'ending';
      this.over = true;
      const e = ENDINGS[kind];
      const avg = this.stars.length ? (this.stars.reduce((a, b) => a + b, 0) / this.stars.length) : 0;
      this.lastSnap = null;
      if (!e.retry) HS.Save.clear();
      else if (this.saveBase) HS.Save.store(this.saveBase); // Retry goes back to the start of the day, not mid-day
      HS.Save.remember(kind);
      HS.Audio.setTrack(e.retry ? 'night' : 'day');
      HS.UI.showEnding(Object.assign({}, e, {
        stats: `Days survived: ${this.stars.length}/7 · Average: ${avg.toFixed(1)}★ · Pages: ${this.pages.length}/7`,
        hint: kind === 'good' || kind === 'adopted' || kind === 'bad'
          ? (this.pages.length < 7 ? 'There are 7 torn pages hidden in the house. Find them all for the true ending…' : 'You found every page… but did you go downstairs on the last night?')
          : '',
      }));
    },

    retryDay() { this.continueGame(true); },

    // ---------- helpers used by rules ----------
    once(key, cond, fn) {
      if (cond && !this.fired[key]) { this.fired[key] = true; fn(); }
    },

    effect(name) { return (this.effects[name] || 0) > HS.Clock.minutes; },
    addEffect(name, minutes) { this.effects[name] = HS.Clock.minutes + minutes; },
    shake(sec) { this.shakeT = Math.max(this.shakeT, sec); },

    inRoom(id) {
      const r = HS.Map.roomAt(HS.Player.x, HS.Player.y);
      return !!r && r.id === id;
    },

    say(html, choices = null, style = '') { HS.UI.dialog(html, choices, style); },

    good(html) {
      HS.Audio.play('good');
      this.say(html, null, 'good');
    },

    text(who, msg) {
      const from = { R: HS.FRIEND, F: HS.FAKE, H: HS.HOUSE, U: 'Unknown number' }[who];
      HS.UI.text(from, msg, who);
    },

    breakRule(id, html, chaos, after) {
      HS.Rulebook.set(id, 'broken');
      this.chaos = Math.min(HS.CHAOS_MAX, this.chaos + chaos);
      HS.Audio.play('bad');
      this.shake(0.8);
      if (after) after();
      this.say(`<div class="tag bad">Rule broken</div>${html}`, null, 'bad');
      if (this.chaos >= HS.CHAOS_MAX) {
        this.say('<p>The house has had <b>enough</b>.</p>', [{ label: 'Uh oh', action: () => this.finish('evicted') }], 'bad');
      }
    },

    readNote() {
      const RB = HS.Rulebook, d = this.day;
      const items = RB.rules().map(id => {
        const r = RB.defs[id], text = r.text(d);
        const tag = !(id in this.seen) ? '<span class="new">NEW</span> ' : this.seen[id] !== text ? '<span class="new">CHANGED</span> ' : '';
        this.seen[id] = text;
        return `<li>${tag}${text}</li>`;
      }).join('');
      const chores = RB.chores().map(id => RB.defs[id].short(d).toLowerCase()).join(', ');
      this.noteRead = true;
      HS.UI.renderRules();
      this.say(`<h3>House rules ♡</h3><ol>${items}</ol><p>Today's chores: ${chores}. Thank you!! — Robin</p>`, null, 'note');
    },

    // Interaction priority: hidden pages → rules → default object behavior.
    interact(o) {
      if (HS.Story.interact(o)) return;
      if (HS.Rulebook.interact(o, this.day)) return;
      if (HS.Daytime.interact(o)) return;
      if (HS.Requests.interact(o)) return;
      HS.Objects.interact(o);
    },

    prompt(o) {
      if (HS.Player.sitting !== o && HS.Story.pageAt(o.id) >= 0) return `Search the ${o.label.toLowerCase()}`;
      return HS.Rulebook.prompt(o, this.day) || HS.Requests.prompt(o) || HS.Objects.prompt(o);
    },

    onStand(o) {
      if (o.id === 'bed') { this.sleeping = false; HS.UI.setSleep(false); }
      HS.Rulebook.onStand(o);
    },
  };
})();
