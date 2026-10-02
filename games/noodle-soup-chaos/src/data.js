'use strict';
// The cast. Every unique customer can be hired after you serve them a correct bowl.
const CAST = [
  { id: 'grumble', name: 'MR. GRUMBLE', title: 'GRUMPY BUSINESSMAN', role: 'CASHIER', ability: 'cashier', day: 1,
    desc: 'AUTO-COLLECTS COINS. +$2 TIP PER BOWL.', quirk: 'COMPLAINS. CONSTANTLY.', cost: 20, charm: 2, weird: 1,
    look: { skin: '#f1c27d', hair: '#2b2b2b', hs: 'slick', shirt: '#34405e', pants: '#262e45', shoe: '#111', grumpy: true, acc: ['collar', 'tie', 'briefcase'], tie: '#c0392b' },
    say: { order: ['HURRY UP.', 'I HAVE A MEETING.', 'NOODLES. NOW.'], happy: ['...ACCEPTABLE.', 'HMPH. FINE.'], angry: ['UNBELIEVABLE!', 'I WANT A REFUND!'],
      hire: 'I SUPPOSE I COULD... DIVERSIFY.', staff: ['TIME IS MONEY.', 'I USED TO RUN A BANK.', 'THIS IS BENEATH ME.', 'KEEP THE CHANGE. WAIT, NO.', 'WHO GOT BROTH ON MY TIE?', 'I AM SMILING ON THE INSIDE.'] } },
  { id: 'timmy', name: 'LIL TIMMY', title: 'NAPKIN THIEF', role: 'DELIVERY BOY', ability: 'runner', day: 1,
    desc: 'RUNS FINISHED BOWLS TO THE RIGHT CUSTOMER.', quirk: 'POCKETS THE ODD COIN. FOR A BIKE.', cost: 12, charm: 4, weird: 2,
    look: { skin: '#e0ac69', hair: '#5a3a1a', hs: 'cap', cap: '#e74c3c', shirt: '#f1c40f', stripe: '#e67e22', pants: '#2e86de', shoe: '#eeeeee', legH: 4, bodyH: 6, bw: 8, acc: ['stripes', 'napkins', 'freckles'] },
    say: { order: ['CAN I HAVE NAPKINS?', 'I GOT A DOLLAR!', 'EXTRA NAPKINS PLS'], happy: ['YESSS!', 'BEST NOODLES EVER!'], angry: ['THIS STINKS!', "I'M TELLING MY MOM!"],
      hire: 'DO I GET A NAME TAG?!', staff: ["I'M SAVING FOR A BIKE.", 'NAPKIN COUNT: 400.', 'ZOOM ZOOM!', "I'M THE FASTEST!", 'CAN I HAVE A BREAK?', 'I FOUND A NAPKIN!'] } },
  { id: 'snoot', name: 'M. SNOOT', title: 'FOOD CRITIC', role: 'HEAD CHEF', ability: 'chef', day: 1, picky: true,
    desc: 'STARTS POTS FOR WAITING ORDERS.', quirk: 'WORKS... RELUCTANTLY. NEEDS A FAST, PERFECT BOWL TO JOIN.', cost: 30, charm: 3, weird: 2,
    look: { skin: '#f5d0b5', hair: '#4a2c2a', hs: 'beret', hat: '#6c2d5e', shirt: '#1e1e24', pants: '#1e1e24', shoe: '#5a3a2a', smug: true, acc: ['monocle', 'mustache', 'scarf'], scarf: '#d4af37' },
    say: { order: ['IMPRESS ME.', 'I AM TAKING NOTES.', 'ONE STAR, PENDING.'], happy: ['...HM. INTRIGUING.'], angry: ['ZERO STARS.', 'APPALLING.'],
      hire: 'FINE. BUT I WANT A TALLER HAT.', staff: ['ONE STAR. STILL.', 'I SUPPOSE THIS IS... ADEQUATE.', '*SIGH*', 'THE BROTH LACKS AMBITION.', 'I AM AN ARTIST.', 'DO NOT TELL MY EDITOR.'] } },
  { id: 'nana', name: 'NANA BAO', title: 'SWEET GRANDMA', role: 'BROTH KEEPER', ability: 'noburn', day: 2,
    desc: 'POTS NEVER BURN. CUSTOMERS WAIT 15% LONGER.', quirk: 'PINCHES EVERYONE\'S CHEEKS.', cost: 18, charm: 5, weird: 1,
    look: { skin: '#f0c9a8', hair: '#dcdcdc', hs: 'bun', shirt: '#8e6fb3', pants: '#6d4c8f', shoe: '#5a3a2a', legH: 5, acc: ['glasses', 'apron'] },
    say: { order: ['TAKE YOUR TIME, DEAR.', 'YOU LOOK THIN. EAT!'], happy: ['JUST LIKE MY MOTHER MADE!'], angry: ['WELL, I NEVER!'],
      hire: 'OH! LET NANA HELP, DEAR.', staff: ['YOU NEED A SWEATER.', 'LOW AND SLOW, DEARIE.', 'WHO WANTS A CANDY?', 'IN MY DAY BROTH TOOK A WEEK.', 'EAT SOMETHING!'] } },
  { id: 'gary', name: 'GARY', title: 'A PIGEON', role: 'PIGEON', ability: 'none', day: 2, anyBowl: true,
    desc: 'DOES NOTHING. ABSOLUTELY NOTHING.', quirk: 'MAXIMUM CHARM. WILL JOIN FOR ANY BOWL.', cost: 1, charm: 8, weird: 4,
    look: { type: 'pigeon' },
    say: { order: ['COO.', 'COO?', 'CROO.'], happy: ['COO!!'], angry: ['*ANGRY COO*'], hire: 'COO. (I ACCEPT.)', staff: ['COO.', 'COO COO.', '*STARES*', 'COO?', '*BOBS HEAD*', 'CROOOO.'] } },
  { id: 'zoomie', name: 'ZOOMIE', title: 'SKATER', role: 'TOPPING TOSSER', ability: 'topper', day: 2,
    desc: 'KICKFLIPS TOPPINGS ONTO BOWLS. MOSTLY RIGHT.', quirk: '10% OF TOPPINGS ARE A SURPRISE.', cost: 22, charm: 3, weird: 3,
    look: { skin: '#c68642', hair: '#222', hs: 'helmet', hat: '#2ecc71', shirt: '#ff7f50', pants: '#34495e', shoe: '#e74c3c', acc: ['skateboard', 'bandaid'] },
    say: { order: ['YO, NOODLES!', 'GNARLY BROTH PLS'], happy: ['RADICAL!'], angry: ['BOGUS, DUDE.'], hire: 'DUDE. I CAN SHRED ON THE LINE.', staff: ['GNARLY!', 'WATCH THIS!', 'TOTALLY TUBULAR BROTH.', 'I MEANT TO DO THAT.', 'SKATE OR DIE. OR COOK.'] } },
  { id: 'beep', name: 'B33P-0', title: 'LOST DELIVERY ROBOT', role: 'STOCK BOT', ability: 'catcher', day: 3,
    desc: 'AUTO-CATCHES FLYING SUPPLY CRATES.', quirk: 'SOMETIMES INSTALLS UPDATES. MID-SHIFT.', cost: 28, charm: 3, weird: 3,
    look: { skin: '#b8c4d0', hs: 'antenna', shirt: '#7f8c8d', pants: '#5d6d7e', shoe: '#34495e', robotEyes: true, noBlush: true, hand: '#8e9aaf', acc: ['bolts'] },
    say: { order: ['INPUT: NOODLES.', 'BEEP. HUNGRY.'], happy: ['JOY.EXE'], angry: ['ERROR 404: PATIENCE'], hire: 'NEW DIRECTIVE ACCEPTED. BEEP.', staff: ['BEEP.', 'BOOP.', 'CALCULATING NOODLES...', 'I AM 87% BROTH NOW.', 'HELLO FRIEND-UNIT.'] } },
  { id: 'marcel', name: 'MARCEL', title: 'STREET MIME', role: 'ENTERTAINER', ability: 'entertain', day: 3,
    desc: 'CUSTOMERS LOSE PATIENCE 35% SLOWER.', quirk: 'GETS STUCK IN INVISIBLE BOXES.', cost: 16, charm: 4, weird: 4,
    look: { skin: '#fafafa', hair: '#111', hs: 'beret', hat: '#111', shirt: '#fafafa', stripe: '#111', pants: '#111', shoe: '#111', hand: '#ffffff', acc: ['stripes', 'redlips', 'gloves'] },
    say: { order: ['...', '*MIMES SLURPING*'], happy: ['*SILENT JOY*'], angry: ['*SILENT RAGE*'], hire: '*MIMES SIGNING A CONTRACT*', staff: ['...', '*PULLS INVISIBLE ROPE*', '*WALKS AGAINST WIND*', '*BOWS*', '*MIMES A NOODLE*'] } },
  { id: 'whiskers', name: 'SIR WHISKERS', title: 'DISTINGUISHED CAT', role: 'MASCOT', ability: 'mascot', day: 3,
    desc: 'MORE CUSTOMERS. +$1 TIP PER BOWL.', quirk: 'KNOCKS THINGS OFF COUNTERS.', cost: 15, charm: 6, weird: 3,
    look: { type: 'cat', col: '#f0932b', dark: '#c46a12' },
    say: { order: ['MEOW.', 'MRRP.'], happy: ['*PURRS*'], angry: ['HSSSS!'], hire: '*SLOW BLINK* (ACCEPTED)', staff: ['MEOW.', '*NAPS*', '*JUDGES YOU*', 'MRRRP.', '*SITS IN A BOWL*'] } },
  { id: 'ken', name: 'BIG KEN', title: 'SUMO WRESTLER', role: 'BOUNCER', ability: 'bouncer', day: 4,
    desc: 'ANGRY WALKOUTS COST LESS REPUTATION.', quirk: 'HUGS ARE MANDATORY.', cost: 20, charm: 4, weird: 2,
    look: { skin: '#e8b48a', hair: '#111', hs: 'topknot', shirt: '#e8b48a', pants: '#e8b48a', shoe: '#e8b48a', bw: 14, bodyH: 9, legW: 3, acc: ['belt', 'belly'], belt: '#2c3e50' },
    say: { order: ['BIG BOWL PLEASE.', 'TEN BOWLS. KIDDING.'], happy: ['MMMMM!'], angry: ['KEN IS SAD.'], hire: 'KEN PROTECT NOODLE SHOP.', staff: ['KEN IS HAPPY.', 'GROUP HUG?', 'NO FIGHTING. ONLY NOODLES.', 'KEN LIKES YOU.'] } },
  { id: 'grimble', name: 'GRIMBLE', title: 'WANDERING WIZARD', role: 'SORCERER', ability: 'magic', day: 4,
    desc: 'CONJURES INGREDIENTS INTO THE LOWEST BIN.', quirk: 'OCCASIONALLY TURNS CUSTOMERS INTO FROGS.', cost: 26, charm: 4, weird: 5,
    look: { skin: '#f1c27d', hair: '#eeeeee', hs: 'wizard', hat: '#3b4cca', shirt: '#3b4cca', pants: '#3b4cca', shoe: '#5a3a2a', robe: true, beard: '#eeeeee', acc: ['beard', 'wand'] },
    say: { order: ['A BOWL OF... WISDOM.', 'NOODLES, I PRESUME.'], happy: ['MOST ENCHANTING!'], angry: ['BE YE CURSED!'], hire: 'I FORESAW THIS. SORT OF.', staff: ['ABRACADABROTH!', 'WHO MOVED MY STAFF?', 'I WAS A FROG ONCE.', 'THE NOODLES SPEAK TO ME.', 'OOPS. WRONG SPELL.'] } },
  { id: 'zorp', name: 'ZORP', title: 'TOURIST FROM SPACE', role: 'POT WRANGLER', ability: 'pourer', day: 5,
    desc: 'TRACTOR-BEAMS READY POTS INTO BOWLS.', quirk: 'THINKS NOODLES ARE A RELIGION.', cost: 26, charm: 4, weird: 5,
    look: { skin: '#7bed9f', hs: 'alien', shirt: '#b8c4d0', pants: '#8e9aaf', shoe: '#5d6d7e', alienEyes: true, noBlush: true, hand: '#7bed9f', acc: ['zorpbelt'] },
    say: { order: ['GREETINGS. NOODLE ME.', 'TAKE ME TO YOUR BROTH.'], happy: ['GLORP!'], angry: ['PREPARE FOR PROBE.'], hire: 'I WILL TELL MY PLANET.', staff: ['GLORP.', 'YOUR SPECIES IS... SLURPY.', 'NOODLES: 10/10 GALAXIES.', 'PHONING HOME. THEY SAID HI.'] } },
  { id: 'boris', name: 'BOO-RIS', title: 'FRIENDLY GHOST', role: 'HAUNTED SOUS CHEF', ability: 'haste', day: 5,
    desc: 'POTS COOK 60% FASTER. THEY ARE SCARED.', quirk: 'WALKS THROUGH WALLS. AND CUSTOMERS.', cost: 22, charm: 3, weird: 4,
    look: { type: 'ghost' },
    say: { order: ['BOOOO... ROTH.', 'NOODLES... FOR THE DEAD?'], happy: ['SPOOKTACULAR!'], angry: ['I SHALL HAUNT THEE.'], hire: 'FINALLY, A JOB WITH BENEFITS. WAIT.', staff: ['BOO.', 'SORRY, BOO.', 'I HAUNT WITH LOVE.', 'THE POTS FEAR ME.', 'WOOOOO.'] } },
  { id: 'beard', name: 'CPT. NOODLEBEARD', title: 'RETIRED PIRATE', role: 'SUPPLY CAPTAIN', ability: 'supply', day: 6,
    desc: 'MORE CRATES ARRIVE. EACH GIVES +1 EXTRA.', quirk: 'SINGS SEA SHANTIES. LOUDLY.', cost: 24, charm: 4, weird: 3,
    look: { skin: '#d4a373', hair: '#7a3b12', hs: 'pirate', shirt: '#a93226', pants: '#3b2a1a', shoe: '#1a1a1a', beard: '#c0571f', acc: ['beard', 'eyepatch', 'hook'] },
    say: { order: ['ARR! NOODLES!', 'BROTH, YE SCALLYWAG!'], happy: ['SHIVER ME NOODLES!'], angry: ['WALK THE PLANK!'], hire: 'A NEW CREW! ARRR!', staff: ['ARRR!', 'YO HO HO AND A BOWL OF BROTH.', 'I SEE CRATES ON THE HORIZON.', 'SWAB THE STOVE!'] } },
  { id: 'kaylee', name: 'KAYLEE', title: 'INFLUENCER', role: 'SOCIAL MEDIA', ability: 'hype', day: 6,
    desc: 'MORE CUSTOMERS. REPUTATION GAINS DOUBLED.', quirk: 'FILMS EVERYTHING. EVERYTHING.', cost: 18, charm: 3, weird: 2,
    look: { skin: '#ffdbac', hair: '#ff6fb5', hs: 'long', shirt: '#ffffff', pants: '#7ec8e3', shoe: '#ffffff', acc: ['phone', 'sunglasses'] },
    say: { order: ['WAIT, LET ME FILM IT.', 'IS THIS AESTHETIC?'], happy: ['OMG. CONTENT.'], angry: ['UNFOLLOWED.'], hire: 'COLLAB?? YES!!', staff: ['SMASH THAT LIKE BUTTON!', 'WE ARE TRENDING!', 'SAY NOODLES!', 'THIS IS SO RANDOM.'] } },
];
CAST.forEach(c => { c.unique = true; });
const CAST_BY_ID = {}; CAST.forEach(c => CAST_BY_ID[c.id] = c);

const GEN_NAMES = ['COMMUTER', 'STUDENT', 'TOURIST', 'NURSE', 'JOGGER', 'PAINTER', 'BUS DRIVER', 'DJ', 'PLUMBER', 'ACCOUNTANT', 'POET', 'MAIL CARRIER', 'FLORIST', 'BARISTA', 'LIBRARIAN'];
const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#f5d0b5'];
const HAIRS = ['#2b2b2b', '#5a3a1a', '#a0522d', '#e8c26b', '#7a1f1f', '#3d2b5a', '#dcdcdc'];
const SHIRTS = ['#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#f39c12', '#1abc9c', '#e84393', '#fdcb6e', '#6c5ce7', '#00b894'];
const PANTS = ['#2c3e50', '#34495e', '#5d4037', '#2d3436', '#6c5ce7', '#0984e3'];
const GEN_SAY = {
  order: ['ONE BOWL PLEASE!', 'SO HUNGRY...', 'IS IT READY?', 'SMELLS AMAZING!', 'MY USUAL!', 'LUNCH TIME!', 'EXTRA SLURPY!'],
  happy: ['YUM!', 'DELICIOUS!', 'PERFECT!', 'SO GOOD!'],
  angry: ['FORGET IT!', 'TOO SLOW!', 'I\'M LEAVING!', 'UGH!'],
  wrong: ['THIS ISN\'T MINE...', 'HUH? WRONG BOWL.', 'I GUESS I\'LL EAT IT.'],
};
function genericChar() {
  const hs = pick(['short', 'long', 'spiky', 'bald', 'bun', 'cap', 'short']);
  return {
    id: 'gen', unique: false, name: pick(GEN_NAMES),
    look: { skin: pick(SKINS), hair: pick(HAIRS), hs, cap: pick(SHIRTS), shirt: pick(SHIRTS), pants: pick(PANTS), shoe: '#2a2a2a', acc: Math.random() < 0.25 ? ['glasses'] : [] },
    say: GEN_SAY,
  };
}

const SYNERGIES = [
  { a: 'nana', b: 'timmy', text: 'NANA ADOPTED TIMMY', charm: 3 },
  { a: 'grumble', b: 'snoot', text: 'GRUMBLE & SNOOT: SNOB BUDDIES', charm: 3 },
  { a: 'whiskers', b: 'gary', text: 'CAT & PIGEON: UNLIKELY BFFS', charm: 4 },
  { a: 'marcel', b: 'zorp', text: 'ZORP THINKS MARCEL IS A KING', charm: 3 },
  { a: 'grimble', b: 'boris', text: 'GRIMBLE KEEPS TRYING TO EXORCISE BORIS', charm: 2 },
  { a: 'beep', b: 'zoomie', text: 'B33P-0 LEARNED TO KICKFLIP', charm: 3 },
  { a: 'ken', b: 'nana', text: 'BIG KEN CALLS NANA "COACH"', charm: 3 },
  { a: 'beard', b: 'gary', text: "GARY IS NOW THE SHIP'S PARROT", charm: 4 },
  { a: 'kaylee', b: 'whiskers', text: 'SIR WHISKERS WENT VIRAL', charm: 3 },
  { a: 'grumble', b: 'timmy', text: 'GRUMBLE IS TEACHING TIMMY TAXES', charm: 2 },
  { a: 'snoot', b: 'nana', text: "SNOOT SECRETLY LOVES NANA'S BROTH", charm: 3 },
  { a: 'zorp', b: 'beep', text: 'ZORP AND B33P-0 SPEAK FLUENT BEEP', charm: 2 },
];

const STAFF_REVIEWS = {
  grumble: "'THE CASHIER SIGHED AT ME. RESPECT.'",
  timmy: "'A CHILD SOLD ME MY OWN NAPKIN.'",
  snoot: "'ONE STAR. BUT I WORK HERE NOW.' - M. SNOOT",
  nana: "'TASTES LIKE GRANDMA'S. WAIT, THAT WAS HER.'",
  gary: "'A PIGEON TOOK MY ORDER. 5 STARS.'",
  zoomie: "'MY EGG ARRIVED VIA KICKFLIP.'",
  beep: "'THE ROBOT SAID BEEP. I SAID BEEP BACK.'",
  marcel: "'THE MIME WAS SOMEHOW LOUD.'",
  whiskers: "'THE CAT JUDGED ME. I DESERVED IT.'",
  ken: "'GOT HUGGED BY A SUMO. 10/10.'",
  grimble: "'MY FRIEND IS A FROG NOW. HE LOVED IT.'",
  zorp: "'MY WAITER WAS FROM ANOTHER GALAXY.'",
  boris: "'THE SOUS CHEF WALKED THROUGH ME. CHILLING.'",
  beard: "'ARRR. GOOD BROTH.' - ANOTHER PIRATE",
  kaylee: "'SAW IT ON KAYLEE'S STORY. WORTH THE LINE.'",
};

const DAY_SUBS = ['GRAND OPENING!', 'WORD IS GETTING AROUND', 'LUNCH RUSH IS REAL', 'THINGS ARE GETTING WEIRD', 'THE WHOLE TOWN IS HERE', 'NOBODY KNOWS WHAT IS HAPPENING', 'THE FINAL DAY. MAKE IT COUNT!'];

function rankFor(ch) {
  if (ch >= 55) return 'MOST LOVABLE CREW IN THE UNIVERSE';
  if (ch >= 40) return 'THE WEIRDEST FAMILY IN TOWN';
  if (ch >= 25) return 'NEIGHBORHOOD LEGENDS';
  if (ch >= 12) return 'A QUIRKY LITTLE PLACE';
  return 'A PERFECTLY NORMAL NOODLE SHOP';
}
function starsFor(ch) { return ch >= 55 ? 5 : ch >= 40 ? 4 : ch >= 25 ? 3 : ch >= 12 ? 2 : 1; }
