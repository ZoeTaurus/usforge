// Default object behavior when no rule or story page claims the interaction.
(function () {
  const G = HS.Game;
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  HS.Objects = {
    prompt(o) {
      const P = HS.Player;
      if (P.sitting === o) {
        if (o.id === 'bed') return G.sleeping ? 'Move to wake up' : 'Sleep (or move to get up)';
        return 'Move to get up';
      }
      switch (o.id) {
        case 'fridge': return 'Read the fridge note';
        case 'couch': return 'Sit on the couch';
        case 'bed': return 'Sleep';
        case 'towel': return G.holding === 'towel' ? 'Put the towel back' : 'Take a towel';
        case 'basement': return 'Basement door';
        default: return `Look at the ${o.label.toLowerCase()}`;
      }
    },

    interact(o) {
      const P = HS.Player, h = HS.Clock.hour();
      const night = h >= 23 || h < 6;
      if (o.id === 'wardrobe' && night && !G.fired['wardrobe-scare']) {
        return G.say('<p>The wardrobe door is open a crack. It wasn\'t before.</p><p>Something inside is breathing. Slowly. In time with you.</p>', [
          { label: 'Open it', action: () => {
            G.fired['wardrobe-scare'] = true;
            HS.Scare.jump(() => {
              G.chaos = Math.min(HS.CHAOS_MAX, G.chaos + 10);
              G.say('<p>The wardrobe is empty.</p><p>Robin\'s shirts are swaying on their hangers. All of them. Toward you.</p>', null, 'bad');
            });
          } },
          { label: 'Leave it closed', action: () => G.say('<p>You lean on the door until it clicks shut. The breathing stops.</p><p>Then, from inside, a small, disappointed sigh.</p>') },
        ], 'bad');
      }
      if (o.id === 'mirror' && h >= 27 && G.day >= 5 && !G.fired['mirror-scare']) {
        G.fired['mirror-scare'] = true;
        return G.say('<p>The mirror is completely black. No reflection. No you.</p><p>You lean closer.</p>', [
          { label: 'Closer', action: () => HS.Scare.jump(() => G.say('<p>It was standing right behind the glass. Waiting for you to lean in.</p><p>The mirror shows your reflection again now. It\'s smiling. You aren\'t.</p>', null, 'bad')) },
          { label: 'Back away', action: () => G.say('<p>You back away. In the black glass, two pale eyes open, watch you go, and close.</p>') },
        ], 'bad');
      }
      if (o.flavor) return G.say(`<p>${pick(o.flavor)}</p>`);

      switch (o.id) {
        case 'fridge': return G.readNote();

        case 'couch':
          if (P.sitting !== o) P.sit(o);
          return;

        case 'bed':
          if (h < 22) return G.say('<p>It\'s too early to sleep. The bed seems to agree; the blanket is tucked in very firmly.</p>');
          if (P.sitting !== o) P.sit(o);
          G.sleeping = true;
          HS.UI.setSleep(true);
          return;

        case 'towel':
          if (G.holding === 'towel') { G.holding = null; return G.say('<p>You hang the towel back up. It sighs contentedly.</p>'); }
          if (G.holding) return G.say('<p>Your hands are full.</p>');
          G.holding = 'towel';
          HS.Audio.play('pickup');
          return G.say('<p>You take a fluffy towel. It smells like lavender and, faintly, like oil paint.</p>');

        case 'trash':
          if (G.holding === 'towel') return G.say('<p>You\'re not throwing away a perfectly good towel.</p>');
          return G.say('<p>The kitchen trash. It looks hungry.</p>');

        case 'bin':
          return G.say('<p>A big trash bin. It smells like pine trees, which is somehow worse than if it smelled bad.</p>');

        case 'bowl':
          return G.say('<p>An empty cat bowl. You hear a faint purr.</p>');

        case 'fern':
          return G.say('<p>The fern rustles. There\'s no breeze.</p>');

        case 'tv':
          return G.say('<p>It\'s off. The black screen reflects you. Your reflection is a little bit late.</p>');

        case 'phone':
          return G.say('<p>A heavy old phone. The cord goes into the wall, and then, you feel, keeps going.</p>');

        case 'tub':
          return G.say('<p>The tub is full of rubber ducks. They are all facing you.</p>');

        case 'washer':
          return G.say('<p>It\'s been running since you got here. It\'s empty.</p>');

        case 'painting':
          if (HS.Uncanny.emptyT > 0) {
            return G.say('<p>The painting is just an empty armchair in a green room.</p><p>You blink. She\'s back. She looks a little out of breath.</p>');
          }
          return G.say(`<p>${this.paintingHint()}</p>`, [
            { label: 'Wave', action: () => G.say(G.day >= 4
              ? '<p>She waves back. You stop waving.</p><p>She doesn\'t.</p>'
              : '<p>She waves back. Painted hands aren\'t supposed to move, but it\'s a very nice wave.</p>') },
            { label: 'Back away', action: () => {} },
          ]);

        case 'mirror':
          return HS.MirrorView.open();

        case 'photo': {
          const d = G.day, n = Math.min(4, d - 1);
          if (d === 1) return G.say('<p>A family photo: Grandma June, a little Robin, and three people you don\'t recognize.</p><p>Everyone is smiling. Especially the people you don\'t recognize.</p>');
          const scratched = n === 1
            ? '<p>A family photo. <b>One</b> of the faces has been scratched out. It wasn\'t yesterday.</p>'
            : `<p>A family photo. <b>${n}</b> of the faces have been scratched out. Yesterday it was ${n - 1}.</p>`;
          return G.say(scratched + (d >= 6 ? '<p>One of the people still left in the photo looks a lot like you.</p>' : ''));
        }

        case 'desk': {
          const lines = ['A NEW ONE ARRIVED TODAY. SEEMS NICE.', 'THE NEW ONE IS STILL HERE. GOOD.', 'THE NEW ONE SLEEPS ON THEIR LEFT SIDE.',
            'WE LIKE THE NEW ONE.', 'THE NEW ONE COUNTS THE DUCKS VERY CAREFULLY.', 'ONE MORE DAY. THEN WE DECIDE.', 'WE HAVE DECIDED.'];
          const brokeToday = Object.values(HS.Rulebook.status).includes('broken');
          const line = G.chaos >= 60 ? 'THE NEW ONE IS MAKING US VERY UNHAPPY.' : brokeToday ? 'THE NEW ONE BROKE A RULE TODAY. WE WROTE IT DOWN.' : lines[G.day - 1];
          HS.Audio.play('click');
          return G.say(`<p>An old typewriter. There's a sheet of paper in it. It has typed one new line since yesterday:</p><p class="typed">${line}</p><p>Nobody has been in this room.</p>`);
        }

        case 'musicbox':
          HS.Render.musicT = HS.Render.t;
          HS.Audio.play('musicbox');
          return G.say('<p>You open the music box. A tiny dancer spins to the fridge\'s song.</p><p>When the song ends, the dancer keeps spinning. It\'s facing you every time it comes around.</p>');

        case 'horse':
          HS.Render.horseT = HS.Render.t;
          return G.say(h >= 22
            ? '<p>It\'s rocking by itself. You put a hand on it to stop it.</p><p>It keeps rocking, gently, under your hand.</p>'
            : '<p>A wooden rocking horse. You give it a little push.</p><p>It rocks for much, much longer than it should.</p>');

        case 'window':
          if (HS.Clock.darkness() > 0.4) {
            return G.say(G.day >= 3
              ? '<p>Outside, the garden is dark. Something on the lawn is standing very still, facing the house.</p><p>You blink. It\'s a little closer.</p>'
              : '<p>The garden at night. Very dark. Very still. Your reflection in the glass is a moment late.</p>');
          }
          return G.say('<p>A sunny garden. There\'s a garden gnome on the lawn, facing the house.</p><p>You\'re pretty sure it was facing the other way this morning.</p>');

        case 'telescope':
          return G.say('<p>You look through the telescope. It\'s pointed back at the house, at the upstairs window.</p><p>Someone in the window is looking back at you through a telescope of their own.</p><p>This house doesn\'t have an upstairs.</p>');

        case 'clock':
          return G.say(`<p>The grandfather clock says it\'s <b>${HS.Clock.format()}</b>.</p><p>${h >= 23 ? 'It says you should be in bed.' : 'It says it in a judgmental tone.'}</p>`);

        case 'frontdoor':
          return G.say('<p>Locked. From the <i>outside</i>. Robin must have done that by accident. Probably.</p>');

        case 'chair5':
          return;

        case 'basement':
          return this.basement();
      }
    },

    basement() {
      if (G.heartOpen) {
        return G.say('<p>Warm, golden light seeps from under the basement door. From below comes a sound like someone very old, crying very quietly.</p><p>You know what it needs.</p>', [
          { label: 'Go down and sit with it', action: () => G.finish('true') },
          { label: 'Not yet', action: () => {} },
        ], 'page');
      }
      if (G.basementOpen) {
        return G.say('<p>The basement door is open a crack. Warm air breathes out of it. In… and out.</p>', [
          { label: 'Go downstairs', action: () => G.finish('basement') },
          { label: 'Absolutely not', action: () => G.say('<p>Good call. The door closes a little, disappointed.</p>') },
        ], 'bad');
      }
      return G.say(`<p>${pick([
        'Locked. From somewhere below, faintly, someone is humming the fridge\'s song.',
        'Locked. The handle is warm, like someone was just holding it from the other side.',
        'Locked. You press your ear to it. Something on the other side presses back.',
      ])}</p>`);
    },

    paintingHint() {
      const RB = HS.Rulebook;
      if (!G.noteRead) return 'The painting\'s eyes slide toward the kitchen. Toward the fridge.';
      if (RB.get('chair').state === 'present') return 'The painting\'s eyes slide toward the dining table. Count the chairs.';
      if (RB.get('tv').state === 'on') return 'The painting keeps glancing toward the living room. Something is on.';
      if (RB.get('fridge').state === 'humming') return 'The painting is humming along with the fridge. Badly.';
      if (RB.get('phone').state === 'ringing') return 'The painting nods toward the hallway. The phone!';
      if (HS.Map.byId.note.visible || G.holding === 'note') return 'The painting looks at the note. Then at you. Then slowly shakes its head.';
      if (G.pages.length < G.day && HS.Story.pageAt('shelf') >= 0) return 'The painting\'s eyes flick toward the bookshelf.';
      if (G.chaos < 40) return pick([
        'The old woman in the painting smiles at you warmly. She looks so proud of you.',
        'You smile at the painting. She smiles back. She keeps smiling a little longer than you do.',
        'Her eyes are kind. They are also, definitely, following you.',
        'A tiny brass plaque on the frame says <b>HOME</b>. Someone scratched a second word underneath. It\'s too small to read.',
        'The painting smells like cinnamon cookies. You check. The paint is still wet.',
      ]);
      if (G.chaos < 80) return 'She\'s still smiling. Her eyebrows aren\'t. She looks worried. For you.';
      return 'Her mouth is open in a silent scream. Her eyes are still following you.';
    },
  };
})();
