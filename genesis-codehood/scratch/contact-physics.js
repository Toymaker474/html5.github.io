const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const EPS=1e-9;

export function terrainFrame(world,x){
  const e=Math.max(1,world.dx*.75),xl=clamp(x-e,0,world.n*world.dx-1),xr=clamp(x+e,0,world.n*world.dx-1);
  const slope=(world.surfaceY(xr)-world.surfaceY(xl))/Math.max(EPS,xr-xl),inv=1/Math.sqrt(1+slope*slope);
  return{tx:inv,ty:slope*inv,nx:slope*inv,ny:-inv,slope};
}

export function terrainMaterial(world,x){
  const u=clamp(x/world.dx,0,world.n-1.001),i=u|0,t=u-i;
  const mix=(a)=>a[i]+(a[i+1]-a[i])*t;
  const moisture=mix(world.moisture),root=mix(world.rootStrength),sediment=mix(world.sediment);
  const wet=clamp(moisture+Math.min(1,mix(world.water)/8)*.65,0,1);
  const loose=clamp(sediment*.18+(1-root*.28),0,1);
  const muStatic=clamp(.92-root*.04-wet*.5-loose*.16,.18,.92);
  const muKinetic=clamp(muStatic*.72,.12,.72);
  return{moisture,root,sediment,wet,loose,muStatic,muKinetic};
}

export function pointVelocity(p,dt){const inv=1/Math.max(EPS,dt);return{x:(p.x-p.px)*inv,y:(p.y-p.py)*inv};}
export function applyVelocityDelta(p,dvx,dvy,dt){p.px-=dvx*dt;p.py-=dvy*dt;}

export function solveTerrainContact(world,p,dt,opts={}){
  const frame=terrainFrame(world,p.x),sy=world.surfaceY(p.x),gx=p.x,gy=sy;
  const dx=p.x-gx,dy=p.y-gy,signed=dx*frame.nx+dy*frame.ny;
  if(signed>=0)return{contact:false,penetration:0,normalDeltaV:0,tangentDeltaV:0,...frame,...terrainMaterial(world,p.x)};
  const penetration=-signed;p.x+=frame.nx*penetration;p.y+=frame.ny*penetration;
  const v=pointVelocity(p,dt),vn=v.x*frame.nx+v.y*frame.ny,vt=v.x*frame.tx+v.y*frame.ty;
  const restitution=clamp(opts.restitution??0,0,.45),normalDeltaV=vn<0?-(1+restitution)*vn:0;
  if(normalDeltaV>0)applyVelocityDelta(p,frame.nx*normalDeltaV,frame.ny*normalDeltaV,dt);
  const mat=terrainMaterial(world,p.x),staticLimit=mat.muStatic*normalDeltaV;
  let tangentDeltaV=0;if(Math.abs(vt)<=staticLimit)tangentDeltaV=-vt;else tangentDeltaV=-Math.sign(vt)*Math.min(Math.abs(vt),mat.muKinetic*normalDeltaV);
  if(tangentDeltaV)applyVelocityDelta(p,frame.tx*tangentDeltaV,frame.ty*tangentDeltaV,dt);
  return{contact:true,penetration,normalDeltaV,tangentDeltaV,...frame,...mat};
}

export function stanceTraction(world,c,leg,demand,dt,opts={}){
  if(!leg.stance||demand<=0)return{applied:false,impulse:0,limit:0};
  const anchor=c.nodes[leg.anchor],foot=leg.foot,frame=terrainFrame(world,foot.x),mat=terrainMaterial(world,foot.x),stanceCount=Math.max(1,c.legs.reduce((n,l)=>n+(l.stance?1:0),0));
  const bodyMass=c.nodes.reduce((s,n)=>s+(n.m??1),0)+c.legs.length*.55;
  const supportForce=bodyMass*(opts.gravity??110)/stanceCount;
  const muscleForce=(opts.muscleForce??54)*clamp(demand,0,1.25)*clamp(.35+.65*c.energy,0,1)*clamp(1-c.fatigue*.62,.2,1);
  const frictionLimit=mat.muStatic*supportForce,force=Math.min(muscleForce,frictionLimit),impulse=force*dt;
  const dir=c.dir||1,dvx=frame.tx*dir*impulse,dvy=frame.ty*dir*impulse;
  applyVelocityDelta(anchor,dvx,dvy,dt);applyVelocityDelta(foot,-dvx,-dvy,dt);
  return{applied:true,impulse,limit:frictionLimit*dt,muStatic:mat.muStatic,supportForce,muscleForce,tx:frame.tx*dir,ty:frame.ty*dir};
}

export const CONTACT_PHYSICS_META={
  solver:'Verlet point-mass terrain contact with slope-normal projection, restitution and Coulomb static/kinetic friction',
  traction:'equal-and-opposite stance impulses capped by muscle force and friction-limited support force',
  terrainCoupling:['surface_slope','moisture','surface_water','roots','sediment'],
  externalPhysicsLibrary:false,
  rigidBodyClaim:false
};
