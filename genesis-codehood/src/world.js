export const WORLD_W=1200;
export const WORLD_H=800;
export const CHUNK_SIZE=100;
export const CHUNK_COLS=WORLD_W/CHUNK_SIZE;
export const CHUNK_ROWS=WORLD_H/CHUNK_SIZE;
export const CHUNK_COUNT=CHUNK_COLS*CHUNK_ROWS;
export const DISTRICT_TYPES=Object.freeze(['HOME','WORK','FARM','LAB','PARK']);

function hash32(x){x|=0;x=(x+0x7ed55d16)+(x<<12);x=(x^0xc761c23c)^(x>>>19);x=(x+0x165667b1)+(x<<5);x=(x+0xd3a2646c)^(x<<9);x=(x+0xfd7046c5)+(x<<3);x=(x^0xb55a4f09)^(x>>>16);return x>>>0;}
function noise(seed,x,y,salt=0){return hash32(seed ^ (x*73856093) ^ (y*19349663) ^ salt)/4294967295;}
const clamp=v=>Math.max(0,Math.min(1,v));

function districtType(seed,cx,cy){
  const z=noise(seed,cx,cy,6);
  if(z<.21)return 'HOME';
  if(z<.40)return 'FARM';
  if(z<.60)return 'WORK';
  if(z<.80)return 'LAB';
  return 'PARK';
}
function initialResources(type,seed,cx,cy){
  const a=noise(seed,cx,cy,2),b=noise(seed,cx,cy,3),c=noise(seed,cx,cy,4);
  if(type==='HOME')return {food:.22+.30*a,jobs:.10+.22*b,shelter:.72+.28*c};
  if(type==='FARM')return {food:.72+.28*a,jobs:.24+.28*b,shelter:.16+.24*c};
  if(type==='WORK')return {food:.12+.22*a,jobs:.72+.28*b,shelter:.14+.22*c};
  if(type==='LAB')return {food:.12+.20*a,jobs:.82+.18*b,shelter:.20+.24*c};
  return {food:.46+.40*a,jobs:.04+.14*b,shelter:.04+.14*c};
}

export function createWorld(seed=0xBADC0DE){
  const chunks=[];
  for(let cy=0;cy<CHUNK_ROWS;cy++)for(let cx=0;cx<CHUNK_COLS;cx++){
    const id=cy*CHUNK_COLS+cx;
    const type=districtType(seed,cx,cy);
    const resources=initialResources(type,seed,cx,cy);
    const elevation=.12+.88*noise(seed,cx,cy,1);
    const dangerBase=.04+.36*noise(seed,cx,cy,5)+(type==='WORK'?.05:type==='LAB'?.03:0);
    chunks.push({
      id,cx,cy,type,elevation,
      food:resources.food,jobs:resources.jobs,shelter:resources.shelter,
      danger:clamp(dangerBase),flood:0,learning:type==='LAB'?1:0,
      agents:[],visits:0,deaths:0,births:0,programs:0
    });
  }
  return {seed,chunks,sweep:0,cursor:0,processed:0};
}

export function chunkIndexFor(x,y){
  const cx=Math.max(0,Math.min(CHUNK_COLS-1,Math.floor(x/CHUNK_SIZE)));
  const cy=Math.max(0,Math.min(CHUNK_ROWS-1,Math.floor(y/CHUNK_SIZE)));
  return cy*CHUNK_COLS+cx;
}

export function rebuildOccupancy(world,agents){
  for(const c of world.chunks)c.agents.length=0;
  for(const a of agents)if(a.alive)world.chunks[chunkIndexFor(a.x,a.y)].agents.push(a);
}

function inferLegacyType(chunk){
  if(chunk.shelter>=chunk.food&&chunk.shelter>=chunk.jobs)return 'HOME';
  if(chunk.food>=chunk.jobs)return chunk.food>.60?'FARM':'PARK';
  return chunk.jobs>.72?'LAB':'WORK';
}

export function updateEnvironment(chunk,{floodLevel=0,rain=0}={}){
  if(!chunk.type)chunk.type=inferLegacyType(chunk);
  chunk.learning=chunk.type==='LAB'?1:0;
  const floodPressure=Math.max(0,floodLevel-(chunk.elevation*.72));
  chunk.flood=clamp(floodPressure*1.8+rain*.12);

  const foodRegen=chunk.type==='FARM'?.050:chunk.type==='PARK'?.032:.010;
  const jobRegen=chunk.type==='LAB'?.030:chunk.type==='WORK'?.024:chunk.type==='FARM'?.010:chunk.type==='HOME'?.006:.003;
  const dry=1-chunk.flood;
  chunk.food=clamp(chunk.food+foodRegen*dry-chunk.flood*.008);
  chunk.jobs=clamp(chunk.jobs+jobRegen*dry-chunk.flood*.004);
  if(chunk.type==='HOME')chunk.shelter=clamp(chunk.shelter+.002*dry);
  chunk.danger=clamp(Math.max(.02,chunk.danger*.9993+chunk.flood*.0012));
}

export function takeChunkBatch(world,count=8){
  const out=[];
  for(let i=0;i<count;i++){
    out.push(world.chunks[world.cursor]);
    world.cursor++;
    if(world.cursor>=world.chunks.length){world.cursor=0;world.sweep++;}
  }
  world.processed=(world.cursor/world.chunks.length);
  return out;
}

export function chunkCenter(chunk){return{x:chunk.cx*CHUNK_SIZE+CHUNK_SIZE/2,y:chunk.cy*CHUNK_SIZE+CHUNK_SIZE/2};}
export function neighboringChunks(world,chunk){
  const out=[];
  for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){
    if(!ox&&!oy)continue;
    const x=chunk.cx+ox,y=chunk.cy+oy;
    if(x>=0&&y>=0&&x<CHUNK_COLS&&y<CHUNK_ROWS)out.push(world.chunks[y*CHUNK_COLS+x]);
  }
  return out;
}
