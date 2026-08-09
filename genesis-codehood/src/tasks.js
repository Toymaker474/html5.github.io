import { runProgram } from './vm.js';

// These are executable programming skills used by real in-app projects.
// The verifier defines behavior, not the solution. Agents begin with random programs.
export const TASKS = Object.freeze({
  STEP_RIGHT:  {level:1,fn:(a)=>a+1,reward:120,label:'Game input: move position one step right'},
  STEP_LEFT:   {level:1,fn:(a)=>a-1,reward:120,label:'Game input: move position one step left'},
  ADD_SCORE:   {level:1,fn:(a,b)=>a+b,reward:130,label:'Game state: add points to score'},

  HIT_TEST:    {level:2,fn:(a,b)=>a===b?1:0,reward:165,label:'Game logic: collision / hit test'},
  BOUNCE:      {level:2,fn:(a)=>-a,reward:175,label:'Game physics: reverse velocity'},
  PICK_HIGH:   {level:2,fn:(a,b)=>Math.max(a,b),reward:175,label:'Tool logic: choose higher value'},

  PICK_LOW:    {level:3,fn:(a,b)=>Math.min(a,b),reward:190,label:'Tool logic: choose lower value'},
  DISTANCE:    {level:3,fn:(a,b)=>Math.abs(a-b),reward:220,label:'Game/sim logic: one-axis distance'},
  SCALE:       {level:3,fn:(a,b)=>a*b,reward:245,label:'Simulation math: scale velocity or force'},

  SQUARE_SPEED:{level:4,fn:(a)=>a*a,reward:260,label:'Simulation math: square a speed'},
  IS_AHEAD:    {level:4,fn:(a,b)=>a>b?1:0,reward:280,label:'Game AI: is target ahead?'},
  MANHATTAN:   {level:5,fn:(a,b)=>Math.abs(a)+Math.abs(b),reward:350,label:'Pathfinding: grid distance'}
});

export function makeCaseSet(count=96,seed=0xC0DE){
  let x=seed>>>0;const rng=()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296;};
  const fixed=[[0,0],[1,0],[0,1],[-1,1],[7,-3],[-7,3],[12,12],[-12,-12],[31,-31],[-31,31]];
  while(fixed.length<count)fixed.push([((rng()*41)|0)-20,((rng()*41)|0)-20]);
  return fixed;
}
export const VERIFY_CASES=makeCaseSet();

export function evaluateProgram(program,taskName,cases=VERIFY_CASES){
  const task=TASKS[taskName];if(!task)throw new Error(`Unknown task ${taskName}`);
  let passed=0,totalSteps=0,firstFailure=null;
  for(const [a,b] of cases){
    const result=runProgram(program,{a,b});totalSteps+=result.steps;const expected=task.fn(a,b);
    if(result.ok&&result.value===expected)passed++;
    else if(!firstFailure)firstFailure={a,b,expected,got:result.value,error:result.error};
  }
  return {task:taskName,passed,total:cases.length,passRate:passed/cases.length,verified:passed===cases.length,totalSteps,avgSteps:totalSteps/cases.length,firstFailure};
}

export function unlockedTaskNames(library={}){
  const verified=Object.values(library).filter(x=>x?.report?.verified).length;
  const maxLevel=verified>=9?5:verified>=6?4:verified>=3?3:verified>=1?2:1;
  return Object.entries(TASKS).filter(([,t])=>t.level<=maxLevel).map(([name])=>name);
}
