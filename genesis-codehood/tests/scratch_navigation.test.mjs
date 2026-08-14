import assert from 'node:assert/strict';
import {World} from '../scratch/sim-core.js';
import {planSurfaceRoute,updateNavigator,NAV_META} from '../scratch/navigation.js';

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
 const w=flatWorld(),c=w.creatures[0];c.mind.intent='explore';c.mind.goalX=c.nodes[2].x+300;c.mind.nav=null;const a=updateNavigator(w,c,1/60,c.mind.goalX);const b=updateNavigator(w,c,1/60,c.mind.goalX);assert.ok(a.steer>0&&a.steer<.25);assert.ok(b.steer>a.steer&&b.steer<.4);assert.ok(a.speed>0&&a.speed<.55,`first speed ${a.speed}`);assert.ok(b.speed>a.speed&&b.speed<.55,`second speed ${b.speed}`);console.log('PASS steering and locomotion speed ramp smoothly instead of snapping to cruise');
}
{
 const w=flatWorld(),c=w.creatures[0];c.mind.intent='explore';c.mind.goalX=c.nodes[2].x+240;c.mind.nav=null;for(let i=0;i<20;i++)updateNavigator(w,c,1/60,c.mind.goalX);const before=c.mind.nav.steer;c.mind.goalX=c.nodes[2].x-240;const after=updateNavigator(w,c,1/60,c.mind.goalX).steer;assert.ok(before>.45);assert.ok(after>-0.25,'direction should not flip to full reverse in one frame');console.log('PASS route reversal uses steering hysteresis rather than instant direction flipping');
}
assert.equal(NAV_META.general2DNavmesh,false);assert.equal(NAV_META.persistentWaypoints,true);assert.equal(NAV_META.smoothedSteering,true);assert.equal(NAV_META.straightLineTargeting,false);console.log('PASS navigation metadata refuses direct-target and general-navmesh claims');