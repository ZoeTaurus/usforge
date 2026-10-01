/*
 * PARASITE — title screen
 *
 * The background is a small living scene: spores drift, veins creep in from
 * the edges, eyes open in the dark — and the parasite wanders, occasionally
 * hunting one of those eyes down and burrowing in. Each host it takes leaks
 * memories into the screen and erodes the SELF meter, a quiet preview of the
 * game's core loop.
 */
(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const canvas = document.getElementById("world");
  const ctx = canvas.getContext("2d");
  const whispersEl = document.getElementById("whispers");
  const titleEl = document.getElementById("title");
  const letters = Array.from(titleEl.querySelectorAll(".letter"));
  const wakeEl = document.getElementById("wake");
  const menuEl = document.getElementById("menu");
  const menuItems = Array.from(menuEl.querySelectorAll(".menu-item"));
  const aboutEl = document.getElementById("about");
  const prologueEl = document.getElementById("prologue");
  const selfFill = document.getElementById("self-fill");
  const selfValue = document.getElementById("self-value");
  const hostCountEl = document.getElementById("host-count");
  const soundStateEl = document.getElementById("sound-state");

  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const angleDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

  let W = 0, H = 0, DPR = 1, unit = 1;
  let time = 0;

  // ---------------------------------------------------------------------------
  // Hosts & their memories
  // ---------------------------------------------------------------------------

  const HOSTS = {
    beetle: {
      size: 4, gap: 9, iris: "#9dff6a", glow: "rgba(157,255,106,0.55)", pupil: "dot",
      memories: ["the dark under the stone is safe", "smell of rot. sweet.", "climb. climb. climb.", "the light means birds", "a thousand legs before me"],
    },
    crow: {
      size: 6, gap: 22, iris: "#ffd23f", glow: "rgba(255,210,63,0.5)", pupil: "dot",
      memories: ["the shiny thing by the river", "they throw stones at us", "wind under me, nothing else", "the old man feeds us at noon", "remember every face"],
    },
    fox: {
      size: 8, gap: 30, iris: "#ffb347", glow: "rgba(255,179,71,0.5)", pupil: "slit",
      memories: ["the gap in the fence", "don't go near the barn", "her hand on my head, once", "the cubs are under the roots", "the gun smells like oil"],
    },
    human: {
      size: 9, gap: 46, iris: "#cfe9ff", glow: "rgba(207,233,255,0.45)", pupil: "round",
      memories: ["did I leave the stove on?", "Mom, I'm sorry", "my name is— my name was—", "I was going to call him back", "rain on the bus window", "I don't want to forget her face"],
    },
  };
  const SELF_THOUGHTS = ["which thoughts are mine?", "I am still me", "I was something before this", "don't stay too long", "I am small. I am hungry."];

  // ---------------------------------------------------------------------------
  // Canvas sizing
  // ---------------------------------------------------------------------------

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    unit = clamp(Math.min(W, H) / 900, 0.55, 1.4);
    buildVeins();
  }

  // Is a point inside the area reserved for the title/menu?
  function inCenter(x, y, pad = 1) {
    const dx = (x - W / 2) / (W * 0.36 * pad);
    const dy = (y - H * 0.47) / (H * 0.3 * pad);
    return dx * dx + dy * dy < 1;
  }

  // ---------------------------------------------------------------------------
  // Spores
  // ---------------------------------------------------------------------------

  const spores = [];
  function initSpores() {
    spores.length = 0;
    const n = reduceMotion ? 50 : Math.round(clamp((W * H) / 9000, 60, 190));
    for (let i = 0; i < n; i++) {
      spores.push({
        x: Math.random() * W,
        y: Math.random() * H,
        z: Math.pow(Math.random(), 2) * 0.9 + 0.1, // depth: small = far
        phase: Math.random() * TAU,
        hue: Math.random() < 0.9 ? "bio" : "flesh",
      });
    }
  }

  function drawSpores(dt) {
    for (const s of spores) {
      s.y -= (6 + 18 * s.z) * dt;
      s.x += Math.sin(time * 0.4 + s.phase) * 6 * s.z * dt;
      // Gentle push away from the parasite's head
      const dx = s.x - worm.pts[0].x, dy = s.y - worm.pts[0].y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 9000) {
        const f = (1 - d2 / 9000) * 60 * dt;
        s.x += dx * f * 0.02; s.y += dy * f * 0.02;
      }
      if (s.y < -10) { s.y = H + 10; s.x = Math.random() * W; }
      if (s.x < -10) s.x = W + 10; else if (s.x > W + 10) s.x = -10;

      const flicker = 0.5 + 0.5 * Math.sin(time * (0.8 + s.z) + s.phase * 3);
      const a = (0.08 + 0.42 * s.z) * (0.35 + 0.65 * flicker);
      const r = 0.6 + 2.2 * s.z * unit;
      ctx.fillStyle = s.hue === "bio" ? `rgba(94,242,201,${a})` : `rgba(255,110,140,${a})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, TAU);
      ctx.fill();
      if (s.z > 0.7 && s.hue === "bio") {
        ctx.fillStyle = s.hue === "bio" ? `rgba(94,242,201,${a * 0.12})` : `rgba(255,110,140,${a * 0.12})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, r * 5, 0, TAU);
        ctx.fill();
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Veins creeping in from the edges
  // ---------------------------------------------------------------------------

  let veins = [];
  function buildVeins() {
    veins = [];
    const roots = reduceMotion ? 6 : 11;
    for (let i = 0; i < roots; i++) {
      // Start on a random edge, aim loosely toward the center
      const edge = (Math.random() * 4) | 0;
      let x, y;
      if (edge === 0) { x = Math.random() * W; y = -5; }
      else if (edge === 1) { x = W + 5; y = Math.random() * H; }
      else if (edge === 2) { x = Math.random() * W; y = H + 5; }
      else { x = -5; y = Math.random() * H; }
      const ang = Math.atan2(H / 2 - y, W / 2 - x) + rand(-0.6, 0.6);
      grow(x, y, ang, rand(2.2, 3.4) * unit, 0, rand(0, 4));
    }
  }

  function grow(x, y, ang, width, depth, delay) {
    const pts = [{ x, y }];
    const steps = (rand(16, 32) / (depth + 1)) | 0;
    const stepLen = rand(12, 20) * unit;
    let a = ang;
    for (let i = 0; i < steps; i++) {
      a += rand(-0.35, 0.35);
      x += Math.cos(a) * stepLen;
      y += Math.sin(a) * stepLen;
      if (inCenter(x, y, 0.85)) break; // veins never reach the title
      pts.push({ x, y });
      if (depth < 3 && Math.random() < 0.13) {
        grow(x, y, a + rand(0.5, 1.1) * (Math.random() < 0.5 ? -1 : 1), width * 0.6, depth + 1, delay + i * 0.12);
      }
    }
    if (pts.length > 2) veins.push({ pts, width, delay, pulse: Math.random() * 10 });
  }

  function drawVeins() {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const v of veins) {
      const visible = clamp((time - v.delay) / 9, 0, 1); // slow creep
      const count = Math.max(2, Math.floor(v.pts.length * visible));
      if (time < v.delay) continue;
      ctx.strokeStyle = "rgba(120,16,40,0.38)";
      ctx.lineWidth = v.width;
      ctx.beginPath();
      ctx.moveTo(v.pts[0].x, v.pts[0].y);
      for (let i = 1; i < count; i++) ctx.lineTo(v.pts[i].x, v.pts[i].y);
      ctx.stroke();

      // A pulse of light travels along each vein now and then
      const cycle = ((time + v.pulse) % 7) / 7;
      const head = cycle * count * 1.6;
      if (head < count) {
        const i = Math.floor(head);
        const p = v.pts[i];
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 14 * unit);
        g.addColorStop(0, "rgba(255,77,109,0.45)");
        g.addColorStop(1, "rgba(255,77,109,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 14 * unit, 0, TAU);
        ctx.fill();
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Eyes in the dark — potential hosts
  // ---------------------------------------------------------------------------

  const eyes = [];
  let nextEyeAt = 1.5;

  function spawnEye() {
    const kind = pick(["beetle", "beetle", "crow", "fox", "fox", "human"]);
    let x, y, tries = 0;
    do {
      x = rand(W * 0.06, W * 0.94);
      y = rand(H * 0.1, H * 0.86);
      tries++;
    } while ((inCenter(x, y, 1.1) || eyes.some((e) => Math.hypot(e.x - x, e.y - y) < 140)) && tries < 40);
    if (tries >= 40) return;
    eyes.push({
      kind, x, y,
      open: 0, state: "opening",
      life: rand(7, 14),
      age: 0,
      blinkAt: rand(1.5, 4),
      blink: 0,
      look: 0, lookX: 0, lookY: 0,
      tilt: rand(-0.15, 0.15),
    });
  }

  function updateEyes(dt) {
    nextEyeAt -= dt;
    if (nextEyeAt <= 0 && eyes.length < 5) {
      spawnEye();
      nextEyeAt = rand(1.8, 4.2);
    }
    const head = worm.pts[0];
    for (let i = eyes.length - 1; i >= 0; i--) {
      const e = eyes[i];
      e.age += dt;
      if (e.state === "opening") {
        e.open = Math.min(1, e.open + dt * 0.9);
        if (e.open >= 1) e.state = "open";
      } else if (e.state === "open") {
        if (e.age > e.life && worm.target !== e) e.state = "closing";
        // Frightened if the parasite comes close while not being hunted
        const d = Math.hypot(head.x - e.x, head.y - e.y);
        if (d < 110 * unit && worm.target !== e) e.state = "closing";
      } else if (e.state === "closing") {
        e.open -= dt * 1.6;
        if (e.open <= 0) { eyes.splice(i, 1); continue; }
      }
      // Blinking
      e.blinkAt -= dt;
      if (e.blinkAt <= 0) { e.blink = 1; e.blinkAt = rand(2, 5); }
      e.blink = Math.max(0, e.blink - dt * 7);
      // Track the parasite (or the cursor, when it's closer)
      const tx = head.x - e.x, ty = head.y - e.y;
      const len = Math.hypot(tx, ty) || 1;
      e.lookX = lerp(e.lookX, tx / len, dt * 4);
      e.lookY = lerp(e.lookY, ty / len, dt * 4);
    }
  }

  function drawEye(cx, cy, e, h) {
    const s = h.size * unit;
    const lid = e.open * (1 - Math.sin(e.blink * Math.PI));
    const rx = s * 1.9, ry = s * 1.05 * lid;
    if (ry < 0.3) return;

    // Halo
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 6);
    g.addColorStop(0, h.glow.replace(/[\d.]+\)$/, `${0.35 * e.open})`));
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, s * 6, 0, TAU);
    ctx.fill();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(e.tilt);
    // Almond shape
    ctx.beginPath();
    ctx.moveTo(-rx, 0);
    ctx.quadraticCurveTo(0, -ry * 2, rx, 0);
    ctx.quadraticCurveTo(0, ry * 2, -rx, 0);
    ctx.closePath();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = h.iris;
    ctx.globalAlpha = 0.9 * e.open;
    ctx.shadowColor = h.glow;
    ctx.shadowBlur = 12;
    ctx.fillRect(-rx, -ry * 2, rx * 2, ry * 4);
    ctx.shadowBlur = 0;
    // Pupil follows the parasite
    const px = e.lookX * rx * 0.45, py = e.lookY * ry * 0.4;
    ctx.fillStyle = "#050407";
    ctx.globalAlpha = 1;
    ctx.beginPath();
    if (h.pupil === "slit") ctx.ellipse(px, py, s * 0.28, s * 1.0, 0, 0, TAU);
    else if (h.pupil === "round") ctx.arc(px, py, s * 0.55, 0, TAU);
    else ctx.arc(px, py, s * 0.45, 0, TAU);
    ctx.fill();
    // Catch-light
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.beginPath();
    ctx.arc(px - s * 0.3, py - s * 0.3, s * 0.16, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  function drawEyes() {
    for (const e of eyes) {
      const h = HOSTS[e.kind];
      const gap = h.gap * unit;
      if (e.kind === "beetle") {
        // Beetles: a little cluster of tiny eyes
        drawEye(e.x - gap, e.y, e, h);
        drawEye(e.x + gap, e.y, e, h);
        drawEye(e.x, e.y - gap * 0.7, e, { ...h, size: h.size * 0.7 });
      } else {
        drawEye(e.x - gap / 2, e.y, e, h);
        drawEye(e.x + gap / 2, e.y, e, h);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // The parasite
  // ---------------------------------------------------------------------------

  const SEGMENTS = 38;
  const worm = {
    pts: [],
    angle: 0,
    speed: 0,
    target: null,    // an eye being hunted
    wanderAngle: 0,
    huntCooldown: 4,
    trail: [],
    scale: 1,
  };

  function initWorm() {
    worm.pts = [];
    const x = W * 0.18, y = H * 0.8;
    for (let i = 0; i < SEGMENTS; i++) worm.pts.push({ x: x - i * 6, y });
    worm.angle = -0.6;
    worm.wanderAngle = worm.angle;
  }

  const pointer = { x: 0, y: 0, last: -10 };

  function updateWorm(dt) {
    const head = worm.pts[0];
    let tx, ty, speed;

    // Pick prey now and then
    worm.huntCooldown -= dt;
    if (!worm.target && worm.huntCooldown <= 0 && !burrowing) {
      const prey = eyes.filter((e) => e.state === "open");
      if (prey.length) worm.target = pick(prey);
      worm.huntCooldown = rand(5, 10);
    }
    if (worm.target && !eyes.includes(worm.target)) worm.target = null;

    if (burrowing) {
      tx = W / 2; ty = H * 0.47; speed = 210;
    } else if (worm.target) {
      tx = worm.target.x; ty = worm.target.y; speed = 150;
    } else if (time - pointer.last < 2.5) {
      // Curious about the cursor — circles it rather than touching it
      const orbit = time * 1.3;
      tx = pointer.x + Math.cos(orbit) * 70;
      ty = pointer.y + Math.sin(orbit) * 70;
      speed = 120;
    } else {
      // Wander, steering softly away from the edges and the title
      worm.wanderAngle += rand(-1, 1) * dt * 2.2;
      const look = 140;
      tx = head.x + Math.cos(worm.wanderAngle) * look;
      ty = head.y + Math.sin(worm.wanderAngle) * look;
      const m = 90;
      if (tx < m || tx > W - m || ty < m || ty > H - m || inCenter(tx, ty, 0.75)) {
        worm.wanderAngle += angleDiff(worm.wanderAngle, Math.atan2(H / 2 - head.y, W / 2 - head.x) + Math.PI * (inCenter(tx, ty, 0.75) ? 1 : 0)) * dt * 3;
      }
      speed = 70;
    }
    speed *= unit;
    worm.speed = lerp(worm.speed, speed, dt * 2);

    const desired = Math.atan2(ty - head.y, tx - head.x);
    const turn = clamp(angleDiff(worm.angle, desired), -3.2 * dt, 3.2 * dt);
    worm.angle += turn;
    const wiggle = Math.sin(time * 7) * 0.45;
    const a = worm.angle + wiggle;
    head.x += Math.cos(a) * worm.speed * dt;
    head.y += Math.sin(a) * worm.speed * dt;

    // Chain the body behind the head
    const spacing = 6.2 * unit * worm.scale;
    for (let i = 1; i < worm.pts.length; i++) {
      const p = worm.pts[i], q = worm.pts[i - 1];
      const dx = p.x - q.x, dy = p.y - q.y;
      const d = Math.hypot(dx, dy) || 1;
      p.x = q.x + (dx / d) * spacing;
      p.y = q.y + (dy / d) * spacing;
    }

    // Slime trail
    worm.trail.push({ x: head.x, y: head.y, t: time });
    while (worm.trail.length && time - worm.trail[0].t > 4) worm.trail.shift();

    // Burrow!
    if (worm.target && Math.hypot(head.x - worm.target.x, head.y - worm.target.y) < 14 * unit) {
      consume(worm.target);
      worm.target = null;
    }
  }

  function drawWorm() {
    const pts = worm.pts;
    const n = pts.length;
    const maxW = 9 * unit * worm.scale;

    // Trail
    if (worm.trail.length > 2) {
      ctx.lineCap = "round";
      for (let i = 1; i < worm.trail.length; i++) {
        const p = worm.trail[i - 1], q = worm.trail[i];
        const age = (time - q.t) / 4;
        ctx.strokeStyle = `rgba(255,77,109,${0.12 * (1 - age)})`;
        ctx.lineWidth = 3 * unit * (1 - age);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
        ctx.stroke();
      }
    }

    // Outline from both sides of the spine
    const left = [], right = [], normals = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let nx = -(b.y - a.y), ny = b.x - a.x;
      const l = Math.hypot(nx, ny) || 1;
      nx /= l; ny /= l;
      let w = t < 0.12 ? 0.62 + 0.38 * (t / 0.12) : 1 - Math.pow((t - 0.12) / 0.88, 1.3) * 0.92;
      w *= 1 + 0.16 * Math.sin(time * 6 - i * 0.55); // peristalsis
      w *= maxW;
      normals.push({ nx, ny, w });
      left.push({ x: pts[i].x + nx * w, y: pts[i].y + ny * w });
      right.push({ x: pts[i].x - nx * w, y: pts[i].y - ny * w });
    }

    // Cilia
    ctx.strokeStyle = "rgba(255,160,180,0.35)";
    ctx.lineWidth = 0.8;
    for (let i = 4; i < n - 6; i += 2) {
      const { nx, ny, w } = normals[i];
      const flick = Math.sin(time * 12 + i) * 0.5;
      for (const side of [1, -1]) {
        const bx = pts[i].x + nx * w * side, by = pts[i].y + ny * w * side;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + (nx * side + ny * flick) * 5 * unit, by + (ny * side - nx * flick) * 5 * unit);
        ctx.stroke();
      }
    }

    // Body
    ctx.beginPath();
    ctx.moveTo(left[0].x, left[0].y);
    for (let i = 1; i < n; i++) ctx.lineTo(left[i].x, left[i].y);
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
    ctx.closePath();
    ctx.save();
    ctx.shadowColor = "rgba(255,77,109,0.9)";
    ctx.shadowBlur = 28 * unit;
    const g = ctx.createLinearGradient(pts[0].x, pts[0].y, pts[n - 1].x, pts[n - 1].y);
    g.addColorStop(0, "#ffb3c2");
    g.addColorStop(0.25, "#ff4d6d");
    g.addColorStop(1, "#5c0b22");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();

    // Segment rings
    ctx.strokeStyle = "rgba(60,4,18,0.55)";
    ctx.lineWidth = 1;
    for (let i = 3; i < n - 2; i += 2) {
      ctx.beginPath();
      ctx.moveTo(left[i].x, left[i].y);
      ctx.quadraticCurveTo(
        pts[i].x + (pts[i - 1].x - pts[i].x) * 0.9, pts[i].y + (pts[i - 1].y - pts[i].y) * 0.9,
        right[i].x, right[i].y);
      ctx.stroke();
    }

    // Glowing spine (its "self")
    ctx.strokeStyle = "rgba(255,230,236,0.55)";
    ctx.lineWidth = 1.2 * unit;
    ctx.beginPath();
    ctx.moveTo(pts[1].x, pts[1].y);
    for (let i = 2; i < n * 0.7; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();

    // Mandibles
    const h = pts[0], dir = Math.atan2(pts[0].y - pts[1].y, pts[0].x - pts[1].x);
    const open = 0.35 + 0.25 * Math.sin(time * 9);
    ctx.strokeStyle = "#ffd1dc";
    ctx.lineWidth = 1.4 * unit;
    for (const side of [1, -1]) {
      const base = dir + side * 1.2;
      const bx = h.x + Math.cos(base) * maxW * 0.55, by = h.y + Math.sin(base) * maxW * 0.55;
      const tipA = dir + side * open;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(
        bx + Math.cos(tipA + side * 0.6) * 7 * unit, by + Math.sin(tipA + side * 0.6) * 7 * unit,
        bx + Math.cos(tipA - side * 0.3) * 11 * unit, by + Math.sin(tipA - side * 0.3) * 11 * unit);
      ctx.stroke();
    }

    // Nucleus — the part of you that is still you
    const core = pts[3];
    const pulse = 0.6 + 0.4 * Math.sin(time * 3);
    const cg = ctx.createRadialGradient(core.x, core.y, 0, core.x, core.y, maxW * 1.4);
    cg.addColorStop(0, `rgba(255,255,255,${0.9 * self / 100})`);
    cg.addColorStop(0.4, `rgba(255,190,205,${0.5 * pulse})`);
    cg.addColorStop(1, "rgba(255,77,109,0)");
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(core.x, core.y, maxW * 1.4, 0, TAU);
    ctx.fill();
  }

  // ---------------------------------------------------------------------------
  // Consuming a host: bursts, memories, and a little less "self"
  // ---------------------------------------------------------------------------

  const bursts = [];
  let self = 100;
  let hosts = 0;
  let flash = 0;

  function consume(e) {
    const h = HOSTS[e.kind];
    const idx = eyes.indexOf(e);
    if (idx >= 0) eyes.splice(idx, 1);
    hosts++;
    hostCountEl.textContent = hosts;
    self = Math.max(41, self - rand(4, 9));
    flash = 1;

    for (let i = 0; i < 46; i++) {
      const a = Math.random() * TAU, s = rand(30, 220) * unit;
      bursts.push({ x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, color: Math.random() < 0.6 ? h.iris : "#ff4d6d", r: rand(0.8, 2.6) });
    }
    bursts.push({ ring: true, x: e.x, y: e.y, life: 1, color: h.iris });

    audio.squelch();
    // Their memories leak in — two of them, close to where they died
    whisper(pick(h.memories), e.x, e.y, 0.55);
    setTimeout(() => whisper(pick(h.memories)), 900);
    glitchTitle(3);
  }

  function updateBursts(dt) {
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      b.life -= dt * (b.ring ? 0.9 : 0.8);
      if (b.life <= 0) { bursts.splice(i, 1); continue; }
      if (b.ring) {
        const r = (1 - b.life) * 120 * unit;
        ctx.strokeStyle = b.color;
        ctx.globalAlpha = b.life * 0.6;
        ctx.lineWidth = 2 * b.life;
        ctx.beginPath();
        ctx.arc(b.x, b.y, r, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
        continue;
      }
      b.vx *= 1 - dt * 2.2;
      b.vy *= 1 - dt * 2.2;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      ctx.fillStyle = b.color;
      ctx.globalAlpha = b.life;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * unit, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function updateSelf(dt) {
    // Slowly recovering — you pull yourself back together between hosts
    self = Math.min(100, self + dt * 0.35);
    const v = Math.round(self);
    selfValue.textContent = `${v}%`;
    selfFill.style.transform = `scaleX(${self / 100})`;
  }

  // ---------------------------------------------------------------------------
  // Whispers
  // ---------------------------------------------------------------------------

  function whisper(text, x, y, peak) {
    if (x === undefined) {
      let tries = 0;
      do {
        x = rand(W * 0.05, W * 0.85);
        y = rand(H * 0.06, H * 0.9);
      } while (inCenter(x, y, 1.15) && ++tries < 30);
    }
    const el = document.createElement("span");
    el.className = "whisper";
    el.textContent = text;
    el.style.left = `${clamp(x, 16, W - 260)}px`;
    el.style.top = `${clamp(y - 30, 16, H - 60)}px`;
    el.style.fontSize = `${rand(0.95, 1.45).toFixed(2)}rem`;
    el.style.setProperty("--dur", `${rand(6, 9).toFixed(1)}s`);
    el.style.setProperty("--peak", (peak ?? rand(0.18, 0.36)).toFixed(2));
    whispersEl.appendChild(el);
    // Keep the whole line on screen
    const overflow = el.offsetLeft + el.offsetWidth - (W - 16);
    if (overflow > 0) el.style.left = `${Math.max(16, el.offsetLeft - overflow)}px`;
    el.addEventListener("animationend", () => el.remove());
  }

  function scheduleWhisper() {
    // The less of yourself is left, the louder the others get
    const delay = lerp(2.5, 9, (self - 40) / 60) * 1000;
    setTimeout(() => {
      if (!document.hidden && !burrowing) {
        const pool = Math.random() < 0.3 ? SELF_THOUGHTS : HOSTS[pick(Object.keys(HOSTS))].memories;
        whisper(pick(pool));
      }
      scheduleWhisper();
    }, delay);
  }

  // ---------------------------------------------------------------------------
  // Title glitch — a letter briefly belongs to someone else
  // ---------------------------------------------------------------------------

  const FOREIGN = { P: "ƥ", A: "a", R: "я", S: "s", I: "ı", T: "†", E: "ε" };

  function glitchTitle(count = 1) {
    if (reduceMotion) return;
    for (let k = 0; k < count; k++) {
      const el = pick(letters);
      if (el.classList.contains("foreign")) continue;
      const original = el.textContent;
      el.classList.add("foreign");
      el.textContent = FOREIGN[original] || original.toLowerCase();
      setTimeout(() => {
        el.classList.remove("foreign");
        el.textContent = original;
      }, rand(140, 520));
    }
  }

  function scheduleGlitch() {
    setTimeout(() => {
      if (!burrowing) glitchTitle(Math.random() < 0.2 ? 2 : 1);
      scheduleGlitch();
    }, rand(2500, 6500) * (self / 100 + 0.2));
  }

  // Animate the SVG turbulence so the letters slowly "breathe"
  const fleshNoise = document.getElementById("flesh-noise");
  function updateFleshFilter() {
    if (reduceMotion || !fleshNoise) return;
    const fx = 0.012 + Math.sin(time * 0.3) * 0.003;
    const fy = 0.03 + Math.cos(time * 0.23) * 0.006;
    fleshNoise.setAttribute("baseFrequency", `${fx.toFixed(4)} ${fy.toFixed(4)}`);
  }

  // ---------------------------------------------------------------------------
  // Audio — a low drone and a heartbeat, started on first input
  // ---------------------------------------------------------------------------

  const audio = window.ParasiteAudio;

  // ---------------------------------------------------------------------------
  // Menu & input
  // ---------------------------------------------------------------------------

  const SAVE_KEY = "parasite.save";
  let hasSave = false;
  try { hasSave = !!localStorage.getItem(SAVE_KEY); } catch (e) { /* ignore */ }
  const continueBtn = menuItems.find((m) => m.dataset.action === "continue");
  if (hasSave) {
    continueBtn.disabled = false;
    continueBtn.removeAttribute("title");
  }
  soundStateEl.textContent = audio.enabled ? "on" : "off";

  let awake = false;
  let burrowing = false;
  let active = 0;

  function wake() {
    if (awake) return;
    awake = true;
    wakeEl.classList.add("gone");
    setTimeout(() => {
      wakeEl.hidden = true;
      menuEl.hidden = false;
      setActive(0);
    }, 400);
    audio.start();
    glitchTitle(2);
  }

  function setActive(i) {
    const enabled = menuItems.filter((m) => !m.disabled);
    if (!enabled.length) return;
    const cur = menuItems[active];
    let idx = enabled.indexOf(cur);
    if (idx < 0) idx = 0;
    idx = (i === "next" ? idx + 1 : i === "prev" ? idx - 1 : enabled.indexOf(menuItems[i]) >= 0 ? enabled.indexOf(menuItems[i]) : 0);
    idx = (idx + enabled.length) % enabled.length;
    active = menuItems.indexOf(enabled[idx]);
    menuItems.forEach((m, j) => m.classList.toggle("active", j === active));
  }

  function activate(action) {
    audio.tick();
    switch (action) {
      case "begin": return begin();
      case "continue": return resume();
      case "sound": soundStateEl.textContent = audio.toggle() ? "on" : "off"; return;
      case "about": aboutEl.hidden = false; aboutEl.querySelector(".close").focus(); return;
      case "close": aboutEl.hidden = true; menuItems[active].focus(); return;
    }
  }

  const PROLOGUE = [
    "You are small.",
    "You are hungry.",
    "Somewhere above you, something warm is sleeping.",
    "Whatever happens next —",
    "remember which thoughts are yours.",
  ];

  function begin() {
    if (burrowing) return;
    burrowing = true;
    worm.target = null;
    try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem("parasite.journey"); } catch (e) { /* ignore */ }
    document.body.classList.add("burrowing");
    audio.fadeTo(0.12, 3);
    setTimeout(() => {
      prologueEl.hidden = false;
      playLines(PROLOGUE, 0);
    }, 2600);
  }

  // The game page reads this if the query string doesn't survive the trip
  function handoff(target) {
    try { sessionStorage.setItem("parasite.goto", JSON.stringify(target)); } catch (e) { /* ignore */ }
  }

  function resume() {
    if (burrowing) return;
    burrowing = true;
    document.body.classList.add("burrowing");
    audio.fadeTo(0.12, 1.5);
    setTimeout(() => { handoff({ continue: true }); location.href = "game.html?continue"; }, 1500);
  }

  function playLines(lines, i) {
    if (!burrowing) return;
    if (i >= lines.length) {
      prologueEl.innerHTML = `<p class="line">Chapter I — <em>The Beetle</em></p>`;
      setTimeout(() => { if (burrowing) { handoff({ chapter: "beetle" }); location.href = "game.html?chapter=beetle"; } }, 3400);
      return;
    }
    prologueEl.innerHTML = `<p class="line">${lines[i]}</p>`;
    setTimeout(() => {
      const el = prologueEl.querySelector(".line");
      if (el) el.classList.add("fade");
      setTimeout(() => playLines(lines, i + 1), 1300);
    }, 2600);
  }

  function returnToTitle() {
    burrowing = false;
    prologueEl.hidden = true;
    prologueEl.innerHTML = "";
    document.body.classList.remove("burrowing");
    worm.scale = 1;
    audio.fadeTo(0.32, 2);
  }

  menuItems.forEach((item, i) => {
    item.addEventListener("mouseenter", () => {
      if (item.disabled) return;
      if (active !== i) audio.tick();
      setActive(i);
    });
    item.addEventListener("click", (ev) => {
      ev.stopPropagation();
      activate(item.dataset.action);
    });
  });
  aboutEl.querySelector(".close").addEventListener("click", (ev) => {
    ev.stopPropagation();
    activate("close");
  });

  window.addEventListener("keydown", (ev) => {
    if (!awake) { wake(); return; }
    if (burrowing) { if (ev.key === "Escape") returnToTitle(); return; }
    if (!aboutEl.hidden) {
      if (ev.key === "Escape" || ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); activate("close"); }
      return;
    }
    if (menuEl.hidden) return;
    if (ev.key === "ArrowDown" || ev.key === "s") { ev.preventDefault(); setActive("next"); audio.tick(); }
    else if (ev.key === "ArrowUp" || ev.key === "w") { ev.preventDefault(); setActive("prev"); audio.tick(); }
    else if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      if (document.activeElement && document.activeElement.classList.contains("menu-item")) return; // native click handles it
      activate(menuItems[active].dataset.action);
    }
  });
  window.addEventListener("pointerdown", () => { if (!awake) wake(); });
  window.addEventListener("pointermove", (ev) => {
    pointer.x = ev.clientX;
    pointer.y = ev.clientY;
    pointer.last = time;
  });

  // ---------------------------------------------------------------------------
  // Main loop
  // ---------------------------------------------------------------------------

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000) * (reduceMotion ? 0.5 : 1);
    last = now;
    time += dt;

    // Background: deep gradient with a faint heartbeat bloom
    const beat = Math.pow(Math.max(0, Math.sin(time * TAU / 1.3)), 12);
    const bg = ctx.createRadialGradient(W / 2, H * 0.47, 0, W / 2, H * 0.47, Math.max(W, H) * 0.75);
    bg.addColorStop(0, `rgb(${22 + beat * 10}, ${9 + beat * 2}, ${20 + beat * 4})`);
    bg.addColorStop(0.55, "#0b0710");
    bg.addColorStop(1, "#050407");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    drawVeins();
    drawSpores(dt);
    updateEyes(dt);
    drawEyes();
    updateWorm(dt);
    if (burrowing) worm.scale = Math.max(0.2, worm.scale - dt * 0.25);
    drawWorm();
    updateBursts(dt);
    updateSelf(dt);
    updateFleshFilter();

    if (flash > 0) {
      ctx.fillStyle = `rgba(255,77,109,${flash * 0.06})`;
      ctx.fillRect(0, 0, W, H);
      flash = Math.max(0, flash - dt * 2);
    }

    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", () => { resize(); initSpores(); });
  resize();
  initSpores();
  initWorm();
  scheduleWhisper();
  scheduleGlitch();
  setTimeout(() => whisper("where am I?", W * 0.12, H * 0.2, 0.4), 4200);
  requestAnimationFrame(frame);
})();
