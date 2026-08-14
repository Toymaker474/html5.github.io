import fs from 'node:fs';
import assert from 'node:assert/strict';

const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const bridge=fs.readFileSync(new URL('../native-main.js',import.meta.url),'utf8');
const renderer=fs.readFileSync(new URL('../native-ray-volume.js',import.meta.url),'utf8');
const worker=fs.readFileSync(new URL('../../volume3d/worker.js',import.meta.url),'utf8');
const cpp=fs.readFileSync(new URL('../../volume3d/solver.cpp',import.meta.url),'utf8');

assert.match(index,/native-ray-volume\.js/);
assert.match(index,/native-main\.js/);
assert.doesNotMatch(index,/scratch\/main\.js/);
assert.match(index,/C\+\+ VOLUMETRIC WORLD/);
assert.match(bridge,/\.\.\/volume3d\/worker\.js/);
assert.match(bridge,/GenesisRayVolumeRenderer\.create/);
assert.doesNotMatch(bridge,/getContext\(['"]2d|topCell\(|function proj\(|transferControlToOffscreen|OffscreenCanvas/);
assert.match(renderer,/getContext\(['"]webgpu/);
assert.match(renderer,/texture_3d<f32>/);
assert.match(renderer,/textureSampleLevel/);
assert.match(renderer,/boxHit\(/);
assert.match(renderer,/gradS\(/);
assert.match(renderer,/softShadow\(/);
assert.match(renderer,/shadeWater\(/);
assert.doesNotMatch(renderer,/THREE|BABYLON|PlayCanvas|p5\.|pixi|matter\.js/i);
assert.match(worker,/solver\.v1\.wasm\.b64/);
assert.match(cpp,/EXPORT\("genesis_step"\)/);

const bytes=Buffer.from(fs.readFileSync(new URL('../../volume3d/solver.v1.wasm.b64',import.meta.url),'utf8').trim(),'base64');
const {instance}=await WebAssembly.instantiate(bytes,{}),e=instance.exports;
assert.equal(e.genesis_model_version()>>>0,0x00030001);
e.genesis_init(32,24,32,0x3d5a17,72);e.genesis_seed_scene();
const before=e.genesis_hash()>>>0;
for(let i=0;i<16;i++)e.genesis_step(1);
assert.notEqual(e.genesis_hash()>>>0,before);
assert.equal(e.genesis_invariant(),1);
assert.ok((e.genesis_sand_moves()>>>0)+(e.genesis_water_moves()>>>0)>0);
console.log('PASS active GENESIS: native C++/WASM state + true WebGPU 3D volume ray renderer; flat Canvas projection forbidden');
