import { World, WORLD_W, WORLD_H, TAU, clamp, lerp } from './sim.js?v=9';

const $ = id => document.getElementById(id);
const canvas = $('game');
const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
const STORAGE = 'gg_v9_settings';
const POWER_TEXT = {
  inspect: 'Tap a creature to inspect its anatomy, injuries, memories, and behavior.',
  bloom: 'Bloom adds water, nutrients, plants, and ecosystem recovery.',
  pull: 'Gravity creates a temporary physical force field.',
  storm: 'Storm adds rain and a pressure impulse that can injure bodies.',
  mutate: 'Mutate changes inherited physiology and behavior genes.',
  sun: 'Sun increases local temperature and light while drying soil.',
  quake: 'Quake throws bodies and can fracture vulnerable limbs.'
};
const OVERLAYS = ['off', 'temperature', 'moisture', 'nutrients', 'toxin'];

let world = null;
let settings = loadSettings();
let quality = settings.graphics || 'auto';
let selectedPower = 'inspect';
let overlay = 'off';
let paused = true;
let started = false;
let followId = null;
let deferredInstall = null;
let dpr = 1;
let fps = 60;
let last = performance.now();
let accumulator = 0;
let frames = 0;
let messageTimer = 5;
const camera = { x: WORLD_W * 0.5, y: 900, zoom: 0.72 };
const pointers = new Map();
const gesture = { moved: false, lastX: 0, lastY: 0, startDist: 0, startZoom: 1 };
const stars = Array.from({ length: 110 }, () => ({ x: Math.random(), y: Math.random(), a: Math.random(), s: Math.random() * 1.7 + 0.45 }));

function loadSettings() {
  const fallback = { device: 'auto', graphics: 'auto', anatomy: 'full', plants: 'deep', population: 78, creepy: 6, injury: 6, evolution: 5, climate: 5, science: 'deep' };
  try { return { ...fallback, ...JSON.parse(localStorage.getItem(STORAGE) || '{}') }; } catch { return fallback; }
}
function saveSettings() { try { localStorage.setItem(STORAGE, JSON.stringify(settings)); } catch {} }
function resolvedDevice() {
  if (settings.device !== 'auto') return settings.device;
  return Math.min(screen.width, screen.height) >= 700 || innerWidth >= 900 ? 'ipad' : 'iphone';
}
function worldSettings() {
  const device = resolvedDevice();
  const cap = device === 'ipad' ? 190 : 132;
  return { ...settings, device, maxPopulation: cap, population: Math.min(Number(settings.population), cap) };
}
function showMessage(text, sec = 3) {
  $('message').textContent = text;
  $('message').classList.add('show');
  messageTimer = sec;
}
function setBar(id, v, inverse = false) {
  const value = clamp(v, 0, 1);
  $(id).style.width = `${(inverse ? 1 - value : value) * 100}%`;
}
function resize() {
  const device = resolvedDevice();
  const maxDpr = quality === 'battery' ? 1 : quality === 'high' ? (device === 'ipad' ? 1.8 : 1.65) : (device === 'ipad' ? 1.55 : 1.4);
  dpr = Math.min(devicePixelRatio || 1, maxDpr);
  canvas.width = Math.max(1, Math.floor(innerWidth * dpr));
  canvas.height = Math.max(1, Math.floor(innerHeight * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener('resize', resize, { passive: true });
resize();

const toScreen = (x, y) => ({ x: (x - camera.x) * camera.zoom + innerWidth / 2, y: (y - camera.y) * camera.zoom + innerHeight / 2 });
const toWorld = (x, y) => ({ x: (x - innerWidth / 2) / camera.zoom + camera.x, y: (y - innerHeight / 2) / camera.zoom + camera.y });

function drawBackground(now) {
  const w = innerWidth, h = innerHeight;
  const daylight = world?.daylight ?? 0.28;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, `hsl(${232 + daylight * 26} 48% ${4 + daylight * 8}%)`);
  g.addColorStop(0.55, '#07121c');
  g.addColorStop(1, '#020408');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  for (const s of stars) {
    const x = (s.x * w - camera.x * 0.006 * s.s + w * 4) % w;
    const y = s.y * h * 0.72;
    ctx.fillStyle = `rgba(175,215,255,${0.05 + s.a * (0.5 - daylight * 0.3)})`;
    ctx.fillRect(x, y, s.s, s.s);
  }
  for (let layer = 0; layer < 4; layer++) {
    const base = h * (0.46 + layer * 0.12);
    ctx.fillStyle = `hsla(${220 + layer * 18},55%,${6 + layer * 2}%,${0.6 + layer * 0.08})`;
    ctx.beginPath(); ctx.moveTo(0, h);
    for (let x = 0; x <= w + 30; x += 24) {
      const wx = x + camera.x * (0.014 + layer * 0.009);
      ctx.lineTo(x, base + Math.sin(wx * 0.008 + layer) * 38 + Math.sin(wx * 0.0022) * 78);
    }
    ctx.lineTo(w, h); ctx.fill();
  }
  if (world?.rain > 0.03) {
    ctx.strokeStyle = `rgba(120,190,255,${0.1 + world.rain * 0.34})`;
    ctx.lineWidth = 1;
    const count = quality === 'battery' ? 55 : 130;
    for (let i = 0; i < count; i++) {
      const x = (i * 73 + now * (0.45 + world.rain)) % (w + 80) - 40;
      const y = (i * 43 + now * 0.7) % (h + 100) - 50;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 7, y + 18 + world.rain * 24); ctx.stroke();
    }
  }
}

function overlayColor(cell) {
  if (overlay === 'temperature') {
    const t = clamp((cell.temperature + 10) / 60, 0, 1); return `hsla(${220 - t * 220},90%,58%,.22)`;
  }
  if (overlay === 'moisture') return `hsla(${190 + cell.moisture * 35},90%,58%,${0.07 + cell.moisture * 0.25})`;
  if (overlay === 'nutrients') return `hsla(${70 + cell.nutrients * 55},85%,55%,${0.06 + cell.nutrients * 0.22})`;
  if (overlay === 'toxin') return `hsla(${290 + cell.toxin * 40},95%,58%,${0.04 + cell.toxin * 0.35})`;
  return null;
}

function drawTerrain() {
  if (!world) return;
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < world.heights.length; i++) {
    const x = i / (world.heights.length - 1) * WORLD_W, p = toScreen(x, world.heights[i]);
    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
  }
  const b1 = toScreen(WORLD_W, WORLD_H), b0 = toScreen(0, WORLD_H);
  ctx.lineTo(b1.x, b1.y); ctx.lineTo(b0.x, b0.y); ctx.closePath();
  const g = ctx.createLinearGradient(0, Math.max(0, toScreen(0, 760).y), 0, innerHeight);
  g.addColorStop(0, '#183038'); g.addColorStop(0.3, '#10212b'); g.addColorStop(1, '#05080d');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(105,255,212,.32)'; ctx.lineWidth = Math.max(1, 2 * camera.zoom);
  ctx.shadowBlur = quality === 'battery' ? 3 : 11; ctx.shadowColor = '#56ffd1'; ctx.stroke();
  ctx.shadowBlur = 0;
  if (overlay !== 'off') {
    const cellW = WORLD_W / world.climate.length;
    for (const cell of world.climate) {
      const p = toScreen(cell.x - cellW / 2, 0), q = toScreen(cell.x + cellW / 2, WORLD_H);
      const color = overlayColor(cell); if (!color) continue;
      ctx.fillStyle = color; ctx.fillRect(p.x, 0, q.x - p.x, innerHeight);
    }
  }
  ctx.restore();
}

function drawPlants(now) {
  if (!world) return;
  ctx.save(); ctx.lineCap = 'round';
  for (const p of world.plants) {
    const base = toScreen(p.x, p.y);
    if (base.x < -100 || base.x > innerWidth + 100 || base.y < -160 || base.y > innerHeight + 100) continue;
    const sway = Math.sin(now * 0.0012 + p.phase) * (2 + Math.abs(world.wind) * 0.018);
    if (quality !== 'battery' && camera.zoom > 0.5) {
      ctx.strokeStyle = `hsla(${p.hue - 35},60%,35%,.25)`; ctx.lineWidth = Math.max(1, camera.zoom);
      for (let i = 1; i < p.root.length; i++) {
        const a = toScreen(p.root[i - 1].x, p.root[i - 1].y), b = toScreen(p.root[i].x, p.root[i].y);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
    ctx.strokeStyle = `hsl(${p.hue} 55% ${30 + p.health * 26}%)`; ctx.lineWidth = Math.max(2, p.crown * 0.11 * camera.zoom);
    ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.quadraticCurveTo(base.x + sway * 0.3, base.y - p.height * 0.55 * camera.zoom, base.x + sway, base.y - p.height * camera.zoom); ctx.stroke();
    const crownY = base.y - p.height * camera.zoom;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `hsla(${p.carnivore ? 330 : p.hue + 24},85%,${42 + p.sugar * 24}%,${0.35 + p.health * 0.42})`;
    ctx.shadowColor = `hsl(${p.carnivore ? 330 : p.hue + 30} 100% 60%)`; ctx.shadowBlur = quality === 'battery' ? 3 : 9;
    ctx.beginPath(); ctx.ellipse(base.x + sway, crownY, p.crown * camera.zoom, p.crown * 0.47 * camera.zoom, sway * 0.02, 0, TAU); ctx.fill();
    if (p.carnivore) {
      ctx.strokeStyle = 'rgba(255,225,240,.7)'; ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) { const a = i / 4 * TAU; ctx.beginPath(); ctx.moveTo(base.x + sway, crownY); ctx.lineTo(base.x + sway + Math.cos(a) * p.crown * camera.zoom, crownY + Math.sin(a) * p.crown * 0.45 * camera.zoom); ctx.stroke(); }
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;
  }
  ctx.restore();
}

function drawCarcasses() {
  if (!world) return;
  for (const c of world.carcasses) {
    const p = toScreen(c.x, c.y); if (p.x < -50 || p.x > innerWidth + 50 || p.y < -50 || p.y > innerHeight + 50) continue;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.sin(c.age * 0.4) * 0.1);
    ctx.strokeStyle = `hsla(${c.hue},55%,38%,${clamp(c.mass * 0.08, 0.15, 0.65)})`; ctx.lineWidth = Math.max(2, 4 * camera.zoom);
    ctx.beginPath(); ctx.ellipse(0, 0, 18 * camera.zoom, 7 * camera.zoom, 0, 0, TAU); ctx.stroke();
    ctx.restore();
  }
}

function injuryColor(health, fracture, hue) {
  if (fracture > 0.25) return `hsla(355,100%,70%,${0.5 + fracture * 0.45})`;
  if (health < 0.65) return `hsla(20,95%,65%,.75)`;
  return `hsla(${hue + 68},90%,78%,.72)`;
}

function drawCreature(c, now) {
  const head = toScreen(c.x, c.y);
  if (head.x < -150 || head.x > innerWidth + 150 || head.y < -180 || head.y > innerHeight + 150) return;
  const r = c.r * camera.zoom;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.globalCompositeOperation = 'lighter';
  ctx.shadowColor = `hsl(${c.hue} 100% 62%)`; ctx.shadowBlur = quality === 'battery' ? 3 : 11;

  for (const limb of c.limbs) {
    const a = toScreen(c.points[limb.anchor].x, c.points[limb.anchor].y), b = toScreen(c.points[limb.upper].x, c.points[limb.upper].y), f = toScreen(c.points[limb.foot].x, c.points[limb.foot].y);
    ctx.strokeStyle = injuryColor(limb.health, limb.fracture, c.hue); ctx.lineWidth = Math.max(1.3, r * 0.11);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(f.x, f.y); ctx.stroke();
    if (limb.planted) { ctx.fillStyle = `hsla(${c.hue + 110},90%,75%,.55)`; ctx.beginPath(); ctx.ellipse(f.x, f.y, r * 0.22, r * 0.08, 0, 0, TAU); ctx.fill(); }
  }

  ctx.strokeStyle = `hsla(${c.hue},88%,62%,.58)`; ctx.lineWidth = Math.max(2, r * 0.34);
  ctx.beginPath();
  for (let i = 0; i < c.spineCount; i++) { const p = toScreen(c.points[i].x, c.points[i].y); if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
  ctx.stroke();

  ctx.shadowBlur = 0;
  for (let i = c.spineCount - 1; i >= 0; i--) {
    const point = c.points[i], p = toScreen(point.x, point.y), t = i / Math.max(1, c.spineCount - 1), br = r * (0.45 - t * 0.14);
    const g = ctx.createRadialGradient(p.x - br * 0.3, p.y - br * 0.3, 1, p.x, p.y, br);
    g.addColorStop(0, `hsl(${c.hue + 55} 100% 86%)`); g.addColorStop(0.35, `hsl(${c.hue} 92% ${48 + point.health * 15}%)`); g.addColorStop(1, `hsl(${c.hue - 28} 80% 23%)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(p.x, p.y, br, br * 0.72, 0, 0, TAU); ctx.fill();
    if (point.fracture > 0.2) { ctx.strokeStyle = `rgba(255,80,115,${point.fracture})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x - br * 0.5, p.y - br * 0.3); ctx.lineTo(p.x + br * 0.4, p.y + br * 0.2); ctx.stroke(); }
  }

  ctx.save(); ctx.translate(head.x, head.y); ctx.scale(c.facing, 1);
  ctx.fillStyle = `hsl(${c.hue} 94% ${48 + c.health * 12}%)`; ctx.beginPath(); ctx.ellipse(r * 0.38, 0, r * 0.5, r * 0.42, 0, 0, TAU); ctx.fill();
  const eyes = clamp(Math.round(c.genes.vision * 2), 1, 5);
  for (let i = 0; i < eyes; i++) { const ey = (-0.25 + i * (0.5 / Math.max(1, eyes - 1))) * r; ctx.fillStyle = '#efffff'; ctx.beginPath(); ctx.arc(r * 0.55, ey, r * 0.08, 0, TAU); ctx.fill(); ctx.fillStyle = '#061017'; ctx.beginPath(); ctx.arc(r * 0.58, ey, r * 0.034, 0, TAU); ctx.fill(); }
  if (c.meta.predator) { ctx.strokeStyle = 'rgba(255,240,250,.85)'; ctx.lineWidth = 1.4; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(r * 0.7, r * (0.12 + i * 0.08)); ctx.lineTo(r * 0.92, r * (0.18 + i * 0.08)); ctx.stroke(); } }
  if (c.meta.flyer) { ctx.fillStyle = `hsla(${c.hue + 100},95%,68%,.25)`; ctx.beginPath(); ctx.ellipse(-r * 0.35, -r * 0.25, r * 1.1, r * 0.25, -0.28, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(-r * 0.35, r * 0.25, r * 1.1, r * 0.25, 0.28, 0, TAU); ctx.fill(); }
  ctx.restore();

  if (c.id === world.observedId) {
    ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(head.x, head.y, r * 1.75 + Math.sin(now * 0.006) * 3, 0, TAU); ctx.stroke();
  }
  if (c.mode === 'freeze' && quality !== 'battery') { ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = 'rgba(210,240,255,.12)'; ctx.beginPath(); ctx.arc(head.x, head.y, r * 1.4, 0, TAU); ctx.fill(); }
  ctx.restore();
}

function drawEffects() {
  if (!world) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const e of world.effects) {
    const p = toScreen(e.x, e.y), t = e.t / e.life, rad = (30 + t * 320) * camera.zoom;
    ctx.strokeStyle = `hsla(${e.hue},100%,68%,${1 - t})`; ctx.lineWidth = Math.max(1, 5 * (1 - t)); ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, TAU); ctx.stroke();
  }
  for (const p of world.particles) { const q = toScreen(p.x, p.y); ctx.fillStyle = `hsla(${p.hue},100%,66%,${clamp(p.life / p.max, 0, 1)})`; ctx.fillRect(q.x, q.y, p.size * camera.zoom, p.size * camera.zoom); }
  ctx.restore();
}

function render(now) {
  drawBackground(now);
  if (!world) return;
  drawTerrain(); drawPlants(now); drawCarcasses();
  const ordered = [...world.creatures].sort((a, b) => a.y - b.y);
  for (const c of ordered) drawCreature(c, now);
  drawEffects();
}

function updateInspector() {
  if (!world || !world.observedId) { $('inspector').hidden = true; return; }
  const c = world.creatures.find(x => x.id === world.observedId);
  if (!c) { $('inspector').hidden = true; return; }
  $('inspector').hidden = false;
  $('inspectName').textContent = c.name;
  $('inspectSpecies').textContent = `${c.meta.name} • ${c.mode.replaceAll('-', ' ')} • ${Math.round(c.age)} simulated seconds old`;
  setBar('vEnergy', c.energy); setBar('vWater', c.hydration); setBar('vBlood', c.blood); setBar('vOxygen', c.oxygen); setBar('vPain', c.pain, true); setBar('vStress', c.stress, true);
  $('iMode').textContent = c.mode.toUpperCase(); $('iTemp').textContent = `${c.bodyTemp.toFixed(1)}°`; $('iLimbs').textContent = c.limbCount;
  $('iFractures').textContent = c.points.filter(p => p.fracture > 0.2).length; $('iMemory').textContent = c.memory.length; $('iGeneration').textContent = c.generation;
}

function updateUI() {
  if (!world) return;
  const s = world.stats();
  $('population').textContent = s.population; $('species').textContent = s.species; $('plants').textContent = s.plants; $('injured').textContent = s.injured; $('generation').textContent = s.generation; $('fps').textContent = Math.round(fps);
  $('biome').textContent = `${resolvedDevice().toUpperCase()} • ${quality.toUpperCase()} • ${overlay.toUpperCase()}`;
  updateInspector();
  if (messageTimer > 0) { messageTimer -= 0.12; if (messageTimer <= 0) $('message').classList.remove('show'); }
}

function loop(now) {
  const dt = Math.min(0.08, (now - last) / 1000); last = now; fps = fps * 0.92 + (dt ? 1 / dt : 60) * 0.08;
  accumulator += dt; let guard = 0;
  while (accumulator >= 1 / 60 && guard++ < 4) { if (world && !paused) world.step(1 / 60); accumulator -= 1 / 60; }
  if (world && followId) { const c = world.creatures.find(x => x.id === followId); if (c) { camera.x = lerp(camera.x, c.x, 0.07); camera.y = lerp(camera.y, c.y, 0.07); } else followId = null; }
  render(now); if (frames++ % 7 === 0) updateUI();
  if (quality === 'auto' && frames % 300 === 0) {
    if (fps < 43) { quality = 'battery'; resize(); showMessage('Thermal-safe graphics enabled.'); }
    else if (fps > 58 && (devicePixelRatio || 1) > 1.3) { quality = 'high'; resize(); }
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function choosePower(kind) {
  selectedPower = kind;
  document.querySelectorAll('.power').forEach(b => b.classList.toggle('selected', b.dataset.power === kind));
  showMessage(POWER_TEXT[kind], 3.5);
}
document.querySelectorAll('.power').forEach(b => b.addEventListener('click', () => choosePower(b.dataset.power)));

canvas.addEventListener('pointerdown', e => {
  e.preventDefault(); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); canvas.setPointerCapture?.(e.pointerId);
  gesture.moved = false; gesture.lastX = e.clientX; gesture.lastY = e.clientY;
  if (pointers.size === 2) { const a = [...pointers.values()]; gesture.startDist = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); gesture.startZoom = camera.zoom; }
});
canvas.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId)) return; e.preventDefault(); const p = pointers.get(e.pointerId); p.x = e.clientX; p.y = e.clientY;
  if (pointers.size === 1) {
    const dx = e.clientX - gesture.lastX, dy = e.clientY - gesture.lastY;
    if (Math.hypot(dx, dy) > 2) { gesture.moved = true; followId = null; camera.x = clamp(camera.x - dx / camera.zoom, innerWidth * 0.25 / camera.zoom, WORLD_W - innerWidth * 0.25 / camera.zoom); camera.y = clamp(camera.y - dy / camera.zoom, 220, WORLD_H - 120); }
    gesture.lastX = e.clientX; gesture.lastY = e.clientY;
  } else if (pointers.size === 2) {
    const a = [...pointers.values()], d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
    camera.zoom = clamp(gesture.startZoom * d / Math.max(1, gesture.startDist), 0.3, 1.6); gesture.moved = true;
  }
});
function endPointer(e) {
  if (!pointers.has(e.pointerId)) return;
  const wasTap = !gesture.moved && pointers.size === 1, p = pointers.get(e.pointerId); pointers.delete(e.pointerId);
  if (wasTap && world && !paused) {
    const q = toWorld(p.x, p.y);
    if (selectedPower === 'inspect') {
      const c = world.inspectAt(q.x, q.y, 115 / camera.zoom);
      if (c) { showMessage(`${c.name}: ${c.mode}. ${c.points.filter(x => x.fracture > 0.2).length} fractures.`, 3); navigator.vibrate?.(8); }
      else showMessage('No organism detected at that point.');
    } else { world.applyPower(selectedPower, clamp(q.x, 0, WORLD_W), clamp(q.y, 0, WORLD_H)); navigator.vibrate?.(selectedPower === 'quake' || selectedPower === 'storm' ? 22 : 9); }
  }
  if (pointers.size < 2) { gesture.lastX = e.clientX; gesture.lastY = e.clientY; }
}
canvas.addEventListener('pointerup', endPointer); canvas.addEventListener('pointercancel', endPointer); canvas.addEventListener('lostpointercapture', endPointer);

function setPause(value) { paused = value; $('pause').classList.toggle('show', paused && started); }
$('pauseBtn').onclick = () => setPause(true);
$('resumeBtn').onclick = () => setPause(false);
$('newWorldBtn').onclick = () => startWorld(false);
$('settingsBtn').onclick = () => { setPause(false); paused = true; $('pause').classList.remove('show'); $('setup').classList.add('show'); started = false; };
$('closeInspector').onclick = () => { if (world) world.observedId = null; followId = null; $('inspector').hidden = true; };
$('followBtn').onclick = () => { if (world?.observedId) { followId = world.observedId; showMessage('Camera following organism. Drag to release.'); } };
$('overlayBtn').onclick = () => {
  overlay = OVERLAYS[(OVERLAYS.indexOf(overlay) + 1) % OVERLAYS.length];
  $('legend').hidden = overlay === 'off'; $('legend').textContent = overlay === 'off' ? '' : `${overlay.toUpperCase()} FIELD`;
  showMessage(overlay === 'off' ? 'Scientific overlay off.' : `${overlay} field visible.`);
};
$('qualityBtn').onclick = () => { quality = quality === 'auto' ? 'high' : quality === 'high' ? 'battery' : 'auto'; settings.graphics = quality; saveSettings(); $('qualityLabel').textContent = quality.toUpperCase(); resize(); };
$('qualityLabel').textContent = quality.toUpperCase();

function selectSetting(group, value) {
  settings[group] = value;
  document.querySelectorAll(`[data-setting="${group}"] button`).forEach(b => b.classList.toggle('selected', b.dataset.value === value));
}
document.querySelectorAll('.segmented').forEach(root => root.querySelectorAll('button').forEach(b => b.onclick = () => selectSetting(root.dataset.setting, b.dataset.value)));

function bindSlider(id, key, label, suffix) {
  const input = $(id), out = $(label); input.value = settings[key]; out.textContent = `${input.value}${suffix}`;
  input.oninput = () => { settings[key] = Number(input.value); out.textContent = `${input.value}${suffix}`; };
}
bindSlider('populationInput', 'population', 'populationValue', ' creatures');
bindSlider('creepyInput', 'creepy', 'creepyValue', ' / 10');
bindSlider('injuryInput', 'injury', 'injuryValue', ' / 10');
bindSlider('evolutionInput', 'evolution', 'evolutionValue', ' / 10');
bindSlider('climateInput', 'climate', 'climateValue', ' / 10');
for (const group of ['device','graphics','anatomy','plants']) selectSetting(group, settings[group]);

document.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => {
  const p = b.dataset.preset;
  if (p === 'stable') settings = { ...settings, population: 68, creepy: 2, injury: 3, evolution: 3, climate: 3, anatomy: 'full', plants: 'deep' };
  if (p === 'creepy') settings = { ...settings, population: 82, creepy: 10, injury: 7, evolution: 6, climate: 7, anatomy: 'full', plants: 'deep' };
  if (p === 'maximum') settings = { ...settings, population: resolvedDevice() === 'ipad' ? 145 : 105, creepy: 8, injury: 8, evolution: 8, climate: 8, anatomy: 'full', plants: 'deep', graphics: 'high' };
  for (const [id, key, label, suffix] of [['populationInput','population','populationValue',' creatures'],['creepyInput','creepy','creepyValue',' / 10'],['injuryInput','injury','injuryValue',' / 10'],['evolutionInput','evolution','evolutionValue',' / 10'],['climateInput','climate','climateValue',' / 10']]) { $(id).value = settings[key]; $(label).textContent = `${settings[key]}${suffix}`; }
  for (const group of ['graphics','anatomy','plants']) selectSetting(group, settings[group]);
  showMessage(`${p.toUpperCase()} preset loaded.`);
});

function startWorld(closeSetup = true) {
  saveSettings(); quality = settings.graphics; resize();
  world = new World((Date.now() ^ 0x51f15e) >>> 0, worldSettings());
  camera.x = WORLD_W * 0.5; camera.y = 920; camera.zoom = resolvedDevice() === 'ipad' ? 0.78 : 0.66;
  followId = null; started = true; paused = false;
  if (closeSetup) $('setup').classList.remove('show');
  $('pause').classList.remove('show');
  showMessage(`Living Bodies v9 started: ${world.creatures.length} autonomous organisms.`, 5);
}
$('beginBtn').onclick = () => startWorld(true);

addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; });
$('installBtn').onclick = async () => { if (deferredInstall) { deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; } else showMessage('iPhone or iPad: Safari Share → Add to Home Screen.', 4); };

function createRating() {
  const root = $('stars'), saved = Number(localStorage.getItem('gg_v9_rating') || 0), choice = localStorage.getItem('gg_v9_feedback') || '';
  for (let i = 1; i <= 10; i++) { const b = document.createElement('button'); b.textContent = '★'; b.classList.toggle('on', i <= saved); b.onclick = () => { localStorage.setItem('gg_v9_rating', String(i)); [...root.children].forEach((x, n) => x.classList.toggle('on', n < i)); $('ratingText').textContent = `${i}/10`; }; root.append(b); }
  if (saved) $('ratingText').textContent = `${saved}/10`;
  document.querySelectorAll('[data-feedback]').forEach(b => { b.classList.toggle('selected', b.dataset.feedback === choice); b.onclick = () => { localStorage.setItem('gg_v9_feedback', b.dataset.feedback); document.querySelectorAll('[data-feedback]').forEach(x => x.classList.toggle('selected', x === b)); }; });
}
createRating();

addEventListener('visibilitychange', () => { if (document.hidden && started) setPause(true); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('../sw.js?v=9', { updateViaCache: 'none' }).catch(() => {});
