// Secrets. Shh.
//  · type "potato" anywhere (or click Alex's Potato role) → it rains potatoes, in honour of the Potato
//  · ↑ ↑ ↓ ↓ ← → ← → B A → forge overdrive: the whole page erupts in sparks
//  · click the UsForge spark 5 times fast → it overheats
(() => {
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // one full-screen canvas for all effects, made on first use
  let cv, g, bits = [], running = false;
  function layer() {
    if (cv) return;
    cv = document.createElement('canvas'); cv.className = 'egg-layer'; cv.setAttribute('aria-hidden', 'true');
    document.body.append(cv); g = cv.getContext('2d');
    const fit = () => { const d = Math.min(2, devicePixelRatio || 1); cv.width = innerWidth * d; cv.height = innerHeight * d; g.setTransform(d, 0, 0, d, 0, 0); g.imageSmoothingEnabled = false; };
    fit(); addEventListener('resize', fit);
  }
  function run() {
    if (running) return; running = true;
    let last = performance.now();
    (function tick(now) {
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      g.clearRect(0, 0, innerWidth, innerHeight);
      bits = bits.filter(b => (b.t += dt) < b.life && b.y < innerHeight + 60);
      for (const b of bits) {
        b.vy += b.grav * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.spin * dt;
        const a = Math.min(1, (b.life - b.t) * 2);
        g.save(); g.globalAlpha = a; g.translate(b.x, b.y); g.rotate(b.rot);
        if (b.img) g.drawImage(b.img, -b.s / 2, -b.s / 2, b.s, b.s);
        else { g.fillStyle = `hsl(${b.hue} 100% ${55 + 20 * (1 - b.t / b.life)}%)`; g.shadowColor = g.fillStyle; g.shadowBlur = 10; g.fillRect(-b.s / 2, -b.s / 2, b.s, b.s); }
        g.restore();
      }
      if (bits.length) requestAnimationFrame(tick); else { running = false; g.clearRect(0, 0, innerWidth, innerHeight); }
    })(last);
  }

  // a little pixel-art potato, drawn once
  const POTATO = (() => {
    const rows = ['....bbbbb...', '..bbaaaaabb.', '.baaacaaaaab', 'baaaaaaacaab', 'baacaaaaaaab', 'baaaaacaaaab', '.baaaaaaacab', '.bbaacaaaabb', '...bbbbbbb..'];
    const col = { a: '#d9a45b', b: '#8a5a2b', c: '#b07b3e' };
    const c = document.createElement('canvas'); c.width = 12; c.height = 12;
    const x = c.getContext('2d');
    rows.forEach((r, j) => [...r].forEach((ch, i) => { if (col[ch]) { x.fillStyle = col[ch]; x.fillRect(i, j + 1, 1, 1); } }));
    return c;
  })();

  function potatoRain() {
    UsForge?.toast('<b>Potato mode.</b> Alex approves.');
    if (calm) return;
    layer();
    for (let i = 0; i < 70; i++) bits.push({ img: POTATO, x: Math.random() * innerWidth, y: -40 - Math.random() * innerHeight * .8, vx: (Math.random() - .5) * 40, vy: 60 + Math.random() * 80, grav: 260, rot: Math.random() * 6, spin: (Math.random() - .5) * 5, s: 22 + Math.random() * 22, t: 0, life: 6 });
    run();
  }
  function burst(x, y, n = 60, power = 420) {
    if (calm) return;
    layer();
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = power * (.3 + Math.random() * .7);
      bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - power * .35, grav: 520, rot: 0, spin: 0, s: 2 + Math.random() * 3.5, hue: (window.UsForge?.accentHue ?? 218) - 18 + Math.random() * 36, t: 0, life: .8 + Math.random() * .9 });
    }
    run();
  }
  function overdrive() {
    UsForge?.toast('<b>Forge overdrive!</b> ↑↑↓↓←→←→BA');
    document.documentElement.classList.add('overdrive'); setTimeout(() => document.documentElement.classList.remove('overdrive'), 2400);
    for (let k = 0; k < 8; k++) setTimeout(() => burst(Math.random() * innerWidth, innerHeight * (.2 + Math.random() * .6), 70, 520), k * 180);
  }

  // listen for the codes
  const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
  let keys = [], typed = '';
  addEventListener('keydown', e => {
    if (/input|textarea/i.test(e.target.tagName || '') && e.key.length === 1) return;   // don't fire while typing in a box
    const k = e.key.toLowerCase();
    keys = [...keys, k].slice(-KONAMI.length);
    if (keys.join() === KONAMI.join()) { keys = []; overdrive(); }
    if (k.length === 1) { typed = (typed + k).slice(-6); if (typed === 'potato') { typed = ''; potatoRain(); } }
  });

  // the logo spark overheats
  let clicks = [];
  addEventListener('click', e => {
    const s = e.target.closest?.('.mark .spark');
    if (!s) return;
    e.preventDefault();
    clicks = [...clicks, performance.now()].filter(t => performance.now() - t < 1600);
    s.classList.remove('heat'); void s.offsetWidth; s.classList.add('heat');
    if (clicks.length >= 5) { clicks = []; const b = s.getBoundingClientRect(); burst(b.left + b.width / 2, b.top + b.height / 2, 90, 480); UsForge?.toast('The forge is <b>overheating</b>. Maybe stop poking it.'); }
  });

  // Alex's Potato role
  addEventListener('click', e => { const r = e.target.closest?.('[data-potato]'); if (r) potatoRain(); });

  window.UsForgeEggs = { potatoRain, burst, overdrive };
})();
