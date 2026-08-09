import { runProgram } from './vm.js';

export const TASKS = Object.freeze({
  ADD: { fn: (a,b) => a + b, reward: 120, label: 'Add two integers' },
  MAX: { fn: (a,b) => Math.max(a,b), reward: 150, label: 'Return the larger integer' },
  MIN: { fn: (a,b) => Math.min(a,b), reward: 150, label: 'Return the smaller integer' },
  ABS_DIFF: { fn: (a,b) => Math.abs(a-b), reward: 190, label: 'Absolute difference' },
  MUL: { fn: (a,b) => a * b, reward: 220, label: 'Multiply two integers' }
});

export const SEED_PROGRAMS = Object.freeze({
  ADD: ['PUSH_B','PUSH_A','ADD'],
  MAX: ['PUSH_A','PUSH_B','MAX'],
  MIN: ['PUSH_A','DUP','MIN','PUSH_B','MIN'],
  ABS_DIFF: ['PUSH_B','PUSH_A','SUB','ABS'],
  MUL: ['PUSH_B','PUSH_1','PUSH_B','PUSH_A','PUSH_B','MUL']
});

export function makeCaseSet(count = 64, seed = 0xC0DE) {
  let x = seed >>> 0;
  const rng = () => {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
  const fixed = [[0,0],[1,0],[0,1],[-1,1],[7,-3],[-7,3],[12,12],[-12,-12],[31,-31],[-31,31]];
  while (fixed.length < count) fixed.push([((rng()*65)|0)-32, ((rng()*65)|0)-32]);
  return fixed;
}

export const VERIFY_CASES = makeCaseSet(96);

export function evaluateProgram(program, taskName, cases = VERIFY_CASES) {
  const task = TASKS[taskName];
  if (!task) throw new Error(`Unknown task ${taskName}`);
  let passed = 0;
  let totalSteps = 0;
  let firstFailure = null;
  for (const [a,b] of cases) {
    const result = runProgram(program, { a, b });
    totalSteps += result.steps;
    const expected = task.fn(a,b);
    if (result.ok && result.value === expected) passed += 1;
    else if (!firstFailure) firstFailure = { a, b, expected, got: result.value, error: result.error };
  }
  return {
    task: taskName,
    passed,
    total: cases.length,
    passRate: passed / cases.length,
    verified: passed === cases.length,
    totalSteps,
    avgSteps: totalSteps / cases.length,
    firstFailure
  };
}
