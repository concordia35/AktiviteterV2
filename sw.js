const CACHE_VERSION = '1.4.2';
const CACHE_PREFIX = 'concordia-aktiviteter-';
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './gallery-config.js',
  './events.json',
  './initiativer.json',
  './manifest.webmanifest',
  './qr.png',
  './assets/chainlinks.jpg',
  './assets/chainlinks.svg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if(event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

async function networkFirst(request){
  try{
    const networkRequest = new Request(request, { cache: 'no-store' });
    const response = await fetch(networkRequest);

    if(response.ok){
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }

    return response;
  }catch(error){
    const cached = await caches.match(request, { ignoreSearch: true });
    if(cached) return cached;

    if(request.mode === 'navigate'){
      const fallback = await caches.match('./index.html');
      if(fallback) return fallback;
    }

    throw error;
  }
}

self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if(url.origin !== self.location.origin) return;

  event.respondWith(networkFirst(event.request));
});
