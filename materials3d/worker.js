importScripts('./model.js');
const {TerrainWorld}=GenesisMaterials3D;
let world=null,lastInit=null;
function emit(){if(!world)return;const packed=world.packState(),snapshot=world.snapshot(),invariant=world.invariantReport();postMessage({type:'state',snapshot,invariant,buffer:packed.buffer},[packed.buffer]);}
function init(o={}){lastInit={width:o.width||96,height:o.height||96,seed:o.seed>>>0||0x3d5a17,cohesion:o.cohesion??1};world=new TerrainWorld(lastInit);world.seedScene();emit();}
onmessage=e=>{const m=e.data||{};try{
  if(m.type==='init'){init(m);return;}if(!world){init(lastInit||{});return;}
  if(m.type==='step'){world.step(Math.max(1,Math.min(4,m.iterations|0||1)));emit();}
  else if(m.type==='paint'){world.paint(String(m.kind||'sand'),m.x|0,m.z|0,Math.max(1,m.radius|0||5),+m.amount||.8);emit();}
  else if(m.type==='set-cohesion'){world.cohesion=Math.max(0,Math.min(2,+m.value||0));emit();}
  else if(m.type==='reset')init(lastInit||{});
  else if(m.type==='burst'){const cx=m.x|0,cz=m.z|0,r=Math.max(3,m.radius|0||8),kind=String(m.kind||'sand');for(let k=0;k<7;k++)world.paint(kind,cx+((world.rng.float()-.5)*r)|0,cz+((world.rng.float()-.5)*r)|0,Math.max(2,(r*(.35+.25*world.rng.float()))|0),+m.amount||1.1);emit();}
}catch(err){postMessage({type:'error',message:String(err&&err.stack||err)});}
};
