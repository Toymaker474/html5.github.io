'use strict';

/* GENESIS V102 — CLOSED LIFE CYCLE
   Corpses -> detritus -> fungi -> soil nutrients -> living plants -> herbivores -> corpses.
   This file intentionally patches the existing ECOSYSTEM 100 engine instead of replacing it.
*/

const ECO_N = new Float32Array(COLS*ROWS);
const ECO_W = new Float32Array(COLS*ROWS);
const ECO_D = new Float32Array(COLS*ROWS);
const ECO_F = new Float32Array(COLS*ROWS);
let ecoCursor=0, ecoBirths=0, ecoRotToSoil=0, ecoPlantDeaths=0;

const PLANT_TYPES=[
  {name:'Rootreed',stem:'#617c54',leaf:'#8fae69',root:'#70543d',food:.80,shade:.35,water:.60,rot:.80,style:'reed'},
  {name:'Ghostvine',stem:'#536e59',leaf:'#86a88b',root:'#654c3b',food:.46,shade:.82,water:.55,rot:.65,style:'vine'},
  {name:'Mawblossom',stem:'#725b55',leaf:'#9d7875',root:'#694a3d',food:.34,shade:.55,water:.70,rot:.92,style:'maw'},
  {name:'Glassfern',stem:'#657b70',leaf:'#adc2a2',root:'#745b45',food:.65,shade:.48,water:.42,rot:.55,style:'fern'},
  {name:'Corpsebloom',stem:'#715b62',leaf:'#a88991',root:'#59433b',food:.28,shade:.88,water:.64,rot:1.25,style:'bloom'},
  {name:'Needlegrass',stem:'#69784c',leaf:'#a0ae65',root:'#70583b',food:.72,shade:.22,water:.32,rot:.48,style:'grass'}
];

function ecoGroundCell(x,y){
  let cx=clamp(Math.floor(x/TILE),0,COLS-1);
  let cy=clamp(Math.floor(y/TILE),0,ROWS-1);
  for(let k=0;k<9;k++){
    const yy=clamp(cy+k,0,ROWS-1);
    if(isSolidCell(cx,yy)) return tidx(cx,yy);
  }
  for(let k=1;k<7;k++){
    const yy=clamp(cy-k,0,ROWS-1);
    if(isSolidCell(cx,yy)) return tidx(cx,yy);
  }
  return tidx(cx,clamp(ROWS-1,0,ROWS-1));
}
function ecoSurfaceAtX(x){
  const cx=clamp(Math.floor(x/TILE),1,COLS-2);
  for(let y=1;y<ROWS-1;y++){
    if(isSolidCell(cx,y)&&!isSolidCell(cx,y-1)) return {x:cx*TILE+TILE*.5,y:y*TILE-2,cx,cy:y};
  }
  return null;
}
function ecoInitSoil(){
  ecoCursor=ecoBirths=ecoRotToSoil=ecoPlantDeaths=0;
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
    const i=tidx(x,y);
    if(isSolidCell(x,y)){
      const surface=!isSolidCell(x,y-1);
      ECO_N[i]=surface?.20+hash(i*173+11)*.28:.10+hash(i*173+12)*.10;
      ECO_W[i]=clamp((wet[i]||0)+.18+hash(i*193+19)*.22,0,1);
      ECO_D[i]=0;
      ECO_F[i]=surface?hash(i*211+7)*.035:0;
    }else ECO_N[i]=ECO_W[i]=ECO_D[i]=ECO_F[i]=0;
  }
  for(const p of plants) ecoInitPlant(p,null);
}
function ecoPlantGenes(parent){
  if(parent){
    const g={};
    for(const k of Object.keys(parent)) g[k]=clamp(parent[k]+gauss()*.045,.35,1.65);
    return g;
  }
  return {
    roots:.70+rnd()*.60,
    leaves:.70+rnd()*.60,
    storage:.70+rnd()*.60,
    seed:.60+rnd()*.75,
    defense:.45+rnd()*.85,
    shade:.45+rnd()*.90,
    climb:.45+rnd()*.90
  };
}
function ecoPickPlantType(p,parent){
  if(parent&&rnd()<.88)return parent.ecoKind;
  const gi=ecoGroundCell(p.x,p.y),rich=ECO_N[gi]+ECO_D[gi]*.7+ECO_F[gi]*.5;
  if(rich>.75&&rnd()<.48)return 4;
  if(ECO_W[gi]>.72&&rnd()<.42)return 0;
  return Math.floor(rnd()*PLANT_TYPES.length);
}
function ecoInitPlant(p,parent){
  if(p.ecoVersion===102)return p;
  p.ecoVersion=102;
  p.ecoKind=ecoPickPlantType(p,parent);
  p.ecoGene=ecoPlantGenes(parent?.ecoGene);
  p.ecoAge=parent?0:Math.floor(rnd()*1600);
  p.ecoHealth=.72+rnd()*.28;
  p.ecoSugar=5+rnd()*8;
  p.ecoWater=.35+rnd()*.45;
  p.ecoNitrogen=.25+rnd()*.42;
  p.ecoBiomass=parent?.ecoBiomass?1.2+rnd()*1.4:5+rnd()*12;
  p.ecoMax=12+9*p.ecoGene.storage;
  p.ecoRootDepth=8+14*p.ecoGene.roots;
  p.ecoRootBias=rnd()*2-1;
  p.ecoSeedCool=180+rnd()*520;
  p.ecoWound=0;
  p.ecoDeadMass=0;
  p.ecoLastFood=Math.max(0,Number(p.food)||0);
  p.food=Math.min(34,Math.max(1,p.ecoBiomass*PLANT_TYPES[p.ecoKind].food));
  p.phase=p.phase??rnd()*TAU;
  return p;
}
function ecoSpawnPlant(x,parent=null){
  const s=ecoSurfaceAtX(x); if(!s)return null;
  if(plants.some(p=>p.alive&&Math.abs(p.x-s.x)<16&&Math.abs(p.y-s.y)<22))return null;
  const p={x:s.x+(rnd()-.5)*8,y:s.y,food:2.5,phase:rnd()*TAU,alive:true};
  ecoInitPlant(p,parent);
  if(parent){p.ecoKind=rnd()<.93?parent.ecoKind:p.ecoKind;p.ecoBiomass=.8+rnd()*1.1;p.ecoSugar=2+rnd()*2;p.ecoAge=0;}
  plants.push(p); ecoBirths++; return p;
}
function ecoLightFor(p){
  let blocked=0;
  for(let k=1;k<=7;k++)if(isSolidAt(p.x,p.y-k*TILE))blocked++;
  const type=PLANT_TYPES[p.ecoKind];
  return clamp(1-blocked*.13 + type.shade*.16*p.ecoGene.shade, .08, 1.15);
}
function ecoPlantStep(p){
  ecoInitPlant(p,null);
  const gi=ecoGroundCell(p.x,p.y), type=PLANT_TYPES[p.ecoKind];
  p.ecoAge++; p.ecoSeedCool--; p.ecoWound=Math.max(0,p.ecoWound-1);

  if(!p.alive){
    if(p.ecoDeadMass<=0)p.ecoDeadMass=Math.max(1,p.ecoBiomass*.8);
    const decay=Math.min(p.ecoDeadMass,.0025*(1+ECO_W[gi]*2+ECO_F[gi]*3)*type.rot);
    p.ecoDeadMass-=decay; ECO_D[gi]=clamp(ECO_D[gi]+decay*.11,0,2);
    ECO_N[gi]=clamp(ECO_N[gi]+decay*.055,0,2); ECO_F[gi]=clamp(ECO_F[gi]+decay*.025,0,1.5);
    return;
  }

  if(p.food+0.001<p.ecoLastFood){
    const bite=p.ecoLastFood-p.food;
    p.ecoBiomass=Math.max(.05,p.ecoBiomass-bite*.75);
    p.ecoHealth=clamp(p.ecoHealth-bite*.012,0,1);
    p.ecoWound=140;
    if(p.ecoGene.defense>.92){
      for(const c of creatures){
        if(!c.alive)continue;
        const q=c.center();
        if(Math.hypot(q.x-p.x,q.y-p.y)<28){
          c.energy=Math.max(0,c.energy-bite*1.3*p.ecoGene.defense);
          c.stun=Math.max(c.stun,Math.floor(2+4*p.ecoGene.defense));
        }
      }
    }
  }

  const light=ecoLightFor(p);
  const rootReach=Math.max(1,Math.floor(1+p.ecoGene.roots*2.5));
  let bestI=gi,bestScore=-1;
  const gx=gi%COLS, gy=(gi/COLS)|0;
  for(let dx=-rootReach;dx<=rootReach;dx++){
    for(let dy=0;dy<=Math.max(1,rootReach);dy++){
      const x=gx+dx,y=gy+dy;if(!inGrid(x,y)||!isSolidCell(x,y))continue;
      const i=tidx(x,y),score=ECO_N[i]*1.25+ECO_W[i]*.8+ECO_D[i]*.35;
      if(score>bestScore){bestScore=score;bestI=i;p.ecoRootBias=lerp(p.ecoRootBias,clamp(dx/rootReach,-1,1),.035);}
    }
  }
  const waterTake=Math.min(ECO_W[bestI],.0012+.0022*p.ecoGene.roots);
  const nTake=Math.min(ECO_N[bestI],.00042+.00075*p.ecoGene.roots);
  ECO_W[bestI]=Math.max(0,ECO_W[bestI]-waterTake*.18);
  ECO_N[bestI]=Math.max(0,ECO_N[bestI]-nTake);
  p.ecoWater=clamp(p.ecoWater+waterTake-.00065*(1+weather.rain*.15),0,1.5);
  p.ecoNitrogen=clamp(p.ecoNitrogen+nTake,0,1.5);

  const photo=.0010*light*p.ecoGene.leaves*(.3+Math.min(1,p.ecoWater));
  p.ecoSugar=clamp(p.ecoSugar+photo,0,30);
  const grow=Math.min(.0028*p.ecoGene.storage, p.ecoSugar*.00055, p.ecoNitrogen*.003);
  if(grow>0&&p.ecoBiomass<p.ecoMax){
    p.ecoBiomass+=grow;p.ecoSugar=Math.max(0,p.ecoSugar-grow*4.2);p.ecoNitrogen=Math.max(0,p.ecoNitrogen-grow*.38);
    p.ecoHealth=clamp(p.ecoHealth+.00003,0,1);
  }
  const stress=(p.ecoWater<.10?.0008:0)+(p.ecoSugar<.08?.0005:0)+(p.ecoNitrogen<.02?.00025:0);
  p.ecoHealth=clamp(p.ecoHealth-stress,0,1);

  if(type.style==='maw'&&p.ecoAge>450&&simTick%18===Math.floor(p.x)%18){
    let best=null,bd=18*18;
    for(const f of flies){
      if(!f.alive||f.caught)continue;
      const d=(f.x-p.x)**2+(f.y-(p.y-16))**2;
      if(d<bd){bd=d;best=f;}
    }
    if(best&&rnd()<.24*p.ecoGene.defense){
      best.alive=false;p.ecoNitrogen=clamp(p.ecoNitrogen+.18,0,1.5);p.ecoSugar=clamp(p.ecoSugar+.6,0,30);
      p.ecoWound=50;
    }
  }

  if(p.ecoHealth<=.02||p.ecoBiomass<=.08){
    p.alive=false;p.ecoDeadMass=Math.max(.5,p.ecoBiomass);p.food=0;ecoPlantDeaths++;return;
  }

  if(p.ecoAge>700&&p.ecoBiomass>7&&p.ecoSugar>5&&p.ecoSeedCool<=0&&plants.length<230){
    const range=38+105*p.ecoGene.seed;
    const nx=p.x+(rnd()-.5)*range*2;
    if(ecoSpawnPlant(clamp(nx,TILE,WORLD_W-TILE),p)){p.ecoSugar-=2.4;p.ecoBiomass-=.45;}
    p.ecoSeedCool=380+rnd()*900/(.5+p.ecoGene.seed);
  }

  const maturity=clamp(p.ecoAge/650,.08,1);
  p.food=clamp(p.ecoBiomass*type.food*maturity*p.ecoHealth,0,34);
  p.ecoLastFood=p.food;
}
function ecoCorpseStep(c){
  if(c.alive||c.gone)return;
  const q=c.center(),gi=ecoGroundCell(q.x,q.y);
  if(!c.ecoRot){
    c.ecoRot={startMeat:Math.max(1,c.meat||20),age:0,stage:0,bones:2.5*c.g.size};
    for(const n of c.nodes)n.ecoBaseR=n.r;
  }
  const r=c.ecoRot;r.age++;
  const wetness=ECO_W[gi],fung=ECO_F[gi];
  const take=Math.min(Math.max(0,c.meat||0),.0028+.0075*wetness+.006*fung);
  if(take>0){
    c.meat=Math.max(0,c.meat-take);
    ECO_D[gi]=clamp(ECO_D[gi]+take*.045,0,2);
    ECO_N[gi]=clamp(ECO_N[gi]+take*.018,0,2);
    ECO_F[gi]=clamp(ECO_F[gi]+take*.008,0,1.5);
    ecoRotToSoil+=take;
  }
  r.stage=clamp(1-(c.meat||0)/r.startMeat,0,1);
  if(simTick%20===c.id%20){
    for(const n of c.nodes)n.r=Math.max(2,(n.ecoBaseR||n.r)*(1-r.stage*.58));
  }
  if(r.stage>.35&&rnd()<.0009*(1+wetness*3)){
    ECO_F[gi]=clamp(ECO_F[gi]+.012,0,1.5);
  }
  if((c.meat||0)<=.05&&r.bones>0){
    const bone=Math.min(r.bones,.0009+.0015*wetness);
    r.bones-=bone;ECO_N[gi]=clamp(ECO_N[gi]+bone*.04,0,2);
  }
  if((c.meat||0)<=.05&&r.bones<=.05&&r.age>900){
    ECO_D[gi]=clamp(ECO_D[gi]+.08*c.g.size,0,2);
    c.gone=true;
  }
}
function ecoSoilStep(){
  for(let k=0;k<90;k++){
    const i=ecoCursor++%(COLS*ROWS);
    if(!solid[i])continue;
    const x=i%COLS,y=(i/COLS)|0;
    const surface=!isSolidCell(x,y-1);
    const rainIn=surface?weather.rain*.00055:0;
    ECO_W[i]=clamp(ECO_W[i]+rainIn-.00007,0,1.5);
    const mineralize=Math.min(ECO_D[i],(.00018+.00042*ECO_F[i])*(.25+ECO_W[i]));
    ECO_D[i]-=mineralize;ECO_N[i]=clamp(ECO_N[i]+mineralize*.52,0,2);
    const fungalGrowth=Math.max(0,ECO_D[i]-.04)*(.00016+.00022*ECO_W[i]);
    ECO_F[i]=clamp(ECO_F[i]+fungalGrowth-ECO_F[i]*.000045,0,1.5);
    if(surface&&x>0&&x<COLS-1&&simTick%6===i%6){
      const j=tidx(x+(hash(i+simTick)>.5?1:-1),y);
      if(solid[j]){
        const dn=(ECO_N[i]-ECO_N[j])*.006,dw=(ECO_W[i]-ECO_W[j])*.004;
        ECO_N[i]-=dn;ECO_N[j]+=dn;ECO_W[i]-=dw;ECO_W[j]+=dw;
      }
    }
  }
}
function ecoClosedCycleStep(){
  ecoSoilStep();
  for(const c of creatures)ecoCorpseStep(c);
  for(let i=simTick%3;i<plants.length;i+=3)ecoPlantStep(plants[i]);
}

stepWeather=function(){
  weather.cycle++;
  weather.rain+=(weather.target-weather.rain)*.002;
  if(weather.cycle%1800===0)weather.target=rnd()<.55?.12:.82;
  if(weather.rain>.72&&rnd()<.0015){weather.lightning=1;camera.shake=8}
  weather.lightning*=.86;
  for(let i=0;i<wet.length;i++)wet[i]=clamp(wet[i]+weather.rain*.00015-.00005,0,1);
};

const ecoBaseStep=step;
step=function(){ecoBaseStep();ecoClosedCycleStep();};

const ecoBaseReset=reset;
reset=function(){ecoBaseReset();ecoInitSoil();};
document.querySelector('#reset').onclick=reset;

function ecoDrawSoil(){
  const b=tileVisibleBounds();
  for(let y=b.t;y<=b.b;y++)for(let x=b.l;x<=b.r;x++){
    const i=tidx(x,y);if(!solid[i]||isSolidCell(x,y-1))continue;
    const f=ECO_F[i],d=ECO_D[i],n=ECO_N[i];
    if(f<.025&&d<.04&&n<.65)continue;
    const p=worldToScreen(x*TILE,y*TILE),z=camera.zoom;
    if(d>.04){X.fillStyle=`rgba(62,43,36,${clamp(d*.22,0,.28)})`;X.fillRect(p.x,p.y,TILE*z,Math.max(2,5*z));}
    if(f>.025){
      const count=Math.min(5,1+Math.floor(f*4));
      for(let k=0;k<count;k++){
        const xx=p.x+(3+hash(i*17+k)*22)*z, yy=p.y-(2+hash(i*29+k)*5)*z;
        X.fillStyle=k%2?'rgba(157,143,126,.55)':'rgba(103,123,107,.62)';
        X.beginPath();X.arc(xx,yy,(1.2+hash(i*43+k)*1.8)*z,0,TAU);X.fill();
      }
    }
  }
}
function ecoDrawPlant(p,t){
  ecoInitPlant(p,null); const type=PLANT_TYPES[p.ecoKind],s=worldToScreen(p.x,p.y),z=camera.zoom;
  if(s.x<-80||s.x>SW+80||s.y<-80||s.y>SH+80)return;
  const life=p.alive?p.ecoHealth:clamp(p.ecoDeadMass/5,0,.35);
  const h=(7+Math.min(34,p.ecoBiomass*1.7))*z;
  const sway=Math.sin(t*.0009+p.phase)*z*(1+weather.rain*1.8);
  X.strokeStyle=p.alive?type.root:'rgba(80,62,49,.45)';
  X.lineWidth=Math.max(.7,1.15*z);X.globalAlpha=.58;
  for(let r=0;r<3;r++){
    const bias=p.ecoRootBias*(8+r*4)*z,dir=r===0?bias:(r===1?-8*z:8*z);
    X.beginPath();X.moveTo(s.x,s.y);X.quadraticCurveTo(s.x+dir*.45,s.y+9*z,s.x+dir,s.y+(p.ecoRootDepth+r*3)*z);X.stroke();
  }
  X.globalAlpha=1;
  const dead=!p.alive;
  X.strokeStyle=dead?'#5e5346':type.stem;X.lineWidth=Math.max(1,2.0*z*(.6+life*.5));
  X.beginPath();X.moveTo(s.x,s.y);X.quadraticCurveTo(s.x+sway*.45,s.y-h*.55,s.x+sway,s.y-h);X.stroke();
  if(type.style==='grass'){
    X.strokeStyle=dead?'#665b47':type.leaf;
    for(let k=-2;k<=2;k++){X.beginPath();X.moveTo(s.x,s.y-2*z);X.lineTo(s.x+k*4*z+sway*.5,s.y-h*(.45+.10*Math.abs(k)));X.stroke();}
  }else if(type.style==='fern'){
    X.fillStyle=dead?'#61594c':type.leaf;
    for(let k=1;k<5;k++){const yy=s.y-h*k/5,side=k%2?-1:1;X.beginPath();X.ellipse(s.x+sway*k/5+side*6*z,yy,7*z,2.5*z,side*.35,0,TAU);X.fill();}
  }else if(type.style==='vine'){
    X.strokeStyle=dead?'#5d554a':type.leaf;X.lineWidth=Math.max(1,1.4*z);
    X.beginPath();X.moveTo(s.x+sway,s.y-h);X.bezierCurveTo(s.x+14*z,s.y-h-12*z,s.x-12*z,s.y-h-22*z,s.x+p.ecoRootBias*20*z,s.y-h-34*z);X.stroke();
  }else if(type.style==='maw'){
    const open=.45+.35*Math.sin(t*.002+p.phase)+(p.ecoWound>0?.18:0);
    X.fillStyle=dead?'#5e5150':type.leaf;
    X.beginPath();X.ellipse(s.x+sway,s.y-h,8*z,4*z,-open,0,TAU);X.fill();
    X.beginPath();X.ellipse(s.x+sway,s.y-h,8*z,4*z,open,0,TAU);X.fill();
    X.fillStyle='#c2a08e';for(let k=-2;k<=2;k++)X.fillRect(s.x+sway+k*2*z,s.y-h-1*z,1*z,2*z);
  }else if(type.style==='bloom'){
    X.fillStyle=dead?'#65585a':type.leaf;const rr=(4+3*life)*z;
    for(let k=0;k<6;k++){const a=k/6*TAU;X.beginPath();X.ellipse(s.x+sway+Math.cos(a)*rr*.7,s.y-h+Math.sin(a)*rr*.7,rr*.65,rr*.28,a,0,TAU);X.fill();}
    X.fillStyle='#b9a488';X.beginPath();X.arc(s.x+sway,s.y-h,2.4*z,0,TAU);X.fill();
  }else{
    X.fillStyle=dead?'#62594a':type.leaf;
    for(const side of [-1,1]){X.beginPath();X.ellipse(s.x+sway*.6+side*5*z,s.y-h*.65,6*z,2.7*z,side*.4,0,TAU);X.fill();}
  }
  if(p.ecoWound>0&&p.alive){X.fillStyle='rgba(103,52,48,.65)';X.beginPath();X.arc(s.x+sway*.6,s.y-h*.6,2*z,0,TAU);X.fill();}
}
drawPlants=function(t){ecoDrawSoil();for(const p of plants)ecoDrawPlant(p,t);};

const ecoBaseDrawCreature=drawCreature;
drawCreature=function(c){
  ecoBaseDrawCreature(c);
  if(c.alive||c.gone||!c.ecoRot)return;
  const r=c.ecoRot,stage=r.stage,z=camera.zoom;
  for(let i=0;i<c.nodes.length;i++){
    const n=c.nodes[i],p=worldToScreen(n.x,n.y),rr=n.r*z;
    if(stage>.18){
      X.fillStyle=`rgba(77,62,48,${.10+stage*.28})`;X.beginPath();X.arc(p.x+(i%2?rr*.25:-rr*.2),p.y+rr*.1,rr*(.25+stage*.25),0,TAU);X.fill();
    }
    if(stage>.48&&i%2===0){
      X.strokeStyle=`rgba(190,183,157,${clamp((stage-.4)*1.2,0,.75)})`;X.lineWidth=Math.max(1,z*1.2);
      X.beginPath();X.moveTo(p.x-rr*.45,p.y);X.lineTo(p.x+rr*.45,p.y);X.stroke();
    }
    if(stage>.30&&hash(c.id*113+i)>.45){
      X.fillStyle='rgba(126,139,113,.58)';X.beginPath();X.arc(p.x+rr*.45,p.y-rr*.35,Math.max(1,1.8*z),0,TAU);X.fill();
    }
  }
};

const ecoBaseUpdateUI=updateUI;
updateUI=function(){
  ecoBaseUpdateUI();
  const live=plants.filter(p=>p.alive).length;
  let n=0,d=0,f=0,samples=0;
  for(let i=0;i<ECO_N.length;i+=47)if(solid[i]){n+=ECO_N[i];d+=ECO_D[i];f+=ECO_F[i];samples++;}
  stats.innerHTML+=`<br>${live} living plants · soil N ${(n/Math.max(1,samples)).toFixed(2)} · fungus ${(f/Math.max(1,samples)).toFixed(2)}`;
  if(selected&&!selected.gone&&!selected.alive&&selected.ecoRot){
    inspect.innerHTML+=`<div class="row"><span>decomposition</span><b>${Math.round(selected.ecoRot.stage*100)}%</b></div>`;
  }
};

ecoInitSoil();
