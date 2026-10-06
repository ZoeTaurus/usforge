// Sometimes a fifth chair appears at the table. Sit in it, or it follows you.
(function () {
  const G = HS.Game, RB = HS.Rulebook, T = HS.TILE;

  RB.define({
    id: 'chair',
    from: 3,
    short: () => '5 chairs at the table? Sit in the new one.',
    text: () => 'There are 4 chairs at the dining table. If there are ever <b>5</b>, sit in the new one. Quickly.',

    setup(st, d) {
      st.happens = RB.happens(d, 3, 0.6);
      st.state = 'none';
      if (st.happens) st.at = RB.pickTime(15, 19, 90);
    },

    update(st, m, dt) {
      if (!st.happens) return;
      const chair = HS.Map.byId.chair5;
      G.once('chair-in', m >= st.at, () => {
        chair.visible = true;
        st.state = 'present';
        HS.Audio.play('scrape');
      });
      G.once('chair-out', m >= st.at + 90, () => {
        if (st.state !== 'present') return;
        st.state = 'following';
        chair.solid = false;
        G.breakRule('chair', '<p>You hear a chair scrape across the floor.</p><p>It\'s coming from <b>right behind you</b>. The fifth chair is following you now. It just wants you to sit down.</p>', 15);
      });
      if (st.state === 'following') {
        const P = HS.Player;
        const dx = P.x - (chair.x + 0.5) * T, dy = P.y - (chair.y + 0.5) * T;
        const dist = Math.hypot(dx, dy);
        if (dist > 20) { chair.x += dx / dist * 0.9 * dt; chair.y += dy / dist * 0.9 * dt; }
      }
    },

    prompt(o) { return o.id === 'chair5' ? 'Sit in the new chair' : null; },

    interact(o, st) {
      if (o.id !== 'chair5') return false;
      if (HS.Player.sitting === o) return true;
      HS.Player.sit(o);
      if (st.state === 'present') {
        st.state = 'done';
        RB.set('chair', 'done');
        G.good('<p>You sit in the fifth chair.</p><p>It\'s warm, like someone just got up. Somewhere in the house, someone sighs with relief.</p>');
      } else if (st.state === 'following') {
        st.state = 'resolved';
        G.chaos = Math.max(0, G.chaos - 10);
        G.say('<p>You finally sit down. The chair stops wobbling.</p><p>It seems… satisfied. <i>(House mood improved a little.)</i></p>');
      }
      return true;
    },

    onStand(o, st) {
      if (o.id === 'chair5' && (st.state === 'done' || st.state === 'resolved')) o.visible = false;
    },

    finalize(st) { return st.happens ? 'missed' : 'quiet'; },
  });
})();
