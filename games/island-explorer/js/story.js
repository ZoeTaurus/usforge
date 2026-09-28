'use strict';
// All the writing lives here.
const STORY = {
  islands: {
    1: ['Driftwood Isle', 'Where the storm left you'],
    2: ['Verdant Isle', 'A tangle of jungle and old stone'],
    3: ['The Great Isle', 'Civilization lies somewhere east'],
    4: ['Gull Rock', 'Seabirds, stone and rusty ore'],
    5: ['Crab Key', 'Something is buried here...'],
    6: ['Mossfen', 'A sweltering swamp. Watch the water.'],
    7: ['Frostpeak', 'Bitter cold. Stay near fire.'],
    8: ['Ember Isle', 'The ground is hot underfoot'],
    9: ['Palm Atoll', 'A quiet lagoon... and a trader?'],
  },

  intro: [
    'Ugh... my head. The storm... the ship broke apart.',
    'There\'s nobody here. I have to get off this island somehow.',
    'Maybe I can make something out of what\'s lying around. (C opens crafting, J opens your journal.)',
  ],

  wreck: [
    'The shattered hull of your ship. Nothing useful is left in it...',
    '...except the captain\'s chart: "Port Haven, on the Great Isle, far to the EAST."',
  ],

  signs: {
    start: [
      '"To whoever washes up here: the jungle isle lies to the NORTHEAST.',
      'An old shipwright lives there. He helped me once. Good luck. -M."',
    ],
    hut: ["\"TOBIAS'S HUT. Shipwright (retired). Visitors welcome. Mostly.\""],
    ruins: ['"...the temple of the tide-keepers. Their treasures sleep under lock and key..."'],
    pond: ['"Fresh water! Also: do NOT feed the snakes. -T."'],
    beach3: [
      '"TRAVELER! Follow the old road east over the river and through Aurum Pass.',
      'Port Haven awaits beyond the mountains."',
    ],
    bridge: ['"BRIDGE OUT. The spring floods took it. Eight sturdy logs should patch it up."'],
    pass: ['"AURUM PASS. The only way through the mountains."'],
    town: ['"PORT HAVEN. Welcome, travelers! Mind the chickens."'],
    ember: ['"TURN BACK. MAGMAW SLEEPS IN THE CRATER. Once you cross the lava, the way closes behind you."', '(Scratched below: "it jumps where the ground glows red. ROLL! -G.")'],
    frost: ['"Old Frostfang hunts this ridge. He circles, then pounces on you. Keep moving."'],
    bog: ['"The Bog King hides in the mud and bursts up beneath you. Strike when he\'s exposed."'],
    lake: ['"Mirror Lake. On a still day you can see the idol\'s glint from here... somewhere north."'],
  },

  bottles: [
    ['A message in a bottle!', '"Fish jump where the water sparkles. Catch them from your boat with [E], then cook them at a campfire. -a hungry sailor"'],
    ['A message in a bottle!', '"The tide-keepers hid SIX golden idols: in a grove at the HEART of Driftwood Isle, deep in Verdant Isle\'s WESTERN jungle, in a ring of stones NORTH of Aurum Pass... and in the swamp, the snow and the fire."'],
    ['A message in a bottle!', '"If you find a ginger cat named BISCUIT, please bring her home to Port Haven!! -Pip (age 9)"'],
    ['A message in a bottle!', '"At night the wolves come out. Craft a torch, or rest by a fire until morning."'],
    ['A message in a bottle!', '"Day 40 on the jungle isle. Old Tobias talks to his hat. I think the hat is winning. -M."'],
    ['A message in a bottle!', '"You can\'t break rock with your bare hands, you fool. Make a pickaxe. -your pal Gus"'],
    ['A message in a bottle!', '"Iron ore glints on Gull Rock, far to the NORTHWEST. An iron axe cuts through trees like butter."'],
    ['A message in a bottle!', '"My ship went down off Crab Key, the little sandbar SOUTH of the jungle isle. I buried what I could save: my spyglass, my rudder. Bring a shovel. -Capt. Rhee"'],
    ['A message in a bottle!', '"Sharks follow rafts. If they bite, swing back at them. They hate that."'],
    ['A message in a bottle!', '"Salty Pete trades on the Palm Atoll, SOUTH of the Great Isle\'s reef. He loves gold. Crates wash up everywhere, and some have coins inside."'],
  ],

  relic: n => [`A golden idol of the tide-keepers! (${n}/6)`, n === 6 ? 'That\'s all six! The people of Port Haven will want to see these.' : 'It hums faintly. There should be more of these somewhere...'],

  hermitFirst: [
    'Well now! A castaway on a raft? I haven\'t seen a new face in twenty years.',
    'Name\'s Tobias. I used to build ships for the fleet at Port Haven, on the Great Isle to the east.',
    'But a reef surrounds the Great Isle and the water there boils like soup. No raft survives it.',
    'I could build you a real ship... if I had the parts. And the parts are scattered across every island out there.',
    'Seven of them. I\'ll tell you what I know, but my memory\'s like a sieve. Write it down! (Press J for your journal.)',
  ],
  hermitBuild: [
    'That\'s the last of it! Stand back, let an old man work...',
    '*saw* *hammer* *hammer* *grumble* *hammer* *hammer*',
    'There she is. Sailcloth, mast, rudder, fittings, sealed with pitch... and a chart to thread the reef.',
    'She\'ll carry you through the rough water. Look for the WEST beach of the Great Isle. The rest is cliffs.',
    'Tell them in Port Haven that old Tobias says hello.',
  ],
  hermitGot: name => [name.startsWith('Tobias') ? 'My toolbox! I thought I\'d never see you again, old friend.' : `Ah, the ${name}! Leave it with me.`],
  hermitNeed: n => [`That leaves ${n} more part${n > 1 ? 's' : ''}. Check your journal [J] if you've forgotten where to look.`],

  // The seven ship parts: each lives on a different island.
  parts: {
    sailcloth: { name: 'Sailcloth', icon: 'sailcloth', island: 2, hint: 'The tide-keepers\' ruins, NORTH of Tobias\'s hut, once held fine cloth. Their chests were locked.' },
    toolbox:   { name: 'Tobias\'s Toolbox', icon: 'toolbox', island: 4, hint: 'Lost on Gull Rock, far to the NORTHWEST, when a storm wrecked Tobias\'s dinghy. Boulders fell over it.' },
    rudder:    { name: 'Rudder', icon: 'rudder', island: 5, hint: 'Captain Rhee\'s ship sank off Crab Key, a sandbar SOUTH of the jungle isle. He buried what washed ashore.' },
    pitch:     { name: 'Swamp Pitch', icon: 'pitch', island: 6, hint: 'The swamp far to the SOUTH is thick with pitch, and with whatever lurks in its deepest pool.' },
    mast:      { name: 'Frostpine Mast', icon: 'mast', island: 7, hint: 'Only an Ancient Frostpine on the snowy isle, far NORTHEAST, grows tall enough. Its wood is hard as iron.' },
    fittings:  { name: 'Iron Fittings', icon: 'fittings', island: 8, hint: 'The old forge in the crater of the fire isle, far SOUTHEAST. Something enormous sleeps on it.' },
    chart:     { name: 'Reef Chart', icon: 'chart', island: 9, hint: 'A trader named Salty Pete sails the atoll SOUTH of the Great Isle\'s reef. He sells charts for gold.' },
  },
  partGot: name => [`You found the ${name.toUpperCase()}!`, 'Tobias will want this for the ship.'],
  toolboxChest: ['A battered wooden box, pinned under the rocks. Carved on the lid: "PROPERTY OF TOBIAS. HANDS OFF."', 'You found TOBIAS\'S TOOLBOX!'],
  bigPine: ['The Ancient Frostpine crashes down, shaking snow from every tree around.', 'Its trunk is straight and true. You found the FROSTPINE MAST!'],
  bigPineHard: 'This ancient trunk is hard as iron. You\'d need an iron axe.',

  hermitAfter: [
    ['East, traveler! Look for the sandy beach on the west side of the Great Isle.'],
    ['My hat says you should hurry. I agree with my hat.'],
    ['If you see a message in a bottle, grab it! Sailors love to write.'],
  ],

  skeleton: [
    'A skeleton lies half-buried in the sand, still holding a journal.',
    '"...found the key to the ruins chest at last. Too tired to walk back. The sun is warm... -M."',
    'You take the small BRASS KEY.',
  ],
  skeletonAfter: ['Rest easy, M. Tobias will want to know what happened to you.'],

  chestLocked: ['An ancient chest with a fish-shaped lock. It won\'t budge.'],
  chestOpen: ['The brass key turns with a satisfying CLUNK.', 'Inside you find a bolt of fine SAILCLOTH!'],

  door: [['You knock. Nobody answers. They\'re probably down at the fountain square.'], ['"Go away, I\'m napping!"'], ['You hear a cat purring behind the door. Or maybe a very small bear.']],
  fountain: ['Coins glint at the bottom of the fountain.'],

  catFound: [
    'A ginger cat with a little bell on her collar. The tag says: BISCUIT, PORT HAVEN.',
    'Meow! She rubs against your legs and decides you\'re her new best friend.',
    '(Biscuit will follow you. Take her home to Port Haven!)',
  ],
  catReturn: [
    'BISCUIT!!! You found her! Where WAS she?!',
    'Thank you thank you THANK YOU! Here, take my lucky charm. It\'s the luckiest thing I own!',
    '(Your max health went up by 25!)',
  ],

  guard: [
    'Halt! ...wait. You came through Aurum Pass? On foot?',
    'You look like the sea chewed you up and spat you out.',
    'Welcome to Port Haven, friend. Go and see the Mayor by the fountain.',
  ],
  mayor: [
    'By the tides! You\'re the survivor from the storm? We\'d given up all hope!',
    'Across all nine islands, the reef, and the pass... on your own?',
    'Welcome to Port Haven. You\'re safe now. There will be a warm meal and a soft bed tonight.',
    'And tomorrow, a ship home.',
  ],
  mayorRelics: n => n === 6
    ? ['And... are those the tide-keepers\' golden idols? ALL SIX? You\'ll be a legend in this town!']
    : n > 0 ? [`Is that a golden idol? There are said to be six of them. You found ${n}!`] : [],
  mayorCat: ['And you brought Pip\'s cat home too! You really are something.'],

  villagers: [
    ['Fisher Ana', ['Fresh fish! Well... it was fresh this morning.', 'The fish bite best where the water sparkles.', 'My boat\'s called the Soggy Biscuit. Long story.']],
    ['Baker Joss', ['You look starving. Head to the square, the mayor will sort you out.', 'Bread\'s in the oven. Smell that?', 'I once baked a loaf so big it had its own weather.']],
    ['Old Wen', ['A castaway? My grandfather washed up here too. That\'s how most of us got here!', 'In my day we swam to the jungle isle. Uphill. Both ways.', 'They say the tide-keepers hid golden idols out on the islands.']],
    ['Pip', ['Have you seen my cat? She\'s ginger and her name is BISCUIT. She ran off into the western forest!', 'Biscuit likes chasing butterflies...', 'Did you really cross the reef? Whoa!']],
    ['Marta', ['Ships leave for the mainland every full moon. Lucky you, that\'s soon.', 'Mind the lamps at night, they\'re hot.', 'The mayor gives the best speeches. Long, but good.']],
  ],

  trader: {
    hello: ['Ahoy! Salty Pete\'s the name, tradin\'s the game. I take GOLD. Talk to me again to see my next deal.'],
    chartOffer: g => [`A chart through the Great Isle\'s reef? Aye, I\'ve got one. 25 gold and it\'s yours. You\'ve got ${g}.`, 'Crates wash up on every beach, matey. Some have coins.'],
    chartSold: ['Pleasure! One REEF CHART. Don\'t go droppin\' it in the sea.'],
    deals: [
      { cost: 12, give: { iron: 3 }, text: '3 iron bars' },
      { cost: 8, give: { bandage: 2 }, text: '2 bandages' },
      { cost: 10, give: { cooked: 3 }, text: '3 cooked meals' },
      { cost: 6, give: { rope: 3 }, text: '3 coils of rope' },
      { cost: 15, give: { hide: 4 }, text: '4 hides' },
    ],
  },
  dig: {
    5: ['You dig... CLUNK! A small chest, and a long wooden blade beside it!', 'Inside: Captain Rhee\'s SPYGLASS. You can see much further now!', 'And the blade is a ship\'s RUDDER! Tobias will want this.'],
    9: ['You dig... CLUNK! A brass box!', 'Inside: a tide-keeper COMPASS. Its needle points toward golden idols you haven\'t found yet.'],
    4: ['You dig... CLUNK! A pirate\'s stash!', 'Inside: 40 gold coins!'],
  },
  bossWin: {
    magmaw: ['Magmaw crumbles into cooling stone...', 'In the rubble you find the MAGMA BLADE and a still-warm EMBER HEART.', '(Magma Blade: 5 damage. Ember Heart: +25 max health.)', 'On the old forge beneath him, still glowing: a set of IRON FITTINGS for a ship!'],
    frostfang: ['Old Frostfang lets out a final howl and lies still.', 'You fashion his thick pelt into the FROSTFANG CLOAK.', '(Take 55% less damage, and the cold can\'t touch you.)'],
    bogking: ['The Bog King sinks beneath the mud for good. His crown bobs to the surface...', 'Tangled with it are the BOG BOOTS.', '(You move 18% faster.)', 'The pool he guarded is thick with black SWAMP PITCH. You scoop up a jar for Tobias.'],
  },
  combatTip: 'Tip: SPACE to swing · Q to dodge-roll (you can\'t be hurt mid-roll) · H bandage · F eat',
  frostCold: 'It\'s freezing! You get hungry faster here. Leather armor and campfires help.',

  hints: {
    noPick: 'You need a pickaxe to break rock. [C] to craft.',
    noShovel: 'The ground is packed hard. You need a shovel. [C]',
    noRaft: 'The sea is too wide to swim. Build a raft first! [C]',
    rough: 'The reef water is too rough for a raft!',
    cliff: 'Cliffs! There is nowhere to land here.',
  },
};
