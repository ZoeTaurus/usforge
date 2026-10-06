// Day 7: put out the study fire before 10 PM. It relights itself. That's normal.
(function () {
  const G = HS.Game, RB = HS.Rulebook, hr = HS.hr;

  RB.define({
    id: 'fire',
    from: 7,
    short: () => 'Put out the study fire by 9 PM',
    text: () => 'On the last night, <b>put out the fire in the study before 9 PM</b>. It has never been put out before. Please. Do it for me.',

    setup(st) { st.out = false; },

    update(st, m) {
      G.once('fire', m >= hr(21), () => {
        if (!st.out) G.breakRule('fire', '<p>The study fire is still burning.</p><p>Through the wall you can hear it crackling. It sounds like whispering. It sounds like it\'s saying your name, over and over, trying to get it right.</p>', 15);
      });
    },

    prompt(o, st) { return o.id === 'fireplace' && !st.out && HS.Clock.hour() < 21 ? 'Put out the fire' : null; },

    interact(o, st) {
      if (o.id !== 'fireplace' || st.out || HS.Clock.hour() >= 21) return false;
      st.out = true;
      RB.set('fire', 'done');
      HS.Audio.play('slide');
      G.good('<p>You pour water on the fire. It hisses, and goes out for the first time in a very long time.</p><p>In the ashes, the embers glow in the shape of a little house. Then they go dark. The whole house feels like it just exhaled.</p>');
      return true;
    },
  });
})();
