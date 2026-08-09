(()=>{
'use strict';
const $=id=>document.getElementById(id),canvas=$('view'),gpuEl=$('gpu'),hud=$('hud'),pauseBtn=$('pause'),quality=$('quality'),brush=$('brush'),brushV=$('brushV'),cohesion=$('cohesion'),cohesionV=$('cohesionV');
const MAT={EMPTY:0,SAND:1,WATER:2,ROCK:3};
let selected=MAT.SAND,selectedWetness=0,worker=null,renderer=null,lastPacked=null,lastSnapshot=null,lastInvariant=null,paused=false,busy=false,simHz=0,lastStateTime=performance.now(),renderFps=60,rf=0,ra=0,renderLast=performance.now(),rendererGeneration=0;

function parseGrid(){const [w,h]=quality.value.split('x').map(Number);return{width:w,height:h};}
function setRendererStatus(text,good=false){gpuEl.textContent=text;gpuEl.className='gpu '+(good?'good':'warn');}
function fallbackRenderer(width,height,reason){renderer=new GenesisCanvasMaterialsRenderer(canvas,width,height);setRendererStatus('RENDERER: CANVAS FALLBACK');if(reason)console.warn('GENESIS Materials WebGPU fallback:',reason);if(lastPacked)renderer.updateState(lastPacked);}
async function createRenderer(width,height){
  const generation=++rendererGeneration;renderer=null;setRendererStatus('RENDERER: PROBING WEBGPU');
  try{const r=await GenesisWebGPUMaterialsRenderer.create(canvas,width,height);if(generation!==rendererGeneration)return;renderer=r;setRendererStatus('RENDERER: WEBGPU',true);if(lastPacked)renderer.updateState(lastPacked);}
  catch(err){if(generation!==rendererGeneration)return;fallbackRenderer(width,height,err);}
}
function initWorker(){
  if(worker)worker.terminate();const {width,height}=parseGrid();lastPacked=null;lastSnapshot=null;busy=false;worker=new Worker('./worker.js');
  worker.onmessage=e=>{const m=e.data||{};if(m.type==='error'){console.error(m.message);setRendererStatus('SIM ERROR');busy=false;return;}if(m.type!=='state')return;
    const now=performance.now(),dt=(now-lastStateTime)/1000;lastStateTime=now;if(dt>0)simHz=.85*simHz+.15*(1/dt);
    lastPacked=new Uint32Array(m.buffer);lastSnapshot=m.snapshot;lastInvariant=m.invariant;busy=false;if(renderer)renderer.updateState(lastPacked);if(!paused)queueStep();
  };
  worker.onerror=e=>{console.error(e);setRendererStatus('WORKER ERROR');busy=false;};
  worker.postMessage({type:'init',width,height,seed:0x51a7c0de,cohesion:+cohesion.value});createRenderer(width,height);
}
function queueStep(){if(paused||busy||!worker)return;busy=true;const cells=parseGrid().width*parseGrid().height;const iterations=cells<=35000?2:1;worker.postMessage({type:'step',iterations});}
function sendBrush(x,y,material=selected,wetness=selectedWetness){if(!worker)return;worker.postMessage({type:'brush',x,y,radius:+brush.value,material,wetness});}
function pointerToGrid(e){const r=canvas.getBoundingClientRect(),{width,height}=parseGrid();return{x:Math.max(0,Math.min(width-1,Math.floor((e.clientX-r.left)/r.width*width))),y:Math.max(0,Math.min(height-1,Math.floor((1-(e.clientY-r.top)/r.height)*height)))}};
let drawing=false,lastPaintKey='';
function paintPointer(e){const p=pointerToGrid(e),key=p.x+':'+p.y;if(key===lastPaintKey)return;lastPaintKey=key;sendBrush(p.x,p.y);}
canvas.addEventListener('pointerdown',e=>{drawing=true;lastPaintKey='';canvas.setPointerCapture?.(e.pointerId);paintPointer(e);e.preventDefault();});
canvas.addEventListener('pointermove',e=>{if(drawing){paintPointer(e);e.preventDefault();}});
for(const ev of ['pointerup','pointercancel','pointerleave'])canvas.addEventListener(ev,()=>{drawing=false;lastPaintKey='';});

document.querySelectorAll('.mat').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.mat').forEach(b=>b.classList.remove('active'));btn.classList.add('active');const v=+btn.dataset.mat;selected=v===4?MAT.SAND:v;selectedWetness=+(btn.dataset.wet||0);}));
brush.oninput=()=>brushV.textContent=brush.value;cohesion.oninput=()=>{cohesionV.textContent=(+cohesion.value).toFixed(2);worker?.postMessage({type:'set-cohesion',value:+cohesion.value});};
quality.onchange=()=>initWorker();
pauseBtn.onclick=()=>{paused=!paused;pauseBtn.textContent=paused?'Resume':'Pause';if(!paused)queueStep();};
$('reset').onclick=()=>worker?.postMessage({type:'reset'});
$('sandBurst').onclick=()=>{const {width,height}=parseGrid();worker?.postMessage({type:'burst',material:MAT.SAND,x:Math.floor(width*.5),y:Math.floor(height*.82),radius:Math.max(7,Math.floor(width*.055)),wetness:0});};
$('rain').onclick=()=>{const {width,height}=parseGrid();worker?.postMessage({type:'burst',material:MAT.WATER,x:Math.floor(width*.67),y:Math.floor(height*.88),radius:Math.max(6,Math.floor(width*.045))});};

function updateHud(){if(!lastSnapshot)return;const c=lastSnapshot.counts,inv=lastInvariant?.status||'UNKNOWN',kind=renderer?.kind||'starting';const cells=lastSnapshot.width*lastSnapshot.height;hud.innerHTML=`<span class="chip">${kind}</span><span class="chip">${cells.toLocaleString()} cells</span><span class="chip">sand ${c.sand.toLocaleString()}</span><span class="chip">wet ${c.wetSand.toLocaleString()}</span><span class="chip">water ${c.water.toLocaleString()}</span><span class="chip">moves ${lastSnapshot.moves.toLocaleString()}</span><span class="chip">sim ${simHz.toFixed(1)} state/s</span><span class="chip">render ${renderFps.toFixed(0)} fps</span><span class="chip">${inv}</span>`;}
function frame(now){const dt=(now-renderLast)/1000;renderLast=now;ra+=dt;rf++;if(ra>=.5){renderFps=rf/ra;rf=0;ra=0;updateHud();}
  if(renderer?.kind==='WebGPU'&&renderer.lost){const {width,height}=parseGrid();fallbackRenderer(width,height,'device lost');}
  try{renderer?.render(now);}catch(err){console.error('GENESIS Materials render error',err);if(renderer?.kind==='WebGPU'){const {width,height}=parseGrid();fallbackRenderer(width,height,err);}}
  requestAnimationFrame(frame);
}
brushV.textContent=brush.value;cohesionV.textContent=(+cohesion.value).toFixed(2);initWorker();requestAnimationFrame(frame);
})();
