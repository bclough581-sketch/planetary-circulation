// Precache the app and nothing else. v51 eagerly downloaded 1.95 MB at install, most of it
// the d9 theme art and a 376 KB icon, before a phone could show a single stock. Everything
// else is still cached the first time it is opened, by the fetch handler below, so the other
// pages keep working offline once visited. Bumping SHELL drops the old oversized cache.
const SHELL='pc-shell-v53', FILES=['./','index.html','amalgam-daily.html','manifest.webmanifest','apple-touch-icon.png','icon-192.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(SHELL).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==SHELL).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url); if(e.request.method!=='GET'||u.origin!==location.origin) return;
  // network first for everything, so new versions show up on the next open; cache is only the offline fallback
  e.respondWith(fetch(e.request,{cache:'no-cache'}).then(r=>{if(r.ok){const c=r.clone();caches.open(SHELL).then(x=>x.put(e.request,c));}return r;}).catch(async()=>{const cached=await caches.match(e.request);if(!cached)return Response.error();const headers=new Headers(cached.headers);headers.set('X-Amalgam-Offline-Fallback','1');return new Response(cached.body,{status:cached.status,statusText:cached.statusText,headers});}));
});
