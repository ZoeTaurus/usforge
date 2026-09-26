// Forge sparks: glowing embers drifting up a canvas. Used big on the title screen, and faintly behind every page.
// Embers(canvas, { count, alpha, speed }) → { stop() }. Respects "reduce motion" (draws one still frame).
window.Embers = (cv, { count = 40, alpha = 1, speed = 1 } = {}) => {
  const g = cv.getContext('2d'), calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let on = true, sparks = [];
  const dpr = () => Math.min(2, devicePixelRatio || 1);
  const fit = () => { cv.width = cv.clientWidth * dpr(); cv.height = cv.clientHeight * dpr(); };
  const spawn = (anywhere) => ({
    x: Math.random() * cv.width, y: anywhere ? Math.random() * cv.height : cv.height + 10,
    vy: -(0.5 + Math.random() * 1.6) * dpr() * speed, vx: (Math.random() - .5) * .5,
    r: (0.8 + Math.random() * 2) * dpr(), life: .4 + Math.random() * .6, fade: .0015 + Math.random() * .0035, hue: 10 + Math.random() * 30,
  });
  fit(); addEventListener('resize', fit);
  for (let i = 0; i < count; i++) sparks.push(spawn(true));
  (function tick() {
    if (!on) return;
    if (!document.hidden) {
      g.clearRect(0, 0, cv.width, cv.height);
      for (const s of sparks) {
        s.x += s.vx + Math.sin(s.y * .01) * .3; s.y += s.vy; s.life -= s.fade;
        if (s.life <= 0 || s.y < -10) Object.assign(s, spawn(false));
        g.globalAlpha = Math.max(0, s.life) * alpha; g.fillStyle = `hsl(${s.hue} 100% 60%)`;
        g.beginPath(); g.arc(s.x, s.y, s.r, 0, Math.PI * 2); g.fill();
      }
    }
    if (!calm) requestAnimationFrame(tick);
  })();
  return { stop() { on = false; g.clearRect(0, 0, cv.width, cv.height); } };
};
