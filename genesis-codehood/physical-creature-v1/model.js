'use strict';

export const FIXED_DT = 1 / 120;
export const GROUND_Y = 520;
export const NODE = Object.freeze({ PELVIS:0, TORSO:1, HEAD:2, LKNEE:3, LFOOT:4, RKNEE:5, RFOOT:6, JAW:7 });
export const NODE_NAMES = ['pelvis','torso','head','leftKnee','leftFoot','rightKnee','rightFoot','jaw'];

const TAU = Math.PI * 2;
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const hypot = Math.hypot;

function rng(seed=1){
  let s=seed>>>0 || 1;
  return ()=>{ s=(Math.imul(s,1664525)+1013904223)>>>0; return s/4294967296; };
}

function makeBody(seed=1){
  rng(seed); const n=8;
  const x=new Float64Array(n), y=new Float64Array(n), vx=new Float64Array(n), vy=new Float64Array(n);
  const fx=new Float64Array(n), fy=new Float64Array(n), mass=new Float64Array(n), radius=new Float64Array(n);
  const oldx=new Float64Array(n), oldy=new Float64Array(n);
  const integrity=new Float64Array(n), skinIntegrity=new Float64Array(n), fleshMass=new Float64Array(n), temperature=new Float64Array(n), hydration=new Float64Array(n), damage=new Float64Array(n);
  const baseX=150, baseY=GROUND_Y-76;
  const init=[
    [baseX,baseY+20,8,12], [baseX+2,baseY-12,8,9], [baseX+10,baseY-40,7,5],
    [baseX-9,baseY+47,5,4], [baseX-18,GROUND_Y-5,5,3], [baseX+11,baseY+47,5,4], [baseX+20,GROUND_Y-5,5,3],
    [baseX+18,baseY-34,4,1.2]
  ];
  for(let i=0;i<n;i++){
    x[i]=init[i][0]; y[i]=init[i][1]; radius[i]=init[i][2]; mass[i]=init[i][3];
    integrity[i]=1; skinIntegrity[i]=1; fleshMass[i]=mass[i]*.46; temperature[i]=37; hydration[i]=1;
  }
  const bones=[
    {a:NODE.PELVIS,b:NODE.TORSO,len:32,stiff:0.92,integrity:1,name:'spine'},
    {a:NODE.TORSO,b:NODE.HEAD,len:29,stiff:0.90,integrity:1,name:'neck'},
    {a:NODE.PELVIS,b:NODE.LKNEE,len:31,stiff:0.94,integrity:1,name:'leftFemur'},
    {a:NODE.LKNEE,b:NODE.LFOOT,len:29,stiff:0.94,integrity:1,name:'leftTibia'},
    {a:NODE.PELVIS,b:NODE.RKNEE,len:31,stiff:0.94,integrity:1,name:'rightFemur'},
    {a:NODE.RKNEE,b:NODE.RFOOT,len:29,stiff:0.94,integrity:1,name:'rightTibia'},
    {a:NODE.HEAD,b:NODE.JAW,len:9,stiff:0.80,integrity:1,name:'jawHinge'}
  ];
  const joints=[
    {name:'spineJoint',parent:NODE.PELVIS,joint:NODE.TORSO,child:NODE.HEAD,integrity:1,minAngle:.55,maxAngle:2.55},
    {name:'leftHip',parent:NODE.TORSO,joint:NODE.PELVIS,child:NODE.LKNEE,integrity:1,minAngle:.35,maxAngle:2.85},
    {name:'leftKnee',parent:NODE.PELVIS,joint:NODE.LKNEE,child:NODE.LFOOT,integrity:1,minAngle:.25,maxAngle:3.05},
    {name:'rightHip',parent:NODE.TORSO,joint:NODE.PELVIS,child:NODE.RKNEE,integrity:1,minAngle:.35,maxAngle:2.85},
    {name:'rightKnee',parent:NODE.PELVIS,joint:NODE.RKNEE,child:NODE.RFOOT,integrity:1,minAngle:.25,maxAngle:3.05},
    {name:'jawJoint',parent:NODE.TORSO,joint:NODE.HEAD,child:NODE.JAW,integrity:1,minAngle:.35,maxAngle:1.55}
  ];
  const muscles=[
    {name:'leftHipFlexor',joint:NODE.PELVIS,parent:NODE.TORSO,child:NODE.LKNEE,maxTorque:360,activation:0,side:'left'},
    {name:'leftHipExtensor',joint:NODE.PELVIS,parent:NODE.TORSO,child:NODE.LKNEE,maxTorque:-440,activation:0,side:'left'},
    {name:'leftKneeExtensor',joint:NODE.LKNEE,parent:NODE.PELVIS,child:NODE.LFOOT,maxTorque:310,activation:0,side:'left'},
    {name:'rightHipFlexor',joint:NODE.PELVIS,parent:NODE.TORSO,child:NODE.RKNEE,maxTorque:-360,activation:0,side:'right'},
    {name:'rightHipExtensor',joint:NODE.PELVIS,parent:NODE.TORSO,child:NODE.RKNEE,maxTorque:440,activation:0,side:'right'},
    {name:'rightKneeExtensor',joint:NODE.RKNEE,parent:NODE.PELVIS,child:NODE.RFOOT,maxTorque:-310,activation:0,side:'right'},
    {name:'jawCloser',joint:NODE.HEAD,parent:NODE.TORSO,child:NODE.JAW,maxTorque:-120,activation:0,side:'jaw'},
    {name:'trunkExtensor',joint:NODE.TORSO,parent:NODE.PELVIS,child:NODE.HEAD,maxTorque:210,activation:0,side:'trunk'}
  ];
  return {
    x,y,vx,vy,fx,fy,oldx,oldy,mass,radius,integrity,skinIntegrity,fleshMass,temperature,hydration,damage,bones,joints,muscles,
    bloodVolume:1, oxygenation:1, unconscious:false, alive:true,
    respiration:{type:'lungs',integrity:1,capacity:1,ventilation:1,oxygenReserve:1,hypoxiaSeconds:0},
    wounds:[], stomach:{contentsMass:0,digestibleEnergy:0,indigestibleMass:0,digestedEnergy:0},
    wasteMass:0, energy:58, maxEnergy:100,
    brain:{phase:0,gaitHz:1.25,desiredSpeed:1,stabilizerAssist:0.32,controller:'authored_oscillator_v1',mouthIntent:'OPEN',steps:0},
    causeOfDeath:null
  };
}

function makeFood(){
  return {x:185,y:GROUND_Y-8,vx:0,vy:0,radius:8,mass:1.5,digestibleEnergy:42,indigestibleMass:.18,active:true,captured:false,swallowing:false};
}

export function createWorld(seed=1){
  return {seed, time:0, stepCount:0, groundY:GROUND_Y, gravity:180, body:makeBody(seed), food:makeFood(), metrics:{mouthContacts:0,swallows:0,totalDigestedEnergy:0,distance:0}, initialPelvisX:150};
}

function addForce(b,i,fx,fy){ b.fx[i]+=fx; b.fy[i]+=fy; }

function jointTorque(b,parent,joint,child,torque){
  const jx=b.x[joint], jy=b.y[joint];
  let cx=b.x[child]-jx, cy=b.y[child]-jy, cl=hypot(cx,cy)||1;
  let px=b.x[parent]-jx, py=b.y[parent]-jy, pl=hypot(px,py)||1;
  cx/=cl; cy/=cl; px/=pl; py/=pl;
  const cfx=-cy*torque/cl, cfy=cx*torque/cl;
  const pfx= py*torque/pl, pfy=-px*torque/pl;
  addForce(b,child,cfx,cfy); addForce(b,parent,pfx,pfy); addForce(b,joint,-cfx-pfx,-cfy-pfy);
}

function angleAt(b,a,j,c){
  const ax=b.x[a]-b.x[j], ay=b.y[a]-b.y[j], cx=b.x[c]-b.x[j], cy=b.y[c]-b.y[j];
  const al=hypot(ax,ay)||1, cl=hypot(cx,cy)||1;
  return Math.acos(clamp((ax*cx+ay*cy)/(al*cl),-1,1));
}

function jointIntegrityForMuscle(b,m){
  if(m.side==='left') return Math.min(b.joints[1].integrity,b.joints[2].integrity);
  if(m.side==='right') return Math.min(b.joints[3].integrity,b.joints[4].integrity);
  if(m.side==='jaw') return b.joints[5].integrity;
  if(m.side==='trunk') return b.joints[0].integrity;
  return 1;
}

function functionalScale(b,m){
  let part=1;
  if(m.side==='left') part=Math.min(b.integrity[NODE.LKNEE],b.integrity[NODE.LFOOT]);
  else if(m.side==='right') part=Math.min(b.integrity[NODE.RKNEE],b.integrity[NODE.RFOOT]);
  else if(m.side==='jaw') part=Math.min(b.integrity[NODE.HEAD],b.integrity[NODE.JAW]);
  else if(m.side==='trunk') part=Math.min(b.integrity[NODE.PELVIS],b.integrity[NODE.TORSO]);
  const blood=clamp((b.bloodVolume-.08)/.62,0,1), energy=clamp(b.energy/18,0,1);
  return part*jointIntegrityForMuscle(b,m)*blood*energy*(b.unconscious?0:1)*(b.alive?1:0);
}

function controller(world){
  const b=world.body, brain=b.brain;
  brain.phase=(brain.phase+TAU*brain.gaitHz*FIXED_DT)%TAU;
  const s=Math.sin(brain.phase), leftStance=s>=0, rightStance=!leftStance;
  const M=b.muscles;
  M[0].activation=leftStance?.08:.78; M[1].activation=leftStance?.92:.04; M[2].activation=leftStance?.90:.22;
  M[3].activation=rightStance?.08:.78; M[4].activation=rightStance?.92:.04; M[5].activation=rightStance?.90:.22;
  M[7].activation=.72;
  const h=NODE.HEAD,j=NODE.JAW,f=world.food;
  const dx=f.active?f.x-b.x[h]:999, dy=f.active?f.y-b.y[h]:999, d=hypot(dx,dy);
  if(f.active && d<34 && dx>-10){ M[6].activation=d<20?.96:.12; brain.mouthIntent=d<20?'CLOSE':'OPEN'; }
  else { M[6].activation=.02; brain.mouthIntent='OPEN'; }
  if(!b.alive||b.unconscious) for(const m of b.muscles)m.activation=0;
}

function passiveAndMuscleForces(b){
  const trunkAngle=Math.atan2(b.x[NODE.HEAD]-b.x[NODE.PELVIS],-(b.y[NODE.HEAD]-b.y[NODE.PELVIS]));
  jointTorque(b,NODE.PELVIS,NODE.TORSO,NODE.HEAD,-trunkAngle*180*b.brain.stabilizerAssist);
  if(b.alive&&!b.unconscious){
    const targetY=GROUND_Y-60, err=b.y[NODE.PELVIS]-targetY;
    const assist=clamp(err*150 + b.vy[NODE.PELVIS]*36,-1400,8200)*b.brain.stabilizerAssist;
    addForce(b,NODE.PELVIS,0,-assist); addForce(b,NODE.TORSO,0,-assist*.28);
  }
  let a=angleAt(b,NODE.PELVIS,NODE.LKNEE,NODE.LFOOT), err=2.45-a; jointTorque(b,NODE.PELVIS,NODE.LKNEE,NODE.LFOOT,err*75);
  a=angleAt(b,NODE.PELVIS,NODE.RKNEE,NODE.RFOOT); err=2.45-a; jointTorque(b,NODE.PELVIS,NODE.RKNEE,NODE.RFOOT,-err*75);
  const jawA=angleAt(b,NODE.TORSO,NODE.HEAD,NODE.JAW), jawErr=1.22-jawA;
  jointTorque(b,NODE.TORSO,NODE.HEAD,NODE.JAW,jawErr*38);
  for(const m of b.muscles){
    const scale=functionalScale(b,m); if(scale<=0||m.activation<=0) continue;
    jointTorque(b,m.parent,m.joint,m.child,m.maxTorque*m.activation*scale);
  }
  const lm=b.muscles[1], rm=b.muscles[4];
  let foot=NODE.LFOOT,m=lm; if(b.y[foot]>=GROUND_Y-b.radius[foot]-.75){let scale=functionalScale(b,m),drive=185*m.activation*scale;addForce(b,NODE.PELVIS,drive,0);addForce(b,foot,-drive,0);}
  foot=NODE.RFOOT;m=rm; if(b.y[foot]>=GROUND_Y-b.radius[foot]-.75){let scale=functionalScale(b,m),drive=185*m.activation*scale;addForce(b,NODE.PELVIS,drive,0);addForce(b,foot,-drive,0);}
}

function groundContact(world,i){
  const b=world.body, yMax=world.groundY-b.radius[i];
  if(b.y[i]>yMax){
    b.y[i]=yMax;
    if(b.vy[i]>0)b.vy[i]=0;
    const foot=i===NODE.LFOOT||i===NODE.RFOOT;
    const integ=b.integrity[i];
    const mu=foot ? (7.5*integ+1.2) : 2.0;
    b.vx[i]*=Math.exp(-mu*FIXED_DT);
  }
}

function solveBone(b,bone){
  const a=bone.a,c=bone.b, dx=b.x[c]-b.x[a],dy=b.y[c]-b.y[a],d=hypot(dx,dy)||1;
  const target=bone.len, err=(d-target)/d*bone.stiff*bone.integrity;
  const wa=1/b.mass[a], wc=1/b.mass[c], sum=wa+wc, ax=dx*err*(wa/sum), ay=dy*err*(wa/sum), cx=dx*err*(wc/sum), cy=dy*err*(wc/sum);
  b.x[a]+=ax; b.y[a]+=ay; b.x[c]-=cx; b.y[c]-=cy;
}

function stepBody(world){
  const b=world.body, n=b.x.length;
  b.fx.fill(0);b.fy.fill(0);
  for(let i=0;i<n;i++){ b.fy[i]+=b.mass[i]*world.gravity; }
  passiveAndMuscleForces(b);
  const ox=b.oldx,oy=b.oldy;
  for(let i=0;i<n;i++){
    ox[i]=b.x[i];oy[i]=b.y[i];
    b.vx[i]+=b.fx[i]/b.mass[i]*FIXED_DT; b.vy[i]+=b.fy[i]/b.mass[i]*FIXED_DT;
    b.vx[i]*=.9992; b.vy[i]*=.9992;
    b.x[i]+=b.vx[i]*FIXED_DT; b.y[i]+=b.vy[i]*FIXED_DT;
    groundContact(world,i);
  }
  for(let k=0;k<7;k++){
    for(const bone of b.bones)solveBone(b,bone);
    for(let i=0;i<n;i++)groundContact(world,i);
  }
  for(let i=0;i<n;i++){
    b.vx[i]=(b.x[i]-ox[i])/FIXED_DT; b.vy[i]=(b.y[i]-oy[i])/FIXED_DT;
    if(!Number.isFinite(b.vx[i])||!Number.isFinite(b.vy[i])) throw new Error('non-finite body state');
  }
}

function stepFood(world){
  const f=world.food,b=world.body;if(!f.active)return;
  f.vy+=world.gravity*FIXED_DT;f.vx*=.998;f.vy*=.998;f.x+=f.vx*FIXED_DT;f.y+=f.vy*FIXED_DT;
  if(f.y+f.radius>world.groundY){f.y=world.groundY-f.radius;if(f.vy>0)f.vy=0;f.vx*=.93;}
  const hx=b.x[NODE.HEAD],hy=b.y[NODE.HEAD],jx=b.x[NODE.JAW],jy=b.y[NODE.JAW];
  const mx=(hx+jx)*.5,my=(hy+jy)*.5,md=hypot(f.x-mx,f.y-my);
  const jawGap=hypot(jx-hx,jy-hy);
  if(!f.captured && b.alive && md<f.radius+7 && jawGap<13 && b.brain.mouthIntent==='CLOSE'){
    f.captured=true;world.metrics.mouthContacts++;
  }
  if(f.captured){
    const tx=b.x[NODE.TORSO]+6,ty=b.y[NODE.TORSO]-12;
    const targetX=f.swallowing?tx:mx,targetY=f.swallowing?ty:my;
    const dx=targetX-f.x,dy=targetY-f.y;
    f.vx+=dx*18*FIXED_DT;f.vy+=dy*18*FIXED_DT;
    if(!f.swallowing && jawGap<12)f.swallowing=true;
    if(f.swallowing && hypot(f.x-tx,f.y-ty)<7){
      b.stomach.contentsMass+=f.mass;
      b.stomach.digestibleEnergy+=f.digestibleEnergy;
      b.stomach.indigestibleMass+=f.indigestibleMass;
      f.active=false;world.metrics.swallows++;
    }
  }
}

function physiology(world){
  const b=world.body;
  let muscleUse=0;for(const m of b.muscles)muscleUse+=m.activation*functionalScale(b,m);
  const metabolic=(.18+muscleUse*.028)*FIXED_DT;
  b.energy=Math.max(0,b.energy-metabolic);
  let bleed=0;for(const w of b.wounds){if(w.open&&w.bleedRate>0)bleed+=w.bleedRate;}
  b.bloodVolume=Math.max(0,b.bloodVolume-bleed*FIXED_DT);
  const lung=b.respiration;
  lung.ventilation=clamp(lung.integrity*(b.alive?1:0),0,1);
  const perfusion=clamp((b.bloodVolume-.04)/.76,0,1);
  const targetO2=lung.ventilation*perfusion;
  b.oxygenation+=clamp(targetO2-b.oxygenation,-.018,.012);
  lung.oxygenReserve=clamp(lung.oxygenReserve+(targetO2-lung.oxygenReserve)*.02,0,1);
  lung.hypoxiaSeconds=b.oxygenation<.14?lung.hypoxiaSeconds+FIXED_DT:Math.max(0,lung.hypoxiaSeconds-FIXED_DT*.5);
  b.unconscious=b.bloodVolume<.24 || b.energy<.7 || b.oxygenation<.12;
  if(b.stomach.contentsMass>0 && b.stomach.digestibleEnergy>0 && b.alive){
    const rate=Math.min(b.stomach.digestibleEnergy,3.2*FIXED_DT);
    b.stomach.digestibleEnergy-=rate;b.stomach.digestedEnergy+=rate;
    b.energy=Math.min(b.maxEnergy,b.energy+rate*.92);world.metrics.totalDigestedEnergy+=rate*.92;
    const massFrac=rate/42*1.5;b.stomach.contentsMass=Math.max(0,b.stomach.contentsMass-massFrac);
    const waste=massFrac*.12;b.wasteMass+=waste;
  }
  if(b.alive && b.bloodVolume<=.075){b.alive=false;b.causeOfDeath='circulatory_failure';}
  else if(b.alive && lung.hypoxiaSeconds>2.5){b.alive=false;b.causeOfDeath='respiratory_failure';}
  else if(b.alive && b.energy<=0){b.alive=false;b.causeOfDeath='energy_failure';}
}

export function applyDamage(world, partName, amount=0.35, bleedRate=0.02){
  const b=world.body, idx=NODE_NAMES.indexOf(partName);if(idx<0)throw new Error(`unknown body part ${partName}`);
  b.skinIntegrity[idx]=clamp(b.skinIntegrity[idx]-amount*1.15,0,1);
  b.fleshMass[idx]=Math.max(0,b.fleshMass[idx]-amount*b.mass[idx]*.08);
  b.integrity[idx]=clamp(b.integrity[idx]-amount,0,1);b.damage[idx]=1-b.integrity[idx];
  const effectiveBleed=bleedRate*(1+(1-b.skinIntegrity[idx])*.8);
  const wound={part:partName,node:idx,severity:amount,bleedRate:Math.max(0,effectiveBleed),open:effectiveBleed>0};b.wounds.push(wound);
  for(const bone of b.bones)if(bone.a===idx||bone.b===idx)bone.integrity=Math.min(bone.integrity,.35+b.integrity[idx]*.65);
  for(const joint of b.joints)if(joint.parent===idx||joint.joint===idx||joint.child===idx)joint.integrity=Math.min(joint.integrity,.40+b.integrity[idx]*.60);
  if(idx===NODE.TORSO)b.respiration.integrity=clamp(b.respiration.integrity-amount*.55,0,1);
  return wound;
}

export function healPart(world,partName,amount=.2){
  const b=world.body, idx=NODE_NAMES.indexOf(partName);if(idx<0)throw new Error(`unknown body part ${partName}`);
  b.integrity[idx]=clamp(b.integrity[idx]+amount,0,1);b.skinIntegrity[idx]=clamp(b.skinIntegrity[idx]+amount*.8,0,1);b.damage[idx]=1-b.integrity[idx];
  if(idx===NODE.TORSO)b.respiration.integrity=clamp(b.respiration.integrity+amount*.35,0,1);
  for(const w of b.wounds)if(w.node===idx){w.bleedRate*=.25;if(w.bleedRate<.001)w.open=false;}
}

export function placeFoodAt(world,x,y){const f=world.food;f.x=x;f.y=y;f.vx=f.vy=0;f.active=true;f.captured=f.swallowing=false;}
export function placeFoodInMouth(world){const b=world.body;placeFoodAt(world,(b.x[NODE.HEAD]+b.x[NODE.JAW])*.5,(b.y[NODE.HEAD]+b.y[NODE.JAW])*.5);b.brain.mouthIntent='CLOSE';const m=b.muscles.find(m=>m.name==='jawCloser');m.activation=1;}

export function stepWorld(world,steps=1){
  for(let s=0;s<steps;s++){
    world.stepCount++;world.time+=FIXED_DT;
    controller(world);stepBody(world);stepFood(world);physiology(world);
    world.metrics.distance=world.body.x[NODE.PELVIS]-world.initialPelvisX;
    world.body.brain.steps++;
  }
  return world;
}

export function simulateSeconds(world,seconds){return stepWorld(world,Math.round(seconds/FIXED_DT));}

export function snapshot(world){
  const b=world.body;
  return {
    time:+world.time.toFixed(6),pelvisX:+b.x[NODE.PELVIS].toFixed(6),pelvisY:+b.y[NODE.PELVIS].toFixed(6),
    energy:+b.energy.toFixed(6),blood:+b.bloodVolume.toFixed(6),oxygen:+b.oxygenation.toFixed(6),alive:b.alive,unconscious:b.unconscious,respiration:{...b.respiration},
    integrity:Array.from(b.integrity,x=>+x.toFixed(6)),stomach:{...b.stomach},food:{active:world.food.active,captured:world.food.captured,swallowing:world.food.swallowing,x:+world.food.x.toFixed(6),y:+world.food.y.toFixed(6)},metrics:{...world.metrics}
  };
}

export function invariants(world){
  const b=world.body, failures=[];
  for(let i=0;i<b.x.length;i++)if(![b.x[i],b.y[i],b.vx[i],b.vy[i],b.integrity[i],b.skinIntegrity[i],b.fleshMass[i],b.temperature[i],b.hydration[i]].every(Number.isFinite))failures.push(`nonfinite:${NODE_NAMES[i]}`);
  if(b.bloodVolume<0||b.bloodVolume>1)failures.push('blood_range');
  if(b.oxygenation<0||b.oxygenation>1)failures.push('oxygen_range');
  if(b.respiration.integrity<0||b.respiration.integrity>1)failures.push('lung_range');
  if(b.energy<0||b.energy>b.maxEnergy+1e-9)failures.push('energy_range');
  for(const bone of b.bones){const d=hypot(b.x[bone.b]-b.x[bone.a],b.y[bone.b]-b.y[bone.a]);if(Math.abs(d-bone.len)>3.5)failures.push(`bone:${bone.name}:${d.toFixed(2)}`);}
  if(b.stomach.contentsMass<-.0001||b.stomach.digestibleEnergy<-.0001)failures.push('stomach_negative');
  return {pass:failures.length===0,failures};
}
