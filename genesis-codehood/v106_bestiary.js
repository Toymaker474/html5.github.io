'use strict';
/* GENESIS V106 — BESTIARY + DYNAMIC FLORA
   Adds new creature families, richer plants, custom abilities,
   skeletonizing corpses, and melting/slime fauna.
*/
(function(){
  const V106_NEW_SPECS=[
    {key:'shard_beetle',name:'Shard Beetle',family:'bug',role:'scav',move:'climb',body:3,legs:6,arms:0,tail:1,baseSpeed:.31,gravity:.34,color:'#4f5743',hi:'#97a66d',small:true},
    {key:'widow_mantis',name:'Widow Mantis',family:'bug',role:'pred',move:'climb',body:3,legs:4,arms:2,tail:2,baseSpeed:.44,gravity:.33,color:'#54633c',hi:'#b8cf7f'},
    {key:'lantern_roach',name:'Lantern Roach',family:'bug',role:'herb',move:'ground',body:2,legs:6,arms:0,tail:0,baseSpeed:.38,gravity:.36,color:'#67573d',hi:'#d4b769',small:true},
    {key:'glass_cicada',name:'Glass Cicada',family:'bug',role:'herb',move:'fly',body:2,legs:4,arms:2,tail:1,baseSpeed:.46,gravity:.12,color:'#4a6c67',hi:'#bce6db',small:true},
    {key:'mire_crab',name:'Mire Crab',family:'crab',role:'scav',move:'ground',body:3,legs:6,arms:2,tail:0,baseSpeed:.33,gravity:.41,color:'#5d6655',hi:'#bcc8a3'},
    {key:'ember_crab',name:'Ember Crab',family:'crab',role:'pred',move:'ground',body:3,legs:6,arms:2,tail:0,baseSpeed:.39,gravity:.41,color:'#7a4e38',hi:'#ecb16c'},
    {key:'reef_hermit',name:'Reef Hermit',family:'crab',role:'herb',move:'ground',body:2,legs:6,arms:2,tail:0,baseSpeed:.28,gravity:.42,color:'#56606b',hi:'#cfd2d7'},
    {key:'wax_slug',name:'Wax Slug',family:'melt',role:'scav',move:'ground',body:4,legs:0,arms:0,tail:3,baseSpeed:.20,gravity:.40,color:'#89a37d',hi:'#e3f0cc'},
    {key:'melt_hound',name:'Melt Hound',family:'melt',role:'pred',move:'ground',body:4,legs:4,arms:0,tail:4,baseSpeed:.42,gravity:.40,color:'#556a4f',hi:'#c8e3a4'},
    {key:'tar_jelly',name:'Tar Jelly',family:'melt',role:'scav',move:'ground',body:3,legs:0,arms:4,tail:2,baseSpeed:.16,gravity:.28,color:'#30453e',hi:'#96d2be',small:true},
    {key:'bone_crawler',name:'Bone Crawler',family:'bone',role:'scav',move:'climb',body:3,legs:6,arms:0,tail:2,baseSpeed:.36,gravity:.34,color:'#857f73',hi:'#e3dac7'},
    {key:'marrow_stalker',name:'Marrow Stalker',family:'bone',role:'pred',move:'ground',body:3,legs:4,arms:2,tail:2,baseSpeed:.43,gravity:.38,color:'#70695d',hi:'#ece2cf'}
  ];

  function v106Register(){
    for(const s of V106_NEW_SPECS){
      if(SPEC[s.key]) continue;
      SPEC[s.key]={...s,intelligent:false,builder:false,netter:false,weaver:false,variant:0,feminine:false,torsoAccent:1};
    }
  }
  v106Register();

  const V106_spawnPlantBase=spawnPlant;
  const V106_PLANT_KINDS=[
    {name:'reed',stem:'#587252',leaf:'#99ba7f',flower:'#ccd489',h:16,r:4,wet:1.2,climb:0,trap:0},
    {name:'fern',stem:'#425b43',leaf:'#7ea96f',flower:'#a9d690',h:14,r:6,wet:1.0,climb:0,trap:0},
    {name:'vine',stem:'#58735a',leaf:'#9ccc87',flower:'#d7f0b6',h:20,r:3,wet:1.0,climb:1,trap:0},
    {name:'bulb',stem:'#655941',leaf:'#7f8f58',flower:'#f5d77c',h:12,r:5,wet:.9,climb:0,trap:0},
    {name:'mushroom',stem:'#b6c4bc',leaf:'#7a5e72',flower:'#dcd1ff',h:10,r:7,wet:1.4,climb:0,trap:0},
    {name:'pitcher',stem:'#55684b',leaf:'#8fb868',flower:'#d0805e',h:18,r:5,wet:1.1,climb:0,trap:1}
  ];
  spawnPlant=function(x,y){
    V106_spawnPlantBase(x,y);
    const p=plants[plants.length-1];
    const k=V106_PLANT_KINDS[(rnd()*V106_PLANT_KINDS.length)|0];
    p.kind=k.name; p.height=k.h*(.75+rnd()*.8); p.radius=k.r*(.85+rnd()*.5); p.wetNeed=k.wet;
    p.climb=k.climb; p.trap=k.trap; p.seed=8+rnd()*18; p.hp=24+rnd()*20; p.growth=.35+rnd()*.5; p.swayRate=.0015+rnd()*.002;
    p.bloom=rnd(); p.seedT=140+rnd()*320; p.catch=0; p.colorStem=k.stem; p.colorLeaf=k.leaf; p.colorFlower=k.f;
    return p;
  };

  function v106UpgradePlants(){
    for(const p of plants){
      if(p.kind) continue;
      const k=V106_PLANT_KINDS[(rnd()*V106_PLANT_KINDS.length)|0];
      p.kind=k.name; p.height=k.h*(.75+rnd()*.8); p.radius=k.r*(.85+rnd()*.5); p.wetNeed=k.wet;
      p.climb=k.climb; p.trap=k.trap; p.seed=8+rnd()*18; p.hp=24+rnd()*20; p.growth=.35+rnd()*.5; p.swayRate=.0015+rnd()*.002;
      p.bloom=rnd(); p.seedT=140+rnd()*320; p.catch=0; p.colorStem=k.stem; p.colorLeaf=k.leaf; p.colorFlower=k.flower;
    }
  }

  const V106_seedLifeBase=seedLife;
  seedLife=function(){
    V106_seedLifeBase();
    v106UpgradePlants();
    const extras=['shard_beetle','widow_mantis','lantern_roach','glass_cicada','mire_crab','ember_crab','reef_hermit','wax_slug','melt_hound','tar_jelly','bone_crawler','marrow_stalker'];
    for(const type of extras){
      const count=type==='melt_hound'||type==='widow_mantis'||type==='marrow_stalker'?1:2;
      for(let i=0;i<count;i++) spawnCreature(type);
    }
  };

  const V106_chooseAIBase=chooseAI;
  chooseAI=function(c){
    V106_chooseAIBase(c);
    if(!c.alive) return;
    if(c.spec.family==='bone'){
      const corpse=nearest(c,o=>!o.alive&&!o.gone, c.g.vision*520);
      if(corpse){ c.state='SCAVENGE'; c.aiTarget=corpse; c.stateT=90+Math.floor(rnd()*120); }
    }else if(c.spec.family==='melt'){
      const prey=nearest(c,o=>o.alive&&(o.spec.role==='herb'||o.spec.small), c.g.vision*260);
      if(c.spec.role==='pred' && prey && lineClear(c.center(),prey.center())){ c.state='OOZE_HUNT'; c.aiTarget=prey; c.stateT=70+Math.floor(rnd()*90); }
      else if(c.energy<70){ const corpse=nearest(c,o=>!o.alive&&!o.gone, 240); if(corpse){ c.state='SCAVENGE'; c.aiTarget=corpse; }}
    }else if(c.spec.family==='bug'){
      if(c.spec.move==='fly' && rnd()<.22){ c.state='SKIM'; c.stateT=55+Math.floor(rnd()*60); }
      if(c.type==='widow_mantis'){
        const prey=nearest(c,o=>o.alive&&(o.spec.role==='herb'||o.spec.small), c.g.vision*380);
        if(prey){ c.state='AMBUSH'; c.aiTarget=prey; c.stateT=80+Math.floor(rnd()*120); }
      }
    }else if(c.spec.family==='crab'){
      const threat=nearest(c,o=>o.alive&&o.spec.role==='pred'&&o!==c, c.g.vision*300);
      if(threat && c.spec.role!=='pred'){ c.state='SIDESNAP'; c.aiTarget=threat; c.stateT=50+Math.floor(rnd()*70); }
    }
  };

  const V106_desiredMotionBase=desiredMotion;
  desiredMotion=function(c){
    const m=V106_desiredMotionBase(c);
    if(c.spec.family==='crab'){
      if(c.state==='SIDESNAP' || c.state==='ROAM' || c.state==='FORAGE'){
        m.dx=(c.aiTarget?Math.sign((c.aiTarget.center?c.aiTarget.center().x:c.aiTarget.x)-c.center().x):c.face)||c.face;
        m.dy*=.35; m.speed*=1.05;
      }
    }
    if(c.spec.family==='melt'){
      m.speed*=.72; m.dy*=.22;
      if(c.state==='OOZE_HUNT') m.speed*=1.18;
    }
    if(c.state==='AMBUSH'){ m.speed*=.42; }
    if(c.state==='SKIM'){ m.speed*=1.15; m.dy-=.22; }
    return m;
  };

  const V106_handleInteractionsBase=handleInteractions;
  handleInteractions=function(c){
    V106_handleInteractionsBase(c);
    if(!c.alive) return;
    const q=c.head();
    if(c.spec.family==='bug' && c.type==='widow_mantis'){
      const prey=nearest(c,o=>o.alive&&o!==c&&(o.spec.role==='herb'||o.spec.small),40);
      if(prey && c.biteCooldown<=0){ prey.trapped=Math.max(prey.trapped,18); prey.health-=6; c.biteCooldown=20; particlesBlood(prey.center().x,prey.center().y,3); }
    }
    if(c.spec.family==='crab'){
      const foe=nearest(c,o=>o.alive&&o!==c,26);
      if(foe && simTick%22===c.id%22){ foe.health-=2.6+(c.spec.role==='pred'?2.4:0); foe.stun=Math.max(foe.stun,5); if(rnd()<.07&&foe.limbs.length){ const l=foe.limbs[(rnd()*foe.limbs.length)|0]; if(l&&!l.disabled){ l.disabled=true; looseParts.push({node:l.hand,type:foe.type,life:2600,color:foe.spec.color}); } } }
    }
    if(c.spec.family==='melt'){
      if(typeof v103BurstSlime==='function' && (c.health<55 || c.state==='OOZE_HUNT') && rnd()<.025) v103BurstSlime(c,2);
      for(const o of creatures){ if(o===c||!o.alive) continue; const qq=o.center(); if(Math.hypot(qq.x-q.x,qq.y-q.y)<22){ o.trapped=Math.max(o.trapped,3); if(c.spec.role==='pred' && rnd()<.08) o.health-=1.6; } }
    }
    if(c.spec.family==='bone'){
      const corpse=nearest(c,o=>!o.alive&&!o.gone,32);
      if(corpse && corpse.meat>0 && simTick%10===0){ const eat=Math.min(2.2,corpse.meat); corpse.meat-=eat; c.energy=Math.min(105,c.energy+eat*.9); }
    }
  };

  const V106_killCreatureBase=killCreature;
  killCreature=function(c,killer=null){
    V106_killCreatureBase(c,killer);
    c.v106Corpse=0; c.v106Skeleton=0; c.v106Melted=0;
    if(c.spec.family==='melt' && typeof v103BurstSlime==='function') v103BurstSlime(c,18);
  };

  const V106_stepDeadBase=stepDead;
  stepDead=function(c){
    V106_stepDeadBase(c);
    c.v106Corpse=(c.v106Corpse||0)+1;
    if(c.spec.family==='melt'){
      if(typeof v103BurstSlime==='function' && c.v106Corpse%30===0) v103BurstSlime(c,1);
      c.meat=Math.max(0,c.meat-.04);
      if(c.v106Corpse>500) c.v106Melted=1;
    }
    if((c.meat<=6 || c.v106Corpse>1400) && !c.v106Skeleton){
      c.v106Skeleton=1;
      c.v106Skull={x:c.head().x,y:c.head().y};
    }
  };

  const V106_stepBase=step;
  function v106StepPlants(){
    for(const p of plants){
      if(!p.kind) continue;
      p.seedT--;
      const cell=typeof ecoGroundCell==='function'?ecoGroundCell(p.x,p.y):tidx(clamp(Math.floor(p.x/TILE),0,COLS-1),clamp(Math.floor(p.y/TILE),0,ROWS-1));
      const moisture=wet[cell]||0;
      if(p.alive){
        p.bloom=clamp(p.bloom + (moisture*p.wetNeed-.28)*.003 + .0005,0,1.5);
        p.food=clamp(p.food + .006*p.growth + moisture*.014 - .003,0,60);
        p.hp=clamp(p.hp + moisture*.05 - (moisture<.08?.09:0),0,80);
        if(p.trap && simTick%18===0){
          for(const f of flies){ if(!f.alive||f.caught) continue; if(Math.hypot(f.x-p.x, f.y-(p.y-p.height))<12+p.radius*2 && rnd()<.35){ f.alive=false; p.food=Math.min(60,p.food+3.5); p.catch=(p.catch||0)+1; break; } }
        }
        if(p.seedT<=0 && p.food>18 && rnd()<.2){
          const nx=p.x+(rnd()-.5)*90, surf=typeof v104SurfaceAtWorldX==='function'?v104SurfaceAtWorldX(nx,p.y):{x:nx,y:p.y};
          if(surf && !isSolidAt(nx,surf.y-10)) spawnPlant(nx, surf.y-1);
          p.food-=6; p.seedT=200+rnd()*420;
        }
        if(p.hp<=0 || p.food<=0) p.alive=false;
      } else if(rnd()<.00025*(1+moisture*5)) {
        p.alive=true; p.food=6+rnd()*8; p.hp=12+rnd()*10; p.seedT=180+rnd()*240;
      }
    }
  }
  function v106MigrateCreatures(){
    const alive=creatures.filter(c=>c.alive).length;
    if(alive>58) return;
    const pool=V106_NEW_SPECS;
    const s=pool[(rnd()*pool.length)|0];
    if(s) spawnCreature(s.key);
  }
  step=function(){
    V106_stepBase();
    v106StepPlants();
    if(simTick%420===0) v106MigrateCreatures();
  };

  const V106_drawPlantsBase=drawPlants;
  function v106LeafStroke(x1,y1,c1,x2,y2,w,color){ X.strokeStyle=color; X.lineWidth=w; X.beginPath(); X.moveTo(x1,y1); X.quadraticCurveTo((x1+x2)*.5+w*2,y2-(y1-y2)*.2,x2,y2); X.stroke(); }
  drawPlants=function(t){
    for(const p of plants){
      if(!p.kind){ V106_drawPlantsBase(t); return; }
      if(!p.alive) continue;
      const s=worldToScreen(p.x,p.y); if(s.x<-60||s.x>SW+60||s.y<-60||s.y>SH+60) continue;
      const h=(p.height||14)*camera.zoom, sway=Math.sin(t*(p.swayRate||.002)+p.phase)*(1.5+weather.rain*4)*camera.zoom;
      X.strokeStyle=p.colorStem||'#5c7754'; X.lineWidth=Math.max(1.1,1.8*camera.zoom); X.beginPath(); X.moveTo(s.x,s.y); X.quadraticCurveTo(s.x+sway*.5,s.y-h*.45,s.x+sway,s.y-h); X.stroke();
      if(p.kind==='reed' || p.kind==='fern' || p.kind==='vine'){
        for(let i=0;i<3;i++){ const yy=s.y-h*(.28+.18*i), xx=s.x+sway*(.35+.22*i), dir=i%2?-1:1; v106LeafStroke(xx,yy,0,xx+dir*(7+i*2)*camera.zoom,yy-4*camera.zoom,1.1*camera.zoom,p.colorLeaf); }
      }
      if(p.kind==='bulb'){ X.fillStyle=p.colorLeaf; X.beginPath(); X.ellipse(s.x+sway,s.y-h,5*camera.zoom,4*camera.zoom,0,0,TAU); X.fill(); X.fillStyle=p.colorFlower; X.beginPath(); X.arc(s.x+sway,s.y-h,2.4*camera.zoom,0,TAU); X.fill(); }
      else if(p.kind==='mushroom'){ X.fillStyle=p.colorStem; X.fillRect(s.x-1.2*camera.zoom,s.y-h*.55,2.4*camera.zoom,h*.55); X.fillStyle=p.colorLeaf; X.beginPath(); X.ellipse(s.x,s.y-h*.62,8*camera.zoom,4.8*camera.zoom,0,0,TAU); X.fill(); }
      else if(p.kind==='pitcher'){ X.fillStyle=p.colorLeaf; X.beginPath(); X.ellipse(s.x+sway,s.y-h*.7,4.5*camera.zoom,8*camera.zoom,.15,0,TAU); X.fill(); X.fillStyle=p.colorFlower; X.beginPath(); X.arc(s.x+sway,s.y-h*.96,2.2*camera.zoom,0,TAU); X.fill(); }
      if(p.bloom>.75){ X.fillStyle=p.colorFlower||'#d7f0b6'; X.beginPath(); X.arc(s.x+sway*1.1,s.y-h*(1+.1*Math.sin(t*.002+p.phase)),1.5*camera.zoom+p.bloom*1.3*camera.zoom,0,TAU); X.fill(); }
    }
  };

  const V106_drawCreatureBase=drawCreature;
  function v106DrawSkeleton(c){
    X.strokeStyle='#dad2c4'; X.lineWidth=Math.max(1.2,1.6*camera.zoom*c.g.size); X.lineCap='round';
    for(let i=0;i<c.nodes.length-1;i++){ const a=worldToScreen(c.nodes[i].x,c.nodes[i].y), b=worldToScreen(c.nodes[i+1].x,c.nodes[i+1].y); X.beginPath(); X.moveTo(a.x,a.y); X.lineTo(b.x,b.y); X.stroke(); }
    for(const l of c.limbs){ if(l.disabled) continue; const a=worldToScreen(c.nodes[l.anchor].x,c.nodes[l.anchor].y), h=worldToScreen(l.hand.x,l.hand.y); X.beginPath(); X.moveTo(a.x,a.y); X.lineTo(h.x,h.y); X.stroke(); }
    const h=worldToScreen(c.head().x,c.head().y), r=c.head().r*camera.zoom*.8; X.fillStyle='#f2ead7'; X.beginPath(); X.arc(h.x,h.y,r,0,TAU); X.fill(); X.fillStyle='#1c1a18'; X.beginPath(); X.arc(h.x-c.face*r*.2,h.y-r*.1,r*.14,0,TAU); X.arc(h.x+c.face*r*.15,h.y-r*.1,r*.14,0,TAU); X.fill();
  }
  function v106DrawBug(c,t){
    const q=c.center(); const s=worldToScreen(q.x,q.y); const sc=c.g.size*camera.zoom; if(s.x<-120||s.x>SW+120||s.y<-120||s.y>SH+120)return;
    const abdomen=c.nodes[c.nodes.length-1], thorax=c.nodes[Math.min(1,c.nodes.length-1)], head=c.head();
    const A=worldToScreen(abdomen.x,abdomen.y), T=worldToScreen(thorax.x,thorax.y), H=worldToScreen(head.x,head.y);
    X.fillStyle='rgba(0,0,0,.22)'; X.beginPath(); X.ellipse(s.x,s.y+10*sc,22*sc,7*sc,0,0,TAU); X.fill();
    for(let i=0;i<c.limbs.length;i++){ const l=c.limbs[i]; if(l.disabled) continue; const a=worldToScreen(c.nodes[l.anchor].x,c.nodes[l.anchor].y), h=worldToScreen(l.hand.x,l.hand.y); X.strokeStyle='#101413'; X.lineWidth=Math.max(1,2.2*sc); X.beginPath(); X.moveTo(a.x,a.y); X.lineTo((a.x+h.x)*.5 + (i%2?-1:1)*5*sc,(a.y+h.y)*.5); X.lineTo(h.x,h.y); X.stroke(); X.strokeStyle=c.spec.color; X.lineWidth=Math.max(.8,1.2*sc); X.stroke(); }
    X.fillStyle=c.spec.color; X.beginPath(); X.ellipse(A.x,A.y,13*sc,10*sc,0,0,TAU); X.fill(); X.beginPath(); X.ellipse(T.x,T.y,10*sc,8*sc,0,0,TAU); X.fill(); X.beginPath(); X.ellipse(H.x,H.y,7*sc,6*sc,0,0,TAU); X.fill();
    X.fillStyle=c.spec.hi; X.beginPath(); X.ellipse(A.x-sc*2,A.y-sc*2,6*sc,3*sc,-.2,0,TAU); X.fill();
    if(c.spec.move==='fly'){ X.fillStyle='rgba(206,240,238,.24)'; for(let e=-1;e<=1;e+=2){ X.beginPath(); X.ellipse(T.x-2*sc,T.y+e*8*sc,12*sc,4*sc,e*.45,0,TAU); X.fill(); }}
    X.strokeStyle=c.spec.hi; X.lineWidth=Math.max(.7,1*sc); X.beginPath(); X.moveTo(H.x,H.y-1*sc); X.lineTo(H.x+c.face*10*sc,H.y-8*sc); X.moveTo(H.x,H.y+1*sc); X.lineTo(H.x+c.face*9*sc,H.y+7*sc); X.stroke();
    X.fillStyle='#101412'; X.beginPath(); X.arc(H.x+c.face*4*sc,H.y-1*sc,1.5*sc,0,TAU); X.fill();
  }
  function v106DrawCrab(c,t){
    const q=c.center(), s=worldToScreen(q.x,q.y), sc=c.g.size*camera.zoom; if(s.x<-120||s.x>SW+120||s.y<-120||s.y>SH+120)return;
    X.fillStyle='rgba(0,0,0,.24)'; X.beginPath(); X.ellipse(s.x,s.y+10*sc,24*sc,7*sc,0,0,TAU); X.fill();
    for(let i=0;i<c.limbs.length;i++){ const l=c.limbs[i]; if(l.disabled) continue; const a=worldToScreen(c.nodes[l.anchor].x,c.nodes[l.anchor].y), h=worldToScreen(l.hand.x,l.hand.y); const side=i%2?-1:1; X.strokeStyle='#1a1714'; X.lineWidth=2.8*sc; X.beginPath(); X.moveTo(a.x,a.y); X.lineTo(a.x+side*8*sc,a.y+5*sc); X.lineTo(h.x,h.y); X.stroke(); X.strokeStyle=c.spec.color; X.lineWidth=1.4*sc; X.stroke(); }
    X.fillStyle=c.spec.color; X.beginPath(); X.ellipse(s.x,s.y,17*sc,11*sc,0,0,TAU); X.fill(); X.fillStyle=c.spec.hi; X.beginPath(); X.ellipse(s.x,s.y-3*sc,10*sc,4*sc,0,0,TAU); X.fill();
    X.strokeStyle=c.spec.color; X.lineWidth=3*sc; for(let side of [-1,1]){ X.beginPath(); X.moveTo(s.x+side*9*sc,s.y-2*sc); X.lineTo(s.x+side*17*sc,s.y-8*sc); X.lineTo(s.x+side*22*sc,s.y-4*sc); X.stroke(); X.strokeStyle=c.spec.hi; X.beginPath(); X.moveTo(s.x+side*22*sc,s.y-4*sc); X.lineTo(s.x+side*28*sc,s.y-10*sc); X.stroke(); X.strokeStyle=c.spec.color; }
    X.fillStyle='#f2eed8'; for(let side of [-1,1]){ X.beginPath(); X.arc(s.x+side*5*sc,s.y-10*sc,1.5*sc,0,TAU); X.fill(); }
  }
  function v106DrawMelt(c,t){
    const q=c.center(), s=worldToScreen(q.x,q.y), sc=c.g.size*camera.zoom; if(s.x<-140||s.x>SW+140||s.y<-140||s.y>SH+140)return;
    X.fillStyle='rgba(0,0,0,.18)'; X.beginPath(); X.ellipse(s.x,s.y+10*sc,26*sc,8*sc,0,0,TAU); X.fill();
    const pts=c.nodes.map(n=>worldToScreen(n.x,n.y));
    X.fillStyle='rgba(215,255,220,.10)'; X.beginPath(); for(let i=0;i<pts.length;i++){ const p=pts[i]; if(i===0) X.moveTo(p.x,p.y); else X.quadraticCurveTo((pts[i-1].x+p.x)/2,(pts[i-1].y+p.y)/2,p.x,p.y); } const p0=pts[0]; X.quadraticCurveTo((pts[pts.length-1].x+p0.x)/2,(pts[pts.length-1].y+p0.y)/2,p0.x,p0.y); X.fill();
    X.fillStyle=c.spec.color; X.beginPath(); for(let i=0;i<pts.length;i++){ const p=pts[i]; if(i===0) X.moveTo(p.x,p.y); else X.quadraticCurveTo((pts[i-1].x+p.x)/2,(pts[i-1].y+p.y)/2,p.x,p.y); } X.quadraticCurveTo((pts[pts.length-1].x+p0.x)/2,(pts[pts.length-1].y+p0.y)/2,p0.x,p0.y); X.fill();
    X.fillStyle='rgba(255,255,255,.16)'; X.beginPath(); X.ellipse(s.x-6*sc,s.y-4*sc,8*sc,3*sc,-.2,0,TAU); X.fill(); X.fillStyle='#0d1312'; X.beginPath(); X.arc(s.x+c.face*8*sc,s.y-2*sc,1.8*sc,0,TAU); X.fill();
    if(typeof V103_PUDDLES!=='undefined' && c.alive && rnd()<.06){ X.fillStyle='rgba(190,255,220,.28)'; X.beginPath(); X.ellipse(s.x-12*sc+(rnd()*8*sc),s.y+9*sc,2.5*sc,1.5*sc,0,0,TAU); X.fill(); }
  }
  drawCreature=function(c,t){
    if(c.gone) return;
    if(!c.alive && c.v106Skeleton) return v106DrawSkeleton(c);
    if(c.spec.family==='bug') return v106DrawBug(c,t);
    if(c.spec.family==='crab') return v106DrawCrab(c,t);
    if(c.spec.family==='melt') return v106DrawMelt(c,t);
    if(c.spec.family==='bone' && !c.alive) return v106DrawSkeleton(c);
    V106_drawCreatureBase(c,t);
  };

  const V106_updateUIBase=updateUI;
  updateUI=function(){
    V106_updateUIBase();
    const alive=creatures.filter(c=>c.alive);
    const bugs=alive.filter(c=>c.spec.family==='bug').length, crabs=alive.filter(c=>c.spec.family==='crab').length, melts=alive.filter(c=>c.spec.family==='melt').length, bones=alive.filter(c=>c.spec.family==='bone').length;
    const dynPlants=plants.filter(p=>p.kind).length;
    stats.innerHTML += `<br><span class="dim">bug ${bugs} · crab ${crabs} · melt ${melts} · bone ${bones} · flora ${dynPlants}</span>`;
  };

  v106UpgradePlants();
  const nowAdds=['shard_beetle','mire_crab','wax_slug','bone_crawler'];
  for(const type of nowAdds){ if(!creatures.some(c=>c.type===type && c.alive)) spawnCreature(type); }
})();
