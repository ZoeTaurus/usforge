// When the lights go out, hide under the bed until they come back.
(function () {
  const G = HS.Game, RB = HS.Rulebook, hr = HS.hr;

  RB.define({
    id: 'blackout',
    from: 5,
    short: () => 'Lights go out? Hide under the bed.',
    text: () => 'If the lights go out, <b>hide under the bed</b> (within a few minutes) until they come back on. Don\'t peek.',

    setup(st, d) {
      st.happens = RB.happens(d, 5, 0.6);
      st.state = 'none';
      st.hiding = false;
      if (st.happens) st.at = hr(21) + Math.floor(Math.random() * 60);
    },

    update(st, m) {
      if (!st.happens) return;
      const P = HS.Player;
      G.once('bo-start', m >= st.at, () => {
        st.state = 'dark';
        G.addEffect('blackout', 40);
        HS.Audio.play('powerdown');
        if (P.sitting && P.sitting.id === 'bed') {
          st.hiding = true;
          P.hidden = true;
          G.say('<p>The lights die. You roll under the bed. Good instincts.</p>');
        } else {
          G.say('<p><b>Click.</b> Every light in the house goes out.</p><p>Somewhere in the dark, something starts walking. <b>Get under the bed.</b></p>', null, 'bad');
        }
      });
      if (st.state === 'dark' && !st.hiding && m >= st.at + 20) {
        st.state = 'broken';
        G.breakRule('blackout', '<p>Something walks past you in the dark. It stops.</p><p>It pats you on the head, gently. That\'s so much worse.</p>', 20);
      }
      G.once('bo-end', m >= st.at + 40, () => {
        HS.Audio.play('powerup');
        if (st.state === 'dark' && st.hiding) {
          st.state = 'done';
          RB.set('blackout', 'done');
          G.good('<p>The lights flicker back on. Whatever was walking around has gone.</p><p>There\'s a cookie on the floor next to the bed. Thanks?</p>');
        }
        st.hiding = false;
        P.hidden = false;
      });
    },

    prompt(o, st) {
      if (o.id !== 'bed' || st.state !== 'dark') return null;
      return st.hiding ? 'Hiding… (moving = peeking)' : 'Hide under the bed!';
    },

    interact(o, st) {
      if (o.id !== 'bed' || st.state !== 'dark') return false;
      if (!st.hiding) {
        HS.Player.sit(o);
        st.hiding = true;
        HS.Player.hidden = true;
      }
      return true;
    },

    onStand(o, st) {
      if (o.id !== 'bed' || !st.hiding || st.state !== 'dark') return;
      st.hiding = false;
      st.state = 'broken';
      G.breakRule('blackout', '<p>You peek out from under the bed.</p><p>Something peeks back.</p>', 20);
    },

    finalize(st) { return st.happens ? 'missed' : 'quiet'; },
  });
})();
