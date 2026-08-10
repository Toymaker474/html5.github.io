import { runProgram } from './vm.js';

// The verifier specifies observable behavior, never the implementation.
// Learners start from random primitive VM programs and must synthesize each skill.
export const TASKS=Object.freeze({
  STEP_RIGHT:{level:1,fn:(a)=>a+1,reward:120,label:'State primitive: increment a value by one'},
  STEP_LEFT:{level:1,fn:(a)=>a-1,reward:120,label:'State primitive: decrement a value by one'},
  ADD_SCORE:{level:1,fn:(a,b)=>a+b,reward:130,label:'Accumulator: combine two numeric state values'},
  HIT_TEST:{level:2,fn:(a,b)=>a===b?1:0,reward:165,label:'Logic: exact equality / collision / ID match'},
  BOUNCE:{level:2,fn:(a)=>-a,reward:175,label:'State transform: reverse a signed direction or velocity'},
  IS_AHEAD:{level:2,fn:(a,b)=>a>b?1:0,reward:185,label:'Decision primitive: threshold / greater-than test'},
  PICK_HIGH:{level:3,fn:(a,b)=>Math.max(a,b),reward:210,label:'Branching primitive: select the larger candidate'},
  PICK_LOW:{level:3,fn:(a,b)=>Math.min(a,b),reward:210,label:'Branching primitive: select the smaller candidate'},
  DISTANCE:{level:4,fn:(a,b)=>Math.abs(a-b),reward:255,label:'Measurement primitive: absolute one-axis distance'},
  MANHATTAN:{level:5,fn:(a,b)=>Math.abs(a)+Math.abs(b),reward:360,label:'Navigation primitive: grid distance |dx| + |dy|'}
});

export function makeCaseSet(count=96,seed=0xC0DE){
  let x=seed>>>0;const rng=()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296;};
  const fixed=[[0,0],[1,0],[0,1],[-1,1],[7,-3],[-7,3],[12,12],[-12,-12],[31,-31],[-31,31]];
  while(fixed.length<count)fixed.push([((rng()*41)|0)-20,((rng()*41)|0)-20]);return fixed;
}
export const VERIFY_CASES=makeCaseSet();
export function evaluateProgram(program,taskName,cases=VERIFY_CASES){
  const task=TASKS[taskName];if(!task)throw new Error(`Unknown task ${taskName}`);
  let passed=0,totalSteps=0,totalError=0,firstFailure=null;
  for(const [a,b] of cases){
    const result=runProgram(program,{a,b});totalSteps+=result.steps;const expected=task.fn(a,b);
    if(result.ok&&result.value===expected)passed++;
    else{const err=result.ok&&Number.isFinite(result.value)?Math.abs(result.value-expected):100;totalError+=Math.min(100,err);if(!firstFailure)firstFailure={a,b,expected,got:result.value,error:result.error};}
  }
  const meanError=totalError/cases.length;
  return{task:taskName,passed,total:cases.length,passRate:passed/cases.length,verified:passed===cases.length,totalSteps,avgSteps:totalSteps/cases.length,meanError,errorQuality:1/(1+meanError),firstFailure};
}
export function unlockedTaskNames(library={}){
  const verified=Object.values(library).filter(x=>x?.report?.verified).length;
  const maxLevel=verified>=8?5:verified>=6?4:verified>=3?3:verified>=1?2:1;
  return Object.entries(TASKS).filter(([,t])=>t.level<=maxLevel).map(([name])=>name);
}
