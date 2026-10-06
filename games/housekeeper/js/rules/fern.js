// Water the fern once a day, never after dark.
(function () {
  const G = HS.Game, RB = HS.Rulebook, hr = HS.hr;

  RB.define({
    id: 'fern',
    from: 1,
    short: () => 'Water the fern. Never after 8 PM.',
    text: () => 'Water the fern once a day. <b>NEVER after dark</b> (8 PM).',

    setup(st) { st.watered = false; },

    update(st, m) {
      G.once('fern-nag', m >= hr(19.5) && !st.watered, () => G.text('R', 'don\'t forget the fern before 8!! 🌿'));
      G.once('fern-check', m >= hr(20), () => {
        if (!st.watered) G.breakRule('fern', '<p>The fern wilts dramatically, like someone fainting in an old movie.</p><p>It\'s fine. It\'s being dramatic. (It is a little bit not fine.)</p>', 10);
      });
    },

    prompt(o) { return o.id === 'fern' ? 'Water the fern' : null; },

    interact(o, st) {
      if (o.id !== 'fern') return false;
      if (HS.Clock.hour() >= 20) {
        o.big = true;
        G.breakRule('fern', '<p>The fern drinks every drop. Then it grows. And grows.</p><p>It is now taller than you. It whispers, "<i>more</i>."</p>', 20);
      } else if (!st.watered) {
        st.watered = true;
        RB.set('fern', 'done');
        G.good('<p>You water the fern. It perks up and does a tiny happy wiggle.</p>');
      } else {
        G.say('<p>Already watered. The fern looks smug.</p>');
      }
      return true;
    },
  });
})();
