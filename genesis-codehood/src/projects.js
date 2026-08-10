import { runProgram } from './vm.js';

export const PROJECTS=Object.freeze([
  {id:'HAPPY_WALKER',tier:1,kind:'TRAINING GAME',title:'Cave Walker',requires:['STEP_RIGHT','STEP_LEFT'],description:'The first runnable game: evolved state-update code moves a happy face through a cave tunnel.'},
  {id:'COIN_CHASE',tier:2,kind:'GAME',title:'Stone Chase',requires:['STEP_RIGHT','STEP_LEFT','HIT_TEST','ADD_SCORE'],description:'A real little game the tribe can play for morale. Movement, collision and score all call evolved code.'},
  {id:'FLOOD_SENTINEL',tier:2,kind:'WORLD TOOL',title:'Flood Sentinel',requires:['IS_AHEAD'],description:'Evolved threshold logic watches water near camps and raises alarms.'},
  {id:'FIRE_KEEPER',tier:3,kind:'WORLD TOOL',title:'Fire Keeper',requires:['PICK_LOW'],description:'Evolved min-selection code limits campfire fuel use so the tribe wastes less wood.'},
  {id:'BOUNCE_BOX',tier:3,kind:'GAME',title:'Stone Bounce',requires:['STEP_RIGHT','STEP_LEFT','BOUNCE','HIT_TEST'],description:'A second tribe game: a stone bounces between cave walls using evolved motion and collision code.'},
  {id:'PUMP_STATION',tier:4,kind:'WORLD TOOL',title:'Pump Station',requires:['IS_AHEAD','PICK_LOW'],description:'Later water-control software decides when to drain and caps the pump rate. The world simulation calls the evolved bytecode.'},
  {id:'TARGET_BOT',tier:4,kind:'AUTOMATION',title:'Target Bot',requires:['STEP_RIGHT','STEP_LEFT','IS_AHEAD','DISTANCE'],description:'An autonomous program measures distance and closes on a target. This is a bridge toward hunting/navigation automation.'},
  {id:'RANGE_TOOL',tier:4,kind:'TOOL',title:'Range Inspector',requires:['PICK_HIGH','PICK_LOW','DISTANCE'],description:'A reusable numeric tool assembled from independently evolved branching and measurement functions.'},
  {id:'ROUTE_PLANNER',tier:5,kind:'WORLD TOOL',title:'Route Planner',requires:['PICK_HIGH','DISTANCE','MANHATTAN'],description:'Hunters, gatherers and crafters can use evolved comparison/distance code to choose richer nearby territory.'},
  {id:'MAZE_SCOUT',tier:5,kind:'GAME AI',title:'Cave Scout',requires:['STEP_RIGHT','STEP_LEFT','PICK_HIGH','MANHATTAN','HIT_TEST'],description:'A grid scout navigates around rock walls with reusable navigation primitives.'},
  {id:'PARTICLE_BOX',tier:6,kind:'SIMULATION',title:'Particle Box',requires:['STEP_RIGHT','STEP_LEFT','BOUNCE','HIT_TEST','DISTANCE','ADD_SCORE'],description:'A real executable simulation: particles move, bounce, collide, measure separation and count impacts.'},
  {id:'SWARM_LAB',tier:7,kind:'SIMULATION',title:'Swarm Lab',requires:['STEP_RIGHT','STEP_LEFT','IS_AHEAD','DISTANCE','MANHATTAN','ADD_SCORE'],description:'A small autonomous swarm converges on changing targets using evolved navigation code.'}
]);

export function projectReady(project,library){return project.requires.every(name=>library[name]?.report?.verified);}
export function readyProjects(library){return PROJECTS.filter(p=>projectReady(p,library));}
export function projectProgress(project,library){const learned=project.requires.filter(name=>library[name]?.report?.verified);return{learned,total:project.requires.length,ratio:learned.length/project.requires.length,missing:project.requires.filter(x=>!learned.includes(x))};}
function call(library,name,a,b=0){const skill=library[name];if(!skill?.report?.verified)return{ok:false,error:`${name} not learned`};return runProgram(skill.program,{a,b});}
function moveOne(library,x,dir){const r=call(library,dir<0?'STEP_LEFT':'STEP_RIGHT',x,0);return r.ok?Math.round(r.value):x;}
function hit(library,a,b){const r=call(library,'HIT_TEST',a,b);return r.ok&&r.value===1;}
function addScore(library,a,b=1){const r=call(library,'ADD_SCORE',a,b);return r.ok?r.value:a;}

export function createProjectState(id){
  if(id==='HAPPY_WALKER')return{id,x:10,ticks:0,message:'Use ◀ ▶'};
  if(id==='COIN_CHASE')return{id,x:10,coin:16,score:0,ticks:0,message:'Catch the stone'};
  if(id==='FLOOD_SENTINEL')return{id,water:22,threshold:38,alarm:false,ticks:0,message:'sensor online'};
  if(id==='FIRE_KEEPER')return{id,wood:12,maxBurn:1,burned:0,ticks:0,message:'protect the campfire fuel'};
  if(id==='BOUNCE_BOX')return{id,x:4,v:1,ticks:0,message:'running'};
  if(id==='PUMP_STATION')return{id,water:67,threshold:38,capacity:6,pumped:0,alarm:false,ticks:0};
  if(id==='TARGET_BOT')return{id,x:2,target:18,ticks:0,message:'bot thinking…'};
  if(id==='RANGE_TOOL')return{id,a:7,b:-3,result:null,ticks:0};
  if(id==='ROUTE_PLANNER')return{id,routeA:{dx:7,dy:4},routeB:{dx:3,dy:9},result:null,ticks:0};
  if(id==='MAZE_SCOUT')return{id,x:1,y:1,tx:11,ty:5,w:13,h:7,walls:new Set(['3,1','3,2','3,3','5,3','6,3','7,3','9,2','9,3','9,4']),ticks:0,message:'scout ready'};
  if(id==='PARTICLE_BOX')return{id,x1:3,v1:1,x2:17,v2:-1,gap:14,impacts:0,ticks:0};
  if(id==='SWARM_LAB')return{id,agents:[1,4,7,14,18],target:10,arrivals:0,totalDistance:0,ticks:0};
  return{id,ticks:0};
}

export function stepProject(s,l,input=0){
  s.ticks++;
  if(s.id==='HAPPY_WALKER'){
    if(input!==0)s.x=Math.max(0,Math.min(20,moveOne(l,s.x,input)));return s;
  }
  if(s.id==='COIN_CHASE'){
    if(input!==0)s.x=Math.max(0,Math.min(20,moveOne(l,s.x,input)));
    if(hit(l,s.x,s.coin)){s.score=addScore(l,s.score,1);s.coin=(s.coin*7+5)%21;if(s.coin===s.x)s.coin=(s.coin+6)%21;s.message='Stone caught!';}
    return s;
  }
  if(s.id==='FLOOD_SENTINEL'){
    s.water=(s.water+7)%72;const r=call(l,'IS_AHEAD',s.water,s.threshold);s.alarm=r.ok&&r.value===1;s.message=s.alarm?'ALARM: water above threshold':'water normal';return s;
  }
  if(s.id==='FIRE_KEEPER'){
    if(s.wood<=0){s.message='out of wood';return s;}
    const r=call(l,'PICK_LOW',s.wood,s.maxBurn);const burn=r.ok?Math.max(0,Math.min(s.wood,r.value)):0;s.wood-=burn;s.burned+=burn;s.message=`burn ${burn} wood this cycle`;return s;
  }
  if(s.id==='BOUNCE_BOX'){
    let next=moveOne(l,s.x,s.v);if(hit(l,next,0)||hit(l,next,20)){const b=call(l,'BOUNCE',s.v,0);if(b.ok)s.v=Math.sign(b.value)||-s.v;next=moveOne(l,s.x,s.v);}s.x=Math.max(0,Math.min(20,next));return s;
  }
  if(s.id==='PUMP_STATION'){
    const a=call(l,'IS_AHEAD',s.water,s.threshold);s.alarm=a.ok&&a.value===1;if(s.alarm){const excess=Math.max(0,s.water-s.threshold),p=call(l,'PICK_LOW',excess,s.capacity);if(p.ok){const amount=Math.max(0,Math.min(s.capacity,p.value));s.water-=amount;s.pumped+=amount;}}else s.water=Math.min(75,s.water+2);return s;
  }
  if(s.id==='TARGET_BOT'){
    const ahead=call(l,'IS_AHEAD',s.target,s.x),d=call(l,'DISTANCE',s.target,s.x);if(d.ok&&d.value===0){s.message='TARGET REACHED';s.target=(s.target*7+3)%21;return s;}s.x=Math.max(0,Math.min(20,moveOne(l,s.x,ahead.ok&&ahead.value===1?1:-1)));s.message=`distance ${d.ok?d.value:'?'}`;return s;
  }
  if(s.id==='RANGE_TOOL'){
    const hi=call(l,'PICK_HIGH',s.a,s.b),lo=call(l,'PICK_LOW',s.a,s.b),d=call(l,'DISTANCE',s.a,s.b);s.result={high:hi.value,low:lo.value,distance:d.value};return s;
  }
  if(s.id==='ROUTE_PLANNER'){
    const a=call(l,'MANHATTAN',s.routeA.dx,s.routeA.dy),b=call(l,'MANHATTAN',s.routeB.dx,s.routeB.dy);if(a.ok&&b.ok){const high=call(l,'PICK_HIGH',-a.value,-b.value),gap=call(l,'DISTANCE',a.value,b.value);s.result={a:a.value,b:b.value,best:high.value===-a.value?'A':'B',difference:gap.value};}return s;
  }
  if(s.id==='MAZE_SCOUT'){
    if(hit(l,s.x,s.tx)&&hit(l,s.y,s.ty)){s.message='EXIT FOUND';return s;}
    const dx=s.tx-s.x,dy=s.ty-s.y,choose=call(l,'PICK_HIGH',Math.abs(dx),Math.abs(dy)),preferX=choose.ok?choose.value===Math.abs(dx):Math.abs(dx)>=Math.abs(dy),options=preferX?[[Math.sign(dx),0],[0,Math.sign(dy)]]:[[0,Math.sign(dy)],[Math.sign(dx),0]];
    for(const[ox,oy]of options){if(!ox&&!oy)continue;const nx=ox?moveOne(l,s.x,ox):s.x,ny=oy?moveOne(l,s.y,oy):s.y,key=`${nx},${ny}`;if(nx>0&&ny>0&&nx<s.w-1&&ny<s.h-1&&!s.walls.has(key)){s.x=nx;s.y=ny;break;}}
    const md=call(l,'MANHATTAN',s.tx-s.x,s.ty-s.y);s.message=`path estimate ${md.ok?md.value:'?'}`;return s;
  }
  if(s.id==='PARTICLE_BOX'){
    const advance=(x,v)=>Math.max(0,Math.min(20,moveOne(l,x,v)));let n1=advance(s.x1,s.v1),n2=advance(s.x2,s.v2);
    if(hit(l,n1,0)||hit(l,n1,20)){const r=call(l,'BOUNCE',s.v1);if(r.ok)s.v1=Math.sign(r.value)||-s.v1;n1=advance(s.x1,s.v1);}if(hit(l,n2,0)||hit(l,n2,20)){const r=call(l,'BOUNCE',s.v2);if(r.ok)s.v2=Math.sign(r.value)||-s.v2;n2=advance(s.x2,s.v2);}s.x1=n1;s.x2=n2;const gap=call(l,'DISTANCE',s.x1,s.x2);if(gap.ok)s.gap=gap.value;if(hit(l,s.x1,s.x2)){s.v1*=-1;s.v2*=-1;s.impacts=addScore(l,s.impacts,1);}return s;
  }
  if(s.id==='SWARM_LAB'){
    let total=0;s.agents=s.agents.map(x=>{const d=call(l,'DISTANCE',s.target,x),md=call(l,'MANHATTAN',s.target-x,0);if(md.ok)total+=md.value;if(d.ok&&d.value===0){s.arrivals=addScore(l,s.arrivals,1);return x;}const ahead=call(l,'IS_AHEAD',s.target,x);return Math.max(0,Math.min(20,moveOne(l,x,ahead.ok&&ahead.value===1?1:-1)));});s.totalDistance=total;if(s.agents.every(x=>x===s.target)){s.target=(s.target*5+7)%21;s.arrivals=0;}return s;
  }
  return s;
}

export function renderProjectAscii(s){
  const width=21;
  if(s.id==='HAPPY_WALKER'){const row=Array(width).fill('·');row[s.x]='☺';return`CAVE [${row.join('')}]\n${s.message}`;}
  if(s.id==='COIN_CHASE'){const row=Array(width).fill('·');row[s.coin]='o';row[s.x]='☺';return`[${row.join('')}]  SCORE ${s.score}\n${s.message}`;}
  if(s.id==='FLOOD_SENTINEL'){const n=Math.round(s.water/4),meter='~'.repeat(Math.min(18,n)).padEnd(18,'·');return`WATER [${meter}] ${s.water}%\nTHRESHOLD ${s.threshold}%\n${s.alarm?'!!! FLOOD ALARM !!!':s.message}`;}
  if(s.id==='FIRE_KEEPER')return`CAMPFIRE *\nWOOD ${s.wood}\nTOTAL BURNED ${s.burned}\n${s.message}`;
  if(s.id==='BOUNCE_BOX'){const row=Array(width).fill(' ');row[0]='|';row[20]='|';row[s.x]='o';return row.join('')+`\nvelocity ${s.v>0?'>':'<'}`;}
  if(s.id==='PUMP_STATION'){const meter='~'.repeat(Math.min(20,Math.round(s.water/4))).padEnd(20,'·');return`TANK [${meter}]\nwater ${s.water}% · pumped ${s.pumped}\n${s.alarm?'PUMP ACTIVE':'monitoring'}`;}
  if(s.id==='TARGET_BOT'){const row=Array(width).fill('·');row[s.target]='X';row[s.x]='☺';return`[${row.join('')}]\n${s.message}`;}
  if(s.id==='RANGE_TOOL')return s.result?`A=${s.a} B=${s.b}\nLOW ${s.result.low}  HIGH ${s.result.high}\nDIST ${s.result.distance}`:'Run the evolved range tool.';
  if(s.id==='ROUTE_PLANNER')return s.result?`ROUTE A ${s.result.a} steps\nROUTE B ${s.result.b} steps\nBEST ${s.result.best} · difference ${s.result.difference}`:'Compare two routes.';
  if(s.id==='MAZE_SCOUT'){const rows=Array.from({length:s.h},(_,y)=>Array.from({length:s.w},(_,x)=>(x===0||y===0||x===s.w-1||y===s.h-1||s.walls.has(`${x},${y}`))?'#':' '));rows[s.ty][s.tx]='X';rows[s.y][s.x]='☺';return rows.map(r=>r.join('')).join('\n')+`\n${s.message}`;}
  if(s.id==='PARTICLE_BOX'){const row=Array(width).fill(' ');row[0]='|';row[20]='|';row[s.x1]='o';row[s.x2]=row[s.x2]==='o'?'*':'o';return row.join('')+`\ngap ${s.gap} · impacts ${s.impacts}`;}
  if(s.id==='SWARM_LAB'){const row=Array(width).fill('·');row[s.target]='X';for(const x of s.agents)row[x]=row[x]==='☺'?'2':'☺';return`[${row.join('')}]\narrivals ${s.arrivals} · total distance ${s.totalDistance}`;}
  return'No program selected.';
}
