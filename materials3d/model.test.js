const assert=require('node:assert/strict');
const fs=require('node:fs');
const {TerrainWorld,MODEL}=require('./model.js');
assert.equal(MODEL.id,'genesis-materials-heightfield3d-v1');
const near=(a,b,t=1e-3)=>Math.abs(a-b)<=t;

// Runtime black-screen regression contract: WebGPU and Canvas2D must never fight over one canvas.
const appSource=fs.readFileSync('./materials3d/app.js','utf8');
assert.match(appSource,/document\.createElement\('canvas'\)/,'runtime must create a dedicated fallback canvas');
assert.match(appSource,/fallbackView/,'runtime must name/use the dedicated fallback canvas');
assert.match(appSource,/GenesisCanvas3DMaterialsRenderer\(fallbackCanvas/,'Canvas fallback must render on the fallback canvas, not the WebGPU canvas');
assert.match(appSource,/pushErrorScope\('validation'\)/,'WebGPU acceptance must use a validation error scope');
assert.match(appSource,/onSubmittedWorkDone\(\)/,'WebGPU validation probe must wait for submitted GPU work');
assert.match(appSource,/uncapturederror/,'runtime must listen for uncaptured GPU validation/runtime errors');

// Fixed seed + same steps must replay identically.
const a=new TerrainWorld({width:56,height:56,seed:123456,cohesion:1});
const b=new TerrainWorld({width:56,height:56,seed:123456,cohesion:1});
a.seedScene();b.seedScene();for(let i=0;i<80;i++){a.step();b.step();}
assert.equal(a.hash(),b.hash(),'same seed and step sequence must reproduce the same state hash');
assert.equal(a.invariantReport().status,'PASS');

// Internal stepping must conserve sand and water mass to floating-point tolerance.
const mass=new TerrainWorld({width:48,height:48,seed:77,cohesion:1});mass.clear();
for(let z=0;z<mass.height;z++)for(let x=0;x<mass.width;x++)mass.rock[mass.index(x,z)]=.25;
mass.paint('sand',24,24,8,1.4);mass.paint('water',18,18,5,.9);
const m0=mass.totals();for(let i=0;i<120;i++)mass.step();const m1=mass.totals();
assert.ok(near(m0.sand,m1.sand,.02),`sand mass drift ${m0.sand} -> ${m1.sand}`);
assert.ok(near(m0.water,m1.water,.02),`water mass drift ${m0.water} -> ${m1.water}`);
assert.equal(mass.invariantReport().status,'PASS');

// A concentrated dry pile should relax downward/spread under the repose rule.
const dry=new TerrainWorld({width:52,height:52,seed:9,cohesion:1});dry.clear();
for(let i=0;i<dry.size;i++)dry.rock[i]=.2;dry.paint('sand',26,26,4,2.4);const dryBefore=dry.maxSandHeight();for(let i=0;i<160;i++)dry.step();const dryAfter=dry.maxSandHeight();
assert.ok(dryAfter<dryBefore*.83,`dry pile did not relax enough: ${dryBefore} -> ${dryAfter}`);

// Water should spread across more cells on a flat surface.
const flow=new TerrainWorld({width:48,height:48,seed:11});flow.clear();for(let i=0;i<flow.size;i++)flow.rock[i]=.2;
flow.paint('water',24,24,2,1.5);const waterCells0=flow.occupiedWaterCells();for(let i=0;i<110;i++)flow.step();const waterCells1=flow.occupiedWaterCells();
assert.ok(waterCells1>waterCells0*2,`water did not spread enough: ${waterCells0} -> ${waterCells1}`);

// Wet cohesion must retain a taller pile than an otherwise identical dry one.
const dryC=new TerrainWorld({width:50,height:50,seed:42,cohesion:1.5});const wetC=new TerrainWorld({width:50,height:50,seed:42,cohesion:1.5});
for(const w of [dryC,wetC]){w.clear();for(let i=0;i<w.size;i++)w.rock[i]=.2;}
dryC.paint('sand',25,25,4,2.5);wetC.paint('wet-sand',25,25,4,2.5);
for(let i=0;i<90;i++){dryC.step();wetC.step();}
const dh=dryC.maxSandHeight(),wh=wetC.maxSandHeight();
assert.ok(wh>dh+.18,`wet pile should retain more height: dry=${dh} wet=${wh}`);
assert.ok(wetC.totals().wetCells>0,'wet pile must preserve explicit wetness state');

console.log(JSON.stringify({model:MODEL.id,replayHash:a.hash(),mass:{sand0:m0.sand,sand1:m1.sand,water0:m0.water,water1:m1.water},dryRelax:{before:dryBefore,after:dryAfter},waterSpread:{before:waterCells0,after:waterCells1},cohesion:{dryHeight:dh,wetHeight:wh,wetCells:wetC.totals().wetCells},blackScreenFailoverContract:'PASS'}));
console.log('PASS genesis materials 0.2 3D heightfield + black-screen failover tests');
