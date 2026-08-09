import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
async function instantiateBytes(bytes,label){
  try{return (await WebAssembly.instantiate(bytes,{})).instance.exports;}
  catch(err){console.error(`${label}_INSTANTIATE_FAIL: ${err?.message||err}`);throw err;}
}
function fixture(e){
  assert.equal(e.genesis_model_version()>>>0,0x00030001);
  e.genesis_init(32,24,32,123456,72);e.genesis_seed_scene();
  const s0=e.genesis_sand_mass_units()>>>0,w0=e.genesis_water_cells()>>>0,h0=e.genesis_hash()>>>0;
  for(let i=0;i<80;i++)e.genesis_step(1);
  const out={hash:e.genesis_hash()>>>0,sand:e.genesis_sand_mass_units()>>>0,water:e.genesis_water_cells()>>>0,erosion:e.genesis_erosion_events()>>>0,deposition:e.genesis_deposition_events()>>>0,invariant:e.genesis_invariant()};
  assert.equal(out.sand,s0);assert.equal(out.water,w0);assert.notEqual(out.hash,h0);assert.equal(out.invariant,1);assert.ok(out.erosion>0);assert.ok(out.deposition>0);
  e.genesis_init(32,24,32,123456,72);e.genesis_seed_scene();for(let i=0;i<80;i++)e.genesis_step(1);assert.equal(e.genesis_hash()>>>0,out.hash);
  return out;
}
const committed=Buffer.from(fs.readFileSync(new URL('./solver.wasm.b64',import.meta.url),'utf8').trim(),'base64');
const compiledPath=process.argv[2]||null;
let compiled=null,compiledResult=null;
if(compiledPath){
  compiled=fs.readFileSync(compiledPath);
  console.log(JSON.stringify({freshCompiledBytes:compiled.byteLength,freshCompiledSha256:crypto.createHash('sha256').update(compiled).digest('hex')}));
  compiledResult=fixture(await instantiateBytes(compiled,'FRESH_COMPILED_WASM'));
  console.log('PASS fresh C++ -> WebAssembly instantiate + semantic fixture');
}
let committedResult=null;
try{
  console.log(JSON.stringify({committedBrowserBytes:committed.byteLength,committedBrowserSha256:crypto.createHash('sha256').update(committed).digest('hex')}));
  committedResult=fixture(await instantiateBytes(committed,'COMMITTED_BROWSER_WASM'));
}catch(err){
  if(compiled){console.error('FRESH_WASM_B64_BEGIN');console.error(compiled.toString('base64'));console.error('FRESH_WASM_B64_END');}
  throw err;
}
if(compiledResult)assert.deepEqual(compiledResult,committedResult,'committed browser WASM and freshly compiled C++ WASM must agree on reference fixture');
console.log(JSON.stringify({model:'genesis-materials-volume3d-cpp-v1',committedWasmBytes:committed.byteLength,committedResult,compiledResult}));
console.log('PASS genesis materials 0.3 committed + compiled WebAssembly tests');
