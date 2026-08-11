'use strict';
/* GENESIS continuous open-surface liquids.
   Water: conservative 1D local-inertial shallow-water approximation.
   Lava: same free-surface topology with much stronger damping/friction.
   Legacy visible V104/fine-grid open water/lava is absorbed into these fields.
   Enclosed cave liquids are outside this solver's verified scope.
   This is NOT full 2D CFD and NOT full 3D fluid simulation. */
(function(){
  if(typeof V104_COLS==='undefined'||typeof V104_ROWS==='undefined'||typeof V104_CELL==='undefined'||typeof V104_M==='undefined')return;

  const CW=V104_COLS, CH=V104_ROWS, DX=V104_CELL, N=CW, DT=1/60, EPS=1e-5;
  const H=new Float32Array(N), U=new Float32Array(N), Q=new Float32Array(N+1);
  const LH=new Float32Array(N), LU=new Float32Array(N), LQ=new Float32Array(N+1);
  const BEDY=new Int16Array(N), BEDZ=new Float32Array(N);
  const SED=new Float32Array(N), DEP=new Float32Array(N);
  let tick=0,lastMass=0,lastResidual=0,lastMaxSpeed=0,lastLavaMass=0,lastLavaResidual=0,lastLavaSpeed=0,lastEroded=0,lastDeposited=0,lastMs=0;

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
    for(;y<CH-1;y++)if(isSolid(V104_M[idx(x,y)]))break;
    BEDY[x]=y;BEDZ[x]=(CH-y)*DX;return y;
  }
  function rebuildBed(l=0,r=CW-1){for(let x=Math.max(0,l);x<=Math.min(CW-1,r);x++)findBed(x)}
  function sumDepth(field){let s=0;for(let x=0;x<N;x++)s+=field[x]*DX;return s}
  function maxDepth(field){let m=0;for(let x=0;x<N;x++)if(field[x]>m)m=field[x];return m}

  function faceStep(field,faces,x,dt,g,rough,damp,flowCap){
    if(x<=0||x>=CW)return 0;
    const L=x-1,R=x,bL=BEDZ[L],bR=BEDZ[R],hL=field[L],hR=field[R];
    const etaL=bL+hL,etaR=bR+hR;
    const hFace=Math.max(0,Math.max(etaL,etaR)-Math.max(bL,bR));
    if(hFace<EPS){faces[x]=0;return 0}
    let q=faces[x]*damp;
    q += -g*hFace*((etaR-etaL)/DX)*dt;
    q /= 1 + g*rough*rough*Math.abs(q)*dt/Math.max(.03,Math.pow(hFace,7/3));
    const maxL=hL*DX/Math.max(dt,1e-6)*flowCap,maxR=hR*DX/Math.max(dt,1e-6)*flowCap;
    if(q>0)q=Math.min(q,maxL);else q=Math.max(q,-maxR);
    faces[x]=q;return q;
  }

  function integrate(field,vel,faces,dt,opts){
    const before=sumDepth(field);
    const speedRef=opts.lava?lastLavaSpeed:lastMaxSpeed;
    const wave=Math.sqrt(opts.g*Math.max(.01,maxDepth(field)));
    const sub=Math.max(1,Math.min(opts.maxSub||3,Math.ceil((speedRef+wave)*dt/DX*1.5)));
    const ds=dt/sub;let maxS=0;
    for(let k=0;k<sub;k++){
      for(let f=1;f<CW;f++)faceStep(field,faces,f,ds,opts.g,opts.rough,opts.damp,opts.flowCap);
      maxS=0;
      for(let x=0;x<CW;x++){
        field[x]=Math.max(0,field[x]-(faces[x+1]-faces[x])*ds/DX+(opts.source||0)*ds);
        if(field[x]>EPS){vel[x]=.5*(faces[x]+faces[x+1])/Math.max(.03,field[x]);maxS=Math.max(maxS,Math.abs(vel[x]))}else vel[x]=0;
      }
    }
    const after=sumDepth(field),expected=(opts.source||0)*dt*CW*DX;
    return{before,after,residual:after-before-expected,maxSpeed:maxS};
  }

  function shallowStep(dt=DT,rain=0){const r=integrate(H,U,Q,dt,{g:18,rough:.18,damp:.88,flowCap:.46,maxSub:3,source:rain});lastMass=r.after;lastResidual=r.residual;lastMaxSpeed=r.maxSpeed;return r.after}
  function lavaStep(dt=DT){const r=integrate(LH,LU,LQ,dt,{g:5.5,rough:.72,damp:.70,flowCap:.18,maxSub:2,source:0,lava:true});lastLavaMass=r.after;lastLavaResidual=r.residual;lastLavaSpeed=r.maxSpeed;return r.after}

  function visibleBounds(){
    const b=typeof v104VisibleMicroBounds==='function'?v104VisibleMicroBounds(3):{l:0,r:CW-1,t:0,b:CH-1};
    return{l:clamp(b.l,0,CW-1),r:clamp(b.r,0,CW-1),t:clamp(b.t,0,CH-1),b:clamp(b.b,0,CH-1)};
  }
  function addVolumeAtColumn(x,area){if(x>=0&&x<CW&&area>0&&Number.isFinite(area))H[x]+=area/DX}

  function absorbLegacy(b,all=false){
    const l=all?0:b.l,r=all?CW-1:b.r;
    const fine=FR?.fields,scale=FR?.scale||2,fc=FR?.cell||DX/scale,FW=FR?.width||0,FH=FR?.height||0;
    for(let x=l;x<=r;x++){
      const bed=BEDY[x]||findBed(x);let waterArea=0,lavaArea=0;
      const y0=all?0:Math.max(0,b.t-3),y1=Math.min(bed,all?CH:b.b+4);
      for(let y=y0;y<y1;y++){
        const i=idx(x,y),m=V104_M[i];
        if(m===MAT.WATER){waterArea+=DX*DX;V104_M[i]=MAT.AIR;if(V110?.volume)V110.volume[i]=0}
        else if(m===MAT.LAVA){lavaArea+=DX*DX;V104_M[i]=MAT.AIR}
      }
      if(fine?.water&&FW&&FH){
        const fx0=x*scale,fx1=Math.min(FW,(x+1)*scale),fy0=Math.max(0,(all?0:(b.t-3)*scale)),fy1=Math.min(FH,bed*scale);
        for(let fy=fy0;fy<fy1;fy++)for(let fx=fx0;fx<fx1;fx++){
          const fi=fy*FW+fx,w=fine.water[fi]||0;
          if(w>0){waterArea+=w*fc*fc;fine.water[fi]=0;fine.velocityX[fi]=0;fine.velocityY[fi]=0}
        }
      }
      if(waterArea>0)H[x]+=waterArea/DX;
      if(lavaArea>0)LH[x]+=lavaArea/DX;
    }
  }

  function coupleThermalLiquids(b,dt){
    for(let x=b.l;x<=b.r;x++){
      const y=BEDY[x];if(y<=0||y>=CH)continue;const i=idx(x,y);
      if(LH[x]>.02&&typeof V105_HEAT!=='undefined')V105_HEAT[i]=Math.max(V105_HEAT[i]||0,220);
      if(H[x]>.015&&LH[x]>.015){
        const react=Math.min(H[x],LH[x],.012*dt*60);H[x]-=react;LH[x]-=react;
        if(V104_M[i]===MAT.DIRT||V104_M[i]===MAT.SAND||V104_M[i]===MAT.MUD)V104_M[i]=MAT.OBSIDIAN;
        if(V110?.vapor)V110.vapor[i]=(V110.vapor[i]||0)+react*.8;
      }
    }
  }

  function terrainCoupling(dt,b){
    if(!HG?.fields)return;
    const soil=HG.fields.soilMass,root=HG.fields.rootStrength,susp=HG.fields.suspendedSediment;let er=0,dep=0;
    for(let x=b.l;x<=b.r;x++){
      const y=BEDY[x];if(y<=0||y>=CH)continue;
      const i=idx(x,y),m=V104_M[i],h=H[x],u=Math.abs(U[x]),shear=h*u*u*.055;
      if(erodible(m)&&h>.03){
        const rt=root?.[i]||0,threshold=(m===MAT.SAND?.018:m===MAT.MUD?.032:m===MAT.ASH?.014:.026)*(1+rt*2.1);
        const e=Math.min(.012,Math.max(0,shear-threshold)*.0018*dt*60);
        if(e>0&&soil){const j=HG.debugLaneIndex?HG.debugLaneIndex(1,i):i;soil[j]=Math.max(0,(soil[j]??1)-e);SED[x]+=e;if(susp)susp[j]=(susp[j]||0)+e;er+=e;if(soil[j]<.04){V104_M[i]=MAT.AIR;soil[j]=0;findBed(x)}}
      }
      if(H[x]>.015&&u<.10&&SED[x]>.0005){
        const settle=Math.min(SED[x],(.0014+(.10-u)*.006)*dt*60);SED[x]-=settle;DEP[x]+=settle;dep+=settle;
        if(DEP[x]>.16){const ny=Math.max(1,BEDY[x]-1),ni=idx(x,ny);if(V104_M[ni]===MAT.AIR){V104_M[ni]=H[x]>.18?MAT.MUD:MAT.SAND;DEP[x]-=.16;findBed(x)}}
      }
    }
    const next=new Float32Array(SED);
    for(let x=b.l+1;x<b.r;x++){const u=U[x],s=SED[x];if(s<=0)continue;const dir=u>0?1:u<0?-1:0;if(!dir)continue;const a=Math.min(s,Math.abs(u)*dt/DX*s*.45);next[x]-=a;next[x+dir]+=a}
    for(let x=b.l;x<=b.r;x++)SED[x]=next[x];lastEroded=er;lastDeposited=dep;
  }

  function coupleCreatures(b){
    if(typeof creatures==='undefined')return;
    for(const c of creatures){if(!c?.alive||c.gone)continue;for(const n of c.nodes||[]){
      const x=clamp(Math.floor(n.x/DX),0,CW-1),bedY=BEDY[x]*DX;
      if(H[x]>.03){const surfaceY=bedY-H[x];if(n.y>=surfaceY&&n.y<=bedY+4){const sub=clamp((n.y-surfaceY)/Math.max(2,H[x]),0,1),vx=n.x-n.px,vy=n.y-n.py,drag=.035+.18*sub;n.px=n.x-(vx*(1-drag)+U[x]*.028*sub);n.py=n.y-(vy*(1-drag)-.055*sub)}}
      if(LH[x]>.02&&typeof V105_HEAT!=='undefined'&&n.y>=bedY-LH[x]&&n.y<=bedY+4){const ci=idx(x,BEDY[x]);V105_HEAT[ci]=Math.max(V105_HEAT[ci]||0,230)}
    }}
  }

  function drawField(field,vel,isLava,b){let start=-1;
    function drawSegment(l,r){
      const top=[],bottom=[];for(let x=l;x<=r;x++){const by=BEDY[x]*DX,sy=by-field[x],a=worldToScreen((x+.5)*DX,sy),d=worldToScreen((x+.5)*DX,by);top.push(a);bottom.push(d)}
      X.save();const minY=Math.min(...top.map(p=>p.y)),maxY=Math.max(...bottom.map(p=>p.y)),g=X.createLinearGradient(0,minY,0,maxY);
      if(isLava){g.addColorStop(0,'rgba(255,216,90,.95)');g.addColorStop(.16,'rgba(255,112,24,.90)');g.addColorStop(1,'rgba(78,12,5,.96)')}else{g.addColorStop(0,'rgba(112,205,225,.68)');g.addColorStop(.15,'rgba(45,132,171,.54)');g.addColorStop(1,'rgba(9,44,65,.72)')}
      X.fillStyle=g;X.beginPath();X.moveTo(top[0].x,top[0].y);for(let i=1;i<top.length;i++){const p=top[i-1],q=top[i],mx=(p.x+q.x)*.5,my=(p.y+q.y)*.5;X.quadraticCurveTo(p.x,p.y,mx,my)}X.lineTo(top[top.length-1].x,top[top.length-1].y);for(let i=bottom.length-1;i>=0;i--)X.lineTo(bottom[i].x,bottom[i].y);X.closePath();X.fill();
      X.strokeStyle=isLava?'rgba(255,225,110,.90)':'rgba(170,236,244,.66)';X.lineWidth=Math.max(1,camera.zoom*(isLava?1.8:1.25));X.beginPath();X.moveTo(top[0].x,top[0].y);for(let i=1;i<top.length;i++){const p=top[i-1],q=top[i],mx=(p.x+q.x)*.5,my=(p.y+q.y)*.5;X.quadraticCurveTo(p.x,p.y,mx,my)}X.stroke();
      X.globalCompositeOperation='screen';X.strokeStyle=isLava?'rgba(255,174,56,.34)':'rgba(210,248,250,.28)';X.lineWidth=Math.max(.7,camera.zoom*.7);
      for(let x=l+1;x<r;x++){const jump=Math.abs(field[x+1]-field[x-1])+Math.abs(vel[x])*.07;if(jump<.09)continue;const p=worldToScreen((x+.5)*DX,BEDY[x]*DX-field[x]);X.beginPath();X.arc(p.x,p.y,Math.min(8,2+jump*12)*camera.zoom,Math.PI,Math.PI*2);X.stroke()}X.restore();
    }
    for(let x=b.l;x<=b.r+1;x++){const wet=x<=b.r&&field[x]>(isLava?.018:.025);if(wet&&start<0)start=x;if((!wet||x===b.r+1)&&start>=0){const end=x-1;if(end-start>=1)drawSegment(start,end);start=-1}}
  }
  function drawContinuousLiquids(){if(typeof X==='undefined'||typeof worldToScreen!=='function')return;const b=visibleBounds();drawField(LH,LU,true,b);drawField(H,U,false,b)}

  function metrics(){return{mass:lastMass,residual:lastResidual,maxDepth:maxDepth(H),maxSpeed:lastMaxSpeed,lavaMass:lastLavaMass,lavaResidual:lastLavaResidual,lavaMaxDepth:maxDepth(LH),lavaMaxSpeed:lastLavaSpeed,eroded:lastEroded,deposited:lastDeposited,stepMs:lastMs}}
  function seed(){H.fill(0);U.fill(0);Q.fill(0);LH.fill(0);LU.fill(0);LQ.fill(0);SED.fill(0);DEP.fill(0);rebuildBed();absorbLegacy({l:0,r:CW-1,t:0,b:CH-1},true);lastMass=sumDepth(H);lastLavaMass=sumDepth(LH)}
  function stepOnce(opts={}){const t0=typeof performance!=='undefined'&&performance.now?performance.now():0;tick++;const b=opts.bounds||visibleBounds();if(tick%20===1)rebuildBed(b.l,b.r);absorbLegacy(b,false);const dt=opts.dt||DT,rain=opts.rain??((typeof weather!=='undefined'?weather.rain||0:0)*.008);shallowStep(dt,rain);lavaStep(dt);coupleThermalLiquids(b,dt);terrainCoupling(dt,b);coupleCreatures(b);lastMs=(typeof performance!=='undefined'&&performance.now?performance.now():t0)-t0;return metrics()}

  seed();const STEP=step;step=function(){STEP();stepOnce()};const RESET=reset;reset=function(){RESET();seed()};const TERR=drawTerrain;drawTerrain=function(t){TERR(t);drawContinuousLiquids()};

  window.GENESIS_SURFACE_LIQUID={
    status:'experimental',representation:'1D local-inertial shallow-water water plus high-friction viscous free-surface lava approximation over open terrain',
    full2DCFD:false,full3D:false,continuousSurface:true,continuousLava:true,legacyOpenWaterAbsorbed:true,legacyOpenLavaAbsorbed:true,
    fields:{depth:H,velocity:U,faceDischarge:Q,lavaDepth:LH,lavaVelocity:LU,lavaFaceDischarge:LQ,bedY:BEDY,sediment:SED,deposit:DEP},metrics,stepOnce,seed,rebuildBed,
    test:{faceDischarge:(x,dt)=>faceStep(H,Q,x,dt,18,.18,.88,.46),shallowStep,mass:()=>sumDepth(H),lavaFaceDischarge:(x,dt)=>faceStep(LH,LQ,x,dt,5.5,.72,.70,.18),lavaStep,lavaMass:()=>sumDepth(LH),addVolumeAtColumn},
    debugSetDepth(x,v){if(x>=0&&x<CW)H[x]=Math.max(0,v)},debugSetVelocity(x,v){if(x>=0&&x<CW)U[x]=v},debugSetLavaDepth(x,v){if(x>=0&&x<CW)LH[x]=Math.max(0,v)},debugSetLavaVelocity(x,v){if(x>=0&&x<CW)LU[x]=v},debugSetBed(x,y){if(x>=0&&x<CW){BEDY[x]=y;BEDZ[x]=(CH-y)*DX}},debugClear(){H.fill(0);U.fill(0);Q.fill(0);LH.fill(0);LU.fill(0);LQ.fill(0);SED.fill(0);DEP.fill(0)}
  };
})();
