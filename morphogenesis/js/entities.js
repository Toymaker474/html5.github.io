// ---------------- drifting plankton ----------------
class Food{
  constructor(x=rand(CFG.WORLD_W),y=rand(CFG.WORLD_H)){
    this.x=x;this.y=y;this.vx=rand(-.08,.08);this.vy=rand(-.08,.08);
    this.energy=rand(7,19);this.dead=false;this.capturedBy=null;
  }
  update(dt){
    if(this.capturedBy&&!this.capturedBy.dead)return;
    this.capturedBy=null;
    const c=currentAt(this.x,this.y);
    this.vx=(this.vx+c.x)*.992;this.vy=(this.vy+c.y)*.992;
    this.x+=this.vx*60*dt;this.y+=this.vy*60*dt;wrap(this);
  }
  draw(){
    const p=ws(this.x,this.y);
    ctx.fillStyle='rgba(175,255,220,.82)';
    ctx.beginPath();ctx.arc(p.x,p.y,Math.max(1,1.7*cam.z),0,TAU);ctx.fill();
  }
}

// ---------------- edible remains: predators must bite these to gain energy ----------------
class Carcass{
  constructor(c){
    this.x=c.x;this.y=c.y;this.vx=c.vx*.25;this.vy=c.vy*.25;
    this.energy=18+c.g.segmentSize*c.g.segments*.9;
    this.size=Math.max(5,c.g.segmentSize*.8);this.hue=c.g.hue;this.dead=false;this.age=0;
  }
  update(dt){
    this.age+=dt;
    const cur=currentAt(this.x,this.y);
    this.vx=(this.vx+cur.x*.15)*.986;this.vy=(this.vy+cur.y*.15)*.986;
    this.x+=this.vx*60*dt;this.y+=this.vy*60*dt;wrap(this);
    this.energy-=dt*.08;
    if(this.energy<=.2||this.age>150)this.dead=true;
  }
  takeChunk(amount){
    const q=Math.min(this.energy,amount);this.energy-=q;if(this.energy<=.2)this.dead=true;return q;
  }
  draw(){
    const p=ws(this.x,this.y),r=Math.max(1,this.size*cam.z);
    ctx.fillStyle=`hsla(${this.hue},35%,42%,.26)`;
    ctx.beginPath();ctx.ellipse(p.x,p.y,r*1.3,r*.55,0,0,TAU);ctx.fill();
  }
}

class Creature{
  constructor(g=null,b=null){
    this.g=g||new Gene();this.b=b||new Brain();
    this.x=rand(CFG.WORLD_W);this.y=rand(CFG.WORLD_H);
    this.angle=rand(TAU);this.turnVel=0;this.vx=Math.cos(this.angle)*rand(.15,.6);this.vy=Math.sin(this.angle)*rand(.15,.6);
    this.energy=112;this.health=1;this.age=0;this.dead=false;this.kids=0;this.eaten=0;this.lineage=0;
    this.phase=rand(TAU);this.cool=rand(1,4);this.stomach=0;

    this.mouthOpen=0;this.biteTimer=0;this.biteApplied=false;this.biteCooldown=0;
    this.heldFood=null;this.swallowT=0;this.stroke=0;

    this.spine=[];this.rebuildSpine();
  }

  rebuildSpine(){
    this.spine=Array.from({length:this.g.segments},(_,i)=>({
      x:-i*this.g.segmentSize*.78,y:0,vx:0,vy:0
    }));
  }

  fitness(){return this.age+this.kids*36+this.eaten*4+this.health*10+this.lineage*.3}

  nearestFood(){
    let best=null,bd=this.g.sensor*this.g.sensor;
    for(const f of foods){
      if(f.dead||f.capturedBy)continue;
      const dx=f.x-this.x,dy=f.y-this.y,d=dx*dx+dy*dy;
      if(d<bd){bd=d;best=f}
    }
    return best;
  }

  nearestCarcass(){
    let best=null,bd=this.g.sensor*this.g.sensor;
    for(const c of carcasses){
      if(c.dead)continue;
      const dx=c.x-this.x,dy=c.y-this.y,d=dx*dx+dy*dy;
      if(d<bd){bd=d;best=c}
    }
    return best;
  }

  nearestCreature(){
    let best=null,bd=this.g.sensor*this.g.sensor;
    for(const c of nearbyLife(this,this.g.sensor)){
      const dx=c.x-this.x,dy=c.y-this.y,d=dx*dx+dy*dy;
      if(d<bd){bd=d;best=c}
    }
    return best;
  }

  mouthWorld(){
    const reach=this.g.segmentSize*this.g.head*(.85+.35*this.g.snout);
    return{x:this.x+Math.cos(this.angle)*reach,y:this.y+Math.sin(this.angle)*reach};
  }

  startBite(){
    if(this.biteCooldown>0||this.biteTimer>0)return;
    this.biteTimer=.34/this.g.biteSpeed;
    this.biteApplied=false;
  }

  updateMouth(dt,target){
    this.biteCooldown=Math.max(0,this.biteCooldown-dt);

    if(target&&target.m<this.g.segmentSize*2.5&&this.biteCooldown<=0&&this.biteTimer<=0)this.startBite();

    if(this.biteTimer>0){
      const total=.34/this.g.biteSpeed;
      const t=this.biteTimer/total;
      if(t>.55)this.mouthOpen=clamp((1-t)/.45,0,1);
      else if(t>.30)this.mouthOpen=1;
      else this.mouthOpen=clamp(t/.30,0,1);

      if(!this.biteApplied&&t<.28){
        this.biteApplied=true;
        this.performBite();
      }

      this.biteTimer-=dt;
      if(this.biteTimer<=0){
        this.biteTimer=0;this.mouthOpen=0;this.biteCooldown=.22/this.g.biteSpeed;
      }
    }else{
      this.mouthOpen=lerp(this.mouthOpen,0,.25);
    }

    if(this.heldFood){
      this.swallowT+=dt*(1.7+this.g.metabolism*.35);
      const m=this.mouthWorld();
      const gutX=this.x-Math.cos(this.angle)*this.g.segmentSize*.35;
      const gutY=this.y-Math.sin(this.angle)*this.g.segmentSize*.35;
      const t=clamp(this.swallowT,0,1);
      this.heldFood.x=lerp(m.x,gutX,t);
      this.heldFood.y=lerp(m.y,gutY,t);
      if(t>=1){
        this.stomach+=this.heldFood.energy;
        this.heldFood.dead=true;
        this.heldFood.capturedBy=null;
        this.heldFood=null;
        this.swallowT=0;this.eaten++;swallows++;
        soundEvent('eat',.05);
      }
    }
  }

  performBite(){
    const m=this.mouthWorld();
    const reach=this.g.segmentSize*(.7+.55*this.g.mouthReach);

    if(!this.heldFood&&this.g.carnivore<.86){
      let best=null,bd=reach*reach;
      for(const f of foods){
        if(f.dead||f.capturedBy)continue;
        const dx=f.x-m.x,dy=f.y-m.y,d=dx*dx+dy*dy;
        if(d<bd){bd=d;best=f}
      }
      if(best){
        best.capturedBy=this;this.heldFood=best;this.swallowT=0;bites++;
        return;
      }
    }

    if(this.g.carnivore>.42){
      let body=null,bd=reach*reach;
      for(const c of carcasses){
        if(c.dead)continue;
        const dx=c.x-m.x,dy=c.y-m.y,d=dx*dx+dy*dy;
        if(d<bd){bd=d;body=c}
      }
      if(body){
        this.stomach+=body.takeChunk(5+this.g.jaw*8);bites++;soundEvent('eat',.045);return;
      }
    }

    if(this.g.carnivore>.58&&this.g.jaw>.12){
      let victim=null,bd=reach*reach;
      for(const c of nearbyLife(this,reach*1.3)){
        const dx=c.x-m.x,dy=c.y-m.y,d=dx*dx+dy*dy;
        if(d<bd){bd=d;victim=c}
      }
      if(victim){
        const sizeRatio=(this.g.segmentSize*this.g.segments)/(victim.g.segmentSize*victim.g.segments);
        const dmg=(7+this.g.jaw*10+this.g.venom*5)*clamp(sizeRatio,.45,1.6)*(1-victim.g.armor*.58);
        victim.health-=dmg/100;bites++;soundEvent('kill',.045);
        if(victim.health<=0)victim.die('predation');
      }
    }
  }

  die(){
    if(this.dead)return;
    this.dead=true;deaths++;
    if(carcasses.length<CFG.MAX_CARCASSES)carcasses.push(new Carcass(this));
  }

  updateSpine(){
    if(this.spine.length!==this.g.segments)this.rebuildSpine();
    this.spine[0].x=0;this.spine[0].y=0;

    const speed=Math.hypot(this.vx,this.vy);
    const amp=this.g.flex*this.g.segmentSize*clamp(speed/2.5,.18,1);
    for(let i=1;i<this.spine.length;i++){
      const prev=this.spine[i-1],p=this.spine[i];
      const rest=this.g.segmentSize*.78*Math.pow(this.g.taper,i*.04);
      const tx=prev.x-rest;
      const wave=Math.sin(this.phase*this.g.finBeat-i*.72)*amp*(i/Math.max(1,this.spine.length-1));
      const ty=wave+this.turnVel*i*this.g.segmentSize*.8;

      p.vx+=(tx-p.x)*(.13+.12*this.g.flex);
      p.vy+=(ty-p.y)*(.11+.15*this.g.flex);
      p.vx*=.72;p.vy*=.72;p.x+=p.vx;p.y+=p.vy;
    }
  }

  update(dt){
    this.age+=dt;this.cool-=dt;
    const speed=Math.hypot(this.vx,this.vy);
    this.phase+=dt*(2.0+this.g.finBeat*3.1+speed*.35);

    if(this.stomach>0){
      const dig=Math.min(this.stomach,dt*(2.2+this.g.metabolism*1.4));
      this.stomach-=dig;this.energy+=dig*.72;
    }

    const f=this.nearestFood();
    const carr=this.g.carnivore>.4?this.nearestCarcass():null;
    const other=this.nearestCreature();

    const df=f?norm(f.x-this.x,f.y-this.y):{x:0,y:0,m:999};
    const dcar=carr?norm(carr.x-this.x,carr.y-this.y):{x:0,y:0,m:999};
    const dc=other?norm(other.x-this.x,other.y-this.y):{x:0,y:0,m:999};

    const inp=[
      df.x,df.y,clamp(df.m/this.g.sensor,0,1),
      dc.x,dc.y,clamp(dc.m/this.g.sensor,0,1),
      this.energy/180,this.health,this.g.carnivore,this.g.aggression,
      depthLight(this.y),Math.sin(this.phase)
    ];
    const o=this.b.act(inp);

    let sx=o[0],sy=o[1];

    if(f&&this.g.carnivore<.72){sx+=df.x*(.25+.35*(1-this.g.carnivore));sy+=df.y*(.25+.35*(1-this.g.carnivore))}
    if(carr&&this.g.carnivore>.4){sx+=dcar.x*.46*this.g.carnivore;sy+=dcar.y*.46*this.g.carnivore}

    if(other){
      const threatening=other.g.carnivore>.6&&other.g.aggression>.45;
      if(this.g.carnivore>.58&&this.g.aggression>.38){
        sx+=dc.x*(.38+.48*this.g.aggression);sy+=dc.y*(.38+.48*this.g.aggression);
      }else if(threatening){
        sx-=dc.x*(.48+.35*(1-this.g.armor));sy-=dc.y*(.48+.35*(1-this.g.armor));
      }else if(this.g.schooling>.5){
        sx+=dc.x*.12*this.g.schooling;sy+=dc.y*.12*this.g.schooling;
      }
    }

    if(Math.hypot(sx,sy)>.001){
      const desired=Math.atan2(sy,sx);
      const delta=angleDelta(this.angle,desired);
      this.turnVel=lerp(this.turnVel,clamp(delta,-.5,.5)*(.08+.08*this.g.flex),.18);
    }else this.turnVel*=.9;
    this.angle+=this.turnVel;

    this.stroke=.5+.5*Math.sin(this.phase*this.g.finBeat);
    const neuralThrust=(o[2]+1)*.5;
    const thrust=(.018+.105*neuralThrust*this.g.muscle)*(.35+.65*this.stroke);
    this.vx+=Math.cos(this.angle)*thrust;
    this.vy+=Math.sin(this.angle)*thrust;

    const cur=currentAt(this.x,this.y);
    this.vx+=cur.x;this.vy+=cur.y;

    const bodyMass=this.g.segmentSize*this.g.segments*(1+.45*this.g.armor);
    const drag=.989-Math.min(.014,bodyMass*.000075);
    this.vx*=drag;this.vy*=drag;

    const vmax=1.35+this.g.muscle*1.55;
    const vm=Math.hypot(this.vx,this.vy)||1;
    if(vm>vmax){this.vx=this.vx/vm*vmax;this.vy=this.vy/vm*vmax}

    this.x+=this.vx*60*dt;this.y+=this.vy*60*dt;wrap(this);
    this.updateSpine();

    const mouthTarget=this.g.carnivore>.55
      ? (other&&this.g.aggression>.38?dc:(carr?dcar:df))
      : df;
    this.updateMouth(dt,mouthTarget);

    const cost=dt*(.42+this.g.metabolism*.55+this.g.muscle*.13+this.g.armor*.17+
      this.g.sensor*.0006+this.g.limbs*.012+this.g.fins*.009);
    this.energy-=cost;

    if(this.health<1)this.health=clamp(this.health+dt*.008*this.g.regen,0,1);

    const reproduce=(o[5]+1)*.5;
    if(this.energy>176&&this.cool<=0&&creatures.length<CFG.MAX_POP&&reproduce>.46){
      const child=new Creature(mutateGene(this.g),mutateBrain(this.b));
      child.x=this.x-Math.cos(this.angle)*this.g.segmentSize;
      child.y=this.y-Math.sin(this.angle)*this.g.segmentSize;
      child.angle=this.angle+rand(-.6,.6);wrap(child);
      child.lineage=this.lineage+1;child.energy=76;
      creatures.push(child);this.energy*=.62;this.cool=5;this.kids++;births++;soundEvent('birth',.04);
    }

    if(this.energy<=0||this.health<=0||this.age>155+rand(45))this.die();
  }

  draw(){
    const g=this.g,p=ws(this.x,this.y),z=cam.z;
    if(z<.08){ctx.fillStyle=`hsla(${g.hue},88%,70%,.86)`;ctx.fillRect(p.x,p.y,1.4,1.4);return}

    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(this.angle);
    const S=g.segmentSize*z;

    const top=[],bottom=[];
    for(let i=0;i<this.spine.length;i++){
      const q=this.spine[i],prev=this.spine[Math.max(0,i-1)],next=this.spine[Math.min(this.spine.length-1,i+1)];
      const dx=next.x-prev.x,dy=next.y-prev.y,ln=Math.hypot(dx,dy)||1;
      const nx=-dy/ln,ny=dx/ln;
      const taper=Math.pow(g.taper,i);
      const width=S*taper*g.bodyDepth*(i===0?g.head:.92);
      top.push({x:q.x*z+nx*width,y:q.y*z+ny*width});
      bottom.push({x:q.x*z-nx*width,y:q.y*z-ny*width});
    }

    ctx.shadowBlur=Math.min(20,S*1.7);
    ctx.shadowColor=`hsla(${g.hue},95%,65%,${.18*g.glow})`;
    const grad=ctx.createLinearGradient(S,0,-S*this.spine.length*.75,0);
    grad.addColorStop(0,`hsla(${g.hue-6},82%,60%,.67)`);
    grad.addColorStop(.55,`hsla(${g.hue+g.bodyHue},75%,54%,.48)`);
    grad.addColorStop(1,`hsla(${g.hue+12},70%,46%,.34)`);
    ctx.fillStyle=grad;
    ctx.beginPath();
    ctx.moveTo(S*g.head*g.snout,0);
    for(const q of top)ctx.lineTo(q.x,q.y);
    for(let i=bottom.length-1;i>=0;i--)ctx.lineTo(bottom[i].x,bottom[i].y);
    ctx.closePath();ctx.fill();
    ctx.shadowBlur=0;

    ctx.strokeStyle=`hsla(${g.hue+20},90%,82%,.12)`;
    ctx.lineWidth=Math.max(.45,z);
    for(let i=1;i<this.spine.length;i++){
      const q=this.spine[i],r=S*Math.pow(g.taper,i)*g.bodyDepth*.72;
      ctx.beginPath();ctx.moveTo(q.x*z,q.y*z-r);ctx.lineTo(q.x*z,q.y*z+r);ctx.stroke();
    }

    ctx.fillStyle=`hsla(${g.hue+24},82%,68%,.27)`;
    for(let i=0;i<g.fins;i++){
      const idx=clamp(1+Math.floor((i+1)*(this.spine.length-1)/(g.fins+1)),1,this.spine.length-1);
      const q=this.spine[idx],r=S*Math.pow(g.taper,idx)*g.finSize;
      const side=i%2?1:-1;
      const beat=.78+.22*Math.sin(this.phase*g.finBeat+i);
      ctx.beginPath();ctx.moveTo(q.x*z,q.y*z);
      ctx.quadraticCurveTo(q.x*z-r*.2,q.y*z+side*r*beat,q.x*z-r*1.15,q.y*z+side*r*.55*beat);
      ctx.quadraticCurveTo(q.x*z-r*.48,q.y*z+side*r*.16,q.x*z,q.y*z);ctx.fill();
    }

    ctx.strokeStyle=`hsla(${g.hue+32},86%,72%,.44)`;ctx.lineWidth=Math.max(.7,1.05*z);
    for(let i=0;i<g.limbs;i++){
      const pair=(i>>1),pairs=Math.max(1,Math.ceil(g.limbs/2));
      const idx=clamp(1+Math.floor((pair+1)*(this.spine.length-1)/(pairs+1)),1,this.spine.length-1);
      const q=this.spine[idx],side=i%2?1:-1,L=S*g.limbLength;
      const stroke=Math.sin(this.phase*g.finBeat+i*.7);
      const a=side*(.68+.20*stroke);
      const kx=q.x*z+Math.cos(a)*L*.55,ky=q.y*z+Math.sin(a)*L*.55;
      const ex=kx+Math.cos(a+side*.58)*L*.52,ey=ky+Math.sin(a+side*.58)*L*.52;
      ctx.beginPath();ctx.moveTo(q.x*z,q.y*z);ctx.lineTo(kx,ky);ctx.lineTo(ex,ey);ctx.stroke();
    }

    if(this.spine.length){
      const q=this.spine[this.spine.length-1],r=S*g.tail;
      ctx.fillStyle=`hsla(${g.hue+16},82%,65%,.28)`;
      ctx.beginPath();ctx.moveTo(q.x*z,q.y*z);
      ctx.lineTo(q.x*z-r*1.15,q.y*z-r*.65);
      ctx.lineTo(q.x*z-r*1.55,q.y*z);
      ctx.lineTo(q.x*z-r*1.15,q.y*z+r*.65);
      ctx.closePath();ctx.fill();
    }

    const H=S*g.head;
    ctx.fillStyle=`hsla(${g.hue-7},82%,59%,.72)`;
    ctx.beginPath();ctx.ellipse(H*.12,0,H,H*g.bodyDepth*.83,0,0,TAU);ctx.fill();

    const eyeN=Math.min(4,g.eyes);
    for(let i=0;i<eyeN;i++){
      const yy=(i-(eyeN-1)/2)*H*.22;
      ctx.fillStyle='rgba(225,250,255,.94)';
      ctx.beginPath();ctx.arc(H*.48,yy,Math.max(1,1.35*z*g.eyeSize),0,TAU);ctx.fill();
      ctx.fillStyle='rgba(8,18,27,.95)';
      ctx.beginPath();ctx.arc(H*.52,yy,Math.max(.5,.55*z*g.eyeSize),0,TAU);ctx.fill();
    }

    if(g.jaw>.04){
      const hingeX=H*.48,tip=H*(.82+.38*g.snout),jawA=this.mouthOpen*g.gape*.42;
      ctx.strokeStyle='rgba(255,135,150,.72)';ctx.lineWidth=Math.max(.8,1.1*z);
      ctx.save();ctx.translate(hingeX,0);
      ctx.rotate(-jawA);
      ctx.beginPath();ctx.moveTo(0,-H*.08);ctx.lineTo(tip-hingeX,-H*.14);ctx.stroke();
      ctx.restore();
      ctx.save();ctx.translate(hingeX,0);
      ctx.rotate(jawA);
      ctx.beginPath();ctx.moveTo(0,H*.08);ctx.lineTo(tip-hingeX,H*.14);ctx.stroke();
      ctx.restore();

      ctx.fillStyle=`rgba(45,4,18,${.18+.45*this.mouthOpen})`;
      ctx.beginPath();ctx.moveTo(hingeX,0);
      ctx.lineTo(tip,-Math.sin(jawA)*H*.8-H*.05);
      ctx.lineTo(tip,Math.sin(jawA)*H*.8+H*.05);ctx.closePath();ctx.fill();
    }

    ctx.strokeStyle=`hsla(${g.hue+45},95%,80%,.3)`;
    for(let i=0;i<g.whiskers;i++){
      const yy=(i-(g.whiskers-1)/2)*H*.16;
      ctx.beginPath();ctx.moveTo(H*.72,yy);
      ctx.bezierCurveTo(H*1.15,yy,H*1.5,yy+Math.sin(this.phase+i)*S*.2,H*(1.7+g.sensor/600),yy*.8);
      ctx.stroke();
    }

    if(g.armor>.3){
      ctx.strokeStyle=`rgba(225,250,255,${.08+.2*g.armor})`;
      ctx.lineWidth=Math.max(.6,z);
      for(let i=1;i<this.spine.length-1;i+=2){
        const q=this.spine[i],r=S*Math.pow(g.taper,i)*g.bodyDepth*.8;
        ctx.beginPath();ctx.arc(q.x*z,q.y*z,r,-1.1,1.1);ctx.stroke();
      }
    }
    if(g.spines){
      ctx.fillStyle=`hsla(${g.hue-18},82%,70%,.42)`;
      for(let i=1;i<=g.spines;i++){
        const idx=clamp(Math.floor(i*(this.spine.length-1)/(g.spines+1)),1,this.spine.length-1);
        const q=this.spine[idx],r=S*Math.pow(g.taper,idx)*g.bodyDepth;
        ctx.beginPath();ctx.moveTo(q.x*z,q.y*z-r*.65);ctx.lineTo(q.x*z-r*.45,q.y*z-r*1.35);ctx.lineTo(q.x*z-r*.55,q.y*z-r*.5);ctx.closePath();ctx.fill();
      }
    }

    ctx.restore();
  }
}

function burst(x,y,n,h=190){
  for(let i=0;i<n;i++){
    const a=rand(TAU),s=rand(.2,1.8);
    particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,l:rand(10,28),h});
  }
  if(particles.length>520)particles.splice(0,particles.length-520);
}
