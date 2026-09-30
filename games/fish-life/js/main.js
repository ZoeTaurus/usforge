'use strict';
/* =====================================================================
   FISH LIFE  -  main.js
   Boot-up: build the art, size the canvas, run the fixed-step loop.
   ===================================================================== */

// Integer scaling keeps every game pixel the exact same size on screen.
// If that would waste lots of space we fall back to a fractional scale.
// The canvas fills the content box of its parent (padding respected).
function fitCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const par = canvasEl.parentElement, cs = getComputedStyle(par);
  const availW = (par.clientWidth || window.innerWidth) - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0);
  const availH = (par.clientHeight || window.innerHeight) - parseFloat(cs.paddingTop || 0) - parseFloat(cs.paddingBottom || 0);
  const fit = Math.max(0.25, Math.min((availW * dpr) / W, (availH * dpr) / H));
  let s = Math.floor(fit);
  if (s < 1 || s / fit < 0.8) s = fit;
  canvasEl.style.width = (W * s) / dpr + 'px';
  canvasEl.style.height = (H * s) / dpr + 'px';
}
window.addEventListener('resize', fitCanvas);
document.addEventListener('fullscreenchange', fitCanvas);

// A tiny pixel-art favicon made from the hero fish.
function setFavicon() {
  try {
    const c = makeCanvas(16, 16), g = c.getContext('2d');
    g.drawImage(SPR.hero1.r[0], 0, 3);
    const link = document.createElement('link');
    link.rel = 'icon';
    link.href = c.toDataURL('image/png');
    document.head.appendChild(link);
  } catch (e) { /* ignore */ }
}

// Pause gameplay when the tab loses focus.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && Game.scene && Game.scene.onBlur) Game.scene.onBlur();
});
window.addEventListener('blur', () => {
  if (Game.scene && Game.scene.onBlur) Game.scene.onBlur();
});

buildSprites();
setFavicon();
fitCanvas();

const STEP = 1 / 60;
let lastTime = performance.now(), acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - lastTime) / 1000;
  lastTime = now;
  if (dt > 0.25) dt = 0.25;
  acc += dt;
  let n = 0;
  while (acc >= STEP && n < 6) {
    Game.update(STEP);
    clearInputFrame();
    acc -= STEP;
    n++;
  }
  if (n >= 6) acc = 0;
  // only redraw when the game actually moved on (saves work on 120/144Hz screens)
  if (n > 0) Game.draw();
}

// Start on the title screen, or straight back into a run that a live
// preview host handed back to us after reloading the page.
function boot(data) {
  if (data && data.gs && data.gs.chapter && data.gs.chapter !== 'done') {
    GS = Object.assign(newGameState(), data.gs);
    Game.set(sceneForChapter());
  } else {
    Game.set(new TitleScene());
  }
  requestAnimationFrame(frame);
}
const hotHost = window.claude && window.claude.hot;
if (hotHost && typeof hotHost.snapshot === 'function') {
  try { hotHost.snapshot(() => ({ gs: Game.scene instanceof TitleScene ? null : GS })); } catch (e) { /* optional */ }
}
if (hotHost && typeof hotHost.ready === 'function') hotHost.ready(boot);
else boot((hotHost && hotHost.data) || {});

// Handy hooks for testing from the browser console.
window.FishLife = {
  Game,
  get state() { return GS; },
  goto(name, opt = {}) {
    const map = {
      title: () => new TitleScene({ skipIntro: true }),
      sea: () => new SeaScene(),
      caught: () => new StoryScene('caught'),
      home: () => new StoryScene('home'),
      bowl: () => new BowlScene(),
      ending: () => new EndingScene(),
    };
    Object.assign(GS, opt);
    Game.set(map[name]());
  },
};
