'use strict';
/* GENESIS continuous surface-liquid layer.
   Replaces visible open-surface falling-cell water with a conservative 1D
   local-inertial shallow-water approximation over the terrain surface.
   The legacy fine/coarse water grids remain as source/reservoir inputs and are
   absorbed from the visible open surface before rendering. This is not full 2D
   CFD and does not model enclosed cave water with the shallow-water field. */
(function(){
  if(typeof V104_COLS==='undefined'||typeof V104_ROWS==='undefined'||typeof V104_CELL==='undefined'||typeof V104_M==='undefined')return;

  const CW=V104_COLS, CH=V104_ROWS, DX=V104_CELL, N=CW;
  const G=18.0, DT=1/60, MAX_SUB=3, EPS=1e-5;
  const H=new Float32Array(N), U=new Float32Array(N), Q=new Float32Array(N+1);
  const BEDY=new Int16Array(N), BEDZ=new Float32Array(N);
  const SED=new Float32Array(N), DEP=new Float32Array(N);
  let tick=0,lastMass=0,lastResidual=0,lastMaxSpeed=0,lastEroded=0,lastDeposited=0,lastMs=0;

  const FR=window.GENESIS_FLUID_REFINEMENT||null;
  const HG=window.GENESIS_HYDRO25||null;
  const V110=window.GENESIS_V110?.fields||null;
  const MAT=V104_MAT;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const idx=(x,y)=>y*CW+x;
  const isSolid=m=>typeof v104SolidMat==='function'?v104SolidMat(m):(m!==MAT.AIR&&m!==MAT.WATER&&m!==MAT.LAVA);
  const erodible=m=>m===MAT.DIRT||m===MAT.SAND||m===MAT.MUD||m===MAT.ASH;

  function findBed(x){
    let y=1;
    for(;y<CH-1;y++) if(isSolid(V104_M[idx(x,y)])) break;
    BEDY[x]=y;
    BEDZ[x]=(CH-y)*DX;
    return y;
  }
  function rebuildBed(l=0,r=CW-1){for(let x=Math.max(0,l);x<=Math.min(CW-1,r);x++)findBed(x);}
  function mass(){let s=0;for(let x=0;x<N;x++)s+=H[x]*DX;return s}

  function faceDischarge(x,dt,rough=.18){
    if(x<=0||x>=CW)return 0;
    const L=x-1,R=x,bL=BEDZ[L],bR=BEDZ[R],hL=H[L],hR=H[R];
    const etaL=bL+hL,etaR=bR+hR;
    const hFace=Math.max(0,Math.max(etaL,etaR)-Math.max(bL,bR));
    if(hFace<EPS){Q[x]=0;return 0}
    let q=Q[x]*.88;
    q += -G*hFace*((etaR-etaL)/DX)*dt;
    const denom=1 + G*rough*rough*Math.abs(q)*dt/Math.max(.025,Math.pow(hFace,7/3));
    q/=denom;
    const maxL=hL*DX/Math.max(dt,1e-6)*.46;
    const maxR=hR*DX/Math.max(dt,1e-6)*.46;
    if(q>0)q=Math.min(q,maxL); else q=Math.max(q,-maxR);
    Q[x]=q;
    return q;
  }

  function maxDepth(){let m=0;for(let i=0;i<N;i++)if(H[i]>m)m=H[i];return m}
  function shallowStep(dt=DT, rain=0){
    const before=mass();
    const cfl=Math.max(.25,lastMaxSpeed+Math.sqrt(G*Math.max(.01,maxDepth())));
    const sub=Math.max(1,Math.min(MAX_SUB,Math.ceil(cfl*dt/DX*1.6)));
    const ds=dt/sub;
    for(let k=0;k<sub;k++){
      for(let f=1;f<CW;f++)faceDischarge(f,ds);
      let maxS=0;
      for(let x=0;x<CW;x++){
        const inQ=Q[x],outQ=Q[x+1];
        H[x]=Math.max(0,H[x]-(outQ-inQ)*ds/DX + rain*ds);
        const h=H[x];
        if(h>EPS){const q=.5*(Q[x]+Q[x+1]);U[x]=q/Math.max(.025,h);maxS=Math.max(maxS,Math.abs(U[x]));}
        else U[x]=0;
      }
      lastMaxSpeed=maxS;
    }
    const after=mass();lastResidual=after-before-rain*dt*CW*DX;lastMass=after;return after;
  }

  function visibleBounds(){
    const b=typeof v104VisibleMicroBounds==='function'?v104VisibleMicroBounds(3):{l:0,r:CW-1,t:0,b:CH-1};
    return {l:clamp(b.l,0,CW-1),r:clamp(b.r,0,CW-1),t:clamp(b.t,0,CH-1),b:clamp(b.b,0,CH-1)};
  }
  function addVolumeAtColumn(x,volArea){if(x>=0&&x<CW&&Number.isFinite(volArea)&&volArea>0)H[x]+=volArea/DX;}

  function absorbLegacy(b,all=false){
    const l=all?0:b.l,r=all?CW-1:b.r;
    const fine=FR?.fields,scale=FR?.scale||2,fc=FR?.cell||DX/scale,FW=FR?.width||0,FH=FR?.height||0;
    for(let x=l;x<=r;x++){
      const bed=BEDY[x]||findBed(x);let area=0;
      for(let y=Math.max(0,b.t-3);y<Math.min(bed,all?CH:b.b+4);y++){
        const i=idx(x,y);
        if(V104_M[i]===MAT.WATER){area+=DX*DX;V104_M[i]=MAT.AIR;if(V110?.volume)V110.volume[i]=0;}
      }
      if(fine?.water&&FW&&FH){
        const fx0=x*scale,fx1=Math.min(FW,(x+1)*scale),fy1=Math.min(FH,bed*scale);
        for(let fy=Math.max(0,(all?0:(b.t-3)*scale));fy<fy1;fy++)for(let fx=fx0;fx<fx1;fx++){
          const fi=fy*FW+fx,w=fine.water[fi]||0;
          if(w>0){area+=w*fc*fc;fine.water[fi]=0;fine.velocityX[fi]=0;fine.velocityY[fi]=0;}
        }
      }
      if(area>0)addVolumeAtColumn(x,area);
    }
  }

  function terrainCoupling(dt=DT,b=visibleBounds()){
    if(!HG?.fields)return;
    const soil=HG.fields.soilMass,root=HG.fields.rootStrength,susp=HG.fields.suspendedSediment;
    let er=0,dep=0;
    for(let x=b.l;x<=b.r;x++){
      const y=BEDY[x];if(y<=0||y>=CH)continue;
      const i=idx(x,y),m=V104_M[i],h=H[x],u=Math.abs(U[x]),shear=h*u*u*.055;
      if(erodible(m)&&h>.03){
        const rt=root?.[i]||0;
        const threshold=(m===MAT.SAND?.018:m===MAT.MUD?.032:m===MAT.ASH?.014:.026)*(1+rt*2.1);
        const e=Math.min(.012,Math.max(0,shear-threshold)*.0018*dt*60);
        if(e>0){
          const j=HG.debugLaneIndex?HG.debugLaneIndex(1,i):i;
          if(soil){soil[j]=Math.max(0,(soil[j]??1)-e);SED[x]+=e;if(susp)susp[j]=(susp[j]||0)+e;er+=e;
            if(soil[j]<.04){V104_M[i]=MAT.AIR;soil[j]=0;findBed(x);}
          }
        }
      }
      if(H[x]>.015&&u<.10&&SED[x]>.0005){
        const settle=Math.min(SED[x],(.0014+(.10-u)*.006)*dt*60);SED[x]-=settle;DEP[x]+=settle;dep+=settle;
        if(DEP[x]>.16){const ny=Math.max(1,BEDY[x]-1),ni=idx(x,ny);if(V104_M[ni]===MAT.AIR){V104_M[ni]=H[x]>.18?MAT.MUD:MAT.SAND;DEP[x]-=.16;findBed(x);}}
      }
    }
    const next=new Float32Array(SED);
    for(let x=b.l+1;x<b.r;x++){const u=U[x],s=SED[x];if(s<=0)continue;const dir=u>0?1:u<0?-1:0;if(!dir)continue;const a=Math.min(s,Math.abs(u)*dt/DX*s*.45);next[x]-=a;next[x+dir]+=a;}
    for(let x=b.l;x<=b.r;x++)SED[x]=next[x];
    lastEroded=er;lastDeposited=dep;
  }

  function coupleCreatures(b=visibleBounds()){
    if(typeof creatures==='undefined')return;
    for(const c of creatures){if(!c?.alive||c.gone)continue;for(const n of c.nodes||[]){
      const x=clamp(Math.floor(n.x/DX),0,CW-1),bedY=BEDY[x]*DX,surfaceY=bedY-H[x];
      if(n.y<surfaceY||n.y>bedY+4||H[x]<.03)continue;
      const sub=clamp((n.y-surfaceY)/Math.max(2,H[x]),0,1),vx=n.x-n.px,vy=n.y-n.py,drag=.035+.18*sub;
      const nvx=vx*(1-drag)+U[x]*.028*sub,nvy=vy*(1-drag)-.055*sub;n.px=n.x-nvx;n.py=n.y-nvy;
    }}
  }

  function drawContinuousLiquid(){
    if(typeof X==='undefined'||typeof worldToScreen!=='function')return;
    const b=visibleBounds();let start=-1;
    function drawSegment(l,r){
      const top=[],bottom=[];
      for(let x=l;x<=r;x++){const by=BEDY[x]*DX,sy=by-H[x],a=worldToScreen((x+.5)*DX,sy),d=worldToScreen((x+.5)*DX,by);top.push(a);bottom.push(d)}
      X.save();const minY=Math.min(...top.map(p=>p.y)),maxY=Math.max(...bottom.map(p=>p.y));const g=X.createLinearGradient(0,minY,0,maxY);
      g.addColorStop(0,'rgba(112,205,225,.68)');g.addColorStop(.15,'rgba(45,132,171,.54)');g.addColorStop(1,'rgba(9,44,65,.72)');
      X.fillStyle=g;X.beginPath();X.moveTo(top[0].x,top[0].y);for(let i=1;i<top.length;i++){const p=top[i-1],q=top[i],mx=(p.x+q.x)*.5,my=(p.y+q.y)*.5;X.quadraticCurveTo(p.x,p.y,mx,my)}
      X.lineTo(top[top.length-1].x,top[top.length-1].y);for(let i=bottom.length-1;i>=0;i--)X.lineTo(bottom[i].x,bottom[i].y);X.closePath();X.fill();
      X.strokeStyle='rgba(170,236,244,.66)';X.lineWidth=Math.max(1,camera.zoom*1.25);X.beginPath();X.moveTo(top[0].x,top[0].y);for(let i=1;i<top.length;i++){const p=top[i-1],q=top[i],mx=(p.x+q.x)*.5,my=(p.y+q.y)*.5;X.quadraticCurveTo(p.x,p.y,mx,my)}X.stroke();
      X.globalCompositeOperation='screen';X.strokeStyle='rgba(210,248,250,.28)';X.lineWidth=Math.max(.7,camera.zoom*.7);
      for(let x=l+1;x<r;x++){const jump=Math.abs(H[x+1]-H[x-1])+Math.abs(U[x])*.07;if(jump<.09)continue;const by=BEDY[x]*DX,sy=by-H[x],p=worldToScreen((x+.5)*DX,sy);X.beginPath();X.arc(p.x,p.y,Math.min(8,2+jump*12)*camera.zoom,Math.PI,Math.PI*2);X.stroke()}
      X.restore();
    }
    for(let x=b.l;x<=b.r+1;x++){const wet=x<=b.r&&H[x]>.025;if(wet&&start<0)start=x;if((!wet||x===b.r+1)&&start>=0){const end=x-1;if(end-start>=1)drawSegment(start,end);start=-1}}
  }

  function metrics(){return{mass:lastMass,residual:lastResidual,maxDepth:maxDepth(),maxSpeed:lastMaxSpeed,eroded:lastEroded,deposited:lastDeposited,stepMs:lastMs}}
  function seed(){H.fill(0);U.fill(0);Q.fill(0);SED.fill(0);DEP.fill(0);rebuildBed();absorbLegacy({l:0,r:CW-1,t:0,b:CH-1},true);lastMass=mass();}
  function stepOnce(opts={}){const t0=typeof performance!=='undefined'&&performance.now?performance.now():0;tick++;const b=opts.bounds||visibleBounds();if(tick%20===1)rebuildBed(b.l,b.r);absorbLegacy(b,false);const rain=opts.rain??((typeof weather!=='undefined'?weather.rain||0:0)*.008);shallowStep(opts.dt||DT,rain);terrainCoupling(opts.dt||DT,b);coupleCreatures(b);lastMs=(typeof performance!=='undefined'&&performance.now?performance.now():t0)-t0;return metrics();}

  seed();
  const STEP=step;step=function(){STEP();stepOnce();};
  const RESET=reset;reset=function(){RESET();seed();};
  const TERR=drawTerrain;drawTerrain=function(t){TERR(t);drawContinuousLiquid();};

  window.GENESIS_SURFACE_LIQUID={
    status:'experimental',representation:'1D local-inertial shallow-water free-surface approximation over the open terrain surface',
    full2DCFD:false,full3D:false,continuousSurface:true,legacyOpenWaterAbsorbed:true,
    fields:{depth:H,velocity:U,faceDischarge:Q,bedY:BEDY,sediment:SED,deposit:DEP},metrics,stepOnce,seed,rebuildBed,
    test:{faceDischarge,shallowStep,mass,addVolumeAtColumn},
    debugSetDepth(x,v){if(x>=0&&x<CW)H[x]=Math.max(0,v)},debugSetVelocity(x,v){if(x>=0&&x<CW)U[x]=v},
    debugSetBed(x,y){if(x>=0&&x<CW){BEDY[x]=y;BEDZ[x]=(CH-y)*DX}},debugClear(){H.fill(0);U.fill(0);Q.fill(0);SED.fill(0);DEP.fill(0)}
  };
})();
