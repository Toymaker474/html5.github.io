import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

let seed=0x51a77e;
const math=Object.create(Math);
math.random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296};

const fakeGradient={addColorStop:()=>{}};
const drawCtx=new Proxy({}, {
  get(t,k){
    if(k==='createLinearGradient'||k==='createRadialGradient')return ()=>fakeGradient;
    if(!(k in t))t[k]=()=>{};
    return t[k];
  },
  set(t,k,v){t[k]=v;return true;}
});

const ctx={
  console,Math:math,Number,Array,Object,Map,JSON,Infinity,
  TAU:Math.PI*2,time:1,SW:800,SH:600,cam:{z:1},
  hud:{innerHTML:'MORPHOGENESIS V1 · ORGANIC BODY PATCH'},ctx:drawCtx,
  clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
  lerp:(a,b,t)=>a+(b-a)*t,
  rand:(a=1,b=null)=>{if(b===null){b=a;a=0}return a+math.random()*(b-a)},
  gauss:()=>{let u=0,v=0;while(!u)u=math.random();while(!v)v=math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(Math.PI*2*v)},
  ws:(x,y)=>({x,y}),render:()=>{ctx.renderCalls=(ctx.renderCalls||0)+1},
  updateHUD:()=>{ctx.hud.innerHTML='MORPHOGENESIS V1 · ORGANIC BODY PATCH'}
};
vm.createContext(ctx);

vm.runInContext(`
class Gene{
  constructor(copy=null){
    if(copy){Object.assign(this,JSON.parse(JSON.stringify(copy)));return}
    this.segmentSize=12;this.segments=6;this.bodyDepth=.8;this.gills=4;this.gillSize=.8;
    this.eyes=2;this.eyeSize=1;this.eyeSpread=.5;this.pupil=.4;this.head=1;this.jaw=.7;
    this.hue=190;this.saturation=75;this.translucency=.2;this.locomotion=0;this.armor=.2;
    this.carnivore=.4;this.aggression=.5;this.sensor=220;this.flex=.3;this.tail=1;
  }
}
function mutateGene(g){return new Gene(g)}
function crossoverGene(a,b){return new Gene(a)}
class Creature{
  constructor(g=new Gene()){
    this.g=g;this.x=20;this.y=30;this.angle=0;this.vx=.3;this.vy=0;this.health=1;this.hunger=.2;this.dead=false;
    this.mouthOpen=0;this.blink=0;this.wounds=[];this.spine=Array.from({length:g.segments},(_,i)=>({x:-i*8,y:0}));
  }
  update(dt){this.x+=dt}
  performBite(){this.didBite=true}
  applyWound(){this.wounds.push({station:.4,side:1,severity:.7})}
  bodyRadiusAt(i){return 8*(1-i/20)}
  draw(){globalThis.drawCalls=(globalThis.drawCalls||0)+1}
}
globalThis.Gene=Gene;globalThis.Creature=Creature;globalThis.mutateGene=mutateGene;globalThis.crossoverGene=crossoverGene;
`,ctx);

vm.runInContext(fs.readFileSync(new URL('./js/living_art.js',import.meta.url),'utf8'),ctx,{filename:'living_art.js'});
vm.runInContext('globalThis.g=new Gene();globalThis.c=new Creature(g);',ctx);

const g=ctx.g,c=ctx.c;
for(const k of ['skinGloss','iridescence','causticResponse','breathRate','breathDepth','gillPulse','eyeTrack','jawMuscle','finVeins','scarTone','lateralGlow']){
  assert.ok(Number.isFinite(g[k]),k+' is finite');
}
assert.ok(g.photophores>=0&&g.photophores<=12,'photophore count in range');

const baseRadius=vm.runInContext('c.bodyRadiusAt(1)',ctx);
vm.runInContext('c.update(0.25)',ctx);
const afterRadius=vm.runInContext('c.bodyRadiusAt(1)',ctx);
assert.ok(Number.isFinite(afterRadius)&&afterRadius>0,'breathing radius remains finite');
assert.notEqual(afterRadius,baseRadius,'breathing deforms body radius');

vm.runInContext('c.performBite()',ctx);
assert.equal(c.didBite,true,'base bite still executes');
assert.ok(c.art.recoil>0,'bite creates visual recoil');

vm.runInContext('c.applyWound(0,0,10,null)',ctx);
assert.ok(c.art.scars.length===1,'wound leaves persistent scar record');

vm.runInContext('c.mind={target:{x:80,y:45,dead:false},fear:.2,excitement:.5};c.update(0.1)',ctx);
assert.ok(Number.isFinite(c.art.gazeX+c.art.gazeY),'target tracking stays finite');

vm.runInContext('c.draw();render();updateHUD();',ctx);
assert.ok(ctx.drawCalls>=1,'base creature renderer still executes');
assert.ok(ctx.renderCalls>=1,'base world renderer still executes');
assert.match(ctx.hud.innerHTML,/LIVING ART \+ COGNITION/,'HUD identifies living art pass');

console.log('PASS morphogenesis living-art deterministic tests');
