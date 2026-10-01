/*
 * PARASITE — Chapter III: The Rat
 *
 * Inside the walls of the exterminator's house. A rat sleeps in the
 * insulation by the duct. Wear it up shafts (kick off the walls), through
 * wood (gnaw), past his traps and his bait (the rat is hungry, and it pulls),
 * across the kitchen where the cat sleeps lightly — and up to his bedroom.
 *
 * Tiles: # framing (solid), W wood furniture, M metal, G gnawable board,
 *        . open. Rooms are drawn behind the open spaces they cover.
 */
window.PARASITE_LEVELS = window.PARASITE_LEVELS || {};
window.PARASITE_LEVELS.rat = (() => {
  "use strict";

  const W = 170, H = 26;
  const grid = Array.from({ length: H }, () => Array(W).fill("#"));
  const fill = (x, y, w, h, ch = "#") => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
      if (i >= 0 && i < W && j >= 0 && j < H) grid[j][i] = ch;
    }
  };
  const carve = (x, y, w, h) => fill(x, y, w, h, ".");
  const entities = [];
  const add = (type, x, y, extra = {}) => entities.push({ type, x, y, ...extra });

  // --- 1. The nest -----------------------------------------------------------
  carve(1, 4, 14, 3);               // a joist space by the duct, standing on row 6
  add("start", 2, 6);
  add("rat", 10, 6, { facing: -1 });
  add("checkpoint", 12, 6);

  // --- 2. Down, then up a shaft you climb by kicking off the walls -----------
  carve(15, 4, 3, 15);              // drop to the cavity floor
  carve(15, 16, 12, 3);             // cavity floor, standing on row 18
  carve(27, 3, 3, 16);              // the shaft: three wide, fifteen tall
  add("shard", 28, 3, { memory: "The crow's sky is still in me. Down here it feels like being buried." });
  carve(30, 4, 10, 2);              // a passage off the top of the shaft…
  carve(30, 3, 3, 1);               // …with a wide mouth to jump into
  fill(34, 4, 1, 2, "G");           // board across it — gnaw through

  // --- 3. The trap corridor ----------------------------------------------------
  carve(39, 4, 2, 6);
  carve(39, 8, 40, 2);              // two tiles tall, standing on row 9
  add("checkpoint", 41, 9);
  for (const x of [47, 56, 65, 72]) add("trap", x, 9);
  for (const x of [51, 60, 69]) add("bait", x, 9);
  add("shard", 76, 9, { memory: "The jar. I remember now — the jar on his shelf. The others were in it." });

  // --- 4. The kitchen ---------------------------------------------------------
  carve(78, 8, 2, 12);              // down inside the wall
  carve(80, 19, 2, 1);              // a mouse hole into the kitchen (too low for a cat)
  carve(82, 6, 40, 14);             // the kitchen, floor on row 19
  add("room", 82, 6, { w: 40, h: 14, style: "kitchen" });
  add("rat", 84, 19, { facing: 1 });     // a spare body
  add("checkpoint", 83, 19);
  // Gaps between the floorboards: a rat can drop into one and the cat walks
  // right over it
  for (const x of [88, 94, 100, 106, 111]) fill(x, 20, 1, 1, ".");
  fill(84, 15, 7, 1, "W");          // the counter top
  fill(96, 15, 6, 1, "W");          // the table
  fill(107, 17, 3, 1, "W");         // shelves, a ladder to the top of the fridge
  fill(110, 14, 3, 1, "W");
  fill(114, 11, 5, 8, "M");         // the fridge, on feet: a gap underneath
  add("shard", 116, 10, { memory: "I don't eat. I never have. Whatever hunger I feel belongs to someone else." });
  add("cat", 101, 19, { range: 10 });
  add("roach", 119, 19, { facing: -1 });  // under the fridge's far side: it climbs, but can't chew
  add("urge", 92, 19, { host: "rat", item: "crumbs", label: "eat the crumbs", effect: "heal", cost: 15,
    text: "the little girl dropped them. good girl. good girl." });
  add("lamp", 90, 14, { r: 4, color: "150,200,255" });
  add("lamp", 117, 10, { r: 3, color: "220,240,255" });

  // --- 5. Up to his bedroom -----------------------------------------------------
  carve(122, 19, 1, 1);             // out through the far skirting
  carve(123, 4, 3, 16);             // a taller shaft
  carve(126, 4, 19, 2);             // a passage along under the floorboards
  carve(126, 3, 3, 1);
  add("shard", 137, 5, { memory: "He's asleep upstairs. The man who poured the others into the jar." });
  add("trap", 141, 5);
  carve(145, 4, 2, 8);
  carve(147, 11, 1, 1);             // a hole behind the skirting board
  carve(148, 2, 20, 10);            // the bedroom, floor on row 11
  add("room", 148, 2, { w: 20, h: 10, style: "bed" });
  add("checkpoint", 149, 11);
  fill(156, 9, 8, 2, "W");          // the bed
  add("man", 159, 8, { lying: true, facing: 1 });
  add("lamp", 165, 7, { r: 4, color: "255,200,130" });
  add("exit", 155, 7, { w: 9 });

  const hints = [
    { x: 2,   text: "A rat, asleep in the insulation. Take it." },
    { x: 16,  text: "Rats are fast. Rats jump high." },
    { x: 25,  text: "Jump at a wall, then jump again off it. Climb the shaft." },
    { x: 31,  text: "Wood in the way? Push against it. Rats have teeth." },
    { x: 42,  text: "Traps. And bait — the rat is hungry, and it will pull toward it. Jump both." },
    { x: 80,  text: "The kitchen. Gaps in the floorboards — drop into one and the cat can't reach you." },
    { x: 104, text: "Shelves to the top of the fridge, if you want what's up there. Under it, the cat can't follow." },
    { x: 118, y: 19, text: "A cockroach. It climbs walls, but it can't chew through wood." },
    { x: 121, text: "Out through the skirting. Up again." },
    { x: 148, text: "His bedroom. He's asleep." },
  ];

  const hostMemories = {
    roach: ["dark. under. dark.", "the kitchen at night is ours", "the spray only made us stronger", "we were here before the house"],
    rat: [
      "the cat sleeps by the stove",
      "the bait smells like dinner",
      "my nest. my babies.",
      "the walls hum at night",
      "he sets the traps on Sundays",
      "teeth. through anything.",
      "the little girl drops crumbs",
      "run. walls. run.",
    ],
    man: [
      "Lena hates the smell of the spray",
      "I should have quit years ago",
    ],
  };

  return {
    id: "rat",
    title: "Chapter III — The Rat",
    theme: "house",
    darkness: 0.7,
    card: { kicker: "inside the walls", title: "Chapter III <span>— The Rat</span>", name: "The Rat" },
    firstWhisper: "it's warm in here. it smells like him.",
    outro: {
      kicker: "chapter III complete",
      title: "He's asleep.",
      text: "The man in yellow sleeps on his back, mouth open. His wife's side of the bed is cold. On the nightstand, a child's drawing: a house, a family, a smiling sun.",
      next: "Chapter IV — <em>The Man</em>",
    },
    width: W,
    height: H,
    tiles: grid.map((row) => row.join("")),
    entities,
    hints,
    hostMemories,
  };
})();
