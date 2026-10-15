# HELLDRIVE

An open-world, low-poly 3D browser game: invade Hell in a car you build
yourself (and never, ever get out of).

**Current stage: Milestone 1 — driving feel.**

## How to run it

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
| Click (hold) | Fire (visual only for now) |
| Mouse wheel | Zoom camera |
| R | Unstick the car |
| Backspace | Back to the start |
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
  world/              sky, ground, scenery, visual effects
  vehicle/            the car's driving physics and 3D model
  camera/             the chase camera
  ui/                 speedometer, help text, tuning panel
```

## Tech

Three.js (3D graphics), Rapier (physics), Vite (dev server / build).
Everything is generated from code: no art or sound files.

To make a version for a website: `npm run build`, then upload the `dist/` folder.
