import {makeMind,senseCreature,updateMind,locomotionDemand,contactDrink,contactFeed,digest} from './alife.js';
import {solveTerrainContact,stanceTraction} from './contact-physics.js';

export class RNG {
  constructor(seed=1){this.s=seed>>>0||1;}
  next(){let x=this.s;x^=x<<13;x^=x>>>17;x^=x<<5;this.s=x>>>0;return this.s/4294967296;}
  range(a,b){return a+(b-a)*this.next();}
}

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;

export class World {
  constructor(opts={}){
    this.seed=opts.seed??1337;this.n=opts.n??512;this.dx=opts.dx??6;this.worldH=opts.worldH??720;this.g=opts.g??22;this.rng=new RNG(this.seed);
    const n=this.n;this.bed=new Float32Array(n);this.rock=new Float32Array(n);this.water=new Float32Array(n);this.q=new Float32Array(n+1);this.moisture=new Float32Array(n);this.sediment=new Float32Array(n);this.nutrient=new Float32Array(n);this.rootStrength=new Float32Array(n);
    this.rain=.12;this.wind=0;this.time=0;this.ocean=opts.ocean??true;this.infiltrationScale=opts.infiltrationScale??1;this.oceanSide='left';this.plants=[];this.creatures=[];this.generate();
  }
  noise1(x){const i=Math.floor(x),f=x-i,a=this.hash(i),b=this.hash(i+1),s=f*f*(3-2*f);return lerp(a,b,s);}
  hash(i){let x=(i*374761393+this.seed*668265263)>>>0;x=(x^(x>>>13))*1274126177>>>0;return((x^(x>>>16))>>>0)/4294967295;}
  fbm(x){let a=.5,f=1,s=0,n=0;for(let k=0;k<5;k++){s+=a*this.noise1(x*f);n+=a;a*=.5;f*=2.01;}return s/n;}
  generate(){
    const n=this.n,r=this.rng;
    for(let i=0;i<n;i++){const macro=this.fbm(i/95),detail=this.fbm(i/22),basin=Math.exp(-(((i-n*.42)/(n*.19))**2))*70,ridge=Math.exp(-(((i-n*.73)/(n*.1))**2))*95,h=180+macro*150+detail*46-basin+ridge;this.bed[i]=h;this.rock[i]=h-24-r.range(0,34);this.nutrient[i]=.25+r.next()*.55;this.moisture[i]=.18+r.next()*.15;}
    for(let p=0;p<5;p++){const c=Math.floor(r.range(40,n-40)),rad=r.range(18,44),d=r.range(16,42);for(let i=Math.max(1,c-rad|0);i<Math.min(n-1,c+rad);i++){const t=(i-c)/rad;this.bed[i]-=d*(1-t*t);}}
    for(let i=0;i<Math.min(86,n);i++){const t=i/86;this.bed[i]=lerp(145,this.bed[i],t*t);this.water[i]=Math.max(0,128-this.bed[i]);}
    for(let p=0;p<3;p++){const c=Math.floor(r.range(n*.2,n*.9)),rad=Math.floor(r.range(10,24)),level=this.bed[c]+r.range(8,22);for(let i=Math.max(1,c-rad);i<Math.min(n-1,c+rad);i++)this.water[i]=Math.max(this.water[i],level-this.bed[i]);}
    this.spawnPlants(150);this.spawnCreatures(22);
  }
  spawnPlants(count){
    const r=this.rng,n=this.n;
    for(let k=0;k<count;k++){const x=Math.floor(r.range(3,n-3)),roll=r.next(),type=roll<.18?'reed':roll<.38?'fern':roll<.55?'fungus':'shrub';this.plants.push({x:x+r.range(-.35,.35),type,age:r.range(0,90),biomass:r.range(.2,1),water:r.range(.3,.8),energy:r.range(.2,.8),bend:0,bendV:0,seed:r.next()*9999,alive:true});}
  }
  spawnCreatures(count){
    const r=this.rng;
    for(let k=0;k<count;k++){
      const cx=r.range(100,this.n*this.dx-30),cy=this.surfaceY(cx)-10,dir=r.next()<.5?-1:1;
      const c={id:k+1,phase:r.next()*Math.PI*2,energy:r.range(.52,.96),hunger:r.range(.08,.62),hydration:r.range(.52,.98),fatigue:r.range(.04,.28),health:1,dir,alive:true,gone:false,age:r.range(0,70),lifespan:r.range(170,310),nodes:[],legs:[],feelers:[],mouth:{x:cx,y:cy},targetX:cx,stomach:r.range(0,.06),corpseMass:1,deathCause:null};
      c.mind=makeMind(r,cx);
      for(let i=0;i<5;i++)c.nodes.push({x:cx+(i-2)*7,y:cy-Math.sin(i*.8)*2,px:cx+(i-2)*7,py:cy,m:1});
      for(let side=-1;side<=1;side+=2)for(let j=0;j<3;j++){const a=j+1,ax=c.nodes[a].x,ay=c.nodes[a].y,fx=ax+dir*(10+j*2)+side*3,fy=this.surfaceY(fx);c.legs.push({anchor:a,side,phaseOffset:j*(Math.PI*2/3)+(side>0?Math.PI:0),knee:{x:ax+dir*5,y:ay+7+side*1.5,px:ax+dir*5,py:ay+7+side*1.5},foot:{x:fx,y:fy,px:fx,py:fy},footMass:.55,stance:false,contactX:fx,contactPhysics:null});}
      const head=c.nodes[dir>0?4:0];for(const side of[-1,1]){const tx=head.x+dir*12,ty=head.y+side*3;c.feelers.push({side,tip:{x:tx,y:ty,px:tx,py:ty}});}this.creatures.push(c);
    }
  }
  surfaceHeight(wx){const x=clamp(wx/this.dx,0,this.n-1.001),i=x|0,t=x-i;return lerp(this.bed[i],this.bed[i+1],t);}
  surfaceY(wx){return this.worldH-this.surfaceHeight(wx);}
  waterSurfaceY(wx){const x=clamp(wx/this.dx,0,this.n-1.001),i=x|0,t=x-i;return this.worldH-lerp(this.bed[i]+this.water[i],this.bed[i+1]+this.water[i+1],t);}
  totalWater(){let s=0;for(let i=0;i<this.n;i++)s+=this.water[i]*this.dx;return s;}
  rootAt(i){return this.rootStrength[clamp(i|0,0,this.n-1)];}
  stepHydro(dt){
    const n=this.n,dx=this.dx,g=this.g;this.rootStrength.fill(0);
    for(const p of this.plants){if(!p.alive)continue;const x=clamp(p.x|0,0,n-1),r=p.type==='shrub'?7:p.type==='fern'?4:3;for(let j=Math.max(0,x-r);j<=Math.min(n-1,x+r);j++){const d=Math.abs(j-x)/r;this.rootStrength[j]+=Math.max(0,1-d)*p.biomass*.55;}}
    for(let i=1;i<n-1;i++){const add=this.rain*dt*(.55+.45*this.hash((i+this.time*2)|0));this.water[i]+=add;const infil=Math.min(this.water[i],(.012+.03*(1-this.moisture[i]))*dt*60*this.infiltrationScale);this.water[i]-=infil;this.moisture[i]=clamp(this.moisture[i]+infil*.045,0,1);this.moisture[i]*=1-dt*.003;}
    if(this.ocean){const tide=7+Math.sin(this.time*.16)*4+Math.sin(this.time*.51)*1.5;for(let i=0;i<24;i++){const target=Math.max(0,128+tide-this.bed[i]);this.water[i]+=(target-this.water[i])*clamp(dt*2.2,0,1);}}
    for(let f=1;f<n;f++){const l=f-1,r=f,etaL=this.bed[l]+this.water[l],etaR=this.bed[r]+this.water[r],h=Math.max(0,Math.max(etaL,etaR)-Math.max(this.bed[l],this.bed[r]));if(h<1e-4){this.q[f]=0;continue;}let q=this.q[f]*.985-g*h*(etaR-etaL)/dx*dt;q/=1+.012*Math.abs(q)*dt/Math.max(.2,h*h);const maxL=this.water[l]*dx/dt*.46,maxR=this.water[r]*dx/dt*.46;this.q[f]=clamp(q,-maxR,maxL);}
    const nw=new Float32Array(this.water);for(let i=1;i<n-1;i++)nw[i]=Math.max(0,this.water[i]-(this.q[i+1]-this.q[i])*dt/dx);this.water.set(nw);
    for(let i=2;i<n-2;i++){const h=this.water[i],u=h>.05?.5*(this.q[i]+this.q[i+1])/h:0,shear=h*u*u*.0014,threshold=.055*(1+this.rootStrength[i]*2.4)+.025*(1-this.moisture[i]);if(shear>threshold&&this.bed[i]-this.rock[i]>1){const e=Math.min(.08,(shear-threshold)*dt*.35);this.bed[i]-=e;this.sediment[i]+=e;this.nutrient[i]=clamp(this.nutrient[i]+e*.002,0,1);}if(Math.abs(u)<.28&&this.sediment[i]>.001){const d=Math.min(this.sediment[i],dt*.012);this.sediment[i]-=d;this.bed[i]+=d;}if(this.sediment[i]>.0001&&Math.abs(u)>.08){const dir=u>0?1:-1,a=Math.min(this.sediment[i],this.sediment[i]*Math.abs(u)*dt*.05);this.sediment[i]-=a;this.sediment[i+dir]+=a;}}
  }
  stepPlants(dt){
    for(const p of this.plants){if(!p.alive)continue;const i=clamp(p.x|0,0,this.n-1),wet=this.moisture[i],nut=this.nutrient[i],light=.62+.38*Math.sin(this.time*.03+p.seed)*.15,uptake=Math.min(1-p.water,wet*dt*.12*(.4+p.biomass));p.water+=uptake;this.moisture[i]=Math.max(0,this.moisture[i]-uptake*.003);p.water=Math.max(0,p.water-dt*(.005+.006*p.biomass));const photo=Math.max(0,light)*p.water*nut*dt*.045;p.energy=clamp(p.energy+photo-dt*.008*p.biomass,0,1.5);if(p.energy>.55&&wet>.12){const g=Math.min(.0025,p.energy*.0015)*dt*60;p.biomass=clamp(p.biomass+g,.12,2.4);p.energy-=g*.35;}if(p.water<.05||p.energy<.02)p.biomass-=dt*.004;if(p.biomass<.08)p.alive=false;const gust=Math.sin(this.time*1.4+p.seed)*(.08+this.rain*.18);p.bendV+=(gust-p.bend)*dt*7;p.bendV*=Math.pow(.25,dt);p.bend+=p.bendV*dt;p.age+=dt;}
  }
  constrain(a,b,len,stiff=.8){const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,e=(d-len)/d*.5*stiff,ox=dx*e,oy=dy*e;a.x+=ox;a.y+=oy;b.x-=ox;b.y-=oy;}
  constrainFollower(root,p,len,stiff=.82){const dx=p.x-root.x,dy=p.y-root.y,d=Math.hypot(dx,dy)||1,e=(d-len)/d*stiff;p.x-=dx*e;p.y-=dy*e;}
  integratePoint(p,dt,gravity=110,damping=.985){const vx=(p.x-p.px)*damping,vy=(p.y-p.py)*damping;p.px=p.x;p.py=p.y;p.x+=vx;p.y+=vy+gravity*dt*dt;}
  collidePoint(p,dt=1/60){return solveTerrainContact(this,p,dt,{restitution:0});}
  updateMouthAndFeelers(c,dt){const head=c.nodes[c.dir>0?4:0],neck=c.nodes[c.dir>0?3:1],hx=head.x+(head.x-neck.x)*.78,hy=head.y+(head.y-neck.y)*.78;c.mouth.x=hx;c.mouth.y=hy;for(const f of c.feelers){const tip=f.tip;this.integratePoint(tip,dt,10,.94);const wiggle=Math.sin(c.mind.senseSweep+f.side*1.8)*2.2,tx=head.x+c.dir*(12+2*c.mind.curiosity),ty=head.y+f.side*(3.5+wiggle);tip.x+=(tx-tip.x)*.12;tip.y+=(ty-tip.y)*.12;this.constrainFollower(head,tip,12.5,.86);this.collidePoint(tip,dt);}}
  stepCorpse(c,dt){
    for(const n of c.nodes)this.integratePoint(n,dt,105,.992);for(const leg of c.legs){this.integratePoint(leg.knee,dt,108,.992);this.integratePoint(leg.foot,dt,110,.992);}for(const f of c.feelers)this.integratePoint(f.tip,dt,80,.99);
    for(let it=0;it<4;it++){for(let i=0;i<4;i++)this.constrain(c.nodes[i],c.nodes[i+1],7,.72);for(const leg of c.legs){const a=c.nodes[leg.anchor];this.constrain(a,leg.knee,10,.62);this.constrain(leg.knee,leg.foot,10,.62);}for(const f of c.feelers){const head=c.nodes[c.dir>0?4:0];this.constrainFollower(head,f.tip,12.5,.55);}for(const n of c.nodes)this.collidePoint(n,dt);for(const leg of c.legs){this.collidePoint(leg.knee,dt);this.collidePoint(leg.foot,dt);}for(const f of c.feelers)this.collidePoint(f.tip,dt);}
    const i=clamp((c.nodes[2].x/this.dx)|0,0,this.n-1),wet=this.moisture[i],decay=Math.min(c.corpseMass,dt*(.0012+.0042*wet));c.corpseMass-=decay;this.nutrient[i]=clamp(this.nutrient[i]+decay*.32,0,1);this.moisture[i]=clamp(this.moisture[i]+decay*.006,0,1);if(c.corpseMass<.025)c.gone=true;
  }
  stepCreatures(dt){
    for(const c of this.creatures){
      if(c.gone)continue;if(!c.alive){this.stepCorpse(c,dt);continue;}c.age+=dt;
      const sense=senseCreature(this,c),intent=updateMind(this,c,dt,sense),demand=locomotionDemand(c);
      c.energy=Math.max(0,c.energy-dt*(.00115+demand*.00115));c.hydration=Math.max(0,c.hydration-dt*(.00125+demand*.00105+(this.rain<.02?.00025:0)));c.hunger=clamp(c.hunger+dt*(.0012+demand*.00045),0,1);c.fatigue=clamp(c.fatigue+dt*(demand*.027-(intent==='rest'?.085:.012)),0,1);digest(c,dt);
      if(c.energy<=.012||c.hydration<=.018||c.health<=0||c.age>c.lifespan){c.alive=false;c.deathCause=c.energy<=.012?'starvation':c.hydration<=.018?'dehydration':c.health<=0?'injury':'age';c.corpseMass=.7+c.stomach+c.energy*.4+c.hydration*.2;continue;}
      const delta=c.targetX-c.nodes[2].x;if(Math.abs(delta)>7)c.dir=Math.sign(delta)||c.dir;c.phase+=dt*(.42+demand*1.55);
      for(const n of c.nodes)this.integratePoint(n,dt,92,.986);for(const leg of c.legs){this.integratePoint(leg.knee,dt,98,.982);this.integratePoint(leg.foot,dt,102,.978);}const body=c.nodes[2];body.y-=Math.sin(this.time*1.8+c.id)*(.25+.3*(1-c.fatigue))*dt*dt*18;
      for(const leg of c.legs){const a=c.nodes[leg.anchor],ph=c.phase+leg.phaseOffset,s=Math.sin(ph);if(intent==='rest'){if(!leg.stance){leg.stance=true;leg.contactX=leg.foot.x;}}else{if(!leg.stance&&s<-.18){leg.stance=true;leg.contactX=leg.foot.x;}if(leg.stance&&s>.52)leg.stance=false;}if(leg.stance){const tx=leg.contactX,ty=this.surfaceY(tx);leg.foot.x+=(tx-leg.foot.x)*.34;leg.foot.y+=(ty-leg.foot.y)*.42;if(Math.abs(leg.foot.y-ty)<2.4&&demand>0){const traction=stanceTraction(this,c,leg,demand,dt,{gravity:110,muscleForce:54});leg.contactPhysics=traction;if(traction.slipping)leg.contactX+=c.dir*traction.slipRatio*dt*9;}else leg.contactPhysics=null;}else{leg.contactPhysics=null;const lift=Math.max(0,Math.sin(ph))*7,tx=a.x+c.dir*(13+demand*9),ty=this.surfaceY(tx)-lift;leg.foot.x+=(tx-leg.foot.x)*(.12+demand*.06);leg.foot.y+=(ty-leg.foot.y)*(.15+demand*.06);}}
      for(let it=0;it<7;it++){for(let i=0;i<4;i++)this.constrain(c.nodes[i],c.nodes[i+1],7,.93);for(const leg of c.legs){const a=c.nodes[leg.anchor];this.constrain(a,leg.knee,10,.9);this.constrain(leg.knee,leg.foot,10,.9);}for(const n of c.nodes)this.collidePoint(n,dt);for(const leg of c.legs){this.collidePoint(leg.knee,dt);this.collidePoint(leg.foot,dt);}}
      if(intent==='drink'&&Math.abs(c.targetX-c.nodes[2].x)<25){const head=c.nodes[c.dir>0?4:0],wy=this.waterSurfaceY(c.targetX);head.y+=(wy-head.y)*.035;}
      if(intent==='forage'&&sense.food&&sense.foodDistance<24){const head=c.nodes[c.dir>0?4:0],px=sense.food.x*this.dx,py=this.surfaceY(px)-Math.min(24,7+sense.food.biomass*10);head.x+=(px-head.x)*.025;head.y+=(py-head.y)*.025;}
      this.updateMouthAndFeelers(c,dt);contactDrink(this,c,dt);contactFeed(this,c,sense.food,dt);
      const wi=clamp((c.nodes[2].x/this.dx)|0,0,this.n-1),h=this.water[wi];if(h>2){const u=.5*(this.q[wi]+this.q[wi+1])/Math.max(.1,h),sub=clamp(h/14,0,1);for(const n of c.nodes){const vx=n.x-n.px;n.px=n.x-(vx*(1-.08*sub)+u*dt*.22*sub);n.y-=sub*.08;}if(Math.abs(u)>3.2)c.mind.fear=clamp(c.mind.fear+dt*.18,0,1);}
    }
  }
  step(dt=1/60){this.time+=dt;this.wind=Math.sin(this.time*.19)*.5+Math.sin(this.time*.047)*.3;this.stepHydro(dt);this.stepPlants(dt);this.stepCreatures(dt);}
}
