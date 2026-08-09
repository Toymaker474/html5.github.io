(function(root,factory){
  if(typeof module==='object'&&module.exports){module.exports=factory(require('./model.js'),require('./topology.js'));}
  else{root.GenesisMatterAssembly=factory(root.GenesisMatter,root.GenesisMatterTopology);}
})(typeof globalThis!=='undefined'?globalThis:this,function(api,topology){
'use strict';
if(!api||!api.MatterWorld||!topology)throw new Error('GenesisMatter + topology APIs required');
const {MatterWorld,MODEL,SPECIES}=api;
const {VALENCE,degreeArray,topologySnapshot}=topology;
const pairKey=(i,j)=>i<j?i+':'+j:j+':'+i;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;

function adjacency(world){const a=Array.from({length:world.count},()=>[]);for(const b of world.associations.values()){a[b.i].push(b.j);a[b.j].push(b.i);}return a;}
function pathWithin(adj,start,target,limit=4){if(start===target)return 0;const seen=new Set([start]),q=[[start,0]];while(q.length){const [n,d]=q.shift();if(d>=limit)continue;for(const m of adj[n]){if(m===target)return d+1;if(!seen.has(m)){seen.add(m);q.push([m,d+1]);}}}return Infinity;}
function assemblySnapshot(world){const t=topologySnapshot(world);let closureEdges=0,cooperativeEdges=0;for(const b of world.associations.values()){if(b.assemblyOrigin==='closure')closureEdges++;else if(b.assemblyOrigin==='cooperative')cooperativeEdges++;}const active=Math.max(1,t.activeVertices);return{enabled:world.assemblyEnabled,strength:world.assemblyStrength,closureEdges,cooperativeEdges,assemblyEdges:closureEdges+cooperativeEdges,edgeDensity:t.edges/active,cycleDensity:t.cycleRank/active,largestComponent:t.largestComponent,cycles:t.cycleRank};}

const baseUpdate=MatterWorld.prototype._updateAssociations;
const baseSnapshot=MatterWorld.prototype.snapshot;
const baseInvariant=MatterWorld.prototype.invariantReport;
const BaseCtorDefaults={enabled:true,strength:4.0};

MatterWorld.prototype.setAssembly=function(o={}){if(o.enabled!==undefined)this.assemblyEnabled=!!o.enabled;if(o.strength!==undefined)this.assemblyStrength=clamp(+o.strength||0,0,20);return assemblySnapshot(this);};
MatterWorld.prototype.assemblySnapshot=function(){return assemblySnapshot(this);};
MatterWorld.prototype._assemblyClosurePass=function(dt){
  if(!this.assemblyEnabled||this.assemblyStrength<=0||!this.associationEnabled)return 0;
  const deg=degreeArray(this),adj=adjacency(this),candidates=[];
  for(let i=0;i<this.count;i++)for(let j=i+1;j<this.count;j++){
    if(this.associations.has(pairKey(i,j)))continue;
    const a=this.particles[i],b=this.particles[j];if(a.species===b.species)continue;
    if(deg[i]>=VALENCE[a.species]||deg[j]>=VALENCE[b.species])continue;
    const sa=SPECIES[a.species],sb=SPECIES[b.species],sigma=.5*(sa.sigma+sb.sigma),d=this.displacement(a,b),r=Math.hypot(d.x,d.y),capture=1.52*sigma;
    if(r>=capture||r<=.58*sigma)continue;
    const path=pathWithin(adj,i,j,4),closure=Number.isFinite(path)&&path>=2;
    const cooperative=!closure&&(deg[i]>0||deg[j]>0);
    if(!closure&&!cooperative)continue;
    candidates.push({i,j,sigma,r,capture,closure,path,score:(closure?2.2:0.65)+0.18*(deg[i]+deg[j])+(1-r/capture)});
  }
  candidates.sort((a,b)=>b.score-a.score||a.i-b.i||a.j-b.j);
  let added=0;
  for(const c of candidates){const a=this.particles[c.i],b=this.particles[c.j];if(this.associations.has(pairKey(c.i,c.j)))continue;if(deg[c.i]>=VALENCE[a.species]||deg[c.j]>=VALENCE[b.species])continue;
    const proximity=1-c.r/c.capture,cold=clamp(.55/(.18+this.temperature()),.35,2.4),rate=(c.closure?180:55)*this.assemblyStrength,prob=1-Math.exp(-rate*Math.max(.05,proximity)*cold*dt);
    if(this.rng()<prob){const bond={i:c.i,j:c.j,age:0,r0:1.08*c.sigma,sigma:c.sigma,createdStep:this.stepIndex,reacted:false,assemblyOrigin:c.closure?'closure':'cooperative'};this.associations.set(pairKey(c.i,c.j),bond);deg[c.i]++;deg[c.j]++;adj[c.i].push(c.j);adj[c.j].push(c.i);this.associationFormed++;added++;}
  }
  return added;
};
MatterWorld.prototype._updateAssociations=function(dt){if(this.assemblyEnabled===undefined)this.assemblyEnabled=BaseCtorDefaults.enabled;if(this.assemblyStrength===undefined)this.assemblyStrength=BaseCtorDefaults.strength;baseUpdate.call(this,dt);this._assemblyClosurePass(dt);};
MatterWorld.prototype.snapshot=function(){const s=baseSnapshot.call(this),a=assemblySnapshot(this);s.assemblyEdges=a.assemblyEdges;s.closureEdges=a.closureEdges;s.cooperativeEdges=a.cooperativeEdges;s.cycleDensity=a.cycleDensity;return s;};
MatterWorld.prototype.invariantReport=function(){const r=baseInvariant.call(this),a=assemblySnapshot(this);let tagsValid=true;for(const b of this.associations.values())if(b.assemblyOrigin!==undefined&&b.assemblyOrigin!=='closure'&&b.assemblyOrigin!=='cooperative')tagsValid=false;return{...r,assemblyTagsValid:tagsValid,assemblyEdges:a.assemblyEdges,status:r.status==='PASS'&&tagsValid?'PASS':'FAIL'};};

MODEL.id='genesis-matter-lj2d-v6';
MODEL.name='GENESIS Matter Lab — coarse matter + cooperative topology assembly';
MODEL.claims=(MODEL.claims||[]).concat(['toy cooperative topology-driven self-assembly bias','tagged closure/cooperative assembly edges']);
MODEL.nonClaims=(MODEL.nonClaims||[]).concat(['not lipid membrane thermodynamics','not validated molecular self-assembly']);
return{assemblySnapshot,pathWithin};
});
