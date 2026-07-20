export const TAU = Math.PI * 2;
export const WORLD_W = 6400;
export const WORLD_H = 1800;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const sign = v => (v < 0 ? -1 : v > 0 ? 1 : 0);

export const DEFAULT_SIM_SETTINGS = Object.freeze({
  population: 82,
  maxPopulation: 126,
  evolution: 5,
  climate: 5,
  science: 'deep',
  device: 'auto'
});

export const SPECIES = Object.freeze({
  grazer:  { name: 'Prism Grazer', hue: 158, predator: false, flyer: false, scavenger: false, baseSpeed: 1.00, baseSize: 0.96, diet: 'flora' },
  skitter: { name: 'Volt Skitter', hue: 48,  predator: false, flyer: false, scavenger: false, baseSpeed: 1.38, baseSize: 0.73, diet: 'flora' },
  crawler: { name: 'Glass Crawler', hue: 278, predator: false, flyer: false, scavenger: true,  baseSpeed: 0.82, baseSize: 1.16, diet: 'mixed' },
  hunter:  { name: 'Rift Prowler', hue: 345, predator: true,  flyer: false, scavenger: false, baseSpeed: 1.20, baseSize: 1.24, diet: 'meat' },
  glider:  { name: 'Halo Glider',  hue: 202, predator: false, flyer: true,  scavenger: false, baseSpeed: 1.08, baseSize: 0.90, diet: 'flora' },
  maw:     { name: 'Grav Maw',     hue: 316, predator: true,  flyer: false, scavenger: true,  baseSpeed: 0.80, baseSize: 1.54, diet: 'meat' }
});

export class RNG {
  constructor(seed = 1) { this.s = seed >>> 0 || 1; }
  next() { let x = this.s; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.s = x >>> 0; return this.s / 4294967296; }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  pick(a) { return a[(this.next() * a.length) | 0]; }
  gaussian() {
    const u = Math.max(1e-9, this.next()), v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
  }
}

class SpatialHash {
  constructor(cellSize = 240) { this.cellSize = cellSize; this.cells = new Map(); }
  clear() { this.cells.clear(); }
  key(x, y) { return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`; }
  insert(item, x = item.x, y = item.y) {
    const k = this.key(x, y);
    let cell = this.cells.get(k);
    if (!cell) this.cells.set(k, cell = []);
    cell.push(item);
  }
  query(x, y, radius, out = []) {
    out.length = 0;
    const cs = this.cellSize;
    const x0 = Math.floor((x - radius) / cs), x1 = Math.floor((x + radius) / cs);
    const y0 = Math.floor((y - radius) / cs), y1 = Math.floor((y + radius) / cs);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const cell = this.cells.get(`${cx},${cy}`);
      if (cell) out.push(...cell);
    }
    return out;
  }
}

const GENE_LIMITS = Object.freeze({
  size: [0.65, 1.65], speed: [0.62, 1.55], metabolism: [0.55, 1.55],
  vision: [0.55, 1.55], fertility: [0.55, 1.55], thermal: [0.55, 1.55],
  aggression: [0.2, 1.8], social: [0.0, 1.6], hydration: [0.55, 1.5]
});

function normalizeSettings(input = {}) {
  const s = { ...DEFAULT_SIM_SETTINGS, ...input };
  s.population = Math.round(clamp(Number(s.population) || 82, 36, 150));
  s.maxPopulation = Math.round(clamp(Number(s.maxPopulation) || Math.max(110, s.population * 1.5), s.population, 190));
  s.evolution = clamp(Number(s.evolution) || 5, 1, 10);
  s.climate = clamp(Number(s.climate) || 5, 1, 10);
  s.science = s.science === 'standard' ? 'standard' : 'deep';
  s.device = ['auto', 'iphone', 'ipad'].includes(s.device) ? s.device : 'auto';
  return s;
}

function geneFromParent(rng, parent, key, base, mutation) {
  const [lo, hi] = GENE_LIMITS[key];
  if (!parent) return clamp(base * (1 + rng.gaussian() * 0.08), lo, hi);
  const inherited = parent.genes[key];
  const changed = rng.next() < mutation ? rng.gaussian() * mutation * 0.8 : rng.gaussian() * 0.015;
  return clamp(inherited * (1 + changed), lo, hi);
}

export class Creature {
  constructor(world, kind, x, y, parent = null) {
    const rng = world.rng;
    const meta = SPECIES[kind];
    const mutation = world.mutationRate;
    this.world = world;
    this.id = world.nextId++;
    this.kind = kind;
    this.meta = meta;
    this.generation = parent ? parent.generation + 1 : 1;
    this.genes = {
      size: geneFromParent(rng, parent, 'size', meta.baseSize, mutation),
      speed: geneFromParent(rng, parent, 'speed', meta.baseSpeed, mutation),
      metabolism: geneFromParent(rng, parent, 'metabolism', 1, mutation),
      vision: geneFromParent(rng, parent, 'vision', meta.predator ? 1.18 : 0.95, mutation),
      fertility: geneFromParent(rng, parent, 'fertility', 1, mutation),
      thermal: geneFromParent(rng, parent, 'thermal', 1, mutation),
      aggression: geneFromParent(rng, parent, 'aggression', meta.predator ? 1.2 : 0.65, mutation),
      social: geneFromParent(rng, parent, 'social', meta.predator ? 0.25 : 0.9, mutation),
      hydration: geneFromParent(rng, parent, 'hydration', 1, mutation)
    };
    this.x = x;
    this.y = y;
    this.vx = rng.range(-18, 18);
    this.vy = 0;
    this.facing = rng.next() < 0.5 ? -1 : 1;
    this.r = clamp(rng.range(12, 17) * this.genes.size, 8, 31);
    this.mass = Math.max(0.25, (this.r / 14) ** 2.35);
    this.energy = rng.range(0.58, 1);
    this.water = rng.range(0.62, 1);
    this.health = 1;
    this.bodyTemp = rng.range(18, 25);
    this.age = parent ? 0 : rng.range(0, 28);
    this.dead = false;
    this.grounded = false;
    this.mode = 'wander';
    this.target = null;
    this.memoryX = x;
    this.memoryY = y;
    this.thinkClock = rng.range(0, 0.22);
    this.reproClock = rng.range(12, 34);
    this.attackClock = 0;
    this.stress = 0;
    this.hue = parent ? (parent.hue + rng.range(-13, 13) + 360) % 360 : (meta.hue + rng.range(-18, 18) + 360) % 360;
    this.morph = {
      segments: parent ? clamp(parent.morph.segments + (rng.next() < mutation ? rng.pick([-1, 1]) : 0), 3, 9) : rng.int(3, 7),
      legs: meta.flyer ? 0 : parent ? parent.morph.legs : rng.pick([2, 4, 6]),
      eyes: parent ? clamp(parent.morph.eyes + (rng.next() < mutation ? rng.pick([-1, 1]) : 0), 1, 5) : rng.int(1, 4),
      horns: meta.predator ? (parent ? clamp(parent.morph.horns + (rng.next() < mutation ? rng.pick([-1, 1]) : 0), 1, 4) : rng.int(1, 3)) : rng.int(0, 1),
      fins: meta.flyer ? (parent ? clamp(parent.morph.fins + (rng.next() < mutation ? rng.pick([-1, 1]) : 0), 2, 5) : rng.int(2, 4)) : rng.int(0, 2)
    };
    this.nodes = Array.from({ length: this.morph.segments }, (_, i) => ({
      x: x - i * this.r * 0.56 * this.facing,
      y,
      px: x - i * this.r * 0.56 * this.facing,
      py: y
    }));
  }

  mutate(strength = 1) {
    const rng = this.world.rng;
    const keys = Object.keys(this.genes);
    const edits = 1 + (rng.next() < 0.45 * strength ? 1 : 0) + (rng.next() < 0.18 * strength ? 1 : 0);
    for (let i = 0; i < edits; i++) {
      const key = rng.pick(keys), [lo, hi] = GENE_LIMITS[key];
      this.genes[key] = clamp(this.genes[key] * (1 + rng.gaussian() * 0.15 * strength), lo, hi);
    }
    this.hue = (this.hue + rng.range(25, 95) * strength) % 360;
    this.r = clamp(this.r * rng.range(0.9, 1.12), 8, 31);
    this.mass = Math.max(0.25, (this.r / 14) ** 2.35);
    this.energy = Math.min(1, this.energy + 0.2);
    this.health = Math.min(1, this.health + 0.12);
  }
}

export class World {
  constructor(seed = (Date.now() ^ 0x9e3779b9) >>> 0, settings = {}) {
    this.settings = normalizeSettings(settings);
    this.seed = seed >>> 0;
    this.rng = new RNG(this.seed);
    this.nextId = 1;
    this.time = 0;
    this.daylight = 0.5;
    this.wind = 0;
    this.rain = 0;
    this.airTemperature = 22;
    this.performanceTier = 'high';
    this.mutationRate = 0.012 + this.settings.evolution * 0.009;
    this.climateVolatility = 0.45 + this.settings.climate * 0.18;
    this.creatures = [];
    this.flora = [];
    this.carcasses = [];
    this.particles = [];
    this.effects = [];
    this.fields = [];
    this.births = 0;
    this.deaths = 0;
    this.climateClock = 0;
    this.ecologyClock = 0;
    this.lifeHash = new SpatialHash(250);
    this.floraHash = new SpatialHash(220);
    this.queryBuffer = [];
    this.heights = new Float32Array(280);
    const requestedCells = this.settings.science === 'deep' ? 144 : 96;
    this.climateCells = this.settings.device === 'iphone' ? Math.min(108, requestedCells) : this.settings.device === 'ipad' ? Math.max(128, requestedCells) : requestedCells;
    this.temperature = new Float32Array(this.climateCells);
    this.moisture = new Float32Array(this.climateCells);
    this.nutrients = new Float32Array(this.climateCells);
    this.generateTerrain();
    this.generateClimate();
    this.seedLife();
  }

  setPerformanceTier(tier) { this.performanceTier = ['low', 'medium', 'high'].includes(tier) ? tier : 'high'; }
  terrainY(x) {
    const f = clamp(x / WORLD_W, 0, 1) * (this.heights.length - 1);
    const i = Math.floor(f), t = f - i;
    return lerp(this.heights[i], this.heights[Math.min(this.heights.length - 1, i + 1)], t);
  }
  terrainSlope(x) {
    const d = 12;
    return (this.terrainY(x + d) - this.terrainY(x - d)) / (d * 2);
  }
  cellIndex(x) { return clamp(Math.floor(clamp(x / WORLD_W, 0, 0.999999) * this.climateCells), 0, this.climateCells - 1); }
  climateAt(x) {
    const i = this.cellIndex(x);
    return { index: i, temperature: this.temperature[i], moisture: this.moisture[i], nutrients: this.nutrients[i] };
  }

  generateTerrain() {
    let y = 1190;
    for (let i = 0; i < this.heights.length; i++) {
      const x = i / (this.heights.length - 1);
      y += this.rng.range(-42, 42);
      const ridge = Math.sin(x * TAU * 2.7) * 105 + Math.sin(x * TAU * 8.8) * 38 + Math.sin(x * TAU * 21.2) * 14;
      this.heights[i] = clamp(y * 0.92 + ridge, 770, 1450);
    }
    for (let pass = 0; pass < 4; pass++) for (let i = 1; i < this.heights.length - 1; i++) {
      this.heights[i] = (this.heights[i - 1] + this.heights[i] * 2 + this.heights[i + 1]) / 4;
    }
  }

  generateClimate() {
    for (let i = 0; i < this.climateCells; i++) {
      const x = (i + 0.5) / this.climateCells * WORLD_W;
      const altitude = WORLD_H - this.terrainY(x);
      this.temperature[i] = 25 - altitude * 0.006 + this.rng.range(-2.5, 2.5);
      this.moisture[i] = clamp(0.42 + Math.sin(i * 0.29) * 0.18 + this.rng.range(-0.12, 0.12), 0.08, 0.92);
      this.nutrients[i] = clamp(0.55 + this.rng.range(-0.18, 0.2), 0.16, 1);
    }
  }

  seedLife() {
    const weights = [
      ['grazer', 0.32], ['skitter', 0.25], ['crawler', 0.15],
      ['hunter', 0.09], ['glider', 0.16], ['maw', 0.03]
    ];
    for (const [kind, weight] of weights) {
      const count = Math.max(2, Math.round(this.settings.population * weight));
      for (let i = 0; i < count; i++) this.spawnCreature(kind);
    }
    const floraCount = Math.round(160 + this.settings.population * 1.25);
    for (let i = 0; i < floraCount; i++) this.addFlora(this.rng.range(70, WORLD_W - 70), false);
    this.rebuildHashes();
  }

  spawnCreature(kind, x = this.rng.range(120, WORLD_W - 120), parent = null) {
    const meta = SPECIES[kind];
    const y = meta.flyer ? this.rng.range(240, Math.max(300, this.terrainY(x) - 150)) : this.terrainY(x) - 36;
    const creature = new Creature(this, kind, x, y, parent);
    this.creatures.push(creature);
    return creature;
  }

  addFlora(x, burst = true) {
    const c = this.climateAt(x);
    const flora = {
      x,
      y: this.terrainY(x) - this.rng.range(4, 16),
      biomass: this.rng.range(0.45, 1),
      maxBiomass: this.rng.range(0.8, 1.25),
      energy: this.rng.range(0.16, 0.31),
      hue: this.rng.next() < 0.15 ? 318 : this.rng.range(132, 174),
      size: this.rng.range(4, 9),
      phase: this.rng.range(0, TAU),
      cell: c.index
    };
    this.flora.push(flora);
    if (burst) for (let i = 0; i < 12; i++) this.particle(x, flora.y, this.rng.range(-55, 55), this.rng.range(-130, -25), flora.hue, 1.2);
    return flora;
  }

  particle(x, y, vx, vy, hue, life = 1, size = null) {
    const cap = this.performanceTier === 'low' ? 240 : this.performanceTier === 'medium' ? 380 : 560;
    if (this.particles.length >= cap) this.particles.splice(0, Math.max(1, this.particles.length - cap + 1));
    this.particles.push({ x, y, vx, vy, hue, life, max: life, size: size ?? this.rng.range(1.5, 4) });
  }

  rebuildHashes() {
    this.lifeHash.clear();
    this.floraHash.clear();
    for (const c of this.creatures) if (!c.dead) this.lifeHash.insert(c);
    for (const f of this.flora) if (f.biomass > 0.035) this.floraHash.insert(f);
  }

  nearestCreature(c, predicate, radius) {
    let best = null, bestD = radius * radius;
    const candidates = this.lifeHash.query(c.x, c.y, radius, this.queryBuffer);
    for (const other of candidates) {
      if (other === c || other.dead || !predicate(other)) continue;
      const dx = other.x - c.x, dy = other.y - c.y, d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = other; }
    }
    return best;
  }

  nearestFlora(c, radius) {
    let best = null, bestScore = Infinity;
    const candidates = this.floraHash.query(c.x, c.y, radius, this.queryBuffer);
    for (const f of candidates) {
      if (f.biomass <= 0.04) continue;
      const dx = f.x - c.x, dy = f.y - c.y;
      const score = dx * dx + dy * dy - f.biomass * 5200;
      if (score < bestScore) { bestScore = score; best = f; }
    }
    return best;
  }

  nearestCarcass(c, radius) {
    let best = null, bd = radius * radius;
    for (const carcass of this.carcasses) {
      const dx = carcass.x - c.x, dy = carcass.y - c.y, d = dx * dx + dy * dy;
      if (d < bd && carcass.mass > 0.02) { bd = d; best = carcass; }
    }
    return best;
  }

  socialVector(c, radius = 190) {
    let center = 0, avoid = 0, count = 0;
    const candidates = this.lifeHash.query(c.x, c.y, radius, this.queryBuffer);
    for (const o of candidates) {
      if (o === c || o.dead || o.kind !== c.kind) continue;
      const dx = o.x - c.x, d = Math.abs(dx);
      if (d < 1 || d > radius) continue;
      center += dx;
      if (d < c.r * 3.4) avoid -= dx / Math.max(12, d);
      count++;
      if (count >= (this.performanceTier === 'low' ? 4 : 8)) break;
    }
    return count ? clamp(center / count / radius + avoid * 0.75, -1, 1) : 0;
  }

  think(c, dt) {
    c.thinkClock -= dt;
    if (c.thinkClock > 0) return;
    const base = this.performanceTier === 'low' ? 0.24 : this.performanceTier === 'medium' ? 0.17 : 0.12;
    c.thinkClock = base + this.rng.range(0, base * 0.65);
    const vision = 430 * c.genes.vision + c.r * 9;
    const climate = this.climateAt(c.x);
    const thermalStress = Math.abs(climate.temperature - 22) / Math.max(0.45, c.genes.thermal);
    let target = null;
    let threat = null;

    if (c.meta.predator) {
      const hungry = c.energy < 0.72 || this.rng.next() < 0.055 * c.genes.aggression;
      target = hungry ? this.nearestCreature(c, o => !o.meta.predator && o.r < c.r * (1.12 + c.genes.aggression * 0.38), vision * 1.12) : null;
      if (!target && c.meta.scavenger) target = this.nearestCarcass(c, vision);
      c.mode = target ? (target.type === 'carcass' ? 'scavenge' : 'hunt') : 'prowl';
    } else {
      threat = this.nearestCreature(c, o => o.meta.predator && o.r > c.r * 0.62, vision * 0.72);
      if (threat) { target = threat; c.mode = 'flee'; }
      else if (c.meta.scavenger && c.energy < 0.52) {
        target = this.nearestCarcass(c, vision);
        c.mode = target ? 'scavenge' : 'forage';
      }
      if (!target) { target = this.nearestFlora(c, vision); c.mode = target ? 'forage' : 'wander'; }
    }

    if ((thermalStress > 7 || c.water < 0.28) && !threat) {
      const direction = climate.temperature > 22 ? -1 : 1;
      c.memoryX = clamp(c.x + direction * this.rng.range(260, 680), 70, WORLD_W - 70);
      c.memoryY = this.terrainY(c.memoryX) - 40;
      c.mode = 'thermoregulate';
      target = null;
    }

    c.target = target;
    if (target && !threat) {
      c.memoryX = target.x;
      c.memoryY = target.y;
    } else if (!target && this.rng.next() < 0.18) {
      c.memoryX = clamp(c.x + this.rng.range(-760, 760), 70, WORLD_W - 70);
      c.memoryY = this.terrainY(c.memoryX) - 40;
    }
    c.socialDrive = this.socialVector(c) * c.genes.social;
  }

  consumeFlora(c) {
    if (c.meta.predator) return;
    const candidates = this.floraHash.query(c.x, c.y, c.r + 22, this.queryBuffer);
    for (const f of candidates) {
      if (f.biomass <= 0.035 || Math.abs(f.x - c.x) > c.r + 15 || Math.abs(f.y - c.y) > c.r + 22) continue;
      const bite = Math.min(f.biomass, 0.16 + c.r * 0.004);
      f.biomass -= bite;
      c.energy = Math.min(1, c.energy + bite * f.energy * 1.8);
      c.water = Math.min(1, c.water + bite * 0.11);
      this.nutrients[f.cell] = Math.min(1, this.nutrients[f.cell] + bite * 0.012);
      for (let i = 0; i < 5; i++) this.particle(f.x, f.y, this.rng.range(-35, 35), this.rng.range(-65, -4), f.hue, 0.55);
      break;
    }
  }

  consumeCarcass(c, dt) {
    if (!c.meta.scavenger && !c.meta.predator) return;
    const carcass = c.target?.type === 'carcass' ? c.target : this.nearestCarcass(c, c.r + 28);
    if (!carcass || Math.hypot(carcass.x - c.x, carcass.y - c.y) > c.r + 30) return;
    const bite = Math.min(carcass.mass, dt * (0.16 + c.r * 0.006));
    carcass.mass -= bite;
    c.energy = Math.min(1, c.energy + bite * 0.55);
    c.water = Math.min(1, c.water + bite * 0.08);
  }

  attack(c) {
    if (!c.meta.predator || c.attackClock > 0 || !c.target || c.target.dead || c.target.type === 'carcass') return;
    const target = c.target;
    if (Math.hypot(target.x - c.x, target.y - c.y) > c.r + target.r + 13) return;
    c.attackClock = 0.82 / Math.max(0.7, c.genes.aggression);
    const damage = (c.kind === 'maw' ? 0.25 : 0.17) * (0.72 + c.mass * 0.24) * c.genes.aggression;
    target.health -= damage;
    target.vx += c.facing * 185 * c.mass;
    target.vy -= 90;
    target.stress = Math.min(1, target.stress + 0.55);
    c.energy = Math.min(1, c.energy + damage * 0.22);
    for (let i = 0; i < 8; i++) this.particle(target.x, target.y, this.rng.range(-80, 80), this.rng.range(-110, 20), target.hue, 0.75);
  }

  stepBody(c, dt) {
    const head = c.nodes[0];
    head.px = head.x; head.py = head.y;
    head.x = lerp(head.x, c.x, clamp(dt * 19, 0, 1));
    head.y = lerp(head.y, c.y, clamp(dt * 19, 0, 1));
    const nodeGravity = c.meta.flyer ? 95 : 420;
    for (let i = 1; i < c.nodes.length; i++) {
      const n = c.nodes[i];
      const vx = (n.x - n.px) * 0.93, vy = (n.y - n.py) * 0.93;
      n.px = n.x; n.py = n.y;
      n.x += vx + this.wind * dt * dt * 0.18;
      n.y += vy + nodeGravity * dt * dt;
      const floor = this.terrainY(n.x) - 3;
      if (n.y > floor) { n.y = floor; n.py = lerp(n.py, n.y, 0.55); }
    }
    const spacing = c.r * 0.56;
    const passes = this.performanceTier === 'low' ? 2 : 3;
    for (let pass = 0; pass < passes; pass++) for (let i = 1; i < c.nodes.length; i++) {
      const a = c.nodes[i - 1], b = c.nodes[i];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      const q = (d - spacing) / d * 0.55;
      b.x -= dx * q; b.y -= dy * q;
      if (i > 1) { a.x += dx * q * 0.28; a.y += dy * q * 0.28; }
    }
  }

  stepCreature(c, dt) {
    c.age += dt;
    c.attackClock = Math.max(0, c.attackClock - dt);
    c.reproClock = Math.max(0, c.reproClock - dt);
    this.think(c, dt);

    const targetX = c.target ? c.target.x : c.memoryX;
    const targetY = c.target ? c.target.y : c.memoryY;
    let dx = targetX - c.x, dy = targetY - c.y;
    if (c.mode === 'flee') { dx = -dx; dy = -dy; }
    const social = c.socialDrive || 0;
    const wanted = sign(dx + social * 180 || c.facing);
    c.facing = wanted || c.facing;
    const terrain = this.terrainY(c.x);
    c.grounded = c.y + c.r * 0.66 >= terrain - 2;
    const slope = this.terrainSlope(c.x);
    const urgency = c.mode === 'hunt' || c.mode === 'flee' ? 1.30 : c.mode === 'thermoregulate' ? 1.12 : 1;
    let ax = wanted * 600 * c.genes.speed * urgency;
    if (!c.grounded) ax *= 0.42;
    ax -= slope * 95;

    if (c.meta.flyer) {
      const desiredY = clamp(targetY - 85, 190, terrain - 100);
      c.vy += (desiredY - c.y) * 1.45 * dt;
      c.vy += Math.sin(this.time * 2.1 + c.id) * 24 * dt;
    } else {
      c.vy += 980 * dt;
      const obstacleCue = Math.abs(slope) > 0.62 || (Math.abs(dx) > 90 && this.rng.next() < 0.012 * c.genes.vision);
      if (c.grounded && (dy < -48 || obstacleCue)) c.vy = -this.rng.range(265, 405) * (c.kind === 'skitter' ? 1.18 : 1);
    }

    c.vx += ax * dt;
    c.vx += this.wind * (c.meta.flyer ? 1.45 : 0.18) * dt;
    c.vx *= Math.pow(c.grounded ? 0.16 : 0.62, dt);
    const maxSpeed = 300 * c.genes.speed * urgency;
    c.vx = clamp(c.vx, -maxSpeed, maxSpeed);
    c.x = clamp(c.x + c.vx * dt, c.r, WORLD_W - c.r);
    c.y += c.vy * dt;

    const floor = this.terrainY(c.x) - c.r * 0.66;
    if (c.y > floor) {
      c.y = floor;
      if (c.vy > 75) this.particle(c.x, c.y + c.r * 0.5, -c.vx * 0.08, -20, c.hue, 0.42);
      c.vy = 0;
      c.grounded = true;
    }
    if (c.meta.flyer) c.y = clamp(c.y, 145, this.terrainY(c.x) - 72);

    const climate = this.climateAt(c.x);
    const preferred = 22 + (c.genes.thermal - 1) * 7;
    c.bodyTemp += (climate.temperature - c.bodyTemp) * dt * (0.06 / Math.max(0.55, c.genes.thermal));
    const thermalCost = Math.abs(c.bodyTemp - preferred) * 0.00013 / c.genes.thermal;
    const movementCost = Math.abs(c.vx) / 280000 + Math.abs(c.vy) / 650000;
    const basal = 0.00145 * Math.pow(c.mass, 0.75) * c.genes.metabolism;
    c.energy -= dt * (basal + movementCost + thermalCost + c.stress * 0.0014);
    const evaporation = Math.max(0, climate.temperature - 8) * (1 - climate.moisture * 0.62) * 0.000018 / c.genes.hydration;
    c.water -= dt * (0.0009 + evaporation + movementCost * 0.24);
    c.stress = Math.max(0, c.stress - dt * 0.09);

    if (Math.abs(c.bodyTemp - preferred) > 16) c.health -= dt * 0.012;
    if (c.water < 0.12) c.health -= dt * 0.025;
    if (c.energy < 0.08) c.health -= dt * 0.015;

    this.consumeFlora(c);
    this.consumeCarcass(c, dt);
    this.attack(c);

    const reproductionThreshold = 0.84 + c.mass * 0.028;
    if (c.age > 10 && c.energy > reproductionThreshold && c.water > 0.42 && c.reproClock <= 0 && this.creatures.length < this.settings.maxPopulation) {
      const chance = dt * 0.018 * c.genes.fertility * (c.meta.predator ? 0.42 : 1) * (1 - c.stress * 0.7);
      if (this.rng.next() < chance) {
        const child = this.spawnCreature(c.kind, clamp(c.x + this.rng.range(-24, 24), 30, WORLD_W - 30), c);
        child.energy = 0.42;
        child.water = 0.68;
        c.energy -= 0.26;
        c.water -= 0.08;
        c.reproClock = 20 / Math.max(0.6, c.genes.fertility);
        this.births++;
      }
    }

    const lifespan = 220 / Math.max(0.7, c.genes.metabolism) * Math.max(0.7, 1.18 - c.mass * 0.05);
    if (c.energy <= 0 || c.water <= 0 || c.health <= 0 || c.age > lifespan) this.kill(c);
    else this.stepBody(c, dt);
  }

  kill(c) {
    if (c.dead) return;
    c.dead = true;
    this.deaths++;
    this.carcasses.push({ type: 'carcass', x: c.x, y: c.y, mass: 0.5 + c.mass * 0.9, hue: c.hue, age: 0, generation: c.generation });
    for (let i = 0; i < 14; i++) this.particle(c.x, c.y, this.rng.range(-90, 90), this.rng.range(-120, 40), c.hue, 1.15);
  }

  updateClimate(dt) {
    this.climateClock -= dt;
    if (this.climateClock > 0) return;
    const interval = this.performanceTier === 'low' ? 0.42 : this.performanceTier === 'medium' ? 0.28 : 0.2;
    this.climateClock = interval;
    const scaled = interval;
    const solar = 0.5 + 0.5 * Math.sin(this.time * 0.038 - 1.2);
    this.daylight = clamp(solar, 0, 1);
    const stormWave = Math.max(0, Math.sin(this.time * 0.021 * this.climateVolatility + Math.sin(this.time * 0.007) * 1.8));
    const rainTarget = Math.pow(stormWave, 7) * clamp(this.climateVolatility / 2.2, 0.2, 1.4);
    this.rain = lerp(this.rain, rainTarget, 0.025 + scaled * 0.06);
    this.wind = lerp(this.wind, Math.sin(this.time * 0.13) * (45 + this.climateVolatility * 18) + this.rain * 90, 0.012);
    let meanTemp = 0;

    for (let i = 0; i < this.climateCells; i++) {
      const x = (i + 0.5) / this.climateCells * WORLD_W;
      const altitude = WORLD_H - this.terrainY(x);
      let localHeat = 0;
      for (const field of this.fields) if (field.kind === 'sun') {
        const dx = field.x - x;
        localHeat += Math.exp(-(dx * dx) / (2 * 420 * 420)) * (1 - field.t / field.life) * 14;
      }
      const target = 15 + solar * 14 - altitude * 0.006 + Math.sin(i * 0.2 + this.time * 0.004) * 1.4 + localHeat;
      this.temperature[i] = lerp(this.temperature[i], target, 0.03 * scaled * 5);
      const rainInput = this.rain * scaled * (0.032 + 0.014 * Math.sin(i * 0.41 + this.time * 0.01));
      const evaporation = Math.max(0, this.temperature[i] - 6) * (0.0003 + solar * 0.00018) * scaled;
      const left = this.moisture[Math.max(0, i - 1)], right = this.moisture[Math.min(this.climateCells - 1, i + 1)];
      const diffusion = ((left + right) * 0.5 - this.moisture[i]) * 0.035 * scaled;
      this.moisture[i] = clamp(this.moisture[i] + rainInput - evaporation + diffusion, 0.025, 1);
      this.nutrients[i] = clamp(this.nutrients[i] + (0.00018 + this.moisture[i] * 0.00012) * scaled, 0.04, 1);
      meanTemp += this.temperature[i];
    }
    this.airTemperature = meanTemp / this.climateCells;
  }

  updateEcology(dt) {
    this.ecologyClock -= dt;
    if (this.ecologyClock > 0) return;
    const interval = this.performanceTier === 'low' ? 0.35 : 0.22;
    this.ecologyClock = interval;
    const light = 0.18 + this.daylight * 0.82;
    for (const f of this.flora) {
      const t = this.temperature[f.cell], m = this.moisture[f.cell], n = this.nutrients[f.cell];
      const tempFit = Math.exp(-((t - 23) ** 2) / 150);
      const waterFit = clamp((m - 0.05) / 0.55, 0, 1);
      const carrying = Math.max(0, 1 - f.biomass / f.maxBiomass);
      const growth = interval * 0.026 * light * tempFit * waterFit * (0.25 + n * 0.75) * carrying;
      f.biomass = clamp(f.biomass + growth, 0, f.maxBiomass);
      this.nutrients[f.cell] = clamp(this.nutrients[f.cell] - growth * 0.035, 0.04, 1);
      f.y = this.terrainY(f.x) - 5;
    }
    for (const carcass of this.carcasses) {
      carcass.age += interval;
      const cell = this.cellIndex(carcass.x);
      const decomposition = Math.min(carcass.mass, interval * (0.006 + this.moisture[cell] * 0.012));
      carcass.mass -= decomposition;
      this.nutrients[cell] = clamp(this.nutrients[cell] + decomposition * 0.09, 0.04, 1);
    }
    this.carcasses = this.carcasses.filter(c => c.mass > 0.02 && c.age < 160);
    if (this.flora.length < 250 && this.rng.next() < interval * 0.08) this.addFlora(this.rng.range(60, WORLD_W - 60), false);
  }

  applyFields(dt) {
    for (const field of this.fields) {
      field.t += dt;
      if (field.kind === 'pull') for (const c of this.creatures) if (!c.dead) {
        const dx = field.x - c.x, dy = field.y - c.y, d = Math.hypot(dx, dy) || 1;
        if (d < 560) {
          const force = (1 - d / 560) * 820;
          c.vx += dx / d * force * dt;
          c.vy += dy / d * force * dt;
        }
      }
      if (field.kind === 'sun') for (const c of this.creatures) if (!c.dead) {
        const d = Math.abs(field.x - c.x);
        if (d < 430) c.bodyTemp += (1 - d / 430) * 4.5 * dt;
      }
    }
    this.fields = this.fields.filter(f => f.t < f.life);
  }

  applyPower(kind, x, y) {
    if (kind === 'bloom') {
      const center = this.cellIndex(x);
      for (let i = Math.max(0, center - 5); i <= Math.min(this.climateCells - 1, center + 5); i++) {
        const falloff = 1 - Math.abs(i - center) / 6;
        this.moisture[i] = clamp(this.moisture[i] + 0.16 * falloff, 0, 1);
        this.nutrients[i] = clamp(this.nutrients[i] + 0.12 * falloff, 0, 1);
      }
      for (let i = 0; i < 16; i++) this.addFlora(clamp(x + this.rng.range(-210, 210), 30, WORLD_W - 30), false);
      for (const c of this.creatures) if (!c.dead && Math.hypot(c.x - x, c.y - y) < 280) {
        c.energy = Math.min(1, c.energy + 0.18);
        c.water = Math.min(1, c.water + 0.24);
        c.health = Math.min(1, c.health + 0.10);
      }
    } else if (kind === 'pull') {
      this.fields.push({ kind, x, y, t: 0, life: 2.1 });
    } else if (kind === 'storm') {
      const center = this.cellIndex(x);
      for (let i = Math.max(0, center - 7); i <= Math.min(this.climateCells - 1, center + 7); i++) this.moisture[i] = clamp(this.moisture[i] + 0.12, 0, 1);
      for (const c of this.creatures) if (!c.dead) {
        const dx = c.x - x, dy = c.y - y, d = Math.hypot(dx, dy) || 1;
        if (d < 390) {
          const force = (1 - d / 390) * 540;
          c.vx += dx / d * force;
          c.vy += dy / d * force - 125;
          c.stress = Math.min(1, c.stress + 0.28);
        }
      }
      for (let i = 0; i < 58; i++) this.particle(x, y, this.rng.range(-260, 260), this.rng.range(-350, 80), 208, 1.12);
    } else if (kind === 'mutate') {
      let changed = 0;
      for (const c of this.creatures) if (!c.dead && Math.hypot(c.x - x, c.y - y) < 310) {
        c.mutate(1.15);
        changed++;
        for (let i = 0; i < 7; i++) this.particle(c.x, c.y, this.rng.range(-75, 75), this.rng.range(-110, 15), c.hue, 0.9);
      }
      if (!changed && this.creatures.length < this.settings.maxPopulation) this.spawnCreature(this.rng.pick(Object.keys(SPECIES)), x);
    } else if (kind === 'sun') {
      this.fields.push({ kind, x, y, t: 0, life: 4.2 });
    }
    this.effects.push({ kind, x, y, t: 0, life: kind === 'sun' ? 2.4 : kind === 'pull' ? 1.9 : 1.25 });
  }

  step(dt) {
    this.time += dt;
    this.updateClimate(dt);
    this.updateEcology(dt);
    this.applyFields(dt);
    this.rebuildHashes();
    const snapshot = [...this.creatures];
    for (const c of snapshot) if (!c.dead) this.stepCreature(c, dt);
    this.creatures = this.creatures.filter(c => !c.dead);

    for (const p of this.particles) {
      p.life -= dt;
      p.vy += 340 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(0.25, dt);
    }
    this.particles = this.particles.filter(p => p.life > 0);
    for (const e of this.effects) e.t += dt;
    this.effects = this.effects.filter(e => e.t < e.life);

    const minimum = Math.max(28, Math.round(this.settings.population * 0.64));
    if (this.creatures.length < minimum && this.rng.next() < dt * 0.34) this.spawnCreature(this.rng.pick(Object.keys(SPECIES)));
  }

  stats() {
    const alive = this.creatures.filter(c => !c.dead);
    const species = new Set(alive.map(c => c.kind));
    let biomass = 0, moisture = 0, temp = 0, maxGeneration = 1;
    for (const f of this.flora) biomass += f.biomass;
    for (let i = 0; i < this.climateCells; i++) { moisture += this.moisture[i]; temp += this.temperature[i]; }
    const geneKeys = Object.keys(GENE_LIMITS);
    let diversity = 0;
    if (alive.length > 1) {
      for (const key of geneKeys) {
        let mean = 0;
        for (const c of alive) mean += c.genes[key];
        mean /= alive.length;
        let variance = 0;
        for (const c of alive) variance += (c.genes[key] - mean) ** 2;
        diversity += Math.sqrt(variance / alive.length);
      }
      diversity /= geneKeys.length;
    }
    for (const c of alive) maxGeneration = Math.max(maxGeneration, c.generation);
    return {
      population: alive.length,
      species: species.size,
      biomass,
      meanMoisture: moisture / this.climateCells,
      meanTemperature: temp / this.climateCells,
      diversity,
      maxGeneration,
      births: this.births,
      deaths: this.deaths,
      rain: this.rain,
      wind: this.wind,
      daylight: this.daylight,
      particles: this.particles.length,
      climateCells: this.climateCells
    };
  }
}
