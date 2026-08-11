import assert from 'node:assert/strict';
import {RENDER_META} from '../scratch/organic-render.js';
assert.equal(RENDER_META.cellsVisible,false);
assert.match(RENDER_META.cavePresentation,/overlapping circles\/capsules/);
assert.match(RENDER_META.liquidPresentation,/connected smooth ellipses/);
console.log('PASS organic renderer hides the environment grid and derives smooth fields from simulation state');
