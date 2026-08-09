import assert from 'node:assert/strict';
import { compileTinyC, crossoverTinyC, mutateTinyC, randomTinyC, renderTinyC } from '../src/tinyc.js';
import { evaluateProgram, VERIFY_CASES } from '../src/tasks.js';

const addOne={kind:'binary',op:'+',left:{kind:'var',name:'a'},right:{kind:'const',value:1}};
const hit={kind:'binary',op:'==',left:{kind:'var',name:'a'},right:{kind:'var',name:'b'}};
const bounce={kind:'unary',op:'neg',x:{kind:'var',name:'a'}};
assert.equal(evaluateProgram(compileTinyC(addOne),'STEP_RIGHT',VERIFY_CASES).verified,true);
assert.equal(evaluateProgram(compileTinyC(hit),'HIT_TEST',VERIFY_CASES).verified,true);
assert.equal(evaluateProgram(compileTinyC(bounce),'BOUNCE',VERIFY_CASES).verified,true);
assert.match(renderTinyC(addOne,'step_right'),/return \(a \+ 1\);/);
let seed=123456789;const rng=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
const random=randomTinyC(rng);const mutated=mutateTinyC(random,rng);const crossed=crossoverTinyC(mutated,addOne,rng);
for(const ast of [random,mutated,crossed]){const code=compileTinyC(ast);assert.ok(code.length>0);assert.ok(code.length<128);}
console.log('PASS: TinyC AST generation, mutation, crossover, source rendering, and compilation to executable CodeVM.');
