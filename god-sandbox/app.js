import { World, WORLD_W, WORLD_H, TAU, clamp, lerp } from './sim.js?v=8';

const $ = id => document.getElementById(id);
const canvas = $('game');
const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
const STORAGE_KEY = 'gg_v8_settings';
const OVERLAYS = ['off', 'temperature', 'moisture', 'nutrients'];
const POWER_TEXT = {
  bloom: 'Bloom adds water, nutrients, plant biomass, and recovery.',
  pull: 'Gravity creates a temporary force field that pulls living bodies.',
  storm: 'Storm adds rain moisture and a physical pressure impulse.',
  mutate: 'Mutate edits inherited traits in nearby organisms.',
  sun: 'Sun raises local temperature and increases available light.'
};

const DEFAULT_UI_SETTINGS = Object.freeze({
  device: 'auto',
  graphics: 'auto',
  science: 'deep',
  population: 82,
  evolution: 5,
  climate: 5
});

function loadSettings() {
  try {
    return { ...DEFAULT_UI_SETTINGS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
  } catch {
    return { ...DEFAULT_UI_SETTINGS };
  }
}

function saveSettings() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch {}
}

let settings = loadSettings();
let world = null;
let started = false;
let paused = true;
let selectedPower = 'bloom';
let scienceOverlay = 0;
let quality = settings.graphics;
let renderTier = quality === 'battery' ? 'low' : 'high';
let dpr = 1;
let fps = 60;
let last = performance.now();
let accumulator = 0;
let frames = 0;
let uiClock = 0;
let messageTimer = 6;
let deferredInstall = null;
const camera = { x: WORLD_W * 0.5, y: 900, zoom: 0.7 };
const pointers = new Map();
const gesture = { moved: false, lastX: 0, lastY: 0, startDist: 0, startZoom: 1 };
const stars = Array.from({ length: 130 }, () => ({ x: Math.random(), y: Math.random(), a: Math.random(), s: Math.random() * 1.9 + 0.4 }));

function effectiveDevice() {
  if (settings.device !== 'auto') return settings.device;
  return Math.min(innerWidth, innerHeight) >= 700 || Math.max(innerWidth, innerHeight) >= 1100 ? 'ipad' : 'iphone';
}

function maxDprForTier() {
  if (renderTier === 'low') return 1;
  if (renderTier === 'medium') return effectiveDevice() === 'ipad' ? 1.42 : 1.28;
  return effectiveDevice() === 'ipad' ? 1.72 : 1.52;
}

function resize() {
  dpr = Math.min(devicePixelRatio || 1, maxDprForTier());
  canvas.width = Math.max(1, Math.floor(innerWidth * dpr));
  canvas.height = Math.max(1, Math.floor(innerHeight * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener('resize', resize, { passive: true });
resize();

const toScreen = (x, y) => ({ x: (x - camera.x) * camera.zoom + innerWidth / 2, y: (y - camera.y) * camera.zoom + innerHeight / 2 });
const toWorld = (x, y) => ({ x: (x - innerWidth / 2) / camera.zoom + camera.x, y: (y - innerHeight / 2) / camera.zoom + camera.y });

function showMessage(text, seconds = 2.8) {
  $('message').textContent = text;
  $('message').classList.add('show');
  messageTimer = seconds;
}

function setRenderTier(tier, announce = false) {
  if (renderTier === tier) return;
  renderTier = tier;
  if (world) world.setPerformanceTier(tier);
  resize();
  if (announce) showMessage(tier === 'low' ? 'Mobile protection enabled: physics stays fixed while rendering is reduced.' : `Rendering raised to ${tier}.`);
}

function applyQualityMode(announce = false) {
  if (quality === 'battery') setRenderTier('low', announce);
  else if (quality === 'high') setRenderTier('high', announce);
  else if (!['low', 'medium', 'high'].includes(renderTier)) setRenderTier('high', announce);
  $('qualityLabel').textContent = quality.toUpperCase();
}

function simulationSettings() {
  const device = effectiveDevice();
  const maxPopulation = device === 'ipad'
    ? Math.min(190, Math.round(settings.population * 1.7))
    : Math.min(138, Math.round(settings.population * 1.46));
  return {
    device,
    science: settings.science,
    population: settings.population,
    maxPopulation,
    evolution: settings.evolution,
    climate: settings.climate
  };
}

function startWorld(seed = (Date.now() ^ 0x51f15e) >>> 0) {
  settings.population = Number($('populationSetting').value);
  settings.evolution = Number($('evolutionSetting').value);
  settings.climate = Number($('climateSetting').value);
  quality = settings.graphics;
  saveSettings();
  applyQualityMode(false);
  world = new World(seed, simulationSettings());
  world.setPerformanceTier(renderTier);
  camera.x = WORLD_W * 0.5;
  camera.y = 900;
  camera.zoom = effectiveDevice() === 'ipad' ? 0.82 : 0.68;
  started = true;
  paused = false;
  accumulator = 0;
  $('intro').classList.remove('show');
  $('pause').classList.remove('show');
  showMessage(`${world.settings.population} autonomous organisms initialized across ${world.climateCells} climate cells.`, 4.2);
}

function syncSettingsUI() {
  document.querySelectorAll('.segmented').forEach(group => {
    const key = group.dataset.setting;
    group.querySelectorAll('button').forEach(button => button.classList.toggle('selected', button.dataset.value === String(settings[key])));
  });
  $('populationSetting').value = settings.population;
  $('evolutionSetting').value = settings.evolution;
  $('climateSetting').value = settings.climate;
  updateSettingLabels();
}

function updateSettingLabels() {
  $('populationValue').textContent = `${$('populationSetting').value} creatures`;
  $('evolutionValue').textContent = `${$('evolutionSetting').value} / 10`;
  $('climateValue').textContent = `${$('climateSetting').value} / 10`;
}

function drawPreview(now) {
  const w = innerWidth, h = innerHeight;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#100d2a');
  g.addColorStop(0.55, '#07131d');
  g.addColorStop(1, '#020407');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 70; i++) {
    const a = i * 2.399 + now * 0.00005;
    const radius = 40 + (i % 17) * 16;
    const x = w * 0.5 + Math.cos(a) * radius;
    const y = h * 0.45 + Math.sin(a * 1.27) * radius * 0.42;
    ctx.fillStyle = `hsla(${150 + (i * 19) % 180} 100% 70% / ${0.04 + (i % 5) * 0.012})`;
    ctx.beginPath();
    ctx.arc(x, y, 2 + (i % 4), 0, TAU);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

function drawBackground(now) {
  if (!world) return drawPreview(now);
  const w = innerWidth, h = innerHeight;
  const day = world.daylight;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, `hsl(${232 + day * 18} 48% ${5 + day * 8}%)`);
  g.addColorStop(0.55, `hsl(${207 + day * 8} 45% ${6 + day * 5}%)`);
  g.addColorStop(1, '#020407');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const starCount = renderTier === 'low' ? 45 : renderTier === 'medium' ? 85 : stars.length;
  for (let i = 0; i < starCount; i++) {
    const s = stars[i], x = (s.x * w - camera.x * 0.008 * s.s + w * 3) % w, y = s.y * h * 0.72;
    ctx.fillStyle = `rgba(170,210,255,${(1 - day) * (0.04 + s.a * 0.46)})`;
    ctx.fillRect(x, y, s.s, s.s);
  }

  const layers = renderTier === 'low' ? 2 : 4;
  for (let layer = 0; layer < layers; layer++) {
    const base = h * (0.46 + layer * 0.115);
    ctx.fillStyle = `hsla(${218 + layer * 22},55%,${7 + layer * 2 + day * 2}%,${0.58 + layer * 0.08})`;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w + 28; x += 24) {
      const wx = x + camera.x * (0.018 + layer * 0.01);
      ctx.lineTo(x, base + Math.sin(wx * 0.009 + layer) * 35 + Math.sin(wx * 0.0028) * 72);
    }
    ctx.lineTo(w, h);
    ctx.fill();
  }

  if (world.rain > 0.03) {
    const count = renderTier === 'low' ? 45 : renderTier === 'medium' ? 85 : 145;
    ctx.strokeStyle = `rgba(130,205,255,${0.08 + world.rain * 0.36})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < count; i++) {
      const x = (i * 73 + now * (0.34 + world.rain * 0.62)) % (w + 100) - 50;
      const y = (i * 47 + now * 0.48) % (h + 120) - 60;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 7 - world.wind * 0.02, y + 18 + world.rain * 20);
      ctx.stroke();
    }
  }
}

function visibleWorldBounds(pad = 120) {
  return {
    left: camera.x - innerWidth / (2 * camera.zoom) - pad,
    right: camera.x + innerWidth / (2 * camera.zoom) + pad,
    top: camera.y - innerHeight / (2 * camera.zoom) - pad,
    bottom: camera.y + innerHeight / (2 * camera.zoom) + pad
  };
}

function drawTerrain() {
  const bounds = visibleWorldBounds(220);
  ctx.save();
  ctx.beginPath();
  let startedPath = false;
  for (let i = 0; i < world.heights.length; i++) {
    const x = i / (world.heights.length - 1) * WORLD_W;
    if (x < bounds.left - 120 || x > bounds.right + 120) continue;
    const p = toScreen(x, world.heights[i]);
    if (!startedPath) { ctx.moveTo(p.x, p.y); startedPath = true; } else ctx.lineTo(p.x, p.y);
  }
  if (!startedPath) { ctx.restore(); return; }
  ctx.lineTo(toScreen(bounds.right, WORLD_H).x, toScreen(bounds.right, WORLD_H).y);
  ctx.lineTo(toScreen(bounds.left, WORLD_H).x, toScreen(bounds.left, WORLD_H).y);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, Math.max(0, toScreen(0, 780).y), 0, innerHeight);
  g.addColorStop(0, '#17363a');
  g.addColorStop(0.18, '#132a31');
  g.addColorStop(0.48, '#0c1821');
  g.addColorStop(1, '#04070c');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(102,255,211,.38)';
  ctx.lineWidth = Math.max(1, 2 * camera.zoom);
  ctx.shadowBlur = renderTier === 'low' ? 3 : 11;
  ctx.shadowColor = '#56ffd1';
  ctx.stroke();
  ctx.restore();
}

function overlayColor(type, value) {
  if (type === 'temperature') return `hsla(${clamp(230 - (value + 5) * 5.2, 0, 240)} 92% 58% / .16)`;
  if (type === 'moisture') return `hsla(${190 + value * 25} 90% 55% / ${0.05 + value * 0.19})`;
  return `hsla(${58 + value * 85} 88% 56% / ${0.05 + value * 0.18})`;
}

function drawScienceOverlay() {
  const type = OVERLAYS[scienceOverlay];
  if (type === 'off' || !world) return;
  const bounds = visibleWorldBounds(0);
  const step = renderTier === 'low' ? 2 : 1;
  const cellW = WORLD_W / world.climateCells;
  ctx.save();
  for (let i = 0; i < world.climateCells; i += step) {
    const x = i * cellW;
    if (x + cellW * step < bounds.left || x > bounds.right) continue;
    const p = toScreen(x, 0);
    const p2 = toScreen(x + cellW * step, WORLD_H);
    const value = type === 'temperature' ? world.temperature[i] : type === 'moisture' ? world.moisture[i] : world.nutrients[i];
    ctx.fillStyle = overlayColor(type, value);
    ctx.fillRect(p.x, 0, Math.max(1, p2.x - p.x + 1), innerHeight);
  }
  ctx.restore();
}

function drawFlora(now) {
  const bounds = visibleWorldBounds(70);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const stride = renderTier === 'low' ? 2 : 1;
  for (let i = 0; i < world.flora.length; i += stride) {
    const f = world.flora[i];
    if (f.biomass <= 0.025 || f.x < bounds.left || f.x > bounds.right || f.y < bounds.top || f.y > bounds.bottom) continue;
    const p = toScreen(f.x, f.y);
    const biomass = clamp(f.biomass / f.maxBiomass, 0, 1);
    const pulse = 1 + Math.sin(now * 0.005 + f.phase) * 0.13;
    const size = f.size * (0.35 + biomass * 0.9) * pulse * camera.zoom;
    ctx.shadowBlur = renderTier === 'low' ? 4 : 13;
    ctx.shadowColor = `hsl(${f.hue} 100% 60%)`;
    ctx.strokeStyle = `hsla(${f.hue + 25} 90% 70% / .56)`;
    ctx.lineWidth = Math.max(1, camera.zoom * 1.4);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + size * 0.5);
    ctx.quadraticCurveTo(p.x + Math.sin(f.phase) * size, p.y - size, p.x, p.y - size * 1.6);
    ctx.stroke();
    ctx.fillStyle = `hsl(${f.hue} 92% ${48 + biomass * 20}%)`;
    const leaves = renderTier === 'low' ? 2 : 4;
    for (let leaf = 0; leaf < leaves; leaf++) {
      const a = leaf * TAU / leaves + f.phase;
      ctx.beginPath();
      ctx.ellipse(p.x + Math.cos(a) * size * 0.72, p.y - size * (0.45 + leaf * 0.18), size * 0.72, size * 0.25, a * 0.45, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawCarcasses() {
  const bounds = visibleWorldBounds(80);
  for (const c of world.carcasses) {
    if (c.x < bounds.left || c.x > bounds.right || c.y < bounds.top || c.y > bounds.bottom) continue;
    const p = toScreen(c.x, c.y), s = Math.max(3, Math.sqrt(c.mass) * 11 * camera.zoom);
    ctx.strokeStyle = `hsla(${c.hue} 55% 48% / .48)`;
    ctx.lineWidth = Math.max(1.5, s * 0.18);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, s, s * 0.38, 0.16, 0, TAU);
    ctx.stroke();
  }
}

function drawCreature(c, now) {
  const head = toScreen(c.x, c.y);
  if (head.x < -130 || head.x > innerWidth + 130 || head.y < -130 || head.y > innerHeight + 130) return;
  const r = c.r * camera.zoom;
  const gait = now * 0.008 * (0.4 + Math.abs(c.vx) / 160) + c.id;
  const heatShift = clamp((c.bodyTemp - 22) * 1.8, -16, 20);
  const hue = (c.hue - heatShift + 360) % 360;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.shadowColor = `hsl(${hue} 100% 62%)`;
  ctx.shadowBlur = renderTier === 'low' ? 4 : renderTier === 'medium' ? 8 : 13;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = `hsla(${hue} 88% 64% / .52)`;
  ctx.lineWidth = Math.max(2, r * 0.34);
  ctx.beginPath();
  for (let i = 0; i < c.nodes.length; i++) {
    const p = toScreen(c.nodes[i].x, c.nodes[i].y);
    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  const bodyStride = renderTier === 'low' && c.nodes.length > 5 ? 2 : 1;
  for (let i = c.nodes.length - 1; i >= 0; i -= bodyStride) {
    const p = toScreen(c.nodes[i].x, c.nodes[i].y);
    const t = i / Math.max(1, c.nodes.length - 1), br = r * (0.46 - 0.15 * t);
    if (renderTier === 'high') {
      const grad = ctx.createRadialGradient(p.x - br * 0.3, p.y - br * 0.3, 1, p.x, p.y, br);
      grad.addColorStop(0, `hsl(${hue + 58} 100% 86%)`);
      grad.addColorStop(0.35, `hsl(${hue} 92% ${56 + c.energy * 8}%)`);
      grad.addColorStop(1, `hsl(${hue - 28} 80% 25%)`);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = `hsl(${hue} 88% ${46 + c.energy * 12}%)`;
    }
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, br, br * 0.72, 0, 0, TAU);
    ctx.fill();
  }

  if (c.morph.legs && renderTier !== 'low') {
    ctx.strokeStyle = `hsla(${hue + 65} 95% 78% / .7)`;
    ctx.lineWidth = Math.max(1.2, r * 0.12);
    for (let i = 0; i < c.morph.legs; i++) {
      const anchor = c.nodes[Math.min(c.nodes.length - 1, 1 + ((i / 2) | 0))];
      const a = toScreen(anchor.x, anchor.y), side = i % 2 ? -1 : 1;
      const footX = a.x + Math.sin(gait + i * 1.7) * r * 0.75;
      const footY = toScreen(anchor.x, world.terrainY(anchor.x)).y;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(a.x + side * r * 0.45, a.y + r * 0.35, footX, Math.min(footY, a.y + r * 1.1));
      ctx.stroke();
    }
  }

  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.scale(c.facing, 1);
  ctx.fillStyle = `hsl(${hue} 94% 58%)`;
  ctx.beginPath();
  ctx.ellipse(r * 0.42, 0, r * 0.52, r * 0.43, 0, 0, TAU);
  ctx.fill();
  for (let i = 0; i < c.morph.horns; i++) {
    ctx.strokeStyle = `hsl(${hue + 70} 100% 83%)`;
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(r * 0.45, (-0.2 + i * 0.18) * r);
    ctx.lineTo(r * (0.82 + i * 0.08), (-0.7 + i * 0.22) * r);
    ctx.stroke();
  }
  const eyes = renderTier === 'low' ? Math.min(2, c.morph.eyes) : c.morph.eyes;
  for (let i = 0; i < eyes; i++) {
    const ey = (-0.24 + i * (0.48 / Math.max(1, eyes - 1))) * r;
    ctx.fillStyle = c.stress > 0.45 ? '#fff0fb' : '#f0ffff';
    ctx.beginPath();
    ctx.arc(r * 0.56, ey, r * 0.09, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#071018';
    ctx.beginPath();
    ctx.arc(r * 0.59, ey, r * 0.038, 0, TAU);
    ctx.fill();
  }
  if (c.meta.flyer) {
    ctx.fillStyle = `hsla(${hue + 95} 95% 66% / .27)`;
    const fins = renderTier === 'low' ? 2 : c.morph.fins;
    for (let i = 0; i < fins; i++) {
      ctx.rotate(i % 2 ? -0.08 : 0.08);
      ctx.beginPath();
      ctx.ellipse(-r * 0.25, (i % 2 ? -1 : 1) * r * 0.38, r * 1.05, r * 0.24, (i % 2 ? -1 : 1) * 0.35, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
  ctx.restore();
}

function drawFieldsAndEffects() {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const field of world.fields) {
    const p = toScreen(field.x, field.y), t = clamp(field.t / field.life, 0, 1);
    if (field.kind === 'sun') {
      const radius = (260 + Math.sin(field.t * 5) * 18) * camera.zoom;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
      g.addColorStop(0, `rgba(255,236,132,${0.32 * (1 - t)})`);
      g.addColorStop(1, 'rgba(255,130,30,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, TAU);
      ctx.fill();
    }
  }
  for (const e of world.effects) {
    const p = toScreen(e.x, e.y), t = e.t / e.life, r = (40 + t * 320) * camera.zoom;
    const hue = e.kind === 'bloom' ? 145 : e.kind === 'pull' ? 270 : e.kind === 'storm' ? 205 : e.kind === 'sun' ? 44 : 325;
    ctx.strokeStyle = `hsla(${hue} 100% 68% / ${1 - t})`;
    ctx.lineWidth = Math.max(1, 5 * (1 - t));
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, TAU);
    ctx.stroke();
  }
  for (const p of world.particles) {
    const q = toScreen(p.x, p.y);
    if (q.x < -20 || q.x > innerWidth + 20 || q.y < -20 || q.y > innerHeight + 20) continue;
    ctx.fillStyle = `hsla(${p.hue} 100% 65% / ${clamp(p.life / p.max, 0, 1)})`;
    ctx.fillRect(q.x, q.y, Math.max(1, p.size * camera.zoom), Math.max(1, p.size * camera.zoom));
  }
  ctx.restore();
}

function render(now) {
  drawBackground(now);
  if (!world) return;
  drawTerrain();
  drawScienceOverlay();
  drawFlora(now);
  drawCarcasses();
  if (renderTier === 'high') {
    const ordered = [...world.creatures].sort((a, b) => a.y - b.y);
    for (const c of ordered) drawCreature(c, now);
  } else {
    for (const c of world.creatures) drawCreature(c, now);
  }
  drawFieldsAndEffects();
}

function updateUI() {
  if (messageTimer > 0) {
    messageTimer -= uiClock;
    if (messageTimer <= 0) $('message').classList.remove('show');
  }
  if (!world) return;
  const stats = world.stats();
  $('population').textContent = stats.population;
  $('species').textContent = stats.species;
  $('generation').textContent = stats.maxGeneration;
  $('temperature').textContent = stats.meanTemperature.toFixed(1);
  $('moisture').textContent = `${Math.round(stats.meanMoisture * 100)}%`;
  $('fps').textContent = Math.round(fps);
  $('biomassStat').textContent = stats.biomass.toFixed(0);
  $('diversityStat').textContent = stats.diversity.toFixed(3);
  $('birthDeathStat').textContent = `${stats.births} / ${stats.deaths}`;
  const type = OVERLAYS[scienceOverlay];
  $('scienceLegend').hidden = type === 'off';
  if (type !== 'off') {
    $('scienceLegend').textContent = type === 'temperature'
      ? `TEMPERATURE · ${stats.meanTemperature.toFixed(1)} °C`
      : type === 'moisture'
        ? `SOIL WATER · ${Math.round(stats.meanMoisture * 100)}%`
        : `NUTRIENTS · BIOMASS ${stats.biomass.toFixed(0)}`;
  }
}

function adaptivePerformance() {
  if (quality !== 'auto' || !world) return;
  if (fps < 39) setRenderTier('low', true);
  else if (fps < 52 && renderTier === 'high') setRenderTier('medium', true);
  else if (fps > 58 && renderTier === 'low') setRenderTier('medium', false);
  else if (fps > 59 && renderTier === 'medium' && effectiveDevice() === 'ipad') setRenderTier('high', false);
}

function loop(now) {
  const dt = Math.min(0.09, (now - last) / 1000);
  last = now;
  fps = fps * 0.92 + (dt ? 1 / dt : 60) * 0.08;
  if (world && !paused) {
    accumulator += dt;
    let guard = 0;
    while (accumulator >= 1 / 60 && guard++ < 5) {
      world.step(1 / 60);
      accumulator -= 1 / 60;
    }
  } else accumulator = 0;
  render(now);
  uiClock += dt;
  if (uiClock >= 0.15) { updateUI(); uiClock = 0; }
  if (++frames % 300 === 0) adaptivePerformance();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function choosePower(kind) {
  selectedPower = kind;
  document.querySelectorAll('.power').forEach(button => button.classList.toggle('selected', button.dataset.power === kind));
  showMessage(POWER_TEXT[kind]);
}
document.querySelectorAll('.power').forEach(button => button.addEventListener('click', () => choosePower(button.dataset.power)));

canvas.addEventListener('pointerdown', event => {
  if (!started || paused) return;
  event.preventDefault();
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  canvas.setPointerCapture?.(event.pointerId);
  gesture.moved = false;
  gesture.lastX = event.clientX;
  gesture.lastY = event.clientY;
  if (pointers.size === 2) {
    const p = [...pointers.values()];
    gesture.startDist = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
    gesture.startZoom = camera.zoom;
  }
});

canvas.addEventListener('pointermove', event => {
  if (!pointers.has(event.pointerId)) return;
  event.preventDefault();
  const pointer = pointers.get(event.pointerId);
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  if (pointers.size === 1) {
    const dx = event.clientX - gesture.lastX, dy = event.clientY - gesture.lastY;
    if (Math.hypot(dx, dy) > 2) {
      gesture.moved = true;
      camera.x = clamp(camera.x - dx / camera.zoom, innerWidth * 0.25 / camera.zoom, WORLD_W - innerWidth * 0.25 / camera.zoom);
      camera.y = clamp(camera.y - dy / camera.zoom, 220, WORLD_H - 120);
    }
    gesture.lastX = event.clientX;
    gesture.lastY = event.clientY;
  } else if (pointers.size === 2) {
    const p = [...pointers.values()];
    const distance = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
    camera.zoom = clamp(gesture.startZoom * distance / Math.max(1, gesture.startDist), 0.34, effectiveDevice() === 'ipad' ? 1.65 : 1.42);
    gesture.moved = true;
  }
});

function endPointer(event) {
  if (!pointers.has(event.pointerId)) return;
  const wasTap = !gesture.moved && pointers.size === 1;
  const pointer = pointers.get(event.pointerId);
  pointers.delete(event.pointerId);
  if (wasTap && world && !paused) {
    const q = toWorld(pointer.x, pointer.y);
    world.applyPower(selectedPower, clamp(q.x, 0, WORLD_W), clamp(q.y, 0, WORLD_H));
    navigator.vibrate?.(selectedPower === 'storm' ? 24 : 10);
  }
  if (pointers.size < 2) {
    gesture.lastX = event.clientX;
    gesture.lastY = event.clientY;
  }
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('lostpointercapture', endPointer);

function setPause(value) {
  if (!started && !value) return;
  paused = value;
  $('pause').classList.toggle('show', paused && started);
  if (paused) updateUI();
}

$('pauseBtn').onclick = () => setPause(true);
$('resumeBtn').onclick = () => setPause(false);
$('enterBtn').onclick = () => startWorld();
$('newWorldBtn').onclick = () => startWorld((Date.now() ^ 0x13d3) >>> 0);
$('settingsBtn').onclick = () => {
  paused = true;
  $('pause').classList.remove('show');
  $('intro').classList.add('show');
  syncSettingsUI();
  showMessage('Apply settings to create a replacement world.');
};
$('defaultsBtn').onclick = () => {
  settings = { ...DEFAULT_UI_SETTINGS };
  syncSettingsUI();
  showMessage('Safe iPhone and iPad defaults restored.');
};

$('qualityBtn').onclick = () => {
  quality = quality === 'auto' ? 'high' : quality === 'high' ? 'battery' : 'auto';
  settings.graphics = quality;
  saveSettings();
  applyQualityMode(true);
};

$('scienceBtn').onclick = () => {
  scienceOverlay = (scienceOverlay + 1) % OVERLAYS.length;
  const type = OVERLAYS[scienceOverlay];
  showMessage(type === 'off' ? 'Scientific overlay off.' : `${type.toUpperCase()} field overlay enabled.`);
  updateUI();
};

for (const group of document.querySelectorAll('.segmented')) {
  group.querySelectorAll('button').forEach(button => button.onclick = () => {
    settings[group.dataset.setting] = button.dataset.value;
    group.querySelectorAll('button').forEach(other => other.classList.toggle('selected', other === button));
  });
}
for (const input of [$('populationSetting'), $('evolutionSetting'), $('climateSetting')]) input.addEventListener('input', updateSettingLabels, { passive: true });
syncSettingsUI();
applyQualityMode(false);

addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferredInstall = event; });
$('installBtn').onclick = async () => {
  if (deferredInstall) {
    deferredInstall.prompt();
    await deferredInstall.userChoice;
    deferredInstall = null;
  } else showMessage('iPhone or iPad: Safari Share → Add to Home Screen.', 4);
};

function createRating() {
  const root = $('stars');
  const saved = Number(localStorage.getItem('gg_rating') || 0);
  const choice = localStorage.getItem('gg_feedback') || '';
  for (let i = 1; i <= 10; i++) {
    const button = document.createElement('button');
    button.textContent = '★';
    button.classList.toggle('on', i <= saved);
    button.onclick = () => {
      localStorage.setItem('gg_rating', String(i));
      [...root.children].forEach((star, index) => star.classList.toggle('on', index < i));
      $('ratingText').textContent = `${i}/10`;
    };
    root.append(button);
  }
  if (saved) $('ratingText').textContent = `${saved}/10`;
  document.querySelectorAll('[data-feedback]').forEach(button => {
    button.classList.toggle('selected', button.dataset.feedback === choice);
    button.onclick = () => {
      localStorage.setItem('gg_feedback', button.dataset.feedback);
      document.querySelectorAll('[data-feedback]').forEach(other => other.classList.toggle('selected', other === button));
    };
  });
}
createRating();

addEventListener('visibilitychange', () => {
  if (document.hidden && started) setPause(true);
});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('../sw.js?v=8', { updateViaCache: 'none' }).catch(() => {});
