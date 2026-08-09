const assert=require('node:assert/strict');
const matter=require('./model.js');
const topology=require('./topology.js');
const {MatterWorld,MODEL,minImage,wrap}=matter;
assert.equal(MODEL.id,'genesis-matter-lj2d-v5');
assert.equal(MODEL.boundary,'periodic minimum-image');
assert.deepEqual(topology.VALENCE,[2,2,3]);
assert.ok(Math.abs(minImage(.96,1)+.04)<1e-12);assert.ok(Math.abs(wrap(-.02,1)-.98)<1e-12);

// Regression: the no-association 0.4 numerical path still remains finite and low-drift.
const base=new MatterWorld({count:72,seed:123456,temperature:.32,associationEnabled:false,reactionEnabled:false});
const twin=new MatterWorld({count:72,seed:123456,temperature:.32,associationEnabled:false,reactionEnabled:false});
assert.equal(base.hash(),twin.hash(),'same seed must reproduce initial state');
const e0=base.totalEnergy();for(let i=0;i<3000;i++)base.step(.00018,{thermostatStrength:0});
const e1=base.totalEnergy(),drift=Math.abs(e1-e0)/Math.max(1,Math.abs(e0));
assert.equal(base.invariantReport().status,'PASS');assert.ok(drift<.08,`energy drift too high ${drift}`);
const rdf=base.radialDistribution(32);assert.equal(rdf.values.length,32);assert.ok(rdf.peak.g>0);

// 0.5 topology fixture: one particle may participate in multiple associations, bounded by toy valence.
const g1=new MatterWorld({count:96,seed:50505,temperature:.06,associationRate:250,dissociationRate:.02,reactionEnabled:false});
const g2=new MatterWorld({count:96,seed:50505,temperature:.06,associationRate:250,dissociationRate:.02,reactionEnabled:false});
for(let i=0;i<6500;i++){g1.step(.00018,{targetTemperature:.06,thermostatStrength:.025});g2.step(.00018,{targetTemperature:.06,thermostatStrength:.025});}
assert.equal(g1.hash(),g2.hash(),'topology path must be deterministic for same seed/runtime path');
let topo=g1.topologySnapshot(),inv=g1.invariantReport();
assert.equal(inv.status,'PASS');assert.equal(inv.topologyConsistent,true);assert.equal(inv.particleCountConserved,true);
assert.ok(topo.edges>0,'topology fixture must form edges');
assert.ok(topo.largestComponent>=3,'0.5 must permit a connected structure larger than a pair');
for(let i=0;i<g1.count;i++)assert.ok(topo.degrees[i]<=topology.VALENCE[g1.particles[i].species],`particle ${i} exceeded toy valence`);
assert.equal(topo.edges,g1.associationSnapshot().count,'graph edge count must equal active associations');
assert.ok(topo.cycleRank>=0,'cycle rank must be non-negative');

// Regression + topology interaction: reaction bookkeeping must still work on graph edges.
const r1=new MatterWorld({count:84,seed:20260809,temperature:.08,associationRate:250,dissociationRate:.05,reactionEnabled:true,reactionRate:250,activationAge:0});
const r2=new MatterWorld({count:84,seed:20260809,temperature:.08,associationRate:250,dissociationRate:.05,reactionEnabled:true,reactionRate:250,activationAge:0});
for(let i=0;i<4500;i++){r1.step(.00018,{targetTemperature:.08,thermostatStrength:.02});r2.step(.00018,{targetTemperature:.08,thermostatStrength:.02});}
assert.equal(r1.hash(),r2.hash(),'reaction + topology path must remain deterministic');
let rx=r1.reactionSnapshot(),as=r1.associationSnapshot();inv=r1.invariantReport();
assert.equal(inv.status,'PASS');assert.ok(as.formed>0);assert.ok(rx.forward>0);assert.ok(rx.stateCounts.activated>0);assert.equal(rx.stateCounts.total,r1.count);assert.ok(rx.history.some(e=>e.type==='FORWARD'));
const forwardBefore=rx.forward;r1.setAssociationKinetics({onRate:0,offRate:100});
for(let i=0;i<9000&&r1.associationSnapshot().count;i++)r1.step(.00018,{targetTemperature:.55,thermostatStrength:.03});
rx=r1.reactionSnapshot();as=r1.associationSnapshot();inv=r1.invariantReport();
assert.equal(inv.status,'PASS');assert.ok(rx.reverse>0);assert.ok(rx.forward>=forwardBefore);assert.equal(rx.stateCounts.total,r1.count);if(as.count===0)assert.equal(rx.stateCounts.activated,0);

const c=new MatterWorld({count:48,seed:999,temperature:.2,associationEnabled:false,reactionEnabled:false});const h=c.hash(),touched=c.impulse(.99,.31,1.1,.12);for(let i=0;i<50;i++)c.step(.0002,{thermostatStrength:0});assert.ok(touched>0);assert.notEqual(c.hash(),h);
console.log(JSON.stringify({model:MODEL.id,drift,topology:{edges:topo.edges,components:topo.components,largest:topo.largestComponent,cycles:topo.cycleRank,maxDegree:topo.maxDegree},reaction:{forward:rx.forward,reverse:rx.reverse,active:as.count}}));
console.log('PASS genesis matter 0.5 multi-particle topology tests');
