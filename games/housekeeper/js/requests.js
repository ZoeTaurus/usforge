// House requests: every so often during the day, the house needs something. Small, quick, and on a timer,
// so there's always something to do between the big rules. They don't cost stars, only house mood.
(function () {
  const G = HS.Game, hr = HS.hr;
  const rand = (a, b) => a + Math.random() * (b - a);

  // obj: what to interact with. ask: the House's text. done/fail: what happens.
  const REQUESTS = [
    { id: 'tap', obj: 'sink', ask: 'The kitchen tap is running by itself.', verb: 'Turn off the tap',
      done: 'You turn the tap off. The pipes give a long, relieved sigh.', fail: 'The tap ran all afternoon. The kitchen floor is slick.' },
    { id: 'dryer', obj: 'dryer', ask: 'Something is knocking inside the dryer.', verb: 'Open the dryer',
      done: 'You open the dryer. Just your sneakers, tumbling. You didn\'t put them in there.', fail: 'The knocking in the dryer stopped on its own. That\'s worse.' },
    { id: 'phone', obj: 'phone', ask: 'The landline is off the hook. Someone is breathing into it.', verb: 'Hang up the phone',
      done: 'You hang up. Then pick it up again to check. Dial tone. Good. Probably.', fail: 'The breathing on the phone went on for an hour. Then it said "okay" and hung up.' },
    { id: 'photo', obj: 'photo2', ask: 'A family photo fell off the wall in the back hallway.', verb: 'Hang the photo back up',
      done: 'You hang the photo back up. One of the people in it has moved to a different spot.', fail: 'Nobody hung the photo up. It hung itself back up. Crooked. On purpose.' },
    { id: 'window', obj: 'window1', ask: 'A sunroom window is wide open. It\'s letting the cold in. And maybe something else.', verb: 'Close the window',
      done: 'You close the window. On the outside of the glass there\'s a handprint. A small one.', fail: 'The sunroom window stayed open. Now there are leaves on the floor in the shape of footprints.' },
    { id: 'fire', obj: 'fireplace', ask: 'The study fireplace is roaring much too high.', verb: 'Calm the fire down',
      done: 'You poke the fire down. It hisses at you, then settles, purring.', fail: 'The fire in the study burned high all afternoon. The books smell like smoke and something sweeter.' },
    { id: 'crib', obj: 'crib', ask: 'You hear crying from the nursery. There is no baby.', verb: 'Rock the crib',
      done: 'You rock the empty crib until the crying stops. It takes a long time.', fail: 'Nobody went to the nursery. The crying stopped. Then it started laughing.' },
    { id: 'lamp', obj: 'lamp', ask: 'The bedroom lamp is flickering in a pattern.', verb: 'Tap the lamp',
      done: 'You tap the lamp. It stops. You worked out the pattern too late: H-I.', fail: 'The lamp flickered all afternoon. The same word, over and over.' },
    { id: 'clock', obj: 'clock', ask: 'The grandfather clock is ticking backwards.', verb: 'Fix the pendulum',
      done: 'You nudge the pendulum. It starts ticking forwards again, sulkily.', fail: 'The clock ticked backwards for an hour. You feel slightly younger and a lot more nervous.' },
    { id: 'tub', obj: 'tub', ask: 'The bathtub is filling up by itself.', verb: 'Pull the plug',
      done: 'You pull the plug. The water drains slowly, like it really doesn\'t want to go.', fail: 'The tub overflowed. The ducks are all in the hallway now. Facing the bedroom.' },
    { id: 'globe', obj: 'globe', ask: 'The globe in the study won\'t stop spinning.', verb: 'Stop the globe',
      done: 'You stop the globe with one finger. It stops on this house\'s exact location. There\'s a tiny red X.', fail: 'The globe spun until it fell off its stand. It\'s still spinning on the floor.' },
    { id: 'coats', obj: 'coats', ask: 'One of the coats in the back hallway fell down.', verb: 'Hang up the coat',
      done: 'You hang the coat back up. It\'s heavy, like someone is still wearing it.', fail: 'The coat on the floor moved closer to the bedroom.' },
    { id: 'horse', obj: 'horse', ask: 'The rocking horse in the nursery is rocking. Hard.', verb: 'Stop the rocking horse',
      done: 'You grab the rocking horse. It stops. It\'s warm, like it\'s been running.', fail: 'The rocking horse rocked all afternoon. It\'s facing the door now.' },
    { id: 'tv', obj: 'tv', ask: 'The TV is showing a test pattern at full volume.', verb: 'Turn off the TV',
      done: 'You turn it off. For a second the black screen still shows the test pattern. Then it\'s gone.', fail: 'The test pattern played for an hour. You can still see it when you close your eyes.' },
  ];

  HS.Requests = {
    current: null,   // { id, until }
    nextAt: 0,
    done: 0,

    setupDay() {
      this.current = null;
      this.lastM = 0;
      this.nextAt = hr(10.5) + rand(0, 60);
    },

    state() { return { current: this.current, nextAt: this.nextAt }; },
    restore(s) { if (s) { this.current = s.current; this.nextAt = s.nextAt; } },

    def() { return this.current && REQUESTS.find(r => r.id === this.current.id); },

    // True while a rule has you pinned in place (watching TV, hiding, walking with the footsteps).
    pinned() {
      const RB = HS.Rulebook;
      return RB.get('tv').state === 'watching' || RB.get('tv').state === 'on' ||
        RB.get('blackout').state === 'dark' || RB.get('footsteps').state === 'active';
    },

    update(m) {
      const dm = this.lastM ? Math.max(0, m - this.lastM) : 0;
      this.lastM = m;
      // Requests wait while a rule has you busy: no new ones, and the current timer pauses.
      if (this.pinned()) {
        if (this.current) this.current.until += dm;
        this.nextAt = Math.max(this.nextAt, m + 10);
        return;
      }
      // No requests at night: you're meant to be in bed.
      if (!this.current && m >= this.nextAt && m < hr(21.25)) this.spawn(m);
      const r = this.def();
      if (r && m >= this.current.until) {
        this.current = null;
        G.chaos = Math.min(HS.CHAOS_MAX, G.chaos + 5);
        G.text('H', `😠 ${r.fail}`);
        HS.Audio.play('bad');
        this.schedule(m);
        HS.UI.renderRules();
      }
    },

    spawn(m) {
      // Don't ask for something a rule is using right now.
      const busy = new Set();
      const RB = HS.Rulebook;
      if (RB.get('phone').state === 'ringing') busy.add('phone');
      if (RB.on('tv') && RB.get('tv').state !== 'off') busy.add('tv');
      if (RB.get('wind').wound === false && m < hr(10)) busy.add('clock');
      // Don't send you somewhere a rule forbids, or ask for something a rule already covers.
      if (RB.on('curtains')) busy.add('window');
      if (RB.on('fire')) busy.add('fire');
      if (RB.on('nursery') && m >= hr(19.5)) { busy.add('crib'); busy.add('horse'); }
      const options = REQUESTS.filter(r => !busy.has(r.id) && HS.Map.byId[r.obj]);
      const r = options[Math.floor(Math.random() * options.length)];
      this.current = { id: r.id, until: m + 45 };
      G.text('H', `⚠ ${r.ask}`);
      HS.Audio.play('beep');
      HS.UI.renderRules();
    },

    schedule(m) { this.nextAt = m + rand(75, 130); },

    prompt(o) {
      const r = this.def();
      return r && o.id === r.obj ? `⚠ ${r.verb}` : null;
    },

    interact(o) {
      const r = this.def();
      if (!r || o.id !== r.obj) return false;
      this.current = null;
      this.done++;
      G.chaos = Math.max(0, G.chaos - 3);
      this.schedule(HS.Clock.minutes);
      G.good(`<p>${r.done}</p>`);
      HS.UI.renderRules();
      return true;
    },

    // Shown under the chores.
    html() {
      const r = this.def();
      if (!r) return '';
      const left = Math.max(0, Math.round(this.current.until - HS.Clock.minutes));
      return `<li class="request ${left < 15 ? 'urgent' : ''}"><span><span class="label">The house wants</span>${r.verb} <b>(${left} min)</b></span></li>`;
    },
  };
})();
