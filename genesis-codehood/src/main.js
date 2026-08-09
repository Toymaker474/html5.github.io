import { disassemble, runProgram } from './vm.js';
import { TASKS, evaluateProgram, VERIFY_CASES } from './tasks.js';
import { ROLES, createAgent, critiqueAgent, scoreCandidate, seededLibrary } from './evolution.js';

const $ = (id) => document.getElementById(id);
const canvas = $('world');
const ctx = canvas.getContext('2d', { alpha:false });
const panel = $('panel');
const hud = $('hud');
const terminal = $('terminal');
let W=1000,H=700,DPR=1;
let paused=false,turbo=1,tick=0,day=0,rain=0,flood=0;
let totalMoney=0,births=0,deaths=0,murders=0,jobs=0;
let nextId=1,agents=[],selected=null,tab='agent';
let library=seededLibrary();
let artifacts=[];
let logLines=[];
let frames=0,simTicks=0,lastStat=performance.now();
let blocks=[];

function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function log(msg,type='info'){logLines.unshift({msg,type});if(logLines.length>24)logLines.length=24;}
function resize(){const r=canvas.getBoundingClientRect();DPR=Math.min(2,devicePixelRatio||1);canvas.width=Math.max(1,(r.width*DPR)|0);canvas.height=Math.max(1,(r.height*DPR)|0);W=r.width;H=r.height;ctx.setTransform(DPR,0,0,DPR,0,0);buildBlocks();}
function buildBlocks(){blocks=[];for(let y=24;y<H-36;y+=78)for(let x=26;x<W-30;x+=78){if((((x/78)|0)+((y/78)|0))%4!==0)blocks.push({x,y,w:48,h:36});}}
addEventListener('resize',resize);resize();

function spawn(parent=null){const a=createAgent(nextId++,Math.random,parent,library);a.x*=W;a.y*=H;a.tx*=W;a.ty*=H;agents.push(a);births++;return a;}
function setPopulation(n){while(agents.length<n)spawn();if(agents.length>n)agents.length=n;}
setPopulation(+$('pop').value);

for(const [task,item] of Object.entries(library)) artifacts.push({name:`seed_${task.toLowerCase()}.vm`,task,program:item.program,author:item.author,tick:0,verified:item.report.verified});

function waterAt(x,y){const shore=H*.76-Math.sin(x*.017+tick*.0009)*16;return y>shore-flood*H*.30;}
function nearby(a,r=17){let best=null,bd=r*r;for(let i=0;i<12;i++){const b=agents[(Math.random()*agents.length)|0];if(!b||b===a||!b.alive)continue;const d=(b.x-a.x)**2+(b.y-a.y)**2;if(d<bd){bd=d;best=b;}}return best;}

function doWork(a){
  const out=scoreCandidate(a,library,Math.random);jobs++;totalMoney+=out.pay;
  if(out.shipped){
    const stored=library[a.task];stored.tick=tick;
    artifacts.unshift({name:`${a.task.toLowerCase()}_${a.id}_${stored.version}.vm`,task:a.task,program:stored.program,author:a.label,tick,verified:true});
    artifacts.length=Math.min(80,artifacts.length);
    log(`✓ ${a.label} shipped ${a.task} (${stored.program.length} instructions) +${out.pay.toFixed(0)} CR`,'good');
  }
  if(a.role==='CRITIC'||a.role==='TESTER'||a.role==='SECURITY'){
    const target=agents[(Math.random()*agents.length)|0];
    if(target&&target!==a){const failure=critiqueAgent(a,target);if(failure&&Math.random()<.05)log(`⚠ ${a.label} broke ${target.label}'s ${target.task} at (${failure.a},${failure.b})`,'bad');}
  }
}

function stepAgent(a){
  if(!a.alive)return;
  a.age++; const wet=waterAt(a.x,a.y);a.energy-=wet?.040:.010;
  if(wet){a.ty=Math.min(a.ty,H*.44);a.money=Math.max(0,a.money-.01);}
  if(a.age-a.lastJob>40+((Math.random()*80)|0)){doWork(a);a.lastJob=a.age;}
  let dx=a.tx-a.x,dy=a.ty-a.y,d=Math.hypot(dx,dy)||1;a.vx=a.vx*.80+(dx/d)*.20;a.vy=a.vy*.80+(dy/d)*.20;const speed=wet?.30:.74;a.x+=a.vx*speed;a.y+=a.vy*speed;
  if(d<16||Math.random()<.003){a.tx=Math.random()*W;a.ty=Math.random()*H;}
  if(a.risk>1&&a.energy<40&&a.age-a.lastConflict>260&&Math.random()<.002){const b=nearby(a);if(b){a.lastConflict=b.lastConflict=a.age;a.stats.conflicts++;const atk=a.skill+a.energy*.2+Math.random()*25,def=b.skill+b.energy*.2+Math.random()*25;if(atk>def*1.4&&Math.random()<.14){b.alive=false;murders++;deaths++;const stolen=Math.min(35,b.money);a.money+=stolen;b.money-=stolen;log(`⚠ abstract street violence: ${a.label} killed ${b.label}`,'bad');}else{a.energy-=4;b.energy-=6;if(Math.random()<.08)log(`⚠ street conflict ${a.label} / ${b.label}`,'bad');}}}
  if(a.money>420&&a.energy>55&&Math.random()<.0012){a.money-=110;const child=spawn(a);child.x=a.x+Math.random()*10-5;child.y=a.y+Math.random()*10-5;child.tx=Math.random()*W;child.ty=Math.random()*H;}
  if(a.energy<=0||a.age>18000+Math.random()*8000){a.alive=false;deaths++;}
}

function simStep(){tick++;simTicks++;day=tick/3600;if(rain>0){rain=Math.max(0,rain-.00004);flood=Math.min(1,flood+.00005*rain);}else flood=Math.max(0,flood-.000012);if(Math.random()<.000009){rain=.65+Math.random()*.35;log('🌧 storm cell formed; flood risk rising','info');}const n=agents.length;for(let i=0;i<n;i++)stepAgent(agents[i]);if(tick%90===0){agents=agents.filter(a=>a.alive);const target=+$('pop').value;while(agents.length<target)spawn();if(agents.length>Math.max(target*1.15,target+300))agents.length=Math.max(target,target|0);}}

function draw(){
  ctx.fillStyle='#04070a';ctx.fillRect(0,0,W,H);
  for(const b of blocks){ctx.fillStyle='#0d151e';ctx.fillRect(b.x,b.y,b.w,b.h);ctx.strokeStyle='#1f2e3e';ctx.strokeRect(b.x+.5,b.y+.5,b.w-1,b.h-1);}
  ctx.fillStyle=`rgba(45,128,215,${.18+.34*flood})`;for(let x=0;x<W;x+=8){const y=H*.76-Math.sin(x*.017+tick*.0009)*16-flood*H*.30;ctx.fillRect(x,y,8,H-y);}ctx.strokeStyle='#6fc1ff99';ctx.beginPath();for(let x=0;x<=W;x+=8){const y=H*.76-Math.sin(x*.017+tick*.0009)*16-flood*H*.30;x?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();
  ctx.font='10px ui-monospace,monospace';ctx.textAlign='center';ctx.textBaseline='middle';const maxDraw=Math.min(agents.length,3200),stride=Math.max(1,(agents.length/maxDraw)|0);for(let i=0;i<agents.length;i+=stride){const a=agents[i];if(!a.alive)continue;ctx.fillStyle=selected===a?'#fff06a':waterAt(a.x,a.y)?'#8ecbff':a.role==='CRITIC'?'#c79cff':a.role==='SECURITY'?'#ff8c95':'#bad8e8';const glyph=a.role==='BUILDER'?'♟':a.role==='CRITIC'?'♙':a.role==='SECURITY'?'♜':'·';ctx.fillText(glyph,a.x,a.y);}if(selected&&selected.alive){ctx.fillStyle='#fff';ctx.fillText(' O ',selected.x,selected.y-14);ctx.fillText('/|\\',selected.x,selected.y-5);ctx.fillText('/ \\',selected.x,selected.y+4);ctx.strokeStyle='#fff06a';ctx.strokeRect(selected.x-10,selected.y-24,20,34);}
  hud.innerHTML=`<b class="cyan">CODEHOOD // DAY ${day.toFixed(1)}</b><br>POP ${agents.length.toLocaleString()} · JOBS ${jobs.toLocaleString()} · 💰 ${totalMoney.toFixed(0)} CR<br>FLOOD ${(flood*100).toFixed(1)}% · RAIN ${(rain*100).toFixed(0)}% · DEATHS ${deaths} · MURDERS ${murders}<br>VERIFIED SKILLS ${Object.values(library).filter(x=>x.report.verified).length}/${Object.keys(TASKS).length}`;
  terminal.innerHTML=logLines.slice(0,15).map(x=>`<div class="line-${x.type}">${esc(x.msg)}</div>`).join('');frames++;
}

function programConsole(task, program){const report=evaluateProgram(program,task,VERIFY_CASES);return `<div class="card program-console"><b>RUN INSIDE GENESIS VM</b><div style="margin-top:7px">A <input id="runA" type="number" value="7"> B <input id="runB" type="number" value="-3"> <button id="runProgram" class="primary">▶ RUN</button></div><div id="runResult" class="result">${report.verified?'<span class="good">VERIFIED on '+report.total+' deterministic tests</span>':'<span class="hot">NOT VERIFIED</span>'}</div></div>`;}
function renderPanel(){
  if(tab==='agent'){
    const a=selected||agents[0];if(!a){panel.innerHTML='No agents';return;}const report=evaluateProgram(a.program,a.task,VERIFY_CASES);
    panel.innerHTML=`<div class="card"><div class="row"><b>${a.label}</b><span class="cyan">${a.role}</span></div><pre> O_o\n/|_|\n/ \\</pre></div><div class="card"><div class="row"><span class="k">generation</span><span>${a.generation}</span></div><div class="row"><span class="k">money</span><span class="gold">${a.money.toFixed(1)} CR</span></div><div class="row"><span class="k">energy</span><span>${a.energy.toFixed(1)}</span></div><div class="row"><span class="k">skill</span><span>${a.skill.toFixed(1)}%</span></div><div class="bar good"><i style="width:${a.skill}%"></i></div></div><div class="card"><b>${a.task} GENOME</b><pre>${esc(disassemble(a.program))}</pre><div class="row"><span class="k">verification</span><span class="${report.verified?'good':'hot'}">${report.passed}/${report.total}</span></div></div>${programConsole(a.task,a.program)}`;
    bindRunner(a.task,a.program);
  } else if(tab==='skills'){
    panel.innerHTML=`<div class="card"><b>CIVILIZATION KNOWLEDGE</b><br><span class="k">Stored programs are executable, not text descriptions.</span></div>`+Object.values(library).map(s=>`<div class="card"><div class="row"><b>${s.task}</b><span class="good">VERIFIED</span></div><pre>${esc(disassemble(s.program))}</pre><div class="row"><span class="k">author</span><span>${s.author}</span></div><div class="row"><span class="k">avg steps</span><span>${s.report.avgSteps.toFixed(1)}</span></div><button data-run-skill="${s.task}">▶ RUN</button></div>`).join('');panel.querySelectorAll('[data-run-skill]').forEach(b=>b.onclick=()=>{const s=library[b.dataset.runSkill];const r=runProgram(s.program,{a:7,b:-3});log(`LAB ${s.task}(7,-3) => ${r.value} in ${r.steps} steps`,'good');});
  } else if(tab==='artifacts'){
    const x=artifacts[0]||Object.values(library)[0];panel.innerHTML=`<div class="card"><b>REAL PROGRAM ARTIFACTS</b><br><span class="k">Every file shown here can be executed by this page's sandbox VM.</span></div>`+artifacts.slice(0,18).map(a=>`<div class="card"><div class="row"><b>${a.name}</b><span class="${a.verified?'good':'hot'}">${a.verified?'VERIFIED':'EXPERIMENTAL'}</span></div><pre>${esc(disassemble(a.program))}</pre><span class="k">by ${a.author}</span><br><button data-artifact="${a.name}">▶ EXECUTE</button></div>`).join('')+(x?programConsole(x.task,x.program):'');if(x)bindRunner(x.task,x.program);panel.querySelectorAll('[data-artifact]').forEach(b=>b.onclick=()=>{const a=artifacts.find(x=>x.name===b.dataset.artifact);if(a){const r=runProgram(a.program,{a:7,b:-3});log(`ARTIFACT ${a.name} => ${r.ok?r.value:r.error}` ,r.ok?'good':'bad');}});
  } else {
    panel.innerHTML=`<div class="card"><b>CITY STATE</b><div class="row"><span class="k">population</span><span>${agents.length}</span></div><div class="row"><span class="k">births</span><span>${births}</span></div><div class="row"><span class="k">deaths</span><span>${deaths}</span></div><div class="row"><span class="k">murders</span><span class="hot">${murders}</span></div><div class="row"><span class="k">flood</span><span class="cyan">${(flood*100).toFixed(1)}%</span></div></div><div class="card"><b>ROLES</b><pre>${ROLES.map(r=>r.padEnd(10)+' '+agents.filter(a=>a.role===r).length).join('\n')}</pre></div><div class="card"><b>RULES</b><pre>Floods slow movement and drain energy.\nPrograms earn credits only by executing and passing tests.\nCritics get paid for exposing failing programs.\nStreet violence is abstract/non-graphic and can kill simulated agents.\nNo eval(), Function(), arbitrary JavaScript, or native code execution.</pre></div>`;
  }
}
function bindRunner(task,program){const btn=$('runProgram');if(!btn)return;btn.onclick=()=>{const a=Number($('runA').value),b=Number($('runB').value),r=runProgram(program,{a,b}),expected=TASKS[task].fn(a,b);$('runResult').innerHTML=`result <b>${esc(r.ok?r.value:r.error)}</b> · expected ${expected} · ${r.steps} steps · <span class="${r.ok&&r.value===expected?'good':'hot'}">${r.ok&&r.value===expected?'PASS':'FAIL'}</span>`;};}

canvas.addEventListener('pointerdown',e=>{const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;let best=null,bd=450;for(const a of agents){const d=(a.x-x)**2+(a.y-y)**2;if(d<bd){bd=d;best=a;}}if(best){selected=best;tab='agent';document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab==='agent'));renderPanel();}});
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;document.querySelectorAll('.tabs button').forEach(x=>x.classList.toggle('on',x===b));renderPanel();});
$('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'▶ RESUME':'⏸ PAUSE';};
$('turbo').onclick=()=>{turbo=turbo===1?4:turbo===4?12:turbo===12?32:1;$('turbo').textContent='⚡ TURBO ×'+turbo;};
$('rain').onclick=()=>{rain=1;flood=Math.min(1,flood+.08);log('🌊 manual flood pulse injected','info');};
$('pop').oninput=e=>{$('popValue').textContent=e.target.value;setPopulation(+e.target.value);};

function serialize(){return {version:2,tick,day,rain,flood,totalMoney,births,deaths,murders,jobs,nextId,library,artifacts,agents:agents.slice(0,3000)};}
function save(){localStorage.setItem('genesis-codehood-v2',JSON.stringify(serialize()));log('💾 civilization saved locally','good');}
function load(){try{const raw=localStorage.getItem('genesis-codehood-v2');if(!raw)return;const s=JSON.parse(raw);({tick=0,day=0,rain=0,flood=0,totalMoney=0,births=0,deaths=0,murders=0,jobs=0,nextId=1}=s);library=s.library||library;artifacts=s.artifacts||artifacts;agents=s.agents||agents;log('💾 previous civilization loaded','good');}catch(err){console.warn(err);}}
$('save').onclick=save;
$('export').onclick=()=>{const blob=new Blob([JSON.stringify(serialize(),null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`genesis-codehood-${Date.now()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};

load();renderPanel();log('✓ GENESIS VM online: generated programs execute inside the app','good');log('✓ seeded verified skills loaded: '+Object.keys(library).join(', '),'good');
function loop(now){if(!paused){const start=performance.now();for(let i=0;i<turbo;i++){simStep();if(performance.now()-start>12)break;}}draw();if(now-lastStat>1000){$('fps').textContent=(frames*1000/(now-lastStat)).toFixed(0);$('tps').textContent=(simTicks*1000/(now-lastStat)).toFixed(0);frames=0;simTicks=0;lastStat=now;renderPanel();}requestAnimationFrame(loop);}requestAnimationFrame(loop);
