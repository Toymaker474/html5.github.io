import fs from 'node:fs';
import assert from 'node:assert/strict';

const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const bridge=fs.readFileSync(new URL('../native-main.js',import.meta.url),'utf8');
const renderer=fs.readFileSync(new URL('../native-ray-volume.js',import.meta.url),'utf8');
const worker=fs.readFileSync(new URL('../../volume3d/worker.js',import.meta.url),'utf8');
const cpp=fs.readFileSync(new URL('../../volume3d/solver.cpp',import.meta.url),'utf8');

assert.match(index,/native-ray-volume\.js/);assert.match(index,/native-main\.js/);assert.doesNotMatch(index,/scratch\/main\.js/);assert.match(index,/C\+\+ VOLUMETRIC WORLD/);
assert.match(bridge,/\.\.\/volume3d\/worker\.js/);assert.match(bridge,/GenesisRayVolumeRenderer\.create/);assert.doesNotMatch(bridge,/getContext\(['"]2d|topCell\(|function proj\(|transferControlToOffscreen|OffscreenCanvas/);
assert.match(renderer,/getContext\(['"]webgpu/);assert.match(renderer,/texture_3d<f32>/);assert.match(renderer,/textureSampleLevel/);assert.match(renderer,/boxHit\(/);assert.match(renderer,/gradS\(/);assert.match(renderer,/softShadow\(/);assert.match(renderer,/shadeWater\(/);assert.doesNotMatch(renderer,/THREE|BABYLON|PlayCanvas|p5\.|pixi|matter\.js/i);
assert.match(worker,/solver\.v1\.wasm\.b64/);assert.match(worker,/genesis_fluid_divergence_before/);assert.match(worker,/genesis_fluid_kinetic_energy/);
assert.match(cpp,/EXPORT\("genesis_step"\)/);assert.match(cpp,/EXPORT\("genesis_impulse_water"\)/);assert.match(cpp,/solve_pressure\(/);assert.match(cpp,/project_velocity\(/);

const bytes=Buffer.from(fs.readFileSync(new URL('../../volume3d/solver.v1.wasm.b64',import.meta.url),'utf8').trim(),'base64');
const {instance}=await WebAssembly.instantiate(bytes,{}),e=instance.exports;
assert.equal(e.genesis_model_version()>>>0,0x00040001);
e.genesis_init(32,24,32,0x3d5a17,72);e.genesis_seed_scene();
const water0=e.genesis_water_cells()>>>0,before=e.genesis_hash()>>>0;
const kicked=e.genesis_impulse_water(24,7,10,6,420,0,160)|0;assert.ok(kicked>0);assert.ok((e.genesis_fluid_momentum_x()|0)>0);
e.genesis_step(1);assert.ok((e.genesis_fluid_divergence_after()>>>0)<=(e.genesis_fluid_divergence_before()>>>0));
for(let i=1;i<16;i++)e.genesis_step(1);
assert.notEqual(e.genesis_hash()>>>0,before);assert.equal(e.genesis_water_cells()>>>0,water0);assert.equal(e.genesis_invariant(),1);assert.ok(e.genesis_fluid_kinetic_energy()>>>0);
console.log('PASS active GENESIS: C++/WASM owns 3D material state plus explicit native fluid momentum/pressure projection; WebGPU remains presentation; flat Canvas projection forbidden');
