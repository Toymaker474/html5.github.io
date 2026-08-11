import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../rig25_sound.js', import.meta.url),'utf8');
const noop=()=>{};
const ctx={
  console,Math,performance:{now:()=>0},window:null,globalThis:null,
  drawCreature:noop,stepCreature:noop,step:noop,
  desiredMotion:()=>({speed:1,dx:1,dy:0}),updateLimb:noop,
  Node:(x,y,r=1,m=1)=>({x,y,px:x,py:y,r,inv:1/Math.max(.001,m),contact:0}),
  integrateNode:noop,constrain:noop,pointCollide:noop,
  creatures:[],simTick:10,camera:{zoom:1,x:0,y:0},SW:400,SH:800,
  worldToScreen:(x,y)=>({x,y}),hash:n=>((n*16807)%2147483647)/2147483647,
  X:{save:noop,restore:noop,beginPath:noop,ellipse:noop,fill:noop,stroke:noop,moveTo:noop,lineTo:noop,bezierCurveTo:noop,quadraticCurveTo:noop,arc:noop,translate:noop,rotate:noop,createLinearGradient:()=>({addColorStop:noop}),set fillStyle(v){},set strokeStyle(v){},set lineWidth(v){},set globalAlpha(v){},set lineCap(v){},set lineJoin(v){},set globalCompositeOperation(v){}},
  document:{getElementById:()=>null,createElement:()=>({setAttribute:noop,appendChild:noop,style:{},dataset:{}}),head:{appendChild:noop},addEventListener:noop}
};
ctx.window=ctx;ctx.globalThis=ctx;
vm.runInNewContext(source,ctx,{filename:'rig25_sound.js'});

const T=ctx.GENESIS_RIG25_TEST;
assert.ok(T,'test helpers exported');
assert.equal(T.damp(0,10,.1),1);
assert.ok(T.damp(0,10,.1)<10,'motion filter does not snap to target');
console.log('PASS crab motion helper is damped rather than instantaneous');

const k1=T.kneeTarget(0,0,20,0,1,.3),k2=T.kneeTarget(0,0,20,0,-1,.3);
assert.ok(k1.y>0&&k2.y<0,'opposite limb sides bend to opposite sides');
assert.ok(Math.abs(k1.x-10)<1e-9,'joint stays centered along segment axis');
console.log('PASS persistent joint geometry creates opposite articulated bends');

const near=T.acousticGain(.8,40,500),far=T.acousticGain(.8,300,500);
assert.ok(near>far&&far>0);assert.equal(T.acousticGain(.8,501,500),0);
console.log('PASS acoustic attenuation decreases with distance and has a hard range');

const front=T.depthVisual(.8),back=T.depthVisual(-.8);
assert.ok(front.scale>1&&back.scale<1&&front.y>0&&back.y<0);
console.log('PASS 2.5D depth state produces bounded front/back presentation ordering');

const mkNode=ctx.Node;
const crab={id:1,alive:true,gone:false,face:1,state:'ROAM',g:{size:1},spec:{family:'crab'},nodes:[mkNode(0,0,4,1),mkNode(-12,0,4,1)],limbs:[{anchor:0,side:1,arm:false,hand:mkNode(12,10,2,.3),reach:24,planted:false,disabled:false},{anchor:0,side:-1,arm:true,hand:mkNode(15,-7,2,.3),reach:28,planted:false,disabled:false}],center(){return{x:0,y:0}},head(){return this.nodes[0]},memory:{},mind:{arousal:0,nerves:0}};
const listener={id:2,alive:true,gone:false,spec:{family:'mirekin'},nodes:[mkNode(45,0,4,1)],limbs:[],g:{size:1},center(){return{x:45,y:0}},memory:{},mind:{arousal:0,nerves:0}};
ctx.creatures.push(crab,listener);
const R=ctx.GENESIS_RIG25_SOUND;
assert.ok(R,'runtime API exported');
const rigA=R.debugEnsure(crab),rigB=R.debugEnsure(crab);
assert.equal(rigA,rigB,'rig state must persist on the creature');
assert.equal(rigA.limbs.length,2);
assert.ok(rigA.limbs[0].joint,'leg gets a persistent articulated joint');
assert.ok(rigA.limbs[1].clawA&&rigA.limbs[1].clawB,'crab arm gets persistent claw tips');
console.log('PASS crab rig persists physical joint/claw nodes instead of redrawing fake bend points');

R.debugEmit('bite',0,0,.8,crab);
assert.equal(listener.memory.sound.kind,'bite');
assert.ok(listener.mind.arousal>0&&listener.mind.nerves>0,'sound event changes nearby creature internal state');
console.log('PASS bite sound is also a simulated acoustic event perceived by nearby ALife');

assert.equal(R.full3D,false);assert.equal(R.pureMuscleLocomotion,false);assert.equal(R.soundUsesSimulationEvents,true);
console.log('PASS metadata refuses full-3D/pure-muscle claims and identifies event-driven audio');
