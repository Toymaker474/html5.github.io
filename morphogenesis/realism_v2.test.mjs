import fs from 'node:fs';
const src=fs.readFileSync(new URL('./js/realism_v2.js',import.meta.url),'utf8');
const must=['drawMuscleBands','drawGillMechanics','drawWetEyes','drawJawTissue','drawFinRays','drawSkinSheen','drawDigestiveBulge','Creature.prototype.draw','const baseRender=render'];
for(const s of must)if(!src.includes(s))throw new Error('missing '+s);
if(src.includes('Math.random'))throw new Error('renderer must not use random per-frame geometry');
console.log('realism_v2 contract PASS');
