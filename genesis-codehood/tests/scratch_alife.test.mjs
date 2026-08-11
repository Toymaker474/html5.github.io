import assert from 'node:assert/strict';
import {World} from '../scratch/sim-core.js';
import {senseCreature,updateMind,contactFeed,contactDrink,digest,ALIFE_META} from '../scratch/alife.js';

{
  const w=new World({seed:101,n:100,dx:6,worldH:420,ocean:false});w.water.fill(0);w.q.fill(0);
  const c=w.creatures[0],body=c.nodes[2];for(const p of w.plants)p.alive=false;const p=w.plants[0];p.alive=true;p.biomass=.8;p.x=(body.x+55)/w.dx;c.hunger=.9;c.hydration=.9;c.mind.intentAge=9;c.mind.commitFor=0;
  const s=senseCreature(w,c);assert.equal(s.food,p);updateMind(w,c,1/60,s);assert.equal(c.mind.intent,'forage');assert.ok(c.mind.memory.foodC>0);const remembered=c.mind.memory.foodC;p.alive=false;updateMind(w,c,1/60,senseCreature(w,c));assert.ok(c.mind.memory.foodC>0&&c.mind.memory.foodC<remembered);
  console.log('PASS scratch ALife uses local sensing and decaying food memory');
}
{
  const w=new World({seed:102,n:100,dx:6,worldH:420,ocean:false,infiltrationScale:0});w.water.fill(0);w.q.fill(0);const c=w.creatures[0],ci=Math.max(2,Math.min(w.n-3,(c.nodes[2].x/w.dx)|0));w.water[ci+4]=6;c.hydration=.12;c.hunger=.1;c.mind.intentAge=9;c.mind.commitFor=0;const s=senseCreature(w,c);assert.ok(s.water);updateMind(w,c,1/60,s);assert.equal(c.mind.intent,'drink');assert.ok(Math.abs(c.targetX-s.water.x)<1e-6);
  console.log('PASS scratch thirst causally selects sensed water');
}
{
  const w=new World({seed:103,n:90,dx:6,worldH:420,ocean:false});const c=w.creatures[0],p=w.plants[0];p.alive=true;p.biomass=.9;p.energy=.7;c.mind.intent='forage';c.stomach=0;c.energy=.3;const px=p.x*w.dx,py=w.surfaceY(px)-Math.min(28,8+p.biomass*12);c.mouth.x=px;c.mouth.y=py;const e0=c.energy,b=contactFeed(w,c,p,1);assert.ok(b>0);assert.ok(c.stomach>0);assert.equal(c.energy,e0);const st=c.stomach,d=digest(c,1);assert.ok(d>0&&c.stomach<st&&c.energy>e0);
  console.log('PASS scratch feeding is mouth contact -> stomach -> delayed digestion energy');
}
{
  const w=new World({seed:104,n:90,dx:6,worldH:420,ocean:false,infiltrationScale:0});w.water.fill(0);const c=w.creatures[0],i=Math.max(1,Math.min(w.n-2,(c.nodes[2].x/w.dx)|0));w.water[i]=5;c.mind.intent='drink';c.hydration=.2;c.mouth.x=i*w.dx;c.mouth.y=w.waterSurfaceY(c.mouth.x);const h0=c.hydration,t=contactDrink(w,c,1/60);assert.ok(t>0&&c.hydration>h0);
  console.log('PASS scratch drinking requires mouth contact with simulated water');
}
{
  const w=new World({seed:105,n:120,dx:6,worldH:420,ocean:false,infiltrationScale:0});w.rain=0;w.water.fill(0);for(const p of w.plants)p.alive=false;const c=w.creatures[0];c.mind.intent='explore';c.mind.intentAge=0;c.mind.commitFor=999;c.mind.targetX=c.nodes[2].x+200;c.targetX=c.mind.targetX;c.hunger=.1;c.hydration=.9;c.energy=.9;c.fatigue=0;const x0=c.nodes[2].x;for(let k=0;k<600;k++)w.stepCreatures(1/120);assert.ok(c.nodes[2].x-x0>20,`displacement ${c.nodes[2].x-x0}`);assert.ok(c.legs.some(l=>l.stance));
  console.log('PASS scratch planted-foot gait produces sustained locomotion');
}
{
  const w=new World({seed:106,n:100,dx:6,worldH:420,ocean:false});const c=w.creatures[0];c.alive=false;c.corpseMass=.05;const i=Math.max(0,Math.min(w.n-1,(c.nodes[2].x/w.dx)|0));w.moisture[i]=1;const n0=w.nutrient[i];for(let k=0;k<1200;k++)w.stepCorpse(c,1/60);assert.ok(w.nutrient[i]>n0);assert.equal(c.gone,true);
  console.log('PASS scratch corpse decomposition returns nutrients to local soil');
}
assert.equal(ALIFE_META.learning,false);assert.equal(ALIFE_META.stomachDigestion,true);assert.equal(ALIFE_META.directPlantCalories,false);
console.log('PASS scratch ALife metadata refuses learning claim and exposes digestion path');
