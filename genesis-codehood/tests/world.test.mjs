import assert from 'node:assert/strict';
import { createWorld, CHUNK_COUNT, DISTRICT_TYPES, chunkIndexFor, rebuildOccupancy, takeChunkBatch, updateEnvironment } from '../src/world.js';
import { createBrain, chooseAction, ACTIONS } from '../src/brain.js';

const w=createWorld(123);
assert.equal(w.chunks.length,CHUNK_COUNT);
assert.equal(chunkIndexFor(0,0),0);
assert.equal(chunkIndexFor(1199,799),CHUNK_COUNT-1);

const types=new Set(w.chunks.map(c=>c.type));
assert.ok(types.size>=4,'generated world should contain multiple meaningful district types');
for(const type of types)assert.ok(DISTRICT_TYPES.includes(type),`unknown district type ${type}`);

const farm=w.chunks.find(c=>c.type==='FARM');
const home=w.chunks.find(c=>c.type==='HOME');
const lab=w.chunks.find(c=>c.type==='LAB');
const park=w.chunks.find(c=>c.type==='PARK');
assert.ok(farm&&home&&lab&&park,'test seed should generate farm/home/lab/park districts');
assert.ok(farm.food>.70,'farm art must correspond to a real food-rich district');
assert.ok(home.shelter>.70,'home art must correspond to real shelter');
assert.ok(lab.jobs>park.jobs,'lab must provide more work/training opportunity than a park');
assert.equal(lab.learning,1,'lab district must carry a learning semantic');

const beforeFood=farm.food;
updateEnvironment(farm,{floodLevel:0,rain:0});
assert.ok(farm.food>=beforeFood,'dry farm should regenerate food');
updateEnvironment(farm,{floodLevel:1,rain:1});
assert.ok(farm.flood>0,'storm should create real flood state');

const agents=[{alive:true,x:10,y:10},{alive:true,x:1100,y:700},{alive:false,x:5,y:5}];
rebuildOccupancy(w,agents);
assert.equal(w.chunks.reduce((n,c)=>n+c.agents.length,0),2);
const batch=takeChunkBatch(w,8);assert.equal(batch.length,8);

let seed=.314159;
const rng=()=>{seed=(seed*9301+49297)%233280;return seed/233280;};
const brain=createBrain(rng);
assert.equal(brain.length,63);
assert.ok(ACTIONS.includes(chooseAction(brain,{hunger:1,food:1},rng)));
console.log(`PASS: ${CHUNK_COUNT} chunk fortress world with semantic districts, occupancy, scheduler, flooding and evolving survival brain.`);
