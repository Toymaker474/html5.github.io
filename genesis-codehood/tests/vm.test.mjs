import assert from 'node:assert/strict';
import { runProgram } from '../src/vm.js';
import { TASKS, VERIFY_CASES, evaluateProgram, unlockedTaskNames } from '../src/tasks.js';

const p=(ops)=>ops.map(op=>({op,arg:0}));
const known={
  ADD:p(['PUSH_A','PUSH_B','ADD']),
  SUB:p(['PUSH_A','PUSH_B','SUB']),
  DOUBLE_A:p(['PUSH_A','DUP','ADD']),
  MAX:p(['PUSH_A','PUSH_B','MAX']),
  MIN:p(['PUSH_A','PUSH_B','MIN']),
  ABS_DIFF:p(['PUSH_A','PUSH_B','SUB','ABS']),
  MUL:p(['PUSH_A','PUSH_B','MUL']),
  SQUARE_A:p(['PUSH_A','DUP','MUL']),
  IS_GT:p(['PUSH_A','PUSH_B','GT']),
  IS_EQ:p(['PUSH_A','PUSH_B','EQ'])
};
for(const [task,program] of Object.entries(known))assert.equal(evaluateProgram(program,task,VERIFY_CASES).verified,true,`${task} verifier must accept known-correct program`);
const neg=p(['PUSH_0','PUSH_A','SUB']);assert.equal(evaluateProgram(neg,'NEG_A',VERIFY_CASES).verified,true);
const man=p(['PUSH_A','ABS','PUSH_B','ABS','ADD']);assert.equal(evaluateProgram(man,'MANHATTAN',VERIFY_CASES).verified,true);
const loop=[{op:'PUSH_1',arg:0},{op:'JMP',arg:-1}];
const lr=runProgram(loop,{a:1,b:2},{maxInstructions:16,maxStack:32,registerCount:4,maxAbsValue:1e9});assert.equal(lr.ok,false);assert.equal(lr.error,'instruction-budget');
assert.equal(runProgram(p(['PUSH_A','PUSH_0','DIV']),{a:7,b:0}).error,'divide-by-zero');
assert.deepEqual(unlockedTaskNames({}).sort(),['ADD','DOUBLE_A','SUB'].sort());
assert.equal(Object.keys(TASKS).length,12);
console.log(`PASS: ${Object.keys(TASKS).length} task verifiers, ${VERIFY_CASES.length} deterministic cases, VM safety budgets.`);
