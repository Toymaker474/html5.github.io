'use strict';
/* GENESIS fluid refinement pass.
   Conservative 2x subcell water-volume solver layered over the existing V110
   coarse water reservoir. This is a browser-oriented finite-volume/cellular
   approximation, not Navier-Stokes CFD. Rendering is derived from WATER state.
*/
(function(){
  if(typeof V104_COLS==='undefined'||typeof V104_ROWS==='undefined'||typeof V104_CELL==='undefined') return;
  if(!window.GENESIS_V110?.fields?.volume) return;

  const SCALE=2;
  const CW=V104_COLS, CH=V104_ROWS, W=CW*SCALE, H=CH*SCALE, N=W*H;
  const CELL=V104_CELL/SCALE, CAP=1.18, EPS=.0005;
  const WATER=new Float32Array(N), VX=new Float32Array(N), VY=new Float32Array(N);
  const SOLID=new Uint8Array(N);
  const coarse=window.GENESIS_V110.fields;
  let tick=0,lastMs=0,lastResidual=0,lastMass=0,coarseExchange=0,bodyDisplaced=0,terrainEvacLost=0;
  let fluidCanvas=null,fluidCtx=null,fluidImage=null,fluidW=0,fluidH=0;

  const I=(x,y)=>y*W+x, CI=(x,y)=>y*CW+x;
  const c01=v=>Math.max(0,Math.min(1,v));
  const inside=(x,y)=>x>0&&y>0&&x<W-1&&y<H-1;
  const coarseSolid=(cx,cy)=>v104SolidMat(v104Get(cx,cy));

  function fineBounds(margin=4){
    const b=typeof v104VisibleMicroBounds==='function'?v104VisibleMicroBounds(Math.ceil(margin/SCALE)):{l:1,r:CW-2,t:1,b:CH-2};
    return {l:Math.max(1,b.l*SCALE-margin),r:Math.min(W-2,(b.r+1)*SCALE-1+margin),t:Math.max(1,b.t*SCALE-margin),b:Math.min(H-2,(b.b+1)*SCALE-1+margin)};
  }

  function setSolidBlock(cx,cy,solid){
    const x0=cx*SCALE,y0=cy*SCALE;
    for(let oy=0;oy<SCALE;oy++)for(let ox=0;ox<SCALE;ox++)SOLID[I(x0+ox,y0+oy)]=solid?1:0;
  }

  function rebuildSolid(){
    for(let cy=0;cy<CH;cy++)for(let cx=0;cx<CW;cx++)setSolidBlock(cx,cy,coarseSolid(cx,cy));
  }

  function addToBlock(cx,cy,mass){
    if(Math.abs(mass)<1e-8)return 0;
    const cells=[];for(let oy=SCALE-1;oy>=0;oy--)for(let ox=0;ox<SCALE;ox++){const x=cx*SCALE+ox,y=cy*SCALE+oy,i=I(x,y);if(!SOLID[i])cells.push(i)}
    if(!cells.length)return mass;
    if(mass>0){
      let left=mass;
      for(const i of cells){const a=Math.min(left,CAP-WATER[i]);if(a>0){WATER[i]+=a;left-=a}if(left<=1e-7)break}
      return left;
    }
    let need=-mass,total=0;for(const i of cells)total+=WATER[i];
    if(total<=EPS)return -need;
    const take=Math.min(need,total),ratio=(total-take)/total;for(const i of cells)WATER[i]*=ratio;
    return -(need-take);
  }

  function blockMass(cx,cy){let s=0;const x0=cx*SCALE,y0=cy*SCALE;for(let oy=0;oy<SCALE;oy++)for(let ox=0;ox<SCALE;ox++)s+=WATER[I(x0+ox,y0+oy)];return s}

  function seedFromCoarse(){
    WATER.fill(0);VX.fill(0);VY.fill(0);rebuildSolid();coarseExchange=0;terrainEvacLost=0;
    for(let cy=0;cy<CH;cy++)for(let cx=0;cx<CW;cx++){const ci=CI(cx,cy),target=Math.max(0,Math.min(CAP,coarse.volume[ci]||0))*SCALE*SCALE;addToBlock(cx,cy,target)}
    lastMass=totalMass();
  }

  function evacuateFineCell(x,y){
    const i=I(x,y),m=WATER[i];if(m<=EPS){WATER[i]=0;return}
    WATER[i]=0;let left=m;
    const order=[[0,-1],[-1,0],[1,0],[-1,-1],[1,-1],[0,1],[-1,1],[1,1]];
    for(const [dx,dy] of order){const nx=x+dx,ny=y+dy;if(!inside(nx,ny))continue;const j=I(nx,ny);if(SOLID[j])continue;const a=Math.min(left,CAP-WATER[j]);if(a>0){WATER[j]+=a;left-=a}if(left<=EPS)break}
    if(left>EPS)terrainEvacLost+=left;
  }

  function refreshTerrain(b){
    const cl=Math.max(0,(b.l/SCALE|0)-1),cr=Math.min(CW-1,(b.r/SCALE|0)+1),ct=Math.max(0,(b.t/SCALE|0)-1),cb=Math.min(CH-1,(b.b/SCALE|0)+1);
    for(let cy=ct;cy<=cb;cy++)for(let cx=cl;cx<=cr;cx++){
      const solid=coarseSolid(cx,cy),x0=cx*SCALE,y0=cy*SCALE;
      for(let oy=0;oy<SCALE;oy++)for(let ox=0;ox<SCALE;ox++){const x=x0+ox,y=y0+oy,i=I(x,y),was=SOLID[i];SOLID[i]=solid?1:0;if(!was&&solid&&WATER[i]>EPS)evacuateFineCell(x,y)}
    }
  }

  function syncFromCoarse(b,strength=.16){
    const cl=Math.max(0,b.l/SCALE|0),cr=Math.min(CW-1,b.r/SCALE|0),ct=Math.max(0,b.t/SCALE|0),cb=Math.min(CH-1,b.b/SCALE|0);
    let exchanged=0;
    for(let cy=ct;cy<=cb;cy++)for(let cx=cl;cx<=cr;cx++){
      const target=Math.max(0,Math.min(CAP,coarse.volume[CI(cx,cy)]||0))*4,actual=blockMass(cx,cy),delta=(target-actual)*strength;
      if(Math.abs(delta)>.0001){const remainder=addToBlock(cx,cy,delta);exchanged+=delta-remainder}
    }
    coarseExchange+=exchanged;return exchanged;
  }

  function syncToCoarse(b,strength=.42){
    const cl=Math.max(0,b.l/SCALE|0),cr=Math.min(CW-1,b.r/SCALE|0),ct=Math.max(0,b.t/SCALE|0),cb=Math.min(CH-1,b.b/SCALE|0);
    for(let cy=ct;cy<=cb;cy++)for(let cx=cl;cx<=cr;cx++){
      const ci=CI(cx,cy),avg=blockMass(cx,cy)*.25,old=coarse.volume[ci]||0;
      coarse.volume[ci]=old+(avg-old)*strength;
      const m=V104_M[ci];
      if((m===V104_MAT.AIR||m===V104_MAT.WATER)){
        if(avg>.34)V104_M[ci]=V104_MAT.WATER;
        else if(avg<.055)V104_M[ci]=V104_MAT.AIR;
      }
    }
  }

  function move(i,j,amount,dx,dy){
    if(amount<=0||WATER[i]<=EPS||SOLID[j])return 0;
    const a=Math.min(amount,WATER[i],Math.max(0,CAP-WATER[j]));if(a<=0)return 0;
    WATER[i]-=a;WATER[j]+=a;
    const ivx=VX[i],ivy=VY[i],mix=.22*Math.min(1,a/.08);
    VX[j]=VX[j]*(1-mix)+(ivx+dx*.42)*mix;VY[j]=VY[j]*(1-mix)+(ivy+dy*.48)*mix;
    VX[i]*=.992;VY[i]*=.992;return a;
  }

  function solveCell(x,y,b,dir){
    const i=I(x,y);if(SOLID[i]||WATER[i]<=EPS){VX[i]*=.88;VY[i]*=.88;return}
    VX[i]*=.92;VY[i]=VY[i]*.90+.055;
    let down=0,left=0,right=0;
    if(y<b.b){const j=I(x,y+1);if(!SOLID[j]){const room=Math.max(0,CAP-WATER[j]);const pressure=Math.max(0,WATER[i]-1)*.08;down=move(i,j,Math.min(.22,room*.65+.06+pressure+Math.max(0,VY[i])*.018),0,1)}}
    if(WATER[i]>EPS&&down<.035&&y<b.b){
      for(const dx of [dir,-dir]){const nx=x+dx;if(nx<b.l||nx>b.r)continue;const j=I(nx,y+1);if(SOLID[j])continue;const a=move(i,j,Math.min(.065,.018+WATER[i]*.055),dx,1);if(dx<0)left+=a;else right+=a;if(WATER[i]<=EPS)break}
    }
    if(WATER[i]>EPS){
      for(const dx of [dir,-dir]){const nx=x+dx;if(nx<b.l||nx>b.r)continue;const j=I(nx,y);if(SOLID[j])continue;const diff=WATER[i]-WATER[j];if(diff>.018){const momentum=(dx>0?VX[i]:-VX[i])*.008;const a=move(i,j,Math.min(.052,Math.max(0,diff*.115+momentum)),dx,0);if(dx<0)left+=a;else right+=a}}
    }
    VX[i]=VX[i]*.82+(right-left)*3.2;VY[i]=VY[i]*.84+down*2.4;
  }

  function massInBounds(b){let s=0;for(let y=b.t;y<=b.b;y++)for(let x=b.l;x<=b.r;x++)s+=WATER[I(x,y)];return s}
  function solveBounds(b){
    const before=massInBounds(b),dir=(tick&1)?1:-1;
    for(let y=b.b;y>=b.t;y--){if(dir>0){for(let x=b.l;x<=b.r;x++)solveCell(x,y,b,dir)}else{for(let x=b.r;x>=b.l;x--)solveCell(x,y,b,dir)}}
    const after=massInBounds(b);lastResidual=after-before;return after;
  }

  function sample(wx,wy){
    const x=Math.max(0,Math.min(W-1,Math.floor(wx/CELL))),y=Math.max(0,Math.min(H-1,Math.floor(wy/CELL))),i=I(x,y);
    return{water:WATER[i],vx:VX[i],vy:VY[i],solid:!!SOLID[i],x,y,index:i};
  }

  function displaceAt(x,y,amount,dx){
    if(!inside(x,y))return 0;const i=I(x,y),a=Math.min(WATER[i],amount);if(a<=0)return 0;WATER[i]-=a;let left=a;
    const order=dx>=0?[[1,0],[1,-1],[0,-1],[-1,0]]:[[-1,0],[-1,-1],[0,-1],[1,0]];
    for(const [ox,oy] of order){const nx=x+ox,ny=y+oy;if(!inside(nx,ny))continue;const j=I(nx,ny);if(SOLID[j])continue;const q=Math.min(left,CAP-WATER[j]);if(q>0){WATER[j]+=q;VX[j]+=ox*q*.7;VY[j]+=oy*q*.35;left-=q}if(left<=EPS)break}
    if(left>0)WATER[i]+=left;return a-left;
  }

  function coupleCreatures(){
    if(typeof creatures==='undefined')return;
    for(const c of creatures){if(!c?.alive||c.gone)continue;for(const n of c.nodes||[]){const s=sample(n.x,n.y);if(s.water<.08||s.solid)continue;const d=c01(s.water),vx=n.x-n.px,vy=n.y-n.py,drag=.035+d*.12;
      const nvx=vx*(1-drag)+s.vx*.045*d,nvy=vy*(1-drag)+s.vy*.025*d-.048*d;
      n.px=n.x-nvx;n.py=n.y-nvy;
      const moved=displaceAt(s.x,s.y,Math.min(.022,.004+.003*(n.r||2)/CELL),vx);bodyDisplaced+=moved;
    }}
  }

  function totalMass(){let s=0;for(let i=0;i<N;i++)s+=WATER[i];return s}

  function stepOnce(opts={}){
    const t0=typeof performance!=='undefined'&&performance.now?performance.now():0;
    tick++;
    const b=opts.bounds||fineBounds(6);
    refreshTerrain(b);
    if(opts.sync!==false&&tick%3===0)syncFromCoarse(b,.15);
    solveBounds(b);
    if(opts.couple!==false)coupleCreatures();
    if(opts.sync!==false&&tick%3===0)syncToCoarse(b,.38);
    lastMass=totalMass();
    const t1=typeof performance!=='undefined'&&performance.now?performance.now():t0;lastMs=t1-t0;
    return b;
  }

  function ensureFluidBuffer(w,h){
    if(!fluidCanvas){fluidCanvas=document.createElement('canvas');fluidCtx=fluidCanvas.getContext('2d',{alpha:true});}
    if(w===fluidW&&h===fluidH&&fluidImage)return;fluidW=w;fluidH=h;fluidCanvas.width=w;fluidCanvas.height=h;fluidImage=fluidCtx.createImageData(w,h);
  }

  function renderFluid(){
    if(typeof document==='undefined'||typeof X==='undefined')return;
    const b=fineBounds(2),w=b.r-b.l+1,h=b.b-b.t+1;if(w<2||h<2)return;ensureFluidBuffer(w,h);
    const d=fluidImage.data;let p=0;
    for(let y=b.t;y<=b.b;y++)for(let x=b.l;x<=b.r;x++){
      const i=I(x,y),v=WATER[i],speed=Math.min(1,Math.hypot(VX[i],VY[i])*.9);
      if(v<.015||SOLID[i]){d[p++]=0;d[p++]=0;d[p++]=0;d[p++]=0;continue}
      const depth=c01(v),ci=CI(Math.floor(x/SCALE),Math.floor(y/SCALE)),sed=Math.min(1,(coarse.sediment?.[ci]||0)*.7);
      d[p++]=(25+sed*36+speed*10)|0;d[p++]=(78+depth*37-sed*18)|0;d[p++]=(102+depth*50-sed*16)|0;d[p++]=(35+depth*122+speed*18)|0;
    }
    fluidCtx.putImageData(fluidImage,0,0);
    const q=worldToScreen(b.l*CELL,b.t*CELL),dw=w*CELL*camera.zoom,dh=h*CELL*camera.zoom;
    X.save();X.imageSmoothingEnabled=true;X.imageSmoothingQuality='high';X.drawImage(fluidCanvas,q.x,q.y,dw,dh);X.restore();
    drawSurface(b);
  }

  function drawSurface(b){
    const pts=[];let lastY=-999;
    for(let x=b.l;x<=b.r;x+=2){let sy=-1,spd=0;for(let y=b.t;y<=b.b;y++){const i=I(x,y);if(!SOLID[i]&&WATER[i]>.16){sy=y;spd=Math.hypot(VX[i],VY[i]);break}}
      if(sy<0||Math.abs(sy-lastY)>8){if(pts.length>2)strokeSurface(pts);pts.length=0;if(sy<0){lastY=-999;continue}}
      const q=worldToScreen((x+.5)*CELL,sy*CELL);pts.push({x:q.x,y:q.y,s:spd});lastY=sy;
    }if(pts.length>2)strokeSurface(pts);
  }

  function strokeSurface(pts){
    X.save();X.lineCap='round';X.lineJoin='round';X.strokeStyle='rgba(190,234,238,.42)';X.lineWidth=Math.max(.7,1.05*camera.zoom);X.beginPath();X.moveTo(pts[0].x,pts[0].y);
    for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i];X.quadraticCurveTo(a.x,a.y,(a.x+b.x)*.5,(a.y+b.y)*.5)}X.stroke();
    X.fillStyle='rgba(220,244,240,.20)';for(let i=2;i<pts.length-2;i+=5){if(pts[i].s<.20)continue;X.beginPath();X.arc(pts[i].x,pts[i].y,Math.max(.45,.7*camera.zoom),0,Math.PI*2);X.fill()}X.restore();
  }

  function metrics(){return{scale:SCALE,cell:CELL,width:W,height:H,waterMass:lastMass,activeSolveMs:lastMs,solveResidual:lastResidual,coarseExchange,bodyDisplaced,terrainEvacLost,approximation:'conservative 2x subcell volume-relaxation solver; not Navier-Stokes CFD'};}

  seedFromCoarse();

  const STEP=step;step=function(){STEP();stepOnce();};
  const RESET=reset;reset=function(){RESET();seedFromCoarse();};
  const TERR=drawTerrain;drawTerrain=function(t){TERR(t);renderFluid();};

  window.GENESIS_FLUID_REFINEMENT={
    status:'experimental',version:1,scale:SCALE,cell:CELL,width:W,height:H,fields:{water:WATER,velocityX:VX,velocityY:VY,solid:SOLID},metrics,sample,
    stepOnce,seedFromCoarse,syncFromCoarse,syncToCoarse,coupleCreatures,
    debugClearWater(){WATER.fill(0);VX.fill(0);VY.fill(0);lastMass=0;},
    debugSet(x,y,v){if(inside(x,y)&&!SOLID[I(x,y)])WATER[I(x,y)]=Math.max(0,Math.min(CAP,v));},
    debugSetVelocity(x,y,vx,vy){if(inside(x,y)){VX[I(x,y)]=vx;VY[I(x,y)]=vy;}},
    debugMass:totalMass,
    debugCenterOfMassY(){let m=0,my=0;for(let y=0;y<H;y++)for(let x=0;x<W;x++){const v=WATER[I(x,y)];m+=v;my+=v*y}return m?my/m:0;}
  };
})();
