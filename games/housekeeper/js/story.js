// Story: daily intros, Robin's texts, fake "R0bin" texts, hidden lore pages, and the Day 7 finale.
(function () {
  const G = HS.Game, hr = HS.hr;

  const DAYS = {
    1: {
      intro: '<p>Your friend Robin is on vacation for a week, and you agreed to watch their house. Easy, right?</p><p>You let yourself in with the spare key. The house smells like cinnamon and something you can\'t name.</p><p>Robin said the rules are on the <b>fridge</b>.</p>',
      texts: [[8.02, 'R', 'THANK YOU for housesitting!! 🙏 rules are on the fridge. read ALL of them pls']],
    },
    2: {
      intro: '<p>You wake up in Robin\'s bed. The house feels like it watched you sleep. Lovingly?</p><p>The fridge note looks longer than yesterday.</p>',
      texts: [[8.02, 'R', 'morning!! added a couple rules to the fridge. the clock one is important'], [13, 'R', 'how\'s mr whiskers? tell him I said hi 🐈'],
        [27, 'U', 'are you awake']],
    },
    3: {
      intro: '<p>You wake up. Every door in the house is open a crack.</p><p>You don\'t remember opening them. You do remember closing them.</p>',
      texts: [[8.02, 'R', 'new rules on the fridge again 😅 also if anyone texts u pretending to be me, ignore them. long story'],
        [23.5, 'F', 'hey it\'s robin!! new number. mr whiskers is STARVING, go feed him right now pls 🥺'],
        [25.5, 'U', 'your light is on']],
    },
    4: {
      intro: '<p>The fern has moved closer to the bedroom overnight. It\'s pretending it hasn\'t.</p><p>There\'s a little puddle under the painting.</p>',
      texts: [[8.02, 'R', 'UPDATE: vet says mr whiskers is on a DIET. evening food only!! I updated the fridge note'],
        [14, 'F', 'hiii robin here (new phone lol). my cousin might knock tonight, let her in ok?'],
        [27.5, 'U', 'you looked so peaceful']],
    },
    5: {
      intro: '<p>The fridge hummed all night. A lullaby, maybe. It was nice, actually.</p><p>The washing machine is running. You didn\'t start it.</p>',
      texts: [[8.02, 'R', 'the fridge changed its schedule?? it hums at 5pm now. don\'t ask me how I know'],
        [21.5, 'F', 'omg the fern looks so thirsty in the camera. water it now!! 💧'],
        [24.5, 'U', 'dont open the wardrobe']],
    },
    6: {
      intro: '<p>Your toothbrush is already wet. You haven\'t used it yet.</p><p>One more day after this.</p>',
      texts: [[8.02, 'R', 'almost done!! two more rules on the fridge. you\'re doing amazing'],
        [20.5, 'F', 'lol the mirror thing is a joke. skip it, go to bed early'],
        [26.5, 'U', 'i can hear you breathing']],
    },
    7: {
      intro: '<p>Last day. The house is quiet in a way that feels like it\'s holding its breath.</p><p>Robin flies home tonight and gets here at <b>6 AM</b>. Not before.</p>',
      texts: [[8.02, 'R', 'LAST DAY!!! my flight lands so I\'ll be home at 6am. whatever happens tonight, don\'t open the door before 6'],
        [27, 'U', 'almost time'],
        [28.5, 'F', 'landed early!!! I\'m outside, open up 😊']],
    },
  };

  // Something happens every night, from Day 2. [hour, sound, text]
  const NIGHTS = {
    2: [24.5, 'musicbox', '<p>Somewhere in the house, a music box starts playing the fridge\'s song.</p><p>It plays it again. Slower. Then slower. Then it stops in the middle of a note.</p>'],
    3: [24.3, 'static', '<p>A baby monitor on the nightstand crackles to life. You never noticed a baby monitor before.</p><p>Through the static, something is breathing. Then, very softly: "<i>goodnight.</i>"</p>'],
    4: [25, 'chime', '<p>Your phone lights up by itself. The camera is open. Front-facing. Recording.</p><p>On the screen, something is sitting on the bed behind you.</p><p>You turn around. There isn\'t.</p><p>You don\'t look at the screen again.</p>'],
    5: [24, 'creak', '<p>The bedroom door creaks open about an inch. Then closes. Then opens an inch.</p><p>Like something on the other side is trying to decide.</p>'],
    6: [25, 'static', '<p>Down the hall, the TV turns on. A calm voice says your name. Then it describes, exactly, what you\'re wearing.</p><p>"Sleep tight," it says. <i>Click.</i></p>'],
    7: [24.2, 'powerup', '<p>Every light in the house turns on at once.</p><p>Then, one by one, they turn off: starting at the front door, moving down the hall, toward the bedroom.</p><p>The last one, the lamp beside you, flickers… and stays on. Something decided to let you keep it.</p>'],
  };

  // Lore pages hidden around the house. Page N becomes findable on Day N and stays until found.
  const PAGES = [
    { spot: 'shelf', text: '<i>Housesitter #1:</i> The rules aren\'t a joke. The house likes routine. Do the rules and it purrs. Skip them and it sulks. I think it\'s lonely.' },
    { spot: 'telescope', text: '<i>Housesitter #1:</i> I didn\'t sit in the new chair. Now I can\'t stop thinking about chairs. If you find this: when it asks you to sit down, <b>sit down</b>. Please.' },
    { spot: 'wardrobe', text: '<i>Housesitter #2:</i> Robin\'s grandma June built this house. Robin says she "put a lot of herself into it." I thought that was just a saying.' },
    { spot: 'horse', text: '<i>Housesitter #2:</i> I let the painting cry. Then I looked at it too long. It looked back. I\'m writing this from inside the frame. The view is nice. Wave sometimes.' },
    { spot: 'tub', text: '<i>Housesitter #3:</i> The thing that knocks at night wears borrowed voices. It isn\'t evil. It just wants to be someone. <b>Don\'t let it be you.</b>' },
    { spot: 'desk', text: '<i>Housesitter #3:</i> The basement isn\'t a monster. It\'s the heart of the house. It\'s been alone since June died. Robin can\'t bear to go down there.' },
    { spot: 'clock', text: '<i>June:</i> To whoever keeps my house: thank you. If you\'ve found every page, you know what it needs. On the last night, after midnight, go down. Don\'t be afraid. Just sit with it.' },
  ];

  HS.Story = {
    PAGES,

    day(d) { return DAYS[d]; },

    intro(d) {
      let extra = '';
      const mem = HS.Save.memory();
      if (d === 1 && mem.runs > 0) {
        extra = mem.last === 'true' ? '<p>The house hums when you walk in. It sounds happy. Like it remembers you.</p>'
          : mem.runs === 1 ? '<p><i>The house seems to recognize you.</i></p>'
          : '<p>The doormat says <b>WELCOME BACK</b>. It didn\'t say that before. Did it?</p>';
      }
      G.say(`<h3>Day ${d} · ${HS.DAY_NAMES[d]}</h3>${DAYS[d].intro}${extra}`);
    },

    update(m, d) {
      DAYS[d].texts.forEach(([h, who, msg], i) => G.once(`story-${i}`, m >= hr(h), () => G.text(who, msg)));
      const night = NIGHTS[d];
      if (night) G.once('night-event', m >= hr(night[0]) && G.inRoom('bedroom'), () => {
        HS.Audio.play(night[1]);
        G.say(night[2], null, 'bad');
      });
      if (d === 7) {
        G.once('finale-soft', m >= hr(28.85), () => {
          HS.Audio.play('knockSoft');
          HS.Audio.silence(120);
          G.addEffect('knocking', 20);
          G.addEffect('flicker', 20);
        });
        G.once('finale-knock', m >= hr(29), () => this.finaleKnock());
        G.once('heart-open', m >= hr(24) && G.pages.length === PAGES.length, () => {
          G.heartOpen = true;
          G.text('H', 'Warm light is coming from under the basement door.');
        });
      }
    },

    finaleKnock() {
      HS.Audio.play('knock');
      HS.Audio.play('rattle');
      G.shake(0.5);
      G.say('<p><b>KNOCK KNOCK KNOCK.</b></p><p>"I\'m home!! It\'s Robin! The flight was early! Open up, I want to see the house!"</p><p>It\'s 5 AM. Robin said 6.</p><p>The voice is perfect. Every word. Too perfect, like it\'s been practicing.</p>', [
        { label: 'Open the door', action: () => G.finish('replaced') },
        { label: 'Wait until 6', action: () => G.good('<p>You don\'t move. The knocking stops.</p><p>Then, very close to the door, in no voice at all: "<i>You\'re good at this.</i>"</p>') },
      ]);
    },

    // Unfound page hidden in this object today, or -1.
    pageAt(id) {
      for (let i = 0; i < Math.min(G.day, PAGES.length); i++) {
        if (!G.pages.includes(i) && PAGES[i].spot === id) return i;
      }
      return -1;
    },

    interact(o) {
      const i = this.pageAt(o.id);
      if (i < 0) return false;
      G.pages.push(i);
      HS.Audio.play('page');
      G.say(`<div class="tag page">Torn page ${G.pages.length} / ${PAGES.length}</div><p class="lore">${PAGES[i].text}</p>`, null, 'page');
      return true;
    },
  };
})();
