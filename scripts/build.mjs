import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.resolve(root, '..', 'Desktop', 'public');
const site = path.join(root, 'site');
fs.rmSync(site, { recursive: true, force: true });
fs.cpSync(source, site, { recursive: true });

const appPath = path.join(site, 'app.js');
let app = fs.readFileSync(appPath, 'utf8');
app = app.replace("fetch('/data/ATSE-Sample-Exam.json'", "fetch('./data/ATSE-Sample-Exam.json'");
fs.writeFileSync(appPath, app);

const indexPath = path.join(site, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace('<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />', '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />\n    <meta name="apple-mobile-web-app-capable" content="yes" />\n    <meta name="apple-mobile-web-app-status-bar-style" content="default" />\n    <link rel="apple-touch-icon" href="./icons/icon-512.png" />');
html = html.replace('<title>StudySprint</title>', '<link rel="icon" type="image/png" href="./icons/icon-512.png" />\n    <title>StudySprint</title>');
html = html.replace('href="/manifest.webmanifest"', 'href="./manifest.webmanifest"');
html = html.replace('href="/styles.css"', 'href="./styles.css"');
html = html.replace('<script type="module" src="/app.js"></script>', '<script src="./storage-adapter.js"></script>\n    <script defer src="./pwa-register.js"></script>\n    <script type="module" src="./app.js"></script>');
fs.writeFileSync(indexPath, html);

fs.copyFileSync(path.join(root, 'src', 'storage-adapter.js'), path.join(site, 'storage-adapter.js'));
fs.writeFileSync(path.join(site, 'pwa-register.js'), `if ('serviceWorker' in navigator && location.protocol === 'https:') {\n  window.addEventListener('load', () => navigator.serviceWorker.register(new URL('./sw.js', document.baseURI)).catch(() => {}));\n}\n`);
fs.writeFileSync(path.join(site, 'sw.js'), `const VERSION = 'studysprint-pages-v1';\nconst base = new URL('./', self.registration.scope);\nconst assets = ['.', 'index.html', 'styles.css', 'app.js', 'storage-adapter.js', 'manifest.webmanifest', 'data/StudySprint_DB.csv', 'data/StudySprint_DB.original.csv', 'data/ATSE-Sample-Exam.json'].map((item) => new URL(item, base).href);\nself.addEventListener('install', (event) => event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(assets)).then(() => self.skipWaiting())));\nself.addEventListener('activate', (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('studysprint-pages-') && key !== VERSION).map((key) => caches.delete(key)))).then(() => self.clients.claim())));\nself.addEventListener('fetch', (event) => { if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return; event.respondWith(fetch(event.request).then((response) => { if (response.ok) { const copy = response.clone(); caches.open(VERSION).then((cache) => cache.put(event.request, copy)); } return response; }).catch(async () => (await caches.match(event.request)) || caches.match(new URL('index.html', base).href))); });\n`);

const manifest = {
  name: 'StudySprint', short_name: 'StudySprint', start_url: './', scope: './', display: 'standalone',
  background_color: '#F6F0E3', theme_color: '#F6F0E3',
  description: 'Your local-first study plan and exam practice app.',
  icons: [{ src: './icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }]
};
fs.writeFileSync(path.join(site, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');
const icons = path.join(site, 'icons'); fs.mkdirSync(icons, { recursive: true });
const iconSource = path.resolve(root, '..', 'Desktop', 'build', 'icon.png');
fs.copyFileSync(iconSource, path.join(icons, 'icon-512.png'));

fs.appendFileSync(path.join(site, 'styles.css'), `\n/* GitHub Pages and phone refinements */\nhtml, body { max-width: 100%; overflow-x: hidden; }\nbody { min-height: 100vh; min-height: 100svh; }\n.app-frame { padding-bottom: calc(88px + env(safe-area-inset-bottom)); }\n.bottom-nav { padding-bottom: max(8px, env(safe-area-inset-bottom)); }\n@media (max-width: 760px) {\n  input, select, textarea, .auth-form input, .auth-form select { font-size: 16px !important; }\n  button, .nav-tab, .answer-node, .chip { touch-action: manipulation; }\n  .topbar { padding-left: max(16px, env(safe-area-inset-left)); padding-right: max(16px, env(safe-area-inset-right)); }\n  main { padding-left: max(16px, env(safe-area-inset-left)); padding-right: max(16px, env(safe-area-inset-right)); }\n  .modal-backdrop { padding: max(12px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom)); }\n  .modal-card { max-height: calc(100svh - 24px); }\n}\n`);
console.log(`GitHub Pages site generated at ${site}`);
