(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.GenesisPromotion=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function evaluate(input={}){
 const mainHasExperiment=input.main_has_experiment===true;
 const lab=input.lab_manifest||null;
 const checks=[
  {id:'stable.clean',label:'Stable main has no Lab experiment file',pass:mainHasExperiment===false,actual:mainHasExperiment?'present':'absent'},
  {id:'lab.manifest',label:'Lab candidate manifest exists',pass:!!lab&&lab.kind==='GENESIS_LAB_EXPERIMENT',actual:lab?.kind||'missing'},
  {id:'lab.base',label:'Lab candidate names main as base',pass:lab?.base_branch==='main',actual:lab?.base_branch||'missing'},
  {id:'lab.branch',label:'Lab candidate identifies genesis-lab',pass:lab?.lab_branch==='genesis-lab',actual:lab?.lab_branch||'missing'},
  {id:'lab.status',label:'Lab candidate remains CANDIDATE until promotion',pass:lab?.status==='CANDIDATE',actual:lab?.status||'missing'},
  {id:'lab.acceptance',label:'Lab candidate declares isolation acceptance',pass:lab?.acceptance?.main_must_not_have_lab_experiment===true&&lab?.acceptance?.lab_must_have_manifest===true,actual:!!lab?.acceptance}
 ];
 const pass=checks.every(c=>c.pass===true);
 return {schema:1,kind:'GENESIS_STABLE_LAB_PROMOTION_GATE',status:pass?'PASS':'FAIL',promotion_allowed:pass,stable_contaminated:mainHasExperiment,lab_id:lab?.id||'UNKNOWN',checks,summary:{passed:checks.filter(c=>c.pass).length,total:checks.length}};
}
return {evaluate};
});
