const EXPECTED_SHA='91491be5228fd3724ffb173b11e769d574eda164b98e21d08fbbb40bb2f21db8';
const W=96,H=48,D=96,N=W*H*D,SN=W*D;
const $=id=>document.getElementById(id);
const canvas=$('world3d');
let e=null,device=null,context=null,pipeline=null,bindGroup=null;
let atmoBuffer=null,surfaceBuffer=null,uniformBuffer=null;
let atmoPack=new Uint32Array(N),surfacePack=new Uint32Array(SN);
let running=true,lastSim=0,lastMetric=0,yaw=-0.72,pitch=0.34,radius=128;
let dragging=false,lastX=0,lastY=0;

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function hex(buf){return [...new Uint8Array(buf)].map(v=>v.toString(16).padStart(2,'0')).join('');}
async function fetchBytesRetry(url){let err;for(let n=0;n<3;n++){try{const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(`${url} HTTP ${r.status}`);return new Uint8Array(await r.arrayBuffer());}catch(x){err=x;await new Promise(q=>setTimeout(q,90*(n+1)));}}throw err;}

async function loadNative(){
  $('boot').textContent='VERIFYING C++ → WASM…';
  const tag=EXPECTED_SHA.slice(0,12);
  const manifest=await fetch(`weather3d.manifest.json?v=${tag}`,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`manifest HTTP ${r.status}`);return r.json();});
  if(manifest.wasm_file!=='weather3d.wasm')throw new Error('native manifest does not point to direct compiler WASM');
  const bytes=await fetchBytesRetry(`${manifest.wasm_file}?v=${tag}`);
  if(bytes.byteLength!==13433||bytes.byteLength!==manifest.wasm_bytes)throw new Error(`WASM bytes ${bytes.byteLength} != 13433`);
  if(!globalThis.crypto?.subtle)throw new Error('WebCrypto unavailable; cannot verify native payload');
  const digest=hex(await crypto.subtle.digest('SHA-256',bytes));
  if(digest!==EXPECTED_SHA||digest!==manifest.wasm_sha256)throw new Error(`WASM SHA mismatch ${digest.slice(0,12)}`);
  const module=await WebAssembly.compile(bytes);
  const imports=WebAssembly.Module.imports(module);
  if(imports.length!==0)throw new Error(`WASM imports=${imports.length}; expected zero`);
  const instance=await WebAssembly.instantiate(module,{});
  const x=instance.exports;
  if(x.genesis_weather3d_model_version()!==0x00020001)throw new Error('native model version mismatch');
  if(x.genesis_weather3d_width()!==W||x.genesis_weather3d_height()!==H||x.genesis_weather3d_depth()!==D)throw new Error('native 3D dimensions mismatch');
  if(!(x.memory instanceof WebAssembly.Memory))throw new Error('native memory export missing');
  $('sha').textContent=digest.slice(0,12)+'…';
  return x;
}

function nativeViews(){
  const mem=e.memory.buffer;
  return {
    cloud:new Uint16Array(mem,e.genesis_weather3d_cloud_ptr(),N),
    rain:new Uint16Array(mem,e.genesis_weather3d_rain_ptr(),N),
    tornado:new Uint8Array(mem,e.genesis_weather3d_tornado_ptr(),N),
    terrain:new Uint16Array(mem,e.genesis_weather3d_terrain_ptr(),SN),
    water:new Uint16Array(mem,e.genesis_weather3d_surface_water_ptr(),SN),
    discharge:new Uint32Array(mem,e.genesis_weather3d_discharge_ptr(),SN)
  };
}

function uploadNativeState(){
  const v=nativeViews();
  for(let i=0;i<N;i++)atmoPack[i]=((v.cloud[i]&4095)|((v.rain[i]&4095)<<12)|((v.tornado[i]&255)<<24))>>>0;
  for(let i=0;i<SN;i++)surfacePack[i]=((Math.min(v.terrain[i],63)&63)|((Math.min(v.water[i],1023)&1023)<<6)|((Math.min(v.discharge[i],65535)&65535)<<16))>>>0;
  device.queue.writeBuffer(atmoBuffer,0,atmoPack);
  device.queue.writeBuffer(surfaceBuffer,0,surfacePack);
}

const WGSL=String.raw`
struct Params { aspect:f32, yaw:f32, pitch:f32, radius:f32, exposure:f32, cloudGain:f32, pad0:f32, pad1:f32 };
@group(0) @binding(0) var<storage,read> atmo:array<u32>;
@group(0) @binding(1) var<storage,read> surface:array<u32>;
@group(0) @binding(2) var<uniform> params:Params;

const W:f32=96.0; const H:f32=48.0; const D:f32=96.0;
const SUN:vec3<f32>=vec3<f32>(0.548,0.777,-0.309);
struct VOut { @builtin(position) pos:vec4<f32>, @location(0) uv:vec2<f32> };

@vertex fn vs(@builtin(vertex_index) i:u32)->VOut{
  var p=array<vec2<f32>,3>(vec2<f32>(-1.0,-1.0),vec2<f32>(3.0,-1.0),vec2<f32>(-1.0,3.0));
  var o:VOut;o.pos=vec4<f32>(p[i],0.0,1.0);o.uv=p[i]*0.5+0.5;return o;
}
fn idx3(p:vec3<i32>)->u32{return u32((p.y*96+p.z)*96+p.x);}
fn idx2(x:i32,z:i32)->u32{return u32(z*96+x);}
fn clampCell(p:vec3<f32>)->vec3<i32>{return vec3<i32>(clamp(i32(p.x),0,95),clamp(i32(p.y),0,47),clamp(i32(p.z),0,95));}
fn aSample(p:vec3<f32>)->vec3<f32>{
  let q=atmo[idx3(clampCell(p))];
  return vec3<f32>(f32(q&4095u)/4095.0,f32((q>>12u)&4095u)/4095.0,f32((q>>24u)&255u)/255.0);
}
fn cloudD(p:vec3<f32>)->f32{return aSample(p).x;}
fn surf(x:i32,z:i32)->vec3<f32>{
  let xx=clamp(x,0,95);let zz=clamp(z,0,95);let q=surface[idx2(xx,zz)];
  return vec3<f32>(f32(q&63u),f32((q>>6u)&1023u),f32((q>>16u)&65535u));
}
fn terrainNormal(x:i32,z:i32)->vec3<f32>{
  let hx=surf(x+1,z).x-surf(x-1,z).x;let hz=surf(x,z+1).x-surf(x,z-1).x;
  return normalize(vec3<f32>(-hx*0.5,2.0,-hz*0.5));
}
fn boxHit(ro:vec3<f32>,rd:vec3<f32>)->vec2<f32>{
  let inv=1.0/rd;let a=(vec3<f32>(0.0)-ro)*inv;let b=(vec3<f32>(W,H,D)-ro)*inv;
  let lo=min(a,b);let hi=max(a,b);let tn=max(lo.x,max(lo.y,lo.z));let tf=min(hi.x,min(hi.y,hi.z));return vec2<f32>(tn,tf);
}
fn sky(rd:vec3<f32>)->vec3<f32>{
  let h=clamp(rd.y*0.5+0.5,0.0,1.0);var c=mix(vec3<f32>(0.055,0.075,0.095),vec3<f32>(0.28,0.48,0.68),h);
  let sun=pow(max(dot(rd,SUN),0.0),620.0);c+=vec3<f32>(1.0,0.72,0.36)*sun*4.0;return c;
}
fn groundColor(h:f32,water:f32,q:f32,n:vec3<f32>)->vec3<f32>{
  let high=smoothstep(5.0,17.0,h);var c=mix(vec3<f32>(0.10,0.18,0.095),vec3<f32>(0.34,0.31,0.25),high);
  let snow=smoothstep(15.0,22.0,h);c=mix(c,vec3<f32>(0.72,0.76,0.72),snow);
  let river=smoothstep(350.0,5000.0,q);let wet=clamp(water/140.0,0.0,1.0);c=mix(c,vec3<f32>(0.025,0.19,0.29),max(river,wet*0.65));
  let lit=0.20+0.80*max(dot(n,SUN),0.0);return c*lit;
}
fn cloudNormal(p:vec3<f32>)->vec3<f32>{
  let ex=vec3<f32>(1.0,0.0,0.0),ey=vec3<f32>(0.0,1.0,0.0),ez=vec3<f32>(0.0,0.0,1.0);
  let g=vec3<f32>(cloudD(p+ex)-cloudD(p-ex),cloudD(p+ey)-cloudD(p-ey),cloudD(p+ez)-cloudD(p-ez));
  let m=length(g);if(m<0.001){return vec3<f32>(0.0,1.0,0.0);}return -g/m;
}
fn cloudLight(p:vec3<f32>,n:vec3<f32>)->f32{
  let shadow=cloudD(p+SUN*3.0)+cloudD(p+SUN*7.0)+cloudD(p+SUN*12.0);
  let direct=max(dot(n,SUN),0.0);return (0.30+0.85*direct)*exp(-shadow*0.62);
}

@fragment fn fs(i:VOut)->@location(0) vec4<f32>{
  let target=vec3<f32>(48.0,13.0,48.0);
  let cp=cos(params.pitch);let sp=sin(params.pitch);let cy=cos(params.yaw);let sy=sin(params.yaw);
  let ro=target+vec3<f32>(sy*cp,sp,cy*cp)*params.radius;
  let f=normalize(target-ro);let r=normalize(cross(f,vec3<f32>(0.0,1.0,0.0)));let u=cross(r,f);
  let ndc=i.uv*2.0-1.0;let rd=normalize(f+r*ndc.x*params.aspect*0.72+u*ndc.y*0.72);
  let hit=boxHit(ro,rd);var col=sky(rd);if(hit.y<=max(hit.x,0.0)){return vec4<f32>(col,1.0);}
  var t=max(hit.x,0.0);let end=hit.y;let ds=max((end-t)/104.0,0.35);var trans=1.0;var accum=vec3<f32>(0.0);
  for(var s:i32=0;s<116;s++){
    if(t>end||trans<0.018){break;}let p=ro+rd*t;
    let xi=clamp(i32(p.x),0,95);let zi=clamp(i32(p.z),0,95);let sf=surf(xi,zi);
    if(p.y<=sf.x+0.22){
      let n=terrainNormal(xi,zi);let gc=groundColor(sf.x,sf.y,sf.z,n);accum+=trans*gc;trans=0.0;break;
    }
    let a=aSample(p);let c=smoothstep(0.08,0.74,a.x)*params.cloudGain;let rain=smoothstep(0.01,0.35,a.y);let torn=a.z;
    let density=c*0.105+rain*0.020+torn*0.075;
    if(density>0.001){
      let alpha=1.0-exp(-density*ds);var sc=vec3<f32>(0.73,0.77,0.79);
      if(c>0.02){let n=cloudNormal(p);let l=cloudLight(p,n);sc=mix(vec3<f32>(0.20,0.23,0.27),vec3<f32>(0.93,0.95,0.96),clamp(l,0.0,1.0));}
      sc=mix(sc,vec3<f32>(0.18,0.34,0.48),rain*0.42);
      sc=mix(sc,vec3<f32>(0.28,0.18,0.11),torn*0.78);
      accum+=trans*alpha*sc;trans*=1.0-alpha;
    }
    t+=ds;
  }
  if(trans>0.0){accum+=trans*col;}
  let fog=clamp((1.0-trans)*0.08,0.0,0.08);accum=mix(accum,vec3<f32>(0.42,0.53,0.58),fog);
  let mapped=vec3<f32>(1.0)-exp(-accum*params.exposure);return vec4<f32>(pow(mapped,vec3<f32>(0.4545)),1.0);
}`;

async function initGPU(){
  if(!navigator.gpu)throw new Error('WEBGPU UNAVAILABLE — refusing flat 2D fallback');
  $('boot').textContent='STARTING WEBGPU VOLUME…';
  const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});if(!adapter)throw new Error('WebGPU adapter unavailable');
  device=await adapter.requestDevice();context=canvas.getContext('webgpu');if(!context)throw new Error('WebGPU canvas context unavailable');
  const format=navigator.gpu.getPreferredCanvasFormat();context.configure({device,format,alphaMode:'opaque'});
  atmoBuffer=device.createBuffer({size:N*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
  surfaceBuffer=device.createBuffer({size:SN*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
  uniformBuffer=device.createBuffer({size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  device.pushErrorScope('validation');
  const module=device.createShaderModule({code:WGSL});
  pipeline=device.createRenderPipeline({layout:'auto',vertex:{module,entryPoint:'vs'},fragment:{module,entryPoint:'fs',targets:[{format}]},primitive:{topology:'triangle-list'}});
  const validation=await device.popErrorScope();if(validation)throw new Error('WebGPU shader/pipeline: '+validation.message);
  bindGroup=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:atmoBuffer}},{binding:1,resource:{buffer:surfaceBuffer}},{binding:2,resource:{buffer:uniformBuffer}}]});
}

function resize(){const dpr=Math.min(devicePixelRatio||1,2.25);const w=Math.max(320,Math.round(canvas.clientWidth*dpr)),h=Math.max(240,Math.round(canvas.clientHeight*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}}
function metrics(){if(!e)return;$('steps').textContent=e.genesis_weather3d_steps().toLocaleString();$('clouds').textContent=e.genesis_weather3d_cloud_cells().toLocaleString();$('tornadoes').textContent=e.genesis_weather3d_tornado_cells().toLocaleString();$('rivers').textContent=e.genesis_weather3d_river_cells().toLocaleString();$('flow').textContent=e.genesis_weather3d_max_discharge().toLocaleString();$('hash').textContent=(e.genesis_weather3d_hash()>>>0).toString(16).padStart(8,'0');}
function setScenario(kind){
  e.genesis_weather3d_reset(kind==='natural'?0x51a7:0x7721);
  if(kind==='river')e.genesis_weather3d_seed_river_basin();
  if(kind==='storm'){e.genesis_weather3d_seed_river_basin();e.genesis_weather3d_seed_supercell(52,48);}
  if(kind==='natural')e.genesis_weather3d_step(2);
  uploadNativeState();metrics();$('scenario').textContent=kind==='storm'?'3D SUPERCELL + BASIN':kind==='river'?'3D RAIN BASIN':'NATURAL 3D ATMOSPHERE';
}
function render(t){
  resize();
  if(running&&t-lastSim>260){lastSim=t;e.genesis_weather3d_step(1);uploadNativeState();}
  if(t-lastMetric>500){lastMetric=t;metrics();}
  const data=new Float32Array([canvas.width/canvas.height,yaw,pitch,radius,1.15,1.18,0,0]);device.queue.writeBuffer(uniformBuffer,0,data);
  const encoder=device.createCommandEncoder();const pass=encoder.beginRenderPass({colorAttachments:[{view:context.getCurrentTexture().createView(),clearValue:{r:0.02,g:0.03,b:0.04,a:1},loadOp:'clear',storeOp:'store'}]});
  pass.setPipeline(pipeline);pass.setBindGroup(0,bindGroup);pass.draw(3);pass.end();device.queue.submit([encoder.finish()]);requestAnimationFrame(render);
}

canvas.addEventListener('pointerdown',ev=>{dragging=true;lastX=ev.clientX;lastY=ev.clientY;canvas.setPointerCapture(ev.pointerId);});
canvas.addEventListener('pointermove',ev=>{if(!dragging)return;const dx=ev.clientX-lastX,dy=ev.clientY-lastY;lastX=ev.clientX;lastY=ev.clientY;yaw-=dx*0.008;pitch=clamp(pitch+dy*0.006,-0.05,1.12);});
canvas.addEventListener('pointerup',()=>dragging=false);canvas.addEventListener('pointercancel',()=>dragging=false);
canvas.addEventListener('wheel',ev=>{ev.preventDefault();radius=clamp(radius+ev.deltaY*0.09,72,190);},{passive:false});
$('storm').addEventListener('click',()=>setScenario('storm'));$('river').addEventListener('click',()=>setScenario('river'));$('natural').addEventListener('click',()=>setScenario('natural'));
$('play').addEventListener('click',()=>{running=!running;$('play').textContent=running?'PAUSE':'RUN';});
$('step').addEventListener('click',()=>{if(e){e.genesis_weather3d_step(1);uploadNativeState();metrics();}});
$('resetCamera').addEventListener('click',()=>{yaw=-0.72;pitch=0.34;radius=128;});

(async()=>{try{e=await loadNative();await initGPU();setScenario('storm');$('boot').textContent='C++/WASM · WEBGPU · TRUE 3D';$('boot').className='ok';requestAnimationFrame(render);}catch(err){console.error(err);$('boot').textContent='BOOT ERROR: '+err.message;$('boot').className='bad';$('error').textContent=String(err?.stack||err);}})();
