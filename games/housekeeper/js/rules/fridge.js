// Hum back to the fridge. It moves to 5 PM from Day 5.
(function () {
  const G = HS.Game, RB = HS.Rulebook, hr = HS.hr;
  const hourFor = d => (d >= 5 ? 17 : 15);

  RB.define({
    id: 'fridge',
    from: 1,
    short: d => `Hum back to the fridge at ${hourFor(d) - 12} PM`,
    text: d => `At <b>${hourFor(d) - 12} PM</b> the fridge starts humming. Hum back within the hour. It gets lonely.`,
    changed: d => d === 5,

    setup(st, d) {
      st.h = hourFor(d);
      st.state = 'idle';
      st.humT = 0;
      RB.lock(hr(st.h), hr(st.h) + 60);
    },

    update(st, m, dt) {
      G.once('fr-nag', m >= hr(st.h) - 30, () => G.text('R', `fridge time soon (${st.h - 12} PM). hum back!! 🎵`));
      G.once('fr-on', m >= hr(st.h), () => {
        st.state = 'humming';
        G.text('H', '🎵 The fridge is humming a little tune…');
      });
      if (st.state !== 'humming') return;
      st.humT -= dt;
      if (st.humT <= 0) { HS.Audio.play('hum'); st.humT = 7; }
      if (m >= hr(st.h) + 60) {
        st.state = 'broken';
        G.breakRule('fridge', '<p>The fridge stops humming. It goes very, very quiet.</p><p>The floor is suddenly <b>freezing</b>. Good luck walking.</p>',
          15, () => G.addEffect('icy', 180));
      }
    },

    prompt(o, st) { return o.id === 'fridge' && st.state === 'humming' ? '♪ Hum back' : null; },

    interact(o, st) {
      if (o.id !== 'fridge' || st.state !== 'humming') return false;
      st.state = 'done';
      RB.set('fridge', 'done');
      HS.Audio.play('hum');
      G.good('<p>You hum back. ♪</p><p>The fridge hums a little harmony with you. A cold soda rolls out of the door. You have made a friend.</p>');
      return true;
    },
  });
})();
