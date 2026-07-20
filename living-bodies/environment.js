import { WORLD_W, WORLD_H, TAU, clamp, lerp, SPECIES, ClimateCell, Plant, Creature } from './core.js?v=9';

export const environmentMethods = {
  terrainY(x) {
    const f = clamp(x / WORLD_W, 0, 1) * (this.heights.length - 1), i = Math.floor(f), t = f - i;
    return lerp(this.heights[i], this.heights[Math.min(this.heights.length - 1, i + 1)], t);
  },

  terrainSlope(x) {
    const d = 10;
    return (this.terrainY(x + d) - this.terrainY(x - d)) / (d * 2);
  },

  climateAt(x) {
    const i = clamp(Math.floor(clamp(x / WORLD_W, 0, 0.9999) * this.climate.length), 0, this.climate.length - 1);
    return this.climate[i];
  },

  generateTerrain() {
    let y = 1250;
    for (let i = 0; i < this.heights.length; i++) {
      const t = i / (this.heights.length - 1);
      y += this.rng.range(-35, 35);
      const ridge = Math.sin(t * TAU * 2.7) * 125 + Math.sin(t * TAU * 9.3) * 44 + Math.sin(t * TAU * 21) * 14;
      this.heights[i] = clamp(y * 0.9 + ridge, 760, 1510);
    }
    for (let pass = 0; pass < 4; pass++) for (let i = 1; i < this.heights.length - 1; i++) this.heights[i] = (this.heights[i - 1] + this.heights[i] * 2 + this.heights[i + 1]) / 4;
  },

  generateClimate() {
    const count = this.settings.science === 'deep' ? 144 : 96;
    for (let i = 0; i < count; i++) {
      const x = (i + 0.5) / count * WORLD_W;
      this.climate.push(new ClimateCell(this.rng, x, this.terrainY(x)));
    }
  },

  seedPlants() {
    const count = this.settings.plants === 'deep' ? 165 : 105;
    for (let i = 0; i < count; i++) this.plants.push(new Plant(this, this.rng.range(50, WORLD_W - 50)));
  },

  seedLife() {
    const total = clamp(this.settings.population | 0, 30, this.maxPopulation);
    const weighted = ['grazer','grazer','grazer','grazer','grazer','skitter','skitter','skitter','crawler','crawler','glider','glider','hunter','maw','mimic'];
    for (let i = 0; i < total; i++) {
      const kind = this.rng.pick(weighted), x = this.rng.range(100, WORLD_W - 100);
      const y = SPECIES[kind].flyer ? this.rng.range(300, this.terrainY(x) - 160) : this.terrainY(x) - SPECIES[kind].baseSize;
      this.creatures.push(new Creature(this, kind, x, y));
    }
  },

  updateClimate(dt) {
    this.weatherClock += dt;
    this.day = (this.time / 180) % 1;
    this.daylight = clamp(Math.sin(this.day * TAU - Math.PI / 2) * 0.52 + 0.52, 0.03, 1);
    const volatility = this.settings.climate / 10;
    const storm = Math.max(0, Math.sin(this.time * (0.018 + volatility * 0.006) + this.seed * 0.001) - 0.56) / 0.44;
    this.rain = lerp(this.rain, storm * (0.25 + volatility * 0.75), 0.012);
    this.wind = lerp(this.wind, Math.sin(this.time * 0.07) * (35 + volatility * 85) + storm * 70, 0.01);
    this.temperature = 10 + this.daylight * 18 + Math.sin(this.time * 0.006) * 5;
    const n = this.climate.length;
    const temp = new Float32Array(n), moisture = new Float32Array(n), nutrients = new Float32Array(n), toxin = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const c = this.climate[i], l = this.climate[(i + n - 1) % n], r = this.climate[(i + 1) % n];
      const localSun = this.daylight * (1 - c.moisture * 0.12);
      c.light = lerp(c.light, localSun, 0.05);
      c.rain = lerp(c.rain, this.rain * (0.65 + 0.35 * Math.sin(i * 0.43 + this.time * 0.03)), 0.03);
      c.wind = lerp(c.wind, this.wind + Math.sin(i * 0.31) * 25, 0.03);
      temp[i] = c.temperature + (this.temperature - c.temperature) * dt * 0.09 + (l.temperature + r.temperature - 2 * c.temperature) * dt * 0.06;
      moisture[i] = c.moisture + c.rain * dt * 0.045 - localSun * dt * 0.004 + (l.moisture + r.moisture - 2 * c.moisture) * dt * 0.08;
      nutrients[i] = c.nutrients + (l.nutrients + r.nutrients - 2 * c.nutrients) * dt * 0.025;
      toxin[i] = c.toxin * (1 - dt * 0.0015) + (l.toxin + r.toxin - 2 * c.toxin) * dt * 0.018;
    }
    for (let i = 0; i < n; i++) {
      const c = this.climate[i]; c.temperature = clamp(temp[i], -12, 56); c.moisture = clamp(moisture[i], 0.02, 1); c.nutrients = clamp(nutrients[i], 0.02, 1.4); c.toxin = clamp(toxin[i], 0, 1);
      c.oxygen = clamp(c.oxygen + dt * (0.0003 + this.daylight * 0.0004) - c.toxin * dt * 0.0006, 0.35, 1);
    }
  },

  updatePlant(p, dt) {
    p.age += dt;
    const c = this.climateAt(p.x), light = c.light, waterGain = Math.min(c.moisture, 0.8) * dt * 0.018;
    p.water = clamp(p.water + waterGain - dt * (0.001 + light * 0.0015), 0, 1);
    const nutrientGain = Math.min(c.nutrients, 0.8) * dt * 0.006;
    p.nutrients = clamp(p.nutrients + nutrientGain, 0, 1);
    c.nutrients = clamp(c.nutrients - nutrientGain * 0.15, 0.02, 1.4);
    const photo = light * p.water * p.nutrients * dt * 0.006;
    p.sugar = clamp(p.sugar + photo - dt * (0.0008 + p.height * 0.000006), 0, 1.2);
    const tempStress = Math.max(0, Math.abs(c.temperature - 22) - 16) / 20;
    p.health = clamp(p.health + dt * 0.0008 * p.sugar - dt * tempStress * 0.004 - c.toxin * dt * 0.003, 0, 1);
    p.seedClock -= dt;
    if (p.seedClock <= 0 && p.sugar > 0.72 && p.health > 0.65 && this.plants.length < 230) {
      const nx = clamp(p.x + this.rng.range(-p.rootReach * 2.2, p.rootReach * 2.2), 30, WORLD_W - 30);
      this.plants.push(new Plant(this, nx, p)); p.sugar -= 0.2; p.seedClock = this.rng.range(45, 110);
    }
    if (p.health <= 0 || p.age > 700) {
      p.dead = true; c.nutrients = clamp(c.nutrients + 0.16, 0, 1.4); c.moisture = clamp(c.moisture + 0.03, 0, 1);
    }
  },

  updateCarcasses(dt) {
    for (const c of this.carcasses) {
      c.age += dt; const cell = this.climateAt(c.x), decay = dt * (0.0012 + Math.max(0, cell.temperature) * 0.00004 + cell.moisture * 0.0014);
      c.mass = Math.max(0, c.mass - decay); cell.nutrients = clamp(cell.nutrients + decay * 0.018, 0, 1.4); cell.toxin = clamp(cell.toxin + c.toxin * decay * 0.002, 0, 1);
    }
    this.carcasses = this.carcasses.filter(c => c.mass > 0.02 && c.age < 260);
  },

  effect(kind, x, y, hue = 180, life = 1) {
    this.effects.push({ kind, x, y, hue, t: 0, life });
    const count = kind === 'storm' ? 45 : 14;
    for (let i = 0; i < count; i++) {
      if (this.particles.length > 520) this.particles.shift();
      this.particles.push({ x, y, vx: this.rng.range(-150, 150), vy: this.rng.range(-220, 45), hue, life: this.rng.range(0.5, 1.3), max: 1.3, size: this.rng.range(1.5, 4.5) });
    }
  },

  applyPower(kind, x, y) {
    if (kind === 'bloom') {
      const cell = this.climateAt(x); cell.moisture = clamp(cell.moisture + 0.35, 0, 1); cell.nutrients = clamp(cell.nutrients + 0.3, 0, 1.4);
      for (let i = 0; i < 8 && this.plants.length < 230; i++) this.plants.push(new Plant(this, clamp(x + this.rng.range(-220, 220), 30, WORLD_W - 30)));
      this.effect(kind, x, y, 145, 1.2);
    }
    if (kind === 'pull') { this.forceFields.push({ x, y, radius: 520, strength: 900, life: 2, t: 0 }); this.effect(kind, x, y, 275, 1.8); }
    if (kind === 'storm') {
      const cell = this.climateAt(x); cell.moisture = clamp(cell.moisture + 0.45, 0, 1);
      for (const c of this.creatureHash.query(x, y, 420)) { const dx = c.x - x, dy = c.y - y, d = Math.hypot(dx, dy) || 1; if (d < 420) { const f = (1 - d / 420) * 500; c.vx += dx / d * f; c.vy += dy / d * f - 120; if (f > 300) this.damagePoint(c, this.rng.pick(c.points), 0.05 + f / 5000, 0.18); } }
      this.effect(kind, x, y, 205, 1.2);
    }
    if (kind === 'mutate') {
      let changed = 0; for (const c of this.creatureHash.query(x, y, 320)) if (Math.hypot(c.x - x, c.y - y) < 320) { c.mutate(1); changed++; }
      if (!changed && this.creatures.length < this.maxPopulation) { const k = this.rng.pick(Object.keys(SPECIES)); this.creatures.push(new Creature(this, k, x, SPECIES[k].flyer ? y : this.terrainY(x) - 30)); }
      this.effect(kind, x, y, 320, 1.35);
    }
    if (kind === 'sun') { const cell = this.climateAt(x); cell.temperature = clamp(cell.temperature + 13, -12, 56); cell.light = 1; cell.moisture = clamp(cell.moisture - 0.12, 0, 1); this.effect(kind, x, y, 42, 1.5); }
    if (kind === 'quake') {
      for (const c of this.creatureHash.query(x, y, 500)) { const d = Math.hypot(c.x - x, c.y - y); if (d < 500) { c.vy -= (1 - d / 500) * 220; c.vx += this.rng.range(-130, 130); if (d < 260) this.damagePoint(c, this.rng.pick(c.points), 0.06, 0.3); } }
      this.effect(kind, x, y, 18, 1.4);
    }
  }

};
