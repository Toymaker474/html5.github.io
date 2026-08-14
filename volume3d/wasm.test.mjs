import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
async function instantiateBytes(bytes,label){try{return (await WebAssembly.instantiate(bytes,{})).instance.exports;}catch(err){console.error(`${label}_INSTANTIATE_FAIL: ${err?.message||err}`);throw err;}}
function fixture(e){
  assert.equal(e.genesis_model_version()>>>0,0x00040001);
  for(const name of ['genesis_fluid_divergence_before','genesis_fluid_divergence_after','genesis_fluid_kinetic_energy','genesis_fluid_momentum_x','genesis_fluid_momentum_y','genesis_fluid_momentum_z','genesis_impulse_water'])assert.equal(typeof e[name],'function',`missing ${name}`);
  e.genesis_init(32,24,32,123456,72);e.genesis_seed_scene();const s0=e.genesis_sand_mass_units()>>>0,w0=e.genesis_water_cells()>>>0,h0=e.genesis_hash()>>>0;
  assert.ok((e.genesis_impulse_water(24,7,10,6,420,0,160)|0)>0);assert.ok((e.genesis_fluid_momentum_x()|0)>0);e.genesis_step(1);
  const divBefore=e.genesis_fluid_divergence_before()>>>0,divAfter=e.genesis_fluid_divergence_after()>>>0;assert.ok(divBefore>0);assert.ok(divAfter<=divBefore,`projection ${divBefore}->${divAfter}`);assert.ok((e.genesis_fluid_kinetic_energy()>>>0)>0);
  for(let i=1;i<80;i++)e.genesis_step(1);const out={hash:e.genesis_hash()>>>0,sand:e.genesis_sand_mass_units()>>>0,water:e.genesis_water_cells()>>>0,erosion:e.genesis_erosion_events()>>>0,deposition:e.genesis_deposition_events()>>>0,divBefore,divAfter,kinetic:e.genesis_fluid_kinetic_energy()>>>0,momentum:[e.genesis_fluid_momentum_x()|0,e.genesis_fluid_momentum_y()|0,e.genesis_fluid_momentum_z()|0],invariant:e.genesis_invariant()};
  assert.equal(out.sand,s0);assert.equal(out.water,w0);assert.notEqual(out.hash,h0);assert.equal(out.invariant,1);assert.ok(out.erosion>0);assert.ok(out.deposition>0);assert.ok(out.kinetic>0);
  e.genesis_init(32,24,32,123456,72);e.genesis_seed_scene();e.genesis_impulse_water(24,7,10,6,420,0,160);for(let i=0;i<80;i++)e.genesis_step(1);assert.equal(e.genesis_hash()>>>0,out.hash);return out;
}
const compiledPath=process.argv[2]||null;let compiledResult=null;
if(compiledPath){const compiled=fs.readFileSync(compiledPath);console.log(JSON.stringify({freshCompiledBytes:compiled.byteLength,freshCompiledSha256:crypto.createHash('sha256').update(compiled).digest('hex')}));console.log('FRESH_COMPILED_B64='+compiled.toString('base64'));compiledResult=fixture(await instantiateBytes(compiled,'FRESH_COMPILED_WASM'));console.log('PASS fresh C++ -> WebAssembly projection fixture');}
const committedPath=new URL('./solver.v3.wasm.b64',import.meta.url);if(!fs.existsSync(committedPath)){console.error('BROWSER_PAYLOAD_MISSING solver.v3.wasm.b64');process.exit(2);}const committed=Buffer.from(fs.readFileSync(committedPath,'utf8').trim(),'base64');console.log(JSON.stringify({committedBrowserFile:'solver.v3.wasm.b64',committedBrowserBytes:committed.byteLength,committedBrowserSha256:crypto.createHash('sha256').update(committed).digest('hex')}));const committedResult=fixture(await instantiateBytes(committed,'COMMITTED_BROWSER_WASM'));if(compiledResult)assert.deepEqual(compiledResult,committedResult);console.log(JSON.stringify({model:'genesis-volume3d-projection-v1',committedWasmBytes:committed.byteLength,committedResult,compiledResult}));console.log('PASS GENESIS native 3D projection browser + compiled WebAssembly tests');
