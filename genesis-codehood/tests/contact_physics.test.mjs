import assert from 'node:assert/strict';
import {terrainFrame,terrainMaterial,pointVelocity,solveTerrainContact,stanceTraction} from '../scratch/contact-physics.js';
import {World} from '../scratch/sim-core.js';

function flatWorld({wet=0,water=0,sediment=0,root=1}={}){
  const n=16,dx=10,arr=v=>Float32Array.from({length:n},()=>v);
  return{n,dx,moisture:arr(wet),water:arr(water),sediment:arr(sediment),rootStrength:arr(root),surfaceY:()=>100};
}

{
  const w=flatWorld(),f=terrainFrame(w,40);assert(Math.abs(f.tx-1)<1e-9);assert(Math.abs(f.ny+1)<1e-9);
  const p={x:40,y:105,px:40,py:99};const hit=solveTerrainContact(w,p,.1);
  assert.equal(hit.contact,true);assert(p.y<=100+1e-6);const v=pointVelocity(p,.1);assert(v.y<=1e-6);
}

{
  const dry=terrainMaterial(flatWorld({wet:.05,root:1}),40),wet=terrainMaterial(flatWorld({wet:1,water:8,root:.2}),40);
  assert(dry.muStatic>wet.muStatic);assert(dry.muKinetic>wet.muKinetic);
}

function creature(){
  const nodes=Array.from({length:5},()=>({x:40,y:90,px:40,py:90,m:1}));
  const foot={x:40,y:100,px:40,py:100};const leg={anchor:2,stance:true,foot,footMass:.55};
  return{nodes,legs:[leg],dir:1,energy:1,fatigue:0,leg};
}

{
  const w=flatWorld({wet:.05,root:1}),c=creature(),dt=.05;
  const beforeA=pointVelocity(c.nodes[2],dt),beforeF=pointVelocity(c.leg.foot,dt),r=stanceTraction(w,c,c.leg,1,dt,{gravity:110,muscleForce:54});
  const afterA=pointVelocity(c.nodes[2],dt),afterF=pointVelocity(c.leg.foot,dt),dva=afterA.x-beforeA.x,dvf=afterF.x-beforeF.x;
  assert.equal(r.applied,true);assert(dva>0);assert(dvf<0);assert(Math.abs(r.anchorMass*dva+r.footMass*dvf)<1e-9,'paired impulse must conserve horizontal momentum across the stance pair');
}

{
  const dry=creature(),wet=creature(),dt=.05;
  const rd=stanceTraction(flatWorld({wet:.05,root:1}),dry,dry.leg,1,dt,{gravity:110,muscleForce:1000});
  const rw=stanceTraction(flatWorld({wet:1,water:8,root:.1}),wet,wet.leg,1,dt,{gravity:110,muscleForce:1000});
  assert.equal(rd.slipping,true);assert.equal(rw.slipping,true);assert(rd.limit>rw.limit);assert(rd.impulse>rw.impulse);assert(rw.slipRatio>rd.slipRatio,'weaker wet substrate must produce more breakaway slip at equal drive');
}

{
  const w=new World({seed:19,n:96,dx:6,worldH:720,ocean:false});w.rain=0;
  for(let i=0;i<w.n;i++){w.bed[i]=300;w.rock[i]=270;w.water[i]=0;w.moisture[i]=.08;w.sediment[i]=0;w.rootStrength[i]=1;}
  const c=w.creatures[0];w.creatures=[c];c.energy=1;c.hydration=1;c.hunger=0;c.fatigue=0;c.mind.intent='explore';c.mind.intentAge=0;c.mind.commitFor=100;c.mind.goalX=Math.min(w.n*w.dx-20,c.nodes[2].x+150);c.mind.nav=null;
  for(const n of c.nodes){n.y=w.surfaceY(n.x)-9;n.py=n.y;}
  for(const leg of c.legs){leg.foot.y=w.surfaceY(leg.foot.x);leg.foot.py=leg.foot.y;leg.knee.y=leg.foot.y-8;leg.knee.py=leg.knee.y;leg.stance=false;leg.contactPhysics=null;}
  let liveContact=null;for(let k=0;k<300&&!liveContact;k++){w.stepCreatures(1/60);liveContact=c.legs.find(l=>l.contactPhysics?.applied)?.contactPhysics||null;}
  assert(liveContact,'live World.stepCreatures must actually invoke stance traction');assert(liveContact.impulse>0);assert(Number.isFinite(liveContact.muStatic));
}

console.log('PASS contact physics: projection, Coulomb friction, mass-correct paired impulse, static breakaway, wet-slip limit and live creature integration');
