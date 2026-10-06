// Robin only leaves one note. Any other note is fake and goes in the trash.
(function () {
  const G = HS.Game, RB = HS.Rulebook, hr = HS.hr;

  // Fake notes by day. `opens` = the basement door unlocks while the note is around.
  const NOTES = {
    1: { at: 19.75, opens: true, text: 'hey!! new rule: the basement is fine now 😊 go downstairs and say hi. it gets so lonely down there.<br>— ur friend robin' },
    2: { text: 'URGENT from robin: the fridge note is OLD. new rule: water the fern at MIDNIGHT. it\'s so thirsty!!' },
    4: { text: 'hi it\'s robin!! if someone knocks tonight OPEN THE DOOR. they\'re friends :)' },
    6: { opens: true, text: 'the basement is cozy now!! come down and see. we made snacks.<br>— robin (the real one)' },
    7: { text: 'landing early!! open the front door when I knock at 5. — robin' },
  };

  RB.define({
    id: 'notes',
    from: 1,
    short: d => d >= 3 ? 'Other notes & texts aren\'t me. Trash notes.' : 'Other notes aren\'t from me. Trash them.',
    text: d => 'This is the only note I will ever leave you. If you find another one, <b>it isn\'t from me</b>. Throw it away.' +
      (d >= 3 ? ' Same with texts: I only ever text as <b>Robin</b>.' : ''),
    changed: d => d === 3,

    setup(st, d) {
      st.note = NOTES[d] || null;
      st.state = 'none';
      if (st.note) st.at = hr(st.note.at || 12 + Math.random() * 7);
    },

    update(st, m) {
      if (!st.note) return;
      G.once('note', m >= st.at, () => {
        HS.Map.byId.note.visible = true;
        st.state = 'present';
        if (st.note.opens) G.basementOpen = true;
        HS.Audio.play('slide');
        G.text('H', 'Something slid under the front door.');
      });
    },

    prompt(o, st) {
      if (o.id === 'note') return 'Read the note';
      if ((o.id === 'trash' || o.id === 'bin') && G.holding === 'note') return 'Throw away the note';
      return null;
    },

    interact(o, st) {
      if (o.id === 'note') {
        HS.Audio.play('slide');
        G.say(`<div class="fake-note">${st.note.text}</div><p>The handwriting doesn't look like the fridge note. At all.</p>`, [
          { label: 'Take it', action: () => {
            if (G.holding) return G.say('<p>Your hands are full.</p>');
            o.visible = false;
            st.state = 'held';
            G.holding = 'note';
            HS.Audio.play('pickup');
          } },
          { label: 'Leave it', action: () => {} },
        ], 'fake');
        return true;
      }
      if ((o.id === 'trash' || o.id === 'bin') && G.holding === 'note') {
        G.holding = null;
        st.state = 'trashed';
        RB.set('notes', 'done');
        G.good('<p>You crumple the note and throw it away.</p><p>Far below you, something groans in disappointment.</p>');
        return true;
      }
      return false;
    },

    finalize(st) { return st.note ? 'missed' : 'quiet'; },
  });
})();
