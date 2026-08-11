export class RNG {
  constructor(seed=1){this.s=seed>>>0||1;}
  next(){let x=this.s;x^=x<<13;x^=x>>>17;x^=x<<5;this.s=x>>>0;return this.s/4294967296;}
  range(a,b){return a+(b-a)*this.next();}
}

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;

export class World {
  constructor(opts={}){
    this.seed=opts.seed??1337;
    this.n=opts.n??512;
    this.dx=opts.dx??6;
    this.worldH=opts.worldH??720;
    this.g=opts.g??22;
    this.rng=new RNG(this.seed);
    const n=this.n;
    this.bed=new Float32Array(n);
    this.rock=new Float32Array(n);
    this.water=new Float32Array(n);
    this.q=new Float32Array(n+1);
    this.moisture=new Float32Array(n);
    this.sediment=new Float32Array(n);
    this.nutrient=new Float32Array(n);
    this.rootStrength=new Float32Array(n);
    this.rain=0.12;
    this.wind=0;
    this.time=0;
    this.ocean=opts.ocean??true;
    this.infiltrationScale=opts.infiltrationScale??1;
    this.oceanSide='left';
    this.plants=[];
    this.creatures=[];
    this.generate();
  }
  noise1(x){
    const i=Math.floor(x),f=x-i;const a=this.hash(i),b=this.hash(i+1);const s=f*f*(3-2*f);return lerp(a,b,s);
  }
  hash(i){let x=(i*374761393 + this.seed*668265263)>>>0;x=(x^(x>>>13))*1274126177>>>0;return ((x^(x>>>16))>>>0)/4294967295;}
  fbm(x){let a=.5,f=1,s=0,n=0;for(let k=0;k<5;k++){s+=a*this.noise1(x*f);n+=a;a*=.5;f*=2.01;}return s/n;}
  generate(){
    const n=this.n,r=this.rng;
    for(let i=0;i<n;i++){
      const macro=this.fbm(i/95),detail=this.fbm(i/22);
      const basin=Math.exp(-(((i-n*.42)/(n*.19))**2))*70;
      const ridge=Math.exp(-(((i-n*.73)/(n*.1))**2))*95;
      const h=180+macro*150+detail*46-basin+ridge;
      this.bed[i]=h;this.rock[i]=h-24-r.range(0,34);this.nutrient[i]=.25+r.next()*.55;
      this.moisture[i]=.18+r.next()*.15;
    }
    for(let p=0;p<5;p++){
      const c=Math.floor(r.range(40,n-40)),rad=r.range(18,44),d=r.range(16,42);
      for(let i=Math.max(1,c-rad|0);i<Math.min(n-1,c+rad);i++){const t=(i-c)/rad;this.bed[i]-=d*(1-t*t);}
    }
    for(let i=0;i<Math.min(86,n);i++){
      const t=i/86;this.bed[i]=lerp(145,this.bed[i],t*t);this.water[i]=Math.max(0,128-this.bed[i]);
    }
    for(let p=0;p<3;p++){
      const c=Math.floor(r.range(n*.2,n*.9)),rad=Math.floor(r.range(10,24)),level=this.bed[c]+r.range(8,22);
      for(let i=Math.max(1,c-rad);i<Math.min(n-1,c+rad);i++) this.water[i]=Math.max(this.water[i],level-this.bed[i]);
    }
    this.spawnPlants(150);
    this.spawnCreatures(22);
  }
  spawnPlants(count){
    const r=this.rng,n=this.n;
    for(let k=0;k<count;k++){
      const x=Math.floor(r.range(3,n-3));
      const type=r.next()<.18?'reed':r.next()<.34?'fern':r.next()<.5?'fungus':'shrub';
      this.plants.push({x:x+r.range(-.35,.35),type,age:r.range(0,90),biomass:r.range(.2,1),water:r.range(.3,.8),energy:r.range(.2,.8),bend:0,bendV:0,seed:r.next()*9999,alive:true});
    }
  }
  spawnCreatures(count){
    const r=this.rng;
    for(let k=0;k<count;k++){
      const cx=r.range(100,this.n*this.dx-30),cy=this.surfaceY(cx)-10;
      const c={id:k+1,phase:r.next()*Math.PI*2,energy:r.range(.45,.95),hunger:r.range(.1,.7),dir:r.next()<.5?-1:1,brain:r.next()*2-1,alive:true,age:r.range(0,80),nodes:[],legs:[],mouth:{x:cx,y:cy},targetX:cx};
      for(let i=0;i<5;i++)c.nodes.push({x:cx+(i-2)*7,y:cy-Math.sin(i*.8)*2,px:cx+(i-2)*7,py:cy,m:1});
      for(let side=-1;side<=1;side+=2)for(let j=0;j<3;j++){
        const a=j+1,ax=c.nodes[a].x,ay=c.nodes[a].y;
        c.legs.push({anchor:a,side,knee:{x:ax+side*8,y:ay+7,px:ax+side*8,py:ay+7},foot:{x:ax+side*13,y:this.surfaceY(ax+side*13),px:ax+side*13,py:this.surfaceY(ax+side*13)},plant:false});
      }
      this.creatures.push(c);
    }
  }
  surfaceHeight(wx){const x=clamp(wx/this.dx,0,this.n-1.001),i=x|0,t=x-i;return lerp(this.bed[i],this.bed[i+1],t);}
  surfaceY(wx){return this.worldH-this.surfaceHeight(wx);}
  waterSurfaceY(wx){const x=clamp(wx/this.dx,0,this.n-1.001),i=x|0,t=x-i;return this.worldH-lerp(this.bed[i]+this.water[i],this.bed[i+1]+this.water[i+1],t);}
  totalWater(){let s=0;for(let i=0;i<this.n;i++)s+=this.water[i]*this.dx;return s;}
  rootAt(i){return this.rootStrength[clamp(i|0,0,this.n-1)];}
  stepHydro(dt){
    const n=this.n,dx=this.dx,g=this.g;
    this.rootStrength.fill(0);
    for(const p of this.plants){if(!p.alive)continue;const x=clamp(p.x|0,0,n-1),r=p.type==='shrub'?7:p.type==='fern'?4:3;for(let j=Math.max(0,x-r);j<=Math.min(n-1,x+r);j++){const d=Math.abs(j-x)/r;this.rootStrength[j]+=Math.max(0,1-d)*p.biomass*.55;}}
    for(let i=1;i<n-1;i++){
      const add=this.rain*dt*(.55+.45*this.hash((i+this.time*2)|0));this.water[i]+=add;
      const infil=Math.min(this.water[i],(.012+.03*(1-this.moisture[i]))*dt*60*this.infiltrationScale);
      this.water[i]-=infil;this.moisture[i]=clamp(this.moisture[i]+infil*.045,0,1);
      this.moisture[i]*=1-dt*.003;
    }
    if(this.ocean){const tide=7+Math.sin(this.time*.16)*4+Math.sin(this.time*.51)*1.5;for(let i=0;i<24;i++){const target=Math.max(0,128+tide-this.bed[i]);this.water[i]+=(target-this.water[i])*clamp(dt*2.2,0,1);}}
    for(let f=1;f<n;f++){
      const l=f-1,r=f,etaL=this.bed[l]+this.water[l],etaR=this.bed[r]+this.water[r];
      const h=Math.max(0,Math.max(etaL,etaR)-Math.max(this.bed[l],this.bed[r]));
      if(h<1e-4){this.q[f]=0;continue;}
      let q=this.q[f]*.985-g*h*(etaR-etaL)/dx*dt;
      q/=1+.012*Math.abs(q)*dt/Math.max(.2,h*h);
      const maxL=this.water[l]*dx/dt*.46,maxR=this.water[r]*dx/dt*.46;
      this.q[f]=clamp(q,-maxR,maxL);
    }
    const nw=new Float32Array(this.water);
    for(let i=1;i<n-1;i++)nw[i]=Math.max(0,this.water[i]-(this.q[i+1]-this.q[i])*dt/dx);
    this.water.set(nw);
    for(let i=2;i<n-2;i++){
      const h=this.water[i],u=h>.05?.5*(this.q[i]+this.q[i+1])/h:0;
      const shear=h*u*u*.0014,threshold=.055*(1+this.rootStrength[i]*2.4)+.025*(1-this.moisture[i]);
      if(shear>threshold&&this.bed[i]-this.rock[i]>1){const e=Math.min(.08,(shear-threshold)*dt*.35);this.bed[i]-=e;this.sediment[i]+=e;this.nutrient[i]=clamp(this.nutrient[i]+e*.002,0,1);}
      if(Math.abs(u)<.28&&this.sediment[i]>.001){const d=Math.min(this.sediment[i],dt*.012);this.sediment[i]-=d;this.bed[i]+=d;}
      if(this.sediment[i]>.0001&&Math.abs(u)>.08){const dir=u>0?1:-1,a=Math.min(this.sediment[i],this.sediment[i]*Math.abs(u)*dt*.05);this.sediment[i]-=a;this.sediment[i+dir]+=a;}
    }
  }
  stepPlants(dt){
    for(const p of this.plants){if(!p.alive)continue;const i=clamp(p.x|0,0,this.n-1),wet=this.moisture[i],nut=this.nutrient[i],light=.62+.38*Math.sin(this.time*.03+p.seed)*.15;
      const uptake=Math.min(1-p.water,wet*dt*.12*(.4+p.biomass));p.water+=uptake;this.moisture[i]=Math.max(0,this.moisture[i]-uptake*.003);
      p.water=Math.max(0,p.water-dt*(.005+.006*p.biomass));
      const photo=Math.max(0,light)*p.water*nut*dt*.045;p.energy=clamp(p.energy+photo-dt*.008*p.biomass,0,1.5);
      if(p.energy>.55&&wet>.12){const g=Math.min(.0025,p.energy*.0015)*dt*60;p.biomass=clamp(p.biomass+g,0.12,2.4);p.energy-=g*.35;}
      if(p.water<.05||p.energy<.02)p.biomass-=dt*.004;
      if(p.biomass<.08)p.alive=false;
      const gust=Math.sin(this.time*1.4+p.seed)*(.08+this.rain*.18);p.bendV+=(gust-p.bend)*dt*7;p.bendV*=Math.pow(.25,dt);p.bend+=p.bendV*dt;
      p.age+=dt;
    }
  }
  constrain(a,b,len,stiff=.8){const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,e=(d-len)/d*.5*stiff;const ox=dx*e,oy=dy*e;a.x+=ox;a.y+=oy;b.x-=ox;b.y-=oy;}
  integratePoint(p,dt,gravity=110){const vx=(p.x-p.px)*.985,vy=(p.y-p.py)*.985;p.px=p.x;p.py=p.y;p.x+=vx;p.y+=vy+gravity*dt*dt;}
  collidePoint(p){const sy=this.surfaceY(p.x);if(p.y>sy){p.y=sy;const vx=p.x-p.px;p.px=p.x-vx*.72;p.py=p.y;}}
  stepCreatures(dt){
    for(const c of this.creatures){if(!c.alive)continue;c.age+=dt;c.energy-=dt*.0022;c.hunger=clamp(c.hunger+dt*.0017,0,1);
      if(c.energy<=0){c.alive=false;continue;}
      let best=null,bd=140;for(const p of this.plants){if(!p.alive||p.biomass<.3)continue;const wx=p.x*this.dx,d=Math.abs(wx-c.nodes[2].x);if(d<bd){bd=d;best=p;}}
      if(best&&c.hunger>.35)c.targetX=best.x*this.dx;else if(Math.abs(c.targetX-c.nodes[2].x)<25||this.rng.next()<.002)c.targetX=clamp(c.nodes[2].x+this.rng.range(-180,180),15,this.n*this.dx-15);
      c.dir=Math.sign(c.targetX-c.nodes[2].x)||c.dir;c.phase+=dt*(1.2+.9*c.hunger);
      for(const n of c.nodes)this.integratePoint(n,dt,95);for(const leg of c.legs){this.integratePoint(leg.knee,dt,100);this.integratePoint(leg.foot,dt,105);}
      const drive=15*c.dir*(.35+.65*c.energy);c.nodes[0].x-=drive*dt*dt;c.nodes[4].x+=drive*dt*dt;
      for(let it=0;it<6;it++){
        for(let i=0;i<4;i++)this.constrain(c.nodes[i],c.nodes[i+1],7,.92);
        for(const leg of c.legs){const a=c.nodes[leg.anchor],phase=c.phase+leg.anchor*1.8+(leg.side>0?Math.PI:0),reach=13+Math.sin(phase)*4,tx=a.x+c.dir*reach,ty=this.surfaceY(tx);leg.plant=Math.sin(phase)<.05;if(leg.plant){leg.foot.x+=(tx-leg.foot.x)*.18;leg.foot.y+=(ty-leg.foot.y)*.22;}this.constrain(a,leg.knee,10,.88);this.constrain(leg.knee,leg.foot,10,.88);}
        for(const n of c.nodes)this.collidePoint(n);for(const leg of c.legs){this.collidePoint(leg.knee);this.collidePoint(leg.foot);}
      }
      const head=c.nodes[c.dir>0?4:0],neck=c.nodes[c.dir>0?3:1],hx=head.x+(head.x-neck.x)*.7,hy=head.y+(head.y-neck.y)*.7;c.mouth.x=hx;c.mouth.y=hy;
      if(best&&c.hunger>.25){const px=best.x*this.dx,py=this.surfaceY(px)-10*best.biomass;if(Math.hypot(hx-px,hy-py)<13){const bite=Math.min(best.biomass-.08,dt*.11);if(bite>0){best.biomass-=bite;c.energy=clamp(c.energy+bite*.28,0,1);c.hunger=clamp(c.hunger-bite*.45,0,1);}}}
      const wi=clamp((c.nodes[2].x/this.dx)|0,0,this.n-1),h=this.water[wi];if(h>3){const u=.5*(this.q[wi]+this.q[wi+1])/Math.max(.1,h);for(const n of c.nodes)n.x+=u*dt*.3;}
    }
  }
  step(dt=1/60){this.time+=dt;this.wind=Math.sin(this.time*.19)*.5+Math.sin(this.time*.047)*.3;this.stepHydro(dt);this.stepPlants(dt);this.stepCreatures(dt);}
}
