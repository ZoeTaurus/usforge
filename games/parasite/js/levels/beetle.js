/*
 * PARASITE — Chapter I: The Beetle
 *
 * The level is carved out of solid soil with a few helpers rather than drawn
 * as ASCII, so the geometry stays easy to tweak. Coordinates are in tiles.
 *
 * Tiles
 *   #  soil (solid)            R  rock (solid)
 *   =  root mesh — solid for hosts, but the bare parasite slips through
 *   ~  pesticide puddle (hurts)   w  water (rehydrates the parasite)
 *   .  open
 *
 * The route:
 *   1. The waking       — crawl as the bare parasite; dry out; find a beetle
 *   2. The wall & pit   — climb walls, cling to the ceiling over poison
 *   3. The light room   — sunbeams through the cracks; the beetle panics in them
 *   4. The ant tunnel   — ants patrol below; hang from the ceiling
 *   5. The roots        — leave the host; squeeze through alone; take another
 *   6. The sprayers     — pesticide nozzles on a timer
 *   7. The web          — spiders on threads; bait them down, pass beneath
 *   8. The flush        — pesticide floods a shaft; climb out ahead of it
 */
window.PARASITE_LEVELS = window.PARASITE_LEVELS || {};
window.PARASITE_LEVELS.beetle = (() => {
  "use strict";

  const W = 228, H = 24;
  const grid = Array.from({ length: H }, () => Array(W).fill("#"));

  const carve = (x, y, w, h, ch = ".") => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
      if (i >= 0 && i < W && j >= 0 && j < H) grid[j][i] = ch;
    }
  };
  const fill = (x, y, w, h, ch = "#") => carve(x, y, w, h, ch);

  const entities = [];
  const add = (type, x, y, extra = {}) => entities.push({ type, x, y, ...extra });

  // --- 1. The waking -------------------------------------------------------
  carve(1, 5, 35, 14);              // main cave, floor on row 18
  carve(6, 3, 8, 2);                // ragged ceiling
  carve(18, 4, 10, 1);
  fill(11, 18, 5, 1, "R");          // a step to hop
  carve(18, 19, 3, 1, "w");         // a shallow puddle
  fill(25, 15, 5, 1, "R");          // the stone the beetle sleeps under
  fill(25, 16, 1, 1, "R");
  add("start", 3, 18);
  add("beetle", 27, 18, { asleep: true });

  // --- 2. The wall & the pit -----------------------------------------------
  fill(33, 9, 4, 10);               // the wall: only a climber gets over
  carve(33, 7, 9, 2);               // ledge corridor above the wall (rows 7–8)
  carve(42, 7, 17, 12);             // the pit
  carve(42, 17, 17, 2, "~");        // pesticide at the bottom
  fill(48, 9, 3, 1, "R");           // a ledge inside the pit, one jump below the ceiling
  add("shard", 49, 8, { memory: "I was born in the dark under the glasshouse." });
  carve(59, 7, 4, 2);               // ledge on the far side

  // --- 3. The light room ---------------------------------------------------
  carve(63, 4, 32, 15);             // big room, floor on row 18
  fill(59, 9, 4, 10);               // right pit wall doubles as the room's left wall
  for (const x of [69, 77, 85]) carve(x, 0, 2, 4); // cracks to the surface
  fill(89, 12, 2, 7, "R");          // a rock pillar to climb, a memory on top
  add("shard", 89, 11, { memory: "There were others like me. I don't know where they went." });
  for (const x of [69, 77, 85]) add("light", x, 0, { w: 2 });
  add("moth", 65, 18, { facing: 1 });   // drawn to the light the beetle fears
  add("urge", 74, 18, { host: "beetle", item: "rot", label: "eat the rot", effect: "heal", cost: 15,
    text: "sweet. so sweet. you didn't want that. it did." });

  // --- 4. The ant tunnel ---------------------------------------------------
  carve(95, 17, 30, 2);             // low tunnel, rows 17–18
  add("checkpoint", 96, 18);
  add("ant", 104, 18);
  add("ant", 111, 18);
  add("ant", 117, 18);

  // --- 5. The roots --------------------------------------------------------
  carve(125, 17, 3, 2, "=");        // root mesh: hosts can't pass
  carve(128, 17, 14, 2);            // the parasite's crawlspace
  carve(133, 19, 2, 1, "w");        // a drink on the way
  fill(130, 16, 10, 1, "R");

  // --- 6. The sprayers -----------------------------------------------------
  carve(142, 6, 26, 13);            // room, floor on row 18, ceiling on row 6
  add("checkpoint", 143, 18);
  add("beetle", 146, 18, { asleep: true });
  // The spray rolls left to right, a little faster than a beetle runs:
  // go the moment the first nozzle stops and you stay behind the wave.
  for (const [x, phase] of [[151, 0], [156, 3.7], [161, 2.7]]) add("nozzle", x, 6, { phase });
  fill(148, 14, 2, 5, "R");         // a lookout over the sprayers
  add("shard", 148, 13, { memory: "I had a name once. It was a sound, not a word." });

  // --- 7. The web ----------------------------------------------------------
  carve(168, 13, 34, 6);            // a long hall, rows 13–18, opening off the sprayers
  add("checkpoint", 170, 18);
  for (const x of [175, 180, 185, 196, 200]) add("spider", x, 13);
  fill(184, 15, 2, 4, "R");         // a rock under the third spider…
  add("shard", 184, 14, { memory: "One of us, wrapped in silk. It had stayed in its spider too long." });
  add("cocoon", 184, 14);
  add("ant", 189, 18, { range: 2, leash: 1 });   // a short beat between the rock and the last spiders
  for (const [x, y, r] of [[171, 13, 40], [190, 13, 34], [199, 13, 46]]) add("web", x, y, { r });

  // --- 8. The flush ----------------------------------------------------------
  carve(202, 17, 2, 2);             // a low gap into the shaft
  carve(204, 2, 14, 17);            // the shaft, rows 2–18
  // Ledges alternate sides, so you climb a wall, cross a ledge's underside,
  // drop, and climb the other wall
  fill(204, 14, 10, 1, "R");        // A: hangs off the left wall
  fill(208, 10, 10, 1, "R");        // B: hangs off the right wall
  fill(204, 6, 10, 1, "R");         // C: hangs off the left wall
  carve(218, 2, 8, 2);              // the overflow pipe at the top right
  add("checkpoint", 204, 18);
  add("beetle", 206, 18, { asleep: true });   // a spare body, if you lost yours
  add("flood", 204, 19, { w: 14, trigger: 208, top: 2 });
  add("exit", 223, 2, { w: 3 });

  const hints = [
    { x: 2,   text: "← → to crawl · ↑ or space to hop" },
    { x: 13,  text: "The air dries you out. Water helps." },
    { x: 22,  text: "Something sleeps under the stone. Press <b>E</b> to burrow in." },
    { x: 30,  text: "Hold toward a wall to climb it." },
    { x: 38,  text: "Jump and hold <b>↑</b> to cling to the ceiling. <b>↓</b> lets go." },
    { x: 64,  text: "The beetle is afraid of the light. So, a little, are you." },
    { x: 67,  text: "A moth sleeps by the light. It doesn't fear it. It can't stay away." },
    { x: 73,  text: "The beetle smells rot. Giving in mends the body, and costs you." },
    { x: 97,  text: "They can smell you. Stay above them." },
    { x: 121, text: "Your host won't fit through the roots. You will. Press <b>Q</b> to leave it." },
    { x: 143, text: "Another body. Take it." },
    { x: 149, text: "Poison. Watch for the drip before the spray." },
    { x: 169, text: "Something is hanging in the dark ahead." },
    { x: 176, text: "Coax it down. Go while it climbs." },
    { x: 203, text: "The pipes are groaning." },
    { x: 208, text: "They're flushing the tunnels. <b>Climb.</b>" },
    { x: 219, text: "Out." },
  ];

  // Memories that leak out of a beetle while you wear it
  const mothMemories = ["the moon. the porch light. the moon.", "warm. warm glass.", "the others went into the bulb", "dust on my wings is all I have"];
  const beetleMemories = [
    "the dark under the stone is safe",
    "smell of rot. sweet.",
    "climb. climb. climb.",
    "the light means birds",
    "the others went into the jar",
    "dig. eat. dig.",
    "a thousand legs before me",
    "the ground hums when they walk",
  ];

  return {
    id: "beetle",
    title: "Chapter I — The Beetle",
    theme: "soil",
    darkness: 0.78,
    card: { kicker: "beneath the glasshouse", title: "Chapter I <span>— The Beetle</span>", name: "The Beetle" },
    outro: {
      kicker: "chapter I complete",
      title: "Out through the overflow.",
      text: "The pipe runs downhill toward the city. Where it empties, something with wings comes down to drink.",
      next: "Chapter II — <em>The Crow</em>",
    },
    width: W,
    height: H,
    tiles: grid.map((row) => row.join("")),
    entities,
    hints,
    hostMemories: { beetle: beetleMemories, moth: mothMemories },
  };
})();
