import { CHUNK_COLS, CHUNK_ROWS, CHUNK_SIZE, WORLD_H, WORLD_W, chunkIndexFor } from './world.js';

export const MAP_COLS = 96;
export const MAP_ROWS = 48;
const CW = MAP_COLS / CHUNK_COLS;
const CH = MAP_ROWS / CHUNK_ROWS;

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const blank=()=>Array.from({length:MAP_ROWS},()=>Array(MAP_COLS).fill(' '));
function put(g,x,y,ch){if(x>=0&&y>=0&&x<MAP_COLS&&y<MAP_ROWS)g[y][x]=ch;}
function box(g,x,y,w,h,mark){
  for(let xx=x;xx<x+w;xx++){put(g,xx,y,'#');put(g,xx,y+h-1,'#');}
  for(let yy=y;yy<y+h;yy++){put(g,x,yy,'#');put(g,x+w-1,yy,'#');}
  put(g,x+Math.floor(w/2),y+h-1,'+');
  put(g,x+Math.floor(w/2),y+Math.floor(h/2),mark);
}
function chunkRect(c){return {x:Math.floor(c.cx*CW),y:Math.floor(c.cy*CH),w:Math.ceil(CW),h:Math.ceil(CH)};}

export function terrainGlyph(chunk, tx, ty){
  if(chunk.flood>.72)return '~';
  if(chunk.flood>.42&&((tx+ty+chunk.id)%3===0))return '≈';
  if(chunk.elevation>.78)return '^';
  if(chunk.food>.72&&((tx*7+ty*11+chunk.id)%13===0))return '♣';
  if(chunk.food>.52&&((tx*5+ty*3+chunk.id)%11===0))return '*';
  return chunk.elevation<.28?',':'.';
}

export function makeAsciiFrame(world,agents,selectedId=null){
  const g=blank();
  for(let ty=0;ty<MAP_ROWS;ty++)for(let tx=0;tx<MAP_COLS;tx++){
    const wx=(tx+.5)/MAP_COLS*WORLD_W, wy=(ty+.5)/MAP_ROWS*WORLD_H;
    g[ty][tx]=terrainGlyph(world.chunks[chunkIndexFor(wx,wy)],tx,ty);
  }

  for(const c of world.chunks){
    const r=chunkRect(c),mx=r.x+Math.floor(r.w/2),my=r.y+Math.floor(r.h/2);
    for(let x=r.x;x<r.x+r.w;x++)put(g,x,my,'=');
    for(let y=r.y;y<r.y+r.h;y++)put(g,mx,y,'|');
    put(g,mx,my,'+');
    if(c.flood<.64){
      const kind=c.jobs>.67?'WORK':c.shelter>.62?'HOME':c.food>.64?'FARM':'LAB';
      const mark=kind==='WORK'?'W':kind==='HOME'?'H':kind==='FARM'?'F':'L';
      box(g,r.x+1,r.y+1,Math.max(4,Math.min(6,r.w-2)),Math.max(3,Math.min(4,r.h-2)),mark);
    }
  }

  const counts=new Map();
  for(const a of agents){
    if(!a.alive)continue;
    const tx=clamp(Math.floor(a.x/WORLD_W*MAP_COLS),0,MAP_COLS-1);
    const ty=clamp(Math.floor(a.y/WORLD_H*MAP_ROWS),0,MAP_ROWS-1);
    const key=ty*MAP_COLS+tx; counts.set(key,(counts.get(key)||0)+1);
    let glyph=a.id===selectedId?'☻':'☺';
    if(a.lastAction==='WORK')glyph='☻';
    else if(a.lastAction==='FIGHT')glyph='!';
    else if(a.lastAction==='SHELTER')glyph='⌂';
    g[ty][tx]=counts.get(key)>1&&a.id!==selectedId?String(Math.min(9,counts.get(key))):glyph;
  }
  return g.map(row=>row.join(''));
}

export function drawAsciiWorld(ctx,world,agents,selectedId,W,H){
  const rows=makeAsciiFrame(world,agents,selectedId);
  ctx.fillStyle='#071009';ctx.fillRect(0,0,W,H);
  const lineH=H/MAP_ROWS;
  const font=Math.max(6,Math.min(15,lineH*.86));
  ctx.font=`${font}px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace`;
  ctx.textBaseline='top';ctx.textAlign='left';ctx.fillStyle='#a9d6a5';
  const charW=W/MAP_COLS;
  for(let y=0;y<rows.length;y++)ctx.fillText(rows[y],0,y*lineH,W);
  if(selectedId!=null){
    const a=agents.find(x=>x.id===selectedId&&x.alive);
    if(a){
      const tx=clamp(Math.floor(a.x/WORLD_W*MAP_COLS),0,MAP_COLS-1),ty=clamp(Math.floor(a.y/WORLD_H*MAP_ROWS),0,MAP_ROWS-1);
      ctx.fillStyle='#fff27a';ctx.fillText('☻',tx*charW,ty*lineH,charW*1.3);
      ctx.strokeStyle='#fff27a';ctx.strokeRect(tx*charW,ty*lineH,charW,lineH);
    }
  }
  return {rows,charW,lineH};
}

export function mapTileToWorld(tx,ty){
  return {x:(tx+.5)/MAP_COLS*WORLD_W,y:(ty+.5)/MAP_ROWS*WORLD_H};
}

export const LEGEND = Object.freeze([
  ['☺','person'],['☻','working / selected'],['!','conflict'],['⌂','sheltering'],
  ['#','building wall'],['+','door / road crossing'],['W','workshop'],['L','learning lab'],['H','home'],['F','farm'],
  ['=','road'],['~','deep flood'],['≈','shallow water'],['♣','tree'],['*','food'],['^','high ground'],['.', 'open land']
]);
