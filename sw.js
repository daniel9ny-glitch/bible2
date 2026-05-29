// 대조성경 PWA Service Worker
const CACHE = 'daejobible-v1';
const ASSETS = ['/bible2/bible.html'];

self.addEventListener('install', function(e){
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function(c){ return c.addAll(ASSETS); }).catch(function(){})
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function(e){
  // 네트워크 우선, 실패 시 캐시
  e.respondWith(
    fetch(e.request).then(function(res){
      // 성공하면 캐시에 저장
      const copy = res.clone();
      caches.open(CACHE).then(function(c){ c.put(e.request, copy); }).catch(function(){});
      return res;
    }).catch(function(){
      return caches.match(e.request).then(function(r){
        return r || caches.match('/bible2/bible.html');
      });
    })
  );
});
