import { World, TILE, MAP_W, MAP_H, WORLD_W, WORLD_H, ROLE, BIOMES, clamp, lerp, TAU } from './science-sim-v7.js?v=7';

const $ = id => document.getElementById(id);
const canvas = $('game');
const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
if (!ctx) throw new Error('Canvas 2D is unavailable on this browser.');

const capability = (() => {
  const memory = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  const reduced = matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
  const pixels = Math.max(screen.width, innerWidth) * Math.max(screen.height, innerHeight) * (devicePixelRatio || 1);
  let tier = 'medium';
  if (memory <= 2 || cores <= 3 || pixels < 600_000 || reduced) tier = 'low';
  else if (memory >= 8 && cores >= 8 && pixels > 2_000_000) tier = 'ultra';
  else if (memory >= 6 && cores >= 6) tier = 'high';
  return { memory, cores, reduced, pixels, tier };
})();

const QUALITY = {
  low: { dpr: 1, stars: 28, motes: 20, rain: 55, fog: 1, shadows: 0, creatureDetail: 0, chunkDecor: 0 },
  medium: { dpr: 1.35, stars: 62, motes: 42, rain: 105, fog: 2, shadows: 7, creatureDetail: 1, chunkDecor: 1 },
  high: { dpr: 1.7, stars: 100, motes: 72, rain: 175, fog: 3, shadows: 12, creatureDetail: 2, chunkDecor: 2 },
  ultra: { dpr: 2.15, stars: 150, motes: 105, rain: 260, fog: 4, shadows: 18, creatureDetail: 3, chunkDecor: 3 }
};

let preference = localStorage.getItem('fw_quality_v7') || 'auto';
let renderTier = preference === 'auto' ? capability.tier : preference;
if (!QUALITY[renderTier]) renderTier = capability.tier;
let settings = QUALITY[renderTier];
let world = new World((Date.now() ^ 0x71c3a5) >>> 0, { performanceTier: renderTier });
let camera = { x: world.player.x, y: world.player.y, zoom: 1, shake: 0 };
let last = performance.now(), accumulator = 0, fps = 60, uiClock = 0, adaptiveClock = 0, stableClock = 0, dpr = 1;
let deferredInstall = null, pausedByVisibility = false, scannerPulse = 0;
const key = new Set();
const control = { x: 0, y: 0, jump: false, grab: false, bite: false, dash: false, scan: false };
const touch = { stickId: null, stickX: 0, stickY: 0, jump: false, grab: false, bite: false, dash: false, scan: false };

const ui = {
  cycle: $('cycle'), food: $('food'), health: $('health'), energy: $('energy'), rain: $('rain'), room: $('room'),
  points: $('points'), bucks: $('bucks'), research: $('research'), species: $('species'), mission: $('mission'), missionProgress: $('missionProgress'),
  samples: $('samples'), oxygen: $('oxygen'), toxin: $('toxin'), population: $('population'), fps: $('fps'), quality: $('qualityLabel'),
  message: $('message'), pause: $('pausePanel'), death: $('deathPanel'), intro: $('introPanel'), evolution: $('evolutionPanel'), evolutionChoices: $('evolutionChoices')
};

class AudioCore {
  constructor() { this.ctx = null; this.master = null; this.enabled = localStorage.getItem('fw_sound') !== 'off'; }
  start() {
    if (!this.enabled || this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = 0.10; this.master.connect(this.ctx.destination);
    const osc = this.ctx.createOscillator(), gain = this.ctx.createGain(), filter = this.ctx.createBiquadFilter();
    osc.type = 'sine'; osc.frequency.value = 46; filter.type = 'lowpass'; filter.frequency.value = 160; gain.gain.value = 0.06;
    osc.connect(filter).connect(gain).connect(this.master); osc.start(); this.ambience = { osc, gain };
  }
  blip(freq = 220, duration = 0.08, volume = 0.12, type = 'sine') {
    if (!this.ctx || !this.enabled) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(volume, this.ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    o.connect(g).connect(this.master); o.start(); o.stop(this.ctx.currentTime + duration);
  }
  update() { if (this.ambience) this.ambience.osc.frequency.setTargetAtTime(42 + world.rainIntensity * 24 + world.ecology.toxin * 15, this.ctx.currentTime, 0.3); }
}
const audio = new AudioCore();

const visual = { stars: [], motes: [], fog: [], spores: [] };
function rebuildVisualCache() {
  settings = QUALITY[renderTier]; visual.stars.length = visual.motes.length = visual.fog.length = visual.spores.length = 0;
  for (let i = 0; i < settings.stars; i++) visual.stars.push({ x: Math.random(), y: Math.random(), z: Math.random(), a: Math.random() });
  for (let i = 0; i < settings.motes; i++) visual.motes.push({ x: Math.random(), y: Math.random(), s: 0.5 + Math.random() * 2.6, p: Math.random() * TAU, hue: 145 + Math.random() * 180 });
  for (let i = 0; i < settings.fog; i++) visual.fog.push({ x: Math.random(), y: Math.random(), r: 0.25 + Math.random() * 0.45, p: Math.random() * TAU });
  for (let i = 0; i < settings.motes * 0.6; i++) visual.spores.push({ x: Math.random(), y: Math.random(), p: Math.random() * TAU, s: 1 + Math.random() * 2 });
}
rebuildVisualCache();

function resize() {
  const rect = canvas.getBoundingClientRect();
  dpr = Math.min(settings.dpr, devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.floor(rect.width * dpr)); canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); tileCache.clear();
}
addEventListener('resize', resize, { passive: true });

function readControls() {
  let x = touch.stickX, y = touch.stickY;
  if (key.has('ArrowLeft') || key.has('KeyA')) x -= 1;
  if (key.has('ArrowRight') || key.has('KeyD')) x += 1;
  if (key.has('ArrowUp') || key.has('KeyW')) y -= 1;
  if (key.has('ArrowDown') || key.has('KeyS')) y += 1;
  control.x = clamp(x, -1, 1); control.y = clamp(y, -1, 1);
  control.jump = touch.jump || key.has('Space') || key.has('KeyW') || key.has('ArrowUp');
  control.grab = touch.grab || key.has('ShiftLeft') || key.has('KeyE');
  control.bite = touch.bite || key.has('KeyF') || key.has('KeyK');
  control.dash = touch.dash || key.has('KeyL') || key.has('ControlLeft');
  control.scan = touch.scan || key.has('KeyQ') || key.has('KeyR');
  return control;
}

addEventListener('keydown', e => {
  key.add(e.code); if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
});
addEventListener('keyup', e => key.delete(e.code));

function bindHold(id, field, sound = 180) {
  const el = $(id); if (!el) return;
  const down = e => { e.preventDefault(); audio.start(); touch[field] = true; el.classList.add('pressed'); el.setPointerCapture?.(e.pointerId); audio.blip(sound, 0.045, 0.05); };
  const up = e => { e.preventDefault(); touch[field] = false; el.classList.remove('pressed'); };
  el.addEventListener('pointerdown', down); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
}
bindHold('jumpBtn', 'jump', 260); bindHold('grabBtn', 'grab', 110); bindHold('biteBtn', 'bite', 72); bindHold('dashBtn', 'dash', 160); bindHold('scanBtn', 'scan', 520);

const stick = $('stick'), knob = $('stickKnob');
function moveStick(e) {
  if (touch.stickId !== e.pointerId) return;
  const r = stick.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  const max = r.width * 0.31, len = Math.hypot(dx, dy) || 1, scale = Math.min(1, max / len), px = dx * scale, py = dy * scale;
  touch.stickX = clamp(px / max, -1, 1); touch.stickY = clamp(py / max, -1, 1); knob.style.transform = `translate(${px}px,${py}px)`;
}
stick.addEventListener('pointerdown', e => { e.preventDefault(); audio.start(); touch.stickId = e.pointerId; stick.setPointerCapture(e.pointerId); moveStick(e); });
stick.addEventListener('pointermove', moveStick);
function endStick(e) { if (touch.stickId !== e.pointerId) return; touch.stickId = null; touch.stickX = touch.stickY = 0; knob.style.transform = 'translate(0,0)'; }
stick.addEventListener('pointerup', endStick); stick.addEventListener('pointercancel', endStick);

function togglePause(force) {
  const next = typeof force === 'boolean' ? force : !world.paused;
  if (world.pendingEvolution && !next) return;
  world.paused = next; ui.pause.classList.toggle('show', next && !world.pendingEvolution); audio.blip(next ? 90 : 180, 0.08, 0.06);
}
$('pauseBtn').onclick = () => togglePause(); $('resumeBtn').onclick = () => togglePause(false);
$('restartBtn').onclick = () => { world = new World((Date.now() ^ 0x713d) >>> 0, { performanceTier: renderTier }); camera.x = world.player.x; camera.y = world.player.y; tileCache.clear(); togglePause(false); };
$('respawnBtn').onclick = () => { world.respawn(); ui.death.classList.remove('show'); camera.x = world.player.x; camera.y = world.player.y; };
$('playBtn').onclick = () => { audio.start(); ui.intro.classList.remove('show'); };
$('howBtn').onclick = () => $('howPanel').classList.toggle('show');

$('qualityBtn').onclick = () => {
  preference = preference === 'auto' ? 'ultra' : preference === 'ultra' ? 'high' : preference === 'high' ? 'medium' : preference === 'medium' ? 'low' : 'auto';
  localStorage.setItem('fw_quality_v7', preference); setRenderTier(preference === 'auto' ? capability.tier : preference, true);
};
function setRenderTier(tier, announce = false) {
  if (!QUALITY[tier]) tier = 'medium'; renderTier = tier; world.setPerformanceTier(tier); rebuildVisualCache(); resize();
  if (ui.quality) ui.quality.textContent = `${preference.toUpperCase()} · ${tier.toUpperCase()}`;
  if (announce) world.toast(`Adaptive renderer: ${tier.toUpperCase()} mode.`);
}

addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; $('installBtn').classList.add('ready'); });
$('installBtn').onclick = async () => { if (deferredInstall) { deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; } else world.toast('iPhone: Safari Share → Add to Home Screen.'); };

function createRating() {
  const stars = $('stars'), saved = Number(localStorage.getItem('fw_rating') || 0), choice = localStorage.getItem('fw_choice') || '';
  for (let i = 1; i <= 10; i++) { const b = document.createElement('button'); b.textContent = '★'; b.classList.toggle('on', i <= saved); b.onclick = () => { localStorage.setItem('fw_rating', String(i)); [...stars.children].forEach((x, n) => x.classList.toggle('on', n < i)); $('ratingText').textContent = `${i}/10`; }; stars.append(b); }
  if (saved) $('ratingText').textContent = `${saved}/10`;
  document.querySelectorAll('[data-feedback]').forEach(b => { b.classList.toggle('selected', b.dataset.feedback === choice); b.onclick = () => { localStorage.setItem('fw_choice', b.dataset.feedback); document.querySelectorAll('[data-feedback]').forEach(x => x.classList.toggle('selected', x === b)); }; });
}
createRating();

function runScienceDirector() {
  const now = Date.now(), lastReview = Number(localStorage.getItem('fw_science_review') || 0); if (now - lastReview < 2 * 60 * 60 * 1000) return;
  localStorage.setItem('fw_science_review', String(now)); const s = world.stats();
  const prey = (s.counts.nibbler || 0) + (s.counts.skitter || 0) + (s.counts.glider || 0), predators = (s.counts.hunter || 0) + (s.counts.lurker || 0);
  if (predators > prey * 0.38) { for (const f of world.map.food) if (!f.alive && Math.random() < 0.35) { f.alive = true; f.regrow = 0; } world.toast('Science Director: primary production increased after predator pressure rose.', 6); }
  else if (s.species < 9) { for (let i = 0; i < 4; i++) { const tx = 40 + i * 28, role = i % 2 ? 'skitter' : 'nibbler'; world.creatures.push(new world.player.constructor(world, role, tx * TILE, (world.map.findFloor(tx) - 1.2) * TILE)); } world.toast('Science Director: isolated founder populations introduced.', 6); }
  else world.toast('Science Director: ecological indicators are stable. No intervention.', 5);
}
runScienceDirector(); setInterval(runScienceDirector, 60_000);

function worldToScreen(x, y) { return { x: (x - camera.x) * camera.zoom + innerWidth / 2, y: (y - camera.y) * camera.zoom + innerHeight / 2 }; }

class TileChunkCache {
  constructor() { this.map = new Map(); this.size = 12; }
  clear() { this.map.clear(); }
  get(cx, cy) {
    const biomeIndex = world.map.roomAt((cx * this.size + this.size / 2) * TILE), key = `${world.seed}:${renderTier}:${cx}:${cy}:${biomeIndex}`;
    if (this.map.has(key)) return this.map.get(key);
    const sizePx = this.size * TILE, off = document.createElement('canvas'); off.width = off.height = sizePx; const c = off.getContext('2d');
    const biome = BIOMES[biomeIndex];
    for (let ly = 0; ly < this.size; ly++) for (let lx = 0; lx < this.size; lx++) {
      const tx = cx * this.size + lx, ty = cy * this.size + ly, tile = world.map.get(tx, ty), x = lx * TILE, y = ly * TILE;
      if (tile === 1) {
        const n = (tx * 17 + ty * 31 + world.seed) % 100, light = 9 + n % 8;
        c.fillStyle = `hsl(${biome.hue + (n % 18) - 9},${28 + n % 24}%,${light}%)`; c.fillRect(x, y, TILE + 1, TILE + 1);
        if (world.map.get(tx, ty - 1) !== 1) {
          const g = c.createLinearGradient(0, y, 0, y + TILE * 0.75); g.addColorStop(0, `hsla(${biome.hue + 25},95%,68%,.75)`); g.addColorStop(0.2, `hsla(${biome.hue},70%,38%,.42)`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x, y, TILE, TILE * 0.78);
          if (settings.chunkDecor > 0) { c.fillStyle = `hsla(${biome.hue + 80},100%,82%,.22)`; for (let i = 0; i < settings.chunkDecor + 1; i++) c.fillRect(x + ((n + i * 11) % 28), y - (i % 2) * 2, 2, 4 + n % 7); }
        }
        if (settings.chunkDecor > 1 && n < 12) { c.fillStyle = `hsla(${biome.hue + 120},90%,64%,.14)`; c.beginPath(); c.arc(x + TILE * .68, y + TILE * .52, TILE * .15, 0, TAU); c.fill(); }
      } else if (tile === 2) {
        const g = c.createLinearGradient(0, y, 0, y + TILE); g.addColorStop(0, `hsla(${biome.hue + 40},90%,55%,.36)`); g.addColorStop(1, 'rgba(5,22,45,.82)'); c.fillStyle = g; c.fillRect(x, y, TILE + 1, TILE + 1);
      }
    }
    this.map.set(key, off); if (this.map.size > 120) this.map.delete(this.map.keys().next().value); return off;
  }
}
const tileCache = new TileChunkCache();

function drawBackground(now) {
  const w = innerWidth, h = innerHeight, biome = world.map.biomeAt(world.player.x);
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, world.rainPhase === 'rain' ? '#040b18' : `hsl(${biome.hue + 80},45%,9%)`); g.addColorStop(.58, `hsl(${biome.hue + 25},44%,8%)`); g.addColorStop(1, '#010407'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  for (const s of visual.stars) { const px = (s.x * w - camera.x * .014 * s.z + w * 3) % w, py = s.y * h * .73; ctx.fillStyle = `hsla(${biome.hue + 40 + s.z * 100},90%,75%,${.06 + s.a * .42})`; ctx.fillRect(px, py, 1 + s.z * 2, 1 + s.z * 2); }
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  const layers = renderTier === 'low' ? 2 : 4;
  for (let layer = 0; layer < layers; layer++) {
    const base = h * (.54 + layer * .09), scale = .025 + layer * .016; ctx.fillStyle = `hsla(${biome.hue + layer * 34},65%,${8 + layer * 3}%,${.4 + layer * .08})`; ctx.beginPath(); ctx.moveTo(0, h);
    for (let x = 0; x <= w + 30; x += renderTier === 'low' ? 38 : 22) { const wx = x + camera.x * scale, y = base + Math.sin(wx * .011 + layer) * 28 + Math.sin(wx * .0041) * 62; ctx.lineTo(x, y); }
    ctx.lineTo(w, h); ctx.fill();
  }
  ctx.restore();
  for (const m of visual.motes) { const x = (m.x * w + Math.sin(now * .0004 + m.p) * 52) % w, y = (m.y * h + Math.cos(now * .00032 + m.p) * 28) % h; ctx.fillStyle = `hsla(${m.hue},100%,72%,${.04 + .08 * Math.sin(now * .002 + m.p)})`; ctx.beginPath(); ctx.arc(x, y, m.s, 0, TAU); ctx.fill(); }
}

function drawTiles() {
  const chunkWorld = tileCache.size * TILE, left = Math.max(0, Math.floor((camera.x - innerWidth / (2 * camera.zoom)) / chunkWorld) - 1), right = Math.min(Math.ceil(MAP_W / tileCache.size), Math.ceil((camera.x + innerWidth / (2 * camera.zoom)) / chunkWorld) + 1);
  const top = Math.max(0, Math.floor((camera.y - innerHeight / (2 * camera.zoom)) / chunkWorld) - 1), bottom = Math.min(Math.ceil(MAP_H / tileCache.size), Math.ceil((camera.y + innerHeight / (2 * camera.zoom)) / chunkWorld) + 1);
  for (let cy = top; cy <= bottom; cy++) for (let cx = left; cx <= right; cx++) { const p = worldToScreen(cx * chunkWorld, cy * chunkWorld), image = tileCache.get(cx, cy); ctx.drawImage(image, p.x, p.y, chunkWorld * camera.zoom, chunkWorld * camera.zoom); }
}

function drawVines(now) {
  ctx.lineCap = 'round';
  for (const v of world.map.vines) { const a = worldToScreen(v.x, v.y1), b = worldToScreen(v.x, v.y2); if (a.x < -40 || a.x > innerWidth + 40 || b.y < -40 || a.y > innerHeight + 40) continue; ctx.strokeStyle = 'rgba(88,244,177,.50)'; ctx.lineWidth = 3 * camera.zoom; ctx.beginPath(); ctx.moveTo(a.x, a.y); for (let i = 1; i <= 8; i++) { const t = i / 8; ctx.lineTo(lerp(a.x,b.x,t) + Math.sin(t * 12 + now * .001) * 5, lerp(a.y,b.y,t)); } ctx.stroke(); }
}

function drawVents(now) {
  if (renderTier === 'low') return;
  for (const v of world.map.vents) { const p = worldToScreen(v.x, v.y); if (p.x < -80 || p.x > innerWidth + 80 || p.y < -80 || p.y > innerHeight + 80) continue; ctx.save(); ctx.translate(p.x,p.y); ctx.globalCompositeOperation='screen'; for (let i=0;i<3;i++){const rise=((now*.03+i*27+v.phase*40)%85);ctx.fillStyle=`rgba(255,90,205,${.16*(1-rise/85)})`;ctx.beginPath();ctx.arc(Math.sin(rise*.12+i)*7,-rise,8+rise*.08,0,TAU);ctx.fill()} ctx.restore(); }
}

function drawDens(now) {
  for (const d of world.map.dens) { const p = worldToScreen(d.x, d.y); if (p.x < -100 || p.x > innerWidth + 100 || p.y < -100 || p.y > innerHeight + 100) continue; const r = d.r * camera.zoom; ctx.save(); ctx.translate(p.x,p.y); ctx.globalCompositeOperation='screen'; const g=ctx.createRadialGradient(0,0,0,0,0,r);g.addColorStop(0,'rgba(93,255,209,.40)');g.addColorStop(.35,'rgba(75,95,255,.22)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.fill();ctx.strokeStyle='rgba(130,255,229,.7)';ctx.lineWidth=2.5;for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(0,0,r*(.40+i*.12),r*(.23+i*.08),Math.sin(now*.0003+i)*.2,0,TAU);ctx.stroke()}ctx.restore(); }
}

function drawFood(now) {
  for (const f of world.map.food) if (f.alive) { const p = worldToScreen(f.x, f.y); if (p.x < -20 || p.x > innerWidth+20 || p.y < -20 || p.y > innerHeight+20) continue; const pulse=1+Math.sin(now*.006+f.x)*.18, hue=f.kind===2?48:f.kind===1?315:155;ctx.save();ctx.translate(p.x,p.y);ctx.globalCompositeOperation='screen';ctx.shadowBlur=settings.shadows;ctx.shadowColor=`hsl(${hue},100%,65%)`;ctx.fillStyle=`hsl(${hue},100%,72%)`;ctx.beginPath();ctx.arc(0,0,(f.kind===2?6:f.kind===1?5:4)*pulse,0,TAU);ctx.fill();for(let i=0;i<3;i++){ctx.rotate(TAU/3);ctx.fillRect(3,-1,7,2)}ctx.restore(); }
}

function drawPheromones() {
  if (renderTier === 'low') return;
  ctx.save(); ctx.globalCompositeOperation='screen';
  for (const p of world.pheromones) { const q=worldToScreen(p.x,p.y);if(q.x<-80||q.x>innerWidth+80||q.y<-80||q.y>innerHeight+80)continue;ctx.strokeStyle=`hsla(${p.hue},100%,68%,${p.strength*.18})`;ctx.lineWidth=2;ctx.beginPath();ctx.arc(q.x,q.y,(1-p.strength)*80+12,0,TAU);ctx.stroke(); }
  ctx.restore();
}

function drawCarcasses() { for(const c of world.carcasses){const p=worldToScreen(c.x,c.y);if(p.x<-50||p.x>innerWidth+50||p.y<-50||p.y>innerHeight+50)continue;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(c.age*.06);ctx.strokeStyle=`hsla(${c.hue},70%,45%,.55)`;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,0,14*c.mass,6*c.mass,.2,0,TAU);ctx.stroke();ctx.restore()} }

function drawCreature(c, now) {
  if (c.dead) return; const p=worldToScreen(c.x,c.y); if(p.x<-140||p.x>innerWidth+140||p.y<-140||p.y>innerHeight+140)return;
  const distance=Math.hypot(p.x-innerWidth/2,p.y-innerHeight/2), detail=settings.creatureDetail-(distance>innerWidth*.58?1:0);
  const r=c.r*camera.zoom, speed=Math.hypot(c.vx,c.vy), gait=c.gait;
  if(detail<=-1){ctx.fillStyle=`hsla(${c.hue},95%,65%,.7)`;ctx.beginPath();ctx.arc(p.x,p.y,Math.max(2,r*.45),0,TAU);ctx.fill();return}
  ctx.save();ctx.globalAlpha=c.role==='lurker'&&c.ai?.mode==='hunt'?0.5+0.35*(1-c.genome.camouflage):1;ctx.globalCompositeOperation='screen';ctx.shadowColor=`hsl(${c.hue},100%,62%)`;ctx.shadowBlur=settings.shadows*c.genome.biolum;
  const spine=c.spine.map(s=>worldToScreen(s.x,s.y));
  ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=`hsla(${c.hue},88%,62%,.5)`;ctx.lineWidth=Math.max(2,r*.32);ctx.beginPath();for(let i=0;i<spine.length;i++){if(i===0)ctx.moveTo(spine[i].x,spine[i].y);else ctx.lineTo(spine[i].x,spine[i].y)}ctx.stroke();
  if(detail>=1){ctx.shadowBlur=0;ctx.strokeStyle=`hsla(${c.hue+55},100%,78%,.72)`;ctx.lineWidth=Math.max(1.3,r*.11);for(let i=0;i<c.genome.legs;i++){const anchor=spine[Math.min(spine.length-1,1+Math.floor(i/2))]||p,side=i%2?-1:1,swing=Math.sin(gait+i*1.7)*r*.42;ctx.beginPath();ctx.moveTo(anchor.x,anchor.y);ctx.lineTo(anchor.x+swing*c.facing,anchor.y+side*r*.4+r*.6);ctx.stroke()}for(let i=0;i<c.genome.fins;i++){const anchor=spine[Math.min(spine.length-1,1+Math.floor(i/2))]||p;ctx.fillStyle=`hsla(${c.hue+110},90%,65%,.22)`;ctx.beginPath();ctx.ellipse(anchor.x,anchor.y+(i%2?-1:1)*r*.24,r*.9,r*.22,(i%2?-1:1)*.35,0,TAU);ctx.fill()}}
  for(let i=spine.length-1;i>=0;i--){const s=spine[i],t=i/Math.max(1,spine.length-1),br=r*(.30+.30*Math.sin((1-t)*Math.PI));const grad=ctx.createRadialGradient(s.x-br*.25,s.y-br*.3,1,s.x,s.y,br);grad.addColorStop(0,`hsl(${c.hue+60},100%,86%)`);grad.addColorStop(.32,`hsl(${c.hue},90%,62%)`);grad.addColorStop(1,`hsl(${c.hue-25},80%,25%)`);ctx.fillStyle=grad;ctx.beginPath();ctx.ellipse(s.x,s.y,br,br*.68,0,0,TAU);ctx.fill();if(detail>=2){ctx.strokeStyle=`hsla(${c.hue+120},100%,90%,.46)`;ctx.lineWidth=1;ctx.stroke()}}
  ctx.translate(p.x,p.y);ctx.scale(c.facing,1);ctx.fillStyle=`hsl(${c.hue},92%,57%)`;ctx.beginPath();ctx.ellipse(r*.58,0,r*.54,r*.46,0,0,TAU);ctx.fill();
  if(detail>=1){for(let i=0;i<c.genome.horns;i++){ctx.strokeStyle=`hsl(${c.hue+70},100%,82%)`;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(r*.55,(-.22+i*.18)*r);ctx.lineTo(r*(.95+i*.11),(-.67+i*.2)*r);ctx.stroke()}for(let i=0;i<c.genome.eyes;i++){const ey=(-.28+i*(.56/Math.max(1,c.genome.eyes-1)))*r;ctx.fillStyle='#ecfff9';ctx.beginPath();ctx.arc(r*.72,ey,r*.09,0,TAU);ctx.fill();ctx.fillStyle='#071018';ctx.beginPath();ctx.arc(r*.75,ey,r*.038,0,TAU);ctx.fill()}}
  if(c.meta.predator){ctx.strokeStyle='rgba(255,240,255,.92)';ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(r*.9,r*.15);ctx.lineTo(r*1.08,r*.27);ctx.lineTo(r*.84,r*.31);ctx.stroke()}
  if(c.isPlayer){ctx.shadowColor='#fff';ctx.shadowBlur=18;ctx.strokeStyle='rgba(255,255,255,.86)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,r*1.6+Math.sin(now*.006)*3,0,TAU);ctx.stroke()}
  ctx.restore();
}

function drawEvents(now) {
  world.events = world.events.filter(e => world.time - e.time < 2.2);
  ctx.save();ctx.globalCompositeOperation='screen';
  for(const e of world.events){const p=worldToScreen(e.x,e.y),age=world.time-e.time,t=clamp(age/2.2,0,1),h=e.type==='scan'?185:155;ctx.strokeStyle=`hsla(${h},100%,75%,${1-t})`;ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,10+t*90,0,TAU);ctx.stroke()}
  if(control.scan){scannerPulse=Math.min(1,scannerPulse+.12)}else scannerPulse=Math.max(0,scannerPulse-.05);if(scannerPulse>0){const p=worldToScreen(world.player.x,world.player.y);ctx.strokeStyle=`rgba(115,245,255,${scannerPulse*.65})`;ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,45+Math.sin(now*.008)*12+scannerPulse*70,0,TAU);ctx.stroke()}
  ctx.restore();
}

function drawRain(now) {
  const intensity=world.rainIntensity;if(intensity<=.01)return;ctx.save();ctx.strokeStyle=`rgba(126,190,255,${.18+intensity*.42})`;ctx.lineWidth=1.2;for(let i=0;i<settings.rain;i++){const x=(i*71+now*.55)%(innerWidth+100)-50,y=(i*43+now*.9)%(innerHeight+120)-60,len=12+intensity*28;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-5-intensity*8,y+len);ctx.stroke()}if(world.floodY<WORLD_H){const p=worldToScreen(0,world.floodY),g=ctx.createLinearGradient(0,p.y,0,innerHeight);g.addColorStop(0,'rgba(82,130,255,.40)');g.addColorStop(1,'rgba(8,21,54,.90)');ctx.fillStyle=g;ctx.fillRect(0,p.y,innerWidth,innerHeight-p.y);ctx.strokeStyle='rgba(165,225,255,.72)';ctx.beginPath();for(let x=0;x<=innerWidth;x+=10)ctx.lineTo(x,p.y+Math.sin(x*.05+now*.01)*4);ctx.stroke()}ctx.restore();
}

function drawFog(now) {
  if(renderTier==='low')return;ctx.save();ctx.globalCompositeOperation='screen';for(const f of visual.fog){const x=(f.x*innerWidth+Math.sin(now*.00012+f.p)*innerWidth*.15)%innerWidth,y=f.y*innerHeight,r=f.r*Math.max(innerWidth,innerHeight);const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(90,160,255,.035)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2)}ctx.restore();
}

function render(now) {
  drawBackground(now); const player=world.player;
  if(player&&!player.dead){const targetZoom=innerWidth<700?.82:innerWidth<1100?.98:1.08;camera.zoom=lerp(camera.zoom,targetZoom,.025);camera.x=lerp(camera.x,player.x+player.vx*.34,.085);camera.y=lerp(camera.y,player.y-innerHeight*.08+player.vy*.07,.07)}
  const shake=world.rainPhase==='rain'?world.rainIntensity*(renderTier==='low'?1:2.4):0;ctx.save();ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);drawTiles();drawVines(now);drawVents(now);drawDens(now);drawFood(now);drawPheromones();drawCarcasses();
  const ordered=[...world.creatures].sort((a,b)=>a.y-b.y);for(const c of ordered)drawCreature(c,now);drawEvents(now);drawRain(now);ctx.restore();drawFog(now);
}

function showEvolution() {
  if(!world.pendingEvolution){ui.evolution?.classList.remove('show');return}ui.evolution?.classList.add('show');ui.pause?.classList.remove('show');ui.evolutionChoices.innerHTML='';
  for(const choice of world.pendingEvolution){const b=document.createElement('button');b.className='evolution-choice';b.innerHTML=`<strong>${choice.title}</strong><small>${choice.text}</small>`;b.onclick=()=>{world.applyEvolution(choice.id);ui.evolution.classList.remove('show');audio.blip(440,.18,.12,'triangle')};ui.evolutionChoices.append(b)}
}

function updateUI() {
  const p=world.player,s=world.stats();ui.cycle.textContent=`CYCLE ${s.cycle}`;ui.food.textContent=`${p.food}/4`;ui.health.style.width=`${clamp(p.health,0,1)*100}%`;ui.energy.style.width=`${clamp(p.energy,0,1)*100}%`;
  ui.rain.textContent=s.rainPhase==='clear'?`RAIN ${Math.ceil(s.rainRemaining)}s`:s.rainPhase==='warning'?`WARNING ${Math.ceil(s.rainRemaining)}s`:`FRACTURE ${Math.ceil(s.rainRemaining)}s`;ui.rain.classList.toggle('danger',s.rainPhase!=='clear');ui.room.textContent=s.biome;
  ui.points.textContent=s.points;ui.bucks.textContent=s.bucks;ui.research.textContent=s.research;ui.species.textContent=s.species;ui.samples.textContent=s.samples;ui.population.textContent=s.population;ui.fps.textContent=Math.round(fps);
  ui.oxygen.style.width=`${s.ecology.oxygen*100}%`;ui.toxin.style.width=`${s.ecology.toxin*100}%`;ui.mission.textContent=s.mission.title;ui.missionProgress.textContent=`${Math.min(s.mission.progress,s.mission.target)}/${s.mission.target} · ${s.mission.text}`;
  ui.message.textContent=world.message;ui.message.classList.toggle('show',world.messageTime>0);if(world.gameOver)ui.death.classList.add('show');showEvolution();audio.update();
}

function adaptQuality(dt) {
  if(preference!=='auto')return;adaptiveClock+=dt;if(fps<42)stableClock=0;else if(fps>57)stableClock+=dt;else stableClock=Math.max(0,stableClock-dt*.5);if(adaptiveClock<4)return;adaptiveClock=0;
  const order=['low','medium','high','ultra'],index=order.indexOf(renderTier);if(fps<39&&index>0){setRenderTier(order[index-1]);world.toast('Adaptive renderer reduced effects to protect frame rate.',4)}else if(stableClock>18&&index<order.indexOf(capability.tier)){stableClock=0;setRenderTier(order[index+1]);world.toast('Adaptive renderer increased visual detail.',4)}
}

function loop(now) {
  const dt=Math.min(.1,(now-last)/1000);last=now;fps=fps*.93+(dt?1/dt:60)*.07;accumulator+=dt;const input=readControls();let guard=0;
  while(accumulator>=1/60&&guard++<5){world.step(1/60,input);accumulator-=1/60}render(now);uiClock+=dt;if(uiClock>.12){uiClock=0;updateUI()}adaptQuality(dt);requestAnimationFrame(loop);
}

addEventListener('visibilitychange',()=>{if(document.hidden){pausedByVisibility=!world.paused;togglePause(true)}else if(pausedByVisibility&&!world.pendingEvolution&&!world.gameOver){pausedByVisibility=false;togglePause(false)}});
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js?v=7',{updateViaCache:'none'}).catch(()=>{});
setRenderTier(renderTier);resize();updateUI();requestAnimationFrame(loop);
