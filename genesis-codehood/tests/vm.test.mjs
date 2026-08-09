import assert from 'node:assert/strict';
import { runProgram } from '../src/vm.js';
import { TASKS, VERIFY_CASES, evaluateProgram, unlockedTaskNames } from '../src/tasks.js';

const p=(ops)=>ops.map(op=>({op,arg:0}));
const known={
  STEP_RIGHT:p(['PUSH_A','PUSH_1','ADD']),
  STEP_LEFT:p(['PUSH_A','PUSH_1','SUB']),
  ADD_SCORE:p(['PUSH_A','PUSH_B','ADD']),
  HIT_TEST:p(['PUSH_A','PUSH_B','EQ']),
  BOUNCE:p(['PUSH_0','PUSH_A','SUB']),
  PICK_HIGH:p(['PUSH_A','PUSH_B','MAX']),
  PICK_LOW:p(['PUSH_A','PUSH_B','MIN']),
  DISTANCE:p(['PUSH_A','PUSH_B','SUB','ABS']),
  SCALE:p(['PUSH_A','PUSH_B','MUL']),
  SQUARE_SPEED:p(['PUSH_A','DUP','MUL']),
  IS_AHEAD:p(['PUSH_A','PUSH_B','GT']),
  MANHATTAN:p(['PUSH_A','ABS','PUSH_B','ABS','ADD'])
};
for(const [task,program] of Object.entries(known))assert.equal(evaluateProgram(program,task,VERIFY_CASES).verified,true,`${task} verifier must accept known-correct program`);
const loop=[{op:'PUSH_1',arg:0},{op:'JMP',arg:-1}];
const lr=runProgram(loop,{a:1,b:2},{maxInstructions:16,maxStack:32,registerCount:4,maxAbsValue:1e9});assert.equal(lr.ok,false);assert.equal(lr.error,'instruction-budget');
assert.equal(runProgram(p(['PUSH_A','PUSH_0','DIV']),{a:7,b:0}).error,'divide-by-zero');
assert.deepEqual(unlockedTaskNames({}).sort(),['ADD_SCORE','STEP_LEFT','STEP_RIGHT'].sort());
assert.equal(Object.keys(TASKS).length,12);
console.log(`PASS: ${Object.keys(TASKS).length} project-skill verifiers, ${VERIFY_CASES.length} deterministic cases, VM safety budgets.`);
