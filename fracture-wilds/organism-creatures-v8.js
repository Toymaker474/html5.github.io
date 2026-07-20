import { clamp, lerp, sign, ROLE, TAU } from './organism-core-v8.js';

const TRAITS = [
  'segments','legs','fins','horns','eyes','tail','muscle','agility','armor','metabolism','sensor','toxinResist','coldResist','curiosity','aggression','social','camouflage','biolum','jaw','lung','stride','endurance','balance','reaction','patience','digestion'
];

let NEXT_ID = 1;

function makeGenome(rng, role, a = null, b = null) {
  const meta = ROLE[role];
  const base = {
    segments: rng.int(3, 8), legs: meta.flyer ? 0 : rng.pick([2,4,6]), fins: meta.flyer ? rng.int(3,5) : rng.int(0,3), horns: meta.predator ? rng.int(1,4) : rng.int(0,2), eyes: rng.int(1,6), tail: rng.range(0.55,1.9),
    muscle: rng.range(0.62,1.26), agility: rng.range(0.56,1.25), armor: rng.range(0.06,0.58), metabolism: rng.range(0.58,1.25), sensor: rng.range(0.58,1.45), toxinResist: rng.range(0.06,0.76), coldResist: rng.range(0.06,0.78), curiosity: rng.range(0.08,0.92), aggression: meta.predator ? rng.range(0.5,1) : rng.range(0.02,0.36), social: clamp(meta.social + rng.range(-0.2,0.2),0,1), camouflage: rng.range(0.05,0.82), biolum: rng.range(0.22,1), jaw: meta.predator ? rng.range(0.68,1.3) : rng.range(0.18,0.62), lung: meta.flyer ? rng.range(0.7,1.2) : rng.range(0.38,1),
    stride: rng.range(0.72,1.25), endurance: rng.range(0.62,1.35), balance: rng.range(0.55,1.35), reaction: rng.range(0.55,1.35), patience: rng.range(0.18,1), digestion: rng.range(0.62,1.25)
  };
  if (!a && !b) return base;
  const child = {};
  for (const key of TRAITS) {
    let v = a && b ? (rng.chance(0.5) ? a[key] : b[key]) : (a || b)[key];
    if (rng.chance(0.11)) v += rng.range(-0.12,0.12) * Math.max(1,Math.abs(v));
    child[key] = v;
  }
  child.segments = Math.round(clamp(child.segments,2,10)); child.legs = Math.round(clamp(child.legs,0,8)); child.fins = Math.round(clamp(child.fins,0,6)); child.horns = Math.round(clamp(child.horns,0,5)); child.eyes = Math.round(clamp(child.eyes,1,8));
  for (const key of TRAITS.slice(5)) child[key] = clamp(child[key],0.03,key==='tail'?2.2:1.6);
  return child;
}

function genomeKey(g, role) {
  return `${role}:${Math.round(g.segments/3)}:${Math.round(g.legs/4)}:${Math.round(g.armor*2)}:${Math.round(g.sensor)}:${Math.round((g.stride+g.endurance+g.balance)/1.4)}`;
}

export class RecurrentBrain {
  constructor(rng, a = null, b = null) {
    this.memory = new Float32Array(12);
    this.w1 = new Float32Array(14*12);
    this.w2 = new Float32Array(12*8);
    for (const name of ['w1','w2']) {
      const out = this[name], aa = a?.[name], bb = b?.[name];
      for (let i=0;i<out.length;i++) {
        out[i] = aa||bb ? (aa&&bb ? (rng.chance(0.5)?aa[i]:bb[i]) : (aa||bb)[i]) : rng.range(-1,1);
        if ((aa||bb) && rng.chance(0.038)) out[i] += rng.range(-0.22,0.22);
      }
    }
  }
  run(input) {
    for (let h=0;h<12;h++) {
      let s=this.memory[h]*0.22;
      for (let i=0;i<14;i++) s += input[i]*this.w1[h*14+i];
      this.memory[h]=Math.tanh(s);
    }
    const out=new Float32Array(8);
    for (let o=0;o<8;o++) { let s=0; for (let h=0;h<12;h++) s += this.memory[h]*this.w2[o*12+h]; out[o]=Math.tanh(s); }
    return out;
  }
}

export class Creature {
  constructor(world, role, x, y, parentA=null, parentB=null, isPlayer=false) {
    const rng=world.rng, meta=ROLE[role];
    this.id=NEXT_ID++; this.role=role; this.meta=meta; this.isPlayer=isPlayer;
    this.genome=makeGenome(rng,role,parentA?.genome,parentB?.genome);
    this.speciesKey=genomeKey(this.genome,role); this.generation=parentA?Math.max(parentA.generation,parentB?.generation||0)+1:1;
    this.x=x; this.y=y; this.vx=0; this.vy=0; this.ax=0; this.ay=0; this.facing=rng.chance(0.5)?-1:1; this.facingVisual=this.facing;
    this.angle=0; this.angularVelocity=0; this.bodyLean=0; this.r=(isPlayer?16:rng.range(11,18))*(0.84+this.genome.segments*0.035)*(meta.mass**0.18);
    this.mass=meta.mass*(0.72+this.genome.segments*0.08+this.genome.armor*0.25);
    this.grounded=false; this.wall=0; this.onVine=false; this.inWater=false; this.slope=0;
    this.health=1; this.energy=isPlayer?1:rng.range(0.48,1); this.stamina=1; this.hydration=rng.range(0.55,1); this.oxygen=1; this.stress=0; this.sleepDebt=rng.range(0,0.35); this.stomach=0.35;
    this.age=0; this.dead=false; this.food=0; this.carriedSeeds=0;
    this.brain=new RecurrentBrain(rng,parentA?.brain,parentB?.brain);
    this.aiClock=rng.range(0,0.22); this.reactionBuffer=rng.range(0,0.12); this.restClock=0; this.pounceCooldown=0; this.attackCooldown=0; this.reproCooldown=rng.range(18,42); this.eatClock=0; this.signalCooldown=0; this.scanCooldown=0;
    this.ai={x:0,y:0,jump:false,grab:false,bite:false,dash:false,scan:false,signal:0,mode:'observe',target:null,targetSpeed:0};
    this.memory={food:null,threat:null,water:null,den:null,mate:null,plant:null,ttl:{food:0,threat:0,water:0,mate:0,plant:0}};
    this.intentX=0; this.intentY=0; this.targetSpeed=0; this.gait= rng.range(0,TAU); this.gaitRate=0; this.stepIndex=0; this.breath=rng.range(0,TAU); this.blink=rng.range(1,6);
    const spineCount=clamp(this.genome.segments+3,5,13);
    this.spine=Array.from({length:spineCount},(_,i)=>({x:x-this.facing*i*this.r*0.34,y,vx:0,vy:0}));
    const legPairs=Math.max(1,Math.ceil(this.genome.legs/2));
    this.feet=Array.from({length:this.genome.legs},(_,i)=>({x:x+((Math.floor(i/2)/(legPairs-1||1))-.5)*this.r*1.1,y:y+this.r*0.9,planted:false,phase:(i%2)*0.5+Math.floor(i/2)*0.17}));
    this.hue=parentA?(parentA.hue+rng.range(-10,10)+360)%360:(meta.hue+rng.range(-16,16)+360)%360;
    this.name=`${rng.pick(['Vex','Mira','Thorn','Oro','Nyx','Silt','Axi','Khe','Lum','Rift','Ion','Cera'])}${rng.pick(['ling','maw','fin','claw','wisp','drift','shell','stalker','ray','spore'])}-${this.id%1000}`;
    this.fitness={food:0,kills:0,offspring:0,storms:0,distance:0,scans:0,plants:0};
  }
  remember(type,target,ttl=8){this.memory[type]=target?{x:target.x,y:target.y,ref:target}:null;this.memory.ttl[type]=ttl;}
  decayMemory(dt){for(const k of Object.keys(this.memory.ttl)){this.memory.ttl[k]-=dt;if(this.memory.ttl[k]<=0)this.memory[k]=null;}}
  setIntent(x,y,targetSpeed){this.intentX=clamp(x,-1,1);this.intentY=clamp(y,-1,1);this.targetSpeed=Math.max(0,targetSpeed||0);}
  updateVisualPose(dt){
    const speed=Math.abs(this.vx), desiredFacing=Math.abs(this.intentX)>0.1?sign(this.intentX):this.facing;
    if(desiredFacing) this.facing=desiredFacing;
    this.facingVisual=lerp(this.facingVisual,this.facing,clamp(dt*(2.2+this.genome.reaction*1.4),0,1));
    this.breath += dt*(1.4+this.stress*1.8+speed/120);
    this.blink -= dt; if(this.blink<0)this.blink=2.2+Math.random()*5;
    this.bodyLean=lerp(this.bodyLean,clamp(this.ax/420,-0.32,0.32)+clamp(this.vy/900,-0.12,0.18),clamp(dt*4,0,1));
  }
}

export { TRAITS, makeGenome, genomeKey };
