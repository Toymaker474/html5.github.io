export const WORLD_W=1200;
export const WORLD_H=800;
export const CHUNK_SIZE=100;
export const CHUNK_COLS=WORLD_W/CHUNK_SIZE;
export const CHUNK_ROWS=WORLD_H/CHUNK_SIZE;
export const CHUNK_COUNT=CHUNK_COLS*CHUNK_ROWS;

function hash32(x){x|=0;x=(x+0x7ed55d16)+(x<<12);x=(x^0xc761c23c)^(x>>>19);x=(x+0x165667b1)+(x<<5);x=(x+0xd3a2646c)^(x<<9);x=(x+0xfd7046c5)+(x<<3);x=(x^0xb55a4f09)^(x>>>16);return x>>>0;}
function noise(seed,x,y,salt=0){return hash32(seed ^ (x*73856093) ^ (y*19349663) ^ salt)/4294967295;}

export function createWorld(seed=0xBADC0DE){
  const chunks=[];
  for(let cy=0;cy<CHUNK_ROWS;cy++)for(let cx=0;cx<CHUNK_COLS;cx++){
    const id=cy*CHUNK_COLS+cx;
    const elevation=.12+.88*noise(seed,cx,cy,1);
    chunks.push({id,cx,cy,elevation,food:.2+.8*noise(seed,cx,cy,2),jobs:.15+.85*noise(seed,cx,cy,3),shelter:.1+.9*noise(seed,cx,cy,4),danger:.08+.55*noise(seed,cx,cy,5),flood:0,agents:[],visits:0,deaths:0,births:0,programs:0});
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
export function updateEnvironment(chunk,{floodLevel=0,rain=0}={}){
  const floodPressure=Math.max(0,floodLevel-(chunk.elevation*.72));
  chunk.flood=Math.max(0,Math.min(1,floodPressure*1.8+rain*.12));
  chunk.food=Math.min(1,chunk.food+.025*(1-chunk.flood));
  chunk.jobs=Math.min(1,chunk.jobs+.012);
  chunk.danger=Math.max(.02,Math.min(1,chunk.danger*.9995+chunk.flood*.0006));
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
  const out=[];for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){if(!ox&&!oy)continue;const x=chunk.cx+ox,y=chunk.cy+oy;if(x>=0&&y>=0&&x<CHUNK_COLS&&y<CHUNK_ROWS)out.push(world.chunks[y*CHUNK_COLS+x]);}return out;
}
