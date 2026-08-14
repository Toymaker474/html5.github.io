import fs from 'node:fs';
import assert from 'node:assert/strict';

const wasmPath=process.argv[2];
assert.ok(wasmPath,'usage: node fluid_v4_semantic_test.mjs <solver.wasm>');
const bytes=fs.readFileSync(wasmPath);
const {instance}=await WebAssembly.instantiate(bytes,{});
const e=instance.exports;

for(const name of [
  'genesis_init','genesis_seed_scene','genesis_step','genesis_pack','genesis_hash','genesis_invariant',
  'genesis_impulse_water','genesis_total_water_mass','genesis_fluid_divergence_before',
  'genesis_fluid_divergence_after','genesis_fluid_kinetic_energy','genesis_fluid_momentum_x',
  'genesis_fluid_momentum_y','genesis_fluid_momentum_z'
]) assert.equal(typeof e[name],'function',`missing ${name}`);

assert.equal(e.genesis_model_version()>>>0,0x00040001);
e.genesis_init(40,28,40,0x3d5a17,72);
e.genesis_seed_scene();
assert.equal(e.genesis_invariant(),1);

const mass0=e.genesis_total_water_mass();
const hash0=e.genesis_hash()>>>0;
assert.ok(mass0>10,'seed must contain a real water body');

// A native impulse must create actual momentum/energy in the C++ velocity field.
e.genesis_impulse_water(20,12,21,6,2.4,0.0,-0.7);
const keImpulse=e.genesis_fluid_kinetic_energy();
const mxImpulse=e.genesis_fluid_momentum_x();
assert.ok(keImpulse>0.01,'impulse must create kinetic energy');
assert.ok(mxImpulse>0.01,'positive X impulse must create positive X momentum');

let strongestBefore=0,strongestAfter=0;
for(let i=0;i<10;i++){
  e.genesis_step(1);
  strongestBefore=Math.max(strongestBefore,e.genesis_fluid_divergence_before());
  strongestAfter=Math.max(strongestAfter,e.genesis_fluid_divergence_after());
  assert.equal(e.genesis_invariant(),1,`invariant failed at step ${i}`);
}
const divBefore=e.genesis_fluid_divergence_before();
const divAfter=e.genesis_fluid_divergence_after();
assert.ok(Number.isFinite(divBefore)&&Number.isFinite(divAfter));
assert.ok(strongestBefore>1e-5,'test must exercise a divergent velocity field');
assert.ok(divAfter<=divBefore+0.0025,`projection failed to reduce divergence: ${divBefore} -> ${divAfter}`);
assert.ok(strongestAfter<=strongestBefore+0.003,'projection must not amplify peak measured mean divergence');

const mass1=e.genesis_total_water_mass();
const relMass=Math.abs(mass1-mass0)/mass0;
assert.ok(relMass<2e-4,`conservative water transport drifted mass by ${relMass}`);
assert.ok((e.genesis_water_moves()>>>0)>0,'velocity field must transport water across cell faces');
assert.notEqual(e.genesis_hash()>>>0,hash0,'native state hash must evolve');
assert.ok(e.genesis_fluid_kinetic_energy()>0,'flow must retain measurable kinetic energy');
assert.ok(e.genesis_fluid_momentum_y()<0,'gravity must produce downward fluid momentum');

console.log(JSON.stringify({
  model:'genesis-volume3d-fluid-v4',
  wasmBytes:bytes.length,
  mass0,mass1,relativeMassDrift:relMass,
  divergenceBefore:divBefore,divergenceAfter:divAfter,
  strongestBefore,strongestAfter,
  kineticEnergy:e.genesis_fluid_kinetic_energy(),
  momentum:[e.genesis_fluid_momentum_x(),e.genesis_fluid_momentum_y(),e.genesis_fluid_momentum_z()],
  waterMoves:e.genesis_water_moves()>>>0,
  invariant:e.genesis_invariant()>>>0
},null,2));
console.log('PASS native v4: 3D velocity, gravity, conservative water transport and pressure projection are causally exercised');
