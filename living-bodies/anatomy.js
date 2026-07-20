import { WORLD_W, clamp, lerp, sign } from './core.js?v=9';

export const anatomyMethods = {
  damagePoint(c, point, amount, fractureChance = 0.2) {
    point.health = clamp(point.health - amount, 0, 1);
    point.tissue = clamp(point.tissue - amount * 0.6, 0, 1);
    if (this.rng.chance(fractureChance * this.settings.injury / 10)) point.fracture = clamp(point.fracture + amount * 1.5, 0, 1);
    c.pain = clamp(c.pain + amount * 0.7, 0, 1);
    c.blood = clamp(c.blood - amount * 0.08, 0, 1);
    this.injuries++;
  },

  updateAnatomy(c, desiredX, desiredY, dt) {
    const core = c.points[0];
    core.px = core.x; core.py = core.y;
    const muscleHealth = c.muscles.reduce((s, m) => s + m.health, 0) / c.muscles.length;
    const painPenalty = 1 - c.pain * 0.48, fatiguePenalty = 1 - c.fatigue * 0.42;
    const speed = 210 * c.meta.speed * c.genes.speed * muscleHealth * painPenalty * fatiguePenalty;
    const freeze = c.mode === 'freeze' || c.freezeClock > 0;
    const desiredVx = freeze ? 0 : sign(desiredX - c.x) * speed * (c.mode === 'flee' || c.mode.includes('hunt') ? 1.22 : 1);
    c.vx = lerp(c.vx, desiredVx, clamp(dt * (c.grounded ? 3.8 : 1.4), 0, 1));
    c.facing = Math.abs(c.vx) > 2 ? sign(c.vx) : c.facing;
    const climate = this.climateAt(c.x);
    if (c.meta.flyer) {
      const flyY = clamp(desiredY - 110, 180, this.terrainY(c.x) - 90);
      c.vy += (flyY - c.y) * dt * 2.1 + climate.wind * dt * 0.28;
    } else {
      c.vy += 980 * dt;
      const slope = this.terrainSlope(c.x);
      if (c.grounded && !freeze && (Math.abs(slope) > 0.28 || desiredY < c.y - 55) && this.rng.chance(0.035)) c.vy = -260 * clamp(c.genes.speed, 0.7, 1.5);
    }
    for (const f of this.forceFields) {
      const dx = f.x - c.x, dy = f.y - c.y, d = Math.hypot(dx, dy) || 1;
      if (d < f.radius) { const q = (1 - d / f.radius) * f.strength; c.vx += dx / d * q * dt; c.vy += dy / d * q * dt; }
    }
    c.x = clamp(c.x + c.vx * dt, c.r, WORLD_W - c.r);
    c.y += c.vy * dt;
    const floor = this.terrainY(c.x) - c.r * 0.56;
    c.grounded = false;
    if (c.y > floor) {
      const impact = Math.max(0, c.vy);
      c.y = floor; c.vy *= -0.04; c.grounded = true;
      if (impact > 330) {
        const amount = clamp((impact - 330) / 780, 0.04, 0.38) * this.settings.injury / 6;
        this.damagePoint(c, this.rng.pick(c.points), amount, 0.45);
        c.lastImpact = impact;
      }
    }
    core.x = lerp(core.x, c.x, clamp(dt * 16, 0, 1)); core.y = lerp(core.y, c.y, clamp(dt * 16, 0, 1));

    for (let i = 1; i < c.points.length; i++) {
      const p = c.points[i], vx = (p.x - p.px) * 0.91, vy = (p.y - p.py) * 0.91;
      p.px = p.x; p.py = p.y; p.x += vx + climate.wind * dt * dt * (c.meta.flyer ? 2.2 : 0.15); p.y += vy + 760 * dt * dt;
      const ground = this.terrainY(p.x) - 2;
      if (p.y > ground) { p.y = ground; p.py = lerp(p.py, p.y, 0.35); }
    }

    const gait = this.time * (4 + Math.abs(c.vx) / 55) + c.id;
    for (const limb of c.limbs) {
      const anchor = c.points[limb.anchor], upper = c.points[limb.upper], foot = c.points[limb.foot];
      const limbPain = 1 - limb.health * 0.45 - limb.fracture * 0.65;
      const step = Math.sin(gait + limb.phase);
      const targetX = anchor.x + c.facing * (step * c.r * 0.85 + c.r * 0.18) * (1 - limbPain);
      const ground = this.terrainY(targetX) - 2;
      const targetY = c.meta.flyer ? anchor.y + Math.sin(gait * 1.7 + limb.phase) * c.r * 0.8 : ground;
      const grip = c.grounded && Math.abs(foot.y - ground) < 9 && step < 0.25 && limb.fracture < 0.72;
      limb.planted = grip; limb.grip = lerp(limb.grip, grip ? c.genes.grip : 0, 0.22);
      if (!grip) { foot.x = lerp(foot.x, targetX, clamp(dt * 5.5, 0, 1)); foot.y = lerp(foot.y, targetY - Math.max(0, step) * c.r * 0.55, clamp(dt * 5.5, 0, 1)); }
      upper.x = lerp(upper.x, (anchor.x + foot.x) * 0.5 + limb.side * c.r * 0.18, clamp(dt * 5, 0, 1));
      upper.y = lerp(upper.y, (anchor.y + foot.y) * 0.5 - c.r * 0.12, clamp(dt * 5, 0, 1));
      limb.health = clamp(Math.min(c.points[limb.upper].health, c.points[limb.foot].health), 0, 1);
      limb.fracture = Math.max(c.points[limb.upper].fracture, c.points[limb.foot].fracture);
    }

    for (let pass = 0; pass < (this.settings.anatomy === 'full' ? 4 : 2); pass++) {
      for (const m of c.muscles) {
        const a = c.points[m.a], b = c.points[m.b], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
        const active = m.limb ? 1 - m.limb.fracture * 0.8 : 1;
        const target = m.rest * (1 + (m.limb ? Math.sin(gait + m.limb.phase) * 0.06 : 0));
        const q = (d - target) / d * m.strength * active * m.health * 0.5;
        const wa = 1 / (a.mass + b.mass), wb = a.mass * wa, wa2 = b.mass * wa;
        a.x += dx * q * wa2; a.y += dy * q * wa2; b.x -= dx * q * wb; b.y -= dy * q * wb;
      }
    }
    c.x = core.x; c.y = core.y;
  },

  updatePhysiology(c, dt) {
    const climate = this.climateAt(c.x), activity = clamp(Math.abs(c.vx) / 260 + Math.abs(c.vy) / 420, 0, 2);
    const metabolic = 0.0011 * c.genes.metabolism * (1 + activity * 0.65 + c.pain * 0.4);
    c.energy = clamp(c.energy - dt * metabolic, 0, 1);
    const drinking = c.mode === 'seek-water' && c.grounded ? Math.max(0, climate.moisture - 0.58) * 0.012 : 0;
    c.hydration = clamp(c.hydration - dt * (0.00055 + Math.max(0, climate.temperature - 25) * 0.000035) / c.genes.hydration + climate.rain * dt * 0.0018 + drinking * dt, 0, 1);
    const oxygenDemand = clamp(0.78 + activity * 0.13 + c.pain * 0.08, 0.7, 1.1);
    const oxygenTarget = clamp(climate.oxygen * c.organs.lungs / oxygenDemand, 0.35, 1);
    c.oxygen = lerp(c.oxygen, oxygenTarget, clamp(dt * 0.6, 0, 1));
    const targetTemp = climate.temperature + activity * 4 + (c.meta.flyer ? -1.5 : 0);
    c.bodyTemp = lerp(c.bodyTemp, targetTemp, dt * 0.05 / c.genes.thermal);
    const thermalStress = Math.max(0, Math.abs(c.bodyTemp - 23) - 9) / 14;
    c.stress = clamp(c.stress + dt * (thermalStress * 0.08 + c.pain * 0.05 + climate.toxin * 0.06) - dt * 0.012 * c.genes.social, 0, 1);
    c.fatigue = clamp(c.fatigue + dt * activity * 0.012 - dt * (c.mode === 'recover' || c.mode === 'freeze' ? 0.04 : 0.008), 0, 1);
    const bleed = c.points.reduce((s, p) => s + Math.max(0, 1 - p.tissue) * 0.00016, 0);
    c.blood = clamp(c.blood - bleed * dt, 0, 1);
    const heal = dt * 0.0022 * c.genes.healing * c.energy * c.hydration;
    if (c.pain > 0) c.pain = Math.max(0, c.pain - heal * 0.7);
    for (const p of c.points) {
      const before = p.health; p.health = clamp(p.health + heal, 0, 1); p.tissue = clamp(p.tissue + heal * 0.55, 0, 1); p.fracture = Math.max(0, p.fracture - heal * 0.18);
      if (before < 0.99 && p.health >= 0.99) this.healedInjuries++;
    }
    for (const o of Object.keys(c.organs)) c.organs[o] = clamp(c.organs[o] + heal * 0.15, 0, 1);
    c.health = clamp((c.blood * 0.24 + c.oxygen * 0.2 + c.organs.brain * 0.22 + c.organs.heart * 0.18 + c.organs.lungs * 0.16) - thermalStress * 0.08, 0, 1);
    if (c.energy <= 0 || c.hydration <= 0 || c.blood <= 0.08 || c.oxygen <= 0.05 || c.health <= 0.02 || c.age > 520 / c.genes.metabolism) this.kill(c);
  }

};