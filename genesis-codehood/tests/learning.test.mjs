import assert from 'node:assert/strict';
import { cloneProgram } from '../src/vm.js';
import { createAgent, emptyLibrary, scoreCandidate } from '../src/evolution.js';

function seededRng(seed){let x=seed>>>0;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296;};}
function forceTask(agent,task){agent.task=task;agent.bestProgram=cloneProgram(agent.program);agent.bestFitness=-Infinity;agent.bestPassRate=0;agent.bestErrorQuality=0;return agent;}
function discover(task,seed,{population=5,rounds=7000}={}){
  const rng=seededRng(seed),library=emptyLibrary();let nextId=1;
  let agents=Array.from({length:population},()=>forceTask(createAgent(nextId++,rng,null,library),task));
  for(let round=0;round<rounds;round++){
    for(const agent of agents){scoreCandidate(agent,library,rng);if(library[task]?.report?.verified)return{round,program:library[task].program,report:library[task].report};}
    if(round%12===11){agents.sort((a,b)=>b.bestFitness-a.bestFitness);const elites=agents.slice(0,2),next=elites.slice();while(next.length<population){const parent=elites[(rng()*elites.length)|0];next.push(forceTask(createAgent(nextId++,rng,parent,library),task));}agents=next;}
  }
  return null;
}
const right=discover('STEP_RIGHT',0x51eeda11,{rounds:3500});assert.ok(right,'five zero-solution agents must discover STEP_RIGHT within budget');assert.equal(right.report.verified,true);
const hit=discover('HIT_TEST',0xc0111de5,{rounds:7000});assert.ok(hit,'five zero-solution agents must discover HIT_TEST within budget');assert.equal(hit.report.verified,true);
console.log(`PASS: five zero-solution agents independently discovered STEP_RIGHT in round ${right.round} and HIT_TEST in round ${hit.round}; no reference solution was injected.`);
