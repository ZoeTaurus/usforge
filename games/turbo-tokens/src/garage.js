// Showroom scene used behind the main menu and in the garage.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/+esm';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/controls/OrbitControls.js/+esm';
import { RoomEnvironment } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/environments/RoomEnvironment.js/+esm';
import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/postprocessing/EffectComposer.js/+esm';
import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/postprocessing/RenderPass.js/+esm';
import { UnrealBloomPass } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/postprocessing/UnrealBloomPass.js/+esm';
import { OutputPass } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/postprocessing/OutputPass.js/+esm';
import { CarModel } from './carModel.js';
import { Trail } from './style.js';
import { carBubble } from './underwater.js';
import { BUBBLES } from './state.js';
import { damp } from './utils.js';

function stripesTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 64, 512);
  ctx.fillStyle = '#fff';
  for (const y of [120, 132, 300]) ctx.fillRect(0, y, 64, y === 300 ? 4 : 3);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function floorTexture() {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, '#3a3f52');
  g.addColorStop(0.45, '#1c1f2b');
  g.addColorStop(1, '#0b0c12');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = 'rgba(120,160,255,0.08)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= S; i += 48) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, S);
    ctx.moveTo(0, i);
    ctx.lineTo(S, i);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export class Garage {
  constructor(renderer, quality) {
    this.renderer = renderer;
    this.quality = quality;
    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color('#07080d');
    scene.fog = new THREE.Fog('#07080d', 22, 60);

    const pmrem = new THREE.PMREMGenerator(renderer);
    this.env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    scene.environment = this.env;
    scene.environmentIntensity = 0.55;

    this.camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 200);
    this.camera.position.set(7.5, 3.0, 8.5);

    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.target.set(0, 0.75, 0);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 15;
    this.controls.maxPolarAngle = 1.45;
    this.controls.minPolarAngle = 0.35;
    this.controls.enabled = false;
    this.controls.addEventListener('start', () => (this.dragging = true));
    this.controls.addEventListener('end', () => (this.dragging = false));

    // Floor + turntable.
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(40, 64).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.62, metalness: 0.15 }),
    );
    floor.receiveShadow = true;
    scene.add(floor);
    this.turntable = new THREE.Group();
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(3.6, 3.75, 0.16, 72),
      new THREE.MeshStandardMaterial({ color: '#1b1e28', metalness: 0.8, roughness: 0.3 }),
    );
    disc.position.y = 0.08;
    disc.receiveShadow = true;
    this.turntable.add(disc);
    this.ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#39d5ff').multiplyScalar(2.5), toneMapped: false });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.68, 0.035, 8, 120).rotateX(Math.PI / 2), this.ringMat);
    ring.position.y = 0.15;
    this.turntable.add(ring);
    scene.add(this.turntable);

    // Studio dome with glowing light rings.
    const wallTex = stripesTexture();
    wallTex.repeat.set(1, 1);
    const wall = new THREE.Mesh(
      new THREE.SphereGeometry(30, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#0b0d14', emissive: '#6f8bff', emissiveMap: wallTex, emissiveIntensity: 1.1, side: THREE.BackSide, roughness: 0.9 }),
    );
    wall.scale.y = 0.5;
    scene.add(wall);
    // Overhead light panel.
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 5).rotateX(Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(1.6), toneMapped: false }),
    );
    panel.position.y = 9;
    scene.add(panel);

    // Lights.
    scene.add(new THREE.HemisphereLight('#9fb4ff', '#1a1420', 0.5));
    const key = new THREE.SpotLight('#ffffff', 140, 40, 0.55, 0.6, 1.4);
    key.position.set(0, 12, 2);
    key.target.position.set(0, 0, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0005;
    scene.add(key, key.target);
    const rimA = new THREE.PointLight('#ff3ea5', 14, 20, 1.6);
    rimA.position.set(-7, 6, -6);
    const rimB = new THREE.PointLight('#39d5ff', 14, 20, 1.6);
    rimB.position.set(7, 6, -6);
    scene.add(rimA, rimB);

    if (quality === 'high') {
      this.composer = new EffectComposer(renderer);
      this.composer.addPass(new RenderPass(scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.35, 0.5, 0.92);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    }

    this.mode = 'menu';
    this.shift = 0;
    this.targetShift = 0;
    this.angle = 0;
    this.car = null;
    this.resize(window.innerWidth, window.innerHeight);
  }

  setCar(cfg) {
    if (this.car) this.car.dispose();
    this.car = new CarModel(cfg, { shadows: true });
    this.turntable.add(this.car.root);
    this.car.root.position.y = 0.16;
    this.pop = 0.25;
    this.buildExtra();
  }

  // Fire up the nitro for a moment (when picking nitro or exhaust parts).
  demoNitro() {
    this.flameDemo = 2.2;
  }

  // Show the light trail or the Bubble Reef bubble while picking them in the Style tab.
  setExtra(kind) {
    if (this.extra === kind) return;
    this.extra = kind;
    this.buildExtra();
  }

  buildExtra() {
    if (this.trail) this.trail.dispose();
    if (this.bubble) {
      this.bubble.geometry.dispose();
      this.bubble.material.dispose();
      this.bubble.removeFromParent();
    }
    this.trail = null;
    this.bubble = null;
    const cfg = this.car && this.car.cfg;
    if (!cfg) return;
    if (this.extra === 'trail' && cfg.trail && cfg.trail !== 'none') {
      this.trail = new Trail(cfg.trail, cfg.accent, this.car.width * 0.36, -this.car.length * 0.5);
      this.scene.add(this.trail.mesh);
    }
    if (this.extra === 'bubble') {
      this.bubbleTime = this.bubbleTime || { value: 0 };
      const tint = BUBBLES.find((b) => b.id === cfg.bubble)?.color || null;
      this.bubble = carBubble(this.car, this.bubbleTime, tint);
      this.car.root.add(this.bubble);
    }
  }

  setMode(mode) {
    this.mode = mode;
    this.controls.enabled = mode === 'garage';
    this.updateShift();
  }

  updateShift() {
    const w = this.width;
    const wide = w > 900;
    const landscape = w > this.height && w > 600;
    if (wide) this.targetShift = this.mode === 'menu' ? -w * 0.22 : this.mode === 'garage' ? -w * 0.07 : 0;
    else if (landscape) this.targetShift = this.mode === 'menu' ? -w * 0.2 : this.mode === 'garage' ? -w * 0.2 : 0;
    else this.targetShift = 0;
  }

  update(dt) {
    this.renderer.toneMappingExposure = 1.0;
    if (!this.dragging) this.turntable.rotation.y += dt * (this.mode === 'menu' ? 0.35 : 0.18);
    if (this.mode === 'menu') {
      this.angle += dt * 0.05;
      const r = 11.5;
      this.camera.position.lerp(new THREE.Vector3(Math.sin(this.angle + 0.8) * r, 2.6, Math.cos(this.angle + 0.8) * r), damp(2, dt));
      this.camera.lookAt(this.controls.target);
    } else {
      this.controls.update();
    }
    if (this.car) {
      if (this.pop > 0) {
        this.pop -= dt;
        const s = 1 + Math.max(0, this.pop) * 0.25;
        this.car.root.scale.setScalar(s);
      }
      if (this.flameDemo > 0) this.flameDemo -= dt;
      this.car.setNitro(this.flameDemo > 0);
      this.car.animate(dt, 0, 0, 0, 0, false);
      if (this.trail) this.trail.preview(this.car.root, this.camera, dt);
      if (this.bubbleTime) this.bubbleTime.value += dt;
    }
    this.shift += (this.targetShift - this.shift) * damp(5, dt);
    this.camera.setViewOffset(this.width, this.height, this.shift, 0, this.width, this.height);
    this.ringMat.color.setHSL((performance.now() / 8000) % 1, 0.9, 0.6).multiplyScalar(2.5);
  }

  render() {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  resize(w, h) {
    this.width = w;
    this.height = h;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.composer) {
      this.composer.setSize(w, h);
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
    }
    this.updateShift();
  }
}
