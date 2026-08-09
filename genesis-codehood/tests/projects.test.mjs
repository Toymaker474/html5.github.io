import assert from 'node:assert/strict';
import { evaluateProgram, VERIFY_CASES } from '../src/tasks.js';
import { createProjectState, projectReady, stepProject } from '../src/projects.js';
import { createWorld } from '../src/world.js';
import { makeAsciiFrame, MAP_COLS, MAP_ROWS } from '../src/ascii.js';

const p=(ops)=>ops.map(op=>({op,arg:0}));
const programs={
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
  IS_AHEAD:p(['PUSH_A','PUSH_B','GT'])
};
const library={};
for(const [name,program] of Object.entries(programs))library[name]={program,report:evaluateProgram(program,name,VERIFY_CASES)};
assert.equal(projectReady({requires:['STEP_RIGHT','STEP_LEFT']},library),true);
const walker=createProjectState('HAPPY_WALKER');
stepProject(walker,library,1);assert.equal(walker.x,11);stepProject(walker,library,-1);assert.equal(walker.x,10);
const chase=createProjectState('COIN_CHASE');chase.x=15;chase.coin=16;stepProject(chase,library,1);assert.equal(chase.score,1);
const bounce=createProjectState('BOUNCE_BOX');bounce.x=19;bounce.v=1;stepProject(bounce,library,0);assert.equal(bounce.v,-1);assert.equal(bounce.x,18);
const rows=makeAsciiFrame(createWorld(123),[],null);assert.equal(rows.length,MAP_ROWS);assert.equal(rows[0].length,MAP_COLS);
console.log('PASS: playable project cartridges and 96x48 fortress ASCII renderer.');
