'use strict';
/* GENESIS creature 2.5D rig + acoustic ecology pass.
   Scope:
   - persistent articulated mid-joints for legacy limbs
   - crab-specific slow gait filtering and ragdoll articulation
   - depth ordering state for 2.5D presentation (NOT full 3D collision)
   - acoustic events generated from actual contacts/bites/death
   - nearby creatures receive hearing/arousal from those same events
   - WebAudio output is synthesized from simulation events after user interaction
*/
(function(root){
  const c01=v=>Math.max(0,Math.min(1,v));
  const damp=(v,target,response)=>v+(target-v)*Math.max(0,Math.min(1,response));
  function kneeTarget(ax,ay,hx,hy,side=1,bend=.28){
    const dx=hx-ax,dy=hy-ay,d=Math.hypot(dx,dy)||1,nx=-dy/d,ny=dx/d;
    const b=Math.min(d*.42,Math.max(3,d*bend))*side;
    return{x:(ax+hx)*.5+nx*b,y:(ay+hy)*.5+ny*b};
  }
  function acousticGain(intensity,distance,maxDistance=520){
    if(intensity<=0||distance>=maxDistance)return 0;
    const x=1-distance/maxDistance;
    return c01(intensity*x*x);
  }
  const depthVisual=z=>({scale:1+c01(Math.abs(z))*.035*Math.sign(z),y:z*2.2});

  root.GENESIS_RIG25_TEST={damp,kneeTarget,acousticGain,depthVisual};

  if(typeof drawCreature!=='function'||typeof stepCreature!=='function'||typeof Node!=='function'||typeof creatures==='undefined')return;

  const EVENTS=[];
  const MAX_EVENTS=96;
  let audioEnabled=true,ctx=null,master=null,rainGain=null,waterGain=null;
  const state={
    status:'experimental',
    mode:'legacy-2D physics with articulated added joints + simulated depth ordering',
    full3D:false,
    pureMuscleLocomotion:false,
    soundUsesSimulationEvents:true,
    acousticPerception:true,
    notes:[
      '2.5D depth changes draw order/scale only; terrain collision remains 2D',
      'legacy body controller still contains authored direct body drive',
      'added knee/claw nodes are persistent physics nodes and collide with terrain',
      'crab gait is intentionally slowed and low-pass filtered',
      'audio is procedural WebAudio driven by contact/bite/death/weather/fluid state'
    ]
  };

  function makeNode(x,y,r,m){return Node(x,y,r,m)}
  function ensure(c){
    if(!c||!c.nodes?.length)return null;
    if(c._rig25&&c._rig25.limbs.length===c.limbs.length)return c._rig25;
    const s=c.g?.size||1;
    const limbs=c.limbs.map((l,i)=>{
      const A=c.nodes[l.anchor],H=l.hand,k=kneeTarget(A.x,A.y,H.x,H.y,l.side||1,l.arm?.22:.31);
      const joint=makeNode(k.x,k.y,Math.max(1.2,1.8*s),.34);
      const q={joint,limb:l,index:i,z:(i%2?-.55:.55)*(l.arm?.6:1),vz:0,basePhase:(i/Math.max(1,c.limbs.length))*Math.PI*2,wasPlanted:!!l.planted};
      if(c.spec?.family==='crab'&&l.arm){
        q.clawA=makeNode(H.x,H.y-3*s,1.3*s,.16);
        q.clawB=makeNode(H.x,H.y+3*s,1.3*s,.16);
      }
      return q;
    });
    c._rig25={limbs,gait:0,speed:0,dx:c.face||1,dy:0,motionTick:-1,lastAlive:!!c.alive,lastLatch:null,lastState:c.state,lastEnergy:c.energy||0};
    return c._rig25;
  }

  const BASE_DESIRED=typeof desiredMotion==='function'?desiredMotion:null;
  if(BASE_DESIRED){
    desiredMotion=function(c){
      const m=BASE_DESIRED(c);
      if(c?.spec?.family!=='crab')return m;
      const r=ensure(c);if(!r)return m;
      if(r.motionTick!==simTick){
        r.motionTick=simTick;
        const stateScale=(c.state==='EVADE'||c.state==='FLEE')?.58:(c.state==='POUNCE'?.72:.38);
        r.speed=damp(r.speed,m.speed*stateScale,.075);
        r.dx=damp(r.dx,m.dx,.13);
        r.dy=damp(r.dy,m.dy,.10);
      }
      return{...m,speed:r.speed,dx:r.dx,dy:r.dy};
    };
  }

  const BASE_UPDATE_LIMB=typeof updateLimb==='function'?updateLimb:null;
  if(BASE_UPDATE_LIMB){
    updateLimb=function(c,l,dt){
      if(c?.spec?.family==='crab'){
        const r=ensure(c),i=c.limbs.indexOf(l),q=r?.limbs?.[i];
        if(q)l.phase=q.basePhase-simTick*.10+r.gait;
      }
      BASE_UPDATE_LIMB(c,l,dt);
    };
  }

  function stepAddedJoint(c,q){
    const A=c.nodes[q.limb.anchor],H=q.limb.hand,K=q.joint,s=c.g?.size||1;
    const alive=!!c.alive;
    integrateNode(K,alive?.11:.36,alive?.955:.988);
    const kt=kneeTarget(A.x,A.y,H.x,H.y,q.limb.side||1,q.limb.arm?.20:.30);
    if(alive){K.x=damp(K.x,kt.x,q.limb.planted?.13:.095);K.y=damp(K.y,kt.y,q.limb.planted?.13:.095);}
    const total=Math.max(8,q.limb.reach*.82),l1=total*(q.limb.arm?.48:.53),l2=total-l1;
    for(let it=0;it<2;it++){constrain(A,K,l1,alive?.20:.46);constrain(K,H,l2,alive?.20:.46);pointCollide(K);}
    const targetZ=alive?((q.index%2?-.68:.68)*(q.limb.arm?.55:1)):0;
    q.vz=(q.vz+(targetZ-q.z)*(alive?.030:.012))*(alive?.88:.96);
    q.z=Math.max(-1,Math.min(1,q.z+q.vz));

    if(q.clawA&&q.clawB){
      const vx=H.x-A.x,vy=H.y-A.y,d=Math.hypot(vx,vy)||1,fx=vx/d,fy=vy/d,nx=-fy,ny=fx;
      const open=alive?(c.state==='SCAVENGE'||c.state==='AMBUSH'||c.v107?.mouthLatch?.target?.alive?.55:.28):.10;
      for(const [tip,sgn] of [[q.clawA,-1],[q.clawB,1]]){
        integrateNode(tip,alive?.08:.33,alive?.94:.985);
        if(alive){const tx=H.x+fx*7*s+nx*sgn*(2.4+5*open)*s,ty=H.y+fy*7*s+ny*sgn*(2.4+5*open)*s;tip.x=damp(tip.x,tx,.18);tip.y=damp(tip.y,ty,.18);}
        constrain(H,tip,7.8*s,alive?.40:.68);pointCollide(tip);
      }
    }
  }

  function nodeSpeed(n){return Math.hypot(n.x-n.px,n.y-n.py)}
  function emit(kind,x,y,intensity=.5,source=null){
    const e={kind,x,y,intensity:c01(intensity),source:source?.id??null,tick:simTick,life:55};
    EVENTS.push(e);if(EVENTS.length>MAX_EVENTS)EVENTS.shift();propagate(e,source);playEvent(e);return e;
  }
  function propagate(e,source){
    for(const c of creatures){
      if(!c?.alive||c.gone||c===source)continue;
      const q=c.center(),d=Math.hypot(q.x-e.x,q.y-e.y),g=acousticGain(e.intensity,d,e.kind==='death'?650:480);
      if(g<.025)continue;
      c.memory=c.memory||{};c.memory.sound={x:e.x,y:e.y,kind:e.kind,confidence:g,tick:simTick};
      if(c.mind){c.mind.arousal=c01((c.mind.arousal||0)+g*(e.kind==='foot'?.05:.14));if(e.kind==='bite'||e.kind==='death')c.mind.nerves=c01((c.mind.nerves||0)+g*.16);}
    }
  }

  function afterCreature(c,r){
    if(!r)return;
    r.gait+=(c.alive?.014:.004)+Math.min(.032,Math.abs(r.speed||0)*.08);
    if(c.spec?.family==='crab'&&c.alive){for(const n of c.nodes){const vx=n.x-n.px,vy=n.y-n.py;n.px=n.x-vx*.86;n.py=n.y-vy*.90;}}
    for(const q of r.limbs){
      stepAddedJoint(c,q);
      if(q.limb.planted&&!q.wasPlanted){const H=q.limb.hand;emit('foot',H.x,H.y,Math.min(.75,.18+nodeSpeed(H)*.18+(c.g?.size||1)*.08),c);}
      q.wasPlanted=!!q.limb.planted;
    }
    const latch=c.v107?.mouthLatch?.target||null,lid=latch?.id??null;
    if(lid!=null&&lid!==r.lastLatch){const J=c.v107?.jaw||c.head();emit('bite',J.x,J.y,.72,c);}r.lastLatch=lid;
    if(r.lastAlive&&!c.alive){const q=c.center();emit('death',q.x,q.y,Math.min(1,.45+(c.g?.size||1)*.25),c);}r.lastAlive=!!c.alive;
  }

  const BASE_STEP_CREATURE=stepCreature;
  stepCreature=function(c){const r=ensure(c);BASE_STEP_CREATURE(c);afterCreature(c,r||ensure(c));};

  function W(n){return worldToScreen(n.x,n.y)}
  function frame(c){const a=c.nodes[0],b=c.nodes[1]||{x:a.x-(c.face||1),y:a.y};let dx=a.x-b.x,dy=a.y-b.y,d=Math.hypot(dx,dy)||1;dx/=d;dy/=d;if(dx*(c.face||1)<0){dx*=-1;dy*=-1}return{fx:dx,fy:dy,nx:-dy,ny:dx};}
  function shadow(c){const q=c.center(),p=worldToScreen(q.x,q.y),z=camera.zoom,s=c.g?.size||1;X.save();X.fillStyle='rgba(0,0,0,.36)';X.beginPath();X.ellipse(p.x,p.y+13*z,28*s*z,7*s*z,0,0,Math.PI*2);X.fill();X.restore();}
  function drawLeg(c,q){
    if(q.limb.disabled)return;
    const A=W(c.nodes[q.limb.anchor]),K=W(q.joint),H=W(q.limb.hand),dv=depthVisual(q.z),z=camera.zoom*(1+q.z*.035),s=c.g?.size||1,back=q.z<0,alpha=back?.72:1;
    X.save();X.globalAlpha=alpha;X.lineCap='round';X.lineJoin='round';X.strokeStyle='rgba(3,6,5,.92)';X.lineWidth=(q.limb.arm?5.7:4.1)*s*z+1.8*z;
    X.beginPath();X.moveTo(A.x,A.y+dv.y);X.lineTo(K.x,K.y+dv.y);X.lineTo(H.x,H.y+dv.y);X.stroke();
    const g=X.createLinearGradient(A.x,A.y,K.x,K.y);g.addColorStop(0,c.spec?.hi||'#879a84');g.addColorStop(.5,c.spec?.color||'#52655b');g.addColorStop(1,'#28332e');X.strokeStyle=g;X.lineWidth=(q.limb.arm?4.4:3.0)*s*z;X.stroke();
    X.fillStyle=c.spec?.hi||'#a4b69d';X.beginPath();X.arc(K.x,K.y+dv.y,(q.limb.arm?2.8:2.0)*s*z,0,Math.PI*2);X.fill();
    if(!q.limb.arm){X.strokeStyle='#171d19';X.lineWidth=Math.max(.7,1.0*z);X.beginPath();X.moveTo(H.x,H.y+dv.y);X.lineTo(H.x+(c.face||1)*3.8*s*z,H.y+dv.y+1.5*z);X.stroke();}
    else if(q.clawA&&q.clawB){const A1=W(q.clawA),B1=W(q.clawB);X.fillStyle=c.spec?.hi||'#a4b69d';for(const T of[A1,B1]){X.beginPath();X.ellipse(T.x,T.y+dv.y,3.6*s*z,2.0*s*z,0,0,Math.PI*2);X.fill();}X.strokeStyle='#171d19';X.lineWidth=Math.max(.8,1.0*z);X.beginPath();X.moveTo(H.x,H.y+dv.y);X.lineTo(A1.x,A1.y+dv.y);X.moveTo(H.x,H.y+dv.y);X.lineTo(B1.x,B1.y+dv.y);X.stroke();}
    X.restore();
  }
  function drawCrabShell(c,t){
    const f=frame(c),q=c.center(),S=worldToScreen(q.x,q.y),z=camera.zoom,s=c.g?.size||1,ang=Math.atan2(f.fy,f.fx),w=29*s*z,h=14.5*s*z,wet=c01(c._oldSimWet||0),inj=c.v107?.wounds?.length||0;
    X.save();X.translate(S.x,S.y);X.rotate(ang);const gr=X.createLinearGradient(0,-h,0,h);gr.addColorStop(0,wet>.25?'#b2c7a5':(c.spec?.hi||'#91a488'));gr.addColorStop(.28,c.spec?.hi||'#81977d');gr.addColorStop(.58,c.spec?.color||'#4d6256');gr.addColorStop(1,'#1c2924');X.fillStyle=gr;X.strokeStyle='#0b110e';X.lineWidth=Math.max(1.2,1.6*z);
    X.beginPath();X.moveTo(-w*.98,h*.08);X.bezierCurveTo(-w*.92,-h*.72,-w*.55,-h*1.05,0,-h*1.08);X.bezierCurveTo(w*.58,-h*1.04,w*.94,-h*.67,w,h*.02);X.bezierCurveTo(w*.80,h*.78,w*.48,h*.90,0,h*.88);X.bezierCurveTo(-w*.46,h*.90,-w*.80,h*.72,-w*.98,h*.08);X.closePath();X.fill();X.stroke();
    X.strokeStyle='rgba(220,241,217,.16)';X.lineWidth=Math.max(.7,.8*z);for(let i=-3;i<=3;i++){const x=i*w*.23;X.beginPath();X.moveTo(x,-h*.82);X.quadraticCurveTo(x-w*.035,0,x,h*.64);X.stroke();}
    if(wet>.08){X.globalCompositeOperation='screen';X.strokeStyle=`rgba(227,249,236,${.05+wet*.16})`;X.lineWidth=Math.max(.9,1.2*z);X.beginPath();X.moveTo(-w*.68,-h*.56);X.quadraticCurveTo(0,-h*.93,w*.60,-h*.49);X.stroke();X.globalCompositeOperation='source-over';}
    if(inj){X.fillStyle='rgba(91,22,31,.62)';for(let i=0;i<Math.min(5,inj);i++){const xx=(hash(c.id*47+i*71)-.5)*w*1.2,yy=(hash(c.id*91+i*31)-.5)*h*.9;X.beginPath();X.ellipse(xx,yy,2.8*z,1.1*z,.4,0,Math.PI*2);X.fill();}}X.restore();
    const H=W(c.nodes[0]);for(const side of[-1,1]){const ex=H.x+f.fx*4*s*z+f.nx*side*7*s*z,eyy=H.y+f.fy*4*s*z+f.ny*side*7*s*z;X.strokeStyle=c.spec?.color||'#5a6d61';X.lineWidth=Math.max(1,1.4*z);X.beginPath();X.moveTo(H.x,H.y);X.lineTo(ex,eyy);X.stroke();X.fillStyle='#d7e0c8';X.beginPath();X.arc(ex,eyy,2.3*s*z,0,Math.PI*2);X.fill();X.fillStyle='#080b09';X.beginPath();X.arc(ex+f.fx*.8*z,eyy+f.fy*.8*z,1.1*s*z,0,Math.PI*2);X.fill();}
    if(c.v107){const J=W(c.v107.jaw),gape=c01(c.v107.gape||0);X.fillStyle='#170b0d';X.beginPath();X.ellipse(J.x,J.y,(3.0+gape*2.0)*s*z,(1.3+gape*1.8)*s*z,ang,0,Math.PI*2);X.fill();X.strokeStyle='#d7cab5';X.lineWidth=Math.max(.7,.8*z);for(const side of[-1,1]){X.beginPath();X.moveTo(J.x,J.y);X.lineTo(J.x+f.fx*4*s*z+f.nx*side*2.4*s*z,J.y+f.fy*4*s*z+f.ny*side*2.4*s*z);X.stroke();}}
  }
  const BASE_DRAW=drawCreature;
  drawCreature=function(c,t){if(c?.spec?.family!=='crab'){BASE_DRAW(c,t);return}const r=ensure(c);if(!r)return;shadow(c);for(const q of r.limbs)if(q.z<0)drawLeg(c,q);drawCrabShell(c,t);for(const q of r.limbs)if(q.z>=0)drawLeg(c,q);};

  function makeNoiseLoop(filterType,freq){
    if(!ctx)return null;const len=ctx.sampleRate*2,buf=ctx.createBuffer(1,len,ctx.sampleRate),d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=Math.random()*2-1;
    const src=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();src.buffer=buf;src.loop=true;filter.type=filterType;filter.frequency.value=freq;gain.gain.value=0;src.connect(filter).connect(gain).connect(master);src.start();return{src,gain,filter};
  }
  function ensureAudio(){
    if(ctx)return ctx;const AC=root.AudioContext||root.webkitAudioContext;if(!AC)return null;ctx=new AC();master=ctx.createGain();master.gain.value=audioEnabled?.55:0;master.connect(ctx.destination);const rain=makeNoiseLoop('highpass',1150),water=makeNoiseLoop('lowpass',520);rainGain=rain?.gain||null;waterGain=water?.gain||null;return ctx;
  }
  function playEvent(e){
    if(!audioEnabled||!ctx||ctx.state!=='running'||!master)return;const q=worldToScreen(e.x,e.y),screenD=Math.abs(q.x-SW*.5),g=acousticGain(e.intensity,screenD,SW*.9);if(g<.01)return;
    const osc=ctx.createOscillator(),gain=ctx.createGain(),pan=ctx.createStereoPanner?ctx.createStereoPanner():null,base=e.kind==='foot'?85:e.kind==='bite'?135:e.kind==='death'?48:180;osc.type=e.kind==='bite'?'sawtooth':'sine';osc.frequency.setValueAtTime(base,ctx.currentTime);osc.frequency.exponentialRampToValueAtTime(Math.max(28,base*.58),ctx.currentTime+.11);gain.gain.setValueAtTime(.0001,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(Math.max(.002,g*.18),ctx.currentTime+.008);gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.14);
    if(pan){pan.pan.value=Math.max(-1,Math.min(1,(q.x-SW*.5)/(SW*.5)));osc.connect(gain).connect(pan).connect(master)}else osc.connect(gain).connect(master);osc.start();osc.stop(ctx.currentTime+.16);
  }
  function ambient(){
    if(!ctx||ctx.state!=='running')return;const rain=c01(typeof weather!=='undefined'?(weather.rain||0):0);let water=0,flow=0,n=0;const F=root.GENESIS_FLUID_REFINEMENT;
    if(F?.sample&&typeof camera!=='undefined'){for(const ox of[-160,0,160])for(const oy of[-90,0,90]){const s=F.sample(camera.x+ox/Math.max(.5,camera.zoom),camera.y+oy/Math.max(.5,camera.zoom));water+=c01(s.water||0);flow+=Math.min(1,Math.hypot(s.vx||0,s.vy||0));n++;}}
    water=n?water/n:0;flow=n?flow/n:0;if(rainGain)rainGain.gain.setTargetAtTime(audioEnabled?rain*.11:0,ctx.currentTime,.18);if(waterGain)waterGain.gain.setTargetAtTime(audioEnabled?(water*.055+flow*.035):0,ctx.currentTime,.20);if(master)master.gain.setTargetAtTime(audioEnabled?.55:0,ctx.currentTime,.10);
  }
  function toggleAudio(){audioEnabled=!audioEnabled;const a=ensureAudio();if(a?.state==='suspended')a.resume();ambient();syncAudioButton();return audioEnabled;}
  function syncAudioButton(){const b=document.getElementById('mobAudio');if(b){b.textContent=audioEnabled?'♪':'×';b.dataset.on=audioEnabled?'1':'0';}}
  function installAudioButton(){const dock=document.getElementById('mobDock');if(!dock||document.getElementById('mobAudio'))return;const b=document.createElement('button');b.id='mobAudio';b.setAttribute('aria-label','Simulation sound');b.textContent='♪';b.onclick=()=>toggleAudio();dock.appendChild(b);const style=document.createElement('style');style.textContent='@media(max-width:760px){#mobDock{grid-template-columns:repeat(7,1fr)!important}#mobDock #mobAudio{font-size:17px}#mobDock button{min-width:0}}';document.head.appendChild(style);}
  installAudioButton();document.addEventListener('pointerdown',()=>{const a=ensureAudio();if(audioEnabled&&a?.state==='suspended')a.resume();},{passive:true});

  const BASE_STEP=typeof step==='function'?step:null;
  if(BASE_STEP)step=function(){BASE_STEP();for(let i=EVENTS.length-1;i>=0;i--){if(--EVENTS[i].life<=0)EVENTS.splice(i,1)}if(simTick%6===0)ambient();};

  root.GENESIS_RIG25_SOUND={...state,events:EVENTS,toggleAudio,audioEnabled:()=>audioEnabled,ensureAudio,debugEnsure:ensure,debugEmit:emit,metrics:()=>({events:EVENTS.length,audioEnabled,contextState:ctx?.state||'locked',approximation:'2D articulated physics + depth-order 2.5D presentation; procedural WebAudio from simulation events'})};syncAudioButton();
})(typeof window!=='undefined'?window:globalThis);
