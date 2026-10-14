// Night and rain: any track can be raced at night, in the rain, or both.
// This turns a track definition into its night / rainy version.

// Neon City and Lava Volcano are night tracks already.
export function canNight(def) {
  return !def.theme.night;
}

// What falls from the sky: rain, a blizzard on the snow track, nothing on the Moon.
export function rainKind(def) {
  if (def.id === 'moon') return null;
  return def.theme.weather === 'snow' ? 'blizzard' : 'rain';
}

const mix = (a, b, t) => {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (p, s) => (p >> s) & 255;
  const c = (s) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t);
  return '#' + ((c(16) << 16) | (c(8) << 8) | c(0)).toString(16).padStart(6, '0');
};

export function withConditions(def, { night = false, rain = false } = {}) {
  const n = night && canNight(def);
  const r = rain ? rainKind(def) : null;
  if (!n && !r) return def;
  const T = JSON.parse(JSON.stringify(def.theme));
  const nightNow = T.night || n;

  if (n) {
    // Moonlight: a dark blue sky with stars, the moon where the sun was, lamps along the track.
    T.sky = { ...T.sky, top: '#03050f', horizon: mix(T.sky.horizon, '#16203c', 0.85), sunColor: '#d6e2ff', stars: true };
    T.sky.bottom = T.sky.horizon;
    T.sky.sun = [T.sky.sun[0], Math.max(0.45, T.sky.sun[1]), T.sky.sun[2]];
    T.fog = { color: mix(T.fog.color, '#0c1326', 0.88), near: T.fog.near * 0.7, far: T.fog.far * 0.7 };
    T.hemi = { sky: '#4a5a90', ground: mix(T.hemi.ground, '#141826', 0.75), intensity: T.ground === 'snow' ? 0.75 : 0.55 };
    T.sunLight = { color: '#a8bcff', intensity: T.ground === 'snow' ? 0.9 : 0.65 };
    T.exposure = (T.exposure || 1) * 1.12;
    T.bloom = { strength: 0.7, radius: 0.5, threshold: 0.7 };
    T.night = true;
    T.nightMode = true; // night added by the player, not a night track
    T.nightLights = true;
    T.clouds = false;
  }

  if (r) {
    T.weather = r;
    if (r === 'rain') {
      // Grey clouds, a closer horizon, a wet shiny road and less grip.
      const grey = nightNow ? '#0a0e16' : '#9aa3ad';
      T.sky = { ...T.sky, top: nightNow ? '#020306' : '#5f6873', horizon: nightNow ? mix(T.sky.horizon, '#0d121c', 0.6) : '#a7afb8', sunColor: nightNow ? T.sky.sunColor : '#3a3e44' };
      T.sky.bottom = T.sky.horizon;
      if (nightNow) T.sky.stars = false;
      T.fog = { color: nightNow ? mix(T.fog.color, grey, 0.5) : grey, near: T.fog.near * 0.45, far: T.fog.far * 0.5 };
      T.hemi = { ...T.hemi, sky: nightNow ? T.hemi.sky : '#b8c2cc', intensity: T.hemi.intensity * 0.85 };
      T.sunLight = { ...T.sunLight, intensity: T.sunLight.intensity * (nightNow ? 0.7 : 0.4) };
      T.clouds = true;
      T.cloudTint = nightNow ? '#20242e' : '#7d858f';
      T.wet = true;
      T.grip = T.grip * 0.88;
    } else {
      // Blizzard: much more snow and fog.
      T.fog = { ...T.fog, near: T.fog.near * 0.4, far: T.fog.far * 0.45 };
      T.sunLight = { ...T.sunLight, intensity: T.sunLight.intensity * 0.6 };
      T.grip = T.grip * 0.93;
    }
  }

  return { ...def, theme: T, conditions: { night: n || def.theme.night, rain: r } };
}
