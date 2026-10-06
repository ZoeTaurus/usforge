// Stay in the bedroom from 11 PM until 6 AM, and never open the door for a night-time knock.
(function () {
  const G = HS.Game, RB = HS.Rulebook, hr = HS.hr;

  const KNOCKS = {
    1: {
      ask: '<p>"Hey! It\'s me, Robin! My flight got cancelled. Can you let me in? It\'s cold out here."</p><p>It sounds exactly like Robin. Almost.</p>',
      open: '<p>You open the door.</p><p>It\'s <b>you</b>. Wearing your hoodie. "Thanks," it says, and walks past you into the kitchen.</p><p>You blink, and it\'s gone. Your toothbrush is wet.</p>',
      quiet: '<p>You hold your breath.</p><p>After a long time, the knocking stops. Footsteps walk away down the hall.</p><p>They sound like your shoes.</p>',
    },
    3: {
      ask: '<p>"Pizza delivery! Forty large pizzas, extra cheese, for… this house."</p><p>You did not order pizza. It is 2 AM.</p>',
      open: '<p>You open the door. There is no pizza. There is no one.</p><p>But the doormat says <b>WELCOME BACK</b> now, and something cold walks in past your ankles.</p>',
      quiet: '<p>"…Fine," says the pizza voice, in a much deeper voice.</p><p>Footsteps walk away. They do not smell like pizza.</p>',
    },
    4: {
      ask: '<p>"Hiii! I\'m Robin\'s cousin! Robin said you\'d let me in?"</p>',
      open: '<p>Robin doesn\'t have a cousin. You remember this as the door swings open.</p><p>The porch is empty. The coat rack has one more coat on it now. It\'s damp.</p>',
      quiet: '<p>"Robin doesn\'t have a cousin," you whisper to yourself.</p><p>The knocking stops. It sounds offended.</p>',
    },
    5: {
      ask: '<p>"Hey. It\'s me. <b>You.</b> I locked myself out. Come on, let me in."</p><p>It really does sound like you. That\'s the worst part.</p>',
      open: '<p>You open the door. You are standing there. You smile at yourself.</p><p>"Thanks," you say to you. Then there\'s only one of you again. You\'re pretty sure it\'s the right one.</p>',
      quiet: '<p>"Fine," says your voice. "I\'ll wait."</p><p>You don\'t sleep well.</p>',
    },
    6: {
      ask: '<p>"Evening! It\'s Pat, from next door. Could I borrow a cup of sugar? And maybe your face, just for the weekend?"</p>',
      open: '<p>Pat is very tall and very polite and does not have a face yet.</p><p>"Thank you," Pat says, and takes the sugar. You check the mirror. Your face is still there. Mostly.</p>',
      quiet: '<p>"No worries!" says Pat. "I\'ll ask again tomorrow."</p>',
    },
  };

  RB.define({
    id: 'night',
    from: 1,
    short: () => 'Bedroom from 11 PM to 6 AM. Never open for knocks.',
    text: () => 'From <b>11 PM until 6 AM</b>, stay in the bedroom. All night. Don\'t leave it, not even for a minute. If someone knocks, <b>do NOT open the door</b>. Not for anyone.',

    setup(st, d) {
      st.broken = false;
      st.knock = KNOCKS[d] || null;
      st.quiet = false;
      st.opened = false;
      st.atBedroom = false;
    },

    update(st, m) {
      G.once('bed-nag', m >= hr(22.5), () => G.text('R', 'almost 11! bedroom time, and stay there till 6am. my bed is comfy, use it 🛏️'));
      if (m >= hr(23) + 10 && !st.broken && !G.inRoom('bedroom')) {
        st.broken = true;
        G.breakRule('night', '<p>It\'s the middle of the night and you\'re not in the bedroom. (The rule is <b>11 PM to 6 AM</b>, all night.)</p><p>The lights flicker. Down the hall, something hums. You should really get to bed.</p>',
          20, () => G.addEffect('flicker', 120));
      }
      if (st.knock) this.knockSequence(st, m);
    },

    // A slow build: faint knocks → pounding + the handle turning → the voice → (if you stay quiet)
    // it comes to the bedroom door → one last knock, from inside the wardrobe.
    knockSequence(st, m) {
      const start = hr(26);
      G.once('knock-1', m >= start, () => {
        HS.Audio.play('knockSoft');
        HS.Audio.silence(120);
        G.addEffect('knocking', 40);
        G.addEffect('flicker', 40);
        G.text('H', '…knock… knock…');
      });
      G.once('knock-2', m >= start + 8, () => {
        HS.Audio.play('knock');
        HS.Audio.play('rattle');
        G.shake(0.6);
        G.say('<p><b>KNOCK. KNOCK. KNOCK.</b></p><p>Someone is at the front door. It\'s 2 AM.</p><p>The handle turns. Slowly. All the way. Then back.</p>', null, 'bad');
      });
      G.once('knock-3', m >= start + 16, () => this.knock(st));
      if (!st.quiet) return;
      G.once('knock-4', m >= st.quietAt + 15, () => {
        st.atBedroom = true;
        HS.Audio.play('knockClose');
        G.shake(0.4);
        G.say('<p>Silence. You start to breathe again.</p><p>Then: <b>tap. tap. tap.</b></p><p>Not the front door. The <b>bedroom</b> door. Right behind you.</p><p>"I know you\'re in there," it whispers, in a voice that is almost yours.</p>', [
          { label: 'Open it', action: () => { st.atBedroom = false; this.open(st); } },
          { label: 'Hide under the blanket', action: () => {
            st.atBedroom = false;
            G.good('<p>You pull the blanket over your head and hold perfectly still.</p><p>Something stands at the door for a long, long time. Then the floor creaks, slowly, all the way down the hall.</p>');
          } },
        ], 'bad');
      });
      G.once('knock-5', m >= st.quietAt + 40 && !st.opened, () => {
        HS.Audio.play('knockSoft');
        G.say('<p>You\'re almost asleep when you hear it one more time.</p><p><b>knock. knock.</b></p><p>From inside the wardrobe.</p><p>You decide you didn\'t hear that.</p>');
      });
    },

    knock(st) {
      HS.Audio.play('knock');
      HS.Audio.play('rattle');
      G.shake(0.4);
      G.say(`<p>The pounding stops. A voice, right up against the door:</p>${st.knock.ask}`, [
        { label: 'Open the door', action: () => this.open(st) },
        { label: 'Stay quiet', action: () => {
          st.quiet = true;
          st.quietAt = HS.Clock.minutes;
          G.say(st.knock.quiet);
        } },
      ], 'bad');
    },

    open(st) {
      st.opened = true;
      G.otherYou = true;
      G.breakRule('night', st.knock.open, 40);
    },

    finalize() { return 'done'; },
  });
})();
