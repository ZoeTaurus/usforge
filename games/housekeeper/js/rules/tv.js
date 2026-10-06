// If the TV turns itself on, sit on the couch and watch until it turns off.
(function () {
  const G = HS.Game, RB = HS.Rulebook;

  const SHOWS = [
    'a cooking show about soup. You learned a lot about soup.',
    'a nature documentary about this exact house. The narrator whispered when you were on screen.',
    'a game show. The contestant looked a lot like you. They lost.',
    'a weather report for the inside of the house: "Light chairs, with a chance of humming."',
    'a cartoon about a family of rubber ducks. There were eight of them. Then seven.',
    'twenty minutes of static. Somehow you understood all of it.',
    'a home video of a kind old woman baking cookies in this kitchen. She waved at the camera. At you.',
  ];

  RB.define({
    id: 'tv',
    from: 2,
    short: () => 'If the TV turns on, sit & watch it',
    text: () => 'If the TV turns on by itself, <b>sit on the couch</b> and watch politely until it turns off.',

    setup(st, d) {
      st.happens = RB.happens(d, 2, 0.7);
      st.state = 'off';
      st.show = SHOWS[(d - 1) % SHOWS.length];
      if (st.happens) {
        st.onAt = RB.pickTime(11.5, 18, 105);
        RB.lock(st.onAt, st.onAt + 105);
      }
    },

    update(st, m) {
      if (!st.happens) return;
      G.once('tv-on', m >= st.onAt, () => {
        st.state = 'on';
        HS.Audio.play('static');
        G.text('H', '📺 The TV turned itself on.');
        const P = HS.Player;
        if (P.sitting && P.sitting.id === 'couch') { st.state = 'watching'; st.seatedAt = m; }
      });
      if (st.state === 'on' && m >= st.onAt + 45) {
        st.state = 'broken';
        G.breakRule('tv', '<p>The TV waited for you. You didn\'t come.</p><p>It goes fuzzy with offended static, and so does everything else. It\'s going to sulk for a while.</p>',
          15, () => G.addEffect('static', 120));
      }
      if (st.state === 'watching' && m >= st.seatedAt + 60) {
        st.state = 'done';
        RB.set('tv', 'done');
        G.good(`<p>The TV clicks off. For a second the screen says <b>THANKS FOR WATCHING</b>.</p><p>It was ${st.show}</p>`);
      }
    },

    prompt(o, st) { return o.id === 'tv' && st.state === 'on' ? 'The TV wants you on the couch' : null; },

    interact(o, st) {
      if (o.id === 'tv') {
        if (st.state === 'on') { G.say('<p>The TV wants you on the <b>couch</b>. It is very clear about this.</p>'); return true; }
        if (st.state === 'done') { G.say('<p>The TV is off. It seems content.</p>'); return true; }
        return false;
      }
      if (o.id === 'couch' && HS.Player.sitting === o && st.state === 'watching') {
        G.say('<p>Shh. The show is on.</p>');
        return true;
      }
      return false;
    },

    onSit(o, st) {
      if (o.id !== 'couch' || st.state !== 'on') return;
      st.state = 'watching';
      st.seatedAt = HS.Clock.minutes;
      G.say('<p>You sit down and give the TV your full, polite attention.</p><p><i>(Stay seated until it turns off.)</i></p>');
    },

    onStand(o, st) {
      if (o.id !== 'couch' || st.state !== 'watching') return;
      st.state = 'broken';
      G.breakRule('tv', '<p>You get up in the middle of the show.</p><p>The TV gasps. Actually gasps. Then everything goes fuzzy, like bad reception. It\'s going to sulk for a while.</p>',
        15, () => G.addEffect('static', 120));
    },

    finalize(st) { return st.happens ? 'missed' : 'quiet'; },
  });
})();
