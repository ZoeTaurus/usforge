// LIGHTING + the final picture, by graphics quality.
//   Medium/High: real headlights, the guns light up their surroundings
//                when firing.
//   High:        explosions flash, the boss glows, and BLOOM makes bright
//                things (lava, fire, eyes, muzzle flashes) bleed light.
//   Title movie: moodier version of all of this (setCinema).
//
// Speed note: lights are never added or removed during the game (only
// dimmed to 0). Adding/removing a light forces every material's shader to
// be rebuilt, which causes a stutter.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { GFX } from '../core/graphics.js';

export class Lighting {
  constructor({ renderer, scene, camera, lights, car }) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.lights = lights;
    this.car = car;
    this.cinema = false;
    this.saved = {
      hemi: lights.hemi.intensity, sun: lights.sun.intensity, sunColor: lights.sun.color.clone(),
      offset: lights.sunOffset.clone(), exposure: renderer.toneMappingExposure,
    };
    this.dimmed = [];

    if (GFX.carLights) {
      // Headlights (no shadows: cheap)
      this.headlights = [];
      for (const x of [-0.65, 0.65]) {
        const spot = new THREE.SpotLight(0xfff0c8, 0, 48, 0.42, 0.6, 1.4);
        spot.position.set(x, 0.55, 2.15);
        spot.target.position.set(x * 1.6, -0.6, 16);
        car.model.root.add(spot, spot.target);
        this.headlights.push(spot);
      }
      // Gun light: flashes when the guns fire
      this.gunLight = new THREE.PointLight(0xffc060, 0, 16, 1.6);
      this.gunLight.position.set(0, 1.9, 0.6);
      car.model.root.add(this.gunLight);
      // Hot glow behind the car (strong in the title movie, faint in play)
      this.rim = new THREE.PointLight(0xff4a10, 0, 9, 1.6);
      this.rim.position.set(0, 1.4, -3.2);
      car.model.root.add(this.rim);
    }
    if (GFX.flashLights) {
      // Explosion flash (one light, moved to wherever something blew up)
      this.boom = new THREE.PointLight(0xff7a30, 0, 28, 1.8);
      scene.add(this.boom);
      // The boss's lava glow
      this.bossLight = new THREE.PointLight(0xff5a10, 0, 30, 1.5);
      scene.add(this.bossLight);
    }

    if (GFX.bloom) {
      // Render into a multisampled target (keeps edges smooth), then bloom.
      const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
      this.composer = new EffectComposer(renderer, rt);
      this.composer.addPass(new RenderPass(scene, camera));
      const size = new THREE.Vector2(window.innerWidth, window.innerHeight);
      this.bloom = new UnrealBloomPass(size, 0.4, 0.4, 0.86);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
      this.composer.setSize(window.innerWidth, window.innerHeight);
      window.addEventListener('resize', () => this.composer.setSize(window.innerWidth, window.innerHeight));
    }
    this.setCinema(false);
  }

  // Materials to darken in the title movie (e.g. pale tire dust).
  dim(materials) { this.dimmed = materials.map((m) => ({ m, color: m.color.clone() })); }

  // The moody title-screen look (low red sun, long shadows, strong glow).
  setCinema(on) {
    this.cinema = on;
    const L = this.lights, S = this.saved;
    for (const d of this.dimmed) d.m.color.copy(d.color).multiplyScalar(on ? 0.45 : 1);
    if (on) {
      L.hemi.intensity = S.hemi * 0.35;
      L.sun.intensity = S.sun * 1.6;
      L.sun.color.copy(S.sunColor).lerp(new THREE.Color(0xff4a20), 0.35);
      L.sunOffset.set(-110, 38, -70);
      this.renderer.toneMappingExposure = GFX.toneMapping ? 0.85 : 0.9;
    } else {
      L.hemi.intensity = S.hemi;
      L.sun.intensity = S.sun;
      L.sun.color.copy(S.sunColor);
      L.sunOffset.copy(S.offset);
      this.renderer.toneMappingExposure = S.exposure;
    }
    if (this.headlights) for (const h of this.headlights) h.intensity = on ? 16 : 9;
    if (this.bloom) { this.bloom.strength = on ? 0.6 : 0.4; this.bloom.threshold = on ? 0.82 : 0.86; }
  }

  // The guns just fired.
  gunFlash(big = false) {
    if (this.gunLight) this.gunLight.intensity = Math.max(this.gunLight.intensity, big ? 60 : 22);
  }

  // Something blew up at `pos`.
  flash(pos, strength = 1) {
    if (!this.boom) return;
    this.boom.position.set(pos.x, (pos.y || 0) + 1.5, pos.z);
    this.boom.intensity = Math.max(this.boom.intensity, 60 * strength);
  }

  update(dt, boss) {
    const fade = Math.exp(-dt * 18);
    if (this.gunLight) this.gunLight.intensity *= fade;
    if (this.boom) this.boom.intensity *= Math.exp(-dt * 7);
    if (this.rim) this.rim.intensity = this.cinema ? 5 + Math.random() * 2.5 : 0;
    if (this.bossLight) {
      const on = boss && boss.root.visible && boss.state !== 'dead';
      this.bossLight.intensity = on ? 55 + Math.sin(performance.now() / 300) * 15 : 0;
      if (on) this.bossLight.position.set(boss.root.position.x, 6, boss.root.position.z).addScaledVector(
        new THREE.Vector3(Math.sin(boss.yaw), 0, Math.cos(boss.yaw)), 3.5);
    }
  }

  // Shaders are built when something is first drawn, which can stutter.
  // Build them all up front, while the loading screen is up.
  async precompile() {
    const r = this.renderer;
    if (this.composer) r.setRenderTarget(this.composer.renderTarget1); // (they'll be drawn into this)
    try { await r.compileAsync(this.scene, this.camera); } catch { r.compile(this.scene, this.camera); }
    r.setRenderTarget(null);
  }

  render() {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}
