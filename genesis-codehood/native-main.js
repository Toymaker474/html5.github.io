(()=>{'use strict';
const $=id=>document.getElementById(id),canvas=$('sim'),info=$('info'),selected=$('selected');
let worker=null,renderer=null,state=null,meta=null,paused=false,speed=1,rainMode=0,busy=false,nativeReady=false,wasmBytes=0,last=performance.now(),fc=0,ft=0,fps=0;
function status(t,ok=false){info.textContent=t;info.classList.toggle('good',ok);}
function fatal(label,msg){document.body.classList.add('blocked');status(label);selected.textContent=msg;console.error(label,msg);}
async function start(){
  status('starting true 3D GPU volume…');
  try{renderer=await GenesisRayVolumeRenderer.create(canvas,40,28,40);}catch(err){fatal('WEBGPU 3D BLOCKED',String(err?.message||err));return;}
  status('3D GPU ready · loading C++ kernel…');
  worker=new Worker('../volume3d/worker.js?v=native-ray-1');
  worker.onerror=e=>fatal('C++ WORKER BLOCKED',e.message||'worker error');
  worker.onmessage=e=>{
    const m=e.data||{};
    if(m.type==='fatal'||m.type==='error'){fatal('C++ WASM BLOCKED',m.message||'native kernel error');return;}
    if(m.type==='ready'){nativeReady=true;wasmBytes=m.wasmBytes||0;status('C++/WASM + TRUE 3D WEBGPU',true);return;}
    if(m.type==='state'){
      state=new Uint32Array(m.buffer);meta=m.meta;busy=false;renderer.updateState(state);document.body.classList.remove('blocked');
      if(!paused)queueStep();
    }
  };
  worker.postMessage({type:'init',w:40,h:28,d:40,seed:0x3d5a17,cohesion:72});
  requestAnimationFrame(loop);
}
function queueStep(){if(!worker||busy||paused||!nativeReady)return;busy=true;worker.postMessage({type:'step',iterations:speed===4?4:speed===2?2:1});}
function telemetry(){if(!meta)return;const inv=meta.invariant?'PASS':'FAIL';info.innerHTML=`<b>C++/WASM · WEBGPU 3D</b> · ${meta.w}×${meta.h}×${meta.d} · ${fps.toFixed(0)} fps`;selected.textContent=`native step ${meta.step} · water ${meta.waterVoxels} · sand ${(meta.sandUnits/255).toFixed(0)} eq · erosion ${meta.erosion} · deposition ${meta.deposition} · invariant ${inv} · WASM ${(wasmBytes/1024).toFixed(1)} KB`;}
function loop(now){const dt=Math.min(.05,(now-last)/1000);last=now;try{renderer?.render(now);}catch(err){fatal('WEBGPU RENDER BLOCKED',String(err?.message||err));renderer=null;return;}fc++;ft+=dt;if(ft>.5){fps=fc/ft;fc=0;ft=0;telemetry();}if(!paused&&!busy)queueStep();requestAnimationFrame(loop);}
const pts=new Map();let pinch=0;
canvas.addEventListener('pointerdown',e=>{e.preventDefault();pts.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture?.(e.pointerId);pinch=0;},{passive:false});
canvas.addEventListener('pointermove',e=>{if(!pts.has(e.pointerId)||!renderer)return;e.preventDefault();const p=pts.get(e.pointerId),dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;if(pts.size===1){renderer.orbit(dx,dy);}else{const a=[...pts.values()],d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);if(pinch>0)renderer.zoom((pinch-d)*4);pinch=d;}},{passive:false});
for(const ev of['pointerup','pointercancel'])canvas.addEventListener(ev,e=>{pts.delete(e.pointerId);pinch=0;},{passive:true});
canvas.addEventListener('wheel',e=>{renderer?.zoom(e.deltaY);e.preventDefault();},{passive:false});
function button(id,fn){$(id)?.addEventListener('click',fn);}
button('pause',()=>{paused=!paused;$('pause').textContent=paused?'▶':'Ⅱ';if(!paused)queueStep();});
button('speed',()=>{speed=speed===1?2:speed===2?4:1;$('speed').textContent='×'+speed;});
button('weather',()=>{if(!meta||!worker)return;rainMode=(rainMode+1)%3;const r=rainMode===1?4:rainMode===2?6:3;worker.postMessage({type:'paint',kind:2,x:Math.floor(meta.w*.7),y:Math.floor(meta.h*.8),z:Math.floor(meta.d*.35),radius:r});});
button('reset',()=>worker?.postMessage({type:'reset'}));button('toggleUI',()=>document.body.classList.toggle('clean'));
start();
})();