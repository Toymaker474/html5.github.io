// ---------------- environment food ----------------
class Food{
  constructor(x=rand(CFG.WORLD_W),y=rand(CFG.WORLD_H)){
    this.x=x;this.y=y;this.vx=rand(-.08,.08);this.vy=rand(-.08,.08);
    this.energy=rand(7,19);this.dead=false;
  }
  update(dt){
    const c=currentAt(this.x,this.y);
    this.vx=(this.vx+c.x)*.992;
    this.vy=(this.vy+c.y)*.992;
    this.x+=this.vx*60*dt;
    this.y+=this.vy*60*dt;
    wrap(this);
  }
  draw(){
    const p=ws(this.x,this.y);
    ctx.fillStyle='rgba(175,255,220,.8)';
    ctx.fillRect(p.x,p.y,Math.max(1,1.8*cam.z),Math.max(1,1.8*cam.z));
  }
}

// ---------------- creature ----------------
class Creature{
  constructor(g=null,b=null){
    this.g=g||new Gene();
    this.b=b||new Brain();
    this.x=rand(CFG.WORLD_W);this.y=rand(CFG.WORLD_H);
    this.vx=rand(-.7,.7);this.vy=rand(-.7,.7);
    this.energy=112;this.health=1;this.age=0;this.dead=false;
    this.kids=0;this.eaten=0;this.lineage=0;this.phase=rand(TAU);this.cool=rand(1,4);
    this.spine=[];
    this.rebuildSpine();
  }

  rebuildSpine(){
    this.spine=Array.from({length:this.g.segments},(_,i)=>({
      x:-i*this.g.segmentSize*.78,
      y:0,
      vx:0,
      vy:0
    }));
  }

  fitness(){
    return this.age+this.kids*36+this.eaten*4+this.health*10+this.lineage*.3;
  }

  nearestFood(){
    let best=null,bd=this.g.sensor*this.g.sensor;
    for(const f of foods){
      if(f.dead)continue;
      const dx=f.x-this.x,dy=f.y-this.y,d=dx*dx+dy*dy;
      if(d<bd){bd=d;best=f}
    }
    return best;
  }

  nearestCreature(){
    let best=null,bd=this.g.sensor*this.g.sensor;
    const arr=nearbyLife(this,this.g.sensor);
    for(const c of arr){
      const dx=c.x-this.x,dy=c.y-this.y,d=dx*dx+dy*dy;
      if(d<bd){bd=d;best=c}
    }
    return best;
  }

  updateSpine(){
    const dir=Math.atan2(this.vy,this.vx);
    if(!this.spine.length)this.rebuildSpine();
    this.spine[0].x=0;this.spine[0].y=0;

    for(let i=1;i<this.spine.length;i++){
      const prev=this.spine[i-1],p=this.spine[i];
      const rest=this.g.segmentSize*.78*Math.pow(this.g.taper,i*.05);
      const wave=Math.sin(this.phase*1.25+i*.75)*this.g.flex*this.g.segmentSize*.45;
      const tx=prev.x-Math.cos(dir)*rest;
      const ty=prev.y-Math.sin(dir)*rest+wave;
      p.vx+=(tx-p.x)*(.08+.12*this.g.flex);
      p.vy+=(ty-p.y)*(.08+.12*this.g.flex);
      p.vx*=.79;p.vy*=.79;p.x+=p.vx;p.y+=p.vy;
    }
  }

  update(dt){
    this.age+=dt;this.cool-=dt;this.phase+=dt*(2.1+this.g.muscle*2.2);

    const f=this.nearestFood();
    const other=this.nearestCreature();

    const df=f?norm(f.x-this.x,f.y-this.y):{x:0,y:0,m:999};
    const dc=other?norm(other.x-this.x,other.y-this.y):{x:0,y:0,m:999};

    const inp=[
      df.x,df.y,clamp(df.m/this.g.sensor,0,1),
      dc.x,dc.y,clamp(dc.m/this.g.sensor,0,1),
      this.energy/180,this.health,this.g.carnivore,this.g.aggression,
      depthLight(this.y),Math.sin(this.phase)
    ];

    const o=this.b.act(inp);

    let sx=o[0],sy=o[1];

    if(f && this.g.carnivore<.75){
      sx+=df.x*(.25+.35*(1-this.g.carnivore));
      sy+=df.y*(.25+.35*(1-this.g.carnivore));
    }

    if(other){
      if(this.g.carnivore>.56 && this.g.aggression>.36){
        sx+=dc.x*(.45+.5*this.g.aggression);
        sy+=dc.y*(.45+.5*this.g.aggression);
      }else if(this.g.schooling>.5){
        sx+=dc.x*.12*this.g.schooling;
        sy+=dc.y*.12*this.g.schooling;
      }else{
        sx-=dc.x*.12;
        sy-=dc.y*.12;
      }
    }

    const sm=Math.hypot(sx,sy)||1;
    const thrust=(o[2]+1)*.5;
    this.vx+=sx/sm*(.025+.11*thrust*this.g.muscle);
    this.vy+=sy/sm*(.025+.11*thrust*this.g.muscle);

    const cur=currentAt(this.x,this.y);
    this.vx+=cur.x;this.vy+=cur.y;

    const bodyMass=this.g.segmentSize*this.g.segments*(1+.4*this.g.armor);
    const drag=.987-Math.min(.012,bodyMass*.00008);
    this.vx*=drag;this.vy*=drag;

    const vmax=1.5+this.g.muscle*1.5;
    const vm=Math.hypot(this.vx,this.vy)||1;
    if(vm>vmax){this.vx=this.vx/vm*vmax;this.vy=this.vy/vm*vmax}

    this.x+=this.vx*60*dt;
    this.y+=this.vy*60*dt;
    wrap(this);

    this.updateSpine();

    const cost=dt*(
      .45+
      this.g.metabolism*.58+
      this.g.muscle*.14+
      this.g.armor*.18+
      this.g.sensor*.00065+
      this.g.limbs*.015+
      this.g.fins*.01
    );
    this.energy-=cost;

    if(f && df.m<this.g.segmentSize*1.05 && !f.dead && this.g.carnivore<.82){
      f.dead=true;this.energy+=f.energy;this.eaten++;burst(this.x,this.y,5,this.g.hue);
      soundEvent('eat',.05);
    }

    if(other && this.g.carnivore>.58 && this.g.jaw>.12 && dc.m<this.g.segmentSize*(1.05+this.g.jaw*.28)){
      const dmg=dt*26*(.35+this.g.jaw+.35*this.g.venom)*(1-other.g.armor*.58);
      other.health-=dmg/100;
      this.energy+=dmg*.10;
      if(other.health<=0){
        other.dead=true;deaths++;
        this.energy+=18+other.g.segmentSize*.35;
        burst(other.x,other.y,12,350);
        soundEvent('kill',.07);
      }
    }

    if(this.health<1)this.health=clamp(this.health+dt*.01*this.g.regen,0,1);

    const reproduce=(o[5]+1)*.5;
    if(this.energy>176 && this.cool<=0 && creatures.length<CFG.MAX_POP && reproduce>.46){
      const child=new Creature(mutateGene(this.g),mutateBrain(this.b));
      child.x=this.x+gauss()*18;child.y=this.y+gauss()*18;wrap(child);
      child.lineage=this.lineage+1;child.energy=76;
      creatures.push(child);
      this.energy*=.62;this.cool=5;this.kids++;births++;
      soundEvent('birth',.04);
    }

    if(this.energy<=0 || this.age>155+rand(45)){
      this.dead=true;deaths++;
    }
  }

  draw(){
    const g=this.g,p=ws(this.x,this.y),z=cam.z;
    if(z<.08){
      ctx.fillStyle=`hsla(${g.hue},90%,70%,.85)`;
      ctx.fillRect(p.x,p.y,1.4,1.4);
      return;
    }

    ctx.save();
    ctx.translate(p.x,p.y);
    ctx.rotate(Math.atan2(this.vy,this.vx));

    const S=g.segmentSize*z;

    ctx.shadowBlur=Math.min(18,S*1.7);
    ctx.shadowColor=`hsla(${g.hue},95%,65%,${.20*g.glow})`;

    for(let i=this.spine.length-1;i>=0;i--){
      const q=this.spine[i],scale=Math.pow(g.taper,i),r=S*scale;
      const x=q.x*z,y=q.y*z;

      ctx.fillStyle=`hsla(${g.hue+g.bodyHue},80%,${58-i*.9}%,${.24+.14*g.bell})`;
      ctx.beginPath();

      if(g.bodyStyle<.33){
        ctx.ellipse(x,y,r*(1.05+g.bell*.32),r*.72,0,0,TAU);
      }else if(g.bodyStyle<.66){
        ctx.moveTo(x+r*1.1,y);
        ctx.lineTo(x-r*.78,y-r*.62);
        ctx.lineTo(x-r*.78,y+r*.62);
        ctx.closePath();
      }else{
        ctx.ellipse(x,y,r*.82,r*(1.0+g.bell*.28),0,0,TAU);
      }
      ctx.fill();

      ctx.strokeStyle=`hsla(${g.hue+20},90%,80%,.15)`;
      ctx.lineWidth=Math.max(.45,z);
      ctx.beginPath();
      ctx.ellipse(x,y,r*.60,r*.40,0,0,TAU);
      ctx.stroke();

      if(g.armor>.3){
        ctx.strokeStyle=`rgba(230,250,255,${.05+.18*g.armor})`;
        ctx.beginPath();
        ctx.arc(x,y,r*.9,-1.05,1.05);
        ctx.stroke();
      }
    }

    ctx.shadowBlur=0;

    const headR=S*g.head;

    ctx.fillStyle=`hsla(${g.hue-8},82%,58%,.56)`;
    ctx.beginPath();
    ctx.ellipse(headR*.28,0,headR,headR*.78,0,0,TAU);
    ctx.fill();

    if(g.jaw>.05){
      ctx.strokeStyle='rgba(255,110,135,.55)';
      ctx.lineWidth=Math.max(.6,z);
      ctx.beginPath();
      ctx.moveTo(headR*.72,-headR*.27);
      ctx.lineTo(headR*(1.0+.32*g.jaw),0);
      ctx.lineTo(headR*.72,headR*.27);
      ctx.stroke();

      ctx.fillStyle='rgba(245,250,245,.9)';
      for(let t=-2;t<=2;t++){
        ctx.beginPath();
        ctx.moveTo(headR*.72,t*headR*.11-headR*.03);
        ctx.lineTo(headR*.92,t*headR*.11);
        ctx.lineTo(headR*.72,t*headR*.11+headR*.03);
        ctx.fill();
      }
    }

    for(let i=0;i<g.eyes;i++){
      const a=(i-(g.eyes-1)/2)*.38;
      const ex=headR*.48,ey=a*headR*.60;

      ctx.fillStyle='rgba(235,255,255,.94)';
      ctx.beginPath();
      ctx.arc(ex,ey,Math.max(1,1.5*z*g.eyeSize),0,TAU);
      ctx.fill();

      ctx.fillStyle='rgba(15,25,35,.95)';
      ctx.beginPath();
      ctx.arc(ex+.5*z,ey,Math.max(.4,.55*z*g.eyeSize),0,TAU);
      ctx.fill();
    }

    ctx.fillStyle=`hsla(${g.hue+25},80%,67%,.22)`;
    for(let i=0;i<g.fins;i++){
      const idx=clamp(1+i*(this.spine.length-1)/Math.max(1,g.fins),0,this.spine.length-1)|0;
      const q=this.spine[idx],x=q.x*z,y=q.y*z,r=S*Math.pow(g.taper,idx)*g.finSize;
      const side=i%2?1:-1;

      ctx.beginPath();
      ctx.moveTo(x,y);
      ctx.quadraticCurveTo(x-r*.2,y+side*r*.95,x-r*1.35,y+side*r*.58);
      ctx.quadraticCurveTo(x-r*.45,y+side*r*.18,x,y);
      ctx.fill();
    }

    ctx.strokeStyle=`hsla(${g.hue+35},88%,73%,.38)`;
    ctx.lineWidth=Math.max(.55,.9*z);
    for(let i=0;i<g.limbs;i++){
      const idx=clamp(1+(i>>1)*(this.spine.length-1)/Math.max(1,Math.ceil(g.limbs/2)),0,this.spine.length-1)|0;
      const q=this.spine[idx],side=i%2?1:-1;
      const x=q.x*z,y=q.y*z,L=S*g.limbLength*(.82+.18*Math.sin(i*2.1));
      const a=side*(.75+.25*Math.sin(this.phase+i));
      const kx=x+Math.cos(a)*L*.55,ky=y+Math.sin(a)*L*.55;
      const ex=kx+Math.cos(a+side*.55)*L*.55,ey=ky+Math.sin(a+side*.55)*L*.55;

      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(kx,ky);ctx.lineTo(ex,ey);ctx.stroke();

      ctx.fillStyle=`hsla(${g.hue+45},90%,76%,.38)`;
      ctx.beginPath();ctx.arc(ex,ey,Math.max(1,z*1.2),0,TAU);ctx.fill();
    }

    ctx.strokeStyle=`hsla(${g.hue+45},95%,80%,.27)`;
    for(let i=0;i<g.whiskers;i++){
      const a=(i-(g.whiskers-1)/2)*.3;
      ctx.beginPath();
      ctx.moveTo(headR*.6,a*headR*.3);
      ctx.bezierCurveTo(
        headR*1.2,a*headR,
        headR*1.7+Math.sin(this.phase+i)*S*.3,a*headR*1.4,
        headR*(1.8+g.sensor/550),a*headR*1.15
      );
      ctx.stroke();
    }

    if(g.spines){
      ctx.fillStyle=`hsla(${g.hue-20},88%,70%,.38)`;
      for(let i=1;i<=g.spines;i++){
        const idx=clamp(i*(this.spine.length-1)/(g.spines+1),1,this.spine.length-1)|0;
        const q=this.spine[idx],x=q.x*z,y=q.y*z,r=S*.6;
        ctx.beginPath();
        ctx.moveTo(x,y-r*.14);
        ctx.lineTo(x-r*.52,y-r);
        ctx.lineTo(x-r*.66,y+r*.05);
        ctx.closePath();
        ctx.fill();
      }
    }

    if(this.spine.length){
      const q=this.spine[this.spine.length-1],x=q.x*z,y=q.y*z,r=S*g.tail;
      ctx.fillStyle=`hsla(${g.hue+15},82%,65%,.22)`;
      ctx.beginPath();
      ctx.moveTo(x,y);
      ctx.lineTo(x-r*1.35,y-r*.72);
      ctx.lineTo(x-r*1.65,y);
      ctx.lineTo(x-r*1.35,y+r*.72);
      ctx.closePath();
      ctx.fill();
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
