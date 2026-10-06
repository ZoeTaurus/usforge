// Empty the washing machine within an hour of it stopping.
(function () {
  const G = HS.Game, RB = HS.Rulebook;

  RB.define({
    id: 'washer',
    from: 5,
    short: () => 'Washer stops? Empty it within 1 hour.',
    text: () => 'When the washing machine <b>stops</b>, empty it within an hour. It doesn\'t like to wait.',

    setup(st, d) {
      st.happens = RB.happens(d, 5, 0.7);
      st.state = 'running';
      if (st.happens) st.at = RB.pickTime(10, 18, 60);
    },

    update(st, m) {
      if (!st.happens) return;
      G.once('wash', m >= st.at, () => {
        st.state = 'stopped';
        HS.Audio.play('beep');
        G.text('H', '🧺 The washing machine stopped. *beep beep*');
      });
      if (st.state === 'stopped' && m >= st.at + 60) {
        st.state = 'broken';
        G.breakRule('washer', '<p>The washer starts again by itself. Angrily.</p><p>It\'s washing… the hallway? There are bubbles everywhere. The floor is very slippery.</p>',
          10, () => G.addEffect('icy', 90));
      }
    },

    prompt(o, st) { return o.id === 'washer' && st.state === 'stopped' ? 'Empty the washer' : null; },

    interact(o, st) {
      if (o.id !== 'washer' || st.state !== 'stopped') return false;
      st.state = 'done';
      RB.set('washer', 'done');
      G.good('<p>You empty the washer. It\'s full of your clothes. All of them.</p><p>Even the ones you\'re wearing right now. They\'re very clean.</p>');
      return true;
    },

    finalize(st) { return st.happens ? 'missed' : 'quiet'; },
  });
})();
