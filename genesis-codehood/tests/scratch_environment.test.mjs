import assert from 'node:assert/strict';
import {World} from '../scratch/sim-core.js';
import {Environment,ENV_META} from '../scratch/environment.js';
const sum=a=>a.reduce((s,v)=>s+v,0);
{
 const w=new World({seed:44,n:160,dx:6,worldH:720,ocean:false}),e=new Environment(w,{cell:24,rows:30});
 let cave=0,sub=0;for(let y=0;y<e.rows;y++)for(let x=0;x<e.cols;x++){const i=e.idx(x,y),wy=e.wy(y),sy=w.surfaceY(e.wx(x));if(wy>sy){sub++;if(!e.solid[i])cave++;}}
 assert.ok(cave>8&&sub>cave,'expected carved underground voids');console.log('PASS scratch environment generates actual cave void cells below terrain');
}
{
 const w=new World({seed:2,n:100,dx:6,worldH:720,ocean:false}),e=new Environment(w);for(let i=0;i<e.o2.length;i++){if(!e.solid[i])e.o2[i]=0;}let a=-1,b=-1;outer:for(let y=1;y<e.rows-1;y++)for(let x=1;x<e.cols-2;x++){const i=e.idx(x,y),j=e.idx(x+1,y);if(!e.solid[i]&&!e.solid[j]){a=i;b=j;break outer;}}assert.ok(a>=0);e.o2[a]=1;const m0=sum(e.o2);for(let k=0;k<120;k++)e.stepGas(1/120);const m1=sum(e.o2);assert.ok(Math.abs(m1-m0)<1e-4);assert.ok(e.o2[b]>0);console.log('PASS cave oxygen diffuses between connected cells while conserving gas mass');
}
{
 const w=new World({seed:7,n:120,dx:6,worldH:720,ocean:false}),e=new Environment(w);e.water.fill(0);e.urine.fill(0);let top=-1,down=-1;outer:for(let y=1;y<e.rows-2;y++)for(let x=1;x<e.cols-1;x++){const i=e.idx(x,y),j=e.idx(x,y+1);if(!e.solid[i]&&!e.solid[j]){top=i;down=j;break outer;}}assert.ok(top>=0);e.water[top]=.8;const m0=sum(e.water);for(let k=0;k<50;k++)e.stepLiquids(1/120);const m1=sum(e.water);assert.ok(Math.abs(m1-m0)<1e-4);assert.ok(e.water[down]>0);console.log('PASS cave liquid falls under gravity without deleting water mass');
}
{
 const w=new World({seed:9,n:120,dx:6,worldH:720,ocean:false}),e=new Environment(w);e.co2.fill(0);let up=-1,dn=-1;outer:for(let y=1;y<e.rows-2;y++)for(let x=1;x<e.cols-1;x++){const a=e.idx(x,y),b=e.idx(x,y+1);if(!e.solid[a]&&!e.solid[b]){up=a;dn=b;break outer;}}assert.ok(up>=0);e.co2[up]=1;const before=e.co2[dn];for(let k=0;k<80;k++)e.stepGas(1/120);assert.ok(e.co2[dn]>before);console.log('PASS carbon dioxide preferentially transfers downward in connected cave air');
}
{
 const w=new World({seed:12,n:120,dx:6,worldH:720,ocean:false,infiltrationScale:0});w.rain=0;w.water.fill(0);const e=new Environment(w);for(let x=0;x<e.cols;x++){const i=e.idx(x,0);if(!e.solid[i])e.vapor[i]=.08;e.cloud[x]=.08;}const before=w.totalWater();for(let k=0;k<180;k++){e.time+=1/60;e.stepClouds(1/60);}assert.ok(w.totalWater()>before);console.log('PASS vapor/cloud water condenses into precipitation that adds surface water');
}
{
 const w=new World({seed:18,n:140,dx:6,worldH:720,ocean:false}),e=new Environment(w),c=w.creatures[0];c.bladder=.95;c.mind.intent='rest';const wi=Math.max(0,Math.min(w.n-1,Math.floor(c.nodes[2].x/w.dx))),u0=e.surfaceUrine[wi];e.stepOrganisms(1);assert.ok(e.surfaceUrine[wi]>u0);console.log('PASS organism bladder state excretes a separate urine liquid into world state');
}
{
 const w=new World({seed:25,n:120,dx:6,worldH:720,ocean:false}),e=new Environment(w),c=w.creatures[0],ce=e.cellAt(c.nodes[2].x,c.nodes[2].y),i=e.idx(ce.x,ce.y);e.solid[i]=0;e.o2[i]=0;c.oxygen=.15;const h=c.health;for(let k=0;k<120;k++)e.stepOrganisms(1/60);assert.ok(c.health<h);assert.ok(c.mind.stress>0);console.log('PASS oxygen depletion causally harms and stresses organisms');
}
assert.equal(ENV_META.cfd,false);assert.equal(ENV_META.full3D,false);assert.deepEqual(ENV_META.liquids,['water','urine']);console.log('PASS environment metadata refuses CFD/full-3D claims and exposes fluid species');
