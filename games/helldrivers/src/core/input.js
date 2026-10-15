// Keyboard + mouse state. Other code just reads `input.*` each frame.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, ndcX: 0, ndcY: 0, down: false };
    this.wheel = 0;          // accumulated scroll since last frame
    this.pressed = new Set(); // keys pressed this frame (one-shot)

    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.down = false; });

    canvas.addEventListener('mousemove', (e) => this.#setMouse(e));
    canvas.addEventListener('mousedown', (e) => { if (e.button === 0) this.mouse.down = true; this.#setMouse(e); });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouse.down = false; });
    canvas.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  #setMouse(e) {
    this.mouse.x = e.clientX;
    this.mouse.y = e.clientY;
    this.mouse.ndcX = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouse.ndcY = -(e.clientY / window.innerHeight) * 2 + 1;
  }

  down(...codes) { return codes.some((c) => this.keys.has(c)); }
  wasPressed(code) { return this.pressed.has(code); }

  // Call at the very end of each frame.
  endFrame() { this.pressed.clear(); this.wheel = 0; }

  // Driving axes: throttle (-1..1), steer (-1 = left .. 1 = right)
  get throttle() {
    return (this.down('KeyW', 'ArrowUp') ? 1 : 0) - (this.down('KeyS', 'ArrowDown') ? 1 : 0);
  }
  get steer() {
    return (this.down('KeyD', 'ArrowRight') ? 1 : 0) - (this.down('KeyA', 'ArrowLeft') ? 1 : 0);
  }
  get handbrake() { return this.down('Space'); }
}
