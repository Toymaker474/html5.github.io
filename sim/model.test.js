const assert=require('node:assert/strict');
const matter=require('./model.js');
const topology=require('./topology.js');
const assembly=require('./assembly.js');
const {MatterWorld,MODEL,minImage,wrap}=matter;
assert.equal(MODEL.id,'genesis-matter-lj2d-v6');
assert.equal(MODEL.boundary,'periodic minimum-image');
assert.deepEqual(topology.VALENCE,[2,2,3]);
assert.ok(Math.abs(minImage(.96,1)+.04)<1e-12);assert.ok(Math.abs(wrap(-.02,1)-.98)<1e-12);

// Regression: no-association numerical path remains finite and low-drift.
const base=new MatterWorld({count:72,seed:123456,temperature:.32,associationEnabled:false,reactionEnabled:false});base.setAssembly({enabled:false,strength:0});
const twin=new MatterWorld({count:72,seed:123456,temperature:.32,associationEnabled:false,reactionEnabled:false});twin.setAssembly({enabled:false,strength:0});
assert.equal(base.hash(),twin.hash(),'same seed must reproduce initial state');
const e0=base.totalEnergy();for(let i=0;i<3000;i++)base.step(.00018,{thermostatStrength:0});
const e1=base.totalEnergy(),drift=Math.abs(e1-e0)/Math.max(1,Math.abs(e0));
assert.equal(base.invariantReport().status,'PASS');assert.ok(drift<.08,`energy drift too high ${drift}`);

// 0.5 regression: bounded topology still forms structures larger than pairs.
const g1=new MatterWorld({count:96,seed:50505,temperature:.06,associationRate:250,dissociationRate:.02,reactionEnabled:false});g1.setAssembly({enabled:false,strength:0});
const g2=new MatterWorld({count:96,seed:50505,temperature:.06,associationRate:250,dissociationRate:.02,reactionEnabled:false});g2.setAssembly({enabled:false,strength:0});
for(let i=0;i<6500;i++){g1.step(.00018,{targetTemperature:.06,thermostatStrength:.025});g2.step(.00018,{targetTemperature:.06,thermostatStrength:.025});}
assert.equal(g1.hash(),g2.hash(),'topology path must remain deterministic');
let topo=g1.topologySnapshot(),inv=g1.invariantReport();assert.equal(inv.status,'PASS');assert.ok(topo.largestComponent>=3);for(let i=0;i<g1.count;i++)assert.ok(topo.degrees[i]<=topology.VALENCE[g1.particles[i].species]);

// 0.6 assembly fixture: same substrate, explicit assembly layer enabled.
const a1=new MatterWorld({count:96,seed:60606,temperature:.055,associationRate:145,dissociationRate:.015,reactionEnabled:false});a1.setAssembly({enabled:true,strength:12});
const a2=new MatterWorld({count:96,seed:60606,temperature:.055,associationRate:145,dissociationRate:.015,reactionEnabled:false});a2.setAssembly({enabled:true,strength:12});
for(let i=0;i<7000;i++){a1.step(.00018,{targetTemperature:.055,thermostatStrength:.025});a2.step(.00018,{targetTemperature:.055,thermostatStrength:.025});}
assert.equal(a1.hash(),a2.hash(),'assembly path must be deterministic for same seed/runtime path');
const asm=a1.assemblySnapshot();topo=a1.topologySnapshot();inv=a1.invariantReport();
assert.equal(inv.status,'PASS');assert.equal(inv.assemblyTagsValid,true);assert.ok(asm.assemblyEdges>0,'assembly layer must create tagged edges');assert.ok(asm.closureEdges>0,'assembly layer must close at least one local loop');assert.ok(topo.largestComponent>=3,'assembly must produce a multi-particle structure');assert.ok(topo.cycleRank>0,'assembly fixture must contain at least one independent cycle');assert.equal(inv.particleCountConserved,true);

// Reaction regression on graph edges remains intact.
const r1=new MatterWorld({count:84,seed:20260809,temperature:.08,associationRate:250,dissociationRate:.05,reactionEnabled:true,reactionRate:250,activationAge:0});r1.setAssembly({enabled:false,strength:0});
for(let i=0;i<4500;i++)r1.step(.00018,{targetTemperature:.08,thermostatStrength:.02});
let rx=r1.reactionSnapshot(),as=r1.associationSnapshot();inv=r1.invariantReport();assert.equal(inv.status,'PASS');assert.ok(as.formed>0);assert.ok(rx.forward>0);assert.equal(rx.stateCounts.total,r1.count);
const forwardBefore=rx.forward;r1.setAssociationKinetics({onRate:0,offRate:100});for(let i=0;i<9000&&r1.associationSnapshot().count;i++)r1.step(.00018,{targetTemperature:.55,thermostatStrength:.03});rx=r1.reactionSnapshot();as=r1.associationSnapshot();inv=r1.invariantReport();assert.equal(inv.status,'PASS');assert.ok(rx.reverse>0);assert.ok(rx.forward>=forwardBefore);assert.equal(rx.stateCounts.total,r1.count);

console.log(JSON.stringify({model:MODEL.id,drift,baselineTopology:{largest:g1.topologySnapshot().largestComponent,cycles:g1.topologySnapshot().cycleRank},assembly:{edges:asm.assemblyEdges,closure:asm.closureEdges,cooperative:asm.cooperativeEdges,largest:topo.largestComponent,cycles:topo.cycleRank,cycleDensity:asm.cycleDensity},reaction:{forward:rx.forward,reverse:rx.reverse,active:as.count}}));
console.log('PASS genesis matter 0.6 cooperative self-assembly tests');
