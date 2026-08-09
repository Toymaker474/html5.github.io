import assert from 'node:assert/strict';
import { runProgram } from '../src/vm.js';
import { SEED_PROGRAMS, TASKS, VERIFY_CASES, evaluateProgram } from '../src/tasks.js';

const toProgram = (ops) => ops.map(op => ({op,arg:0}));

for (const [task, ops] of Object.entries(SEED_PROGRAMS)) {
  const report = evaluateProgram(toProgram(ops), task, VERIFY_CASES);
  assert.equal(report.verified, true, `${task} seed must verify`);
}

const loop = [{op:'PUSH_1',arg:0},{op:'JMP',arg:-1}];
const loopResult = runProgram(loop,{a:1,b:2},{maxInstructions:16,maxStack:32,registerCount:4,maxAbsValue:1e9});
assert.equal(loopResult.ok,false);
assert.equal(loopResult.error,'instruction-budget');

const divZero = toProgram(['PUSH_A','PUSH_0','DIV']);
assert.equal(runProgram(divZero,{a:7,b:0}).error,'divide-by-zero');

const add = toProgram(SEED_PROGRAMS.ADD);
for (const [a,b] of [[2,3],[-2,5],[0,0],[31,-31]]) {
  const r = runProgram(add,{a,b});
  assert.equal(r.value,TASKS.ADD.fn(a,b));
}

console.log(`PASS: ${Object.keys(SEED_PROGRAMS).length} seed programs verified across ${VERIFY_CASES.length} deterministic cases each; VM budgets enforced.`);
