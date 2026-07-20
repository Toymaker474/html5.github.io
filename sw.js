const CACHE = 'fracture-wilds-root-v6';
const CORE = ['./','./index.html','./manifest.webmanifest?v=6','./fracture-wilds/','./fracture-wilds/index.html','./fracture-wilds/style.css?v=6','./fracture-wilds/debug.js?v=6','./fracture-wilds/game.js?v=6','./fracture-wilds/sim.js?v=6','./fracture-wilds/sw.js?v=6'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => Promise.allSettled(CORE.map(url => cache.add(new Request(url, { cache: 'reload' }))))).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  const networkFirst = event.request.mode === 'navigate' || ['script','style','worker'].includes(event.request.destination);
  event.respondWith(networkFirst
    ? fetch(event.request, { cache: 'no-store' }).then(response => {
        if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
        return response;
      }).catch(() => caches.match(event.request).then(hit => hit || caches.match('./fracture-wilds/index.html')))
    : caches.match(event.request).then(hit => hit || fetch(event.request)));
});
