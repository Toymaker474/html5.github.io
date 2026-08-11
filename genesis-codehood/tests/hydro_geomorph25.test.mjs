import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../hydro_geomorph25.js',import.meta.url),'utf8');
const CW=12,CH=8,N=CW*CH,noop=()=>{};
const MAT={AIR:0,ROCK:1,DIRT:2,SAND:3,WATER:4,LAVA:5,MUD:6,OBSIDIAN:7,ASH:8};
const M=new Uint8Array(N);for(let y=0;y<CH;y++)for(let x=0;x<CW;x++)M[y*CW+x]=y>=5?MAT.DIRT:MAT.AIR;
const FW=CW*2,FH=CH*2,FN=FW*FH,water=new Float32Array(FN),vx=new Float32Array(FN),vy=new Float32Array(FN),solid=new Uint8Array(FN);
for(let y=0;y<FH;y++)for(let x=0;x<FW;x++)if(y>=10)solid[y*FW+x]=1;
const ctx={console,Math,Float32Array,Uint8Array,performance:{now:()=>0},window:null,globalThis:null,
 V104_COLS:CW,V104_ROWS:CH,V104_CELL:4,V104_MAT:MAT,V104_M:M,
 v104SolidMat:m=>m!==MAT.AIR&&m!==MAT.WATER&&m!==MAT.LAVA,
 v104VisibleMicroBounds:()=>({l:1,r:CW-2,t:1,b:CH-2}),hash:n=>((n*16807)%2147483647)/2147483647,rnd:()=>.99,
 GENESIS_FLUID_REFINEMENT:{scale:2,width:FW,height:FH,fields:{water,velocityX:vx,velocityY:vy,solid},sample(wx,wy){const x=Math.max(0,Math.min(FW-1,Math.floor(wx/2))),y=Math.max(0,Math.min(FH-1,Math.floor(wy/2))),i=y*FW+x;return{water:water[i],vx:vx[i],vy:vy[i],solid:!!solid[i]};}},
 step:noop,reset:noop,drawTerrain:noop,weather:{rain:.5},plants:[],creatures:[],camera:{zoom:1},X:{save:noop,restore:noop,beginPath:noop,ellipse:noop,fill:noop,stroke:noop,moveTo:noop,lineTo:noop,set fillStyle(v){},set strokeStyle(v){},set lineWidth(v){}},worldToScreen:(x,y)=>({x,y})};
ctx.window=ctx;ctx.globalThis=ctx;
vm.runInNewContext(source,ctx,{filename:'hydro_geomorph25.js'});
const H=ctx.GENESIS_HYDRO25;assert.ok(H);
assert.equal(H.lanes,3);assert.equal(H.authoritativeLane,1);assert.equal(H.full3D,false);assert.equal(H.cfd,false);
console.log('PASS three depth lanes exist while middle lane remains authoritative 2D collision plane');
const pr=H.test.pairRelax(.9,.1,.15);assert.ok(Math.abs((pr[0]+pr[1])-1)<1e-12);assert.ok(Math.abs(pr[0]-pr[1])<.8);
console.log('PASS pressure relaxation conserves pair water mass');
const de=H.test.depthExchange(.8,.2,.1);assert.ok(Math.abs(de[0]+de[1]-1)<1e-12);assert.ok(de[0]<.8&&de[1]>.2);
console.log('PASS cross-depth seepage exchange is conservative');
const dry=H.test.wetStrength(0),damp=H.test.wetStrength(.46),saturated=H.test.wetStrength(1);assert.ok(damp>dry&&damp>saturated);
console.log('PASS wet-sediment strength peaks at intermediate moisture and weakens when waterlogged');
const low=H.test.erosionRate(.2,.4,1,0),high=H.test.erosionRate(1.2,.4,1,0),rooted=H.test.erosionRate(1.2,.4,1,.9);assert.equal(low,0);assert.ok(high>0&&rooted<high);
console.log('PASS erosion requires excess shear and roots reduce erosion rate');
ctx.GENESIS_FLUID_REFINEMENT.fields.water[8*FW+8]=.8;ctx.GENESIS_FLUID_REFINEMENT.fields.velocityX[8*FW+8]=.5;
ctx.step();assert.ok(H.metrics().lanes===3);assert.ok(Number.isFinite(H.metrics().lastWaterResidual));
console.log('PASS runtime step evolves coupled hydro state without non-finite metrics');
const ex=4,ey=5,ei=H.debugIndex(ex,ey),ej=H.debugLaneIndex(1,ei);
const fx=Math.floor(((ex+.5)*4)/2),fy=Math.floor(((ey+.5)*4)/2),fi=fy*FW+fx;
water[fi]=1;vx[fi]=3;vy[fi]=.4;
const soil0=H.fields.soilMass[ej];
for(let k=0;k<12;k++)H.debugTerrainStep({l:1,r:CW-2,t:1,b:CH-2});
assert.ok(H.fields.soilMass[ej]<soil0,'strong water flow must erode exposed dirt state');
console.log('PASS strong refined-water flow actually removes simulated soil mass');
H.debugReseed();water[fi]=1;vx[fi]=3;vy[fi]=.4;H.fields.rootStrength[ei]=1;
const rooted0=H.fields.soilMass[ej];H.debugTerrainStep({l:1,r:CW-2,t:1,b:CH-2});const rootedLoss=rooted0-H.fields.soilMass[ej];
H.debugReseed();water[fi]=1;vx[fi]=3;vy[fi]=.4;H.fields.rootStrength[ei]=0;
const bare0=H.fields.soilMass[ej];H.debugTerrainStep({l:1,r:CW-2,t:1,b:CH-2});const bareLoss=bare0-H.fields.soilMass[ej];
assert.ok(rootedLoss<bareLoss,'roots must causally reduce erosion');
console.log('PASS plant-root reinforcement causally reduces soil erosion');
const depX=6,depY=4,di=H.debugIndex(depX,depY),dj=H.debugLaneIndex(1,di);M[di]=MAT.AIR;M[H.debugIndex(depX,depY+1)]=MAT.DIRT;
H.fields.suspendedSediment[dj]=.8;const dfx=Math.floor(((depX+.5)*4)/2),dfy=Math.floor(((depY+.5)*4)/2),dfi=dfy*FW+dfx;water[dfi]=.25;vx[dfi]=0;vy[dfi]=0;
for(let k=0;k<60;k++)H.debugTerrainStep({l:1,r:CW-2,t:1,b:CH-2});
assert.ok(M[di]===MAT.SAND||M[di]===MAT.MUD,'deposition should become actual terrain material');
console.log('PASS suspended sediment deposits into actual sand/mud terrain when flow slows');
const sum=()=>water.reduce((a,b)=>a+b,0),mass0=sum();H.debugStabilizeWater();const mass1=sum();assert.ok(Math.abs(mass1-mass0)<1e-6);
console.log('PASS anti-jitter water stabilization conserves total refined water mass');
assert.match(H.metrics().approximation,/not CFD\/full 3D/);
console.log('PASS metadata refuses CFD/full-3D claims');
