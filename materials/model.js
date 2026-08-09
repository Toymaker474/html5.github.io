(function(root,factory){
  if(typeof module==='object'&&module.exports){module.exports=factory();}
  else{root.GenesisMaterials=factory();}
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';

const EMPTY=0,SAND=1,WATER=2,ROCK=3;
const MATERIAL_NAMES=['empty','sand','water','rock'];
const clamp=(v,a,b)=>v<a?a:v>b?b:v;

class RNG{
  constructor(seed=0x6d2b79f5){this.state=(seed>>>0)||0x6d2b79f5;}
  u32(){let x=this.state;x^=x<<13;x^=x>>>17;x^=x<<5;this.state=x>>>0;return this.state;}
  float(){return this.u32()/4294967296;}
  bit(){return this.u32()&1;}
}

class MaterialWorld{
  constructor({width=240,height=144,seed=0x51a7c0de,cohesion=1}={}){
    this.width=Math.max(16,width|0);this.height=Math.max(16,height|0);this.size=this.width*this.height;
    this.seed=seed>>>0;this.rng=new RNG(this.seed);this.cohesion=clamp(+cohesion||0,0,2);
    this.cells=new Uint8Array(this.size);this.moisture=new Uint8Array(this.size);this._moistureScratch=new Uint8Array(this.size);
    this.stepIndex=0;this.lastMoves=0;this.totalMoves=0;this.userEdits=0;
  }
  index(x,y){return y*this.width+x;}
  inside(x,y){return x>=0&&x<this.width&&y>=0&&y<this.height;}
  get(x,y){return this.inside(x,y)?this.cells[this.index(x,y)]:ROCK;}
  wet(x,y){return this.inside(x,y)?this.moisture[this.index(x,y)]:0;}
  set(x,y,material,wetness=0){if(!this.inside(x,y))return false;const i=this.index(x,y);this.cells[i]=material;this.moisture[i]=material===SAND?clamp(wetness|0,0,255):0;return true;}
  clear(){this.cells.fill(EMPTY);this.moisture.fill(0);this.stepIndex=0;this.lastMoves=0;this.totalMoves=0;this.userEdits=0;}
  seedScene(){
    this.clear();
    for(let y=0;y<3;y++)for(let x=0;x<this.width;x++)this.set(x,y,ROCK);
    const cx=Math.floor(this.width*.44),top=Math.floor(this.height*.88),half=Math.max(7,Math.floor(this.width*.075));
    for(let y=Math.floor(this.height*.55);y<top;y++)for(let x=cx-half;x<=cx+half;x++)if(this.inside(x,y)&&this.rng.float()>.08)this.set(x,y,SAND,0);
    const wx=Math.floor(this.width*.73),wy=Math.floor(this.height*.58),ww=Math.max(6,Math.floor(this.width*.055)),wh=Math.max(8,Math.floor(this.height*.18));
    for(let y=wy;y<Math.min(this.height-2,wy+wh);y++)for(let x=wx-ww;x<=wx+ww;x++)if(this.inside(x,y))this.set(x,y,WATER);
    const castleX=Math.floor(this.width*.22),base=3,cw=Math.max(5,Math.floor(this.width*.035)),ch=Math.max(8,Math.floor(this.height*.16));
    for(let y=base;y<base+ch;y++)for(let x=castleX-cw;x<=castleX+cw;x++)if(this.inside(x,y))this.set(x,y,SAND,220);
    return this.snapshot();
  }
  paint(material,cx,cy,radius=5,{wetness=220}={}){
    radius=Math.max(1,radius|0);let changed=0;
    for(let y=cy-radius;y<=cy+radius;y++)for(let x=cx-radius;x<=cx+radius;x++){
      const dx=x-cx,dy=y-cy;if(dx*dx+dy*dy>radius*radius||!this.inside(x,y))continue;
      const i=this.index(x,y),next=material===EMPTY?EMPTY:material;if(this.cells[i]!==next||(next===SAND&&this.moisture[i]!==wetness))changed++;
      this.cells[i]=next;this.moisture[i]=next===SAND?clamp(wetness|0,0,255):0;
    }
    this.userEdits+=changed;return changed;
  }
  _swap(i,j){const c=this.cells[i];this.cells[i]=this.cells[j];this.cells[j]=c;const m=this.moisture[i];this.moisture[i]=this.moisture[j];this.moisture[j]=m;this.lastMoves++;}
  _supportCount(x,y){let n=0;for(const [dx,dy] of [[-1,0],[1,0],[-1,-1],[1,-1],[0,-1]]){const m=this.get(x+dx,y+dy);if(m===SAND||m===ROCK)n++;}return n;}
  _heldByCohesion(x,y,i){const wet=this.moisture[i]/255;if(wet<.28||this.cohesion<=0)return false;const support=this._supportCount(x,y);return support>=2&&(wet*this.cohesion*(.42+.22*support)>=.78);}
  _moveSand(x,y){
    const i=this.index(x,y);if(this.cells[i]!==SAND)return;
    const below=this.index(x,y-1),bm=this.cells[below];
    if(bm===EMPTY||bm===WATER){this._swap(i,below);return;}
    if(this._heldByCohesion(x,y,i))return;
    const first=this.rng.bit()?-1:1,dirs=[first,-first];
    for(const dx of dirs){const nx=x+dx;if(nx<0||nx>=this.width)continue;const j=this.index(nx,y-1),m=this.cells[j];if(m===EMPTY||m===WATER){this._swap(i,j);return;}}
  }
  _moveWater(x,y){
    const i=this.index(x,y);if(this.cells[i]!==WATER)return;
    const down=this.index(x,y-1);if(this.cells[down]===EMPTY){this._swap(i,down);return;}
    const first=this.rng.bit()?-1:1,dirs=[first,-first];
    for(const dx of dirs){const nx=x+dx;if(nx<0||nx>=this.width)continue;const j=this.index(nx,y-1);if(this.cells[j]===EMPTY){this._swap(i,j);return;}}
    for(const dx of dirs){const nx=x+dx;if(nx<0||nx>=this.width)continue;const j=this.index(nx,y);if(this.cells[j]===EMPTY){this._swap(i,j);return;}}
  }
  _updateMoisture(){
    const w=this.width,h=this.height,src=this.moisture,dst=this._moistureScratch,cells=this.cells;dst.fill(0);
    for(let y=1;y<h;y++)for(let x=0;x<w;x++){
      const i=this.index(x,y);if(cells[i]!==SAND)continue;
      let next=Math.max(0,src[i]-(this.stepIndex%10===0?1:0)),nearWater=false,maxNeighbor=0;
      for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){const nx=x+dx,ny=y+dy;if(!this.inside(nx,ny))continue;const j=this.index(nx,ny);if(cells[j]===WATER)nearWater=true;else if(cells[j]===SAND)maxNeighbor=Math.max(maxNeighbor,src[j]);}
      if(nearWater)next=Math.max(next,240);else if(maxNeighbor>next+10)next=Math.max(next,maxNeighbor-8);
      dst[i]=clamp(next,0,255);
    }
    this.moisture.set(dst);
  }
  step(iterations=1){
    iterations=Math.max(1,iterations|0);for(let n=0;n<iterations;n++){
      this.lastMoves=0;const reverse=!!(this.stepIndex&1);
      for(let y=1;y<this.height;y++){
        if(reverse){for(let x=this.width-1;x>=0;x--)this._moveSand(x,y);}else{for(let x=0;x<this.width;x++)this._moveSand(x,y);}
      }
      for(let y=1;y<this.height;y++){
        if(reverse){for(let x=0;x<this.width;x++)this._moveWater(x,y);}else{for(let x=this.width-1;x>=0;x--)this._moveWater(x,y);}
      }
      this._updateMoisture();this.totalMoves+=this.lastMoves;this.stepIndex++;
    }
    return this.snapshot();
  }
  counts(){const out={empty:0,sand:0,water:0,rock:0,wetSand:0,total:this.size};for(let i=0;i<this.size;i++){const m=this.cells[i];if(m===EMPTY)out.empty++;else if(m===SAND){out.sand++;if(this.moisture[i]>=64)out.wetSand++;}else if(m===WATER)out.water++;else if(m===ROCK)out.rock++;}return out;}
  centerOfMass(material=SAND){let sx=0,sy=0,n=0;for(let y=0;y<this.height;y++)for(let x=0;x<this.width;x++){const i=this.index(x,y);if(this.cells[i]===material){sx+=x;sy+=y;n++;}}return n?{x:sx/n,y:sy/n,count:n}:{x:0,y:0,count:0};}
  maxHeight(material=SAND){for(let y=this.height-1;y>=0;y--)for(let x=0;x<this.width;x++)if(this.get(x,y)===material)return y;return 0;}
  packState(){const out=new Uint32Array(this.size);for(let i=0;i<this.size;i++)out[i]=(this.cells[i]&255)|((this.moisture[i]&255)<<8);return out;}
  snapshot(){const c=this.counts();return{schema:1,kind:'GENESIS_MATERIALS_STATE',width:this.width,height:this.height,step:this.stepIndex,moves:this.lastMoves,totalMoves:this.totalMoves,seed:this.seed,cohesion:this.cohesion,counts:c,hash:this.hash()};}
  invariantReport(){let valid=true;for(let i=0;i<this.size;i++){const m=this.cells[i];if(m>ROCK)valid=false;if(m!==SAND&&this.moisture[i]!==0)valid=false;}const c=this.counts();return{status:valid&&c.empty+c.sand+c.water+c.rock===this.size?'PASS':'FAIL',materialsValid:valid,countConserved:c.empty+c.sand+c.water+c.rock===this.size};}
  hash(){let h=2166136261>>>0;for(let i=0;i<this.size;i++){h^=this.cells[i]|(this.moisture[i]<<8);h=Math.imul(h,16777619)>>>0;}h^=this.stepIndex;h=Math.imul(h,16777619)>>>0;return h>>>0;}
}

const MODEL={
  id:'genesis-materials-granular2d-v1',
  name:'GENESIS Materials Lab — discrete granular sand + water reference model',
  representation:'2D discrete material cells; each occupied sand cell is a coarse grain parcel, not a literal mineral grain',
  claims:['gravity-driven sand settling and pile formation','water flow through local discrete moves','water-to-sand moisture transfer','moisture-dependent coarse cohesion that can support steeper sand structures','deterministic CPU reference path for a fixed seed and edit sequence'],
  nonClaims:['not DEM rigid-body grain contact mechanics','not Navier-Stokes water','not real capillary-force calculation','not literal micron-scale grains','not validated geotechnical engineering','not yet GPU compute physics']
};

return{EMPTY,SAND,WATER,ROCK,MATERIAL_NAMES,RNG,MaterialWorld,MODEL};
});
