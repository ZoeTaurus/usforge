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
    'I can see land far to the northeast. Maybe someone out there can help.',
    'I\'ll need a raft. With no tools I\'ll have to punch trees for wood... that will take a while.',
    'Pebbles on the ground could make a stone axe. Vines can be twisted into rope. (Press C to craft.)',
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
    ['A message in a bottle!', '"I buried my spyglass on Crab Key, the little sandbar SOUTH of the jungle isle. Bring a shovel. -Capt. Rhee"'],
    ['A message in a bottle!', '"Sharks follow rafts. If they bite, swing back at them. They hate that."'],
    ['A message in a bottle!', '"Salty Pete trades on the Palm Atoll, SOUTH of the Great Isle\'s reef. He loves gold. Crates wash up everywhere, and some have coins inside."'],
  ],

  relic: n => [`A golden idol of the tide-keepers! (${n}/6)`, n === 6 ? 'That\'s all six! The people of Port Haven will want to see these.' : 'It hums faintly. There should be more of these somewhere...'],

  hermitFirst: [
    'Well now! A castaway on a raft? I haven\'t seen a new face in twenty years.',
    'Name\'s Tobias. I used to build ships for the fleet at Port Haven.',
    'You want to reach the Great Isle to the east? Ha! A reef surrounds it, and the water there boils like soup.',
    'No raft could survive that. You need a proper sailboat.',
    'I could build you one. Bring me some SAILCLOTH, 10 WOOD and 2 ROPE.',
    'The old tide-keepers\' ruins to the NORTH should still have sailcloth in them, but that chest is locked tight.',
    'My friend M. went looking for the key along the EAST beach. He never came back...',
  ],
  hermitBuild: [
    'Sailcloth! And good wood, too. Stand back, let an old man work...',
    '*saw* *hammer* *hammer* *grumble* *hammer*',
    'There she is! A sailboat that can handle the reef.',
    'Sail EAST, then land on the Great Isle\'s WEST beach. The rest of the coast is sheer cliff.',
    'Tell them in Port Haven that old Tobias says hello.',
  ],
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
    'Across three islands, the reef, and the pass... on your own?',
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
    deals: [
      { cost: 12, give: { iron: 3 }, text: '3 iron bars' },
      { cost: 8, give: { bandage: 2 }, text: '2 bandages' },
      { cost: 10, give: { cooked: 3 }, text: '3 cooked meals' },
      { cost: 6, give: { rope: 3 }, text: '3 coils of rope' },
      { cost: 15, give: { hide: 4 }, text: '4 hides' },
    ],
  },
  dig: {
    5: ['You dig... CLUNK! A small chest!', 'Inside: Captain Rhee\'s SPYGLASS. You can see much further now!'],
    9: ['You dig... CLUNK! A brass box!', 'Inside: a tide-keeper COMPASS. Its needle points toward golden idols you haven\'t found yet.'],
    4: ['You dig... CLUNK! A pirate\'s stash!', 'Inside: 40 gold coins!'],
  },
  bossWin: {
    magmaw: ['Magmaw crumbles into cooling stone...', 'In the rubble you find the MAGMA BLADE and a still-warm EMBER HEART.', '(Magma Blade: 5 damage. Ember Heart: +25 max health.)'],
    frostfang: ['Old Frostfang lets out a final howl and lies still.', 'You fashion his thick pelt into the FROSTFANG CLOAK.', '(Take 55% less damage, and the cold can\'t touch you.)'],
    bogking: ['The Bog King sinks beneath the mud for good. His crown bobs to the surface...', 'Tangled with it are the BOG BOOTS.', '(You move 18% faster.)'],
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
