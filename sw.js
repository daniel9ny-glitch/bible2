// sw.js — 늘사랑 성경 PWA 서비스워커
// 역할: 찬송가 악보 이미지를 오프라인에서도 보여주기 (cache-first)
// 페이지(bible.html)에서 직접 caches.open('hymn-scores-v1')에 저장하므로,
// 여기서는 저장된 캐시를 우선 제공하는 역할만 한다.

const SW_VERSION = 'v3';
const HYMN_CACHE_NAME = 'hymn-scores-v1';

self.addEventListener('install', function(event){
  // 새 서비스워커를 즉시 활성화
  self.skipWaiting();
});

self.addEventListener('activate', function(event){
  // 즉시 페이지 제어권 가져오기
  event.waitUntil(self.clients.claim());
});

// 찬송가 악보 요청인지 판별 ( .../hymns/001.jpg 형태 )
function isHymnImage(url){
  return /\/hymns\/\d{3}\.jpg(\?.*)?$/i.test(url);
}

self.addEventListener('fetch', function(event){
  const req = event.request;
  if(req.method !== 'GET') return;

  const url = req.url;

  if(isHymnImage(url)){
    // 악보 이미지: 캐시 우선, 없으면 네트워크 → 캐시에 저장
    event.respondWith(
      caches.match(req).then(function(cached){
        if(cached) return cached;
        return fetch(req).then(function(resp){
          if(resp && resp.ok){
            const copy = resp.clone();
            caches.open(HYMN_CACHE_NAME).then(function(c){ c.put(req, copy); });
          }
          return resp;
        }).catch(function(){
          // 오프라인이고 캐시에도 없으면 그냥 실패 (이미지 onerror 처리됨)
          return new Response('', {status: 504, statusText: 'offline'});
        });
      })
    );
    return;
  }
  // 그 외 요청은 기본 동작 (네트워크)
});

// 페이지에서 보낼 수 있는 메시지 처리 (이전 버전 호환용)
self.addEventListener('message', function(event){
  const data = event.data || {};
  if(data.type === 'SKIP_WAITING'){
    self.skipWaiting();
  }
});
