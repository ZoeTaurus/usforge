# HELLDRIVE

An open-world, low-poly 3D browser game: invade Hell in a car you build
yourself (and never, ever get out of).

**Current stage: Milestone 4 — damage and scrap.** There is no health bar:
every body section and bolted-on part takes its own damage, chars, smokes and
breaks off as scrap. Lose the cabin and you're wrecked. Press **E** to grab
scrap, then bolt it back on (anywhere!) in the garage (**G**), which also
repairs whatever is still attached. The garage won't open with demons close.

## How to play (easiest)

Double-click **`HELLDRIVE.html`**. That's it: no install, works offline.
(Opening `index.html` directly will NOT work; that's the developer version.)

To rebuild `HELLDRIVE.html` after changing code: `npm run build:single`.

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
| G | Garage: build + repair (pauses; not with demons close) |
| T | Live tuning panel |
| M | Mute |
| H | Hide help |

## Changing how it feels

All the "feel" numbers (speed, turning, weight, grip, camera) are in
**`src/settings.js`**, each with a plain-English comment. Edit a number,
save, and the game reloads. Or press **T** in-game to drag sliders live.

## Folder layout

```
index.html            the web page
src/
  main.js             starts the game and runs the main loop
  settings.js         ALL the tweakable feel numbers
  style.css           look of the on-screen text
  core/               input, physics setup, sound, random numbers
  regions/            one data file per region (Ash Plains so far)
  world/              sky, ground, scenery, visual effects, gore, scrap
  vehicle/            the car's driving physics, 3D model, parts + build grid
  demons/             demon types (data), their 3D models, spawning + AI
  combat/             bullets and the damage-per-minute tracker
  camera/             the chase camera
  ui/                 speedometer, help text, tuning panel, garage
```

## Tech

Three.js (3D graphics), Rapier (physics), Vite (dev server / build).
Everything is generated from code: no art or sound files.

To make a version for a website: `npm run build`, then upload the `dist/` folder.
