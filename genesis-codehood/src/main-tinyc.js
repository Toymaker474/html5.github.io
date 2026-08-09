import { disassemble } from './vm.js';
import { renderTinyC } from './tinyc.js';
import { TASKS, VERIFY_CASES, evaluateProgram, unlockedTaskNames } from './tasks.js';
import { behaviorSignature, chooseAction } from './brain.js';
import { createAgent, critiqueAgent, emptyLibrary, retargetAgent, scoreCandidate, socialLearn } from './evolution.js';
import { CHUNK_COUNT, CHUNK_SIZE, WORLD_H, WORLD_W, chunkIndexFor, createWorld, neighboringChunks, rebuildOccupancy, takeChunkBatch, updateEnvironment } from './world.js';
import { LEGEND, MAP_COLS, MAP_ROWS, drawAsciiWorld, mapTileToWorld } from './ascii.js';
import { PROJECTS, createProjectState, projectProgress, projectReady, renderProjectAscii, stepProject } from './projects.js';

const $=id=>document.getElementById(id);
const canvas=$('world');
const ctx=canvas.getContext('2d',{alpha:false});
const panel=$('panel'),hud=$('hud');
let W=1000,H=700,DPR=1;
let paused=false,turbo=1,tick=0,day=0,rain=0,flood=0;
let totalMoney=0,births=0,deaths=0,murders=0,jobs=0;
let frames=0,batchesThisSec=0,sweepsThisSec=0,lastStat=performance.now();
let fps=0,bps=0,sps=0,nextId=1;
let agents=[],selected=null,tab='person',library=emptyLibrary(),artifacts=[],events=[];
let world=createWorld(0xBADC0DE),popCap=+$('popCap').value;
let activeProject=null,projectState=null;

const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct=v=>`${Math.round(clamp(v)*100)}%`;
function log(msg,type='info'){events.unshift({msg,type,tick});if(events.length>24)events.length=24;}
function bar(v){return `<span class="mini-bar"><i style="width:${clamp(v)*100}%"></i></span>`;}

function resize(){
  const r=canvas.getBoundingClientRect();DPR=Math.min(2,devicePixelRatio||1);
  canvas.width=Math.max(1,Math.floor(r.width*DPR));canvas.height=Math.max(1,Math.floor(r.height*DPR));W=r.width;H=r.height;
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
addEventListener('resize',resize);resize();

function spawn(parent=null){
  if(agents.length>=popCap)return null;
  const a=createAgent(nextId++,Math.random,parent,library);
  if(parent){a.x=clamp(parent.x+(Math.random()-.5)*40,0,WORLD_W-1);a.y=clamp(parent.y+(Math.random()-.5)*40,0,WORLD_H-1);}
  agents.push(a);births++;return a;
}

function resetZero(){
  paused=false;tick=day=rain=flood=totalMoney=births=deaths=murders=jobs=0;nextId=1;
  library=emptyLibrary();artifacts=[];events=[];selected=null;activeProject=null;projectState=null;
  world=createWorld((Math.random()*0xffffffff)>>>0);agents=[];
  const start=Math.min(popCap,Math.max(900,Math.floor(popCap*.42)));
  for(let i=0;i<start;i++)spawn();
  rebuildOccupancy(world,agents);
  log(`WORLD GENERATED: ${CHUNK_COUNT} chunks / ${agents.length} zero-seed learners`,'good');
  log('TinyC grammar loaded. No solved programs were loaded.','info');
  renderPanel();
}

function currentChunk(a){return world.chunks[chunkIndexFor(a.x,a.y)];}
function localPeer(chunk,a){
  if(chunk.agents.length<2)return null;
  for(let i=0;i<6;i++){const b=chunk.agents[(Math.random()*chunk.agents.length)|0];if(b&&b!==a&&b.alive)return b;}
  return null;
}
function obs(a,c){return {hunger:clamp((72-a.energy)/62),flood:c.flood,food:c.food,jobs:c.jobs,shelter:c.shelter,danger:c.danger,crowd:clamp(c.agents.length/60),poor:clamp((45-a.money)/45)};}
function targetChunk(a,c){a.tx=c.cx*CHUNK_SIZE+12+Math.random()*(CHUNK_SIZE-24);a.ty=c.cy*CHUNK_SIZE+12+Math.random()*(CHUNK_SIZE-24);}
function move(a,mult=1){
  const dx=a.tx-a.x,dy=a.ty-a.y,d=Math.hypot(dx,dy)||1;
  a.vx=a.vx*.67+(dx/d)*.33;a.vy=a.vy*.67+(dy/d)*.33;
  a.x=clamp(a.x+a.vx*5.0*mult,0,WORLD_W-1);a.y=clamp(a.y+a.vy*5.0*mult,0,WORLD_H-1);
}

function programWork(a,c){
  const before=Object.keys(library).length;
  const out=scoreCandidate(a,library,Math.random);jobs++;totalMoney+=out.pay;c.programs++;
  if(out.improvedPersonal&&a.bestPassRate>.08&&Math.random()<.02)log(`${a.label} improved ${a.task} → ${Math.round(a.bestPassRate*96)}/96 tests`,'info');
  if(out.shipped&&out.improved){
    const skill=library[a.task];skill.tick=tick;
    artifacts.unshift({name:`${a.task.toLowerCase()}_${a.id}_v${skill.version}.tinyc`,task:a.task,ast:skill.ast,program:skill.program,author:a.label,tick,verified:true});
    artifacts.length=Math.min(120,artifacts.length);
    log(`★ LEARNED ${a.task}: ${a.label} evolved TinyC that passed 96/96 tests`,'good');
  }
  if(Object.keys(library).length>before){
    const unlocked=unlockedTaskNames(library);log(`NEW LESSONS UNLOCKED: ${unlocked.join(' · ')}`,'money');
    for(let i=0;i<Math.min(100,agents.length);i++)retargetAgent(agents[(Math.random()*agents.length)|0],library,Math.random);
  }
}

function fight(a,b,c){
  if(!b?.alive)return;a.stats.conflicts++;b.stats.conflicts++;
  const atk=a.energy*.35+a.skill*.18+Math.random()*18,def=b.energy*.35+b.skill*.18+Math.random()*18;
  a.energy-=1.7;b.energy-=atk>def?3.6:1.2;
  if(atk>def*1.55&&b.energy<11&&Math.random()<.08){b.alive=false;deaths++;murders++;c.deaths++;log(`A fight in district ${c.cx},${c.cy} killed ${b.label}`,'bad');}
}

function act(a,c,action){
  a.lastAction=action;a.actionTicks++;a.energy-=.20;a.money=Math.max(0,a.money-.010);if(a.money<=0)a.energy-=.06;
  a.energy-=c.flood*(action==='SHELTER'?.12:.68);
  if(action==='FORAGE'){
    const take=Math.min(c.food,.018+.012*Math.random());c.food-=take;a.energy+=take*230;a.stats.food+=take;if(take<.004)a.energy-=.20;
  }else if(action==='WORK'){
    const wage=.08+c.jobs*.48;c.jobs=Math.max(0,c.jobs-.0035);a.money+=wage;totalMoney+=wage;a.energy-=.22;
    if(a.age-a.lastJob>=2){programWork(a,c);a.lastJob=a.age;}
    if(a.role==='CRITIC'||a.role==='TESTER'||a.role==='SECURITY'){const t=localPeer(c,a);if(t){const f=critiqueAgent(a,t);if(f&&Math.random()<.012)log(`${a.label} found a failing ${t.task} case (${f.a},${f.b})`,'bad');}}
  }else if(action==='SHELTER'){
    a.energy+=.20*c.shelter;a.stats.shelter++;a.tx=c.cx*CHUNK_SIZE+CHUNK_SIZE*.5;a.ty=c.cy*CHUNK_SIZE+CHUNK_SIZE*.5;
  }else if(action==='EXPLORE'){
    a.energy-=.08;if(Math.hypot(a.tx-a.x,a.ty-a.y)<20||Math.random()<.15){const n=neighboringChunks(world,c);if(n.length)targetChunk(a,n[(Math.random()*n.length)|0]);}
  }else if(action==='REST'){
    a.energy+=.40*c.shelter+.07;a.vx*=.5;a.vy*=.5;
  }else if(action==='SOCIAL'){
    const b=localPeer(c,a);if(b){socialLearn(a,b,Math.random);a.tx=b.x;a.ty=b.y;}a.energy-=.04;
  }else if(action==='FIGHT'){
    fight(a,localPeer(c,a),c);
  }
  if(action!=='REST')move(a,c.flood>.45?.5:1);
  a.energy=Math.min(100,a.energy);
}

function stepAgent(a,c){
  if(!a.alive)return;a.age++;
  const action=chooseAction(a.brain,obs(a,c),Math.random);act(a,c,action);
  if(a.energy>76&&a.money>76&&a.age>30&&agents.length<popCap&&Math.random()<.0065){a.energy-=11;a.money-=30;const child=spawn(a);if(child){a.stats.children++;c.births++;}}
  if(a.energy<=0||a.age>6800+Math.random()*2600){a.alive=false;deaths++;c.deaths++;}
}
function processChunk(c){updateEnvironment(c,{floodLevel:flood,rain});c.visits++;for(const a of c.agents.slice())stepAgent(a,c);}
function finishSweep(){
  agents=agents.filter(a=>a.alive);rebuildOccupancy(world,agents);sweepsThisSec++;day=world.sweep/12;
  if(rain>0){rain=Math.max(0,rain-.012);flood=Math.min(1,flood+.006*rain);}else flood=Math.max(0,flood-.0035);
  if(Math.random()<.008){rain=.55+Math.random()*.45;log('Storm front arrived. Low districts are flooding.','info');}
  if(!agents.length){paused=true;log('CIVILIZATION EXTINCT — NEW WORLD to try another evolutionary run.','bad');}
}
function simBatch(){tick++;batchesThisSec++;const before=world.sweep;const batch=takeChunkBatch(world,6);for(const c of batch)processChunk(c);if(world.sweep!==before)finishSweep();}

function bestByTask(){const out={};for(const a of agents){const p=out[a.task];if(!p||a.bestPassRate>p.bestPassRate)out[a.task]=a;}return out;}
function selectedSprite(a){const face=a.lastAction==='WORK'?'☻':'☺';return ` \\${face}/\n  |\n / \\`;}
function projectUses(skill){return PROJECTS.filter(p=>p.requires.includes(skill)).map(p=>p.title).join(', ');}

function renderPerson(){
  const a=selected||agents[0];if(!a){panel.innerHTML='<div class="empty">No living people.</div>';return;}
  const report=evaluateProgram(a.bestProgram||a.program,a.task,VERIFY_CASES),c=currentChunk(a),sig=behaviorSignature(a.brain);
  panel.innerHTML=`
    <section class="person-head"><pre>${esc(selectedSprite(a))}</pre><div><h2>${a.label}</h2><div>${a.role} · generation ${a.generation}</div><div class="status">doing: ${a.lastAction}</div></div></section>
    <section><h3>Life</h3><div class="facts"><span>energy <b>${a.energy.toFixed(0)}</b></span><span>money <b>${a.money.toFixed(0)}</b></span><span>children <b>${a.stats.children}</b></span><span>district <b>${c.cx},${c.cy}</b></span></div></section>
    <section><h3>What this person is learning</h3><div class="lesson-name">${a.task}</div><p>${TASKS[a.task].label}</p><div class="progress-line">${bar(report.passRate)} <b>${report.passed}/96 tests</b></div><div class="note">Evolved TinyC source</div><pre class="code">${esc(renderTinyC(a.bestAst||a.ast,a.task.toLowerCase()))}</pre><div class="note">Compiled VM instructions</div><pre class="code">${esc(disassemble(a.bestProgram||a.program))}</pre></section>
    <section><h3>Survival habits that evolved</h3><div class="facts"><span>hungry → <b>${sig.hungry}</b></span><span>flood → <b>${sig.flooded}</b></span><span>broke → <b>${sig.broke}</b></span><span>danger → <b>${sig.danger}</b></span></div></section>`;
}

function renderLearning(){
  const best=bestByTask(),unlocked=new Set(unlockedTaskNames(library));
  panel.innerHTML=`<section class="explain"><h2>Programming school</h2><p><b>Language 1: TinyC.</b> Learners evolve structured source trees using variables, constants, arithmetic, comparisons, min/max, abs, and return expressions. TinyC compiles into the safe CodeVM and must pass 96/96 tests. Solutions are not loaded.</p></section>`+
  Object.entries(TASKS).map(([name,t])=>{
    const learned=library[name],a=best[name],rate=learned?1:(a?.bestPassRate||0),locked=!unlocked.has(name);
    return `<section class="lesson ${learned?'learned':locked?'locked':''}"><div class="row"><b>${name}</b><span>${learned?'✓ LEARNED':locked?'LOCKED':`${Math.round(rate*96)}/96`}</span></div><div>${t.label}</div><div class="progress-line">${bar(rate)} ${pct(rate)}</div><div class="note">Used by: ${projectUses(name)||'later curriculum'}</div>${learned?`<div class="note">Source evolved by ${learned.author}</div><pre class="code">${esc(renderTinyC(learned.ast,name.toLowerCase()))}</pre><div class="note">Compiled bytecode</div><pre class="code">${esc(disassemble(learned.program))}</pre>`:''}</section>`;
  }).join('');
}

function renderProjects(){
  const cards=PROJECTS.map(p=>{
    const prog=projectProgress(p,library),ready=projectReady(p,library);
    return `<section class="project ${ready?'ready':''}"><div class="row"><div><b>${p.title}</b> <span class="kind">${p.kind}</span></div><span>${ready?'READY':`${prog.learned.length}/${prog.total}`}</span></div><p>${p.description}</p><div class="progress-line">${bar(prog.ratio)} ${pct(prog.ratio)}</div><div class="note">${ready?'All required TinyC modules were evolved and verified.':`Still needs: ${prog.missing.join(', ')}`}</div><button data-project="${p.id}" ${ready?'':'disabled'}>${ready?'▶ OPEN REAL PROGRAM':'LOCKED'}</button></section>`;
  }).join('');
  const active=activeProject?renderProjectRunner():'';
  panel.innerHTML=`<section class="explain"><h2>Programs they can actually build</h2><p>These runnable cartridges call only verified evolved TinyC modules. Locked means the civilization genuinely cannot build it yet.</p></section>${active}${cards}`;
  panel.querySelectorAll('[data-project]').forEach(b=>b.addEventListener('click',()=>openProject(b.dataset.project)));bindProjectControls();
}
function renderProjectRunner(){
  const p=PROJECTS.find(x=>x.id===activeProject);if(!p||!projectState)return '';
  const controls=p.id==='HAPPY_WALKER'||p.id==='COIN_CHASE'?'<button id="projLeft">◀ LEFT</button><button id="projRight">RIGHT ▶</button>':p.id==='BOUNCE_BOX'?'<button id="projStep">STEP</button><button id="projRun">RUN ×20</button>':'<button id="projStep">RUN</button>';
  return `<section class="runner-box"><div class="row"><b>RUNNING: ${p.title}</b><button id="closeProject">×</button></div><pre class="game-screen">${esc(renderProjectAscii(projectState))}</pre><div class="runner-controls">${controls}</div><div class="note">This program calls the civilization's verified TinyC genomes at runtime.</div></section>`;
}
function openProject(id){activeProject=id;projectState=createProjectState(id);renderProjects();}
function projectInput(input){if(!projectState)return;stepProject(projectState,library,input);renderProjects();}
function bindProjectControls(){
  $('closeProject')?.addEventListener('click',()=>{activeProject=null;projectState=null;renderProjects();});
  $('projLeft')?.addEventListener('click',()=>projectInput(-1));$('projRight')?.addEventListener('click',()=>projectInput(1));
  $('projStep')?.addEventListener('click',()=>projectInput(0));$('projRun')?.addEventListener('click',()=>{for(let i=0;i<20;i++)stepProject(projectState,library,0);renderProjects();});
}

function renderWorldPanel(){
  const flooded=world.chunks.filter(c=>c.flood>.45).length,homes=world.chunks.filter(c=>c.shelter>.62).length;
  panel.innerHTML=`<section><h2>World key</h2><div class="legend">${LEGEND.map(([g,n])=>`<span><b>${g}</b> ${n}</span>`).join('')}</div></section>
  <section><h3>World state</h3><div class="facts"><span>people <b>${agents.length}</b></span><span>districts <b>${CHUNK_COUNT}</b></span><span>flooded <b>${flooded}</b></span><span>home-rich <b>${homes}</b></span><span>births <b>${births}</b></span><span>deaths <b>${deaths}</b></span></div></section>
  <section><h3>Recent events</h3>${events.slice(0,16).map(e=>`<div class="event ${e.type}">${esc(e.msg)}</div>`).join('')||'<div class="note">Nothing dramatic yet.</div>'}</section>`;
}
function renderPanel(){if(tab==='person')renderPerson();else if(tab==='projects')renderProjects();else if(tab==='learning')renderLearning();else renderWorldPanel();}

function renderHud(){
  const learned=Object.keys(library).length,ready=PROJECTS.filter(p=>projectReady(p,library)).length;
  hud.innerHTML=`<b>DAY ${day.toFixed(1)}</b> · ☺ ${agents.length.toLocaleString()} · TinyC learned ${learned}/${Object.keys(TASKS).length} · programs ${ready}/${PROJECTS.length}<br>world sweep ${bar(world.processed)} ${pct(world.processed)} · flood ${pct(flood)} · speed ×${turbo}`;
}
function draw(){drawAsciiWorld(ctx,world,agents,selected?.id,W,H);renderHud();frames++;}

canvas.addEventListener('pointerdown',e=>{
  const r=canvas.getBoundingClientRect(),tx=clamp(Math.floor((e.clientX-r.left)/r.width*MAP_COLS),0,MAP_COLS-1),ty=clamp(Math.floor((e.clientY-r.top)/r.height*MAP_ROWS),0,MAP_ROWS-1);
  const wp=mapTileToWorld(tx,ty);let best=null,bd=(WORLD_W/MAP_COLS*2.2)**2;
  for(const a of agents){if(!a.alive)continue;const d=(a.x-wp.x)**2+(a.y-wp.y)**2;if(d<bd){bd=d;best=a;}}
  if(best){selected=best;tab='person';document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab==='person'));renderPanel();}
});

document.querySelectorAll('.tabs button').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.tab;document.querySelectorAll('.tabs button').forEach(x=>x.classList.toggle('on',x===b));renderPanel();}));
$('pause').addEventListener('click',()=>{paused=!paused;$('pause').textContent=paused?'▶ RESUME':'⏸ PAUSE';});
$('turbo').addEventListener('click',()=>{turbo=turbo===1?4:turbo===4?16:turbo===16?64:1;$('turbo').textContent=`⚡ SPEED ×${turbo}`;});
$('rain').addEventListener('click',()=>{rain=1;flood=Math.min(1,flood+.10);log('You triggered a storm. Low ground is taking water.','info');});
$('zero').addEventListener('click',()=>resetZero());
$('popCap').addEventListener('input',e=>{popCap=+e.target.value;$('popValue').textContent=popCap;});

function serialize(){return {version:5,tick,day,rain,flood,totalMoney,births,deaths,murders,jobs,nextId,library,artifacts,agents:agents.slice(0,5000),world};}
$('save').addEventListener('click',()=>{localStorage.setItem('genesis-codehood-v5',JSON.stringify(serialize()));log('World saved on this device.','good');});
$('export').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(serialize(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`codehood-world-${Date.now()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
function load(){
  try{const raw=localStorage.getItem('genesis-codehood-v5');if(!raw)return false;const s=JSON.parse(raw);tick=s.tick||0;day=s.day||0;rain=s.rain||0;flood=s.flood||0;totalMoney=s.totalMoney||0;births=s.births||0;deaths=s.deaths||0;murders=s.murders||0;jobs=s.jobs||0;nextId=s.nextId||1;library=s.library||{};artifacts=s.artifacts||[];agents=s.agents||[];world=s.world||createWorld();rebuildOccupancy(world,agents);log('Loaded saved TinyC world.','good');return true;}catch(err){console.warn(err);return false;}
}

function boot(){
  const steps=[['GENERATING WORLD',18],['BUILDING ROADS + HOMES',38],['SPAWNING ZERO-SEED LEARNERS',62],['INDEXING CHUNKS',78],['LOADING TINYC GRAMMAR',92],['READY',100]];
  let i=0;const next=()=>{const [label,n]=steps[i++];$('bootLabel').textContent=label;$('bootPercent').textContent=`${n}%`;$('bootBar').style.width=`${n}%`;$('bootDetail').textContent=i<steps.length?'TinyC grammar is loaded; no solved programs are loaded.':'Click a ☺ person or open PROJECTS.';if(i<steps.length)setTimeout(next,70);else setTimeout(()=>$('boot').classList.add('done'),160);};next();
}

if(!load())resetZero();else renderPanel();boot();
function loop(now){
  if(!paused){const start=performance.now();for(let i=0;i<turbo;i++){simBatch();if(performance.now()-start>10)break;}}
  draw();
  if(now-lastStat>1000){fps=frames*1000/(now-lastStat);bps=batchesThisSec*1000/(now-lastStat);sps=sweepsThisSec*1000/(now-lastStat);$('fps').textContent=fps.toFixed(0);$('bps').textContent=bps.toFixed(0);$('sps').textContent=sps.toFixed(1);frames=batchesThisSec=sweepsThisSec=0;lastStat=now;renderPanel();}
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
