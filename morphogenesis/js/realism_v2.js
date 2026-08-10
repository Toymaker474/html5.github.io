// Morphogenesis Realism V2 — anatomy-aware presentation layered over Kinetic Abyss.
// Rendering only: simulation rules remain in entities/cognition/evolution.
(function(){
  const baseDraw=Creature.prototype.draw;
  function rgba(a,b,c,d){return `rgba(${a},${b},${c},${d})`}
  function station(c,i){const q=c.spine[clamp(i,0,c.spine.length-1)|0]||{x:0,y:0};return{x:q.x*cam.z,y:q.y*cam.z}}
  function radius(c,i){return (c.bodyRadiusAt?c.bodyRadiusAt(clamp(i,0,c.spine.length-1)|0):c.g.segmentSize)*cam.z}
  function localTarget(c){const t=c.mind?.target;if(!t||t.dead)return{x:.28,y:0};const dx=t.x-c.x,dy=t.y-c.y,ca=Math.cos(-c.angle),sa=Math.sin(-c.angle),s=Math.max(80,c.g.sensor||180);return{x:clamp((dx*ca-dy*sa)/s,-.65,.65),y:clamp((dx*sa+dy*ca)/s,-.55,.55)}}
  function drawMuscleBands(c,S){
    if(cam.z<.3||c.spine.length<2)return;
    const effort=clamp(Math.hypot(c.vx,c.vy)/(1.2+(c.g.muscle||1)),0,1);
    ctx.save();ctx.globalCompositeOperation='screen';ctx.strokeStyle=`rgba(235,255,255,${.035+.05*effort})`;ctx.lineWidth=Math.max(.5,S*.035);
    for(let i=1;i<c.spine.length-1;i++){
      const p=station(c,i),r=radius(c,i),phase=Math.sin(c.phase*1.4+i*.8);
      ctx.beginPath();ctx.ellipse(p.x,p.y,r*(.46+.04*phase),r*(.70-.06*phase),0,-1.05,1.05);ctx.stroke();
    }
    ctx.restore();
  }
  function drawLateralLine(c,S){
    if(cam.z<.4||c.spine.length<3)return;
    ctx.save();ctx.strokeStyle='rgba(225,250,245,.16)';ctx.lineWidth=Math.max(.55,S*.035);ctx.beginPath();
    c.spine.forEach((q,i)=>{const x=q.x*cam.z,y=q.y*cam.z+radius(c,i)*.22;if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y)});ctx.stroke();ctx.restore();
  }
  function drawGillMechanics(c,S){
    const gills=Math.min(4,c.g.gills||0);if(!gills||cam.z<.28)return;
    const breath=c.art?.breath??(.5+.5*Math.sin(c.phase*.45));const stress=clamp((c.mind?.fear||0)+(1-c.health),0,1);const open=.28+.52*breath+.16*stress;
    ctx.save();ctx.strokeStyle=`rgba(105,20,35,${.38+.26*open})`;ctx.lineWidth=Math.max(.8,S*.06);ctx.lineCap='round';
    for(let i=0;i<gills;i++){const x=-S*(.12+i*.105),r=S*(.22+i*.025);ctx.beginPath();ctx.moveTo(x,-r*.62);ctx.quadraticCurveTo(x-S*.10*open,-r*.2,x,-r*.02);ctx.stroke();ctx.beginPath();ctx.moveTo(x,r*.62);ctx.quadraticCurveTo(x-S*.10*open,r*.2,x,r*.02);ctx.stroke()}
    ctx.restore();
  }
  function drawWetEyes(c,S){
    if((c.g.eyes||0)<=0||cam.z<.28)return;
    const look=localTarget(c),eyeR=Math.max(1.5,S*.11*(c.g.eyeSize||1)),head=S*(c.g.head||1),pairs=Math.min(2,Math.ceil((c.g.eyes||1)/2));
    ctx.save();
    for(let i=0;i<pairs;i++)for(const sy of[-1,1]){
      const x=head*(.34+i*.07),y=sy*head*(.20+i*.11);
      ctx.fillStyle='rgba(215,235,220,.95)';ctx.beginPath();ctx.ellipse(x,y,eyeR*1.18,eyeR,0,0,TAU);ctx.fill();
      ctx.fillStyle='rgba(7,18,18,.98)';ctx.beginPath();ctx.ellipse(x+look.x*eyeR*.55,y+look.y*eyeR*.5,eyeR*.35,eyeR*.52,0,0,TAU);ctx.fill();
      ctx.fillStyle='rgba(255,255,245,.88)';ctx.beginPath();ctx.arc(x+look.x*eyeR*.35-eyeR*.16,y+look.y*eyeR*.3-eyeR*.22,Math.max(.6,eyeR*.14),0,TAU);ctx.fill();
      if(c.blink>0){ctx.fillStyle=`hsla(${c.g.hue},55%,34%,.86)`;ctx.fillRect(x-eyeR*1.25,y-eyeR*c.blink,eyeR*2.5,eyeR*2*c.blink)}
    }
    ctx.restore();
  }
  function drawJawTissue(c,S){
    if((c.g.jaw||0)<=.05||cam.z<.24)return;
    const open=clamp(c.mouthOpen||0,0,1),head=S*(c.g.head||1),jaw=head*(.82+.30*(c.g.snout||.8)+.18*c.g.jaw),gape=head*(.12+.38*open*(c.g.gape||.8));
    const recoil=clamp(c.art?.biteRecoil||0,0,1);ctx.save();ctx.translate(-recoil*S*.16,0);
    ctx.fillStyle='rgba(92,24,38,.78)';ctx.beginPath();ctx.moveTo(head*.28,-gape*.72);ctx.quadraticCurveTo(jaw*.58,-gape*.9,jaw,0);ctx.quadraticCurveTo(jaw*.58,gape*.9,head*.28,gape*.72);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(35,25,28,.75)';ctx.lineWidth=Math.max(1,S*.11);for(const sy of[-1,1]){ctx.beginPath();ctx.moveTo(head*.18,sy*gape*.52);ctx.lineTo(jaw*.86,sy*gape*.56);ctx.stroke()}
    ctx.fillStyle='rgba(236,229,204,.96)';const teeth=clamp(Math.round(3+(c.g.jaw||0)*4),3,8);for(let i=0;i<teeth;i++){const t=i/(teeth-1),x=lerp(head*.32,jaw*.82,t);for(const sy of[-1,1]){const y=sy*gape*.50;ctx.beginPath();ctx.moveTo(x-S*.035,y);ctx.lineTo(x+S*.01,y-sy*S*(.12+.07*(c.g.toothSize||.7)));ctx.lineTo(x+S*.045,y);ctx.fill()}}
    ctx.restore();
  }
  function drawFinRays(c,S){
    if(cam.z<.34||(c.g.fins||0)<=0)return;
    ctx.save();ctx.strokeStyle='rgba(220,245,240,.12)';ctx.lineWidth=Math.max(.45,S*.025);
    const count=Math.min(5,c.g.fins||0);for(let i=0;i<count;i++){const idx=clamp(1+Math.floor((i+1)*(c.spine.length-1)/(count+1)),1,c.spine.length-1),p=station(c,idx),r=radius(c,idx),beat=Math.sin(c.phase*(c.g.finBeat||1.2)+i*.9);for(const sy of[-1,1]){ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-r*(.65+.12*beat),p.y+sy*r*(.95+.15*beat));ctx.stroke()}}
    ctx.restore();
  }
  function drawSkinSheen(c,S){
    if(cam.z<.22)return;const gloss=clamp(c.g.skinGloss??.45,0,1),iri=clamp(c.g.iridescence??.2,0,1),stress=clamp(c.mind?.fear||0,0,1);
    ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=.10+.16*gloss;ctx.strokeStyle=`hsla(${(c.g.hue+35+iri*80)%360},70%,82%,${.18+.12*iri})`;ctx.lineWidth=Math.max(.7,S*.07);
    ctx.beginPath();for(let i=0;i<c.spine.length;i++){const p=station(c,i),r=radius(c,i),y=p.y-r*(.42+.06*Math.sin(c.phase*.5+i));if(!i)ctx.moveTo(p.x,y);else ctx.lineTo(p.x,y)}ctx.stroke();
    if(stress>.35){ctx.globalAlpha=.04+.08*stress;ctx.fillStyle='rgba(120,220,235,.7)';for(let i=0;i<c.spine.length;i+=2){const p=station(c,i),r=radius(c,i);ctx.beginPath();ctx.arc(p.x,p.y-r*.2,Math.max(.6,r*.07),0,TAU);ctx.fill()}}
    ctx.restore();
  }
  function drawDigestiveBulge(c,S){
    const gut=(c.stomach||0)+(c.swallow?.length||0)*4;if(gut<=1||cam.z<.32||c.spine.length<3)return;
    const idx=Math.min(2,c.spine.length-1),p=station(c,idx),r=radius(c,idx),a=clamp(gut/45,0,.55);ctx.save();ctx.fillStyle=`rgba(110,45,35,${.07+.12*a})`;ctx.beginPath();ctx.ellipse(p.x,p.y+r*.18,r*(.35+.25*a),r*(.25+.18*a),0,0,TAU);ctx.fill();ctx.restore();
  }
  Creature.prototype.draw=function(){
    baseDraw.call(this);
    const p=ws(this.x,this.y),z=cam.z;if(z<.12||p.x<-240||p.x>SW+240||p.y<-240||p.y>SH+240)return;
    const S=this.g.segmentSize*z;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(this.angle);
    drawMuscleBands(this,S);drawLateralLine(this,S);drawFinRays(this,S);drawGillMechanics(this,S);drawDigestiveBulge(this,S);drawWetEyes(this,S);drawJawTissue(this,S);drawSkinSheen(this,S);
    ctx.restore();
  };

  const baseRender=render;
  render=function(){
    baseRender();
    ctx.save();ctx.setTransform(DPR,0,0,DPR,0,0);
    // depth fog and volumetric shafts: visual only, deterministic from time
    const fog=ctx.createLinearGradient(0,0,0,SH);fog.addColorStop(0,'rgba(25,85,105,.015)');fog.addColorStop(.55,'rgba(5,22,34,.045)');fog.addColorStop(1,'rgba(0,3,8,.16)');ctx.fillStyle=fog;ctx.fillRect(0,0,SW,SH);
    ctx.globalCompositeOperation='screen';for(let i=0;i<4;i++){const x=(SW*(.12+i*.24)+Math.sin(time*.08+i)*45),w=SW*.10;const gr=ctx.createLinearGradient(x-w,0,x+w,SH);gr.addColorStop(0,'rgba(90,205,220,0)');gr.addColorStop(.48,'rgba(90,205,220,.018)');gr.addColorStop(.52,'rgba(140,230,235,.026)');gr.addColorStop(1,'rgba(90,205,220,0)');ctx.fillStyle=gr;ctx.fillRect(x-w,0,w*2,SH)}
    ctx.restore();
  };
})();
