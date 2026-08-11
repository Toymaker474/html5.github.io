const canvas=document.getElementById('sim');
const info=document.getElementById('info');
const supported=!!(canvas.transferControlToOffscreen&&window.Worker);
if(!supported){document.body.classList.add('blocked');info.textContent='OffscreenCanvas + Worker support required';throw new Error('OffscreenCanvas unavailable');}
const worker=new Worker('./scratch/worker.js',{type:'module'});
const off=canvas.transferControlToOffscreen();
let speed=1,rain=.12,ui=true,sound=false,audio=null;
function init(){const r=canvas.getBoundingClientRect();worker.postMessage({type:'init',canvas:off,w:r.width,h:r.height,dpr:devicePixelRatio||1},[off]);}
function size(){const r=canvas.getBoundingClientRect();worker.postMessage({type:'resize',w:r.width,h:r.height,dpr:devicePixelRatio||1});}
init();addEventListener('resize',size,{passive:true});
const pointers=new Map();let gesture=null;
canvas.addEventListener('pointerdown',e=>{e.preventDefault();unlockAudio();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY});canvas.setPointerCapture?.(e.pointerId);begin();},{passive:false});
canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;e.preventDefault();const p=pointers.get(e.pointerId),ox=p.x,oy=p.y;p.x=e.clientX;p.y=e.clientY;if(pointers.size===1&&gesture?.type==='pan'){worker.postMessage({type:'pan',dx:p.x-ox,dy:p.y-oy});gesture.moved||=Math.hypot(p.x-p.sx,p.y-p.sy)>7;}else if(pointers.size>=2){const a=[...pointers.values()][0],b=[...pointers.values()][1],d=Math.hypot(a.x-b.x,a.y-b.y);if(gesture?.type!=='pinch')begin();else{const factor=d/gesture.d;if(Number.isFinite(factor)&&factor>0)worker.postMessage({type:'zoom',factor});gesture.d=d;}}},{passive:false});
canvas.addEventListener('pointerup',end,{passive:false});canvas.addEventListener('pointercancel',end,{passive:false});
function begin(){const a=[...pointers.values()];gesture=a.length>1?{type:'pinch',d:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)}:{type:'pan',moved:false};}
function end(e){if(!pointers.has(e.pointerId))return;e.preventDefault();const p=pointers.get(e.pointerId);pointers.delete(e.pointerId);if(gesture?.type==='pan'&&!gesture.moved){const r=canvas.getBoundingClientRect();worker.postMessage({type:'tap',x:p.x-r.left,y:p.y-r.top});}if(pointers.size)begin();else gesture=null;}
function btn(id,fn){document.getElementById(id).addEventListener('click',()=>{unlockAudio();fn();});}
btn('toggleUI',()=>{ui=!ui;document.body.classList.toggle('clean',!ui);});
btn('pause',()=>worker.postMessage({type:'pause'}));
btn('speed',()=>{speed=speed===1?2:speed===2?.5:1;document.getElementById('speed').textContent='×'+speed;worker.postMessage({type:'speed',value:speed});});
btn('weather',()=>{rain=rain<.05?.22:rain<.18?.42:0;worker.postMessage({type:'rain',value:rain});});
btn('sound',()=>{sound=!sound;document.getElementById('sound').classList.toggle('on',sound);applyAudio();});
btn('reset',()=>worker.postMessage({type:'reset',seed:(Math.random()*1e9)|0}));
worker.onmessage=e=>{const m=e.data;if(m.type!=='telemetry')return;info.innerHTML=`<b>${m.alive}</b> organisms <span>·</span> water ${Math.round(m.water)} <span>·</span> flow ${m.flow.toFixed(2)} <span>·</span> rain ${Math.round(m.rain*100)}%`;const s=m.selected;document.getElementById('selected').textContent=s?`Crawler #${s.id} · energy ${Math.round(s.energy*100)}% · hunger ${Math.round(s.hunger*100)}%`:'Tap an organism';updateAudio(m);};
function unlockAudio(){if(audio)return;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;const ac=new AC(),master=ac.createGain();master.gain.value=0;master.connect(ac.destination);const makeNoise=type=>{const len=ac.sampleRate*2,b=ac.createBuffer(1,len,ac.sampleRate),d=b.getChannelData(0);for(let i=0;i<len;i++)d[i]=Math.random()*2-1;const s=ac.createBufferSource();s.buffer=b;s.loop=true;const f=ac.createBiquadFilter();f.type=type==='rain'?'highpass':'lowpass';f.frequency.value=type==='rain'?2800:260;const g=ac.createGain();g.gain.value=0;s.connect(f).connect(g).connect(master);s.start();return g;};audio={ac,master,rain:makeNoise('rain'),water:makeNoise('water')};applyAudio();}
function applyAudio(){if(!audio)return;const t=audio.ac.currentTime;audio.master.gain.cancelScheduledValues(t);audio.master.gain.linearRampToValueAtTime(sound?.22:0,t+.18);}
function updateAudio(m){if(!audio)return;const t=audio.ac.currentTime;audio.rain.gain.setTargetAtTime(Math.min(.42,m.rain*.55),t,.25);audio.water.gain.setTargetAtTime(Math.min(.34,.04+m.flow*.018),t,.35);}
