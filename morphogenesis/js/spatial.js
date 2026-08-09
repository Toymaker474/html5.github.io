// ---------------- spatial hash ----------------
const grid=new Map();
function gkey(ix,iy){return ix+','+iy}
function rebuildGrid(){
  grid.clear();
  for(const c of creatures){
    if(c.dead)continue;
    const ix=(c.x/CFG.CELL)|0,iy=(c.y/CFG.CELL)|0,k=gkey(ix,iy);
    if(!grid.has(k))grid.set(k,[]);
    grid.get(k).push(c);
  }
}
function nearbyLife(o,r){
  const out=[],cx=(o.x/CFG.CELL)|0,cy=(o.y/CFG.CELL)|0,rr=Math.ceil(r/CFG.CELL);
  for(let y=cy-rr;y<=cy+rr;y++)for(let x=cx-rr;x<=cx+rr;x++){
    const a=grid.get(gkey(x,y));
    if(a)for(const c of a)if(c!==o&&!c.dead)out.push(c);
  }
  return out;
}
