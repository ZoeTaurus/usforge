// If you hear footsteps following you, keep walking until they stop.
(function () {
  const G = HS.Game, RB = HS.Rulebook;
  const DURATION = 18; // real seconds of keep-walking

  RB.define({
    id: 'footsteps',
    from: 6,
    short: () => 'Footsteps behind you? Keep walking. Don\'t stop.',
    text: () => 'If you hear <b>footsteps following you</b>, keep walking until they stop. <b>Don\'t stop. Don\'t sit down.</b> It only walks where you\'ve been.',

    setup(st) {
      st.state = 'waiting';
      // 18 real seconds is about 80 in-game minutes; keep that window clear of the TV and anything else that pins you down.
      st.at = RB.pickTime(11, 19, 100);
      RB.lock(st.at, st.at + 100);
    },

    update(st, m, dt) {
      if (st.state === 'waiting' && m >= st.at) {
        st.state = 'active';
        st.left = DURATION;
        st.still = 0;
        st.stepT = 0;
        G.say('<p>Footsteps. Right behind you. Matching yours exactly.</p><p><b>Keep walking.</b> Don\'t stop until they stop.</p>', null, 'bad');
        return;
      }
      if (st.state !== 'active') return;
      const P = HS.Player;
      st.left -= dt;
      st.still = P.moving && !P.sitting ? 0 : st.still + dt;
      st.stepT -= dt;
      if (P.moving && st.stepT <= 0) { HS.Audio.play('steps'); st.stepT = 0.55; }
      if (st.still > 1.3) {
        st.state = 'broken';
        G.breakRule('footsteps', '<p>You stopped.</p><p>The footsteps didn\'t. Something walks straight into your back, and <i>through</i> you. It\'s so cold your teeth hurt.</p>', 15);
      } else if (st.left <= 0) {
        st.state = 'done';
        RB.set('footsteps', 'done');
        G.good('<p>The footsteps stop. You stop.</p><p>Behind you, very softly, something keeps breathing for a little while. Then that stops too.</p>');
      }
    },

    finalize(st) { return st.state === 'waiting' ? 'quiet' : 'missed'; },
  });
})();
