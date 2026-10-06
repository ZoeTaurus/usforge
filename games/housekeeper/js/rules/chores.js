// Chores. The mail comes every day; the rest are picked from a pool each day (same picks for the
// same save, so a resumed day has the same chores).
(function () {
  const G = HS.Game, RB = HS.Rulebook, hr = HS.hr;

  const MAIL = {
    1: 'a pizza coupon, a bill, and a postcard addressed to <b>you</b>. At this address. It\'s postmarked next week.',
    2: 'a furniture catalog. Every chair in it is circled in red.',
    3: 'a letter addressed to "Housesitter #4". The paper inside is blank, but warm.',
    4: 'an electric bill. At the bottom: "Thank you for keeping the lights on. They get scared."',
    5: 'a postcard from Robin\'s vacation. The photo is of this house. Taken from inside.',
    6: 'a birthday card for the house, signed by three names you don\'t recognize.',
    7: 'a tiny envelope in shaky handwriting: "To the one who stays." It\'s empty. You feel like it won\'t be, soon.',
  };

  // Seeded shuffle so the same save always gets the same chores on the same day.
  function seeded(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  HS.Chores = {
    POOL: ['trash', 'dishes', 'sweep', 'fold', 'plants', 'photos', 'bed', 'books', 'toys'],
    today(d) {
      const rnd = seeded((G.seed || 1) * 31 + d * 977);
      const pool = this.POOL.slice();
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      return pool.slice(0, 2);
    },
  };

  RB.define({
    id: 'mail',
    chore: true,
    from: 1,
    short: () => 'Bring in the mail (after 10 AM)',

    update(st, m) {
      G.once('mail', m >= hr(10), () => {
        HS.Map.byId.mail.visible = true;
        HS.Audio.play('clank');
        G.text('H', '📬 The mail slot clanks.');
      });
    },

    prompt(o) { return o.id === 'mail' ? 'Grab the mail' : null; },

    interact(o, st, d) {
      if (o.id !== 'mail') return false;
      o.visible = false;
      RB.set('mail', 'done');
      G.good(`<p>You grab the mail: ${MAIL[d]}</p>`);
      return true;
    },
  });

  RB.define({
    id: 'trash',
    chore: true,
    pool: true,
    short: () => 'Kitchen trash → laundry room bin',

    setup(st) { st.state = 'none'; },

    prompt(o, st) {
      if (o.id === 'trash' && st.state === 'none' && !G.holding) return 'Take out the trash';
      if (o.id === 'bin' && G.holding === 'bag') return 'Throw the bag in';
      return null;
    },

    interact(o, st) {
      if (o.id === 'trash' && st.state === 'none' && !G.holding) {
        st.state = 'held';
        G.holding = 'bag';
        HS.Audio.play('pickup');
        G.say('<p>You tie up the trash bag. Something inside it shifts. Probably just settling.</p><p>Take it to the <b>big bin in the laundry room</b>.</p>');
        return true;
      }
      if (o.id === 'bin' && G.holding === 'bag') {
        G.holding = null;
        st.state = 'done';
        RB.set('trash', 'done');
        G.good('<p>You toss the bag in. The bin burps. Politely.</p>');
        return true;
      }
      return false;
    },
  });

  // Chores where you visit a few things. `steps` are said as you go; `done` at the end.
  function multi({ id, short, targets, prompt, steps, done, setup }) {
    RB.define({
      id,
      chore: true,
      pool: true,
      short: () => short,
      progress: targets.length > 1 ? st => `${targets.length - st.left.length}/${targets.length}` : null,

      setup(st, d) {
        st.left = targets.slice();
        if (setup) setup(st, d);
      },

      prompt(o, st) { return st.left.includes(o.id) ? (typeof prompt === 'function' ? prompt() : prompt) : null; },

      interact(o, st) {
        if (!st.left.includes(o.id)) return false;
        st.left = st.left.filter(x => x !== o.id);
        if (o.kind === 'dust') o.visible = false;
        if (!st.left.length) {
          RB.set(id, 'done');
          G.good(`<p>${done}</p>`);
        } else {
          HS.Audio.play('pickup');
          G.say(`<p>${steps[(targets.length - st.left.length - 1) % steps.length]}</p>`);
        }
        HS.UI.renderRules();
        return true;
      },
    });
  }

  multi({
    id: 'dishes', short: 'Wash the dishes (kitchen sink)', targets: ['sink'], prompt: 'Wash the dishes', steps: [],
    done: 'You wash the dishes. One plate has your face painted on it. You wash that one extra carefully.',
  });

  multi({
    id: 'sweep', short: 'Sweep the dust in the back hallway', targets: ['dust1', 'dust2', 'dust3'], prompt: 'Sweep it up',
    setup: () => ['dust1', 'dust2', 'dust3'].forEach(id => { HS.Map.byId[id].visible = true; }),
    steps: ['You sweep up the dust. Underneath, the floorboards are scratched: <i>HI</i>.', 'More dust. It\'s shaped a little like footprints. Small ones. Going toward the nursery.'],
    done: 'All swept. When you look back down the hallway, there\'s one more little pile of dust. You decide it was always there.',
  });

  multi({
    id: 'fold', short: 'Fold the laundry (dryer)', targets: ['dryer'], prompt: 'Fold the laundry', steps: [],
    done: 'You fold the warm laundry. There\'s a shirt you don\'t recognize. It fits you perfectly.',
  });

  multi({
    id: 'plants', short: 'Water the sunroom plants', targets: ['plant1', 'plant2', 'plant3'], prompt: 'Water the plant',
    steps: ['You water the plant. It drinks the whole glass in one gulp.', 'Watered. The leaves turn slowly to follow you as you leave.'],
    done: 'All the sunroom plants are watered. They rustle in a way that sounds a lot like "thank you."',
  });

  multi({
    id: 'photos', short: 'Dust the family photos (back hallway)', targets: ['photo1', 'photo2', 'photo3', 'photo4'], prompt: 'Dust the photo',
    steps: ['You dust the photo. Everyone in it is smiling. Even the scratched-out ones, somehow.', 'Dusted. You could swear the people in this one were standing closer together yesterday.', 'Dusted. Someone in the back row is out of focus. Like they moved.'],
    done: 'All the family photos are dusted. The frames feel warm, like somebody was just holding them.',
  });

  multi({
    id: 'bed', short: 'Make the bed (before noon)', targets: ['bed'], prompt: () => (HS.Clock.hour() < 12 ? 'Make the bed' : null), steps: [],
    done: 'You make the bed, nice and tight. When you turn around, there\'s a dent in the pillow again. Head-shaped.',
  });

  multi({
    id: 'books', short: 'Tidy the bookshelves (dining + study)', targets: ['shelf', 'shelf2', 'shelf3'], prompt: 'Tidy the books',
    steps: ['You straighten the books. One of them is warm, like someone was just reading it.', 'Tidied. A bookmark falls out. It\'s a photo of you, asleep.'],
    done: 'All the shelves are tidy. Somewhere behind you, one book quietly slides back out.',
  });

  multi({
    id: 'toys', short: 'Tidy the nursery', targets: ['blocks', 'crib', 'horse'], prompt: 'Tidy up',
    steps: ['You stack the blocks. When you look back, the top one says <b>STAY</b>.', 'You smooth the crib blanket. It\'s warm in the middle.'],
    done: 'The nursery is tidy. From the crib, a tiny, contented sigh.',
  });

  // The bed chore only counts before noon: after that it can't be done.
  RB.defs.bed.prompt = (o, st) => (st.left.includes(o.id) && HS.Clock.hour() < 12 ? 'Make the bed' : null);
  const bedInteract = RB.defs.bed.interact;
  RB.defs.bed.interact = (o, st) => (HS.Clock.hour() < 12 ? bedInteract(o, st) : false);
})();
