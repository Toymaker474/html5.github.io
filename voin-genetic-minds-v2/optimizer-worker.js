import { GEAR_TABLES, GEAR_KEYS, COMMUNITY_SEEDS } from './gear-data.js';

const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const rand=a=>a[(Math.random()*a.length)|0];
const gauss=()=>Math.sqrt(-2*Math.log(Math.random()||.01))*Math.cos(Math.PI*2*Math.random());
const avg=a=>a.reduce((s,v)=>s+v,0)/Math.max(1,a.length);
const std=a=>{const m=avg(a);return Math.sqrt(avg(a.map(v=>(v-m)**2)))};

const TRAITS=['aggression','greed','fear','curiosity','discipline','reflex','resourceBias','luckBias'];
const SLOTS=['heart','artifact','weapon','rune','ring','necklace','soulfruit'];

function randomBuild(){
  const b={};
  for(const s of SLOTS)b[s]=rand(GEAR_KEYS[s]);
  for(const t of TRAITS)b[t]=Math.random();
  return b;
}
function seededBuild(seed){
  return {...randomBuild(),...seed.build,communitySeed:seed.name,confidence:seed.confidence};
}
function copyBuild(b){return JSON.parse(JSON.stringify(b))}
function crossover(a,b){
  const c={};
  for(const s of SLOTS)c[s]=Math.random()<.5?a[s]:b[s];
  for(const t of TRAITS)c[t]=clamp((a[t]+b[t])/2+gauss()*.045);
  return c;
}
function mutate(b,rate){
  const c=copyBuild(b);
  for(const s of SLOTS)if(Math.random()<rate)c[s]=rand(GEAR_KEYS[s]);
  for(const t of TRAITS)if(Math.random()<rate*1.6)c[t]=clamp(c[t]+gauss()*.18);
  return c;
}
function sumTag(build,tag){
  let n=0;
  for(const s of SLOTS){const d=GEAR_TABLES[s][build[s]];if(d?.tags?.includes(tag))n++}
  return n;
}
function synergy(build){
  const H=GEAR_TABLES.heart[build.heart],A=GEAR_TABLES.artifact[build.artifact],W=GEAR_TABLES.weapon[build.weapon],R=GEAR_TABLES.rune[build.rune],G=GEAR_TABLES.ring[build.ring],N=GEAR_TABLES.necklace[build.necklace],F=GEAR_TABLES.soulfruit[build.soulfruit];
  let s=0;
  const tags=['fire','cold','lightning','poison','dash','cooldown','critical','ichor','temporary','invulnerability','swarm','power','on-hit'];
  for(const t of tags){const c=sumTag(build,t);if(c>1)s+=(c-1)*.045}
  if(W.invulnPower&&A.cooldown)s+=.32;
  if(W.invulnPower&&F.invulnerability)s+=.22;
  if(W.perfectDash&&(G.dashDamage||N.coldProc||F.dashRecovery))s+=.26;
  if(A.ichorOrbChance&&(H.resource||F.ichorOnHit||A.resource))s+=.22;
  if(H.tempRegen&&G.tempHeartSynergy)s+=.24;
  if(H.luck&&A.chestLuck)s+=.18;
  if(R.cooldown&&A.cooldown)s+=.18;
  if(N.runePower&&(R.lightning||R.chain))s+=.14;
  if(F.crit===-1&&(G.crit||W.guaranteedCrit||N.poisonCrit))s-=.24;
  if(H.noAttackHeal&&G.healing)s-=.10;
  return s;
}
function communityPrior(build){
  let best=0,name='';
  for(const seed of COMMUNITY_SEEDS){
    let matches=0;
    for(const s of SLOTS)if(seed.build[s]===build[s])matches++;
    const v=(matches/SLOTS.length)*seed.confidence;
    if(v>best){best=v;name=seed.name}
  }
  return {score:best,name};
}
function episode(build,difficulty,objectiveNoise=1){
  const H=GEAR_TABLES.heart[build.heart],A=GEAR_TABLES.artifact[build.artifact],W=GEAR_TABLES.weapon[build.weapon],R=GEAR_TABLES.rune[build.rune],G=GEAR_TABLES.ring[build.ring],N=GEAR_TABLES.necklace[build.necklace],F=GEAR_TABLES.soulfruit[build.soulfruit];
  const syn=synergy(build),prior=communityPrior(build).score;
  const base=(W.min+W.max)/2;
  let speed=W.speed||1;
  let damage=base*(1+(H.damage||0)+(H.physical||0)+(H.fire||0)*.4+(W.fire||0)+(W.lightning||0)+(W.cold||0)+(W.heavy||0)*.35+(F.damage||0)+(F.elemental||0)*.55+syn*.42);
  let crit=.07+(G.crit||0)+(W.guaranteedCrit||0)+(W.comboCrit||0)+(G.marked||0)*.3;
  if(F.crit===-1)crit=0;
  const critPower=1.55+(H.critPower||0)+(A.critPower||0);
  let cooldown=1-(A.cooldown||0)-(A.chainCooldown||0)-(R.cooldown||0)-(F.cooldown||0)-(W.parryCooldown||0);
  cooldown=clamp(cooldown,.24,1.4);
  let burst=(R.burst||0)+(R.lightning||0)+(R.chain||0)+(R.extra||0)*.07+(N.fireProc||0)+(N.coldProc||0)+(W.vortex||0)+(W.forceWave||0)+(W.clones||0);
  let mobility=.35+(A.mobility||0)+(A.airMobility||0)+(F.mobility||0)+(F.dashRecovery||0)+(W.airMobility||0)+build.reflex*.38;
  let defense=(H.defense||0)+(H.absorb||0)+(H.regen||0)+(H.tempRegen||0)+(H.tempOnHit||0)+(A.defense||0)+(A.tempHeartBonus||0)+(G.tempHeartSynergy||0)+(F.invulnerability||0)+(W.invulnPower||0)*.7+build.discipline*.25+build.fear*.12;
  let healing=(H.critHeal||0)+(H.vamp||0)+(G.healing||0)+(F.healing||0)+(F.regen||0)+(R.heal||0)+(H.ichorHeal||0);
  let resource=(H.resource||0)+(A.resource||0)+(F.ichorOnHit||0)+(A.ichorOnHit||0)+build.resourceBias*.28;
  let luck=(H.luck||0)+(A.chestLuck||0)+(A.luckPerKill||0)*8+build.luckBias*.35;
  let invuln=(W.invulnPower||0)+(F.invulnerability||0)+(H.lightningWard||0)+Math.min(.35,cooldown<.55?.24:0);
  const swarm=20+difficulty*28+Math.floor(Math.random()*25);
  const enemyHealth=42*Math.pow(1.48,difficulty)*(0.86+Math.random()*.28);
  const attacksPerSec=speed*(1+build.aggression*.22+build.discipline*.08);
  const dps=(damage*attacksPerSec*(1+crit*(critPower-1))+burst*damage/cooldown)*(1+prior*.10)*(0.92+gauss()*.07*objectiveNoise);
  const clearTime=clamp(swarm*enemyHealth/Math.max(10,dps),8,210);
  const exposure=clearTime/(32+mobility*16);
  const hitRisk=clamp((difficulty*.07+swarm*.0011)*exposure*(1-defense*.52)*(1-invuln*.55)*(1-build.reflex*.24),.01,2.4);
  const hearts=H.hp+(H.tempRegen||0)*2+(H.tempOnHit||0)*1.4;
  let survival=Math.exp(-hitRisk)*clamp(.62+hearts*.075+healing*.26,0,1.28);
  survival=clamp(survival+(H.revive||0)*.16+(F.revive||0)*.13,0,1);
  const survived=Math.random()<survival;
  const ichor=(swarm*(7+Math.random()*5)*(1+resource)+((A.ichorOrbChance||0)*swarm*22)+luck*8)*(survived?1:.65);
  const chestCount=1+Math.floor(1+build.curiosity*3+mobility*1.4);
  const chestExplosions=A.chestExplosion?Array.from({length:chestCount},()=>Math.random()<A.chestExplosion).filter(Boolean).length:0;
  const loot=Math.max(0,chestCount*(.65+luck*1.15)*(1+(A.chestLuck||0))-chestExplosions*.8)*(survived?1:.72);
  const damageTaken=clamp(hitRisk*(1-defense*.3)+chestExplosions*.09,0,2);
  const style={aggression:build.aggression,greed:build.greed,mobility:clamp(mobility/1.8),skillspam:clamp((1-cooldown)+(W.invulnPower||0)*.6)};
  return {survival:survived?1:0,survivalP:survival,ichorPerMin:ichor/(clearTime/60),lootPerMin:loot/(clearTime/60),dps,clearTime,damageTaken,style};
}
function evaluate(build,difficulty,trials=16){
  const eps=Array.from({length:trials},()=>episode(build,difficulty));
  const metric=k=>eps.map(e=>e[k]);
  const res={
    survival:avg(metric('survival')),
    survivalP:avg(metric('survivalP')),
    ichor:avg(metric('ichorPerMin')),
    loot:avg(metric('lootPerMin')),
    dps:avg(metric('dps')),
    clearTime:avg(metric('clearTime')),
    damageTaken:avg(metric('damageTaken')),
    risk:std(metric('survival'))+std(metric('ichorPerMin'))/Math.max(1,avg(metric('ichorPerMin'))),
    novelty:0,
    community:communityPrior(build),
    synergy:synergy(build)
  };
  res.style={
    aggression:avg(eps.map(e=>e.style.aggression)),
    greed:avg(eps.map(e=>e.style.greed)),
    mobility:avg(eps.map(e=>e.style.mobility)),
    skillspam:avg(eps.map(e=>e.style.skillspam))
  };
  return {...build,metrics:res};
}
function behaviorDistance(a,b){
  const x=a.metrics.style,y=b.metrics.style;
  return Math.hypot(x.aggression-y.aggression,x.greed-y.greed,x.mobility-y.mobility,x.skillspam-y.skillspam);
}
function assignNovelty(pop){
  for(const p of pop){const d=pop.filter(q=>q!==p).map(q=>behaviorDistance(p,q)).sort((a,b)=>a-b).slice(0,8);p.metrics.novelty=avg(d)}
}
function dominates(a,b){
  const A=[a.metrics.survival,a.metrics.ichor,a.metrics.loot,a.metrics.dps,-a.metrics.risk,a.metrics.novelty];
  const B=[b.metrics.survival,b.metrics.ichor,b.metrics.loot,b.metrics.dps,-b.metrics.risk,b.metrics.novelty];
  return A.every((v,i)=>v>=B[i])&&A.some((v,i)=>v>B[i]);
}
function fronts(pop){
  const remaining=new Set(pop),out=[];
  while(remaining.size){const f=[];for(const p of remaining){let dom=false;for(const q of remaining)if(p!==q&&dominates(q,p)){dom=true;break}if(!dom)f.push(p)}if(!f.length){out.push([...remaining]);break}out.push(f);f.forEach(x=>remaining.delete(x))}
  return out;
}
function crowding(front){
  const keys=['survival','ichor','loot','dps','risk','novelty'];front.forEach(p=>p.crowding=0);
  for(const k of keys){const sorted=[...front].sort((a,b)=>a.metrics[k]-b.metrics[k]);if(sorted.length<3){sorted.forEach(p=>p.crowding=Infinity);continue}sorted[0].crowding=sorted.at(-1).crowding=Infinity;const min=sorted[0].metrics[k],max=sorted.at(-1).metrics[k];for(let i=1;i<sorted.length-1;i++)sorted[i].crowding+=(sorted[i+1].metrics[k]-sorted[i-1].metrics[k])/Math.max(1e-9,max-min)}
}
function select(pop,n){const fs=fronts(pop),out=[];for(const f of fs){crowding(f);if(out.length+f.length<=n)out.push(...f);else{out.push(...f.sort((a,b)=>b.crowding-a.crowding).slice(0,n-out.length));break}}return out}
function tournament(pop){const a=rand(pop),b=rand(pop);if(dominates(a,b))return a;if(dominates(b,a))return b;return (a.crowding||0)>(b.crowding||0)?a:b}
function nicheKey(p){return `${Math.min(4,Math.floor(p.metrics.style.aggression*5))}:${Math.min(4,Math.floor(p.metrics.style.greed*5))}:${Math.min(4,Math.floor(p.metrics.style.skillspam*5))}`}
function utility(p,goal){
  const m=p.metrics;
  if(goal==='survival')return m.survival*900+m.dps*.015-m.risk*80;
  if(goal==='ichor')return m.ichor+m.survival*180-m.risk*45;
  if(goal==='loot')return m.loot*140+m.survival*170-m.risk*40;
  if(goal==='speed')return m.dps*.06+1200/Math.max(8,m.clearTime)+m.survival*130;
  return m.survival*260+m.ichor*.42+m.loot*70+m.dps*.025+m.novelty*80-m.risk*45;
}
function compact(p,goal){
  return {
    build:Object.fromEntries(SLOTS.map(s=>[s,p[s]])),
    traits:Object.fromEntries(TRAITS.map(t=>[t,p[t]])),
    metrics:{...p.metrics,score:utility(p,goal)},
    niche:nicheKey(p)
  };
}

self.onmessage=(event)=>{
  const {type,goal='balanced',difficulty=3,population=144,generations=28,trials=14,mutation=.10}=event.data||{};
  if(type!=='search')return;
  let pop=[];
  for(const seed of COMMUNITY_SEEDS)pop.push(evaluate(seededBuild(seed),difficulty,trials));
  while(pop.length<population)pop.push(evaluate(randomBuild(),difficulty,trials));
  const archive=new Map();
  for(let gen=0;gen<generations;gen++){
    assignNovelty(pop);pop=select(pop,population);pop.forEach(p=>{const k=nicheKey(p),old=archive.get(k);if(!old||utility(p,goal)>utility(old,goal))archive.set(k,p)});
    const children=[];
    while(children.length<population){const a=tournament(pop),b=tournament(pop);children.push(evaluate(mutate(crossover(a,b),mutation),difficulty,trials))}
    pop=[...pop,...children];assignNovelty(pop);pop=select(pop,population);
    if(gen%2===0)self.postMessage({type:'progress',generation:gen+1,total:generations,best:Math.max(...pop.map(p=>utility(p,goal))),archive:archive.size});
  }
  assignNovelty(pop);const pareto=fronts(pop)[0];
  const ranked=[...new Map([...pop,...archive.values()].sort((a,b)=>utility(b,goal)-utility(a,goal)).map(p=>[JSON.stringify(SLOTS.map(s=>p[s])),p])).values()];
  const top=ranked.slice(0,16).map(p=>compact(p,goal));
  const diverse=[...archive.values()].sort((a,b)=>utility(b,goal)-utility(a,goal)).slice(0,20).map(p=>compact(p,goal));
  self.postMessage({type:'done',goal,difficulty,top,pareto:pareto.slice(0,24).map(p=>compact(p,goal)),archive:diverse,evaluations:population*(generations+1)*trials,communitySeeds:COMMUNITY_SEEDS.length});
};
