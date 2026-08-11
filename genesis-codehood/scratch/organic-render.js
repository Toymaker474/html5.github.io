const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function visibleCell(env,view,x,y,pad=36){
  const px=view.sx(env.wx(x)),py=view.sy(env.wy(y)),r=env.cell*view.cam.z;
  return px>-r-pad&&px<view.W+r+pad&&py>-r-pad&&py<view.H+r+pad;
}

export function drawOrganicCaves(ctx,env,world,view){
  const C=env.cols,R=env.rows,c=env.cell,z=view.cam.z;
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  for(let y=0;y<R;y++)for(let x=0;x<C;x++){
    const i=env.idx(x,y);if(env.solid[i]||!visibleCell(env,view,x,y))continue;
    const wx=env.wx(x),wy=env.wy(y);if(wy<world.surfaceY(wx)+2)continue;
    const px=view.sx(wx),py=view.sy(wy),o=env.o2[i],co=env.co2[i];
    const rr=c*.59*z,red=7+Math.min(34,co*430),green=14+Math.min(18,o*46),blue=15+Math.min(16,o*38);
    ctx.fillStyle=`rgb(${red|0},${green|0},${blue|0})`;ctx.beginPath();ctx.arc(px,py,rr,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=rr*1.55;
    if(x+1<C&&!env.solid[env.idx(x+1,y)]){ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(view.sx(env.wx(x+1)),view.sy(wy));ctx.stroke();}
    if(y+1<R&&!env.solid[env.idx(x,y+1)]){ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(view.sx(wx),view.sy(env.wy(y+1)));ctx.stroke();}
  }
  ctx.globalCompositeOperation='screen';
  for(let y=0;y<R;y+=2)for(let x=0;x<C;x+=2){
    const i=env.idx(x,y);if(env.solid[i]||!visibleCell(env,view,x,y))continue;
    const co=env.co2[i],v=env.vapor[i];if(co<.006&&v<.008)continue;
    const px=view.sx(env.wx(x)),py=view.sy(env.wy(y)),r=c*(.7+clamp(co*7+v*11,0,.9))*z;
    const g=ctx.createRadialGradient(px,py,0,px,py,r);g.addColorStop(0,co>.018?`rgba(113,83,64,${clamp(co*2.6,.02,.12)})`:`rgba(117,157,151,${clamp(v*4,.02,.09)})`);g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(px-r,py-r,r*2,r*2);
  }
  ctx.restore();
}

export function drawOrganicCaveLiquids(ctx,env,world,view){
  const C=env.cols,R=env.rows,c=env.cell,z=view.cam.z;
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  const center=(x,y,i)=>{const wet=env.water[i]+env.urine[i],fill=clamp(wet,0,1),px=view.sx(env.wx(x)),base=view.sy(env.wy(y)+c*.47),h=Math.max(1,c*.84*fill*z),ur=env.urine[i]/Math.max(.0001,wet);return{wet,fill,px,base,h,ur,cy:base-h*.48}};
  for(let y=0;y<R;y++)for(let x=0;x<C;x++){
    const i=env.idx(x,y),wet=env.water[i]+env.urine[i];if(env.solid[i]||wet<.001||!visibleCell(env,view,x,y))continue;
    const a=center(x,y,i),rx=c*.54*z;
    const top=a.base-a.h;
    const gr=ctx.createLinearGradient(0,top,0,a.base);if(a.ur>.28){gr.addColorStop(0,'rgba(188,170,80,.72)');gr.addColorStop(1,'rgba(92,76,30,.88)');}else{gr.addColorStop(0,'rgba(93,190,201,.72)');gr.addColorStop(1,'rgba(12,66,81,.9)');}
    ctx.fillStyle=gr;ctx.beginPath();ctx.ellipse(a.px,a.cy,rx,a.h*.56,0,0,Math.PI*2);ctx.fill();
    for(const [dx,dy] of [[1,0],[0,1]]){const nx=x+dx,ny=y+dy;if(nx>=C||ny>=R)continue;const j=env.idx(nx,ny),w2=env.water[j]+env.urine[j];if(env.solid[j]||w2<.001)continue;const b=center(nx,ny,j),mixUr=(a.ur+b.ur)*.5;ctx.strokeStyle=mixUr>.28?'rgba(151,132,58,.76)':'rgba(54,145,160,.78)';ctx.lineWidth=Math.max(2,Math.min(a.h,b.h)*.74);ctx.beginPath();ctx.moveTo(a.px,a.cy);ctx.lineTo(b.px,b.cy);ctx.stroke();}
    ctx.strokeStyle='rgba(213,246,237,.28)';ctx.lineWidth=Math.max(.55,.7*z);ctx.beginPath();ctx.moveTo(a.px-rx*.72,top+a.h*.13);ctx.quadraticCurveTo(a.px,top-a.h*.08,a.px+rx*.72,top+a.h*.09);ctx.stroke();
  }
  ctx.restore();
}

export function drawOrganicClouds(ctx,env,view){
  const c=env.cell,z=view.cam.z;ctx.save();ctx.globalCompositeOperation='screen';
  for(let x=0;x<env.cols;x+=2){const q=(env.cloud[x]||0)+(env.cloud[Math.min(env.cols-1,x+1)]||0);if(q<.005)continue;const px=view.sx(env.wx(x),-.9),base=74+Math.sin(x*.46+env.time*.18)*17,r=(22+clamp(q*260,0,54))*z;const g=ctx.createRadialGradient(px-r*.18,base-r*.08,2,px,base,r);g.addColorStop(0,`rgba(222,232,225,${clamp(.09+q*4.5,.09,.31)})`);g.addColorStop(.48,`rgba(135,163,158,${clamp(.055+q*2.5,.055,.21)})`);g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(px-r,base-r,r*2,r*2);}
  ctx.restore();
}

export const RENDER_META={cellsVisible:false,cavePresentation:'overlapping circles/capsules from simulated void cells',liquidPresentation:'connected smooth ellipses from simulated liquid mass'};
