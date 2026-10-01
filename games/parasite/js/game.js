/*
 * PARASITE — the game
 *
 * A side-on platformer about borrowing bodies. Out in the open you are a
 * soft, slow worm that dries out in seconds. Burrow into a beetle and you can
 * climb walls and hang from ceilings — but the beetle bleeds into you. Its
 * fear of light, its instincts and its memories slowly wear down your SELF.
 * Hit zero and there is no "you" left to play.
 *
 * Four chapters, four kinds of body — beetle, crow, rat, man — each a level
 * file in js/levels/. The engine reads the chapter from ?chapter= (or from the
 * save when continuing).
 */
(() => {
  "use strict";

  const audio = window.ParasiteAudio;
  const SAVE_KEY = "parasite.save";
  const JOURNEY_KEY = "parasite.journey";
  const LEVEL_ORDER = ["beetle", "crow", "rat", "man"];

  const params = new URLSearchParams(location.search);
  // Some hosts drop the query string, so the page that sent us here also
  // leaves a note in sessionStorage
  let handoff = {};
  try { handoff = JSON.parse(sessionStorage.getItem("parasite.goto") || "{}"); sessionStorage.removeItem("parasite.goto"); } catch (e) { /* ignore */ }
  if (!params.has("chapter") && handoff.chapter) params.set("chapter", handoff.chapter);
  if (handoff.continue) params.set("continue", "1");
  const resuming = params.has("continue");
  let savedData = null;
  try { savedData = JSON.parse(localStorage.getItem(SAVE_KEY) || "null"); } catch (e) { /* no save */ }
  const LEVEL_ID = params.get("chapter") || (resuming && savedData && savedData.level) || "beetle";
  const LEVEL = window.PARASITE_LEVELS[LEVEL_ID] || window.PARASITE_LEVELS.beetle;
  const THEME = LEVEL.theme || "soil";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const T = 32;                   // tile size in world pixels
  const GRAVITY = 1500;
  const MAX_FALL = 720;

  const PARASITE = { w: 18, h: 10, speed: 88, jump: 370 };
  // Every body you can wear. `move` picks the controller; `drain` is how fast
  // SELF leaks away while you're inside it.
  const HOSTS = {
    beetle: {
      w: 20, h: 20, speed: 150, climb: 115, jump: 480, hp: 3, drain: 0.6, move: "climber", glow: "#9dff6a",
      dying: "the shell cracks. it's dying around you.",
      urges: ["no— not that way", "the beetle wants to hide", "it isn't listening to you", "dig. dig. dig."],
      becoming: ["You are the beetle now.", "It doesn't remember being anything else. Neither do you."],
    },
    crow: {
      w: 24, h: 18, speed: 180, walk: 95, jump: 330, flap: 340, hp: 2, drain: 0.7, move: "flyer", glow: "#7fb4ff",
      dying: "a wing won't answer. it's dying around you.",
      urges: ["up. up. away from the ground", "the crow wants the shiny thing", "it's flying where it wants", "home. the tall tree."],
      becoming: ["You are the crow now.", "It remembers every face in the city. None of them are yours."],
    },
    moth: {
      w: 16, h: 12, speed: 135, walk: 50, jump: 200, flap: 230, flapCost: 0.035, hp: 1, drain: 0.7, move: "flyer", glow: "#f0e2a8",
      lightDrawn: true,
      dying: "the wings are dust now. it's dying around you.",
      urges: ["the light. the light.", "closer. it's warm.", "the moth wants to touch it", "bright bright bright"],
      becoming: ["You are the moth now.", "It will fly into the next bright thing it sees. So will you."],
    },
    dog: {
      w: 34, h: 24, speed: 205, jump: 470, hp: 3, drain: 0.75, move: "runner", glow: "#e2b07a", scaresCats: true,
      dying: "it lies down. it's dying around you.",
      urges: ["home. where's home?", "the dog wants to sniff that", "someone used to call it a name", "wait. wait for them."],
      becoming: ["You are the dog now.", "It waits by a door for someone who isn't coming. So do you."],
    },
    roach: {
      w: 18, h: 12, speed: 185, climb: 150, jump: 420, hp: 1, drain: 0.65, move: "climber", glow: "#c9965a",
      dying: "it's still twitching. it's dying around you.",
      urges: ["dark. go where it's dark.", "the roach doesn't care about you", "eat. hide. eat.", "it has outlived everything"],
      becoming: ["You are the cockroach now.", "It will outlive the house, the man, the city. It won't remember you."],
    },
    rat: {
      w: 26, h: 14, speed: 215, jump: 560, hp: 2, drain: 0.8, move: "runner", glow: "#ffb347", gnaw: true, wallJump: true,
      dying: "its heart is going too fast. it's dying around you.",
      urges: ["food. food. there's food", "the rat isn't listening", "it smells the bait", "run. walls. run."],
      becoming: ["You are the rat now.", "It knows every hole in this house. It doesn't know you were ever here."],
    },
    man: {
      w: 22, h: 58, speed: 125, jump: 400, hp: 4, drain: 0.9, move: "walker", glow: "#cfe9ff",
      dying: "his knees give out. he's dying around you.",
      urges: ["he's walking on his own", "Lena? is that you?", "he wants to check on her", "his hands know this house better than you do"],
      becoming: ["You are him now.", "Tomorrow you'll go to work. You'll spray the walls. You won't wonder why it feels like murder."],
    },
  };
  const BEETLE = HOSTS.beetle;

  // What a body leaves in you if you wear it long enough
  const TRAIT_TIME = 30;              // seconds in one kind of body, within a chapter
  const TRAITS = {
    beetle: { id: "lightshy", gain: "The beetle stays with you. You flinch from light, whatever you wear.", ending: "You still flinch from light, though nothing about you burns." },
    moth: { id: "lightdrawn", gain: "The moth stays with you. Light pulls at you, whatever you wear.", ending: "Lamps still pull at you. You never know why you want to touch them." },
    crow: { id: "skyward", gain: "The crow stays with you. Every body jumps higher, and hates the ground.", ending: "You look up at every bird that passes." },
    dog: { id: "loyal", gain: "The dog stays with you. Cats keep their distance from whatever you wear.", ending: "You miss someone you never met: whoever the dog was waiting for." },
    rat: { id: "hungry", gain: "The rat stays with you. Every body runs faster, and wants the bait.", ending: "You are always, faintly, hungry." },
    roach: { id: "enduring", gain: "The cockroach stays with you. Every body can take one more hit.", ending: "You are harder to kill than you used to be." },
  };
  const has = (id) => traits.has(id);
  // Gentle mode: slower drains, sturdier bodies, a slower flood
  let gentleMode = false;
  try { gentleMode = localStorage.getItem("parasite.gentle") === "on"; } catch (e) { /* ignore */ }
  const gentle = (v) => (gentleMode ? v * 0.6 : v);
  const maxHp = (form) => (specOf(form).hp || 1) + (has("enduring") ? 1 : 0) + (gentleMode ? 1 : 0);
  const speedMul = () => (has("hungry") ? 1.08 : 1);
  const jumpMul = () => (has("skyward") ? 1.1 : 1);
  const specOf = (form) => HOSTS[form] || PARASITE;

  // How fast things wear you down (per second)
  const SELF_DRAIN_HOST = 0.6;
  const SELF_DRAIN_LIGHT = 4.5;
  const SELF_REGEN_FREE = 2.5;
  const MOISTURE_DRAIN = 6.5;
  const MOISTURE_WATER = 70;

  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const hash = (x, y) => {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  // Smooth value noise, so the soil shade drifts instead of checkerboarding
  const smooth = (t) => t * t * (3 - 2 * t);
  const valueNoise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = smooth(x - xi), yf = smooth(y - yi);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return lerp(lerp(a, b, xf), lerp(c, d, xf), yf);
  };
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  // ---------------------------------------------------------------------------
  // DOM
  // ---------------------------------------------------------------------------

  const $ = (id) => document.getElementById(id);
  const canvas = $("game");
  const ctx = canvas.getContext("2d");
  const shadeCanvas = document.createElement("canvas");
  const shade = shadeCanvas.getContext("2d");

  const ui = {
    selfFill: $("self-fill"), selfValue: $("self-value"), selfMeter: $("self-meter"),
    moist: $("moist-meter"), moistFill: $("moist-fill"),
    hostName: $("host-name"), hostHp: $("host-hp"),
    shards: $("shard-count"),
    hint: $("hint"),
    whispers: $("whispers"),
    card: $("chapter-card"),
    pause: $("pause"), dead: $("dead"), won: $("won"),
    deadTitle: $("dead-title"), deadText: $("dead-text"),
    wonStats: $("won-stats"),
    soundState: $("sound-state"),
    prompt: $("prompt"),
    wings: $("wings-meter"), wingsFill: $("wings-fill"), traits: $("traits"),
    wonKicker: $("won-kicker"), wonTitle: $("won-title"), wonText: $("won-text"), wonNext: $("won-next"),
    nextBtn: $("next-btn"), ending: $("ending"), endingChoice: $("ending-choice"), endingText: $("ending-text"),
    cardKicker: $("card-kicker"), cardTitle: $("card-title"),
  };

  // ---------------------------------------------------------------------------
  // Level
  // ---------------------------------------------------------------------------

  const MAP_W = LEVEL.width, MAP_H = LEVEL.height;
  // Tiles are rebuilt on every respawn — rats gnaw holes and doors open
  let tiles = LEVEL.tiles.map((row) => row.split(""));
  const WORLD_W = MAP_W * T, WORLD_H = MAP_H * T;

  function tileAt(cx, cy) {
    if (cy >= MAP_H) return ".";
    if (cx < 0 || cx >= MAP_W || cy < 0) return "#";
    return tiles[cy][cx];
  }
  // # soil/plaster  R rock  B brick  M metal  W wood  G gnawable  D door
  const SOLID = new Set(["#", "R", "B", "M", "W", "G", "D"]);
  const isSolid = (ch, form) => SOLID.has(ch) || (ch === "=" && form !== "parasite");

  function collides(x, y, w, h, form) {
    const x0 = Math.floor(x / T), x1 = Math.floor((x + w - 0.01) / T);
    const y0 = Math.floor(y / T), y1 = Math.floor((y + h - 0.01) / T);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) if (isSolid(tileAt(cx, cy), form)) return true;
    }
    return false;
  }

  function touchesTile(b, ch) {
    const x0 = Math.floor(b.x / T), x1 = Math.floor((b.x + b.w - 0.01) / T);
    const y0 = Math.floor(b.y / T), y1 = Math.floor((b.y + b.h - 0.01) / T);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        if (tileAt(cx, cy) !== ch) continue;
        // Liquids only fill the lower part of their tile
        if (ch === "~" || ch === "w") { if (b.y + b.h > cy * T + 8) return true; } else return true;
      }
    }
    return false;
  }

  // Move a body through the tile grid, one axis at a time.
  function moveBody(b, form, dt) {
    b.hitX = 0; b.hitY = 0;
    let nx = b.x + b.vx * dt;
    if (collides(nx, b.y, b.w, b.h, form)) {
      if (b.vx > 0) nx = Math.floor((nx + b.w) / T) * T - b.w - 0.01;
      else if (b.vx < 0) nx = (Math.floor(nx / T) + 1) * T + 0.01;
      else nx = b.x;
      if (collides(nx, b.y, b.w, b.h, form)) nx = b.x;
      b.hitX = Math.sign(b.vx) || 0;
      b.vx = 0;
    }
    b.x = nx;
    let ny = b.y + b.vy * dt;
    if (collides(b.x, ny, b.w, b.h, form)) {
      if (b.vy > 0) ny = Math.floor((ny + b.h) / T) * T - b.h - 0.01;
      else if (b.vy < 0) ny = (Math.floor(ny / T) + 1) * T + 0.01;
      else ny = b.y;
      if (collides(b.x, ny, b.w, b.h, form)) ny = b.y;
      b.hitY = Math.sign(b.vy) || 0;
      b.vy = 0;
    }
    b.y = ny;
  }

  function contacts(b, form) {
    return {
      ground: collides(b.x + 1, b.y + b.h, b.w - 2, 1.5, form),
      ceil: collides(b.x + 1, b.y - 1.5, b.w - 2, 1.5, form),
      left: collides(b.x - 1.5, b.y + 1, 1.5, b.h - 2, form),
      right: collides(b.x + b.w, b.y + 1, 1.5, b.h - 2, form),
    };
  }

  // Light beams fall from the cracks until they hit something solid
  const beams = LEVEL.entities.filter((e) => e.type === "light").map((e) => {
    let bottom = e.y;
    while (bottom < MAP_H && ![...Array(e.w).keys()].some((i) => isSolid(tileAt(e.x + i, bottom), "beetle"))) bottom++;
    return { x: e.x * T, y: e.y * T, w: e.w * T, h: (bottom - e.y) * T };
  });

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  let player, beetles, ants, nozzles, shards, checkpoints, exitZone, particles;
  let spiders, webs, cocoons, flood;
  let cats, exterminators, traps, baits, fogs, valves, keyItems, doors, mirrors, lamps, rooms;
  let heldKeys = new Set();
  let urges = [];
  // Carried across chapters in the journey save
  const traits = new Set();
  const wornTime = {};
  let struggle = { t: 0, next: 12 };
  let self = 100, moisture = 100;
  let state = "play";             // play | paused | dead | won
  let intro = true;               // the world holds its breath until the chapter card clears
  let time = 0, levelTime = 0;
  let hostsTaken = 0;
  const takenShards = new Set();
  const usedUrges = new Set();
  let checkpoint = null;
  const shownHints = new Set();
  let shake = 0;
  let hurtFlash = 0;
  let nextHostWhisper = 6;
  let instinct = { t: 0, dir: 0, next: 8 };

  const startEntity = LEVEL.entities.find((e) => e.type === "start");

  // A body waiting for you. A sleeping man lies down, so his box is on its side.
  function makeSleeper(kind, px, py, e = {}) {
    const spec = HOSTS[kind];
    const lying = !!e.lying;
    const w = lying ? spec.h : spec.w, h = lying ? 20 : spec.h;
    return { kind, x: px + (T - w) / 2, y: py + T - h - 0.01, w, h, state: "asleep", facing: e.facing || -1, breath: Math.random() * TAU, lying };
  }

  function spawnWorld() {
    tiles = LEVEL.tiles.map((row) => row.split(""));
    beetles = []; ants = []; nozzles = []; shards = []; checkpoints = []; particles = [];
    spiders = []; webs = []; cocoons = []; flood = null;
    urges = [];
    cats = []; exterminators = []; traps = []; baits = []; fogs = []; valves = []; keyItems = []; doors = []; mirrors = []; lamps = []; rooms = [];
    const flags = (checkpoint && checkpoint.flags) || {};
    heldKeys = new Set(flags.keys || []);
    LEVEL.entities.forEach((e, id) => {
      const px = e.x * T, py = e.y * T;
      switch (e.type) {
        case "beetle": case "crow": case "rat": case "man": case "moth": case "dog": case "roach":
          beetles.push(makeSleeper(e.type, px, py, e));
          break;
        case "cat":
          cats.push({ x: px, y: py + T - 34 - 0.01, w: 40, h: 34, vx: 0, vy: 0, dir: e.facing || -1, home: px, range: (e.range || 4) * T, state: "prowl", t: 0, step: 0, alert: 0 });
          break;
        case "exterminator":
          exterminators.push({ x: px, y: py + T - 58 - 0.01, w: 22, h: 58, dir: e.facing || -1, home: px, range: (e.range || 4) * T, state: "walk", t: 0, cool: 0, aim: 0, step: 0 });
          break;
        case "trap":
          traps.push({ x: px + 2, y: py + T - 8, w: 28, h: 8, state: "set", t: 0 });
          break;
        case "bait":
          baits.push({ x: px + T / 2, y: py + T - 5, eaten: false });
          break;
        case "fog":
          fogs.push({ x: px, y: py, w: e.w * T, h: e.h * T, valve: e.valve, on: true, fade: 1, puffs: Array.from({ length: Math.ceil(e.w * e.h * 1.2) }, () => ({ u: Math.random(), v: Math.random(), r: rand(18, 34), p: Math.random() * TAU })) });
          break;
        case "valve":
          valves.push({ id: e.id, x: px + T / 2, y: py + T / 2, closed: (flags.valves || []).includes(e.id), turn: 0 });
          break;
        case "key":
          keyItems.push({ id: e.id, x: px + T / 2, y: py + T / 2, taken: heldKeys.has(e.id) });
          break;
        case "door": {
          const door = { id: id, x: px, y: py - T, w: T, h: 2 * T, lock: e.lock || null, open: (flags.doors || []).includes(id), cx: e.x, cy: e.y };
          if (!door.open) { tiles[e.y][e.x] = "D"; tiles[e.y - 1][e.x] = "D"; }
          doors.push(door);
          break;
        }
        case "mirror":
          mirrors.push({ x: px, y: py - T, w: T, h: 2 * T });
          break;
        case "lamp":
          lamps.push({ x: px + T / 2, y: py + T / 2, r: (e.r || 5) * T, color: e.color || "255,214,150", flicker: !!e.flicker });
          break;
        case "room":
          rooms.push({ x: px, y: py, w: e.w * T, h: e.h * T, style: e.style || "plain" });
          break;
        case "urge":
          urges.push({ id, x: px + T / 2, y: py + T - 6, host: e.host, item: e.item, label: e.label, text: e.text, effect: e.effect, cost: e.cost || 15, used: usedUrges.has(id) });
          break;
        case "ant":
          ants.push({ x: px, y: py + T - 11, w: 20, h: 11, dir: Math.random() < 0.5 ? -1 : 1, home: px, range: (e.range || 3) * T, leash: (e.leash ?? 3) * T, step: Math.random() * TAU, alert: 0 });
          break;
        case "nozzle": {
          let bottom = e.y + 1;
          while (bottom < MAP_H && !isSolid(tileAt(e.x, bottom), "beetle")) bottom++;
          nozzles.push({ x: px + T / 2, y: py, bottom: bottom * T, phase: e.phase, was: "idle" });
          break;
        }
        case "shard":
          shards.push({ id, x: px + T / 2, y: py + T / 2, memory: e.memory, taken: takenShards.has(id), spin: Math.random() * TAU });
          break;
        case "checkpoint":
          checkpoints.push({ x: px, y: py, w: T, h: T, active: checkpoint && checkpoint.x === px });
          break;
        case "exit":
          exitZone = { x: px, y: py, w: e.w * T, h: T * 2 };
          break;
        case "spider": {
          let bottom = e.y;
          while (bottom < MAP_H && !isSolid(tileAt(e.x, bottom), "beetle")) bottom++;
          const rest = py + 16;
          spiders.push({ x: px + T / 2, anchor: py, rest, y: rest, bottom: bottom * T - 9, state: "idle", t: 0, cooldown: 0, phase: Math.random() * TAU, w: 16, h: 16 });
          break;
        }
        case "web":
          webs.push({ x: px + T / 2, y: py, r: e.r });
          break;
        case "cocoon":
          cocoons.push({ x: px + T / 2, y: py + T / 2 });
          break;
        case "flood":
          flood = { x: px, w: e.w * T, base: py, y: py, trigger: e.trigger * T, top: e.top * T, active: false, t: 0 };
          break;
      }
    });
    syncFog(true);
  }

  // Fog belongs to a valve; "all" fog clears only once every valve is shut
  function syncFog(instant) {
    const allShut = valves.length > 0 && valves.every((v) => v.closed);
    for (const f of fogs) {
      const shut = f.valve === "all" ? allShut : valves.some((v) => v.id === f.valve && v.closed);
      f.on = !shut;
      if (instant) f.fade = f.on ? 1 : 0;
    }
  }

  function makePlayer(form, x, y) {
    const spec = specOf(form);
    const p = {
      form, x, y, w: spec.w, h: spec.h, vx: 0, vy: 0,
      mode: "air", side: 0, facing: 1, climbDir: -1,
      hp: form === "parasite" ? 1 : maxHp(form), invuln: 0, walk: 0, burrow: null,
      trail: [], wasGround: false, stamina: 1, flap: 0, gnaw: 0, wallLock: 0, pull: 0,
    };
    p.chain = Array.from({ length: 13 }, () => ({ x: x + p.w / 2, y: y + p.h / 2 }));
    return p;
  }

  function respawn() {
    spawnWorld();
    const cp = checkpoint || { x: startEntity.x * T, y: startEntity.y * T, hosted: startEntity.hosted || false, self: 100 };
    const kind = cp.hosted === true ? "beetle" : cp.hosted;
    if (kind) {
      const spec = HOSTS[kind];
      player = makePlayer(kind, cp.x + (T - spec.w) / 2, cp.y + T - spec.h - 0.01);
      player.mode = "ground";
    } else {
      player = makePlayer("parasite", cp.x + (T - PARASITE.w) / 2, cp.y + T - PARASITE.h - 0.01);
    }
    self = Math.max(cp.self, 60);
    instinct = { t: 0, dir: 0, next: 8 };
    struggle = { t: 0, next: 12 };
    moisture = 100;
    player.invuln = 1;
    state = "play";
    camera.snap = true;
    updateHostUI();
  }

  // ---------------------------------------------------------------------------
  // Saving
  // ---------------------------------------------------------------------------

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        level: LEVEL.id, checkpoint, shards: [...takenShards], hosts: hostsTaken, time: levelTime,
      }));
    } catch (e) { /* storage unavailable — progress just won't persist */ }
  }

  function loadJourney() {
    try { return JSON.parse(localStorage.getItem(JOURNEY_KEY) || "null") || { memories: {}, hosts: 0 }; }
    catch (e) { return { memories: {}, hosts: 0 }; }
  }
  function saveJourney(j) {
    try { localStorage.setItem(JOURNEY_KEY, JSON.stringify(j)); } catch (e) { /* ignore */ }
  }
  const journeyMemories = (j) => Object.values(j.memories || {}).reduce((n, ids) => n + ids.length, 0);

  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
      if (!data || data.level !== LEVEL.id) return;
      checkpoint = data.checkpoint || null;
      (data.shards || []).forEach((id) => takenShards.add(id));
      hostsTaken = data.hosts || 0;
      levelTime = data.time || 0;
    } catch (e) { /* ignore a corrupt save */ }
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------

  const keys = new Set();
  const pressed = new Set();
  const DEFAULT_KEYMAP = {
    ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
    ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down",
    Space: "jump", KeyE: "burrow", KeyQ: "leave", Escape: "pause", KeyP: "pause", Enter: "confirm",
  };
  // Keys the player has bound themselves, on top of the defaults
  let customKeys = {};
  try { customKeys = JSON.parse(localStorage.getItem("parasite.keys") || "{}") || {}; } catch (e) { /* ignore */ }
  let KEYMAP = { ...DEFAULT_KEYMAP, ...customKeys };
  let rebinding = null;

  function press(action) {
    if (!keys.has(action)) pressed.add(action);
    keys.add(action);
    audio.start();
  }
  function release(action) { keys.delete(action); }

  window.addEventListener("keydown", (ev) => {
    if (rebinding) {
      ev.preventDefault();
      if (ev.code !== "Escape") {
        for (const [code, act] of Object.entries(customKeys)) if (act === rebinding) delete customKeys[code];
        customKeys[ev.code] = rebinding;
        try { localStorage.setItem("parasite.keys", JSON.stringify(customKeys)); } catch (e) { /* ignore */ }
        KEYMAP = { ...DEFAULT_KEYMAP, ...customKeys };
      }
      rebinding = null;
      renderBinds();
      return;
    }
    const action = KEYMAP[ev.code];
    if (!action) return;
    // Let focused menu buttons handle Enter/Space natively
    if ((action === "confirm" || action === "jump") && ev.target.closest && ev.target.closest("button")) return;
    ev.preventDefault();
    if (ev.repeat) return;
    press(action);
  });
  window.addEventListener("keyup", (ev) => {
    const action = KEYMAP[ev.code];
    if (action) release(action);
  });
  window.addEventListener("blur", () => keys.clear());
  window.addEventListener("pointerdown", () => audio.start());

  // Touch controls
  document.querySelectorAll("[data-touch]").forEach((btn) => {
    const action = btn.dataset.touch;
    const down = (ev) => { ev.preventDefault(); btn.classList.add("held"); press(action); };
    const up = (ev) => { ev.preventDefault(); btn.classList.remove("held"); release(action); };
    btn.addEventListener("pointerdown", down);
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointercancel", up);
    btn.addEventListener("pointerleave", up);
  });
  if (window.matchMedia("(pointer: coarse)").matches) document.body.classList.add("touch");

  const held = (a) => keys.has(a);
  const tapped = (a) => pressed.has(a);

  // ---------------------------------------------------------------------------
  // Player update
  // ---------------------------------------------------------------------------

  function inLight(b) {
    return beams.some((beam) => overlap(b, beam));
  }

  // The nearest bright thing: a sunbeam or a lamp
  function nearestLight(b, range) {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    let best = null, bd = range;
    for (const beam of beams) {
      const lx = beam.x + beam.w / 2, ly = clamp(cy, beam.y, beam.y + beam.h);
      const d = Math.hypot(lx - cx, ly - cy);
      if (d < bd) { bd = d; best = { x: lx, y: ly, d }; }
    }
    for (const l of lamps) {
      const d = Math.hypot(l.x - cx, l.y - cy);
      if (d < bd) { bd = d; best = { x: l.x, y: l.y, d }; }
    }
    return best;
  }
  const inLamplight = (b) => lamps.some((l) => Math.hypot(l.x - (b.x + b.w / 2), l.y - (b.y + b.h / 2)) < l.r * 0.55);

  function updatePlayer(dt) {
    const p = player;
    p.invuln = Math.max(0, p.invuln - dt);

    if (p.burrow) return updateBurrow(dt);

    let dir = (held("right") ? 1 : 0) - (held("left") ? 1 : 0);
    const lit = inLight(p);

    const spec = specOf(p.form);
    const hosted = p.form !== "parasite";

    // Instinct: below half SELF the host sometimes moves on its own. In light
    // the beetle panics regardless; the rat's hunger pulls it toward bait.
    if (hosted) {
      instinct.next -= dt * (self < 50 ? 1 : 0);
      if (instinct.next <= 0) {
        instinct.t = rand(0.4, 0.9);
        instinct.dir = pick([-1, 1]);
        instinct.next = lerp(3, 9, self / 50);
        whisper(pick(spec.urges), { near: true });
      }
      if (instinct.t > 0) {
        instinct.t -= dt;
        dir = instinct.dir;
      }
    }
    // The man fights back: now and then he surfaces, and the body is his
    if (p.form === "man" && !intro) {
      struggle.next -= dt;
      if (struggle.next <= 0 && struggle.t <= 0) {
        struggle.t = 2.6;
        struggle.next = rand(14, 24) * (0.4 + self / 100);
        shake = 6;
        audio.squelch();
        whisper(pick(memoriesOf("man")), { x: camera.x + camera.w * rand(0.3, 0.6), y: camera.y + camera.h * 0.3, peak: 0.75, dur: 4 });
      }
    }
    if (struggle.t > 0) {
      struggle.t -= dt;
      if (p.form === "man") dir = -dir || (Math.sin(time * 2) > 0 ? 1 : -1);
    }

    p.pull = 0;
    if (p.form === "rat" || (hosted && has("hungry"))) {
      const bait = baits.find((b) => !b.eaten && Math.abs(b.x - (p.x + p.w / 2)) < 6 * T && Math.abs(b.y - (p.y + p.h)) < 2 * T);
      if (bait) {
        p.pull = Math.sign(bait.x - (p.x + p.w / 2)) * lerp(150, 45, clamp(self / 100, 0, 1)) * (p.form === "rat" ? 1 : 0.6);
        if (Math.random() < dt * 0.5) whisper(pick(["food. there's food", "it smells so good", "the rat wants it"]), { near: true });
      }
    }
    // The crow is terrified of the man with the sprayer
    let fear = 0;
    if (p.form === "crow") {
      for (const ex of exterminators) {
        const d = Math.hypot(ex.x - p.x, ex.y - p.y);
        if (d < 5 * T) fear = Math.max(fear, 1 - d / (5 * T));
      }
    }

    // Light, carried over from the beetle and the moth
    const lamplit = lit || inLamplight(p);
    if (hosted && p.form !== "beetle" && has("lightshy") && lamplit) {
      const lp = nearestLight(p, 8 * T);
      if (lp) p.x -= Math.sign(lp.x - (p.x + p.w / 2)) * 40 * dt;
    }
    if (hosted && p.form !== "moth" && has("lightdrawn")) {
      const lp = nearestLight(p, 5 * T);
      if (lp && !lamplit) p.x += Math.sign(lp.x - (p.x + p.w / 2)) * 35 * dt;
    }

    if (p.form === "parasite") updateParasite(p, dir, dt);
    else if (spec.move === "climber") updateBeetle(p, dir, lit, dt);
    else if (spec.move === "flyer") updateFlyer(p, spec, dir, dt);
    else if (spec.move === "runner") updateRunner(p, spec, dir, dt);
    else updateWalker(p, spec, dir, dt);

    // Hazards
    if (touchesTile(p, "~")) hurt("poison");
    if (touchesSpikes(p)) hurt("spikes");
    for (const n of nozzles) if (n.spraying && overlap(p, sprayRect(n))) hurt("poison");
    for (const sp of spiders) if (overlap(p, spiderBox(sp))) hurt("spider", sp);
    if (flood && flood.active && overlap(p, { x: flood.x, y: flood.y + 6, w: flood.w, h: flood.base - flood.y })) hurt("poison");
    for (const a of ants) if (overlap(p, a)) hurt("ant", a);
    for (const c of cats) if (c.state !== "sit" && c.state !== "hiss" && c.state !== "flee" && overlap(p, c)) { hurt("cat", c); c.state = "sit"; c.t = 0; }
    for (const ex of exterminators) if (ex.state === "spray" && inSpray(ex, p)) hurt("spray", ex);
    for (const tr of traps) if (tr.state === "sprung" && tr.t > 2.45 && overlap(p, { x: tr.x - 2, y: tr.y - 18, w: tr.w + 4, h: 26 })) hurt("trap", tr);
    for (const b of baits) {
      if (!b.eaten && overlap(p, { x: b.x - 8, y: b.y - 8, w: 16, h: 12 })) {
        if (p.form === "rat") { b.eaten = true; whisper("it ate the bait. oh no.", { near: true, peak: 0.5 }); }
        hurt("poison");
      }
    }
    for (const f of fogs) if (f.fade > 0.4 && overlap(p, f)) hurt("gas");
    if (player !== p || state !== "play") return;

    // Water
    const wet = touchesTile(p, "w");

    // Self & moisture
    // The chapter card pauses the meters, not your hands
    if (dir || held("jump") || held("up") || tapped("burrow") || tapped("leave")) endIntro();
    if (!intro && hosted) {
      const shy = has("lightshy") && p.form !== "beetle" && lamplit ? 1.5 : 0;
      const restless = has("skyward") && p.form !== "crow" && p.mode === "ground" ? 0.3 : 0;
      self -= (gentle(spec.drain) + (lit && p.form === "beetle" ? SELF_DRAIN_LIGHT : 0) + fear * 3 + shy + restless) * dt;
      // Wear one kind of body long enough and something of it stays
      wornTime[p.form] = (wornTime[p.form] || 0) + dt;
      if (wornTime[p.form] > TRAIT_TIME && TRAITS[p.form] && !traits.has(TRAITS[p.form].id)) gainTrait(p.form);
      moisture = Math.min(100, moisture + 30 * dt);
    } else if (!intro) {
      self = Math.min(100, self + SELF_REGEN_FREE * dt);
      moisture += (wet ? MOISTURE_WATER : -gentle(MOISTURE_DRAIN) * (lit ? 3 : 1)) * dt;
      moisture = Math.min(100, moisture);
    }
    if ((lit && p.form === "beetle") || fear > 0.3) if (Math.random() < dt * 3) shake = Math.max(shake, 2);
    if (self <= 0) return die("self");
    if (moisture <= 0) return die("dried");

    // Possession & interaction
    if (!hosted) {
      const near = nearbyBeetle(p);
      setPrompt(near ? "<b>E</b> burrow in" : "");
      if (near && tapped("burrow")) startBurrow(near);
    } else {
      const thing = nearbyUrge(p) || (p.form === "man" ? nearbyInteractable(p) : null);
      setPrompt(thing ? thing.label : "");
      if (thing && tapped("burrow")) thing.use();
      if (tapped("leave")) leaveHost(false);
    }

    // Pickups & zones
    for (const s of shards) {
      if (!s.taken && Math.hypot(s.x - (p.x + p.w / 2), s.y - (p.y + p.h / 2)) < (p.form === "man" ? 34 : 22)) takeShard(s);
    }
    for (const k of keyItems) {
      if (!k.taken && p.form === "man" && Math.hypot(k.x - (p.x + p.w / 2), k.y - (p.y + p.h / 2)) < 36) {
        k.taken = true;
        heldKeys.add(k.id);
        audio.chime();
        whisper("his keys. your hand already knows which one is which.", { near: true, peak: 0.5 });
        updateHostUI();
      }
    }
    for (const c of checkpoints) if (!c.active && overlap(p, c)) activateCheckpoint(c);
    if (p.form === "man") for (const m of mirrors) if (overlap(p, m)) return ending();
    if (exitZone && overlap(p, exitZone)) win();
    if (p.y > WORLD_H + 40) win();
  }

  // Something the host craves. Giving in helps the body and costs you.
  function nearbyUrge(p) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    const u = urges.find((o) => !o.used && o.host === p.form && Math.abs(o.x - cx) < T * 1.3 && Math.abs(o.y - cy) < T * 1.8);
    if (!u) return null;
    return { label: `<b>E</b> ${u.label}`, use: () => giveIn(u) };
  }

  function giveIn(u) {
    u.used = true;
    usedUrges.add(u.id);
    self = Math.max(1, self - u.cost);
    const p = player;
    if (u.effect === "heal") p.hp = Math.min(maxHp(p.form), p.hp + 1);
    if (u.effect === "wings") { p.stamina = 1; p.hp = Math.min(maxHp(p.form), p.hp + 1); }
    const j = loadJourney();
    j.gaveIn = (j.gaveIn || 0) + 1;
    if (u.effect === "lena") j.lena = true;
    saveJourney(j);
    audio.squelch();
    shake = 4;
    burst(u.x, u.y - 6, 18, specOf(p.form).glow, 80);
    whisper(u.text, { near: true, peak: 0.6 });
    updateHostUI();
  }

  function gainTrait(kind) {
    const t = TRAITS[kind];
    traits.add(t.id);
    const j = loadJourney();
    j.traits = [...new Set([...(j.traits || []), t.id])];
    saveJourney(j);
    audio.chime();
    whisper(t.gain, { x: camera.x + camera.w * 0.2, y: camera.y + camera.h * 0.25, own: true, peak: 0.85, dur: 7 });
    updateHostUI();
  }

  let promptHTML = "";
  function setPrompt(html) {
    if (html === promptHTML) return;
    promptHTML = html;
    if (html) ui.prompt.innerHTML = html;
    ui.prompt.classList.toggle("show", !!html);
  }

  function touchesSpikes(b) {
    // Spikes only bite at the top of their tile
    const x0 = Math.floor(b.x / T), x1 = Math.floor((b.x + b.w - 0.01) / T);
    const y0 = Math.floor(b.y / T), y1 = Math.floor((b.y + b.h - 0.01) / T);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      if (tileAt(cx, cy) === "^" && b.y + b.h > cy * T + 14) return true;
    }
    return false;
  }

  // Doors, valves: the things only hands can work
  function nearbyInteractable(p) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    for (const d of doors) {
      if (d.open || Math.abs(d.x + T / 2 - cx) > T * 1.9 || Math.abs(d.y + T - cy) > T * 1.5) continue;
      const locked = d.lock && !heldKeys.has(d.lock);
      return { label: locked ? "locked" : "<b>E</b> open", use: () => openDoor(d) };
    }
    for (const v of valves) {
      if (v.closed || Math.hypot(v.x - cx, v.y - cy) > T * 1.5) continue;
      return { label: "<b>E</b> shut the valve", use: () => closeValve(v) };
    }
    return null;
  }

  function openDoor(d) {
    if (d.lock && !heldKeys.has(d.lock)) {
      audio.hit();
      whisper("locked. where does he keep the keys?", { near: true, peak: 0.5 });
      return;
    }
    d.open = true;
    tiles[d.cy][d.cx] = ".";
    tiles[d.cy - 1][d.cx] = ".";
    audio.jump();
    burst(d.x + T / 2, d.y + T, 10, "#cfe9ff", 60);
  }

  function closeValve(v) {
    v.closed = true;
    audio.chime();
    shake = 4;
    syncFog(false);
    const left = valves.filter((o) => !o.closed).length;
    whisper(left ? `${left} more` : "the hissing stops. the house is quiet.", { near: true, peak: 0.55 });
  }

  function updateParasite(p, dir, dt) {
    const c = contacts(p, "parasite");
    const wet = touchesTile(p, "w");
    const speed = PARASITE.speed * (wet ? 0.7 : 1);
    p.vx = lerp(p.vx, dir * speed, Math.min(1, dt * (c.ground ? 14 : 5)));
    if (dir) p.facing = dir;
    if (c.ground && (tapped("jump") || tapped("up"))) {
      p.vy = -PARASITE.jump * (wet ? 0.8 : 1) * jumpMul();
      audio.hop();
    }
    p.vy = Math.min(MAX_FALL * (wet ? 0.25 : 1), p.vy + GRAVITY * (wet ? 0.35 : 1) * dt);
    moveBody(p, "parasite", dt);
    if (c.ground && !p.wasGround && p.vy >= 0) audio.land();
    p.wasGround = c.ground;
    p.walk += Math.abs(p.vx) * dt * 0.25;
    p.mode = c.ground ? "ground" : "air";
  }

  function updateBeetle(p, dir, lit, dt) {
    const S = specOf(p.form);
    let c = contacts(p, p.form);
    const up = held("up"), down = held("down") || tapped("down");

    // Panic in the light: the body tries to flee toward the nearest shadow
    let panic = 0;
    if (lit) {
      const beam = beams.find((b) => overlap(p, b));
      const center = beam.x + beam.w / 2;
      panic = (p.x + p.w / 2 < center ? -1 : 1) * 95;
    }

    switch (p.mode) {
      case "ceil": {
        if (!c.ceil) { p.mode = "air"; break; }
        // In a corner, ↓ walks you down the wall; anywhere else it lets go
        const corner = c.left && (dir < 0 || p.facing < 0) ? -1 : c.right && (dir > 0 || p.facing > 0) ? 1 : 0;
        if (down && corner) { p.mode = "wall"; p.side = corner; p.climbDir = 1; break; }
        if (down || tapped("jump")) { p.mode = "air"; p.vy = 40; break; }
        p.vx = dir * S.climb * 1.1 + panic * 0.5;
        p.vy = -20;
        if (dir) p.facing = dir;
        break;
      }
      case "wall": {
        const touching = p.side < 0 ? c.left : c.right;
        if (!touching) {
          // Climbed past the edge — hop over the lip onto the top
          if (p.climbDir < 0) { p.vy = -260; p.vx = p.side * 140; }
          p.mode = "air";
          break;
        }
        if (tapped("jump")) {
          p.mode = "air"; p.vx = -p.side * 220; p.vy = -S.jump * jumpMul() * 0.8; p.facing = -p.side;
          audio.jump();
          break;
        }
        if (dir === -p.side && !up && !down) {
          // Pushing away from the wall: onto the ceiling if there is one, else let go
          if (c.ceil) { p.mode = "ceil"; p.facing = dir; }
          else { p.mode = "air"; p.vx = dir * 60; }
          break;
        }
        let climb = 0;
        if (up || dir === p.side) climb = -1;
        if (down) climb = 1;
        if (climb) p.climbDir = climb;
        p.vy = climb * S.climb + (lit ? 30 : 0);
        p.vx = p.side * 30;
        if (climb < 0 && c.ceil) { p.mode = "ceil"; p.facing = -p.side; }
        if (climb > 0 && c.ground) { p.mode = "ground"; p.facing = -p.side; }
        break;
      }
      default: {
        const grounded = c.ground;
        const target = dir * S.speed * speedMul() + panic;
        p.vx = lerp(p.vx, target, Math.min(1, dt * (grounded ? 16 : 6)));
        if (dir) p.facing = dir;
        if (grounded && (tapped("jump") || tapped("up"))) {
          p.vy = -S.jump * jumpMul();
          audio.jump();
        }
        p.vy = Math.min(MAX_FALL, p.vy + GRAVITY * dt);
        if ((dir < 0 && c.left) || (dir > 0 && c.right)) { p.mode = "wall"; p.side = dir; p.climbDir = -1; p.vy = 0; }
        else if (!grounded && c.ceil && up) { p.mode = "ceil"; p.vy = 0; }
        else p.mode = grounded ? "ground" : "air";
      }
    }

    moveBody(p, p.form, dt);
    c = contacts(p, p.form);
    if (p.mode === "air" && c.ground && p.vy >= 0) { p.mode = "ground"; audio.land(); }
    if (p.mode === "air" && c.ceil && up) { p.mode = "ceil"; p.vy = 0; }
    p.walk += (Math.abs(p.vx) + Math.abs(p.vy) * (p.mode === "wall" ? 1 : 0)) * dt * 0.12;
  }

  // The crow: a hop on the ground, flaps in the air (each costs wing
  // strength, which comes back when you land), and a glide while ↑/space is held
  function updateFlyer(p, spec, dir, dt) {
    let c = contacts(p, p.form);
    const grounded = c.ground;
    if (grounded) p.stamina = Math.min(1, p.stamina + dt * 1.6);
    const target = dir * (grounded ? spec.walk : spec.speed) * speedMul();
    p.vx = lerp(p.vx, target, Math.min(1, dt * (grounded ? 12 : 3.2)));
    if (dir) p.facing = dir;
    p.flap = Math.max(0, p.flap - dt);
    if (tapped("jump") || tapped("up")) {
      if (grounded) { p.vy = -spec.jump * jumpMul(); p.flap = 0.25; audio.flap(); }
      else if (p.stamina >= (spec.flapCost || 0.08)) { p.vy = -spec.flap; p.stamina -= spec.flapCost || 0.08; p.flap = 0.25; audio.flap(); }
    }
    if (spec.lightDrawn) {
      if (!grounded) p.stamina = Math.min(1, p.stamina + dt * 0.12);
      const lp = nearestLight(p, 7 * T);
      if (lp) {
        p.vx += Math.sign(lp.x - (p.x + p.w / 2)) * 140 * dt;
        p.vy += Math.sign(lp.y - (p.y + p.h / 2)) * 160 * dt;
      }
    }
    const gliding = !grounded && p.vy > 0 && (held("jump") || held("up"));
    p.vy = Math.min(gliding ? 75 : MAX_FALL, p.vy + GRAVITY * 0.9 * dt);
    p.gliding = gliding;
    moveBody(p, p.form, dt);
    c = contacts(p, p.form);
    if (c.ground && !p.wasGround && p.vy >= 0) audio.land();
    p.wasGround = c.ground;
    p.mode = c.ground ? "ground" : "air";
    p.walk += Math.abs(p.vx) * dt * 0.1;
  }

  // The rat: fast, a big jump, kicks off walls, and gnaws through wood
  function updateRunner(p, spec, dir, dt) {
    let c = contacts(p, p.form);
    p.wallLock = Math.max(0, p.wallLock - dt);
    if (p.wallLock > 0) dir = Math.sign(p.vx) || dir;
    const target = dir * spec.speed * speedMul() + p.pull;
    p.vx = lerp(p.vx, target, Math.min(1, dt * (c.ground ? 14 : 5)));
    if (dir) p.facing = dir;
    const jump = tapped("jump") || tapped("up");
    if (c.ground && jump) { p.vy = -spec.jump * jumpMul(); audio.jump(); }
    else if (spec.wallJump && !c.ground && jump && (c.left || c.right)) {
      const away = c.left ? 1 : -1;
      p.vy = -spec.jump * 0.85; p.vx = away * 260; p.facing = away; p.wallLock = 0.2;
      audio.jump();
      burst(p.x + (away > 0 ? 0 : p.w), p.y + p.h / 2, 6, "#c9b8a0", 60);
    }
    let fall = GRAVITY;
    const hugging = spec.wallJump && !c.ground && ((dir < 0 && c.left) || (dir > 0 && c.right));
    p.vy = Math.min(hugging ? 140 : MAX_FALL, p.vy + fall * dt);
    p.mode = hugging ? "wall" : c.ground ? "ground" : "air";

    // Gnaw: push into wood and it gives way
    const front = !spec.gnaw ? false : dir > 0 ? c.right : dir < 0 ? c.left : false;
    if (front) {
      const tx = Math.floor((dir > 0 ? p.x + p.w + 2 : p.x - 2) / T);
      const ty = Math.floor((p.y + p.h / 2) / T);
      if (tileAt(tx, ty) === "G") {
        p.gnaw += dt;
        if (Math.random() < dt * 25) particles.push({ x: tx * T + (dir > 0 ? 2 : T - 2), y: p.y + p.h / 2, vx: -dir * rand(30, 90), vy: rand(-80, -20), life: 0.5, max: 0.5, color: "#b08a5a", r: 1.4, grav: 500 });
        if (Math.random() < dt * 8) audio.tick();
        if (p.gnaw > 0.75) {
          tiles[ty][tx] = ".";
          p.gnaw = 0;
          burst(tx * T + T / 2, ty * T + T / 2, 16, "#b08a5a", 90);
          audio.land();
        }
      } else p.gnaw = 0;
    } else p.gnaw = 0;

    // Stop over a one-tile hole and the rat slips into it
    if (c.ground && (!dir || held("down"))) {
      const hx = Math.floor((p.x + p.w / 2) / T), hy = Math.floor((p.y + p.h + 2) / T);
      if (!isSolid(tileAt(hx, hy), p.form) && isSolid(tileAt(hx - 1, hy), p.form) && isSolid(tileAt(hx + 1, hy), p.form)) {
        p.vx = (hx * T + T / 2 - (p.x + p.w / 2)) * 10;
      }
    }

    moveBody(p, p.form, dt);
    c = contacts(p, p.form);
    if (c.ground && !p.wasGround && p.vy >= 0) audio.land();
    p.wasGround = c.ground;
    if (c.ground) p.mode = "ground";
    p.walk += Math.abs(p.vx) * dt * 0.18;
  }

  // The man: heavy, slow, too big for the walls — but he has hands
  function updateWalker(p, spec, dir, dt) {
    let c = contacts(p, p.form);
    p.vx = lerp(p.vx, dir * spec.speed * speedMul() + p.pull, Math.min(1, dt * (c.ground ? 10 : 4)));
    if (dir) p.facing = dir;
    if (c.ground && (tapped("jump") || tapped("up"))) { p.vy = -spec.jump * jumpMul(); audio.land(); }
    p.vy = Math.min(MAX_FALL, p.vy + GRAVITY * dt);
    moveBody(p, p.form, dt);
    c = contacts(p, p.form);
    if (c.ground && !p.wasGround && p.vy >= 0) audio.land();
    p.wasGround = c.ground;
    p.mode = c.ground ? "ground" : "air";
    p.walk += Math.abs(p.vx) * dt * 0.09;
  }

  function nearbyBeetle(p) {
    const reach = { x: p.x - 26, y: p.y - 14, w: p.w + 52, h: p.h + 28 };
    return beetles.find((b) => b.state === "asleep" && overlap(reach, b));
  }

  function startBurrow(b) {
    player.burrow = { target: b, t: 0, from: { x: player.x, y: player.y } };
    player.vx = player.vy = 0;
    audio.squelch();
  }

  function updateBurrow(dt) {
    const p = player, br = p.burrow;
    br.t += dt / 0.7;
    const tx = br.target.x + br.target.w / 2 - p.w / 2, ty = br.target.y + br.target.h / 2 - p.h / 2;
    p.x = lerp(br.from.x, tx, Math.min(1, br.t * 1.4));
    p.y = lerp(br.from.y, ty, Math.min(1, br.t * 1.4)) - Math.sin(Math.min(1, br.t * 1.4) * Math.PI) * 14;
    if (Math.random() < 0.6) burst(p.x + p.w / 2, p.y + p.h / 2, 1, "#ff4d6d", 40);
    if (br.t < 1) return;

    // Take the body
    const b = br.target;
    beetles.splice(beetles.indexOf(b), 1);
    const spec = HOSTS[b.kind];
    // It stands up around you: same feet, centred on where it lay
    let nx = b.x + b.w / 2 - spec.w / 2, ny = b.y + b.h - spec.h - 0.01;
    for (let i = 0; i < 3 && collides(nx, ny, spec.w, spec.h, b.kind); i++) ny -= T / 2;
    const np = makePlayer(b.kind, nx, ny);
    np.mode = "ground";
    np.facing = b.facing;
    player = np;
    hostsTaken++;
    moisture = 100;
    shake = 6;
    burst(b.x + b.w / 2, b.y + b.h / 2, 40, spec.glow, 160);
    burst(b.x + b.w / 2, b.y + b.h / 2, 20, "#ff4d6d", 120);
    audio.squelch();
    nextHostWhisper = 2.5;
    setTimeout(() => whisper(pick(memoriesOf(b.kind)), { near: true, peak: 0.5 }), 600);
    updateHostUI();
  }

  function leaveHost(killed) {
    const b = player;
    const tall = b.form === "man";
    // A man falls down; everything else just stops where it is
    beetles.push(tall
      ? { kind: b.form, x: b.x + b.w / 2 - b.h / 2, y: b.y + b.h - 20, w: b.h, h: 20, state: "husk", facing: b.facing, breath: 0, vy: 0, killed, lying: true }
      : { kind: b.form, x: b.x, y: b.y, w: b.w, h: b.h, state: "husk", facing: b.facing, breath: 0, vy: 0, killed });
    const p = makePlayer("parasite", b.x + (b.w - PARASITE.w) / 2, b.y + (tall ? 6 : 0));
    // Pop out — but never into a wall
    if (collides(p.x, p.y, p.w, p.h, "parasite")) p.y = b.y + b.h - p.h - 0.01;
    p.vy = -260;
    p.vx = -b.facing * 40;
    p.facing = b.facing;
    p.invuln = killed ? 1.5 : 0.4;
    player = p;
    burst(b.x + b.w / 2, b.y + b.h / 2, 26, "#ff4d6d", 120);
    audio.squelch();
    if (!killed) whisper("you pull yourself out. it's cold.", { near: true, peak: 0.45 });
    updateHostUI();
  }

  function hurt(kind, source) {
    const p = player;
    if (p.invuln > 0 || state !== "play" || p.burrow) return;
    audio.hit();
    shake = 8;
    hurtFlash = 1;
    if (p.form === "parasite") return die({ poison: "poison", spider: "webbed", cat: "cat", spray: "poison", trap: "trap", gas: "gas", spikes: "spikes" }[kind] || "eaten");
    p.hp--;
    p.invuln = 1.2;
    const away = source ? Math.sign(p.x - source.x) || 1 : -p.facing;
    p.vx = away * 220;
    p.vy = -340;
    p.mode = "air";
    burst(p.x + p.w / 2, p.y + p.h / 2, 14, specOf(p.form).glow, 120);
    updateHostUI();
    if (p.hp <= 0) {
      whisper(specOf(p.form).dying, { near: true, peak: 0.5 });
      leaveHost(true);
    }
  }

  function takeShard(s) {
    s.taken = true;
    takenShards.add(s.id);
    self = Math.min(100, self + 22);
    burst(s.x, s.y, 36, "#ffd1dc", 140);
    audio.shard();
    whisper(s.memory, { x: s.x, y: s.y - 30, own: true, peak: 0.85, dur: 9 });
    updateHostUI();
  }

  function activateCheckpoint(c) {
    checkpoints.forEach((o) => { o.active = false; });
    c.active = true;
    checkpoint = {
      x: c.x, y: c.y, hosted: player.form === "parasite" ? false : player.form, self: Math.round(self),
      flags: { keys: [...heldKeys], valves: valves.filter((v) => v.closed).map((v) => v.id), doors: doors.filter((d) => d.open).map((d) => d.id) },
    };
    burst(c.x + T / 2, c.y + T / 2, 24, "#5ef2c9", 90);
    audio.chime();
    save();
  }

  // ---------------------------------------------------------------------------
  // Enemies & hazards
  // ---------------------------------------------------------------------------

  const ANT_SMELL = 4 * T;

  function updateAnts(dt) {
    const p = player;
    for (const a of ants) {
      const dx = p.x + p.w / 2 - (a.x + a.w / 2);
      const dy = p.y + p.h - (a.y + a.h);
      const smells = Math.abs(dx) < ANT_SMELL && Math.abs(dy) < 26 && !p.burrow && state === "play";
      a.alert = lerp(a.alert, smells ? 1 : 0, dt * 4);
      let speed = 55;
      if (smells) { a.dir = Math.sign(dx) || a.dir; speed = 125; }
      const nx = a.x + a.dir * speed * dt;
      const ahead = a.dir > 0 ? nx + a.w : nx;
      const blocked = collides(nx, a.y, a.w, a.h, "ant") || !collides(ahead - a.dir, a.y + a.h + 2, 1, 2, "ant");
      // Patrolling ants turn at the ends of their beat; chasing ants follow a
      // little further, then stop and wait, jaws working
      const leash = smells ? a.range + a.leash : a.range;
      if (blocked || Math.abs(nx - a.home) > leash) {
        if (!smells) a.dir *= -1;
        else speed = 0;
      } else a.x = nx;
      a.step += Math.max(speed, 30) * dt * 0.3;
    }
  }

  // Spiders wait at the ceiling and drop on anything passing beneath. They
  // tremble for a moment first; then the thread runs out, they hang, and they
  // climb slowly back up. That climb is your window.
  const spiderBox = (sp) => ({ x: sp.x - sp.w / 2, y: sp.y - sp.h / 2, w: sp.w, h: sp.h });

  function updateSpiders(dt) {
    const p = player;
    const px = p.x + p.w / 2;
    for (const sp of spiders) {
      sp.t += dt;
      sp.cooldown = Math.max(0, sp.cooldown - dt);
      switch (sp.state) {
        case "idle":
          sp.y = sp.rest + Math.sin(time * 1.6 + sp.phase) * 2;
          if (!sp.cooldown && state === "play" && !p.burrow && Math.abs(px - sp.x) < 30 && p.y + p.h > sp.rest + 10) {
            sp.state = "warn"; sp.t = 0;
            if (onScreen(sp.x)) audio.drip();
          }
          break;
        case "warn":
          if (sp.t > 0.35) { sp.state = "drop"; sp.t = 0; if (onScreen(sp.x)) audio.zip(); }
          break;
        case "drop":
          sp.y = Math.min(sp.bottom, sp.y + 460 * dt);
          if (sp.y >= sp.bottom) { sp.state = "hold"; sp.t = 0; }
          break;
        case "hold":
          if (sp.t > 0.8) { sp.state = "climb"; sp.t = 0; }
          break;
        case "climb":
          sp.y = Math.max(sp.rest, sp.y - 85 * dt);
          if (sp.y <= sp.rest) { sp.state = "idle"; sp.cooldown = 0.5; }
          break;
      }
    }
  }

  // The flush: once you're in the shaft, pesticide rises from below — slowly
  // at first, then faster
  function updateFlood(dt) {
    if (!flood) return;
    if (!flood.active) {
      if (player.x + player.w / 2 >= flood.trigger && state === "play") {
        flood.active = true;
        flood.t = 0;
        shake = 10;
        audio.rush();
        whisper("water. no — not water.", { near: true, peak: 0.5 });
      }
      return;
    }
    flood.t += dt;
    if (flood.t > 3) flood.y = Math.max(flood.top, flood.y - gentle(18 + (flood.t - 3) * 0.4) * dt);
    if (Math.random() < dt * 20) {
      particles.push({ x: flood.x + Math.random() * flood.w, y: flood.y, vx: 0, vy: -rand(20, 50), life: 0.9, max: 0.9, color: "#b8ff5a", r: rand(1, 2.2), grav: -20 });
    }
    if (flood.t < 3 && Math.random() < dt * 4) shake = Math.max(shake, 3);
  }

  const onScreen = (x) => Math.abs(x - (camera.x + camera.w / 2)) < camera.w;

  // Cats prowl, spot you, give chase, and pounce. They're too big for
  // anything one tile tall — mouse holes are safe.
  function updateCats(dt) {
    const p = player;
    for (const c of cats) {
      c.t += dt;
      const dx = p.x + p.w / 2 - (c.x + c.w / 2);
      const dy = p.y + p.h - (c.y + c.h);
      const sees = state === "play" && !p.burrow && Math.abs(dx) < 7 * T && Math.abs(dy) < 2.5 * T && Math.abs(c.x - c.home) < c.range + 6 * T;
      c.alert = lerp(c.alert, sees ? 1 : 0, dt * 3);
      const cc = contacts(c, "cat");
      let speed = 45;
      // Cats run from a dog, and from anything that smells like one
      if ((p.form === "dog" || (p.form !== "parasite" && has("loyal"))) && Math.abs(dx) < 5 * T && Math.abs(dy) < 2.5 * T) {
        if (c.state !== "flee") { c.state = "flee"; if (onScreen(c.x)) audio.hiss(); }
        c.dir = -(Math.sign(dx) || c.dir);
        if (cc.ground) c.vx = lerp(c.vx, c.dir * 200, Math.min(1, dt * 6));
        c.vy = Math.min(MAX_FALL, c.vy + GRAVITY * dt);
        moveBody(c, "cat", dt);
        if (c.hitX && cc.ground) c.vy = -480;
        c.step += Math.abs(c.vx) * dt * 0.12;
        continue;
      }
      if (c.state === "flee") { c.state = "prowl"; c.t = 0; }
      // A cat won't hunt a man. But it knows this one isn't right.
      if (p.form === "man" && Math.abs(dx) < 4 * T && Math.abs(dy) < 2 * T) {
        if (c.state !== "hiss") {
          c.state = "hiss"; c.t = 0;
          if (onScreen(c.x)) audio.hiss();
          if (!c.warned) { c.warned = true; whisper("the cat knows. it knows you aren't him.", { near: true, peak: 0.55 }); }
        }
        c.dir = Math.sign(dx) || c.dir;
        if (cc.ground) c.vx = lerp(c.vx, -c.dir * 70, Math.min(1, dt * 6));
        c.vy = Math.min(MAX_FALL, c.vy + GRAVITY * dt);
        moveBody(c, "cat", dt);
        continue;
      }
      if (c.state === "hiss") { c.state = "prowl"; c.t = 0; }
      if (c.state === "sit") {
        speed = 0;
        if (c.t > 1.4) { c.state = "prowl"; c.t = 0; }
      } else if (sees) {
        if (c.state !== "chase") { c.state = "chase"; if (onScreen(c.x)) audio.hiss(); }
        c.dir = Math.sign(dx) || c.dir;
        speed = 175;
        // Pounce when close
        if (cc.ground && Math.abs(dx) < 3 * T && Math.abs(dx) > T && c.t > 1.2) { c.vy = -430; c.vx = c.dir * 320; c.t = 0; }
      } else {
        c.state = "prowl";
        if (Math.abs(c.x - c.home) > c.range) c.dir = Math.sign(c.home - c.x) || c.dir;
      }
      if (cc.ground) c.vx = lerp(c.vx, c.dir * speed, Math.min(1, dt * 8));
      c.vy = Math.min(MAX_FALL, c.vy + GRAVITY * dt);
      moveBody(c, "cat", dt);
      // Hop up ledges; turn at walls it can't clear and at drops while prowling
      if (c.hitX && cc.ground) { if (c.state === "chase") c.vy = -480; else c.dir *= -1; }
      if (c.state === "prowl" && cc.ground && !collides(c.dir > 0 ? c.x + c.w + 2 : c.x - 3, c.y + c.h + 2, 1, 2, "cat")) c.dir *= -1;
      c.step += Math.abs(c.vx) * dt * 0.12;
    }
  }

  // The exterminator walks his beat. When he sees you he turns, raises the
  // wand, and sprays a cone of poison toward where you were.
  const SPRAY_LEN = 5.5 * T;
  function updateExterminators(dt) {
    const p = player;
    for (const ex of exterminators) {
      ex.t += dt;
      ex.cool = Math.max(0, ex.cool - dt);
      const ox = ex.x + ex.w / 2, oy = ex.y + 22;
      const dx = p.x + p.w / 2 - ox, dy = p.y + p.h / 2 - oy;
      const sees = state === "play" && Math.abs(dx) < 7 * T && dy > -6 * T && dy < 3 * T;
      switch (ex.state) {
        case "walk": {
          const nx = ex.x + ex.dir * 50 * dt;
          const blocked = collides(nx, ex.y, ex.w, ex.h, "man") || !collides(ex.dir > 0 ? nx + ex.w : nx - 1, ex.y + ex.h + 2, 1, 2, "man");
          if (blocked || Math.abs(nx - ex.home) > ex.range) ex.dir *= -1; else ex.x = nx;
          ex.step += 50 * dt * 0.09;
          if (sees && !ex.cool) { ex.state = "aim"; ex.t = 0; ex.dir = Math.sign(dx) || ex.dir; }
          break;
        }
        case "aim":
          ex.dir = Math.sign(dx) || ex.dir;
          // Aim at you, but he can't spray behind himself or straight up
          ex.aim = clamp(Math.atan2(dy, Math.abs(dx)), -1.2, 0.45);
          if (ex.t > 0.55) { ex.state = "spray"; ex.t = 0; if (onScreen(ex.x)) audio.spray(); }
          break;
        case "spray":
          if (!reduceMotion) for (let i = 0; i < 5; i++) {
            const a = ex.aim + rand(-0.22, 0.22), sp = rand(200, 330);
            particles.push({ x: ox + ex.dir * 18, y: oy, vx: Math.cos(a) * sp * ex.dir, vy: Math.sin(a) * sp, life: rand(0.5, 0.8), max: 0.8, color: "#b8ff5a", r: rand(3, 6), grav: 60, mist: true });
          }
          if (ex.t > 1.4) { ex.state = "walk"; ex.t = 0; ex.cool = 1.8; }
          break;
      }
    }
  }
  function inSpray(ex, p) {
    const ox = ex.x + ex.w / 2 + ex.dir * 18, oy = ex.y + 22;
    const px = p.x + p.w / 2, py = p.y + p.h / 2;
    const dx = (px - ox) * ex.dir, dy = py - oy;
    const d = Math.hypot(dx, dy);
    if (d > SPRAY_LEN || dx < 0) return false;
    return Math.abs(Math.atan2(dy, dx) - ex.aim) < 0.32 + 12 / Math.max(d, 1);
  }

  function updateTraps(dt) {
    const p = player;
    for (const tr of traps) {
      tr.t -= dt;
      if (tr.state === "set" && state === "play" && overlap(p, { x: tr.x - 4, y: tr.y - 14, w: tr.w + 8, h: 22 })) {
        tr.state = "snap"; tr.t = 0.14;
      } else if (tr.state === "snap" && tr.t <= 0) {
        if (onScreen(tr.x)) audio.snap();
        tr.state = "sprung"; tr.t = 2.6;
        burst(tr.x + tr.w / 2, tr.y, 8, "#d8d0c0", 80);
      } else if (tr.state === "sprung" && tr.t <= 0) tr.state = "set";
    }
  }

  function updateFog(dt) {
    for (const f of fogs) f.fade = clamp(f.fade + (f.on ? 1 : -1) * dt * 0.8, 0, 1);
    for (const v of valves) if (v.closed) v.turn = Math.min(1, v.turn + dt * 2);
  }

  const NOZZLE_PERIOD = 4.4;
  function sprayRect(n) {
    return { x: n.x - T * 1.2, y: n.y + 14, w: T * 2.4, h: n.bottom - n.y - 14 };
  }

  function updateNozzles(dt) {
    for (const n of nozzles) {
      const t = (time + n.phase) % NOZZLE_PERIOD;
      const phase = t < 2.2 ? "idle" : t < 3.1 ? "warn" : "spray";
      n.spraying = phase === "spray";
      n.warning = phase === "warn";
      const onScreen = Math.abs(n.x - (camera.x + camera.w / 2)) < camera.w;
      if (phase !== n.was && onScreen) {
        if (phase === "spray") audio.spray();
        if (phase === "warn") audio.drip();
      }
      n.was = phase;
      if (n.warning && Math.random() < dt * 8) {
        particles.push({ x: n.x + rand(-3, 3), y: n.y + 16, vx: 0, vy: 60, life: 1.4, max: 1.4, color: "#a6ff4d", r: 1.6, grav: 600, solid: true });
      }
      if (n.spraying && !reduceMotion) {
        for (let i = 0; i < 6; i++) {
          particles.push({ x: n.x + rand(-4, 4), y: n.y + 16, vx: rand(-60, 60), vy: rand(160, 320), life: rand(0.5, 1), max: 1, color: Math.random() < 0.5 ? "#b8ff5a" : "#6fdc3c", r: rand(2, 5), grav: 120, mist: true });
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Particles
  // ---------------------------------------------------------------------------

  function burst(x, y, n, color, speed) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, s = rand(0.2, 1) * speed;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: rand(0.5, 1.1), max: 1.1, color, r: rand(1, 2.6), grav: 300 });
    }
  }

  function updateHusks(dt) {
    for (const b of beetles) {
      if (b.state !== "husk") continue;
      b.vx = 0;
      b.vy = Math.min(MAX_FALL, (b.vy || 0) + GRAVITY * dt);
      moveBody(b, "beetle", dt);
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const q = particles[i];
      q.life -= dt;
      if (q.life <= 0) { particles.splice(i, 1); continue; }
      q.vy += q.grav * dt;
      q.vx *= 1 - dt * 1.5;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      if (q.solid && isSolid(tileAt(Math.floor(q.x / T), Math.floor(q.y / T)), "beetle")) q.life = Math.min(q.life, 0.15);
      if (q.mist) q.r += dt * 10;
    }
  }

  // ---------------------------------------------------------------------------
  // Camera
  // ---------------------------------------------------------------------------

  let VW = 0, VH = 0, DPR = 1, scale = 1;
  const camera = { x: 0, y: 0, w: 0, h: 0, snap: true, look: 0 };

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    VW = window.innerWidth;
    VH = window.innerHeight;
    for (const c of [canvas, shadeCanvas]) {
      c.width = Math.round(VW * DPR);
      c.height = Math.round(VH * DPR);
    }
    canvas.style.width = `${VW}px`;
    canvas.style.height = `${VH}px`;
    // Landscape shows ~13 rows; an upright phone shows ~10 tiles across
    scale = VH > VW ? VW / (10 * T) : clamp(Math.min(VH / (13 * T), VW / (16 * T)), 0.85, 2.6);
    scale = Math.max(scale, VH / WORLD_H, VW / WORLD_W);
    camera.w = VW / scale;
    camera.h = VH / scale;
    camera.snap = true;
  }

  function updateCamera(dt) {
    const p = player;
    camera.look = lerp(camera.look, p.facing * 50, dt * 1.5);
    const tx = clamp(p.x + p.w / 2 + camera.look - camera.w / 2, 0, Math.max(0, WORLD_W - camera.w));
    const ty = clamp(p.y + p.h / 2 - camera.h * 0.55, 0, Math.max(0, WORLD_H - camera.h));
    if (camera.snap) { camera.x = tx; camera.y = ty; camera.snap = false; }
    camera.x = lerp(camera.x, tx, Math.min(1, dt * 5));
    camera.y = lerp(camera.y, ty, Math.min(1, dt * 4));
  }

  // ---------------------------------------------------------------------------
  // Drawing — world
  // ---------------------------------------------------------------------------

  // Far background: hanging roots and dust, drawn in screen space with parallax
  const bgRoots = Array.from({ length: 34 }, (_, i) => ({
    x: i * 260 + rand(-80, 80), len: rand(0.25, 0.75), sway: Math.random() * TAU, w: rand(1, 3.5),
  }));
  const dust = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), z: rand(0.2, 1), p: Math.random() * TAU }));

  // The city at night: sky, moon, two layers of skyline, a little rain
  const skyline = [0.25, 0.45].map((depth, li) => Array.from({ length: 40 }, (_, i) => ({
    x: i * 90 + hash(i, li) * 40, w: 50 + hash(li, i) * 60, h: 0.25 + hash(i * 3, li) * (li ? 0.35 : 0.5), depth,
    lit: Array.from({ length: 14 }, (_, k) => hash(i * 7 + k, li * 13) > 0.72),
  })));
  const rain = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), s: rand(0.6, 1) }));

  function drawCityBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, "#0a0d1c"); g.addColorStop(0.6, "#171428"); g.addColorStop(1, "#24182a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VW, VH);
    const mx = VW * 0.78 - camera.x * scale * 0.02, my = VH * 0.16;
    const mg = ctx.createRadialGradient(mx, my, 0, mx, my, 160);
    mg.addColorStop(0, "rgba(230,225,210,0.25)"); mg.addColorStop(1, "rgba(230,225,210,0)");
    ctx.fillStyle = mg; ctx.fillRect(mx - 160, my - 160, 320, 320);
    ctx.fillStyle = "#e8e2d0"; ctx.beginPath(); ctx.arc(mx, my, 26, 0, TAU); ctx.fill();
    for (const layer of skyline) {
      const span = 40 * 90;
      for (const b of layer) {
        const x = ((b.x * scale - camera.x * scale * b.depth) % (span * scale) + span * scale) % (span * scale) - 60;
        if (x > VW || x + b.w * scale < 0) continue;
        const top = VH - b.h * VH - (b.depth > 0.3 ? 0 : 40);
        ctx.fillStyle = b.depth > 0.3 ? "#120f1a" : "#1a1524";
        ctx.fillRect(x, top, b.w * scale, VH - top);
        ctx.fillStyle = "rgba(255,210,140,0.35)";
        b.lit.forEach((on, k) => { if (on) ctx.fillRect(x + 6 + (k % 3) * (b.w * scale / 3.4), top + 10 + Math.floor(k / 3) * 22, 5, 8); });
      }
    }
    ctx.strokeStyle = "rgba(180,190,230,0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const r of rain) {
      const x = ((r.x * VW - time * 40 * r.s) % VW + VW) % VW;
      const y = ((r.y * VH + time * 520 * r.s) % VH);
      ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 12 * r.s);
    }
    ctx.stroke();
  }

  // Inside the walls of a house: dark cavity, studs, dust
  function drawHouseBackground() {
    ctx.fillStyle = "#0d0a0a";
    ctx.fillRect(0, 0, VW, VH);
    const off = camera.x * scale * 0.6;
    ctx.fillStyle = "rgba(60,40,28,0.35)";
    for (let i = -1; i < VW / 120 + 2; i++) {
      const x = i * 120 - (off % 120);
      ctx.fillRect(x, 0, 18 * scale * 0.5, VH);
    }
    for (const d of dust) {
      const x = ((d.x * VW - camera.x * scale * d.z * 0.5) % VW + VW) % VW;
      const y = ((d.y * VH - camera.y * scale * d.z * 0.5 + time * 4 * d.z) % VH + VH) % VH;
      ctx.fillStyle = `rgba(230,210,180,${0.05 + 0.12 * d.z})`;
      ctx.fillRect(x, y, 1.2, 1.2);
    }
  }

  function drawBackground() {
    if (THEME === "city") return drawCityBackground();
    if (THEME === "house") return drawHouseBackground();
    const g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, "#120a12");
    g.addColorStop(0.6, "#0b0710");
    g.addColorStop(1, "#060408");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VW, VH);

    // Distant roots
    ctx.strokeStyle = "rgba(60,25,40,0.5)";
    ctx.lineCap = "round";
    const off = camera.x * scale * 0.3;
    for (const r of bgRoots) {
      const x = ((r.x - off) % (bgRoots.length * 260) + bgRoots.length * 260) % (bgRoots.length * 260) - 130;
      if (x < -60 || x > VW + 60) continue;
      ctx.lineWidth = r.w * scale * 0.6;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      const len = VH * r.len;
      ctx.bezierCurveTo(x + Math.sin(time * 0.3 + r.sway) * 20, len * 0.4, x - 30, len * 0.7, x + Math.sin(time * 0.2 + r.sway) * 14, len);
      ctx.stroke();
    }
    // Dust
    for (const d of dust) {
      const x = ((d.x * VW - camera.x * scale * d.z * 0.5) % VW + VW) % VW;
      const y = ((d.y * VH - camera.y * scale * d.z * 0.5 - time * 6 * d.z) % VH + VH) % VH;
      ctx.fillStyle = `rgba(94,242,201,${0.08 + 0.18 * d.z * (0.5 + 0.5 * Math.sin(time + d.p))})`;
      ctx.beginPath();
      ctx.arc(x, y, d.z * 1.6 * scale * 0.6, 0, TAU);
      ctx.fill();
    }
  }

  // ---- Surfaces: big seamless textures painted once, sampled per tile -------
  //
  // Each surface is an 8×8-tile canvas that wraps at its edges, so pebbles and
  // cobbles cross tile boundaries and no grid shows. A tile draws the piece of
  // the surface that lies under it.

  const TEX_RES = 2;
  const SURF_TILES = 8;
  const SURF = SURF_TILES * T;
  const surfaces = new Map();
  const seeded = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  function surface(kind) {
    if (surfaces.has(kind)) return surfaces.get(kind);
    const c = document.createElement("canvas");
    c.width = c.height = SURF * TEX_RES;
    const g = c.getContext("2d");
    g.scale(TEX_RES, TEX_RES);
    const r = seeded(kind.length * 7919 + 17);
    if (kind === "soil") paintSoil(g, r); else paintCobbles(g, r, kind === "cobbleCity");
    surfaces.set(kind, c);
    return c;
  }

  // Draw something at (x, y) and again wherever it wraps past an edge
  function wrapped(g, x, y, reach, draw) {
    for (const ox of [-SURF, 0, SURF]) for (const oy of [-SURF, 0, SURF]) {
      if (x + ox + reach < 0 || x + ox - reach > SURF || y + oy + reach < 0 || y + oy - reach > SURF) continue;
      g.save(); g.translate(ox, oy); draw(); g.restore();
    }
  }

  // Packed earth: dark loam, soft mottling, grains, a few half-buried stones,
  // old root fibres
  function paintSoil(g, r) {
    g.fillStyle = "#211419";
    g.fillRect(0, 0, SURF, SURF);
    for (let i = 0; i < 900; i++) {
      const x = r() * SURF, y = r() * SURF, s = 2 + r() * 9, dark = r() < 0.55;
      g.fillStyle = dark ? `rgba(10,5,8,${0.08 + r() * 0.16})` : `rgba(70,42,50,${0.06 + r() * 0.14})`;
      wrapped(g, x, y, s, () => { g.beginPath(); g.ellipse(x, y, s, s * (0.4 + r() * 0.5), r() * 3, 0, TAU); g.fill(); });
    }
    for (let i = 0; i < 2600; i++) {
      const v = r();
      g.fillStyle = v < 0.6 ? `rgba(105,75,80,${0.18 + r() * 0.25})` : v < 0.9 ? `rgba(8,4,6,${0.3 + r() * 0.3})` : `rgba(150,120,100,${0.2 + r() * 0.25})`;
      g.fillRect(r() * SURF, r() * SURF, 0.6 + r() * 0.6, 0.6 + r() * 0.6);
    }
    for (let i = 0; i < 26; i++) {
      const x = r() * SURF, y0 = r() * SURF, len = 30 + r() * 80;
      g.strokeStyle = `rgba(95,60,45,${0.18 + r() * 0.2})`;
      g.lineWidth = 0.5 + r() * 0.9;
      const c1 = (r() - 0.5) * 30, c2 = (r() - 0.5) * 30, dy = (r() - 0.5) * 30;
      wrapped(g, x + len / 2, y0, len, () => { g.beginPath(); g.moveTo(x, y0); g.bezierCurveTo(x + len * 0.3, y0 + c1, x + len * 0.7, y0 + c2, x + len, y0 + dy); g.stroke(); });
    }
    for (let i = 0; i < 55; i++) {
      const x = r() * SURF, y = r() * SURF, rx = 1.2 + r() * 3.2, ry = rx * (0.5 + r() * 0.35), a = r() * Math.PI;
      const tone = 34 + r() * 30, warm = r() * 12;
      wrapped(g, x, y, rx + 2, () => {
        g.fillStyle = "rgba(0,0,0,0.5)";
        g.beginPath(); g.ellipse(x + 0.5, y + 0.8, rx, ry, a, 0, TAU); g.fill();
        const pg = g.createRadialGradient(x - rx * 0.4, y - ry * 0.6, 0, x, y, rx * 1.2);
        pg.addColorStop(0, `rgb(${tone + 30 + warm},${tone + 22},${tone + 24})`);
        pg.addColorStop(1, `rgb(${tone * 0.55 + warm},${tone * 0.45},${tone * 0.5})`);
        g.fillStyle = pg;
        g.beginPath(); g.ellipse(x, y, rx, ry, a, 0, TAU); g.fill();
      });
    }
  }

  // Cobblestones laid in courses: worn, flat-topped stones of varied size and
  // colour, dark joints between them, moss in the joints underground and a wet
  // sheen in the city
  function paintCobbles(g, r, city) {
    g.fillStyle = city ? "#0d0f14" : "#110b0e";
    g.fillRect(0, 0, SURF, SURF);
    if (!city) for (let i = 0; i < 400; i++) {
      g.fillStyle = `rgba(60,${110 + r() * 60},${80 + r() * 40},${0.08 + r() * 0.12})`;
      g.fillRect(r() * SURF, r() * SURF, 1 + r() * 2, 1 + r() * 2);
    }
    const course = 11;                         // stone height, including the joint
    for (let row = 0; row * course < SURF; row++) {
      let x = (row % 2) * 7 - r() * 6;
      const y = row * course;
      while (x < SURF) {
        const w = 11 + r() * 10;
        const h = course - 0.9 - r() * 0.6;
        const cx = x + w / 2, cy = y + course / 2 + (r() - 0.5) * 1.2;
        const palette = city
          ? [[78, 84, 98], [66, 72, 86], [92, 96, 108], [58, 62, 74]]
          : [[86, 78, 84], [96, 82, 70], [70, 66, 76], [104, 94, 92], [62, 54, 58]];
        const [cr, cg, cb] = palette[Math.floor(r() * palette.length)];
        const k = city ? 0.8 + r() * 0.35 : 0.62 + r() * 0.3;
        const pts = Array.from({ length: 10 }, (_, i) => {
          const a = (i / 10) * TAU;
          const sx = Math.cos(a), sy = Math.sin(a);
          // a squarish blob: flatter on top and bottom like a worn sett
          const sq = Math.pow(Math.abs(sx) ** 5 + Math.abs(sy) ** 5, -1 / 5);
          const rr = sq * (0.93 + r() * 0.09);
          return [cx + sx * rr * (w / 2 - 0.5), cy + sy * rr * (h / 2)];
        });
        const path = () => {
          g.beginPath();
          pts.forEach(([px, py], i) => {
            const [nx, ny] = pts[(i + 1) % pts.length];
            const mx = (px + nx) / 2, my = (py + ny) / 2;
            i ? g.quadraticCurveTo(px, py, mx, my) : g.moveTo(mx, my);
          });
          const [x0, y0] = pts[0], [x1, y1] = pts[1];
          g.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
          g.closePath();
        };
        wrapped(g, cx, cy, w, () => {
          g.save(); g.translate(0.6, 1); path(); g.fillStyle = "rgba(0,0,0,0.55)"; g.fill(); g.restore();
          const sg = g.createLinearGradient(cx, cy - h / 2, cx, cy + h / 2);
          sg.addColorStop(0, `rgb(${cr * k + 26},${cg * k + 24},${cb * k + 26})`);
          sg.addColorStop(0.45, `rgb(${cr * k},${cg * k},${cb * k})`);
          sg.addColorStop(1, `rgb(${cr * k * 0.55},${cg * k * 0.55},${cb * k * 0.6})`);
          path(); g.fillStyle = sg; g.fill();
          // worn top face
          g.fillStyle = city ? "rgba(190,205,235,0.16)" : "rgba(255,240,235,0.08)";
          g.beginPath(); g.ellipse(cx - w * 0.08, cy - h * 0.22, w * 0.3, h * 0.16, 0, 0, TAU); g.fill();
          // speckle
          for (let i = 0; i < 5; i++) {
            g.fillStyle = `rgba(0,0,0,${0.15 + r() * 0.2})`;
            g.fillRect(cx + (r() - 0.5) * w * 0.7, cy + (r() - 0.5) * h * 0.6, 0.7, 0.7);
          }
          if (r() < 0.18) {
            g.strokeStyle = "rgba(0,0,0,0.5)"; g.lineWidth = 0.45;
            g.beginPath(); g.moveTo(cx - w * 0.3, cy - h * 0.1); g.lineTo(cx, cy + h * 0.05); g.lineTo(cx + w * 0.15, cy + h * 0.35); g.stroke();
          }
        });
        x += w + 0.7 + r() * 0.5;
      }
    }
  }

  // The piece of a surface lying under tile (cx, cy)
  function drawSurface(kind, cx, cy, x, y) {
    const sx = (((cx % SURF_TILES) + SURF_TILES) % SURF_TILES) * T * TEX_RES;
    const sy = (((cy % SURF_TILES) + SURF_TILES) % SURF_TILES) * T * TEX_RES;
    ctx.drawImage(surface(kind), sx, sy, T * TEX_RES, T * TEX_RES, x, y, T + 0.5, T + 0.5);
  }

  function drawTiles() {
    const x0 = Math.max(0, Math.floor(camera.x / T) - 1), x1 = Math.min(MAP_W - 1, Math.ceil((camera.x + camera.w) / T) + 1);
    const y0 = Math.max(0, Math.floor(camera.y / T) - 1), y1 = Math.min(MAP_H - 1, Math.ceil((camera.y + camera.h) / T) + 1);
    const open = (cx, cy) => !isSolid(tileAt(cx, cy), "beetle");

    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const ch = tiles[cy][cx];
        const x = cx * T, y = cy * T;
        const h = hash(cx, cy);

        if (ch === "^") { drawSpikes(x, y); continue; }
        if ((ch === "#" && THEME !== "soil") || ch === "B" || ch === "M" || ch === "W" || ch === "G") {
          drawBuiltTile(ch, cx, cy, x, y, h, open);
          continue;
        }
        if (ch === "#") {
          drawSurface("soil", cx, cy, x, y);
          // broad shade drift so the variants don't read as a grid
          const n = valueNoise(cx * 0.3, cy * 0.3);
          ctx.fillStyle = n > 0.5 ? `rgba(80,40,50,${(n - 0.5) * 0.25})` : `rgba(0,0,0,${(0.5 - n) * 0.35})`;
          ctx.fillRect(x, y, T + 0.5, T + 0.5);
          // surface: a dark humus band, a lip of lighter earth, and pale shoots
          if (open(cx, cy - 1)) {
            ctx.fillStyle = "#1a0f14";
            ctx.fillRect(x, y, T + 0.5, 6);
            ctx.fillStyle = "#4a2b33";
            ctx.fillRect(x, y, T + 0.5, 2);
            for (let i = 0; i < 6; i++) {
              const gx = x + hash(cx * 5 + i, cy) * T;
              const gh = 2 + hash(cx, cy * 5 + i) * 8;
              const lean = (hash(i, cx) - 0.5) * 4 + Math.sin(time * 1.5 + gx * 0.1) * 0.8;
              ctx.strokeStyle = `rgba(94,242,201,${0.18 + hash(i, cy) * 0.25})`;
              ctx.lineWidth = 0.8;
              ctx.beginPath(); ctx.moveTo(gx, y + 1); ctx.quadraticCurveTo(gx + lean * 0.3, y - gh * 0.5, gx + lean, y - gh); ctx.stroke();
            }
          }
          if (open(cx, cy + 1)) {
            ctx.fillStyle = "#24131b";
            ctx.fillRect(x, y + T - 3, T + 0.5, 3);
            if (h > 0.6) {
              ctx.strokeStyle = "rgba(90,50,40,0.6)";
              ctx.lineWidth = 1;
              ctx.beginPath();
              const rx = x + h * T;
              ctx.moveTo(rx, y + T);
              ctx.quadraticCurveTo(rx + Math.sin(time + h * 9) * 3, y + T + 8, rx + 2, y + T + 6 + h * 12);
              ctx.stroke();
            }
          }
          if (open(cx - 1, cy)) { ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(x, y, 3, T); }
          if (open(cx + 1, cy)) { ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(x + T - 3, y, 3, T); }
        } else if (ch === "R") {
          drawSurface(THEME === "city" ? "cobbleCity" : "cobble", cx, cy, x, y);
          if (open(cx, cy - 1)) { ctx.fillStyle = "rgba(255,240,240,0.08)"; ctx.fillRect(x, y, T, 2); }
        } else if (ch === "=") {
          ctx.strokeStyle = "#5a3a2a";
          ctx.lineCap = "round";
          for (let i = 0; i < 4; i++) {
            ctx.lineWidth = 2 + hash(cx + i, cy) * 3;
            ctx.beginPath();
            const sy = y + hash(cx, cy + i) * T;
            ctx.moveTo(x, sy);
            ctx.bezierCurveTo(x + 10, sy + (i % 2 ? 14 : -14), x + 22, sy + (i % 2 ? -10 : 10), x + T, y + hash(cx + 1, cy + i) * T);
            ctx.stroke();
          }
          ctx.strokeStyle = "rgba(255,180,140,0.12)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, y + h * T);
          ctx.lineTo(x + T, y + (1 - h) * T);
          ctx.stroke();
        }
      }
    }
    drawLiquids(x0, x1, y0, y1);
  }

  // Each pool is drawn as one body of liquid, from its surface down to its floor
  function drawLiquids(x0, x1, y0, y1) {
    for (let cy = y0; cy <= y1; cy++) {
      let cx = x0;
      while (cx <= x1) {
        const ch = tiles[cy][cx];
        if ((ch !== "~" && ch !== "w") || tileAt(cx, cy - 1) === ch) { cx++; continue; }
        let end = cx;
        while (end + 1 < MAP_W && tiles[cy][end + 1] === ch && tileAt(end + 1, cy - 1) !== ch) end++;
        let depth = 1;
        while (tileAt(cx, cy + depth) === ch) depth++;
        const poison = ch === "~";
        const left = cx * T, right = (end + 1) * T, top = cy * T + 8, bottom = (cy + depth) * T;
        const g = ctx.createLinearGradient(0, top, 0, bottom);
        g.addColorStop(0, poison ? "rgba(130,235,70,0.42)" : "rgba(90,180,235,0.36)");
        g.addColorStop(1, poison ? "rgba(60,140,30,0.3)" : "rgba(30,90,150,0.3)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(left, bottom);
        for (let wx = left; wx <= right; wx += 4) ctx.lineTo(wx, top + Math.sin(time * 3 + wx * 0.15) * 1.5);
        ctx.lineTo(right, bottom);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = poison ? "rgba(190,255,110,0.8)" : "rgba(170,230,255,0.7)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let wx = left; wx <= right; wx += 4) {
          const wy = top + Math.sin(time * 3 + wx * 0.15) * 1.5;
          wx === left ? ctx.moveTo(wx, wy) : ctx.lineTo(wx, wy);
        }
        ctx.stroke();
        if (poison && Math.random() < 0.02 * (end - cx + 1)) {
          particles.push({ x: left + Math.random() * (right - left), y: top, vx: 0, vy: -20, life: 0.8, max: 0.8, color: "#b8ff5a", r: 1.5, grav: -10 });
        }
        cx = end + 1;
      }
    }
  }

  // Tiles of the built world: concrete, brick, metal, wood and chewable board
  function drawBuiltTile(ch, cx, cy, x, y, h, open) {
    const n = valueNoise(cx * 0.25, cy * 0.25);
    if (ch === "#" && THEME === "city") {
      drawSurface("cobbleCity", cx, cy, x, y);
      ctx.fillStyle = `rgba(0,0,0,${0.15 + (1 - n) * 0.2})`;
      ctx.fillRect(x, y, T + 0.5, T + 0.5);
      if (open(cx, cy - 1)) {
        // a rain-slick line along the top of the street
        ctx.fillStyle = `rgba(180,200,255,${0.12 + 0.06 * Math.sin(time * 2 + cx)})`;
        ctx.fillRect(x, y, T, 1.5);
      }
      return;
    }
    if (ch === "#") {
      if (THEME === "city") {
        ctx.fillStyle = "#222";
      } else {
        const v = 22 + n * 8;
        ctx.fillStyle = `rgb(${(v + 10) | 0},${(v + 2) | 0},${(v - 3) | 0})`;
      }
      ctx.fillRect(x, y, T + 0.5, T + 0.5);
      if (THEME === "house") {
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.fillRect(x + (h * 20 | 0), y, 1, T);
      } else if (h > 0.8) {
        ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x + 4, y + h * T); ctx.lineTo(x + 14, y + h * T + 6); ctx.lineTo(x + 20, y + h * T + 3); ctx.stroke();
      }
    } else if (ch === "B") {
      ctx.fillStyle = `rgb(${(70 + n * 18) | 0},${(34 + n * 8) | 0},${(32 + n * 6) | 0})`;
      ctx.fillRect(x, y, T + 0.5, T + 0.5);
      ctx.fillStyle = "rgba(20,10,10,0.55)";
      for (let r = 0; r < 4; r++) {
        ctx.fillRect(x, y + r * 8, T, 1);
        const off = ((cy * 4 + r) % 2) * 8;
        for (let c = off; c < T; c += 16) ctx.fillRect(x + c, y + r * 8, 1, 8);
      }
    } else if (ch === "M") {
      const g = ctx.createLinearGradient(x, y, x, y + T);
      g.addColorStop(0, "#4c5562"); g.addColorStop(1, "#2c323c");
      ctx.fillStyle = g;
      ctx.fillRect(x, y, T + 0.5, T + 0.5);
      ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fillRect(x, y, T, 2);
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      for (const [rx, ry] of [[4, 4], [T - 5, 4], [4, T - 5], [T - 5, T - 5]]) { ctx.beginPath(); ctx.arc(x + rx, y + ry, 1.2, 0, TAU); ctx.fill(); }
    } else if (ch === "W") {
      ctx.fillStyle = `rgb(${(84 + n * 14) | 0},${(56 + n * 8) | 0},${(36 + n * 5) | 0})`;
      ctx.fillRect(x, y, T + 0.5, T + 0.5);
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(x, y + 15, T, 1);
      ctx.fillRect(x + ((cx % 2) ? 10 : 22), y, 1, 15);
      ctx.fillStyle = "rgba(255,220,180,0.06)"; ctx.fillRect(x, y, T, 2);
    } else if (ch === "G") {
      ctx.fillStyle = "#8a6a44";
      ctx.fillRect(x, y, T + 0.5, T + 0.5);
      ctx.strokeStyle = "rgba(60,40,20,0.5)"; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 4; i < T; i += 6) { ctx.moveTo(x, y + i); ctx.lineTo(x + T, y + i - 2); }
      ctx.stroke();
      ctx.fillStyle = "rgba(255,230,190,0.12)"; ctx.fillRect(x, y, T, 2);
    }
    if (open(cx, cy - 1) && ch !== "G") { ctx.fillStyle = "rgba(255,240,220,0.07)"; ctx.fillRect(x, y, T, 3); }
    if (open(cx, cy + 1)) { ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(x, y + T - 3, T, 3); }
  }

  function drawSpikes(x, y) {
    ctx.fillStyle = "#9aa0a8";
    for (let i = 0; i < 6; i++) {
      const sx = x + 2 + i * 5;
      ctx.beginPath(); ctx.moveTo(sx, y + T); ctx.lineTo(sx + 1.5, y + 14 + (i % 2) * 3); ctx.lineTo(sx + 3, y + T); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = "#5a6068"; ctx.fillRect(x, y + T - 3, T, 3);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawBeams() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const b of beams) {
      const flick = 0.85 + 0.15 * Math.sin(time * 2 + b.x);
      const g = ctx.createLinearGradient(b.x, 0, b.x + b.w, 0);
      g.addColorStop(0, "rgba(255,240,200,0)");
      g.addColorStop(0.5, `rgba(255,236,190,${0.22 * flick})`);
      g.addColorStop(1, "rgba(255,240,200,0)");
      ctx.fillStyle = g;
      ctx.fillRect(b.x - 10, b.y, b.w + 20, b.h);
      // pool of light on the floor
      const pg = ctx.createRadialGradient(b.x + b.w / 2, b.y + b.h, 0, b.x + b.w / 2, b.y + b.h, b.w * 1.6);
      pg.addColorStop(0, `rgba(255,236,190,${0.3 * flick})`);
      pg.addColorStop(1, "rgba(255,236,190,0)");
      ctx.fillStyle = pg;
      ctx.fillRect(b.x - b.w * 1.6, b.y + b.h - b.w * 1.6, b.w * 4.2, b.w * 1.6);
      // motes
      for (let i = 0; i < 10; i++) {
        const my = b.y + ((time * 14 + i * 97) % b.h);
        const mx = b.x + b.w / 2 + Math.sin(time * 0.7 + i * 2.3) * b.w * 0.4;
        ctx.fillStyle = "rgba(255,245,220,0.5)";
        ctx.fillRect(mx, my, 1.5, 1.5);
      }
    }
    ctx.restore();
  }

  function drawCheckpoints() {
    for (const c of checkpoints) {
      const glow = c.active ? 1 : 0.35;
      const bx = c.x + T / 2, by = c.y + T;
      for (const [dx, hgt, r] of [[-7, 13, 5], [2, 19, 7], [9, 10, 4]]) {
        ctx.strokeStyle = `rgba(200,240,230,${0.4 * glow + 0.2})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bx + dx, by);
        ctx.quadraticCurveTo(bx + dx - 2, by - hgt / 2, bx + dx, by - hgt);
        ctx.stroke();
        ctx.fillStyle = `rgba(94,242,201,${0.35 + 0.6 * glow * (0.8 + 0.2 * Math.sin(time * 2 + dx))})`;
        ctx.beginPath();
        ctx.ellipse(bx + dx, by - hgt, r, r * 0.55, 0, Math.PI, 0);
        ctx.fill();
      }
    }
  }

  function drawShards() {
    for (const s of shards) {
      if (s.taken) continue;
      const bob = Math.sin(time * 2 + s.spin) * 4;
      ctx.save();
      ctx.translate(s.x, s.y + bob);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 28);
      g.addColorStop(0, "rgba(255,190,210,0.55)");
      g.addColorStop(1, "rgba(255,77,109,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 28, 0, TAU);
      ctx.fill();
      ctx.rotate(Math.sin(time + s.spin) * 0.3);
      const w = 5 + Math.abs(Math.sin(time * 1.4 + s.spin)) * 2;
      ctx.fillStyle = "#ffe3ea";
      ctx.beginPath();
      ctx.moveTo(0, -11); ctx.lineTo(w, 0); ctx.lineTo(0, 11); ctx.lineTo(-w, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,77,109,0.6)";
      ctx.beginPath();
      ctx.moveTo(0, -11); ctx.lineTo(w, 0); ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();
      for (let i = 0; i < 3; i++) {
        const a = time * 1.8 + i * TAU / 3;
        ctx.fillStyle = "rgba(255,220,230,0.8)";
        ctx.fillRect(Math.cos(a) * 16, Math.sin(a) * 6, 1.6, 1.6);
      }
      ctx.restore();
    }
  }

  function drawWebs() {
    ctx.save();
    ctx.strokeStyle = "rgba(225,220,235,0.13)";
    ctx.lineWidth = 0.7;
    for (const w of webs) {
      const spokes = 7;
      ctx.beginPath();
      for (let i = 0; i < spokes; i++) {
        const a = (i / (spokes - 1)) * Math.PI;
        ctx.moveTo(w.x, w.y);
        ctx.lineTo(w.x + Math.cos(a) * w.r, w.y + Math.sin(a) * w.r);
      }
      for (let ring = 1; ring <= 4; ring++) {
        const r = (ring / 4) * w.r;
        for (let i = 0; i < spokes; i++) {
          const a = (i / (spokes - 1)) * Math.PI;
          const sag = Math.sin(time * 0.8 + ring) * 0.6;
          const x = w.x + Math.cos(a) * r, y = w.y + Math.sin(a) * r + sag;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawCocoons() {
    for (const c of cocoons) {
      const torn = shards.some((s) => s.taken && Math.abs(s.x - c.x) < 4 && Math.abs(s.y - c.y) < 4);
      ctx.save();
      ctx.translate(c.x, c.y + 2);
      ctx.fillStyle = torn ? "rgba(200,195,210,0.25)" : "rgba(215,210,225,0.55)";
      ctx.beginPath();
      if (torn) {
        ctx.moveTo(-7, 12); ctx.quadraticCurveTo(-11, -2, -4, -10); ctx.lineTo(-1, 2);
        ctx.lineTo(2, -9); ctx.quadraticCurveTo(11, -2, 7, 12); ctx.closePath();
      } else {
        ctx.ellipse(0, 1, 8, 13, 0, 0, TAU);
      }
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      for (let i = -10; i <= 10; i += 4) { ctx.moveTo(-7, i); ctx.quadraticCurveTo(0, i + 3, 7, i - 1); }
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawSpiders() {
    for (const sp of spiders) {
      const alert = sp.state !== "idle";
      const jitter = sp.state === "warn" ? rand(-1.5, 1.5) : 0;
      const x = sp.x + jitter, y = sp.y;
      // thread
      ctx.strokeStyle = "rgba(230,225,240,0.35)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(sp.x, sp.anchor);
      ctx.lineTo(x, y - 6);
      ctx.stroke();
      // legs
      ctx.strokeStyle = "#1b1216";
      ctx.lineWidth = 1.3;
      ctx.lineCap = "round";
      const curl = sp.state === "drop" ? 0.4 : sp.state === "hold" ? -0.2 : 0;
      for (const side of [-1, 1]) {
        for (let i = 0; i < 4; i++) {
          const a = (-0.9 + i * 0.55 + curl) + Math.sin(time * 6 + i + sp.phase) * (alert ? 0.15 : 0.05);
          const kx = x + side * Math.cos(a) * 9, ky = y - 3 + Math.sin(a) * 6 - 4;
          ctx.beginPath();
          ctx.moveTo(x + side * 2, y - 3);
          ctx.lineTo(kx, ky);
          ctx.lineTo(kx + side * 4, ky + 9);
          ctx.stroke();
        }
      }
      // body
      ctx.fillStyle = "#211519";
      ctx.beginPath(); ctx.ellipse(x, y + 4, 7, 8, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = "#2c1d22";
      ctx.beginPath(); ctx.arc(x, y - 5, 4.2, 0, TAU); ctx.fill();
      // markings
      ctx.fillStyle = "rgba(210,190,150,0.35)";
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 2.5, y + 4); ctx.lineTo(x, y + 9); ctx.lineTo(x - 2.5, y + 4); ctx.closePath(); ctx.fill();
      // eyes
      ctx.fillStyle = alert ? "#ff3b4e" : "rgba(255,80,90,0.45)";
      if (alert) { ctx.shadowColor = "#ff3b4e"; ctx.shadowBlur = 6; }
      for (const ex of [-1.6, 1.6]) { ctx.beginPath(); ctx.arc(x + ex, y - 6, 0.9, 0, TAU); ctx.fill(); }
      ctx.shadowBlur = 0;
    }
  }

  function drawFlood() {
    if (!flood || !flood.active) return;
    const top = flood.y, bottom = flood.base + T, left = flood.x, right = flood.x + flood.w;
    const g = ctx.createLinearGradient(0, top, 0, bottom);
    g.addColorStop(0, "rgba(140,240,70,0.5)");
    g.addColorStop(1, "rgba(50,120,25,0.6)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(left, bottom);
    for (let x = left; x <= right; x += 6) ctx.lineTo(x, top + Math.sin(time * 4 + x * 0.08) * 3);
    ctx.lineTo(right, bottom);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(200,255,120,0.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = left; x <= right; x += 6) {
      const y = top + Math.sin(time * 4 + x * 0.08) * 3;
      x === left ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function drawNozzles() {
    for (const n of nozzles) {
      // pipe
      ctx.fillStyle = "#4b4f57";
      ctx.fillRect(n.x - 3, n.y - 4, 6, 12);
      ctx.fillStyle = "#6c7079";
      ctx.beginPath();
      ctx.moveTo(n.x - 7, n.y + 8); ctx.lineTo(n.x + 7, n.y + 8); ctx.lineTo(n.x + 4, n.y + 16); ctx.lineTo(n.x - 4, n.y + 16);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(120,60,30,0.6)";
      ctx.fillRect(n.x - 3, n.y + 2, 6, 2);
      // indicator
      const blink = n.warning ? (Math.sin(time * 30) > 0 ? 1 : 0.2) : n.spraying ? 1 : 0.15;
      ctx.fillStyle = `rgba(170,255,80,${blink})`;
      ctx.beginPath();
      ctx.arc(n.x, n.y + 11, 2, 0, TAU);
      ctx.fill();
      if (n.spraying) {
        const r = sprayRect(n);
        const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
        g.addColorStop(0, "rgba(180,255,90,0.35)");
        g.addColorStop(1, "rgba(120,220,60,0.12)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(n.x - 4, r.y);
        ctx.lineTo(n.x + 4, r.y);
        ctx.lineTo(r.x + r.w, r.y + r.h);
        ctx.lineTo(r.x, r.y + r.h);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  // A beetle in profile, head toward +x, belly toward +y
  function drawBeetle(b, opts) {
    const { possessed, husk, asleep, walk = 0, angle = 0, flipX = false, flipY = false, hurt = false, roach = false } = opts;
    ctx.save();
    ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
    ctx.rotate(angle);
    ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
    if (roach) ctx.scale(0.95, 0.68);   // a cockroach is long and flat
    ctx.translate(0, 1);
    if (husk) ctx.globalAlpha = 0.75;

    const legColor = husk ? "#3b3638" : "#0d0a0b";
    // legs
    ctx.strokeStyle = legColor;
    ctx.lineWidth = 1.6;
    ctx.lineCap = "round";
    for (const side of [0, 1]) {
      for (let i = -1; i <= 1; i++) {
        const swing = asleep || husk ? 0 : Math.sin(walk * 3 + i * 2.1 + side * Math.PI) * 3;
        const lift = asleep || husk ? 0 : Math.max(0, Math.cos(walk * 3 + i * 2.1 + side * Math.PI)) * 2;
        const bx = i * 6 + side * 1.5, by = 4;
        const fx = bx + i * 3 + swing, fy = husk ? -2 + i : 9 - lift;
        ctx.globalAlpha = (husk ? 0.75 : 1) * (side ? 1 : 0.55);
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + (fx - bx) * 0.5 + 2, husk ? 0 : by + 2);
        ctx.lineTo(fx, fy);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = husk ? 0.75 : 1;

    // shell (elytra) — iridescent dome
    const g = ctx.createLinearGradient(-12, -9, 8, 5);
    if (husk) { g.addColorStop(0, "#58524f"); g.addColorStop(1, "#2a2626"); }
    else if (roach) { g.addColorStop(0, "#a8723f"); g.addColorStop(0.5, "#5e3418"); g.addColorStop(1, "#2a140a"); }
    else {
      g.addColorStop(0, "#4f8a6c");
      g.addColorStop(0.45, "#1d3a4a");
      g.addColorStop(1, "#2b1531");
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-13, 4);
    ctx.bezierCurveTo(-14, -8, 2, -11, 8, -2);
    ctx.lineTo(8, 4);
    ctx.closePath();
    ctx.fill();
    // seam & sheen
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-11, 2);
    ctx.bezierCurveTo(-10, -5, 0, -8, 6, -2);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.ellipse(-4, -5.5, 5, 1.6, -0.25, 0, TAU);
    ctx.fill();

    // pronotum + head
    ctx.fillStyle = husk ? "#3a3434" : "#141012";
    ctx.beginPath();
    ctx.ellipse(9, 0.5, 4, 4.2, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(13.5, 1.5, 3, 2.8, 0, 0, TAU);
    ctx.fill();
    // mandible
    ctx.strokeStyle = husk ? "#3a3434" : "#141012";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(15.5, 3);
    ctx.quadraticCurveTo(18, 4, 17, 6);
    ctx.stroke();
    // antennae
    if (!husk) {
      ctx.strokeStyle = "#1c1618";
      ctx.lineWidth = 0.9;
      const w = asleep ? 0 : Math.sin(time * 4 + walk) * 1.5;
      ctx.beginPath();
      ctx.moveTo(14, -0.5);
      ctx.quadraticCurveTo(18, -6 + w, roach ? 34 : 22, (roach ? -12 : -5) + w);
      ctx.moveTo(13.5, -0.5);
      ctx.quadraticCurveTo(16, -7 - w, roach ? 30 : 19, (roach ? -16 : -8) - w);
      ctx.stroke();
    }
    // eye
    if (asleep) {
      ctx.strokeStyle = "rgba(157,255,106,0.5)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(13.5, 0.6); ctx.lineTo(15.5, 0.6);
      ctx.stroke();
    } else if (!husk) {
      ctx.fillStyle = possessed ? "#ff4d6d" : "#9dff6a";
      if (possessed) { ctx.shadowColor = "#ff4d6d"; ctx.shadowBlur = 8; }
      ctx.beginPath();
      ctx.arc(14.5, 0.5, 1.3, 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // the parasite showing through the shell
    if (possessed) {
      const pulse = 0.45 + 0.35 * Math.sin(time * 5);
      ctx.strokeStyle = `rgba(255,77,109,${pulse})`;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(-10, 1);
      ctx.bezierCurveTo(-7, -5, -3, 0, 0, -5);
      ctx.moveTo(-5, 2);
      ctx.quadraticCurveTo(-1, -2, 4, -3);
      ctx.moveTo(-1, -1);
      ctx.quadraticCurveTo(0, -6, 3, -7);
      ctx.stroke();
    }
    if (hurt) {
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.ellipse(-2, -2, 14, 8, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBeetles() {
    for (const b of beetles) {
      if (b.kind !== "beetle") { drawOtherHost(b); continue; }
      if (b.state === "husk") {
        drawBeetle(b, { husk: true, flipX: b.facing < 0, flipY: true });
        continue;
      }
      b.breath += 0.02;
      const near = player.form === "parasite" && nearbyBeetle(player) === b;
      if (near) {
        const g = ctx.createRadialGradient(b.x + b.w / 2, b.y + b.h / 2, 0, b.x + b.w / 2, b.y + b.h / 2, 30);
        g.addColorStop(0, "rgba(255,77,109,0.35)");
        g.addColorStop(1, "rgba(255,77,109,0)");
        ctx.fillStyle = g;
        ctx.fillRect(b.x - 20, b.y - 20, b.w + 40, b.h + 40);
      }
      ctx.save();
      const s = 1 + Math.sin(b.breath) * 0.03;
      ctx.translate(b.x + b.w / 2, b.y + b.h);
      ctx.scale(1, s);
      ctx.translate(-(b.x + b.w / 2), -(b.y + b.h));
      drawBeetle(b, { asleep: true, flipX: b.facing < 0 });
      ctx.restore();
      // sleeping "breath" motes
      if (Math.random() < 0.02) particles.push({ x: b.x + b.w / 2 + b.facing * 10, y: b.y + 4, vx: rand(-5, 5), vy: -18, life: 1.5, max: 1.5, color: "#9dff6a", r: 1, grav: -5 });
    }
  }

  function drawAnts() {
    for (const a of ants) {
      ctx.save();
      ctx.translate(a.x + a.w / 2, a.y + a.h / 2);
      ctx.scale(a.dir, 1);
      const body = a.alert > 0.5 ? "#7a2414" : "#4e1a10";
      // legs
      ctx.strokeStyle = "#2a0f0a";
      ctx.lineWidth = 1;
      for (let i = -1; i <= 1; i++) {
        const sw = Math.sin(a.step + i * 2) * 2.5;
        ctx.beginPath();
        ctx.moveTo(i * 2.5, 1);
        ctx.lineTo(i * 4 + sw, 3);
        ctx.lineTo(i * 5 + sw, 5.5);
        ctx.stroke();
      }
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.ellipse(-6, 0, 4.5, 3.5, -0.2, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, -0.5, 2.8, 2, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(5.5, -1.5, 3.2, 2.8, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = "rgba(255,140,100,0.25)";
      ctx.beginPath(); ctx.ellipse(-7, -1.5, 2, 1, -0.2, 0, TAU); ctx.fill();
      // antennae & mandibles
      ctx.strokeStyle = "#2a0f0a";
      ctx.beginPath();
      ctx.moveTo(7, -3); ctx.quadraticCurveTo(10, -8, 13, -6 + Math.sin(a.step * 2));
      ctx.moveTo(8.5, -0.5); ctx.lineTo(11, 1);
      ctx.stroke();
      // eye — angry red when it smells you
      ctx.fillStyle = a.alert > 0.5 ? "#ff5a3c" : "#120605";
      ctx.beginPath(); ctx.arc(7, -2, 0.9, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }

  // A soft puff, rendered once and stamped for every mist particle
  const mistSprite = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(175,255,95,0.9)");
    grad.addColorStop(0.45, "rgba(140,230,70,0.35)");
    grad.addColorStop(1, "rgba(120,220,60,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return c;
  })();

  // Mist drifts under the darkness; sparks and motes glow on top of it
  function drawParticles(layer) {
    ctx.save();
    if (layer === "glow") ctx.globalCompositeOperation = "lighter";
    for (const q of particles) {
      const fade = clamp(q.life / q.max, 0, 1);
      if (layer === "mist") {
        if (!q.mist) continue;
        ctx.globalAlpha = fade * 0.35;
        ctx.drawImage(mistSprite, q.x - q.r * 2, q.y - q.r * 2, q.r * 4, q.r * 4);
      } else {
        if (q.mist) continue;
        ctx.globalAlpha = fade;
        ctx.fillStyle = q.color;
        ctx.beginPath();
        ctx.arc(q.x, q.y, q.r, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // The bare parasite: a short glowing worm trailing behind its head
  function drawParasite(p) {
    const headX = p.x + p.w / 2 + p.facing * 6, headY = p.y + p.h / 2 + 1;
    const chain = p.chain;
    chain[0].x = headX + (p.mode === "ground" ? 0 : 0);
    chain[0].y = headY + Math.sin(time * 10) * (Math.abs(p.vx) > 5 ? 1 : 0.3);
    const spacing = 2.15;
    for (let i = 1; i < chain.length; i++) {
      const a = chain[i], b = chain[i - 1];
      let dx = a.x - b.x, dy = a.y - b.y;
      const d = Math.hypot(dx, dy) || 1;
      a.x = b.x + (dx / d) * spacing;
      a.y = b.y + (dy / d) * spacing;
      // gravity keeps the tail on the ground
      if (p.mode === "ground") a.y = lerp(a.y, p.y + p.h - 3, 0.2);
    }
    const blink = p.invuln > 0 && Math.sin(time * 40) > 0;
    if (blink) return;

    const n = chain.length;
    const wet = clamp(moisture / 100, 0, 1);
    const moving = Math.abs(p.vx) > 5;
    // Body outline from both sides of the spine; a peristaltic bulge rolls tailward
    const left = [], right = [], norms = [];
    for (let i = 0; i < n; i++) {
      const a = chain[Math.max(0, i - 1)], b = chain[Math.min(n - 1, i + 1)];
      let nx = -(b.y - a.y), ny = b.x - a.x;
      const l = Math.hypot(nx, ny) || 1;
      nx /= l; ny /= l;
      const t = i / (n - 1);
      let w = t < 0.15 ? 2.6 + 1.4 * (t / 0.15) : 4 * (1 - Math.pow((t - 0.15) / 0.85, 1.6)) + 0.5;
      w *= 1 + 0.22 * Math.sin(time * (moving ? 12 : 5) - i * 0.9);
      w *= 0.75 + 0.25 * wet;
      norms.push({ nx, ny, w });
      left.push([chain[i].x + nx * w, chain[i].y + ny * w]);
      right.push([chain[i].x - nx * w, chain[i].y - ny * w]);
    }
    const outline = () => {
      ctx.beginPath();
      ctx.moveTo(left[0][0], left[0][1]);
      for (let i = 1; i < n; i++) ctx.lineTo(left[i][0], left[i][1]);
      for (let i = n - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
      ctx.closePath();
    };
    const head = chain[0], tail = chain[n - 1];

    ctx.save();
    // Drawn half again as big as its hitbox, growing up from where it touches
    // the ground, so the detail reads at normal zoom
    const gx = p.x + p.w / 2, gy = p.y + p.h;
    ctx.translate(gx, gy); ctx.scale(1.5, 1.5); ctx.translate(-gx, -gy);
    ctx.lineCap = "round";
    // halo
    const halo = ctx.createRadialGradient(chain[3].x, chain[3].y, 0, chain[3].x, chain[3].y, 26);
    halo.addColorStop(0, `rgba(255,77,109,${0.28 * (0.5 + wet * 0.5)})`);
    halo.addColorStop(1, "rgba(255,77,109,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(chain[3].x - 26, chain[3].y - 26, 52, 52);

    // cilia, under the body
    ctx.strokeStyle = `rgba(255,170,190,${0.35 + 0.25 * wet})`;
    ctx.lineWidth = 0.5;
    for (let i = 2; i < n - 2; i++) {
      const { nx, ny, w } = norms[i];
      const flick = Math.sin(time * (moving ? 22 : 9) + i * 1.3) * 0.6;
      for (const side of [1, -1]) {
        const bx = chain[i].x + nx * w * side, by = chain[i].y + ny * w * side;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + (nx * side + ny * flick) * 2.6, by + (ny * side - nx * flick) * 2.6);
        ctx.stroke();
      }
    }

    // the body: translucent flesh, pale at the head, deep red at the tail;
    // it goes chalky as it dries out
    const bodyGrad = ctx.createLinearGradient(head.x, head.y, tail.x, tail.y);
    const dry = 1 - wet;
    bodyGrad.addColorStop(0, `rgba(${255},${205 - dry * 20},${215 - dry * 40},0.95)`);
    bodyGrad.addColorStop(0.35, `rgba(${255 - dry * 30},${90 + dry * 90},${115 + dry * 60},0.92)`);
    bodyGrad.addColorStop(1, `rgba(${120 + dry * 60},${20 + dry * 100},${40 + dry * 80},0.9)`);
    ctx.shadowColor = `rgba(255,77,109,${0.8 * wet})`;
    ctx.shadowBlur = 10;
    outline();
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.shadowBlur = 0;
    // rim
    ctx.strokeStyle = "rgba(90,10,30,0.55)";
    ctx.lineWidth = 0.6;
    outline();
    ctx.stroke();

    // gut line, with a bright pulse travelling down it
    ctx.strokeStyle = "rgba(120,15,40,0.55)";
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(chain[1].x, chain[1].y);
    for (let i = 2; i < n - 1; i++) ctx.lineTo(chain[i].x, chain[i].y);
    ctx.stroke();
    const pulseAt = Math.floor((time * 9) % (n - 2)) + 1;
    ctx.fillStyle = "rgba(255,230,240,0.8)";
    ctx.beginPath(); ctx.arc(chain[pulseAt].x, chain[pulseAt].y, 0.9, 0, TAU); ctx.fill();

    // segment rings
    ctx.strokeStyle = "rgba(110,10,35,0.45)";
    ctx.lineWidth = 0.55;
    for (let i = 2; i < n - 1; i += 1) {
      ctx.beginPath();
      ctx.moveTo(left[i][0], left[i][1]);
      ctx.quadraticCurveTo(chain[i].x + (chain[i - 1].x - chain[i].x) * 0.7, chain[i].y + (chain[i - 1].y - chain[i].y) * 0.7, right[i][0], right[i][1]);
      ctx.stroke();
    }

    // a wet highlight along the back
    if (wet > 0.2) {
      ctx.strokeStyle = `rgba(255,255,255,${0.45 * wet})`;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      for (let i = 1; i < n * 0.6; i++) {
        const { nx, ny, w } = norms[i];
        const x = chain[i].x - nx * w * 0.55, y = chain[i].y - ny * w * 0.55;
        i === 1 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // drying cracks
    if (wet < 0.45) {
      ctx.strokeStyle = `rgba(60,20,25,${(0.45 - wet) * 1.6})`;
      ctx.lineWidth = 0.4;
      for (let i = 2; i < n - 2; i += 2) {
        const { nx, ny, w } = norms[i];
        ctx.beginPath();
        ctx.moveTo(chain[i].x + nx * w * 0.8, chain[i].y + ny * w * 0.8);
        ctx.lineTo(chain[i].x + (chain[i + 1].x - chain[i].x) * 0.5, chain[i].y + (chain[i + 1].y - chain[i].y) * 0.5);
        ctx.stroke();
      }
    }

    // the nucleus — the part of you that is still you
    const core = chain[3];
    const cp = 0.65 + 0.35 * Math.sin(time * 3);
    const cg = ctx.createRadialGradient(core.x, core.y, 0, core.x, core.y, 4.5);
    cg.addColorStop(0, `rgba(255,255,255,${0.95 * clamp(self / 100, 0.15, 1)})`);
    cg.addColorStop(0.5, `rgba(255,170,195,${0.6 * cp})`);
    cg.addColorStop(1, "rgba(255,77,109,0)");
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(core.x, core.y, 4.5, 0, TAU); ctx.fill();

    // head: eyespots, palps and hooked mouthparts
    const dir = Math.atan2(chain[0].y - chain[1].y, chain[0].x - chain[1].x);
    const fx = Math.cos(dir), fy = Math.sin(dir), sx = -fy, sy = fx;
    ctx.fillStyle = "#5a0a1e";
    for (const sd of [1, -1]) {
      ctx.beginPath(); ctx.arc(head.x - fx * 1 + sx * sd * 1.4, head.y - fy * 1 + sy * sd * 1.4, 0.75, 0, TAU); ctx.fill();
    }
    const open = 0.5 + 0.4 * Math.sin(time * (moving ? 14 : 7));
    ctx.strokeStyle = "#ffe2ea";
    ctx.lineWidth = 0.75;
    for (const sd of [1, -1]) {
      const bx = head.x + fx * 1.8 + sx * sd * 1, by = head.y + fy * 1.8 + sy * sd * 1;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + fx * 2.5 + sx * sd * (1.5 + open), by + fy * 2.5 + sy * sd * (1.5 + open), bx + fx * 3.6 + sx * sd * 0.3, by + fy * 3.6 + sy * sd * 0.3);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(255,190,205,0.6)";
    ctx.lineWidth = 0.4;
    for (const sd of [1, -1]) {
      const wob = Math.sin(time * 6 + sd) * 0.8;
      ctx.beginPath();
      ctx.moveTo(head.x + sx * sd * 2, head.y + sy * sd * 2);
      ctx.lineTo(head.x + fx * 2 + sx * sd * (4 + wob), head.y + fy * 2 + sy * sd * (4 + wob));
      ctx.stroke();
    }
    ctx.restore();

    // a faint slime trail
    if (moving && p.mode === "ground" && Math.random() < 0.35) {
      particles.push({ x: tail.x, y: p.y + p.h - 0.5, vx: 0, vy: 0, life: 1.6, max: 1.6, color: "rgba(255,120,150,0.5)", r: 0.8, grav: 0 });
    }
  }

  // ---- props, enemies and rooms for the later chapters

  function drawRooms() {
    for (const r of rooms) {
      const palette = {
        bed: ["#2b2433", "#332a3d"], hall: ["#2e2a24", "#36302a"], kitchen: ["#2c3230", "#343b38"],
        basement: ["#201c1c", "#262121"], bath: ["#26303a", "#2d3843"], plain: ["#262022", "#2c2527"],
      }[r.style] || ["#262022", "#2c2527"];
      ctx.fillStyle = palette[0];
      ctx.fillRect(r.x, r.y, r.w, r.h);
      // wallpaper stripes
      ctx.fillStyle = palette[1];
      for (let x = r.x; x < r.x + r.w; x += 16) ctx.fillRect(x, r.y, 6, r.h);
      // skirting board
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(r.x, r.y + r.h - 8, r.w, 8);
      // a few framed pictures / a window
      const n = Math.floor(r.w / (5 * T));
      for (let i = 0; i < n; i++) {
        const fx = r.x + (i + 0.5) * (r.w / n) - 18, fy = r.y + Math.min(r.h * 0.25, 40);
        const hsh = hash(r.x + i, r.y);
        if (r.style === "kitchen" && i === 0) {
          ctx.fillStyle = "#16202e"; ctx.fillRect(fx - 6, fy - 4, 48, 40);
          ctx.fillStyle = "rgba(170,190,255,0.12)"; ctx.fillRect(fx - 2, fy, 40, 32);
          ctx.strokeStyle = "#4a4038"; ctx.lineWidth = 3; ctx.strokeRect(fx - 6, fy - 4, 48, 40);
          ctx.beginPath(); ctx.moveTo(fx + 18, fy - 4); ctx.lineTo(fx + 18, fy + 36); ctx.stroke();
        } else if (r.style !== "basement") {
          ctx.fillStyle = "#4a3a2c"; ctx.fillRect(fx, fy, 30 + hsh * 10, 24);
          ctx.fillStyle = `hsl(${hsh * 360},25%,${30 + hsh * 15}%)`; ctx.fillRect(fx + 3, fy + 3, 24 + hsh * 10, 18);
        }
      }
    }
  }

  function drawDoors() {
    for (const d of doors) {
      if (d.open) {
        ctx.strokeStyle = "#4a3426"; ctx.lineWidth = 3;
        ctx.strokeRect(d.x + 2, d.y + 2, d.w - 4, d.h - 2);
        continue;
      }
      ctx.fillStyle = "#5a3d2a";
      ctx.fillRect(d.x + 3, d.y + 1, d.w - 6, d.h - 1);
      ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1;
      ctx.strokeRect(d.x + 7, d.y + 6, d.w - 14, d.h * 0.4);
      ctx.strokeRect(d.x + 7, d.y + d.h * 0.5, d.w - 14, d.h * 0.42);
      ctx.fillStyle = "#c9a85a";
      ctx.beginPath(); ctx.arc(d.x + d.w - 9, d.y + d.h * 0.52, 2, 0, TAU); ctx.fill();
      if (d.lock && !heldKeys.has(d.lock)) {
        ctx.fillStyle = "#9a8a6a"; roundRect(d.x + d.w / 2 - 5, d.y + d.h * 0.44, 10, 8, 2); ctx.fill();
        ctx.strokeStyle = "#9a8a6a"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(d.x + d.w / 2, d.y + d.h * 0.44, 3.5, Math.PI, 0); ctx.stroke();
      }
    }
  }

  function drawMirrors() {
    for (const m of mirrors) {
      ctx.fillStyle = "#6a5a40";
      roundRect(m.x + 2, m.y - 6, m.w - 4, m.h + 6, 12); ctx.fill();
      const g = ctx.createLinearGradient(m.x, m.y, m.x + m.w, m.y + m.h);
      g.addColorStop(0, "#9fb0c0"); g.addColorStop(0.5, "#56606c"); g.addColorStop(1, "#8a9aaa");
      ctx.fillStyle = g;
      roundRect(m.x + 6, m.y - 2, m.w - 12, m.h - 2, 9); ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${0.15 + 0.1 * Math.sin(time * 1.5)})`;
      ctx.fillRect(m.x + 9, m.y + 4 + ((time * 20) % (m.h - 14)), m.w - 18, 2);
    }
  }

  function drawValves() {
    for (const v of valves) {
      ctx.strokeStyle = "#555"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(v.x, v.y + 6); ctx.lineTo(v.x, v.y + T / 2 + 6); ctx.stroke();
      ctx.save();
      ctx.translate(v.x, v.y);
      ctx.rotate(v.turn * Math.PI * 2 + time * (v.closed ? 0 : 0));
      ctx.strokeStyle = v.closed ? "#4a8a4a" : "#b8352f"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.stroke();
      for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(8, 0); ctx.stroke(); }
      ctx.restore();
      if (!v.closed && Math.random() < 0.2) particles.push({ x: v.x + rand(-4, 4), y: v.y + 8, vx: rand(-20, 20), vy: rand(-40, -10), life: 1, max: 1, color: "#9fe060", r: rand(4, 8), grav: -10, mist: true });
    }
  }

  function drawTraps() {
    for (const tr of traps) {
      ctx.fillStyle = "#8a6a44";
      ctx.fillRect(tr.x, tr.y + 2, tr.w, 6);
      ctx.fillStyle = "#d8c27a";
      ctx.fillRect(tr.x + tr.w / 2 - 4, tr.y, 8, 3);
      ctx.strokeStyle = "#c8c8c8"; ctx.lineWidth = 1.6;
      ctx.beginPath();
      if (tr.state === "sprung") { ctx.moveTo(tr.x + 3, tr.y + 2); ctx.lineTo(tr.x + tr.w - 3, tr.y + 1); }
      else { const lift = tr.state === "snap" ? 6 : 0; ctx.moveTo(tr.x + 3, tr.y + 2); ctx.lineTo(tr.x + 1, tr.y - 10 + lift); ctx.lineTo(tr.x + tr.w - 6, tr.y - 10 + lift); }
      ctx.stroke();
    }
  }

  function drawBaits() {
    for (const b of baits) {
      if (b.eaten) continue;
      for (const [dx, dy, r] of [[-4, 0, 3], [2, 0, 3.2], [-1, -3, 2.8], [5, -1, 2.4]]) {
        ctx.fillStyle = "#3f8fb0";
        ctx.beginPath(); ctx.arc(b.x + dx, b.y + dy, r, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.beginPath(); ctx.arc(b.x - 1, b.y - 4, 1, 0, TAU); ctx.fill();
    }
  }

  function drawCats() {
    for (const c of cats) {
      ctx.save();
      ctx.translate(c.x + c.w / 2, c.y + c.h);
      ctx.scale(c.dir, 1);
      const crouch = c.state === "sit" ? 4 : c.state === "hiss" ? -4 : 0;
      const ink = "#17151a";
      // tail
      ctx.strokeStyle = ink; ctx.lineWidth = 3.2; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-15, -17);
      ctx.quadraticCurveTo(-28, -22 + Math.sin(time * 3 + c.x) * 4, -24, -36 + Math.sin(time * 2.2) * 5); ctx.stroke();
      // legs
      ctx.lineWidth = 3;
      for (const [lx, ph] of [[-10, 0], [-6, Math.PI], [8, Math.PI / 2], [12, Math.PI * 1.5]]) {
        const sw = c.state === "chase" ? Math.sin(c.step * 2 + ph) * 5 : Math.sin(c.step + ph) * 2;
        ctx.beginPath(); ctx.moveTo(lx, -12 + crouch); ctx.lineTo(lx + sw, 0); ctx.stroke();
      }
      // body & head
      ctx.fillStyle = ink;
      ctx.beginPath(); ctx.ellipse(0, -16 + crouch, 17, 8, c.state === "chase" ? -0.05 : 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(16, -24 + crouch, 7.5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(11, -29 + crouch); ctx.lineTo(13, -38 + crouch); ctx.lineTo(17, -30 + crouch);
      ctx.moveTo(17, -30 + crouch); ctx.lineTo(21, -37 + crouch); ctx.lineTo(22, -27 + crouch); ctx.fill();
      ctx.restore();
    }
  }

  function drawExterminators() {
    for (const ex of exterminators) {
      ctx.save();
      ctx.translate(ex.x + ex.w / 2, ex.y + ex.h);
      ctx.scale(ex.dir, 1);
      drawManFigure({ suit: true, walk: ex.step, still: ex.state !== "walk", aim: ex.state === "walk" ? 0.6 : ex.aim, aiming: ex.state !== "walk" });
      ctx.restore();
      if (ex.state === "spray") {
        const ox = ex.x + ex.w / 2 + ex.dir * 18, oy = ex.y + 22;
        ctx.save();
        ctx.translate(ox, oy);
        ctx.scale(ex.dir, 1);
        ctx.rotate(ex.aim);
        const g = ctx.createLinearGradient(0, 0, SPRAY_LEN, 0);
        g.addColorStop(0, "rgba(190,255,100,0.45)"); g.addColorStop(1, "rgba(150,230,80,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(SPRAY_LEN, -SPRAY_LEN * 0.33); ctx.lineTo(SPRAY_LEN, SPRAY_LEN * 0.33); ctx.lineTo(0, 3); ctx.closePath(); ctx.fill();
        ctx.restore();
      } else if (ex.state === "aim") {
        ctx.fillStyle = `rgba(255,80,60,${0.5 + 0.5 * Math.sin(time * 30)})`;
        ctx.beginPath(); ctx.arc(ex.x + ex.w / 2 + ex.dir * 8, ex.y + 4, 2.5, 0, TAU); ctx.fill();
      }
    }
  }

  function drawFog() {
    for (const f of fogs) {
      if (f.fade <= 0.01) continue;
      ctx.save();
      ctx.globalAlpha = 0.5 * f.fade;
      for (const pf of f.puffs) {
        const x = f.x + ((pf.u * f.w + Math.sin(time * 0.4 + pf.p) * 14) % f.w);
        const y = f.y + pf.v * f.h + Math.cos(time * 0.3 + pf.p) * 8;
        ctx.drawImage(mistSprite, x - pf.r * 1.5, y - pf.r * 1.5, pf.r * 3, pf.r * 3);
      }
      ctx.restore();
    }
  }

  function drawLamps() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const l of lamps) {
      const f = l.flicker ? 0.75 + 0.25 * Math.sin(time * 13 + l.x) * Math.sin(time * 7.3) : 1;
      const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
      g.addColorStop(0, `rgba(${l.color},${0.3 * f})`);
      g.addColorStop(1, `rgba(${l.color},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(l.x, l.y, l.r, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(${l.color},${0.9 * f})`;
      ctx.beginPath(); ctx.arc(l.x, l.y, 3, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawKeys() {
    for (const k of keyItems) {
      if (k.taken) continue;
      const y = k.y + Math.sin(time * 2) * 3;
      ctx.strokeStyle = "#e8c860"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(k.x - 5, y, 4, 0, TAU); ctx.moveTo(k.x - 1, y); ctx.lineTo(k.x + 9, y); ctx.moveTo(k.x + 6, y); ctx.lineTo(k.x + 6, y + 4); ctx.moveTo(k.x + 9, y); ctx.lineTo(k.x + 9, y + 3); ctx.stroke();
    }
  }

  // Eyes stay visible through the dark: cats, and the exterminator's goggles
  function drawEyesInDark() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const c of cats) {
      const crouch = c.state === "sit" ? 4 : 0;
      const ex = c.x + c.w / 2 + c.dir * 19, ey = c.y + c.h - 25 + crouch;
      ctx.fillStyle = c.alert > 0.5 ? "rgba(220,255,90,0.95)" : "rgba(200,230,90,0.55)";
      ctx.beginPath(); ctx.ellipse(ex, ey, 1.6, c.alert > 0.5 ? 2.4 : 1.2, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawOtherHost(b) {
    const husk = b.state === "husk";
    const asleep = !husk;
    if (asleep) {
      b.breath += 0.02;
      if (player.form === "parasite" && nearbyBeetle(player) === b) {
        const g = ctx.createRadialGradient(b.x + b.w / 2, b.y + b.h / 2, 0, b.x + b.w / 2, b.y + b.h / 2, 40);
        g.addColorStop(0, "rgba(255,77,109,0.35)");
        g.addColorStop(1, "rgba(255,77,109,0)");
        ctx.fillStyle = g;
        ctx.fillRect(b.x - 30, b.y - 30, b.w + 60, b.h + 60);
      }
      if (Math.random() < 0.015) particles.push({ x: b.x + b.w / 2, y: b.y, vx: rand(-5, 5), vy: -16, life: 1.5, max: 1.5, color: HOSTS[b.kind].glow, r: 1, grav: -5 });
    }
    const opts = { husk, asleep, facing: b.facing, walk: 0 };
    if (b.kind === "roach") return drawBeetle(b, { husk, asleep, roach: true, flipX: b.facing < 0, flipY: husk });
    if (b.kind === "moth") return drawMoth(b, opts);
    if (b.kind === "dog") return drawDog(b, opts);
    if (b.kind === "crow") drawCrow(b, opts);
    else if (b.kind === "rat") drawRat(b, opts);
    else if (b.kind === "man") drawMan(b, { ...opts, lying: b.lying });
  }

  // A moth: a soft body, two pairs of dusty patterned wings, feathered antennae
  function drawMoth(b, o) {
    ctx.save();
    ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
    ctx.scale(o.facing < 0 ? -1 : 1, 1);
    if (o.husk) { ctx.rotate(Math.PI); ctx.globalAlpha = 0.6; }
    const beat = o.airborne ? Math.sin(time * 34) : o.asleep || o.husk ? -0.2 : Math.sin(time * 2) * 0.15;
    const dust = o.husk ? "#6a645c" : "#b8a888";
    for (const [back, a0] of [[1, 0], [0, 0.35]]) {
      ctx.save();
      ctx.translate(-1, -2);
      ctx.rotate(-0.4 + beat * 0.9 - a0);
      ctx.fillStyle = back ? "#7d6e58" : dust;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-6, -15, -16, -12); ctx.quadraticCurveTo(-12, -3, 0, 2); ctx.closePath(); ctx.fill();
      if (!back) {
        ctx.fillStyle = "rgba(60,40,30,0.7)"; ctx.beginPath(); ctx.arc(-9, -8, 2.4, 0, TAU); ctx.fill();
        ctx.fillStyle = "rgba(240,220,170,0.7)"; ctx.beginPath(); ctx.arc(-9, -8, 1, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
    ctx.fillStyle = o.husk ? "#5a554e" : "#9a8a6c";
    ctx.beginPath(); ctx.ellipse(0, 1, 7, 3.6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    for (let i = -5; i < 6; i += 2.5) { ctx.beginPath(); ctx.arc(i, 0, 1.1, 0, TAU); ctx.fill(); }
    ctx.fillStyle = o.husk ? "#5a554e" : "#8a7a5e";
    ctx.beginPath(); ctx.arc(7, 0, 2.6, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#cbb88e"; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(8, -1.5); ctx.quadraticCurveTo(11, -7, 14, -8); ctx.moveTo(8, -1); ctx.quadraticCurveTo(12, -5, 15, -5); ctx.stroke();
    if (!o.husk) {
      ctx.fillStyle = o.possessed ? "#ff4d6d" : "#2a2016";
      if (o.possessed) { ctx.shadowColor = "#ff4d6d"; ctx.shadowBlur = 6; }
      ctx.beginPath(); ctx.arc(8.4, -0.5, 0.9, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  // A stray dog in profile, head toward +x, with a frayed red collar
  function drawDog(b, o) {
    ctx.save();
    ctx.translate(b.x + b.w / 2, b.y + b.h);
    ctx.scale(o.facing < 0 ? -1 : 1, 1);
    if (o.husk) { ctx.globalAlpha = 0.75; }
    const fur = o.husk ? "#6a625a" : "#7a5a3c", dark = o.husk ? "#4a443e" : "#4e3824";
    const lie = o.asleep || o.husk;
    const run = lie ? 0 : o.walk * 5;
    // tail
    ctx.strokeStyle = fur; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-15, lie ? -8 : -17);
    ctx.quadraticCurveTo(-22, lie ? -6 : -24 + Math.sin(time * 14) * 3, -25, lie ? -3 : -27 + Math.sin(time * 14) * 4); ctx.stroke();
    // legs
    if (!lie) {
      ctx.strokeStyle = dark; ctx.lineWidth = 3.2;
      for (const [lx, ph] of [[-11, 0], [-7, Math.PI], [8, Math.PI / 2], [12, Math.PI * 1.5]]) {
        const sw = Math.sin(run + ph) * 4.5;
        ctx.beginPath(); ctx.moveTo(lx, -11); ctx.lineTo(lx + sw, -4); ctx.lineTo(lx + sw * 0.6, 0); ctx.stroke();
      }
    }
    // body
    const g = ctx.createLinearGradient(0, -24, 0, -6);
    g.addColorStop(0, fur); g.addColorStop(1, dark);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, lie ? -6 : -15, 16, lie ? 6 : 7.5, 0, 0, TAU); ctx.fill();
    // head, snout, ear
    const hx = 15, hy = lie ? -7 : -21;
    ctx.beginPath(); ctx.arc(hx, hy, 6.5, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(hx + 3, hy - 1); ctx.lineTo(hx + 12, hy + 1); ctx.lineTo(hx + 11, hy + 4); ctx.lineTo(hx + 2, hy + 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#1a1210"; ctx.beginPath(); ctx.arc(hx + 11.5, hy + 1.5, 1.3, 0, TAU); ctx.fill();
    ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(hx - 2, hy - 2, 2.6, 5, 0.5, 0, TAU); ctx.fill();
    // collar
    ctx.strokeStyle = o.husk ? "#6a4040" : "#a8323a"; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(hx - 5, hy + 1); ctx.lineTo(hx - 3, hy + 6); ctx.stroke();
    // eye
    if (o.asleep) { ctx.strokeStyle = "#2a1a10"; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(hx + 1, hy - 1.5); ctx.lineTo(hx + 4, hy - 1.5); ctx.stroke(); }
    else if (!o.husk) {
      ctx.fillStyle = o.possessed ? "#ff4d6d" : "#1a1210";
      if (o.possessed) { ctx.shadowColor = "#ff4d6d"; ctx.shadowBlur = 8; }
      ctx.beginPath(); ctx.arc(hx + 2.5, hy - 2, 1.2, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
    }
    if (o.possessed) {
      ctx.strokeStyle = `rgba(255,77,109,${0.4 + 0.3 * Math.sin(time * 5)})`; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(-10, -16); ctx.quadraticCurveTo(-2, -22, 8, -15); ctx.stroke();
    }
    ctx.restore();
  }

  // The things a host craves
  function drawUrges() {
    for (const u of urges) {
      if (u.used) continue;
      const tempting = player.form === u.host;
      ctx.save();
      ctx.translate(u.x, u.y);
      if (tempting) {
        const g = ctx.createRadialGradient(0, -4, 0, 0, -4, 26);
        g.addColorStop(0, `rgba(255,210,150,${0.18 + 0.1 * Math.sin(time * 3)})`);
        g.addColorStop(1, "rgba(255,210,150,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -4, 26, 0, TAU); ctx.fill();
      }
      if (u.item === "rot") {
        ctx.fillStyle = "#5a1a2c"; ctx.beginPath(); ctx.ellipse(0, 0, 7, 5, 0.2, 0, TAU); ctx.fill();
        ctx.fillStyle = "#3a0f1c"; ctx.beginPath(); ctx.ellipse(2, 1, 3, 2, 0.2, 0, TAU); ctx.fill();
        for (let i = 0; i < 3; i++) {
          const a = time * (3 + i) + i * 2;
          ctx.fillStyle = "#111"; ctx.fillRect(Math.cos(a) * 9, -8 + Math.sin(a * 1.3) * 4, 1.4, 1.4);
        }
      } else if (u.item === "shiny") {
        ctx.fillStyle = "#b8bcc4"; ctx.beginPath(); ctx.ellipse(0, 0, 5, 2.2, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = "#e8ecf4"; ctx.fillRect(-2, -1.2, 3, 0.8);
        const sp = Math.max(0, Math.sin(time * 4));
        ctx.strokeStyle = `rgba(255,255,255,${sp})`; ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.moveTo(2, -6); ctx.lineTo(2, -2); ctx.moveTo(0, -4); ctx.lineTo(4, -4); ctx.stroke();
      } else if (u.item === "crumbs") {
        ctx.fillStyle = "#c8a878";
        for (const [dx, dy, r] of [[-5, 0, 1.6], [-1, -1, 2], [3, 0, 1.4], [6, -1, 1.2], [1, 1, 1]]) { ctx.beginPath(); ctx.arc(dx, dy, r, 0, TAU); ctx.fill(); }
      } else if (u.item === "drawing") {
        ctx.rotate(-0.08);
        ctx.fillStyle = "#e8e0d0"; ctx.fillRect(-9, -12, 18, 13);
        ctx.strokeStyle = "#c84a4a"; ctx.lineWidth = 0.8; ctx.strokeRect(-6, -7, 6, 5);
        ctx.beginPath(); ctx.moveTo(-7, -7); ctx.lineTo(-3, -10); ctx.lineTo(1, -7); ctx.stroke();
        ctx.fillStyle = "#e8b830"; ctx.beginPath(); ctx.arc(5, -9, 2, 0, TAU); ctx.fill();
        ctx.strokeStyle = "#3a6ac8"; ctx.beginPath(); ctx.moveTo(3, -2); ctx.lineTo(3, -5); ctx.moveTo(6, -2); ctx.lineTo(6, -6); ctx.stroke();
      }
      ctx.restore();
    }
  }

  // A crow in profile: head toward +x
  function drawCrow(b, o) {
    ctx.save();
    ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
    ctx.scale(o.facing < 0 ? -1 : 1, 1);
    if (o.husk) { ctx.rotate(Math.PI); ctx.globalAlpha = 0.7; }
    const ink = o.husk ? "#3a3a40" : "#11131a";
    // tail
    ctx.fillStyle = ink;
    ctx.beginPath(); ctx.moveTo(-8, -1); ctx.lineTo(-21, -5 + (o.gliding ? -2 : 0)); ctx.lineTo(-20, 3); ctx.closePath(); ctx.fill();
    // legs
    if (!o.airborne) {
      ctx.strokeStyle = "#2a2a30"; ctx.lineWidth = 1.2;
      const sw = Math.sin(o.walk * 6) * 2;
      ctx.beginPath(); ctx.moveTo(-1, 6); ctx.lineTo(-2 + sw, 10); ctx.moveTo(3, 6); ctx.lineTo(3 - sw, 10); ctx.stroke();
    }
    // body with a blue-violet sheen
    const g = ctx.createLinearGradient(-10, -8, 8, 8);
    g.addColorStop(0, o.husk ? "#4a4a50" : "#2a3a5c"); g.addColorStop(0.5, ink); g.addColorStop(1, o.husk ? "#2a2a2e" : "#2a1a33");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, 1, 11, 7, -0.1, 0, TAU); ctx.fill();
    // head & beak
    ctx.fillStyle = ink;
    ctx.beginPath(); ctx.arc(9, -4, o.asleep ? 4.5 : 5.5, 0, TAU); ctx.fill();
    ctx.fillStyle = "#3b3c44";
    ctx.beginPath(); ctx.moveTo(13, -6); ctx.lineTo(21, -3.5); ctx.lineTo(13, -1.5); ctx.closePath(); ctx.fill();
    // eye
    if (o.asleep) { ctx.strokeStyle = "rgba(127,180,255,0.6)"; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(9.5, -5); ctx.lineTo(12, -5); ctx.stroke(); }
    else if (!o.husk) {
      ctx.fillStyle = o.possessed ? "#ff4d6d" : "#d8e6ff";
      if (o.possessed) { ctx.shadowColor = "#ff4d6d"; ctx.shadowBlur = 8; }
      ctx.beginPath(); ctx.arc(11, -5, 1.3, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
    }
    // wing: folded on the ground, beating or spread in the air
    ctx.fillStyle = o.husk ? "#333338" : "#0b0c12";
    ctx.save();
    ctx.translate(1, -2);
    let a = 0.15;
    if (o.airborne) a = o.gliding ? -0.35 : -0.2 + Math.sin(time * 26) * (o.flapping ? 1.1 : 0.5);
    ctx.rotate(a);
    ctx.beginPath();
    if (o.airborne) {
      ctx.moveTo(4, 0); ctx.quadraticCurveTo(-6, -16, -20, -13); ctx.lineTo(-16, -9); ctx.lineTo(-19, -6); ctx.lineTo(-13, -4); ctx.quadraticCurveTo(-6, -1, 4, 2);
    } else {
      ctx.ellipse(-3, 1, 9, 4.5, -0.15, 0, TAU);
    }
    ctx.fill();
    ctx.restore();
    if (o.possessed) {
      ctx.strokeStyle = `rgba(255,77,109,${0.45 + 0.35 * Math.sin(time * 5)})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(-6, 3); ctx.quadraticCurveTo(-1, -1, 5, 2); ctx.moveTo(-2, 5); ctx.lineTo(3, -2); ctx.stroke();
    }
    ctx.restore();
  }

  // A rat in profile: head toward +x
  function drawRat(b, o) {
    ctx.save();
    ctx.translate(b.x + b.w / 2, b.y + b.h / 2 + 1);
    ctx.scale(o.facing < 0 ? -1 : 1, 1);
    if (o.husk) { ctx.scale(1, -1); ctx.globalAlpha = 0.7; }
    const fur = o.husk ? "#5a5654" : "#5d504a";
    // tail
    ctx.strokeStyle = o.husk ? "#8a7c7c" : "#c99393";
    ctx.lineWidth = 1.6; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-11, 2);
    const tw = o.asleep || o.husk ? 0 : Math.sin(time * 6 + o.walk) * 3;
    ctx.bezierCurveTo(-20, 6 + tw, -26, -2 - tw, o.asleep ? -16 : -32, 3); ctx.stroke();
    // legs
    if (!o.asleep) {
      ctx.strokeStyle = "#3a302c"; ctx.lineWidth = 1.4;
      for (const [lx, ph] of [[-7, 0], [-3, Math.PI], [5, Math.PI / 2], [9, Math.PI * 1.5]]) {
        const sw = o.husk ? 0 : Math.sin(o.walk * 7 + ph) * 3;
        ctx.beginPath(); ctx.moveTo(lx, 3); ctx.lineTo(lx + sw, o.husk ? -2 : 7); ctx.stroke();
      }
    }
    // body
    const g = ctx.createLinearGradient(0, -7, 0, 7);
    g.addColorStop(0, o.husk ? "#6a6664" : "#75665e"); g.addColorStop(1, fur);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(-2, 0, o.asleep ? 10 : 12, o.asleep ? 7 : 6.5, 0, 0, TAU); ctx.fill();
    // head
    ctx.beginPath(); ctx.moveTo(6, -5); ctx.quadraticCurveTo(14, -5, 19, 2); ctx.quadraticCurveTo(13, 5, 6, 4); ctx.closePath(); ctx.fill();
    // ear, nose, whiskers
    ctx.fillStyle = "#8a7670"; ctx.beginPath(); ctx.arc(8, -5, 3, 0, TAU); ctx.fill();
    ctx.fillStyle = "#d9a0a0"; ctx.beginPath(); ctx.arc(8, -5, 1.6, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(19, 2, 1.2, 0, TAU); ctx.fill();
    ctx.strokeStyle = "rgba(230,220,210,0.35)"; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(17, 1); ctx.lineTo(24, -1); ctx.moveTo(17, 2); ctx.lineTo(24, 3); ctx.stroke();
    // eye
    if (o.asleep) { ctx.strokeStyle = "rgba(255,180,90,0.6)"; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(12, -1); ctx.lineTo(14, -1); ctx.stroke(); }
    else if (!o.husk) {
      ctx.fillStyle = o.possessed ? "#ff4d6d" : "#120808";
      if (o.possessed) { ctx.shadowColor = "#ff4d6d"; ctx.shadowBlur = 8; }
      ctx.beginPath(); ctx.arc(13, -1, 1.3, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
    }
    if (o.possessed) {
      ctx.strokeStyle = `rgba(255,77,109,${0.45 + 0.35 * Math.sin(time * 5)})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(-10, 1); ctx.quadraticCurveTo(-4, -4, 3, 0); ctx.stroke();
    }
    ctx.restore();
  }

  // A man, drawn standing with his feet at the origin. `suit` is the
  // exterminator's hazmat gear.
  function drawManFigure(o) {
    const walk = o.walk || 0;
    const sw = o.still ? 0 : Math.sin(walk * 5) * 0.45;
    const cloth = o.suit ? "#8a8248" : o.husk ? "#4c4a4a" : "#3d4a48";
    const dark = o.suit ? "#5e5830" : "#262e2d";
    // legs
    for (const [ph, col] of [[1, dark], [-1, cloth]]) {
      ctx.save(); ctx.translate(0, -28); ctx.rotate(sw * ph);
      ctx.fillStyle = col; ctx.fillRect(-3.5, 0, 7, 27);
      ctx.fillStyle = "#1a1514"; ctx.fillRect(-3.5, 24, 10, 4);
      ctx.restore();
    }
    // back arm
    ctx.save(); ctx.translate(0, -46); ctx.rotate(-sw * 0.8);
    ctx.fillStyle = dark; ctx.fillRect(-2.5, 0, 5, 21); ctx.restore();
    // tank on the back
    if (o.suit) {
      ctx.fillStyle = "#b9b2a0"; roundRect(-14, -48, 8, 20, 3); ctx.fill();
      ctx.strokeStyle = "#444"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-10, -30); ctx.quadraticCurveTo(-2, -18, 8, -26); ctx.stroke();
    }
    // torso
    ctx.fillStyle = cloth; roundRect(-7.5, -50, 15, 25, 4); ctx.fill();
    // front arm (the exterminator holds his wand out)
    ctx.save(); ctx.translate(1, -46);
    ctx.rotate(o.suit ? -Math.PI / 2 + (o.aim || 0.4) + (o.aiming ? 0 : 0.9) : sw * 0.8);
    ctx.fillStyle = cloth; ctx.fillRect(-2.5, 0, 5, 20);
    if (o.suit) { ctx.fillStyle = "#555"; ctx.fillRect(-1, 18, 2, 12); }
    ctx.restore();
    // head
    ctx.fillStyle = o.husk ? "#8a7a72" : "#c79c84";
    ctx.beginPath(); ctx.arc(1, -56, 6.5, 0, TAU); ctx.fill();
    ctx.fillStyle = "#2a1f1a"; ctx.beginPath(); ctx.arc(0, -58.5, 6.6, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
    if (o.suit) {
      // respirator & goggles
      ctx.fillStyle = "#2a2a2a"; roundRect(2, -56, 7, 6, 2); ctx.fill();
      ctx.fillStyle = "rgba(160,220,255,0.6)"; ctx.fillRect(1, -60, 6, 3);
    } else if (o.asleep || o.husk) {
      ctx.strokeStyle = "#5a3a30"; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(3, -57); ctx.lineTo(6, -57); ctx.stroke();
    } else {
      ctx.fillStyle = o.possessed ? "#ff4d6d" : "#1a1210";
      if (o.possessed) { ctx.shadowColor = "#ff4d6d"; ctx.shadowBlur = 8; }
      ctx.beginPath(); ctx.arc(4.5, -57, 1.2, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
    }
    if (o.possessed) {
      ctx.strokeStyle = `rgba(255,77,109,${0.35 + 0.3 * Math.sin(time * 5)})`;
      ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(-1, -62); ctx.quadraticCurveTo(-4, -54, 0, -50); ctx.moveTo(0, -52); ctx.lineTo(-2, -40); ctx.stroke();
    }
  }

  function drawMan(b, o) {
    ctx.save();
    if (o.lying) {
      ctx.translate(b.x + b.w / 2, b.y + b.h - 9);
      ctx.rotate(o.facing > 0 ? Math.PI / 2 : -Math.PI / 2);
      ctx.translate(0, 29);
      if (o.husk) ctx.globalAlpha = 0.75;
      drawManFigure({ ...o, still: true });
    } else {
      ctx.translate(b.x + b.w / 2, b.y + b.h);
      ctx.scale(o.facing < 0 ? -1 : 1, 1);
      drawManFigure(o);
    }
    ctx.restore();
  }

  function drawPlayer() {
    const p = player;
    if (p.form === "parasite") return drawParasite(p);
    if (p.form !== "beetle" && p.form !== "roach") {
      if (p.invuln > 0 && Math.sin(time * 40) > 0.3) return;
      const o = { possessed: true, facing: p.facing, walk: p.walk, airborne: p.mode !== "ground", gliding: p.gliding, flapping: p.flap > 0 };
      if (p.form === "moth") drawMoth(p, o);
      else if (p.form === "dog") drawDog(p, o);
      else if (p.form === "crow") drawCrow(p, o);
      else if (p.form === "rat") drawRat(p, o);
      else drawMan(p, o);
      return;
    }
    let angle = 0, flipX = p.facing < 0, flipY = false;
    if (p.mode === "ceil") { flipY = true; }
    else if (p.mode === "wall") {
      const headUp = p.climbDir <= 0;
      angle = headUp ? -Math.PI / 2 : Math.PI / 2;
      const bellyX = headUp ? 1 : -1;
      flipX = false;
      flipY = bellyX !== p.side;
    }
    if (p.invuln > 0 && Math.sin(time * 40) > 0.3) return;
    drawBeetle(p, { possessed: true, walk: p.walk, angle, flipX, flipY, hurt: hurtFlash > 0.6, roach: p.form === "roach" });
  }

  function drawExit() {
    if (!exitZone) return;
    const x = exitZone.x + exitZone.w / 2;
    for (let i = 0; i < 2; i++) {
      if (Math.random() < 0.3) particles.push({ x: x + rand(-40, 40), y: exitZone.y - T * 3 + rand(0, 40), vx: 0, vy: 30, life: 1.2, max: 1.2, color: "rgba(94,242,201,0.6)", r: 1, grav: 120 });
    }
  }

  // Darkness with holes cut out around anything that glows
  function drawShade() {
    const s = shade;
    s.setTransform(1, 0, 0, 1, 0, 0);
    s.globalCompositeOperation = "source-over";
    s.clearRect(0, 0, shadeCanvas.width, shadeCanvas.height);
    const darkness = (LEVEL.darkness ?? 0.78) + (1 - self / 100) * 0.15;
    s.fillStyle = `rgba(4,2,6,${darkness})`;
    s.fillRect(0, 0, shadeCanvas.width, shadeCanvas.height);
    s.setTransform(DPR * scale, 0, 0, DPR * scale, -camera.x * DPR * scale, -camera.y * DPR * scale);
    s.globalCompositeOperation = "destination-out";

    const hole = (x, y, r, a = 1) => {
      const g = s.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(0,0,0,${a})`);
      g.addColorStop(0.6, `rgba(0,0,0,${a * 0.5})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      s.fillStyle = g;
      s.beginPath();
      s.arc(x, y, r, 0, TAU);
      s.fill();
    };

    const p = player;
    hole(p.x + p.w / 2, p.y + p.h / 2, 190 + Math.sin(time * 3) * 6, 0.95);
    for (const l of lamps) hole(l.x, l.y, l.r * (l.flicker ? 0.85 + 0.15 * Math.sin(time * 13 + l.x) : 1), 0.9);
    for (const f of fogs) if (f.fade > 0.05) hole(f.x + f.w / 2, f.y + f.h / 2, Math.max(f.w, f.h) * 0.6, 0.35 * f.fade);
    for (const v of valves) hole(v.x, v.y, 50, 0.5);
    for (const k of keyItems) if (!k.taken) hole(k.x, k.y, 50, 0.5);
    for (const m of mirrors) hole(m.x + T / 2, m.y + T, 80, 0.6);
    for (const ex of exterminators) hole(ex.x + ex.w / 2, ex.y + 20, ex.state === "spray" ? 140 : 70, 0.55);
    for (const b of beams) {
      const g = s.createLinearGradient(b.x - 30, 0, b.x + b.w + 30, 0);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(0.5, "rgba(0,0,0,0.85)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      s.fillStyle = g;
      s.fillRect(b.x - 30, b.y, b.w + 60, b.h);
      hole(b.x + b.w / 2, b.y + b.h, b.w * 3, 0.8);
    }
    for (const sh of shards) if (!sh.taken) hole(sh.x, sh.y, 70, 0.7);
    for (const c of checkpoints) hole(c.x + T / 2, c.y + T / 2, c.active ? 110 : 60, c.active ? 0.8 : 0.5);
    for (const n of nozzles) if (n.spraying || n.warning) hole(n.x, n.y + 40, n.spraying ? 110 : 40, 0.6);
    for (const sp of spiders) if (sp.state !== "idle") hole(sp.x, sp.y, 34, 0.5);
    if (flood && flood.active) for (let x = flood.x + 40; x < flood.x + flood.w; x += 80) hole(x, flood.y, 120, 0.7);
    for (const a of ants) if (a.alert > 0.5) hole(a.x + a.w / 2, a.y, 30, 0.4);
    if (exitZone) hole(exitZone.x + exitZone.w / 2, exitZone.y - T * 2, 90, 0.5);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(shadeCanvas, 0, 0);
  }

  // Liquids glow a little through the dark
  function drawGlows() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const x0 = Math.max(0, Math.floor(camera.x / T)), x1 = Math.min(MAP_W - 1, Math.ceil((camera.x + camera.w) / T));
    const y0 = Math.max(0, Math.floor(camera.y / T)), y1 = Math.min(MAP_H - 1, Math.ceil((camera.y + camera.h) / T));
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const ch = tiles[cy][cx];
      if ((ch === "~" || ch === "w") && tileAt(cx, cy - 1) !== ch) {
        const gx = cx * T + T / 2, gy = cy * T + 8;
        const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, T);
        g.addColorStop(0, ch === "~" ? "rgba(140,255,80,0.14)" : "rgba(90,180,255,0.08)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(gx - T, gy - T, T * 2, T * 2);
      }
    }
    // the nucleus — the part of you that is still you
    const p = player;
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    const r = 26 * (0.5 + self / 200);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(255,120,150,${0.25 * self / 100 + 0.05})`);
    g.addColorStop(1, "rgba(255,77,109,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawScreenFX() {
    // Losing yourself: the edges close in and go red
    const loss = clamp(1 - self / 55, 0, 1);
    if (loss > 0) {
      const pulse = 0.75 + 0.25 * Math.sin(time * TAU / 1.3);
      const g = ctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * (0.55 - loss * 0.25), VW / 2, VH / 2, Math.max(VW, VH) * 0.75);
      g.addColorStop(0, "rgba(80,0,20,0)");
      g.addColorStop(1, `rgba(80,0,20,${0.65 * loss * pulse})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VW, VH);
    }
    // Drying out: the edges go pale and cracked
    if (player.form === "parasite" && moisture < 50) {
      const d = 1 - moisture / 50;
      const g = ctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * 0.4, VW / 2, VH / 2, Math.max(VW, VH) * 0.75);
      g.addColorStop(0, "rgba(200,180,150,0)");
      g.addColorStop(1, `rgba(200,180,150,${0.35 * d})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VW, VH);
    }
    if (struggle.t > 0) {
      const k = Math.min(1, struggle.t / 0.5, (2.6 - struggle.t) / 0.4);
      ctx.fillStyle = `rgba(120,80,40,${0.28 * k})`;
      ctx.fillRect(0, 0, VW, VH);
      const g = ctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * 0.25, VW / 2, VH / 2, Math.max(VW, VH) * 0.7);
      g.addColorStop(0, "rgba(40,20,10,0)"); g.addColorStop(1, `rgba(40,20,10,${0.7 * k})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    }
    if (hurtFlash > 0) {
      ctx.fillStyle = `rgba(255,40,70,${hurtFlash * 0.18})`;
      ctx.fillRect(0, 0, VW, VH);
    }
  }

  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawBackground();

    const sx = shake ? rand(-shake, shake) : 0, sy = shake ? rand(-shake, shake) : 0;
    ctx.setTransform(DPR * scale, 0, 0, DPR * scale, (-camera.x * scale + sx) * DPR, (-camera.y * scale + sy) * DPR);
    drawRooms();
    drawTiles();
    drawDoors();
    drawMirrors();
    drawCheckpoints();
    drawWebs();
    drawNozzles();
    drawCocoons();
    drawSpiders();
    drawValves();
    drawTraps();
    drawBaits();
    drawUrges();
    drawBeetles();
    drawAnts();
    drawCats();
    drawExterminators();
    drawPlayer();
    drawParticles("mist");
    drawFog();
    drawShade();

    ctx.setTransform(DPR * scale, 0, 0, DPR * scale, (-camera.x * scale + sx) * DPR, (-camera.y * scale + sy) * DPR);
    drawBeams();
    drawLamps();
    drawKeys();
    drawEyesInDark();
    drawShards();
    drawParticles("glow");
    drawGlows();
    drawFlood();
    drawExit();

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawScreenFX();
  }

  // ---------------------------------------------------------------------------
  // HUD, hints & whispers
  // ---------------------------------------------------------------------------

  function updateHostUI() {
    const p = player;
    if (!p) return;
    if (p.form !== "parasite") {
      const spec = HOSTS[p.form];
      ui.hostName.textContent = { man: "a man", roach: "cockroach" }[p.form] || p.form;
      ui.hostHp.innerHTML = Array.from({ length: maxHp(p.form) }, (_, i) => `<i class="${i < p.hp ? "on" : ""}"></i>`).join("")
        + (heldKeys.size ? ' <span class="key-icon" title="keys">⚷</span>' : "");
    } else {
      ui.hostName.textContent = "none";
      ui.hostHp.innerHTML = "";
    }
    ui.moist.classList.toggle("show", p.form === "parasite");
    ui.wings.classList.toggle("show", p.form === "crow" || p.form === "moth");
    ui.traits.innerHTML = [...traits].map((t) => `<span class="trait">${t}</span>`).join("");
    ui.shards.textContent = `${takenShards.size}/${LEVEL.entities.filter((e) => e.type === "shard").length}`;
  }

  function updateHUD() {
    const v = Math.max(0, Math.round(self));
    ui.selfValue.textContent = `${v}%`;
    ui.selfFill.style.transform = `scaleX(${clamp(self / 100, 0, 1)})`;
    ui.selfMeter.classList.toggle("low", self < 35);
    ui.moistFill.style.transform = `scaleX(${clamp(moisture / 100, 0, 1)})`;
    ui.moist.classList.toggle("low", moisture < 35);
    if (player.form === "crow" || player.form === "moth") ui.wingsFill.style.transform = `scaleX(${clamp(player.stamina, 0, 1)})`;

    // Each hint shows once, the first time you pass close to it (a hint with
    // a y only shows on that floor)
    const tx = (player.x + player.w / 2) / T, ty = (player.y + player.h) / T;
    const h = LEVEL.hints.find((hn, i) => !shownHints.has(i) && Math.abs(tx - hn.x) < 1.5 && (hn.y === undefined || Math.abs(ty - hn.y) < 4));
    if (h) {
      shownHints.add(LEVEL.hints.indexOf(h));
      showHint(h.text);
    }
  }

  let hintTimer = null;
  function showHint(html) {
    ui.hint.classList.remove("show");
    clearTimeout(hintTimer);
    setTimeout(() => {
      ui.hint.innerHTML = html;
      ui.hint.classList.add("show");
      hintTimer = setTimeout(() => ui.hint.classList.remove("show"), 7000);
    }, 250);
  }

  function whisper(text, { near = false, x, y, peak, own = false, dur } = {}) {
    const el = document.createElement("span");
    el.className = `whisper${own ? " own" : ""}`;
    el.textContent = text;
    let sx, sy;
    if (x !== undefined) {
      sx = (x - camera.x) * scale;
      sy = (y - camera.y) * scale;
    } else if (near) {
      sx = (player.x - camera.x) * scale + rand(-160, 160);
      sy = (player.y - camera.y) * scale + rand(-130, -50);
    } else {
      sx = rand(VW * 0.05, VW * 0.75);
      sy = rand(VH * 0.1, VH * 0.7);
    }
    el.style.left = `${clamp(sx, 16, VW - 40)}px`;
    el.style.top = `${clamp(sy, 70, VH - 120)}px`;
    el.style.fontSize = `${own ? 1.35 : rand(0.95, 1.3).toFixed(2)}rem`;
    el.style.setProperty("--dur", `${dur || rand(5.5, 8).toFixed(1)}s`);
    el.style.setProperty("--peak", (peak ?? rand(0.25, 0.42)).toFixed(2));
    ui.whispers.appendChild(el);
    const overflow = el.offsetLeft + el.offsetWidth - (VW - 16);
    if (overflow > 0) el.style.left = `${Math.max(16, el.offsetLeft - overflow)}px`;
    el.addEventListener("animationend", () => el.remove());
  }

  // A level can give each kind of host its own memories
  function memoriesOf(kind) {
    const m = LEVEL.hostMemories;
    return Array.isArray(m) ? m : (m && m[kind]) || HOSTS[kind].urges;
  }

  function updateWhispers(dt) {
    if (player.form === "parasite") return;
    nextHostWhisper -= dt;
    if (nextHostWhisper <= 0) {
      whisper(pick(memoriesOf(player.form)), { peak: lerp(0.5, 0.25, self / 100) });
      nextHostWhisper = lerp(3, 11, self / 100);
    }
  }

  // ---------------------------------------------------------------------------
  // Game states
  // ---------------------------------------------------------------------------

  const DEATHS = {
    self: ["You are the beetle now.", "It doesn't remember being anything else. Neither do you."],
    dried: ["You dried out.", "Out in the air you're just a thread of wet flesh. Find a body — or water — sooner."],
    poison: ["Exterminated.", "The poison was meant for something else. It worked on you too."],
    eaten: ["Eaten.", "To the ants you were only food."],
    webbed: ["Caught.", "The spider didn't care what was inside its prey."],
    cat: ["Caught.", "The cat played with you for a while first."],
    trap: ["Snapped.", "The trap was set for a rat. It didn't care what was inside."],
    gas: ["Gassed.", "The fog was meant for the whole house. It found you too."],
    spikes: ["Impaled.", "Pigeon spikes. Every ledge in the city is built to keep things off it."],
  };

  function die(kind) {
    if (state !== "play") return;
    state = "dead";
    audio.death();
    shake = 10;
    if (player.form === "parasite") burst(player.x + player.w / 2, player.y + player.h / 2, 40, "#ff4d6d", 140);
    const [title, text] = kind === "self" ? specOf(player.form).becoming || DEATHS.self : DEATHS[kind];
    ui.deadTitle.textContent = title;
    ui.deadText.textContent = text;
    ui.prompt.classList.remove("show");
    setTimeout(() => { ui.dead.hidden = false; ui.dead.querySelector("button").focus(); }, 900);
  }

  function retry() {
    ui.dead.hidden = true;
    respawn();
  }

  function recordJourney() {
    const j = loadJourney();
    j.memories = j.memories || {};
    j.memories[LEVEL.id] = [...new Set([...(j.memories[LEVEL.id] || []), ...takenShards])];
    j.hosts = (j.hosts || 0) + hostsTaken;
    j.hostsBy = j.hostsBy || {};
    j.hostsBy[LEVEL.id] = hostsTaken;
    saveJourney(j);
    return j;
  }

  function win() {
    if (state !== "play") return;
    state = "won";
    audio.chime();
    audio.fadeTo(0.12, 3);
    const j = recordJourney();
    const next = LEVEL_ORDER[LEVEL_ORDER.indexOf(LEVEL.id) + 1];
    try {
      // Continue picks up at the start of the next chapter
      if (next) localStorage.setItem(SAVE_KEY, JSON.stringify({ level: next, checkpoint: null, shards: [], hosts: 0, time: 0 }));
      else localStorage.removeItem(SAVE_KEY);
    } catch (e) { /* ignore */ }
    const outro = LEVEL.outro || {};
    ui.wonKicker.textContent = outro.kicker || "chapter complete";
    ui.wonTitle.textContent = outro.title || "You got out.";
    ui.wonText.textContent = outro.text || "";
    ui.wonNext.innerHTML = outro.next || "";
    ui.nextBtn.hidden = !next;
    ui.nextBtn.dataset.next = next || "";
    const total = LEVEL.entities.filter((e) => e.type === "shard").length;
    const mins = Math.floor(levelTime / 60), secs = Math.floor(levelTime % 60).toString().padStart(2, "0");
    ui.wonStats.innerHTML = `
      <div><span>time</span><b>${mins}:${secs}</b></div>
      <div><span>bodies worn</span><b>${hostsTaken}</b></div>
      <div><span>memories of your own</span><b>${takenShards.size}/${total}</b></div>
      <div><span>self remaining</span><b>${Math.round(self)}%</b></div>
      <div class="wide"><span>memories carried so far</span><b>${journeyMemories(j)}/${TOTAL_MEMORIES}</b></div>`;
    setTimeout(() => { ui.won.hidden = false; ui.won.querySelector("button").focus(); }, 1600);
  }

  // All four chapters have four memories each
  const TOTAL_MEMORIES = 16;

  function ending() {
    if (state !== "play") return;
    state = "ending";
    setPrompt("");
    audio.fadeTo(0.08, 4);
    audio.chime();
    recordJourney();
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
    setTimeout(() => {
      ui.ending.hidden = false;
      ui.endingChoice.hidden = false;
      ui.endingText.hidden = true;
      ui.ending.querySelector("button").focus();
    }, 1400);
  }

  function chooseEnding(choice) {
    const j = loadJourney();
    const found = journeyMemories(j);
    const endings = LEVEL.endings;
    let e;
    const gaveIn = j.gaveIn || 0;
    if (choice === "stay") e = endings.stay;
    else if (found >= 12 && self >= 25 && gaveIn <= 2) e = endings.yourself;
    else e = endings.nobody;
    // What you carried, and what you let them have
    const extra = [];
    for (const kind of Object.keys(TRAITS)) if ((j.traits || []).includes(TRAITS[kind].id)) extra.push(TRAITS[kind].ending);
    if (j.lena) extra.push(choice === "stay" ? "You put her drawing back on the fridge, where he always kept it." : "You keep one thing of his: the drawing. A house, a family, a smiling sun.");
    if (gaveIn >= 3) extra.push("You gave them what they wanted, again and again. It got easier every time.");
    e = { ...e, lines: [...e.lines, ...extra] };
    ui.endingChoice.hidden = true;
    ui.endingText.hidden = false;
    ui.endingText.innerHTML = `
      <p class="kicker">${e.kicker}</p>
      <h2>${e.title}</h2>
      ${e.lines.map((l) => `<p class="sub">${l}</p>`).join("")}
      <p class="tally">memories of your own: ${found}/${TOTAL_MEMORIES} · bodies worn: ${j.hosts || 0} · gave in: ${gaveIn}</p>
      <p class="credits-line">PARASITE · thank you for playing</p>
      <button class="menu-item" data-action="title">Title screen</button>`;
    audio.chime();
    ui.endingText.querySelector("button").focus();
  }

  function goto(target) {
    try { sessionStorage.setItem("parasite.goto", JSON.stringify(target)); } catch (e) { /* ignore */ }
    location.href = target.chapter ? `game.html?chapter=${target.chapter}` : "game.html?continue";
  }

  // ---- Pause menu: the map, gentle mode, controls -------------------------

  const ACTIONS = [
    ["left", "Move left"], ["right", "Move right"], ["up", "Up · climb · flap"], ["down", "Down · let go"],
    ["jump", "Jump · flap"], ["burrow", "Burrow in · use"], ["leave", "Leave the host"],
  ];
  const keyName = (code) => code.replace(/^Key/, "").replace(/^Digit/, "").replace("Arrow", "").replace("Space", "Space");

  function renderBinds() {
    const box = document.getElementById("binds");
    box.innerHTML = ACTIONS.map(([act, label]) => {
      const keys = Object.entries(KEYMAP).filter(([, a]) => a === act).map(([c]) => keyName(c));
      const listening = rebinding === act;
      return `<div class="bind"><span>${label}</span><button data-bind="${act}" class="${listening ? "listening" : ""}">${listening ? "press a key…" : keys.join(" · ")}</button></div>`;
    }).join("");
  }
  document.getElementById("binds").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-bind]");
    if (!b) return;
    rebinding = b.dataset.bind;
    renderBinds();
  });

  function drawMap() {
    const c = document.getElementById("map");
    const px = Math.max(2, Math.min(5, Math.floor(560 / MAP_W)));
    c.width = MAP_W * px;
    c.height = MAP_H * px;
    const m = c.getContext("2d");
    m.fillStyle = "#07050a";
    m.fillRect(0, 0, c.width, c.height);
    const solidCol = THEME === "city" ? "#2c2a36" : THEME === "house" ? "#3a2c24" : "#3a2530";
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      const ch = tiles[y][x];
      if (isSolid(ch, "beetle")) { m.fillStyle = ch === "=" ? "#5a3a2a" : solidCol; m.fillRect(x * px, y * px, px, px); }
      else if (ch === "~") { m.fillStyle = "#4a8a2a"; m.fillRect(x * px, y * px, px, px); }
      else if (ch === "w") { m.fillStyle = "#2a5a8a"; m.fillRect(x * px, y * px, px, px); }
    }
    const dot = (wx, wy, col, r = px) => { m.fillStyle = col; m.beginPath(); m.arc(wx / T * px, wy / T * px, r, 0, TAU); m.fill(); };
    if (exitZone) dot(exitZone.x + exitZone.w / 2, exitZone.y + T, "#7fb4ff", px * 1.4);
    for (const mm of mirrors) dot(mm.x + T / 2, mm.y + T, "#7fb4ff", px * 1.4);
    for (const cp of checkpoints) dot(cp.x + T / 2, cp.y + T / 2, "#5ef2c9");
    for (const sh of shards) if (!sh.taken) dot(sh.x, sh.y, "#ffd1dc");
    for (const b of beetles) if (b.state === "asleep") dot(b.x + b.w / 2, b.y + b.h / 2, "#e8c860", px * 0.8);
    dot(player.x + player.w / 2, player.y + player.h / 2, "#ff4d6d", px * 1.6);
    m.strokeStyle = "rgba(236,227,214,0.35)";
    m.lineWidth = 1;
    m.strokeRect(camera.x / T * px, camera.y / T * px, camera.w / T * px, camera.h / T * px);
  }

  function showControls(on) {
    document.getElementById("controls-panel").hidden = !on;
    document.getElementById("pause-menu").hidden = on;
    if (on) { renderBinds(); document.querySelector("#binds button").focus(); }
    else ui.pause.querySelector("button").focus();
  }

  function setPaused(on) {
    if (on && state === "play") { drawMap(); showControls(false); }
    if (on && state === "play") { state = "paused"; ui.pause.hidden = false; ui.pause.querySelector("button").focus(); }
    else if (!on && state === "paused") { state = "play"; ui.pause.hidden = true; keys.clear(); }
  }

  document.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-action]");
    if (!btn) return;
    audio.tick();
    switch (btn.dataset.action) {
      case "resume": setPaused(false); break;
      case "restart": ui.pause.hidden = true; respawn(); break;
      case "retry": retry(); break;
      case "sound": ui.soundState.textContent = audio.toggle() ? "on" : "off"; break;
      case "gentle":
        gentleMode = !gentleMode;
        try { localStorage.setItem("parasite.gentle", gentleMode ? "on" : "off"); } catch (e) { /* ignore */ }
        document.getElementById("gentle-state").textContent = gentleMode ? "on" : "off";
        break;
      case "controls": showControls(true); break;
      case "controls-back": rebinding = null; showControls(false); break;
      case "reset-keys":
        customKeys = {};
        try { localStorage.removeItem("parasite.keys"); } catch (e) { /* ignore */ }
        KEYMAP = { ...DEFAULT_KEYMAP };
        renderBinds();
        break;
      case "title": location.href = "index.html"; break;
      case "replay":
        try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
        goto({ chapter: LEVEL.id });
        break;
      case "next":
        goto({ chapter: btn.dataset.next });
        break;
      case "stay": case "leave":
        chooseEnding(btn.dataset.action);
        break;
      case "pause": setPaused(true); break;
    }
    // Hand the keyboard back to the game once we're playing again
    if (state === "play" && document.activeElement) document.activeElement.blur();
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden) setPaused(true); });

  // ---------------------------------------------------------------------------
  // Loop
  // ---------------------------------------------------------------------------

  let last = performance.now();
  let lastForm = null;
  function frame(now) {
    const dt = Math.min(1 / 30, (now - last) / 1000);
    last = now;
    time += dt;

    if (tapped("pause")) {
      if (state === "play") setPaused(true);
      else if (state === "paused") setPaused(false);
    }
    if (state === "dead" && !ui.dead.hidden && (tapped("confirm") || tapped("jump"))) retry();

    if (state === "play") {
      levelTime += dt;
      updatePlayer(dt);
      updateAnts(dt);
      updateSpiders(dt);
      updateFlood(dt);
      updateCats(dt);
      updateExterminators(dt);
      updateTraps(dt);
      updateFog(dt);
      updateHusks(dt);
      updateNozzles(dt);
      updateWhispers(dt);
      if (player.form !== lastForm) { lastForm = player.form; audio.muffle(player.form === "parasite" ? 0 : 1); }
    } else if (state === "dead" || state === "won" || state === "ending") {
      updateNozzles(dt);
      updateSpiders(dt);
      updateFog(dt);
    }
    updateParticles(dt);
    updateCamera(dt);
    updateHUD();
    shake = Math.max(0, shake - dt * 30);
    hurtFlash = Math.max(0, hurtFlash - dt * 3);
    render();
    pressed.clear();
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------

  ui.soundState.textContent = audio.enabled ? "on" : "off";
  document.getElementById("gentle-state").textContent = gentleMode ? "on" : "off";
  if (LEVEL.card) {
    ui.cardKicker.textContent = LEVEL.card.kicker;
    ui.cardTitle.innerHTML = LEVEL.card.title;
    document.title = `Parasite — ${LEVEL.card.name || LEVEL.id}`;
  }
  window.addEventListener("resize", resize);
  resize();
  if (resuming) load();
  for (const t of loadJourney().traits || []) traits.add(t);
  respawn();

  // Chapter card
  function endIntro() {
    if (!intro) return;
    intro = false;
    ui.card.classList.add("gone");
  }
  setTimeout(endIntro, reduceMotion ? 1500 : 3800);
  setTimeout(() => whisper(LEVEL.firstWhisper || "where am I?", { near: true, peak: 0.45 }), 4600);

  // Expose a tiny hook for automated testing
  window.__parasite = {
    get player() { return player; }, get self() { return self; }, get moisture() { return moisture; },
    get state() { return state; }, teleport(tx, ty) { player.x = tx * T + 4; player.y = ty * T + T - player.h - 0.01; player.vx = player.vy = 0; camera.snap = true; },
    set self(v) { self = v; }, set moisture(v) { moisture = v; },
    get sprays() { return nozzles.map((n) => !!n.spraying); },
    get spiders() { return spiders.map((sp) => ({ x: sp.x / T, state: sp.state })); },
    get ants() { return ants.map((a) => ({ x: a.x / T, dir: a.dir })); },
    get flood() { return flood && { active: flood.active, y: flood.y / T }; },
    get shards() { return takenShards.size; },
    get cats() { return cats.map((c) => ({ x: c.x / T, state: c.state })); },
    get exterminators() { return exterminators.map((e) => ({ x: e.x / T, state: e.state })); },
    get valves() { return valves.map((v) => v.closed); },
    get keys() { return [...heldKeys]; },
    get level() { return LEVEL.id; },
    get traits() { return [...traits]; },
    get struggling() { return struggle.t > 0; },
    get catStates() { return cats.map((c) => c.state); },
    wear(seconds) { wornTime[player.form] = (wornTime[player.form] || 0) + seconds; },
    spawn(form, tx, ty) {
      ui.dead.hidden = true;
      player = makePlayer(form, tx * T + 4, ty * T + T - specOf(form).h - 0.01);
      self = 100; moisture = 100; state = "play"; camera.snap = true; updateHostUI();
    },
  };

  requestAnimationFrame(frame);
})();
