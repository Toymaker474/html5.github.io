export const TILE = 32;
export const MAP_W = 224;
export const MAP_H = 64;
export const WORLD_W = MAP_W * TILE;
export const WORLD_H = MAP_H * TILE;
export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => clamp((v - a) / (b - a || 1), 0, 1);
export const smoothstep = (a, b, v) => { const t = invLerp(a, b, v); return t * t * (3 - 2 * t); };
export const sign = v => (v < 0 ? -1 : v > 0 ? 1 : 0);
export const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
export const approach = (value, target, amount) => value < target ? Math.min(target, value + amount) : Math.max(target, value - amount);
export const wrap = (value, max) => ((value % max) + max) % max;

export class RNG {
  constructor(seed = (Date.now() ^ 0x9e3779b9) >>> 0) { this.s = seed >>> 0 || 1; }
  next() { let x = this.s; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.s = x >>> 0; return this.s / 4294967296; }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  pick(arr) { return arr[Math.min(arr.length - 1, Math.floor(this.next() * arr.length))]; }
  chance(p) { return this.next() < p; }
  signed() { return this.next() * 2 - 1; }
}

export function hash2(x, y, seed) {
  let n = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

export function noise2(x, y, seed) {
  const x0 = Math.floor(x), y0 = Math.floor(y), tx = x - x0, ty = y - y0;
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const a = hash2(x0, y0, seed), b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed), d = hash2(x0 + 1, y0 + 1, seed);
  return lerp(lerp(a, b, sx), lerp(c, d, sx), sy);
}

export function fractalNoise(x, y, seed, octaves = 4) {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) { sum += noise2(x * freq, y * freq, seed + i * 911) * amp; norm += amp; amp *= 0.5; freq *= 2; }
  return sum / norm;
}

export const ROLE = {
  nibbler: { name: 'Lumen Grazer', hue: 158, diet: 'herbivore', predator: false, scavenger: false, flyer: false, pace: 54, burst: 92, mass: 0.82, fear: 1.0, social: 0.78, activity: 'diurnal' },
  skitter: { name: 'Prism Skitter', hue: 52, diet: 'herbivore', predator: false, scavenger: false, flyer: false, pace: 68, burst: 118, mass: 0.46, fear: 1.35, social: 0.36, activity: 'crepuscular' },
  carrion: { name: 'Mire Recycler', hue: 284, diet: 'omnivore', predator: false, scavenger: true, flyer: false, pace: 42, burst: 72, mass: 1.05, fear: 0.72, social: 0.24, activity: 'nocturnal' },
  hunter: { name: 'Rift Prowler', hue: 348, diet: 'carnivore', predator: true, scavenger: false, flyer: false, pace: 58, burst: 132, mass: 1.28, fear: 0.12, social: 0.18, activity: 'crepuscular' },
  glider: { name: 'Aether Ray', hue: 202, diet: 'nectar', predator: false, scavenger: false, flyer: true, pace: 64, burst: 106, mass: 0.58, fear: 0.76, social: 0.60, activity: 'diurnal' },
  lurker: { name: 'Veil Ambusher', hue: 316, diet: 'carnivore', predator: true, scavenger: false, flyer: false, pace: 34, burst: 108, mass: 1.48, fear: 0.04, social: 0.08, activity: 'nocturnal' }
};

export const BIOMES = [
  { name: 'Luminous Drain', hue: 174, temperature: 0.54, oxygen: 0.76, toxin: 0.06, gravity: 1.00, fertility: 1.12, moisture: 0.72, canopy: 0.48 },
  { name: 'Bone Orchard', hue: 46, temperature: 0.67, oxygen: 0.62, toxin: 0.11, gravity: 1.02, fertility: 0.87, moisture: 0.36, canopy: 0.22 },
  { name: 'Glass Marsh', hue: 196, temperature: 0.49, oxygen: 0.84, toxin: 0.17, gravity: 0.94, fertility: 1.26, moisture: 0.92, canopy: 0.66 },
  { name: 'Veil Causeway', hue: 288, temperature: 0.42, oxygen: 0.58, toxin: 0.34, gravity: 1.08, fertility: 0.70, moisture: 0.48, canopy: 0.76 },
  { name: 'Fungal Vault', hue: 132, temperature: 0.57, oxygen: 0.69, toxin: 0.21, gravity: 1.00, fertility: 1.44, moisture: 0.82, canopy: 0.88 },
  { name: 'Sky Maw', hue: 224, temperature: 0.31, oxygen: 0.52, toxin: 0.05, gravity: 0.77, fertility: 0.63, moisture: 0.28, canopy: 0.08 },
  { name: 'Shiverworks', hue: 332, temperature: 0.22, oxygen: 0.46, toxin: 0.27, gravity: 1.14, fertility: 0.56, moisture: 0.44, canopy: 0.18 },
  { name: 'Abyssal Nursery', hue: 164, temperature: 0.45, oxygen: 0.79, toxin: 0.09, gravity: 0.88, fertility: 1.31, moisture: 0.88, canopy: 0.72 }
];

export const PLANT_SPECIES = [
  { id: 'fanfern', name: 'Fan Fern', hue: 156, form: 'fern', maxBiomass: 1.4, height: 58, moisture: 0.62, light: 0.48, temp: 0.54, growth: 0.020, seedRange: 170, edible: 0.82, fruit: 0.08, toxin: 0.02 },
  { id: 'glassreed', name: 'Glass Reed', hue: 194, form: 'reed', maxBiomass: 1.1, height: 84, moisture: 0.82, light: 0.72, temp: 0.49, growth: 0.018, seedRange: 230, edible: 0.62, fruit: 0.05, toxin: 0.04 },
  { id: 'orbloom', name: 'Orb Bloom', hue: 315, form: 'flower', maxBiomass: 0.85, height: 44, moisture: 0.55, light: 0.78, temp: 0.58, growth: 0.024, seedRange: 280, edible: 0.38, fruit: 0.75, toxin: 0.08 },
  { id: 'bonebriar', name: 'Bone Briar', hue: 42, form: 'briar', maxBiomass: 1.7, height: 72, moisture: 0.28, light: 0.82, temp: 0.68, growth: 0.012, seedRange: 110, edible: 0.24, fruit: 0.34, toxin: 0.22 },
  { id: 'veilcap', name: 'Veil Cap', hue: 282, form: 'fungus', maxBiomass: 1.25, height: 36, moisture: 0.78, light: 0.18, temp: 0.50, growth: 0.027, seedRange: 200, edible: 0.52, fruit: 0.0, toxin: 0.18 },
  { id: 'lumenpod', name: 'Lumen Pod', hue: 168, form: 'pod', maxBiomass: 1.0, height: 50, moisture: 0.66, light: 0.58, temp: 0.51, growth: 0.021, seedRange: 190, edible: 0.48, fruit: 0.62, toxin: 0.03 },
  { id: 'shiverlichen', name: 'Shiver Lichen', hue: 332, form: 'lichen', maxBiomass: 0.72, height: 16, moisture: 0.40, light: 0.38, temp: 0.24, growth: 0.015, seedRange: 90, edible: 0.34, fruit: 0.0, toxin: 0.12 },
  { id: 'skyfrond', name: 'Sky Frond', hue: 220, form: 'frond', maxBiomass: 0.95, height: 94, moisture: 0.30, light: 0.90, temp: 0.34, growth: 0.013, seedRange: 340, edible: 0.44, fruit: 0.26, toxin: 0.05 }
];

export function activityFactor(activity, daylight) {
  if (activity === 'diurnal') return 0.25 + daylight * 0.75;
  if (activity === 'nocturnal') return 0.25 + (1 - daylight) * 0.75;
  return 0.62 + Math.abs(daylight - 0.5) * 0.76;
}
