'use strict';

let exportsRef=null;
let memory=null;
let initArgs={w:40,h:28,d:40,seed:0x3d5a17,cohesion:72};
let wasmBytes=0;

function fail(err){
  postMessage({type:'fatal',message:String(err&&err.stack||err)});
}

function decodeBase64(text){
  const raw=atob(text.replace(/\s+/g,''));
  const out=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);
  return out;
}

function meta(){
  const e=exportsRef;
  return {
    modelVersion:e.genesis_model_version()>>>0,
    w:e.genesis_width()>>>0,
    h:e.genesis_height()>>>0,
    d:e.genesis_depth()>>>0,
    step:e.genesis_step_count()>>>0,
    hash:e.genesis_hash()>>>0,
    sandUnits:e.genesis_sand_units()>>>0,
    waterVoxels:e.genesis_water_voxels()>>>0,
    sandMoves:e.genesis_sand_moves()>>>0,
    waterMoves:e.genesis_water_moves()>>>0,
    erosion:e.genesis_erosion_events()>>>0,
    deposition:e.genesis_deposition_events()>>>0,
    invariant:e.genesis_invariant()>>>0,
    waterMass:e.genesis_total_water_mass(),
    divergenceBefore:e.genesis_fluid_divergence_before(),
    divergenceAfter:e.genesis_fluid_divergence_after(),
    kineticEnergy:e.genesis_fluid_kinetic_energy(),
    momentumX:e.genesis_fluid_momentum_x(),
    momentumY:e.genesis_fluid_momentum_y(),
    momentumZ:e.genesis_fluid_momentum_z()
  };
}

function emitState(){
  const e=exportsRef;
  e.genesis_pack();
  const ptr=e.genesis_state_ptr()>>>0;
  const bytes=e.genesis_state_bytes()>>>0;
  const copy=new Uint8Array(bytes);
  copy.set(new Uint8Array(memory.buffer,ptr,bytes));
  const m=meta();
  if(!m.invariant)throw new Error('Native fluid invariant failed at step '+m.step);
  postMessage({type:'state',buffer:copy.buffer,meta:m},[copy.buffer]);
}

async function boot(args){
  initArgs={...initArgs,...args};
  const response=await fetch('../volume3d/solver.v4.wasm.b64?v=cpp-fluid-v4',{cache:'no-store'});
  if(!response.ok)throw new Error('Native v4 WASM fetch failed: HTTP '+response.status);
  const encoded=await response.text();
  const bytes=decodeBase64(encoded);
  wasmBytes=bytes.byteLength;
  const {instance}=await WebAssembly.instantiate(bytes,{});
  exportsRef=instance.exports;
  memory=exportsRef.memory;
  if(!memory)throw new Error('Native v4 WASM did not export memory');
  if((exportsRef.genesis_model_version()>>>0)!==0x00040001)throw new Error('Wrong native model version');
  exportsRef.genesis_init(initArgs.w,initArgs.h,initArgs.d,initArgs.seed>>>0,initArgs.cohesion|0);
  exportsRef.genesis_seed_scene();
  postMessage({type:'ready',wasmBytes,modelVersion:exportsRef.genesis_model_version()>>>0,kernel:'C++ fluid v4'});
  emitState();
}

onmessage=async event=>{
  try{
    const m=event.data||{};
    if(m.type==='init'){await boot(m);return;}
    if(!exportsRef)throw new Error('Native v4 kernel not initialized');
    if(m.type==='step'){
      exportsRef.genesis_step(Math.max(1,Math.min(12,m.iterations|0||1)));
      emitState();
    }else if(m.type==='reset'){
      exportsRef.genesis_init(initArgs.w,initArgs.h,initArgs.d,initArgs.seed>>>0,initArgs.cohesion|0);
      exportsRef.genesis_seed_scene();
      emitState();
    }else if(m.type==='paint'){
      exportsRef.genesis_paint(m.kind|0,m.x|0,m.y|0,m.z|0,m.radius|0);
      emitState();
    }else if(m.type==='impulse'){
      exportsRef.genesis_impulse_water(m.x|0,m.y|0,m.z|0,m.radius|0,+m.ix||0,+m.iy||0,+m.iz||0);
      emitState();
    }
  }catch(err){fail(err);}
};
