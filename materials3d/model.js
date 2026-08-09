(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.GenesisMaterials3D=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
class RNG{constructor(seed=0x9e3779b9){this.state=(seed>>>0)||0x9e3779b9;}u32(){let x=this.state;x^=x<<13;x^=x>>>17;x^=x<<5;this.state=x>>>0;return this.state;}float(){return this.u32()/4294967296;}}
class TerrainWorld{
  constructor({width=96,height=96,seed=0x3d5a17,cohesion=1}={}){
    this.width=Math.max(24,width|0);this.height=Math.max(24,height|0);this.size=this.width*this.height;this.seed=seed>>>0;this.rng=new RNG(this.seed);this.cohesion=clamp(+cohesion||0,0,2);
    this.sand=new Float32Array(this.size);this.water=new Float32Array(this.size);this.moisture=new Float32Array(this.size);this.rock=new Float32Array(this.size);this._moistureScratch=new Float32Array(this.size);
    this.stepIndex=0;this.lastSandMoves=0;this.lastWaterMoves=0;this.userEdits=0;
  }
  index(x,z){return z*this.width+x;}inside(x,z){return x>=0&&x<this.width&&z>=0&&z<this.height;}
  clear(){this.sand.fill(0);this.water.fill(0);this.moisture.fill(0);this.rock.fill(0);this.stepIndex=0;this.lastSandMoves=0;this.lastWaterMoves=0;this.userEdits=0;}
  surfaceAt(x,z){if(!this.inside(x,z))return 99;const i=this.index(x,z);return this.rock[i]+this.sand[i];}
  totalSurfaceAt(x,z){if(!this.inside(x,z))return 99;const i=this.index(x,z);return this.rock[i]+this.sand[i]+this.water[i];}
  seedScene(){
    this.clear();const w=this.width,h=this.height;
    for(let z=0;z<h;z++)for(let x=0;x<w;x++){
      const i=this.index(x,z),nx=(x/(w-1)-.5),nz=(z/(h-1)-.5);
      const ridge=.16*Math.sin(nx*9.0)+.11*Math.cos(nz*7.0)+.06*Math.sin((nx+nz)*15.0);
      this.rock[i]=.34+ridge;
      const dune1=Math.exp(-((nx+.18)*(nx+.18)*34+(nz+.05)*(nz+.05)*21))*4.1;
      const dune2=Math.exp(-((nx-.16)*(nx-.16)*55+(nz-.13)*(nz-.13)*36))*2.6;
      const dune3=Math.exp(-((nx+.02)*(nx+.02)*90+(nz-.26)*(nz-.26)*75))*1.7;
      this.sand[i]=Math.max(0,dune1+dune2+dune3-.10);
      const basin=Math.exp(-((nx-.24)*(nx-.24)*70+(nz+.22)*(nz+.22)*70));
      this.water[i]=basin>.24?Math.max(0,(basin-.24)*1.65):0;
      if(this.water[i]>.02)this.moisture[i]=.86;
    }
    return this.snapshot();
  }
  paint(kind,cx,cz,radius=5,amount=.8){radius=Math.max(1,radius|0);amount=+amount||0;let changed=0;
    for(let z=cz-radius;z<=cz+radius;z++)for(let x=cx-radius;x<=cx+radius;x++){
      if(!this.inside(x,z))continue;const dx=x-cx,dz=z-cz,d=Math.sqrt(dx*dx+dz*dz);if(d>radius)continue;const falloff=1-d/(radius+.001),i=this.index(x,z),a=amount*(.22+.78*falloff*falloff);
      if(kind==='sand'){this.sand[i]+=a;changed++;}
      else if(kind==='wet-sand'){this.sand[i]+=a;this.moisture[i]=Math.max(this.moisture[i],.96);changed++;}
      else if(kind==='water'){this.water[i]+=a*.72;changed++;}
      else if(kind==='rock'){this.rock[i]+=a*.72;changed++;}
      else if(kind==='dig'){const take=Math.min(this.sand[i],a);this.sand[i]-=take;this.water[i]=Math.max(0,this.water[i]-a*.35);changed++;}
    }this.userEdits+=changed;return changed;
  }
  _relaxSand(){const w=this.width,h=this.height,dirs=(this.stepIndex&1)?[[1,0],[0,1],[-1,0],[0,-1]]:[[-1,0],[0,-1],[1,0],[0,1]];this.lastSandMoves=0;
    for(let parity=0;parity<2;parity++)for(let z=1;z<h-1;z++)for(let x=1;x<w-1;x++){
      if(((x+z+this.stepIndex)&1)!==parity)continue;const i=this.index(x,z);if(this.sand[i]<.0005)continue;
      for(const [dx,dz] of dirs){const nx=x+dx,nz=z+dz,j=this.index(nx,nz),si=this.rock[i]+this.sand[i],sj=this.rock[j]+this.sand[j];const wet=(this.moisture[i]+this.moisture[j])*.5;const repose=.31+wet*this.cohesion*.62;const diff=si-sj;if(diff<=repose)continue;const transfer=Math.min(this.sand[i],(diff-repose)*.18,.18);if(transfer<=1e-6)continue;this.sand[i]-=transfer;this.sand[j]+=transfer;this.lastSandMoves++;break;}
    }
  }
  _flowWater(){const w=this.width,h=this.height,dirs=(this.stepIndex&1)?[[0,1],[1,0],[0,-1],[-1,0]]:[[0,-1],[-1,0],[0,1],[1,0]];this.lastWaterMoves=0;
    for(let parity=0;parity<2;parity++)for(let z=1;z<h-1;z++)for(let x=1;x<w-1;x++){
      if(((x+z+this.stepIndex)&1)!==parity)continue;const i=this.index(x,z);if(this.water[i]<.0005)continue;let best=-1,bestLevel=this.totalSurfaceAt(x,z);
      for(const [dx,dz] of dirs){const j=this.index(x+dx,z+dz),level=this.rock[j]+this.sand[j]+this.water[j];if(level<bestLevel){bestLevel=level;best=j;}}
      if(best<0)continue;const src=this.rock[i]+this.sand[i]+this.water[i],diff=src-bestLevel;if(diff<=.002)continue;const transfer=Math.min(this.water[i],diff*.26,.22);if(transfer<=1e-6)continue;this.water[i]-=transfer;this.water[best]+=transfer;this.lastWaterMoves++;
    }
  }
  _updateMoisture(){const w=this.width,h=this.height,src=this.moisture,dst=this._moistureScratch;for(let z=0;z<h;z++)for(let x=0;x<w;x++){
      const i=this.index(x,z);let m=src[i]*.996;if(this.water[i]>.018)m=Math.max(m,.98);let near=0;
      for(const [dx,dz] of [[-1,0],[1,0],[0,-1],[0,1]])if(this.inside(x+dx,z+dz))near=Math.max(near,src[this.index(x+dx,z+dz)]*.982);
      dst[i]=clamp(Math.max(m,near),0,1);
    }this.moisture.set(dst);
  }
  step(iterations=1){iterations=Math.max(1,Math.min(8,iterations|0));for(let n=0;n<iterations;n++){this._relaxSand();this._flowWater();this._updateMoisture();this.stepIndex++;}return this.snapshot();}
  totals(){let sand=0,water=0,rock=0,wet=0;for(let i=0;i<this.size;i++){sand+=this.sand[i];water+=this.water[i];rock+=this.rock[i];if(this.moisture[i]>.35&&this.sand[i]>.01)wet++;}return{sand,water,rock,wetCells:wet};}
  maxSandHeight(){let m=0;for(let i=0;i<this.size;i++)m=Math.max(m,this.sand[i]);return m;}
  occupiedWaterCells(){let n=0;for(let i=0;i<this.size;i++)if(this.water[i]>.012)n++;return n;}
  packState(){const out=new Float32Array(this.size*4);for(let i=0;i<this.size;i++){const o=i*4;out[o]=this.sand[i];out[o+1]=this.water[i];out[o+2]=this.moisture[i];out[o+3]=this.rock[i];}return out;}
  invariantReport(){let valid=true;for(let i=0;i<this.size;i++)if(!Number.isFinite(this.sand[i]+this.water[i]+this.moisture[i]+this.rock[i])||this.sand[i]<-1e-5||this.water[i]<-1e-5||this.moisture[i]<-1e-5||this.moisture[i]>1.0001)valid=false;return{status:valid?'PASS':'FAIL',nonNegativeFinite:valid};}
  hash(){let h=2166136261>>>0;for(let i=0;i<this.size;i++){for(const v of [this.sand[i],this.water[i],this.moisture[i],this.rock[i]]){const q=Math.round(v*100000);h^=q;h=Math.imul(h,16777619)>>>0;}}h^=this.stepIndex;return Math.imul(h,16777619)>>>0;}
  snapshot(){const t=this.totals();return{schema:1,kind:'GENESIS_MATERIALS3D_STATE',width:this.width,height:this.height,step:this.stepIndex,seed:this.seed,cohesion:this.cohesion,totals:t,maxSandHeight:this.maxSandHeight(),waterCells:this.occupiedWaterCells(),sandMoves:this.lastSandMoves,waterMoves:this.lastWaterMoves,hash:this.hash()};}
}
const MODEL={id:'genesis-materials-heightfield3d-v1',name:'GENESIS Materials 0.2 — 2.5D heightfield sand/water reference model',representation:'Horizontal x/z grid with continuous rock, sand depth, water depth and moisture; rendered as real 3D surfaces',claims:['3D terrain geometry can be derived directly from simulation state','sand redistributes toward an angle-of-repose threshold','wetness raises the phenomenological repose threshold','water redistributes across the heightfield while conserving water mass','fixed seed and edit sequence are deterministic in the JavaScript reference path'],nonClaims:['not per-grain DEM','not volumetric 3D sand physics','not Navier-Stokes/SPH','not validated soil mechanics','not Unreal Engine','not GPU compute physics']};
return{RNG,TerrainWorld,MODEL};
});
