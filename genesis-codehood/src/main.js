import { disassemble } from './vm.js';
import { TASKS, VERIFY_CASES, evaluateProgram, unlockedTaskNames } from './tasks.js';
import { behaviorSignature, chooseAction } from './brain.js';
import { createAgent, critiqueAgent, emptyLibrary, retargetAgent, scoreCandidate, socialLearn } from './evolution.js';
import { CHUNK_COUNT, CHUNK_SIZE, WORLD_H, WORLD_W, chunkIndexFor, createWorld, neighboringChunks, rebuildOccupancy, takeChunkBatch, updateEnvironment } from './world.js';
import { LEGEND, MAP_COLS, MAP_ROWS, drawAsciiWorld, mapTileToWorld } from './ascii.js';
import { PROJECTS, createProjectState, projectProgress, projectReady, renderProjectAscii, stepProject } from './projects.js';

const $=id=>document.getElementById(id),canvas=$('world'),ctx=canvas.getContext('2d',{alpha:false}),panel=$('panel'),hud=$('hud');
let W=1000,H=700,DPR=1,paused=false,turbo=1,tick=0,day=0,rain=0,flood=0,totalMoney=0,births=0,deaths=0,murders=0,jobs=0;
let frames=0,batchesThisSec=0,sweepsThisSec=0,lastStat=performance.now(),lastDraw=0,fps=0,bps=0,sps=0,nextId=1;
let agents=[],selected=null,tab='person',library=emptyLibrary(),artifacts=[],events=[],world=createWorld(0xBADC0DE),popCap=+$('popCap').value,activeProject=null,projectState=null;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),pct=v=>`${Math.round(clamp(v)*100)}%`;
function log(msg,type='info'){events.unshift({msg,type,tick});if(events.length>30)events.length=30;}
function bar(v){return `<span class="mini-bar"><i style="width:${clamp(v)*100}%"></i></span>`;}
function resize(){const r=canvas.getBoundingClientRect();DPR=Math.min(2,devicePixelRatio||1);canvas.width=Math.max(1,Math.floor(r.width*DPR));canvas.height=Math.max(1,Math.floor(r.height*DPR));W=r.width;H=r.height;ctx.setTransform(DPR,0,0,DPR,0,0);}addEventListener('resize',resize);resize();

function spawn(parent=null){if(agents.length>=popCap)return null;const a=createAgent(nextId++,Math.random,parent,library);if(parent){a.x=clamp(parent.x+(Math.random()-.5)*28,0,WORLD_W-1);a.y=clamp(parent.y+(Math.random()-.5)*28,0,WORLD_H-1);}agents.push(a);births++;return a;}
function placeFounders(){
  const preferred=['LAB','LAB','WORK','LAB','HOME'];
  for(let i=0;i<agents.length;i++){
    const sites=world.chunks.filter(c=>c.site===preferred[i]);const c=sites[i%Math.max(1,sites.length)]||world.chunks.find(x=>x.site==='HOME')||world.chunks[0];
    agents[i].x=c.cx*CHUNK_SIZE+CHUNK_SIZE*.5+(i-2)*5;agents[i].y=c.cy*CHUNK_SIZE+CHUNK_SIZE*.5;agents[i].tx=agents[i].x;agents[i].ty=agents[i].y;
  }
}
function resetZero(){
  paused=false;tick=day=rain=flood=totalMoney=births=deaths=murders=jobs=0;nextId=1;library=emptyLibrary();artifacts=[];events=[];selected=null;activeProject=null;projectState=null;
  world=createWorld((Math.random()*0xffffffff)>>>0);agents=[];for(let i=0;i<Math.min(5,popCap);i++)spawn();placeFounders();rebuildOccupancy(world,agents);selected=agents[0]||null;
  log('NEW WORLD: five people woke up with zero solved programs.','good');log('Their first useful target is simple executable state logic. Later skills install flood tools, navigation, games and simulations.','info');renderPanel();
}
function currentChunk(a){return world.chunks[chunkIndexFor(a.x,a.y)];}
function localPeer(c,a){if(c.agents.length<2)return null;for(let i=0;i<6;i++){const b=c.agents[(Math.random()*c.agents.length)|0];if(b&&b!==a&&b.alive)return b;}return null;}
function obs(a,c){return{hunger:clamp((72-a.energy)/62),flood:c.flood,food:c.food,jobs:c.jobs,shelter:c.shelter,danger:c.danger,crowd:clamp(c.agents.length/12),poor:clamp((45-a.money)/45)};}
function targetChunk(a,c){a.tx=c.cx*CHUNK_SIZE+12+Math.random()*(CHUNK_SIZE-24);a.ty=c.cy*CHUNK_SIZE+12+Math.random()*(CHUNK_SIZE-24);}
function move(a,mult=1){const dx=a.tx-a.x,dy=a.ty-a.y,d=Math.hypot(dx,dy)||1;a.vx=a.vx*.67+(dx/d)*.33;a.vy=a.vy*.67+(dy/d)*.33;a.x=clamp(a.x+a.vx*5*mult,0,WORLD_W-1);a.y=clamp(a.y+a.vy*5*mult,0,WORLD_H-1);}
function programWork(a,c){
  const before=Object.keys(library).length,out=scoreCandidate(a,library,Math.random);jobs++;totalMoney+=out.pay;c.programs++;
  if(out.improvedPersonal&&a.bestPassRate>.08&&Math.random()<.08)log(`${a.name} improved ${a.task}: ${Math.round(a.bestPassRate*96)}/96 tests after ${out.attempts} variants.`,'info');
  if(out.shipped&&out.improved){const skill=library[a.task];skill.tick=tick;artifacts.unshift({name:`${a.task.toLowerCase()}_${a.id}_v${skill.version}.vm`,task:a.task,program:skill.program,author:a.label,tick,verified:true});artifacts.length=Math.min(120,artifacts.length);log(`★ ${a.name} LEARNED ${a.task}: 96/96 executable tests passed.`,'good');}
  if(Object.keys(library).length>before){const unlocked=unlockedTaskNames(library);log(`NEW PROGRAMMING CAPABILITIES OPENED: ${unlocked.join(' · ')}`,'money');for(const person of agents)retargetAgent(person,library,Math.random);}
}
function fight(a,b,c){if(!b?.alive)return;a.stats.conflicts++;b.stats.conflicts++;const atk=a.energy*.35+a.skill*.18+Math.random()*18,def=b.energy*.35+b.skill*.18+Math.random()*18;a.energy-=1.7;b.energy-=atk>def?3.6:1.2;if(atk>def*1.55&&b.energy<11&&Math.random()<.08){b.alive=false;deaths++;murders++;c.deaths++;log(`A fight near ${c.biome.toLowerCase()} ${c.cx},${c.cy} killed ${b.name}.`,'bad');}}
function act(a,c,action){
  a.lastAction=action;a.actionTicks++;a.energy-=.16;a.money=Math.max(0,a.money-.008);if(a.money<=0)a.energy-=.05;a.energy-=c.flood*(action==='SHELTER'?.10:.58);
  if(action==='FORAGE'){const take=Math.min(c.food,.018+.012*Math.random());c.food-=take;a.energy+=take*230;a.stats.food+=take;if(take<.004)a.energy-=.18;}
  else if(action==='WORK'){const wage=.08+c.jobs*.48;c.jobs=Math.max(0,c.jobs-.0035);a.money+=wage;totalMoney+=wage;a.energy-=.18;if(a.age-a.lastJob>=2){programWork(a,c);a.lastJob=a.age;}if(a.role==='CRITIC'||a.role==='TESTER'||a.role==='SECURITY'){const t=localPeer(c,a);if(t){const f=critiqueAgent(a,t);if(f&&Math.random()<.04)log(`${a.name} found a real failing ${t.task} case: (${f.a}, ${f.b}).`,'bad');}}}
  else if(action==='SHELTER'){a.energy+=.22*c.shelter;a.stats.shelter++;a.tx=c.cx*CHUNK_SIZE+CHUNK_SIZE*.5;a.ty=c.cy*CHUNK_SIZE+CHUNK_SIZE*.5;}
  else if(action==='EXPLORE'){a.energy-=.06;if(Math.hypot(a.tx-a.x,a.ty-a.y)<20||Math.random()<.14){const n=neighboringChunks(world,c);if(n.length)targetChunk(a,n[(Math.random()*n.length)|0]);}}
  else if(action==='REST'){a.energy+=.44*c.shelter+.08;a.vx*=.5;a.vy*=.5;}
  else if(action==='SOCIAL'){const b=localPeer(c,a);if(b){socialLearn(a,b,Math.random);a.tx=b.x;a.ty=b.y;}a.energy-=.03;}
  else if(action==='FIGHT')fight(a,localPeer(c,a),c);
  if(action!=='REST')move(a,c.flood>.45?.5:1);a.energy=Math.min(100,a.energy);
}
function stepAgent(a,c){if(!a.alive)return;a.age++;let action=chooseAction(a.brain,obs(a,c),Math.random);if(a.age<35&&['BUILDER','TESTER','OPTIMIZER'].includes(a.role)&&c.jobs>.55&&Math.random()<.38)action='WORK';act(a,c,action);if(a.energy>78&&a.money>80&&a.age>120&&agents.length<popCap&&Math.random()<.0015){a.energy-=11;a.money-=30;const child=spawn(a);if(child){a.stats.children++;c.births++;}}if(a.energy<=0||a.age>9000+Math.random()*3000){a.alive=false;deaths++;c.deaths++;}}
function processChunk(c){updateEnvironment(c,{floodLevel:flood,rain});c.visits++;for(const a of c.agents.slice())stepAgent(a,c);}
function finishSweep(){agents=agents.filter(a=>a.alive);rebuildOccupancy(world,agents);sweepsThisSec++;day=world.sweep/12;if(rain>0){rain=Math.max(0,rain-.012);flood=Math.min(1,flood+.006*rain);}else flood=Math.max(0,flood-.0035);if(Math.random()<.006){rain=.55+Math.random()*.45;log('Storm front arrived. River and low marshes are rising.','info');}if(!agents.length){paused=true;log('CIVILIZATION EXTINCT — make a NEW WORLD to try another lineage.','bad');}}
function simBatch(){tick++;batchesThisSec++;const before=world.sweep,batch=takeChunkBatch(world,6);for(const c of batch)processChunk(c);if(world.sweep!==before)finishSweep();}

function bestByTask(){const out={};for(const a of agents){const p=out[a.task];if(!p||a.bestPassRate>p.bestPassRate)out[a.task]=a;}return out;}
function selectedSprite(a){const face=a.energy<24?'☹':a.lastAction==='WORK'?'☻':'☺';return ` \\${face}/\n  |\n / \\`;}
function projectUses(skill){return PROJECTS.filter(p=>p.requires.includes(skill)).map(p=>p.title).join(', ');}
function renderPerson(){
  const a=selected&&selected.alive?selected:agents[0];if(!a){panel.innerHTML='<section><h2>No living people</h2><p>Start a new world.</p></section>';return;}selected=a;
  const c=currentChunk(a),report=evaluateProgram(a.bestProgram||a.program,a.task,VERIFY_CASES),sig=behaviorSignature(a.brain);
  const roster=agents.map(p=>`<button class="person-chip ${p===a?'selected':''}" data-agent="${p.id}">☺ ${p.name}<small>${p.role} · ${p.lastAction}</small></button>`).join('');
  panel.innerHTML=`<section class="explain"><h2>Your five people</h2><p>Pick one. The map is their home; the code below is what that person has actually evolved so far.</p><div class="people-list">${roster}</div></section>
  <section class="person-head"><pre>${esc(selectedSprite(a))}</pre><div><h2>${esc(a.name)}</h2><div>${a.role} · generation ${a.generation}</div><div class="status">RIGHT NOW: ${a.lastAction}</div></div></section>
  <section><h3>Where are they?</h3><div class="facts"><span>biome <b>${c.biome}</b></span><span>place <b>${c.site}</b></span><span>energy <b>${a.energy.toFixed(0)}</b></span><span>money <b>${a.money.toFixed(0)}</b></span></div></section>
  <section><h3>What are they trying to learn?</h3><div class="lesson-name">${a.task}</div><p>${TASKS[a.task].label}</p><div class="progress-line">${bar(report.passRate)} <b>${report.passed}/96 tests</b></div><p class="note">Last work cycle tried ${a.lastAttempts||0} executable variants. <b>Only 96/96 becomes shared knowledge.</b></p><pre class="code">${esc(disassemble(a.bestProgram||a.program))}</pre></section>
  <section><h3>What has their survival policy evolved?</h3><div class="facts"><span>hungry → <b>${sig.hungry}</b></span><span>flooded → <b>${sig.flooded}</b></span><span>broke → <b>${sig.broke}</b></span><span>danger → <b>${sig.danger}</b></span></div></section>`;
  panel.querySelectorAll('[data-agent]').forEach(b=>b.addEventListener('click',()=>{selected=agents.find(x=>x.id===+b.dataset.agent)||selected;renderPerson();}));
}
function renderLearning(){
  const best=bestByTask(),unlocked=new Set(unlockedTaskNames(library));
  panel.innerHTML=`<section class="explain"><h2>Programming school</h2><p><b>No solution programs are loaded.</b> The five people mutate primitive stack/control-flow code, execute it, keep improvements, and share a skill only after all 96 deterministic tests pass.</p></section>`+Object.entries(TASKS).map(([name,t])=>{const learned=library[name],a=best[name],rate=learned?1:(a?.bestPassRate||0),locked=!unlocked.has(name);return `<section class="lesson ${learned?'learned':locked?'locked':''}"><div class="row"><b>${name}</b><span>${learned?'✓ VERIFIED':locked?'LOCKED':`${Math.round(rate*96)}/96`}</span></div><div>${t.label}</div><div class="progress-line">${bar(rate)} ${pct(rate)}</div><div class="note">Builds using it: ${projectUses(name)||'later systems'}</div>${learned?`<pre class="code">${esc(disassemble(learned.program))}</pre>`:''}</section>`;}).join('');
}
function renderProjects(){
  const cards=PROJECTS.map(p=>{const prog=projectProgress(p,library),ready=projectReady(p,library),installed=ready&&p.kind==='WORLD TOOL';return `<section class="project ${ready?'ready':''}"><div class="row"><div><b>${p.title}</b> <span class="kind">${p.kind}</span></div><span>${installed?'INSTALLED':ready?'READY':`${prog.learned.length}/${prog.total}`}</span></div><p>${p.description}</p><div class="progress-line">${bar(prog.ratio)} ${pct(prog.ratio)}</div><div class="note">${ready?(installed?'The verified evolved modules are now used by the world simulation.':'Every required runtime module is verified.'):`Still needs: ${prog.missing.join(', ')}`}</div><button data-project="${p.id}" ${ready?'':'disabled'}>${ready?'▶ OPEN / TEST':'LOCKED'}</button></section>`;}).join('');
  panel.innerHTML=`<section class="explain"><h2>Things they can actually build</h2><p>Training games prove basics. World tools affect the settlement. Later projects become automation, navigation tools and simulations.</p></section>${activeProject?renderProjectRunner():''}${cards}`;panel.querySelectorAll('[data-project]').forEach(b=>b.addEventListener('click',()=>openProject(b.dataset.project)));bindProjectControls();
}
function renderProjectRunner(){const p=PROJECTS.find(x=>x.id===activeProject);if(!p||!projectState)return'';const controls=p.id==='HAPPY_WALKER'||p.id==='COIN_CHASE'?'<button id="projLeft">◀ LEFT</button><button id="projRight">RIGHT ▶</button>':p.id==='BOUNCE_BOX'?'<button id="projStep">STEP</button><button id="projRun">RUN ×20</button>':'<button id="projStep">RUN / STEP</button><button id="projRun">RUN ×20</button>';return `<section class="runner-box"><div class="row"><b>RUNNING: ${p.title}</b><button id="closeProject">×</button></div><pre class="game-screen">${esc(renderProjectAscii(projectState))}</pre><div class="runner-controls">${controls}</div><div class="note">This runner calls the civilization's verified evolved genomes at runtime.</div></section>`;}
function openProject(id){activeProject=id;projectState=createProjectState(id);renderProjects();}
function projectInput(input){if(!projectState)return;stepProject(projectState,library,input);renderProjects();}
function bindProjectControls(){$('closeProject')?.addEventListener('click',()=>{activeProject=null;projectState=null;renderProjects();});$('projLeft')?.addEventListener('click',()=>projectInput(-1));$('projRight')?.addEventListener('click',()=>projectInput(1));$('projStep')?.addEventListener('click',()=>projectInput(0));$('projRun')?.addEventListener('click',()=>{for(let i=0;i<20;i++)stepProject(projectState,library,0);renderProjects();});}
function renderWorldPanel(){
  const biomeCounts={},siteCounts={};for(const c of world.chunks){biomeCounts[c.biome]=(biomeCounts[c.biome]||0)+1;siteCounts[c.site]=(siteCounts[c.site]||0)+1;}
  const alarms=world.chunks.filter(c=>c.floodAlarm).length,pumps=world.chunks.filter(c=>c.pumpActive).length;
  panel.innerHTML=`<section class="explain"><h2>How to read the world</h2><p>This is geography, not a matrix. Different terrain changes food, water, wood, ore, shelter, danger and flooding.</p><div class="legend">${LEGEND.map(([g,n])=>`<span><b>${g}</b> ${n}</span>`).join('')}</div></section>
  <section><h3>World right now</h3><div class="facts"><span>people <b>${agents.length}</b></span><span>river/flood alarms <b>${alarms}</b></span><span>evolved pumps active <b>${pumps}</b></span><span>deaths <b>${deaths}</b></span></div><pre>${Object.entries(biomeCounts).map(([k,v])=>`${k.padEnd(10)} ${v}`).join('\n')}</pre></section>
  <section><h3>Places</h3><pre>${Object.entries(siteCounts).filter(([k])=>k!=='WILDS').map(([k,v])=>`${k.padEnd(10)} ${v}`).join('\n')}</pre></section>
  <section><h3>Recent story</h3>${events.slice(0,16).map(e=>`<div class="event ${e.type}">${esc(e.msg)}</div>`).join('')||'<div class="note">Nothing dramatic yet.</div>'}</section>`;
}
function renderPanel(){if(tab==='person')renderPerson();else if(tab==='projects')renderProjects();else if(tab==='learning')renderLearning();else renderWorldPanel();}
function renderHud(){const learned=Object.keys(library).length,ready=PROJECTS.filter(p=>projectReady(p,library)).length,pumps=world.chunks.filter(c=>c.pumpActive).length;hud.innerHTML=`<b>☺ ${agents.length} PEOPLE</b> · day ${day.toFixed(1)} · verified skills ${learned}/${Object.keys(TASKS).length} · builds ${ready}/${PROJECTS.length}<br>${learned?'Civilization knowledge is growing.':'Nobody knows a verified program yet.'} ${pumps?`· ${pumps} evolved pump${pumps===1?'':'s'} running`:''}<br><span class="note">Tap a ☺ person. Open BUILDS to see what their code can actually do.</span>`;}
function draw(){drawAsciiWorld(ctx,world,agents,selected?.id,W,H);renderHud();frames++;}
canvas.addEventListener('pointerdown',e=>{const r=canvas.getBoundingClientRect(),tx=clamp(Math.floor((e.clientX-r.left)/r.width*MAP_COLS),0,MAP_COLS-1),ty=clamp(Math.floor((e.clientY-r.top)/r.height*MAP_ROWS),0,MAP_ROWS-1),wp=mapTileToWorld(tx,ty);let best=null,bd=(WORLD_W/MAP_COLS*2.5)**2;for(const a of agents){if(!a.alive)continue;const d=(a.x-wp.x)**2+(a.y-wp.y)**2;if(d<bd){bd=d;best=a;}}if(best){selected=best;tab='person';document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab==='person'));renderPanel();}});
document.querySelectorAll('.tabs button').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.tab;document.querySelectorAll('.tabs button').forEach(x=>x.classList.toggle('on',x===b));renderPanel();}));
$('pause').addEventListener('click',()=>{paused=!paused;$('pause').textContent=paused?'▶ RESUME':'⏸ PAUSE';});$('turbo').addEventListener('click',()=>{turbo=turbo===1?4:turbo===4?16:turbo===16?64:1;$('turbo').textContent=`⚡ EVOLVE ×${turbo}`;});$('rain').addEventListener('click',()=>{rain=1;flood=Math.min(1,flood+.10);log('You triggered a storm. Watch low marshes, riverbanks and evolved flood tools.','info');});$('zero').addEventListener('click',resetZero);$('popCap').addEventListener('input',e=>{popCap=+e.target.value;$('popValue').textContent=popCap;});
function serialize(){return{version:6,tick,day,rain,flood,totalMoney,births,deaths,murders,jobs,nextId,library,artifacts,agents:agents.slice(0,500),world};}
$('save').addEventListener('click',()=>{localStorage.setItem('genesis-codehood-v6',JSON.stringify(serialize()));log('This five-person world was saved on your device.','good');});$('export').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(serialize(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`codehood-world-${Date.now()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
function load(){try{const raw=localStorage.getItem('genesis-codehood-v6');if(!raw)return false;const s=JSON.parse(raw);tick=s.tick||0;day=s.day||0;rain=s.rain||0;flood=s.flood||0;totalMoney=s.totalMoney||0;births=s.births||0;deaths=s.deaths||0;murders=s.murders||0;jobs=s.jobs||0;nextId=s.nextId||1;library=s.library||{};artifacts=s.artifacts||[];agents=(s.agents||[]).slice(0,Math.max(5,popCap));world=s.world||createWorld();rebuildOccupancy(world,agents);selected=agents[0]||null;for(const a of agents)retargetAgent(a,library,Math.random);log('Loaded your Codehood v6 world.','good');return true;}catch(err){console.warn(err);return false;}}
function boot(){const steps=[['GENERATING BIOMES',16],['CARVING RIVER + CAVES',32],['PLACING RUINS + SETTLEMENT',50],['SPAWNING FIVE PEOPLE',66],['INDEXING WORLD CHUNKS',78],['STARTING ZERO-SOLUTION SCHOOL',92],['READY',100]];let i=0;const next=()=>{const [label,n]=steps[i++];$('bootLabel').textContent=label;$('bootPercent').textContent=`${n}%`;$('bootBar').style.width=`${n}%`;$('bootDetail').textContent=i<steps.length?'No solved programs are being loaded.':'Tap a ☺. You only have five people to follow.';if(i<steps.length)setTimeout(next,80);else setTimeout(()=>$('boot').classList.add('done'),180);};next();}
if(!load())resetZero();else renderPanel();boot();
function loop(now){if(!paused){const start=performance.now();for(let i=0;i<turbo;i++){simBatch();if(performance.now()-start>11)break;}}if(now-lastDraw>50){draw();lastDraw=now;}if(now-lastStat>1000){fps=frames*1000/(now-lastStat);bps=batchesThisSec*1000/(now-lastStat);sps=sweepsThisSec*1000/(now-lastStat);$('fps').textContent=fps.toFixed(0);$('bps').textContent=bps.toFixed(0);$('sps').textContent=sps.toFixed(1);frames=batchesThisSec=sweepsThisSec=0;lastStat=now;renderPanel();}requestAnimationFrame(loop);}requestAnimationFrame(loop);
