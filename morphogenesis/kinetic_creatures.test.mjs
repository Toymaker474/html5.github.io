import fs from 'node:fs';
import assert from 'node:assert/strict';

const src=fs.readFileSync(new URL('./js/kinetic_creatures.js',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8');

for(const fn of ['drawEelPlan','drawLizardPlan','drawRayPlan','drawArmoredPlan','drawBellPlan']){
  assert.match(src,new RegExp(`function ${fn}\\(`),`${fn} must exist`);
}
assert.match(src,/Creature\.prototype\.draw=function\(\)/,'renderer must replace generic creature draw');
assert.match(src,/mouthOpen/,'jaw rendering must use live mouth state');
assert.match(src,/mind\?\.target/,'eyes must use cognition target when available');
assert.match(src,/wounds/,'wounds must remain visible');
assert.match(src,/photophores/,'genetic bioluminescence must remain supported');
assert.ok(!src.includes('Math.random()'),'render geometry must be deterministic per simulation state');

const living=index.indexOf('./js/living_art.js');
const kinetic=index.indexOf('./js/kinetic_creatures.js');
const audio=index.indexOf('./js/audio.js');
assert.ok(living>=0&&kinetic>living&&audio>kinetic,'kinetic renderer must load after living-art state and before UI/audio runtime');

console.log('KINETIC_CREATURE_RENDER_TEST PASS');
