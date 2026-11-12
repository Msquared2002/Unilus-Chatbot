/* Public-only offline fallback. Never intercept or store private/API requests. */
const BASE=new URL('./',self.location.href);
const PREFIX='unilus-public-shell-'+encodeURIComponent(BASE.pathname)+'-';
const CACHE=PREFIX+'v1';
const ASSETS=['offline.html','assets/unilus-logo.png','assets/pwa-icon.svg','manifest.webmanifest'].map(p=>new URL(p,BASE).href);
const PUBLIC_PAGES=['','website.html','index.html'].map(p=>new URL(p,BASE).pathname);
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);for(const url of ASSETS){const response=await fetch(new Request(url,{credentials:'omit',cache:'reload'}));if(!response.ok||response.type!=='basic'||/private|no-store/i.test(response.headers.get('Cache-Control')||''))throw Error('Approved public asset unavailable');await cache.put(url,response);}})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith(PREFIX)&&name!==CACHE)await caches.delete(name);})()));
self.addEventListener('fetch',event=>{const request=event.request,url=new URL(request.url);if(request.method!=='GET'||url.origin!==BASE.origin||url.search||request.headers.has('Authorization')||request.headers.has('X-Chat-Session')||url.pathname.includes('/api/'))return;
 if(ASSETS.includes(url.href)){event.respondWith((async()=>{const cache=await caches.open(CACHE);return await cache.match(url.href)||fetch(request);})());return;}
 if(request.mode==='navigate'&&PUBLIC_PAGES.includes(url.pathname))event.respondWith(fetch(request).catch(async()=>{const cache=await caches.open(CACHE);return await cache.match(new URL('offline.html',BASE).href)||new Response('Offline. Private Student Mode and AI require connectivity.',{status:503,headers:{'Content-Type':'text/plain'}});}));
});
