import { disassemble, runProgram } from './vm.js';
import { TASKS, VERIFY_CASES, evaluateProgram, unlockedTaskNames } from './tasks.js';
import { ACTIONS, behaviorSignature, chooseAction } from './brain.js';
import { ROLES, createAgent, critiqueAgent, emptyLibrary, retargetAgent, scoreCandidate, socialLearn } from './evolution.js';
import { CHUNK_COLS, CHUNK_COUNT, CHUNK_ROWS, CHUNK_SIZE, WORLD_H, WORLD_W, chunkIndexFor, createWorld, neighboringChunks, rebuildOccupancy, takeChunkBatch, updateEnvironment } from './world.js';

const $=(id)=>document.getElementById(id);
const canvas=$('world'),ctx=canvas.getContext('2d',{alpha:false});
const panel=$('panel'),hud=$('hud'),terminal=$('terminal');
let W=1000,H=700,DPR=1;
let paused=false,started=false,turbo=1,tick=0,day=0,rain=0,flood=0;
let totalMoney=0,births=0,deaths=0,murders=0,jobs=0,chunkUpdates=0;
let frames=0,batchesThisSec=0,sweepsThisSec=0,lastStat=performance.now();
let fps=0,bps=0,sps=0;
let nextId=1,agents=[],selected=null,selectedChunk=null,tab='agent';
let library=emptyLibrary(),artifacts=[],logLines=[];
let world=createWorld(0xBADC0DE),lastSweep=0;
let popCap=+$('popCap').value;
const actionCounts=Object.fromEntries(ACTIONS.map(a=>[a,0]));

const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));}
function log(msg,type='info'){logLines.unshift({msg,type,t:tick});if(logLines.length>32)logLines.length=32;}
function bar(pct){return `<span class="mini-bar"><i style="width:${clamp(pct)*100}%"></i></span>`;}

function resize(){
  const r=canvas.getBoundingClientRect();DPR=Math.min(2,devicePixelRatio||1);
  canvas.width=Math.max(1,(r.width*DPR)|0);canvas.height=Math.max(1,(r.height*DPR)|0);W=r.width;H=r.height;
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
addEventListener('resize',resize);resize();

function spawn(parent=null){
  if(agents.length>=popCap)return null;
  const a=createAgent(nextId++,Math.random,parent,library);
  if(parent){a.x=clamp(parent.x+(Math.random()-.5)*28,0,WORLD_W-1);a.y=clamp(parent.y+(Math.random()-.5)*28,0,WORLD_H-1);}
  agents.push(a);births++;return a;
}

function currentChunk(a){return world.chunks[chunkIndexFor(a.x,a.y)];}
function localPeer(chunk,a){
  if(chunk.agents.length<2)return null;
  for(let i=0;i<5;i++){const b=chunk.agents[(Math.random()*chunk.agents.length)|0];if(b&&b!==a&&b.alive)return b;}
  return null;
}

function observations(a,chunk){
  return {hunger:clamp((72-a.energy)/62),flood:chunk.flood,food:chunk.food,jobs:chunk.jobs,shelter:chunk.shelter,danger:chunk.danger,crowd:clamp(chunk.agents.length/70),poor:clamp((45-a.money)/45)};
}

function setTargetToChunk(a,chunk){
  a.tx=chunk.cx*CHUNK_SIZE+12+Math.random()*(CHUNK_SIZE-24);
  a.ty=chunk.cy*CHUNK_SIZE+12+Math.random()*(CHUNK_SIZE-24);
}

function moveAgent(a,mult=1){
  const dx=a.tx-a.x,dy=a.ty-a.y,d=Math.hypot(dx,dy)||1;
  a.vx=a.vx*.68+(dx/d)*.32;a.vy=a.vy*.68+(dy/d)*.32;
  a.x=clamp(a.x+a.vx*5.2*mult,0,WORLD_W-1);a.y=clamp(a.y+a.vy*5.2*mult,0,WORLD_H-1);
}

function doProgramming(a,chunk){
  const before=Object.keys(library).length;
  const out=scoreCandidate(a,library,Math.random);jobs++;totalMoney+=out.pay;chunk.programs++;
  if(out.improvedPersonal&&a.bestPassRate>0&&Math.random()<.025)log(`↗ ${a.label} improved ${a.task} to ${(a.bestPassRate*100).toFixed(0)}%`,'info');
  if(out.shipped){
    const stored=library[a.task];stored.tick=tick;
    if(out.improved){
      artifacts.unshift({name:`${a.task.toLowerCase()}_${a.id}_v${stored.version}.vm`,task:a.task,program:stored.program,author:a.label,tick,verified:true});
      artifacts.length=Math.min(120,artifacts.length);
      log(`★ DISCOVERY: ${a.label} evolved ${a.task} — ${stored.program.length} instructions / ${stored.report.avgSteps.toFixed(1)} avg steps`,'good');
    }
  }
  const after=Object.keys(library).length;
  if(after>before){
    const now=unlockedTaskNames(library);log(`🔓 curriculum expanded: ${now.join(' · ')}`,'money');
    for(let i=0;i<Math.min(80,agents.length);i++)retargetAgent(agents[(Math.random()*agents.length)|0],library,Math.random);
  }
}

function abstractFight(a,b,chunk){
  if(!b||!b.alive)return;
  a.stats.conflicts++;b.stats.conflicts++;
  const atk=a.energy*.35+a.skill*.18+Math.random()*18;
  const def=b.energy*.35+b.skill*.18+Math.random()*18;
  a.energy-=1.8;b.energy-=atk>def?3.8:1.2;
  if(atk>def*1.55&&b.energy<12&&Math.random()<.09){
    b.alive=false;deaths++;murders++;chunk.deaths++;const stolen=Math.min(18,b.money);a.money+=stolen;b.money-=stolen;
    log(`⚠ abstract street killing in C${chunk.cx},${chunk.cy}: ${a.label} killed ${b.label}`,'bad');
  }
}

function performAction(a,chunk,action){
  actionCounts[action]++;a.lastAction=action;a.actionTicks++;
  a.energy-=.22;a.money=Math.max(0,a.money-.012);
  if(a.money<=0)a.energy-=.07;
  const wetPenalty=chunk.flood*(action==='SHELTER'?.16:.78);a.energy-=wetPenalty;

  if(action==='FORAGE'){
    const take=Math.min(chunk.food,.018+.012*Math.random());chunk.food-=take;a.energy+=take*235;a.stats.food+=take;
    if(take<.004)a.energy-=.24;
  }else if(action==='WORK'){
    const wage=.10+chunk.jobs*.55;chunk.jobs=Math.max(0,chunk.jobs-.004);a.money+=wage;totalMoney+=wage;a.energy-=.26;
    if(a.age-a.lastJob>=2){doProgramming(a,chunk);a.lastJob=a.age;}
    if(a.role==='CRITIC'||a.role==='TESTER'||a.role==='SECURITY'){
      const target=localPeer(chunk,a);if(target){const f=critiqueAgent(a,target);if(f&&Math.random()<.015)log(`! ${a.label} found ${target.label} failure @ (${f.a},${f.b})`,'bad');}
    }
  }else if(action==='SHELTER'){
    a.stats.shelter++;a.energy+=.22*chunk.shelter;a.money=Math.max(0,a.money-.018*chunk.shelter);
    a.tx=chunk.cx*CHUNK_SIZE+CHUNK_SIZE*.5;a.ty=chunk.cy*CHUNK_SIZE+CHUNK_SIZE*.5;
  }else if(action==='EXPLORE'){
    a.energy-=.10;
    if(Math.hypot(a.tx-a.x,a.ty-a.y)<20||Math.random()<.16){const ns=neighboringChunks(world,chunk);if(ns.length)setTargetToChunk(a,ns[(Math.random()*ns.length)|0]);}
  }else if(action==='REST'){
    a.energy+=.45*chunk.shelter+.08;a.vx*=.5;a.vy*=.5;
  }else if(action==='SOCIAL'){
    const b=localPeer(chunk,a);if(b){socialLearn(a,b,Math.random);a.tx=b.x;a.ty=b.y;}a.energy-=.05;
  }else if(action==='FIGHT'){
    const b=localPeer(chunk,a);if(b)abstractFight(a,b,chunk);else a.energy-=.22;
  }

  if(action!=='REST')moveAgent(a,chunk.flood>.45?.52:1);
  if(chunk.danger>.45&&Math.random()<chunk.danger*.00045)a.energy-=3+Math.random()*4;
  a.energy=Math.min(100,a.energy);
}

function stepAgent(a,chunk){
  if(!a.alive)return;a.age++;
  if(!a.brain||a.brain.length!==63)a.brain=Array.from({length:63},()=>Math.random()*1.6-.8);
  const action=chooseAction(a.brain,observations(a,chunk),Math.random);
  performAction(a,chunk,action);
  if(a.energy>76&&a.money>72&&a.age>24&&agents.length<popCap&&Math.random()<.0085){
    a.energy-=11;a.money-=28;const child=spawn(a);if(child){a.stats.children++;chunk.births++;}
  }
  if(a.energy<=0||a.age>6200+Math.random()*2200){a.alive=false;deaths++;chunk.deaths++;}
}

function processChunk(chunk){
  updateEnvironment(chunk,{floodLevel:flood,rain});chunk.visits++;chunkUpdates++;
  const list=chunk.agents.slice();for(const a of list)stepAgent(a,chunk);
}

function finishSweep(){
  agents=agents.filter(a=>a.alive);rebuildOccupancy(world,agents);sweepsThisSec++;
  day=world.sweep/12;
  if(rain>0){rain=Math.max(0,rain-.012);flood=Math.min(1,flood+.006*rain);}else flood=Math.max(0,flood-.0035);
  if(Math.random()<.008){rain=.6+Math.random()*.4;log('🌧 storm front entered the grid — flood pressure rising','info');}
  if(agents.length===0){paused=true;log('☠ CIVILIZATION EXTINCT — use RESTART ZERO','bad');}
}

function simBatch(){
  tick++;batchesThisSec++;
  const before=world.sweep;const batch=takeChunkBatch(world,8);for(const chunk of batch)processChunk(chunk);
  if(world.sweep!==before)finishSweep();lastSweep=world.sweep;
}

function worldToScreen(x,y){return{x:x/WORLD_W*W,y:y/WORLD_H*H};}
function screenToWorld(x,y){return{x:x/W*WORLD_W,y:y/H*WORLD_H};}

function drawWorld(){
  ctx.fillStyle='#03070a';ctx.fillRect(0,0,W,H);
  const sx=W/WORLD_W,sy=H/WORLD_H;
  ctx.font=`${Math.max(7,Math.min(10,W/120))}px ui-monospace,monospace`;ctx.textBaseline='middle';ctx.textAlign='center';
  for(const c of world.chunks){
    const x=c.cx*CHUNK_SIZE*sx,y=c.cy*CHUNK_SIZE*sy,w=CHUNK_SIZE*sx,h=CHUNK_SIZE*sy;
    const floodAlpha=.06+c.flood*.32,dangerAlpha=.02+c.danger*.08;
    ctx.fillStyle=`rgba(42,128,210,${floodAlpha})`;ctx.fillRect(x,y,w,h);
    if(c.danger>.55){ctx.fillStyle=`rgba(190,55,62,${dangerAlpha})`;ctx.fillRect(x,y,w,h);}
    ctx.strokeStyle=c.id===selectedChunk?.id?'#ffe56d':'#173043';ctx.lineWidth=c.id===selectedChunk?.id?1.5:.55;ctx.strokeRect(x+.5,y+.5,w-1,h-1);
    ctx.fillStyle='#4c6b7d';ctx.fillText(`${String(c.cx).padStart(2,'0')}:${String(c.cy).padStart(2,'0')}`,x+16,y+8);
    const symbol=c.flood>.65?'~~~':c.jobs>c.food&&c.jobs>c.shelter?'[$]':c.food>c.shelter?'[*]':'[H]';
    ctx.fillStyle=c.flood>.65?'#69baff':c.jobs>c.food?'#ffd166':'#6ee59b';ctx.fillText(symbol,x+w*.5,y+h*.5);
  }
  const maxDraw=Math.min(agents.length,5000),stride=Math.max(1,Math.floor(agents.length/maxDraw));ctx.font='9px ui-monospace,monospace';
  for(let i=0;i<agents.length;i+=stride){const a=agents[i];if(!a.alive)continue;const p=worldToScreen(a.x,a.y);ctx.fillStyle=selected===a?'#fff074':a.lastAction==='WORK'?'#71e6ff':a.lastAction==='FORAGE'?'#78f0a5':a.lastAction==='FIGHT'?'#ff858b':'#b8ccd8';ctx.fillText('o',p.x,p.y);}
  if(selected&&selected.alive){const p=worldToScreen(selected.x,selected.y);ctx.font='10px ui-monospace,monospace';ctx.fillStyle='#fff';ctx.fillText(' O ',p.x,p.y-13);ctx.fillText('/|\\',p.x,p.y-4);ctx.fillText('/ \\',p.x,p.y+5);ctx.strokeStyle='#fff074';ctx.strokeRect(p.x-11,p.y-23,22,34);}
}

function bestByTask(){const map={};for(const a of agents){const cur=map[a.task];if(!cur||a.bestPassRate>cur.bestPassRate)map[a.task]=a;}return map;}
function behaviorPopulationSummary(){
  const sample=[],stride=Math.max(1,Math.floor(agents.length/120));for(let i=0;i<agents.length&&sample.length<120;i+=stride)sample.push(agents[i]);
  const probes=['hungry','flooded','broke','danger'],out={};
  for(const p of probes){const counts={};for(const a of sample){const s=behaviorSignature(a.brain)[p];counts[s]=(counts[s]||0)+1;}out[p]=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0]||'—';}
  return out;
}

function renderHud(){
  const verified=Object.keys(library).length,learn=verified/Object.keys(TASKS).length;
  hud.innerHTML=`<b class="cyan">GENESIS // ZERO-SEED WORLD</b><br>POP ${agents.length.toLocaleString()} / ${popCap.toLocaleString()} · DAY ${day.toFixed(1)} · SWEEP ${world.sweep.toLocaleString()}<br>CHUNK SWEEP ${bar(world.processed)} ${(world.processed*100).toFixed(0)}% · ${CHUNK_COUNT} chunks<br>PROGRAMMING ${bar(learn)} ${verified}/${Object.keys(TASKS).length} verified · JOBS ${jobs.toLocaleString()}<br>FLOOD ${bar(flood)} ${(flood*100).toFixed(0)}% · DEATHS ${deaths.toLocaleString()} · MURDERS ${murders}`;
  terminal.innerHTML=logLines.slice(0,17).map(x=>`<div class="line-${x.type}">${esc(x.msg)}</div>`).join('');
}

function programConsole(task,program){
  const report=evaluateProgram(program,task,VERIFY_CASES);
  return `<div class="card program-console"><b>EXECUTE INSIDE GENESIS VM</b><div class="runner">A <input id="runA" type="number" value="7"> B <input id="runB" type="number" value="-3"> <button id="runProgram" class="primary">▶ RUN</button></div><div id="runResult" class="result">${report.verified?`<span class="good">VERIFIED ${report.total}/${report.total}</span>`:`<span class="hot">${report.passed}/${report.total} tests</span>`}</div></div>`;
}
function bindRunner(task,program){const btn=$('runProgram');if(!btn)return;btn.onclick=()=>{const a=Number($('runA').value),b=Number($('runB').value),r=runProgram(program,{a,b}),expected=TASKS[task].fn(a,b),pass=r.ok&&r.value===expected;$('runResult').innerHTML=`result <b>${esc(r.ok?r.value:r.error)}</b> · expected ${expected} · ${r.steps} steps · <span class="${pass?'good':'hot'}">${pass?'PASS':'FAIL'}</span>`;};}

function renderAgent(){
  const a=selected||agents[0];if(!a){panel.innerHTML='<div class="card">No surviving agents.</div>';return;}
  const sig=behaviorSignature(a.brain),report=evaluateProgram(a.bestProgram||a.program,a.task,VERIFY_CASES),c=currentChunk(a);
  panel.innerHTML=`<div class="card hero"><div class="row"><b>${a.label}</b><span class="cyan">${a.role}</span></div><pre> O_o\n/|_|\n/ \\</pre><div class="tag">C${c.cx},${c.cy}</div><div class="tag">${a.lastAction}</div></div><div class="card"><b>SURVIVAL</b><div class="row"><span class="k">generation</span><span>${a.generation}</span></div><div class="row"><span class="k">energy</span><span>${a.energy.toFixed(1)}</span></div><div class="bar"><i style="width:${clamp(a.energy/100)*100}%"></i></div><div class="row"><span class="k">money</span><span class="gold">${a.money.toFixed(1)} CR</span></div><div class="row"><span class="k">children</span><span>${a.stats.children}</span></div></div><div class="card"><b>EVOLVED POLICY</b><div class="policy-grid"><span>hungry → <b>${sig.hungry}</b></span><span>flood → <b>${sig.flooded}</b></span><span>broke → <b>${sig.broke}</b></span><span>danger → <b>${sig.danger}</b></span></div><div class="note">These responses come from inherited/mutated weights, not a scripted if/else survival strategy.</div></div><div class="card"><b>${a.task} // BEST PROGRAM</b><div class="row"><span class="k">personal best</span><span>${(a.bestPassRate*100).toFixed(1)}%</span></div><div class="bar"><i style="width:${a.bestPassRate*100}%"></i></div><pre>${esc(disassemble(a.bestProgram||a.program))}</pre><div class="row"><span class="k">full verifier</span><span class="${report.verified?'good':'hot'}">${report.passed}/${report.total}</span></div></div>${programConsole(a.task,a.bestProgram||a.program)}`;
  bindRunner(a.task,a.bestProgram||a.program);
}

function renderLearning(){
  const best=bestByTask(),unlocked=new Set(unlockedTaskNames(library)),popSig=behaviorPopulationSummary();
  panel.innerHTML=`<div class="card truth"><b>LEARNING MODE: ZERO SEED</b><div class="good">No solved task genomes are loaded.</div><div class="note">The instruction set, world rules, action primitives, and test objectives are designed by us. The program sequences and survival-policy weights are evolved by the population.</div></div><div class="card"><b>POPULATION BEHAVIOR</b><div class="row"><span class="k">when hungry</span><span>${popSig.hungry}</span></div><div class="row"><span class="k">during flood</span><span>${popSig.flooded}</span></div><div class="row"><span class="k">when broke</span><span>${popSig.broke}</span></div><div class="row"><span class="k">in danger</span><span>${popSig.danger}</span></div></div>`+Object.entries(TASKS).map(([name,t])=>{const learned=library[name],b=best[name],pct=learned?1:(b?.bestPassRate||0);return `<div class="card"><div class="row"><b>${name}</b><span class="${learned?'good':unlocked.has(name)?'cyan':'k'}">${learned?'LEARNED':unlocked.has(name)?'EVOLVING':'LOCKED'}</span></div><div class="note">L${t.level} · ${t.label}</div><div class="bar"><i style="width:${pct*100}%"></i></div><div class="row"><span class="k">best observed</span><span>${(pct*100).toFixed(1)}%</span></div>${learned?`<div class="row"><span class="k">discovered by</span><span>${learned.author}</span></div>`:''}</div>`;}).join('');
}

function renderPrograms(){
  if(!artifacts.length){panel.innerHTML='<div class="card"><b>NO VERIFIED ARTIFACTS YET</b><p class="note">Nothing is faked here. This list stays empty until an agent evolves a program that passes all 96 verifier cases.</p></div>';return;}
  const x=artifacts[0];panel.innerHTML=`<div class="card"><b>EVOLVED EXECUTABLE ARTIFACTS</b><div class="note">These were created during this civilization run and execute inside the sandbox VM.</div></div>`+artifacts.slice(0,24).map(a=>`<div class="card"><div class="row"><b>${a.name}</b><span class="good">VERIFIED</span></div><pre>${esc(disassemble(a.program))}</pre><div class="row"><span class="k">author</span><span>${a.author}</span></div><button data-artifact="${esc(a.name)}">▶ EXECUTE 7,-3</button></div>`).join('')+programConsole(x.task,x.program);
  bindRunner(x.task,x.program);panel.querySelectorAll('[data-artifact]').forEach(btn=>btn.onclick=()=>{const a=artifacts.find(x=>x.name===btn.dataset.artifact);if(!a)return;const r=runProgram(a.program,{a:7,b:-3});log(`▶ ${a.name}(7,-3) = ${r.ok?r.value:r.error} / ${r.steps} steps`,r.ok?'good':'bad');});
}

function renderWorldPanel(){
  const c=selectedChunk||world.chunks.slice().sort((a,b)=>b.agents.length-a.agents.length)[0];
  const top=world.chunks.slice().sort((a,b)=>b.agents.length-a.agents.length).slice(0,8);
  panel.innerHTML=`<div class="card"><b>CHUNK GRID ${CHUNK_COLS} × ${CHUNK_ROWS}</b><div class="row"><span class="k">world</span><span>${WORLD_W}×${WORLD_H}</span></div><div class="row"><span class="k">chunk scheduler</span><span>8 / batch</span></div><div class="row"><span class="k">current sweep</span><span>${world.sweep}</span></div><div class="bar"><i style="width:${world.processed*100}%"></i></div></div><div class="card"><div class="row"><b>SELECTED C${c.cx},${c.cy}</b><span>${c.agents.length} agents</span></div><div class="row"><span class="k">food</span><span>${(c.food*100).toFixed(0)}%</span></div><div class="row"><span class="k">jobs</span><span>${(c.jobs*100).toFixed(0)}%</span></div><div class="row"><span class="k">shelter</span><span>${(c.shelter*100).toFixed(0)}%</span></div><div class="row"><span class="k">danger</span><span>${(c.danger*100).toFixed(0)}%</span></div><div class="row"><span class="k">flood</span><span>${(c.flood*100).toFixed(0)}%</span></div><div class="row"><span class="k">program attempts</span><span>${c.programs}</span></div></div><div class="card"><b>BUSIEST CHUNKS</b><pre>${top.map(x=>`C${String(x.cx).padStart(2,'0')},${String(x.cy).padStart(2,'0')}  pop ${String(x.agents.length).padStart(4,' ')}  flood ${(x.flood*100).toFixed(0).padStart(3,' ')}%`).join('\n')}</pre></div>`;
}
function renderPanel(){if(tab==='agent')renderAgent();else if(tab==='learning')renderLearning();else if(tab==='programs')renderPrograms();else renderWorldPanel();}
function draw(){drawWorld();renderHud();frames++;}

canvas.addEventListener('pointerdown',e=>{
  const r=canvas.getBoundingClientRect(),sx=e.clientX-r.left,sy=e.clientY-r.top,w=screenToWorld(sx,sy);selectedChunk=world.chunks[chunkIndexFor(w.x,w.y)];
  let best=null,bd=20*20;for(const a of selectedChunk.agents){const p=worldToScreen(a.x,a.y),d=(p.x-sx)**2+(p.y-sy)**2;if(d<bd){bd=d;best=a;}}
  if(best){selected=best;tab='agent';}else{selected=null;tab='world';}
  document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===tab));renderPanel();
});
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;document.querySelectorAll('.tabs button').forEach(x=>x.classList.toggle('on',x===b));renderPanel();});
$('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'▶ RESUME':'⏸ PAUSE';};
$('turbo').onclick=()=>{turbo=turbo===1?4:turbo===4?16:turbo===16?64:1;$('turbo').textContent=`⚡ EVOLVE ×${turbo}`;};
$('rain').onclick=()=>{rain=1;flood=Math.min(1,flood+.14);log('🌊 manual storm/flood pulse injected','info');};
$('popCap').oninput=e=>{popCap=+e.target.value;$('popValue').textContent=popCap;};
$('zero').onclick=()=>{if(confirm('Restart with zero learned programs and new random survival/program genomes?')){localStorage.removeItem('genesis-codehood-v3');location.reload();}};

function serialize(){return {version:3,tick,day,rain,flood,totalMoney,births,deaths,murders,jobs,nextId,popCap,library,artifacts,agents:agents.slice(0,10000),world:{seed:world.seed,sweep:world.sweep,cursor:world.cursor,chunks:world.chunks.map(({agents:_,...c})=>c)}};}
function save(){try{localStorage.setItem('genesis-codehood-v3',JSON.stringify(serialize()));log('💾 civilization saved locally','good');}catch(err){log(`save failed: ${err.message}`,'bad');}}
function load(){
  try{const raw=localStorage.getItem('genesis-codehood-v3');if(!raw)return false;const s=JSON.parse(raw);if(s.version!==3)return false;
    tick=s.tick||0;day=s.day||0;rain=s.rain||0;flood=s.flood||0;totalMoney=s.totalMoney||0;births=s.births||0;deaths=s.deaths||0;murders=s.murders||0;jobs=s.jobs||0;nextId=s.nextId||1;popCap=s.popCap||popCap;library=s.library||{};artifacts=s.artifacts||[];agents=s.agents||[];
    world=createWorld(s.world?.seed||0xBADC0DE);world.sweep=s.world?.sweep||0;world.cursor=s.world?.cursor||0;if(s.world?.chunks)for(let i=0;i<Math.min(world.chunks.length,s.world.chunks.length);i++)Object.assign(world.chunks[i],s.world.chunks[i],{agents:[]});
    $('popCap').value=popCap;$('popValue').textContent=popCap;rebuildOccupancy(world,agents);log('💾 loaded saved zero-seed civilization','good');return true;
  }catch(err){console.warn(err);return false;}
}
$('save').onclick=save;
$('export').onclick=()=>{const blob=new Blob([JSON.stringify(serialize(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`genesis-codehood-v3-${Date.now()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};

async function nextFrame(){await new Promise(requestAnimationFrame);}
function bootSet(p,label,detail){$('bootBar').style.width=`${p}%`;$('bootPercent').textContent=`${p}%`;$('bootLabel').textContent=label;$('bootDetail').textContent=detail;}
async function boot(){
  bootSet(4,'WORLD GRID','allocating 1200×800 logical world');await nextFrame();
  world=createWorld(0xBADC0DE);bootSet(18,'CHUNK INDEX',`${CHUNK_COUNT} chunks (${CHUNK_COLS}×${CHUNK_ROWS}) created`);await nextFrame();
  library=emptyLibrary();artifacts=[];bootSet(28,'ZERO-SEED CURRICULUM','0 solved programs loaded; level-1 tests armed');await nextFrame();
  const loopGuard=runProgram([{op:'PUSH_1',arg:0},{op:'JMP',arg:-1}],{},{maxInstructions:12,maxStack:32,registerCount:4,maxAbsValue:1e9});
  if(loopGuard.error!=='instruction-budget')throw new Error('VM guardrail self-test failed');
  bootSet(36,'VM GUARDRAILS','instruction-budget trap verified');await nextFrame();
  if(!load()){
    const startPop=Math.min(popCap,3600),batch=180;
    for(let i=0;i<startPop;i++){spawn();if(i%batch===0){bootSet(36+Math.floor(48*i/startPop),'SPAWNING GENOMES',`${i.toLocaleString()} / ${startPop.toLocaleString()} agents`);await nextFrame();}}
    rebuildOccupancy(world,agents);
  }
  bootSet(90,'CHUNK OCCUPANCY',`${agents.length.toLocaleString()} agents indexed into ${CHUNK_COUNT} chunks`);await nextFrame();
  bootSet(96,'SURVIVAL PRESSURE','food, jobs, shelter, flood, danger and reproduction online');await nextFrame();
  bootSet(100,'GENESIS ONLINE','tap an agent or chunk to inspect what evolves');await nextFrame();
  $('boot').classList.add('done');setTimeout(()=>$('boot').remove(),300);started=true;renderPanel();
  log('✓ ZERO-SEED mode: no programming solutions were preloaded','good');
  log(`✓ ${agents.length.toLocaleString()} evolving agents across ${CHUNK_COUNT} scheduled chunks`,'good');
}

function loop(now){
  if(started&&!paused){const start=performance.now();for(let i=0;i<turbo;i++){simBatch();if(performance.now()-start>11.5)break;}}
  draw();
  if(now-lastStat>1000){const dt=(now-lastStat)/1000;fps=frames/dt;bps=batchesThisSec/dt;sps=sweepsThisSec/dt;frames=0;batchesThisSec=0;sweepsThisSec=0;lastStat=now;$('fps').textContent=fps.toFixed(0);$('bps').textContent=bps.toFixed(0);$('sps').textContent=sps.toFixed(1);renderPanel();}
  requestAnimationFrame(loop);
}

$('popValue').textContent=popCap;
boot().catch(err=>{bootSet(100,'BOOT FAILED',err.message);console.error(err);});
requestAnimationFrame(loop);
