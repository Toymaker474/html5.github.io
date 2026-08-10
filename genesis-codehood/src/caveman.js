import { runProgram } from './vm.js';
import { PROJECTS, createProjectState, projectReady, stepProject } from './projects.js';

export const LIFE_ROLES=Object.freeze(['HUNTER','GATHERER','CRAFTER','THINKER','GAMER']);
export const SEASONS=Object.freeze(['SPRING','SUMMER','AUTUMN','WINTER']);

export function attachCavemanIdentity(agent,index=0){
  agent.lifeRole=agent.lifeRole||LIFE_ROLES[index%LIFE_ROLES.length];
  agent.morale=Number.isFinite(agent.morale)?agent.morale:68;
  agent.inventory=agent.inventory||{food:0,wood:0,stone:0,tools:0};
  agent.softwareUses=agent.softwareUses||0;
  agent.gamesPlayed=agent.gamesPlayed||0;
  agent.gameScore=agent.gameScore||0;
  agent.softwareState=agent.softwareState||{};
  return agent;
}

export function createTribeState(){
  return {food:18,wood:14,stone:8,tools:0,fire:62,totalHunts:0,totalCrafts:0,totalGames:0};
}

export function createChronicle(){
  return {era:'CAVEMAN AGE',year:0,season:'SPRING',entries:[],inventions:{},seen:{}};
}

export function updateClock(chronicle,sweep){
  const seasonStep=Math.floor(sweep/24);
  chronicle.year=Math.floor(seasonStep/4);
  chronicle.season=SEASONS[seasonStep%4];
  return chronicle;
}

export function recordHistory(chronicle,sweep,text,type='WORLD',key=null){
  if(key&&chronicle.seen[key])return false;
  if(key)chronicle.seen[key]=true;
  updateClock(chronicle,sweep);
  chronicle.entries.unshift({year:chronicle.year,season:chronicle.season,type,text,sweep});
  if(chronicle.entries.length>120)chronicle.entries.length=120;
  return true;
}

export function runSkill(library,name,a,b=0){
  const skill=library?.[name];
  if(!skill?.report?.verified)return null;
  const out=runProgram(skill.program,{a,b});
  return out.ok?out.value:null;
}

export function syncInventions(chronicle,library,sweep){
  for(const p of PROJECTS){
    if(projectReady(p,library)&&!chronicle.inventions[p.id]){
      chronicle.inventions[p.id]={title:p.title,kind:p.kind,year:chronicle.year,sweep,uses:0};
      recordHistory(chronicle,sweep,`${p.title} became usable by the tribe.`,p.kind,`invent:${p.id}`);
    }
  }
}

function resourceScore(agent,c){
  if(agent.lifeRole==='HUNTER')return Math.round((c.game??0)*100);
  if(agent.lifeRole==='GATHERER')return Math.round((c.food??0)*100);
  if(agent.lifeRole==='CRAFTER')return Math.round(((c.wood??0)+(c.ore??0))*50);
  return Math.round((c.jobs??0)*100);
}

export function chooseResourceNeighbor(agent,neighbors,library,rng=Math.random){
  if(!neighbors?.length)return null;
  if(!library?.PICK_HIGH?.report?.verified)return neighbors[(rng()*neighbors.length)|0];
  let best=neighbors[0],bestScore=resourceScore(agent,best);
  for(let i=1;i<neighbors.length;i++){
    const candidate=neighbors[i],score=resourceScore(agent,candidate);
    const chosen=runSkill(library,'PICK_HIGH',bestScore,score);
    if(chosen===score){best=candidate;bestScore=score;}
  }
  agent.softwareUses++;
  return best;
}

function playableProject(library){
  return PROJECTS.find(p=>p.id==='COIN_CHASE'&&projectReady(p,library))||PROJECTS.find(p=>p.id==='HAPPY_WALKER'&&projectReady(p,library))||null;
}

export function runGamerSoftware(agent,library,chronicle,sweep){
  const project=playableProject(library);
  if(!project)return {used:false,reason:'no verified game yet'};
  let state=agent.softwareState[project.id];
  if(!state)state=agent.softwareState[project.id]=createProjectState(project.id);
  const beforeScore=Number(state.score||0);
  let input=0;
  if(project.id==='COIN_CHASE')input=state.coin>state.x?1:state.coin<state.x?-1:0;
  else input=(state.x<10?1:-1);
  stepProject(state,library,input);
  const gained=Math.max(0,Number(state.score||0)-beforeScore);
  agent.morale=Math.min(100,agent.morale+.7+gained*5);
  agent.gamesPlayed++;agent.softwareUses++;agent.gameScore+=gained;
  const inv=chronicle.inventions[project.id];if(inv)inv.uses++;
  recordHistory(chronicle,sweep,`${agent.name} played ${project.title} using the tribe's evolved code.`, 'CULTURE', `firstplay:${agent.id}:${project.id}`);
  return {used:true,title:project.title,gained,state};
}

export function applyFireKeeper(tribe,library,chronicle,sweep){
  let burn=tribe.fire<20?0:Math.min(2,tribe.wood);
  const learned=library?.PICK_LOW?.report?.verified;
  if(learned){
    const planned=runSkill(library,'PICK_LOW',tribe.wood,1);
    if(Number.isFinite(planned))burn=Math.max(0,Math.min(tribe.wood,planned));
  }
  tribe.wood=Math.max(0,tribe.wood-burn);
  tribe.fire=Math.max(0,Math.min(100,tribe.fire+burn*12-3));
  if(learned){
    const inv=chronicle.inventions.FIRE_KEEPER;if(inv)inv.uses++;
    recordHistory(chronicle,sweep,'The tribe started using evolved rationing code to manage the campfire.', 'WORLD TOOL','firekeeper-used');
  }
  return burn;
}

export function eraProgress(chronicle,library,tribe){
  const learned=Object.values(library||{}).filter(x=>x?.report?.verified).length;
  const installed=Object.keys(chronicle.inventions||{}).length;
  const score=learned*2+installed+tribe.tools;
  if(score>=30)return 'EARLY VILLAGE';
  if(score>=18)return 'TRIBAL AGE';
  return 'CAVEMAN AGE';
}
