'use strict';
/* GENESIS V103 — HIGH MATERIAL BODY + JELLY LIFE
   2.5x render density, continuous animal silhouettes, wet skin, soft jelly body,
   and physical slime droplets/puddles. Loaded after v102_cycle.js. */

const V103_MAX_DPR=2.5;
function v103Resize(){
  SW=innerWidth;SH=innerHeight;
  DPR=Math.min(devicePixelRatio||1,V103_MAX_DPR);
  C.width=Math.max(1,Math.round(SW*DPR));
  C.height=Math.max(1,Math.round(SH*DPR));
  C.style.width=SW+'px';C.style.height=SH+'px';
  X.setTransform(DPR,0,0,DPR,0,0);
  X.imageSmoothingEnabled=true;
  X.imageSmoothingQuality='high';
}
addEventListener('resize',v103Resize);v103Resize();

/* ---------- ORIGINAL JELLY ORGANISM ---------- */
if(!SPEC.jelly_wraith){
  SPEC.jelly_wraith={
    name:'Vitreous Wraith',family:'jelly',role:'scav',intelligent:false,
    builder:false,netter:false,weaver:false,move:'climb',body:6,legs:0,arms:7,tail:4,
    baseSpeed:.18,gravity:.20,color:'#648c88',hi:'#d8f4dd',variant:0,small:false,
    feminine:false,torsoAccent:1
  };
  SPEC_INDEX.jelly_wraith=SPECIES_KEYS.length;
  SPECIES_KEYS.push('jelly_wraith');
}
function v103SpawnJelly(x=null,y=null){
  const p=x==null?randomFloorX():{x,y};
  const c=spawnCreature('jelly_wraith',null,null,p.x,p.y-18);
  c.g.size=1.05+rnd()*.30;c.g.grip=1.25+rnd()*.30;c.g.limb=1.12+rnd()*.28;
  c.g.speed=.72+rnd()*.28;c.g.stamina=1.15+rnd()*.25;c.energy=72+rnd()*22;
  c.v103Pulse=rnd()*TAU;c.v103SlimeClock=rnd()*90;c.v103Burst=false;
  for(let i=0;i<c.nodes.length;i++){c.nodes[i].r*=1.05+(i===2?.18:0);}
  if(c.nodes.length>4){
    c.constraints.push([1,3,25*c.g.size],[2,4,25*c.g.size],[0,4,47*c.g.size]);
  }
  return c;
}
function v103EnsureJellies(){
  const alive=creatures.filter(c=>c.alive&&c.spec.family==='jelly').length;
  for(let i=alive;i<3;i++)v103SpawnJelly();
}

/* ---------- SLOW, STICKY JELLY MOTION ---------- */
const V103_baseDesiredMotion=desiredMotion;
desiredMotion=function(c){
  const m=V103_baseDesiredMotion(c);
  if(c.spec.family==='jelly'){
    const pulse=.36+.28*(.5+.5*Math.sin(simTick*.026+c.id*.73));
    m.speed*=pulse;
    m.dy+=Math.sin(simTick*.013+c.id)*.18;
    if(c.state==='SCAVENGE')m.speed*=.78;
  }
  return m;
};

/* ---------- PHYSICAL SLIME ---------- */
const V103_SLIME=[],V103_PUDDLES=[];
let V103_slimeMade=0;
function v103Drop(x,y,vx=0,vy=0,r=2.5,life=1100,owner=0){
  if(V103_SLIME.length>240)return;
  V103_SLIME.push({x,y,px:x-vx,py:y-vy,r,inv:1,contact:0,life,owner,stuck:0,alpha:.55+rnd()*.28});
  V103_slimeMade++;
}
function v103BurstSlime(c,n=22){
  const q=c.center();
  for(let i=0;i<n;i++)v103Drop(q.x+(rnd()-.5)*24,q.y+(rnd()-.5)*18,(rnd()-.5)*2.6,-rnd()*2.2,1.6+rnd()*3.8,900+rnd()*900,c.id);
}
function v103Puddle(x,y,r,life=4200){
  let best=null,bd=28*28;
  for(const p of V103_PUDDLES){const d=(p.x-x)**2+(p.y-y)**2;if(d<bd){bd=d;best=p;}}
  if(best){best.r=Math.min(28,Math.sqrt(best.r*best.r+r*r*.85));best.life=Math.max(best.life,life);return best;}
  if(V103_PUDDLES.length>110)V103_PUDDLES.shift();
  const p={x,y,r,life,visc:.55+rnd()*.35,phase:rnd()*TAU};V103_PUDDLES.push(p);return p;
}
function v103StepSlime(){
  for(const c of creatures){
    if(c.gone||c.spec.family!=='jelly')continue;
    if(!c.alive&&!c.v103Burst){c.v103Burst=true;v103BurstSlime(c,34);}
    if(!c.alive)continue;
    c.v103SlimeClock=(c.v103SlimeClock||0)+1;
    const q=c.nodes[c.nodes.length-1],v=velocity(q),spd=Math.hypot(v.x,v.y);
    if(c.v103SlimeClock>34-spd*5){
      c.v103SlimeClock=0;
      v103Drop(q.x+(rnd()-.5)*7,q.y+q.r*.65,-v.x*.12+(rnd()-.5)*.18,-.08+rnd()*.12,1.5+rnd()*2.4,1300+rnd()*700,c.id);
    }
  }
  for(let i=V103_SLIME.length-1;i>=0;i--){
    const d=V103_SLIME[i];d.contact=0;d.life--;
    const vx=(d.x-d.px)*.982,vy=(d.y-d.py)*.982;d.px=d.x;d.py=d.y;d.x+=vx;d.y+=vy+.16;
    pointCollide(d);
    const nv=velocity(d),sp=Math.hypot(nv.x,nv.y);
    if(d.contact>0&&sp<.72)d.stuck++;else d.stuck=Math.max(0,d.stuck-1);
    if(d.contact>0&&d.stuck>8){v103Puddle(d.x,d.y+d.r*.35,Math.max(2,d.r*1.45),2400+d.life);V103_SLIME.splice(i,1);continue;}
    if(d.life<=0||d.y>WORLD_H+80){V103_SLIME.splice(i,1);continue;}
  }
  for(let i=V103_PUDDLES.length-1;i>=0;i--){
    const p=V103_PUDDLES[i];p.life--;p.r*=.99996;
    if(typeof ECO_W!=='undefined'){
      const gi=ecoGroundCell(p.x,p.y);ECO_W[gi]=clamp(ECO_W[gi]+.00012*p.r,0,1.5);ECO_F[gi]=clamp(ECO_F[gi]+.000006*p.r,0,1.5);
    }
    for(const c of creatures){
      if(!c.alive||c.spec.family==='jelly')continue;const q=c.center();
      if(Math.abs(q.x-p.x)<p.r+22&&Math.abs(q.y-p.y)<26){
        const drag=.035*p.visc;
        for(const n of c.nodes){n.px=lerp(n.px,n.x,drag);n.py=lerp(n.py,n.y,drag*.25);}
      }
    }
    if(p.life<=0||p.r<1.2)V103_PUDDLES.splice(i,1);
  }
}
const V103_baseStep=step;
step=function(){V103_baseStep();v103StepSlime();};
const V103_baseReset=reset;
reset=function(){V103_baseReset();V103_SLIME.length=0;V103_PUDDLES.length=0;V103_slimeMade=0;v103EnsureJellies();};
v103EnsureJellies();

/* ---------- MATERIAL RENDER HELPERS ---------- */
function v103HexAlpha(hex,a){
  if(!hex||hex[0]!=='#')return `rgba(120,140,130,${a})`;
  let h=hex.slice(1);if(h.length===3)h=h.split('').map(x=>x+x).join('');
  const n=parseInt(h,16);return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
}
function v103BodyGeometry(c){
  const pts=c.nodes.map(n=>worldToScreen(n.x,n.y));
  const top=[],bot=[];
  for(let i=0;i<pts.length;i++){
    const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)],dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy)||1,nx=-dy/l,ny=dx/l;
    const r=c.nodes[i].r*camera.zoom*(c.spec.family==='jelly'?1.28:1.03);
    top.push({x:pts[i].x+nx*r,y:pts[i].y+ny*r});bot.push({x:pts[i].x-nx*r,y:pts[i].y-ny*r});
  }
  const path=new Path2D();
  path.moveTo(top[0].x,top[0].y);
  for(let i=1;i<top.length;i++){const a=top[i-1],b=top[i];path.quadraticCurveTo(a.x,a.y,(a.x+b.x)*.5,(a.y+b.y)*.5);}path.lineTo(top[top.length-1].x,top[top.length-1].y);
  for(let i=bot.length-1;i>=0;i--){const a=bot[Math.min(bot.length-1,i+1)]||bot[i],b=bot[i];path.quadraticCurveTo(a.x,a.y,(a.x+b.x)*.5,(a.y+b.y)*.5);}path.lineTo(bot[0].x,bot[0].y);path.closePath();
  return{pts,top,bot,path};
}
function v103DrawLimb(c,l,col,hi){
  if(l.disabled)return;const a=worldToScreen(c.nodes[l.anchor].x,c.nodes[l.anchor].y),h=worldToScreen(l.hand.x,l.hand.y),dx=h.x-a.x,dy=h.y-a.y,d=Math.hypot(dx,dy)||1,nx=-dy/d,ny=dx/d;
  const bend=l.side*(l.arm?1:-1)*Math.min(16*camera.zoom,d*.30),k={x:(a.x+h.x)*.5+nx*bend,y:(a.y+h.y)*.5+ny*bend};
  const thick=(l.arm?3.3:4.2)*camera.zoom*c.g.size;
  X.lineCap='round';X.lineJoin='round';
  X.strokeStyle='rgba(4,7,6,.72)';X.lineWidth=thick+3.2*camera.zoom;X.beginPath();X.moveTo(a.x,a.y);X.lineTo(k.x,k.y);X.lineTo(h.x,h.y);X.stroke();
  const gr=X.createLinearGradient(a.x,a.y,h.x,h.y);gr.addColorStop(0,hi);gr.addColorStop(.34,col);gr.addColorStop(1,'#25312d');X.strokeStyle=gr;X.lineWidth=thick;X.beginPath();X.moveTo(a.x,a.y);X.lineTo(k.x,k.y);X.lineTo(h.x,h.y);X.stroke();
  X.fillStyle=v103HexAlpha(hi,.78);X.beginPath();X.ellipse(k.x,k.y,thick*.58,thick*.48,0,0,TAU);X.fill();
  X.fillStyle=l.planted?'#b7c5b5':'#66736b';X.beginPath();X.ellipse(h.x,h.y,thick*.72,thick*.35,Math.atan2(dy,dx),0,TAU);X.fill();
  if(c.spec.role==='pred'||c.spec.family==='lizard'){X.strokeStyle='#d7d1b9';X.lineWidth=Math.max(.7,camera.zoom*.7);for(let k2=-1;k2<=1;k2++){X.beginPath();X.moveTo(h.x+k2*1.5,h.y);X.lineTo(h.x+c.face*3.4+k2*1.5,h.y+2);X.stroke();}}
}
function v103DrawTail(c,col,hi){
  if(!c.tail.length)return;let prev=c.nodes[c.nodes.length-1];
  for(let i=0;i<c.tail.length;i++){const n=c.tail[i],a=worldToScreen(prev.x,prev.y),b=worldToScreen(n.x,n.y),w=Math.max(1.2,(5.5-i*.75)*camera.zoom*c.g.size);X.strokeStyle='rgba(4,7,6,.68)';X.lineWidth=w+2.2;X.lineCap='round';X.beginPath();X.moveTo(a.x,a.y);X.lineTo(b.x,b.y);X.stroke();X.strokeStyle=i<2?col:v103HexAlpha(col,.88);X.lineWidth=w;X.beginPath();X.moveTo(a.x,a.y);X.lineTo(b.x,b.y);X.stroke();if(i===0){X.strokeStyle=v103HexAlpha(hi,.35);X.lineWidth=Math.max(.7,w*.22);X.beginPath();X.moveTo(a.x,a.y-w*.18);X.lineTo(b.x,b.y-w*.18);X.stroke();}prev=n;}
}
function v103DrawAnimal(c){
  const q=c.center(),s=worldToScreen(q.x,q.y);if(s.x<-180||s.x>SW+180||s.y<-180||s.y>SH+180)return;
  const col=c.alive?c.spec.color:'#343733',hi=c.alive?c.spec.hi:'#6d6a61';
  v103DrawTail(c,col,hi);for(const l of c.limbs)v103DrawLimb(c,l,col,hi);
  const geo=v103BodyGeometry(c),head=geo.pts[0],hr=c.nodes[0].r*camera.zoom;
  const shadow=X.createRadialGradient(s.x,s.y+hr*.7,2,s.x,s.y+hr*.7,Math.max(18,hr*3.8));shadow.addColorStop(0,'rgba(0,0,0,.34)');shadow.addColorStop(1,'rgba(0,0,0,0)');X.fillStyle=shadow;X.beginPath();X.ellipse(s.x,s.y+hr*.65,hr*3.2,hr*.65,0,0,TAU);X.fill();
  const bodyGrad=X.createLinearGradient(s.x-hr*2,s.y-hr*2,s.x+hr*2,s.y+hr*2);bodyGrad.addColorStop(0,hi);bodyGrad.addColorStop(.28,col);bodyGrad.addColorStop(.72,col);bodyGrad.addColorStop(1,'#18201d');X.fillStyle=bodyGrad;X.fill(geo.path);
  X.strokeStyle='rgba(3,6,5,.68)';X.lineWidth=Math.max(1.3,camera.zoom*1.6);X.stroke(geo.path);
  X.save();X.clip(geo.path);
  const sheen=X.createRadialGradient(head.x-hr*.5,head.y-hr*.7,0,head.x-hr*.2,head.y-hr*.3,hr*4.4);sheen.addColorStop(0,'rgba(255,255,240,.30)');sheen.addColorStop(.28,'rgba(210,235,218,.10)');sheen.addColorStop(1,'rgba(0,0,0,0)');X.fillStyle=sheen;X.fillRect(s.x-hr*5,s.y-hr*4,hr*10,hr*8);
  for(let i=0;i<c.nodes.length;i++)for(let k=0;k<3;k++){const n=geo.pts[i],rx=(hash(c.id*911+i*37+k*101)-.5)*c.nodes[i].r*1.25*camera.zoom,ry=(hash(c.id*733+i*71+k*31)-.5)*c.nodes[i].r*.75*camera.zoom;X.fillStyle=(k===0)?'rgba(0,0,0,.09)':'rgba(235,245,225,.045)';X.beginPath();X.arc(n.x+rx,n.y+ry,Math.max(.6,camera.zoom*(.6+hash(i*44+k)*1.2)),0,TAU);X.fill();}
  X.restore();
  const snout=c.spec.family==='lizard'?1.2:c.spec.role==='pred'?1.05:.72;
  const sx=head.x+c.face*hr*.76*snout,sy=head.y+hr*.06;
  const muzzle=X.createLinearGradient(head.x,head.y,sx,sy);muzzle.addColorStop(0,v103HexAlpha(hi,.72));muzzle.addColorStop(1,v103HexAlpha(col,.92));X.fillStyle=muzzle;X.beginPath();X.ellipse(sx,sy,hr*.78*snout,hr*.42,0,0,TAU);X.fill();
  X.fillStyle='#111512';X.beginPath();X.ellipse(sx+c.face*hr*.42*snout,sy-hr*.05,hr*.11,hr*.08,0,0,TAU);X.fill();
  const eyeX=head.x+c.face*hr*.44,eyeY=head.y-hr*.33;X.fillStyle='rgba(5,8,7,.95)';X.beginPath();X.ellipse(eyeX,eyeY,hr*.22,hr*.18,0,0,TAU);X.fill();X.fillStyle=c.spec.role==='pred'?'#d8bd72':'#b9d5c1';X.beginPath();X.arc(eyeX+c.face*hr*.055,eyeY-hr*.035,Math.max(1,hr*.065),0,TAU);X.fill();
  X.strokeStyle='rgba(20,15,13,.82)';X.lineWidth=Math.max(1,camera.zoom);X.beginPath();X.moveTo(head.x+c.face*hr*.25,head.y+hr*.28);X.quadraticCurveTo(sx,sy+hr*.24,sx+c.face*hr*.38,sy+hr*.10);X.stroke();
  if(c.spec.role==='pred'){X.fillStyle='#d9d0b7';for(let t=0;t<3;t++){const xx=head.x+c.face*hr*(.55+t*.18),yy=head.y+hr*.27;X.beginPath();X.moveTo(xx,yy);X.lineTo(xx+c.face*hr*.08,yy+hr*.22);X.lineTo(xx+c.face*hr*.15,yy);X.closePath();X.fill();}}
  if(c.ecoRot&&c.ecoRot.stage>.25){X.fillStyle=`rgba(74,63,48,${.15+c.ecoRot.stage*.30})`;X.fill(geo.path);}
  if(debugBody){X.strokeStyle='#8fe0be77';for(const n of c.nodes){const p=worldToScreen(n.x,n.y);X.beginPath();X.arc(p.x,p.y,n.r*camera.zoom,0,TAU);X.stroke();}}
}
function v103DrawJelly(c){
  const q=c.center(),s=worldToScreen(q.x,q.y);if(s.x<-220||s.x>SW+220||s.y<-220||s.y>SH+220)return;
  for(const l of c.limbs){if(l.disabled)continue;const a=worldToScreen(c.nodes[l.anchor].x,c.nodes[l.anchor].y),h=worldToScreen(l.hand.x,l.hand.y),dx=h.x-a.x,dy=h.y-a.y,d=Math.hypot(dx,dy)||1,nx=-dy/d,ny=dx/d,bend=l.side*Math.min(24*camera.zoom,d*.32),m={x:(a.x+h.x)*.5+nx*bend,y:(a.y+h.y)*.5+ny*bend};X.strokeStyle='rgba(105,175,165,.22)';X.lineWidth=10*camera.zoom*c.g.size;X.lineCap='round';X.beginPath();X.moveTo(a.x,a.y);X.quadraticCurveTo(m.x,m.y,h.x,h.y);X.stroke();X.strokeStyle='rgba(201,244,222,.38)';X.lineWidth=2.2*camera.zoom*c.g.size;X.beginPath();X.moveTo(a.x,a.y);X.quadraticCurveTo(m.x,m.y,h.x,h.y);X.stroke();}
  const geo=v103BodyGeometry(c),hr=c.nodes[0].r*camera.zoom,pulse=.96+.06*Math.sin(simTick*.045+c.id);
  X.save();X.globalCompositeOperation='screen';
  const membrane=X.createRadialGradient(s.x-hr,s.y-hr*.7,hr*.2,s.x,s.y,hr*4.8);membrane.addColorStop(0,'rgba(225,255,236,.46)');membrane.addColorStop(.24,'rgba(126,211,197,.34)');membrane.addColorStop(.72,'rgba(67,129,127,.25)');membrane.addColorStop(1,'rgba(31,66,69,.16)');X.fillStyle=membrane;X.fill(geo.path);X.strokeStyle='rgba(216,255,233,.58)';X.lineWidth=Math.max(1.2,1.7*camera.zoom);X.stroke(geo.path);
  X.save();X.clip(geo.path);
  for(let i=0;i<c.nodes.length;i++){const p=geo.pts[i],r=c.nodes[i].r*camera.zoom*pulse;const org=X.createRadialGradient(p.x-r*.2,p.y-r*.3,1,p.x,p.y,r*1.15);org.addColorStop(0,i===0?'rgba(245,255,214,.62)':'rgba(185,105,149,.45)');org.addColorStop(1,'rgba(53,36,69,.05)');X.fillStyle=org;X.beginPath();X.ellipse(p.x,p.y,r*.68,r*.46,.3*Math.sin(i+c.id),0,TAU);X.fill();}
  X.strokeStyle='rgba(219,240,208,.22)';X.lineWidth=Math.max(.7,camera.zoom*.8);for(let i=1;i<geo.pts.length;i++){const a=geo.pts[i-1],b=geo.pts[i];X.beginPath();X.moveTo(a.x,a.y);X.quadraticCurveTo((a.x+b.x)*.5,a.y-7*Math.sin(simTick*.02+i),b.x,b.y);X.stroke();}
  for(let i=0;i<8;i++){const p=geo.pts[i%geo.pts.length],rr=hr*(.11+hash(c.id*13+i)*.10),ox=(hash(c.id*71+i*3)-.5)*hr*2.5,oy=(hash(c.id*97+i*11)-.5)*hr*1.6;X.fillStyle='rgba(235,255,238,.14)';X.beginPath();X.arc(p.x+ox,p.y+oy,rr,0,TAU);X.fill();}
  X.restore();X.restore();
  const head=geo.pts[0];X.fillStyle='rgba(12,18,18,.88)';for(let e=-1;e<=1;e+=2){X.beginPath();X.ellipse(head.x+c.face*hr*.35,head.y+e*hr*.23,hr*.12,hr*.17,0,0,TAU);X.fill();X.fillStyle='rgba(214,251,223,.52)';X.beginPath();X.arc(head.x+c.face*hr*.39,head.y+e*hr*.20,Math.max(.8,hr*.035),0,TAU);X.fill();X.fillStyle='rgba(12,18,18,.88)';}
}

drawCreature=function(c){if(c.spec.family==='jelly')v103DrawJelly(c);else v103DrawAnimal(c);};

function v103DrawPuddles(){
  for(const p of V103_PUDDLES){const s=worldToScreen(p.x,p.y),r=p.r*camera.zoom;if(s.x<-50||s.x>SW+50||s.y<-50||s.y>SH+50)continue;const gr=X.createRadialGradient(s.x-r*.25,s.y-r*.25,1,s.x,s.y,r);gr.addColorStop(0,'rgba(206,248,219,.34)');gr.addColorStop(.48,'rgba(85,161,145,.29)');gr.addColorStop(1,'rgba(32,88,83,.04)');X.fillStyle=gr;X.beginPath();X.ellipse(s.x,s.y,r,r*.30,0,0,TAU);X.fill();X.strokeStyle='rgba(218,255,226,.20)';X.lineWidth=Math.max(.5,camera.zoom*.7);X.stroke();}
}
function v103DrawDrops(){
  for(const d of V103_SLIME){const s=worldToScreen(d.x,d.y),r=d.r*camera.zoom,v=velocity(d),sp=Math.hypot(v.x,v.y);if(s.x<-30||s.x>SW+30||s.y<-30||s.y>SH+30)continue;X.save();X.translate(s.x,s.y);X.rotate(Math.atan2(v.y,v.x));const gr=X.createRadialGradient(-r*.3,-r*.3,.2,0,0,r*1.5);gr.addColorStop(0,`rgba(228,255,232,${d.alpha})`);gr.addColorStop(.45,`rgba(97,193,169,${d.alpha*.72})`);gr.addColorStop(1,'rgba(31,94,88,.05)');X.fillStyle=gr;X.beginPath();X.ellipse(0,0,r*(1+Math.min(1.5,sp)*.38),r/(1+Math.min(1.2,sp)*.18),0,0,TAU);X.fill();X.restore();}
}
const V103_baseDrawPlants=drawPlants;
drawPlants=function(t){v103DrawPuddles();V103_baseDrawPlants(t);};
const V103_baseDrawWeather=drawWeather;
drawWeather=function(){V103_baseDrawWeather();v103DrawDrops();};

const V103_baseUpdateUI=updateUI;
updateUI=function(){V103_baseUpdateUI();if(stats)stats.innerHTML+=`<br>2.5× material render · ${V103_SLIME.length} slime bodies · ${V103_PUDDLES.length} puddles`;};
