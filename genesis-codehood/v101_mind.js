/* GENESIS v101 - UNCANNY CREATURE MINDS
   Goal: creatures feel slow, uncertain, observant and individually strange.
   No weather-driven decision tree. Perception is noisy, memory decays, choices have hysteresis. */
(function(){
'use strict';
const U=clamp;
const cdist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function mhash(id,s=0){return hash((id*73856093+s*19349663)|0)}
function ensureMind(c){
  if(c.mind)return c.mind;
  const g=c.g||{};
  c.mind={
    curiosity:U(.18+mhash(c.id,1)*.82,0,1),
    patience:U(.12+mhash(c.id,2)*.88,0,1),
    territorial:U(.10+mhash(c.id,3)*.90,0,1),
    suspicion:U(.15+mhash(c.id,4)*.85,0,1),
    bold:U(.18+(g.aggression||1)*.32+(g.stamina||1)*.18-(g.fear||1)*.22+mhash(c.id,5)*.20,0,1),
    nerves:U(.18+(g.fear||1)*.42+mhash(c.id,6)*.35,0,1),
    fixation:U(.12+mhash(c.id,7)*.88,0,1),
    corpseInterest:U(.05+mhash(c.id,8)*.95,0,1),
    arousal:0, fatigue:0, uncertainty:.35, nextThink:0,
    focusId:null, lastSeen:null, memories:[], mood:'CALM',
    feintCooldown:0, circleSide:mhash(c.id,9)<.5?-1:1,
    idleAnchor:{x:c.homeX||c.center().x,y:c.center().y},
    stareUntil:0, lastState:'ROAM', repetitions:0
  };
  return c.mind;
}
function addMemory(c,type,p,strength=.7,entity=null){
  const m=ensureMind(c),now=simTick;
  let old=null;
  if(entity)old=m.memories.find(x=>x.entityId===entity.id&&x.type===type);
  if(old){old.x=p.x;old.y=p.y;old.strength=Math.max(old.strength,strength);old.tick=now;return old}
  const item={type,x:p.x,y:p.y,strength,entityId:entity?.id??null,tick:now};
  m.memories.unshift(item);if(m.memories.length>14)m.memories.length=14;return item;
}
function decayMind(c){
  const m=ensureMind(c);
  m.arousal*=.985;m.fatigue=U(m.fatigue*.995+(c.energy<35?.004:.0004),0,1);
  m.feintCooldown=Math.max(0,m.feintCooldown-1);
  for(const x of m.memories)x.strength*=.985;
  m.memories=m.memories.filter(x=>x.strength>.05&&simTick-x.tick<2400);
}
function movingNoise(o){
  if(!o?.nodes?.length)return 0;const n=o.nodes[0],v=Math.hypot(n.x-n.px,n.y-n.py);return v*(o.g?.size||1);
}
function visibleTo(c,o,maxR){
  if(!o)return false;const a=c.head?c.head():c.center(),b=o.head?o.head():o.center(),d=cdist(a,b);if(d>maxR)return false;
  const front=(b.x-a.x)*(c.face||1);const peripheral=front>=-45||ensureMind(c).suspicion>.72;
  return peripheral&&lineClear(a,b);
}
function senseWorld(c){
  const m=ensureMind(c),q=c.center(),vision=(c.g?.vision||1)*410;
  let nearestThreat=null,nearestPrey=null,nearestCorpse=null,nearestKin=null;
  let dt=1e9,dp=1e9,dc=1e9,dk=1e9;
  for(const o of creatures){
    if(o===c||o.gone)continue;const oq=o.center(),d=cdist(q,oq);
    if(!o.alive){if(d<dc&&d<vision*.82){dc=d;nearestCorpse=o}continue}
    if(o.spec?.role==='pred'&&c.spec?.role!=='pred'&&d<dt&&visibleTo(c,o,vision)){dt=d;nearestThreat=o}
    const edible=(c.spec?.role==='pred'&&(o.spec?.role==='herb'||(o.spec?.small&&!o.spec?.intelligent)));
    if(edible&&d<dp&&visibleTo(c,o,vision*1.05)){dp=d;nearestPrey=o}
    if(o.spec?.family===c.spec?.family&&d<dk){dk=d;nearestKin=o}
    const noise=movingNoise(o);
    if(noise>.8&&d<(120+noise*80)*(0.7+m.suspicion*.6)&&!visibleTo(c,o,vision*.7)&&rnd()<.18){
      const error=30+(1-m.suspicion)*85;
      addMemory(c,'SOUND',{x:oq.x+(rnd()-.5)*error,y:oq.y+(rnd()-.5)*error},.35+.25*m.suspicion,o);
    }
  }
  if(nearestThreat){addMemory(c,'THREAT',nearestThreat.center(),1,nearestThreat);m.arousal=U(m.arousal+.28,0,1);m.lastSeen=nearestThreat.center()}
  if(nearestPrey){addMemory(c,'PREY',nearestPrey.center(),.95,nearestPrey);m.lastSeen=nearestPrey.center()}
  if(nearestCorpse&&visibleTo(c,nearestCorpse,vision*.8))addMemory(c,'CORPSE',nearestCorpse.center(),.65,nearestCorpse);
  return{q,vision,threat:nearestThreat,threatD:dt,prey:nearestPrey,preyD:dp,corpse:nearestCorpse,corpseD:dc,kin:nearestKin,kinD:dk};
}
function rememberedPoint(c,types){
  const m=ensureMind(c),r=m.memories.filter(x=>types.includes(x.type)).sort((a,b)=>b.strength-a.strength)[0];
  if(!r)return null;
  const error=(1-r.strength)*95;
  return{x:r.x+(rnd()-.5)*error,y:r.y+(rnd()-.5)*error,memory:r};
}
function setState(c,state,target=null,minT=80,maxT=240){
  const m=ensureMind(c);if(m.lastState===state)m.repetitions++;else m.repetitions=0;
  m.lastState=state;c.state=state;c.aiTarget=target;c.stateT=minT+Math.floor(rnd()*Math.max(1,maxT-minT));m.nextThink=simTick+c.stateT;
}
function softChoice(items){
  let best=null,bestScore=-1e9;
  for(const it of items){const temperature=it.temp??.28;const noise=(rnd()+rnd()+rnd()-1.5)*temperature;const score=it.u+noise;if(score>bestScore){bestScore=score;best=it}}
  return best;
}
function choosePredator(c,s){
  const m=ensureMind(c),hunger=U((76-c.energy)/60,0,1),pain=U((100-c.health)/65,0,1);
  if(s.prey){
    const d=s.preyD,close=U(1-d/240,0,1),seen=s.prey;
    const items=[
      {state:'WATCH',target:seen,u:.28+m.patience*.60+m.suspicion*.25-close*.15,min:100,max:360},
      {state:'STALK',target:seen,u:.24+hunger*.75+m.fixation*.40+close*.10,min:90,max:260},
      {state:'CIRCLE',target:seen,u:.16+m.curiosity*.46+m.patience*.30+(1-close)*.22,min:80,max:220},
      {state:'POUNCE',target:seen,u:-.10+hunger*.55+m.bold*.48+close*.72-pain*.5,min:30,max:80},
      {state:'FEINT',target:seen,u:m.feintCooldown>0?-2:.05+m.bold*.35+m.curiosity*.45+close*.28-hunger*.08,min:32,max:75},
      {state:'BREAK',target:null,u:.05+pain*.8+m.uncertainty*.35-hunger*.3,min:80,max:210}
    ];
    const pick=softChoice(items);if(pick.state==='FEINT')m.feintCooldown=500+Math.floor(rnd()*900);setState(c,pick.state,pick.target,pick.min,pick.max);return;
  }
  const mem=rememberedPoint(c,['PREY','SOUND']);
  if(mem&&mem.memory.strength>.18&&rnd()<.55+m.fixation*.3){setState(c,rnd()<m.suspicion?'INVESTIGATE':'SEARCH',mem,100,320);return}
  if(s.corpse&&hunger>.48&&m.corpseInterest>.25){setState(c,'GUARD_CORPSE',s.corpse,120,360);return}
  if(rnd()<.20+m.patience*.35)setState(c,'STILL',null,110,420);else setState(c,'ROAM',null,90,300);
}
function chooseHerb(c,s){
  const m=ensureMind(c),hunger=U((80-c.energy)/65,0,1),pain=U((100-c.health)/70,0,1);
  if(s.threat){
    const close=U(1-s.threatD/260,0,1);
    const pick=softChoice([
      {state:'FREEZE',target:s.threat,u:.22+m.nerves*.62+(1-close)*.28-m.bold*.2,min:45,max:190},
      {state:'WATCH',target:s.threat,u:.18+m.suspicion*.55+(1-close)*.35,min:50,max:170},
      {state:'FLEE',target:s.threat,u:.12+close*.95+m.nerves*.50+pain*.25,min:60,max:180},
      {state:'FALSE_CALM',target:s.threat,u:.04+m.bold*.45+(1-close)*.18,min:70,max:220}
    ]);
    setState(c,pick.state,pick.target,pick.min,pick.max);return;
  }
  const oldThreat=rememberedPoint(c,['THREAT']);
  if(oldThreat&&oldThreat.memory.strength>.25&&rnd()<m.suspicion*.65){setState(c,'LISTEN',oldThreat,80,240);return}
  if(hunger>.35){const p=nearestPlant(c,(c.g?.vision||1)*300);if(p){setState(c,'FORAGE',p,90,240);return}}
  if(s.kin&&s.kinD<160&&rnd()<.12){setState(c,'SHADOW',s.kin,90,260);return}
  if(rnd()<.25+m.patience*.30)setState(c,'STILL',null,100,380);else setState(c,'ROAM',null,100,320);
}
function chooseScav(c,s){
  const m=ensureMind(c),hunger=U((72-c.energy)/60,0,1);
  if(s.threat&&s.threatD<210&&m.bold<.62){setState(c,'EVADE',s.threat,70,170);return}
  if(s.corpse&&s.corpseD<360&&(hunger>.2||m.corpseInterest>.45)){
    if(s.corpseD<80&&rnd()<m.territorial*.55)setState(c,'GUARD_CORPSE',s.corpse,120,320);
    else setState(c,'SCAVENGE',s.corpse,100,260);return;
  }
  const mem=rememberedPoint(c,['CORPSE','SOUND']);
  if(mem&&rnd()<.4+m.curiosity*.45){setState(c,'INVESTIGATE',mem,100,300);return}
  if(rnd()<.3)setState(c,'ROOT_AROUND',null,100,340);else setState(c,'ROAM',null,100,300);
}
function chooseIntelligent(c,s){
  const m=ensureMind(c),hunger=U((68-c.energy)/55,0,1);
  if(s.threat&&s.threatD<260){
    if(m.bold<.55)setState(c,rnd()<.5?'FREEZE':'EVADE',s.threat,60,180);
    else setState(c,'WATCH',s.threat,80,220);return;
  }
  if(c.spec.weaver){const web=nearbyStructure(c,'web',180),caught=web?.caught?.find(f=>f.alive);if(caught){setState(c,'FEED_WEB',caught,90,190);return}if(c.inventory.silk>=4&&!web&&c.buildCooldown<=0&&rnd()<.7){setState(c,'WEAVE',nearestFly(c,320,true)||nearestPlant(c,280),120,260);return}}
  if(c.spec.netter){const net=nearbyStructure(c,'net',220),caught=net?.caught?.find(f=>f.alive);if(caught){setState(c,'HARVEST_NET',caught,80,180);return}if(c.inventory.fiber>=5&&!net&&c.buildCooldown<=0&&rnd()<.7){setState(c,'BUILD_NET',nearestFly(c,340,true)||nearestPlant(c,300),120,260);return}}
  if(c.spec.builder&&c.inventory.fiber>=6&&!nearbyStructure(c,'shelter',240)&&c.buildCooldown<=0&&rnd()<.55){setState(c,'BUILD_SHELTER',null,130,280);return}
  if(c.inventory.fiber<5){const p=nearestPlant(c,260);if(p&&rnd()<.75){setState(c,'GATHER',p,100,240);return}}
  if(hunger>.45){const p=nearestPlant(c,240);if(p){setState(c,'FORAGE',p,100,220);return}}
  const sound=rememberedPoint(c,['SOUND','CORPSE']);
  if(sound&&rnd()<m.curiosity*.6){setState(c,'INVESTIGATE',sound,100,300);return}
  if(s.kin&&s.kinD<140&&rnd()<.16+m.curiosity*.12)setState(c,'OBSERVE_KIN',s.kin,80,260);
  else if(rnd()<.24+m.patience*.28)setState(c,'STILL',null,100,360);
  else setState(c,'ROAM',null,100,320);
}
chooseAI=function(c){
  if(!c.alive)return;if(c.stun>0||c.trapped>0){c.state='STUN';return}
  const m=ensureMind(c);decayMind(c);const s=senseWorld(c);
  const targetDead=c.aiTarget&&c.aiTarget.alive===false&&['STALK','POUNCE','WATCH','FEINT','FLEE','EVADE'].includes(c.state);
  if(simTick<m.nextThink&&!targetDead)return;
  m.uncertainty=U(m.uncertainty*.82+(rnd()*.35)+(m.arousal*.18),0,1);
  if(c.spec?.intelligent)chooseIntelligent(c,s);
  else if(c.spec?.role==='pred')choosePredator(c,s);
  else if(c.spec?.role==='herb')chooseHerb(c,s);
  else chooseScav(c,s);
};
desiredMotion=function(c){
  const m=ensureMind(c),q=c.center(),t=c.aiTarget;let dx=c.face||1,dy=0,speed=(c.spec.baseSpeed||.3)*(c.g.speed||1);
  const tp=t?(t.center?t.center():t):null;
  if(tp){const delta=tp.x-q.x;dx=Math.sign(delta)||c.face;dy=U((tp.y-q.y)/120,-1,1)}
  const state=c.state;
  if(['STILL','FREEZE','LISTEN','WATCH','FALSE_CALM','OBSERVE_KIN'].includes(state))speed=0;
  else if(state==='STALK')speed*=.42+.18*m.patience;
  else if(state==='SEARCH'||state==='INVESTIGATE')speed*=.55+.25*m.curiosity;
  else if(state==='CIRCLE'){
    if(tp){const offset=75+70*m.suspicion;const wanted=tp.x+m.circleSide*offset;dx=Math.sign(wanted-q.x)||c.face;if(Math.abs(wanted-q.x)<20&&rnd()<.03)m.circleSide*=-1}speed*=.5;
  }
  else if(state==='FEINT')speed*=1.28;
  else if(state==='BREAK') {dx=-c.face;speed*=.72;}
  else if(state==='FLEE'||state==='EVADE') {if(tp)dx=Math.sign(q.x-tp.x)||c.face;speed*=1.20+(.38*m.nerves);}
  else if(state==='FALSE_CALM')speed*=.08;
  else if(state==='GUARD_CORPSE'){
    if(tp){const d=tp.x-q.x;if(Math.abs(d)>45)dx=Math.sign(d);else dx=-Math.sign(d||c.face);}speed*=.28;
  }
  else if(state==='ROOT_AROUND') {dx=(Math.sin((simTick+c.id*19)*.015)>0?1:-1);speed*=.22;}
  else if(state==='SHADOW') speed*=.48;
  else if(state==='POUNCE') speed*=1.72;
  else if(state==='ROAM'){
    if(((simTick+c.id*37)%240)<55)speed*=.08;
    if(((simTick+c.id*13)%510)===0)c.face*=-1;
  }
  if(tp&&speed>0)c.face=dx||c.face;
  dy+=Math.sin(simTick*.037+c.id)*m.arousal*.06;
  return{dx,dy,speed};
};
const oldHandleInteractions=handleInteractions;
handleInteractions=function(c){
  const state=c.state;
  if(c.spec?.role==='pred'&&['WATCH','CIRCLE','FEINT','SEARCH','INVESTIGATE','BREAK','STILL'].includes(state)){
    const saved=c.state;c.state='UNCANNY_PASSIVE';oldHandleInteractions(c);c.state=saved;
  }else oldHandleInteractions(c);
};
window.GENESIS_MIND_VERSION='v101-uncanny';
})();
