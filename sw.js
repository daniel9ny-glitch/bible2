/* 늘성경 서비스워커 — WebAPK 설치 조건(작동하는 fetch 핸들러) 충족 + 오프라인 캐싱 */
const APP_CACHE = 'neulbible-app-v3';
const HYMN_CACHE = 'neulbible-hymns-v1';
const APP_SHELL = [
  '/bible2/',
  '/bible2/bible.html'
];

// 설치: 앱 셸 캐시
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
  );
});

// 활성화: 오래된 앱 캐시 정리
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== APP_CACHE && k !== HYMN_CACHE).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// fetch 핸들러 — 크롬 WebAPK 설치 가능 판정에 반드시 필요
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 찬송가 악보 이미지: 캐시 우선
  if (/\/hymns?\//i.test(url.pathname) || /hymn/i.test(url.pathname)) {
    event.respondWith(
      caches.open(HYMN_CACHE).then((cache) =>
        cache.match(req).then((hit) =>
          hit || fetch(req).then((res) => { try { cache.put(req, res.clone()); } catch (e) {} return res; })
              .catch(() => hit)
        )
      )
    );
    return;
  }

  // 그 외(앱 셸 등): 네트워크 우선, 실패 시 캐시
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(APP_CACHE).then((cache) => { try { cache.put(req, copy); } catch (e) {} });
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('/bible2/bible.html')))
  );
});

// 찬송가 전체 오프라인 저장 요청 처리
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'CACHE_HYMNS') {
    event.waitUntil(cacheAllHymns(data.urls || []));
  }
});

async function cacheAllHymns(urls) {
  const cache = await caches.open(HYMN_CACHE);
  const total = urls.length || 645;
  let done = 0;
  for (const u of urls) {
    try {
      const res = await fetch(u, { mode: 'no-cors' });
      await cache.put(u, res);
    } catch (e) {}
    done++;
    if (done % 10 === 0 || done === total) {
      const clients = await self.clients.matchAll();
      clients.forEach((c) => c.postMessage({ type: 'HYMN_PROGRESS', done, total }));
    }
  }
  const clients = await self.clients.matchAll();
  clients.forEach((c) => c.postMessage({ type: 'HYMN_DONE', done, total }));
}
