// Renderer, scene, sky, fog and lights.
import * as THREE from 'three';

export function createScene(region) {
  const p = region.palette;

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(p.sky);
  scene.fog = new THREE.Fog(p.fog, 90, 520);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 4000);

  // Lights: a warm "hellfire sun" plus a soft sky/ground fill.
  const hemi = new THREE.HemisphereLight(p.ambientSky, p.ambientGround, 1.5);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(p.sun, 2.4);
  sun.position.set(-60, 90, -40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60; sc.near = 1; sc.far = 300;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  scene.add(sun.target);

  scene.add(createSkyDome(p));
  scene.add(createDistantMountains(p));

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Keep the shadow area centered on the player so shadows stay sharp.
  const sunOffset = sun.position.clone();
  function followPlayer(pos) {
    sun.position.copy(pos).add(sunOffset);
    sun.target.position.copy(pos);
  }

  return { renderer, scene, camera, followPlayer, lights: { hemi, sun, sunOffset } };
}

// A big sphere around the world, dark at the top and glowing red at the horizon.
function createSkyDome(p) {
  const geo = new THREE.SphereGeometry(3000, 24, 12);
  const top = new THREE.Color(0x12060a);
  const horizon = new THREE.Color(p.fog).lerp(new THREE.Color(0xff4a1a), 0.35);
  const colors = [];
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp(pos.getY(i) / 3000, 0, 1);
    const c = horizon.clone().lerp(top, Math.pow(t, 0.55));
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
  const dome = new THREE.Mesh(geo, mat);
  dome.renderOrder = -1;
  return dome;
}

// A ring of dark jagged mountains on the horizon so the world has an edge.
function createDistantMountains(p) {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0x1c0a08, fog: false });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xff4a10, fog: false });
  const geo = new THREE.ConeGeometry(1, 1, 5);
  const count = 70;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.sin(i * 7.3) * 0.03;
    const r = 2200 + Math.sin(i * 3.1) * 150;
    const h = 120 + Math.abs(Math.sin(i * 1.7)) * 260;
    const w = 150 + Math.abs(Math.cos(i * 2.3)) * 160;
    const m = new THREE.Mesh(geo, mat);
    m.position.set(Math.cos(a) * r, h / 2 - 10, Math.sin(a) * r);
    m.scale.set(w, h, w);
    m.rotation.y = i;
    group.add(m);
    // Some peaks are volcanoes with a glowing tip.
    if (i % 9 === 0) {
      const tip = new THREE.Mesh(geo, glowMat);
      tip.position.set(m.position.x, h - 18, m.position.z);
      tip.scale.set(w * 0.12, 22, w * 0.12);
      group.add(tip);
    }
  }
  return group;
}
