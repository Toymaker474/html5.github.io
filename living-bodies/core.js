export const TAU = Math.PI * 2;
export const WORLD_W = 7200;
export const WORLD_H = 1900;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const sign = v => v < 0 ? -1 : v > 0 ? 1 : 0;

export class RNG {
  constructor(seed = 1) { this.s = seed >>> 0 || 1; }
  next() { let x = this.s; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.s = x >>> 0; return this.s / 4294967296; }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  pick(a) { return a[(this.next() * a.length) | 0]; }
  chance(p) { return this.next() < p; }
}

export const SPECIES = {
  grazer: { name: 'Lantern Grazer', hue: 156, predator: false, scavenger: false, flyer: false, baseSize: 17, limbs: 4, speed: 0.92 },
  skitter: { name: 'Needle Skitter', hue: 52, predator: false, scavenger: false, flyer: false, baseSize: 12, limbs: 6, speed: 1.38 },
  crawler: { name: 'Mirror Crawler', hue: 282, predator: false, scavenger: true, flyer: false, baseSize: 20, limbs: 6, speed: 0.72 },
  hunter: { name: 'Rift Stalker', hue: 348, predator: true, scavenger: false, flyer: false, baseSize: 21, limbs: 4, speed: 1.16 },
  glider: { name: 'Halo Glider', hue: 202, predator: false, scavenger: false, flyer: true, baseSize: 15, limbs: 2, speed: 1.02 },
  maw: { name: 'Gravitic Maw', hue: 316, predator: true, scavenger: true, flyer: false, baseSize: 27, limbs: 4, speed: 0.68 },
  mimic: { name: 'Choir Mimic', hue: 24, predator: true, scavenger: false, flyer: false, baseSize: 18, limbs: 4, speed: 0.96 }
};

const DEFAULTS = {
  device: 'auto',
  graphics: 'auto',
  science: 'deep',
  population: 78,
  maxPopulation: 132,
  evolution: 5,
  climate: 5,
  anatomy: 'full',
  plants: 'deep',
  creepy: 6,
  injury: 6
};

function gene(rng, base, spread = 0.2, parent = null, mutation = 0.04) {
  const source = parent == null ? base : parent;
  return clamp(source * (1 + rng.range(-spread, spread) + rng.range(-mutation, mutation)), 0.15, 2.4);
}

export class SpatialHash {
  constructor(size = 240) { this.size = size; this.map = new Map(); }
  key(x, y) { return `${Math.floor(x / this.size)},${Math.floor(y / this.size)}`; }
  clear() { this.map.clear(); }
  add(o) { const k = this.key(o.x, o.y); let a = this.map.get(k); if (!a) this.map.set(k, a = []); a.push(o); }
  query(x, y, radius) {
    const out = [], r = Math.ceil(radius / this.size), cx = Math.floor(x / this.size), cy = Math.floor(y / this.size);
    for (let yy = cy - r; yy <= cy + r; yy++) for (let xx = cx - r; xx <= cx + r; xx++) {
      const a = this.map.get(`${xx},${yy}`); if (a) out.push(...a);
    }
    return out;
  }
}

export class ClimateCell {
  constructor(rng, x, terrain) {
    this.x = x;
    this.temperature = rng.range(8, 28) - Math.max(0, 1100 - terrain) * 0.006;
    this.moisture = rng.range(0.28, 0.72);
    this.nutrients = rng.range(0.35, 0.9);
    this.oxygen = rng.range(0.62, 0.86);
    this.toxin = rng.range(0, 0.08);
    this.wind = 0;
    this.rain = 0;
    this.light = 0.5;
  }
}

export class Plant {
  constructor(world, x, parent = null) {
    const r = world.rng;
    this.id = world.nextPlantId++;
    this.x = x;
    this.y = world.terrainY(x);
    this.age = 0;
    this.health = 1;
    this.water = r.range(0.45, 0.9);
    this.sugar = r.range(0.35, 0.75);
    this.nutrients = r.range(0.35, 0.8);
    this.height = parent ? clamp(parent.height * r.range(0.72, 1.18), 12, 130) : r.range(18, 76);
    this.crown = parent ? clamp(parent.crown * r.range(0.78, 1.2), 8, 70) : r.range(10, 42);
    this.hue = parent ? (parent.hue + r.range(-12, 12) + 360) % 360 : r.range(110, 185);
    this.carnivore = parent ? parent.carnivore && r.chance(0.82) : r.chance(0.075 + world.settings.creepy * 0.006);
    this.toxin = parent ? clamp(parent.toxin + r.range(-0.06, 0.06), 0, 1) : r.range(0, 0.35);
    this.rootReach = parent ? clamp(parent.rootReach * r.range(0.86, 1.18), 35, 220) : r.range(55, 160);
    this.root = Array.from({ length: 5 }, (_, i) => ({ x: this.x + r.range(-12, 12) * i, y: this.y + i * this.rootReach / 5 }));
    this.phase = r.range(0, TAU);
    this.seedClock = r.range(18, 80);
    this.dead = false;
  }
}

function makePoint(x, y, mass = 1) { return { x, y, px: x, py: y, mass, health: 1, fracture: 0, tissue: 1 }; }

export class Creature {
  constructor(world, kind, x, y, parent = null) {
    const r = world.rng, meta = SPECIES[kind], pg = parent?.genes;
    this.world = world;
    this.id = world.nextCreatureId++;
    this.kind = kind;
    this.meta = meta;
    this.name = `${r.pick(['Vex','Oro','Nym','Silt','Aru','Khe','Mire','Thren','Lux','Vaal'])}-${r.int(100,999)}`;
    this.generation = parent ? parent.generation + 1 : 1;
    this.genes = {
      size: gene(r, 1, 0.18, pg?.size, world.mutationRate),
      speed: gene(r, 1, 0.18, pg?.speed, world.mutationRate),
      metabolism: gene(r, 1, 0.2, pg?.metabolism, world.mutationRate),
      vision: gene(r, 1, 0.25, pg?.vision, world.mutationRate),
      fertility: gene(r, 1, 0.28, pg?.fertility, world.mutationRate),
      thermal: gene(r, 1, 0.24, pg?.thermal, world.mutationRate),
      aggression: gene(r, meta.predator ? 1.25 : 0.55, 0.3, pg?.aggression, world.mutationRate),
      social: gene(r, 0.75, 0.38, pg?.social, world.mutationRate),
      hydration: gene(r, 1, 0.22, pg?.hydration, world.mutationRate),
      healing: gene(r, 1, 0.26, pg?.healing, world.mutationRate),
      grip: gene(r, meta.flyer ? 0.55 : 1, 0.25, pg?.grip, world.mutationRate),
      mimicry: gene(r, kind === 'mimic' ? 1.7 : 0.25, 0.2, pg?.mimicry, world.mutationRate),
      observationFear: gene(r, r.range(0.3, 1.4), 0.2, pg?.observationFear, world.mutationRate)
    };
    this.r = meta.baseSize * this.genes.size;
    this.mass = this.r * this.r * 0.008;
    this.x = x; this.y = y; this.vx = r.range(-12, 12); this.vy = 0;
    this.facing = r.chance(0.5) ? -1 : 1;
    this.energy = r.range(0.55, 0.9);
    this.hydration = r.range(0.55, 0.95);
    this.oxygen = 1;
    this.blood = 1;
    this.bodyTemp = r.range(18, 26);
    this.pain = 0;
    this.fatigue = r.range(0, 0.18);
    this.stress = r.range(0, 0.15);
    this.health = 1;
    this.age = 0;
    this.dead = false;
    this.grounded = false;
    this.mode = 'wander';
    this.target = null;
    this.memory = [];
    this.socialTarget = null;
    this.thinkClock = r.range(0, 0.24);
    this.reproClock = r.range(20, 70);
    this.attackClock = 0;
    this.freezeClock = 0;
    this.observed = false;
    this.lastImpact = 0;
    this.organs = { brain: 1, heart: 1, lungs: 1, gut: 1 };
    this.hue = parent ? (parent.hue + r.range(-14, 14) + 360) % 360 : (meta.hue + r.range(-18, 18) + 360) % 360;
    this.spineCount = clamp(Math.round(4 + this.genes.size * 2 + r.range(-1, 1)), 4, 8);
    this.limbCount = meta.flyer ? 2 : clamp(meta.limbs + (r.chance(0.08) ? r.pick([-2, 2]) : 0), 2, 8);
    this.points = [];
    for (let i = 0; i < this.spineCount; i++) this.points.push(makePoint(x - this.facing * i * this.r * 0.55, y + i * 0.4, i === 0 ? 1.4 : 1));
    this.limbs = [];
    for (let i = 0; i < this.limbCount; i++) {
      const anchor = clamp(1 + Math.floor(i / 2), 1, this.spineCount - 1);
      const side = i % 2 ? -1 : 1;
      const hip = this.points[anchor];
      const upper = makePoint(hip.x, hip.y + side * this.r * 0.35, 0.45);
      const foot = makePoint(hip.x + this.facing * r.range(-0.15, 0.22) * this.r, hip.y + this.r * r.range(0.8, 1.15), 0.3);
      this.points.push(upper, foot);
      this.limbs.push({ anchor, upper: this.points.length - 2, foot: this.points.length - 1, side, health: 1, fracture: 0, grip: 0, planted: false, phase: i / this.limbCount * TAU });
    }
    this.muscles = [];
    for (let i = 1; i < this.spineCount; i++) this.muscles.push({ a: i - 1, b: i, rest: this.r * 0.55, strength: 0.72, health: 1 });
    for (const limb of this.limbs) {
      this.muscles.push({ a: limb.anchor, b: limb.upper, rest: this.r * 0.55, strength: 0.62, health: 1, limb });
      this.muscles.push({ a: limb.upper, b: limb.foot, rest: this.r * 0.72, strength: 0.66, health: 1, limb });
    }
  }

  remember(type, x, y, weight = 1) {
    const old = this.memory.find(m => m.type === type && Math.abs(m.x - x) < 100);
    if (old) { old.x = lerp(old.x, x, 0.25); old.y = lerp(old.y, y, 0.25); old.weight = clamp(old.weight + 0.12 * weight, 0, 3); old.age = 0; }
    else { this.memory.push({ type, x, y, weight, age: 0 }); if (this.memory.length > 12) this.memory.shift(); }
  }

  mutate(force = 1) {
    const r = this.world.rng;
    for (const key of Object.keys(this.genes)) if (r.chance(0.35 * force)) this.genes[key] = clamp(this.genes[key] * r.range(0.75, 1.28), 0.15, 2.4);
    this.hue = (this.hue + r.range(25, 110)) % 360;
    this.energy = Math.min(1, this.energy + 0.16);
    this.health = Math.min(1, this.health + 0.08);
  }
}
