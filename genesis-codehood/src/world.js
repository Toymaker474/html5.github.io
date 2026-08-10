import { runProgram } from './vm.js';
import { getActiveLibrary } from './evolution.js';

export const WORLD_W=1200;
export const WORLD_H=800;
export const CHUNK_SIZE=100;
export const CHUNK_COLS=WORLD_W/CHUNK_SIZE;
export const CHUNK_ROWS=WORLD_H/CHUNK_SIZE;
export const CHUNK_COUNT=CHUNK_COLS*CHUNK_ROWS;
export const BIOMES=Object.freeze(['PLAINS','FOREST','DESERT','MARSH','HIGHLAND','RIVER','RUINS']);
export const DISTRICT_TYPES=Object.freeze(['WILDS','HOME','WORK','FARM','LAB','PARK','CAVE','RUIN','BRIDGE']);

function hash32(x){x|=0;x=(x+0x7ed55d16)+(x<<12);x=(x^0xc761c23c)^(x>>>19);x=(x+0x165667b1)+(x<<5);x=(x+0xd3a2646c)^(x<<9);x=(x+0xfd7046c5)+(x<<3);x=(x^0xb55a4f09)^(x>>>16);return x>>>0;}
function noise(seed,x,y,salt=0){return hash32(seed^(x*73856093)^(y*19349663)^salt)/4294967295;}
const clamp=v=>Math.max(0,Math.min(1,v));

function field(seed,cx,cy,salt){
  let total=0,weight=0;
  for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){
    const w=ox===0&&oy===0?4:(ox===0||oy===0?2:1);
    total+=noise(seed,Math.floor(cx/2)+ox,Math.floor(cy/2)+oy,salt)*w;weight+=w;
  }
  return total/weight;
}
function riverCenter(seed,cx){const p=noise(seed,0,0,91)*6.28318,p2=noise(seed,0,0,92)*6.28318;return CHUNK_ROWS*.52+Math.sin(cx*.72+p)*.85+Math.sin(cx*.23+p2)*.55;}
function biomeFor(seed,cx,cy,elevation,moisture,heat){
  if(Math.abs((cy+.5)-riverCenter(seed,cx))<.48)return'RIVER';
  if(noise(seed,cx,cy,44)>.91&&elevation>.30)return'RUINS';
  if(elevation>.66)return'HIGHLAND';
  if(moisture>.61&&elevation<.58)return'MARSH';
  if(heat>.56&&moisture<.47)return'DESERT';
  if(moisture>.50)return'FOREST';
  return'PLAINS';
}
function siteFor(seed,cx,cy,biome){
  const r=noise(seed,cx,cy,61);
  if(biome==='RIVER')return r>.76?'BRIDGE':'WILDS';
  if(biome==='RUINS')return'RUIN';
  if(biome==='HIGHLAND'&&r>.62)return'CAVE';
  if(r<.55)return'WILDS';
  if(r<.64)return'PARK';
  if(r<.73)return'HOME';
  if(r<.82)return'FARM';
  if(r<.91)return'WORK';
  return'LAB';
}
function biomeResources(biome){
  if(biome==='FOREST')return{food:.48,shelter:.16,wood:.90,ore:.18,water:.42,soil:.66,game:.88};
  if(biome==='DESERT')return{food:.08,shelter:.08,wood:.06,ore:.34,water:.05,soil:.14,game:.16};
  if(biome==='MARSH')return{food:.56,shelter:.05,wood:.38,ore:.10,water:.96,soil:.78,game:.48};
  if(biome==='HIGHLAND')return{food:.18,shelter:.16,wood:.22,ore:.88,water:.24,soil:.20,game:.36};
  if(biome==='RIVER')return{food:.42,shelter:.01,wood:.08,ore:.05,water:1,soil:.58,game:.22};
  if(biome==='RUINS')return{food:.14,shelter:.42,wood:.12,ore:.56,water:.16,soil:.18,game:.24};
  return{food:.38,shelter:.12,wood:.34,ore:.20,water:.28,soil:.72,game:.72};
}
function applySite(resources,site){
  const r={...resources,jobs:.04,learning:0};
  if(site==='HOME'){r.shelter+=.68;r.jobs+=.12;r.food+=.08;}
  else if(site==='FARM'){r.food+=.42;r.soil+=.18;r.jobs+=.32;}
  else if(site==='WORK'){r.jobs+=.74;r.shelter+=.10;r.ore+=.10;}
  else if(site==='LAB'){r.jobs+=.82;r.learning=1;r.shelter+=.12;}
  else if(site==='PARK'){r.food+=.18;r.wood+=.12;r.game+=.10;}
  else if(site==='CAVE'){r.shelter+=.34;r.ore+=.35;r.jobs+=.12;}
  else if(site==='RUIN'){r.shelter+=.20;r.ore+=.22;r.jobs+=.08;}
  else if(site==='BRIDGE'){r.jobs+=.18;r.shelter+=.04;}
  for(const k of['food','jobs','shelter','wood','ore','water','soil','game'])r[k]=clamp(r[k]);
  return r;
}
function ensureSettlement(chunks){
  const wanted=['HOME','FARM','WORK','LAB'],cx=(CHUNK_COLS-1)/2,cy=(CHUNK_ROWS-1)/2;
  const candidates=chunks.filter(c=>c.biome!=='RIVER'&&c.biome!=='MARSH').sort((a,b)=>((a.cx-cx)**2+(a.cy-cy)**2+a.danger*3)-((b.cx-cx)**2+(b.cy-cy)**2+b.danger*3));
  for(let i=0;i<wanted.length;i++){
    const c=candidates[i];if(!c)break;c.type=c.site=wanted[i];Object.assign(c,applySite(biomeResources(c.biome),c.site));
  }
}
function learnedCall(name,a,b=0){
  const skill=getActiveLibrary()?.[name];if(!skill?.report?.verified)return null;
  const r=runProgram(skill.program,{a,b});return r.ok?r.value:null;
}
function applyLearnedInfrastructure(chunk){
  chunk.floodAlarm=false;chunk.pumpActive=false;chunk.pumpRate=0;
  const water=Math.round(chunk.flood*100),alarm=learnedCall('IS_AHEAD',water,38);
  if(alarm===1)chunk.floodAlarm=true;
  if(chunk.floodAlarm&&['WORK','LAB','BRIDGE','HOME'].includes(chunk.site)){
    const excess=Math.max(0,water-38),pump=learnedCall('PICK_LOW',excess,6);
    if(Number.isFinite(pump)&&pump>0){chunk.pumpActive=true;chunk.pumpRate=Math.max(0,Math.min(6,pump));chunk.drainage=clamp((chunk.drainage||0)+chunk.pumpRate/140);}
  }
}

export function createWorld(seed=0xBADC0DE){
  const chunks=[];
  for(let cy=0;cy<CHUNK_ROWS;cy++)for(let cx=0;cx<CHUNK_COLS;cx++){
    const id=cy*CHUNK_COLS+cx;
    const elevation=.08+.88*field(seed,cx,cy,1);
    const moisture=field(seed,cx,cy,2);
    const latitude=cy/Math.max(1,CHUNK_ROWS-1);
    const heat=clamp(field(seed,cx,cy,3)*.72+(1-Math.abs(latitude-.52)*1.35)*.28);
    const biome=biomeFor(seed,cx,cy,elevation,moisture,heat);
    const site=siteFor(seed,cx,cy,biome);
    const resources=applySite(biomeResources(biome),site);
    const biomeDanger=biome==='MARSH'?.22:biome==='RUINS'?.28:biome==='DESERT'?.14:biome==='HIGHLAND'?.12:.07;
    const danger=clamp(biomeDanger+noise(seed,cx,cy,5)*.24+(site==='RUIN'?.16:0));
    chunks.push({id,cx,cy,type:site,site,biome,elevation,moisture,heat,...resources,danger,flood:biome==='RIVER'?.22:0,drainage:0,floodAlarm:false,pumpActive:false,pumpRate:0,agents:[],visits:0,deaths:0,births:0,programs:0,name:`${biome.toLowerCase()}-${cx}-${cy}`});
  }
  ensureSettlement(chunks);
  return{seed,chunks,sweep:0,cursor:0,processed:0};
}

export function chunkIndexFor(x,y){const cx=Math.max(0,Math.min(CHUNK_COLS-1,Math.floor(x/CHUNK_SIZE))),cy=Math.max(0,Math.min(CHUNK_ROWS-1,Math.floor(y/CHUNK_SIZE)));return cy*CHUNK_COLS+cx;}
export function rebuildOccupancy(world,agents){for(const c of world.chunks)c.agents.length=0;for(const a of agents)if(a.alive)world.chunks[chunkIndexFor(a.x,a.y)].agents.push(a);}
function inferLegacyType(chunk){if(chunk.shelter>=chunk.food&&chunk.shelter>=chunk.jobs)return'HOME';if(chunk.food>=chunk.jobs)return chunk.food>.60?'FARM':'PARK';return chunk.jobs>.72?'LAB':'WORK';}

export function updateEnvironment(chunk,{floodLevel=0,rain=0}={}){
  if(!chunk.type)chunk.type=chunk.site=inferLegacyType(chunk);if(!chunk.site)chunk.site=chunk.type;if(!chunk.biome)chunk.biome='PLAINS';
  chunk.learning=chunk.site==='LAB'?1:0;chunk.drainage=(chunk.drainage||0)*.985;
  const naturalWater=chunk.biome==='RIVER'?.22:chunk.biome==='MARSH'?.08:0;
  const floodPressure=Math.max(0,floodLevel-(chunk.elevation*.72));
  chunk.flood=clamp(naturalWater+floodPressure*1.8+rain*.12-chunk.drainage);
  applyLearnedInfrastructure(chunk);chunk.flood=clamp(chunk.flood-chunk.pumpRate/180);
  const foodRegen=chunk.site==='FARM'?.045:chunk.biome==='FOREST'?.020:chunk.biome==='MARSH'?.026:chunk.site==='PARK'?.020:.006;
  const jobRegen=chunk.site==='LAB'?.028:chunk.site==='WORK'?.023:chunk.site==='FARM'?.010:chunk.site==='HOME'?.005:.002;
  const gameRegen=chunk.biome==='FOREST'?.008:chunk.biome==='PLAINS'?.006:chunk.biome==='MARSH'?.004:.0015;
  const dry=1-chunk.flood;
  chunk.food=clamp(chunk.food+foodRegen*dry-chunk.flood*.007);
  chunk.jobs=clamp(chunk.jobs+jobRegen*dry-chunk.flood*.004);
  chunk.game=clamp((chunk.game??.25)+gameRegen*dry-(chunk.agents?.length||0)*.00003);
  if(chunk.site==='HOME'||chunk.site==='CAVE')chunk.shelter=clamp(chunk.shelter+.0015*dry);
  if(chunk.biome==='FOREST')chunk.wood=clamp((chunk.wood??.4)+.002*dry);
  if(chunk.biome==='RIVER'||chunk.biome==='MARSH')chunk.water=1;
  chunk.danger=clamp(Math.max(.02,chunk.danger*.9992+chunk.flood*.0012));
}

export function takeChunkBatch(world,count=8){const out=[];for(let i=0;i<count;i++){out.push(world.chunks[world.cursor]);world.cursor++;if(world.cursor>=world.chunks.length){world.cursor=0;world.sweep++;}}world.processed=world.cursor/world.chunks.length;return out;}
export function chunkCenter(chunk){return{x:chunk.cx*CHUNK_SIZE+CHUNK_SIZE/2,y:chunk.cy*CHUNK_SIZE+CHUNK_SIZE/2};}
export function neighboringChunks(world,chunk){const out=[];for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){if(!ox&&!oy)continue;const x=chunk.cx+ox,y=chunk.cy+oy;if(x>=0&&y>=0&&x<CHUNK_COLS&&y<CHUNK_ROWS)out.push(world.chunks[y*CHUNK_COLS+x]);}return out;}
