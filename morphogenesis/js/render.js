// ---------------- visuals ----------------
function render(){
  ctx.setTransform(DPR,0,0,DPR,0,0);

  const bg=ctx.createLinearGradient(0,0,0,SH);
  bg.addColorStop(0,'#071d2c');
  bg.addColorStop(.5,'#03111d');
  bg.addColorStop(1,'#010409');
  ctx.fillStyle=bg;
  ctx.fillRect(0,0,SW,SH);

  // low-cost flow lines make motion legible without pretending to be CFD
  ctx.strokeStyle='rgba(80,200,230,.035)';
  ctx.lineWidth=1;
  for(let y=20;y<SH;y+=40){
    ctx.beginPath();
    for(let x=0;x<=SW;x+=30){
      const yy=y+Math.sin(x*.018+time*.8+y*.018)*4;
      if(!x)ctx.moveTo(x,yy);else ctx.lineTo(x,yy);
    }
    ctx.stroke();
  }

  for(let i=0;i<110;i++){
    const x=(i*91.7+time*5.2)%SW,y=(i*57.9)%SH;
    ctx.fillStyle='rgba(130,230,250,.07)';
    ctx.fillRect(x,y,1,1);
  }

  for(const c of carcasses){
    const p=ws(c.x,c.y);
    if(p.x>-30&&p.x<SW+30&&p.y>-30&&p.y<SH+30)c.draw();
  }

  for(const f of foods){
    const p=ws(f.x,f.y);
    if(p.x>-10&&p.x<SW+10&&p.y>-10&&p.y<SH+10)f.draw();
  }

  for(const c of creatures){
    const p=ws(c.x,c.y);
    if(p.x>-180&&p.x<SW+180&&p.y>-180&&p.y<SH+180)c.draw();
  }

  for(const q of particles){
    q.x+=q.vx;q.y+=q.vy;q.vx*=.96;q.vy*=.96;q.l--;
    const p=ws(q.x,q.y);
    ctx.fillStyle=`hsla(${q.h},90%,70%,${clamp(q.l/28,0,1)})`;
    ctx.fillRect(p.x,p.y,1.5,1.5);
  }
  particles=particles.filter(q=>q.l>0);
}

function updateHUD(){
  let best=null,seg=0,eyes=0,limbs=0,carn=0,jaw=0,armor=0,stomach=0;

  for(const c of creatures){
    if(!best||c.fitness()>best.fitness())best=c;
    seg+=c.g.segments;eyes+=c.g.eyes;limbs+=c.g.limbs;carn+=c.g.carnivore;
    jaw+=c.g.jaw;armor+=c.g.armor;stomach+=c.stomach;
  }

  const n=creatures.length||1;

  hud.innerHTML=
    '<b>MORPHOGENESIS V1 · ANATOMY/MOTION PATCH</b> · GEN '+generation+'<br>'+
    'LIFE '+creatures.length+' · FOOD '+foods.length+' · CARCASS '+carcasses.length+'<br>'+
    'BIRTH '+births+' · DEATH '+deaths+' · BITE '+bites+' · SWALLOW '+swallows+'<br>'+
    'AVG SEG '+(seg/n).toFixed(1)+' · EYES '+(eyes/n).toFixed(1)+' · LIMBS '+(limbs/n).toFixed(1)+'<br>'+
    'CARN '+(carn/n).toFixed(2)+' · JAW '+(jaw/n).toFixed(2)+' · ARMOR '+(armor/n).toFixed(2)+'<br>'+
    'AVG GUT '+(stomach/n).toFixed(1)+' · BEST '+(best?best.fitness().toFixed(1):'0')+'<br>'+
    'FPS '+fps.toFixed(0)+' · SIM ×'+simSpeed;
}
