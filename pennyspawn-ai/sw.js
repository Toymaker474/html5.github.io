const TARGET=new URL('../?v=god-genic-1',self.registration.scope).href;
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.map(key=>caches.delete(key)));await self.clients.claim();const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});await Promise.all(clients.map(client=>client.navigate(TARGET).catch(()=>{})));await self.registration.unregister()})()));
self.addEventListener('fetch',event=>{if(event.request.mode==='navigate')event.respondWith(Promise.resolve(Response.redirect(TARGET,302)))});
