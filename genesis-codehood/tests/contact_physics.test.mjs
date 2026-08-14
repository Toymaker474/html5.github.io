import assert from 'node:assert/strict';
import {terrainFrame,terrainMaterial,pointVelocity,solveTerrainContact,stanceTraction} from '../scratch/contact-physics.js';

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

console.log('PASS contact physics: projection, Coulomb friction, mass-correct paired impulse, static breakaway and wet-slip limit');
