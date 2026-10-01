/*
 * PARASITE — Chapter II: The Crow
 *
 * The overflow pipe empties into a canal at the edge of the city. A crow is
 * drinking there. Wear it over the rooftops, past a cat and the man with the
 * sprayer, to his house — then leave it at the vent and crawl in alone.
 *
 * Tiles: # concrete, B brick, M metal, W wood, ^ pigeon spikes, w water,
 *        = vent grate (only the bare parasite fits), . open sky
 */
window.PARASITE_LEVELS = window.PARASITE_LEVELS || {};
window.PARASITE_LEVELS.crow = (() => {
  "use strict";

  const W = 172, H = 30;
  const grid = Array.from({ length: H }, () => Array(W).fill("."));
  const fill = (x, y, w, h, ch = "#") => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
      if (i >= 0 && i < W && j >= 0 && j < H) grid[j][i] = ch;
    }
  };
  const entities = [];
  const add = (type, x, y, extra = {}) => entities.push({ type, x, y, ...extra });

  fill(0, 27, W, 3);                // the street, standing on row 26

  // --- 1. The outfall ------------------------------------------------------
  fill(0, 8, 4, 19);                // the canal's retaining wall
  fill(0, 18, 7, 3, "M");           // the overflow pipe…
  fill(0, 19, 7, 1, ".");           // …and its bore, open at the end
  fill(4, 25, 22, 2);               // the canal bank, standing on row 24
  fill(9, 25, 6, 1, "w");           // a channel of water
  add("start", 3, 19);
  add("crow", 18, 24, { facing: -1 });
  add("checkpoint", 21, 24);
  add("lamp", 8, 21, { r: 4, color: "255,200,140" });

  // --- 2. The rooftops -----------------------------------------------------
  fill(26, 17, 9, 10, "B");         // A: the first climb, roof on row 16
  fill(40, 13, 10, 14, "B");        // B
  fill(41, 12, 3, 1, "^");          // spikes where you'd want to land
  fill(46, 10, 2, 3, "B");          // chimney
  add("shard", 46, 9, { memory: "The first time I saw the sky, I thought it was another kind of water." });
  add("crow", 48, 12, { facing: -1 });   // a spare, if you lose yours
  add("urge", 44, 12, { host: "crow", item: "shiny", label: "take the shiny thing", effect: "wings", cost: 12,
    text: "mine. mine. it doesn't matter what it is." });
  fill(55, 15, 12, 12, "B");        // C: the cat's roof
  add("cat", 60, 14, { range: 4 });
  fill(70, 11, 8, 16, "B");         // D
  fill(74, 10, 4, 1, "^");
  fill(78, 13, 3, 1, "M");          // an eave sticking out over the street
  add("shard", 79, 14, { memory: "The beetle's fear is still in me. I flinch at light I'm not even under." });
  add("checkpoint", 71, 10);
  for (const [x, y] of [[37, 22], [52, 22], [68, 22]]) add("lamp", x, y, { r: 5 });

  // --- 3. The street ---------------------------------------------------------
  fill(88, 12, 1, 15, "M");         // a utility pole…
  fill(86, 12, 5, 1, "M");          // …with a crossbar to rest on
  add("shard", 90, 11, { memory: "I wasn't always a worm. I think. I remember wanting to be something bigger." });
  fill(92, 24, 6, 3, "M");          // a parked van
  add("dog", 84, 26, { facing: 1 });     // a stray under the pole: cats run from it
  add("exterminator", 104, 26, { range: 5 });
  for (const [x, y] of [[84, 22], [100, 22], [116, 22]]) add("lamp", x, y, { r: 5, flicker: x === 100 });
  fill(112, 10, 10, 17, "B");       // E
  add("checkpoint", 113, 9);
  add("crow", 119, 9, { facing: -1 });

  // --- 4. His house ----------------------------------------------------------
  fill(126, 23, 1, 4, "W");         // the garden fence
  fill(126, 23, 6, 1, "W");
  add("exterminator", 138, 26, { range: 5 });
  fill(150, 8, 22, 19, "B");        // the house
  fill(148, 7, 24, 1, "M");         // gutter along the roof
  add("lamp", 146, 18, { r: 3, color: "255,230,170" });
  // The vent and the duct behind it
  fill(150, 26, 1, 1, "=");
  fill(151, 26, 15, 1, ".");
  fill(157, 27, 2, 1, "w");         // condensation pooling in the duct
  add("shard", 154, 26, { memory: "His house smells like the poison. Like the jar. Like the end of the others." });
  add("exit", 164, 25, { w: 2 });

  const hints = [
    { x: 2,   text: "The pipe spits you out into the city. Find something with wings." },
    { x: 13,  text: "It's drinking. Press <b>E</b> while it isn't looking." },
    { x: 22,  text: "Tap <b>↑</b> or <b>space</b> in the air to flap. Hold it to glide." },
    { x: 30,  text: "Wings tire. Land on something to rest them." },
    { x: 39,  text: "Spikes on the ledges. The city doesn't want you landing." },
    { x: 53,  text: "A cat. Don't come down near it." },
    { x: 81,  text: "The man in yellow. Stay high, out of his reach." },
    { x: 84, y: 26, text: "A stray dog, asleep. Cats run from dogs. Men in yellow don't." },
    { x: 123, text: "The van in the drive. This is where he lives." },
    { x: 140, text: "The vent by the ground. A crow won't fit through. You will." },
    { x: 149, text: "In. <b>Q</b> to leave the crow." },
  ];

  const hostMemories = {
    dog: ["home. where's home?", "she said good boy", "the car didn't come back", "the bins on Thursday", "wait by the door"],
    crow: [
      "the old man feeds us at noon",
      "remember every face",
      "shiny. shiny.",
      "the tall tree is home",
      "they throw stones at us",
      "wind under me, nothing else",
      "the man in yellow kills things",
      "follow the rubbish trucks",
    ],
  };

  return {
    id: "crow",
    title: "Chapter II — The Crow",
    theme: "city",
    darkness: 0.5,
    card: { kicker: "the city, after rain", title: "Chapter II <span>— The Crow</span>", name: "The Crow" },
    firstWhisper: "everything is so big out here",
    outro: {
      kicker: "chapter II complete",
      title: "Into the walls.",
      text: "Inside, the house breathes through its ducts. Something with whiskers is nesting in the insulation.",
      next: "Chapter III — <em>The Rat</em>",
    },
    width: W,
    height: H,
    tiles: grid.map((row) => row.join("")),
    entities,
    hints,
    hostMemories,
  };
})();
