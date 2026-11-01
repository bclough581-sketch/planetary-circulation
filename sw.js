const SHELL='pc-shell-v1', FILES=['./','index.html','land.json','manifest.webmanifest','icon-192.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(SHELL).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(self.clients.claim());});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url); if(e.request.method!=='GET'||u.origin!==location.origin) return;
  const fresh=/data\.json$|tic\.json$/.test(u.pathname);   // data: network first, cache only as offline fallback
  e.respondWith(fresh
    ? fetch(e.request).then(r=>{const c=r.clone();caches.open(SHELL).then(x=>x.put(e.request,c));return r;}).catch(()=>caches.match(e.request))
    : caches.match(e.request).then(m=>m||fetch(e.request)));
});
