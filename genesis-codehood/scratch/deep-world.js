const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const MAT={AIR:0,SOIL:1,STONE:2,SAND:3,CLAY:4,LIMESTONE:5,BASALT:6,ORGANIC:7};
export const MAT_INFO={
  0:{name:'air',solid:false,density:0,hardness:0,porosity:1},
  1:{name:'soil',solid:true,density:1.2,hardness:.24,porosity:.46},
  2:{name:'stone',solid:true,density:2.5,hardness:.9,porosity:.04},
  3:{name:'sand',solid:true,density:1.5,hardness:.08,porosity:.32},
  4:{name:'clay',solid:true,density:1.65,hardness:.18,porosity:.18},
  5:{name:'limestone',solid:true,density:2.2,hardness:.66,porosity:.1},
  6:{name:'basalt',solid:true,density:2.8,hardness:1,porosity:.02},
  7:{name:'organic',solid:true,density:.8,hardness:.06,porosity:.58}
};
function hash32(x,y,s){let n=(Math.imul(x,73856093)^Math.imul(y,19349663)^Math.imul(s,83492791))>>>0;n^=n>>>13;n=Math.imul(n,1274126177);return((n^(n>>>16))>>>0)/4294967295}
function smooth(t){return t*t*(3-2*t)}
function noise2(x,y,s){const ix=Math.floor(x),iy=Math.floor(y),fx=smooth(x-ix),fy=smooth(y-iy);const a=hash32(ix,iy,s),b=hash32(ix+1,iy,s),c=hash32(ix,iy+1,s),d=hash32(ix+1,iy+1,s);return(a+(b-a)*fx)+((c+(d-c)*fx)-(a+(b-a)*fx))*fy}
function fbm(x,y,s){let a=.55,f=1,v=0,n=0;for(let k=0;k<5;k++){v+=noise2(x*f,y*f,s+k*971)*a;n+=a;a*=.5;f*=2.03}return v/n}
export class DeepWorld{
 constructor(opts={}){
  this.seed=opts.seed??1337;this.cell=opts.cell??8;this.cols=opts.cols??384;this.rows=opts.rows??112;this.chunkSize=opts.chunkSize??32;this.chunkCols=Math.ceil(this.cols/this.chunkSize);this.chunkRows=Math.ceil(this.rows/this.chunkSize);this.N=this.cols*this.rows;
  this.mat=new Uint8Array(this.N);this.integrity=new Float32Array(this.N);this.moisture=new Float32Array(this.N);this.nutrient=new Float32Array(this.N);this.temp=new Float32Array(this.N);this.water=new Float32Array(this.N);this.waterVX=new Float32Array(this.N);this.waterVY=new Float32Array(this.N);this.o2=new Float32Array(this.N);this.co2=new Float32Array(this.N);this.vapor=new Float32Array(this.N);this.support=new Float32Array(this.N);this.chunks=[];this.time=0;
  for(let cy=0;cy<this.chunkRows;cy++)for(let cx=0;cx<this.chunkCols;cx++)this.chunks.push({cx,cy,seed:(this.seed^Math.imul(cx+1,2654435761)^Math.imul(cy+1,1597334677))>>>0,active:false,lod:2,dirty:true,lastActive:0});
  this.generate();
 }
 idx(x,y){return y*this.cols+x} valid(x,y){return x>=0&&x<this.cols&&y>=0&&y<this.rows} wx(x){return(x+.5)*this.cell} wy(y){return(y+.5)*this.cell}
 cellAt(wx,wy){return{x:clamp(Math.floor(wx/this.cell),0,this.cols-1),y:clamp(Math.floor(wy/this.cell),0,this.rows-1)}}
 chunkAtCell(x,y){return this.chunks[(y/this.chunkSize|0)*this.chunkCols+(x/this.chunkSize|0)]}
 isSolid(x,y){if(!this.valid(x,y))return true;return MAT_INFO[this.mat[this.idx(x,y)]].solid}
 generate(){
  const C=this.cols,R=this.rows,s=this.seed;
  for(let x=0;x<C;x++){
   const macro=fbm(x/82,2.1,s),detail=fbm(x/24,9.7,s+19),surface=Math.floor(R*(.31+.12*(macro-.5)+.045*(detail-.5)));
   for(let y=0;y<R;y++){
    const i=this.idx(x,y),depth=y-surface,rockNoise=fbm(x/33,y/31,s+81),cave=fbm(x/29,y/23,s+211),tunnel=fbm(x/11,y/41,s+509);
    if(depth<0){this.mat[i]=MAT.AIR;this.integrity[i]=0;this.o2[i]=.21;this.co2[i]=.0006;this.vapor[i]=.006;this.temp[i]=22-y*.025;continue}
    let m=depth<3?MAT.SOIL:depth<7?(rockNoise>.56?MAT.CLAY:MAT.SOIL):depth<18?(rockNoise>.6?MAT.LIMESTONE:MAT.STONE):(rockNoise>.63?MAT.BASALT:MAT.STONE);
    if(depth<6&&rockNoise>.68)m=MAT.SAND;
    const carve=depth>5&&depth<R*.55&&((cave>.64&&tunnel>.48)||(cave>.57&&tunnel>.67));
    if(carve){m=MAT.AIR;this.o2[i]=.205;this.co2[i]=.0012+Math.max(0,depth/R)*.005;this.vapor[i]=.009+hash32(x,y,s)*.005}
    this.mat[i]=m;this.integrity[i]=m===MAT.AIR?0:MAT_INFO[m].hardness;this.moisture[i]=m===MAT.AIR?0:clamp(.08+depth*.004+hash32(x,y,s+5)*.18,0,.8);this.nutrient[i]=m===MAT.SOIL?(.25+hash32(x,y,s+9)*.55):m===MAT.ORGANIC?.8:.04;this.temp[i]=22+depth*.045;
    if(m===MAT.AIR&&y>surface+8&&hash32(x,y,s+77)>.982)this.water[i]=.25+hash32(y,x,s+101)*.7;
   }
  }
  this.recomputeSupport();
 }
 recomputeSupport(){
  const C=this.cols,R=this.rows;this.support.fill(0);
  for(let y=R-1;y>=0;y--)for(let x=0;x<C;x++){const i=this.idx(x,y),m=this.mat[i];if(!MAT_INFO[m].solid)continue;const below=y===R-1?1:this.support[this.idx(x,y+1)],side=((x>0?this.support[this.idx(x-1,y)]:0)+(x<C-1?this.support[this.idx(x+1,y)]:0))*.16;this.support[i]=clamp((below*.9+side)+MAT_INFO[m].hardness*.32,0,1)}
 }
 setActiveAround(points,near=3,mid=6){for(const ch of this.chunks){let best=1e9;const cx=(ch.cx+.5)*this.chunkSize*this.cell,cy=(ch.cy+.5)*this.chunkSize*this.cell;for(const p of points)best=Math.min(best,Math.hypot(cx-p.x,cy-p.y)/(this.chunkSize*this.cell));ch.lod=best<=near?0:best<=mid?1:2;ch.active=ch.lod<2;if(ch.active)ch.lastActive=this.time}}
 totalWater(){let s=0;for(const v of this.water)s+=v;return s}
 stepWater(dt){
  const C=this.cols,R=this.rows,W=this.water,NW=new Float32Array(W),VX=this.waterVX,VY=this.waterVY;NW.set(W);
  const flux=(a,b,max,rate)=>{const d=Math.max(0,a-b*.92);return Math.min(max,d*rate)};
  for(let y=1;y<R-1;y++)for(let x=1;x<C-1;x++){
   const i=this.idx(x,y);if(this.isSolid(x,y)||W[i]<=1e-6)continue;let remain=NW[i];
   const down=this.idx(x,y+1);if(!this.isSolid(x,y+1)){const t=flux(remain,NW[down],remain,clamp(dt*5.6,0,.72));if(t>0){NW[i]-=t;NW[down]+=t;VY[i]=VY[i]*.78+t/dt*.08;VY[down]=VY[down]*.82+t/dt*.06;remain-=t}}
   for(const dx of[-1,1]){const j=this.idx(x+dx,y);if(this.isSolid(x+dx,y))continue;const headI=NW[i]+Math.max(0,VY[i])*.015,headJ=NW[j]+Math.max(0,VY[j])*.015,t=Math.min(NW[i],Math.max(0,(headI-headJ)*clamp(dt*2.25,0,.38)));if(t>0){NW[i]-=t;NW[j]+=t;VX[i]=VX[i]*.86+dx*t/dt*.05;VX[j]=VX[j]*.88+dx*t/dt*.04}}
  }
  W.set(NW);for(let i=0;i<this.N;i++){VX[i]*=.94;VY[i]*=.94}
 }
 stepGas(dt){
  const C=this.cols,R=this.rows,rate=clamp(dt*.55,0,.08);for(let y=1;y<R-1;y++)for(let x=1;x<C-1;x++){const i=this.idx(x,y);if(this.isSolid(x,y))continue;for(const [dx,dy] of[[1,0],[0,1]]){const j=this.idx(x+dx,y+dy);if(this.isSolid(x+dx,y+dy))continue;for(const arr of[this.o2,this.co2,this.vapor]){const d=(arr[i]-arr[j])*rate;arr[i]-=d;arr[j]+=d}const td=(this.temp[i]-this.temp[j])*rate*.22;this.temp[i]-=td;this.temp[j]+=td}}
  for(let y=1;y<R;y++)for(let x=0;x<C;x++){const i=this.idx(x,y),u=this.idx(x,y-1);if(this.isSolid(x,y)||this.isSolid(x,y-1))continue;const sink=Math.min(this.co2[u],Math.max(0,this.co2[u]-this.co2[i])*.018*dt*60);this.co2[u]-=sink;this.co2[i]+=sink}
 }
 stepMaterial(dt){
  const C=this.cols,R=this.rows;let changed=false;for(let y=R-2;y>=1;y--)for(let x=1;x<C-1;x++){const i=this.idx(x,y),m=this.mat[i];if(m!==MAT.SAND&&m!==MAT.SOIL&&m!==MAT.ORGANIC)continue;const sat=this.moisture[i],sup=this.support[i],below=this.idx(x,y+1);if(this.mat[below]===MAT.AIR&&sup<(.22+.2*sat)){this.mat[below]=m;this.integrity[below]=this.integrity[i];this.moisture[below]=this.moisture[i];this.nutrient[below]=this.nutrient[i];this.mat[i]=MAT.AIR;this.integrity[i]=0;this.moisture[i]=0;this.nutrient[i]=0;changed=true;continue}if(sat>.78&&m===MAT.SOIL&&sup<.4){const dir=hash32(x,y,(this.time*7|0)+this.seed)>.5?1:-1,j=this.idx(x+dir,y+1);if(this.mat[j]===MAT.AIR){this.mat[j]=MAT.SOIL;this.integrity[j]=this.integrity[i]*.92;this.moisture[j]=sat;this.nutrient[j]=this.nutrient[i];this.mat[i]=MAT.AIR;changed=true}}}
  if(changed)this.recomputeSupport()
 }
 stepBiogeochem(dt){for(let i=0;i<this.N;i++){const m=this.mat[i];if(!MAT_INFO[m].solid)continue;const por=MAT_INFO[m].porosity,liq=0;this.moisture[i]=clamp(this.moisture[i]+this.vapor[i]*por*dt*.02-liq,0,1);if(m===MAT.ORGANIC)this.nutrient[i]=clamp(this.nutrient[i]+dt*.002,0,1)}}
 step(dt){this.time+=dt;this.stepWater(dt);this.stepGas(dt);this.stepMaterial(dt);this.stepBiogeochem(dt)}
 nearestWalkable(wx,wy,maxR=8){const c=this.cellAt(wx,wy);for(let r=0;r<=maxR;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;const x=c.x+dx,y=c.y+dy;if(!this.valid(x,y)||this.isSolid(x,y))continue;const below=y+1>=this.rows?true:this.isSolid(x,y+1);if(below)return{x,y,wx:this.wx(x),wy:this.wy(y)}}return null}
 collidePoint(p,r=2){const c=this.cellAt(p.x,p.y);if(!this.isSolid(c.x,c.y))return false;let best=null,bd=1e9;for(let y=Math.max(0,c.y-2);y<=Math.min(this.rows-1,c.y+2);y++)for(let x=Math.max(0,c.x-2);x<=Math.min(this.cols-1,c.x+2);x++){if(this.isSolid(x,y))continue;const wx=this.wx(x),wy=this.wy(y),d=(wx-p.x)**2+(wy-p.y)**2;if(d<bd){bd=d;best={x:wx,y:wy}}}if(best){p.x+=(best.x-p.x)*.9;p.y+=(best.y-p.y)*.9;p.px=p.x;p.py=p.y;return true}return false}
 metrics(){let air=0,solid=0,water=0,o2=0,co2=0;for(let i=0;i<this.N;i++){if(MAT_INFO[this.mat[i]].solid)solid++;else{air++;o2+=this.o2[i];co2+=this.co2[i]}water+=this.water[i]}return{air,solid,water,o2:air?o2/air:0,co2:air?co2/air:0,chunks:this.chunks.length,activeChunks:this.chunks.filter(c=>c.active).length}}
}
export const DEEP_META={kind:'chunked persistent 2D material volume',blockGridVisible:false,full3D:false,materials:Object.values(MAT_INFO).map(x=>x.name),state:['material','integrity','support','moisture','nutrient','temperature','water_volume','water_velocity','oxygen','carbon_dioxide','vapor']};