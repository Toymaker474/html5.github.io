(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  root.GenesisMatter=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';

const MODEL={
  id:'genesis-matter-lj2d-v1',
  name:'GENESIS Matter Lab — coarse-grained 2D molecular dynamics',
  integrator:'velocity-verlet',
  potential:'Lennard-Jones 12-6, shifted at 2.5σ',
  dimensions:2,
  boundary:'reflective',
  units:'reduced Lennard-Jones units',
  claims:[
    'Classical coarse-grained particle dynamics',
    'Deterministic from seed on the same JavaScript numerical path',
    'Energy-conserving mode when thermostat strength is zero, within numerical integration error'
  ],
  nonClaims:['Not quantum chemistry','Not literal atoms','Not chemical reactions','Not life or evolution']
};
const SPECIES=[
  {id:0,name:'A',mass:1.00,sigma:0.030,epsilon:1.00},
  {id:1,name:'B',mass:1.35,sigma:0.034,epsilon:0.78},
  {id:2,name:'C',mass:0.82,sigma:0.027,epsilon:1.18}
];
function xorshift32(seed){let s=(seed>>>0)||0x6d2b79f5;return()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return(s>>>0)/4294967296}}
function gaussian(rng){let u=0,v=0;while(u===0)u=rng();while(v===0)v=rng();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}
function clamp(v,a,b){return v<a?a:v>b?b:v}
class MatterWorld{
  constructor(options={}){
    this.width=options.width||1;this.height=options.height||0.62;this.count=Math.max(8,Math.min(256,options.count||120));this.seed=(options.seed??0x51a7c0de)>>>0;this.attraction=options.attraction??1;this.cutoffScale=2.5;this.stepIndex=0;this.time=0;this.interventions=0;this.rng=xorshift32(this.seed);this.particles=[];this._potential=0;this._virial=0;this._init(options.temperature??0.42);this._forces=this.particles.map(()=>({x:0,y:0}));this.computeForces();
  }
  _init(temp){
    const aspect=this.width/this.height,cols=Math.ceil(Math.sqrt(this.count*aspect)),rows=Math.ceil(this.count/cols),sx=this.width/(cols+1),sy=this.height/(rows+1);let i=0;
    for(let r=0;r<rows&&i<this.count;r++)for(let c=0;c<cols&&i<this.count;c++){const sp=i%3,s=SPECIES[sp],jitter=.10*Math.min(sx,sy);this.particles.push({x:(c+1)*sx+(this.rng()-.5)*jitter,y:(r+1)*sy+(this.rng()-.5)*jitter,vx:gaussian(this.rng)*Math.sqrt(temp/s.mass),vy:gaussian(this.rng)*Math.sqrt(temp/s.mass),species:sp});i++}
    this._removeDrift();this._rescaleTemperature(temp);
  }
  _removeDrift(){let px=0,py=0,m=0;for(const p of this.particles){const sm=SPECIES[p.species].mass;px+=p.vx*sm;py+=p.vy*sm;m+=sm}if(m<=0)return;const vx=px/m,vy=py/m;for(const p of this.particles){p.vx-=vx;p.vy-=vy}}
  _rescaleTemperature(target){const t=this.temperature();if(!(t>0))return;const scale=Math.sqrt(target/t);for(const p of this.particles){p.vx*=scale;p.vy*=scale}}
  setAttraction(v){this.attraction=clamp(Number(v)||1,.15,2.5);this.computeForces()}
  kineticEnergy(){let e=0;for(const p of this.particles){const m=SPECIES[p.species].mass;e+=.5*m*(p.vx*p.vx+p.vy*p.vy)}return e}
  temperature(){return this.kineticEnergy()/this.count}
  potentialEnergy(){return this._potential}
  totalEnergy(){return this.kineticEnergy()+this._potential}
  computeForces(){
    const n=this.particles.length;if(!this._forces||this._forces.length!==n)this._forces=this.particles.map(()=>({x:0,y:0}));for(let i=0;i<n;i++){this._forces[i].x=0;this._forces[i].y=0}let potential=0,virial=0;
    for(let i=0;i<n;i++){const a=this.particles[i],sa=SPECIES[a.species];for(let j=i+1;j<n;j++){const b=this.particles[j],sb=SPECIES[b.species];let dx=b.x-a.x,dy=b.y-a.y,r2=dx*dx+dy*dy;const sigma=.5*(sa.sigma+sb.sigma),cutoff=this.cutoffScale*sigma;if(r2>=cutoff*cutoff)continue;const minR=.38*sigma;if(r2<minR*minR)r2=minR*minR;const invR2=1/r2,sr2=(sigma*sigma)*invR2,sr6=sr2*sr2*sr2,sr12=sr6*sr6,eps=this.attraction*Math.sqrt(sa.epsilon*sb.epsilon),forceScalar=24*eps*invR2*(2*sr12-sr6),fx=forceScalar*dx,fy=forceScalar*dy;this._forces[i].x-=fx;this._forces[i].y-=fy;this._forces[j].x+=fx;this._forces[j].y+=fy;const src2=1/(this.cutoffScale*this.cutoffScale),src6=src2*src2*src2,src12=src6*src6,uShift=4*eps*(src12-src6);potential+=4*eps*(sr12-sr6)-uShift;virial+=dx*fx+dy*fy}}
    this._potential=potential;this._virial=virial;return this._forces;
  }
  step(dt=.00035,options={}){
    dt=clamp(Number(dt)||.00035,.00005,.0012);const old=this._forces;
    for(let i=0;i<this.particles.length;i++){const p=this.particles[i],m=SPECIES[p.species].mass;p.vx+=.5*(old[i].x/m)*dt;p.vy+=.5*(old[i].y/m)*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.x<0){p.x=-p.x;p.vx=Math.abs(p.vx)}else if(p.x>this.width){p.x=2*this.width-p.x;p.vx=-Math.abs(p.vx)}if(p.y<0){p.y=-p.y;p.vy=Math.abs(p.vy)}else if(p.y>this.height){p.y=2*this.height-p.y;p.vy=-Math.abs(p.vy)}}
    this.computeForces();
    for(let i=0;i<this.particles.length;i++){const p=this.particles[i],m=SPECIES[p.species].mass;p.vx+=.5*(this._forces[i].x/m)*dt;p.vy+=.5*(this._forces[i].y/m)*dt}
    const strength=clamp(Number(options.thermostatStrength)||0,0,.08),target=clamp(Number(options.targetTemperature)||.42,.02,3);if(strength>0){const t=this.temperature();if(t>1e-12){const factor=clamp(Math.sqrt(1+strength*(target/t-1)),.94,1.06);for(const p of this.particles){p.vx*=factor;p.vy*=factor}}}
    this.stepIndex++;this.time+=dt;return this.snapshot();
  }
  impulse(x,y,strength=.8,radius=.16){x=clamp(x,0,this.width);y=clamp(y,0,this.height);radius=Math.max(.02,radius);let touched=0;for(const p of this.particles){const dx=p.x-x,dy=p.y-y,d=Math.hypot(dx,dy);if(d>0&&d<radius){const w=(1-d/radius)*strength;p.vx+=(dx/d)*w;p.vy+=(dy/d)*w;touched++}}this.interventions++;return touched}
  pressureEstimate(){return (this.count*this.temperature()+.5*this._virial)/(this.width*this.height)}
  snapshot(){return{model:MODEL.id,seed:this.seed,count:this.count,step:this.stepIndex,time:this.time,temperature:this.temperature(),kinetic:this.kineticEnergy(),potential:this._potential,total:this.totalEnergy(),pressure:this.pressureEstimate(),attraction:this.attraction,interventions:this.interventions}}
  invariantReport(){let finite=true,bounds=true,maxSpeed=0;for(const p of this.particles){if(!Number.isFinite(p.x+p.y+p.vx+p.vy))finite=false;if(p.x<0||p.x>this.width||p.y<0||p.y>this.height)bounds=false;maxSpeed=Math.max(maxSpeed,Math.hypot(p.vx,p.vy))}return{finite,bounds,maxSpeed,status:finite&&bounds?'PASS':'FAIL'}}
  hash(){let h=2166136261>>>0;const mix=n=>{h^=n>>>0;h=Math.imul(h,16777619)>>>0};for(const p of this.particles){mix(Math.round(p.x*1e6));mix(Math.round(p.y*1e6));mix(Math.round(p.vx*1e6));mix(Math.round(p.vy*1e6));mix(p.species)}mix(this.stepIndex);return h>>>0}
}
return{MODEL,SPECIES,MatterWorld};
});
