const MODE = {forager:0, explorer:1, swarm:2, chaos:3};
let wasmBytesPromise;
async function wasmBytes(){
  if(!wasmBytesPromise){
    wasmBytesPromise = fetch('../assets/engine.b64?v=3').then(r=>{if(!r.ok)throw new Error('engine fetch '+r.status);return r.text();}).then(t=>{
      const s=t.trim(); const bin=atob(s); const u=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i); return u;
    });
  }
  return wasmBytesPromise;
}
async function makeEngine(){ const bytes=await wasmBytes(); const {instance}=await WebAssembly.instantiate(bytes,{}); return instance.exports; }
function clean(d){
  const mode=MODE[d.mode]===undefined?'forager':d.mode;
  return {
    seed:(Number(d.seed)||42)>>>0,
    population:Math.max(4,Math.min(48,Math.round(Number(d.population)||24))),
    mode,
    mutation:Math.max(0,Math.min(1,Number(d.mutation) || .18)),
    wind:Math.max(0,Math.min(3,Number(d.wind) || 1)),
    rounds:Math.max(1,Math.min(3,Math.round(Number(d.rounds)||2)))
  };
}
async function evaluate(cfg,seed,steps){
  const e=await makeEngine(); e.init(seed>>>0,cfg.population,MODE[cfg.mode],cfg.mutation,cfg.wind); e.step(steps);
  return {seed:seed>>>0, score:+e.score().toFixed(2), food:e.food_eaten(), births:e.birth_count(), deaths:e.death_count(), population:e.count()};
}
async function evolve(cfg){
  let center=cfg.seed>>>0,best=null,all=[];
  const offsets=[0,101,211,307,419];
  for(let r=0;r<cfg.rounds;r++){
    all=[];
    for(const o of offsets){ const seed=(center + o + r*997)>>>0; const m=await evaluate(cfg,seed,320 + r*120); all.push(m); if(!best || m.score>best.score)best=m; }
    center=best.seed;
  }
  return {best, candidates:all};
}
window['ai_edge_gallery_get_result']=async(dataStr)=>{
  try{
    const raw=JSON.parse(dataStr||'{}'); const cfg=clean(raw); const action=raw.action||'evolve';
    if(action==='probe'){
      const m=await evaluate(cfg,cfg.seed,520);
      return JSON.stringify({result:`PROBE seed=${m.seed} score=${m.score} food=${m.food} births=${m.births} deaths=${m.deaths}`,metrics:m});
    }
    if(action==='evolve'){
      const out=await evolve(cfg),b=out.best;
      return JSON.stringify({result:`EVOLUTION_COMPLETE bestSeed=${b.seed} score=${b.score} food=${b.food} births=${b.births} deaths=${b.deaths}. Now call run_js again with action=launch and seed=${b.seed}.`,bestSeed:b.seed,metrics:b,candidates:out.candidates});
    }
    const q=new URLSearchParams({seed:String(cfg.seed),population:String(cfg.population),mode:cfg.mode,mutation:String(cfg.mutation),wind:String(cfg.wind),v:String(Date.now())});
    return JSON.stringify({result:`NeuroFly launched with genome ${cfg.seed}. Tap the preview to inspect the fly brain.`,webview:{url:`ui.html?${q}`,aspectRatio:1.45}});
  }catch(e){console.error(e);return JSON.stringify({error:`NeuroFly failed: ${e.message}`});}
};
