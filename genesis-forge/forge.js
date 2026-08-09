const $=id=>document.getElementById(id);
const world=$('world'),nodesEl=$('nodes'),wires=$('wires'),viewport=$('viewport');
let graph={nodes:[],edges:[],version:1};
let selected=null,connectFrom=null,pan={x:220,y:120},zoom=1,drag=null,panning=null,lastTouchDistance=0;
const TYPES={
 idea:['✦','Idea / Goal','What should exist and why.'],spec:['▦','Specification','Acceptance criteria and constraints.'],science:['⚛','Science Model','Equations, assumptions, validity range.'],rust:['🦀','Rust Module','Deterministic simulation/runtime implementation.'],wgsl:['⚡','WGSL / GPU','WebGPU compute or rendering kernel.'],test:['✓','Test Gate','Unit, invariant and regression checks.'],benchmark:['◴','Benchmark','Performance and memory acceptance.'],visual:['◉','Visual QA','Screenshots, rendering and UX verification.'],device:['⌁','Device QA','Browser/device compatibility and stress.'],debug:['⚠','Debugger','Capture, reproduce and isolate failures.'],repair:['⟲','Repair Gate','Candidate repair, retest and rollback.'],release:['◆','Release','Verified publishable artifact.']
};
const clone=o=>JSON.parse(JSON.stringify(o));
function uid(){return Math.random().toString(36).slice(2,9)}
function addNode(type,x=500+Math.random()*250,y=400+Math.random()*200,patch={}){const t=TYPES[type]||TYPES.idea;const n={id:uid(),type,title:t[1],purpose:t[2],acceptance:'',evidence:'',status:'planned',x,y,...patch};graph.nodes.push(n);render();selectNode(n.id);saveLocal();return n}
function addEdge(a,b){if(!a||!b||a===b||graph.edges.some(e=>e.a===a&&e.b===b))return;graph.edges.push({id:uid(),a,b});connectFrom=null;render();saveLocal()}
function nodeBy(id){return graph.nodes.find(n=>n.id===id)}
function portCenter(id,kind){const el=document.querySelector(`.node[data-id="${id}"] .port.${kind}`);if(!el)return{x:0,y:0};const r=el.getBoundingClientRect(),wr=world.getBoundingClientRect();return{x:(r.left+r.width/2-wr.left)/zoom,y:(r.top+r.height/2-wr.top)/zoom}}
function path(a,b){const dx=Math.max(70,Math.abs(b.x-a.x)*.48);return`M ${a.x} ${a.y} C ${a.x+dx} ${a.y}, ${b.x-dx} ${b.y}, ${b.x} ${b.y}`}
function drawWires(){wires.innerHTML='';for(const e of graph.edges){const a=portCenter(e.a,'out'),b=portCenter(e.b,'in');const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',path(a,b));p.setAttribute('class','wire');wires.appendChild(p)}}
function render(){nodesEl.innerHTML='';for(const n of graph.nodes){const t=TYPES[n.type]||TYPES.idea;const el=document.createElement('div');el.className='node'+(selected===n.id?' selected':'');el.dataset.id=n.id;el.style.left=n.x+'px';el.style.top=n.y+'px';el.innerHTML=`<div class="nodeHead"><div><div class="nodeTitle">${t[0]} ${esc(n.title)}</div><div class="nodeType">${esc(n.type)}</div></div><span class="status ${n.status}">${n.status}</span></div><div class="nodeBody">${esc(n.purpose||'No purpose yet.')}</div><div class="ports"><div class="portWrap"><span class="port in"></span>IN</div><div class="portWrap">OUT<span class="port out"></span></div></div>`;nodesEl.appendChild(el)}
 requestAnimationFrame(drawWires);applyTransform();refreshInspector()}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function applyTransform(){world.style.transform=`translate(${pan.x}px,${pan.y}px) scale(${zoom})`; $('zoomLabel').textContent=Math.round(zoom*100)+'%'}
function selectNode(id){selected=id;render()}
function refreshInspector(){const n=nodeBy(selected);$('inspectorEmpty').hidden=!!n;$('inspectorBody').hidden=!n;if(!n)return;$('nodeTitle').value=n.title;$('nodeType').value=n.type;$('nodeStatus').value=n.status;$('nodePurpose').value=n.purpose;$('nodeAcceptance').value=n.acceptance;$('nodeEvidence').value=n.evidence}
function syncInspector(){const n=nodeBy(selected);if(!n)return;n.title=$('nodeTitle').value;n.status=$('nodeStatus').value;n.purpose=$('nodePurpose').value;n.acceptance=$('nodeAcceptance').value;n.evidence=$('nodeEvidence').value;render();saveLocal()}
['nodeTitle','nodeStatus','nodePurpose','nodeAcceptance','nodeEvidence'].forEach(id=>$(id).addEventListener('input',syncInspector));
$('deleteNode').onclick=()=>{if(!selected)return;graph.nodes=graph.nodes.filter(n=>n.id!==selected);graph.edges=graph.edges.filter(e=>e.a!==selected&&e.b!==selected);selected=null;render();saveLocal()};
$('duplicateNode').onclick=()=>{const n=nodeBy(selected);if(n)addNode(n.type,n.x+40,n.y+40,{title:n.title+' Copy',purpose:n.purpose,acceptance:n.acceptance,evidence:n.evidence,status:'planned'})};

nodesEl.addEventListener('pointerdown',e=>{const node=e.target.closest('.node');if(!node)return;const id=node.dataset.id;if(e.target.classList.contains('port')){e.stopPropagation();if(e.target.classList.contains('out')){connectFrom=id;e.target.classList.add('active')}else if(connectFrom){addEdge(connectFrom,id)}return}selectNode(id);if(e.target.closest('.nodeHead')){const n=nodeBy(id);drag={id,startX:e.clientX,startY:e.clientY,x:n.x,y:n.y};node.setPointerCapture?.(e.pointerId);e.preventDefault()}});
addEventListener('pointermove',e=>{if(drag){const n=nodeBy(drag.id);n.x=drag.x+(e.clientX-drag.startX)/zoom;n.y=drag.y+(e.clientY-drag.startY)/zoom;render();return}if(panning){pan.x=panning.x+(e.clientX-panning.sx);pan.y=panning.y+(e.clientY-panning.sy);applyTransform();drawWires()}});
addEventListener('pointerup',()=>{if(drag)saveLocal();drag=null;panning=null});
viewport.addEventListener('pointerdown',e=>{if(e.target!==viewport&&e.target!==world&&e.target!==nodesEl)return;panning={sx:e.clientX,sy:e.clientY,x:pan.x,y:pan.y};selected=null;refreshInspector()});
viewport.addEventListener('wheel',e=>{e.preventDefault();const old=zoom;zoom=Math.min(1.8,Math.max(.35,zoom*(e.deltaY<0?1.1:.9)));const r=viewport.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;pan.x=mx-(mx-pan.x)*(zoom/old);pan.y=my-(my-pan.y)*(zoom/old);applyTransform();drawWires()},{passive:false});

function setZoom(z){zoom=Math.min(1.8,Math.max(.35,z));applyTransform();drawWires()}
$('zoomIn').onclick=()=>setZoom(zoom*1.15);$('zoomOut').onclick=()=>setZoom(zoom/1.15);
$('fitGraph').onclick=()=>{if(!graph.nodes.length)return;const xs=graph.nodes.map(n=>n.x),ys=graph.nodes.map(n=>n.y);const minX=Math.min(...xs),maxX=Math.max(...xs)+220,minY=Math.min(...ys),maxY=Math.max(...ys)+140;const w=maxX-minX,h=maxY-minY;zoom=Math.max(.35,Math.min(1.2,(innerWidth-380)/Math.max(w,1),(innerHeight-180)/Math.max(h,1)));pan.x=innerWidth/2-(minX+maxX)/2*zoom;pan.y=innerHeight/2-(minY+maxY)/2*zoom;applyTransform();drawWires()};

document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>addNode(b.dataset.add,700-pan.x/zoom,350-pan.y/zoom));
const PRESETS={
 feature:[['idea','Feature Goal'],['spec','Acceptance Contract'],['science','Science Model'],['rust','Rust Implementation'],['test','Invariant Tests'],['benchmark','Performance Gate'],['visual','Visual QA'],['release','Verified Feature']],
 science:[['science','Model + Units'],['test','Reference Cases'],['test','Conservation Gate'],['benchmark','Numerical Stability'],['release','Validated Model']],
 debug:[['debug','Crash Capture'],['debug','Deterministic Replay'],['test','Subsystem Isolation'],['repair','Candidate Repair'],['test','Regression Suite'],['release','Verified Fix']],
 release:[['spec','Release Contract'],['test','Rust/WASM Tests'],['test','Science Gates'],['benchmark','Performance Gate'],['visual','Visual QA'],['device','iPhone / Browser QA'],['release','Publish']]
};
function loadPreset(name){const p=PRESETS[name];if(!p)return;const baseX=420,baseY=250,gapX=280;let prev=null;p.forEach((entry,i)=>{const n=addNode(entry[0],baseX+i*gapX,baseY+(i%2)*150,{title:entry[1]});if(prev)addEdge(prev.id,n.id);prev=n});$('fitGraph').click()}
document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>loadPreset(b.dataset.preset));

function auditGraph(){const issues=[];const incoming=new Map(graph.nodes.map(n=>[n.id,0])),outgoing=new Map(graph.nodes.map(n=>[n.id,0]));for(const e of graph.edges){if(!nodeBy(e.a)||!nodeBy(e.b)){issues.push(`BROKEN EDGE ${e.id}`);continue}outgoing.set(e.a,(outgoing.get(e.a)||0)+1);incoming.set(e.b,(incoming.get(e.b)||0)+1)}for(const n of graph.nodes){if(!n.purpose.trim())issues.push(`${n.title}: missing purpose`);if(['test','benchmark','release','science'].includes(n.type)&&!n.acceptance.trim())issues.push(`${n.title}: missing acceptance criteria`);if(n.status==='passed'&&!n.evidence.trim())issues.push(`${n.title}: PASS has no evidence`)}const releases=graph.nodes.filter(n=>n.type==='release');for(const r of releases)if((incoming.get(r.id)||0)===0)issues.push(`${r.title}: release has no upstream gate`);const cycles=findCycles();if(cycles.length)issues.push(`Cycle detected: ${cycles.join(' → ')}`);const result=issues.length?`FAIL / ${issues.length} issue(s)\n\n• ${issues.join('\n• ')}`:`PASS\n\n${graph.nodes.length} nodes\n${graph.edges.length} connections\nNo broken graph invariants detected.`;$('audit').textContent=result;return{ok:!issues.length,issues}}
function findCycles(){const state=new Map(),stack=[];let found=[];function visit(id){if(state.get(id)===1){const i=stack.indexOf(id);found=stack.slice(i).concat(id);return true}if(state.get(id)===2)return false;state.set(id,1);stack.push(id);for(const e of graph.edges.filter(e=>e.a===id))if(visit(e.b))return true;stack.pop();state.set(id,2);return false}for(const n of graph.nodes)if(visit(n.id))break;return found.map(id=>nodeBy(id)?.title||id)}
$('runAudit').onclick=auditGraph;

function makePacket(){const audit=auditGraph();const payload={kind:'GENESIS_FORGE_WORK_PACKET',version:1,generated:new Date().toISOString(),rules:{runtimeAI:false,paidTools:false,offlineRuntime:true,failClosed:true},audit,graph};const text=`GENESIS FORGE WORK PACKET\n\nUse this node graph as the authoritative implementation plan. Do not claim completion without evidence. Preserve offline runtime and zero required paid tools.\n\n${JSON.stringify(payload,null,2)}`;navigator.clipboard?.writeText(text);download('genesis-forge-work-packet.txt',text,'text/plain');$('audit').textContent=`${audit.ok?'PASS':'ATTENTION'}\nWork packet generated and copied when clipboard permission was available.`}
$('makePacket').onclick=makePacket;
function download(name,data,type='application/json'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
$('exportGraph').onclick=()=>download('genesis-forge-graph.json',JSON.stringify(graph,null,2));
$('importGraph').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const g=JSON.parse(await f.text());if(!Array.isArray(g.nodes)||!Array.isArray(g.edges))throw new Error('Invalid graph');graph=g;selected=null;render();saveLocal();$('fitGraph').click();auditGraph()}catch(err){$('audit').textContent='IMPORT FAILED\n'+err.message}};
function saveLocal(){localStorage.setItem('genesis-forge-v1',JSON.stringify(graph))}
$('saveGraph').onclick=()=>{saveLocal();$('audit').textContent='SAVED LOCALLY'};
$('clearGraph').onclick=()=>{if(!confirm('Clear the visual graph?'))return;graph={nodes:[],edges:[],version:1};selected=null;render();saveLocal()};

const saved=localStorage.getItem('genesis-forge-v1');if(saved){try{graph=JSON.parse(saved)}catch{}}
if(!graph.nodes.length){loadPreset('feature');const first=graph.nodes[0];first.title='GENESIS Next Increment';first.purpose='Define one bounded, testable improvement to the simulation or Forge tooling.';first.acceptance='Clear observable outcome; no regression; evidence required.';saveLocal()}else render();
addEventListener('resize',()=>{applyTransform();drawWires()});