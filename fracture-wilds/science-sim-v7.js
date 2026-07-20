export const TILE = 32;
export const MAP_W = 192;
export const MAP_H = 58;
export const WORLD_W = MAP_W * TILE;
export const WORLD_H = MAP_H * TILE;
export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const sign = v => (v < 0 ? -1 : v > 0 ? 1 : 0);
export const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

export class RNG {
  constructor(seed = (Date.now() ^ 0x9e3779b9) >>> 0) { this.s = seed >>> 0 || 1; }
  next() { let x = this.s; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.s = x >>> 0; return this.s / 4294967296; }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  chance(p) { return this.next() < p; }
}

function hash2(x, y, s) {
  let n = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function smoothNoise(x, y, s) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const tx = x - x0, ty = y - y0;
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const a = hash2(x0, y0, s), b = hash2(x0 + 1, y0, s);
  const c = hash2(x0, y0 + 1, s), d = hash2(x0 + 1, y0 + 1, s);
  return lerp(lerp(a, b, sx), lerp(c, d, sx), sy);
}

export const ROLE = {
  nibbler: { name: 'Lumen Grazer', hue: 158, trophic: 1, predator: false, scavenger: false, flyer: false, fear: 1.0, speed: 0.94, social: 0.75 },
  skitter: { name: 'Prism Skitter', hue: 52, trophic: 1, predator: false, scavenger: false, flyer: false, fear: 1.35, speed: 1.22, social: 0.35 },
  carrion: { name: 'Mire Recycler', hue: 284, trophic: 2, predator: false, scavenger: true, flyer: false, fear: 0.72, speed: 0.87, social: 0.22 },
  hunter: { name: 'Rift Prowler', hue: 348, trophic: 3, predator: true, scavenger: false, flyer: false, fear: 0.12, speed: 1.08, social: 0.18 },
  glider: { name: 'Aether Ray', hue: 202, trophic: 1, predator: false, scavenger: false, flyer: true, fear: 0.76, speed: 1.02, social: 0.58 },
  lurker: { name: 'Veil Ambusher', hue: 316, trophic: 3, predator: true, scavenger: false, flyer: false, fear: 0.04, speed: 0.80, social: 0.08 }
};

export const BIOMES = [
  { name: 'Luminous Drain', hue: 174, temperature: 0.53, oxygen: 0.72, toxin: 0.08, gravity: 1.0, food: 1.15 },
  { name: 'Bone Orchard', hue: 46, temperature: 0.66, oxygen: 0.62, toxin: 0.12, gravity: 1.02, food: 0.92 },
  { name: 'Glass Marsh', hue: 196, temperature: 0.48, oxygen: 0.84, toxin: 0.18, gravity: 0.94, food: 1.28 },
  { name: 'Veil Causeway', hue: 288, temperature: 0.42, oxygen: 0.58, toxin: 0.34, gravity: 1.08, food: 0.72 },
  { name: 'Fungal Vault', hue: 132, temperature: 0.57, oxygen: 0.68, toxin: 0.22, gravity: 1.0, food: 1.42 },
  { name: 'Sky Maw', hue: 224, temperature: 0.31, oxygen: 0.52, toxin: 0.06, gravity: 0.77, food: 0.66 },
  { name: 'Shiverworks', hue: 332, temperature: 0.22, oxygen: 0.46, toxin: 0.27, gravity: 1.14, food: 0.58 },
  { name: 'Abyssal Nursery', hue: 164, temperature: 0.45, oxygen: 0.78, toxin: 0.10, gravity: 0.88, food: 1.30 }
];

const TRAITS = [
  'segments', 'legs', 'fins', 'horns', 'eyes', 'tail', 'muscle', 'agility', 'armor',
  'metabolism', 'sensor', 'toxinResist', 'coldResist', 'curiosity', 'aggression',
  'social', 'camouflage', 'biolum', 'jaw', 'lung'
];

function makeGenome(rng, role, a = null, b = null) {
  const base = {
    segments: rng.int(2, 7), legs: role === 'glider' ? 0 : rng.pick([2, 4, 6]), fins: role === 'glider' ? rng.int(3, 5) : rng.int(0, 3),
    horns: ROLE[role].predator ? rng.int(1, 4) : rng.int(0, 2), eyes: rng.int(1, 6), tail: rng.range(0.55, 1.9),
    muscle: rng.range(0.55, 1.35), agility: rng.range(0.55, 1.35), armor: rng.range(0.05, 0.55), metabolism: rng.range(0.55, 1.35),
    sensor: rng.range(0.55, 1.45), toxinResist: rng.range(0.05, 0.75), coldResist: rng.range(0.05, 0.75), curiosity: rng.range(0.05, 0.9),
    aggression: ROLE[role].predator ? rng.range(0.55, 1) : rng.range(0.02, 0.35), social: clamp(ROLE[role].social + rng.range(-0.22, 0.22), 0, 1),
    camouflage: rng.range(0.05, 0.82), biolum: rng.range(0.25, 1), jaw: ROLE[role].predator ? rng.range(0.65, 1.3) : rng.range(0.18, 0.62),
    lung: role === 'glider' ? rng.range(0.65, 1.2) : rng.range(0.35, 1)
  };
  if (!a && !b) return base;
  const child = {};
  for (const key of TRAITS) {
    let value = a && b ? (rng.chance(0.5) ? a[key] : b[key]) : (a || b)[key];
    if (rng.chance(0.12)) value += typeof value === 'number' ? rng.range(-0.16, 0.16) * Math.max(1, Math.abs(value)) : 0;
    child[key] = value;
  }
  child.segments = Math.round(clamp(child.segments, 2, 9));
  child.legs = Math.round(clamp(child.legs, 0, 8));
  child.fins = Math.round(clamp(child.fins, 0, 6));
  child.horns = Math.round(clamp(child.horns, 0, 5));
  child.eyes = Math.round(clamp(child.eyes, 1, 8));
  for (const key of TRAITS.slice(5)) child[key] = clamp(child[key], 0.02, key === 'tail' ? 2.2 : 1.6);
  return child;
}

function genomeKey(g, role) {
  return `${role}:${Math.round(g.segments / 4)}:${Math.round(g.legs / 6)}:${Math.round(g.armor)}:${Math.round(g.sensor)}:${Math.round(g.toxinResist + g.coldResist * 0.45)}`;
}


class TinyBrain {
  constructor(rng, a = null, b = null) {
    this.memory = new Float32Array(10);
    this.w1 = new Float32Array(12 * 10);
    this.w2 = new Float32Array(10 * 7);
    if (a || b) {
      for (const arrName of ['w1', 'w2']) {
        const out = this[arrName], aa = a?.[arrName], bb = b?.[arrName];
        for (let i = 0; i < out.length; i++) {
          out[i] = aa && bb ? (rng.chance(0.5) ? aa[i] : bb[i]) : (aa || bb)[i];
          if (rng.chance(0.045)) out[i] += rng.range(-0.26, 0.26);
        }
      }
    } else {
      for (const arr of [this.w1, this.w2]) for (let i = 0; i < arr.length; i++) arr[i] = rng.range(-1, 1);
    }
  }
  run(input) {
    for (let h = 0; h < 10; h++) {
      let s = this.memory[h] * 0.18;
      for (let i = 0; i < 12; i++) s += input[i] * this.w1[h * 12 + i];
      this.memory[h] = Math.tanh(s);
    }
    const out = new Float32Array(7);
    for (let o = 0; o < 7; o++) {
      let s = 0;
      for (let h = 0; h < 10; h++) s += this.memory[h] * this.w2[o * 10 + h];
      out[o] = Math.tanh(s);
    }
    return out;
  }
}

let NEXT_ID = 1;

export class TileMap {
  constructor(seed, rng) {
    this.seed = seed; this.rng = rng;
    this.tiles = new Uint8Array(MAP_W * MAP_H);
    this.dens = []; this.food = []; this.vines = []; this.vents = []; this.pools = [];
    this.roomNames = BIOMES.map(b => b.name);
    this.generate();
  }
  idx(x, y) { return y * MAP_W + x; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H; }
  get(x, y) { if (!this.inBounds(x, y)) return 1; return this.tiles[this.idx(x, y)]; }
  set(x, y, v) { if (this.inBounds(x, y)) this.tiles[this.idx(x, y)] = v; }
  solidAtPixel(px, py) { return this.get(Math.floor(px / TILE), Math.floor(py / TILE)) === 1; }
  waterAtPixel(px, py) { return this.get(Math.floor(px / TILE), Math.floor(py / TILE)) === 2; }
  roomAt(px) { return clamp(Math.floor(px / (WORLD_W / BIOMES.length)), 0, BIOMES.length - 1); }
  biomeAt(px) { return BIOMES[this.roomAt(px)]; }
  generate() {
    const r = this.rng;
    for (let x = 0; x < MAP_W; x++) {
      const surface = Math.floor(35 + Math.sin(x * 0.082) * 4 + Math.sin(x * 0.021) * 8 + (smoothNoise(x * 0.075, 1, this.seed) - 0.5) * 9);
      for (let y = surface; y < MAP_H; y++) this.set(x, y, 1);
    }
    for (let c = 0; c < 58; c++) {
      const cx = r.int(5, MAP_W - 6), cy = r.int(18, MAP_H - 7), rx = r.int(3, 13), ry = r.int(2, 7);
      for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx; x <= cx + rx; x++) {
        const q = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (q < 1 + r.range(-0.15, 0.18)) this.set(x, y, 0);
      }
    }
    for (let x = 6; x < MAP_W - 6; x += r.int(8, 15)) {
      const y = r.int(17, 35), len = r.int(4, 12);
      for (let i = 0; i < len; i++) this.set(x + i, y, 1);
      if (r.chance(0.68)) for (let j = 1; j < r.int(3, 10); j++) this.set(x, y + j, 1);
    }
    for (let y = 24; y < 38; y++) for (let x = 3; x < 20; x++) this.set(x, y, 0);
    for (let x = 2; x < 21; x++) this.set(x, 38, 1);
    const denXs = [9, 35, 62, 89, 116, 142, 168, 186];
    for (let i = 0; i < denXs.length; i++) {
      const tx = denXs[i], ty = this.findFloor(tx) - 1;
      for (let y = ty - 4; y <= ty; y++) for (let x = tx - 3; x <= tx + 3; x++) this.set(x, y, 0);
      for (let x = tx - 3; x <= tx + 3; x++) this.set(x, ty + 1, 1);
      this.dens.push({ x: (tx + 0.5) * TILE, y: (ty - 0.2) * TILE, r: TILE * 2.3, index: i });
    }
    for (let i = 0; i < 148; i++) {
      const tx = r.int(3, MAP_W - 4), fy = this.findFloor(tx) - 1;
      if (fy > 3) this.food.push({ x: (tx + r.next()) * TILE, y: (fy + 0.25) * TILE, alive: true, regrow: 0, kind: r.next() < 0.12 ? 2 : r.next() < 0.30 ? 1 : 0, energy: r.range(0.14, 0.30) });
    }
    for (let i = 0; i < 58; i++) {
      const tx = r.int(5, MAP_W - 6), top = r.int(8, 29), len = r.int(4, 15);
      let end = top;
      for (let y = top; y < Math.min(MAP_H - 2, top + len); y++) { if (this.get(tx, y) === 1) break; end = y; }
      if (end - top > 3) this.vines.push({ x: (tx + 0.5) * TILE, y1: top * TILE, y2: (end + 1) * TILE });
    }
    for (let i = 0; i < 16; i++) {
      const tx = r.int(22, MAP_W - 5), fy = this.findFloor(tx);
      this.vents.push({ x: (tx + 0.5) * TILE, y: (fy - 0.2) * TILE, strength: r.range(0.35, 1), phase: r.range(0, TAU) });
    }
    for (let i = 0; i < 12; i++) {
      const cx = r.int(24, MAP_W - 10), floor = this.findFloor(cx), w = r.int(4, 12), depth = r.int(1, 3);
      for (let x = cx; x < Math.min(MAP_W - 2, cx + w); x++) for (let y = Math.max(2, floor - depth); y < floor; y++) if (this.get(x, y) === 0) this.set(x, y, 2);
      this.pools.push({ x: cx * TILE, y: (floor - depth) * TILE, w: w * TILE, h: depth * TILE });
    }
  }
  findFloor(tx) {
    for (let y = 4; y < MAP_H - 1; y++) if (this.get(tx, y) !== 1 && this.get(tx, y + 1) === 1) return y;
    return 34;
  }
}

export class Creature {
  constructor(world, role, x, y, parentA = null, parentB = null, isPlayer = false) {
    const rng = world.rng;
    this.id = NEXT_ID++; this.role = role; this.meta = ROLE[role];
    this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.facing = rng.chance(0.5) ? -1 : 1;
    this.genome = makeGenome(rng, role, parentA?.genome, parentB?.genome);
    this.r = (isPlayer ? 15 : rng.range(10, 17)) * (0.86 + this.genome.segments * 0.035) * (role === 'lurker' ? 1.15 : 1);
    this.grounded = false; this.wall = 0; this.onVine = false; this.inWater = false;
    this.health = 1; this.energy = isPlayer ? 1 : rng.range(0.52, 1); this.oxygen = 1;
    this.age = 0; this.dead = false; this.isPlayer = isPlayer; this.food = 0;
    this.generation = parentA ? Math.max(parentA.generation, parentB?.generation || 0) + 1 : 1;
    this.brain = new TinyBrain(rng, parentA?.brain || null, parentB?.brain || null);
    this.aiClock = rng.range(0, 0.18);
    this.ai = { x: 0, y: 0, jump: false, grab: false, bite: false, dash: false, signal: 0, mode: 'wander', target: null };
    this.memory = { food: null, threat: null, den: null, mate: null, ttl: { food: 0, threat: 0, den: 999, mate: 0 } };
    this.attackCooldown = 0; this.reproCooldown = rng.range(10, 28); this.signalCooldown = 0; this.scanCooldown = 0;
    this.hue = parentA ? (parentA.hue + rng.range(-12, 12) + 360) % 360 : (this.meta.hue + rng.range(-18, 18) + 360) % 360;
    this.speciesKey = genomeKey(this.genome, role);
    this.fitness = { food: 0, kills: 0, offspring: 0, storms: 0, distance: 0, scans: 0 };
    this.name = `${rng.pick(['Vex','Mira','Thorn','Oro','Nyx','Silt','Axi','Khe','Lum','Rift','Ion','Cera'])}${rng.pick(['ling','maw','fin','claw','wisp','drift','shell','stalker','ray','spore'])}-${this.id % 1000}`;
    const spineCount = clamp(this.genome.segments + 2, 4, 11);
    this.spine = Array.from({ length: spineCount }, (_, i) => ({ x: x - this.facing * i * this.r * 0.38, y, vx: 0, vy: 0 }));
    this.gait = rng.range(0, TAU); this.lodAccumulator = 0;
  }
}

class SpatialHash {
  constructor(size = 240) { this.size = size; this.cells = new Map(); }
  key(x, y) { return `${Math.floor(x / this.size)},${Math.floor(y / this.size)}`; }
  rebuild(items) {
    this.cells.clear();
    for (const item of items) if (!item.dead) {
      const key = this.key(item.x, item.y);
      let cell = this.cells.get(key); if (!cell) this.cells.set(key, cell = []);
      cell.push(item);
    }
  }
  query(x, y, radius) {
    const out = [], minX = Math.floor((x - radius) / this.size), maxX = Math.floor((x + radius) / this.size), minY = Math.floor((y - radius) / this.size), maxY = Math.floor((y + radius) / this.size);
    for (let cy = minY; cy <= maxY; cy++) for (let cx = minX; cx <= maxX; cx++) {
      const cell = this.cells.get(`${cx},${cy}`); if (cell) out.push(...cell);
    }
    return out;
  }
}

const MISSIONS = [
  { id: 'scan', title: 'Map Alien Physiology', text: 'Scan 4 different living species.', target: 4, reward: 35 },
  { id: 'storm', title: 'Shelter Selection', text: 'Survive a fracture storm with four food.', target: 1, reward: 50 },
  { id: 'discover', title: 'Speciation Event', text: 'Discover 8 distinct genome clusters.', target: 8, reward: 60 },
  { id: 'predation', title: 'Trophic Cascade', text: 'Observe 5 successful predator strikes.', target: 5, reward: 55 },
  { id: 'sample', title: 'Field Genomics', text: 'Collect 10 research samples.', target: 10, reward: 45 }
];

export class World {
  constructor(seed = Date.now() >>> 0, options = {}) {
    this.seed = seed; this.rng = new RNG(seed); this.map = new TileMap(seed, this.rng);
    this.creatures = []; this.carcasses = []; this.particles = []; this.pheromones = []; this.events = [];
    this.grid = new SpatialHash(); this.gridClock = 0;
    this.time = 0; this.cycle = 1; this.rainClock = 0; this.clearDuration = 150; this.warningDuration = 30; this.rainDuration = 38;
    this.rainPhase = 'clear'; this.rainIntensity = 0; this.floodY = WORLD_H + 200;
    this.performanceTier = options.performanceTier || 'medium';
    this.populationCap = this.performanceTier === 'low' ? 62 : this.performanceTier === 'high' ? 118 : this.performanceTier === 'ultra' ? 145 : 88;
    this.points = Number(localStorageSafe('fw_points', '0')) || 0; this.bucks = Number(localStorageSafe('fw_bucks', '0')) || 0;
    this.research = Number(localStorageSafe('fw_research', '0')) || 0; this.bestCycle = Number(localStorageSafe('fw_best_cycle', '1')) || 1;
    this.discovered = new Set(JSON.parse(localStorageSafe('fw_species', '[]'))); this.scanned = new Set(JSON.parse(localStorageSafe('fw_scans', '[]')));
    this.samples = Number(localStorageSafe('fw_samples', '0')) || 0; this.predationObserved = Number(localStorageSafe('fw_predation', '0')) || 0;
    this.missionIndex = Number(localStorageSafe('fw_mission', '0')) % MISSIONS.length; this.mission = { ...MISSIONS[this.missionIndex], progress: 0 };
    this.pendingEvolution = null; this.ecology = { oxygen: 0.68, toxin: 0.12, nutrients: 0.74, temperature: 0.5, biodiversity: 0 };
    this.message = 'Scan life, gather food, and reach a den before fracture rain.'; this.messageTime = 7; this.paused = false; this.gameOver = false;
    const start = this.map.dens[0]; this.player = new Creature(this, 'nibbler', start.x, start.y - 30, null, null, true); this.creatures.push(this.player);
    this.spawnEcology(); this.rebuildGrid(); this.refreshMission();
  }
  setPerformanceTier(tier) {
    this.performanceTier = tier;
    this.populationCap = tier === 'low' ? 62 : tier === 'high' ? 118 : tier === 'ultra' ? 145 : 88;
  }
  spawnEcology() {
    const factor = this.performanceTier === 'low' ? 0.62 : this.performanceTier === 'ultra' ? 1.18 : this.performanceTier === 'high' ? 1 : 0.78;
    const counts = { nibbler: 26, skitter: 20, carrion: 12, hunter: 9, glider: 12, lurker: 6 };
    for (const [role, base] of Object.entries(counts)) for (let i = 0; i < Math.round(base * factor); i++) {
      const tx = this.rng.int(20, MAP_W - 5), y = (this.map.findFloor(tx) - 1.2) * TILE;
      this.creatures.push(new Creature(this, role, tx * TILE, y));
    }
  }
  toast(text, sec = 3) { this.message = text; this.messageTime = sec; }
  addPoints(gp = 0, gb = 0) { this.points += gp; this.bucks += gb; saveLocal('fw_points', this.points); saveLocal('fw_bucks', this.bucks); }
  addResearch(value, reason = '') { this.research += value; saveLocal('fw_research', this.research); if (reason) this.toast(`Research +${value}: ${reason}`, 4); }
  rebuildGrid() { this.grid.rebuild(this.creatures); }
  nearby(c, radius, predicate = () => true) {
    const rr = radius * radius; return this.grid.query(c.x, c.y, radius).filter(o => o !== c && !o.dead && predicate(o) && dist2(c, o) <= rr);
  }
  nearest(c, predicate, maxDist = 520) {
    let best = null, bd = maxDist * maxDist;
    for (const o of this.grid.query(c.x, c.y, maxDist)) {
      if (o === c || o.dead || !predicate(o)) continue;
      const d = dist2(c, o); if (d < bd) { bd = d; best = o; }
    }
    return best;
  }
  nearestFood(c, maxDist = 700) {
    let best = null, bd = maxDist * maxDist;
    for (const f of this.map.food) if (f.alive) { const d = dist2(c, f); if (d < bd) { bd = d; best = f; } }
    return best;
  }
  nearestCarcass(c, maxDist = 620) {
    let best = null, bd = maxDist * maxDist;
    for (const carc of this.carcasses) if (carc.mass > 0) { const d = dist2(c, carc); if (d < bd) { bd = d; best = carc; } }
    return best;
  }
  nearestDen(c) {
    let best = this.map.dens[0], bd = Infinity;
    for (const d of this.map.dens) { const q = dist2(c, d); if (q < bd) { bd = q; best = d; } }
    return best;
  }
  inDen(c) { const d = this.nearestDen(c); return Math.hypot(d.x - c.x, d.y - c.y) < d.r; }
  environmentAt(c) {
    const biome = this.map.biomeAt(c.x);
    let toxin = biome.toxin, oxygen = biome.oxygen, temperature = biome.temperature;
    for (const vent of this.map.vents) {
      const d = Math.hypot(vent.x - c.x, vent.y - c.y);
      if (d < 240) toxin += (1 - d / 240) * vent.strength * 0.28;
    }
    return { biome, toxin: clamp(toxin, 0, 1), oxygen: clamp(oxygen, 0, 1), temperature: clamp(temperature, 0, 1), water: this.map.waterAtPixel(c.x, c.y) || c.y > this.floodY };
  }
  tileCollision(c, dt) {
    c.grounded = false; c.wall = 0; c.onVine = false;
    const r = c.r * 0.72;
    c.x += c.vx * dt;
    let minX = Math.floor((c.x - r) / TILE), maxX = Math.floor((c.x + r) / TILE), minY = Math.floor((c.y - r) / TILE), maxY = Math.floor((c.y + r) / TILE);
    for (let ty = minY; ty <= maxY; ty++) for (let tx = minX; tx <= maxX; tx++) if (this.map.get(tx, ty) === 1) {
      const left = tx * TILE, right = left + TILE;
      if (c.vx > 0 && c.x + r > left && c.x < left) { c.x = left - r; c.vx *= -0.08; c.wall = 1; }
      else if (c.vx < 0 && c.x - r < right && c.x > right) { c.x = right + r; c.vx *= -0.08; c.wall = -1; }
    }
    c.y += c.vy * dt;
    minX = Math.floor((c.x - r) / TILE); maxX = Math.floor((c.x + r) / TILE); minY = Math.floor((c.y - r) / TILE); maxY = Math.floor((c.y + r) / TILE);
    for (let ty = minY; ty <= maxY; ty++) for (let tx = minX; tx <= maxX; tx++) if (this.map.get(tx, ty) === 1) {
      const top = ty * TILE, bottom = top + TILE;
      if (c.vy > 0 && c.y + r > top && c.y < top) { c.y = top - r; c.vy = 0; c.grounded = true; }
      else if (c.vy < 0 && c.y - r < bottom && c.y > bottom) { c.y = bottom + r; c.vy = 0; }
    }
    for (const v of this.map.vines) if (Math.abs(c.x - v.x) < 18 && c.y > v.y1 && c.y < v.y2) { c.onVine = true; break; }
    c.x = clamp(c.x, c.r, WORLD_W - c.r);
    if (c.y > WORLD_H + 120) this.kill(c, 'fell into the abyss');
  }
  remember(c, type, target, ttl = 8) { c.memory[type] = target ? { x: target.x, y: target.y, ref: target } : null; c.memory.ttl[type] = ttl; }
  updateAI(c, dt) {
    c.aiClock -= dt; if (c.aiClock > 0) return;
    const distance = Math.hypot(c.x - this.player.x, c.y - this.player.y);
    const baseRate = this.performanceTier === 'low' ? 0.19 : distance > 1200 ? 0.28 : distance > 650 ? 0.16 : 0.09;
    c.aiClock = baseRate + this.rng.range(0, 0.05);
    for (const k of ['food', 'threat', 'mate']) { c.memory.ttl[k] -= baseRate; if (c.memory.ttl[k] <= 0) c.memory[k] = null; }
    const env = this.environmentAt(c), rainUrgency = this.rainPhase === 'clear' ? 0 : this.rainPhase === 'warning' ? 0.82 : 1.35;
    const threat = this.nearest(c, o => o.meta.predator && !c.meta.predator && o.r > c.r * 0.6, 440 * c.meta.fear * c.genome.sensor);
    const prey = c.meta.predator ? this.nearest(c, o => !o.meta.predator && o.r < c.r * (1.2 + c.genome.jaw * 0.35), 760 * c.genome.sensor) : null;
    const food = !c.meta.predator ? this.nearestFood(c, 720 * c.genome.sensor) : null;
    const carcass = c.meta.scavenger ? this.nearestCarcass(c) : null;
    const mate = c.energy > 0.76 && c.reproCooldown <= 0 ? this.nearest(c, o => o.role === c.role && o.energy > 0.7 && o.reproCooldown <= 0, 520) : null;
    if (threat) this.remember(c, 'threat', threat, 7);
    if (food) this.remember(c, 'food', food, 12);
    if (mate) this.remember(c, 'mate', mate, 8);
    const needs = {
      shelter: rainUrgency * (this.inDen(c) ? 0 : 1),
      flee: threat ? 1.35 : c.memory.threat ? 0.62 : 0,
      hunt: prey ? (0.35 + (1 - c.energy) * 0.9 + c.genome.aggression * 0.45) : 0,
      scavenge: carcass ? (0.4 + (1 - c.energy) * 0.8) : 0,
      forage: food ? (0.25 + (1 - c.energy) * 0.85) : 0,
      mate: mate ? (c.energy - 0.68) * (0.7 + c.genome.social) : 0,
      explore: 0.12 + c.genome.curiosity * 0.48
    };
    let mode = 'explore', utility = -Infinity;
    for (const [name, value] of Object.entries(needs)) if (value > utility) { mode = name; utility = value; }
    let target = null;
    if (mode === 'shelter') target = this.nearestDen(c);
    else if (mode === 'flee') target = threat || c.memory.threat?.ref || c.memory.threat;
    else if (mode === 'hunt') target = prey;
    else if (mode === 'scavenge') target = carcass;
    else if (mode === 'forage') target = food || c.memory.food?.ref || c.memory.food;
    else if (mode === 'mate') target = mate;
    c.ai.mode = mode; c.ai.target = target;
    let dx = target ? target.x - c.x : Math.sin(this.time * 0.37 + c.id * 1.7) * 240;
    let dy = target ? target.y - c.y : Math.cos(this.time * 0.23 + c.id) * 70;
    const localKin = this.nearby(c, 220, o => o.role === c.role).length;
    const input = new Float32Array([
      clamp(dx / 520, -1, 1), clamp(dy / 360, -1, 1), threat ? 1 : 0, prey ? 1 : 0,
      c.energy, c.health, env.oxygen, env.toxin, env.temperature, this.rainIntensity,
      clamp(localKin / 6, 0, 1), this.rng.range(-1, 1)
    ]);
    const out = c.brain.run(input);
    let move = clamp(sign(dx) * 0.68 + out[0] * 0.62, -1, 1);
    if (mode === 'flee') move = -sign(dx);
    if (c.role === 'lurker' && mode === 'hunt' && Math.abs(dx) > 150) move *= 0.18;
    c.ai.x = move; c.ai.y = clamp(sign(dy) * 0.6 + out[1] * 0.5, -1, 1);
    c.ai.jump = (dy < -45 || c.wall !== 0 || out[2] > 0.55) && out[2] > -0.4;
    c.ai.grab = out[3] > 0.18 || mode === 'shelter';
    c.ai.bite = (mode === 'hunt' || mode === 'scavenge') && target && Math.hypot(dx, dy) < c.r + (target.r || 10) + 18;
    c.ai.dash = (mode === 'flee' || mode === 'hunt') && c.energy > 0.28 && out[4] > -0.25;
    c.ai.signal = out[5];
    if (Math.abs(c.ai.signal) > 0.66 && c.signalCooldown <= 0) this.emitPheromone(c, c.ai.signal > 0 ? 'food' : 'danger');
  }
  emitPheromone(c, kind) {
    c.signalCooldown = 2.5; this.pheromones.push({ x: c.x, y: c.y, kind, strength: 1, hue: kind === 'food' ? 150 : 350 });
    if (this.pheromones.length > 140) this.pheromones.splice(0, this.pheromones.length - 140);
  }
  movement(c, control, dt) {
    c.attackCooldown = Math.max(0, c.attackCooldown - dt); c.reproCooldown = Math.max(0, c.reproCooldown - dt);
    c.signalCooldown = Math.max(0, c.signalCooldown - dt); c.scanCooldown = Math.max(0, c.scanCooldown - dt); c.age += dt;
    const env = this.environmentAt(c); c.inWater = env.water;
    const g = c.genome, meta = c.meta, oscillator = Math.sin(this.time * (5 + g.muscle * 4) + c.id);
    let ax = control.x * 860 * meta.speed * g.muscle * (0.76 + g.legs * 0.045);
    if (!c.grounded && !c.inWater) ax *= 0.48 + g.agility * 0.12;
    const gravity = 1280 * env.biome.gravity;
    if (c.inWater) {
      c.vy += gravity * 0.12 * dt; c.vx *= Math.pow(0.22, dt); c.vy *= Math.pow(0.12, dt);
      c.vx += control.x * (180 + g.fins * 46) * dt; c.vy += control.y * (180 + g.fins * 55) * dt;
      c.vy += oscillator * g.fins * 5 * dt;
      c.oxygen -= dt * Math.max(0.002, 0.025 - g.lung * 0.018);
    } else if (meta.flyer) {
      c.vy += gravity * 0.22 * dt; if (control.jump) c.vy -= (490 + g.fins * 65) * dt; c.oxygen = Math.min(1, c.oxygen + dt * 0.18);
    } else { c.vy += gravity * dt; c.oxygen = Math.min(1, c.oxygen + dt * 0.22); }
    if (c.onVine && control.grab) { c.vy *= 0.7; c.vy += (control.y || 0) * 510 * g.agility * dt; }
    if (c.wall && control.grab) { c.vy = Math.min(c.vy, 70); if (control.y) c.vy = control.y * (95 + g.agility * 35); }
    c.vx += ax * dt;
    const maxSpeed = (control.dash ? 355 : 235) * meta.speed * (0.72 + g.agility * 0.28) * (1 - g.armor * 0.14);
    c.vx = clamp(c.vx, -maxSpeed, maxSpeed);
    if (Math.abs(control.x) < 0.05 && c.grounded) c.vx *= Math.pow(0.0015, dt);
    if (control.jump && (c.grounded || c.wall || c.onVine || c.inWater)) {
      c.vy = c.inWater ? -260 - g.fins * 36 : -390 - g.muscle * 72;
      c.vx += (c.wall ? -c.wall : control.x) * (70 + g.agility * 42);
    }
    if (control.x) c.facing = sign(control.x);
    const prevX = c.x, prevY = c.y; this.tileCollision(c, dt); c.fitness.distance += Math.hypot(c.x - prevX, c.y - prevY) / 1000;
    const toxinStress = Math.max(0, env.toxin - g.toxinResist * 0.7), coldStress = Math.max(0, 0.38 - env.temperature - g.coldResist * 0.22);
    c.health -= dt * (toxinStress * 0.014 + coldStress * 0.018 + (c.oxygen <= 0 ? 0.08 : 0));
    const moveCost = (Math.abs(c.vx) / 310 + Math.abs(c.vy) / 520) * 0.0058;
    c.energy -= dt * ((0.0019 + moveCost + (control.dash ? 0.011 : 0)) * g.metabolism + g.armor * 0.00045);
    if (control.bite) this.bite(c); if (control.scan && c.isPlayer) this.scan(c);
    this.eatFood(c); if (c.meta.scavenger || c.meta.predator) this.eatCarcass(c, dt);
    this.tryMate(c, dt); this.updateSpine(c, dt);
    if (c.energy <= 0) this.kill(c, 'starved'); if (c.health <= 0) this.kill(c, 'was consumed'); if (c.age > 250 + (1 / g.metabolism) * 45) this.kill(c, 'aged out');
  }
  updateSpine(c, dt) {
    c.gait += dt * (4 + Math.hypot(c.vx, c.vy) * 0.018);
    const rest = c.r * 0.42;
    c.spine[0].x = lerp(c.spine[0].x, c.x - c.facing * c.r * 0.12, 0.72);
    c.spine[0].y = lerp(c.spine[0].y, c.y + Math.sin(c.gait) * c.r * 0.04, 0.72);
    for (let i = 1; i < c.spine.length; i++) {
      const a = c.spine[i - 1], b = c.spine[i], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      const targetX = a.x + dx / d * rest, targetY = a.y + dy / d * rest + Math.sin(c.gait - i * 0.55) * c.r * 0.035;
      b.x = lerp(b.x, targetX, 0.58); b.y = lerp(b.y, targetY, 0.58);
    }
  }
  bite(c) {
    if (c.attackCooldown > 0) return;
    c.attackCooldown = 0.48 + c.genome.jaw * 0.08;
    const reachX = c.x + c.facing * (c.r + 20 + c.genome.jaw * 5);
    let victim = null, bd = (46 + c.genome.jaw * 8) ** 2;
    for (const o of this.grid.query(reachX, c.y, 70)) if (o !== c && !o.dead) {
      const d = (o.x - reachX) ** 2 + (o.y - c.y) ** 2; if (d < bd) { bd = d; victim = o; }
    }
    if (victim) {
      const raw = (c.meta.predator ? 0.30 : 0.13) * (0.72 + c.genome.jaw * 0.58);
      const damage = raw * (1 - victim.genome.armor * 0.38);
      victim.health -= damage; victim.vx += c.facing * (175 + c.genome.muscle * 65); victim.vy -= 70;
      c.energy = Math.min(1, c.energy + damage * 0.18); if (c.isPlayer) this.addPoints(2, 0);
      if (c.meta.predator) { c.fitness.kills += victim.health <= 0 ? 1 : 0; this.predationObserved += 1; saveLocal('fw_predation', this.predationObserved); this.refreshMission(); }
    }
  }
  eatFood(c) {
    for (const f of this.map.food) if (f.alive && Math.abs(f.x - c.x) < c.r + 14 && Math.abs(f.y - c.y) < c.r + 20) {
      f.alive = false; f.regrow = 38 + this.rng.range(0, 85); c.energy = Math.min(1, c.energy + f.energy); c.fitness.food++;
      if (c.isPlayer) { c.food = Math.min(8, c.food + 1); this.samples += f.kind === 2 ? 1 : 0; saveLocal('fw_samples', this.samples); this.addPoints(1, 0); this.refreshMission(); this.toast(`Food ${c.food}/4 · sample archive ${this.samples}`, 3); }
      break;
    }
  }
  eatCarcass(c, dt) {
    const carc = this.nearestCarcass(c, 54 + c.r);
    if (!carc || dist2(c, carc) > (c.r + 35) ** 2 || carc.mass <= 0) return;
    const amount = Math.min(carc.mass, dt * (0.07 + c.genome.jaw * 0.035)); carc.mass -= amount; c.energy = Math.min(1, c.energy + amount * 0.6);
  }
  tryMate(c, dt) {
    if (c.isPlayer || c.reproCooldown > 0 || c.energy < 0.78 || this.creatures.length >= this.populationCap) return;
    const mate = c.ai.mode === 'mate' ? c.ai.target : null;
    if (!mate || mate.dead || mate.reproCooldown > 0 || mate.energy < 0.7 || dist2(c, mate) > (c.r + mate.r + 18) ** 2) return;
    if (!this.rng.chance(dt * 1.8)) return;
    const child = new Creature(this, c.role, (c.x + mate.x) / 2 + this.rng.range(-12, 12), Math.min(c.y, mate.y) - 12, c, mate);
    child.energy = 0.44; c.energy -= 0.23; mate.energy -= 0.20; c.reproCooldown = 24; mate.reproCooldown = 24; c.fitness.offspring++; mate.fitness.offspring++;
    this.creatures.push(child); this.registerSpecies(child); this.events.push({ type: 'birth', x: child.x, y: child.y, time: this.time });
  }
  registerSpecies(c) {
    if (this.discovered.has(c.speciesKey)) return false;
    this.discovered.add(c.speciesKey); saveLocal('fw_species', JSON.stringify([...this.discovered]));
    if (c.isPlayer || Math.hypot(c.x - this.player.x, c.y - this.player.y) < 540) { this.addResearch(6, `new species ${c.name}`); this.addPoints(4, 0); }
    this.refreshMission(); return true;
  }
  scan(c) {
    if (c.scanCooldown > 0) return; c.scanCooldown = 0.9;
    const target = this.nearest(c, o => true, 260 * c.genome.sensor);
    if (!target) { this.toast('Scanner found no organism in range.', 2); return; }
    const fresh = !this.scanned.has(target.speciesKey); this.scanned.add(target.speciesKey); saveLocal('fw_scans', JSON.stringify([...this.scanned]));
    target.fitness.scans++; c.fitness.scans++; this.addResearch(fresh ? 10 : 2, `${target.meta.name} · gen ${target.generation}`); this.addPoints(fresh ? 5 : 1, 0);
    this.events.push({ type: 'scan', x: target.x, y: target.y, time: this.time, target }); this.refreshMission();
  }
  refreshMission() {
    const m = this.mission;
    if (m.id === 'scan') m.progress = this.scanned.size;
    else if (m.id === 'storm') m.progress = Math.max(0, this.cycle - 1);
    else if (m.id === 'discover') m.progress = this.discovered.size;
    else if (m.id === 'predation') m.progress = this.predationObserved;
    else if (m.id === 'sample') m.progress = this.samples;
    if (m.progress >= m.target) {
      this.addResearch(m.reward, `mission complete: ${m.title}`); this.addPoints(m.reward, this.missionIndex % 3 === 2 ? 1 : 0);
      this.missionIndex = (this.missionIndex + 1) % MISSIONS.length; saveLocal('fw_mission', this.missionIndex);
      this.mission = { ...MISSIONS[this.missionIndex], progress: 0 };
    }
  }
  evolutionChoices() {
    const options = [
      { id: 'muscle', title: 'Myofiber Lattice', text: '+18% muscle force and jump power' },
      { id: 'armor', title: 'Ceramic Dermis', text: '+22% armor, slightly higher energy cost' },
      { id: 'sensor', title: 'Quantum Cilia', text: '+25% scan and perception range' },
      { id: 'toxin', title: 'Catalytic Blood', text: '+28% toxin resistance' },
      { id: 'cold', title: 'Antifreeze Cells', text: '+28% cold resistance' },
      { id: 'fins', title: 'Vector Fins', text: '+1 fin and stronger swimming' },
      { id: 'metabolism', title: 'Slow Metabolism', text: 'Reduced passive energy use' },
      { id: 'jaw', title: 'Resonant Jaw', text: '+20% bite effectiveness' }
    ];
    const chosen = []; while (chosen.length < 3) { const o = this.rng.pick(options); if (!chosen.includes(o)) chosen.push(o); }
    return chosen;
  }
  applyEvolution(id) {
    const g = this.player.genome;
    if (id === 'muscle') g.muscle = clamp(g.muscle * 1.18, 0, 1.6);
    else if (id === 'armor') { g.armor = clamp(g.armor + 0.22, 0, 1.6); g.metabolism = clamp(g.metabolism + 0.04, 0, 1.6); }
    else if (id === 'sensor') g.sensor = clamp(g.sensor * 1.25, 0, 1.6);
    else if (id === 'toxin') g.toxinResist = clamp(g.toxinResist + 0.28, 0, 1.6);
    else if (id === 'cold') g.coldResist = clamp(g.coldResist + 0.28, 0, 1.6);
    else if (id === 'fins') g.fins = clamp(g.fins + 1, 0, 6);
    else if (id === 'metabolism') g.metabolism = clamp(g.metabolism * 0.84, 0.25, 1.6);
    else if (id === 'jaw') g.jaw = clamp(g.jaw * 1.20, 0, 1.6);
    this.player.speciesKey = genomeKey(g, this.player.role); this.pendingEvolution = null; this.paused = false; this.addResearch(8, 'player lineage adapted');
  }
  kill(c, reason) {
    if (c.dead) return; c.dead = true;
    this.carcasses.push({ x: c.x, y: c.y, mass: c.r * 0.07 + 0.6, hue: c.hue, age: 0, speciesKey: c.speciesKey });
    if (c.isPlayer) { this.gameOver = true; this.toast(`You ${reason}. Respawn from den memory.`, 99); }
  }
  respawn() {
    const den = this.map.dens[0], old = this.player;
    const replacement = new Creature(this, 'nibbler', den.x, den.y - 30, old, null, true); replacement.food = 0;
    this.player = replacement; this.creatures.push(replacement); this.gameOver = false;
    this.rainPhase = 'clear'; this.rainClock = 0; this.rainIntensity = 0; this.floodY = WORLD_H + 200; this.toast('New body grown from den memory.');
  }
  updateRain(dt) {
    this.rainClock += dt;
    if (this.rainPhase === 'clear') { this.rainIntensity = 0; if (this.rainClock >= this.clearDuration) { this.rainClock = 0; this.rainPhase = 'warning'; this.toast('Atmospheric fracture detected. Reach a den.', 8); } }
    else if (this.rainPhase === 'warning') { this.rainIntensity = clamp(this.rainClock / this.warningDuration, 0, 0.38); if (this.rainClock >= this.warningDuration) { this.rainClock = 0; this.rainPhase = 'rain'; this.toast('FRACTURE RAIN — SHELTER NOW', 8); } }
    else if (this.rainPhase === 'rain') {
      this.rainIntensity = clamp(this.rainClock / 5, 0, 1); this.floodY = lerp(WORLD_H + 100, WORLD_H * 0.61, clamp(this.rainClock / this.rainDuration, 0, 1));
      for (const c of this.creatures) if (!c.dead && !this.inDen(c)) { if (c.y > this.floodY) { c.vy -= 460 * dt; c.health -= 0.11 * dt; } c.health -= this.rainIntensity * 0.018 * dt * (1 - c.genome.armor * 0.12); }
      if (this.rainClock >= this.rainDuration) this.finishCycle();
    }
  }
  finishCycle() {
    const survived = !this.player.dead && this.inDen(this.player) && this.player.food >= 4;
    if (survived) {
      this.cycle++; this.bestCycle = Math.max(this.bestCycle, this.cycle); saveLocal('fw_best_cycle', this.bestCycle);
      this.addPoints(25, this.cycle % 3 === 0 ? 1 : 0); this.addResearch(12, 'fracture-cycle survival');
      this.player.food = Math.max(0, this.player.food - 4); this.player.health = 1; this.player.energy = 1; this.player.fitness.storms++;
      this.pendingEvolution = this.evolutionChoices(); this.paused = true; this.toast(`Cycle ${this.cycle}. Select a lineage adaptation.`, 99); this.refreshMission();
    } else if (!this.player.dead) this.kill(this.player, this.player.food < 4 ? 'entered shelter without enough food' : 'missed the shelter window');
    this.rainPhase = 'clear'; this.rainClock = 0; this.rainIntensity = 0; this.floodY = WORLD_H + 200;
    for (const f of this.map.food) if (!f.alive && this.rng.chance(0.7)) { f.alive = true; f.regrow = 0; }
  }
  updateEcology(dt) {
    this.ecology.nutrients = clamp(this.ecology.nutrients + this.carcasses.length * 0.00015 * dt - this.creatures.length * 0.000003 * dt, 0.1, 1);
    this.ecology.oxygen = clamp(0.55 + this.map.food.filter(f => f.alive).length / 420 - this.creatures.length / 760, 0.25, 0.95);
    this.ecology.toxin = clamp(0.07 + this.map.vents.reduce((s, v) => s + v.strength, 0) / 160, 0, 0.7);
    this.ecology.temperature = clamp(0.5 + Math.sin(this.time / 90) * 0.08, 0.2, 0.8);
    this.ecology.biodiversity = this.speciesCount();
  }
  step(dt, playerInput = {}) {
    if (this.paused) return; this.time += dt; if (this.messageTime > 0) this.messageTime -= dt;
    this.updateRain(dt); this.gridClock -= dt; if (this.gridClock <= 0) { this.rebuildGrid(); this.gridClock = this.performanceTier === 'low' ? 0.32 : 0.20; }
    for (const f of this.map.food) if (!f.alive) { f.regrow -= dt * (0.7 + this.map.biomeAt(f.x).food * 0.3); if (f.regrow <= 0) f.alive = true; }
    for (const p of this.pheromones) p.strength -= dt * 0.12; this.pheromones = this.pheromones.filter(p => p.strength > 0);
    const snapshot = [...this.creatures];
    for (const c of snapshot) {
      if (c.dead) continue;
      const distance = c.isPlayer ? 0 : Math.hypot(c.x - this.player.x, c.y - this.player.y);
      const skip = this.performanceTier === 'low' && distance > 900 && ((this.time * 60 + c.id) | 0) % 2;
      if (skip) continue;
      let control;
      if (c.isPlayer) control = playerInput;
      else { this.updateAI(c, dt); control = { x: c.ai.x, y: c.ai.y, jump: c.ai.jump, grab: c.ai.grab, bite: c.ai.bite, dash: c.ai.dash, scan: false }; }
      this.movement(c, control, skip ? dt * 2 : dt);
    }
    this.creatures = this.creatures.filter(c => !c.dead || c.isPlayer);
    for (const carc of this.carcasses) { carc.age += dt; carc.mass -= dt * 0.0045; }
    this.carcasses = this.carcasses.filter(c => c.mass > 0 && c.age < 150);
    if (this.creatures.filter(c => !c.isPlayer && !c.dead).length < this.populationCap * 0.52 && this.rng.chance(dt * 0.24)) {
      const role = this.rng.pick(Object.keys(ROLE)), tx = this.rng.int(20, MAP_W - 5); const creature = new Creature(this, role, tx * TILE, (this.map.findFloor(tx) - 1.2) * TILE);
      this.creatures.push(creature); this.registerSpecies(creature);
    }
    if (((this.time * 2) | 0) !== (((this.time - dt) * 2) | 0)) this.updateEcology(0.5);
  }
  rainRemaining() { if (this.rainPhase === 'clear') return this.clearDuration - this.rainClock + this.warningDuration; if (this.rainPhase === 'warning') return this.warningDuration - this.rainClock; return this.rainDuration - this.rainClock; }
  speciesCount() { const set = new Set(); for (const c of this.creatures) if (!c.dead) set.add(c.speciesKey); return set.size; }
  stats() {
    const counts = {}; for (const c of this.creatures) if (!c.dead) counts[c.role] = (counts[c.role] || 0) + 1;
    const biome = this.map.biomeAt(this.player.x);
    return { population: this.creatures.filter(c => !c.dead).length, species: this.speciesCount(), cycle: this.cycle, bestCycle: this.bestCycle, rainPhase: this.rainPhase, rainRemaining: this.rainRemaining(), points: this.points, bucks: this.bucks, research: this.research, samples: this.samples, biome: biome.name, ecology: { ...this.ecology }, mission: { ...this.mission }, counts };
  }
}

function localStorageSafe(key, fallback) { try { return typeof localStorage !== 'undefined' ? localStorage.getItem(key) ?? fallback : fallback; } catch { return fallback; } }
function saveLocal(key, value) { try { if (typeof localStorage !== 'undefined') localStorage.setItem(key, String(value)); } catch {} }
