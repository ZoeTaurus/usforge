/*
 * PARASITE — Chapter IV: The Man
 *
 * The exterminator's house, at night. He set his foggers in the basement
 * before bed, to clear the walls — of rats, of you. Wear him: down the
 * stairs, his keys from the kitchen, the basement door. Shut the three
 * valves, and at the far end of the basement there is a mirror.
 *
 * Floors: upstairs rows 2–9 (floorboards on row 10), ground floor rows 12–19
 * (floor on row 20), basement rows 22–29 (floor on row 30).
 */
window.PARASITE_LEVELS = window.PARASITE_LEVELS || {};
window.PARASITE_LEVELS.man = (() => {
  "use strict";

  const W = 80, H = 34;
  const grid = Array.from({ length: H }, () => Array(W).fill("#"));
  const fill = (x, y, w, h, ch = "#") => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
      if (i >= 0 && i < W && j >= 0 && j < H) grid[j][i] = ch;
    }
  };
  const carve = (x, y, w, h) => fill(x, y, w, h, ".");
  const entities = [];
  const add = (type, x, y, extra = {}) => entities.push({ type, x, y, ...extra });

  // --- Upstairs ----------------------------------------------------------------
  carve(1, 2, 59, 8);
  fill(1, 10, 59, 1, "W");          // floorboards
  fill(17, 2, 1, 6);                // wall between her room and his…
  add("door", 17, 9);
  fill(36, 2, 1, 6);                // …and between his room and the hall
  add("door", 36, 9);
  add("room", 1, 2, { w: 16, h: 8, style: "bed" });
  add("room", 18, 2, { w: 18, h: 8, style: "bed" });
  add("room", 37, 2, { w: 23, h: 8, style: "hall" });

  // His room: the bed, and you on it, just out of the rat
  fill(23, 9, 8, 1, "W");           // low enough to step over
  add("man", 26, 8, { lying: true, facing: 1 });
  add("start", 25, 8);
  add("lamp", 32, 7, { r: 3, color: "255,200,130" });

  // Her room: a desk with a drawing on it
  fill(4, 9, 4, 1, "W");
  add("shard", 5, 7, { memory: "A drawing: a family, a house, a smiling sun. I don't have a family. I had the others." });
  add("lamp", 12, 6, { r: 3, color: "255,170,200" });
  add("urge", 12, 9, { host: "man", item: "drawing", label: "look at her drawing", effect: "lena", cost: 20,
    text: "a house, a family, a smiling sun. he drew the sun for her, the first time, when she couldn't." });

  // The hall and the stairs down
  add("checkpoint", 38, 9);
  add("lamp", 45, 6, { r: 3, color: "255,220,160", flicker: true });
  // Steps stop two tiles above the floor, so he can walk underneath them
  carve(50, 10, 6, 2);

  // --- Ground floor --------------------------------------------------------------
  carve(20, 12, 59, 8);
  fill(20, 20, 59, 1, "W");
  fill(28, 12, 1, 6);               // wall by the basement door
  add("door", 28, 19, { lock: "basement" });
  add("room", 20, 12, { w: 8, h: 8, style: "plain" });
  add("room", 29, 12, { w: 30, h: 8, style: "hall" });
  add("room", 59, 12, { w: 20, h: 8, style: "kitchen" });
  fill(34, 19, 1, 1, "W");          // a footstool…
  fill(35, 18, 5, 2, "W");          // …the fireplace…
  fill(40, 19, 1, 1, "W");          // …another stool
  add("shard", 37, 17, { memory: "His memories are so loud. Under them, very quietly: I was here first." });
  add("checkpoint", 49, 19);
  fill(63, 19, 6, 1, "W");          // a low kitchen step
  add("shard", 65, 18, { memory: "The jar is on the shelf above the sink. It's empty now. They're all gone." });
  add("key", 76, 18, { id: "basement" });
  add("cat", 70, 19, { range: 5 });
  add("lamp", 66, 14, { r: 4, color: "150,200,255" });
  add("lamp", 40, 14, { r: 4, color: "255,190,120", flicker: true });

  // The basement stairs: the landing floor is open, steps go down to the left
  carve(20, 20, 8, 2);

  // --- Basement ------------------------------------------------------------------
  carve(1, 22, 60, 8);
  fill(1, 30, 60, 1, "B");
  add("room", 1, 22, { w: 60, h: 8, style: "basement" });
  add("checkpoint", 19, 29);
  add("valve", 17, 28, { id: "a" });
  add("fog", 9, 24, { w: 5, h: 6, valve: "a" });
  add("valve", 5, 28, { id: "b" });
  add("shard", 3, 29, { memory: "I could stay. He would never know. After a while, neither would I." });
  add("fog", 25, 24, { w: 5, h: 6, valve: "b" });
  add("valve", 36, 28, { id: "c" });
  add("fog", 44, 22, { w: 9, h: 8, valve: "all" });
  add("mirror", 56, 29);
  for (const x of [10, 30, 50]) add("lamp", x, 23, { r: 4, color: "255,220,150", flicker: true });

  // Both staircases go in last, after the rooms are carved around them
  for (let i = 0; i < 6; i++) fill(50 + i, 12 + i, 1, 1, "W");   // upstairs → ground floor
  for (let i = 0; i < 6; i++) fill(27 - i, 22 + i, 1, 1, "W");   // ground floor → basement

  const hints = [
    { x: 25, y: 9, text: "The man who poured the others into the jar. Asleep. Press <b>E</b>." },
    { x: 20, y: 9, text: "Her room is through there. Don't wake her." },
    { x: 34, y: 9, text: "Too big for the walls now — but you have hands. <b>E</b> opens doors." },
    { x: 41, y: 9, text: "The house smells of his foggers. He set them before bed, to clear the walls. Of you." },
    { x: 50, y: 19, text: "The basement door is locked. His keys hang in the kitchen." },
    { x: 26, y: 26, text: "Three foggers. Shut every valve and the fog will clear." },
    { x: 40, y: 29, text: "Something at the far end, behind the thickest fog. A mirror." },
  ];

  const hostMemories = {
    man: [
      "Lena hates the smell of the spray",
      "I should have quit years ago",
      "dad's hands, cracked from the chemicals",
      "the Johnson place had rats in the cot",
      "she left in March",
      "don't wake her",
      "I set the foggers. I always set the foggers.",
      "is someone else in here?",
      "it's just a job. it's just a job.",
    ],
  };

  return {
    id: "man",
    title: "Chapter IV — The Man",
    theme: "house",
    darkness: 0.72,
    card: { kicker: "the house, at night", title: "Chapter IV <span>— The Man</span>", name: "The Man" },
    firstWhisper: "he breathes so slowly",
    endings: {
      stay: {
        kicker: "ending · becoming",
        title: "You stay.",
        lines: [
          "You keep his name. His house. His daughter's drawings on the fridge.",
          "In the morning you go to work. You spray the walls of other people's houses, and you don't wonder why it feels like murder.",
          "Some nights you dream of being very small. You never remember why.",
        ],
      },
      yourself: {
        kicker: "ending · yourself",
        title: "You leave.",
        lines: [
          "You slide out of him onto the cold basement floor. He'll wake with a headache and a dream he can't hold on to.",
          "You are small again. Soft. Already drying.",
          "But you remember the dark under the glasshouse, the sky like water, the others in the jar.",
          "You remember your name. It is a sound, not a word. You say it, and it is still yours.",
        ],
      },
      nobody: {
        kicker: "ending · nobody",
        title: "You leave.",
        lines: [
          "You slide out of him onto the cold basement floor.",
          "You are small again. You try to remember what you were before the beetle, before the crow, before the rat.",
          "There's nothing there. Only the wanting — to be inside something. Anything.",
          "Somewhere in the walls, a rat is sleeping.",
        ],
      },
    },
    width: W,
    height: H,
    tiles: grid.map((row) => row.join("")),
    entities,
    hints,
    hostMemories,
  };
})();
