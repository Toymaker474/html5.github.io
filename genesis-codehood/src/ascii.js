import { CHUNK_COLS,CHUNK_ROWS,CHUNK_SIZE,WORLD_H,WORLD_W,chunkIndexFor } from './world.js';

export const MAP_COLS=96;
export const MAP_ROWS=48;
const CW=MAP_COLS/CHUNK_COLS,CH=MAP_ROWS/CHUNK_ROWS;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const blank=()=>Array.from({length:MAP_ROWS},()=>Array(MAP_COLS).fill(' '));
function put(g,x,y,ch){if(x>=0&&y>=0&&x<MAP_COLS&&y<MAP_ROWS)g[y][x]=ch;}
function chunkRect(c){return{x:Math.floor(c.cx*CW),y:Math.floor(c.cy*CH),w:Math.ceil(CW),h:Math.ceil(CH)};}
function siteOf(c){return c.site||c.type||'WILDS';}
function hashTile(tx,ty,id){let x=((tx+17)*73856093)^((ty+31)*19349663)^(id*83492791);x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296;}

export function terrainGlyph(c,tx,ty){
  if(c.flood>.76)return(tx+ty)%3?'~':'≈';
  if(c.flood>.42&&((tx+ty+c.id)%4===0))return'≈';
  const r=hashTile(tx,ty,c.id);
  if(c.biome==='RIVER')return r>.75?'≈':'~';
  if(c.biome==='MARSH')return r>.80?'♣':r>.50?';':'≈';
  if(c.biome==='FOREST')return r>.76?'♣':r>.55?'T':r>.30?';':'.';
  if(c.biome==='DESERT')return r>.80?'°':r>.46?':':'·';
  if(c.biome==='HIGHLAND')return r>.72?'▲':r>.34?'^':':';
  if(c.biome==='RUINS')return r>.78?'%':r>.50?';':'.';
  return r>.88?'"':r>.65?',':'.';
}

function siteCenter(c){const r=chunkRect(c);return{x:r.x+Math.floor(r.w/2),y:r.y+Math.floor(r.h/2)};}
function caveWall(g,x,y,w,h){
  for(let xx=x;xx<x+w;xx++){put(g,xx,y,'#');put(g,xx,y+h-1,'#');}
  for(let yy=y;yy<y+h;yy++){put(g,x,yy,'#');put(g,x+w-1,yy,'#');}
  put(g,x+Math.floor(w/2),y+h-1,'+');
}
function addPrehistoricSite(g,c){
  const r=chunkRect(c),site=siteOf(c),cx=r.x+Math.floor(r.w/2),cy=r.y+Math.floor(r.h/2);
  if(site==='WILDS'){
    if((c.game??0)>.68)put(g,cx,cy,(c.biome==='PLAINS'?'d':'b'));
    return;
  }
  if(site==='HOME'){
    caveWall(g,r.x+1,r.y+1,Math.max(4,Math.min(6,r.w-2)),Math.max(3,Math.min(4,r.h-2)));
    put(g,cx,cy,'*'); // campfire
    return;
  }
  if(site==='FARM'){
    for(let yy=r.y+1;yy<r.y+r.h-1;yy++)for(let xx=r.x+1;xx<r.x+r.w-1;xx++)if((xx+yy)%2===0)put(g,xx,yy,'"');
    put(g,cx,cy,'g'); // gather patch
    return;
  }
  if(site==='WORK'){put(g,cx-1,cy,'/');put(g,cx,cy,'K');put(g,cx+1,cy,'\\');put(g,cx,cy+1,'o');return;}
  if(site==='LAB'){put(g,cx-1,cy,'(');put(g,cx,cy,'?');put(g,cx+1,cy,')');put(g,cx,cy+1,'#');return;}
  if(site==='PARK'){put(g,cx-2,cy,'♣');put(g,cx,cy,'♣');put(g,cx+2,cy,'*');return;}
  if(site==='CAVE'){put(g,cx,cy,'O');put(g,cx-1,cy,'^');put(g,cx+1,cy,'^');return;}
  if(site==='RUIN'){put(g,cx-1,cy,'#');put(g,cx,cy,'%');put(g,cx+1,cy,'#');return;}
  if(site==='BRIDGE'){for(let x=r.x;x<r.x+r.w;x++)put(g,x,cy,'=');}
}
function drawTrail(g,a,b){let x=a.x,y=a.y;while(x!==b.x){put(g,x,y,'.');x+=Math.sign(b.x-x);}while(y!==b.y){put(g,x,y,':');y+=Math.sign(b.y-y);}put(g,x,y,'+');}

export function makeAsciiFrame(world,agents,selectedId=null){
  const g=blank();
  for(let ty=0;ty<MAP_ROWS;ty++)for(let tx=0;tx<MAP_COLS;tx++){
    const wx=(tx+.5)/MAP_COLS*WORLD_W,wy=(ty+.5)/MAP_ROWS*WORLD_H;
    g[ty][tx]=terrainGlyph(world.chunks[chunkIndexFor(wx,wy)],tx,ty);
  }
  const tribeSites=world.chunks.filter(c=>['HOME','WORK','FARM','LAB'].includes(siteOf(c)));
  if(tribeSites.length){const centers=tribeSites.map(siteCenter),hub=centers[0];for(const p of centers.slice(1))drawTrail(g,hub,p);}
  for(const c of world.chunks)addPrehistoricSite(g,c);
  for(const c of world.chunks){if(c.floodAlarm&&['HOME','WORK','LAB'].includes(siteOf(c))){const p=siteCenter(c);put(g,p.x,p.y,'A');}if(c.pumpActive){const p=siteCenter(c);put(g,p.x+1,p.y,'P');}}
  const counts=new Map();
  for(const a of agents){
    if(!a.alive)continue;
    const tx=clamp(Math.floor(a.x/WORLD_W*MAP_COLS),0,MAP_COLS-1),ty=clamp(Math.floor(a.y/WORLD_H*MAP_ROWS),0,MAP_ROWS-1),key=ty*MAP_COLS+tx,count=(counts.get(key)||0)+1;counts.set(key,count);
    let glyph=a.id===selectedId?'☻':'☺';
    if(a.lastAction==='PLAY')glyph='☻';
    else if(a.lastAction==='FIGHT')glyph='!';
    else if(a.lastAction==='SHELTER')glyph='⌂';
    else if(Number(a.energy)<24)glyph='☹';
    g[ty][tx]=count>3&&a.id!==selectedId?String(Math.min(9,count)):glyph;
  }
  return g.map(r=>r.join(''));
}

const BIOME_COLORS={PLAINS:'#c8c08c',FOREST:'#74c47a',DESERT:'#d9b06e',MARSH:'#68b9a5',HIGHLAND:'#b6b6c0',RIVER:'#6fb7e8',RUINS:'#c09284'};
function biomeColor(c){return BIOME_COLORS[c.biome]||BIOME_COLORS.PLAINS;}

export function drawAsciiWorld(ctx,world,agents,selectedId,W,H){
  const rows=makeAsciiFrame(world,agents,selectedId);
  ctx.fillStyle='#090a0d';ctx.fillRect(0,0,W,H);
  const lineH=H/MAP_ROWS,charW=W/MAP_COLS,font=Math.max(6,Math.min(15,lineH*.86));
  ctx.font=`${font}px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace`;ctx.textBaseline='top';ctx.textAlign='left';
  for(const c of world.chunks){
    const r=chunkRect(c),px=r.x*charW,py=r.y*lineH,pw=r.w*charW,ph=r.h*lineH;
    if(c.biome==='RIVER'){ctx.fillStyle='rgba(42,104,160,.25)';ctx.fillRect(px,py,pw,ph);}
    else if(c.biome==='FOREST'){ctx.fillStyle='rgba(33,100,50,.12)';ctx.fillRect(px,py,pw,ph);}
    else if(c.biome==='DESERT'){ctx.fillStyle='rgba(135,91,34,.12)';ctx.fillRect(px,py,pw,ph);}
    else if(c.biome==='MARSH'){ctx.fillStyle='rgba(30,100,84,.13)';ctx.fillRect(px,py,pw,ph);}
    else if(c.biome==='HIGHLAND'){ctx.fillStyle='rgba(120,120,135,.10)';ctx.fillRect(px,py,pw,ph);}
    if(c.flood>.18){ctx.fillStyle=`rgba(50,128,205,${.04+c.flood*.18})`;ctx.fillRect(px,py,pw,ph);}
    ctx.fillStyle=biomeColor(c);
    for(let y=r.y;y<Math.min(MAP_ROWS,r.y+r.h);y++)ctx.fillText(rows[y].slice(r.x,r.x+r.w),px,y*lineH,pw);
  }
  for(const a of agents){
    if(!a.alive)continue;const tx=clamp(Math.floor(a.x/WORLD_W*MAP_COLS),0,MAP_COLS-1),ty=clamp(Math.floor(a.y/WORLD_H*MAP_ROWS),0,MAP_ROWS-1);
    ctx.fillStyle=a.id===selectedId?'#fff27a':a.energy<24?'#ff9a87':a.lastAction==='PLAY'?'#f0a9ff':'#ffffff';
    const glyph=a.lastAction==='FIGHT'?'!':a.lastAction==='SHELTER'?'⌂':a.energy<24?'☹':'☺';ctx.fillText(glyph,tx*charW,ty*lineH,charW*1.25);
  }
  if(selectedId!=null){const a=agents.find(x=>x.id===selectedId&&x.alive);if(a){const tx=clamp(Math.floor(a.x/WORLD_W*MAP_COLS),0,MAP_COLS-1),ty=clamp(Math.floor(a.y/WORLD_H*MAP_ROWS),0,MAP_ROWS-1);ctx.strokeStyle='#fff27a';ctx.strokeRect(tx*charW,ty*lineH,charW,lineH);}}
  return{rows,charW,lineH};
}

export function mapTileToWorld(tx,ty){return{x:(tx+.5)/MAP_COLS*WORLD_W,y:(ty+.5)/MAP_ROWS*WORLD_H};}
export const LEGEND=Object.freeze([
  ['☺','tribe member'],['☻','selected / playing'],['☹','hungry / weak'],['!','conflict'],['⌂','sheltering'],['*','campfire / food'],['d','deer'],['b','boar'],
  ['.','plains'],['♣','forest'],['·','desert'],['≈','marsh / water'],['~','river'],['^','highland'],['%','ruins'],['O','cave'],['K','knapping / craft site'],['?','thinking cave'],['g','gather patch'],['A','flood alarm'],['P','pump'],['+','trail crossing']
]);
