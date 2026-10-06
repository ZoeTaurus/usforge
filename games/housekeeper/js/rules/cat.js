// Feed the invisible cat. From Day 4 he's on a diet: evening only.
(function () {
  const G = HS.Game, RB = HS.Rulebook, hr = HS.hr;

  RB.define({
    id: 'cat',
    from: 1,
    short: d => d >= 4 ? 'Feed Mr. Whiskers: EVENING ONLY (diet!)' : 'Feed Mr. Whiskers: morning + evening',
    text: d => d >= 4
      ? 'Mr. Whiskers is on a <b>diet</b>. Feed him <b>only in the evening</b> (5–9 PM). (Still don\'t have a cat.)'
      : 'Feed Mr. Whiskers twice: once <b>before noon</b>, once <b>between 5 and 9 PM</b>. (I don\'t have a cat.)',
    changed: d => d === 4,

    setup(st) { st.am = false; st.pm = false; },

    update(st, m, dt, d) {
      if (d < 4) {
        G.once('cat-nag', m >= hr(11) && !st.am, () => G.text('R', 'did u feed mr whiskers?? he gets cranky at noon'));
        G.once('cat-am', m >= hr(12), () => {
          if (!st.am) G.breakRule('cat', '<p><b>CRASH.</b> Every mug in the kitchen slides off the counter at once.</p><p>Something invisible is very, very hungry.</p>', 20);
        });
      }
      G.once('cat-pm-nag', m >= hr(17), () => G.text('R', 'dinner time for mr whiskers!! 🐈'));
      G.once('cat-pm', m >= hr(21), () => {
        if (!st.pm) G.breakRule('cat', '<p>Every cabinet in the kitchen opens and slams shut. Twice.</p><p>Mr. Whiskers did not get dinner. Mr. Whiskers is upset.</p>', 20);
      });
    },

    prompt(o) { return o.id === 'bowl' ? 'Feed Mr. Whiskers' : null; },

    interact(o, st, d) {
      if (o.id !== 'bowl') return false;
      const h = HS.Clock.hour();
      if (h < 12 && !st.am) {
        st.am = true;
        if (d >= 4) {
          G.breakRule('cat', '<p>You pour breakfast. A furious hiss comes from nowhere.</p><p>Mr. Whiskers is <b>on a diet</b>. Robin said so. He is upset that you tempted him.</p>', 10);
        } else {
          G.good('<p>You pour kibble into the bowl. You blink. The bowl is empty.</p><p>A purr comes from nowhere in particular.</p>');
        }
        return true;
      }
      if (h >= 17 && h < 21 && !st.pm) {
        st.pm = true;
        RB.set('cat', 'done');
        G.good('<p>Dinner is served. The kibble vanishes with a crunch.</p><p>Something invisible rubs against your leg. Aww.</p>');
        return true;
      }
      if (h >= 12 && h < 17) G.say('<p>Mr. Whiskers isn\'t hungry yet. Something swats your hand away.</p>');
      else G.say('<p>The bowl is licked clean. You hear a satisfied purr.</p>');
      return true;
    },
  });
})();
