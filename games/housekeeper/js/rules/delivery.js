// Sign for deliveries, but never bring the box inside.
(function () {
  const G = HS.Game, RB = HS.Rulebook;

  RB.define({
    id: 'delivery',
    from: 6,
    short: () => 'Sign for deliveries. Box stays outside.',
    text: () => 'If the doorbell rings, it\'s a delivery. <b>Sign for it</b> at the front door, but <b>leave the box outside</b>. Always.',

    setup(st, d) {
      st.happens = RB.happens(d, 6, 0.7);
      st.state = 'none';
      if (st.happens) st.at = RB.pickTime(11, 17, 45);
    },

    update(st, m) {
      if (!st.happens) return;
      G.once('bell', m >= st.at, () => {
        st.state = 'waiting';
        HS.Audio.play('doorbell');
        G.text('H', '🔔 Ding-dong! Someone\'s at the front door.');
      });
      if (st.state === 'waiting' && m >= st.at + 45) {
        st.state = 'broken';
        G.breakRule('delivery', '<p>The courier gives up. A slip slides under the door:</p><p><b>"WE\'LL BE BACK. WE ALWAYS COME BACK."</b></p>', 10);
      }
    },

    prompt(o, st) { return o.id === 'frontdoor' && st.state === 'waiting' ? 'Answer the door' : null; },

    interact(o, st) {
      if (o.id !== 'frontdoor' || st.state !== 'waiting') return false;
      st.state = 'answered';
      G.say('<p>You open the door a crack. A courier in a crisp uniform holds out a clipboard.</p><p>They don\'t have a face. Their handwriting is lovely, though.</p><p>"Package for Robin. Sign here?"</p>', [
        { label: 'Sign, leave the box outside', action: () => {
          RB.set('delivery', 'done');
          G.good('<p>You sign. The courier nods (somehow) and leaves the box on the step.</p><p>When you look again, the box is gone. Good.</p>');
        } },
        { label: 'Sign, bring the box in', action: () => G.breakRule('delivery',
          '<p>You carry the box inside. It\'s warm. It\'s <i>purring</i>.</p><p>You set it down and it\'s gone. Somewhere in the house, it purrs.</p>', 15) },
      ]);
      return true;
    },

    finalize(st) { return st.happens ? 'missed' : 'quiet'; },
  });
})();
