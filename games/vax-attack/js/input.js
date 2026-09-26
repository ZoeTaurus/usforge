// Keyboard, mouse and twin-stick touch input.
(() => {
  const V = window.VAX;
  const { W, H } = V;
  const G = V.G;
  const cvs = document.getElementById('game');
  const I = V.input = { keys: new Set(), mouse: { x: W / 2, y: H / 2, seen: false, down: false }, moveJoy: null, aimJoy: null, touchMode: false };
  I.release = () => { I.keys.clear(); I.mouse.down = false; I.moveJoy = I.aimJoy = null; };

  const GAME_KEYS = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'w', 'a', 's', 'd'];
  addEventListener('keydown', e => {
    if (e.target.closest?.('input, textarea') || V.admin?.open) return;   // typing in a text box (sign-in, console) isn't gameplay
    const k = e.key.toLowerCase();
    if (G.mode === 'upgrade' && ['1', '2', '3'].includes(k)) { if (!e.repeat) V.ui.pickUpgrade(+k - 1); return; }
    if (G.mode === 'upgrade' && k === 'enter' && !e.repeat && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); V.ui.continueWave(); return; }
    if (GAME_KEYS.includes(k) && G.mode === 'play') e.preventDefault();
    if (G.bot && (GAME_KEYS.includes(k) || k === 'shift')) return;   // the bot is driving; keep your keys out of its way
    if (k === 'shift' && !e.repeat && G.mode === 'play') I.dash = true;
    if (k === 'p' || k === 'escape') { if (G.mode === 'play') V.game.pause(); else if (G.mode === 'pause') V.game.resume(); }
    if (k === 'm') V.ui.toggleMute();
    // on the results screen a *fresh* Enter/Space starts a new run — held-down fire keys (e.repeat) never do
    // (the home screen handles its own keys in home.js)
    if ((k === 'enter' || k === ' ') && G.mode === 'over' && document.activeElement?.tagName !== 'BUTTON') {
      e.preventDefault();
      if (!e.repeat && V.ui.ready(700)) V.game.start(G.bot);
    }
    I.keys.add(k);
  });
  addEventListener('keyup', e => { if (!G.bot) I.keys.delete(e.key.toLowerCase()); });
  addEventListener('blur', () => { if (G.bot) return; I.release(); V.game.pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) V.game.pause(); });

  const toLogical = e => { const r = cvs.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; };
  cvs.addEventListener('pointermove', e => {
    if (G.bot) return;
    const [x, y] = toLogical(e);
    if (e.pointerType === 'mouse') { I.mouse.x = x; I.mouse.y = y; I.mouse.seen = true; I.touchMode = false; return; }
    const j = I.moveJoy?.id === e.pointerId ? I.moveJoy : I.aimJoy?.id === e.pointerId ? I.aimJoy : null;
    if (!j) return;
    j.x = x; j.y = y;
    let dx = x - j.ox, dy = y - j.oy; const d = Math.hypot(dx, dy), R = 16;
    if (d > R) { dx *= R / d; dy *= R / d; }
    j.dx = dx; j.dy = dy;
  });
  cvs.addEventListener('pointerdown', e => {
    if (G.bot) return;
    const [x, y] = toLogical(e);
    if (e.pointerType === 'mouse') {
      if (e.button === 0) Object.assign(I.mouse, { down: true, x, y, seen: true }), I.touchMode = false;
      if (e.button === 2) I.dash = true;   // right-click dashes
      return;
    }
    I.touchMode = true;
    const j = { id: e.pointerId, ox: x, oy: y, x, y, dx: 0, dy: 0 };
    if (x < W / 2) I.moveJoy = j; else I.aimJoy = j;
    cvs.setPointerCapture(e.pointerId);
  });
  const end = e => {
    if (G.bot) return;
    if (e.pointerType === 'mouse') I.mouse.down = false;
    if (I.moveJoy?.id === e.pointerId) I.moveJoy = null;
    if (I.aimJoy?.id === e.pointerId) I.aimJoy = null;
  };
  addEventListener('pointerup', end);
  addEventListener('pointercancel', end);
  cvs.addEventListener('contextmenu', e => e.preventDefault());
  // on-screen dash button for touch players (it sits above the canvas, so it doesn't start a joystick)
  document.getElementById('dashBtn').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (!G.bot) I.dash = true; });
})();
