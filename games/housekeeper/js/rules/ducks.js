// Count the rubber ducks every evening. Seven is correct. Eight is not.
(function () {
  const G = HS.Game, RB = HS.Rulebook, hr = HS.hr;
  const inWindow = () => { const h = HS.Clock.hour(); return h >= 18 && h < 22; };

  RB.define({
    id: 'ducks',
    from: 4,
    short: () => 'Count the tub ducks 6–10 PM. 7 is right.',
    text: () => 'Count the rubber ducks in the tub every evening (<b>6–10 PM</b>). There should be <b>7</b>. If there are 8, remove one.',

    setup(st) {
      st.count = Math.random() < 0.5 ? 8 : 7;
      st.checked = false;
    },

    update(st, m) {
      G.once('duck-check', m >= hr(22), () => {
        if (!st.checked) G.breakRule('ducks', '<p>Nobody counted the ducks. The ducks noticed.</p><p>You hear squeaking from the bathroom. Rhythmic squeaking. Like marching.</p>', 10);
      });
    },

    prompt(o, st) { return o.id === 'tub' && !st.checked && inWindow() ? 'Count the ducks' : null; },

    interact(o, st) {
      if (o.id !== 'tub' || st.checked || !inWindow()) return false;
      st.checked = true;
      const counting = Array.from({ length: st.count }, (_, i) => i + 1).join('… ');
      const done = html => { RB.set('ducks', 'done'); G.good(html); };
      G.say(`<p>You count the ducks: ${counting}.</p><p><b>${st.count} ducks.</b></p>`, [
        { label: 'Remove one', action: () => {
          if (st.count === 8) {
            st.count = 7;
            done('<p>You lift out the eighth duck. It\'s warm. It doesn\'t squeak.</p><p>You drop it in the sink and when you look back, it\'s gone. Good.</p>');
          } else {
            st.count = 6;
            G.breakRule('ducks', '<p>You removed a real duck.</p><p>The other six turn to look at you. Slowly. <i>Squeak.</i></p>', 15);
          }
        } },
        { label: 'Leave them', action: () => {
          if (st.count === 7) done('<p>Seven ducks. Perfect. They seem pleased. One of them winks.</p>');
          else G.breakRule('ducks', '<p>You left the eighth duck.</p><p>Later, you find it in your bed. Then on your pillow. Then gone.</p>', 15);
        } },
      ]);
      return true;
    },
  });
})();
