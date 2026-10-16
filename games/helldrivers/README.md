# HellDrivers

*(A loving nod to Helldivers. Same spirit, but you never leave the car.)*

An open-world, low-poly 3D browser game: invade Hell in a car you build
yourself (and never, ever get out of).

**Current stage: Milestone 7 — regions (part 1: the Lava Rivers).** Beat the
Ash Titan and a **Hellgate** opens next to its arena: drive through it to
reach region 2, **the Lava Rivers**: black basalt plains cut by rivers of
lava. Lava burns your car from below and bogs it down, so you'll want an
Armored Car (or better) and **Hover Fans** (each fan = 25% less burn and
drag, 4 = immune). Cross on the dark crust bridges. New demons: **Fire Imps**
(their claws set you on fire) and **Magma Brutes** (ramming one burns your
front). The boss, **the Magma Colossus**, waits on an island in a lake of lava
and throws lava bombs that leave burning pools.

Souls from kills buy parts and chassis upgrades in the garage (**G**):
Muscle Car → Armored Car → Half-Track → **HELL TANK**.

Get wrecked (lose the cabin) and the whole run starts over, back in the Ash
Plains: a complete stock car, the starting parts kit, zero souls, nothing unlocked, fresh demons, and
the Titan asleep again. (Set `progression.keepOnWreck` to `true` in
`src/settings.js` to keep souls and unlocks.)

Damage is physical: every body section and bolted-on part takes its own
damage and breaks off as that actual piece. Press **E** to grab scrap, then
bolt it back on in the garage (**G**), anywhere you like.

## How to play (easiest)

Double-click **`HELLDRIVERS.html`**. That's it: no install, works offline.
(The developer version of the page lives in `src/index.html`; it only works through `npm start`.)

To rebuild `HELLDRIVERS.html` after changing code: `npm run build:single`.

## How to run it (developer mode, live-reloads when you edit settings)

You need [Node.js](https://nodejs.org) (the "LTS" version) installed once.
Then, in a terminal inside this folder:

```
npm install && npm start
```

Your browser opens the game at http://localhost:5173. (After the first time,
`npm start` alone is enough.) Stop it with `Ctrl + C` in the terminal.

## Controls

| Key | Action |
| --- | --- |
| W / S (or arrows) | Gas / brake, then reverse |
| A / D | Steer |
| Space | Handbrake (drift!) |
| Mouse | Aim the roof gun |
| Click (hold) | Fire the roof gun |
| Mouse wheel | Zoom camera |
| R | Unstick the car |
| Backspace | Back to the start |
| E | Grab scrap that fell off your car |
| R (in garage) | Turn a loose car piece before placing it |
| Ctrl/⌘ + Z (in garage) | Undo the last change |
| G | Garage: build + repair (pauses; not with demons close) |
| C | Dev / creative panel: no enemies, no damage, free building, jump to any region |
| T | Live tuning panel |
| M | Mute |
| H | Hide help |

## Changing how it feels

All the "feel" numbers (speed, turning, weight, grip, camera) are in
**`src/settings.js`**, each with a plain-English comment. Edit a number,
save, and the game reloads. Or press **T** in-game to drag sliders live.

## Folder layout

```
src/
  index.html          the web page (developer version)
  main.js             starts the game and runs the main loop
  settings.js         ALL the tweakable feel numbers
  style.css           look of the on-screen text
  core/               input, physics setup, sound, random numbers
  regions/            one data file per region (Ash Plains, Lava Rivers) + the travel order
  world/              sky, ground, scenery, lava (hazards), Hellgates, effects, gore, scrap
  vehicle/            the car's driving physics, 3D model, parts + build grid
  demons/             demon types (data), 3D models, spawning + AI, the boss, fireballs
  combat/             bullets and the damage-per-minute tracker
  camera/             the chase camera
  ui/                 speedometer, help text, tuning panel, garage
```

## Tech

Three.js (3D graphics), Rapier (physics), Vite (dev server / build).
Everything is generated from code: no art or sound files.

To make a version for a website: `npm run build`, then upload the `dist/` folder.
