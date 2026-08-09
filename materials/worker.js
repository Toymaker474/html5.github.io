importScripts('./model.js');
const {MaterialWorld,SAND,WATER,ROCK,EMPTY}=GenesisMaterials;
let world=null,lastInit=null;
function emit(){if(!world)return;const packed=world.packState(),snap=world.snapshot(),inv=world.invariantReport();postMessage({type:'state',snapshot:snap,invariant:inv,buffer:packed.buffer},[packed.buffer]);}
function init(o={}){lastInit={width:o.width||240,height:o.height||144,seed:o.seed>>>0||0x51a7c0de,cohesion:o.cohesion??1};world=new MaterialWorld(lastInit);world.seedScene();emit();}
onmessage=e=>{const m=e.data||{};try{
  if(m.type==='init'){init(m);return;}
  if(!world){init(lastInit||{});return;}
  if(m.type==='step'){world.step(Math.max(1,Math.min(6,m.iterations|0||1)));emit();}
  else if(m.type==='brush'){world.paint(m.material|0,m.x|0,m.y|0,m.radius|0||4,{wetness:m.wetness??220});emit();}
  else if(m.type==='reset'){init(lastInit||{});}
  else if(m.type==='set-cohesion'){world.cohesion=Math.max(0,Math.min(2,+m.value||0));emit();}
  else if(m.type==='burst'){
    const mat=m.material|0,cx=m.x|0,cy=m.y|0,r=Math.max(2,m.radius|0||8);for(let k=0;k<5;k++)world.paint(mat,cx+((world.rng.float()-.5)*r)|0,cy+((world.rng.float()-.5)*r)|0,Math.max(2,(r*.55)|0),{wetness:m.wetness??220});emit();
  }
}catch(err){postMessage({type:'error',message:String(err&&err.stack||err)});}
};
