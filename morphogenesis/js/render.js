// ---------------- visuals ----------------
function render(){
  ctx.setTransform(DPR,0,0,DPR,0,0);

  const bg=ctx.createLinearGradient(0,0,0,SH);
  bg.addColorStop(0,'#092437');
  bg.addColorStop(.42,'#041421');
  bg.addColorStop(1,'#010409');
  ctx.fillStyle=bg;ctx.fillRect(0,0,SW,SH);

  for(let band=0;band<3;band++){
    ctx.strokeStyle=`rgba(90,205,230,${.025-band*.005})`;ctx.lineWidth=1;
    for(let y=18+band*13;y<SH;y+=62){
      ctx.beginPath();
      for(let x=0;x<=SW;x+=28){
        const yy=y+Math.sin(x*(.012+band*.003)+time*(.45+band*.11)+y*.012)*3.5;
        if(!x)ctx.moveTo(x,yy);else ctx.lineTo(x,yy);
      }
      ctx.stroke();
    }
  }

  if(SH>0){
    ctx.save();ctx.globalCompositeOperation='screen';
    for(let i=0;i<7;i++){
      const y=SH*(.08+i*.055)+Math.sin(time*.25+i)*12;
      const gr=ctx.createLinearGradient(0,y-12,0,y+12);
      gr.addColorStop(0,'rgba(90,210,225,0)');gr.addColorStop(.5,'rgba(90,210,225,.018)');gr.addColorStop(1,'rgba(90,210,225,0)');
      ctx.fillStyle=gr;ctx.fillRect(0,y-12,SW,24);
    }
    ctx.restore();
  }

  for(let i=0;i<145;i++){
    const layer=1+(i%3),x=(i*91.7+time*(2.2+layer*1.8))%SW,y=(i*57.9+Math.sin(time*.2+i)*2)%SH;
    ctx.fillStyle=`rgba(150,235,245,${.035+.012*layer})`;ctx.fillRect(x,y,layer===3?1.4:1,layer===3?1.4:1);
  }

  for(const c of carcasses){const p=ws(c.x,c.y);if(p.x>-50&&p.x<SW+50&&p.y>-50&&p.y<SH+50)c.draw()}
  for(const f of foods){const p=ws(f.x,f.y);if(p.x>-12&&p.x<SW+12&&p.y>-12&&p.y<SH+12)f.draw()}
  for(const c of creatures){const p=ws(c.x,c.y);if(p.x>-220&&p.x<SW+220&&p.y>-220&&p.y<SH+220)c.draw()}

  for(const q of particles){
    q.x+=q.vx;q.y+=q.vy;q.vx*=.96;q.vy*=.96;q.l--;
    const p=ws(q.x,q.y);ctx.fillStyle=`hsla(${q.h},90%,70%,${clamp(q.l/28,0,1)})`;ctx.fillRect(p.x,p.y,1.5,1.5);
  }
  particles=particles.filter(q=>q.l>0);
}

function updateHUD(){
  let best=null,seg=0,eyes=0,limbs=0,carn=0,jaw=0,armor=0,stomach=0,wounds=0;
  const species=new Set();

  for(const c of creatures){
    if(!best||c.fitness()>best.fitness())best=c;
    seg+=c.g.segments;eyes+=c.g.eyes;limbs+=c.g.limbs;carn+=c.g.carnivore;
    jaw+=c.g.jaw;armor+=c.g.armor;stomach+=c.stomach;wounds+=c.wounds.length;
    species.add(speciesKey(c.g));
  }

  const n=creatures.length||1;
  hud.innerHTML=
    '<b>MORPHOGENESIS V1 · ORGANIC BODY PATCH</b> · GEN '+generation+'<br>'+
    'LIFE '+creatures.length+' · FOOD '+foods.length+' · CARCASS '+carcasses.length+' · FORMS '+species.size+'<br>'+
    'BIRTH '+births+' · DEATH '+deaths+' · BITE '+bites+' · SWALLOW '+swallows+' · WOUND '+woundsMade+'<br>'+
    'AVG SEG '+(seg/n).toFixed(1)+' · EYES '+(eyes/n).toFixed(1)+' · LIMBS '+(limbs/n).toFixed(1)+'<br>'+
    'CARN '+(carn/n).toFixed(2)+' · JAW '+(jaw/n).toFixed(2)+' · ARMOR '+(armor/n).toFixed(2)+' · WOUNDS '+(wounds/n).toFixed(1)+'<br>'+
    'AVG GUT '+(stomach/n).toFixed(1)+' · BEST '+(best?best.fitness().toFixed(1):'0')+' · BANK '+geneBank.length+'<br>'+
    'FPS '+fps.toFixed(0)+' · SIM ×'+simSpeed;
}
