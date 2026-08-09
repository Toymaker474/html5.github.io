import { runProgram } from './vm.js';

export const TASKS = Object.freeze({
  ADD:       { level:1, fn:(a,b)=>a+b, reward:120, label:'Add A + B' },
  SUB:       { level:1, fn:(a,b)=>a-b, reward:125, label:'Subtract B from A' },
  DOUBLE_A:  { level:1, fn:(a)=>a+a, reward:130, label:'Double A' },
  MAX:       { level:2, fn:(a,b)=>Math.max(a,b), reward:155, label:'Return larger value' },
  MIN:       { level:2, fn:(a,b)=>Math.min(a,b), reward:155, label:'Return smaller value' },
  NEG_A:     { level:2, fn:(a)=>-a, reward:170, label:'Negate A' },
  ABS_DIFF:  { level:3, fn:(a,b)=>Math.abs(a-b), reward:205, label:'Absolute difference' },
  MUL:       { level:3, fn:(a,b)=>a*b, reward:230, label:'Multiply A × B' },
  SQUARE_A:  { level:3, fn:(a)=>a*a, reward:235, label:'Square A' },
  IS_GT:     { level:4, fn:(a,b)=>a>b?1:0, reward:260, label:'A greater than B?' },
  IS_EQ:     { level:4, fn:(a,b)=>a===b?1:0, reward:275, label:'A equals B?' },
  MANHATTAN: { level:5, fn:(a,b)=>Math.abs(a)+Math.abs(b), reward:340, label:'|A| + |B|' }
});

export function makeCaseSet(count=96,seed=0xC0DE){
  let x=seed>>>0; const rng=()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296;};
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
