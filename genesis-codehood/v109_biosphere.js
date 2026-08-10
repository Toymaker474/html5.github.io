'use strict';
/* GENESIS V109 — PHYSICAL BIOSPHERE FOUNDATION
   Authoritative simulation layer: geology fields, hydrology/infiltration,
   sediment/erosion coupling, thermal seepage, 2.5D depth topology,
   and engineering telemetry. No quests, loot, scripted encounters, or gameplay rewards.
*/
(function(){
  if(typeof V104_COLS==='undefined'||typeof V104_ROWS==='undefined'||typeof V104_M==='undefined') return;

  const V109=window.GENESIS_V109={
    version:'109.1',name:'PHYSICAL BIOSPHERE',
    active:['matter-properties','geology-fields','hydrology','sediment','thermal-coupling','2.5d-topology'],
    planned:['anatomy-compiler','muscle-control','physical-mouths','physiology','living-flora-v2','sensory-physics','autonomous-agent','gpu-render-extraction','observatory'],
    invariant:'simulation state is authoritative; rendering never invents outcomes'
  };

  const N=V104_COLS*V104_ROWS;
  const POR=new Uint8Array(N);
  const HARD=new Uint8Array(N);
  const SAT=new Float32Array(N);
  const SED=new Float32Array(N);
  const FXF=new Float32Array(N);
  const FYF=new Float32Array(N);
  const DEPTH=new Int8Array(N);
  const ORGANIC=new Float32Array(N);
  const STRATA=new Uint8Array(N);
  const COL_AQUIFER=new Float32Array(V104_COLS);
  const COL_UPLIFT=new Float32Array(V104_COLS);
  const COL_DRAIN=new Float32Array(V104_COLS);
  let cursor=0,erosionEvents=0,seepEvents=0,depositEvents=0;

  const MATPROP={
    [V104_MAT.ROCK]:{por:.05,hard:.92,sed:0},
    [V104_MAT.DIRT]:{por:.42,hard:.34,sed:.08},
    [V104_MAT.SAND]:{por:.53,hard:.15,sed:.55},
    [V104_MAT.WATER]:{por:1,hard:0,sed:0},
    [V104_MAT.LAVA]:{por:0,hard:.05,sed:0},
    [V104_MAT.MUD]:{por:.36,hard:.12,sed:.26},
    [V104_MAT.OBSIDIAN]:{por:.01,hard:.98,sed:0},
    [V104_MAT.ASH]:{por:.61,hard:.06,sed:.64},
    [V104_MAT.AIR]:{por:1,hard:0,sed:0}
  };

  const clamp01=v=>Math.max(0,Math.min(1,v));
  const exposed=(x,y)=>v104In(x,y)&&v104SolidMat(v104Get(x,y))&&!v104SolidMat(v104Get(x,y-1));
  const idx=(x,y)=>v104Idx(x,y);
  const h2=(x,y,s=0)=>hash((x*73856093)^(y*19349663)^(s*83492791));

  function v109ProvinceField(x){
    const ridge=fbm1(x*.72,301)-.5;
    const basin=fbm1(x*1.31+170,417)-.5;
    return {uplift:clamp01(.48+ridge*.95),basin:clamp01(.52-basin*.8),geothermal:clamp01(.15+Math.max(0,fbm1(x+900,533)-.48)*2.4)};
  }

  function v109InitGeology(){
    POR.fill(0);HARD.fill(0);SAT.fill(0);SED.fill(0);FXF.fill(0);FYF.fill(0);DEPTH.fill(0);ORGANIC.fill(0);STRATA.fill(0);
    for(let x=0;x<V104_COLS;x++){
      const p=v109ProvinceField(x);COL_UPLIFT[x]=p.uplift;
      COL_AQUIFER[x]=clamp01(.18+p.basin*.62+(fbm1(x*.45+270,611)-.5)*.22);
      COL_DRAIN[x]=0;
    }
    for(let y=0;y<V104_ROWS;y++)for(let x=0;x<V104_COLS;x++){
      const i=idx(x,y),m=V104_M[i],prop=MATPROP[m]||MATPROP[V104_MAT.AIR];
      const layerNoise=h2(x>>2,y>>2,17),fault=Math.abs((x/V104_COLS)-(.12+.76*h2(x>>5,0,91)))<.012?1:0;
      const deep=y/V104_ROWS;
      const lith=(Math.floor((deep*5+layerNoise*1.8+COL_UPLIFT[x]*.7))%5+5)%5;
      STRATA[i]=lith;
      let hard=prop.hard*(.82+.28*h2(x,y,23));
      let por=prop.por*(.78+.38*h2(x,y,29));
      if(m===V104_MAT.ROCK){hard*=.72+lith*.08;por*=1.25-lith*.08;}
      if(fault){hard*=.46;por=Math.max(por,.38);}
      HARD[i]=Math.round(clamp01(hard)*255);POR[i]=Math.round(clamp01(por)*255);
      SAT[i]=(m===V104_MAT.WATER?1:m===V104_MAT.MUD?.72:0);
      SED[i]=prop.sed*(m===V104_MAT.ASH?.9:1);
      ORGANIC[i]=(m===V104_MAT.DIRT||m===V104_MAT.MUD)?.04*h2(x,y,71):0;
      const cave=!v104SolidMat(m),roof=y>1&&v104SolidMat(v104Get(x,y-1));
      let z=0;if(cave&&roof)z=-1;if(cave&&roof&&y>V104_ROWS*.58&&h2(x,y,121)>.7)z=-2;if(exposed(x,y)&&h2(x,y,131)>.83)z=1;DEPTH[i]=z;
    }
    for(let f=0;f<9;f++){
      let x=20+Math.floor(h2(f,4,501)*(V104_COLS-40));
      let y=Math.floor(V104_ROWS*(.22+.42*h2(f,9,503)));
      const slope=(h2(f,12,505)-.5)*.32;
      for(let k=0;k<Math.floor(V104_ROWS*.62);k++){
        const xx=clamp(Math.round(x+slope*k+Math.sin(k*.11+f)*2),2,V104_COLS-3),yy=clamp(y+k,2,V104_ROWS-3),i=idx(xx,yy);
        POR[i]=Math.max(POR[i],175);HARD[i]=Math.min(HARD[i],105);
        if(v104SolidMat(V104_M[i]))SAT[i]=Math.max(SAT[i],COL_AQUIFER[xx]*.28);
      }
    }
    cursor=0;erosionEvents=seepEvents=depositEvents=0;
  }

  function v109Potential(x,y){if(!v104In(x,y))return 999;const i=idx(x,y),water=(V104_M[i]===V104_MAT.WATER?1:SAT[i]);return y/V104_ROWS+water*.12-HARD[i]/255*.025;}

  function v109HydroCell(x,y){
    if(!v104In(x,y)||y<=1||y>=V104_ROWS-2)return;
    const i=idx(x,y),m=V104_M[i],por=POR[i]/255;if(m===V104_MAT.AIR)return;
    if(exposed(x,y)&&weather&&weather.rain>.05)SAT[i]=Math.min(1,SAT[i]+weather.rain*(.0012+.0038*por));
    if(m===V104_MAT.WATER)SAT[i]=1;
    let bestX=x,bestY=y,bestP=v109Potential(x,y),bestSat=SAT[i];
    for(const [dx,dy] of [[0,1],[-1,0],[1,0],[-1,1],[1,1]]){
      const nx=x+dx,ny=y+dy;if(!v104In(nx,ny))continue;
      const j=idx(nx,ny),np=v109Potential(nx,ny),perm=(POR[j]/255)*(.35+por*.65),score=np-(SAT[j]-SAT[i])*.08-perm*.018;
      if(score>bestP+.002){bestP=score;bestX=nx;bestY=ny;bestSat=SAT[j];}
    }
    const dx=bestX-x,dy=bestY-y,flow=(Math.abs(dx)+Math.abs(dy))?Math.min(.12,Math.max(0,(SAT[i]-bestSat)*.22+.008*por)):0;
    FXF[i]=lerp(FXF[i],dx*flow,.18);FYF[i]=lerp(FYF[i],dy*flow,.18);
    if(flow>0){const j=idx(bestX,bestY),amt=Math.min(SAT[i],flow);SAT[i]-=amt;SAT[j]=Math.min(1,SAT[j]+amt*.96);COL_DRAIN[x]=lerp(COL_DRAIN[x],Math.abs(FXF[i])+Math.max(0,FYF[i]),.01);}else{FXF[i]*=.96;FYF[i]*=.96;}
    const shear=Math.hypot(FXF[i],FYF[i]),hardness=HARD[i]/255;
    if(m===V104_MAT.DIRT&&SAT[i]>.72&&shear>.005&&h2(x,y,simTick>>5)>.996){V104_M[i]=V104_MAT.MUD;erosionEvents++;}
    if(exposed(x,y)&&shear>.012&&hardness<.38&&SAT[i]>.52&&h2(x,y,simTick>>4)>.9976){SED[i]=Math.min(2,SED[i]+.11*(1-hardness));if((m===V104_MAT.DIRT||m===V104_MAT.MUD||m===V104_MAT.ASH)&&SED[i]>.85&&h2(x,y,simTick)>.9988){V104_M[i]=V104_MAT.AIR;SED[i]-=.42;erosionEvents++;}}
    if(SAT[i]>.93&&por>.34&&V104_MAT.WATER!==m){for(const [sx,sy] of [[0,-1],[-1,0],[1,0]]){const nx=x+sx,ny=y+sy;if(!v104In(nx,ny))continue;if(v104Get(nx,ny)===V104_MAT.AIR&&h2(nx,ny,simTick>>3)>.9992){v104Set(nx,ny,V104_MAT.WATER);SAT[i]=Math.max(.55,SAT[i]-.25);seepEvents++;break;}}}
    if(SED[i]>.42&&shear<.003&&v104Get(x,y-1)===V104_MAT.AIR&&h2(x,y,simTick>>4)>.9987){v104Set(x,y-1,SED[i]>.8?V104_MAT.SAND:V104_MAT.DIRT);SED[i]=Math.max(0,SED[i]-.38);depositEvents++;}
  }

  function v109OrganicCoupling(){
    if(typeof ECO_D==='undefined')return;
    const samples=innerWidth<700?70:120;
    for(let k=0;k<samples;k++){
      const tx=Math.floor(rnd()*COLS),ty=Math.floor(rnd()*ROWS),ei=tidx(tx,ty),d=ECO_D[ei]||0;if(d<=0)continue;
      const mx=clamp(Math.floor((tx+.5)*TILE/V104_CELL),0,V104_COLS-1),my=clamp(Math.floor((ty+.5)*TILE/V104_CELL),0,V104_ROWS-1),i=idx(mx,my);
      ORGANIC[i]=Math.min(2,ORGANIC[i]+d*.0007);
    }
  }

  function v109ThermalCoupling(){
    if(typeof V105_HEAT==='undefined')return;
    const samples=innerWidth<700?90:150;
    for(let k=0;k<samples;k++){
      const i=(cursor*977+k*131)%N,m=V104_M[i];
      if(m===V104_MAT.LAVA){SAT[i]=Math.max(0,SAT[i]-.02);ORGANIC[i]*=.96;}
      else if(i<V105_HEAT.length&&V105_HEAT[i]>180){SAT[i]=Math.max(0,SAT[i]-.004);ORGANIC[i]*=.995;}
    }
  }

  function v109StepFoundation(){
    const b=typeof v104VisibleMicroBounds==='function'?v104VisibleMicroBounds(34):{l:1,r:V104_COLS-2,t:1,b:V104_ROWS-2};
    const w=Math.max(1,b.r-b.l+1),h=Math.max(1,b.b-b.t+1),budget=innerWidth<700?720:1250;
    for(let k=0;k<budget;k++){const n=cursor++%(w*h),x=b.l+(n%w),y=b.t+((n/w)|0);v109HydroCell(x,y);}
    v109OrganicCoupling();v109ThermalCoupling();
  }

  function v109DepthAtWorld(x,y){const c=v104CellAtWorld(x,y);return v104In(c.x,c.y)?DEPTH[idx(c.x,c.y)]:0;}
  V109.fields={porosity:POR,hardness:HARD,saturation:SAT,sediment:SED,flowX:FXF,flowY:FYF,depth:DEPTH,organic:ORGANIC,strata:STRATA};
  V109.depthAtWorld=v109DepthAtWorld;
  V109.metrics=()=>({erosionEvents,seepEvents,depositEvents,avgDrainage:COL_DRAIN.reduce((a,b)=>a+b,0)/COL_DRAIN.length});
  V109.contracts={
    anatomyCompiler:{input:'genome + body blueprint',output:'rigid/soft nodes + joints + muscles + organs + sensors'},
    motor:{input:'intention + proprioception',output:'muscle activation only; never direct body velocity'},
    mouth:{input:'jaw actuator + geometry contact',output:'held anatomical target / ingestion; never range damage'},
    physiology:{input:'organ perfusion + hydration + energy + temperature',output:'functional capacity / failure'},
    senses:{input:'light/sound/chemical/contact fields',output:'uncertain observations; never hidden world coordinates'},
    agent:{input:'observations + needs + memory',output:'intention; never scripted quest state'},
    renderer:{input:'authoritative simulation snapshot',output:'2.5D surfaces/materials/lights only'}
  };

  const STEP=step;step=function(){STEP();v109StepFoundation();};
  const RESET=reset;reset=function(){RESET();v109InitGeology();};

  const BG=drawBackground;
  drawBackground=function(t){
    BG(t);
    for(let layer=0;layer<3;layer++){
      const par=.035+layer*.028,alpha=.055+layer*.025;
      X.fillStyle=`rgba(${8+layer*3},${26+layer*4},${24+layer*5},${alpha})`;
      X.beginPath();X.moveTo(0,SH);
      for(let sx=-90;sx<=SW+90;sx+=34){
        const wx=clamp(Math.floor((camera.x*par+(sx-SW*.5)/camera.zoom)/WORLD_W*V104_COLS),0,V104_COLS-1),upl=COL_UPLIFT[wx]||.5,aq=COL_AQUIFER[wx]||.2;
        const y=SH*(.42+layer*.075)-upl*(80+layer*25)-Math.sin(wx*.037+layer)*22;X.lineTo(sx,y+aq*18);
      }
      X.lineTo(SW,SH);X.closePath();X.fill();
    }
  };

  const TERR=drawTerrain;
  drawTerrain=function(t){
    TERR(t);if(typeof v104VisibleMicroBounds!=='function')return;
    const b=v104VisibleMicroBounds(3),z=camera.zoom;
    for(let y=b.t;y<=b.b;y+=2)for(let x=b.l;x<=b.r;x+=2){
      const i=idx(x,y),m=V104_M[i],sat=SAT[i],sed=SED[i],hard=HARD[i]/255;if(m===V104_MAT.AIR)continue;
      if(sat>.62||sed>.45||hard<.18){const p=worldToScreen((x+.5)*V104_CELL,(y+.5)*V104_CELL),r=Math.max(.8,V104_CELL*z*.45);if(sat>.62){X.fillStyle=`rgba(80,156,152,${Math.min(.13,(sat-.6)*.22)})`;X.beginPath();X.ellipse(p.x,p.y,r*1.2,r*.32,0,0,TAU);X.fill();}if(sed>.45){X.fillStyle=`rgba(164,134,80,${Math.min(.10,sed*.07)})`;X.fillRect(p.x-r*.6,p.y-r*.12,r*1.2,Math.max(.6,r*.18));}}
    }
  };

  const UI=updateUI;
  updateUI=function(){UI();if(stats&&stats.innerHTML&&!stats.innerHTML.includes('V109')){const m=V109.metrics();stats.innerHTML+=`<br><span class="dim">V109 matter · hydro · geology · 2.5D | erode ${m.erosionEvents} · seep ${m.seepEvents}</span>`;}};

  v109InitGeology();
})();
