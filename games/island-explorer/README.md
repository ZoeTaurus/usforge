# Castaway: Three Isles

A top-down pixel-art survival and exploration game across nine islands. You're shipwrecked and need to
reach civilization, the town of **Port Haven** on the largest island.

## How to play

Open `index.html` in a browser (double-click works), or serve the folder:

```
python3 -m http.server 8123
```

then visit http://localhost:8123. It also works on phones and tablets with touch controls.

The title menu has **Continue**, **New Game** (pick *Relaxed*, *Normal* or *Survivor*), **Settings**
(music and sound volume, screen shake), **How to Play** and **Records** (best time per difficulty).
After you're rescued you can **Keep Exploring** the islands.

| Key | Action |
| --- | --- |
| WASD / Arrows | Move, or sail when you're in a boat |
| Shift | Sprint (burns food faster) |
| E / Enter | Interact: talk, pick, read, fish from your boat |
| Space | Swing: attack, chop trees, mine rocks |
| Q | Dodge-roll (you can't be hurt mid-roll) |
| B | Build mode: place walls, gates, campfires |
| C | Crafting menu (W/S select, E craft, or 1-9) |
| F / H | Eat cooked food / use a bandage |
| M | Map |
| Esc | Pause (music/sound toggles, save) |

Walk into the sea to set sail, and sail into a beach to go ashore.

## The journey

1. **Driftwood Isle** (start). With no tools you punch trees (slow). Pick up pebbles for stone,
   twist vines into rope, craft a **stone axe**, then a **raft** (12 wood + 3 rope).
2. **Verdant Isle** (jungle). Meet Tobias the shipwright. Find the key on the east beach,
   open the chest in the northern ruins, and bring the sailcloth, 10 wood and 2 rope. He'll build a sailboat.
3. **The Great Isle** (largest). Only the sailboat can cross the reef. Land on the west beach,
   repair the bridge (8 wood), cross Aurum Pass, and reach the fountain in Port Haven.

## Optional islands

| Island | What's there |
| --- | --- |
| Gull Rock (far NW) | Rocks and **iron ore**, buried gold |
| Crab Key (south of the jungle isle) | Crabs everywhere, a buried **spyglass** |
| Mossfen (far south) | Swamp, crocodiles, mushrooms, a golden idol |
| Palm Atoll (south of the reef) | Lagoon, **Salty Pete the trader**, a buried **compass** |
| Frostpeak (far NE) | Snow, wolves, bears, deer, cold (food drains faster), a golden idol |
| Ember Isle (far SE) | Lava, scorpions, lots of ore, a golden idol |

## Tools & crafting

Rope · Stone Axe · Stone Pickaxe · Raft · Bandage · Torch · Stone Spear · Fishing Rod ·
Leather Armor (hides) · Iron Axe · Iron Pickaxe · Iron Sword · Shovel.
Rock and ore need a pickaxe; iron comes from ore. The shovel digs up red X marks.

## How to fight

- **Space** swings in the direction you're facing. Face the enemy and get close.
- Damage per hit: fists 1 · stone spear 2 · iron sword 3 · Magma Blade 5. Creatures show a health bar once hit.
- **Q** dodge-rolls a short distance. You're invulnerable while rolling, which is the key to boss fights.
- Watch for tells: boars show **!** before charging (step aside, and they get stunned if they hit a wall), snakes lunge up close,
  crocodiles lunge from the shore, and wolves bite then back off.
- **Red circles** on the ground show where a boss attack will land. Roll or walk out before they fill.
- Hit bosses when they're **dazed** (spinning stars) for 1.5x damage.
- Armor cuts damage (leather -35%, Frostfang Cloak -55%). Heal with **H** (bandages) and **F** (food).

## Bosses

| Boss | Where | Attacks | Reward |
| --- | --- | --- | --- |
| Magmaw, the Molten Titan | Ember Isle crater (the lava bridge seals behind you) | Leaping slams, fireball rings, charges, summons scorpions | Magma Blade + Ember Heart (+25 max HP) |
| Old Frostfang | Frostpeak, north of the peak | Circles, pounces, howls for wolves | Frostfang Cloak (-55% damage, no cold) |
| The Bog King | Mossfen's west pool | Hides underground, bursts up under you, tail sweep, mud spit | Bog Boots (+18% speed) |

Below half health, each boss enrages and gets faster.

## Building

Craft **Wood Walls**, **Stone Walls**, **Gates** and **Campfires** [C], then press **B** to place them in front of you.
Animals can't pass walls or gates; you can walk through your gates. Chop or mine a wall to take it down and get materials back.
Placed campfires work as checkpoints, light and cooking spots.

## Danger

Food drains steadily, health only regenerates when you're well fed, and collapsing drops
**half your materials**. Wolves roam at night, sharks stalk rafts in deep water (swing to drive
them off), and each island has its own wildlife. Hunt rabbits and deer for meat and hides.

Also: 6 golden idols, 10 message bottles, supply crates on every beach, seashells, and Biscuit the lost cat.
Campfires are checkpoints and autosave points. **Continue** on the title screen resumes your game.

## Files

| File | Purpose |
| --- | --- |
| `index.html` / `css/style.css` | Page, HUD, menus, touch controls |
| `js/rng.js` | Seeded RNG and value noise |
| `js/tiles.js` | Tile ids and properties (walkable, sailable, ground/overlay/tall) |
| `js/story.js` | All dialog, signs, bottles |
| `js/sprites.js` | Procedural pixel art for ground, edges, trees, objects, characters, critters, and icons |
| `js/sound.js` | WebAudio sound effects, ambient waves and rain, generative music |
| `js/world.js` | World generation for all nine islands: biomes, ruins, town, road, idols, crates, dig spots, spawns |
| `js/fx.js` | Particles, screen shake, day/night lighting, weather, clouds, wildlife, pixel font |
| `js/bosses.js` | Boss AI, telegraphs, projectiles and boss art |
| `js/entities.js` | Wildlife AI (crab, snake, boar, rabbit, deer, wolf, bear, croc, scorpion, shark), townsfolk, Biscuit |
| `js/input.js` | Keyboard and touch input |
| `js/ui.js` | HUD, minimap, compass rose, boss bar, dialog, crafting, pause, map, win screen |
| `js/save.js` | Save / continue via localStorage |
| `js/menu.js` | Title menu, difficulty, settings, records |
| `js/game.js` | Game loop, movement and sailing, interactions, rendering |
