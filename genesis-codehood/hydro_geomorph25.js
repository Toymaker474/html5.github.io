'use strict';
/* GENESIS hydro-geomorphology 2.5D layer.
   Purpose: make the existing ecosystem substrate behave more like wet terrain:
   moisture, compaction, cohesion, erosion, suspended sediment, deposition,
   seepage and bank collapse. Three depth lanes are simulated for storage and
   cross-depth exchange, while the middle lane remains the authoritative 2D
   collision/material plane. This is NOT CFD and NOT full 3D terrain physics. */
(function(){
  if(typeof V104_COLS==='undefined'||typeof V104_ROWS==='undefined'||typeof V104_MAT==='undefined'||typeof V104_M==='undefined')return;
  const FR=window.GENESIS_FLUID_REFINEMENT;
  if(!FR?.fields?.water)return;

  const CW=V104_COLS,CH=V104_ROWS,N=CW*CH,LANES=3,MID=1;
  const LN=N*LANES;
  const MOIST=new Float32Array(LN),COMPACT=new Float32Array(LN),SUSP=new Float32Array(LN),SOIL=new Float32Array(LN),ROOT=new Float32Array(N),DEPOSIT=new Float32Array(N);
  const TMP=new Float32Array(LN);
  let tick=0,erodedMass=0,depositedMass=0,collapsedMass=0,lastWaterResidual=0,lastStepMs=0,lastTouched=0;

  const clamp01=v=>Math.max(0,Math.min(1,v));
  const li=(lane,i)=>lane*N+i;
  const ci=(x,y)=>y*CW+x;
  const inside=(x,y)=>x>0&&y>0&&x<CW-1&&y<CH-1;
  const isSolidM=m=>typeof v104SolidMat==='function'?v104SolidMat(m):m!==V104_MAT.AIR&&m!==V104_MAT.WATER&&m!==V104_MAT.LAVA;
  const erodible=m=>m===V104_MAT.DIRT||m===V104_MAT.SAND||m===V104_MAT.MUD||m===V104_MAT.ASH;
  const props=m=>{
    if(m===V104_MAT.SAND)return{por:.44,base:.36,erode:1.25,settle:1.18};
    if(m===V104_MAT.MUD)return{por:.32,base:.56,erode:.82,settle:1.32};
    if(m===V104_MAT.ASH)return{por:.58,base:.20,erode:1.55,settle:.76};
    if(m===V104_MAT.DIRT)return{por:.40,base:.48,erode:1.00,settle:1.0};
    if(m===V104_MAT.ROCK||m===V104_MAT.OBSIDIAN)return{por:.04,base:2.4,erode:.02,settle:2.0};
    return{por:.24,base:.72,erode:.35,settle:1.0};
  };

  function wetStrength(m){
    m=clamp01(m);
    const q=(m-.46)/.27;
    const bell=Math.exp(-(q*q));
    const waterlogged=Math.max(0,(m-.82)/.18);
    return Math.max(.22,1+.82*bell-1.02*waterlogged);
  }
  function erosionRate(shear,threshold,erodibility,roots=0){
    const excess=Math.max(0,shear-threshold*(1+roots*.85));
    return Math.min(.035,excess*.0125*erodibility);
  }
  function pairRelax(a,b,k=.1){const d=(a-b)*k;return[a-d,b+d];}
  function depthExchange(a,b,k=.04){const d=(a-b)*k;return[a-d,b+d];}

  function sampleFine(wx,wy){return FR.sample?FR.sample(wx,wy):{water:0,vx:0,vy:0,solid:false};}
  function visibleBounds(m=2){
    if(typeof v104VisibleMicroBounds==='function')return v104VisibleMicroBounds(m);
    return{l:1,r:CW-2,t:1,b:CH-2};
  }
  function exposed(x,y){const m=V104_M[ci(x,y)];if(!isSolidM(m))return false;return !isSolidM(V104_M[ci(x,y-1)])||!isSolidM(V104_M[ci(x-1,y)])||!isSolidM(V104_M[ci(x+1,y)]);}
  function supportBelow(x,y){return isSolidM(V104_M[ci(x,y+1)]);}

  function seed(){
    for(let y=0;y<CH;y++)for(let x=0;x<CW;x++){
      const i=ci(x,y),m=V104_M[i],surface=y>0&&exposed(x,y);
      for(let l=0;l<LANES;l++){
        const j=li(l,i),h=typeof hash==='function'?hash(i*173+l*911):((i*1103515245+l*12345)>>>0)/4294967295;
        MOIST[j]=isSolidM(m)?clamp01((typeof GENESIS_V109!=='undefined'?GENESIS_V109?.fields?.saturation?.[i]||0:0)+(surface?.08:0)+h*.05):0;
        COMPACT[j]=isSolidM(m)?clamp01(.42+.28*h+(m===V104_MAT.ROCK||m===V104_MAT.OBSIDIAN?.25:0)):0;
        SUSP[j]=0;SOIL[j]=erodible(m)?1:0;
      }
      DEPOSIT[i]=0;ROOT[i]=0;
    }
  }

  function rebuildRoots(b){
    ROOT.fill(0);
    if(typeof plants==='undefined')return;
    for(const p of plants){
      if(!p?.alive)continue;
      const cx=Math.max(1,Math.min(CW-2,Math.floor(p.x/V104_CELL))),cy=Math.max(1,Math.min(CH-2,Math.floor(p.y/V104_CELL)));
      if(cx<b.l-6||cx>b.r+6||cy<b.t-4||cy>b.b+8)continue;
      const reach=Math.max(1,Math.min(6,Math.round((p.ecoRootDepth||12)/V104_CELL)));
      const vigor=clamp01((p.ecoHealth??1)*(.55+(p.ecoGene?.roots||1)*.35));
      for(let dy=0;dy<=reach;dy++)for(let dx=-reach;dx<=reach;dx++){
        const x=cx+dx,y=cy+dy;if(!inside(x,y))continue;
        const d=Math.hypot(dx,dy*.75);if(d>reach+.25)continue;
        const i=ci(x,y);if(!isSolidM(V104_M[i]))continue;
        ROOT[i]=Math.min(1,ROOT[i]+vigor*(1-d/(reach+1))*.48);
      }
    }
  }

  function moistureStep(b){
    const rain=typeof weather!=='undefined'?clamp01(weather.rain||0):0;
    TMP.set(MOIST);
    for(let y=b.t;y<=b.b;y++)for(let x=b.l;x<=b.r;x++){
      if(!inside(x,y))continue;const i=ci(x,y),m=V104_M[i],p=props(m),sf=sampleFine((x+.5)*V104_CELL,(y+.5)*V104_CELL);
      for(let l=0;l<LANES;l++){
        const j=li(l,i);let q=MOIST[j];
        if(isSolidM(m)){
          if(exposed(x,y))q+=rain*.0018*p.por;
          q+=clamp01(sf.water)*.0038*p.por*(l===MID?1:.38);
          const below=li(l,ci(x,y+1)),sideL=li(l,ci(x-1,y)),sideR=li(l,ci(x+1,y));
          q+=(MOIST[below]-q)*.010*p.por;
          q+=(MOIST[sideL]+MOIST[sideR]-2*q)*.0035*p.por;
          q-=Math.max(0,q-.92)*.0012;
        }else q*=.985;
        TMP[j]=clamp01(q);
      }
      let a=TMP[li(0,i)],c=TMP[li(1,i)],[na,nc]=depthExchange(a,c,.025);TMP[li(0,i)]=na;TMP[li(1,i)]=nc;
      a=TMP[li(2,i)];c=TMP[li(1,i)];[na,nc]=depthExchange(a,c,.025);TMP[li(2,i)]=na;TMP[li(1,i)]=nc;
    }
    MOIST.set(TMP);
  }

  function sedimentAdvection(b){
    TMP.set(SUSP);
    for(let y=b.t;y<=b.b;y++)for(let x=b.l;x<=b.r;x++){
      if(!inside(x,y))continue;const i=ci(x,y),sf=sampleFine((x+.5)*V104_CELL,(y+.5)*V104_CELL),speed=Math.hypot(sf.vx||0,sf.vy||0),dx=(sf.vx||0)>.08?1:(sf.vx||0)<-.08?-1:0,dy=(sf.vy||0)>.10?1:(sf.vy||0)<-.10?-1:0;
      for(let l=0;l<LANES;l++){
        const j=li(l,i),s=SUSP[j];if(s<=1e-6)continue;
        const frac=Math.min(.18,.025+speed*.035)*(l===MID?1:.55);
        if(dx&&inside(x+dx,y)){const k=li(l,ci(x+dx,y)),a=Math.min(s*frac,.018);TMP[j]-=a;TMP[k]+=a;}
        if(dy&&inside(x,y+dy)){const k=li(l,ci(x,y+dy)),a=Math.min(Math.max(0,TMP[j])*frac*.65,.012);TMP[j]-=a;TMP[k]+=a;}
      }
      const j0=li(0,i),j1=li(1,i),j2=li(2,i);
      let d=(TMP[j0]-TMP[j1])*.012;TMP[j0]-=d;TMP[j1]+=d;d=(TMP[j2]-TMP[j1])*.012;TMP[j2]-=d;TMP[j1]+=d;
    }
    SUSP.set(TMP);
  }

  function terrainStep(b){
    let touched=0;
    for(let y=b.t;y<=b.b;y++)for(let x=b.l;x<=b.r;x++){
      if(!inside(x,y))continue;const i=ci(x,y),m=V104_M[i],p=props(m),j=li(MID,i),sf=sampleFine((x+.5)*V104_CELL,(y+.5)*V104_CELL),water=clamp01(sf.water||0),speed=Math.hypot(sf.vx||0,sf.vy||0);
      if(window.GENESIS_V110?.fields?.sediment)GENESIS_V110.fields.sediment[i]=Math.min(2,(GENESIS_V110.fields.sediment[i]||0)*.96+SUSP[j]*.28);
      if(window.GENESIS_V109?.fields?.saturation)GENESIS_V109.fields.saturation[i]=GENESIS_V109.fields.saturation[i]*.97+MOIST[j]*.03;
      if(isSolidM(m)){
        const moisture=MOIST[j],root=ROOT[i],compact=COMPACT[j];
        const targetCompact=clamp01(.34+.38*wetStrength(moisture)+root*.18-water*.12);
        COMPACT[j]+=(targetCompact-COMPACT[j])*.0025;
        if(exposed(x,y)&&erodible(m)){
          const threshold=p.base*(.45+.9*COMPACT[j])*wetStrength(moisture);
          const shear=water*(speed*.95+Math.max(0,sf.vy||0)*.38+.04);
          const e=erosionRate(shear,threshold,p.erode,root);
          if(e>0){SOIL[j]=Math.max(0,SOIL[j]-e);SUSP[j]+=e;erodedMass+=e;touched++;}
          if(moisture>.83&&COMPACT[j]<.58&&root<.22&&!supportBelow(x,y)&&((typeof rnd==='function'?rnd():((i*1103515245+tick*12345)>>>0)/4294967295)<.0025)){
            const bi=ci(x,y+1),bm=V104_M[bi];
            if(!isSolidM(bm)){
              V104_M[bi]=moisture>.72?V104_MAT.MUD:V104_MAT.SAND;V104_M[i]=water>.15?V104_MAT.WATER:V104_MAT.AIR;
              const moved=Math.max(.15,SOIL[j]);SOIL[j]=0;SOIL[li(MID,bi)]=Math.min(1,moved*.9);MOIST[li(MID,bi)]=moisture*.9;COMPACT[li(MID,bi)]=compact*.72;collapsedMass+=moved;touched++;continue;
            }
          }
          if(SOIL[j]<.10){
            SUSP[j]=.18+SUSP[j];V104_M[i]=water>.12?V104_MAT.WATER:V104_MAT.AIR;SOIL[j]=0;erodedMass+=.18;touched++;continue;
          }
        }
      }else{
        const support=isSolidM(V104_M[ci(x,y+1)]),s=SUSP[j],slow=speed<.24;
        if(support&&slow&&s>.002){
          const settle=Math.min(s,.0025+.008*(1-speed/.24));SUSP[j]-=settle;DEPOSIT[i]+=settle;depositedMass+=settle;
          if(DEPOSIT[i]>.34){const wet=MOIST[li(MID,ci(x,y+1))];V104_M[i]=wet>.62?V104_MAT.MUD:V104_MAT.SAND;SOIL[j]=Math.min(1,.55+DEPOSIT[i]);COMPACT[j]=.35;MOIST[j]=wet*.65;DEPOSIT[i]=0;touched++;}
        }
      }
    }
    lastTouched=touched;
  }

  function coupleCreatures(b){
    if(typeof creatures==='undefined')return;
    for(const c of creatures){if(!c?.alive||c.gone)continue;for(const n of c.nodes||[]){
      const x=Math.floor(n.x/V104_CELL),y=Math.floor((n.y+(n.r||2)*.5)/V104_CELL);if(!inside(x,y)||x<b.l||x>b.r||y<b.t||y>b.b)continue;const i=ci(x,y),m=V104_M[i],j=li(MID,i);if(!(m===V104_MAT.MUD||m===V104_MAT.SAND||m===V104_MAT.DIRT))continue;
      const moist=MOIST[j],soft=clamp01(moist*(1-COMPACT[j])*(m===V104_MAT.MUD?1.3:.75));if(soft<=.04)continue;
      const vx=n.x-n.px,vy=n.y-n.py,drag=.025+soft*.13;n.px=n.x-vx*(1-drag);n.py=n.y-vy*(1-drag);n.y+=soft*.012;
      if(n.contact>0){COMPACT[j]=clamp01(COMPACT[j]+.0008*(n.r||2));MOIST[j]=clamp01(MOIST[j]-.00015);}
    }}
  }

  function couplePlants(b){
    if(typeof plants==='undefined')return;
    for(const p of plants){if(!p?.alive||p.ecoWater==null)continue;const x=Math.floor(p.x/V104_CELL),y=Math.floor(p.y/V104_CELL);if(!inside(x,y)||x<b.l||x>b.r||y<b.t||y>b.b)continue;const i=ci(x,y),m=MOIST[li(MID,i)];p.ecoWater=clamp01(p.ecoWater+(m-p.ecoWater)*.0012);if(m>.93&&p.ecoHealth!=null)p.ecoHealth=Math.max(0,p.ecoHealth-.000015);}
  }

  function stabilizeFineWater(){
    const W=FR.fields.water,VX=FR.fields.velocityX,VY=FR.fields.velocityY,S=FR.fields.solid,FW=FR.width,FH=FR.height;if(!W||!VX||!VY||!FW||!FH)return;
    const b=visibleBounds(1),scale=FR.scale||2,fl=Math.max(1,b.l*scale),fr=Math.min(FW-2,(b.r+1)*scale-1),ft=Math.max(1,b.t*scale),fb=Math.min(FH-2,(b.b+1)*scale-1);
    let before=0,after=0;
    for(let y=ft;y<=fb;y++)for(let x=fl;x<=fr;x++){const i=y*FW+x;if(!S[i])before+=W[i];}
    for(let y=ft;y<=fb;y+=2)for(let x=fl;x<=fr;x+=2){const i=y*FW+x;if(S[i])continue;const neigh=[i-1,i+1,i-FW,i+FW];let avx=0,avy=0,n=0;for(const j of neigh){if(S[j])continue;avx+=VX[j];avy+=VY[j];n++;}if(n){VX[i]=VX[i]*.93+(avx/n)*.07;VY[i]=VY[i]*.93+(avy/n)*.07;}}
    for(let y=ft;y<=fb;y+=2)for(let x=fl;x<fr;x+=2){const i=y*FW+x,j=i+1;if(S[i]||S[j])continue;const d=W[i]-W[j];if(Math.abs(d)>.16){const a=Math.min(Math.abs(d)*.035,d>0?W[i]:W[j],.012);if(d>0){W[i]-=a;W[j]+=a}else{W[j]-=a;W[i]+=a}}}
    for(let y=ft;y<=fb;y++)for(let x=fl;x<=fr;x++){const i=y*FW+x;if(!S[i])after+=W[i];}
    lastWaterResidual=after-before;
  }

  function drawGeomorph(){
    if(typeof X==='undefined'||typeof worldToScreen!=='function')return;const b=visibleBounds(1),z=camera.zoom;X.save();
    for(let x=b.l;x<=b.r;x+=2){for(let y=b.t;y<=b.b;y++){
      if(!inside(x,y))continue;const i=ci(x,y),m=V104_M[i];if(!isSolidM(m)||!exposed(x,y))continue;const q=worldToScreen((x+.5)*V104_CELL,y*V104_CELL),mo=MOIST[li(MID,i)],dep=DEPOSIT[i],root=ROOT[i];
      if(mo>.35){X.fillStyle=`rgba(21,42,34,${Math.min(.18,(mo-.35)*.22)})`;X.beginPath();X.ellipse(q.x,q.y+1*z,6*z,1.6*z,0,0,Math.PI*2);X.fill();}
      if(dep>.025){X.fillStyle=`rgba(166,143,91,${Math.min(.16,dep*.22)})`;X.beginPath();X.ellipse(q.x,q.y+.5*z,5*z,1.2*z,0,0,Math.PI*2);X.fill();}
      if(root>.18){X.strokeStyle=`rgba(88,111,67,${Math.min(.18,root*.16)})`;X.lineWidth=Math.max(.5,.7*z);X.beginPath();X.moveTo(q.x,q.y);X.lineTo(q.x+(root-.5)*5*z,q.y+5*z);X.stroke();}
      break;
    }}
    X.restore();
  }

  function metrics(){return{lanes:LANES,authoritativeLane:MID,erodedMass,depositedMass,collapsedMass,lastWaterResidual,lastStepMs,lastTouched,approximation:'3 depth-lane moisture/sediment + 2D authoritative geomorphology coupled to conservative refined-water field; not CFD/full 3D'}}

  seed();
  const STEP=step;step=function(){const t0=performance?.now?.()||0;STEP();tick++;const b=visibleBounds(3);if(tick%30===1)rebuildRoots(b);moistureStep(b);sedimentAdvection(b);terrainStep(b);coupleCreatures(b);couplePlants(b);stabilizeFineWater();lastStepMs=(performance?.now?.()||t0)-t0;};
  const TERR=drawTerrain;drawTerrain=function(t){TERR(t);drawGeomorph();};
  const RESET=reset;reset=function(){RESET();seed();erodedMass=depositedMass=collapsedMass=0;};

  window.GENESIS_HYDRO25={
    status:'experimental',version:1,full3D:false,cfd:false,lanes:LANES,authoritativeLane:MID,
    fields:{moisture:MOIST,compaction:COMPACT,suspendedSediment:SUSP,soilMass:SOIL,rootStrength:ROOT,depositMass:DEPOSIT},metrics,
    test:{wetStrength,erosionRate,pairRelax,depthExchange},
    debugReseed:seed,debugVisibleBounds:visibleBounds,debugTerrainStep:terrainStep,debugSedimentStep:sedimentAdvection,debugMoistureStep:moistureStep,debugStabilizeWater:stabilizeFineWater,debugIndex:ci,debugLaneIndex:li
  };
})();
