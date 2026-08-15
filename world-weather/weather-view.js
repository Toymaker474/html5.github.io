const EXPECTED_SHA='d95d030df7ca6594d1d8641c483fec234d185d5ad7de6ef0ded56207b627929c';
const EXPECTED_BYTES=10669;
const PARTS=['weather.wasm.part0.b64','weather.wasm.part1.b64','weather.wasm.part2.b64','weather.wasm.part3a.b64','weather.wasm.part3b.b64','weather.wasm.part3c.b64','weather.wasm.part3d.b64'];
const SIM_W=192,SIM_H=128,N=SIM_W*SIM_H;
const $=id=>document.getElementById(id);
const canvas=$('world');
const ctx=canvas.getContext('2d',{alpha:false});
if(!ctx)throw new Error('2D canvas unavailable');
const source=document.createElement('canvas');source.width=SIM_W;source.height=SIM_H;
const sx=source.getContext('2d',{alpha:false});
if(!sx)throw new Error('offscreen 2D canvas unavailable');
const img=sx.createImageData(SIM_W,SIM_H);
const elevationCache=new Uint16Array(N);
const MOBILE=/iPhone|iPad|iPod/i.test(navigator.userAgent)||((navigator.maxTouchPoints||0)>1&&/Macintosh/i.test(navigator.userAgent));
const DRAW_MS=MOBILE?340:95;
let api=null,running=true,speed=1,layer='composite',lastStep=0,lastDraw=0,booted=false;

function clamp(v,a,b){return v<a?a:v>b?b:v;}
function mix(a,b,t){return a+(b-a)*t;}
function hex(bytes){return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');}
function decodeBase64(s){const raw=atob(s);const out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out;}
function delay(ms){return new Promise(r=>setTimeout(r,ms));}
async function fetchText(name){
  let lastErr=null;
  const tag=EXPECTED_SHA.slice(0,16);
  for(let attempt=0;attempt<3;attempt++){
    try{
      const r=await fetch(`./${name}?v=${tag}&a=${attempt}`,{cache:'no-store'});
      if(!r.ok)throw new Error(`${name} ${r.status}`);
      const text=await r.text();
      if(!text.trim())throw new Error(`${name} empty`);
      return text;
    }catch(err){lastErr=err;if(attempt<2)await delay(180*(attempt+1));}
  }
  throw lastErr||new Error(`${name} fetch failed`);
}
async function loadNative(){
  if(!globalThis.WebAssembly)throw new Error('WebAssembly unavailable');
  if(!globalThis.crypto?.subtle)throw new Error('secure SHA-256 unavailable');
  const chunks=await Promise.all(PARTS.map(fetchText));
  const bytes=decodeBase64(chunks.map(s=>s.trim()).join(''));
  if(bytes.byteLength!==EXPECTED_BYTES)throw new Error(`WASM byte mismatch ${bytes.byteLength}/${EXPECTED_BYTES}`);
  const digest=hex(await crypto.subtle.digest('SHA-256',bytes));
  if(digest!==EXPECTED_SHA)throw new Error('WASM SHA-256 mismatch — refusing simulation boot');
  if(!WebAssembly.validate(bytes))throw new Error('WASM validation failed');
  const built=await WebAssembly.instantiate(bytes,{});
  const mod=built.module;const instance=built.instance;
  const imports=WebAssembly.Module.imports(mod);if(imports.length)throw new Error('unexpected WASM imports');
  const e=instance.exports;
  if(e.genesis_weather_model_version()!==0x00010001)throw new Error('native model version mismatch');
  if(e.genesis_weather_width()!==SIM_W||e.genesis_weather_height()!==SIM_H)throw new Error('native map resolution mismatch');
  $('sha').textContent=digest.slice(0,12)+'…';
  return e;
}

function refreshElevation(){
  if(!api)return;
  let i=0;for(let z=0;z<SIM_H;z++)for(let x=0;x<SIM_W;x++)elevationCache[i++]=api.genesis_weather_elevation_at(x,z);
}
function setScenario(kind){
  if(!api)return;
  if(kind==='natural'){
    api.genesis_weather_reset(0x51a7);
    $('scenario').textContent='NATURAL TERRAIN';
  }else if(kind==='river'){
    api.genesis_weather_reset(0x7721);api.genesis_weather_seed_river_basin();api.genesis_weather_step(12);
    $('scenario').textContent='RIVER BASIN INITIAL CONDITION';
  }else{
    api.genesis_weather_reset(0x7721);api.genesis_weather_seed_river_basin();api.genesis_weather_seed_supercell(124,64);api.genesis_weather_step(6);
    $('scenario').textContent='SUPERCELL + RIVER BASIN INITIAL CONDITION';
  }
  refreshElevation();draw(true);updateMetrics();
}

function terrainColor(e){
  const t=clamp((e-40)/1760,0,1);
  if(t<0.26){const q=t/0.26;return [mix(12,35,q),mix(45,81,q),mix(39,55,q)];}
  if(t<0.60){const q=(t-.26)/.34;return [mix(35,83,q),mix(81,94,q),mix(55,58,q)];}
  if(t<0.84){const q=(t-.60)/.24;return [mix(83,112,q),mix(94,103,q),mix(58,82,q)];}
  const q=(t-.84)/.16;return [mix(112,211,q),mix(103,218,q),mix(82,214,q)];
}

function draw(force=false){
  const now=performance.now();if(!api||(!force&&now-lastDraw<DRAW_MS))return;lastDraw=now;
  const d=img.data;const tornadoMarks=[];let k=0,i=0;
  for(let z=0;z<SIM_H;z++)for(let x=0;x<SIM_W;x++,i++){
    const elevation=elevationCache[i];
    let [r,g,b]=terrainColor(elevation);
    if(layer!=='atmosphere'){
      const surface=api.genesis_weather_water_at(x,z);
      const discharge=api.genesis_weather_discharge_at(x,z)>>>0;
      const wet=clamp(surface/850,0,.72);r=mix(r,15,wet);g=mix(g,89,wet);b=mix(b,119,wet);
      const river=clamp((discharge-700)/9000,0,.92);r=mix(r,6,river);g=mix(g,146,river);b=mix(b,194,river);
    }else{r*=.62;g*=.62;b*=.62;}
    if(layer!=='hydrology'){
      const cloud=api.genesis_weather_cloud_at(x,z);
      const rain=api.genesis_weather_rain_at(x,z);
      const tornado=api.genesis_weather_tornado_at(x,z);
      const c=clamp((cloud-260)/3600,0,.80);r=mix(r,218,c);g=mix(g,228,c);b=mix(b,230,c);
      const rr=clamp(rain/150,0,.72);r=mix(r,69,rr);g=mix(g,117,rr);b=mix(b,151,rr);
      if(tornado>0){const q=clamp(.45+tornado/300,0,1);r=mix(r,255,q);g=mix(g,128,q*.65);b=mix(b,48,q*.35);tornadoMarks.push([x,z,tornado]);}
    }
    d[k++]=r|0;d[k++]=g|0;d[k++]=b|0;d[k++]=255;
  }
  sx.putImageData(img,0,0);
  const rect=canvas.getBoundingClientRect();const ratio=Math.min(devicePixelRatio||1,MOBILE?1.5:2);const w=Math.max(320,Math.round(rect.width*ratio)),h=Math.round(w*SIM_H/SIM_W);
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(source,0,0,canvas.width,canvas.height);
  if(layer!=='hydrology'&&tornadoMarks.length){
    const scaleX=canvas.width/SIM_W,scaleY=canvas.height/SIM_H;ctx.lineWidth=Math.max(1.5,scaleX*.55);
    for(const [x,z,t] of tornadoMarks){const px=(x+.5)*scaleX,py=(z+.5)*scaleY,rad=scaleX*(1.2+t/90);ctx.strokeStyle=`rgba(255,221,167,${clamp(.22+t/350,.25,.8)})`;ctx.beginPath();ctx.arc(px,py,rad,0,Math.PI*1.55);ctx.stroke();}
  }
}

function updateMetrics(){
  if(!api)return;
  $('steps').textContent=api.genesis_weather_steps().toLocaleString();
  $('clouds').textContent=api.genesis_weather_cloud_cells().toLocaleString();
  $('rain').textContent=api.genesis_weather_rain_cells().toLocaleString();
  $('rivers').textContent=api.genesis_weather_river_cells().toLocaleString();
  $('tornadoes').textContent=api.genesis_weather_tornado_cells().toLocaleString();
  $('discharge').textContent=(api.genesis_weather_max_discharge()>>>0).toLocaleString();
}

function frame(t){
  if(booted&&running&&t-lastStep>105){lastStep=t;api.genesis_weather_step(speed);updateMetrics();}
  if(booted)draw();requestAnimationFrame(frame);
}

$('play').addEventListener('click',()=>{running=!running;$('play').textContent=running?'PAUSE':'RUN';});
$('step').addEventListener('click',()=>{if(api){api.genesis_weather_step(1);draw(true);updateMetrics();}});
$('storm').addEventListener('click',()=>setScenario('storm'));
$('river').addEventListener('click',()=>setScenario('river'));
$('natural').addEventListener('click',()=>setScenario('natural'));
$('speed').addEventListener('change',e=>{speed=Number(e.target.value)||1;$('speedLabel').textContent=speed+'×';});
document.querySelectorAll('[data-layer]').forEach(b=>b.addEventListener('click',()=>{layer=b.dataset.layer;document.querySelectorAll('[data-layer]').forEach(x=>x.classList.toggle('on',x===b));draw(true);}));
window.addEventListener('resize',()=>draw(true),{passive:true});
document.addEventListener('visibilitychange',()=>{lastStep=performance.now();lastDraw=0;});

(async()=>{
  try{
    $('boot').textContent='VERIFYING COMPILER-PROVEN WASM…';api=await loadNative();booted=true;$('boot').textContent=MOBILE?'NATIVE WASM · MOBILE SAFE':'NATIVE C++ → VERIFIED WASM';$('boot').classList.add('ok');setScenario('storm');requestAnimationFrame(frame);
  }catch(err){console.error(err);$('boot').textContent='BOOT ERROR: '+err.message;$('boot').classList.add('bad');$('scenario').textContent='SIMULATION DID NOT START';running=false;}
})();