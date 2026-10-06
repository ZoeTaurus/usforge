// Answer the landline, but never say your name.
(function () {
  const G = HS.Game, RB = HS.Rulebook;

  RB.define({
    id: 'phone',
    from: 3,
    short: () => 'Answer the landline. Never say your name.',
    text: () => 'The landline will ring. <b>Answer it</b> within 30 minutes, but <b>never say your name</b>.',

    setup(st, d) {
      st.happens = RB.happens(d, 3, 0.7);
      st.state = 'idle';
      st.ringT = 0;
      if (st.happens) st.at = RB.pickTime(10, 19, 30);
    },

    update(st, m, dt) {
      if (!st.happens) return;
      G.once('ring', m >= st.at, () => {
        st.state = 'ringing';
        G.text('H', '☎ The landline is ringing.');
      });
      if (st.state !== 'ringing') return;
      st.ringT -= dt;
      if (st.ringT <= 0) { HS.Audio.play('ring'); st.ringT = 2.5; }
      if (m >= st.at + 30) {
        st.state = 'broken';
        G.breakRule('phone', '<p>The phone rings out. Then every phone-shaped thing in the house starts ringing.</p><p>The banana in the kitchen. The TV remote. Your shoe.</p>', 10);
      }
    },

    prompt(o, st) { return o.id === 'phone' && st.state === 'ringing' ? 'Answer the phone' : null; },

    interact(o, st) {
      if (o.id !== 'phone' || st.state !== 'ringing') return false;
      st.state = 'answered';
      HS.Audio.play('click');
      G.say('<p>You pick up. Crackling. Then a warm, old voice:</p><p>"Hello, dear. Who\'s this?"</p>', [
        { label: '"Robin\'s residence."', action: () => {
          RB.set('phone', 'done');
          G.good('<p>"Oh, good. Tell the house I said goodnight." <i>Click.</i></p><p>You feel weirdly comforted.</p>');
        } },
        { label: 'Say your name', action: () => G.breakRule('phone',
          '<p>You say your name. The voice repeats it back, slowly, like it\'s trying it on.</p><p>"Thank you," it says. For the rest of the day, your name feels slightly loose.</p>', 15) },
      ]);
      return true;
    },

    finalize(st) { return st.happens ? 'missed' : 'quiet'; },
  });
})();
