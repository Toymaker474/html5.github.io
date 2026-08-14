import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
async function instantiateBytes(bytes,label){
  try{return (await WebAssembly.instantiate(bytes,{})).instance.exports;}
  catch(err){console.error(`${label}_INSTANTIATE_FAIL: ${err?.message||err}`);throw err;}
}
function fixture(e){
  assert.equal(e.genesis_model_version()>>>0,0x00030002);
  assert.equal(typeof e.genesis_water_momentum,'function');
  assert.equal(typeof e.genesis_pressure_sum,'function');
  e.genesis_init(32,24,32,123456,72);e.genesis_seed_scene();
  const s0=e.genesis_sand_mass_units()>>>0,w0=e.genesis_water_cells()>>>0,h0=e.genesis_hash()>>>0,p0=e.genesis_pressure_sum()>>>0;
  assert.ok(p0>0,'seeded water body must have pressure-proxy state');
  for(let i=0;i<80;i++)e.genesis_step(1);
  const out={hash:e.genesis_hash()>>>0,sand:e.genesis_sand_mass_units()>>>0,water:e.genesis_water_cells()>>>0,momentum:e.genesis_water_momentum()>>>0,pressure:e.genesis_pressure_sum()>>>0,erosion:e.genesis_erosion_events()>>>0,deposition:e.genesis_deposition_events()>>>0,invariant:e.genesis_invariant()};
  assert.equal(out.sand,s0);assert.equal(out.water,w0);assert.notEqual(out.hash,h0);assert.equal(out.invariant,1);assert.ok(out.momentum>0);assert.ok(out.erosion>0);assert.ok(out.deposition>0);
  e.genesis_init(32,24,32,123456,72);e.genesis_seed_scene();for(let i=0;i<80;i++)e.genesis_step(1);assert.equal(e.genesis_hash()>>>0,out.hash);
  return out;
}
const committedPath=new URL('./solver.v2.wasm.b64',import.meta.url);
const committed=Buffer.from(fs.readFileSync(committedPath,'utf8').trim(),'base64');
const compiledPath=process.argv[2]||null;
let compiled=null,compiledResult=null;
if(compiledPath){
  compiled=fs.readFileSync(compiledPath);
  console.log(JSON.stringify({freshCompiledBytes:compiled.byteLength,freshCompiledSha256:crypto.createHash('sha256').update(compiled).digest('hex')}));
  compiledResult=fixture(await instantiateBytes(compiled,'FRESH_COMPILED_WASM'));
  console.log('PASS fresh C++ -> WebAssembly v2 instantiate + semantic fixture');
}
console.log(JSON.stringify({committedBrowserFile:'solver.v2.wasm.b64',committedBrowserBytes:committed.byteLength,committedBrowserSha256:crypto.createHash('sha256').update(committed).digest('hex')}));
const committedResult=fixture(await instantiateBytes(committed,'COMMITTED_BROWSER_WASM'));
if(compiledResult)assert.deepEqual(compiledResult,committedResult,'versioned browser WASM and freshly compiled C++ WASM must agree on v2 reference fixture');
console.log(JSON.stringify({model:'genesis-materials-volume3d-cpp-v2',committedWasmBytes:committed.byteLength,committedResult,compiledResult}));
console.log('PASS genesis materials native v2 versioned browser + compiled WebAssembly tests');
