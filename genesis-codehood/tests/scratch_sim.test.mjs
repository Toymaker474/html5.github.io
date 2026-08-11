import assert from 'node:assert/strict';
import {World} from '../scratch/sim-core.js';
{
  const a=new World({seed:77,n:96,dx:6,worldH:400});
  const b=new World({seed:77,n:96,dx:6,worldH:400});
  assert.deepEqual([...a.bed],[...b.bed]);
  assert.deepEqual(a.plants.map(p=>[p.x,p.type,p.seed]),b.plants.map(p=>[p.x,p.type,p.seed]));
  console.log('PASS scratch deterministic seed reproduces terrain and organisms');
}
{
  const w=new World({seed:5,n:80,dx:5,worldH:400,ocean:false,infiltrationScale:0});w.rain=0;w.water.fill(0);w.q.fill(0);for(let i=20;i<45;i++)w.water[i]=10;const m0=w.totalWater();for(let k=0;k<240;k++)w.stepHydro(1/120);const m1=w.totalWater();assert.ok(Math.abs(m1-m0)<.05,`water drift ${m1-m0}`);console.log('PASS scratch shallow-water transfer conserves free-water mass');
}
{
  const w=new World({seed:9,n:64,dx:5,worldH:400,ocean:false,infiltrationScale:0});w.rain=0;w.water.fill(0);w.q.fill(0);w.bed.fill(120);w.water[24]=24;w.water[25]=2;w.stepHydro(1/60);assert.ok(w.q[25]>0);console.log('PASS scratch free-surface gradient generates directional discharge');
}
{
  const w=new World({seed:12,n:90,dx:6,worldH:400,ocean:false});const p=w.plants.find(p=>p.alive),i=Math.max(0,Math.min(w.n-1,p.x|0));p.biomass=.5;p.energy=1;p.water=.9;w.moisture[i]=.9;w.nutrient[i]=1;const b=p.biomass;for(let k=0;k<180;k++)w.stepPlants(1/60);assert.ok(p.biomass>b);console.log('PASS scratch plant biomass grows from water/nutrients/energy state');
}
{
  const w=new World({seed:15,n:100,dx:6,worldH:420,ocean:false,infiltrationScale:0});w.rain=0;w.rootStrength.fill(0);w.stepHydro(1/60);assert.ok(w.rootStrength.some(v=>v>0));console.log('PASS scratch living plants reinforce soil');
}
{
  const w=new World({seed:21,n:120,dx:6,worldH:420,ocean:false,infiltrationScale:0});w.rain=0;const c=w.creatures[0];for(let k=0;k<360;k++)w.stepCreatures(1/120);for(let i=0;i<4;i++){const a=c.nodes[i],b=c.nodes[i+1],d=Math.hypot(a.x-b.x,a.y-b.y);assert.ok(d<10.5&&d>3.5,`spine segment ${i} ${d}`);}assert.ok(c.nodes.every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)));console.log('PASS scratch articulated creature rig remains constrained');
}
