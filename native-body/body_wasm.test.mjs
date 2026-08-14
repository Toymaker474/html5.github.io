import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const ONE=65536;
const path=process.argv[2];assert.ok(path,'expected compiled wasm path');const bytes=fs.readFileSync(path);const mod=await WebAssembly.compile(bytes);const imports=WebAssembly.Module.imports(mod);assert.equal(imports.length,0,'native body WASM must be freestanding with zero imports');const {exports:e}=await WebAssembly.instantiate(mod,{});assert.equal(e.genesis_body_model_version()>>>0,0x00010001);
// Gravity is real native state.
e.genesis_body_clear();e.genesis_body_set_gravity(0,-642908,0);assert.equal(e.genesis_body_add_node(10*ONE,10*ONE,10*ONE,ONE,ONE>>2),0);const y0=e.genesis_body_node_y(0)|0;e.genesis_body_step(1);assert.ok((e.genesis_body_node_vy(0)|0)<0);assert.ok((e.genesis_body_node_y(0)|0)<y0);
// Equal-mass internal correction must preserve center of mass.
e.genesis_body_clear();e.genesis_body_set_gravity(0,0,0);const a=e.genesis_body_add_node(10*ONE,10*ONE,10*ONE,ONE,ONE>>3),b=e.genesis_body_add_node(12*ONE,10*ONE,10*ONE,ONE,ONE>>3);const com0=e.genesis_body_com_x()|0;assert.equal(e.genesis_body_add_link(a,b,ONE,0,0,0,0),0);e.genesis_body_step(4);assert.ok(Math.abs((e.genesis_body_com_x()|0)-com0)<=8);
// Contact and Coulomb friction remain bounded after compilation.
e.genesis_body_clear();e.genesis_body_fill_floor(2);e.genesis_body_set_gravity(0,0,0);e.genesis_body_set_friction(ONE>>1);const r=ONE>>2,n=e.genesis_body_add_node(10*ONE,2*ONE+r-(ONE>>4),10*ONE,ONE,r);assert.equal(e.genesis_body_apply_impulse(n,4*ONE,-ONE,0),1);const vx0=e.genesis_body_node_vx(n)|0;e.genesis_body_step(1);const jn=e.genesis_body_normal_impulse()>>>0,jt=e.genesis_body_friction_impulse()>>>0;assert.ok((e.genesis_body_contacts()>>>0)>0);assert.ok(jn>0);assert.ok(jt<=Math.floor(jn*0.5)+2);assert.ok((e.genesis_body_node_vx(n)|0)>=0&&(e.genesis_body_node_vx(n)|0)<vx0);
// Whole-body replay must exactly match the native CI reference fixture.
function organism(){assert.equal(e.genesis_body_seed_organism(16*ONE,6*ONE,16*ONE),18);assert.equal(e.genesis_body_link_count(),22);assert.equal(e.genesis_body_range_count(),4);assert.equal(e.genesis_body_apply_impulse(3,ONE,0,ONE>>1),1);for(let i=0;i<180;i++)e.genesis_body_step(1);return{hash:e.genesis_body_hash()>>>0,comY:e.genesis_body_com_y()|0,kinetic:e.genesis_body_kinetic()>>>0};}
const first=organism();assert.deepEqual(first,{hash:3632292203,comY:147608,kinetic:346792});const second=organism();assert.deepEqual(second,first);
console.log(JSON.stringify({model:'genesis-native-body-fixedpoint-v1',wasmBytes:bytes.byteLength,wasmSha256:crypto.createHash('sha256').update(bytes).digest('hex'),imports:imports.length,...first}));console.log('PASS GENESIS native body C++ -> WASM semantic parity: zero imports, gravity, COM, contact/friction and exact articulated replay hash');
