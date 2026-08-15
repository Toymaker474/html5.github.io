import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const bytes=fs.readFileSync(process.argv[2]);
const mod=await WebAssembly.compile(bytes);
assert.equal(WebAssembly.Module.imports(mod).length,0,'runtime body WASM must have zero imports');
const {exports:e}=await WebAssembly.instantiate(mod,{});
assert.equal(e.genesis_runtime_body_model_version()>>>0,0x00010001);
function floodBodySamples(){
  let painted=0;
  for(let i=0;i<e.genesis_body_node_count();i++){
    const x=Math.trunc(e.genesis_body_node_x(i)/65536);
    const y=Math.trunc(e.genesis_body_node_y(i)/65536);
    const z=Math.trunc(e.genesis_body_node_z(i)/65536);
    const n=e.genesis_paint(2,x,y,z,2);
    if(n>0)painted+=n;
  }
  assert.ok(painted>0,'native WATER fixture must paint around actual body nodes');
}
function fixture(){
  e.genesis_runtime_body_reset(0x51a7);
  assert.equal(e.genesis_body_node_count(),18);
  assert.ok((e.genesis_runtime_body_synced_solids()>>>0)>0);
  floodBodySamples();
  assert.ok((e.genesis_water_cells()>>>0)>0);
  e.genesis_hydro_apply();
  assert.ok((e.genesis_hydro_submerged_nodes()>>>0)>0);
  assert.ok((e.genesis_hydro_submerged_samples()>>>0)>0);
  assert.ok((e.genesis_hydro_buoyancy_impulse()>>>0)>0);
  const body0=e.genesis_body_hash()>>>0;
  for(let i=0;i<24;i++)e.genesis_runtime_body_step(1,1,1);
  assert.notEqual(e.genesis_body_hash()>>>0,body0);
  assert.equal(e.genesis_world_coupling_conservation_error()>>>0,0);
  assert.equal(e.genesis_invariant(),1);
  return e.genesis_runtime_body_hash()>>>0;
}
const a=fixture(),b=fixture();assert.equal(a,b);
console.log('REFERENCE_HASH',a);
console.log(JSON.stringify({model:'genesis-runtime-body-promotion-v1',bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),imports:0,hash:a}));
console.log('PASS GENESIS runtime body promotion V1 WASM parity');
