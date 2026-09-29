/* ===== Service Worker：缓存静态资源，手机断网也能打开 ===== */
const CACHE = 'wrongbook-v4';

const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './splash/splash-1170x2532.png',
  './splash/splash-1179x2556.png',
  './splash/splash-1290x2796.png',
  './splash/splash-828x1792.png',
  './splash/splash-750x1334.png',
  './splash/splash-1125x2436.png',
  './js/db.js',
  './js/store.js',
  './js/export.js',
  './js/app.js',
  './js/views/home.js',
  './js/views/add.js',
  './js/views/detail.js',
  './js/views/paper.js',
  './js/views/practice.js',
  './js/views/settings.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* 网络优先：代码更新即时生效；断网时回退缓存 */
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res && res.ok && e.request.url.startsWith(self.location.origin)) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
