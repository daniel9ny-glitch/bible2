// 대조성경 + 찬송가 PWA Service Worker
const CACHE = 'daejobible-v2';
const HYMN_CACHE = 'daejobible-hymns-v1';
const BASE = '/bible2/';
const CORE = [BASE + 'bible.html'];
const HYMN_COUNT = 645;

// 찬송가 이미지 전체 경로 목록
function hymnUrls(){
  const arr = [];
  for(let i=1; i<=HYMN_COUNT; i++){
    arr.push(BASE + 'hymns/' + String(i).padStart(3,'0') + '.jpg');
  }
  return arr;
}

self.addEventListener('install', function(e){
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function(c){ return c.addAll(CORE); }).catch(function(){})
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      // 오래된 코어 캐시만 정리 (찬송가 캐시는 유지)
      return Promise.all(keys.map(function(k){
        if(k !== CACHE && k !== HYMN_CACHE) return caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

// 앱에서 "찬송가 전체 다운로드" 요청을 받으면 백그라운드로 캐싱
self.addEventListener('message', function(e){
  if(e.data && e.data.type === 'CACHE_HYMNS'){
    e.waitUntil(cacheAllHymns());
  }
});

async function cacheAllHymns(){
  const cache = await caches.open(HYMN_CACHE);
  const urls = hymnUrls();
  let done = 0, failed = 0;
  // 8개씩 묶어 순차 처리 (휴대폰 부담 완화)
  const BATCH = 8;
  for(let i=0; i<urls.length; i+=BATCH){
    const slice = urls.slice(i, i+BATCH);
    await Promise.all(slice.map(async function(u){
      try{
        const existing = await cache.match(u);
        if(existing){ done++; return; }
        const res = await fetch(u, {cache:'reload'});
        if(res && res.ok){ await cache.put(u, res.clone()); done++; }
        else { failed++; }
      }catch(err){ failed++; }
    }));
    // 진행상황 보고
    const clients = await self.clients.matchAll();
    clients.forEach(function(c){
      c.postMessage({type:'HYMN_PROGRESS', done:done, failed:failed, total:urls.length});
    });
  }
  const clients = await self.clients.matchAll();
  clients.forEach(function(c){
    c.postMessage({type:'HYMN_DONE', done:done, failed:failed, total:urls.length});
  });
}

self.addEventListener('fetch', function(e){
  const url = e.request.url;

  // 찬송가 악보 이미지: 캐시 우선 (오프라인에서도 즉시 표시)
  if(url.indexOf('/hymns/') !== -1 && url.endsWith('.jpg')){
    e.respondWith(
      caches.match(e.request).then(function(cached){
        if(cached) return cached;
        return fetch(e.request).then(function(res){
          if(res && res.ok){
            const copy = res.clone();
            caches.open(HYMN_CACHE).then(function(c){ c.put(e.request, copy); }).catch(function(){});
          }
          return res;
        });
      })
    );
    return;
  }

  // 그 외(앱 본체 등): 네트워크 우선, 실패 시 캐시
  e.respondWith(
    fetch(e.request).then(function(res){
      const copy = res.clone();
      caches.open(CACHE).then(function(c){ c.put(e.request, copy); }).catch(function(){});
      return res;
    }).catch(function(){
      return caches.match(e.request).then(function(r){
        return r || caches.match(BASE + 'bible.html');
      });
    })
  );
});
