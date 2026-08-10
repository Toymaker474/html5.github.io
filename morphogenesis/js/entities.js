// ---------------- drifting plankton ----------------
class Food{
  constructor(x=rand(CFG.WORLD_W),y=rand(CFG.WORLD_H)){
    this.x=x;this.y=y;this.vx=rand(-.08,.08);this.vy=rand(-.08,.08);
    this.energy=rand(7,19);this.dead=false;this.capturedBy=null;this.phase=rand(TAU);
  }
  update(dt){
    this.phase+=dt;
    if(this.capturedBy&&!this.capturedBy.dead)return;
    this.capturedBy=null;
    const c=currentAt(this.x,this.y);
    this.vx=(this.vx+c.x)*.992;this.vy=(this.vy+c.y)*.992;
    this.x+=this.vx*60*dt;this.y+=this.vy*60*dt;wrap(this);
  }
  draw(){
    const p=ws(this.x,this.y),r=Math.max(1,1.7*cam.z);
    ctx.fillStyle='rgba(175,255,220,.82)';
    ctx.beginPath();ctx.arc(p.x,p.y,r,0,TAU);ctx.fill();
    if(cam.z>.65){ctx.strokeStyle='rgba(175,255,220,.16)';ctx.beginPath();ctx.arc(p.x,p.y,r*2.8,0,TAU);ctx.stroke()}
  }
}

class Carcass{
  constructor(c){
    this.x=c.x;this.y=c.y;this.vx=c.vx*.22;this.vy=c.vy*.22;
    this.energy=16+c.g.segmentSize*c.g.segments*.82;
    this.size=Math.max(5,c.g.segmentSize*.82);this.hue=c.g.hue;this.dead=false;this.age=0;
    this.angle=c.angle;this.plan=c.g.plan;this.decay=0;
  }
  update(dt){
    this.age+=dt;this.decay=clamp(this.age/100,0,1);
    const cur=currentAt(this.x,this.y);
    this.vx=(this.vx+cur.x*.12)*.987;this.vy=(this.vy+cur.y*.12)*.987;
    this.x+=this.vx*60*dt;this.y+=this.vy*60*dt;wrap(this);
    this.energy-=dt*(.045+.05*this.decay);
    if(this.energy<=.2||this.age>170)this.dead=true;
  }
  takeChunk(amount){const q=Math.min(this.energy,amount);this.energy-=q;if(this.energy<=.2)this.dead=true;return q}
  draw(){
    const p=ws(this.x,this.y),r=Math.max(1,this.size*cam.z);
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(this.angle+this.age*.01);
    ctx.fillStyle=`hsla(${this.hue},28%,${38-this.decay*12}%,${.28-this.decay*.10})`;
    ctx.beginPath();ctx.ellipse(0,0,r*1.35,r*.56,0,0,TAU);ctx.fill();
    ctx.strokeStyle=`rgba(225,235,225,${.16+.12*this.decay})`;ctx.lineWidth=Math.max(.5,cam.z);
    ctx.beginPath();ctx.moveTo(-r*.8,0);ctx.lineTo(r*.75,0);ctx.stroke();
    for(let i=-2;i<=2;i++){ctx.beginPath();ctx.moveTo(i*r*.28,0);ctx.lineTo(i*r*.28,r*.32);ctx.stroke()}
    ctx.restore();
  }
}

function drawSmoothClosed(points){
  if(points.length<3)return;
  ctx.beginPath();
  const last=points[points.length-1],first=points[0];
  ctx.moveTo((last.x+first.x)*.5,(last.y+first.y)*.5);
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length];
    ctx.quadraticCurveTo(a.x,a.y,(a.x+b.x)*.5,(a.y+b.y)*.5);
  }
  ctx.closePath();
}

class Creature{
  constructor(g=null,b=null){
    this.g=g||new Gene();this.b=b||new Brain();
    this.x=rand(CFG.WORLD_W);this.y=rand(CFG.WORLD_H);
    this.angle=rand(TAU);this.turnVel=0;
    this.vx=Math.cos(this.angle)*rand(.12,.48);this.vy=Math.sin(this.angle)*rand(.12,.48);
    this.energy=112;this.health=1;this.age=0;this.dead=false;this.kids=0;this.eaten=0;this.lineage=0;
    this.phase=rand(TAU);this.cool=rand(1,4);this.stomach=0;this.hunger=0;
    this.mouthOpen=0;this.biteTimer=0;this.biteApplied=false;this.biteCooldown=0;
    this.heldFood=null;this.heldBolus=null;this.swallowT=0;
    this.stroke=0;this.blink=0;this.blinkTimer=rand(1,5);
    this.wounds=[];this.startleTimer=0;
    this.spine=[];this.rebuildSpine();
  }

  rebuildSpine(){this.spine=Array.from({length:this.g.segments},(_,i)=>({x:-i*this.g.segmentSize*.78,y:0,vx:0,vy:0}))}
  bodyMass(){return this.g.segmentSize*this.g.segments*(1+.42*this.g.armor)}
  fitness(){return this.age*.75+this.kids*42+this.eaten*2.2+this.health*12+this.lineage*.22-this.wounds.length*.35}

  nearestFood(){let best=null,bd=this.g.sensor*this.g.sensor;for(const f of foods){if(f.dead||f.capturedBy)continue;const dx=f.x-this.x,dy=f.y-this.y,d=dx*dx+dy*dy;if(d<bd){bd=d;best=f}}return best}
  nearestCarcass(){let best=null,bd=this.g.sensor*this.g.sensor;for(const c of carcasses){if(c.dead)continue;const dx=c.x-this.x,dy=c.y-this.y,d=dx*dx+dy*dy;if(d<bd){bd=d;best=c}}return best}
  nearestCreature(){let best=null,bd=this.g.sensor*this.g.sensor;for(const c of nearbyLife(this,this.g.sensor)){const dx=c.x-this.x,dy=c.y-this.y,d=dx*dx+dy*dy;if(d<bd){bd=d;best=c}}return best}

  mouthWorld(){const reach=this.g.segmentSize*this.g.head*(.80+.34*this.g.snout);return{x:this.x+Math.cos(this.angle)*reach,y:this.y+Math.sin(this.angle)*reach}}
  isThreat(other){if(!other)return false;const ratio=other.bodyMass()/Math.max(1,this.bodyMass());return other.g.carnivore>.58&&other.g.aggression>.38&&ratio>.55}
  startBite(){if(this.biteCooldown>0||this.biteTimer>0)return;this.biteTimer=.40/this.g.biteSpeed;this.biteApplied=false}

  updateMouth(dt,targetDist){
    this.biteCooldown=Math.max(0,this.biteCooldown-dt);
    if(targetDist<this.g.segmentSize*(2.0+.45*this.g.mouthReach)&&this.biteCooldown<=0&&this.biteTimer<=0)this.startBite();
    if(this.biteTimer>0){
      const total=.40/this.g.biteSpeed,elapsed=1-this.biteTimer/total;
      if(elapsed<.28)this.mouthOpen=smoothstep(elapsed/.28);
      else if(elapsed<.54)this.mouthOpen=1;
      else if(elapsed<.78)this.mouthOpen=1-smoothstep((elapsed-.54)/.24);
      else this.mouthOpen=0;
      if(!this.biteApplied&&elapsed>=.60){this.biteApplied=true;this.performBite()}
      this.biteTimer-=dt;
      if(this.biteTimer<=0){this.biteTimer=0;this.mouthOpen=0;this.biteCooldown=.28/this.g.biteSpeed}
    }else this.mouthOpen=lerp(this.mouthOpen,0,.28);

    const held=this.heldFood||this.heldBolus;
    if(held){
      this.swallowT+=dt*(1.45+this.g.metabolism*.32);
      const m=this.mouthWorld();
      const gutX=this.x-Math.cos(this.angle)*this.g.segmentSize*(.42+.08*this.g.segments);
      const gutY=this.y-Math.sin(this.angle)*this.g.segmentSize*(.42+.08*this.g.segments);
      const t=smoothstep(clamp(this.swallowT,0,1));
      held.x=lerp(m.x,gutX,t);held.y=lerp(m.y,gutY,t);
      if(t>=1){
        this.stomach+=held.energy;
        if(this.heldFood){this.heldFood.dead=true;this.heldFood.capturedBy=null}
        this.heldFood=null;this.heldBolus=null;this.swallowT=0;this.eaten++;swallows++;soundEvent('eat',.05);
      }
    }
  }

  performBite(){
    const m=this.mouthWorld();
    const reach=this.g.segmentSize*(.62+.55*this.g.mouthReach);
    if(!this.heldFood&&!this.heldBolus&&this.g.carnivore<.82){
      let best=null,bd=reach*reach;
      for(const f of foods){if(f.dead||f.capturedBy)continue;const dx=f.x-m.x,dy=f.y-m.y,d=dx*dx+dy*dy;if(d<bd){bd=d;best=f}}
      if(best){best.capturedBy=this;this.heldFood=best;this.swallowT=0;bites++;return}
    }
    if(!this.heldFood&&!this.heldBolus&&this.g.carnivore>.36){
      let body=null,bd=reach*reach;
      for(const c of carcasses){if(c.dead)continue;const dx=c.x-m.x,dy=c.y-m.y,d=dx*dx+dy*dy;if(d<bd){bd=d;body=c}}
      if(body){const chunk=body.takeChunk(3.5+this.g.jaw*6.5);if(chunk>0){this.heldBolus={x:m.x,y:m.y,energy:chunk,hue:body.hue,radius:Math.sqrt(chunk)*.45};this.swallowT=0;bites++;soundEvent('eat',.04);return}}
    }
    if(this.g.carnivore>.58&&this.g.jaw>.12){
      let victim=null,bd=reach*reach;
      for(const c of nearbyLife(this,reach*1.5)){
        const dx=c.x-m.x,dy=c.y-m.y,d=dx*dx+dy*dy;
        if(d<bd){const ratio=this.bodyMass()/Math.max(1,c.bodyMass());if(ratio>.38){bd=d;victim=c}}
      }
      if(victim){
        const sizeRatio=this.bodyMass()/Math.max(1,victim.bodyMass());
        const raw=(5.5+this.g.jaw*8.5+this.g.venom*3.5)*clamp(sizeRatio,.4,1.5);
        const damage=raw*(1-victim.g.armor*.62);
        victim.applyWound(m.x,m.y,damage,this);bites++;soundEvent('kill',.045);
        if(victim.health<=0)victim.die('predation');
      }
    }
  }

  applyWound(wx,wy,damage,attacker){
    this.health-=damage/100;
    const dx=wx-this.x,dy=wy-this.y,ca=Math.cos(-this.angle),sa=Math.sin(-this.angle);
    const lx=dx*ca-dy*sa,ly=dx*sa+dy*ca,total=Math.max(this.g.segmentSize,this.g.segmentSize*this.g.segments*.78);
    const station=clamp(-lx/total,0,1);
    this.wounds.push({station,side:Math.sign(ly)||1,severity:clamp(damage/18,.12,1),age:0});
    if(this.wounds.length>8)this.wounds.shift();
    woundsMade++;this.startleTimer=.55+.75*this.g.startle;
    if(attacker){const away=norm(this.x-attacker.x,this.y-attacker.y);this.vx+=away.x*.35*this.g.startle;this.vy+=away.y*.35*this.g.startle}
    burst(this.x,this.y,Math.max(3,Math.round(damage*.35)),350);
  }

  die(){if(this.dead)return;this.dead=true;deaths++;if(carcasses.length<CFG.MAX_CARCASSES)carcasses.push(new Carcass(this))}

  updateSpine(){
    if(this.spine.length!==this.g.segments)this.rebuildSpine();
    this.spine[0].x=0;this.spine[0].y=0;
    const speed=Math.hypot(this.vx,this.vy);
    let waveScale=1;
    if(this.g.locomotion===1)waveScale=.45;else if(this.g.locomotion===2)waveScale=.25;else if(this.g.locomotion===3)waveScale=.6+.35*this.stroke;
    const amp=this.g.flex*this.g.segmentSize*clamp(speed/2.4,.16,1)*waveScale;
    for(let i=1;i<this.spine.length;i++){
      const prev=this.spine[i-1],p=this.spine[i];
      const rest=this.g.segmentSize*.78*Math.pow(this.g.taper,i*.035),tx=prev.x-rest;
      const wave=Math.sin(this.phase*this.g.finBeat-i*.73)*amp*(i/Math.max(1,this.spine.length-1));
      const ty=wave+this.turnVel*i*this.g.segmentSize*.72;
      p.vx+=(tx-p.x)*(.13+.12*this.g.flex);p.vy+=(ty-p.y)*(.11+.14*this.g.flex);
      p.vx*=.71;p.vy*=.71;p.x+=p.vx;p.y+=p.vy;
    }
  }

  locomotionForce(neuralThrust){
    const g=this.g;
    if(g.locomotion===0)return (.016+.100*neuralThrust*g.muscle)*(.30+.70*this.stroke)*(1+.08*g.tail);
    if(g.locomotion===1){const paddle=.45+.55*Math.abs(Math.sin(this.phase*g.finBeat));return (.014+.085*neuralThrust*g.muscle)*paddle*(1+.035*g.limbs*g.limbLength)}
    if(g.locomotion===2){const fin=.55+.45*Math.abs(Math.sin(this.phase*g.finBeat*.72));return (.013+.078*neuralThrust*g.muscle)*fin*(1+.045*g.fins*g.finSize)}
    const pulse=Math.max(0,Math.sin(this.phase*g.finBeat));return (.010+.115*neuralThrust*g.muscle)*(.18+.82*pulse);
  }

  update(dt){
    this.age+=dt;this.cool-=dt;this.startleTimer=Math.max(0,this.startleTimer-dt);
    const speed=Math.hypot(this.vx,this.vy);this.phase+=dt*(1.7+this.g.finBeat*2.6+speed*.28);
    this.blinkTimer-=dt;if(this.blinkTimer<=0){this.blink=1;this.blinkTimer=rand(2.2,7)/(this.g.blinkRate+.25)}this.blink=Math.max(0,this.blink-dt*5.5);

    if(this.stomach>0){const tempFactor=clamp((waterTemp(this.y)-4)/20,.35,1);const dig=Math.min(this.stomach,dt*(1.8+this.g.metabolism*1.25)*tempFactor);this.stomach-=dig;this.energy+=dig*.72}
    this.hunger=clamp(1-this.energy/145,0,1);
    for(const w of this.wounds){w.age+=dt;w.severity=Math.max(0,w.severity-dt*.006*this.g.regen)}
    this.wounds=this.wounds.filter(w=>w.severity>.04);

    const f=this.nearestFood(),carr=this.g.carnivore>.32?this.nearestCarcass():null,other=this.nearestCreature();
    const df=f?norm(f.x-this.x,f.y-this.y):{x:0,y:0,m:999};
    const dcar=carr?norm(carr.x-this.x,carr.y-this.y):{x:0,y:0,m:999};
    const dc=other?norm(other.x-this.x,other.y-this.y):{x:0,y:0,m:999};
    const inp=[df.x,df.y,clamp(df.m/this.g.sensor,0,1),dc.x,dc.y,clamp(dc.m/this.g.sensor,0,1),this.energy/180,this.health,this.g.carnivore,this.g.aggression,depthLight(this.y),Math.sin(this.phase)];
    const o=this.b.act(inp);

    let sx=o[0],sy=o[1];
    const threat=this.isThreat(other),sizeRatio=other?this.bodyMass()/Math.max(1,other.bodyMass()):1;
    const huntDrive=this.g.carnivore*this.g.aggression*(.35+.65*this.hunger);
    if(f&&this.g.carnivore<.78){sx+=df.x*(.20+.38*(1-this.g.carnivore))*this.hunger;sy+=df.y*(.20+.38*(1-this.g.carnivore))*this.hunger}
    if(carr&&this.g.carnivore>.3){sx+=dcar.x*.52*this.g.carnivore*this.hunger;sy+=dcar.y*.52*this.g.carnivore*this.hunger}
    if(other){
      if(threat&&(sizeRatio<1.25||this.g.aggression<.65)){const flee=.62+.52*this.g.startle+(this.startleTimer>0?.45:0);sx-=dc.x*flee;sy-=dc.y*flee}
      else if(huntDrive>.28&&sizeRatio>.38){sx+=dc.x*(.28+.62*huntDrive);sy+=dc.y*(.28+.62*huntDrive)}
      else if(this.g.schooling>.45){sx+=dc.x*.10*this.g.schooling;sy+=dc.y*.10*this.g.schooling}
    }

    if(Math.hypot(sx,sy)>.001){const desired=Math.atan2(sy,sx),delta=angleDelta(this.angle,desired);const turnAuthority=.065+.075*this.g.flex+.025*this.g.fins;this.turnVel=lerp(this.turnVel,clamp(delta,-.58,.58)*turnAuthority,.17)}else this.turnVel*=.90;
    this.turnVel*=.94;this.angle+=this.turnVel;

    this.stroke=.5+.5*Math.sin(this.phase*this.g.finBeat);
    const neuralThrust=(o[2]+1)*.5,injuryPenalty=clamp(1-this.wounds.reduce((s,w)=>s+w.severity,0)*.07,.55,1);
    const thrust=this.locomotionForce(neuralThrust)*injuryPenalty;
    this.vx+=Math.cos(this.angle)*thrust;this.vy+=Math.sin(this.angle)*thrust;
    const cur=currentAt(this.x,this.y);this.vx+=cur.x;this.vy+=cur.y;
    const drag=.990-Math.min(.015,this.bodyMass()*.00007)-this.mouthOpen*.0018;
    this.vx*=drag;this.vy*=drag;
    const vmax=(1.30+this.g.muscle*1.48)*injuryPenalty,vm=Math.hypot(this.vx,this.vy)||1;
    if(vm>vmax){this.vx=this.vx/vm*vmax;this.vy=this.vy/vm*vmax}
    this.x+=this.vx*60*dt;this.y+=this.vy*60*dt;wrap(this);this.updateSpine();

    let targetDist=999;
    if(!threat){if(huntDrive>.28&&other)targetDist=dc.m;else if(carr&&this.g.carnivore>.3)targetDist=dcar.m;else if(f)targetDist=df.m}
    this.updateMouth(dt,targetDist);

    const morphologyCost=this.g.armor*.17+this.g.jaw*.055+this.g.sensor*.00055+this.g.limbs*.011+this.g.fins*.008+this.g.carnivore*.12;
    const motionCost=neuralThrust*this.g.muscle*.12+Math.abs(this.turnVel)*.4;
    this.energy-=dt*(.40+this.g.metabolism*.52+morphologyCost+motionCost);
    if(this.health<1)this.health=clamp(this.health+dt*.006*this.g.regen,0,1);

    const reproduce=(o[5]+1)*.5,reproThreshold=166+this.bodyMass()*.055+this.g.carnivore*12,reproChanceGate=.44+this.g.carnivore*.08;
    if(this.energy>reproThreshold&&this.cool<=0&&creatures.length<CFG.MAX_POP&&reproduce>reproChanceGate){
      const child=new Creature(mutateGene(this.g),mutateBrain(this.b));
      child.x=this.x-Math.cos(this.angle)*this.g.segmentSize;child.y=this.y-Math.sin(this.angle)*this.g.segmentSize;child.angle=this.angle+rand(-.6,.6);wrap(child);child.lineage=this.lineage+1;child.energy=70;
      creatures.push(child);this.energy*=.59;this.cool=5.5/this.g.fertility;this.kids++;births++;soundEvent('birth',.04);
    }

    if(!this.maxAge)this.maxAge=145+rand(35,70);
    if(this.energy<=0||this.health<=0||this.age>this.maxAge)this.die();
  }

  bodyRadiusAt(i){
    const g=this.g,n=Math.max(1,this.spine.length-1),t=i/n;
    const taper=Math.pow(g.taper,i*.72),chest=1+.18*Math.exp(-Math.pow((t-.20)/.20,2)),neck=i===0?g.neck:1;
    return g.segmentSize*g.bodyDepth*taper*chest*neck;
  }

  drawSkinPattern(top,bottom,S){
    const g=this.g;ctx.save();drawSmoothClosed([...top,...bottom.slice().reverse()]);ctx.clip();
    const alpha=.08+.26*g.patternContrast;
    if(g.pattern===0){
      ctx.strokeStyle=`hsla(${g.hue+38},${g.saturation}%,72%,${alpha})`;ctx.lineWidth=Math.max(.8,S*.16);
      for(let i=1;i<this.spine.length;i+=2){const p=this.spine[i];ctx.beginPath();ctx.moveTo(p.x*cam.z,-this.bodyRadiusAt(i)*cam.z);ctx.lineTo(p.x*cam.z,this.bodyRadiusAt(i)*cam.z);ctx.stroke()}
    }else if(g.pattern===1){
      ctx.fillStyle=`hsla(${g.hue+48},${g.saturation}%,72%,${alpha})`;const count=Math.min(16,this.spine.length*2);
      for(let i=0;i<count;i++){const si=i%this.spine.length,p=this.spine[si],r=Math.max(1,S*(.09+.08*hash2(i,g.plan,9))*g.patternScale),y=(hash2(i,si,17)-.5)*this.bodyRadiusAt(si)*1.25*cam.z;ctx.beginPath();ctx.arc(p.x*cam.z,y,r,0,TAU);ctx.fill()}
    }else if(g.pattern===2){
      ctx.strokeStyle=`hsla(${g.hue-38},${g.saturation}%,38%,${alpha+.06})`;ctx.lineWidth=Math.max(.8,S*.11*g.patternScale);ctx.beginPath();for(let i=0;i<this.spine.length;i++){const p=this.spine[i];if(!i)ctx.moveTo(p.x*cam.z,p.y*cam.z);else ctx.lineTo(p.x*cam.z,p.y*cam.z)}ctx.stroke();
    }else{
      ctx.fillStyle=`hsla(${g.hue+25},${g.saturation-8}%,65%,${alpha})`;
      for(let i=0;i<this.spine.length;i+=2){const p=this.spine[i],r=this.bodyRadiusAt(i)*cam.z;ctx.beginPath();ctx.ellipse(p.x*cam.z,p.y*cam.z+(hash2(i,g.plan,4)-.5)*r*.7,r*.65,r*.32,hash2(i,3,8)*.8,0,TAU);ctx.fill()}
    }
    ctx.restore();
  }

  draw(){
    const g=this.g,p=ws(this.x,this.y),z=cam.z;
    if(z<.08){ctx.fillStyle=`hsla(${g.hue},88%,70%,.86)`;ctx.fillRect(p.x,p.y,1.4,1.4);return}
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(this.angle);const S=g.segmentSize*z;

    const top=[],bottom=[];
    for(let i=0;i<this.spine.length;i++){
      const q=this.spine[i],r=this.bodyRadiusAt(i)*z,prev=this.spine[Math.max(0,i-1)],next=this.spine[Math.min(this.spine.length-1,i+1)];
      const tx=next.x-prev.x,ty=next.y-prev.y,tm=Math.hypot(tx,ty)||1,nx=-ty/tm,ny=tx/tm;
      top.push({x:q.x*z+nx*r,y:q.y*z+ny*r});bottom.push({x:q.x*z-nx*r,y:q.y*z-ny*r});
    }
    const headR=S*g.head;top.unshift({x:headR*(.76+.28*g.snout),y:-headR*.62});bottom.unshift({x:headR*(.76+.28*g.snout),y:headR*.62});

    ctx.shadowBlur=Math.min(18,S*1.6);ctx.shadowColor=`hsla(${g.hue},95%,65%,${.16*g.glow})`;
    const skin=ctx.createLinearGradient(-S*this.spine.length*.7,-S,S*1.6,S);
    skin.addColorStop(0,`hsla(${g.hue+g.bodyHue},${g.saturation}%,42%,${.72-g.translucency*.25})`);
    skin.addColorStop(.55,`hsla(${g.hue},${g.saturation}%,58%,${.78-g.translucency*.28})`);
    skin.addColorStop(1,`hsla(${g.hue+10},${g.saturation}%,66%,${.82-g.translucency*.22})`);
    ctx.fillStyle=skin;drawSmoothClosed([...top,...bottom.slice().reverse()]);ctx.fill();ctx.shadowBlur=0;

    ctx.save();drawSmoothClosed([...top,...bottom.slice().reverse()]);ctx.clip();
    const belly=ctx.createLinearGradient(0,-S*.5,0,S*1.2);belly.addColorStop(0,'rgba(255,255,255,0)');belly.addColorStop(1,`hsla(${g.hue+g.bellyHue},${Math.max(35,g.saturation-20)}%,78%,.16)`);
    ctx.fillStyle=belly;ctx.fillRect(-S*this.spine.length,-S*2,S*(this.spine.length+3),S*4);ctx.restore();
    this.drawSkinPattern(top,bottom,S);

    ctx.strokeStyle=`hsla(${g.hue+18},75%,82%,.14)`;ctx.lineWidth=Math.max(.5,z*.8);ctx.beginPath();for(let i=0;i<this.spine.length;i++){const q=this.spine[i];if(!i)ctx.moveTo(q.x*z,q.y*z);else ctx.lineTo(q.x*z,q.y*z)}ctx.stroke();

    ctx.fillStyle=`hsla(${g.hue+24},${g.saturation}%,70%,${.16+.10*g.translucency})`;
    for(let i=0;i<g.fins;i++){
      const idx=clamp(1+Math.floor((i+1)*(this.spine.length-1)/(g.fins+1)),1,this.spine.length-1),q=this.spine[idx],side=i%2?1:-1,r=this.bodyRadiusAt(idx)*z,L=S*g.finSize*(.7+.3*Math.sin(this.phase*g.finBeat+i));
      const x=q.x*z,y=q.y*z+side*r*.55;ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x-L*.15,y+side*L*.9*g.finAspect,x-L*1.15,y+side*L*.5);ctx.quadraticCurveTo(x-L*.5,y+side*L*.1,x,y);ctx.fill();
    }

    for(let i=0;i<g.limbs;i++){
      const pair=Math.floor(i/2),pairs=Math.max(1,Math.ceil(g.limbs/2)),idx=clamp(1+Math.floor((pair+1)*(this.spine.length-1)/(pairs+1)),1,this.spine.length-1),q=this.spine[idx],side=i%2?1:-1;
      const r=this.bodyRadiusAt(idx)*z,L=S*g.limbLength,gait=Math.sin(this.phase*g.finBeat+i*Math.PI*.8),a=side*(.72+.22*gait),x=q.x*z,y=q.y*z+side*r*.62;
      const kx=x+Math.cos(a)*L*.50,ky=y+Math.sin(a)*L*.50,ex=kx+Math.cos(a+side*(.42-.20*gait))*L*.48,ey=ky+Math.sin(a+side*(.42-.20*gait))*L*.48;
      ctx.strokeStyle=`hsla(${g.hue+12},${g.saturation}%,62%,.62)`;ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=Math.max(1,S*.18*g.limbThickness);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(kx,ky);ctx.lineTo(ex,ey);ctx.stroke();
      ctx.fillStyle=`hsla(${g.hue+18},${g.saturation}%,68%,.55)`;ctx.beginPath();ctx.arc(kx,ky,Math.max(1,S*.12*g.limbThickness),0,TAU);ctx.fill();
      if(g.toes){ctx.strokeStyle=`hsla(${g.hue+28},${g.saturation}%,76%,.5)`;ctx.lineWidth=Math.max(.5,S*.055);for(let t=0;t<g.toes;t++){const spread=(t-(g.toes-1)/2)*.16;ctx.beginPath();ctx.moveTo(ex,ey);ctx.lineTo(ex+Math.cos(a+side*.45+spread)*L*.22,ey+Math.sin(a+side*.45+spread)*L*.22);ctx.stroke()}}
    }

    ctx.strokeStyle=`rgba(120,30,55,${.26+.12*this.hunger})`;ctx.lineWidth=Math.max(.5,S*.045);
    for(let i=0;i<g.gills;i++){const gx=-S*(.10+i*.10),gy=S*.38*g.gillSize;ctx.beginPath();ctx.moveTo(gx,gy*.55);ctx.quadraticCurveTo(gx-S*.08,gy,gx-S*.13,gy*1.22);ctx.stroke()}

    const jawLen=headR*(.72+.35*g.snout),jawH=headR*.24,openA=this.mouthOpen*g.gape*.55;
    ctx.fillStyle='rgba(55,8,18,.82)';ctx.beginPath();ctx.moveTo(headR*.42,-jawH*.35);ctx.lineTo(jawLen,0);ctx.lineTo(headR*.42,jawH*.35);ctx.closePath();ctx.fill();
    const drawJaw=(side)=>{
      ctx.save();ctx.translate(headR*.34,0);ctx.rotate(side*openA);const y=side*jawH*.26;
      ctx.fillStyle=`hsla(${g.hue-8},${g.saturation}%,55%,.92)`;ctx.beginPath();ctx.moveTo(0,y);ctx.quadraticCurveTo(jawLen*.46,y+side*jawH*.15,jawLen*.72,side*jawH*.08);ctx.lineTo(jawLen*.18,side*jawH*.50);ctx.closePath();ctx.fill();
      if(g.jaw>.08){ctx.fillStyle='rgba(245,247,235,.88)';const teeth=clamp(Math.round(2+g.jaw*4),2,8);for(let t=0;t<teeth;t++){const x=jawLen*(.20+.48*t/Math.max(1,teeth-1)),base=side*jawH*(.17+.03*Math.sin(t));ctx.beginPath();ctx.moveTo(x-S*.035,base);ctx.lineTo(x,base-side*S*.12*g.toothSize);ctx.lineTo(x+S*.035,base);ctx.fill()}}
      ctx.restore();
    };
    drawJaw(-1);drawJaw(1);

    for(let i=0;i<g.eyes;i++){
      const lane=i%2?1:-1,row=Math.floor(i/2),ex=headR*(.20-row*.16),ey=lane*headR*g.eyeSpread*.42,er=Math.max(1,S*.13*g.eyeSize);
      ctx.fillStyle='rgba(225,245,238,.92)';ctx.beginPath();ctx.ellipse(ex,ey,er*1.15,er,0,0,TAU);ctx.fill();
      ctx.fillStyle=`hsla(${g.hue+70},65%,48%,.9)`;ctx.beginPath();ctx.arc(ex+er*.15,ey,er*.62,0,TAU);ctx.fill();
      ctx.fillStyle='rgba(3,8,13,.95)';ctx.beginPath();ctx.ellipse(ex+er*.22,ey,er*g.pupil*.42,er*g.pupil,0,0,TAU);ctx.fill();
      if(this.blink>0){ctx.fillStyle=`hsla(${g.hue},${g.saturation}%,55%,${clamp(this.blink,0,1)})`;ctx.fillRect(ex-er*1.3,ey-er,er*2.6,er*2)}
    }

    ctx.strokeStyle=`hsla(${g.hue+45},80%,82%,.28)`;ctx.lineWidth=Math.max(.4,z*.65);
    for(let i=0;i<g.whiskers;i++){const a=(i-(g.whiskers-1)/2)*.26,L=headR*(1.2+g.sensor/360);ctx.beginPath();ctx.moveTo(headR*.62,a*headR*.28);ctx.bezierCurveTo(headR*1.0,a*headR*.7,L*.75,a*headR-this.turnVel*S*3,L,a*headR*.7);ctx.stroke()}

    if(g.spines){ctx.fillStyle=`hsla(${g.hue-22},${g.saturation}%,68%,.42)`;for(let i=1;i<=g.spines;i++){const idx=clamp(Math.floor(i*(this.spine.length-1)/(g.spines+1)),1,this.spine.length-1),q=this.spine[idx],r=this.bodyRadiusAt(idx)*z;ctx.beginPath();ctx.moveTo(q.x*z,q.y*z-r*.65);ctx.lineTo(q.x*z-r*.35,q.y*z-r*1.65);ctx.lineTo(q.x*z-r*.55,q.y*z-r*.58);ctx.closePath();ctx.fill()}}

    if(this.spine.length){const q=this.spine[this.spine.length-1],r=S*g.tail,beat=Math.sin(this.phase*g.finBeat)*r*.16;ctx.fillStyle=`hsla(${g.hue+14},${g.saturation}%,68%,${.18+.1*g.translucency})`;ctx.beginPath();ctx.moveTo(q.x*z,q.y*z);ctx.quadraticCurveTo(q.x*z-r*.7,q.y*z-r*.8+beat,q.x*z-r*1.45,q.y*z-r*.35+beat);ctx.lineTo(q.x*z-r*1.7,q.y*z+beat);ctx.lineTo(q.x*z-r*1.45,q.y*z+r*.35+beat);ctx.quadraticCurveTo(q.x*z-r*.7,q.y*z+r*.8+beat,q.x*z,q.y*z);ctx.fill()}

    for(const w of this.wounds){const idx=clamp(Math.round(w.station*(this.spine.length-1)),0,this.spine.length-1),q=this.spine[idx],r=this.bodyRadiusAt(idx)*z;ctx.fillStyle=`rgba(120,5,25,${.22+.48*w.severity})`;ctx.beginPath();ctx.ellipse(q.x*z,q.y*z+w.side*r*.45,Math.max(1,S*.10*w.severity),Math.max(.7,S*.055),0,0,TAU);ctx.fill()}

    const held=this.heldFood||this.heldBolus;
    if(held){const dx=held.x-this.x,dy=held.y-this.y,ca=Math.cos(-this.angle),sa=Math.sin(-this.angle),lx=(dx*ca-dy*sa)*z,ly=(dx*sa+dy*ca)*z;ctx.fillStyle=this.heldFood?'rgba(180,255,220,.9)':`hsla(${held.hue||20},45%,58%,.85)`;ctx.beginPath();ctx.arc(lx,ly,Math.max(1,(held.radius||1.8)*z),0,TAU);ctx.fill()}
    ctx.restore();
  }
}

function burst(x,y,n,h=190){for(let i=0;i<n;i++){const a=rand(TAU),s=rand(.2,1.8);particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,l:rand(10,28),h})}if(particles.length>CFG.MAX_PARTICLES)particles.splice(0,particles.length-CFG.MAX_PARTICLES)}
