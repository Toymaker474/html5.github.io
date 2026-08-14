(()=>{'use strict';
const $=id=>document.getElementById(id),canvas=$('sim'),ctx=canvas.getContext('2d',{alpha:false,desynchronized:true}),info=$('info'),selected=$('selected');
let worker=null,state=null,meta=null,paused=false,speed=1,rainMode=0,frame=0,last=performance.now(),fps=0,fc=0,ft=0,ready=false,wasmBytes=0;
let cam={yaw:-.72,pitch:.58,zoom:8.7,targetYaw:-.72,targetPitch:.58,targetZoom:8.7,panX:0,panY:0,targetPanX:0,targetPanY:0};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function setStatus(t,ok=false){info.textContent=t;info.classList.toggle('good',ok);}
function fatal(t){ready=false;document.body.classList.add('blocked');setStatus('C++ WASM BLOCKED');selected.textContent=t;console.error(t);}
function resize(){const r=canvas.getBoundingClientRect(),d=Math.min(2,devicePixelRatio||1);canvas.width=Math.max(1,Math.floor(r.width*d));canvas.height=Math.max(1,Math.floor(r.height*d));ctx.setTransform(d,0,0,d,0,0);}
resize();addEventListener('resize',resize,{passive:true});
function start(){
  setStatus('loading C++ → WebAssembly…');
  worker=new Worker('../volume3d/worker.js?v=native-active-1');
  worker.onerror=e=>fatal('Worker boot failed: '+(e.message||'unknown'));
  worker.onmessage=e=>{const m=e.data||{};if(m.type==='fatal'||m.type==='error'){fatal(m.message||'C++ worker failed');return;}if(m.type==='ready'){ready=true;wasmBytes=m.wasmBytes||0;setStatus('C++/WASM native kernel',true);return;}if(m.type==='state'){state=new Uint32Array(m.buffer);meta=m.meta;busy=false;document.body.classList.remove('blocked');if(!paused)queueStep();}};
  worker.postMessage({type:'init',w:40,h:28,d:40,seed:0x3d5a17,cohesion:72});
}
let busy=false;function queueStep(){if(!worker||busy||paused||!ready)return;busy=true;worker.postMessage({type:'step',iterations:speed===4?4:speed===2?2:1});}
function unpack(i){const v=state[i]>>>0;return{mat:v&255,wet:(v>>>8)&255,sed:(v>>>16)&255};}
function topCell(x,z){if(!meta||!state)return null;for(let y=meta.h-1;y>=0;y--){const i=(y*meta.d+z)*meta.w+x,q=unpack(i);if(q.mat)return{...q,x,y,z,i};}return null;}
function proj(x,y,z){const cy=Math.cos(cam.yaw),sy=Math.sin(cam.yaw),cp=Math.cos(cam.pitch),sp=Math.sin(cam.pitch);let X=x-meta.w*.5,Z=z-meta.d*.5,Y=y-meta.h*.35;const rx=X*cy-Z*sy,rz=X*sy+Z*cy,ry=Y*cp-rz*sp,depth=Y*sp+rz*cp;const s=cam.zoom*(1+depth*.002);return{x:innerWidth*.5+cam.panX+rx*s,y:innerHeight*.48+cam.panY-ry*s,d:depth};}
function shade(c,light){const m=c.mat;if(m===3)return `rgb(${Math.floor(68*light)},${Math.floor(76*light)},${Math.floor(78*light)})`;if(m===1){const wet=c.wet/255;return `rgb(${Math.floor((122-wet*35)*light)},${Math.floor((86-wet*24)*light)},${Math.floor((52-wet*12)*light)})`;}if(m===2)return `rgba(${Math.floor(25*light)},${Math.floor(128*light)},${Math.floor(172*light)},.72)`;return '#000';}
function render(){
  const w=innerWidth,h=innerHeight,g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,'#07131d');g.addColorStop(.55,'#0b1718');g.addColorStop(1,'#030807');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  if(!state||!meta){ctx.fillStyle='#d8e8ea';ctx.font='700 13px ui-monospace,monospace';ctx.fillText('waiting for compiled C++ world state…',18,70);return;}
  const cells=[];for(let z=0;z<meta.d;z++)for(let x=0;x<meta.w;x++){const c=topCell(x,z);if(c)cells.push(c);}cells.sort((a,b)=>proj(a.x,a.y,a.z).d-proj(b.x,b.y,b.z).d);
  ctx.lineJoin='round';ctx.lineCap='round';
  for(const c of cells){const p0=proj(c.x,c.y,c.z),p1=proj(c.x+1,c.y,c.z),p2=proj(c.x+1,c.y,c.z+1),p3=proj(c.x,c.y,c.z+1);const e1x=p1.x-p0.x,e1y=p1.y-p0.y,e2x=p3.x-p0.x,e2y=p3.y-p0.y,area=Math.abs(e1x*e2y-e1y*e2x);if(area<.15)continue;const light=clamp(.62+(c.y/meta.h)*.38-(c.z/meta.d)*.08,.45,1.08);ctx.beginPath();ctx.moveTo(p0.x,p0.y);ctx.lineTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.lineTo(p3.x,p3.y);ctx.closePath();ctx.fillStyle=shade(c,light);ctx.fill();if(cam.zoom>8){ctx.strokeStyle=c.mat===2?'rgba(175,235,255,.13)':'rgba(230,245,235,.035)';ctx.lineWidth=.45;ctx.stroke();}
    if(c.mat===2){ctx.strokeStyle='rgba(190,239,255,.42)';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(p0.x,p0.y);ctx.quadraticCurveTo((p0.x+p2.x)*.5+Math.sin(frame*.06+c.x*.8+c.z)*1.2,(p0.y+p2.y)*.5,p2.x,p2.y);ctx.stroke();}
  }
  ctx.globalCompositeOperation='screen';const glow=ctx.createRadialGradient(w*.54,h*.20,10,w*.54,h*.20,Math.max(w,h)*.66);glow.addColorStop(0,'rgba(150,202,180,.10)');glow.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);ctx.globalCompositeOperation='source-over';
}
function telemetry(){if(!meta)return;const inv=meta.invariant?'PASS':'FAIL';info.innerHTML=`<b>C++/WASM</b> · ${meta.w}×${meta.h}×${meta.d} · ${(meta.w*meta.h*meta.d).toLocaleString()} cells · ${fps.toFixed(0)} fps`;selected.textContent=`step ${meta.step} · water ${meta.waterVoxels} · sand ${(meta.sandUnits/255).toFixed(0)} eq · erosion ${meta.erosion} · deposition ${meta.deposition} · invariant ${inv} · WASM ${(wasmBytes/1024).toFixed(1)} KB`;}
function loop(now){const dt=Math.min(.05,(now-last)/1000);last=now;cam.yaw+=(cam.targetYaw-cam.yaw)*(1-Math.exp(-dt*12));cam.pitch+=(cam.targetPitch-cam.pitch)*(1-Math.exp(-dt*12));cam.zoom+=(cam.targetZoom-cam.zoom)*(1-Math.exp(-dt*12));cam.panX+=(cam.targetPanX-cam.panX)*(1-Math.exp(-dt*12));cam.panY+=(cam.targetPanY-cam.panY)*(1-Math.exp(-dt*12));render();fc++;ft+=dt;if(ft>.5){fps=fc/ft;fc=0;ft=0;telemetry();}frame++;if(!paused&&!busy)queueStep();requestAnimationFrame(loop);}
const pts=new Map();let gesture=null;canvas.addEventListener('pointerdown',e=>{e.preventDefault();pts.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture?.(e.pointerId);gesture=null;},{passive:false});canvas.addEventListener('pointermove',e=>{if(!pts.has(e.pointerId))return;e.preventDefault();const p=pts.get(e.pointerId),dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;if(pts.size===1){cam.targetYaw+=dx*.009;cam.targetPitch=clamp(cam.targetPitch+dy*.007,.12,1.22);}else{const a=[...pts.values()];const d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);if(gesture){cam.targetZoom=clamp(cam.targetZoom*d/gesture.d,3.5,20);}gesture={d};}},{passive:false});for(const ev of['pointerup','pointercancel'])canvas.addEventListener(ev,e=>{pts.delete(e.pointerId);gesture=null;},{passive:true});
function button(id,fn){$(id)?.addEventListener('click',fn);}button('pause',()=>{paused=!paused;$('pause').textContent=paused?'▶':'Ⅱ';if(!paused)queueStep();});button('speed',()=>{speed=speed===1?2:speed===2?4:1;$('speed').textContent='×'+speed;});button('weather',()=>{if(!meta)return;rainMode=(rainMode+1)%3;const r=rainMode===1?4:rainMode===2?6:3;worker.postMessage({type:'paint',kind:2,x:Math.floor(meta.w*.7),y:Math.floor(meta.h*.8),z:Math.floor(meta.d*.35),radius:r});});button('reset',()=>worker?.postMessage({type:'reset'}));button('toggleUI',()=>document.body.classList.toggle('clean'));button('sound',()=>{});
start();requestAnimationFrame(loop);
})();
