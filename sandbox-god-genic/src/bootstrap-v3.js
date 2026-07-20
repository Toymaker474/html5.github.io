import'./upgrade-v3.js?v=3';
await import('./main.js?v=3');
if('serviceWorker'in navigator){
  navigator.serviceWorker.register('./sandbox-god-genic/sw.js?v=3',{updateViaCache:'none'}).catch(()=>{});
}
window.dispatchEvent(new Event('godgenic:booted'));
