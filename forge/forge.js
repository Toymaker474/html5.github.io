const q=id=>document.getElementById(id);
let lastReceipt=null;
const REQUIRED=GenesisAudit.REQUIRED;
function set(id,state,detail=''){const el=q(id);el.textContent=detail?`${state} · ${detail}`:state;el.className='status '+(state==='PASS'?'pass':state==='FAIL'?'fail':'unknown')}
async function reachable(path){try{const r=await fetch('../'+path+'?audit='+Date.now(),{cache:'no-store'});return r.ok}catch{return false}}
async function runAudit(){
 q('run').disabled=true;q('run').textContent='Running…';set('s1','RUNNING');set('s2','WAITING');set('s3','WAITING');set('s4','WAITING');
 const files={};for(const path of REQUIRED)files[path]=await reachable(path);
 let state=null;try{const r=await fetch('../project/state.json?audit='+Date.now(),{cache:'no-store'});if(r.ok)state=await r.json()}catch{}
 const result=GenesisAudit.audit({state,files});
 set('s1',files['project/state.json']?'PASS':'FAIL');
 set('s2',result.status,`${result.summary.passed}/${result.summary.total}`);
 try{
  lastReceipt=await GenesisAudit.receipt(result,{environment:navigator.userAgent,source:location.href});
  localStorage.setItem('genesis-forge:last-foundation-receipt',JSON.stringify(lastReceipt));
  set('s3',result.status,lastReceipt.evidence_sha256.slice(0,12));
 }catch(err){lastReceipt={...result,receipt_error:String(err)};set('s3','FAIL','receipt hash unavailable')}
 set('s4',result.status==='PASS'?'READY':'BLOCKED',result.status==='PASS'?'next increment unlocked':'repair foundation first');
 q('report').textContent=JSON.stringify(lastReceipt,null,2);
 q('run').disabled=false;q('run').textContent='Run real foundation audit';
 refreshLast();
}
function refreshLast(){let saved=null;try{saved=JSON.parse(localStorage.getItem('genesis-forge:last-foundation-receipt')||'null')}catch{}
 q('last').textContent=saved?`${saved.status} · ${saved.generated_at}\n${saved.evidence_sha256||'no hash'}\n${saved.summary?.passed||0}/${saved.summary?.total||0} checks`:'No local receipt yet.';
}
q('run').onclick=runAudit;
q('copy').onclick=async()=>{if(!lastReceipt)await runAudit();const text=JSON.stringify(lastReceipt,null,2);try{await navigator.clipboard.writeText(text);q('copy').textContent='Copied receipt';setTimeout(()=>q('copy').textContent='Copy evidence receipt',1200)}catch{q('report').textContent=text+'\n\nClipboard unavailable; select text manually.'}};
q('clear').onclick=()=>{localStorage.removeItem('genesis-forge:last-foundation-receipt');lastReceipt=null;q('report').textContent='Receipt cleared. Run the audit again.';refreshLast()};
refreshLast();