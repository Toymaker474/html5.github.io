import assert from 'node:assert/strict';
import { evaluateProgram, VERIFY_CASES } from '../src/tasks.js';
import { PROJECTS, createProjectState, projectReady, stepProject } from '../src/projects.js';
import { createWorld } from '../src/world.js';
import { makeAsciiFrame, MAP_COLS, MAP_ROWS } from '../src/ascii.js';

const i=(op,arg=0)=>({op,arg});
const p=ops=>ops.map(op=>i(op));
const programs={
  STEP_RIGHT:p(['PUSH_A','PUSH_1','ADD','HALT']),
  STEP_LEFT:p(['PUSH_A','PUSH_1','SUB','HALT']),
  ADD_SCORE:p(['PUSH_A','PUSH_B','ADD','HALT']),
  HIT_TEST:p(['PUSH_A','PUSH_B','EQ','HALT']),
  BOUNCE:p(['PUSH_0','PUSH_A','SUB','HALT']),
  IS_AHEAD:p(['PUSH_A','PUSH_B','GT','HALT']),
  PICK_HIGH:[i('PUSH_A'),i('PUSH_B'),i('GT'),i('JZ',2),i('PUSH_A'),i('HALT'),i('PUSH_B'),i('HALT')],
  PICK_LOW:[i('PUSH_A'),i('PUSH_B'),i('LT'),i('JZ',2),i('PUSH_A'),i('HALT'),i('PUSH_B'),i('HALT')],
  DISTANCE:[i('PUSH_A'),i('PUSH_B'),i('SUB'),i('DUP'),i('PUSH_0'),i('LT'),i('JZ',3),i('PUSH_0'),i('SWAP'),i('SUB'),i('HALT')],
  MANHATTAN:[i('PUSH_A'),i('DUP'),i('PUSH_0'),i('LT'),i('JZ',3),i('PUSH_0'),i('SWAP'),i('SUB'),i('STORE',0),i('PUSH_B'),i('DUP'),i('PUSH_0'),i('LT'),i('JZ',3),i('PUSH_0'),i('SWAP'),i('SUB'),i('LOAD',0),i('ADD'),i('HALT')]
};
const library={};for(const [name,program] of Object.entries(programs))library[name]={program,report:evaluateProgram(program,name,VERIFY_CASES)};
for(const project of PROJECTS)assert.equal(projectReady(project,library),true,`${project.title} should be runnable from verified primitive modules`);
assert.ok(PROJECTS.length>=10,'project ladder should include training games, world tools, utilities and simulations');

const walker=createProjectState('HAPPY_WALKER');stepProject(walker,library,1);assert.equal(walker.x,11);stepProject(walker,library,-1);assert.equal(walker.x,10);
const chase=createProjectState('COIN_CHASE');chase.x=15;chase.coin=16;stepProject(chase,library,1);assert.equal(chase.score,1);
const sentinel=createProjectState('FLOOD_SENTINEL');for(let n=0;n<4;n++)stepProject(sentinel,library,0);assert.equal(sentinel.alarm,true,'flood sentinel must eventually trip above threshold');
const pump=createProjectState('PUMP_STATION');const beforeWater=pump.water;stepProject(pump,library,0);assert.ok(pump.water<beforeWater&&pump.pumped>0,'pump tool must actually remove water through evolved modules');
const bounce=createProjectState('BOUNCE_BOX');bounce.x=19;bounce.v=1;stepProject(bounce,library,0);assert.equal(bounce.v,-1);assert.equal(bounce.x,18);
const bot=createProjectState('TARGET_BOT');stepProject(bot,library,0);assert.equal(bot.x,3);
const tool=createProjectState('RANGE_TOOL');stepProject(tool,library,0);assert.deepEqual(tool.result,{high:7,low:-3,distance:10});
const route=createProjectState('ROUTE_PLANNER');stepProject(route,library,0);assert.deepEqual(route.result,{a:11,b:12,best:'A',difference:1});
const maze=createProjectState('MAZE_SCOUT');stepProject(maze,library,0);assert.equal(maze.x,2);assert.equal(maze.y,1);
const particles=createProjectState('PARTICLE_BOX');stepProject(particles,library,0);assert.equal(particles.x1,4);assert.equal(particles.x2,16);
const swarm=createProjectState('SWARM_LAB');const before=swarm.agents.slice();stepProject(swarm,library,0);assert.ok(swarm.agents.some((x,j)=>x!==before[j]));

const world=createWorld(123),sampleAgent={id:1,alive:true,x:600,y:400,lastAction:'EXPLORE',energy:80};
const rows=makeAsciiFrame(world,[sampleAgent],1);assert.equal(rows.length,MAP_ROWS);assert.equal(rows[0].length,MAP_COLS);assert.ok(rows.join('\n').includes('☻'),'selected person should be visible');
assert.ok(rows.join('\n').includes('~'),'river should be visible in ASCII geography');
console.log(`PASS: ${PROJECTS.length} runnable builds + ${MAP_COLS}x${MAP_ROWS} multi-biome ASCII world.`);
