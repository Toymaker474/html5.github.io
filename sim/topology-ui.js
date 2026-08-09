(()=>{
'use strict';
const host=document.createElement('div');
host.id='topologyHud';
host.style.cssText='position:absolute;left:8px;top:54px;padding:6px 8px;border:1px solid rgba(160,130,255,.28);border-radius:10px;background:rgba(10,6,22,.66);font:9px ui-monospace,monospace;color:#d8caff;pointer-events:none;backdrop-filter:blur(8px)';
host.textContent='topology: waiting for first snapshot';
document.querySelector('.stage')?.appendChild(host);
function tick(){const t=globalThis.GenesisMatterLatestTopology;if(t){const sizes=t.componentSizes.slice(0,4).join(',')||'—';host.textContent=`graph edges ${t.edges} · comps ${t.components} · largest ${t.largestComponent} · cycles ${t.cycleRank} · max degree ${t.maxDegree} · sizes ${sizes}`;}requestAnimationFrame(tick)}
requestAnimationFrame(tick);
})();
