'use strict';
/* GENESIS V110 — FULL WORLD PHYSICS
   World-scale physical foundation layered over V109:
   water volume/pressure, groundwater springs, sediment transport,
   accelerated geological settling, thermal vapor, depth-derived 2.5D rendering,
   and conservative telemetry. Rendering reads physics; it does not author outcomes.
*/
(function(){
  if(typeof V104_COLS==='undefined'||typeof V104_ROWS==='undefined'||typeof V104_M==='undefined') return;
  const V109=window.GENESIS_V109;
  if(!V109?.fields) return;

  const W=V104_COLS,H=V104_ROWS,N=W*H,CELL=V104_CELL;
  const F=V109.fields;
  const VOL=new Float32Array(N);
  const VX=new Float32Array(N);
  const VY=new Float32Array(N);
  const LOAD=new Float32Array(N);
  const VAPOR=new Float32Array(N);
  const STRESS=new Float32Array(N);
  const WET=new Float32Array(N);
  const FLUX=new Float32Array(N);
  const SRC=new Uint8Array(N);
  const BED=new Float32Array(N);
  const SURFACE=new Int16Array(W);
  const WATERLINE=new Float32Array(W);
  let tick=0,eroded=0,deposited=0,springs=0,evaporated=0,settled=0;
  let waterAdded=0,waterLost=0;

  const I=(x,y)=>y*W+x;
  const inside=(x,y)=>x>0&&y>0&&x<W-1&&y<H-1;
  const c01=v=>Math.max(0,Math.min(1,v));
  const solid=m=>v104SolidMat(m);
  const porous=(i)=>(F.porosity[i]||0)/255;
  const hard=(i)=>(F.hardness[i]||0)/255;
  const depth=(i)=>(F.depth?.[i]||0);
  const hash2=(x,y,s=0)=>hash(((x*92837111)^(y*689287499)^(s*283923481))|0);

  function surfaceScan(){
    for(let x=0;x<W;x++){
      let sy=H-2;
      for(let y=1;y<H-1;y++){if(solid(v104Get(x,y))&&!solid(v104Get(x,y-1))){sy=y;break}}
      SURFACE[x]=sy;
    }
  }

  function seedWaterFromMaterials(){
    VOL.fill(0);VX.fill(0);VY.fill(0);LOAD.fill(0);VAPOR.fill(0);STRESS.fill(0);WET.fill(0);FLUX.fill(0);SRC.fill(0);BED.fill(0);
    waterAdded=waterLost=0;
    surfaceScan();
    for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){
      const i=I(x,y),m=V104_M[i];
      if(m===V104_MAT.WATER) VOL[i]=1;
      else if(m===V104_MAT.MUD) VOL[i]=.12;
      const sat=F.saturation?.[i]||0;
      if(solid(m)) WET[i]=sat;
      if(!solid(m) && sat>.82) VOL[i]=Math.max(VOL[i],(sat-.80)*1.7);
    }
    seedSprings();
  }

  function seedSprings(){
    springs=0;
    for(let x=2;x<W-2;x++){
      const sy=SURFACE[x];
      for(let y=Math.max(2,sy-18);y<Math.min(H-2,sy+26);y++){
        const i=I(x,y),m=V104_M[i];
        if(m!==V104_MAT.AIR) continue;
        let best=0;
        for(const [dx,dy] of [[-1,0],[1,0],[0,1]]){
          const j=I(x+dx,y+dy); if(!solid(V104_M[j])) continue;
          const sat=F.saturation?.[j]||0,por=porous(j);
          best=Math.max(best,sat*por);
        }
        if(best>.26){SRC[i]=Math.min(255,Math.floor((best-.22)*340));springs++;}
      }
    }
  }

  function localHead(x,y,i){
    let p=VOL[i]*.72 + y/H*1.18;
    if(VOL[i]>.02){
      let n=0;for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){const j=I(x+dx,y+dy);n+=VOL[j]}
      p+=(n*.25-VOL[i])*.08;
    }
    return p;
  }

  function transfer(i,j,dx,dy,maxAmt){
    if(maxAmt<=0||VOL[i]<=.0001) return 0;
    const m=V104_M[j];
    if(solid(m) && m!==V104_MAT.MUD) return 0;
    const cap=(m===V104_MAT.AIR||m===V104_MAT.WATER)?1.28:(m===V104_MAT.MUD?.28:.08);
    const room=Math.max(0,cap-VOL[j]);
    const amt=Math.min(VOL[i],room,maxAmt);
    if(amt<=0) return 0;
    VOL[i]-=amt;VOL[j]+=amt;
    const momX=VX[i],momY=VY[i];
    VX[j]+=momX*amt*.18+dx*amt*.12;VY[j]+=momY*amt*.18+dy*amt*.12;
    VX[i]*=.97;VY[i]*=.97;
    const sed=Math.min(LOAD[i],amt*(.15+Math.hypot(momX,momY)*.12));
    LOAD[i]-=sed;LOAD[j]+=sed;
    return amt;
  }

  function waterCell(x,y){
    if(!inside(x,y))return;
    const i=I(x,y),m=V104_M[i];
    if(VOL[i]<=.0005 && !SRC[i]){VX[i]*=.9;VY[i]*=.9;FLUX[i]*=.85;return}

    if(SRC[i]){
      const a=SRC[i]/255*.0018;
      VOL[i]=Math.min(1.2,VOL[i]+a);waterAdded+=a;
    }

    if(m===V104_MAT.AIR && y>1 && weather?.rain>.08 && solid(v104Get(x,y+1)) && !solid(v104Get(x,y))){
      const a=weather.rain*.00065;VOL[i]=Math.min(1.1,VOL[i]+a);waterAdded+=a;
    }

    if(VOL[i]<=.0005)return;
    VX[i]*=.985;VY[i]=VY[i]*.985+.012;
    const head=localHead(x,y,i);
    let out=0;

    const below=I(x,y+1);
    if(!solid(V104_M[below])){
      const dh=head-localHead(x,y+1,below)+.09;
      const a=Math.min(.18,Math.max(0,dh*.18+VOL[i]*.04));
      const moved=transfer(i,below,0,1,a);out+=moved;VY[i]+=moved*.08;
    }

    const dir=((x+y+tick)&1)?1:-1;
    for(const dx of [dir,-dir]){
      const nx=x+dx,j=I(nx,y); if(solid(V104_M[j]))continue;
      const dh=localHead(x,y,i)-localHead(nx,y,j);
      const a=Math.min(.075,Math.max(0,dh*.10+Math.max(0,VOL[i]-.86)*.06));
      const moved=transfer(i,j,dx,0,a);out+=moved;VX[i]+=dx*moved*.06;
    }

    if(VOL[i]>.72){
      for(const dx of [dir,-dir]){const j=I(x+dx,y+1);if(!solid(V104_M[j]))out+=transfer(i,j,dx,1,.025)}
    }

    FLUX[i]=FLUX[i]*.72+out*.28;
    erosionAt(x,y,i,out);
    thermalAt(x,y,i);
  }

  function erosionAt(x,y,i,flow){
    const speed=Math.hypot(VX[i],VY[i])+flow*2.4;
    if(speed<.009)return;
    for(const [dx,dy] of [[0,1],[-1,0],[1,0]]){
      const nx=x+dx,ny=y+dy,j=I(nx,ny),m=V104_M[j];
      if(!(m===V104_MAT.DIRT||m===V104_MAT.MUD||m===V104_MAT.SAND||m===V104_MAT.ASH))continue;
      const resistance=.08+hard(j)*.92;
      const saturation=F.saturation?.[j]||0;
      const shear=speed*(.7+saturation*.7)-resistance*.025;
      if(shear<=.005)continue;
      STRESS[j]=Math.min(2,STRESS[j]+shear*.0045);
      if(STRESS[j]>(m===V104_MAT.SAND?.06:m===V104_MAT.ASH?.035:.12)){
        const yieldMass=m===V104_MAT.SAND?.28:m===V104_MAT.ASH?.22:.16;
        LOAD[i]=Math.min(2.5,LOAD[i]+yieldMass);
        STRESS[j]=0;
        if(m===V104_MAT.MUD||m===V104_MAT.ASH||hash2(nx,ny,tick>>3)>.53){V104_M[j]=V104_MAT.AIR;eroded++;}
        else if(m===V104_MAT.DIRT){V104_M[j]=V104_MAT.MUD;eroded++;}
      }
    }

    if(LOAD[i]>.04 && speed<.018){
      const j=I(x,y+1),m=V104_M[j];
      if(solid(m) && V104_M[i]===V104_MAT.AIR){
        const a=Math.min(LOAD[i],.025);LOAD[i]-=a;BED[i]+=a;
        if(BED[i]>.62){V104_M[i]=LOAD[i]>.45?V104_MAT.SAND:V104_MAT.DIRT;BED[i]=0;deposited++;}
      }
    }
  }

  function thermalAt(x,y,i){
    let heat=0;
    if(V104_M[i]===V104_MAT.LAVA)heat=1;
    if(typeof V105_HEAT!=='undefined' && i<V105_HEAT.length)heat=Math.max(heat,Math.max(0,(V105_HEAT[i]-120)/160));
    if(heat<=0)return;
    const evap=Math.min(VOL[i],heat*.0024);
    if(evap>0){VOL[i]-=evap;VAPOR[i]=Math.min(1.5,VAPOR[i]+evap*4);waterLost+=evap;evaporated+=evap;}
  }

  function vaporStep(i){
    if(VAPOR[i]<=.0001)return;
    VAPOR[i]*=.994;
    const y=(i/W)|0,x=i-y*W;
    if(y>1&&V104_M[I(x,y-1)]===V104_MAT.AIR){const a=VAPOR[i]*.035;VAPOR[i]-=a;VAPOR[I(x,y-1)]+=a}
  }

  function saturationCoupling(){
    const budget=innerWidth<700?500:900;
    for(let k=0;k<budget;k++){
      const i=(tick*911+k*3571)%N,m=V104_M[i];
      if(!solid(m))continue;
      const y=(i/W)|0,x=i-y*W,por=porous(i),sat=F.saturation?.[i]||0;
      let adjacent=0;
      for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){const j=I(x+dx,y+dy);adjacent=Math.max(adjacent,VOL[j])}
      if(adjacent>.08&&por>.08){const a=Math.min(adjacent*.0008,por*.0015);F.saturation[i]=Math.min(1,sat+a);WET[i]=Math.max(WET[i],F.saturation[i])}
      else WET[i]=Math.max(0,WET[i]*.9995);
    }
  }

  function syncMaterialWater(){
    const b=typeof v104VisibleMicroBounds==='function'?v104VisibleMicroBounds(18):{l:1,r:W-2,t:1,b:H-2};
    const budget=innerWidth<700?420:760,w=Math.max(1,b.r-b.l+1),h=Math.max(1,b.b-b.t+1);
    for(let k=0;k<budget;k++){
      const n=(tick*593+k*1777)%(w*h),x=b.l+n%w,y=b.t+((n/w)|0),i=I(x,y),m=V104_M[i];
      if(m===V104_MAT.AIR&&VOL[i]>.56)V104_M[i]=V104_MAT.WATER;
      else if(m===V104_MAT.WATER&&VOL[i]<.08)V104_M[i]=V104_MAT.AIR;
      else if(m===V104_MAT.WATER)VOL[i]=Math.max(VOL[i],.22);
    }
  }

  function acceleratedSettling(iter=14){
    const samples=Math.min(26000,Math.max(7000,Math.floor(W*H*.07)));
    for(let pass=0;pass<iter;pass++){
      for(let k=0;k<samples/iter;k++){
        const x=2+Math.floor(hash2(k,pass,701)*(W-4));
        const y=2+Math.floor(hash2(k,pass,709)*(H-4));
        const i=I(x,y),m=V104_M[i];
        if(m===V104_MAT.AIR){
          const sy=SURFACE[x];
          if(y<sy&&hash2(x,y,pass)>.9985){VOL[i]=Math.max(VOL[i],.2+hash2(y,x,733)*.6)}
        }else if((m===V104_MAT.DIRT||m===V104_MAT.SAND||m===V104_MAT.ASH)&&!solid(v104Get(x,y+1))){
          const j=I(x,y+1); if(hash2(x,y,pass+811)>.64){V104_M[j]=m;V104_M[i]=V104_MAT.AIR;settled++;}
        }
      }
    }
    surfaceScan();seedSprings();
  }

  function total(arr,step=97){let s=0;for(let i=0;i<arr.length;i+=step)s+=arr[i];return s*step}
  function metrics(){
    return {
      waterMass:total(VOL), sedimentMass:total(LOAD), vaporMass:total(VAPOR),
      eroded,deposited,springs,evaporated,settled,
      waterAdded,waterLost,
      conservationResidual:waterAdded-waterLost-total(VOL)/Math.max(1,N)
    };
  }

  function stepWorld(){
    tick++;
    const b=typeof v104VisibleMicroBounds==='function'?v104VisibleMicroBounds(30):{l:1,r:W-2,t:1,b:H-2};
    const bw=Math.max(1,b.r-b.l+1),bh=Math.max(1,b.b-b.t+1),budget=innerWidth<700?920:1600;
    for(let k=0;k<budget;k++){
      const n=(tick*1009+k*331)%(bw*bh),x=b.l+n%bw,y=b.b-((n/bw)|0);
      waterCell(x,y);
      vaporStep(I(x,y));
    }
    saturationCoupling();
    if((tick&3)===0)syncMaterialWater();
    if(tick%180===0){surfaceScan();seedSprings();}
  }

  function waterSurfaceAt(x){
    const xx=Math.max(1,Math.min(W-2,x));
    let sy=H-2;
    for(let y=1;y<H-1;y++)if(VOL[I(xx,y)]>.12){sy=y;break}
    WATERLINE[xx]=WATERLINE[xx]||sy;
    WATERLINE[xx]=WATERLINE[xx]*.88+sy*.12;
    return WATERLINE[xx];
  }

  function drawDepthGeology(t){
    const z=camera.zoom;
    for(let layer=-2;layer<=-1;layer++){
      X.fillStyle=layer===-2?'rgba(5,12,14,.22)':'rgba(8,22,21,.14)';
      X.beginPath();X.moveTo(0,SH);
      for(let sx=-50;sx<=SW+50;sx+=28){
        const wx=(sx-SW*.5)/z+camera.x,mx=Math.max(1,Math.min(W-2,Math.floor(wx/CELL)));
        let y=H*.46;
        for(let yy=2;yy<H-2;yy++){const i=I(mx,yy);if(depth(i)===layer){y=yy;break}}
        const wy=y*CELL,p=worldToScreen(wx,wy);X.lineTo(sx,p.y+layer*10*z);
      }
      X.lineTo(SW,SH);X.closePath();X.fill();
    }
  }

  function drawWaterPhysics(t){
    const b=typeof v104VisibleMicroBounds==='function'?v104VisibleMicroBounds(5):{l:1,r:W-2,t:1,b:H-2};
    const z=camera.zoom;
    X.lineCap='round';X.lineJoin='round';
    X.strokeStyle='rgba(104,190,191,.27)';X.lineWidth=Math.max(1,1.4*z);
    X.beginPath();let started=false;
    for(let x=b.l;x<=b.r;x+=2){
      const sy=waterSurfaceAt(x),i=I(x,Math.max(1,Math.min(H-2,Math.round(sy))));
      if(VOL[i]<.08){started=false;continue}
      const wx=(x+.5)*CELL,wy=sy*CELL+Math.sin(t*.002+x*.17)*Math.min(1.8,FLUX[i]*18),p=worldToScreen(wx,wy);
      if(!started){X.moveTo(p.x,p.y);started=true}else X.lineTo(p.x,p.y);
    }
    X.stroke();

    for(let y=b.t;y<=b.b;y+=2)for(let x=b.l;x<=b.r;x+=2){
      const i=I(x,y);if(VOL[i]<.02&&VAPOR[i]<.015&&!SRC[i])continue;
      const p=worldToScreen((x+.5)*CELL,(y+.5)*CELL);
      if(VY[i]>.035&&VOL[i]>.08&&V104_M[I(x,y+1)]===V104_MAT.AIR){
        const a=Math.min(.34,VY[i]*2.2+VOL[i]*.08);X.strokeStyle=`rgba(120,205,210,${a})`;X.lineWidth=Math.max(.7,CELL*z*.25);X.beginPath();X.moveTo(p.x,p.y);X.lineTo(p.x+VX[i]*14*z,p.y+CELL*z*(1.2+VY[i]*4));X.stroke();
      }
      if(SRC[i]>55&&VOL[i]>.04){X.fillStyle=`rgba(102,226,210,${Math.min(.28,SRC[i]/900)})`;X.beginPath();X.arc(p.x,p.y,Math.max(1,CELL*z*.55),0,TAU);X.fill();}
      if(VAPOR[i]>.02){const r=(2+VAPOR[i]*5)*z;X.fillStyle=`rgba(193,220,215,${Math.min(.16,VAPOR[i]*.12)})`;X.beginPath();X.arc(p.x+Math.sin(t*.002+i)*r,p.y-r,r,0,TAU);X.fill();}
      const sed=LOAD[i];if(sed>.08&&VOL[i]>.08){X.fillStyle=`rgba(118,92,55,${Math.min(.13,sed*.08)})`;X.beginPath();X.ellipse(p.x,p.y+CELL*z*.2,CELL*z*.45,CELL*z*.18,0,0,TAU);X.fill();}
    }
  }

  function drawSurfaceWetness(){
    if(typeof v104VisibleMicroBounds!=='function')return;
    const b=v104VisibleMicroBounds(2),z=camera.zoom;
    for(let y=b.t;y<=b.b;y+=3)for(let x=b.l;x<=b.r;x+=3){
      const i=I(x,y),m=V104_M[i];if(!solid(m)||!(!solid(v104Get(x,y-1))))continue;
      const w=Math.max(WET[i],F.saturation?.[i]||0);if(w<.42)continue;
      const p=worldToScreen((x+.5)*CELL,y*CELL);
      X.strokeStyle=`rgba(164,225,211,${Math.min(.16,(w-.4)*.18)})`;X.lineWidth=Math.max(.6,CELL*z*.14);X.beginPath();X.moveTo(p.x-CELL*z*.45,p.y);X.lineTo(p.x+CELL*z*.45,p.y);X.stroke();
    }
  }

  function init(){
    surfaceScan();seedWaterFromMaterials();acceleratedSettling();
    window.GENESIS_V110={
      version:'110.0',name:'FULL WORLD PHYSICS',
      invariant:'matter + forces are authoritative; visuals are read-only',
      fields:{volume:VOL,velocityX:VX,velocityY:VY,sediment:LOAD,vapor:VAPOR,stress:STRESS,wetness:WET,flux:FLUX,springs:SRC,bed:BED},
      metrics,
      depthAtWorld:V109.depthAtWorld,
      active:['accelerated-geology','water-volume-pressure','groundwater-springs','erosion-transport-deposition','thermal-vapor','depth-derived-2.5d','physical-telemetry']
    };
  }

  init();

  const STEP=step;step=function(){STEP();stepWorld();};
  const RESET=reset;reset=function(){RESET();seedWaterFromMaterials();acceleratedSettling();};
  const BG=drawBackground;drawBackground=function(t){BG(t);drawDepthGeology(t);};
  const TERR=drawTerrain;drawTerrain=function(t){TERR(t);drawSurfaceWetness();drawWaterPhysics(t);};
  const UI=updateUI;updateUI=function(){UI();if(!stats)return;const m=metrics();stats.innerHTML+=`<br><span class="dim">V110 water ${m.waterMass.toFixed(0)} · sed ${m.sedimentMass.toFixed(1)} · spring ${m.springs} · erode ${m.eroded}/${m.deposited}</span>`;};
})();
