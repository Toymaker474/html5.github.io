import { WORLD_W, SPECIES, RNG, SpatialHash, Creature, clamp } from './core.js?v=9';
import { environmentMethods } from './environment.js?v=9';
import { anatomyMethods } from './anatomy.js?v=9';
import { behaviorMethods } from './behavior.js?v=9';

export { TAU, WORLD_W, WORLD_H, clamp, lerp, SPECIES, Creature } from './core.js?v=9';

const DEFAULTS = {
  device: 'auto', graphics: 'auto', science: 'deep', population: 78,
  maxPopulation: 132, evolution: 5, climate: 5, anatomy: 'full',
  plants: 'deep', creepy: 6, injury: 6
};

export class World {
  constructor(seed = (Date.now() ^ 0x9e3779b9) >>> 0, settings = {}) {
    this.settings = { ...DEFAULTS, ...settings };
    this.seed = seed >>> 0;
    this.rng = new RNG(this.seed);
    this.nextCreatureId = 1;
    this.nextPlantId = 1;
    this.time = 0;
    this.day = 0;
    this.daylight = 0.5;
    this.weatherClock = 0;
    this.wind = 0;
    this.rain = 0;
    this.temperature = 19;
    this.mutationRate = 0.012 + this.settings.evolution * 0.008;
    this.maxPopulation = this.settings.maxPopulation || (this.settings.device === 'ipad' ? 180 : 132);
    this.creatures = [];
    this.plants = [];
    this.carcasses = [];
    this.effects = [];
    this.particles = [];
    this.forceFields = [];
    this.births = 0;
    this.deaths = 0;
    this.injuries = 0;
    this.healedInjuries = 0;
    this.observedId = null;
    this.creatureHash = new SpatialHash(260);
    this.plantHash = new SpatialHash(300);
    this.heights = new Float32Array(320);
    this.climate = [];
    this.generateTerrain();
    this.generateClimate();
    this.seedPlants();
    this.seedLife();
  }

  inspectAt(x, y, radius = 90) {
    let best = null, bd = radius * radius;
    for (const c of this.creatureHash.query(x, y, radius)) {
      const d = (c.x - x) ** 2 + (c.y - y) ** 2;
      if (d < bd) { bd = d; best = c; }
    }
    this.observedId = best?.id ?? null;
    return best;
  }

  step(dt) {
    this.time += dt;
    this.updateClimate(dt);
    this.rebuildHashes();
    for (const f of this.forceFields) f.t += dt;
    this.forceFields = this.forceFields.filter(f => f.t < f.life);
    const plantStride = this.settings.device === 'iphone' ? 3 : 2;
    const plantPhase = Math.floor(this.time * 30) % plantStride;
    for (let i = plantPhase; i < this.plants.length; i += plantStride) if (!this.plants[i].dead) this.updatePlant(this.plants[i], dt * plantStride);
    const snapshot = [...this.creatures];
    for (const c of snapshot) this.updateCreature(c, dt);
    this.creatures = this.creatures.filter(c => !c.dead);
    this.plants = this.plants.filter(p => !p.dead);
    this.updateCarcasses(dt);
    for (const e of this.effects) e.t += dt;
    this.effects = this.effects.filter(e => e.t < e.life);
    for (const p of this.particles) { p.life -= dt; p.vy += 380 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.pow(0.18, dt); }
    this.particles = this.particles.filter(p => p.life > 0);
    if (this.creatures.length < Math.min(42, this.maxPopulation * 0.4) && this.rng.chance(dt * 0.16)) {
      const k = this.rng.pick(Object.keys(SPECIES)), x = this.rng.range(100, WORLD_W - 100);
      this.creatures.push(new Creature(this, k, x, SPECIES[k].flyer ? this.rng.range(250, 800) : this.terrainY(x) - 30));
    }
  }

  stats() {
    const species = new Set(this.creatures.map(c => c.kind));
    const mean = (arr, fn) => arr.length ? arr.reduce((s, x) => s + fn(x), 0) / arr.length : 0;
    const injured = this.creatures.filter(c => c.pain > 0.12 || c.points.some(p => p.fracture > 0.08 || p.health < 0.82)).length;
    const generations = this.creatures.map(c => c.generation);
    const biomass = this.plants.reduce((s, p) => s + p.sugar * p.height * 0.02, 0);
    const climateTemp = mean(this.climate, c => c.temperature), climateMoisture = mean(this.climate, c => c.moisture);
    const counts = {}; for (const c of this.creatures) counts[c.kind] = (counts[c.kind] || 0) + 1;
    return {
      population: this.creatures.length, species: species.size, plants: this.plants.length,
      carcasses: this.carcasses.length, injured, births: this.births, deaths: this.deaths,
      generation: generations.length ? Math.max(...generations) : 0,
      meanEnergy: mean(this.creatures, c => c.energy),
      meanHydration: mean(this.creatures, c => c.hydration),
      meanPain: mean(this.creatures, c => c.pain),
      meanTemperature: climateTemp, meanMoisture: climateMoisture, biomass,
      diversity: species.size ? species.size / Object.keys(SPECIES).length : 0, counts
    };
  }
}

Object.assign(World.prototype, environmentMethods, anatomyMethods, behaviorMethods);
