import assert from 'node:assert/strict';
import { EVOLVABLE_OPS, randomInstruction, runProgram } from '../src/vm.js';
import { TASKS, VERIFY_CASES, evaluateProgram, unlockedTaskNames } from '../src/tasks.js';

const p=(ops)=>ops.map(op=>typeof op==='string'?{op,arg:0}:op);
const i=(op,arg=0)=>({op,arg});

// Reference programs prove the target behaviors are expressible in the primitive language.
// They are test-only and are never loaded into the simulation.
const known={
  STEP_RIGHT:p(['PUSH_A','PUSH_1','ADD','HALT']),
  STEP_LEFT:p(['PUSH_A','PUSH_1','SUB','HALT']),
  ADD_SCORE:p(['PUSH_A','PUSH_B','ADD','HALT']),
  HIT_TEST:p(['PUSH_A','PUSH_B','EQ','HALT']),
  BOUNCE:p(['PUSH_0','PUSH_A','SUB','HALT']),
  IS_AHEAD:p(['PUSH_A','PUSH_B','GT','HALT']),
  PICK_HIGH:[i('PUSH_A'),i('PUSH_B'),i('GT'),i('JZ',2),i('PUSH_A'),i('HALT'),i('PUSH_B'),i('HALT')],
  PICK_LOW:[i('PUSH_A'),i('PUSH_B'),i('LT'),i('JZ',2),i('PUSH_A'),i('HALT'),i('PUSH_B'),i('HALT')],
  DISTANCE:[i('PUSH_A'),i('PUSH_B'),i('SUB'),i('DUP'),i('PUSH_0'),i('LT'),i('JZ',3),i('PUSH_0'),i('SWAP'),i('SUB'),i('HALT')],
  MANHATTAN:[
    i('PUSH_A'),i('DUP'),i('PUSH_0'),i('LT'),i('JZ',3),i('PUSH_0'),i('SWAP'),i('SUB'),i('STORE',0),
    i('PUSH_B'),i('DUP'),i('PUSH_0'),i('LT'),i('JZ',3),i('PUSH_0'),i('SWAP'),i('SUB'),i('LOAD',0),i('ADD'),i('HALT')
  ]
};

for(const [task,program] of Object.entries(known)){
  const report=evaluateProgram(program,task,VERIFY_CASES);
  assert.equal(report.verified,true,`${task} primitive reference must verify`);
  for(const ins of program)assert.equal(['MUL','DIV','ABS','MIN','MAX'].includes(ins.op),false,`${task} reference used shortcut ${ins.op}`);
}

const banned=new Set(['MUL','DIV','ABS','MIN','MAX']);
for(let n=0;n<2000;n++)assert.equal(banned.has(randomInstruction().op),false,'evolution emitted a shortcut opcode');
for(const op of banned)assert.equal(EVOLVABLE_OPS.includes(op),false,`${op} must not be evolvable`);

const loop=[i('PUSH_1'),i('JMP',-1)];
const lr=runProgram(loop,{a:1,b:2},{maxInstructions:16,maxStack:32,registerCount:4,maxAbsValue:1e9});
assert.equal(lr.ok,false);assert.equal(lr.error,'instruction-budget');

// Legacy execution remains sandboxed and compatible, but learners cannot randomly receive these opcodes.
assert.equal(runProgram(p(['PUSH_A','PUSH_0','DIV']),{a:7,b:0}).error,'divide-by-zero');
assert.equal(runProgram(p(['PUSH_A','PUSH_B','MAX']),{a:7,b:-3}).value,7);

assert.deepEqual(unlockedTaskNames({}).sort(),['ADD_SCORE','STEP_LEFT','STEP_RIGHT'].sort());
assert.equal(Object.keys(TASKS).length,10);
console.log(`PASS: ${Object.keys(TASKS).length} primitive-synthesis skill verifiers × ${VERIFY_CASES.length} cases; shortcut opcodes excluded from evolution; VM budgets enforced.`);
