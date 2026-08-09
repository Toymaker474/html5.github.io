import { runProgram } from './vm.js';

export const PROJECTS = Object.freeze([
  {id:'HAPPY_WALKER',tier:1,kind:'GAME',title:'Happy Walker',requires:['STEP_RIGHT','STEP_LEFT'],description:'A tiny real 1D movement game driven by evolved movement functions.'},
  {id:'COIN_CHASE',tier:2,kind:'GAME',title:'Coin Chase',requires:['STEP_RIGHT','STEP_LEFT','HIT_TEST','ADD_SCORE'],description:'Move the happy face, detect the coin, and add score using evolved modules.'},
  {id:'BOUNCE_BOX',tier:3,kind:'GAME',title:'Bounce Box',requires:['BOUNCE','HIT_TEST','STEP_RIGHT','STEP_LEFT'],description:'A moving ball reverses velocity at arena walls using evolved code.'},
  {id:'RANGE_TOOL',tier:4,kind:'TOOL',title:'Range Inspector',requires:['PICK_HIGH','PICK_LOW','DISTANCE'],description:'A small numeric tool assembled from independently verified evolved functions.'},
  {id:'MOTION_LAB',tier:5,kind:'SIM',title:'Motion Lab',requires:['SCALE','SQUARE_SPEED','DISTANCE','IS_AHEAD'],description:'A simulation-oriented cartridge for velocity scaling, distance, and motion comparisons.'}
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

export function createProjectState(id){
  if(id==='HAPPY_WALKER')return {id,x:10,ticks:0,message:'Use ◀ ▶'};
  if(id==='COIN_CHASE')return {id,x:10,coin:16,score:0,ticks:0,message:'Catch the $'};
  if(id==='BOUNCE_BOX')return {id,x:4,v:1,ticks:0,message:'Running'};
  if(id==='RANGE_TOOL')return {id,a:7,b:-3,result:null,ticks:0};
  if(id==='MOTION_LAB')return {id,x:2,v:2,target:14,ticks:0};
  return {id,ticks:0};
}

export function stepProject(state,library,input=0){
  state.ticks++;
  if(state.id==='HAPPY_WALKER'){
    const skill=input<0?'STEP_LEFT':'STEP_RIGHT';
    if(input!==0){const r=call(library,skill,state.x,0);if(r.ok)state.x=Math.max(0,Math.min(20,Math.round(r.value)));}
    return state;
  }
  if(state.id==='COIN_CHASE'){
    if(input!==0){const skill=input<0?'STEP_LEFT':'STEP_RIGHT';const r=call(library,skill,state.x,0);if(r.ok)state.x=Math.max(0,Math.min(20,Math.round(r.value)));}
    const hit=call(library,'HIT_TEST',state.x,state.coin);
    if(hit.ok&&hit.value===1){const score=call(library,'ADD_SCORE',state.score,1);if(score.ok)state.score=score.value;state.coin=(state.coin*7+5)%21;state.message='Nice! coin caught';}
    return state;
  }
  if(state.id==='BOUNCE_BOX'){
    let next=state.x+state.v;
    if(next<=0||next>=20){const b=call(library,'BOUNCE',state.v,0);if(b.ok)state.v=Math.sign(b.value)||-state.v;next=state.x+state.v;}
    state.x=Math.max(0,Math.min(20,next));return state;
  }
  if(state.id==='RANGE_TOOL'){
    const hi=call(library,'PICK_HIGH',state.a,state.b),lo=call(library,'PICK_LOW',state.a,state.b),d=call(library,'DISTANCE',state.a,state.b);
    state.result={high:hi.value,low:lo.value,distance:d.value};return state;
  }
  if(state.id==='MOTION_LAB'){
    const scaled=call(library,'SCALE',state.v,1),dist=call(library,'DISTANCE',state.target,state.x),ahead=call(library,'IS_AHEAD',state.target,state.x);
    if(scaled.ok)state.x+=Math.sign(state.target-state.x)*Math.min(Math.abs(scaled.value),2);
    state.telemetry={distance:dist.value,targetAhead:ahead.value};return state;
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
  if(state.id==='RANGE_TOOL')return state.result?`A=${state.a} B=${state.b}\nLOW ${state.result.low}  HIGH ${state.result.high}\nDIST ${state.result.distance}`:'Run the evolved range tool.';
  if(state.id==='MOTION_LAB')return `☺ x=${state.x.toFixed(1)}  target=${state.target}\n${' '.repeat(Math.max(0,Math.round(state.x)))}☺${' '.repeat(Math.max(0,Math.round(state.target-state.x-1)))}|\nDIST ${state.telemetry?.distance??'—'}`;
  return 'No project selected.';
}
