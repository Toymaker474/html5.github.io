import fs from 'node:fs';
import assert from 'node:assert/strict';

const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const bridge=fs.readFileSync(new URL('../native-main.js',import.meta.url),'utf8');
const surface=fs.readFileSync(new URL('../native-surface.js',import.meta.url),'utf8');
const worker=fs.readFileSync(new URL('../../volume3d/worker.js',import.meta.url),'utf8');
const cpp=fs.readFileSync(new URL('../../volume3d/solver.cpp',import.meta.url),'utf8');

assert.match(index,/native-surface\.js/);
assert.match(index,/native-main\.js/);
assert.ok(index.indexOf('native-surface.js')<index.indexOf('native-main.js'),'state mesher must load before renderer');
assert.doesNotMatch(index,/scratch\/main\.js/);
assert.match(index,/C\+\+ NATIVE WORLD/);
assert.match(bridge,/\.\.\/volume3d\/worker\.js/);
assert.match(bridge,/GENESIS_SURFACE/);
assert.doesNotMatch(bridge,/transferControlToOffscreen|OffscreenCanvas/);
assert.doesNotMatch(bridge,/Math\.sin\(frame/,'water presentation must not invent a fake animated wave');
assert.match(surface,/function build\(state,meta\)/);
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
console.log('PASS active GENESIS boots committed C++/WASM, advances native material state, and renders only state-derived surface geometry');
