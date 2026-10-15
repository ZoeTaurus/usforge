// On-screen display: speedometer, drift label, crosshair, help, start screen.
const MPH = 2.23694; // 1 m/s = 2.237 mph

export class Hud {
  constructor() {
    document.getElementById('hud').innerHTML = `
      <div id="speedo">
        <div id="speed-num">0</div>
        <div id="speed-unit">MPH</div>
        <div id="speed-bar"><div id="speed-fill"></div></div>
      </div>
      <div id="drift">DRIFT!</div>
      <div id="airborne">AIR!</div>
      <div id="help">
        <b>W / S</b> gas / brake &amp; reverse<br>
        <b>A / D</b> steer<br>
        <b>SPACE</b> handbrake (drift!)<br>
        <b>MOUSE</b> aim &nbsp; <b>CLICK</b> fire<br>
        <b>WHEEL</b> zoom &nbsp; <b>R</b> unstick &nbsp; <b>BACKSPACE</b> back to start<br>
        <b>T</b> tuning panel &nbsp; <b>M</b> mute &nbsp; <b>H</b> hide help
      </div>
      <div id="fps"></div>
      <div id="crosshair"></div>`;
    this.speedNum = document.getElementById('speed-num');
    this.speedFill = document.getElementById('speed-fill');
    this.drift = document.getElementById('drift');
    this.air = document.getElementById('airborne');
    this.help = document.getElementById('help');
    this.fps = document.getElementById('fps');
    this.crosshair = document.getElementById('crosshair');
    this.fpsFrames = 0;
    this.fpsTime = 0;
  }

  update(car, topSpeed, dt, mouse) {
    const mph = car.speed * MPH;
    this.speedNum.textContent = Math.round(mph);
    this.speedFill.style.width = `${Math.min(100, (car.speed / topSpeed) * 100)}%`;
    this.drift.classList.toggle('on', car.drifting);
    this.air.classList.toggle('on', !car.grounded);
    this.crosshair.style.transform = `translate(${mouse.x}px, ${mouse.y}px)`;

    this.fpsFrames++;
    this.fpsTime += dt;
    if (this.fpsTime > 0.5) {
      this.fps.textContent = `${Math.round(this.fpsFrames / this.fpsTime)} FPS`;
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }
  }

  toggleHelp() { this.help.classList.toggle('hidden'); }
}

// Shows the title screen and resolves when the player clicks.
export function showStartScreen(regionName) {
  const el = document.getElementById('start');
  el.querySelector('.region').textContent = regionName;
  el.classList.add('ready');
  return new Promise((resolve) => {
    el.addEventListener('click', () => { el.remove(); resolve(); }, { once: true });
  });
}
