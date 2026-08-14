import assert from 'node:assert/strict';
import {World} from '../scratch/sim-core.js';
import {planSurfaceRoute,updateNavigator,NAV_META} from '../scratch/navigation.js';
import {DeepWorld} from '../scratch/deep-world.js';
import {bindDeepToWorld} from '../scratch/deep-bind.js';

function flatWorld(){const w=new World({seed:77,n:120,dx:6,worldH:720,ocean:false});w.rain=0;for(let i=0;i<w.n;i++){w.bed[i]=300;w.rock[i]=270;w.water[i]=0;w.moisture[i]=.25;w.rootStrength[i]=0;}return w;}
{
 const w=flatWorld(),r=planSurfaceRoute(w,90,510);assert.equal(r.reachable,true);assert.ok(r.points.length>8);console.log('PASS navigation builds a stable traversable surface corridor');
}
{
 const w=flatWorld();for(let i=38;i<=43;i++)w.water[i]=22;const r=planSurfaceRoute(w,90,510);assert.equal(r.reachable,false);assert.ok(r.blockageX>180&&r.blockageX<330);console.log('PASS deep water is a real route blocker instead of a target-chasing jitter zone');
}
{
 const w=flatWorld();w.bed[51]=365;w.bed[52]=390;w.bed[53]=365;const r=planSurfaceRoute(w,120,510);assert.equal(r.reachable,false);console.log('PASS excessive terrain slope blocks the planned route');
}
{
 const w=flatWorld(),c=w.creatures[0];c.mind.intent='explore';c.mind.goalX=c.nodes[2].x+300;c.mind.nav=null;const first=updateNavigator(w,c,1/60,c.mind.goalX);assert.ok(first.steer>0&&first.steer<.25);assert.equal(first.speed,0,'speed must remain zero before turn commitment');let committed=null;for(let i=0;i<12;i++){const s=updateNavigator(w,c,1/60,c.mind.goalX);if(s.heading&&s.speed>0){committed=s;break}}assert.ok(committed,'heading should commit after steering accumulates');const s0=committed.speed,s1=updateNavigator(w,c,1/60,c.mind.goalX).speed,s2=updateNavigator(w,c,1/60,c.mind.goalX).speed;assert.ok(s0>0&&s0<.7,`commit speed ${s0}`);assert.ok(s1>s0&&s2>s1&&s2<.7,`${s0},${s1},${s2}`);console.log('PASS steering commits before locomotion and speed then ramps monotonically');
}
{
 const w=flatWorld(),c=w.creatures[0];c.mind.intent='explore';c.mind.goalX=c.nodes[2].x+240;c.mind.nav=null;for(let i=0;i<20;i++)updateNavigator(w,c,1/60,c.mind.goalX);const before=c.mind.nav.steer;c.mind.goalX=c.nodes[2].x-240;const after=updateNavigator(w,c,1/60,c.mind.goalX).steer;assert.ok(before>.45);assert.ok(after>-0.25,'direction should not flip to full reverse in one frame');console.log('PASS route reversal uses steering hysteresis rather than instant direction flipping');
}
{
 const w=flatWorld();w.deep=bindDeepToWorld(new DeepWorld({seed:77,cell:8,cols:90,rows:90,chunkSize:16}),w);const c=w.creatures[0];c.mind.intent='explore';c.mind.goalX=c.nodes[2].x+180;c.mind.nav=null;const s=updateNavigator(w,c,1/60,c.mind.goalX);assert.equal(s.kind,'surface');assert.notEqual(c.locomotionMode,'volume');console.log('PASS surface crawler refuses cave-cell A* route it cannot physically execute');
}
assert.equal(NAV_META.general2DNavmesh,false);assert.equal(NAV_META.persistentWaypoints,true);assert.equal(NAV_META.smoothedSteering,true);assert.equal(NAV_META.straightLineTargeting,false);assert.equal(NAV_META.deepRoutingRequiresCompatibleBody,true);console.log('PASS navigation metadata refuses direct-target and locomotion-mismatch claims');
