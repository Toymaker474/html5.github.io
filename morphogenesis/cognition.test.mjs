import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

let seed=0x42424242;
const math=Object.create(Math);
math.random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296};

const ctx={
  console,Math:math,Number,Object,Array,Map,Infinity,
  TAU:Math.PI*2,
  CFG:{CELL:220},time:0,bites:0,
  creatures:[],foods:[],carcasses:[],hud:{innerHTML:''},cam:{z:1},
  clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
  lerp:(a,b,t)=>a+(b-a)*t,
  angleDelta:(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a)),
  rand:(a=1,b=null)=>{if(b===null){b=a;a=0}return a+math.random()*(b-a)},
  gauss:()=>{let u=0,v=0;while(!u)u=math.random();while(!v)v=math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(Math.PI*2*v)},
  norm:(x,y)=>{const m=Math.hypot(x,y)||1;return{x:x/m,y:y/m,m}},
  nearbyLife:o=>ctx.creatures.filter(c=>c!==o&&!c.dead),
  ws:(x,y)=>({x,y}),
  updateHUD:()=>{},
  ctx:new Proxy({}, {get:(t,k)=>{if(!(k in t))t[k]=()=>{};return t[k]},set:(t,k,v)=>{t[k]=v;return true;}})
};

vm.createContext(ctx);
vm.runInContext(`
class Gene{
  constructor(copy=null){
    if(copy){Object.assign(this,copy);return}
    this.segmentSize=10;this.segments=5;this.armor=.2;this.muscle=1;
    this.carnivore=.3;this.aggression=.3;this.schooling=.5;this.sensor=250;this.hue=200;
  }
}
function mutateGene(g){return new Gene(g)}
function crossoverGene(a,b){return new Gene(Math.random()<.5?a:b)}
class Creature{
  constructor(g=null){
    this.g=g||new Gene();this.x=0;this.y=0;this.vx=0;this.vy=0;this.angle=0;this.turnVel=0;
    this.energy=100;this.health=1;this.eaten=0;this.kids=0;this.dead=false;this.phase=0;this.startle=0;
  }
  nearestFood(){return foods.find(f=>!f.dead)||null}
  nearestCreature(){return creatures.find(c=>c!==this&&!c.dead)||null}
  nearestCarcass(){return carcasses.find(c=>!c.dead)||null}
  update(dt){this.energy-=dt*.1}
  draw(){}
}
globalThis.Gene=Gene;globalThis.mutateGene=mutateGene;globalThis.crossoverGene=crossoverGene;globalThis.Creature=Creature;
`,ctx);

vm.runInContext(fs.readFileSync(new URL('./js/cognition.js',import.meta.url),'utf8'),ctx,{filename:'cognition.js'});
vm.runInContext('globalThis.GeneT=Gene;globalThis.CreatureT=Creature;globalThis.ensureMindT=ensureMind;',ctx);

const GeneT=ctx.GeneT,CreatureT=ctx.CreatureT;
const g=new GeneT();
for(const k of ['curiosity','fearBias','memorySpan','learningRate','persistence','socialBias','restBias','ambush','riskTolerance']){
  assert.ok(Number.isFinite(g[k]),k+' finite');
}
const gm=ctx.mutateGene(g,2);
assert.ok(gm.memorySpan>=.8&&gm.memorySpan<=16,'memory span bounded');

const predator=new CreatureT(new GeneT());
predator.g.carnivore=.95;predator.g.aggression=.95;predator.g.segmentSize=18;predator.g.segments=9;predator.x=30;
const subject=new CreatureT(new GeneT());
subject.g.riskTolerance=.1;subject.g.fearBias=.95;subject.x=0;
ctx.creatures.push(subject,predator);
const mind=ctx.ensureMindT(subject);
let obs=mind.observe(1/60);
mind.pickState(obs);
assert.equal(mind.state,'flee','high-risk nearby predator triggers flee');
assert.ok(mind.threatMemory,'threat remembered');
const oldAngle=subject.angle;
mind.applyState(1/60,obs);
assert.notEqual(subject.angle,oldAngle,'flee steering changes heading');

ctx.creatures.length=1;
predator.dead=true;
ctx.time+=1;
assert.ok(mind.validMemory('threatMemory'),'threat memory persists after threat leaves');

const before=mind.values[mind.state];
subject.energy+=25;subject.eaten+=1;
mind.learn();
assert.notEqual(mind.values[mind.state],before,'reward updates lifetime state value');

const hungry=new CreatureT(new GeneT());
hungry.energy=25;hungry.g.carnivore=.05;
const f={x:20,y:0,dead:false};
ctx.foods.push(f);ctx.creatures.push(hungry);
const hungryMind=ctx.ensureMindT(hungry);
obs=hungryMind.observe(1/60);
hungryMind.pickState(obs);
assert.equal(hungryMind.state,'forage','hungry low-carnivore creature forages');

console.log('PASS adaptive cognition deterministic tests');
