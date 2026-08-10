import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

let seed=0x12345678;
const math=Object.create(Math);
math.random=()=>{
  seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;
  return ((seed>>>0)/4294967296);
};

const ctx={
  console,
  Math:math,
  JSON,
  Number,
  Map,
  Array,
  Object,
  Infinity,
  performance:{now:()=>0},
  CFG:{WORLD_W:8200,WORLD_H:5200,MAX_CARCASSES:120,MAX_POP:300},
  creatures:[],foods:[],carcasses:[],particles:[],
  deaths:0,bites:0,swallows:0,births:0,
  TAU:Math.PI*2,
  clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
  lerp:(a,b,t)=>a+(b-a)*t,
  norm:(x,y)=>{const m=Math.hypot(x,y)||1;return{x:x/m,y:y/m,m}},
  rand:(a=1,b=null)=>{if(b===null){b=a;a=0}return a+math.random()*(b-a)},
  gauss:()=>{
    let u=0,v=0;while(!u)u=math.random();while(!v)v=math.random();
    return Math.sqrt(-2*Math.log(u))*Math.cos(Math.PI*2*v);
  },
  currentAt:()=>({x:0,y:0}),
  depthLight:()=>1,
  nearbyLife:()=>[],
  wrap:o=>{if(o.x<0)o.x+=8200;if(o.x>=8200)o.x-=8200;if(o.y<0)o.y+=5200;if(o.y>=5200)o.y-=5200},
  soundEvent:()=>{},
  burst:()=>{},
  ws:(x,y)=>({x,y}),
  cam:{z:1},
  ctx:new Proxy({}, {get:(t,k)=>{
    if(k==='createLinearGradient')return ()=>({addColorStop:()=>{}});
    if(k==='measureText')return ()=>({width:0});
    if(!(k in t))t[k]=()=>{};
    return t[k];
  },set:(t,k,v)=>{t[k]=v;return true;}})
};
vm.createContext(ctx);

for(const file of ['js/genetics.js','js/entities.js']){
  vm.runInContext(fs.readFileSync(new URL(file,import.meta.url),'utf8'),ctx,{filename:file});
}
vm.runInContext('globalThis.GeneT=Gene;globalThis.BrainT=Brain;globalThis.FoodT=Food;globalThis.CreatureT=Creature;globalThis.CarcassT=Carcass;',ctx);

const {GeneT:Gene,BrainT:Brain,FoodT:Food,CreatureT:Creature}=ctx;

const g=new Gene();
assert.ok(g.segments>=2 && g.segments<=12,'developmental body has valid segment count');
assert.ok(g.bodyDepth>0 && g.head>0 && g.snout>0,'developmental body has coherent dimensions');

const c=new Creature(g,new Brain());
c.angle=0;c.vx=1;c.vy=0;
for(let i=0;i<30;i++)c.updateSpine();
assert.ok(c.spine.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)),'spine stays finite');
assert.ok(c.spine.length===g.segments,'spine matches genome');
assert.ok(c.spine.length<2 || c.spine[1].x<0,'spine remains behind head in local space');

c.g.jaw=1;c.g.gape=1;c.g.biteSpeed=1;c.g.mouthReach=1;c.g.carnivore=.2;
const mouth=c.mouthWorld();
const f=new Food(mouth.x,mouth.y);f.energy=12;
ctx.foods.push(f);
const energyBefore=c.energy;
c.startBite();
for(let i=0;i<100;i++)c.updateMouth(1/60,{m:5});
assert.ok(ctx.bites>=1,'closing jaw made a contact bite');
assert.ok(ctx.swallows>=1,'captured plankton was swallowed');
assert.equal(f.dead,true,'swallowed plankton leaves world');
assert.ok(c.stomach>=11.9,'food enters stomach store');
assert.equal(c.energy,energyBefore,'swallowing does not instantly create usable energy');

ctx.foods.length=0;
const victim=new Creature(new Gene(),new Brain());
victim.x=c.x+2;victim.y=c.y;
victim.die();
assert.equal(ctx.carcasses.length,1,'death creates finite carcass');
const carcass=ctx.carcasses[0];
const carcassBefore=carcass.energy;
c.g.carnivore=1;c.g.jaw=1.2;c.biteCooldown=0;c.biteTimer=0;
carcass.x=c.mouthWorld().x;carcass.y=c.mouthWorld().y;
c.startBite();
for(let i=0;i<40;i++)c.updateMouth(1/60,{m:4});
assert.ok(carcass.energy<carcassBefore,'scavenging removes finite carcass energy');

console.log('PASS morphogenesis anatomy/mouth/feeding deterministic tests');
