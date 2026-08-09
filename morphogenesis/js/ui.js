// ---------------- controls ----------------
$('speed').onclick=()=>{
  simSpeed=simSpeed===1?2:simSpeed===2?4:simSpeed===4?8:1;
  $('speed').textContent='SIM ×'+simSpeed;
};

$('follow').onclick=()=>{
  follow=!follow;
  $('follow').textContent=follow?'FOLLOWING ✓':'FOLLOW CHAMPION';
};

$('storm').onclick=()=>{
  for(const c of creatures){
    if(Math.random()<.38){
      c.g=mutateGene(c.g,2.2);
      c.b=mutateBrain(c.b,2.2);
      c.rebuildSpine();
    }
  }

  const p={x:cam.x,y:cam.y};
  for(let i=0;i<120;i++){
    const f=new Food(p.x+gauss()*250,p.y+gauss()*250);
    wrap(f);
    foods.push(f);
  }

  burst(cam.x,cam.y,70,290);
};

$('audio').onclick=enableAudio;

canvas.addEventListener('wheel',e=>{
  e.preventDefault();
  cam.tz=clamp(cam.tz*Math.exp(-e.deltaY*.001),.08,3.5);
},{passive:false});

let down=false,lx=0,ly=0;
canvas.addEventListener('pointerdown',e=>{
  down=true;lx=e.clientX;ly=e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove',e=>{
  if(!down||follow)return;
  cam.x-=(e.clientX-lx)/cam.z;
  cam.y-=(e.clientY-ly)/cam.z;
  lx=e.clientX;ly=e.clientY;
});
canvas.addEventListener('pointerup',()=>down=false);
canvas.addEventListener('pointercancel',()=>down=false);

let lastTap=0;
canvas.addEventListener('click',e=>{
  const now=performance.now();
  if(now-lastTap<300){
    const p=sw(e.clientX,e.clientY);
    for(let i=0;i<50;i++){
      const f=new Food(p.x+gauss()*75,p.y+gauss()*75);
      wrap(f);
      foods.push(f);
    }
  }
  lastTap=now;
});
