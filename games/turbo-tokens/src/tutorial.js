// Tutorial mode: step-by-step driving lessons on an empty track. Each step
// only moves on when you actually do it (drive, turn, brake, drift, nitro).
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/+esm';
import { audio } from './audio.js';

const kbd = (...keys) => keys.map((k) => `<kbd>${k}</kbd>`).join(' ');

// Lessons. `start` runs once, `check` runs every frame and returns progress 0..1.
function lessons(touch) {
  return [
    {
      title: 'Drive',
      text: touch ? 'Hold <b>GAS</b> to drive forward.' : `Hold ${kbd('W')} or ${kbd('↑')} to drive forward.`,
      goal: 'Reach 60 km/h',
      check: (T) => T.kmh / 60,
    },
    {
      title: 'Turn',
      text: touch ? 'Steer with <b>◀</b> and <b>▶</b>.' : `Steer with ${kbd('A')} ${kbd('D')} or ${kbd('←')} ${kbd('→')}.`,
      goal: 'Follow the road round the corner and through the glowing gate',
      start: (T) => T.gateAfterCorner(),
      check: (T) => T.gateProgress(),
    },
    {
      title: 'Brake',
      text: touch ? 'Get up to speed, then press <b>BRAKE</b>.' : `Get up to speed, then press ${kbd('SPACE')} to brake.`,
      goal: 'Reach 80 km/h…',
      start: (T) => {
        T.s.phase = 'fast';
      },
      check: (T) => {
        const s = T.s;
        if (s.phase === 'fast') {
          if (T.kmh >= 80) {
            s.phase = 'brake';
            T.setGoal(touch ? 'Now press BRAKE hard!' : 'Now press SPACE hard!');
            T.ding(false);
          }
          return (T.kmh / 80) * 0.5;
        }
        const braking = T.car.ctrl.brake > 0;
        if (braking && s.v0 == null) s.v0 = T.kmh;
        if (s.v0 == null) return 0.5;
        if (!braking && T.kmh > s.v0 - 45 && T.kmh > 25) {
          s.v0 = null; // let go too early: try again
          return 0.5;
        }
        // Done after slowing down by 45 km/h (or almost to a stop) while braking.
        return 0.5 + 0.5 * (T.kmh < 25 ? 1 : Math.min(1, (s.v0 - T.kmh) / 45));
      },
    },
    {
      title: 'Drift',
      text: touch
        ? 'Hold <b>DRIFT</b> while you steer through a corner. Your car slides sideways!'
        : `Hold ${kbd('E')} while you steer through a corner. Your car slides sideways!`,
      goal: 'Drift for 1.5 seconds',
      start: (T) => {
        T.s.drift = 0;
        T.gateAfterCorner();
      },
      check: (T) => {
        if (T.car.drifting) T.s.drift += T.dt;
        // Missed the corner? Move the gate to the next one.
        if (T.gateProgress() >= 1 && T.s.drift < 1.5) {
          T.setNote('Missed it — try again at the next corner!');
          T.gateAfterCorner();
        }
        return T.s.drift / 1.5;
      },
    },
    {
      title: 'Nitro',
      text: touch ? 'Hold <b>N₂O</b> on a straight for a burst of speed.' : `Hold ${kbd('SHIFT')} on a straight for a burst of speed.`,
      goal: 'Boost for 1.5 seconds (your tank is full!)',
      start: (T) => {
        T.s.boost = 0;
        T.car.nitro = 1;
      },
      check: (T) => {
        if (T.car.boosting) T.s.boost += T.dt;
        else if (T.car.nitro < 0.3) T.car.nitro = 1; // never run dry in the lesson
        return T.s.boost / 1.5;
      },
    },
    {
      title: 'Finish',
      text: 'Put it all together and race to the finish gate!',
      goal: 'Drive through the gate',
      start: (T) => T.gateAhead(220),
      check: (T) => T.gateProgress(),
    },
  ];
}

export class Tutorial {
  constructor(race, { onDone } = {}) {
    this.race = race;
    this.onDone = onDone;
    this.car = race.player;
    this.steps = lessons(race.input.isTouch);
    this.i = -1;
    this.s = {};
    this.wait = 0;
    this.finished = false;

    const root = race.hud.root;
    root.classList.add('tutorial');
    this.hudRoot = root;
    const el = document.createElement('div');
    el.className = 'tut-panel';
    el.innerHTML = `<div class="tut-step"></div><div class="tut-title"></div><div class="tut-text"></div>
      <div class="tut-goal"></div><div class="tut-bar"><i></i></div><div class="tut-note"></div>`;
    root.appendChild(el);
    this.el = { root: el };
    for (const k of ['step', 'title', 'text', 'goal', 'bar', 'note']) this.el[k] = el.querySelector('.tut-' + k);
    this.el.fill = this.el.bar.querySelector('i');
    this.show('GET READY', 'Welcome to driving school!', 'When the lights turn <b>GREEN</b>, the lesson starts.', '');

    this.gate = this.makeGate();
    race.scene.add(this.gate);
  }

  // A glowing arch across the road with a bouncing arrow above it.
  makeGate() {
    const g = new THREE.Group();
    const r = this.race.path.halfWidth + 1.8;
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#39d5ff').multiplyScalar(2), toneMapped: false });
    const arch = new THREE.Mesh(new THREE.TorusGeometry(r, 0.6, 12, 48, Math.PI), mat);
    const curtain = new THREE.Mesh(
      new THREE.CircleGeometry(r, 48, 0, Math.PI),
      new THREE.MeshBasicMaterial({ color: '#39d5ff', transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }),
    );
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3.2, 4).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd23f').multiplyScalar(1.8), toneMapped: false }));
    arrow.position.y = r + 3;
    g.add(arch, curtain, arrow);
    // Tall beams of light on both sides, so the gate can be seen from far away.
    const beamTex = (() => {
      const c = document.createElement('canvas');
      c.width = 4;
      c.height = 128;
      const ctx = c.getContext('2d');
      const grad = ctx.createLinearGradient(0, 128, 0, 0);
      grad.addColorStop(0, 'rgba(255,255,255,0.9)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 4, 128);
      return new THREE.CanvasTexture(c);
    })();
    const beamMat = new THREE.MeshBasicMaterial({ map: beamTex, color: '#39d5ff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    for (const sx of [-1, 1]) {
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 45, 12, 1, true).translate(0, 22.5, 0), beamMat);
      beam.position.x = sx * r;
      g.add(beam);
    }
    this.beamTex = beamTex;
    g.userData = { arrow, mat, curtain };
    g.visible = false;
    return g;
  }

  placeGate(along) {
    const P = this.race.path;
    const i = P.indexAt(along);
    this.gate.position.set(P.px[i], P.py[i], P.pz[i]);
    this.gate.rotation.y = Math.atan2(P.tx[i], P.tz[i]);
    this.gate.visible = true;
    // How far the car has to go (in race progress) to get through.
    const L = P.length;
    let d = along - this.car.along;
    d = ((d % L) + L) % L;
    this.s.gateAt = this.car.progress + d;
    this.s.gateDist = Math.max(1, d);
  }

  // The gate goes just after the next real corner.
  gateAfterCorner() {
    const P = this.race.path;
    const step = P.step;
    let a = this.car.along + 50;
    let inCorner = false;
    for (let k = 0; k < P.count; k++, a += step) {
      const c = Math.abs(P.curv[P.indexAt(a)]);
      if (!inCorner && c > 1 / 140) inCorner = true;
      else if (inCorner && c < 1 / 400) {
        this.placeGate(a + 20);
        return;
      }
    }
    this.gateAhead(200);
  }

  gateAhead(dist) {
    this.placeGate(this.car.along + dist);
  }

  gateProgress() {
    if (this.s.gateAt == null) return 0;
    const left = this.s.gateAt - this.car.progress;
    return left <= 0 ? 1 : Math.max(0, 1 - left / this.s.gateDist) * 0.99;
  }

  show(step, title, text, goal) {
    this.el.step.textContent = step;
    this.el.title.textContent = title;
    this.el.text.innerHTML = text;
    this.setGoal(goal);
    this.setNote('');
    this.el.root.classList.remove('done');
    this.el.fill.style.width = '0%';
  }

  setGoal(t) {
    this.el.goal.textContent = t;
    this.el.bar.style.display = t ? '' : 'none';
  }

  setNote(t) {
    this.el.note.textContent = t;
  }

  ding(big) {
    audio.coin();
    if (big) audio.tone(1568, 0.3, { type: 'triangle', vol: 0.08, delay: 0.12 });
  }

  next() {
    this.i++;
    this.s = {};
    const L = this.steps[this.i];
    this.gate.visible = false;
    this.show(`STEP ${this.i + 1} OF ${this.steps.length}`, L.title, L.text, L.goal);
    if (L.start) L.start(this);
  }

  update(dt) {
    const race = this.race;
    this.dt = dt;
    this.kmh = Math.abs(this.car.speed) * 3.6;
    // Gate animation.
    if (this.gate.visible) {
      const t = race.t;
      this.gate.userData.arrow.position.y = race.path.halfWidth + 4.8 + Math.sin(t * 4) * 0.6;
      this.gate.userData.arrow.rotation.y = t * 2;
      this.gate.userData.curtain.material.opacity = 0.1 + 0.06 * Math.sin(t * 5);
    }
    if (this.finished) {
      this.wait -= dt;
      if (this.wait <= 0 && this.onDone) {
        const cb = this.onDone;
        this.onDone = null;
        cb();
      }
      return;
    }
    if (race.state === 'countdown') return;
    if (this.i < 0) this.next();
    // Short pause after each success before the next lesson.
    if (this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.i + 1 >= this.steps.length) {
          this.finished = true;
          this.wait = 0.4;
        } else {
          this.next();
        }
      }
      return;
    }
    const p = Math.max(0, Math.min(1, this.steps[this.i].check(this)));
    this.el.fill.style.width = `${Math.round(p * 100)}%`;
    if (p >= 1) {
      const last = this.i + 1 >= this.steps.length;
      this.el.root.classList.add('done');
      this.setNote(last ? '🎓 You did it!' : ['✔ Great!', '✔ Nice one!', '✔ Awesome!', '✔ Perfect!'][this.i % 4]);
      this.gate.visible = false;
      this.ding(true);
      if (last) audio.fanfare(true);
      this.wait = last ? 1.6 : 1.3;
    }
  }

  dispose() {
    this.gate.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        o.material.dispose();
      }
    });
    this.gate.removeFromParent();
    this.beamTex.dispose();
    this.el.root.remove();
    this.hudRoot.classList.remove('tutorial');
  }
}
