// ---------------- Kinetic Wild inspired authored creature silhouettes ----------------
// Keeps genetics/evolution intact while replacing the generic procedural skin renderer
// with five coherent body-family presentations. No assets are copied from Kinetic Wild.

function kineticBodyPalette(g){
  const sat=Math.max(48,g.saturation||70);
  return {
    base:`hsl(${g.hue} ${sat}% 52%)`,
    dark:`hsl(${g.hue} ${Math.max(40,sat-8)}% 28%)`,
    light:`hsl(${(g.hue+18)%360} ${Math.max(42,sat-12)}% 72%)`,
    belly:`hsl(${(g.hue+(g.bellyHue||0)+360)%360} 38% 70%)`
  };
}
function kineticLocalPoint(c,idx,z=cam.z){
  const q=c.spine[clamp(idx,0,c.spine.length-1)|0]||{x:0,y:0};
  return {x:q.x*z,y:q.y*z};
}
function kineticRadius(c,idx,z=cam.z){
  return c.bodyRadiusAt?c.bodyRadiusAt(clamp(idx,0,c.spine.length-1)|0)*z:c.g.segmentSize*z;
}
function kineticSmoothStroke(points,width,color){
  if(points.length<2)return;
  ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';
  ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],mx=(a.x+b.x)*.5,my=(a.y+b.y)*.5;
    ctx.quadraticCurveTo(a.x,a.y,mx,my);
  }
  const p=points[points.length-1];ctx.lineTo(p.x,p.y);ctx.stroke();
}
function kineticEye(c,x,y,r){
  const target=c.mind?.target;let lookX=.12,lookY=0;
  if(target&&!target.dead){
    const dx=target.x-c.x,dy=target.y-c.y,ca=Math.cos(-c.angle),sa=Math.sin(-c.angle);
    lookX=clamp((dx*ca-dy*sa)/(c.g.sensor||200),-.45,.45);
    lookY=clamp((dx*sa+dy*ca)/(c.g.sensor||200),-.4,.4);
  }
  ctx.fillStyle='#e8f4e9';ctx.beginPath();ctx.ellipse(x,y,r*1.15,r,0,0,TAU);ctx.fill();
  ctx.fillStyle='#0c1717';ctx.beginPath();ctx.ellipse(x+r*lookX,y+r*lookY,r*.34,r*.52,0,0,TAU);ctx.fill();
  if(c.blink>0){ctx.fillStyle=kineticBodyPalette(c.g).dark;ctx.fillRect(x-r*1.2,y-r*c.blink,r*2.4,r*2*c.blink)}
}
function kineticJaw(c,headX,headR,pal){
  const g=c.g,open=clamp(c.mouthOpen||0,0,1),jawLen=headR*(.85+.32*(g.snout||.8)+.22*(g.jaw||0));
  const gape=headR*(.18+.34*open*(g.gape||.8));
  ctx.fillStyle='#301018';ctx.beginPath();ctx.moveTo(headX+headR*.35,-gape*.65);ctx.lineTo(headX+jawLen,0);ctx.lineTo(headX+headR*.35,gape*.65);ctx.closePath();ctx.fill();
  const drawBone=(sy)=>{
    ctx.strokeStyle=pal.dark;ctx.lineWidth=Math.max(1,headR*.18);ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(headX+headR*.22,sy*gape*.45);ctx.lineTo(headX+jawLen*.82,sy*gape*.55);ctx.stroke();
    if(g.jaw>.18){
      ctx.fillStyle='#f1ead5';const teeth=clamp(Math.round(2+g.jaw*3),2,6);
      for(let i=0;i<teeth;i++){
        const x=headX+headR*.42+(jawLen-headR*.55)*(i/(teeth-1||1)),y=sy*gape*.45;
        ctx.beginPath();ctx.moveTo(x-1,y);ctx.lineTo(x,y-sy*headR*.18*(g.toothSize||.7));ctx.lineTo(x+1,y);ctx.fill();
      }
    }
  };
  drawBone(-1);drawBone(1);
}
function kineticPattern(c,points,pal){
  const g=c.g;if(cam.z<.35)return;ctx.save();ctx.globalAlpha=.22+.18*(g.patternContrast||.2);
  if(g.pattern===0){
    ctx.strokeStyle=pal.light;ctx.lineWidth=Math.max(.7,g.segmentSize*cam.z*.1);
    for(let i=1;i<points.length;i+=2){const p=points[i];ctx.beginPath();ctx.moveTo(p.x,p.y-kineticRadius(c,i)*.5);ctx.lineTo(p.x,p.y+kineticRadius(c,i)*.5);ctx.stroke()}
  }else if(g.pattern===1){
    ctx.fillStyle=pal.light;
    for(let i=1;i<points.length;i+=2){const p=points[i],r=Math.max(1,kineticRadius(c,i)*.14);ctx.beginPath();ctx.arc(p.x,p.y+(i%4<2?-1:1)*r*1.6,r,0,TAU);ctx.fill()}
  }else if(g.pattern===2){
    kineticSmoothStroke(points,Math.max(1,g.segmentSize*cam.z*.11),pal.light);
  }
  ctx.restore();
}
function drawEelPlan(c,pal,S){
  const pts=c.spine.map(q=>({x:q.x*cam.z,y:q.y*cam.z}));
  kineticSmoothStroke(pts,Math.max(2,S*1.42),pal.dark);kineticSmoothStroke(pts,Math.max(1,S*1.08),pal.base);kineticPattern(c,pts,pal);
  const h=S*c.g.head;ctx.fillStyle=pal.base;ctx.beginPath();ctx.ellipse(h*.15,0,h*1.05,h*.7,0,0,TAU);ctx.fill();ctx.strokeStyle=pal.dark;ctx.lineWidth=Math.max(1,S*.12);ctx.stroke();
  kineticEye(c,h*.28,-h*.22,Math.max(1,S*.12*c.g.eyeSize));kineticEye(c,h*.28,h*.22,Math.max(1,S*.12*c.g.eyeSize));kineticJaw(c,h*.05,h,pal);
  const tail=pts[pts.length-1],r=S*c.g.tail;ctx.fillStyle=pal.light;ctx.beginPath();ctx.moveTo(tail.x,tail.y);ctx.lineTo(tail.x-r*1.2,tail.y-r*.55);ctx.lineTo(tail.x-r*1.55,tail.y);ctx.lineTo(tail.x-r*1.2,tail.y+r*.55);ctx.closePath();ctx.fill();
}
function drawLizardPlan(c,pal,S){
  const torso=[];for(let i=0;i<Math.min(c.spine.length,6);i++)torso.push({x:c.spine[i].x*cam.z,y:c.spine[i].y*cam.z});
  kineticSmoothStroke(torso,Math.max(3,S*1.55),pal.dark);kineticSmoothStroke(torso,Math.max(2,S*1.18),pal.base);kineticPattern(c,torso,pal);
  const h=S*c.g.head;ctx.fillStyle=pal.base;ctx.beginPath();ctx.moveTo(-h*.08,-h*.55);ctx.quadraticCurveTo(h*.65,-h*.72,h*1.1,-h*.38);ctx.lineTo(h*1.18,h*.38);ctx.quadraticCurveTo(h*.65,h*.72,-h*.08,h*.55);ctx.closePath();ctx.fill();ctx.strokeStyle=pal.dark;ctx.lineWidth=Math.max(1,S*.12);ctx.stroke();
  kineticEye(c,h*.42,-h*.22,Math.max(1,S*.12*c.g.eyeSize));kineticEye(c,h*.42,h*.22,Math.max(1,S*.12*c.g.eyeSize));kineticJaw(c,h*.12,h,pal);
  const limbPairs=Math.max(2,Math.ceil(c.g.limbs/2));
  for(let pair=0;pair<limbPairs;pair++){
    const idx=clamp(1+Math.floor((pair+1)*(c.spine.length-1)/(limbPairs+1)),1,c.spine.length-1),p=kineticLocalPoint(c,idx),r=kineticRadius(c,idx);
    for(const sy of [-1,1]){
      const gait=Math.sin(c.phase*c.g.finBeat+pair*Math.PI+(sy>0?Math.PI*.35:0)),L=S*c.g.limbLength;
      const knee={x:p.x-L*.18+gait*L*.12,y:p.y+sy*(r*.55+L*.45)},foot={x:p.x-L*.65-gait*L*.15,y:p.y+sy*(r*.55+L*.72)};
      kineticSmoothStroke([p,knee,foot],Math.max(1.3,S*.18*c.g.limbThickness),pal.dark);kineticSmoothStroke([p,knee,foot],Math.max(.8,S*.11*c.g.limbThickness),pal.base);
      ctx.strokeStyle=pal.light;ctx.lineWidth=Math.max(.5,S*.05);
      for(let t=0;t<Math.max(2,c.g.toes||2);t++){ctx.beginPath();ctx.moveTo(foot.x,foot.y);ctx.lineTo(foot.x-L*.16,foot.y+sy*(t-(c.g.toes-1)/2)*S*.06);ctx.stroke()}
    }
  }
  const tailPts=c.spine.slice(Math.max(2,Math.floor(c.spine.length*.45))).map(q=>({x:q.x*cam.z,y:q.y*cam.z}));kineticSmoothStroke(tailPts,Math.max(1.4,S*.72),pal.dark);kineticSmoothStroke(tailPts,Math.max(1,S*.48),pal.base);
}
function drawRayPlan(c,pal,S){
  const span=S*(1.9+.18*c.g.fins),len=S*(1.4+.14*c.g.segments),flap=Math.sin(c.phase*c.g.finBeat)*S*.18;
  ctx.fillStyle=pal.dark;ctx.beginPath();ctx.moveTo(len*.65,0);ctx.quadraticCurveTo(0,-span-flap,-len*.85,-S*.15);ctx.quadraticCurveTo(-len*.25,0,-len*.85,S*.15);ctx.quadraticCurveTo(0,span+flap,len*.65,0);ctx.fill();
  ctx.save();ctx.scale(.94,.88);ctx.fillStyle=pal.base;ctx.beginPath();ctx.moveTo(len*.62,0);ctx.quadraticCurveTo(0,-span*.92-flap,-len*.78,-S*.12);ctx.quadraticCurveTo(-len*.2,0,-len*.78,S*.12);ctx.quadraticCurveTo(0,span*.92+flap,len*.62,0);ctx.fill();ctx.restore();
  ctx.strokeStyle=pal.light;ctx.lineWidth=Math.max(.7,S*.06);for(const sy of [-1,1]){ctx.beginPath();ctx.moveTo(S*.25,0);ctx.quadraticCurveTo(-S*.2,sy*span*.42,-len*.45,sy*span*.72);ctx.stroke()}
  kineticEye(c,S*.28,-S*.22,Math.max(1,S*.1*c.g.eyeSize));kineticEye(c,S*.28,S*.22,Math.max(1,S*.1*c.g.eyeSize));kineticJaw(c,S*.12,S*.72,pal);
  const tail=c.spine.slice(2).map(q=>({x:q.x*cam.z,y:q.y*cam.z}));kineticSmoothStroke(tail,Math.max(1,S*.25),pal.dark);
}
function drawArmoredPlan(c,pal,S){
  const pts=c.spine.map(q=>({x:q.x*cam.z,y:q.y*cam.z}));kineticSmoothStroke(pts,Math.max(3,S*1.62),pal.dark);kineticSmoothStroke(pts,Math.max(2,S*1.24),pal.base);
  for(let i=0;i<pts.length;i++){
    const p=pts[i],r=kineticRadius(c,i);ctx.fillStyle=i%2?pal.dark:pal.light;ctx.globalAlpha=.28+.32*c.g.armor;ctx.beginPath();ctx.ellipse(p.x,p.y,r*.72,r*.52,0,0,TAU);ctx.fill();ctx.globalAlpha=1;
    if(i>0&&i<pts.length-1&&c.g.spines>0){ctx.fillStyle=pal.light;ctx.beginPath();ctx.moveTo(p.x,p.y-r*.4);ctx.lineTo(p.x-r*.28,p.y-r*1.05);ctx.lineTo(p.x-r*.5,p.y-r*.35);ctx.fill()}
  }
  const h=S*c.g.head*1.12;ctx.fillStyle=pal.base;ctx.beginPath();ctx.ellipse(h*.15,0,h*1.05,h*.76,0,0,TAU);ctx.fill();ctx.strokeStyle=pal.dark;ctx.lineWidth=Math.max(1,S*.16);ctx.stroke();
  kineticEye(c,h*.34,-h*.22,Math.max(1,S*.11*c.g.eyeSize));kineticEye(c,h*.34,h*.22,Math.max(1,S*.11*c.g.eyeSize));kineticJaw(c,h*.08,h,pal);
}
function drawBellPlan(c,pal,S){
  const pulse=.84+.16*Math.sin(c.phase*c.g.finBeat),h=S*c.g.head*1.3;
  ctx.fillStyle=pal.dark;ctx.beginPath();ctx.ellipse(0,0,h*1.05,h*.9*pulse,0,Math.PI,TAU);ctx.lineTo(h*.75,h*.38);ctx.quadraticCurveTo(0,h*.7,-h*.75,h*.38);ctx.closePath();ctx.fill();
  ctx.fillStyle=pal.base;ctx.beginPath();ctx.ellipse(0,-S*.05,h*.88,h*.72*pulse,0,Math.PI,TAU);ctx.lineTo(h*.62,h*.3);ctx.quadraticCurveTo(0,h*.52,-h*.62,h*.3);ctx.closePath();ctx.fill();
  ctx.strokeStyle=pal.light;ctx.lineWidth=Math.max(.6,S*.06);for(let i=0;i<5;i++){const x=(i-2)*h*.22;ctx.beginPath();ctx.moveTo(x,h*.28);ctx.bezierCurveTo(x+Math.sin(c.phase+i)*S*.18,h*.8,x-S*.12,h*1.5,x+Math.sin(c.phase*1.4+i)*S*.22,h*2.1);ctx.stroke()}
  kineticEye(c,h*.22,-h*.16,Math.max(1,S*.09*c.g.eyeSize));kineticEye(c,h*.22,h*.16,Math.max(1,S*.09*c.g.eyeSize));
}

Creature.prototype.draw=function(){
  const p=ws(this.x,this.y),z=cam.z;if(p.x<-220||p.x>SW+220||p.y<-220||p.y>SH+220)return;
  const pal=kineticBodyPalette(this.g);if(z<.09){ctx.fillStyle=pal.base;ctx.fillRect(p.x,p.y,2,2);return}
  const S=this.g.segmentSize*z;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(this.angle);
  ctx.save();ctx.globalAlpha=.18;ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(-S*.7,S*.85,S*(1.2+.12*this.g.segments),S*.35,0,0,TAU);ctx.fill();ctx.restore();
  if(this.g.plan===0)drawEelPlan(this,pal,S);else if(this.g.plan===1)drawLizardPlan(this,pal,S);else if(this.g.plan===2)drawRayPlan(this,pal,S);else if(this.g.plan===3)drawArmoredPlan(this,pal,S);else drawBellPlan(this,pal,S);
  const breath=this.art?.breath??(.5+.5*Math.sin(this.phase*.45));ctx.strokeStyle='rgba(92,34,45,.55)';ctx.lineWidth=Math.max(.5,S*.05);
  for(let i=0;i<Math.min(4,this.g.gills||0);i++){const gx=-S*(.1+i*.11),gy=S*(.28+.06*breath);ctx.beginPath();ctx.moveTo(gx,-gy);ctx.lineTo(gx-S*.08,-gy-S*.18);ctx.stroke()}
  for(const w of this.wounds||[]){const idx=clamp(Math.round(w.station*(this.spine.length-1)),0,this.spine.length-1),q=kineticLocalPoint(this,idx),r=kineticRadius(this,idx);ctx.fillStyle=`rgba(95,8,22,${.25+.45*w.severity})`;ctx.beginPath();ctx.ellipse(q.x,q.y+w.side*r*.38,Math.max(1,S*.09*w.severity),Math.max(.7,S*.045),0,0,TAU);ctx.fill()}
  if((this.g.photophores||0)>0&&z>.28){const excite=this.mind?.excitement||0;ctx.fillStyle=`hsla(${(this.g.hue+78)%360},90%,74%,${.18+.42*excite})`;for(let i=0;i<Math.min(7,this.g.photophores);i++){const idx=clamp(Math.floor((i+1)*(this.spine.length-1)/(Math.min(7,this.g.photophores)+1)),0,this.spine.length-1),q=kineticLocalPoint(this,idx);ctx.beginPath();ctx.arc(q.x,q.y,Math.max(1,S*.045*(this.g.photophoreSize||1)),0,TAU);ctx.fill()}}
  ctx.restore();
};
