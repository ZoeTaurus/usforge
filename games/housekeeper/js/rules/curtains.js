// Close the sunroom curtains before dark. Never look out after dark.
(function () {
  const G = HS.Game, RB = HS.Rulebook, hr = HS.hr;
  const WINDOWS = ['window1', 'window2'];

  RB.define({
    id: 'curtains',
    from: 3,
    short: () => 'Close sunroom curtains by 8 PM. Never look out after.',
    text: () => 'Close <b>both sunroom curtains</b> before dark (<b>8 PM</b>). After dark, <b>never look out of the windows</b>. Whatever is in the garden doesn\'t need to see you.',
    progress: st => `${st.closed.length}/2`,

    setup(st) { st.closed = []; st.looked = false; },

    update(st, m) {
      G.once('curtains', m >= hr(20), () => {
        if (st.closed.length < WINDOWS.length) {
          G.breakRule('curtains', '<p>The sunroom curtains are still open after dark.</p><p>Something on the lawn can see straight into the house now. It watched you all evening. It\'s still watching.</p>', 15);
        }
      });
    },

    prompt(o, st) {
      if (!WINDOWS.includes(o.id) || st.closed.includes(o.id)) return null;
      return HS.Clock.hour() < 20 ? 'Close the curtain' : 'Look outside';
    },

    interact(o, st) {
      if (!WINDOWS.includes(o.id)) return false;
      if (st.closed.includes(o.id)) {
        G.say('<p>The curtain is closed. Something taps on the glass behind it. Twice.</p><p>You leave it closed.</p>');
        return true;
      }
      if (HS.Clock.hour() < 20) {
        st.closed.push(o.id);
        HS.Audio.play('slide');
        if (st.closed.length === WINDOWS.length && RB.status.curtains === 'pending') {
          RB.set('curtains', 'done');
          G.good('<p>You close the last curtain. Just before it shuts, you see the garden gnome. It\'s facing the house. It\'s closer than it was this morning.</p>');
        } else {
          G.say('<p>You pull the curtain closed. One more.</p>');
          HS.UI.renderRules();
        }
        return true;
      }
      // Looking out after dark.
      st.looked = true;
      HS.Scare.jump(() => G.breakRule('curtains', '<p>You look out into the dark garden.</p><p>It was standing right outside the glass. Its face was pressed against it. It had been waiting for you to look.</p>', 20));
      return true;
    },
  });
})();
