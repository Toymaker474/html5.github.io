import { World, TILE, MAP_W, MAP_H, WORLD_W, WORLD_H, ROLE, clamp, lerp, TAU } from './sim.js?v=6';

const $ = id => document.getElementById(id);
const canvas = $('game');
const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
const ui = {
  cycle: $('cycle'), food: $('food'), health: $('health'), energy: $('energy'), rain: $('rain'), room: $('room'),
  points: $('points'), bucks: $('bucks'), message: $('message'), population: $('population'), fps: $('fps'),
  pause: $('pausePanel'), death: $('deathPanel'), intro: $('introPanel'), quality: $('qualityLabel')
};

let world = new World((Date.now() ^ 0x51f15e) >>> 0);
let camera = { x: world.player.x, y: world.player.y, zoom: 1, shake: 0 };
let last = performance.now(), accumulator = 0, fps = 60, frames = 0, uiClock = 0;
let quality = localStorage.getItem('fw_quality') || 'auto';
let dpr = 1;
let deferredInstall = null;
const key = new Set();
const control = { x: 0, y: 0, jump: false, grab: false, bite: false, dash: false };
const touch = { stickId: null, stickX: 0, stickY: 0, jump: false, grab: false, bite: false, dash: false };
const renderCache = { stars: [], motes: [] };

for (let i = 0; i < 90; i++) renderCache.stars.push({ x: Math.random(), y: Math.random(), z: Math.random(), a: Math.random() });
for (let i = 0; i < 55; i++) renderCache.motes.push({ x: Math.random(), y: Math.random(), s: 0.5 + Math.random() * 2, p: Math.random() * TAU });

function resize() {
  const rect = canvas.getBoundingClientRect();
  const maxDpr = quality === 'battery' ? 1 : quality === 'ultra' ? 2.25 : 1.7;
  dpr = Math.min(maxDpr, devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener('resize', resize, { passive: true });
resize();

function readControls() {
  let x = touch.stickX;
  let y = touch.stickY;
  if (key.has('ArrowLeft') || key.has('KeyA')) x -= 1;
  if (key.has('ArrowRight') || key.has('KeyD')) x += 1;
  if (key.has('ArrowUp') || key.has('KeyW')) y -= 1;
  if (key.has('ArrowDown') || key.has('KeyS')) y += 1;
  control.x = clamp(x, -1, 1);
  control.y = clamp(y, -1, 1);
  control.jump = touch.jump || key.has('Space') || key.has('KeyW') || key.has('ArrowUp');
  control.grab = touch.grab || key.has('ShiftLeft') || key.has('KeyE');
  control.bite = touch.bite || key.has('KeyF') || key.has('KeyK');
  control.dash = touch.dash || key.has('KeyL') || key.has('ControlLeft');
  return control;
}

addEventListener('keydown', e => {
  key.add(e.code);
  if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
});
addEventListener('keyup', e => key.delete(e.code));

function bindHold(id, field) {
  const el = $(id);
  if (!el) return;
  const down = e => { e.preventDefault(); touch[field] = true; el.classList.add('pressed'); el.setPointerCapture?.(e.pointerId); };
  const up = e => { e.preventDefault(); touch[field] = false; el.classList.remove('pressed'); };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('lostpointercapture', up);
}
bindHold('jumpBtn', 'jump');
bindHold('grabBtn', 'grab');
bindHold('biteBtn', 'bite');
bindHold('dashBtn', 'dash');

const stick = $('stick');
const knob = $('stickKnob');
function moveStick(e) {
  if (touch.stickId !== e.pointerId) return;
  const r = stick.getBoundingClientRect();
  const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  const max = r.width * 0.31, len = Math.hypot(dx, dy) || 1, s = Math.min(1, max / len);
  const px = dx * s, py = dy * s;
  touch.stickX = clamp(px / max, -1, 1); touch.stickY = clamp(py / max, -1, 1);
  knob.style.transform = `translate(${px}px,${py}px)`;
}
stick.addEventListener('pointerdown', e => { e.preventDefault(); touch.stickId = e.pointerId; stick.setPointerCapture(e.pointerId); moveStick(e); });
stick.addEventListener('pointermove', moveStick);
function endStick(e) { if (touch.stickId !== e.pointerId) return; touch.stickId = null; touch.stickX = touch.stickY = 0; knob.style.transform = 'translate(0,0)'; }
stick.addEventListener('pointerup', endStick); stick.addEventListener('pointercancel', endStick);

function togglePause(force) {
  const next = typeof force === 'boolean' ? force : !world.paused;
  world.paused = next;
  ui.pause.classList.toggle('show', next);
}
$('pauseBtn').onclick = () => togglePause();
$('resumeBtn').onclick = () => togglePause(false);
$('restartBtn').onclick = () => { world = new World((Date.now() ^ 0x13d3) >>> 0); camera.x = world.player.x; camera.y = world.player.y; togglePause(false); };
$('respawnBtn').onclick = () => { world.respawn(); ui.death.classList.remove('show'); camera.x = world.player.x; camera.y = world.player.y; };
$('playBtn').onclick = () => ui.intro.classList.remove('show');
$('howBtn').onclick = () => $('howPanel').classList.toggle('show');

$('qualityBtn').onclick = () => {
  quality = quality === 'auto' ? 'ultra' : quality === 'ultra' ? 'battery' : 'auto';
  localStorage.setItem('fw_quality', quality);
  ui.quality.textContent = quality.toUpperCase();
  resize();
};
ui.quality.textContent = quality.toUpperCase();

addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; $('installBtn').classList.add('ready'); });
$('installBtn').onclick = async () => {
  if (deferredInstall) { deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; }
  else world.toast('iPhone: Safari Share → Add to Home Screen.');
};

function createRating() {
  const stars = $('stars');
  const saved = Number(localStorage.getItem('fw_rating') || 0);
  const choice = localStorage.getItem('fw_choice') || '';
  for (let i = 1; i <= 10; i++) {
    const b = document.createElement('button'); b.textContent = '★'; b.dataset.value = i;
    b.classList.toggle('on', i <= saved);
    b.onclick = () => { localStorage.setItem('fw_rating', String(i)); [...stars.children].forEach((x, n) => x.classList.toggle('on', n < i)); $('ratingText').textContent = `${i}/10`; };
    stars.append(b);
  }
  if (saved) $('ratingText').textContent = `${saved}/10`;
  document.querySelectorAll('[data-feedback]').forEach(b => {
    b.classList.toggle('selected', b.dataset.feedback === choice);
    b.onclick = () => { localStorage.setItem('fw_choice', b.dataset.feedback); document.querySelectorAll('[data-feedback]').forEach(x => x.classList.toggle('selected', x === b)); };
  });
}
createRating();

function runDirector() {
  const now = Date.now(), lastReview = Number(localStorage.getItem('fw_director_review') || 0);
  if (now - lastReview < 2 * 60 * 60 * 1000) return;
  localStorage.setItem('fw_director_review', String(now));
  const s = world.stats(), prey = (s.counts.nibbler || 0) + (s.counts.skitter || 0), predators = (s.counts.hunter || 0) + (s.counts.lurker || 0);
  if (predators > prey * 0.42) { world.toast('Ecosystem Director: prey nurseries opened after predator pressure rose.', 6); for (let i = 0; i < 6; i++) { const den = world.map.dens[0]; world.creatures.push(new world.player.constructor(world, i % 2 ? 'skitter' : 'nibbler', den.x + i * 18, den.y - 35)); } }
  else if (predators < 4) { world.toast('Ecosystem Director: a Rift Hunter lineage entered the region.', 6); const tx = 95; world.creatures.push(new world.player.constructor(world, 'hunter', tx * TILE, (world.map.findFloor(tx) - 1.2) * TILE)); }
  else world.toast('Ecosystem Director: food web balance is stable. No intervention.', 5);
}
runDirector();
setInterval(runDirector, 60_000);

function roundedRect(c, x, y, w, h, r) {
  c.beginPath(); c.roundRect(x, y, w, h, r); return c;
}

function worldToScreen(x, y) {
  return { x: (x - camera.x) * camera.zoom + innerWidth / 2, y: (y - camera.y) * camera.zoom + innerHeight / 2 };
}

function drawBackground(now) {
  const w = innerWidth, h = innerHeight;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, world.rainPhase === 'rain' ? '#07101b' : '#130c27');
  g.addColorStop(0.55, '#071622'); g.addColorStop(1, '#020508');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  for (const s of renderCache.stars) {
    const px = (s.x * w - camera.x * 0.015 * s.z + w * 2) % w;
    const py = s.y * h * 0.72;
    ctx.fillStyle = `rgba(${150 + s.z * 90},${80 + s.z * 160},255,${0.08 + s.a * 0.45})`;
    ctx.fillRect(px, py, 1 + s.z * 2, 1 + s.z * 2);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let layer = 0; layer < 4; layer++) {
    const base = h * (0.57 + layer * 0.08), scale = 0.03 + layer * 0.015;
    ctx.fillStyle = `hsla(${210 + layer * 28},70%,${10 + layer * 3}%,${0.55 + layer * 0.08})`;
    ctx.beginPath(); ctx.moveTo(0, h);
    for (let x = 0; x <= w + 30; x += 24) {
      const wx = x + camera.x * scale;
      const y = base + Math.sin(wx * 0.012 + layer) * 32 + Math.sin(wx * 0.0047) * 58;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h); ctx.fill();
  }
  ctx.restore();
  for (const m of renderCache.motes) {
    const x = (m.x * w + Math.sin(now * 0.0004 + m.p) * 50) % w;
    const y = (m.y * h + Math.cos(now * 0.0003 + m.p) * 25) % h;
    ctx.fillStyle = `rgba(100,255,220,${0.06 + 0.08 * Math.sin(now * 0.002 + m.p)})`;
    ctx.beginPath(); ctx.arc(x, y, m.s, 0, TAU); ctx.fill();
  }
}

function drawTiles() {
  const left = Math.max(0, Math.floor((camera.x - innerWidth / (2 * camera.zoom)) / TILE) - 2);
  const right = Math.min(MAP_W - 1, Math.ceil((camera.x + innerWidth / (2 * camera.zoom)) / TILE) + 2);
  const top = Math.max(0, Math.floor((camera.y - innerHeight / (2 * camera.zoom)) / TILE) - 2);
  const bottom = Math.min(MAP_H - 1, Math.ceil((camera.y + innerHeight / (2 * camera.zoom)) / TILE) + 2);
  for (let ty = top; ty <= bottom; ty++) for (let tx = left; tx <= right; tx++) if (world.map.get(tx, ty) === 1) {
    const p = worldToScreen(tx * TILE, ty * TILE), s = TILE * camera.zoom;
    const n = (tx * 17 + ty * 31 + world.seed) % 100;
    ctx.fillStyle = n < 30 ? '#101b24' : n < 70 ? '#122531' : '#17202c';
    ctx.fillRect(p.x, p.y, s + 1, s + 1);
    if (world.map.get(tx, ty - 1) === 0) {
      const grad = ctx.createLinearGradient(0, p.y, 0, p.y + s * 0.55);
      grad.addColorStop(0, n % 2 ? '#57f0b8' : '#63b8ff'); grad.addColorStop(0.22, 'rgba(52,165,142,.5)'); grad.addColorStop(1, 'rgba(12,24,31,0)');
      ctx.fillStyle = grad; ctx.fillRect(p.x, p.y, s, s * 0.7);
      ctx.fillStyle = `rgba(175,255,226,${0.12 + (n % 10) / 70})`;
      for (let i = 0; i < 3; i++) ctx.fillRect(p.x + ((n + i * 9) % 28) / 28 * s, p.y - (i % 2) * 3, 2, 3 + (n % 6));
    }
    if (n < 10) { ctx.fillStyle = 'rgba(180,92,255,.14)'; ctx.beginPath(); ctx.arc(p.x + s * 0.7, p.y + s * 0.55, s * 0.14, 0, TAU); ctx.fill(); }
  }
}

function drawVines() {
  ctx.lineCap = 'round';
  for (const v of world.map.vines) {
    const a = worldToScreen(v.x, v.y1), b = worldToScreen(v.x, v.y2);
    if (a.x < -40 || a.x > innerWidth + 40 || b.y < -40 || a.y > innerHeight + 40) continue;
    ctx.strokeStyle = 'rgba(88,244,177,.48)'; ctx.lineWidth = 3 * camera.zoom;
    ctx.beginPath(); ctx.moveTo(a.x, a.y);
    for (let i = 1; i <= 8; i++) { const t = i / 8; ctx.lineTo(lerp(a.x,b.x,t) + Math.sin(t * 12 + world.time) * 5, lerp(a.y,b.y,t)); }
    ctx.stroke();
  }
}

function drawDens(now) {
  for (const d of world.map.dens) {
    const p = worldToScreen(d.x, d.y); if (p.x < -100 || p.x > innerWidth + 100 || p.y < -100 || p.y > innerHeight + 100) continue;
    const r = d.r * camera.zoom;
    ctx.save(); ctx.translate(p.x, p.y);
    ctx.globalCompositeOperation = 'screen';
    const g = ctx.createRadialGradient(0,0,0,0,0,r);
    g.addColorStop(0, 'rgba(93,255,209,.36)'); g.addColorStop(0.35, 'rgba(75,95,255,.2)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0,0,r,0,TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(130,255,229,.65)'; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(0, 0, r * (0.42 + i * .12), r * (0.25 + i * .08), Math.sin(now * .0003 + i) * .2, 0, TAU); ctx.stroke(); }
    ctx.restore();
  }
}

function drawFood(now) {
  for (const f of world.map.food) if (f.alive) {
    const p = worldToScreen(f.x, f.y); if (p.x < -20 || p.x > innerWidth + 20 || p.y < -20 || p.y > innerHeight + 20) continue;
    const pulse = 1 + Math.sin(now * .006 + f.x) * .18;
    ctx.save(); ctx.translate(p.x,p.y); ctx.globalCompositeOperation='screen'; ctx.shadowBlur=14; ctx.shadowColor=f.kind?'#ff70e6':'#55ffb8';
    ctx.fillStyle=f.kind?'#ff83ee':'#71ffd0'; ctx.beginPath(); ctx.arc(0,0,(f.kind?6:4)*pulse,0,TAU); ctx.fill();
    for(let i=0;i<3;i++){ctx.rotate(TAU/3);ctx.fillRect(3,-1,6,2)}ctx.restore();
  }
}

function drawCarcasses() {
  for (const c of world.carcasses) {
    const p=worldToScreen(c.x,c.y); if(p.x<-50||p.x>innerWidth+50||p.y<-50||p.y>innerHeight+50)continue;
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(c.age*.07);ctx.strokeStyle=`hsla(${c.hue},70%,45%,.55)`;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,0,14*c.mass,6*c.mass,.2,0,TAU);ctx.stroke();ctx.restore();
  }
}

function drawCreature(c, now) {
  if (c.dead) return;
  const p = worldToScreen(c.x, c.y); if (p.x < -120 || p.x > innerWidth + 120 || p.y < -120 || p.y > innerHeight + 120) return;
  const s = camera.zoom, r = c.r * s, speed = Math.hypot(c.vx,c.vy), gait = now * .008 * (0.4 + speed / 180) + c.id;
  ctx.save(); ctx.translate(p.x,p.y); ctx.scale(c.facing,1);
  ctx.globalAlpha = c.role === 'lurker' && c.ai?.mode === 'ambush' ? .42 : 1;
  ctx.globalCompositeOperation='screen'; ctx.shadowColor=`hsl(${c.hue},100%,62%)`;ctx.shadowBlur=quality==='battery'?5:12;
  // Tail.
  ctx.strokeStyle=`hsla(${c.hue},88%,65%,.55)`;ctx.lineWidth=Math.max(2,r*.28);ctx.lineCap='round';ctx.beginPath();
  for(let i=0;i<c.tail.length;i++){const t=worldToScreen(c.tail[i].x,c.tail[i].y);const lx=(t.x-p.x)*c.facing,ly=t.y-p.y;if(i===0)ctx.moveTo(lx,ly);else ctx.lineTo(lx,ly)}ctx.stroke();
  // Legs / fins.
  ctx.shadowBlur=0;ctx.strokeStyle=`hsla(${c.hue+45},95%,78%,.75)`;ctx.lineWidth=Math.max(1.5,r*.12);
  for(let i=0;i<c.morph.legs;i++){const side=i%2?-1:1,along=(Math.floor(i/2)+1)/(Math.ceil(c.morph.legs/2)+1);const bx=lerp(-r*.55,r*.45,along);const swing=Math.sin(gait+i*1.7)*r*.32;ctx.beginPath();ctx.moveTo(bx,side*r*.25);ctx.lineTo(bx+swing,side*r*.82+r*.2);ctx.stroke()}
  for(let i=0;i<c.morph.fins;i++){ctx.fillStyle=`hsla(${c.hue+110},90%,65%,.26)`;ctx.beginPath();ctx.ellipse(-r*.1,(i%2?-1:1)*r*.25,r*.9,r*.25,(i%2?-1:1)*.35,0,TAU);ctx.fill()}
  // Segmented body.
  for(let i=c.morph.segments-1;i>=0;i--){const t=i/Math.max(1,c.morph.segments-1),bx=lerp(-r*.65,r*.38,t),by=Math.sin(gait+i*.8)*r*.08,br=r*(.38+.28*Math.sin(t*Math.PI));const grad=ctx.createRadialGradient(bx-br*.25,by-br*.3,1,bx,by,br);grad.addColorStop(0,`hsl(${c.hue+60},100%,86%)`);grad.addColorStop(.32,`hsl(${c.hue},90%,62%)`);grad.addColorStop(1,`hsl(${c.hue-25},80%,28%)`);ctx.fillStyle=grad;ctx.beginPath();ctx.ellipse(bx,by,br,br*.72,0,0,TAU);ctx.fill();ctx.strokeStyle=`hsla(${c.hue+120},100%,90%,.55)`;ctx.lineWidth=1;ctx.stroke()}
  // Head, eyes, horns.
  ctx.fillStyle=`hsl(${c.hue},92%,57%)`;ctx.beginPath();ctx.ellipse(r*.58,0,r*.54,r*.46,0,0,TAU);ctx.fill();
  for(let i=0;i<c.morph.horns;i++){ctx.strokeStyle=`hsl(${c.hue+70},100%,82%)`;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(r*.55,(-.22+i*.22)*r);ctx.lineTo(r*(.95+i*.12),(-.65+i*.22)*r);ctx.stroke()}
  for(let i=0;i<c.morph.eyes;i++){const ey=(-.25+i*(.5/Math.max(1,c.morph.eyes-1)))*r;ctx.fillStyle='#ecfff9';ctx.beginPath();ctx.arc(r*.72,ey,r*.095,0,TAU);ctx.fill();ctx.fillStyle='#071018';ctx.beginPath();ctx.arc(r*.75,ey,r*.04,0,TAU);ctx.fill()}
  if(c.meta.predator){ctx.strokeStyle='rgba(255,240,255,.9)';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(r*.9,r*.16);ctx.lineTo(r*1.05,r*.27);ctx.lineTo(r*.84,r*.3);ctx.stroke()}
  if(c.isPlayer){ctx.shadowColor='#fff';ctx.shadowBlur=18;ctx.strokeStyle='rgba(255,255,255,.8)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,r*1.55+Math.sin(now*.006)*3,0,TAU);ctx.stroke()}
  ctx.restore();
}

function drawRain(now) {
  const intensity = world.rainIntensity;
  if (intensity <= 0.01) return;
  ctx.save(); ctx.strokeStyle=`rgba(126,190,255,${0.18+intensity*.42})`;ctx.lineWidth=1.2;
  const count=quality==='battery'?70:quality==='ultra'?240:150;
  for(let i=0;i<count;i++){const x=(i*71+now*.55)% (innerWidth+100)-50;const y=(i*43+now*.9)% (innerHeight+120)-60;const len=12+intensity*28;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-5-intensity*8,y+len);ctx.stroke()}
  if(world.floodY<WORLD_H){const p=worldToScreen(0,world.floodY);const g=ctx.createLinearGradient(0,p.y,0,innerHeight);g.addColorStop(0,'rgba(82,130,255,.38)');g.addColorStop(1,'rgba(8,21,54,.88)');ctx.fillStyle=g;ctx.fillRect(0,p.y,innerWidth,innerHeight-p.y);ctx.strokeStyle='rgba(165,225,255,.7)';ctx.beginPath();for(let x=0;x<=innerWidth;x+=10)ctx.lineTo(x,p.y+Math.sin(x*.05+now*.01)*4);ctx.stroke()}
  ctx.restore();
}

function render(now) {
  drawBackground(now);
  const player = world.player;
  if (player && !player.dead) {
    const targetZoom = innerWidth < 700 ? 0.88 : 1.05;
    camera.zoom = lerp(camera.zoom, targetZoom, 0.025);
    camera.x = lerp(camera.x, player.x + player.vx * .32, 0.08);
    camera.y = lerp(camera.y, player.y - innerHeight * .08 + player.vy * .08, 0.07);
  }
  const shake = world.rainPhase==='rain' ? world.rainIntensity * 2.2 : 0;
  ctx.save(); ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);
  drawTiles(); drawVines(); drawDens(now); drawFood(now); drawCarcasses();
  const ordered=[...world.creatures].sort((a,b)=>a.y-b.y);for(const c of ordered)drawCreature(c,now);
  drawRain(now);ctx.restore();
}

function updateUI() {
  const p=world.player,s=world.stats();
  ui.cycle.textContent=`CYCLE ${s.cycle}`;ui.food.textContent=`${p.food}/4`;
  ui.health.style.width=`${clamp(p.health,0,1)*100}%`;ui.energy.style.width=`${clamp(p.energy,0,1)*100}%`;
  ui.rain.textContent=s.rainPhase==='clear'?`RAIN ${Math.ceil(s.rainRemaining)}s`:s.rainPhase==='warning'?`WARNING ${Math.ceil(s.rainRemaining)}s`:`RAIN ${Math.ceil(s.rainRemaining)}s`;
  ui.rain.classList.toggle('danger',s.rainPhase!=='clear');ui.room.textContent=world.map.roomNames[world.map.roomAt(p.x)];
  ui.points.textContent=s.points;ui.bucks.textContent=s.bucks;ui.population.textContent=s.population;ui.fps.textContent=Math.round(fps);
  ui.message.textContent=world.message;ui.message.classList.toggle('show',world.messageTime>0);
  if(world.gameOver)ui.death.classList.add('show');
}

function loop(now) {
  const dt=Math.min(.1,(now-last)/1000);last=now;fps=fps*.93+(dt?1/dt:60)*.07;accumulator+=dt;frames++;
  const input=readControls();let guard=0;
  while(accumulator>=1/60&&guard++<5){world.step(1/60,input);accumulator-=1/60}
  render(now);uiClock+=dt;if(uiClock>.12){uiClock=0;updateUI()}
  if(quality==='auto'&&frames%300===0){if(fps<43){quality='battery';resize();world.toast('Performance mode enabled to protect frame rate.')}else if(fps>58&&devicePixelRatio>1.5){quality='ultra';resize()}}
  requestAnimationFrame(loop);
}

addEventListener('visibilitychange',()=>{if(document.hidden)togglePause(true)});
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js?v=5',{updateViaCache:'none'}).catch(()=>{});
requestAnimationFrame(loop);
