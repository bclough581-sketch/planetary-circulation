const SHELL='pc-shell-v37', FILES=['./','index.html','ring-engine-lab.html','amalgam-theme.css','ring-evidence.js','delta-context.js','delta-company-evidence.js','product-data/delta-company-evidence.json','galaxy-ring.svg','star-hero.js','intelligence/data/delta-quarterly-curated.json','decision-journal.html','journal-core.js','journal-legacy.js','journal.html','scoreboard.html','scoreboard.json','map.html','land.json','manifest.webmanifest','icon-192.png','icon-512.png','gates.js','check.js','game.html','privacy.html'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(SHELL).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==SHELL).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url); if(e.request.method!=='GET'||u.origin!==location.origin) return;
  // network first for everything, so new versions show up on the next open; cache is only the offline fallback
  e.respondWith(fetch(e.request,{cache:'no-cache'}).then(r=>{if(r.ok){const c=r.clone();caches.open(SHELL).then(x=>x.put(e.request,c));}return r;}).catch(async()=>{const cached=await caches.match(e.request);if(!cached)return Response.error();const headers=new Headers(cached.headers);headers.set('X-Amalgam-Offline-Fallback','1');return new Response(cached.body,{status:cached.status,statusText:cached.statusText,headers});}));
});
