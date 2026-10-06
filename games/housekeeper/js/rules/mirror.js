// Say goodnight to the bathroom mirror between 9 and 11 PM.
(function () {
  const G = HS.Game, RB = HS.Rulebook, hr = HS.hr;
  const inWindow = () => { const h = HS.Clock.hour(); return h >= 21 && h < 23; };

  RB.define({
    id: 'mirror',
    from: 6,
    short: () => 'Say goodnight to the mirror (9–11 PM)',
    text: () => 'Every night between <b>9 and 11 PM</b>, say goodnight to the bathroom mirror. It worries otherwise.',

    setup(st) { st.said = false; },

    update(st, m) {
      G.once('mirror', m >= hr(23), () => {
        if (!st.said) G.breakRule('mirror', '<p>Your reflection stays up all night, worrying.</p><p>You can hear it pacing in the bathroom. It keeps saying your name.</p>', 10);
      });
    },

    prompt(o, st) { return o.id === 'mirror' && !st.said && inWindow() ? 'Say goodnight' : null; },

    interact(o, st) {
      if (o.id !== 'mirror' || st.said || !inWindow()) return false;
      st.said = true;
      RB.set('mirror', 'done');
      G.good('<p>"Goodnight," you say.</p><p>"Goodnight," says your reflection, about half a second before you do.</p>');
      return true;
    },
  });
})();
