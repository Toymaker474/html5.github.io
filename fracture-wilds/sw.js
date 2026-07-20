const CACHE='fracture-wilds-v7';
const CORE=['./','./index.html','./style.css?v=6','./science-v7.css?v=7','./debug-v7.js?v=7','./science-game-v7.js?v=7','./science-sim-v7.js?v=7','./manifest.webmanifest?v=7','../icon.svg?v=7'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>Promise.allSettled(CORE.map(url=>cache.add(new Request(url,{cache:'reload'}))))).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);if(url.origin!==location.origin)return;
  const dynamic=event.request.mode==='navigate'||['script','style','worker'].includes(event.request.destination);
  event.respondWith(dynamic?fetch(event.request,{cache:'no-store'}).then(response=>{if(response.ok)caches.open(CACHE).then(cache=>cache.put(event.request,response.clone()));return response}).catch(()=>caches.match(event.request).then(hit=>hit||caches.match('./index.html'))):caches.match(event.request).then(hit=>hit||fetch(event.request).then(response=>{if(response.ok)caches.open(CACHE).then(cache=>cache.put(event.request,response.clone()));return response})));
});
