// Wind the grandfather clock before 10 AM, or lose an hour.
(function () {
  const G = HS.Game, RB = HS.Rulebook, hr = HS.hr;

  RB.define({
    id: 'wind',
    from: 2,
    short: () => 'Wind the grandfather clock before 10 AM',
    text: () => 'Wind the <b>grandfather clock</b> (hallway) every morning <b>before 10 AM</b>. If you forget, it gets… creative.',

    setup(st) { st.wound = false; },

    update(st, m) {
      G.once('wind', m >= hr(10), () => {
        if (st.wound) return;
        HS.Audio.play('bong');
        HS.Clock.minutes += 60;
        G.breakRule('wind', '<p><b>BONG.</b> The clock strikes thirteen.</p><p>Every clock in the house skips ahead an hour. You lost an hour. You don\'t know where it went.</p>', 10);
      });
    },

    prompt(o, st) {
      return o.id === 'clock' && !st.wound && HS.Clock.hour() < 10 ? 'Wind the clock' : null;
    },

    interact(o, st) {
      if (o.id !== 'clock' || st.wound || HS.Clock.hour() >= 10) return false;
      st.wound = true;
      RB.set('wind', 'done');
      G.good('<p>You wind the clock. It ticks happily, like a purring cat made of gears.</p>');
      return true;
    },
  });
})();
