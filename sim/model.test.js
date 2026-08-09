const assert=require('node:assert/strict');
const {MatterWorld,MODEL,minImage,wrap}=require('./model.js');
assert.equal(MODEL.id,'genesis-matter-lj2d-v4');
assert.equal(MODEL.boundary,'periodic minimum-image');
assert.ok(Math.abs(minImage(.96,1)+.04)<1e-12);assert.ok(Math.abs(wrap(-.02,1)-.98)<1e-12);

const base=new MatterWorld({count:72,seed:123456,temperature:.32,associationEnabled:false,reactionEnabled:false});
const twin=new MatterWorld({count:72,seed:123456,temperature:.32,associationEnabled:false,reactionEnabled:false});
assert.equal(base.hash(),twin.hash(),'same seed must reproduce initial state');
const e0=base.totalEnergy();for(let i=0;i<3000;i++)base.step(.00018,{thermostatStrength:0});
const e1=base.totalEnergy(),drift=Math.abs(e1-e0)/Math.max(1,Math.abs(e0));
assert.equal(base.invariantReport().status,'PASS');assert.ok(drift<.08,`energy drift too high ${drift}`);
const rdf=base.radialDistribution(32);assert.equal(rdf.values.length,32);assert.ok(rdf.peak.g>0);

const r1=new MatterWorld({count:84,seed:20260809,temperature:.08,associationRate:250,dissociationRate:.05,reactionEnabled:true,reactionRate:250,activationAge:0});
const r2=new MatterWorld({count:84,seed:20260809,temperature:.08,associationRate:250,dissociationRate:.05,reactionEnabled:true,reactionRate:250,activationAge:0});
for(let i=0;i<5000;i++){r1.step(.00018,{targetTemperature:.08,thermostatStrength:.02});r2.step(.00018,{targetTemperature:.08,thermostatStrength:.02})}
assert.equal(r1.hash(),r2.hash(),'reaction path must be deterministic for same seed/runtime path');
let rx=r1.reactionSnapshot(),as=r1.associationSnapshot(),inv=r1.invariantReport();
assert.equal(inv.status,'PASS');assert.equal(inv.particleCountConserved,true);
assert.ok(as.formed>0,'associations must form');assert.ok(rx.forward>0,'forward reaction events must occur');assert.ok(rx.stateCounts.activated>0,'reaction must transform particle internal state');
assert.equal(rx.stateCounts.total,r1.count,'particle count conserved through transformations');
assert.ok(rx.history.some(e=>e.type==='FORWARD'),'forward events recorded in history');

const forwardBefore=rx.forward;r1.setAssociationKinetics({onRate:0,offRate:100});
for(let i=0;i<8000&&r1.associationSnapshot().count;i++)r1.step(.00018,{targetTemperature:.55,thermostatStrength:.03});
rx=r1.reactionSnapshot();as=r1.associationSnapshot();inv=r1.invariantReport();
assert.equal(inv.status,'PASS');assert.ok(rx.reverse>0,'dissociation must create reverse events for reacted pairs');
assert.equal(rx.stateCounts.total,r1.count);assert.ok(rx.forward>=forwardBefore);assert.ok(rx.history.some(e=>e.type==='REVERSE'));
if(as.count===0)assert.equal(rx.stateCounts.activated,0,'all transformed states clear when all associations dissociate');

const c=new MatterWorld({count:48,seed:999,temperature:.2,associationEnabled:false,reactionEnabled:false});const h=c.hash(),touched=c.impulse(.99,.31,1.1,.12);for(let i=0;i<50;i++)c.step(.0002,{thermostatStrength:0});assert.ok(touched>0);assert.notEqual(c.hash(),h);
console.log(JSON.stringify({model:MODEL.id,drift,rdfPeak:rdf.peak,formed:as.formed,forward:rx.forward,reverse:rx.reverse,activated:rx.stateCounts.activated,history:rx.history.slice(-4)}));
console.log('PASS genesis matter 0.4 reaction-event tests');
