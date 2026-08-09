(()=>{
'use strict';
const {MatterWorld,SPECIES,MODEL}=GenesisMatter;
const canvas=document.getElementById('view');
const ctx=canvas.getContext('2d',{alpha:false});
const ui={temp:document.getElementById('temp'),tempV:document.getElementById('tempV'),attr:document.getElementById('attr'),attrV:document.getElementById('attrV'),thermostat:document.getElementById('thermostat'),pause:document.getElementById('pause'),reset:document.getElementById('reset'),seed:document.getElementById('seed'),pulse:document.getElementById('pulse'),stats:document.getElementById('stats'),model:document.getElementById('modelInfo'),modelBtn:document.getElementById('modelBtn')};
let seed=0x51a7c0de>>>0;
let world=new MatterWorld({count:120,seed,temperature:Number(ui.temp.value)});
let paused=false,last=performance.now(),fps=60,acc=0,frames=0,lastStats=0;
const palette=['#78e8ff','#ff8ed8','#ffd166'];
function resize(){const dpr=Math.min(devicePixelRatio||1,2),r=canvas.getBoundingClientRect(),w=Math.max(1,Math.round(r.width*dpr)),h=Math.max(1,Math.round(r.height*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;ctx.setTransform(dpr,0,0,dpr,0,0)}}
function worldToScreen(x,y){const r=canvas.getBoundingClientRect();return{x:x/world.width*r.width,y:(1-y/world.height)*r.height}}
function screenToWorld(clientX,clientY){const r=canvas.getBoundingClientRect();return{x:(clientX-r.left)/r.width*world.width,y:(1-(clientY-r.top)/r.height)*world.height}}
function draw(){resize();const r=canvas.getBoundingClientRect(),w=r.width,h=r.height,bg=ctx.createLinearGradient(0,0,0,h);bg.addColorStop(0,'#02070c');bg.addColorStop(.6,'#041018');bg.addColorStop(1,'#06121a');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineWidth=1;const ps=world.particles;for(let i=0;i<ps.length;i++){const a=ps[i],sa=SPECIES[a.species],A=worldToScreen(a.x,a.y);for(let j=i+1;j<ps.length;j++){const b=ps[j],sb=SPECIES[b.species],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),sigma=.5*(sa.sigma+sb.sigma);if(d<1.45*sigma){const B=worldToScreen(b.x,b.y);ctx.strokeStyle=`rgba(125,220,255,${Math.max(0,.18*(1-d/(1.45*sigma)))})`;ctx.beginPath();ctx.moveTo(A.x,A.y);ctx.lineTo(B.x,B.y);ctx.stroke()}}}for(const p of ps){const s=SPECIES[p.species],P=worldToScreen(p.x,p.y),radius=Math.max(3.1,s.sigma/world.width*w*.42),g=ctx.createRadialGradient(P.x-radius*.35,P.y-radius*.4,.3,P.x,P.y,radius*2.2);g.addColorStop(0,'rgba(255,255,255,.98)');g.addColorStop(.16,palette[p.species]);g.addColorStop(.48,palette[p.species]+'bb');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(P.x,P.y,radius*2.2,0,Math.PI*2);ctx.fill();ctx.fillStyle=palette[p.species];ctx.globalAlpha=.88;ctx.beginPath();ctx.arc(P.x,P.y,radius,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1}ctx.restore()}
function updateStats(now){if(now-lastStats<180)return;lastStats=now;const s=world.snapshot(),inv=world.invariantReport();ui.stats.innerHTML=`<b>${MODEL.name}</b><span>step ${s.step.toLocaleString()}</span><span>T ${s.temperature.toFixed(3)}</span><span>KE ${s.kinetic.toFixed(2)}</span><span>PE ${s.potential.toFixed(2)}</span><span>E ${s.total.toFixed(2)}</span><span>P* ${s.pressure.toFixed(2)}</span><span>${fps.toFixed(0)} fps</span><span>${inv.status}</span>`}
function frame(now){const dtReal=Math.min(.05,(now-last)/1000);last=now;acc+=dtReal;frames++;if(acc>=.5){fps=frames/acc;frames=0;acc=0}if(!paused){const target=Number(ui.temp.value),strength=ui.thermostat.checked?.018:0;for(let i=0;i<3;i++)world.step(.00018,{targetTemperature:target,thermostatStrength:strength})}draw();updateStats(now);requestAnimationFrame(frame)}
function rebuild(nextSeed=seed){seed=nextSeed>>>0;world=new MatterWorld({count:120,seed,temperature:Number(ui.temp.value),attraction:Number(ui.attr.value)});ui.seed.textContent='seed '+seed.toString(16).padStart(8,'0')}
ui.temp.oninput=()=>ui.tempV.textContent=Number(ui.temp.value).toFixed(2);
ui.attr.oninput=()=>{ui.attrV.textContent=Number(ui.attr.value).toFixed(2);world.setAttraction(Number(ui.attr.value))};
ui.pause.onclick=()=>{paused=!paused;ui.pause.textContent=paused?'Resume':'Pause'};
ui.reset.onclick=()=>rebuild(seed);
ui.seed.onclick=()=>rebuild((seed+0x9e3779b9)>>>0);
ui.pulse.onclick=()=>world.impulse(world.width*.5,world.height*.5,1.2,.22);
ui.modelBtn.onclick=()=>ui.model.hidden=!ui.model.hidden;
function poke(e){const p=screenToWorld(e.clientX,e.clientY);world.impulse(p.x,p.y,1.0,.16)}
canvas.addEventListener('pointerdown',poke,{passive:true});
ui.model.innerHTML=`<strong>What this actually is</strong><p>${MODEL.potential}; ${MODEL.integrator}; ${MODEL.boundary} boundaries; ${MODEL.units}.</p><p><b>Real claim:</b> classical coarse-grained 2D particle dynamics with deterministic seed, energy accounting, and direct user impulses.</p><p><b>Not claimed:</b> literal atoms, quantum chemistry, reactions, cells, life, evolution, robot intelligence, or a finished GENESIS engine.</p>`;
ui.tempV.textContent=Number(ui.temp.value).toFixed(2);ui.attrV.textContent=Number(ui.attr.value).toFixed(2);rebuild(seed);requestAnimationFrame(frame);
})();
