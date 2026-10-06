// The quiet, wrong stuff: a lying mood bar, a reworded rule, sudden silence, and the other you.
// None of it breaks rules or costs anything. It's just there to make you doubt things.
(function () {
  const G = HS.Game, hr = HS.hr, T = HS.TILE;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  // Subtly wrong versions of each rule's sidebar text. The fridge note always stays correct.
  const ALT = {
    cat: d => d >= 4 ? 'Feed Mr. Whiskers: MORNING ONLY (diet!)' : 'Feed Mr. Whiskers: morning + midnight',
    fern: () => 'Water the fern. Only after 8 PM.',
    fridge: () => 'Never hum back to the fridge',
    night: () => 'Bedroom from 11 PM to 6 AM. Always open for knocks.',
    notes: () => 'Other notes are from me too. Keep them.',
    wind: () => 'Never touch the grandfather clock',
    tv: () => 'If the TV turns on, don\'t look at it',
    chair: () => '5 chairs at the table? Don\'t sit.',
    phone: () => 'Answer the landline. Say your name.',
    painting: () => 'Painting crying? Look at it closely.',
    ducks: () => 'Count the tub ducks 6–10 PM. 8 is right.',
    washer: () => 'Washer stops? Leave it running.',
    blackout: () => 'Lights go out? Go to the basement.',
    mirror: () => 'Don\'t look in the mirror after 9 PM',
    delivery: () => 'Sign for deliveries. Bring the box in.',
  };

  // Where the other you likes to stand.
  const DOORWAYS = [[4, 8], [14, 8], [24, 8], [5, 11], [15, 11], [24, 11], [9, 4], [19, 4], [15, 19], [22, 19], [5, 22], [14, 22], [24, 22]];

  HS.Uncanny = {
    moodLieT: 0,
    reword: null,
    ghost: null,
    ghostCooldown: 0,
    plan: {},

    // The painting: blinks, grins wider while you're away, and sometimes steps out of frame.
    grin: 0,
    blinkT: 3,
    blinking: 0,
    emptyT: 0,

    // Night noises, footsteps that aren't yours, and eyes in the dark.
    ambientT: 30,
    echoT: 0,
    wasMoving: false,
    eyes: null,
    eyesT: 40,
    beatT: 0,
    hallT: 60,
    hallucination: null,
    lightsOut: false,

    setupDay(d) {
      this.moodLieT = 0;
      this.reword = null;
      this.ghost = null;
      this.ghostCooldown = rand(25, 60);
      this.grin = 0;
      this.emptyT = 0;
      this.eyes = null;
      this.eyesT = rand(30, 70);
      this.ambientT = rand(15, 40);
      this.hallT = rand(40, 90);
      this.hallucination = null;
      this.lightsOut = false;
      this.plan = {
        empty: d >= 3 ? hr(rand(11, 22)) : null,
        moodLie: d >= 3 ? hr(rand(12, 23)) : null,
        reword: d >= 4 ? hr(rand(11, 21)) : null,
        silence: d === 6 ? hr(rand(13, 16)) : null,
      };
    },

    update(dt, m) {
      const p = this.plan, d = G.day;

      // 1. The mood bar flicks to "Cozy" for a moment. It isn't.
      if (p.moodLie) G.once('unc-mood', m >= p.moodLie, () => { this.moodLieT = 1.6; });
      if (this.moodLieT > 0) this.moodLieT -= dt;

      // 2. One rule on the sidebar is quietly reworded for a while, then changes back.
      if (p.reword) {
        G.once('unc-reword', m >= p.reword, () => {
          const ids = HS.Rulebook.rules().filter(id => ALT[id]);
          const id = ids[Math.floor(Math.random() * ids.length)];
          this.reword = { id, until: m + 45 };
          HS.UI.renderRules();
        });
        if (this.reword && m >= this.reword.until) {
          this.reword = null;
          HS.UI.renderRules();
        }
      }

      // 3. On Day 6 the music just… stops. For no reason.
      if (p.silence) G.once('unc-silence', m >= p.silence, () => HS.Audio.silence(30));

      // The painting.
      this.updatePainting(dt, m, d);
      this.updateAmbience(dt, m, d);
      this.updateHallucination(dt, m, d);
      this.updateEyes(dt, d);

      // 4. The other you: only after you've opened the door to something (and always on the last day).
      if (G.otherYou || d >= 5) this.updateGhost(dt);
    },

    updateGhost(dt) {
      const P = HS.Player;
      if (!this.ghost) {
        if (P.hidden || G.sleeping) return;
        this.ghostCooldown -= dt;
        if (this.ghostCooldown > 0) return;
        const far = DOORWAYS.filter(([x, y]) => Math.hypot((x + 0.5) * T - P.x, (y + 0.5) * T - P.y) > 110);
        const [x, y] = far[Math.floor(Math.random() * far.length)];
        this.ghost = { x: (x + 0.5) * T, y: (y + 0.5) * T, t: 0 };
        return;
      }
      const g = this.ghost;
      g.t += dt;
      // When you get close, it's gone. If you never come close, it leaves eventually.
      if (Math.hypot(g.x - P.x, g.y - P.y) < 46 || g.t > 25) {
        this.ghost = null;
        this.ghostCooldown = rand(45, 100);
      }
    },

    updatePainting(dt, m, d) {
      // Blinks every few seconds. Paintings don't blink.
      this.blinkT -= dt;
      if (this.blinkT <= 0) { this.blinking = 0.15; this.blinkT = rand(4, 9); }
      if (this.blinking > 0) this.blinking -= dt;
      // While you're out of the dining room, her smile slowly widens. Walk back in and you might catch it shrinking.
      if (G.inRoom('dining')) this.grin = Math.max(0, this.grin - dt * 0.5);
      else this.grin = Math.min(1, this.grin + dt / (d >= 4 ? 40 : 80));
      // Once a day, the frame is empty for a little while.
      if (this.plan.empty) G.once('unc-empty', m >= this.plan.empty, () => { this.emptyT = 18; });
      if (this.emptyT > 0) this.emptyT -= dt;
    },

    updateAmbience(dt, m, d) {
      const night = m >= hr(21), P = HS.Player;
      // Creaks and whispers. At night from Day 2, and sometimes in daylight from Day 4.
      if (d >= 2 && (night || d >= 4)) {
        this.ambientT -= dt;
        if (this.ambientT <= 0) {
          HS.Audio.play(night ? pick(['creak', 'steps', 'whisper', 'windowtap', 'creak']) : pick(['creak', 'steps']));
          this.ambientT = night ? rand(18, 45) : rand(60, 120);
        }
      }
      // Sometimes when you stop walking at night, the footsteps take one more step.
      if (night && d >= 3) {
        if (this.wasMoving && !P.moving && Math.random() < 0.3) this.echoT = 0.35;
        if (this.echoT > 0) { this.echoT -= dt; if (this.echoT <= 0) HS.Audio.play('steps'); }
      }
      this.wasMoving = P.moving;
    },

    // Two little eyes in a dark room you're not in. They're gone when you get close.
    updateEyes(dt, d) {
      const P = HS.Player;
      const dark = HS.Clock.darkness() > 0.6 && !G.effect('blackout');
      if (!this.eyes) {
        if (!dark || d < 2) return;
        this.eyesT -= dt;
        if (this.eyesT > 0) return;
        const r = pick(HS.Map.rooms.filter(r => r.id !== 'hall'));
        const x = (r.x + 1 + Math.random() * (r.w - 2)) * T, y = (r.y + 1 + Math.random() * (r.h - 2)) * T;
        if (Math.hypot(x - P.x, y - P.y) < 110 || HS.Map.isSolidAt(x, y)) { this.eyesT = 3; return; }
        this.eyes = { x: Math.round(x), y: Math.round(y), t: 0 };
        return;
      }
      const e = this.eyes;
      e.t += dt;
      if (Math.hypot(e.x - P.x, e.y - P.y) < 60 || e.t > 8 || !dark) {
        this.eyes = null;
        this.eyesT = rand(30, 70);
      }
    },

    // From Day 4, on dark nights: your light blinks out for a moment, and something is right beside you.
    updateHallucination(dt, m, d) {
      if (this.hallucination) {
        this.hallucination.t -= dt;
        if (this.hallucination.t <= 0) { this.hallucination = null; this.lightsOut = false; }
        return;
      }
      if (d < 4 || HS.Clock.darkness() < 0.6 || G.sleeping || HS.Player.hidden) return;
      this.hallT -= dt;
      if (this.hallT > 0) return;
      this.hallT = rand(45, 100) - d * 4;
      const side = Math.random() < 0.5 ? -1 : 1;
      this.hallucination = { dx: side * 12, dy: rand(-6, 6), t: 0.18 };
      this.lightsOut = Math.random() < 0.5;
      HS.Audio.play('heartbeat');
    },

    // Runs every frame during play, even while a dialog is open: the heartbeat during a knock,
    // while being hunted, during the footsteps, and (faintly) whenever the house is very angry.
    tick(dt) {
      const night = HS.Rulebook.get('night'), hunted = HS.Visitor.hunting;
      const footsteps = HS.Rulebook.get('footsteps').state === 'active';
      const fast = G.effect('knocking') || night.atBedroom || hunted || footsteps;
      if (!fast && G.chaos < 70) return;
      this.beatT -= dt;
      if (this.beatT <= 0) { HS.Audio.play('heartbeat'); this.beatT = night.atBedroom || hunted || footsteps ? 0.55 : fast ? 0.9 : 1.4; }
    },

    // Things are never quite where you left them.
    rearrange(d) {
      const o = HS.Map.byId;
      if (d >= 3) o.chair3.flip = false; // one chair now faces away from the table
      if (d >= 4) o.fern.x = 26;          // the fern is creeping toward the hallway
      if (d >= 5) Object.assign(o.chair1, { x: 10, y: 7, flip: true, flavor: ['A dining chair, pushed into the corner, facing the wall. Like it\'s in trouble. You didn\'t move it.'] });
      if (d >= 6) Object.assign(o.chair2, { x: 15, y: 14, flavor: ['A dining chair. In the bathroom. Facing the mirror. It\'s still warm.'] });
    },

    ruleLabel(id, d) {
      return this.reword && this.reword.id === id ? ALT[id](d) : null;
    },
  };
})();
