import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

let seed=0x12345678;
const math=Object.create(Math);
math.random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return((seed>>>0)/4294967296)};

const ctx={
  console,Math:math,JSON,Number,Map,Set,Array,Object,Infinity,
  performance:{now:()=>0},
  CFG:{WORLD_W:8200,WORLD_H:5200,MAX_CARCASSES:140,MAX_POP:320,BASE_POP:40,FOOD_TARGET:80,FOOD_MIN:40,GEN_SECONDS:62,GENE_BANK:20,MAX_PARTICLES:620},
  creatures:[],foods:[],carcasses:[],particles:[],geneBank:[],
  deaths:0,bites:0,swallows:0,births:0,woundsMade:0,generation:1,genStart:0,time:0,follow:false,
  TAU:Math.PI*2,
  clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
  lerp:(a,b,t)=>a+(b-a)*t,
  smoothstep:t=>t*t*(3-2*t),
  angleDelta:(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a)),
  norm:(x,y)=>{const m=Math.hypot(x,y)||1;return{x:x/m,y:y/m,m}},
  hash2:(x,y,s=1)=>{let n=(x*374761393+y*668265263+s*69069)|0;n=(n^(n>>>13))*1274126177;return((n^(n>>>16))>>>0)/4294967295},
  rand:(a=1,b=null)=>{if(b===null){b=a;a=0}return a+math.random()*(b-a)},
  gauss:()=>{let u=0,v=0;while(!u)u=math.random();while(!v)v=math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(Math.PI*2*v)},
  currentAt:()=>({x:0,y:0}),depthLight:()=>1,waterTemp:()=>18,
  speciesKey:g=>`${g.plan}:${Math.round(g.segments/2)}:${Math.round(g.bodyDepth*2)}:${g.carnivore>.62?'C':'O'}`,
  nearbyLife:o=>ctx.creatures.filter(c=>c!==o&&!c.dead),
  rebuildGrid:()=>{},
  wrap:o=>{if(o.x<0)o.x+=8200;if(o.x>=8200)o.x-=8200;if(o.y<0)o.y+=5200;if(o.y>=5200)o.y-=5200},
  soundEvent:()=>{},burst:()=>{},ws:(x,y)=>({x,y}),cam:{z:1},
  ctx:new Proxy({}, {get:(t,k)=>{
    if(k==='createLinearGradient')return ()=>({addColorStop:()=>{}});
    if(k==='measureText')return ()=>({width:0});
    if(k==='save'||k==='restore'||k==='beginPath'||k==='closePath'||k==='moveTo'||k==='lineTo'||k==='quadraticCurveTo'||k==='bezierCurveTo'||k==='arc'||k==='ellipse'||k==='fill'||k==='stroke'||k==='translate'||k==='rotate'||k==='clip'||k==='fillRect')return ()=>{};
    return t[k]??(()=>{});
  },set:(t,k,v)=>{t[k]=v;return true;}})
};
vm.createContext(ctx);
for(const file of ['js/genetics.js','js/entities.js','js/evolution.js'])vm.runInContext(fs.readFileSync(new URL(file,import.meta.url),'utf8'),ctx,{filename:file});
vm.runInContext('globalThis.GeneT=Gene;globalThis.BrainT=Brain;globalThis.FoodT=Food;globalThis.CreatureT=Creature;globalThis.CarcassT=Carcass;globalThis.evolveT=evolve;',ctx);
const {GeneT:Gene,BrainT:Brain,FoodT:Food,CreatureT:Creature,evolveT:evolve}=ctx;

const plans=new Set();
for(let i=0;i<120;i++){
  const g=new Gene();plans.add(g.plan);
  assert.ok(g.segments>=2&&g.segments<=12);
  assert.ok(g.bodyDepth>=.4&&g.bodyDepth<=1.4);
  assert.ok(g.head>0&&g.snout>0&&g.gills>=1);
  const m=vm.runInContext('mutateGene',ctx)(g,1.8);
  assert.ok(Number.isFinite(m.segmentSize)&&Number.isFinite(m.muscle));
}
assert.ok(plans.size>=4,'founders contain multiple coherent developmental plans');

for(let plan=0;plan<4;plan++){
  const g=new Gene();g.plan=plan;g.locomotion=plan;
  const c=new Creature(g,new Brain());c.angle=1.7;c.vx=.9;c.vy=.3;c.turnVel=.08;
  for(let i=0;i<120;i++){c.phase+=1/60;c.stroke=.5+.5*Math.sin(c.phase);c.updateSpine()}
  assert.ok(c.spine.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
  assert.ok(c.spine.length<2||c.spine[1].x<0,'spine is solved in creature-local coordinates');
  assert.ok(Number.isFinite(c.locomotionForce(.7))&&c.locomotionForce(.7)>0);
}

const herb=new Creature(new Gene(),new Brain());
herb.g.jaw=.9;herb.g.gape=1;herb.g.biteSpeed=1;herb.g.mouthReach=1;herb.g.carnivore=.15;herb.angle=0;herb.x=100;herb.y=100;
const mouth=herb.mouthWorld();const f=new Food(mouth.x,mouth.y);f.energy=12;ctx.foods.push(f);
const energyBefore=herb.energy;herb.startBite();
for(let i=0;i<90;i++)herb.updateMouth(1/60,4);
assert.ok(ctx.bites>=1);assert.ok(ctx.swallows>=1);assert.equal(f.dead,true);assert.ok(herb.stomach>=11.9);assert.equal(herb.energy,energyBefore,'capture/swallow does not award instant usable energy');

const predator=new Creature(new Gene(),new Brain()),prey=new Creature(new Gene(),new Brain());
predator.x=100;predator.y=100;prey.x=110;prey.y=100;predator.g.carnivore=1;predator.g.aggression=1;predator.g.jaw=1.2;
const h0=prey.health;prey.applyWound(prey.x,prey.y,10,predator);
assert.ok(prey.health<h0);assert.equal(prey.wounds.length,1);assert.ok(prey.startleTimer>0);assert.equal(prey.dead,false);

prey.health=0;prey.die();assert.equal(ctx.carcasses.length,1);
const carcass=ctx.carcasses[0],before=carcass.energy;
predator.x=carcass.x-predator.g.segmentSize;predator.y=carcass.y;predator.angle=0;
carcass.x=predator.mouthWorld().x;carcass.y=predator.mouthWorld().y;
predator.heldFood=null;predator.heldBolus=null;predator.swallowT=0;predator.performBite();
assert.ok(carcass.energy<before);assert.ok(predator.heldBolus,'carcass bite becomes a bolus instead of instant stomach energy');
const stomachBefore=predator.stomach;
for(let i=0;i<90;i++)predator.updateMouth(1/60,999);
assert.ok(predator.stomach>stomachBefore,'carcass bolus reaches stomach after swallow animation');

ctx.creatures.length=0;
for(let plan=0;plan<5;plan++)for(let i=0;i<6;i++){
  const g=new Gene();g.plan=plan;g.segments=3+plan;const c=new Creature(g,new Brain());c.kids=i;c.age=30+i;c.lineage=2;ctx.creatures.push(c);
}
evolve();
const afterPlans=new Set(ctx.creatures.map(c=>c.g.plan));
assert.ok(afterPlans.size>=4,'diversity-preserving selection keeps multiple body-plan families');
assert.ok(ctx.geneBank.length>0,'successful genomes are archived for fail-soft recovery');

console.log('PASS morphogenesis coherent anatomy / locomotion / bite / swallow / wound / diversity tests');
