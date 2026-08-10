import assert from 'node:assert/strict';
import { evaluateProgram,VERIFY_CASES } from '../src/tasks.js';
import { attachCavemanIdentity,createChronicle,createTribeState,runGamerSoftware,applyFireKeeper,syncInventions,updateClock } from '../src/caveman.js';

const p=(ops)=>ops.map(op=>({op,arg:0}));
const programs={
  STEP_RIGHT:p(['PUSH_A','PUSH_1','ADD','HALT']),
  STEP_LEFT:p(['PUSH_A','PUSH_1','SUB','HALT']),
  ADD_SCORE:p(['PUSH_A','PUSH_B','ADD','HALT']),
  HIT_TEST:p(['PUSH_A','PUSH_B','EQ','HALT']),
  PICK_LOW:[{op:'PUSH_A',arg:0},{op:'PUSH_B',arg:0},{op:'LT',arg:0},{op:'JZ',arg:2},{op:'PUSH_A',arg:0},{op:'HALT',arg:0},{op:'PUSH_B',arg:0},{op:'HALT',arg:0}]
};
const library={};
for(const [name,program] of Object.entries(programs))library[name]={program,report:evaluateProgram(program,name,VERIFY_CASES)};

const chronicle=createChronicle();
syncInventions(chronicle,library,0);
const gamer=attachCavemanIdentity({id:5,name:'Sol',lifeRole:'GAMER',morale:50},4);
const played=runGamerSoftware(gamer,library,chronicle,1);
assert.equal(played.used,true,'gamer NPC must execute a verified game');
assert.ok(gamer.gamesPlayed>0,'game use must be counted on NPC');
assert.ok(gamer.softwareUses>0,'software use must be counted on NPC');
assert.ok(gamer.morale>50,'playing verified software must affect NPC morale');

const plain=createTribeState();plain.wood=10;plain.fire=60;
const plainBurn=applyFireKeeper(plain,{},createChronicle(),4);
const smart=createTribeState();smart.wood=10;smart.fire=60;
const smartChronicle=createChronicle();syncInventions(smartChronicle,library,0);
const smartBurn=applyFireKeeper(smart,library,smartChronicle,4);
assert.ok(smartBurn<=plainBurn,'verified Fire Keeper code must not waste more wood than fallback behavior');
assert.ok(smartChronicle.entries.some(e=>e.text.includes('campfire')),'real world software use must enter history');

updateClock(chronicle,96);
assert.equal(chronicle.year,1,'96 world sweeps should advance one history year');
console.log('PASS: caveman history, gamer NPC software execution, and Fire Keeper world software are real runtime systems.');
