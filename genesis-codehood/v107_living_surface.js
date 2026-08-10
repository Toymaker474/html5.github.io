'use strict';
/* GENESIS V107 — LIVING SURFACE
   Dynamic plant rigs, deforming soft-ground marks, micro-splashes, fungal pulses,
   and force-reactive creature overlays. Loaded after V106. */
(function(){
  const V107_FOOT=[],V107_SEEDS=[],V107_SPLASH=[];
  const V107_BANK=new Uint8Array(COLS*ROWS),V107_BANK_CELLS=[];
  for(let x=1;x<COLS-1;x++){const cy=clamp(Math.floor((surfaceY[x]||((ROWS-5)*TILE))/TILE),1,ROWS-2),i=tidx(x,cy),n=hash(x*917+37)>.28?1+(hash(x*401+9)>.78?1:0):0;V107_BANK[i]=n;if(n)V107_BANK_CELLS.push(i);}
  const V107_MAX_FOOT=180,V107_MAX_SPLASH=220,V107_MAX_SEEDS=80;

  function v107WindAt(x,y,t=simTick){
    const gust=Math.sin(t*.018+x*.003)+.55*Math.sin(t*.006+y*.005+2.1);
    return gust*(.035+.16*(weather?.rain||0));
  }
  function v107Node(x,y){return{x,y,px:x,py:y};}
  function v107RigPlant(p){
    if(p.v107Rig)return p.v107Rig;
    const kind=p.kind||'reed',n=kind==='vine'?8:kind==='fern'?6:kind==='mushroom'?4:5;
    const h=Math.max(10,p.height||16),seg=h/Math.max(1,n-1),nodes=[];
    for(let i=0;i<n;i++)nodes.push(v107Node(p.x,p.y-i*seg));
    p.v107Rig={nodes,seg,kind,phase:rnd()*TAU,damage:0,lastRootX:p.x,lastRootY:p.y};
    return p.v107Rig;
  }
  function v107Constrain(a,b,len,k=.82){
    const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,e=(d-len)/d*k;
    if(a.fixed){b.x-=dx*e;b.y-=dy*e;return;}
    a.x+=dx*e*.5;a.y+=dy*e*.5;b.x-=dx*e*.5;b.y-=dy*e*.5;
  }
  function v107PushPlantNode(n,r=6){
    for(const c of creatures){
      if(!c.alive||c.gone)continue;
      const q=c.center();if(Math.abs(q.x-n.x)>60||Math.abs(q.y-n.y)>70)continue;
      for(const b of c.nodes){
        const dx=n.x-b.x,dy=n.y-b.y,d=Math.hypot(dx,dy),rr=r+b.r*.85;
        if(d>0&&d<rr){const push=(rr-d)/d*.68;n.x+=dx*push;n.y+=dy*push;}
      }
    }
  }
  function v107StepPlantRig(p){
    if(!p.alive)return;
    const r=v107RigPlant(p),a=r.nodes;
    a[0].x=p.x;a[0].y=p.y;a[0].px=p.x;a[0].py=p.y;a[0].fixed=true;
    const wind=v107WindAt(p.x,p.y);
    for(let i=1;i<a.length;i++){
      const n=a[i],vx=(n.x-n.px)*.965,vy=(n.y-n.py)*.965;n.px=n.x;n.py=n.y;
      const taper=i/(a.length-1);n.x+=vx+wind*(.55+taper*1.7);n.y+=vy+.012*taper;
      if((weather?.rain||0)>.45)n.x-=weather.rain*.008*(1+taper);
      v107PushPlantNode(n,3+(p.radius||4)*.5);
    }
    for(let it=0;it<4;it++)for(let i=0;i<a.length-1;i++)v107Constrain(a[i],a[i+1],r.seg,i===0?.96:.82);
    if(p.ecoWound>0||p.hp<10){r.damage=Math.min(1,r.damage+.01);const tip=a[a.length-1];tip.px+=Math.sin(simTick*.17+r.phase)*.08;}
    else r.damage=Math.max(0,r.damage-.0015);
  }

  function v107MaterialAt(x,y){
    if(typeof v104CellAtWorld!=='function'||typeof v104Get!=='function')return 0;
    const c=v104CellAtWorld(x,y);return v104Get(c.x,c.y);
  }
  function v107SoftMat(m){return typeof V104_MAT!=='undefined'&&(m===V104_MAT.SAND||m===V104_MAT.MUD||m===V104_MAT.ASH||m===V104_MAT.DIRT);}
  function v107AddFoot(x,y,r,mat,energy){
    if(V107_FOOT.length>=V107_MAX_FOOT)V107_FOOT.shift();
    V107_FOOT.push({x,y,r,mat,energy,life:1100,phase:rnd()*TAU});
  }
  function v107AddSplash(x,y,vx,vy,kind){
    if(V107_SPLASH.length>=V107_MAX_SPLASH)V107_SPLASH.shift();
    V107_SPLASH.push({x,y,px:x-vx,py:y-vy,life:50+Math.floor(rnd()*70),kind,r:1+rnd()*2.5});
  }
  function v107CreatureSurfaceEffects(){
    for(const c of creatures){
      if(!c.alive||c.gone)continue;
      const sp=Math.max(.05,c.speed?.()||0),heavy=clamp(c.g.size*.7+sp*.35,.5,2.2);
      if(simTick%7===c.id%7){
        for(const n of c.nodes){
          if(n.contact<=0)continue;const mat=v107MaterialAt(n.x,n.y+n.r*.8);
          if(v107SoftMat(mat))v107AddFoot(n.x,n.y+n.r*.78,clamp(n.r*1.25,4,14),mat,heavy);
          if(typeof V104_MAT!=='undefined'&&mat===V104_MAT.WATER){const v=velocity(n);for(let k=0;k<2;k++)v107AddSplash(n.x,n.y,(rnd()-.5)*1.2+v.x*.25,-.6-rnd()*.8,'water');}
          if(typeof V104_MAT!=='undefined'&&mat===V104_MAT.LAVA&&rnd()<.35){for(let k=0;k<2;k++)v107AddSplash(n.x,n.y,(rnd()-.5)*1.4,-.8-rnd()*1.2,'lava');}
        }
      }
      if(c.spec.family==='melt'&&rnd()<.018){const q=c.center();v107AddSplash(q.x+(rnd()-.5)*12,q.y+8,(rnd()-.5)*.3,.08,'slime');}
    }
  }
  function v107StepMarks(){
    for(let i=V107_FOOT.length-1;i>=0;i--){const f=V107_FOOT[i];f.life--;f.energy*=.9994;if(f.life<=0)V107_FOOT.splice(i,1);}
    for(let i=V107_SPLASH.length-1;i>=0;i--){const p=V107_SPLASH[i],vx=(p.x-p.px)*.975,vy=(p.y-p.py)*.975;p.px=p.x;p.py=p.y;p.x+=vx;p.y+=vy+.055;p.life--;if(isSolidAt(p.x,p.y)){p.life-=8;p.py=p.y+Math.abs(vy)*.35;}if(p.life<=0)V107_SPLASH.splice(i,1);}
    for(let i=V107_SEEDS.length-1;i>=0;i--){const s=V107_SEEDS[i];s.life--;s.vx=(s.vx+v107WindAt(s.x,s.y)*.18)*.992;s.vy=(s.vy+.018)*.994;s.x+=s.vx;s.y+=s.vy;if(isSolidAt(s.x,s.y+2)){if(s.life>100&&rnd()<.25){const surf=typeof v104SurfaceAtWorldX==='function'?v104SurfaceAtWorldX(s.x,s.y):null;if(surf)spawnPlant(surf.x,surf.y-1);}V107_SEEDS.splice(i,1);continue;}if(s.life<=0)V107_SEEDS.splice(i,1);}
  }
  function v107SeedShed(){
    if(simTick%25)return;
    for(const p of plants){if(!p.alive||!p.kind||(p.bloom||0)<.8||V107_SEEDS.length>=V107_MAX_SEEDS)continue;if(rnd()>.08)continue;const r=v107RigPlant(p),tip=r.nodes[r.nodes.length-1];V107_SEEDS.push({x:tip.x,y:tip.y,vx:(rnd()-.5)*.45,vy:-.12-rnd()*.18,life:500+Math.floor(rnd()*500),kind:p.kind});}
  }

  function v107PlantTransitions(){
    for(const p of plants){
      const cx=clamp(Math.floor(p.x/TILE),0,COLS-1),cy=clamp(Math.floor(p.y/TILE),0,ROWS-1),i=tidx(cx,cy);
      if(p.v107WasAlive===undefined)p.v107WasAlive=!!p.alive;
      if(p.v107WasAlive&&!p.alive){
        const n=1+Math.floor(rnd()*3);
        for(let k=0;k<n;k++){const dx=(rnd()*3|0)-1,ii=tidx(clamp(cx+dx,0,COLS-1),cy);if(!V107_BANK[ii])V107_BANK_CELLS.push(ii);V107_BANK[ii]=Math.min(12,V107_BANK[ii]+1);}
      }
      p.v107WasAlive=!!p.alive;
    }
    const living=plants.filter(p=>p.alive).length;if(simTick%45!==0||living>95)return;
    const tries=living<25?90:living<50?55:28;
    for(let k=0;k<tries;k++){
      if(!V107_BANK_CELLS.length)break;const i=V107_BANK_CELLS[(rnd()*V107_BANK_CELLS.length)|0];if(!V107_BANK[i])continue;
      const cx=i%COLS,cy=(i/COLS)|0,moist=(typeof ECO_W!=='undefined'?ECO_W[i]:0)+(wet[i]||0)*.5,nutr=(typeof ECO_N!=='undefined'?ECO_N[i]:0)+(typeof ECO_D!=='undefined'?ECO_D[i]*.3:0);
      const score=moist+nutr*.6;if(score<.025||rnd()>(living<25?.55:.28))continue;
      const x=(cx+.5)*TILE,surf=typeof v104SurfaceAtWorldX==='function'?v104SurfaceAtWorldX(x,cy*TILE):null;
      if(!surf)continue;
      if(plants.some(p=>p.alive&&Math.abs(p.x-surf.x)<22&&Math.abs(p.y-surf.y)<25))continue;
      spawnPlant(surf.x,surf.y-1);V107_BANK[i]--;
    }
  }

  const V107_stepBase=step;
  step=function(){
    V107_stepBase();
    v107PlantTransitions();
    for(const p of plants)v107StepPlantRig(p);
    v107CreatureSurfaceEffects();v107SeedShed();v107StepMarks();
  };

  function v107Screen(p){return worldToScreen(p.x,p.y);}
  function v107DrawLeaf(x,y,ang,len,w,col,alpha=1){X.save();X.translate(x,y);X.rotate(ang);X.globalAlpha=alpha;X.fillStyle=col;X.beginPath();X.ellipse(len*.36,0,len*.55,w*.55,0,0,TAU);X.fill();X.restore();X.globalAlpha=1;}
  function v107DrawPlant(p,t){
    if(!p.alive)return;const r=v107RigPlant(p),a=r.nodes,pts=a.map(v107Screen),z=camera.zoom;if(!pts.length)return;
    const root=pts[0];if(root.x<-90||root.x>SW+90||root.y<-100||root.y>SH+100)return;
    const stem=p.colorStem||'#587252',leaf=p.colorLeaf||'#8aaa70',flower=p.colorFlower||'#d8d19a';
    X.lineCap='round';X.lineJoin='round';
    X.strokeStyle='rgba(0,0,0,.24)';X.lineWidth=Math.max(2,3.3*z);X.beginPath();X.moveTo(pts[0].x+1.5*z,pts[0].y+2*z);for(let i=1;i<pts.length;i++)X.lineTo(pts[i].x+1.5*z,pts[i].y+2*z);X.stroke();
    X.strokeStyle=stem;X.lineWidth=Math.max(1,1.75*z*(1-r.damage*.45));X.beginPath();X.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++)X.quadraticCurveTo(pts[i-1].x,pts[i-1].y,(pts[i-1].x+pts[i].x)*.5,(pts[i-1].y+pts[i].y)*.5);X.lineTo(pts[pts.length-1].x,pts[pts.length-1].y);X.stroke();
    if(p.kind==='mushroom'){
      const tip=pts[pts.length-1],w=(p.radius||6)*z;X.fillStyle=leaf;X.beginPath();X.ellipse(tip.x,tip.y,w*1.4,w*.72,Math.sin(t*.001+r.phase)*.08,0,TAU);X.fill();X.fillStyle='rgba(245,245,230,.12)';X.beginPath();X.ellipse(tip.x-w*.3,tip.y-w*.18,w*.55,w*.18,-.2,0,TAU);X.fill();
    }else{
      for(let i=1;i<pts.length;i++){if((i+(p.kind==='vine'?0:1))%2)continue;const A=pts[i-1],B=pts[i],ang=Math.atan2(B.y-A.y,B.x-A.x),side=i%4<2?-1:1,len=(5+(p.radius||4)*1.2+i*.45)*z;v107DrawLeaf(B.x,B.y,ang+side*(1.0+.13*Math.sin(t*.003+r.phase+i)),len,3.1*z,leaf,.88-r.damage*.25);}
      if(p.kind==='pitcher'){
        const tip=pts[pts.length-1],w=(p.radius||5)*z;X.fillStyle=leaf;X.beginPath();X.ellipse(tip.x,tip.y+w*.6,w*.8,w*1.45,.15,0,TAU);X.fill();X.fillStyle='rgba(35,23,18,.8)';X.beginPath();X.ellipse(tip.x,tip.y-w*.25,w*.55,w*.22,0,0,TAU);X.fill();
      }
    }
    if((p.bloom||0)>.72){const tip=pts[pts.length-1],rr=(1.5+(p.bloom||0)*1.6)*z;X.fillStyle=flower;for(let k=0;k<5;k++){const a=k/5*TAU+t*.00025;X.beginPath();X.ellipse(tip.x+Math.cos(a)*rr*.9,tip.y+Math.sin(a)*rr*.6,rr*.7,rr*.38,a,0,TAU);X.fill();}X.fillStyle='#e9d78c';X.beginPath();X.arc(tip.x,tip.y,rr*.45,0,TAU);X.fill();}
  }
  const V107_drawPlantsBase=drawPlants;
  drawPlants=function(t){for(const p of plants){if(p.kind)v107DrawPlant(p,t);else{V107_drawPlantsBase(t);break;}}for(const s of V107_SEEDS){const q=worldToScreen(s.x,s.y);X.fillStyle='rgba(222,214,164,.72)';X.beginPath();X.arc(q.x,q.y,1.1*camera.zoom,0,TAU);X.fill();}};

  const V107_drawTerrainBase=drawTerrain;
  drawTerrain=function(t){
    V107_drawTerrainBase(t);
    for(const f of V107_FOOT){const s=worldToScreen(f.x,f.y),r=f.r*camera.zoom;if(s.x<-40||s.x>SW+40||s.y<-40||s.y>SH+40)continue;let col='rgba(25,20,16,.18)';if(typeof V104_MAT!=='undefined'){if(f.mat===V104_MAT.SAND)col='rgba(85,67,37,.18)';else if(f.mat===V104_MAT.MUD)col='rgba(13,20,18,.28)';else if(f.mat===V104_MAT.ASH)col='rgba(20,20,20,.22)';}X.fillStyle=col;X.beginPath();X.ellipse(s.x,s.y,r*(.65+.15*f.energy),r*.28,Math.sin(f.phase)*.3,0,TAU);X.fill();X.strokeStyle='rgba(230,235,220,.035)';X.lineWidth=Math.max(.5,.6*camera.zoom);X.stroke();}
    if(typeof ECO_F!=='undefined'&&typeof v104VisibleMicroBounds==='function'&&typeof V104_SCALE!=='undefined'){
      const b=v104VisibleMicroBounds(0);for(let my=b.t;my<=b.b;my+=8)for(let mx=b.l;mx<=b.r;mx+=8){const cx=clamp((mx/V104_SCALE)|0,0,COLS-1),cy=clamp((my/V104_SCALE)|0,0,ROWS-1),i=tidx(cx,cy),f=ECO_F[i]||0;if(f<.18||hash(i+simTick/90)<.76)continue;const wx=(mx+.5)*V104_CELL,wy=(my+.2)*V104_CELL,s=worldToScreen(wx,wy),rr=(1.2+f*2.4)*camera.zoom;X.fillStyle=`rgba(165,190,158,${Math.min(.22,.06+f*.08)})`;X.beginPath();X.ellipse(s.x,s.y,rr,rr*.55,0,0,TAU);X.fill();}
    }
  };

  const V107_drawCreatureBase=drawCreature;
  function v107CreatureOverlay(c,t){
    if(!c.alive||c.gone)return;const z=camera.zoom,q=c.center(),s=worldToScreen(q.x,q.y);if(s.x<-160||s.x>SW+160||s.y<-160||s.y>SH+160)return;
    const breath=.5+.5*Math.sin(t*.0022+c.id*.73),spd=clamp(c.speed?.()||0,0,3),alpha=.06+.06*breath;
    for(let i=0;i<c.nodes.length-1;i++){const a=worldToScreen(c.nodes[i].x,c.nodes[i].y),b=worldToScreen(c.nodes[i+1].x,c.nodes[i+1].y),ra=c.nodes[i].r*z,rb=c.nodes[i+1].r*z;X.strokeStyle=`rgba(238,246,232,${alpha})`;X.lineWidth=Math.max(1,(ra+rb)*.18);X.lineCap='round';X.beginPath();X.moveTo(a.x,a.y-ra*.2);X.lineTo(b.x,b.y-rb*.2);X.stroke();}
    if(c.spec.family==='crab'){
      for(const l of c.limbs){if(l.disabled)continue;const a=worldToScreen(c.nodes[l.anchor].x,c.nodes[l.anchor].y),h=worldToScreen(l.hand.x,l.hand.y),mx=(a.x+h.x)*.5,my=(a.y+h.y)*.5;X.strokeStyle='rgba(220,235,215,.18)';X.lineWidth=Math.max(.6,1.1*z);X.beginPath();X.moveTo(a.x,a.y);X.lineTo(mx+(l.side||1)*5*z,my);X.lineTo(h.x,h.y);X.stroke();}}
    if(c.spec.family==='bug'){
      const h=worldToScreen(c.head().x,c.head().y),r=c.head().r*z;X.strokeStyle='rgba(205,235,215,.25)';X.lineWidth=Math.max(.5,.8*z);X.beginPath();X.moveTo(h.x,h.y);X.lineTo(h.x+c.face*r*1.6,h.y-r*(.8+.15*Math.sin(t*.006+c.id)));X.moveTo(h.x,h.y);X.lineTo(h.x+c.face*r*1.5,h.y+r*(.7+.12*Math.cos(t*.006+c.id)));X.stroke();}
    if(c.spec.family==='melt'){
      X.fillStyle=`rgba(180,245,215,${.04+.05*breath})`;X.beginPath();X.ellipse(s.x,s.y+4*z,(18+spd*2)*z,(7+breath*2)*z,0,0,TAU);X.fill();}
  }
  drawCreature=function(c,t){V107_drawCreatureBase(c,t);v107CreatureOverlay(c,t);};

  const V107_drawWeatherBase=drawWeather;
  drawWeather=function(t){
    for(const p of V107_SPLASH){const s=worldToScreen(p.x,p.y),r=p.r*camera.zoom;if(p.kind==='water')X.fillStyle='rgba(178,225,236,.42)';else if(p.kind==='lava')X.fillStyle='rgba(255,151,55,.68)';else X.fillStyle='rgba(153,221,188,.40)';X.beginPath();X.arc(s.x,s.y,r,0,TAU);X.fill();}
    V107_drawWeatherBase(t);
  };

  const V107_updateUIBase=updateUI;
  updateUI=function(){V107_updateUIBase();stats.innerHTML+=`<br><span class="dim">living flora ${plants.filter(p=>p.v107Rig&&p.alive).length} · ground marks ${V107_FOOT.length} · splashes ${V107_SPLASH.length} · drifting seed ${V107_SEEDS.length}</span>`;};

  for(const p of plants){if(p.alive)v107RigPlant(p);const cx=clamp(Math.floor(p.x/TILE),0,COLS-1),cy=clamp(Math.floor(p.y/TILE),0,ROWS-1);V107_BANK[tidx(cx,cy)]=Math.min(12,V107_BANK[tidx(cx,cy)]+(p.alive?2:1));}
})();
