import assert from 'node:assert/strict';
import {createWorld,simulateSeconds,applyDamage,placeFoodAt,placeFoodInMouth,snapshot,invariants,NODE} from './model.js';

function run(name,fn){try{fn();console.log('PASS',name)}catch(e){console.error('FAIL',name,'\n ',e.message);process.exitCode=1}}

run('A body conservation/invariants',()=>{
  const w=createWorld(101);simulateSeconds(w,8);const inv=invariants(w);assert.equal(inv.pass,true,inv.failures.join(','));
});

run('B muscle force actually moves body',()=>{
  const w=createWorld(102);placeFoodAt(w,1000,500);const x0=w.body.x[NODE.PELVIS];simulateSeconds(w,7);const dx=w.body.x[NODE.PELVIS]-x0;assert.ok(Math.abs(dx)>15,`expected muscle gait displacement magnitude >15, got ${dx}`);
});

run('C damaged limb reduces locomotion',()=>{
  const healthy=createWorld(103), injured=createWorld(103);placeFoodAt(healthy,1000,500);placeFoodAt(injured,1000,500);
  applyDamage(injured,'leftKnee',.82,0);applyDamage(injured,'leftFoot',.72,0);
  simulateSeconds(healthy,8);simulateSeconds(injured,8);
  const hd=healthy.body.x[NODE.PELVIS]-150,id=injured.body.x[NODE.PELVIS]-150;
  assert.ok(Math.abs(hd)>15,`healthy gait too weak ${hd}`);assert.ok(Math.abs(id)<Math.abs(hd)*.55,`injured ${id} not measurably below healthy ${hd}`);
});

run('D food cannot become energy without ingestion',()=>{
  const w=createWorld(104);placeFoodAt(w,900,500);const e0=w.body.energy;simulateSeconds(w,4);
  assert.equal(w.body.stomach.contentsMass,0);assert.equal(w.metrics.totalDigestedEnergy,0);assert.ok(w.body.energy<e0);
});

run('E physical ingestion then digestion releases energy over time',()=>{
  const w=createWorld(105);w.body.energy=35;placeFoodInMouth(w);simulateSeconds(w,1.8);
  assert.ok(w.metrics.mouthContacts>=1,'food never physically captured');assert.ok(w.metrics.swallows>=1,'food never reached stomach');
  const swallowedEnergy=w.body.energy,dig0=w.metrics.totalDigestedEnergy;simulateSeconds(w,4);
  assert.ok(w.metrics.totalDigestedEnergy>dig0+2,'digestion did not release gradual energy');assert.ok(w.body.energy>swallowedEnergy,'energy did not rise after digestion');
});

run('F blood loss affects performance/state',()=>{
  const w=createWorld(106);placeFoodAt(w,1000,500);applyDamage(w,'torso',.35,.22);simulateSeconds(w,3.6);
  assert.ok(w.body.bloodVolume<.3,`blood did not fall enough: ${w.body.bloodVolume}`);assert.equal(w.body.unconscious,true);
  simulateSeconds(w,1.2);assert.equal(w.body.alive,false);assert.equal(w.body.causeOfDeath,'circulatory_failure');
});

run('F2 respiratory damage changes physiology',()=>{
  const w=createWorld(107);placeFoodAt(w,1000,500);applyDamage(w,'torso',.9,0);const o0=w.body.oxygenation;simulateSeconds(w,2.5);
  assert.ok(w.body.respiration.integrity<.6,'lung integrity did not change');assert.ok(w.body.oxygenation<o0-.15,`oxygenation did not fall: ${w.body.oxygenation}`);
});

run('N deterministic seed produces reproducible run',()=>{
  const a=createWorld(777),b=createWorld(777);placeFoodAt(a,1000,500);placeFoodAt(b,1000,500);simulateSeconds(a,5);simulateSeconds(b,5);assert.deepEqual(snapshot(a),snapshot(b));
});

if(process.exitCode)process.exit(process.exitCode);
