import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src=fs.readFileSync(new URL('../surface_liquid.js', import.meta.url),'utf8');
const CW=32,CH=18,CELL=4,N=CW*CH;
const MAT={AIR:0,ROCK:1,DIRT:2,SAND:3,WATER:4,LAVA:5,MUD:6,OBSIDIAN:7,ASH:8};
const M=new Uint8Array(N);
for(let x=0;x<CW;x++)for(let y=10;y<CH;y++)M[y*CW+x]=y===10?MAT.DIRT:MAT.ROCK;
const fineW=64,fineH=36,noop=()=>{};
const ctx={console,Math,Float32Array,Int16Array,Uint8Array,performance:{now:()=>0},window:null,globalThis:null,V104_COLS:CW,V104_ROWS:CH,V104_CELL:CELL,V104_M:M,V104_MAT:MAT,v104SolidMat:m=>m!==MAT.AIR&&m!==MAT.WATER&&m!==MAT.LAVA,v104VisibleMicroBounds:()=>({l:1,r:CW-2,t:0,b:CH-1}),step:noop,reset:noop,drawTerrain:noop,X:{save:noop,restore:noop,beginPath:noop,moveTo:noop,lineTo:noop,quadraticCurveTo:noop,closePath:noop,fill:noop,stroke:noop,arc:noop,createLinearGradient:()=>({addColorStop:noop}),set fillStyle(v){},set strokeStyle(v){},set lineWidth(v){},set globalCompositeOperation(v){}},worldToScreen:(x,y)=>({x,y}),camera:{zoom:1},weather:{rain:0},creatures:[]};
ctx.window=ctx;ctx.globalThis=ctx;
ctx.GENESIS_FLUID_REFINEMENT={scale:2,cell:2,width:fineW,height:fineH,fields:{water:new Float32Array(fineW*fineH),velocityX:new Float32Array(fineW*fineH),velocityY:new Float32Array(fineW*fineH)}};
ctx.GENESIS_V110={fields:{volume:new Float32Array(N),vapor:new Float32Array(N)}};
ctx.GENESIS_HYDRO25={fields:{soilMass:new Float32Array(N*3).fill(1),rootStrength:new Float32Array(N),suspendedSediment:new Float32Array(N*3)},debugLaneIndex:(lane,i)=>lane*N+i};
vm.runInNewContext(src,ctx,{filename:'surface_liquid.js'});
const S=ctx.GENESIS_SURFACE_LIQUID;assert.ok(S);

S.debugClear();for(let x=8;x<=15;x++)S.debugSetDepth(x,8);const m0=S.test.mass();for(let i=0;i<120;i++)S.stepOnce({rain:0,dt:1/120,bounds:{l:1,r:CW-2,t:0,b:CH-1}});const m1=S.test.mass();assert.ok(Math.abs(m1-m0)<1e-3,`mass drift ${m1-m0}`);console.log('PASS shallow-water step conserves water mass without sources');

S.debugClear();S.debugSetDepth(8,14);S.debugSetDepth(9,1);for(let i=0;i<20;i++)S.stepOnce({rain:0,dt:1/120,bounds:{l:1,r:CW-2,t:0,b:CH-1}});assert.ok(S.fields.depth[9]>1.1);assert.ok(Math.abs(S.fields.velocity[8])+Math.abs(S.fields.velocity[9])>0.01);console.log('PASS free-surface gradient generates momentum and redistributes water');

S.debugClear();S.debugSetBed(4,7);S.debugSetBed(20,7);for(let x=5;x<20;x++)S.debugSetDepth(x,(x%2)?10:2);for(let i=0;i<900;i++)S.stepOnce({rain:0,dt:1/120,bounds:{l:1,r:CW-2,t:0,b:CH-1}});let etaMin=Infinity,etaMax=-Infinity;for(let x=5;x<20;x++){const eta=(CH-S.fields.bedY[x])*CELL+S.fields.depth[x];etaMin=Math.min(etaMin,eta);etaMax=Math.max(etaMax,eta)}assert.ok(etaMax-etaMin<2.0,`pool surface not settling sufficiently flat: ${etaMax-etaMin}`);console.log('PASS standing pool relaxes toward a continuous flat free surface');

S.debugClear();S.debugSetDepth(12,10);S.debugSetVelocity(12,8);const body={alive:true,gone:false,nodes:[{x:12*CELL+1,y:10*CELL-3,px:12*CELL-2,py:10*CELL-3,r:2}]};ctx.creatures.push(body);const vx0=body.nodes[0].x-body.nodes[0].px;S.stepOnce({rain:0,dt:1/120,bounds:{l:1,r:CW-2,t:0,b:CH-1}});const vx1=body.nodes[0].x-body.nodes[0].px;assert.notEqual(vx1,vx0);console.log('PASS surface-water state physically changes submerged creature motion');

S.debugClear();S.debugSetDepth(14,12);S.debugSetVelocity(14,18);const top=10*CW+14,j=ctx.GENESIS_HYDRO25.debugLaneIndex(1,top);ctx.GENESIS_HYDRO25.fields.soilMass[j]=0.06;for(let i=0;i<240;i++)S.stepOnce({rain:0,dt:1/120,bounds:{l:1,r:CW-2,t:0,b:CH-1}});assert.ok(ctx.GENESIS_HYDRO25.fields.soilMass[j]<0.06 || M[top]===MAT.AIR);console.log('PASS surface-flow shear couples to actual terrain erosion state');

assert.equal(S.full2DCFD,false);assert.equal(S.full3D,false);assert.equal(S.continuousSurface,true);assert.match(S.representation,/local-inertial shallow-water/i);console.log('PASS metadata accurately identifies continuous shallow-water approximation');

S.debugClear();S.debugSetLavaDepth(8,14);S.debugSetLavaDepth(9,1);const lm0=S.test.lavaMass();for(let i=0;i<120;i++)S.stepOnce({rain:0,dt:1/120,bounds:{l:1,r:CW-2,t:0,b:CH-1}});const lm1=S.test.lavaMass();assert.ok(Math.abs(lm1-lm0)<1e-3,`lava mass drift ${lm1-lm0}`);assert.ok(S.fields.lavaDepth[9]>1.0);console.log('PASS viscous lava surface solver conserves mass and redistributes depth');

S.debugClear();S.debugSetDepth(8,14);S.debugSetDepth(9,1);for(let i=0;i<40;i++)S.stepOnce({rain:0,dt:1/120,bounds:{l:1,r:CW-2,t:0,b:CH-1}});const waterSpeed=Math.max(Math.abs(S.fields.velocity[8]),Math.abs(S.fields.velocity[9]));S.debugClear();S.debugSetLavaDepth(8,14);S.debugSetLavaDepth(9,1);for(let i=0;i<40;i++)S.stepOnce({rain:0,dt:1/120,bounds:{l:1,r:CW-2,t:0,b:CH-1}});const lavaSpeed=Math.max(Math.abs(S.fields.lavaVelocity[8]),Math.abs(S.fields.lavaVelocity[9]));assert.ok(lavaSpeed<waterSpeed);console.log('PASS lava free-surface motion is more viscous/slower than water');

assert.equal(S.continuousLava,true);assert.equal(S.legacyOpenLavaAbsorbed,true);console.log('PASS metadata exposes continuous lava conversion');
