// Eat dinner at the dining table between 6 and 8 PM. Set a place for one. Only one.
(function () {
  const G = HS.Game, RB = HS.Rulebook, hr = HS.hr;
  const inWindow = () => { const h = HS.Clock.hour(); return h >= 18 && h < 20; };

  RB.define({
    id: 'dinner',
    from: 4,
    short: () => 'Eat dinner at the table 6–8 PM. One place only.',
    text: () => 'Eat dinner at the <b>dining table</b> between <b>6 and 8 PM</b>. Set a place for <b>one</b>. Only one. Never two.',

    setup(st) { st.done = false; },

    update(st, m) {
      G.once('dinner', m >= hr(20), () => {
        if (!st.done) G.breakRule('dinner', '<p>You skipped dinner.</p><p>The house sets the table anyway. You can hear cutlery clinking in the dining room for a long time. Nobody is in there.</p>', 10);
      });
    },

    prompt(o, st) { return o.id === 'table' && !st.done && inWindow() ? 'Eat dinner' : null; },

    interact(o, st) {
      if (o.id !== 'table' || st.done || !inWindow()) return false;
      st.done = true;
      G.say('<p>When you get to the table, it\'s already set.</p><p><b>Two</b> plates. Two glasses. The chair across from yours is pulled out a little, as if someone is about to sit down.</p>', [
        { label: 'Put the second place away', action: () => {
          RB.set('dinner', 'done');
          G.good('<p>You put the second plate back in the cupboard and push the chair in.</p><p>Something sighs, very close to your ear. You eat quickly. The food is delicious. You don\'t remember cooking it.</p>');
        } },
        { label: 'Just eat', action: () => G.breakRule('dinner',
          '<p>You eat. Across the table, the second plate slowly empties too.</p><p>You can hear chewing. You can\'t see who\'s chewing. When you\'re done, the chair across from you slides back in by itself.</p>', 15) },
      ]);
      return true;
    },
  });
})();
