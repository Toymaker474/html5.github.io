export const TILE = 32;
export const MAP_W = 180;
export const MAP_H = 54;
export const WORLD_W = MAP_W * TILE;
export const WORLD_H = MAP_H * TILE;
export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const sign = v => (v < 0 ? -1 : v > 0 ? 1 : 0);

export class RNG {
  constructor(seed = (Date.now() ^ 0x9e3779b9) >>> 0) { this.s = seed >>> 0 || 1; }
  next() { let x = this.s; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.s = x >>> 0; return this.s / 4294967296; }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
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
  nibbler: { name: 'Glow Nibbler', hue: 162, predator: false, flyer: false, fear: 1.0, speed: 0.92 },
  skitter: { name: 'Shard Skitter', hue: 54, predator: false, flyer: false, fear: 1.3, speed: 1.22 },
  carrion: { name: 'Mire Picker', hue: 286, predator: false, flyer: false, fear: 0.8, speed: 0.88 },
  hunter: { name: 'Rift Hunter', hue: 345, predator: true, flyer: false, fear: 0.15, speed: 1.1 },
  glider: { name: 'Void Glider', hue: 203, predator: false, flyer: true, fear: 0.75, speed: 1.0 },
  lurker: { name: 'Veil Maw', hue: 315, predator: true, flyer: false, fear: 0.05, speed: 0.82 }
};

class TinyBrain {
  constructor(rng, parent = null) {
    this.hidden = new Float32Array(8);
    this.w1 = new Float32Array(8 * 8);
    this.w2 = new Float32Array(8 * 5);
    if (parent) {
      this.w1.set(parent.w1); this.w2.set(parent.w2);
      for (const arr of [this.w1, this.w2]) for (let i = 0; i < arr.length; i++) if (rng.next() < 0.055) arr[i] += rng.range(-0.34, 0.34);
    } else {
      for (const arr of [this.w1, this.w2]) for (let i = 0; i < arr.length; i++) arr[i] = rng.range(-1, 1);
    }
  }
  run(input) {
    for (let h = 0; h < 8; h++) {
      let s = this.hidden[h] * 0.12;
      for (let i = 0; i < 8; i++) s += input[i] * this.w1[h * 8 + i];
      this.hidden[h] = Math.tanh(s);
    }
    const out = new Float32Array(5);
    for (let o = 0; o < 5; o++) {
      let s = 0;
      for (let h = 0; h < 8; h++) s += this.hidden[h] * this.w2[o * 8 + h];
      out[o] = Math.tanh(s);
    }
    return out;
  }
}

let NEXT_ID = 1;

export class TileMap {
  constructor(seed, rng) {
    this.seed = seed;
    this.rng = rng;
    this.tiles = new Uint8Array(MAP_W * MAP_H);
    this.dens = [];
    this.food = [];
    this.vines = [];
    this.roomNames = ['Luminous Drain', 'Bone Orchard', 'Glass Marsh', 'Veil Causeway', 'Fungal Vault', 'Sky Maw', 'Shiverworks'];
    this.generate();
  }
  idx(x, y) { return y * MAP_W + x; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H; }
  get(x, y) { if (!this.inBounds(x, y)) return 1; return this.tiles[this.idx(x, y)]; }
  set(x, y, v) { if (this.inBounds(x, y)) this.tiles[this.idx(x, y)] = v; }
  solidAtPixel(px, py) { return this.get(Math.floor(px / TILE), Math.floor(py / TILE)) === 1; }
  roomAt(px) { return clamp(Math.floor(px / (WORLD_W / this.roomNames.length)), 0, this.roomNames.length - 1); }
  generate() {
    const r = this.rng;
    for (let x = 0; x < MAP_W; x++) {
      const surface = Math.floor(33 + Math.sin(x * 0.09) * 4 + Math.sin(x * 0.023) * 7 + (smoothNoise(x * 0.08, 1, this.seed) - 0.5) * 8);
      for (let y = surface; y < MAP_H; y++) this.set(x, y, 1);
    }
    // Carve large chambers and tunnels.
    for (let c = 0; c < 44; c++) {
      const cx = r.int(5, MAP_W - 6), cy = r.int(18, MAP_H - 7), rx = r.int(3, 12), ry = r.int(2, 6);
      for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx; x <= cx + rx; x++) {
        const q = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (q < 1 + r.range(-0.15, 0.18)) this.set(x, y, 0);
      }
    }
    // Make traversable bridges and columns.
    for (let x = 6; x < MAP_W - 6; x += r.int(8, 15)) {
      const y = r.int(18, 33), len = r.int(4, 11);
      for (let i = 0; i < len; i++) this.set(x + i, y, 1);
      if (r.next() < 0.65) for (let j = 1; j < r.int(3, 9); j++) this.set(x, y + j, 1);
    }
    // Open a safe start chamber.
    for (let y = 24; y < 36; y++) for (let x = 3; x < 18; x++) this.set(x, y, 0);
    for (let x = 2; x < 20; x++) this.set(x, 36, 1);
    // Dens.
    const denXs = [9, 37, 68, 101, 133, 164];
    for (let i = 0; i < denXs.length; i++) {
      const tx = denXs[i], ty = this.findFloor(tx) - 1;
      for (let y = ty - 4; y <= ty; y++) for (let x = tx - 3; x <= tx + 3; x++) this.set(x, y, 0);
      for (let x = tx - 3; x <= tx + 3; x++) this.set(x, ty + 1, 1);
      this.dens.push({ x: (tx + 0.5) * TILE, y: (ty - 0.2) * TILE, r: TILE * 2.3, index: i });
    }
    // Food and climbable vines.
    for (let i = 0; i < 115; i++) {
      const tx = r.int(3, MAP_W - 4), fy = this.findFloor(tx) - 1;
      if (fy > 3) this.food.push({ x: (tx + r.next()) * TILE, y: (fy + 0.25) * TILE, alive: true, regrow: 0, kind: r.next() < 0.2 ? 1 : 0 });
    }
    for (let i = 0; i < 48; i++) {
      const tx = r.int(5, MAP_W - 6), top = r.int(8, 27), len = r.int(4, 14);
      let end = top;
      for (let y = top; y < Math.min(MAP_H - 2, top + len); y++) { if (this.get(tx, y) === 1) break; end = y; }
      if (end - top > 3) this.vines.push({ x: (tx + 0.5) * TILE, y1: top * TILE, y2: (end + 1) * TILE });
    }
  }
  findFloor(tx) {
    for (let y = 4; y < MAP_H - 1; y++) if (this.get(tx, y) === 0 && this.get(tx, y + 1) === 1) return y;
    return 32;
  }
}

export class Creature {
  constructor(world, role, x, y, parent = null, isPlayer = false) {
    const rng = world.rng;
    this.id = NEXT_ID++;
    this.role = role;
    this.meta = ROLE[role];
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.r = isPlayer ? 15 : rng.range(10, 18) * (role === 'hunter' ? 1.18 : role === 'lurker' ? 1.3 : 1);
    this.facing = rng.next() < 0.5 ? -1 : 1;
    this.grounded = false; this.wall = 0; this.onVine = false;
    this.health = 1; this.energy = isPlayer ? 1 : rng.range(0.55, 1);
    this.age = 0; this.dead = false; this.isPlayer = isPlayer;
    this.food = isPlayer ? 0 : 0;
    this.generation = parent ? parent.generation + 1 : 1;
    this.brain = new TinyBrain(rng, parent?.brain || null);
    this.aiClock = rng.range(0, 0.2); this.ai = { x: 0, jump: false, grab: false, bite: false, mode: 'wander', target: null, memoryX: x, memoryY: y };
    this.attackCooldown = 0; this.reproCooldown = rng.range(8, 24);
    this.hue = parent ? (parent.hue + rng.range(-14, 14) + 360) % 360 : (this.meta.hue + rng.range(-18, 18) + 360) % 360;
    this.morph = {
      segments: parent ? clamp(parent.morph.segments + (rng.next() < 0.12 ? rng.pick([-1, 1]) : 0), 2, 7) : rng.int(2, 6),
      legs: role === 'glider' ? 0 : parent ? parent.morph.legs : rng.pick([2, 4, 6]),
      fins: role === 'glider' ? rng.int(2, 4) : rng.int(0, 2),
      horns: role === 'hunter' || role === 'lurker' ? rng.int(1, 3) : rng.int(0, 1),
      eyes: rng.int(1, 4), tail: rng.range(0.7, 1.7)
    };
    this.tail = Array.from({ length: 7 }, () => ({ x, y }));
    this.name = `${rng.pick(['Vex','Mira','Thorn','Oro','Nyx','Silt','Axi','Khe','Lum','Rift'])}${rng.pick(['ling','maw','fin','claw','wisp','drift','shell','stalker'])}-${this.id % 1000}`;
  }
}

export class World {
  constructor(seed = (Date.now() >>> 0)) {
    this.seed = seed;
    this.rng = new RNG(seed);
    this.map = new TileMap(seed, this.rng);
    this.creatures = [];
    this.carcasses = [];
    this.particles = [];
    this.time = 0;
    this.cycle = 1;
    this.rainClock = 0;
    this.clearDuration = 145;
    this.warningDuration = 28;
    this.rainDuration = 36;
    this.rainPhase = 'clear';
    this.rainIntensity = 0;
    this.floodY = WORLD_H + 200;
    this.points = Number(localStorageSafe('fw_points', '0')) || 0;
    this.bucks = Number(localStorageSafe('fw_bucks', '0')) || 0;
    this.bestCycle = Number(localStorageSafe('fw_best_cycle', '1')) || 1;
    this.message = 'Find food. Reach a den before the fracture rain.';
    this.messageTime = 6;
    this.paused = false;
    this.gameOver = false;
    const start = this.map.dens[0];
    this.player = new Creature(this, 'nibbler', start.x, start.y - 30, null, true);
    this.creatures.push(this.player);
    this.spawnEcology();
  }
  spawnEcology() {
    const counts = { nibbler: 24, skitter: 18, carrion: 12, hunter: 9, glider: 10, lurker: 5 };
    for (const [role, count] of Object.entries(counts)) for (let i = 0; i < count; i++) {
      const tx = this.rng.int(20, MAP_W - 5), y = (this.map.findFloor(tx) - 1.2) * TILE;
      this.creatures.push(new Creature(this, role, tx * TILE, y));
    }
  }
  toast(text, sec = 3) { this.message = text; this.messageTime = sec; }
  addPoints(gp = 0, gb = 0) {
    this.points += gp; this.bucks += gb;
    saveLocal('fw_points', this.points); saveLocal('fw_bucks', this.bucks);
  }
  tileCollision(c, dt) {
    c.grounded = false; c.wall = 0; c.onVine = false;
    const r = c.r * 0.72;
    c.x += c.vx * dt;
    let minX = Math.floor((c.x - r) / TILE), maxX = Math.floor((c.x + r) / TILE);
    let minY = Math.floor((c.y - r) / TILE), maxY = Math.floor((c.y + r) / TILE);
    for (let ty = minY; ty <= maxY; ty++) for (let tx = minX; tx <= maxX; tx++) if (this.map.get(tx, ty) === 1) {
      const left = tx * TILE, right = left + TILE;
      if (c.vx > 0 && c.x + r > left && c.x < left) { c.x = left - r; c.vx = 0; c.wall = 1; }
      else if (c.vx < 0 && c.x - r < right && c.x > right) { c.x = right + r; c.vx = 0; c.wall = -1; }
    }
    c.y += c.vy * dt;
    minX = Math.floor((c.x - r) / TILE); maxX = Math.floor((c.x + r) / TILE);
    minY = Math.floor((c.y - r) / TILE); maxY = Math.floor((c.y + r) / TILE);
    for (let ty = minY; ty <= maxY; ty++) for (let tx = minX; tx <= maxX; tx++) if (this.map.get(tx, ty) === 1) {
      const top = ty * TILE, bottom = top + TILE;
      if (c.vy > 0 && c.y + r > top && c.y < top) { c.y = top - r; c.vy = 0; c.grounded = true; }
      else if (c.vy < 0 && c.y - r < bottom && c.y > bottom) { c.y = bottom + r; c.vy = 0; }
    }
    for (const v of this.map.vines) if (Math.abs(c.x - v.x) < 18 && c.y > v.y1 && c.y < v.y2) { c.onVine = true; break; }
    c.x = clamp(c.x, c.r, WORLD_W - c.r);
    if (c.y > WORLD_H + 120) this.kill(c, 'fell into the abyss');
  }
  nearest(c, predicate, maxDist = 520) {
    let best = null, bd = maxDist * maxDist;
    for (const o of this.creatures) {
      if (o === c || o.dead || !predicate(o)) continue;
      const dx = o.x - c.x, dy = o.y - c.y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }
  nearestFood(c, maxDist = 650) {
    let best = null, bd = maxDist * maxDist;
    for (const f of this.map.food) if (f.alive) {
      const dx = f.x - c.x, dy = f.y - c.y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = f; }
    }
    return best;
  }
  nearestDen(c) {
    let best = this.map.dens[0], bd = Infinity;
    for (const d of this.map.dens) { const q = (d.x - c.x) ** 2 + (d.y - c.y) ** 2; if (q < bd) { bd = q; best = d; } }
    return best;
  }
  inDen(c) { const d = this.nearestDen(c); return Math.hypot(d.x - c.x, d.y - c.y) < d.r; }
  updateAI(c, dt) {
    c.aiClock -= dt;
    if (c.aiClock > 0) return;
    c.aiClock = 0.11 + this.rng.range(0, 0.06);
    const rain = this.rainPhase !== 'clear';
    let target = null, threat = null;
    if (rain) {
      target = this.nearestDen(c); c.ai.mode = 'shelter';
    } else if (c.meta.predator) {
      target = this.nearest(c, o => !o.meta.predator && o.r < c.r * 1.45, 720);
      c.ai.mode = target ? (c.role === 'lurker' && Math.abs(target.x - c.x) > 160 ? 'ambush' : 'hunt') : 'prowl';
    } else {
      threat = this.nearest(c, o => o.meta.predator && o.r > c.r * 0.65, 420 * c.meta.fear);
      if (threat) { target = threat; c.ai.mode = 'flee'; }
      else if (c.role === 'carrion' && this.carcasses.length) {
        target = this.carcasses.reduce((a, b) => ((a.x-c.x)**2+(a.y-c.y)**2) < ((b.x-c.x)**2+(b.y-c.y)**2) ? a : b); c.ai.mode = 'scavenge';
      } else { target = this.nearestFood(c); c.ai.mode = target ? 'forage' : 'wander'; }
    }
    c.ai.target = target;
    const dx = target ? target.x - c.x : Math.sin(this.time * 0.6 + c.id) * 100;
    const dy = target ? target.y - c.y : 0;
    const input = new Float32Array([
      clamp(dx / 480, -1, 1), clamp(dy / 320, -1, 1), threat ? 1 : 0,
      c.energy, this.rainIntensity, c.grounded ? 1 : 0, c.wall, this.rng.range(-1, 1)
    ]);
    const out = c.brain.run(input);
    let move = clamp(out[0] + sign(dx) * 0.8, -1, 1);
    if (c.ai.mode === 'flee') move = -sign(dx);
    if (c.ai.mode === 'ambush' && Math.abs(dx) > 150) move *= 0.22;
    c.ai.x = move;
    c.ai.jump = (dy < -50 || Math.abs(dx) > 80 && c.wall !== 0) && out[1] > -0.35;
    c.ai.grab = out[2] > 0.15 || c.ai.mode === 'shelter';
    c.ai.bite = c.meta.predator && target && Math.hypot(dx, dy) < c.r + target.r + 12;
  }
  movement(c, control, dt) {
    const meta = c.meta;
    c.attackCooldown = Math.max(0, c.attackCooldown - dt);
    c.reproCooldown = Math.max(0, c.reproCooldown - dt);
    c.age += dt;
    let ax = control.x * 980 * meta.speed;
    if (!c.grounded) ax *= 0.56;
    if (c.role === 'glider') {
      c.vy += 280 * dt;
      if (control.jump) c.vy -= 650 * dt;
    } else c.vy += 1280 * dt;
    if (c.onVine && control.grab) { c.vy *= 0.75; c.vy += (control.y || 0) * 480 * dt; }
    if (c.wall && control.grab) { c.vy = Math.min(c.vy, 75); if (control.y) c.vy = control.y * 105; }
    c.vx += ax * dt;
    const maxSpeed = (control.dash ? 360 : 245) * meta.speed;
    c.vx = clamp(c.vx, -maxSpeed, maxSpeed);
    if (Math.abs(control.x) < 0.05 && c.grounded) c.vx *= Math.pow(0.001, dt);
    if (control.jump && (c.grounded || c.wall || c.onVine)) { c.vy = -450; c.vx += (c.wall ? -c.wall : control.x) * 90; }
    if (control.x) c.facing = sign(control.x);
    this.tileCollision(c, dt);
    const moveCost = (Math.abs(c.vx) / 300 + Math.abs(c.vy) / 500) * 0.006;
    c.energy -= dt * (0.0022 + moveCost + (control.dash ? 0.012 : 0));
    if (control.bite) this.bite(c);
    this.eatFood(c);
    if (c.energy > 0.88 && c.reproCooldown <= 0 && !c.isPlayer && this.creatures.length < 105 && this.rng.next() < dt * 0.08) {
      const child = new Creature(this, c.role, c.x + this.rng.range(-18, 18), c.y - 12, c);
      child.energy = 0.42; c.energy -= 0.28; c.reproCooldown = 22;
      this.creatures.push(child);
    }
    if (c.energy <= 0) this.kill(c, 'starved');
    if (c.health <= 0) this.kill(c, 'was consumed');
    if (c.age > 240) this.kill(c, 'aged out');
    for (let i = c.tail.length - 1; i > 0; i--) {
      const prev = c.tail[i - 1], t = c.tail[i];
      t.x = lerp(t.x, prev.x, 0.55); t.y = lerp(t.y, prev.y, 0.55);
    }
    c.tail[0].x = lerp(c.tail[0].x, c.x - c.facing * c.r * 0.75, 0.72);
    c.tail[0].y = lerp(c.tail[0].y, c.y + c.r * 0.1, 0.72);
  }
  bite(c) {
    if (c.attackCooldown > 0) return;
    c.attackCooldown = 0.55;
    const reachX = c.x + c.facing * (c.r + 18);
    let victim = null, bd = 42 * 42;
    for (const o of this.creatures) if (o !== c && !o.dead) {
      const d = (o.x - reachX) ** 2 + (o.y - c.y) ** 2;
      if (d < bd) { bd = d; victim = o; }
    }
    if (victim) {
      const damage = c.meta.predator ? 0.38 : 0.16;
      victim.health -= damage; victim.vx += c.facing * 210; victim.vy -= 80;
      c.energy = Math.min(1, c.energy + damage * 0.2);
      if (c.isPlayer) this.addPoints(2, 0);
    }
  }
  eatFood(c) {
    for (const f of this.map.food) if (f.alive && Math.abs(f.x - c.x) < c.r + 13 && Math.abs(f.y - c.y) < c.r + 18) {
      f.alive = false; f.regrow = 45 + this.rng.range(0, 80);
      c.energy = Math.min(1, c.energy + (f.kind ? 0.28 : 0.18));
      if (c.isPlayer) { c.food = Math.min(7, c.food + 1); this.addPoints(1, 0); this.toast(`Food ${c.food}/4 — find a den before rain.`); }
      break;
    }
  }
  kill(c, reason) {
    if (c.dead) return;
    c.dead = true;
    this.carcasses.push({ x: c.x, y: c.y, mass: c.r * 0.06 + 0.5, hue: c.hue, age: 0 });
    if (c.isPlayer) { this.gameOver = true; this.toast(`You ${reason}. Tap RESPAWN.`, 99); }
  }
  respawn() {
    const den = this.map.dens[0];
    const replacement = new Creature(this, 'nibbler', den.x, den.y - 30, this.player, true);
    replacement.food = 0;
    this.player = replacement;
    this.creatures.push(replacement);
    this.gameOver = false;
    this.rainPhase = 'clear'; this.rainClock = 0; this.rainIntensity = 0; this.floodY = WORLD_H + 200;
    this.toast('New body grown from the den memory.');
  }
  updateRain(dt) {
    this.rainClock += dt;
    if (this.rainPhase === 'clear') {
      this.rainIntensity = 0;
      if (this.rainClock >= this.clearDuration) { this.rainClock = 0; this.rainPhase = 'warning'; this.toast('The sky is cracking. Find a den.', 8); }
    } else if (this.rainPhase === 'warning') {
      this.rainIntensity = clamp(this.rainClock / this.warningDuration, 0, 0.35);
      if (this.rainClock >= this.warningDuration) { this.rainClock = 0; this.rainPhase = 'rain'; this.toast('FRACTURE RAIN — GET UNDERGROUND!', 8); }
    } else if (this.rainPhase === 'rain') {
      this.rainIntensity = clamp(this.rainClock / 5, 0, 1);
      this.floodY = lerp(WORLD_H + 100, WORLD_H * 0.62, clamp(this.rainClock / this.rainDuration, 0, 1));
      for (const c of this.creatures) if (!c.dead && !this.inDen(c)) {
        if (c.y > this.floodY) { c.vy -= 480 * dt; c.health -= 0.12 * dt; }
        c.health -= this.rainIntensity * 0.018 * dt;
      }
      if (this.rainClock >= this.rainDuration) this.finishCycle();
    }
  }
  finishCycle() {
    const survived = !this.player.dead && this.inDen(this.player) && this.player.food >= 4;
    if (survived) {
      this.cycle++;
      this.bestCycle = Math.max(this.bestCycle, this.cycle);
      saveLocal('fw_best_cycle', this.bestCycle);
      this.addPoints(25, this.cycle % 3 === 0 ? 1 : 0);
      this.player.food = Math.max(0, this.player.food - 4);
      this.player.health = 1; this.player.energy = 1;
      this.toast(`Cycle ${this.cycle}. The ecosystem remembers what survived.`, 7);
    } else if (!this.player.dead) {
      this.kill(this.player, this.player.food < 4 ? 'entered the den without enough food' : 'missed the shelter window');
    }
    this.rainPhase = 'clear'; this.rainClock = 0; this.rainIntensity = 0; this.floodY = WORLD_H + 200;
    for (const f of this.map.food) if (!f.alive && this.rng.next() < 0.65) { f.alive = true; f.regrow = 0; }
  }
  step(dt, playerInput) {
    if (this.paused) return;
    this.time += dt;
    if (this.messageTime > 0) this.messageTime -= dt;
    this.updateRain(dt);
    for (const f of this.map.food) if (!f.alive) { f.regrow -= dt; if (f.regrow <= 0) f.alive = true; }
    const snapshot = [...this.creatures];
    for (const c of snapshot) {
      if (c.dead) continue;
      let control;
      if (c.isPlayer) control = playerInput;
      else { this.updateAI(c, dt); control = { x: c.ai.x, y: c.ai.target ? sign(c.ai.target.y - c.y) : 0, jump: c.ai.jump, grab: c.ai.grab, bite: c.ai.bite, dash: c.ai.mode === 'flee' || c.ai.mode === 'hunt' }; }
      this.movement(c, control, dt);
    }
    this.creatures = this.creatures.filter(c => !c.dead || c.isPlayer);
    for (const carc of this.carcasses) { carc.age += dt; carc.mass -= dt * 0.005; }
    for (const c of this.creatures) if (!c.dead && c.role === 'carrion') {
      let best = null, bd = 100 * 100;
      for (const carc of this.carcasses) { const q = (carc.x - c.x) ** 2 + (carc.y - c.y) ** 2; if (q < bd) { bd = q; best = carc; } }
      if (best && best.mass > 0) { const bite = Math.min(best.mass, dt * 0.08); best.mass -= bite; c.energy = Math.min(1, c.energy + bite * 0.5); }
    }
    this.carcasses = this.carcasses.filter(c => c.mass > 0 && c.age < 120);
    if (this.creatures.filter(c => !c.isPlayer && !c.dead).length < 50 && this.rng.next() < dt * 0.3) {
      const role = this.rng.pick(Object.keys(ROLE)), tx = this.rng.int(20, MAP_W - 5);
      this.creatures.push(new Creature(this, role, tx * TILE, (this.map.findFloor(tx) - 1.2) * TILE));
    }
  }
  rainRemaining() {
    if (this.rainPhase === 'clear') return this.clearDuration - this.rainClock + this.warningDuration;
    if (this.rainPhase === 'warning') return this.warningDuration - this.rainClock;
    return this.rainDuration - this.rainClock;
  }
  stats() {
    const counts = {};
    for (const c of this.creatures) if (!c.dead) counts[c.role] = (counts[c.role] || 0) + 1;
    return { population: this.creatures.filter(c => !c.dead).length, cycle: this.cycle, bestCycle: this.bestCycle, rainPhase: this.rainPhase, rainRemaining: this.rainRemaining(), points: this.points, bucks: this.bucks, counts };
  }
}

function localStorageSafe(key, fallback) {
  try { return typeof localStorage !== 'undefined' ? localStorage.getItem(key) ?? fallback : fallback; } catch { return fallback; }
}
function saveLocal(key, value) { try { if (typeof localStorage !== 'undefined') localStorage.setItem(key, String(value)); } catch {} }
