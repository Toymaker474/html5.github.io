import assert from 'node:assert/strict';
import { cloneProgram } from '../src/vm.js';
import { createAgent, emptyLibrary, scoreCandidate } from '../src/evolution.js';

function seededRng(seed){
  let x=seed>>>0;
  return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296;};
}

function forceTask(agent,task){
  agent.task=task;
  agent.bestProgram=cloneProgram(agent.program);
  agent.bestFitness=-Infinity;
  agent.bestPassRate=0;
  agent.bestErrorQuality=0;
  return agent;
}

function discover(task,seed,{population=96,rounds=1200}={}){
  const rng=seededRng(seed);
  const library=emptyLibrary();
  let nextId=1;
  let agents=Array.from({length:population},()=>forceTask(createAgent(nextId++,rng,null,library),task));

  for(let round=0;round<rounds;round++){
    for(const agent of agents){
      scoreCandidate(agent,library,rng);
      if(library[task]?.report?.verified){
        return {round,program:library[task].program,report:library[task].report};
      }
    }

    // Selection/reproduction mirrors the world's survival idea without loading any answer.
    if(round%8===7){
      agents.sort((a,b)=>b.bestFitness-a.bestFitness);
      const eliteCount=Math.max(8,Math.floor(population/6));
      const elites=agents.slice(0,eliteCount);
      const next=elites.slice();
      while(next.length<population){
        const parent=elites[(rng()*elites.length)|0];
        next.push(forceTask(createAgent(nextId++,rng,parent,library),task));
      }
      agents=next;
    }
  }
  return null;
}

const right=discover('STEP_RIGHT',0x51eeda11);
assert.ok(right,'zero-solution population must discover STEP_RIGHT within the smoke-test budget');
assert.equal(right.report.verified,true);

const hit=discover('HIT_TEST',0xc0111de5,{population:112,rounds:1500});
assert.ok(hit,'zero-solution population must discover HIT_TEST within the smoke-test budget');
assert.equal(hit.report.verified,true);

console.log(`PASS: zero-solution evolution independently discovered STEP_RIGHT in round ${right.round} and HIT_TEST in round ${hit.round}; no reference solution was injected.`);
