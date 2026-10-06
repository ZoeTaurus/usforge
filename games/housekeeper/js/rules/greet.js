// Say good morning to the painting before 10 AM. She likes to be noticed.
(function () {
  const G = HS.Game, RB = HS.Rulebook, hr = HS.hr;

  RB.define({
    id: 'greet',
    from: 2,
    short: () => 'Say good morning to the painting before 10 AM',
    text: () => 'Say <b>good morning</b> to the painting in the dining room <b>before 10 AM</b>. Every day. She likes to be noticed.',

    setup(st) { st.done = false; },

    update(st, m) {
      G.once('greet', m >= hr(10), () => {
        if (!st.done) G.breakRule('greet', '<p>You forgot to say good morning.</p><p>Every time you walk past the dining room for the rest of the day, you hear a small, wet sniff.</p>', 10);
      });
    },

    prompt(o, st) { return o.id === 'painting' && !st.done && HS.Clock.hour() < 10 ? 'Say good morning' : null; },

    interact(o, st, d) {
      if (o.id !== 'painting' || st.done || HS.Clock.hour() >= 10) return false;
      st.done = true;
      RB.set('greet', 'done');
      G.good(d >= 5
        ? '<p>"Good morning," you say.</p><p>"Good morning, dear," she says back. Her voice comes from right behind you.</p>'
        : '<p>"Good morning," you say.</p><p>She beams at you. The whole room feels a little warmer. Uncomfortably warmer.</p>');
      return true;
    },
  });
})();
