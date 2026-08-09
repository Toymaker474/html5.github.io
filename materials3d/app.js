(()=>{
'use strict';
const $=id=>document.getElementById(id),canvas=$('view'),backend=$('backend'),hud=$('hud'),quality=$('quality'),brush=$('brush'),brushV=$('brushV'),cohesion=$('cohesion'),cohesionV=$('cohesionV'),pauseBtn=$('pause');
const fallbackCanvas=document.createElement('canvas');
fallbackCanvas.id='fallbackView';fallbackCanvas.setAttribute('aria-hidden','true');Object.assign(fallbackCanvas.style,{position:'absolute',inset:'0',width:'100%',height:'100%',display:'none',pointerEvents:'none',zIndex:'1',background:'#07111a'});canvas.insertAdjacentElement('afterend',fallbackCanvas);
let tool='orbit',worker=null,renderer=null,lastPacked=null,lastSnapshot=null,lastInvariant=null,busy=false,paused=false,simHz=0,lastState=performance.now(),renderFps=0,rf=0,rt=0,lastFrame=performance.now(),rendererGeneration=0,gpuFailing=false;
function grid(){const [width,height]=quality.value.split('x').map(Number);return{width,height};}
function backendStatus(text,good=false){backend.textContent=text;backend.className='backend '+(good?'good':'warn');}
function showGPU(){canvas.style.opacity='1';fallbackCanvas.style.display='none';}
function showFallback(){canvas.style.opacity='0';fallbackCanvas.style.display='block';}
function shortReason(reason){const s=String(reason?.message||reason||'WebGPU runtime failure').replace(/\s+/g,' ').trim();return s.length>90?s.slice(0,87)+'…':s;}
function fallback(width,height,reason){
  if(renderer?.kind==='Canvas isometric fallback')return;
  renderer=new GenesisCanvas3DMaterialsRenderer(fallbackCanvas,width,height);if(lastPacked)renderer.updateState(lastPacked);showFallback();
  const why=shortReason(reason);backendStatus('SAFE FALLBACK · '+why);console.warn('GENESIS Materials3D WebGPU fallback:',reason);
}
async function validateGPU(r){
  if(!r?.device?.pushErrorScope||!r?.device?.popErrorScope)return;
  r.device.pushErrorScope('validation');
  try{r.render(performance.now());await r.device.queue.onSubmittedWorkDone();const err=await r.device.popErrorScope();if(err)throw new Error('WebGPU validation: '+(err.message||err));}
  catch(err){try{await r.device.popErrorScope();}catch{}throw err;}
}
async function createRenderer(width,height){
  const g=++rendererGeneration;renderer=null;gpuFailing=false;showGPU();backendStatus('PROBING WEBGPU + VALIDATION');
  try{
    const r=await GenesisWebGPU3DMaterialsRenderer.create(canvas,width,height);if(g!==rendererGeneration)return;
    const gpuError=e=>{if(g!==rendererGeneration||gpuFailing)return;gpuFailing=true;const err=e?.error||e;console.error('GENESIS uncaptured WebGPU error',err);fallback(width,height,err);};
    if(r.device?.addEventListener)r.device.addEventListener('uncapturederror',gpuError);
    await validateGPU(r);if(g!==rendererGeneration)return;
    renderer=r;if(lastPacked)renderer.updateState(lastPacked);showGPU();backendStatus('WEBGPU 3D · VALIDATION PROBE PASS',true);
  }catch(err){if(g!==rendererGeneration)return;fallback(width,height,err);}
}
function initWorker(){
  if(worker)worker.terminate();const {width,height}=grid();lastPacked=null;lastSnapshot=null;busy=false;worker=new Worker('./worker.js');
  worker.onmessage=e=>{const m=e.data||{};if(m.type==='error'){backendStatus('SIMULATION ERROR · '+shortReason(m.message));console.error(m.message);busy=false;return;}if(m.type!=='state')return;const now=performance.now(),dt=(now-lastState)/1000;lastState=now;if(dt>0)simHz=simHz*.84+(1/dt)*.16;lastPacked=new Float32Array(m.buffer);lastSnapshot=m.snapshot;lastInvariant=m.invariant;busy=false;renderer?.updateState(lastPacked);if(!paused)queueStep();};
  worker.onerror=e=>{console.error(e);backendStatus('WORKER ERROR · '+shortReason(e.message));busy=false;};
  worker.postMessage({type:'init',width,height,seed:0x3d5a17,cohesion:+cohesion.value});createRenderer(width,height);
}
function queueStep(){if(paused||busy||!worker)return;busy=true;const n=grid().width*grid().height;worker.postMessage({type:'step',iterations:n<=9000?2:1});}
function paintAt(e){if(tool==='orbit'||!renderer)return;const p=renderer.screenToGrid(e.clientX,e.clientY);if(!p)return;worker?.postMessage({type:'paint',kind:tool,x:p.x,z:p.z,radius:+brush.value,amount:tool==='water'?.85:1.0});}
let pointer=false,lastX=0,lastY=0,lastPaint='';
canvas.addEventListener('pointerdown',e=>{pointer=true;lastX=e.clientX;lastY=e.clientY;lastPaint='';canvas.setPointerCapture?.(e.pointerId);if(tool!=='orbit'){paintAt(e);lastPaint=`${e.clientX|0}:${e.clientY|0}`;}e.preventDefault();});
canvas.addEventListener('pointermove',e=>{if(!pointer)return;const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;if(tool==='orbit')renderer?.orbit(dx,dy);else{const key=`${e.clientX|0}:${e.clientY|0}`;if(key!==lastPaint){lastPaint=key;paintAt(e);}}e.preventDefault();});
for(const ev of ['pointerup','pointercancel','pointerleave'])canvas.addEventListener(ev,()=>{pointer=false;lastPaint='';});
canvas.addEventListener('wheel',e=>{renderer?.zoom(e.deltaY);e.preventDefault();},{passive:false});
let pinchDistance=0;const touches=new Map();canvas.addEventListener('pointerdown',e=>{touches.set(e.pointerId,[e.clientX,e.clientY]);});canvas.addEventListener('pointermove',e=>{if(touches.has(e.pointerId))touches.set(e.pointerId,[e.clientX,e.clientY]);if(touches.size===2){const a=[...touches.values()],d=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]);if(pinchDistance)renderer?.zoom((pinchDistance-d)*2.2);pinchDistance=d;}},{passive:true});for(const ev of ['pointerup','pointercancel'])canvas.addEventListener(ev,e=>{touches.delete(e.pointerId);if(touches.size<2)pinchDistance=0;});
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{tool=b.dataset.tool;document.querySelectorAll('[data-tool]').forEach(x=>x.classList.toggle('active',x===b));$('mode').textContent=tool.toUpperCase();});
brush.oninput=()=>brushV.textContent=brush.value;cohesion.oninput=()=>{cohesionV.textContent=(+cohesion.value).toFixed(2);worker?.postMessage({type:'set-cohesion',value:+cohesion.value});};quality.onchange=initWorker;
pauseBtn.onclick=()=>{paused=!paused;pauseBtn.textContent=paused?'Resume':'Pause';if(!paused)queueStep();};
$('reset').onclick=()=>worker?.postMessage({type:'reset'});$('camera').onclick=()=>renderer?.resetCamera();
$('dune').onclick=()=>{const {width,height}=grid();worker?.postMessage({type:'burst',kind:'sand',x:Math.floor(width*.52),z:Math.floor(height*.48),radius:Math.floor(width*.10),amount:1.6});};
$('storm').onclick=()=>{const {width,height}=grid();worker?.postMessage({type:'burst',kind:'water',x:Math.floor(width*.60),z:Math.floor(height*.40),radius:Math.floor(width*.08),amount:1.2});};
function updateHud(){if(!lastSnapshot)return;const t=lastSnapshot.totals,inv=lastInvariant?.status||'UNKNOWN';hud.innerHTML=`<span>${renderer?.kind||'starting'}</span><span>${lastSnapshot.width}² grid</span><span>sand ${t.sand.toFixed(0)}</span><span>water ${t.water.toFixed(0)}</span><span>wet ${t.wetCells}</span><span>sim ${simHz.toFixed(1)} state/s</span><span>render ${renderFps.toFixed(0)} fps</span><span>${inv}</span>`;}
function frame(now){const dt=(now-lastFrame)/1000;lastFrame=now;rf++;rt+=dt;if(rt>.5){renderFps=rf/rt;rf=0;rt=0;updateHud();}if(renderer?.kind==='WebGPU 3D'&&renderer.lost){const {width,height}=grid();fallback(width,height,'WebGPU device lost');}try{renderer?.render(now);}catch(err){console.error('GENESIS Materials3D render error',err);if(renderer?.kind==='WebGPU 3D'){const {width,height}=grid();fallback(width,height,err);}}requestAnimationFrame(frame);}
brushV.textContent=brush.value;cohesionV.textContent=(+cohesion.value).toFixed(2);initWorker();requestAnimationFrame(frame);
})();
