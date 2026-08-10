// ---------------- adaptive cognition layer ----------------
// This module augments the existing Creature/Gene implementation without replacing
// the authored physics, anatomy, feeding, or evolution rules.

const MORPH_AI_STATES=['forage','hunt','scavenge','flee','school','rest','explore'];

function cognitionGeneDefaults(g){
  if(!Number.isFinite(g.curiosity))g.curiosity=rand(.2,1);
  if(!Number.isFinite(g.fearBias))g.fearBias=rand(.15,.95);
  if(!Number.isFinite(g.memorySpan))g.memorySpan=rand(2.5,10);
  if(!Number.isFinite(g.learningRate))g.learningRate=rand(.015,.09);
  if(!Number.isFinite(g.persistence))g.persistence=rand(.15,.95);
  if(!Number.isFinite(g.socialBias))g.socialBias=rand(0,1);
  if(!Number.isFinite(g.restBias))g.restBias=rand(0,.7);
  if(!Number.isFinite(g.ambush))g.ambush=rand(0,1);
  if(!Number.isFinite(g.riskTolerance))g.riskTolerance=rand(.1,.95);
  return g;
}

const MorphBaseGene=Gene;
Gene=class extends MorphBaseGene{
  constructor(copy=null){
    super(copy);
    cognitionGeneDefaults(this);
  }
};

const morphBaseMutateGene=mutateGene;
mutateGene=function(g,amt=1){
  const n=cognitionGeneDefaults(morphBaseMutateGene(g,amt));
  const t=(k,s,a,b,p=.24)=>{if(Math.random()<p*amt)n[k]=clamp(n[k]+gauss()*s*amt,a,b)};
  t('curiosity',.07,0,1);t('fearBias',.07,0,1);t('memorySpan',.65,.8,16);
  t('learningRate',.008,.004,.16);t('persistence',.07,0,1);t('socialBias',.07,0,1);
  t('restBias',.06,0,1);t('ambush',.07,0,1);t('riskTolerance',.07,0,1);
  return n;
};

const morphBaseCrossoverGene=crossoverGene;
crossoverGene=function(a,b){
  const n=cognitionGeneDefaults(morphBaseCrossoverGene(a,b));
  for(const k of ['curiosity','fearBias','memorySpan','learningRate','persistence','socialBias','restBias','ambush','riskTolerance']){
    if(Math.random()<.5&&Number.isFinite(b[k]))n[k]=b[k];
  }
  return n;
};

function creatureMass(c){
  return Math.max(1,c.g.segmentSize*c.g.segments*(1+.45*c.g.armor));
}

function targetAlive(t){
  return !!t && !t.dead;
}

class CognitiveMind{
  constructor(owner){
    this.owner=owner;
    cognitionGeneDefaults(owner.g);
    this.state='explore';
    this.stateTime=0;
    this.target=null;
    this.targetKind=null;
    this.targetLock=0;
    this.fear=0;
    this.hunger=0;
    this.fatigue=0;
    this.excitement=0;
    this.lastEnergy=owner.energy;
    this.lastHealth=owner.health;
    this.lastEaten=owner.eaten||0;
    this.lastKids=owner.kids||0;
    this.foodMemory=null;
    this.threatMemory=null;
    this.carcassMemory=null;
    this.socialMemory=null;
    this.values=Object.fromEntries(MORPH_AI_STATES.map(s=>[s,0]));
    this.visited=new Map();
    this.exploreAngle=owner.angle||0;
    this.exploreTimer=0;
    this.stateChanges=0;
    this.totalReward=0;
    this.lastReward=0;
  }

  remember(slot,obj,ttl){
    if(!obj)return;
    this[slot]={x:obj.x,y:obj.y,expires:time+ttl,ref:obj};
  }

  validMemory(slot){
    const m=this[slot];
    if(!m||m.expires<time){this[slot]=null;return null}
    if(m.ref&&!m.ref.dead){m.x=m.ref.x;m.y=m.ref.y}
    return m;
  }

  visit(){
    const c=CFG.CELL||220;
    const ix=Math.floor(this.owner.x/c),iy=Math.floor(this.owner.y/c),k=ix+','+iy;
    this.visited.set(k,(this.visited.get(k)||0)+1);
    if(this.visited.size>64){
      let oldest=null,min=Infinity;
      for(const [key,v] of this.visited){if(v<min){min=v;oldest=key}}
      if(oldest!==null)this.visited.delete(oldest);
    }
  }

  chooseExploreAngle(){
    const c=CFG.CELL||220,ox=this.owner.x,oy=this.owner.y;
    let bestA=this.exploreAngle,bestScore=Infinity;
    for(let i=0;i<8;i++){
      const a=i/8*TAU;
      const x=ox+Math.cos(a)*c*1.5,y=oy+Math.sin(a)*c*1.5;
      const k=Math.floor(x/c)+','+Math.floor(y/c);
      const score=(this.visited.get(k)||0)+Math.random()*.35;
      if(score<bestScore){bestScore=score;bestA=a}
    }
    this.exploreAngle=bestA;
    this.exploreTimer=.8+this.owner.g.persistence*2.5;
  }

  observe(dt){
    const o=this.owner,g=o.g;
    this.hunger=clamp((115-o.energy)/95,0,1);
    const speed=Math.hypot(o.vx,o.vy);
    this.fatigue=clamp((speed/(1.4+g.muscle*1.5))*.6+(1-o.health)*.7,0,1);

    const baseFood=morphBaseNearestFood.call(o);
    if(baseFood)this.remember('foodMemory',baseFood,g.memorySpan);

    const baseCarcass=morphBaseNearestCarcass?morphBaseNearestCarcass.call(o):null;
    if(baseCarcass)this.remember('carcassMemory',baseCarcass,g.memorySpan*.8);

    const nearby=nearbyLife(o,g.sensor);
    let threat=null,threatScore=0;
    let social=null,socialScore=Infinity;
    const ownMass=creatureMass(o);
    for(const c of nearby){
      const d=norm(c.x-o.x,c.y-o.y);
      const ratio=creatureMass(c)/ownMass;
      const danger=(c.g.carnivore||0)*(c.g.aggression||0)*clamp(ratio,.35,2.4)*(1-d.m/Math.max(1,g.sensor));
      if(danger>threatScore){threatScore=danger;threat=c}

      const similarity=Math.abs((c.g.hue||0)-(g.hue||0))/180+Math.abs((c.g.segments||0)-(g.segments||0))*.08;
      if(similarity<socialScore){socialScore=similarity;social=c}
    }
    this.fear=clamp(threatScore*1.4+g.fearBias*(1-g.riskTolerance)*.22+(1-o.health)*.65,0,1);
    if(threat)this.remember('threatMemory',threat,g.memorySpan*.65);
    if(social)this.remember('socialMemory',social,g.memorySpan*.5);

    this.visit();
    this.exploreTimer-=dt;
    if(this.exploreTimer<=0)this.chooseExploreAngle();

    return {food:baseFood,carcass:baseCarcass,threat,social,nearby};
  }

  scoreStates(obs){
    const o=this.owner,g=o.g;
    const health=o.health;
    const hasFood=obs.food?1:(this.validMemory('foodMemory')?0.5:0);
    const hasCarcass=obs.carcass?1:(this.validMemory('carcassMemory')?0.45:0);
    const hasThreat=obs.threat?1:(this.validMemory('threatMemory')?0.45:0);
    const socialCount=obs.nearby.length;
    const currentBonus=g.persistence*(this.stateTime>0?0.32:0);

    const scores={
      flee:this.fear*2.35+hasThreat*.45+(1-health)*.95+g.fearBias*.25,
      hunt:this.hunger*g.carnivore*(.75+g.aggression)*1.55+g.ambush*.18+this.values.hunt-(1-health)*.8-this.fear*.7,
      scavenge:this.hunger*g.carnivore*.95+hasCarcass*.9+this.values.scavenge-this.fear*.35,
      forage:this.hunger*(1-g.carnivore*.52)*(1.1+hasFood*.6)+this.values.forage-this.fear*.25,
      school:g.socialBias*g.schooling*(.5+Math.min(1,socialCount/4))+.45*this.fear+this.values.school,
      rest:this.fatigue*.9+g.restBias*.45+(o.energy>95?.2:0)+this.values.rest-this.hunger*.6-this.fear,
      explore:g.curiosity*(.65+(hasFood+hasCarcass===0?.35:0))+this.values.explore-this.fear*.4
    };
    if(this.state in scores)scores[this.state]+=currentBonus;
    return scores;
  }

  pickState(obs){
    const scores=this.scoreStates(obs);
    let best=this.state,bestScore=-Infinity;
    for(const s of MORPH_AI_STATES){
      let q=scores[s];
      if(s==='hunt'&&this.owner.g.carnivore<.34)q-=1.2;
      if(s==='scavenge'&&this.owner.g.carnivore<.2)q-=1;
      if(q>bestScore){bestScore=q;best=s}
    }
    if(best!==this.state){this.state=best;this.stateChanges++}
    this.stateTime=.45+this.owner.g.persistence*2.7;

    if(best==='hunt')this.setTarget(obs.threat&&this.owner.g.riskTolerance<.35?null:this.findPrey(obs.nearby),'prey');
    else if(best==='flee')this.setTarget(obs.threat||this.validMemory('threatMemory')?.ref,'threat');
    else if(best==='forage')this.setTarget(obs.food,'food');
    else if(best==='scavenge')this.setTarget(obs.carcass,'carcass');
    else if(best==='school')this.setTarget(obs.social,'social');
    else this.setTarget(null,null);
  }

  findPrey(arr){
    const o=this.owner,own=creatureMass(o),g=o.g;
    let best=null,bestScore=-Infinity;
    for(const c of arr){
      if(c.dead)continue;
      const d=norm(c.x-o.x,c.y-o.y),ratio=creatureMass(c)/own;
      const vulnerability=(1-c.health)+(.7-(c.g.armor||0))*.35;
      const payoff=creatureMass(c)/Math.max(1,d.m);
      const risk=Math.max(0,ratio-1)*(.8-g.riskTolerance);
      const score=payoff*.06+vulnerability-risk;
      if(score>bestScore){bestScore=score;best=c}
    }
    return best;
  }

  setTarget(t,kind){
    this.target=t||null;
    this.targetKind=t?kind:null;
    this.targetLock=t?.dead?0:(.6+this.owner.g.persistence*3.5);
  }

  learn(){
    const o=this.owner,g=o.g;
    const de=o.energy-this.lastEnergy;
    const dh=o.health-this.lastHealth;
    const eaten=(o.eaten||0)-this.lastEaten;
    const kids=(o.kids||0)-this.lastKids;
    let reward=de*.025+dh*14+eaten*1.4+kids*4;
    reward=clamp(reward,-2.5,4);
    const lr=g.learningRate;
    this.values[this.state]=clamp(this.values[this.state]+lr*(reward-this.values[this.state]),-1.5,1.5);
    this.totalReward+=reward;
    this.lastReward=reward;
    this.lastEnergy=o.energy;this.lastHealth=o.health;this.lastEaten=o.eaten||0;this.lastKids=o.kids||0;
  }

  steerToward(x,y,strength,lead=0){
    const o=this.owner;
    const dx=x-o.x,dy=y-o.y;
    if(!Number.isFinite(dx+dy))return;
    const desired=Math.atan2(dy,dx);
    const d=angleDelta(o.angle,desired);
    o.turnVel+=clamp(d,-.65,.65)*strength;
    o.angle+=clamp(d,-.25,.25)*strength*.25;
    if(lead){
      o.vx+=Math.cos(desired)*strength*lead;
      o.vy+=Math.sin(desired)*strength*lead;
    }
  }

  applyState(dt,obs){
    const o=this.owner,g=o.g;
    this.targetLock-=dt;
    this.stateTime-=dt;
    if(this.target?.dead||this.targetLock<=0)this.target=null;

    if(this.stateTime<=0||(!this.target&&['hunt','flee','forage','scavenge','school'].includes(this.state)))this.pickState(obs);

    if(this.state==='flee'){
      const m=this.validMemory('threatMemory');
      const t=targetAlive(this.target)?this.target:m;
      if(t){
        const tx=t.x??m?.x,ty=t.y??m?.y;
        const awayX=o.x-(tx-o.x),awayY=o.y-(ty-o.y);
        this.steerToward(awayX,awayY,.10+.13*this.fear,.08);
        o.startle=Math.max(o.startle||0,.35+.55*this.fear);
      }
    }else if(this.state==='hunt'){
      let t=targetAlive(this.target)?this.target:null;
      if(!t){t=this.findPrey(obs.nearby);if(t)this.setTarget(t,'prey')}
      if(t){
        const d=norm(t.x-o.x,t.y-o.y);
        const lead=clamp(d.m/Math.max(.4,Math.hypot(o.vx,o.vy)+1),0,1.4);
        const px=t.x+(t.vx||0)*lead*12,py=t.y+(t.vy||0)*lead*12;
        const ambush=g.ambush*(d.m<g.sensor*.45?1:0);
        this.steerToward(px,py,.055+.085*g.aggression,.04*(1-ambush*.65));
        if(ambush>.55&&d.m>o.g.segmentSize*2.2){o.vx*=.988;o.vy*=.988}
      }
    }else if(this.state==='forage'){
      const t=targetAlive(this.target)?this.target:null;
      const m=this.validMemory('foodMemory');
      if(t)this.steerToward(t.x,t.y,.07+.05*this.hunger,.035);
      else if(m)this.steerToward(m.x,m.y,.055,.025);
    }else if(this.state==='scavenge'){
      const t=targetAlive(this.target)?this.target:null;
      const m=this.validMemory('carcassMemory');
      if(t)this.steerToward(t.x,t.y,.075+.05*this.hunger,.03);
      else if(m)this.steerToward(m.x,m.y,.05,.02);
    }else if(this.state==='school'){
      const group=obs.nearby.slice(0,8);
      if(group.length){
        let cx=0,cy=0,hx=0,hy=0;
        for(const c of group){cx+=c.x;cy+=c.y;hx+=Math.cos(c.angle||0);hy+=Math.sin(c.angle||0)}
        cx/=group.length;cy/=group.length;
        const cohesion=.025+.04*g.schooling;
        this.steerToward(cx,cy,cohesion,.02);
        const align=Math.atan2(hy,hx),d=angleDelta(o.angle,align);
        o.turnVel+=d*.02*g.schooling;
      }
    }else if(this.state==='rest'){
      o.vx*=.975;o.vy*=.975;o.turnVel*=.8;
    }else{
      const tx=o.x+Math.cos(this.exploreAngle)*g.sensor,ty=o.y+Math.sin(this.exploreAngle)*g.sensor;
      this.steerToward(tx,ty,.025+.045*g.curiosity,.015);
    }

    this.excitement=lerp(this.excitement,clamp(this.fear+this.hunger*.45+Math.max(0,this.lastReward)*.25,0,1),.08);
  }
}

function ensureMind(c){
  if(!c.mind)c.mind=new CognitiveMind(c);
  return c.mind;
}

const morphBaseNearestFood=Creature.prototype.nearestFood;
const morphBaseNearestCreature=Creature.prototype.nearestCreature;
const morphBaseNearestCarcass=Creature.prototype.nearestCarcass||null;

Creature.prototype.nearestFood=function(){
  const m=ensureMind(this);
  if(m.state==='forage'&&targetAlive(m.target)&&m.targetKind==='food')return m.target;
  return morphBaseNearestFood.call(this);
};
Creature.prototype.nearestCreature=function(){
  const m=ensureMind(this);
  if(['hunt','flee','school'].includes(m.state)&&targetAlive(m.target)&&['prey','threat','social'].includes(m.targetKind))return m.target;
  return morphBaseNearestCreature.call(this);
};
if(morphBaseNearestCarcass){
  Creature.prototype.nearestCarcass=function(){
    const m=ensureMind(this);
    if(m.state==='scavenge'&&targetAlive(m.target)&&m.targetKind==='carcass')return m.target;
    return morphBaseNearestCarcass.call(this);
  };
}

const morphBaseCreatureUpdate=Creature.prototype.update;
Creature.prototype.update=function(dt){
  const mind=ensureMind(this);
  const obs=mind.observe(dt);
  morphBaseCreatureUpdate.call(this,dt);
  if(!this.dead){
    mind.learn();
    mind.applyState(dt,obs);
  }
};

const morphBaseCreatureDraw=Creature.prototype.draw;
Creature.prototype.draw=function(){
  morphBaseCreatureDraw.call(this);
  if(!this.mind||cam.z<.22)return;
  const p=ws(this.x,this.y),r=Math.max(1.5,this.g.segmentSize*cam.z*.18);
  const hue=this.mind.state==='flee'?350:this.mind.state==='hunt'?18:this.mind.state==='school'?195:this.mind.state==='rest'?150:this.g.hue+35;
  ctx.save();ctx.globalCompositeOperation='lighter';ctx.fillStyle=`hsla(${hue},90%,65%,${.03+.12*this.mind.excitement})`;
  ctx.beginPath();ctx.arc(p.x,p.y,r*(1+.25*Math.sin(time*3+this.phase)),0,TAU);ctx.fill();ctx.restore();
};

const morphBaseUpdateHUD=updateHUD;
updateHUD=function(){
  morphBaseUpdateHUD();
  const counts=Object.fromEntries(MORPH_AI_STATES.map(s=>[s,0]));
  let reward=0,minds=0;
  for(const c of creatures){if(c.mind){counts[c.mind.state]++;reward+=c.mind.totalReward;minds++}}
  hud.innerHTML+='<br>AI FLEE '+counts.flee+' · HUNT '+counts.hunt+' · FORAGE '+counts.forage+' · SCHOOL '+counts.school+
    '<br>SCAV '+counts.scavenge+' · EXPLORE '+counts.explore+' · REST '+counts.rest+' · LEARN '+(minds?reward/minds:0).toFixed(1);
};
