// Never go into the nursery after 9 PM, even if you hear crying.
(function () {
  const G = HS.Game, RB = HS.Rulebook, hr = HS.hr, T = HS.TILE;

  RB.define({
    id: 'nursery',
    from: 5,
    short: () => 'Never enter the nursery after 9 PM',
    text: () => '<b>Never go into the nursery after 9 PM.</b> If you hear crying in there at night, ignore it. There is no baby. There hasn\'t been for a long time.',

    setup(st) { st.broken = false; },

    update(st, m) {
      G.once('nursery-cry', m >= hr(21.6), () => { HS.Audio.play('sob'); G.text('H', 'Faint crying from the nursery. It sounds so sad.'); });
      if (st.broken || m < hr(21) || !G.inRoom('nursery')) return;
      st.broken = true;
      HS.Scare.jump(() => {
        // You're back in the hallway. You don't remember leaving.
        HS.Player.x = 14.5 * T; HS.Player.y = 20.8 * T;
        G.breakRule('nursery', '<p>The nursery door clicks shut behind you. The mobile stops turning. The rocking horse turns, slowly, to face you.</p><p>You\'re back in the hallway. You don\'t remember leaving. The door is open again.</p>', 20);
      });
    },

    finalize() { return 'done'; },
  });
})();
