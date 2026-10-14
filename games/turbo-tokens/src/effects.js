// Particles (tyre smoke, dust, snow, sparks) and skid marks.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/+esm';

const vert = /* glsl */ `
  attribute float size;
  attribute float alpha;
  attribute vec3 color;
  varying float vAlpha;
  varying vec3 vColor;
  uniform float scale;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = max(0.0, size) * scale / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
    // Fade particles that get right in front of the camera.
    vAlpha = alpha * smoothstep(1.5, 7.0, -mv.z);
    vColor = color;
  }
`;
const frag = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p);
    float a = smoothstep(0.5, 0.0, d) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

export class Particles {
  constructor(max = 600, { additive = false } = {}) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.a0 = new Float32Array(max);
    this.cursor = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: { scale: { value: 400 } },
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  setViewportHeight(h) {
    this.mat.uniforms.scale.value = h * 0.6;
  }

  emit(x, y, z, vx, vy, vz, size, life, color, alpha = 0.6, grow = 1.5) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.col[i * 3] = color.r;
    this.col[i * 3 + 1] = color.g;
    this.col[i * 3 + 2] = color.b;
    this.size[i] = size;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.grow[i] = grow;
    this.a0[i] = alpha;
    this.alpha[i] = alpha;
  }

  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      this.life[i] -= dt;
      const t = Math.max(0, this.life[i] / this.maxLife[i]);
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.vel[i * 3] *= 1 - 1.5 * dt;
      this.vel[i * 3 + 2] *= 1 - 1.5 * dt;
      this.size[i] += this.grow[i] * dt;
      this.alpha[i] = this.a0[i] * t;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.size.needsUpdate = true;
    this.geo.attributes.alpha.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }

  dispose() {
    this.geo.dispose();
    this.mat.dispose();
  }
}

// Dark rubber streaks left behind when sliding.
export class SkidMarks {
  constructor(max = 1200, color = 0x111111, opacity = 0.55) {
    this.max = max;
    this.cursor = 0;
    this.pos = new Float32Array(max * 4 * 3);
    this.alpha = new Float32Array(max * 4);
    const idx = new Uint32Array(max * 6);
    for (let i = 0; i < max; i++) {
      idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3], i * 6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color(color) }, opacity: { value: opacity } },
      vertexShader: `attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 color; uniform float opacity; varying float vA; void main(){ gl_FragColor = vec4(color, vA * opacity); }`,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.last = new Map();
  }

  // Add a segment for wheel `key` ending at (x, z) with side vector (sx, sz).
  add(key, x, z, sx, sz, width, strength, ground = 0) {
    const prev = this.last.get(key);
    const hw = width / 2;
    const cur = { x, z, lx: x + sx * hw, lz: z + sz * hw, rx: x - sx * hw, rz: z - sz * hw };
    this.last.set(key, cur);
    if (!prev) return;
    const d = Math.hypot(prev.x - x, prev.z - z);
    if (d < 0.05 || d > 6) return;
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    const y = ground + 0.035;
    const p = this.pos;
    const o = i * 12;
    p[o] = prev.lx; p[o + 1] = y; p[o + 2] = prev.lz;
    p[o + 3] = prev.rx; p[o + 4] = y; p[o + 5] = prev.rz;
    p[o + 6] = cur.lx; p[o + 7] = y; p[o + 8] = cur.lz;
    p[o + 9] = cur.rx; p[o + 10] = y; p[o + 11] = cur.rz;
    this.alpha.fill(Math.min(1, strength), i * 4, i * 4 + 4);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.alpha.needsUpdate = true;
  }

  lift(key) {
    this.last.delete(key);
  }

  dispose() {
    this.geo.dispose();
    this.mat.dispose();
  }
}
