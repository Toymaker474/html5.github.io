// ---------------- living art / physiological presentation layer ----------------
// Visual/animation traits are inherited, mutable, and layered on top of the tested
// anatomy, feeding, cognition, and evolution systems. These are presentation
// approximations, not claims of validated animal biomechanics.

function livingArtGeneDefaults(g){
  if(!Number.isFinite(g.skinGloss))g.skinGloss=rand(.18,.92);
  if(!Number.isFinite(g.iridescence))g.iridescence=rand(0,.78);
  if(!Number.isFinite(g.causticResponse))g.causticResponse=rand(.18,1);
  if(!Number.isFinite(g.photophores))g.photophores=rand()<.58?(rand(0,9)|0):0;
  if(!Number.isFinite(g.photophoreSize))g.photophoreSize=rand(.45,1.35);
  if(!Number.isFinite(g.breathRate))g.breathRate=rand(.45,1.45);
  if(!Number.isFinite(g.breathDepth))g.breathDepth=rand(.25,1);
  if(!Number.isFinite(g.gillPulse))g.gillPulse=rand(.45,1.4);
  if(!Number.isFinite(g.eyeTrack))g.eyeTrack=rand(.35,1);
  if(!Number.isFinite(g.jawMuscle))g.jawMuscle=rand(.45,1.35);
  if(!Number.isFinite(g.finVeins))g.finVeins=rand(.15,.9);
  if(!Number.isFinite(g.scarTone))g.scarTone=rand(.15,.8);
  if(!Number.isFinite(g.lateralGlow))g.lateralGlow=rand(0,.9);
  return g;
}

const LivingBaseGene=Gene;
Gene=class extends LivingBaseGene{
  constructor(copy=null){
    super(copy);
    livingArtGeneDefaults(this);
  }
};

const livingBaseMutateGene=mutateGene;
mutateGene=function(g,amt=1){
  const n=livingArtGeneDefaults(livingBaseMutateGene(g,amt));
  const t=(k,s,a,b,p=.24)=>{if(Math.random()<p*amt)n[k]=clamp(n[k]+gauss()*s*amt,a,b)};
  t('skinGloss',.06,.02,1);t('iridescence',.07,0,1);t('causticResponse',.07,0,1);
  t('photophoreSize',.07,.2,1.8);t('breathRate',.08,.2,2);t('breathDepth',.07,.08,1.4);
  t('gillPulse',.08,.2,2);t('eyeTrack',.07,0,1);t('jawMuscle',.07,.2,1.8);
  t('finVeins',.06,0,1);t('scarTone',.06,0,1);t('lateralGlow',.07,0,1);
  if(Math.random()<.08*amt)n.photophores=clamp(n.photophores+(Math.random()<.5?-1:1),0,12);
  return n;
};

const livingBaseCrossoverGene=crossoverGene;
crossoverGene=function(a,b){
  const n=livingArtGeneDefaults(livingBaseCrossoverGene(a,b));
  for(const k of ['skinGloss','iridescence','causticResponse','photophores','photophoreSize','breathRate','breathDepth','gillPulse','eyeTrack','jawMuscle','finVeins','scarTone','lateralGlow']){
    if(Math.random()<.5&&Number.isFinite(b[k]))n[k]=b[k];
  }
  return n;
};

function ensureLivingArt(c){
  livingArtGeneDefaults(c.g);
  if(!c.art){
    c.art={
      breathPhase:rand(TAU),
      breath:.5,
      gill:.5,
      gazeX:1,
      gazeY:0,
      recoil:0,
      shimmer:rand(TAU),
      scars:[]
    };
  }
  return c.art;
}

function livingTarget(c){
  const t=c.mind?.target;
  if(t&&!t.dead&&Number.isFinite(t.x+t.y))return t;
  const m=c.mind?.threatMemory||c.mind?.foodMemory||c.mind?.carcassMemory;
  if(m&&Number.isFinite(m.x+m.y))return m;
  return null;
}

const livingBaseCreatureUpdate=Creature.prototype.update;
Creature.prototype.update=function(dt){
  const art=ensureLivingArt(this);
  livingBaseCreatureUpdate.call(this,dt);
  if(this.dead)return;

  const stress=clamp((1-this.health)+(this.mind?.fear||0)*.65+this.hunger*.18,0,1.6);
  art.breathPhase+=dt*(1.25+this.g.breathRate*1.7+stress*.75);
  art.breath=.5+.5*Math.sin(art.breathPhase);
  art.gill=.5+.5*Math.sin(art.breathPhase*this.g.gillPulse+0.8);
  art.recoil=Math.max(0,art.recoil-dt*(3.5+this.g.jawMuscle));

  for(const s of art.scars)s.age+=dt;
  art.scars=art.scars.filter(s=>s.age<180);

  const t=livingTarget(this);
  let gx=1,gy=0;
  if(t){
    const dx=t.x-this.x,dy=t.y-this.y,ca=Math.cos(-this.angle),sa=Math.sin(-this.angle);
    const lx=dx*ca-dy*sa,ly=dx*sa+dy*ca,m=Math.hypot(lx,ly)||1;
    gx=lx/m;gy=ly/m;
  }
  const track=.05+.18*this.g.eyeTrack;
  art.gazeX=lerp(art.gazeX,gx,track);
  art.gazeY=lerp(art.gazeY,gy,track);
};

const livingBasePerformBite=Creature.prototype.performBite;
Creature.prototype.performBite=function(){
  const art=ensureLivingArt(this);
  art.recoil=1;
  return livingBasePerformBite.call(this);
};

const livingBaseApplyWound=Creature.prototype.applyWound;
Creature.prototype.applyWound=function(wx,wy,damage,attacker){
  const art=ensureLivingArt(this);
  livingBaseApplyWound.call(this,wx,wy,damage,attacker);
  const w=this.wounds[this.wounds.length-1];
  if(w){
    art.scars.push({
      station:w.station,
      side:w.side,
      age:0,
      strength:clamp((w.severity||.2)*(.55+this.g.scarTone*.6),.08,1)
    });
    if(art.scars.length>10)art.scars.shift();
  }
};

const livingBaseBodyRadiusAt=Creature.prototype.bodyRadiusAt;
Creature.prototype.bodyRadiusAt=function(i){
  const base=livingBaseBodyRadiusAt.call(this,i);
  const art=ensureLivingArt(this);
  const t=i/Math.max(1,this.spine.length-1);
  const chest=Math.exp(-Math.pow((t-.20)/.24,2));
  return base*(1+(art.breath-.5)*2*this.g.breathDepth*.055*chest);
};

function livingLocalPoint(c,station,side=0){
  const idx=clamp(Math.round(station*Math.max(0,c.spine.length-1)),0,Math.max(0,c.spine.length-1));
  const q=c.spine[idx]||{x:0,y:0};
  const r=c.bodyRadiusAt(idx)*cam.z;
  return{x:q.x*cam.z,y:q.y*cam.z+side*r,r,idx};
}

function drawLivingShadow(c){
  if(cam.z<.10)return;
  const p=ws(c.x,c.y),g=c.g;
  const len=Math.max(g.segmentSize*2,g.segmentSize*g.segments*.62)*cam.z;
  const thick=g.segmentSize*g.bodyDepth*.72*cam.z;
  ctx.save();
  ctx.translate(p.x+Math.cos(c.angle+Math.PI/2)*thick*.35,p.y+Math.sin(c.angle+Math.PI/2)*thick*.35+thick*.35);
  ctx.rotate(c.angle);
  const gr=ctx.createRadialGradient(-len*.15,0,0,-len*.15,0,len*.75);
  gr.addColorStop(0,'rgba(0,0,0,.20)');
  gr.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=gr;
  ctx.beginPath();ctx.ellipse(-len*.18,0,len*.78,Math.max(2,thick*.72),0,0,TAU);ctx.fill();
  ctx.restore();
}

function drawLivingHighlights(c){
  const g=c.g,art=ensureLivingArt(c),p=ws(c.x,c.y),z=cam.z;
  if(z<.13)return;
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(c.angle);
  const S=g.segmentSize*z;

  ctx.save();
  ctx.globalCompositeOperation='screen';
  ctx.lineCap='round';
  for(let i=0;i<c.spine.length;i++){
    const q=c.spine[i],r=c.bodyRadiusAt(i)*z;
    const shimmer=.35+.65*Math.sin(art.shimmer+i*.8+time*.9);
    const alpha=(.025+.09*g.skinGloss)*(.45+.55*shimmer);
    ctx.strokeStyle=`rgba(205,248,255,${alpha})`;
    ctx.lineWidth=Math.max(.5,r*(.08+.10*g.skinGloss));
    ctx.beginPath();
    ctx.moveTo(q.x*z-r*.12,q.y*z-r*.44);
    ctx.lineTo(q.x*z+r*.22,q.y*z-r*.28);
    ctx.stroke();
  }

  const ca=g.causticResponse;
  if(ca>.08){
    ctx.strokeStyle=`rgba(135,235,255,${.025+.07*ca})`;
    ctx.lineWidth=Math.max(.45,S*.055);
    for(let k=0;k<3;k++){
      ctx.beginPath();
      for(let i=0;i<c.spine.length;i++){
        const q=c.spine[i],r=c.bodyRadiusAt(i)*z;
        const y=q.y*z-r*(.15+.18*Math.sin(time*1.4+k+i*.65));
        const x=q.x*z+Math.sin(time*.8+k*2+i*.4)*r*.18;
        if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      }
      ctx.stroke();
    }
  }
  ctx.restore();

  const n=Math.min(g.photophores,c.spine.length*2);
  if(n>0){
    const arousal=clamp((c.mind?.excitement||0)+(c.mind?.fear||0)*.35,0,1);
    ctx.save();ctx.globalCompositeOperation='screen';
    for(let i=0;i<n;i++){
      const station=(i+1)/(n+1),side=i%2?1:-1,pt=livingLocalPoint(c,station,side*.42);
      const rr=Math.max(.7,S*.055*g.photophoreSize*(.8+.45*arousal));
      const hue=185+g.lateralGlow*55+g.iridescence*25;
      ctx.shadowBlur=rr*4;ctx.shadowColor=`hsla(${hue},95%,70%,.5)`;
      ctx.fillStyle=`hsla(${hue},95%,76%,${.20+.34*g.lateralGlow+.16*arousal})`;
      ctx.beginPath();ctx.arc(pt.x,pt.y,rr,0,TAU);ctx.fill();
    }
    ctx.restore();
  }

  const gillOpen=(.22+.78*art.gill)*(1+clamp((c.mind?.fear||0)*.25,0,.25));
  ctx.strokeStyle=`rgba(140,45,70,${.16+.24*gillOpen})`;
  ctx.lineWidth=Math.max(.55,S*.035);
  for(let i=0;i<g.gills;i++){
    const gx=-S*(.08+i*.10),gy=S*(.26+.12*g.gillSize);
    ctx.beginPath();
    ctx.moveTo(gx,gy*.6);
    ctx.quadraticCurveTo(gx-S*.05,gy*gillOpen,gx-S*.10,gy*(1.0+.2*gillOpen));
    ctx.stroke();
  }

  if(g.eyes&&c.blink<.72){
    const headR=S*g.head;
    const lookX=clamp(art.gazeX,-1,1),lookY=clamp(art.gazeY,-1,1);
    for(let i=0;i<g.eyes;i++){
      const lane=i%2?1:-1,row=Math.floor(i/2),ex=headR*(.20-row*.16),ey=lane*headR*g.eyeSpread*.42,er=Math.max(1,S*.13*g.eyeSize);
      const px=ex+lookX*er*.30*g.eyeTrack,py=ey+lookY*er*.22*g.eyeTrack;
      ctx.fillStyle='rgba(2,7,12,.72)';
      ctx.beginPath();ctx.ellipse(px,py,Math.max(.45,er*g.pupil*.24),Math.max(.6,er*g.pupil*.52),0,0,TAU);ctx.fill();
      ctx.fillStyle='rgba(245,255,255,.82)';
      ctx.beginPath();ctx.arc(px-er*.12,py-er*.18,Math.max(.35,er*.10),0,TAU);ctx.fill();
    }
  }

  const cheek=S*g.head*.34;
  const biteT=clamp(c.mouthOpen*.7+art.recoil*.55,0,1);
  if(g.jaw>.06&&biteT>.01){
    ctx.fillStyle=`rgba(105,25,48,${.05+.16*biteT*g.jawMuscle})`;
    ctx.beginPath();ctx.ellipse(S*g.head*.20,0,cheek*(1+.15*biteT),cheek*.62,0,0,TAU);ctx.fill();
  }

  for(const s of art.scars){
    const fade=clamp(1-s.age/180,0,1),pt=livingLocalPoint(c,s.station,s.side*.46);
    ctx.strokeStyle=`rgba(95,35,48,${(.05+.20*s.strength)*fade})`;
    ctx.lineWidth=Math.max(.45,S*.035);
    ctx.beginPath();
    ctx.moveTo(pt.x-S*.12,pt.y-S*.05*s.side);
    ctx.quadraticCurveTo(pt.x,pt.y+S*.06*s.side,pt.x+S*.15,pt.y-S*.03*s.side);
    ctx.stroke();
  }

  ctx.restore();
}

const livingBaseCreatureDraw=Creature.prototype.draw;
Creature.prototype.draw=function(){
  ensureLivingArt(this);
  drawLivingShadow(this);
  const oldMouth=this.mouthOpen;
  this.mouthOpen=clamp(oldMouth+this.art.recoil*.06*this.g.jawMuscle,0,1);
  livingBaseCreatureDraw.call(this);
  this.mouthOpen=oldMouth;
  drawLivingHighlights(this);
};

const livingBaseRender=render;
render=function(){
  livingBaseRender();

  ctx.save();
  ctx.globalCompositeOperation='screen';
  for(let i=0;i<5;i++){
    const x=SW*(.08+i*.23)+Math.sin(time*.13+i*1.7)*SW*.05;
    const w=SW*(.10+.025*(i%2));
    const gr=ctx.createLinearGradient(x-w,0,x+w,SH);
    gr.addColorStop(0,'rgba(105,225,245,.035)');
    gr.addColorStop(.52,'rgba(70,190,220,.012)');
    gr.addColorStop(1,'rgba(30,90,130,0)');
    ctx.fillStyle=gr;
    ctx.beginPath();
    ctx.moveTo(x-w,0);ctx.lineTo(x+w,0);ctx.lineTo(x+w*.35,SH);ctx.lineTo(x-w*.35,SH);ctx.closePath();ctx.fill();
  }
  ctx.restore();

  const haze=ctx.createLinearGradient(0,0,0,SH);
  haze.addColorStop(0,'rgba(40,125,155,0)');
  haze.addColorStop(1,'rgba(0,5,12,.16)');
  ctx.fillStyle=haze;ctx.fillRect(0,0,SW,SH);

  const vig=ctx.createRadialGradient(SW*.5,SH*.46,Math.min(SW,SH)*.20,SW*.5,SH*.5,Math.max(SW,SH)*.72);
  vig.addColorStop(0,'rgba(0,0,0,0)');
  vig.addColorStop(1,'rgba(0,0,0,.20)');
  ctx.fillStyle=vig;ctx.fillRect(0,0,SW,SH);
};

if(typeof updateHUD==='function'){
  const livingBaseUpdateHUD=updateHUD;
  updateHUD=function(){
    livingBaseUpdateHUD();
    if(hud)hud.innerHTML=hud.innerHTML.replace('ORGANIC BODY PATCH','LIVING ART + COGNITION');
  };
}
