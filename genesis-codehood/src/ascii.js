import { CHUNK_COLS, CHUNK_ROWS, CHUNK_SIZE, WORLD_H, WORLD_W, chunkIndexFor } from './world.js';

export const MAP_COLS=96;
export const MAP_ROWS=48;
const CW=MAP_COLS/CHUNK_COLS;
const CH=MAP_ROWS/CHUNK_ROWS;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const blank=()=>Array.from({length:MAP_ROWS},()=>Array(MAP_COLS).fill(' '));
function put(g,x,y,ch){if(x>=0&&y>=0&&x<MAP_COLS&&y<MAP_ROWS)g[y][x]=ch;}
function chunkRect(c){return{x:Math.floor(c.cx*CW),y:Math.floor(c.cy*CH),w:Math.ceil(CW),h:Math.ceil(CH)};}
function siteOf(c){return c.site||c.type||'WILDS';}

function hashTile(tx,ty,id){let x=((tx+17)*73856093)^((ty+31)*19349663)^(id*83492791);x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;}
export function terrainGlyph(chunk,tx,ty){
  if(chunk.flood>.76)return (tx+ty)%3?'~':'≈';
  if(chunk.flood>.42&&((tx+ty+chunk.id)%4===0))return '≈';
  const r=hashTile(tx,ty,chunk.id);
  switch(chunk.biome){
    case 'RIVER': return r>.73?'≈':'~';
    case 'MARSH': return r>.80?'♣':r>.52?',':'≈';
    case 'FOREST':return r>.77?'♣':r>.58?'T':r>.30?';':'.';
    case 'DESERT':return r>.82?'°':r>.48?':':'·';
    case 'HIGHLAND':return r>.76?'▲':r>.38?'^':':';
    case 'RUINS':return r>.82?'%':r>.55?';':r>.36?':':'.';
    default:return r>.88?'"':r>.68?',':'.';
  }
}
function box(g,x,y,w,h,mark){
  for(let xx=x;xx<x+w;xx++){put(g,xx,y,'#');put(g,xx,y+h-1,'#');}
  for(let yy=y;yy<y+h;yy++){put(g,x,yy,'#');put(g,x+w-1,yy,'#');}
  put(g,x+Math.floor(w/2),y+h-1,'+');
  put(g,x+Math.floor(w/2),y+Math.floor(h/2),mark);
}
function siteCenter(c){const r=chunkRect(c);return{x:r.x+Math.floor(r.w/2),y:r.y+Math.floor(r.h/2)};}
function drawRoad(g,a,b){
  let x=a.x,y=a.y;
  while(x!==b.x){put(g,x,y,'=');x+=Math.sign(b.x-x);}
  put(g,x,y,'+');
  while(y!==b.y){put(g,x,y,'|');y+=Math.sign(b.y-y);}
  put(g,x,y,'+');
}
function addSite(g,c){
  const r=chunkRect(c),site=siteOf(c);
  if(site==='WILDS')return;
  if(site==='PARK'){
    put(g,r.x+2,r.y+1,'♣');put(g,r.x+4,r.y+3,'♣');put(g,r.x+6,r.y+2,'*');return;
  }
  if(site==='CAVE'){
    put(g,r.x+Math.floor(r.w/2),r.y+Math.floor(r.h/2),'O');put(g,r.x+2,r.y+2,'^');return;
  }
  if(site==='RUIN'){
    put(g,r.x+1,r.y+1,'#');put(g,r.x+2,r.y+1,'#');put(g,r.x+1,r.y+2,'#');put(g,r.x+4,r.y+3,'%');put(g,r.x+5,r.y+2,'#');return;
  }
  if(site==='BRIDGE'){
    const cy=r.y+Math.floor(r.h/2);for(let x=r.x;x<r.x+r.w;x++)put(g,x,cy,'=');return;
  }
  if(site==='FARM'){
    for(let yy=r.y+1;yy<r.y+r.h-1;yy++)for(let x=r.x+1;x<r.x+r.w-1;x++)if((x+yy)%2===0)put(g,x,yy,'"');
    put(g,r.x+Math.floor(r.w/2),r.y+Math.floor(r.h/2),'F');return;
  }
  const mark=site==='WORK'?'W':site==='LAB'?'L':'H';
  box(g,r.x+1,r.y+1,Math.max(4,Math.min(6,r.w-2)),Math.max(3,Math.min(4,r.h-2)),mark);
}

export function makeAsciiFrame(world,agents,selectedId=null){
  const g=blank();
  for(let ty=0;ty<MAP_ROWS;ty++)for(let tx=0;tx<MAP_COLS;tx++){
    const wx=(tx+.5)/MAP_COLS*WORLD_W,wy=(ty+.5)/MAP_ROWS*WORLD_H;
    g[ty][tx]=terrainGlyph(world.chunks[chunkIndexFor(wx,wy)],tx,ty);
  }

  const town=world.chunks.filter(c=>['HOME','WORK','FARM','LAB'].includes(siteOf(c)));
  if(town.length){
    const centers=town.map(siteCenter);
    const hub=centers[Math.floor(centers.length/2)];
    for(const p of centers)drawRoad(g,p,hub);
  }
  for(const c of world.chunks)addSite(g,c);

  const counts=new Map();
  for(const a of agents){
    if(!a.alive)continue;
    const tx=clamp(Math.floor(a.x/WORLD_W*MAP_COLS),0,MAP_COLS-1);
    const ty=clamp(Math.floor(a.y/WORLD_H*MAP_ROWS),0,MAP_ROWS-1);
    const key=ty*MAP_COLS+tx,count=(counts.get(key)||0)+1;counts.set(key,count);
    let glyph=a.id===selectedId?'☻':'☺';
    if(a.lastAction==='WORK')glyph='☻';
    else if(a.lastAction==='FIGHT')glyph='!';
    else if(a.lastAction==='SHELTER')glyph='⌂';
    else if(Number(a.energy)<24)glyph='☹';
    g[ty][tx]=count>3&&a.id!==selectedId?String(Math.min(9,count)):glyph;
  }
  return g.map(row=>row.join(''));
}

const BIOME_COLORS={
  PLAINS:'#b9c98d',FOREST:'#65bd72',DESERT:'#d3b773',MARSH:'#65b7a7',HIGHLAND:'#a8abb6',RIVER:'#6bb5e8',RUINS:'#b59691'
};
const SITE_COLORS={HOME:'#e9cf96',WORK:'#d4b783',FARM:'#93d26f',LAB:'#c59be8',PARK:'#6dd28a',CAVE:'#c3c5d0',RUIN:'#c18f89',BRIDGE:'#d5c8aa'};
function biomeColor(c){return BIOME_COLORS[c.biome]||BIOME_COLORS.PLAINS;}
function siteColor(c){return SITE_COLORS[siteOf(c)]||biomeColor(c);}

export function drawAsciiWorld(ctx,world,agents,selectedId,W,H){
  const rows=makeAsciiFrame(world,agents,selectedId);
  ctx.fillStyle='#090b10';ctx.fillRect(0,0,W,H);
  const lineH=H/MAP_ROWS,charW=W/MAP_COLS,font=Math.max(6,Math.min(15,lineH*.86));
  ctx.font=`${font}px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace`;
  ctx.textBaseline='top';ctx.textAlign='left';

  // Color by biome in 8x6-character chunk runs. ~576 text draws, not 4,608.
  for(const c of world.chunks){
    const r=chunkRect(c);
    const px=r.x*charW,py=r.y*lineH,pw=r.w*charW,ph=r.h*lineH;
    if(c.biome==='RIVER'){ctx.fillStyle='rgba(38,91,135,.25)';ctx.fillRect(px,py,pw,ph);}
    else if(c.biome==='DESERT'){ctx.fillStyle='rgba(113,82,37,.10)';ctx.fillRect(px,py,pw,ph);}
    else if(c.biome==='FOREST'){ctx.fillStyle='rgba(25,92,48,.11)';ctx.fillRect(px,py,pw,ph);}
    else if(c.biome==='MARSH'){ctx.fillStyle='rgba(31,91,79,.12)';ctx.fillRect(px,py,pw,ph);}
    else if(c.biome==='HIGHLAND'){ctx.fillStyle='rgba(112,116,132,.09)';ctx.fillRect(px,py,pw,ph);}
    if(c.flood>.18){ctx.fillStyle=`rgba(50,128,205,${.04+c.flood*.18})`;ctx.fillRect(px,py,pw,ph);}
    ctx.fillStyle=biomeColor(c);
    for(let y=r.y;y<Math.min(MAP_ROWS,r.y+r.h);y++)ctx.fillText(rows[y].slice(r.x,r.x+r.w),px,y*lineH,pw);
    const s=siteOf(c);if(s!=='WILDS'){
      const p=siteCenter(c);ctx.fillStyle=siteColor(c);
      const glyph=s==='HOME'?'H':s==='WORK'?'W':s==='FARM'?'F':s==='LAB'?'L':s==='CAVE'?'O':s==='RUIN'?'%':s==='BRIDGE'?'=':'♣';
      ctx.fillText(glyph,p.x*charW,p.y*lineH,charW*1.2);
    }
  }

  // Only a handful of visible people by default, so give them strong readable faces.
  for(const a of agents){
    if(!a.alive)continue;
    const tx=clamp(Math.floor(a.x/WORLD_W*MAP_COLS),0,MAP_COLS-1),ty=clamp(Math.floor(a.y/WORLD_H*MAP_ROWS),0,MAP_ROWS-1);
    ctx.fillStyle=a.id===selectedId?'#fff27a':a.energy<24?'#ff9a87':a.lastAction==='WORK'?'#7ce4ff':'#ffffff';
    const glyph=a.lastAction==='FIGHT'?'!':a.lastAction==='SHELTER'?'⌂':a.energy<24?'☹':'☺';
    ctx.fillText(glyph,tx*charW,ty*lineH,charW*1.25);
  }
  if(selectedId!=null){
    const a=agents.find(x=>x.id===selectedId&&x.alive);
    if(a){const tx=clamp(Math.floor(a.x/WORLD_W*MAP_COLS),0,MAP_COLS-1),ty=clamp(Math.floor(a.y/WORLD_H*MAP_ROWS),0,MAP_ROWS-1);ctx.strokeStyle='#fff27a';ctx.strokeRect(tx*charW,ty*lineH,charW,lineH);}
  }
  return{rows,charW,lineH};
}
export function mapTileToWorld(tx,ty){return{x:(tx+.5)/MAP_COLS*WORLD_W,y:(ty+.5)/MAP_ROWS*WORLD_H};}
export const LEGEND=Object.freeze([
  ['☺','person'],['☻','working / selected'],['☹','hungry / weak'],['⌂','sheltering'],['!','conflict'],
  ['.','plains'],['♣','forest'],['·','desert'],['≈','marsh / shallow water'],['~','river / deep water'],['^','highland'],['%','ruins'],
  ['H','home'],['W','workshop'],['F','farm'],['L','programming lab'],['O','cave entrance'],['=','road / bridge'],['+','door / crossing']
]);
