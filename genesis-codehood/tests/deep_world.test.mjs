import assert from 'node:assert/strict';
import {World} from '../scratch/sim-core.js';
import {DeepWorld,MAT,DEEP_META} from '../scratch/deep-world.js';
import {bindDeepToWorld} from '../scratch/deep-bind.js';
import {planCellPath,DEEP_NAV_META} from '../scratch/deep-nav.js';
import {DEEP_RENDER_META} from '../scratch/deep-render.js';
{
 const w=new World({seed:7001,n:160,dx:6,worldH:480,ocean:false}),a=bindDeepToWorld(new DeepWorld({seed:7001,cell:8,cols:120,rows:60,chunkSize:16}),w),b=bindDeepToWorld(new DeepWorld({seed:7001,cell:8,cols:120,rows:60,chunkSize:16}),w);assert.deepEqual([...a.mat],[...b.mat]);assert.ok(a.chunks.length>10);const mats=new Set(a.mat);assert.ok(mats.has(MAT.AIR)&&mats.has(MAT.SOIL)&&mats.has(MAT.STONE));const caveAir=[...a.mat].filter((m,i)=>m===MAT.AIR&&((i/a.cols)|0)>15).length;assert.ok(caveAir>50,`cave air ${caveAir}`);console.log('PASS deep world deterministic chunks, strata and cave void volume');
}
{
 const d=new DeepWorld({seed:7002,cell:8,cols:40,rows:30,chunkSize:10});d.mat.fill(MAT.AIR);d.water.fill(0);for(let x=0;x<40;x++)d.mat[d.idx(x,29)]=MAT.STONE;d.water[d.idx(20,3)]=.9;const m0=d.totalWater();for(let k=0;k<180;k++)d.stepWater(1/120);const m1=d.totalWater();assert.ok(Math.abs(m1-m0)<1e-4,`${m0} -> ${m1}`);let cy=0,sum=0;for(let y=0;y<30;y++)for(let x=0;x<40;x++){const q=d.water[d.idx(x,y)];sum+=q;cy+=q*y}assert.ok(cy/sum>5);console.log('PASS deep water conserves mass and falls through 2D cave volume');
}
{
 const d=new DeepWorld({seed:7003,cell:8,cols:32,rows:22,chunkSize:8});d.mat.fill(MAT.AIR);d.water.fill(0);for(let x=0;x<32;x++)d.mat[d.idx(x,18)]=MAT.STONE;for(let x=2;x<30;x++)d.mat[d.idx(x,17)]=MAT.SOIL;
 // A solid obstruction plus a physically supported one-cell staircase over it.
 d.mat[d.idx(15,17)]=MAT.STONE;d.mat[d.idx(15,16)]=MAT.STONE;d.mat[d.idx(15,15)]=MAT.STONE;
 d.mat[d.idx(13,16)]=MAT.STONE;d.mat[d.idx(14,15)]=MAT.STONE;d.mat[d.idx(15,14)]=MAT.STONE;d.mat[d.idx(16,15)]=MAT.STONE;d.mat[d.idx(17,16)]=MAT.STONE;
 d.recomputeSupport();const p=planCellPath(d,{x:d.wx(4),y:d.wy(16)},{x:d.wx(27),y:d.wy(16)},{maxExpanded:5000,profile:{cling:false,swim:false}});assert.equal(p.reachable,true,JSON.stringify(p));assert.ok(p.points.length>2);assert.ok(p.points.some(q=>q.y<16),JSON.stringify(p.points));for(const q of p.points)assert.equal(d.isSolid(q.x,q.y),false,'route waypoint may not occupy solid material');console.log('PASS deep A* uses physically supported cells to route over solid terrain');
}
{
 const d=new DeepWorld({seed:7004,cell:8,cols:20,rows:18,chunkSize:8});d.mat.fill(MAT.AIR);const i=d.idx(10,5),below=d.idx(10,6);d.mat[i]=MAT.SAND;d.integrity[i]=.05;d.support[i]=0;d.mat[below]=MAT.AIR;d.stepMaterial(1/60);assert.equal(d.mat[below],MAT.SAND);assert.equal(d.mat[i],MAT.AIR);console.log('PASS unsupported granular material changes actual world occupancy');
}
assert.equal(DEEP_META.blockGridVisible,false);assert.equal(DEEP_NAV_META.straightLineTargeting,false);assert.equal(DEEP_RENDER_META.cellsVisible,false);assert.equal(DEEP_RENDER_META.simpleCellRects,false);assert.equal(DEEP_RENDER_META.preRenderedSprites,false);console.log('PASS deep metadata rejects visible cell grid, straight-line AI and pre-rendered sprite cheats');