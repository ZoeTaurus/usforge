// GRAPHICS QUALITY: Low / Medium / High (pick it in the main menu).
// Changing it restarts the page, because some of it (antialiasing, which
// lighting model the materials use) can only be set at start-up.
//
//   LOW     fastest: simple lighting model, no shadows, no extra lights
//   MEDIUM  shadows, headlights, muzzle-flash light, glowing eyes and lava
//   HIGH    everything on Medium plus soft shadows, bloom (bright things
//           glow), filmic colors, explosion flashes and sharper rendering
import * as THREE from 'three';

const KEY = 'helldrive.graphics';

export const QUALITY_LEVELS = {
  low: {
    label: 'LOW', pixelRatio: 1, antialias: false, shadows: false, shadowSize: 1024, softShadows: false,
    lambert: true, bloom: false, toneMapping: false, carLights: false, flashLights: false, glow: 0.8, embers: 250,
  },
  medium: {
    label: 'MEDIUM', pixelRatio: 1.25, antialias: true, shadows: true, shadowSize: 1024, softShadows: false,
    lambert: false, bloom: false, toneMapping: true, carLights: true, flashLights: false, glow: 1.2, embers: 400,
  },
  high: {
    label: 'HIGH', pixelRatio: 2, antialias: true, shadows: true, shadowSize: 2048, softShadows: true,
    lambert: false, bloom: true, toneMapping: true, carLights: true, flashLights: true, glow: 1.5, embers: 600,
  },
};
export const QUALITY_ORDER = ['low', 'medium', 'high'];

function load() {
  try { const v = localStorage.getItem(KEY); if (v in QUALITY_LEVELS) return v; } catch { /* ignore */ }
  return 'medium';
}

export const GFX = { name: load(), ...QUALITY_LEVELS[load()] };

export function setQuality(name) {
  try { localStorage.setItem(KEY, name); } catch { /* ignore */ }
}

// The lit material to use everywhere: Lambert (cheap) on Low, Standard otherwise.
export function litMaterial(params = {}) {
  if (GFX.lambert) {
    const { roughness, metalness, ...rest } = params; // (Lambert has no roughness/metalness)
    return new THREE.MeshLambertMaterial(rest);
  }
  return new THREE.MeshStandardMaterial(params);
}
