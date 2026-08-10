'use strict';
/* GENESIS old-sim improvement layer.
   Scope: restore the ecosystem sandbox as the main experience and improve
   jaw placement, biome readability, depth, wet-material response, camera feel,
   and observer telemetry. Presentation additions are not claimed as physics. */
(function(){
  if(typeof drawBackground!=='function'||typeof drawTerrain!=='function'||typeof drawCreature!=='function')return;

  const U=window.GENESIS_OLD_SIM_UPGRADE={
    status:'experimental',
    scope:'old ecosystem sandbox presentation + jaw geometry correction',
    simulationChanges:['jaw/tongue node re-anchoring by morphology','local wetness visual state cached from material world'],
    presentationOnly:['parallax canopy','fog shafts','surface micro-detail','foreground occlusion','HUD biome card']
  };

  const MATS=typeof V104_MAT!=='undefined'?V104_MAT:{AIR:0,ROCK:1,DIRT:2,SAND:3,WATER:4,LAVA:5,MUD:6,OBSIDIAN:7,ASH:8};
  const clamp01=v=>Math.max(0,Math.min(1,v));
  const h=(n,s=0)=>typeof hash==='function'?hash((n|0)+(s|0)*911):((Math.sin(n*12.9898+s*78.233)*43758.5453)%1+1)%1;

  function localMaterialProfile(wx,wy){
    if(typeof v104CellAtWorld!=='function'||typeof v104Get!=='function')return{name:'MOSS BASIN',water:0,mud:0,rock:0,sand:0,lava:0,ash:0,organic:0,heat:0,wet:0};
    const c=v104CellAtWorld(wx,wy),count={water:0,mud:0,rock:0,sand:0,lava:0,ash:0,obs:0,dirt:0},r=7;
    let organic=0,heat=0,wet=0,n=0;
    for(let y=c.y-r;y<=c.y+r;y+=2)for(let x=c.x-r;x<=c.x+r;x+=2){
      if(typeof v104In==='function'&&!v104In(x,y))continue;
      const m=v104Get(x,y),i=(typeof v104Idx==='function'&&typeof V104_COLS!=='undefined')?v104Idx(x,y):-1;
      if(m===MATS.WATER)count.water++;else if(m===MATS.MUD)count.mud++;else if(m===MATS.ROCK)count.rock++;else if(m===MATS.SAND)count.sand++;else if(m===MATS.LAVA)count.lava++;else if(m===MATS.ASH)count.ash++;else if(m===MATS.OBSIDIAN)count.obs++;else if(m===MATS.DIRT)count.dirt++;
      if(i>=0&&window.GENESIS_V109?.fields){organic+=GENESIS_V109.fields.organic?.[i]||0;wet+=GENESIS_V109.fields.saturation?.[i]||0;}
      if(i>=0&&typeof V105_HEAT!=='undefined')heat+=V105_HEAT[i]||0;
      n++;
    }
    const q=k=>count[k]/Math.max(1,n);organic/=Math.max(1,n);wet/=Math.max(1,n);heat/=Math.max(1,n);
    let name='MOSS BASIN';
    if(q('lava')+q('obs')>.08||heat>72)name='OBSIDIAN FURNACE';
    else if(q('water')+q('mud')>.22)name='FLOODED MIRE';
    else if(q('ash')>.11)name='ASH FEN';
    else if(q('sand')>.20)name='GLASS DUNES';
    else if(organic>.10&&wet>.28)name='FUNGAL WETLAND';
    else if(q('rock')>.48)name='ROOTED CLIFFS';
    else if(wet>.42)name='RAIN BASIN';
    return{name,water:q('water'),mud:q('mud'),rock:q('rock'),sand:q('sand'),lava:q('lava'),ash:q('ash'),organic,heat,wet};
  }

  function reanchorMouth(c){
    const a=c?.v107;if(!a||!c.alive&&c.gone)return;
    const head=c.head?.();if(!head)return;
    const s=(c.g?.size||1),f=c.face||1,g=clamp01(a.gape||0),fam=c.spec?.family||'';
    let jx,jy,tx,ty;
    if(fam==='crab'){
      jx=head.x+f*(1.5+g*1.2)*s; jy=head.y+(5.6+g*3.4)*s;
      tx=head.x+f*(2.7+g*3.0)*s; ty=head.y+(5.0+g*1.4)*s;
    }else if(fam==='bug'){
      jx=head.x+f*(4.8+g*2.0)*s; jy=head.y+(3.8+g*4.2)*s;
      tx=head.x+f*(5.4+g*4.5)*s; ty=head.y+(3.4+g*1.8)*s;
    }else if(fam==='melt'){
      jx=head.x+f*(3.2+g*1.5)*s; jy=head.y+(4.8+g*3.0)*s;
      tx=head.x+f*(4.3+g*5.0)*s; ty=head.y+(4.6+g*1.0)*s;
    }else{
      jx=head.x+f*(5.0+g*1.6)*s; jy=head.y+(4.6+g*4.0)*s;
      tx=head.x+f*(5.8+g*5.2)*s; ty=head.y+(4.0+g*1.8)*s;
    }
    a.jaw.x=lerp(a.jaw.x,jx,.62); a.jaw.y=lerp(a.jaw.y,jy,.62);
    a.tongue.x=lerp(a.tongue.x,tx,.58); a.tongue.y=lerp(a.tongue.y,ty,.58);
  }

  const STEP_CREATURE=stepCreature;
  stepCreature=function(c){
    STEP_CREATURE(c);
    reanchorMouth(c);
    if(c&&!c.gone){const q=c.center();const p=localMaterialProfile(q.x,q.y);c._oldSimWet=lerp(c._oldSimWet||0,p.wet,.08);c._oldSimBiome=p.name;}
  };

  function drawCanopy(t){
    X.save();
    for(let layer=0;layer<4;layer++){
      const par=.012+layer*.020,alpha=.17+layer*.07,base=SH*(.22+layer*.09),scale=.8+layer*.32;
      X.fillStyle=`rgba(${3+layer*2},${15+layer*5},${12+layer*3},${alpha})`;
      for(let k=-2;k<15;k++){
        const sx=((k*118-camera.x*par)%(SW+260)+SW+260)%(SW+260)-130;
        const trunk=10+22*h(k+layer*53,31),lean=(h(k,77)-.5)*38;
        X.beginPath();X.moveTo(sx-trunk*.45,-30);X.bezierCurveTo(sx+lean,SH*.18,sx-lean*.35,SH*.48,sx+trunk*.2,SH*.86);X.lineTo(sx+trunk,SH*.86);X.bezierCurveTo(sx+lean+trunk,SH*.48,sx+lean*.4,SH*.17,sx+trunk*.45,-30);X.closePath();X.fill();
        const crownY=base+(h(k,13)-.5)*70,rr=(32+60*h(k,91))*scale;
        for(let j=0;j<5;j++){const a=j/5*TAU+h(k,j)*.6;X.beginPath();X.ellipse(sx+Math.cos(a)*rr*.5,crownY+Math.sin(a)*rr*.22,rr*.65,rr*.20,a*.2,0,TAU);X.fill();}
      }
    }
    const mist=X.createLinearGradient(0,SH*.18,0,SH*.72);mist.addColorStop(0,'rgba(101,173,145,.015)');mist.addColorStop(.5,'rgba(102,164,145,.055)');mist.addColorStop(1,'rgba(4,18,15,0)');X.fillStyle=mist;X.fillRect(0,0,SW,SH);
    X.restore();
  }

  function drawLightShafts(t){
    X.save();X.globalCompositeOperation='screen';
    for(let i=0;i<5;i++){
      const x=((h(i,210)*SW+camera.x*.009+i*73)%(SW+180))-90,w=35+70*h(i,211),pulse=.02+.018*(.5+.5*Math.sin(t*.0007+i));
      const g=X.createLinearGradient(x,0,x+w,SH);g.addColorStop(0,`rgba(151,225,190,${pulse})`);g.addColorStop(.7,'rgba(80,161,138,.012)');g.addColorStop(1,'rgba(0,0,0,0)');X.fillStyle=g;X.beginPath();X.moveTo(x,0);X.lineTo(x+w*.42,0);X.lineTo(x+w,SH*.74);X.lineTo(x+w*.15,SH*.74);X.closePath();X.fill();
    }
    X.restore();
  }

  const BG=drawBackground;
  drawBackground=function(t){BG(t);drawCanopy(t);drawLightShafts(t);};

  function drawMaterialSurface(t){
    if(typeof v104VisibleMicroBounds!=='function'||typeof v104Get!=='function')return;
    const b=v104VisibleMicroBounds(1),step=Math.max(2,Math.floor(5/Math.max(.7,camera.zoom)));
    X.save();
    for(let x=b.l;x<=b.r;x+=step){
      let sy=-1,m=0;
      for(let y=b.t;y<=b.b;y++){const mm=v104Get(x,y);if(typeof v104SolidMat==='function'&&v104SolidMat(mm)&&!v104SolidMat(v104Get(x,y-1))){sy=y;m=mm;break}}
      if(sy<0)continue;
      const p=worldToScreen((x+.5)*V104_CELL,sy*V104_CELL),seedv=h(x,sy),z=camera.zoom;
      if(m===MATS.DIRT||m===MATS.MUD){
        X.strokeStyle=`rgba(115,153,99,${.13+.12*seedv})`;X.lineWidth=Math.max(.6,z*.8);const count=1+Math.floor(seedv*3);for(let j=0;j<count;j++){const off=(h(x,j)-.5)*V104_CELL*step*z*.7,hh=(3+10*h(x,j+8))*z;X.beginPath();X.moveTo(p.x+off,p.y);X.quadraticCurveTo(p.x+off+Math.sin(t*.001+x+j)*2*z,p.y-hh*.55,p.x+off+(h(x,j+19)-.5)*4*z,p.y-hh);X.stroke();}
      }
      if(m===MATS.ROCK||m===MATS.OBSIDIAN){X.fillStyle=`rgba(212,242,229,${.018+.035*seedv})`;X.beginPath();X.ellipse(p.x,p.y+1*z,4*z,1*z,0,0,TAU);X.fill();}
      if(m===MATS.SAND||m===MATS.ASH){X.fillStyle=`rgba(221,213,177,${.035+.04*seedv})`;X.fillRect(p.x-3*z,p.y,6*z,Math.max(.5,z*.6));}
    }
    X.restore();
  }

  const TERR=drawTerrain;
  drawTerrain=function(t){TERR(t);drawMaterialSurface(t);};

  function drawPlantDetail(p,t){
    if(!p?.alive)return;const s=worldToScreen(p.x,p.y),z=camera.zoom;if(s.x<-80||s.x>SW+80||s.y<-120||s.y>SH+80)return;
    const phase=p.phase||h(Math.floor(p.x),42)*TAU,wetness=(p.moisture??p.water??.4),sway=Math.sin(t*.0014+phase)*(2+5*(weather?.rain||0))*z;
    X.save();
    const baseH=(p.height||18)*z,leafN=3+Math.floor(h(Math.floor(p.x),33)*4);
    X.strokeStyle=`rgba(103,145,92,${.28+.35*clamp01(wetness)})`;X.lineWidth=Math.max(.7,1.2*z);X.beginPath();X.moveTo(s.x,s.y);X.quadraticCurveTo(s.x+sway*.2,s.y-baseH*.55,s.x+sway,s.y-baseH);X.stroke();
    for(let i=0;i<leafN;i++){const u=(i+1)/(leafN+1),yy=s.y-baseH*u,side=i%2?-1:1,len=(5+8*h(i,Math.floor(p.x)))*z;X.fillStyle=`rgba(${70+Math.floor(40*h(i,4))},${120+Math.floor(55*h(i,5))},${75+Math.floor(35*h(i,6))},.28)`;X.beginPath();X.ellipse(s.x+sway*u+side*len*.45,yy,len,len*.28,side*.35,0,TAU);X.fill();}
    if((p.bloom||0)>.55){X.globalCompositeOperation='screen';const r=(8+8*(p.bloom||0))*z,g=X.createRadialGradient(s.x+sway,s.y-baseH,0,s.x+sway,s.y-baseH,r*2.5);g.addColorStop(0,'rgba(170,236,116,.22)');g.addColorStop(1,'rgba(0,0,0,0)');X.fillStyle=g;X.fillRect(s.x-r*2.5,s.y-baseH-r*2.5,r*5,r*5);}
    X.restore();
  }
  const PLANTS=drawPlants;
  drawPlants=function(t){PLANTS(t);for(const p of plants)drawPlantDetail(p,t);};

  function drawCreatureFinish(c,t){
    if(c.gone)return;const head=c.head?.();if(!head)return;const H=worldToScreen(head.x,head.y),z=camera.zoom,s=(c.g?.size||1)*z,f=c.face||1,fam=c.spec?.family||'';
    X.save();
    X.fillStyle=c.alive?(c.spec?.color||'#708070'):'#4b4b46';X.beginPath();X.ellipse(H.x+f*3.5*s,H.y+2.2*s,5.6*s,4.1*s,0,0,TAU);X.fill();
    const wet=clamp01(c._oldSimWet||0);if(wet>.08){X.globalCompositeOperation='screen';X.fillStyle=`rgba(205,244,232,${.035+wet*.10})`;X.beginPath();X.ellipse(H.x-f*1.5*s,H.y-3*s,4.8*s,1.6*s,-.18*f,0,TAU);X.fill();X.globalCompositeOperation='source-over';}
    const mx=H.x+f*(fam==='crab'?2.2:fam==='bug'?6.4:6.1)*s,my=H.y+(fam==='crab'?5.1:4.2)*s,gape=clamp01(c.v107?.gape||0);
    X.fillStyle=c.alive?'#170b0d':'#171515';X.beginPath();X.ellipse(mx,my,(2.6+gape*2.5)*s,(1.1+gape*2.0)*s,.12*f,0,TAU);X.fill();
    X.strokeStyle='#d9cdb7';X.lineWidth=Math.max(.6,.7*z);const teeth=fam==='melt'?0:(fam==='crab'?4:3);for(let i=0;i<teeth;i++){const u=(i-(teeth-1)*.5)*1.25*s;X.beginPath();X.moveTo(mx+u*f,my-1.0*s);X.lineTo(mx+(u+.6*s)*f,my+.5*s);X.stroke();}
    if(fam==='bug'||fam==='crab'){
      X.strokeStyle=c.spec?.hi||'#b8c6a8';X.lineWidth=Math.max(.7,1.0*z);for(const side of[-1,1]){X.beginPath();X.moveTo(mx,my+side*.4*s);X.lineTo(mx+f*(3.2+gape*2)*s,my+side*(2.0+gape)*s);X.stroke();}
    }
    const eyeY=H.y-2.2*s,eyeX=H.x+f*4.4*s;X.fillStyle='#e7e3bd';X.beginPath();X.ellipse(eyeX,eyeY,1.7*s,1.25*s,0,0,TAU);X.fill();X.fillStyle='#07100c';X.beginPath();X.arc(eyeX+f*.7*s,eyeY,.72*s,0,TAU);X.fill();
    X.restore();
  }

  const CREATURE=drawCreature;
  drawCreature=function(c,t){CREATURE(c,t);drawCreatureFinish(c,t);};

  function drawForeground(t){
    X.save();
    const y0=SH*.84;for(let i=0;i<14;i++){
      const x=((h(i,650)*SW-camera.x*.025+i*67)%(SW+160)+SW+160)%(SW+160)-80,hh=(35+95*h(i,652)),ww=(8+18*h(i,653));
      X.fillStyle=`rgba(2,11,9,${.25+.35*h(i,651)})`;X.beginPath();X.moveTo(x,y0+80);X.quadraticCurveTo(x-ww,y0-hh*.5,x+ww*.2,y0-hh);X.quadraticCurveTo(x+ww*1.6,y0-hh*.35,x+ww,y0+80);X.closePath();X.fill();
    }
    const vign=X.createRadialGradient(SW*.5,SH*.44,Math.min(SW,SH)*.22,SW*.5,SH*.45,Math.max(SW,SH)*.72);vign.addColorStop(0,'rgba(0,0,0,0)');vign.addColorStop(.74,'rgba(0,6,5,.10)');vign.addColorStop(1,'rgba(0,0,0,.42)');X.fillStyle=vign;X.fillRect(0,0,SW,SH);
    X.restore();
  }

  function ensureHUD(){
    let e=document.getElementById('oldSimTop');if(e)return e;
    e=document.createElement('div');e.id='oldSimTop';e.innerHTML='<div><b id="oldSimBiome">WILD</b><span id="oldSimWeather">—</span></div><div><span id="oldSimPop">0 life</span><span id="oldSimFocus">tap a creature</span></div>';document.body.appendChild(e);return e;
  }
  ensureHUD();

  function updateUpgradeHUD(){
    ensureHUD();const focus=selected&&!selected.gone?selected:null,q=focus?focus.center():{x:camera.x,y:camera.y},p=localMaterialProfile(q.x,q.y);
    const alive=creatures.filter(c=>c.alive&&!c.gone).length;
    document.getElementById('oldSimBiome').textContent=p.name;
    document.getElementById('oldSimWeather').textContent=(weather?.rain||0)>.65?'HEAVY RAIN':(weather?.rain||0)>.25?'RAIN':'MIST';
    document.getElementById('oldSimPop').textContent=`${alive} ACTIVE LIFE`;
    document.getElementById('oldSimFocus').textContent=focus?`${focus.spec.name} · ${String(focus.state||'ROAM').replaceAll('_',' ')}`:'TAP A CREATURE';
  }

  const RENDER=render;
  render=function(t){RENDER(t);drawForeground(t);updateUpgradeHUD();};

  const FRAME_FOLLOW=.085;
  const BASE_UPDATE_UI=updateUI;
  updateUI=function(){BASE_UPDATE_UI();if(selected&&!selected.gone&&camera.follow){const q=selected.center();camera.x=lerp(camera.x,q.x,FRAME_FOLLOW);camera.y=lerp(camera.y,q.y,FRAME_FOLLOW);}updateUpgradeHUD();};
})();
