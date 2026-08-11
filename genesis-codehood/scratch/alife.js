const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function makeMind(rng,x){
  return {
    intent:'explore',intentAge:0,commitFor:rng.range(.8,2.8),targetX:x,
    curiosity:rng.range(.3,.9),caution:rng.range(.2,.85),social:rng.range(.15,.75),
    stress:rng.range(0,.12),fear:rng.range(0,.12),senseSweep:rng.range(0,Math.PI*2),
    memory:{foodX:x,foodC:0,waterX:x,waterC:0,dangerX:x,dangerC:0},
    lastSense:{food:false,water:false,danger:false}
  };
}

export function terrainLOS(world,ax,ay,bx,by){
  const steps=Math.max(3,Math.min(14,Math.ceil(Math.abs(bx-ax)/18)));
  for(let s=1;s<steps;s++){
    const t=s/steps,x=ax+(bx-ax)*t,y=ay+(by-ay)*t;
    if(world.surfaceY(x)<y-2)return false;
  }
  return true;
}

export function senseCreature(world,c){
  const body=c.nodes[2],range=175,head=c.nodes[c.dir>0?4:0];
  let food=null,fd=range;
  for(const p of world.plants){
    if(!p.alive||p.biomass<.16)continue;
    const x=p.x*world.dx,d=Math.abs(x-body.x);if(d>=fd)continue;
    const py=world.surfaceY(x)-Math.min(28,8+p.biomass*12);
    if(terrainLOS(world,head.x,head.y,x,py)){food=p;fd=d;}
  }
  let water=null,wd=range;
  const ci=clamp((body.x/world.dx)|0,1,world.n-2),rad=Math.min(34,Math.ceil(range/world.dx));
  for(let i=Math.max(1,ci-rad);i<=Math.min(world.n-2,ci+rad);i++){
    const h=world.water[i];if(h<1.2||h>18)continue;
    const x=i*world.dx,d=Math.abs(x-body.x);if(d>=wd)continue;
    const wy=world.waterSurfaceY(x);if(terrainLOS(world,head.x,head.y,x,wy)){water={i,x,y:wy,depth:h};wd=d;}
  }
  const h=world.water[ci],u=h>.05?.5*(world.q[ci]+world.q[ci+1])/h:0;
  const danger=Math.abs(u)>3.2?{x:body.x,kind:'fast_water',strength:clamp(Math.abs(u)/8,0,1)}:null;
  return {food,foodDistance:fd,water,waterDistance:wd,danger};
}

function remember(m,key,x,gain){
  m[key+'X']=x;m[key+'C']=clamp(m[key+'C']+gain,0,1);
}

export function updateMind(world,c,dt,sense){
  const m=c.mind;m.intentAge+=dt;m.senseSweep+=dt*(.7+m.curiosity*1.4+m.fear*1.6);
  m.memory.foodC=Math.max(0,m.memory.foodC-dt*.018);
  m.memory.waterC=Math.max(0,m.memory.waterC-dt*.012);
  m.memory.dangerC=Math.max(0,m.memory.dangerC-dt*.03);
  if(sense.food){remember(m.memory,'food',sense.food.x*world.dx,.22);m.lastSense.food=true;}else m.lastSense.food=false;
  if(sense.water){remember(m.memory,'water',sense.water.x,.18);m.lastSense.water=true;}else m.lastSense.water=false;
  if(sense.danger){remember(m.memory,'danger',sense.danger.x,.34);m.fear=clamp(m.fear+sense.danger.strength*dt*.9,0,1);m.stress=clamp(m.stress+dt*.25,0,1);m.lastSense.danger=true;}else{m.fear=Math.max(0,m.fear-dt*.07);m.stress=Math.max(0,m.stress-dt*.045);m.lastSense.danger=false;}

  const thirst=1-c.hydration,urgentFear=m.fear>.62||m.stress>.78;
  let desired=m.intent,target=m.targetX;
  if(urgentFear&&m.memory.dangerC>.05){desired='flee';target=clamp(c.nodes[2].x+Math.sign(c.nodes[2].x-m.memory.dangerX||c.dir)*180,12,world.n*world.dx-12);}
  else if(thirst>.48){desired='drink';target=sense.water?.x??(m.memory.waterC>.08?m.memory.waterX:target);}
  else if(c.hunger>.48||c.energy<.38){desired='forage';target=sense.food? sense.food.x*world.dx : (m.memory.foodC>.08?m.memory.foodX:target);}
  else if(c.fatigue>.72){desired='rest';target=c.nodes[2].x;}
  else if(m.intentAge>=m.commitFor){desired=m.curiosity>.28?'explore':'rest';target=clamp(c.nodes[2].x+world.rng.range(-190,190),12,world.n*world.dx-12);}

  const emergency=desired==='flee'||(desired==='drink'&&thirst>.72)||(desired==='forage'&&c.energy<.18);
  if(desired!==m.intent&&(emergency||m.intentAge>=m.commitFor)){
    m.intent=desired;m.intentAge=0;m.commitFor=world.rng.range(desired==='rest'?1.2:.8,desired==='explore'?3.6:2.8);
  }
  if(m.intent===desired)m.targetX=target;
  c.targetX=m.targetX;
  return m.intent;
}

export function locomotionDemand(c){
  const m=c.mind;
  const speed=m.intent==='flee'?1.35:m.intent==='forage'?0.82:m.intent==='drink'?0.62:m.intent==='explore'?0.52:0;
  const bodyFactor=clamp(Math.min(c.energy/.28,c.hydration/.3)*(1-c.fatigue*.55)*(1-m.stress*.28),0,.98);
  return speed*bodyFactor;
}

export function contactDrink(world,c,dt){
  if(c.mind.intent!=='drink')return 0;
  const i=clamp((c.mouth.x/world.dx)|0,0,world.n-1),h=world.water[i];if(h<1.1)return 0;
  const wy=world.waterSurfaceY(c.mouth.x);if(Math.abs(c.mouth.y-wy)>12)return 0;
  const take=Math.min(h,.13*dt*60,1-c.hydration);if(take<=0)return 0;
  c.hydration=clamp(c.hydration+take*.12,0,1);world.water[i]=Math.max(0,world.water[i]-take*.02);c.mind.memory.waterX=c.mouth.x;c.mind.memory.waterC=1;return take;
}

export function digest(c,dt){
  if(c.stomach<=0)return 0;
  const rate=.028*(.45+.55*c.hydration)*(1-c.mind.stress*.35),d=Math.min(c.stomach,rate*dt);
  c.stomach-=d;c.energy=clamp(c.energy+d*.78,0,1);c.hunger=clamp(c.hunger-d*.95,0,1);return d;
}

export const ALIFE_META={
  controller:'limited sensing + decaying memory + persistent drive arbitration',
  learning:false,
  stomachDigestion:true,
  directPlantCalories:false,
  authoredGait:true
};
