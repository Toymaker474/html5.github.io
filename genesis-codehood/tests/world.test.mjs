import assert from 'node:assert/strict';
import { createWorld, CHUNK_COUNT, chunkIndexFor, rebuildOccupancy, takeChunkBatch } from '../src/world.js';
import { createBrain, chooseAction, ACTIONS } from '../src/brain.js';
const w=createWorld(123);assert.equal(w.chunks.length,CHUNK_COUNT);assert.equal(chunkIndexFor(0,0),0);assert.equal(chunkIndexFor(1199,799),CHUNK_COUNT-1);
const agents=[{alive:true,x:10,y:10},{alive:true,x:1100,y:700},{alive:false,x:5,y:5}];rebuildOccupancy(w,agents);assert.equal(w.chunks.reduce((n,c)=>n+c.agents.length,0),2);
const batch=takeChunkBatch(w,8);assert.equal(batch.length,8);
let seed=.314159;const rng=()=>{seed=(seed*9301+49297)%233280;return seed/233280;};const brain=createBrain(rng);assert.equal(brain.length,63);assert.ok(ACTIONS.includes(chooseAction(brain,{hunger:1,food:1},rng)));
console.log(`PASS: ${CHUNK_COUNT} chunk world, occupancy, scheduler, evolving survival brain.`);
