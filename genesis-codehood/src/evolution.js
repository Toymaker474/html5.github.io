import { crossoverPrograms, mutateProgram, randomProgram, cloneProgram } from './vm.js';
import { TASKS, VERIFY_CASES, evaluateProgram, unlockedTaskNames } from './tasks.js';
import { createBrain } from './brain.js';

export const ROLES=Object.freeze(['BUILDER','CRITIC','TESTER','OPTIMIZER','ARCHITECT','SECURITY']);
export function emptyLibrary(){return {};}
function pickTask(library,rng){const names=unlockedTaskNames(library);return names[(rng()*names.length)|0];}

export function createAgent(id,rng=Math.random,parent=null,library={}){
  const task=parent&&rng()<.70?parent.task:pickTask(library,rng);
  const parentProgram=parent?.bestProgram||parent?.program;
  let program=parentProgram?mutateProgram(parentProgram,rng):randomProgram(rng,2,8);
  if(!parent&&library[task]&&rng()<.18)program=crossoverPrograms(program,library[task].program,rng);
  return {
    id,label:`A-${String(id).padStart(5,'0')}`,role:ROLES[(rng()*ROLES.length)|0],task,program,
    bestProgram:cloneProgram(program),bestFitness:-Infinity,bestPassRate:0,bestErrorQuality:0,
    brain:createBrain(rng,parent?.brain||null),generation:parent?parent.generation+1:0,
    money:parent?28:20+rng()*55,energy:55+rng()*40,skill:parent?parent.skill*.94:0,age:0,alive:true,
    x:parent?parent.x:rng()*1200,y:parent?parent.y:rng()*800,tx:rng()*1200,ty:rng()*800,vx:0,vy:0,
    lastJob:0,lastConflict:0,lineage:parent?parent.id:null,lastAction:'EXPLORE',actionTicks:0,
    stats:{jobs:0,verified:0,critiques:0,conflicts:0,food:0,shelter:0,children:0,social:0}
  };
}

export function retargetAgent(agent,library,rng=Math.random){
  const names=unlockedTaskNames(library);
  if(!names.includes(agent.task)||rng()<.08){
    agent.task=names[(rng()*names.length)|0];
    agent.program=randomProgram(rng,2,8);
    agent.bestProgram=cloneProgram(agent.program);
    agent.bestFitness=-Infinity;agent.bestPassRate=0;agent.bestErrorQuality=0;
  }
}

export function scoreCandidate(agent,library,rng=Math.random){
  const task=TASKS[agent.task];const sample=[];
  for(let i=0;i<24;i++)sample.push(VERIFY_CASES[(rng()*VERIFY_CASES.length)|0]);
  const report=evaluateProgram(agent.program,agent.task,sample);
  const correctness=report.passRate;
  const closeness=report.errorQuality??0;
  // Correctness dominates. Closeness gives evolution a slope instead of a binary cliff.
  // Efficiency breaks ties but can never make a wrong program count as learned.
  const fitness=correctness*1200+closeness*240-report.avgSteps*.25-agent.program.length*1.2;
  const improvedPersonal=fitness>agent.bestFitness;
  if(improvedPersonal){
    agent.bestFitness=fitness;
    agent.bestPassRate=correctness;
    agent.bestErrorQuality=closeness;
    agent.bestProgram=cloneProgram(agent.program);
  }
  const pay=correctness>.50?(1.5+correctness*task.reward*.14):0;
  agent.money+=pay;
  agent.skill=Math.min(100,agent.skill+correctness*.48+closeness*.04);
  agent.stats.jobs++;

  if(report.verified){
    const full=evaluateProgram(agent.program,agent.task,VERIFY_CASES);
    if(full.verified){
      const prior=library[agent.task];
      const better=!prior||agent.program.length<prior.program.length||full.avgSteps<prior.report.avgSteps;
      if(better)library[agent.task]={task:agent.task,program:cloneProgram(agent.program),report:full,author:agent.label,version:(prior?.version??0)+1,tick:0};
      agent.money+=task.reward;agent.stats.verified++;
      agent.bestProgram=cloneProgram(agent.program);agent.bestPassRate=1;agent.bestErrorQuality=1;
      agent.bestFitness=Math.max(agent.bestFitness,1440-full.avgSteps*.25-agent.program.length*1.2);
      agent.program=mutateProgram(agent.bestProgram,rng);
      return{report:full,pay:pay+task.reward,shipped:true,improved:better,improvedPersonal};
    }
  }

  const base=agent.bestProgram?.length?agent.bestProgram:agent.program;
  if(library[agent.task]&&rng()<.08)agent.program=crossoverPrograms(base,library[agent.task].program,rng);
  else agent.program=mutateProgram(base,rng);
  return{report,pay,shipped:false,improved:false,improvedPersonal};
}

export function socialLearn(a,b,rng=Math.random){
  if(!b||!b.alive||a===b)return false;
  if(a.task===b.task&&b.bestFitness>a.bestFitness&&rng()<.22){
    a.program=crossoverPrograms(a.bestProgram,b.bestProgram||b.program,rng);a.stats.social++;return true;
  }
  if(rng()<.06){a.brain=createBrain(rng,b.brain);a.stats.social++;return true;}
  return false;
}

export function critiqueAgent(critic,target){
  const full=evaluateProgram(target.bestProgram||target.program,target.task,VERIFY_CASES);
  if(!full.verified){critic.money+=4;critic.skill=Math.min(100,critic.skill+.16);critic.stats.critiques++;return full.firstFailure;}
  return null;
}
