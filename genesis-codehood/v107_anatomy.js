'use strict';
/* GENESIS V107 — PHYSICAL ANATOMY
   Lightweight internal organ physics, articulated jaws/tongues, physical hands/fingers,
   localized wounds, gut spills, scavenging, skeleton exposure and heat-melt coupling.
   Loaded after V106. */
(function(){
  const V107_GUTS=[];
  let V107_BITES=0,V107_SPILLS=0,V107_HANDS=0;

  function v107Node(x,y,r=2,m=.3){const n=Node(x,y,r,m);n.v107=true;return n;}
  function v107Attach(c){
    if(!c||c.v107||!c.nodes?.length)return c;
    const h=c.head(),face=c.face||1,s=c.g.size||1,mid=c.nodes[Math.min(1,c.nodes.length-1)],rear=c.nodes[c.nodes.length-1];
    const jaw=v107Node(h.x+face*5*s,h.y+4*s,3.1*s,.28);
    const tongue=v107Node(h.x+face*7*s,h.y+3*s,1.5*s,.18);
    const heart=v107Node(mid.x,mid.y-2*s,2.2*s,.22);
    const stomach=v107Node(mid.x-face*2*s,mid.y+3*s,2.8*s,.30);
    const guts=[];
    const gx=lerp(mid.x,rear.x,.55),gy=lerp(mid.y,rear.y,.55)+2*s;
    for(let i=0;i<6;i++)guts.push(v107Node(gx-face*i*1.6*s,gy+Math.sin(i*1.7)*2*s,1.8*s,.16));
    const hands=[];
    for(const l of c.limbs){
      if(!l.arm)continue;
      const palm=v107Node(l.hand.x,l.hand.y,2.2*s,.18), fingers=[];
      for(let k=0;k<3;k++)fingers.push(v107Node(l.hand.x,l.hand.y,1.0*s,.10));
      hands.push({limb:l,palm,fingers,curl:0,side:l.side});
    }
    c.v107={jaw,tongue,heart,stomach,guts,hands,gape:.05,gapeVel:0,biteWind:0,lastHealth:c.health,open:false,spill:false,wounds:[],mouthTarget:null,mouthLatch:null};
    V107_HANDS+=hands.length;
    return c;
  }
  const V107_spawnCreatureBase=spawnCreature;
  spawnCreature=function(...args){const c=V107_spawnCreatureBase(...args);return v107Attach(c);};
  for(const c of creatures)v107Attach(c);

  function v107NearestMouthTarget(c,r=78){
    const h=c.head();let best=null,bd=r*r;
    for(const o of creatures){
      if(o===c||!o.alive||o.gone)continue;
      const hostile=c.spec.role==='pred'||c.spec.family==='bug'||c.spec.family==='crab'||c.spec.family==='melt';
      if(!hostile)continue;
      if(c.spec.role==='pred' && o.spec.role==='pred' && o.spec.family===c.spec.family)continue;
      const q=o.center(),d=(q.x-h.x)**2+(q.y-h.y)**2;
      if(d<bd){bd=d;best=o;}
    }
    return best;
  }
  function v107ClosestBodyNode(c,p){let best=c.nodes[0],bi=0,bd=1e9;for(let i=0;i<c.nodes.length;i++){const n=c.nodes[i],d=(n.x-p.x)**2+(n.y-p.y)**2;if(d<bd){bd=d;best=n;bi=i;}}return{node:best,index:bi,d:Math.sqrt(bd)};}
  function v107Wound(c,index,severity){
    if(!c.v107)return;const w=c.v107.wounds.find(w=>w.index===index&&w.life>0);
    if(w){w.severity=Math.min(1.5,w.severity+severity);w.life=Math.max(w.life,1200);}
    else c.v107.wounds.push({index,severity,life:1200+severity*1600,bleed:severity*.8});
    if(index>0&&severity>.35)c.v107.open=true;
    if(index>0&&severity>.62&&!c.v107.spill)v107Spill(c,severity);
  }
  function v107Spill(c,severity=.7){
    const a=c.v107;if(!a||a.spill)return;a.spill=true;V107_SPILLS++;
    const q=c.center(),nodes=[];
    for(let i=0;i<7;i++){const n=v107Node(q.x+(rnd()-.5)*9,q.y+(rnd()-.5)*7,1.7+rnd()*1.4,.14);impulse(n,(rnd()-.5)*(1.2+severity),-rnd()*.8);nodes.push(n);}
    V107_GUTS.push({owner:c.id,nodes,meat:7*c.g.size,life:5200,color:c.spec.family==='melt'?'#688f75':'#8d4c53',gone:false});
    if(typeof particlesBlood==='function')particlesBlood(q.x,q.y,8);
  }

  function v107StepJaw(c){
    const a=c.v107,h=c.head(),jaw=a.jaw,tongue=a.tongue,face=c.face||1,s=c.g.size||1;
    const target=v107NearestMouthTarget(c,95),threat=target?target.center():null;
    a.mouthTarget=target;
    let want=.04;
    const attackState=['POUNCE','STALK','OOZE_HUNT','AMBUSH','HUNT_FLY','SCAVENGE'].includes(c.state);
    if(c.alive&&target&&attackState){const d=Math.hypot(threat.x-h.x,threat.y-h.y);want=d<55?.92:d<90?.48:.1;}
    if(!c.alive)want=.25;
    a.gapeVel+=(want-a.gape)*.16;a.gapeVel*=.72;a.gape=clamp(a.gape+a.gapeVel,0,1);
    integrateNode(jaw,c.alive?.12:.40,.90);
    const jawX=h.x+face*(4.5+2*a.gape)*s,jawY=h.y+(3+8*a.gape)*s;
    jaw.x=lerp(jaw.x,jawX,.46);jaw.y=lerp(jaw.y,jawY,.46);constrain(h,jaw,(4.7+7*a.gape)*s,.55);
    integrateNode(tongue,c.alive?.08:.38,.88);
    const tongueLen=(5+9*a.gape)*s;tongue.x=lerp(tongue.x,h.x+face*tongueLen,.38);tongue.y=lerp(tongue.y,h.y+3*s+a.gape*3*s,.38);constrain(h,tongue,tongueLen,.52);
    if(c.alive&&target&&a.gape>.48){
      const hit=v107ClosestBodyNode(target,jaw),d=Math.hypot(hit.node.x-jaw.x,hit.node.y-jaw.y);
      if(d<10*s && c.biteCooldown<=0){
        a.gapeVel=-.36;a.gape=.22;c.biteCooldown=20;
        const damage=(5.5+8*c.g.aggression)*(c.spec.family==='bug'?1.08:1);
        target.health-=damage;target.stun=Math.max(target.stun,5);impulse(hit.node,face*1.2*c.g.size,-.25);
        v107Wound(target,hit.index,clamp(damage/22,.18,.8));
        if(target.v107?.open&&rnd()<.18)v107Spill(target,.7);
        if(typeof particlesBlood==='function')particlesBlood(hit.node.x,hit.node.y,5);
        a.mouthLatch={target,node:hit.node,t:8+Math.floor(rnd()*10)};V107_BITES++;
      }
    }
    if(a.mouthLatch){const m=a.mouthLatch;if(!m.target.alive||m.t--<=0)a.mouthLatch=null;else{spring(jaw,m.node,5*s,.10*c.g.grip);m.node.x-=face*.10*c.g.grip;}}
  }

  function v107StepHands(c){
    const a=c.v107,s=c.g.size||1;
    for(const hand of a.hands){
      const l=hand.limb,p=hand.palm;integrateNode(p,c.alive?.16:.40,.90);p.x=lerp(p.x,l.hand.x,.56);p.y=lerp(p.y,l.hand.y,.56);constrain(l.hand,p,2.2*s,.65);
      const gripping=!!(l.planted||c.grab||a.mouthLatch);hand.curl=lerp(hand.curl,gripping?1:.08,.16);
      const baseAngle=Math.atan2(l.hand.y-c.nodes[l.anchor].y,l.hand.x-c.nodes[l.anchor].x);
      for(let k=0;k<hand.fingers.length;k++){const f=hand.fingers[k];integrateNode(f,c.alive?.12:.40,.87);const spread=(k-1)*.50*(1-hand.curl*.55),ang=baseAngle+spread+hand.side*.15,len=(5.5-2*hand.curl)*s,tx=p.x+Math.cos(ang)*len,ty=p.y+Math.sin(ang)*len+hand.curl*2*s;f.x=lerp(f.x,tx,.42);f.y=lerp(f.y,ty,.42);constrain(p,f,len,.55);}
    }
  }

  function v107StepOrgans(c){
    const a=c.v107,s=c.g.size||1,mid=c.nodes[Math.min(1,c.nodes.length-1)],rear=c.nodes[c.nodes.length-1],parts=[a.heart,a.stomach,...a.guts];
    for(const n of parts)integrateNode(n,c.alive&&!a.open?.05:.38,a.open?.96:.82);
    if(!a.spill){spring(a.heart,mid,1*s,.18);spring(a.stomach,mid,4*s,.13);if(a.guts.length){constrain(mid,a.guts[0],6*s,.35);for(let i=1;i<a.guts.length;i++)constrain(a.guts[i-1],a.guts[i],3.4*s,.46);constrain(a.guts[a.guts.length-1],rear,7*s,.28);}}
    for(const w of a.wounds){if(w.life>0){w.life--;if(c.alive&&w.bleed>.05&&simTick%Math.max(4,Math.floor(16-w.severity*9))===c.id%Math.max(4,Math.floor(16-w.severity*9))){const n=c.nodes[Math.min(w.index,c.nodes.length-1)];if(typeof particlesBlood==='function')particlesBlood(n.x,n.y,1);w.bleed*=.998;}}}
    a.wounds=a.wounds.filter(w=>w.life>0);
  }
  function v107StepLooseGuts(){
    for(const g of V107_GUTS){if(g.gone)continue;g.life--;for(const n of g.nodes)integrateNode(n,.42,.986);for(let i=1;i<g.nodes.length;i++)constrain(g.nodes[i-1],g.nodes[i],3.5,.54);
      for(const c of creatures){if(!c.alive||g.meat<=0||!(c.spec.role==='scav'||c.spec.role==='pred'||c.spec.family==='bone'))continue;const q=c.head();let best=null,bd=28*28;for(const n of g.nodes){const d=(n.x-q.x)**2+(n.y-q.y)**2;if(d<bd){bd=d;best=n;}}if(best&&simTick%8===c.id%8){const e=Math.min(.45,g.meat);g.meat-=e;c.energy=Math.min(105,c.energy+e*1.5);spring(q,best,7,.05);}}
      if(typeof ECO_D!=='undefined'&&g.nodes.length&&g.meat>0&&g.life%30===0){const n=g.nodes[0],gi=ecoGroundCell(n.x,n.y);ECO_D[gi]=clamp(ECO_D[gi]+.0015,0,2);}if(g.meat<=.02||g.life<=0)g.gone=true;}
    for(let i=V107_GUTS.length-1;i>=0;i--)if(V107_GUTS[i].gone)V107_GUTS.splice(i,1);
  }
  function v107HeatDamage(c){if(typeof V105_HEAT==='undefined'||typeof v104CellAtWorld!=='function'||!c.alive)return;const q=c.center(),cc=v104CellAtWorld(q.x,q.y),heat=V105_HEAT[v104Idx(clamp(cc.x,0,V104_COLS-1),clamp(cc.y,0,V104_ROWS-1))]||0;if(heat>160){const dmg=(heat-150)*.0022;c.health-=dmg;if(c.spec.family==='melt'&&typeof v103BurstSlime==='function'&&rnd()<.025)v103BurstSlime(c,1);if(heat>215&&rnd()<.012){v107Wound(c,1,.28);if(typeof fx!=='undefined'&&fx.length<250){const n=c.nodes[Math.min(1,c.nodes.length-1)];fx.push({x:n.x,y:n.y,vx:(rnd()-.5)*.2,vy:-.5-rnd()*.4,life:35+rnd()*25,c:'#47423c'});}}}}

  const V107_stepCreatureBase=stepCreature;
  stepCreature=function(c){v107Attach(c);const before=c.health;V107_stepCreatureBase(c);if(!c.v107)return;if(c.alive){v107StepJaw(c);v107StepHands(c);v107StepOrgans(c);v107HeatDamage(c);}else{v107StepJaw(c);v107StepHands(c);v107StepOrgans(c);if(!c.v107.spill&&c.meat<10)v107Spill(c,.75);}const loss=Math.max(0,(c.v107.lastHealth??before)-c.health);if(loss>3&&c.alive){const idx=Math.floor(rnd()*c.nodes.length);v107Wound(c,idx,clamp(loss/25,.14,.72));}c.v107.lastHealth=c.health;};
  const V107_stepBase=step;step=function(){V107_stepBase();v107StepLooseGuts();};
  const V107_killBase=killCreature;killCreature=function(c,killer=null){v107Attach(c);V107_killBase(c,killer);if(c.v107&&!c.v107.spill&&(c.spec.family==='melt'||rnd()<.42))v107Spill(c,.8);};

  function v107DrawMouth(c){const a=c.v107;if(!a)return;const h=worldToScreen(c.head().x,c.head().y),j=worldToScreen(a.jaw.x,a.jaw.y),t=worldToScreen(a.tongue.x,a.tongue.y),s=c.g.size*camera.zoom,face=c.face||1,back={x:h.x-face*2*s,y:h.y+1*s};X.fillStyle=c.alive?'#2a0f13':'#171515';X.beginPath();X.moveTo(back.x,back.y);X.lineTo(h.x+face*8*s,h.y+1*s);X.lineTo(j.x+face*6*s,j.y);X.lineTo(back.x,j.y);X.closePath();X.fill();X.strokeStyle='#dccdb6';X.lineWidth=Math.max(.7,.9*camera.zoom);const teeth=Math.max(2,Math.min(6,2+Math.floor(c.g.size*3)));for(let k=0;k<teeth;k++){const u=(k+.5)/teeth,x=lerp(back.x,h.x+face*8*s,u),y=lerp(back.y,h.y+1*s,u);X.beginPath();X.moveTo(x,y);X.lineTo(x-face*.8*s,y+2.3*s);X.stroke();const bx=lerp(back.x,j.x+face*6*s,u),by=j.y;X.beginPath();X.moveTo(bx,by);X.lineTo(bx-face*.6*s,by-2*s);X.stroke();}if(a.gape>.18){X.strokeStyle=c.spec.family==='melt'?'#8ac3a5':'#a95b65';X.lineWidth=Math.max(1,1.4*s);X.lineCap='round';X.beginPath();X.moveTo(h.x+face*2*s,h.y+3*s);X.lineTo(t.x,t.y);X.stroke();}}
  function v107DrawHands(c){if(!c.v107)return;const s=c.g.size*camera.zoom;for(const hand of c.v107.hands){const p=worldToScreen(hand.palm.x,hand.palm.y);X.fillStyle=c.alive?c.spec.hi:'#706b63';X.beginPath();X.ellipse(p.x,p.y,2.6*s,2.1*s,0,0,TAU);X.fill();X.strokeStyle=c.alive?c.spec.hi:'#706b63';X.lineWidth=Math.max(.7,1*s);for(const f of hand.fingers){const q=worldToScreen(f.x,f.y);X.beginPath();X.moveTo(p.x,p.y);X.lineTo(q.x,q.y);X.stroke();X.fillStyle='#c9c6b4';X.beginPath();X.arc(q.x,q.y,.65*s,0,TAU);X.fill();}}}
  function v107DrawWoundsAndOrgans(c){const a=c.v107;if(!a)return;for(const w of a.wounds){const n=c.nodes[Math.min(w.index,c.nodes.length-1)],p=worldToScreen(n.x,n.y),r=(2+w.severity*5)*camera.zoom;X.fillStyle=`rgba(86,20,28,${.22+.35*w.severity})`;X.beginPath();X.ellipse(p.x,p.y,r,r*.35,.25,0,TAU);X.fill();}if(a.open||!c.alive){const organAlpha=c.alive?.35:.52,organs=[[a.heart,'#85414a',2.3],[a.stomach,'#77634f',2.8]];for(const [n,col,r] of organs){const p=worldToScreen(n.x,n.y);X.fillStyle=col;X.globalAlpha=organAlpha;X.beginPath();X.ellipse(p.x,p.y,r*camera.zoom,r*.75*camera.zoom,0,0,TAU);X.fill();X.globalAlpha=1;}if(!a.spill){X.strokeStyle='rgba(126,64,69,.55)';X.lineWidth=Math.max(1,2*camera.zoom);X.beginPath();for(let i=0;i<a.guts.length;i++){const p=worldToScreen(a.guts[i].x,a.guts[i].y);if(i===0)X.moveTo(p.x,p.y);else X.lineTo(p.x,p.y);}X.stroke();}}}
  function v107DrawLooseGuts(){for(const g of V107_GUTS){if(g.gone)continue;X.strokeStyle=g.color;X.lineWidth=Math.max(1.4,2.4*camera.zoom);X.lineCap='round';X.beginPath();for(let i=0;i<g.nodes.length;i++){const p=worldToScreen(g.nodes[i].x,g.nodes[i].y);if(i===0)X.moveTo(p.x,p.y);else X.lineTo(p.x,p.y);}X.stroke();for(let i=0;i<g.nodes.length;i+=2){const p=worldToScreen(g.nodes[i].x,g.nodes[i].y);X.fillStyle='rgba(156,76,85,.58)';X.beginPath();X.ellipse(p.x,p.y,2.2*camera.zoom,1.5*camera.zoom,0,0,TAU);X.fill();}}}
  const V107_drawCreatureBase=drawCreature;drawCreature=function(c,t){V107_drawCreatureBase(c,t);if(c.gone)return;v107DrawMouth(c);v107DrawHands(c);v107DrawWoundsAndOrgans(c);};
  const V107_drawWeatherBase=drawWeather;drawWeather=function(t){v107DrawLooseGuts();V107_drawWeatherBase(t);};
  const V107_updateUIBase=updateUI;updateUI=function(){V107_updateUIBase();if(stats)stats.innerHTML+=`<br><span class="dim">anatomy · bites ${V107_BITES} · gut spills ${V107_SPILLS} · physical hands ${V107_HANDS}</span>`;};
  const V107_resetBase=reset;reset=function(){V107_GUTS.length=0;V107_BITES=V107_SPILLS=V107_HANDS=0;V107_resetBase();for(const c of creatures)v107Attach(c);};
})();