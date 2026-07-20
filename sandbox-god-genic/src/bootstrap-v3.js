import'./upgrade-v3.js?v=3';
import'./ecosystem-v4.js?v=4';
await import('./main.js?v=4');
if('serviceWorker'in navigator){
  navigator.serviceWorker.register('./sandbox-god-genic/sw.js?v=4',{updateViaCache:'none'}).catch(()=>{});
}
window.dispatchEvent(new Event('godgenic:booted'));
