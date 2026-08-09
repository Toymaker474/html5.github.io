export const ACTIONS=Object.freeze(['FORAGE','WORK','SHELTER','EXPLORE','REST','SOCIAL','FIGHT']);
export const FEATURES=Object.freeze(['bias','hunger','flood','food','jobs','shelter','danger','crowd','poor']);
const SIZE=ACTIONS.length*FEATURES.length;

export function createBrain(rng=Math.random,parent=null){
  if(parent){
    const out=parent.slice();
    const edits=1+((rng()*5)|0);
    for(let i=0;i<edits;i++){const p=(rng()*out.length)|0;out[p]=Math.max(-3,Math.min(3,out[p]+(rng()*2-1)*.65));}
    if(rng()<.08){const p=(rng()*out.length)|0;out[p]=rng()*4-2;}
    return out;
  }
  return Array.from({length:SIZE},()=>rng()*1.6-.8);
}

export function chooseAction(brain,obs,rng=Math.random){
  let best=ACTIONS[0],bestScore=-Infinity;
  const vector=FEATURES.map(f=>f==='bias'?1:Number(obs[f]??0));
  for(let ai=0;ai<ACTIONS.length;ai++){
    let score=0;const base=ai*FEATURES.length;
    for(let fi=0;fi<FEATURES.length;fi++)score+=brain[base+fi]*vector[fi];
    score+=(rng()-.5)*.12;
    if(score>bestScore){bestScore=score;best=ACTIONS[ai];}
  }
  return best;
}

export function actionScores(brain,obs){
  const vector=FEATURES.map(f=>f==='bias'?1:Number(obs[f]??0));
  return ACTIONS.map((action,ai)=>{
    let score=0,base=ai*FEATURES.length;
    for(let fi=0;fi<FEATURES.length;fi++)score+=brain[base+fi]*vector[fi];
    return {action,score};
  }).sort((a,b)=>b.score-a.score);
}

export function behaviorSignature(brain){
  const probes={
    hungry:{hunger:1,food:1}, flooded:{flood:1,shelter:.8}, broke:{poor:1,jobs:1}, danger:{danger:1,shelter:.5}, crowded:{crowd:1}, safe:{food:.5,jobs:.5,shelter:.5}
  };
  return Object.fromEntries(Object.entries(probes).map(([k,o])=>[k,actionScores(brain,o)[0].action]));
}
