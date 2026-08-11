'use strict';
/* GENESIS camera-local 2D FLIP/PIC water + ocean layer.
   - Actual particle-in-cell / FLIP velocity transfer with MAC-grid pressure projection.
   - Continuous particle advection in world space; no falling-cell liquid motion.
   - Camera-local active solve for phone performance. Far/offscreen water remains in legacy reservoirs.
   - Ocean boundary is an external reservoir (tracked source/sink), with tide + wave forcing.
   - Terrain collision remains the authoritative 2D V104 material plane.
   This is a 2D incompressible free-surface approximation, NOT full 3D water physics.
*/
(function(root){
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const lerp=(a,b,t)=>a+(b-a)*t;

  function makeCore(opts={}){
    const nx=opts.nx||48, ny=opts.ny||48, h=opts.cell||1, dt=opts.dt||1/60;
    const maxP=opts.maxParticles||2048, flip=opts.flipRatio??0.93;
    const u=new Float32Array((nx+1)*ny), v=new Float32Array(nx*(ny+1));
    const u0=new Float32Array(u.length),v0=new Float32Array(v.length),uw=new Float32Array(u.length),vw=new Float32Array(v.length);
    const p=new Float32Array(nx*ny),pn=new Float32Array(nx*ny),div=new Float32Array(nx*ny);
    const fluid=new Uint8Array(nx*ny),solid=new Uint8Array(nx*ny),count=new Uint16Array(nx*ny);
    const px=new Float32Array(maxP),py=new Float32Array(maxP),pvx=new Float32Array(maxP),pvy=new Float32Array(maxP),alive=new Uint8Array(maxP);
    let nP=0,lastDivBefore=0,lastDivAfter=0,lastPressureIters=0;
    const ci=(x,y)=>y*nx+x, ui=(x,y)=>y*(nx+1)+x, vi=(x,y)=>y*nx+x;
    const inside=(x,y)=>x>=0&&y>=0&&x<nx&&y<ny;
    const isSolid=(x,y)=>!inside(x,y)||solid[ci(x,y)]!==0;
    function clearGrid(){u.fill(0);v.fill(0);uw.fill(0);vw.fill(0);fluid.fill(0);count.fill(0);}
    function addParticle(x,y,vx0=0,vy0=0){if(nP>=maxP)return-1;let id=-1;for(let i=0;i<maxP;i++)if(!alive[i]){id=i;break}if(id<0)return-1;alive[id]=1;px[id]=x;py[id]=y;pvx[id]=vx0;pvy[id]=vy0;nP++;return id}
    function killParticle(i){if(alive[i]){alive[i]=0;nP--}}
    function setSolid(x,y,on=1){if(inside(x,y))solid[ci(x,y)]=on?1:0}
    function clearSolid(){solid.fill(0)}
    function markFluid(){fluid.fill(0);count.fill(0);for(let i=0;i<maxP;i++)if(alive[i]){const x=clamp(Math.floor(px[i]/h),0,nx-1),y=clamp(Math.floor(py[i]/h),0,ny-1),k=ci(x,y);if(!solid[k]){fluid[k]=1;count[k]++}}}
    function splatU(x,y,val){const gx=x/h,gy=y/h-.5,x0=Math.floor(gx),y0=Math.floor(gy),tx=gx-x0,ty=gy-y0;for(let oy=0;oy<=1;oy++)for(let ox=0;ox<=1;ox++){const xx=x0+ox,yy=y0+oy;if(xx<0||xx>nx||yy<0||yy>=ny)continue;const w=(ox?tx:1-tx)*(oy?ty:1-ty),k=ui(xx,yy);u[k]+=val*w;uw[k]+=w}}
    function splatV(x,y,val){const gx=x/h-.5,gy=y/h,x0=Math.floor(gx),y0=Math.floor(gy),tx=gx-x0,ty=gy-y0;for(let oy=0;oy<=1;oy++)for(let ox=0;ox<=1;ox++){const xx=x0+ox,yy=y0+oy;if(xx<0||xx>=nx||yy<0||yy>ny)continue;const w=(ox?tx:1-tx)*(oy?ty:1-ty),k=vi(xx,yy);v[k]+=val*w;vw[k]+=w}}
    function particlesToGrid(){clearGrid();markFluid();for(let i=0;i<maxP;i++)if(alive[i]){splatU(px[i],py[i],pvx[i]);splatV(px[i],py[i],pvy[i])}for(let i=0;i<u.length;i++)u[i]=uw[i]>1e-6?u[i]/uw[i]:0;for(let i=0;i<v.length;i++)v[i]=vw[i]>1e-6?v[i]/vw[i]:0;u0.set(u);v0.set(v)}
    function sampleU(arr,x,y){const gx=x/h,gy=y/h-.5,x0=Math.floor(gx),y0=Math.floor(gy),tx=gx-x0,ty=gy-y0;let s=0,w0=0;for(let oy=0;oy<=1;oy++)for(let ox=0;ox<=1;ox++){const xx=x0+ox,yy=y0+oy;if(xx<0||xx>nx||yy<0||yy>=ny)continue;const w=(ox?tx:1-tx)*(oy?ty:1-ty);s+=arr[ui(xx,yy)]*w;w0+=w}return w0?s/w0:0}
    function sampleV(arr,x,y){const gx=x/h-.5,gy=y/h,x0=Math.floor(gx),y0=Math.floor(gy),tx=gx-x0,ty=gy-y0;let s=0,w0=0;for(let oy=0;oy<=1;oy++)for(let ox=0;ox<=1;ox++){const xx=x0+ox,yy=y0+oy;if(xx<0||xx>=nx||yy<0||yy>ny)continue;const w=(ox?tx:1-tx)*(oy?ty:1-ty);s+=arr[vi(xx,yy)]*w;w0+=w}return w0?s/w0:0}
    function applyGravity(g=9.81){for(let y=0;y<=ny;y++)for(let x=0;x<nx;x++){const k=vi(x,y);let wet=false;if(y>0&&fluid[ci(x,y-1)])wet=true;if(y<ny&&fluid[ci(x,y)])wet=true;if(wet)v[k]+=g*dt}}
    function enforceSolidFaces(){for(let y=0;y<ny;y++)for(let x=0;x<=nx;x++){const L=x>0&&isSolid(x-1,y),R=x<nx&&isSolid(x,y);if(L||R)u[ui(x,y)]=0}for(let y=0;y<=ny;y++)for(let x=0;x<nx;x++){const T=y>0&&isSolid(x,y-1),B=y<ny&&isSolid(x,y);if(T||B)v[vi(x,y)]=0}}
    function divergenceNorm(){let s=0,n=0;for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){const k=ci(x,y);if(!fluid[k]||solid[k])continue;const d=(u[ui(x+1,y)]-u[ui(x,y)]+v[vi(x,y+1)]-v[vi(x,y)])/h;s+=d*d;n++}return n?Math.sqrt(s/n):0}
    function project(iter=24,rho=1){enforceSolidFaces();lastDivBefore=divergenceNorm();p.fill(0);for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){const k=ci(x,y);div[k]=fluid[k]&&!solid[k]?(u[ui(x+1,y)]-u[ui(x,y)]+v[vi(x,y+1)]-v[vi(x,y)])/h:0}const scale=rho*h*h/dt;for(let it=0;it<iter;it++){for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){const k=ci(x,y);if(!fluid[k]||solid[k]){pn[k]=0;continue}let sum=0,n=0;for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){const xx=x+dx,yy=y+dy;if(!inside(xx,yy)||isSolid(xx,yy))continue;sum+=p[ci(xx,yy)];n++}pn[k]=n?(sum-div[k]*scale)/n:0}p.set(pn)}for(let y=0;y<ny;y++)for(let x=1;x<nx;x++){const L=ci(x-1,y),R=ci(x,y);if(solid[L]||solid[R]){u[ui(x,y)]=0;continue}if(fluid[L]||fluid[R])u[ui(x,y)]-=dt*(p[R]-p[L])/(rho*h)}for(let y=1;y<ny;y++)for(let x=0;x<nx;x++){const T=ci(x,y-1),B=ci(x,y);if(solid[T]||solid[B]){v[vi(x,y)]=0;continue}if(fluid[T]||fluid[B])v[vi(x,y)]-=dt*(p[B]-p[T])/(rho*h)}enforceSolidFaces();lastDivAfter=divergenceNorm();lastPressureIters=iter;return{before:lastDivBefore,after:lastDivAfter}}
    function gridToParticles(){for(let i=0;i<maxP;i++)if(alive[i]){const picU=sampleU(u,px[i],py[i]),picV=sampleV(v,px[i],py[i]);const oldU=sampleU(u0,px[i],py[i]),oldV=sampleV(v0,px[i],py[i]);const flipU=pvx[i]+(picU-oldU),flipV=pvy[i]+(picV-oldV);pvx[i]=lerp(picU,flipU,flip);pvy[i]=lerp(picV,flipV,flip)}}
    function collideParticle(i){let x=px[i],y=py[i],cx=Math.floor(x/h),cy=Math.floor(y/h);if(!isSolid(cx,cy))return;let best=null,bd=1e9;for(let oy=-2;oy<=2;oy++)for(let ox=-2;ox<=2;ox++){const xx=cx+ox,yy=cy+oy;if(!inside(xx,yy)||isSolid(xx,yy))continue;const qx=(xx+.5)*h,qy=(yy+.5)*h,d=(qx-x)*(qx-x)+(qy-y)*(qy-y);if(d<bd){bd=d;best=[qx,qy]}}if(best){px[i]=best[0];py[i]=best[1];pvx[i]*=.35;pvy[i]*=.18}else{py[i]=Math.max(.51*h,(cy-.5)*h);pvy[i]=Math.min(0,pvy[i])*.1}}
    function advectParticles(){for(let i=0;i<maxP;i++)if(alive[i]){let x=px[i],y=py[i];const u1=sampleU(u,x,y),v1=sampleV(v,x,y),mx=x+u1*dt*.5,my=y+v1*dt*.5,u2=sampleU(u,mx,my),v2=sampleV(v,mx,my);px[i]=clamp(x+u2*dt,.51*h,(nx-.51)*h);py[i]=clamp(y+v2*dt,.51*h,(ny-.51)*h);collideParticle(i)}}
    function step(opts={}){particlesToGrid();applyGravity(opts.gravity??9.81);if(opts.waveU){const side=opts.waveSide==='right'?'right':'left';for(let y=0;y<ny;y++){if(side==='left'){for(let x=0;x<nx;x++)if(fluid[ci(x,y)]&&!solid[ci(x,y)]){u[ui(x,y)]=opts.waveU;break}}else{for(let x=nx-1;x>=0;x--)if(fluid[ci(x,y)]&&!solid[ci(x,y)]){u[ui(x+1,y)]=opts.waveU;break}}}}const pr=project(opts.pressureIters||24,opts.rho||1);gridToParticles();advectParticles();return{particles:nP,divBefore:pr.before,divAfter:pr.after}}
    function particleMass(){return nP*(opts.particleMass||1)}
    return{nx,ny,h,dt,maxP,u,v,p,div,fluid,solid,count,px,py,pvx,pvy,alive,addParticle,killParticle,setSolid,clearSolid,markFluid,particlesToGrid,applyGravity,enforceSolidFaces,divergenceNorm,project,gridToParticles,advectParticles,step,sampleU,sampleV,particleMass,get particleCount(){return nP},get metrics(){return{divBefore:lastDivBefore,divAfter:lastDivAfter,pressureIters:lastPressureIters}}};
  }

  root.GENESIS_FLIP_OCEAN_TEST={makeCore,representation:'2D FLIP/PIC + MAC pressure projection',fallingSand:false,full3D:false};

  if(typeof window==='undefined'||typeof V104_COLS==='undefined'||typeof V104_CELL==='undefined'||typeof camera==='undefined'||typeof SW==='undefined'||typeof SH==='undefined')return;
  const MAT=V104_MAT;
  const mobile=matchMedia?.('(max-width: 800px)')?.matches??true;
  const CELL=Math.max(7,V104_CELL*1.15),MARGIN=5*CELL;
  const NX=clamp(Math.ceil((SW/Math.max(.6,camera.zoom)+MARGIN*2)/CELL),56,mobile?96:128);
  const NY=clamp(Math.ceil((SH/Math.max(.6,camera.zoom)+MARGIN*2)/CELL),72,mobile?132:160);
  const MAXP=mobile?1800:3200;
  const PAREA=CELL*CELL*.32;
  const core=makeCore({nx:NX,ny:NY,cell:CELL,dt:1/30,maxParticles:MAXP,flipRatio:.94,particleMass:PAREA});
  const DEFER=new Float32Array(V104_COLS);
  let originX=0,originY=0,tick=0,sourceArea=0,sinkArea=0,lastStepMs=0,oceanSide='left',baseSeaY=0,lastWave=0;
  const hydro=window.GENESIS_HYDRO25||null,surface=window.GENESIS_SURFACE_LIQUID||null,refined=window.GENESIS_FLUID_REFINEMENT||null;
  const isSolidM=m=>typeof v104SolidMat==='function'?v104SolidMat(m):(m!==MAT.AIR&&m!==MAT.WATER&&m!==MAT.LAVA);
  const worldToLocal=(x,y)=>({x:x-originX,y:y-originY});
  const localToWorld=(x,y)=>({x:x+originX,y:y+originY});
  function chooseOrigin(){const wantX=camera.x-SW/(2*camera.zoom)-MARGIN,wantY=camera.y-SH/(2*camera.zoom)-MARGIN;if(Math.abs(wantX-originX)>CELL*4||Math.abs(wantY-originY)>CELL*4){const dx=originX-wantX,dy=originY-wantY;for(let i=0;i<core.maxP;i++)if(core.alive[i]){core.px[i]+=dx;core.py[i]+=dy}originX=wantX;originY=wantY}}
  function rebuildSolid(){core.clearSolid();for(let y=0;y<NY;y++)for(let x=0;x<NX;x++){const w=localToWorld((x+.5)*CELL,(y+.5)*CELL),cx=Math.floor(w.x/V104_CELL),cy=Math.floor(w.y/V104_CELL);if(cx<0||cy<0||cx>=V104_COLS||cy>=V104_ROWS){core.setSolid(x,y,1);continue}core.setSolid(x,y,isSolidM(V104_M[cy*V104_COLS+cx]))}}
  function terrainSurfaceY(wx){const cx=clamp(Math.floor(wx/V104_CELL),0,V104_COLS-1);for(let y=1;y<V104_ROWS-1;y++)if(isSolidM(V104_M[y*V104_COLS+cx]))return y*V104_CELL;return (V104_ROWS-1)*V104_CELL}
  function pickOcean(){let L=0,R=0,n=12;for(let i=0;i<n;i++){L+=terrainSurfaceY(i*V104_CELL*2);R+=terrainSurfaceY((V104_COLS-1-i*2)*V104_CELL)}oceanSide=L>=R?'left':'right';const edge=oceanSide==='left'?0:(V104_COLS-1)*V104_CELL;const bed=terrainSurfaceY(edge);baseSeaY=bed-90;}
  function spawnParticleWorld(wx,wy,vx=0,vy=0){const q=worldToLocal(wx,wy);if(q.x<CELL||q.y<CELL||q.x>(NX-1)*CELL||q.y>(NY-1)*CELL)return-1;return core.addParticle(q.x,q.y,vx,vy)}
  function absorbLegacy(){
    const b=typeof v104VisibleMicroBounds==='function'?v104VisibleMicroBounds(2):{l:0,r:V104_COLS-1,t:0,b:V104_ROWS-1};
    for(let y=b.t;y<=b.b;y++)for(let x=b.l;x<=b.r;x++){
      const i=y*V104_COLS+x;if(V104_M[i]!==MAT.WATER)continue;
      DEFER[x]+=V104_CELL*V104_CELL;V104_M[i]=MAT.AIR;if(window.GENESIS_V110?.fields?.volume)GENESIS_V110.fields.volume[i]=0;
    }
    if(surface?.fields?.depth){const H=surface.fields.depth;for(let x=b.l;x<=b.r;x++){const d=H[x]||0;if(d<=0)continue;DEFER[x]+=d*V104_CELL;H[x]=0;}}
    if(refined?.fields?.water){const FW=refined.width||0,FH=refined.height||0,fc=refined.cell||V104_CELL/(refined.scale||2),W=refined.fields.water,VX=refined.fields.velocityX,VY=refined.fields.velocityY;if(FW&&FH){const fx0=clamp(Math.floor(b.l*V104_CELL/fc),0,FW-1),fx1=clamp(Math.ceil((b.r+1)*V104_CELL/fc),0,FW),fy0=clamp(Math.floor(b.t*V104_CELL/fc),0,FH-1),fy1=clamp(Math.ceil((b.b+1)*V104_CELL/fc),0,FH);for(let fy=fy0;fy<fy1;fy++)for(let fx=fx0;fx<fx1;fx++){const fi=fy*FW+fx,w=W[fi]||0;if(w<=.0001)continue;const cx=clamp(Math.floor((fx+.5)*fc/V104_CELL),0,V104_COLS-1);DEFER[cx]+=w*fc*fc;W[fi]=0;if(VX)VX[fi]=0;if(VY)VY[fi]=0;}}}
    let made=0;
    for(let x=b.l;x<=b.r&&made<140&&core.particleCount<MAXP;x++){
      let area=DEFER[x];if(area<PAREA*.22)continue;const wx=(x+.5)*V104_CELL,bed=terrainSurfaceY(wx),layers=Math.max(1,Math.ceil(area/Math.max(PAREA,V104_CELL*CELL)));
      while(DEFER[x]>=PAREA*.22&&made<140&&core.particleCount<MAXP){const l=made%Math.max(2,layers),wy=bed-(l+.55)*CELL;if(spawnParticleWorld(wx+((made%3)-1)*CELL*.14,wy,0,0)<0)break;DEFER[x]=Math.max(0,DEFER[x]-PAREA);made++;}
    }
  }
  function maintainOcean(){const tide=Math.sin(tick/3600)*18,wave=Math.sin(tick*.12)*10+Math.sin(tick*.051+1.7)*5,seaY=baseSeaY+tide+wave*.18,last=lastWave;lastWave=wave;const worldEdge=oceanSide==='left'?0:V104_COLS*V104_CELL,edgeLocal=worldEdge-originX;if(edgeLocal<-CELL*2||edgeLocal>NX*CELL+CELL*2)return;for(let band=0;band<5;band++){const lx=oceanSide==='left'?edgeLocal+CELL*1.5+band*CELL*.55:edgeLocal-CELL*1.5-band*CELL*.55;for(let ly=CELL*2;ly<NY*CELL-CELL*2;ly+=CELL*.72){const w=localToWorld(lx,ly),bed=terrainSurfaceY(w.x);if(w.y<seaY||w.y>bed-CELL*.25)continue;if(core.particleCount>=MAXP)break;const gx=clamp(Math.floor(lx/CELL),0,NX-1),gy=clamp(Math.floor(ly/CELL),0,NY-1);if(core.solid[gy*NX+gx])continue;if(core.count[gy*NX+gx]<2){const dir=oceanSide==='left'?1:-1,vel=dir*(wave-last)*.9+dir*wave*.13;const j=((band*131+Math.floor(ly/CELL)*71+tick*17)%997)/997-.5;if(core.addParticle(lx+j*CELL*.25,ly-j*CELL*.20,vel,0)>=0)sourceArea+=PAREA}}}}
  function cullFar(){for(let i=0;i<core.maxP;i++)if(core.alive[i]){const x=core.px[i],y=core.py[i];if(x<CELL*.3||x>(NX-.3)*CELL||y<0||y>NY*CELL){const w=localToWorld(x,y),cx=Math.floor(w.x/V104_CELL);if(cx>=0&&cx<V104_COLS&&w.y>=0&&w.y<V104_ROWS*V104_CELL)DEFER[cx]+=PAREA;else sinkArea+=PAREA;core.killParticle(i)}}}
  function applyToCreatures(){if(typeof creatures==='undefined')return;for(const c of creatures){if(!c?.alive||c.gone)continue;for(const n of c.nodes||[]){const q=worldToLocal(n.x,n.y);if(q.x<0||q.y<0||q.x>NX*CELL||q.y>NY*CELL)continue;const gx=clamp(Math.floor(q.x/CELL),0,NX-1),gy=clamp(Math.floor(q.y/CELL),0,NY-1);if(!core.fluid[gy*NX+gx])continue;const u=core.sampleU(core.u,q.x,q.y),v=core.sampleV(core.v,q.x,q.y),vx=n.x-n.px,vy=n.y-n.py,drag=.14;n.px=n.x-(vx*(1-drag)+u*.028);n.py=n.y-(vy*(1-drag)+v*.018-.045)}}}
  function erodeFromFluid(){if(!hydro?.fields?.soilMass)return;const soil=hydro.fields.soilMass,root=hydro.fields.rootStrength;for(let y=1;y<NY-1;y++)for(let x=1;x<NX-1;x++){const k=y*NX+x;if(!core.fluid[k])continue;const wx=originX+(x+.5)*CELL,wy=originY+(y+.5)*CELL,cx=Math.floor(wx/V104_CELL),cy=Math.floor(wy/V104_CELL);if(cx<1||cy<1||cx>=V104_COLS-1||cy>=V104_ROWS-1)continue;const speed=Math.hypot(core.sampleU(core.u,(x+.5)*CELL,(y+.5)*CELL),core.sampleV(core.v,(x+.5)*CELL,(y+.5)*CELL));if(speed<4)continue;for(const [dx,dy] of [[0,1],[-1,0],[1,0],[0,-1]]){const tx=cx+dx,ty=cy+dy,i=ty*V104_COLS+tx,m=V104_M[i];if(!(m===MAT.DIRT||m===MAT.SAND||m===MAT.MUD||m===MAT.ASH))continue;const j=hydro.debugLaneIndex?hydro.debugLaneIndex(1,i):i,rt=root?.[i]||0,e=Math.min(.006,(speed-4)*.000035)*(1-rt*.72);soil[j]=Math.max(0,(soil[j]??1)-e);if(soil[j]<.035)V104_M[i]=MAT.AIR;break}}}
  function renderFluid(){if(typeof X==='undefined'||core.particleCount<2)return;const bins=Math.max(24,Math.floor(SW/8)),top=new Float32Array(bins),bottom=new Float32Array(bins),hit=new Uint16Array(bins);top.fill(1e9);bottom.fill(-1e9);const droplets=[];for(let i=0;i<core.maxP;i++)if(core.alive[i]){const w=localToWorld(core.px[i],core.py[i]),s=worldToScreen(w.x,w.y);if(s.x<-30||s.x>SW+30||s.y<-30||s.y>SH+30)continue;const b=clamp(Math.floor(s.x/SW*bins),0,bins-1);top[b]=Math.min(top[b],s.y);bottom[b]=Math.max(bottom[b],s.y);hit[b]++;if(core.count[clamp(Math.floor(core.py[i]/CELL),0,NY-1)*NX+clamp(Math.floor(core.px[i]/CELL),0,NX-1)]<2)droplets.push(s)}
    X.save();let start=-1;for(let b=0;b<=bins;b++){const wet=b<bins&&hit[b]>=1;if(wet&&start<0)start=b;if((!wet||b===bins)&&start>=0){const end=b-1;if(end-start>=2){const pts=[];for(let j=start;j<=end;j++){let y=top[j],ws=0,n=0;for(let q=Math.max(start,j-2);q<=Math.min(end,j+2);q++){if(hit[q]){ws+=top[q];n++}}if(n)y=ws/n;pts.push({x:(j+.5)/bins*SW,y})}const maxB=Math.max(...Array.from(bottom.slice(start,end+1)));const g=X.createLinearGradient(0,Math.min(...pts.map(p=>p.y)),0,maxB+20);g.addColorStop(0,'rgba(116,214,234,.78)');g.addColorStop(.2,'rgba(41,132,176,.68)');g.addColorStop(1,'rgba(5,39,65,.86)');X.fillStyle=g;X.beginPath();X.moveTo(pts[0].x,pts[0].y);for(let j=1;j<pts.length;j++){const a=pts[j-1],q=pts[j],mx=(a.x+q.x)/2,my=(a.y+q.y)/2;X.quadraticCurveTo(a.x,a.y,mx,my)}X.lineTo(pts[pts.length-1].x,pts[pts.length-1].y);X.lineTo(pts[pts.length-1].x,maxB+18);X.lineTo(pts[0].x,maxB+18);X.closePath();X.fill();X.strokeStyle='rgba(205,248,252,.72)';X.lineWidth=Math.max(1,1.2*camera.zoom);X.beginPath();X.moveTo(pts[0].x,pts[0].y);for(let j=1;j<pts.length;j++){const a=pts[j-1],q=pts[j],mx=(a.x+q.x)/2,my=(a.y+q.y)/2;X.quadraticCurveTo(a.x,a.y,mx,my)}X.stroke()}start=-1}}
    X.fillStyle='rgba(160,230,242,.65)';for(const d of droplets){X.beginPath();X.arc(d.x,d.y,Math.max(1,1.4*camera.zoom),0,Math.PI*2);X.fill()}X.restore()}
  function metrics(){let deferredArea=0;for(let i=0;i<DEFER.length;i++)deferredArea+=DEFER[i];return{particles:core.particleCount,particleArea:core.particleCount*PAREA,deferredArea,divergenceBefore:core.metrics.divBefore,divergenceAfter:core.metrics.divAfter,pressureIterations:core.metrics.pressureIters,sourceArea,sinkArea,oceanSide,seaY:baseSeaY,lastWave,stepMs:lastStepMs}}
  function resetOcean(){originX=originY=0;tick=0;sourceArea=sinkArea=0;DEFER.fill(0);for(let i=0;i<core.maxP;i++)core.killParticle(i);chooseOrigin();rebuildSolid();pickOcean();absorbLegacy();core.markFluid();maintainOcean()}
  function stepOcean(){const t0=performance.now();tick++;chooseOrigin();if(tick%8===1)rebuildSolid();absorbLegacy();if(tick%2){lastStepMs=performance.now()-t0;return}core.markFluid();maintainOcean();core.step({gravity:22,pressureIters:mobile?16:24,waveU:(oceanSide==='left'?1:-1)*Math.sin(tick*.12)*1.7,waveSide:oceanSide});applyToCreatures();erodeFromFluid();cullFar();lastStepMs=performance.now()-t0}
  resetOcean();
  const STEP=step;step=function(){STEP();stepOcean();};
  const RESET=reset;reset=function(){RESET();resetOcean();};
  const TERR=drawTerrain;drawTerrain=function(t){TERR(t);renderFluid();};
  if(typeof updateUI==='function'){const UI0=updateUI;updateUI=function(){UI0();const e=document.getElementById('mobTruth');if(e){const m=metrics();e.textContent=`WATER: FLIP/PIC · ${m.particles} PARTICLES · DIV ${m.divergenceAfter.toFixed(2)}`;}};}
  window.GENESIS_FLIP_OCEAN={
    status:'experimental',representation:'camera-local 2D FLIP/PIC incompressible free-surface liquid with MAC pressure projection and external ocean reservoir',
    full3D:false,fallingSand:false,takesSurfaceOwnership:true,exclusiveVisual:true,pressureProjection:true,particleBased:true,
    fields:{px:core.px,py:core.py,vx:core.pvx,vy:core.pvy,fluid:core.fluid,solid:core.solid,pressure:core.p},metrics,resetOcean,stepOcean,
    sampleWorld(wx,wy){const q=worldToLocal(wx,wy);return{u:core.sampleU(core.u,q.x,q.y),v:core.sampleV(core.v,q.x,q.y),fluid:q.x>=0&&q.y>=0&&q.x<NX*CELL&&q.y<NY*CELL?!!core.fluid[clamp(Math.floor(q.y/CELL),0,NY-1)*NX+clamp(Math.floor(q.x/CELL),0,NX-1)]:false}}
  };
})(typeof globalThis!=='undefined'?globalThis:this);
