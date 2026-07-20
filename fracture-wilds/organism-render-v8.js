import { TILE, MAP_W, MAP_H, WORLD_W, TAU, BIOMES, clamp, lerp, hash2 } from './organism-core-v8.js';

export const QUALITY = {
  low: { dpr: 1, stars: 20, motes: 16, rain: 44, fog: 0, creatureDetail: 0, plantDetail: 0, terrainDecor: 0, glow: 0 },
  medium: { dpr: 1.3, stars: 52, motes: 36, rain: 90, fog: 1, creatureDetail: 1, plantDetail: 1, terrainDecor: 1, glow: 7 },
  high: { dpr: 1.65, stars: 88, motes: 64, rain: 160, fog: 2, creatureDetail: 2, plantDetail: 2, terrainDecor: 2, glow: 12 },
  ultra: { dpr: 2.05, stars: 132, motes: 96, rain: 235, fog: 3, creatureDetail: 3, plantDetail: 3, terrainDecor: 3, glow: 18 }
};

class TerrainCache {
  constructor(renderer) { this.renderer = renderer; this.chunks = new Map(); this.tiles = 10; }
  clear() { this.chunks.clear(); }
  get(cx, cy) {
    const r = this.renderer, world = r.world, size = this.tiles * TILE;
    const biomeIndex = world.map.roomAt((cx * this.tiles + this.tiles * 0.5) * TILE);
    const key = `${world.seed}:${r.tier}:${cx}:${cy}:${biomeIndex}`;
    if (this.chunks.has(key)) return this.chunks.get(key);
    const out = document.createElement('canvas'); out.width = out.height = size;
    const c = out.getContext('2d'), biome = BIOMES[biomeIndex], detail = r.settings.terrainDecor;
    for (let ly = 0; ly < this.tiles; ly++) for (let lx = 0; lx < this.tiles; lx++) {
      const tx = cx * this.tiles + lx, ty = cy * this.tiles + ly, tile = world.map.get(tx, ty);
      const x = lx * TILE, y = ly * TILE, n = hash2(tx, ty, world.seed);
      if (tile === 1) {
        const depth = clamp((ty - world.map.surface[clamp(tx, 0, MAP_W - 1)]) / 18, 0, 1);
        const hue = biome.hue + (n - 0.5) * 24, light = 8 + (1 - depth) * 8 + n * 4;
        c.fillStyle = `hsl(${hue},${30 + n * 22}%,${light}%)`; c.fillRect(x, y, TILE + 1, TILE + 1);
        if (detail) {
          c.fillStyle = `hsla(${hue + 35},35%,${20 + n * 12}%,.24)`;
          for (let i = 0; i <= detail; i++) c.fillRect(x + hash2(tx + i * 9, ty, world.seed + 5) * TILE, y + hash2(tx, ty + i * 7, world.seed + 9) * TILE, 1 + n * 2, 1 + n * 2);
        }
        if (world.map.get(tx, ty - 1) !== 1) {
          const soil = c.createLinearGradient(0, y - 2, 0, y + TILE);
          soil.addColorStop(0, `hsla(${biome.hue + 38},78%,48%,.88)`);
          soil.addColorStop(.15, `hsla(${biome.hue + 8},55%,27%,.84)`);
          soil.addColorStop(.75, `hsla(${biome.hue - 12},40%,13%,.65)`);
          soil.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = soil; c.fillRect(x, y - 3, TILE, TILE);
          c.strokeStyle = `hsla(${biome.hue + 70},86%,68%,${.15 + n * .15})`; c.lineWidth = 1;
          for (let i = 0; i <= detail; i++) {
            const bx = x + 4 + hash2(tx + i, ty, world.seed + 23) * (TILE - 8), bh = 4 + hash2(tx, ty + i, world.seed + 27) * 10;
            c.beginPath(); c.moveTo(bx, y + 1); c.quadraticCurveTo(bx + (n - .5) * 5, y - bh * .5, bx + (n - .5) * 8, y - bh); c.stroke();
          }
        }
      } else if (tile === 2) {
        const g = c.createLinearGradient(0, y, 0, y + TILE);
        g.addColorStop(0, `hsla(${biome.hue + 45},90%,60%,.4)`); g.addColorStop(1, 'rgba(2,14,38,.9)');
        c.fillStyle = g; c.fillRect(x, y, TILE + 1, TILE + 1);
      }
    }
    this.chunks.set(key, out); if (this.chunks.size > 150) this.chunks.delete(this.chunks.keys().next().value);
    return out;
  }
}

export class Renderer {
  constructor(canvas, world, tier = 'medium') {
    this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!this.ctx) throw new Error('Canvas 2D unavailable');
    this.world = world; this.tier = tier; this.settings = QUALITY[tier] || QUALITY.medium;
    this.camera = { x: world.player.x, y: world.player.y, zoom: 1.08 };
    this.cache = new TerrainCache(this); this.visual = { stars: [], motes: [], fog: [] }; this.rebuild(); this.resize();
  }
  setWorld(world) { this.world = world; this.camera.x = world.player.x; this.camera.y = world.player.y; this.cache.clear(); }
  setTier(tier) { this.tier = QUALITY[tier] ? tier : 'medium'; this.settings = QUALITY[this.tier]; this.rebuild(); this.resize(); }
  rebuild() {
    this.visual.stars = Array.from({ length: this.settings.stars }, () => ({ x: Math.random(), y: Math.random(), z: Math.random(), a: Math.random() }));
    this.visual.motes = Array.from({ length: this.settings.motes }, () => ({ x: Math.random(), y: Math.random(), p: Math.random() * TAU, s: .5 + Math.random() * 2.4, h: 120 + Math.random() * 220 }));
    this.visual.fog = Array.from({ length: this.settings.fog }, () => ({ x: Math.random(), y: Math.random(), p: Math.random() * TAU, r: .25 + Math.random() * .4 }));
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect(), dpr = Math.min(this.settings.dpr, devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.floor(rect.width * dpr)); this.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); this.cache.clear();
  }
  toScreen(x, y) { return { x: (x - this.camera.x) * this.camera.zoom + innerWidth / 2, y: (y - this.camera.y) * this.camera.zoom + innerHeight / 2 }; }
  visible(p, pad = 120) { return p.x > -pad && p.x < innerWidth + pad && p.y > -pad && p.y < innerHeight + pad; }
  updateCamera(dt) {
    const p = this.world.player; if (!p || p.dead) return;
    const zoom = innerWidth < 760 ? (innerHeight < 520 ? 1 : 1.08) : 1.22;
    this.camera.zoom = lerp(this.camera.zoom, zoom, clamp(dt * 1.3, 0, 1));
    this.camera.x = lerp(this.camera.x, p.x + p.vx * .65 + p.facingVisual * 54, clamp(dt * 2.2, 0, 1));
    this.camera.y = lerp(this.camera.y, p.y - innerHeight * .07 + p.vy * .12, clamp(dt * 2, 0, 1));
  }
  background(now) {
    const c = this.ctx, w = innerWidth, h = innerHeight, world = this.world, biome = world.map.biomeAt(world.player.x), day = world.daylight;
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, `hsl(${biome.hue + 75 - day * 22},${40 + day * 20}%,${5 + day * 13}%)`);
    g.addColorStop(.56, `hsl(${biome.hue + 15},46%,${6 + day * 7}%)`); g.addColorStop(1, '#010306'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    const orbit = (world.time % world.dayLength) / world.dayLength, ox = w * (.08 + .84 * orbit), oy = h * (.53 - Math.sin(orbit * Math.PI) * .42);
    c.save(); c.globalCompositeOperation = 'screen'; const orb = c.createRadialGradient(ox, oy, 0, ox, oy, day > .3 ? 120 : 75);
    orb.addColorStop(0, day > .3 ? 'rgba(255,245,190,.9)' : 'rgba(170,195,255,.78)'); orb.addColorStop(.22, day > .3 ? 'rgba(255,174,90,.25)' : 'rgba(100,120,255,.2)'); orb.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = orb; c.beginPath(); c.arc(ox, oy, day > .3 ? 120 : 75, 0, TAU); c.fill(); c.restore();
    const starAlpha = clamp(1 - day * 1.55, 0, 1);
    for (const s of this.visual.stars) { const x = (s.x * w - this.camera.x * .012 * s.z + w * 3) % w, y = s.y * h * .72; c.fillStyle = `rgba(190,220,255,${starAlpha * (.05 + s.a * .46)})`; c.fillRect(x, y, 1 + s.z * 2, 1 + s.z * 2); }
    const layers = this.tier === 'low' ? 2 : 5;
    for (let layer = 0; layer < layers; layer++) {
      const base = h * (.48 + layer * .095), scale = .018 + layer * .014;
      c.fillStyle = `hsla(${biome.hue + layer * 28},48%,${6 + layer * 3}%,${.3 + layer * .09})`; c.beginPath(); c.moveTo(0, h);
      for (let x = 0; x <= w + 40; x += this.tier === 'low' ? 42 : 20) { const wx = x + this.camera.x * scale; c.lineTo(x, base + Math.sin(wx * .009 + layer) * 30 + Math.sin(wx * .0037 + layer * .7) * 68); }
      c.lineTo(w, h); c.fill();
    }
    for (const m of this.visual.motes) { const x = (m.x * w + Math.sin(now * .00035 + m.p) * 58 + world.wind * now * .005) % w, y = (m.y * h + Math.cos(now * .00027 + m.p) * 32) % h; c.fillStyle = `hsla(${m.h},100%,75%,${.025 + .065 * Math.sin(now * .0018 + m.p)})`; c.beginPath(); c.arc(x, y, m.s, 0, TAU); c.fill(); }
  }
  terrain() {
    const size = this.cache.tiles * TILE;
    const left = Math.max(0, Math.floor((this.camera.x - innerWidth / (2 * this.camera.zoom)) / size) - 1), right = Math.min(Math.ceil(MAP_W / this.cache.tiles), Math.ceil((this.camera.x + innerWidth / (2 * this.camera.zoom)) / size) + 1);
    const top = Math.max(0, Math.floor((this.camera.y - innerHeight / (2 * this.camera.zoom)) / size) - 1), bottom = Math.min(Math.ceil(MAP_H / this.cache.tiles), Math.ceil((this.camera.y + innerHeight / (2 * this.camera.zoom)) / size) + 1);
    for (let cy = top; cy <= bottom; cy++) for (let cx = left; cx <= right; cx++) { const p = this.toScreen(cx * size, cy * size); this.ctx.drawImage(this.cache.get(cx, cy), p.x, p.y, size * this.camera.zoom, size * this.camera.zoom); }
  }
  water(now) {
    const c = this.ctx;
    for (const pool of this.world.map.pools) { const p = this.toScreen(pool.x, pool.y), w = pool.w * this.camera.zoom, h = pool.h * this.camera.zoom; if (!this.visible({ x: p.x + w / 2, y: p.y + h / 2 }, 180)) continue;
      const g = c.createLinearGradient(0, p.y, 0, p.y + h); g.addColorStop(0, 'rgba(105,238,255,.36)'); g.addColorStop(.18, 'rgba(45,128,195,.43)'); g.addColorStop(1, 'rgba(2,18,48,.88)'); c.fillStyle = g; c.fillRect(p.x, p.y, w, h);
      c.strokeStyle = 'rgba(190,252,255,.68)'; c.lineWidth = 1.3; c.beginPath(); for (let x = 0; x <= w; x += 8) c.lineTo(p.x + x, p.y + Math.sin(x * .07 + now * .007 + pool.x * .01) * 2.6); c.stroke();
    }
  }
  structures(now) {
    const c = this.ctx;
    for (const v of this.world.map.vines) { const a = this.toScreen(v.x, v.y1), b = this.toScreen(v.x, v.y2); if (!this.visible({ x: a.x, y: (a.y + b.y) / 2 })) continue; c.strokeStyle = 'rgba(70,194,130,.48)'; c.lineWidth = 3 * this.camera.zoom; c.beginPath(); c.moveTo(a.x, a.y); for (let i = 1; i <= 12; i++) { const t = i / 12; c.lineTo(lerp(a.x, b.x, t) + Math.sin(t * 15 + now * .001 + v.phase) * 6 * this.camera.zoom, lerp(a.y, b.y, t)); } c.stroke(); }
    for (const d of this.world.map.dens) { const p = this.toScreen(d.x, d.y); if (!this.visible(p, 160)) continue; const r = d.r * this.camera.zoom; c.save(); c.translate(p.x, p.y); c.globalCompositeOperation = 'screen'; const g = c.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, 'rgba(95,255,210,.34)'); g.addColorStop(.4, 'rgba(75,95,255,.18)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); c.strokeStyle = 'rgba(135,255,230,.65)'; c.lineWidth = 2.3; for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(0, 0, r * (.34 + i * .1), r * (.2 + i * .065), Math.sin(now * .00025 + i) * .24, 0, TAU); c.stroke(); } c.restore(); }
    if (this.tier !== 'low') for (const v of this.world.map.vents) { const p = this.toScreen(v.x, v.y); if (!this.visible(p)) continue; c.save(); c.translate(p.x, p.y); c.globalCompositeOperation = 'screen'; for (let i = 0; i < 4; i++) { const rise = (now * .026 + i * 31 + v.phase * 45) % 105; c.fillStyle = `rgba(255,90,205,${.14 * (1 - rise / 105)})`; c.beginPath(); c.arc(Math.sin(rise * .1 + i) * 8, -rise, 7 + rise * .07, 0, TAU); c.fill(); } c.restore(); }
  }
  plant(p, now) {
    if (!p.alive) return; const c = this.ctx, pos = this.toScreen(p.x, p.y); if (!this.visible(pos, 140)) return;
    const distance = Math.hypot(pos.x - innerWidth / 2, pos.y - innerHeight / 2), detail = this.settings.plantDetail - (distance > innerWidth * .62 ? 1 : 0);
    const ratio = clamp(p.biomass / p.species.maxBiomass, .12, 1.15), scale = this.camera.zoom, height = p.species.height * ratio * scale, width = (10 + 18 * ratio) * scale;
    c.save(); c.translate(pos.x, pos.y); c.rotate((Math.sin(now * .0012 + p.phase) + this.world.windAt(p.x) * 1.5) * (.04 + .05 * ratio) + p.lean);
    c.fillStyle = 'rgba(0,0,0,.24)'; c.beginPath(); c.ellipse(5 * scale, 3 * scale, width * .9, 4 * scale, 0, 0, TAU); c.fill();
    const stem = c.createLinearGradient(0, 0, 0, -height); stem.addColorStop(0, `hsl(${p.species.hue - 18},55%,24%)`); stem.addColorStop(1, `hsl(${p.species.hue + 16},72%,48%)`); c.strokeStyle = stem; c.lineWidth = Math.max(1.5, (2.5 + ratio * 3) * scale); c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(width * .12, -height * .45, 0, -height); c.stroke();
    const form = p.species.form, leaves = detail <= 0 ? 2 : form === 'reed' ? 5 : form === 'fungus' ? 3 : 6 + detail * 2;
    if (form === 'fungus') { c.fillStyle = `hsla(${p.species.hue},82%,55%,.84)`; c.beginPath(); c.ellipse(0, -height, height * .38, height * .15, 0, Math.PI, TAU); c.fill(); }
    else if (form === 'lichen') { c.fillStyle = `hsla(${p.species.hue},72%,50%,.58)`; for (let i = 0; i < leaves + 2; i++) { const a = i / (leaves + 2) * TAU, r = width * (.35 + i % 3 * .12); c.beginPath(); c.ellipse(Math.cos(a) * r * .4, -Math.sin(a) * r * .15, r * .45, r * .18, a, 0, TAU); c.fill(); } }
    else for (let i = 0; i < leaves; i++) { const t = (i + 1) / (leaves + 1), side = i % 2 ? -1 : 1, y = -height * (.18 + t * .72), x = side * width * (.38 + .25 * Math.sin(t * Math.PI)); c.save(); c.translate(x, y); c.rotate(side * (.35 + .18 * Math.sin(i + p.phase))); const lg = c.createLinearGradient(-width, 0, width, 0); lg.addColorStop(0, `hsla(${p.species.hue - 25},70%,28%,.78)`); lg.addColorStop(.5, `hsla(${p.species.hue + 12},84%,56%,.88)`); lg.addColorStop(1, `hsla(${p.species.hue + 52},90%,70%,.32)`); c.fillStyle = lg; c.beginPath(); c.ellipse(0, 0, width * .42 * (1 - t * .25), height * (form === 'frond' ? .15 : .09), 0, 0, TAU); c.fill(); c.restore(); }
    if (form === 'flower' || form === 'pod') { c.globalCompositeOperation = 'screen'; c.shadowBlur = this.settings.glow; c.shadowColor = `hsl(${p.species.hue + 50},100%,70%)`; c.fillStyle = `hsl(${p.species.hue + 70},92%,68%)`; for (let i = 0; i < 5; i++) { c.rotate(TAU / 5); c.beginPath(); c.ellipse(0, -height - height * .1, height * .1, height * .22, 0, 0, TAU); c.fill(); } }
    if (p.fruit > .05) { const fruits = Math.min(5, Math.ceil(p.fruit * 4)); c.globalCompositeOperation = 'screen'; c.shadowBlur = this.settings.glow * .7; for (let i = 0; i < fruits; i++) { const a = i * 2.4 + p.phase; c.fillStyle = `hsl(${p.species.hue + 110},95%,66%)`; c.beginPath(); c.arc(Math.cos(a) * width * .55, -height * (.45 + i % 3 * .17), (2.5 + ratio * 2) * scale, 0, TAU); c.fill(); } }
    c.restore();
  }
  carcass(o) { const c = this.ctx, p = this.toScreen(o.x, o.y); if (!this.visible(p, 80)) return; c.save(); c.translate(p.x, p.y); c.fillStyle = `hsla(${o.hue},45%,22%,.48)`; c.strokeStyle = `hsla(${o.hue + 45},55%,52%,.42)`; c.lineWidth = 2; c.beginPath(); c.ellipse(0, 0, 12 * o.mass * this.camera.zoom, 5 * o.mass * this.camera.zoom, .15, 0, TAU); c.fill(); c.stroke(); c.restore(); }
  creature(o, now) {
    if (o.dead) return; const c = this.ctx, p = this.toScreen(o.x, o.y); if (!this.visible(p, 180)) return;
    const distance = Math.hypot(p.x - innerWidth / 2, p.y - innerHeight / 2), detail = this.settings.creatureDetail - (distance > innerWidth * .62 ? 1 : 0), r = o.r * this.camera.zoom;
    if (detail <= -1) { c.fillStyle = `hsla(${o.hue},90%,58%,.76)`; c.beginPath(); c.arc(p.x, p.y, Math.max(2, r * .42), 0, TAU); c.fill(); return; }
    const spine = o.spine.map(s => this.toScreen(s.x, s.y)); c.save();
    c.fillStyle = `rgba(0,0,0,${.22 + .12 * o.mass})`; c.beginPath(); c.ellipse(p.x + o.bodyLean * r * .6, p.y + r * .72, r * (1 + o.mass * .12), r * .24, 0, 0, TAU); c.fill();
    c.globalAlpha = o.role === 'lurker' && ['stalk', 'pursue'].includes(o.ai?.mode) ? .46 + .36 * (1 - o.genome.camouflage) : 1; c.globalCompositeOperation = 'screen'; c.shadowColor = `hsl(${o.hue},100%,62%)`; c.shadowBlur = this.settings.glow * o.genome.biolum;
    c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = `hsla(${o.hue - 15},72%,43%,.55)`; c.lineWidth = Math.max(2, r * .34); c.beginPath(); spine.forEach((s, i) => i ? c.lineTo(s.x, s.y) : c.moveTo(s.x, s.y)); c.stroke();
    if (detail >= 1) for (let i = 0; i < o.feet.length; i++) { const f = this.toScreen(o.feet[i].x, o.feet[i].y), pair = Math.floor(i / 2), anchor = spine[Math.min(spine.length - 1, 1 + Math.floor(pair / Math.max(1, Math.ceil(o.feet.length / 2) - 1) * (spine.length - 3)))] || p; c.shadowBlur = 0; c.strokeStyle = `hsla(${o.hue + 38},82%,66%,.72)`; c.lineWidth = Math.max(1.4, r * .11); c.beginPath(); c.moveTo(anchor.x, anchor.y); c.quadraticCurveTo(lerp(anchor.x, f.x, .55) + (i % 2 ? -1 : 1) * r * .15, lerp(anchor.y, f.y, .48) - r * .12, f.x, f.y); c.stroke(); c.fillStyle = `hsla(${o.hue + 70},92%,74%,.62)`; c.beginPath(); c.ellipse(f.x + o.facingVisual * r * .1, f.y, r * .18, r * .055, 0, 0, TAU); c.fill(); }
    for (let i = spine.length - 1; i >= 0; i--) { const s = spine[i], t = i / Math.max(1, spine.length - 1), br = r * (.28 + .3 * Math.sin((1 - t) * Math.PI)); const g = c.createRadialGradient(s.x - br * .25, s.y - br * .3, 1, s.x, s.y, br); g.addColorStop(0, `hsla(${o.hue + 48},95%,82%,.95)`); g.addColorStop(.34, `hsla(${o.hue},82%,55%,.92)`); g.addColorStop(1, `hsla(${o.hue - 30},70%,20%,.9)`); c.fillStyle = g; c.beginPath(); c.ellipse(s.x, s.y, br, br * (.64 + .08 * Math.sin(o.breath)), o.bodyLean, 0, TAU); c.fill(); }
    const head = spine[0] || p, hr = r * (.48 + o.genome.jaw * .07); c.save(); c.translate(head.x, head.y); c.rotate(o.bodyLean * .55); c.scale(o.facingVisual || 1, 1); const hg = c.createRadialGradient(hr * .1, -hr * .2, 1, 0, 0, hr); hg.addColorStop(0, `hsl(${o.hue + 55},100%,84%)`); hg.addColorStop(.38, `hsl(${o.hue},88%,58%)`); hg.addColorStop(1, `hsl(${o.hue - 25},74%,24%)`); c.fillStyle = hg; c.beginPath(); c.ellipse(hr * .18, 0, hr, hr * .72, 0, 0, TAU); c.fill();
    const eyes = Math.min(o.genome.eyes, detail <= 0 ? 1 : 4), blink = o.blink < .12 ? .15 : 1; for (let i = 0; i < eyes; i++) { const y = (-.27 + i * (.54 / Math.max(1, eyes - 1))) * hr; c.fillStyle = '#ecfff9'; c.beginPath(); c.ellipse(hr * .58, y, hr * .105, hr * .08 * blink, 0, 0, TAU); c.fill(); c.fillStyle = '#041018'; c.beginPath(); c.ellipse(hr * .61 + clamp(o.intentX, -1, 1) * hr * .025, y, hr * .042, hr * .035 * blink, 0, 0, TAU); c.fill(); }
    if (o.meta.predator) { c.strokeStyle = 'rgba(255,245,255,.88)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(hr * .66, hr * .17); c.lineTo(hr * .9, hr * .27); c.lineTo(hr * .63, hr * .31); c.stroke(); } c.restore();
    if (o.isPlayer) { c.shadowColor = '#fff'; c.shadowBlur = 14; c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1.5; c.beginPath(); c.arc(p.x, p.y, r * 1.45 + Math.sin(now * .004) * 2, 0, TAU); c.stroke(); } c.restore();
  }
  weather(now) {
    const c = this.ctx, intensity = this.world.rainIntensity;
    if (intensity > .01) { c.save(); c.strokeStyle = `rgba(128,190,255,${.14 + intensity * .4})`; c.lineWidth = 1.1; const wind = this.world.wind * 14; for (let i = 0; i < this.settings.rain; i++) { const x = (i * 71 + now * (.42 + intensity * .22)) % (innerWidth + 140) - 70, y = (i * 43 + now * (.75 + intensity * .4)) % (innerHeight + 150) - 75, len = 10 + intensity * 31; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 5 - wind * .25, y + len); c.stroke(); } c.restore(); }
    if (this.settings.fog) { c.save(); c.globalCompositeOperation = 'screen'; for (const f of this.visual.fog) { const x = (f.x * innerWidth + Math.sin(now * .00012 + f.p) * 80 + this.world.wind * 40) % innerWidth, y = f.y * innerHeight * .8 + innerHeight * .1, r = f.r * Math.max(innerWidth, innerHeight); const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(75,160,165,.035)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); } c.restore(); }
  }
  events() { const c = this.ctx; this.world.events = this.world.events.filter(e => this.world.time - e.time < 2.2); for (const e of this.world.events) { const p = this.toScreen(e.x, e.y), age = this.world.time - e.time, alpha = clamp(1 - age / 2.2, 0, 1); if (!this.visible(p)) continue; if (e.type === 'scan' || e.type === 'scanPlant') { c.strokeStyle = `rgba(100,240,255,${alpha * .7})`; c.lineWidth = 2; c.beginPath(); c.arc(p.x, p.y, 18 + age * 80, 0, TAU); c.stroke(); } } }
  render(now, dt) {
    this.updateCamera(dt); this.background(now); this.terrain(); this.water(now); this.structures(now);
    const items = []; for (const p of this.world.plants.plants) if (p.alive) items.push({ y: p.y, type: 0, o: p }); for (const o of this.world.carcasses) items.push({ y: o.y, type: 1, o }); for (const o of this.world.creatures) if (!o.dead) items.push({ y: o.y, type: 2, o }); items.sort((a, b) => a.y - b.y);
    for (const item of items) item.type === 0 ? this.plant(item.o, now) : item.type === 1 ? this.carcass(item.o) : this.creature(item.o, now);
    this.events(); this.weather(now);
  }
}
