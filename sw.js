const CACHE='lapeace-pricing-v6';
const FALLBACK_ASSETS=['./styles.css?v=6','./manifest.webmanifest?v=6'];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(FALLBACK_ASSETS))
      .catch(()=>{})
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

async function networkFirst(request){
  try{
    const response=await fetch(request,{cache:'no-store'});
    if(response?.ok){
      const cache=await caches.open(CACHE);
      cache.put(request,response.clone()).catch(()=>{});
    }
    return response;
  }catch(error){
    const cached=await caches.match(request);
    if(cached)return cached;
    throw error;
  }
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;

  // Kod aplikacji i dokument zawsze próbujemy pobrać z sieci jako pierwszy.
  // Dzięki temu zwykłe F5 nie uruchamia starej wersji JS z cache.
  if(request.mode==='navigate'||['document','script','style'].includes(request.destination)){
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(caches.match(request).then(cached=>cached||networkFirst(request)));
});
