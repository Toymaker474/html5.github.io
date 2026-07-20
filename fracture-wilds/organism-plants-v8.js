import { MAP_W, TILE, clamp, lerp, PLANT_SPECIES } from './organism-core-v8.js';

let NEXT_PLANT_ID = 1;

export class SoilSystem {
  constructor(world) {
    this.world = world;
    this.moisture = new Float32Array(MAP_W);
    this.nutrients = new Float32Array(MAP_W);
    this.organic = new Float32Array(MAP_W);
    this.temperature = new Float32Array(MAP_W);
    for (let x = 0; x < MAP_W; x++) {
      const b = world.map.biomeAt(x * TILE);
      this.moisture[x] = clamp(b.moisture + world.rng.range(-0.12, 0.12), 0.08, 1);
      this.nutrients[x] = clamp(b.fertility * world.rng.range(0.65, 1.1), 0.15, 1.4);
      this.organic[x] = world.rng.range(0.08, 0.35);
      this.temperature[x] = b.temperature;
    }
  }
  sample(px) {
    const x = clamp(Math.floor(px / TILE), 0, MAP_W - 1);
    return { x, moisture: this.moisture[x], nutrients: this.nutrients[x], organic: this.organic[x], temperature: this.temperature[x] };
  }
  addOrganic(px, amount) {
    const x = clamp(Math.floor(px / TILE), 0, MAP_W - 1);
    this.organic[x] = clamp(this.organic[x] + amount, 0, 2);
    this.nutrients[x] = clamp(this.nutrients[x] + amount * 0.18, 0, 1.5);
  }
  update(dt) {
    const world = this.world;
    const rain = world.rainPhase === 'rain' ? world.rainIntensity : 0;
    const daylight = world.daylight;
    for (let x = 0; x < MAP_W; x++) {
      const biome = world.map.biomeAt(x * TILE);
      const drainage = 0.003 + (1 - biome.moisture) * 0.004;
      const evaporation = (0.001 + daylight * 0.0028) * (0.5 + biome.temperature);
      this.moisture[x] = clamp(this.moisture[x] + rain * dt * 0.055 - dt * (drainage + evaporation), 0.04, 1.2);
      const mineralized = Math.min(this.organic[x], dt * (0.002 + biome.temperature * 0.004));
      this.organic[x] -= mineralized;
      this.nutrients[x] = clamp(this.nutrients[x] + mineralized * 0.8 - dt * 0.00015, 0.08, 1.5);
      this.temperature[x] = lerp(this.temperature[x], clamp(biome.temperature + (daylight - 0.5) * 0.12, 0.05, 0.95), 0.008);
    }
  }
}

export class Plant {
  constructor(world, species, x, y, parent = null) {
    this.id = NEXT_PLANT_ID++;
    this.species = species;
    this.x = x; this.y = y;
    this.age = parent ? 0 : world.rng.range(20, 180);
    this.biomass = parent ? 0.06 : world.rng.range(0.15, species.maxBiomass);
    this.energy = world.rng.range(0.2, 0.8);
    this.water = world.rng.range(0.35, 0.9);
    this.health = 1;
    this.fruit = parent ? 0 : world.rng.range(0, species.fruit * 2.5);
    this.seedCooldown = world.rng.range(8, 40);
    this.phase = world.rng.range(0, Math.PI * 2);
    this.lean = world.rng.range(-0.18, 0.18);
    this.rootDepth = parent ? 0.12 : world.rng.range(0.35, 1);
    this.genome = parent ? {
      growth: clamp(parent.genome.growth + world.rng.range(-0.08, 0.08), 0.7, 1.3),
      drought: clamp(parent.genome.drought + world.rng.range(-0.08, 0.08), 0.6, 1.4),
      shade: clamp(parent.genome.shade + world.rng.range(-0.08, 0.08), 0.6, 1.4),
      defense: clamp(parent.genome.defense + world.rng.range(-0.08, 0.08), 0.5, 1.5)
    } : { growth: world.rng.range(0.85, 1.15), drought: world.rng.range(0.8, 1.2), shade: world.rng.range(0.8, 1.2), defense: world.rng.range(0.75, 1.25) };
    this.alive = true;
    this.lastNibble = -999;
  }
  get maturity() { return clamp(this.age / 75, 0, 1); }
  get height() { return this.species.height * clamp(this.biomass / this.species.maxBiomass, 0.18, 1.15); }
}

export class PlantSystem {
  constructor(world, tier = 'medium') {
    this.world = world;
    this.soil = new SoilSystem(world);
    this.plants = [];
    this.seedQueue = [];
    this.cursor = 0;
    this.cap = tier === 'low' ? 180 : tier === 'medium' ? 280 : tier === 'high' ? 390 : 520;
    this.spawnInitial();
  }
  setTier(tier) { this.cap = tier === 'low' ? 180 : tier === 'medium' ? 280 : tier === 'high' ? 390 : 520; }
  speciesForBiome(biomeIndex) {
    const tables = [
      ['fanfern','lumenpod','orbloom'], ['bonebriar','orbloom','shiverlichen'], ['glassreed','fanfern','lumenpod'], ['veilcap','bonebriar','lumenpod'],
      ['veilcap','fanfern','lumenpod'], ['skyfrond','orbloom','shiverlichen'], ['shiverlichen','bonebriar','veilcap'], ['glassreed','fanfern','lumenpod']
    ];
    const id = this.world.rng.pick(tables[biomeIndex] || tables[0]);
    return PLANT_SPECIES.find(s => s.id === id) || PLANT_SPECIES[0];
  }
  spawnInitial() {
    const target = Math.floor(this.cap * 0.78);
    let attempts = 0;
    while (this.plants.length < target && attempts++ < target * 12) {
      const tx = this.world.rng.int(3, this.world.map.width - 4);
      const floor = this.world.map.findFloor(tx);
      if (floor < 5 || floor >= this.world.map.height - 1) continue;
      const px = (tx + this.world.rng.next()) * TILE;
      const species = this.speciesForBiome(this.world.map.roomAt(px));
      const soil = this.soil.sample(px);
      if (soil.moisture + this.world.rng.range(-0.25, 0.25) < species.moisture * 0.55) continue;
      this.plants.push(new Plant(this.world, species, px, floor * TILE - 2));
    }
  }
  nearby(x, y, radius, edibleOnly = false) {
    const rr = radius * radius;
    const out = [];
    for (const p of this.plants) if (p.alive && (!edibleOnly || p.species.edible > 0.15) && (p.x - x) ** 2 + (p.y - y) ** 2 <= rr) out.push(p);
    return out;
  }
  nearest(x, y, radius, predicate = () => true) {
    let best = null, bd = radius * radius;
    for (const p of this.plants) if (p.alive && predicate(p)) {
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  nibble(plant, amount, creature = null) {
    if (!plant?.alive || plant.biomass <= 0.02) return 0;
    const defense = plant.genome.defense * (1 + plant.species.toxin);
    const taken = Math.min(plant.biomass, amount / defense);
    plant.biomass -= taken;
    plant.health = clamp(plant.health - taken * 0.05, 0, 1);
    plant.lastNibble = this.world.time;
    if (plant.biomass <= 0.035) {
      plant.alive = false;
      this.soil.addOrganic(plant.x, 0.05 + taken * 0.12);
    }
    if (creature && plant.fruit > 0.02) {
      const fruitTaken = Math.min(plant.fruit, amount * 0.65);
      plant.fruit -= fruitTaken;
      if (creature.isPlayer && fruitTaken > 0.04) creature.food = Math.min(12, creature.food + 1);
      creature.carriedSeeds = Math.min(6, (creature.carriedSeeds || 0) + (fruitTaken > 0.03 ? 1 : 0));
      return taken * plant.species.edible + fruitTaken * 0.9;
    }
    return taken * plant.species.edible;
  }
  queueSeed(parent, x, y) {
    if (this.plants.length + this.seedQueue.length >= this.cap) return;
    this.seedQueue.push({ parent, x, y });
  }
  updatePlant(p, dt) {
    const world = this.world, soil = this.soil.sample(p.x), s = p.species;
    p.age += dt;
    p.seedCooldown -= dt;
    const light = world.lightAt(p.x, p.y);
    const waterSuit = clamp(1 - Math.abs(soil.moisture - s.moisture) * 1.55 * (1 / p.genome.drought), 0, 1);
    const lightSuit = clamp(1 - Math.abs(light - s.light) * 1.35 * (1 / p.genome.shade), 0, 1);
    const tempSuit = clamp(1 - Math.abs(soil.temperature - s.temp) * 2.2, 0, 1);
    const nutrientSuit = clamp(soil.nutrients / 0.72, 0, 1.2);
    const photosynthesis = s.growth * p.genome.growth * lightSuit * waterSuit * tempSuit * nutrientSuit;
    const respiration = 0.0025 + p.biomass * 0.0015;
    p.energy = clamp(p.energy + dt * (photosynthesis - respiration), 0, 1.4);
    p.water = clamp(lerp(p.water, soil.moisture, dt * 0.08) - dt * (0.001 + light * 0.0015), 0, 1);
    if (p.energy > 0.18 && p.biomass < s.maxBiomass) {
      const gain = Math.min(p.energy * 0.022 * dt, s.maxBiomass - p.biomass);
      p.biomass += gain; p.energy -= gain * 0.9;
      this.soil.nutrients[soil.x] = clamp(this.soil.nutrients[soil.x] - gain * 0.015, 0.06, 1.5);
      this.soil.moisture[soil.x] = clamp(this.soil.moisture[soil.x] - gain * 0.008, 0.03, 1.2);
      p.rootDepth = clamp(p.rootDepth + gain * 0.04, 0.1, 1.2);
    }
    if (p.maturity > 0.72 && p.energy > 0.62) {
      p.fruit = clamp(p.fruit + dt * s.fruit * photosynthesis * 0.11, 0, 1.3);
      if (p.seedCooldown <= 0 && world.rng.chance(dt * 0.16 * Math.max(0.15, photosynthesis))) {
        const wind = world.windAt(p.x);
        const range = s.seedRange * world.rng.range(0.25, 1) * (0.65 + Math.abs(wind));
        const sx = clamp(p.x + wind * range + world.rng.signed() * range * 0.45, TILE * 2, world.width - TILE * 2);
        const tx = Math.floor(sx / TILE), floor = world.map.findFloor(tx);
        this.queueSeed(p, sx, floor * TILE - 2);
        p.seedCooldown = world.rng.range(20, 65);
        p.energy -= 0.12;
      }
    }
    const drought = Math.max(0, s.moisture * 0.45 - soil.moisture) / Math.max(0.45, p.genome.drought);
    const cold = Math.max(0, 0.17 - soil.temperature);
    p.health -= dt * (drought * 0.018 + cold * 0.006);
    if (p.health <= 0 || p.age > 540 + s.maxBiomass * 160) {
      p.alive = false;
      this.soil.addOrganic(p.x, 0.08 + p.biomass * 0.35);
    }
  }
  update(dt) {
    this.soil.update(dt);
    if (!this.plants.length) return;
    const budget = Math.max(24, Math.ceil(this.plants.length / 12));
    const scaled = dt * this.plants.length / budget;
    for (let i = 0; i < budget; i++) {
      const p = this.plants[this.cursor++ % this.plants.length];
      if (p?.alive) this.updatePlant(p, scaled);
    }
    if (this.seedQueue.length) {
      const batch = this.seedQueue.splice(0, Math.min(4, this.seedQueue.length));
      for (const seed of batch) {
        const soil = this.soil.sample(seed.x);
        if (soil.moisture < 0.05 || this.world.map.get(Math.floor(seed.x / TILE), Math.floor(seed.y / TILE)) === 1) continue;
        const crowded = this.nearby(seed.x, seed.y, 34).length;
        if (crowded < 3 && this.world.rng.chance(0.76 / (1 + crowded))) this.plants.push(new Plant(this.world, seed.parent.species, seed.x, seed.y, seed.parent));
      }
    }
    if (this.world.time % 8 < dt) this.plants = this.plants.filter(p => p.alive || this.world.time - p.lastNibble < 4);
  }
  totalBiomass() { let sum = 0; for (const p of this.plants) if (p.alive) sum += p.biomass; return sum; }
  livingCount() { let n = 0; for (const p of this.plants) if (p.alive) n++; return n; }
  meanMoisture() { let sum = 0; for (const v of this.soil.moisture) sum += v; return sum / this.soil.moisture.length; }
}
