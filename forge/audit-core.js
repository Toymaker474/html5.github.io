(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.GenesisAudit=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const REQUIRED=['index.html','forge/index.html','forge/forge.js','forge/audit-core.js','project/state.json'];
function checkState(state){return[
  {id:'state.schema',label:'Project schema is 1',pass:state?.schema===1,actual:state?.schema},
  {id:'state.project',label:'Project is GENESIS',pass:state?.project==='GENESIS',actual:state?.project},
  {id:'state.phase',label:'Active phase exists',pass:typeof state?.phase==='string'&&state.phase.length>0,actual:state?.phase},
  {id:'state.stable',label:'Stable record exists',pass:!!state?.stable&&typeof state.stable.verified==='boolean',actual:state?.stable?.verified},
  {id:'state.objective',label:'Active objective exists',pass:typeof state?.active_objective==='string'&&state.active_objective.length>0,actual:state?.active_objective},
  {id:'state.next',label:'Next gate exists',pass:typeof state?.next_gate==='string'&&state.next_gate.length>0,actual:state?.next_gate}
];}
function audit(input){const state=input?.state||null;const files=input?.files||{};const checks=[];
 for(const path of REQUIRED)checks.push({id:'file:'+path,label:path+' reachable',pass:files[path]===true,actual:files[path]===true?'present':'missing'});
 checks.push(...checkState(state));
 const pass=checks.every(c=>c.pass===true);
 return {schema:1,kind:'GENESIS_FORGE_FOUNDATION_AUDIT',status:pass?'PASS':'FAIL',checks,summary:{passed:checks.filter(c=>c.pass).length,total:checks.length},project:state?.project||'UNKNOWN',phase:state?.phase||'UNKNOWN',stable_verified:state?.stable?.verified===true,active_objective:state?.active_objective||'UNKNOWN',next_gate:state?.next_gate||'UNKNOWN'};
}
function stableStringify(value){if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return '['+value.map(stableStringify).join(',')+']';return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stableStringify(value[k])).join(',')+'}';}
async function sha256(text){if(typeof crypto!=='undefined'&&crypto.subtle){const bytes=new TextEncoder().encode(text);const digest=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');}
 if(typeof require==='function'){const c=require('node:crypto');return c.createHash('sha256').update(text).digest('hex');}
 throw new Error('SHA-256 unavailable');}
async function receipt(result,meta={}){const body={...result,generated_at:new Date().toISOString(),environment:meta.environment||'unknown',source:meta.source||'unknown'};body.evidence_sha256=await sha256(stableStringify(body));return body;}
return {REQUIRED,audit,checkState,stableStringify,sha256,receipt};
});