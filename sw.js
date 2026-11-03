const SHELL='pc-shell-v28', FILES=['./','index.html','land.json','manifest.webmanifest','icon-192.png','icon-512.png','gates.js','check.js','game.html','privacy.html'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(SHELL).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==SHELL).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url); if(e.request.method!=='GET'||u.origin!==location.origin) return;
  // network first for everything, so new versions show up on the next open; cache is only the offline fallback
  e.respondWith(fetch(e.request,{cache:'no-cache'}).then(r=>{if(r.ok){const c=r.clone();caches.open(SHELL).then(x=>x.put(e.request,c));}return r;}).catch(()=>caches.match(e.request)));
});
