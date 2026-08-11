const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;

export function terrainProbe(world,wx){
  const x=clamp(wx/world.dx,1,world.n-2),i=x|0,t=x-i;
  const y=world.surfaceY(wx);
  const yl=world.surfaceY((i-1)*world.dx),yr=world.surfaceY((i+1)*world.dx);
  const slope=Math.abs(yr-yl)/(2*world.dx);
  const water=lerp(world.water[i],world.water[i+1],t);
  const root=lerp(world.rootStrength[i],world.rootStrength[i+1],t);
  const moisture=lerp(world.moisture[i],world.moisture[i+1],t);
  const unstable=clamp(moisture*.9-root*.32,0,1);
  return {x:wx,y,slope,water,root,moisture,unstable};
}

export function traversalCost(p){
  const slopeCost=p.slope*p.slope*2.4;
  const waterCost=p.water<1?0:p.water<5?p.water*.12:p.water<11?.75+(p.water-5)*.32:4+(p.water-11)*.8;
  return 1+slopeCost+waterCost+p.unstable*.55;
}

export function planSurfaceRoute(world,startX,goalX,opts={}){
  const step=opts.step||Math.max(12,world.dx*3),dir=Math.sign(goalX-startX)||1;
  const maxSlope=opts.maxSlope??1.35,maxWater=opts.maxWater??15;
  const distance=Math.abs(goalX-startX),count=Math.max(1,Math.ceil(distance/step));
  const points=[],limit=world.n*world.dx-6;let cost=0,reachable=true,blockageX=null;
  for(let k=0;k<=count;k++){
    const x=clamp(k===count?goalX:startX+dir*Math.min(distance,k*step),6,limit),p=terrainProbe(world,x);
    const blocked=p.slope>maxSlope||p.water>maxWater;
    cost+=traversalCost(p);points.push({...p,cost,blocked});
    if(blocked&&k>0){reachable=false;blockageX=x;points.length=Math.max(1,points.length-1);break;}
  }
  return {startX,goalX,points,reachable,blockageX,cost};
}

function rawDrive(c){
  const m=c.mind;
  return m.intent==='flee'?1.2:m.intent==='forage'?.8:m.intent==='drink'?.58:m.intent==='explore'?.52:0;
}

export function updateNavigator(world,c,dt,goalX){
  const m=c.mind,bodyX=c.nodes[2].x;
  if(!m.nav)m.nav={route:null,index:0,replan:0,waypointX:bodyX,steer:0,speed:0,blocked:false,lastGoal:goalX,heading:0};
  const n=m.nav;n.replan-=dt;
  const changed=Math.abs((n.lastGoal??goalX)-goalX)>world.dx*3;
  if(!n.route||changed||n.replan<=0){
    n.route=planSurfaceRoute(world,bodyX,goalX);n.index=0;n.replan=.28+.32*(1-m.curiosity);n.lastGoal=goalX;n.blocked=!n.route.reachable;
  }
  const pts=n.route.points;
  while(n.index<pts.length-1&&Math.abs(pts[n.index].x-bodyX)<world.dx*4)n.index++;
  const look=Math.min(pts.length-1,n.index+1),wp=pts[look]||{x:bodyX};
  const desiredDir=Math.abs(wp.x-bodyX)<world.dx*1.2?0:Math.sign(wp.x-bodyX);
  const steerRate=1-Math.exp(-dt*(n.blocked?2.8:4.2));n.steer=lerp(n.steer,desiredDir,steerRate);
  if(Math.abs(n.steer)<.12)n.steer=0;
  const committed=Math.abs(n.steer)>.42?Math.sign(n.steer):0;n.heading=committed;
  const probe=terrainProbe(world,bodyX+Math.sign(n.steer||c.dir)*world.dx*3);
  const hazardSlow=clamp(1-(probe.slope*.42+Math.max(0,probe.water-2)*.045+probe.unstable*.18),.2,1);
  const targetSpeed=rawDrive(c)*hazardSlow*(n.blocked?.45:1);
  n.speed=lerp(n.speed,targetSpeed,1-Math.exp(-dt*3.1));
  n.waypointX=wp.x;
  return {waypointX:n.waypointX,steer:n.steer,speed:n.speed,heading:n.heading,blocked:n.blocked,reachable:n.route.reachable};
}

export const NAV_META={
  kind:'terrain-aware side-view surface route planner',
  general2DNavmesh:false,
  hazards:['slope','water_depth','waterlogged_instability'],
  persistentWaypoints:true,
  smoothedSteering:true,
  committedHeadingTurns:true
};
