const assert=require('node:assert/strict');
const {MaterialWorld,EMPTY,SAND,WATER,ROCK,MODEL}=require('./model.js');
assert.equal(MODEL.id,'genesis-materials-granular2d-v1');

function floor(w){for(let y=0;y<2;y++)for(let x=0;x<w.width;x++)w.set(x,y,ROCK);}
function fillRect(w,x0,y0,x1,y1,mat,wet=0){for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)w.set(x,y,mat,wet);}

// Deterministic replay for a fixed seed and identical scene.
const a=new MaterialWorld({width:64,height:40,seed:12345});
const b=new MaterialWorld({width:64,height:40,seed:12345});
a.seedScene();b.seedScene();for(let i=0;i<220;i++){a.step();b.step();}
assert.equal(a.hash(),b.hash(),'same seed + edits must reproduce the same CPU state');
assert.equal(a.invariantReport().status,'PASS');

// Gravity must move a suspended sand packet downward and conserve material counts.
const fall=new MaterialWorld({width:40,height:30,seed:77});floor(fall);fillRect(fall,17,22,22,25,SAND);
const beforeFall=fall.centerOfMass(SAND),counts0=fall.counts();for(let i=0;i<120;i++)fall.step();
const afterFall=fall.centerOfMass(SAND),counts1=fall.counts();
assert.ok(afterFall.y<beforeFall.y-8,`sand center of mass did not fall enough: ${beforeFall.y} -> ${afterFall.y}`);
assert.equal(counts1.sand,counts0.sand);assert.equal(counts1.rock,counts0.rock);assert.equal(fall.invariantReport().status,'PASS');

// Water must flow under gravity/lateral pressure while its material count is conserved.
const water=new MaterialWorld({width:44,height:28,seed:991});floor(water);fillRect(water,18,18,25,23,WATER);
const wb=water.centerOfMass(WATER),wc0=water.counts();for(let i=0;i<100;i++)water.step();const wa=water.centerOfMass(WATER),wc1=water.counts();
assert.ok(wa.y<wb.y-5,'water packet should descend');assert.equal(wc1.water,wc0.water);assert.equal(water.invariantReport().status,'PASS');

// Adjacent water must transfer moisture into sand state.
const wetting=new MaterialWorld({width:24,height:18,seed:9});floor(wetting);
fillRect(wetting,7,2,11,7,SAND);fillRect(wetting,12,2,13,7,WATER);
// side/bottom rock keeps the fixture together long enough to observe transfer
for(let y=2;y<=8;y++){wetting.set(6,y,ROCK);wetting.set(14,y,ROCK);}for(let x=6;x<=14;x++)wetting.set(x,8,ROCK);
for(let i=0;i<12;i++)wetting.step();
assert.ok(wetting.counts().wetSand>0,'water contact must create wet sand state');assert.equal(wetting.invariantReport().status,'PASS');

// Same sand tower, same seed: wet cohesive sand must retain a taller structure than dry sand.
const dry=new MaterialWorld({width:36,height:28,seed:4242,cohesion:1});const wet=new MaterialWorld({width:36,height:28,seed:4242,cohesion:1});floor(dry);floor(wet);
fillRect(dry,15,2,20,14,SAND,0);fillRect(wet,15,2,20,14,SAND,255);
for(let i=0;i<180;i++){dry.step();wet.step();}
const dryH=dry.maxHeight(SAND),wetH=wet.maxHeight(SAND);
assert.ok(wetH>=dryH+2,`wet cohesion should support a steeper/taller structure: dry=${dryH} wet=${wetH}`);
assert.equal(dry.counts().sand,wet.counts().sand);assert.equal(dry.invariantReport().status,'PASS');assert.equal(wet.invariantReport().status,'PASS');

console.log(JSON.stringify({model:MODEL.id,replayHash:a.hash(),fall:{beforeY:beforeFall.y,afterY:afterFall.y},water:{beforeY:wb.y,afterY:wa.y},wetSand:wetting.counts().wetSand,cohesion:{dryHeight:dryH,wetHeight:wetH},counts:wet.counts()}));
console.log('PASS genesis materials 0.1 granular sand/water tests');
