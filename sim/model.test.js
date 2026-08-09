const assert=require('node:assert/strict');
const {MatterWorld,MODEL,minImage,wrap,compatibleSpecies}=require('./model.js');
assert.equal(MODEL.id,'genesis-matter-lj2d-v3');
assert.equal(MODEL.boundary,'periodic minimum-image');
assert.ok(Math.abs(minImage(.96,1)+.04)<1e-12);
assert.ok(Math.abs(minImage(-.96,1)-.04)<1e-12);
assert.ok(Math.abs(wrap(-.02,1)-.98)<1e-12);
assert.equal(compatibleSpecies(0,0),false);
assert.equal(compatibleSpecies(0,1),true);

const a=new MatterWorld({count:72,seed:123456,temperature:.32,associationEnabled:false});
const b=new MatterWorld({count:72,seed:123456,temperature:.32,associationEnabled:false});
assert.equal(a.hash(),b.hash(),'same seed must create same initial state');
const e0=a.totalEnergy();
for(let i=0;i<3000;i++)a.step(.00018,{thermostatStrength:0});
const inv=a.invariantReport();
assert.equal(inv.status,'PASS','state invariants');
const e1=a.totalEnergy(),drift=Math.abs(e1-e0)/Math.max(1,Math.abs(e0));
assert.ok(drift<.08,`energy drift too high: ${drift}`);
const rdf=a.radialDistribution(32);
assert.equal(rdf.values.length,32);
assert.ok(rdf.values.every(v=>Number.isFinite(v.g)&&v.g>=0));
assert.ok(rdf.peak.g>0&&rdf.peak.r>0);

const d1=new MatterWorld({count:84,seed:777,temperature:.10,associationRate:180,dissociationRate:.2});
const d2=new MatterWorld({count:84,seed:777,temperature:.10,associationRate:180,dissociationRate:.2});
for(let i=0;i<3500;i++){d1.step(.00018,{targetTemperature:.10,thermostatStrength:.018});d2.step(.00018,{targetTemperature:.10,thermostatStrength:.018})}
assert.equal(d1.hash(),d2.hash(),'seeded association dynamics must reproduce on the same JS numerical path');
let assoc=d1.associationSnapshot();
assert.ok(assoc.formed>0,'at least one association must form in fixture');
assert.ok(assoc.count>0,'fixture must retain active associations');
assert.equal(d1.invariantReport().associationsValid,true,'association graph invariants');
for(const bond of d1.associationList())assert.notEqual(d1.particles[bond.i].species,d1.particles[bond.j].species,'only unlike generic species associate');

const beforeBreak=assoc.count;
d1.setAssociationKinetics({onRate:0,offRate:100});
for(let i=0;i<5000&&d1.associationSnapshot().count;i++)d1.step(.00018,{targetTemperature:.5,thermostatStrength:.03});
assoc=d1.associationSnapshot();
assert.ok(assoc.broken>0,'associations must be able to dissociate');
assert.ok(assoc.count<beforeBreak,'high off-rate must reduce active associations');
assert.ok(assoc.meanBrokenLifetime>=0,'lifetime telemetry must be finite/non-negative');

const c=new MatterWorld({count:48,seed:999,temperature:.2,associationEnabled:false});
const before=c.hash(),touched=c.impulse(.99,.31,1.1,.12);
for(let i=0;i<50;i++)c.step(.0002,{thermostatStrength:0});
assert.ok(touched>0);
assert.notEqual(c.hash(),before);
const q=new MatterWorld({count:48,seed:42,temperature:.8,associationEnabled:false});
q.setTemperature(.12);
assert.ok(Math.abs(q.temperature()-.12)<1e-10);
console.log(JSON.stringify({model:MODEL.id,e0,e1,drift,rdfPeak:rdf.peak,formed:d2.associationSnapshot().formed,active:d2.associationSnapshot().count,brokenAfterStress:assoc.broken,meanBrokenLifetime:assoc.meanBrokenLifetime}));
console.log('PASS genesis matter 0.3 reversible association tests');
