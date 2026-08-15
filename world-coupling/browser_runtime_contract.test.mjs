import fs from 'node:fs';import crypto from 'node:crypto';
const manifest=JSON.parse(fs.readFileSync(new URL('./weather_volume_bridge.manifest.json',import.meta.url),'utf8'));
const wasm=fs.readFileSync(new URL('./weather_volume_bridge.wasm',import.meta.url));
const worker=fs.readFileSync(new URL('./worker.js',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('../genesis-codehood/native-main.js',import.meta.url),'utf8');
const sha=crypto.createHash('sha256').update(wasm).digest('hex');
function ok(v,msg){if(!v)throw new Error(msg);}
ok(manifest.model==='genesis-weather3d-volume-coupling-v1','wrong model');
ok(manifest.model_version==='0x00010001','wrong model version');
ok(manifest.wasm.bytes===38910&&wasm.length===38910,'wrong exact WASM bytes');
ok(manifest.wasm.sha256===sha&&sha==='3fbec5c7f18a07e9c809a32f1b4444480d5dcfc28a7a9577a4d87e8404f437ae','wrong exact WASM SHA');
ok(WebAssembly.Module.imports(new WebAssembly.Module(wasm)).length===0,'WASM imports forbidden');
for(const s of ['genesis_world_coupling_step','genesis_world_coupling_conservation_error','genesis_world_coupling_injected_voxels','genesis_world_coupling_evaporated_voxels','genesis_world_coupling_terrain_feedback_cells'])ok(worker.includes(s),'worker missing '+s);
ok(worker.includes("fetch('./weather_volume_bridge.wasm?v=runtime-v1'"),'worker must fetch exact bridge payload');
ok(worker.includes('EXPECTED_SHA')&&worker.includes(sha),'worker must pin exact bridge SHA');
ok(main.includes("new Worker('../world-coupling/worker.js?v=runtime-v1')"),'active route must use the one coupling worker');
ok(!main.includes("new Worker('../volume3d/worker.js"),'active route must not keep duplicate uncoupled worker');
ok(main.includes('couplingError')&&main.includes('couplingInjected')&&main.includes('couplingEvaporated'),'active telemetry must expose real coupling state');
console.log('PASS GENESIS browser Weather3D-volume coupling contract');
