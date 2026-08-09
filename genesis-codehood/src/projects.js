import { runProgram } from './vm.js';

export const PROJECTS = Object.freeze([
  {id:'HAPPY_WALKER',tier:1,kind:'GAME',title:'Happy Walker',requires:['STEP_RIGHT','STEP_LEFT'],description:'A tiny movement game. Every left/right move calls evolved code.'},
  {id:'COIN_CHASE',tier:2,kind:'GAME',title:'Coin Chase',requires:['STEP_RIGHT','STEP_LEFT','HIT_TEST','ADD_SCORE'],description:'Move ☺, collide with $, and update score through evolved modules.'},
  {id:'BOUNCE_BOX',tier:3,kind:'GAME',title:'Bounce Box',requires:['STEP_RIGHT','STEP_LEFT','BOUNCE','HIT_TEST'],description:'A moving ball reverses direction at walls using evolved game physics.'},
  {id:'TARGET_BOT',tier:4,kind:'GAME AI',title:'Target Bot',requires:['STEP_RIGHT','STEP_LEFT','IS_AHEAD','DISTANCE'],description:'An autonomous ☺ decides which direction to move and closes on a target.'},
  {id:'RANGE_TOOL',tier:4,kind:'TOOL',title:'Range Inspector',requires:['PICK_HIGH','PICK_LOW','DISTANCE'],description:'A real numeric tool assembled from independently evolved branching functions.'},
  {id:'MAZE_SCOUT',tier:5,kind:'GAME AI',title:'Maze Scout',requires:['STEP_RIGHT','STEP_LEFT','PICK_HIGH','MANHATTAN','HIT_TEST'],description:'A small grid scout evaluates candidate moves and navigates around walls.'},
  {id:'PARTICLE_BOX',tier:6,kind:'SIM',title:'Particle Box',requires:['STEP_RIGHT','STEP_LEFT','BOUNCE','HIT_TEST','DISTANCE','ADD_SCORE'],description:'Two particles move, bounce, collide, measure separation, and count impacts with evolved logic.'},
  {id:'SWARM_LAB',tier:7,kind:'SIM',title:'Swarm Lab',requires:['STEP_RIGHT','STEP_LEFT','IS_AHEAD','DISTANCE','MANHATTAN','ADD_SCORE'],description:'A small autonomous swarm converges on changing targets using learned movement and distance code.'}
]);

export function projectReady(project,library){return project.requires.every(name=>library[name]?.report?.verified);}
export function readyProjects(library){return PROJECTS.filter(p=>projectReady(p,library));}
export function projectProgress(project,library){
  const learned=project.requires.filter(name=>library[name]?.report?.verified);
  return {learned,total:project.requires.length,ratio:learned.length/project.requires.length,missing:project.requires.filter(x=>!learned.includes(x))};
}

function call(library,name,a,b=0){
  const skill=library[name];
  if(!skill?.report?.verified)return {ok:false,error:`${name} not learned`};
  return runProgram(skill.program,{a,b});
}
function moveOne(library,x,dir){
  const r=call(library,dir<0?'STEP_LEFT':'STEP_RIGHT',x,0);
  return r.ok?Math.round(r.value):x;
}
function hit(library,a,b){const r=call(library,'HIT_TEST',a,b);return r.ok&&r.value===1;}
function addScore(library,a,b=1){const r=call(library,'ADD_SCORE',a,b);return r.ok?r.value:a;}

export function createProjectState(id){
  if(id==='HAPPY_WALKER')return {id,x:10,ticks:0,message:'Use ◀ ▶'};
  if(id==='COIN_CHASE')return {id,x:10,coin:16,score:0,ticks:0,message:'Catch the $'};
  if(id==='BOUNCE_BOX')return {id,x:4,v:1,ticks:0,message:'Running'};
  if(id==='TARGET_BOT')return {id,x:2,target:18,ticks:0,message:'Bot thinking…'};
  if(id==='RANGE_TOOL')return {id,a:7,b:-3,result:null,ticks:0};
  if(id==='MAZE_SCOUT')return {id,x:1,y:1,tx:11,ty:5,w:13,h:7,walls:new Set(['3,1','3,2','3,3','5,3','6,3','7,3','9,2','9,3','9,4']),ticks:0,message:'Scout ready'};
  if(id==='PARTICLE_BOX')return {id,x1:3,v1:1,x2:17,v2:-1,gap:14,impacts:0,ticks:0};
  if(id==='SWARM_LAB')return {id,agents:[1,4,7,14,18],target:10,arrivals:0,totalDistance:0,ticks:0};
  return {id,ticks:0};
}

export function stepProject(state,library,input=0){
  state.ticks++;
  if(state.id==='HAPPY_WALKER'){
    if(input!==0)state.x=Math.max(0,Math.min(20,moveOne(library,state.x,input)));
    return state;
  }
  if(state.id==='COIN_CHASE'){
    if(input!==0)state.x=Math.max(0,Math.min(20,moveOne(library,state.x,input)));
    if(hit(library,state.x,state.coin)){
      state.score=addScore(library,state.score,1);
      state.coin=(state.coin*7+5)%21;
      if(state.coin===state.x)state.coin=(state.coin+6)%21;
      state.message='Nice! coin caught';
    }
    return state;
  }
  if(state.id==='BOUNCE_BOX'){
    let next=moveOne(library,state.x,state.v);
    if(hit(library,next,0)||hit(library,next,20)){
      const b=call(library,'BOUNCE',state.v,0);
      if(b.ok)state.v=Math.sign(b.value)||-state.v;
      next=moveOne(library,state.x,state.v);
    }
    state.x=Math.max(0,Math.min(20,next));
    return state;
  }
  if(state.id==='TARGET_BOT'){
    const ahead=call(library,'IS_AHEAD',state.target,state.x);
    const d=call(library,'DISTANCE',state.target,state.x);
    if(d.ok&&d.value===0){state.message='TARGET REACHED';state.target=(state.target*7+3)%21;return state;}
    const dir=ahead.ok&&ahead.value===1?1:-1;
    state.x=Math.max(0,Math.min(20,moveOne(library,state.x,dir)));
    state.message=`distance ${d.ok?d.value:'?'}`;
    return state;
  }
  if(state.id==='RANGE_TOOL'){
    const hi=call(library,'PICK_HIGH',state.a,state.b),lo=call(library,'PICK_LOW',state.a,state.b),d=call(library,'DISTANCE',state.a,state.b);
    state.result={high:hi.value,low:lo.value,distance:d.value};
    return state;
  }
  if(state.id==='MAZE_SCOUT'){
    if(hit(library,state.x,state.tx)&&hit(library,state.y,state.ty)){state.message='EXIT FOUND';return state;}
    const dx=state.tx-state.x,dy=state.ty-state.y;
    const choose=call(library,'PICK_HIGH',Math.abs(dx),Math.abs(dy));
    const preferX=choose.ok?choose.value===Math.abs(dx):Math.abs(dx)>=Math.abs(dy);
    const options=preferX?[[Math.sign(dx),0],[0,Math.sign(dy)]]:[[0,Math.sign(dy)],[Math.sign(dx),0]];
    for(const [ox,oy] of options){
      if(!ox&&!oy)continue;
      const nx=ox?moveOne(library,state.x,ox):state.x;
      const ny=oy?moveOne(library,state.y,oy):state.y;
      const key=`${nx},${ny}`;
      if(nx>0&&ny>0&&nx<state.w-1&&ny<state.h-1&&!state.walls.has(key)){state.x=nx;state.y=ny;break;}
    }
    const md=call(library,'MANHATTAN',state.tx-state.x,state.ty-state.y);
    state.message=`path estimate ${md.ok?md.value:'?'}`;
    return state;
  }
  if(state.id==='PARTICLE_BOX'){
    const advance=(x,v)=>Math.max(0,Math.min(20,moveOne(library,x,v)));
    let n1=advance(state.x1,state.v1),n2=advance(state.x2,state.v2);
    if(hit(library,n1,0)||hit(library,n1,20)){const r=call(library,'BOUNCE',state.v1);if(r.ok)state.v1=Math.sign(r.value)||-state.v1;n1=advance(state.x1,state.v1);}
    if(hit(library,n2,0)||hit(library,n2,20)){const r=call(library,'BOUNCE',state.v2);if(r.ok)state.v2=Math.sign(r.value)||-state.v2;n2=advance(state.x2,state.v2);}
    state.x1=n1;state.x2=n2;
    const gap=call(library,'DISTANCE',state.x1,state.x2);if(gap.ok)state.gap=gap.value;
    if(hit(library,state.x1,state.x2)){
      state.v1*=-1;state.v2*=-1;state.impacts=addScore(library,state.impacts,1);
    }
    return state;
  }
  if(state.id==='SWARM_LAB'){
    let total=0;
    state.agents=state.agents.map(x=>{
      const d=call(library,'DISTANCE',state.target,x);
      const md=call(library,'MANHATTAN',state.target-x,0);if(md.ok)total+=md.value;
      if(d.ok&&d.value===0){state.arrivals=addScore(library,state.arrivals,1);return x;}
      const ahead=call(library,'IS_AHEAD',state.target,x);
      return Math.max(0,Math.min(20,moveOne(library,x,ahead.ok&&ahead.value===1?1:-1)));
    });
    state.totalDistance=total;
    if(state.agents.every(x=>x===state.target)){state.target=(state.target*5+7)%21;state.arrivals=0;}
    return state;
  }
  return state;
}

export function renderProjectAscii(state){
  const width=21;
  if(state.id==='HAPPY_WALKER'){
    const row=Array(width).fill('·');row[state.x]='☺';return `[${row.join('')}]\n${state.message}`;
  }
  if(state.id==='COIN_CHASE'){
    const row=Array(width).fill('·');row[state.coin]='$';row[state.x]='☺';return `[${row.join('')}]  SCORE ${state.score}\n${state.message}`;
  }
  if(state.id==='BOUNCE_BOX'){
    const row=Array(width).fill(' ');row[0]='|';row[20]='|';row[state.x]='●';return row.join('')+`\nvelocity ${state.v>0?'>':'<'}`;
  }
  if(state.id==='TARGET_BOT'){
    const row=Array(width).fill('·');row[state.target]='X';row[state.x]='☺';return `[${row.join('')}]\n${state.message}`;
  }
  if(state.id==='RANGE_TOOL')return state.result?`A=${state.a} B=${state.b}\nLOW ${state.result.low}  HIGH ${state.result.high}\nDIST ${state.result.distance}`:'Run the evolved range tool.';
  if(state.id==='MAZE_SCOUT'){
    const rows=Array.from({length:state.h},(_,y)=>Array.from({length:state.w},(_,x)=>(x===0||y===0||x===state.w-1||y===state.h-1||state.walls.has(`${x},${y}`))?'#':' '));
    rows[state.ty][state.tx]='X';rows[state.y][state.x]='☺';return rows.map(r=>r.join('')).join('\n')+`\n${state.message}`;
  }
  if(state.id==='PARTICLE_BOX'){
    const row=Array(width).fill(' ');row[0]='|';row[20]='|';row[state.x1]='o';row[state.x2]=row[state.x2]==='o'?'*':'o';return row.join('')+`\ngap ${state.gap} · impacts ${state.impacts}`;
  }
  if(state.id==='SWARM_LAB'){
    const row=Array(width).fill('·');row[state.target]='X';for(const x of state.agents)row[x]=row[x]==='☺'?'2':'☺';return `[${row.join('')}]\narrivals ${state.arrivals} · total distance ${state.totalDistance}`;
  }
  return 'No project selected.';
}
