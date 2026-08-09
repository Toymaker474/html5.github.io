(function(root,factory){
  if(typeof module==='object'&&module.exports){module.exports=factory(require('./model.js'));}
  else{root.GenesisMatterTopology=factory(root.GenesisMatter);}
})(typeof globalThis!=='undefined'?globalThis:this,function(api){
'use strict';
if(!api||!api.MatterWorld)throw new Error('GenesisMatter API required');
const {MatterWorld,MODEL,SPECIES}=api;
const VALENCE=[2,2,3];
const pairKey=(i,j)=>i<j?i+':'+j:j+':'+i;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
function degreeArray(world){const d=new Array(world.count).fill(0);for(const b of world.associations.values()){d[b.i]++;d[b.j]++;}return d;}
function syncParticleStates(world){const reacted=new Array(world.count).fill(false);for(const b of world.associations.values())if(b.reacted){reacted[b.i]=true;reacted[b.j]=true;}for(let i=0;i<world.count;i++)world.particles[i].state=reacted[i]?1:0;}
function topologySnapshot(world){
  const adjacency=Array.from({length:world.count},()=>[]);let edges=0;
  for(const b of world.associations.values()){adjacency[b.i].push(b.j);adjacency[b.j].push(b.i);edges++;}
  const visited=new Array(world.count).fill(false),sizes=[];let activeVertices=0,components=0;
  for(let i=0;i<world.count;i++)if(adjacency[i].length){activeVertices++;if(!visited[i]){components++;let size=0,stack=[i];visited[i]=true;while(stack.length){const n=stack.pop();size++;for(const m of adjacency[n])if(!visited[m]){visited[m]=true;stack.push(m);}}sizes.push(size);}}
  const degrees=adjacency.map(a=>a.length),largest=sizes.length?Math.max(...sizes):0,cycleRank=Math.max(0,edges-activeVertices+components);
  return{edges,activeVertices,components,largestComponent:largest,cycleRank,componentSizes:sizes.sort((a,b)=>b-a),degrees,maxDegree:degrees.length?Math.max(...degrees):0,valenceLimits:VALENCE.slice()};
}

const baseBreakAll=MatterWorld.prototype.breakAllAssociations;
MatterWorld.prototype._syncParticleStates=function(){syncParticleStates(this);};
MatterWorld.prototype._activate=function(b){if(b.reacted)return false;b.reacted=true;this.reactionsForward++;this._recordReaction('FORWARD',b);syncParticleStates(this);return true;};
MatterWorld.prototype._deactivate=function(b,reason='dissociation'){if(!b.reacted)return false;b.reacted=false;this.reactionsReverse++;const ev=this._recordReaction('REVERSE',b);ev.reason=reason;syncParticleStates(this);return true;};
MatterWorld.prototype.breakAllAssociations=function(reason='manual'){const out=baseBreakAll.call(this,reason);syncParticleStates(this);return out;};
MatterWorld.prototype.topologySnapshot=function(){return topologySnapshot(this);};

MatterWorld.prototype._updateAssociations=function(dt){
  for(const [k,b] of Array.from(this.associations)){
    b.age+=dt;
    if(this.reactionEnabled&&!b.reacted&&b.age>=this.activationAge){const p=1-Math.exp(-this.reactionRate*dt);if(this.rng()<p)this._activate(b);}
    const d=this.displacement(this.particles[b.i],this.particles[b.j]),r=Math.hypot(d.x,d.y),stretch=Math.max(0,r/b.r0-1),haz=this.dissociationRate*(1+2.8*stretch*stretch)*Math.max(.2,this.temperature()/.42),pBreak=1-Math.exp(-haz*dt);
    if(this.rng()<pBreak){this._deactivate(b,'dissociation');this.associations.delete(k);this.associationBroken++;this.associationLifetimeTotal+=b.age;syncParticleStates(this);}
  }
  if(!this.associationEnabled||this.associationRate<=0)return;
  const degree=degreeArray(this),order=[];
  for(let i=0;i<this.count;i++)for(let j=i+1;j<this.count;j++)order.push([i,j]);
  for(let i=order.length-1;i>0;i--){const j=Math.floor(this.rng()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
  for(const [i,j] of order){
    if(this.associations.has(pairKey(i,j)))continue;
    const a=this.particles[i],b=this.particles[j];
    if(a.species===b.species)continue;
    if(degree[i]>=VALENCE[a.species]||degree[j]>=VALENCE[b.species])continue;
    const sa=SPECIES[a.species],sb=SPECIES[b.species],sigma=.5*(sa.sigma+sb.sigma),d=this.displacement(a,b),r=Math.hypot(d.x,d.y),capture=1.42*sigma;
    if(r>=capture||r<=.55*sigma)continue;
    const proximity=1-r/capture,cold=clamp(.55/(.18+this.temperature()),.35,2.4),p=1-Math.exp(-this.associationRate*proximity*cold*dt);
    if(this.rng()<p){const bond={i,j,age:0,r0:1.08*sigma,sigma,createdStep:this.stepIndex,reacted:false};this.associations.set(pairKey(i,j),bond);degree[i]++;degree[j]++;this.associationFormed++;}
  }
};

const baseSnapshot=MatterWorld.prototype.snapshot;
MatterWorld.prototype.snapshot=function(){const s=baseSnapshot.call(this),t=topologySnapshot(this);s.topologyEdges=t.edges;s.topologyComponents=t.components;s.largestComponent=t.largestComponent;s.cycleRank=t.cycleRank;s.maxDegree=t.maxDegree;globalThis.GenesisMatterLatestTopology=t;return s;};

MatterWorld.prototype.invariantReport=function(){
  let finite=true,bounds=true,associationsValid=true,stateValid=true;const degree=new Array(this.count).fill(0),reacted=new Array(this.count).fill(false),seen=new Set();
  for(const p of this.particles){finite&&=Number.isFinite(p.x+p.y+p.vx+p.vy);bounds&&=p.x>=0&&p.x<this.width&&p.y>=0&&p.y<this.height;stateValid&&=(p.state===0||p.state===1);}
  for(const [k,b] of this.associations){const expected=pairKey(b.i,b.j);if(k!==expected||seen.has(expected)||b.i===b.j||b.i<0||b.j<0||b.i>=this.count||b.j>=this.count)associationsValid=false;seen.add(expected);if(this.particles[b.i].species===this.particles[b.j].species)associationsValid=false;degree[b.i]++;degree[b.j]++;if(b.reacted){reacted[b.i]=true;reacted[b.j]=true;}}
  for(let i=0;i<this.count;i++){if(degree[i]>VALENCE[this.particles[i].species])associationsValid=false;if(this.particles[i].state!==(reacted[i]?1:0))stateValid=false;}
  const counts=this._stateCounts(),particleCountConserved=counts.total===this.count,t=topologySnapshot(this),topologyConsistent=t.edges===this.associations.size&&t.maxDegree===Math.max(0,...degree);
  return{finite,bounds,associationsValid,stateValid,particleCountConserved,topologyConsistent,maxDegree:t.maxDegree,cycleRank:t.cycleRank,status:finite&&bounds&&associationsValid&&stateValid&&particleCountConserved&&topologyConsistent?'PASS':'FAIL'};
};

MODEL.id='genesis-matter-lj2d-v5';
MODEL.name='GENESIS Matter Lab — coarse matter + toy reaction topology';
MODEL.claims=(MODEL.claims||[]).concat(['bounded multi-particle association topology','connected-component and cycle-rank diagnostics']);
MODEL.nonClaims=(MODEL.nonClaims||[]).concat(['not molecular graph chemistry','toy valence limits are not chemical valence']);
return{VALENCE,degreeArray,topologySnapshot};
});
