// Boots the game and runs the frame loop.
(() => {
  const V = window.VAX;
  // One clock for everything. (The timestamp browsers pass to requestAnimationFrame can run on a slightly different
  // clock than performance.now() — on some machines it lags behind, which made the first frame after pressing Play
  // run time *backwards*: every power-up timer counted up, shooting locked for seconds, and the wave never started.)
  let last = performance.now();
  V.loop = { resetClock: () => { last = performance.now(); } };
  let crashed = false;

  function frame() {
    requestAnimationFrame(frame);   // schedule first, so one bad frame can never stop the loop
    const now = performance.now();
    let dt = Math.min(Math.max(0, (now - last) / 1000), 1 / 30); last = now;
    // when watching the bot, the sim can run 2× or 4× by stepping several times per frame
    // (the admin console can freeze the game while it's open, or change its speed)
    const sp = V.admin?.speed || 1;
    const steps = !dt || V.admin?.frozen ? 0 : (V.G.bot && V.G.mode === 'play' ? V.bot.speed : 1) * Math.max(1, Math.round(sp));
    if (sp < 1) dt *= sp;
    try {
      for (let k = 0; k < steps; k++) {
        V.G.clock += dt;
        if (V.G.bot) V.bot.think(dt);
        V.game.update(dt);
      }
      if (V.G.mode === 'title') V.home.frame(dt); else V.render();
      V.ui.frame();
    } catch (err) {
      // keep running, but say so once (and leave details in the console for bug reports)
      console.error('Vax Attack frame error:', err);
      if (!crashed) { crashed = true; try { V.ui.toast('Something glitched — if it keeps happening, reload the page', '#ff7a8a'); } catch (e) {} }
    }
  }

  // language: English unless the player picked another one in Settings (browser language lists often put a
  // second language first, which made the game open in Chinese for some players)
  V.i18n.set(V.ui.load('lang', null) || 'en');
  V.ui.resetHud();
  requestAnimationFrame(frame);
})();
