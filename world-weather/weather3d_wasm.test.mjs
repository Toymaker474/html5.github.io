import fs from 'node:fs';
const path=process.argv[2];
if(!path)throw new Error('usage: node weather3d_wasm.test.mjs <wasm>');
const bytes=fs.readFileSync(path);
const mod=await WebAssembly.compile(bytes);
const imports=WebAssembly.Module.imports(mod);
if(imports.length)throw new Error(`expected zero imports, got ${JSON.stringify(imports)}`);
const {exports:e}=await WebAssembly.instantiate(mod,{});
if(e.genesis_weather3d_model_version()!==0x00020001)throw new Error('model version');
if(e.genesis_weather3d_width()!==96||e.genesis_weather3d_height()!==48||e.genesis_weather3d_depth()!==96)throw new Error('3D dimensions');
if(e.memory.buffer.byteLength!==33554432)throw new Error(`unexpected memory ${e.memory.buffer.byteLength}`);
for(const name of ['cloud','rain','pressure','vx','vy','vz','tornado','terrain','surface_water','discharge']){
 const fn=e[`genesis_weather3d_${name}_ptr`];if(typeof fn!=='function'||fn()===0)throw new Error(`missing bulk pointer ${name}`);
}
e.genesis_weather3d_reset(0x7721);e.genesis_weather3d_seed_supercell(52,48);
const clouds=e.genesis_weather3d_cloud_cells(),tornado=e.genesis_weather3d_tornado_cells();
if(clouds<=3000||tornado<=0)throw new Error(`storm gate cloud=${clouds} tornado=${tornado}`);
let vertical=0;for(let y=8;y<40;y++)if(e.genesis_weather3d_cloud_at(52,y,48)>700)vertical++;
if(vertical<=8)throw new Error(`vertical cloud structure ${vertical}`);
e.genesis_weather3d_quench_rotation();if(e.genesis_weather3d_tornado_cells()!==0)throw new Error('tornado survived rotation/pressure quench');
e.genesis_weather3d_reset(0x9137);e.genesis_weather3d_seed_river_basin();e.genesis_weather3d_step(120);
if(e.genesis_weather3d_max_discharge()<=2400||e.genesis_weather3d_river_cells()<=0)throw new Error('river emergence gate');
e.genesis_weather3d_reset(0x55aa);e.genesis_weather3d_seed_supercell(52,48);e.genesis_weather3d_step(24);const h1=e.genesis_weather3d_hash();
e.genesis_weather3d_reset(0x55aa);e.genesis_weather3d_seed_supercell(52,48);e.genesis_weather3d_step(24);const h2=e.genesis_weather3d_hash();if(h1!==h2)throw new Error('nondeterministic replay');
console.log(JSON.stringify({bytes:bytes.length,imports:imports.length,resolution:'96x48x96',cells:96*48*96,clouds,tornado,verticalCloudCells:vertical,rivers:e.genesis_weather3d_river_cells(),maxDischarge:e.genesis_weather3d_max_discharge(),hash:h2}));
console.log('PASS GENESIS true 3D weather C++ -> freestanding WASM semantic parity');
