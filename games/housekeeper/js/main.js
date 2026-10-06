// Boot + main loop.
(function () {
  const canvas = document.getElementById('game');
  canvas.width = HS.W;
  canvas.height = HS.H;

  HS.Input.init();
  HS.Sprites.init();
  HS.Map.build();
  HS.Rulebook.setupDay(1);
  HS.Player.reset(true);
  HS.Render.init(canvas);
  HS.Home.init();
  HS.UI.init();
  HS.UI.updateMusicLabel();

  // Enter / Space activates the main button on menu screens.
  function screenKeys() {
    const G = HS.Game, I = HS.Input, el = HS.UI.el;
    const go = I.hit('enter', ' ');
    if (G.phase === 'card' && go) el['btn-start'].click();
    else if (G.phase === 'report' && go) el['btn-next'].click();
  }

  // Save when the tab is closed or hidden, so you never lose more than a moment.
  const saveNow = () => HS.Game.persist();
  addEventListener('pagehide', saveNow);
  addEventListener('beforeunload', saveNow);
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const G = HS.Game, UI = HS.UI, I = HS.Input;

    if (I.hit('m')) UI.toggleMusic();

    if (G.phase === 'play') {
      if (I.hit('escape')) UI.togglePause();
      if (!G.paused) HS.Uncanny.tick(dt);
      if (G.paused) {
        // frozen
      } else if (UI.isBlocking()) {
        UI.handleKeys();
        UI.setPrompt(null);
      } else if (!G.over) {
        // Hold F to fast-forward when you have nothing to do.
        const fast = I.down('f') && !G.sleeping;
        HS.UI.setFast(fast);
        HS.Clock.minutes += dt / HS.SECONDS_PER_HOUR * 60 * (G.sleeping ? HS.SLEEP_SPEED : fast ? 5 : 1);
        HS.Player.update(dt);
        G.update(dt);
        if (G.phase === 'play' && !G.over && !UI.isBlocking()) {
          const P = HS.Player;
          const o = P.sitting || HS.Map.nearest(P.x, P.y);
          UI.setPrompt(o ? G.prompt(o) : null);
          if (o && I.hit('e', ' ')) G.interact(o);
        }
      }
    } else if (G.phase === 'title') {
      HS.Home.update(dt);
    } else {
      screenKeys();
    }

    G.autosave(now);
    HS.Render.draw(dt);
    UI.update();
    I.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
