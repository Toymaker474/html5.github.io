import { WORLD_W, clamp, lerp, sign, Creature, Plant } from './core.js?v=9';

export const behaviorMethods = {
  rebuildHashes() {
    this.creatureHash.clear(); this.plantHash.clear();
    for (const c of this.creatures) if (!c.dead) this.creatureHash.add(c);
    for (const p of this.plants) if (!p.dead) this.plantHash.add(p);
  },

  nearestCreature(c, predicate, radius) {
    let best = null, bd = radius * radius;
    for (const o of this.creatureHash.query(c.x, c.y, radius)) {
      if (o === c || o.dead || !predicate(o)) continue;
      const d = (o.x - c.x) ** 2 + (o.y - c.y) ** 2;
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  },

  nearestPlant(c, radius = 760) {
    let best = null, score = -Infinity;
    for (const p of this.plantHash.query(c.x, c.y, radius)) {
      if (p.dead || p.health <= 0.05) continue;
      const d = Math.hypot(p.x - c.x, p.y - c.y);
      if (d > radius) continue;
      const s = p.sugar * 1.4 + p.water * 0.7 - d / radius - p.toxin * 0.6;
      if (s > score) { score = s; best = p; }
    }
    return best;
  },

  nearestCarcass(c, radius = 740) {
    let best = null, bd = radius * radius;
    for (const o of this.carcasses) {
      const d = (o.x - c.x) ** 2 + (o.y - c.y) ** 2;
      if (d < bd && o.mass > 0.05) { bd = d; best = o; }
    }
    return best;
  },

  chooseBehavior(c) {
    c.thinkClock = 0.08 + this.rng.range(0.02, 0.12) + (this.settings.device === 'iphone' ? 0.04 : 0);
    const vision = 460 * c.genes.vision;
    const threat = this.nearestCreature(c, o => o.meta.predator && (!c.meta.predator || o.r > c.r * 1.25), vision);
    const prey = c.meta.predator ? this.nearestCreature(c, o => !o.meta.predator && o.r < c.r * 1.45, vision * 1.35) : null;
    const friend = this.nearestCreature(c, o => o.kind === c.kind, vision * 0.85);
    const carcass = (c.meta.scavenger || c.meta.predator) ? this.nearestCarcass(c, vision * 1.25) : null;
    const plant = !c.meta.predator ? this.nearestPlant(c, vision * 1.3) : null;
    const climate = this.climateAt(c.x);

    if (c.observed && c.genes.observationFear > 0.95 && this.settings.creepy >= 4) {
      c.mode = 'freeze'; c.target = null; c.freezeClock = Math.max(c.freezeClock, 0.3 + c.genes.observationFear * 0.35); return;
    }
    if (threat && !c.meta.predator) { c.mode = 'flee'; c.target = threat; c.remember('danger', threat.x, threat.y, 1.2); return; }
    if (c.pain > 0.45 || c.blood < 0.55) { c.mode = 'recover'; c.target = null; return; }
    if (c.hydration < 0.28) { c.mode = 'seek-water'; c.target = null; return; }
    if (Math.abs(c.bodyTemp - 22) > 9) { c.mode = c.bodyTemp > 22 ? 'seek-cool' : 'seek-warm'; c.target = null; return; }
    if (c.meta.predator && prey && c.energy < 0.82) { c.mode = c.kind === 'mimic' && c.genes.mimicry > 1 ? 'mimic-hunt' : 'hunt'; c.target = prey; c.remember('prey', prey.x, prey.y); return; }
    if (carcass && c.energy < 0.72) { c.mode = 'scavenge'; c.target = carcass; return; }
    if (plant && c.energy < 0.76) { c.mode = 'forage'; c.target = plant; c.remember('food', plant.x, plant.y); return; }
    if (friend && c.genes.social > 0.9 && c.stress > 0.2) { c.mode = 'group'; c.target = friend; return; }
    c.mode = climate.toxin > 0.35 ? 'escape-toxin' : 'wander';
    c.target = null;
    if (this.rng.chance(0.18)) c.remember('wander', clamp(c.x + this.rng.range(-700, 700), 50, WORLD_W - 50), this.terrainY(c.x), 0.4);
  },

  targetPoint(c) {
    if (c.target) return { x: c.target.x, y: c.target.y };
    if (c.mode === 'seek-water') {
      let best = this.climateAt(c.x), bx = c.x;
      for (let i = 0; i < this.climate.length; i += 3) if (this.climate[i].moisture > best.moisture) { best = this.climate[i]; bx = best.x; }
      return { x: bx, y: this.terrainY(bx) };
    }
    if (c.mode === 'seek-cool' || c.mode === 'seek-warm' || c.mode === 'escape-toxin') {
      let bestScore = c.mode === 'seek-warm' ? -Infinity : Infinity, bx = c.x;
      for (let i = 0; i < this.climate.length; i += 4) {
        const q = this.climate[i], score = c.mode === 'escape-toxin' ? q.toxin : q.temperature;
        if ((c.mode === 'seek-warm' && score > bestScore) || (c.mode !== 'seek-warm' && score < bestScore)) { bestScore = score; bx = q.x; }
      }
      return { x: bx, y: this.terrainY(bx) };
    }
    const mem = [...c.memory].sort((a, b) => b.weight - a.weight)[0];
    return mem ? { x: mem.x, y: mem.y } : { x: clamp(c.x + Math.sin(this.time * 0.3 + c.id) * 320, 40, WORLD_W - 40), y: this.terrainY(c.x) };
  },

  attack(attacker, victim) {
    if (attacker.attackClock > 0 || victim.dead) return;
    attacker.attackClock = 0.65;
    const reach = attacker.r + victim.r + 18;
    if (Math.hypot(victim.x - attacker.x, victim.y - attacker.y) > reach) return;
    const point = this.rng.pick(victim.points), damage = (attacker.kind === 'maw' ? 0.34 : 0.22) * attacker.genes.aggression;
    this.damagePoint(victim, point, damage, 0.35);
    victim.health = clamp(victim.health - damage * 0.38, 0, 1);
    victim.vx += sign(victim.x - attacker.x) * 150; victim.vy -= 65;
    attacker.energy = clamp(attacker.energy + damage * 0.24, 0, 1);
    this.effect('bite', victim.x, victim.y, victim.hue, 0.8);
  },

  eat(c) {
    if (c.meta.predator && c.target instanceof Creature && !c.target.dead) { this.attack(c, c.target); return; }
    if ((c.meta.predator || c.meta.scavenger) && c.target && c.target.carcass) {
      const q = c.target; if (Math.hypot(q.x - c.x, q.y - c.y) < c.r + 24) { const bite = Math.min(q.mass, 0.045); q.mass -= bite; c.energy = clamp(c.energy + bite * 0.65, 0, 1); c.hydration = clamp(c.hydration + bite * 0.12, 0, 1); }
      return;
    }
    if (!c.meta.predator && c.target instanceof Plant) {
      const p = c.target; if (!p.dead && Math.abs(p.x - c.x) < c.r + p.crown) { const bite = Math.min(p.sugar, 0.035); p.sugar -= bite; p.health = clamp(p.health - 0.003, 0, 1); c.energy = clamp(c.energy + bite * 1.4, 0, 1); c.hydration = clamp(c.hydration + p.water * 0.018, 0, 1); if (p.toxin > 0.45) c.stress = clamp(c.stress + p.toxin * 0.04, 0, 1); }
    }
  },

  reproduce(c, dt) {
    c.reproClock -= dt;
    if (c.reproClock > 0 || c.energy < 0.74 || c.health < 0.66 || c.stress > 0.62 || this.creatures.length >= this.maxPopulation) return;
    if (!this.rng.chance(dt * 0.035 * c.genes.fertility)) return;
    const mate = this.nearestCreature(c, o => o.kind === c.kind && o.energy > 0.72 && o.health > 0.7, 180);
    if (!mate) return;
    const child = new Creature(this, c.kind, clamp((c.x + mate.x) * 0.5 + this.rng.range(-20, 20), 30, WORLD_W - 30), this.terrainY(c.x) - c.r, this.rng.chance(0.5) ? c : mate);
    child.energy = 0.48; c.energy -= 0.17; mate.energy -= 0.12; c.reproClock = this.rng.range(45, 95); mate.reproClock = this.rng.range(35, 85); this.creatures.push(child); this.births++; this.effect('birth', child.x, child.y, child.hue, 1.1);
  },

  kill(c) {
    if (c.dead) return;
    c.dead = true; this.deaths++;
    this.carcasses.push({ carcass: true, x: c.x, y: c.y, mass: c.mass * 1.8, hue: c.hue, age: 0, toxin: this.climateAt(c.x).toxin * 0.2, name: c.name });
    this.effect('death', c.x, c.y, c.hue, 1.4);
    if (this.observedId === c.id) this.observedId = null;
  },

  updateCreature(c, dt) {
    if (c.dead) return;
    c.age += dt; c.attackClock = Math.max(0, c.attackClock - dt); c.freezeClock = Math.max(0, c.freezeClock - dt);
    c.observed = c.id === this.observedId;
    for (const m of c.memory) { m.age += dt; m.weight *= Math.pow(0.995, dt); }
    c.memory = c.memory.filter(m => m.age < 180 && m.weight > 0.08);
    c.thinkClock -= dt;
    if (c.thinkClock <= 0) this.chooseBehavior(c);
    const target = this.targetPoint(c);
    let tx = target.x, ty = target.y;
    if (c.mode === 'flee' && c.target) { tx = clamp(c.x - (c.target.x - c.x), 30, WORLD_W - 30); ty = this.terrainY(tx); }
    if (c.mode === 'group' && c.target) tx = lerp(c.x, c.target.x, 0.45);
    if (c.mode === 'recover') tx = c.x + Math.sin(c.id) * 18;
    this.updateAnatomy(c, tx, ty, dt);
    this.updatePhysiology(c, dt);
    this.eat(c);
    this.reproduce(c, dt);
  }

};
