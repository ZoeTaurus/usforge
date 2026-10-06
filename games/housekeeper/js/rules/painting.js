// If the painting cries, cover it with the towel from the bathroom.
(function () {
  const G = HS.Game, RB = HS.Rulebook;

  RB.define({
    id: 'painting',
    from: 4,
    short: () => 'Painting crying? Cover it with a towel.',
    text: () => 'If the painting starts <b>crying</b>, cover it with a <b>towel</b> from the bathroom. Don\'t ask.',

    setup(st, d) {
      st.happens = RB.happens(d, 4, 0.6);
      st.state = 'calm';
      st.sobT = 0;
      if (st.happens) st.at = RB.pickTime(11, 19, 60);
    },

    update(st, m, dt) {
      if (!st.happens) return;
      G.once('cry', m >= st.at, () => {
        st.state = 'crying';
        G.text('H', '💧 You hear sniffling from the dining room.');
      });
      if (st.state !== 'crying') return;
      st.sobT -= dt;
      if (st.sobT <= 0) { HS.Audio.play('sob'); st.sobT = 6; }
      if (m >= st.at + 60) {
        st.state = 'broken';
        G.breakRule('painting', '<p>The painting sobs so hard the wallpaper peels.</p><p>Everything smells like a sad pond for a while.</p>',
          15, () => G.addEffect('damp', 150));
      }
    },

    prompt(o, st) {
      if (o.id !== 'painting' || st.state !== 'crying') return null;
      return G.holding === 'towel' ? 'Cover it with the towel' : 'The painting is crying';
    },

    interact(o, st) {
      if (o.id !== 'painting' || st.state !== 'crying') return false;
      if (G.holding !== 'towel') {
        G.say('<p>The painting is crying big, wet, painted tears.</p><p>You need a <b>towel</b>. There\'s one in the bathroom.</p>');
        return true;
      }
      G.holding = null;
      st.state = 'covered';
      RB.set('painting', 'done');
      G.good('<p>You gently drape the towel over the painting.</p><p>The sobbing turns into a sniffle, then a tiny snore.</p>');
      return true;
    },

    finalize(st) { return st.happens ? 'missed' : 'quiet'; },
  });
})();
