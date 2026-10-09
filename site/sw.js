const VERSION = 'studysprint-pages-v1';
const base = new URL('./', self.registration.scope);
const assets = ['.', 'index.html', 'styles.css', 'app.js', 'storage-adapter.js', 'manifest.webmanifest', 'data/StudySprint_DB.csv', 'data/StudySprint_DB.original.csv', 'data/ATSE-Sample-Exam.json'].map((item) => new URL(item, base).href);
self.addEventListener('install', (event) => event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(assets)).then(() => self.skipWaiting())));
self.addEventListener('activate', (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('studysprint-pages-') && key !== VERSION).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (event) => { if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return; event.respondWith(fetch(event.request).then((response) => { if (response.ok) { const copy = response.clone(); caches.open(VERSION).then((cache) => cache.put(event.request, copy)); } return response; }).catch(async () => (await caches.match(event.request)) || caches.match(new URL('index.html', base).href))); });
