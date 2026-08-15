import fs from 'node:fs';
import assert from 'node:assert/strict';

const wasmPath=process.argv[2];
if(!wasmPath) throw new Error('usage: node weather_volume_bridge_wasm.test.mjs <wasm>');
const bytes=fs.readFileSync(wasmPath);
const mod=await WebAssembly.instantiate(bytes,{});
const e=mod.instance.exports;
for(const name of [
  'genesis_world_coupling_model_version','genesis_world_coupling_reference_fixture',
  'genesis_world_coupling_conservation_error','genesis_world_coupling_injected_voxels',
  'genesis_world_coupling_weather_removed_units','genesis_world_coupling_volume_added_units'
]) assert.equal(typeof e[name],'function',`missing export ${name}`);
assert.equal(e.genesis_world_coupling_model_version(),0x00010001);
const h1=e.genesis_world_coupling_reference_fixture()>>>0;
const h2=e.genesis_world_coupling_reference_fixture()>>>0;
assert.equal(h1,h2,'reference fixture must replay deterministically');
assert.notEqual(h1,0,'reference hash must be nonzero');
assert.equal(e.genesis_world_coupling_conservation_error(),0,'bridge transfer accounting must close exactly');
assert.equal(e.genesis_world_coupling_injected_voxels(),1,'reference fixture must inject one real volume water voxel');
assert.equal(e.genesis_world_coupling_weather_removed_units(),256);
assert.equal(e.genesis_world_coupling_volume_added_units(),256);
console.log(`REFERENCE_HASH ${h1}`);
console.log('PASS GENESIS Weather3D V2 <-> native volume coupling WASM parity');
